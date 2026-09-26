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

  /* ---------- vehicles and aircraft ----------
     A hull is a set of boxes in world inches, rotated to the unit's heading and
     projected, so a machine points wherever it is driving without needing a sprite
     per angle. len / wid are inches; heights are buffer pixels. A trooper stands
     about 55 px, so a tank comes up to chest height with its turret at eye level. */
  var HULL = {
    //                                                       body    upper deck     turret          gun
    wheeled: { axles: 2, len: 1.95, wid: 1.00, hgt: 17, taper: .86, deck: .52, dHgt: 7, turret: .58, tHgt: 11, gun: 1.15, bins: true },
    tank: { axles: 4, len: 2.45, wid: 1.40, hgt: 22, taper: .82, deck: .62, dHgt: 8, turret: .95, tHgt: 15, gun: 1.90, bustle: true, bins: true, cupola: true, smoke: true },
    hunter: { axles: 3, len: 2.15, wid: 1.15, hgt: 17, taper: .80, deck: .5, dHgt: 7, turret: .70, tHgt: 12, gun: 2.00, bins: true, smoke: true },
    destroyer: { axles: 4, len: 2.45, wid: 1.40, hgt: 20, taper: .84, deck: .74, dHgt: 9, fixedGun: 1.95, bins: true, smoke: true },
    truck: { axles: 3, len: 2.20, wid: 1.00, hgt: 14, taper: .9, cab: true, bed: true },
    apc: { axles: 4, len: 2.35, wid: 1.25, hgt: 21, taper: .85, deck: .5, dHgt: 6, turret: .50, tHgt: 9, gun: .90, hatch: true, bins: true, ramp: true },
    engineer: { axles: 4, len: 2.40, wid: 1.40, hgt: 21, taper: .82, deck: .55, dHgt: 8, turret: .78, tHgt: 12, gun: 1.15, fat: true, drum: true, bins: true },
    spg: { axles: 4, len: 2.50, wid: 1.40, hgt: 18, taper: .86, deck: .8, dHgt: 11, turret: 1.00, tHgt: 14, gun: 2.20, elev: 16, spade: true, open: true },
    flak: { axles: 4, len: 2.35, wid: 1.35, hgt: 19, taper: .84, deck: .6, dHgt: 7, turret: .85, tHgt: 12, gun: 1.60, elev: 22, twin: true, dish: true },
    ewcar: { axles: 4, len: 2.30, wid: 1.20, hgt: 19, taper: .86, deck: .52, dHgt: 7, dish: true, hatch: true, bins: true },
    medcar: { axles: 4, len: 2.30, wid: 1.20, hgt: 21, taper: .92, deck: .6, dHgt: 6, cross: true, hatch: true },
    // rotorcraft: cabin, tail boom, main and tail rotors, stub wings
    lifter: { heli: true, len: 1.85, wid: 1.00, hgt: 20, taper: .86, boom: 1.55, rotor: 2.05, blades: 4, fly: 2.3, cabin: true, pylons: 1, skids: true },
    strike: { heli: true, len: 1.95, wid: .78, hgt: 17, taper: .8, boom: 1.65, rotor: 2.15, blades: 4, fly: 2.7, tandem: true, pylons: 2, chin: true, skids: true },
    gunboat: { heli: true, len: 2.15, wid: .92, hgt: 19, taper: .82, boom: 1.75, rotor: 2.35, blades: 5, fly: 2.1, tandem: true, pylons: 3, chin: true, stubs: true, skids: true },

    /* ---- the PMC list, each machine after a real kind of vehicle ----
       `style` says what it is built from (see styledHull/styledTop); the plain
       numbers are still the footprint, and `gun` is kept for the walker, which
       carries the main weapon on its arm. */
    patrol: { axles: 2, len: 1.95, wid: 1.00, hgt: 16, wheelR: 0.7, gun: 1.0, style: { body: 'pickup', pintle: [-0.28, 0], shield: true } },
    acar: { axles: 2, len: 2.05, wid: 1.15, hgt: 20, wheelR: 0.78, gun: 1.0, style: { body: 'car', turret: 'mg', tSize: 0.6, tAt: -0.02 } },
    // the light tank carries its gun and a sidearm, and no missiles to model
    ltank: { axles: 3, len: 2.25, wid: 1.30, hgt: 16, gun: 1.3, style: { body: 'ltank', turret: 'light', tSize: 0.8, gunLen: 1.35, skirts: true } },
    recontank: { axles: 3, len: 2.20, wid: 1.25, hgt: 16, gun: 1.1, style: { body: 'ltank', turret: 'recon', tSize: 0.75, gunLen: 1.2, skirts: true } },
    mbt: { axles: 4, len: 2.50, wid: 1.45, hgt: 18, gun: 1.9, style: { body: 'mbt', turret: 'mbt', tSize: 1.0, gunLen: 2.1, skirts: 'panels' } },
    ftank: { axles: 4, len: 2.60, wid: 1.50, hgt: 18, gun: 2.0, style: { body: 'future', turret: 'future', tSize: 1.05, gunLen: 2.2, skirts: 'panels', plasma: true } },
    lhunt: { axles: 2, len: 2.05, wid: 1.15, hgt: 20, wheelR: 0.78, gun: 1.0, style: { body: 'car', turret: 'missile', tSize: 0.62, tAt: -0.04 } },
    /* Hunters and destroyers are turreted: the rules give them no fixed arc,
       so the long gun has to be able to bear all the way round. */
    thunter: { axles: 3, len: 2.25, wid: 1.30, hgt: 15, gun: 1.2, style: { body: 'ltank', skirts: true, turret: 'missile', tSize: 0.72 } },
    ldest: { axles: 3, len: 2.30, wid: 1.30, hgt: 15, gun: 2.0, style: { body: 'ltank', skirts: true, turret: 'light', tSize: 0.86, gunLen: 2.1, gunW: 2.4 } },
    mdest: { axles: 4, len: 2.55, wid: 1.45, hgt: 17, gun: 2.1, fat: true, style: { body: 'mbt', skirts: 'panels', turret: 'mbt', tSize: 1.0, gunLen: 2.5, gunW: 3.2, tMissiles: true, plasma: true } },
    lorry: { rearDoor: true, axles: 2, len: 2.10, wid: 1.00, hgt: 15, wheelR: 0.72, gun: 0.8, style: { body: 'truck', noGuard: true } },
    hlorry: { rearDoor: true, axles: 3, len: 2.45, wid: 1.10, hgt: 17, wheelR: 0.8, gun: 0.8, style: { body: 'truck', heavy: true, armourBox: true } },
    m113: { rearDoor: true, axles: 3, len: 2.20, wid: 1.20, hgt: 19, gun: 0.9, style: { body: 'box', pintle: [0.06, 0.25], shield: true } },
    ifv: { rearDoor: true, axles: 3, len: 2.35, wid: 1.30, hgt: 18, gun: 1.2, style: { body: 'ifv', turret: 'ifv', tSize: 0.72, tAt: 0.04, tSide: 0.12, skirts: 'panels' } },
    cmdbox: { rearDoor: true, axles: 3, len: 2.20, wid: 1.20, hgt: 19, gun: 0.9, dish: true, style: { body: 'box', aerials: 5, pintle: [0.06, 0.25] } },
    bigapc: { rearDoor: true, axles: 4, len: 2.65, wid: 1.45, hgt: 19, gun: 1.0, style: { body: 'bigbox', rws: true, skirts: 'panels', hexNose: true, hex: true } },
    bigifv: { rearDoor: true, axles: 4, len: 2.65, wid: 1.45, hgt: 19, gun: 1.3, style: { body: 'bigbox', turret: 'ifv', tSize: 0.8, tAt: 0.06, skirts: 'panels', hexNose: true, hex: true } },
    engflame: { axles: 4, len: 2.45, wid: 1.45, hgt: 18, gun: 1.1, fat: true, drum: true, style: { body: 'mbt', turret: 'flamer', tSize: 0.95, rearTank: true, skirts: 'panels' } },
    enghow: { axles: 4, len: 2.50, wid: 1.45, hgt: 18, gun: 1.3, fat: true, mech: 'heavy', style: { body: 'mbt', skirts: 'panels', turret: 'howitzer', tSize: 1.05, plasma: true, hexNose: true, hex: true } },
    techmrl: { axles: 2, len: 2.00, wid: 1.00, hgt: 16, wheelR: 0.7, gun: 1.0, elev: 10, style: { body: 'pickup', mrl: true } },
    calliope: { axles: 3, len: 2.30, wid: 1.30, hgt: 16, gun: 1.6, elev: 16, style: { body: 'ltank', turret: 'arty', tSize: 0.9, tAt: -0.1, skirts: true } },
    mlrs: { axles: 3, len: 2.45, wid: 1.30, hgt: 17, gun: 1.2, elev: 14, style: { body: 'mlrs', mlrs: true } },
    /* The advanced support vehicle: an energy howitzer — a short, fat Gauss
       barrel laid well up out of a boxy turret, the charge burning blue in it. */
    plasmatank: { axles: 4, len: 2.55, wid: 1.50, hgt: 18, gun: 1.2, fat: true, style: { body: 'mbt', turret: 'arty', tSize: 1.05, gunLen: 1.0, stubGun: true, energyGun: true, skirts: 'panels' } },
    aatank: { axles: 3, len: 2.30, wid: 1.30, hgt: 16, gun: 1.3, twin: true, elev: 16, dish: true, style: { body: 'ltank', turret: 'aa', tSize: 0.85, skirts: true } },
    ewtank: { axles: 3, len: 2.25, wid: 1.25, hgt: 16, gun: 0.9, dish: true, style: { body: 'ltank', turret: 'dish', tSize: 0.72, skirts: true } },
    medbox: { rearDoor: true, axles: 3, len: 2.25, wid: 1.25, hgt: 20, gun: 0.8, cross: true, style: { body: 'box', cross: true, aerials: 1 } },
    /* Rebel gun trucks: a light, medium and heavy lorry plated up in a yard,
       slits cut in a sheet welded over the windscreen, mismatched plate round
       the bed, and a weapon bolted on behind the cab. */
    gtlight: { axles: 2, len: 2.10, wid: 1.00, hgt: 15, wheelR: 0.72, gun: 1.2, style: { body: 'guntruck', bedGun: 'auto', gunAt: -0.22 } },
    gtmed: { axles: 2, len: 2.30, wid: 1.05, hgt: 16, wheelR: 0.76, gun: 1.2, style: { body: 'guntruck', bedGun: 'mg', gunAt: -0.1, bedRack: true, rackAt: -0.34 } },
    gtheavy: { axles: 3, len: 2.55, wid: 1.12, hgt: 17, wheelR: 0.8, gun: 1.4, style: { body: 'guntruck', heavy: true, bedGun: 'auto', gunAt: -0.05, bedRack: true, rackAt: -0.34 } },
    // rebel troop trucks: the same yard-plated lorries, the bed walled up to carry a squad
    // the rebel transports: a welded troop box on the back, the gun on its roof
    ttlight: { axles: 2, len: 2.15, wid: 1.00, hgt: 15, wheelR: 0.72, gun: 1.0, style: { body: 'guntruck', enclosed: true, bedGun: 'mg', gunAt: -0.2 } },
    ttmed: { axles: 3, len: 2.65, wid: 1.15, hgt: 17, wheelR: 0.8, gun: 1.2, style: { body: 'guntruck', heavy: true, enclosed: true, bedGun: 'auto', gunAt: -0.12 } },
    // the super-heavy: a bigger, square cab-over lorry
    ttheavy: { axles: 4, len: 3.05, wid: 1.32, hgt: 19, wheelR: 0.84, gun: 1.4, style: { body: 'guntruck', heavy: true, enclosed: true, flatCab: true, bedGun: 'auto', gunAt: -0.1 } },
    // rebel flak: an AA mount on whatever will carry it
    aatech: { axles: 2, len: 2.00, wid: 1.00, hgt: 16, wheelR: 0.7, gun: 1.2, twin: true, elev: 16, style: { body: 'pickup', turret: 'aa', tSize: 0.62, tAt: -0.28, noMissiles: true } },
    aacar: { axles: 2, len: 2.05, wid: 1.15, hgt: 20, wheelR: 0.78, gun: 1.2, twin: true, elev: 16, style: { body: 'car', turret: 'aa', tSize: 0.7, tAt: -0.02, noMissiles: true } },
    aaheavy: { axles: 4, len: 2.50, wid: 1.45, hgt: 18, gun: 1.4, twin: true, elev: 16, dish: true, style: { body: 'mbt', turret: 'aa', tSize: 0.95, skirts: 'panels', noMissiles: true } },
    // fliers: every one of them on shrouded fans
    civcraft: { len: 1.75, wid: 0.95, hgt: 16, fly: 2.3, craft: 'civ', gun: 1.0 },
    hawk: { len: 2.25, wid: 0.72, hgt: 16, fly: 2.4, craft: 'hawk', gun: 1.0 },
    chinook: { len: 2.65, wid: 0.90, hgt: 18, fly: 2.3, craft: 'chinook', gun: 1.0 },
    // the rebels' armed heavy shuttle: the same lifter with winglets on its flanks
    chinookwl: { len: 2.65, wid: 0.90, hgt: 18, fly: 2.3, craft: 'chinook', gun: 1.0, winglets: true },
    chinookcp: { len: 2.65, wid: 0.90, hgt: 18, fly: 2.4, craft: 'chinookcp', gun: 1.0, dish: true, winglets: true },
    // the PMC strike craft have one pilot under one canopy
    apache: { len: 2.20, wid: 0.62, hgt: 13, fly: 2.7, craft: 'apache', gun: 1.0, singleCab: true },
    hind: { len: 2.40, wid: 0.72, hgt: 16, fly: 2.5, craft: 'hind', gun: 1.0, singleCab: true },
    apacherk: { len: 2.30, wid: 0.64, hgt: 14, fly: 2.2, craft: 'apacherk', gun: 1.0 },
    hindrk: { len: 2.50, wid: 0.74, hgt: 17, fly: 2.3, craft: 'hindrk', gun: 1.0 },
    // armed shuttles: the same airframes, with the pods left off
    apachenp: { len: 2.20, wid: 0.62, hgt: 13, fly: 2.6, craft: 'apache', noPods: true, gun: 1.0 },
    hindnp: { len: 2.40, wid: 0.72, hgt: 16, fly: 2.4, craft: 'hind', noPods: true, gun: 1.0 },
    jet: { len: 2.70, wid: 0.72, hgt: 9, fly: 3.2, craft: 'jet', gun: 1.0 },
    // the Light VTOL drone: a small flying disc with swept winglets and a scanner pod under its lip
    vtoldrone: { len: 1.1, wid: 1.1, hgt: 8, fly: 2.8, craft: 'disc', gun: 0.6 },
    // the advanced strike craft: a stealth gunship, faceted, its weapons carried inside, a fan in its fin
    comanche: { len: 2.45, wid: 0.60, hgt: 12, fly: 2.7, craft: 'comanche', noPods: true, gun: 1.0 },
    hybrid: { len: 2.45, wid: 0.72, hgt: 11, fly: 2.8, craft: 'hybrid', gun: 1.0 },

    /* ---- improvised rebel hulls (pp. 105-108) ----
       Civilian running gear with a weapon bolted to the bed, industrial machines
       plated up in a yard, and shuttles that were flying cargo last month. */
    technical: { axles: 2, len: 2.00, wid: .95, hgt: 13, taper: .92, cab: true, bed: true, deck: .38, dHgt: 5, turret: .44, tHgt: 9, gun: 1.30, elev: 8, open: true },
    improvised: { axles: 4, len: 2.35, wid: 1.40, hgt: 20, taper: .90, deck: .58, dHgt: 8, turret: .62, tHgt: 10, gun: 1.30, fat: true, drum: true, spade: true, bins: true },
    rtruck: { axles: 3, len: 2.30, wid: 1.05, hgt: 15, taper: .92, cab: true, bed: true, bins: true },
    rflak: { axles: 3, len: 2.20, wid: 1.05, hgt: 14, taper: .90, cab: true, bed: true, deck: .48, dHgt: 5, turret: .55, tHgt: 8, gun: 1.55, elev: 24, twin: true, open: true },
    shuttle: { heli: true, len: 2.05, wid: 1.05, hgt: 21, taper: .90, boom: 1.30, rotor: 1.90, blades: 3, fly: 2.2, cabin: true, pylons: 1, skids: true },
    craneship: { heli: true, len: 1.95, wid: .88, hgt: 16, taper: .88, boom: 1.95, rotor: 2.55, blades: 6, fly: 2.6, cabin: true, skids: true },
    /* A Rapid insertion platform (p. 79): a drop pod half buried where it landed,
       with its petals blown open and nothing to drive it anywhere. No wheels, no
       turret, no gun — scorched plate and an open door. */
    pod: { axles: 0, len: 0.94, wid: 0.90, hgt: 17, taper: .50, drop: true },
    // the Overgrown bugs: no hull at all, but a footprint and a height for the table
    bugfirebeetle: { len: 2.2, wid: 1.3, hgt: 44, bug: true },
    bugsandworm: { len: 1.8, wid: 1.2, hgt: 84, bug: true },
    bugbioplasma: { len: 2.2, wid: 1.3, hgt: 66, bug: true },
    bugshadow: { len: 1.8, wid: 1.0, hgt: 96, bug: true },
    bugqueen: { len: 2.6, wid: 1.6, hgt: 92, bug: true },
    bugcarrier: { len: 2.4, wid: 1.4, hgt: 48, fly: 2.2, bug: true },
    // the Xenotripods' triangular craft and their turrets
    xstrike: { len: 2.2, wid: 2.0, hgt: 12, fly: 2.4, xeno: true },
    xstrikehg: { len: 2.4, wid: 2.3, hgt: 12, fly: 2.4, xeno: true },
    xstrikeadv: { len: 2.6, wid: 2.5, hgt: 14, fly: 2.4, xeno: true },
    xrecon: { len: 1.7, wid: 1.5, hgt: 10, fly: 2.8, xeno: true },
    xtelecraft: { len: 2.2, wid: 2.1, hgt: 12, fly: 2.2, xeno: true },
    xshieldcraft: { len: 2.1, wid: 2.1, hgt: 14, fly: 2.3, xeno: true },
    xturret: { len: 1.0, wid: 1.0, hgt: 44, xeno: true },
    xteleturret: { len: 1.1, wid: 1.1, hgt: 40, xeno: true },
    xshieldturret: { len: 1.0, wid: 1.0, hgt: 36, xeno: true }
  };

  /* the whole hull set is drawn a little under life size, to match the troopers */
  var MACHINE = 0.82, MACHINE_H = 0.86, hullCache = {};
  var INCHES = { len: 1, wid: 1, gun: 1, fixedGun: 1, boom: 1, rotor: 1, turret: 1 };
  var PIXELS = { hgt: 1, dHgt: 1, tHgt: 1, elev: 1 };
  function hullSpec(art) {
    if (hullCache[art]) return hullCache[art];
    var base = HULL[art] || HULL.wheeled, out = {};
    for (var k in base) {
      if (INCHES[k]) out[k] = base[k] * MACHINE;
      else if (PIXELS[k]) out[k] = Math.max(2, Math.round(base[k] * MACHINE_H));
      else out[k] = base[k];
    }
    out.ride = 0;                                     // set by the propulsion
    return (hullCache[art] = out);
  }

  /* Running gear. Each propulsion decides how high the hull rides and what is
     drawn underneath it, so any hull can take any drive. */
  var DRIVE = {
    wheeled: { ride: 13 },
    tracked: { ride: 8 },
    walker: { ride: 26 },
    grav: { ride: 13 },
    hover: { ride: 9 }
  };
  // no optional propulsion ('none'): the hull is drawn on the running gear it usually goes to war on
  function driveOf(u) {
    var d = u && u.prop;
    if ((!d || d === 'none') && u && u.cls === 'vehicle' && window.PMC && window.PMC.lookDrive) d = window.PMC.lookDrive(u);
    return DRIVE[d] ? d : (u && u.cls === 'vehicle' ? 'wheeled' : null);
  }

  // the four corners of a rotated rectangle, in world inches
  function hullCorners(x, y, len, wid, f) {
    var c = Math.cos(f), s = Math.sin(f), L = len / 2, W = wid / 2;
    return [
      [x + c * L - s * W, y + s * L + c * W],          // nose left
      [x + c * L + s * W, y + s * L - c * W],          // nose right
      [x - c * L + s * W, y - s * L - c * W],          // tail right
      [x - c * L - s * W, y - s * L + c * W]           // tail left
    ];
  }
  function project(pts, lift) {
    return pts.map(function (q) {
      var p = toScreen(q[0], q[1]);
      return [p.x, p.y - (lift || 0)];
    });
  }
  function centroid(pts) {
    var x = 0, y = 0;
    for (var i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / pts.length, y / pts.length];
  }
  // a box standing on the ground: shaded sides, then the lit top
  function slab(g, pts, lift, h, sideDark, sideLit, top) {
    return taper(g, pts, pts, lift, h, sideDark, sideLit, top);
  }
  /* A box whose top footprint differs from its base, so the flanks slope. This is
     what keeps the hulls from reading as plain cuboids. */
  /* A tapered box: the unit every hull, deck and turret is built from. Each
     visible face is filled flat, then — when drawn smooth — given what a
     painted model would have: the face lighter at the top where it meets the
     sky and darker where it meets the ground, a catch-light along the upper
     edge where two panels meet, and a hard dark line where it sits on
     whatever is below. That alone turns a projected slab into a machined
     shape, on every machine at once. */
  function taper(g, lo, hi, lift, h, sideDark, sideLit, top) {
    var base = project(lo, lift), roof = project(hi, lift + h);
    var c = centroid(base), cx = c[0], cy = c[1];
    for (var i = 0; i < 4; i++) {
      var a1 = base[i], b1 = base[(i + 1) % 4];
      if ((a1[1] + b1[1]) / 2 < cy) continue;          // facing away
      var lit = (a1[0] + b1[0]) / 2 <= cx;
      var face = [a1, b1, roof[(i + 1) % 4], roof[i]];
      poly(g, face, lit ? sideLit : sideDark);
      if (PH.smooth && h > 1.5) {
        var yT = Math.min(face[2][1], face[3][1]), yB = Math.max(a1[1], b1[1]);
        var gr = g.createLinearGradient(0, yT, 0, yB);
        gr.addColorStop(0, 'rgba(255,246,228,' + (lit ? 0.16 : 0.07) + ')');
        gr.addColorStop(0.5, 'rgba(0,0,0,0)');
        gr.addColorStop(1, 'rgba(6,8,12,' + (lit ? 0.22 : 0.3) + ')');
        poly(g, face, gr);
        edge(g, roof[i], roof[(i + 1) % 4], 'rgba(255,240,214,' + (lit ? 0.55 : 0.28) + ')', 0.7);
        edge(g, a1, b1, 'rgba(4,6,10,.55)', 0.7);
      }
    }
    if (top) {
      poly(g, roof, top);
      if (PH.smooth && roof.length === 4) {
        // the top, lit from the far north-west corner
        var ys = roof.map(function (q) { return q[1]; });
        var gt = g.createLinearGradient(0, Math.min.apply(null, ys), 0, Math.max.apply(null, ys));
        gt.addColorStop(0, 'rgba(255,248,232,.14)');
        gt.addColorStop(1, 'rgba(0,0,0,.08)');
        poly(g, roof, gt);
      }
    }
    return roof;
  }
  // a fine line between two projected points, for bevels and seams
  function edge(g, a, b, c, w) {
    g.strokeStyle = c;
    g.lineWidth = w || 0.7;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }
  // a panel line along the flank that catches the light
  function bandOnSides(g, pts, lift, h, thick, colour) {
    var base = project(pts, lift), roof = project(pts, lift + h);
    var c = centroid(base), cx = c[0], cy = c[1];
    for (var i = 0; i < 4; i++) {
      var a1 = base[i], b1 = base[(i + 1) % 4];
      if ((a1[1] + b1[1]) / 2 < cy) continue;
      if ((a1[0] + b1[0]) / 2 > cx) continue;          // lit flank only
      var t = roof[i], u2 = roof[(i + 1) % 4];
      poly(g, [t, u2, [u2[0], u2[1] + thick], [t[0], t[1] + thick]], colour);
    }
  }
  // a line with thickness, drawn on the pixel grid
  function thickLine(g, x0, y0, x1, y1, w, c) {
    if (PH.smooth) {                                      // a machine's part: a true stroke, not stair-steps
      g.save(); g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
      return;
    }
    var steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    g.fillStyle = c;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      g.fillRect(Math.round(x0 + (x1 - x0) * t - w / 2), Math.round(y0 + (y1 - y0) * t - w / 2), w, w);
    }
  }

  /* How high a flier's hull hangs above the point it stands on. The game needs
     this to aim shots at the airframe rather than at the grass beneath it; a
     ground hull sits on its own ground, so it answers nothing. */
  /* How high over its ground a craft's middle is drawn — where a line to it (a
     teleport link) should meet it. A tri-wing's axis rides above its stand. */
  function craftCentreUp(u) {
    if (!u || !u.art) return 0;
    var hs = hullSpec(u.art), x3 = XENO3D[u.art];
    var fly = hs && hs.fly ? ELEV * hs.fly : 0;
    if (x3 && x3.kind === 'craft') return fly + ((x3.span || 0.7) * Math.sin((x3.droop || 40) * Math.PI / 180) + 0.04) * K * 0.9;
    return fly + ((hs && hs.hgt) || 12) * 0.5;
  }
  function flyLift(u) {
    if (!u || !u.art) return 0;
    var spec = hullSpec(u.art);
    return spec && spec.fly ? ELEV * spec.fly : 0;
  }

  /* The burn under a jump trooper: a short bright cone at the pack, a plume of
     exhaust under it, and the dust it kicks off the ground. */
  function jetBurn(g, x, y, w, h, step, high) {
    // its shadow on the ground, smaller and fainter the higher it goes
    var fade = high ? Math.max(0.35, 1 - high / (K * 4)) : 1;
    ellipse(g, x, y, w * 2.6 * fade, w * 1.3 * fade, 'rgba(12,10,8,' + (0.22 * fade).toFixed(3) + ')');
    // high up, the burn is a short plume under the pack, not a pillar to the ground
    var tail = Math.min(h, a(4.8)) * (step ? 0.8 : 0.62);
    rect(g, x - w * 0.5, y - h + 1, w, tail, 'rgba(255,196,110,.5)');
    rect(g, x - w * 0.25, y - h + 1, w * 0.5, tail * 0.8, 'rgba(255,240,206,.75)');
    for (var i = 0; i < 3; i++) {
      var d = tail * (0.5 + i * 0.35);
      ellipse(g, x + (i % 2 ? w * 0.6 : -w * 0.5), y - h + d,
        w * (0.7 + i * 0.4), w * (0.5 + i * 0.3),
        'rgba(198,190,178,' + (0.3 - i * 0.08) + ')');
    }
  }

  /* Where a machine's weapons end: drawn once into a scratch canvas with the
     mounts being recorded, and returned as screen offsets from the ground point
     under it, keyed by kind — 'gun', 'auto', 'mg', 'missile', 'rocket', 'flame',
     'rail'. Fliers include their height, so a shot leaves the airframe. */
  var mountCanvas = null;
  function mounts(u) {
    if (!u || (u.cls !== 'vehicle' && u.cls !== 'aircraft')) return {};
    if (!mountCanvas) { mountCanvas = document.createElement('canvas'); mountCanvas.width = mountCanvas.height = 1; }
    PH.mounts = {};
    try { drawMachine(mountCanvas.getContext('2d'), u, { at: { x: u.x, y: u.y }, lift: 0 }); }
    finally { var out = PH.mounts; PH.mounts = null; }
    return out;
  }

  // which mount a weapon style fires from, most likely first
  var MOUNT_PREF = {
    small: ['mg', 'auto', 'gun'], pistol: ['mg', 'auto', 'gun'], smg: ['mg', 'auto', 'gun'],
    burst: ['mg', 'auto', 'gun'], chain: ['auto', 'gun', 'mg'],
    /* A heavy round falls back to a wing pod last of all: a strike craft with
       no gun but a pod under each wing puts one round out of each. */
    shell: ['gun', 'auto', 'rail', 'mg', 'missile'], shellbig: ['gun', 'rail', 'auto', 'missile'],
    rail: ['rail', 'gun', 'auto'],
    missile: ['missile', 'rocket', 'gun'], rocket: ['rocket', 'missile', 'gun'],
    arc: ['rocket', 'gun'], arcbig: ['rocket', 'gun'], flame: ['flame', 'gun'],
    energy: ['mg', 'gun', 'auto'], orb: ['rocket', 'gun', 'missile'],
    orbbig: ['gun', 'rocket', 'missile']
  };
  /* What a walker's arm carries for each weapon style: the barrel a shot comes
     out of is the barrel that looks like it fires it. Each of these registers
     the muzzle mount its style asks for above. */
  // a salvo weapon rides on the shoulder instead of being held in an arm
  var SHOULDER_STYLE = { arc: 'rocket', arcbig: 'rocket' };
  var ARM_FOR = {
    pistol: 'mg', small: 'mg', smg: 'mg', burst: 'mg', chain: 'auto',
    shell: 'cannon', shellbig: 'bigcannon', rail: 'rail', flame: 'flame',
    arc: 'rocket', arcbig: 'rocket', rocket: 'rocket', missile: 'missile',
    spit: 'auto', spitbig: 'auto', spine: 'auto', energy: 'plasma', orb: 'plasma', orbbig: 'howitzer',
    none: 'none'
  };
  // one cell of a machine's digital camouflage, in inches
  var CELL = 0.14;
  /* How far a styled craft's wings or fans reach, as a multiple of the hull
     width — what it lays on the ground when it flies over. */
  var CRAFT_SPAN = {
    jet: 2.9, hybrid: 3.4, comanche: 2.5, apache: 2.6, apacherk: 2.6, hind: 2.8, hindrk: 2.8,
    civ: 1.9, hawk: 1.2, chinook: 1.2, chinookcp: 2.1
  };
  /* A volley takes the muzzles in turn, so they are handed over left, right,
     left — a craft with a pod under each wing fires one round from each rather
     than emptying the near one. */
  function sideByside(list) {
    var left = [], right = [];
    list.forEach(function (m) { (m.dx < 0 ? left : right).push(m); });
    if (!left.length || !right.length) return list;
    var out = [];
    for (var i = 0; i < Math.max(left.length, right.length); i++) {
      if (left[i]) out.push(left[i]);
      if (right[i]) out.push(right[i]);
    }
    return out;
  }
  function mountFor(M, style, u, base) {
    var kinds = MOUNT_PREF[style] || ['gun', 'mg'];
    for (var i = 0; i < kinds.length; i++) {
      var list = M && M[kinds[i]];
      if (list && list.length) {
        var pool = list.length > 1 ? sideByside(list) : list;
        return { x: u.x, y: u.y, up: 0, mz: pool[0], pool: pool };
      }
    }
    return base;
  }

  /* ---------- Xenotripod craft and turrets ----------
     Built in the world like the Overgrown bugs, so they turn to every facing:
     the craft are tri-wings, a slim ivory fuselage with three swept blades set
     about it, the army's colour burning along the leading edges and in a core
     underneath; the turrets are
     pylons on tripod feet — a crystal emitter, a ring gate, a shield dish. */
  var XENO3D = {
    // tri-wing craft: L the fuselage's half length, span the lower wings' reach and
    // fin the dorsal wing's against it, le and tip where the root and the tip sit
    // along the fuselage (a larger le is a broader wing), rad its girth, droop the anhedral
    xstrike: { kind: 'craft', L: 0.95, span: 0.72, fin: 1.1, le: 0.12, tip: -0.86, rad: 0.09 },
    xstrikehg: { kind: 'craft', L: 1.05, span: 0.78, fin: 1.1, le: 0.18, tip: -0.84, rad: 0.1, prongs: 1 },
    xstrikeadv: { kind: 'craft', L: 1.15, span: 0.86, fin: 1.05, le: 0.34, tip: -0.78, rad: 0.11, droop: 36, prongs: 2 },
    // the support craft carry only a token gun: what they are for is what shows
    xrecon: { kind: 'craft', L: 0.72, span: 0.6, fin: 1.3, le: 0.05, tip: -0.92, rad: 0.07, droop: 46, scan: true, support: true },
    xtelecraft: { kind: 'craft', L: 0.95, span: 0.74, fin: 1.1, le: 0.14, tip: -0.84, rad: 0.1, ring: true, support: true },
    xshieldcraft: { kind: 'craft', L: 0.92, span: 0.7, fin: 1.0, le: 0.24, tip: -0.78, rad: 0.12, droop: 44, shield: true, support: true },
    xturret: { kind: 'turret' },
    xteleturret: { kind: 'portal' },
    xshieldturret: { kind: 'shield' }
  };
  function drawXenoMachine(g, u, opts) {
    var spec = XENO3D[u.art], hs = hullSpec(u.art);
    function m(n) { return Math.max(1, n * 1.6); }   // hull pixels, on the machines' own scale
    var at = opts.at || u;
    var dead = opts.status === 'wrecked' || u.alive === false;
    var f = u.facing == null ? 0 : u.facing, cos = Math.cos(f), sin = Math.sin(f);
    var base = (opts.lift || 0) - (opts.hop || 0);
    var fly = hs.fly && !dead ? ELEV * hs.fly : 0;
    var lift = base + fly;
    var pal = PALETTE[u.paint || u.side] || PALETTE.A;
    var WH = dead ? { lt: '#6e6a62', md: '#5c5952', dk: '#45423d', sh: '#302e2a', seam: '#1e1d1a' } : XW;
    // turrets burn the tribe's blue energy whatever colours it wears; the craft carry the army colour
    var gc1 = spec.kind === 'craft' ? xenoGlow(pal) : '#6ebeff';
    var GLO = dead ? { m: '#3e3c38', l: '#4a4843', h: 'rgba(0,0,0,0)' } : { m: gc1, l: hexMix(gc1, '#ffffff', 0.55), h: hexA(gc1, 0.28), a: hexA(gc1, 0.5) };
    var tnow = root.performance ? performance.now() : 0;
    function Wd(t, s2) { return { x: at.x + cos * t - sin * s2, y: at.y + sin * t + cos * s2 }; }
    function S(t, s2, z) { var w = Wd(t, s2), q = toScreen(w.x, w.y); return [q.x, q.y - base - z]; }
    function path(pts, c) { poly(g, pts, c); }
    function stroke(pts, w, c, close) {
      g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      if (close) g.closePath();
      g.stroke();
    }
    function halo(p, r, c) { ellipse(g, p[0], p[1], r, r * 0.8, c); }
    var gp = toScreen(at.x, at.y); gp.y -= base;
    function mountAt(kind, p) {
      if (!PH.mounts) return;
      (PH.mounts[kind] = PH.mounts[kind] || []).push({ dx: p[0] - gp.x, dy: p[1] - gp.y - (opts.lift || 0) + base, dir: (cos - sin) >= 0 ? 1 : -1 });
    }
    // a vertical prism of n faces, from z0 to z1, radius r0 tapering to r1
    function prism(n, r0, r1, z0, z1, T, t0, s0) {
      t0 = t0 || 0; s0 = s0 || 0;
      var faces = [];
      for (var i = 0; i < n; i++) {
        var a0 = (i / n) * Math.PI * 2 + f, a1 = ((i + 1) / n) * Math.PI * 2 + f, am = (a0 + a1) / 2;
        var nx = Math.cos(am), ny = Math.sin(am);
        if (nx + ny <= -0.05) continue;               // facing away from the eye
        var lit = (-nx * 0.6 + ny * 0.2);             // the light comes from the left
        var col = lit > 0.25 ? T.lt : lit > -0.25 ? T.md : T.dk;
        var b0 = toScreen(at.x + Math.cos(a0) * r0 + cos * t0 - sin * s0, at.y + Math.sin(a0) * r0 + sin * t0 + cos * s0);
        var b1 = toScreen(at.x + Math.cos(a1) * r0 + cos * t0 - sin * s0, at.y + Math.sin(a1) * r0 + sin * t0 + cos * s0);
        var c0 = toScreen(at.x + Math.cos(a0) * r1 + cos * t0 - sin * s0, at.y + Math.sin(a0) * r1 + sin * t0 + cos * s0);
        var c1 = toScreen(at.x + Math.cos(a1) * r1 + cos * t0 - sin * s0, at.y + Math.sin(a1) * r1 + sin * t0 + cos * s0);
        faces.push({ d: nx + ny, pts: [[b0.x, b0.y - base - z0], [b1.x, b1.y - base - z0], [c1.x, c1.y - base - z1], [c0.x, c0.y - base - z1]], col: col });
      }
      faces.sort(function (p1, p2) { return p1.d - p2.d; }).forEach(function (fc) {
        path(fc.pts, fc.col);
        stroke(fc.pts, 1, WH.seam, true);
      });
      // the top cap
      var cap = [];
      for (var k = 0; k < n; k++) {
        var ak = (k / n) * Math.PI * 2 + f;
        var q = toScreen(at.x + Math.cos(ak) * r1 + cos * t0 - sin * s0, at.y + Math.sin(ak) * r1 + sin * t0 + cos * s0);
        cap.push([q.x, q.y - base - z1]);
      }
      path(cap, T.lt); stroke(cap, 1, WH.seam, true);
    }
    function tripodFeet(r, z) {
      for (var i = 0; i < 3; i++) {
        var a2 = f + i * Math.PI * 2 / 3 + 0.5;
        var ft = toScreen(at.x + Math.cos(a2) * r, at.y + Math.sin(a2) * r);
        var kn = toScreen(at.x + Math.cos(a2) * r * 0.75, at.y + Math.sin(a2) * r * 0.75);
        stroke([[gp.x, gp.y - z], [kn.x, kn.y - base - z * 0.7], [ft.x, ft.y - base]], m(2.4), WH.seam);
        stroke([[gp.x, gp.y - z], [kn.x, kn.y - base - z * 0.7], [ft.x, ft.y - base]], m(1.5), WH.dk);
        ellipse(g, kn.x, kn.y - base - z * 0.7, m(1), m(0.9), GLO.m);
      }
    }

    if (spec.kind === 'craft') {
      /* A tri-wing: a slender ivory fuselage with three tall, thin, swept wings
         set about it like an inverted Y — one standing straight up off the spine,
         two thrown down and out beneath, a shuttle's folded wings with a third.
         The wings are flat plates turned about the fuselage axis, so they cross
         and hide one another properly at every facing; the army's colour burns
         along their leading edges, and the intakes and the drive glow blue. */
      var Lc = spec.L, z0 = fly + (dead ? 1 : 0);
      var BLU = dead ? { m: '#3e3c38', l: '#4a4843', h: 'rgba(0,0,0,0)' } : { m: '#6ebeff', l: '#e4f4ff', h: 'rgba(110,190,255,.3)' };
      var ZK = K * 0.9;                                          // pixels to an inch of height
      var rad = spec.rad || 0.09, span = spec.span, dr = (spec.droop || 40) * Math.PI / 180;
      // the axis rides high enough that the lower wingtips just clear the stand
      var zc = z0 + (span * Math.sin(dr) + 0.04) * ZK;
      var T3 = [cos, sin, 0], EYE = [0.612, 0.612, 0.5];       // along the fuselage; towards the eye
      function dot3(p, q) { return p[0] * q[0] + p[1] * q[1] + p[2] * q[2]; }
      // out from the axis at roll ph (0 is to starboard, up is PI / 2), in world inches
      function roll(ph) { return [-sin * Math.cos(ph), cos * Math.cos(ph), Math.sin(ph)]; }
      // a point t along the axis and r out from it at roll ph, on the screen
      function P3(t, r, ph) { return S(t, r * Math.cos(ph), zc + r * Math.sin(ph) * ZK); }
      // a face's colour: its normal turned to the eye, lit from the upper left
      function shade(n) {
        var l = Math.sqrt(dot3(n, n)) || 1;
        if (dot3(n, EYE) < 0) l = -l;
        var v = (-0.55 * n[0] + 0.2 * n[1] + 0.8 * n[2]) / l;
        return v > 0.5 ? WH.lt : v > 0.1 ? WH.md : v > -0.3 ? WH.dk : WH.sh;
      }
      var tail = -0.8 * Lc, rf = rad * 0.8;
      // the three wings: [roll, span, root leading edge, tip, trailing crank] in inches
      var WINGS = [[Math.PI / 2, span * (spec.fin || 1.15)], [-dr, span], [Math.PI + dr, span]].map(function (w) {
        return { ph: w[0], sp: w[1], dorsal: w[0] === Math.PI / 2, d: dot3(roll(w[0]), EYE) };
      }).sort(function (p1, p2) { return p1.d - p2.d; });    // far to near
      function wing(w) {
        var le = (spec.le || 0.3) * Lc, tp = (spec.tip || -0.72) * Lc;
        var pts = [P3(le, rf, w.ph), P3(tp, w.sp, w.ph), P3(tail * 0.62, w.sp * 0.3, w.ph), P3(tail * 0.8, rf, w.ph)];
        var n = [T3[1] * roll(w.ph)[2], -T3[0] * roll(w.ph)[2], T3[0] * roll(w.ph)[1] - T3[1] * roll(w.ph)[0]];
        path(pts, shade(n)); stroke(pts, 1, WH.seam, true);
        // a panel line inboard of the leading edge
        stroke([P3(le * 0.3, rf, w.ph), P3(tp * 0.92, w.sp * 0.82, w.ph)], 1, WH.dk);
        // the blade at the tip, reaching forward: the strike craft's weapon pylons
        if (spec.prongs && (!w.dorsal || spec.prongs > 1)) {
          var bl = [P3(tp, w.sp, w.ph), P3(tp + 0.42 * Lc, w.sp * 0.94, w.ph), P3(tp * 0.7, w.sp * 0.7, w.ph)];
          path(bl, WH.lt); stroke(bl, 1, WH.seam, true);
          stroke([bl[0], bl[1]], m(0.7), GLO.m);
          if (!dead) ellipse(g, bl[1][0], bl[1][1], m(0.8), m(0.7), GLO.l);
          if (!dead && !w.dorsal) mountAt('rocket', bl[1]);
        }
        stroke([pts[0], pts[1]], m(0.8), GLO.m);                 // the leading edge
        if (!dead) ellipse(g, pts[1][0], pts[1][1], m(0.9), m(0.8), GLO.l);
        /* A drone's aerial — and the teleport craft's, which steers its gate by it: one
           whip off the top edge of the dorsal wing, raked at the wing's own sweep, a blue
           light at its tip that blinks about once a second. */
        if ((u.drone || spec.ring) && w.dorsal && !dead) {
          var k8 = 0.78, at0 = le + (tp - le) * k8, r0 = rf + (w.sp - rf) * k8;
          var a0 = P3(at0, r0, w.ph), a1 = P3(at0 + (tp - le) * 0.42, r0 + (w.sp - rf) * 0.42, w.ph);
          stroke([a0, a1], 1.6, WH.dk);
          stroke([a0, a1], 0.8, WH.lt);
          var blueOn = Math.floor(tnow / 500) % 2 === 0;
          if (blueOn) ellipse(g, a1[0], a1[1], 3.8, 3.8, 'rgba(110,190,255,.3)');
          ellipse(g, a1[0], a1[1], 1.9, 1.9, blueOn ? '#6ebeff' : '#1d3552');
          if (blueOn) ellipse(g, a1[0], a1[1], 0.9, 0.9, '#e4f4ff');
        }
      }
      // the fuselage: rings of stations [t, r] turned into an eight-sided body
      var ST = [[1.0 * Lc, 0], [0.72 * Lc, rad * 0.62], [0.3 * Lc, rad], [-0.45 * Lc, rad], [-0.7 * Lc, rad * 0.8], [tail, rad * 0.62]];
      function body() {
        var faces = [], NS = 8;
        for (var i = 0; i < ST.length - 1; i++) {
          var dt = ST[i + 1][0] - ST[i][0], dR = ST[i + 1][1] - ST[i][1];
          for (var k = 0; k < NS; k++) {
            var a0 = (k + 0.5) / NS * Math.PI * 2, a1 = (k + 1.5) / NS * Math.PI * 2, rn = roll(a0 + Math.PI / NS);
            var n = [T3[0] * dR - rn[0] * dt, T3[1] * dR - rn[1] * dt, -rn[2] * dt];
            if (dot3(n, EYE) <= 0) continue;                          // turned away from the eye
            faces.push({ pts: [P3(ST[i][0], ST[i][1], a0), P3(ST[i][0], ST[i][1], a1), P3(ST[i + 1][0], ST[i + 1][1], a1), P3(ST[i + 1][0], ST[i + 1][1], a0)], col: shade(n) });
          }
        }
        var cap = [];
        for (var c = 0; c < NS; c++) cap.push(P3(tail, ST[ST.length - 1][1], (c + 0.5) / NS * Math.PI * 2));
        var capUp = dot3(T3, EYE) < 0;
        if (capUp) faces.push({ pts: cap, col: WH.dk });
        faces.forEach(function (fc) { stroke(fc.pts, 2, WH.seam, true); });   // the silhouette first
        faces.forEach(function (fc) { path(fc.pts, fc.col); stroke(fc.pts, 0.6, fc.col, true); });
        stroke([P3(0.95 * Lc, rad * 0.2, Math.PI / 2), P3(-0.7 * Lc, rad * 0.95, Math.PI / 2)], 1, WH.lt);   // the lit spine
        // the drive, burning blue out of the tail
        var ex = P3(tail, 0, 0);
        if (!dead) {
          var fl2 = 0.8 + 0.2 * Math.sin(tnow / 70);
          halo(ex, m(capUp ? 4.4 : 3) * fl2, BLU.h);
          if (capUp) { ellipse(g, ex[0], ex[1], m(1.6), m(1.4), BLU.m); ellipse(g, ex[0], ex[1], m(0.7), m(0.6), BLU.l); }
        }
        // the intakes, a pair of blue slots either side of the spine
        [Math.PI * 0.2, Math.PI * 0.8].forEach(function (ph) {
          if (dot3(roll(ph), EYE) < -0.1) return;
          var i0 = P3(0.36 * Lc, rad * 1.02, ph), i1 = P3(0.18 * Lc, rad * 1.02, ph);
          stroke([i0, i1], m(1.3), dead ? WH.sh : '#123a6e');
          stroke([i0, i1], m(0.7), BLU.m);
          if (!dead) ellipse(g, i0[0], i0[1], m(0.6), m(0.5), BLU.l);
        });
      }
      // its shadow on the ground
      if (!dead) {
        var sw = span * Math.cos(dr), tt = (spec.tip || -0.72) * Lc;
        var shd = [S(Lc, 0, 0), S(0.2 * Lc, rad, 0), S(tt, sw, 0), S(tail * 0.7, rad, 0), S(tail, 0, 0), S(tail * 0.7, -rad, 0), S(tt, -sw, 0), S(0.2 * Lc, -rad, 0)];
        path(shd, 'rgba(12,10,8,.26)');
        rect(g, gp.x - 1, gp.y - fly, 2, fly, 'rgba(120,130,145,.14)');
      }
      /* The teleport craft's gate: a ring wing, a short band round the
         fuselage, square to it, set back where the three wings are broadest
         so they run through it and hold it. Its far half goes in behind the
         wings and body, its near half over them; the gate burns blue inside. */
      /* While it is sending or receiving through the network the gate is live:
         the inside fills with a pulsing blue sheet and light runs round the band. */
      var gateOn = !dead && u.ringUntil && tnow < u.ringUntil;
      var pulse = gateOn ? 0.5 + 0.5 * Math.sin(tnow / 90) : 0;
      function hoop(near) {
        if (!spec.ring) return;
        var ht = (spec.tip || -0.72) * Lc * 0.62, hr = span * 0.56, bw = 0.07, N = 40, fr2 = [], bk = [];
        if (gateOn && !near) {
          // the sheet across the gate, behind the near half of the band
          var sheet = [];
          for (var si = 0; si < N; si++) sheet.push(P3(ht, hr * 0.96, si / N * Math.PI * 2));
          path(sheet, 'rgba(110,190,255,' + (0.18 + 0.22 * pulse) + ')');
        }
        function flush() {
          if (fr2.length > 1) {
            var band = fr2.concat(bk.slice().reverse());
            path(band, near ? WH.lt : WH.dk); stroke(band, 1, WH.seam, true);
            stroke(near ? fr2 : bk, m(0.8 + (gateOn ? 0.5 * pulse : 0)), BLU.m);
            if (!dead) stroke(near ? fr2 : bk, m(0.3 + (gateOn ? 0.4 * pulse : 0)), BLU.l);
          }
          fr2 = []; bk = [];
        }
        for (var hi = 0; hi <= N; hi++) {
          var hph = hi / N * Math.PI * 2;
          if ((dot3(roll(hph), EYE) >= 0) === near) { fr2.push(P3(ht + bw, hr, hph)); bk.push(P3(ht - bw, hr, hph)); } else flush();
        }
        flush();
        if (gateOn && near) {
          // two sparks running round the band
          [0, Math.PI].forEach(function (off) {
            var sp = P3(ht, hr, tnow / 160 + off);
            ellipse(g, sp[0], sp[1], m(1.6), m(1.4), 'rgba(110,190,255,.45)');
            ellipse(g, sp[0], sp[1], m(0.8), m(0.7), '#e4f4ff');
          });
        }
      }
      // a support craft's gun is a token: short, thin, one coil
      var gk = spec.support ? 0.5 : 1, gEnd = spec.support ? 1.06 : 1.25;
      var zb = zc - rad * ZK * 0.9, gb1 = S(gEnd * Lc, 0, zb);
      var barrel = function () {
        // the gun: a blue energy barrel slung under the nose, reaching past it
        var gb0 = S(0.4 * Lc, 0, zb);
        stroke([gb0, gb1], m(2 * gk), dead ? WH.seam : '#123a6e');
        stroke([gb0, gb1], m(1.2 * gk), dead ? WH.dk : '#3f9be8');
        if (!spec.support) stroke([gb0, S(1.18 * Lc, 0, zb + m(0.4))], m(0.5), dead ? WH.md : '#bfe6ff');
        (spec.support ? [0.95] : [0.75, 0.95, 1.12]).forEach(function (t3) {              // coils along it
          var c3 = S(t3 * Lc, 0, zb);
          ellipse(g, c3[0], c3[1], m(gk), m(1.2 * gk), dead ? WH.dk : '#6ebeff');
        });
        if (!dead) { halo(gb1, m(2.4 * gk), 'rgba(110,190,255,.35)'); ellipse(g, gb1[0], gb1[1], m(0.8 * gk), m(0.7 * gk), '#e4f4ff'); }
      };
      // fittings on the spine, ahead of the dorsal wing
      var fittings = function () {
        // the canopy, a blue crystal set in the spine
        var cp = [P3(0.8 * Lc, rad * 0.7, Math.PI / 2), P3(0.56 * Lc, rad * 1.35, Math.PI / 2), P3(0.4 * Lc, rad * 1.05, Math.PI / 2),
          P3(0.56 * Lc, rad * 1.1, Math.PI * 0.35), P3(0.56 * Lc, rad * 1.1, Math.PI * 0.65)];
        cp = [cp[0], cp[dot3(roll(Math.PI * 0.35), EYE) > dot3(roll(Math.PI * 0.65), EYE) ? 3 : 4], cp[2], cp[1]];
        if (u.drone) return;                     // a drone: no crystal cockpit at all
        path(cp, dead ? '#2a2826' : '#3f9be8'); stroke(cp, 1, dead ? WH.seam : '#123a6e', true);
        if (!dead) path([cp[0], cp[3], cp[2]], '#9fd6ff');
      };
      // far wings, the body, then the near wings; the nose's fittings go in front when it points at the eye
      /* What the support craft are for, drawn in the tribe's blue.
         Recon: a sensor array along the spine and a scanning fan swept across
         the ground ahead. Teleport: the gate in its ring wing, a swirl of
         light filling it. Shield generator: emitters at the wingtips and the
         bubble they throw about the craft, rippling. */
      mountAt('nose', P3(1.0 * Lc, 0, -Math.PI / 2));      // where a marker's beam leaves the craft
      function scanFan() {
        if (!spec.scan || dead) return;
        var sw = Math.sin(tnow / 700) * 0.6, reachT = 1.5;
        var n0 = P3(1.0 * Lc, 0, -Math.PI / 2);
        var g0 = S(reachT + Lc, sw - 0.6, 0), g1 = S(reachT + Lc, sw + 0.6, 0);
        path([n0, g0, g1], 'rgba(110,190,255,.12)');
        stroke([n0, g0], 1, 'rgba(160,215,255,.45)'); stroke([n0, g1], 1, 'rgba(160,215,255,.45)');
        stroke([g0, g1], m(0.8), 'rgba(190,235,255,.7)');
        // the sweep's leading line, brighter
        var gm = S(reachT + Lc, sw + 0.6 * Math.sin(tnow / 180), 0);
        stroke([n0, gm], 1, 'rgba(210,240,255,.55)');
      }
      function sensorArray() {
        if (!spec.scan) return;
        // three lenses down the spine, and a small dish ahead of the dorsal wing
        [0.62, 0.4, 0.18].forEach(function (t4, i) {
          var lp = P3(t4 * Lc, rad * 1.05, Math.PI / 2);
          ellipse(g, lp[0], lp[1], m(1.2), m(1), dead ? WH.seam : '#123a6e');
          ellipse(g, lp[0], lp[1], m(0.8), m(0.65), dead ? WH.dk : (Math.floor(tnow / 240) % 3 === i ? '#e4f4ff' : '#6ebeff'));
        });
        var ds = P3(-0.05 * Lc, rad * 1.6, Math.PI / 2), db2 = P3(-0.05 * Lc, rad * 0.9, Math.PI / 2);
        stroke([db2, ds], m(0.8), WH.dk);
        ellipse(g, ds[0], ds[1], m(2.6), m(1.3), dead ? WH.dk : WH.lt);
        ellipse(g, ds[0] + m(0.3), ds[1] + m(0.2), m(1.8), m(0.8), dead ? WH.sh : WH.md);
        if (!dead) ellipse(g, ds[0], ds[1] - m(0.1), m(0.6), m(0.5), '#6ebeff');
      }
      function gate() {
        if (!spec.ring || dead) return;
        var ht = (spec.tip || -0.72) * Lc * 0.62, hr = span * 0.56 * 0.92, N = 28, disc = [];
        for (var gi = 0; gi < N; gi++) disc.push(P3(ht, hr, gi / N * Math.PI * 2));
        path(disc, 'rgba(110,190,255,.2)');
        // two arms of light turning in it
        for (var arm = 0; arm < 2; arm++) {
          var sp2 = [];
          for (var q = 0; q <= 12; q++) {
            var rr = hr * (1 - q / 13), aa = tnow / 400 + arm * Math.PI + q * 0.42;
            sp2.push(P3(ht, rr, aa));
          }
          stroke(sp2, m(0.7), 'rgba(200,238,255,.65)');
        }
        var gc = P3(ht, 0, 0);
        halo(gc, m(2.2), 'rgba(160,220,255,.45)');
        ellipse(g, gc[0], gc[1], m(0.9), m(0.8), '#e4f4ff');
      }
      function shieldBubble(back) {
        if (!spec.shield || dead) return;
        var c0 = P3(-0.1 * Lc, 0, 0), R0 = (Lc * 1.25) * K, pulse = 1 + Math.sin(tnow / 260) * 0.025;
        var rx = R0 * pulse, ry = rx * 0.7;
        if (back) { ellipse(g, c0[0], c0[1], rx, ry, 'rgba(110,190,255,.1)'); return; }
        g.save(); g.globalAlpha = 0.55; ellipseRing(g, c0[0], c0[1], rx, ry, '#8fd0ff'); g.restore();
        // a ripple crossing it, and the facets of the field catching the light
        var ph3 = (tnow / 900) % 1;
        g.save(); g.globalAlpha = 0.35 * (1 - ph3); ellipseRing(g, c0[0], c0[1], rx * (0.45 + ph3 * 0.55), ry * (0.45 + ph3 * 0.55), '#cfeeff'); g.restore();
        for (var hx = 0; hx < 7; hx++) {
          var ha = hx / 7 * Math.PI * 2 + tnow / 3000;
          ellipse(g, c0[0] + Math.cos(ha) * rx * 0.86, c0[1] + Math.sin(ha) * ry * 0.86, m(0.6), m(0.5), 'rgba(220,245,255,.6)');
        }
      }
      function emitters() {
        if (!spec.shield) return;
        WINGS.forEach(function (w) {
          var tp2 = P3((spec.tip || -0.72) * Lc, w.sp, w.ph);
          ellipse(g, tp2[0], tp2[1], m(1.5), m(1.3), dead ? WH.seam : '#123a6e');
          ellipse(g, tp2[0], tp2[1], m(1), m(0.85), dead ? WH.dk : '#6ebeff');
          if (!dead) ellipse(g, tp2[0] - m(0.3), tp2[1] - m(0.3), m(0.4), m(0.35), '#e4f4ff');
        });
      }

      var away = dot3(T3, EYE) < 0;
      scanFan();
      shieldBubble(true);
      hoop(false);
      WINGS.forEach(function (w) { if (w.d < 0) wing(w); });
      barrel();                                   // slung under the body, so only its muzzle shows past the nose
      body();
      if (away) fittings();
      WINGS.forEach(function (w) { if (w.d >= 0) wing(w); });
      gate();
      hoop(true);
      if (!away) fittings();
      sensorArray();
      emitters();
      shieldBubble(false);
      if (!dead) { mountAt('gun', gb1); mountAt('mg', gb1); }
      return { lift: lift, hgt: zc - z0 + span * (spec.fin || 1.15) * ZK + m(2) };
    }

    // ---- turrets ----
    ellipse(g, gp.x, gp.y, m(8), m(3.6), 'rgba(12,10,8,.3)');
    if (spec.kind === 'turret') {
      tripodFeet(0.45, m(6));
      if (dead) {
        prism(6, 0.2, 0.16, m(4), m(12), WH);
        return { lift: lift, hgt: m(14) };
      }
      prism(6, 0.22, 0.13, m(5), m(24), WH);
      stroke([[gp.x - m(2.4), gp.y - m(14)], [gp.x + m(2.4), gp.y - m(14)]], m(0.8), GLO.m);
      // the crystal emitter, hanging over the pylon
      var bobz = Math.sin(tnow / 420) * m(0.8);
      var cy = gp.y - m(31) - bobz;
      halo([gp.x, cy], m(6), GLO.h);
      path([[gp.x, cy - m(6)], [gp.x + m(3), cy], [gp.x, cy + m(5)], [gp.x - m(3), cy]], GLO.m);
      path([[gp.x, cy - m(6)], [gp.x + m(3), cy], [gp.x, cy]], GLO.l);
      path([[gp.x, cy - m(6)], [gp.x - m(3), cy], [gp.x - m(1), cy - m(0.5)]], '#e8f6ff');
      path([[gp.x, cy + m(5)], [gp.x + m(3), cy], [gp.x, cy]], '#3f9be8');
      stroke([[gp.x, cy - m(6)], [gp.x + m(3), cy], [gp.x, cy + m(5)], [gp.x - m(3), cy]], 1, '#123a6e', true);
      mountAt('gun', [gp.x, cy]); mountAt('rocket', [gp.x, cy - m(2)]);
      return { lift: lift, hgt: m(38) };
    }
    if (spec.kind === 'portal') {
      tripodFeet(0.5, m(4));
      var zc = m(18), rz = m(dead ? 6 : 13), rs = 0.42;
      var ring = [];
      for (var pi2 = 0; pi2 <= 32; pi2++) { var pa = pi2 / 32 * Math.PI * 2; ring.push(S(0, Math.cos(pa) * rs, zc + Math.sin(pa) * rz)); }
      if (!dead) {
        // the gate's field, swirling in the army's colour
        path(ring, hexA(gc1, 0.28));
        for (var sw = 1; sw <= 3; sw++) {
          var kk = ((tnow / 900) + sw * 0.33) % 1;
          var inner = [];
          for (var pj = 0; pj <= 24; pj++) { var pb = pj / 24 * Math.PI * 2; inner.push(S(0, Math.cos(pb) * rs * kk, zc + Math.sin(pb) * rz * kk)); }
          stroke(inner, m(0.7), hexA(gc1, 0.7 * (1 - kk)));
        }
      }
      stroke(ring, m(3.2), dead ? WH.seam : '#123a6e');
      stroke(ring, m(2.2), dead ? WH.md : '#3f9be8');
      stroke(ring.slice(4, 14), m(1), dead ? WH.lt : '#bfe6ff');
      if (!dead) { g.save(); g.globalAlpha = 0.35; stroke(ring, m(5), '#6ebeff'); g.restore(); }
      [0.25, 0.75].forEach(function (q) { var pp = ring[Math.round(q * 32)]; ellipse(g, pp[0], pp[1], m(1.2), m(1.1), GLO.m); });
      mountAt('gun', S(0, 0, zc));
      return { lift: lift, hgt: zc + rz };
    }
    // the shield turret: a slim pylon, a dish, and a bubble of light over it
    tripodFeet(0.45, m(5));
    prism(5, 0.17, 0.1, m(4), m(20), WH);
    var dz = gp.y - m(23);
    ellipse(g, gp.x, dz + m(1.2), m(7), m(3), WH.seam);
    ellipse(g, gp.x, dz, m(6.6), m(2.7), WH.md);
    ellipse(g, gp.x - m(1), dz - m(0.5), m(4.4), m(1.6), WH.lt);
    if (!dead) {
      ellipse(g, gp.x, dz - m(3), m(9), m(8), hexA(gc1, 0.14));             // the glow about it
      ellipse(g, gp.x, dz - m(3), m(6), m(5.4), hexA(gc1, 0.34));
      ellipseRing(g, gp.x, dz - m(3), m(6), m(5.4), GLO.m);
      ellipse(g, gp.x - m(2), dz - m(5.5), m(1.6), m(1.1), 'rgba(255,255,255,.6)');
      ellipse(g, gp.x, dz - m(1.2), m(1.3), m(1), GLO.l);
    }
    mountAt('gun', [gp.x, dz - m(3)]);
    return { lift: lift, hgt: m(30) };
  }

  // the texture tiles themselves, made once: specks and streaks on a clear ground
  var TEX_TILE = {};
  function texTile(kind) {
    if (TEX_TILE[kind] !== undefined) return TEX_TILE[kind];
    if (typeof document === 'undefined') return (TEX_TILE[kind] = null);
    var n = 16, c = document.createElement('canvas'); c.width = n; c.height = n;
    var x = c.getContext('2d'), r = rng(kind === 'rust' ? 7717 : 4441);
    function px(i, j, col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    if (kind === 'rust') {
      for (var a = 0; a < 38; a++) px(Math.floor(r() * n), Math.floor(r() * n), r() < 0.55 ? 'rgba(52,26,12,.42)' : 'rgba(196,120,64,.34)');
      // streaks running down from where the rain sat
      for (var b = 0; b < 3; b++) {
        var sx = Math.floor(r() * n), sy = Math.floor(r() * n), ln = 3 + Math.floor(r() * 5);
        for (var k = 0; k < ln; k++) px(sx, (sy + k) % n, 'rgba(60,30,14,' + (0.32 - k * 0.03).toFixed(2) + ')');
      }
    } else {
      for (var d = 0; d < 22; d++) px(Math.floor(r() * n), Math.floor(r() * n), r() < 0.5 ? 'rgba(30,33,38,.36)' : 'rgba(200,206,214,.3)');
      // scuffs, and a rivet or two catching the light
      for (var e = 0; e < 3; e++) {
        var ex = Math.floor(r() * n), ey = Math.floor(r() * n), el = 2 + Math.floor(r() * 4);
        for (var q = 0; q < el; q++) px((ex + q) % n, ey, 'rgba(190,196,204,.22)');
      }
      for (var v = 0; v < 2; v++) { var vx = Math.floor(r() * (n - 1)), vy = Math.floor(r() * (n - 1)); px(vx, vy, 'rgba(210,216,224,.5)'); px(vx + 1, vy + 1, 'rgba(20,22,26,.45)'); }
    }
    return (TEX_TILE[kind] = c);
  }
  function texPattern(g, kind) {
    var t = texTile(kind);
    if (!t) return null;
    g.__tex = g.__tex || {};
    if (!g.__tex[kind]) g.__tex[kind] = g.createPattern(t, 'repeat');
    return g.__tex[kind];
  }

  function drawMachine(g, u, opts) {
    var was = PH.smooth;
    PH.smooth = true;
    try { return drawMachineBody(g, u, opts); }
    finally { PH.smooth = was; }
  }
  function drawMachineBody(g, u, opts) {
    if (BIGBUG[u.art]) return drawBigBug(g, u, opts);
    if (XENO3D[u.art]) return drawXenoMachine(g, u, opts);
    var at = opts.at || u;
    var spec = hullSpec(u.art);
    var pal = PALETTE[u.paint || u.side] || PALETTE.A;
    var f = u.facing == null ? 0 : u.facing;
    var drive = driveOf(u);
    var ride = spec.heli || spec.drop ? 0 : (DRIVE[drive] ? DRIVE[drive].ride : 7);
    /* A tank or carrier hull on wheels sits down on them like an 8x8 does,
       rather than riding high on monster-truck tyres. */
    if (spec.style && drive === 'wheeled' && !/^(pickup|truck|car|guntruck)$/.test(spec.style.body)) ride = 9;
    if (spec.style && drive === 'walker' && u.transport) ride = 16;
    // a flier that is shot down is a wreck on the ground, not one hanging in the air
    var downed = opts.status === 'wrecked' || u.alive === false;
    var lift = (opts.lift || 0) + (spec.fly && !downed ? ELEV * spec.fly : 0) - (opts.hop || 0);
    // the ground it stands on (up a hill, the hill's top): where its shadow falls, whatever height it rides at
    var ground = opts.ground != null ? opts.ground : (opts.lift || 0);
    var dead = opts.status === 'wrecked' || u.alive === false;

    var hull = pal.mid, lit = pal.light, dark = pal.dark, trim = pal.helm;
    // a rebel hull's company colour is laid on bright, like their armbands
    if (dead) { hull = '#3a352d'; lit = '#4a443a'; dark = '#241f19'; trim = '#2e2822'; }
    var STEEL = dead ? '#23201b' : '#232830', STEEL_LIT = dead ? '#3a352d' : '#454d58';
    var GLASS = dead ? '#1a1712' : '#1b2732', GLINT = dead ? '#2e2822' : '#7f9cb0';

    var cos = Math.cos(f), sin = Math.sin(f);
    function along(t, side) {
      side = side || 0;
      return { x: at.x + cos * t - sin * side, y: at.y + sin * t + cos * side };
    }
    function box(t, side, len, wid) {
      var c = along(t, side);
      return hullCorners(c.x, c.y, len, wid, f);
    }
    function scr(t, side) { var c = along(t, side); return toScreen(c.x, c.y); }

    var deck = lift + ride;                            // the hull floor
    var top = deck + spec.hgt;                         // the hull roof

    /* ---- shadow, and the mast a flier hangs from ---- */
    /* A mech stands on two feet: it casts the shadow of its feet, which
       drawMech lays down itself, not the slab of the hull it stands in for. */
    var onLegs = drive === 'walker' && !(u.transport && spec.style);
    if (!onLegs) {
      var shCol = spec.fly ? 'rgba(12,10,8,.34)' : 'rgba(14,11,8,.42)';
      /* What a flier throws on the ground is its own outline, not the box of a
         hull: a rotorcraft the disc it hangs under, a winged craft its wings. */
      var sf2 = frameAt(0, 0, f);
      if (spec.heli && spec.rotor) {
        var hub = S3(sf2(0, 0), ground), rr = spec.rotor * K;
        sEllipse(hub[0], hub[1], rr, rr * 0.5, shCol);
        poly(g, [[-spec.len * 0.55, -spec.wid * 0.3], [spec.len * 0.2, -spec.wid * 0.45],
          [spec.len * 0.2, spec.wid * 0.45], [-spec.len * 0.55, spec.wid * 0.3]]
          .map(function (q) { return S3(sf2(q[0], q[1]), ground); }), shCol);
      } else if (spec.craft) {
        // nose, the wings at their widest, then the tail
        var span = CRAFT_SPAN[spec.craft] || 1.1;
        if (spec.winglets && span < 2) span = 2.1;
        var L2 = spec.len, hw = spec.wid * 0.5, sp2 = spec.wid * 0.5 * span;
        poly(g, [[L2 * 0.5, 0], [L2 * 0.14, hw], [-L2 * 0.12, sp2], [-L2 * 0.32, sp2],
          [-L2 * 0.44, hw * 0.9], [-L2 * 0.5, hw * 0.3], [-L2 * 0.5, -hw * 0.3],
          [-L2 * 0.44, -hw * 0.9], [-L2 * 0.32, -sp2], [-L2 * 0.12, -sp2], [L2 * 0.14, -hw]]
          .map(function (q) { return S3(sf2(q[0], q[1]), ground); }), shCol);
      } else {
        var sc = project(box(0.25 / MACHINE, 0.25 / MACHINE, spec.len * 0.95, spec.wid * 0.95), ground);
        poly(g, sc, shCol);
      }
    }
    if (spec.fly && !downed) {
      var cg = toScreen(at.x, at.y);
      rect(g, cg.x - 1, cg.y - lift, 2, lift - ground, 'rgba(120,130,145,.18)');
    }

    styleInit();
    if (spec.craft) { drawCraft(); return { lift: lift, hgt: spec.hgt + 18 }; }
    if (spec.heli) { drawRotorcraft(); return { lift: lift, hgt: spec.hgt + 26 }; }
    /* A transport on legs is a walking tank, not a mech: its own hull, ramp
       and turret carried on four legs (six on the heavies), riding high. */
    var walkingTank = drive === 'walker' && !!u.transport && !!spec.style;
    if (walkingTank) {
      drawGlow();
      walkLegs('far');
      styledHull();
      walkLegs('near');
      styledTop();
      drawDamage();
      return { lift: lift, hgt: ride + spec.hgt * 1.3 };
    }
    if (drive === 'walker') {
      drawMech();
      var hm0 = mechHeights();
      return { lift: lift, hgt: hm0.legH + hm0.torsoH + hm0.headH };
    }

    drawGlow();
    drawGear('far');
    if (spec.style) {
      skirts('far');
      var tankBack = spec.style.rearTank && (cos + sin) < 0.3;   // side-on it stands clear of the hull too
      if (spec.style.rearTank && !tankBack) rearTank();   // behind the hull
      styledHull();
      drawGear('near');
      skirts();
      if (tankBack) rearTank();                           // the back is towards us: in front of it
      styledTop();
      drawDamage();
      return { lift: lift, hgt: ride + spec.hgt * 1.3 };
    }
    drawHull();
    drawGear('near');
    drawFittings();
    drawDamage();
    return { lift: lift, hgt: ride + spec.hgt };

    /* ================= running gear ================= */
    // a flank is nearer the eye when moving that way increases screen depth
    function sideNear(s) { return (cos - sin) * s > 0; }
    /* Nose or tail straight at the viewer: the running gear lies under the
       hull, so it all goes down before it and the hull covers all but its
       lower edge, leaving the body's full width in view. */
    function want(phase, s, nearest) {
      if (Math.abs(cos - sin) < 0.2) return phase === 'far';
      return phase === (sideNear(s) ? 'near' : 'far');
    }
    /* How far the running gear stands out past the hull's side: enough that
       the far side's wheels, tracks or pods show beyond the body in every
       view, not tucked away under it. */
    function gearOut() { return (spec.style ? spec.wid * 0.1 : 0); }
    // running gear along a flank, taken far end first
    function alongOrder(list) {
      var fw = cos + sin;
      return list.slice().sort(function (p, q) { return p * fw - q * fw; });
    }

    function drawGlow() {
      var gp = toScreen(at.x, at.y);
      if (dead) return;
      if (drive === 'grav') {
        ellipse(g, gp.x, gp.y - 2, spec.len * K * 0.62, spec.len * K * 0.31, 'rgba(96,174,214,.14)');
        ellipse(g, gp.x, gp.y - 2, spec.len * K * 0.42, spec.len * K * 0.21, 'rgba(126,200,232,.13)');
      } else if (drive === 'hover') {
        ellipse(g, gp.x, gp.y, spec.len * K * 0.7, spec.len * K * 0.35, 'rgba(196,178,146,.17)');
        ellipse(g, gp.x, gp.y + 1, spec.len * K * 0.48, spec.len * K * 0.24, 'rgba(210,196,166,.13)');
      }
    }

    function drawGear(phase) {
      if (spec.drop) return dropPetals(phase);
      if (drive === 'tracked') return tracks(phase);
      if (drive === 'walker') return legs(phase);
      if (drive === 'grav') return gravPods(phase);
      if (drive === 'hover') return skirt(phase);
      return wheels(phase);
    }

    /* A drop pod has no running gear: it has petals, blown outward when it hit,
       and a ring of burnt ground around it (p. 79). */
    function dropPetals(phase) {
      var gp = scr(0, 0), gy = gp.y - lift;
      if (phase === 'far') {
        // the burnt ring it came down in
        ellipse(g, gp.x, gy, spec.len * K * 1.5, spec.len * K * 0.75, 'rgba(26,20,13,.5)');
        ellipse(g, gp.x, gy, spec.len * K * 1.1, spec.len * K * 0.55, 'rgba(40,30,20,.55)');
        ellipse(g, gp.x, gy, spec.len * K * 0.7, spec.len * K * 0.35, 'rgba(18,14,9,.5)');
      }
      /* Four petals, blown outward and lying where they fell. The two nearest the
         viewer are drawn after the hull so they overlap it the right way round. */
      for (var q = 0; q < 4; q++) {
        var ang = f + Math.PI / 4 + q * Math.PI / 2;
        var near = Math.sin(ang) >= 0;
        if ((phase === 'far') === near) continue;
        var cs = Math.cos(ang), sn = Math.sin(ang);
        var px = -sn, py = cs;                          // across the petal
        var r0 = spec.wid * 0.46, r1 = spec.wid * 0.84; // hinge, then where the tip fell
        var w0 = spec.wid * 0.20, w1 = spec.wid * 0.34; // it widens as it opens out
        function corner(r, w) {
          return toScreen(at.x + cs * r + px * w, at.y + sn * r + py * w);
        }
        var c1 = corner(r0, -w0), c2 = corner(r0, w0), c3 = corner(r1, w1), c4 = corner(r1, -w1);
        var face = near ? dark : '#1d1a15';
        poly(g, [[c1.x, c1.y - lift], [c2.x, c2.y - lift],
                 [c3.x, c3.y - lift], [c4.x, c4.y - lift]], face);
        // the scorched inner face, catching a little light along the hinge
        var m1 = corner(r0 + (r1 - r0) * 0.45, -w0 * 0.8), m2 = corner(r0 + (r1 - r0) * 0.45, w0 * 0.8);
        poly(g, [[c1.x, c1.y - lift], [c2.x, c2.y - lift],
                 [m2.x, m2.y - lift], [m1.x, m1.y - lift]], near ? hull : STEEL);
        // and the hinge itself, standing a pixel or two proud of the dirt
        var h1 = corner(r0, -w0), h2 = corner(r0, w0);
        poly(g, [[h1.x, h1.y - lift], [h2.x, h2.y - lift],
                 [h2.x, h2.y - lift - 2], [h1.x, h1.y - lift - 2]], near ? lit : STEEL_LIT);
      }
    }

    /* A drop pod is a squat cone: a scorched skirt where it bit into the ground,
       an ablative body leaning inward all the way up, and a thruster cap. */
    function dropBody() {
      var h = spec.hgt;
      var burn = dead ? '#221e18' : '#1b1712';
      var burnLit = dead ? '#332e26' : '#2f2820';
      var s0 = Math.round(h * 0.00), s1 = Math.round(h * 0.22);
      var s2 = Math.round(h * 0.80), s3 = h;

      // the scorched skirt, driven into the dirt
      var skLo = box(0, 0, spec.len * 1.08, spec.wid * 1.08);
      var skHi = box(0, 0, spec.len * 0.98, spec.wid * 0.98);
      taper(g, skLo, skHi, lift + s0, s1 - s0, burn, burnLit, dead ? '#3a352d' : '#3b322a');

      // the body: every flank leans in towards the cap
      var bLo = box(0, 0, spec.len * 0.98, spec.wid * 0.98);
      var bHi = box(0, 0, spec.len * 0.60, spec.wid * 0.60);
      taper(g, bLo, bHi, lift + s1, s2 - s1, dark, hull, lit);
      bandOnSides(g, bLo, lift + s1 + 1, 2, 2, 'rgba(10,9,7,.5)');       // char line at the skirt
      bandOnSides(g, bLo, lift + Math.round(h * 0.52), 2, 2, trim);      // ablative seam

      // heat streaks, running up from the skirt
      var pbase = project(bLo, lift + s1);
      for (var q = 0; q < 4; q++) {
        var bm = pbase[q], bn = pbase[(q + 1) % 4];
        if ((bm[1] + bn[1]) / 2 < (pbase[0][1] + pbase[2][1]) / 2) continue;
        for (var st = 1; st < 4; st++) {
          var tt = st / 4;
          var sx = Math.round(bm[0] + (bn[0] - bm[0]) * tt);
          var sy = Math.round(bm[1] + (bn[1] - bm[1]) * tt);
          rect(g, sx, sy - lift - s1 - Math.round(h * 0.34), 1, Math.round(h * 0.3),
            'rgba(18,14,10,.4)');
        }
      }

      // the thruster cap
      var cLo = box(0, 0, spec.len * 0.60, spec.wid * 0.60);
      var cHi = box(0, 0, spec.len * 0.40, spec.wid * 0.40);
      taper(g, cLo, cHi, lift + s2, s3 - s2, STEEL, STEEL_LIT, dead ? '#2e2822' : trim);
    }

    /* The open door, and the rail the squad came down on. */
    function dropHatch() {
      // the door is blown down into the dirt, so it sits on the leaning flank
      var fr = toScreen(at.x + cos * spec.len * 0.40, at.y + sin * spec.len * 0.40);
      var base = lift + Math.round(spec.hgt * 0.20);
      var h2 = Math.round(spec.hgt * 0.52), w2 = Math.round(K * 0.22);
      rect(g, fr.x - w2, fr.y - base - h2, w2 * 2, h2, dead ? '#15120e' : '#0f1216');
      rect(g, fr.x - w2, fr.y - base - h2, w2 * 2, 2, STEEL_LIT);      // lintel
      rect(g, fr.x - w2 - 1, fr.y - base - 1, w2 * 2 + 2, 2, trim);    // the sill it fell onto
      if (!dead) rect(g, fr.x - w2 + 1, fr.y - base - h2 + 3, 2, 2, '#c8894a'); // cabin light
      // a beacon on the cap, so the thing reads as a machine and not a rock
      var cp = scr(0, 0);
      rect(g, cp.x, cp.y - lift - spec.hgt - 5, 1, 5, STEEL_LIT);
      dot(g, cp.x, cp.y - lift - spec.hgt - 7, dead ? '#3a352d' : '#e8c15a', 2);
    }

    /* Running gear, drawn in the plane of the hull's flank: a wheel is a disc
       standing upright along the direction of travel, so it is drawn as a
       circle through a shear that lays it into that plane, with its tyre wall
       seen as a second disc set outward behind it. Tracks are a belt in the
       same plane, round at the ends, over road wheels, sprocket and idler. */
    function sidePlane(t, sd, z) {
      var c = scr(t, sd);
      var Fx = (cos - sin) * K, Fy = (cos + sin) * K / 2;
      g.save();
      g.transform(Fx / K, Fy / K, 0, 1, c.x, c.y - z);
    }
    function outward(sd) {
      // the flank's outward direction on screen, per inch
      return { x: (-sin - cos) * K * sd, y: (cos - sin) * K / 2 * sd };
    }
    function disc(r, c) { g.fillStyle = c; g.beginPath(); g.arc(0, 0, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); }

    function wheelGeom() {
      var n = spec.axles || 3;
      var span = spec.len * (n > 3 ? 0.84 : n > 2 ? 0.76 : 0.6);
      var cap = span / (n - 1) * K * 0.46;
      // a styled hull rides low on its wheels: the tyres tuck up under the hull side
      var low = spec.style && !/^(pickup|truck|car|guntruck)$/.test(spec.style.body);
      var r = (low ? Math.min(ride * 0.95, Math.max(5, cap)) : Math.min(ride * 0.95, Math.max(6, cap))) * (spec.wheelR || 1);
      return { n: n, span: span, r: r, tw: spec.wid * 0.14 };
    }
    // a tyre's tread seen across: the band joining its two walls, so a wheel
    // seen edge-on is a tyre and not a line
    function treadBand(t, a0, a1, zc, r, col) {
      var Fx = (cos - sin), Fy = (cos + sin) / 2, pts = [];
      [a0, a1].forEach(function (sOff) {
        var c = scr(t, sOff);
        for (var i = 0; i < 16; i++) {
          var an = i / 16 * Math.PI * 2, x = Math.cos(an) * r, y = Math.sin(an) * r;
          pts.push([c.x + Fx * x, c.y - zc + Fy * x + y]);
        }
      });
      poly(g, hull2d(pts), col);
    }
    function wheels(phase) {
      var WG = wheelGeom(), n = WG.n, span = WG.span, r = WG.r;
      var tw = WG.tw;                                            // tyre width, inches
      var ts = [];
      for (var wi0 = 0; wi0 < n; wi0++) ts.push((wi0 / (n - 1) - 0.5) * span);
      ts = alongOrder(ts);
      for (var wi = 0; wi < n; wi++) {
        var t = ts[wi], nearestW = wi === n - 1;
        [-1, 1].forEach(function (sd) {
          if (!want(phase, sd, nearestW)) return;
          var o = outward(sd), zc = lift + r;
          var edge2 = (spec.wid * 0.5 + gearOut()) * sd;
          /* On the far flank the face toward the viewer is the tyre's inner
             wall: the outer wall goes down first, the tread across, and the
             back of the wheel on top, with no hub detail to see. */
          if (spec.style && !sideNear(sd) && Math.abs(cos - sin) >= 0.2) {
            sidePlane(t, edge2, zc); disc(r, '#0b0e12'); g.restore();
            treadBand(t, edge2, edge2 - sd * tw, zc, r, '#14181d');
            for (var kb = 1; kb <= 3; kb++) {
              sidePlane(t, edge2 - sd * tw * kb / 3, zc); disc(r, kb === 3 ? '#161a20' : '#101318'); g.restore();
            }
            sidePlane(t, edge2 - sd * tw, zc);
            disc(r * 0.55, '#1d2229');                      // the back of the rim
            disc(r * 0.22, '#0f1216');                      // and the axle
            g.restore();
            return;
          }
          // the tyre's inner wall, then its tread face, then the outer wall
          sidePlane(t, edge2 - sd * tw, zc); disc(r, '#0b0e12'); g.restore();
          treadBand(t, edge2 - sd * tw, edge2, zc, r, '#14181d');
          var steps = 3;
          for (var k2 = 1; k2 <= steps; k2++) {
            sidePlane(t, edge2 - sd * tw + sd * tw * k2 / steps, zc); disc(r, k2 === steps ? '#161a20' : '#101318'); g.restore();
          }
          sidePlane(t, edge2, zc);
          // tread blocks round the rim
          if (!dead) {
            g.strokeStyle = '#272c34'; g.lineWidth = 1.1;
            for (var q = 0; q < 14; q++) {
              var ang = q / 14 * Math.PI * 2;
              g.beginPath(); g.moveTo(Math.cos(ang) * r * 0.82, Math.sin(ang) * r * 0.82);
              g.lineTo(Math.cos(ang) * r * 0.98, Math.sin(ang) * r * 0.98); g.stroke();
            }
          }
          disc(r * 0.6, '#2b313a');                               // the rim
          disc(r * 0.52, dead ? '#2a2620' : mixc(STEEL_LIT, hull, 0.25));
          g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(-r * 0.12, -r * 0.14, r * 0.34, 0, Math.PI * 2); g.fill();
          disc(r * 0.2, '#1a1e25');                               // the hub
          for (var bq = 0; bq < 5; bq++) {                        // wheel nuts
            var ba = bq / 5 * Math.PI * 2;
            g.fillStyle = '#58616d'; g.beginPath(); g.arc(Math.cos(ba) * r * 0.32, Math.sin(ba) * r * 0.32, Math.max(0.5, r * 0.05), 0, Math.PI * 2); g.fill();
          }
          g.restore();
          void o;
        });
        if (!spec.style) {                                      // the older hulls keep their arches
          [-1, 1].forEach(function (sd) {
            if (!want(phase, sd)) return;
            var ap = scr(t, sd * spec.wid * 0.48);
            rect(g, ap.x - r - 1, ap.y - deck - 2, r * 2 + 2, 3, dark);
          });
        }
      }
      /* A tank or carrier body on wheels carries a guard over the wheels, as it
         would over tracks: a plate from nose to tail just above the tyres. */
      if (spec.style && !/^(pickup|truck|car|guntruck)$/.test(spec.style.body)) {
        [-1, 1].forEach(function (sd) {
          if (!want(phase, sd)) return;
          var eo = spec.wid * 0.5 + gearOut(), b0 = sd * (eo - tw - 0.02), b1 = sd * (eo + 0.02);
          slabF(HF, -spec.len * 0.49, spec.len * 0.49, Math.min(b0, b1), Math.max(b0, b1), lift + r * 2 + 0.5, 2, TB,
            spec.len * 0.02, spec.len * 0.01, 0);
        });
      }
    }

    function tracks(phase) {
      var L2 = spec.len * K * 0.5, hgt = ride + 6, rr = hgt / 2;
      var tw = spec.wid * 0.24;
      [-1, 1].forEach(function (sd) {
        if (!want(phase, sd)) return;
        // seen nose- or tail-on the tracks stand out past the hull's sides
        var splay = gearOut();
        var outer0 = sd * (spec.wid * 0.5 + splay), inner0 = outer0 - sd * tw;
        /* The face of the track toward the viewer is drawn last. On the far
           flank that is its inner face: the road wheels are on the other
           side of the belt and hidden by it. */
        var nearTrack = sideNear(sd) || Math.abs(cos - sin) < 0.2;
        var inner = nearTrack ? inner0 : outer0, outer = nearTrack ? outer0 : inner0;
        function belt(off, c) {
          sidePlane(0, off, lift);
          g.fillStyle = c; g.beginPath();
          if (g.roundRect) g.roundRect(-L2, -hgt, L2 * 2, hgt, rr); else g.rect(-L2, -hgt, L2 * 2, hgt);
          g.fill(); g.restore();
        }
        // the belt: its inner edge, the width of it, then the outer face
        belt(inner, '#0b0e12');
        // seen end-on, the belt's width is a solid band, not a line
        (function () {
          var pts = [];
          [inner, outer].forEach(function (sOff) {
            [[-L2, 0], [L2, 0], [L2, -hgt], [-L2, -hgt]].forEach(function (c) {
              var base = scr(0, sOff), Fx = (cos - sin), Fy = (cos + sin) / 2;
              pts.push([base.x + Fx * c[0], base.y - lift + Fy * c[0] + c[1]]);
            });
          });
          poly(g, hull2d(pts), '#1c2027');
        })();
        for (var k2 = 1; k2 <= 4; k2++) belt(inner + (outer - inner) * k2 / 4, k2 === 4 ? '#1a1e25' : k2 === 3 ? '#2b3139' : '#262b33');
        sidePlane(0, outer, lift);
        // track links along the run
        g.strokeStyle = '#2a3038'; g.lineWidth = 1;
        g.setLineDash([1.2, 2.2]);
        g.beginPath();
        if (g.roundRect) g.roundRect(-L2 + 0.8, -hgt + 0.8, L2 * 2 - 1.6, hgt - 1.6, rr - 0.8); else g.rect(-L2, -hgt, L2 * 2, hgt);
        g.stroke();
        g.setLineDash([]);
        // a track guard: a plate over the top run, a little wider than the belt,
        // running back from the hull's nose to its tail
        function guard() {
          if (spec.style && spec.style.noGuard) return;
          var b0 = Math.min(inner0, outer0) - 0.02, b1 = Math.max(inner0, outer0) + 0.02;
          slabF(HF, -spec.len * 0.49, spec.len * 0.49, b0, b1, lift + hgt, 2, TB, spec.len * 0.02, spec.len * 0.01, 0);
        }
        if (!nearTrack && spec.style) { g.restore(); guard(); return; }
        // road wheels, the sprocket at the front and the idler behind
        var nw = spec.len > 2.3 * MACHINE ? 6 : 5, wr = hgt * 0.33;
        var order = [];
        for (var i0 = 0; i0 < nw; i0++) order.push(i0);
        if (cos + sin < 0) order.reverse();              // the far end of the run first
        for (var oi = 0; oi < nw; oi++) {
          var i = order[oi];
          var x = -L2 + rr + (L2 * 2 - rr * 2) * i / (nw - 1);
          var end = i === 0 || i === nw - 1;
          var cy = end ? -hgt / 2 : -wr - 1;
          var R2 = end ? rr * 0.72 : wr;
          g.fillStyle = '#0d1014'; g.beginPath(); g.arc(x, cy, R2 + 0.6, 0, Math.PI * 2); g.fill();
          g.fillStyle = dead ? '#2a2620' : mixc(hull, dark, 0.35); g.beginPath(); g.arc(x, cy, R2, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(x - R2 * 0.15, cy - R2 * 0.2, R2 * 0.6, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#1a1e25'; g.beginPath(); g.arc(x, cy, R2 * 0.3, 0, Math.PI * 2); g.fill();
          if (end && i === nw - 1) {                             // sprocket teeth at the front
            g.strokeStyle = '#1a1e25'; g.lineWidth = 0.9;
            for (var q = 0; q < 8; q++) {
              var ang = q / 8 * Math.PI * 2;
              g.beginPath(); g.moveTo(x + Math.cos(ang) * R2 * 0.55, cy + Math.sin(ang) * R2 * 0.55);
              g.lineTo(x + Math.cos(ang) * R2, cy + Math.sin(ang) * R2); g.stroke();
            }
          }
        }
        // return rollers along the top run
        for (var j = 1; j < 3; j++) {
          var xr = -L2 + L2 * 2 * j / 3;
          g.fillStyle = '#2a3038'; g.beginPath(); g.arc(xr, -hgt + 2.2, 1.3, 0, Math.PI * 2); g.fill();
        }
        g.restore();
        if (spec.style) guard();
        if (!spec.style) {                                     // the older hulls' fender
          var sk = box(0, sd * spec.wid * 0.46, spec.len * 0.94, spec.wid * 0.08);
          taper(g, sk, sk, lift + ride + 2, 4, dark, hull, lit);
        }
      });
    }

    /* Four digitigrade legs, fore and aft: a hip pod on the hull, a thigh swinging
       out and back to the knee, a shin forward to a broad foot. Each leg is laid
       down before or after the hull according to its own depth, so the machine
       reads as standing over its own legs rather than balanced on one. */
    /* Walking-tank legs, spider fashion: a hip pod on the hull side, a thigh
       out and up to a knee above the deck line, and a long shin down to a
       plated foot. Diagonal pairs swap on each step, and a stepping foot is
       lifted clear of the ground. */
    function walkLegs(phase) {
      var six = spec.len >= 2.45 * MACHINE - 0.01;
      var tsL = six ? [0.36, 0, -0.36] : [0.3, -0.3];
      var stepA = opts.walk ? (opts.walk % 2) : -1;
      var legs3 = [];
      tsL.forEach(function (tf, li) {
        [-1, 1].forEach(function (sd) {
          var grp = (li + (sd > 0 ? 1 : 0)) % 2;           // diagonal pairs
          var swing = stepA < 0 ? 0 : (grp === stepA ? 1 : -1);
          var hipT = tf * spec.len, hipS = sd * spec.wid * 0.5;
          var footT = hipT + swing * spec.len * 0.06, footS = sd * spec.wid * 0.74;
          var d = footT * (cos + sin) + footS * (cos - sin);
          legs3.push({ hipT: hipT, hipS: hipS, footT: footT, footS: footS, sd: sd, up: swing > 0 ? 4 : 0, d: d });
        });
      });
      legs3.sort(function (p, q) { return p.d - q.d; }).forEach(function (L) {
        var near = sideNear(L.sd) || Math.abs(cos - sin) < 0.2 && L.d > 0;
        if ((phase === 'near') !== near) return;
        var H = scr(L.hipT, L.hipS), Kn = scr((L.hipT + L.footT) / 2, L.sd * spec.wid * 0.78), F = scr(L.footT, L.footS);
        var hipZ = deck + 3, kneeZ = deck + spec.hgt * 0.35 + L.up, footZ = lift + L.up;
        var h = [H.x, H.y - hipZ], k = [Kn.x, Kn.y - kneeZ], f = [F.x, F.y - footZ - 3];
        slabF(frameAt(L.hipT, L.hipS, f0()), -spec.len * 0.07, spec.len * 0.07, -spec.wid * 0.06, spec.wid * 0.06, deck - 1, 9, TB);
        line(h, k, 4.5, STEEL); line([h[0] - 0.8, h[1] - 0.8], [k[0] - 0.8, k[1] - 0.8], 1.2, STEEL_LIT);
        sEllipse(k[0], k[1], 3.4, 3, hull); sEllipse(k[0] - 0.7, k[1] - 0.7, 1.5, 1.3, lit);
        line(k, f, 3.8, STEEL); line([k[0] + 0.7, k[1]], [f[0] + 0.7, f[1]], 1, STEEL_LIT);
        // a shin guard in the force colour
        var m = [(k[0] + f[0]) / 2, (k[1] + f[1]) / 2];
        line([k[0] + (m[0] - k[0]) * 0.2, k[1] + (m[1] - k[1]) * 0.2], m, 5.5, hull);
        slabF(frameAt(L.footT, L.footS, f0()), -spec.len * 0.07, spec.len * 0.08, -spec.wid * 0.08, spec.wid * 0.08, footZ, 4, TS,
          spec.len * 0.03, spec.len * 0.01, spec.wid * 0.01);
      });
    }
    function f0() { return f; }
    function legs(phase) {
      [1, -1].forEach(function (fore) {
        [-1, 1].forEach(function (s) {
          var hipT = fore * spec.len * 0.3, hipS = s * spec.wid * 0.54;
          // depth of this hip: positive is nearer the eye
          var depth = hipT * (cos + sin) + hipS * (cos - sin);
          if (phase !== (depth > 0 ? 'near' : 'far')) return;
          var hp = scr(hipT, hipS);
          var hipY = deck - 2;
          var kneeT = hipT - fore * spec.len * 0.06, kneeS = s * spec.wid * 0.98;
          var kp = scr(kneeT, kneeS);
          var kneeY = lift + Math.round(ride * 0.55);
          var footT = hipT + fore * spec.len * 0.1, footS = s * spec.wid * 0.86;
          var fp = scr(footT, footS);
          // hip pod, hung off the hull flank
          var hpod = box(hipT, hipS * 0.88, spec.len * 0.22, spec.wid * 0.24);
          taper(g, hpod, hpod, hipY - 6, 13, dark, hull, lit);
          // thigh: out and down to the knee
          thickLine(g, hp.x, hp.y - hipY, kp.x, kp.y - kneeY, 7, STEEL);
          thickLine(g, hp.x, hp.y - hipY - 2, kp.x, kp.y - kneeY - 2, 2, STEEL_LIT);
          // knee actuator
          dot(g, kp.x, kp.y - kneeY, hull, 5);
          dot(g, kp.x, kp.y - kneeY, STEEL_LIT, 3);
          dot(g, kp.x, kp.y - kneeY, '#171b22', 1);
          // shin: back under the machine and down to the foot
          thickLine(g, kp.x, kp.y - kneeY, fp.x, fp.y - lift - 6, 6, STEEL);
          thickLine(g, kp.x - 1, kp.y - kneeY, fp.x - 1, fp.y - lift - 6, 2, STEEL_LIT);
          // foot pad
          var ft = box(footT, footS, spec.len * 0.26, spec.wid * 0.28);
          taper(g, ft, box(footT, footS, spec.len * 0.2, spec.wid * 0.22), lift, 6,
            '#171b21', STEEL, STEEL_LIT);
        });
      });
    }

    /* Anti-grav pods under the hull, laid along the hull's own axis so they
       turn with it: an armoured housing, and under it the emitter plate
       glowing blue onto the ground. */
    function gravPods(phase) {
      var pl = spec.len * 0.13, pw = spec.wid * 0.12;
      var tp = alongOrder([-0.31, 0, 0.31].map(function (k) { return k * spec.len; }));
      for (var i = 0; i < 3; i++) {
        var t = tp[i], nearestP = i === 2;
        [-1, 1].forEach(function (sd) {
          if (!want(phase, sd, nearestP)) return;
          var q = sd * (spec.wid * 0.4 + gearOut() * 1.2);
          if (!dead) {
            var gl = rectPts(t - pl, t + pl, q - pw, q + pw).map(function (c) { return S3(HF(c[0], c[1]), deck - 8); });
            poly(g, gl, 'rgba(127,216,232,.85)');
            var gl2 = rectPts(t - pl * 1.2, t + pl * 1.2, q - pw * 1.4, q + pw * 1.4).map(function (c) { return S3(HF(c[0], c[1]), deck - 9); });
            poly(g, gl2, 'rgba(127,216,232,.25)');
          }
          slabF(HF, t - pl, t + pl, q - pw, q + pw, deck - 7, 7, TS, pl * 0.15, pl * 0.15, pw * 0.1);
        });
      }
    }


    function skirt(phase) {
      // a rubber plenum skirt all round, billowing where it meets the ground
      if (phase === 'far') {
        var sk = box(0, 0, spec.len * 1.04, spec.wid * 1.24);
        taper(g, sk, box(0, 0, spec.len * 0.98, spec.wid * 1.12), lift + 2, ride,
          '#1d2028', '#2b2f38', '#33383f');
        return;
      }
      // lift fans humming behind, and a lighter lip along the near flank
      [-1, 1].forEach(function (s) {
        if (!want(phase, s)) return;
        var lp = scr(-spec.len * 0.3, s * spec.wid * 0.36);
        dot(g, lp.x, lp.y - deck + 3, STEEL, 4);
        if (!dead) dot(g, lp.x, lp.y - deck + 3, '#6fb6cf', 2);
      });
      var sk2 = box(0, 0, spec.len * 1.04, spec.wid * 1.24);
      bandOnSides(g, sk2, lift + 2, ride, 2, '#3f454e');
    }

    /* ================= the hull ================= */
    function drawHull() {
      if (spec.drop) return dropBody();                 // a pod is a cone, not a box
      var lo = box(0, 0, spec.len, spec.wid);
      var hi = box(-spec.len * 0.02, 0, spec.len * 0.96, spec.wid * spec.taper);
      taper(g, lo, hi, deck, spec.hgt, dark, hull, lit);
      bandOnSides(g, lo, deck, 2, 2, 'rgba(10,9,7,.5)');          // shadow at the skirt line
      bandOnSides(g, hi, deck + spec.hgt - 3, 3, 2, trim);        // panel line under the roof

      // sloped glacis: a wedge from the nose up to the fighting deck
      var gl = project(box(spec.len * 0.5, 0, 0.02, spec.wid * spec.taper * 0.98), deck + 3);
      var gh = project(box(spec.len * 0.24, 0, 0.02, spec.wid * spec.taper), top);
      poly(g, [gl[0], gl[1], gh[1], gh[0]], trim);
      poly(g, [gh[0], gh[1], [gh[1][0], gh[1][1] - 2], [gh[0][0], gh[0][1] - 2]], lit);

      // the upper deck: a narrower box set back from the nose
      if (spec.deck) {
        var dl = box(-spec.len * 0.04, 0, spec.len * spec.deck, spec.wid * spec.taper * 0.94);
        var dh = box(-spec.len * 0.04, 0, spec.len * spec.deck * 0.94, spec.wid * spec.taper * 0.82);
        taper(g, dl, dh, top, spec.dHgt, dark, hull, lit);
        bandOnSides(g, dl, top, 2, 2, 'rgba(10,9,7,.4)');
      }
      // engine grille across the rear deck
      var eg = project(box(-spec.len * 0.4, 0, spec.len * 0.12, spec.wid * spec.taper * 0.8), top);
      poly(g, eg, STEEL);
      for (var i = 0; i < 3; i++) {
        var lp2 = scr(-spec.len * 0.43 + i * spec.len * 0.03, 0);
        rect(g, lp2.x - a(3), lp2.y - top - 1, a(6), 1, STEEL_LIT);
      }
      // headlights either side of the nose
      [-1, 1].forEach(function (s) {
        var lp3 = scr(spec.len * 0.46, s * spec.wid * 0.3);
        rect(g, lp3.x - 2, lp3.y - deck - Math.round(spec.hgt * 0.62), 3, 3, dead ? STEEL : '#f0e2b4');
      });
      // an aerial whip off the back deck
      var ap2 = scr(-spec.len * 0.34, spec.wid * 0.3);
      rect(g, ap2.x, ap2.y - top - 16, 1, 16, STEEL_LIT);
      // stowage bins along the lit flank
      if (spec.bins) {
        for (var bnum = 0; bnum < 2; bnum++) {
          var bt = -spec.len * 0.06 - bnum * spec.len * 0.2;
          var bn = box(bt, -spec.wid * spec.taper * 0.52, spec.len * 0.16, spec.wid * 0.1);
          taper(g, bn, bn, deck + Math.round(spec.hgt * 0.45), 7, dark, '#6a6250', '#7b7360');
        }
      }
      // a rear ramp seam on a carrier
      if (spec.ramp) {
        var rp2 = project(box(-spec.len * 0.5, 0, 0.02, spec.wid * spec.taper * 0.8), deck + 2);
        var rq = project(box(-spec.len * 0.5, 0, 0.02, spec.wid * spec.taper * 0.8), top - 2);
        poly(g, [rp2[0], rp2[1], rq[1], rq[0]], dark);
      }
    }

    /* ================= fittings ================= */
    function drawFittings() {
      if (spec.drop) return dropHatch();               // a pod has a door and nothing else
      var axis = cos + sin;                            // >0 when the nose is towards us
      var parts = [];
      function part(t, fn) { parts.push({ d: t * axis, fn: fn }); }

      if (spec.cab) part(spec.len * 0.3, function () {
        var cab = box(spec.len * 0.3, 0, spec.len * 0.3, spec.wid * 0.94);
        taper(g, cab, box(spec.len * 0.31, 0, spec.len * 0.26, spec.wid * 0.84), top, 14, dark, hull, lit);
        var wf = project(box(spec.len * 0.44, 0, 0.01, spec.wid * 0.7), top + 4);
        poly(g, [wf[0], wf[1], [wf[1][0], wf[1][1] + 8], [wf[0][0], wf[0][1] + 8]], GLASS);
        poly(g, [wf[0], wf[1], [wf[1][0], wf[1][1] + 2], [wf[0][0], wf[0][1] + 2]], GLINT);
      });
      if (spec.bed) part(-spec.len * 0.14, function () {
        var tilt = box(-spec.len * 0.14, 0, spec.len * 0.52, spec.wid * 0.9);
        taper(g, tilt, box(-spec.len * 0.14, 0, spec.len * 0.48, spec.wid * 0.78), top, 13,
          '#4c4433', '#6d6149', '#7d7054');
        bandOnSides(g, tilt, top, 13, 2, '#3a3427');
      });
      if (spec.hatch) part(-spec.len * 0.26, function () {
        var hc = box(-spec.len * 0.26, 0, spec.len * 0.22, spec.wid * 0.44);
        taper(g, hc, hc, top + (spec.dHgt || 0), 4, dark, hull, trim);
      });
      if (spec.drum) part(-spec.len * 0.36, function () {
        var dp2 = scr(-spec.len * 0.36, 0);
        var y = top + (spec.dHgt || 0);
        rect(g, dp2.x - 7, dp2.y - y - 12, 14, 12, dark);
        rect(g, dp2.x - 7, dp2.y - y - 12, 14, 3, trim);
        rect(g, dp2.x - 7, dp2.y - y - 5, 14, 2, '#8a3a24');
      });
      if (spec.spade) part(-spec.len * 0.5, function () {
        var sp2 = scr(-spec.len * 0.5, 0);
        rect(g, sp2.x - 9, sp2.y - deck + 1, 18, 5, STEEL);
        rect(g, sp2.x - 9, sp2.y - deck + 1, 18, 2, STEEL_LIT);
      });
      if (spec.dish) part(-spec.len * 0.2, function () {
        var dp3 = scr(-spec.len * 0.2, 0);
        var y2 = top + (spec.dHgt || 0);
        rect(g, dp3.x - 1, dp3.y - y2 - 11, 2, 11, STEEL_LIT);
        ellipse(g, dp3.x, dp3.y - y2 - 13, a(2.1), a(1.1), '#b9c2cc');
        ellipse(g, dp3.x, dp3.y - y2 - 14, a(1.3), a(0.6), '#5d6775');
      });
      if (spec.cross) part(0, function () {
        var cp2 = scr(0, 0);
        var y3 = top + (spec.dHgt || 0);
        rect(g, cp2.x - 7, cp2.y - y3 - 1, 14, 5, '#e8e3d8');
        rect(g, cp2.x - 5, cp2.y - y3 - 1, 10, 5, '#c23a32');
        rect(g, cp2.x - 1, cp2.y - y3 - 3, 3, 9, '#c23a32');
      });

      if (spec.turret) {
        var tBase = top + (spec.deck ? spec.dHgt : 0);
        var tOff = -spec.len * 0.05;
        var barrel = function () {
          var gy = tBase + Math.round(spec.tHgt * 0.5);
          var up = spec.elev || 0, w = spec.fat ? 7 : 5;
          var lat = spec.twin ? [-0.16, 0.16] : [0];
          lat.forEach(function (o) {
            var g0 = scr(spec.turret * 0.45, o), g1 = scr(spec.gun, o);
            thickLine(g, g0.x, g0.y - gy, g1.x, g1.y - gy - up, w, '#1a1e25');
            thickLine(g, g0.x, g0.y - gy - 1, g1.x, g1.y - gy - up - 1, 2, STEEL_LIT);
            // a fume extractor two thirds along
            var fe = scr(spec.turret * 0.45 + (spec.gun - spec.turret * 0.45) * 0.62, o);
            rect(g, fe.x - w / 2 - 1, fe.y - gy - up * 0.62 - 4, w + 2, 6, '#1a1e25');
            var mz = scr(spec.gun * 1.04, o);
            rect(g, mz.x - w / 2 - 1, mz.y - gy - up - 5, w + 2, 7, STEEL_LIT);
            rect(g, mz.x - w / 2, mz.y - gy - up - 4, w, 5, '#15181e');
          });
        };
        var turret = function () {
          var tc = box(tOff, 0, spec.turret, spec.turret * 0.9);
          var th = box(tOff - spec.turret * 0.06, 0, spec.turret * 0.8, spec.turret * 0.72);
          taper(g, tc, th, tBase, spec.tHgt, dark, hull, lit);
          bandOnSides(g, tc, tBase, spec.tHgt, 2, trim);
          if (spec.bustle) {                           // a stowage bustle behind
            var bs = box(tOff - spec.turret * 0.62, 0, spec.turret * 0.4, spec.turret * 0.8);
            taper(g, bs, bs, tBase + 2, Math.round(spec.tHgt * 0.6), dark, '#6a6250', '#7b7360');
          }
          // mantlet at the gun's root
          var mt = box(tOff + spec.turret * 0.42, 0, spec.turret * 0.18, spec.turret * 0.66);
          taper(g, mt, mt, tBase + 1, spec.tHgt - 2, dark, hull, lit);
          if (spec.cupola) {                           // commander's cupola and its sight
            var cu = scr(tOff - spec.turret * 0.18, -spec.turret * 0.22);
            var cy2 = tBase + spec.tHgt;
            rect(g, cu.x - 4, cu.y - cy2 - 6, 8, 7, hull);
            rect(g, cu.x - 4, cu.y - cy2 - 6, 8, 2, lit);
            rect(g, cu.x - 2, cu.y - cy2 - 8, 4, 3, STEEL);
            rect(g, cu.x - 2, cu.y - cy2 - 8, 4, 1, GLINT);
          }
          if (spec.smoke) {                            // smoke-grenade racks on the cheeks
            [-1, 1].forEach(function (s) {
              var sp3 = scr(tOff + spec.turret * 0.2, s * spec.turret * 0.46);
              for (var i = 0; i < 3; i++) rect(g, sp3.x - 3 + i * 3, sp3.y - tBase - spec.tHgt + 2, 2, 4, STEEL);
            });
          }
        };
        part(tOff, axis >= 0 ? function () { turret(); barrel(); }
          : function () { barrel(); turret(); });
      }
      if (spec.fixedGun) part(spec.len * 0.2, function () {
        var gy2 = top + (spec.deck ? spec.dHgt : 0) - 2;
        var mant = box(spec.len * 0.2, 0, spec.len * 0.22, spec.wid * 0.56);
        var f0 = scr(spec.len * 0.2, 0), f1 = scr(spec.fixedGun, 0), mb = scr(spec.fixedGun * 1.04, 0);
        var gun = function () {
          thickLine(g, f0.x, f0.y - gy2, f1.x, f1.y - gy2, 6, '#1a1e25');
          thickLine(g, f0.x, f0.y - gy2 - 1, f1.x, f1.y - gy2 - 1, 2, STEEL_LIT);
          rect(g, mb.x - 5, mb.y - gy2 - 5, 10, 8, STEEL_LIT);
          rect(g, mb.x - 4, mb.y - gy2 - 4, 8, 6, '#15181e');
        };
        if (axis < 0) gun();
        taper(g, mant, box(spec.len * 0.2, 0, spec.len * 0.16, spec.wid * 0.42), gy2 - 6, 10, dark, hull, lit);
        if (axis >= 0) gun();
      });

      parts.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
    }

    /* ================= styled hulls =================
       Every PMC machine now has a look of its own, named after the kind of real
       vehicle it is drawn from — a technical, an armoured car, a light tank, a
       main battle tank, a boxy carrier — and built from extruded outlines in the
       hull's own frame rather than from one box with a turret on it. The parts
       that fire record where their barrels and tubes end (PH.mounts), so the game
       can start each shot at the weapon that fired it. A turret turns to
       whatever the machine last shot at (u.aim); a fixed gun points where the
       hull does. */
    function col3(c) {
      if (c.charAt(0) === '#') return hex3(c);
      var m = c.match(/[\d.]+/g);
      return [+m[0], +m[1], +m[2]];
    }
    function mixc(c1, c2, k) {
      var A1 = col3(c1), B1 = col3(c2);
      k = clamp01(k);
      return 'rgb(' + Math.round(A1[0] + (B1[0] - A1[0]) * k) + ',' + Math.round(A1[1] + (B1[1] - A1[1]) * k) +
        ',' + Math.round(A1[2] + (B1[2] - A1[2]) * k) + ')';
    }
    // set up before any styled drawing (these sit below the early returns)
    var P0, HF, AIM, TB, TT, TS, TC;
    var REBELP = false;
    var CAMO = null;                 // a PMC hull's blotches, in the hull's own frame
    function styleInit() {
      REBELP = u.faction === 'rebel' && !dead;
      CAMO = camoFor();
      PATCH_FACE = !!(spec.craft || spec.heli);
      PATCH_GREY = tone('#8a8f96', '#62676e', '#3a3e44', '#747980'); PATCH_GREY.tex = 'steel';
      PATCH_RUST = tone('#9a6a44', '#7a4a2a', '#4a2c18', '#8a5a36'); PATCH_RUST.tex = 'rust';
      P0 = toScreen(at.x, at.y);
      HF = frameAt(0, 0, f);
      AIM = (u.aim == null || dead) ? f : u.aim;
      TB = tone(lit, hull, dark, mixc(hull, lit, 0.5));
      TT = tone(mixc(trim, lit, 0.35), trim, mixc(trim, dark, 0.6), mixc(trim, lit, 0.25));
      TS = tone(STEEL_LIT, mixc(STEEL, STEEL_LIT, 0.5), STEEL, mixc(STEEL, STEEL_LIT, 0.7));
      TC = tone(dead ? '#3a352d' : '#8a8062', dead ? '#2e2822' : '#6d654e', dead ? '#1d1a15' : '#4a4434', dead ? '#3a352d' : '#7b7359');
    }
    /* Digital camouflage on a company's machines and aircraft: small square
       cells of the army colour, darkened, laid on a grid over the hull —
       clusters of them, with singles stepping off the edges, the way a printed
       digital pattern breaks up. The cells sit in the hull's own frame and are
       seeded by the kind of machine, so a machine keeps its pattern as it
       turns and every one of a kind is painted alike. */
    function camoFor() {
      if (dead || (u.cls !== 'vehicle' && u.cls !== 'aircraft')) return null;
      if (u.faction && u.faction !== 'pmc') return null;
      var len = spec.len || 2, wid = spec.wid || 1.2, out = [], seen = {};
      /* A craft is painted to its wingtips, not to the width of its fuselage,
         and a rotorcraft out to its stub wings: the pattern is laid over
         everything the machine actually spreads across. */
      var reach = spec.craft ? (CRAFT_SPAN[spec.craft] || 1.4) : spec.heli ? 2.2 : 1.2;
      var seed = 0; String(u.art || '').split('').forEach(function (ch) { seed = (seed * 31 + ch.charCodeAt(0)) | 0; });
      var rnd = rng(seed ^ 0x5bd1e995);
      // a little past the machine's reach all round, so no edge of a deck or wing runs off the pattern
      var cols = Math.max(8, Math.round(len * 1.4 / CELL));
      var rows = Math.max(7, Math.round(wid * reach * 1.4 / CELL));
      /* Every block of three by three cells has exactly four filled, picked
         at random for the kind of machine: the cells still clump and scatter
         the way a printed digital pattern does, but no stretch of deck three
         cells across is ever left bare. */
      var salt = seed & 0xffff;
      for (var cx = -Math.ceil(cols / 2); cx <= Math.ceil(cols / 2); cx++) {
        for (var cy = -Math.ceil(rows / 2); cy <= Math.ceil(rows / 2); cy++) {
          var bx = Math.floor(cx / 3), by = Math.floor(cy / 3), me = hash(cx, cy, salt + bx * 7 + by * 13), below = 0;
          for (var ci = 0; ci < 3; ci++) for (var cj = 0; cj < 3; cj++) {
            if (hash(bx * 3 + ci, by * 3 + cj, salt + bx * 7 + by * 13) < me) below++;
          }
          if (below < 4) out.push({ p: cx * CELL, q: cy * CELL, zk: rnd() });
        }
      }
      return out;
    }
    /* The pattern over one face, clipped to it, in a shade of the face's own
       colour. On the top of a hull a cell lies flat, so it is projected as the
       square it is; on a side it is a block on the plate, drawn square to the
       screen — which is what a printed pattern looks like on a wall. */
    function camoOn(pts, col, z, top, h) {
      if (!CAMO || !pts || pts.length < 3) return;
      var x0 = pts[0][0], x1 = x0, y0 = pts[0][1], y1 = y0;
      for (var i = 1; i < pts.length; i++) {
        if (pts[i][0] < x0) x0 = pts[i][0]; else if (pts[i][0] > x1) x1 = pts[i][0];
        if (pts[i][1] < y0) y0 = pts[i][1]; else if (pts[i][1] > y1) y1 = pts[i][1];
      }
      var half = CELL * K * 0.5, pad = half * 2.2;
      g.save();
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]);
      g.closePath(); g.clip();
      g.fillStyle = mixc(col, '#16180f', 0.34);
      /* A plate standing up (a side, a front, a turret's cheek) takes the
         pattern on a grid of its own, square to the screen and pinned to the
         machine, so it is covered edge to edge as densely as the deck is:
         clumps of cells on a coarse grid, and singles scattered between. */
      if (!top) {
        var cs = half * 2;
        var gi0 = Math.floor((x0 - P0.x) / cs), gi1 = Math.ceil((x1 - P0.x) / cs);
        var gj0 = Math.floor((y0 - P0.y) / cs), gj1 = Math.ceil((y1 - P0.y) / cs);
        /* every block of three by three cells has exactly four of them
           filled, picked at random, so no stretch of plate three cells across
           is ever left bare, yet the cells still clump and scatter */
        var inBlock = function (gi2, gj2) {
          var bx = Math.floor(gi2 / 3), by = Math.floor(gj2 / 3);
          var me = hash(gi2, gj2, 772 + bx * 7 + by * 13), below = 0;
          for (var ci2 = 0; ci2 < 3; ci2++) for (var cj2 = 0; cj2 < 3; cj2++) {
            if (hash(bx * 3 + ci2, by * 3 + cj2, 772 + bx * 7 + by * 13) < me) below++;
          }
          return below < 4;
        };
        // a small plate may fall between the blocks' picks: it is topped up to
        // a third of the cells whose middles lie on it, the likeliest first
        var inside = function (px, py) {
          var hit = false;
          for (var pi = 0, pj = pts.length - 1; pi < pts.length; pj = pi++) {
            var xi = pts[pi][0], yi = pts[pi][1], xj = pts[pj][0], yj = pts[pj][1];
            if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) hit = !hit;
          }
          return hit;
        };
        var onFace = [], lit = 0;
        for (var gi = gi0; gi <= gi1; gi++) {
          for (var gj = gj0; gj <= gj1; gj++) {
            var on = inBlock(gi, gj);
            if (on) g.fillRect(P0.x + gi * cs, P0.y + gj * cs, cs, cs);
            if (inside(P0.x + (gi + 0.5) * cs, P0.y + (gj + 0.5) * cs)) {
              if (on) lit++; else onFace.push({ gi: gi, gj: gj, r: hash(gi, gj, 919) });
            }
          }
        }
        var want = Math.ceil((lit + onFace.length) * 0.34) - lit;
        if (want > 0) {
          onFace.sort(function (p1, p2) { return p1.r - p2.r; });
          for (var wk = 0; wk < want && wk < onFace.length; wk++) g.fillRect(P0.x + onFace[wk].gi * cs, P0.y + onFace[wk].gj * cs, cs, cs);
        }
        g.restore();
        return;
      }
      CAMO.forEach(function (b2) {
        // up the plate as well as along it, so a tall face is covered
        var c = S3(HF(b2.p, b2.q), z + (top ? 0 : (b2.zk - 0.5) * (h || 0)));
        // nowhere near this face: nothing to draw
        if (c[0] < x0 - pad || c[0] > x1 + pad || c[1] < y0 - pad || c[1] > y1 + pad) return;
        if (top) {
          var q1 = S3(HF(b2.p - CELL / 2, b2.q - CELL / 2), z);
          var q2 = S3(HF(b2.p + CELL / 2, b2.q - CELL / 2), z);
          var q3 = S3(HF(b2.p + CELL / 2, b2.q + CELL / 2), z);
          var q4 = S3(HF(b2.p - CELL / 2, b2.q + CELL / 2), z);
          g.beginPath();
          g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.lineTo(q3[0], q3[1]); g.lineTo(q4[0], q4[1]);
          g.closePath(); g.fill();
        } else {
          g.fillRect(c[0] - half, c[1] - half, half * 2, half * 2);
        }
      });
      g.restore();
    }
    function mount(kind, pt, dir) {
      if (!PH.mounts) return;
      (PH.mounts[kind] = PH.mounts[kind] || []).push({ dx: pt[0] - P0.x, dy: pt[1] - P0.y, dir: dir || 1 });
    }
    function S3(q, z) { var s2 = toScreen(q.x, q.y); return [s2.x, s2.y - z]; }
    // a frame: local (a forward, b across) about a pivot, turned to an angle
    function frameAt(t0, s0, ang) {
      var c0 = along(t0, s0), ca = Math.cos(ang), sa = Math.sin(ang);
      var fr = function (p, q) { return { x: c0.x + ca * p - sa * q, y: c0.y + sa * p + ca * q }; };
      fr.ang = ang; fr.t0 = t0; fr.s0 = s0;
      return fr;
    }
    function tone(lit2, mid2, dark2, top2) { return { lit: lit2, mid: mid2, dark: dark2, top: top2 }; }

    /* An extruded outline: a base ring and a top ring (the top may be smaller,
       or set back, so faces slope), shaded face by face by which way each one
       turns to the light, then the top. Returns the top ring on screen. */
    /* Rebel machines are patched together: each plate is the side's colour,
       bare grey steel or rusted brown, picked from where the plate sits so a
       machine looks the same from frame to frame. */
    var PATCH_GREY, PATCH_RUST, PATCH_FACE = false;
    function patch(tn, q, salt) {
      if (!REBELP || tn !== TB) return tn;
      /* keyed to where the plate sits on the hull itself — along it and across
         it — not on the table, so a plate keeps its colour as the machine
         moves and turns (a table position shifts every frame of a move) */
      var dx = q.x - at.x, dy = q.y - at.y;
      var la = dx * cos + dy * sin, lb = -dx * sin + dy * cos;
      var hq = hash(Math.floor(la * 4 + 0.37 + 64), Math.floor(Math.abs(lb) * 4 + 0.37) * (lb < 0 ? 3 : 1), salt | 0);
      return hq < 0.5 ? TB : hq < 0.75 ? PATCH_GREY : PATCH_RUST;
    }
    /* The scrap a rebel machine is patched from is not clean paint: the rusted
       brown is pitted and streaked, the bare grey is scuffed and spotted with
       weld and rivet heads. A fine texture laid over those plates, pinned to
       the machine so it rides along with it rather than swimming as it moves. */
    function texOn(pts, kind) {
      if (dead || !g.createPattern) return;
      var pat = texPattern(g, kind);
      if (!pat) return;
      if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translateSelf(Math.round(P0.x), Math.round(P0.y)));
      poly(g, pts, pat);
    }
    function prism(base, top2, z0, h, tn0, noTop) {
      var tn = tn0;
      var Bs = base.map(function (q) { return S3(q, z0); });
      var Ts = top2.map(function (q) { return S3(q, z0 + h); });
      var n = base.length, cx = 0, cy = 0;
      base.forEach(function (q) { cx += q.x; cy += q.y; }); cx /= n; cy /= n;
      var faces = [], ringSign = 0;
      for (var ri = 0; ri < n; ri++) { var ra = Bs[ri], rb = Bs[(ri + 1) % n]; ringSign += ra[0] * rb[1] - rb[0] * ra[1]; }
      ringSign = ringSign < 0 ? RING_VIS : -RING_VIS;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n, a1 = base[i], b1 = base[j];
        var ex = b1.x - a1.x, ey = b1.y - a1.y, nx = ey, ny = -ex;
        if (nx * ((a1.x + b1.x) / 2 - cx) + ny * ((a1.y + b1.y) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
        var ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
        var sx = nx - ny, sy = (nx + ny) / 2;
        /* A face is seen when it turns toward the viewer on the screen. For a
           raked face (a glacis, a sloped tail) that depends on its slope as
           well as its facing, so it is judged from the projected quad itself:
           wound the same way as a face known to point at the viewer. */
        var q = [Bs[i], Bs[j], Ts[j], Ts[i]], ar = 0;
        for (var qi = 0; qi < 4; qi++) { var qa = q[qi], qb = q[(qi + 1) % 4]; ar += qa[0] * qb[1] - qb[0] * qa[1]; }
        if (ar * ringSign <= 0.5) continue;
        faces.push({ i: i, j: j, sx: sx, d: a1.x + b1.x + a1.y + b1.y });
      }
      faces.sort(function (p, q) { return p.d - q.d; });
      faces.forEach(function (fc) {
        var k = clamp01(0.5 - fc.sx * 0.42);
        /* ground machines are patched plate by plate (one prism, one plate);
           a flier's skin is patched face by face, so its few big panels vary */
        var pa = PATCH_FACE ? base[fc.i] : a1, pb = PATCH_FACE ? base[fc.j] : b1;
        // (salted by the plate's height on the hull itself, not above the ground: a machine
        // flying higher, or hopping as it walks, keeps its own colours)
        var ft = patch(tn0, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, Math.round(z0 - lift) + 3);
        var colr = k > 0.5 ? mixc(ft.mid, ft.lit, (k - 0.5) * 2) : mixc(ft.dark, ft.mid, k * 2);
        var face = [Bs[fc.i], Bs[fc.j], Ts[fc.j], Ts[fc.i]];
        poly(g, face, colr);
        if (ft.tex) texOn(face, ft.tex);
        if (CAMO && (tn0 === TB || tn0 === TT)) camoOn(face, colr, z0 + h * 0.5, false, h);
        if (h > 2) {
          var yT = Math.min(face[2][1], face[3][1]), yB = Math.max(face[0][1], face[1][1]);
          if (yB - yT > 1) {
            var gr = g.createLinearGradient(0, yT, 0, yB);
            gr.addColorStop(0, 'rgba(255,246,228,' + (0.05 + k * 0.1) + ')');
            gr.addColorStop(0.55, 'rgba(0,0,0,0)');
            gr.addColorStop(1, 'rgba(6,8,12,.26)');
            poly(g, face, gr);
          }
        }
        edge(g, Ts[fc.i], Ts[fc.j], 'rgba(255,240,214,' + (0.2 + k * 0.4) + ')', 0.7);
        edge(g, Bs[fc.i], Bs[fc.j], 'rgba(4,6,10,.5)', 0.7);
      });
      if (!noTop && tn.top) {
        var cxT = 0, cyT = 0; base.forEach(function (q) { cxT += q.x; cyT += q.y; });
        var topT = patch(tn0, { x: cxT / base.length, y: cyT / base.length }, Math.round(z0 + h - lift) + 11), topCol = topT.top;
        poly(g, Ts, topCol);
        if (topT.tex) texOn(Ts, topT.tex);
        if (CAMO && (tn0 === TB || tn0 === TT)) camoOn(Ts, topCol, z0 + h, true);
        var ys = Ts.map(function (q) { return q[1]; });
        var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        if (y1 - y0 > 1) {
          var gt = g.createLinearGradient(0, y0, 0, y1);
          gt.addColorStop(0, 'rgba(255,248,232,.16)');
          gt.addColorStop(1, 'rgba(0,0,0,.1)');
          poly(g, Ts, gt);
        }
      }
      return Ts;
    }
    // an outline given as [a, b] pairs in a frame, extruded; the top is the
    // same outline scaled toward its middle (sc) or a second outline (topPts)
    function shape(fr, pts, z0, h, tn, sc, topPts, noTop) {
      var ma = 0, mb = 0;
      pts.forEach(function (q) { ma += q[0]; mb += q[1]; }); ma /= pts.length; mb /= pts.length;
      var base = pts.map(function (q) { return fr(q[0], q[1]); });
      var tp = topPts || pts.map(function (q) {
        var k = sc == null ? 1 : sc;
        return [ma + (q[0] - ma) * k, mb + (q[1] - mb) * k];
      });
      return prism(base, tp.map(function (q) { return fr(q[0], q[1]); }), z0, h, tn, noTop);
    }
    function rectPts(a0, a1, b0, b1) { return [[a1, b0], [a1, b1], [a0, b1], [a0, b0]]; }
    // a box in a frame, with its top pulled in at the front (fr0) and back (bk0)
    function slabF(fr, a0, a1, b0, b1, z0, h, tn, frontIn, backIn, sideIn, noTop) {
      var si = sideIn || 0;
      return shape(fr, rectPts(a0, a1, b0, b1), z0, h, tn, null,
        rectPts(a0 + (backIn || 0), a1 - (frontIn || 0), b0 + si, b1 - si), noTop);
    }
    function sEllipse(x, y, rx, ry, c) {
      g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill();
    }
    function line(p1, p2, w, c, cap) {
      g.strokeStyle = c; g.lineWidth = w; g.lineCap = cap || 'round';
      g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
      g.lineCap = 'butt';
    }
    /* A gun barrel from a0 to a1 along a frame, at height z, rising `up` px to
       the muzzle. Drawn smooth, with a lit top line, an optional fume
       extractor and muzzle brake; the muzzle is recorded as a mount. */
    /* Cooling vents down an energy barrel: n small blue slots set into it,
       each well inside the barrel's width and clear of the next, the way the
       advanced combat vehicle's plasma cannon shows them. */
    function vents(fr, a0, a1, b, z, w, n, up) {
      if (dead) return;
      for (var vi = 1; vi <= n; vi++) {
        var k = vi / (n + 1), vp = S3(fr(a0 + (a1 - a0) * k, b), z + (up || 0) * k);
        sEllipse(vp[0], vp[1], w * 0.4, w * 0.34, '#0c1016');
        sEllipse(vp[0], vp[1], w * 0.28, w * 0.22, 'rgba(120,230,255,.85)');
      }
    }
    function barrel(fr, a0, a1, b, z, w, kind, o) {
      o = o || {};
      var up = o.up || 0;
      var p1 = S3(fr(a0, b), z), p2 = S3(fr(a1, b), z + up);
      line(p1, p2, w + 1.2, '#0c0f13');
      line(p1, p2, w, o.col || '#20252d');
      line([p1[0], p1[1] - w * 0.3], [p2[0], p2[1] - w * 0.3], Math.max(0.6, w * 0.3), o.lit || '#4a535f');
      if (o.fume) {
        var fp = S3(fr(a0 + (a1 - a0) * o.fume, b), z + up * o.fume);
        sEllipse(fp[0], fp[1], w * 0.95, w * 0.8, '#1a1e25');
        sEllipse(fp[0] - w * 0.2, fp[1] - w * 0.25, w * 0.4, w * 0.3, '#48515c');
      }
      if (o.brake) {
        var bp = S3(fr(a1 - 0.04, b), z + up);
        sEllipse(bp[0], bp[1], w * 1.05, w * 0.9, '#15181e');
        sEllipse(bp[0] - w * 0.25, bp[1] - w * 0.3, w * 0.45, w * 0.35, '#525b67');
      }
      if (kind) mount(kind, p2, p2[0] >= p1[0] ? 1 : -1);
      return p2;
    }
    /* A box of launch tubes: a slab with its front face drilled with rows of
       tube mouths. Each mouth is a mount. `up` tilts the box toward the sky. */
    function launcher(fr, a0, a1, b0, b1, z, h, rows, cols, kind, o) {
      o = o || {};
      var tilt = o.up || 0;
      var tn = o.tone || TS;
      // the box, with its front raised by tilt: done as a slanted prism
      var pts = rectPts(a0, a1, b0, b1);
      var base = pts.map(function (q) { return fr(q[0], q[1]); });
      var Bs = base.map(function (q, i) { return S3(q, z + (i < 2 ? tilt : 0)); });
      var Ts = base.map(function (q, i) { return S3(q, z + h + (i < 2 ? tilt : 0)); });
      var cx = 0, cy = 0; base.forEach(function (q) { cx += q.x; cy += q.y; }); cx /= 4; cy /= 4;
      var faces = [];
      for (var i = 0; i < 4; i++) {
        var j = (i + 1) % 4, p1 = base[i], p2 = base[j];
        var nx = p2.y - p1.y, ny = -(p2.x - p1.x);
        if (nx * ((p1.x + p2.x) / 2 - cx) + ny * ((p1.y + p2.y) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
        var ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
        faces.push({ i: i, j: j, sx: nx - ny, sy: (nx + ny) / 2, front: i === 0, d: p1.x + p2.x + p1.y + p2.y });
      }
      faces.sort(function (p, q) { return p.d - q.d; });
      var frontVisible = false;
      // a face is seen when it winds toward the viewer on the screen: this
      // holds for a box tilted up at the front as well as for a level one
      var rs = 0;
      for (var ri = 0; ri < 4; ri++) { var ra = Bs[ri], rb = Bs[(ri + 1) % 4]; rs += ra[0] * rb[1] - rb[0] * ra[1]; }
      var ringSign = rs < 0 ? RING_VIS : -RING_VIS;
      faces.forEach(function (fc) {
        var fq = [Bs[fc.i], Bs[fc.j], Ts[fc.j], Ts[fc.i]], ar = 0;
        for (var qi = 0; qi < 4; qi++) { var qa = fq[qi], qb = fq[(qi + 1) % 4]; ar += qa[0] * qb[1] - qb[0] * qa[1]; }
        if (ar * ringSign <= 0.5) return;
        var k = clamp01(0.5 - fc.sx * 0.42);
        var lcol = k > 0.5 ? mixc(tn.mid, tn.lit, (k - 0.5) * 2) : mixc(tn.dark, tn.mid, k * 2);
        poly(g, fq, lcol);
        if (CAMO && (tn === TB || tn === TT)) camoOn(fq, lcol, z + h * 0.5, false, h);
        edge(g, Ts[fc.i], Ts[fc.j], 'rgba(255,240,214,.3)', 0.6);
        if (fc.front) frontVisible = true;
      });
      poly(g, Ts, tn.top);
      if (CAMO && (tn === TB || tn === TT)) camoOn(Ts, tn.top, z + h, true);
      edge(g, Ts[0], Ts[1], 'rgba(255,240,214,.45)', 0.6);
      // the tube mouths on the front face (corners 0,1 at the front)
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var u1 = (c + 0.5) / cols, v1 = (r + 0.5) / rows;
          var lo = [Bs[0][0] + (Bs[1][0] - Bs[0][0]) * u1, Bs[0][1] + (Bs[1][1] - Bs[0][1]) * u1];
          var hi = [Ts[0][0] + (Ts[1][0] - Ts[0][0]) * u1, Ts[0][1] + (Ts[1][1] - Ts[0][1]) * u1];
          var mp = [lo[0] + (hi[0] - lo[0]) * v1, lo[1] + (hi[1] - lo[1]) * v1];
          if (frontVisible || o.showTubes) {
            var rr = Math.max(0.8, Math.min(Math.hypot(Bs[1][0] - Bs[0][0], Bs[1][1] - Bs[0][1]) / cols,
              Math.abs(hi[1] - lo[1]) / rows) * 0.36);
            sEllipse(mp[0], mp[1], rr, rr * 0.85, '#0a0c10');
            if (o.warheads) sEllipse(mp[0] - rr * 0.2, mp[1] - rr * 0.2, rr * 0.55, rr * 0.45, o.warheads);
          }
          if (kind) mount(kind, mp, Bs[1][0] + Bs[0][0] > Bs[2][0] + Bs[3][0] ? 1 : -1);
        }
      }
      return Ts;
    }
    function aerial(fr, p, q, z, len, lean) {
      var b0 = S3(fr(p, q), z), b1 = S3(fr(p - (lean || 0.12), q), z + len);
      line(b0, b1, 0.8, STEEL_LIT);
      sEllipse(b0[0], b0[1], 1.4, 0.8, STEEL);
      sEllipse(b1[0], b1[1], 0.9, 0.9, dead ? STEEL : '#9aa6b4');
    }
    function lights(fr, p, q, z) {
      var lp = S3(fr(p, q), z);
      sEllipse(lp[0], lp[1], 1.4, 1.1, dead ? STEEL : '#f0e2b4');
    }
    function hatch(fr, p, q, z, r) {
      var hp = S3(fr(p, q), z);
      sEllipse(hp[0], hp[1] + 0.5, r * K, r * K * 0.55, 'rgba(8,10,14,.45)');
      sEllipse(hp[0], hp[1], r * K, r * K * 0.55, mixc(hull, dark, 0.35));
      sEllipse(hp[0] - r * K * 0.2, hp[1] - r * K * 0.12, r * K * 0.55, r * K * 0.28, mixc(hull, lit, 0.4));
    }
    function grille(fr, a0, a1, b0, b1, z, n) {
      var pts = rectPts(a0, a1, b0, b1).map(function (q) { return S3(fr(q[0], q[1]), z); });
      poly(g, pts, STEEL);
      for (var i = 1; i < n; i++) {
        var k = i / n;
        edge(g, [pts[0][0] + (pts[3][0] - pts[0][0]) * k, pts[0][1] + (pts[3][1] - pts[0][1]) * k],
          [pts[1][0] + (pts[2][0] - pts[1][0]) * k, pts[1][1] + (pts[2][1] - pts[1][1]) * k], STEEL_LIT, 0.6);
      }
    }
    // a red cross panel laid on a roof
    function crossOn(fr, p, q, z, sz) {
      var pts = rectPts(p - sz, p + sz, q - sz, q + sz).map(function (r) { return S3(fr(r[0], r[1]), z); });
      poly(g, pts, '#e8e3d8');
      var arm1 = rectPts(p - sz * 0.75, p + sz * 0.75, q - sz * 0.25, q + sz * 0.25).map(function (r) { return S3(fr(r[0], r[1]), z); });
      var arm2 = rectPts(p - sz * 0.25, p + sz * 0.25, q - sz * 0.75, q + sz * 0.75).map(function (r) { return S3(fr(r[0], r[1]), z); });
      poly(g, arm1, '#c23a32'); poly(g, arm2, '#c23a32');
    }
    // hexagonal armour tiles set into a flank (future hulls): outlines on the lit side
    function hexFlank(fr, a0, a1, bSide, z0, h, cols) {
      var n = cols || 6, step = (a1 - a0) / n;
      for (var i = 0; i < n; i++) {
        for (var r = 0; r < 2; r++) {
          var ca = a0 + step * (i + 0.5 + (r ? 0.5 : 0)), cz = z0 + h * (r ? 0.3 : 0.72);
          if (ca > a1 - step * 0.3) continue;
          var pts = [];
          for (var k = 0; k < 6; k++) {
            var ang = k * Math.PI / 3;
            var q = S3(fr(ca + Math.cos(ang) * step * 0.46, bSide), cz + Math.sin(ang) * h * 0.24);
            pts.push(q);
          }
          poly(g, pts, 'rgba(255,248,232,.07)');
          for (var e2 = 0; e2 < 6; e2++) edge(g, pts[e2], pts[(e2 + 1) % 6], 'rgba(10,12,16,.35)', 0.6);
        }
      }
    }

    /* The same tiles across the nose: laid on the (raked) front plate, which runs
       from aBot at the foot up and back to aTop, across b0..b1. Only drawn when
       the nose is towards the eye. */
    function hexNose(fr, aBot, aTop, b0, b1, z0, h, cols) {
      if ((cos + sin) <= 0) return;
      cols = cols || 5;                                  // the upper row; the lower, set between, has one fewer
      var rows = 2, cw = (b1 - b0) / cols;
      for (var r = 0; r < rows; r++) {
        for (var i = 0; i < cols; i++) {
          var cb = b0 + cw * (i + 0.5 + (r ? 0.5 : 0)), cu = r ? 0.3 : 0.72;
          if (cb > b1 - cw * 0.3) continue;
          var pts = [];
          for (var k = 0; k < 6; k++) {
            var ang = k * Math.PI / 3, u = cu + Math.sin(ang) * 0.24;
            pts.push(S3(fr(aBot + (aTop - aBot) * u, cb + Math.cos(ang) * cw * 0.46), z0 + h * u));
          }
          poly(g, pts, 'rgba(255,248,232,.07)');
          for (var e2 = 0; e2 < 6; e2++) edge(g, pts[e2], pts[(e2 + 1) % 6], 'rgba(10,12,16,.35)', 0.6);
        }
      }
    }

    /* Hex tiles laid on one face, raked or upright: its bottom edge runs p0 to
       p1 and its top edge q0 to q1 (each [a, b] in the frame), from z0 up h.
       `rows` gives the tiles in each row, top row first, set between each other. */
    function hexPanel(fr, p0, p1, q0, q1, z0, h, rows) {
      var nr = rows.length, mx = Math.max.apply(null, rows);
      function at(t, uu) {
        var a = p0[0] + (p1[0] - p0[0]) * t, b = p0[1] + (p1[1] - p0[1]) * t;
        var a2 = q0[0] + (q1[0] - q0[0]) * t, b2 = q0[1] + (q1[1] - q0[1]) * t;
        return S3(fr(a + (a2 - a) * uu, b + (b2 - b) * uu), z0 + h * uu);
      }
      rows.forEach(function (n, r) {
        var u = nr === 1 ? 0.5 : 0.74 - r * (0.48 / (nr - 1)), ru = nr === 1 ? 0.34 : 0.24;
        for (var i = 0; i < n; i++) {
          var t = 0.5 + (i - (n - 1) / 2) / mx, pts = [];
          for (var k = 0; k < 6; k++) {
            var ang = k * Math.PI / 3;
            pts.push(at(t + Math.cos(ang) * 0.46 / mx, u + Math.sin(ang) * ru));
          }
          poly(g, pts, 'rgba(255,248,232,.07)');
          for (var e2 = 0; e2 < 6; e2++) edge(g, pts[e2], pts[(e2 + 1) % 6], 'rgba(10,12,16,.35)', 0.6);
        }
      });
    }

    /* A door on the back of a hull, drawn when the back is towards the eye: the
       face is at aR (the hull's rear), halfW either side of the middle, from z0
       up h. 'ramp' is an APC's drop ramp with a crew door let into it, 'double'
       a pair of cargo doors, 'canvas' a tarpaulin's rear flaps over a tailgate. */
    function rearDoor(fr, aR, halfW, z0, h, kind) {
      if ((cos + sin) >= -0.02) return;
      var a = aR - 0.006;
      function P(b, z) { return S3(fr(a, b), z); }
      var DK = 'rgba(10,9,7,.6)', LT = 'rgba(255,248,232,.16)', MET = '#2a2f37';
      function frame(b0, b1, zb, zt) {
        edge(g, P(b0, zb), P(b0, zt), DK, 1); edge(g, P(b1, zb), P(b1, zt), DK, 1);
        edge(g, P(b0, zt), P(b1, zt), DK, 1); edge(g, P(b0, zb), P(b1, zb), DK, 1);
        edge(g, P(b0 + halfW * 0.04, zt - 1), P(b1 - halfW * 0.04, zt - 1), LT, 0.7);
      }
      function handle(b, z) { var q = P(b, z); poly(g, [[q[0] - 1.4, q[1] - 0.6], [q[0] + 1.4, q[1] - 0.6], [q[0] + 1.4, q[1] + 0.6], [q[0] - 1.4, q[1] + 0.6]], MET); }
      function hinge(b, z) { var q = P(b, z); poly(g, [[q[0] - 0.9, q[1] - 1.1], [q[0] + 0.9, q[1] - 1.1], [q[0] + 0.9, q[1] + 1.1], [q[0] - 0.9, q[1] + 1.1]], MET); }
      if (kind === 'ramp') {
        // the ramp, hinged along its foot, and the crew door let into one side of it
        frame(-halfW, halfW, z0, z0 + h);
        line(P(-halfW * 0.9, z0 + 1), P(halfW * 0.9, z0 + 1), 1.6, MET);
        frame(halfW * 0.08, halfW * 0.78, z0 + h * 0.12, z0 + h * 0.86);
        handle(halfW * 0.2, z0 + h * 0.5);
        line(P(halfW * 0.34, z0 + h * 0.7), P(halfW * 0.6, z0 + h * 0.7), 1.3, '#0b0e12');   // a vision block
      } else if (kind === 'double') {
        frame(-halfW, 0, z0, z0 + h); frame(0, halfW, z0, z0 + h);
        [-1, 1].forEach(function (sd) {
          hinge(sd * halfW * 0.92, z0 + h * 0.22); hinge(sd * halfW * 0.92, z0 + h * 0.78);
          handle(sd * halfW * 0.14, z0 + h * 0.5);
        });
      } else {
        // the canvas: two flaps meeting down the middle, laced shut, over a tailgate with its latches
        edge(g, P(0, z0 + h * 0.3), P(0, z0 + h), DK, 1.1);
        for (var k = 0; k < 4; k++) { var z = z0 + h * (0.4 + 0.15 * k); line(P(-halfW * 0.06, z), P(halfW * 0.06, z), 0.8, 'rgba(40,34,24,.8)'); }
        edge(g, P(-halfW, z0 + h * 0.28), P(halfW, z0 + h * 0.28), DK, 1);
        handle(-halfW * 0.7, z0 + h * 0.18); handle(halfW * 0.7, z0 + h * 0.18);
      }
    }

    function nearSide() { return (cos - sin) > 0 ? 1 : -1; }   // which flank faces the eye
    // the same, for something turned to its own angle (a traversed mount)
    function nearSideAt(ang) { return (Math.cos(ang) - Math.sin(ang)) > 0 ? 1 : -1; }

    /* A light engineering vehicle's flame fuel: one big armoured tank slung
       across the back of the hull on brackets, strapped. It goes down before
       the hull when the nose is towards the eye (the hull hides it) and after
       it when the back is. */
    function rearTank() {
      var L = spec.len, w = spec.wid * 0.47, zc = deck + spec.hgt * 0.5;
      var aT = -L * 0.5 - 0.16;
      var c1 = S3(HF(aT, -w * 0.86), zc), c2 = S3(HF(aT, w * 0.86), zc);
      // the brackets, back to the hull
      [-0.6, 0.6].forEach(function (k) {
        line(S3(HF(-L * 0.5, w * k), zc - 3), S3(HF(aT, w * k), zc - 3), 2, '#23271f');
      });
      var R = 7.5;
      sEllipse(c1[0], c1[1], R * 0.55, R, '#2f342e');
      line(c1, c2, R * 2, '#3a3f38');
      line([c1[0], c1[1] - R * 0.55], [c2[0], c2[1] - R * 0.55], 2.2, '#6a7064');
      line([c1[0], c1[1] + R * 0.6], [c2[0], c2[1] + R * 0.6], 1.6, '#262a24');
      sEllipse(c2[0], c2[1], R * 0.55, R, '#454b43');
      sEllipse(c2[0] - 0.8, c2[1] - 1.2, R * 0.3, R * 0.5, '#5a6157');
      [-0.45, 0, 0.45].forEach(function (k) {
        var q = S3(HF(aT, w * k), zc);
        line([q[0], q[1] - R], [q[0], q[1] + R], 1.3, '#1d211b');
      });
      // the filler cap on top
      var fc = S3(HF(aT, -w * 0.3), zc + 5);
      sEllipse(fc[0], fc[1] - 1, 2, 1.3, '#23271f');
    }
    function styledHull() {
      var L = spec.len, Wd = spec.wid, H = spec.hgt, z0 = deck, st = spec.style;
      var w = Wd * 0.47;
      switch (st.body) {
        case 'pickup': {
          /* bonnet, cab, and an open bed with low sides — laid down far to
             near, so whichever end faces the viewer is drawn over the other */
          var fwdP = cos + sin, nsP = nearSide();
          /* On anything but wheels the bonnet has nowhere to go: the cab sits
             right at the front of the hull, and the bed runs up behind it. */
          var cabFwd = drive !== 'wheeled';
          var cA0 = cabFwd ? L * 0.2 : -L * 0.1, cA1 = cabFwd ? L * 0.5 : L * 0.2, bedA1 = cabFwd ? L * 0.2 : -L * 0.1;
          var cs = cA1 - L * 0.2;                          // how far the cab has moved forward
          var bonnet = function () {
            if (cabFwd) {                                   // headlights on the cab's face instead
              lights(HF, L * 0.5, -w * 0.62, z0 + H * 0.4); lights(HF, L * 0.5, w * 0.62, z0 + H * 0.4);
              return;
            }
            slabF(HF, L * 0.16, L * 0.5, -w * 0.92, w * 0.92, z0, H * 0.62, TB, L * 0.05, 0, w * 0.05);
            lights(HF, L * 0.5, -w * 0.62, z0 + H * 0.4); lights(HF, L * 0.5, w * 0.62, z0 + H * 0.4);
            if (fwdP > 0.02) { var grl = S3(HF(L * 0.5, 0), z0 + H * 0.35); sEllipse(grl[0], grl[1], 3, 1.6, STEEL); }
          };
          var cab = function () {
            // a drone has no one to sit in a cab: an armoured block the height of the bonnet instead
            if (u.drone) { slabF(HF, cA0, cA1, -w * 0.9, w * 0.9, z0, H * 0.7, TB, L * 0.04, 0, w * 0.06); return; }
            slabF(HF, cA0, cA1, -w, w, z0, H * 1.25, TB, L * 0.1, 0.02, w * 0.1);
            if (fwdP > 0.02) {                              // the windscreen, only when the front faces us
              var wsA = S3(HF(cs + L * 0.19, -w * 0.8), z0 + H * 0.68), wsB = S3(HF(cs + L * 0.19, w * 0.8), z0 + H * 0.68);
              var wsC = S3(HF(cs + L * 0.105, w * 0.72), z0 + H * 1.2), wsD = S3(HF(cs + L * 0.105, -w * 0.72), z0 + H * 1.2);
              poly(g, [wsA, wsB, wsC, wsD], GLASS);
              edge(g, wsD, wsC, GLINT, 0.8);
            }
            var sw1 = S3(HF(cs + L * 0.14, nsP * w * 0.99), z0 + H * 0.72), sw2 = S3(HF(cs - L * 0.06, nsP * w * 0.99), z0 + H * 0.72);
            var sw3 = S3(HF(cs - L * 0.06, nsP * w * 0.92), z0 + H * 1.12), sw4 = S3(HF(cs + L * 0.1, nsP * w * 0.92), z0 + H * 1.12);
            poly(g, [sw1, sw2, sw3, sw4], GLASS);
          };
          var bed = function () {
            slabF(HF, -L * 0.5, bedA1, -w, w, z0, H * 0.45, TB, 0, 0, 0);
            var bz = z0 + H * 0.45;
            var walls = [
              { d: -nsP * 1, fn: function () { slabF(HF, -L * 0.5, bedA1, -nsP * w, -nsP * (w - 0.05), bz, H * 0.35, TB); } },
              { d: -fwdP * L * 0.48, fn: function () { slabF(HF, -L * 0.5, -L * 0.46, -w, w, bz, H * 0.35, TB); } },
              { d: nsP * 1, fn: function () { slabF(HF, -L * 0.5, bedA1, nsP * (w - 0.05), nsP * w, bz, H * 0.35, TB); } }
            ];
            walls.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
          };
          [{ t: L * 0.33, fn: bonnet }, { t: (cA0 + cA1) / 2, fn: cab }, { t: (bedA1 - L * 0.5) / 2, fn: bed }]
            .sort(function (p, q) { return p.t * fwdP - q.t * fwdP; })
            .forEach(function (p) { p.fn(); });
          return;
        }
        case 'truck': {
          var heavy = !!st.heavy;
          var cabL = heavy ? 0.3 : 0.26;
          var fwdT = cos + sin, nsT = nearSide();
          var bedA0 = -L * 0.5, bedA1 = L * (0.5 - cabL) - 0.04;
          var tbonnet = function () {
            slabF(HF, L * (0.5 - cabL * 0.45), L * 0.5, -w * 0.86, w * 0.86, z0, H * 0.7, TB, L * 0.03, 0, w * 0.06);
            lights(HF, L * 0.5, -w * 0.6, z0 + H * 0.45); lights(HF, L * 0.5, w * 0.6, z0 + H * 0.45);
          };
          var tcab = function () {
            slabF(HF, L * (0.5 - cabL), L * (0.5 - cabL * 0.42), -w * 0.96, w * 0.96, z0, H * 1.45, TB, L * 0.03, 0, w * 0.04);
            if (fwdT > 0.02) {
              var fA = L * (0.5 - cabL * 0.42) - 0.005;
              var g1 = S3(HF(fA, -w * 0.8), z0 + H * 0.85), g2 = S3(HF(fA, w * 0.8), z0 + H * 0.85);
              var g3 = S3(HF(fA - L * 0.03, w * 0.78), z0 + H * 1.4), g4 = S3(HF(fA - L * 0.03, -w * 0.78), z0 + H * 1.4);
              poly(g, [g1, g2, g3, g4], GLASS); edge(g, g4, g3, GLINT, 0.8);
            }
          };
          var tbed = function () {
            slabF(HF, bedA0, bedA1, -w, w, z0, H * 0.4, TB);
            var boxH = H * (heavy ? 1.35 : 1.15), topZ = z0 + H * (heavy ? 1.75 : 1.55);
            if (st.armourBox) {
              /* an armoured cargo box in the force colour: slab sides, a
                 panel seam along it, vision slits and a rear door */
              slabF(HF, bedA0 + 0.02, bedA1 - 0.02, -w * 0.98, w * 0.98, z0 + H * 0.4, boxH, TB, 0.01, 0, w * 0.05);
              bandOnSides(g, box((bedA0 + bedA1) / 2, 0, bedA1 - bedA0 - 0.04, w * 1.96), z0 + H * 0.4 + boxH * 0.55, 2, 2, trim);
              for (var sl = 1; sl < 4; sl++) {
                var sa = bedA0 + (bedA1 - bedA0) * sl / 4;
                var s1 = S3(HF(sa - 0.06, nsT * w * 0.985), z0 + H * 0.4 + boxH * 0.72), s2 = S3(HF(sa + 0.06, nsT * w * 0.985), z0 + H * 0.4 + boxH * 0.72);
                line(s1, s2, 1.4, '#15181e');
              }
              if (spec.rearDoor) rearDoor(HF, bedA0 + 0.02, w * 0.72, z0 + H * 0.45, boxH - 3, 'double');
              else if (fwdT < 0) {
                var d1 = S3(HF(bedA0 + 0.015, -w * 0.4), z0 + H * 0.5), d2 = S3(HF(bedA0 + 0.015, w * 0.4), z0 + H * 0.5);
                var d3 = S3(HF(bedA0 + 0.015, w * 0.4), z0 + H * 0.4 + boxH - 2), d4 = S3(HF(bedA0 + 0.015, -w * 0.4), z0 + H * 0.4 + boxH - 2);
                edge(g, d1, d4, 'rgba(10,9,7,.5)', 0.8); edge(g, d2, d3, 'rgba(10,9,7,.5)', 0.8); edge(g, d4, d3, 'rgba(10,9,7,.5)', 0.8);
              }
              return;
            }
            slabF(HF, bedA0 + 0.02, bedA1 - 0.02, -w * 0.98, w * 0.98, z0 + H * 0.4, boxH, TC, 0, 0, w * 0.1);
            if (spec.rearDoor) rearDoor(HF, bedA0 + 0.02, w * 0.9, z0 + 1, H * 0.4 + boxH - 2, 'canvas');
            // hoops showing through the canvas
            var hoops = heavy ? 5 : 4;
            for (var hp = 1; hp < hoops; hp++) {
              var ha = bedA0 + (bedA1 - bedA0) * hp / hoops;
              edge(g, S3(HF(ha, nsT * w * 0.98), z0 + H * 0.45), S3(HF(ha, nsT * w * 0.88), topZ), 'rgba(40,36,26,.45)', 0.8);
              edge(g, S3(HF(ha, -w * 0.88), topZ), S3(HF(ha, w * 0.88), topZ), 'rgba(40,36,26,.35)', 0.8);
            }
          };
          [{ t: L * (0.5 - cabL * 0.2), fn: tbonnet }, { t: L * (0.5 - cabL * 0.7), fn: tcab }, { t: (bedA0 + bedA1) / 2, fn: tbed }]
            .sort(function (p, q) { return p.t * fwdT - q.t * fwdT; })
            .forEach(function (p) { p.fn(); });
          return;
        }
        case 'guntruck': {
          var fwdG = cos + sin, nsG = nearSide(), hv = !!st.heavy;
          var cabL = hv ? 0.28 : 0.3, bedA0 = -L * 0.5, bedA1 = L * (0.5 - cabL) - 0.03;
          var RUST = tone('#9a6a44', '#7a4a2a', '#4a2c18', '#8a5a36'); RUST.tex = 'rust';
          var PLATE = tone('#8a8f96', '#62676e', '#3a3e44', '#747980'); PLATE.tex = 'steel';
          if (st.flatCab) cabL = 0.24;
          if (st.flatCab) bedA1 = L * (0.5 - cabL) - 0.03;
          var gbonnet = function () {
            if (st.flatCab) {
              // a cab-over: no bonnet, just a plated bumper across the flat front
              slabF(HF, L * 0.48, L * 0.53, -w * 0.94, w * 0.94, z0 - 2, H * 0.5, PLATE, 0, 0, 0);
              lights(HF, L * 0.53, -w * 0.66, z0 + H * 0.3); lights(HF, L * 0.53, w * 0.66, z0 + H * 0.3);
              return;
            }
            slabF(HF, L * (0.5 - cabL * 0.45), L * 0.5, -w * 0.86, w * 0.86, z0, H * 0.72, TB, L * 0.03, 0, w * 0.06);
            // a plough of plate across the grille
            slabF(HF, L * 0.47, L * 0.52, -w * 0.9, w * 0.9, z0 - 2, H * 0.55, PLATE, 0.01, 0, 0);
            lights(HF, L * 0.52, -w * 0.62, z0 + H * 0.5); lights(HF, L * 0.52, w * 0.62, z0 + H * 0.5);
          };
          var gcab = function () {
            if (u.drone) {                                   // no crew, no cab: plated over at bonnet height
              slabF(HF, L * (0.5 - cabL), L * (0.5 - cabL * 0.42), -w * 0.9, w * 0.9, z0, H * 0.78, TB, L * 0.03, 0, w * 0.06);
              return;
            }
            if (st.flatCab) {
              // a straight, square cab right at the front, its face plated with a slit
              slabF(HF, L * (0.5 - cabL), L * 0.5, -w * 0.98, w * 0.98, z0, H * 1.6, TB, 0.005, 0, w * 0.03);
              if (fwdG > 0.02) {
                var fF = L * 0.5 + 0.004;
                var h1 = S3(HF(fF, -w * 0.9), z0 + H * 0.95), h2 = S3(HF(fF, w * 0.9), z0 + H * 0.95);
                var h3 = S3(HF(fF, w * 0.9), z0 + H * 1.5), h4 = S3(HF(fF, -w * 0.9), z0 + H * 1.5);
                poly(g, [h1, h2, h3, h4], PLATE.mid);
                line(S3(HF(fF, -w * 0.7), z0 + H * 1.25), S3(HF(fF, w * 0.7), z0 + H * 1.25), 1.8, '#101216');
                edge(g, h1, h4, '#3a2a1c', 0.8); edge(g, h2, h3, '#3a2a1c', 0.8);
              }
              return;
            }
            slabF(HF, L * (0.5 - cabL), L * (0.5 - cabL * 0.42), -w * 0.96, w * 0.96, z0, H * 1.45, TB, L * 0.03, 0, w * 0.04);
            if (fwdG > 0.02) {
              // plate welded over the windscreen, two slits cut in it
              var fA = L * (0.5 - cabL * 0.42) + 0.005;
              var g1 = S3(HF(fA, -w * 0.84), z0 + H * 0.8), g2 = S3(HF(fA, w * 0.84), z0 + H * 0.8);
              var g3 = S3(HF(fA - L * 0.03, w * 0.82), z0 + H * 1.42), g4 = S3(HF(fA - L * 0.03, -w * 0.82), z0 + H * 1.42);
              poly(g, [g1, g2, g3, g4], PLATE.mid);
              [-0.45, 0.45].forEach(function (b) {
                line(S3(HF(fA - L * 0.015, w * (b - 0.25)), z0 + H * 1.15), S3(HF(fA - L * 0.015, w * (b + 0.25)), z0 + H * 1.15), 1.6, '#101216');
              });
              // weld seams
              edge(g, g1, g4, '#3a2a1c', 0.8); edge(g, g2, g3, '#3a2a1c', 0.8);
            }
          };
          var gbed = function () {
            slabF(HF, bedA0, bedA1, -w, w, z0, H * 0.45, TB);
            var bz = z0 + H * 0.45, wh = H * (hv ? 0.6 : 0.5);
            if (st.enclosed) {
              /* A transport: the troops ride inside a welded box, plated all
                 round and roofed over, patched from whatever was to hand —
                 vision slits along the sides and a door at the back. */
              var eh = H * (hv ? 1.1 : 0.95);
              slabF(HF, bedA0 + 0.01, bedA1, -w * 0.99, w * 0.99, bz, eh, TB, 0.02, 0, w * 0.04);
              var nP = hv ? 4 : 3;
              for (var ep = 0; ep < nP; ep++) {
                var ea0 = bedA0 + 0.02 + (bedA1 - bedA0 - 0.03) * ep / nP, ea1 = bedA0 + 0.02 + (bedA1 - bedA0 - 0.03) * (ep + 1) / nP;
                var etn = [RUST, PLATE, TB][(ep + 1) % 3];
                if (etn === TB) continue;
                slabF(HF, ea0 + 0.01, ea1 - 0.01, nsG * (w * 0.99), nsG * (w * 1.01), bz + 1, eh - 2, etn);
              }
              for (var es = 1; es <= nP; es++) {
                var esa = bedA0 + (bedA1 - bedA0) * (es - 0.5) / nP;
                line(S3(HF(esa - 0.05, nsG * w * 1.02), bz + eh * 0.72), S3(HF(esa + 0.05, nsG * w * 1.02), bz + eh * 0.72), 1.4, '#101216');
              }
              if (fwdG < 0) {
                var e1 = S3(HF(bedA0 + 0.005, -w * 0.4), bz + 1), e2 = S3(HF(bedA0 + 0.005, w * 0.4), bz + 1);
                var e3 = S3(HF(bedA0 + 0.005, w * 0.4), bz + eh - 2), e4 = S3(HF(bedA0 + 0.005, -w * 0.4), bz + eh - 2);
                edge(g, e1, e4, 'rgba(10,9,7,.55)', 0.8); edge(g, e2, e3, 'rgba(10,9,7,.55)', 0.8); edge(g, e4, e3, 'rgba(10,9,7,.55)', 0.8);
              }
              hatch(HF, (bedA0 + bedA1) / 2 + 0.25, w * 0.4, bz + eh, 0.1);
              return;
            }
            // plated walls, the panels not matching: some rust, some bare steel, some painted
            var nPan = hv ? 4 : 3, pieces = [];
            [-1, 1].forEach(function (sd) {
              for (var k = 0; k < nPan; k++) {
                var pa0 = bedA0 + (bedA1 - bedA0) * k / nPan, pa1 = bedA0 + (bedA1 - bedA0) * (k + 1) / nPan;
                var tn2 = [RUST, PLATE, TB][(k + (sd > 0 ? 1 : 0)) % 3];
                var hh2 = wh * (0.85 + ((k * 7 + (sd > 0 ? 3 : 0)) % 4) * 0.08);
                pieces.push({ d: sd * nsG, fn: (function (a0, a1, t2, h2, side) { return function () {
                  slabF(HF, a0, a1, side * (w - 0.06), side * w, bz, h2, t2);
                }; })(pa0, pa1 + 0.01, tn2, hh2, sd) });
              }
            });
            pieces.push({ d: -fwdG, fn: function () { slabF(HF, bedA0, bedA0 + 0.06, -w, w, bz, wh * 0.9, RUST); } });
            pieces.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
          };
          [{ t: L * (0.5 - cabL * 0.2), fn: gbonnet }, { t: L * (0.5 - cabL * 0.7), fn: gcab }, { t: (bedA0 + bedA1) / 2, fn: gbed }]
            .sort(function (p, q) { return p.t * fwdG - q.t * fwdG; })
            .forEach(function (p) { p.fn(); });
          return;
        }
        case 'car': {
          // an armoured car: a raked hull high over big wheels, fenders over each
          slabF(HF, -L * 0.46, L * 0.46, -w * 0.82, w * 0.82, z0 - 2, H, TB, L * 0.2, L * 0.12, w * 0.12);
          lights(HF, L * 0.44, -w * 0.5, z0 + H * 0.4); lights(HF, L * 0.44, w * 0.5, z0 + H * 0.4);
          hatch(HF, L * 0.2, 0, z0 - 2 + H, 0.12);
          return;
        }
        case 'box': case 'bigbox': case 'ifv': {
          var big = st.body === 'bigbox', ifv = st.body === 'ifv';
          var hh = H * (big ? 1.08 : ifv ? 0.85 : 1);
          // a tall box: the upper front plate raked back, the back straight down
          slabF(HF, -L * 0.5, L * 0.5, -w, w, z0, hh, TB, L * (ifv ? 0.3 : 0.24), 0.01, w * 0.04);
          // the heavy carriers' glacis carries the hexagonal active armour
          if (st.hexNose) hexNose(HF, L * 0.5, L * 0.5 - L * (ifv ? 0.3 : 0.24), -w * 0.9, w * 0.9, z0, hh);
          if (st.hex) hexFlank(HF, -L * 0.46, L * 0.24, nearSide() * w, z0 + 1, hh * 0.9);
          if (big) {
            // a raised troop compartment over the rear two thirds
            slabF(HF, -L * 0.48, L * 0.02, -w * 0.9, w * 0.9, z0 + hh, H * 0.3, TB, L * 0.05, 0, w * 0.04);
          }
          // the rear ramp, where it can be seen: a proper door on the troop carriers, a darker plate on the rest
          if (spec.rearDoor) rearDoor(HF, -L * 0.5, w * 0.62, z0 + 1.5, hh - 4, 'ramp');
          else {
            var ra = project(box(-L * 0.5, 0, 0.01, Wd * 0.72), z0 + 2);
            var rb = project(box(-L * 0.5, 0, 0.01, Wd * 0.72), z0 + hh - 3);
            if ((cos + sin) < 0) poly(g, [ra[0], ra[1], rb[1], rb[0]], mixc(hull, dark, 0.5));
          }
          bandOnSides(g, box(0, 0, L, Wd * 0.94), z0 + 1, 2, 2, 'rgba(10,9,7,.45)');
          lights(HF, L * 0.49, -w * 0.62, z0 + hh * 0.45); lights(HF, L * 0.49, w * 0.62, z0 + hh * 0.45);
          grille(HF, L * 0.18, L * 0.3, w * 0.15, w * 0.75, z0 + hh + 0.3, 4);
          if (!st.turret) hatch(HF, -L * 0.18, -w * 0.4, z0 + hh + (big ? H * 0.3 : 0), 0.13);
          hatch(HF, -L * 0.34, w * 0.38, z0 + hh + (big ? H * 0.3 : 0), 0.12);
          return;
        }
        case 'mlrs': {
          // an armoured cab at the front, a flat launcher bed behind it
          slabF(HF, -L * 0.5, L * 0.5, -w, w, z0, H * 0.55, TB, L * 0.04, 0, w * 0.03);
          // (the cab itself goes on with the launcher, in styledTop, so the two layer by depth)
          lights(HF, L * 0.5, -w * 0.62, z0 + H * 0.35); lights(HF, L * 0.5, w * 0.62, z0 + H * 0.35);
          return;
        }
        case 'future': {
          // a faceted hull: chamfered corners, a long wedge nose, hex tiles on the flanks
          var fpts = [[L * 0.5, -w * 0.5], [L * 0.5, w * 0.5], [L * 0.36, w], [-L * 0.44, w], [-L * 0.5, w * 0.8],
            [-L * 0.5, -w * 0.8], [-L * 0.44, -w], [L * 0.36, -w]];
          var ftop = [[L * 0.14, -w * 0.46], [L * 0.14, w * 0.46], [L * 0.06, w * 0.86], [-L * 0.42, w * 0.86], [-L * 0.47, w * 0.7],
            [-L * 0.47, -w * 0.7], [-L * 0.42, -w * 0.86], [L * 0.06, -w * 0.86]];
          shape(HF, fpts, z0, H * 0.9, TB, null, ftop);
          var ns4 = nearSide();
          hexFlank(HF, -L * 0.42, L * 0.3, ns4 * w * 1.0, z0 + 1, H * 0.8);
          hexNose(HF, L * 0.5, L * 0.14, -w * 0.45, w * 0.45, z0, H * 0.9, 3);   // and across the nose: a row of three over a row of two
          grille(HF, -L * 0.42, -L * 0.24, -w * 0.5, w * 0.5, z0 + H * 0.9 + 0.2, 5);
          return;
        }
        default: {
          // a tank: a low hull with a sloped glacis, engine deck grilles at the back
          var mbt = st.body === 'mbt';
          var hh2 = H * (mbt ? 0.8 : 0.88);
          slabF(HF, -L * 0.5, L * 0.5, -w * 0.94, w * 0.94, z0, hh2, TB, L * (mbt ? 0.26 : 0.2), L * 0.05, w * 0.03);
          if (st.hexNose) hexNose(HF, L * 0.5, L * 0.5 - L * (mbt ? 0.26 : 0.2), -w * 0.86, w * 0.86, z0, hh2);
          // lower glacis wedge under the nose
          grille(HF, -L * 0.44, -L * 0.24, -w * 0.6, w * 0.6, z0 + hh2 + 0.2, mbt ? 6 : 4);
          lights(HF, L * 0.49, -w * 0.72, z0 + hh2 * 0.35); lights(HF, L * 0.49, w * 0.72, z0 + hh2 * 0.35);
          // tools and a tow cable along the deck
          edge(g, S3(HF(-L * 0.2, -w * 0.8), z0 + hh2 + 0.5), S3(HF(L * 0.1, -w * 0.8), z0 + hh2 + 0.5), '#3a2f22', 1.2);
          // the Tier V hulls carry the same hexagonal active armour as the advanced combat vehicle
          if (st.hex) hexFlank(HF, -L * 0.42, L * 0.3, nearSide() * w * 0.94, z0 + 1, hh2 * 0.9);
          return;
        }
      }
    }

    // side skirts over the running gear, drawn after the near wheels or tracks
    /* An armoured car's mudguards: a raked plate over each wheel, set outboard
       over the tyre, drawn after the wheels so the arch sits over its tyre. */
    /* An armoured car's mudguards: a raked plate over each wheel, set outboard
       over the tyre. The far side's go down before the hull, which hides them;
       the inner edge runs in under the hull so they meet it from any side. */
    function carFenders(phase) {
      var WG = wheelGeom(), rIn = WG.r / K, w = spec.wid * 0.47;
      var ns = nearSide();
      [-ns, ns].forEach(function (sd) {
        if (!want(phase, sd)) return;
        var tsF = [];
        for (var i0 = 0; i0 < WG.n; i0++) tsF.push((i0 / (WG.n - 1) - 0.5) * WG.span);
        tsF = alongOrder(tsF);                            // the far arch first, the near one over it
        for (var i = 0; i < WG.n; i++) {
          var t = tsF[i];
          var z0 = lift + WG.r * 1.55, h = WG.r * 0.55 + 1.5;
          slabF(HF, t - rIn * 1.15, t + rIn * 1.15, sd * w * 0.6, sd * (spec.wid * 0.5 + gearOut() + 0.01), z0, h, TB, rIn * 0.45, rIn * 0.45, 0);
        }
      });
    }
    /* Side skirts and mudguards. The far side's go down before the hull and
       are drawn in to the hull's side, so the body hides them; the near side's
       go on after it. Nose- or tail-on, both stand beside the hull. */
    function headOn() { return Math.abs(cos - sin) < 0.2; }
    function skirts(phase) {
      phase = phase || 'near';
      var st = spec.style, L = spec.len, Wd = spec.wid;
      if (st.body === 'car' && drive === 'wheeled') { carFenders(phase); return; }
      // skirts hang over tracks; on wheels the flank is left open to show them
      if (!st.skirts || drive !== 'tracked') return;
      var ns = nearSide();
      [-ns, ns].forEach(function (sd) {
        var isFar = sd !== ns && !headOn();
        if ((phase === 'far') !== isFar) return;
        var zt = deck + Math.round(spec.hgt * 0.35), h = Math.max(4, Math.round(DRIVE.tracked.ride * 0.55) + 3);
        var spl = isFar ? -Wd * 0.08 : gearOut();               // out over the tracks, or in under the hull
        slabF(HF, -L * 0.48, L * 0.46, sd * (Wd * 0.49 + spl), sd * (Wd * 0.53 + spl), zt - h, h, TB, L * 0.02, 0);
        if (sd === ns && st.skirts === 'panels') {
          for (var i = 1; i < 6; i++) {
            var ta = -L * 0.48 + (L * 0.94) * i / 6;
            edge(g, S3(HF(ta, sd * (Wd * 0.535 + spl)), zt - h + 1), S3(HF(ta, sd * (Wd * 0.535 + spl)), zt - 1), 'rgba(10,9,7,.4)', 0.7);
          }
        }
      });
    }

    /* The top: turret or casemate, launchers, aerials. Parts are laid down in
       depth order so a gun pointing at the viewer is drawn over its turret. */
    function styledTop() {
      var st = spec.style, L = spec.len, Wd = spec.wid, H = spec.hgt, w = Wd * 0.47;
      var roof = deck + H * ({ mbt: 0.8, tank: 0.88, ltank: 0.88, future: 0.9, ifv: 0.85, bigbox: 1.08, car: 1, pickup: 0.45, truck: 1.45, mlrs: 0.55, guntruck: 0.5 }[st.body] || 1) - (st.body === 'car' ? 2 : 0);
      // a transport's enclosed troop box: the gun goes on its roof
      if (st.body === 'guntruck' && st.enclosed) roof = deck + H * (st.heavy ? 1.55 : 1.4);
      if (st.body === 'bigbox') roof += H * 0.3;
      var parts = [];
      function part(d, fn) { parts.push({ d: d, fn: fn }); }
      function depthOf(fr, p, q) { var c = fr(p, q); return c.x + c.y; }
      var tT = st.tAt != null ? L * st.tAt : -L * 0.04;          // where the turret sits
      var TR = (st.tSize || 0.9) * MACHINE;                       // turret size, inches
      var TF = frameAt(tT, st.tSide ? w * st.tSide : 0, AIM);     // the turret frame
      var tz = roof;

      // ---- turrets ----
      function wedgeTurret(sz, hgt, wedge) {
        var pts = [[sz * 0.62, 0], [sz * 0.36, sz * 0.46], [-sz * 0.44, sz * 0.46], [-sz * 0.6, sz * 0.36],
          [-sz * 0.6, -sz * 0.36], [-sz * 0.44, -sz * 0.46], [sz * 0.36, -sz * 0.46]];
        if (!wedge) pts[0] = [sz * 0.42, 0.001];
        return shape(TF, pts, tz, hgt, TB, 0.9);
      }
      function roundTurret(sz, hgt) {
        var pts = [];
        for (var i = 0; i < 8; i++) {
          var ang = (i + 0.5) * Math.PI / 4;
          pts.push([Math.cos(ang) * sz * 0.5, Math.sin(ang) * sz * 0.46]);
        }
        return shape(TF, pts, tz, hgt, TB, 0.82);
      }
      function cupola(p, q, z) {
        var cp = S3(TF(p, q), z);
        sEllipse(cp[0], cp[1] + 1, 3.6, 2.2, mixc(hull, dark, 0.4));
        sEllipse(cp[0], cp[1] - 1, 3.4, 2, hull);
        sEllipse(cp[0] - 0.8, cp[1] - 1.6, 1.8, 1, lit);
        line([cp[0] - 1.5, cp[1] - 2.2], [cp[0] + 1.5, cp[1] - 2.2], 1, GLINT);
      }
      function smokeRack(sz, z) {
        [-1, 1].forEach(function (sd) {
          for (var i = 0; i < 3; i++) {
            var sp = S3(TF(sz * 0.1 - i * sz * 0.08, sd * sz * 0.5), z);
            sEllipse(sp[0], sp[1], 1.1, 1.1, STEEL);
          }
        });
      }
      function coaxMG(sz, z, b) {
        return barrel(TF, sz * 0.3, sz * 0.62, b, z, 1.2, 'mg', { col: '#15181e' });
      }
      // a plasma cannon's barrel: coil rings along it, a cyan throat at the muzzle
      function plasmaBarrel(a0, len, z, wd) {
        barrel(TF, a0, len, 0, z, wd, 'gun', { col: '#1c2129' });
        for (var i = 1; i <= 4; i++) {
          var rp = S3(TF(a0 + (len - a0) * i / 5, 0), z);
          sEllipse(rp[0], rp[1], wd * 0.46, wd * 0.4, '#2a313b');
          if (!dead) sEllipse(rp[0], rp[1], wd * 0.3, wd * 0.26, 'rgba(120,230,255,.8)');
        }
        var mz = S3(TF(len, 0), z);
        if (!dead) sEllipse(mz[0], mz[1], wd * 0.48, wd * 0.43, 'rgba(180,245,255,.95)');
        return mz;
      }
      function pintle(fr, p, q, z, shield) {
        // a post, a machine gun on it, and a shield plate in front
        var base = S3(fr(p, q), z), top = S3(fr(p, q), z + 5);
        line(base, top, 1.4, STEEL);
        if (shield) slabF(fr, p + 0.08, p + 0.11, q - 0.14, q + 0.14, z + 3, 6, TS);
        var gp = barrel(fr, p - 0.08, p + 0.36, q, z + 6, 1.5, 'mg', { col: '#15181e' });
        var bx = S3(fr(p - 0.02, q + 0.05), z + 5);
        sEllipse(bx[0], bx[1], 1.6, 1.1, '#3c4233');           // the ammunition can
        return gp;
      }

      var tw = st.turret;
      if (tw) {
        var tdepth = depthOf(HF, tT, 0);
        var fwd = Math.cos(AIM) + Math.sin(AIM);                  // >0: the gun points toward us
        var body = function () {}, gun = function () {};
        switch (tw) {
          case 'light': case 'recon':
            body = function () {
              roundTurret(TR, 9);
              cupola(-TR * 0.12, -TR * 0.18, tz + 9);
              if (tw === 'recon') {
                // the recon turret's cupola is its sight: the marker laser and the keen eye both look out of it
                var cpm = S3(TF(-TR * 0.12, -TR * 0.18), tz + 11);
                mount('nose', cpm); mount('scan', cpm);
              }
              smokeRack(TR, tz + 6);
              if (st.tMissiles) launcher(TF, -TR * 0.35, TR * 0.2, -TR * 0.74, -TR * 0.5, tz + 3, 6, 2, 2, 'missile', { warheads: '#6a5a3a' });
              if (tw === 'recon') {
                aerial(TF, -TR * 0.4, TR * 0.3, tz + 9, 26); aerial(TF, -TR * 0.45, -TR * 0.3, tz + 9, 20);
                aerial(HF, -L * 0.42, w * 0.6, roof, 22);
                // a sensor head on a short mast
                var mh = S3(TF(-TR * 0.25, 0), tz + 16);
                line(S3(TF(-TR * 0.25, 0), tz + 9), mh, 1.3, STEEL);
                sEllipse(mh[0], mh[1], 2.6, 1.8, STEEL); sEllipse(mh[0] + 1, mh[1] - 0.4, 1, 0.8, '#7fd8e8');
              }
            };
            gun = function () { barrel(TF, TR * 0.35, TR * (st.gunLen || 1.3), 0, tz + 5, st.gunW || 2.2, 'gun', { fume: 0.55, brake: true }); coaxMG(TR, tz + 4, TR * 0.16); };
            break;
          case 'mbt':
            body = function () {
              wedgeTurret(TR, 12, true);
              cupola(-TR * 0.22, -TR * 0.24, tz + 12);
              var sight = S3(TF(TR * 0.05, TR * 0.28), tz + 12);                // the gunner's sight box
              sEllipse(sight[0], sight[1] - 1, 2.2, 1.6, STEEL); sEllipse(sight[0] + 0.6, sight[1] - 1.2, 0.9, 0.7, GLINT);
              smokeRack(TR, tz + 9);
              aerial(TF, -TR * 0.52, TR * 0.3, tz + 11, 22);
              if (st.tMissiles) launcher(TF, -TR * 0.45, TR * 0.1, -TR * 0.7, -TR * 0.46, tz + 4, 7, 2, 2, 'missile', { warheads: '#6a5a3a' });
            };
            gun = function () {
              if (st.plasma) plasmaBarrel(TR * 0.3, TR * (st.gunLen || 2.15), tz + 6, st.gunW || 3.6);
              else barrel(TF, TR * 0.3, TR * (st.gunLen || 2.15), 0, tz + 6, st.gunW || 2.8, 'gun', { fume: 0.45, brake: !!st.gunW });
              coaxMG(TR, tz + 5, TR * 0.18);
            };
            break;
          case 'arty':
            // a self-propelled gun: a big boxy turret set back, the barrel laid up high
            body = function () {
              slabF(TF, -TR * 0.55, TR * 0.45, -TR * 0.5, TR * 0.5, tz, 12, TB, TR * 0.18, 0, TR * 0.04);
              cupola(-TR * 0.3, -TR * 0.28, tz + 12);
              aerial(TF, -TR * 0.5, TR * 0.34, tz + 12, 20);
              var mt = S3(TF(TR * 0.4, 0), tz + 7);
              sEllipse(mt[0], mt[1], 4.2, 3.6, mixc(hull, dark, 0.3));
            };
            gun = function () {
              if (st.stubGun) {
                /* A stubby howitzer, laid up at the sky: a short fat barrel,
                   and where it fires energy the charge burns along it in blue. */
                /* Half the reach of an artillery piece's barrel and much
                   thicker, but laid at the same angle: the rise is cut with the
                   run, so it points where the light support vehicle's points. */
                // out of the turret's front face, not up through its roof
                var a0b = TR * 0.4, bz = tz + 8, reach = a0b + TR * (st.energyGun ? 0.5 : 0.85);
                var rake = Math.round(42 * (reach - a0b) / (TR * 1.25));
                var bt = barrel(TF, a0b, reach, 0, bz, st.energyGun ? 7.5 : 5.4, 'gun',
                  st.energyGun ? { up: rake, col: '#141b22', lit: '#2a313b' } : { up: rake, brake: true, fume: 0.4 });
                if (st.energyGun) {
                  // the coils down the barrel, and the mouth of it lit
                  // the charge burning in it, the size the Gauss arms show it
                  // a short barrel: its vents drawn to a slimmer gauge, so they sit apart inside it
                  /* three vents evenly spaced down the barrel as it is drawn, from its
                     hull end to just clear of the muzzle ring */
                  var vb0 = S3(TF(a0b, 0), bz), vdx = bt[0] - vb0[0], vdy = bt[1] - vb0[1];
                  // (the barrel's rounded end reaches back half its gauge past vb0; the muzzle ring is 3.9 out)
                  var vlen = Math.hypot(vdx, vdy) || 1, vs0 = -3.4 / vlen, vs1 = 1 - 3.9 / vlen;
                  for (var vv = 0; vv < 3 && !dead; vv++) {
                    var vt = vs0 + (vs1 - vs0) * (vv + 0.5) / 3, vx = vb0[0] + vdx * vt, vy = vb0[1] + vdy * vt;
                    sEllipse(vx, vy, 1.8, 1.53, '#0c1016');
                    sEllipse(vx, vy, 1.26, 0.99, 'rgba(120,230,255,.85)');
                  }
                  // the muzzle: a wide mouth across the end of the barrel, the charge glowing in it
                  sEllipse(bt[0], bt[1], 3.9, 3.4, '#0c1016');
                  if (!dead) {
                    sEllipse(bt[0], bt[1], 3.1, 2.7, 'rgba(120,230,255,.9)');
                    sEllipse(bt[0] - 0.6, bt[1] - 0.6, 1.3, 1.1, 'rgba(225,250,255,.95)');
                  }
                }
                return;
              }
              barrel(TF, TR * 0.35, TR * 1.6, 0, tz + 7, 3.2, 'gun', { up: 42, fume: 0.45, brake: true });
            };
            break;
          case 'howitzer':
            // a big slab-sided turret carrying a short, fat breaching howitzer
            body = function () {
              slabF(TF, -TR * 0.55, TR * 0.45, -TR * 0.46, TR * 0.46, tz, 13, TB, TR * 0.2, TR * 0.04, TR * 0.05);
              cupola(-TR * 0.25, -TR * 0.24, tz + 13);
              smokeRack(TR, tz + 9);
              aerial(TF, -TR * 0.5, TR * 0.32, tz + 13, 20);
            };
            gun = function () {
              if (st.plasma) plasmaBarrel(TR * 0.3, TR * 1.5, tz + 6, 4.6);
              else barrel(TF, TR * 0.3, TR * 1.35, 0, tz + 6, 4.6, 'gun', { brake: true, up: 3, fume: 0.5 });
              coaxMG(TR, tz + 5, TR * 0.24);
            };
            break;
          case 'plasma':
            body = function () {
              wedgeTurret(TR, 13, false);
              cupola(-TR * 0.24, -TR * 0.26, tz + 13);
              // capacitor banks either side of the breech, glowing
              [-1, 1].forEach(function (sd) {
                slabF(TF, -TR * 0.35, TR * 0.15, sd * TR * 0.3, sd * TR * 0.48, tz + 13, 4, TS);
                if (!dead) { var cg = S3(TF(-TR * 0.1, sd * TR * 0.39), tz + 17.2); sEllipse(cg[0], cg[1], 2.6, 0.9, 'rgba(120,230,255,.75)'); }
              });
            };
            gun = function () { plasmaBarrel(TR * 0.3, TR * (st.gunLen || 1.9), tz + 7, 4.6); };
            break;
          case 'flamer':
            body = function () {
              wedgeTurret(TR, 11, false);
              cupola(-TR * 0.22, -TR * 0.24, tz + 11);
              smokeRack(TR, tz + 8);
            };
            gun = function () {
              var tip = barrel(TF, TR * 0.3, TR * 1.05, 0, tz + 5, 4.2, 'flame', { col: '#3a3f38', lit: '#5c6458' });
              // the pilot light at the nozzle: a small flame licking upward, flickering
              if (!dead) {
                var ft = (root.performance ? performance.now() : 0) / 90, fk = Math.floor(ft) % 4;
                var fh = [5, 7, 6, 8][fk], fs = [0, 0.8, 0, -0.8][fk];
                poly(g, [[tip[0] - 2, tip[1]], [tip[0] + fs, tip[1] - fh], [tip[0] + 2, tip[1]]], '#e08a3a');
                poly(g, [[tip[0] - 1, tip[1]], [tip[0] + fs * 0.6, tip[1] - fh * 0.55], [tip[0] + 1, tip[1]]], '#ffd070');
                sEllipse(tip[0], tip[1], 1.6, 1.2, '#e08a3a');
              }
              coaxMG(TR, tz + 5, TR * 0.22);
            };
            break;
          case 'ifv':
            body = function () {
              roundTurret(TR, 8);
              cupola(-TR * 0.2, TR * 0.18, tz + 8);
              // a twin missile box on the turret's flank
              var sd = -1;
              launcher(TF, -TR * 0.3, TR * 0.25, sd * TR * 0.72, sd * TR * 0.48, tz + 3, 5, 1, 2, 'missile', { warheads: '#6a5a3a' });
              smokeRack(TR, tz + 6);
            };
            gun = function () { barrel(TF, TR * 0.3, TR * 1.55, 0, tz + 4, 1.4, 'auto', { brake: true }); coaxMG(TR, tz + 3.5, TR * 0.18); };
            break;
          case 'aa':
            body = function () {
              slabF(TF, -TR * 0.45, TR * 0.4, -TR * 0.36, TR * 0.36, tz, 9, TB, TR * 0.12, 0, TR * 0.04);
              if (!st.noMissiles) [-1, 1].forEach(function (sd) {
                launcher(TF, -TR * 0.3, TR * 0.3, sd * TR * 0.5, sd * TR * 0.78, tz + 4, 6, 2, 2, 'missile', { up: 3, warheads: '#b8b0a0' });
              });
              // a tracking radar on the back of the turret
              var rm = S3(TF(-TR * 0.4, 0), tz + 9), rt = S3(TF(-TR * 0.4, 0), tz + 16);
              line(rm, rt, 1.2, STEEL);
              sEllipse(rt[0], rt[1], 4.6, 2.2, '#b9c2cc'); sEllipse(rt[0], rt[1] + 0.4, 3, 1.3, '#5d6775');
            };
            gun = function () {
              [-0.18, 0.18].forEach(function (b) { barrel(TF, TR * 0.25, TR * 1.3, TR * b, tz + 6, 1.4, 'auto', { up: 5, brake: true }); });
            };
            break;
          case 'dish':
            body = function () {
              roundTurret(TR, 8);
              var mb = S3(TF(-TR * 0.1, 0), tz + 8), mt = S3(TF(-TR * 0.1, 0), tz + 20);
              line(mb, mt, 1.6, STEEL);
              // the dish, tilted back, and its feed horn
              var dc = S3(TF(0.02, 0), tz + 24);
              sEllipse(dc[0], dc[1], 8.5, 6.5, '#8e98a4');
              sEllipse(dc[0] + 0.6, dc[1] + 0.4, 7.4, 5.5, '#c3ccd6');
              sEllipse(dc[0] + 1, dc[1] + 0.6, 4.5, 3.2, '#a8b2bd');
              var fh = S3(TF(0.2, 0), tz + 24);
              line(dc, fh, 0.8, STEEL); sEllipse(fh[0], fh[1], 1, 1, STEEL);
              aerial(HF, -L * 0.42, w * 0.6, roof, 24); aerial(HF, -L * 0.42, -w * 0.6, roof, 18);
            };
            gun = function () { coaxMG(TR, tz + 4, 0); };
            break;
          case 'calliope':
            body = function () {
              roundTurret(TR, 9);
              cupola(-TR * 0.2, -TR * 0.2, tz + 9);
              // the rocket frame riding over the turret, turning with it
              var fz = tz + 13;
              [-0.5, 0.5].forEach(function (b) {
                line(S3(TF(-TR * 0.2, b * TR), tz + 7), S3(TF(-TR * 0.2, b * TR), fz), 1.2, STEEL);
              });
              launcher(TF, -TR * 0.55, TR * 0.55, -TR * 0.62, TR * 0.62, fz, 7, 2, 6, 'rocket', { up: 2, tone: TT, warheads: '#8a3a24' });
            };
            gun = function () { barrel(TF, TR * 0.3, TR * 1.2, 0, tz + 5, 2.2, 'gun', { brake: true }); };
            break;
          case 'mg':
            body = function () {
              slabF(TF, -TR * 0.35, TR * 0.3, -TR * 0.3, TR * 0.3, tz, 6, TB, TR * 0.08, 0, TR * 0.04);
              var ey = S3(TF(TR * 0.1, -TR * 0.2), tz + 7);
              sEllipse(ey[0], ey[1], 1.6, 1.2, STEEL); sEllipse(ey[0] + 0.4, ey[1] - 0.3, 0.7, 0.5, GLINT);
            };
            gun = function () { barrel(TF, TR * 0.2, TR * 0.9, 0, tz + 3.5, 1.5, 'mg', { col: '#15181e', brake: true }); };
            break;
          case 'missile':
            body = function () {
              roundTurret(TR, 7);
              launcher(TF, -TR * 0.35, TR * 0.35, -TR * 0.34, TR * 0.34, tz + 7, 7, 2, 2, 'missile', { up: 2, warheads: '#6a5a3a' });
            };
            gun = function () { coaxMG(TR, tz + 3, TR * 0.3); };
            break;
          case 'future':
            body = function () {
              var pts = [[TR * 0.62, -TR * 0.12], [TR * 0.62, TR * 0.12], [TR * 0.3, TR * 0.5], [-TR * 0.55, TR * 0.5],
                [-TR * 0.65, TR * 0.3], [-TR * 0.65, -TR * 0.3], [-TR * 0.55, -TR * 0.5], [TR * 0.3, -TR * 0.5]];
              shape(TF, pts, tz, 9, TB, 0.86);
              // a missile cell on the right cheek, sensors on the roof
              launcher(TF, -TR * 0.2, TR * 0.32, TR * 0.5, TR * 0.72, tz + 2, 6, 2, 2, 'missile', { warheads: '#e8e3d8' });
              var sn = S3(TF(-TR * 0.3, -TR * 0.25), tz + 9);
              sEllipse(sn[0], sn[1] - 1.2, 2.2, 1.8, '#c9ced6'); sEllipse(sn[0], sn[1] - 1.8, 1.2, 0.9, '#eef2f6');
              aerial(TF, -TR * 0.6, -TR * 0.32, tz + 9, 26, 0.04); aerial(TF, -TR * 0.62, -TR * 0.18, tz + 9, 18, 0.04);
              // the dark sensor slit across the turret's face, one end of it lit
              edge(g, S3(TF(TR * 0.5, -TR * 0.3), tz + 5), S3(TF(TR * 0.5, TR * 0.3), tz + 5), '#0b0d11', 1.6);
              if (!dead) edge(g, S3(TF(TR * 0.5, -TR * 0.22), tz + 5), S3(TF(TR * 0.5, -TR * 0.06), tz + 5), '#7fd8e8', 0.9);
            };
            gun = function () {
              var ftip = st.plasma ? plasmaBarrel(TR * 0.4, TR * (st.gunLen || 2.3), tz + 5, 3.4)
                : barrel(TF, TR * 0.4, TR * (st.gunLen || 2.3), 0, tz + 5, 2.2, 'gun', { col: '#262b33' });
              // the rail driver fires down the same barrel: its shots leave from the main gun's muzzle
              var fbase = S3(TF(TR * 0.4, 0), tz + 5);
              mount('rail', ftip, ftip[0] >= fbase[0] ? 1 : -1);
            };
            break;
        }
        part(tdepth, fwd >= 0 ? function () { body(); gun(); } : function () { gun(); body(); });
      }

      // ---- fixed guns in a casemate ----
      if (st.casemate) {
        var cm = st.casemate, cmA = L * (cm.at != null ? cm.at : 0.08);
        var cmL = L * (cm.len || 0.55), cmH = cm.h || 9;
        part(depthOf(HF, cmA, 0), function () {
          var fwd2 = cos + sin;
          var gunFn = function () {
            barrel(HF, cmA + cmL * 0.4, L * (cm.gun || 1.1), 0, roof + cmH * 0.5, cm.w || 2.6, 'gun',
              { up: cm.up || 0, fume: cm.fume, brake: cm.brake });
          };
          if (fwd2 < 0) gunFn();
          slabF(HF, cmA - cmL * 0.5, cmA + cmL * 0.5, -w * 0.82, w * 0.82, roof, cmH, TB, cmL * 0.35, cmL * 0.08, w * 0.12);
          // a mantlet collar where the gun leaves the plate
          var mc = S3(HF(cmA + cmL * 0.36, 0), roof + cmH * 0.5);
          sEllipse(mc[0], mc[1], (cm.w || 2.6) * 1.5, (cm.w || 2.6) * 1.3, mixc(hull, dark, 0.3));
          hatch(HF, cmA - cmL * 0.2, w * 0.38, roof + cmH, 0.11);
          if (cm.missiles) {
            launcher(HF, cmA - cmL * 0.35, cmA + cmL * 0.15, -w * 0.9, -w * 0.5, roof + cmH, 6, 2, 2, 'missile', { up: 2, warheads: '#6a5a3a' });
          }
          if (fwd2 >= 0) gunFn();
        });
      }

      // ---- launchers and mounts on the hull ----
      if (st.pintle) part(depthOf(HF, L * st.pintle[0], w * st.pintle[1]), function () {
        pintle(frameAt(L * st.pintle[0], w * st.pintle[1], AIM), 0, 0, roof, st.shield);
      });
      if (st.bedGun) {
        var BGt = L * st.gunAt;
        part(depthOf(HF, BGt, 0), function () {
          var GF = frameAt(BGt, 0, AIM), gz = roof + H * 0.2;
          line(S3(GF(0, 0), roof), S3(GF(0, 0), gz), 2.2, STEEL);          // the post it turns on
          var shield = function () { slabF(GF, 0.1, 0.16, -w * 0.45, w * 0.45, gz - 2, 9, tone('#8a8f96', '#62676e', '#3a3e44', '#747980')); };
          var gun = function () {
            if (st.bedGun === 'auto') barrel(GF, -0.1, 0.62, 0, gz + 3, 2, 'auto', { brake: true, fume: 0.5 });
            else barrel(GF, -0.08, 0.45, 0, gz + 3, 1.4, 'mg', { col: '#15181e', brake: true });
            var bx = S3(GF(-0.05, w * 0.22), gz + 1);
            sEllipse(bx[0], bx[1], 2, 1.4, '#3c4233');                     // the ammunition box
          };
          if (Math.cos(AIM) + Math.sin(AIM) >= 0) { gun(); shield(); } else { shield(); gun(); }
        });
      }
      if (st.bedRack) {
        var RKt = L * st.rackAt;
        part(depthOf(HF, RKt, 0) - 0.001, function () {
          var RF = frameAt(RKt, 0, AIM);
          line(S3(RF(0, 0), roof), S3(RF(0, 0), roof + 5), 2, STEEL);
          launcher(RF, -0.2, 0.2, -w * 0.5, w * 0.5, roof + 5, 6, 2, 4, 'rocket', { up: 4, tone: tone('#9a6a44', '#7a4a2a', '#4a2c18', '#8a5a36'), warheads: '#8a3a24' });
        });
      }
      if (st.mrl) {
        var MF = frameAt(-L * 0.28, 0, AIM);
        part(depthOf(HF, -L * 0.28, 0), function () {
          line(S3(MF(0, 0), roof), S3(MF(0, 0), roof + 4), 2, STEEL);
          launcher(MF, -0.3, 0.3, -w * 0.62, w * 0.62, roof + 4, 6, 2, 6, 'rocket', { up: 6, tone: TT, warheads: '#8a3a24' });
        });
      }
      if (st.body === 'mlrs') {
        /* The cab stands up off the bed: with the nose towards the eye it goes on
           after the launcher and hides the lower end of it and its base; with the
           tail towards the eye the launcher goes over it. */
        var mw = w, mz = deck;
        part(depthOf(HF, L * 0.33, 0), function () {
          slabF(HF, L * 0.16, L * 0.5, -mw * 0.96, mw * 0.96, mz + H * 0.55, H * 0.8, TB, L * 0.1, 0, mw * 0.06);
          if (cos + sin > 0.02) {                          // the windscreen, only when the front faces us
            var m1 = S3(HF(L * 0.45, -mw * 0.78), mz + H * 0.75), m2 = S3(HF(L * 0.45, mw * 0.78), mz + H * 0.75);
            var m3 = S3(HF(L * 0.4, mw * 0.74), mz + H * 1.25), m4 = S3(HF(L * 0.4, -mw * 0.74), mz + H * 1.25);
            poly(g, [m1, m2, m3, m4], GLASS); edge(g, m4, m3, GLINT, 0.8);
          }
        });
      }
      if (st.mlrs) {
        var LF = frameAt(-L * 0.18, 0, AIM);
        part(depthOf(HF, -L * 0.18, 0), function () {
          slabF(LF, -0.26, 0.26, -w * 0.5, w * 0.5, roof, 4, TS);
          /* The far pod first, so the near one covers it. The pods traverse with
             the launcher, so which is near goes by where it is aimed, not by the
             hull: facing west with a target in the east, the launcher is turned
             right round and the hull's near flank is the pods' far one. */
          var nsL = nearSideAt(AIM);
          [-nsL, nsL].forEach(function (sd) {
            launcher(LF, -L * 0.3, L * 0.26, Math.min(sd * w * 0.04, sd * w * 0.9), Math.max(sd * w * 0.04, sd * w * 0.9), roof + 4, 10, 2, 3, 'rocket', { up: 15, tone: TB, warheads: '#15181e' });
          });
        });
      }
      if (st.cross) part(depthOf(HF, 0, 0) - 0.01, function () { crossOn(HF, -L * 0.08, 0, roof + 0.3, 0.3); });
      if (st.aerials) part(depthOf(HF, -L * 0.4, 0), function () {
        for (var i = 0; i < st.aerials; i++) {
          var sd = i % 2 ? 1 : -1;
          aerial(HF, -L * (0.3 + 0.06 * (i >> 1)), sd * w * 0.7, roof, 20 + (i % 3) * 5);
        }
      });
      if (st.rws) part(depthOf(HF, L * 0.1, 0), function () {
        var RF = frameAt(L * 0.1, -w * 0.3, AIM);
        slabF(RF, -0.12, 0.1, -0.1, 0.1, roof, 4, TS);
        barrel(RF, 0, 0.42, 0, roof + 3, 1.4, 'mg', { col: '#15181e', brake: true });
      });

      if (droneDue()) {
        var dsp = droneSpot(), asp = along(-L * 0.44, Wd * 0.32);
        part(dsp.x + dsp.y, function () { droneKit('dome'); });
        part(asp.x + asp.y, function () { droneKit('aerial'); });
        droneDone = true;
      }
      parts.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
    }

    /* ================= styled aircraft =================
       Ducted fans in place of open rotors: every one of these lifts on shrouded
       fans, so the rotor discs are gone and a ring of shroud with a blur of
       blades inside it stands in for each. */
    function fan(fr, p, q, z, r, vertical, flush, tilt) {
      // a rebel machine's fans come off whatever it was patched up from
      var ft0 = patch(TB, fr(p, q), 97), hull = ft0.mid, lit = ft0.lit, dark = ft0.dark;
      var c = S3(fr(p, q), z), rx = r * K, ry = vertical ? r * K : r * K * 0.5;
      if (vertical) {
        // a fan set upright in a tail fin: seen edge-on it is a tall ellipse
        var ang = fr.ang, vx = Math.abs(Math.cos(ang) - Math.sin(ang)) * 0.5 + 0.2;
        sEllipse(c[0], c[1], rx * vx + 1.5, ry + 1.5, dark);
        sEllipse(c[0], c[1], rx * vx, ry, '#15181e');
        if (!dead) sEllipse(c[0], c[1], rx * vx * 0.9, ry * 0.9, 'rgba(190,200,214,.3)');
        return;
      }
      /* A fan let flush into a wing: no housing, only the opening in the skin
         with its thin rim, the dark well and the blades turning in it. */
      if (flush) {
        sEllipse(c[0], c[1], rx + 1, ry + 0.8, mixc(hull, dark, 0.55));      // the rim of the opening
        sEllipse(c[0], c[1] + 0.3, rx, ry, '#0e1115');                      // the well
        if (!dead) {
          sEllipse(c[0], c[1] + 0.5, rx * 0.9, ry * 0.9, 'rgba(170,182,198,.22)');
          var fsp = ((root.performance ? performance.now() : 0) * 0.007 * (q < 0 ? -1 : 1)) % (Math.PI * 2);
          for (var fi = 0; fi < 5; fi++) {
            var fa = fi * Math.PI * 2 / 5 + 0.4 + fsp;
            line([c[0], c[1] + 0.5], [c[0] + Math.cos(fa) * rx * 0.9, c[1] + 0.5 + Math.sin(fa) * ry * 0.9], 1.1, 'rgba(206,214,226,.3)');
          }
        }
        sEllipse(c[0], c[1] + 0.5, Math.max(1.2, rx * 0.16), Math.max(0.8, ry * 0.16), STEEL_LIT);   // hub
        return;
      }
      /* A shrouded fan, layered as a real one would be: the far half of the
         shroud's lip first, then the dark well and the blur of the blades
         inside it, then the near half of the lip over the blade tips, and
         last the outer wall of the shroud dropping down in front of all of it. */
      var dh = Math.max(3, r * K * 0.28), cy = c[1] - dh, lipW = Math.max(1.6, r * K * 0.13);
      /* `tilt` pitches the fan forward by that angle, its front edge dipping,
         as a gunship's fans lean to drive it along: the fan is drawn level and
         the canvas turned, so the level disc lands on the leaning one. */
      g.save();
      if (tilt) {
        var ea = S3(fr(p + 1, q), z), eb = S3(fr(p, q + 1), z);
        var ax = ea[0] - c[0], ay = ea[1] - c[1], bx = eb[0] - c[0], by = eb[1] - c[1];
        // the forward axis tips down: its screen step shortens and drops
        var ax2 = ax * Math.cos(tilt), ay2 = ay * Math.cos(tilt) + K * Math.sin(tilt);
        var det = ax * by - ay * bx;
        if (Math.abs(det) > 1e-6) {
          // T = [a' b] [a b]^-1
          var i00 = by / det, i01 = -bx / det, i10 = -ay / det, i11 = ax / det;
          var t00 = ax2 * i00 + bx * i10, t01 = ax2 * i01 + bx * i11, t10 = ay2 * i00 + by * i10, t11 = ay2 * i01 + by * i11;
          g.translate(c[0], c[1]); g.transform(t00, t10, t01, t11, 0, 0); g.translate(-c[0], -c[1]);
        }
      }
      sEllipse(c[0], c[1] + 0.5, rx + 1.6, ry + 1.2, 'rgba(8,10,14,.45)');
      function arcBand(y, from, to, col, wdt) {
        g.strokeStyle = col; g.lineWidth = wdt;
        g.beginPath(); g.ellipse(c[0], y, rx, ry, 0, from, to); g.stroke();
      }
      arcBand(cy, Math.PI, Math.PI * 2, mixc(hull, dark, 0.25), lipW);        // far lip
      sEllipse(c[0], cy + 0.5, rx - lipW * 0.5, ry - lipW * 0.35, '#0e1115'); // the well
      if (!dead) {
        sEllipse(c[0], cy + 0.8, rx - lipW, ry - lipW * 0.6, 'rgba(170,182,198,.22)');
        // the blades turning: the two sides of a craft counter-rotate
        var spin = ((root.performance ? performance.now() : 0) * 0.007 * (q < 0 ? -1 : 1)) % (Math.PI * 2);
        for (var i = 0; i < 5; i++) {
          var ba = i * Math.PI * 2 / 5 + 0.4 + spin;
          line([c[0], cy + 0.8], [c[0] + Math.cos(ba) * (rx - lipW), cy + 0.8 + Math.sin(ba) * (ry - lipW * 0.6)], 1.1, 'rgba(206,214,226,.3)');
        }
      }
      sEllipse(c[0], cy + 0.8, Math.max(1.2, rx * 0.16), Math.max(0.8, ry * 0.16), STEEL_LIT);  // hub
      // the outer wall, in front, then the near lip over the blade tips
      g.fillStyle = mixc(hull, dark, 0.45);
      g.beginPath(); g.ellipse(c[0], c[1], rx + lipW * 0.5, ry + lipW * 0.35, 0, 0, Math.PI);
      g.ellipse(c[0], cy, rx + lipW * 0.5, ry + lipW * 0.35, 0, Math.PI, 0, true); g.closePath(); g.fill();
      arcBand(cy, 0, Math.PI, lit, lipW);
      arcBand(cy - lipW * 0.25, 0.15, Math.PI - 0.15, mixc(lit, '#ffffff', 0.35), 0.7);
      g.restore();
    }
    // a strut from the body out to a fan pod
    function strut(fr, p0, q0, p1, q1, z, wdt) {
      line(S3(fr(p0, q0), z), S3(fr(p1, q1), z), wdt + 1, mixc(hull, dark, 0.5));
      line(S3(fr(p0, q0), z + 0.8), S3(fr(p1, q1), z + 0.8), wdt, hull);
    }
    // a flat wing: a thin plate given by its outline
    function plate(fr, pts, z, th, tn) { return shape(fr, pts, z, th || 2, tn || TB); }

    function drawCraft() {
      var st = spec.craft, L = spec.len, Wd = spec.wid, H = spec.hgt, z = lift, w = Wd * 0.5;
      var AF = HF;
      var fwd = cos + sin;                                     // >0: the nose is toward us
      var parts = [];
      // `over` puts a part above everything at body level (a fan on the roof)
      function part(p, q, fn, over) { var c = AF(p, q); parts.push({ d: c.x + c.y + (over ? 1000 : 0), fn: fn }); }
      function fuselage(pts, top, zz, hh, tn) { return shape(AF, pts, zz, hh, tn || TB, null, top); }
      function canopy(p0, p1, q, zz, hh) {
        var pts = [[p1, 0], [p1 - (p1 - p0) * 0.3, q], [p0, q * 0.8], [p0, -q * 0.8], [p1 - (p1 - p0) * 0.3, -q]];
        // a drone has no pilot, and no cockpit at all
        if (u.drone) return;
        var t = shape(AF, pts, zz, hh, tone(GLINT, GLASS, '#0e141b', mixc(GLASS, GLINT, 0.35)), 0.7);
        edge(g, t[0], t[1], 'rgba(220,240,255,.7)', 0.8);
      }
      /* The gun in the nose. `o.rail` gives it the Gauss weapon's blue-lit
         barrel, and `o.also` records the same muzzle under other names, so a
         craft whose only weapon is this one fires out of it whatever it is
         carrying rather than out of the middle of the hull. */
      function noseGun(p, q, zz, len, kind, o) {
        o = o || {};
        var tf = frameAt(p, q, AIM);
        var cg = S3(AF(p, q), zz);
        sEllipse(cg[0], cg[1], 2.6, 2, STEEL);
        var mz = barrel(tf, 0, len, 0, zz - 1, o.rail ? 1.6 : 1.3, kind || 'mg',
          o.rail ? { col: '#15181e', lit: '#7fd8e8' } : { col: '#15181e' });
        if (!dead && o.rail) sEllipse(mz[0], mz[1], 1.6, 1.4, 'rgba(127,216,232,.9)');
        (o.also || []).forEach(function (k2) { mount(k2, mz, mz[0] >= cg[0] ? 1 : -1); });
      }
      /* A rocket or missile pod slung under a wing, its tubes toward the nose.
         Drawn before the wing, so the wing covers it; `lead` is where the
         wing's leading edge crosses it, and it pokes out a little ahead of
         that so it shows. */
      function podUnder(lead, q, zz, kind, big) {
        var ln = big ? 0.42 : 0.34;
        pod(lead + 0.12 - ln / 2, q, zz, kind, big);
      }
      function pod(p, q, zz, kind, big) {
        var ln = big ? 0.42 : 0.34, r2 = big ? 0.11 : 0.09;
        line(S3(AF(p, q), zz + 3), S3(AF(p, q), zz), 1, STEEL);
        launcher(AF, p - ln / 2, p + ln / 2, q - r2, q + r2, zz - 4, 4, kind === 'missile' ? 1 : 2, 2, kind, { tone: TS, warheads: kind === 'missile' ? '#b8b0a0' : '#8a3a24' });
      }
      function doorGun(sd, p, zz, quiet) {
        var DF = frameAt(p, sd * w * 0.98, AIM);
        // `quiet`: a craft with a gun in the nose fires from the nose, and the
        // door gunner is a passenger with a weapon rather than the craft's own
        barrel(DF, 0, 0.32, 0, zz, 1.2, quiet ? null : 'mg', { col: '#15181e' });
      }
      /* The fin, and when it carries one, the tail fan set into it: a ring in
         the plane of the fin itself, drawn with the fin so it layers with it
         rather than floating in front of whatever is nearer. */
      function tailFin(p, zz, hh, twin, fanR) {
        (twin ? [-1, 1] : [0]).forEach(function (sd) {
          var q = sd * w * 0.5, lean = sd * 0.12;
          var b0 = S3(AF(p + 0.04, q), zz - hh * 0.2), b1 = S3(AF(p - 0.4, q), zz - hh * 0.2);
          var t0 = S3(AF(p - 0.22, q + lean), zz + hh), t1 = S3(AF(p - 0.42, q + lean), zz + hh);
          poly(g, [b0, b1, t1, t0], sd <= 0 ? mixc(hull, lit, 0.5) : hull);
          edge(g, t0, t1, trim, 1.2);
          edge(g, b0, t0, 'rgba(255,240,214,.35)', 0.7);
          if (fanR && !twin) {
            var fc = S3(AF(p - 0.2, 0), zz + hh * 0.3);
            var Fx = (cos - sin), Fy = (cos + sin) / 2, R3 = fanR * K;
            g.save();
            g.transform(Fx, Fy, 0, 1, fc[0], fc[1]);
            g.fillStyle = mixc(hull, dark, 0.5); g.beginPath(); g.arc(0, 0, R3 + 1.4, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#0e1115'; g.beginPath(); g.arc(0, 0, R3, 0, Math.PI * 2); g.fill();
            if (!dead) {
              g.fillStyle = 'rgba(170,182,198,.28)'; g.beginPath(); g.arc(0, 0, R3 * 0.9, 0, Math.PI * 2); g.fill();
              g.strokeStyle = 'rgba(206,214,226,.35)'; g.lineWidth = 0.9;
              for (var i = 0; i < 6; i++) {
                var ba = i * Math.PI / 3 + 0.3;
                g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ba) * R3 * 0.9, Math.sin(ba) * R3 * 0.9); g.stroke();
              }
            }
            g.fillStyle = STEEL_LIT; g.beginPath(); g.arc(0, 0, Math.max(0.8, R3 * 0.2), 0, Math.PI * 2); g.fill();
            g.restore();
          }
        });
      }

      switch (st) {
        case 'civ': {
          // a rounded civilian pod on four fans at the corners
          var pts = [[L * 0.5, -w * 0.5], [L * 0.5, w * 0.5], [L * 0.3, w], [-L * 0.4, w], [-L * 0.5, w * 0.6], [-L * 0.5, -w * 0.6], [-L * 0.4, -w], [L * 0.3, -w]];
          [[0.36, 1], [0.36, -1], [-0.36, 1], [-0.36, -1]].forEach(function (fp) {
            var pp = L * fp[0], qq = fp[1] * w * 1.9;
            part(pp, qq, function () { strut(AF, pp * 0.7, fp[1] * w * 0.8, pp, qq, z + H * 0.55, 2.2); fan(AF, pp, qq, z + H * 0.5, 0.36); });
          });
          part(0, 0, function () {
            fuselage(pts, null, z, H, TB);
            var t = shape(AF, pts.map(function (q2) { return [q2[0] * 0.8, q2[1] * 0.8]; }), z + H, 5, TB, 0.75);
            // the wraparound glazing
            var ns = nearSide();
            var g1 = S3(AF(L * 0.46, 0), z + H * 0.62), g2 = S3(AF(L * 0.3, ns * w * 0.96), z + H * 0.62);
            var g3 = S3(AF(-L * 0.3, ns * w * 0.96), z + H * 0.62);
            line(g1, g2, 3.4, GLASS); line(g2, g3, 3.4, GLASS);
            line([g1[0], g1[1] - 1.2], [g2[0], g2[1] - 1.2], 0.8, GLINT);
            // a civilian stripe, and the door gun somebody fitted
            bandOnSides(g, box(0, 0, L, Wd), z + 3, 2, 2, trim);
            doorGun(ns, -L * 0.05, z + H * 0.45);
          });
          break;
        }
        case 'disc': {
          /* A saucer: a flat disc with a low hump on top where the sensor dome
             sits, a ring of lift vents lit underneath and two small swept
             winglets off the back. It is there to find and mark, not to fight:
             a scanner pod hangs under the front lip — a row of lenses and a
             marker laser — and sweeps a scanning fan across the ground ahead. */
          var R0 = L * 0.5, ring = function (r) {
            var out = [];
            for (var a = 0; a < 16; a++) out.push([Math.cos(a / 16 * Math.PI * 2) * r, Math.sin(a / 16 * Math.PI * 2) * r]);
            return out;
          };
          var podZ = z - Math.round(H * 0.45);
          if (!dead) {
            var ug = S3(AF(0, 0), z - 1);
            sEllipse(ug[0], ug[1], R0 * K * 0.8, R0 * K * 0.4, 'rgba(110,190,255,.16)');
            var tn = root.performance ? performance.now() : 0;
            var sw = Math.sin(tn / 700) * 0.3, reach = R0 + 0.55;
            var n0 = S3(AF(R0 * 1.14, 0), podZ + 2);
            var f0 = S3(AF(reach, sw - 0.32), 0), f1 = S3(AF(reach, sw + 0.32), 0);
            poly(g, [n0, f0, f1], 'rgba(110,190,255,.12)');
            line(n0, f0, 1, 'rgba(160,215,255,.45)'); line(n0, f1, 1, 'rgba(160,215,255,.45)');
            line(f0, f1, 1.2, 'rgba(190,235,255,.7)');
            var fm = S3(AF(reach, sw + 0.32 * Math.sin(tn / 180)), 0);
            line(n0, fm, 1, 'rgba(210,240,255,.55)');
          }
          [-1, 1].forEach(function (sd) {
            part(-R0 * 0.55, sd * R0 * 1.05, function () {
              plate(AF, [[-R0 * 0.2, sd * R0 * 0.82], [-R0 * 0.85, sd * R0 * 1.32], [-R0 * 1.05, sd * R0 * 1.32], [-R0 * 0.75, sd * R0 * 0.75]], z + H * 0.28, 2);
            });
          });
          part(0, 0, function () {
            // the scanner pod, slung under the front lip
            strut(AF, R0 * 0.55, 0, R0 * 0.55, 0, podZ + Math.round(H * 0.3), 3);
            shape(AF, [[R0 * 1.12, -R0 * 0.22], [R0 * 1.12, R0 * 0.22], [R0 * 0.55, R0 * 0.28], [R0 * 0.55, -R0 * 0.28]], podZ, Math.round(H * 0.4), TB);
            [-0.1, 0, 0.1].forEach(function (q, i) {
              var lp = S3(AF(R0 * 1.13, q * R0 * 1.4), podZ + Math.round(H * 0.2));
              sEllipse(lp[0], lp[1], 1.3, 1.1, '#123a6e');
              var blink = Math.floor((root.performance ? performance.now() : 0) / 240) % 3 === i;
              sEllipse(lp[0], lp[1], 0.8, 0.7, dead ? '#3a4048' : blink ? '#e4f4ff' : '#6ebeff');
            });
            // the marker laser: a short emitter off the pod's flank, a red eye at its tip
            var e0 = S3(AF(R0 * 0.8, -R0 * 0.3), podZ + 2), e1 = S3(AF(R0 * 1.3, -R0 * 0.3), podZ + 2);
            line(e0, e1, 2.2, '#15181e');
            line(e0, e1, 1, '#4a5260');
            // the red eye at its tip blinks, about once a second: the drone's light
            var eyeOn = !dead && Math.floor((root.performance ? performance.now() : 0) / 500) % 2 === 0;
            sEllipse(e1[0], e1[1], 1.2, 1, dead ? '#3a2020' : eyeOn ? '#ff4038' : '#5a1c16');
            mount('nose', e1);                                   // where a marker's beam leaves the craft
            mount('scan', S3(AF(R0 * 1.13, 0), podZ + Math.round(H * 0.2)));   // and where it looks from
            mount('mg', S3(AF(R0 * 1.14, 0), podZ + Math.round(H * 0.12)));    // its light gun fires from the pod's nose
            if (eyeOn) sEllipse(e1[0], e1[1], 2.2, 1.8, 'rgba(255,70,60,.3)');
            shape(AF, ring(R0 * 0.86), z, Math.round(H * 0.22), TB, null, ring(R0));                  // the underside, flaring out
            shape(AF, ring(R0), z + Math.round(H * 0.22), Math.round(H * 0.18), TB, null, ring(R0 * 0.72)); // the upper face
            shape(AF, ring(R0 * 0.5), z + Math.round(H * 0.4), Math.round(H * 0.28), TB, null, ring(R0 * 0.36)); // the hump
            if (!dead) {
              // running lights round the rim
              for (var li = 0; li < 16; li += 2) {
                var la = li / 16 * Math.PI * 2, lp2 = S3(AF(Math.cos(la) * R0 * 0.99, Math.sin(la) * R0 * 0.99), z + Math.round(H * 0.24));
                sEllipse(lp2[0], lp2[1], 1.1, 0.8, li === 0 ? '#ff5040' : 'rgba(150,215,255,.9)');
              }
            }
          }, true);
          break;
        }
        case 'hawk': case 'chinook': case 'chinookcp': {
          var chin = st !== 'hawk';
          var cabL = chin ? L : L * 0.62;
          var pts2 = [[cabL * 0.5, -w * 0.45], [cabL * 0.5, w * 0.45], [cabL * 0.38, w], [-cabL * 0.44, w], [-cabL * 0.5, w * 0.7],
            [-cabL * 0.5, -w * 0.7], [-cabL * 0.44, -w], [cabL * 0.38, -w]];
          var off = chin ? 0 : L * 0.12;
          var pts2o = pts2.map(function (q2) { return [q2[0] + off, q2[1]]; });
          var topo = pts2.map(function (q2) { return [q2[0] * 0.92 + off - (q2[0] > 0 ? cabL * 0.06 : 0), q2[1] * 0.82]; });
          if (spec.winglets) {
            /* the command post's winglets: short stub wings low on the flanks,
               each turned up at the tip */
            [-1, 1].forEach(function (sd) {
              part(-L * 0.12, sd * w * 1.6, function () {
                var wz = z + H * 0.3;
                plate(AF, [[-L * 0.02, sd * w * 0.95], [-L * 0.1, sd * w * 2.1], [-L * 0.2, sd * w * 2.1], [-L * 0.24, sd * w * 0.95]], wz, 2);
                shape(AF, [[-L * 0.1, sd * w * 2.05], [-L * 0.1, sd * w * 2.2], [-L * 0.21, sd * w * 2.2], [-L * 0.21, sd * w * 2.05]], wz, 9, TB, 0.6);
              });
            });
          }
          if (!chin) {
            // a tail boom tapering back to a fin with a fan set in it
            part(-L * 0.35, 0, function () {
              shape(AF, [[-L * 0.1, -w * 0.3], [-L * 0.1, w * 0.3], [-L * 0.62, w * 0.14], [-L * 0.62, -w * 0.14]], z + H * 0.35, H * 0.35, TB, 0.85);
              tailFin(-L * 0.52, z + H * 0.6, 14, false, 0.17);
            });
            // two fans on pylons either side of the cabin
            [-1, 1].forEach(function (sd) {
              part(off, sd * w * 2.2, function () {
                strut(AF, off, sd * w * 0.9, off, sd * w * 1.7, z + H * 0.9, 2.4);
                fan(AF, off, sd * w * 2.25, z + H * 0.85, 0.5);
              });
            });
          } else {
            /* The two big fans sit on the roof, fore and aft, each on its own
               pylon, the rear one standing higher. They are drawn after the
               body, and the nearer of the two last, whichever way it faces. */
            part(L * 0.3, 0, function () {
              slabF(AF, L * 0.2, L * 0.42, -w * 0.42, w * 0.42, z + H, 4, TB, L * 0.04, L * 0.02, w * 0.08);
              fan(AF, L * 0.31, 0, z + H + 4, 0.7);
            }, true);
            part(-L * 0.34, 0, function () {
              slabF(AF, -L * 0.5, -L * 0.2, -w * 0.5, w * 0.5, z + H, 8, TB, L * 0.06, 0.02, w * 0.08);
              fan(AF, -L * 0.35, 0, z + H + 8, 0.7);
            }, true);
          }
          part(off, 0, function () {
            /* the command post's radar: a big dark grey radome slung low under
               the nose and bulging out ahead of it, laid down before the hull
               so that from the side and behind the hull hides all but its
               belly and its snout */
            if (st === 'chinookcp') {
              var nd = S3(AF(L * 0.44, 0), z - H * 0.06), nd2 = S3(AF(L * 0.56, 0), z - H * 0.1);
              sEllipse((nd[0] + nd2[0]) / 2, (nd[1] + nd2[1]) / 2 + 0.8, 9, 6.2, '#23272d');
              sEllipse(nd[0], nd[1], 7.2, 5.2, '#3c424a');
              sEllipse(nd2[0], nd2[1], 6.4, 4.8, '#3c424a');
              sEllipse(nd2[0] - 1.6, nd2[1] - 1.7, 3, 1.9, '#5b626c');
              sEllipse(nd2[0] - 2.2, nd2[1] - 2.3, 1.2, 0.8, '#7d858f');
            }
            fuselage(pts2o, topo, z, H, TB);
            bandOnSides(g, box(off, 0, cabL, Wd), z + 2, 2, 2, 'rgba(10,9,7,.4)');
            /* The glazing is set into the cab below its roof and inside its width,
               so only the nose's face shows it: with the nose turned away the
               cab hides it altogether. */
            if (fwd > 0) canopy(off + cabL * 0.22, off + cabL * 0.5, w * 0.8, z + H * 0.5, H * 0.45);
            var ns = nearSide();
            doorGun(ns, off - cabL * 0.05, z + H * 0.45, true);
            // ...and so is the gun under the nose
            if (fwd > 0) noseGun(off + cabL * 0.46, 0, z + H * 0.34, 0.3, 'mg');
            if (st === 'chinookcp') {
              // the command post: a dome on the roof and aerials (its radar went on under the nose)
              var dm = S3(AF(-L * 0.05, 0), z + H + 1);
              sEllipse(dm[0], dm[1] - 1.6, 4.2, 3, '#c9ced6'); sEllipse(dm[0] - 1, dm[1] - 2.6, 2, 1.2, '#eef2f6');
              aerial(AF, L * 0.1, w * 0.5, z + H, 18); aerial(AF, L * 0.05, -w * 0.5, z + H, 14); aerial(AF, -L * 0.1, w * 0.5, z + H, 12);
            }
          });
          break;
        }
        case 'apache': case 'apacherk': case 'hind': case 'hindrk': {
          var hind = st === 'hind' || st === 'hindrk';
          var fw = hind ? w * 0.95 : w * 0.7;
          var body2 = [[L * 0.5, -fw * 0.3], [L * 0.5, fw * 0.3], [L * 0.3, fw], [-L * 0.2, fw], [-L * 0.3, fw * 0.6], [-L * 0.3, -fw * 0.6], [-L * 0.2, -fw], [L * 0.3, -fw]];
          var top2 = body2.map(function (q2) { return [q2[0] * 0.9 - (q2[0] > 0 ? L * 0.04 : 0), q2[1] * 0.75]; });
          // the boom and tail, with a fan in the fin
          // the tail boom rides level with the top of the hull, its fin and tailplane with it
          part(-L * 0.5, 0, function () {
            shape(AF, [[-L * 0.25, -fw * 0.4], [-L * 0.25, fw * 0.4], [-L * 0.85, fw * 0.16], [-L * 0.85, -fw * 0.16]], z + H * 0.66, H * 0.34, TB, 0.85);
            tailFin(-L * 0.72, z + H * 0.91, 15, false, 0.17);
            plate(AF, [[-L * 0.66, -w * 0.9], [-L * 0.66, w * 0.9], [-L * 0.78, w * 0.9], [-L * 0.78, -w * 0.9]], z + H * 0.81, 1.5);
          });
          /* stub wings with pods, and a fan at each tip: layered against the body,
             the far one under it and the near one over it, from any angle */
          var stubNear = nearSide(), bodyD = AF(0, 0);
          [-1, 1].forEach(function (sd) {
            parts.push({ d: bodyD.x + bodyD.y + (sd === stubNear ? 0.001 : -0.001), fn: function () {
              var wz = z + H * 0.45;
              var npods = spec.noPods ? 0 : st === 'apacherk' || st === 'hindrk' ? 2 : 1;
              for (var pi = 0; pi < npods; pi++) {
                var pq = fw + (w * 2.6 - fw) * (0.3 + pi * 0.4), lead = L * 0.05 - (L * 0.03) * (pq - fw * 0.9) / (w * 2.6 - fw * 0.9);
                podUnder(lead, sd * pq, wz, npods > 1 && pi === 1 ? 'missile' : 'rocket', st === 'hindrk');
              }
              plate(AF, [[L * 0.05, sd * fw * 0.9], [L * 0.02, sd * w * 2.6], [-L * 0.12, sd * w * 2.6], [-L * 0.14, sd * fw * 0.9]], wz, 2);
              // the transport and the heavy craft lift more, on bigger fans
              fan(AF, -L * 0.05, sd * w * (hind ? 3.25 : 3.1), wz + 1, hind ? 0.48 : 0.4);
            } });
          });
          part(0, 0, function () {
            fuselage(body2, top2, z, H, TB);
            bandOnSides(g, box(0, 0, L * 0.8, fw * 2), z + 2, 2, 2, 'rgba(10,9,7,.4)');
            if (spec.singleCab) {
              // one pilot, one long canopy
              canopy(L * 0.08, L * 0.42, fw * 0.64, z + H * 0.76, H * 0.36);
            } else {
              // stepped tandem canopies: the gunner low in front, the pilot behind and above
              canopy(L * 0.22, L * 0.44, fw * 0.62, z + H * 0.72, H * 0.3);
              canopy(L * 0.02, L * 0.22, fw * 0.66, z + H * 0.82, H * 0.38);
            }
            if (hind) {
              var ns = nearSide();
              var dp = S3(AF(-L * 0.05, ns * fw), z + H * 0.35);
              poly(g, [[dp[0] - 4, dp[1]], [dp[0] + 4, dp[1] - 2], [dp[0] + 4, dp[1] - 9], [dp[0] - 4, dp[1] - 7]], mixc(hull, dark, 0.45));
            }
          });
          part(L * 0.45, 0, function () { noseGun(L * 0.42, 0, z + 1, hind ? 0.5 : 0.42, 'mg'); });
          break;
        }
        case 'comanche': {
          /* A stealth gunship: a long, narrow, faceted body with sharp chines and
             a pointed nose, the crew in stepped tandem under flat-plated glass,
             short swept stubs carrying the lift fans and no pods at all (its
             weapons ride in bays in the flanks), and a fan in the fin. */
          var cw = w * 0.86;
          var cbody = [[L * 0.52, 0.001], [L * 0.36, cw * 0.62], [L * 0.16, cw], [-L * 0.2, cw], [-L * 0.32, cw * 0.55],
            [-L * 0.32, -cw * 0.55], [-L * 0.2, -cw], [L * 0.16, -cw], [L * 0.36, -cw * 0.62]];
          // the top is much narrower than the chines: the sides slope in, as a faceted hull does
          var ctop = cbody.map(function (q2) { return [q2[0] * 0.94 - (q2[0] > 0 ? L * 0.03 : 0), q2[1] * 0.5]; });
          var tipQ = w * 2.3;
          // the boom tapers back from the top of the body to the fin, with its fan and a small tailplane
          part(-L * 0.55, 0, function () {
            shape(AF, [[-L * 0.28, -cw * 0.5], [-L * 0.28, cw * 0.5], [-L * 0.84, cw * 0.2], [-L * 0.84, -cw * 0.2]], z + H * 0.6, H * 0.34, TB, 0.85,
              [[-L * 0.3, -cw * 0.24], [-L * 0.3, cw * 0.24], [-L * 0.82, cw * 0.1], [-L * 0.82, -cw * 0.1]]);
            /* The tailplane's halves droop from the boom, their tips well below
               their roots: the far half goes in before the fin, the near one after. */
            var tz = z + H * 0.84, ns = nearSide();
            function droop(sd) {
              var r0 = S3(AF(-L * 0.64, sd * cw * 0.2), tz), r1 = S3(AF(-L * 0.75, sd * cw * 0.2), tz);
              var t1 = S3(AF(-L * 0.78, sd * w * 1.05), tz - 3.5), t0 = S3(AF(-L * 0.7, sd * w * 1.05), tz - 3.5);
              var th = 1.3;
              poly(g, [[r0[0], r0[1] + th], [r1[0], r1[1] + th], [t1[0], t1[1] + th], [t0[0], t0[1] + th]], mixc(hull, dark, 0.55));
              poly(g, [r0, r1, t1, t0], sd === ns ? hull : mixc(hull, lit, 0.4));
              edge(g, t0, t1, trim, 1);
            }
            droop(-ns);
            tailFin(-L * 0.74, z + H * 0.94, 13, false, 0.2);
            droop(ns);
          });
          /* Swept stubs, a fan at each tip. They are layered against the body
             rather than sorted by where their tips are: the far stub and its fan
             go under the fuselage, the near ones over it, from any angle. */
          var stubNear = nearSide(), bodyD = AF(0, 0);
          [-1, 1].forEach(function (sd) {
            parts.push({ d: bodyD.x + bodyD.y + (sd === stubNear ? 0.001 : -0.001), fn: function () {
              var wz = z + H * 0.42;
              plate(AF, [[L * 0.08, sd * cw * 0.95], [-L * 0.06, sd * tipQ * 0.86], [-L * 0.16, sd * tipQ * 0.86], [-L * 0.14, sd * cw * 0.95]], wz, 1.6);
              fan(AF, -L * 0.1, sd * tipQ, wz + 1, 0.36, false, false, 0.3);
            } });
          });
          part(0, 0, function () {
            fuselage(cbody, ctop, z, H, TB);
            // the weapon bay doors, closed flush in the flanks
            var ns = nearSide();
            var b0 = S3(AF(L * 0.1, ns * cw * 0.99), z + H * 0.3), b1 = S3(AF(-L * 0.16, ns * cw * 0.99), z + H * 0.3);
            edge(g, b0, b1, 'rgba(10,9,7,.45)', 0.8);
            // one pilot under one long, flat-plated canopy
            canopy(L * 0.04, L * 0.4, cw * 0.46, z + H * 0.78, H * 0.28);
          });
          // the chin gun, and the Gauss rails fire from it too
          part(L * 0.45, 0, function () { noseGun(L * 0.34, 0, z + 1, 0.3, 'gun', { rail: true, also: ['rail', 'auto', 'mg'] }); });
          break;
        }
        case 'jet': case 'hybrid': {
          var hyb = st === 'hybrid';
          var fw2 = w * 0.62;
          var fus = [[L * 0.5, 0.001], [L * 0.32, fw2 * 0.8], [L * 0.1, fw2], [-L * 0.46, fw2 * 0.9], [-L * 0.5, fw2 * 0.6],
            [-L * 0.5, -fw2 * 0.6], [-L * 0.46, -fw2 * 0.9], [L * 0.1, -fw2], [L * 0.32, -fw2 * 0.8]];
          var fusTop = fus.map(function (q2) { return [q2[0] * 0.96, q2[1] * 0.62]; });
          var span = hyb ? w * 3.4 : w * 2.9;
          /* The wing, a broad trapezoid, is laid in two halves, each placed by its own
             depth: side-on the near wing (with its pod and fan) goes over the fuselage
             and the far one under it, rather than both under it. Each half runs in to
             the fuselage's side, so neither is ever drawn across the body. */
          var jlead = function (bb) { return L * 0.14 + (Math.abs(bb) - fw2) / (span - fw2) * (-L * 0.34); };
          [-1, 1].forEach(function (sd) {
            part(-L * 0.2, sd * span * 0.55, function () {
              // the pods go under the wing first, so it covers all but their noses
              if (!spec.noPods) {                        // a clean wing: its guns are in the body
                var q1 = sd * span * (hyb ? 0.92 : 0.6);
                podUnder(jlead(q1), q1, z + H * 0.3, hyb ? 'rocket' : 'missile', false);
                if (spec.extraPods) {                    // a rocket pod inboard, a missile rail outboard
                  podUnder(jlead(span * 0.36), sd * span * 0.36, z + H * 0.3, 'rocket', true);
                  podUnder(jlead(span * 0.84), sd * span * 0.84, z + H * 0.3, 'missile', false);
                }
              }
              plate(AF, [[L * 0.14, sd * fw2 * 0.98], [-L * 0.2, sd * span], [-L * 0.36, sd * span], [-L * 0.36, sd * fw2 * 0.92]], z + H * 0.3, 2);
              if (hyb) fan(AF, -L * 0.2, sd * span * 0.62, z + H * 0.3 + 2, 0.36);
              /* The company's jets are VTOL: they can hang in the air as well as fly
                 through it, so each wing has a lift fan let flush into it. */
              else fan(AF, -L * 0.16, sd * span * 0.5, z + H * 0.3 + 2, 0.3, false, true);
            });
          });
          part(0, 0, function () {
            // the tailplane first, always under the body (and the fins, which go on last)
            plate(AF, [[-L * 0.34, -fw2], [-L * 0.34, fw2], [-L * 0.46, w * 1.6], [-L * 0.52, w * 1.6], [-L * 0.52, -w * 1.6], [-L * 0.46, -w * 1.6]], z + H * 0.4, 1.6);
            fuselage(fus, fusTop, z, H, TB);
            // the engine nozzle at the back: seen only when the tail is towards the eye or side-on;
            // with the nose towards the eye the fuselage hides it
            if ((cos + sin) < 0.5) {
              var nz = S3(AF(-L * 0.52, 0), z + H * 0.45);
              sEllipse(nz[0], nz[1], 3.4, 3, STEEL); sEllipse(nz[0], nz[1], 2, 1.8, dead ? '#15181e' : '#c96a2a');
            }
            canopy(L * 0.12, L * 0.36, fw2 * 0.5, z + H, 4);
            if (hyb) { var sp = S3(AF(L * 0.1, 0), z + H + 1); sEllipse(sp[0], sp[1] - 1, 2.4, 1.6, STEEL); }
          });
          /* The twin fins stand above the wings and the tailplane, so they go
             on after them whichever way the jet faces: from ahead they were
             drawn with the body, and from behind the wings, drawn after the
             body, covered them. */
          part(-L * 0.36, 0, function () { tailFin(-L * 0.3, z + H * 0.7, hyb ? 14 : 16, true); }, true);
          part(L * 0.4, 0, function () {
            var gp = S3(AF(L * 0.26, -fw2 * 0.7), z + H * 0.7);
            mount('mg', gp, (cos - sin) >= 0 ? 1 : -1);        // the gun port fires from here, without a dot to mark it
            if (hyb) noseGun(L * 0.46, 0, z + 1, 0.3, 'mg');
          });
          break;
        }
      }
      parts.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
      drawDamage();
    }

    /* ================= bipedal walkers ================= */
    /* A walker is not a tank on legs: it is an upright machine that stands on two
       of them, with the crew in a cockpit head and the guns on its shoulders. */
    /* Walkers come in three weights, read off the size of the hull they
       replace: a light one is a slim humanoid, a wedge of chest over long thin
       legs with a finned head and a small gun on each forearm; a medium one is
       a rounded egg of a body with the cockpit glazed into its chest, heat
       sinks on its back and gun pods on its forearms; a heavy one is a hunched
       battle mech, a huge chest with its head sunk into it, missile boxes on
       its shoulders and blocky arms hanging low. */
    /* A walker is drawn a size down from the hull it stands in for: on legs
       the same footprint towered over everything near it. */
    var MS = null;
    function msInit() {
      var MECH = 0.8;
      MS = { len: spec.len * MECH, wid: spec.wid * MECH, hgt: spec.hgt * MECH, gun: (spec.gun || spec.fixedGun || spec.len * 0.9) * MECH };
    }
    function mechClass() {
      var base = HULL[u.art] || HULL.wheeled;
      // light tanks and cars under 2.3", the big future hulls from 2.55" — or whatever the hull says it is
      if (base.mech) return base.mech;
      return base.len < 2.3 ? 'light' : base.len >= 2.55 ? 'heavy' : 'medium';
    }
    /* legH: ground to hip; torsoH: hip to the top of the body; headH: what
       stands on top of that (a light mech's head and fin, a medium's crest
       and heat sinks, a heavy's missile boxes). headroom() repeats these. */
    function mechHeights() {
      if (!MS) msInit();
      var sf = MS.len / 2.0, cls = mechClass();
      if (cls === 'light') {
        return { legH: Math.round(30 * sf + MS.hgt * 0.4), torsoH: Math.round(13 * sf + MS.hgt * 0.3), headH: Math.round(12 * sf), sf: sf, cls: cls };
      }
      if (cls === 'heavy') {
        return { legH: Math.round(28 * sf + MS.hgt * 0.45), torsoH: Math.round(30 * sf + MS.hgt * 0.55), headH: Math.round(9 * sf), sf: sf, cls: cls };
      }
      return { legH: Math.round(26 * sf + MS.hgt * 0.45), torsoH: Math.round(26 * sf + MS.hgt * 0.5), headH: Math.round(7 * sf), sf: sf, cls: 'medium' };
    }

    /* What a walker carries is what the hull it stands in for carries: a tank's
       gun on the arm, an AA hull's twin cannon, a support hull's rockets on
       the shoulders, a plasma cannon, a flame projector; an ambulance carries
       nothing but its cross. */
    /* An arm carries what the unit's weapon table says it fires, so the barrel
       a shot comes out of is the barrel that looks like it fires it: the rail
       gun's thin blue line off the rail barrel, shells off the cannon. Each of
       these registers the muzzle mount that its style asks for. */
    function mechKit() {
      var st = spec.style, k = { main: 'cannon', off: 'mg', shoulder: null };
      /* What it actually carries comes first; the hull's own style only decides
         what hangs off the shoulders. */
      var spec2 = root.PMC && root.PMC.weaponSpec ? root.PMC.weaponSpec(u) : null;
      if (spec2 && ARM_FOR[spec2.p]) {
        /* Rockets lobbed in salvoes are a battery, not something a machine
           holds: they ride on the shoulder, where the hull carries its rack,
           and the arm takes whatever else it has. */
        var shoulderGun = SHOULDER_STYLE[spec2.p] || null;
        k.main = shoulderGun
          ? (spec2.s && ARM_FOR[spec2.s] !== 'rocket' ? ARM_FOR[spec2.s] : 'cannon')
          : ARM_FOR[spec2.p];
        k.off = spec2.s ? (ARM_FOR[spec2.s] || 'mg') : (k.main === 'mg' ? 'none' : 'mg');
        if (shoulderGun) { k.shoulder = shoulderGun; return k; }
        if (st) {
          k.shoulder = st.tMissiles || st.turret === 'mbt' || st.turret === 'future' ? 'missile'
            : st.mrl || st.mlrs || st.turret === 'calliope' ? 'rocket'
              : st.dish || st.turret === 'dish' ? 'dish'
                : st.turret === 'flamer' ? 'tanks'
                  : st.turret === 'recon' || st.cross ? 'aerials' : null;
        } else if (spec.dish) k.shoulder = 'dish';
        // a launcher on both an arm and the shoulder is one launcher too many
        if (k.shoulder === k.off || k.shoulder === k.main) k.shoulder = null;
        return k;
      }
      if (!st) {
        k.main = spec.twin ? 'twinauto' : spec.fat ? 'howitzer' : spec.elev ? 'rocket' : 'cannon';
        k.off = spec.drum ? 'flame' : 'missile';
        if (spec.dish) k.shoulder = 'dish';
        return k;
      }
      if (st.plasma) { var pk = { main: 'plasma', off: st.turret === 'future' ? 'rail' : st.tMissiles ? 'missile' : 'mg', shoulder: st.turret === 'future' || st.tMissiles ? 'missile' : null }; return pk; }
      switch (st.turret) {
        case 'light': k.main = st.gunLen >= 2 ? 'long' : 'cannon'; if (st.tMissiles) k.off = 'missile'; break;
        case 'howitzer': k.main = 'howitzer'; break;
        case 'recon': k.main = 'auto'; k.shoulder = 'aerials'; break;
        case 'mbt': k.main = st.gunLen >= 2.4 ? 'long' : 'cannon'; k.shoulder = 'missile'; if (st.tMissiles) k.off = 'missile'; break;
        case 'future': k.main = 'long'; k.off = 'rail'; k.shoulder = 'missile'; break;
        case 'plasma': k.main = 'plasma'; break;
        case 'flamer': k.main = 'flame'; k.shoulder = 'tanks'; break;
        case 'ifv': k.main = 'auto'; k.off = 'missile'; break;
        case 'aa': k.main = 'twinauto'; k.off = 'twinauto'; k.shoulder = st.noMissiles ? 'dish' : 'missile'; break;
        case 'dish': k.main = 'mg'; k.off = 'none'; k.shoulder = 'dish'; break;
        case 'calliope': k.main = 'cannon'; k.shoulder = 'rocket'; break;
        case 'arty': k.main = 'howitzer'; break;
        case 'mg': k.main = 'mg'; break;
        case 'missile': k.main = 'missile'; break;
        default:
          if (st.casemate) { k.main = st.casemate.w > 4 ? 'howitzer' : 'long'; k.off = st.casemate.missiles ? 'missile' : 'mg'; }
          else if (st.mrl || st.mlrs) { k.main = 'rocket'; k.shoulder = 'rocket'; }
          else if (st.bedGun) { k.main = st.bedGun === 'auto' ? 'auto' : 'mg'; k.off = st.bedRack ? 'rocket' : 'mg'; }
          else if (st.cross) { k.main = 'none'; k.off = 'none'; k.shoulder = 'aerials'; }
          else if (st.pintle || st.rws) { k.main = 'mg'; k.off = 'none'; if (st.aerials) k.shoulder = 'aerials'; }
          else { k.main = 'none'; k.off = 'none'; }
      }
      return k;
    }
    // one weapon, laid along a frame from a0 at height z, reaching `reach`
    function armWeapon(type, fr, a0, b, z, reach, sc, across) {
      var wd = across || 0.1;
      switch (type) {
        case 'cannon': return barrel(fr, a0, reach, b, z, 2.6 * sc, 'gun', { brake: true, fume: 0.5 });
        case 'long': return barrel(fr, a0, reach * 1.2, b, z, 2.3 * sc, 'gun', { brake: true, fume: 0.45 });
        // a combat walker's main gun: a heavy cannon held level, long and thick, braked at the muzzle
        case 'bigcannon': return barrel(fr, a0, reach * 1.15, b, z, 3.4 * sc, 'gun', { brake: true, fume: 0.55 });
        case 'howitzer': return barrel(fr, a0, reach * 0.8, b, z, 4.6 * sc, 'gun', { brake: true, up: 3 });
        case 'plasma': {
          var pw = 4 * sc, tip = barrel(fr, a0, reach * 0.95, b, z, pw, 'gun', { col: '#1c2129' });
          vents(fr, a0, reach * 0.95, b, z, pw, 3);
          if (!dead) sEllipse(tip[0], tip[1], pw * 0.4, pw * 0.36, 'rgba(180,245,255,.95)');
          return tip;
        }
        case 'flame': {
          var ft = barrel(fr, a0, reach * 0.55, b, z, 3.8 * sc, 'flame', { col: '#3a3f38', lit: '#5c6458' });
          if (!dead) { sEllipse(ft[0], ft[1], 1.5 * sc, 1.3 * sc, '#e08a3a'); sEllipse(ft[0], ft[1], 0.8, 0.7, '#ffd070'); }
          return ft;
        }
        case 'auto': return barrel(fr, a0, reach * 0.95, b, z, 1.5 * sc, 'auto', { brake: true });
        case 'twinauto':
          barrel(fr, a0, reach * 0.9, b - wd * 0.5, z, 1.3 * sc, 'auto', { brake: true });
          return barrel(fr, a0, reach * 0.9, b + wd * 0.5, z, 1.3 * sc, 'auto', { brake: true });
        case 'rail': {
          // a Gauss weapon: a heavy barrel with the charge burning blue along it
          var rw = 2.4 * sc, rt = barrel(fr, a0, reach, b, z, rw, 'rail', { col: '#141b22', lit: '#2a313b' });
          vents(fr, a0, reach, b, z, rw, 3);
          if (!dead) sEllipse(rt[0], rt[1], rw * 0.42, rw * 0.38, 'rgba(190,245,255,.95)');
          return rt;
        }
        case 'mg': return barrel(fr, a0, a0 + (reach - a0) * 0.55, b, z, 1.3 * sc, 'mg', { col: '#15181e', brake: true });
        case 'missile':
          return launcher(fr, a0 - 0.1, a0 + 0.22, b - wd, b + wd, z - 2, 6 * sc, 2, 3, 'missile', { warheads: '#6a5a3a' });
        case 'rocket':
          return launcher(fr, a0 - 0.12, a0 + 0.22, b - wd * 1.2, b + wd * 1.2, z - 2, 7 * sc, 3, 3, 'rocket', { tone: TT, warheads: '#8a3a24', up: 2 });
        default: {
          // no weapon: a manipulator — a clamp at the end of the arm
          slabF(fr, a0, a0 + 0.1, b - wd * 0.6, b + wd * 0.6, z - 2, 4 * sc, TS);
          return null;
        }
      }
    }

    function drawMech() {
      var hm = mechHeights(), cls = hm.cls, KITM = mechKit(), sf = hm.sf;
      var heavy = cls === 'heavy', light = cls === 'light';
      // a heavy walker built on an advanced-protection hull wears its hex armour
      var hexMech = heavy && !!(spec.style && (spec.style.body === 'future' || spec.style.hexNose));
      var hipY = lift + hm.legH;                       // where the legs meet the body
      var shoulder = hipY + hm.torsoH;                 // the top of the torso
      var waistY = hipY + Math.round(3 * sf);          // where the chest starts
      // the torso's half-depth and half-width
      var tL = MS.len * (heavy ? 0.22 : light ? 0.13 : 0.2);
      var tW = MS.wid * (heavy ? 0.42 : light ? 0.26 : 0.42);
      var TF = frameAt(0, 0, AIM);                     // the body turns to its target
      var ca = Math.cos(AIM), sa = Math.sin(AIM);
      var fwd = ca + sa;                               // > 0: the chest is toward the viewer
      function nearOf(s) { return s * (ca - sa); }     // > 0: that side is toward the viewer
      var RED = dead ? '#3a2e22' : '#c8322a';          // missile tips

      // the shadow the machine casts is its feet, not a hull-sized slab
      var fpr = project(box(0, 0, MS.len * (heavy ? 0.66 : light ? 0.42 : 0.56), MS.wid * (heavy ? 0.9 : light ? 0.5 : 0.75)), ground);
      poly(g, fpr, 'rgba(14,11,8,.34)');

      /* Legs stride: one forward, one back, so the pair reads in three quarters.
         On the move the two swap over frame by frame, which is what makes a
         walker walk rather than slide. */
      var swing = opts.walk ? (opts.walk % 2 ? 1 : -1) : 1;
      var legs2 = [{ fore: swing, s: 1 }, { fore: -swing, s: -1 }];
      var legSpread = tW * (heavy ? 0.6 : light ? 0.7 : 0.58);
      legs2.forEach(function (L) {
        L.d = L.fore * MS.len * 0.1 * (cos + sin) + L.s * legSpread * (cos - sin);
      });
      legs2.sort(function (p, q) { return p.d - q.d; });
      /* The arms hang outside the body, so the side an arm is on says whether
         the torso hides it; square to the viewer, the forearms held out in
         front (or behind) decide. The far arm goes down before the legs, as it
         is further out than they are. */
      var armsBack = [], armsFront = [];
      [-1, 1].forEach(function (s) { (nearOf(s) + 0.3 * fwd > 0 ? armsFront : armsBack).push(s); });
      var byNear = function (p, q) { return nearOf(p) - nearOf(q); };
      armsBack.sort(byNear); armsFront.sort(byNear);

      armsBack.forEach(drawArm);
      drawLeg(legs2[0]);
      drawLeg(legs2[1]);
      if (KITM.shoulder === 'tanks' && fwd > 0) backTanks();   // behind the chest
      drawTorso();
      armsFront.forEach(drawArm);
      drawTop();
      drawDamage();

      // a sensor light or a hot muzzle: a small orange dot, out when dead
      function glow(p, r) {
        if (dead || !p || typeof p[0] !== 'number') return;
        sEllipse(p[0], p[1], r * 2, r * 1.7, 'rgba(255,138,42,.28)');
        sEllipse(p[0], p[1], r, r * 0.85, '#ff8a2a');
        sEllipse(p[0] - r * 0.2, p[1] - r * 0.2, r * 0.45, r * 0.4, '#ffd68a');
      }
      /* Cockpit glass and sensor lenses: a glassy blue, bright at the top where
         it catches the sky and deep below, with a glint along its upper edge. */
      function glass(pts, glint) {
        // a drone walker has nobody to see out: no cockpit glass at all
        if (u.drone) return;
        var ys = pts.map(function (q) { return q[1]; });
        var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        var gl;
        if (dead) gl = GLASS;
        else {
          gl = g.createLinearGradient(0, y0, 0, y1 + 0.01);
          gl.addColorStop(0, '#c8f2ff'); gl.addColorStop(0.35, '#5cc0ec'); gl.addColorStop(0.75, '#1f6ea8'); gl.addColorStop(1, '#0f3456');
        }
        poly(g, pts, gl);
        if (glint) edge(g, glint[0], glint[1], dead ? GLINT : 'rgba(235,250,255,.9)', 0.8);
      }
      // a round lens of the same glass, with a highlight
      function lens(p, r) {
        if (!p || typeof p[0] !== 'number') return;
        sEllipse(p[0], p[1], r * 1.25, r * 1.1, '#0b0e12');
        if (dead) { sEllipse(p[0], p[1], r, r * 0.85, GLASS); return; }
        sEllipse(p[0], p[1], r * 2, r * 1.7, 'rgba(92,192,236,.22)');
        sEllipse(p[0], p[1], r, r * 0.85, '#2b86c4');
        sEllipse(p[0] + r * 0.1, p[1] + r * 0.15, r * 0.6, r * 0.5, '#1a5a8c');
        sEllipse(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.4, r * 0.34, '#d6f6ff');
      }
      // an outline with its corners cut: a plate that reads as rounded
      function oct(a0, a1, b0, b1, k) {
        var da = (a1 - a0) * (k || 0.3), db = (b1 - b0) * (k || 0.3);
        return [[a1, b0 + db], [a1, b1 - db], [a1 - da, b1], [a0 + da, b1], [a0, b1 - db], [a0, b0 + db], [a0 + da, b0], [a1 - da, b0]];
      }
      // a point on a front face raked back from a1 (at z0) to a1 - rake (at z0 + h)
      function onFront(a1, rake, z0, h, k, b) { return S3(TF(a1 - rake * k + 0.006, b), z0 + h * k); }

      /* ---- legs ---- */
      /* Hip, a knee bent a little forward, an ankle, a foot. A heavy leg is
         all armour, with a knee plate like a shield; a medium one is rounded
         plates over a clawed foot; a light one is thin, on a narrow foot. */
      function drawLeg(L) {
        var s = L.s * legSpread, fo = L.fore;
        var LF = frameAt(0, 0, f);                     // legs step the way the hull faces
        var front = cos + sin > 0;
        var hipT = fo * MS.len * 0.05;
        var kneeT = fo * MS.len * 0.1 + MS.len * 0.04;
        var ankT = fo * MS.len * 0.09;
        var kneeY = lift + Math.round(hm.legH * 0.5), ankY = lift + Math.round((heavy ? 5 : 4) * sf);
        var P = heavy ? { th: 0.1, tw: 0.13, sh: 0.1, sw: 0.13, fl: 0.15, fw: 0.15 }
          : light ? { th: 0.045, tw: 0.055, sh: 0.058, sw: 0.068, fl: 0.14, fw: 0.08 }
            : { th: 0.085, tw: 0.11, sh: 0.075, sw: 0.1, fl: 0.13, fw: 0.12 };
        var th = MS.len * P.th, tw = MS.wid * P.tw, sh = MS.len * P.sh, sw = MS.wid * P.sw;
        var fl = MS.len * P.fl, fw = MS.wid * P.fw;
        function J(t, z) { return S3(LF(t, s), z); }
        function outline(t, l, w) { return heavy || light ? rectPts(t - l, t + l, s - w, s + w) : oct(t - l, t + l, s - w, s + w, 0.3); }
        function foot() {
          if (light) {
            // a narrow foot, pointed at the toe
            shape(LF, [[ankT + fl, s], [ankT + fl * 0.45, s + fw], [ankT - fl * 0.6, s + fw], [ankT - fl * 0.6, s - fw], [ankT + fl * 0.45, s - fw]],
              lift, Math.round(4 * sf), TS, 0.75);
            return;
          }
          var toes = function () {
            if (heavy) {
              // two blocky toe plates
              [-0.5, 0.5].forEach(function (k) {
                slabF(LF, ankT + fl * 0.3, ankT + fl * 1.05, s + k * fw - fw * 0.47, s + k * fw + fw * 0.47, lift, Math.round(4 * sf), TB, fl * 0.3, 0, fw * 0.05);
              });
            } else {
              // three claws forward, splayed a little
              [-0.7, 0, 0.7].forEach(function (k) {
                var c0 = s + k * fw, c1 = s + k * fw * 1.35;
                shape(LF, [[ankT + fl * 1.2, c1 - fw * 0.1], [ankT + fl * 1.2, c1 + fw * 0.1], [ankT + fl * 0.3, c0 + fw * 0.22], [ankT + fl * 0.3, c0 - fw * 0.22]],
                  lift, Math.round(3 * sf), TS, null, [[ankT + fl * 0.6, c1 - fw * 0.08], [ankT + fl * 0.6, c1 + fw * 0.08], [ankT + fl * 0.3, c0 + fw * 0.16], [ankT + fl * 0.3, c0 - fw * 0.16]]);
              });
            }
          };
          var heel = function () {
            if (!heavy) shape(LF, rectPts(ankT - fl * 1.0, ankT - fl * 0.4, s - fw * 0.18, s + fw * 0.18), lift, Math.round(3 * sf), TS, null,
              rectPts(ankT - fl * 0.6, ankT - fl * 0.4, s - fw * 0.14, s + fw * 0.14));
          };
          if (front) heel(); else toes();
          slabF(LF, ankT - fl * 0.6, ankT + fl * 0.55, s - fw, s + fw, lift, Math.round((heavy ? 6 : 4) * sf), heavy ? TS : TB, fl * 0.2, fl * 0.15, fw * 0.08);
          if (front) toes(); else heel();
        }
        function shin() {
          // a calf thicker below the knee than at the ankle
          shape(LF, outline(ankT, sh * 0.8, sw * 0.8), ankY, kneeY - ankY - 1, TB, null, outline(kneeT, sh, sw));
        }
        function thigh() {
          var hp = J(hipT, hipY - 1);
          sEllipse(hp[0], hp[1], tw * K * 0.9, tw * K * 0.7, STEEL);
          shape(LF, outline(kneeT, th * 0.85, tw * 0.85), kneeY + 1, hipY - kneeY - 3, heavy || light ? TS : TB, null, outline(hipT, th, tw));
        }
        function knee() {
          var kp = J(kneeT, kneeY);
          sEllipse(kp[0], kp[1], sw * K * 0.8, sw * K * 0.6, STEEL);
          if (light) { sEllipse(kp[0] - 0.4, kp[1] - 0.4, sw * K * 0.45, sw * K * 0.35, STEEL_LIT); return; }
          // an armour plate over the knee, raked back at the top
          var k0 = kneeT + sh * 0.6, kl = heavy ? sh * 1.1 : sh * 0.7;
          slabF(LF, k0, k0 + kl, s - sw * (heavy ? 1.08 : 0.8), s + sw * (heavy ? 1.08 : 0.8), kneeY - Math.round((heavy ? 5 : 4) * sf),
            Math.round((heavy ? 11 : 8) * sf), heavy ? TB : TT, kl * 0.5, 0, sw * 0.12);
        }
        foot();
        if (!front) knee();
        shin();
        if (front) { var kj = J(kneeT, kneeY); sEllipse(kj[0], kj[1], sw * K * 0.8, sw * K * 0.6, STEEL); }
        thigh();
        if (front) knee();
      }

      /* ---- the body ---- */
      function drawTorso() {
        if (heavy) heavyTorso(); else if (light) lightTorso(); else mediumTorso();
      }
      /* A heavy mech's chest is a huge armoured box, its front raked back,
         over a waist that tapers into a skirt of plates about the hips. The
         head is sunk in it: all that shows is a visor slot high on the front. */
      function heavyTorso() {
        slabF(TF, -tL * 0.45, tL * 0.45, -tW * 0.45, tW * 0.45, hipY - 4, Math.round(7 * sf), TS);
        var skZ = hipY - Math.round(6 * sf), skH = waistY - skZ;
        var skB = [-tL * 0.62, tL * 0.68, tW * 0.66], skT = [-tL * 0.5, tL * 0.52, tW * 0.52];
        shape(TF, rectPts(skB[0], skB[1], -skB[2], skB[2]), skZ, skH, TB, null, rectPts(skT[0], skT[1], -skT[2], skT[2]));
        // the seams between the skirt plates, on the faces the viewer sees
        var seam = function (p0, p1) { line(p0, p1, 0.8, 'rgba(8,10,14,.55)'); };
        [-0.34, 0.34].forEach(function (k) {
          if (fwd > 0) seam(S3(TF(skB[1], k * skB[2]), skZ), S3(TF(skT[1], k * skT[2]), skZ + skH));
          if (fwd < 0) seam(S3(TF(skB[0], k * skB[2]), skZ), S3(TF(skT[0], k * skT[2]), skZ + skH));
          [-1, 1].forEach(function (s) {
            if (nearOf(s) <= 0) return;
            var ka = (k + 1) / 2;
            seam(S3(TF(skB[0] + (skB[1] - skB[0]) * ka, s * skB[2]), skZ), S3(TF(skT[0] + (skT[1] - skT[0]) * ka, s * skT[2]), skZ + skH));
          });
        });
        var chestH = shoulder - waistY, lowH = Math.round(chestH * 0.34), zU = waistY + lowH, upH = chestH - lowH;
        // exhaust stacks up the back of the chest, behind it when it faces the viewer
        var stacks = function () {
          [-1, 1].forEach(function (s) {
            var e0 = S3(TF(-tL * 1.02, s * tW * 0.62), zU + upH * 0.65), e1 = S3(TF(-tL * 1.02, s * tW * 0.62), shoulder + 4);
            line(e0, e1, Math.max(2.2, 3.2 * sf), STEEL);
            line([e0[0] - sf, e0[1]], [e1[0] - sf, e1[1]], 1.2, STEEL_LIT);
            sEllipse(e1[0], e1[1], 2 * sf, 1.2 * sf, '#0c0f13');
          });
        };
        if (fwd > 0) stacks();
        // the waist flaring out into the chest
        shape(TF, rectPts(-tL * 0.5, tL * 0.5, -tW * 0.5, tW * 0.5), waistY, lowH, TT, null, rectPts(-tL * 0.95, tL * 0.9, -tW, tW), true);
        // the chest itself, hunched forward, its front plate raked back
        shape(TF, rectPts(-tL * 0.95, tL * 0.9, -tW, tW), zU, upH, TB, null,
          rectPts(-tL * 0.82, tL * 0.56, -tW * 0.94, tW * 0.94));
        // five hex tiles across the back of the chest, three over two, when the back is towards the eye
        if (hexMech && fwd < -0.05) hexPanel(TF, [-tL * 0.95, tW * 0.8], [-tL * 0.95, -tW * 0.8], [-tL * 0.82, tW * 0.75], [-tL * 0.82, -tW * 0.75], zU, upH, [3, 2]);
        /* the cockpit: an angular armoured wedge standing out of the chest —
           a raked front facet, its corners cut back into angled cheeks, the
           top drawn in narrower — glazed in a T: a wide pane across the front
           facet with a narrow one under its middle, and a pane on each cheek */
        if (fwd > -0.1) {
          var ca0 = tL * 0.45, ca1 = tL * 1.1, cb = tW * 0.46, cz = zU + Math.round(upH * 0.32), ch = Math.round(upH * 0.52);
          var rk = tL * 0.22, ck = tL * 0.16;                 // the rake of the front, the depth of the cheeks
          var lo = [[ca0, -cb], [ca1 - ck, -cb], [ca1, -cb * 0.38], [ca1, cb * 0.38], [ca1 - ck, cb], [ca0, cb]];
          var hi = [[ca0, -cb * 0.8], [ca1 - rk - ck * 0.8, -cb * 0.8], [ca1 - rk, -cb * 0.32], [ca1 - rk, cb * 0.32], [ca1 - rk - ck * 0.8, cb * 0.8], [ca0, cb * 0.8]];
          shape(TF, lo, cz, ch, TB, null, hi);
          // a point on the front facet: k up it, u across it (-1 to 1)
          var ff = function (k, u) { return S3(TF(ca1 - rk * k + 0.006, u * cb * (0.38 - 0.06 * k)), cz + ch * k); };
          var pane = function (P, k0, k1, u0, u1, fr) {
            if (u.drone) return;                          // no panes, nor their dark frames
            var q = [P(k0, u0), P(k0, u1), P(k1, u1), P(k1, u0)];
            poly(g, [P(k0 - fr, u0 - fr * 1.6), P(k0 - fr, u1 + fr * 1.6), P(k1 + fr, u1 + fr * 1.6), P(k1 + fr, u0 - fr * 1.6)], '#0b0e12');
            glass(q, [q[3], q[2]]);
          };
          pane(ff, 0.48, 0.9, -0.84, 0.84, 0.05);
          pane(ff, 0.1, 0.4, -0.34, 0.34, 0.05);
          // a cheek on side s: v from its outer edge (0) to where it meets the front (1)
          [-1, 1].forEach(function (s) {
            if (fwd * 0.8 + nearOf(s) * 0.6 <= 0.05) return;
            var cf2 = function (k, v) {
              var a = (ca1 - ck) + ck * v - (rk + ck * 0.8 * (1 - v)) * k * (1 - v) - rk * k * v;
              var b = s * cb * ((1 - v) + 0.38 * v) * (1 - k * 0.2);
              return S3(TF(a + 0.006, b), cz + ch * k);
            };
            pane(cf2, 0.48, 0.88, 0.16, 0.84, 0.05);
          });
        }
        if (fwd <= 0) stacks();
      }
      /* A medium mech is one rounded body, narrow at the waist, widest at the
         chest, domed over the top, with its cockpit glazed into the front and
         heat sinks standing up behind. */
      function mediumTorso() {
        shape(TF, oct(-tL * 0.5, tL * 0.5, -tW * 0.45, tW * 0.45, 0.25), hipY - 4, Math.round(6 * sf), TS);
        var H = shoulder - waistY, h1 = Math.round(H * 0.32), h2 = Math.round(H * 0.36), h3 = H - h1 - h2;
        var R0 = oct(-tL * 0.7, tL * 0.7, -tW * 0.66, tW * 0.66), R1 = oct(-tL, tL, -tW, tW), R2 = oct(-tL * 0.62, tL * 0.58, -tW * 0.62, tW * 0.62);
        if (fwd > 0) vents();
        shape(TF, R0, waistY, h1, TB, null, R1, true);
        shape(TF, R1, waistY + h1, h2, TB, null, null, true);
        shape(TF, R1, waistY + h1 + h2, h3, TB, null, R2);
        // the canopy, over the front plate and up onto the dome
        if (fwd > 0.05 && !u.drone) {
          var z1 = waistY + h1 + h2, z0 = waistY + h1 + Math.round(h2 * 0.45), kT = 0.6;
          var aT = tL - tL * 0.42 * kT, bT = tW * (0.32 - 0.12 * kT);
          var cp = [S3(TF(tL + 0.006, -tW * 0.26), z0), S3(TF(tL + 0.006, tW * 0.26), z0), S3(TF(tL + 0.006, tW * 0.32), z1),
            S3(TF(aT + 0.006, bT), z1 + h3 * kT), S3(TF(aT + 0.006, -bT), z1 + h3 * kT), S3(TF(tL + 0.006, -tW * 0.32), z1)];
          glass(cp, [cp[4], cp[3]]);
          edge(g, cp[0], cp[1], 'rgba(8,10,14,.6)', 0.8);
        }
        if (fwd <= 0) vents();
      }
      // box heat sinks standing up off the back and the tops of the shoulders
      function vents() {
        var H = shoulder - waistY, zV = shoulder - Math.round(H * 0.35), hV = Math.round(H * 0.35 + 6 * sf);
        var V = [[-tL * 0.8, -tW * 0.5], [-tL * 0.8, tW * 0.5], [-tL * 1.02, 0]];
        V.sort(function (p, q) { var P1 = TF(p[0], p[1]), Q1 = TF(q[0], q[1]); return (P1.x + P1.y) - (Q1.x + Q1.y); });
        V.forEach(function (v, i) {
          var hh = v[1] === 0 ? hV - 2 : hV;
          slabF(TF, v[0] - tL * 0.13, v[0] + tL * 0.13, v[1] - tW * 0.12, v[1] + tW * 0.12, zV, hh, TT);
          var vt = S3(TF(v[0], v[1]), zV + hh);
          line([vt[0] - 2 * sf, vt[1]], [vt[0] + 2 * sf, vt[1]], 1, 'rgba(8,10,14,.6)');
        });
      }
      /* A light mech is a compact wedge of chest, broad at the shoulders,
         with an accent plate across its front, over a thin waist. */
      function lightTorso() {
        slabF(TF, -tL * 0.55, tL * 0.55, -tW * 0.55, tW * 0.55, hipY - 3, Math.round(5 * sf), TS, tL * 0.1, tL * 0.1, tW * 0.05);
        var wp = S3(TF(0, 0), hipY + 1), wq = S3(TF(0, 0), waistY + 2);
        line(wp, wq, Math.max(2.5, 4 * sf), STEEL);
        var cH = shoulder - waistY;
        shape(TF, rectPts(-tL * 0.7, tL * 0.5, -tW * 0.55, tW * 0.55), waistY, cH, TB, null, rectPts(-tL, tL * 1.05, -tW, tW));
        if (fwd > -0.1) {
          var k0 = 0.3, k1 = 0.95, fa = function (k) { return tL * 0.5 + tL * 0.55 * k + 0.01; }, fb = function (k) { return tW * (0.55 + 0.45 * k); };
          poly(g, [S3(TF(fa(k0), -fb(k0) * 0.6), waistY + cH * k0), S3(TF(fa(k0), fb(k0) * 0.6), waistY + cH * k0),
            S3(TF(fa(k1), fb(k1) * 0.72), waistY + cH * k1), S3(TF(fa(k1), -fb(k1) * 0.72), waistY + cH * k1)], TT.mid);
          edge(g, S3(TF(fa(k1), fb(k1) * 0.72), waistY + cH * k1), S3(TF(fa(k1), -fb(k1) * 0.72), waistY + cH * k1), TT.lit, 0.8);
          /* a medical walker wears its red cross on the front of the chest, on the plate:
             a white square and the cross, laid on the plate as it leans out */
          if (spec.cross) {
            var CP = function (u2, k) { return S3(TF(fa(k) + 0.004, u2 * fb(k) * 0.5), waistY + cH * k); };
            var kc = (k0 + k1) / 2, kh = (k1 - k0) * 0.36;
            var sq = function (u0, u1, ka, kb) { return [CP(u0, ka), CP(u1, ka), CP(u1, kb), CP(u0, kb)]; };
            poly(g, sq(-0.72, 0.72, kc - kh, kc + kh), '#e8e3d8');
            poly(g, sq(-0.54, 0.54, kc - kh * 0.25, kc + kh * 0.25), '#c23a32');
            poly(g, sq(-0.18, 0.18, kc - kh * 0.75, kc + kh * 0.75), '#c23a32');
          }
        }
      }

      /* ---- arms ---- */
      /* The upper arm hangs from the shoulder, the forearm is held level at
         the target. A heavy arm is a big square pauldron over a blocky
         forearm ending in a cannon or a claw; a medium one a rounded shoulder
         over a banded gun pod, twin barrels on one side; a light one a thin
         arm with a small gun box. Main weapon right, second weapon left. */
      function drawArm(s) {
        var off = s * tW * (heavy ? 1.42 : light ? 1.2 : 1.14);   // a light arm hangs right off the shoulder
        var fz = shoulder - Math.round((heavy ? 25 : light ? 15 : 22) * sf);
        var fh = Math.round((heavy ? 10 : light ? 6 : 7) * sf);
        var fwid = tW * (heavy ? 0.32 : light ? 0.26 : 0.24);
        var fa0 = tL * (heavy ? 0.1 : light ? 0.2 : 0), fa1 = tL * (heavy ? 1.2 : light ? 1.6 : 1.05);
        var shZ = shoulder - Math.round((heavy ? 8 : light ? 4 : 7) * sf);
        var elb = [tL * (heavy ? 0.3 : 0.25), fz + fh - 1];
        var type = s > 0 ? KITM.main : KITM.off;
        var wz = fz + Math.round(fh * 0.5);
        var sh = KITM.shoulder, rack = (sh === 'missile' || sh === 'rocket') && !heavy && s < 0;
        function pauldron() {
          if (heavy) {
            // an accent rim, then the square pauldron over it
            var pz = shoulder - Math.round(14 * sf);
            slabF(TF, -tL * 0.66, tL * 0.62, off - tW * 0.42, off + tW * 0.42, pz - 2, 3, TS);
            slabF(TF, -tL * 0.64, tL * 0.6, off - tW * 0.4, off + tW * 0.4, pz, shoulder + 3 - pz, TT, tL * 0.18, tL * 0.18, tW * 0.12);
            /* the advanced protection hex armour: two tiles on the front, the outer
               side and the rear of each shoulder, on whichever of them shows */
            if (hexMech) {
              var pa0 = -tL * 0.64, pa1 = tL * 0.6, pin = tL * 0.18, pb = tW * 0.4, ph = shoulder + 3 - pz;
              if (fwd > 0.05) hexPanel(TF, [pa1, off - pb], [pa1, off + pb], [pa1 - pin, off - pb * 0.7], [pa1 - pin, off + pb * 0.7], pz, ph, [2]);
              if (fwd < -0.05) hexPanel(TF, [pa0, off + pb], [pa0, off - pb], [pa0 + pin, off + pb * 0.7], [pa0 + pin, off - pb * 0.7], pz, ph, [2]);
              if (nearOf(s) > 0.05) hexPanel(TF, [pa0, off + s * pb], [pa1, off + s * pb], [pa0 + pin, off + s * pb * 0.7], [pa1 - pin, off + s * pb * 0.7], pz, ph, [2]);
            }
          } else if (light) {
            // a shoulder cap reaching in over the top of the chest, so the arm is plainly joined on
            slabF(TF, -tL * 0.55, tL * 0.55, off - tW * 0.34, off + tW * 0.3, shoulder - Math.round(6 * sf), Math.round(6 * sf), TB, tL * 0.15, tL * 0.1, tW * 0.05);
          } else {
            var mz = shoulder - Math.round(11 * sf);
            shape(TF, oct(-tL * 0.5, tL * 0.5, off - tW * 0.32, off + tW * 0.32, 0.3), mz, Math.round(9 * sf), TB, 0.6);
            if (rack) launcher(TF, -tL * 0.35, tL * 0.4, off - tW * 0.2, off + tW * 0.2, mz + Math.round(9 * sf) - 1, Math.round(6 * sf), 2, 2, sh,
              { tone: TT, warheads: RED, up: 1 });
          }
        }
        function upper() {
          if (heavy) {
            // a heavy arm's upper section is armoured too, from pauldron to elbow
            var uz = fz + fh - 2;
            slabF(TF, -tL * 0.28, tL * 0.24, off - tW * 0.26, off + tW * 0.26, uz, shoulder - Math.round(12 * sf) - uz + 3, TS, tL * 0.05, tL * 0.05, tW * 0.04);
            var ep = S3(TF(tL * 0.24, off), uz + 2);
            sEllipse(ep[0], ep[1], 3 * sf, 2.6 * sf, STEEL);
            return;
          }
          var p0 = S3(TF(0, off), shZ), p1 = S3(TF(elb[0], off), elb[1]);
          var w = Math.max(2, (light ? 3.6 : 5) * sf);
          line(p0, p1, w, STEEL);
          line([p0[0] - w * 0.2, p0[1]], [p1[0] - w * 0.2, p1[1]], Math.max(0.8, w * 0.2), STEEL_LIT);
          sEllipse(p1[0], p1[1], w * 0.62, w * 0.5, STEEL);
        }
        function forearm() {
          slabF(TF, fa0, fa1, off - fwid, off + fwid, fz, fh, TB, tL * 0.08, tL * 0.06, tW * 0.03);
          // accent bands round the forearm
          var bands = heavy ? [[0.78, 0.94]] : light ? [] : [[0.42, 0.56], [0.82, 0.96]];
          bands.forEach(function (bd) {
            slabF(TF, fa0 + (fa1 - fa0) * bd[0], fa0 + (fa1 - fa0) * bd[1], off - fwid * 1.08, off + fwid * 1.08, fz - 0.5, fh + 1, TT);
          });
        }
        function weapon() {
          var a0 = fa1 - tL * 0.05, reach = fa1 + MS.gun * (heavy ? 0.3 : light ? 0.2 : 0.28);
          var sc = sf * (heavy ? 1.6 : light ? 0.75 : 1.3);
          if (heavy && type === 'none') {
            // no gun on this arm: a clawed hand
            [-0.55, 0, 0.55].forEach(function (k) {
              var b = off + k * fwid;
              var c0 = S3(TF(fa1, b), fz + fh * 0.6), c1 = S3(TF(fa1 + tL * 0.3, b + k * fwid * 0.3), fz + fh * 0.3), c2 = S3(TF(fa1 + tL * 0.38, b), fz - 3 * sf);
              line(c0, c1, 2.2 * sf, STEEL); line(c1, c2, 1.8 * sf, STEEL);
              line([c0[0] - 0.5, c0[1] - 0.5], [c1[0] - 0.5, c1[1] - 0.5], 0.7, STEEL_LIT);
            });
            return;
          }
          if (!heavy && !light && s < 0 && (type === 'mg' || type === 'auto' || type === 'twinauto')) {
            // twin barrels, each with its muzzle glowing
            var kd = type === 'mg' ? 'mg' : 'auto';
            [-1, 1].forEach(function (k) {
              glow(barrel(TF, a0, reach * 0.92, off + k * fwid * 0.5, wz, 1.7 * sc, kd, { brake: true }), 0.9);
            });
            return;
          }
          var tip = armWeapon(type, TF, a0, off, wz, reach, sc, fwid * 0.9);
          if (!heavy && type !== 'plasma' && type !== 'flame') glow(tip, light ? 0.9 : 1);
        }
        if (fwd >= 0) { upper(); pauldron(); forearm(); weapon(); } else { weapon(); forearm(); upper(); pauldron(); }
      }

      /* ---- on top: a heavy's missile boxes, a medium's crest, a light's head ---- */
      /* The flame fuel slung on a walker's back: two tall bottles, the nearer
         drawn last. Facing the viewer they go down before the chest, which hides them. */
      function backTanks() {
        [-0.4, 0.4].sort(function (p, q) { return nearOf(p > 0 ? 1 : -1) * Math.abs(p) - nearOf(q > 0 ? 1 : -1) * Math.abs(q); }).forEach(function (b) {
          var t1 = S3(TF(-tL * 1.12, tW * b), shoulder - 16), t2 = S3(TF(-tL * 1.12, tW * b), shoulder);
          line(t1, t2, 8, '#3a3f38'); line([t1[0] - 2, t1[1]], [t2[0] - 2, t2[1]], 1.8, '#6a7064');
        });
      }
      function drawTop() {
        extras();
        /* A medium or heavy walker drone carries its sensor dome on its right
           shoulder pad and the aerial on its left (a light one's dome takes its
           head, below). */
        if (u.drone && !dead && !light) {
          var pad = tW * (heavy ? 1.42 : 1.14), pz = shoulder + (heavy ? 3 : 0);
          var dc2 = S3(TF(-tL * 0.1, pad), pz), dr6 = Math.max(4, 6 * sf);
          var kit = function () {
            sEllipse(dc2[0], dc2[1] + dr6 * 0.15, dr6 * 1.2, dr6 * 0.6, '#14171c');
            sEllipse(dc2[0], dc2[1] - dr6 * 0.35, dr6, dr6 * 0.85, '#aeb8c2');
            sEllipse(dc2[0], dc2[1] - dr6 * 0.05, dr6, dr6 * 0.42, '#7d8894');
            sEllipse(dc2[0] - dr6 * 0.35, dc2[1] - dr6 * 0.7, dr6 * 0.35, dr6 * 0.25, 'rgba(255,255,255,.75)');
            sEllipse(dc2[0] + dr6 * 0.2, dc2[1] - dr6 * 0.25, dr6 * 0.28, dr6 * 0.2, '#2a6f9a');
          };
          var mast = function () {
            var ab2 = S3(TF(-tL * 0.4, -pad), pz), at6 = S3(TF(-tL * 0.52, -pad), pz + Math.round(20 * sf));
            sEllipse(ab2[0], ab2[1], 2, 1.2, STEEL);
            line(ab2, at6, 1.4, STEEL_LIT);
            droneLamp(at6[0], at6[1]);
          };
          // the far one first, so the near one is drawn over it
          if (nearOf(1) > 0) { mast(); kit(); } else { kit(); mast(); }
        }
        if (heavy) {
          // a low cowl where the head is sunk into the chest
          slabF(TF, -tL * 0.1, tL * 0.46, -tW * 0.3, tW * 0.3, shoulder - 1, Math.round(3 * sf), TB, tL * 0.2, tL * 0.05, tW * 0.06);
          // a squat box on each front shoulder corner, its tubes facing forward
          var sh = KITM.shoulder, armed = sh === 'missile' || sh === 'rocket';
          var boxes = [-1, 1].sort(byNear);
          boxes.forEach(function (s) {
            var b0 = s * tW * 0.36, b1 = s * tW * 0.96, a0 = -tL * 0.3, a1 = tL * 0.58, bz = shoulder - 1, bh = Math.round(9 * sf);
            if (armed) launcher(TF, a0, a1, Math.min(b0, b1), Math.max(b0, b1), bz, bh, 2, 3, sh, { tone: TB, warheads: RED });
            else slabF(TF, a0, a1, Math.min(b0, b1), Math.max(b0, b1), bz, bh, TB, tL * 0.05, tL * 0.05, tW * 0.04);
          });
        } else if (light && u.drone && !dead) {
          /* A drone has no head to put a pilot in: the sensor dome sits on the
             chest where it was, and the aerial stands off the back shoulder. */
          // the dome on its right shoulder cap, the aerial on its left
          var dz = shoulder, dc = S3(TF(0, -tW * 1.12), dz), dr5 = Math.max(4, 5.5 * sf);
          sEllipse(dc[0], dc[1] + dr5 * 0.15, dr5 * 1.2, dr5 * 0.6, '#14171c');
          sEllipse(dc[0], dc[1] - dr5 * 0.35, dr5, dr5 * 0.85, '#aeb8c2');
          sEllipse(dc[0], dc[1] - dr5 * 0.05, dr5, dr5 * 0.42, '#7d8894');
          sEllipse(dc[0] - dr5 * 0.35, dc[1] - dr5 * 0.7, dr5 * 0.35, dr5 * 0.25, 'rgba(255,255,255,.75)');
          sEllipse(dc[0] + dr5 * 0.2, dc[1] - dr5 * 0.25, dr5 * 0.28, dr5 * 0.2, '#2a6f9a');
          var ab = S3(TF(-tL * 0.4, tW * 1.15), shoulder), at5 = S3(TF(-tL * 0.52, tW * 1.15), shoulder + Math.round(18 * sf));
          sEllipse(ab[0], ab[1], 2, 1.2, STEEL);                // its mount on the shoulder
          line(ab, at5, 1.4, STEEL_LIT);
          droneLamp(at5[0], at5[1]);
        } else if (light) {
          // the head sits straight on the chest, a size bigger, with a glassy blue eye
          var hz = shoulder - 1, hh = Math.round(9 * sf);
          slabF(TF, -tL * 0.45, tL * 0.62, -tW * 0.32, tW * 0.32, hz, hh, TB, tL * 0.34, tL * 0.05, tW * 0.06);
          if (fwd > -0.1) {
            var hf = function (k, b) { return onFront(tL * 0.62, tL * 0.34, hz, hh, k, b); };
            var vz = [hf(0.3, -tW * 0.26), hf(0.3, tW * 0.26), hf(0.7, tW * 0.23), hf(0.7, -tW * 0.23)];
            poly(g, vz, '#0b0e12');
            lens(hf(0.5, 0), 1.5 * Math.max(1, sf));
          }
          // the fin, a blade raked up and back to a point
          shape(TF, rectPts(-tL * 0.36, tL * 0.3, -tW * 0.08, tW * 0.08), hz + hh - 1, Math.round(7 * sf), TT, null,
            rectPts(-tL * 1.0, -tL * 0.72, -tW * 0.03, tW * 0.03));
        } else {
          // the dorsal crest over the dome, a sensor light at its brow
          slabF(TF, -tL * 0.62, tL * 0.52, -tW * 0.08, tW * 0.08, shoulder - 2, Math.round(6 * sf), TT, tL * 0.3, tL * 0.18, 0);
          glow(S3(TF(tL * 0.44, 0), shoulder + Math.round(2 * sf)), 1);
        }
      }
      // what the hull's role puts on its back: aerials, a dish, fuel, a cross
      function extras() {
        var bz = shoulder - 1;
        if (KITM.shoulder === 'aerials') { aerial(TF, -tL * 0.7, tW * 0.5, bz, 20); aerial(TF, -tL * 0.7, -tW * 0.5, bz, 14); }
        if (spec.dish || KITM.shoulder === 'dish') {
          var dr = light ? 3.2 : heavy ? 5 : 4.2;
          var db = S3(TF(-tL * 0.7, -tW * 0.35), bz), dm = S3(TF(-tL * 0.7, -tW * 0.35), bz + (light ? 5 : 8));
          line(db, dm, 1.2, STEEL);
          sEllipse(dm[0], dm[1] - 1.2, dr, dr * 0.72, '#9aa4b0'); sEllipse(dm[0] + 0.5, dm[1] - 1, dr * 0.78, dr * 0.52, '#c3ccd6');
        }
        if (KITM.shoulder === 'tanks' && fwd <= 0) backTanks();   // facing away, they are in front of the chest
        if (spec.cross && !light) crossOn(TF, -tL * 0.35, 0, shoulder + (heavy ? 0.3 : -0.7), tW * 0.3);
      }

    }

    /* ================= rotorcraft ================= */
    function drawRotorcraft() {
      var base = lift, cabTop = base + spec.hgt;

      // skids, slung under the cabin
      if (spec.skids) {
        [-1, 1].forEach(function (s) {
          var s0 = scr(spec.len * 0.34, s * spec.wid * 0.52);
          var s1 = scr(-spec.len * 0.3, s * spec.wid * 0.52);
          thickLine(g, s0.x, s0.y - base + 7, s1.x, s1.y - base + 7, 2, STEEL);
          [0.22, -0.16].forEach(function (t) {
            var sp4 = scr(spec.len * t, s * spec.wid * 0.5);
            thickLine(g, sp4.x, sp4.y - base - 2, sp4.x + a(s * 1.2), sp4.y - base + 7, 2, STEEL);
          });
        });
      }

      // tail boom, tapering back from the cabin, with a fin and a tail rotor
      var bl = box(-spec.len * 0.42 - spec.boom * 0.42, 0, spec.boom, spec.wid * 0.34);
      var bh = box(-spec.len * 0.42 - spec.boom * 0.5, 0, spec.boom * 0.9, spec.wid * 0.2);
      taper(g, bl, bh, base + Math.round(spec.hgt * 0.45), 7, dark, hull, lit);
      var tailT = -spec.len * 0.42 - spec.boom * 0.92;
      var tp = scr(tailT, 0);
      var finY = base + Math.round(spec.hgt * 0.45);
      rect(g, tp.x - 2, tp.y - finY - 17, 4, 18, hull);       // fin
      rect(g, tp.x - 2, tp.y - finY - 17, 4, 3, trim);
      [-1, 1].forEach(function (s) {                          // tailplane
        var th2 = scr(tailT + spec.len * 0.1, s * spec.wid * 0.42);
        thickLine(g, tp.x, tp.y - finY - 4, th2.x, th2.y - finY - 4, 3, hull);
      });
      // the tail rotor, seen edge-on as a disc
      var trp = scr(tailT - spec.len * 0.02, spec.wid * 0.18);
      if (!dead) ellipseRing(g, trp.x, trp.y - finY - 8, a(2.6), a(2.5), 'rgba(190,200,214,.34)');
      dot(g, trp.x, trp.y - finY - 8, STEEL_LIT, 3);

      // the cabin, deep at the front and narrowing to the boom
      var cl = box(spec.len * 0.02, 0, spec.len, spec.wid);
      var ch = box(-spec.len * 0.06, 0, spec.len * 0.86, spec.wid * spec.taper);
      taper(g, cl, ch, base, spec.hgt, dark, hull, lit);
      bandOnSides(g, cl, base, spec.hgt, 2, trim);

      // stub wings with pylons and pods
      if (spec.pylons) {
        [-1, 1].forEach(function (s) {
          var root = along(-spec.len * 0.1, s * spec.wid * 0.46);
          var tip = along(-spec.len * 0.12, s * spec.wid * (spec.stubs ? 1.5 : 1.25));
          var wing = [
            [root.x, root.y], [tip.x, tip.y],
            [tip.x - cos * spec.len * 0.16, tip.y - sin * spec.len * 0.16],
            [root.x - cos * spec.len * 0.2, root.y - sin * spec.len * 0.2]
          ];
          var wy = base + Math.round(spec.hgt * 0.52);
          var wlo = project(wing, wy), whi = project(wing, wy + 3);
          poly(g, [wlo[1], wlo[2], whi[2], whi[1]], dark);
          poly(g, whi, s < 0 ? lit : hull);
          for (var pnum = 0; pnum < spec.pylons; pnum++) {
            var ps = s * spec.wid * (0.72 + pnum * 0.3);
            var pp2 = scr(-spec.len * 0.1, ps);
            rect(g, pp2.x - 1, pp2.y - wy + 2, 2, 4, STEEL);            // pylon
            rect(g, pp2.x - a(2.2), pp2.y - wy + 5, a(4.4), 5, STEEL);  // rocket pod
            rect(g, pp2.x - a(2.2), pp2.y - wy + 5, a(4.4), 2, STEEL_LIT);
          }
        });
      }

      // canopy: stepped and tandem on the gunships, a wide screen on the lifter
      var cp3 = scr(spec.len * 0.3, 0);
      if (spec.tandem) {
        rect(g, cp3.x - 5, cp3.y - cabTop - 4, 10, 6, GLASS);
        rect(g, cp3.x - 5, cp3.y - cabTop - 4, 10, 2, GLINT);
        var cp4 = scr(spec.len * 0.06, 0);
        rect(g, cp4.x - 6, cp4.y - cabTop - 8, 12, 7, GLASS);
        rect(g, cp4.x - 6, cp4.y - cabTop - 8, 12, 2, GLINT);
      } else {
        rect(g, cp3.x - 8, cp3.y - cabTop - 5, 16, 8, GLASS);
        rect(g, cp3.x - 8, cp3.y - cabTop - 5, 16, 2, GLINT);
        var dr = scr(-spec.len * 0.06, -spec.wid * 0.5);               // cabin door
        rect(g, dr.x - a(3), dr.y - base - spec.hgt + 3, a(6), spec.hgt - 7, dark);
      }
      // chin turret on the gunships
      if (spec.chin) {
        var cn = scr(spec.len * 0.42, 0);
        dot(g, cn.x, cn.y - base - 3, STEEL, 5);
        var cb = scr(spec.len * 0.72, 0);
        thickLine(g, cn.x, cn.y - base - 2, cb.x, cb.y - base - 2, 3, '#1a1e25');
      }

      // the mast, hub and blades, with the disc they sweep
      var mp = toScreen(at.x, at.y);
      var rotY = cabTop + 11;
      rect(g, mp.x - 2, mp.y - rotY, 4, 12, STEEL);
      dot(g, mp.x, mp.y - rotY, STEEL_LIT, 5);
      if (!dead) ellipseRing(g, mp.x, mp.y - rotY - 1, spec.rotor * K * 0.5, spec.rotor * K * 0.25,
        'rgba(198,210,224,.26)');
      for (var bnum2 = 0; bnum2 < spec.blades; bnum2++) {
        var ang = f + bnum2 * (Math.PI * 2 / spec.blades) + 0.4;
        var bx = at.x + Math.cos(ang) * spec.rotor * 0.5;
        var by = at.y + Math.sin(ang) * spec.rotor * 0.5;
        var bp = toScreen(bx, by);
        thickLine(g, mp.x, mp.y - rotY - 1, bp.x, bp.y - rotY - 1, 2, dead ? '#2b2721' : '#3a4150');
      }

      drawDamage();
    }

    /* Drone Control (p. 37): no crew, so the hull carries what flies it instead —
       a sensor dome on the roof towards the back, and a whip aerial beside it
       with a light on the tip. */
    /* Drawn as one of a styled hull's parts where it has them, so a turret in
       front of it hides it; otherwise last, over the hull. */
    var droneDone = false;
    function droneDue() { return u.drone && !dead && !/Turret/.test(u.group || ''); }
    function drawDrone(only) {
      if (droneDone || !droneDue()) return;
      if (!only) droneDone = true;
      droneKit(only);
    }
    // where the dome goes, as a point on the hull (for sorting it among the parts)
    function droneSpot() {
      var body = spec.style && spec.style.body, legs = driveOf(u) === 'walker' && !(u.transport && spec.style);
      if (body === 'pickup') return along(spec.len * (driveOf(u) !== 'wheeled' ? 0.35 : 0.05), -spec.wid * 0.22);
      if (body === 'guntruck') {
        var c = spec.style.flatCab ? 0.24 : spec.style.heavy ? 0.28 : 0.3;
        return along(spec.len * (0.5 - c * 0.71), -spec.wid * 0.22);
      }
      if (spec.craft === 'disc') return along(0, 0);
      if (spec.fly) return along(spec.len * 0.05, 0);
      if (legs) return along(-spec.len * 0.12, spec.wid * 0.3);
      var carS = spec.style && spec.style.body === 'car';
      return along(-spec.len * (carS ? 0.34 : 0.42), -spec.wid * (carS ? 0.26 : 0.34));
    }
    // `only`: 'dome' or 'aerial', when a styled hull sorts the two among its parts
    function droneKit(only) {
      var y5 = spec.heli ? lift + spec.hgt : top + (spec.deck ? spec.dHgt : 0);
      var legs = driveOf(u) === 'walker' && !(u.transport && spec.style);
      if (legs) return;                                      // a walker carries its own, on its shoulders
      var body = spec.style && spec.style.body;
      /* The dome: on a hull's roof off to one side, clear of a turret; on a
         pickup or gun truck, to one side of the flat plate where its cab used to
         be; on a walker, up on a shoulder; on a craft, the middle of its back. */
      // the back corner of the roof, opposite the aerial — kept on the roof, which narrows to the top
      var carB = spec.style && spec.style.body === 'car';
      var back = carB ? -0.34 : -0.42, off = -spec.wid * (carB ? 0.26 : 0.34);
      // a styled hull's roof is lower than its full height: sit on the roof itself
      if (spec.style && !spec.fly) {
        var stb = spec.style.body;
        y5 = deck + spec.hgt * ({ mbt: 0.8, tank: 0.88, ltank: 0.88, future: 0.9, ifv: 0.85, bigbox: 1.08, car: 1, pickup: 0.45, truck: 1.45, mlrs: 0.55, guntruck: 0.5 }[stb] || 1) -
          (stb === 'car' ? 2 : 0) + (stb === 'bigbox' ? spec.hgt * 0.3 : 0);
      }
      // a craft's back is measured from where it flies, not from a ground hull's ride height
      // a pickup or gun truck carries it to one side of the flat plate where its cab used to be
      if (body === 'pickup') { back = driveOf(u) !== 'wheeled' ? 0.35 : 0.05; off = -spec.wid * 0.22; y5 = deck + spec.hgt * 0.7; }
      else if (body === 'guntruck') {
        var cabL2 = spec.style.flatCab ? 0.24 : spec.style.heavy ? 0.28 : 0.3;
        back = 0.5 - cabL2 * 0.71; off = -spec.wid * 0.22; y5 = deck + spec.hgt * 0.78;
      }
      else if (spec.craft === 'disc') { back = 0; off = 0; y5 = lift + spec.hgt * 0.68; }     // on the disc's hump
      else if (spec.fly) { back = 0.12; off = 0; y5 = lift + spec.hgt * (spec.craft === 'jet' ? 0.9 : 0.86); }
      else if (legs) { back = -0.12; off = spec.wid * 0.3; }     // its right shoulder
      var dq = along(spec.len * back, off), dp = toScreen(dq.x, dq.y);
      var r = Math.max(3, K * 0.16) * (spec.craft === 'disc' ? 0.75 : 1), cy = dp.y - y5;
      if (only !== 'aerial') {
      ellipse(g, dp.x, cy + r * 0.15, r * 1.25, r * 0.6, '#14171c');               // the collar it sits in
      ellipse(g, dp.x, cy - r * 0.2, r, r * 0.85, '#aeb8c2');                      // the dome
      ellipse(g, dp.x, cy + r * 0.05, r, r * 0.45, '#7d8894');
      ellipse(g, dp.x - r * 0.35, cy - r * 0.5, r * 0.35, r * 0.25, 'rgba(255,255,255,.75)');
      ellipse(g, dp.x + r * 0.2, cy - r * 0.05, r * 0.28, r * 0.2, '#2a6f9a');     // the sensor behind the dome's skin
      }
      // a jet has no aerial: its light blinks on top of the dome instead (a disc's is the red eye on its emitter)
      if (only !== 'aerial' && spec.fly && spec.craft === 'jet') {
        // just ahead of the dome, on the spine towards the nose
        var lq = toScreen(along(spec.len * (back + 0.13), 0).x, along(spec.len * (back + 0.13), 0).y);
        droneLamp(lq.x, lq.y - y5 - 1.2);
      }
      if (only === 'dome') return;
      // the aerial, at the back: the rear corner of a hull or its bed, a craft's tail, behind a walker's dome
      var aq, ya = y5;
      if (spec.fly && (spec.craft === 'jet' || spec.craft === 'disc')) return;      // a jet or a disc carries the dome only
      if (spec.fly) aq = along(-spec.len * 0.06, spec.wid * 0.3);   // a rotorcraft's stands on the back of its body
      else if (legs) aq = along(spec.len * back - 0.2, -spec.wid * 0.3);   // its left shoulder
      else {
        aq = along(-spec.len * 0.44, spec.wid * 0.32);
        if (body === 'pickup' || body === 'guntruck') ya = deck + spec.hgt * 0.5;
      }
      var ap = toScreen(aq.x, aq.y), ay = ap.y - ya, ah = Math.max(10, K * 0.55);
      ellipse(g, ap.x, ay, 2, 1.2, STEEL);                   // its mount
      thickLine(g, ap.x, ay, ap.x + 1, ay - ah, 1.4, STEEL_LIT);
      droneLamp(ap.x + 1, ay - ah);
    }
    // the red light on a drone's aerial: it blinks, about once a second, and is out on a wreck
    function droneLamp(x, y) {
      var lit = !dead && Math.floor((root.performance ? performance.now() : 0) / 500) % 2 === 0;
      if (lit) ellipse(g, x, y, 3.6, 3.6, 'rgba(255,80,64,.28)');
      ellipse(g, x, y, 1.6, 1.6, lit ? '#ff5040' : '#5a1c16');
    }

    function drawDamage() {
      drawDrone();
      if (!u.damage || !u.str) return;
      var dr2 = rng((u.id || 'x').length * 977 + u.damage * 31);
      var y4 = spec.heli ? lift + spec.hgt : top + (spec.deck ? spec.dHgt : 0);
      for (var d = 0; d < u.damage * 4; d++) {
        var sx = at.x + (dr2() - 0.5) * spec.len * 0.8, sy = at.y + (dr2() - 0.5) * spec.wid * 0.8;
        var sp5 = toScreen(sx, sy);
        dot(g, sp5.x, sp5.y - y4, dr2() > 0.5 ? '#1a1410' : '#3a2e22', 2);
      }
    }
  }

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
