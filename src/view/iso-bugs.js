/* PMC 2670 — Firefight : the Space Bugs: the swarm's figures, the dead, the burrowing, and the Overgrown

   Made once by iso-aliens.js, the first time it is wanted. E is what it needs
   of iso-aliens.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCIsoBugs = function (E) {
    var A = E.A, ACID = E.ACID, ACID_D = E.ACID_D, ACID_L = E.ACID_L, B = E.B, BIGBUG = E.BIGBUG,
        BONE = E.BONE, BONE_D = E.BONE_D, BRAIN_PHASES = E.BRAIN_PHASES, BUG3D = E.BUG3D,
        BUG_EYE = E.BUG_EYE, CHITIN = E.CHITIN, CHITIN_L = E.CHITIN_L, ELEV = E.ELEV,
        FUNGUS_CAP = E.FUNGUS_CAP, K = E.K, LEGC = E.LEGC, LEG_LIT = E.LEG_LIT, PH = E.PH, PSY = E.PSY,
        PSY_D = E.PSY_D, PSY_L = E.PSY_L, WING_PHASES = E.WING_PHASES, a = E.a, dot = E.dot,
        ellipse = E.ellipse, hexMix = E.hexMix, hullSpec = E.hullSpec, nowT = E.nowT, poly = E.poly,
        rng = E.rng, root = E.root, toScreen = E.toScreen;

      /* A dead bug: thrown on its back, its legs curled up over it, the colour
         gone out of the shell — not the one coming up out of the ground, which is
         what its lying-low pose is on the table. The crumpled pose is painted, then
         turned over so the shell lies on the ground and the legs stand up off it. */
      function deadBug(g, w, h, ox, oy, pal, kit, s) {
        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        var tg = tmp.getContext('2d');
        paintBug(tg, ox, oy, pal, kit, 'prone', 0, s, true);
        // how high it stands, so the overturned body rests on the same ground
        var d = tg.getImageData(0, 0, w, h).data, top = h, bot = 0;
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (y < top) top = y; bot = y; break; }
        }
        if (bot <= top) return;
        var k = 0.72;
        g.save();
        g.setTransform(1, 0, 0, -k, 0, oy + top * k);
        g.drawImage(tmp, 0, 0);
        g.restore();
      }
      function paintBug(g, ox, oy, pal, kit, pose, step, s, dead) {
        var SH = dead
          ? { lt: '#5a5044', md: '#443c33', dk: '#26211b', gl: '#6a6052' }
          : { lt: pal.light, md: pal.mid, dk: pal.dark, gl: hexMix(pal.light, '#ffffff', 0.55) };
        var acid = dead ? { m: '#4a5a34', l: '#667a48', d: '#2e3a20' } : { m: ACID, l: ACID_L, d: ACID_D };
        var psy = dead ? { m: '#5a4e66', l: '#76688a', d: '#3a3044' } : { m: PSY, l: PSY_L, d: PSY_D };
        var eye = dead ? '#3a3a2a' : BUG_EYE;
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
        function F(pts, c) {
          g.fillStyle = c; g.beginPath();
          pts.forEach(function (q, i) { if (i) g.lineTo(X(q[0]), Y(q[1])); else g.moveTo(X(q[0]), Y(q[1])); });
          g.closePath(); g.fill();
        }
        // a piece of carapace: belly under it, the shell, its lit crown and a glint
        function shell(cx, cy, rx, ry, rot, T) {
          T = T || SH;
          E(cx, cy + ry * 0.2, rx * 0.96, ry * 0.86, CHITIN, rot);
          E(cx, cy, rx, ry, T.dk, rot);
          E(cx - rx * 0.04, cy - ry * 0.12, rx * 0.9, ry * 0.8, T.md, rot);
          E(cx - rx * 0.18, cy - ry * 0.42, rx * 0.56, ry * 0.34, T.lt, rot);
          E(cx - rx * 0.3, cy - ry * 0.56, rx * 0.2, ry * 0.12, T.gl || T.lt, rot);
        }
        // the plates of an abdomen, as dark seams across it
        function ridges(cx, cy, rx, ry, n, T) {
          T = T || SH;
          for (var i = 1; i < n; i++) {
            var fx = -1 + 2 * i / n, x = cx + fx * rx, h = Math.sqrt(Math.max(0, 1 - fx * fx));
            L([[x, cy - ry * 0.9 * h], [x + rx * 0.07, cy], [x + rx * 0.02, cy + ry * 0.7 * h]], 0.9, T.dk);
          }
        }
        function legColour(far) { return far ? '#120e0c' : LEGC; }
        /* A leg: from the body, up to the knee, down to the foot. `far` legs are
           drawn first, darker and a touch behind. */
        function leg(ax, ay, kx, ky, fx, fy, w, far) {
          var c = legColour(far);
          // a spider's leg: thick to the knee, then tapering to a point
          L([[ax, ay], [kx, ky]], w, c);
          L([[kx, ky], [fx, fy]], w * 0.62, c);
          if (!far) {
            L([[ax, ay - w * 0.15], [kx, ky - w * 0.25]], w * 0.35, LEG_LIT);
            E(kx, ky, w * 0.55, w * 0.5, CHITIN_L);
          }
        }
        var drop = 0;
        /* Six walking legs under a body whose belly stands `clear` off the ground.
           `xs` are the attach points front to back; `reach` how far forward the
           foot plants from its hip. */
        function walk(xs, ay, clear, reach, w, far) {
          var suppressed = pose === 'kneel', down = pose === 'prone';
          // four legs a side, like a spider: a fourth behind the last
          if (xs.length === 3) {
            xs = xs.concat([xs[2] - (xs[1] - xs[2])]);
            reach = reach.concat([reach[2] - Math.abs(reach[1] - reach[2]) - 2]);
          }
          xs.forEach(function (ax, i) {
            var ph = (i + (far ? 1 : 0)) % 2;
            var sw = step ? (ph ? 3 : -3) : 0;
            var r = reach[i] + sw + (far ? 2 : 0);
            var yy = ay + drop, fyy = far ? -0.6 : 0.4;
            if (down) {                                   // legs drawn in, crumpled under it
              leg(ax + (far ? 2 : 0), yy - 1, ax + r * 0.35, yy + clear * 0.2, ax + r * 0.15 - 2, yy + clear * 0.1 + 1, w * 0.85, far);
              return;
            }
            /* an insect's leg: up from the hip to a knee held above the body,
               then down and out to the foot */
            if (suppressed) r *= 1.35;                    // splayed wide and low
            r *= 1.25;
            // the knee held up above the back, the foot planted well out
            var kx = ax + r * 0.45, ky = yy - clear * (suppressed ? 0.5 : 0.9) - 3;
            leg(ax + (far ? 2 : 0), yy - (far ? 1 : 0), kx + (far ? 2 : 0), ky, ax + r * 1.05, fyy, w * 0.8, far);
          });
        }
        function mandibles(hx, hy, sz, open) {
          var o = open == null ? (pose === 'stand' ? 1 : 0.35) : open;
          L([[hx, hy - sz * 0.2], [hx + sz * 1.1, hy - sz * (0.5 + o * 0.4)], [hx + sz * 1.7, hy - sz * (0.1 + o * 0.2)]], sz * 0.42, BONE_D);
          L([[hx, hy + sz * 0.3], [hx + sz * 1.2, hy + sz * (0.5 + o * 0.35)], [hx + sz * 1.75, hy + sz * (0.05 + o * 0.25)]], sz * 0.42, BONE);
        }
        function eyes(hx, hy, sz, n) {
          for (var i = 0; i < (n || 2); i++) {
            E(hx + sz * (0.1 + i * 0.35), hy - sz * (0.35 + (i % 2) * 0.18), sz * 0.24, sz * 0.2, eye);
          }
        }
        function head(hx, hy, rx, ry, eyN, mand) {
          shell(hx, hy, rx, ry);
          eyes(hx + rx * 0.2, hy, ry, eyN);
          if (mand !== false) mandibles(hx + rx * 0.75, hy + ry * 0.35, Math.max(1.6, ry * 0.7));
        }
        function antennae(hx, hy, len, sweep) {
          var sw2 = step ? 2 : 0;
          L([[hx, hy], [hx + len * 0.5, hy - len * 0.7 - sw2], [hx + len * (1 + sweep), hy - len * 0.95]], 0.7, LEGC);
          L([[hx - 1, hy], [hx + len * 0.35, hy - len * 0.8], [hx + len * (0.7 + sweep), hy - len * 1.15 + sw2]], 0.6, '#120e0c');
        }
        function sac(cx, cy, rx, ry, glow) {
          if (glow && !dead) E(cx, cy, rx * 1.35, ry * 1.35, 'rgba(150,230,80,.18)');
          E(cx, cy, rx, ry, acid.d);
          E(cx - rx * 0.05, cy - ry * 0.1, rx * 0.86, ry * 0.8, acid.m);
          E(cx - rx * 0.25, cy - ry * 0.35, rx * 0.4, ry * 0.3, acid.l);
          // veins over it
          L([[cx - rx * 0.8, cy + ry * 0.1], [cx - rx * 0.2, cy - ry * 0.3], [cx + rx * 0.5, cy - ry * 0.1]], 0.6, acid.d);
          L([[cx - rx * 0.5, cy + ry * 0.6], [cx + rx * 0.1, cy + ry * 0.2], [cx + rx * 0.7, cy + ry * 0.4]], 0.6, acid.d);
        }
        function brain(cx, cy, rx, ry) {
          /* It pulses, slowly: swelling a little and its glow brightening, one
             beat in BRAIN_PHASES baked states turned by the clock. */
          var bp = dead ? 0 : Math.sin(PH.brain / BRAIN_PHASES * Math.PI * 2);
          rx *= 1 + 0.05 * bp; ry *= 1 + 0.05 * bp;
          if (!dead) E(cx, cy, rx * (1.3 + 0.08 * bp), ry * (1.3 + 0.08 * bp), 'rgba(185,140,242,' + (0.2 + 0.1 * bp).toFixed(3) + ')');
          E(cx, cy, rx, ry, psy.d);
          E(cx - rx * 0.05, cy - ry * 0.08, rx * 0.9, ry * 0.84, psy.m);
          // the folds of it
          for (var i = 0; i < 4; i++) {
            var yy = cy - ry * 0.6 + i * ry * 0.38;
            L([[cx - rx * 0.7, yy], [cx - rx * 0.3, yy - ry * 0.18], [cx + rx * 0.1, yy + ry * 0.05], [cx + rx * 0.6, yy - ry * 0.15]], 0.7, psy.d);
          }
          E(cx - rx * 0.3, cy - ry * 0.5, rx * 0.3, ry * 0.2, psy.l);
        }
        function wings(cx, cy, len, big) {
          if (pose === 'prone') {                         // folded flat along the back
            E(cx - len * 0.35, cy, len * 0.55, len * 0.12, 'rgba(200,214,210,.45)', 0.08);
            return;
          }
          /* The beat: a flier hanging in the air flaps all the time, WING_PHASES
             baked states turned by the clock; on the move it is the step's two beats. */
          var up = PH.wing >= 0 ? -0.1 - 1.1 * (0.5 + 0.5 * Math.sin(PH.wing / WING_PHASES * Math.PI * 2)) : step ? -0.9 : -0.35;
          var a2 = up + (big ? 0 : 0.1);
          function wing(ang, l, alpha) {
            var tx = cx + Math.cos(ang) * l * -0.35, ty = cy + Math.sin(ang) * l;
            g.save();
            g.translate(X(cx), Y(cy)); g.rotate(ang);
            g.fillStyle = 'rgba(214,230,228,' + alpha + ')';
            g.beginPath(); g.ellipse(-l * 0.45 * s, 0, l * 0.55 * s, l * 0.16 * s, 0, 0, Math.PI * 2); g.fill();
            g.strokeStyle = 'rgba(40,40,36,' + (alpha + 0.2) + ')'; g.lineWidth = Math.max(1, 0.5 * s);
            g.beginPath(); g.moveTo(0, 0); g.lineTo(-l * 0.95 * s, -l * 0.04 * s);
            g.moveTo(-l * 0.3 * s, 0); g.lineTo(-l * 0.7 * s, l * 0.1 * s); g.stroke();
            g.restore();
            return { x: tx, y: ty };
          }
          wing(a2 - 0.25 + Math.PI, len * 0.9, 0.34);
          wing(a2 + Math.PI + 0.15, len, 0.42);
          if (!dead && step) E(cx - len * 0.3, cy - len * 0.35, len * 0.45, len * 0.3, 'rgba(220,235,235,.12)');
        }
        function spikes(pts, h) {
          pts.forEach(function (q) {
            F([[q[0] - h * 0.3, q[1]], [q[0] + h * 0.1, q[1] - h], [q[0] + h * 0.35, q[1]]], SH.dk);
            L([[q[0], q[1]], [q[0] + h * 0.08, q[1] - h * 0.8]], 0.5, SH.lt);
          });
        }
        function mound(cx, rx, ry) {                      // the spoil a burrower pushes up
          E(cx, -ry * 0.1, rx, ry, '#4a3d2a');
          E(cx - rx * 0.1, -ry * 0.3, rx * 0.85, ry * 0.7, '#5f4f37');
          E(cx - rx * 0.3, -ry * 0.55, rx * 0.4, ry * 0.3, '#776548');
          for (var i = 0; i < 6; i++) {
            var px = cx - rx + (i + 0.5) * rx * 2 / 6, py = -ry * (0.3 + ((i * 37) % 5) * 0.08) - (step && i % 2 ? 1.2 : 0);
            E(px, py, 1.3, 1, i % 2 ? '#3a2f20' : '#8a7654');
          }
        }

        var kind = kit.bug;
        var down = pose === 'prone';
        switch (kind) {
          /* ---- lesser bugs ---- */
          case 'tiny': {
            // a scuttling clump of little ones, each no bigger than a hand
            var spots = [[-14, -1, 1], [-3, 1, 1.1], [9, -2, 0.95], [-9, -8, 0.85], [4, -9, 0.9], [15, -7, 0.8]];
            spots.forEach(function (q, i) {
              var x = q[0] + (step && i % 2 ? 1.5 : 0), y = q[1] + (down ? 2 : 0), z = q[2] * (down ? 0.85 : 1);
              for (var l2 = 0; l2 < 3; l2++) {
                var lx = x - 3 * z + l2 * 3 * z;
                L([[lx, y - 2 * z], [lx + (step ? 1 : -1) * z, y - 3.6 * z], [lx + 1.6 * z, y]], 0.8 * z, LEGC);
              }
              shell(x, y - 3.4 * z, 4.6 * z, 2.8 * z);
              E(x + 4.6 * z, y - 3 * z, 1.9 * z, 1.7 * z, SH.dk);
              E(x + 5.2 * z, y - 3.6 * z, 0.6 * z, 0.5 * z, eye);
              L([[x + 6 * z, y - 2.6 * z], [x + 7.6 * z, y - 2 * z]], 0.6 * z, BONE);
            });
            break;
          }
          case 'small': {
            drop = pose === 'kneel' ? 4 : down ? 4 : 0;
            walk([4, -1, -6], -8, 8, [7, 3, -5], 1.6, true);
            shell(-9, -12 + drop, 11, 7, -0.08);
            ridges(-9, -12 + drop, 11, 7, 4);
            shell(4, -14 + drop, 6, 5.5);
            head(11, -15 + drop, 5, 4.4, 2);
            walk([5, 0, -5], -9, 8, [8, 4, -4], 1.8, false);
            break;
          }
          case 'attack':
          case 'oversized': {
            // the warrior caste: up on its hind legs, a scythe held over the head
            var big = kind === 'oversized';
            var z = big ? 1.12 : 1;
            drop = pose === 'kneel' ? 14 : down ? 14 : 0;
            walk([-4 * z, -11 * z, -18 * z], -16 * z, 15 * z, [9, 3, -6], 2 * z, true);
            shell(-15 * z, -20 * z + drop, 12 * z, 8.5 * z, 0.35);
            ridges(-15 * z, -20 * z + drop, 12 * z, 8.5 * z, 4);
            shell(-1 * z, -27 * z + drop * 0.9, 7 * z, 9 * z, -0.5);
            if (big) spikes([[-20, -28 + drop], [-13, -30 + drop], [-5, -35 + drop]], 6);
            // the far scythe
            var lift2 = down ? 16 : pose === 'kneel' ? 12 : 0, swing = step ? 3 : 0;
            L([[3 * z, -32 * z + drop], [10 * z, -46 * z + lift2 + swing], [20 * z, -30 * z + lift2]], 2.4 * z, '#6f6450');
            head(7 * z, -39 * z + drop * 0.85, 5.2 * z, 4.6 * z, 2);
            walk([-3 * z, -10 * z, -17 * z], -17 * z, 15 * z, [10, 4, -5], 2.2 * z, false);
            // the near scythe: an arm, then the blade folded down off the elbow
            L([[1 * z, -30 * z + drop], [7 * z, -47 * z + lift2 - swing], [13 * z, -50 * z + lift2 - swing]], 2.8 * z, LEGC);
            F([[13 * z, -51 * z + lift2 - swing], [26 * z, -38 * z + lift2], [24 * z, -35 * z + lift2], [12 * z, -47 * z + lift2 - swing]], BONE);
            L([[14 * z, -49 * z + lift2 - swing], [24 * z, -37 * z + lift2]], 0.7 * z, BONE_D);
            if (big) {                                      // hardened claws: a pincer as well
              L([[2, -26 + drop], [14, -22 + drop], [20, -24 + drop]], 2.6, SH.dk);
              F([[19, -27 + drop], [27, -25 + drop], [20, -22 + drop]], BONE);
              F([[19, -22 + drop], [26, -18 + drop], [19, -20 + drop]], BONE_D);
            }
            break;
          }
          /* ---- underground ---- */
          case 'under':
          case 'hugeunder': {
            /* Half out of its hole: the forebody reared up out of the spoil at 45°,
               the head and jaws at the top, the rest of it still down in the earth.
               Pinned down it shows less of itself — the same angle, lower. */
            var hu = kind === 'hugeunder', zz = hu ? 1.3 : 1;
            var reach = (pose === 'stand' ? 24 : 16) * zz;             // how much of it is out of the ground
            var bx0 = -8 * zz, ux = 0.707, uy = -0.707;                // where it comes out, and the way it points
            function at(t, off) { return [bx0 + ux * reach * t - uy * (off || 0), uy * reach * t + ux * (off || 0)]; }
            mound(-4 * zz, 16 * zz, 5 * zz);
            // the body, segment on segment up the slope (tilted to it), plates and spines along its back
            [[0.2, 7.5], [0.44, 7], [0.68, 6.2]].forEach(function (sg) {
              var c = at(sg[0]);
              shell(c[0], c[1], sg[1] * zz, 5.4 * zz, -0.785);
            });
            var rb = at(0.4);
            ridges(rb[0], rb[1], 7 * zz, 5.4 * zz, 4);
            spikes([at(0.2, -5 * zz), at(0.45, -5 * zz), at(0.68, -4.5 * zz)], 4 * zz);
            var hc = at(0.92);
            head(hc[0], hc[1], 5.5 * zz, 5 * zz, 3, false);
            // jaws opening at the top
            var op = pose === 'stand' ? (step ? 1 : 0.7) : 0.25, jw = at(1.02);
            L([[jw[0], jw[1]], [jw[0] + 7 * zz, jw[1] - 6 * zz - op * 4], [jw[0] + 11 * zz, jw[1] - 1 * zz]], 2 * zz, BONE);
            L([[jw[0] + 1, jw[1] + 3 * zz], [jw[0] + 9 * zz, jw[1] + 3 * zz], [jw[0] + 12 * zz, jw[1] - 1 * zz]], 2 * zz, BONE_D);
            // the lip of the hole, over its belly where it comes out of the earth
            E(-4 * zz, 0, 16 * zz, 3 * zz, '#4a3d2a');
            E(-8 * zz, -1 * zz, 8 * zz, 1.6 * zz, '#5f4f37');
            break;
          }
          /* ---- spore bugs ---- */
          case 'spitlarva': {
            // a fat grub, the acid sac glowing through its hind end
            var yb = down ? 2 : 0, hump = step ? 1 : 0;
            sac(-12, -6 + yb, 7, 5.5, true);
            shell(-4, -7 + yb - hump, 6.5, 5.5);
            shell(4, -7 + yb, 6, 5);
            head(10, -6 + yb, 4.5, 4, 2);
            for (var sg2 = -1; sg2 < 3; sg2++) E(-8 + sg2 * 5, -1 + yb, 1.6, 1.2, CHITIN_L);
            break;
          }
          case 'immspit':
          case 'spitter': {
            var sp2 = kind === 'spitter', zs = sp2 ? 1.25 : 1;
            drop = pose === 'kneel' ? 6 : down ? 6 : 0;
            walk([4 * zs, -1 * zs, -6 * zs], -9 * zs, 10 * zs, [8, 3, -5], 1.8 * zs, true);
            // the sac is the whole back end, swollen and lit
            sac(-12 * zs, -20 * zs + drop, 12 * zs, 10 * zs, true);
            E(-6 * zs, -12 * zs + drop, 9 * zs, 3 * zs, SH.dk);
            shell(-10 * zs, -13 * zs + drop, 10 * zs, 4 * zs, -0.05);
            shell(4 * zs, -16 * zs + drop, 6 * zs, 6 * zs);
            head(11 * zs, -19 * zs + drop, 5 * zs, 4.6 * zs, 2, false);
            // the spout
            L([[14 * zs, -20 * zs + drop], [20 * zs, -24 * zs + drop], [24 * zs, -24 * zs + drop]], 2.2 * zs, SH.dk);
            E(24 * zs, -24 * zs + drop, 1.5 * zs, 1.3 * zs, acid.l);
            walk([5 * zs, 0, -5 * zs], -10 * zs, 10 * zs, [9, 4, -4], 2 * zs, false);
            break;
          }
          case 'spore': {
            drop = pose === 'kneel' ? 8 : down ? 8 : 0;
            walk([6, 0, -7], -12, 12, [9, 3, -6], 2.2, true);
            sac(-12, -22 + drop, 13, 10, true);
            shell(-10, -16 + drop, 13, 6);
            ridges(-10, -16 + drop, 13, 6, 5);
            // chimneys the spores are blown from
            [[-18, 0], [-11, 1], [-4, 0]].forEach(function (c, i) {
              var cx = c[0], hgt = 9 + i * 2;
              L([[cx, -24 + drop], [cx + 1, -24 - hgt + drop]], 3.2, SH.dk);
              L([[cx - 0.6, -24 + drop], [cx + 0.4, -24 - hgt + drop]], 1.2, SH.lt);
              E(cx + 1, -24 - hgt + drop, 2, 1.2, acid.m);
              if (!dead && pose === 'stand') E(cx + 1 + i, -28 - hgt + drop - (step ? 2 : 0), 2.2, 1.8, 'rgba(200,240,150,.45)');
            });
            shell(5, -18 + drop, 7, 7);
            head(12, -20 + drop, 5.2, 4.6, 3);
            walk([7, 1, -6], -13, 12, [10, 4, -5], 2.4, false);
            break;
          }
          /* ---- flying bugs ---- */
          case 'smallwing':
          case 'largewing': {
            var lw = kind === 'largewing', zw = lw ? 1.25 : 1;
            var dy2 = down ? 10 * zw : 0;
            // legs hang under it in the air, and splay out on the ground
            [[2, 1], [-2, 0], [-6, 1]].forEach(function (q) {
              if (down) L([[q[0] * zw, -8 * zw + dy2], [(q[0] + 3) * zw, -2 * zw + dy2 * 0.3], [(q[0] + 5) * zw, 0]], 1.2 * zw, LEGC);
              else L([[q[0] * zw, -8 * zw], [(q[0] + 2) * zw, -2 * zw], [(q[0] - 1) * zw, 3 * zw + q[1]]], 1.1 * zw, LEGC);
            });
            wings(-2 * zw, -14 * zw + dy2, 18 * zw, lw);
            shell(-13 * zw, -8 * zw + dy2, 10 * zw, 4.2 * zw, 0.25);
            ridges(-13 * zw, -8 * zw + dy2, 10 * zw, 4.2 * zw, 4);
            if (lw) F([[-22 * zw, -5 * zw + dy2], [-29 * zw, -2 * zw + dy2], [-21 * zw, -8 * zw + dy2]], BONE);   // the sting
            shell(-1 * zw, -11 * zw + dy2, 5 * zw, 4.4 * zw);
            head(6 * zw, -12 * zw + dy2, 4 * zw, 3.6 * zw, 2);
            if (!down) wings(-1 * zw, -13 * zw, 16 * zw, lw);
            break;
          }
          /* ---- pioneers ---- */
          case 'smallpath':
          case 'path': {
            var pz = kind === 'path' ? 1.15 : 1;
            drop = pose === 'kneel' ? 9 : down ? 9 : 0;
            walk([4 * pz, -2 * pz, -8 * pz], -13 * pz, 13 * pz, [11, 4, -8], 1.3 * pz, true);
            shell(-11 * pz, -16 * pz + drop, 8 * pz, 4.4 * pz, 0.1);
            ridges(-11 * pz, -16 * pz + drop, 8 * pz, 4.4 * pz, 3);
            shell(0, -17 * pz + drop, 5 * pz, 3.4 * pz);
            head(7 * pz, -19 * pz + drop, 3.8 * pz, 3.2 * pz, 2, false);
            antennae(9 * pz, -21 * pz + drop, 12 * pz, 0.3);
            // the scent glands it marks the enemy with
            if (!dead) [[-14, -19], [-9, -20]].forEach(function (q) { E(q[0] * pz, q[1] * pz + drop, 1.4, 1.2, '#ff9a5a'); });
            walk([5 * pz, -1 * pz, -7 * pz], -14 * pz, 13 * pz, [12, 5, -7], 1.4 * pz, false);
            break;
          }
          case 'lurker': {
            /* A pioneer, so it stands up on the same long, jointed legs as the
               others: the long spined body carried high, not dragged along the ground. */
            drop = pose === 'kneel' ? 9 : down ? 9 : 0;
            walk([6, -2, -10], -14, 14, [13, 5, -11], 1.8, true);
            shell(-8, -17 + drop, 15, 5.5, 0.02);
            ridges(-8, -17 + drop, 15, 5.5, 6);
            spikes([[-19, -21 + drop], [-13, -22 + drop], [-7, -22.5 + drop], [-1, -22 + drop], [5, -20 + drop]], 6);
            head(10, -17 + drop, 5, 4, 4);
            antennae(12, -19 + drop, 9, 0.6);
            walk([7, -1, -9], -15, 14, [14, 6, -10], 1.9, false);
            break;
          }
          /* ---- the leader caste ---- */
          case 'watchlarva': {
            var wy = down ? 2 : 0;
            shell(-10, -5 + wy, 7, 4.5);
            shell(-2, -6 + wy - (step ? 1 : 0), 6, 5);
            brain(7, -10 + wy, 7, 6.5);
            eyes(10, -6 + wy, 4, 3);
            for (var wl = 0; wl < 3; wl++) E(-12 + wl * 6, -0.5 + wy, 1.5, 1.1, CHITIN_L);
            break;
          }
          case 'immwatch':
          case 'watcher':
          case 'overmind': {
            var zo = kind === 'overmind' ? 1.35 : kind === 'watcher' ? 1.12 : 0.9;
            drop = pose === 'kneel' ? 9 : down ? 9 : 0;
            walk([2 * zo, -4 * zo, -10 * zo], -10 * zo, 11 * zo, [8, 3, -6], 1.7 * zo, true);
            shell(-12 * zo, -14 * zo + drop, 9 * zo, 6 * zo, 0.1);
            ridges(-12 * zo, -14 * zo + drop, 9 * zo, 6 * zo, 3);
            shell(0, -17 * zo + drop, 6 * zo, 6 * zo);
            // the brain, held up and swollen over the body
            var bw = kind === 'immwatch' ? 0.8 : 1;
            brain(6 * zo, -30 * zo + drop * 1.1, 10 * zo * bw, 9 * zo * bw);
            if (kind === 'overmind' && !dead) {
              // tendrils hanging off it, and the pulse of what it is thinking
              [[-2, 1], [4, -1], [10, 1]].forEach(function (q, i) {
                L([[q[0] * zo, -23 * zo + drop], [(q[0] + q[1] * 2) * zo, -17 * zo + drop + (step && i % 2 ? 2 : 0)], [(q[0] - q[1]) * zo, -12 * zo + drop]], 0.9 * zo, psy.d);
              });
              E(6 * zo, -30 * zo + drop, 14 * zo, 12 * zo, 'rgba(210,170,255,' + (step ? 0.14 : 0.08) + ')');
            }
            eyes(12 * zo, -22 * zo + drop, 3.6 * zo, 3);
            mandibles(13 * zo, -19 * zo + drop, 2 * zo, 0.3);
            walk([3 * zo, -3 * zo, -9 * zo], -11 * zo, 11 * zo, [9, 4, -5], 1.9 * zo, false);
            break;
          }
        }
      }

      /* The infected: colonists taken by the fungus. The same civilian figures as
         the armed civilians, greyed, bare-handed, with the army's colour growing
         out of them — caps and shelves of it on the head, shoulders and back. */
      function paintFungus(g, ox, oy, pal, kit, pose, s) {
        var main = pal.force || pal.light, mid = pal.forceMid || pal.mid, dk = pal.forceDark || pal.dark;
        function E(cx, cy, rx, ry, c) {
          g.fillStyle = c; g.beginPath();
          g.ellipse(ox + cx * s, oy + cy * s, Math.max(0.5, rx * s), Math.max(0.5, ry * s), 0, 0, Math.PI * 2); g.fill();
        }
        function cap(x, y, r) {                            // one growth: stalk, cap, the pale gills under it
          E(x, y + r * 0.4, r * 0.35, r * 0.5, FUNGUS_CAP);
          E(x, y, r, r * 0.55, dk);
          E(x - r * 0.1, y - r * 0.12, r * 0.85, r * 0.42, mid);
          E(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.2, main);
        }
        var v = kit.fungus || 1, spots;
        if (pose === 'prone') {
          spots = [[-2, -12, 3.2], [4, -13, 2.4], [10, -11, 2.8], [-8, -9, 2]];
        } else {
          var d = pose === 'kneel' ? B.KNEEL_DROP : 0;
          spots = v === 1 ? [[-3, -66 + d, 3.4], [3, -64 + d, 2.4], [-9, -50 + d, 2.6], [8, -48 + d, 2]]
            : v === 2 ? [[4, -67 + d, 2.8], [-8, -52 + d, 3.2], [-10, -44 + d, 2.2], [9, -50 + d, 2.4]]
            : v === 3 ? [[-5, -64 + d, 2.6], [-10, -40 + d, 3], [-9, -32 + d, 2.2], [7, -49 + d, 2.6]]
            : [[0, -68 + d, 3], [-7, -61 + d, 2.2], [-10, -47 + d, 3.2], [6, -38 + d, 2]];
        }
        spots.forEach(function (q) { cap(q[0], q[1], q[2] * 1.7); });
        // spore dust hanging on it
        for (var i = 0; i < 5; i++) E(-10 + i * 5, (pose === 'prone' ? -16 : -58) - (i % 2) * 4, 0.7, 0.7, main);
      }

      /* A broken bug digs in: drawn crouched, then sunk half its height into the
         ground, with the spoil it threw up heaped round it. Returns how far down
         it went, in art units, so the muzzle can follow. */
      function burrowBug(g, w, h, ox, oy, pal, kit, step, s) {
        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        paintBug(tmp.getContext('2d'), ox, oy, pal, kit, 'prone', step, s, false);
        var px = tmp.getContext('2d').getImageData(0, 0, w, h).data;
        // its height is the body's, not an antenna's or a stray leg's: the rows at least a third as full as the fullest
        var ground = Math.min(h, Math.round(oy + s)), x0 = w, x1 = 0, rows = [], most = 0;
        for (var y = 0; y < ground; y++) {
          var n = 0;
          for (var x = 0; x < w; x++) {
            if (px[(y * w + x) * 4 + 3] > 40) {
              n++;
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
            }
          }
          rows.push(n); if (n > most) most = n;
        }
        var top = ground;
        for (var r = 0; r < rows.length; r++) if (rows[r] >= most / 3) { top = r; break; }
        if (top >= ground) { g.drawImage(tmp, 0, 0); return 0; }
        var sink = Math.round((ground - top) * 0.5);
        var cx = (x0 + x1) / 2, rx = Math.max(4 * s, (x1 - x0) / 2 + 2 * s), ry = Math.max(2 * s, rx * 0.22);
        function E(x, y, a, b, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, a, b, 0, 0, Math.PI * 2); g.fill(); }
        // the back of the spoil, then the bug in the hole, then the lip of the spoil in front of it
        E(cx, oy - ry * 0.35, rx, ry, '#4a3d2a');
        E(cx - rx * 0.1, oy - ry * 0.55, rx * 0.8, ry * 0.6, '#5f4f37');
        E(cx, oy, rx * 0.9, ry * 0.7, '#1f1911');                  // the hole
        g.save();
        g.beginPath(); g.rect(0, 0, w, oy + ry * 0.1); g.clip();
        g.drawImage(tmp, 0, sink);
        g.restore();
        g.save();
        g.beginPath(); g.rect(0, oy - ry * 0.05, w, h); g.clip();
        E(cx, oy - ry * 0.05, rx, ry * 0.75, '#5f4f37');
        g.restore();
        E(cx, oy + ry * 0.35, rx * 0.96, ry * 0.42, '#4a3d2a');
        for (var i = 0; i < 7; i++) {                               // clods thrown up
          var qx = cx - rx + (i + 0.5) * rx * 2 / 7, qy = oy + ry * (0.1 + ((i * 37) % 5) * 0.06);
          E(qx, qy, 1.3 * s, 1 * s, i % 2 ? '#3a2f20' : '#8a7654');
        }
        return sink / s;
      }
      function bugMuzzle(kit, pose) {
        var m = kit.mz || [12, -10];
        if (kit.xeno && pose === 'kneel') return [m[0], m[1] + B.XENO_LOW];
        return [m[0], m[1] + (pose === 'kneel' ? 4 : pose === 'prone' ? 9 : 0)];
      }
      /* ---------- the Overgrown: bugs the size of a tank ----------
         Built in the world like a hull is, not as a side-on sprite: each creature
         is a chain of shell segments (spheres at a height over a point along its
         heading), eight jointed legs planted around it, and its extras — jaws,
         sacs, a brain, wings. Everything is placed in inches along and across the
         heading and projected, so an Overgrown bug turns to all eight facings the
         way a vehicle does. Shells are the army's colour; legs are dark chitin. */

      function drawBigBug(g, u, opts) {
        var bb = BIGBUG[u.art], kind = bb.kind, spec3 = BUG3D[kind];
        var at = opts.at || u;
        var dead = opts.status === 'wrecked' || u.alive === false;
        var f = u.facing == null ? 0 : u.facing;
        var cos = Math.cos(f), sin = Math.sin(f);
        var fly = bb.fly && !dead ? ELEV * (hullSpec(u.art).fly || 0) : 0;
        var base = (opts.lift || 0) - (opts.hop || 0);
        var lift = base + fly;
        var step = opts.walk ? opts.walk % 2 : (bb.fly && !dead ? Math.floor((root.performance ? performance.now() : 0) / 110) % 2 : 0);
        var pal = B.PALETTE[u.paint || u.side] || B.PALETTE.A;
        var SH = dead ? { lt: '#5a5044', md: '#443c33', dk: '#26211b', gl: '#6a6052' }
          : { lt: pal.light, md: pal.mid, dk: pal.dark, gl: hexMix(pal.light, '#ffffff', 0.55) };
        var acid = dead ? { m: '#4a5a34', l: '#667a48', d: '#2e3a20' } : { m: ACID, l: ACID_L, d: ACID_D };
        var psy = dead ? { m: '#5a4e66', l: '#76688a', d: '#3a3044' } : { m: PSY, l: PSY_L, d: PSY_D };
        var eye = dead ? '#3a3a2a' : BUG_EYE;
        var sink = dead ? 0.45 : 1;                         // a dead one has sagged to the ground
        function W(t, s2) { return { x: at.x + cos * t - sin * s2, y: at.y + sin * t + cos * s2 }; }
        function S(t, s2, z) { var w = W(t, s2), q = toScreen(w.x, w.y); return { x: q.x, y: q.y - base - z, d: w.x + w.y }; }
        var parts = [];
        function add(d, fn) { parts.push({ d: d, fn: fn }); }
        function sphere(t, s2, z, r, T, outlineOnly) {
          var c = S(t, s2, z), R = r * K;
          add(c.d, function () {
            ellipse(g, c.x, c.y, R + 1.5, R * 0.86 + 1.5, '#0b0908');
            ellipse(g, c.x, c.y + R * 0.18, R * 0.95, R * 0.7, CHITIN);
            ellipse(g, c.x, c.y, R, R * 0.86, T.dk);
            ellipse(g, c.x - R * 0.05, c.y - R * 0.1, R * 0.9, R * 0.74, T.md);
            ellipse(g, c.x - R * 0.25, c.y - R * 0.38, R * 0.52, R * 0.32, T.lt);
            ellipse(g, c.x - R * 0.38, c.y - R * 0.5, R * 0.18, R * 0.11, T.gl || T.lt);
            // a plate seam across the shell, turned with the heading
            g.strokeStyle = T.dk; g.lineWidth = Math.max(1, R * 0.08);
            g.beginPath(); g.ellipse(c.x, c.y, R * 0.92, R * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
          });
          return c;
        }
        function line(pts, w, col, d) {
          add(d, function () {
            g.strokeStyle = '#0b0908'; g.lineWidth = w + 2; g.lineCap = 'round'; g.lineJoin = 'round';
            g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.stroke();
            g.strokeStyle = col; g.lineWidth = w;
            g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.stroke();
          });
        }
        // a spider's leg: up from the hip to a knee held high, then down to a point
        function leg(ta, sd, tk, tf, i) {
          var sw = step && !dead ? (i % 2 ? 0.12 : -0.12) * (sd > 0 ? 1 : -1) : 0;
          var hz = spec3.hang && !dead ? flyZ : 0;          // a flier's legs hang under it
          var a0 = S(ta, sd * spec3.side, hz + spec3.segs[Math.min(1, spec3.segs.length - 1)][1] * sink);
          var kneeZ = dead ? 10 : spec3.knee + (step && i % 2 ? 4 : 0);
          var k = S(ta + (tk - ta) * 0.5, sd * spec3.side * 2.6 * (spec3.hang ? 0.6 : 1), spec3.hang ? hz + spec3.knee : kneeZ);
          var ft = dead ? S(ta + (tf - ta) * 0.4, sd * spec3.foot * 0.55, 0) : S(tf + sw, sd * spec3.foot, spec3.hang ? hz + spec3.knee - 14 : 0);
          var w = spec3.legW, near = sd * (cos - sin) > 0 ? 0 : -1;
          var col = near ? '#130f0d' : LEGC;
          var d = (a0.d + ft.d) / 2;
          add(d - 0.3, function () {
            g.lineCap = 'round'; g.lineJoin = 'round';
            g.strokeStyle = '#0b0908'; g.lineWidth = w + 2;
            g.beginPath(); g.moveTo(a0.x, a0.y); g.lineTo(k.x, k.y); g.stroke();
            g.lineWidth = w * 0.7 + 2; g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(ft.x, ft.y); g.stroke();
            g.strokeStyle = col; g.lineWidth = w;
            g.beginPath(); g.moveTo(a0.x, a0.y); g.lineTo(k.x, k.y); g.stroke();
            g.lineWidth = w * 0.7; g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(ft.x, ft.y); g.stroke();
            if (!near) {
              g.strokeStyle = LEG_LIT; g.lineWidth = Math.max(1, w * 0.3);
              g.beginPath(); g.moveTo(a0.x, a0.y - 1); g.lineTo(k.x, k.y - 1); g.stroke();
            }
            ellipse(g, k.x, k.y, w * 0.62, w * 0.55, CHITIN_L);   // the knee joint
          });
        }

        // the shadow, and what a dead one bled
        var gp = toScreen(at.x, at.y); gp.y -= base;
        if (dead) {
          ellipse(g, gp.x, gp.y, a(9), a(3.8), 'rgba(120,150,40,.45)');
          ellipse(g, gp.x + a(2), gp.y + a(0.6), a(5), a(1.8), 'rgba(170,200,70,.4)');
        } else {
          var shr = fly ? Math.max(0.45, 1 - fly / (K * 4)) : 1;
          ellipse(g, gp.x, gp.y, a(10) * shr, a(4.4) * shr, 'rgba(12,10,8,' + (fly ? 0.2 : 0.3) + ')');
        }
        // flying: everything hangs at the flier's height
        var flyZ = fly;

        if (kind === 'sandworm') {
          /* One long worm: the tail end still under the sand behind it, the body
             rising in a curve out of the ground, and the head raised at the front
             with its mouth open towards whatever it is facing. */
          var up = dead ? 0.25 : 1, wob = step && !dead ? 3 : 0;
          var pts = [];
          for (var i = 0; i <= 16; i++) {
            var tt = i / 16;
            var along = -0.8 + tt * 1.5;
            var z = Math.max(0, Math.sin(Math.min(1, tt * 1.25) * Math.PI * 0.62) * 58 * up) + (i % 4 === 2 ? wob : 0);
            pts.push(S(along, Math.sin(tt * 3) * 0.12, z));
          }
          var mound = S(-0.8, 0, 0);
          add(mound.d - 3, function () {
            ellipse(g, mound.x, mound.y, 1.2 * K, 0.55 * K, '#4a3d2a');
            ellipse(g, mound.x - 3, mound.y - 2, 0.85 * K, 0.36 * K, '#6a5a40');
          });
          var head = pts[pts.length - 1], neck = pts[pts.length - 3];
          add((pts[0].d + head.d) / 2, function () {
            function stroke(w, col, off) {
              g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
              g.beginPath();
              pts.forEach(function (q, i) { if (i) g.lineTo(q.x, q.y - (off || 0)); else g.moveTo(q.x, q.y - (off || 0)); });
              g.stroke();
            }
            var Wd = 0.95 * K;
            stroke(Wd + 3, '#0b0908');
            stroke(Wd, SH.dk);
            stroke(Wd * 0.72, SH.md, Wd * 0.1);
            stroke(Wd * 0.26, SH.lt, Wd * 0.26);
            // the rings of its body, dark bands across it
            for (var i2 = 1; i2 < pts.length - 1; i2 += 1) {
              var p0 = pts[i2 - 1], p1 = pts[i2 + 1], q = pts[i2];
              var dx = p1.x - p0.x, dy = p1.y - p0.y, ln = Math.hypot(dx, dy) || 1;
              var nx = -dy / ln, ny = dx / ln;
              g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 1.4;
              g.beginPath(); g.moveTo(q.x + nx * Wd * 0.46, q.y + ny * Wd * 0.46); g.lineTo(q.x - nx * Wd * 0.46, q.y - ny * Wd * 0.46); g.stroke();
            }
            // the head, a blunt end with the mouth in it
            var hx = head.x + (head.x - neck.x) * 0.25, hy = head.y + (head.y - neck.y) * 0.25, hr = Wd * 0.62;
            ellipse(g, hx, hy, hr + 1.5, hr * 0.9 + 1.5, '#0b0908');
            ellipse(g, hx, hy, hr, hr * 0.9, SH.dk);
            ellipse(g, hx, hy, hr * 0.74, hr * 0.64, dead ? '#3a1e1a' : '#6a1e22');
            ellipse(g, hx, hy, hr * 0.42, hr * 0.36, dead ? '#241412' : '#2a0a0c');
            for (var th = 0; th < 8; th++) {
              var a2 = th / 8 * Math.PI * 2;
              poly(g, [[hx + Math.cos(a2) * hr * 0.74, hy + Math.sin(a2) * hr * 0.64],
                [hx + Math.cos(a2 + 0.2) * hr * 0.38, hy + Math.sin(a2 + 0.2) * hr * 0.32],
                [hx + Math.cos(a2 + 0.4) * hr * 0.74, hy + Math.sin(a2 + 0.4) * hr * 0.64]], BONE);
            }
            head.mx = hx; head.my = hy;
          });
          if (B.PH.mounts) B.PH.mounts.gun = [{ dx: head.x - gp.x, dy: head.y - gp.y - (opts.lift || 0) + base, dir: 1 }];
        } else {
          var segs3 = spec3.segs;
          // legs: eight of them, four a side
          spec3.legs.forEach(function (l, i) {
            [-1, 1].forEach(function (sd) { leg(l[0], sd, l[0] + l[1] * (l[2] > l[0] ? 1 : -1), l[2], i + (sd > 0 ? 1 : 0)); });
          });
          var zs = function (z) { return (spec3.hang ? flyZ + z : z * sink); };
          var heads = [];
          segs3.forEach(function (sg, i) {
            var isHead = i === segs3.length - 1;
            var c = sphere(sg[0], 0, zs(sg[1]), sg[2] * (dead ? 1.05 : 1), SH);
            if (isHead) heads.push({ c: c, r: sg[2] });
          });
          var hd = segs3[segs3.length - 1], hc = S(hd[0] + hd[2] * 0.55, 0, zs(hd[1]));
          // eyes on the front of the head, a row of them catching the light
          var hr = hd[2] * K;
          add(hc.d + 0.2, function () {
            for (var e = 0; e < spec3.head; e++) {
              var off = (e - (spec3.head - 1) / 2) * hr * 0.35;
              ellipse(g, hc.x + off, hc.y - hr * 0.2 - (e % 2) * 2, Math.max(1.4, hr * 0.14), Math.max(1.2, hr * 0.12), eye);
            }
          });
          // mandibles, forward of the head either side
          [-1, 1].forEach(function (sd) {
            var m0 = S(hd[0] + hd[2] * 0.7, sd * hd[2] * 0.4, zs(hd[1]) - 3);
            var m1 = S(hd[0] + hd[2] * 1.5, sd * hd[2] * 0.55, zs(hd[1]) - 6);
            var m2 = S(hd[0] + hd[2] * 1.9, sd * hd[2] * 0.15, zs(hd[1]) - 8);
            line([m0, m1, m2], Math.max(2, hd[2] * K * 0.22), sd > 0 ? BONE : BONE_D, m1.d + 0.5);
          });
          var mouth = S(spec3.mouth[0], 0, zs(spec3.mouth[1]));

          if (kind === 'firebeetle') {
            // vents glowing down its back, and a glowing throat between the jaws
            if (!dead) [[-0.8, 0.2], [-0.55, -0.2], [-0.3, 0.15]].forEach(function (v) {
              var vp = S(v[0], v[1], 22 + 0.6 * K * 0.86);
              add(vp.d + 1, function () { ellipse(g, vp.x, vp.y, 4, 2.4, '#f08a2c'); ellipse(g, vp.x, vp.y, 2, 1.2, '#ffe07a'); });
            });
            if (!dead) add(mouth.d + 1, function () { ellipse(g, mouth.x, mouth.y, 6, 4.5, 'rgba(255,150,60,.55)'); });
          } else if (kind === 'bioplasma') {
            // the plasma sac riding its back, and the long throat it lobs from
            var sc = S(-0.35, 0, 50), sr = 0.64 * K;
            add(sc.d + 2, function () {
              if (!dead) ellipse(g, sc.x, sc.y, sr * 1.3, sr * 1.15, 'rgba(150,240,110,.16)');
              ellipse(g, sc.x, sc.y, sr + 1.5, sr * 0.86 + 1.5, '#0b0908');
              ellipse(g, sc.x, sc.y, sr, sr * 0.86, acid.d);
              ellipse(g, sc.x - 2, sc.y - 3, sr * 0.86, sr * 0.72, acid.m);
              ellipse(g, sc.x - sr * 0.3, sc.y - sr * 0.4, sr * 0.36, sr * 0.24, acid.l);
              g.strokeStyle = acid.d; g.lineWidth = 1.2;
              g.beginPath(); g.moveTo(sc.x - sr * 0.8, sc.y); g.quadraticCurveTo(sc.x, sc.y - sr * 0.6, sc.x + sr * 0.8, sc.y - sr * 0.1); g.stroke();
            });
            var th0 = S(0.65, 0, 26), th1 = S(0.95, 0, 42);
            line([th0, th1, mouth], 7, SH.dk, mouth.d + 0.6);
            add(mouth.d + 0.7, function () { ellipse(g, mouth.x, mouth.y, 4, 3.2, acid.l); });
          } else if (kind === 'shadow') {
            // the scythes, raised over the head
            [-1, 1].forEach(function (sd) {
              var s0 = S(0.1, sd * 0.22, 64), s1 = S(0.32, sd * 0.3, 96 - (step ? 4 : 0)), s2 = S(0.8, sd * 0.28, 58);
              line([s0, s1], 4.5, LEGC, s1.d + (sd * (cos - sin) > 0 ? 1 : -1));
              line([s1, s2], 5, sd > 0 ? BONE : BONE_D, s1.d + (sd * (cos - sin) > 0 ? 1.1 : -0.9));
            });
          } else if (kind === 'queen') {
            // the brain, swollen up out of the back of the head, and eggs on the abdomen
            var bc = S(hd[0] - hd[2] * 1.0, 0, zs(hd[1]) + hr * 1.35), br = 0.52 * K;
            add(Math.max(bc.d, hc.d) + 0.3, function () {
              // drawn as the brain bugs' brains are: glow, lobes, four folds, a shine
              var qb = dead ? 0 : Math.sin(nowT() / 2000 * Math.PI * 2);        // its slow beat
              var rx = br * (1 + 0.05 * qb), ry = br * 0.9 * (1 + 0.05 * qb), cx = bc.x, cy = bc.y;
              if (!dead) ellipse(g, cx, cy, rx * (1.3 + 0.08 * qb), ry * (1.3 + 0.08 * qb), 'rgba(185,140,242,' + (0.2 + 0.1 * qb).toFixed(3) + ')');
              ellipse(g, cx, cy, rx, ry, psy.d);
              ellipse(g, cx - rx * 0.05, cy - ry * 0.08, rx * 0.9, ry * 0.84, psy.m);
              g.strokeStyle = psy.d; g.lineWidth = Math.max(1, rx * 0.1); g.lineCap = 'round'; g.lineJoin = 'round';
              for (var fo = 0; fo < 4; fo++) {
                var yy = cy - ry * 0.6 + fo * ry * 0.38;
                g.beginPath(); g.moveTo(cx - rx * 0.7, yy); g.lineTo(cx - rx * 0.3, yy - ry * 0.18);
                g.lineTo(cx + rx * 0.1, yy + ry * 0.05); g.lineTo(cx + rx * 0.6, yy - ry * 0.15); g.stroke();
              }
              ellipse(g, cx - rx * 0.3, cy - ry * 0.5, rx * 0.3, ry * 0.2, psy.l);
            });
            if (!dead) [[-1.2, 0.3], [-1.0, -0.35], [-0.75, 0.1]].forEach(function (e2) {
              var ep = S(e2[0], e2[1], 26 + 0.5 * K);
              add(ep.d + 1, function () { ellipse(g, ep.x, ep.y, 4, 3, 'rgba(236,232,200,.8)'); });
            });
          } else if (kind === 'carrier') {
            // gas blisters on top, a pouch of swarm under it, and the wings
            [[-0.5, 0.2], [-0.05, -0.25], [0.35, 0.18]].forEach(function (b2) {
              var bp = S(b2[0], b2[1], flyZ + 26);
              add(bp.d + 2, function () {
                ellipse(g, bp.x, bp.y, 9, 7, dead ? '#5a5a4a' : 'rgba(226,210,160,.9)');
                ellipse(g, bp.x - 2, bp.y - 2, 4, 2.4, dead ? '#6a6a5a' : 'rgba(255,248,220,.95)');
              });
            });
            var pp = S(-0.15, 0, flyZ - 20);
            add(pp.d - 1, function () {
              ellipse(g, pp.x, pp.y, 22, 12, acid.d); ellipse(g, pp.x, pp.y - 1, 19, 9, SH.dk);
              for (var bb2 = 0; bb2 < 5; bb2++) ellipse(g, pp.x - 12 + bb2 * 6, pp.y - 1 + (bb2 % 2) * 2, 2.2, 1.7, eye);
            });
            if (!dead) [-1, 1].forEach(function (sd) {
              var w0 = S(0, sd * 0.4, flyZ + 22), w1 = S(-0.2, sd * 1.9, flyZ + 22 + (step ? 26 : 6));
              add(w0.d + (sd * (cos - sin) > 0 ? 3 : -3), function () {
                g.save();
                g.fillStyle = 'rgba(214,230,228,.38)'; g.strokeStyle = 'rgba(40,40,36,.45)'; g.lineWidth = 1;
                var mx = (w0.x + w1.x) / 2, my = (w0.y + w1.y) / 2, ln = Math.hypot(w1.x - w0.x, w1.y - w0.y);
                g.translate(mx, my); g.rotate(Math.atan2(w1.y - w0.y, w1.x - w0.x));
                g.beginPath(); g.ellipse(0, 0, ln * 0.6, ln * 0.2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
                g.restore();
              });
            });
          }
          if (B.PH.mounts) {
            B.PH.mounts.gun = [{ dx: mouth.x - gp.x, dy: mouth.y - gp.y - (opts.lift || 0) + base, dir: (cos - sin) >= 0 ? 1 : -1 }];
            if (kind === 'firebeetle') B.PH.mounts.flame = B.PH.mounts.gun;
            // what it sees with: its eyes, on the front of the head (a Keen-Eyed glint comes off them)
            B.PH.mounts.scan = [{ dx: hc.x - gp.x, dy: hc.y - hr * 0.2 - gp.y - (opts.lift || 0) + base, dir: (cos - sin) >= 0 ? 1 : -1 }];
          }
        }

        parts.sort(function (p1, p2) { return p1.d - p2.d; }).forEach(function (p1) { p1.fn(); });

        if (u.damage && u.str && !dead) {
          var dr2 = rng((u.id || 'x').length * 977 + u.damage * 31);
          for (var d = 0; d < u.damage * 3; d++) {
            dot(g, gp.x + (dr2() - 0.5) * a(12), gp.y - fly - a(3) - dr2() * bb.h * 0.5, dr2() > 0.5 ? '#9ad24a' : '#5a7a24', 2);
          }
        }
        return { lift: lift, hgt: dead ? bb.h * 0.45 : bb.h };
      }
      /* The ichor steaming off a dead Overgrown, in place of a burning wreck. */
      function carcassSteam(g, sx, sy, t, seed) {
        var A1 = A, sd = (seed || 0) % 97;
        for (var i = 0; i < 6; i++) {
          var life = ((t / 4200) + i / 6 + sd * 0.013) % 1;
          var px = sx + (i - 2.5) * 1.1 * A1 + Math.sin(life * 4 + i) * 0.8 * A1;
          var py = sy - life * 12 * A1;
          var r = (1 + life * 2.6) * A1;
          g.fillStyle = 'rgba(176,206,140,' + (0.3 * (1 - life) * Math.min(1, life * 6)).toFixed(3) + ')';
          g.beginPath(); g.ellipse(px, py, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
        }
      }

    return {
      deadBug: deadBug, paintBug: paintBug, paintFungus: paintFungus, burrowBug: burrowBug,
      bugMuzzle: bugMuzzle, drawBigBug: drawBigBug, carcassSteam: carcassSteam
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCIsoBugs;
})(typeof window !== 'undefined' ? window : global);
