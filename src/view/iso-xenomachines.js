/* PMC 2670 — Firefight : the Xenotripods' machines: the Crocks' grav hulls, shield generators, turrets and telecraft

   Made once by iso-machines.js, the first time it is wanted. E is what it needs
   of iso-machines.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCIsoXenoMachines = function (E) {
    var B = E.B, ELEV = E.ELEV, K = E.K, PH = E.PH, XENO3D = E.XENO3D, ellipse = E.ellipse,
        ellipseRing = E.ellipseRing, hexA = E.hexA, hexMix = E.hexMix, hullSpec = E.hullSpec, poly = E.poly,
        rect = E.rect, root = E.root, toScreen = E.toScreen, xenoGlow = E.xenoGlow;
      function drawXenoMachine(g, u, opts) {
        var spec = XENO3D[u.art], hs = hullSpec(u.art);
        function m(n) { return Math.max(1, n * 1.6); }   // hull pixels, on the machines' own scale
        var at = opts.at || u;
        var dead = opts.status === 'wrecked' || u.alive === false;
        var f = u.facing == null ? 0 : u.facing, cos = Math.cos(f), sin = Math.sin(f);
        var base = (opts.lift || 0) - (opts.hop || 0);
        var fly = hs.fly && !dead ? ELEV * hs.fly : 0;
        var lift = base + fly;
        var pal = B.PALETTE[u.paint || u.side] || B.PALETTE.A;
        var WH = dead ? { lt: '#6e6a62', md: '#5c5952', dk: '#45423d', sh: '#302e2a', seam: '#1e1d1a' } : B.XW;
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

    return {
      drawXenoMachine: drawXenoMachine
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCIsoXenoMachines;
})(typeof window !== 'undefined' ? window : global);
