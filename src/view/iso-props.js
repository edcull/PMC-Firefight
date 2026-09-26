/* PMC 2670 — Firefight : the props: the scenery that stands on the table - trees, rocks, crates, sandbags, wrecks and rubble - laid out once for a table and each painted in pixel art, with the few shapes the rest of the renderer borrows for its own.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoProps = function (B) {
    var a = B.a, dot = B.dot, ellipse = B.ellipse, pal2 = B.pal2, poly = B.poly, rect = B.rect, rng = B.rng;
    var slab = B.slab, toScreen = B.toScreen, A = B.A, BAG = B.BAG, BARK = B.BARK, BRICK = B.BRICK;
    var CHAR = B.CHAR, CONCRETE = B.CONCRETE, K = B.K, LEAF = B.LEAF, PIXEL = B.PIXEL, PREFAB = B.PREFAB;
    var ROOF = B.ROOF, STONE = B.STONE;
    // from modules installed after this one: looked up when called
    function depthIn() { return B.depthIn.apply(this, arguments); }
    function pebble() { return B.pebble.apply(this, arguments); }
    function spotIn() { return B.spotIn.apply(this, arguments); }
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
    function buildProps(terrain, objectives, seed, planet) {
      var props = [];
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
        if (r.kind === 'ravine') return;               // nothing stands in a crevasse
        if (r.kind === 'lava') {
          // smoke and heat rising out of the crack
          for (var vt = 0; vt < Math.max(1, Math.round(area / 22)); vt++) {
            var vq = spotIn(r, 1.2, rand);
            props.push({ kind: 'vent', x: vq.x, y: vq.y, tone: rand(), seed: (rand() * 9999) | 0 });
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
        } else if (r.kind === 'trench' || r.kind === 'wire') {
          /* A trench: a single course of bags along each lip of the slot. Barbed
             wire: pickets along the line with the coils strung between them. */
          var hz2 = r.w > r.h, ln2 = hz2 ? r.w : r.h, SG = 1.5;
          var ns2 = Math.max(1, Math.round(ln2 / SG)), sl2 = ln2 / ns2;
          for (var s3 = 0; s3 < ns2; s3++) {
            var md = (s3 + 0.5) * sl2;
            if (r.kind === 'wire') {
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
        if (r.kind === 'razed') {
          // a flattened wall: broken blocks along the line it held
          var hz = r.w > r.h, ln = hz ? r.w : r.h;
          for (var q = 0.2; q < ln - 0.1; q += 0.5) {
            props.push({
              kind: 'wreckstone',
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
            checked: !!r.checked, found: !!r.found, cold: !!r.cold,
            seed: (rr2() * 9999) | 0
          });
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
          for (var ws = 0; ws < wn; ws++) {
            var wm = (ws + 0.5) * wsl;
            props.push({
              kind: 'wallrun', x: whz ? r.x + wm : r.x + r.w / 2, y: whz ? r.y + r.h / 2 : r.y + wm,
              horiz: whz, len: wsl, first: ws === 0, last: ws === wn - 1, wire: wire, height: wh3,
              reinforced: !!r.reinforced, seed: (wr() * 9999) | 0
            });
          }
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
        // a building's style, and each of its wings as a block of its own
        var sty = ['concrete', 'concrete', 'brick', 'prefab'][(rand() * 4) | 0];
        if (planet === 'industrial' && rand() < 0.5) sty = 'prefab';
        if ((planet === 'sparse' || planet === 'jungle') && rand() < 0.4) sty = 'brick';
        var wings = r.kind === 'building' && r.parts ? r.parts : [r];
        // the entrance, the sign and the awning go on the biggest wing only
        var mainW = wings.reduce(function (b2, q) { return !b2 || q.w * q.h > b2.w * b2.h ? q : b2; }, null);
        wings.forEach(function (q) {
          props.push({
            main: q === mainW,
            kind: r.kind === 'wall' ? 'highwall' : r.kind,
            x: q.x, y: q.y, w: q.w, h: q.h, height: Math.max(a(8), Math.round(height * (q.hf || 1) * storeys(r, q))),
            style: r.kind === 'building' ? sty : null, seed: (rand() * 9999) | 0
          });
        });
      });
      objectives.forEach(function (o, i) {
        // the Demolish target is its own marker: no flag planted in front of its wall
        var onTarget = terrain.some(function (t) { return t.kind === 'objective' && o.x >= t.x - 0.5 && o.x <= t.x + t.w + 0.5 && o.y >= t.y - 0.5 && o.y <= t.y + t.h + 0.5; });
        if (!onTarget) props.push({ kind: 'beacon', x: o.x, y: o.y, index: i });
      });
      props.forEach(function (p) {
        // the search-site hatch draws over its own scatter, so it stays readable
        p.depth = (p.w ? p.x + p.w / 2 + p.y + p.h / 2 : p.x + p.y) +
          (p.kind === 'rubble' ? -0.01 : p.kind === 'searchsite' ? 2.4 : 0);
      });
      props.sort(function (a, b) { return a.depth - b.depth; });
      /* Two blocks side by side are not ordered by their middles: a small wing at
         the end of a long building can have its middle nearer the viewer and still
         stand wholly behind it. A block that lies entirely behind another along
         either axis is drawn first — put right, pass by pass, among the tall ones. */
      var BOX = { building: 1, bunker: 1, highwall: 1, objective: 1 };
      function behind(p1, p2) {
        var e = 1e-3;
        var sepX = p1.x + p1.w <= p2.x + e, sepY = p1.y + p1.h <= p2.y + e;
        var backX = p2.x + p2.w <= p1.x + e, backY = p2.y + p2.h <= p1.y + e;
        return (sepX && !backY) || (sepY && !backX);
      }
      for (var pass = 0; pass < 6; pass++) {
        var moved = false;
        for (var i1 = 0; i1 < props.length; i1++) {
          var pa = props[i1];
          if (!BOX[pa.kind] || !pa.w) continue;
          for (var j1 = i1 + 1; j1 < props.length; j1++) {
            var pb = props[j1];
            if (!BOX[pb.kind] || !pb.w) continue;
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

      poly(g, [[c1[0] + sh, c1[1] + PIXEL], [c2[0] + sh, c2[1] + PIXEL],
      [c3[0] + sh, c3[1] + PIXEL], [c4[0] + sh, c4[1] + PIXEL]], 'rgba(14,11,8,.45)');

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
      poly(g, [c2, c3, t3, t2], vgrad(g, t3[1], c3[1], [pal[2], pal[2], pal[1]]));
      poly(g, [c4, c3, t3, t4], vgrad(g, t3[1], c3[1], [pal[5], pal[4], pal[4], pal[3]]));
      edgeLine(g, t3, c3, pal[5], 1);                // the corner, catching the light

      // cast panels, joints, streaks and grime on the two faces that are lit
      function skin(A, B, seam, grime) {
        var len = Math.hypot(B[0] - A[0], B[1] - A[1]);
        var cols = Math.max(2, Math.round(len / (K * 1.7)));
        for (var i = 1; i < cols; i++) {
          var q = lerp2(A, B, i / cols);
          edgeLine(g, [q[0], q[1] - hgt + 1], [q[0], q[1] - 1], seam, 1);
        }
        var rows = Math.max(1, Math.round(hgt / (K * 1.2)));
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

      poly(g, [t1, t2, t3, t4], opts.roof);          // roof
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
      // a parapet all the way round, lit on the near edges
      edgeLine(g, t1, t2, opts.roofEdge, 2); edgeLine(g, t1, t4, opts.roofEdge, 2);
      edgeLine(g, t2, t3, opts.roofEdge, 2); edgeLine(g, t4, t3, opts.roofEdge, 2);
      edgeLine(g, [t2[0], t2[1] - 2], [t3[0], t3[1] - 2], pal[5], 1);
      edgeLine(g, [t4[0], t4[1] - 2], [t3[0], t3[1] - 2], pal[5], 1);

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
      switch (pr.kind) {
        case 'tree': {
          shadowBlob(g, { x: p.x + a(2), y: p.y + a(1) }, pr.rad + a(1), (pr.rad + a(1)) / 2);
          var tr = rng(pr.seed);
          // trunk, with bark texture and a flare at the base
          if (pr.tone < 0.28) { conifer(g, p, pr, tr); break; }
          rect(g, p.x - a(0.7), p.y - pr.h, a(1.4), pr.h, BARK[1]);
          rect(g, p.x - a(0.7), p.y - pr.h, a(0.5), pr.h, BARK[2]);
          rect(g, p.x + a(0.4), p.y - pr.h, a(0.3), pr.h, BARK[0]);
          rect(g, p.x - a(1.1), p.y - a(0.9), a(2.2), a(0.9), BARK[0]);
          rect(g, p.x - a(1.1), p.y - a(0.9), a(0.6), a(0.5), BARK[1]);
          for (var bk = 0; bk < pr.h / 5; bk++) {
            dot(g, p.x - a(0.7) + tr() * a(1.4), p.y - tr() * pr.h, tr() > 0.5 ? BARK[0] : BARK[2], 1);
          }
          pr = { rad: pr.rad * 1.2, h: pr.h, tone: pr.tone };
          var cy = p.y - pr.h * 0.9 - pr.rad * 0.35;
          var base = 1 + Math.round(pr.tone * 1.4);
          // branches reaching out of the canopy
          for (var b2 = 0; b2 < 3; b2++) {
            var ba = Math.PI + tr() * Math.PI;
            rect(g, p.x + Math.cos(ba) * pr.rad * 0.5, p.y - pr.h + Math.sin(ba) * pr.rad * 0.2,
              PIXEL * 2, PIXEL, BARK[0]);
          }
          // the canopy, built from overlapping clumps rather than one smooth blob
          ellipse(g, p.x, cy + a(1.4), pr.rad * 1.02, pr.rad * 0.84, LEAF[0]);   // underside
          ellipse(g, p.x, cy + a(0.6), pr.rad, pr.rad * 0.82, LEAF[base]);
          var lobes = 5 + (tr() * 3 | 0);
          for (var lb = 0; lb < lobes; lb++) {
            var ang = tr() * Math.PI * 2, dist = pr.rad * (0.18 + tr() * 0.46);
            var lx2 = p.x + Math.cos(ang) * dist, ly2 = cy + Math.sin(ang) * dist * 0.72;
            var up = (Math.cos(ang) + Math.sin(ang)) < 0;      // lit from the north-west
            ellipse(g, lx2, ly2, pr.rad * (0.32 + tr() * 0.26), pr.rad * (0.26 + tr() * 0.2),
              LEAF[up ? Math.min(5, base + 2) : Math.max(0, base - 1)]);
          }
          ellipse(g, p.x - pr.rad * 0.36, cy - pr.rad * 0.34, pr.rad * 0.42, pr.rad * 0.3,
            LEAF[Math.min(5, base + 3)]);                      // the crown catching the sun
          // leaf grain, one pixel at a time
          var grains = Math.round(pr.rad * pr.rad * 0.22);
          for (var i = 0; i < grains; i++) {
            var la = tr() * Math.PI * 2, ld = Math.sqrt(tr()) * pr.rad * 0.96;
            var lx = p.x + Math.cos(la) * ld, ly = cy + Math.sin(la) * ld * 0.8;
            var far = (Math.cos(la) + Math.sin(la)) > 0.2;
            dot(g, lx, ly, far ? LEAF[Math.max(0, base - 1)] : LEAF[Math.min(5, base + 3)], 1);
          }
          for (var gp = 0; gp < pr.rad / 8; gp++) {            // gaps showing sky through
            var ga = tr() * Math.PI * 2, gd = Math.sqrt(tr()) * pr.rad * 0.7;
            dot(g, p.x + Math.cos(ga) * gd, cy + Math.sin(ga) * gd * 0.8, LEAF[0], 2);
          }
          break;
        }
        case 'bush': {
          var br2 = rng((pr.tone * 9999) | 0);
          shadowBlob(g, { x: p.x + a(1), y: p.y }, pr.rad, pr.rad / 2);
          var bb = 1 + Math.round(pr.tone);
          ellipse(g, p.x, p.y - a(0.6), pr.rad, pr.rad * 0.72, LEAF[0]);
          ellipse(g, p.x, p.y - a(1.2), pr.rad * 0.94, pr.rad * 0.66, LEAF[bb]);
          ellipse(g, p.x - a(1), p.y - a(2), pr.rad * 0.5, pr.rad * 0.4, LEAF[Math.min(5, bb + 2)]);
          for (var bg = 0; bg < pr.rad * 0.9; bg++) {
            var ba2 = br2() * Math.PI * 2, bd = Math.sqrt(br2()) * pr.rad * 0.9;
            dot(g, p.x + Math.cos(ba2) * bd, p.y - a(1.2) + Math.sin(ba2) * bd * 0.7,
              (Math.cos(ba2) + Math.sin(ba2)) > 0 ? LEAF[0] : LEAF[Math.min(5, bb + 2)], 1);
          }
          break;
        }
        case 'rock': {
          boulder(g, p.x, p.y, pr.rad * K * 0.72, pr.h * 0.8, rng(pr.seed), pr.basalt ? BASALTS : null);
          break;
        }
        case 'reeds': {
          // a clump of reeds standing out of the shallows, a few with a brown head
          var rr5 = rng(pr.seed), nre = 5 + (rr5() * 5 | 0);
          ellipse(g, p.x, p.y, a(1.6), a(0.6), 'rgba(20,40,30,.35)');
          for (var re = 0; re < nre; re++) {
            var rx5 = p.x + (rr5() - 0.5) * a(2.6), rh = a(2.2 + rr5() * 3.2), lean = (rr5() - 0.5) * a(1.2);
            var rc = rr5() > 0.6 ? '#7a8a44' : rr5() > 0.3 ? '#56702f' : '#3e5423';
            edgeLine(g, [rx5, p.y], [rx5 + lean, p.y - rh], rc, 1);
            if (rr5() > 0.7) rect(g, rx5 + lean - 1, p.y - rh - 1, 2, a(0.9), '#5a3c22');
          }
          break;
        }
        case 'lily': {
          var lr = rng(pr.seed);
          for (var lpd = 0; lpd < 2 + (lr() * 3 | 0); lpd++) {
            var lx5 = p.x + (lr() - 0.5) * a(2.4), ly5 = p.y + (lr() - 0.5) * a(1);
            ellipse(g, lx5, ly5, a(0.8), a(0.36), '#3f6a2c');
            ellipse(g, lx5 - 1, ly5 - 1, a(0.5), a(0.2), '#5b8a3a');
            if (lr() > 0.75) dot(g, lx5, ly5 - 1, '#e8b4c8', 2);
          }
          break;
        }
        case 'crystals': {
          /* A cluster of green crystal: faceted prisms from one root, lit from
             within — a glow pooled on the ground round them and brightest at the tips. */
          var cr7 = rng(pr.seed), n7 = 3 + (cr7() * 4 | 0), sz7 = pr.size || 1;
          /* a radioactive glow: light added to the ground, not paint on it —
             a wide pool that fades out, with a hot core under the roots */
          function halo(rx, ry, cy, alpha) {
            g.save(); g.globalCompositeOperation = 'lighter';
            g.translate(p.x, cy); g.scale(1, ry / rx);
            var hg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
            hg.addColorStop(0, 'rgba(110,255,160,' + alpha + ')');
            hg.addColorStop(0.35, 'rgba(60,230,120,' + alpha * 0.55 + ')');
            hg.addColorStop(1, 'rgba(30,200,90,0)');
            g.fillStyle = hg; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
            g.restore();
          }
          halo(a(4.6 * sz7), a(2.2 * sz7), p.y, 0.45);
          ellipse(g, p.x, p.y, a(1.4 * sz7), a(0.6 * sz7), 'rgba(150,255,190,.3)');
          var shards = [];
          for (var k7 = 0; k7 < n7; k7++) {
            var lean = (cr7() - 0.5) * 0.8, hgt = a((1.6 + cr7() * 2.4) * sz7), wid = a((0.6 + cr7() * 0.45) * sz7);
            shards.push({ ox: (cr7() - 0.5) * a(1.4 * sz7), lean: lean, h: hgt, w: wid });
          }
          shards.sort(function (s1, s2) { return s2.h - s1.h; }).forEach(function (sh) {
            var bx7 = p.x + sh.ox, by7 = p.y, tx = bx7 + Math.sin(sh.lean) * sh.h, ty = by7 - Math.cos(sh.lean) * sh.h;
            var cx7 = tx - Math.sin(sh.lean) * sh.w * 0.9, cy7 = ty + Math.cos(sh.lean) * sh.w * 0.9;
            poly(g, [[bx7 - sh.w, by7], [cx7 - sh.w * 0.8, cy7], [tx, ty], [bx7, by7 + sh.w * 0.35]],
              vgrad(g, ty, by7, ['#7dffb4', '#2fb56a', '#12502f']));                                  // shaded face
            poly(g, [[bx7, by7 + sh.w * 0.35], [tx, ty], [cx7 + sh.w * 0.8, cy7], [bx7 + sh.w, by7]],
              vgrad(g, ty, by7, ['#d4ffe6', '#5cf09a', '#1f8a4c']));                                  // lit face
            edgeLine(g, [bx7, by7 + sh.w * 0.35], [tx, ty], 'rgba(235,255,245,.85)', 1);           // the glint down the edge
            ellipse(g, tx, ty, a(0.5 * sz7), a(0.5 * sz7), 'rgba(160,255,200,.35)');               // the glow at the tip
            dot(g, tx, ty, '#ffffff', 1);
          });
          halo(a(2.6 * sz7), a(2.6 * sz7), p.y - a(2 * sz7), 0.3);             // the air round them lit too
          break;
        }
        case 'vent': {
          // a vent over the hottest ground: a glow on the crust and smoke going up
          var vr = rng(pr.seed);
          ellipse(g, p.x, p.y, a(1.3), a(0.6), 'rgba(255,150,60,.16)');
          ellipse(g, p.x, p.y, a(0.5), a(0.22), 'rgba(255,210,130,.45)');
          for (var sm2 = 0; sm2 < 5; sm2++) {
            var sy2 = a(1.5) + sm2 * a(2.2);
            ellipse(g, p.x + sm2 * a(0.9) + vr() * a(1), p.y - sy2, a(1.1 + sm2 * 0.55), a(0.7 + sm2 * 0.3),
              'rgba(' + (60 - sm2 * 6) + ',' + (50 - sm2 * 5) + ',' + (46 - sm2 * 4) + ',' + (0.34 - sm2 * 0.055) + ')');
          }
          for (var em = 0; em < 3; em++) dot(g, p.x + (vr() - 0.5) * a(2), p.y - a(1 + vr() * 5), '#ffb040', 1);
          break;
        }
        case 'scrap': {
          // a twisted girder or a torn plate half-buried in the rubble
          var sr5 = rng(pr.seed), ang5 = sr5() * Math.PI, ln5 = a(3 + sr5() * 3);
          var ex5 = p.x + Math.cos(ang5) * ln5, ey5 = p.y + Math.sin(ang5) * ln5 * 0.5 - a(1 + sr5() * 1.5);
          shadowBlob(g, { x: p.x + a(1), y: p.y + a(0.4) }, ln5 * 0.6, a(0.8));
          edgeLine(g, [p.x, p.y], [ex5, ey5], '#2a2724', 3);
          edgeLine(g, [p.x, p.y - 1], [ex5, ey5 - 1], '#5a534a', 1);
          edgeLine(g, [ex5, ey5], [ex5 + a(1), ey5 - a(1.2)], '#3a3530', 2);
          if (sr5() > 0.5) dot(g, p.x + (ex5 - p.x) * 0.5, p.y + (ey5 - p.y) * 0.5, '#6b3a22', 2);   // rust
          break;
        }
        case 'log': {
          // a fallen trunk lying across the floor of the wood
          var lr6 = rng(pr.seed), dx6 = Math.cos(pr.ang) * pr.len, dy6 = Math.sin(pr.ang) * pr.len * 0.5;
          var A6 = [p.x - dx6 / 2, p.y - dy6 / 2], B6 = [p.x + dx6 / 2, p.y + dy6 / 2];
          shadowBlob(g, { x: p.x + a(0.8), y: p.y + a(0.5) }, pr.len * 0.55, a(1));
          edgeLine(g, [A6[0], A6[1] - a(0.3)], [B6[0], B6[1] - a(0.3)], BARK[0], a(1.6));
          edgeLine(g, [A6[0], A6[1] - a(0.7)], [B6[0], B6[1] - a(0.7)], BARK[1], a(0.9));
          edgeLine(g, [A6[0], A6[1] - a(1)], [B6[0], B6[1] - a(1)], BARK[2], 1);
          ellipse(g, B6[0], B6[1] - a(0.5), a(0.7), a(0.6), '#6b5238');       // the sawn or snapped end
          ellipse(g, B6[0], B6[1] - a(0.5), a(0.35), a(0.3), '#8a6c48');
          for (var ms = 0; ms < 4; ms++) {                                     // moss
            var f6 = lr6();
            dot(g, A6[0] + (B6[0] - A6[0]) * f6, A6[1] + (B6[1] - A6[1]) * f6 - a(1), LEAF[3], 2);
          }
          break;
        }
        case 'stump': {
          rect(g, p.x - a(0.8), p.y - a(1.4), a(1.6), a(1.4), BARK[1]);
          rect(g, p.x - a(0.8), p.y - a(1.4), a(0.5), a(1.4), BARK[2]);
          ellipse(g, p.x, p.y - a(1.4), a(0.8), a(0.4), '#7a6040');
          ellipse(g, p.x, p.y - a(1.4), a(0.4), a(0.2), '#5e4830');
          break;
        }
        case 'fern': {
          // undergrowth: a spray of fronds under the trees
          var fr6 = rng(pr.seed), fc = LEAF[1 + Math.round(pr.tone * 2)];
          for (var fd = 0; fd < 5; fd++) {
            var fa = Math.PI + fd / 4 * Math.PI + (fr6() - 0.5) * 0.3, fl = a(1.2 + fr6() * 1.2);
            edgeLine(g, [p.x, p.y], [p.x + Math.cos(fa) * fl * 1.3, p.y + Math.sin(fa) * fl * 0.8], fd % 2 ? fc : LEAF[Math.min(5, 3 + Math.round(pr.tone))], 1);
          }
          break;
        }
        case 'wire': {
          /* Barbed wire: two pickets a run, and loops of wire between them —
             a spiral seen side-on, catching the light where it turns. */
          var wr2 = rng(pr.seed), lf2 = lift || 0;
          var ux2 = pr.horiz ? 1 : 0, uy2 = pr.horiz ? 0 : 1;
          function ws(t, z) { var q = toScreen(pr.x + ux2 * t, pr.y + uy2 * t); return [q.x, q.y - lf2 - z]; }
          var L2 = (pr.len || 1.5) / 2, HT = a(2.6);
          [-L2 + 0.1, L2 - 0.1].forEach(function (t) {
            var b0 = ws(t, 0), b1 = ws(t, HT + a(0.6));
            g.strokeStyle = '#3b3326'; g.lineWidth = Math.max(1, a(0.35));
            g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
          });
          g.lineWidth = 1;
          for (var loop = 0; loop < 2; loop++) {
            g.strokeStyle = loop ? 'rgba(170,176,178,.85)' : 'rgba(70,72,74,.9)';
            g.beginPath();
            for (var k2 = 0; k2 <= 28; k2++) {
              var tt2 = -L2 + (k2 / 28) * 2 * L2, ph = k2 / 28 * Math.PI * 2 * 3 + loop * 0.6 + wr2() * 0.2;
              var q2 = ws(tt2 + Math.cos(ph) * 0.12, HT * (0.5 + Math.sin(ph) * 0.45));
              if (k2) g.lineTo(q2[0] + (loop ? 0 : 1), q2[1] + (loop ? 0 : 1)); else g.moveTo(q2[0], q2[1]);
            }
            g.stroke();
          }
          break;
        }
        case 'sandbag': {
          /* A run of a low sandbag wall: three courses of bags laid end to end
             along the wall's own line, each course set half a bag over the one
             below, so run after run joins into one wall. */
          var sr = rng(pr.seed || ((pr.tone * 9999) | 0));
          var ux = pr.horiz ? 1 : 0, uy = pr.horiz ? 0 : 1, vx = 1 - ux, vy = 1 - uy;
          var len6 = pr.len || 0.75, BL = 0.5, HW = 0.2, HC = a(1.9), lf = lift || 0;
          var nb = Math.max(1, Math.round(len6 / BL)), bl = len6 / nb;
          function scr(wx2, wy2, up) { var q = toScreen(wx2, wy2); return [q.x, q.y - lf - up]; }
          // the shadow along the foot of the wall
          var s0 = -len6 / 2, s1 = len6 / 2;
          poly(g, [scr(pr.x + ux * s0 + vx * (HW + 0.25), pr.y + uy * s0 + vy * (HW + 0.25), 0),
            scr(pr.x + ux * s1 + vx * (HW + 0.25), pr.y + uy * s1 + vy * (HW + 0.25), 0),
            scr(pr.x + ux * s1 + vx * HW, pr.y + uy * s1 + vy * HW, 0),
            scr(pr.x + ux * s0 + vx * HW, pr.y + uy * s0 + vy * HW, 0)], 'rgba(16,12,8,.35)');
          for (var course = 0; course < (pr.courses || 3); course++) {
            var off = course % 2 ? bl / 2 : 0;
            var bags = [];
            for (var bi = -1; bi <= nb; bi++) {
              var c0 = -len6 / 2 + bi * bl + off, c1 = c0 + bl;
              // clip to this run, so neighbouring runs meet without overlapping
              var a0 = Math.max(c0, -len6 / 2), a1 = Math.min(c1, len6 / 2);
              if (a1 - a0 < 0.06) continue;
              // the very ends of the wall are squared off rather than left ragged
              bags.push([a0, a1]);
            }
            var z0 = course * HC, z1 = z0 + HC;
            var inset = course * 0.02;
            bags.forEach(function (bg) {
              /* a bag is a filled sack, not a brick: its outline is a rounded
                 oblong, it bulges at the middle, sits lower at its tied ends, and
                 the weave of the hessian catches the light across its top */
              var p0 = bg[0] + 0.02, p1 = bg[1] - 0.02, w0 = HW - inset, cm = (p0 + p1) / 2, hl = (p1 - p0) / 2;
              var cutL = bg[0] <= -len6 / 2 + 1e-6 && !pr.first, cutR = bg[1] >= len6 / 2 - 1e-6 && !pr.last;
              function P(t, v, z) { return scr(pr.x + ux * t + vx * v, pr.y + uy * t + vy * v, z); }
              function outline(k, z, sag) {
                var pts = [];
                for (var q = 0; q < 16; q++) {
                  var th = q / 16 * Math.PI * 2, cc = Math.cos(th), ss = Math.sin(th);
                  var ex = 0.35;                                  // squarish in plan, round at the corners
                  var tt = (cc < 0 ? -1 : 1) * Math.pow(Math.abs(cc), ex), vv = (ss < 0 ? -1 : 1) * Math.pow(Math.abs(ss), ex);
                  // a bag cut where one run meets the next is squared off so the wall reads unbroken
                  if ((cutL && tt < 0) || (cutR && tt > 0)) tt = tt < 0 ? -1 : 1;
                  var zz = z - sag * Math.pow(Math.abs(tt), 4);   // the tied ends slump
                  pts.push(P(cm + tt * hl * k, vv * w0 * k, zz));
                }
                return pts;
              }
              var tint = BAG[Math.min(3, 1 + ((sr() * 2.2) | 0))];
              poly(g, outline(1, z0, 0), '#3e331d');                                  // the bag's foot, in shade
              poly(g, outline(1, z0 + HC * 0.45, HC * 0.15), pr.horiz ? BAG[0] : BAG[1]);   // its flank
              poly(g, outline(0.97, z1 - 1, HC * 0.3), tint);                         // the top
              var hi = outline(0.62, z1 + 1, HC * 0.2);
              poly(g, hi.map(function (q) { return [q[0] - 1, q[1] - 1]; }), BAG[3]);    // the belly catching the sun
              // the weave: a few rows of darker stitches across the top
              for (var wv = 0; wv < 6; wv++) {
                var wt = cm + (sr() - 0.5) * hl * 1.4, wvv = (sr() - 0.5) * w0 * 1.4;
                var wq = P(wt, wvv, z1 - 1);
                dot(g, wq[0], wq[1], sr() > 0.5 ? 'rgba(60,46,24,.55)' : 'rgba(200,180,130,.35)', 1);
              }
              // the seam between this bag and the next, and a tied ear on the odd one
              var sA = P(p1, -w0 * 0.8, z1 - HC * 0.3), sB = P(p1, w0 * 0.8, z1 - HC * 0.3);
              if (!cutR) edgeLine(g, sA, sB, 'rgba(40,32,18,.6)', 1);
              if (!cutR && sr() > 0.72) { var ear = P(p1 + 0.03, w0 * 0.3, z1 - HC * 0.2); rect(g, ear[0], ear[1] - 1, 2, 2, '#5a4a2a'); }
            });
          }
          break;
        }
        case 'wallrun': {
          /* A run of high wall: cast concrete panels between square posts, a
             coping along the top, grime rising from the foot, rain streaks, the
             odd crack and bullet pock, and on some walls a coil of razor wire. */
          var wr2 = rng(pr.seed), lf2 = lift || 0;
          var ux2 = pr.horiz ? 1 : 0, uy2 = pr.horiz ? 0 : 1, vx2 = 1 - ux2, vy2 = 1 - uy2;
          // a reinforced wall (p. 41) is thicker, and banded at the foot so it reads as one that stays up
          var L2 = pr.len, T2 = pr.reinforced ? 0.36 : 0.22, H2 = pr.height;
          function Q(t, v, z) { var q = toScreen(pr.x + ux2 * t + vx2 * v, pr.y + uy2 * t + vy2 * v); return [q.x, q.y - lf2 - z]; }
          function slab(t0, t1, v0, v1, z0, z1, pal2) {
            // the near side and the far end in shade, the top lit
            poly(g, [Q(t0, v1, z0), Q(t1, v1, z0), Q(t1, v1, z1), Q(t0, v1, z1)], pr.horiz ? pal2[3] : pal2[2]);
            poly(g, [Q(t1, v0, z0), Q(t1, v1, z0), Q(t1, v1, z1), Q(t1, v0, z1)], pr.horiz ? pal2[2] : pal2[3]);
            poly(g, [Q(t0, v0, z1), Q(t1, v0, z1), Q(t1, v1, z1), Q(t0, v1, z1)], pal2[4]);
          }
          var h0 = -L2 / 2, h1 = L2 / 2;
          // a shadow along the foot
          poly(g, [Q(h0, T2, 0), Q(h1, T2, 0), Q(h1, T2 + 0.5, 0), Q(h0, T2 + 0.5, 0)], 'rgba(14,11,8,.35)');
          slab(h0, h1, -T2, T2, 0, H2, CONCRETE);
          // panel joints, and the grime and streaks on the face that shows
          var np = Math.max(1, Math.round(L2 / 0.75));
          for (var pj = 1; pj < np; pj++) {
            var tj = h0 + (h1 - h0) * pj / np;
            edgeLine(g, Q(tj, T2, 1), Q(tj, T2, H2 - 1), CONCRETE[1], 1);
          }
          edgeLine(g, Q(h0, T2, H2 * 0.5), Q(h1, T2, H2 * 0.5), 'rgba(40,38,34,.35)', 1);   // the pour line
          if (pr.reinforced) {
            // hazard chevrons along the foot of the face that shows
            var nb = Math.max(2, Math.round(L2 / 0.35)), bz = Math.max(2, H2 * 0.14);
            for (var hb = 0; hb < nb; hb++) {
              var ta = h0 + (h1 - h0) * hb / nb, tb = h0 + (h1 - h0) * (hb + 1) / nb;
              poly(g, [Q(ta, T2, 0), Q(tb, T2, 0), Q(tb, T2, bz), Q(ta, T2, bz)], hb % 2 ? '#26241f' : '#c9a23a');
            }
          }
          for (var gm = 0; gm < 26; gm++) {
            var gt = h0 + wr2() * L2, gz = wr2() * wr2() * H2 * 0.5;
            var gq = Q(gt, T2, gz); dot(g, gq[0], gq[1], 'rgba(40,34,26,.5)', 1);
          }
          for (var rs = 0; rs < 3; rs++) {
            var rt = h0 + wr2() * L2, rl = wr2() * H2 * 0.5;
            for (var rz = 0; rz < rl; rz++) { var rq = Q(rt, T2, H2 - 2 - rz); dot(g, rq[0], rq[1], 'rgba(50,46,40,.35)', 1); }
          }
          if (wr2() > 0.6) {                                 // a crack across a panel
            var ct = h0 + wr2() * L2, cz = H2 * (0.3 + wr2() * 0.5), cq = Q(ct, T2, cz);
            for (var ck = 0; ck < 6; ck++) { var nq2 = [cq[0] + (wr2() - 0.3) * 4, cq[1] + (wr2() - 0.5) * 4]; edgeLine(g, cq, nq2, '#34322d', 1); cq = nq2; }
          }
          for (var bp2 = 0; bp2 < 3; bp2++) {                // bullet pocks
            if (wr2() > 0.5) continue;
            var bq = Q(h0 + wr2() * L2, T2, H2 * (0.2 + wr2() * 0.7)); dot(g, bq[0], bq[1], '#2e2c28', 2); dot(g, bq[0], bq[1] - 1, CONCRETE[5], 1);
          }
          // the coping, a little proud of the wall, chipped here and there
          slab(h0, h1, -T2 - 0.05, T2 + 0.05, H2, H2 + a(0.8), CONCRETE);
          edgeLine(g, Q(h0, T2 + 0.05, H2 + a(0.8)), Q(h1, T2 + 0.05, H2 + a(0.8)), CONCRETE[5], 1);
          // the posts: at the start of every run, and at the far end of the last
          var posts = [h0].concat(pr.last ? [h1 - 0.3] : []);
          posts.forEach(function (pt0) {
            slab(pt0, pt0 + 0.3, -T2 - 0.08, T2 + 0.08, 0, H2 + a(1.4), CONCRETE);
            edgeLine(g, Q(pt0, T2 + 0.08, H2 + a(1.4)), Q(pt0, T2 + 0.08, 1), CONCRETE[5], 1);
          });
          if (pr.wire) {
            // razor wire: a coil of loops along the top
            for (var lp2 = 0; lp2 < 7; lp2++) {
              var lt = h0 + (lp2 + 0.5) * L2 / 7, lc = Q(lt, 0, H2 + a(2.4));
              ellipse(g, lc[0], lc[1], a(1.3), a(1.3), 'rgba(0,0,0,0)');
              g.save(); g.strokeStyle = 'rgba(150,154,158,.85)'; g.lineWidth = 1;
              g.beginPath(); g.ellipse(lc[0], lc[1], a(1.1), a(1.4), 0.5, 0, Math.PI * 2); g.stroke(); g.restore();
              dot(g, lc[0] + a(0.8), lc[1] - a(0.6), '#d0d4d8', 1);
            }
          }
          break;
        }
        case 'rubble': {
          var rr = rng(pr.seed), nch = 3 + (rr() * 4 | 0);
          for (var ch = 0; ch < nch; ch++) {
            pebble(g, p.x + (rr() - 0.5) * a(5), p.y + (rr() - 0.5) * a(2.4), 1 + (rr() * 4 | 0), rr);
          }
          break;
        }
        case 'wreckstone': {
          var wr3 = rng(pr.seed);
          var wc = STONE[1 + Math.round(pr.tone * 2)];
          shadowBlob(g, { x: p.x, y: p.y + a(0.5) }, a(2.4), a(1.2));
          rect(g, p.x - a(1.8), p.y - a(2.2), a(3.6), a(2.4), wc);
          rect(g, p.x - a(1.8), p.y - a(2.2), a(3.6), a(0.8), STONE[4]);
          rect(g, p.x - a(0.6) + wr3() * a(1.4), p.y - a(3.4), a(1.6), a(1.4), STONE[2]);
          for (var dq = 0; dq < 4; dq++) {
            dot(g, p.x + (wr3() - 0.5) * a(5), p.y + (wr3() - 0.2) * a(1.6),
              wr3() > 0.5 ? CHAR[0] : STONE[0], 1);
          }
          break;
        }
        case 'burntshell': {
          // the gutted footprint: scorched walls, no roof
          var b1 = toScreen(pr.x, pr.y), b2 = toScreen(pr.x + pr.w, pr.y);
          var b3 = toScreen(pr.x + pr.w, pr.y + pr.h), b4 = toScreen(pr.x, pr.y + pr.h);
          var bh = pr.height;
          var br = rng(pr.seed);
          poly(g, [[b1.x, b1.y], [b2.x, b2.y], [b3.x, b3.y], [b4.x, b4.y]], '#1a1512');
          // the floor inside: ash, embers still glowing, fallen roof beams
          for (var ash = 0; ash < pr.w * pr.h * 22; ash++) {
            var aq = toScreen(pr.x + br() * pr.w, pr.y + br() * pr.h), ar = br();
            dot(g, aq.x, aq.y, ar > 0.93 ? '#e0702a' : ar > 0.86 ? '#8c2a0c' : ar > 0.5 ? '#2b241f' : '#100c0a', ar > 0.86 ? 1 : 2);
          }
          for (var bm = 0; bm < 3 + (br() * 3 | 0); bm++) {
            var bA = toScreen(pr.x + br() * pr.w, pr.y + br() * pr.h);
            var bB = toScreen(pr.x + br() * pr.w, pr.y + br() * pr.h);
            edgeLine(g, [bA.x, bA.y - 2], [bB.x, bB.y - 2], '#0c0907', 3);
            edgeLine(g, [bA.x, bA.y - 3], [bB.x, bB.y - 3], '#3a2d22', 1);
          }
          poly(g, [[b2.x, b2.y], [b3.x, b3.y], [b3.x, b3.y - bh], [b2.x, b2.y - bh]],
            vgrad(g, b3.y - bh, b3.y, ['#15110d', '#2e251c', '#3a2e22']));
          poly(g, [[b4.x, b4.y], [b3.x, b3.y], [b3.x, b3.y - bh], [b4.x, b4.y - bh]],
            vgrad(g, b3.y - bh, b3.y, ['#1a140f', '#3d3226', '#4a3c2c']));
          // soot licking up from the empty window holes
          [[b4, b3], [b2, b3]].forEach(function (wv) {
            for (var wi = 0.2; wi < 0.9; wi += 0.25) {
              var wq = lerp2([wv[0].x, wv[0].y], [wv[1].x, wv[1].y], wi);
              rect(g, wq[0] - a(0.6), wq[1] - bh * 0.6, a(1.2), a(1.6), '#0a0806');
              for (var sl = 0; sl < bh * 0.4; sl++) {
                dot(g, wq[0] - a(0.6) + br() * a(1.2), wq[1] - bh * 0.6 - sl, 'rgba(8,6,5,.5)', 1);
              }
            }
          });
          // jagged remains of the upper courses
          for (var jc = 0; jc < 7; jc++) {
            var t2 = br();
            var jx = b4.x + (b3.x - b4.x) * t2, jy = b4.y + (b3.y - b4.y) * t2;
            rect(g, jx - a(1), jy - bh - a(1.6) - br() * a(2), a(2), a(2 + br() * 2), '#3a2f23');
          }
          for (var jd = 0; jd < 7; jd++) {
            var t3 = br();
            var kx = b2.x + (b3.x - b2.x) * t3, ky = b2.y + (b3.y - b2.y) * t3;
            rect(g, kx - a(1), ky - bh - a(1.4) - br() * a(2), a(2), a(2 + br() * 2), '#44372a');
          }
          break;
        }
        case 'flame': {
          var fr = rng(pr.seed);
          var fh = a(2 + pr.tone * 2.4);
          // light thrown on the ground, then the fire as layered tongues:
          // a red outer flame, orange body, a yellow-white heart low down
          ellipse(g, p.x, p.y, a(4), a(2), 'rgba(240,120,40,.16)');
          ellipse(g, p.x, p.y, a(2.4), a(1.2), 'rgba(250,160,60,.22)');
          var tongues = 3 + (fr() * 2 | 0);
          for (var tg = 0; tg < tongues; tg++) {
            var tx2 = p.x + (tg - (tongues - 1) / 2) * a(0.8) + (fr() - 0.5) * a(0.5);
            var th2 = fh * (0.6 + fr() * 0.6) * (tg === (tongues / 2 | 0) ? 1.25 : 1);
            [['#9a2e10', 1], ['#e0702a', 0.72], ['#f6c056', 0.45], ['#fff0c0', 0.2]].forEach(function (L) {
              var hh = th2 * L[1] + a(0.6), ww = a(1.1) * (0.5 + L[1] * 0.6);
              poly(g, [[tx2 - ww, p.y - a(0.3)], [tx2 + ww, p.y - a(0.3)],
                [tx2 + ww * 0.4, p.y - hh * 0.55], [tx2 + (fr() - 0.5) * a(0.6), p.y - hh], [tx2 - ww * 0.5, p.y - hh * 0.5]], L[0]);
            });
          }
          for (var sp3 = 0; sp3 < 3; sp3++) dot(g, p.x + (fr() - 0.5) * a(3), p.y - fh * (1.1 + fr() * 0.8), '#ffb040', 1);
          dot(g, p.x, p.y, '#4a2a16', 2);
          // smoke drifting up and away
          for (var sm = 0; sm < 4; sm++) {
            var sy = fh + a(2) + sm * a(2.4);
            ellipse(g, p.x + a(0.8) + sm * a(1.1) + fr() * a(1.2), p.y - sy,
              a(1.6 + sm * 0.6), a(1 + sm * 0.35), 'rgba(38,32,28,' + (0.3 - sm * 0.055) + ')');
          }
          break;
        }
        case 'wall': {
          brokenWall(g, pr);
          break;
        }
        /* The Demolish scenario's target: a tall concrete mast on a plinth, so it is
           obvious from across the table what has to come down. */
        case 'objective': {
          /* The Demolish target (p. 54): a hardened uplink station. A squat
             blockhouse of reinforced concrete, striped with hazard paint at the
             foot and shut with a blast door, carrying a lattice mast with two
             dishes, guy wires and a red warning light — so from across the table
             it is plain what has to come down. */
          var ol = lift || 0;
          box(g, pr, CONCRETE, { roof: '#45443e', roofEdge: '#6a675e', windows: null, lift: ol });
          function O(x, y, up) { var q = toScreen(x, y); return [q.x, q.y - ol - (up || 0)]; }
          var H0 = pr.height;
          var o1 = O(pr.x, pr.y + pr.h), o2 = O(pr.x + pr.w, pr.y + pr.h), o3 = O(pr.x + pr.w, pr.y);
          // hazard stripes round the foot of the two walls you can see
          [[o1, o2], [o3, o2]].forEach(function (F) {
            var A = F[0], B = F[1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.round(L / a(2.2));
            for (var i = 0; i < n; i++) {
              var p0 = lerp2(A, B, i / n), p1 = lerp2(A, B, (i + 1) / n), hs = a(1.8);
              poly(g, [p0, p1, [p1[0], p1[1] - hs], [p0[0], p0[1] - hs]], i % 2 ? '#1b1a17' : '#d9a441');
            }
            edgeLine(g, [A[0], A[1] - a(1.8)], [B[0], B[1] - a(1.8)], '#2e2c28', 1);
          });
          // the blast door: a steel slab in a heavy frame, riveted, with a warning lamp
          var dA = lerp2(o1, o2, 0.36), dB = lerp2(o1, o2, 0.64), dh2 = Math.min(H0 - a(2), a(8));
          poly(g, [[dA[0] - 2, dA[1]], [dB[0] + 2, dB[1]], [dB[0] + 2, dB[1] - dh2 - 3], [dA[0] - 2, dA[1] - dh2 - 3]], '#2b2a26');
          poly(g, [dA, dB, [dB[0], dB[1] - dh2], [dA[0], dA[1] - dh2]], '#5d6166');
          poly(g, [dA, lerp2(dA, dB, 0.5), [lerp2(dA, dB, 0.5)[0], lerp2(dA, dB, 0.5)[1] - dh2], [dA[0], dA[1] - dh2]], '#6c7176');
          edgeLine(g, lerp2(dA, dB, 0.5), [lerp2(dA, dB, 0.5)[0], lerp2(dA, dB, 0.5)[1] - dh2], '#34373a', 1);
          for (var rv = 0; rv < 6; rv++) {
            var rq = lerp2(dA, dB, rv % 2 ? 0.88 : 0.12);
            dot(g, rq[0], rq[1] - dh2 * (0.15 + Math.floor(rv / 2) * 0.33), '#8e949a', 1);
          }
          var lamp = lerp2(dA, dB, 0.5);
          dot(g, lamp[0] - 1, lamp[1] - dh2 - a(1.6), '#ff5a3a', 3);
          ellipse(g, lamp[0], lamp[1] - dh2 - a(1.4), a(1.4), a(0.7), 'rgba(255,90,58,.2)');
          // louvred vents high on the right-hand wall
          for (var vn = 0; vn < 2; vn++) {
            var v0 = lerp2(o3, o2, 0.25 + vn * 0.35), v1 = lerp2(o3, o2, 0.4 + vn * 0.35);
            poly(g, [[v0[0], v0[1] - H0 + a(4)], [v1[0], v1[1] - H0 + a(4)], [v1[0], v1[1] - H0 + a(6.5)], [v0[0], v0[1] - H0 + a(6.5)]], '#2a2926');
            for (var lv = 0; lv < 3; lv++) edgeLine(g, [v0[0], v0[1] - H0 + a(4.5) + lv * a(0.7)], [v1[0], v1[1] - H0 + a(4.5) + lv * a(0.7)], '#6a675e', 1);
          }
          // the mast: a lattice tower, tapering, cross-braced, on the middle of the roof
          var mc = toScreen(pr.x + pr.w / 2, pr.y + pr.h / 2), mx = mc.x, my = mc.y - ol - H0;
          var MH = a(36), bw0 = a(3.2), bw1 = a(1.2);
          // guy wires from the top down to the roof corners
          [O(pr.x + 0.4, pr.y + 0.4, H0), O(pr.x + pr.w - 0.4, pr.y + 0.4, H0), O(pr.x + pr.w - 0.4, pr.y + pr.h - 0.4, H0), O(pr.x + 0.4, pr.y + pr.h - 0.4, H0)].forEach(function (q) {
            edgeLine(g, [mx, my - MH * 0.8], q, 'rgba(40,40,38,.7)', 1);
          });
          rect(g, mx - a(3.4), my - a(1.2), a(6.8), a(1.2), '#3a3934');   // the footing
          var legs = [-1, 1];
          legs.forEach(function (sd) { edgeLine(g, [mx + sd * bw0, my], [mx + sd * bw1, my - MH], sd < 0 ? '#8a877e' : '#4a4843', 2); });
          edgeLine(g, [mx, my + 1], [mx, my - MH], '#5d5b54', 1);          // the third leg, behind
          for (var st2 = 0; st2 < 6; st2++) {
            var f0 = st2 / 6, f1 = (st2 + 1) / 6;
            var w0 = bw0 + (bw1 - bw0) * f0, w1 = bw0 + (bw1 - bw0) * f1;
            var y0 = my - MH * f0, y1 = my - MH * f1;
            edgeLine(g, [mx - w0, y0], [mx + w1, y1], '#6a675e', 1);
            edgeLine(g, [mx + w0, y0], [mx - w1, y1], '#5a574f', 1);
            edgeLine(g, [mx - w1, y1], [mx + w1, y1], '#7a776e', 1);
          }
          // two dishes, turned different ways, and a whip aerial on top
          function dish(dx, dy, r2, face) {
            ellipse(g, mx + dx, my - dy, r2, r2 * 1.1, '#3e3d38');
            ellipse(g, mx + dx + face, my - dy, r2 * 0.9, r2, '#c9c6bb');
            ellipse(g, mx + dx + face * 1.5, my - dy, r2 * 0.55, r2 * 0.6, '#a9a699');
            edgeLine(g, [mx + dx + face, my - dy], [mx + dx + face * 3.5, my - dy - 1], '#3e3d38', 1);
            dot(g, mx + dx + face * 3.5 - 1, my - dy - 2, '#5a574f', 2);
          }
          dish(-a(3.2), MH * 0.42, a(2.2), -a(0.8));
          dish(a(2.8), MH * 0.66, a(1.7), a(0.7));
          rect(g, mx, my - MH - a(6), 1, a(6), '#2a2926');
          ellipse(g, mx, my - MH - a(6), a(2), a(1.5), 'rgba(255,60,40,.22)');
          dot(g, mx - 1, my - MH - a(6) - 1, '#ff4a32', 3);
          dot(g, mx - 1, my - MH * 0.5, '#ff4a32', 2);
          break;
        }
        case 'building':
        case 'bunker':
        case 'highwall': {
          var bst = pr.kind === 'building' ? (pr.style || 'concrete') : null;
          var bp = pr.kind === 'bunker' ? CONCRETE : pr.kind === 'highwall' ? STONE : bst === 'brick' ? BRICK : bst === 'prefab' ? PREFAB : CONCRETE;
          box(g, pr, bp, {
            style: bst, main: pr.main !== false,
            roof: pr.kind === 'bunker' ? '#3a3a35' : pr.kind === 'highwall' ? STONE[4] : bst === 'brick' ? '#3e3a36' : bst === 'prefab' ? '#4a4f47' : ROOF[2],
            roofEdge: pr.kind === 'bunker' ? '#4c4c45' : pr.kind === 'highwall' ? STONE[5] : bst === 'brick' ? '#56504a' : bst === 'prefab' ? '#5e645a' : ROOF[3],
            windows: pr.kind === 'building' ? 'lit' : pr.kind === 'bunker' ? 'slit' : null,
            lift: lift || 0,
            cutaway: !!cutaway
          });
          break;
        }
        /* A possible objective location (p. 52): a prised-open hatch and a stake with
           a marker tag. Unchecked it flies a bright tag; searched and empty, the stake
           lies over and the tag is a dull rag. */
        case 'searchsite': {
          var sr = rng(pr.seed || 7);
          shadowBlob(g, { x: p.x, y: p.y }, a(7), a(3.5));
          ellipse(g, p.x, p.y, a(7), a(3.5), '#2e2820');
          ellipse(g, p.x, p.y, a(5), a(2.5), '#221d17');
          // the hatch rim, a low collar of plating
          poly(g, [[p.x - a(4), p.y], [p.x, p.y + a(2)], [p.x + a(4), p.y], [p.x, p.y - a(2)]], '#4a4a44');
          poly(g, [[p.x - a(3.2), p.y - a(0.4)], [p.x, p.y + a(1.2)], [p.x + a(3.2), p.y - a(0.4)], [p.x, p.y - a(2)]], '#5d5d55');
          poly(g, [[p.x - a(2.4), p.y], [p.x, p.y + a(1.2)], [p.x + a(2.4), p.y], [p.x, p.y - a(1.2)]], '#15181b');
          for (var sn = 0; sn < 5; sn++) {
            dot(g, p.x - a(3) + sr() * a(6), p.y - a(1.4) + sr() * a(2.8), '#6e6e64');
          }
          if (pr.checked) {
            // the stake down, the tag a rag on the ground beside it
            edgeLine(g, [p.x + a(2), p.y - a(1.6)], [p.x + a(8.5), p.y + a(0.6)], '#6a5a42', 2);
            edgeLine(g, [p.x + a(2), p.y - a(2.2)], [p.x + a(8.5), p.y], '#8a7754', 1);
            rect(g, p.x + a(7.5), p.y + a(0.4), a(3), a(1.6), pr.found ? '#d8a83f' : '#55534a');
            // a location ruled out is struck through
            if (pr.cold) {
              edgeLine(g, [p.x - a(4), p.y - a(2)], [p.x + a(4), p.y + a(2)], '#8c3c2e', 2);
              edgeLine(g, [p.x - a(4), p.y + a(2)], [p.x + a(4), p.y - a(2)], '#8c3c2e', 2);
            }
          } else {
            rect(g, p.x + a(4), p.y - a(9), a(1), a(9), '#5a4c38');
            rect(g, p.x + a(4), p.y - a(9), a(0.5), a(9), '#786748');
            rect(g, p.x + a(5), p.y - a(9), a(3.4), a(2.2), '#d8a83f');
            rect(g, p.x + a(5), p.y - a(9), a(3.4), a(0.8), '#f0cc6a');
          }
          break;
        }
        case 'beacon': {
          shadowBlob(g, { x: p.x + a(1), y: p.y }, a(4), a(2));
          poly(g, [[p.x - a(5), p.y], [p.x, p.y + a(2.5)], [p.x + a(5), p.y], [p.x, p.y - a(2.5)]], '#2a2f36');
          poly(g, [[p.x - a(3.6), p.y - a(1)], [p.x, p.y + a(1)], [p.x + a(3.6), p.y - a(1)], [p.x, p.y - a(3)]], '#3b424c');
          rect(g, p.x - a(1), p.y - a(11), a(2), a(10), '#20262d');
          rect(g, p.x - a(1), p.y - a(11), a(1), a(10), '#39424d');
          rect(g, p.x - a(1.5), p.y - a(13), a(3), a(2), '#e8c15a');
          break;
        }
      }
    }


    return {
      boulder: boulder,
      box: box,
      buildProps: buildProps,
      drawProp: drawProp,
      edgeLine: edgeLine
    };
  };
})(window);
