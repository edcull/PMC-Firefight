/* PMC 2670 — Firefight : the ground: the table baked once into a plate - soil, grass, water, sand and snow for each world, the hills stepped up in isometric relief, the craters, ravines and ruins dug into it - and the small helpers the rest of the renderer shares for placing things on it.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoGround = function (B) {
    var a = B.a, boulder = B.boulder, clamp01 = B.clamp01, dot = B.dot, edgeLine = B.edgeLine, fbm = B.fbm;
    var hash = B.hash, poly = B.poly, rect = B.rect, rng = B.rng, toScreen = B.toScreen, toWorld = B.toWorld;
    var vnoise = B.vnoise, A = B.A, BAYER = B.BAYER, CRUST = B.CRUST, DEEPW = B.DEEPW, ELEV = B.ELEV;
    var GLOW = B.GLOW, GROUNDS = B.GROUNDS, H = B.H, K = B.K, LIP = B.LIP, OX = B.OX, OY = B.OY;
    var PIXH = B.PIXH, PIXW = B.PIXW, STONE = B.STONE, W = B.W, WATER = B.WATER;

    /* ---------- ground ----------
       The rules read terrain as rectangles, so the art paints those rectangles:
       what you can see is exactly what counts as cover. The soil itself is dithered
       one buffer pixel at a time, from noise sampled on a coarser lattice. */

    var FOREST = ['#111908', '#17210e', '#1d2a13', '#233318', '#2a3d1d'];
    var SLAB = ['#222420', '#2d302b', '#393c36', '#454941', '#52564d'];
    var SCREE = ['#2b2d2b', '#373a37', '#444743', '#51544f', '#5e625c'];
    var CHURN = ['#1f1911', '#282017', '#31281d', '#3a3024', '#43382a'];
    // spoil: earth turned over by a dig, lighter than the ground around it
    var SPOIL = ['#4a3f2c', '#584b34', '#665740', '#756549', '#867455'];

    // ground fills keyed by terrain kind: ramp, flecks, and how hard the edge reads
    var FLOOR = {
      hill: { ramp: ['#5d5340', '#6b5e48', '#786a52', '#87785d', '#96876b'], fleck: ['#5f6a3c', '#4d5730', '#a2926f'], rim: '#4a412f' },
      woods: { ramp: FOREST, fleck: ['#3f5430', '#4a613a', '#1a2412'], rim: '#131a0d' },
      ruins: { ramp: SLAB, fleck: ['#6a6459', '#211f1b', '#7a7468'], rim: '#1d1c18' },
      crater: { ramp: CHURN, fleck: ['#1a1410', '#6a5a42', '#241d16'], rim: '#1b150f' },
      barricade: { ramp: CHURN, fleck: ['#6a5c43', '#2a2219'], rim: '#241d15' },
      // a trench: the dug slot, dark and trodden, with spoil flecked along it
      trench: { ramp: ['#1c1710', '#241d14', '#2c2419', '#352b1e', '#3e3223'], fleck: ['#4a3d2a', '#15110b', '#5a4a33'], rim: '#120e09' },
      wire: { ramp: CHURN, fleck: ['#5a4c38', '#2a2219'], rim: '#2a2219' },
      rocks: { ramp: SCREE, fleck: ['#6f6b62', '#22211d', '#8a857a'], rim: '#1e1d1a' },
      building: { ramp: SLAB, fleck: ['#6a6459', '#211f1b'], rim: '#1d1c18' },
      bunker: { ramp: SLAB, fleck: ['#5f5b54', '#211f1b'], rim: '#1d1c18' },
      objective: { ramp: SLAB, fleck: ['#6b6258', '#231f1b'], rim: '#1a1815' },
      wall: { ramp: SCREE, fleck: ['#6f6b62', '#22211d'], rim: '#1e1d1a' },
      // Find and secure: scoured ground where something might be buried
      searchsite: { ramp: SPOIL, fleck: ['#9b8c6c', '#3a3022', '#b0a488'], rim: '#332a1c' },
      // Ambush!: a packed-earth road, rutted by the column's wheels
      road: { ramp: ['#4c463a', '#575042', '#625a4b', '#6d6454', '#786e5d'], fleck: ['#3a342a', '#8a806c'], rim: '#2e2921' },
      water: { ramp: WATER, fleck: ['#74b0c2', '#22414f'], rim: '#1b3540', wet: true },
      deep: { ramp: DEEPW, fleck: ['#25506a', '#0d202c'], rim: '#0a1822', wet: true },
      lava: { ramp: CRUST, fleck: ['#d1541a', '#f08a22', '#1a1412'], rim: '#140f0c', hot: true },
      // a desert's crystal field: dark, scorched brown ground the crystals have grown through
      crystal: { ramp: ['#1f1510', '#2a1d15', '#35251a', '#40301f'], fleck: ['#5aff9a', '#1a110b', '#54402c'], rim: '#140d09' },
      // an arctic world's ice ravine: the floor far down in blue dark
      ravine: { ramp: ['#060d15', '#0a1622', '#0f2030', '#152a3e'], fleck: ['#1f3d57', '#081018'], rim: '#dfeef7' }
    };

    function hex3(h) {
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    }

    /* The open ground is not laid down independently of what stands on it. Around
       water and woods the soil runs green and then, right at a pool's edge, to
       mud; round rock, rubble and walls it is dry and stony; round a lava field it
       is baked bare; buildings sit on trodden, dusty ground. Worked out once on a
       half-inch grid, broken up with noise so the bands never read as rings, and
       then added to the noise fields the soil is drawn from. */
    var FIT = {
      //          reach   green  dry    mud-ring  (n: darker/lighter)
      woods:    { r: 4.5, p: 0.26, d: -0.14, n: -0.05 },
      water:    { r: 5, p: 0.22, d: -0.2, mud: 0.8, n: -0.04 },
      deep:     { r: 5, p: 0.18, d: -0.18, mud: 0.9, n: -0.06 },
      hill:     { r: 3, p: 0.1, d: 0.02, n: 0.02 },
      rocks:    { r: 3, p: -0.1, d: 0.08, n: -0.07, tint: '#57534d', tw: 0.3 },
      // shell-churned earth thrown out round a crater field: grey-brown, whatever the world
      crater:   { r: 3.2, p: -0.1, d: 0.14, n: 0.05, tint: '#5a5046', tw: 0.78 },
      ruins:    { r: 3.5, p: -0.12, d: 0.18, n: 0.03, tint: '#625b52', tw: 0.3 },
      building: { r: 3, p: -0.14, d: 0.2, n: 0.04, tint: '#645d53', tw: 0.2 },
      bunker:   { r: 3, p: -0.14, d: 0.2, n: 0.02, tint: '#5d5850', tw: 0.2 },
      wall:     { r: 2, p: -0.08, d: 0.12, n: 0 },
      barricade:{ r: 1.6, p: -0.06, d: 0.1, n: -0.02 },
      lava:     { r: 4, p: -0.16, d: 0.08, n: -0.12, tint: '#3b322b', tw: 0.45 },
      crystal:  { r: 3, p: -0.14, d: 0.1, n: -0.08, tint: '#4a3524', tw: 0.4 },
      ravine:   { r: 2.5, p: -0.1, d: -0.04, n: 0.08, tint: '#f2f8fb', tw: 0.35 }
    };
    function groundFit(terrain, seed) {
      var STEP = 0.5, cw = Math.ceil(W / STEP) + 2, ch = Math.ceil(H / STEP) + 2;
      var P = new Float32Array(cw * ch), D = new Float32Array(cw * ch), N = new Float32Array(cw * ch);
      // and a colour the ground is pulled towards, with how hard: TW the weight, TR/TG/TB the colour
      var TW = new Float32Array(cw * ch), TR = new Float32Array(cw * ch), TG = new Float32Array(cw * ch), TB = new Float32Array(cw * ch);
      terrain.forEach(function (r) {
        var f = FIT[r.kind];
        if (!f) return;
        var i0 = Math.max(0, Math.floor((r.x - f.r) / STEP)), i1 = Math.min(cw - 1, Math.ceil((r.x + r.w + f.r) / STEP));
        var j0 = Math.max(0, Math.floor((r.y - f.r) / STEP)), j1 = Math.min(ch - 1, Math.ceil((r.y + r.h + f.r) / STEP));
        for (var j = j0; j <= j1; j++) {
          for (var i = i0; i <= i1; i++) {
            var x = i * STEP, y = j * STEP;
            var out = -depthIn(r, x, y);             // inches outside the piece
            if (out < -0.5 || out > f.r) continue;
            var w = Math.max(0, 1 - Math.max(0, out) / f.r);
            w = w * w * (0.55 + vnoise(x / 2.2, y / 2.2, seed + 610) * 0.9);
            var o = j * cw + i;
            P[o] += f.p * w; D[o] += f.d * w; N[o] += f.n * w;
            if (f.tint) {
              var tc = hex3((r.kind === 'rocks' || r.kind === 'crystal') && ROCKTINT || f.tint), tw2 = Math.min(1, f.tw * (out < 0 ? 1 : Math.max(0, 1 - out / f.r) * (0.7 + vnoise(x / 1.6, y / 1.6, seed + 630) * 0.6)));
              if (tw2 > TW[o]) { TW[o] = tw2; TR[o] = tc[0]; TG[o] = tc[1]; TB[o] = tc[2]; }
            }
            if (f.mud && out < f.mud) {              // a band of mud right at the water's edge
              var m = (1 - Math.max(0, out) / f.mud) * (0.6 + vnoise(x / 1.1, y / 1.1, seed + 620) * 0.8);
              P[o] -= 0.36 * m;
            }
          }
        }
      });
      return function (x, y) {
        var u = Math.max(0, Math.min(cw - 1.001, x / STEP)), v = Math.max(0, Math.min(ch - 1.001, y / STEP));
        var i = u | 0, j = v | 0, fu = u - i, fv = v - j, o = j * cw + i;
        function bil(F) { return (F[o] * (1 - fu) + F[o + 1] * fu) * (1 - fv) + (F[o + cw] * (1 - fu) + F[o + cw + 1] * fu) * fv; }
        var tw3 = bil(TW);
        // the colour is taken from whichever corner pulls hardest, so tints never mix into mud
        var best = o, bw = TW[o];
        [o + 1, o + cw, o + cw + 1].forEach(function (q) { if (TW[q] > bw) { bw = TW[q]; best = q; } });
        return { p: bil(P), d: bil(D), n: bil(N), tw: tw3, tr: TR[best], tg: TG[best], tb: TB[best] };
      };
    }

    /* A hill is the world's own ground raised up: its top, its banks and its lip
       are all drawn from the planet's soil, so a hill on a frost world is grey and
       one in a jungle is dark loam, not the same brown everywhere. */
    var HILLC = null;
    /* What grows on this world, set with its ground as the table is baked: the
       colour of a tuft of grass, and how much of a hilltop carries one. */
    var BLADES = null, HILLTUFT = 0.65;
    /* The rubble under a rock pile is the world's own low ground broken up, not
       one grey for every planet: set with the ground as the table is baked. */
    var ROCKF = null, ROCKTINT = null;
    function floorOf(kind) {
      if (ROCKF && kind === 'rocks') return ROCKF;
      // a crystal field grows out of the same broken ground, with green glinting in it
      if (ROCKF && kind === 'crystal') return { ramp: ROCKF.ramp, fleck: ['#5aff9a', '#9dffc4'].concat(ROCKF.fleck.slice(0, 2)), rim: ROCKF.rim };
      return FLOOR[kind];
    }
    function rockColours(GP) {
      var mud = GP.mud.map(hex3), sand = GP.sand.map(hex3), soil = GP.soil.map(hex3), scree = SCREE.map(hex3);
      function hx(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
      var base = mud.concat([sand[1], sand[2]]).slice(0, 5);
      return {
        floor: {
          ramp: base.map(function (c, i) { return hx(mix3(c, scree[i], 0.3)); }),
          fleck: [hx(sand[3]), hx(mix3(mud[0], [0, 0, 0], 0.4)), hx(soil[4])],
          rim: hx(mix3(mud[0], [0, 0, 0], 0.35))
        },
        tint: hx(mix3(mud[2] || mud[1], scree[3], 0.3))
      };
    }
    function hillColours(GP) {
      var soil = GP.soil.map(hex3), mud = GP.mud.map(hex3), scrub = GP.scrub.map(hex3), sand = GP.sand.map(hex3);
      function hx(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
      function sc(c, k) { return c.map(function (v) { return v * k; }); }
      var top = soil.slice(1).map(function (c, i) { return hx(mix3(c, scrub[Math.min(scrub.length - 1, i)], 0.25)); });
      return {
        floor: { ramp: top, fleck: [hx(scrub[1]), hx(mud[1]), hx(sand[3])], rim: hx(sc(mud[0], 0.9)) },
        lit: [sc(soil[3], 0.95), sc(soil[2], 0.85), sc(soil[1], 0.7)],
        dark: [sc(mud[2] || mud[1], 0.9), sc(mud[1], 0.8), sc(mud[0], 0.65)],
        crestFar: hx(sc(soil[soil.length - 1], 1.1)), crestLit: [hx(soil[4]), hx(soil[3]), hx(soil[1])],
        crestDark: [hx(soil[2]), hx(mud[1]), hx(sc(mud[0], 0.8))],
        gritLit: [hx(soil[1]), hx(soil[3])], gritDark: [hx(sc(mud[0], 0.6)), hx(soil[1])]
      };
    }

    /* `clip`, when given, is the only part of the plate that is wanted — a few
       hundred pixels round a handful of pieces, for a picture of them — and the
       two costly passes, the noise lattice and the soil pixel by pixel, are run
       over that patch alone. Everything else is as it always is. */
    function bakeGround(terrain, seed, planet, clip) {
      var GP = GROUNDS[planet] || GROUNDS.sparse;
      var cx0 = 0, cy0 = 0, cx1 = PIXW, cy1 = PIXH;
      if (clip) {
        cx0 = Math.max(0, Math.floor(clip.x0)); cy0 = Math.max(0, Math.floor(clip.y0));
        cx1 = Math.min(PIXW, Math.ceil(clip.x1)); cy1 = Math.min(PIXH, Math.ceil(clip.y1));
      }
      HILLC = hillColours(GP);
      var RC = rockColours(GP); ROCKF = RC.floor; ROCKTINT = RC.tint;
      BLADES = GP.blade || BLADE;
      HILLTUFT = GP.hillTufts != null ? GP.hillTufts : 0.65;
      var cv = document.createElement('canvas');
      cv.width = PIXW; cv.height = PIXH;
      var g = cv.getContext('2d');
      var img = g.createImageData(PIXW, PIXH), d = img.data;

      /* --- noise on a coarse lattice, read back per pixel --- */
      var LAT = 4;                                   // lattice spacing, buffer px
      var gw = Math.ceil(PIXW / LAT) + 2, gh = Math.ceil(PIXH / LAT) + 2;
      var soilFit = groundFit(terrain, seed);
      var fN = new Float32Array(gw * gh), fP = new Float32Array(gw * gh), fD = new Float32Array(gw * gh);
      var fTW = new Float32Array(gw * gh), fTR = new Float32Array(gw * gh), fTG = new Float32Array(gw * gh), fTB = new Float32Array(gw * gh);
      var gx0 = Math.max(0, Math.floor(cx0 / LAT) - 1), gx1 = Math.min(gw, Math.ceil(cx1 / LAT) + 2);
      var gy0 = Math.max(0, Math.floor(cy0 / LAT) - 1), gy1 = Math.min(gh, Math.ceil(cy1 / LAT) + 2);
      for (var gy = gy0; gy < gy1; gy++) {
        for (var gx = gx0; gx < gx1; gx++) {
          var wq = toWorld(gx * LAT, gy * LAT), o = gy * gw + gx;
          fN[o] = fbm(wq.x / 5.5, wq.y / 5.5, seed, 4) * 0.6 + fbm(wq.x / 1.4, wq.y / 1.4, seed + 300, 2) * 0.4;
          fP[o] = fbm(wq.x / 9, wq.y / 9, seed + 900, 2);
          fD[o] = fbm(wq.x / 13, wq.y / 13, seed + 1500, 2);
          // and the ground answers the terrain laid on it
          var fit = soilFit(wq.x, wq.y);
          fP[o] += fit.p; fD[o] += fit.d; fN[o] += fit.n;
          fTW[o] = fit.tw; fTR[o] = fit.tr; fTG[o] = fit.tg; fTB[o] = fit.tb;
        }
      }
      function lat(f, x, y) {                        // bilinear read at a buffer pixel
        var u = x / LAT, v = y / LAT;
        var i0 = u | 0, j0 = v | 0, fu = u - i0, fv = v - j0;
        var a0 = j0 * gw + i0;
        var p00 = f[a0], p10 = f[a0 + 1], p01 = f[a0 + gw], p11 = f[a0 + gw + 1];
        return (p00 * (1 - fu) + p10 * fu) * (1 - fv) + (p01 * (1 - fu) + p11 * fu) * fv;
      }

      var soil = GP.soil.map(hex3), scrub = GP.scrub.map(hex3), sand = GP.sand.map(hex3), mud = GP.mud.map(hex3);
      var INV_K = 1 / K, INV_HK = 2 / K;

      /* --- soil, one pixel at a time --- */
      for (var by = cy0; by < cy1; by++) {
        var v0 = (by - OY) * INV_HK;
        var wx = ((cx0 - OX) * INV_K + v0) / 2, wy = (v0 - (cx0 - OX) * INV_K) / 2;
        var dx = INV_K / 2, dy = -INV_K / 2;
        var row = by * PIXW * 4, br = (by & 3);
        for (var bx = cx0; bx < cx1; bx++, wx += dx, wy += dy) {
          if (wx < 0 || wy < 0 || wx > W || wy > H) continue;
          var n = lat(fN, bx, by), patch = lat(fP, bx, by), dry = lat(fD, bx, by);
          // feather the boundaries between materials so they break up rather than
          // drawing a clean line across the table
          var pj = (BAYER[br][bx & 3] / 16 - 0.5) * 0.06 + (hash(bx, by, 19) - 0.5) * 0.03;
          var ramp = (patch + pj) > 0.645 ? scrub : (dry + pj) > 0.665 ? sand
            : (patch + pj) < 0.315 ? mud : soil;
          var t = clamp01((n - 0.22) / 0.52) * (ramp.length - 1);
          var lo = t | 0, idx = lo + ((t - lo) > BAYER[br][bx & 3] / 16 ? 1 : 0);
          var grain = hash(bx, by, 5);               // a pixel of grit on top of the dither
          if (grain > 0.95) idx++; else if (grain < 0.05) idx--;
          if (idx >= ramp.length) idx = ramp.length - 1;
          if (idx < 0) idx = 0;
          var c = ramp[idx], o2 = row + bx * 4;
          var tw4 = lat(fTW, bx, by);
          if (tw4 > 0.02) {
            // pulled towards the colour of what stands nearby, dithered so it breaks up at the edge
            var tk = Math.min(1, tw4 + (BAYER[br][bx & 3] / 16 - 0.5) * 0.25);
            var nq = Math.round(by / LAT) * gw + Math.round(bx / LAT);
            var tr = fTR[nq], tg = fTG[nq], tb = fTB[nq];
            if (tk > 0 && tr + tg + tb > 0) {
              var li = Math.min(1.35, Math.max(0.65, (c[0] + c[1] + c[2]) / 3 / 95));   // keep the soil's own light and dark
              c = [c[0] + (tr * li - c[0]) * tk, c[1] + (tg * li - c[1]) * tk, c[2] + (tb * li - c[2]) * tk];
            }
          }
          d[o2] = c[0]; d[o2 + 1] = c[1]; d[o2 + 2] = c[2]; d[o2 + 3] = 255;
        }
      }

      /* --- every terrain rectangle, painted as the rectangle it is --- */
      terrain.forEach(function (r, ri) {
        if (r.kind === 'hill') return;               // the plateau is painted after the slopes
        if (FLOOR[r.kind]) paintFloor(d, r, floorOf(r.kind), seed + ri * 131, lat, fN, fD);
      });

      g.putImageData(img, 0, 0);
      // lava lies at the bottom of cracks: the rock walls go in over the melt
      terrain.forEach(function (r, ri) { if (r.kind === 'lava' || r.kind === 'ravine') lavaWalls(g, r, seed + ri * 131, r.kind); });

      // the board itself: a slab with a lit top edge and a shadowed lip
      var n0 = toScreen(0, 0), nE = toScreen(W, 0), nS = toScreen(W, H), nWt = toScreen(0, H);
      poly(g, [[nWt.x, nWt.y], [nS.x, nS.y], [nS.x, nS.y + LIP], [nWt.x, nWt.y + LIP]], '#221b13');
      // (the far edges are hidden behind the table's own surface, so only the two near faces are drawn)
      poly(g, [[nE.x, nE.y], [nS.x, nS.y], [nS.x, nS.y + LIP], [nE.x, nE.y + LIP]], '#181309');

      var rand = rng(seed + 11);

      // which rectangle owns a point, so scatter and tracks keep off the wet and the woods
      function busy(x, y) {
        for (var i = 0; i < terrain.length; i++) {
          var r = terrain[i];
          if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && (!r.poly || depthIn(r, x, y) >= 0)) return true;
        }
        return false;
      }

      // tracks worn across the open ground
      for (var t2 = 0; t2 < 7; t2++) {
        var x = rand() * W, y = rand() * H, ang = rand() * Math.PI * 2;
        for (var s2 = 0; s2 < 40 + rand() * 60; s2++) {
          ang += (rand() - 0.5) * 0.3;
          x += Math.cos(ang) * 0.5; y += Math.sin(ang) * 0.5;
          if (x < 0 || y < 0 || x > W || y > H) break;
          if (busy(x, y)) continue;
          var p = toScreen(x, y);
          dot(g, p.x, p.y, rand() > 0.5 ? GP.track[0] : GP.track[1], 1);
          dot(g, p.x + a(2), p.y + a(1), GP.track[0], 1);
        }
      }

      // hills: the rectangle, extruded, so the plateau is exactly the ground that counts
      var hills = terrain.filter(function (r) { return r.kind === 'hill'; });
      hills.forEach(function (r) { hillSlopes(g, r, seed); });
      if (hills.length) {
        var top = g.getImageData(0, 0, PIXW, PIXH), td = top.data;
        hills.forEach(function (r, ri) {
          paintFloor(td, r, HILLC.floor, seed + ri * 419, lat, fN, fD, ELEV);
        });
        // a wood (or rubble, or a ruin) standing on a hill lies on the plateau, not under it
        function onAHill(x, y) {
          for (var hq = 0; hq < hills.length; hq++) if (depthIn(hills[hq], x, y) > 0) return true;
          return false;
        }
        terrain.forEach(function (r, ri) {
          if (r.onHill && FLOOR[r.kind] && r.kind !== 'building' && r.kind !== 'bunker') paintFloor(td, r, floorOf(r.kind), seed + ri * 131, lat, fN, fD, ELEV, onAHill);
        });
        g.putImageData(top, 0, 0);
        hills.forEach(function (r) { hillCrest(g, r, seed); });
        // the upper step of a two-step hill, raised again off the first
        var steps = hills.filter(function (r) { return r.top; }).map(function (r) { return upperStep(r); });
        steps.forEach(function (u2) { hillSlopes(g, u2, seed + 7, ELEV); });
        if (steps.length) {
          var top2 = g.getImageData(0, 0, PIXW, PIXH), td2 = top2.data;
          steps.forEach(function (u2, ri) { paintFloor(td2, u2, HILLC.floor, seed + ri * 431 + 9, lat, fN, fD, ELEV * 2); });
          g.putImageData(top2, 0, 0);
          steps.forEach(function (u2) { hillCrest(g, u2, seed + 7, ELEV); });
        }
      }

      // craters pitting the churned ground
      terrain.filter(function (r) { return r.kind === 'crater'; }).forEach(function (r) {
        var cr = rng(seed + Math.round(r.x * 17 + r.y * 7));
        /* scorch where the shells burst, then craters of every size: one or two
           big ones, a scatter of small, each kept inside the field's outline */
        for (var sc2 = 0; sc2 < Math.round(r.w * r.h / 10); sc2++) {
          var ss = spotIn(r, 0.8, cr), sp4 = toScreen(ss.x, ss.y);
          for (var sd2 = 0; sd2 < 60; sd2++) {
            var sa = cr() * Math.PI * 2, sdd = Math.sqrt(cr()) * K * (0.6 + cr() * 0.6);
            dot(g, sp4.x + Math.cos(sa) * sdd * 1.4, sp4.y + Math.sin(sa) * sdd * 0.7, cr() > 0.5 ? 'rgba(18,14,10,.55)' : 'rgba(34,27,19,.45)', 1);
          }
        }
        var n2 = Math.max(3, Math.round(r.w * r.h / 9));
        var bowls = [];
        for (var c = 0; c < n2; c++) {
          var big = c < 1 + (r.w * r.h > 50 ? 1 : 0);
          var rad = big ? 1.6 + cr() * 1.2 : 0.5 + cr() * 0.9;
          var cs = spotIn(r, Math.min(rad * 0.95, Math.min(r.w, r.h) / 2 - 0.2), cr);
          bowls.push({ x: cs.x, y: cs.y, rad: rad });
        }
        // far ones first, so a nearer bowl's lip overlaps the one behind it
        bowls.sort(function (b1, b2) { return (b1.x + b1.y) - (b2.x + b2.y); }).forEach(function (bw) {
          var p = toScreen(bw.x, bw.y);
          bowl(g, p.x, p.y, bw.rad * K, cr);
        });
      });

      // scatter: tufts of grass and stones over open ground only
      for (var s3 = 0; s3 < 3400; s3++) {
        var gx2 = rand() * W, gy2 = rand() * H;
        if (busy(gx2, gy2)) continue;
        var p2 = toScreen(gx2, gy2), roll = rand();
        // how much of the scatter is grass depends on the world; the rest is stone
        if (roll > (GP.tufts > 1 ? 0.42 - (GP.tufts - 1) * 0.35 : 0.42) && rand() < GP.tufts) tuft(g, p2.x, p2.y, rand);
        else if (roll > 0.12) pebble(g, p2.x, p2.y, 1 + (rand() * 2.4 | 0), rand);
        else dot(g, p2.x, p2.y, rand() > 0.5 ? GP.track[0] : GP.track[1], 1);
      }
      return cv;
    }

    /* A shell crater, shaded as a bowl: lit on the far (south-east) inner wall,
       in shadow under the north-west lip, a raised ring of thrown earth around it
       catching the sun, and spoil flung outward. */
    var BOWL = ['#16110c', '#211a13', '#2c2319', '#3a2f22', '#4c3e2c', '#63523b', '#7d6a4d', '#978260'];
    var BOWLC = BOWL.map(hex3);
    function bowl(g, cx, cy, R, rnd) {
      var rx = R * 1.3, ry = rx / 2;
      var x0 = Math.max(0, Math.floor(cx - rx - 2)), y0 = Math.max(0, Math.floor(cy - ry - 2));
      var x1 = Math.min(PIXW, Math.ceil(cx + rx + 2)), y1 = Math.min(PIXH, Math.ceil(cy + ry + 2));
      if (x1 <= x0 || y1 <= y0) return;
      var im = g.getImageData(x0, y0, x1 - x0, y1 - y0), d = im.data, iw = x1 - x0;
      var seed = (rnd() * 9999) | 0;
      for (var y = y0; y < y1; y++) {
        for (var x = x0; x < x1; x++) {
          var u = (x - cx) / rx, v = (y - cy) / ry;
          var r = Math.sqrt(u * u + v * v) + (vnoise(x / 7, y / 4, seed) - 0.5) * 0.12;
          if (r > 1) continue;
          var o = ((y - y0) * iw + (x - x0)) * 4;
          var br = BAYER[y & 3][x & 3] / 16;
          var lvl;
          if (r > 0.8) {                                   // the thrown-up ring
            var up = 1 - Math.abs(r - 0.88) / 0.1;
            var faceLit = (-u - v) * 0.5 + 0.5;            // outer slope toward the light
            lvl = 3 + up * 2 + faceLit * 1.6;
            if (r > 0.95) {                                 // blend into the ground under it
              var k = (1 - r) / 0.05, gc = [d[o], d[o + 1], d[o + 2]];
              var cc = BOWLC[Math.min(7, Math.max(0, Math.round(lvl)))];
              put(d, o, mix3(gc, cc, k * 0.8));
              continue;
            }
          } else {
            // inner wall: the side facing the light (south-east) is lit
            var rr = r / 0.8, lit = (u + v) * 0.5;
            lvl = 1.2 + rr * 1.2 + lit * rr * 3.2 + (1 - rr) * 0.4;
            if (rr < 0.35) lvl = 0.6 + rr * 1.5;         // the floor, deep and dark
          }
          var t = Math.max(0, Math.min(7, lvl)), lo = t | 0;
          var idx = Math.min(7, lo + ((t - lo) > br ? 1 : 0));
          if (hash(x, y, seed) > 0.97) idx = Math.max(0, idx - 2);
          put(d, o, BOWLC[idx]);
        }
      }
      g.putImageData(im, x0, y0);
      for (var e = 0; e < 18; e++) {                     // spoil flung out past the ring
        var ea = rnd() * Math.PI * 2, ed = 1.05 + rnd() * 0.6;
        pebble(g, cx + Math.cos(ea) * rx * ed, cy + Math.sin(ea) * ry * ed, 1 + (rnd() * 2 | 0), rnd);
      }
    }

    // a clump of grass: a few blades, lit on the left, darker at the root
    var BLADE = ['#3d4526', '#4d5730', '#5f6a3c', '#71804a', '#86955a'];
    function tuft(g, x, y, rnd) {
      var BL = BLADES || BLADE;              // the world's own grass: green, straw or frosted
      x = Math.round(x); y = Math.round(y);
      var n = 3 + (rnd() * 4 | 0);
      g.fillStyle = 'rgba(20,15,9,.35)';
      g.fillRect(x - 2, y, 6, 1);
      for (var i = 0; i < n; i++) {
        var bx = x - 2 + (rnd() * 5 | 0), h = 2 + (rnd() * 5 | 0), lean = rnd() > 0.5 ? 1 : -1;
        for (var k = 0; k < h; k++) {
          var c = BL[Math.min(4, 1 + ((k / h) * 3.2 | 0) + (bx < x ? 1 : 0))];
          g.fillStyle = k === 0 ? BL[0] : c;
          g.fillRect(bx + (k > h * 0.6 ? lean : 0), y - k, 1, 1);
        }
      }
    }

    // a stone lying on the ground: shadow to the south-east, lit top to the north-west
    function pebble(g, x, y, sz, rnd) {
      x = Math.round(x); y = Math.round(y);
      var w = sz + 1, h = Math.max(1, Math.round(sz * 0.7));
      g.fillStyle = 'rgba(18,13,8,.45)'; g.fillRect(x + 1, y + 1, w, h);
      g.fillStyle = STONE[1 + (rnd() * 2 | 0)]; g.fillRect(x, y, w, h);
      g.fillStyle = STONE[4]; g.fillRect(x, y, Math.max(1, w - 1), 1);
      if (sz > 1) { g.fillStyle = STONE[5]; g.fillRect(x, y, 1, 1); }
    }

    /* fill one terrain rectangle, pixel by pixel, with a hand's width of wobble
       on the boundary so it reads as ground rather than as a drawn shape */
    /* How deep inside a piece a world point sits: the rules' own measure, so the
       floor, the trees and the rocks go down exactly where the piece counts. */
    function depthIn(r, x, y) {
      var RR = root.PMC;
      if ((r.poly || r.parts) && RR && RR.pieceDepth) return RR.pieceDepth(r, x, y);
      return Math.min(x - r.x, r.x + r.w - x, y - r.y, r.y + r.h - y);
    }
    // a random point at least `margin` inside a piece, easing the margin on a small one
    function spotIn(r, margin, rand) {
      for (var m = margin; m >= 0; m -= Math.max(0.2, margin / 3)) {
        for (var t = 0; t < 14; t++) {
          var x = r.x + rand() * r.w, y = r.y + rand() * r.h;
          if (depthIn(r, x, y) >= m) return { x: x, y: y };
        }
      }
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }

    // `mask(x, y)`: paint only where it says yes — a wood's floor on the part of it that is up on a hill
    function paintFloor(d, r, spec, seed, lat, fN, fD, lift, mask) {
      lift = lift || 0;
      var ramp = spec.ramp.map(hex3), rim = hex3(spec.rim);
      var fleck = spec.fleck.map(hex3);
      var hi = ramp[ramp.length - 1];
      var c1 = toScreen(r.x, r.y), c2 = toScreen(r.x + r.w, r.y);
      var c3 = toScreen(r.x + r.w, r.y + r.h), c4 = toScreen(r.x, r.y + r.h);
      var pad = spec.hot ? Math.ceil(K * 0.9) : 3;     // lava scorches the ground round it
      var x0 = Math.max(0, Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x)) - pad);
      var x1 = Math.min(PIXW - 1, Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x)) + pad);
      var y0 = Math.max(0, Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y)) - pad - lift);
      var y1 = Math.min(PIXH - 1, Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y)) + pad - lift);
      var INV_K = 1 / K, INV_HK = 2 / K;
      var WOB = lift && !mask ? 0 : 0.09;            // how far the edge may wander, inches (a hill's own edge is crisp; a wood on it is not)

      for (var by = y0; by <= y1; by++) {
        var v0 = (by + lift - OY) * INV_HK;
        var wx = ((x0 - OX) * INV_K + v0) / 2, wy = (v0 - (x0 - OX) * INV_K) / 2;
        var dx = INV_K / 2, dy = -INV_K / 2;
        var row = by * PIXW * 4, br = by & 3;
        for (var bx = x0; bx <= x1; bx++, wx += dx, wy += dy) {
          if (wx < 0 || wy < 0 || wx > W || wy > H) continue;
          if (mask && !mask(wx, wy)) continue;
          // distance inside the piece — its outline, or its rectangle — in inches
          var din = (r.poly || r.parts) ? (wx < r.x - 1 || wy < r.y - 1 || wx > r.x + r.w + 1 || wy > r.y + r.h + 1 ? -9 : depthIn(r, wx, wy))
            : Math.min(wx - r.x, r.x + r.w - wx, wy - r.y, r.y + r.h - wy);
          if (spec.hot && din < -WOB && din > -0.5) {
            /* scorched ground beyond the flow: not lava, and no part of the rule —
               just earth baked dark, thinning out with distance */
            var sc = (1 + din / 0.5) * 0.5 - BAYER[by & 3][bx & 3] / 32;
            if (hash(bx, by, 311) < sc) {
              var o2 = by * PIXW * 4 + bx * 4;
              d[o2] = d[o2] * 0.45 + 20; d[o2 + 1] = d[o2 + 1] * 0.4 + 12; d[o2 + 2] = d[o2 + 2] * 0.4 + 8;
            }
            continue;
          }
          if (din < -WOB) continue;
          if (WOB && din < WOB) {                    // only the boundary pays for noise
            if (din + (vnoise(wx * 6.5, wy * 6.5, seed) - 0.5) * 2 * WOB < 0) continue;
          }
          var n = lat(fN, bx, by + lift), dry = lat(fD, bx, by + lift);
          if (spec.wet) { liquid(d, row + bx * 4, bx, by, wx, wy, din, n, spec, ramp, rim, seed); continue; }
          if (spec.hot) { molten(d, row + bx * 4, bx, by, wx, wy, din, n, ramp, rim, seed); continue; }
          var t = clamp01((n * 0.8 + dry * 0.2 - 0.24) / 0.46) * (ramp.length - 1);
          var lo = t | 0, idx = lo + ((t - lo) > BAYER[br][bx & 3] / 16 ? 1 : 0);
          var grain = hash(bx, by, 5);
          if (grain > 0.90) idx++; else if (grain < 0.10) idx--;
          if (idx >= ramp.length) idx = ramp.length - 1;
          if (idx < 0) idx = 0;
          var c = ramp[idx];
          var j = hash(bx, by, seed & 1023);
          if (din < 0.08) c = rim;                   // a darker lip marks the exact edge
          else if (j > 0.955) c = fleck[(j * 977) % fleck.length | 0];
          var o = row + bx * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
    }

    function put(d, o, c) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    function mix3(A, B, t) { return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; }

    /* Water: shallow and pale at the bank, dark in the middle, with a band of wet
       mud and a broken line of scum at the edge, and long flat ripples catching
       the light rather than a sparkle on every pixel. */
    var MUDC = hex3('#2a2419'), SCUM = hex3('#8fb6a8');
    var SANDW = hex3('#6d6248'), SHOREP = hex3('#8e8672'), DROCK = [hex3('#15191b'), hex3('#262c2e')];
    function liquid(d, o, bx, by, wx, wy, din, n, spec, ramp, rim, seed) {
      var deep = spec.ramp === DEEPW;
      var br = BAYER[by & 3][bx & 3] / 16;
      if (din < 0.07) { put(d, o, mix3(MUDC, rim, 0.4)); return; }
      var j = hash(bx, by, seed & 1023);
      /* the bank: a shallow pool shelves in over sand and pebbles you can see
         through the water; deep water drops off a dark, wet lip of rock */
      var bank = vnoise(wx * 3.1, wy * 3.1, seed + 41);
      if (!deep && din < 0.16 + bank * 0.18) {
        var sh = clamp01((din - 0.07) / 0.3);
        var sand = j > 0.86 ? SHOREP : j > 0.8 ? MUDC : SANDW;
        put(d, o, mix3(sand, ramp[ramp.length - 2], sh * 0.75 + (br - 0.5) * 0.15));
        return;
      }
      if (deep && din < 0.12 + bank * 0.1) { put(d, o, j > 0.7 ? DROCK[1] : DROCK[0]); return; }
      if (din < 0.13 && !deep) { put(d, o, j > 0.55 ? SCUM : ramp[ramp.length - 2]); return; }
      var depth = clamp01((din - 0.1) / (deep ? 1.1 : 1.8));
      var tone = (1 - depth) * 0.72 + 0.12 + (n - 0.5) * 0.3;
      var t = clamp01(tone) * (ramp.length - 2);
      var lo = t | 0, idx = lo + ((t - lo) > br ? 1 : 0);
      var c = ramp[Math.min(ramp.length - 2, idx)];
      // ripples: long streaks across the screen, a crest and the trough behind it
      var rp = vnoise(bx / 26, by / 2.6, seed + 71) * 0.7 + vnoise(bx / 9, by / 1.6, seed + 72) * 0.3;
      var cut = deep ? 0.8 : 0.74;
      if (rp > cut + 0.06) c = ramp[ramp.length - 1];
      else if (rp > cut) c = ramp[Math.min(ramp.length - 1, idx + 1)];
      else if (rp < 0.2) c = ramp[Math.max(0, idx - 1)];
      if (j > 0.9975 && depth > 0.15) c = [230, 244, 246];
      put(d, o, c);
    }

    /* Lava: plates of black crust split by glowing seams, hottest down the middle
       of each crack, with the odd pool still liquid. */
    var HOT = GLOW.map(hex3), WHITEHOT = hex3('#fff1b8'), CRUSTC = [hex3('#2a1a12'), hex3('#4a2412')];
    /* Lava, seen down a crack in the ground: the melt at the bottom, orange and
       moving, with brighter threads where it runs fastest and dark skins of crust
       drifting on it. The rock walls of the crack are drawn over this afterwards
       (lavaWalls), so only the floor between them shows. */
    function molten(d, o, bx, by, wx, wy, din, n, ramp, rim, seed) {
      var br = BAYER[by & 3][bx & 3] / 16;
      // hottest in the middle of the crack, dimming towards the walls
      var heat = clamp01(din / 1.1) * 0.75 + vnoise(wx * 0.8, wy * 0.8, seed + 3) * 0.35;
      // long, slow flow lines along the melt, a little brighter
      var fl = vnoise(wx * 0.7 + wy * 0.3, wy * 2.8 - wx * 1.1, seed + 4);
      if (fl > 0.62) heat += (fl - 0.62) * 0.9;
      var skin = vnoise(wx * 3.2, wy * 3.2, seed + 9);
      var t = heat + (br - 0.5) * 0.1;
      var c = t > 1.02 ? WHITEHOT : t > 0.8 ? HOT[3] : t > 0.52 ? HOT[2] : t > 0.28 ? HOT[1] : HOT[0];
      if (skin > 0.8 && heat < 0.7) c = CRUSTC[1];      // the odd skin of crust drifting on it
      put(d, o, c);
    }

    /* The crack itself. The ground has split and dropped away: the far walls of
       the hole face the viewer and are drawn as broken rock faces falling to the
       melt, dark at the top and lit orange from below; the near walls are hidden
       behind their own rim. Out from the points of the break, hairline cracks run
       on across the surrounding ground. All of it is inside the piece except the
       hairlines, which are only paint. */
    /* The same broken-crust hole serves an arctic world's ice ravine: its walls
       are pale ice going down to blue dark rather than rock lit orange by melt. */
    var WALLS = {
      lava: { top: ['#6f6860', '#4f4943'], mid: ['#3d3833', '#2b2724'], deep: ['#2a1d16', '#b4521c', '#f08a22'], bevel: ['#8a8279', '#6a635c'],
        foot: '#f08a22', rimFar: '#6e645a', rimNear: ['#15110e', '#5a5047'], crack: '#120e0c', crackGlow: 'rgba(240,120,40,.55)', crackLit: 'rgba(150,138,122,.25)', frac: 'rgba(120,108,96,.35)' },
      ravine: { top: ['#eef6fb', '#cfe0ea'], mid: ['#9fc0d6', '#7fa3bd'], deep: ['#3f6a8a', '#16304a', '#08121c'], bevel: ['#ffffff', '#dce9f1'],
        foot: '#0c1a28', rimFar: '#f4fbff', rimNear: ['#5c7f98', '#e8f2f8'], crack: '#5f86a3', crackGlow: 'rgba(200,230,250,.6)', crackLit: 'rgba(255,255,255,.45)', frac: 'rgba(255,255,255,.4)' }
    };
    function lavaWalls(g, r, seed, kind) {
      var WP = WALLS[kind || 'lava'];
      var lr = rng(seed + Math.round(r.x * 41 + r.y * 13));
      var edges = hillOutline(r);
      var DEPTH = K * 1.7;
      var rim = edges.map(function (e) { return sp2(e.A[0], e.A[1]); });
      g.save();
      g.beginPath();
      g.moveTo(rim[0][0], rim[0][1]);
      for (var i = 1; i < rim.length; i++) g.lineTo(rim[i][0], rim[i][1]);
      g.closePath();
      g.clip();
      // each far wall, from the back of the hole forward
      var far = edges.map(function (e, i) { return { e: e, i: i, dep: DEPTH * (0.75 + lr() * 0.5) }; })
        .filter(function (q) { return q.e.nx + q.e.ny < 0.05; })
        .sort(function (p1, p2) { return (p1.e.mx + p1.e.my) - (p2.e.mx + p2.e.my); });
      far.forEach(function (q, k) {
        var e = q.e, A = sp2(e.A[0], e.A[1]), B = sp2(e.B[0], e.B[1]);
        // a neighbouring wall's depth at the shared corner, so the faces meet
        var dA = q.dep, dB = (far[k + 1] && far[k + 1].i === (q.i + 1) % edges.length) ? far[k + 1].dep : q.dep * (0.85 + lr() * 0.3);
        var lit = Math.max(0, Math.min(1, (e.nx - e.ny + 1) / 2));   // which way the face is turned
        var top = lit > 0.5 ? WP.top[0] : WP.top[1], mid = lit > 0.5 ? WP.mid[0] : WP.mid[1];
        poly(g, [A, B, [B[0], B[1] + dB], [A[0], A[1] + dA]],
          vgrad(g, Math.min(A[1], B[1]), Math.max(A[1] + dA, B[1] + dB), [top, mid].concat(WP.deep)));
        // the broken slab's upper edge: a bevel of the ground's own crust catching the light
        poly(g, [A, B, [B[0], B[1] + 3], [A[0], A[1] + 3]], lit > 0.5 ? WP.bevel[0] : WP.bevel[1]);
        // blocky breaks: a step down part-way along the face
        if (lr() > 0.4) {
          var st = 0.3 + lr() * 0.4, sx0 = A[0] + (B[0] - A[0]) * st, sy0 = A[1] + (B[1] - A[1]) * st;
          var sdep = (dA + (dB - dA) * st) * (0.35 + lr() * 0.25);
          edgeLine(g, [sx0, sy0], [sx0, sy0 + sdep], 'rgba(20,16,14,.8)', 2);
          edgeLine(g, [sx0 + 2, sy0 + sdep], [B[0], B[1] + sdep * 0.9], 'rgba(140,130,118,.5)', 1);
        }
        // the break is not a smooth face: vertical facets and fractures down it
        var span = Math.hypot(B[0] - A[0], B[1] - A[1]);
        for (var f = 0; f < span / 7; f++) {
          var t = lr(), fx = A[0] + (B[0] - A[0]) * t, fy = A[1] + (B[1] - A[1]) * t, fd = dA + (dB - dA) * t;
          edgeLine(g, [fx, fy + 1], [fx + (lr() - 0.5) * 3, fy + fd * (0.5 + lr() * 0.45)], 'rgba(10,8,7,.55)', 1);
          if (lr() > 0.5) edgeLine(g, [fx + 1, fy + 2], [fx + 1, fy + fd * 0.35], WP.frac, 1);
        }
        // the glow of the melt climbing the foot of the wall (or the ravine's dark)
        edgeLine(g, [A[0], A[1] + dA - 1], [B[0], B[1] + dB - 1], WP.foot, 1);
      });
      g.restore();
      // the rim: a hard lit edge on the far side of the hole, a dark lip on the near
      edges.forEach(function (e) {
        var A = sp2(e.A[0], e.A[1]), B = sp2(e.B[0], e.B[1]);
        if (e.nx + e.ny < 0.05) edgeLine(g, A, B, WP.rimFar, 1);
        else { edgeLine(g, A, B, WP.rimNear[0], 2); edgeLine(g, [A[0], A[1] - 1], [B[0], B[1] - 1], WP.rimNear[1], 1); }
      });
      // hairline cracks running on from the points of the break
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      edges.forEach(function (e) {
        var P = e.A, dx = P[0] - cx, dy = P[1] - cy, dl = Math.hypot(dx, dy) || 1;
        var reach = dl / Math.max(r.w, r.h) * 2;
        if (reach < 0.62 || lr() > 0.7) return;              // only from the splinters
        crackLine(P[0], P[1], dx / dl, dy / dl, 0.8 + lr() * 1.6, 2, true);
      });
      function crackLine(x, y, ux, uy, len, width, hot) {
        var steps = 4 + (lr() * 3 | 0), seg = len / steps, pts = [sp2(x, y)];
        for (var s = 0; s < steps; s++) {
          var ang = Math.atan2(uy, ux) + (lr() - 0.5) * 1.1;
          ux = Math.cos(ang); uy = Math.sin(ang);
          x += ux * seg; y += uy * seg;
          if (x < 0.2 || y < 0.2 || x > W - 0.2 || y > H - 0.2) break;
          pts.push(sp2(x, y));
          if (lr() < 0.22 && len > 0.8) crackLine(x, y, Math.cos(ang + (lr() < 0.5 ? 0.8 : -0.8)), Math.sin(ang + (lr() < 0.5 ? 0.8 : -0.8)), len * 0.4, 1, false);
        }
        for (var k = 1; k < pts.length; k++) {
          var w2 = Math.max(1, Math.round(width * (1 - k / pts.length)));
          edgeLine(g, pts[k - 1], pts[k], WP.crack, w2);
          if (hot && k === 1) edgeLine(g, pts[k - 1], pts[k], WP.crackGlow, 1);
          else edgeLine(g, [pts[k - 1][0], pts[k - 1][1] + 1], [pts[k][0], pts[k][1] + 1], WP.crackLit, 1);
        }
      }
    }


    // a vertical gradient between two screen heights
    function vgrad(g, y0, y1, stops) {
      var gr = g.createLinearGradient(0, y0, 0, y1);
      for (var i = 0; i < stops.length; i++) gr.addColorStop(i / (stops.length - 1), stops[i]);
      return gr;
    }

    // the upper step of a two-step hill, as a piece of its own for drawing
    function upperStep(r) {
      var xs = r.top.map(function (q) { return q[0]; }), ys = r.top.map(function (q) { return q[1]; });
      var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
      return { kind: 'hill', poly: r.top, x: x0, y: y0, w: Math.max.apply(null, xs) - x0, h: Math.max.apply(null, ys) - y0 };
    }
    function R0() { return !!(root.PMC && root.PMC.inPoly); }
    /* A hill's outline, wound so that each edge's outward side is known: its own
       irregular shape when it has one, its rectangle when it does not. */
    function hillOutline(r) {
      var pts = r.poly || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
      var cx = 0, cy = 0;
      pts.forEach(function (q) { cx += q[0]; cy += q[1]; });
      cx /= pts.length; cy /= pts.length;
      return pts.map(function (A, i) {
        var B = pts[(i + 1) % pts.length];
        var nx = B[1] - A[1], ny = -(B[0] - A[0]), l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
        return { A: A, B: B, nx: nx, ny: ny, mx: mx, my: my };
      });
    }
    function sp2(x, y, up) { var q = toScreen(x, y); return [q.x, q.y - (up || 0)]; }

    /* The faces of a hill the viewer sees — every stretch of its edge that faces
       south or east — as banks of earth: shaded from a lit crest down into the
       dark at the foot, laid in strata, with stones standing out of them and scree
       gathered at the bottom. A bank facing south catches the light; one facing
       east is in shade; anything between is between. */
    function hillSlopes(g, r, seed, z0) {
      z0 = z0 || 0;
      var hr = rng(seed + Math.round(r.x * 31 + r.y * 7) + z0);
      var edges = hillOutline(r);
      var foot = edges.map(function (e) { return sp2(e.A[0], e.A[1], z0); });
      // a soft shadow thrown to the south-east
      for (var sh = 0; sh < (z0 ? 2 : 4); sh++) {
        var o = 3 + sh * 3;
        poly(g, foot.map(function (q) { return [q[0] + o, q[1] + o * 0.6]; }), 'rgba(16,12,8,.13)');
      }
      var HC = HILLC || hillColours(GROUNDS.sparse);
      var DARK = HC.dark, LIT = HC.lit;
      function col(t, k) {
        var A = DARK[k], B = LIT[k];
        return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
      }
      var seen = edges.filter(function (e) { return e.nx + e.ny > 0.02; })
        .sort(function (e1, e2) { return (e1.mx + e1.my) - (e2.mx + e2.my); });
      seen.forEach(function (e) {
        var lit = Math.max(0, Math.min(1, (e.ny - e.nx + 1) / 2));
        var A = sp2(e.A[0], e.A[1], z0), B = sp2(e.B[0], e.B[1], z0);
        var AT = sp2(e.A[0], e.A[1], z0 + ELEV), BT = sp2(e.B[0], e.B[1], z0 + ELEV);
        var yTop = Math.min(AT[1], BT[1]), yBot = Math.max(A[1], B[1]);
        poly(g, [A, B, BT, AT], vgrad(g, yTop, yBot, [col(lit, 0), col(lit, 1), col(lit, 2)]));
        face(A, B, lit > 0.5);
      });
      function face(A, B, lit) {
        var len = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (len < 1) return;
        // strata: wavering bands across the face
        for (var k = 1; k <= 3; k++) {
          var base = ELEV * k / 4, sd = (hr() * 999) | 0;
          for (var i = 0; i <= len; i++) {
            var f = i / len, wob = (vnoise((A[0] + (B[0] - A[0]) * f) / 14, k, sd) - 0.5) * 6;
            var x = A[0] + (B[0] - A[0]) * f, y = A[1] + (B[1] - A[1]) * f - base + wob;
            g.fillStyle = lit ? (k & 1 ? 'rgba(32,24,14,.35)' : 'rgba(150,130,96,.25)') : 'rgba(10,8,5,.35)';
            g.fillRect(Math.round(x), Math.round(y), 1, 1);
          }
        }
        // stones set in the bank
        for (var m = 0; m < len / 9; m++) {
          var f2 = hr(), up = 3 + hr() * (ELEV - 8);
          var sx = Math.round(A[0] + (B[0] - A[0]) * f2), sy = Math.round(A[1] + (B[1] - A[1]) * f2 - up);
          var sw = 2 + (hr() * 3 | 0), shh = 1 + (hr() * 2 | 0);
          rect(g, sx, sy, sw, shh, lit ? STONE[2] : STONE[1]);
          rect(g, sx, sy, sw - 1, 1, lit ? STONE[4] : STONE[2]);
          rect(g, sx, sy + shh, sw, 1, 'rgba(10,8,5,.5)');
        }
        // grit
        for (var q = 0; q < len * 2.2; q++) {
          var f3 = hr(), up3 = hr() * ELEV;
          dot(g, A[0] + (B[0] - A[0]) * f3, A[1] + (B[1] - A[1]) * f3 - up3,
            lit ? HC.gritLit[hr() > 0.5 ? 0 : 1] : HC.gritDark[hr() > 0.5 ? 0 : 1], 1);
        }
        // scree at the foot
        for (var n = 0; n < len / 5; n++) {
          var f4 = hr();
          pebble(g, A[0] + (B[0] - A[0]) * f4 + (hr() - 0.3) * 6, A[1] + (B[1] - A[1]) * f4 - 1 + hr() * 5,
            1 + (hr() * 2 | 0), hr);
        }
      }
    }

    function hillCrest(g, r, seed, z0) {
      z0 = z0 || 0;
      var hr = rng(seed + Math.round(r.x * 13 + r.y * 29) + z0);
      function line(A, B, col, dy) {
        var steps = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1])));
        g.fillStyle = col;
        for (var i = 0; i <= steps; i++) {
          var f = i / steps;
          g.fillRect(Math.round(A[0] + (B[0] - A[0]) * f), Math.round(A[1] + (B[1] - A[1]) * f) + (dy || 0), 1, 1);
        }
      }
      // the far crests catch the light; the near ones are rounded over, a lit
      // lip with turf hanging down the bank beneath it
      hillOutline(r).forEach(function (e) {
        var AT = sp2(e.A[0], e.A[1], z0 + ELEV), BT = sp2(e.B[0], e.B[1], z0 + ELEV);
        var HC2 = HILLC || hillColours(GROUNDS.sparse);
        if (e.nx + e.ny <= 0.02) { line(AT, BT, HC2.crestFar); return; }
        var lit = e.ny - e.nx > 0;
        if (lit) { line(AT, BT, HC2.crestLit[0]); line(AT, BT, HC2.crestLit[1], 1); line(AT, BT, HC2.crestLit[2], 2); }
        else { line(AT, BT, HC2.crestDark[0]); line(AT, BT, HC2.crestDark[1], 1); line(AT, BT, HC2.crestDark[2], 2); }
        var len = Math.hypot(BT[0] - AT[0], BT[1] - AT[1]);
        for (var i = 0; i < len; i += 1 + hr() * 2) {
          if (hr() > 0.55) continue;
          var f = i / len, x = Math.round(AT[0] + (BT[0] - AT[0]) * f), y = Math.round(AT[1] + (BT[1] - AT[1]) * f);
          var hang = 1 + (hr() * 4 | 0);
          for (var k = 0; k < hang; k++) {
            g.fillStyle = (BLADES || BLADE)[Math.max(0, (lit ? 3 : 1) - k)];
            g.fillRect(x, y + k, 1, 1);
          }
        }
      });
      // turf and stones across the top, and here and there an outcrop of rock
      var area = r.w * r.h * (r.poly ? 0.7 : 1);
      for (var k = 0; k < area * 11; k++) {
        var at = spotIn(r, 0.2, hr), sp = toScreen(at.x, at.y);
        if (r.top && !z0 && R0() && root.PMC.inPoly(at.x, at.y, r.top)) continue;   // the upper step covers it
        if (hr() > 1 - HILLTUFT) tuft(g, sp.x, sp.y - z0 - ELEV, hr);
        else pebble(g, sp.x, sp.y - z0 - ELEV, 1 + (hr() * 2 | 0), hr);
      }
      for (var oc = 0; oc < Math.round(area / 25); oc++) {
        var ot = spotIn(r, 1.2, hr), os = toScreen(ot.x, ot.y);
        if (r.top && !z0 && R0() && root.PMC.inPoly(ot.x, ot.y, r.top)) continue;
        boulder(g, os.x, os.y - z0 - ELEV, (0.7 + hr() * 0.6) * K * 0.72, a(2 + hr() * 3), hr);
      }
    }


    return {
      R0: R0,
      bakeGround: bakeGround,
      depthIn: depthIn,
      hex3: hex3,
      pebble: pebble,
      sp2: sp2,
      spotIn: spotIn,
      vgrad: vgrad
    };
  };
})(window);
