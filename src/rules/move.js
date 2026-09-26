/* PMC 2670 — Firefight : movement: paths, costs, reach and a ground vehicle's drive

   Made once by rules.js, the first time it is wanted. E is what it needs
   of rules.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCMove = function (E) {
    var BOARD = E.BOARD, STEP = E.STEP, TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R, angleWrap = E.angleWrap,
        d6 = E.d6, flyInf = E.flyInf, hasOwn = E.hasOwn, isFlying = E.isFlying, kindsUnder = E.kindsUnder,
        mountOf = E.mountOf, propOf = E.propOf, rectPointDist = E.rectPointDist, sectionRect = E.sectionRect,
        terrainAt = E.terrainAt, unitNear = E.unitNear;
    /* ---------- movement ---------- */
    // 16 directions, so lattice distance tracks a tape measure to about 1%
    var NEI = (function () {
      var out = [];
      for (var di = -2; di <= 2; di++) for (var dj = -2; dj <= 2; dj++) {
        if (!di && !dj) continue;
        if (Math.abs(di) === 2 && Math.abs(dj) !== 1) continue;
        if (Math.abs(dj) === 2 && Math.abs(di) !== 1) continue;
        out.push([di, dj]);
      }
      return out;
    })();
    // each neighbour's length, and the lattice point half way to it (for the long steps)
    var NEI_LEN = NEI.map(function (d) { return STEP * Math.hypot(d[0], d[1]); });
    var NEI_MID = NEI.map(function (d) { return [Math.round(d[0] / 2), Math.round(d[1] / 2)]; });

    // Dijkstra over a half-inch lattice: distance in inches plus 1" for entering
    // difficult terrain, so the reachable area is the real shape of the move.
    // how much a piece of ground costs this unit to enter, and whether it can at all
    /* Protectors in hi-mobility battle armour ("jump-pack powersuits", p. 65) go
       over the ground rather than through it: no terrain penalties, and they can
       clear walls, water, rocks and buildings — but they have to come down on
       ground they could stand on. Unlike Flying Infantry they still take cover
       where they land. */
    function jumps(u) { return !!(u && u.jets && u.cls === 'infantry'); }
    function terrainCost(u, kind) {
      var t = TERRAIN[kind];
      if (isFlying(u) || flyInf(u) || jumps(u)) return 0;   // aircraft, Flying Infantry and jump packs ignore the ground
      var pr = propOf(u);
      if (pr && pr.water && (t.shallow || kind === 'deep')) return 0;   // a hovercraft skims
      // a walker steps through difficult area terrain as infantry does — but a wall or a fence costs it what it costs any hull (p. 180)
      var heavy = u.cls === 'vehicle' && !(pr && pr.footed && !t.linear);
      // Riders (p. 94) lose 2" to rough going where a man on foot loses 1"
      // barbed wire: the extra D6" rolled before the move (p. 42), whatever is crossing
      if (t.wire) return u.wireRoll || 6;
      if (!heavy && hasOwn(u, 'Riders')) {
        var mt = mountOf(u);
        if (mt && mt.smooth) return 0;                         // a grav bike skims it
        if (mt && mt.rough && t.movePenalty && !t.linear) return mt.rough;   // a motorbike bogs down in rough ground
        return t.movePenalty * 2;
      }
      return t.movePenalty * (heavy ? 2 : 1);
    }
    function terrainBars(u, kind) {
      var t = TERRAIN[kind];
      if (isFlying(u) || flyInf(u) || jumps(u)) return false;
      /* Riders (p. 94) cannot cross a linear obstacle nor occupy a building: bikes,
         beasts and grav sleds go around. */
      if (hasOwn(u, 'Riders')) {
        if (kind === 'building' || kind === 'bunker' || kind === 'burning') return true;
        // ...nor cross a wall, unless it rides a horse, which jumps it (Appendix 3)
        var mtL = mountOf(u);
        if (TERRAIN[kind].destructible === 'linear' && !(mtL && mtL.linear)) return true;
      }
      // a vehicle cannot enter a building or cross a high wall either
      if (u.cls === 'vehicle' && (kind === 'building' || kind === 'bunker' || kind === 'burning')) return true;
      // ...though a Tier III-V hull simply drives through a wall and flattens it (p. 35)
      if (u.cls === 'vehicle' && u.tier >= 3 && TERRAIN[kind].destructible === 'linear') return false;
      // below that, a hull crosses no linear obstacle but barbed wire (p. 35)
      if (u.cls === 'vehicle' && TERRAIN[kind].linear && !TERRAIN[kind].wire) return true;
      var pr = propOf(u);
      // a hovercraft skims water and other liquids — but not hot lava
      if (pr && pr.water && kind === 'deep') return false;
      return t.impassable;
    }

    /* Movement penalty (p. 42): 1" (2" for a vehicle) "when crossing a section of
       linear terrain (cumulative – apply penalty for each crossed terrain) or
       moving into or through a piece of area terrain (not cumulative – apply only
       once, irrespective of the distance of the move in area terrain or
       terrains)". So the search runs on two layers — before and after the area
       penalty has been paid — and a unit that starts in area terrain is moving
       through it, so it has paid from the first step. */
    /* The last few fields worked out, by everything that goes into one: the AI
       asks for a unit's reach and then its route over the same ground, and the
       board asks again every time it redraws a preview. */
    var fieldCache = [];
    function fieldKey(state, u, allowance) {
      var k = [u.id, u.key, u.cls, u.x, u.y, u.move, allowance, u.wireRoll, u.bld ? 1 : 0, (u.rules || []).join('/'), state.terrain.length];
      state.units.forEach(function (o) { if (o.alive && !o.aboard && o.side !== u.side && o.x >= 0) k.push(o.x, o.y, o.bld ? 1 : 0); });
      state.terrain.forEach(function (r) { k.push(r.kind, r.x, r.y, r.w, r.h, r.gone ? 1 : 0); });
      return k.join(',');
    }
    function field(state, u, allowance) {
      var key = fieldKey(state, u, allowance);
      for (var fc = 0; fc < fieldCache.length; fc++) if (fieldCache[fc].key === key && fieldCache[fc].state === state) return fieldCache[fc].f;
      var made = fieldOf(state, u, allowance);
      // the wire's D6 is rolled on the first look: file it under the roll it now has
      fieldCache.unshift({ key: fieldKey(state, u, allowance), state: state, f: made });
      if (fieldCache.length > 4) fieldCache.pop();
      return made;
    }
    /* The terrain at every lattice point — under its middle, and the kind a
       token standing there counts as in (kindsUnder) — for one table as it
       stands. It is the same for every unit, so it is worked out once for each
       layout of the terrain and shared by every field on it. */
    var groundCache = { key: null, state: null, at: null, under: null };
    function groundOf(state, N) {
      var key = state.terrain.length + ';' + state.terrain.map(function (r) { return [r.kind, r.x, r.y, r.w, r.h, r.gone ? 1 : 0].join(','); }).join(';');
      if (groundCache.state !== state || groundCache.key !== key) {
        groundCache = { key: key, state: state, at: new Uint8Array(N), under: new Uint8Array(N) };   // 0: not yet looked at
      }
      return groundCache;
    }
    function fieldOf(state, u, allowance) {
      var cols = Math.round(BOARD.w / STEP) + 1, rows = Math.round(BOARD.h / STEP) + 1;
      var N = cols * rows;
      var idx = function (i, j) { return j * cols + i; };
      var i0 = Math.round(u.x / STEP), j0 = Math.round(u.y / STEP);
      var cost = new Float64Array(N * 2).fill(Infinity);
      var came = new Int32Array(N * 2).fill(-1);
      var ground = groundOf(state, N), terr = ground.at;
      var kindIndex = {}; var kinds = Object.keys(TERRAIN);
      kinds.forEach(function (k, n) { kindIndex[k] = n; });
      // a section of wire crossed costs the D6 rolled for this move
      if (u.wireRoll == null && !isFlying(u) && !flyInf(u) && !jumps(u) && state.terrain.some(function (r) { return r.kind === 'wire'; })) {
        u.wireRoll = d6();
      }

      function kindAt(i, j) {
        var k = idx(i, j);
        if (terr[k] === 0) terr[k] = 1 + kindIndex[terrainAt(state, i * STEP, j * STEP)];
        return kinds[terr[k] - 1];
      }
      var blk = new Int8Array(N);                        // 0 not yet asked, 1 open, 2 blocked
      function blockedBy(i, j) {
        var c = idx(i, j);
        if (blk[c] === 0) blk[c] = blockedAt(i, j) ? 2 : 1;
        return blk[c] === 2;
      }
      function blockedAt(i, j) {
        var x = i * STEP, y = j * STEP;
        if (x < UNIT_R || y < UNIT_R || x > BOARD.w - UNIT_R || y > BOARD.h - UNIT_R) return true;
        if (terrainBars(u, kindAt(i, j))) return true;
        // aircraft "can move over other units" (p. 38); they only may not finish within 1"
        if (isFlying(u)) return false;
        for (var n = 0; n < state.units.length; n++) {
          var o = state.units[n];
          if (!o.alive || o === u || o.side === u.side || o.aboard || o.x < 0) continue;
          if (o.bld ? rectPointDist(sectionRect(o), x, y) < UNIT_R + 1 : Math.hypot(o.x - x, o.y - y) < 2 * UNIT_R + 1) return true;   // stay 1" clear of the enemy
        }
        return false;
      }
      var linear = function (k) { return !!TERRAIN[k].linear; };
      var area = function (k) { return !TERRAIN[k].linear && terrainCost(u, k) > 0; };
      /* The area terrain a unit standing at a point counts as in (see
         kindsUnder), or null; worked out once a point. Stepping into it, or
         starting in it, costs the penalty once a move (p. 42). */
      var under = ground.under;
      function areaAt(i, j) {
        var c = idx(i, j);
        if (under[c] === 0) under[c] = 1 + kindIndex[kindsUnder(state, null, i * STEP, j * STEP)[0]];
        var kk = kinds[under[c] - 1];
        return area(kk) ? kk : null;
      }

      var k0 = kindsUnder(state, u)[0];
      var startPaid = area(k0) ? 1 : 0;
      /* The open points in a binary heap, cheapest first, and of two at the same
         cost the one found first — the order a scan of a list would give, so the
         routes and the order of the points are the same as they always were. */
      var heap = [], seq = 0;
      function before(x, y) { return x.c < y.c || (x.c === y.c && x.s < y.s); }
      function push(nd) {
        nd.s = seq++;
        var n = heap.length; heap.push(nd);
        while (n > 0) {
          var pa = (n - 1) >> 1;
          if (!before(heap[n], heap[pa])) break;
          var t = heap[pa]; heap[pa] = heap[n]; heap[n] = t; n = pa;
        }
      }
      function pop() {
        var top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          var n = 0, L = heap.length;
          for (;;) {
            var a = 2 * n + 1, b = a + 1, m = n;
            if (a < L && before(heap[a], heap[m])) m = a;
            if (b < L && before(heap[b], heap[m])) m = b;
            if (m === n) break;
            var t = heap[m]; heap[m] = heap[n]; heap[n] = t; n = m;
          }
        }
        return top;
      }
      push({ i: i0, j: j0, p: startPaid, c: startPaid ? terrainCost(u, k0) : 0 });
      cost[idx(i0, j0) * 2 + startPaid] = heap[0].c;
      var seen = [];
      while (heap.length) {
        var cur = pop();
        var ck = idx(cur.i, cur.j) * 2 + cur.p;
        if (cur.c > cost[ck]) continue;
        seen.push(cur);
        for (var n = 0; n < NEI.length; n++) {
          var di = NEI[n][0], dj = NEI[n][1];
          var ni = cur.i + di, nj = cur.j + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          if (blockedBy(ni, nj)) continue;
          var mi = cur.i + NEI_MID[n][0], mj = cur.j + NEI_MID[n][1];
          if ((di > 1 || di < -1 || dj > 1 || dj < -1) && blockedBy(mi, mj)) continue;
          var step = NEI_LEN[n], paid = cur.p;
          var k1 = kindAt(cur.i, cur.j), k2 = kindAt(ni, nj), km = kindAt(mi, mj);
          // a linear piece is paid for every time it is crossed: on stepping onto it
          if (linear(k2) && k2 !== k1) step += terrainCost(u, k2);
          else if (linear(km) && km !== k1 && km !== k2) step += terrainCost(u, km);
          // area terrain once in the whole move
          var a2 = areaAt(ni, nj);
          if (!paid && (a2 || area(km))) { step += terrainCost(u, a2 || km); paid = 1; }
          var nc = cur.c + step;
          if (nc > allowance + 1e-6) continue;
          var nk = idx(ni, nj) * 2 + paid;
          if (nc < cost[nk]) {
            cost[nk] = nc;
            came[nk] = ck;
            push({ i: ni, j: nj, p: paid, c: nc });
          }
        }
      }
      // the cheaper of the two layers, for each point on the table
      var best = new Float64Array(N);
      for (var q = 0; q < N; q++) best[q] = Math.min(cost[q * 2], cost[q * 2 + 1]);
      var seenOnce = [], mark = new Uint8Array(N);
      seen.forEach(function (sn) {
        var k = idx(sn.i, sn.j);
        if (mark[k]) return;
        mark[k] = 1; seenOnce.push({ i: sn.i, j: sn.j, c: best[k] });
      });
      return { cols: cols, rows: rows, cost: best, layered: cost, came: came, seen: seenOnce, idx: idx };
    }

    /* A rough measure of how far a hull must come round to face a point: none
       inside its front quarter, one turn to either side, two to face about. The
       drive itself is priced turn by turn along its route by `driveField` below;
       this is only for asking the question from where a unit stands.

       The same page lets it go backwards instead: "vehicles may move backwards in
       a straight line, but their movement distance is halved when doing so". That
       needs no turn at all, so for ground behind the hull the cheaper of the two
       is what it actually does. `driveCost` answers both together. */
    function turnsTo(u, x, y) {
      var f = u.facing == null ? 0 : u.facing;
      var d = angleWrap(Math.atan2(y - u.y, x - u.x) - f);
      d = Math.abs(d);
      if (d <= Math.PI / 4) return 0;                    // inside the front quarter
      if (d <= Math.PI * 3 / 4) return 1;                // a quarter turn either way
      return 2;                                          // about face
    }
    function turnToll(u, x, y) {
      if (!u || u.cls !== 'vehicle' || !u.turn) return 0;
      return turnsTo(u, x, y) * u.turn;
    }
    /* What a given destination really costs this unit: for infantry, the ground it
       walks over; for a vehicle, that plus its turns — or, if the ground is behind
       it, twice the distance driven in reverse with no turn at all. */
    function driveCost(u, x, y, ground) {
      if (!u || u.cls !== 'vehicle') return ground;
      var forward = ground + turnToll(u, x, y);
      if (!u.turn || turnsTo(u, x, y) < 2) return forward;
      // an about-face: reversing in a straight line may well be cheaper
      return Math.min(forward, ground * 2);
    }

    /* ---------- a ground vehicle's drive (p. 35) ----------
       "Vehicles move in straight lines, and may make turns by reducing the range of
       their movement... the cost of a single turn of up to 90°... for every turn
       made on the way." So a hull is searched for with its heading as part of where
       it is: it rolls straight on along one of the lattice's sixteen headings, and
       changing heading costs a turn for every 90° or part of it — each bend on the
       way round a wood is paid for, not just the angle to the finish.

       "Vehicles may move backwards in a straight line, but their movement distance
       is halved": straight back along the line it faces, at two inches of
       allowance for every inch, with no turn and its front still where it was. */
    var HEAD = NEI.map(function (d) { return Math.atan2(d[1], d[0]); });
    function turnsBetween(h1, h2) {
      var d = Math.abs(HEAD[h1] - HEAD[h2]);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d < 1e-6 ? 0 : Math.ceil(d / (Math.PI / 2) - 1e-9);
    }
    function nearestHead(a) {
      var best = 0, bd = Infinity;
      for (var h = 0; h < HEAD.length; h++) {
        var d = Math.abs(HEAD[h] - a);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d < bd) { bd = d; best = h; }
      }
      return best;
    }
    function drives(u) { return !!u && u.cls === 'vehicle' && u.move > 0 && !hasOwn(u, 'Immobile'); }

    var driveCache = { key: null, f: null };
    function driveKey(state, u, allowance) {
      var k = [u.id, u.x, u.y, u.facing, u.turn, u.move, allowance, u.wireRoll, state.terrain.length];
      state.units.forEach(function (o) { if (o.alive && !o.aboard && o.side !== u.side) k.push(o.x, o.y, o.bld ? 1 : 0); });
      // where every piece stands, not just what it is: a new table is a new drive
      state.terrain.forEach(function (r) { k.push(r.kind, r.x, r.y, r.w, r.h, r.gone ? 1 : 0); });
      return k.join(',');
    }

    function driveField(state, u, allowance) {
      var key = driveKey(state, u, allowance);
      if (driveCache.key === key) return driveCache.f;
      var cols = Math.round(BOARD.w / STEP) + 1, rows = Math.round(BOARD.h / STEP) + 1;
      var N = cols * rows, H = HEAD.length;
      var idx = function (i, j) { return j * cols + i; };
      var i0 = Math.round(u.x / STEP), j0 = Math.round(u.y / STEP);
      var terr = new Uint8Array(N), blk = new Int8Array(N);   // 0 unknown, 1 open, 2 blocked
      var kinds = Object.keys(TERRAIN), kindIndex = {};
      kinds.forEach(function (k, n) { kindIndex[k] = n; });
      if (u.wireRoll == null && state.terrain.some(function (r) { return r.kind === 'wire'; })) u.wireRoll = d6();
      function kindAt(i, j) {
        var k = idx(i, j);
        if (terr[k] === 0) terr[k] = 1 + kindIndex[terrainAt(state, i * STEP, j * STEP)];
        return kinds[terr[k] - 1];
      }
      function blockedBy(i, j) {
        var k = idx(i, j);
        if (blk[k]) return blk[k] === 2;
        var x = i * STEP, y = j * STEP, b = false;
        if (x < UNIT_R || y < UNIT_R || x > BOARD.w - UNIT_R || y > BOARD.h - UNIT_R) b = true;
        else if (terrainBars(u, kindAt(i, j))) b = true;
        else for (var n = 0; n < state.units.length; n++) {
          var o = state.units[n];
          if (!o.alive || o === u || o.side === u.side || o.aboard || o.x < 0) continue;
          if (o.bld ? rectPointDist(sectionRect(o), x, y) < UNIT_R + 1 : Math.hypot(o.x - x, o.y - y) < 2 * UNIT_R + 1) { b = true; break; }
        }
        blk[k] = b ? 2 : 1;
        return b;
      }
      var linear = function (k) { return !!TERRAIN[k].linear; };
      var area = function (k) { return !TERRAIN[k].linear && terrainCost(u, k) > 0; };
      // one step straight on along heading h: its cost, and whether it pays the area penalty
      function stepCost(ci, cj, h, paid) {
        var di = NEI[h][0], dj = NEI[h][1], ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows || blockedBy(ni, nj)) return null;
        var mi = ci + Math.round(di / 2), mj = cj + Math.round(dj / 2);
        if ((Math.abs(di) > 1 || Math.abs(dj) > 1) && blockedBy(mi, mj)) return null;
        var run = STEP * Math.hypot(di, dj), pen = 0;
        var k1 = kindAt(ci, cj), k2 = kindAt(ni, nj), km = kindAt(mi, mj);
        if (linear(k2) && k2 !== k1) pen += terrainCost(u, k2);
        else if (linear(km) && km !== k1 && km !== k2) pen += terrainCost(u, km);
        if (!paid && (area(k2) || area(km))) { pen += terrainCost(u, area(k2) ? k2 : km); paid = 1; }
        return { i: ni, j: nj, run: run, pen: pen, paid: paid };
      }

      var S = N * H * 2;
      var cost = new Float64Array(S).fill(Infinity), came = new Int32Array(S).fill(-1), turnsN = new Uint8Array(S);
      var sid = function (cell, h, p) { return (cell * H + h) * 2 + p; };
      // a binary heap of states by cost
      var hc = [], hs = [];
      function push(c, st) {
        var n = hc.length; hc.push(c); hs.push(st);
        while (n > 0) {
          var pa = (n - 1) >> 1;
          if (hc[pa] <= hc[n]) break;
          var tc = hc[pa]; hc[pa] = hc[n]; hc[n] = tc; var ts = hs[pa]; hs[pa] = hs[n]; hs[n] = ts; n = pa;
        }
      }
      function pop() {
        var top = hs[0], lc = hc.pop(), ls = hs.pop();
        if (hc.length) {
          hc[0] = lc; hs[0] = ls;
          var n = 0, L = hc.length;
          for (;;) {
            var a = 2 * n + 1, b = a + 1, m = n;
            if (a < L && hc[a] < hc[m]) m = a;
            if (b < L && hc[b] < hc[m]) m = b;
            if (m === n) break;
            var tc = hc[m]; hc[m] = hc[n]; hc[n] = tc; var ts = hs[m]; hs[m] = hs[n]; hs[n] = ts; n = m;
          }
        }
        return top;
      }
      var k0 = kindAt(i0, j0), startPaid = area(k0) ? 1 : 0, c0 = startPaid ? terrainCost(u, k0) : 0;
      var h0 = nearestHead(u.facing == null ? 0 : u.facing), turn = u.turn || 0;
      var cell0 = idx(i0, j0);
      cost[sid(cell0, h0, startPaid)] = c0; push(c0, sid(cell0, h0, startPaid));
      var best = new Float64Array(N).fill(Infinity), bestState = new Int32Array(N).fill(-1);
      while (hc.length) {
        var cc = hc[0], st = pop();
        if (cc > cost[st]) continue;
        var p = st & 1, h = (st >> 1) % H, cell = Math.floor((st >> 1) / H);
        var ci = cell % cols, cj = Math.floor(cell / cols);
        if (cc < best[cell]) { best[cell] = cc; bestState[cell] = st; }
        // come round to another heading, where it stands
        for (var h2 = 0; h2 < H; h2++) {
          if (h2 === h) continue;
          var tcst = cc + turnsBetween(h, h2) * turn, ts2 = sid(cell, h2, p);
          if (tcst > allowance + 1e-6 || tcst >= cost[ts2]) continue;
          cost[ts2] = tcst; came[ts2] = st; turnsN[ts2] = turnsN[st] + turnsBetween(h, h2); push(tcst, ts2);
        }
        // ...or roll straight on
        var sc = stepCost(ci, cj, h, p);
        if (!sc) continue;
        var nc = cc + sc.run + sc.pen, ns = sid(idx(sc.i, sc.j), h, sc.paid);
        if (nc > allowance + 1e-6 || nc >= cost[ns]) continue;
        cost[ns] = nc; came[ns] = st; turnsN[ns] = turnsN[st]; push(nc, ns);
      }
      // backwards, in a straight line, at half distance
      var rev = new Float64Array(N).fill(Infinity);
      var hb = nearestHead((u.facing == null ? 0 : u.facing) + Math.PI);
      var ri = i0, rj = j0, rp = startPaid, rc = c0;
      for (;;) {
        var rs = stepCost(ri, rj, hb, rp);
        if (!rs) break;
        rc += 2 * rs.run + rs.pen;
        if (rc > allowance + 1e-6) break;
        ri = rs.i; rj = rs.j; rp = rs.paid;
        rev[idx(ri, rj)] = rc;
      }
      var seen = [];
      for (var q = 0; q < N; q++) {
        var fc = Math.min(best[q], rev[q]);
        if (isFinite(fc)) seen.push({ i: q % cols, j: Math.floor(q / cols), c: fc });
      }
      var f = {
        cols: cols, rows: rows, idx: idx, seen: seen,
        cost: (function () { var o = new Float64Array(N); for (var q2 = 0; q2 < N; q2++) o[q2] = Math.min(best[q2], rev[q2]); return o; })(),
        // what it costs to finish on this point, and how: turns taken, backwards or not
        at: function (ti, tj) {
          var k = idx(ti, tj);
          if (rev[k] < best[k]) return { spent: rev[k], turns: 0, reverse: true, ground: rev[k] / 2 };
          if (!isFinite(best[k])) return null;
          var t = turnsN[bestState[k]];
          return { spent: best[k], turns: t, reverse: false, ground: best[k] - t * turn };
        },
        // the route there: its corners, the heading it ends on (none when reversing)
        route: function (ti, tj) {
          var k = idx(ti, tj);
          if (rev[k] < best[k]) {
            var r0 = [{ x: u.x, y: u.y }, { x: ti * STEP, y: tj * STEP }];
            r0.facing = null; r0.reverse = true; r0.turns = 0;
            return r0;
          }
          if (bestState[k] < 0) return null;
          var pts = [], st2 = bestState[k], guard = 0, last = -1;
          var endH = (st2 >> 1) % H;
          while (st2 >= 0 && guard++ < 20000) {
            var c2 = Math.floor((st2 >> 1) / H);
            if (c2 !== last) { pts.push({ x: (c2 % cols) * STEP, y: Math.floor(c2 / cols) * STEP }); last = c2; }
            st2 = came[st2];
          }
          pts.reverse();
          pts.facing = HEAD[endH]; pts.reverse = false; pts.turns = turnsN[bestState[k]];
          return pts;
        }
      };
      driveCache.key = key; driveCache.f = f;
      return f;
    }

    function reachable(state, u, allowance) {
      if (drives(u)) {
        var df = driveField(state, u, allowance), dout = [];
        df.seen.forEach(function (n) {
          var x = n.i * STEP, y = n.j * STEP;
          if (unitNear(state, x, y, u, 1)) return;
          var at = df.at(n.i, n.j);
          if (!at || at.spent > allowance + 1e-6) return;
          dout.push({ x: x, y: y, cost: at.ground, spent: at.spent, turns: at.turns, reverse: at.reverse });
        });
        return dout;
      }
      var f = field(state, u, allowance), out = [];
      f.seen.forEach(function (n) {
        var x = n.i * STEP, y = n.j * STEP;
        if (unitNear(state, x, y, u, 1)) return;      // must finish at least 1" from other units
        // Flying Infantry and jump troops go over impassable ground but cannot land on it
        if ((flyInf(u) || jumps(u)) && TERRAIN[terrainAt(state, x, y)].impassable) return;
        var ground = f.cost[f.idx(n.i, n.j)];
        var real = driveCost(u, x, y, ground);
        if (real > allowance) return;
        out.push({ x: x, y: y, cost: ground, spent: real, turns: u.cls === 'vehicle' ? turnsTo(u, x, y) : 0,
          reverse: u.cls === 'vehicle' && real < ground + turnToll(u, x, y) });
      });
      return out;
    }

    // the route the unit actually takes, for showing the move
    function pathTo(state, u, allowance, target) {
      if (drives(u)) {
        var df = driveField(state, u, allowance);
        var rt = df.route(Math.round(target.x / STEP), Math.round(target.y / STEP));
        if (!rt) { var none = [{ x: u.x, y: u.y }, { x: target.x, y: target.y }]; none.facing = undefined; return none; }
        // thin it to its corners, and finish on the very point asked for
        var dp = [rt[0]];
        for (var dn = 1; dn < rt.length - 1; dn++) {
          var da = dp[dp.length - 1], db = rt[dn], dc = rt[dn + 1];
          if (Math.abs((db.x - da.x) * (dc.y - da.y) - (db.y - da.y) * (dc.x - da.x)) > 0.01) dp.push(db);
        }
        dp.push({ x: target.x, y: target.y });
        dp[0] = { x: u.x, y: u.y };
        dp.facing = rt.facing; dp.reverse = rt.reverse; dp.turns = rt.turns;
        return dp;
      }
      var f = field(state, u, allowance);
      var ti = Math.round(target.x / STEP), tj = Math.round(target.y / STEP);
      var k0 = f.idx(ti, tj);
      if (!isFinite(f.cost[k0])) return [{ x: u.x, y: u.y }, { x: target.x, y: target.y }];
      var k = f.layered[k0 * 2] <= f.layered[k0 * 2 + 1] ? k0 * 2 : k0 * 2 + 1;
      var pts = [], guard = 0;
      while (k >= 0 && guard++ < 4000) {
        var cell = k >> 1, i = cell % f.cols, j = Math.floor(cell / f.cols);
        pts.push({ x: i * STEP, y: j * STEP });
        k = f.came[k];
      }
      pts.reverse();
      // thin it out: keep the corners, drop points on a straight run
      var out = [pts[0]];
      for (var n = 1; n < pts.length - 1; n++) {
        var a2 = out[out.length - 1], b2 = pts[n], c2 = pts[n + 1];
        var cross = (b2.x - a2.x) * (c2.y - a2.y) - (b2.y - a2.y) * (c2.x - a2.x);
        if (Math.abs(cross) > 0.01) out.push(b2);
      }
      out.push(pts[pts.length - 1]);
      return out;
    }

    // once every kit is made, the others' functions themselves rather than the stubs for them
    function relink(L) {
      BOARD = L.BOARD; STEP = L.STEP; TERRAIN = L.TERRAIN; UNIT_R = L.UNIT_R; angleWrap = L.angleWrap;
      d6 = L.d6; flyInf = L.flyInf; hasOwn = L.hasOwn; isFlying = L.isFlying; kindsUnder = L.kindsUnder;
      mountOf = L.mountOf; propOf = L.propOf; rectPointDist = L.rectPointDist; sectionRect = L.sectionRect;
      terrainAt = L.terrainAt; unitNear = L.unitNear;
    }

    return {
      relink: relink,
      jumps: jumps, terrainCost: terrainCost, terrainBars: terrainBars, field: field, turnsTo: turnsTo,
      turnToll: turnToll, driveCost: driveCost, drives: drives, reachable: reachable, pathTo: pathTo
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCMove;
})(typeof window !== 'undefined' ? window : global);
