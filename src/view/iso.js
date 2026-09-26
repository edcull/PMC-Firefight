/* PMC 2670 — Firefight : isometric pixel-art renderer.
   The rules run on a flat 48" x 36" table in inches. This module projects that
   table into a 2:1 isometric view, painted into a small pixel buffer that the
   game upscales with nearest-neighbour so every pixel stays hard-edged. */
(function (root) {
  'use strict';

  var K = 32;                   // pixels per inch along the iso axes
  var A = K / 5;                // art scale, relative to the 5px/inch original
  var ELEV = 30;                // height of a hill, in buffer pixels
  var TOP = 208, BOT = 112, SIDE = 52, LIP = 40;
  function a(n) { return Math.max(1, Math.round(n * A)); }
  var W = 48, H = 48;
  var OX = H * K + SIDE;
  var OY = TOP;
  var PIXW = (W + H) * K + SIDE * 2;
  var PIXH = (W + H) * K / 2 + TOP + BOT;

  function toScreen(x, y) { return { x: (x - y) * K + OX, y: (x + y) * (K / 2) + OY }; }
  function toWorld(sx, sy) {
    var u = (sx - OX) / K, v = (sy - OY) / (K / 2);
    return { x: (u + v) / 2, y: (v - u) / 2 };
  }

  /* ---------- palettes ---------- */
  var SOIL = ['#3b3225', '#483e2e', '#564a37', '#655741', '#75654c', '#867458'];
  var SCRUB = ['#2f3a20', '#3a4628', '#455231', '#516039', '#5f6e45'];
  var SAND = ['#5d5139', '#6d6046', '#7e7054', '#8f8062', '#a09071'];
  var MUD = ['#251f16', '#2f281d', '#3a3226', '#463c2d'];
  /* The open ground takes its colour from the world the fight is on (the
     planet types of pp. 46-48): each has its own base ground, its own growth,
     its own dry patches and its own low wet or burnt ground, and a share of the
     scatter that is grass rather than stone. */
  var GROUNDS = {
    barren: {                                     // barren / arctic: grey dust with frost lying in the hollows
      soil: ['#34363a', '#40434a', '#4d5058', '#5b5f67', '#6a6f77', '#7b8088'],
      scrub: ['#6d7780', '#7c8790', '#8c97a0', '#9da8b0', '#b0bac1'],
      sand: ['#524f4a', '#605c55', '#6f6a62', '#7e7970', '#8e897f'],
      mud: ['#1f2125', '#282a2f', '#31343a', '#3a3e45'],
      tufts: 0.08, track: ['#26282c', '#6a6f77']
    },
    /* The book's barren / arctic table, fought on either of two worlds that
       look nothing alike. Each still has a base ground, a second ground in
       patches, a dry or bare patch and a low ground, as every world does —
       they are simply different things on each. */
    desert: {                                     // desert: warm sand, paler drift, red hardpan, dark gravel in the hollows
      soil: ['#6a5232', '#7b6139', '#8c7043', '#9d804e', '#ae905b', '#bea06a'],
      scrub: ['#a8966e', '#b7a57c', '#c5b38a', '#d2c099', '#ddcba7'],
      sand: ['#6b3f25', '#7c4a2c', '#8d5634', '#9e623d', '#ae6f47'],
      mud: ['#3a2c1c', '#463523', '#533f2a', '#604932'],
      tufts: 0.12, hillTufts: 0.2, track: ['#4f3c24', '#c2a877'],
      // what little grows is dry: straw, not grass
      blade: ['#3e301a', '#6a5630', '#8c7644', '#aa925a', '#c4ab70']
    },
    arctic: {                                     // arctic: snow with blue shadow, bare rock showing through
      /* Overcast snow rather than glare: light enough to read as snow, dark
         enough at its brightest that a white marker can still be picked out
         against it (and every marker on the table has a dark edge besides). */
      soil: ['#8e98a4', '#9fa9b5', '#b0bac5', '#c0c9d3', '#cfd7df', '#dce3ea'],
      scrub: ['#7d8fa3', '#8b9db1', '#99abbe', '#a8b9ca', '#b7c7d6'],
      sand: ['#3f4247', '#4b4f55', '#585c63', '#666a71', '#747880'],
      mud: ['#5a6678', '#667385', '#728092', '#7e8c9e'],
      tufts: 0.04, hillTufts: 0.06, track: ['#6f7c8c', '#e6ecf1'],
      // the odd dead stem through the snow, frosted grey
      blade: ['#454c56', '#666e7a', '#87909b', '#a3abb4', '#bec5cd']
    },
    sparse: { soil: SOIL, scrub: SCRUB, sand: SAND, mud: MUD, tufts: 1, track: ['#2f2619', '#6b5c43'] },
    dense: {                                      // temperate dense: dark loam under a lot of green
      soil: ['#2e2a1c', '#3a3524', '#46412c', '#524d34', '#5f5a3d', '#6d6847'],
      scrub: ['#25361b', '#2e4221', '#384f28', '#435d30', '#4f6b39'],
      sand: ['#4d4a30', '#5b573a', '#6a6645', '#78744f', '#86825a'],
      mud: ['#1e1b12', '#272318', '#302b1e', '#3a3425'],
      tufts: 1.4, track: ['#241f14', '#5a553a']
    },
    industrial: {                                 // industrial: ash, slag and oil, rust where the water ran
      soil: ['#302f2d', '#3b3a37', '#474542', '#53514d', '#605e59', '#6e6b66'],
      scrub: ['#262824', '#2e302b', '#363932', '#3f423a', '#484b42'],
      sand: ['#4a3426', '#5a3f2c', '#6a4b33', '#7a573b', '#8a6344'],
      mud: ['#18171a', '#1f1e21', '#262529', '#2e2d31'],
      tufts: 0.2, track: ['#1c1b1d', '#5e5c58']
    },
    jungle: {                                     // jungle: red laterite under deep green growth
      soil: ['#3a2418', '#472d1e', '#553724', '#63412b', '#724c33', '#81583b'],
      scrub: ['#1d3319', '#243e1e', '#2c4a24', '#35572b', '#3f6433'],
      sand: ['#6a3f24', '#7a4a2b', '#8a5533', '#9a613b', '#aa6d44'],
      mud: ['#1d1510', '#261c15', '#30241b', '#3a2c21'],
      tufts: 1.6, track: ['#2a1a10', '#7a4a2c']
    },
    mountain: {                                   // mountain: cold grey-brown stone and thin lichen
      soil: ['#37332e', '#433e38', '#504a43', '#5d574f', '#6b645b', '#7a7268'],
      scrub: ['#3a4133', '#454c3c', '#505845', '#5c644f', '#687159'],
      sand: ['#5e5a52', '#6d6960', '#7c786e', '#8b877c', '#9b978b'],
      mud: ['#23211e', '#2c2a26', '#35322e', '#3e3b36'],
      tufts: 0.45, track: ['#27241f', '#6b645b']
    },
    unstable: {                                   // unstable / tectonic: black basalt, ash and sulphur
      soil: ['#221e1c', '#2c2724', '#37312d', '#433b36', '#4f4640', '#5c524b'],
      scrub: ['#3e3b38', '#4a4643', '#56524e', '#635e59', '#706a64'],
      sand: ['#5e5220', '#6e6026', '#7e6e2d', '#8e7c35', '#9e8a3d'],
      mud: ['#1e1110', '#2a1614', '#361c18', '#43221d'],
      tufts: 0.1, track: ['#171312', '#4f4640']
    }
  };
  var STONE = ['#2c2b28', '#413f3a', '#57544d', '#6f6b62', '#8a857a', '#a49e91'];
  var LEAF = ['#1a2917', '#23381e', '#2e4826', '#3b6030', '#4d783c', '#61924a'];
  var BARK = ['#241a11', '#33261a', '#443324'];
  var BAG = ['#5c4d2e', '#7a6840', '#988354', '#b39c68'];
  var WATER = ['#22414f', '#2d5566', '#3a6c80', '#4f8a9e', '#74b0c2'];
  var DEEPW = ['#0d202c', '#132c3c', '#1b3a4c', '#25506a'];
  var CRUST = ['#1a1412', '#261c17', '#33241c', '#41301f'];
  var GLOW = ['#8c2a0c', '#d1541a', '#f08a22', '#ffc861'];
  var CONCRETE = ['#2e2c28', '#474440', '#5f5b54', '#797469', '#938d80', '#ada693'];
  var ROOF = ['#2b3038', '#3b424c', '#4d5661', '#616c79'];
  var BRICK = ['#2a1b15', '#452c22', '#5c3a2c', '#744a37', '#8a5a43', '#a06c52'];
  var PREFAB = ['#262d2d', '#374141', '#4a5655', '#5e6b69', '#75837f', '#8f9d98'];
  var CHAR = ['#191410', '#241d16', '#33291f'];

  var BAYER = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]
  ];

  /* ---------- noise ---------- */
  // a 32-bit integer hash. The arithmetic has to stay inside int32 — the usual
  // n * (n * n * 15731 + ...) formulation overflows the float mantissa and
  // collapses to zero, which quietly flattens every noise field built on it.
  function hash(x, y, s) {
    var n = Math.imul(x | 0, 1619) ^ Math.imul(y | 0, 31337) ^ Math.imul(s | 0, 6971);
    n = Math.imul(n ^ (n >>> 15), 2246822519);
    n = Math.imul(n ^ (n >>> 13), 3266489917);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm(x, y, s, oct) {
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); norm += amp; f *= 2; amp *= 0.5; }
    return sum / norm;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ---------- pixel helpers ---------- */
  var PIXEL = 2;                // the visible "pixel" of the art, in buffer px
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function dot(g, x, y, c, s) { g.fillStyle = c; g.fillRect(x | 0, y | 0, s || PIXEL, s || PIXEL); }

  /* Convex polygon. Baked terrain is scanline filled so its edges sit on the
     plate's pixel grid. A machine is drawn live into the board's working
     window at up to twice the plate's resolution, and there the scanline's
     whole-pixel rows show up as horizontal banding down every sloped face — so
     while a machine is being drawn (PH.smooth) it is filled as a true path. */
  // the convex hull of a set of screen points (monotone chain)
  function hull2d(pts) {
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    p.forEach(function (q) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (var i = p.length - 1; i >= 0; i--) { var q = p[i]; while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  /* What is being drawn right now, set by whoever is drawing it and read by
     the painting underneath: one object for the whole renderer, so its parts
     in their own files all see the same. smooth: a machine is being drawn
     (filled paths, not dithered); corpse: a body (its deflector gone out);
     shield, brain, flame, wing: the frame each animation is on; mounts: where
     the barrels end, collected while a machine is drawn into a scratch canvas. */
  var PH = { smooth: false, corpse: false, shield: 0, brain: 0, flame: -1, wing: -1, mounts: null };
  var RING_VIS = -1;
  function poly(g, pts, c) {
    if (PH.smooth) {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (var q = 1; q < pts.length; q++) g.lineTo(pts[q][0], pts[q][1]);
      g.closePath();
      g.fill();
      return;
    }
    var minY = Infinity, maxY = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i][1] < minY) minY = pts[i][1];
      if (pts[i][1] > maxY) maxY = pts[i][1];
    }
    g.fillStyle = c;
    for (var y = Math.round(minY); y < Math.round(maxY); y++) {
      var xs = [], cy = y + 0.5;
      for (i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) {
          xs.push(a[0] + (cy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      if (xs.length < 2) continue;
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var x0 = Math.round(xs[k]), x1 = Math.round(xs[k + 1]);
        if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
      }
    }
  }

  function ellipse(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      var t = 1 - (y * y) / (ry * ry);
      if (t <= 0) continue;
      var half = Math.sqrt(t) * rx;
      var x0 = Math.round(cx - half), x1 = Math.round(cx + half);
      if (x1 > x0) g.fillRect(x0, Math.round(cy + y), x1 - x0, 1);
    }
  }

  function ellipseRing(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var a = 0; a < Math.PI * 2; a += 0.06) {
      g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
    }
  }
  /* A unit's state, laid over its ring as short dashes, so the army's dots
     still show between them whatever its colour: amber when suppressed, red
     when broken. */
  var STATUS_DASH = {
    suppressed: { c: '#e08a3a', on: 0.16, off: 0.36 },
    broken: { c: '#e0557a', on: 0.16, off: 0.36 }
  };
  function statusDashes(g, cx, cy, rx, ry, st, w) {
    var d = STATUS_DASH[st];
    if (!d) return;
    var n = Math.round(Math.PI * 2 / (d.on + d.off)), per = Math.PI * 2 / n;
    var on = per * d.on / (d.on + d.off);
    w = Math.max(1, Math.round(w || 2));
    [['rgba(12,10,8,.55)', w + 1], [d.c, w]].forEach(function (pass) {
      g.fillStyle = pass[0];
      for (var k = 0; k < n; k++) {
        var a0 = k * per + per * 0.25;
        for (var a = a0; a <= a0 + on; a += 0.02) {
          g.fillRect(Math.round(cx + Math.cos(a) * rx - pass[1] / 2), Math.round(cy + Math.sin(a) * ry - pass[1] / 2), pass[1], pass[1]);
        }
      }
    });
  }

  // world-space iso diamond (a rectangle on the table)
  function tile(g, x, y, w, h, c, lift) {
    var p = [
      toScreen(x, y), toScreen(x + w, y), toScreen(x + w, y + h), toScreen(x, y + h)
    ].map(function (s) { return [s.x, s.y - (lift || 0)]; });
    poly(g, p, c);
  }

  // the ground: iso-ground.js (installed with the modules, below)
  // the props: iso-props.js (installed with the modules, below)
  // the troopers: iso-troops.js (installed with the modules, below)
  // the alien races: iso-aliens.js (installed with the modules, below)
  // the crew-served guns: iso-guns.js (installed with the modules, below)
  /* ---------- formation ---------- */
  var ROWS = {
    1: [1], 2: [1, 1], 3: [1, 2], 4: [2, 2],
    5: [2, 3], 6: [3, 3], 7: [2, 3, 2], 8: [3, 3, 2]
  };
  /* The models of a garrison (p. 41), inside the building: spread round the
     inside of its walls, a man at each window, all the way round — as screen
     offsets from the building's centre `at`, drawn far to near. The building
     itself is drawn cut away, so the floor and the men on it can be seen. */
  function garrisonSpots(r, n, at) {
    var inset = Math.min(0.75, Math.min(r.w, r.h) * 0.22);
    var x0 = r.x + inset, y0 = r.y + inset, x1 = r.x + r.w - inset, y1 = r.y + r.h - inset;
    var w = x1 - x0, h = y1 - y0, tot = 2 * (w + h), out = [];
    var c0 = toScreen(at.x, at.y);
    for (var i = 0; i < n; i++) {
      var d = ((i + 0.5) / n * tot + tot * 0.07) % tot, wx, wy;
      if (d < w) { wx = x0 + d; wy = y0; }                                   // the north wall
      else if (d < w + h) { wx = x1; wy = y0 + (d - w); }                    // the east
      else if (d < 2 * w + h) { wx = x1 - (d - w - h); wy = y1; }           // the south
      else { wx = x0; wy = y1 - (d - 2 * w - h); }                           // the west
      var q = toScreen(wx, wy);
      out.push({ sx: q.x - c0.x, sy: q.y - c0.y, rank: 0, depth: wx + wy });
    }
    return out.sort(function (a2, b2) { return a2.depth - b2.depth; });
  }
  /* The models of a squad lining a trench or a wall: at the table points the
     board worked out along it (`pts`), as screen offsets from the unit's own
     spot `at`, drawn far to near. The unit has not moved; its men have. */
  function lineSpots(pts, at) {
    var c0 = toScreen(at.x, at.y);
    return pts.map(function (q0) {
      var q = toScreen(q0.x, q0.y);
      return { sx: q.x - c0.x, sy: q.y - c0.y, rank: q0.rank || 0, depth: q0.x + q0.y };
    }).sort(function (a2, b2) { return a2.depth - b2.depth; });
  }
  /* The same formation as table offsets from the unit's spot, in inches: the
     board uses it to see which men would be standing outside the ground the
     unit is in. A screen offset (2tK, dK) is (t + d, d - t) on the table. */
  function formationTable(n) {
    return formation(n).map(function (s2) {
      var t = s2.sx / (2 * K), d = s2.sy / K;
      return { dx: t + d, dy: d - t, rank: s2.rank };
    });
  }
  function formation(n) {
    var rows = ROWS[Math.max(1, Math.min(8, n))] || [3, 3, 2], out = [];
    for (var r = 0; r < rows.length; r++) {
      var m = rows[r], d = (r - (rows.length - 1) / 2) * 0.56;
      for (var k = 0; k < m; k++) {
        var t = (k - (m - 1) / 2) * 0.56;
        // iso offsets inside the base, back rank first
        out.push({ sx: 2 * t * K, sy: d * K, rank: rows.length - 1 - r });
      }
    }
    return out;
  }

  /* ---------- one height for a man ----------
     Figures used to come out anywhere from 25 to 36 plate pixels tall standing
     up. Most of that was the squad: a unit of seven or eight was drawn at 78%
     to fit its base, so a rifle team stood a head shorter than the command
     team beside it. The rest was kit — a cowl, a shield, a tall helmet each
     move the silhouette by a few pixels.

     So a figure is no longer scaled by how many are in its squad, and each one
     is measured once standing up and scaled to the same height as everyone
     else. Power armour — battle suits and hardsuits — stands a head taller,
     because it is. Kneeling and lying down are scaled with the same factor, so
     they stay in proportion to the man. */
  var STAND_H = 30;               // plate pixels, a man standing
  function isArmoured(art) {
    var roles = ROLES[art] || [];
    return roles.some(function (r) { return KIT[r] && KIT[r].armoured; });
  }
  var ARMOUR_H = 1.15;            // and a man in powered armour
  var fits = {};
  function fitScale(art, i) {
    var role = roleAt(art, i);
    if (fits[role] != null) return fits[role];
    var kit = KIT[role] || KIT.rifle;
    /* A flag or a whip antenna stands well over the man carrying it; he is
       sized as the figure he would be without it. */
    if (kit.fitAs) {
      for (var fa in ROLES) {
        var ix = ROLES[fa].indexOf(kit.fitAs);
        if (ix >= 0) return (fits[role] = fitScale(fa, ix));
      }
    }
    // measured on the walking frame, which is the one pose every kit stands up in
    var c = sprite('A', art, i, 'stand', 1, MODEL, 0);
    var g = c.getContext('2d');
    var d = g.getImageData(0, 0, c.width, c.height).data;
    var top = -1, bot = -1, y, x;
    for (y = 0; y < c.height && top < 0; y++) {
      for (x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 200) { top = y; break; }
    }
    for (y = c.height - 1; y >= 0 && bot < 0; y--) {
      for (x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 200) { bot = y; break; }
    }
    var natural = top < 0 ? STAND_H : (bot - top + 1) / (c.res || 1);
    var want = STAND_H * (kit.armoured ? ARMOUR_H : 1) * (kit.big || 1);
    return (fits[role] = natural > 0 ? want / natural : 1);
  }

  // how far the top of a squad stands above the centre of its base, in buffer px
  function headroom(n, pose, armoured) {
    var tall = STAND_H * (armoured ? ARMOUR_H : 1) *
      (pose === 'prone' ? 0.32 : pose === 'kneel' ? 0.8 : 1);
    var ranks = (ROWS[Math.max(1, Math.min(8, n))] || [3, 3, 2]).length;
    return tall + (ranks - 1) / 2 * 0.56 * K + a(3.5);
  }

  // the machines: iso-machines.js (installed with the modules, below)

  /* Every surviving model's muzzle, as a screen offset from the ground point
     under the squad — the same ranks, the same jitter and the same figures that
     drawUnit puts down, so a shot drawn from one of these leaves a barrel. */
  // how high a flying bug hangs off the ground, in plate pixels
  function bugHover(art, mi, pose, step) {
    var kt = KIT[roleAt(art, mi)];
    if (!kt || !kt.fly || pose === 'prone') return 0;
    return a(4.4) - (pose === 'kneel' ? a(1.8) : 0) + (mi % 2 ? a(0.9) : 0) + (step ? a(0.6) : 0);
  }
  /* A squad under fire hunkers down on one knee, and a broken one no lower:
     it is still up, ready to run. Lying flat is for firing positions and for
     troops getting up as they arrive, never a state. The one exception is a
     bug that goes about on its legs: broken, it digs in (see burrowBug). */
  /* Suppressed and Broken are drawn alike — hunkered low. A bug that has broken
     goes low the same way (its sunk-in-the-earth pose is kept for a swarm
     tunnelling up out of the ground on a Battlefield Insertion). */
  function statusPose(status, art) {
    return status === 'broken' || status === 'suppressed' ? 'kneel' : 'stand';
  }
  function muzzles(u, status) {
    if (!u || u.cls === 'vehicle' || u.cls === 'aircraft') return [];
    var art = u.art || 'rifle';
    if (u.riders && ROLES[art + 'mounted']) art = art + 'mounted';
    var n = Math.max(1, Math.min(8, u.models || 1));
    var pose = statusPose(status, art);
    var spots = formation(n), out = [];
    var seed = 0, sid = String(u.id || u.code || '');
    for (var q = 0; q < sid.length; q++) seed = (seed * 31 + sid.charCodeAt(q)) | 0;
    var dir = u.faceL ? -1 : 1;
    if (PIECE3D[art]) return pieceMuzzles3D(u);
    if (FIELD_GUN[art]) {                               // the one muzzle, on the end of the barrel
      var go = gunOpts(u, u), mz = fieldMuzzle(go), q0 = toScreen(u.x, u.y), q1 = toScreen(mz.x, mz.y);
      return [{ dx: q1.x - q0.x, dy: q1.y - q0.y - mz.up, dir: gunFaceL(go.aim) ? -1 : 1 }];
    }
    for (var k = 0; k < spots.length; k++) {
      var mi = spots.length - 1 - k;
      var jx = ((hash(mi + 1, seed & 255, 7) * 2 - 1) * 3) | 0;
      var jy = ((hash(seed & 255, mi + 1, 11) * 2 - 1) * 2) | 0;
      var c = sprite(u.paint || u.side, art, mi, pose, 0, MODEL * fitScale(art, mi), Math.min(2, spots[k].rank), u.mount);
      var m = c.muz || [SU * 12, -SU * 38], hov = bugHover(art, mi, pose, 0);
      var bx = spots[k].sx + jx, by = spots[k].sy + jy - hov;
      out[mi] = { dx: bx + dir * m[0], dy: by + m[1], dir: dir };
      if (c.tool) out[mi].tool = true;
      if (c.gun) out[mi].gun = c.gun;
      if (c.pod) out[mi].pod = { dx: bx + dir * c.pod[0], dy: by + c.pod[1], dir: dir };
      if (c.eye) out[mi].eye = { dx: bx + dir * c.eye[0], dy: by + c.eye[1], dir: dir };
    }
    return out.filter(Boolean);
  }

  /* A hull with what it carries outside: a gun on tow behind it, drawn first
     when the gun is the further of the two; or, under a Lifter, the vehicle
     slung below it on its cables (p. 94), hanging under the airframe. */
  // how tall a machine stands, in pixels above its ground: its hull on its running gear or legs
  function machineTop(unit) {
    var sp = hullSpec(unit.art);
    if (sp.heli) return ELEV * sp.fly + sp.hgt + 26;
    if (unit.prop === 'walker' && unit.transport && sp.style) return 16 + sp.hgt * 1.3 + 12;
    if (unit.prop === 'walker') {                 // a mech stands well clear of its hull
      var mL = sp.len * 0.8, mH = sp.hgt * 0.8;
      var sf2 = mL / 2.0, bl = (HULL[unit.art] || HULL.wheeled).len;
      if (bl < 2.3) return Math.round(24 * sf2 + mH * 0.4) + Math.round(10 * sf2 + mH * 0.3) + Math.round(11 * sf2) + 10;
      if (bl >= 2.55) return Math.round(20 * sf2 + mH * 0.35) + Math.round(24 * sf2 + mH * 0.5) + Math.round(9 * sf2) + 12;
      return Math.round(22 * sf2 + mH * 0.4) + Math.round(20 * sf2 + mH * 0.5) + Math.round(6 * sf2) + 12;
    }
    return (DRIVE[unit.prop] ? DRIVE[unit.prop].ride : 7) + sp.hgt + (sp.tHgt || 0) + 6;
  }
  function slungVehicle(u) {
    if (!u || u.cls !== 'aircraft') return null;
    return (u.cargo || []).filter(function (c) { return c && c.cls === 'vehicle'; })[0] || null;
  }
  function hullWithLoad(g, u, opts) {
    var atT = opts.at || u, m;
    var tg = towedGun(u);
    /* The gun goes on first when it is the further of the two — and when it is
       level with the hull (a side-on tow, E or W), so the hull's near wheels
       cover the hitch rather than the trail covering them. */
    var tBehind = tg && (Math.cos(u.facing || 0) + Math.sin(u.facing || 0)) > -0.3;
    if (tg && tBehind) drawTowed(g, u, tg, atT);
    var sv = slungVehicle(u);
    if (sv) {
      // laden, the Lifter rides higher, the vehicle hanging clear under it on long cables
      var top = machineTop(sv);
      var hang = 14 + top * 0.25, climb = hang + top + 24, base = opts.lift || 0;
      var lo = {};
      for (var ok in opts) lo[ok] = opts[ok];
      lo.lift = base + climb;
      lo.ground = base;                              // raised by its load, not off the ground: the shadow stays down there
      opts = lo;
      var v2 = {};
      for (var key in sv) v2[key] = sv[key];
      v2.facing = u.facing; v2.aim = null; v2.cargo = [];
      drawMachine(g, v2, { at: atT, lift: base + hang, ground: base, status: 'ready' });
      // the cables, from the belly hook down to the vehicle's four corners
      var vs = hullSpec(sv.art) || { len: 1.4, wid: 0.8, hgt: 12 }, f = u.facing || 0, c = Math.cos(f), sn = Math.sin(f);
      var hook = toScreen(atT.x, atT.y);
      hook.y -= base + climb + flyLift(u) - 2;
      // a mech on its own legs is narrower than its hull's footprint: the cables close in on its shoulders
      var mech = sv.prop === 'walker' && !(sv.transport && vs.style), cl = mech ? 0.12 : 0.36, cw = mech ? 0.16 : 0.36;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) {
        var t = q[0] * vs.len * cl, s2 = q[1] * vs.wid * cw;
        var w = toScreen(atT.x + c * t - sn * s2, atT.y + sn * t + c * s2);
        thickLine(g, hook.x, hook.y, w.x, w.y - base - hang - top + 8, Math.max(1.2, K * 0.035), '#16181a');
      });
    }
    m = drawMachine(g, u, opts);
    if (tg && !tBehind) drawTowed(g, u, tg, atT);
    return m;
  }

  var DIM_CANVAS = null;
  function drawUnit(g, u, opts) {
    opts = opts || {};
    var at = opts.at || u;
    var p = toScreen(at.x, at.y);
    p.y -= opts.lift || 0;
    if (opts.hop) p.y -= opts.hop;
    var pal = PALETTE[u.paint || u.side] || PALETTE.A;
    var st = opts.status || 'ready';
    /* The ring (and the morale bar) show the unit's state; the figures take
       their pose from it too, unless told otherwise: a squad getting up off
       the ground as it arrives is posed flat, then kneeling, whatever its state. */
    var rst = st;
    var art = u.art || 'rifle';
    // mounted infantry (the Riders upgrade, p. 93) ride whatever they can find
    if (u.riders && ROLES[art + 'mounted']) art = art + 'mounted';

    if (u.cls === 'vehicle' || u.cls === 'aircraft') {
      // a machine that has acted this turn is drawn darker
      /* Drawn onto a scratch canvas and darkened there with one source-atop fill,
         then stamped down in a single drawImage. (A canvas filter on the board
         itself pushes every one of the hull's thousands of pixel writes through
         the filter, which stalls a software-rendered page outright.) */
      var m;
      if (opts.activated && typeof document !== 'undefined') {
        var DW = a(240), DH = a(280), ox = Math.round(p.x - DW / 2), oy = Math.round(p.y - DH * 0.6);
        var dc = DIM_CANVAS || (DIM_CANVAS = document.createElement('canvas'));
        if (dc.width !== DW || dc.height !== DH) { dc.width = DW; dc.height = DH; }
        var dg = dc.getContext('2d');
        dg.setTransform(1, 0, 0, 1, 0, 0);
        dg.globalCompositeOperation = 'source-over';
        dg.clearRect(0, 0, DW, DH);
        dg.imageSmoothingEnabled = false;
        dg.translate(-ox, -oy);
        m = hullWithLoad(dg, u, opts);
        dg.setTransform(1, 0, 0, 1, 0, 0);
        dg.globalCompositeOperation = 'source-atop';
        dg.fillStyle = 'rgba(6,8,12,.42)';
        dg.fillRect(0, 0, DW, DH);
        dg.globalCompositeOperation = 'source-over';
        g.drawImage(dc, ox, oy);
      } else {
        m = hullWithLoad(g, u, opts);
      }
      if (opts.selected) {
        var ring = toScreen(at.x, at.y);
        ellipseRing(g, ring.x, ring.y, a(9), a(4.5), '#ffffff');
      }

      if (smoking(u)) {
        var sseed = 0, ssid = String(u.id || u.code || '');
        for (var sq = 0; sq < ssid.length; sq++) sseed = (sseed * 31 + ssid.charCodeAt(sq)) | 0;
        damageSmoke(g, p.x + a(0.5), p.y - m.lift - m.hgt * 0.7,
          opts.t != null ? opts.t : (root.performance ? performance.now() : 0), Math.abs(sseed));
      }
      var top = p.y - m.lift - m.hgt - a(4);
      if (u.damage && u.str) {                       // damage bar, in place of suppression
        var dw = a(6.5), dh = a(0.8);
        var fill = Math.max(PIXEL, Math.round(Math.min(1, u.damage / u.str) * dw));
        rect(g, p.x - dw / 2 - 1, top - 1, dw + 2, dh + 2, 'rgba(8,10,14,.7)');
        rect(g, p.x - dw / 2, top, dw, dh, '#15181d');
        rect(g, p.x - dw / 2, top, fill, dh, '#d1476b');
      }
      if (u.marked) {
        dot(g, p.x + a(5), top - a(2), '#e8c15a');
        dot(g, p.x + a(6.5), top - a(3.5), '#e8c15a');
      }
      return;
    }

    var br = a(7), brY = a(3.5);
    /* A garrison (p. 41) is drawn inside its building, cut away, with the men
       spread round the inside of the walls; the ring that carries the unit's
       state runs round the building's footprint. */
    var around = opts.around || null;
    if (around) {
      var ringCol0 = pal.light;
      var gap = 0.3, lf0 = opts.lift || 0;
      var corners = [[around.x - gap, around.y - gap], [around.x + around.w + gap, around.y - gap],
        [around.x + around.w + gap, around.y + around.h + gap], [around.x - gap, around.y + around.h + gap]]
        .map(function (q) { var s2 = toScreen(q[0], q[1]); return [s2.x, s2.y - lf0]; });
      [['rgba(12,10,8,.45)', PIXEL * 3], [ringCol0, PIXEL * 1.6]].concat(opts.selected ? [['#ffffff', PIXEL]] : []).forEach(function (st2, n2) {
        g.strokeStyle = st2[0]; g.lineWidth = Math.max(1, st2[1]);
        if (n2 === 2) g.setLineDash([a(2), a(1.5)]);
        g.beginPath();
        corners.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
        g.closePath(); g.stroke();
        g.setLineDash([]);
      });
      var sd = STATUS_DASH[rst];                       // the state, dashed over the army's line
      if (sd) {
        var len0 = a(6);
        [['rgba(12,10,8,.55)', PIXEL * 1.5], [sd.c, PIXEL]].forEach(function (st3) {
          g.strokeStyle = st3[0]; g.lineWidth = Math.max(1, st3[1]);
          g.setLineDash([len0 * sd.on, len0 * sd.off]);
          g.beginPath();
          corners.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
          g.closePath(); g.stroke();
          g.setLineDash([]);
        });
      }
    } else {
    /* No base disc. A token on a table has one; a squad standing on ground does
       not, and the dark ellipse under every unit read as a hole in the terrain.
       What is left is the ring — which is carrying information, since its colour
       is the unit's state — and a shadow tight enough under the models to sit
       them on the ground rather than ring them. */
    ellipse(g, p.x + a(0.5), p.y + a(0.5), a(4.5), a(2.2), 'rgba(16,12,8,.20)');

    /* The ring is the only thing carrying the unit's state now, so it is given a
       dark edge a pixel outside it — enough to read on pale ground without
       putting a disc back under the models. Its dots are always the army's;
       a state is dashed over them. */
    ellipseRing(g, p.x, p.y, br + PIXEL, brY + PIXEL, 'rgba(12,10,8,.45)');
    ellipseRing(g, p.x, p.y, br, brY, pal.light);
    statusDashes(g, p.x, p.y, br, brY, rst, PIXEL);
    if (opts.selected) ellipseRing(g, p.x, p.y, br + a(2), brY + a(1), '#ffffff');
    }

    // every surviving model, in ranks, drawn from the back of the base forwards
    var n = Math.max(1, Math.min(8, u.models || 1));
    // one height for a man, whatever squad he is in — see fitScale
    var scale = MODEL;
    var pose = opts.pose || statusPose(st, art);
    var spots = around ? garrisonSpots(around, n, at)
      : opts.lineAt && opts.lineAt.length === n ? lineSpots(opts.lineAt, at) : formation(n);
    var seed = 0, sid = String(u.id || u.code || '');
    for (var q = 0; q < sid.length; q++) seed = (seed * 31 + sid.charCodeAt(q)) | 0;
    // one of a gun crew, drawn where it kneels at (wx, wy) on the table, facing its piece's way
    function crewman(mi, wx, wy, fl) {
      var c = sprite(u.paint || u.side, art, mi, pose, (pose === 'stand' && opts.walk) ? (opts.walk + mi) % 2 : 0,
        scale * fitScale(art, mi), 1 + (opts.activated ? 3 : 0), u.mount);
      var q2 = toScreen(wx, wy), rs = c.res || 1, mx = q2.x, my = q2.y - (opts.lift || 0);
      var was = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = true;
      var bx = Math.round((mx - c.ox / rs) * rs) / rs, by = Math.round((my - c.oy / rs) * rs) / rs;
      if (fl) {
        g.save(); g.translate(mx, 0); g.scale(-1, 1);
        g.drawImage(c, bx - mx, by, c.width / rs, c.height / rs);
        g.restore();
      } else g.drawImage(c, bx, by, c.width / rs, c.height / rs);
      g.imageSmoothingEnabled = was;
    }
    if (PIECE3D[art] && !around) {
      var fl3 = gunFaceL(pieceAngles(u).f);
      drawPieces3D(g, u, art, at, opts, function (mi, wx, wy) { crewman(mi, wx, wy, fl3); });
      spots = [];
    }
    if (FIELD_GUN[art] && !around) {
      /* The gun on its own axes and its crew round the trails, all sorted by
         depth together, so a man behind the shield is hidden by it. */
      var go = gunOpts(u, at), fl = gunFaceL(go.aim), crew = [];
      go.lift = opts.lift || 0;
      for (var ci = 0; ci < n; ci++) {
        (function (mi) {
          var sp0 = GUN_CREW[mi % GUN_CREW.length];
          var ct = sp0[0], cs = sp0[1], wx = go.x + (Math.cos(go.aim) * ct + Math.sin(go.aim) * cs) * GUN_K,
            wy = go.y + (Math.sin(go.aim) * ct - Math.cos(go.aim) * cs) * GUN_K;
          crew.push({ d: wx + wy, fn: function () { crewman(mi, wx, wy, fl); } });
        })(ci);
      }
      go.extra = crew;
      fieldGun(g, go);
      spots = [];
    }
    for (var k = 0; k < spots.length; k++) {
      var mi = spots.length - 1 - k;                   // the front rank is the specialists
      var jx = ((hash(mi + 1, seed & 255, 7) * 2 - 1) * 3) | 0;
      var jy = ((hash(seed & 255, mi + 1, 11) * 2 - 1) * 2) | 0;
      var step = (pose === 'stand' && opts.walk) ? (opts.walk + mi) % 2 : 0;
      // a unit that has acted this turn is drawn darker, the whole squad in shade
      var c = sprite(u.paint || u.side, art, mi, pose, step, scale * fitScale(art, mi), Math.min(2, spots[k].rank) + (opts.activated ? 3 : 0), u.mount);
      var mx = p.x + spots[k].sx + jx, my = p.y + spots[k].sy + jy;
      // Flying Infantry hang in the air over their shadows
      var hov = bugHover(art, mi, pose, step);
      if (hov) { ellipse(g, mx, my, a(2.4), a(1), 'rgba(12,10,8,.22)'); my -= hov; }
      /* Jump troops do not walk: they go up on the jets, and what you see is the
         figure off the ground with the burn under it. Each model rides at its
         own height so the squad does not move as one slab. */
      if (u.jets && pose === 'stand' && opts.walk) {
        // on a bound the whole squad rides the arc, each model a little
        // behind or ahead of the one beside it
        var arcH = (opts.arc || 0) * (1 - (mi % 3) * 0.06);
        var jet = a(3.4) + (step ? a(1.4) : 0) + (mi % 2 ? a(0.8) : 0) + arcH;
        jetBurn(g, mx, my, a(1), jet, step, arcH);
        my -= jet;
      }
      /* Drawn at half the size it was baked, so at the board's full density a
         sprite pixel lands on a screen pixel. Zoomed out, the halving is a
         downscale, and that is the one place smoothing helps rather than blurs. */
      var rs = c.res || 1;
      var was = g.imageSmoothingEnabled, wasA = g.globalAlpha;
      g.imageSmoothingEnabled = true;
      if (cloakedKit(KIT[roleAt(art, mi)])) g.globalAlpha = wasA * cloakFade(mi);
      // snapped to the half-pixel, which is one pixel of a window drawn at 2x
      var bx = Math.round((mx - c.ox / rs) * rs) / rs, by = Math.round((my - c.oy / rs) * rs) / rs;
      if (u.faceL) {
        // facing the other way: the figure turned about its own feet
        g.save();
        g.translate(mx, 0); g.scale(-1, 1);
        g.drawImage(c, bx - mx, by, c.width / rs, c.height / rs);
        g.restore();
      } else g.drawImage(c, bx, by, c.width / rs, c.height / rs);
      g.imageSmoothingEnabled = was; g.globalAlpha = wasA;
    }

    // a garrison's markers ride over the middle of the building
    if (around) { var nc = toScreen(around.x + around.w / 2, around.y + around.h / 2); p = { x: nc.x, y: nc.y - (opts.lift || 0) }; }
    // the markers ride just above the tallest helmet in the squad
    var standing = p.y - headroom(n, pose, isArmoured(art));
    var head = standing - (u.jets && opts.walk ? (opts.arc || 0) : 0);   // markers ride the jump

    if (u.sp > 0 && opts.morale) {
      var w = a(6.5), bh = a(0.8);
      var filled = Math.max(PIXEL, Math.round(Math.min(1, u.sp / (2 * opts.morale)) * w));
      rect(g, p.x - w / 2 - 1, head - 1, w + 2, bh + 2, 'rgba(8,10,14,.7)');
      rect(g, p.x - w / 2, head, w, bh, '#15181d');
      rect(g, p.x - w / 2, head, filled, bh, rst === 'broken' ? '#d1476b' : rst === 'suppressed' ? '#e0a23a' : '#6fbf5a');
      // a red ! to the right when it carries all the Suppression it can
      if (window.PMC && u.sp >= window.PMC.SP_MAX) {
        var ex = p.x + w / 2 + a(1.2), ew = Math.max(PIXEL, a(0.5)), et = head - a(1.4), eh = a(1.6), eg = Math.max(PIXEL, a(0.35));
        rect(g, ex - 1, et - 1, ew + 2, eh + eg + ew + 2, 'rgba(8,10,14,.7)');
        rect(g, ex, et, ew, eh, '#e5485f');
        rect(g, ex, et + eh + eg, ew, ew, '#e5485f');
      }
    }
    if (u.marked) {
      dot(g, p.x + a(5), head - a(2), '#e8c15a');
      dot(g, p.x + a(6.5), head - a(3.5), '#e8c15a');
    }
  }

  /* The standing height of one figure, in plate pixels: how tall the opaque
     part of its baked sprite is. The harness uses it to check that a rifleman
     is a rifleman's height whatever squad he is in. */
  function figureHeight(side, art, i, scale) {
    var c = sprite(side || 'A', art, i || 0, 'stand', 1,
      (scale || MODEL) * fitScale(art, i || 0), 0);
    var g = c.getContext('2d');
    var d = g.getImageData(0, 0, c.width, c.height).data;
    var top = -1, bot = -1;
    for (var y = 0; y < c.height && top < 0; y++) {
      for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 200) { top = y; break; }
    }
    for (var y2 = c.height - 1; y2 >= 0 && bot < 0; y2--) {
      for (var x2 = 0; x2 < c.width; x2++) if (d[(y2 * c.width + x2) * 4 + 3] > 200) { bot = y2; break; }
    }
    return top < 0 ? 0 : (bot - top + 1) / (c.res || 1);
  }

  /* ---------- what a fight leaves on the ground ----------
     A man killed stays where he fell: the prone figure of his role, dulled
     and darkened, a stain under him. A machine destroyed stays as a burnt-out
     wreck, burning and smoking, for the rest of the game. */
  var corpses = {};
  function corpseSprite(side, art, mi) {
    var key = side + '|' + art + '|' + mi;
    if (corpses[key]) return corpses[key];
    PH.corpse = true;
    try { var src = sprite(side, art, mi, 'prone', 0, MODEL * fitScale(art, mi), 0); } finally { PH.corpse = false; }
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    var g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(34,28,22,.52)';               // the colour gone out of him
    g.fillRect(0, 0, c.width, c.height);
    c.ox = src.ox; c.oy = src.oy; c.res = src.res;
    corpses[key] = c;
    return c;
  }
  // where the model a squad loses was standing: the last one, in its old formation
  function casualtySpot(u, nBefore, salt) {
    var n = Math.max(1, Math.min(8, nBefore || 1)), sp = formation(n)[0];
    var seed = 0, sid = String(u.id || u.code || '');
    for (var q = 0; q < sid.length; q++) seed = (seed * 31 + sid.charCodeAt(q)) | 0;
    // flung out toward the edge of the base, so the fallen are not lost under the living
    var ang = hash(salt | 0, seed & 255, 17) * Math.PI * 2, rr = 0.75 + 0.35 * hash(seed & 255, salt | 0, 19);
    return { dx: sp.sx * 0.3 + Math.cos(ang) * a(8.5) * rr, dy: sp.sy * 0.3 + Math.sin(ang) * a(4.2) * rr, mi: n - 1 };
  }
  function drawBody(g, sx, sy, b) {
    /* The last of a gun crew to fall leaves the gun: knocked out where it stood. */
    if (b.piece && PIECE3D[b.art]) { pieceWreck(g, b, toWorld(sx, sy)); return; }
    if (b.piece && FIELD_GUN[b.art]) {
      var wp = toWorld(sx, sy), aim0 = b.aim != null ? b.aim : (b.flip ? Math.PI * 0.75 : -Math.PI * 0.25);
      var gw = gunOpts({ facing: aim0 + 0.5, key: b.key, side: b.side, paint: b.paint }, wp, 'wreck');
      fieldGun(g, gw);
      return;
    }
    var c = corpseSprite(b.paint || b.side, b.art || 'rifle', b.mi || 0), rs = c.res || 1;
    // what it bled: a man red, a bug its green ichor, a Crock the tribe's blue
    var art0 = b.art || '', kit0 = KIT[(ROLES[art0] || [])[0]] || {};
    var pool = kit0.bug ? 'rgba(92,150,40,.42)' : kit0.xeno ? 'rgba(60,130,220,.42)' : 'rgba(58,20,14,.30)';
    ellipse(g, sx + a(0.5), sy, a(2.6), a(1), pool);
    var was = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    var bx = Math.round((sx - c.ox / rs) * rs) / rs, by = Math.round((sy - c.oy / rs) * rs) / rs;
    if (b.flip) {
      g.save(); g.translate(sx, 0); g.scale(-1, 1);
      g.drawImage(c, bx - sx, by, c.width / rs, c.height / rs);
      g.restore();
    } else g.drawImage(c, bx, by, c.width / rs, c.height / rs);
    g.imageSmoothingEnabled = was;
  }
  /* Fire and smoke over a wreck. t is milliseconds, so the flames flicker and
     the smoke climbs and drifts; a fixed t gives a still frame. */
  function wreckFire(g, sx, sy, t, seed) {
    var A1 = A, sd = (seed || 0) % 97;
    // smoke first: puffs climbing from the fire, spreading and thinning, leaning downwind
    for (var i = 0; i < 9; i++) {
      var life = ((t / 3400) + i / 9 + sd * 0.013) % 1;
      var px = sx + life * 7 * A1 + Math.sin(life * 5 + i * 2.1) * 1.4 * A1;
      var py = sy - A1 - life * 22 * A1;
      var r = (1.6 + life * 4.2) * A1;
      var al = 0.5 * (1 - life) * Math.min(1, life * 6);
      g.fillStyle = 'rgba(' + (44 + (i % 3) * 8) + ',' + (41 + (i % 3) * 7) + ',' + (38 + (i % 3) * 6) + ',' + al.toFixed(3) + ')';
      g.beginPath(); g.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    }
    // the fire: tongues of flame at the seat of it, each flickering and swaying on its own beat
    function tongue(x, y, w, h, lean, col) {
      g.fillStyle = col; g.beginPath();
      g.moveTo(x - w / 2, y);
      g.quadraticCurveTo(x - w * 0.45, y - h * 0.55, x + lean, y - h);
      g.quadraticCurveTo(x + w * 0.45, y - h * 0.55, x + w / 2, y);
      g.closePath(); g.fill();
    }
    for (var j = 0; j < 5; j++) {
      var ph = t / 90 + j * 1.9 + sd;
      var fx = sx + (j - 2) * 0.8 * A1 + (hash(sd, j, 9) - 0.5) * 0.6 * A1;
      var fh = (1.1 + 1.4 * (0.5 + 0.5 * Math.sin(ph)) + hash(j, sd, 5) * 1.6) * A1;
      var fw = 1.3 * A1, ln = Math.sin(ph * 0.7) * 0.4 * A1;
      tongue(fx, sy, fw, fh, ln, '#c23a1c');
      tongue(fx, sy, fw * 0.66, fh * 0.72, ln * 0.8, '#f08a2c');
      tongue(fx, sy, fw * 0.34, fh * 0.4, ln * 0.5, '#ffe07a');
    }
    g.fillStyle = 'rgba(255,150,60,.16)';             // the glow on the hull round it
    g.beginPath(); g.ellipse(sx, sy - 0.5 * A1, 3.2 * A1, 1.6 * A1, 0, 0, Math.PI * 2); g.fill();
  }
  /* A machine that has lost half its Structure or more is still fighting, but
     it trails smoke: grey puffs from somewhere in the hull, climbing and
     drifting, with no fire under them — that is kept for the wreck. A living
     hull (the swarm's big bugs) does not smoke. */
  function smoking(u) {
    return !!u && (u.cls === 'vehicle' || u.cls === 'aircraft') && !!u.str &&
      u.alive !== false && (u.damage || 0) * 2 >= u.str && !BIGBUG[u.art];
  }
  function damageSmoke(g, sx, sy, t, seed) {
    var A1 = A, sd = (seed || 0) % 89;
    for (var i = 0; i < 7; i++) {
      var life = ((t / 3000) + i / 7 + sd * 0.017) % 1;
      var px = sx + life * 6 * A1 + Math.sin(life * 4 + i * 1.7) * 1.2 * A1;
      var py = sy - life * 18 * A1;
      var r = (1.1 + life * 3.6) * A1;
      var al = 0.42 * (1 - life) * Math.min(1, life * 5);
      var c = 88 + (i % 3) * 14;
      g.fillStyle = 'rgba(' + c + ',' + (c - 2) + ',' + (c - 4) + ',' + al.toFixed(3) + ')';
      g.beginPath(); g.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    }
  }
  function drawWreck(g, u, at, lift, t) {
    var m = drawMachine(g, u, { at: at, lift: lift || 0, status: 'wrecked' });
    var p = toScreen(at.x, at.y);
    var seed = 0, sid = String(u.id || u.code || '');
    for (var q = 0; q < sid.length; q++) seed = (seed * 31 + sid.charCodeAt(q)) | 0;
    var top = p.y - (m.lift || 0) - m.hgt * 0.62;
    if (BIGBUG[u.art]) carcassSteam(g, p.x, p.y - (m.lift || 0) - m.hgt * 0.35, t || 0, Math.abs(seed));
    else wreckFire(g, p.x + a(1), top, t || 0, Math.abs(seed));
    return m;
  }

  /* ================= the parts =================
     The renderer's parts that live in files of their own, installed here —
     after everything they borrow of this closure is declared — each with the
     kit it borrows from, and handing back what the rest of the renderer uses. */
  /* ---------- iso-machines.js: the machines ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ISOMACHINES = window.PMCIsoMachines({
    get BIGBUG() { return BIGBUG; }, get PALETTE() { return PALETTE; }, get XW() { return XW; },
    get R0() { return R0; }, get belt() { return belt; }, get box() { return box; },
    get colour() { return colour; }, get drawBigBug() { return drawBigBug; }, get hex3() { return hex3; },
    get hexA() { return hexA; }, get hexMix() { return hexMix; }, get sp2() { return sp2; },
    get xenoGlow() { return xenoGlow; }, a: a, clamp01: clamp01, dot: dot, ellipse: ellipse,
    ellipseRing: ellipseRing, hash: hash, hull2d: hull2d, poly: poly, rect: rect, rng: rng,
    toScreen: toScreen, ELEV: ELEV, H: H, K: K, PH: PH, RING_VIS: RING_VIS, W: W
  });
  var DRIVE = ISOMACHINES.DRIVE, HULL = ISOMACHINES.HULL, TEX_TILE = ISOMACHINES.TEX_TILE;
  var craftCentreUp = ISOMACHINES.craftCentreUp, drawMachine = ISOMACHINES.drawMachine;
  var flyLift = ISOMACHINES.flyLift, hullCache = ISOMACHINES.hullCache, hullSpec = ISOMACHINES.hullSpec;
  var jetBurn = ISOMACHINES.jetBurn, mountFor = ISOMACHINES.mountFor, mounts = ISOMACHINES.mounts;
  var slab = ISOMACHINES.slab, thickLine = ISOMACHINES.thickLine;

  /* ---------- iso-guns.js: the crew-served guns ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ISOGUNS = window.PMCIsoGuns({
    get PALETTE() { return PALETTE; }, get R0() { return R0; }, get box() { return box; }, a: a,
    ellipse: ellipse, hullSpec: hullSpec, poly: poly, thickLine: thickLine, toScreen: toScreen, K: K, PH: PH,
    W: W
  });
  var FIELD_GUN = ISOGUNS.FIELD_GUN, GUN_CREW = ISOGUNS.GUN_CREW, GUN_K = ISOGUNS.GUN_K;
  var PIECE3D = ISOGUNS.PIECE3D, belt = ISOGUNS.belt, drawPieces3D = ISOGUNS.drawPieces3D;
  var drawTowed = ISOGUNS.drawTowed, fieldGun = ISOGUNS.fieldGun, fieldMuzzle = ISOGUNS.fieldMuzzle;
  var gunFaceL = ISOGUNS.gunFaceL, gunOpts = ISOGUNS.gunOpts, pal2 = ISOGUNS.pal2;
  var pieceAngles = ISOGUNS.pieceAngles, pieceMuzzles3D = ISOGUNS.pieceMuzzles3D;
  var pieceWreck = ISOGUNS.pieceWreck, startTurn = ISOGUNS.startTurn, towedGun = ISOGUNS.towedGun;

  /* ---------- iso-aliens.js: the alien races ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ISOALIENS = window.PMCIsoAliens({
    get KIT() { return KIT; }, get KNEEL_DROP() { return KNEEL_DROP; },
    get PALETTE() { return PALETTE; }, get ROLES() { return ROLES; }, get SPR() { return SPR; },
    get SPRITE_RES() { return SPRITE_RES; }, get SU() { return SU; }, get XENO_LOW() { return XENO_LOW; },
    get sprites() { return sprites; }, get eyeArt() { return eyeArt; },
    get finishFigure() { return finishFigure; }, get hex3() { return hex3; },
    get muzzleArt() { return muzzleArt; }, get paintFigure() { return paintFigure; },
    get podArt() { return podArt; }, get roleAt() { return roleAt; }, get sp2() { return sp2; },
    get vividHex() { return vividHex; }, a: a, dot: dot, ellipse: ellipse, fbm: fbm, hullSpec: hullSpec,
    poly: poly, rng: rng, toScreen: toScreen, A: A, ELEV: ELEV, K: K, PH: PH, W: W
  });
  var BIGBUG = ISOALIENS.BIGBUG, XW = ISOALIENS.XW, animates = ISOALIENS.animates;
  var carcassSteam = ISOALIENS.carcassSteam, cloakFade = ISOALIENS.cloakFade;
  var cloakedKit = ISOALIENS.cloakedKit, drawBigBug = ISOALIENS.drawBigBug, hexA = ISOALIENS.hexA;
  var hexMix = ISOALIENS.hexMix, sprite = ISOALIENS.sprite, xenoGlow = ISOALIENS.xenoGlow;

  /* ---------- iso-troops.js: the troopers ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ISOTROOPS = window.PMCIsoTroops({
    PH: PH, ellipse: ellipse, A: A, K: K, PIXEL: PIXEL, corpses: corpses
  });
  var COLOURS = ISOTROOPS.COLOURS, COLOUR_KEYS = ISOTROOPS.COLOUR_KEYS, GLASS = ISOTROOPS.GLASS;
  var KIT = ISOTROOPS.KIT, KNEEL_DROP = ISOTROOPS.KNEEL_DROP, MODEL = ISOTROOPS.MODEL;
  var PALETTE = ISOTROOPS.PALETTE, ROLES = ISOTROOPS.ROLES, SPR = ISOTROOPS.SPR;
  var SPRITE_RES = ISOTROOPS.SPRITE_RES, SU = ISOTROOPS.SU, XENO_LOW = ISOTROOPS.XENO_LOW;
  var colour = ISOTROOPS.colour, eyeArt = ISOTROOPS.eyeArt, finishFigure = ISOTROOPS.finishFigure;
  var muzzleArt = ISOTROOPS.muzzleArt, paintFigure = ISOTROOPS.paintFigure, podArt = ISOTROOPS.podArt;
  var roleAt = ISOTROOPS.roleAt, setSideColour = ISOTROOPS.setSideColour, sprites = ISOTROOPS.sprites;
  var vividHex = ISOTROOPS.vividHex;

  /* ---------- iso-props.js: the props ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ISOPROPS = window.PMCIsoProps({
    get depthIn() { return depthIn; }, get pebble() { return pebble; }, get spotIn() { return spotIn; },
    get vgrad() { return vgrad; }, a: a, dot: dot, ellipse: ellipse, pal2: pal2, poly: poly, rect: rect,
    rng: rng, slab: slab, toScreen: toScreen, A: A, BAG: BAG, BARK: BARK, BRICK: BRICK, CHAR: CHAR,
    CONCRETE: CONCRETE, K: K, LEAF: LEAF, PIXEL: PIXEL, PREFAB: PREFAB, ROOF: ROOF, STONE: STONE
  });
  var boulder = ISOPROPS.boulder, box = ISOPROPS.box, buildProps = ISOPROPS.buildProps;
  var drawProp = ISOPROPS.drawProp, edgeLine = ISOPROPS.edgeLine;

  /* ---------- iso-ground.js: the ground ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ISOGROUND = window.PMCIsoGround({
    a: a, boulder: boulder, clamp01: clamp01, dot: dot, edgeLine: edgeLine, fbm: fbm, hash: hash, poly: poly,
    rect: rect, rng: rng, toScreen: toScreen, toWorld: toWorld, vnoise: vnoise, A: A, BAYER: BAYER,
    CRUST: CRUST, DEEPW: DEEPW, ELEV: ELEV, GLOW: GLOW, GROUNDS: GROUNDS, H: H, K: K, LIP: LIP, OX: OX,
    OY: OY, PIXH: PIXH, PIXW: PIXW, STONE: STONE, W: W, WATER: WATER
  });
  var R0 = ISOGROUND.R0, bakeGround = ISOGROUND.bakeGround, depthIn = ISOGROUND.depthIn;
  var hex3 = ISOGROUND.hex3, pebble = ISOGROUND.pebble, sp2 = ISOGROUND.sp2, spotIn = ISOGROUND.spotIn;
  var vgrad = ISOGROUND.vgrad;


  root.PMCIso = {
    formationTable: formationTable,
    K: K, ART: A, PIXEL: PIXEL, ELEV: ELEV, PIXW: PIXW, PIXH: PIXH, W: W, H: H, TOP: TOP,
    toScreen: toScreen, toWorld: toWorld,
    animates: animates,
    flush: function () {       // the browser threw our canvases away (a phone backgrounding the tab): paint them again
      // the caches are emptied rather than replaced: the parts hold the same objects
      [sprites, corpses, hullCache, TEX_TILE].forEach(function (c) { for (var k in c) delete c[k]; });
      DIM_CANVAS = null;
    },
    bakeGround: bakeGround, buildProps: buildProps, drawProp: drawProp, drawUnit: drawUnit, muzzles: muzzles, mounts: mounts, mountFor: mountFor,
    flyLift: flyLift, craftCentreUp: craftCentreUp, hullSpec: hullSpec,
    hasPiece: function (art) { return art === 'rebelgun' || !!PIECE3D[art]; },   // a piece left knocked out when its crew is gone
    turnsLikeMachine: function (art) { return !!(PIECE3D[art] || FIELD_GUN[art]); },
    startTurn: startTurn,                     // a crew-served piece's swing onto its target, in ms
    turning: function (u) { return !!(u && u._turn && Date.now() - u._turn.t0 < u._turn.d1 + u._turn.d2); },   // a crew-served piece drawn in 3D, with a facing   // a piece with a knocked-out drawing of its own figureHeight: figureHeight, ROLES: ROLES,
    // a baked figure, for inspecting the art: the canvas and its resolution
    figure: function (side, art, i, pose, step, mount) {
      return sprite(side || 'A', art, i || 0, pose || 'stand', step || 0, MODEL * fitScale(art, i || 0), 0, mount);
    },
    // a machine, drawn on its own onto a canvas, for inspecting the art
    machine: function (g, u, opts) {
      return drawMachine(g, u, opts || {});
    },
    HULL: HULL,
    COLOURS: COLOURS, COLOUR_KEYS: COLOUR_KEYS, PALETTE: PALETTE,
    xenoGlow: function (side) { return xenoGlow(PALETTE[side] || PALETTE.A); },
    colour: colour, setSideColour: setSideColour,
    headroom: function (models, status, unit) {
      // a machine's clearance is its own hull, not a rank of troopers
      if (unit && unit.cls && unit.cls !== 'infantry') return machineTop(unit);
      var n = Math.max(1, Math.min(8, models || 1));
      return headroom(n, statusPose(status, unit && unit.art),
        isArmoured(unit && unit.art));
    },
    ellipse: ellipse, ellipseRing: ellipseRing, poly: poly, tile: tile, rect: rect,
    casualtySpot: casualtySpot, drawBody: drawBody, drawWreck: drawWreck, wreckFire: wreckFire, smoking: smoking, damageSmoke: damageSmoke
  };
})(window);
