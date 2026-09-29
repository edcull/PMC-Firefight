/* PMC 2670 — Firefight : the running gear: wheels, tracks, legs, grav pods and drop pods

   Made by iso-machines.js for each machine it draws: drawMachineBody hands
   over what it has worked out for that machine (M) and the drawing kit its
   pieces share, and gets back the drawing functions below. */
(function (root) {
  'use strict';
  root.PMCIsoGear = function (P) {
    var K = P.K, MACHINE = P.MACHINE, bandOnSides = P.bandOnSides, dot = P.dot, ellipse = P.ellipse,
        hull2d = P.hull2d, poly = P.poly, project = P.project, rect = P.rect, taper = P.taper,
        thickLine = P.thickLine, toScreen = P.toScreen;
    return function (M) {
      var HF = M.HF, S3 = M.S3, STEEL = M.STEEL, STEEL_LIT = M.STEEL_LIT, TB = M.TB, TS = M.TS, at = M.at,
          box = M.box, cos = M.cos, dark = M.dark, dead = M.dead, deck = M.deck, drive = M.drive, f = M.f,
          frameAt = M.frameAt, g = M.g, hull = M.hull, lift = M.lift, line = M.line, lit = M.lit,
          mixc = M.mixc, opts = M.opts, rectPts = M.rectPts, ride = M.ride, sEllipse = M.sEllipse,
          scr = M.scr, shape = M.shape, sin = M.sin, slabF = M.slabF, spec = M.spec, trim = M.trim;
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

      /* The lower box of each hull body, as iso-hulls builds it: its ends along
         the hull (a0, a1, of the length), its half-width (of w, 0.47 of the
         width), its height (of spec.hgt), and how far its top is pulled in at the
         front, the back (of the length) and the sides (of w). A body built of
         several parts (the pickup, the trucks) gives its bed, the long low box
         the rest stands on; the faceted 'future' hull gives its widest flanks. */
      function lowerHull(st) {
        var b = st.body;
        if (b === 'box' || b === 'bigbox' || b === 'ifv')
          return { a0: -0.5, a1: 0.5, half: 1, h: b === 'bigbox' ? 1.08 : b === 'ifv' ? 0.85 : 1, frontIn: b === 'ifv' ? 0.3 : 0.24, backIn: 0.004, sideIn: 0.04 };
        if (b === 'mlrs') return { a0: -0.5, a1: 0.5, half: 1, h: 0.55, frontIn: 0.04, backIn: 0, sideIn: 0.03 };
        /* the faceted hull's front corners are chamfered: its sponson's front face
           runs from the nose corner and the chamfer's top edge down to the plate */
        if (b === 'future') return { a0: -0.44, a1: 0.36, half: 1, h: 0.9, topA1: 0.06, topA0: -0.42, topHalf: 0.86,
          noseFoot: [0.5, 0.5], noseTop: [0.14, 0.46], outFront: 0.3 };
        /* the car body slopes in all round from a low waist: its sponson comes up
           only half its height, to where the sloping sides have come in by then */
        if (b === 'car') return { a0: -0.46, a1: 0.46, half: 0.82, h: 0.45, dz: -2, frontIn: 0.2 * 0.45, backIn: 0.12 * 0.45, sideIn: 0.12 * 0.45 };
        if (b === 'pickup') return { a0: -0.5, a1: 0.5, half: 1, h: 0.45, frontIn: 0, backIn: 0, sideIn: 0 };
        if (b === 'truck' || b === 'guntruck') return { a0: -0.5, a1: 0.5, half: 1, h: 0.4, frontIn: 0, backIn: 0, sideIn: 0 };
        var mbt = b === 'mbt';                            // a tank: the low hull with its sloped glacis
        return { a0: -0.5, a1: 0.5, half: 0.94, h: mbt ? 0.8 : 0.88, frontIn: mbt ? 0.26 : 0.2, backIn: 0.05, sideIn: 0.03 };
      }

      /* Hex tiles on a sponson's sloping face, laid as the hull's flank lays them
         (hexFlank): tiles a step of 0.12 of the length apart, two rows set half a
         step between each other, each tile's side points just meeting the next.
         Each tile is square to the hull, not stretched to the plate's tapered ends
         (its foot runs bR..bF, its top tR..tF), and only a tile wholly on the plate
         is laid. */
      function sponsonHex(bR, bF, tR, tF, sOut, sTop, zBot, zTop) {
        var step = spec.len * 0.12, lo = Math.min(bR, tR), hi = Math.max(bF, tF);
        var n = Math.floor((hi - lo) / step), a0 = lo + ((hi - lo) - n * step) / 2;
        function P(a, u) { return S3(HF(a, sOut + (sTop - sOut) * u), zBot + (zTop - zBot) * u); }
        function onPlate(a, u) { return a >= bR + (tR - bR) * u - 1e-6 && a <= bF + (tF - bF) * u + 1e-6; }
        for (var r = 0; r < 2; r++) {
          for (var i = -1; i <= n; i++) {
            var ca = a0 + step * (i + 0.5 + (r ? 0.5 : 0)), cu = r ? 0.3 : 0.72;
            var pts = [], fits = true;
            for (var k = 0; k < 6; k++) {
              var ang = k * Math.PI / 3, va = ca + Math.cos(ang) * step * 0.46, vu = cu + Math.sin(ang) * 0.24;
              if (!onPlate(va, vu)) fits = false;
              pts.push(P(va, vu));
            }
            if (!fits) continue;
            poly(g, pts, 'rgba(255,248,232,.07)');
            for (var e2 = 0; e2 < 6; e2++) line(pts[e2], pts[(e2 + 1) % 6], 0.6, 'rgba(10,12,16,.35)', 'butt');
          }
        }
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
        /* A sponson over each row of pods: a sloping side plate from the hull's
           top edge down and out over the housings, its front end raked back with
           the glacis and its tail closed, in the hull's own paint. It stops at the
           top of the pods, so the housings and their light show under it. */
        if (!spec.style) return;
        [-1, 1].forEach(function (sd) {
          if (!want(phase, sd)) return;
          var L = spec.len, W = spec.wid, w = W * 0.47, hb = lowerHull(spec.style);
          /* Pinned to the hull's own lower box (lowerHull): the plate's top edge is
             the hull's top edge, corner to corner, and its inner foot the hull's
             bottom edge, so the corners meet the hull's whatever its body. */
          var zBot = deck + (hb.dz || 0), zTop = zBot + spec.hgt * hb.h;
          var sFoot = sd * w * hb.half, sTop = sd * w * (hb.topHalf != null ? hb.topHalf : hb.half - hb.sideIn);
          var fFoot = L * hb.a1, bFoot = L * hb.a0;
          var tNose = L * (hb.topA1 != null ? hb.topA1 : hb.a1 - hb.frontIn), tTail = L * (hb.topA0 != null ? hb.topA0 : hb.a0 + hb.backIn);
          var sOut = sd * Math.max(w * hb.half + W * 0.05, W * 0.5 + gearOut() * 1.1);
          // the foot: the hull's bottom edge inside, the plate's lower edge outside, its front angled back
          var base = [[fFoot, sFoot], [hb.outFront != null ? L * hb.outFront : fFoot - L * 0.2, sOut], [bFoot + L * 0.08, sOut], [bFoot, sFoot]];
          // the top closes to the hull's top edge, so each end is a triangle to the hull's corners
          var top = [[tNose, sTop], [tNose, sTop], [tTail, sTop], [tTail, sTop]];
          if (hb.noseFoot) {                              // a chamfered nose: the front face meets the chamfer
            base[0] = [L * hb.noseFoot[0], sd * w * hb.noseFoot[1]];
            top[0] = [L * hb.noseTop[0], sd * w * hb.noseTop[1]];
          }
          shape(HF, base, zBot, zTop - zBot, TB, null, top, true);
          // a hull armoured in hex tiles carries them on across its sponsons' outer faces
          if ((spec.style.hex || spec.style.body === 'future') && (sideNear(sd) || Math.abs(cos - sin) < 0.2))
            sponsonHex(base[2][0], base[1][0], top[2][0], top[1][0], sOut, sTop, zBot, zTop);
        });
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

      return { want: want, gearOut: gearOut, alongOrder: alongOrder, drawGlow: drawGlow, drawGear: drawGear, dropBody: dropBody, dropHatch: dropHatch, wheelGeom: wheelGeom, walkLegs: walkLegs };
    };
  };
})(window);
