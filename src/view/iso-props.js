/* PMC 2670 — Firefight : the props: the scenery that stands on the table - trees, rocks, crates, sandbags, wrecks and rubble - laid out once for a table and each painted in pixel art, with the few shapes the rest of the renderer borrows for its own.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoProps = function (B) {
    var a = B.a, dot = B.dot, ellipse = B.ellipse, ellipseRing = B.ellipseRing, poly = B.poly, rect = B.rect, rng = B.rng;
    var toScreen = B.toScreen, BAG = B.BAG, BARK = B.BARK, BRICK = B.BRICK;
    var CHAR = B.CHAR, CONCRETE = B.CONCRETE, K = B.K, LEAF = B.LEAF, PIXEL = B.PIXEL, PREFAB = B.PREFAB;
    var ROOF = B.ROOF, STONE = B.STONE;
    // from modules installed after this one: looked up when called
    function depthIn() { return B.depthIn.apply(this, arguments); }
    function pebble() { return B.pebble.apply(this, arguments); }
    function spotIn() { return B.spotIn.apply(this, arguments); }
    // a spot just inside one of a section's four walls, chosen at random
    function edgeSpot(r, rnd) {
      var side = (rnd() * 4) | 0, t = 0.08 + rnd() * 0.84, inset = 0.35;
      return side === 0 ? { x: r.x + r.w * t, y: r.y + inset } : side === 1 ? { x: r.x + r.w - inset, y: r.y + r.h * t }
        : side === 2 ? { x: r.x + r.w * t, y: r.y + r.h - inset } : { x: r.x + inset, y: r.y + r.h * t };
    }
    function vgrad() { return B.vgrad.apply(this, arguments); }

    /* ---------- props ---------- */
    // how a world's woods grow: the share of conifers, and how tall the trees stand
    var FLORA = {
      sparse: { pine: 0.28, tall: 1 }, dense: { pine: 0.2, tall: 1 }, jungle: { pine: 0.04, tall: 1.25 },
      mountain: { pine: 0.7, tall: 1.05 }, industrial: { pine: 0.35, tall: 0.9 }, barren: { pine: 0.8, tall: 0.8 },
      // a desert grows little and low; the arctic grows conifers, stunted
      desert: { pine: 0.1, tall: 0.7 }, arctic: { pine: 0.95, tall: 0.8 },
      unstable: { pine: 0.5, tall: 0.85 }
    };
    // a compound's plating, how high it stands (inches of the art's scale)
    var BULK_H = 6.5;
    function buildProps(terrain, objectives, seed, planet) {
      var props = [];
      /* A compound's entry points (a corridor open onto the table's edge) each get
         a spawn door across the mouth: drawn only, a door like the others, which
         opens for the units coming on through it. */
      if (terrain.some(function (q) { return q.kind === 'bulkhead'; })) {
        var TW = 0, spawn = [];
        terrain.forEach(function (q) { TW = Math.max(TW, q.x + q.w); });
        terrain.forEach(function (q) {
          // (the ground outside a wreck's breach is open ground: nothing stands across it)
          if (q.kind !== 'corridor' || q.h > 3.01 || q.outdoors) return;
          if (q.x <= 0.01) spawn.push({ kind: 'door', x: 0, y: q.y, w: 0.5, h: q.h, spawn: true });
          if (q.x + q.w >= TW - 0.01) spawn.push({ kind: 'door', x: TW - 0.5, y: q.y, w: 0.5, h: q.h, spawn: true });
        });
        if (spawn.length) terrain = terrain.concat(spawn);
      }
      /* A wreck's breaches (a story's 'wreck' skin): outside each, on the ground the
         company comes in over, the hatch that was cut out of her, fallen flat and
         askew, and the cutting rig that did it standing off to one side. */
      /* A wreck's curved outer hull: a wall's height, laid in short runs round each
         outline, but for where her breaches, her pylons and her gangway run through it;
         a sealed hatch on the runs opposite each breach. */
      var hullOf = terrain.filter(function (q) { return q.hull; })[0];
      if (hullOf) {
        var inR = function (rs, x, y) { return rs.some(function (q) { return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h; }); };
        hullOf.hull.shapes.forEach(function (pts, si) {
          var mx = 0, my = 0;
          pts.forEach(function (p) { mx += p[0] / pts.length; my += p[1] / pts.length; });
          pts.forEach(function (p0, pi) {
            var p1 = pts[(pi + 1) % pts.length], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            if (len < 0.01) return;
            var n = Math.max(1, Math.round(len / 1.0)), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
            // (its normal towards her inside)
            var nx = -Math.sin(ang), ny = Math.cos(ang);
            if ((mx - p0[0]) * nx + (my - p0[1]) * ny < 0) { nx = -nx; ny = -ny; }
            for (var k = 0; k < n; k++) {
              var cx = p0[0] + (p1[0] - p0[0]) * (k + 0.5) / n, cy = p0[1] + (p1[1] - p0[1]) * (k + 0.5) / n;
              if (inR(hullOf.hull.gaps, cx, cy)) continue;
              props.push({ kind: 'hullseg', x: cx, y: cy, ang: ang, len: len / n + 0.04, nx: nx, ny: ny, height: a(BULK_H), plain: true,
                hatch: inR(hullOf.hull.hatches, cx, cy), seed: si * 997 + pi * 31 + k });
            }
          });
        });
        // (one lamp to a hatch, over its middle run)
        (hullOf.hull.hatches || []).forEach(function (h) {
          var best = null, bd = 1e9, hx = h.x + h.w / 2, hy = h.y + h.h / 2;
          props.forEach(function (q) { if (q.kind === 'hullseg' && q.hatch) { var d = Math.hypot(q.x - hx, q.y - hy); if (d < bd && inR([h], q.x, q.y)) { bd = d; best = q; } } });
          if (best) best.lamp = true;
        });
      }
      /* Pell's rocks, strewn about the ground round the wreck: clusters of boulders, none
         against her hull, on the ground outside her breaches (where each side sets up), or
         across her gangway (drawn only: the ground out there is solid to the rules). */
      if (hullOf) {
        var rkr = rng(seed + 4271), clear = terrain.filter(function (q) { return !q.outside; });
        var nearHull = function (x, y, m) {
          return hullOf.hull.shapes.some(function (pts) {
            var inside = false;
            for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              var p0 = pts[i], p1 = pts[j];
              if ((p0[1] > y) !== (p1[1] > y) && x < (p1[0] - p0[0]) * (y - p0[1]) / (p1[1] - p0[1]) + p0[0]) inside = !inside;
              var dx = p1[0] - p0[0], dy = p1[1] - p0[1], t = Math.max(0, Math.min(1, ((x - p0[0]) * dx + (y - p0[1]) * dy) / (dx * dx + dy * dy || 1)));
              if (Math.hypot(x - p0[0] - t * dx, y - p0[1] - t * dy) < m) return true;
            }
            return inside;
          });
        };
        var rockOk = function (x, y, m) {
          return x > m && y > m && x < TW - m && y < TW - m && !nearHull(x, y, m) &&
            !clear.some(function (q) { return x > q.x - m && x < q.x + q.w + m && y > q.y - m && y < q.y + q.h + m; }) &&
            !props.some(function (q) { return q.kind === 'rock' && Math.hypot(q.x - x, q.y - y) < (q.rad || 1) * 0.7 + m * 0.5; });
        };
        for (var rc = 0, tries = 0; rc < 30 && tries < 900; tries++) {
          var rcx = 1 + rkr() * (TW - 2), rcy = 1 + rkr() * (TW - 2);
          if (!rockOk(rcx, rcy, 1.6)) continue;
          rc++;
          for (var rk = 0, nk = 2 + (rkr() * 5 | 0); rk < nk; rk++) {
            var rx = rcx + (rkr() - 0.5) * 2.8, ry = rcy + (rkr() - 0.5) * 2.8, rad = rk === 0 ? 1.0 + rkr() * 1.2 : 0.35 + rkr() * 0.7;
            if (rk && !rockOk(rx, ry, 1.1)) continue;
            props.push({ kind: 'rock', x: rk ? rx : rcx, y: rk ? ry : rcy, rad: rad, h: a(1.2 + rad * 1.6 + rkr() * 1.4), seed: (rkr() * 9999) | 0 });
          }
        }
      }
      /* Her damage, inside: on her decks, scorches where fires burned out, plating torn up,
         girders down and rubble, more of it in the bigger rooms; never under her cargo or her
         machinery (drawn only: none of it is terrain). */
      if (hullOf) {
        var dmr = rng(seed + 9133);
        var held2 = terrain.filter(function (q) { return ['crates', 'machinery', 'pillar', 'barricade'].indexOf(q.kind) >= 0; });
        terrain.forEach(function (q) {
          if ((q.kind !== 'room' && q.kind !== 'corridor' && q.kind !== 'hall') || q.outdoors || q.w < 1.5 || q.h < 1.5) return;
          var nd = Math.max(1, Math.round(q.w * q.h / 14 + dmr() * 1.5));
          for (var d = 0, tries2 = 0; d < nd && tries2 < nd * 8; tries2++) {
            var dx = q.x + 0.8 + dmr() * (q.w - 1.6), dy = q.y + 0.8 + dmr() * (q.h - 1.6);
            if (held2.some(function (h) { return dx > h.x - 0.6 && dx < h.x + h.w + 0.6 && dy > h.y - 0.6 && dy < h.y + h.h + 0.6; })) continue;
            d++;
            var big = q.w * q.h > 40;
            props.push({ kind: 'debris', x: dx, y: dy, size: 0.7 + dmr() * 0.6, scorch: dmr() < 0.55, plates: dmr() < 0.6 ? 1 + (dmr() * 3 | 0) : 0,
              beam: dmr() < (big ? 0.35 : 0.15), rubble: 2 + (dmr() * 5 | 0), spark: dmr() < 0.15, seed: (dmr() * 9999) | 0 });
          }
        });
      }
      var yards = terrain.filter(function (q) { return q.outdoors; });
      if (yards.length) terrain.forEach(function (r, ri) {
        if (r.kind !== 'breached') return;
        var horiz = r.w >= r.h, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        var onYard = function (x, y) { return yards.some(function (q) { return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h; }); };
        var out = (horiz ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]).filter(function (d) { return onYard(cx + d[0] * 1.5, cy + d[1] * 1.5); })[0];
        if (!out) return;
        var br = rng(seed + ri * 313), side = br() < 0.5 ? -1 : 1, px = horiz ? 1 : 0, py = horiz ? 0 : 1;
        props.push({ kind: 'hatchslab', x: cx + out[0] * 1.7 - px * side * 0.3, y: cy + out[1] * 1.7 - py * side * 0.3, w: 2.4, h: 1.7,
          ang: (horiz ? 0 : Math.PI / 2) + (br() - 0.5) * 0.7, seed: (br() * 9999) | 0 });
        props.push({ kind: 'cutrig', x: cx + out[0] * 2.4 + px * side * 2.1, y: cy + out[1] * 2.4 + py * side * 2.1, seed: (br() * 9999) | 0 });
      });
      /* A station's solar arrays: out in the open space round it, one off each
         corner of the table wherever the dark is wide enough to hold one (drawn
         only: nothing stands out there). */
      // (only round a station laid as a compound: a docking ring's open space, `ring`, has its ships out there instead)
      var space = terrain.filter(function (q) { return q.kind === 'bulkhead' && q.space && !q.ring; });
      // the Warren's solid is rock, its doors stone (a story's skin, engine.js)
      var rocky = terrain.some(function (q) { return q.rock; });
      if (space.length) {
        var SW = 0, SH = 0;
        terrain.forEach(function (q) { SW = Math.max(SW, q.x + q.w); SH = Math.max(SH, q.y + q.h); });
        var voidAt = function (x, y) { return space.some(function (q) { return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h; }); };
        // (where each starts: it is slid along to line up with its room below)
        var aw = SW * 0.22, ah = SH * 0.17, ax = SW * 0.06, an = SH * 0.06, as = SH * 0.01;
        [[ax, an, 1, 1], [SW - ax - aw, an, -1, 1], [ax, SH - as - ah, 1, -1], [SW - ax - aw, SH - as - ah, -1, -1]].forEach(function (c, ci) {
          var r = { x: c[0], y: c[1], w: aw, h: ah }, clear = true;
          for (var sx = 0; sx <= 6 && clear; sx++) for (var sy = 0; sy <= 4 && clear; sy++) clear = voidAt(r.x + r.w * sx / 6, r.y + r.h * sy / 4);
          if (!clear) return;
          /* its boom: a truss from the middle of the array's inner edge out to
             the hull, across the table to the end of the north or south module
             where there is one, else down it */
          function run(x, y, dx, dy) {
            for (var d = 0; d < 40; d += 0.25) {
              var px = x + dx * d, py = y + dy * d;
              if (px < 0 || py < 0 || px > SW || py > SH) return null;
              if (!voidAt(px, py)) {
                // the hull's edge exactly: the side of the stretch of open space last crossed
                var lx = px - dx * 0.25, ly = py - dy * 0.25, last = space.filter(function (q) { return lx >= q.x && lx <= q.x + q.w && ly >= q.y && ly <= q.y + q.h; })[0];
                if (last && dx) px = dx > 0 ? last.x + last.w : last.x;
                if (last && dy) py = dy > 0 ? last.y + last.h : last.y;
                return { x: px, y: py, d: d };
              }
            }
            return null;
          }
          var ex = c[2] > 0 ? r.x + r.w : r.x, ey = c[3] > 0 ? r.y + r.h : r.y;
          var alongX = run(ex, r.y + r.h / 2, c[2], 0), alongY = run(r.x + r.w / 2, ey, 0, c[3]);
          /* the array slid along the hull so its spine lines up with the middle
             of the room the boom runs into, where it still has open space round it */
          function roomAt(x, y) { return terrain.filter(function (q) { return (q.kind === 'hall' || q.kind === 'room' || q.kind === 'corridor') && x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h; })[0]; }
          function clearAt(q) { for (var ix = 0; ix <= 6; ix++) for (var iy = 0; iy <= 4; iy++) if (!voidAt(q.x + q.w * ix / 6, q.y + q.h * iy / 4)) return false; return true; }
          var rm = alongX && roomAt(alongX.x + c[2] * 0.6, alongX.y);
          if (rm) {
            var moved = { x: r.x, y: rm.y + rm.h / 2 - r.h / 2, w: r.w, h: r.h };
            if (clearAt(moved)) { r = moved; alongX = run(ex, r.y + r.h / 2, c[2], 0); }
          }
          // (across the table first: into the end of the module beside it)
          var boom = alongX ? { x0: ex, y0: r.y + r.h / 2, x1: alongX.x, y1: alongX.y, axis: 'x' }
            : alongY ? { x0: r.x + r.w / 2, y0: ey, x1: alongY.x, y1: alongY.y, axis: 'y' } : null;
          props.push({ kind: 'solar', x: r.x, y: r.y, w: r.w, h: r.h, toward: { x: c[2], y: c[3] }, boom: boom, seed: 4111 + ci });
          /* its mount, outside against the hull where the boom meets it: flush
             with the wall's face, which stands half its thickness (a fifth of
             an inch) out into the open space, the boom running into it */
          if (boom) {
            var bdx = Math.sign(boom.x1 - boom.x0), bdy = Math.sign(boom.y1 - boom.y0), off = 0.2;
            var mtx = bdx ? (bdx > 0 ? boom.x1 - off - 1 : boom.x1 + off) : boom.x1 - 0.5, mty = bdy ? (bdy > 0 ? boom.y1 - off - 1 : boom.y1 + off) : boom.y1 - 0.5;
            // (the boom runs on through the mount to the hull, the mount drawn over its end)
            // (its footprint takes in the boom as well, so the walls sort with all of it)
            var fx0 = Math.min(mtx, boom.x0, boom.x1) - (bdx ? 0 : 0.4), fx1 = Math.max(mtx + 1, boom.x0, boom.x1) + (bdx ? 0 : 0.4);
            var fy0 = Math.min(mty, boom.y0, boom.y1) - (bdy ? 0 : 0.4), fy1 = Math.max(mty + 1, boom.y0, boom.y1) + (bdy ? 0 : 0.4);
            props.push({ kind: 'solarmount', x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0, box: { x: mtx, y: mty, w: 1, h: 1 }, boom: boom, seed: 4211 + ci });
          }
        });
      }
      /* The stretches of a bulkhead's sides that face a floor, not more plating
         or a door: [side, from, to], the side 'N', 'S', 'W' or 'E' and the run
         along it in inches of the table. */
      var solids = terrain.filter(function (q) { return q.kind === 'bulkhead' || /^door/.test(q.kind); });
      // (the ground outside a wreck's breach is no floor of hers: no hull wall about it)
      var floors = terrain.filter(function (q) { return !q.outdoors && (q.kind === 'corridor' || q.kind === 'room' || q.kind === 'hall' || q.kind === 'breached'); });
      function inAny(list, x, y) {
        for (var i = 0; i < list.length; i++) { var q = list[i]; if (x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h) return true; }
        return false;
      }
      // the room a point is in, as its theme (PMCCompound.roomTheme), or -1 in a corridor or none
      function themeAt(x, y) {
        for (var i = 0; i < floors.length; i++) {
          var q = floors[i];
          if (x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h) { var t = root.PMCCompound ? root.PMCCompound.roomTheme(q) : null; return t == null ? -1 : t; }
        }
        return -1;
      }
      /* The compound's walls as they are drawn (each about its grid line): a block
         of the solid with the sides that face a floor brought out by half a wall, a
         wall between two sections run on by half a wall at each end so two walls
         meet in a full corner, and a door as thick as a wall. The lit lip along a
         wall's top is worked out against these, so it stops where another wall's
         body covers it rather than running on across it. */
      var HW = 0.2;
      function drawnRect(r) {
        var q = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (r.kind === 'bulkhead' && r.thin) {
          if (r.w >= r.h) { q.x -= HW; q.w += HW * 2; } else { q.y -= HW; q.h += HW * 2; }
        } else if (r.kind === 'bulkhead') {
          var faces = {};
          openEdges(r, solids).forEach(function (o) { faces[o[0]] = true; });
          if (faces.W) { q.x -= HW; q.w += HW; }
          if (faces.E) q.w += HW;
          if (faces.N) { q.y -= HW; q.h += HW; }
          if (faces.S) q.h += HW;
        } else if (r.w >= r.h) { q.y = r.y + r.h / 2 - HW; q.h = HW * 2; } else { q.x = r.x + r.w / 2 - HW; q.w = HW * 2; }
        return q;
      }
      /* All the walls as one shape, then cut into pieces that never overlap: on a
         fine grid (a fifth of an inch, which every wall edge falls on) each wall as
         drawn is marked, a door's own stretch of wall left out (it draws its own
         frame), and the marked cells taken a strip at a time into rectangles. Boxes
         that overlapped painted their hidden faces over one another; these only
         meet edge to edge. */
      var wallSet = null;
      function wallPieces() {
        if (wallSet) return wallSet;
        var RES = 0.2, walls = solids.filter(function (q) { return q.kind === 'bulkhead'; }), doors = solids.filter(function (q) { return q.kind !== 'bulkhead'; });
        var W = 0, H = 0;
        terrain.forEach(function (q) { W = Math.max(W, q.x + q.w); H = Math.max(H, q.y + q.h); });
        var NX = Math.ceil(W / RES) + 2, NY = Math.ceil(H / RES) + 2, m = new Uint8Array(NX * NY);
        function mark(q, v) {
          var i0 = Math.max(0, Math.round(q.x / RES)), i1 = Math.min(NX, Math.round((q.x + q.w) / RES));
          var j0 = Math.max(0, Math.round(q.y / RES)), j1 = Math.min(NY, Math.round((q.y + q.h) / RES));
          for (var j = j0; j < j1; j++) for (var i = i0; i < i1; i++) m[j * NX + i] = v;
        }
        walls.forEach(function (q) {
          if (!q.space && !q.outside) { mark(drawnRect(q), 1); return; }
          /* open space round a station: only its hull is drawn, a wall's
             thickness about each stretch that meets a floor, run on at the
             ends so two stretches meet in a corner */
          openEdges(q, solids).forEach(function (o) {
            var lo = o[1] - HW, len = o[2] - o[1] + HW * 2;
            mark(o[0] === 'N' ? { x: lo, y: q.y - HW, w: len, h: HW * 2 } : o[0] === 'S' ? { x: lo, y: q.y + q.h - HW, w: len, h: HW * 2 }
              : o[0] === 'W' ? { x: q.x - HW, y: lo, w: HW * 2, h: len } : { x: q.x + q.w - HW, y: lo, w: HW * 2, h: len }, 1);
          });
        });
        /* A door's frame stops where the wall it meets comes out to its grid line:
           an end already covered by a wall (a fifth of an inch at a time) is the
           wall's, not the door's, so the frame meets that wall flush. */
        function covered(q) {
          var i0 = Math.round(q.x / RES), i1 = Math.round((q.x + q.w) / RES), j0 = Math.round(q.y / RES), j1 = Math.round((q.y + q.h) / RES);
          for (var j = j0; j < j1; j++) for (var i = i0; i < i1; i++) if (!m[j * NX + i]) return false;
          return true;
        }
        var doorBands = doors.map(function (d) {
          var q = drawnRect(d), hz = q.w >= q.h;
          for (var k = 0; k < 3; k++) {
            var a0 = hz ? { x: q.x, y: q.y, w: RES, h: q.h } : { x: q.x, y: q.y, w: q.w, h: RES };
            if (covered(a0)) { if (hz) { q.x += RES; q.w -= RES; } else { q.y += RES; q.h -= RES; } } else break;
          }
          for (var k2 = 0; k2 < 3; k2++) {
            var a1 = hz ? { x: q.x + q.w - RES, y: q.y, w: RES, h: q.h } : { x: q.x, y: q.y + q.h - RES, w: q.w, h: RES };
            if (covered(a1)) { if (hz) q.w -= RES; else q.h -= RES; } else break;
          }
          d._drawn = q;
          return q;
        });
        doorBands.forEach(function (q) { mark(q, 0); });
        var pieces = [];
        for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
          if (m[j * NX + i] !== 1) continue;
          var w = 1;
          while (i + w < NX && m[j * NX + i + w] === 1) w++;
          var h = 1;
          for (; j + h < NY; h++) {
            var full = true;
            for (var k = 0; k < w && full; k++) if (m[(j + h) * NX + i + k] !== 1) full = false;
            if (!full) break;
          }
          for (var jj = j; jj < j + h; jj++) for (var ii = i; ii < i + w; ii++) m[jj * NX + ii] = 2;
          pieces.push({ x: i * RES, y: j * RES, w: w * RES, h: h * RES });
        }
        wallSet = { pieces: pieces, against: pieces.concat(doorBands) };
        return wallSet;
      }
      function openEdges(r, against) {
        var out = [], E = 0.05, ST = 0.1;
        if (!against) against = wallPieces().against;
        [['N', r.x, r.x + r.w, function (t) { return [t, r.y - E]; }], ['S', r.x, r.x + r.w, function (t) { return [t, r.y + r.h + E]; }],
          ['W', r.y, r.y + r.h, function (t) { return [r.x - E, t]; }], ['E', r.y, r.y + r.h, function (t) { return [r.x + r.w + E, t]; }]].forEach(function (S2) {
          var run = null;
          for (var t = S2[1]; t < S2[2] - 1e-6; t += ST) {
            var t1 = Math.min(S2[2], t + ST), q = S2[3]((t + t1) / 2);
            var op = inAny(floors, q[0], q[1]) && !inAny(against, q[0], q[1]);
            // a run breaks where the room in front of it changes (each stretch takes that room's colours)
            var th = op ? themeAt(q[0], q[1]) : -1;
            if (op && run && run[3] === th) run[2] = t1; else if (op) out.push(run = [S2[0], t, t1, th]); else run = null;
          }
        });
        return out;
      }
      var FL = FLORA[planet] || FLORA.sparse;
      terrain.forEach(function (r, ri) {
        var rand = rng(seed + ri * 977 + Math.round(r.x * 13 + r.y * 29));
        var area = r.w * r.h * (r.poly ? 0.72 : 1);
        if (r.kind === 'water' || r.kind === 'deep') {
          var shallow = r.kind === 'water';
          // reeds crowd the margin of a shallow pool; stones sit on either kind of bank
          if (shallow) {
            for (var rd = 0; rd < Math.round(area / 1.6); rd++) {
              var rq = spotIn(r, 0.15, rand);
              if (depthIn(r, rq.x, rq.y) > 0.9 && rand() > 0.15) continue;
              props.push({ kind: 'reeds', x: rq.x, y: rq.y, tone: rand(), seed: (rand() * 9999) | 0 });
            }
            for (var lp = 0; lp < Math.round(area / 7); lp++) {
              var lq = spotIn(r, 1.0, rand);
              props.push({ kind: 'lily', x: lq.x, y: lq.y, tone: rand(), seed: (rand() * 9999) | 0 });
            }
          }
          for (var st = 0; st < Math.round(area / (shallow ? 9 : 6)); st++) {
            var sq = spotIn(r, 0.1, rand);
            if (depthIn(r, sq.x, sq.y) > 0.5) continue;
            props.push({ kind: 'rock', x: sq.x, y: sq.y, rad: 0.3 + rand() * 0.45, h: a(1.5 + rand() * 2), seed: (rand() * 9999) | 0 });
          }
          return;
        }
        if (r.kind === 'crystal') {
          // clusters of glowing green crystal standing up out of the dark ground
          for (var cz = 0; cz < Math.max(3, Math.round(area / 6)); cz++) {
            var czq = spotIn(r, 0.5, rand);
            props.push({ kind: 'crystals', x: czq.x, y: czq.y, size: 1.1 + rand() * 1.1, seed: (rand() * 9999) | 0 });
          }
          return;
        }
        /* The space between a station's two rings: the hull round it, along each
           rim and across each end where a spoke meets it, a single wall's
           height (the outer hull is twice that) and without its hazard paint,
           laid in short runs. (The space itself blocks sight, not the wall.) */
        if (r.gap) {
          var gg = r.gap, rail = function (x0, y0, x1, y1, nx, ny) {
            var len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 1.4));
            for (var rs = 0; rs < n; rs++) {
              var mx = x0 + (x1 - x0) * (rs + 0.5) / n, my = y0 + (y1 - y0) * (rs + 0.5) / n;
              props.push({ kind: 'hullseg', x: mx, y: my, ang: Math.atan2(y1 - y0, x1 - x0), len: len / n + 0.04, nx: nx, ny: ny, height: a(7), plain: true, seed: (rand() * 9999) | 0 });
            }
          };
          var NG = 12;
          for (var gi = 0; gi < NG; gi++) {
            var ga = gg.a0 + (gg.a1 - gg.a0) * gi / NG, gb = gg.a0 + (gg.a1 - gg.a0) * (gi + 1) / NG, gm = (ga + gb) / 2;
            // the outer ring's rim (its deck outside the gap), and the inner ring's (its deck inside)
            rail(gg.cx + gg.r1 * Math.cos(ga), gg.cy + gg.r1 * Math.sin(ga), gg.cx + gg.r1 * Math.cos(gb), gg.cy + gg.r1 * Math.sin(gb), Math.cos(gm), Math.sin(gm));
            rail(gg.cx + gg.r0 * Math.cos(ga), gg.cy + gg.r0 * Math.sin(ga), gg.cx + gg.r0 * Math.cos(gb), gg.cy + gg.r0 * Math.sin(gb), -Math.cos(gm), -Math.sin(gm));
          }
          // across each end, square to the rims, facing the spoke beside it
          [[gg.a0, -1], [gg.a1, 1]].forEach(function (e) {
            var c = Math.cos(e[0]), sn = Math.sin(e[0]);
            rail(gg.cx + gg.r0 * c, gg.cy + gg.r0 * sn, gg.cx + gg.r1 * c, gg.cy + gg.r1 * sn, -sn * e[1], c * e[1]);
          });
          return;
        }
        if (r.kind === 'ravine') return;               // nothing stands in a crevasse
        if (r.kind === 'lava') {
          // smoke and heat rising out of the crack
          for (var vt = 0; vt < Math.max(1, Math.round(area / 22)); vt++) {
            var vq = spotIn(r, 1.2, rand);
            props.push({ kind: 'vent', x: vq.x, y: vq.y, tone: rand(), seed: (rand() * 9999) | 0 });
          }
          return;
        }
        if (r.kind === 'crater' && r.cargo) {
          /* A map's cargo stacks (a crater field by the rules): stacks of crates
             in rows, with walkways between them wide enough to get through. */
          var CELL = 1.8, AISLE = 0.7;
          var gcx = Math.max(1, Math.floor((r.w + AISLE) / CELL)), gcy = Math.max(1, Math.floor((r.h + AISLE) / CELL));
          var sw = (r.w - AISLE * (gcx - 1)) / gcx, sh = (r.h - AISLE * (gcy - 1)) / gcy;
          for (var gx = 0; gx < gcx; gx++) {
            for (var gy = 0; gy < gcy; gy++) {
              if (gcx * gcy > 2 && rand() < 0.15) continue;      // a gap where a stack has gone
              props.push({ kind: 'crates', x: r.x + gx * (sw + AISLE) + 0.1, y: r.y + gy * (sh + AISLE) + 0.1, w: sw - 0.2, h: sh - 0.2,
                height: a(5 + rand() * 6), seed: (rand() * 9999) | 0 });
            }
          }
          return;
        }
        // a camp's open-sided tent, the sale tent's (a crater field by the rules)
        if (r.kind === 'crater' && r.camp === 'marquee') {
          props.push({ kind: 'marquee', x: r.x + r.w / 2, y: r.y + r.h / 2, seed: (rand() * 9999) | 0 });
          return;
        }
        if (r.kind === 'crater' && r.camp) {
          /* A field camp's tents (a crater field by the rules): rows of them,
             spread evenly over the ground, with walkways between them. */
          var TW = 2.4, TH = 1.8, TA = 0.8;
          var tcx = Math.max(1, Math.floor((r.w + TA) / (TW + TA))), tcy = Math.max(1, Math.floor((r.h + TA) / (TH + TA)));
          for (var tx2 = 0; tx2 < tcx; tx2++) {
            for (var ty2 = 0; ty2 < tcy; ty2++) {
              props.push({ kind: 'tent', x: r.x + (tcx > 1 ? tx2 * (r.w - TW) / (tcx - 1) : (r.w - TW) / 2), y: r.y + (tcy > 1 ? ty2 * (r.h - TH) / (tcy - 1) : (r.h - TH) / 2),
                w: TW, h: TH, height: a(10), seed: (rand() * 9999) | 0 });
            }
          }
          return;
        }
        if (r.kind === 'crater' && r.market) {
          // a settlement's crater field (the market skin): the market's overflow, cargo cases, fuel drums and vending terminals on the paving
          for (var mk = 0; mk < Math.max(3, Math.round(area / 2.5)); mk++) {
            var mq = spotIn(r, 0.5, rand), mr = rand();
            props.push({ kind: mr < 0.45 ? 'smallbox' : mr < 0.7 ? 'drums' : 'console', x: mq.x, y: mq.y, n: 1 + Math.floor(rand() * 2), tone: rand(), seed: (rand() * 9999) | 0 });
          }
          return;
        }
        if (r.kind === 'crater') {
          // the debris of whatever was shelled here: stone, and the odd twisted girder
          for (var db = 0; db < Math.round(area / 3); db++) {
            var dq = spotIn(r, 0.3, rand);
            props.push({ kind: 'rubble', x: dq.x, y: dq.y, tone: rand(), seed: (rand() * 9999) | 0 });
          }
          for (var sc3 = 0; sc3 < Math.round(area / 18); sc3++) {
            var sq2 = spotIn(r, 0.6, rand);
            props.push({ kind: 'scrap', x: sq2.x, y: sq2.y, tone: rand(), seed: (rand() * 9999) | 0 });
          }
          return;
        }
        if (r.pipe) {
          /* A map's pipeline (a low wall by the rules): a fat pipe on trestles,
             laid down its length in short runs so it sorts among the models. */
          var phz = r.w >= r.h, plen = phz ? r.w : r.h, pn = Math.max(1, Math.round(plen / 1.5)), psl = plen / pn;
          for (var ps2 = 0; ps2 < pn; ps2++) {
            var pm = (ps2 + 0.5) * psl;
            props.push({ kind: 'piperun', x: phz ? r.x + pm : r.x + r.w / 2, y: phz ? r.y + r.h / 2 : r.y + pm, horiz: phz, len: psl,
              first: ps2 === 0, last: ps2 === pn - 1, seed: (rand() * 9999) | 0 });
          }
          /* A fuel line's end at a station's hull (`feed`): it climbs the hull's
             face from the deck and goes into it at a coupling. Drawn only. */
          if (r.feed) props.push({ kind: 'fuelline', x: r.x + r.w / 2, y: r.y + 0.3, pts: [[r.x + r.w / 2, r.y + 0.05, 0], [r.x + r.w / 2, r.y + 0.05, a(8)]], seed: (rand() * 9999) | 0 });
          return;
        }
        if (r.kind === 'woods') {
          // the floor of a wood: fallen trunks, stumps and ferns under the canopy
          for (var lg = 0; lg < Math.max(1, Math.round(area / 16)); lg++) {
            var lq2 = spotIn(r, 1.0, rand);
            props.push({ kind: 'log', x: lq2.x, y: lq2.y, ang: rand() * Math.PI, len: a(5 + rand() * 6), tone: rand(), seed: (rand() * 9999) | 0 });
          }
          for (var sp5 = 0; sp5 < Math.round(area / 14); sp5++) {
            var sq3 = spotIn(r, 0.6, rand);
            props.push({ kind: 'stump', x: sq3.x, y: sq3.y, tone: rand(), seed: (rand() * 9999) | 0 });
          }
          for (var fn = 0; fn < Math.round(area / 2.2); fn++) {
            var fq = spotIn(r, 0.35, rand);
            props.push({ kind: 'fern', x: fq.x, y: fq.y, tone: rand(), seed: (rand() * 9999) | 0 });
          }
        }
        if (r.kind === 'woods') {
          var n = Math.max(5, Math.round(area / 2.6));
          for (var i = 0; i < n; i++) {
            // kept a canopy's width inside the edge, so the foliage does not
            // hang over ground that gives no cover
            var ts = spotIn(r, 1.0, rand);
            props.push({
              kind: 'tree',
              x: ts.x,
              y: ts.y,
              h: a((7 + rand() * 5) * FL.tall),
              rad: a(2.6 + rand() * 1.9),
              // the tone picks the tree: below the world's conifer share, a conifer
              tone: rand() < FL.pine ? rand() * 0.27 : 0.28 + rand() * 0.72, seed: (rand() * 9999) | 0
            });
          }
          var b = Math.round(area / 3);
          for (var j = 0; j < b; j++) {
            var bs = spotIn(r, 0.5, rand);
            props.push({
              kind: 'bush',
              x: bs.x,
              y: bs.y,
              rad: a(2 + rand() * 1.5), tone: rand()
            });
          }
        } else if (r.kind === 'rocks') {
          var nr = Math.max(3, Math.round(area / 2.2));
          for (var k = 0; k < nr; k++) {
            var rs2 = spotIn(r, 1.0, rand);
            props.push({
              kind: 'rock',
              x: rs2.x,
              y: rs2.y,
              rad: 1 + rand() * 1.4, h: a(4 + rand() * 5), seed: (rand() * 9999) | 0
            });
          }
        } else if (r.kind === 'barricade' && r.market) {
          /* A settlement's barricade (a map's market skin, storybattle.js): a
             stretch of boulevard, steel railings with glass between the rails,
             planters with a tree in each, and a street lamp at its head. */
          var mhz = r.w > r.h, mln = mhz ? r.w : r.h, nst = Math.max(2, Math.round(mln / 1.25)), msl = mln / nst;
          for (var st = 0; st < nst; st++) {
            var smd2 = (st + 0.5) * msl;
            props.push({ kind: 'railing', x: mhz ? r.x + smd2 : r.x + r.w / 2, y: mhz ? r.y + r.h / 2 : r.y + smd2, horiz: mhz, len: msl,
              planter: st % 2 === 1, lamp: st === 0, tone: rand(), seed: (rand() * 9999) | 0 });
          }
        } else if (r.kind === 'barricade' && r.carapace) {
          /* The hive's barrier, a Ballistic Barrier or a barricade alike: shed
             carapace, curved plates stood on edge and overlapping down the line,
             so it reads as grown, not built. */
          var chz = r.w > r.h, cln = chz ? r.w : r.h, nch = Math.max(2, Math.round(cln / 0.9)), csl = cln / nch, ctone = rand();
          for (var ch = 0; ch < nch; ch++) {
            var cmd = (ch + 0.5) * csl;
            props.push({ kind: 'carapace', x: chz ? r.x + cmd : r.x + r.w / 2, y: chz ? r.y + r.h / 2 : r.y + cmd, horiz: chz, len: csl + 0.12,
              height: a((r.shield ? 3.6 : 3) + rand() * 1.2), tone: ctone, seed: (rand() * 9999) | 0 });
          }
        } else if (r.kind === 'barricade' && r.shield) {
          /* A Ballistic Barrier: portable shields stood edge to edge along the
             line, each its own plate, so it reads as kit set down, not a wall. */
          var shz = r.w > r.h, sln = shz ? r.w : r.h, nsh = Math.max(2, Math.round(sln / 0.8)), ssl = sln / nsh;
          for (var sh = 0; sh < nsh; sh++) {
            var smd = (sh + 0.5) * ssl;
            props.push({ kind: 'shield', x: shz ? r.x + smd : r.x + r.w / 2, y: shz ? r.y + r.h / 2 : r.y + smd, horiz: shz, len: ssl - 0.06, face: r.face, height: a(3.4), seed: (rand() * 9999) | 0 });
          }
        } else if (r.kind === 'barricade') {
          /* one continuous wall of bags down the length of the piece, laid in
             short runs so each can be drawn in its place among the models */
          var horiz = r.w > r.h;
          var len = horiz ? r.w : r.h, SEG = 1.5;
          var nseg = Math.max(1, Math.round(len / SEG)), sl = len / nseg;
          for (var s = 0; s < nseg; s++) {
            var mid = (s + 0.5) * sl;
            props.push({
              kind: 'sandbag',
              x: horiz ? r.x + mid : r.x + r.w / 2,
              y: horiz ? r.y + r.h / 2 : r.y + mid,
              horiz: horiz, len: sl, first: s === 0, last: s === nseg - 1,
              tone: rand(), seed: (rand() * 9999) | 0
            });
          }
        } else if (r.kind === 'trench' || r.kind === 'wire' || r.kind === 'cutwire') {
          /* A trench: a single course of bags along each lip of the slot. Barbed
             wire: pickets along the line with the coils strung between them. */
          var hz2 = r.w > r.h, ln2 = hz2 ? r.w : r.h, SG = 1.5;
          var ns2 = Math.max(1, Math.round(ln2 / SG)), sl2 = ln2 / ns2;
          for (var s3 = 0; s3 < ns2; s3++) {
            var md = (s3 + 0.5) * sl2;
            // cut wire: the coils left at each end, the gap Sappers blew between them
            if (r.kind === 'cutwire' && (ns2 < 3 ? s3 > 0 : s3 > 0 && s3 < ns2 - 1)) continue;
            if (r.kind === 'wire' || r.kind === 'cutwire') {
              props.push({
                kind: 'wire', x: hz2 ? r.x + md : r.x + r.w / 2, y: hz2 ? r.y + r.h / 2 : r.y + md,
                horiz: hz2, len: sl2, seed: (rand() * 9999) | 0
              });
              continue;
            }
            [0.15, -0.15].forEach(function (side) {
              var off = (hz2 ? r.h : r.w) / 2 - 0.15;
              props.push({
                kind: 'sandbag', courses: 1,
                x: hz2 ? r.x + md : r.x + r.w / 2 + (side > 0 ? off : -off),
                y: hz2 ? r.y + r.h / 2 + (side > 0 ? off : -off) : r.y + md,
                horiz: hz2, len: sl2, first: s3 === 0, last: s3 === ns2 - 1,
                tone: rand(), seed: (rand() * 9999) | 0
              });
            });
          }
        } else if (r.kind === 'ruins') {
          var th = 0.5, inset = 0.5;
          var runs = [];
          function runH(yy) {
            var c = r.x + inset + rand() * 0.8;
            while (c < r.x + r.w - inset) {
              var seg = 1 + rand() * 2.6;
              if (rand() > 0.32) runs.push({ x: c, y: yy, w: Math.min(seg, r.x + r.w - inset - c), h: th });
              c += seg + 0.4 + rand() * 1.6;
            }
          }
          function runV(xx) {
            var c = r.y + inset + rand() * 0.8;
            while (c < r.y + r.h - inset) {
              var seg = 1 + rand() * 2.6;
              if (rand() > 0.32) runs.push({ x: xx, y: c, w: th, h: Math.min(seg, r.y + r.h - inset - c) });
              c += seg + 0.4 + rand() * 1.6;
            }
          }
          runH(r.y + inset); runH(r.y + r.h - inset - th);
          runV(r.x + inset); runV(r.x + r.w - inset - th);
          if (r.h > 7) runH(r.y + r.h / 2);
          if (r.w > 7) runV(r.x + r.w / 2);
          runs.forEach(function (s2) {
            props.push({
              kind: 'wall', x: s2.x, y: s2.y, w: s2.w, h: s2.h,
              height: a(5 + rand() * 5), seed: (rand() * 9999) | 0
            });
          });
          var rub = Math.round(r.w * r.h / 2.2);
          for (var q = 0; q < rub; q++) {
            props.push({
              kind: 'rubble', x: r.x + rand() * r.w, y: r.y + rand() * r.h,
              tone: rand(), seed: (rand() * 9999) | 0
            });
          }
        }
      });
      terrain.forEach(function (r, ri) {
        var rr2 = rng(seed + ri * 419 + 77);
        /* A compound's section (Close Encounters, p. 159): fuel drums where it is
           dangerous, scorched wreckage where it went up, fire where it burns. */
        // the automated defence system's control panel (Close Encounters, p. 160)
        if (r.kind === 'panel') { props.push({ kind: 'console', x: r.x + r.w / 2, y: r.y + r.h / 2, seed: (rr2() * 9999) | 0 }); return; }
        /* A brood chamber (the Hive Heart): grown over. Resin heaped against the
           walls and spread over the floor, and clutches of eggs in among it;
           burnt out, the same, black and split. */
        if ((r.kind === 'room' || r.kind === 'hall') && r.hive) {
          var hs = r.w * r.h, burnt = !!r.burnt;
          for (var hg = 0; hg < Math.round(hs / 4); hg++) {
            // most of it along the walls, climbing them; some out on the floor
            var edge = rr2() < 0.7, hq = edge ? edgeSpot(r, rr2) : spotIn(r, 0.8, rr2);
            props.push({ kind: 'hivegrowth', x: hq.x, y: hq.y, rad: 0.5 + rr2() * (edge ? 0.9 : 0.6), up: edge ? 0.6 + rr2() * 0.8 : 0.15 + rr2() * 0.2,
              burnt: burnt, tone: rr2(), seed: (rr2() * 9999) | 0 });
          }
          for (var he = 0; he < Math.max(3, Math.round(hs / 14)); he++) {
            var eq = spotIn(r, 1.2, rr2);
            props.push({ kind: 'eggs', x: eq.x, y: eq.y, n: 3 + (rr2() * 4 | 0), burnt: burnt, tone: rr2(), seed: (rr2() * 9999) | 0 });
          }
          return;
        }
        if ((r.kind === 'corridor' || r.kind === 'room' || r.kind === 'hall') && !r.outdoors) {
          var sa = r.w * r.h;
          /* The small clutter of a lived-in compound, drawn only (nothing a rule
             reads): deck grates, cable runs, the odd box, litter. A long corridor
             gets its share too; nothing goes down on a fitting. */
          var fits = terrain.filter(function (q) { return q.kind === 'crates' || q.kind === 'machinery'; });
          var nDet = Math.round(sa / (r.kind === 'corridor' ? 9 : 7));
          for (var dt = 0; dt < nDet; dt++) {
            var dq = spotIn(r, 0.55, rr2), dk = rr2();
            if (fits.some(function (q) { return dq.x > q.x - 0.5 && dq.x < q.x + q.w + 0.5 && dq.y > q.y - 0.5 && dq.y < q.y + q.h + 0.5; })) continue;
            // (the Warren's: fallen rock and the Reavers' junk)
            var dkind = r.warren ? (dk < 0.45 ? 'rubble' : dk < 0.7 ? 'scrap' : 'litter')
              : dk < 0.3 ? 'deckgrate' : dk < 0.55 ? 'cable' : dk < 0.8 ? 'smallbox' : 'litter';
            props.push({ kind: dkind, x: dq.x, y: dq.y, horiz: r.w >= r.h, tone: rr2(), seed: (rr2() * 9999) | 0 });
          }
          /* The Warren's fallen rock, heaped against the walls in a patch or two,
             and the Reavers' floodlights on their stands, aimed into the room. */
          if (r.warren) {
            var clearOf = function (q2) { return !fits.some(function (q) { return q2.x > q.x - 1 && q2.x < q.x + q.w + 1 && q2.y > q.y - 1 && q2.y < q.y + q.h + 1; }); };
            var nRock = r.kind === 'corridor' ? (rr2() < 0.4 ? 1 : 0) : 1 + (rr2() < 0.6 ? 1 : 0);
            for (var fr = 0; fr < nRock; fr++) {
              var fq = edgeSpot(r, rr2);
              if (!clearOf(fq)) continue;
              for (var fs = 0; fs < 5 + (rr2() * 4 | 0); fs++) {
                var fx = Math.max(r.x + 0.4, Math.min(r.x + r.w - 0.4, fq.x + (rr2() - 0.5) * 2.4)), fy = Math.max(r.y + 0.4, Math.min(r.y + r.h - 0.4, fq.y + (rr2() - 0.5) * 2.4));
                props.push({ kind: rr2() < 0.65 ? 'wreckstone' : 'rubble', x: fx, y: fy, tone: rr2() * 0.4, seed: (rr2() * 9999) | 0 });
              }
            }
            var nLamp = r.hoard ? 2 : r.kind === 'corridor' ? (rr2() < 0.3 ? 1 : 0) : 1;
            for (var fl = 0; fl < nLamp; fl++) {
              var lq2 = edgeSpot(r, rr2);
              if (!clearOf(lq2)) continue;
              var cxl = r.x + r.w / 2, cyl = r.y + r.h / 2;
              props.push({ kind: 'floodlight', x: lq2.x, y: lq2.y, aim: Math.atan2(cyl - lq2.y, cxl - lq2.x), seed: (rr2() * 9999) | 0 });
            }
          }
          /* The Reavers' hoard (the Warren's biggest chamber on the far side):
             relics on stone plinths in rows, kept like a library's shelves. */
          if (r.hoard) {
            for (var hy = r.y + 1.4; hy < r.y + r.h - 1; hy += 2.2) {
              for (var hx = r.x + 1.4; hx < r.x + r.w - 1; hx += 1.8) {
                if (fits.some(function (q) { return hx > q.x - 0.8 && hx < q.x + q.w + 0.8 && hy > q.y - 0.8 && hy < q.y + q.h + 0.8; })) continue;
                props.push({ kind: 'relic', x: hx, y: hy, tone: rr2(), seed: (rr2() * 9999) | 0 });
              }
            }
          }
          // the gate the company came through, closing: a ring of light standing across the corridor at the table's edge
          if (r.gate) {
            var gz = r.w >= r.h;
            props.push({ kind: 'gatering', x: gz ? r.x + 0.4 : r.x + r.w / 2, y: gz ? r.y + r.h / 2 : r.y + 0.4, horiz: gz, span: gz ? r.h : r.w, height: a(BULK_H), seed: (rr2() * 9999) | 0 });
          }
          if (r.dangerous) {
            for (var dr = 0; dr < Math.max(2, Math.round(sa / 14)); dr++) {
              var dq = spotIn(r, 0.9, rr2);
              props.push({ kind: 'drums', x: dq.x, y: dq.y, n: 2 + (rr2() * 2 | 0), seed: (rr2() * 9999) | 0 });
            }
          }
          if (r.blown) {
            for (var bw = 0; bw < Math.max(3, Math.round(sa / 6)); bw++) {
              var bq = spotIn(r, 0.4, rr2);
              props.push({ kind: rr2() < 0.5 ? 'scrap' : 'wreckstone', x: bq.x, y: bq.y, tone: rr2(), seed: (rr2() * 9999) | 0 });
            }
          }
          if (r.burning) {
            for (var fl = 0; fl < Math.max(2, Math.round(sa / 5)); fl++) {
              var fq = spotIn(r, 0.5, rr2);
              props.push({ kind: 'flame', x: fq.x, y: fq.y, tone: rr2(), seed: (rr2() * 9999) | 0 });
            }
          }
          return;
        }
        if (r.kind === 'razed') {
          // a flattened wall along the line it held: burst sandbags where it was a low wall, broken blocks otherwise
          var hz = r.w > r.h, ln = hz ? r.w : r.h, bags = r.was === 'barricade';
          for (var q = 0.2; q < ln - 0.1; q += bags ? 0.75 : 0.5) {
            props.push({
              kind: bags ? 'wreckbag' : 'wreckstone',
              x: hz ? r.x + q : r.x + r.w / 2 + (rr2() - 0.5) * 0.5,
              y: hz ? r.y + r.h / 2 + (rr2() - 0.5) * 0.5 : r.y + q,
              tone: rr2(), seed: (rr2() * 9999) | 0
            });
          }
          return;
        }
        if (r.kind === 'burning') {
          (r.parts || [r]).forEach(function (q) {
            props.push({
              kind: 'burntshell', x: q.x, y: q.y, w: q.w, h: q.h,
              height: a(5 + rr2() * 3), seed: (rr2() * 9999) | 0
            });
          });
          var fires = Math.max(3, Math.round(r.w * r.h / 3)), fs;
          for (var f = 0; f < fires; f++) {
            props.push({
              kind: 'flame',
              x: (fs = spotIn(r, 0.4, rr2)).x,
              y: fs.y,
              tone: rr2(), seed: (rr2() * 9999) | 0
            });
          }
          return;
        }
        /* Find and secure: a possible location — scattered wreckage around a hatch,
           with a surveyor's stake so it reads as somewhere worth searching. Once a
           unit has checked it and come up empty the stake goes over and the tag
           greys out, so the table always shows what is left to look at. */
        if (r.kind === 'searchsite') {
          props.push({
            kind: 'searchsite', x: r.x + r.w / 2, y: r.y + r.h / 2,
            checked: !!r.checked, found: !!r.found, cold: !!r.cold, cargo: r.skin === 'cargo', skin: r.skin || null,
            seed: (rr2() * 9999) | 0
          });
          // a port's possible location is a pallet of cargo, with cases set down round it
          if (r.skin === 'cargo') {
            for (var cs2 = 0; cs2 < 4; cs2++) {
              props.push({ kind: 'smallbox', x: r.x + 0.5 + rr2() * (r.w - 1), y: r.y + 0.5 + rr2() * (r.h - 1), tone: rr2(), seed: (rr2() * 9999) | 0 });
            }
            return;
          }
          // a drowned beacon's possible locations are their own pieces, with nothing strewn round them
          if (r.skin === 'spire' || r.skin === 'shrine' || r.skin === 'stones' || r.skin === 'boats' || r.skin === 'tent') return;
          for (var sw = 0; sw < 6; sw++) {
            props.push({
              kind: 'wreckstone',
              x: r.x + 0.4 + rr2() * (r.w - 0.8),
              y: r.y + 0.4 + rr2() * (r.h - 0.8),
              tone: rr2(), seed: (rr2() * 9999) | 0
            });
          }
          return;
        }
        if (r.kind === 'wall') {
          /* a high wall is a run of cast panels between posts, laid down its
             length in short runs like the sandbags so it sorts among the models */
          var wr = rng(seed + ri * 613 + Math.round(r.x * 7));
          var whz = r.w >= r.h, wlen = whz ? r.w : r.h, WSEG = 1.5;
          var wn = Math.max(1, Math.round(wlen / WSEG)), wsl = wlen / wn;
          var wire = wr() < 0.45, wh3 = a(10 + wr() * 2.5);
          // a warehouse's steel cladding stands taller, and neither it nor a strongroom's wall is wired
          if (r.shed) wh3 = a(15);
          // (a station's hull, seen from inside the ring: a low rim, so the ships docked beyond it show over it)
          if (r.hull) wh3 = a(14);
          if (r.shed || r.vault || r.hull) wire = false;
          for (var ws = 0; ws < wn; ws++) {
            var wm = (ws + 0.5) * wsl;
            props.push({
              kind: 'wallrun', x: whz ? r.x + wm : r.x + r.w / 2, y: whz ? r.y + r.h / 2 : r.y + wm,
              horiz: whz, len: wsl, first: ws === 0, last: ws === wn - 1, wire: wire, height: wh3,
              reinforced: !!r.reinforced, shed: !!r.shed, hull: !!r.hull, seed: (wr() * 9999) | 0
            });
          }
          /* A warehouse wall that ends at an opening (a story map's `opening`): a
             hangar's sliding leaves run back along it, or a doorway's jamb; the
             header across the opening, or the wall carried over the doorway,
             from the wall on its near side (`end` +1), so it goes down once. */
          if (r.shed && r.opening) {
            var oe = r.end > 0 ? (whz ? r.x + r.w : r.y + r.h) : (whz ? r.x : r.y), ol = whz ? r.y + r.h / 2 : r.x + r.w / 2;
            var oat = function (t) { return whz ? { x: oe + t, y: ol } : { x: ol, y: oe + t }; };
            if (r.opening === 'slide') {
              var lq = oat(-r.end * (r.gap / 4 + 0.15));
              props.push({ kind: 'hangarleaves', x: lq.x, y: lq.y, horiz: whz, dir: r.end, len: r.gap / 2, height: wh3, seed: (wr() * 9999) | 0 });
            }
            if (r.end > 0) {
              var mq = oat(r.gap / 2);
              props.push({ kind: 'shedopening', style: r.opening, x: mq.x, y: mq.y, horiz: whz, gap: r.gap, height: wh3, seed: (wr() * 9999) | 0 });
            }
          }
          return;
        }
        /* A compound (Close Encounters): the solid between the floors as blocks
           of plating, all one height so the solid reads as one mass, with a lit
           lip only along the edges that face a floor (a squad behind it is
           outlined through it), and each door as a hatch framed in the same
           plating. */
        // a room's fittings (compound.js fit): crates and lockers, and banks of machinery
        // a room's pillar: the walls' plating, the room's colours, the walls' height
        if (r.kind === 'pillar') {
          props.push({ kind: 'bulkhead', x: r.x, y: r.y, w: r.w, h: r.h, height: a(BULK_H), thin: true, pillar: true, rock: rocky,
            open: [['N', r.x, r.x + r.w, themeAt(r.x + r.w / 2, r.y - 0.3)], ['S', r.x, r.x + r.w, themeAt(r.x + r.w / 2, r.y + r.h + 0.3)],
              ['W', r.y, r.y + r.h, themeAt(r.x - 0.3, r.y + r.h / 2)], ['E', r.y, r.y + r.h, themeAt(r.x + r.w + 0.3, r.y + r.h / 2)]], seed: (rr2() * 9999) | 0 });
          return;
        }
        if (r.kind === 'crates' || r.kind === 'machinery') {
          props.push({ kind: r.kind, x: r.x, y: r.y, w: r.w, h: r.h, height: a(r.kind === 'machinery' ? 5.2 : 2.4), seed: r.seed || (rr2() * 9999) | 0 });
          return;
        }
        /* A station ring's hull, along the curve where its deck meets open space:
           laid in short straight runs so it sorts among the models. */
        if (r.kind === 'bulkhead' && r.ring) {
          var rg2 = r.ring, nseg = Math.max(4, Math.round(Math.abs(rg2.a1 - rg2.a0) * rg2.r / 1.4));
          for (var hs = 0; hs < nseg; hs++) {
            var ta = rg2.a0 + (rg2.a1 - rg2.a0) * hs / nseg, tb = rg2.a0 + (rg2.a1 - rg2.a0) * (hs + 1) / nseg, tm = (ta + tb) / 2;
            props.push({ kind: 'hullseg', x: rg2.cx + rg2.r * Math.cos(tm), y: rg2.cy + rg2.r * Math.sin(tm), ang: tm + Math.PI / 2,
              len: rg2.r * Math.abs(tb - ta) + 0.05, nx: -Math.cos(tm), ny: -Math.sin(tm), height: a(14), first: hs === 0, seed: (rr2() * 9999) | 0 });
          }
          return;
        }
        if (r.kind === 'bulkhead') {
          /* Every wall drawn about the grid line it stands on: a wall between two
             sections is already half its thickness either side of the line, so a
             block of the solid has each side that faces a floor brought out by half
             a wall too, and a wall between two sections is run on into its corners
             (drawnRect) — so faces, walls and doors all line up. (Drawn only: the
             rules keep the solid where it is.) */
          if (wallSet && wallSet.laid) return;          // the whole shape went down with the first wall
          wallPieces().laid = true;
          wallSet.pieces.forEach(function (q, n) {
            var oe = openEdges(q);
            props.push({ kind: 'bulkhead', x: q.x, y: q.y, w: q.w, h: q.h, height: a(BULK_H), thin: Math.min(q.w, q.h) < 0.5, open: oe, rock: rocky, seed: (seed * 31 + n * 7919) % 9999 });
            /* The Warren's rock (not its hoard chamber's worked walls): outcrops
               bulging from the face along every tunnel and chamber, shallow and
               deep, low and full height, so its edges wander as a cave's do.
               Drawn only: the rules keep the wall where it is. */
            if (rocky) {
              var orr = rng(seed * 7 + n * 131 + 5);
              oe.forEach(function (o) {
                if (o[3] !== 7) return;
                var out = o[0] === 'S' || o[0] === 'E' ? 1 : -1, alongX = o[0] === 'N' || o[0] === 'S';
                var line = o[0] === 'N' ? q.y : o[0] === 'S' ? q.y + q.h : o[0] === 'W' ? q.x : q.x + q.w;
                for (var ot = o[1] + 0.4 + orr() * 1.2; ot < o[2] - 0.5; ot += 1.1 + orr() * 1.8) {
                  var ow = 0.6 + orr() * 1.3, od = 0.2 + orr() * 0.5, oh = a(BULK_H) * (0.45 + orr() * 0.55);
                  var oc = Math.min(o[2] - ow / 2 - 0.1, ot + ow / 2);
                  var ex = alongX ? oc : line, ey = alongX ? line : oc;
                  props.push({ kind: 'outcrop', x: alongX ? ex : ex + out * od * 0.5, y: alongX ? ey + out * od * 0.5 : ey,
                    ex: ex, ey: ey, side: o[0], len: ow, jut: od, height: oh, seed: (orr() * 9999) | 0 });
                }
              });
            }
          });
          return;
        }
        if (r.kind === 'door' || r.kind === 'doorlock' || r.kind === 'doorlockA' || r.kind === 'doorlockB') {
          /* which side of the wall line is outside the room — the corridor (or the
             smaller section) — so the hatch is hung on that side and the room's own
             wall runs on unbroken; +1 the side of greater y (or x), -1 the other */
          var dhz = r.w >= r.h, dmx = r.x + r.w / 2, dmy = r.y + r.h / 2;
          var secA = floors.filter(function (q) { return inAny([q], dhz ? dmx : dmx - 1, dhz ? dmy - 1 : dmy); })[0];
          var secB = floors.filter(function (q) { return inAny([q], dhz ? dmx : dmx + 1, dhz ? dmy + 1 : dmy); })[0];
          var areaOf = function (q) { return !q ? 1e9 : q.kind === 'corridor' ? 0 : q.w * q.h; };
          // the frame as long as the walls at its ends leave it (wallPieces): its own thickness, its run trimmed
          var dq = (wallPieces(), r._drawn) || r;
          var drect = dhz ? { x: dq.x, y: r.y, w: dq.w, h: r.h } : { x: r.x, y: dq.y, w: r.w, h: dq.h };
          props.push({ kind: 'door', x: drect.x, y: drect.y, w: drect.w, h: drect.h, horiz: dhz, lock: r.kind, out: areaOf(secB) <= areaOf(secA) ? 1 : -1, height: a(BULK_H), rock: rocky,
            // the colours of the rooms either side, for the wall faces looking into them
            themeA: themeAt(dhz ? dmx : dmx - 1, dhz ? dmy - 1 : dmy), themeB: themeAt(dhz ? dmx : dmx + 1, dhz ? dmy + 1 : dmy), seed: (rr2() * 9999) | 0 });
          return;
        }
        /* A story's possible location that is a building of its own (rules.js
           `pumphouse`): a shed, drawn as a block, struck through on the roof once
           searched and empty, and lit up as the one that holds the objective. */
        // a Parley's meeting point: a folding table, two crates to sit on, and a white flag
        if (r.kind === 'parleyflag') {
          props.push({ kind: 'parleyflag', x: r.x + r.w / 2, y: r.y + r.h / 2, seed: (rr2() * 9999) | 0 });
          return;
        }
        /* A spaceport's apron: the pad's markings painted on it, a shuttle down on
           it, a fuel bowser with its hoses run out to the shuttle, a cargo lifter. */
        // a station's deck: its plates' seams and bolts, laid flat
        if (r.kind === 'road' && r.deck) { props.push({ kind: 'deckplate', x: r.x, y: r.y, w: r.w, h: r.h, seed: (rr2() * 9999) | 0 }); return; }
        if (r.kind === 'road' && r.pad) { props.push({ kind: 'padmark', x: r.x, y: r.y, w: r.w, h: r.h, seed: (rr2() * 9999) | 0 }); return; }
        /* A ring of connected buildings round a tower (a map's `hub`): its
           pieces drawn as one, a round drum and the tower out of its middle,
           from the first of them; the rest draw nothing of their own. */
        if (r.hub) {
          if (r.hub.drawn) return;
          r.hub.drawn = true;
          var hb = r.hub;
          props.push({ kind: 'hubring', x: hb.cx - hb.r1, y: hb.cy - hb.r1, w: hb.r1 * 2, h: hb.r1 * 2, cx: hb.cx, cy: hb.cy, r0: hb.r0, r1: hb.r1,
            height: a(9), tower: a(26), seed: (rr2() * 9999) | 0 });
          return;
        }
        if (r.kind === 'shuttle') {
          props.push({ kind: 'shuttle', x: r.x, y: r.y, w: r.w, h: r.h, height: a(38), docked: !!r.docked, seed: (rr2() * 9999) | 0 });
          /* A ship docked outside a station ring's hull: its docking clamp, a
             great enclosed bridge run level from the hull's outer face square to
             the curve, meets the ship's flank on the side towards the ring (its
             hull is narrower than its footprint); opposite it, the bulkhead door
             in the hull's face on the deck's side, the bridge's width. */
          var ringP = r.docked && terrain.filter(function (q) { return q.ring; })[0];
          if (ringP) (r.clamps || [0.3, 0.7]).forEach(function (f, ci) {
            var rg = ringP.ring;
            // the ship's side hatch, on its flank towards the ring (the shuttle's own: f along it, 1.1" off its middle)
            var fx = r.x + r.w * f, fy = r.y + r.h / 2 + 1.1;
            var dx = fx - rg.cx, dy = fy - rg.cy, dl = Math.hypot(dx, dy);
            var hx = rg.cx + dx / dl * rg.r, hy = rg.cy + dy / dl * rg.r;
            // the bridge runs from the hull's outer face (the hull is 0.7" thick about its curve) to the ship
            var inx = -dx / dl, iny = -dy / dl, ox = hx - inx * 0.35, oy = hy - iny * 0.35;
            props.push({ kind: 'dockclamp', x: (fx + ox) / 2, y: (fy + oy) / 2, x0: ox, y0: oy, x1: fx, y1: fy, seed: (rr2() * 9999) | 0 });
            // and the bulkhead door it meets, square opposite it in the hull's face on the deck's side
            props.push({ kind: 'hulldoor', x: hx + inx * 0.7, y: hy + iny * 0.7, fx: hx + inx * 0.36, fy: hy + iny * 0.36, tx: -iny, ty: inx, nx: inx, ny: iny, height: a(10), seed: (rr2() * 9999) | 0 });
          });
          return;
        }
        if (r.kind === 'fueltruck') {
          props.push({ kind: 'fueltruck', x: r.x, y: r.y, w: r.w, h: r.h, height: a(13), facing: r.facing || 0, seed: (rr2() * 9999) | 0 });
          if (r.hose) props.push({ kind: 'hose', x: r.x + r.w * 0.35, y: r.y + r.h - 0.1, to: r.hose, seed: (rr2() * 9999) | 0 });
          return;
        }
        // a field camp's comms mast
        if (r.kind === 'commsmast') { props.push({ kind: 'commsmast', x: r.x, y: r.y, w: r.w, h: r.h, height: a(80), seed: (rr2() * 9999) | 0 }); return; }
        // a dock's gantry crane, its boom out over the basin; a tank farm's reaction-mass tanks
        if (r.kind === 'crane') { props.push({ kind: 'crane', x: r.x, y: r.y, w: r.w, h: r.h, height: a(24), seed: (rr2() * 9999) | 0 }); return; }
        if (r.kind === 'boomgate') { props.push({ kind: 'boomgate', x: r.x, y: r.y, w: r.w, h: r.h, span: r.span || 6, height: a(4), seed: (rr2() * 9999) | 0 }); return; }
        if (r.kind === 'fueltanks') { props.push({ kind: 'fueltanks', x: r.x, y: r.y, w: r.w, h: r.h, height: a(20), seed: (rr2() * 9999) | 0 }); return; }
        if (r.kind === 'cargolifter') { props.push({ kind: 'cargolifter', x: r.x, y: r.y, w: r.w, h: r.h, height: a(15), facing: r.facing || 0, seed: (rr2() * 9999) | 0 }); return; }
        // a town square's fountain: its basin, column and statue, drawn as one block among the others
        if (r.kind === 'fountain') {
          props.push({ kind: 'fountain', x: r.x, y: r.y, w: r.w, h: r.h, height: a(22), seed: (rr2() * 9999) | 0 });
          return;
        }
        if (r.kind === 'pumphouse') {
          props.push({
            kind: 'pumphouse', x: r.x, y: r.y, w: r.w, h: r.h, height: a(13),
            checked: !!r.checked, found: !!r.found, cold: !!r.cold, seed: (rr2() * 9999) | 0
          });
          return;
        }
        if (r.kind !== 'building' && r.kind !== 'bunker' && r.kind !== 'objective') return;
        /* A high building — one that gives Firepower to the men in it — is drawn a
           storey taller than a low one, so the table says which is which. */
        function storeys(r2, q2) {
          if (r2.kind !== 'building' || !root.PMC || !root.PMC.sectionHigh) return 1;
          return root.PMC.sectionHigh(r2, q2) ? 1.25 : 0.8;
        }
        var rand = rng(seed + ri * 613 + Math.round(r.x * 7));
        var height = r.kind === 'bunker' ? a(9 + rand() * 3)
          : r.kind === 'wall' ? a(9 + rand() * 2)
            : r.kind === 'objective' ? a(22)
              : a(10 + Math.min(8, Math.max(r.w, r.h)) + rand() * 3);
        // a map's landmark stands taller than the rest (r.tall, a multiple of its height)
        if (r.kind === 'building' && r.tall) height *= r.tall;
        // a building's style, and each of its wings as a block of its own
        var sty = ['concrete', 'concrete', 'brick', 'prefab'][(rand() * 4) | 0];
        if (planet === 'industrial' && rand() < 0.5) sty = 'prefab';
        if ((planet === 'sparse' || planet === 'jungle') && rand() < 0.4) sty = 'brick';
        if (r.kind === 'building' && r.style) sty = r.style;      // a map's own choice: a glass tower
        var wings = r.kind === 'building' && r.parts ? r.parts : [r];
        // the entrance, the sign and the awning go on the biggest wing only
        var mainW = wings.reduce(function (b2, q) { return !b2 || q.w * q.h > b2.w * b2.h ? q : b2; }, null);
        wings.forEach(function (q) {
          props.push({
            main: q === mainW,
            kind: r.kind === 'wall' ? 'highwall' : r.kind,
            x: q.x, y: q.y, w: q.w, h: q.h, height: Math.max(a(8), Math.round(height * (q.hf || 1) * storeys(r, q))),
            style: r.kind === 'building' ? sty : null, seed: (rand() * 9999) | 0,
            // a map's comms dish, on the roof of the building's biggest wing
            dish: r.kind === 'building' && !!r.dish && q === mainW
          });
        });
      });
      objectives.forEach(function (o, i) {
        // the Demolish target is its own marker, and so is a pump house: no flag planted in front of the wall
        var onTarget = terrain.some(function (t) { return (t.kind === 'objective' || t.kind === 'pumphouse') && o.x >= t.x - 0.5 && o.x <= t.x + t.w + 0.5 && o.y >= t.y - 0.5 && o.y <= t.y + t.h + 0.5; });
        // a story's relic (storybattle.js): a lodestone, not a flag, where it lies or over whoever carries it
        if (!onTarget) props.push({ kind: 'beacon', x: o.x, y: o.y, index: i, lz: !!o.lz, relic: !!o.relic, carried: !!o.carried });
      });
      // what lies flat on the floor goes down before anything stands on it
      /* What a piece strews round it stays on the table: a river laid on past its
         edge (a map's `fixed` piece) has its reeds and stones only where the
         table is. (A station's solar arrays stand out in the dark, and are kept.) */
      var TW = B.W || 48, TH = B.H || 48;
      props = props.filter(function (p) {
        if (p.kind === 'solar' || p.kind === 'solarmount') return true;
        return p.x >= 0 && p.y >= 0 && p.x <= TW && p.y <= TH;
      });
      var FLAT = { deckgrate: 1, cable: 1, litter: 1, padmark: 1, hose: 1, solar: 1, deckplate: 1 };
      props.forEach(function (p) {
        // the search-site hatch draws over its own scatter, so it stays readable; an objective's flag over the hatch it stands in
        p.depth = (p.w ? p.x + p.w / 2 + p.y + p.h / 2 : p.x + p.y) +
          (p.kind === 'rubble' ? -0.01 : p.kind === 'searchsite' ? 2.4 : p.kind === 'beacon' ? 2.5 : FLAT[p.kind] ? -1e4 : 0);
      });
      props.sort(function (a, b) { return a.depth - b.depth; });
      /* Two blocks side by side are not ordered by their middles: a small wing at
         the end of a long building can have its middle nearer the viewer and still
         stand wholly behind it. A block that lies entirely behind another along
         either axis is drawn first — put right, pass by pass, among the tall ones. */
      var BOX = { hubring: 1, building: 1, bunker: 1, highwall: 1, objective: 1, pumphouse: 1, fountain: 1, shuttle: 1, fueltruck: 1, cargolifter: 1, tent: 1, commsmast: 1, crane: 1, fueltanks: 1, solarmount: 1, bulkhead: 1, door: 1, crates: 1, machinery: 1 };
      /* The small things set down on a compound's floor (a box, drums, a console,
         wreckage) take a footprint of their own in this, so one standing behind a
         wall is drawn before the wall, and the wall hides it. */
      var SMALL = { piperun: 0.45, relic: 0.4, gatering: 0.6, floodlight: 0.35, outcrop: 0.25, fuelline: 0.3, dockclamp: 0.6, hullseg: 0.6, hulldoor: 0.4, smallbox: 0.25, drums: 0.4, console: 0.5, scrap: 0.3, wreckstone: 0.3, shield: 0.4, carapace: 0.45, hivegrowth: 0.5, eggs: 0.5, stall: 0.8, railing: 0.6, sacks: 0.3 };
      function rectOf(p) {
        if (BOX[p.kind] && p.w) return p;
        var r2 = SMALL[p.kind];
        return r2 ? (p._r || (p._r = { x: p.x - r2, y: p.y - r2, w: r2 * 2, h: r2 * 2 })) : null;
      }
      function behind(p1, p2) {
        p1 = rectOf(p1); p2 = rectOf(p2);
        var e = 1e-3;
        var sepX = p1.x + p1.w <= p2.x + e, sepY = p1.y + p1.h <= p2.y + e;
        var backX = p2.x + p2.w <= p1.x + e, backY = p2.y + p2.h <= p1.y + e;
        return (sepX && !backY) || (sepY && !backX);
      }
      for (var pass = 0; pass < 6; pass++) {
        var moved = false;
        for (var i1 = 0; i1 < props.length; i1++) {
          var pa = props[i1];
          if (!rectOf(pa)) continue;
          for (var j1 = i1 + 1; j1 < props.length; j1++) {
            var pb = props[j1];
            if (!rectOf(pb)) continue;
            // pb is drawn after pa, but stands wholly behind it: pb goes first
            if (behind(pb, pa) && !behind(pa, pb)) {
              props.splice(j1, 1); props.splice(i1, 0, pb);
              moved = true; pa = props[i1];
            }
          }
        }
        if (!moved) break;
      }
      return props;
    }

    /* ---------- prop painting ---------- */
    function shadowBlob(g, p, rx, ry) {
      ellipse(g, p.x, p.y + 1, rx, ry, 'rgba(18,14,9,.42)');
    }

    function lerp2(A, B, t) { return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]; }

    // a hard-edged line between two screen points, one pixel at a time
    function edgeLine(g, A, B, col, thick) {
      var steps = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1])));
      g.fillStyle = col;
      for (var i = 0; i <= steps; i++) {
        var q = lerp2(A, B, i / steps);
        g.fillRect(Math.round(q[0]), Math.round(q[1]), 1, thick || 1);
      }
    }

    /* The wall faces of a room fitted out as something (rules/compound.js
       roomTheme): plain plate, a sick bay's pale panels, a workshop's ochre, the
       hydroponics' green, a command room's blue, the reactor's rust — dark to light. */
    var WALL_THEME = [
      null,
      ['#2a3335', '#3d4a4c', '#556466', '#6d7f81', '#879a9c', '#a6b8b9'],
      ['#2c271b', '#433b28', '#5c5136', '#766945', '#8f8054', '#ab9b6a'],
      ['#1c2620', '#2b3a30', '#3c5042', '#4f6754', '#637f67', '#7f9b80'],
      ['#1e2430', '#2e3747', '#404c61', '#53627b', '#677894', '#8495ad'],
      ['#2a1e1c', '#402d2a', '#583e39', '#714f48', '#8a6157', '#a67b6f'],
      // a brood chamber: the plating gone under the hive's growth
      ['#22131e', '#36202f', '#4a2c40', '#5e3a52', '#734a63', '#8c5e78'],
      // the Warren: raw rock, hewn rough, warm brown-grey
      ['#1e1a17', '#2e2823', '#41382f', '#54493d', '#685a4b', '#80705d'],
      // the Warren's hoard chamber: its walls worked smooth and squared, paler
      ['#2a2520', '#3d362e', '#524a3f', '#685e50', '#7f7462', '#9a8e7a']
    ];
    /* A wall face from foot A to foot B, `hgt` high, shaded top to bottom. One
       gradient pinned to one end drifts along a long face, which slopes on the
       screen, so the face is laid in narrow upright slices, each shaded down its
       own height: the same at any point of the wall whichever piece it is in. */
    function shadeFace(g, A, B, hgt, cols) {
      var len = Math.abs(B[0] - A[0]), n = Math.max(1, Math.ceil(len / 3));
      for (var i = 0; i < n; i++) {
        var q0 = lerp2(A, B, i / n), q1 = lerp2(A, B, (i + 1) / n), mx = (q0[1] + q1[1]) / 2;
        // a pixel's overlap, so no seam of background shows between slices
        var e0 = i ? q0 : q0, e1 = i < n - 1 ? lerp2(A, B, Math.min(1, (i + 1) / n + 0.5 / len)) : q1;
        poly(g, [e0, e1, [e1[0], e1[1] - hgt], [e0[0], e0[1] - hgt]], vgrad(g, mx - hgt, mx, cols));
      }
    }
    // an extruded structure: two lit faces, two shaded, a panelled skin, a roof
    function box(g, pr, pal, opts) {
      var lift = opts.lift || 0;
      function pt(x, y, u2) { var q = toScreen(x, y); return [q.x, q.y - lift - (u2 || 0)]; }
      var c1 = pt(pr.x, pr.y), c2 = pt(pr.x + pr.w, pr.y);
      var c3 = pt(pr.x + pr.w, pr.y + pr.h), c4 = pt(pr.x, pr.y + pr.h);
      var hgt = pr.height, sh = PIXEL * 2;
      function top(c) { return [c[0], c[1] - hgt]; }
      var t1 = top(c1), t2 = top(c2), t3 = top(c3), t4 = top(c4);
      var rand = rng(pr.seed || 7);

      // (a compound's plating throws none: laid on the next block, it drew a seam across the solid)
      if (!opts.solid && !opts.noShadow) {
        poly(g, [[c1[0] + sh, c1[1] + PIXEL], [c2[0] + sh, c2[1] + PIXEL],
        [c3[0] + sh, c3[1] + PIXEL], [c4[0] + sh, c4[1] + PIXEL]], 'rgba(14,11,8,.45)');
      }

      /* In this projection the nearest corner is c3, so the only two faces a viewer
         can see are c2-c3 and c4-c3. They must be painted LAST: drawing the far
         walls over them turned every structure inside out, as if you were looking
         through the near wall at the inside of the far one. The far pair is still
         drawn, under them, so a sliver at the roof line is never bare ground. */
      /* A cut-away: the two near walls are taken off so the inside can be seen.
         The far walls are then the ones facing the viewer, lit as such, and the
         floor is drawn in with the wall stumps that would have carried the roof. */
      if (opts.cutaway) {
        poly(g, [c1, c2, c3, c4], pal[1]);           // the floor, in the building's shade
        poly(g, [c1, c2, t2, t1], pal[4]);           // the far walls, now facing you
        poly(g, [c1, c4, t4, t1], pal[3]);
        // the stumps of the near walls, a pixel or two proud, so the room has edges
        var stub = Math.max(2, Math.round(hgt * 0.1));
        poly(g, [c2, c3, [c3[0], c3[1] - stub], [c2[0], c2[1] - stub]], pal[2]);
        poly(g, [c4, c3, [c3[0], c3[1] - stub], [c4[0], c4[1] - stub]], pal[3]);
        // and the line the roof used to sit on, so the height still reads
        edgeLine(g, t2, t3, pal[2], 1);
        edgeLine(g, t4, t3, pal[2], 1);
        edgeLine(g, [c2[0], c2[1] - stub], [c3[0], c3[1] - stub], pal[4], 1);
        edgeLine(g, [c4[0], c4[1] - stub], [c3[0], c3[1] - stub], pal[4], 1);
        skin(c1, c2, pal[3], pal[2]);
        skin(c1, c4, pal[2], pal[1]);
        return;
      }
      poly(g, [c1, c2, t2, t1], pal[0]);             // far walls, all but hidden
      poly(g, [c1, c4, t4, t1], pal[0]);
      // the two faces the viewer sees, shaded top to bottom: a little sky light
      // at the eaves, darkening into the ground at the foot
      if (opts.solid) {
        // a compound's plating: shaded in slices that follow the slope, so pieces of one wall shade alike where they meet
        shadeFace(g, c2, c3, hgt, [pal[2], pal[2], pal[1]]);
        shadeFace(g, c4, c3, hgt, [pal[5], pal[4], pal[4], pal[3]]);
      } else {
        poly(g, [c2, c3, t3, t2], vgrad(g, t3[1], c3[1], [pal[2], pal[2], pal[1]]));
        poly(g, [c4, c3, t3, t4], vgrad(g, t3[1], c3[1], [pal[5], pal[4], pal[4], pal[3]]));
      }
      // the corner, catching the light — on a compound's plating only where it is a corner, the wall turning with floor both ways, not where two pieces of one wall meet
      if (!opts.solid || nearCorner()) edgeLine(g, t3, c3, pal[5], 1);
      function nearCorner() {
        var o = pr.open || [], e = 1e-3;
        return o.some(function (q) { return q[0] === 'S' && q[2] >= pr.x + pr.w - e; }) && o.some(function (q) { return q[0] === 'E' && q[2] >= pr.y + pr.h - e; });
      }

      // cast panels, joints, streaks and grime on the two faces that are lit
      function skin(A, B, seam, grime) {
        var len = Math.hypot(B[0] - A[0], B[1] - A[1]);
        var cols = Math.max(2, Math.round(len / (K * 1.7)));
        for (var i = 1; i < cols; i++) {
          var q = lerp2(A, B, i / cols);
          edgeLine(g, [q[0], q[1] - hgt + 1], [q[0], q[1] - 1], seam, 1);
        }
        // (a compound's plating has no courses across it: drawn at each piece's own height they broke the wall at every door)
        var rows = opts.solid ? 1 : Math.max(1, Math.round(hgt / (K * 1.2)));
        for (var j = 1; j < rows; j++) {
          var h2 = hgt * j / rows;
          edgeLine(g, [A[0], A[1] - h2], [B[0], B[1] - h2], seam, 1);
        }
        for (var k = 0; k < len * 0.9; k++) {        // grime creeping up from the ground
          var q2 = lerp2(A, B, rand());
          dot(g, q2[0], q2[1] - rand() * rand() * hgt * 0.45, grime, 1);
        }
        for (var m = 0; m < len / (K * 0.4); m++) {  // rain streaks below the roof
          var q3 = lerp2(A, B, rand()), h3 = rand() * hgt * 0.45;
          for (var y2 = 0; y2 < h3; y2++) dot(g, q3[0], q3[1] - hgt + y2, grime, 1);
        }
      }
      /* Only the two faces the viewer sees are worth the joints, grime and rain
         streaks; the pair facing away is behind them and gets nothing. */
      skin(c2, c3, pal[1], pal[1]);
      skin(c4, c3, pal[3], pal[2]);
      if (opts.bunker) buttresses();

      /* A reinforced building is cast, not built: raking buttresses stand out from
         the two faces the viewer sees, between the firing slits, each a wedge
         of concrete thick at the foot and running back into the wall. */
      function buttresses() {
        var bw = 0.6, d = 0.42, hb = hgt * 0.55;
        function wedge(q0, q1, o0, o1, side0, side1, top, sideCol, faceCol) {
          // its side, then the raking face over it, then the arris catching the light
          poly(g, [side0, side1, top], sideCol);
          poly(g, [o0, o1, q1, q0], faceCol);
          edgeLine(g, o1, q1, pal[5], 1);
        }
        // along the front: x across, pushing out towards +y
        var Y = pr.y + pr.h, nF = Math.max(1, Math.round(Math.hypot(c3[0] - c4[0], c3[1] - c4[1]) / (K * 1.2)));
        // one at every other gap between the slits: enough to read, not a fence of them
        for (var i = 1; i < nF; i++) {
          if (nF > 3 && i % 2) continue;
          var x0 = pr.x + pr.w * i / nF - bw / 2, x1 = x0 + bw;
          wedge(pt(x0, Y, hb), pt(x1, Y, hb), pt(x0, Y + d), pt(x1, Y + d),
            pt(x1, Y), pt(x1, Y + d), pt(x1, Y, hb), pal[2],
            vgrad(g, pt(x0, Y, hb)[1], pt(x0, Y + d)[1], [pal[4], pal[4], pal[3]]));
        }
        // along the right: y across, pushing out towards +x
        var X = pr.x + pr.w, nR = Math.max(1, Math.round(Math.hypot(c3[0] - c2[0], c3[1] - c2[1]) / (K * 1.2)));
        for (var j = 1; j < nR; j++) {
          if (nR > 3 && j % 2) continue;
          var y0 = pr.y + pr.h * j / nR - bw / 2, y1 = y0 + bw;
          wedge(pt(X, y0, hb), pt(X, y1, hb), pt(X + d, y0), pt(X + d, y1),
            pt(X, y1), pt(X + d, y1), pt(X, y1, hb), pal[4],
            vgrad(g, pt(X, y0, hb)[1], pt(X + d, y0)[1], [pal[3], pal[2], pal[1]]));
        }
      }

      // a stretch of a near face looking into a room: the room's colours (iso-ground ROOM_THEMES)
      if (opts.solid) (pr.open || []).forEach(function (o) {
        if (o[3] == null || o[3] < 0 || (o[0] !== 'S' && o[0] !== 'E')) return;
        var tp = WALL_THEME[o[3]];
        if (!tp) return;
        var A3 = o[0] === 'S' ? [o[1], pr.y + pr.h] : [pr.x + pr.w, o[1]], B3 = o[0] === 'S' ? [o[2], pr.y + pr.h] : [pr.x + pr.w, o[2]];
        var a0 = pt(A3[0], A3[1]), b0 = pt(B3[0], B3[1]), a1 = pt(A3[0], A3[1], hgt), b1 = pt(B3[0], B3[1], hgt);
        shadeFace(g, a0, b0, hgt, o[0] === 'S' ? [tp[5], tp[4], tp[4], tp[3]] : [tp[2], tp[2], tp[1]]);
        // (the Warren's raw rock has no panel joints: it is roughened over in its own drawing)
        var segs = o[3] === 7 ? 1 : Math.max(1, Math.round(Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) / (K * 1.7)));
        for (var si = 1; si < segs; si++) { var sq = lerp2(a0, b0, si / segs); edgeLine(g, [sq[0], sq[1] - hgt + 1], [sq[0], sq[1] - 1], tp[o[0] === 'S' ? 3 : 1], 1); }
        edgeLine(g, [a0[0], a0[1] - 1], [b0[0], b0[1] - 1], tp[0], 1);      // the skirting, where it meets the floor
      });
      poly(g, [t1, t2, t3, t4], opts.roof);          // roof
      if (opts.solid) { solidTop(); return; }
      /* A compound's plating: one mass however many blocks it is laid in, with no
         plates marked across it; the only lip is along the stretches that face a floor. */
      function solidTop() {
        for (var gq = 0; gq < pr.w * pr.h * 1.2; gq++) {
          var su = rand(), sv = rand();
          var sq = lerp2(lerp2(t1, t2, su), lerp2(t4, t3, su), sv);
          dot(g, sq[0], sq[1], rand() > 0.5 ? 'rgba(20,24,30,.5)' : 'rgba(120,128,140,.18)', 1);
        }
        (pr.open || []).forEach(function (o) {
          var A2, B2;
          if (o[0] === 'N') { A2 = pt(o[1], pr.y, hgt); B2 = pt(o[2], pr.y, hgt); }
          else if (o[0] === 'S') { A2 = pt(o[1], pr.y + pr.h, hgt); B2 = pt(o[2], pr.y + pr.h, hgt); }
          else if (o[0] === 'W') { A2 = pt(pr.x, o[1], hgt); B2 = pt(pr.x, o[2], hgt); }
          else { A2 = pt(pr.x + pr.w, o[1], hgt); B2 = pt(pr.x + pr.w, o[2], hgt); }
          // the near edges catch the light; the far ones are a darker lip against the floor beyond
          var near = o[0] === 'S' || o[0] === 'E';
          edgeLine(g, A2, B2, opts.roofEdge, 2);
          if (near) edgeLine(g, [A2[0], A2[1] - 1], [B2[0], B2[1] - 1], pal[5], 1);
        });
      }
      // roof panels
      var gx = Math.max(2, Math.round(pr.w / 2.2)), gy = Math.max(2, Math.round(pr.h / 2.2));
      var seamCol = 'rgba(18,22,28,.45)';
      for (var u = 1; u < gx; u++) {
        edgeLine(g, lerp2(t1, t2, u / gx), lerp2(t4, t3, u / gx), seamCol, 1);
      }
      for (var v = 1; v < gy; v++) {
        edgeLine(g, lerp2(t1, t4, v / gy), lerp2(t2, t3, v / gy), seamCol, 1);
      }
      for (var gr = 0; gr < pr.w * pr.h * 1.2; gr++) {   // grit and staining on the roof
        var ru = rand(), rv = rand();
        var rq = lerp2(lerp2(t1, t2, ru), lerp2(t4, t3, ru), rv);
        dot(g, rq[0], rq[1], rand() > 0.5 ? 'rgba(20,24,30,.5)' : 'rgba(120,128,140,.25)', 1);
      }
      if (opts.bunker) coping();
      else {
        // a parapet all the way round, lit on the near edges
        edgeLine(g, t1, t2, opts.roofEdge, 2); edgeLine(g, t1, t4, opts.roofEdge, 2);
        edgeLine(g, t2, t3, opts.roofEdge, 2); edgeLine(g, t4, t3, opts.roofEdge, 2);
        edgeLine(g, [t2[0], t2[1] - 2], [t3[0], t3[1] - 2], pal[5], 1);
        edgeLine(g, [t4[0], t4[1] - 2], [t3[0], t3[1] - 2], pal[5], 1);
      }

      /* The reinforced building's roof edge: a heavy cast coping that stands proud
         of the walls and up above the roof slab, so the roof sits down inside it,
         and an armoured hatch with a raised collar. */
      function coping() {
        var e = 0.14, tk = 0.4, z0 = hgt - a(1.6), z1 = hgt + a(1.4);
        var X0 = pr.x - e, X1 = pr.x + pr.w + e, Y0 = pr.y - e, Y1 = pr.y + pr.h + e;
        var I0 = pr.x + tk, I1 = pr.x + pr.w - tk, J0 = pr.y + tk, J1 = pr.y + pr.h - tk;
        // the inside of the far lip, facing the viewer across the roof
        poly(g, [pt(I0, J0, hgt), pt(I1, J0, hgt), pt(I1, J0, z1), pt(I0, J0, z1)], pal[2]);
        poly(g, [pt(I0, J0, hgt), pt(I0, J1, hgt), pt(I0, J1, z1), pt(I0, J0, z1)], pal[3]);
        // a dark line where the slab meets the lip, holding water
        edgeLine(g, pt(I0, J0, hgt), pt(I1, J0, hgt), 'rgba(14,16,18,.55)', 1);
        edgeLine(g, pt(I0, J0, hgt), pt(I0, J1, hgt), 'rgba(14,16,18,.55)', 1);
        // the band round the outside of the walls, with the shadow it throws under it
        edgeLine(g, pt(pr.x, Y1 - e, z0 - 1), pt(X1 - e, Y1 - e, z0 - 1), 'rgba(12,12,10,.45)', 2);
        edgeLine(g, pt(X1 - e, pr.y, z0 - 1), pt(X1 - e, Y1 - e, z0 - 1), 'rgba(12,12,10,.45)', 2);
        poly(g, [pt(X0, Y1, z0), pt(X1, Y1, z0), pt(X1, Y1, z1), pt(X0, Y1, z1)], vgrad(g, pt(X0, Y1, z1)[1], pt(X0, Y1, z0)[1], [pal[5], pal[4]]));
        poly(g, [pt(X1, Y0, z0), pt(X1, Y1, z0), pt(X1, Y1, z1), pt(X1, Y0, z1)], vgrad(g, pt(X1, Y0, z1)[1], pt(X1, Y0, z0)[1], [pal[3], pal[2]]));
        // its top, all the way round
        var cap = pal[4];
        poly(g, [pt(X0, Y0, z1), pt(X1, Y0, z1), pt(I1, J0, z1), pt(I0, J0, z1)], cap);
        poly(g, [pt(X0, Y0, z1), pt(I0, J0, z1), pt(I0, J1, z1), pt(X0, Y1, z1)], cap);
        poly(g, [pt(I1, J0, z1), pt(X1, Y0, z1), pt(X1, Y1, z1), pt(I1, J1, z1)], cap);
        poly(g, [pt(I0, J1, z1), pt(I1, J1, z1), pt(X1, Y1, z1), pt(X0, Y1, z1)], cap);
        edgeLine(g, pt(X0, Y1, z1), pt(X1, Y1, z1), pal[5], 1);
        edgeLine(g, pt(X1, Y0, z1), pt(X1, Y1, z1), pal[5], 1);
        edgeLine(g, pt(X1, Y1, z0), pt(X1, Y1, z1), pal[5], 1);          // the corner of the band
        // the joints in the cast coping, every few feet
        for (var cj = 1; cj < Math.round(pr.w / 1.6); cj++) {
          var cx = pr.x + pr.w * cj / Math.round(pr.w / 1.6);
          edgeLine(g, pt(cx, Y1, z0), pt(cx, Y1, z1), pal[3], 1);
        }
        for (var ck = 1; ck < Math.round(pr.h / 1.6); ck++) {
          var cy = pr.y + pr.h * ck / Math.round(pr.h / 1.6);
          edgeLine(g, pt(X1, cy, z0), pt(X1, cy, z1), pal[1], 1);
        }
        // an armoured hatch in the slab, square to the walls, with a raised collar
        var hx = pr.x + pr.w * 0.3, hy = pr.y + pr.h * 0.35, hs = 0.7, hc = a(0.7);
        poly(g, [pt(hx, hy + hs, hgt), pt(hx + hs, hy + hs, hgt), pt(hx + hs, hy + hs, hgt + hc), pt(hx, hy + hs, hgt + hc)], pal[4]);
        poly(g, [pt(hx + hs, hy, hgt), pt(hx + hs, hy + hs, hgt), pt(hx + hs, hy + hs, hgt + hc), pt(hx + hs, hy, hgt + hc)], pal[2]);
        poly(g, [pt(hx, hy, hgt + hc), pt(hx + hs, hy, hgt + hc), pt(hx + hs, hy + hs, hgt + hc), pt(hx, hy + hs, hgt + hc)], '#4a4a44');
        edgeLine(g, pt(hx + hs * 0.15, hy + hs * 0.5, hgt + hc), pt(hx + hs * 0.85, hy + hs * 0.5, hgt + hc), '#2c2c28', 1);
        // and a ventilator, a squat cowl on a stub
        var vx = pr.x + pr.w * 0.72, vy = pr.y + pr.h * 0.6, vp = pt(vx, vy, hgt);
        rect(g, vp[0] - a(0.5), vp[1] - a(2.2), a(1), a(2.2), pal[2]);
        rect(g, vp[0] - a(0.9), vp[1] - a(2.9), a(1.8), a(0.8), pal[4]);
        rect(g, vp[0] - a(0.9), vp[1] - a(2.2), a(1.8), 1, '#1e1f1c');
      }

      if (!opts.windows) return;
      var lit = opts.windows === 'lit';

      var style = opts.style || 'concrete';
      // on a lower wing or a tower the details scale with it, but every wing gets its own
      function onFace(A, B, t, up) { var q = lerp2(A, B, t); return [q[0], q[1] - up]; }
      // a patch of wall face between t0 and t1 along it, from `up` above the ground down `h`
      function para(A, B, t0, t1, up, h, col) {
        var p0 = onFace(A, B, t0, up), p1 = onFace(A, B, t1, up);
        poly(g, [p0, p1, [p1[0], p1[1] + h], [p0[0], p0[1] + h]], col);
      }
      var lenL = Math.hypot(c3[0] - c4[0], c3[1] - c4[1]), lenR = Math.hypot(c3[0] - c2[0], c3[1] - c2[1]);

      // windows, spaced by the length of the wall rather than a fixed four
      var floors = lit ? Math.max(1, Math.floor((hgt - a(3)) / a(8))) : 1;
      [[c4, c3, lenL, true], [c2, c3, lenR, false]].forEach(function (F) {
        var A = F[0], B = F[1], L = F[2], front = F[3];
        var nW = Math.max(1, Math.round(L / (K * (style === 'prefab' ? 0.9 : 1.2))));
        for (var fl = 0; fl < floors; fl++) {
          var upY = hgt - a(5) - fl * a(8);
          if (upY < a(2.2)) continue;
          if (style === 'prefab' && lit) {
            // a continuous ribbon of glazing along each floor
            var r0 = onFace(A, B, 0.08, upY), r1 = onFace(A, B, 0.92, upY), rh = a(1.3);
            poly(g, [r0, r1, [r1[0], r1[1] + rh], [r0[0], r0[1] + rh]], '#1a2129');
            for (var mu = 1; mu < nW * 2; mu++) {
              var mq = onFace(A, B, 0.08 + 0.84 * mu / (nW * 2), upY);
              rect(g, mq[0], mq[1], 1, rh, rand() > 0.8 ? '#e8c15a' : '#2c3640');
            }
            edgeLine(g, [r0[0], r0[1] + rh + 1], [r1[0], r1[1] + rh + 1], pal[5], 1);
            continue;
          }
          for (var wi = 0; wi < nW; wi++) {
            var tt = (wi + 0.5) / nW;
            // leave room on the front for the door
            if (front && fl === 0 && lit && opts.main !== false && Math.abs(tt - 0.5) < 0.5 / nW + 0.02) continue;
            // the opening follows the wall: a parallelogram running with its slope
            var ww = a(lit ? 1.5 : 1.8), wh = a(lit ? 1.9 : 0.8), dt = ww / L / 2, ft = (ww + PIXEL * 2) / L / 2;
            var on = lit && rand() > (front ? 0.5 : 0.62);
            para(A, B, tt - ft, tt + ft, upY + PIXEL, wh + PIXEL * 2, '#14171c');                 // the frame
            para(A, B, tt - dt, tt + dt, upY, wh, on ? '#e8c15a' : '#1c2028');                   // the glass
            if (on) {
              para(A, B, tt - dt, tt + dt, upY, PIXEL, '#fbe6a8');
              para(A, B, tt - 0.5 / L, tt + 0.5 / L, upY, wh, '#b8923e');                       // the glazing bar
            } else para(A, B, tt - dt + 1 / L, tt - dt / 3, upY - 1, Math.max(1, wh / 3), 'rgba(140,160,180,.35)');   // a glint
            if (opts.bunker) {
              // a cast hood over the slit, throwing a shadow down across it
              para(A, B, tt - ft - 2 / L, tt + ft + 2 / L, upY + PIXEL * 2 + a(0.5), a(0.5), front ? pal[5] : pal[3]);
              para(A, B, tt - ft, tt + ft, upY + PIXEL, 1, 'rgba(10,10,10,.5)');
            }
            if (lit) {
              para(A, B, tt - ft, tt + ft, upY - wh - PIXEL, 1, pal[5]);                          // the sill
              if (style === 'brick') para(A, B, tt - ft - 1 / L, tt + ft + 1 / L, upY + PIXEL * 2, PIXEL, pal[1]);   // a lintel
              if (rand() > 0.85) para(A, B, tt - ft, tt + ft, upY - wh - 2, a(0.6), '#3e5a2e');   // a window box
            }
          }
        }
      });
      if (!lit) return;

      // a door on the front, with a step, a lamp over it and, sometimes, an awning and a sign
      var dr = onFace(c4, c3, 0.5, 0), dw = a(2.2), dh = a(6);
      if (opts.main !== false) {
      var dT = dw / lenL / 2;
      para(c4, c3, 0.5 - dT - 2 / lenL, 0.5 + dT + 2 / lenL, 1, 3, pal[3]);          // the step
      para(c4, c3, 0.5 - dT, 0.5 + dT, dh, dh - 1, style === 'brick' ? '#2a1a14' : '#171b21');
      para(c4, c3, 0.5 - dT, 0.5 - dT + 2 / lenL, dh, dh - 1, '#2a3038');
      var hd = onFace(c4, c3, 0.5 + dT * 0.6, dh / 2);
      rect(g, hd[0], hd[1], 1, 2, '#c9b07a');                                          // the handle
      dot(g, dr[0] - 1, dr[1] - dh - a(1.2), '#ffe7a3', 2);                             // the lamp
      ellipse(g, dr[0], dr[1] - dh - a(0.6), a(1.6), a(0.7), 'rgba(255,220,140,.16)');
      if (rand() > 0.45) {
        var awc = ['#7a2e24', '#2e5a6a', '#6a5a2a', '#3a5a34'][(rand() * 4) | 0];
        var aw0 = onFace(c4, c3, 0.5 - 0.09, dh + a(0.4)), aw1 = onFace(c4, c3, 0.5 + 0.09, dh + a(0.4));
        poly(g, [aw0, aw1, [aw1[0] + 3, aw1[1] + a(1.4)], [aw0[0] + 3, aw0[1] + a(1.4)]], awc);
        edgeLine(g, [aw0[0] + 3, aw0[1] + a(1.4)], [aw1[0] + 3, aw1[1] + a(1.4)], 'rgba(255,255,255,.25)', 1);
      }
      if (rand() > 0.5 && hgt > a(12)) {
        var sg0 = onFace(c4, c3, 0.3, hgt - a(2.5)), sg1 = onFace(c4, c3, 0.7, hgt - a(2.5));
        var sgc = ['#b03a2e', '#2a6f97', '#d9a441', '#3d7a4a'][(rand() * 4) | 0];
        poly(g, [sg0, sg1, [sg1[0], sg1[1] + a(1.6)], [sg0[0], sg0[1] + a(1.6)]], sgc);
        for (var sl2 = 0; sl2 < 5; sl2++) {
          var lq = lerp2(sg0, sg1, 0.15 + sl2 * 0.17);
          rect(g, lq[0], lq[1] + a(0.5), a(0.6), a(0.6), 'rgba(255,255,255,.7)');
        }
      }
      }
      // a drainpipe down the far end of the right face, air-con units on it, a fire ladder
      var pp = onFace(c2, c3, 0.06, 0);
      rect(g, pp[0], pp[1] - hgt, 2, hgt, pal[1]);
      rect(g, pp[0], pp[1] - hgt, 1, hgt, pal[3]);
      for (var ac = 0; ac < Math.min(3, floors); ac++) {
        if (rand() > 0.55) continue;
        var at0 = 0.25 + rand() * 0.5, at1 = at0 + a(2) / lenR, aup = a(6) + ac * a(8) + a(1.4);
        para(c2, c3, at0, at1, aup, a(1.4), '#8e949a');
        para(c2, c3, at0, at1, aup, 1, '#b4bac0');
        for (var gl = 0; gl < 3; gl++) para(c2, c3, at0 + (gl + 0.6) * (at1 - at0) / 3.4, at0 + (gl + 0.6) * (at1 - at0) / 3.4 + 1 / lenR, aup - 2, a(0.9), '#5a6066');
      }
      if (floors > 1 && rand() > 0.5) {
        var lx = 0.82, l0 = onFace(c2, c3, lx, 0);
        rect(g, l0[0], l0[1] - hgt, 1, hgt, '#2a2e33');
        rect(g, l0[0] + a(1.2), l0[1] - hgt + 3, 1, hgt - 3, '#2a2e33');
        for (var rg2 = 4; rg2 < hgt; rg2 += a(1.2)) rect(g, l0[0], l0[1] - rg2, a(1.2), 1, '#3c4148');
      }

      // on the roof: a vent stack, a hatch, and one of a water tank, solar panels or skylights
      function roofAt(uu, vv) { return lerp2(lerp2(t1, t2, uu), lerp2(t4, t3, uu), vv); }
      var hq = roofAt(0.3 + rand() * 0.2, 0.3 + rand() * 0.2);
      poly(g, [[hq[0] - a(1.2), hq[1]], [hq[0], hq[1] - a(0.6)], [hq[0] + a(1.2), hq[1]], [hq[0], hq[1] + a(0.6)]], pal[1]);
      poly(g, [[hq[0] - a(0.8), hq[1] - 1], [hq[0], hq[1] - a(0.4) - 1], [hq[0] + a(0.8), hq[1] - 1], [hq[0], hq[1] + a(0.4) - 1]], opts.roofEdge);
      var kit2 = rand();
      if (kit2 < 0.35) {
        var wt2 = roofAt(0.65, 0.35), tr2 = a(1.8), th3 = a(3.4);
        for (var lg2 = -1; lg2 <= 1; lg2 += 2) rect(g, wt2[0] + lg2 * tr2 * 0.7, wt2[1] - a(1.6), 1, a(1.6), '#2a2e33');
        rect(g, wt2[0] - tr2, wt2[1] - a(1.6) - th3, tr2 * 2, th3, '#6b5a44');
        rect(g, wt2[0] - tr2, wt2[1] - a(1.6) - th3, tr2 * 0.6, th3, '#80705a');
        ellipse(g, wt2[0], wt2[1] - a(1.6) - th3, tr2, tr2 * 0.45, '#8c7c64');
      } else if (kit2 < 0.7) {
        for (var sp6 = 0; sp6 < 2; sp6++) {
          var s0 = roofAt(0.52 + sp6 * 0.2, 0.2), s1 = roofAt(0.52 + sp6 * 0.2 + 0.14, 0.2), s2 = roofAt(0.52 + sp6 * 0.2 + 0.14, 0.75), s3 = roofAt(0.52 + sp6 * 0.2, 0.75);
          poly(g, [s0, s1, [s2[0], s2[1] - 3], [s3[0], s3[1] - 3]], '#1d2c44');
          edgeLine(g, lerp2(s0, s1, 0.5), lerp2([s3[0], s3[1] - 3], [s2[0], s2[1] - 3], 0.5), '#3a5a86', 1);
          edgeLine(g, s0, s1, '#4a6a96', 1);
        }
      } else {
        for (var sk = 0; sk < 3; sk++) {
          var k0 = roofAt(0.55 + sk * 0.12, 0.35), k1 = roofAt(0.55 + sk * 0.12 + 0.07, 0.35), k2 = roofAt(0.55 + sk * 0.12 + 0.07, 0.6), k3 = roofAt(0.55 + sk * 0.12, 0.6);
          poly(g, [k0, k1, k2, k3], 'rgba(120,150,170,.55)');
          edgeLine(g, k0, k1, '#c8dce6', 1);
        }
      }
      var vent = roofAt(0.2, 0.75);
      rect(g, vent[0] - a(0.6), vent[1] - a(5), a(1.2), a(5), pal[2]);
      rect(g, vent[0] - a(1.1), vent[1] - a(5.8), a(2.2), a(1), pal[4]);
      if (rand() > 0.5) {                                   // an aerial, with a red light on top
        var ae = roofAt(0.8, 0.8);
        rect(g, ae[0], ae[1] - a(9), 1, a(9), '#2a2e33');
        rect(g, ae[0] - a(1), ae[1] - a(7), a(2), 1, '#2a2e33');
        dot(g, ae[0] - 1, ae[1] - a(9) - 1, '#e04a3a', 2);
      }
    }

    /* A boulder: an irregular footprint raised into a lumpy block, each facet
       shaded by which way it turns from the light (north-west), a lit cap, a rim
       of highlight where the top breaks over, cracks and lichen. */
    var BASALTS = ['#0c0a09', '#161311', '#211c19', '#2e2723', '#3d3530', '#4c423b'];
    function boulder(g, cx, cy, rw, h, rnd, pal) {
      var S = pal || STONE;
      var n = 7 + (rnd() * 3 | 0), base = [], top = [], ang = [];
      var tx = (rnd() - 0.5) * rw * 0.25, ty = (rnd() - 0.5) * rw * 0.12;
      for (var i = 0; i < n; i++) {
        var t = (i + (rnd() - 0.5) * 0.6) / n * Math.PI * 2;
        var r = rw * (0.72 + rnd() * 0.36), sq = 0.5 + rnd() * 0.3;
        ang.push(t);
        base.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.5]);
        top.push([cx + tx + Math.cos(t) * r * sq, cy + ty - h * (0.85 + rnd() * 0.25) + Math.sin(t) * r * 0.5 * sq]);
      }
      ellipse(g, cx + rw * 0.35, cy + rw * 0.12, rw * 1.15, rw * 0.5, 'rgba(18,14,9,.42)');
      var faces = [];
      for (var j = 0; j < n; j++) {
        var k = (j + 1) % n, mid = (ang[j] + ang[k] + (k === 0 ? Math.PI * 2 : 0)) / 2;
        faces.push({ j: j, k: k, mid: mid, depth: Math.sin(mid) });
      }
      faces.sort(function (A, B) { return A.depth - B.depth; });
      faces.forEach(function (f) {
        if (f.depth < -0.25) return;                        // hidden behind the cap
        var lit = -Math.cos(f.mid) * 0.75 - Math.sin(f.mid) * 0.25;   // toward upper-left
        var idx = Math.max(0, Math.min(4, Math.round(1.6 + lit * 1.9)));
        var yA = Math.min(top[f.j][1], top[f.k][1]), yB = Math.max(base[f.j][1], base[f.k][1]);
        poly(g, [base[f.j], base[f.k], top[f.k], top[f.j]],
          vgrad(g, yA, yB, [S[Math.min(5, idx + 1)], S[idx], S[Math.max(0, idx - 1)]]));
      });
      var ys = top.map(function (q) { return q[1]; });
      poly(g, top, vgrad(g, Math.min.apply(null, ys), Math.max.apply(null, ys), [S[5], S[4], S[3]]));
      // the break of the cap over the lit faces
      for (var e = 0; e < n; e++) {
        var e2 = (e + 1) % n, m2 = ang[e] + 0.3;
        if (Math.sin(m2) < -0.3) continue;
        edgeLine(g, top[e], top[e2], Math.cos(m2) < 0.2 ? S[5] : S[3], 1);
      }
      // cracks down the faces, lichen and grit on top
      for (var c = 0; c < (rnd() * 2 | 0); c++) {
        var f0 = rnd(), q0 = lerp2(top[(n / 2 | 0)], top[((n / 2 | 0) + 1) % n], f0);
        var x = q0[0] + (rnd() - 0.5) * rw * 0.8, y = q0[1] + 2;
        for (var s = 0; s < h * 0.6; s++) {
          x += (rnd() - 0.5) * 2.2; y += 1;
          dot(g, x, y, 'rgba(30,29,26,.55)', 1);
        }
      }
      for (var l = 0; l < rw * 0.8; l++) {
        var la = rnd() * Math.PI * 2, ld = Math.sqrt(rnd()) * rw * 0.5;
        dot(g, cx + tx + Math.cos(la) * ld, cy + ty - h * 0.95 + Math.sin(la) * ld * 0.5,
          rnd() > 0.6 ? '#6f7a44' : rnd() > 0.5 ? '#5a6436' : S[2], rnd() > 0.7 ? 2 : 1);
      }
    }

    /* A run of ruined masonry: the wall broken down into short sections of
       uneven height, laid in courses, lit on the south-west face, with fallen
       blocks at its foot. */
    function brokenWall(g, pr) {
      var rnd = rng(pr.seed), horiz = pr.w >= pr.h, len = horiz ? pr.w : pr.h;
      var segs = Math.max(2, Math.round(len / 0.45)), hs = [];
      for (var i = 0; i < segs; i++) hs.push(pr.height * (0.45 + rnd() * 0.55));
      for (var s2 = 1; s2 < segs - 1; s2++) hs[s2] = (hs[s2 - 1] + hs[s2] * 2 + hs[s2 + 1]) / 4;
      hs[0] *= 0.7; hs[segs - 1] *= 0.7;
      var w1 = toScreen(pr.x, pr.y), w3 = toScreen(pr.x + pr.w, pr.y + pr.h);
      poly(g, [[w1.x + 4, w1.y + 3], [toScreen(pr.x + pr.w, pr.y).x + 4, toScreen(pr.x + pr.w, pr.y).y + 3],
        [w3.x + 4, w3.y + 3], [toScreen(pr.x, pr.y + pr.h).x + 4, toScreen(pr.x, pr.y + pr.h).y + 3]], 'rgba(18,14,9,.4)');
      var course = a(1.3);
      for (var k = 0; k < segs; k++) {
        var f0 = k / segs, f1 = (k + 1) / segs, hh = hs[k];
        var x0 = horiz ? pr.x + pr.w * f0 : pr.x, x1 = horiz ? pr.x + pr.w * f1 : pr.x + pr.w;
        var y0 = horiz ? pr.y : pr.y + pr.h * f0, y1 = horiz ? pr.y + pr.h : pr.y + pr.h * f1;
        var c1 = toScreen(x0, y0), c2 = toScreen(x1, y0), c3 = toScreen(x1, y1), c4 = toScreen(x0, y1);
        var P = function (c, up) { return [c.x, c.y - up]; };
        poly(g, [P(c2, 0), P(c3, 0), P(c3, hh), P(c2, hh)], vgrad(g, c3.y - hh, c3.y, [STONE[2], STONE[1], STONE[0]]));
        poly(g, [P(c4, 0), P(c3, 0), P(c3, hh), P(c4, hh)], vgrad(g, c3.y - hh, c3.y, [STONE[4], STONE[3], STONE[2]]));
        poly(g, [P(c1, hh), P(c2, hh), P(c3, hh), P(c4, hh)], STONE[4]);
        edgeLine(g, P(c4, hh), P(c3, hh), STONE[5], 1);
        // mortar courses on both faces, joints staggered course to course
        for (var up = course; up < hh - 1; up += course) {
          edgeLine(g, P(c4, up), P(c3, up), 'rgba(40,38,34,.55)', 1);
          edgeLine(g, P(c2, up), P(c3, up), 'rgba(20,19,17,.5)', 1);
          var jt = ((up / course) & 1) ? 0.3 : 0.7;
          var jq = lerp2(P(c4, up), P(c3, up), jt);
          rect(g, jq[0], jq[1] - course + 1, 1, course - 1, 'rgba(40,38,34,.5)');
        }
        for (var gr = 0; gr < 6; gr++) {                    // pitting and grime
          var q = lerp2(P(c4, 0), P(c3, 0), rnd());
          dot(g, q[0], q[1] - rnd() * hh, rnd() > 0.5 ? STONE[2] : STONE[5], 1);
        }
      }
      for (var b = 0; b < len * 3; b++) {                   // fallen blocks at the foot
        var t = rnd(), side = rnd() > 0.5 ? 1 : -1, off = 0.25 + rnd() * 0.5;
        var bp = toScreen(horiz ? pr.x + pr.w * t : pr.x + pr.w / 2 + side * off,
          horiz ? pr.y + pr.h / 2 + side * off : pr.y + pr.h * t);
        pebble(g, bp.x, bp.y, 2 + (rnd() * 3 | 0), rnd);
      }
    }

    // a pine: a straight trunk under tiers of dark needles, lit on the left
    function conifer(g, p, pr, tr) {
      var h = pr.h * 1.25, rad = pr.rad * 0.95;
      rect(g, p.x - a(0.5), p.y - h * 0.45, a(1), h * 0.45, BARK[1]);
      rect(g, p.x - a(0.5), p.y - h * 0.45, a(0.4), h * 0.45, BARK[2]);
      var tiers = 4 + (tr() * 2 | 0);
      for (var t = 0; t < tiers; t++) {
        var f = t / tiers, w = rad * (1 - f * 0.78), y = p.y - h * 0.22 - f * h * 0.78;
        var hh = h * 0.3;
        poly(g, [[p.x - w, y], [p.x, y + w * 0.28], [p.x, y - hh]], LEAF[2]);
        poly(g, [[p.x + w, y], [p.x, y + w * 0.28], [p.x, y - hh]], LEAF[0]);
        poly(g, [[p.x - w * 0.8, y - 1], [p.x - w * 0.15, y - hh * 0.2], [p.x, y - hh]], LEAF[3]);
        for (var k = 0; k < w * 0.6; k++) {
          var fx = (tr() - 0.5) * 2 * w * 0.9;
          dot(g, p.x + fx, y - tr() * hh * (1 - Math.abs(fx) / w), fx < 0 ? LEAF[4] : LEAF[1], 1);
        }
      }
      rect(g, p.x - 1, p.y - h * 1.02, 2, a(1.2), LEAF[3]);
    }

    function drawProp(g, pr, lift, cutaway) {
      var p = toScreen(pr.x, pr.y);
      p.y -= lift || 0;
      KINDS.drawKind(cutaway, g, lift, p, pr);
    }
    // its moving parts, at the time t (ms): nothing for a piece that has none
    function drawPropLive(g, pr, lift, t) {
      if (!KINDS.lives(pr)) return;
      var p = toScreen(pr.x, pr.y);
      p.y -= lift || 0;
      KINDS.drawLive(g, lift, p, pr, t);
    }


    // each kind of piece, drawn in iso-propkinds.js
    var KINDS = root.PMCIsoPropKinds({
      BAG: BAG, BARK: BARK, BASALTS: BASALTS, BRICK: BRICK, CHAR: CHAR, CONCRETE: CONCRETE, K: K, LEAF: LEAF,
      PIXEL: PIXEL, PREFAB: PREFAB, ROOF: ROOF, STONE: STONE, a: a, boulder: boulder, box: box,
      brokenWall: brokenWall, conifer: conifer, dot: dot, edgeLine: edgeLine, ellipse: ellipse, ellipseRing: ellipseRing, lerp2: lerp2,
      pebble: pebble, poly: poly, rect: rect, rng: rng, shadowBlob: shadowBlob, toScreen: toScreen,
      vgrad: vgrad, WALL_THEME: WALL_THEME
    });

    return {
      boulder: boulder,
      box: box,
      buildProps: buildProps,
      drawProp: drawProp,
      drawPropLive: drawPropLive,
      propLives: function (pr) { return KINDS.lives(pr); },
      edgeLine: edgeLine
    };
  };
})(window);
