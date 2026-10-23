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
   - the enemy as the briefing tells it: word of them, an outline, or every
     unit, by what the company knows (story.js `intel`).

   Like story.js it runs in Node, and nothing here plays the battle. */
(function (root) {
  'use strict';
  var S = root.PMCStory || require('./story.js');
  function R() { return root.PMC; }
  function C() { return root.PMCCamp; }
  function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
  // a random from a seed: the same numbers every time (a battle's rolled filler, the same each time it is looked at)
  function seeded(seed) {
    var h = 2166136261 >>> 0, str = String(seed);
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    return function () {
      h = (h + 0x6D2B79F5) >>> 0;
      var t = Math.imul(h ^ (h >>> 15), h | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

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
  // (a pick can carry its drive or its riders: `lapc:wheeled`; its profile is the first part's)
  function baseKey(key) { return String(key).split(':')[0]; }
  function profileOf(key) { return R().profile(baseKey(key)); }
  function tierOf(key) { var p = profileOf(key); return p ? p.tier : 99; }

  /* A unit above the battle's Tier comes down to the best of its kind that fits:
     a Tier I battle against the Front is the Front at Tier I. */
  function fit(key, tier, faction) {
    var p = profileOf(key);
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
    // the unit groups a force goes without (the Hashamer: no craft, no teleport turrets)
    var without = arr(f.without);
    function allowed(k) { var p = profileOf(k); return !p || without.indexOf(p.group) < 0; }
    function add(u) {
      var o = typeof u === 'string' ? { key: u } : Object.assign({}, u);
      var k = fit(o.key, tier, faction);
      if (!k || !allowed(k)) return;
      o.key = k;
      if (f.skin) o.skin = f.skin;
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
      if (lead && !picks.some(function (p) { return C().isLeaderKey(baseKey(p.key)); })) picks.unshift(f.skin ? { key: lead, skin: f.skin } : { key: lead });
    }
    // the filler: up to a share of the battle's points, the meter and the company's allowance on top
    if (f.fill) {
      // the difficulty the story was begun at: more or less of a share, and more or less for the company's experience
      var D = S.difficultyOf ? S.difficultyOf(ctx.campaign) : {};
      var share = (f.fill.to || 1) + (f.fill.meter ? (st.meters[f.fill.meter] || 0) * (f.fill.step || 0) : 0) +
        (ctx.allowance || 0) * (D.allowance != null ? D.allowance : 1) + (D.fill || 0) +
        (rd < 0 ? rd * 0.1 : 0);
      var want = budget(tier, pl) * share, have = picks.reduce(function (s, p) { return s + tierOf(p.key); }, 0);
      /* What it fills with: its archetype's own kind of force (`fill.archetype`),
         rolled as a rival of that kind would field it at this Tier and PL, from
         the battle's own seed so the same force comes every time it is looked
         at; or the units the force wrote. */
      var from = [], rolled = false;
      if (f.fill.archetype && f.archetype && R().rollArmy) {
        var army = R().rollArmy(tier, pl, seeded((ctx.seed || '') + ':' + f.archetype), faction, f.archetype) || [];
        from = army.filter(function (k) { var p = profileOf(k); return p && !p.command && !p.alpha && !C().isLeaderKey(baseKey(k)) && allowed(k); });
        rolled = from.length > 0;
      }
      if (!rolled) from = arr(f.fill.from).map(function (k) { return fit(k, tier, faction); }).filter(function (k) { return k && allowed(k); });
      for (var i = 0, guard = 0; from.length && have < want && guard < 60; guard++, i++) {
        var k = from[i % from.length], cost = tierOf(k);
        if (have + cost > want + 0.5) { if (cost <= 1 && !rolled) break; from = from.filter(function (x) { return tierOf(x) < cost; }); continue; }
        picks.push(f.skin ? { key: k, skin: f.skin } : { key: k });
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

  /* ================= the enemy as the company knows them ================= */

  /* The enemy force told at the intel the company has (story.js `intel`):
     0, word of them: how big, and what kind; 1, an outline: roughly how many
     of each kind, and who is with them by name; 2, every unit. Returns
     { level, word, items }: a line, and a list (empty at 0). */
  // (`eshaven`: the Hashamer, a story's Xenotripods every one of them an Esh-Aven)
  var KINDS = {
    troops: { rebel: 'bands of fighters', bugs: 'broods', pmc: 'squads', xeno: 'squads of Xenotripods', eshaven: 'hosts of Esh-Aven',
      one: { rebel: 'band of fighters', bugs: 'brood', pmc: 'squad', xeno: 'squad of Xenotripods', eshaven: 'host of Esh-Aven' } },
    support: { rebel: 'heavy weapons', bugs: 'spitters and spore throwers', pmc: 'support teams', xeno: 'heavy weapons', eshaven: 'heavy weapons',
      one: { rebel: 'heavy weapon', bugs: 'spitter', pmc: 'support team', xeno: 'heavy weapon', eshaven: 'heavy weapon' } },
    vehicle: { rebel: 'vehicles', bugs: 'great beasts', pmc: 'vehicles', xeno: 'turrets', eshaven: 'turrets',
      one: { rebel: 'vehicle', bugs: 'great beast', pmc: 'vehicle', xeno: 'turret', eshaven: 'turret' } },
    air: { rebel: 'aircraft', bugs: 'fliers', pmc: 'aircraft', xeno: 'craft', eshaven: 'craft',
      one: { rebel: 'aircraft', bugs: 'flier', pmc: 'aircraft', xeno: 'craft', eshaven: 'craft' } }
  };
  var ORDER = ['troops', 'support', 'vehicle', 'air'];
  function kindOf(key) {
    var p = R().profile(key);
    if (!p) return 'troops';
    if (p.cls === 'aircraft' || /Flying/.test(p.group || '')) return 'air';
    if (p.cls === 'vehicle') return 'vehicle';
    if (p.range >= 30 || /support|artillery|Spore|mortar/i.test(p.group || '')) return 'support';
    return 'troops';
  }
  function about(n) { return n === 1 ? 'one' : n <= 3 ? 'two or three' : n <= 5 ? 'four or five' : 'half a dozen or more'; }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function describeForce(force, level, faction) {
    var picks = (force && force.picks) || [], fac = KINDS.troops[faction] ? faction : 'rebel';
    if (picks.some(function (p) { return p.skin === 'eshaven'; })) fac = 'eshaven';
    var lead = function (p) { return C() && C().isLeaderKey(p.key); };
    if (level >= 2) {
      return { level: 2, word: 'You know what they have, to the last squad.', items: picks.map(function (p) {
        var pr = R().profile(p.key);
        return { name: p.name || (pr ? pr.name : p.key), tier: pr ? pr.tier : null };
      }) };
    }
    var count = {};
    picks.forEach(function (p) { if (!lead(p) && !p.name) { var k = kindOf(p.key); count[k] = (count[k] || 0) + 1; } });
    var n = picks.length, swarm = fac === 'bugs';
    var size = n <= 3 ? 'a small' : n <= 6 ? 'a sizeable' : n <= 9 ? 'a large' : 'a very large';
    if (level < 1) {
      var bits = [size + (swarm ? ' swarm' : ' force')];
      bits.push(count.vehicle ? 'with ' + KINDS.vehicle[fac] : swarm ? 'all legs and jaws' : fac === 'eshaven' ? 'Esh-Aven, every one of them' : 'mostly on foot');
      if (count.support) bits.push(KINDS.support[fac] + ' among them');
      if (count.air) bits.push('something in the air');
      return { level: 0, word: 'Word is: ' + bits.join(', ') + '. Nothing more.', items: [] };
    }
    var items = [];
    picks.forEach(function (p) { if (p.name) items.push({ name: p.name + ' is with them.' }); });
    if (picks.some(function (p) { return lead(p) && !p.name; })) items.push({ name: swarm ? 'Something leads them.' : fac === 'xeno' ? 'An Alpha leads them.' : fac === 'eshaven' ? 'One of them wears an Alpha\u2019s crest.' : 'A commander leads them.' });
    ORDER.forEach(function (k) {
      if (count[k]) items.push({ name: cap(about(count[k])) + ' ' + (count[k] === 1 ? KINDS[k].one[fac] : KINDS[k][fac]) + '.' });
    });
    return { level: 1, word: 'You have their outline: ' + size + (swarm ? ' swarm' : ' force') + '.', items: items };
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
    var seed = spec.node + ':' + campaign.story.chapterNo;
    var enemy = buildForce(spec.enemy, { campaign: campaign, tier: tier, pl: pl, allowance: allowance(co, fielded), readiness: lv.readiness || 0, seed: seed + ':B' });
    var allies = lv.allies ? buildForce(lv.allies, { campaign: campaign, tier: tier, pl: pl, leader: false, seed: seed + ':A' }) : null;
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
      if (p.skin) x.skin = p.skin;
      if (Object.keys(x).length) units.B[i] = x;
    });
    if (allies) {
      /* Named allies (a story's reskinned force, the Hashamer): the living on
         the story's roll come back by name, as many to a unit as it has men. */
      var roll = campaign.story.roll && lv.allies.skin ? campaign.story.roll[lv.allies.skin] : null, names = roll ? roll.living.slice() : [];
      allies.picks.forEach(function (p, i) {
        var x = {};
        if (p.name) x.name = p.name;
        if (p.rules) x.rules = p.rules;
        if (p.skin) {
          x.skin = p.skin;
          var pr = profileOf(p.key);
          if (names.length && pr && pr.cls !== 'vehicle' && pr.cls !== 'aircraft') x.men = names.splice(0, pr.size || 1);
        }
        if (Object.keys(x).length) units.A[allyFrom + i] = x;
      });
    }

    var side = def.sides && spec.enemy && def.sides[spec.enemy.side] || {};
    /* The mission's own ground (deep-contract-maps.js): its pieces and objectives,
       stretched east to west onto a bigger table. A compound mission has none:
       its compound comes from its seed. */
    var maps = (root.PMCStoryMaps && root.PMCStoryMaps[def.id]) || {}, map = spec.map ? maps[spec.map] : null;
    var compound = root.PMCScen && root.PMCScen.SCENARIOS[spec.scenario] && root.PMCScen.SCENARIOS[spec.scenario].compound;
    var board = R().boardFor(pl), sx = board.w / 48, sy = board.h / 48;
    /* The edge the player chose to come in from (`edge: 'choose'`, on the muster):
       from the east, the map is laid the other way about, so side A's own edge is
       the one it chose. A compound has no edges to choose. */
    var east = !!map && !compound && (lv.edge === 'east' || (lv.edge === 'choose' && opts.edge === 'east'));
    var fitPiece = function (p) {
      var q = JSON.parse(JSON.stringify(p));
      if (east) q.x = 48 - q.x - q.w;
      q.x *= sx; q.w *= sx; q.y *= sy; q.h *= sy; return q;
    };
    var terrainPlan = map && !compound ? map.pieces.map(fitPiece) : null;
    var mapObjectives = map && !compound && map.objectives ? map.objectives.map(function (o) { return { x: (east ? 48 - o.x : o.x) * sx, y: o.y * sy, name: o.name }; }) : null;
    // the map's own possible locations, for Find and secure: where, and what they are
    var mapSites = map && !compound && map.sites ? { kind: map.sites.kind || 'searchsite',
      at: map.sites.at.map(function (o) { return { x: (east ? 48 - o.x : o.x) * sx, y: o.y * sy, name: o.name }; }) } : null;
    var role = lv.role || spec.role;
    var attacker = role === 'choose' ? opts.role || 'A' : ROLE[role] || null;
    var ambush = variant && variant.ambush ? (variant.ambush === 'player' ? 'A' : 'B') : null;
    var rd = enemy.readiness;
    /* Where it is fought (the story's `place`): its kind of world, and the
       world's conditions, Other Worlds switched on for this battle whatever
       the campaign's options say. */
    var place = spec.place || null, options = Object.assign({}, opts.options || campaign.options || {});
    if (place && place.world) options.otherWorlds = true;
    // the enemy's doctrines: its archetype's, one for each Battle Tier
    var arch = spec.enemy && spec.enemy.archetype && C().archetype ? C().archetype(spec.enemy.archetype) : null;
    var docsB = arch ? arch.doctrines.slice(0, tier) : [];
    return {
      tier: tier, pl: pl, scenario: spec.scenario,
      attacker: attacker,
      armyA: keysA, armyB: enemy.picks.map(function (p) { return p.key; }),
      nameA: co.name, nameB: side.name || 'The enemy',
      colourA: opts.colourA || null, colourB: opts.colourB || null,
      dossier: { A: picksA.concat(allies ? allies.picks.map(function () { return null; }) : []), B: null },
      doctrines: { A: (co.doctrines || []).slice(), B: docsB },
      tactics: { A: null, B: (spec.enemy && spec.enemy.faction === 'rebel') ? (spec.tactics || enemy.tactics) : null },
      campaign: true, mode: 'ai',
      planet: lv.planet || (terrainPlan && map.planet) || (place && place.kind) || spec.planet || 'random',
      terrainPlan: terrainPlan,
      world: lv.world || (place && place.world ? R().cleanWorld(place.world) : null),
      options: options,
      story: {
        id: def.id, node: spec.node,
        // the mission: its name over the book's scenario, its ground, and the seed that lays it the same each time
        name: spec.name || null, blurb: spec.text ? S.render(campaign, spec.text) : null,
        mapName: map ? map.name : null, objectives: mapObjectives, sites: mapSites,
        // the map's look for its pieces: 'market' (a settlement: barricades are stalls, craters market clutter)
        skin: map && !compound && map.skin || null,
        place: place ? { system: place.system || null, planet: place.planet || null, site: place.site || null } : null,
        seed: spec.node + ':' + spec.scenario + (east ? ':east' : ''),
        variant: variant,
        strikes: lv.strikes || null,
        suppressOwn: lv.suppressOwn || null,
        ambush: ambush,
        readiness: rd,
        barricades: rd >= 1 ? { B: 2 * pl } : null,
        intel: S.intel(campaign, spec),
        // what is said in it, and when (storybattle.js storyTalk)
        talk: S.talkFor(campaign, spec),
        // a parley's conversation, with what has happened in the story written into it
        parley: spec.scenario === 'parley' ? S.parleyFor(campaign, spec) : null,
        allyVoice: S.allyVoice(campaign, spec),
        edge: east ? 'east' : lv.edge === 'choose' ? 'west' : null,
        turns: lv.turns || (variant && variant.turns) || null,
        // the story scenarios' waves: so many a turn, by a meter (a battle's `waves`: base + 1 for each `per` points)
        waves: spec.waves ? { per: (spec.waves.base || 1) + Math.floor(Math.max(0, campaign.story.meters[spec.waves.meter] || 0) / (spec.waves.per || 3)) } : null,
        allyFrom: allyFrom,
        /* A hired company beside the company (Dead Reckoning's hired guns): its
           Trust, which decides whether it takes orders unpaid and whether it
           walks off the table (storybattle.js hired). */
        hired: lv.allies && campaign.story.meters[lv.allies.side + '_trust'] != null ? {
          side: lv.allies.side, name: ((def.sides || {})[lv.allies.side] || {}).name || lv.allies.side,
          trust: campaign.story.meters[lv.allies.side + '_trust']
        } : null,
        units: units
      }
    };
  }

  root.PMCStoryLevers = {
    levelsFor: levelsFor, maxTier: maxTier, tierFor: tierFor, plFor: plFor,
    buildForce: buildForce, describeForce: describeForce, kindOf: kindOf, allowance: allowance, fit: fit, toCfg: toCfg
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryLevers;
})(typeof window !== 'undefined' ? window : global);
