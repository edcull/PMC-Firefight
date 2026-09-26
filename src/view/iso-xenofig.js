/* PMC 2670 — Firefight : the Xenotripods' figures: Crocks and Esh-Aven, drawn side-on

   Made once by iso-aliens.js, the first time it is wanted, with E: the names
   of iso-aliens.js this needs, bound here once. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCIsoXenoFig = function (E) {
    var B = E.B, PH = E.PH, SHIELD_PHASES = E.SHIELD_PHASES, XASH = E.XASH, XFLESH = E.XFLESH,
        XGOLD = E.XGOLD, XW = E.XW, hexMix = E.hexMix, vividHex = E.vividHex;
      // the army's colour as a Xenotripod burns it: the ink, pushed brighter
      function xenoGlow(pal) { return vividHex(pal.ink || pal.light, 1.45, 1.12); }
      function hexA(hex, al) {
        var r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + gg + ',' + b + ',' + al + ')';
      }
      function paintXeno(g, ox, oy, pal, kit, pose, step, s, dead) {
        var W0 = dead ? { lt: '#8c887c', md: '#77736a', dk: '#5a574f', sh: '#403e39', seam: '#2c2a26' } : XW;
        var gc0 = xenoGlow(pal);
        var GL = dead ? { m: '#4c4a44', l: '#5e5b54', h: 'rgba(0,0,0,0)' }
          : { m: gc0, l: hexMix(gc0, '#ffffff', 0.55), h: hexA(gc0, 0.28), d: hexMix(gc0, pal.dark, 0.35) };
        var TR = kit.gold && !dead ? XGOLD : { lt: W0.lt, md: W0.md, dk: W0.dk };
        var prone = pose === 'prone', kneel = pose === 'kneel';
        function X(x) { return ox + x * s; }
        function Y(y) { return oy + y * s; }
        function E(cx, cy, rx, ry, c, rot) {
          g.fillStyle = c; g.beginPath();
          g.ellipse(X(cx), Y(cy), Math.max(0.5, rx * s), Math.max(0.5, ry * s), rot || 0, 0, Math.PI * 2);
          g.fill();
        }
        function L(pts, w, c) {
          g.strokeStyle = c; g.lineWidth = Math.max(1, w * s); g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath();
          pts.forEach(function (q, i) { if (i) g.lineTo(X(q[0]), Y(q[1])); else g.moveTo(X(q[0]), Y(q[1])); });
          g.stroke();
        }
        function Q(pts, w, c) {                          // a smooth curve through the points
          g.strokeStyle = c; g.lineWidth = Math.max(1, w * s); g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1]));
          for (var i = 1; i < pts.length - 1; i++) {
            var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
            g.quadraticCurveTo(X(pts[i][0]), Y(pts[i][1]), X(mx), Y(my));
          }
          var z = pts[pts.length - 1]; g.lineTo(X(z[0]), Y(z[1]));
          g.stroke();
        }
        function F(pts, c) {
          g.fillStyle = c; g.beginPath();
          pts.forEach(function (q, i) { if (i) g.lineTo(X(q[0]), Y(q[1])); else g.moveTo(X(q[0]), Y(q[1])); });
          g.closePath(); g.fill();
        }
        // a ceramic plate: shadow side, body, lit crown, glint
        function plate(cx, cy, rx, ry, rot, T) {
          T = T || W0;
          E(cx + rx * 0.06, cy + ry * 0.08, rx, ry, T.sh || T.dk, rot);
          E(cx, cy, rx * 0.97, ry * 0.95, T.dk, rot);
          E(cx - rx * 0.06, cy - ry * 0.1, rx * 0.86, ry * 0.8, T.md, rot);
          E(cx - rx * 0.22, cy - ry * 0.34, rx * 0.5, ry * 0.36, T.lt, rot);
        }
        function glow(cx, cy, r) {
          if (dead) { E(cx, cy, r, r, GL.m); return; }
          E(cx, cy, r * 2.2, r * 2.2, GL.h);
          E(cx, cy, r, r, GL.m);
          E(cx - r * 0.25, cy - r * 0.25, r * 0.45, r * 0.45, GL.l);
        }
        function seam(pts, w) { L(pts, w || 0.9, dead ? W0.seam : GL.m); }

        var bob = step ? -1 : 0;
        g.save();
        if (prone) {                                      // lying where it fell, head to the right
          g.translate(X(0), Y(-3)); g.rotate(1.42); g.translate(-X(0), -Y(-3));
        }

        if (kit.xeno === 'esh') {
          /* ---- an Esh-Aven: digitigrade lizard legs, a gargoyle hunch, arms that
             split at the elbow into two forearms each, five compound eyes ---- */
          var SK = dead ? { lt: '#6a6a66', md: '#565653', dk: '#3c3c3a', sh: '#2a2a2a' } : XASH;
          var lo = kneel ? B.XENO_LOW : 0;                   // hunkered down, belly to the ground
          var st = step ? 1 : 0;
          // the far leg
          var fl = st ? [[-2, -22 + lo], [-8, -13 + lo * 0.6], [-4, -5], [-7, 0]] : [[-2, -22 + lo], [4, -13 + lo * 0.6], [-1, -5], [2, 0]];
          if (kneel) fl = [[-2, -22 + lo], [-8, -7], [-5, -2], [-9, 0]];
          L(fl, 3.6, SK.sh); L([[fl[3][0] - 2, 0], [fl[3][0] + 4, 0]], 1.8, SK.sh);
          // the tail
          Q([[-6, -22 + lo], [-15, -16 + lo], [-20, -7], [-26, -4]], 3.2, SK.dk);
          // the body: hunched forward, chest high
          E(-1, -27 + lo + bob, 7.5, 9, SK.dk, -0.5);
          E(-1.6, -28 + lo + bob, 6.6, 8, SK.md, -0.5);
          E(-3, -31 + lo + bob, 3.5, 4.5, SK.lt, -0.5);
          // spines down the back
          for (var sp2 = 0; sp2 < 4; sp2++) F([[-7 + sp2 * 1.8, -24 - sp2 * 3.5 + lo], [-10.5 + sp2 * 1.6, -26 - sp2 * 3.8 + lo], [-6 + sp2 * 1.8, -27 - sp2 * 3.5 + lo]], SK.dk);
          if (kit.plates) {                              // a white chest plate and a collar
            plate(3, -30 + lo + bob, 4.4, 6, -0.4);
            seam([[1.5, -35 + lo + bob], [5.5, -26 + lo + bob]], 0.7);
          }
          // shoulder: the army's colour
          E(-1, -35 + lo + bob, 4, 3, dead ? '#44423e' : pal.dark, -0.3);
          E(-1.3, -35.6 + lo + bob, 3.4, 2.4, dead ? '#55524c' : pal.mid, -0.3);
          E(-2, -36.3 + lo + bob, 1.8, 1.1, dead ? '#5c5953' : pal.light, -0.3);
          // the head: low and forward, a crest, five eyes
          var hx = 7, hy = -39 + lo + bob;
          E(hx - 1, hy + 1, 4.8, 4, SK.dk);
          E(hx - 1.3, hy + 0.3, 4.3, 3.5, SK.md);
          F([[hx - 5, hy - 1], [hx - 10, hy - 6], [hx - 2, hy - 3]], SK.dk);            // the crest horn
          F([[hx + 2.5, hy + 1], [hx + 7.5, hy + 2.6], [hx + 2.4, hy + 3.6]], SK.dk);    // the snout
          if (kit.plates) { E(hx - 1.2, hy - 1.6, 3.8, 2.1, W0.md); E(hx - 2, hy - 2.2, 2.2, 1, W0.lt); }
          var eyeC = dead ? '#444' : '#e9f07a';
          [[hx + 2.2, hy - 0.4], [hx + 3.4, hy + 0.6], [hx + 1.4, hy + 0.9], [hx - 0.8, hy + 0.2], [hx + 3.3, hy - 1.2]].forEach(function (q, i) {
            E(q[0], q[1], i === 3 ? 0.8 : 0.65, i === 3 ? 0.8 : 0.6, eyeC);
          });
          // the near leg
          var nl = st ? [[0, -21 + lo], [7, -13 + lo * 0.6], [2, -5], [6, 0]] : [[0, -21 + lo], [-5, -13 + lo * 0.6], [-1, -5], [-3, 0]];
          if (kneel) nl = [[0, -21 + lo], [9, -6], [5, -2], [9, 0]];
          L(nl, 4, SK.dk); L(nl, 2.6, SK.md);
          L([[nl[3][0] - 2, 0], [nl[3][0] + 4.5, 0]], 2, SK.dk);                       // the clawed foot
          E(nl[1][0], nl[1][1], 2.4, 2.2, SK.dk);
          /* The arms: each upper arm drops from the shoulder to an elbow, then
             splits into two forearms. The weapon is held up at the shoulder, clear
             of the body, gripped by the near pair of claws at the grip and the
             foregrip; the far pair reaches round from behind it. */
          var sx = 1, sy = -34 + lo + bob;
          var wpn = kit.gun || 'blade';
          var gy = sy - 1;                                 // the weapon's line, at the shoulder
          var grip = [10, gy + 1.2], fore = [18, gy - 0.4];
          function claw(x, y, c) {                         // three hooked fingers closed on something
            E(x, y, 1.3, 1.1, c);
            L([[x, y], [x + 1.4, y + 1.6]], 0.6, c);
            L([[x - 0.6, y + 0.2], [x - 0.2, y + 1.9]], 0.6, c);
          }
          // the far arm, behind the weapon
          var farEl = [sx + 2, sy + 7];
          L([[sx - 1, sy], farEl], 2.4, SK.sh);
          if (wpn === 'blade') {
            L([farEl, [farEl[0] + 8, farEl[1] - 5]], 1.6, SK.sh);
            L([farEl, [farEl[0] + 7, farEl[1] + 1]], 1.6, SK.sh);
          } else {
            L([farEl, [grip[0] + 1, grip[1] + 1.5]], 1.6, SK.sh);
            L([farEl, [fore[0] - 1, fore[1] + 1.5]], 1.6, SK.sh);
          }
          if (wpn === 'spear') {                           // held across the body, point up and forward
            L([[-4, gy + 11], [27, gy - 9]], 1.4, dead ? '#3a3027' : '#5a4632');
            F([[26, gy - 8.6], [33, gy - 12.4], [28.2, gy - 6.6]], dead ? '#555' : '#c9c6bc');
            grip = [7, gy + 4.6]; fore = [16, gy - 1.2];
          } else if (wpn === 'slug') {                     // a crude slug-thrower, stock to the shoulder
            L([[3, gy + 1], [26, gy - 0.6]], 2.6, dead ? '#2a2a2a' : '#34332f');
            L([[3, gy + 1.2], [0, gy + 3]], 2.6, '#4a3a2c');               // the stock
            L([[11, gy + 1.6], [11.5, gy + 5]], 1.8, '#34332f');           // the grip
            E(17, gy + 0.6, 2.4, 1.3, '#6a5a3c');                           // the drum
            L([[24, gy - 0.4], [27, gy - 0.6]], 1.4, '#1e1d1b');
          } else if (wpn === 'gauss' || wpn === 'gaussflame') {
            L([[2, gy + 1.4], [29, gy - 0.8]], 3.2, W0.dk);
            L([[2, gy + 0.8], [29, gy - 1.4]], 2, W0.md);
            L([[2, gy + 1.2], [-1, gy + 3.4]], 2.4, W0.dk);                 // the stock
            L([[11, gy + 1.8], [11.5, gy + 5.2]], 1.8, W0.dk);             // the grip
            for (var gc = 0; gc < 3; gc++) E(15 + gc * 4, gy - 0.2 - gc * 0.4, 1.2, 1.4, dead ? '#555' : GL.m);
            if (wpn === 'gaussflame') { E(21, gy + 3.4, 2.6, 1.8, dead ? '#443' : '#b8542a'); E(20.4, gy + 2.8, 1, 0.8, '#e88a50'); }
          }
          // the near arm: to the elbow, then a forearm to each hand
          var nearEl = [sx + 3, sy + 8];
          L([[sx, sy], nearEl], 2.8, SK.dk); L([[sx, sy], nearEl], 1.8, SK.md);
          if (wpn === 'blade') {
            var h1 = [nearEl[0] + 8, nearEl[1] - 6], h2 = [nearEl[0] + 8, nearEl[1] + 1];
            L([nearEl, h1], 1.9, SK.md); L([nearEl, h2], 1.9, SK.md);
            claw(h1[0], h1[1], SK.dk); claw(h2[0], h2[1], SK.dk);
            F([[h1[0], h1[1] - 1], [h1[0] + 10, h1[1] - 9], [h1[0] + 1.6, h1[1] + 0.6]], dead ? '#555' : '#d7d3c7');
            F([[h2[0] + 0.5, h2[1] - 0.8], [h2[0] + 11, h2[1] - 3], [h2[0] + 1, h2[1] + 1.2]], dead ? '#555' : '#bdb9ad');
          } else {
            L([nearEl, grip], 1.9, SK.md); L([nearEl, fore], 1.9, SK.md);
            claw(grip[0], grip[1], SK.dk); claw(fore[0], fore[1], SK.dk);
          }
          E(nearEl[0], nearEl[1], 1.7, 1.5, SK.dk);
        } else {
          /* ---- a Crock: three legs on high spiked knees, a faceted ceramic
             carapace like a cut crystal, a wedge of a helmet with a slit of eyes,
             and three armoured arms. Every plane is lit by which way it faces. ---- */
          var lo2 = kneel ? B.XENO_LOW : 0, rank = kit.rank || 'beta';   // hunkered: the body let down to the ground
          var bx = rank === 'beta' ? 0.92 : rank === 'gamma' ? 0.84 : 0.78;   // squat, but still cut in long planes
          var hipY = -16 + lo2, by = -28 + lo2 + bob, hy = by - 14;
          // hunched forward to strike: the upper body leans over the front leg
          function lean(p) { return [p[0] + Math.max(0, by - p[1]) * 0.32, p[1]]; }
          var HX = 5;                                      // the head, thrust forward
          var LIGHT = [-0.55, -0.83];
          function tone(nx, ny, T) {
            var d = nx * LIGHT[0] + ny * LIGHT[1];
            return d > 0.45 ? T.lt : d > -0.05 ? T.md : d > -0.55 ? T.dk : (T.sh || T.dk);
          }
          // a faceted plate: a fan of triangles from its middle, each shaded by its edge
          function facet(pts, T, noEdge) {
            var cx = 0, cy = 0, ar = 0;
            pts.forEach(function (q) { cx += q[0]; cy += q[1]; });
            cx /= pts.length; cy /= pts.length;
            for (var i = 0; i < pts.length; i++) { var p0 = pts[i], p1 = pts[(i + 1) % pts.length]; ar += p0[0] * p1[1] - p1[0] * p0[1]; }
            var sg = ar > 0 ? 1 : -1;
            for (var j = 0; j < pts.length; j++) {
              var a0 = pts[j], a1 = pts[(j + 1) % pts.length];
              var ex = a1[0] - a0[0], ey = a1[1] - a0[1], el = Math.hypot(ex, ey) || 1;
              var nx = sg * ey / el, ny = -sg * ex / el;
              F([[cx, cy], a0, a1], tone(nx, ny, T));
            }
            if (!noEdge) {
              g.strokeStyle = W0.seam; g.lineWidth = Math.max(1, 0.5 * s); g.lineJoin = 'miter';
              g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(X(q[0]), Y(q[1])); else g.moveTo(X(q[0]), Y(q[1])); });
              g.closePath(); g.stroke();
            }
          }
          // a spike: a two-faced blade from a base point to a tip
          function spike(x0, y0, tx, ty, w, T, clean) {
            var dx = tx - x0, dy = ty - y0, l = Math.hypot(dx, dy) || 1, px = -dy / l * w / 2, py = dx / l * w / 2;
            F([[x0 + px, y0 + py], [tx, ty], [x0, y0]], T.lt);
            F([[x0 - px, y0 - py], [tx, ty], [x0, y0]], clean ? T.md : T.dk);
            if (!clean) L([[x0 + px, y0 + py], [tx, ty], [x0 - px, y0 - py]], 0.4, W0.seam);
          }
          // a limb: a tapered armour plate from one joint to the next
          function limb(x0, y0, x1, y1, w0, w1, T) {
            var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
            var q = [[x0 + nx * w0 / 2, y0 + ny * w0 / 2], [x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2], [x0 - nx * w0 / 2, y0 - ny * w0 / 2]];
            facet(q, T);
          }
          /* A mechanical tentacle: a chain of short armoured segments following a
             curve, each joint ringed, every other one lit, tapering to a pair of
             grip-claws. */
          function arm(pts, w0, w1, T, claw) {
            var path = [pts[0]];
            for (var i = 1; i < pts.length; i++) {
              var p0 = pts[i - 1], p1 = pts[i];
              if (i < pts.length - 1) {                     // round each bend with a midpoint
                var p2 = pts[i + 1];
                path.push([(p0[0] + p1[0] * 2) / 3, (p0[1] + p1[1] * 2) / 3]);
                path.push([(p1[0] * 2 + p2[0]) / 3, (p1[1] * 2 + p2[1]) / 3]);
              } else path.push(p1);
            }
            var n = path.length - 1;
            for (var j = 0; j < n; j++) {
              var wa = w0 + (w1 - w0) * j / n, wb = w0 + (w1 - w0) * (j + 1) / n;
              limb(path[j][0], path[j][1], path[j + 1][0], path[j + 1][1], wa, wb * 0.92, T);
              if (j) {
                E(path[j][0], path[j][1], wa * 0.5, wa * 0.5, W0.seam);
                if (j % 2 && !dead) E(path[j][0], path[j][1], wa * 0.24, wa * 0.24, T === FAR ? (GL.d || GL.m) : GL.m);
              }
            }
            var end = path[n], pre = path[n - 1];
            if (claw) {
              var dx = end[0] - pre[0], dy = end[1] - pre[1], l = Math.hypot(dx, dy) || 1;
              dx /= l; dy /= l;
              spike(end[0], end[1], end[0] + dx * 2.4 - dy * 1.2, end[1] + dy * 2.4 + dx * 1.2, 0.8, T, true);
              spike(end[0], end[1], end[0] + dx * 2.4 + dy * 1.2, end[1] + dy * 2.4 - dx * 1.2, 0.8, T, true);
            } else E(end[0], end[1], w1 * 0.7, w1 * 0.6, W0.seam);
          }
          function gem(x, y, r) {
            if (!dead) E(x, y, r * 2.2, r * 2.2, GL.h);
            F([[x, y - r * 1.4], [x + r, y], [x, y + r * 1.4], [x - r, y]], dead ? '#4c4a44' : GL.m);
            F([[x, y - r * 1.4], [x + r, y], [x, y]], dead ? '#5e5b54' : GL.l);
          }
          var FAR = { lt: W0.md, md: W0.dk, dk: W0.sh, sh: W0.seam };
          var LEGT = { lt: W0.lt, md: W0.md, dk: W0.md, sh: W0.dk };
          function leg(hx0, hy0, kx, ky, fx, far) {
            var T = far ? FAR : LEGT;
            limb(hx0, hy0, kx, ky, 2.6, 2, T);
            limb(kx, ky, fx, 0, 2, 0.6, T);
            spike(kx, ky, kx + (kx > hx0 ? 1.5 : -1.5), ky - 6, 1.4, far ? FAR : W0);
            if (!far) gem(kx, ky, 0.9); else if (!dead) E(kx, ky, 0.7, 0.7, GL.d || GL.m);
          }
          var sw2 = step ? 2 : 0;
          // the far leg and the third arm, raised behind like a sting
          leg(0, hipY, kneel ? -3 : -1, hipY - 7, kneel ? 6 : 1 - sw2, true);
          arm([[-4, by - 7], [-11, by - 9], [-14, by - 15], [-11, by - 21]], 1.9, 0.8, FAR, true);
          if (!dead) E(-12, by - 12, 0.8, 0.8, GL.d || GL.m);
          leg(-4, hipY, kneel ? -14 : -10 - sw2 * 0.5, hipY - 6, kneel ? -20 : -13 - sw2, false);
          // the far arm
          arm([[3, by - 8], [5, by - 2], [9, by + 1], [12, by - 1]], 1.7, 0.8, FAR, true);
          // the carapace: broad at the shoulders, cut to a point below
          var body = [[-8 * bx, by - 5], [-6 * bx, by - 12], [4 * bx, by - 13], [10 * bx, by - 7], [8 * bx, by + 2], [0.5, by + 9], [-6 * bx, by + 2]];
          body = body.map(lean);
          facet(body, W0);
          // inlay: the facets picked out in the army's light (gold on an Alpha)
          var INL = kit.gold ? XGOLD.md : (dead ? W0.seam : GL.m);
          L([body[1], lean([-1.5, by - 6]), body[5]], 0.3, INL);
          L([body[0], lean([-1.5, by - 6]), lean([1.8, by - 7]), body[3]], 0.3, INL);
          // the ridge down the middle, and the army's light in a chevron
          seam([lean([3, by - 11]), lean([6 * bx, by - 5]), lean([3.2, by + 3])], 0.6);
          gem(lean([4.4 * bx, by - 6])[0], by - 6, 1);
          if (rank === 'beta') {                          // faceted pauldrons, spiked, and a hard-edged deflector
            facet([[-6.5 * bx, by - 9], [-5, by - 17], [-1, by - 18], [-0.5, by - 12]].map(lean), W0);
            facet([[1, by - 17], [6, by - 18], [9 * bx, by - 11], [4, by - 11]].map(lean), W0);
            var sp1 = lean([-5, by - 15]), sp2 = lean([0, by - 15.5]), sp3 = lean([6, by - 16]);
            spike(sp1[0], sp1[1], sp1[0] - 6, sp1[1] - 9, 2.2, W0);
            spike(sp2[0], sp2[1], sp2[0] - 3, sp2[1] - 11, 2.4, W0);
            spike(sp3[0], sp3[1], sp3[0] - 1, sp3[1] - 9, 2, W0);
            gem(sp2[0], sp2[1] + 2, 0.9);
          } else {
            var ss1 = lean([-4.5, by - 13.5]), ss2 = lean([2.5, by - 15]);
            spike(ss1[0], ss1[1], ss1[0] - 7, ss1[1] - 9, 2.2, kit.gold ? XGOLD : W0);
            spike(ss2[0], ss2[1], ss2[0] - 3, ss2[1] - 10, 2, kit.gold ? XGOLD : W0);
            gem(ss1[0] + 1, ss1[1] + 1.5, 0.8);
          }
          if (kit.gold) {                                 // an Alpha: its carapace edged in gold
            L([body[1], body[2], body[3]], 0.8, XGOLD.md);
            L([body[6], body[5], body[4]], 0.8, XGOLD.md);
          }
          leg(3, hipY, kneel ? 13 : 9 + sw2 * 0.5, hipY - 6, kneel ? 20 : 13 + sw2, false);
          // the helmet: a wedge, swept back to a spike, a slit of little eyes
          /* The head: a long wedge thrust forward, a jaw spike under it, and a
             crown of long cranial spikes swept back off the skull — tipped with
             the army's light, and gold and longer on an Alpha. */
          var helm = [[-1, hy + 3], [-1.5, hy - 2], [2.5, hy - 5], [8.5, hy - 2.5], [12, hy + 1.2], [5, hy + 3.5]].map(function (q) { return [q[0] + HX, q[1]]; });
          var CR = kit.gold ? XGOLD : W0, cl = kit.gold ? 1.3 : 1;
          var crown = [[-7, -11], [-11, -8], [-13, -3.5], [-11.5, 1]];
          var CRL = kit.gold ? XGOLD : { lt: W0.lt, md: W0.md, dk: W0.dk };
          if (kit.gold && !dead) {                          // an Alpha's head sits in a halo of blue light
            E(HX + 2, hy - 3, 15, 13, 'rgba(110,190,255,.12)');
            E(HX + 2, hy - 3, 11, 9.5, 'rgba(110,190,255,.16)');
            E(HX + 3, hy - 2, 7.5, 6.5, 'rgba(110,190,255,.18)');
          }
          crown.forEach(function (c, i) {
            var bxh = HX + 0.5 - i * 0.3, byh = hy - 3 + i * 1.3;
            var tx = bxh + c[0] * cl, ty = byh + c[1] * cl;
            spike(bxh, byh, tx, ty, 1.5, CRL, true);
            if (!dead) E(tx + (bxh - tx) * 0.1, ty + (byh - ty) * 0.1, 0.55, 0.55, GL.m);
          });
          facet(helm, W0);
          /* the mouth, under the front of the helmet: one round sucker, ringed
             with short fleshy feelers — the "tabs" the book describes (p. 22) */
          var mx = HX + 7, my = hy + 4.2;
          var TAB = dead ? { lt: '#6a6268', md: '#574f55', dk: '#3e383c', sh: '#2c272a' } : XFLESH;
          [[-1.6, 5.5, -2.4], [-0.4, 6.5, 0], [1, 6, 1.8], [2.2, 4.6, 3.2]].forEach(function (f, i) {
            var sway = step && i % 2 ? 0.6 : 0;
            arm([[mx + f[0] * 0.8, my + 0.8], [mx + f[0] * 1.3, my + f[1] * 0.65], [mx + f[2] * 1.3 + sway, my + f[1] * 1.3]], 1.1, 0.45, TAB);
          });
          E(mx, my, 2.5, 2, TAB.dk);
          E(mx - 0.3, my - 0.3, 1.9, 1.5, TAB.md);
          E(mx, my + 0.1, 0.95, 0.75, dead ? '#2a2527' : '#3b2230');
          if (kit.gold) {
            spike(HX + 2.5, hy - 4.5, HX + 3.5, hy - 13, 2, XGOLD);              // a blade of a crest
            /* and set in the brow, a blue crystal: the Alpha's mind made visible,
               glowing whatever colours the tribe wears */
            var cxr = HX + 5, cyr = hy - 5.2;
            if (!dead) { E(cxr, cyr - 1.5, 6.5, 6.5, 'rgba(110,190,255,.22)'); E(cxr, cyr - 1.5, 3.8, 3.8, 'rgba(110,190,255,.35)'); }
            F([[cxr - 2.2, cyr + 0.8], [cxr + 2.2, cyr + 0.8], [cxr + 1.4, cyr + 2], [cxr - 1.4, cyr + 2]], XGOLD.dk);   // its gold setting
            F([[cxr, cyr - 6], [cxr + 2, cyr - 1.2], [cxr, cyr + 1.2], [cxr - 2, cyr - 1.2]], dead ? '#4c4a44' : '#3f9be8');
            F([[cxr, cyr - 6], [cxr + 2, cyr - 1.2], [cxr, cyr - 1]], dead ? '#5e5b54' : '#9fd6ff');
            F([[cxr, cyr - 6], [cxr - 2, cyr - 1.2], [cxr - 0.6, cyr - 1.6]], dead ? '#55524c' : '#e8f6ff');
            if (!dead) E(cxr - 0.5, cyr - 2.6, 0.5, 0.9, '#ffffff');
          }
          L([[HX + 3.5, hy - 0.9], [HX + 11, hy + 0.5]], 1.4, dead ? '#2c2a26' : W0.seam);
          [[4.6, hy - 0.7], [6.6, hy - 0.3], [8.6, hy + 0.1], [10.2, hy + 0.4]].forEach(function (q) { E(q[0] + HX, q[1], 0.6, 0.5, dead ? '#3a3834' : GL.m); });
          if (!dead) L([[HX + 4, hy - 0.7], [HX + 11, hy + 0.5]], 2.6, GL.h);
          // the near arm and the weapon
          var ax = 7, ay = by - 5;
          var wpn2 = kit.gun || 'energy';
          if (wpn2 === 'launcher') {                      // Gamma: a portal gun — the orb goes in here and comes out there
            var PB = dead ? null : { h: 'rgba(110,190,255,.28)', m: '#6ebeff', l: '#e4f4ff', d: '#0b2d5c' };
            // a heavy housing at the back, a stubby barrel forward
            facet([[-7, by - 5], [-6, by - 11], [9, by - 16.5], [18, by - 16], [19, by - 5], [4, by - 0.5], [-5, by - 2]], W0);
            facet([[17, by - 15.5], [24, by - 14.5], [26.5, by - 13], [26.5, by - 8], [24, by - 6.5], [17, by - 6]], W0);
            L([[1, by - 9.5], [17, by - 12.5]], 0.8, dead ? '#3a3834' : W0.seam);    // a panel line down the housing
            spike(12, by - 16.2, 6, by - 22, 2, W0);
            // the ammunition: a glass drum slung under the housing, the bombs glowing in it
            E(9, by - 1.2, 7.4, 3.9, dead ? '#3a3834' : W0.dk);
            E(9, by - 1.5, 6.6, 3.2, dead ? '#2c2a26' : PB.d);
            if (!dead) {
              E(9, by - 1.5, 6.6, 3.2, 'rgba(110,190,255,.25)');
              [[4.6, -1.4], [9, -1], [13.4, -1.4]].forEach(function (o) {
                E(o[0], by + o[1], 2, 1.8, PB.m);
                E(o[0] - 0.5, by + o[1] - 0.5, 0.6, 0.5, PB.l);
              });
              E(7.5, by - 3.4, 4, 0.6, 'rgba(255,255,255,.4)');                  // the glass catching the light
            }
            // and a feed canister on top, feeding the barrel
            E(7, by - 15.4, 3.8, 2.2, dead ? '#3a3834' : W0.dk);
            E(7, by - 15.7, 3.1, 1.6, dead ? '#2c2a26' : PB.m);
            if (!dead) E(6.2, by - 16.1, 1.2, 0.5, PB.l);
            L([[10.5, by - 15.2], [18, by - 13.5]], 1, dead ? '#3a3834' : PB.m);           // the feed line
            for (var gc2 = 0; gc2 < 2; gc2++) {                                      // coils on the barrel
              var cx2 = 20 + gc2 * 3.2, cy2 = by - 10.7 - gc2 * 0.3;
              E(cx2, cy2, 1.2, 4.6, dead ? '#4c4a44' : PB.m, -0.1);
              E(cx2 + 0.3, cy2, 0.5, 3.4, dead ? '#3a3834' : PB.d, -0.1);
            }
            var px = 29.5, py = by - 10.6;
            if (!dead) E(px, py, 6, 7.6, PB.h, -0.18);
            E(px, py, 3.6, 5.6, dead ? '#5e5b54' : W0.dk, -0.18);            // the ring's white collar
            E(px - 0.2, py - 0.2, 3.2, 5.2, dead ? '#4c4a44' : W0.lt, -0.18);
            E(px, py, 2.5, 4.4, dead ? '#2c2a26' : PB.m, -0.18);             // the portal itself
            if (!dead) {
              E(px + 0.2, py, 1.9, 3.6, PB.d, -0.18);
              E(px + 0.4, py - 0.3, 1.1, 2.3, '#2f78c8', -0.18);
              E(px + 0.6, py - 0.6, 0.5, 1.1, PB.l, -0.18);
              L([[px - 1.2, py - 3.4], [px + 0.6, py - 1], [px - 0.6, py + 1.8]], 0.5, PB.l);   // the swirl
            }
            arm([[ax, ay], [9, ay + 4], [12, by - 3], [12, by - 7]], 1.8, 1, W0);
            arm([[1, ay + 2], [2, ay + 6], [5, by - 1], [5, by - 5]], 1.6, 0.9, W0);
          } else if (wpn2 === 'blades') {                 // Delta: an energy blade on each arm
            arm([[ax, ay], [9, ay + 4], [12, ay + 2], [15, ay - 2]], 1.8, 1.1, W0);
            F([[15, ay - 3.6], [29, ay - 17], [18, ay - 1.4]], dead ? '#666' : GL.m);
            if (!dead) L([[16, ay - 3], [27, ay - 15]], 0.6, GL.l);
            arm([[1, ay + 2], [3, ay + 7], [6, ay + 9], [8, ay + 8]], 1.6, 1, W0);
            if (kit.bladeFire) {                          // the higher grades carry a short gun too
              facet([[7, ay + 7.5], [18, ay + 6.8], [19, ay + 8], [8, ay + 9.6]], W0);
              E(19.5, ay + 7.5, 0.9, 0.9, dead ? '#555' : GL.m);
            } else {
              F([[7, ay + 7.5], [23, ay + 5], [8, ay + 9.8]], dead ? '#666' : GL.d || GL.m);
            }
          } else if (wpn2 === 'staff') {                  // Alpha: a staff of office, and shards about it
            arm([[ax, ay], [8, ay + 4], [11, ay + 2], [12.5, ay - 3]], 1.8, 1, W0);
            L([[12, ay + 13], [13.5, ay - 17]], 1.4, XGOLD.dk);
            L([[12, ay + 13], [13.5, ay - 17]], 0.7, XGOLD.lt);
            spike(13.5, ay - 17, 11, ay - 22, 1.4, XGOLD);
            spike(13.5, ay - 17, 16, ay - 22, 1.4, XGOLD);
            // the staff's crystal, held between the two gold prongs — the tribe's blue
            var sx = 13.6, sy = ay - 21;
            if (!dead) { E(sx, sy, 5.5, 5.5, 'rgba(110,190,255,.2)'); E(sx, sy, 3.4, 3.4, 'rgba(110,190,255,.3)'); }
            F([[sx, sy - 3.6], [sx + 1.8, sy], [sx, sy + 3], [sx - 1.8, sy]], dead ? '#4c4a44' : '#3f9be8');
            F([[sx, sy - 3.6], [sx + 1.8, sy], [sx, sy]], dead ? '#5e5b54' : '#9fd6ff');
            F([[sx, sy - 3.6], [sx - 1.8, sy], [sx - 0.5, sy - 0.4]], dead ? '#55524c' : '#e8f6ff');
            if (!dead) { gem(-11, hy + 1 + (step ? 1 : 0), 1); gem(11, hy - 7 - (step ? 1 : 0), 0.8); }
            facet([[3, ay + 1.5], [12, ay + 0.8], [13, ay + 2.4], [4, ay + 3.4]], W0);          // and a sidearm
            E(13.6, ay + 1.6, 0.8, 0.8, dead ? '#555' : GL.m);
          } else {                                        // an energy rifle: a long faceted prism, pronged at the muzzle
            var ln = rank === 'beta' ? 21 : 18;
            facet([[-2, ay + 3.6], [ln - 3, ay - 1.2], [ln, ay - 0.6], [ln - 1, ay + 1.2], [2, ay + 5]], W0);
            spike(ln - 2, ay - 0.9, ln + 3, ay - 2.6, 1.1, W0);
            spike(ln - 2, ay + 1, ln + 3, ay + 1.8, 1.1, W0);
            gem(7, ay + 2.3, 1.1);
            E(ln + 1.6, ay - 0.3, 0.8, 0.8, dead ? '#555' : GL.m);
            arm([[ax, ay - 1], [7, ay + 4], [9, ay + 3.5], [10, ay + 1.6]], 1.8, 1, W0);
            arm([[1, ay + 1], [2, ay + 5], [4, ay + 6.5], [5, ay + 4.5]], 1.6, 0.9, W0);
          }
          /* the Beta's Personal Deflector: a bubble of blue light about the whole
             body, brighter at its rim, with a few facets catching the light */
          /* ...and it is alive: `SHIELD_PHASE` (one of SHIELD_PHASES, turned by the
             clock) breathes its light up and down, walks a band of brightness
             round the rim and lights a different few of its hexes each time. */
          if (rank === 'beta' && !dead && !PH.corpse) {
            var sph = PH.shield / SHIELD_PHASES, pulse = 0.75 + 0.25 * Math.sin(sph * Math.PI * 2);
            var dcx = 4, dcy = by - 9, drx = 19, dry = 27;
            E(dcx, dcy, drx, dry, 'rgba(140,210,255,' + (0.1 * pulse).toFixed(3) + ')');
            E(dcx - 5, dcy - 9, drx * 0.45, dry * 0.35, 'rgba(220,242,255,.12)');        // a sheen high on the bubble
            var rim = [];
            for (var ri = 0; ri <= 28; ri++) { var ra = ri / 28 * Math.PI * 2; rim.push([dcx + Math.cos(ra) * drx, dcy + Math.sin(ra) * dry]); }
            L(rim, 3.2, 'rgba(110,190,255,' + (0.28 * pulse).toFixed(3) + ')');   // the glow off the rim
            L(rim, 1.3, 'rgba(120,200,255,' + (0.95 * pulse).toFixed(3) + ')');
            var sweep = Math.round(sph * 28);                                   // the band of light running round the rim
            L(rim.concat(rim.slice(1)).slice(sweep, sweep + 8), 1.8, 'rgba(220,242,255,.95)');
            [[-8, -14], [12, -18], [-12, 6], [14, 8], [2, -24], [-4, 14], [16, -6], [-15, -4]].forEach(function (h2, hn) {   // hexes flickering in it
              if ((hn + PH.shield) % 3) return;
              var hx2 = dcx + h2[0], hy2 = dcy + h2[1], r2 = 2.2;
              var hp = [];
              for (var hi = 0; hi <= 6; hi++) { var ha = hi / 6 * Math.PI * 2; hp.push([hx2 + Math.cos(ha) * r2, hy2 + Math.sin(ha) * r2]); }
              L(hp, 0.7, 'rgba(160,215,255,.7)');
            });
          }
        }
        g.restore();
        // a cloaked squad is the same model, half there: faded as it is drawn (cloakFade), not baked in
      }

    return {
      xenoGlow: xenoGlow, hexA: hexA, paintXeno: paintXeno
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCIsoXenoFig;
})(typeof window !== 'undefined' ? window : global);
