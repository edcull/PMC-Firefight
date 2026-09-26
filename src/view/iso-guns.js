/* PMC 2670 — Firefight : the crew-served guns: field guns, mortars, launchers and turrets standing on the table - on their carriages or dug in, turned to their facing, on tow behind a hull, and knocked out - with the crews that work them.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoGuns = function (B) {
    var a = B.a, ellipse = B.ellipse, hullSpec = B.hullSpec, poly = B.poly, thickLine = B.thickLine;
    var toScreen = B.toScreen, K = B.K, PH = B.PH, W = B.W;
    // from modules installed after this one: looked up when called
    function R0() { return B.R0.apply(this, arguments); }
    function box() { return B.box.apply(this, arguments); }

    /* ---------- crew-served pieces ----------
       The mortars and tripod weapons are drawn in 3D (PIECE3D, below); how many
       pieces a unit works: */
    var PIECE_COUNT = { mortarsection: 1, mortarteam: 2, mortarbattery: 3 };
    /* A gun on tow (Stationary Artillery, p. 94): hitched behind the vehicle
       towing it, its trails towards the hull on a tow bar, barrel level. */
    function towedGun(u) {
      return (u.cargo || []).filter(function (c) { return c && (c.rules || []).indexOf('Stationary Artillery') >= 0; })[0] || null;
    }
    /* A field gun drawn as a machine is (the rebels' salvaged howitzers): built
       on its own axes, so it turns through every facing. `o` gives the axle's
       place on the table (x, y), the way the muzzle points (aim), the piece's
       palette, whether it is the heavy piece, and how it stands:
         'tow'   — trails closed for the road, barrel level, on the tow bar to `hitch`;
         'fire'  — trails split and spaded in, the barrel laid well up;
         'dug'   — Dig in! (p. 94): the barrel brought down level to fire over
                   open sights, a wall of sandbags built up round the front;
         'wreck' — knocked out: slewed, a wheel gone, the barrel down in the dirt.
       `o.extra` are other things to be sorted in with its parts by depth — the
       crew standing round it — each { d: x + y on the table, fn }. */
    var GUN_ELEV = 0.82;                                  // laid for indirect fire: up at the arc its rounds fly
    function fieldGun(g, o) {
      var mode = o.mode || 'fire', wreck = mode === 'wreck', k = o.k || 1;
      /* Two frames: the carriage (wheels, trails, axle, crates, sandbags) on the
         unit's facing, and the cradle, shield and barrel traversed onto the
         target (`o.top`) like a turret. `use` switches between them. */
      var FA = o.aim || 0, FT = o.top != null ? o.top : FA, ca, sa;
      function use(a1) { ca = Math.cos(a1); sa = Math.sin(a1); }
      use(FA);
      var ZK = K * 0.9;                                           // pixels to an inch of height
      // t along the gun's own axis (muzzle end +), s across it, z up, all in inches
      function W(t, s2) { return { x: o.x + (ca * t + sa * s2) * k, y: o.y + (sa * t - ca * s2) * k }; }
      function S(t, s2, z) { var w = W(t, s2), q = toScreen(w.x, w.y); return [q.x, q.y - z * ZK * k - (o.lift || 0)]; }
      function dep(t, s2) { var w = W(t, s2); return w.x + w.y; }
      var big = o.heavy ? 1.18 : 1, pal = o.pal || B.PALETTE.A;
      var STL = '#4a5244', LIT = '#6c7662', DRK = '#2b3128', DEEP = '#1c211b';
      if (wreck) { STL = '#3a3832'; LIT = '#4d4a42'; DRK = '#25231f'; DEEP = '#171613'; }
      var DISC = wreck ? '#2a2620' : (function () {
        var a0 = [0x45, 0x4d, 0x58], m = String(pal.mid).replace('#', ''), out = '#';
        for (var i = 0; i < 3; i++) out += ('0' + Math.round(a0[i] * 0.75 + parseInt(m.substr(i * 2, 2), 16) * 0.25).toString(16)).slice(-2);
        return out;                                       // the vehicles' steel, a quarter the company's colour
      })();
      var zAx = 0.27 * big, rW = 0.27 * big, wS = 0.36 * big, tw = 0.11 * big;
      // the barrel pivots on its trunnions over the axle; laid up to fire, level on the road or dug in
      var elev = mode === 'fire' ? GUN_ELEV : mode === 'dug' ? 0.12 : wreck ? -0.27 : 0;
      var zP = 0.35 * big, ce = Math.cos(elev), se = Math.sin(elev);
      function B(L, s2, h) { return [L * ce - h * se, s2, zP + L * se + h * ce]; }   // barrel frame to gun frame
      /* A box on the gun's own axes, its three faces that can be seen shaded as
         a hull's are: the top lit, a flank mid-tone, an end dark. */
      function box(t0, t1, s0, s1, z0, z1, top, side, end) {
        var tm = (t0 + t1) / 2, sm = (s0 + s1) / 2;
        var sv = dep(tm, s1) > dep(tm, s0) ? s1 : s0;           // the flank towards the eye
        var tv = dep(t1, sm) > dep(t0, sm) ? t1 : t0;           // the end towards the eye
        poly(g, [S(t0, sv, z0), S(t1, sv, z0), S(t1, sv, z1), S(t0, sv, z1)], side || STL);
        poly(g, [S(tv, s0, z0), S(tv, s1, z0), S(tv, s1, z1), S(tv, s0, z1)], end || DRK);
        poly(g, [S(t0, s0, z1), S(t1, s0, z1), S(t1, s1, z1), S(t0, s1, z1)], top || LIT);
      }
      /* A beam from one point to another across the ground, `hw` either side of
         its line, its bottom and top at each end: a trail, a spade, a sandbag. */
      function beam(p0, p1, hw, zb0, zt0, zb1, zt1, top, side, end) {
        var dt = p1[0] - p0[0], ds = p1[1] - p0[1], l = Math.hypot(dt, ds) || 1;
        var nt = -ds / l * hw, ns = dt / l * hw;
        var sd = dep(p0[0] + nt, p0[1] + ns) > dep(p0[0] - nt, p0[1] - ns) ? 1 : -1;
        var e = dep(p1[0], p1[1]) > dep(p0[0], p0[1]), pe = e ? p1 : p0, zb = e ? zb1 : zb0, zt = e ? zt1 : zt0;
        poly(g, [S(p0[0] + sd * nt, p0[1] + sd * ns, zb0), S(p1[0] + sd * nt, p1[1] + sd * ns, zb1),
          S(p1[0] + sd * nt, p1[1] + sd * ns, zt1), S(p0[0] + sd * nt, p0[1] + sd * ns, zt0)], side || STL);
        poly(g, [S(pe[0] + nt, pe[1] + ns, zb), S(pe[0] - nt, pe[1] - ns, zb), S(pe[0] - nt, pe[1] - ns, zt), S(pe[0] + nt, pe[1] + ns, zt)], end || DRK);
        poly(g, [S(p0[0] + nt, p0[1] + ns, zt0), S(p1[0] + nt, p1[1] + ns, zt1), S(p1[0] - nt, p1[1] - ns, zt1), S(p0[0] - nt, p0[1] - ns, zt0)], top || LIT);
      }
      // a tube along the barrel: a dark body, a mid band and a lit top line
      function tube(L0, L1, r, h, cols) {
        cols = cols || [DRK, STL, LIT];
        var q0 = B(L0, 0, h || 0), q1 = B(L1, 0, h || 0);
        var a0 = S(q0[0], 0, q0[2]), a1 = S(q1[0], 0, q1[2]), w = Math.max(1.5, 2 * r * K * k);
        thickLine(g, a0[0], a0[1], a1[0], a1[1], w, cols[0]);
        thickLine(g, a0[0], a0[1] - w * 0.18, a1[0], a1[1] - w * 0.18, Math.max(1, w * 0.55), cols[1]);
        thickLine(g, a0[0], a0[1] - w * 0.34, a1[0], a1[1] - w * 0.34, Math.max(0.8, w * 0.2), cols[2]);
      }
      /* A road wheel as a solid: a tyre with width, its tread band joining the
         inner face to the outer, so it still reads edge-on; the face towards the
         eye goes on last, with its rim and hub. */
      function wheel(sd) {
        var N = 18, sIn = sd * (wS - tw / 2), sOut = sd * (wS + tw / 2);
        function ring(s2, r) {
          var out = [];
          for (var a2 = 0; a2 < N; a2++) {
            var an = a2 / N * Math.PI * 2;
            out.push(S(Math.cos(an) * r, s2, zAx + Math.sin(an) * r));
          }
          return out;
        }
        var nearOut = dep(0, sOut) > dep(0, sIn), far = nearOut ? sIn : sOut, near = nearOut ? sOut : sIn;
        var fr = ring(far, rW), nr = ring(near, rW);
        // in the vehicles' own wheel colours: dark tyre, steel rim, a disc tinted with the company's colour
        poly(g, fr, '#0b0e12');
        for (var q = 0; q < N; q++) {                      // the tread, a band of quads round the tyre
          var q2 = (q + 1) % N;
          poly(g, [fr[q], fr[q2], nr[q2], nr[q]], q % 2 ? '#101318' : '#14181d');
        }
        poly(g, nr, '#161a20');
        var ti = ring(near, rW * 0.82);
        for (var tb = 0; tb < N; tb += 2) {                // tread blocks round the rim
          var tp = nr[tb];
          thickLine(g, ti[tb][0], ti[tb][1], tp[0], tp[1], Math.max(0.8, K * k * 0.02), '#272c34');
        }
        poly(g, ring(near, rW * 0.6), '#2b313a');          // the rim
        poly(g, ring(near, rW * 0.52), DISC);              // the wheel's disc
        poly(g, ring(near, rW * 0.2), '#1a1e25');          // its hub
        for (var nb = 0; nb < 5; nb++) {                   // wheel nuts
          var na = nb / 5 * Math.PI * 2, np = S(Math.cos(na) * rW * 0.32, near, zAx + Math.sin(na) * rW * 0.32);
          ellipse(g, np[0], np[1], Math.max(0.5, K * k * 0.012), Math.max(0.5, K * k * 0.012), '#58616d');
        }
      }
      var sT = 0.13, sw2 = 0.32 * big, sH = (wreck ? 0.5 : 0.72) * big;   // where the shield stands, its half width and its top
      var parts = [];
      function part(t, s2, fn, top) {
        var fa = top ? FT : FA;
        use(fa);
        parts.push({ d: dep(t, s2), fn: function () { use(fa); fn(); use(FA); } });
        use(FA);
      }
      part(0, -wS, function () { wheel(-1); });
      if (!wreck) part(0, wS, function () { wheel(1); });
      else part(0, wS, function () {                       // the stub where the other wheel was
        var h0 = S(0, wS * 0.6, zAx), h1 = S(0, wS * 1.1, zAx * 0.45);
        thickLine(g, h0[0], h0[1], h1[0], h1[1], Math.max(1.5, K * k * 0.07), DEEP);
      });
      if (mode === 'tow') {
        part(-0.45, 0, function () {
          // the split trails, closed together for the road, a spade at the end and the towing eye
          box(-0.78 * big, 0.02, -0.11, -0.03, 0.1, 0.17);
          box(-0.78 * big, 0.02, 0.03, 0.11, 0.1, 0.17);
          box(-0.84 * big, -0.76 * big, -0.14, 0.14, 0.03, 0.2, STL, DRK, DEEP);
          var ey = S(-0.9 * big, 0, 0.13);
          ellipse(g, ey[0], ey[1], K * k * 0.06, K * k * 0.04, DEEP);
          ellipse(g, ey[0], ey[1], K * k * 0.03, K * k * 0.02, '#0e110d');
        });
      } else {
        // the trails split wide and their spades bedded in; a wreck's are knocked askew
        [-1, 1].forEach(function (sd) {
          var end = wreck && sd > 0 ? [-0.62 * big, 0.78 * big] : [-0.86 * big, sd * 0.42 * big];
          part((end[0] - 0.05) / 2, end[1] / 2, function () {
            beam([-0.02, sd * 0.07], end, 0.04, 0.12, 0.2, 0.0, 0.09);
            var l = Math.hypot(end[0], end[1] - sd * 0.07), ut = end[0] / l, us = (end[1] - sd * 0.07) / l;
            beam([end[0] - us * 0.12, end[1] + ut * 0.12], [end[0] + us * 0.12, end[1] - ut * 0.12], 0.025, -0.02, 0.14, -0.02, 0.14, STL, DRK, DEEP);
          });
        });
        // ready rounds and a crate of charges in the company's colours
        part(-0.3, 0.6, function () {
          box(-0.42, -0.18, 0.5, 0.7, 0, 0.14, wreck ? LIT : pal.mid, wreck ? STL : pal.dark, wreck ? DRK : pal.dark);
        });
        if (!wreck) part(-0.55, -0.62, function () {
          box(-0.66, -0.44, -0.72, -0.52, 0, 0.12, '#6a5a3a', '#4a4438', '#3a342a');
          for (var r = 0; r < 3; r++) {                     // shells stood ready
            var b0 = S(-0.62 + r * 0.07, -0.47, 0), b1 = S(-0.62 + r * 0.07, -0.47, 0.2);
            thickLine(g, b0[0], b0[1], b1[0], b1[1], Math.max(1, K * k * 0.045), '#8a5a2a');
          }
        });
      }
      part(-0.03, 0, function () {                         // the axle
        var x0 = S(0, -wS, zAx), x1 = S(0, wreck ? wS * 0.6 : wS, zAx);
        thickLine(g, x0[0], x0[1], x1[0], x1[1], Math.max(1.5, K * k * 0.07), DEEP);
      });
      part(-0.02, 0, function () {
        // the cradle on the axle, and the breech end of the gun behind the shield
        box(-0.16, 0.12, -0.1, 0.1, zAx, 0.42 * big);
        tube(-0.18, sT, 0.075 * big, 0);                    // the recoil sleeve
        tube(-0.08, sT, 0.04 * big, 0.12 * big);            // the recuperator over it
        tube(-0.27, -0.16, 0.085 * big, 0, [DEEP, DRK, STL]);   // the breech
      }, true);
      /* The shield: two wings swept back from the barrel in a shallow V, so the
         plate still shows its face from the side; a sight slot in the left wing,
         a stripe of the company's colour along the top of each. */
      var SW = 0.13 * big;                                 // how far back each wing sweeps
      [-1, 1].forEach(function (sd) {
        var p0 = [sT, 0], p1 = [sT - SW, sd * sw2];
        part(sT - SW * 0.5 + 0.02, sd * sw2 * 0.5, function () {
          beam(p0, p1, 0.014, 0.22, sH, 0.22, sH - 0.04 * big, LIT, STL, DRK);
          var l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), nt = -(p1[1] - p0[1]) / l, ns = (p1[0] - p0[0]) / l;
          var vs = dep(p0[0] + nt * 0.1, p0[1] + ns * 0.1) > dep(p0[0] - nt * 0.1, p0[1] - ns * 0.1) ? 1 : -1;
          var off = 0.016 * vs;
          function F(f, z) { return S(p0[0] + (p1[0] - p0[0]) * f + nt * off, p0[1] + (p1[1] - p0[1]) * f + ns * off, z); }
          if (sd < 0 && !wreck) poly(g, [F(0.35, 0.5 * big), F(0.62, 0.5 * big), F(0.62, 0.55 * big), F(0.35, 0.55 * big)], DEEP);
          var z1 = sH - 0.06 * big, st0 = F(0.03, z1), st1 = F(0.97, z1 - 0.04 * big);
          thickLine(g, st0[0], st0[1], st1[0], st1[1], Math.max(1, K * k * 0.035), wreck ? '#3a2e24' : pal.mid);
        }, true);
      });
      // dug in, the barrel is laid out over the sandbag wall, so it goes on after the bags
      part(mode === 'dug' ? 1.4 * big : B(0.6, 0, 0)[0], 0, function () {
        // the barrel, tapering out past the shield, and its muzzle brake
        tube(sT, 0.55 * big, 0.06 * big);
        tube(0.55 * big, 1.0 * big, 0.048 * big);
        tube(0.98 * big, 1.1 * big, 0.075 * big, 0, [DRK, STL, LIT]);
        [-1, 1].forEach(function (sd) {                    // the brake's baffle slots
          var m0 = B(1.03 * big, sd * 0.076 * big, -0.05 * big), m1 = B(1.03 * big, sd * 0.076 * big, 0.05 * big);
          var q0 = S(m0[0], m0[1], m0[2]), q1 = S(m1[0], m1[1], m1[2]);
          if (dep(0, sd) > dep(0, -sd)) thickLine(g, q0[0], q0[1], q1[0], q1[1], 1, DEEP);
        });
      }, true);
      if (mode === 'dug') {
        /* The sandbag wall (p. 94): three courses round the front of the piece,
           low enough for the barrel, laid level, to clear. */
        var R0 = 0.62 * big;
        for (var c2 = 0; c2 < 3; c2++) {
          for (var bg = -5; bg <= 5; bg++) {              // across about 60° either side of the line of fire
            (function (c3, th) {
              var d0 = th - 0.1, d1 = th + 0.1;
              part(Math.cos(th) * R0, Math.sin(th) * R0, function () {
                beam([Math.cos(d0) * R0, Math.sin(d0) * R0], [Math.cos(d1) * R0, Math.sin(d1) * R0], 0.075,
                  c3 * 0.095, c3 * 0.095 + 0.1, c3 * 0.095, c3 * 0.095 + 0.1, '#8e836a', '#6e6450', '#5a5242');
              });
            })(c2, bg * 0.2 + (c2 % 2 ? 0.1 : 0));
          }
        }
      }
      (o.extra || []).forEach(function (x) { parts.push(x); });
      if (wreck) {                                         // the scorched patch it was knocked out on
        var sc = S(0, 0, 0);
        ellipse(g, sc[0], sc[1], K * k * 1.0, K * k * 0.5, 'rgba(20,16,12,.55)');
      }
      if (o.hitch) {                                       // the tow bar, from the trail's end to the hitch
        var te = S(-0.8 * big, 0, 0.13), hq = toScreen(o.hitch.x, o.hitch.y);
        thickLine(g, te[0], te[1], hq.x, hq.y - 0.3 * ZK, Math.max(1.5, K * 0.05), '#2b2f2a');
      }
      var wasSmooth = PH.smooth;
      PH.smooth = true;                                     // drawn as a machine is: filled, not dithered
      try { parts.sort(function (p1, p2) { return p1.d - p2.d; }).forEach(function (p1) { p1.fn(); }); }
      finally { PH.smooth = wasSmooth; }
    }
    // where a field gun's muzzle is, on the table and above it (see fieldGun)
    function fieldMuzzle(o) {
      var big = o.heavy ? 1.18 : 1, k = o.k || 1, L = 1.1 * big;
      var elev = o.mode === 'fire' ? GUN_ELEV : o.mode === 'dug' ? 0.12 : 0;
      var t = L * Math.cos(elev), z = 0.35 * big + L * Math.sin(elev);
      var ang = o.top != null ? o.top : (o.aim || 0), ca = Math.cos(ang), sa = Math.sin(ang);
      return { x: o.x + ca * t * k, y: o.y + sa * t * k, up: z * K * 0.9 * k };
    }
    /* A gun on tow, hitched behind the vehicle towing it: its trails run forward
       to the hitch and the barrel points back the way the vehicle has come. */
    function drawTowed(g, veh, gun, at) {
      var hs = hullSpec(veh.art) || { len: 2 }, f = veh.facing || 0;
      var fx = Math.cos(f), fy = Math.sin(f);
      if (PIECE3D[gun.art]) { towedPiece(g, veh, gun, at, hs, f); return; }
      var back = hs.len * 0.5 + 0.8;
      fieldGun(g, {
        x: at.x - fx * back, y: at.y - fy * back, aim: f + Math.PI, mode: 'tow',
        heavy: /heavy/.test(gun.key || ''), pal: B.PALETTE[gun.paint || gun.side] || B.PALETTE.A,
        hitch: { x: at.x - fx * hs.len * 0.5, y: at.y - fy * hs.len * 0.5 }
      });
    }
    /* A tripod weapon on tow (the heavy autocannon): lifted onto a little
       two-wheeled trailer, its legs folded along the bed, the barrel back over
       the tail, the A-frame drawbar on the vehicle's hook. */
    function towedPiece(g, veh, gun, at, hs, f) {
      var P = PIECE3D[gun.art], k = P.k, fx = Math.cos(f), fy = Math.sin(f);
      var back = hs.len * 0.5 + (P.wheeled ? 0.79 : 0.85) * k + (P.wheeled ? 0.02 : 0.1);   // a short hitch to the hook
      if (P.wheeled) {                                    // on its own wheels, the trails closed into a drawbar
        var ow = { x: at.x - fx * back, y: at.y - fy * back, aim: f + Math.PI, k: k };
        var Gw = rig(g, ow);
        P.build(Gw, { pal: B.PALETTE[gun.paint || gun.side] || B.PALETTE.A, g: g, tow: true });
        var ew = Gw.S(-0.75, 0, 0.18), hw = toScreen(at.x - fx * hs.len * 0.5, at.y - fy * hs.len * 0.5);
        thickLine(g, ew[0], ew[1], hw.x, hw.y - 0.3 * K * 0.9, Math.max(1.5, K * 0.05), '#2b2f2a');
        var wasW = PH.smooth;
        PH.smooth = true;
        try { Gw.parts.sort(function (p1, p2) { return p1.d - p2.d; }).forEach(function (p1) { p1.fn(); }); }
        finally { PH.smooth = wasW; }
        return;
      }
      var o = { x: at.x - fx * back, y: at.y - fy * back, aim: f + Math.PI, k: k };
      var pal = B.PALETTE[gun.paint || gun.side] || B.PALETTE.A;
      var T = rig(g, o), G = rig(g, { x: o.x, y: o.y, aim: o.aim, k: k, z0: -0.04 });
      T.part(0, -0.3, function () { T.wheel(0, -0.3, 0.17, 0.08); });
      T.part(0, 0.3, function () { T.wheel(0, 0.3, 0.17, 0.08); });
      T.part(-0.05, 0, function () {
        T.rod([0, -0.3, 0.17], [0, 0.3, 0.17], 0.025, [T.DEEP, T.DRK, T.STL]);          // the axle
        T.box(-0.28, 0.26, -0.21, 0.21, 0.2, 0.26);                                      // the bed
        [-1, 1].forEach(function (sd) { T.rod([-0.26, sd * 0.18, 0.22], [-0.72, 0, 0.2], 0.018, [T.DEEP, T.DRK, T.STL]); });
        T.dot([-0.74, 0, 0.2], 0.035, T.DEEP);                                           // the towing eye
      });
      // the tripod's legs, folded and strapped along the bed
      G.tripod = function () {
        G.part(-0.1, 0, function () {
          [-0.1, 0, 0.1].forEach(function (sd) { G.rod([-0.3, sd, 0.32], [0.24, sd, 0.32], 0.022, [G.DEEP, G.DRK, G.STL]); });
        });
      };
      P.build(G, { pal: pal, g: g });
      var te = T.S(-0.74, 0, 0.2), hq = toScreen(at.x - fx * hs.len * 0.5, at.y - fy * hs.len * 0.5);
      thickLine(g, te[0], te[1], hq.x, hq.y - 0.3 * K * 0.9, Math.max(1.5, K * 0.05), '#2b2f2a');
      var was = PH.smooth;
      PH.smooth = true;
      try { T.parts.concat(G.parts).sort(function (p1, p2) { return p1.d - p2.d; }).forEach(function (p1) { p1.fn(); }); }
      finally { PH.smooth = was; }
    }
    /* What is left of a crew-served weapon when the last of its crew falls:
       each piece knocked down and leaning over, burnt dark, on a scorched patch. */
    function pieceWreck(g, b, wp) {
      var P = PIECE3D[b.art];
      var u = { key: b.key, art: b.art, facing: (b.aim != null ? b.aim : 0) + 0.4, side: b.side };
      var pal = B.PALETTE[b.paint || b.side] || B.PALETTE.A, all = [];
      pieces3D(u, wp).forEach(function (pc) {
        var sc = toScreen(pc.x, pc.y);
        ellipse(g, sc.x, sc.y, K * 0.55 * pc.k, K * 0.28 * pc.k, 'rgba(20,16,12,.5)');
        var R = rig(g, { x: pc.x, y: pc.y, aim: pc.aim, k: pc.k, wreck: !P.wreck });
        (P.wreck || P.build)(R, { pal: pal, g: g });
        all = all.concat(R.parts);
      });
      g.save();
      try { g.filter = 'saturate(0.2) brightness(0.55) sepia(0.35)'; } catch (e) { /* no filters: left unburnt */ }
      var was = PH.smooth;
      PH.smooth = true;
      try { all.sort(function (p1, p2) { return p1.d - p2.d; }).forEach(function (p1) { p1.fn(); }); }
      finally { PH.smooth = was; g.restore(); }
    }
    /* A rebel field piece stands on the table as a machine does, facing where it
       last fired, its crew round the trails; the unit's point is between them. */
    var FIELD_GUN = { rebelgun: true };
    var GUN_K = 1.2;                                      // the piece's size on the table
    var GUN_CREW = [[-0.35, -0.62], [-0.35, 0.62], [-0.8, -0.72], [-0.8, 0.72], [-1.2, -0.3], [-1.2, 0.3], [-0.55, 0], [-1.45, 0]];
    function gunOpts(u, at, mode) {
      var pa = pieceAngles(u), f = pa.f;
      return {
        x: at.x + Math.cos(f) * 0.35 * GUN_K, y: at.y + Math.sin(f) * 0.35 * GUN_K, aim: f, top: pa.top, k: GUN_K,
        mode: mode || (u.dugIn ? 'dug' : 'fire'), heavy: /heavy/.test(u.key || ''),
        pal: B.PALETTE[u.paint || u.side] || B.PALETTE.A
      };
    }
    /* Where a piece's weapon points: laid on what it last fired at (u.aim) when
       that is within 45° of the way its mount faces, like a turret on a hull;
       otherwise straight ahead. */
    function gunTop(u, f) {
      if (u.aim == null) return f;
      var d = angWrap(u.aim - f);
      return f + Math.max(-Math.PI / 4, Math.min(Math.PI / 4, d));
    }
    function angWrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
    function angGap(a1, a0) { return angWrap(a1 - a0); }
    /* Where a piece's mount faces (f) and its weapon points (top) this frame.
       When it has just been given a new lay (u._turn, see startTurn) it gets
       there in two moves: the carriage swings round to its new facing with the
       gun carried as it was, then the gun traverses onto the target. */
    function pieceAngles(u) {
      var f = u.facing == null ? (u.side === 'B' ? Math.PI : 0) : u.facing, tr = u._turn;
      if (tr) {
        var el = Date.now() - tr.t0;
        if (el < tr.d1 + tr.d2) {
          if (el < tr.d1) {
            var k1 = el / tr.d1; k1 = k1 * k1 * (3 - 2 * k1);
            var fi = tr.f0 + angGap(tr.f1, tr.f0) * k1;
            return { f: fi, top: fi + tr.off0 };
          }
          var k2 = (el - tr.d1) / tr.d2; k2 = k2 * k2 * (3 - 2 * k2);
          var t0 = tr.f1 + tr.off0;
          return { f: tr.f1, top: t0 + angGap(tr.top1, t0) * k2 };
        }
      }
      return { f: f, top: gunTop(u, f) };
    }
    /* Give a piece its new lay to play: from where it pointed (u._turnFrom, left
       by the rules when it fired) to where it points now. Answers how long the
       swing takes, in ms, so the shot can wait for it; 0 when there is none. */
    function startTurn(u) {
      var from = u._turnFrom;
      delete u._turnFrom;
      if (!from || !(PIECE3D[u.art] || FIELD_GUN[u.art])) return 0;
      var dflt = u.side === 'B' ? Math.PI : 0;
      var f0 = from.f == null ? dflt : from.f, top0 = gunTop({ aim: from.a }, f0);
      var f1 = u.facing == null ? dflt : u.facing, top1 = gunTop(u, f1), off0 = angGap(top0, f0);
      var d1 = Math.abs(angGap(f1, f0)) / Math.PI * 1100, d2 = Math.abs(angGap(top1, f1 + off0)) / Math.PI * 900;
      if (d1 + d2 < 60) return 0;
      u._turn = { t0: Date.now(), d1: Math.max(1, d1), d2: Math.max(1, d2), f0: f0, f1: f1, off0: off0, top1: top1 };
      return Math.max(1, d1) + Math.max(1, d2);
    }
    // does the crew face left on the screen, working a gun pointed this way?
    function gunFaceL(aim) { return Math.cos(aim) - Math.sin(aim) < 0; }
    /* ---------- crew-served pieces as machines ----------
       The mortars and the weapons on tripods, built on their own axes as the
       field gun is, so each turns through every facing with its crew knelt
       round it. `rig` gives a piece's frame: t along its line of fire, s across,
       z up, in inches from its foot, and the shaded parts it is made of. */
    /* A piece is built on two frames sharing one list of parts: its mount (the
       tripod or carriage, wheels, sandbags, the crates by it) on the unit's
       facing, and the weapon itself traversed onto the target like a turret
       (`o.top`, within the mount's arc). The weapon's frame is the one returned;
       `R.base` is the mount's, and the tripod, wheels and sandbags use it. */
    function rig(g, o) {
      var parts = [];
      var B = frameRig(g, o, o.aim || 0, parts);
      var T = frameRig(g, o, o.top != null ? o.top : (o.aim || 0), parts);
      T.base = B; T.tripod = B.tripod; T.wheel = B.wheel; T.sandbags = B.sandbags;
      return T;
    }
    function frameRig(g, o, ang, parts) {
      var k = o.k || 1, ca = Math.cos(ang), sa = Math.sin(ang), ZK = K * 0.9;
      function W(t, s2) { return { x: o.x + (ca * t + sa * s2) * k, y: o.y + (sa * t - ca * s2) * k }; }
      /* `o.z0` stands the whole piece higher or lower (on a trailer's bed);
         `o.wreck` knocks it down: sagged toward the ground and leaning over. */
      function S(t, s2, z) {
        z += o.z0 || 0;
        if (o.wreck) { s2 += z * 0.55; z = Math.max(0.01, z * 0.4); }
        var w = W(t, s2), q = toScreen(w.x, w.y); return [q.x, q.y - z * ZK * k - (o.lift || 0)];
      }
      function dep(t, s2) { var w = W(t, s2); return w.x + w.y; }
      var R = { S: S, W: W, dep: dep, k: k, parts: parts,
        STL: '#4a5244', LIT: '#6c7662', DRK: '#2b3128', DEEP: '#1c211b' };
      // `over`: a part standing above a dug-in piece's sandbags (its barrel), drawn after them
      R.part = function (t, s2, fn, over) { R.parts.push({ d: dep(t, s2), fn: fn, over: !!over }); };
      R.box = function (t0, t1, s0, s1, z0, z1, top, side, end) {
        var tm = (t0 + t1) / 2, sm = (s0 + s1) / 2;
        var sv = dep(tm, s1) > dep(tm, s0) ? s1 : s0, tv = dep(t1, sm) > dep(t0, sm) ? t1 : t0;
        poly(g, [S(t0, sv, z0), S(t1, sv, z0), S(t1, sv, z1), S(t0, sv, z1)], side || R.STL);
        poly(g, [S(tv, s0, z0), S(tv, s1, z0), S(tv, s1, z1), S(tv, s0, z1)], end || R.DRK);
        poly(g, [S(t0, s0, z1), S(t1, s0, z1), S(t1, s1, z1), S(t0, s1, z1)], top || R.LIT);
      };
      // a round bar or tube between two points (t, s, z): dark body, mid band, lit line
      R.rod = function (p0, p1, r, cols) {
        cols = cols || [R.DRK, R.STL, R.LIT];
        var a0 = S(p0[0], p0[1], p0[2]), a1 = S(p1[0], p1[1], p1[2]), w = Math.max(1, 2 * r * K * k);
        thickLine(g, a0[0], a0[1], a1[0], a1[1], w, cols[0]);
        if (w >= 2.5) {
          thickLine(g, a0[0], a0[1] - w * 0.18, a1[0], a1[1] - w * 0.18, Math.max(1, w * 0.55), cols[1]);
          thickLine(g, a0[0], a0[1] - w * 0.34, a1[0], a1[1] - w * 0.34, Math.max(0.8, w * 0.2), cols[2]);
        }
      };
      // a point along a line laid from `p` at elevation `e`, `L` inches out and `h` above its axis
      R.along = function (p, e, L, h, s2) {
        return [p[0] + L * Math.cos(e) - (h || 0) * Math.sin(e), p[1] + (s2 || 0), p[2] + L * Math.sin(e) + (h || 0) * Math.cos(e)];
      };
      R.dot = function (p, r, c) { var q = S(p[0], p[1], p[2]); ellipse(g, q[0], q[1], Math.max(0.6, r * K * k), Math.max(0.6, r * K * k), c); };
      /* A road wheel on an axle across the piece at `t`, its middle `s2` out: a
         tyre with its tread band, the rim and hub on the face toward the eye. */
      R.wheel = function (t, s2, r, tw) {
        var N = 16, sIn = s2 - tw / 2, sOut = s2 + tw / 2;
        function ring(sx, rr) {
          var out = [];
          for (var a2 = 0; a2 < N; a2++) { var an = a2 / N * Math.PI * 2; out.push(S(t + Math.cos(an) * rr, sx, r + Math.sin(an) * rr)); }
          return out;
        }
        var nearOut = dep(t, sOut) > dep(t, sIn), far = nearOut ? sIn : sOut, near = nearOut ? sOut : sIn;
        var fr = ring(far, r), nr = ring(near, r);
        poly(g, fr, '#0b0e12');
        for (var q = 0; q < N; q++) { var q2 = (q + 1) % N; poly(g, [fr[q], fr[q2], nr[q2], nr[q]], q % 2 ? '#101318' : '#14181d'); }
        poly(g, nr, '#161a20');
        poly(g, ring(near, r * 0.6), '#2b313a');
        poly(g, ring(near, r * 0.5), o.disc || '#454d58');
        poly(g, ring(near, r * 0.2), '#1a1e25');
      };
      /* A low tripod: its head at height `h`, two legs splayed forward and one
         trailing back, each a thin bar down to a foot. */
      R.tripod = function (h, spread, back) {
        var head = [0, 0, h];
        R.part(0.02, 0, function () { R.box(-0.06, 0.06, -0.05, 0.05, h - 0.06, h + 0.01, R.STL, R.DRK, R.DEEP); });   // the head the legs meet in
        [[spread * 0.7, spread], [spread * 0.7, -spread], [-back, 0]].forEach(function (f) {
          R.part(f[0] * 0.5, f[1] * 0.5, function () {
            R.rod(head, [f[0], f[1], 0], 0.032, [R.DEEP, R.DRK, R.STL]);
            R.dot([f[0], f[1], 0.012], 0.045, R.DEEP);
          });
        });
      };
      /* Dug in (p. 94): courses of sandbags in an arc across the front. */
      R.sandbags = function (R0, courses, half) {
        var n = Math.max(3, Math.round(half * 2 * R0 / 0.2));
        for (var c = 0; c < courses; c++) {
          for (var b = 0; b < n; b++) {
            (function (cc, th) {
              var d0 = th - 0.1 / R0, d1 = th + 0.1 / R0;
              R.part(Math.cos(th) * R0, Math.sin(th) * R0, function () {
                beamR(R, [Math.cos(d0) * R0, Math.sin(d0) * R0], [Math.cos(d1) * R0, Math.sin(d1) * R0], 0.07,
                  cc * 0.09, cc * 0.09 + 0.095, '#8e836a', '#6e6450', '#5a5242', g);
              });
              R.parts[R.parts.length - 1].bag = true;
            })(c, -half + (b + 0.5 + (c % 2 ? 0.5 : 0)) * (2 * half / (n + (c % 2 ? 1 : 0))));
          }
        }
      };
      return R;
    }
    function beamR(R, p0, p1, hw, zb, zt, top, side, end, g) {
      var S = R.S, dep = R.dep;
      var dt = p1[0] - p0[0], ds = p1[1] - p0[1], l = Math.hypot(dt, ds) || 1;
      var nt = -ds / l * hw, ns = dt / l * hw;
      var sd = dep(p0[0] + nt, p0[1] + ns) > dep(p0[0] - nt, p0[1] - ns) ? 1 : -1;
      var pe = dep(p1[0], p1[1]) > dep(p0[0], p0[1]) ? p1 : p0;
      poly(g, [S(p0[0] + sd * nt, p0[1] + sd * ns, zb), S(p1[0] + sd * nt, p1[1] + sd * ns, zb),
        S(p1[0] + sd * nt, p1[1] + sd * ns, zt), S(p0[0] + sd * nt, p0[1] + sd * ns, zt)], side);
      poly(g, [S(pe[0] + nt, pe[1] + ns, zb), S(pe[0] - nt, pe[1] - ns, zb), S(pe[0] - nt, pe[1] - ns, zt), S(pe[0] + nt, pe[1] + ns, zt)], end);
      poly(g, [S(p0[0] + nt, p0[1] + ns, zt), S(p1[0] + nt, p1[1] + ns, zt), S(p1[0] - nt, p1[1] - ns, zt), S(p0[0] - nt, p0[1] - ns, zt)], top);
    }
    /* Each piece: `k` its size on the table, `crew` where its men kneel (t, s),
       `muz` where its rounds leave, and `build` its parts. */
    var PIECE3D = {
      /* A mortar: the tube stood up at a steep angle on its baseplate, a bipod
         under it with the traverse bar, a crate of bombs and rounds laid ready. */
      mortar: { k: 1.25, crew: [[-0.3, 0.3], [-0.35, -0.3], [-0.65, 0.05]], muz: function () { return [0.2, 0, 0.6]; },
        build: function (R, o) {
          var base = [-0.13, 0, 0.04], e = 1.1;
          R.base.part(-0.13, 0, function () {
            R.base.box(-0.25, -0.01, -0.12, 0.12, 0, 0.035, '#535d50', '#2f3630', '#262b25');   // the baseplate stays put
          });
          R.part(0.1, 0, function () {
            var top = R.along(base, e, 0.62), mid = R.along(base, e, 0.36);
            [-1, 1].forEach(function (sd) {                    // the bipod
              R.rod(mid, [0.22, sd * 0.13, 0], 0.024, [R.DEEP, R.DRK, R.STL]);
            });
            R.rod([0.17, -0.1, 0.1], [0.17, 0.1, 0.1], 0.02, [R.DEEP, R.DRK, R.STL]);   // the traverse bar
            R.rod(base, top, 0.052);                            // the tube, plain to its mouth
            R.dot(R.along(base, e, 0.62, 0.012), 0.03, '#1a1e19');
            R.box(0.02, 0.1, 0.03, 0.1, 0.3, 0.37, '#4d564a', '#39413a', '#2b3128');   // the sight
          });
          var C = R.base;
          // the bomb crate and rounds stood ready, beside the baseplate and clear of where the crew kneel
          C.part(0.08, 0.34, function () {
            C.box(0.0, 0.2, 0.26, 0.42, 0, 0.12, o.pal.mid, o.pal.dark, o.pal.dark);
            for (var r = 0; r < 3; r++) C.rod([0.03 + r * 0.06, 0.2, 0], [0.03 + r * 0.06, 0.2, 0.12], 0.02, ['#6a4a22', '#8a5a2a', '#a8763c']);
          });
        } },
      /* The heavy machine gun on its tripod: a perforated cooling jacket on the
         barrel, a feed cover and rear sight on the receiver, spade grips at the
         back, a carrying handle, and the belt feeding in from a green box. */
      hmg: { k: 1.35, crew: [[-0.45, 0.1], [-0.3, -0.35], [-0.7, -0.15], [-0.65, 0.4]], muz: function () { return [0.7, 0, 0.33]; },
        build: function (R, o) {
          R.tripod(0.28, 0.24, 0.42);
          R.part(-0.05, 0, function () {
            R.box(-0.04, 0.04, -0.05, 0.05, 0.24, 0.29, R.DRK, R.DEEP, R.DEEP);    // the cradle on the head
            R.box(-0.16, 0.08, -0.045, 0.045, 0.28, 0.37);                        // receiver
            R.box(-0.12, 0.06, -0.047, 0.047, 0.37, 0.4, '#7a8470', R.STL, R.DRK);   // feed cover
            R.box(-0.15, -0.12, -0.012, 0.012, 0.4, 0.45, R.DRK, R.DEEP, R.DEEP);  // rear sight
            R.rod([-0.24, -0.03, 0.33], [-0.16, -0.03, 0.33], 0.016, [R.DEEP, R.DRK, R.STL]);   // spade grips
            R.rod([-0.24, 0.03, 0.33], [-0.16, 0.03, 0.33], 0.016, [R.DEEP, R.DRK, R.STL]);
            R.rod([-0.02, 0.05, 0.33], [-0.02, 0.1, 0.33], 0.012, [R.DEEP, R.DRK, R.STL]);     // cocking handle
          });
          R.part(0.35, 0, function () {
            R.rod([0.08, 0, 0.33], [0.44, 0, 0.33], 0.04);                          // the jacket
            for (var h = 0; h < 5; h++) R.dot([0.13 + h * 0.065, 0, 0.36], 0.009, R.DEEP);   // its cooling holes
            R.rod([0.18, 0, 0.375], [0.3, 0, 0.375], 0.008, [R.DEEP, R.DRK, R.STL]);   // carrying handle
            R.rod([0.44, 0, 0.33], [0.64, 0, 0.33], 0.017);                          // the barrel
            R.rod([0.62, 0, 0.33], [0.7, 0, 0.33], 0.028, [R.DEEP, R.DRK, R.STL]);   // flash hider
            R.box(0.4, 0.43, -0.01, 0.01, 0.36, 0.41, R.DRK, R.DEEP, R.DEEP);       // front sight
          });
          R.part(0.02, 0.2, function () {
            R.box(-0.08, 0.1, 0.1, 0.24, 0.16, 0.3, '#5f6d48', '#4d5a3a', '#3a4430');   // the ammunition box
            R.box(-0.08, 0.1, 0.1, 0.24, 0.3, 0.315, '#6f7d58', '#4d5a3a', '#3a4430');  // its lid
            belt(R, o.g, [-0.05, 0.13, 0.31], [-0.06, 0.047, 0.35], 0.07);
          });
        } },
      /* The Gauss cannon: twin rails wound with coils on the tripod, a panelled
         capacitor housing with its charge strip glowing, an optic on top, and a
         cable back to the power pack on the ground. */
      gauss: { k: 1.35, crew: [[-0.5, 0.1], [-0.3, -0.38], [-0.75, -0.2], [-0.7, 0.45]], muz: function () { return [0.8, 0, 0.35]; },
        build: function (R, o) {
          R.tripod(0.28, 0.26, 0.42);
          var C = R.base;
          C.part(-0.55, 0.3, function () {
            C.box(-0.68, -0.44, 0.2, 0.4, 0, 0.16, '#4a5866', '#34404c', '#28313a');   // the power pack, on the ground
            C.box(-0.64, -0.48, 0.24, 0.36, 0.16, 0.19, '#56687a', '#34404c', '#28313a');
            C.dot([-0.56, 0.3, 0.195], 0.02, '#7fe0ff');
            var c0 = C.S(-0.5, 0.25, 0.1), c1 = R.S(-0.18, 0.04, 0.3);
            thickLine(o.g, c0[0], c0[1], c1[0], c1[1], Math.max(1.5, K * R.k * 0.035), o.pal.dark);
          });
          R.part(-0.05, 0, function () {
            R.box(-0.04, 0.04, -0.05, 0.05, 0.24, 0.29, R.DRK, R.DEEP, R.DEEP);
            R.box(-0.22, 0.1, -0.055, 0.055, 0.28, 0.42, '#5a6878', '#3e4a56', '#2c353e');   // the capacitor housing
            [-0.14, -0.04, 0.05].forEach(function (t) {                                    // its panel seams
              var a0 = R.S(t, 0.056, 0.29), a1 = R.S(t, 0.056, 0.41), b0 = R.S(t, -0.056, 0.29), b1 = R.S(t, -0.056, 0.41);
              thickLine(o.g, a0[0], a0[1], a1[0], a1[1], 1, '#2c353e');
              thickLine(o.g, b0[0], b0[1], b1[0], b1[1], 1, '#2c353e');
            });
            [-1, 1].forEach(function (sd) {                                                // the charge strip
              var a0 = R.S(-0.2, sd * 0.057, 0.31), a1 = R.S(0.08, sd * 0.057, 0.31);
              thickLine(o.g, a0[0], a0[1], a1[0], a1[1], Math.max(1, K * R.k * 0.012), '#7fe0ff');
            });
            R.box(-0.12, 0.0, -0.025, 0.025, 0.42, 0.48, '#3e4a56', '#2c353e', '#1f262d'); // the optic
            R.dot([0.001, 0, 0.45], 0.012, '#7fe0ff');
            R.rod([-0.3, 0, 0.34], [-0.22, 0, 0.34], 0.02, [R.DEEP, R.DRK, R.STL]);       // the grips
          });
          R.part(0.45, 0, function () {
            R.rod([0.1, 0, 0.35], [0.76, 0, 0.35], 0.028, ['#1f262d', '#34404c', '#56687a']);   // the rails' shroud
            [-1, 1].forEach(function (sd) {
              R.rod([0.1, sd * 0.03, 0.37], [0.8, sd * 0.03, 0.37], 0.012, ['#2c353e', '#6f8090', '#9fb2c4']);
            });
            for (var c = 0; c < 5; c++) {                      // the coils wound round them
              var t = 0.2 + c * 0.11;
              R.rod([t, 0, 0.35], [t + 0.035, 0, 0.35], 0.045, ['#2c353e', '#6f8090', '#9fb2c4']);
            }
            R.dot([0.8, 0, 0.36], 0.022, '#7fe0ff');
          });
        } },
      /* The rebels' light autocannon on a tripod: a long ribbed barrel with a
         muzzle brake, a box magazine standing up out of the receiver, a sight. */
      rebac: { k: 1.35, crew: [[-0.45, 0.12], [-0.3, -0.36], [-0.7, -0.15], [-0.62, 0.42], [-0.95, 0.15], [-0.95, -0.4]], muz: function () { return [0.82, 0, 0.34]; },
        build: function (R, o) {
          R.tripod(0.28, 0.25, 0.44);
          R.part(-0.05, 0, function () {
            R.box(-0.04, 0.04, -0.05, 0.05, 0.24, 0.29, R.DRK, R.DEEP, R.DEEP);
            R.box(-0.22, 0.12, -0.05, 0.05, 0.28, 0.4);
            [-0.14, -0.06, 0.02].forEach(function (t) { R.box(t, t + 0.02, -0.052, 0.052, 0.3, 0.38, R.DRK, R.DEEP, R.DEEP); });   // ribs
            R.box(-0.1, 0.04, -0.03, 0.03, 0.4, 0.54, R.LIT, R.STL, R.DRK);      // the magazine
            R.box(0.05, 0.1, 0.05, 0.08, 0.36, 0.44, R.DRK, R.DEEP, R.DEEP);     // the sight
            R.box(-0.3, -0.22, -0.02, 0.02, 0.26, 0.36, R.DRK, R.DEEP, R.DEEP);  // the grips
          });
          R.part(0.45, 0, function () {
            R.rod([0.12, 0, 0.34], [0.74, 0, 0.34], 0.026);
            for (var r = 0; r < 4; r++) R.rod([0.16 + r * 0.05, 0, 0.34], [0.18 + r * 0.05, 0, 0.34], 0.036, [R.DEEP, R.DRK, R.STL]);   // cooling rings
            R.rod([0.72, 0, 0.34], [0.82, 0, 0.34], 0.04, [R.DEEP, R.DRK, R.STL]);
            [-1, 1].forEach(function (sd) {                    // the brake's ports
              if (R.dep(0, sd) > R.dep(0, -sd)) R.dot([0.77, sd * 0.041, 0.34], 0.012, '#0e110d');
            });
          });
          var C = R.base;
          C.part(-0.4, 0.4, function () {
            C.box(-0.5, -0.3, 0.32, 0.48, 0, 0.12, o.pal.mid, o.pal.dark, o.pal.dark);
            C.box(-0.47, -0.33, 0.35, 0.45, 0.12, 0.14, o.pal.light, o.pal.dark, o.pal.dark);
          });
        } },
      /* The heavy autocannon: the same on a heavier mount, with a welded shield
         of two swept wings the barrel runs out between. */
      rebhac: { k: 1.35, wheeled: true, wreck: rebhacWreck, crew: [[-0.5, 0.15], [-0.35, -0.5], [-0.85, -0.15], [-0.75, 0.5]], muz: function () { return [1.0, 0, 0.42]; },
        build: function (R, o) {
          /* On its own two-wheeled carriage: emplaced, the trails spread and a
             jack let down in front; on tow, the trails closed into a drawbar. */
          var C = R.base;                                          // the carriage keeps the unit's facing
          [-1, 1].forEach(function (sd) { C.part(-0.05, sd * 0.235, function () { C.wheel(-0.05, sd * 0.235, 0.18, 0.07); }); });
          C.part(-0.1, 0, function () {
            C.rod([-0.05, -0.235, 0.18], [-0.05, 0.235, 0.18], 0.028, [C.DEEP, C.DRK, C.STL]);    // the axle
            C.box(-0.1, 0.06, -0.08, 0.08, 0.16, 0.3, C.STL, C.DRK, C.DEEP);                    // the pedestal
            [-1, 1].forEach(function (sd) {
              var end = o.tow ? [-0.72, sd * 0.02, 0.18] : [-0.62, sd * 0.36, 0.02];
              C.rod([-0.08, sd * 0.09, 0.2], end, 0.028, [C.DEEP, C.DRK, C.STL]);            // a trail
              if (!o.tow) C.box(end[0] - 0.04, end[0] + 0.02, end[1] - 0.06, end[1] + 0.06, 0, 0.07, C.STL, C.DRK, C.DEEP);   // its spade
            });
            if (o.tow) C.dot([-0.75, 0, 0.18], 0.035, C.DEEP);                                  // the towing eye
            else C.rod([0.08, 0, 0.2], [0.22, 0, 0], 0.022, [C.DEEP, C.DRK, C.STL]);          // the jack
          });
          R.part(-0.08, 0, function () {
            R.box(-0.05, 0.05, -0.06, 0.06, 0.28, 0.35, R.DRK, R.DEEP, R.DEEP);
            R.box(-0.26, 0.08, -0.065, 0.065, 0.34, 0.49);
            [-0.18, -0.08].forEach(function (t) { R.box(t, t + 0.025, -0.067, 0.067, 0.36, 0.47, R.DRK, R.DEEP, R.DEEP); });
            R.box(-0.12, 0.04, -0.04, 0.04, 0.49, 0.65, R.LIT, R.STL, R.DRK);
            R.box(-0.36, -0.26, -0.025, 0.025, 0.32, 0.44, R.DRK, R.DEEP, R.DEEP);
            R.rod([0.08, 0, 0.42], [0.16, 0, 0.42], 0.034);    // the barrel's root, behind the shield
          });
          [-1, 1].forEach(function (sd) {                      // the shield, two swept wings
            R.part(0.16, sd * 0.1, function () {
              beamR(R, [0.18, 0], [0.12, sd * 0.19], 0.01, 0.3, 0.54, R.LIT, R.STL, R.DRK, o.g);
              var a0 = R.S(0.178, sd * 0.01, 0.5), a1 = R.S(0.122, sd * 0.18, 0.5);
              thickLine(o.g, a0[0], a0[1], a1[0], a1[1], Math.max(1, K * R.k * 0.03), o.pal.mid);
              for (var rv = 0; rv < 3; rv++) {                // rivets along its foot
                var f = 0.2 + rv * 0.3, rp = [0.18 - 0.06 * f + 0.012, sd * 0.19 * f, 0.33];
                R.dot(rp, 0.008, R.DRK);
              }
            });
          });
          R.part(0.6, 0, function () {
            R.rod([0.18, 0, 0.42], [0.9, 0, 0.42], 0.032);
            for (var r = 0; r < 4; r++) R.rod([0.24 + r * 0.06, 0, 0.42], [0.265 + r * 0.06, 0, 0.42], 0.044, [R.DEEP, R.DRK, R.STL]);
            R.rod([0.88, 0, 0.42], [1.0, 0, 0.42], 0.05, [R.DEEP, R.DRK, R.STL]);
            [-1, 1].forEach(function (sd) {
              if (R.dep(0, sd) > R.dep(0, -sd)) R.dot([0.94, sd * 0.051, 0.42], 0.014, '#0e110d');
            });
          }, true);
        } },
      /* The guided-missile launcher: a long ready tube on a low tripod with
         carrying handles and banded caps, the guidance unit and its sights
         under it, a spare round in its case. */
      atgm: { k: 1.3, crew: [[-0.45, 0.12], [-0.3, -0.36], [-0.7, -0.12], [-0.62, 0.42]], muz: function () { return [0.4, 0, 0.44]; },
        build: function (R, o) {
          R.tripod(0.26, 0.24, 0.4);
          R.part(-0.1, 0, function () {
            R.box(-0.12, 0.06, -0.06, 0.06, 0.26, 0.37, '#4d564a', '#2e3530', '#262b25');   // guidance unit
            R.box(-0.1, 0.04, -0.062, 0.062, 0.3, 0.32, '#39413a', '#262b25', '#1c201b');
            R.dot([0.065, -0.03, 0.31], 0.018, '#8fb8cc');
            R.rod([-0.2, 0.0, 0.3], [-0.12, 0.0, 0.3], 0.018, [R.DEEP, R.DRK, R.STL]);   // grips
          });
          R.part(0.05, 0, function () {
            R.rod([-0.34, 0, 0.42], [0.4, 0, 0.44], 0.052, ['#2e3a24', '#4a5a3a', '#6a7a52']);   // the launch tube
            [-0.34, 0.37].forEach(function (t) { R.rod([t, 0, 0.42], [t + 0.04, 0, 0.42], 0.058, [R.DEEP, '#2e3a24', '#3a4630']); });   // caps
            R.rod([-0.05, 0, 0.42], [0.0, 0, 0.42], 0.056, [R.DEEP, pal2(o), pal2(o)]);   // a band of company paint
            R.rod([-0.18, 0, 0.5], [-0.06, 0, 0.5], 0.008, [R.DEEP, R.DRK, R.STL]);       // carrying handle
            R.box(-0.02, 0.1, -0.035, 0.035, 0.48, 0.56, '#4d564a', '#39413a', '#2b3128');   // day sight
            R.dot([0.101, 0, 0.52], 0.014, '#8fb8cc');
          });
          var C = R.base;
          C.part(-0.5, -0.35, function () {
            C.box(-0.72, -0.28, -0.4, -0.3, 0, 0.08, '#4a5a3a', '#3a4630', '#2e3a24');   // the spare round's case
            C.box(-0.72, -0.68, -0.4, -0.3, 0, 0.08, pal2(o), o.pal.dark, o.pal.dark);
          });
        } },
      /* The SAM launcher: twin tubes laid up at the sky on the tripod, the
         IFF antenna and a thermal battery pack on the cradle. */
      samlauncher: { k: 1.3, crew: [[-0.45, 0.12], [-0.3, -0.36], [-0.7, -0.12], [-0.62, 0.42]], muz: function () { return [0.29, 0, 0.72]; },
        build: function (R, o) {
          R.tripod(0.26, 0.24, 0.4);
          var p0 = [-0.02, 0, 0.4], e = SAM_ELEV;
          R.part(-0.15, 0, function () {
            R.box(-0.1, 0.06, -0.06, 0.06, 0.26, 0.37, '#4d564a', '#2e3530', '#262b25');
            R.box(-0.24, -0.1, -0.04, 0.04, 0.28, 0.34, '#39413a', '#262b25', '#1c201b');   // battery pack
            R.rod([-0.06, -0.08, 0.37], [-0.06, -0.08, 0.6], 0.006, [R.DEEP, R.DRK, R.STL]);   // IFF antenna
            R.dot([-0.06, -0.08, 0.6], 0.012, '#8fb8cc');
          });
          R.part(0.1, 0, function () {
            [-1, 1].forEach(function (sd) {
              R.rod(R.along(p0, e, -0.3, 0, sd * 0.05), R.along(p0, e, 0.42, 0, sd * 0.05), 0.042, ['#2e3a24', '#4a5a3a', '#6a7a52']);
              R.rod(R.along(p0, e, 0.38, 0, sd * 0.05), R.along(p0, e, 0.43, 0, sd * 0.05), 0.046, [R.DEEP, '#2e3a24', '#3a4630']);
              R.rod(R.along(p0, e, 0.0, 0, sd * 0.05), R.along(p0, e, 0.05, 0, sd * 0.05), 0.046, [R.DEEP, pal2(o), pal2(o)]);
            });
            R.box(-0.02, 0.08, 0.08, 0.14, 0.36, 0.46, '#4d564a', '#39413a', '#2b3128');
            R.dot([0.081, 0.11, 0.41], 0.016, '#8fb8cc');
          });
        } }
    };
    var SAM_ELEV = 0.8;                                   // the SAM tubes' lay: the missiles leave up this line
    function pal2(o) { return o.pal.mid; }
    /* The heavy autocannon knocked out: the carriage down on its axle where a
       wheel was torn off (it lies flat nearby), the barrel nosed into the dirt,
       one shield wing hanging and the other blown off, the magazine thrown clear. */
    function rebhacWreck(R, o) {
      R.part(-0.05, -0.235, function () { R.wheel(-0.05, -0.235, 0.18, 0.07); });
      R.part(-0.4, 0.62, function () {                     // the lost wheel, lying on its side
        var S = R.S, ring = function (rr, z) {
          var out = [];
          for (var a2 = 0; a2 < 16; a2++) { var an = a2 / 16 * Math.PI * 2; out.push(S(-0.4 + Math.cos(an) * rr, 0.62 + Math.sin(an) * rr, z)); }
          return out;
        };
        poly(o.g, ring(0.18, 0.0), '#0b0e12');
        poly(o.g, ring(0.18, 0.07), '#161a20');
        poly(o.g, ring(0.1, 0.071), '#2b313a');
        poly(o.g, ring(0.04, 0.072), '#1a1e25');
      });
      R.part(-0.1, 0, function () {
        R.rod([-0.05, -0.235, 0.18], [-0.05, 0.22, 0.03], 0.028, [R.DEEP, R.DRK, R.STL]);   // the axle, down at one end
        R.box(-0.1, 0.06, -0.08, 0.08, 0.04, 0.17, R.STL, R.DRK, R.DEEP);
        R.rod([-0.08, -0.09, 0.14], [-0.62, -0.36, 0.02], 0.028, [R.DEEP, R.DRK, R.STL]);   // a trail, still spread
        R.rod([-0.08, 0.09, 0.08], [-0.45, 0.2, 0.02], 0.028, [R.DEEP, R.DRK, R.STL]);      // the other, snapped short
        R.box(-0.26, 0.08, -0.03, 0.1, 0.08, 0.22);                                        // the receiver, slewed down
        R.box(-0.36, -0.26, 0.0, 0.05, 0.06, 0.16, R.DRK, R.DEEP, R.DEEP);
      });
      R.part(0.12, -0.1, function () {                     // the one shield wing left, hanging
        beamR(R, [0.14, 0.02], [0.1, -0.19], 0.01, 0.05, 0.3, R.LIT, R.STL, R.DRK, o.g);
      });
      R.part(0.5, 0.15, function () {
        R.rod([0.08, 0.04, 0.16], [0.82, 0.3, 0.02], 0.032);                                 // the barrel, nose in the dirt
        R.rod([0.8, 0.29, 0.02], [0.9, 0.33, 0.0], 0.05, [R.DEEP, R.DRK, R.STL]);
      });
      R.part(0.45, -0.45, function () {                    // the other wing, blown off and lying flat
        R.box(0.3, 0.52, -0.55, -0.36, 0, 0.02, R.LIT, R.STL, R.DRK);
      });
      R.part(0.2, 0.55, function () {                      // the magazine, thrown clear
        R.box(0.14, 0.3, 0.48, 0.56, 0, 0.08, R.LIT, R.STL, R.DRK);
      });
    }
    /* A belt of rounds from a box to a gun: a band of brass, a dark line across
       it at every round. */
    function belt(R, g, a, b, w) {
      var n = 7, pts = [], S = R.S;
      var q = [S(a[0], a[1], a[2]), S(a[0] + w, a[1], a[2]), S(b[0] + w, b[1], b[2]), S(b[0], b[1], b[2])];
      poly(g, q, '#b08a3a');
      for (var i = 0; i <= n; i++) {
        var f = i / n, p0 = S(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f + 0.004),
          p1 = S(a[0] + w + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f + 0.004);
        thickLine(g, p0[0], p0[1], p1[0], p1[1], 1, i % 2 ? '#6a5020' : '#d8b060');
      }
      void pts;
    }
    PIECE3D.rebelmortar = PIECE3D.mortar;
    /* Where a unit's pieces stand: in a line across its front, each turned the
       way the unit faces, its crew shared out between them. */
    function pieces3D(u, at) {
      var art = u.art, P = PIECE3D[art], n = PIECE_COUNT[u.key] || 1;
      var pa = pieceAngles(u), f = pa.f;
      var ca = Math.cos(f), sa = Math.sin(f), out = [];
      // one piece in the middle, two side by side and staggered, three in a triangle: one forward, two behind
      var spots = n === 1 ? [[0.25, 0]] : n === 2 ? [[0.6, -0.55], [-0.1, 0.55]] : [[0.75, 0], [-0.25, -0.75], [-0.25, 0.75]];
      var top = pa.top;
      spots.forEach(function (sp) {
        var fwd = sp[0], sOff = sp[1];
        out.push({ x: at.x + ca * fwd + sa * sOff, y: at.y + sa * fwd - ca * sOff, aim: f, top: top, k: P.k, P: P });
      });
      return out;
    }
    function drawPieces3D(g, u, art, at, opts, drawMan) {
      var ps = pieces3D(u, at), all = [];
      var pal = B.PALETTE[u.paint || u.side] || B.PALETTE.A, n = Math.max(1, Math.min(8, u.models || 1));
      ps.forEach(function (pc, i) {
        var R = rig(g, { x: pc.x, y: pc.y, aim: pc.aim, top: pc.top, k: pc.k, lift: opts.lift || 0 });
        pc.P.build(R, { pal: pal, g: g });
        if (u.dugIn) {
          R.sandbags(0.62, 3, 0.95);
          // the barrel runs out over the bags: it goes on after every one of them (but not after its own shield)
          var top2 = -Infinity;
          R.parts.forEach(function (q) { if (q.bag) top2 = Math.max(top2, q.d); });
          R.parts.forEach(function (q) { if (q.over) q.d = Math.max(q.d, top2 + 0.001); });
        }
        all = all.concat(R.parts);
        // this piece's share of the crew, in the places round it
        var mine = 0;
        for (var mi = i; mi < n; mi += ps.length) {
          (function (mi2, spot) {
            var w = R.base.W(spot[0], spot[1]);                // the crew kneel round the mount, not the barrel
            all.push({ d: w.x + w.y, fn: function () { drawMan(mi2, w.x, w.y); } });
          })(mi, pc.P.crew[mine % pc.P.crew.length]);
          mine++;
        }
      });
      var was = PH.smooth;
      PH.smooth = true;
      try { all.sort(function (p1, p2) { return p1.d - p2.d; }).forEach(function (p1) { p1.fn(); }); }
      finally { PH.smooth = was; }
    }
    function pieceMuzzles3D(u) {
      var q0 = toScreen(u.x, u.y);
      return pieces3D(u, u).map(function (pc) {
        var m = pc.P.muz(), ca = Math.cos(pc.top), sa = Math.sin(pc.top);
        var wx = pc.x + (ca * m[0] + sa * m[1]) * pc.k, wy = pc.y + (sa * m[0] - ca * m[1]) * pc.k, q = toScreen(wx, wy);
        return { dx: q.x - q0.x, dy: q.y - q0.y - m[2] * K * 0.9 * pc.k, dir: gunFaceL(pc.top) ? -1 : 1 };
      });
    }


    return {
      FIELD_GUN: FIELD_GUN,
      GUN_CREW: GUN_CREW,
      GUN_K: GUN_K,
      PIECE3D: PIECE3D,
      belt: belt,
      drawPieces3D: drawPieces3D,
      drawTowed: drawTowed,
      fieldGun: fieldGun,
      fieldMuzzle: fieldMuzzle,
      gunFaceL: gunFaceL,
      gunOpts: gunOpts,
      pal2: pal2,
      pieceAngles: pieceAngles,
      pieceMuzzles3D: pieceMuzzles3D,
      pieceWreck: pieceWreck,
      startTurn: startTurn,
      towedGun: towedGun
    };
  };
})(window);
