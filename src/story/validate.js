/* PMC 2670 — Firefight : a story checked before anyone plays it
   (docs/story-mode-plan.md, section 6)

   check() reads the story's graph as written: every `next` leads somewhere,
   every battle has a failure branch, no two events offer the same levers,
   every flag is set and read, every meter moves both ways and is read where
   it changes something, and the one-offs are reached only through choices
   marked extreme. walk() plays the story many times with random choices and
   random grades, and no battle: what it finds only a walk can find (an event
   left with no option open, an ending nobody reaches), and the numbers the
   writing is balanced by. */
(function (root) {
  'use strict';
  var S = root.PMCStory || require('./story.js');

  function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }

  /* Where a flag or a meter is read, and what kind of reading it is. Only the
     table, the choices and the route count: text alone does not. */
  var MEANINGFUL = { table: 1, choice: 1, route: 1, outcome: 1 };

  var EFFECT_PARAMS = { add: 1, set: 1, local: 1, to: 1, free: 1, name: 1, pass: 1, fail: 1, else: 1, is: 1 };
  var FAILURE_GRADES = ['draw', 'defeat', 'rout'];
  var LEVERS = ['intel', 'role', 'edge', 'strikes', 'suppressOwn', 'readiness', 'scenario', 'variant', 'tier', 'pl',
    'allies', 'turns', 'terrain', 'planet', 'world', 'skip', 'tactics', 'name', 'map'];

  function check(def, opts) {
    opts = opts || {};
    var errors = [], warnings = [];
    function err(m) { errors.push(m); }
    function warn(m) { warnings.push(m); }
    var nodes = def._nodes || {}, chapters = def._chapters || {};
    var flags = {};       // flag → { set: [{at, extreme, half, chapter}], read: [{at, kind, chapter}] }
    var meters = {};      // meter → { up: {half: n}, down: {half: n}, read: [{at, kind}] }
    function F(f) { return flags[f] || (flags[f] = { set: [], read: [] }); }
    function M(m) { return meters[m] || (meters[m] = { up: {}, down: {}, read: [] }); }
    var mdefs = def._meters || {};

    /* ---- ids ---- */
    var seen = {};
    (def.chapters || []).forEach(function (ch) {
      if (seen[ch.id]) err('Id used twice: ' + ch.id);
      seen[ch.id] = 1;
      (ch.nodes || []).forEach(function (n) {
        if (seen[n.id]) err('Id used twice: ' + n.id);
        seen[n.id] = 1;
      });
    });

    function ref(at, id, what) {
      if (id == null) return;
      if (!S.resolve(def, id)) err(at + ': ' + (what || 'next') + ' "' + id + '" leads nowhere');
    }

    /* ---- conditions: what they read, and as what ---- */
    function readCond(c, at, kind, chapter) {
      if (c == null) return;
      if (Array.isArray(c)) return c.forEach(function (x) { readCond(x, at, kind, chapter); });
      if (typeof c !== 'object') return err(at + ': a condition must be an object');
      var keys = Object.keys(c).filter(function (k) { return S.CMP.indexOf(k) < 0 && k !== 'is'; });
      if (!keys.length) return;
      var known = keys.filter(function (k) { return S.COND_KEYS.indexOf(k) >= 0; });
      if (!known.length) err(at + ': unknown condition ' + JSON.stringify(c));
      if (c.all) readCond(c.all, at, kind, chapter);
      if (c.any) readCond(c.any, at, kind, chapter);
      if (c.not) readCond(c.not, at, kind, chapter);
      if (c.flag) F(c.flag).read.push({ at: at, kind: kind, chapter: chapter });
      if (c.meter) {
        if (!mdefs[c.meter]) err(at + ': no meter ' + c.meter);
        M(c.meter).read.push({ at: at, kind: kind });
      }
      arr(c.more).forEach(function (m) {
        if (!mdefs[m]) err(at + ': no meter ' + m);
        M(m).read.push({ at: at, kind: kind });
      });
    }
    function flagsIn(c, out) {
      out = out || [];
      if (!c || typeof c !== 'object') return out;
      if (Array.isArray(c)) { c.forEach(function (x) { flagsIn(x, out); }); return out; }
      if (c.flag) out.push(c.flag);
      ['all', 'any', 'not'].forEach(function (k) { if (c[k]) flagsIn(c[k], out); });
      return out;
    }

    /* ---- effects: what they set and move ---- */
    function readEffects(list, at, where) {
      arr(list).forEach(function (e) {
        if (!e || typeof e !== 'object') return err(at + ': an effect must be an object');
        var keys = Object.keys(e);
        keys.forEach(function (k) {
          if (S.EFFECT_KEYS.indexOf(k) < 0 && !EFFECT_PARAMS[k]) err(at + ': unknown effect "' + k + '"');
        });
        if (e.if) readCond(e.if, at, 'outcome', where.chapter);
        if (e.flag) {
          if (e.set !== false) F(e.flag).set.push({ at: at, extreme: !!where.extreme, half: where.half, chapter: where.chapter, local: !!e.local });
        }
        if (e.meter) {
          if (!mdefs[e.meter]) err(at + ': no meter ' + e.meter);
          var m = M(e.meter);
          // a shared chapter's events (the interludes') come up in both halves
          if (!where.time) (where.half === 'both' ? [1, 2] : [where.half]).forEach(function (h) {
            if (e.set != null || (e.add || 0) > 0) m.up[h] = (m.up[h] || 0) + 1;
            if (e.set != null || (e.add || 0) < 0) m.down[h] = (m.down[h] || 0) + 1;
          });
        }
        if (e.reveal && !mdefs[e.reveal]) err(at + ': no meter ' + e.reveal + ' to reveal');
        if (e.roll) {
          arr(e.roll.mods).forEach(function (md) {
            if (md.meter) M(md.meter).read.push({ at: at, kind: 'choice' });
            readCond(md.if, at, 'choice', where.chapter);
          });
          if (e.roll.meter) M(e.roll.meter).read.push({ at: at, kind: 'choice' });
          readEffects(e.pass, at, where);
          readEffects(e.fail, at, where);
        }
        if (e.else) readEffects(e.else, at, where);
        if (e.next) {
          levers(at, e.next.levers, where);
          if (e.next.battle) ref(at, e.next.battle, 'next.battle');
          if (e.next.event) ref(at, e.next.event, 'next.event');
        }
        if (e.recruit) unitKey(at, e.recruit);
      });
    }

    function unitKey(at, k) {
      var key = typeof k === 'string' ? k : k && k.key;
      if (!key) return;
      if (opts.profile && !opts.profile(key)) err(at + ': no unit "' + key + '"');
    }

    function scenario(at, id) {
      if (!id) return;
      if (/^s_/.test(id)) err(at + ': solitaire scenarios are not used in story mode ("' + id + '")');
      if (opts.scenarios && !opts.scenarios[id]) err(at + ': no scenario "' + id + '"');
    }

    function levers(at, lv, where) {
      if (!lv) return;
      Object.keys(lv).forEach(function (k) {
        if (LEVERS.indexOf(k) < 0) err(at + ': unknown battle lever "' + k + '"');
      });
      if (lv.solo) err(at + ': story battles never set solo');
      scenario(at, lv.scenario);
      arr(lv.allies && lv.allies.core).forEach(function (u) { unitKey(at, u); });
      void where;
    }

    function force(at, f, chapter) {
      if (!f) return;
      // a force written from an archetype: it must be one the game has (opts.archetype: campaign.js archetype)
      if (f.archetype && opts.archetype && !opts.archetype(f.archetype)) err(at + ': no archetype "' + f.archetype + '"');
      ['core', 'units'].forEach(function (k) { arr(f[k]).forEach(function (u) { unitKey(at, u); }); });
      if (f.optional) {
        arr(f.optional.units).forEach(function (u) { unitKey(at, u); });
        if (f.optional.meter) M(f.optional.meter).read.push({ at: at, kind: 'table' });
      }
      if (f.fill) {
        arr(f.fill.from).forEach(function (u) { unitKey(at, u); });
        if (f.fill.meter) M(f.fill.meter).read.push({ at: at, kind: 'table' });
      }
      Object.keys(f.byTier || {}).forEach(function (t) { arr(f.byTier[t]).forEach(function (u) { unitKey(at, u); }); });
      arr(f.changes).forEach(function (c) {
        readCond(c.if, at, 'table', chapter);
        if (c.add) unitKey(at, c.add);
        if (c.remove) unitKey(at, c.remove);
      });
    }

    /* A place on the trail: a kind of world the terrain generator knows, and
       Other Worlds conditions the book has (opts.kinds, opts.world). */
    function place(at, p) {
      if (!p) return;
      if (opts.kinds && p.kind && opts.kinds.indexOf(p.kind) < 0) err(at + ': no kind of world "' + p.kind + '"');
      Object.keys(p.world || {}).forEach(function (k) {
        if (opts.world && (!opts.world[k] || opts.world[k].indexOf(p.world[k]) < 0)) err(at + ': no world condition ' + k + ' "' + p.world[k] + '"');
      });
    }

    /* ---- the chapters, node by node ---- */
    var eventSigs = { 1: {}, 2: {} }, stateSigs = { 1: {}, 2: {} };
    var oneOffFlags = {};       // flag → the branches it opens a one-off at
    (def.chapters || []).forEach(function (ch) {
      var half = ch.shared ? 'both' : ch.half || 1, where = { half: half, chapter: ch.id };
      readCond(ch.when, ch.id, 'route', ch.id);
      place(ch.id, ch.place);
      if (ch.rival && ch.rival !== 'leading') err(ch.id + ': a chapter\u2019s rival is "leading" or nothing');
      if (ch.rival && !(def.leading && arr(def.leading.from).length)) err(ch.id + ': a chapter against the leading rival, and no rivals to lead');
      readEffects(ch.onStart, ch.id, where);
      readEffects(ch.passed, ch.id, where);
      if (!(ch.nodes || []).length) err(ch.id + ': a chapter with no nodes');
      (ch.nodes || []).forEach(function (n) {
        var at = n.id;
        ref(at, n.next);
        if (n.type === 'event') {
          readCond(n.if, at, 'choice', ch.id);
          var opt = arr(n.options);
          if (opt.length < 2 || opt.length > 4) warn(at + ': an event should offer two to four options, not ' + opt.length);
          var seenOpt = {};
          opt.forEach(function (o) {
            var oat = at + '/' + o.id;
            if (seenOpt[o.id]) err(oat + ': option id used twice');
            seenOpt[o.id] = 1;
            readCond(o.if, oat, 'choice', ch.id);
            Object.keys(o.cost || {}).forEach(function (k) {
              // an amount read from a meter (a company's price)
              if (typeof o.cost[k] === 'string') {
                if (!mdefs[o.cost[k]]) err(oat + ': no meter ' + o.cost[k] + ' for its cost');
                M(o.cost[k]).read.push({ at: oat, kind: 'choice' });
              }
              if (k !== 'kUC') {
                if (!mdefs[k]) err(oat + ': no meter ' + k + ' to pay with');
                M(k).read.push({ at: oat, kind: 'choice' });
                (half === 'both' ? [1, 2] : [half]).forEach(function (h) { M(k).down[h] = (M(k).down[h] || 0) + 1; });
              }
            });
            readEffects(o.effects, oat, { half: half, chapter: ch.id, extreme: !!o.extreme });
            readEffects(o.passed, oat, where);
            levers(oat, o.battle, where);
            ref(oat, o.next);
            if (o.next && chapters[o.next] && chapters[o.next].oneOff && !o.extreme) err(oat + ': leads to the one-off ' + o.next + ' but is not marked extreme');
          });
          if (!n.next && !opt.every(function (o) { return o.next; }) && !n.queued) {
            // an event queued by a debrief or interlude goes on from there
            var queued = (def.chapters || []).some(function (c2) {
              return (c2.nodes || []).some(function (m) { return arr(m.events).indexOf(n.id) >= 0; });
            });
            if (!queued) err(at + ': an event with nowhere to go after it');
          }
          var bs = opt.map(function (o) { return Object.keys(o.battle || {}).sort().join('+'); }).filter(Boolean).sort().join(' | ');
          if (bs && half !== 'both') {
            if (eventSigs[half][bs]) err(at + ': offers the same battle levers as ' + eventSigs[half][bs] + ' (' + bs + ')');
            else eventSigs[half][bs] = at;
          }
          var ss = opt.map(function (o) {
            return arr(o.effects).map(function (e) { return e.meter ? e.meter + (e.add > 0 ? '+' : '-') : e.flag ? 'flag' : Object.keys(e)[0]; }).sort().join(',');
          }).sort().join(' | ');
          if (ss && half !== 'both') {
            if (stateSigs[half][ss]) warn(at + ': offers the same state levers as ' + stateSigs[half][ss]);
            else stateSigs[half][ss] = at;
          }
        }
        if (n.type === 'battle') {
          scenario(at, n.scenario);
          var maps = root.PMCStoryMaps && root.PMCStoryMaps[def.id];
          if (n.map && maps && !maps[n.map]) err(at + ': no map "' + n.map + '"');
          if (opts.scenarios && opts.scenarios[n.scenario] && !opts.scenarios[n.scenario].compound && !n.map && def.chapters.some(function (c) { return c.id === ch.id && !c.test; }) && maps &&
            !(def.mapsPending && def.mapsPending.indexOf(ch.half) >= 0)) warn(at + ': no map of its own: its ground is rolled');
          if (n.solo) err(at + ': story battles never set solo');
          // the relic variant is found and carried: Find and secure, and nothing else
          if (n.variant && n.variant.relic && n.scenario !== 'find') err(at + ': a relic battle is Find and secure, not ' + n.scenario);
          force(at, n.enemy, ch.id);
          place(at, n.place);
          if (n.enemy && n.enemy.rival === 'leading' && !ch.rival) err(at + ': fights the leading rival, but its chapter does not name one');
          if (n.waves && n.waves.meter) {
            if (!mdefs[n.waves.meter]) err(at + ': no meter ' + n.waves.meter + ' for its waves');
            M(n.waves.meter).read.push({ at: at, kind: 'table' });
          }
          force(at, n.allies, ch.id);
          arr(n.adjust).forEach(function (a) { readCond(a.if, at, 'table', ch.id); levers(at, a.levers, where); });
          var on = n.on || {};
          var hasFail = on.failure || FAILURE_GRADES.every(function (g) { return on[g]; });
          if (!hasFail) err(at + ': a battle with no failure branch');
          Object.keys(on).forEach(function (k) {
            if (['success', 'failure', 'skip'].concat(S.GRADES).indexOf(k) < 0) err(at + ': unknown branch "' + k + '"');
            arr(on[k]).forEach(function (b) {
              readCond(b.if, at, 'route', ch.id);
              readEffects(b.effects, at, where);
              ref(at, b.next);
            });
          });
        }
        if (n.type === 'branch') {
          if (!arr(n.when).length) err(at + ': a branch with nowhere to go');
          if (arr(n.when).length && arr(n.when)[arr(n.when).length - 1].if) warn(at + ': a branch whose last way has a condition can fall through');
          arr(n.when).forEach(function (w) {
            readCond(w.if, at, 'route', ch.id);
            ref(at, w.next);
            var to = chapters[w.next];
            if (to && to.oneOff) {
              flagsIn(w.if).forEach(function (f) { (oneOffFlags[f] = oneOffFlags[f] || []).push(at); });
              if (!w.if) err(at + ': leads to the one-off ' + w.next + ' without a condition');
            }
          });
        }
        if (n.type === 'happening') readEffects(n.effects, at, where);
        if (n.type === 'debrief' || n.type === 'interlude') {
          arr(n.events).forEach(function (id) {
            ref(at, id, 'event');
            if (nodes[id] && nodes[id].type !== 'event') err(at + ': ' + id + ' is not an event');
          });
        }
        if (n.type === 'pool') ref(at, n.then, 'then');
        if (['brief', 'event', 'battle', 'debrief', 'happening', 'interlude', 'branch', 'pool', 'ending'].indexOf(n.type) < 0) err(at + ': unknown node type "' + n.type + '"');
        if (n.who && !(def.people || {})[n.who]) err(at + ': no one called "' + n.who + '" among the story\u2019s people');
        arr(n.talk).forEach(function (l, i) {
          if (!(def.people || {})[l.who]) err(at + ': no one called "' + l.who + '" among the story\u2019s people, to speak');
          if (l.if) readCond(l.if, at + '/talk' + i, 'text', ch.id);
          textReads(l.text, at, ch.id);
        });
        textReads(n.text, at, ch.id);
      });
    });

    function textReads(text, at, chapter) {
      String(text || '').replace(/\{if (?:not )?([a-z0-9_]+)\}/g, function (m, f) {
        if (f !== 'success' && f !== 'failure' && f !== 'relic') F(f).read.push({ at: at, kind: 'text', chapter: chapter });
        return m;
      });
    }

    /* ---- every node can be reached from the start ---- */
    var reached = {}, todo = [S.resolve(def, def.start && def.start.node || (def.chapters[0] && def.chapters[0].id))];
    function go(id) { var n = S.resolve(def, id); if (n && !reached[n.id]) todo.push(n); }
    while (todo.length) {
      var n = todo.pop();
      if (!n || reached[n.id]) continue;
      reached[n.id] = 1;
      go(n.next);
      arr(n.options).forEach(function (o) { go(o.next); });
      arr(n.when).forEach(function (w) { go(w.next); });
      Object.keys(n.on || {}).forEach(function (k) { arr(n.on[k]).forEach(function (b) { go(b.next); }); });
      arr(n.events).forEach(go);
      if (n.type === 'pool') {
        go(n.then);
        (def.chapters || []).forEach(function (c) { if (c.thread) go(c.id); });
        Object.keys(def.rivals || {}).forEach(function (id) { force('rival ' + id, def.rivals[id], null); });
    arr(def.leading && def.leading.from).forEach(function (id) {
      if (!mdefs[id]) err('leading: no meter ' + id);
      else M(id).read.push({ at: 'leading', kind: 'route' });
      if (!(def.rivals || {})[id]) err('leading: no force for the rival ' + id);
    });
    arr(def.finaleOverride).forEach(function (o) { go(o.chapter); });
      }
    }
    Object.keys(nodes).forEach(function (id) { if (!reached[id]) err(id + ': can never be reached'); });

    /* ---- the story's own rules ---- */
    arr(def.everyChapter).forEach(function (e, i) { readEffects(e, 'everyChapter[' + i + ']', { half: 0, time: true }); });
    arr(def.everyBattle).forEach(function (e, i) { readEffects(e, 'everyBattle[' + i + ']', { half: 0, time: true }); });
    /* ---- the epilogue: { about, ending, if, text }; its reads are text, and count for nothing ---- */
    arr(def.epilogue).forEach(function (e, i) {
      var at = 'epilogue[' + i + ']';
      if (!e.text) err(at + ': an epilogue line with no text');
      readCond(e.if, at, 'text');
      textReads(e.text, at);
      arr(e.ending).forEach(function (id) { if (!arr(def.endings).some(function (x) { return x.id === id; })) err(at + ': no ending ' + id); });
    });
    /* ---- the side contracts, and HTX's bonus ---- */
    if (def.side) {
      var sideMaps = root.PMCStoryMaps && root.PMCStoryMaps[def.id];
      arr(def.side.jobs).forEach(function (j) {
        var at = 'side ' + j.id, where = { half: 'both' };
        if (!j.id || !j.title) err(at + ': a side contract needs an id and a title');
        if (!(j.pay > 0)) err(at + ': a side contract that pays nothing');
        scenario(at, j.scenario);
        if (j.map && sideMaps && !sideMaps[j.map]) err(at + ': no map "' + j.map + '"');
        force(at, j.enemy, null);
        readCond(j.if, at, 'choice');
        readEffects(j.cost, at, where);
        readEffects(j.passed, at, where);
        Object.keys(j.on || {}).forEach(function (k) {
          arr(j.on[k]).forEach(function (b) { readCond(b.if, at, 'route'); readEffects(b.effects, at, where); });
        });
      });
      arr(def.side.cutOff).forEach(function (f) { F(f).read.push({ at: 'side contracts', kind: 'choice' }); });
    }
    if (def.pay) {
      if (def.pay.meter) { if (!mdefs[def.pay.meter]) err('pay: no meter ' + def.pay.meter); else M(def.pay.meter).read.push({ at: 'pay', kind: 'table' }); }
      arr(def.pay.cutOff).forEach(function (f) { F(f).read.push({ at: 'pay', kind: 'table' }); });
    }
    // what the company knows of the enemy before a battle: { if, add, side }
    arr(def.intel).forEach(function (r, i) {
      readCond(r.if, 'intel[' + i + ']', 'table');
      if (r.side && !(def.sides || {})[r.side]) err('intel[' + i + ']: no side "' + r.side + '"');
    });
    Object.keys(def.threads || {}).forEach(function (tid) {
      var t = def.threads[tid];
      arr(t.pressure).forEach(function (w) {
        if (w.meter) M(w.meter).read.push({ at: 'thread ' + tid, kind: 'route' });
        if (w.flag) F(w.flag).read.push({ at: 'thread ' + tid, kind: 'route' });
        readCond(w.if, 'thread ' + tid, 'route');
      });
      var chs = (def.chapters || []).filter(function (c) { return c.thread === tid; });
      if (!chs.some(function (c) { return c.fallback; })) err('thread ' + tid + ': no fallback chapter');
      var fin = chs.filter(function (c) { return c.finale; });
      if (t.finale === false && fin.length) err('thread ' + tid + ': has no finale of its own, but ' + fin[0].id + ' is marked finale');
      if (t.finale !== false && !fin.length) err('thread ' + tid + ': no finale chapter');
    });
    (def.chapters || []).forEach(function (c) {
      if (c.thread && !(def.threads || {})[c.thread]) err(c.id + ': no thread ' + c.thread);
    });
    arr(def.finaleOverride).forEach(function (o) { readCond(o.if, 'finaleOverride', 'route'); ref('finaleOverride', o.chapter, 'chapter'); });
    var ends = arr(def.endings);
    if (!ends.length) err('The story has no endings');
    ends.forEach(function (e) { readCond(e.if, 'ending ' + e.id, 'route'); });
    var plain = ends.filter(function (e) { return !e.broken; });
    if (plain.length && plain[plain.length - 1].if) err('The last ending must have no conditions, so every path has one');
    Object.keys(mdefs).forEach(function (k) { if (mdefs[k].uses.length) M(k).read.push({ at: 'meter ' + k, kind: 'table' }); });

    /* ---- flags: set, read, and read where it matters ---- */
    Object.keys(flags).forEach(function (f) {
      var x = flags[f];
      if (!x.set.length && !(opts.external || []).includes(f)) err('Flag ' + f + ' is read but never set');
      if (!x.set.length) return;
      var real = x.read.filter(function (r) { return MEANINGFUL[r.kind]; });
      if (!x.read.length) err('Flag ' + f + ' is set but never read');
      else if (!real.length) err('Flag ' + f + ' is only read by text: it changes nothing in play');
      if (x.set.some(function (s) { return s.local; })) {
        var chs = x.set.map(function (s) { return s.chapter; });
        if (!real.some(function (r) { return chs.indexOf(r.chapter) >= 0; })) err('Local flag ' + f + ' is not read inside its own chapter');
      }
    });
    Object.keys(oneOffFlags).forEach(function (f) {
      var x = flags[f];
      if (x && x.set.some(function (s) { return !s.extreme; })) err('Flag ' + f + ' leads to a one-off (' + oneOffFlags[f][0] + ') but is set by a choice not marked extreme: ' + x.set.filter(function (s) { return !s.extreme; })[0].at);
    });

    /* ---- meters: both ways in each half, and read ---- */
    Object.keys(mdefs).forEach(function (k) {
      var m = M(k), md = mdefs[k];
      if (!m.read.some(function (r) { return MEANINGFUL[r.kind]; })) err('Meter ' + k + ' is never read: it changes nothing');
      md.twoWay.forEach(function (h) {
        if (!m.up[h]) err('Meter ' + k + ' is never raised by an event in half ' + h);
        if (!m.down[h]) err('Meter ' + k + ' is never lowered by an event in half ' + h);
      });
    });

    return { ok: !errors.length, errors: errors, warnings: warnings, flags: flags, meters: meters };
  }

  /* ================= the Monte Carlo walk ================= */

  /* walks: how many; grades: weights for each grade; company: a stub, unless a
     real dossier is wanted. No battle is played. */
  function walk(def, opts) {
    opts = opts || {};
    var n = opts.walks || 1000;
    var weights = opts.grades || { decisive: 1, victory: 2, draw: 1, defeat: 1.5, rout: 0.5 };
    var gl = Object.keys(weights), gt = gl.reduce(function (s, g) { return s + weights[g]; }, 0);
    function pickGrade() {
      var r = Math.random() * gt;
      for (var i = 0; i < gl.length; i++) { r -= weights[gl[i]]; if (r < 0) return gl[i]; }
      return gl[gl.length - 1];
    }
    var out = {
      walks: n, endings: {}, visits: {}, stuck: [], noOptions: {}, chapters: {}, flags: {},
      meters: {}, thresholds: {}, finales: {}, finaleWithArc: 0, oneOffs: {}, steps: 0
    };
    Object.keys(def._meters).forEach(function (k) {
      out.meters[k] = { 1: { min: Infinity, max: -Infinity }, 2: { min: Infinity, max: -Infinity }, moved: {} };
    });
    for (var w = 0; w < n; w++) {
      var campaign = opts.campaign ? opts.campaign() : { companies: { A: { name: 'Test company', kUC: 0, tier: 1, roster: [] } } };
      S.begin(campaign, def.id, {});
      var st = campaign.story, guard = 0, crossed = {};
      var lastHalf = 1;
      while (!st.ended && guard++ < 1000) {
        var v = S.view(campaign);
        if (!v) { out.stuck.push(st.node || '(nowhere)'); break; }
        out.visits[v.id] = (out.visits[v.id] || 0) + 1;
        var ch = def._chapters[st.chapter];
        var half = ch && ch.half || lastHalf;
        if (half !== lastHalf) { sampleMeters(out, st, lastHalf); lastHalf = half; }
        sampleThresholds(def, st, crossed);
        if (v.type === 'event' || v.type === 'pool') {
          var open = v.options.filter(function (o) { return o.ok; });
          if (!open.length) { out.noOptions[v.id] = (out.noOptions[v.id] || 0) + 1; break; }
          S.choose(campaign, open[Math.floor(Math.random() * open.length)].id);
        } else if (v.type === 'battle') {
          S.resolveBattle(campaign, pickGrade());
        } else if (v.type === 'ending') {
          break;
        } else if (v.type === 'interlude' && v.side && v.side.length && Math.random() < 0.5) {
          S.takeSide(campaign, v.side[Math.floor(Math.random() * v.side.length)].id);
        } else {
          S.proceed(campaign);
        }
      }
      if (guard >= 1000) out.stuck.push(st.node);
      if (st.node) out.visits[st.node] = (out.visits[st.node] || 0) + 1;
      sampleMeters(out, st, lastHalf);
      sampleThresholds(def, st, crossed);
      out.steps += guard;
      var end = st.ended || '(none)';
      out.endings[end] = (out.endings[end] || 0) + 1;
      Object.keys(st.played).forEach(function (c) {
        out.chapters[c] = (out.chapters[c] || 0) + 1;
        if (def._chapters[c] && def._chapters[c].oneOff) out.oneOffs[c] = (out.oneOffs[c] || 0) + 1;
      });
      Object.keys(st.flags).forEach(function (f) { out.flags[f] = (out.flags[f] || 0) + 1; });
      st.journal.forEach(function (j) {
        (j.effects || []).forEach(function (e) {
          if (e.meter && e.to !== e.from) {
            var mv = out.meters[e.meter].moved, key = j.node + (j.choice ? '/' + j.choice : '');
            mv[key] = (mv[key] || 0) + Math.abs(e.to - e.from);
          }
        });
      });
      Object.keys(crossed).forEach(function (t) { out.thresholds[t] = (out.thresholds[t] || 0) + 1; });
      if (st.pool && st.pool.finale) {
        out.finales[st.pool.finale] = (out.finales[st.pool.finale] || 0) + 1;
        var tid = def._chapters[st.pool.finale].thread;
        if (!tid || (def.chapters || []).some(function (c) { return c.thread === tid && !c.finale && st.played[c.id]; })) out.finaleWithArc++;
      }
    }
    out.unreached = Object.keys(def._nodes).filter(function (id) { return !out.visits[id] && def._nodes[id].type !== 'branch' && def._nodes[id].type !== 'happening'; });
    out.unreachedEndings = arr(def.endings).filter(function (e) { return !out.endings[e.id] && !e.broken; }).map(function (e) { return e.id; });
    return out;
  }
  function sampleMeters(out, st, half) {
    Object.keys(st.meters).forEach(function (k) {
      var m = out.meters[k][half];
      if (!m) return;
      m.min = Math.min(m.min, st.meters[k]);
      m.max = Math.max(m.max, st.meters[k]);
    });
  }
  function sampleThresholds(def, st, crossed) {
    Object.keys(def._meters).forEach(function (k) {
      def._meters[k].thresholds.forEach(function (t) {
        if (S.test({ st: st, def: def }, Object.assign({ meter: k }, t))) crossed[k + ' ' + JSON.stringify(t)] = 1;
      });
    });
  }

  /* The walk's findings, as lines a person can read. */
  function describe(def, r) {
    var pct = function (x) { return (100 * x / r.walks).toFixed(1) + '%'; };
    var lines = [r.walks + ' walks, ' + (r.steps / r.walks).toFixed(0) + ' steps each'];
    lines.push('\nEndings');
    Object.keys(r.endings).sort().forEach(function (e) { lines.push('  ' + e + ': ' + pct(r.endings[e])); });
    if (r.unreachedEndings.length) lines.push('  never reached: ' + r.unreachedEndings.join(', '));
    lines.push('\nOne-offs');
    (def.chapters || []).filter(function (c) { return c.oneOff; }).forEach(function (c) { lines.push('  ' + c.id + ': ' + pct(r.oneOffs[c.id] || 0)); });
    lines.push('\nFinales (with their arc played: ' + pct(r.finaleWithArc) + ')');
    Object.keys(r.finales).sort().forEach(function (f) { lines.push('  ' + f + ': ' + pct(r.finales[f])); });
    lines.push('\nMeters (range at the end of each half; what moved them most)');
    Object.keys(r.meters).forEach(function (k) {
      var m = r.meters[k];
      var top = Object.keys(m.moved).sort(function (a, b) { return m.moved[b] - m.moved[a]; }).slice(0, 3);
      lines.push('  ' + k + ': ' + [1, 2].map(function (h) { return 'half ' + h + ' ' + (m[h].min === Infinity ? '—' : m[h].min + '…' + m[h].max); }).join(', ') +
        (top.length ? '  ← ' + top.join(', ') : ''));
    });
    lines.push('\nThresholds crossed');
    Object.keys(def._meters).forEach(function (k) {
      def._meters[k].thresholds.forEach(function (t) {
        var key = k + ' ' + JSON.stringify(t);
        lines.push('  ' + key + ': ' + pct(r.thresholds[key] || 0));
      });
    });
    lines.push('\nFlags set');
    Object.keys(r.flags).sort().forEach(function (f) { lines.push('  ' + f + ': ' + pct(r.flags[f])); });
    if (r.unreached.length) lines.push('\nNever reached: ' + r.unreached.join(', '));
    if (Object.keys(r.noOptions).length) lines.push('\nEvents left with no option open: ' + Object.keys(r.noOptions).join(', '));
    if (r.stuck.length) lines.push('\nStuck at: ' + r.stuck.slice(0, 10).join(', '));
    return lines.join('\n');
  }

  root.PMCStoryCheck = { check: check, walk: walk, describe: describe };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryCheck;
})(typeof window !== 'undefined' ? window : global);
