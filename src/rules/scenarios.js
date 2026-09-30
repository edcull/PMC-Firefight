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
  /* A reserve die for `side`: Coordinated Hive (p. 124) re-rolls one that
     failed, and the re-rolls are counted for the log. */
  function reserveDie(state, side, need) {
    if (d6() >= need) return true;
    if (!state.doctrines || (state.doctrines[side] || []).indexOf('BB1') < 0) return false;
    state.sc.hive = state.sc.hive && state.sc.hive.turn === state.turn ? state.sc.hive : { turn: state.turn, side: side, n: 0, up: 0 };
    state.sc.hive.n++;
    var ok = d6() >= need;
    if (ok) state.sc.hive.up++;
    return ok;
  }
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
  /* How a side's force was split before the battle, so its player can change
     which units go where: 'hold' is on the table or held back, 'wave' the first
     wave or the second. `min`-`max` is how many the rule lets them hold back (or
     put in the second wave); an emplaced gun is never held back (p. 94). */
  function noteSplit(state, side, kind, units, min, max, rule) {
    /* The split the scenario made is always allowed — an emplaced gun going on
       the table first can leave it a unit short of an exact half — and nobody
       can hold back more than the units that are free to be held. */
    var held = units.filter(function (u) { return u.wave === 2; }).length;
    var free = units.filter(function (u) { return !R.has(u, 'Stationary Artillery'); }).length;
    min = Math.min(min, held);
    max = Math.max(Math.min(max, free), held);
    state.sc.split = state.sc.split || {};
    state.sc.split[side] = { kind: kind, ids: units.map(function (u) { return u.id; }), min: min, max: max, rule: rule };
  }
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
      if (state.manualLaststand && state.manualLaststand[side]) return;   // a player puts theirs down by hand
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
      for (var k = 0; k < kept.length; k++) {
        // a piece standing on a hill overlaps it by design (p. 42)
        if (p.onHill && kept[k].kind === 'hill' && clashes(p, kept[k])) continue;
        if (kept[k].onHill && p.kind === 'hill' && clashes(kept[k], p)) continue;
        if (clashes(p, kept[k])) return false;
      }
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
        // walls and trenches keep their size: trimmed, they would not hold a squad
        var lin = t.kind === 'barricade' || t.kind === 'wall' || t.kind === 'trench';
        var w = lin ? t.w : Math.max(2, t.w * sc);
        var h = lin ? t.h : Math.max(2, t.h * sc);
        if (sc < 1 && lin) break;
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
  var onTable = R.onTable;
  function unsuppressed(u) { return R.status(u) === 'ready'; }

  /* Who holds an objective (p. 49): "at least one unsuppressed, unbroken unit
     within 4" from the marked objective, and no enemy units within 4" from it
     (Broken units and flying units do not count)". Distances run from the token's
     edge to the objective's: a marker is a point, but an area objective (`area`:
     a circle { r }, or a piece { rect }) is measured from its own edge, and "in
     case of area objectives, count units within them first, and only if there
     are no units in the objective, take into account units within 4"". */
  function holderOf(state, x, y, radius, area) {
    var reach = radius || 4;
    function gap(u) {
      var d;
      if (area && area.rect) d = R.rectPointDist(area.rect, u.x, u.y);
      else d = Math.max(0, dist(u.x, u.y, x, y) - (area && area.r || 0));
      return Math.max(0, d - R.UNIT_R);
    }
    function inside(u) {
      if (!area) return false;
      if (area.rect) return R.rectPointDist(area.rect, u.x, u.y) === 0;
      return dist(u.x, u.y, x, y) <= area.r;
    }
    // who counts at all: on the table, on the ground, able to hold it, and not Broken
    var near = state.units.filter(function (u) {
      if (!onTable(u) || R.isFlying(u)) return false;
      if (!R.holdsGround(u)) return false;         // a drop pod holds nothing (p. 79)
      return R.status(u) !== 'broken' && gap(u) <= reach;
    });
    var within = near.filter(inside);
    if (within.length) near = within;
    // a Suppressed enemy cannot hold the point, but still denies it
    var claim = { A: 0, B: 0 }, deny = { A: 0, B: 0 };
    near.forEach(function (u) {
      if (unsuppressed(u)) claim[u.side]++;
      deny[u.side]++;
    });
    return claim.A > 0 && deny.B === 0 ? 'A' : (claim.B > 0 && deny.A === 0 ? 'B' : null);
  }
  // the area an objective covers, if it is not a marker: a landing zone's circle, a search site's piece
  function areaOf(o) {
    if (!o) return null;
    if (o.r) return { r: o.r };
    if (o.rect) return { rect: o.rect };
    if (o.piece) return { rect: o.piece };
    return null;
  }
  // a piece's outline alone, to keep with an objective without keeping the piece
  function rectOf(p) { return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null; }

  /* Rout: half a side's units destroyed or fled — units, whatever their Tier
     (p. 49), so a turret set is as many units as it has turrets, and the free
     turrets, extra waves and anything spawned in the battle count as well. That
     is every unit the side has had, so the tally is taken from the units rather
     than from the army list. Units still in reserve count as perfectly fine
     (p. 49): they are part of the tally and not losses. */
  function routed(state, side) {
    var started = 0, left = 0;
    state.units.forEach(function (u) {
      if (u.side !== side) return;
      /* A Rapid insertion platform "does not count towards victory conditions"
         (p. 79), so it is in neither the tally nor the losses. */
      if (!R.countsForVictory(u)) return;
      /* Expendable troops, "when destroyed ... do not count as a casualty for
         the purposes of victory conditions" (p. 57) — however they went. */
      if (!u.alive && (u.expended || R.has(u, 'Expendable'))) return;
      started++;
      if (u.alive) left++;
    });
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
    // +1 a turn: five turns on, any roll ends it
    var need = Math.max(1, 6 - (state.turn - after));
    var roll = d6();
    state.sc.lastEndRoll = { roll: roll, need: need };
    return roll >= need;
  }

  /* A strip on one table edge. */
  function strip(side, depth) {
    return side === 'A' ? [R.UNIT_R, depth] : [W - depth, W - R.UNIT_R];
  }

  /* The scenarios where both companies enter in turn 1's Reserve phase (pp. 50-52):
     nothing is placed before the battle, and each unit comes on "up to 4\" from the
     table border and at least 12\" from the enemy" (p. 30) along its own edge — the
     west for A, the east for B, the table having been turned to the edges rolled. */
  var ENTRY_TEXT = 'Nobody deploys before the battle: your units enter from your own table edge in the Reserve phase of turn 1, a unit at a time in turn with the enemy, from the side with the initiative — within 4\" of the edge and 12\" clear of the enemy where the ground allows.';
  function entryEdges(state) {
    state.sc.zones = { A: strip('A', 4), B: strip('B', 4) };
    state.sc.entry = { A: [{ x: 0, y: 0, w: 4, h: H }], B: [{ x: W - 4, y: 0, w: 4, h: H }] };
  }
  // the units held to enter in turn 1 (wave 1): a hull brings whoever is aboard it
  function entering(state, side) {
    if (state.turn !== 1) return [];
    return state.units.filter(function (u) {
      return u.side === side && u.alive && u.reserve && u.wave === 1 && !u.aboard;
    });
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

  /* ---------- Hostile takeover's fortifications (p. 55) ---------- */
  var FORT_SECTIONS = 10, FORT_REACH = 12, FORT_MAX = 6;
  // the ground each kind covers: a trench as wide as a squad's base, the rest a line
  var FORT_KINDS = { trench: 2, barricade: 1, wall: 1, wire: 1 };
  function fortRect(kind, x, y, len, vertical) {
    if (kind === 'bunker') return { kind: 'bunker', x: x - 2, y: y - 2, w: 4, h: 4 };
    var th = FORT_KINDS[kind] || 1;
    len = Math.max(2, Math.min(FORT_MAX, len || FORT_MAX));
    return vertical ? { kind: kind, x: x - th / 2, y: y - len / 2, w: th, h: len }
      : { kind: kind, x: x - len / 2, y: y - th / 2, w: len, h: th };
  }
  /* Why a piece may not go there, or null: the whole of it within 12" of the
     objective, clear of the objective itself, of the table edge, of the other
     terrain and of any troops. */
  function fortWhy(state, r) {
    var c = state.sc.centre;
    if (r.x < 0.5 || r.y < 0.5 || r.x + r.w > W - 0.5 || r.y + r.h > H - 0.5) return 'Not so close to the edge.';
    var far = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].some(function (q) { return dist(q[0], q[1], c.x, c.y) > FORT_REACH; });
    if (far) return 'All of it within 12" of the objective.';
    if (R.rectPointDist(r, c.x, c.y) < 2) return 'Not on the objective itself.';
    if (state.terrain.some(function (o) { return o.kind !== 'hill' && clashes(r, o); })) return 'That ground is taken.';
    if (state.units.some(function (o) { return o.alive && o.x >= 0 && R.rectPointDist(r, o.x, o.y) < 1; })) return 'Troops are standing there.';
    return null;
  }
  /* The machine's position — or the rest of a player's, from the auto button:
     `sections` more sections and `bunkers` more bunkers. The bunker goes on the
     side facing the attacker's likeliest approach, 6-9" out; the sections ring
     the objective across the lines of approach, trenches and low walls to fight
     from, a high wall or two to hide behind, and wire further out to slow them.
     Returns what was put down. */
  function takeoverForts(state, side, sections, bunkers) {
    var c = state.sc.centre, laid = [];
    function tryPut(kind, a, r, len, jitter) {
      for (var k = 0; k < 40; k++) {
        var aa = a + (Math.random() - 0.5) * jitter * (1 + k / 10), rr = r + (Math.random() - 0.5) * (k / 8);
        var x = c.x + Math.cos(aa) * rr, y = c.y + Math.sin(aa) * rr;
        // running across the line to the objective, not along it
        var vertical = Math.abs(Math.cos(aa)) > Math.abs(Math.sin(aa));
        var q = fortRect(kind, x, y, len, vertical);
        if (fortWhy(state, q)) continue;
        state.terrain.push(q); laid.push(q);
        return q;
      }
      // that line of approach is crowded: anywhere else in the circle that is clear
      for (var m = 0; m < 300; m++) {
        var ma = Math.random() * Math.PI * 2, mr = 3 + Math.random() * 9;
        var mq = fortRect(kind, c.x + Math.cos(ma) * mr, c.y + Math.sin(ma) * mr, m < 150 ? len : 3, Math.random() < 0.5);
        if (fortWhy(state, mq)) continue;
        state.terrain.push(mq); laid.push(mq);
        return mq;
      }
      return null;
    }
    var base = Math.random() * Math.PI * 2;
    for (var b = 0; b < bunkers; b++) tryPut('bunker', base + b * Math.PI, 6 + Math.random() * 3, 4, 1.2);
    for (var i = 0; i < sections; i++) {
      var pick = Math.random();
      var kind = pick < 0.35 ? 'trench' : pick < 0.65 ? 'barricade' : pick < 0.8 ? 'wall' : 'wire';
      var a = base + (i / Math.max(1, sections)) * Math.PI * 2 + 0.4;
      var r = kind === 'wire' ? 9.5 + Math.random() * 1 : 5 + Math.random() * 4;
      tryPut(kind, a, r, 4 + Math.floor(Math.random() * 3), 0.5);
    }
    return laid;
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
      entersTurn1: true,       // "All player's units enter the table from his/her table edge in the Reserve phase of the 1st turn"
      deploy: function (state) { entryEdges(state); },
      reserves: function (state, side) { return entering(state, side); },
      deployText: function () { return ENTRY_TEXT; },
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
      entersTurn1: true,       // as Meeting engagement: everyone enters in turn 1's Reserve phase (p. 51)
      deploy: function (state) {
        entryEdges(state);
        state.sc.streak = { A: { key: '', n: 0 }, B: { key: '', n: 0 } };
      },
      reserves: function (state, side) { return entering(state, side); },
      deployText: function () { return ENTRY_TEXT; },
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
      /* "In the first Reserve phase, each player deploys their first half from their
         table edge using standard rules for reserves" (p. 52) */
      entersTurn1: true,
      deployText: function () { return ENTRY_TEXT.replace('your units enter', 'the first half of your force enters'); },
      deploy: function (state) {
        entryEdges(state);
        // half the force enters at once; the rest waits in reserve
        ['A', 'B'].forEach(function (side) {
          var all = mine(state, side).filter(function (u) { return !u.reserve; });
          var split = halve(all);
          split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
          noteSplit(state, side, 'hold', all, Math.floor(all.length / 2), Math.ceil(all.length / 2),
            'Half the force enters at once; the rest waits in reserve.');
        });
        state.sc.hold = { A: 0, B: 0 };
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      hint: 'Three staked locations. Bring a unit within 4" and use "Check the area!" — 5+ at the first, 4+ at the second; miss both and the third gives itself away.',
      /* From turn 3, every second turn, up to the Priority Level in units may come
         on (p. 52) — how many, and which, is the player's choice. */
      reservePick: function (state, side) {
        if (state.turn < 3 || state.turn % 2 === 0) return null;
        var pool = state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve && u.wave === 2;
        });
        var n = Math.min(state.cfg.pl, pool.length);
        // "may deploy": up to that many, and none at all if the player would rather wait
        return pool.length ? { pool: pool, min: 0, max: n,
          text: 'Up to ' + n + ' unit' + (n === 1 ? '' : 's') + ' (the Priority Level) may come on from reserve this turn. You choose which — or none.' } : null;
      },
      // the first half in turn 1; from turn 3, every second turn, a number equal to the Priority Level comes on
      reserves: function (state, side) {
        if (state.turn === 1) return entering(state, side);
        if (state.turn < 3 || state.turn % 2 === 0) return [];
        return state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve && u.wave === 2;
        }).slice(0, state.cfg.pl);
      },
      check: function (state) {
        var found = state.sc.found;
        var holder = found ? holderOf(state, found.x, found.y, 4, areaOf(found)) : null;
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
      /* The landing zones are the objectives, and the attacker only nominates
         them once the defender is down (p. 53): the table starts with none. */
      objectives: function (state) { state.sc.lzPending = true; return []; },
      deploy: function (state) {
        var atk = state.sc.attacker, def = state.sc.attacker === 'A' ? 'B' : 'A';
        // the defender puts no more than a third on the table, 6" in from the edges
        var defs = mine(state, def).filter(function (u) { return !u.reserve; });
        // an emplaced gun is already dug in, so it is never among those held back
        defs.sort(function (a, b) {
          return (R.has(b, 'Stationary Artillery') ? 1 : 0) - (R.has(a, 'Stationary Artillery') ? 1 : 0);
        });
        var keep = Math.max(1, Math.ceil(defs.length / 3));          // divisions round up (p. 17)
        defs.slice(keep).forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        noteSplit(state, def, 'hold', defs, defs.length - keep, defs.length - 1,
          'Up to a third of the force sets up on the table; the rest walks on later, on a 5+ a unit from turn 2.');
        // the attacker comes in two waves; the first lands in the Reserve phase of turn 1
        var atks = mine(state, atk).filter(function (u) { return !u.reserve; });
        var split = halve(atks);
        split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        split.first.forEach(function (u) { u.reserve = true; u.wave = 1; u.x = -1; u.y = -1; });
        noteSplit(state, atk, 'wave', atks, Math.floor(atks.length / 2), Math.ceil(atks.length / 2),
          'The force comes down in two waves: the first on turn 1, the second from turn 4 on a roll.');
        state.sc.zones = {};
        state.sc.zones[def] = [6, W - 6];         // anywhere 6" in from the edges
        state.sc.zones[atk] = null;               // the attacker never deploys: it lands
        state.sc.inset = 6;
        /* "the unit enters the table from a random table edge (but from a point
           nominated by the defender)" (p. 53) — not from a side of their own. */
        state.sc.entry = {};
        state.sc.entry[def] = edgeBands(2);
        state.sc.randomEdge = {};
        state.sc.randomEdge[def] = true;
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
          /* The second wave comes down together, on one D6 for the lot (p. 53): 5+
             on turn 4, and +1 to the roll every turn after — certain by turn 8. */
          var need = 5 - (state.turn - 4);
          var wave2 = pool.filter(function (u) { return u.wave === 2; });
          if (!wave2.length) return [];
          return need <= 1 || reserveDie(state, side, need) ? wave2 : [];
        }
        if (state.turn < 2) return [];
        return pool.filter(function () { return reserveDie(state, side, 5); });
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
        state.objectives.forEach(function (o) { o.owner = holderOf(state, o.x, o.y, 4, areaOf(o)); });
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
        // whatever stood there is moved off it (separateTerrain), not taken away
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
        noteSplit(state, def, 'hold', defs, Math.floor(defs.length / 2), Math.ceil(defs.length / 2),
          'Half the force sets up within 18" of the objective; the rest arrives on a 5+ a unit from turn 2.');
        /* "On Priority Level 2 and higher, the attacker may hold some of his/her
           units in reserve. On Priority Level 2, these reserve units may enter the
           battlefield in the 2nd turn... on Priority Level 3 in the 2nd and/or 3rd
           turn, and so on" (p. 54). Nothing is held unless the player chooses it,
           and at least one unit has to come on at the start. */
        var pl = state.cfg.pl || 1;
        if (pl >= 2) {
          var atks = mine(state, atk).filter(function (u) { return !u.reserve; });
          noteSplit(state, atk, 'hold', atks, 0, Math.max(0, atks.length - 1),
            'You may hold units back; they come on from your table edges on turn 2' +
            (pl > 2 ? ' to ' + pl + ', as you choose' : '') + '.');
        }
        state.sc.zones = {};
        state.sc.zones[def] = null;               // a circle, not a strip
        state.sc.zones[atk] = null;               // corner bands, not a strip
        state.sc.defCircle = { x: t.cx, y: t.cy, r: 18 };
        /* The table edges within 12" of the corner nearest the objective are the
           defender's; the edges around every other corner are the attacker's. */
        var atkBands = [];
        CORNERS.forEach(function (c) {
          if (c.x === corner.x && c.y === corner.y) return;
          // reserves come on "up to 4" from the table border" (p. 27): the whole base inside 4"
          atkBands = atkBands.concat(cornerBands(c, 12, 4 - R.UNIT_R));
        });
        state.sc.boxes = {};
        state.sc.boxes[atk] = atkBands;
        state.sc.entry = {};
        state.sc.entry[atk] = atkBands;
        state.sc.entry[def] = cornerBands(corner, 12, 4 - R.UNIT_R);
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      deployOK: function (state, side, x, y) {
        if (side === state.sc.attacker) return null;   // its corner bands apply
        var c = state.sc.defCircle;
        return dist(x, y, c.x, c.y) <= c.r;
      },
      hint: 'The objective at the centre has to come down. Any attacking infantry may Demolish it — Sappers at +4, everyone else at +2. The attacker comes in around three corners; the defender owns the fourth. Breaking the enemy wins nothing here.',
      /* The attacker's held units come on in turns 2 to the Priority Level, as
         many as the player likes each turn; what is still waiting on the last of
         those turns comes on then. */
      reservePick: function (state, side) {
        var pl = state.cfg.pl || 1;
        if (side !== state.sc.attacker || state.turn < 2 || state.turn > pl) return null;
        var pool = state.units.filter(function (u) { return u.side === side && u.alive && u.reserve && u.wave === 2; });
        if (!pool.length) return null;
        var last = state.turn >= pl;
        return { pool: pool, min: last ? pool.length : 0, max: pool.length,
          text: last ? 'The last of your reserves come on this turn.' : 'Bring on as many of your reserves as you like this turn — the rest by turn ' + pl + '.' };
      },
      reserves: function (state, side) {
        if (side === state.sc.attacker) {
          // an AI attacker that held anything back brings it all on at turn 2
          if (state.turn < 2) return [];
          return state.units.filter(function (u) { return u.side === side && u.alive && u.reserve && u.wave === 2; });
        }
        if (state.turn < 2) return [];
        return state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve && reserveDie(state, side, 5);
        });
      },
      /* The SAM system: any aircraft finishing its move within 12" of the objective
         is shot at immediately with Basic Firepower 12, whatever else is going on. */
      onMoveEnd: function (state, u) {
        if (!R.isFlying(u)) return null;
        var t = state.sc.target;
        // closer than 12" to the objective: its edge (a 4" piece) to the craft's (p. 54)
        if (!t || R.rectPointDist(t, u.x, u.y) - R.UNIT_R > 12) return null;
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
        attacker: 'As the attacker you come on along a table edge you choose with half your force, the other half from any edge from turn 3, and have to be standing on the objective at the end of turn 20.',
        defender: 'As the defender you put up to ten trench, wall and wire sections and a bunker within 12" of the objective, then set up within 12" of it.'
      },
      objectives: function (state) {
        var cx = W / 2, cy = H / 2;
        state.sc.centre = { x: cx, y: cy };
        return [{ x: cx, y: cy }];
      },
      /* "the defender may place up to 10 trenches, walls and/or barbed wire
         sections (up to 6" long each), as well as a single bunker" within 12" of
         the objective (p. 55). A player puts them down by hand before deploying
         (engine: placeAsk 'fort'); the machine's are laid here, once the rest of
         the terrain has been settled round the objective. */
      fortify: function (state) {
        var def = state.sc.defender;
        if (state.manualForts && state.manualForts[def]) { state.sc.fortsByHand = true; return; }
        takeoverForts(state, def, FORT_SECTIONS, 1);
      },
      deploy: function (state) {
        var atk = state.sc.attacker, def = atk === 'A' ? 'B' : 'A';
        var atks = mine(state, atk).filter(function (u) { return !u.reserve; });
        var split = halve(atks);
        split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
        noteSplit(state, atk, 'hold', atks, Math.floor(atks.length / 2), Math.ceil(atks.length / 2),
          'Half the force comes on at once; the other half may come on in any turn from the 3rd.');
        state.sc.zones = {};
        state.sc.zones[def] = null;
        state.sc.zones[atk] = null;
        state.sc.defCircle = { x: state.sc.centre.x, y: state.sc.centre.y, r: 12 };
        /* "The first part enters the table in the Reserve phase of the 1st turn from
           any table edge chosen by the attacker… The second part may enter in any
           turn starting from the 3rd from any table edge" (p. 55). Every edge is the
           attacker's, which is what makes this attack hard to face. */
        var bands = edgeBands(6);
        for (var i = bands.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bands[i]; bands[i] = bands[j]; bands[j] = t; }
        state.sc.boxes = {};
        state.sc.boxes[atk] = bands;
        state.sc.entry = {};
        state.sc.entry[atk] = edgeBands(2);
      },
      /* The first part comes on "from any table edge chosen by the attacker" —
         one edge (p. 55): the first unit down chooses it, and the rest of the
         first part goes along the same edge. Picked up again, the choice is open
         again. `u`, when given, is the unit being placed, which does not count. */
      boxes: function (state, side, u) {
        var all = state.sc.boxes && state.sc.boxes[side];
        if (!all || side !== state.sc.attacker || state.phase !== 'deploy') return all;
        var down = state.units.filter(function (x) {
          return x.side === side && x !== u && x.alive && x.x >= 0 && !x.aboard && !x.reserve;
        });
        if (!down.length) return all;
        var fit = all.filter(function (b) { return down.every(function (x) { return inBoxes([b], x.x, x.y); }); });
        return fit.length ? fit : all;
      },
      deployText: function (state, side) {
        if (side === state.sc.defender) return 'Place each unit inside the shaded circle — within ' + state.sc.defCircle.r + '" of the objective.';
        return 'Place each unit inside a shaded band. The first unit down chooses the table edge; the rest of the first part comes on along the same edge.';
      },
      zoneFor: function (state, side) { return state.sc.zones[side]; },
      deployOK: function (state, side, x, y) {
        if (side === state.sc.attacker) return null;
        var c = state.sc.defCircle;
        return dist(x, y, c.x, c.y) <= c.r;
      },
      hint: 'One objective at the centre, dug in behind trenches, walls, wire and a bunker. The attacker comes on along one edge, the rest from any edge from turn 3, and has twenty turns to be standing on it — nothing else counts.',
      /* "The second part may enter in any turn starting from the 3rd" (p. 55): the
         attacker brings on as many of it as they like each turn, and which. */
      reservePick: function (state, side) {
        if (side !== state.sc.attacker || state.turn < 3) return null;
        var pool = state.units.filter(function (u) {
          return u.side === side && u.alive && u.reserve && u.wave === 2;
        });
        return pool.length ? { pool: pool, min: 0, max: pool.length,
          text: 'The second part of the force may come on this turn — as many of it as you like, or none yet.' } : null;
      },
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
  /* `ask`: the sides whose player decides for themselves whether to roll (p. 87
     — "the player may decide to roll"). Their roll is left pending, and made by
     bestDefence() if they choose to. */
  function rollRoles(id, docs, forced, ask) {
    var s = SCENARIOS[id] || SCENARIOS.secure;
    if (!s.attacker) return null;
    var atk = forced || (Math.random() < 0.5 ? 'A' : 'B');
    var def = atk === 'A' ? 'B' : 'A';
    docs = docs || {};
    var defHas = (docs[def] || []).indexOf('S1') >= 0;
    var atkHas = (docs[atk] || []).indexOf('S1') >= 0;
    var bd = null;
    if (defHas && !atkHas && ask && ask.indexOf(def) >= 0) {
      bd = { side: def, pending: true };
    } else if (defHas && !atkHas) {
      var roll = d6();
      bd = { side: def, roll: roll, swapped: roll >= 2 };
      if (roll >= 2) { var t = atk; atk = def; def = t; }
    }
    return { attacker: atk, defender: def, bestDefence: bd };
  }
  // the defender's player takes up The Best Defence is Good Offence: a D6, and 2-6 swaps the roles
  function bestDefence(roles) {
    var bd = roles && roles.bestDefence;
    if (!bd || !bd.pending) return roles;
    var roll = d6();
    roles.bestDefence = { side: bd.side, roll: roll, swapped: roll >= 2 };
    if (roll >= 2) { var t = roles.attacker; roles.attacker = roles.defender; roles.defender = t; }
    return roles;
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
    if (s.fortify) s.fortify(state);
    return s;
  }

  function deploy(state) { if (state.scen.deploy) state.scen.deploy(state); }

  /* Invasion's landing zones (p. 53): three 8" circles in open ground, at least
     12" from each other and 8" from every table edge, nominated by the attacker
     after the defender has deployed. */
  function lzOK(state, p, chosen) {
    if (p.x < 8 || p.y < 8 || p.x > W - 8 || p.y > H - 8) return false;
    if (R.terrainAt(state, p.x, p.y) !== 'open') return false;
    return (chosen || []).every(function (q) { return dist(p.x, p.y, q.x, q.y) >= 12; });
  }
  function lzSpots(state, chosen) {
    var out = [];
    for (var x = 8; x <= W - 8; x += 1) for (var y = 8; y <= H - 8; y += 1) {
      if (lzOK(state, { x: x, y: y }, chosen)) out.push({ x: x, y: y });
    }
    return out;
  }
  /* The attacker's own pick: as far from the defenders as it can get, each zone
     in turn, but not so far off to one side that it cannot reach the others. */
  function autoLZs(state) {
    var def = state.sc.attacker === 'A' ? 'B' : 'A';
    var foes = state.units.filter(function (u) { return u.side === def && u.alive && u.x >= 0 && !u.reserve; });
    var chosen = [];
    for (var n = 0; n < 3; n++) {
      var spots = lzSpots(state, chosen);
      if (!spots.length) spots = clusterAt(W / 2, H / 2, 1, 20, 0, null).filter(function (p) { return lzOK(state, p, []); });
      if (!spots.length) spots = [{ x: W / 2 + (n - 1) * 12, y: H / 2 }];
      var best = null, bs = -Infinity;
      spots.forEach(function (p) {
        var near = foes.reduce(function (m, f) { return Math.min(m, dist(p.x, p.y, f.x, f.y)); }, 36);
        var mid = dist(p.x, p.y, W / 2, H / 2);
        var sc = Math.min(near, 30) - mid * 0.35 + Math.random() * 2;
        if (sc > bs) { bs = sc; best = p; }
      });
      chosen.push(best);
    }
    return chosen;
  }
  function setLZs(state, pts) {
    state.objectives = pts.map(function (p) { return { x: p.x, y: p.y, r: 4, owner: null }; });   // "a round area 8\" in diameter" (p. 53)
    state.sc.lzPending = false;
  }
  function zoneFor(state, side) {
    return (state.scen.zoneFor && state.scen.zoneFor(state, side)) || strip(side, 6);
  }
  /* true / false when the scenario has an opinion, null to fall back to the strip. */
  function deployOK(state, side, x, y, u) {
    if (!state.scen.deployOK) return null;
    return state.scen.deployOK(state, side, x, y, u);
  }
  /* A unit held back in the scenario's split that has Battlefield Insertion
     (`insert`) counts toward the reserves the scenario asks for, but comes in by
     insertion from turn 2 (p. 56), not on the scenario's schedule or edges. */
  function reserves(state, side) {
    var r = state.scen.reserves ? (state.scen.reserves(state, side) || []) : [];
    return r.filter(function (u) { return !u.insert; });
  }
  // the reserves a player picks from this turn, where the scenario leaves the choice to them
  function reservePick(state, side) {
    var p = state.scen.reservePick ? state.scen.reservePick(state, side) : null;
    if (p && p.pool) {
      p.pool = p.pool.filter(function (u) { return !u.insert; });
      p.max = Math.min(p.max, p.pool.length); p.min = Math.min(p.min, p.max);
      if (!p.pool.length) return null;
    }
    return p;
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
     D6 — the first needs a 5+, the second a 4+; miss both and the third is it. */
  function searchSpots(state, u) {
    if (!state.sc || !state.sc.search || state.sc.found) return [];
    return state.sc.search.filter(function (s) {
      // within 4" of the location itself — its edge, not its middle
      var edge = s.piece ? R.rectPointDist(s.piece, u.x, u.y) : Math.max(0, dist(u.x, u.y, s.x, s.y) - 2);
      return !s.checked && edge <= 4 + R.UNIT_R;
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
      state.objectives = [{ x: spot.x, y: spot.y, rect: rectOf(spot.piece), owner: null }];
      /* "When the true objective location is identified, the remaining unchecked
         ones are false and cannot be checked" (p. 52). */
      state.sc.search.forEach(function (s) {
        if (s !== spot && s.piece) { s.piece.checked = true; s.piece.cold = true; }
      });
    }
    /* "If the objective is not at the first two locations, it is at the third
       one and no special action is needed to find it" (p. 52). */
    var revealed = null;
    if (!found && order + 1 === 2) {
      revealed = state.sc.search.filter(function (s) { return !s.checked; })[0] || null;
      if (revealed) {
        revealed.checked = true;
        state.sc.found = revealed;
        if (revealed.piece) { revealed.piece.checked = true; revealed.piece.found = true; }
        state.objectives = [{ x: revealed.x, y: revealed.y, rect: rectOf(revealed.piece), owner: null }];
        state.sc.search.forEach(function (s) { if (s !== revealed && s.piece) s.piece.cold = true; });
      }
    }
    return { roll: roll, need: need, found: found, order: order + 1, revealed: revealed };
  }

  root.PMCScen = {
    SCENARIOS: SCENARIOS, ORDER: ORDER,
    begin: begin, deploy: deploy, lzOK: lzOK, lzSpots: lzSpots, autoLZs: autoLZs, setLZs: setLZs, zoneFor: zoneFor, deployOK: deployOK,
    reserves: reserves, reservePick: reservePick, check: check, noInsertion: noInsertion,
    holderOf: holderOf, areaOf: areaOf, routed: routed, annihilated: annihilated, inBoxes: inBoxes,
    rollRoles: rollRoles, bestDefence: bestDefence,
    searchSpots: searchSpots, checkArea: checkArea,
    boxesFor: function (state, side, u) {
      if (state.scen && state.scen.boxes) return state.scen.boxes(state, side, u);
      return (state.sc && state.sc.boxes && state.sc.boxes[side]) || null;
    },
    FORT_SECTIONS: FORT_SECTIONS, FORT_KINDS: FORT_KINDS, fortRect: fortRect, fortWhy: fortWhy, takeoverForts: takeoverForts
  };
})(typeof window !== 'undefined' ? window : global);
