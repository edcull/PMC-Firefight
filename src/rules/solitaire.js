/* PMC 2670 — Firefight
   Solitaire and cooperative games (rulebook pp. 146-156).

   A separate way to play: one or two players' commandos against an OpFor that
   is run by the behaviour table in a phase of its own, after the players have
   acted. This file holds what is different about it:

   - the "commando" composition the players build from (p. 147) and the OpFor
     composition the enemy pool is rolled from (p. 148);
   - the six solitaire scenarios (pp. 150-156), written in the same shape as the
     competitive ones in scenarios.js, plus the extra questions only a solitaire
     game asks — which counters are revealed, where the OpFor comes on, how a
     unit's behaviour roll is modified, who it must shoot at.

   The turn loop in game.js asks `state.scen` these questions; everything a
   scenario needs to remember lives on `state.sc`, as it does for the others.

   Interpretations, where the book leaves the table-top player to decide:
   - A player's commando does not take Command Units or Rapid insertion
     platforms: the Command Unit and Battlefield Insertion rules are not used in
     solitaire games (p. 149), so neither does anything here.
   - Counters are placed by the game on an even lattice rather than by hand.
   - "Moved D6" towards/away from the enemy" in Ambush! is towards or away from
     the road the enemy column is on.
*/
(function (root) {
  'use strict';
  var R = root.PMC, SC = root.PMCScen;
  var W = R.BOARD.w, H = R.BOARD.h, UR = R.UNIT_R;
  function d6() { return R.d6(); }
  function d3() { return R.d3(); }
  function dist(a, b, c, d) { return R.inches(a, b, c, d); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------------------------------------------------------------- lists */

  /* Priority Level 1 composition — commando (p. 147). The second points value is
     for a Rebel force, which cannot use its Tactics here and gets the points
     instead. Limits are per Priority Level, as in the standard table. */
  var COMMANDO = {
    1: { points: [4, 5], limits: [[0, 4], [0, 2], [0, 1], [0, 0], [0, 0]] },
    2: { points: [8, 10], limits: [[0, 1], [1, 99], [0, 2], [0, 1], [0, 0]] },
    3: { points: [12, 15], limits: [[0, 0], [0, 1], [1, 99], [0, 2], [0, 1]] },
    4: { points: [16, 20], limits: [[0, 0], [0, 0], [0, 1], [1, 99], [0, 2]] },
    5: { points: [20, 24], limits: [[0, 0], [0, 0], [0, 0], [0, 1], [1, 4]] }
  };
  // Priority Level 1 composition — OpFor (p. 148)
  var OPFOR = {
    1: { points: 6, limits: [[0, 6], [0, 2], [0, 2], [0, 0], [0, 0]] },
    2: { points: 12, limits: [[1, 6], [1, 99], [1, 99], [0, 1], [0, 0]] },
    3: { points: 18, limits: [[0, 0], [0, 6], [1, 99], [0, 4], [0, 2]] },
    4: { points: 24, limits: [[0, 0], [0, 0], [0, 6], [1, 99], [0, 4]] },
    5: { points: 30, limits: [[0, 0], [0, 0], [1, 6], [1, 6], [1, 99]] }
  };

  // what may go into a commando or an OpFor pool at all
  function usable(p) { return p && !p.command && !p.mustLoad && !p.noSlot; }
  function catalogue(faction) { return R.listFor(faction).filter(usable); }

  function limitsAt(table, bt, pl) {
    return table[bt].limits.map(function (l) { return [l[0] * pl, l[1] === 99 ? 99 : l[1] * pl]; });
  }

  /* Is this a legal commando? The same shape of answer as R.checkArmy, so the
     muster screen can show it the same way. */
  function checkCommando(picks, bt, pl, faction) {
    pl = pl || 1;
    var keys = (picks || []).map(function (e) { return R.splitPick(e).key; });
    var rebel = faction === 'rebel';
    var budget = COMMANDO[bt].points[rebel ? 1 : 0] * pl;
    var lim = limitsAt(COMMANDO, bt, pl);
    var faults = [], counts = [0, 0, 0, 0, 0, 0], spent = 0, perKey = {}, perGroup = {};
    var machines = 0, factions = {};
    keys.forEach(function (k) {
      var p = R.profile(k);
      if (!p) return;
      spent += p.tier; counts[p.tier]++;
      perKey[k] = (perKey[k] || 0) + 1;
      perGroup[p.group] = (perGroup[p.group] || 0) + 1;
      factions[p.faction || 'pmc'] = 1;
      if (!usable(p)) faults.push(p.name + ' has no place in a commando — the Command Unit and Battlefield Insertion rules are not used here.');
      if (p.cls !== 'infantry') {
        machines++;
        if (p.tier > bt) faults.push('No vehicle or aircraft above the Battle Tier in a commando.');
        if (p.cls === 'aircraft' && bt < 2) faults.push('Aircraft only from Battle Tier II.');
      }
    });
    if (Object.keys(factions).length > 1) faults.push('A commando is drawn from one army list.');
    if (spent > budget) faults.push('Over budget: ' + spent + ' of ' + budget + ' composition points.');
    for (var t = 1; t <= 5; t++) {
      if (counts[t] < lim[t - 1][0]) faults.push('Needs at least ' + lim[t - 1][0] + ' Tier ' + R.ROMAN[t] + ' units (has ' + counts[t] + ').');
      if (counts[t] > lim[t - 1][1]) faults.push('At most ' + lim[t - 1][1] + ' Tier ' + R.ROMAN[t] + ' units (has ' + counts[t] + ').');
    }
    if (machines > pl) faults.push('No more than ' + pl + ' vehicle' + (pl > 1 ? 's' : '') + ' or aircraft — one per Priority Level.');
    Object.keys(perKey).forEach(function (k) {
      var p = R.profile(k);
      if (p.cap && perKey[k] > p.cap) faults.push('Max ' + p.cap + ' × ' + p.name + '.');
      if (p.capPL && perKey[k] > p.capPL * pl) faults.push('Max ' + (p.capPL * pl) + ' × ' + p.name + '.');
      if (p.groupCap && perGroup[p.group] > p.groupCap && faults.indexOf('Max ' + p.groupCap + ' ' + p.group + ' units.') < 0) {
        faults.push('Max ' + p.groupCap + ' ' + p.group + ' units.');
      }
    });
    // dedupe: several machines over the Tier say the same thing once
    faults = faults.filter(function (f, i) { return faults.indexOf(f) === i; });
    if (!keys.length) faults.push('No units chosen.');
    return { ok: !faults.length, spent: spent, budget: budget, counts: counts, faults: faults, limits: lim };
  }

  // a ground vehicle gets running gear to suit it
  function driveFor(p) {
    if (p.cls !== 'vehicle') return null;
    if (R.defaultDrive) return R.defaultDrive(p);
    var props = R.propsFor(p);
    if (!props.length) return null;
    var tank = /tank|destroyer|hunter|combat vehicle|ifv|engineering|support/i.test(p.name);
    var pool = tank ? ['tracked', 'tracked', 'wheeled', 'grav', 'walker'] : ['wheeled', 'wheeled', 'tracked', 'hover', 'grav'];
    var pick = pool[rnd(pool.length)];
    return props.indexOf(pick) >= 0 ? pick : props[0];
  }

  /* Roll a list against a table: the minimums first, then whatever fits, at
     random, until nothing more does. `machineCap` and `overTier` carry the
     rules that differ between a commando and an OpFor pool. */
  function rollFrom(table, bt, pl, faction, opts) {
    opts = opts || {};
    var pool = catalogue(faction);
    var budget = (Array.isArray(table[bt].points) ? table[bt].points[faction === 'rebel' ? 1 : 0] : table[bt].points) * pl;
    var lim = limitsAt(table, bt, pl);
    var keys = [], counts = [0, 0, 0, 0, 0, 0], spent = 0, machines = 0, perKey = {}, perGroup = {}, aircraft = 0;
    function room(p) {
      if (spent + p.tier > budget) return false;
      if (counts[p.tier] + 1 > lim[p.tier - 1][1]) return false;
      if (p.cap && (perKey[p.key] || 0) + 1 > p.cap) return false;
      if (p.capPL && (perKey[p.key] || 0) + 1 > p.capPL * pl) return false;
      if (p.groupCap && (perGroup[p.group] || 0) + 1 > p.groupCap) return false;
      // a swarm follows one Leader Bug (p. 114)
      if (p.leaderBug && keys.some(function (k) { var q = R.profile(R.splitPick(k).key); return q && q.leaderBug; })) return false;
      if (p.cls !== 'infantry') {
        if (machines + 1 > opts.machineCap) return false;
        if (opts.overTier === false && p.tier > bt) return false;
        if (opts.overTier === 'pl1' && pl === 1 && p.tier > bt) return false;
        if (p.cls === 'aircraft' && (bt < 2 || aircraft + 1 > pl)) return false;
      }
      return true;
    }
    function take(p) {
      var drive = driveFor(p);
      keys.push(drive ? R.joinPick(p.key, drive) : p.key);
      spent += p.tier; counts[p.tier]++;
      perKey[p.key] = (perKey[p.key] || 0) + 1;
      perGroup[p.group] = (perGroup[p.group] || 0) + 1;
      if (p.cls !== 'infantry') machines++;
      if (p.cls === 'aircraft') aircraft++;
    }
    // infantry is the body of a force; machines are a seasoning
    function weight(p) { return p.cls === 'infantry' ? 3 : 1; }
    function pickFrom(list) {
      var tot = 0; list.forEach(function (p) { tot += weight(p); });
      var r = Math.random() * tot;
      for (var i = 0; i < list.length; i++) { r -= weight(list[i]); if (r <= 0) return list[i]; }
      return list[list.length - 1];
    }
    /* A swarm without a Leader Bug has nothing to hold its Aggressive bugs back
       or bring its dead back up: an OpFor swarm takes one first, of the Battle
       Tier where it can. */
    if (faction === 'bugs' && opts.leader) {
      var lead = pool.filter(function (p) { return p.leaderBug && p.tier === bt && room(p); });
      if (!lead.length) lead = pool.filter(function (p) { return p.leaderBug && p.tier <= bt && room(p); });
      if (lead.length) take(lead[lead.length - 1]);
    }
    for (var t = 1; t <= 5; t++) {
      for (var n = 0; n < lim[t - 1][0]; n++) {
        var need = pool.filter(function (p) { return p.tier === t && room(p); });
        if (!need.length) break;
        take(pickFrom(need));
      }
    }
    for (var guard = 0; guard < 200; guard++) {
      var fit = pool.filter(room);
      if (!fit.length) break;
      take(pickFrom(fit));
    }
    return keys;
  }

  function rollCommando(bt, pl, faction) {
    for (var i = 0; i < 40; i++) {
      var k = rollFrom(COMMANDO, bt, pl, faction, { machineCap: pl, overTier: false });
      if (checkCommando(k, bt, pl, faction).ok) return k;
    }
    return rollFrom(COMMANDO, bt, pl, faction, { machineCap: pl, overTier: false });
  }

  function answersMachines(keys, bt) {
    return keys.some(function (k) {
      var p = R.profile(R.splitPick(k).key);
      if (!p) return false;
      if ((p.rules || []).some(function (r) { return /^Anti-tank|^Anti-aircraft/.test(r); })) return true;
      return p.cls !== 'infantry' && p.tier >= bt;
    });
  }
  /* The OpFor pool (p. 148): the OpFor table, three machines a Priority Level,
     and — when the players bring hulls or aircraft — at least one unit that
     can answer them. */
  function rollOpFor(bt, pl, faction, playersHaveMachines) {
    var best = null;
    for (var i = 0; i < 60; i++) {
      var k = rollFrom(OPFOR, bt, pl, faction, { machineCap: 3 * pl, overTier: 'pl1', leader: true });
      if (!playersHaveMachines || answersMachines(k, bt)) return k;
      best = k;
    }
    return best || [];
  }

  /* ---------------------------------------------------------- scenario kit */

  // how far a point is from the nearest edge of a terrain rectangle (0 inside it)
  function rectGap(t, x, y) {
    var dx = Math.max(t.x - x, 0, x - (t.x + t.w)), dy = Math.max(t.y - y, 0, y - (t.y + t.h));
    return Math.hypot(dx, dy);
  }
  function mine(state, side) { return state.units.filter(function (u) { return u.side === side; }); }
  function onTable(u) { return u.alive && u.x >= 0 && !u.aboard; }
  function players(state) { return state.units.filter(function (u) { return u.side === 'A' && onTable(u); }); }
  function passable(state, x, y) {
    if (x < UR || y < UR || x > W - UR || y > H - UR) return false;
    return !R.TERRAIN[R.terrainAt(state, x, y)].impassable;
  }
  function open(state, x, y) { return passable(state, x, y) && R.terrainAt(state, x, y) === 'open'; }

  function rollEnd(state, after) {
    if (state.turn < after) return false;
    var need = Math.max(2, 6 - (state.turn - after));
    var roll = d6();
    state.sc.lastEndRoll = { roll: roll, need: need };
    return roll >= need;
  }

  // put a barricade section down somewhere sensible
  function barricade(state, x, y, horiz) {
    var len = 3 + rnd(4);
    state.terrain.push({
      kind: 'barricade',
      x: clamp(horiz ? x - len / 2 : x - 0.5, 1, W - (horiz ? len : 1) - 1),
      y: clamp(horiz ? y - 0.5 : y - len / 2, 1, H - (horiz ? 1 : len) - 1),
      w: horiz ? len : 1, h: horiz ? 1 : len
    });
  }
  function scatterBarricades(state, n) {
    for (var i = 0; i < n; i++) barricade(state, 6 + Math.random() * (W - 12), 6 + Math.random() * (H - 12), Math.random() < 0.5);
  }

  /* Every OpFor unit starts in the pool; a counter on the table stands for one
     of them until it is revealed (pp. 150, 152, 155). */
  function toPool(state) {
    mine(state, 'B').forEach(function (u) {
      if (u.soloFixed) return;                   // placed by the scenario itself
      u.reserve = true; u.wave = 'pool'; u.x = -1; u.y = -1;
    });
  }
  function pool(state) {
    return state.units.filter(function (u) { return u.side === 'B' && u.alive && u.reserve && u.wave === 'pool'; });
  }
  /* Counters as evenly as the table allows, `apart` inches from each other,
     each one passing `want` if one is given. */
  function placeCounters(state, n, apart, want) {
    var out = [];
    for (var guard = 0; guard < 6000 && out.length < n; guard++) {
      var loose = guard > 4000;                 // give up on `want` before giving up on the count
      var p = { x: 3 + Math.random() * (W - 6), y: 3 + Math.random() * (H - 6) };
      if (!passable(state, p.x, p.y)) continue;
      if (want && !loose && !want(p, out)) continue;
      if (!out.every(function (q) { return dist(p.x, p.y, q.x, q.y) >= apart; })) continue;
      out.push(p);
    }
    /* "as evenly as possible": relax towards an even spread — each counter
       stepped away from its nearest neighbour a few times over */
    for (var it = 0; it < 30; it++) {
      out.forEach(function (p) {
        var near = null, nd = Infinity;
        out.forEach(function (q) { if (q !== p) { var d = dist(p.x, p.y, q.x, q.y); if (d < nd) { nd = d; near = q; } } });
        if (!near || nd > 16) return;
        var nx = p.x + (p.x - near.x) / (nd || 1) * 0.8, ny = p.y + (p.y - near.y) / (nd || 1) * 0.8;
        nx = clamp(nx, 4, W - 4); ny = clamp(ny, 4, H - 4);
        if (passable(state, nx, ny) && (!want || want({ x: nx, y: ny }, out))) { p.x = nx; p.y = ny; }
      });
    }
    return out.map(function (p, i) { return { x: p.x, y: p.y, id: 'C' + (i + 1) }; });
  }
  // a free spot within `r` of a point
  function spotNear(state, x, y, r, u, avoid) {
    for (var t = 0; t < 300; t++) {
      var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      var q = { x: clamp(x + Math.cos(a) * d, UR, W - UR), y: clamp(y + Math.sin(a) * d, UR, H - UR) };
      if (!passable(state, q.x, q.y)) continue;
      if (R.unitNear(state, q.x, q.y, u, 1)) continue;
      if (avoid && avoid(q)) continue;
      return q;
    }
    return null;
  }

  /* Reveal a counter: a random unit from the pool is placed within 2" of it
     and the counter is removed. */
  function reveal(state, c, why, out) {
    var pl = pool(state);
    var i = state.sc.counters.indexOf(c);
    if (i >= 0) state.sc.counters.splice(i, 1);
    if (!pl.length) { out.push({ text: 'Counter ' + c.id + ' is revealed — a false alarm, nothing is left in the pool.' }); return null; }
    var u = pl[rnd(pl.length)];
    var q = spotNear(state, c.x, c.y, 2, u) || spotNear(state, c.x, c.y, 5, u);
    if (!q) return null;
    u.x = q.x; u.y = q.y; u.reserve = false; u.wave = 0;
    // it faces whoever found it
    var ps = players(state), near = null, nd = Infinity;
    ps.forEach(function (p) { var d = dist(p.x, p.y, u.x, u.y); if (d < nd) { nd = d; near = p; } });
    if (near) { u.facing = Math.atan2(near.y - u.y, near.x - u.x); u.faceL = near.x < u.x; }
    out.push({ text: 'Counter ' + c.id + ' ' + why + ': it is ' + u.name + '.', unit: u, revealed: true });
    return u;
  }
  function seen(state, c, range) {
    return players(state).some(function (p) {
      if (dist(p.x, p.y, c.x, c.y) - UR > range) return false;
      return R.hasLoS(state, p, { x: c.x, y: c.y, alive: true });
    });
  }
  function closestCounters(state, n) {
    var ps = players(state);
    if (!ps.length) return [];
    return state.sc.counters.slice().sort(function (a, b) {
      function dd(c) { return Math.min.apply(null, ps.map(function (p) { return dist(p.x, p.y, c.x, c.y); })); }
      return dd(a) - dd(b);
    }).slice(0, n);
  }

  /* ---- landing zones (Crushing the Resistance, Sabotage) ----
     An 8" circle in open ground, no closer than 12" to any table edge — so its
     centre is at least 16" in — and in a cooperative game 18" from any other. */
  function lzLegal(state, p, owner) {
    if (p.x < 16 || p.y < 16 || p.x > W - 16 || p.y > H - 16) return false;
    if (!open(state, p.x, p.y)) return false;
    for (var k = 0; k < 8; k++) {
      var a = k / 8 * Math.PI * 2;
      if (!passable(state, p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3)) return false;
    }
    var lz = state.sc.lz || {};
    for (var o in lz) if (String(o) !== String(owner) && dist(lz[o].x, lz[o].y, p.x, p.y) < 18) return false;
    return true;
  }
  function lzSpots(state, owner) {
    var out = [];
    for (var x = 16; x <= W - 16; x += 1) for (var y = 16; y <= H - 16; y += 1) {
      if (lzLegal(state, { x: x, y: y }, owner)) out.push({ x: x, y: y });
    }
    /* In a cooperative game the first zone must leave the other player
       somewhere legal to land, 18" away — so only spots that do are offered. */
    var own = owners(state), lz = state.sc.lz || {};
    var waiting = own.filter(function (o) { return String(o) !== String(owner) && !lz[o]; });
    if (waiting.length) {
      var paired = out.filter(function (p) {
        return out.some(function (q) { return dist(p.x, p.y, q.x, q.y) >= 18; });
      });
      if (paired.length) out = paired;
    }
    return out;
  }
  function autoLZ(state, owner) {
    var s = lzSpots(state, owner);
    if (!s.length) {                        // a crowded table: relax the open-ground test
      for (var x = 16; x <= W - 16; x += 2) for (var y = 16; y <= H - 16; y += 2) {
        if (passable(state, x, y)) s.push({ x: x, y: y });
      }
    }
    return s.length ? s[rnd(s.length)] : { x: W / 2, y: H / 2 };
  }

  // the corners, clockwise from the near one
  var CORNERS = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];

  function owners(state) { return (state.solo && state.solo.owners) || [1]; }

  /* Broken player units in the Evacuation flee towards the safe zone; in the
     other scenarios they fall back away from the nearest enemy. */
  function awayFromEnemy(state, u) {
    var near = null, nd = Infinity;
    state.units.forEach(function (e) {
      if (!onTable(e) || e.side === u.side) return;
      var d = dist(e.x, e.y, u.x, u.y);
      if (d < nd) { nd = d; near = e; }
    });
    if (!near) return null;
    return { x: u.x + (u.x - near.x) * 3, y: u.y + (u.y - near.y) * 3 };
  }

  // the parts every solitaire scenario shares
  function base(o) {
    var s = {
      solo: true, noInsertion: true, turns: 0,
      roles: null,
      objectives: function () { return []; },
      zoneFor: function (state, side) { return null; },
      deployOK: function (state, side) { return side === 'A' ? null : false; },
      reserves: function (state, side) {
        if (side === 'A') {
          return state.turn === 1 ? state.units.filter(function (u) { return u.side === 'A' && u.alive && u.reserve && u.wave === 1; }) : [];
        }
        return [];
      },
      behaviour: function () { return { mod: 0, why: '' }; },
      fallTo: function (state, u) { return u.side === 'A' ? awayFromEnemy(state, u) : null; },
      hint: ''
    };
    for (var k in o) s[k] = o[k];
    return s;
  }

  /* ---- the landing, shared by Crushing the Resistance and Sabotage ---- */
  var landing = {
    needLZ: true,
    arrivalPoint: function (state, u) {
      var z = state.sc.lz && state.sc.lz[u.owner || 1];
      if (!z) return null;
      var q = spotNear(state, z.x, z.y, 4 - UR * 0.5, u);
      return q ? { x: q.x, y: q.y, why: 'in its landing zone' } : null;
    },
    arrivalLegal: function (state, u, p) {
      var z = state.sc.lz && state.sc.lz[u.owner || 1];
      return !!z && dist(p.x, p.y, z.x, z.y) <= 4 && passable(state, p.x, p.y);
    },
    arriveHow: function () { return 'drop'; },
    autoArrive: true,
    // "Each unit (except vehicles) suffers D3 Suppression Points" (pp. 150, 155)
    onArrive: function (state, u) {
      if (u.side !== 'A' || R.isMachine(u)) return null;
      var n = d3();
      R.addSP(u, n);
      return { text: u.label + ' takes ' + n + ' SP touching down (D3).', sp: n };
    }
  };
  function extend(o, extra) { for (var k in extra) o[k] = extra[k]; return o; }

  /* ---------------------------------------------------------- the scenarios */
  var SOLO = {};

  /* ---- Crushing the Resistance (p. 150) ---- */
  SOLO.s_crush = base(extend({
    id: 's_crush', deployText: function () { return "Nothing deploys: your commando drops into the landing zone you nominate, in the first Reserve phase."; }, name: 'Crushing the Resistance', page: 150,
    blurb: 'Your commando drops into hostile ground with a simple task: eliminate all enemy resistance.',
    win: 'Rout the OpFor without being routed yourself.',
    hint: 'The OpFor starts hidden as counters. Any counter within 18" of your units and in their sight is revealed each Beginning phase, and the one closest to you is revealed anyway.',
    setupTerrain: function (state) {
      var n = 0, pl = state.cfg.pl || 1;
      for (var i = 0; i < pl; i++) n += d6();
      scatterBarricades(state, n);
      state.sc.barricadeRoll = n;
    },
    deploy: function (state) {
      toPool(state);
      state.sc.counters = placeCounters(state, pool(state).length, 6);
      mine(state, 'A').forEach(function (u) { u.reserve = true; u.wave = 1; u.x = -1; u.y = -1; });
      state.sc.lz = {};
    },
    beginning: function (state) {
      var out = [];
      state.sc.counters.slice().forEach(function (c) {
        if (seen(state, c, 18)) reveal(state, c, 'is spotted', out);
      });
      closestCounters(state, 1).forEach(function (c) { reveal(state, c, 'gives itself away', out); });
      return out;
    },
    check: function (state) {
      if (SC.routed(state, 'A')) return { winner: 'B', text: 'The commando is routed — the resistance holds.' };
      if (SC.routed(state, 'B')) return { winner: 'A', text: 'The OpFor is routed — resistance crushed.' };
      return null;
    }
  }, landing));

  /* ---- Protecting the VIP (p. 151) ---- */
  SOLO.s_vip = base({
    id: 's_vip', deployText: function () { return "Place the VIP within 6\" of the evacuation point, and everyone else within 12\" of it — the shaded circle."; }, name: 'Protecting the VIP', page: 151,
    blurb: 'Hold the evacuation point and keep the VIP alive until reinforcements arrive.',
    win: 'Keep the VIP unit alive to the end. From turn 12 the game ends on a 6, then 5+, 4+ and so on.',
    hint: 'The OpFor pours in from six entry points and goes for the VIP whenever it can. Destroyed OpFor units go back into the pool. Your shots are at +2 on the hit table against their fervour.',
    extraUnits: function (state) {
      // the VIP and bodyguards: a Command Unit's statline of the Battle Tier, and no special rules
      var bt = state.cfg.tier, faction = state.solo.faction || 'pmc';
      var cu = R.listFor(faction).filter(function (p) { return p.command && p.tier === bt; })[0] ||
        R.listFor('pmc').filter(function (p) { return p.command && p.tier === bt; })[0];
      var p = {};
      for (var k in cu) p[k] = cu[k];
      p.key = 'solovip'; p.code = 'VIP'; p.name = 'VIP and bodyguards'; p.rules = []; p.command = false;
      var own = owners(state);
      return [{ profile: p, side: 'A', owner: own[rnd(own.length)], vip: true }];
    },
    setupTerrain: function (state) {
      var c = { x: W / 2, y: H / 2 };
      state.sc.evac = c;
      state.terrain = state.terrain.filter(function (t) { return rectGap(t, c.x, c.y) > 4; });
      var n = d6() + 3;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2 + Math.random() * 0.5, r = 6 + Math.random() * 5;
        barricade(state, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, Math.abs(Math.cos(a)) < 0.6);
      }
      // six entry points about 18" from the centre, on a ring
      var start = Math.random() * Math.PI * 2;
      state.sc.entries = [];
      for (var e = 0; e < 6; e++) {
        var ang = start + e / 6 * Math.PI * 2;
        state.sc.entries.push({ x: clamp(c.x + Math.cos(ang) * 18, 3, W - 3), y: clamp(c.y + Math.sin(ang) * 18, 3, H - 3), id: 'E' + (e + 1) });
      }
    },
    deploy: function (state) {
      toPool(state);
      var c = state.sc.evac;
      state.sc.defCircle = { x: c.x, y: c.y, r: 12 };
      state.sc.defender = 'A';
    },
    zoneFor: function () { return null; },
    // the VIP within 6" of the evacuation point, everyone else within 12"
    deployOK: function (state, side, x, y, u) {
      if (side !== 'A') return false;
      var d = dist(x, y, state.sc.evac.x, state.sc.evac.y);
      return d <= (u && u.vip ? 6 : 12);
    },
    reserves: function (state, side) {
      if (side === 'A') return [];
      state.sc.usedEntries = {};
      var need = state.turn <= 2 ? 5 : state.turn <= 5 ? 4 : state.turn <= 8 ? 3 : 2;
      var coming = [];
      shuffle(pool(state)).forEach(function (u) {
        if (coming.length >= 6) return;         // one a turn from each of the six entry points
        if (d6() >= need) coming.push(u);
      });
      return coming;
    },
    arrivalPoint: function (state, u) { return fromEntry(state, u); },
    arriveHow: function (state, u) { return u.side === 'B' ? (u.entry || null) : null; },
    autoArrive: true,
    returnsToPool: true,
    behaviour: function () { return { mod: 3, why: 'aggressive +3' }; },
    beginning: function (state) {
      var out = [];
      state.units.forEach(function (u) {
        if (u.side === 'B' && onTable(u) && u.sp > 0) { u.sp = 0; }
      });
      out.push({ text: 'The OpFor is extremely determined: every unit on the table sheds its Suppression.' });
      return out;
    },
    hitMod: function (state, a, t) { return a.side === 'A' && t.side === 'B' ? 2 : 0; },
    mustTarget: function (state, u) {
      return state.units.filter(function (v) { return v.vip && v.alive; })[0] || null;
    },
    moveOK: function (state, u, c) {
      if (u.side !== 'A') return true;
      var e = state.sc.evac;
      return dist(c.x, c.y, e.x, e.y) <= (u.vip ? 6 : 12);
    },
    fallTo: function (state, u) {
      if (u.side !== 'A') return null;
      return { x: state.sc.evac.x, y: state.sc.evac.y, limit: u.vip ? 6 : 12 };
    },
    check: function (state) {
      var vip = state.units.filter(function (v) { return v.vip; })[0];
      if (!vip || !vip.alive) return { winner: 'B', text: 'The VIP is dead — the mission has failed.' };
      if (rollEnd(state, 12)) return { winner: 'A', text: 'The reinforcements arrive with the VIP still alive — mission accomplished.' };
      return null;
    }
  });

  // up to 4" from a random entry point, one unit through each point a turn
  function fromEntry(state, u) {
    var ents = shuffle((state.sc.entries || []).slice());
    state.sc.usedEntries = state.sc.usedEntries || {};
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (state.sc.usedEntries[e.id]) continue;
      var avoid = state.scen.keepOut ? function (q) { return state.scen.keepOut(state, u, q); } : null;
      var q = spotNear(state, e.x, e.y, 4, u, avoid);
      if (!q) continue;
      state.sc.usedEntries[e.id] = true;
      u.entry = { x: e.x, y: e.y };
      return { x: q.x, y: q.y, why: 'through entry point ' + e.id };
    }
    return null;
  }

  /* ---- Decapitation (p. 152) ---- */
  SOLO.s_decap = base({
    id: 's_decap', deployText: function () { return "Nothing deploys: your commando comes on at a random table corner in the first Reserve phase."; }, name: 'Decapitation', page: 152,
    blurb: 'Get in, find the enemy leaders and kill them before they can call for help.',
    win: 'Destroy every OpFor Command Unit without being routed, within 12 turns.',
    hint: 'The leaders sit tight in defensive positions and never move. Counters within 18" of your units and in sight are revealed each Beginning phase — and if none is, the closest one is.',
    extraUnits: function (state) {
      var bt = state.cfg.tier, faction = state.solo.opFaction || 'pmc';
      // a swarm's leaders are its Leader Bugs, and a tribe's its Alpha squads
      function leads(p) { return p.command || p.alpha || (p.leaderBug && p.cls === 'infantry'); }
      var cu = R.listFor(faction).filter(function (p) { return leads(p) && p.tier === bt; })[0] ||
        R.listFor(faction).filter(function (p) { return (p.leaderBug && p.cls === 'infantry') || p.alpha; }).slice(-1)[0];
      return cu ? [{ profile: cu, side: 'B', leader: true }] : [];
    },
    setupTerrain: function (state) {
      var n = 0, pl = state.cfg.pl || 1;
      for (var i = 0; i < pl; i++) n += d6();
      scatterBarricades(state, n);
    },
    deploy: function (state) {
      var cus = state.units.filter(function (u) { return u.side === 'B' && u.soloLeader; });
      var placed = [];
      cus.forEach(function (u) {
        u.soloFixed = true; u.noBreak = true;
        // a defensive position: a building or a reinforced building if there is one, else cover
        var shelters = state.terrain.filter(function (t) {
          return (t.kind === 'building' || t.kind === 'bunker' || t.kind === 'ruins' || t.kind === 'woods') &&
            t.x + t.w / 2 >= 12 && t.x + t.w / 2 <= W - 12 && t.y + t.h / 2 >= 12 && t.y + t.h / 2 <= H - 12 &&
            placed.every(function (p) { return dist(p.x, p.y, t.x + t.w / 2, t.y + t.h / 2) >= 12; });
        }).sort(function (a, b) { return (R.TERRAIN[b.kind].cover - R.TERRAIN[a.kind].cover) || (Math.random() - 0.5); });
        var q = null;
        for (var s = 0; s < shelters.length && !q; s++) {
          var t = shelters[s];
          q = spotNear(state, t.x + t.w / 2, t.y + t.h / 2, Math.min(t.w, t.h) / 2, u);
        }
        if (!q) {
          for (var g = 0; g < 400 && !q; g++) {
            var c = { x: 12 + Math.random() * (W - 24), y: 12 + Math.random() * (H - 24) };
            if (passable(state, c.x, c.y) && placed.every(function (p) { return dist(p.x, p.y, c.x, c.y) >= 12; })) q = c;
          }
        }
        q = q || { x: W / 2, y: H / 2 };
        u.x = q.x; u.y = q.y; u.reserve = false; u.wave = 0;
        placed.push(q);
      });
      toPool(state);
      var n = pool(state).length, half = Math.ceil(n / 2), made = 0;
      // at least half within 12" of a leader; the rest scattered, 12" from the corners
      state.sc.counters = placeCounters(state, n, 6, function (p, sofar) {
        var nearCU = placed.some(function (c) { return dist(p.x, p.y, c.x, c.y) <= 12; });
        var clear = CORNERS.every(function (c) { return dist(p.x, p.y, c.x, c.y) >= 12; });
        if (!clear) return false;
        var near = sofar.filter(function (q) { return placed.some(function (c) { return dist(q.x, q.y, c.x, c.y) <= 12; }); }).length;
        return near < half ? nearCU : true;
      });
      // the players come on at a random corner — each player a different one
      var corners = shuffle([0, 1, 2, 3]);
      state.sc.entryCorner = {};
      owners(state).forEach(function (o, i) { state.sc.entryCorner[o] = CORNERS[corners[i]]; });
      mine(state, 'A').forEach(function (u) { u.reserve = true; u.wave = 1; u.x = -1; u.y = -1; });
      made = n;
    },
    arrivalPoint: function (state, u) {
      var c = state.sc.entryCorner[u.owner || 1];
      var q = spotNear(state, clamp(c.x, 3, W - 3), clamp(c.y, 3, H - 3), 6 - UR, u,
        function (p) { return dist(p.x, p.y, c.x, c.y) > 6; });
      return q ? { x: q.x, y: q.y, why: 'at its table corner' } : null;
    },
    arriveHow: function (state, u) {
      if (u.side !== 'A') return null;
      var c = state.sc.entryCorner[u.owner || 1];
      return { x: clamp(c.x, 0.2, W - 0.2), y: clamp(c.y, 0.2, H - 0.2) };
    },
    autoArrive: true,
    behaviour: function (state, u) {
      if (u.soloLeader) return { mod: 0, why: '', fixed: 'defensive' };
      return { mod: -1, why: 'defensive −1' };
    },
    noMove: function (state, u) { return !!u.soloLeader; },
    beginning: function (state) {
      var out = [], any = false;
      state.sc.counters.slice().forEach(function (c) {
        if (seen(state, c, 18)) { any = true; reveal(state, c, 'is spotted', out); }
      });
      if (!any) closestCounters(state, 1).forEach(function (c) { reveal(state, c, 'is the closest, and is revealed', out); });
      return out;
    },
    check: function (state) {
      var leaders = state.units.filter(function (u) { return u.soloLeader; });
      if (SC.routed(state, 'A')) return { winner: 'B', text: 'The commando is routed before it can reach the leaders.' };
      if (leaders.length && leaders.every(function (u) { return !u.alive; })) return { winner: 'A', text: 'Every enemy leader is dead — the OpFor is headless.' };
      if (state.turn >= 12) return { winner: 'B', text: 'Twelve turns gone and a leader still lives — the mission has failed.' };
      return null;
    }
  });

  /* ---- Evacuation (p. 153) ---- */
  function militiaProfile(bt) {
    var k = { 1: 'recruits', 2: 'rookie', 3: 'regular', 4: 'veterans', 5: 'rangers' }[bt] || 'regular';
    var src = R.profile(k), p = {};
    for (var f in src) p[f] = src[f];
    p.key = 'solomilitia'; p.code = 'MIL'; p.name = 'Militia'; p.rules = []; p.group = 'Militia';
    return p;
  }
  var CIVILIANS = {
    key: 'solociv', code: 'CIV', name: 'Civilian group', group: 'Civilians', art: 'civilian', faction: 'pmc',
    tier: 2, size: 6, move: 4, fp: 1, range: 12, def: 6, assault: 1, morale: 4, rules: [], cls: 'infantry'
  };
  function inSafeZone(state, x, y) {
    var z = state.sc.safe;
    return !!z && dist(x, y, z.x, z.y) <= 12;
  }
  function inSafeBuilding(state, u) {
    var b = state.sc.safeBuilding;
    return !!b && u.x >= b.x - 1 && u.x <= b.x + b.w + 1 && u.y >= b.y - 1 && u.y <= b.y + b.h + 1;
  }
  SOLO.s_evac = base({
    id: 's_evac', deployText: function () { return "Place your units in the shaded safe zone. The militia go anywhere at least 12\" from the table edges — they start placed, and you can move them."; }, name: 'Evacuation', page: 153,
    blurb: 'Civilians are trapped across the table. Get them into the safe-zone building before the OpFor gets them.',
    win: 'Save at least half the civilians, counted by models, not groups.',
    hint: 'Civilian groups come out of the reinforced buildings on a 5+ each Reserve phase. The OpFor enters from six points on a 5+, is aggressive, and cannot enter the safe zone. Everyone in the safe zone rallies automatically.',
    extraUnits: function (state) {
      var pl = state.cfg.pl || 1, own = owners(state), out = [];
      for (var i = 0; i < 4 * pl; i++) out.push({ profile: CIVILIANS, side: 'A', owner: own[0], civ: true });
      // one free militia unit a Priority Level, shared out between the players
      for (var m = 0; m < pl; m++) out.push({ profile: militiaProfile(state.cfg.tier), side: 'A', owner: own[m % own.length], militia: true });
      return out;
    },
    setupTerrain: function (state) {
      var ci = rnd(4), c = CORNERS[ci], o = CORNERS[(ci + 2) % 4];
      function inward(corner, d) { return { x: corner.x === 0 ? d : W - d, y: corner.y === 0 ? d : H - d }; }
      var sz = inward(c, 0);
      state.sc.safe = { x: sz.x, y: sz.y, r: 12 };
      state.terrain = state.terrain.filter(function (t) {
        return rectGap(t, c.x, c.y) > 12 && rectGap(t, o.x, o.y) > 14;
      });
      var bc = inward(c, 7);
      state.sc.safeBuilding = { kind: 'building', x: bc.x - 2.5, y: bc.y - 2.5, w: 5, h: 5, safe: true };
      state.terrain.push(state.sc.safeBuilding);
      // three reinforced buildings within 12" of the opposite corner
      var spots = [inward(o, 5), { x: o.x === 0 ? 10 : W - 10, y: o.y === 0 ? 3.5 : H - 3.5 }, { x: o.x === 0 ? 3.5 : W - 3.5, y: o.y === 0 ? 10 : H - 10 }];
      spots = [{ x: (o.x === 0 ? 4 : W - 4), y: (o.y === 0 ? 4 : H - 4) },
        { x: (o.x === 0 ? 11 : W - 11), y: (o.y === 0 ? 4 : H - 4) },
        { x: (o.x === 0 ? 4 : W - 4), y: (o.y === 0 ? 11 : H - 11) }];
      state.sc.homes = spots.map(function (p) {
        var b = { kind: 'bunker', x: p.x - 2, y: p.y - 2, w: 4, h: 4, home: true };
        state.terrain.push(b);
        return b;
      });
      // six entry points, 12" from the safe zone and each other, 6" from the homes
      state.sc.entries = [];
      for (var g = 0; g < 6000 && state.sc.entries.length < 6; g++) {
        var e = { x: 2 + Math.random() * (W - 4), y: 2 + Math.random() * (H - 4) };
        if (dist(e.x, e.y, state.sc.safe.x, state.sc.safe.y) < 24) continue;
        if (state.sc.entries.some(function (q) { return dist(q.x, q.y, e.x, e.y) < 12; })) continue;
        if (state.sc.homes.some(function (b) { return dist(b.x + 2, b.y + 2, e.x, e.y) < 8; })) continue;
        // entry points on the edges read as roads in; inland ones as tunnels
        if (Math.random() < 0.6) { if (Math.random() < 0.5) e.x = e.x < W / 2 ? 1.5 : W - 1.5; else e.y = e.y < H / 2 ? 1.5 : H - 1.5; }
        if (dist(e.x, e.y, state.sc.safe.x, state.sc.safe.y) < 24) continue;
        state.sc.entries.push({ x: e.x, y: e.y, id: 'E' + (state.sc.entries.length + 1) });
      }
    },
    deploy: function (state) {
      toPool(state);
      state.sc.defCircle = { x: state.sc.safe.x, y: state.sc.safe.y, r: 12 };
      state.sc.defender = 'A';
      state.units.forEach(function (u) {
        if (u.side !== 'A') return;
        if (u.soloCiv) { u.reserve = true; u.wave = 'civ'; u.x = -1; u.y = -1; u.noFlee = true; return; }
        if (u.soloMilitia) {
          // anywhere at least 12" from the table edges
          var q = null;
          for (var g = 0; g < 400 && !q; g++) {
            var c = { x: 12 + Math.random() * (W - 24), y: 12 + Math.random() * (H - 24) };
            if (passable(state, c.x, c.y) && !R.unitNear(state, c.x, c.y, u, 1)) q = c;
          }
          if (q) { u.x = q.x; u.y = q.y; }
        }
      });
      state.sc.civTotal = state.units.filter(function (u) { return u.soloCiv; }).reduce(function (a, u) { return a + u.models; }, 0);
      state.sc.saved = 0;
    },
    deployOK: function (state, side, x, y, u) {
      if (side !== 'A') return false;
      if (u && u.soloMilitia) return x >= 12 && y >= 12 && x <= W - 12 && y <= H - 12;
      return inSafeZone(state, x, y);
    },
    reserves: function (state, side) {
      if (side === 'A') {
        // civilian groups come out on a 5+; the player's own reserves come in by the safe building
        var out = [];
        state.units.forEach(function (u) {
          if (u.side !== 'A' || !u.alive || !u.reserve) return;
          if (u.wave === 'civ') { if (d6() >= 5) out.push(u); }
          else if (!u.wave || u.wave === 'held') out.push(u);
        });
        return out;
      }
      state.sc.usedEntries = {};
      return shuffle(pool(state)).filter(function () { return d6() >= 5; }).slice(0, 6);
    },
    arrivalPoint: function (state, u) {
      if (u.side === 'B') return fromEntry(state, u);
      if (u.soloCiv) {
        var homes = shuffle(state.sc.homes.slice());
        for (var i = 0; i < homes.length; i++) {
          var b = homes[i];
          var q = spotNear(state, b.x + b.w / 2, b.y + b.h / 2, 4.5, u, function (p) {
            return p.x > b.x - 0.5 && p.x < b.x + b.w + 0.5 && p.y > b.y - 0.5 && p.y < b.y + b.h + 0.5;
          });
          if (q) { u.entry = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; return { x: q.x, y: q.y, why: 'out of a reinforced building' }; }
        }
        return null;
      }
      var sb = state.sc.safeBuilding;
      var q2 = spotNear(state, sb.x + sb.w / 2, sb.y + sb.h / 2, 5, u);
      return q2 ? { x: q2.x, y: q2.y, why: 'beside the safe-zone building' } : null;
    },
    arriveHow: function (state, u) { return u.entry || null; },
    autoArrive: true,
    returnsToPool: true,
    keepOut: function (state, u, q) { return u.side === 'B' && inSafeZone(state, q.x, q.y); },
    moveOK: function (state, u, c) { return u.side !== 'B' || !inSafeZone(state, c.x, c.y); },
    behaviour: function () { return { mod: 3, why: 'aggressive +3' }; },
    rallyFree: function (state, u) { return u.side === 'A' && inSafeZone(state, u.x, u.y); },
    fallTo: function (state, u) {
      if (u.side !== 'A') return null;
      var b = state.sc.safeBuilding;
      return { x: b.x + b.w / 2, y: b.y + b.h / 2, flee: true };
    },
    beginning: function (state) {
      // in a cooperative game the civilians change hands every turn (p. 153)
      var own = owners(state);
      if (own.length > 1) {
        var o = own[rnd(own.length)];
        state.units.forEach(function (u) { if (u.soloCiv) u.owner = o; });
        return [{ text: 'Player ' + o + ' leads the civilians this turn.' }];
      }
      return [];
    },
    // a civilian group that reaches the safe-zone building is safe, and off the table
    afterMove: function (state, u) {
      if (!u.soloCiv || !u.alive || !inSafeBuilding(state, u)) return null;
      state.sc.saved += u.models;
      u.reserve = true; u.wave = 'saved'; u.x = -1; u.y = -1; u.safe = true;
      return { text: u.label + ' reaches the safe-zone building — ' + u.models + ' civilians saved (' + state.sc.saved + ' of ' + state.sc.civTotal + ').' };
    },
    check: function (state) {
      var civs = state.units.filter(function (u) { return u.soloCiv; });
      var pending = civs.filter(function (u) { return u.alive && !u.safe; });
      if (pending.length) return null;
      var saved = state.sc.saved, half = Math.ceil(state.sc.civTotal / 2);
      return saved >= half
        ? { winner: 'A', text: saved + ' of ' + state.sc.civTotal + ' civilians saved — the evacuation is a success.' }
        : { winner: 'B', text: 'Only ' + saved + ' of ' + state.sc.civTotal + ' civilians saved — the evacuation has failed.' };
    }
  });

  /* ---- Sabotage (p. 155) ---- */
  SOLO.s_sabotage = base(extend({
    id: 's_sabotage', deployText: function () { return "Nothing deploys: your commando drops into the landing zone you nominate, in the first Reserve phase."; }, name: 'Sabotage', page: 155,
    blurb: 'Destroy every one of the targets without losing too many people doing it.',
    win: 'Destroy all the objectives without being routed.',
    hint: 'A unit within 1" of an objective can destroy it as its action. Counters within 12" and in sight are revealed each Beginning phase, and D3−1 of the closest are revealed anyway. The OpFor turns aggressive near the objectives.',
    objectives: function (state) {
      /* "3 objectives are placed... Add 2 objectives per Priority Level" (p. 155):
         3 at Priority Level 1, the book's base, and 2 more for each level above it
         — so each extra player in a cooperative game brings two more targets.
         They go 12" apart; only if the table cannot take that many does the gap close. */
      var n = 3 + 2 * Math.max(0, (state.cfg.pl || 1) - 1), out = [];
      for (var apart = 12; apart >= 6 && out.length < n; apart -= 2) {
        out = [];
        for (var g = 0; g < 8000 && out.length < n; g++) {
          var p = { x: 12 + Math.random() * (W - 24), y: 12 + Math.random() * (H - 24) };
          if (state && !passable(state, p.x, p.y)) continue;
          if (out.every(function (q) { return dist(p.x, p.y, q.x, q.y) >= apart; })) out.push(p);
        }
      }
      state.sc.targets = out.map(function (p, i) { return { x: p.x, y: p.y, id: i, destroyed: false }; });
      return [];
    },
    deploy: function (state) {
      toPool(state);
      var n = pool(state).length, third = Math.ceil(n / 3), tg = state.sc.targets;
      state.sc.counters = placeCounters(state, n, 6, function (p, sofar) {
        var near = tg.some(function (t) { return dist(p.x, p.y, t.x, t.y) <= 12; });
        var nNear = sofar.filter(function (q) { return tg.some(function (t) { return dist(q.x, q.y, t.x, t.y) <= 12; }); }).length;
        if (nNear < third) return near;
        return p.x >= 12 && p.y >= 12 && p.x <= W - 12 && p.y <= H - 12;
      });
      mine(state, 'A').forEach(function (u) { u.reserve = true; u.wave = 1; u.x = -1; u.y = -1; });
      state.sc.lz = {};
    },
    beginning: function (state) {
      var out = [];
      state.sc.counters.slice().forEach(function (c) {
        if (seen(state, c, 12)) reveal(state, c, 'is spotted', out);
      });
      if (players(state).length) {
        var n = Math.max(0, d3() - 1);
        out.push({ text: 'D3−1 = ' + n + ': ' + (n ? n + ' of the closest counters give themselves away.' : 'no counter gives itself away.') });
        closestCounters(state, n).forEach(function (c) { reveal(state, c, 'gives itself away', out); });
      }
      return out;
    },
    behaviour: function (state, u) {
      var near = (state.sc.targets || []).some(function (t) { return !t.destroyed && dist(u.x, u.y, t.x, t.y) <= 12; });
      return near ? { mod: 1, why: 'aggressive near an objective +1' } : { mod: 0, why: '' };
    },
    // the objectives are what the OpFor defends
    goals: function (state) { return (state.sc.targets || []).filter(function (t) { return !t.destroyed; }); },
    sabotageSpots: function (state, u) {
      if (u.side !== 'A') return [];
      return (state.sc.targets || []).filter(function (t) { return !t.destroyed && dist(u.x, u.y, t.x, t.y) <= UR + 1 + 1; });
    },
    check: function (state) {
      if (SC.routed(state, 'A')) return { winner: 'B', text: 'The commando is routed before the job is done.' };
      if ((state.sc.targets || []).every(function (t) { return t.destroyed; })) return { winner: 'A', text: 'Every objective is destroyed — sabotage complete.' };
      return null;
    }
  }, landing));

  /* ---- Ambush! (p. 156) ---- */
  SOLO.s_ambush = base({
    id: 's_ambush', deployText: function () { return "Place your units in the shaded bands either side of the road, within 12\" of it. Each one then shifts as it takes cover."; }, name: 'Ambush!', page: 156,
    blurb: 'An enemy column is coming down the road. Hit it hard, all at once, before it can react.',
    win: 'Destroy or break at least 75% of the enemy units before the end. If all your units are Broken, you lose. From turn 6 the game ends on a 6, then 5+, 4+ and so on.',
    hint: 'Split your force either side of the road, within 12" of it. Each unit then shifts a little as it finds its hiding place. OpFor units shot at in the first turn take an extra D3 SP.',
    setupTerrain: function (state) {
      // a straight road through the middle of the table: nothing stands on it
      var y0 = H / 2 - 2, y1 = H / 2 + 2;
      state.sc.road = { y0: y0, y1: y1 };
      state.terrain = state.terrain.filter(function (t) { return t.y + t.h < y0 - 0.5 || t.y > y1 + 0.5; });
      state.terrain.push({ kind: 'road', x: 0, y: y0, w: W, h: y1 - y0 });
    },
    deploy: function (state) {
      // the column on the road, 1-3" apart, in a random order
      var col = shuffle(mine(state, 'B').slice());
      var dir = Math.random() < 0.5 ? 1 : -1, x = dir > 0 ? 4 : W - 4;
      col.forEach(function (u) {
        u.soloFixed = true;
        u.x = clamp(x, UR, W - UR); u.y = H / 2 + (Math.random() - 0.5);
        u.facing = dir > 0 ? 0 : Math.PI; u.faceL = dir < 0;
        u.reserve = false;
        x += dir * (2 * UR + 1 + Math.random() * 2);
      });
      state.sc.boxes = { A: [{ x: 0, y: H / 2 - 14, w: W, h: 12 }, { x: 0, y: H / 2 + 2, w: W, h: 12 }] };
    },
    deployOK: function (state, side, x, y) {
      if (side !== 'A') return false;
      var d = Math.abs(y - H / 2);
      return d >= 2 + UR && d <= 14;
    },
    /* The units settle into their hides: on 1-2 a unit is D6" nearer the road,
       on 5-6 D6" further from it. */
    beforeBattle: function (state) {
      var out = [];
      state.units.forEach(function (u) {
        if (u.side !== 'A' || !onTable(u)) return;
        var r = d6();
        if (r >= 3 && r <= 4) { out.push({ text: u.label + ': D6 ' + r + ' — stays put.' }); return; }
        var n = d6(), toward = r <= 2, sgn = u.y < H / 2 ? 1 : -1;
        var ny = u.y + (toward ? sgn : -sgn) * n;
        // it never ends up on the road, or off the table
        if (toward) ny = sgn > 0 ? Math.min(ny, H / 2 - 2 - UR) : Math.max(ny, H / 2 + 2 + UR);
        ny = clamp(ny, UR, H - UR);
        if (passable(state, u.x, ny) && !R.unitNear(state, u.x, ny, u, 1)) {
          out.push({ text: u.label + ': D6 ' + r + ' — ' + (toward ? 'creeps ' : 'pulls back ') + Math.abs(ny - u.y).toFixed(1) + '" ' + (toward ? 'towards' : 'away from') + ' the road.' });
          u.y = ny;
        } else out.push({ text: u.label + ': D6 ' + r + ' — no better cover to hand; stays put.' });
      });
      return out;
    },
    afterShot: function (state, a, t) {
      if (state.turn !== 1 || a.side !== 'A' || t.side !== 'B' || !t.alive || R.isMachine(t)) return null;
      var n = d3();
      R.addSP(t, n);
      return { text: t.label + ' is caught completely off guard: +' + n + ' SP (D3).' };
    },
    check: function (state) {
      var foes = state.units.filter(function (u) { return u.side === 'B'; });
      var done = foes.filter(function (u) { return !u.alive || R.status(u) === 'broken'; }).length;
      var need = Math.ceil(foes.length * 0.75);
      var mineOn = state.units.filter(function (u) { return u.side === 'A' && onTable(u); });
      if (mineOn.length && mineOn.every(function (u) { return R.status(u) === 'broken'; })) {
        return { winner: 'B', text: 'Every unit in the ambush is broken — the column fights its way through.' };
      }
      if (done >= need) return { winner: 'A', text: done + ' of ' + foes.length + ' enemy units destroyed or broken — the column is shattered.' };
      if (rollEnd(state, 6)) return { winner: 'B', text: 'The column gets clear with only ' + done + ' of ' + foes.length + ' units down — not enough.' };
      return null;
    }
  });

  var ORDER = ['s_crush', 's_vip', 's_decap', 's_evac', 's_sabotage', 's_ambush'];
  ORDER.forEach(function (id) { SC.SCENARIOS[id] = SOLO[id]; });

  root.PMCSolo = {
    COMMANDO: COMMANDO, OPFOR: OPFOR, ORDER: ORDER, SCENARIOS: SOLO,
    checkCommando: checkCommando, rollCommando: rollCommando, rollOpFor: rollOpFor,
    catalogue: catalogue, usable: usable, lzLegal: lzLegal, lzSpots: lzSpots, autoLZ: autoLZ,
    pool: pool
  };
})(typeof window !== 'undefined' ? window : global);
