/* PMC 2670 — Firefight : the story's places as pixel-art scenes (docs/story-mode-plan.md, phase 7)

   A chapter's card, a battle's briefing and the ending open on a picture of
   where it happens: the starport at dusk with a shuttle coming down, the
   refinery's flare stack at night, Pit Nine's lit streets, the brood chambers
   under the Sump. Each is drawn here on a 128 x 48 grid of flat colours, a
   sky graded by ordered dithering, the land in layers, and the place's own
   buildings, machines, smoke and lights on it; the same every time it is drawn
   (its own seed). In a browser it comes back as a PNG drawn once on a canvas
   and kept; elsewhere (the tests) as the grid itself, or an SVG of its pixels.

   scene: one of SCENES' keys; time: dusk | night | day | dawn | fire | under
   (each scene has its own, which a caller may change). */
(function (root) {
  'use strict';

  var W = 128, H = 48;

  // the light: a sky graded from top to horizon, and the land under it
  var TIMES = {
    dusk: { sky: ['#231d38', '#6a3550', '#d9783f'], far: '#4b3446', mid: '#2e2334', near: '#1d1820', ground: '#2b2220', lit: '#ffd27a', smoke: '#5b4652', stars: false, giant: true },
    night: { sky: ['#070a14', '#131a2e', '#2c2a48'], far: '#1a1d2e', mid: '#121522', near: '#0c0e16', ground: '#15151b', lit: '#ffcf6a', smoke: '#2e3040', stars: true, giant: true },
    day: { sky: ['#5f7186', '#9aa6ae', '#c9c2ae'], far: '#7b7d80', mid: '#5a5c60', near: '#3e3e42', ground: '#4a443c', lit: '#f0e2a0', smoke: '#8a8a8a', stars: false, giant: false },
    dawn: { sky: ['#2d3a5c', '#7a7896', '#e6b48c'], far: '#5a5a70', mid: '#3c3c4e', near: '#26262f', ground: '#33302e', lit: '#ffe0a0', smoke: '#6a6672', stars: false, giant: true },
    fire: { sky: ['#12080c', '#3e1416', '#b8422a'], far: '#3a1a1c', mid: '#24100f', near: '#160a0a', ground: '#1e1210', lit: '#ffb04a', smoke: '#3a2622', stars: false, giant: false },
    under: { sky: ['#07060b', '#0d0a14', '#160f20'], far: '#1b1424', mid: '#140f1b', near: '#0b0810', ground: '#120d18', lit: '#c68cff', smoke: '#2a2034', stars: false, giant: false }
  };

  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function dith(x, y, f) { return f * 16 > BAYER[y & 3][x & 3] + 0.5; }

  // a seeded random, from the scene's name
  function rng(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return function () {
      h = (h + 0x6D2B79F5) | 0;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  /* ---------- the canvas: a grid, and what can be drawn on it ---------- */

  function Pic(time, seed) {
    this.t = TIMES[time] || TIMES.dusk;
    this.r = rng(seed);
    this.g = [];
    for (var y = 0; y < H; y++) { this.g.push([]); for (var x = 0; x < W; x++) this.g[y].push(this.t.sky[0]); }
  }
  var P = Pic.prototype;
  P.put = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) this.g[y][x] = c; };
  P.get = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H ? this.g[y][x] : null; };
  P.rect = function (x0, y0, x1, y1, c) { for (var y = Math.round(y0); y <= y1; y++) for (var x = Math.round(x0); x <= x1; x++) this.put(x, y, c); };
  P.disc = function (cx, cy, r, c, f) {
    for (var y = Math.floor(cy - r); y <= cy + r; y++) for (var x = Math.floor(cx - r); x <= cx + r; x++) {
      var d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r && (f == null || dith(x, y, f))) this.put(x, y, c);
    }
  };
  P.line = function (x0, y0, x1, y1, c) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (var i = 0; i <= n; i++) this.put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
  };
  // a glow: a soft round of colour, thinning out by dithering
  P.glow = function (cx, cy, r, c, k) {
    for (var y = Math.floor(cy - r); y <= cy + r; y++) for (var x = Math.floor(cx - r); x <= cx + r; x++) {
      var d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d < 1 && dith(x, y, (1 - d) * (k || 0.6))) this.put(x, y, c);
    }
  };

  // the sky, graded through its three colours, the stars and the gas giant the moon goes round
  P.sky = function (horizon) {
    var s = this.t.sky;
    for (var y = 0; y < H; y++) {
      var f = Math.min(1, y / horizon) * 2, i = Math.min(1, Math.floor(f)), frac = f - i;
      for (var x = 0; x < W; x++) this.g[y][x] = dith(x, y, frac) ? s[Math.min(2, i + 1)] : s[i];
    }
    if (this.t.stars) for (var k = 0; k < 40; k++) this.put(this.r() * W, this.r() * horizon * 0.8, this.r() < 0.2 ? '#ffffff' : '#9aa4c8');
    return this;
  };
  P.giant = function (cx, cy, r) {
    if (!this.t.giant) return this;
    var bands = ['#8a6a5a', '#a07a62', '#6e5450', '#b48a6a', '#7a5e56'];
    for (var y = Math.floor(cy - r); y <= cy + r; y++) for (var x = Math.floor(cx - r); x <= cx + r; x++) {
      var d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) continue;
      var c = bands[Math.floor((y - cy + r) / 2.6) % bands.length];
      if (x - cx > r * 0.35 && dith(x, y, (x - cx - r * 0.35) / (r * 0.7))) c = shade(c, -0.45);
      this.put(x, y, shade(c, this.t === TIMES.night ? -0.45 : -0.1));
    }
    for (var rx = -r * 1.7; rx <= r * 1.7; rx++) { var ry = cy + rx * 0.18; if (Math.abs(rx) > r * 0.92 || ry > cy) this.put(cx + rx, ry, '#c9a888'); }
    return this;
  };
  // a ridge of land: a rough skyline, filled to the bottom
  P.ridge = function (base, amp, c, rough) {
    var a = this.r() * 6, b = this.r() * 6, cc = this.r() * 6, q = rough || 1;
    for (var x = 0; x < W; x++) {
      var h = base - amp * (0.5 + 0.3 * Math.sin(x / 13 + a) + 0.15 * Math.sin(x / 5.3 + b) * q + 0.08 * Math.sin(x / 2.1 + cc) * q);
      for (var y = Math.max(0, Math.floor(h)); y < H; y++) this.put(x, y, c);
    }
    return this;
  };
  P.ground = function (y0) {
    var gc = this.t.ground;
    for (var y = y0; y < H; y++) for (var x = 0; x < W; x++) this.put(x, y, dith(x, y, (y - y0) / (H - y0) * 0.7) ? shade(gc, -0.35) : gc);
    for (var k = 0; k < 40; k++) this.put(this.r() * W, y0 + 1 + this.r() * (H - y0 - 1), shade(gc, 0.18));
    return this;
  };
  // a building: its block, a roofline and windows, some lit
  P.building = function (x, w, h, gy, c, opts) {
    opts = opts || {};
    var top = gy - h;
    this.rect(x, top, x + w - 1, gy, c);
    this.rect(x, top, x + w - 1, top, shade(c, 0.18));
    this.rect(x + w - 1, top, x + w - 1, gy, shade(c, -0.25));
    if (opts.roof === 'peak') for (var i = 0; i <= w / 2; i++) this.rect(x + i, top - Math.min(i, w - i) * 0.6, x + w - 1 - i, top - 1, c);
    var lit = opts.lit == null ? 0.35 : opts.lit;
    for (var wy = top + 2; wy < gy - 1; wy += 3) for (var wx = x + 1; wx < x + w - 2; wx += 3) {
      this.put(wx, wy, this.r() < lit ? this.t.lit : shade(c, -0.35));
    }
    return this;
  };
  // smoke going up and drifting with the wind
  P.smoke = function (x, y, n, drift, c) {
    c = c || this.t.smoke;
    for (var i = 0; i < n; i++) this.disc(x + drift * i * 0.7, y - i * 2.2, 1.2 + i * 0.45, c, 0.85 - i / (n * 1.4));
    return this;
  };
  P.fire = function (x, y, s) {
    s = s || 1;
    this.glow(x, y - 1, 6 * s, '#c0502a', 0.7);
    this.disc(x, y - 1, 1.6 * s, '#ff8a2a');
    this.put(x, y - 2 * s, '#ffd27a'); this.put(x, y - 3 * s, '#ffb04a'); this.put(x, y - 1, '#fff2c0');
    return this;
  };
  P.people = function (x, gy, n, c, gap) {
    for (var i = 0; i < n; i++) { var px = x + i * (gap || 3); this.rect(px, gy - 3, px, gy - 1, c); this.put(px, gy - 4, c); }
    return this;
  };
  P.tree = function (x, gy, h, c) {
    for (var y = 0; y < h; y++) { var w = Math.floor((y + 1) / 2.2); this.rect(x - w, gy - h + y, x + w, gy - h + y, c); }
    this.put(x, gy, shade(c, -0.3));
    return this;
  };
  P.truck = function (x, gy, c, lights) {
    this.rect(x, gy - 3, x + 6, gy - 1, c); this.rect(x + 7, gy - 3, x + 9, gy - 1, shade(c, 0.2)); this.put(x + 8, gy - 3, '#9cc4dc');
    this.put(x + 1, gy, '#111'); this.put(x + 5, gy, '#111'); this.put(x + 8, gy, '#111');
    if (lights) for (var i = 1; i < 12; i++) for (var j = -Math.floor(i / 4); j <= Math.floor(i / 4); j++) if (dith(x + 9 + i, gy - 2 + j, 0.55 - i / 26)) this.put(x + 9 + i, gy - 2 + j, '#ffe9a8');
    return this;
  };
  // a lattice of girders, as a headframe or a cracking tower has
  P.lattice = function (x, gy, w, h, c) {
    var top = gy - h;
    this.line(x, gy, x + w / 2 - 1, top, c); this.line(x + w, gy, x + w / 2 + 1, top, c);
    for (var y = gy - 3; y > top + 1; y -= 4) {
      var f = (gy - y) / h, l = x + f * (w / 2 - 1), r = x + w - f * (w / 2 - 1);
      this.line(l, y, r, y - 3, c); this.line(r, y, l, y - 3, c);
    }
    this.rect(x + w / 2 - 2, top - 1, x + w / 2 + 2, top, c);
    return this;
  };
  P.shuttle = function (x, y, burn) {
    var hull = '#9aa4b2', dark = '#5a6270';
    this.rect(x, y, x + 11, y + 3, hull); this.rect(x + 2, y - 1, x + 9, y - 1, hull); this.rect(x + 12, y + 1, x + 13, y + 2, hull);
    this.rect(x, y + 3, x + 11, y + 3, dark); this.put(x + 11, y + 1, '#9cc4dc'); this.rect(x - 1, y + 2, x, y + 4, dark);
    if (burn) { this.glow(x + 5, y + 7, 6, '#ff9a3a', 0.6); this.rect(x + 3, y + 4, x + 3, y + 6, '#ffd27a'); this.rect(x + 8, y + 4, x + 8, y + 6, '#ffd27a'); }
    return this;
  };
  P.dish = function (x, gy, r, c) {
    this.rect(x, gy - r, x, gy, shade(c, -0.3));
    for (var a = -0.2; a <= Math.PI + 0.2; a += 0.05) this.put(x - 1 + Math.cos(a + 0.6) * r, gy - r - 1 - Math.sin(a + 0.6) * r * 0.6, c);
    this.line(x - 1, gy - r - 1, x + r * 0.4, gy - r * 1.6, c);
    return this;
  };
  P.beam = function (x, gy) {
    for (var y = 0; y < gy; y++) { this.put(x, y, '#fff6d0'); this.put(x + 1, y, '#ffe08a'); if (dith(x, y, 0.5)) { this.put(x - 1, y, '#ff9a3a'); this.put(x + 2, y, '#ff9a3a'); } }
    this.glow(x, gy, 9, '#ff7a2a', 0.8); this.disc(x, gy, 2.5, '#fff2c0');
    return this;
  };
  P.crack = function (x, y, len, c) {
    var cx = x, cy = y;
    for (var i = 0; i < len; i++) { this.put(cx, cy, c); if (dith(cx, cy + 1, 0.5)) this.put(cx, cy + 1, shade(c, -0.3)); cx += 1; cy += this.r() < 0.5 ? (this.r() < 0.5 ? -1 : 1) : 0; }
    return this;
  };
  P.fence = function (x0, x1, gy, c) {
    this.rect(x0, gy - 3, x1, gy - 3, c);
    for (var x = x0; x <= x1; x += 3) this.rect(x, gy - 4, x, gy - 1, c);
    return this;
  };
  P.light = function (x, y, c) { this.put(x, y, c || '#ff4a3a'); this.glow(x, y, 3, c || '#ff4a3a', 0.35); return this; };

  /* ---------- the places ---------- */

  var SCENES = {
    starport: { time: 'dusk', draw: function (p) {
      p.sky(30).giant(98, 11, 9).ridge(30, 8, p.t.far).ridge(34, 4, p.t.mid, 0.4).ground(36);
      p.building(6, 18, 9, 36, '#3a3240', { lit: 0.4 }); p.building(26, 12, 7, 36, '#342c3a');
      p.rect(48, 22, 50, 36, '#3c3442'); p.rect(45, 19, 53, 22, '#3c3442'); p.rect(46, 20, 52, 20, p.t.lit); p.rect(49, 15, 49, 18, '#555'); p.light(49, 15);
      p.fence(0, 127, 41, '#1a1418');
      [[66, 40], [88, 43], [108, 39]].forEach(function (pd) { p.rect(pd[0] - 7, pd[1], pd[0] + 7, pd[1] + 1, '#4a4048'); p.rect(pd[0] - 1, pd[1], pd[0] + 1, pd[1], '#e0b04a'); });
      p.shuttle(60, 14, true);
      p.building(112, 10, 6, 36, '#2a2228', { lit: 0.6 }); p.smoke(117, 28, 9, 1.3); p.fire(116, 31, 1); p.smoke(104, 31, 7, 1.1);
    } },
    refinery: { time: 'fire', draw: function (p) {
      p.sky(30).ridge(31, 6, p.t.far).ground(36);
      p.lattice(30, 36, 14, 26, '#3a2a2a'); p.rect(36, 11, 38, 36, '#2e2222');
      p.rect(60, 12, 61, 36, '#2a1e1e'); p.fire(60, 12, 1.4); p.smoke(61, 8, 8, 1.4, '#3a2220');
      [[78, 8], [92, 7], [104, 9]].forEach(function (t) { p.rect(t[0], 36 - t[1], t[0] + 9, 36, '#3a2c2a'); p.rect(t[0], 36 - t[1], t[0] + 9, 36 - t[1], '#5a4440'); p.rect(t[0] + 9, 36 - t[1], t[0] + 9, 36, '#241a18'); });
      p.rect(0, 33, 127, 33, '#4a3430'); p.rect(44, 30, 60, 30, '#4a3430');
      p.building(4, 14, 8, 36, '#2e2222', { lit: 0.5 }); p.light(37, 10); p.light(61, 10, '#ffb04a');
    } },
    oreyards: { time: 'day', draw: function (p) {
      p.sky(28).ridge(28, 6, p.t.far).ground(35);
      [[16, 9, 14], [44, 7, 11], [96, 10, 16]].forEach(function (h) { for (var y = 0; y < h[1]; y++) p.rect(h[0] - h[2] + y * 1.4, 35 - y, h[0] + h[2] - y * 1.4, 35 - y, y % 3 ? '#6a5a48' : '#7a6852'); });
      p.building(60, 22, 10, 35, '#4c4a46', { lit: 0.1 }); p.rect(58, 24, 83, 24, '#3a3834');
      p.rect(112, 10, 113, 35, '#3a3a3e'); p.rect(100, 10, 124, 11, '#3a3a3e'); p.line(104, 11, 104, 22, '#222'); p.rect(102, 22, 106, 25, '#5a4a38');
      p.truck(28, 40, '#6a5a3a'); p.smoke(70, 22, 5, 0.6);
    } },
    pumping: { time: 'dawn', draw: function (p) {
      p.sky(28).giant(24, 9, 6).ridge(29, 9, p.t.far).ridge(33, 5, p.t.mid).ground(37);
      p.lattice(54, 37, 16, 24, '#2e2c34'); p.disc(62, 13, 3, '#2e2c34'); p.disc(62, 13, 1, '#5a5866');
      p.building(70, 16, 9, 37, '#3a3842', { lit: 0.3 }); p.rect(30, 34, 54, 35, '#4a4652'); p.rect(86, 33, 110, 34, '#4a4652');
      [[12, 6], [104, 5]].forEach(function (h) { for (var y = 0; y < h[1]; y++) p.rect(h[0] - 8 + y, 37 - y, h[0] + 8 - y, 37 - y, '#3a3640'); });
      p.light(62, 12, '#ffd27a'); p.people(36, 42, 3, '#141218', 3);
    } },
    pitnine: { time: 'night', draw: function (p) {
      p.sky(26).giant(108, 8, 7).ridge(27, 7, p.t.far).ground(38);
      for (var i = 0; i < 9; i++) { var x = 2 + i * 14 + Math.floor(p.r() * 3); p.building(x, 11, 5 + Math.floor(p.r() * 5), 38, i % 2 ? '#20222e' : '#262836', { roof: 'peak', lit: 0.45 }); }
      p.building(52, 20, 12, 38, '#2a2c3a', { lit: 0.55 }); p.rect(61, 22, 62, 25, '#e8d8a0'); p.put(61, 23, '#2a2c3a');
      p.lattice(100, 38, 12, 18, '#181a24'); p.smoke(30, 24, 7, 1.1); p.fire(28, 27, 0.8);
      p.rect(0, 41, 127, 42, '#22222a'); for (var k = 4; k < 128; k += 9) p.light(k, 40, '#ffcf6a');
    } },
    sump: { time: 'under', draw: function (p) {
      p.sky(48);
      for (var x = 0; x < W; x++) {
        var top = 6 + 4 * Math.sin(x / 7 + 1) + 2 * Math.sin(x / 2.3), bot = 38 + 3 * Math.sin(x / 9) + 1.5 * Math.sin(x / 3.1);
        for (var y = 0; y < top; y++) p.put(x, y, p.t.mid);
        for (var y2 = Math.floor(bot); y2 < H; y2++) p.put(x, y2, dith(x, y2, (y2 - bot) / 10) ? p.t.near : p.t.mid);
        if (x % 9 === 3) p.rect(x, top, x, top + 3 + (x % 5), p.t.mid);
      }
      for (var k = 0; k < 14; k++) { var ex = 50 + k * 5 + p.r() * 3, ey = 36 + p.r() * 3; p.glow(ex, ey, 5, '#5a2a7a', 0.5); p.disc(ex, ey, 1.8, '#8a4ab0'); p.put(ex - 0.5, ey - 1, '#e0b0ff'); }
      for (var i = 0; i < 30; i++) for (var j = -Math.floor(i / 3); j <= Math.floor(i / 3); j++) if (dith(6 + i, 28 + j, 0.5 - i / 70)) p.put(6 + i, 28 + j, '#c8c0a0');
      p.people(4, 33, 2, '#050407', 3); p.light(5, 28, '#fff2c0');
    } },
    ridges: { time: 'dusk', draw: function (p) {
      p.sky(26).giant(30, 10, 8).ridge(27, 10, p.t.far, 1.4).ridge(33, 8, p.t.mid, 1.2).ridge(39, 5, p.t.near, 0.8);
      p.people(70, 33, 6, '#0a0808', 3); p.rect(88, 26, 88, 32, '#0a0808'); p.rect(89, 26, 92, 27, '#c43a2a');
      p.smoke(110, 30, 7, 0.9); p.fire(110, 33, 0.7);
    } },
    hills: { time: 'dawn', draw: function (p) {
      p.sky(24).ridge(26, 10, p.t.far).ridge(31, 7, p.t.mid).ground(39);
      for (var i = 0; i < 26; i++) { var x = p.r() * W, g = 33 + p.r() * 8; p.tree(x, g, 6 + Math.floor(p.r() * 6), i % 2 ? '#1e3226' : '#243a2c'); }
      p.lattice(78, 34, 10, 14, '#2a2a34'); p.building(88, 8, 5, 34, '#34343e', { lit: 0.2 });
    } },
    redoubt: { time: 'night', draw: function (p) {
      p.sky(24).ridge(32, 3, p.t.far);
      for (var y = 0; y < 22; y++) { var w = 6 + y * 3.2; p.rect(64 - w, 18 + y, 64 + w, 18 + y, y < 2 ? '#2a2c3a' : p.t.mid); }
      p.rect(56, 15, 72, 19, '#30323e'); p.rect(60, 16, 68, 16, '#0a0a0e');
      for (var x = 34; x < 94; x += 2) p.put(x, 24 + Math.abs(x - 64) * 0.18, '#5a5c66');
      for (var i = 0; i < 40; i++) { p.put(58 - i * 0.9, 15 - i * 0.35, '#e8e0b0'); p.put(70 + i * 0.7, 15 - i * 0.4, '#e8e0b0'); }
      p.ground(42); p.people(20, 44, 4, '#08080a', 4);
    } },
    waystation: { time: 'day', draw: function (p) {
      p.sky(28).ridge(30, 5, p.t.far).ground(36);
      p.rect(0, 38, 127, 40, '#5a544a'); for (var x = 2; x < 128; x += 8) p.rect(x, 39, x + 3, 39, '#8a8478');
      p.building(50, 22, 10, 37, '#5a5048', { lit: 0 }); p.rect(56, 27, 64, 31, '#2a2420'); p.rect(68, 27, 71, 30, '#2a2420');
      for (var k = 0; k < 7; k++) p.put(52 + k * 3, 27 - (k % 3), p.t.sky[1]);
      p.rect(80, 25, 80, 37, '#2a2420'); p.rect(81, 25, 85, 27, '#f0eee6'); p.people(40, 37, 2, '#2a2420', 3); p.people(88, 37, 2, '#2a2420', 3);
    } },
    pass: { time: 'dusk', draw: function (p) {
      p.sky(34).giant(64, 10, 7).ridge(30, 6, p.t.far).ground(36);
      for (var y = 0; y < H; y++) {
        var l = 30 + 6 * Math.sin(y / 6) + y * 0.45, r = 98 - 5 * Math.sin(y / 5 + 1) - y * 0.45;
        for (var x = 0; x < W; x++) {
          if (x > l && x < r) continue;
          var edge = x <= l ? l - x : x - r;
          p.put(x, y, dith(x, y, Math.min(1, edge / 14)) ? p.t.near : (edge < 2 ? shade(p.t.mid, 0.25) : p.t.mid));
        }
      }
      p.glow(64, 47, 14, '#5a2a7a', 0.45);
      p.people(50, 41, 9, '#e0b07a', 3); p.people(51, 41, 9, '#0c0a0c', 3);
    } },
    uplink: { time: 'night', draw: function (p) {
      p.sky(28).ridge(30, 5, p.t.far).ground(36);
      p.dish(40, 36, 9, '#6a6e7a'); p.dish(74, 36, 6, '#5a5e6a');
      p.rect(100, 6, 101, 36, '#3a3c48'); p.line(100, 6, 92, 36, '#3a3c48'); p.line(101, 6, 109, 36, '#3a3c48'); p.light(100, 5);
      p.building(54, 12, 7, 36, '#2a2c38', { lit: 0.6 }); p.fence(0, 127, 41, '#2a2a34'); p.people(20, 44, 2, '#060608', 3);
    } },
    haulroad: { time: 'dusk', draw: function (p) {
      p.sky(28).giant(110, 9, 7).ridge(29, 7, p.t.far).ground(35);
      for (var y = 36; y < H; y++) { var w = (y - 35) * 4; p.rect(64 - w, y, 64 + w, y, '#3a3434'); if (y % 3 === 0) p.put(64, y, '#c8b060'); }
      [[14, 7, 12], [104, 9, 16]].forEach(function (h) { for (var y = 0; y < h[1]; y++) p.rect(h[0] - h[2] + y * 1.3, 35 - y, h[0] + h[2] - y * 1.3, 35 - y, '#3a2e30'); });
      p.truck(40, 38, '#4a4440', true); p.truck(26, 37, '#4a4440', true); p.smoke(92, 30, 5, 0.8);
    } },
    htxyard: { time: 'night', draw: function (p) {
      p.sky(26).giant(18, 9, 6).ground(38);
      p.building(36, 56, 26, 38, '#262a36', { lit: 0.5 }); p.rect(56, 14, 71, 18, '#6fc4e2'); p.rect(58, 15, 59, 17, '#16222f'); p.rect(62, 15, 63, 17, '#16222f'); p.rect(60, 16, 61, 16, '#16222f'); p.rect(66, 15, 69, 17, '#16222f');
      p.building(4, 22, 14, 38, '#1e2230'); p.building(100, 24, 12, 38, '#1e2230');
      for (var i = 0; i < 30; i++) { p.put(30 + i * 0.6, 38 - i, '#e8e6c8'); p.put(98 - i * 0.6, 38 - i, '#e8e6c8'); }
      p.rect(28, 40, 100, 40, '#3a3c48'); p.people(54, 44, 5, '#0a0a0c', 4);
    } },
    slagfields: { time: 'fire', draw: function (p) {
      p.sky(30).ridge(31, 6, p.t.far).ground(35);
      for (var i = 0; i < 7; i++) p.crack(p.r() * 110, 37 + p.r() * 9, 10 + p.r() * 14, '#ff7a2a');
      p.beam(30, 33); p.beam(96, 30);
      p.shuttle(58, 34, false); p.people(52, 42, 5, '#0a0606', 2); p.smoke(30, 30, 6, 1.6, '#3a2420');
    } }
  };

  // a scene's grid, drawn
  function pixels(scene, time) {
    var s = SCENES[scene];
    if (!s) return null;
    var p = new Pic(time || s.time, scene + ':' + (time || s.time));
    s.draw(p);
    return p.g;
  }
  function svg(scene, time) {
    var g = pixels(scene, time);
    if (!g) return '';
    var h = '';
    for (var y = 0; y < H; y++) for (var x = 0; x < W;) {
      var c = g[y][x], x1 = x;
      while (x1 + 1 < W && g[y][x1 + 1] === c) x1++;
      h += '<rect x="' + x + '" y="' + y + '" width="' + (x1 - x + 1) + '" height="1" fill="' + c + '"/>';
      x = x1 + 1;
    }
    return '<svg class="story-scene" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + h + '</svg>';
  }
  // in a browser: the scene drawn once on a canvas and kept as a picture
  var made = {};
  function src(scene, time) {
    var key = scene + ':' + (time || '');
    if (made[key] !== undefined) return made[key];
    var g = pixels(scene, time), doc = root.document;
    if (!g || !doc || !doc.createElement) return (made[key] = null);
    var cv = doc.createElement('canvas');
    cv.width = W; cv.height = H;
    var cx = cv.getContext && cv.getContext('2d');
    if (!cx) return (made[key] = null);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { cx.fillStyle = g[y][x]; cx.fillRect(x, y, 1, 1); }
    try { made[key] = cv.toDataURL('image/png'); } catch (e) { made[key] = null; }
    return made[key];
  }
  // the scene as the page shows it: a picture where there can be one, else its SVG
  function html(scene, time, alt) {
    if (!SCENES[scene]) return '';
    var s = src(scene, time);
    return '<div class="story-scene-wrap">' + (s ? '<img class="story-scene" src="' + s + '" alt="' + (alt || '') + '" width="' + W + '" height="' + H + '">' : svg(scene, time)) + '</div>';
  }

  root.PMCStoryScenes = { SCENES: SCENES, TIMES: TIMES, W: W, H: H, pixels: pixels, svg: svg, html: html };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryScenes;
})(typeof window !== 'undefined' ? window : global);
