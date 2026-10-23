/* PMC 2670 — Firefight : the story's people as pixel-art faces (docs/story-mode-plan.md, phase 7)

   A story names who an event is about (`who` on the node, a key of the story's
   `people`), and each person carries a `face`: skin, hair, what they wear on
   their head and their back, and a few details. The face is drawn here, a head
   and shoulders on a 32 x 32 grid of flat colours with a bold black edge traced
   round the figure, and handed back as an SVG of square pixels: nothing to load,
   crisp at any size. The hive has a face of its own.

   face: { bg, skin, hair, hairStyle: short|long|bun|bald, hat: helmet|cap|beanie|
   hardhat|visor, hatColour, clothes, clothesStyle: jacket|suit|uniform|overalls|
   armour|cardigan, accent, extras: [glasses, beard, moustache, stubble, scar,
   bandana, earring], bandana, lips, eyes }, or { bug: true, bg, shell, glow }. */
(function (root) {
  'use strict';

  var N = 32, INK = '#0d0c10';

  // a colour made darker or lighter, by a share (-1..1)
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  function grid(bg) {
    var g = [];
    for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) g[y].push(bg); }
    return g;
  }
  function put(g, x, y, c) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; }
  function rect(g, x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) put(g, x, y, c); }
  function inEllipse(x, y, cx, cy, rx, ry) { var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; }
  function ellipse(g, cx, cy, rx, ry, c, test) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (inEllipse(x, y, cx, cy, rx, ry) && (!test || test(x, y))) put(g, x, y, c);
  }

  // the head: where it is, so hair, hats and beards can keep to it
  function onHead(x, y) { return inEllipse(x, y, 16, 15, 7, 8.5); }

  function person(f) {
    var g = grid(f.bg), skin = f.skin, dark = shade(skin, -0.22), hair = f.hair || '#2a2420', ex = f.extras || [];
    var has = function (k) { return ex.indexOf(k) >= 0; };
    var cloth = f.clothes || '#4a4f5a', clothDark = shade(cloth, -0.3), accent = f.accent || shade(cloth, 0.35);
    // long hair falls behind the shoulders
    if (f.hairStyle === 'long') rect(g, 8, 10, 23, 25, hair);
    // the shoulders and the body, widening to the bottom of the frame
    for (var y = 24; y < N; y++) {
      var w = Math.min(15, 6 + Math.round((y - 24) * 1.7));
      rect(g, 16 - w, y, 15 + w, y, cloth);
      put(g, 15 + w, y, clothDark); put(g, 14 + w, y, clothDark);
    }
    // the neck, and its shadow under the chin
    rect(g, 13, 21, 18, 25, skin); rect(g, 13, 22, 18, 22, dark);
    // what is worn
    var cs = f.clothesStyle || 'jacket';
    if (cs === 'suit') { rect(g, 14, 25, 17, 26, '#e9e6df'); rect(g, 15, 26, 16, 31, accent); put(g, 13, 25, clothDark); put(g, 18, 25, clothDark); }
    else if (cs === 'uniform') { rect(g, 13, 24, 18, 25, clothDark); put(g, 16, 27, accent); put(g, 16, 29, accent); rect(g, 6, 26, 8, 26, accent); rect(g, 23, 26, 25, 26, accent); }
    else if (cs === 'overalls') { rect(g, 11, 25, 12, 31, accent); rect(g, 19, 25, 20, 31, accent); rect(g, 11, 29, 20, 31, accent); }
    else if (cs === 'armour') { rect(g, 4, 26, 27, 27, shade(cloth, 0.15)); rect(g, 6, 29, 25, 29, accent); rect(g, 12, 24, 19, 25, clothDark); }
    else if (cs === 'cardigan') { rect(g, 14, 25, 17, 31, shade(cloth, 0.45)); put(g, 13, 27, accent); put(g, 13, 29, accent); }
    else { rect(g, 13, 24, 13, 31, clothDark); rect(g, 18, 24, 18, 31, clothDark); rect(g, 14, 25, 17, 26, accent); }
    // the head, its far side in shadow, and the ears
    ellipse(g, 16, 15, 7, 8.5, skin);
    for (var hy = 0; hy < N; hy++) for (var hx = 20; hx < N; hx++) if (onHead(hx, hy) && !onHead(hx + 1, hy)) put(g, hx, hy, dark);
    rect(g, 8, 14, 8, 17, skin); rect(g, 23, 14, 23, 17, dark);
    if (has('earring')) put(g, 8, 18, '#e8c25a');
    // the face: brows, eyes, nose, mouth
    var brow = has('visor') ? null : shade(hair, -0.1);
    rect(g, 10, 12, 13, 12, brow || hair); rect(g, 18, 12, 21, 12, brow || hair);
    var iris = f.eyes || '#3b2a20';
    rect(g, 11, 14, 13, 14, '#f4f1ea'); put(g, 12, 14, iris); put(g, 13, 14, INK);
    rect(g, 18, 14, 20, 14, '#f4f1ea'); put(g, 19, 14, iris); put(g, 18, 14, INK);
    rect(g, 11, 15, 13, 15, dark); rect(g, 18, 15, 20, 15, dark);
    put(g, 16, 15, dark); put(g, 16, 16, dark); put(g, 15, 17, dark); put(g, 16, 17, shade(skin, -0.35));
    var lips = f.lips || shade(skin, -0.32);
    rect(g, 14, 19, 17, 19, lips); rect(g, 15, 20, 16, 20, shade(lips, 0.2));
    // the details
    if (has('scar')) { put(g, 19, 16, '#a8444a'); put(g, 20, 17, '#a8444a'); put(g, 20, 18, '#a8444a'); put(g, 21, 19, '#a8444a'); }
    if (has('stubble')) for (var sy = 18; sy <= 23; sy++) for (var sx = 9; sx <= 22; sx++) if (onHead(sx, sy) && (sx + sy) % 2 === 0 && !(sy === 19 && sx >= 14 && sx <= 17)) put(g, sx, sy, shade(skin, -0.3));
    if (has('beard')) for (var by = 18; by <= 24; by++) for (var bx = 8; bx <= 23; bx++) if (onHead(bx, by) && !(by >= 19 && by <= 20 && bx >= 14 && bx <= 17)) put(g, bx, by, hair);
    if (has('moustache') || has('beard')) rect(g, 13, 18, 18, 18, hair);
    if (has('bandana')) {
      var bc = f.bandana || '#b03a2e';
      for (var ny = 17; ny <= 24; ny++) for (var nx = 7; nx <= 24; nx++) if (onHead(nx, ny) || (ny >= 21 && nx >= 12 && nx <= 19)) put(g, nx, ny, (nx + ny) % 5 === 0 ? shade(bc, -0.25) : bc);
      rect(g, 8, 17, 23, 17, shade(bc, -0.3));
    }
    if (has('glasses')) {
      var fr = '#20201f';
      [[10, 13], [17, 21]].forEach(function (s) { rect(g, s[0], 13, s[1] === 13 ? 14 : 21, 13, fr); rect(g, s[0], 16, s[1] === 13 ? 14 : 21, 16, fr); put(g, s[0], 14, fr); put(g, s[0], 15, fr); put(g, s[1] === 13 ? 14 : 21, 14, fr); put(g, s[1] === 13 ? 14 : 21, 15, fr); });
      rect(g, 15, 14, 16, 14, fr);
    }
    // the hair, over the head and round it
    var hs = f.hairStyle || 'short';
    if (hs !== 'bald') {
      for (var ty = 0; ty < N; ty++) for (var tx = 0; tx < N; tx++) {
        var top = onHead(tx, ty) && ty <= 9, side = onHead(tx, ty) && ty <= 13 && (tx <= 9 || tx >= 22);
        var rim = ty >= 5 && ty <= 9 && inEllipse(tx, ty, 16, 13, 8.2, 8.5) && !onHead(tx, ty);
        if (top || side || rim) put(g, tx, ty, (tx * 3 + ty) % 7 === 0 ? shade(hair, 0.25) : hair);
      }
      if (hs === 'long') { rect(g, 7, 12, 9, 24, hair); rect(g, 22, 12, 24, 24, hair); }
      if (hs === 'bun') { ellipse(g, 16, 4.5, 3.6, 3, hair); put(g, 15, 3, shade(hair, 0.3)); put(g, 16, 3, shade(hair, 0.3)); }
    }
    // the headwear
    var hc = f.hatColour || '#5a5a5a', hd = shade(hc, -0.3), hl = shade(hc, 0.3);
    if (f.hat === 'helmet' || f.hat === 'hardhat') {
      ellipse(g, 16, 10, 9, 6, hc, function (x, y) { return y <= 10; });
      rect(g, 6, 10, 25, 11, hd);
      for (var ry2 = 4; ry2 <= 9; ry2++) put(g, 12, ry2, hl);
      if (f.hat === 'helmet') { rect(g, 14, 5, 18, 8, '#3a3328'); rect(g, 15, 6, 17, 7, '#ffe27a'); put(g, 16, 6, '#ffffff'); }
      else rect(g, 15, 4, 16, 9, hl);
    } else if (f.hat === 'cap') {
      ellipse(g, 16, 9, 8.2, 4.5, hc, function (x, y) { return y <= 9; });
      rect(g, 8, 9, 23, 10, hd); rect(g, 9, 11, 22, 11, INK);
      rect(g, 15, 6, 16, 7, f.accent || '#e8c25a');
    } else if (f.hat === 'beanie') {
      ellipse(g, 16, 9.5, 8.5, 5.5, hc, function (x, y) { return y <= 10; });
      rect(g, 7, 9, 24, 10, hd);
      for (var bx2 = 9; bx2 <= 22; bx2 += 2) put(g, bx2, 6, hl);
    } else if (f.hat === 'visor') {
      ellipse(g, 16, 13, 9, 10, hc, function (x, y) { return y <= 18; });
      rect(g, 9, 12, 22, 15, '#16222f'); rect(g, 10, 12, 14, 12, '#5f8fb0'); put(g, 11, 13, '#9cc4dc');
      rect(g, 7, 16, 8, 18, hd); rect(g, 23, 16, 24, 18, hd);
      rect(g, 15, 5, 16, 10, hl);
    }
    return g;
  }

  // the hive: a carapace, its eyes in a cluster, and its mandibles
  function bug(f) {
    var g = grid(f.bg), shell = f.shell || '#5a3d6e', dark = shade(shell, -0.35), lite = shade(shell, 0.3), glow = f.glow || '#e46cff';
    for (var y = 22; y < N; y++) { var w = Math.min(14, 7 + (y - 22)); rect(g, 16 - w, y, 15 + w, y, dark); }
    ellipse(g, 16, 14, 10, 9.5, shell);
    for (var yy = 4; yy <= 22; yy += 3) rect(g, 10, yy, 21, yy, (yy % 2) ? dark : shade(shell, -0.15));
    ellipse(g, 16, 8, 6, 3, lite);
    [[11, 12], [20, 12], [9, 15], [22, 15], [13, 16], [18, 16]].forEach(function (p, i) {
      rect(g, p[0], p[1], p[0] + 1, p[1] + (i < 2 ? 1 : 0), glow); put(g, p[0], p[1], '#ffffff');
    });
    [[10, 22], [11, 23], [12, 24], [13, 25], [13, 26]].forEach(function (p) { put(g, p[0], p[1], '#e8dcc0'); put(g, 31 - p[0], p[1], '#e8dcc0'); });
    rect(g, 14, 22, 17, 23, INK);
    return g;
  }

  // the bold black edge: every background pixel that touches the figure
  function outline(g, bg) {
    var out = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (g[y][x] !== bg) continue;
      var touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] !== bg; });
      if (touch) out[y][x] = INK;
    }
    return out;
  }

  function pixels(f) {
    f = f || {};
    var bg = f.bg || '#3a4250';
    return outline(f.bug ? bug(Object.assign({}, f, { bg: bg })) : person(Object.assign({ skin: '#d6a27c' }, f, { bg: bg })), bg);
  }

  // the face as an SVG of square pixels, a run of one colour a rectangle
  function svg(f, size) {
    var g = pixels(f), s = size || 48, h = '';
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N;) {
        var c = g[y][x], x1 = x;
        while (x1 + 1 < N && g[y][x1 + 1] === c) x1++;
        h += '<rect x="' + x + '" y="' + y + '" width="' + (x1 - x + 1) + '" height="1" fill="' + c + '"/>';
        x = x1 + 1;
      }
    }
    return '<svg class="story-portrait" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">' + h + '</svg>';
  }

  root.PMCStoryPortraits = { pixels: pixels, svg: svg, SIZE: N };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryPortraits;
})(typeof window !== 'undefined' ? window : global);
