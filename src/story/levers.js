/* PMC 2670 — Firefight : a story battle set up (docs/story-mode-plan.md, sections 4 and 5)

   story.js hands over what a battle should be (battleSpec: the node's own
   setting, the levers its event chose, the changes held for it). This turns
   that into the engine's cfg for the company that will fight it:

   - the Battle Tier and Priority Level, relative to what the company can
     field (`'max'`, `'max-1'`, a number), within the node's own bounds;
   - the enemy force, built from what the story wrote: its core (or the core
     for this Tier), a leader for the Tier, the optional units its meter calls
     up, the changes events and flags made, and a filler up to a share of the
     battle's composition points, with an allowance for how good the company is;
   - the allies, built the same way, at the end of side A's list;
   - Readiness, the prelude (strikes, Suppression), the role, the variant.

   Like story.js it runs in Node, and nothing here plays the battle. */
(function (root) {
  'use strict';
  var S = root.PMCStory || require('./story.js');
  function R() { return root.PMC; }
  function C() { return root.PMCCamp; }
  function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }

  /* ================= how big a battle ================= */

  /* The Priority Levels this company alone can field at a Tier: the story's
     enemy is written to fit, so there is no rival to ask (levelsFor's one-company
     form). */
  function levelsFor(co, tier) {
    return [1, 2, 3].filter(function (pl) { return C().canFieldArmy(co, tier, pl, true); });
  }
  /* The highest Tier the company can field at this Priority Level (maxBattleTier's). */
  function maxTier(co, pl) {
    return Math.max(1, Math.min(5, C().fieldableTier(co, pl || 1) || 1));
  }

  function tierFor(co, spec) {
    var max = maxTier(co, 1), t = spec.tier;
    if (t === 'max' || t == null) t = max;
    else if (t === 'max-1') t = max - 1;
    else if (typeof t === 'string' && /^max-\d$/.test(t)) t = max - +t.slice(4);
    t = Math.max(1, Math.min(max, +t || 1));
    if (spec.minTier) t = Math.max(t, spec.minTier);
    if (spec.maxTier) t = Math.min(t, spec.maxTier);
    return t;
  }
  function plFor(co, tier, pl) {
    if (pl === 'max') return Math.max.apply(null, [1].concat(levelsFor(co, tier)));
    return Math.max(1, Math.min(3, +pl || 1));
  }

  /* ================= the enemy force ================= */

  function budget(tier, pl) { return R().COMPOSITION[tier].points * pl; }
  function tierOf(key) { var p = R().profile(key); return p ? p.tier : 99; }

  /* A unit above the battle's Tier comes down to the best of its kind that fits:
     a Tier I battle against the Front is the Front at Tier I. */
  function fit(key, tier, faction) {
    var p = R().profile(key);
    if (!p || p.tier <= tier) return key;
    var same = R().listFor(faction || p.faction).filter(function (q) {
      return q.tier <= tier && (q.cls || 'infantry') === (p.cls || 'infantry') && !q.mustDrone && !/^r?(cmd|instigators|secondary|leaders|influential|rebellion)/.test(q.key);
    }).sort(function (a, b) { return b.tier - a.tier; });
    return same.length ? same[0].key : null;
  }

  /* How good the fielded company is, as a share of the battle's points: its
     honours and upgrades, and a little for its experience. Capped, so getting
     better always pays. The weights are the plan's first guess, to be tuned. */
  function allowance(co, units) {
    var pool = units || co.roster || [];
    var n = 0;
    pool.forEach(function (e) {
      n += 0.04 * ((e.honours || []).length + (e.upgrades || []).length) + 0.002 * (e.exp || 0);
    });
    return Math.min(0.25, n / Math.max(1, pool.length) * 2);
  }

  /* The force a battle node wrote, built for this battle. ctx: the story's
     campaign (for its meters and flags), the Tier, the PL, and the company's
     allowance. What comes back: each unit as a pick ({ key, name, rules,
     target }), the tactic, and the Readiness its changes added. */
  function buildForce(f, ctx) {
    if (!f) return { picks: [], tactics: null, readiness: 0 };
    var tier = ctx.tier, pl = ctx.pl, st = ctx.campaign.story, test = function (c) { return S.test(S.ctxOf(ctx.campaign), c); };
    var faction = f.faction || 'rebel';
    var picks = [], readiness = 0, tactics = f.tactics || null;
    function add(u) {
      var o = typeof u === 'string' ? { key: u } : Object.assign({}, u);
      var k = fit(o.key, tier, faction);
      if (!k) return;
      o.key = k;
      picks.push(o);
    }
    /* The core: its named units always, and its troops, or the troops written
       for the highest Tier at or below this one. */
    var named = arr(f.core).filter(function (u) { return typeof u !== 'string'; });
    var troops = arr(f.core).filter(function (u) { return typeof u === 'string'; });
    Object.keys(f.byTier || {}).map(Number).sort().forEach(function (t) { if (t <= tier) troops = arr(f.byTier[t]); });
    named.forEach(add);
    troops.forEach(add);
    // the optional units the meter calls up, in order
    var extra = f.optional ? arr(f.optional.units) : [];
    var nOpt = f.optional ? Math.floor(Math.max(0, st.meters[f.optional.meter] || 0) / (f.optional.per || 1)) : 0;
    // the changes events and flags made, and those held for this battle
    var changes = arr(f.changes);
    changes.forEach(function (c) {
      if (c.if && !test(c.if)) return;
      if (c.readiness) readiness += c.readiness;
      if (c.tactics) tactics = c.tactics;
    });
    // Readiness below nothing takes the optional units back, and the filler's share with them
    var rd = readiness + (ctx.readiness || 0);
    if (rd < 0) nOpt = Math.max(0, nOpt + rd);
    extra.slice(0, nOpt).forEach(add);
    changes.forEach(function (c) {
      if (c.if && !test(c.if)) return;
      if (c.add) arr(c.add).forEach(add);
      if (c.remove) {
        var gone = arr(c.remove);
        gone.forEach(function (k) {
          var i = picks.map(function (p) { return p.key; }).lastIndexOf(fit(k, tier, faction));
          if (i >= 0) picks.splice(i, 1);
        });
      }
      if (c.swap) picks.forEach(function (p) { if (p.key === c.swap[0]) p.key = fit(c.swap[1], tier, faction) || p.key; });
      if (c.honour) picks.forEach(function (p) {
        if (p.name === c.honour.unit) p.rules = (p.rules || []).concat(c.honour.rules || []);
      });
    });
    arr(f.swaps).forEach(function (s) {
      if (tier >= s.atTier) picks.forEach(function (p) { if (p.key === s.swap[0]) p.key = fit(s.swap[1], tier, faction) || p.key; });
    });
    // the leader for the Tier, unless the force names its own command
    if (f.leader !== false && ctx.leader !== false) {
      var lead = C().commandKey({ faction: faction }, tier);
      if (lead && !picks.some(function (p) { return C().isLeaderKey(p.key); })) picks.unshift({ key: lead });
    }
    // the filler: up to a share of the battle's points, the meter and the company's allowance on top
    if (f.fill) {
      var share = (f.fill.to || 1) + (f.fill.meter ? (st.meters[f.fill.meter] || 0) * (f.fill.step || 0) : 0) + (ctx.allowance || 0) +
        (rd < 0 ? rd * 0.1 : 0);
      var want = budget(tier, pl) * share, have = picks.reduce(function (s, p) { return s + tierOf(p.key); }, 0);
      var from = arr(f.fill.from).map(function (k) { return fit(k, tier, faction); }).filter(Boolean);
      for (var i = 0, guard = 0; from.length && have < want && guard < 60; guard++, i++) {
        var k = from[i % from.length], cost = tierOf(k);
        if (have + cost > want + 0.5) { if (cost <= 1) break; from = from.filter(function (x) { return tierOf(x) < cost; }); continue; }
        picks.push({ key: k });
        have += cost;
      }
    }
    /* Readiness, the default table: 1, barricades (in the cfg); 2, one unit more,
       on top of the filler; 3, a rebel force makes its Last Stand. */
    if (rd >= 2) {
      var more = extra[nOpt] || (f.fill && arr(f.fill.from)[0]);
      if (more) add(more);
    }
    if (rd >= 3 && faction === 'rebel') tactics = 'laststand';
    return { picks: picks, tactics: tactics, readiness: rd };
  }

  /* ================= the cfg ================= */

  var ROLE = { attacker: 'A', defender: 'B' };

  /* The engine's cfg for the battle the story is at. opts: the player's
     picks from the muster (dossier entries), the side they chose where the
     event left the role to them (`role: 'A'|'B'`), and the campaign's
     options. */
  function toCfg(campaign, opts) {
    opts = opts || {};
    var spec = S.battleSpec(campaign);
    if (!spec) throw new Error('The story is not at a battle');
    var def = S.get(campaign.story.id), co = campaign.companies.A, lv = spec.levers || {};
    var tier = opts.tier || tierFor(co, { tier: spec.tier, minTier: spec.minTier, maxTier: spec.maxTier });
    var pl = opts.pl || plFor(co, tier, lv.pl || spec.pl);
    var picksA = opts.picks || [];
    var fielded = picksA.length ? picksA : co.roster;
    // (the changes held for this battle are already in spec.enemy: battleSpec put them there)
    var enemy = buildForce(spec.enemy, { campaign: campaign, tier: tier, pl: pl, allowance: allowance(co, fielded), readiness: lv.readiness || 0 });
    var allies = lv.allies ? buildForce(lv.allies, { campaign: campaign, tier: tier, pl: pl, leader: false }) : null;
    var keysA = picksA.map(function (e) { return R().entryPick(e); });
    var allyFrom = allies && allies.picks.length ? keysA.length : null;
    if (allies) allies.picks.forEach(function (p) { keysA.push(p.key); });

    // the named units, their rules, and the target
    var units = { A: {}, B: {} }, variant = spec.variant || null;
    enemy.picks.forEach(function (p, i) {
      var x = {};
      if (p.name) x.name = p.name;
      if (p.rules) x.rules = p.rules;
      if (variant && variant.target && p.name === variant.target) x.target = true;
      if (Object.keys(x).length) units.B[i] = x;
    });
    if (allies) allies.picks.forEach(function (p, i) { if (p.name || p.rules) units.A[allyFrom + i] = { name: p.name, rules: p.rules }; });

    var side = def.sides && spec.enemy && def.sides[spec.enemy.side] || {};
    var role = lv.role || spec.role;
    var attacker = role === 'choose' ? opts.role || 'A' : ROLE[role] || null;
    var ambush = variant && variant.ambush ? (variant.ambush === 'player' ? 'A' : 'B') : null;
    var rd = enemy.readiness;
    return {
      tier: tier, pl: pl, scenario: spec.scenario,
      attacker: attacker,
      armyA: keysA, armyB: enemy.picks.map(function (p) { return p.key; }),
      nameA: co.name, nameB: side.name || 'The enemy',
      colourA: opts.colourA || null, colourB: opts.colourB || null,
      dossier: { A: picksA.concat(allies ? allies.picks.map(function () { return null; }) : []), B: null },
      doctrines: { A: (co.doctrines || []).slice(), B: [] },
      tactics: { A: null, B: (spec.enemy && spec.enemy.faction === 'rebel') ? (spec.tactics || enemy.tactics) : null },
      campaign: true, mode: 'ai',
      planet: lv.planet || spec.planet || 'random',
      world: lv.world || null,
      options: opts.options || campaign.options || {},
      story: {
        id: def.id, node: spec.node,
        variant: variant,
        strikes: lv.strikes || null,
        suppressOwn: lv.suppressOwn || null,
        ambush: ambush,
        readiness: rd,
        barricades: rd >= 1 ? { B: 2 * pl } : null,
        showEnemy: !!lv.showEnemy,
        edge: lv.edge || null,
        turns: lv.turns || (variant && variant.turns) || null,
        allyFrom: allyFrom,
        units: units
      }
    };
  }

  root.PMCStoryLevers = {
    levelsFor: levelsFor, maxTier: maxTier, tierFor: tierFor, plFor: plFor,
    buildForce: buildForce, allowance: allowance, fit: fit, toCfg: toCfg
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryLevers;
})(typeof window !== 'undefined' ? window : global);
