/* PMC 2670 — Firefight : the alien races: the Space Bugs from larva to the Overgrown the size of a tank, and the Xenotripods with their shields, their cloaks and their dead - each drawn in its own way, and the sprite() every figure on the table is fetched through.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoAliens = function (B) {
    var a = B.a, dot = B.dot, ellipse = B.ellipse, fbm = B.fbm, hullSpec = B.hullSpec, poly = B.poly;
    var rng = B.rng, toScreen = B.toScreen, A = B.A, ELEV = B.ELEV, K = B.K, PH = B.PH, W = B.W;
    // from modules installed after this one: looked up when called
    function eyeArt() { return B.eyeArt.apply(this, arguments); }
    function finishFigure() { return B.finishFigure.apply(this, arguments); }
    function hex3() { return B.hex3.apply(this, arguments); }
    function muzzleArt() { return B.muzzleArt.apply(this, arguments); }
    function paintFigure() { return B.paintFigure.apply(this, arguments); }
    function podArt() { return B.podArt.apply(this, arguments); }
    function roleAt() { return B.roleAt.apply(this, arguments); }
    function sp2() { return B.sp2.apply(this, arguments); }
    function vividHex() { return B.vividHex.apply(this, arguments); }

    /* ---------- the Space Bugs ----------
       Not men, so not paintFigure. Each bug is drawn side-on facing right, like a
       trooper, in the same art units (feet on y = 0, up is negative), and goes
       through the same outline, shadow and cache as a figure does. The shells are
       the army's colour; legs, bellies and joints are dark chitin; acid glows
       green, and the leader-caste brains glow violet. Poses: 'stand' (with a
       step frame), 'kneel' — suppressed, hunkered down low — and 'prone', broken
       or dead, sprawled with the legs drawn in. */
    var CHITIN = '#211915', CHITIN_L = '#3a2d24', LEGC = '#1a1411', LEG_LIT = '#4a3a2e';
    var BONE = '#dcd2b0', BONE_D = '#9d9174', BUG_EYE = '#f2f07a', BUG_EYE_D = '#9aa832';
    var ACID = '#8fd84a', ACID_L = '#d8ff96', ACID_D = '#4f8a24';
    var PSY = '#b98cf2', PSY_L = '#eedcff', PSY_D = '#6b4a9a';
    var FUNGUS_CAP = '#e9e2c6';
    function hexMix(c1, c2, k) {
      function p(h, i) { return parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); }
      var o = '#';
      for (var i = 0; i < 3; i++) o += ('0' + Math.round(p(c1, i) + (p(c2, i) - p(c1, i)) * k).toString(16)).slice(-2);
      return o;
    }

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

    /* ---------- the Overgrown: bugs the size of a tank ----------
       Drawn with the same brush as the swarm, a size up, and cached as one sprite
       per side, pose and direction — they turn to the screen, left or right, the
       way their heading points. Each is a creature, so it has no turret and no
       tracks: where a machine's gun would be, its weapon is its mouth. */
    // where a bug's spit or spines leave it, in art units from its feet
    /* ---------- the Xenotripods ----------
       Crocks and their Esh-Aven, drawn side-on facing right in the figure's own
       art units (feet on y = 0, up negative), through the same outline, rim light
       and cache as a trooper. The Crocks are armoured in ivory-white ceramic,
       and the army's colour is the light in it — eyes, seams, weapon cells. An
       Alpha's plates are trimmed in gold. The Esh-Aven are ash-grey gargoyles in a
       few white plates, with the army's colour on their shoulders and weapons. */
    var XW = { lt: '#f5f3eb', md: '#dedbd0', dk: '#b0ac9f', sh: '#7e7b71', seam: '#46443e' };
    var XGOLD = { lt: '#f4dc8e', md: '#d6b054', dk: '#8f6c24' };
    var XFLESH = { lt: '#cfc3cf', md: '#a99bab', dk: '#6d6070' };
    var XASH = { lt: '#a7a7a1', md: '#83837e', dk: '#555553', sh: '#3a3a3a' };
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
    var BIGBUG = {
      bugfirebeetle: { kind: 'firebeetle', h: 44 },
      bugsandworm: { kind: 'sandworm', h: 72 },
      bugbioplasma: { kind: 'bioplasma', h: 66 },
      bugshadow: { kind: 'shadow', h: 96 },
      bugqueen: { kind: 'queen', h: 92 },
      bugcarrier: { kind: 'carrier', h: 48, fly: true }
    };
    // segments: [along, height px, radius inch]; legs: [attach along, knee reach, foot along]
    var BUG3D = {
      firebeetle: {
        segs: [[-0.62, 22, 0.66], [0.1, 22, 0.44], [0.62, 18, 0.3]],
        legs: [[0.32, 0.7, 0.85], [0.1, 0.8, 0.35], [-0.2, 0.85, -0.3], [-0.5, 0.8, -0.95]], side: 0.36, knee: 40, foot: 1.15, legW: 4.2,
        head: 2, mouth: [0.95, 16]
      },
      bioplasma: {
        segs: [[-0.55, 20, 0.58], [0.12, 21, 0.42], [0.6, 22, 0.28]],
        legs: [[0.32, 0.7, 0.8], [0.1, 0.8, 0.3], [-0.2, 0.85, -0.3], [-0.5, 0.8, -0.95]], side: 0.34, knee: 38, foot: 1.1, legW: 3.9,
        head: 2, mouth: [1.12, 50]
      },
      shadow: {
        segs: [[-0.7, 40, 0.34], [-0.35, 42, 0.36], [0, 48, 0.26], [0.08, 62, 0.22], [0.2, 76, 0.2]],
        legs: [[0.02, 0.6, 0.7], [-0.15, 0.75, 0.25], [-0.35, 0.8, -0.35], [-0.6, 0.75, -1.0]], side: 0.2, knee: 70, foot: 1.35, legW: 3.4,
        head: 4, mouth: [0.42, 74]
      },
      queen: {
        segs: [[-1.05, 26, 0.72], [-0.45, 32, 0.66], [0.25, 40, 0.44], [0.72, 46, 0.3]],
        legs: [[0.4, 0.75, 1.0], [0.18, 0.9, 0.45], [-0.15, 0.95, -0.35], [-0.5, 0.9, -1.1]], side: 0.4, knee: 58, foot: 1.35, legW: 4.8,
        head: 3, mouth: [1.08, 42]
      },
      carrier: {
        segs: [[-0.8, 0, 0.5], [-0.2, 4, 0.78], [0.5, 2, 0.6], [1.05, 0, 0.3]],
        legs: [[0.4, 0.4, 0.6], [0, 0.45, 0.1], [-0.4, 0.4, -0.4]], side: 0.4, knee: -14, foot: 0.55, legW: 2.6, hang: true,
        head: 3, mouth: [1.3, -2]
      }
    };

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

    /* Two-tone camouflage: every pixel painted in one of the uniform's own
       tones is over-printed in black where a coarse blotch pattern says so, so
       the pattern follows the cloth and never touches skin, kit or helmet. */
    function applyCamo(cv, tint, s) {
      var g = cv.getContext('2d'), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
      var keys = ['light', 'mid', 'dark', 'helm', 'cloth'].map(function (k) { return hex3(tint[k]); });
      var black = [[40, 44, 38], [28, 31, 27], [16, 18, 15], [22, 25, 21], [20, 22, 19]];
      for (var y = 0; y < cv.height; y++) {
        for (var x = 0; x < cv.width; x++) {
          var o = (y * cv.width + x) * 4;
          if (d[o + 3] < 200) continue;
          var best = -1, bd = 22 * 22 * 3;
          for (var k = 0; k < keys.length; k++) {
            var dr = d[o] - keys[k][0], dg = d[o + 1] - keys[k][1], db = d[o + 2] - keys[k][2];
            var dist = dr * dr + dg * dg + db * db;
            if (dist < bd) { bd = dist; best = k; }
          }
          if (best < 0) continue;
          // blotches a few art units across, stretched a little sideways
          var n = fbm(x / (s * 5.5), y / (s * 4.2), 71, 2);
          if (n > 0.54) { d[o] = black[best][0]; d[o + 1] = black[best][1]; d[o + 2] = black[best][2]; }
        }
      }
      g.putImageData(im, 0, 0);
    }
    var SHIELD_PHASES = 8;
    var BRAIN_PHASES = 10;
    // a flamer's pilot light flickers through FLAME_PHASES baked states (-1: not burning)
    var FLAME_PHASES = 4;
    var WING_PHASES = 6;
    function winged(kit) { return !!kit && !!kit.bug && !!kit.fly; }
    function brainy(kit) { return !!kit && ['watchlarva', 'immwatch', 'watcher', 'overmind'].indexOf(kit.bug) >= 0; }
    function nowT() { return root.performance ? performance.now() : 0; }
    function shieldAnimated(kit) { return !!kit && kit.xeno === 'crock' && (kit.rank || 'beta') === 'beta'; }
    function cloakedKit(kit) { return !!kit && !!kit.xeno && !!kit.cloak; }
    /* A cloaked model fades in and out between whole and a quarter there, each at
       its own beat so the squad shimmers rather than blinking as one. */
    function cloakFade(mi) { return 0.625 + 0.375 * Math.sin(nowT() / 700 + mi * 1.7); }
    // whether a unit is drawn differently from one moment to the next, so the board keeps redrawing it
    function animates(u) {
      if (!u || u.alive === false) return false;          // (a bench unit need not say it is alive)
      if (u.cls === 'aircraft') return true;
      if (u.cls === 'vehicle' && /queen/.test(u.art || '')) return true;   // the queen's brain beats too
      if (u.art === 'engflame') return true;                                // the flame gun's pilot light
      if (u.drone && (u.cls === 'vehicle' || u.cls === 'aircraft')) return true;   // a drone's aerial light blinks
      return (B.ROLES[u.art] || []).some(function (r) { return shieldAnimated(B.KIT[r]) || cloakedKit(B.KIT[r]) || brainy(B.KIT[r]) || winged(B.KIT[r]) || (B.KIT[r] && B.KIT[r].gun === 'flamer'); });
    }
    function sprite(side, art, i, pose, step, scale, shade, mountKind) {
      var role = roleAt(art, i);
      var kit = B.KIT[role] || B.KIT.rifle;
      // a rider on something other than the bike: the same kit, a different mount
      if (kit.mount && mountKind && mountKind !== 'bike' && mountKind !== 'none') {
        var mk = {}; for (var kk in kit) mk[kk] = kit[kk];
        mk.mount = mountKind; kit = mk;
      } else mountKind = null;
      /* Kneeling and lying down are firing positions, not poses a figure holds
         while it crosses the table: a gun crew that is moving is up on its feet.
         So a kit that kneels or goes prone does so only when it is standing still,
         and every figure has a step frame when the unit is on the move. */
      if (pose === 'stand' && !step) {
        if (kit.prone) pose = 'prone';
        else if (kit.kneel) pose = 'kneel';
      }
      if (pose !== 'stand') step = 0;
      // a man flat in the dirt is drawn a size up to read; a bug that has gone to ground is not
      if (pose === 'prone' && !kit.bug) scale *= 1.25;
      var sq = Math.round(scale * 60) / 60;
      // a Beta's deflector is baked in SHIELD_PHASES states, one for each beat of its light
      var shieldy = shieldAnimated(kit) && !PH.corpse;
      if (shieldy) PH.shield = Math.floor(nowT() / 110) % SHIELD_PHASES;
      // a leader bug's brain beats slowly, about once in two seconds
      var thinking = brainy(kit);
      if (thinking) PH.brain = Math.floor(nowT() / 200) % BRAIN_PHASES;
      // a winged bug's wings beat, about four times a second, unless it has gone to ground
      var flapping = winged(kit) && pose !== 'prone';
      PH.wing = flapping ? (Math.floor(nowT() / 40) + i * 2) % WING_PHASES : -1;   // each bug at its own beat
      // a flamer's pilot light flickers, each man's at his own beat
      var burning = kit.gun === 'flamer' && !PH.corpse;
      PH.flame = burning ? (Math.floor(nowT() / 90) + i) % FLAME_PHASES : -1;
      var key = side + '|' + role + '|' + pose + '|' + step + '|' + sq + '|' + shade + (mountKind ? '|' + mountKind : '') + (shieldy ? '|sp' + PH.shield : '') + (thinking ? '|bp' + PH.brain : '') + (flapping ? '|wp' + PH.wing : '') + (burning ? '|fp' + PH.flame : '') + (PH.corpse ? '|corpse' : '');
      var c = B.sprites[key];
      if (c) return c;

      var s = B.SU * sq * B.SPRITE_RES;
      var w = Math.ceil(B.SPR.w * s), h = Math.ceil(B.SPR.h * s);
      var ma = kit.bug || kit.xeno ? bugMuzzle(kit, pose) : muzzleArt(kit, pose);
      var ox = Math.round(B.SPR.ox * s), oy = Math.round(B.SPR.oy * s);

      // paint the figure, then ring it in near-black so it reads against the rank behind
      var body = document.createElement('canvas');
      body.width = w; body.height = h;
      var pal = B.PALETTE[side] || B.PALETTE.A;
      if (kit.tint) {                                    // penal coveralls and the like
        var mixed = {};
        for (var pk in pal) mixed[pk] = kit.tint[pk] || pal[pk];
        mixed.force = pal.light;                         // the company's colour still shows
        mixed.forceMid = pal.mid; mixed.forceDark = pal.dark;
        /* On a rebel the company colour is the one bright thing about them —
           armband, helmet, belt or flag — so it is pushed to full strength. */
        if (kit.tint.rebel) {
          mixed.isRebel = true;
          // helmets in the side's colour, a touch less loud than the armbands
          mixed.helmForce = vividHex(pal.mid, 1.3, 1.04);
          mixed.helmLit = vividHex(pal.light, 1.3, 1.0);
          mixed.helmDark = pal.dark;
          mixed.force = vividHex(pal.light, 1.9, 1.05);
          mixed.forceMid = vividHex(pal.mid, 1.9, 1.12);
          mixed.forceDark = vividHex(pal.dark, 1.7, 1.1);
        }
        pal = mixed;
      }
      // a helmet painted in the company's colour, whatever the rest of the kit is
      // a helmet painted in the company's colour — the helmet alone, not the pads
      if (kit.redHelm) {                                 // a red helmet, whatever the side's colour
        var rh = {};
        for (var rk in pal) rh[rk] = pal[rk];
        rh.hat = '#a8322a'; rh.hatLit = '#d0584a'; rh.hatDark = '#5c1a16';
        pal = rh;
      }
      if (kit.forceHelm) {
        var hp = {};
        for (var hk in pal) hp[hk] = pal[hk];
        hp.hat = pal.helmForce || pal.forceMid || pal.mid; hp.hatLit = pal.helmLit || pal.force || pal.light; hp.hatDark = pal.helmDark || pal.forceDark || pal.dark;
        pal = hp;
      }
      if (kit.bug && PH.corpse) deadBug(body.getContext('2d'), w, h, ox, oy, pal, kit, s);
      else if (kit.bug && pose === 'prone' && !kit.fly && kit.bug !== 'under' && kit.bug !== 'hugeunder') {
        ma = [ma[0], ma[1] + burrowBug(body.getContext('2d'), w, h, ox, oy, pal, kit, step, s)];
      } else if (kit.bug) paintBug(body.getContext('2d'), ox, oy, pal, kit, pose, step, s, false);
      else if (kit.xeno) {
        paintXeno(body.getContext('2d'), ox, oy, pal, kit, pose, step, s, false);
        finishFigure(body, ox, oy, s, pose);
      } else {
        paintFigure(body.getContext('2d'), ox, oy, pal, kit, pose, step, s);
        finishFigure(body, ox, oy, s, pose);
        if (kit.camo) applyCamo(body, kit.tint, s);
        if (kit.fungus) paintFungus(body.getContext('2d'), ox, oy, pal, kit, pose, s);
      }

      var sil = document.createElement('canvas');
      sil.width = w; sil.height = h;
      var sg = sil.getContext('2d');
      sg.drawImage(body, 0, 0);
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = '#080a0e';
      sg.fillRect(0, 0, w, h);

      c = document.createElement('canvas');
      c.width = w; c.height = h;
      var g = c.getContext('2d');
      // the model's own shadow is baked in, so a rank costs one blit per model
      ellipse(g, ox + 2 * s, oy, 13 * s, 5 * s, 'rgba(12,10,8,.34)');
      var o = Math.max(1, Math.round(s));
      g.globalAlpha = 0.55;                              // a touch of separation up-light
      g.drawImage(sil, -o, 0); g.drawImage(sil, 0, -o);
      g.globalAlpha = 1;
      g.drawImage(sil, o, 0); g.drawImage(sil, 0, o);    // the shadow side, solid
      g.drawImage(body, 0, 0);
      if (shade) {                                       // ranks behind sit in shadow
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(8,10,14,' + (shade >= 3 ? 0.46 + (shade - 3) * 0.05 : shade * 0.16) + ')';
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
      }
      c.ox = ox; c.oy = oy; c.res = B.SPRITE_RES;
      c.muz = [ma[0] * B.SU * sq, ma[1] * B.SU * sq];      // the muzzle, in board pixels from the feet
      var pa = kit.bug || kit.xeno ? null : podArt(kit, pose), ea = kit.bug || kit.xeno ? null : eyeArt(kit, pose);
      c.pod = pa ? [pa[0] * B.SU * sq, pa[1] * B.SU * sq] : null;
      c.eye = ea ? [ea[0] * B.SU * sq, ea[1] * B.SU * sq] : null;
      // a man whose hands hold optics, a slate or a case is not one of the guns
      c.tool = /^(optics|slate|case|console)$/.test(kit.gun || '');
      c.gun = kit.gun || null;                          // which weapon the man holds, for which shots he fires
      B.sprites[key] = c;
      return c;
    }


    return {
      BIGBUG: BIGBUG,
      XW: XW,
      animates: animates,
      carcassSteam: carcassSteam,
      cloakFade: cloakFade,
      cloakedKit: cloakedKit,
      drawBigBug: drawBigBug,
      hexA: hexA,
      hexMix: hexMix,
      sprite: sprite,
      xenoGlow: xenoGlow
    };
  };
})(window);
