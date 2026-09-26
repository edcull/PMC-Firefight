/* PMC 2670 — Firefight : the plain hull and its fittings

   Made by iso-machines.js for each machine it draws: drawMachineBody hands
   over what it has worked out for that machine (M) and the drawing kit its
   pieces share, and gets back the drawing functions below. */
(function (root) {
  'use strict';
  root.PMCIsoPlainHull = function (P) {
    var a = P.a, bandOnSides = P.bandOnSides, ellipse = P.ellipse, poly = P.poly, project = P.project,
        rect = P.rect, taper = P.taper, thickLine = P.thickLine;
    return function (M) {
      var GLASS = M.GLASS, GLINT = M.GLINT, STEEL = M.STEEL, STEEL_LIT = M.STEEL_LIT, box = M.box,
          cos = M.cos, dark = M.dark, dead = M.dead, deck = M.deck, dropBody = M.dropBody,
          dropHatch = M.dropHatch, g = M.g, hull = M.hull, lit = M.lit, scr = M.scr, sin = M.sin,
          spec = M.spec, top = M.top, trim = M.trim;
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
      return { drawHull: drawHull, drawFittings: drawFittings };
    };
  };
})(window);
