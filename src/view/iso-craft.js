/* PMC 2670 — Firefight : the aircraft: ducted-fan craft

   Made by iso-machines.js for each machine it draws: drawMachineBody hands
   over what it has worked out for that machine (M) and the drawing kit its
   pieces share, and gets back the drawing functions below. */
(function (root) {
  'use strict';
  root.PMCIsoCraft = function (P) {
    var K = P.K, bandOnSides = P.bandOnSides, edge = P.edge, poly = P.poly;
    return function (M) {
      var AIM = M.AIM, GLASS = M.GLASS, GLINT = M.GLINT, HF = M.HF, S3 = M.S3, STEEL = M.STEEL,
          STEEL_LIT = M.STEEL_LIT, TB = M.TB, TS = M.TS, aerial = M.aerial, barrel = M.barrel, box = M.box,
          cos = M.cos, dark = M.dark, dead = M.dead, drawDamage = M.drawDamage, frameAt = M.frameAt, g = M.g,
          hull = M.hull, launcher = M.launcher, lift = M.lift, line = M.line, lit = M.lit, mixc = M.mixc,
          mount = M.mount, nearSide = M.nearSide, patch = M.patch, sEllipse = M.sEllipse, shape = M.shape,
          sin = M.sin, slabF = M.slabF, spec = M.spec, tone = M.tone, trim = M.trim, u = M.u;
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
            /* The front of the fuselage angles down: ahead of a hinge just
               forward of the stub wings every point sinks, more the further
               forward, so the nose, the glass and the chin gun all droop. */
            var AF0 = AF, hingeC = L * 0.08, sagC = 4.5 / (L * 0.52 - hingeC);
            var sagAt = function (p) { return p > hingeC ? (p - hingeC) * sagC : 0; };
            AF = function (p, q) { var c = AF0(p, q); c.dz = sagAt(p); return c; };
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
                /* A small swept wingtip on the outside of the fan housing: a short
                   plate, its tip raked back. Laid before the fan, so the housing
                   covers its root. */
                plate(AF, [[-L * 0.03, sd * (tipQ + 0.02)], [-L * 0.15, sd * (tipQ + 0.4)], [-L * 0.21, sd * (tipQ + 0.4)], [-L * 0.17, sd * (tipQ + 0.02)]], wz, 1.4);
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
            part(L * 0.45, 0, function () {
              var keep = AF; AF = AF0;                    // the gun's own frame knows nothing of the droop: it is lowered with it
              noseGun(L * 0.34, 0, z + 1 - sagAt(L * 0.34), 0.3, 'gun', { rail: true, also: ['rail', 'auto', 'mg'] });
              AF = keep;
            });
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
      return { drawCraft: drawCraft };
    };
  };
})(window);
