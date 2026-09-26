/* PMC 2670 — Firefight : the rotorcraft

   Made by iso-machines.js for each machine it draws: drawMachineBody hands
   over what it has worked out for that machine (M) and the drawing kit its
   pieces share, and gets back the drawing functions below. */
(function (root) {
  'use strict';
  root.PMCIsoRotors = function (P) {
    var K = P.K, a = P.a, bandOnSides = P.bandOnSides, dot = P.dot, ellipseRing = P.ellipseRing,
        poly = P.poly, project = P.project, rect = P.rect, taper = P.taper, thickLine = P.thickLine,
        toScreen = P.toScreen;
    return function (M) {
      var GLASS = M.GLASS, GLINT = M.GLINT, STEEL = M.STEEL, STEEL_LIT = M.STEEL_LIT, along = M.along,
          at = M.at, box = M.box, cos = M.cos, dark = M.dark, dead = M.dead, drawDamage = M.drawDamage,
          f = M.f, g = M.g, hull = M.hull, lift = M.lift, lit = M.lit, scr = M.scr, sin = M.sin,
          spec = M.spec, trim = M.trim;
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
      return { drawRotorcraft: drawRotorcraft };
    };
  };
})(window);
