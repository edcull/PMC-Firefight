/* PMC 2670 — Firefight : the table: geometry, buildings and their sections, piece shapes, terrain underfoot, hills and line of sight

   Made by rules.js as it loads, with E: the names of rules.js this needs,
   bound here once. Once every such file is made, rules.js hands each of them
   the others' functions themselves (relink), so a call from one to another
   goes straight there. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCSpace = function (E) {
    var BOARD = E.BOARD, SHAPED = E.SHAPED, STEP = E.STEP, TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R,
        angleWrap = E.angleWrap, hasOwn = E.hasOwn, isFlying = E.isFlying, nearestClear = E.nearestClear,
        sightRange = E.sightRange, status = E.status;
    /* ---------- geometry ---------- */
    function centreDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    /* Closest models. A unit inside a building is measured from the building's
       wall, both when it shoots and when it is shot at or charged (p. 41). */
    function unitDist(a, b) {
      var ra = a && a.bld ? sectionRect(a) : null, rb = b && b.bld ? sectionRect(b) : null;
      if (!ra && !rb) return Math.max(0, centreDist(a, b) - 2 * UNIT_R);
      if (ra && rb) return ra === rb ? 0 : rectRectDist(ra, rb);
      if (ra) return Math.max(0, rectPointDist(ra, b.x, b.y) - UNIT_R);
      return Math.max(0, rectPointDist(rb, a.x, a.y) - UNIT_R);
    }
    function rectPointDist(q, x, y) {
      var dx = Math.max(q.x - x, 0, x - (q.x + q.w)), dy = Math.max(q.y - y, 0, y - (q.y + q.h));
      return Math.hypot(dx, dy);
    }
    function rectRectDist(a, b) {
      var dx = Math.max(a.x - (b.x + b.w), 0, b.x - (a.x + a.w)), dy = Math.max(a.y - (b.y + b.h), 0, b.y - (a.y + a.h));
      return Math.hypot(dx, dy);
    }

    /* ---------- buildings (p. 41) ---------- */
    function enterable(r) { return !!(r && TERRAIN[r.kind] && TERRAIN[r.kind].enterable && !r.wrecked); }
    // the sections of a building: its wings, or the whole of a single block
    function sectionsOf(r) { return r.parts && r.parts.length ? r.parts : [r]; }
    function sectionRect(u) {
      if (!u || !u.bld) return null;
      var ss = sectionsOf(u.bld);
      return ss[u.sec || 0] || ss[0];
    }
    /* A section is a high building if it stands tall: a tower, or a full-height
       wing of a building of any size. Only a high building gives Firepower. */
    function sectionHigh(r, q) {
      if (!r) return false;
      if (r.kind === 'bunker') return true;
      q = q || r;
      var hf = q.hf || 1;
      return hf >= 1.3 || (hf >= 1 && Math.max(r.w, r.h) >= 6.5);
    }
    function occupant(state, r, sec) {
      for (var i = 0; i < state.units.length; i++) {
        var u = state.units[i];
        if (u.alive && !u.aboard && u.bld === r && (u.sec || 0) === (sec || 0)) return u;
      }
      return null;
    }
    function canGarrison(u) {
      return !!u && u.alive && !u.aboard && u.x >= 0 && u.cls === 'infantry' && !hasOwn(u, 'Riders') &&
        !isFlying(u) && !hasOwn(u, 'Stationary Artillery') && !hasOwn(u, 'Immobile');
    }
    /* Where this unit could go in: any empty section within 4" of it, or — from
       inside a building of several sections — an empty section in contact with
       its own (p. 41, Huge buildings). */
    function enterTargets(state, u) {
      if (!canGarrison(u) || status(u) === 'broken') return [];
      var out = [];
      state.terrain.forEach(function (r) {
        if (!enterable(r)) return;
        sectionsOf(r).forEach(function (q, i) {
          if (occupant(state, r, i)) return;
          if (u.bld) {
            if (u.bld !== r || (u.sec || 0) === i) return;
            if (rectRectDist(q, sectionRect(u)) > 0.6) return;
          } else if (rectPointDist(q, u.x, u.y) - UNIT_R > 4) return;
          out.push({ piece: r, sec: i, rect: q, move: !!u.bld });
        });
      });
      return out;
    }
    function enterBuilding(state, u, r, sec) {
      var q = sectionsOf(r)[sec || 0];
      u.bld = r; u.sec = sec || 0;
      u.x = q.x + q.w / 2; u.y = q.y + q.h / 2;
      return q;
    }
    /* Where a unit coming out may be put: within 4" of the wall, on ground it
       can stand on, clear of every other unit. The 4" is measured as going in is,
       from the wall to the near edge of the base (p. 41). */
    // `reach`: how far out the unit's middle may end, its base within 4" of the wall unless said otherwise
    function exitSpots(state, u, reach) {
      var q = sectionRect(u);
      if (!q) return [];
      reach = reach || UNIT_R + 4;
      var out = [];
      for (var x = Math.floor(q.x - reach - 1); x <= q.x + q.w + reach + 1; x += STEP) {
        for (var y = Math.floor(q.y - reach - 1); y <= q.y + q.h + reach + 1; y += STEP) {
          if (x < UNIT_R || y < UNIT_R || x > BOARD.w - UNIT_R || y > BOARD.h - UNIT_R) continue;
          var d = rectPointDist(q, x, y);
          if (d < UNIT_R || d > reach) continue;
          if (TERRAIN[terrainAt(state, x, y)].impassable) continue;
          if (unitNear(state, x, y, u, 1)) continue;
          out.push({ x: x, y: y, cost: d, spent: d, turns: 0 });
        }
      }
      return out;
    }
    function exitBuilding(state, u, p) {
      u.bld = null; u.sec = null;
      if (p) { u.x = p.x; u.y = p.y; }
    }
    /* Out through the wall facing away from `from`, as the garrison of a lost
       building does: its base ends no further than `back` inches from the wall
       (the 2" it falls back, p. 41) — 4" if not said. */
    function leaveAway(state, u, from, back) {
      var spots = exitSpots(state, u, UNIT_R + (back != null ? back : 4));
      var q = sectionRect(u);
      exitBuilding(state, u, null);
      if (!spots.length) { var p0 = nearestClear(state, u, q); u.x = p0.x; u.y = p0.y; return; }
      var best = spots.sort(function (a, b) {
        return (inches(b.x, b.y, from.x, from.y) - b.cost * 0.5) - (inches(a.x, a.y, from.x, from.y) - a.cost * 0.5);
      })[0];
      u.x = best.x; u.y = best.y;
    }
    function inches(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

    /* A terrain piece is its bounding rectangle, and — for the natural pieces —
       an irregular outline inside it (`r.poly`, a list of [x, y] points). Every
       rule asks the same two questions of a piece: is this point in it, and does
       this line cross it. With an outline, the answer is the outline's: a unit
       standing in the rectangle's corner but outside the trees is in the open. */
    function inRect(x, y, r) {
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return false;
      if (r.parts) {                                 // a building of several wings
        for (var i = 0; i < r.parts.length; i++) {
          var q = r.parts[i];
          if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return true;
        }
        return false;
      }
      return r.poly ? inPoly(x, y, r.poly) : true;
    }
    function inPoly(x, y, pts) {
      var inside = false;
      for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
      var d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
      var d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      var d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      var d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
    }
    function segPoly(x1, y1, x2, y2, pts) {
      if (inPoly(x1, y1, pts) || inPoly(x2, y2, pts)) return true;
      for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if (segsCross(x1, y1, x2, y2, pts[j][0], pts[j][1], pts[i][0], pts[i][1])) return true;
      }
      return false;
    }
    /* How far inside a piece a point is, in inches — negative outside. The ground
       painter uses it to lay a piece's floor exactly where the rules have it. */
    function pieceDepth(r, x, y) {
      if (r.parts) {
        var bd = -Infinity;
        r.parts.forEach(function (q) { bd = Math.max(bd, Math.min(x - q.x, q.x + q.w - x, y - q.y, q.y + q.h - y)); });
        return bd;
      }
      if (!r.poly) return Math.min(x - r.x, r.x + r.w - x, y - r.y, r.y + r.h - y);
      /* The nearest edge of the outline. This is asked for every pixel of a
         shaped piece as the ground is baked, so rather than measure to every edge
         it starts from the edge that was nearest last time (the pixel next door,
         as often as not), passes over any edge whose box is already further off,
         and measures the winner the one way it always has. */
      var pts = r.poly, E = edgesOf(pts), n = E.length / 8;
      var bi = lastEdge < n ? lastEdge : 0, bestSq = segSq(E, bi, x, y);
      for (var i = 0; i < n; i++) {
        if (i === bi) continue;
        var o = i * 8;
        var gx = Math.max(E[o + 4] - x, 0, x - E[o + 5]), gy = Math.max(E[o + 6] - y, 0, y - E[o + 7]);
        if (gx * gx + gy * gy >= bestSq) continue;
        var d2 = segSq(E, i, x, y);
        if (d2 < bestSq) { bestSq = d2; bi = i; }
      }
      lastEdge = bi;
      var ob = bi * 8, best = pointSegDist(x, y, E[ob], E[ob + 1], E[ob + 2], E[ob + 3]);
      return inPoly(x, y, pts) ? best : -best;
    }
    // an outline's edges, each as x1, y1, x2, y2 and its box: worked out once an outline
    var edgeCache = typeof WeakMap === 'function' ? new WeakMap() : null, lastEdge = 0;
    function edgesOf(pts) {
      var E = edgeCache && edgeCache.get(pts);
      if (E) return E;
      E = new Float64Array(pts.length * 8);
      for (var i = 0, j = pts.length - 1, k = 0; i < pts.length; j = i++, k++) {
        var x1 = pts[j][0], y1 = pts[j][1], x2 = pts[i][0], y2 = pts[i][1], o = k * 8;
        E[o] = x1; E[o + 1] = y1; E[o + 2] = x2; E[o + 3] = y2;
        E[o + 4] = Math.min(x1, x2); E[o + 5] = Math.max(x1, x2); E[o + 6] = Math.min(y1, y2); E[o + 7] = Math.max(y1, y2);
      }
      if (edgeCache) edgeCache.set(pts, E);
      return E;
    }
    // the squared distance to edge i, as pointSegDist measures it, without the square root
    function segSq(E, i, px, py) {
      var o = i * 8, x1 = E[o], y1 = E[o + 1], dx = E[o + 2] - x1, dy = E[o + 3] - y1, l2 = dx * dx + dy * dy;
      var t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
      var ex = px - (x1 + t * dx), ey = py - (y1 + t * dy);
      return ex * ex + ey * ey;
    }
    /* Move or resize a piece, taking its outline with it: the outline is stretched
       from the old rectangle onto the new one. Anything that shifts a piece after
       it is laid must go through here, or the drawn shape and the rules part ways. */
    function placePiece(t, x, y, w, h) {
      if (w == null) w = t.w;
      if (h == null) h = t.h;
      var ox = t.x, oy = t.y, ow = t.w || 1, oh = t.h || 1;
      if (t.poly) {
        t.poly = t.poly.map(function (q) { return [x + (q[0] - ox) / ow * w, y + (q[1] - oy) / oh * h]; });
      }
      if (t.top) {
        t.top = t.top.map(function (q) { return [x + (q[0] - ox) / ow * w, y + (q[1] - oy) / oh * h]; });
      }
      if (t.parts) {
        t.parts = t.parts.map(function (q) {
          var o = {}; for (var k in q) o[k] = q[k];
          o.x = x + (q.x - ox) / ow * w; o.y = y + (q.y - oy) / oh * h; o.w = q.w / ow * w; o.h = q.h / oh * h;
          return o;
        });
      }
      t.x = x; t.y = y; t.w = w; t.h = h;
      return t;
    }
    /* Turn the whole table a number of quarter turns about its centre. One
       quarter turn carries the north edge to the west, the east to the north:
       (x, y) -> (y, W - x). The table is square, so it still fits itself. */
    function turnPoint(x, y, k) {
      k = ((k % 4) + 4) % 4;
      for (var i = 0; i < k; i++) { var t = x; x = y; y = BOARD.w - t; }
      return [x, y];
    }
    function turnRect(q, k) {
      var a = turnPoint(q.x, q.y, k), b = turnPoint(q.x + q.w, q.y + q.h, k);
      return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
    }
    function turnPiece(t, k) {
      if (!(((k % 4) + 4) % 4)) return t;
      var pts = function (list) { return list.map(function (q) { return turnPoint(q[0], q[1], k); }); };
      if (t.poly) t.poly = pts(t.poly);
      if (t.top) t.top = pts(t.top);
      if (t.parts) t.parts = t.parts.map(function (q) {
        var o = {}, r = turnRect(q, k); for (var key in q) o[key] = q[key];
        o.x = r.x; o.y = r.y; o.w = r.w; o.h = r.h; return o;
      });
      var r2 = turnRect(t, k);
      t.x = r2.x; t.y = r2.y; t.w = r2.w; t.h = r2.h;
      return t;
    }

    /* The families of outline each kind is drawn from:
         blob   — a lumpy round-cornered patch
         lobed  — two to four lobes, like a copse grown together or a clover of pools
         kidney — a patch with a bay bitten out of one side
         long   — a band laid diagonally across its ground: a lava flow, a creek, a strip of wood
         rift   — ground torn open: a jagged, splintered hole (longrift: a fissure) */
    var FAMILIES = {
      woods: ['blob', 'lobed', 'lobed', 'kidney', 'long'],
      crater: ['blob', 'lobed', 'long'],
      rocks: ['blob', 'lobed'],
      water: ['blob', 'kidney', 'kidney', 'long', 'lobed'],
      deep: ['blob', 'kidney', 'long', 'lobed'],
      lava: ['rift', 'rift', 'longrift', 'longrift', 'rift'],
      crystal: ['blob', 'lobed', 'kidney'],
      ravine: ['longrift', 'longrift', 'longrift', 'rift'],
      hill: ['blob', 'blob', 'lobed', 'kidney']
    };
    /* Every outline is star-shaped about its centre — one radius per direction —
       so it can never cross itself, and it is then stretched to fill its piece's
       rectangle, so the rectangle stays an honest bounding box. */
    /* A building's floor plan: one block, or wings joined into an L, a T, a U
       round a yard, or a main hall with a lower annex or a tower. The wings are
       rectangles that share edges and never overlap; together they are the
       building — cover, sight, all of it — and the ground between them is open. */
    var PLANS = ['block', 'L', 'L', 'T', 'U', 'annex', 'tower'];
    /* "Each building can be occupied by only one unit at a time" (p. 41): that is the
       small structure, "approximately up to 4"x4"" (p. 42). Only a bigger one is
       built of sections a unit each — so a building no longer than SMALL_BLD on
       its longer side stays one block, whatever plan the dice gave it. */
    var SMALL_BLD = 5.5;
    function planBuilding(r, rand, plan) {
      if (r.parts || r.w < 4 || r.h < 4) return r;
      var rolled = PLANS[Math.floor(rand() * PLANS.length)];   // (rolled either way: the dice that follow stay the same)
      plan = plan || (Math.max(r.w, r.h) <= SMALL_BLD ? 'block' : rolled);
      var x = r.x, y = r.y, w = r.w, h = r.h, parts;
      function P(px, py, pw, ph, hf) { return { x: px, y: py, w: pw, h: ph, hf: hf || 1 }; }
      var fx = rand() < 0.5, fy = rand() < 0.5, swap = rand() < 0.5 && plan !== 'block';
      // plans are laid out along u (across) and v (down), then flipped and turned into place
      var U = swap ? h : w, V = swap ? w : h;
      var cu = U * (0.4 + rand() * 0.15), cv = V * (0.4 + rand() * 0.15);
      switch (plan) {
        case 'L': parts = [P(0, 0, U, V - cv), P(0, V - cv, U - cu, cv)]; break;
        case 'T': {
          var sw = U * (0.36 + rand() * 0.12), so = (U - sw) / 2 + (rand() - 0.5) * U * 0.15;
          parts = [P(0, 0, U, V - cv), P(so, V - cv, sw, cv, 0.8)];
          break;
        }
        case 'U': {
          var lw = U * (0.28 + rand() * 0.06);
          parts = [P(0, 0, U, V * 0.42), P(0, V * 0.42, lw, V * 0.58, 0.85), P(U - lw, V * 0.42, lw, V * 0.58, 0.85)];
          break;
        }
        case 'annex': {
          var mw = U * (0.55 + rand() * 0.15), ah = V * (0.55 + rand() * 0.2), ay = (V - ah) * rand();
          parts = [P(0, 0, mw, V), P(mw, ay, U - mw, ah, 0.6)];
          break;
        }
        case 'tower': {
          var tw = U * (0.35 + rand() * 0.1), th = V * (0.4 + rand() * 0.15);
          parts = [P(0, 0, U - tw, V, 0.8), P(U - tw, 0, tw, th, 1.45), P(U - tw, th, tw, V - th, 0.8)];
          break;
        }
        default: parts = [P(0, 0, U, V)];
      }
      r.parts = parts.map(function (q) {
        var qu = fx ? U - q.x - q.w : q.x, qv = fy ? V - q.y - q.h : q.y;
        return swap ? P(x + qv, y + qu, q.h, q.w, q.hf) : P(x + qu, y + qv, q.w, q.h, q.hf);
      });
      r.plan = plan;
      return r;
    }
    function shapePiece(r, rand, family) {
      if (r.kind === 'building') return planBuilding(r, rand || Math.random, family);
      if (!SHAPED[r.kind] || r.poly || r.w < 2 || r.h < 2) return r;
      rand = rand || Math.random;
      var fams = FAMILIES[r.kind] || ['blob'];
      var fam = family || fams[Math.floor(rand() * fams.length)];
      if (fam === 'long' && Math.min(r.w, r.h) < 3) fam = 'blob';
      if (fam === 'longrift' && Math.min(r.w, r.h) < 3) fam = 'rift';
      var rift = fam === 'rift' || fam === 'longrift';
      if (rift) n = 26;
      var n = 40, TAU = Math.PI * 2;
      var ex = 0.5 + rand() * 0.45;                 // 0.5: nearly square, 1: an ellipse
      var h = [], k2;
      for (k2 = 0; k2 < 4; k2++) h.push({ m: [2, 3, 5, 7][k2], a: [0.12, 0.08, 0.05, 0.025][k2] * (0.5 + rand()), ph: rand() * TAU });
      var lobes = 2 + Math.floor(rand() * 3), lobeA = 0.16 + rand() * 0.16, lobePh = rand() * TAU;
      // a hill is one rise of ground: gentle lobes, no starfish
      if (r.kind === 'hill') { lobes = 2 + Math.floor(rand() * 2); lobeA *= 0.55; h.forEach(function (q) { q.a *= 0.7; }); }
      var bayAt = rand() * TAU, bayD = 0.32 + rand() * 0.2, baySig = 0.45 + rand() * 0.25;
      var asp = 2.2 + rand() * 1.4, rot = (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.55);
      var raw = [];
      for (var i = 0; i < n; i++) {
        var t = i / n * TAU, c = Math.cos(t), sn = Math.sin(t);
        var rad = 1;
        for (k2 = 0; k2 < h.length; k2++) rad += h[k2].a * Math.sin(h[k2].m * t + h[k2].ph);
        rad += (rand() - 0.5) * 0.06;
        if (fam === 'lobed') rad += lobeA * Math.cos(lobes * t + lobePh);
        if (fam === 'kidney') {
          var dd = angleWrap(t - bayAt);
          rad *= 1 - bayD * Math.exp(-dd * dd / (2 * baySig * baySig));
        }
        if (rift) {
          // splintered: a torn edge of points and notches, no two alike
          rad = 0.84 + (rand() - 0.5) * 0.16;
          if (i % 4 === 0 && rand() < 0.7) rad += 0.1 + rand() * 0.12;     // a splinter of the break
          else if (rand() < 0.25) rad -= 0.1 + rand() * 0.1;               // a notch
        }
        rad = Math.max(0.35, rad);
        var sx = (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), ex), sy = (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), ex);
        var x = sx * rad, y = sy * rad;
        if (fam === 'long' || fam === 'longrift') {
          x *= fam === 'longrift' ? asp * 1.25 : asp;
          var cr = Math.cos(rot), sr = Math.sin(rot), x2 = x * cr - y * sr, y2 = x * sr + y * cr;
          x = x2; y = y2;
        }
        raw.push([x, y]);
      }
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      raw.forEach(function (q) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); });
      r.poly = raw.map(function (q) {
        return [r.x + (q[0] - minX) / (maxX - minX) * r.w, r.y + (q[1] - minY) / (maxY - minY) * r.h];
      });
      r.shape = fam;
      /* a big hill may rise in two steps: a second, smaller rise on its top,
         the same outline drawn in towards the middle */
      if (r.kind === 'hill' && r.w >= 7 && r.h >= 6 && rand() < 0.5) {
        var cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2, k0 = 0.45 + rand() * 0.15;
        var sx0 = (rand() - 0.5) * r.w * 0.12, sy0 = (rand() - 0.5) * r.h * 0.12;
        var top = r.poly.map(function (q) {
          var kk = k0 * (0.92 + rand() * 0.12);
          return [cx0 + sx0 + (q[0] - cx0) * kk, cy0 + sy0 + (q[1] - cy0) * kk];
        });
        // keep it well inside the lower step
        var inside = top.every(function (q) { return inPoly(q[0], q[1], r.poly) && pieceDepth({ poly: r.poly, x: r.x, y: r.y, w: r.w, h: r.h }, q[0], q[1]) > 0.8; });
        if (inside) r.top = top;
      }
      return r;
    }

    function regionsAt(state, x, y) {
      var out = [];
      for (var i = 0; i < state.terrain.length; i++) if (inRect(x, y, state.terrain[i])) out.push(state.terrain[i]);
      return out;
    }
    // "One foot in the grave" — the most significant piece applies
    function rank(k) {
      var t = TERRAIN[k];
      return t.impassable ? 5 : t.blocks ? 4 : t.cover ? 3 : t.fp ? 2 : (t.movePenalty || t.wire) ? 1 : 0;
    }
    /* The "chest rule" (p. 42): "if there is a smaller terrain within a larger
       area terrain, use the rules of the smaller one only" — a wood on a hill is a
       wood, and so is shallow water, a road or anything else put on one. Pieces
       only stand inside a hill, so at a point in a hill and in something else,
       the something else is what counts; otherwise the most significant piece. */
    function terrainAt(state, x, y) {
      // the pieces at the point, walked in place rather than gathered into a list (this is asked a great deal)
      var ts = state.terrain, best = 'open', bestRank = 0, onHill = false, inOther = false;
      for (var i = 0; i < ts.length; i++) {
        var r = ts[i];
        if (!inRect(x, y, r)) continue;
        if (r.kind === 'hill') { onHill = true; continue; }
        inOther = true;
        var rk = rank(r.kind);
        if (rk > bestRank) { best = r.kind; bestRank = rk; }
      }
      // in something on the hill (even flat ground, such as a road): its rules, not the hill's
      if (inOther) return best;
      return onHill ? 'hill' : 'open';
    }
    function terrainOf(state, u) { return terrainAt(state, u.x, u.y); }
    /* Which terrain a unit is in. "One foot in grave" (p. 42) has a unit in
       several pieces at once take the worst of them; but on the table the men
       stand on their own bases, not in a circle, and a player sets them in the
       wood or along the trench. A 2" token is only a rough outline of that, so
       it gets some leeway: it is in whatever terrain at least half of the eight
       points round its rim are in, and at four and four its middle decides. It
       is always in one terrain, and the models are drawn standing in it. A
       garrison is in its building and nothing else. */
    var RIM = 8;
    function footprint(x, y) {
      var pts = [{ x: x, y: y }];
      for (var k = 0; k < RIM; k++) {
        var an = k / RIM * Math.PI * 2;
        pts.push({ x: x + Math.cos(an) * UNIT_R, y: y + Math.sin(an) * UNIT_R });
      }
      return pts;
    }
    // the terrain a unit (or a token at x, y) is in, as a one-kind list
    // the rim's offsets from the middle, worked out once (footprint gives the same points)
    var RIM_DX = null, RIM_DY = null, RIM_R = null;
    function kindsUnder(state, u, x, y) {
      if (u && u.bld) return [u.bld.kind];
      var px = x != null ? x : u.x, py = y != null ? y : u.y;
      if (RIM_R !== UNIT_R) {
        RIM_R = UNIT_R; RIM_DX = []; RIM_DY = [];
        for (var q = 0; q < RIM; q++) { var an = q / RIM * Math.PI * 2; RIM_DX.push(Math.cos(an) * UNIT_R); RIM_DY.push(Math.sin(an) * UNIT_R); }
      }
      var kc = terrainAt(state, px, py), n = {};
      for (var i = 0; i < RIM; i++) { var k = terrainAt(state, px + RIM_DX[i], py + RIM_DY[i]); n[k] = (n[k] || 0) + 1; }
      if ((n[kc] || 0) >= RIM / 2) return [kc];
      for (var kk in n) if (n[kk] > RIM / 2) return [kk];
      return [kc];
    }
    // whether a unit counts as in this piece, as kindsUnder judges it: most of its rim in it
    function countsIn(state, u, r) {
      if (!u || !u.side || u.x < 0) return false;
      if (u.bld) return u.bld === r;
      if (kindsUnder(state, u)[0] !== r.kind) return false;
      var n = 0;
      for (var k = 0; k < RIM; k++) {
        var an = k / RIM * Math.PI * 2;
        if (inRect(u.x + Math.cos(an) * UNIT_R, u.y + Math.sin(an) * UNIT_R, r)) n++;
      }
      return n >= RIM / 2;
    }
    // the Defence bonus the ground gives a unit (or a token) standing at x, y
    function coverAt(state, x, y, u) {
      return Math.min.apply(null, kindsUnder(state, null, x, y).map(function (k) { return TERRAIN[k].cover || 0; }));
    }

    // segment vs a piece: its rectangle (Liang-Barsky), then its outline if it has one
    function segRect(x1, y1, x2, y2, r) {
      if (!segBox(x1, y1, x2, y2, r)) return false;
      if (r.parts) return r.parts.some(function (q) { return segBox(x1, y1, x2, y2, q); });
      return r.poly ? segPoly(x1, y1, x2, y2, r.poly) : true;
    }
    function segBox(x1, y1, x2, y2, r) {
      var t0 = 0, t1 = 1, dx = x2 - x1, dy = y2 - y1;
      var p = [-dx, dx, -dy, dy];
      var q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
      for (var i = 0; i < 4; i++) {
        if (p[i] === 0) { if (q[i] < 0) return false; }
        else {
          var t = q[i] / p[i];
          if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
          else { if (t < t0) return false; if (t < t1) t1 = t; }
        }
      }
      return true;
    }

    function pointSegDist(px, py, x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(px - x1, py - y1);
      var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    // Line of sight, centre to centre, out to 36" measured base to base (p. 26). Blocked by
    // LoS-blocking terrain (unless the unit is standing in it — you can see in and out)
    // and by intervening units.
    function hasLoS(state, a, b) {
      if (unitDist(a, b) > sightRange(a)) return false;
      return lineClear(state, a, b);
    }
    /* The line itself, however far: terrain that blocks and units standing in the way.
       "When something can be seen by one soldier, it can be seen by the whole unit"
       (p. 29) — a squad's men stand across its base, so it sees if any of them sees
       any of the other's: the line between the middles, and failing that, lines
       from either side of one base to either side of the other (UNIT_R * 0.8 out,
       across the line). A point at either end — a piece of terrain, a spot on the
       ground — is just itself. Which ground each end stands on (on a hill, in a
       wood) is judged from its middle, whichever line is drawn. */
    function lineClear(state, a, b) {
      if (lineClearAt(state, a, b, a.x, a.y, b.x, b.y)) return true;
      var ra = a && a.side ? UNIT_R * 0.8 : 0, rb = b && b.side ? UNIT_R * 0.8 : 0;
      if (!ra && !rb) return false;
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (len < 1e-6) return false;
      var nx = -dy / len, ny = dx / len;
      var sides = [[1, 1], [-1, -1], [1, -1], [-1, 1]];
      for (var k = 0; k < sides.length; k++) {
        var sa = sides[k][0] * ra, sb = sides[k][1] * rb;
        if (lineClearAt(state, a, b, a.x + nx * sa, a.y + ny * sa, b.x + nx * sb, b.y + ny * sb)) return true;
      }
      return false;
    }
    // one line of sight, from (ax, ay) by a to (bx, by) by b
    function lineClearAt(state, a, b, ax, ay, bx, by) {
      for (var i = 0; i < state.terrain.length; i++) {
        var r = state.terrain[i], t = TERRAIN[r.kind];
        if (!t.blocks && !t.hill) continue;
        var aIn = inRect(a.x, a.y, r), bIn = inRect(b.x, b.y, r);
        /* A hill that rises in two steps: the upper step is a hill standing on a
           hill, and it blocks sight across it the same way — for everyone but a
           unit up on it. Two squads on the lower slope, with the crown between
           them, do not see each other; nor does one on the slope see past the
           crown to the ground beyond. */
        if (t.hill && r.top) {
          var aTop = aIn && inPoly(a.x, a.y, r.top), bTop = bIn && inPoly(b.x, b.y, r.top);
          if (!aTop && !bTop && segRect(ax, ay, bx, by, upperStep(r))) return false;
        }
        // a hill blocks sight across it, but not for a unit standing on it (p. 42)
        if (aIn || bIn) continue;
        if (segRect(ax, ay, bx, by, r)) {
          /* "Any units within that LoS-blocking terrain piece can see other units
             inside that piece as well as units outside it" (p. 42): in it as the
             cover rule counts it, by the most of its base, not only its middle. */
          if (!t.hill && (countsIn(state, a, r) || countsIn(state, b, r))) continue;
          return false;
        }
      }
      /* "Units on hills can shoot/be shot at over friendly units below them (but
         not over enemy ones)" — the friends of whichever end is up on the hill,
         taken a step at a time: from the crown, over friends on the slope below
         it as well as on the level ground. A squad up in a high building looks
         down over its friends as one on the crown does (a reinforced building,
         squat and slit-windowed, does not). */
      var aLv = -1, bLv = -1;                            // how high each end stands: asked only if someone is in the way
      for (var j = 0; j < state.units.length; j++) {
        var u = state.units[j];
        if ((!u.alive && !u.wreckLoS) || u === a || u === b || u.aboard || u.x < 0) continue;
        // a ghost (where a unit might stand) is not hidden by the unit itself, where it stands now
        if (u === a.of || u === b.of) continue;
        if (pointSegDist(u.x, u.y, ax, ay, bx, by) >= UNIT_R * 0.9) continue;
        if (!u.alive) return false;                    // a burnt-out hull hides what is behind it
        if (aLv < 0) { aLv = a.side ? sightLevel(state, a) : 0; bLv = b.side ? sightLevel(state, b) : 0; }
        if ((aLv && u.side === a.side) || (bLv && u.side === b.side)) {
          var uLv = sightLevel(state, u);
          if ((u.side === a.side && aLv > uLv) || (u.side === b.side && bLv > uLv)) continue;
        }
        return false;
      }
      return true;
    }

    /* How high a point stands: level ground (0), a hill (1), or the upper step
       of a hill that rises in two (2). */
    function groundLevel(state, x, y) {
      var lv = 0;
      for (var i = 0; i < state.terrain.length; i++) {
        var r = state.terrain[i];
        if (r.kind !== 'hill' || !inRect(x, y, r)) continue;
        lv = Math.max(lv, r.top && inPoly(x, y, r.top) ? 2 : 1);
      }
      return lv;
    }
    /* How high a unit stands for seeing over its friends: its level on a hill, or
       up in a high building section, as high as a hill's crown. A reinforced
       building gives Firepower but no height to see over anyone. The Firepower
       for height is levelOf's and the building's own (shoot.js). */
    function sightLevel(state, u) {
      if (u && u.bld) return u.bld.kind !== 'bunker' && sectionHigh(u.bld, sectionRect(u)) ? 2 : 0;
      return levelOf(state, u);
    }
    /* A unit in a wood (or anything else) standing on a hill counts as being in
       that piece only, and takes none of the hill's rules (p. 42). */
    function levelOf(state, u) {
      if (!u || u.x < 0) return 0;
      if (u.bld) return 0;                               // in a building: the building's rules only
      /* Up on the hill if it counts as on it (see kindsUnder), at the lowest
         level of the parts of it that are; not if it is in a wood or the like
         standing on it, which has its own rules only (p. 42). */
      if (kindsUnder(state, u)[0] !== 'hill') return 0;
      return Math.min.apply(null, footprint(u.x, u.y).filter(function (p) {
        return terrainAt(state, p.x, p.y) === 'hill';
      }).map(function (p) { return groundLevel(state, p.x, p.y); }));
    }
    // the upper step of a stepped hill, as a piece of its own for sight lines
    function upperStep(r) {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      r.top.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, poly: r.top };
    }
    /* Aircraft may end a move over any terrain but "very high objects, such as very
       high buildings or mountain peaks" (p. 38): here a high or reinforced
       building, and the crown of a stepped hill. */
    function tooHighToHover(state, x, y) {
      if (groundLevel(state, x, y) >= 2) return true;
      return state.terrain.some(function (r) {
        if (r.kind !== 'building' && r.kind !== 'bunker') return false;
        return sectionsOf(r).some(function (q) { return inRect(x, y, q) && sectionHigh(r, q); });
      });
    }
    function onHill(state, p) { return !!p && p.x >= 0 && terrainAt(state, p.x, p.y) === 'hill'; }

    function unitNear(state, x, y, ignore, pad) {
      for (var i = 0; i < state.units.length; i++) {
        var u = state.units[i];
        if (!u.alive || u === ignore) continue;
        if (Math.hypot(u.x - x, u.y - y) < 2 * UNIT_R + (pad || 0)) return u;
      }
      return null;
    }

    // once every kit is made, the others' functions themselves rather than the stubs for them
    function relink(L) {
      BOARD = L.BOARD; SHAPED = L.SHAPED; STEP = L.STEP; TERRAIN = L.TERRAIN; UNIT_R = L.UNIT_R;
      angleWrap = L.angleWrap; hasOwn = L.hasOwn; isFlying = L.isFlying; nearestClear = L.nearestClear;
      sightRange = L.sightRange; status = L.status;
    }

    return {
      relink: relink,
      centreDist: centreDist, unitDist: unitDist, rectPointDist: rectPointDist, enterable: enterable,
      sectionsOf: sectionsOf, sectionRect: sectionRect, sectionHigh: sectionHigh, occupant: occupant,
      canGarrison: canGarrison, enterTargets: enterTargets, enterBuilding: enterBuilding,
      exitSpots: exitSpots, exitBuilding: exitBuilding, leaveAway: leaveAway, inches: inches, inRect: inRect,
      inPoly: inPoly, pieceDepth: pieceDepth, placePiece: placePiece, turnPoint: turnPoint,
      turnPiece: turnPiece, shapePiece: shapePiece, terrainAt: terrainAt, terrainOf: terrainOf,
      footprint: footprint, kindsUnder: kindsUnder, coverAt: coverAt, segRect: segRect,
      pointSegDist: pointSegDist, hasLoS: hasLoS, lineClear: lineClear, groundLevel: groundLevel,
      levelOf: levelOf, tooHighToHover: tooHighToHover, onHill: onHill, unitNear: unitNear
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCSpace;
})(typeof window !== 'undefined' ? window : global);
