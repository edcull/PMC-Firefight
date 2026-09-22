/* PMC 2670 — Firefight
   The six scenarios (rulebook pp. 48-55): objectives, terrain modifications,
   deployment, reserves, game length and special rules.

   Each scenario is a plain object the turn loop asks questions of. Everything it
   needs to remember for itself lives on `state.sc`, so the engine never has to
   know which scenario it is running.

   An interpretation carried over from the base game: the book has most scenarios
   entering the whole force "from your table edge in the Reserve phase of turn 1",
   which is the same thing as deploying in a strip on that edge, and that is how it
   is presented here. Scenarios with a real deployment area — the defender in
   Demolish, Hostile takeover and Invasion — get one.
*/
(function (root) {
  'use strict';
  var R = root.PMC;
  var W = R.BOARD.w, H = R.BOARD.h;
  function d6() { return R.d6(); }
  function d3() { return R.d3(); }
  function dist(a, b, c, d) { return R.inches(a, b, c, d); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- helpers shared by several scenarios ---------- */

  /* Secure and control's three objectives (p. 51): "at least 12" from each other and
     8" from table edges". The book has the players nominate them, and players
     nominate them to be fought over: one each side of the table, nearer each
     company's own edge, and one in the middle — so every battle has a point each
     side can take early and one that has to be fought for. Where along the
     table each falls is still different every battle. */
  function spread3(state) {
    /* A deploys along the low-x edge, B along the high-x edge; every objective
       stays in the middle half of the table, clear of the quarter at either end */
    var lo = W * 0.25, hi = W * 0.75;
    var bands = [[lo, lo + 3], [W / 2 - 2.5, W / 2 + 2.5], [hi - 3, hi]];
    function ok(p) { return !(state && R.TERRAIN[R.terrainAt(state, p.x, p.y)].impassable); }
    for (var guard = 0; guard < 4000; guard++) {
      var out = bands.map(function (bd) { return { x: bd[0] + Math.random() * (bd[1] - bd[0]), y: 8 + Math.random() * (H - 16) }; });
      if (!out.every(ok)) continue;
      var apart = true;
      for (var i = 0; i < 3; i++) for (var j = i + 1; j < 3; j++) if (dist(out[i].x, out[i].y, out[j].x, out[j].y) < 12) apart = false;
      if (apart) return out;
    }
    // a table with no room left: fall back on the corners-and-centre layout
    return [{ x: lo, y: 36 }, { x: W / 2, y: 24 }, { x: hi, y: 12 }];
  }
  /* Bands along the table edges, `depth` inches deep — "any table edge", which is
     what Hostile takeover gives its attacker (p. 55). */
  function edgeBands(depth) {
    return [
      { x: 0, y: 0, w: W, h: depth }, { x: 0, y: H - depth, w: W, h: depth },
      { x: 0, y: 0, w: depth, h: H }, { x: W - depth, y: 0, w: depth, h: H }
    ];
  }
  /* Points within `rad` of the centre, at least `apart` from each other, and — when
     one is given — passing `wants`, which is how Invasion keeps its landing zones on
     open ground. The want is all or nothing: a full set that satisfies it, or, on a
     table with no room left that does, a set that ignores it rather than a mixture. */
  function clusterAt(cx, cy, n, rad, apart, wants) {
    function pick(want) {
      var out = [];
      for (var guard = 0; guard < 20000 && out.length < n; guard++) {
        var a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (rad - 4);
        // objectives stay in the middle half of the table's width, clear of both deployment ends
        var p = { x: clamp(cx + Math.cos(a) * r, Math.max(8, W * 0.25), Math.min(W - 8, W * 0.75)), y: clamp(cy + Math.sin(a) * r, 8, H - 8) };
        if (want && !want(p)) continue;
        if (out.every(function (q) { return dist(p.x, p.y, q.x, q.y) >= apart; })) out.push(p);
      }
      return out;
    }
    var out = wants ? pick(wants) : [];
    if (out.length < n) out = pick(null);
    while (out.length < n) out.push({ x: cx, y: cy });
    return out;
  }
  /* Split a side's units into two halves, the bigger models first so both are real.
     An emplaced gun cannot be held in reserve (p. 94): it is dug in where it stands
     before a shot is fired, so it always goes in the first half. */
  function halve(units) {
    var emplaced = units.filter(function (u) { return R.has(u, 'Stationary Artillery'); });
    var rest = units.filter(function (u) { return !R.has(u, 'Stationary Artillery'); });
    var sorted = rest.slice().sort(function (a, b) { return (b.models || 1) - (a.models || 1); });
    var first = emplaced.slice(), second = [];
    sorted.forEach(function (u, i) { (i % 2 ? second : first).push(u); });
    return { first: first, second: second };
  }
  /* Last Stand (p. 95): four barricades a Priority Level, anywhere but the enemy's
     deployment zone. They go down before the battle, so this runs once the scenario
     has settled its zones — thrown up across the rebels' own half of the table. */
  function lastStandBarricades(state) {
    ['A', 'B'].forEach(function (side) {
      if (!state.tactics || state.tactics[side] !== 'laststand') return;
      var n = 4 * (state.cfg.pl || 1);
      var near = side === 'A';                      // A holds the low edge, B the high
      for (var i = 0; i < n; i++) {
        var len = 3 + Math.floor(Math.random() * 4);   // no section over 6"
        var horiz = Math.random() < 0.5;
        var band = 8 + Math.random() * 12;             // 8-20" in from their own edge
        var along = 4 + Math.random() * (W - 8 - len);
        var across = near ? band : H - band;
        state.terrain.push({
          kind: 'barricade',
          x: clamp(horiz ? along : across, 2, W - len - 2),
          y: clamp(horiz ? across : along, 2, H - len - 2),
          w: horiz ? len : 1, h: horiz ? 1 : len
        });
      }
    });
  }

  /* No two terrain pieces share ground. The scenario's own pieces — the
     objective, the search sites, a defender's bunker and walls — are laid
     first and stay where they are; anything else that sits on one is shifted
     to the nearest clear spot, trimmed if it has to be, and left out only if
     there is no room for it anywhere near. */
  var GAP = 0.5;
  function clashes(a, b) {
    return a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;
  }
  function separateTerrain(state) {
    var genCount = state.genCount != null ? state.genCount : state.terrain.length;
    var FIXED = { objective: 1, searchsite: 1, road: 1 };
    var ranked = state.terrain.map(function (t, i) {
      return { t: t, rank: FIXED[t.kind] ? 0 : i >= genCount ? 1 : 2, i: i };
    }).sort(function (a, b) { return a.rank - b.rank || a.i - b.i; });
    var kept = [];
    function free(p) {
      if (p.x < 0.5 || p.y < 0.5 || p.x + p.w > W - 0.5 || p.y + p.h > H - 0.5) return false;
      for (var k = 0; k < kept.length; k++) if (clashes(p, kept[k])) return false;
      // keep clear of the objectives as the generator does, unless it is one
      if (p.kind !== 'objective' && p.kind !== 'searchsite') {
        for (var o = 0; o < (state.objectives || []).length; o++) {
          var ob = state.objectives[o];
          if (ob.x > p.x - 3 && ob.x < p.x + p.w + 3 && ob.y > p.y - 3 && ob.y < p.y + p.h + 3) return false;
        }
      }
      return true;
    }
    ranked.forEach(function (r) {
      var t = r.t;
      if (r.rank === 0 || free(t)) { kept.push(t); return; }
      // the nearest clear spot, in widening rings, at full size and then trimmed
      var scales = [1, 0.8, 0.6];
      for (var si = 0; si < scales.length; si++) {
        var sc = scales[si];
        var w = (t.kind === 'barricade' || t.kind === 'wall') ? t.w : Math.max(2, t.w * sc);
        var h = (t.kind === 'barricade' || t.kind === 'wall') ? t.h : Math.max(2, t.h * sc);
        if (sc < 1 && (t.kind === 'barricade' || t.kind === 'wall')) break;
        var cx = t.x + t.w / 2, cy = t.y + t.h / 2;
        for (var rad = 0.5; rad <= 10; rad += 0.5) {
          var steps = Math.max(8, Math.round(rad * 6));
          for (var k = 0; k < steps; k++) {
            var a = (k / steps) * Math.PI * 2;
            var q = { x: cx + Math.cos(a) * rad - w / 2, y: cy + Math.sin(a) * rad - h / 2, w: w, h: h };
            q.kind = t.kind;
            if (free(q)) { R.placePiece(t, q.x, q.y, w, h); kept.push(t); return; }
          }
        }
      }
      // nowhere near it is clear: it is not put down at all
    });
    state.terrain = state.terrain.filter(function (t) { return kept.indexOf(t) >= 0; });
  }

  function mine(state, side) {
    return state.units.filter(function (u) { return u.side === side && u.alive && !u.aboard; });
  }
  function onTable(u) { return u.alive && u.x >= 0 && !u.aboard && !u.reserve; }
  function unsuppressed(u) { return R.status(u) === 'ready'; }

  /* Who holds a point: at least one steady, unbroken, non-flying unit within 4",
     and none of the enemy's (p. 49). */
  function holderOf(state, x, y, radius) {
    var claim = { A: 0, B: 0 };
    state.units.forEach(function (u) {
      if (!onTable(u) || R.isFlying(u) || !unsuppressed(u)) return;
      if (!R.holdsGround(u)) return;               // a drop pod holds nothing (p. 79)
      if (Math.max(0, dist(u.x, u.y, x, y) - R.UNIT_R) > (radius || 4)) return;
      claim[u.side]++;
    });
    return claim.A > 0 && claim.B === 0 ? 'A' : (claim.B > 0 && claim.A === 0 ? 'B' : null);
  }

  /* Rout: half a side's units destroyed or fled. Units still in reserve count as
     perfectly fine (p. 49), so they are neither losses nor part of the tally. */
  function routed(state, side) {
    /* A Rapid insertion platform "does not count towards victory conditions"
       (p. 79), so it is in neither the tally nor the losses. */
    var army = state.cfg[side === 'A' ? 'armyA' : 'armyB'] || [];
    var pods = state.units.filter(function (u) {
      return u.side === side && !R.countsForVictory(u);
    }).length;
    var started = Math.max(0, army.length - pods);
    var left = state.units.filter(function (u) {
      return u.alive && u.side === side && R.countsForVictory(u);
    }).length;
    return (started - left) >= Math.ceil(started / 2);
  }

  /* p. 49: "Completely destroying the enemy force and/or forcing all enemy units to
     flee results in an automatic victory and fulfilment of the scenario objective in
     the next subsequent End phase." This applies to every scenario, including the
     three that have no rout clause of their own. Reserves not yet on the table are
     perfectly fine, so they keep a side in the fight. */
  function annihilated(state, side) {
    return !state.units.some(function (u) {
      return u.alive && u.side === side && R.countsForVictory(u);
    });
  }

  /* The book's "after turn N, roll a D6: on a 6 the game ends, +1 for every
     further turn" (pp. 52-53). */
  function rollEnd(state, after) {
    if (state.turn < after) return false;
    var need = 6 - (state.turn - after);
    var roll = d6();
    state.sc.lastEndRoll = { roll: roll, need: Math.max(2, need) };
    return roll >= Math.max(2, need);
  }

  /* A strip on one table edge. */
  function strip(side, depth) {
    return side === 'A' ? [R.UNIT_R, depth] : [W - depth, W - R.UNIT_R];
  }

  /* Demolish divides the table edges by corner (p. 54): the `run` inches of edge
     running away from a corner in each direction belong to whoever owns it. That
     is two rectangles a corner, `depth` inches deep. */
  function cornerBands(c, run, depth) {
    return [
      { x: c.x === 0 ? 0 : W - run, y: c.y === 0 ? 0 : H - depth, w: run, h: depth },
      { x: c.x === 0 ? 0 : W - depth, y: c.y === 0 ? 0 : H - run, w: depth, h: run }
    ];
  }
  var CORNERS = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  function inBoxes(boxes, x, y) {
    return !!boxes && boxes.some(function (b) {
      return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    });
  }

  /* ================= the six ================= */
  var SCENARIOS = {

    /* ------------------------------------------------ Meeting engagement (p. 50) */
    meeting: {
      edges: true,             // opposite table edges, randomised after the terrain is set (p. 50)
      id: 'meeting', name: 'Meeting engagement', page: 50,
      blurb: 'Two companies meet and the fight is unavoidable. Break the enemy or be broken.',
      win: 'Rout the enemy — destroy or drive off half their units.',
      turns: 20,
      objectives: function () { return []; },
      deploy: function (state) {
        state.sc.zones = { A: strip('A', 6), B: strip('B', 6) };
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      hint: 'No objectives: the only way to win is to break the other company.',
      check: function (state) {
        var ra = routed(state, 'A'), rb = routed(state, 'B');
        if (ra && rb) return { winner: null, text: 'Both companies are broken — a bloody draw.' };
        if (rb) return { winner: 'A', text: 'A routs the enemy — half their units are gone.' };
        if (ra) return { winner: 'B', text: 'B routs the enemy — half their units are gone.' };
        if (state.turn >= 20) return { winner: null, text: 'Twenty turns and neither company breaks — a draw.' };
      }
    },

    /* ------------------------------------------------ Secure and control (p. 51) */
    secure: {
      edges: true,             // opposite table edges, randomised after the terrain is set (p. 50)
      id: 'secure', name: 'Secure and control', page: 51,
      blurb: 'Both companies have to seize and hold the ground that matters.',
      win: 'Hold more objectives at the end; hold all three at any End phase; or hold the same two for three End phases running.',
      turns: 20,
      objectives: function (state) { return spread3(state); },
      deploy: function (state) {
        state.sc.zones = { A: strip('A', 6), B: strip('B', 6) };
        state.sc.streak = { A: { key: '', n: 0 }, B: { key: '', n: 0 } };
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      hint: 'Three objectives. Hold all three at once, or the same two for three turns running, and it ends early. Breaking the enemy is not a win here — only ground is.',
      check: function (state) {
        // p. 51 gives no rout clause: ground is the only thing that counts
        var held = { A: [], B: [] };
        state.objectives.forEach(function (o, i) { if (o.owner) held[o.owner].push(i); });
        if (held.A.length === 3) return { winner: 'A', text: 'A holds all three objectives.' };
        if (held.B.length === 3) return { winner: 'B', text: 'B holds all three objectives.' };
        // the same two objectives in three consecutive End phases
        var out = null;
        ['A', 'B'].forEach(function (s) {
          var key = held[s].join(',');
          var st = state.sc.streak[s];
          if (key && held[s].length >= 2 && key === st.key) st.n++;
          else { st.key = key; st.n = held[s].length >= 2 ? 1 : 0; }
          if (st.n >= 3) out = { winner: s, text: s + ' has held the same two objectives for three turns running.' };
        });
        if (out) return out;
        if (state.turn >= 20) {
          if (held.A.length > held.B.length) return { winner: 'A', text: 'A holds more objectives at the end of turn 20.' };
          if (held.B.length > held.A.length) return { winner: 'B', text: 'B holds more objectives at the end of turn 20.' };
          return { winner: null, text: 'Time runs out with the objectives split — a draw.' };
        }
      }
    },

    /* -------------------------------------------------- Find and secure (p. 52) */
    find: {
      edges: true,             // opposite table edges, randomised after the terrain is set (p. 50)
      id: 'find', name: 'Find and secure', page: 52,
      blurb: 'Something worth blood is hidden out there, and neither company knows quite where.',
      win: 'Find the objective with "Check the area!" and hold it at the end — or rout the enemy, which the holder cannot suffer while they hold it.',
      turns: 0,                                 // rolls for the end after turn 12
      searchOnly: true,
      objectives: function (state) {
        /* Three candidate locations within 12" of the centre and 12" from each other
           (p. 52). They go on the table as real pieces — 4" across, passable, no
           cover, no line of sight blocked, indestructible — because the players have
           to be able to see what there is to search. */
        var spots = clusterAt(W / 2, H / 2, 3, 12, 12);
        state.sc.search = spots.map(function (p, i) {
          var piece = {
            kind: 'searchsite', x: p.x - 2, y: p.y - 2, w: 4, h: 4,
            site: i, cx: p.x, cy: p.y, checked: false, found: false, cold: false
          };
          state.terrain.push(piece);
          return { x: p.x, y: p.y, i: i, checked: false, piece: piece };
        });
        state.sc.found = null;
        state.sc.order = 0;                      // how many have been checked
        return [];                               // nothing is an objective until it is found
      },
      deploy: function (state) {
        state.sc.zones = { A: strip('A', 6), B: strip('B', 6) };
        // half the force enters at once; the rest waits in reserve
        ['A', 'B'].forEach(function (side) {
          var split = halve(mine(state, side).filter(function (u) { return !u.reserve; }));
          split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        });
        state.sc.hold = { A: 0, B: 0 };
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      hint: 'Three staked locations. Bring a unit within 4" and use "Check the area!" — 5+ at the first, 4+ at the second, automatic at the third.',
      // from turn 3, every second turn, a number equal to the Priority Level comes on
      reserves: function (state, side) {
        if (state.turn < 3 || state.turn % 2 === 0) return [];
        return state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve && u.wave === 2;
        }).slice(0, state.cfg.pl);
      },
      check: function (state) {
        var found = state.sc.found;
        var holder = found ? holderOf(state, found.x, found.y, 4) : null;
        if (found) {
          state.sc.hold[holder === 'A' ? 'A' : 'B'] = holder ? state.sc.hold[holder] + 1 : 0;
          if (holder) {
            ['A', 'B'].forEach(function (s) { if (s !== holder) state.sc.hold[s] = 0; });
            if (state.sc.hold[holder] >= 3) {
              return { winner: holder, text: holder + ' has held the objective for three turns running.' };
            }
          } else { state.sc.hold.A = 0; state.sc.hold.B = 0; }
        }
        // the company holding the objective cannot be routed while it holds it
        var ra = routed(state, 'A') && holder !== 'A';
        var rb = routed(state, 'B') && holder !== 'B';
        if (ra && rb) return { winner: null, text: 'Both companies are broken — a bloody draw.' };
        if (rb) return { winner: 'A', text: 'A routs the enemy — half their units are gone.' };
        if (ra) return { winner: 'B', text: 'B routs the enemy — half their units are gone.' };
        if (rollEnd(state, 12)) {
          if (holder) return { winner: holder, text: 'The search ends with ' + holder + ' holding the prize.' };
          return { winner: null, text: 'The search ends with nobody holding the prize — a draw.' };
        }
      }
    },

    /* ------------------------------------------------------- Invasion (pp. 52-53) */
    invasion: {
      id: 'invasion', name: 'Invasion', page: 53,
      blurb: 'One company comes down from orbit; the other has to hold the ground it lands on.',
      win: 'Attacker: hold two of the three landing zones at the end, or rout the defender. Defender: simply stop them — breaking the landing is not a win in itself.',
      turns: 0,
      attacker: true,
      noInsertion: true,
      roles: {
        attacker: 'As the attacker your whole force comes down from orbit into the landing zones — nothing deploys on the table, and the infantry take D3 SP as they land.',
        defender: 'As the defender you set up to a third of your force anywhere 6" in from the table edges; the rest walks on from a random edge, on a 5+ a unit from turn 2.'
      },
      objectives: function (state) {
        // three 8" circles, 12" from each other, 8" in from the edges, in open
        // ground (p. 53) — nobody drops a platoon into a wood or onto rocks
        var zones = clusterAt(W / 2, H / 2, 3, 15, 12, function (p) {
          return R.terrainAt(state, p.x, p.y) === 'open';
        });
        state.sc.zones3 = zones.map(function (p) { return { x: p.x, y: p.y, owner: null }; });
        return zones;                            // the landing zones are the objectives
      },
      deploy: function (state) {
        var atk = state.sc.attacker, def = state.sc.attacker === 'A' ? 'B' : 'A';
        // the defender puts no more than a third on the table, 6" in from the edges
        var defs = mine(state, def).filter(function (u) { return !u.reserve; });
        // an emplaced gun is already dug in, so it is never among those held back
        defs.sort(function (a, b) {
          return (R.has(b, 'Stationary Artillery') ? 1 : 0) - (R.has(a, 'Stationary Artillery') ? 1 : 0);
        });
        var keep = Math.max(1, Math.floor(defs.length / 3));
        defs.slice(keep).forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        // the attacker comes in two waves; the first lands in the Reserve phase of turn 1
        var atks = mine(state, atk).filter(function (u) { return !u.reserve; });
        var split = halve(atks);
        split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        split.first.forEach(function (u) { u.reserve = true; u.wave = 1; u.x = -1; u.y = -1; });
        state.sc.zones = {};
        state.sc.zones[def] = [6, W - 6];         // anywhere 6" in from the edges
        state.sc.zones[atk] = null;               // the attacker never deploys: it lands
        state.sc.inset = 6;
        /* "the unit enters the table from a random table edge (but from a point
           nominated by the defender)" (p. 53) — not from a side of their own. */
        state.sc.entry = {};
        state.sc.entry[def] = edgeBands(2);
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      /* "The defender deploys up to 1/3 of his forces on the table at least 6" from
         table edges" (p. 53) — all four edges, not just the two behind him. */
      deployOK: function (state, side, x, y) {
        if (side === state.sc.attacker) return false;   // the attacker lands, it never deploys
        return x >= 6 && y >= 6 && x <= W - 6 && y <= H - 6;
      },
      hint: 'Three landing zones. The attacker has to hold two of the three at the end, or rout the defender; the defender only has to stop them. Hold all three and the second wave cannot land.',
      reserves: function (state, side) {
        var atk = state.sc.attacker;
        var pool = state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve;
        });
        if (side === atk) {
          var wave1 = pool.filter(function (u) { return u.wave === 1; });
          if (state.turn === 1) return wave1;    // the first wave lands at once
          if (state.turn < 4) return [];
          /* "All landing zones are hot! Repeat! All landing zones are hot!" (p. 53):
             with every zone in the defender's hands the second wave cannot come down
             this turn, though the attacker may roll again next turn. */
          var def2 = atk === 'A' ? 'B' : 'A';
          if (state.objectives.length && state.objectives.every(function (o) { return o.owner === def2; })) {
            state.sc.zonesHot = state.turn;
            return [];
          }
          state.sc.zonesHot = 0;
          // the second wave rolls in from turn 4, 5+ and easier every turn after
          var need = Math.max(2, 5 - (state.turn - 4));
          return pool.filter(function (u) { return u.wave === 2 && d6() >= need; });
        }
        if (state.turn < 2) return [];
        return pool.filter(function () { return d6() >= 5; });
      },
      // landing infantry are shaken by the drop
      onArrive: function (state, u) {
        if (u.side !== state.sc.attacker || R.isMachine(u)) return null;
        var n = d3();
        R.addSP(u, n);
        return { text: u.label + ' takes ' + n + ' SP coming down (D3).', sp: n };
      },
      check: function (state) {
        var atk = state.sc.attacker, def = atk === 'A' ? 'B' : 'A';
        state.objectives.forEach(function (o) { o.owner = holderOf(state, o.x, o.y, 4); });
        var mineZ = state.objectives.filter(function (o) { return o.owner === atk; }).length;
        /* "Alternatively, the attacker may rout the defender's forces" (p. 53) — the
           clause is the attacker's alone. Breaking the landing does not win the
           battle for the defender; holding the ground at the end does. */
        if (routed(state, def)) return { winner: atk, text: atk + ' routs the defenders off their own ground.' };
        if (rollEnd(state, 12)) {
          if (mineZ >= 2) return { winner: atk, text: atk + ' holds ' + mineZ + ' of the three landing zones — the beachhead is secure.' };
          return { winner: def, text: def + ' still holds the ground — the landing has failed.' };
        }
      }
    },

    /* --------------------------------------------------------- Demolish (p. 54) */
    demolish: {
      id: 'demolish', name: 'Demolish', page: 54,
      blurb: 'One company has to bring a structure down; the other has to keep it standing.',
      win: 'Attacker: destroy the objective. Defender: keep it standing to the end of turn 12. Neither side wins by routing the other.',
      turns: 12,
      attacker: true,
      roles: {
        attacker: 'As the attacker you come on around the three corners that are yours and have twelve turns to bring the objective down.',
        defender: 'As the defender you set up half your force within 18" of the objective and hold the fourth corner; the other half arrives on a 5+ from turn 2.'
      },
      objectives: function (state) {
        // the defender sets it within 4" of the table centre
        var a = Math.random() * Math.PI * 2, r = Math.random() * 4;
        var cx = clamp(W / 2 + Math.cos(a) * r, 10, W - 10);
        var cy = clamp(H / 2 + Math.sin(a) * r, 10, H - 10);
        state.sc.target = { kind: 'objective', x: cx - 2, y: cy - 2, w: 4, h: 4, cx: cx, cy: cy };
        state.terrain = state.terrain.filter(function (t) {
          return dist(t.x + t.w / 2, t.y + t.h / 2, cx, cy) > 6;
        });
        state.terrain.push(state.sc.target);
        return [{ x: cx, y: cy }];
      },
      deploy: function (state) {
        var atk = state.sc.attacker, def = atk === 'A' ? 'B' : 'A';
        var t = state.sc.target;
        // the table edges within 12" of the corner nearest the objective are the
        // defender's; everything else belongs to the attacker
        var corner = CORNERS.slice().sort(function (p, q) {
          return dist(p.x, p.y, t.cx, t.cy) - dist(q.x, q.y, t.cx, t.cy);
        })[0];
        state.sc.corner = corner;
        // half the defenders deploy within 18" of the objective, the rest wait
        var defs = mine(state, def).filter(function (u) { return !u.reserve; });
        var split = halve(defs);
        split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        state.sc.zones = {};
        state.sc.zones[def] = null;               // a circle, not a strip
        state.sc.zones[atk] = null;               // corner bands, not a strip
        state.sc.defCircle = { x: t.cx, y: t.cy, r: 18 };
        /* The table edges within 12" of the corner nearest the objective are the
           defender's; the edges around every other corner are the attacker's. */
        var atkBands = [];
        CORNERS.forEach(function (c) {
          if (c.x === corner.x && c.y === corner.y) return;
          atkBands = atkBands.concat(cornerBands(c, 12, 6));
        });
        state.sc.boxes = {};
        state.sc.boxes[atk] = atkBands;
        state.sc.entry = {};
        state.sc.entry[atk] = atkBands;
        state.sc.entry[def] = cornerBands(corner, 12, 6);
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      deployOK: function (state, side, x, y) {
        if (side === state.sc.attacker) return null;   // its corner bands apply
        var c = state.sc.defCircle;
        return dist(x, y, c.x, c.y) <= c.r;
      },
      hint: 'The objective at the centre has to come down. Any attacking infantry may Demolish it — Sappers at +4, everyone else at +2. The attacker comes in around three corners; the defender owns the fourth. Breaking the enemy wins nothing here.',
      reserves: function (state, side) {
        if (side === state.sc.attacker || state.turn < 2) return [];
        return state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve && d6() >= 5;
        });
      },
      /* The SAM system: any aircraft finishing its move within 12" of the objective
         is shot at immediately with Basic Firepower 12, whatever else is going on. */
      onMoveEnd: function (state, u) {
        if (!R.isFlying(u)) return null;
        var t = state.sc.target;
        if (!t || dist(u.x, u.y, t.cx, t.cy) > 12) return null;
        var sam = {
          label: 'The objective’s SAM system', side: u.side === 'A' ? 'B' : 'A', alive: true,
          models: 1, fp: 12, range: 48, rules: [], x: t.cx, y: t.cy, shotFrom: [], cls: 'infantry'
        };
        return R.shoot(state, sam, u, 'basic', {});
      },
      check: function (state) {
        var atk = state.sc.attacker, def = atk === 'A' ? 'B' : 'A';
        var standing = state.terrain.some(function (t) { return t.kind === 'objective'; });
        // p. 54 has no rout clause: the objective either comes down or it does not
        if (!standing) return { winner: atk, text: atk + ' brings the objective down.' };
        if (state.turn >= 12) return { winner: def, text: 'Twelve turns and the objective still stands.' };
      }
    },

    /* -------------------------------------------------- Hostile takeover (p. 55) */
    takeover: {
      id: 'takeover', name: 'Hostile takeover', page: 55,
      blurb: 'A prepared position at the centre of the table, and twenty turns to take it.',
      win: 'Attacker: control the objective at the End phase of turn 20. Defender: keep them off it. Neither side wins by routing the other.',
      turns: 20,
      attacker: true,
      roles: {
        attacker: 'As the attacker you come on from any table edge you like, half at once and the other half from turn 3, and have to be standing on the objective at the end of turn 20.',
        defender: 'As the defender you set up within 12" of the objective, behind up to ten wall sections and a bunker of your own.'
      },
      objectives: function (state) {
        var cx = W / 2, cy = H / 2;
        state.sc.centre = { x: cx, y: cy };
        return [{ x: cx, y: cy }];
      },
      setupTerrain: function (state) {
        // the defender digs in: walls and a bunker within 12" of the objective
        var c = state.sc.centre;
        state.terrain = state.terrain.filter(function (t) {
          return dist(t.x + t.w / 2, t.y + t.h / 2, c.x, c.y) > 3;
        });
        var n = 6 + Math.floor(Math.random() * 5);           // up to ten sections
        for (var i = 0; i < n; i++) {
          var a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
          var r = 6 + Math.random() * 5;
          var horiz = Math.abs(Math.cos(a)) < 0.6;
          var len = 3 + Math.floor(Math.random() * 4);       // no section over 6"
          /* "trench, wall or barbed wire sections" (p. 55): low walls to fight
             behind, trenches to fight from, and wire further out to slow them. */
          var pick = Math.random(), kind = pick < 0.45 ? 'barricade' : pick < 0.75 ? 'trench' : 'wire';
          var thick = kind === 'trench' ? 1.6 : 1;
          if (kind === 'wire') r += 1;
          state.terrain.push({
            kind: kind,
            x: clamp(c.x + Math.cos(a) * r - (horiz ? len / 2 : thick / 2), 2, W - len - 2),
            y: clamp(c.y + Math.sin(a) * r - (horiz ? thick / 2 : len / 2), 2, H - len - 2),
            w: horiz ? len : thick, h: horiz ? thick : len
          });
        }
        var ba = Math.random() * Math.PI * 2;
        state.terrain.push({
          kind: 'bunker',
          x: clamp(c.x + Math.cos(ba) * 8 - 2, 2, W - 6),
          y: clamp(c.y + Math.sin(ba) * 8 - 2, 2, H - 6), w: 4, h: 4
        });
      },
      deploy: function (state) {
        var atk = state.sc.attacker, def = atk === 'A' ? 'B' : 'A';
        var atks = mine(state, atk).filter(function (u) { return !u.reserve; });
        var split = halve(atks);
        split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        state.sc.zones = {};
        state.sc.zones[def] = null;
        state.sc.zones[atk] = null;
        state.sc.defCircle = { x: state.sc.centre.x, y: state.sc.centre.y, r: 12 };
        /* "The first part enters the table in the Reserve phase of the 1st turn from
           any table edge chosen by the attacker… The second part may enter in any
           turn starting from the 3rd from any table edge" (p. 55). Every edge is the
           attacker's, which is what makes this attack hard to face. */
        state.sc.boxes = {};
        state.sc.boxes[atk] = edgeBands(6);
        state.sc.entry = {};
        state.sc.entry[atk] = edgeBands(2);
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      deployOK: function (state, side, x, y) {
        if (side === state.sc.attacker) return null;
        var c = state.sc.defCircle;
        return dist(x, y, c.x, c.y) <= c.r;
      },
      hint: 'One objective at the centre, dug in behind walls and a bunker. The attacker has twenty turns to be standing on it — nothing else counts.',
      reserves: function (state, side) {
        if (side !== state.sc.attacker || state.turn < 3) return [];
        return state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve && u.wave === 2;
        });
      },
      check: function (state) {
        var atk = state.sc.attacker, def = atk === 'A' ? 'B' : 'A';
        var c = state.sc.centre;
        var holder = holderOf(state, c.x, c.y, 4);
        state.objectives[0].owner = holder;
        // p. 55 has no rout clause: only who stands on the objective at turn 20 counts
        if (state.turn >= 20) {
          if (holder === atk) return { winner: atk, text: atk + ' holds the position at the end of turn 20.' };
          return { winner: def, text: 'Twenty turns, and the position is still theirs.' };
        }
      }
    }
  };

  var ORDER = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];

  /* Prepare a scenario for a fresh battle. Called once, after the terrain is
     generated and the units exist but before anything is deployed. */
  /* The attacker/defender roll, with The Best Defence is Good Offence (S1) on top.
     It lives on its own because a campaign settles the roles when it offers the
     contract, so the player knows which side of the fight they are taking on
     before they pick the force for it — and then hands the answer back here. */
  function rollRoles(id, docs, forced) {
    var s = SCENARIOS[id] || SCENARIOS.secure;
    if (!s.attacker) return null;
    var atk = forced || (Math.random() < 0.5 ? 'A' : 'B');
    var def = atk === 'A' ? 'B' : 'A';
    docs = docs || {};
    var defHas = (docs[def] || []).indexOf('S1') >= 0;
    var atkHas = (docs[atk] || []).indexOf('S1') >= 0;
    var bd = null;
    if (defHas && !atkHas) {
      var roll = d6();
      bd = { side: def, roll: roll, swapped: roll >= 2 };
      if (roll >= 2) { var t = atk; atk = def; def = t; }
    }
    return { attacker: atk, defender: def, bestDefence: bd };
  }

  function begin(state, id, opts) {
    opts = opts || {};
    var s = SCENARIOS[id] || SCENARIOS.secure;
    state.scen = s;
    state.sc = { id: s.id, hold: {}, streak: {}, lastEndRoll: null };
    if (s.attacker) {
      // already settled when the contract was taken, or rolled here and now
      var roles = opts.roles || rollRoles(id, state.doctrines, opts.attacker);
      state.sc.attacker = roles.attacker;
      state.sc.defender = roles.defender;
      if (roles.bestDefence) state.sc.bestDefence = roles.bestDefence;
    }
    var pts = s.objectives(state) || [];
    state.objectives = pts.map(function (p) { return { x: p.x, y: p.y, owner: null }; });
    if (s.setupTerrain) s.setupTerrain(state);
    lastStandBarricades(state);
    separateTerrain(state);
    return s;
  }

  function deploy(state) { if (state.scen.deploy) state.scen.deploy(state); }
  function zoneFor(state, side) {
    return (state.scen.zoneFor && state.scen.zoneFor(state, side)) || strip(side, 6);
  }
  /* true / false when the scenario has an opinion, null to fall back to the strip. */
  function deployOK(state, side, x, y, u) {
    if (!state.scen.deployOK) return null;
    return state.scen.deployOK(state, side, x, y, u);
  }
  function reserves(state, side) {
    return state.scen.reserves ? (state.scen.reserves(state, side) || []) : [];
  }
  /* Every End phase: the automatic victory of p. 49 comes first, because it holds
     in every scenario — including the three that have no rout clause of their own —
     and then the scenario's own conditions. Both sides meeting a condition in the
     same End phase is a draw (p. 49), which each scenario's check already handles. */
  function check(state) {
    var ga = annihilated(state, 'A'), gb = annihilated(state, 'B');
    if (ga && gb) return { winner: null, text: 'Neither company has anything left on the table — a draw.' };
    if (gb) return { winner: 'A', text: 'B is destroyed to the last unit — an automatic victory for A.' };
    if (ga) return { winner: 'B', text: 'A is destroyed to the last unit — an automatic victory for B.' };
    return state.scen.check(state);
  }
  function noInsertion(state) { return !!state.scen.noInsertion; }

  /* "Check the area!" (p. 52): a unit within 4" of an unchecked location rolls a
     D6 — the first needs a 5+, the second a 4+, the third finds it outright. */
  function searchSpots(state, u) {
    if (!state.sc || !state.sc.search || state.sc.found) return [];
    return state.sc.search.filter(function (s) {
      return !s.checked && dist(u.x, u.y, s.x, s.y) <= 4 + R.UNIT_R;
    });
  }
  function checkArea(state, u, spot) {
    var order = state.sc.order;
    var need = order === 0 ? 5 : order === 1 ? 4 : 1;
    var roll = d6();
    spot.checked = true;
    if (spot.piece) spot.piece.checked = true;
    state.sc.order = order + 1;
    var found = roll >= need;
    if (found) {
      state.sc.found = spot;
      if (spot.piece) spot.piece.found = true;
      state.objectives = [{ x: spot.x, y: spot.y, owner: null }];
      /* "When the true objective location is identified, the remaining unchecked
         ones are false and cannot be checked" (p. 52). */
      state.sc.search.forEach(function (s) {
        if (s !== spot && s.piece) { s.piece.checked = true; s.piece.cold = true; }
      });
    }
    return { roll: roll, need: need, found: found, order: order + 1 };
  }

  root.PMCScen = {
    SCENARIOS: SCENARIOS, ORDER: ORDER,
    begin: begin, deploy: deploy, zoneFor: zoneFor, deployOK: deployOK,
    reserves: reserves, check: check, noInsertion: noInsertion,
    holderOf: holderOf, routed: routed, annihilated: annihilated, inBoxes: inBoxes,
    rollRoles: rollRoles,
    searchSpots: searchSpots, checkArea: checkArea
  };
})(typeof window !== 'undefined' ? window : global);
