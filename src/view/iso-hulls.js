/* PMC 2670 — Firefight : the styled hulls: bodies, skirts and turrets

   Made by iso-machines.js for each machine it draws: drawMachineBody hands
   over what it has worked out for that machine (M) and the drawing kit its
   pieces share, and gets back the drawing functions below. */
(function (root) {
  'use strict';
  root.PMCIsoHulls = function (P) {
    var DRIVE = P.DRIVE, K = P.K, MACHINE = P.MACHINE, bandOnSides = P.bandOnSides, edge = P.edge,
        poly = P.poly, project = P.project;
    return function (M) {
      var AIM = M.AIM, GLASS = M.GLASS, GLINT = M.GLINT, HF = M.HF, S3 = M.S3, STEEL = M.STEEL, TB = M.TB,
          TC = M.TC, TS = M.TS, TT = M.TT, aerial = M.aerial, along = M.along, alongOrder = M.alongOrder,
          barrel = M.barrel, box = M.box, cos = M.cos, crossOn = M.crossOn, dark = M.dark, dead = M.dead,
          deck = M.deck, drive = M.drive, droneDue = M.droneDue, droneKit = M.droneKit,
          droneMark = M.droneMark, droneSpot = M.droneSpot, frameAt = M.frameAt, g = M.g,
          gearOut = M.gearOut, grille = M.grille, hatch = M.hatch, hexFlank = M.hexFlank,
          hexNose = M.hexNose, hull = M.hull, launcher = M.launcher, lift = M.lift, lights = M.lights,
          line = M.line, lit = M.lit, mixc = M.mixc, mount = M.mount, nearSide = M.nearSide,
          nearSideAt = M.nearSideAt, rearDoor = M.rearDoor, sEllipse = M.sEllipse, shape = M.shape,
          sin = M.sin, slabF = M.slabF, spec = M.spec, tone = M.tone, trim = M.trim, u = M.u, want = M.want,
          wheelGeom = M.wheelGeom;
      /* A light engineering vehicle's flame fuel: one big armoured tank slung
         across the back of the hull on brackets, strapped. It goes down before
         the hull when the nose is towards the eye (the hull hides it) and after
         it when the back is. */
      function rearTank() {
        var L = spec.len, w = spec.wid * 0.47, zc = deck + spec.hgt * 0.5;
        var aT = -L * 0.5 - 0.16;
        var c1 = S3(HF(aT, -w * 0.86), zc), c2 = S3(HF(aT, w * 0.86), zc);
        // the brackets, back to the hull
        [-0.6, 0.6].forEach(function (k) {
          line(S3(HF(-L * 0.5, w * k), zc - 3), S3(HF(aT, w * k), zc - 3), 2, '#23271f');
        });
        var R = 7.5;
        sEllipse(c1[0], c1[1], R * 0.55, R, '#2f342e');
        line(c1, c2, R * 2, '#3a3f38');
        line([c1[0], c1[1] - R * 0.55], [c2[0], c2[1] - R * 0.55], 2.2, '#6a7064');
        line([c1[0], c1[1] + R * 0.6], [c2[0], c2[1] + R * 0.6], 1.6, '#262a24');
        sEllipse(c2[0], c2[1], R * 0.55, R, '#454b43');
        sEllipse(c2[0] - 0.8, c2[1] - 1.2, R * 0.3, R * 0.5, '#5a6157');
        [-0.45, 0, 0.45].forEach(function (k) {
          var q = S3(HF(aT, w * k), zc);
          line([q[0], q[1] - R], [q[0], q[1] + R], 1.3, '#1d211b');
        });
        // the filler cap on top
        var fc = S3(HF(aT, -w * 0.3), zc + 5);
        sEllipse(fc[0], fc[1] - 1, 2, 1.3, '#23271f');
      }
      /* A pickup's cab and bonnet, when they face the viewer: a turret stood in
         the bed behind them is drawn first and these laid over it again, so the
         cab hides what is behind it (styledTop). */
      var pickupFront = null;
      function styledHull() {
        var L = spec.len, Wd = spec.wid, H = spec.hgt, z0 = deck, st = spec.style;
        var w = Wd * 0.47;
        switch (st.body) {
          case 'pickup': {
            /* bonnet, cab, and an open bed with low sides — laid down far to
               near, so whichever end faces the viewer is drawn over the other */
            var fwdP = cos + sin, nsP = nearSide();
            /* On anything but wheels the bonnet has nowhere to go: the cab sits
               right at the front of the hull, and the bed runs up behind it. */
            var cabFwd = drive !== 'wheeled';
            var cA0 = cabFwd ? L * 0.2 : -L * 0.1, cA1 = cabFwd ? L * 0.5 : L * 0.2, bedA1 = cabFwd ? L * 0.2 : -L * 0.1;
            var cs = cA1 - L * 0.2;                          // how far the cab has moved forward
            var bonnet = function () {
              if (cabFwd) {                                   // headlights on the cab's face instead
                lights(HF, L * 0.5, -w * 0.62, z0 + H * 0.4); lights(HF, L * 0.5, w * 0.62, z0 + H * 0.4);
                return;
              }
              slabF(HF, L * 0.16, L * 0.5, -w * 0.92, w * 0.92, z0, H * 0.62, TB, L * 0.05, 0, w * 0.05);
              lights(HF, L * 0.5, -w * 0.62, z0 + H * 0.4); lights(HF, L * 0.5, w * 0.62, z0 + H * 0.4);
              if (fwdP > 0.02) { var grl = S3(HF(L * 0.5, 0), z0 + H * 0.35); sEllipse(grl[0], grl[1], 3, 1.6, STEEL); }
            };
            var cab = function () {
              // a drone has no one to sit in a cab: an armoured block the height of the bonnet instead
              if (u.drone) { slabF(HF, cA0, cA1, -w * 0.9, w * 0.9, z0, H * 0.7, TB, L * 0.04, 0, w * 0.06); return; }
              slabF(HF, cA0, cA1, -w, w, z0, H * 1.25, TB, L * 0.1, 0.02, w * 0.1);
              if (fwdP > 0.02) {                              // the windscreen, only when the front faces us
                var wsA = S3(HF(cs + L * 0.19, -w * 0.8), z0 + H * 0.68), wsB = S3(HF(cs + L * 0.19, w * 0.8), z0 + H * 0.68);
                var wsC = S3(HF(cs + L * 0.105, w * 0.72), z0 + H * 1.2), wsD = S3(HF(cs + L * 0.105, -w * 0.72), z0 + H * 1.2);
                poly(g, [wsA, wsB, wsC, wsD], GLASS);
                edge(g, wsD, wsC, GLINT, 0.8);
              }
              var sw1 = S3(HF(cs + L * 0.14, nsP * w * 0.99), z0 + H * 0.72), sw2 = S3(HF(cs - L * 0.06, nsP * w * 0.99), z0 + H * 0.72);
              var sw3 = S3(HF(cs - L * 0.06, nsP * w * 0.92), z0 + H * 1.12), sw4 = S3(HF(cs + L * 0.1, nsP * w * 0.92), z0 + H * 1.12);
              poly(g, [sw1, sw2, sw3, sw4], GLASS);
            };
            var bed = function () {
              slabF(HF, -L * 0.5, bedA1, -w, w, z0, H * 0.45, TB, 0, 0, 0);
              var bz = z0 + H * 0.45;
              var walls = [
                { d: -nsP * 1, fn: function () { slabF(HF, -L * 0.5, bedA1, -nsP * w, -nsP * (w - 0.05), bz, H * 0.35, TB); } },
                { d: -fwdP * L * 0.48, fn: function () { slabF(HF, -L * 0.5, -L * 0.46, -w, w, bz, H * 0.35, TB); } },
                { d: nsP * 1, fn: function () { slabF(HF, -L * 0.5, bedA1, nsP * (w - 0.05), nsP * w, bz, H * 0.35, TB); } }
              ];
              walls.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
            };
            [{ t: L * 0.33, fn: bonnet }, { t: (cA0 + cA1) / 2, fn: cab }, { t: (bedA1 - L * 0.5) / 2, fn: bed }]
              .sort(function (p, q) { return p.t * fwdP - q.t * fwdP; })
              .forEach(function (p) { p.fn(); });
            if (st.turret && fwdP > 0.02) pickupFront = function () { cab(); bonnet(); };
            return;
          }
          case 'truck': {
            var heavy = !!st.heavy;
            var cabL = heavy ? 0.3 : 0.26;
            var fwdT = cos + sin, nsT = nearSide();
            var bedA0 = -L * 0.5, bedA1 = L * (0.5 - cabL) - 0.04;
            var tbonnet = function () {
              slabF(HF, L * (0.5 - cabL * 0.45), L * 0.5, -w * 0.86, w * 0.86, z0, H * 0.7, TB, L * 0.03, 0, w * 0.06);
              lights(HF, L * 0.5, -w * 0.6, z0 + H * 0.45); lights(HF, L * 0.5, w * 0.6, z0 + H * 0.45);
            };
            var tcab = function () {
              slabF(HF, L * (0.5 - cabL), L * (0.5 - cabL * 0.42), -w * 0.96, w * 0.96, z0, H * 1.45, TB, L * 0.03, 0, w * 0.04);
              if (fwdT > 0.02) {
                var fA = L * (0.5 - cabL * 0.42) - 0.005;
                var g1 = S3(HF(fA, -w * 0.8), z0 + H * 0.85), g2 = S3(HF(fA, w * 0.8), z0 + H * 0.85);
                var g3 = S3(HF(fA - L * 0.03, w * 0.78), z0 + H * 1.4), g4 = S3(HF(fA - L * 0.03, -w * 0.78), z0 + H * 1.4);
                poly(g, [g1, g2, g3, g4], GLASS); edge(g, g4, g3, GLINT, 0.8);
              }
            };
            var tbed = function () {
              slabF(HF, bedA0, bedA1, -w, w, z0, H * 0.4, TB);
              var boxH = H * (heavy ? 1.35 : 1.15), topZ = z0 + H * (heavy ? 1.75 : 1.55);
              if (st.armourBox) {
                /* an armoured cargo box in the force colour: slab sides, a
                   panel seam along it, vision slits and a rear door */
                slabF(HF, bedA0 + 0.02, bedA1 - 0.02, -w * 0.98, w * 0.98, z0 + H * 0.4, boxH, TB, 0.01, 0, w * 0.05);
                bandOnSides(g, box((bedA0 + bedA1) / 2, 0, bedA1 - bedA0 - 0.04, w * 1.96), z0 + H * 0.4 + boxH * 0.55, 2, 2, trim);
                for (var sl = 1; sl < 4; sl++) {
                  var sa = bedA0 + (bedA1 - bedA0) * sl / 4;
                  var s1 = S3(HF(sa - 0.06, nsT * w * 0.985), z0 + H * 0.4 + boxH * 0.72), s2 = S3(HF(sa + 0.06, nsT * w * 0.985), z0 + H * 0.4 + boxH * 0.72);
                  line(s1, s2, 1.4, '#15181e');
                }
                if (spec.rearDoor) rearDoor(HF, bedA0 + 0.02, w * 0.72, z0 + H * 0.45, boxH - 3, 'double');
                else if (fwdT < 0) {
                  var d1 = S3(HF(bedA0 + 0.015, -w * 0.4), z0 + H * 0.5), d2 = S3(HF(bedA0 + 0.015, w * 0.4), z0 + H * 0.5);
                  var d3 = S3(HF(bedA0 + 0.015, w * 0.4), z0 + H * 0.4 + boxH - 2), d4 = S3(HF(bedA0 + 0.015, -w * 0.4), z0 + H * 0.4 + boxH - 2);
                  edge(g, d1, d4, 'rgba(10,9,7,.5)', 0.8); edge(g, d2, d3, 'rgba(10,9,7,.5)', 0.8); edge(g, d4, d3, 'rgba(10,9,7,.5)', 0.8);
                }
                return;
              }
              slabF(HF, bedA0 + 0.02, bedA1 - 0.02, -w * 0.98, w * 0.98, z0 + H * 0.4, boxH, TC, 0, 0, w * 0.1);
              if (spec.rearDoor) rearDoor(HF, bedA0 + 0.02, w * 0.9, z0 + 1, H * 0.4 + boxH - 2, 'canvas');
              // hoops showing through the canvas
              var hoops = heavy ? 5 : 4;
              for (var hp = 1; hp < hoops; hp++) {
                var ha = bedA0 + (bedA1 - bedA0) * hp / hoops;
                edge(g, S3(HF(ha, nsT * w * 0.98), z0 + H * 0.45), S3(HF(ha, nsT * w * 0.88), topZ), 'rgba(40,36,26,.45)', 0.8);
                edge(g, S3(HF(ha, -w * 0.88), topZ), S3(HF(ha, w * 0.88), topZ), 'rgba(40,36,26,.35)', 0.8);
              }
            };
            [{ t: L * (0.5 - cabL * 0.2), fn: tbonnet }, { t: L * (0.5 - cabL * 0.7), fn: tcab }, { t: (bedA0 + bedA1) / 2, fn: tbed }]
              .sort(function (p, q) { return p.t * fwdT - q.t * fwdT; })
              .forEach(function (p) { p.fn(); });
            return;
          }
          case 'guntruck': {
            var fwdG = cos + sin, nsG = nearSide(), hv = !!st.heavy;
            var cabL = hv ? 0.28 : 0.3, bedA0 = -L * 0.5, bedA1 = L * (0.5 - cabL) - 0.03;
            var RUST = tone('#9a6a44', '#7a4a2a', '#4a2c18', '#8a5a36'); RUST.tex = 'rust';
            var PLATE = tone('#8a8f96', '#62676e', '#3a3e44', '#747980'); PLATE.tex = 'steel';
            if (st.flatCab) cabL = 0.24;
            if (st.flatCab) bedA1 = L * (0.5 - cabL) - 0.03;
            var gbonnet = function () {
              if (st.flatCab) {
                // a cab-over: no bonnet, just a plated bumper across the flat front
                slabF(HF, L * 0.48, L * 0.53, -w * 0.94, w * 0.94, z0 - 2, H * 0.5, PLATE, 0, 0, 0);
                lights(HF, L * 0.53, -w * 0.66, z0 + H * 0.3); lights(HF, L * 0.53, w * 0.66, z0 + H * 0.3);
                return;
              }
              slabF(HF, L * (0.5 - cabL * 0.45), L * 0.5, -w * 0.86, w * 0.86, z0, H * 0.72, TB, L * 0.03, 0, w * 0.06);
              // a plough of plate across the grille
              slabF(HF, L * 0.47, L * 0.52, -w * 0.9, w * 0.9, z0 - 2, H * 0.55, PLATE, 0.01, 0, 0);
              lights(HF, L * 0.52, -w * 0.62, z0 + H * 0.5); lights(HF, L * 0.52, w * 0.62, z0 + H * 0.5);
            };
            var gcab = function () {
              if (u.drone) {                                   // no crew, no cab: plated over at bonnet height
                slabF(HF, L * (0.5 - cabL), L * (0.5 - cabL * 0.42), -w * 0.9, w * 0.9, z0, H * 0.78, TB, L * 0.03, 0, w * 0.06);
                return;
              }
              if (st.flatCab) {
                // a straight, square cab right at the front, its face plated with a slit
                slabF(HF, L * (0.5 - cabL), L * 0.5, -w * 0.98, w * 0.98, z0, H * 1.6, TB, 0.005, 0, w * 0.03);
                if (fwdG > 0.02) {
                  var fF = L * 0.5 + 0.004;
                  var h1 = S3(HF(fF, -w * 0.9), z0 + H * 0.95), h2 = S3(HF(fF, w * 0.9), z0 + H * 0.95);
                  var h3 = S3(HF(fF, w * 0.9), z0 + H * 1.5), h4 = S3(HF(fF, -w * 0.9), z0 + H * 1.5);
                  poly(g, [h1, h2, h3, h4], PLATE.mid);
                  line(S3(HF(fF, -w * 0.7), z0 + H * 1.25), S3(HF(fF, w * 0.7), z0 + H * 1.25), 1.8, '#101216');
                  edge(g, h1, h4, '#3a2a1c', 0.8); edge(g, h2, h3, '#3a2a1c', 0.8);
                }
                return;
              }
              slabF(HF, L * (0.5 - cabL), L * (0.5 - cabL * 0.42), -w * 0.96, w * 0.96, z0, H * 1.45, TB, L * 0.03, 0, w * 0.04);
              if (fwdG > 0.02) {
                // plate welded over the windscreen, two slits cut in it
                var fA = L * (0.5 - cabL * 0.42) + 0.005;
                var g1 = S3(HF(fA, -w * 0.84), z0 + H * 0.8), g2 = S3(HF(fA, w * 0.84), z0 + H * 0.8);
                var g3 = S3(HF(fA - L * 0.03, w * 0.82), z0 + H * 1.42), g4 = S3(HF(fA - L * 0.03, -w * 0.82), z0 + H * 1.42);
                poly(g, [g1, g2, g3, g4], PLATE.mid);
                [-0.45, 0.45].forEach(function (b) {
                  line(S3(HF(fA - L * 0.015, w * (b - 0.25)), z0 + H * 1.15), S3(HF(fA - L * 0.015, w * (b + 0.25)), z0 + H * 1.15), 1.6, '#101216');
                });
                // weld seams
                edge(g, g1, g4, '#3a2a1c', 0.8); edge(g, g2, g3, '#3a2a1c', 0.8);
              }
            };
            var gbed = function () {
              slabF(HF, bedA0, bedA1, -w, w, z0, H * 0.45, TB);
              var bz = z0 + H * 0.45, wh = H * (hv ? 0.6 : 0.5);
              if (st.enclosed) {
                /* A transport: the troops ride inside a welded box, plated all
                   round and roofed over, patched from whatever was to hand —
                   vision slits along the sides and a door at the back. */
                var eh = H * (hv ? 1.1 : 0.95);
                slabF(HF, bedA0 + 0.01, bedA1, -w * 0.99, w * 0.99, bz, eh, TB, 0.02, 0, w * 0.04);
                var nP = hv ? 4 : 3;
                for (var ep = 0; ep < nP; ep++) {
                  var ea0 = bedA0 + 0.02 + (bedA1 - bedA0 - 0.03) * ep / nP, ea1 = bedA0 + 0.02 + (bedA1 - bedA0 - 0.03) * (ep + 1) / nP;
                  var etn = [RUST, PLATE, TB][(ep + 1) % 3];
                  if (etn === TB) continue;
                  slabF(HF, ea0 + 0.01, ea1 - 0.01, nsG * (w * 0.99), nsG * (w * 1.01), bz + 1, eh - 2, etn);
                }
                for (var es = 1; es <= nP; es++) {
                  var esa = bedA0 + (bedA1 - bedA0) * (es - 0.5) / nP;
                  line(S3(HF(esa - 0.05, nsG * w * 1.02), bz + eh * 0.72), S3(HF(esa + 0.05, nsG * w * 1.02), bz + eh * 0.72), 1.4, '#101216');
                }
                if (fwdG < 0) {
                  var e1 = S3(HF(bedA0 + 0.005, -w * 0.4), bz + 1), e2 = S3(HF(bedA0 + 0.005, w * 0.4), bz + 1);
                  var e3 = S3(HF(bedA0 + 0.005, w * 0.4), bz + eh - 2), e4 = S3(HF(bedA0 + 0.005, -w * 0.4), bz + eh - 2);
                  edge(g, e1, e4, 'rgba(10,9,7,.55)', 0.8); edge(g, e2, e3, 'rgba(10,9,7,.55)', 0.8); edge(g, e4, e3, 'rgba(10,9,7,.55)', 0.8);
                }
                hatch(HF, (bedA0 + bedA1) / 2 + 0.25, w * 0.4, bz + eh, 0.1);
                return;
              }
              // plated walls, the panels not matching: some rust, some bare steel, some painted
              var nPan = hv ? 4 : 3, pieces = [];
              [-1, 1].forEach(function (sd) {
                for (var k = 0; k < nPan; k++) {
                  var pa0 = bedA0 + (bedA1 - bedA0) * k / nPan, pa1 = bedA0 + (bedA1 - bedA0) * (k + 1) / nPan;
                  var tn2 = [RUST, PLATE, TB][(k + (sd > 0 ? 1 : 0)) % 3];
                  var hh2 = wh * (0.85 + ((k * 7 + (sd > 0 ? 3 : 0)) % 4) * 0.08);
                  pieces.push({ d: sd * nsG, fn: (function (a0, a1, t2, h2, side) { return function () {
                    slabF(HF, a0, a1, side * (w - 0.06), side * w, bz, h2, t2);
                  }; })(pa0, pa1 + 0.01, tn2, hh2, sd) });
                }
              });
              pieces.push({ d: -fwdG, fn: function () { slabF(HF, bedA0, bedA0 + 0.06, -w, w, bz, wh * 0.9, RUST); } });
              pieces.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
            };
            [{ t: L * (0.5 - cabL * 0.2), fn: gbonnet }, { t: L * (0.5 - cabL * 0.7), fn: gcab }, { t: (bedA0 + bedA1) / 2, fn: gbed }]
              .sort(function (p, q) { return p.t * fwdG - q.t * fwdG; })
              .forEach(function (p) { p.fn(); });
            return;
          }
          case 'car': {
            // an armoured car: a raked hull high over big wheels, fenders over each
            slabF(HF, -L * 0.46, L * 0.46, -w * 0.82, w * 0.82, z0 - 2, H, TB, L * 0.2, L * 0.12, w * 0.12);
            lights(HF, L * 0.44, -w * 0.5, z0 + H * 0.4); lights(HF, L * 0.44, w * 0.5, z0 + H * 0.4);
            hatch(HF, L * 0.2, 0, z0 - 2 + H, 0.12);
            return;
          }
          case 'box': case 'bigbox': case 'ifv': {
            var big = st.body === 'bigbox', ifv = st.body === 'ifv';
            var hh = H * (big ? 1.08 : ifv ? 0.85 : 1);
            // a tall box: the upper front plate raked back, the back straight down
            slabF(HF, -L * 0.5, L * 0.5, -w, w, z0, hh, TB, L * (ifv ? 0.3 : 0.24), 0.01, w * 0.04);
            // the heavy carriers' glacis carries the hexagonal active armour
            if (st.hexNose) hexNose(HF, L * 0.5, L * 0.5 - L * (ifv ? 0.3 : 0.24), -w * 0.9, w * 0.9, z0, hh);
            if (st.hex) hexFlank(HF, -L * 0.46, L * 0.24, nearSide() * w, z0 + 1, hh * 0.9);
            if (big) {
              // a raised troop compartment over the rear two thirds
              slabF(HF, -L * 0.48, L * 0.02, -w * 0.9, w * 0.9, z0 + hh, H * 0.3, TB, L * 0.05, 0, w * 0.04);
            }
            // the rear ramp, where it can be seen: a proper door on the troop carriers, a darker plate on the rest
            if (spec.rearDoor) rearDoor(HF, -L * 0.5, w * 0.62, z0 + 1.5, hh - 4, 'ramp');
            else {
              var ra = project(box(-L * 0.5, 0, 0.01, Wd * 0.72), z0 + 2);
              var rb = project(box(-L * 0.5, 0, 0.01, Wd * 0.72), z0 + hh - 3);
              if ((cos + sin) < 0) poly(g, [ra[0], ra[1], rb[1], rb[0]], mixc(hull, dark, 0.5));
            }
            bandOnSides(g, box(0, 0, L, Wd * 0.94), z0 + 1, 2, 2, 'rgba(10,9,7,.45)');
            lights(HF, L * 0.49, -w * 0.62, z0 + hh * 0.45); lights(HF, L * 0.49, w * 0.62, z0 + hh * 0.45);
            grille(HF, L * 0.18, L * 0.3, w * 0.15, w * 0.75, z0 + hh + 0.3, 4);
            if (!st.turret) hatch(HF, -L * 0.18, -w * 0.4, z0 + hh + (big ? H * 0.3 : 0), 0.13);
            hatch(HF, -L * 0.34, w * 0.38, z0 + hh + (big ? H * 0.3 : 0), 0.12);
            return;
          }
          case 'mlrs': {
            // an armoured cab at the front, a flat launcher bed behind it
            slabF(HF, -L * 0.5, L * 0.5, -w, w, z0, H * 0.55, TB, L * 0.04, 0, w * 0.03);
            // (the cab itself goes on with the launcher, in styledTop, so the two layer by depth)
            lights(HF, L * 0.5, -w * 0.62, z0 + H * 0.35); lights(HF, L * 0.5, w * 0.62, z0 + H * 0.35);
            return;
          }
          case 'future': {
            // a faceted hull: chamfered corners, a long wedge nose, hex tiles on the flanks
            var fpts = [[L * 0.5, -w * 0.5], [L * 0.5, w * 0.5], [L * 0.36, w], [-L * 0.44, w], [-L * 0.5, w * 0.8],
              [-L * 0.5, -w * 0.8], [-L * 0.44, -w], [L * 0.36, -w]];
            var ftop = [[L * 0.14, -w * 0.46], [L * 0.14, w * 0.46], [L * 0.06, w * 0.86], [-L * 0.42, w * 0.86], [-L * 0.47, w * 0.7],
              [-L * 0.47, -w * 0.7], [-L * 0.42, -w * 0.86], [L * 0.06, -w * 0.86]];
            shape(HF, fpts, z0, H * 0.9, TB, null, ftop);
            var ns4 = nearSide();
            hexFlank(HF, -L * 0.42, L * 0.3, ns4 * w * 1.0, z0 + 1, H * 0.8);
            hexNose(HF, L * 0.5, L * 0.14, -w * 0.45, w * 0.45, z0, H * 0.9, 3);   // and across the nose: a row of three over a row of two
            grille(HF, -L * 0.42, -L * 0.24, -w * 0.5, w * 0.5, z0 + H * 0.9 + 0.2, 5);
            return;
          }
          default: {
            // a tank: a low hull with a sloped glacis, engine deck grilles at the back
            var mbt = st.body === 'mbt';
            var hh2 = H * (mbt ? 0.8 : 0.88);
            slabF(HF, -L * 0.5, L * 0.5, -w * 0.94, w * 0.94, z0, hh2, TB, L * (mbt ? 0.26 : 0.2), L * 0.05, w * 0.03);
            if (st.hexNose) hexNose(HF, L * 0.5, L * 0.5 - L * (mbt ? 0.26 : 0.2), -w * 0.86, w * 0.86, z0, hh2);
            // lower glacis wedge under the nose
            grille(HF, -L * 0.44, -L * 0.24, -w * 0.6, w * 0.6, z0 + hh2 + 0.2, mbt ? 6 : 4);
            lights(HF, L * 0.49, -w * 0.72, z0 + hh2 * 0.35); lights(HF, L * 0.49, w * 0.72, z0 + hh2 * 0.35);
            // tools and a tow cable along the deck
            edge(g, S3(HF(-L * 0.2, -w * 0.8), z0 + hh2 + 0.5), S3(HF(L * 0.1, -w * 0.8), z0 + hh2 + 0.5), '#3a2f22', 1.2);
            // the Tier V hulls carry the same hexagonal active armour as the advanced combat vehicle
            if (st.hex) hexFlank(HF, -L * 0.42, L * 0.3, nearSide() * w * 0.94, z0 + 1, hh2 * 0.9);
            return;
          }
        }
      }

      // side skirts over the running gear, drawn after the near wheels or tracks
      /* An armoured car's mudguards: a raked plate over each wheel, set outboard
         over the tyre, drawn after the wheels so the arch sits over its tyre. */
      /* An armoured car's mudguards: a raked plate over each wheel, set outboard
         over the tyre. The far side's go down before the hull, which hides them;
         the inner edge runs in under the hull so they meet it from any side. */
      function carFenders(phase) {
        var WG = wheelGeom(), rIn = WG.r / K, w = spec.wid * 0.47;
        var ns = nearSide();
        [-ns, ns].forEach(function (sd) {
          if (!want(phase, sd)) return;
          var tsF = [];
          for (var i0 = 0; i0 < WG.n; i0++) tsF.push((i0 / (WG.n - 1) - 0.5) * WG.span);
          tsF = alongOrder(tsF);                            // the far arch first, the near one over it
          for (var i = 0; i < WG.n; i++) {
            var t = tsF[i];
            var z0 = lift + WG.r * 1.55, h = WG.r * 0.55 + 1.5;
            slabF(HF, t - rIn * 1.15, t + rIn * 1.15, sd * w * 0.6, sd * (spec.wid * 0.5 + gearOut() + 0.01), z0, h, TB, rIn * 0.45, rIn * 0.45, 0);
          }
        });
      }
      /* Side skirts and mudguards. The far side's go down before the hull and
         are drawn in to the hull's side, so the body hides them; the near side's
         go on after it. Nose- or tail-on, both stand beside the hull. */
      function headOn() { return Math.abs(cos - sin) < 0.2; }
      function skirts(phase) {
        phase = phase || 'near';
        var st = spec.style, L = spec.len, Wd = spec.wid;
        if (st.body === 'car' && drive === 'wheeled') { carFenders(phase); return; }
        // skirts hang over tracks; on wheels the flank is left open to show them
        if (!st.skirts || drive !== 'tracked') return;
        var ns = nearSide();
        [-ns, ns].forEach(function (sd) {
          var isFar = sd !== ns && !headOn();
          if ((phase === 'far') !== isFar) return;
          var zt = deck + Math.round(spec.hgt * 0.35), h = Math.max(4, Math.round(DRIVE.tracked.ride * 0.55) + 3);
          var spl = isFar ? -Wd * 0.08 : gearOut();               // out over the tracks, or in under the hull
          slabF(HF, -L * 0.48, L * 0.46, sd * (Wd * 0.49 + spl), sd * (Wd * 0.53 + spl), zt - h, h, TB, L * 0.02, 0);
          if (sd === ns && st.skirts === 'panels') {
            for (var i = 1; i < 6; i++) {
              var ta = -L * 0.48 + (L * 0.94) * i / 6;
              edge(g, S3(HF(ta, sd * (Wd * 0.535 + spl)), zt - h + 1), S3(HF(ta, sd * (Wd * 0.535 + spl)), zt - 1), 'rgba(10,9,7,.4)', 0.7);
            }
          }
        });
      }

      /* The top: turret or casemate, launchers, aerials. Parts are laid down in
         depth order so a gun pointing at the viewer is drawn over its turret. */
      function styledTop() {
        var st = spec.style, L = spec.len, Wd = spec.wid, H = spec.hgt, w = Wd * 0.47;
        var roof = deck + H * ({ mbt: 0.8, tank: 0.88, ltank: 0.88, future: 0.9, ifv: 0.85, bigbox: 1.08, car: 1, pickup: 0.45, truck: 1.45, mlrs: 0.55, guntruck: 0.5 }[st.body] || 1) - (st.body === 'car' ? 2 : 0);
        // a transport's enclosed troop box: the gun goes on its roof
        if (st.body === 'guntruck' && st.enclosed) roof = deck + H * (st.heavy ? 1.55 : 1.4);
        if (st.body === 'bigbox') roof += H * 0.3;
        var parts = [];
        function part(d, fn) { parts.push({ d: d, fn: fn }); }
        function depthOf(fr, p, q) { var c = fr(p, q); return c.x + c.y; }
        var tT = st.tAt != null ? L * st.tAt : -L * 0.04;          // where the turret sits
        var TR = (st.tSize || 0.9) * MACHINE;                       // turret size, inches
        var TF = frameAt(tT, st.tSide ? w * st.tSide : 0, AIM);     // the turret frame
        var tz = roof;
        /* A gun truck's turret stands on a pedestal in the bed, up at the height
           of the cab's roof, so its guns clear the cab. */
        var pedestal = st.body === 'pickup' && st.turret;
        if (pedestal) tz = deck + H * 1.25;

        // ---- turrets ----
        function wedgeTurret(sz, hgt, wedge) {
          var pts = [[sz * 0.62, 0], [sz * 0.36, sz * 0.46], [-sz * 0.44, sz * 0.46], [-sz * 0.6, sz * 0.36],
            [-sz * 0.6, -sz * 0.36], [-sz * 0.44, -sz * 0.46], [sz * 0.36, -sz * 0.46]];
          if (!wedge) pts[0] = [sz * 0.42, 0.001];
          return shape(TF, pts, tz, hgt, TB, 0.9);
        }
        function roundTurret(sz, hgt) {
          var pts = [];
          for (var i = 0; i < 8; i++) {
            var ang = (i + 0.5) * Math.PI / 4;
            pts.push([Math.cos(ang) * sz * 0.5, Math.sin(ang) * sz * 0.46]);
          }
          return shape(TF, pts, tz, hgt, TB, 0.82);
        }
        function cupola(p, q, z) {
          var cp = S3(TF(p, q), z);
          sEllipse(cp[0], cp[1] + 1, 3.6, 2.2, mixc(hull, dark, 0.4));
          sEllipse(cp[0], cp[1] - 1, 3.4, 2, hull);
          sEllipse(cp[0] - 0.8, cp[1] - 1.6, 1.8, 1, lit);
          line([cp[0] - 1.5, cp[1] - 2.2], [cp[0] + 1.5, cp[1] - 2.2], 1, GLINT);
        }
        function smokeRack(sz, z) {
          [-1, 1].forEach(function (sd) {
            for (var i = 0; i < 3; i++) {
              var sp = S3(TF(sz * 0.1 - i * sz * 0.08, sd * sz * 0.5), z);
              sEllipse(sp[0], sp[1], 1.1, 1.1, STEEL);
            }
          });
        }
        function coaxMG(sz, z, b) {
          return barrel(TF, sz * 0.3, sz * 0.62, b, z, 1.2, 'mg', { col: '#15181e' });
        }
        // a plasma cannon's barrel: coil rings along it, a cyan throat at the muzzle
        // `up` lays it toward the sky, the rings following it up the barrel
        function plasmaBarrel(a0, len, z, wd, up) {
          up = up || 0;
          var mz = barrel(TF, a0, len, 0, z, wd, 'gun', { col: '#1c2129', up: up });
          for (var i = 1; i <= 4; i++) {
            var rp = S3(TF(a0 + (len - a0) * i / 5, 0), z + up * i / 5);
            sEllipse(rp[0], rp[1], wd * 0.46, wd * 0.4, '#2a313b');
            if (!dead) sEllipse(rp[0], rp[1], wd * 0.3, wd * 0.26, 'rgba(120,230,255,.8)');
          }
          if (!dead) sEllipse(mz[0], mz[1], wd * 0.48, wd * 0.43, 'rgba(180,245,255,.95)');
          return mz;
        }
        /* A short fat energy barrel: three blue vents down it and a wide mouth
           with the charge glowing in it. `rake` lays it up; 0 fires it level. */
        function energyStub(a0b, bz, reach, rake) {
          var bt = barrel(TF, a0b, reach, 0, bz, 7.5, 'gun', { up: rake, col: '#141b22', lit: '#2a313b' });
          /* three vents evenly spaced down the barrel as it is drawn, from its
             hull end to just clear of the muzzle ring */
          var vb0 = S3(TF(a0b, 0), bz), vdx = bt[0] - vb0[0], vdy = bt[1] - vb0[1];
          // (the barrel's rounded end reaches back half its gauge past vb0; the muzzle ring is 3.9 out)
          var vlen = Math.hypot(vdx, vdy) || 1, vs0 = -3.4 / vlen, vs1 = 1 - 3.9 / vlen;
          for (var vv = 0; vv < 3 && !dead; vv++) {
            var vt = vs0 + (vs1 - vs0) * (vv + 0.5) / 3, vx = vb0[0] + vdx * vt, vy = vb0[1] + vdy * vt;
            sEllipse(vx, vy, 1.8, 1.53, '#0c1016');
            sEllipse(vx, vy, 1.26, 0.99, 'rgba(120,230,255,.85)');
          }
          // the muzzle: a wide mouth across the end of the barrel, the charge glowing in it
          sEllipse(bt[0], bt[1], 3.9, 3.4, '#0c1016');
          if (!dead) {
            sEllipse(bt[0], bt[1], 3.1, 2.7, 'rgba(120,230,255,.9)');
            sEllipse(bt[0] - 0.6, bt[1] - 0.6, 1.3, 1.1, 'rgba(225,250,255,.95)');
          }
          return bt;
        }
        function pintle(fr, p, q, z, shield) {
          // a post, a machine gun on it, and a shield plate in front
          var base = S3(fr(p, q), z), top = S3(fr(p, q), z + 5);
          line(base, top, 1.4, STEEL);
          if (shield) slabF(fr, p + 0.08, p + 0.11, q - 0.14, q + 0.14, z + 3, 6, TS);
          var gp = barrel(fr, p - 0.08, p + 0.36, q, z + 6, 1.5, 'mg', { col: '#15181e' });
          var bx = S3(fr(p - 0.02, q + 0.05), z + 5);
          sEllipse(bx[0], bx[1], 1.6, 1.1, '#3c4233');           // the ammunition can
          return gp;
        }

        var tw = st.turret;
        if (tw) {
          var tdepth = depthOf(HF, tT, 0);
          var fwd = Math.cos(AIM) + Math.sin(AIM);                  // >0: the gun points toward us
          var body = function () {}, gun = function () {};
          switch (tw) {
            case 'light': case 'recon':
              body = function () {
                roundTurret(TR, 9);
                cupola(-TR * 0.12, -TR * 0.18, tz + 9);
                if (tw === 'recon') {
                  // the recon turret's cupola is its sight: the marker laser and the keen eye both look out of it
                  var cpm = S3(TF(-TR * 0.12, -TR * 0.18), tz + 11);
                  mount('nose', cpm); mount('scan', cpm);
                }
                smokeRack(TR, tz + 6);
                if (st.tMissiles) launcher(TF, -TR * 0.35, TR * 0.2, -TR * 0.74, -TR * 0.5, tz + 3, 6, 2, 2, 'missile', { warheads: '#6a5a3a' });
                if (tw === 'recon') {
                  aerial(TF, -TR * 0.4, TR * 0.3, tz + 9, 26); aerial(TF, -TR * 0.45, -TR * 0.3, tz + 9, 20);
                  aerial(HF, -L * 0.42, w * 0.6, roof, 22);
                  // a sensor head on a short mast
                  var mh = S3(TF(-TR * 0.25, 0), tz + 16);
                  line(S3(TF(-TR * 0.25, 0), tz + 9), mh, 1.3, STEEL);
                  sEllipse(mh[0], mh[1], 2.6, 1.8, STEEL); sEllipse(mh[0] + 1, mh[1] - 0.4, 1, 0.8, '#7fd8e8');
                }
              };
              gun = function () { barrel(TF, TR * 0.35, TR * (st.gunLen || 1.3), 0, tz + 5, st.gunW || 2.2, 'gun', { fume: 0.55, brake: true }); coaxMG(TR, tz + 4, TR * 0.16); };
              break;
            case 'mbt':
              body = function () {
                wedgeTurret(TR, 12, true);
                cupola(-TR * 0.22, -TR * 0.24, tz + 12);
                var sight = S3(TF(TR * 0.05, TR * 0.28), tz + 12);                // the gunner's sight box
                sEllipse(sight[0], sight[1] - 1, 2.2, 1.6, STEEL); sEllipse(sight[0] + 0.6, sight[1] - 1.2, 0.9, 0.7, GLINT);
                smokeRack(TR, tz + 9);
                aerial(TF, -TR * 0.52, TR * 0.3, tz + 11, 22);
                if (st.tMissiles) launcher(TF, -TR * 0.45, TR * 0.1, -TR * 0.7, -TR * 0.46, tz + 4, 7, 2, 2, 'missile', { warheads: '#6a5a3a' });
              };
              gun = function () {
                if (st.plasma) plasmaBarrel(TR * 0.3, TR * (st.gunLen || 2.15), tz + 6, st.gunW || 3.6);
                else barrel(TF, TR * 0.3, TR * (st.gunLen || 2.15), 0, tz + 6, st.gunW || 2.8, 'gun', { fume: 0.45, brake: !!st.gunW });
                coaxMG(TR, tz + 5, TR * 0.18);
              };
              break;
            case 'arty':
              // a self-propelled gun: a big boxy turret set back, the barrel laid up high
              body = function () {
                slabF(TF, -TR * 0.55, TR * 0.45, -TR * 0.5, TR * 0.5, tz, 12, TB, TR * 0.18, 0, TR * 0.04);
                cupola(-TR * 0.3, -TR * 0.28, tz + 12);
                aerial(TF, -TR * 0.5, TR * 0.34, tz + 12, 20);
                var mt = S3(TF(TR * 0.4, 0), tz + 7);
                sEllipse(mt[0], mt[1], 4.2, 3.6, mixc(hull, dark, 0.3));
              };
              gun = function () {
                /* An energy howitzer: the long ringed plasma barrel, laid up at the
                   sky the way an artillery piece's is (the advanced support vehicle). */
                if (st.energyGun) { plasmaBarrel(TR * 0.35, TR * (st.gunLen || 1.7), tz + 7, 4.6, 42); return; }
                if (st.stubGun) {
                  // a stubby howitzer: half the reach and much thicker, at the same angle
                  var a0b = TR * 0.4, reach = a0b + TR * 0.85;
                  barrel(TF, a0b, reach, 0, tz + 8, 5.4, 'gun', { up: Math.round(42 * (reach - a0b) / (TR * 1.25)), brake: true, fume: 0.4 });
                  return;
                }
                barrel(TF, TR * 0.35, TR * 1.6, 0, tz + 7, 3.2, 'gun', { up: 42, fume: 0.45, brake: true });
              };
              break;
            case 'howitzer':
              // a big slab-sided turret carrying a short, fat breaching howitzer
              body = function () {
                slabF(TF, -TR * 0.55, TR * 0.45, -TR * 0.46, TR * 0.46, tz, 13, TB, TR * 0.2, TR * 0.04, TR * 0.05);
                cupola(-TR * 0.25, -TR * 0.24, tz + 13);
                smokeRack(TR, tz + 9);
                aerial(TF, -TR * 0.5, TR * 0.32, tz + 13, 20);
              };
              gun = function () {
                // a plasma breaching gun: short and fat, out of the turret's front and level
                if (st.plasma) energyStub(TR * 0.4, tz + 7, TR * 0.9, 0);
                else barrel(TF, TR * 0.3, TR * 1.35, 0, tz + 6, 4.6, 'gun', { brake: true, up: 3, fume: 0.5 });
                coaxMG(TR, tz + 5, TR * 0.24);
              };
              break;
            case 'plasma':
              body = function () {
                wedgeTurret(TR, 13, false);
                cupola(-TR * 0.24, -TR * 0.26, tz + 13);
                // capacitor banks either side of the breech, glowing
                [-1, 1].forEach(function (sd) {
                  slabF(TF, -TR * 0.35, TR * 0.15, sd * TR * 0.3, sd * TR * 0.48, tz + 13, 4, TS);
                  if (!dead) { var cg = S3(TF(-TR * 0.1, sd * TR * 0.39), tz + 17.2); sEllipse(cg[0], cg[1], 2.6, 0.9, 'rgba(120,230,255,.75)'); }
                });
              };
              gun = function () { plasmaBarrel(TR * 0.3, TR * (st.gunLen || 1.9), tz + 7, 4.6); };
              break;
            case 'flamer':
              body = function () {
                wedgeTurret(TR, 11, false);
                cupola(-TR * 0.22, -TR * 0.24, tz + 11);
                smokeRack(TR, tz + 8);
              };
              gun = function () {
                var tip = barrel(TF, TR * 0.3, TR * 1.05, 0, tz + 5, 4.2, 'flame', { col: '#3a3f38', lit: '#5c6458' });
                // the pilot light at the nozzle: a small flame licking upward, flickering
                if (!dead) {
                  var ft = (root.performance ? performance.now() : 0) / 90, fk = Math.floor(ft) % 4;
                  var fh = [5, 7, 6, 8][fk], fs = [0, 0.8, 0, -0.8][fk];
                  poly(g, [[tip[0] - 2, tip[1]], [tip[0] + fs, tip[1] - fh], [tip[0] + 2, tip[1]]], '#e08a3a');
                  poly(g, [[tip[0] - 1, tip[1]], [tip[0] + fs * 0.6, tip[1] - fh * 0.55], [tip[0] + 1, tip[1]]], '#ffd070');
                  sEllipse(tip[0], tip[1], 1.6, 1.2, '#e08a3a');
                }
                coaxMG(TR, tz + 5, TR * 0.22);
              };
              break;
            case 'ifv':
              body = function () {
                roundTurret(TR, 8);
                cupola(-TR * 0.2, TR * 0.18, tz + 8);
                // a twin missile box on the turret's flank
                var sd = -1;
                launcher(TF, -TR * 0.3, TR * 0.25, sd * TR * 0.72, sd * TR * 0.48, tz + 3, 5, 1, 2, 'missile', { warheads: '#6a5a3a' });
                smokeRack(TR, tz + 6);
              };
              gun = function () { barrel(TF, TR * 0.3, TR * 1.55, 0, tz + 4, 1.4, 'auto', { brake: true }); coaxMG(TR, tz + 3.5, TR * 0.18); };
              break;
            case 'aa':
              body = function () {
                slabF(TF, -TR * 0.45, TR * 0.4, -TR * 0.36, TR * 0.36, tz, 9, TB, TR * 0.12, 0, TR * 0.04);
                if (!st.noMissiles) [-1, 1].forEach(function (sd) {
                  launcher(TF, -TR * 0.3, TR * 0.3, sd * TR * 0.5, sd * TR * 0.78, tz + 4, 6, 2, 2, 'missile', { up: 3, warheads: '#b8b0a0' });
                });
                // a tracking radar on the back of the turret
                var rm = S3(TF(-TR * 0.4, 0), tz + 9), rt = S3(TF(-TR * 0.4, 0), tz + 16);
                line(rm, rt, 1.2, STEEL);
                sEllipse(rt[0], rt[1], 4.6, 2.2, '#b9c2cc'); sEllipse(rt[0], rt[1] + 0.4, 3, 1.3, '#5d6775');
              };
              gun = function () {
                [-0.18, 0.18].forEach(function (b) { barrel(TF, TR * 0.25, TR * 1.3, TR * b, tz + 6, 1.4, 'auto', { up: 5, brake: true }); });
              };
              break;
            case 'dish':
              body = function () {
                roundTurret(TR, 8);
                var mb = S3(TF(-TR * 0.1, 0), tz + 8), mt = S3(TF(-TR * 0.1, 0), tz + 20);
                line(mb, mt, 1.6, STEEL);
                // the dish, tilted back, and its feed horn
                var dc = S3(TF(0.02, 0), tz + 24);
                sEllipse(dc[0], dc[1], 8.5, 6.5, '#8e98a4');
                sEllipse(dc[0] + 0.6, dc[1] + 0.4, 7.4, 5.5, '#c3ccd6');
                sEllipse(dc[0] + 1, dc[1] + 0.6, 4.5, 3.2, '#a8b2bd');
                var fh = S3(TF(0.2, 0), tz + 24);
                line(dc, fh, 0.8, STEEL); sEllipse(fh[0], fh[1], 1, 1, STEEL);
                aerial(HF, -L * 0.42, w * 0.6, roof, 24); aerial(HF, -L * 0.42, -w * 0.6, roof, 18);
              };
              gun = function () { coaxMG(TR, tz + 4, 0); };
              break;
            case 'calliope':
              body = function () {
                roundTurret(TR, 9);
                cupola(-TR * 0.2, -TR * 0.2, tz + 9);
                // the rocket frame riding over the turret, turning with it
                var fz = tz + 13;
                [-0.5, 0.5].forEach(function (b) {
                  line(S3(TF(-TR * 0.2, b * TR), tz + 7), S3(TF(-TR * 0.2, b * TR), fz), 1.2, STEEL);
                });
                launcher(TF, -TR * 0.55, TR * 0.55, -TR * 0.62, TR * 0.62, fz, 7, 2, 6, 'rocket', { up: 2, tone: TT, warheads: '#8a3a24' });
              };
              gun = function () { barrel(TF, TR * 0.3, TR * 1.2, 0, tz + 5, 2.2, 'gun', { brake: true }); };
              break;
            case 'mg':
              body = function () {
                slabF(TF, -TR * 0.35, TR * 0.3, -TR * 0.3, TR * 0.3, tz, 6, TB, TR * 0.08, 0, TR * 0.04);
                var ey = S3(TF(TR * 0.1, -TR * 0.2), tz + 7);
                sEllipse(ey[0], ey[1], 1.6, 1.2, STEEL); sEllipse(ey[0] + 0.4, ey[1] - 0.3, 0.7, 0.5, GLINT);
              };
              gun = function () { barrel(TF, TR * 0.2, TR * 0.9, 0, tz + 3.5, 1.5, 'mg', { col: '#15181e', brake: true }); };
              break;
            case 'missile':
              body = function () {
                roundTurret(TR, 7);
                launcher(TF, -TR * 0.35, TR * 0.35, -TR * 0.34, TR * 0.34, tz + 7, 7, 2, 2, 'missile', { up: 2, warheads: '#6a5a3a' });
              };
              gun = function () { coaxMG(TR, tz + 3, TR * 0.3); };
              break;
            case 'future':
              body = function () {
                var pts = [[TR * 0.62, -TR * 0.12], [TR * 0.62, TR * 0.12], [TR * 0.3, TR * 0.5], [-TR * 0.55, TR * 0.5],
                  [-TR * 0.65, TR * 0.3], [-TR * 0.65, -TR * 0.3], [-TR * 0.55, -TR * 0.5], [TR * 0.3, -TR * 0.5]];
                shape(TF, pts, tz, 9, TB, 0.86);
                // a missile cell on the right cheek, sensors on the roof
                launcher(TF, -TR * 0.2, TR * 0.32, TR * 0.5, TR * 0.72, tz + 2, 6, 2, 2, 'missile', { warheads: '#e8e3d8' });
                var sn = S3(TF(-TR * 0.3, -TR * 0.25), tz + 9);
                sEllipse(sn[0], sn[1] - 1.2, 2.2, 1.8, '#c9ced6'); sEllipse(sn[0], sn[1] - 1.8, 1.2, 0.9, '#eef2f6');
                aerial(TF, -TR * 0.6, -TR * 0.32, tz + 9, 26, 0.04); aerial(TF, -TR * 0.62, -TR * 0.18, tz + 9, 18, 0.04);
                // the dark sensor slit across the turret's face, one end of it lit
                edge(g, S3(TF(TR * 0.5, -TR * 0.3), tz + 5), S3(TF(TR * 0.5, TR * 0.3), tz + 5), '#0b0d11', 1.6);
                if (!dead) edge(g, S3(TF(TR * 0.5, -TR * 0.22), tz + 5), S3(TF(TR * 0.5, -TR * 0.06), tz + 5), '#7fd8e8', 0.9);
              };
              gun = function () {
                var ftip = st.plasma ? plasmaBarrel(TR * 0.4, TR * (st.gunLen || 2.3), tz + 5, 3.4)
                  : barrel(TF, TR * 0.4, TR * (st.gunLen || 2.3), 0, tz + 5, 2.2, 'gun', { col: '#262b33' });
                // the rail driver fires down the same barrel: its shots leave from the main gun's muzzle
                var fbase = S3(TF(TR * 0.4, 0), tz + 5);
                mount('rail', ftip, ftip[0] >= fbase[0] ? 1 : -1);
              };
              break;
          }
          if (pedestal) {
            var body0 = body;
            body = function () {
              // the post it turns on, from the bed floor up to the turret ring
              var pb = S3(TF(0, 0), roof), pt = S3(TF(0, 0), tz);
              line(pb, pt, 4.2, '#0c0f13'); line(pb, pt, 3.2, STEEL);
              sEllipse(pt[0], pt[1], TR * K * 0.28, TR * K * 0.14, mixc(hull, dark, 0.4));
              body0();
              // the cab, where it is nearer than the turret, hides the post and the turret's foot
              if (pickupFront) pickupFront();
            };
          }
          part(tdepth, fwd >= 0 ? function () { body(); gun(); } : function () { gun(); body(); });
        }

        // ---- fixed guns in a casemate ----
        if (st.casemate) {
          var cm = st.casemate, cmA = L * (cm.at != null ? cm.at : 0.08);
          var cmL = L * (cm.len || 0.55), cmH = cm.h || 9;
          part(depthOf(HF, cmA, 0), function () {
            var fwd2 = cos + sin;
            var gunFn = function () {
              barrel(HF, cmA + cmL * 0.4, L * (cm.gun || 1.1), 0, roof + cmH * 0.5, cm.w || 2.6, 'gun',
                { up: cm.up || 0, fume: cm.fume, brake: cm.brake });
            };
            if (fwd2 < 0) gunFn();
            slabF(HF, cmA - cmL * 0.5, cmA + cmL * 0.5, -w * 0.82, w * 0.82, roof, cmH, TB, cmL * 0.35, cmL * 0.08, w * 0.12);
            // a mantlet collar where the gun leaves the plate
            var mc = S3(HF(cmA + cmL * 0.36, 0), roof + cmH * 0.5);
            sEllipse(mc[0], mc[1], (cm.w || 2.6) * 1.5, (cm.w || 2.6) * 1.3, mixc(hull, dark, 0.3));
            hatch(HF, cmA - cmL * 0.2, w * 0.38, roof + cmH, 0.11);
            if (cm.missiles) {
              launcher(HF, cmA - cmL * 0.35, cmA + cmL * 0.15, -w * 0.9, -w * 0.5, roof + cmH, 6, 2, 2, 'missile', { up: 2, warheads: '#6a5a3a' });
            }
            if (fwd2 >= 0) gunFn();
          });
        }

        // ---- launchers and mounts on the hull ----
        if (st.pintle) part(depthOf(HF, L * st.pintle[0], w * st.pintle[1]), function () {
          pintle(frameAt(L * st.pintle[0], w * st.pintle[1], AIM), 0, 0, roof, st.shield);
        });
        if (st.bedGun) {
          var BGt = L * st.gunAt;
          part(depthOf(HF, BGt, 0), function () {
            var GF = frameAt(BGt, 0, AIM), gz = roof + H * 0.2;
            line(S3(GF(0, 0), roof), S3(GF(0, 0), gz), 2.2, STEEL);          // the post it turns on
            var shield = function () { slabF(GF, 0.1, 0.16, -w * 0.45, w * 0.45, gz - 2, 9, tone('#8a8f96', '#62676e', '#3a3e44', '#747980')); };
            var gun = function () {
              if (st.bedGun === 'auto') barrel(GF, -0.1, 0.62, 0, gz + 3, 2, 'auto', { brake: true, fume: 0.5 });
              else barrel(GF, -0.08, 0.45, 0, gz + 3, 1.4, 'mg', { col: '#15181e', brake: true });
              var bx = S3(GF(-0.05, w * 0.22), gz + 1);
              sEllipse(bx[0], bx[1], 2, 1.4, '#3c4233');                     // the ammunition box
            };
            if (Math.cos(AIM) + Math.sin(AIM) >= 0) { gun(); shield(); } else { shield(); gun(); }
          });
        }
        if (st.bedRack) {
          var RKt = L * st.rackAt;
          part(depthOf(HF, RKt, 0) - 0.001, function () {
            var RF = frameAt(RKt, 0, AIM);
            line(S3(RF(0, 0), roof), S3(RF(0, 0), roof + 5), 2, STEEL);
            launcher(RF, -0.2, 0.2, -w * 0.5, w * 0.5, roof + 5, 6, 2, 4, 'rocket', { up: 4, tone: tone('#9a6a44', '#7a4a2a', '#4a2c18', '#8a5a36'), warheads: '#8a3a24' });
          });
        }
        if (st.mrl) {
          var MF = frameAt(-L * 0.28, 0, AIM);
          part(depthOf(HF, -L * 0.28, 0), function () {
            line(S3(MF(0, 0), roof), S3(MF(0, 0), roof + 4), 2, STEEL);
            launcher(MF, -0.3, 0.3, -w * 0.62, w * 0.62, roof + 4, 6, 2, 6, 'rocket', { up: 6, tone: TT, warheads: '#8a3a24' });
          });
        }
        if (st.body === 'mlrs') {
          /* The cab stands up off the bed: with the nose towards the eye it goes on
             after the launcher and hides the lower end of it and its base; with the
             tail towards the eye the launcher goes over it. */
          var mw = w, mz = deck;
          part(depthOf(HF, L * 0.33, 0), function () {
            slabF(HF, L * 0.16, L * 0.5, -mw * 0.96, mw * 0.96, mz + H * 0.55, H * 0.8, TB, L * 0.1, 0, mw * 0.06);
            if (cos + sin > 0.02) {                          // the windscreen, only when the front faces us
              var m1 = S3(HF(L * 0.45, -mw * 0.78), mz + H * 0.75), m2 = S3(HF(L * 0.45, mw * 0.78), mz + H * 0.75);
              var m3 = S3(HF(L * 0.4, mw * 0.74), mz + H * 1.25), m4 = S3(HF(L * 0.4, -mw * 0.74), mz + H * 1.25);
              poly(g, [m1, m2, m3, m4], GLASS); edge(g, m4, m3, GLINT, 0.8);
            }
          });
        }
        if (st.mlrs) {
          var LF = frameAt(-L * 0.18, 0, AIM);
          part(depthOf(HF, -L * 0.18, 0), function () {
            slabF(LF, -0.26, 0.26, -w * 0.5, w * 0.5, roof, 4, TS);
            /* The far pod first, so the near one covers it. The pods traverse with
               the launcher, so which is near goes by where it is aimed, not by the
               hull: facing west with a target in the east, the launcher is turned
               right round and the hull's near flank is the pods' far one. */
            var nsL = nearSideAt(AIM);
            [-nsL, nsL].forEach(function (sd) {
              launcher(LF, -L * 0.3, L * 0.26, Math.min(sd * w * 0.04, sd * w * 0.9), Math.max(sd * w * 0.04, sd * w * 0.9), roof + 4, 10, 2, 3, 'rocket', { up: 15, tone: TB, warheads: '#15181e' });
            });
          });
        }
        if (st.cross) part(depthOf(HF, 0, 0) - 0.01, function () { crossOn(HF, -L * 0.08, 0, roof + 0.3, 0.3); });
        if (st.aerials) part(depthOf(HF, -L * 0.4, 0), function () {
          for (var i = 0; i < st.aerials; i++) {
            var sd = i % 2 ? 1 : -1;
            aerial(HF, -L * (0.3 + 0.06 * (i >> 1)), sd * w * 0.7, roof, 20 + (i % 3) * 5);
          }
        });
        if (st.rws) part(depthOf(HF, L * 0.1, 0), function () {
          var RF = frameAt(L * 0.1, -w * 0.3, AIM);
          slabF(RF, -0.12, 0.1, -0.1, 0.1, roof, 4, TS);
          barrel(RF, 0, 0.42, 0, roof + 3, 1.4, 'mg', { col: '#15181e', brake: true });
        });

        if (droneDue()) {
          var dsp = droneSpot(), asp = along(-L * 0.44, Wd * 0.32);
          part(dsp.x + dsp.y, function () { droneKit('dome'); });
          part(asp.x + asp.y, function () { droneKit('aerial'); });
          droneMark();
        }
        parts.sort(function (p, q) { return p.d - q.d; }).forEach(function (p) { p.fn(); });
      }
      return { rearTank: rearTank, styledHull: styledHull, skirts: skirts, styledTop: styledTop };
    };
  };
})(window);
