/* PMC 2670 — Firefight : story mode's engine (docs/story-mode-plan.md)

   A story is a graph of nodes written as data (a brief, an event with its
   options, a battle, a debrief, a pool of chapters, an ending), registered
   with register(). Its state lives on the campaign dossier as
   campaign.story: where it is, its meters and flags, and a journal of what
   was chosen. Everything here reads and changes that state and the
   dossier's company, and nothing else: no page, no storage, no battle. The
   battle itself is the board's business; the story only hands over what the
   battle should be (battleSpec) and takes back how it went (resolveBattle).

   Dice go through R.d6 where the rules are loaded, so a seeded test rolls the
   same story every run. Every roll is made, and its result kept, at the
   moment the choice that asks for it is made: an ironman story saved after a
   choice brings back the result, never the choice. */
(function (root) {
  'use strict';

  var STORIES = {};

  function R() { return root.PMC || null; }
  function C() { return root.PMCCamp || null; }
  function d6() { var r = R(); return r && r.d6 ? r.d6() : 1 + Math.floor(Math.random() * 6); }
  function rnd() { return Math.random(); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }

  /* ================= the story's shape ================= */

  /* A meter is written as a number (where it starts) or in full:
     { start, min, max, shown, name }. Most run −5 to +5. */
  function meterDefs(def) {
    var out = {};
    Object.keys(def.meters || {}).forEach(function (k) {
      var m = def.meters[k];
      if (typeof m === 'number') m = { start: m };
      out[k] = {
        id: k, name: m.name || k, start: m.start || 0,
        min: m.min != null ? m.min : -5, max: m.max != null ? m.max : 5,
        shown: !!m.shown, uses: m.uses || [], twoWay: m.twoWay || [1, 2], thresholds: m.thresholds || []
      };
    });
    return out;
  }

  /* The nodes of every chapter, by id, each knowing its chapter. A chapter's
     own id leads to its first node. */
  function index(def) {
    var nodes = {}, chapters = {};
    (def.chapters || []).forEach(function (ch, ci) {
      chapters[ch.id] = ch;
      ch._order = ci;
      (ch.nodes || []).forEach(function (n, i) {
        n._chapter = ch.id;
        n._first = i === 0;
        nodes[n.id] = n;
      });
    });
    return { nodes: nodes, chapters: chapters };
  }

  function register(def) {
    var ix = index(def);
    def._nodes = ix.nodes;
    def._chapters = ix.chapters;
    def._meters = meterDefs(def);
    STORIES[def.id] = def;
    return def;
  }
  function get(id) { return STORIES[id] || null; }
  function list() { return Object.keys(STORIES).map(function (k) { return STORIES[k]; }); }

  /* Where a `next` leads: a node's id, or a chapter's (its first node). */
  function resolve(def, id) {
    if (!id) return null;
    if (def._nodes[id]) return def._nodes[id];
    var ch = def._chapters[id];
    return ch && ch.nodes && ch.nodes.length ? ch.nodes[0] : null;
  }

  /* ================= the state on the dossier ================= */

  function active(campaign) { return !!(campaign && campaign.story && campaign.story.id); }
  function storyOf(campaign) { return active(campaign) ? get(campaign.story.id) : null; }

  /* Start a story on a campaign that has its company founded. Ironman is set
     here and never changes. */
  function begin(campaign, id, opts) {
    var def = get(id);
    if (!def) throw new Error('No story ' + id);
    opts = opts || {};
    var meters = {};
    Object.keys(def._meters).forEach(function (k) { meters[k] = def._meters[k].start; });
    campaign.story = {
      id: def.id, version: def.version || 1, node: null,
      ironman: !!opts.ironman,
      difficulty: opts.difficulty && def.difficulty && def.difficulty[opts.difficulty] ? opts.difficulty : null,
      meters: meters, flags: {}, revealed: {},
      history: {},                 // each meter's values, chapter by chapter
      journal: [],
      chapter: null, chapterNo: 0, played: {},
      pending: null,               // between an event and its battle: the levers chosen
      next: [],                    // short-term changes held for a later node
      queue: [],                   // a debrief's or interlude's events still to come
      pool: null,                  // the second half's picks
      side: null,                  // an interlude's side contracts on offer
      detour: null,                // a side contract being fought: { id, job, back, pay }
      tokens: {},                  // {unit:…} picks, kept for the chapter
      checkpoints: [],
      founders: (campaign.companies && campaign.companies.A && campaign.companies.A.roster || []).map(function (e) { return e.rid; }),
      commander: null,             // the company's commander: the officer of its command squad, and the player
      ended: null
    };
    Object.keys(meters).forEach(function (k) { campaign.story.history[k] = [{ ch: 0, v: meters[k] }]; });
    nameCommander(campaign, opts.commander);
    enter(campaign, resolve(def, def.start && def.start.node || (def.chapters[0] && def.chapters[0].id)));
    return campaign.story;
  }

  /* ================= conditions ================= */

  var COND_KEYS = ['flag', 'meter', 'grade', 'roster', 'kUC', 'chance', 'all', 'any', 'not', 'chapter', 'played', 'revealed', 'ironman', 'wiped', 'target'];
  var CMP = ['gte', 'lte', 'gt', 'lt', 'eq'];

  function cmp(v, c) {
    if (c.gte != null && !(v >= c.gte)) return false;
    if (c.lte != null && !(v <= c.lte)) return false;
    if (c.gt != null && !(v > c.gt)) return false;
    if (c.lt != null && !(v < c.lt)) return false;
    if (c.eq != null && !(v === c.eq)) return false;
    return true;
  }
  var GRADES = ['decisive', 'victory', 'draw', 'defeat', 'rout'];
  var SUCCESS = { decisive: 1, victory: 1 };

  /* ctx: { campaign, st, def, grade }. A missing condition holds. */
  function test(ctx, c) {
    if (c == null) return true;
    if (Array.isArray(c)) return c.every(function (x) { return test(ctx, x); });
    var st = ctx.st;
    if (c.all) return c.all.every(function (x) { return test(ctx, x); });
    if (c.any) return c.any.some(function (x) { return test(ctx, x); });
    if (c.not) return !test(ctx, c.not);
    if (c.flag) return (c.is === false) ? !st.flags[c.flag] : !!st.flags[c.flag];
    if (c.meter) return cmp(st.meters[c.meter] || 0, c);
    if (c.grade) {
      var g = ctx.grade;
      if (c.grade === 'success') return !!SUCCESS[g];
      if (c.grade === 'failure') return !!g && !SUCCESS[g];
      return arr(c.grade).indexOf(g) >= 0;
    }
    if (c.wiped) return cmp(st.lastWiped || 0, c.wiped);
    // a battle's target (the target variant): 'killed' or 'captured', or nothing known
    if (c.target) return st.lastTarget === c.target;
    if (c.chapter != null) return cmp(st.chapterNo, typeof c.chapter === 'number' ? { eq: c.chapter } : c.chapter);
    if (c.played) return !!st.played[c.played];
    if (c.revealed) return !!st.revealed[c.revealed];
    if (c.ironman != null) return !!st.ironman === !!c.ironman;
    var co = company(ctx);
    if (c.kUC != null) return cmp(co ? co.kUC || 0 : 0, typeof c.kUC === 'number' ? { gte: c.kUC } : c.kUC);
    if (c.roster) {
      var v = !co ? 0 : c.roster === 'tier' ? co.tier || 1 : (co.roster || []).length;
      return cmp(v, c);
    }
    if (c.chance != null) return rnd() < c.chance;
    return true;
  }

  function company(ctx) { return ctx.campaign && ctx.campaign.companies ? ctx.campaign.companies.A : null; }

  /* ================= rolls ================= */

  /* { d6: 4, mods: [{ if, add }], meter: 'intel' } — a D6 that passes on the
     target or more, with each modifier whose condition holds and, if named, a
     meter's value added. The result is kept on the journal. */
  function roll(ctx, spec) {
    var die = d6(), mod = 0;
    arr(spec.mods).forEach(function (m) {
      if (m.meter) mod += (ctx.st.meters[m.meter] || 0) * (m.per || 1);
      else if (test(ctx, m.if)) mod += m.add || 0;
    });
    if (spec.meter) mod += ctx.st.meters[spec.meter] || 0;
    var total = die + mod;
    return { die: die, mod: mod, total: total, need: spec.d6 || 4, pass: total >= (spec.d6 || 4) };
  }

  /* ================= effects ================= */

  var EFFECT_KEYS = ['meter', 'flag', 'reveal', 'kUC', 'exp', 'tp', 'recruit', 'upgrade', 'leave', 'next', 'journal', 'roll', 'if'];

  function setMeter(ctx, k, v) {
    var md = ctx.def._meters[k];
    if (!md) return;
    var st = ctx.st;
    v = Math.max(md.min, Math.min(md.max, v));
    if (st.meters[k] === v) return;
    st.meters[k] = v;
    (st.history[k] = st.history[k] || []).push({ ch: st.chapterNo, v: v });
  }

  /* Apply a list of effects. Each one is small; a few reach the dossier. What
     happened is returned as lines, for the journal and the debrief. */
  function apply(ctx, effects, out) {
    out = out || [];
    arr(effects).forEach(function (e) {
      if (!e) return;
      if (e.if && !test(ctx, e.if)) { if (e.else) apply(ctx, e.else, out); return; }
      var st = ctx.st, co = company(ctx);
      if (e.meter) {
        var was = st.meters[e.meter] || 0;
        setMeter(ctx, e.meter, e.set != null ? e.set : was + (e.add || 0));
        out.push({ meter: e.meter, from: was, to: st.meters[e.meter] });
      }
      if (e.flag) {
        var on = e.set !== false;
        if (on) st.flags[e.flag] = e.local ? 'local' : true; else delete st.flags[e.flag];
        out.push({ flag: e.flag, set: on });
      }
      if (e.reveal) { st.revealed[e.reveal] = true; out.push({ reveal: e.reveal }); }
      if (e.kUC != null && co) { co.kUC = Math.max(0, (co.kUC || 0) + e.kUC); out.push({ kUC: e.kUC }); }
      if (e.exp != null && co) {
        eachUnit(ctx, e.to, function (u) { u.exp = (u.exp || 0) + e.exp; });
        out.push({ exp: e.exp, to: e.to || 'all' });
      }
      if (e.tp != null && co) {
        eachUnit(ctx, e.to, function (u) { u.tp = Math.max(0, (u.tp || 0) + e.tp); });
        out.push({ tp: e.tp, to: e.to || 'all' });
      }
      if (e.recruit && co) {
        var cc = C();
        var ent = cc ? cc.newEntry(e.recruit, { co: co, free: !!e.free }) : { rid: 'r' + co.roster.length, key: e.recruit, exp: 0, tp: 0, upgrades: [], honours: [], traumas: [] };
        if (e.name) ent.name = e.name;
        co.roster.push(ent);
        out.push({ recruit: e.recruit, rid: ent.rid });
      }
      if (e.upgrade && co) {
        var u = freeUpgrade(co);
        out.push({ upgrade: u ? u.name : null });
      }
      if (e.leave && co) {
        var gone = leave(co, e.leave);
        out.push({ leave: gone });
      }
      if (e.next) { st.next.push(clone(e.next)); out.push({ next: e.next.battle || e.next.event || true }); }
      if (e.journal) out.push({ journal: e.journal });
      if (e.roll) {
        var r = roll(ctx, e.roll);
        out.push({ roll: r });
        apply(ctx, r.pass ? e.pass : e.fail, out);
      }
    });
    return out;
  }

  /* Every unit, or the ones that fought the last battle. */
  function eachUnit(ctx, to, fn) {
    var co = company(ctx), fielded = ctx.st.fielded || [];
    (co.roster || []).forEach(function (u) {
      if (to === 'fielded' && fielded.indexOf(u.rid) < 0) return;
      fn(u);
    });
  }

  /* A free upgrade on whichever vehicle or craft can take one: the story's
     reward, so it needs no EXP. */
  function freeUpgrade(co) {
    var cc = C(), r = R();
    if (!cc || !r) return null;
    var can = co.roster.filter(function (e) {
      var p = r.profile(e.key);
      return p && p.cls !== 'infantry' && p.faction !== 'bugs' && cc.availableUpgrades(e).length &&
        e.upgrades.length < cc.upgradeCap(e);
    });
    if (!can.length) return null;
    var e = can[Math.floor(rnd() * can.length)], g = cc.availableUpgrades(e)[0];
    e.upgrades.push(g.n);
    return { rid: e.rid, name: g.name || g.n };
  }

  /* n units walk out: never the command unit. */
  function leave(co, n) {
    var gone = [];
    for (var i = 0; i < n; i++) {
      var can = co.roster.filter(function (e) { return e.rid !== co.cmdRid; });
      if (!can.length) break;
      var e = can[Math.floor(rnd() * can.length)];
      co.roster.splice(co.roster.indexOf(e), 1);
      gone.push(e.name || e.key);
    }
    return gone;
  }

  /* What an option costs: { intel: 1 } in meters, or { kUC: 2 }. */
  function canPay(ctx, cost) {
    if (!cost) return true;
    var co = company(ctx);
    return Object.keys(cost).every(function (k) {
      if (k === 'kUC') return co && (co.kUC || 0) >= cost.kUC;
      return (ctx.st.meters[k] || 0) >= cost[k];
    });
  }
  function pay(ctx, cost, out) {
    if (!cost) return;
    Object.keys(cost).forEach(function (k) {
      if (k === 'kUC') apply(ctx, { kUC: -cost.kUC }, out);
      else apply(ctx, { meter: k, add: -cost[k] }, out);
    });
  }

  /* ================= walking the graph ================= */

  function ctxOf(campaign, extra) {
    var c = { campaign: campaign, st: campaign.story, def: storyOf(campaign) };
    if (extra) Object.keys(extra).forEach(function (k) { c[k] = extra[k]; });
    return c;
  }

  /* Arrive at a node. Nodes that need nobody (a branch, a happening) are
     passed straight through; the rest wait for the player. */
  function enter(campaign, node, depth) {
    var st = campaign.story, def = storyOf(campaign);
    depth = depth || 0;
    if (depth > 200) throw new Error('Story loop at ' + (node && node.id));
    if (!node) { st.node = null; return; }
    st.node = node.id;
    // (a shared chapter only holds events used from elsewhere, the interludes': it is never started)
    var ch = def._chapters[node._chapter];
    if (node._first && node._chapter !== st.chapter && !ch.shared) startChapter(campaign, ch);
    else if (node.type === 'event' || node.type === 'battle') checkpoint(campaign, 'node');
    var ctx = ctxOf(campaign);
    // an option, or a roll, that settled things without a fight
    if (node.type === 'battle' && battleSpec(campaign).levers.skip) return skipTo(campaign, node, depth);
    if (node.type === 'branch') {
      var to = null;
      arr(node.when).some(function (w) { if (test(ctx, w.if)) { to = w.next; return true; } return false; });
      return enter(campaign, resolve(def, to), depth + 1);
    }
    if (node.type === 'happening') {
      var lines = apply(ctx, node.effects);
      note(campaign, { node: node.id, effects: lines });
      return enter(campaign, resolve(def, node.next), depth + 1);
    }
    if (node.type === 'pool') return enterPool(campaign, node, depth);
    if (node.type === 'interlude' && !(st.side && st.side.node === node.id)) st.side = makeOffers(campaign, node);
    if (node.type === 'ending') {
      st.ended = endingFor(campaign);
      note(campaign, { node: node.id, ending: st.ended });
    }
  }

  function startChapter(campaign, ch) {
    var st = campaign.story, def = storyOf(campaign);
    // the chapter that ends takes its local flags with it
    Object.keys(st.flags).forEach(function (f) { if (st.flags[f] === 'local') delete st.flags[f]; });
    st.chapter = ch.id;
    if (ch.counts !== false) st.chapterNo++;
    st.played[ch.id] = true;
    st.tokens = {};
    var ctx = ctxOf(campaign), lines = [];
    // what time does at every chapter's start (the hive grows, a low Sentiment feeds the Front)
    if (ch.counts !== false) arr(def.everyChapter).forEach(function (e) { apply(ctx, e, lines); });
    apply(ctx, ch.onStart, lines);
    note(campaign, { chapter: ch.id, node: ch.id, effects: lines });
    checkpoint(campaign, 'chapter');
  }

  function note(campaign, line) {
    var st = campaign.story;
    line.chapter = line.chapter || st.chapter;
    line.no = st.chapterNo;
    st.journal.push(line);
  }

  /* The node the story waits at, made ready to show: its options, each with
     whether it can be taken and why not. */
  function view(campaign) {
    var st = campaign.story, def = storyOf(campaign), node = def && nodeAt(campaign);
    if (!node) return null;
    var ctx = ctxOf(campaign), out = { id: node.id, type: node.type, title: node.title || null, text: node.text || '', chapter: st.chapter };
    if (node.type === 'event') out.options = optionsOf(ctx, node);
    if (node.type === 'pool') out.options = st.pool ? st.pool.offers.map(function (o) {
      var ch = def._chapters[o.chapter];
      return { id: o.chapter, text: ch.title, thread: o.thread, ok: true };
    }) : [];
    if (node.type === 'battle') out.battle = battleSpec(campaign);
    if (node.type === 'interlude') out.side = sideOffers(campaign, node);
    if (node.side) out.sideJob = st.detour ? st.detour.job : null;
    if (node.type === 'ending') out.ending = st.ended;
    if (node.talk) out.talk = conversation(campaign, node.talk);
    return out;
  }

  function optionsOf(ctx, node) {
    return arr(node.options).filter(function (o) {
      return !o.hidden || test(ctx, o.if);
    }).map(function (o) {
      var ok = test(ctx, o.if) && canPay(ctx, o.cost);
      return { id: o.id, text: o.text, ok: ok, why: ok ? null : (o.why || 'Not open to you now.'), extreme: !!o.extreme, cost: o.cost || null };
    });
  }

  /* Take an option at an event, or a chapter at the pool. */
  function choose(campaign, optionId) {
    var st = campaign.story, def = storyOf(campaign), node = nodeAt(campaign);
    if (!node) throw new Error('The story is not waiting on a choice');
    if (node.type === 'pool') return choosePool(campaign, node, optionId);
    if (node.type !== 'event') throw new Error(node.id + ' is not an event');
    var ctx = ctxOf(campaign), o = arr(node.options).filter(function (x) { return x.id === optionId; })[0];
    if (!o) throw new Error('No option ' + optionId + ' at ' + node.id);
    if (!test(ctx, o.if) || !canPay(ctx, o.cost)) throw new Error('Option ' + optionId + ' is not open');
    var lines = [];
    pay(ctx, o.cost, lines);
    apply(ctx, o.effects, lines);
    // the other jobs on offer, passed up: their own effects, settled now
    arr(node.options).forEach(function (x) { if (x !== o && x.passed && test(ctx, x.if)) apply(ctx, x.passed, lines); });
    if (o.battle) st.pending = mergeLevers(st.pending, o.battle);
    note(campaign, { node: node.id, choice: o.id, effects: lines });
    return advance(campaign, o.next || node.next);
  }

  function mergeLevers(a, b) {
    var out = clone(a) || {};
    Object.keys(b || {}).forEach(function (k) { out[k] = clone(b[k]); });
    return out;
  }

  /* Go on from a node that only shows something (a brief, a debrief, an
     interlude), or from an event to whatever its debrief queued next. */
  function proceed(campaign) {
    var st = campaign.story, def = storyOf(campaign), node = nodeAt(campaign);
    if (!node) return null;
    if (node.type === 'event' || node.type === 'battle' || node.type === 'pool') throw new Error(node.id + ' waits on a choice');
    if (node.type === 'ending') return null;
    if (node.type === 'debrief' || node.type === 'interlude') {
      var ctx = ctxOf(campaign, { grade: st.lastGrade });
      var picks = arr(node.events).filter(function (id) {
        var ev = def._nodes[id];
        return ev && test(ctx, ev.if);
      }).slice(0, node.pick || (node.type === 'interlude' ? 1 : 2));
      st.queue = picks.concat([{ after: node.next }]).slice(0);
      if (node.type === 'interlude') leaveSide(campaign, node);
      return advanceQueue(campaign);
    }
    return advance(campaign, node.next);
  }

  /* After an event: the next one a debrief queued, or where it said to go. */
  function advance(campaign, next) {
    var st = campaign.story, def = storyOf(campaign);
    if (st.queue.length) return advanceQueue(campaign, next);
    enter(campaign, resolve(def, next));
    return view(campaign);
  }
  function advanceQueue(campaign) {
    var st = campaign.story, def = storyOf(campaign);
    var q = st.queue.shift();
    if (q && typeof q === 'object') { st.queue = []; enter(campaign, resolve(def, q.after)); return view(campaign); }
    enter(campaign, def._nodes[q]);
    return view(campaign);
  }

  /* ================= battles ================= */

  /* What the battle at this node should be: the node's own setting, the levers
     the event before it chose, and any short-term change held for it. The
     battle hooks (phase 2) turn this into the engine's cfg. */
  function battleSpec(campaign) {
    var st = campaign.story, def = storyOf(campaign), node = nodeAt(campaign);
    if (!node || node.type !== 'battle') return null;
    var spec = {
      node: node.id, scenario: node.scenario, variant: clone(node.variant) || null, name: node.name || null, map: node.map || null,
      text: node.text || null,
      tier: node.tier || 'max', pl: node.pl || 1, planet: node.planet || null, tactics: node.tactics || null, role: node.role || null,
      enemy: clone(node.enemy) || null, allies: clone(node.allies) || null, waves: clone(node.waves) || null, levers: clone(st.pending) || {}
    };
    st.next.forEach(function (n) {
      if (n.battle !== node.id) return;
      spec.levers = mergeLevers(spec.levers, n.levers || {});
      if (n.enemy) spec.enemy = Object.assign(spec.enemy || {}, { changes: arr(spec.enemy && spec.enemy.changes).concat(arr(n.enemy.changes || n.enemy)) });
    });
    // the node's own adjustments, by what has happened: { if, levers }
    var ctx = ctxOf(campaign);
    arr(node.adjust).forEach(function (a) { if (test(ctx, a.if)) spec.levers = mergeLevers(spec.levers, a.levers); });
    if (spec.levers.scenario) spec.scenario = spec.levers.scenario;
    if (spec.levers.variant) spec.variant = mergeLevers(spec.variant, spec.levers.variant);
    if (spec.levers.tier) spec.tier = spec.levers.tier;
    if (spec.levers.role) spec.role = spec.levers.role;
    if (spec.levers.name) spec.name = spec.levers.name;
    if (spec.levers.map) spec.map = spec.levers.map;
    return spec;
  }

  /* What is said in a battle (a story's `talk`): for each moment, one line,
     the battle's own first and the enemy side's otherwise, picked at random
     among those whose `if` holds (one with an `if` before one without), written out, with who says it. Handed to the
     battle (levers.js), which puts each up once, when it happens
     (storybattle.js storyTalk). */
  var TALK_MOMENTS = ['start', 'turn3', 'kill', 'loss', 'bhalf', 'ahalf', 'wave', 'parley', 'target'];
  function talkFor(campaign, spec) {
    var def = storyOf(campaign), talk = def && def.talk;
    if (!talk || !spec) return [];
    var ctx = ctxOf(campaign), own = (talk.battles || {})[spec.node] || {};
    var side = (talk.sides || {})[spec.enemy && spec.enemy.side] || {};
    var people = def.people || {}, out = [];
    TALK_MOMENTS.forEach(function (m) {
      var open = function (ls) { return arr(ls).filter(function (l) { return !l.if || test(ctx, l.if); }); };
      var ls = open(own[m]);
      if (!ls.length) ls = open(side[m]);
      if (!ls.length) return;
      // a line that answers what has happened comes before one that could be said anywhere
      var apt = ls.filter(function (l) { return l.if; });
      if (apt.length) ls = apt;
      var l = ls[Math.floor(Math.random() * ls.length)], who = people[l.who] || {};
      out.push({ on: m, who: l.who, name: who.name || l.who, role: who.role || '', text: render(campaign, l.text) });
    });
    // the allies: they report in as it opens (`allies`), and answer each order (allyVoice)
    var av = allyVoice(campaign, spec);
    if (av && av.report.length) out.unshift({ on: 'allies', who: av.who, name: av.name, role: av.role, text: av.report[Math.floor(Math.random() * av.report.length)] });
    return out;
  }
  /* A conversation on a page (a node's `talk`): each line with who says it,
     their name and what they are, written out; `commander` is the company's
     own, by rank and name. Lines whose `if` does not hold are left out. */
  function conversation(campaign, lines) {
    var people = (storyOf(campaign) || {}).people || {}, co = campaign.companies && campaign.companies.A, ctx = ctxOf(campaign);
    // (a line can ask what has happened, `if`, and be said by someone the story names only there, `name`)
    return arr(lines).filter(function (l) { return !l.if || test(ctx, l.if); }).map(function (l) {
      var who = people[l.who] || {}, me = l.who === 'commander';
      return { who: l.who, name: me ? commanderWords(campaign, 'rank') : (l.name || who.name || l.who), role: me ? (co ? co.name : '') : (l.role || who.role || ''), text: render(campaign, l.text) };
    });
  }
  /* What the allies say, if a battle has them: who they are, and their words
     for reporting in and for each order, written out. */
  function allyVoice(campaign, spec) {
    var def = storyOf(campaign), talk = def && def.talk, al = spec && spec.levers && spec.levers.allies;
    var v = al && talk && talk.allies && talk.allies[al.side];
    if (!v) return null;
    var who = (def.people || {})[v.who] || {}, out = { who: v.who, name: who.name || v.who, role: who.role || '' };
    ['report', 'move', 'attack', 'hold', 'clear'].forEach(function (k) { out[k] = arr(v[k]).map(function (t) { return render(campaign, t); }); });
    return out;
  }

  /* A battle's report graded from side A's view (the plan, section 3):
     decisive, victory, draw, defeat or rout. Losses are counted in
     composition points: a unit's Tier, times the share of it lost. */
  function grade(report, side) {
    side = side || 'A';
    var other = side === 'A' ? 'B' : 'A';
    var routed = report.routed || {};
    if (!report.winner) return 'draw';
    if (report.winner === side) {
      var mine = lost(report, side), theirs = lost(report, other);
      return routed[other] || (theirs > 0 && theirs >= 2 * mine) ? 'decisive' : 'victory';
    }
    return routed[side] ? 'rout' : 'defeat';
  }
  function lost(report, side) {
    var pts = 0;
    (report.units || []).forEach(function (u) {
      if (u.side !== side || u.free || u.ally) return;
      var share = u.destroyed || u.wiped ? 1 : u.startSize ? Math.max(0, u.startSize - (u.endSize || 0)) / u.startSize : 0;
      pts += (u.tier || 1) * share;
    });
    return pts;
  }

  /* The battle is over: the grade picks the branch. A report or a grade will
     do; the units that fought are kept, for effects that reach only them. */
  function resolveBattle(campaign, result) {
    var st = campaign.story, def = storyOf(campaign), node = nodeAt(campaign);
    if (!node || node.type !== 'battle') throw new Error('The story is not at a battle');
    var g = typeof result === 'string' ? result : grade(result, 'A');
    if (GRADES.indexOf(g) < 0) throw new Error('No grade ' + g);
    if (result && typeof result === 'object') {
      st.fielded = (result.units || []).filter(function (u) { return u.side === 'A' && u.rid; }).map(function (u) { return u.rid; });
      st.lastWiped = (result.units || []).filter(function (u) { return u.side === 'A' && !u.free && !u.ally && (u.wiped || u.destroyed); }).length;
      st.lastTarget = result.story && result.story.target || null;
    } else st.lastWiped = 0, st.lastTarget = null;
    st.lastGrade = g;
    var ctx = ctxOf(campaign, { grade: g });
    var on = node.on || {};
    var branches = on[g] || (SUCCESS[g] ? on.success : on.failure) || [];
    var lines = [], to = node.next;
    // a side contract: its own pay and effects, and back to the interlude; time and HTX's bonus are the story's battles'
    if (!node.side) arr(def.everyBattle).forEach(function (e) { apply(ctx, e, lines); });
    var bonus = node.side ? jobPay(st.detour, g) : bonusFor(ctx, node, g);
    if (bonus) apply(ctx, { kUC: bonus }, lines);
    arr(branches).some(function (b) {
      if (!test(ctx, b.if)) return false;
      apply(ctx, b.effects, lines);
      if (b.next) to = b.next;
      return true;
    });
    // what was held for this battle is spent
    st.next = st.next.filter(function (n) { return n.battle !== node.id; });
    st.pending = null;
    note(campaign, { node: node.id, grade: g, effects: lines });
    if (node.side) { st.detour = null; st.node = node.next; return view(campaign); }
    enter(campaign, resolve(def, to));
    return view(campaign);
  }

  /* Conceding, or throwing away a battle in progress: in ironman that is a rout. */
  function forfeit(campaign) { return resolveBattle(campaign, 'rout'); }

  /* A battle skipped (an option's `battle: { skip: true }`): the node's skip
     branch, and on without a fight. */
  function skipTo(campaign, node, depth) {
    var st = campaign.story, def = storyOf(campaign);
    var on = node.on || {}, ctx = ctxOf(campaign), lines = [], to = node.next;
    arr(on.skip).some(function (b) {
      if (!test(ctx, b.if)) return false;
      apply(ctx, b.effects, lines);
      if (b.next) to = b.next;
      return true;
    });
    st.pending = null;
    note(campaign, { node: node.id, skipped: true, effects: lines });
    return enter(campaign, resolve(def, to), (depth || 0) + 1);
  }

  /* ================= pay, and side contracts ================= */

  /* The node the story waits at: one of the story's own, or the side contract
     being fought, made up from its job (it is no node of the graph). */
  function nodeAt(campaign) {
    var st = campaign.story, def = storyOf(campaign);
    if (!def || !st.node) return null;
    if (def._nodes[st.node]) return def._nodes[st.node];
    return st.detour && st.detour.id === st.node ? jobNode(def, st.detour) : null;
  }
  function jobOf(def, id) { return arr(def.side && def.side.jobs).filter(function (j) { return j.id === id; })[0] || null; }
  function jobNode(def, d) {
    var j = jobOf(def, d.job);
    if (!j) return null;
    return { id: d.id, type: 'battle', side: true, title: j.title, name: j.name || j.title, text: j.text || null, scenario: j.scenario, map: j.map || null,
      tier: j.tier || 'max', pl: j.pl || 1, role: j.role || null, enemy: j.enemy, variant: j.variant || null, waves: j.waves || null,
      on: j.on || {}, next: d.back };
  }

  /* The bonus HTX pays for a story battle (the plan, section 4): the battle's
     `pay`, else the story's base, by HTX Standing; a share of it for a draw; none
     for a defeat, and none once HTX has stopped paying.
     def.pay: { base, meter, step, draw, cutOff: [flags] }. */
  function bonusFor(ctx, node, g) {
    var P = ctx.def.pay;
    if (!P || node.pay === 0) return 0;
    if (arr(P.cutOff).some(function (f) { return ctx.st.flags[f]; })) return 0;
    var share = SUCCESS[g] ? 1 : g === 'draw' ? (P.draw || 0) : 0;
    if (!share) return 0;
    var m = P.meter ? ctx.st.meters[P.meter] || 0 : 0;
    return Math.max(0, Math.round((node.pay != null ? node.pay : P.base || 0) * share * (1 + (P.step || 0) * m) * (difficultyOf(ctx.campaign).pay || 1)));
  }
  /* The difficulty the story was begun at (chosen once, at the start, like
     ironman): the story's `difficulty` entry for it, else its default (the
     first marked `default`), else nothing changed. Its numbers: `fill`, added
     to every enemy force's share of the battle's points; `allowance`, what the
     company's experience adds to them, multiplied; `pay`, HTX's bonus and the
     side contracts' pay, multiplied. */
  function difficultyOf(campaign) {
    var def = storyOf(campaign), D = def && def.difficulty;
    if (!D) return {};
    var id = campaign.story.difficulty || Object.keys(D).filter(function (k) { return D[k].default; })[0];
    return (id && D[id]) || {};
  }
  // a side contract's pay: all of it for a win, half for a draw
  function jobPay(d, g) { return !d ? 0 : SUCCESS[g] ? d.pay : g === 'draw' ? Math.floor(d.pay / 2) : 0; }

  /* Whether the company is behind the story's growth curve (def.side.curve:
     the Company Tier wanted by each chapter): then side contracts are offered
     to catch up, more of them and at no cost in time. */
  function behind(campaign) {
    var side = storyOf(campaign).side, co = campaign.companies && campaign.companies.A;
    var want = side && side.curve ? side.curve[campaign.story.chapterNo] : null;
    return !!(co && want && (co.tier || 1) < want);
  }
  function cutOffNow(campaign) {
    var side = storyOf(campaign).side;
    return arr(side && side.cutOff).some(function (f) { return campaign.story.flags[f]; });
  }
  /* An interlude's side contracts (the plan, section 4): how many, by whether the
     company is behind and whether HTX still pays (def.side.offers: { base,
     behind, cutOff }), drawn from the jobs open now, never the last one taken
     twice running. Drawn once, on arriving, and kept: ironman holds. */
  function makeOffers(campaign, node) {
    var st = campaign.story, def = storyOf(campaign), side = def.side;
    if (!side || node.side === false) return null;
    var ctx = ctxOf(campaign), cut = cutOffNow(campaign), late = behind(campaign), o = side.offers || {};
    var n = node.sideOffers != null ? node.sideOffers : cut ? (o.cutOff || 0) : late ? (o.behind || 0) : (o.base || 0);
    var open = arr(side.jobs).filter(function (j) { return test(ctx, j.if) && st.lastJob !== j.id; }), offers = [];
    while (offers.length < n && open.length) {
      var j = open.splice(Math.floor(Math.random() * open.length), 1)[0];
      offers.push({ job: j.id, pay: Math.max(1, Math.round(j.pay * (cut ? side.cutOffPay || 1 : 1) * (difficultyOf(campaign).pay || 1))), catchUp: late });
    }
    return { node: node.id, offers: offers, taken: null };
  }
  // the offers as the interlude shows them
  function sideOffers(campaign, node) {
    var st = campaign.story, def = storyOf(campaign);
    if (!st.side || st.side.node !== node.id || st.side.taken) return [];
    return st.side.offers.map(function (o) {
      var j = jobOf(def, o.job) || {};
      return { id: o.job, title: j.title, text: j.text || '', against: j.enemy && j.enemy.side, pay: o.pay, catchUp: o.catchUp,
        cost: o.catchUp ? null : j.cost || null, passed: j.passed || null };
    });
  }
  /* Take a side contract at an interlude: what it costs (time, unless it was
     offered to catch up), and its battle, after which the story comes back to
     the interlude. Only one an interlude. */
  function takeSide(campaign, jobId) {
    var st = campaign.story, def = storyOf(campaign), node = nodeAt(campaign);
    if (!node || node.type !== 'interlude' || !st.side || st.side.node !== node.id || st.side.taken) throw new Error('No side contract on offer here');
    var o = st.side.offers.filter(function (x) { return x.job === jobId; })[0], j = o && jobOf(def, jobId);
    if (!j) throw new Error('Side contract ' + jobId + ' is not on offer');
    var ctx = ctxOf(campaign), lines = [];
    if (!o.catchUp) apply(ctx, j.cost, lines);
    // the others on offer, passed up
    st.side.offers.forEach(function (x) { if (x !== o) apply(ctx, (jobOf(def, x.job) || {}).passed, lines); });
    st.side.taken = jobId;
    st.lastJob = jobId;
    st.pending = null;
    st.detour = { id: '@side:' + jobId, job: jobId, back: node.id, pay: o.pay };
    st.node = st.detour.id;
    note(campaign, { node: st.detour.id, side: jobId, effects: lines });
    return view(campaign);
  }
  // going on from an interlude: the side contracts not taken are passed up
  function leaveSide(campaign, node) {
    var st = campaign.story, def = storyOf(campaign);
    if (st.side && st.side.node === node.id && !st.side.taken && st.side.offers.length) {
      var ctx = ctxOf(campaign), lines = [];
      st.side.offers.forEach(function (x) { apply(ctx, (jobOf(def, x.job) || {}).passed, lines); });
      if (lines.length) note(campaign, { node: node.id, passedSide: true, effects: lines });
    }
    st.side = null;
  }

  /* ================= the pool: the second half ================= */

  /* A thread's pressure: the sum of its weighted meters and flags. */
  function pressure(ctx, thread) {
    var st = ctx.st, p = 0;
    arr(thread.pressure).forEach(function (w) {
      if (w.if && !test(ctx, w.if)) return;
      if (w.meter) p += (st.meters[w.meter] || 0) * (w.w != null ? w.w : 1);
      else if (w.flag) p += st.flags[w.flag] ? (w.w != null ? w.w : 1) : 0;
      else p += w.w || 0;
    });
    return p;
  }

  function threadChapters(def, tid) {
    return (def.chapters || []).filter(function (ch) { return ch.thread === tid; });
  }
  /* The chapter a thread offers now: its first eligible, unplayed arc chapter,
     or its fallback. */
  function offerFor(ctx, tid) {
    var def = ctx.def, st = ctx.st, chs = threadChapters(def, tid).filter(function (ch) { return !ch.finale && !st.played[ch.id]; });
    var pick = chs.filter(function (ch) { return !ch.fallback && test(ctx, ch.when); })[0];
    return pick || chs.filter(function (ch) { return ch.fallback && test(ctx, ch.when); })[0] || null;
  }

  function enterPool(campaign, node, depth) {
    var st = campaign.story, def = storyOf(campaign), ctx = ctxOf(campaign);
    if (!st.pool || st.pool.node !== node.id) st.pool = { node: node.id, left: node.picks || def.picks || 3 };
    if (st.pool.left <= 0) return enterFinale(campaign, node, depth);
    var ranked = Object.keys(def.threads || {}).map(function (tid) {
      return { thread: tid, p: pressure(ctx, def.threads[tid]), offer: offerFor(ctx, tid) };
    }).filter(function (t) { return t.offer; }).sort(function (a, b) { return b.p - a.p; });
    st.pool.offers = ranked.slice(0, node.offer || 2).map(function (t) { return { thread: t.thread, chapter: t.offer.id }; });
    if (!st.pool.offers.length) return enterFinale(campaign, node, depth);
  }

  function choosePool(campaign, node, chapterId) {
    var st = campaign.story, def = storyOf(campaign), ctx = ctxOf(campaign);
    var offer = st.pool.offers.filter(function (o) { return o.chapter === chapterId; })[0];
    if (!offer) throw new Error('Chapter ' + chapterId + ' is not on offer');
    var lines = [];
    st.pool.offers.forEach(function (o) {
      if (o === offer) return;
      apply(ctx, def._chapters[o.chapter].passed, lines);
    });
    st.pool.left--;
    note(campaign, { node: node.id, choice: chapterId, effects: lines });
    enter(campaign, resolve(def, chapterId));
    return view(campaign);
  }

  /* The finale goes to the enemy thread under the most pressure that has had
     at least one of its arc chapters played; failing that, to the one under the
     most pressure. A story's overrides (the Breakout) come first. */
  function finaleChapter(ctx) {
    var def = ctx.def, st = ctx.st;
    var over = arr(def.finaleOverride).filter(function (o) { return test(ctx, o.if); })[0];
    if (over) return def._chapters[over.chapter];
    var cand = Object.keys(def.threads || {}).filter(function (tid) { return def.threads[tid].finale !== false; }).map(function (tid) {
      var fin = threadChapters(def, tid).filter(function (ch) { return ch.finale && test(ctx, ch.when); })[0];
      var arc = threadChapters(def, tid).some(function (ch) { return !ch.finale && st.played[ch.id]; });
      return { tid: tid, fin: fin, arc: arc, p: pressure(ctx, def.threads[tid]) };
    }).filter(function (c) { return c.fin; }).sort(function (a, b) { return b.p - a.p; });
    var withArc = cand.filter(function (c) { return c.arc; })[0];
    return (withArc || cand[0] || {}).fin || null;
  }
  function enterFinale(campaign, node, depth) {
    var ch = finaleChapter(ctxOf(campaign)), def = storyOf(campaign);
    campaign.story.pool.finale = ch ? ch.id : null;
    return enter(campaign, ch ? resolve(def, ch.id) : resolve(def, node.then), depth + 1);
  }

  /* ================= endings ================= */

  /* The first ending whose conditions hold. The last ending has none. */
  function endingFor(campaign) {
    var ctx = ctxOf(campaign, { grade: campaign.story.lastGrade });
    // (Broken Company is not chosen here: it comes when the company breaks)
    var e = arr(storyOf(campaign).endings).filter(function (x) { return !x.broken && test(ctx, x.if); })[0];
    return e ? e.id : null;
  }

  /* The ending's epilogue (the plan, section 2): the story's `epilogue`, a
     list of { about, if, text }, the first that fits for each `about` (the
     moon, Varga, the hive, the town, the company's paymasters...), in the order
     they are written; then who stayed, from the company's own roster: the units
     that came down with it on the first day, and the ones it honoured. */
  function epilogue(campaign) {
    var def = storyOf(campaign), st = campaign.story, ctx = ctxOf(campaign), done = {}, out = [];
    if (!def || !st.ended) return { lines: [], stayed: [] };
    arr(def.epilogue).forEach(function (e) {
      if (e.about && done[e.about]) return;
      if (e.ending && arr(e.ending).indexOf(st.ended) < 0) return;
      if (e.if && !test(ctx, e.if)) return;
      if (e.about) done[e.about] = true;
      out.push(render(campaign, e.text));
    });
    var co = campaign.companies && campaign.companies.A, founders = st.founders || [];
    var stayed = (co && co.roster || []).filter(function (e) {
      return founders.indexOf(e.rid) >= 0 || (e.honours || []).length;
    }).map(function (e) {
      return { rid: e.rid, name: e.name, first: founders.indexOf(e.rid) >= 0, honours: (e.honours || []).length };
    });
    return { lines: out, stayed: stayed };
  }

  /* Broken Company: the force cannot field a Tier I army after its hub turn. */
  function broken(campaign) {
    var cc = C(), co = campaign.companies && campaign.companies.A;
    if (!cc || !co) return false;
    /* Broken: no legal army at any Battle Tier up to its own, with the units
       not resting. (A company grown past Tier I may no longer fit a Tier I list,
       its units promoted out of it, and is not broken for that.) */
    for (var t = 1; t <= Math.max(1, co.tier || 1); t++) if (cc.canFieldArmy(co, t, 1, true)) return false;
    return true;
  }
  function breakCompany(campaign) {
    var st = campaign.story, def = storyOf(campaign);
    var b = arr(def.endings).filter(function (e) { return e.broken; })[0];
    st.ended = b ? b.id : 'broken';
    note(campaign, { ending: st.ended, broken: true });
    st.node = null;
    return st.ended;
  }

  /* ================= checkpoints, and rewinding ================= */

  /* A copy of the whole dossier and its story, to rewind to: every chapter's
     start, and in the story's last two chapters each event and battle. Only the
     newest of those inside a chapter is kept. Ironman keeps none. */
  function checkpoint(campaign, kind) {
    var st = campaign.story, def = storyOf(campaign);
    if (!st || st.ironman) return;
    var len = def.length || (def.chapters || []).length;
    if (kind === 'node' && st.chapterNo < len - 1) return;
    var cps = st.checkpoints;
    st.checkpoints = [];
    var snap = clone(campaign);
    st.checkpoints = cps;
    if (kind === 'node') {
      for (var i = cps.length - 1; i >= 0; i--) if (cps[i].kind === 'node' && cps[i].chapter === st.chapter) cps.splice(i, 1);
    }
    cps.push({ kind: kind, chapter: st.chapter, no: st.chapterNo, node: st.node, at: Date.now(), snap: snap });
  }

  /* Back to a checkpoint: the company as it was then, the dead, the kUC and the
     EXP included. The checkpoints from before it are kept. */
  function rewind(campaign, i) {
    var st = campaign.story;
    if (st.ironman) throw new Error('An ironman story cannot be rewound');
    var cp = st.checkpoints[i];
    if (!cp) throw new Error('No checkpoint ' + i);
    var keep = st.checkpoints.slice(0, i + 1);
    var snap = clone(cp.snap);
    Object.keys(campaign).forEach(function (k) { delete campaign[k]; });
    Object.keys(snap).forEach(function (k) { campaign[k] = snap[k]; });
    campaign.story.checkpoints = keep;
    /* A chapter's checkpoint can stand on a node nobody waits at (a branch, a
       happening, the pool): carried on from there, as on the first arrival. */
    var def = storyOf(campaign), node = def._nodes[campaign.story.node];
    if (node && (node.type === 'branch' || node.type === 'happening' || node.type === 'pool')) {
      campaign.story.checkpoints = keep.slice(0, i);
      enter(campaign, node);
      campaign.story.checkpoints = keep;
    }
    return view(campaign);
  }

  /* The commander: the officer at the head of the command squad, named as the
     player asked when the story began (else as the roster already has them).
     The name is kept on the story and the company, whatever becomes of the
     squad's other men. */
  function nameCommander(campaign, name) {
    var co = campaign.companies && campaign.companies.A, cc = C();
    var cmd = co && cc && co.cmdRid ? cc.byRid(co, co.cmdRid) : null;
    if (cmd && cc.menOf) cc.menOf(cmd, co);
    var officer = cmd && cmd.men && cmd.men[0];
    name = String(name || '').trim().slice(0, 28);
    if (officer && name) officer.name = name;
    campaign.story.commander = name || (officer ? officer.name : null);
    if (co && campaign.story.commander) co.commander = campaign.story.commander;
  }
  /* {commander}: the name; {commander:rank}: the rank and surname, as the men
     call them (the command squad's officer's rank, as it is now). */
  function commanderWords(campaign, form) {
    var st = campaign.story, co = campaign.companies && campaign.companies.A, cc = C();
    var name = st.commander || (co && co.commander);
    if (!name) return 'the commander';
    if (form !== 'rank') return name;
    var cmd = co && cc && co.cmdRid ? cc.byRid(co, co.cmdRid) : null;
    var officer = cmd && cmd.men && cmd.men[0];
    var rank = officer && officer.name === name && officer.rank ? officer.rank : 'Commander';
    var parts = name.split(/\s+/);
    return rank + ' ' + parts[parts.length - 1];
  }

  /* ================= text ================= */

  /* {name}, {commander} and {commander:rank}, {if flag}…{/if}, {if not flag}…{/if} (and {if success}, {if failure}: the last battle's), {meter:htx},
     {unit:command|recon|veteran|wounded}, {soldier:…}. A unit token keeps the
     same unit for the rest of the chapter, and has a fallback if none fits. */
  function render(campaign, text) {
    if (!text) return '';
    var st = campaign.story, co = campaign.companies && campaign.companies.A;
    // (`success` and `failure` are the last battle's, not flags)
    var holds = function (f) {
      if (f === 'success') return st.lastGrade === 'decisive' || st.lastGrade === 'victory';
      if (f === 'failure') return !!st.lastGrade && st.lastGrade !== 'decisive' && st.lastGrade !== 'victory';
      return !!st.flags[f];
    };
    var s = text.replace(/\{if (not )?([a-z0-9_]+)\}([\s\S]*?)\{\/if\}/g, function (m, not, f, body) {
      return holds(f) !== !!not ? body : '';
    });
    return s.replace(/\{(name|commander(?::rank)?|meter:[a-z0-9_]+|unit:[a-z]+|soldier:[a-z]+)\}/g, function (m, k) {
      if (k === 'name') return co ? co.name : 'the company';
      if (k === 'commander' || k === 'commander:rank') return commanderWords(campaign, k === 'commander:rank' ? 'rank' : 'name');
      if (k.indexOf('meter:') === 0) return String(st.meters[k.slice(6)]);
      var u = tokenUnit(campaign, k.split(':')[1]);
      if (k.indexOf('soldier:') === 0) {
        var men = u && u.men && u.men.length ? u.men : null;
        return men ? (men[0].rank ? men[0].rank + ' ' : '') + men[0].name : u ? 'the leader of ' + u.name : 'your sergeant';
      }
      return u ? u.name : 'one of your units';
    });
  }
  function tokenUnit(campaign, kind) {
    var st = campaign.story, co = campaign.companies && campaign.companies.A;
    if (!co || !co.roster.length) return null;
    var cc = C();
    if (st.tokens[kind]) {
      var kept = cc ? cc.byRid(co, st.tokens[kind]) : null;
      if (kept) return kept;
    }
    var pick = null, r = R();
    if (kind === 'command') pick = cc ? cc.byRid(co, co.cmdRid) : null;
    else if (kind === 'veteran' || kind === 'tech') pick = co.roster.slice().sort(function (a, b) { return (b.exp || 0) - (a.exp || 0); })[0];
    else if (kind === 'wounded') pick = co.roster.slice().sort(function (a, b) { return (b.tp || 0) - (a.tp || 0); })[0];
    else if (kind === 'recon' && r) pick = co.roster.filter(function (e) {
      var p = r.profile(e.key);
      return p && /recon|scout|sniper/i.test((p.name || '') + ' ' + (p.rules || []).join(' '));
    })[0];
    pick = pick || co.roster[0];
    st.tokens[kind] = pick.rid;
    return pick;
  }

  /* How much the company knows of the enemy it is about to fight: 0, word of
     them (how many, what kind); 1, an outline (roughly how many of each, and
     who leads them); 2, the full list. The story's `intel` rules ({ if, add,
     side }: the Intel meter, the locals' goodwill, a turned informant) and the
     battle's own `intel` lever (a scout's report, a bribe) add up. */
  function intel(campaign, spec) {
    var def = storyOf(campaign);
    spec = spec || battleSpec(campaign);
    if (!def || !spec) return 0;
    var ctx = ctxOf(campaign), side = spec.enemy && spec.enemy.side, n = (spec.levers && spec.levers.intel) || 0;
    arr(def.intel).forEach(function (r) {
      if ((!r.side || r.side === side) && (!r.if || test(ctx, r.if))) n += r.add == null ? 1 : r.add;
    });
    return Math.max(0, Math.min(2, n));
  }

  root.PMCStory = {
    register: register, get: get, list: list, resolve: resolve,
    active: active, begin: begin, view: view, choose: choose, proceed: proceed,
    battleSpec: battleSpec, intel: intel, difficultyOf: difficultyOf, takeSide: takeSide, nodeAt: nodeAt, grade: grade, resolveBattle: resolveBattle, forfeit: forfeit,
    test: test, apply: apply, roll: roll, pressure: pressure, finaleChapter: finaleChapter,
    endingFor: endingFor, epilogue: epilogue, broken: broken, breakCompany: breakCompany,
    checkpoint: checkpoint, rewind: rewind, render: render, ctxOf: ctxOf, talkFor: talkFor, allyVoice: allyVoice,
    GRADES: GRADES, COND_KEYS: COND_KEYS, CMP: CMP, EFFECT_KEYS: EFFECT_KEYS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStory;
})(typeof window !== 'undefined' ? window : global);
