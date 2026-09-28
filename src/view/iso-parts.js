/* PMC 2670 — Firefight : the parts of a trooper: the mount, legs, pack, torso, arms, helmet and weapon

   Made by iso-troops.js once, with the palettes and pieces it shares (S). Each
   function paints one part of a figure through its pixel pen P, from what
   the figure is (kit, palette, pose) and where the part sits. */
(function (root) {
  'use strict';
  root.PMCIsoParts = function (S) {
    var B = S.B, BOOT = S.BOOT, GLASS = S.GLASS, GUN = S.GUN, PALETTE_FORCE = S.PALETTE_FORCE, RB = S.RB,
        ellipse = S.ellipse, vividHex = S.vividHex;

    function mount(P, g, kit, ox, oy, pal, pose, s, step) {
      if (!kit.mount || pose === 'prone') return;
      var mb = pose === 'kneel' ? 6 : 0;                 // a shot rider slumps forward
      if (step) mb -= 1;
      // a shape through points in the figure's own units, and a round one
      function shape(pts, c) {
        g.fillStyle = c; g.beginPath();
        pts.forEach(function (q, i) {
          var X = ox + q[0] * s, Y = oy + (q[1] + mb) * s;
          if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
        });
        g.closePath(); g.fill();
      }
      function disc(x, y, rx, ry, c) { ellipse(g, ox + x * s, oy + (y + mb) * s, rx * s, (ry == null ? rx : ry) * s, c); }
      function rod(x0, y0, x1, y1, w, c) {
        var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
        shape([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c);
      }
      if (kit.mount === 'horse') horse();
      else if (kit.mount === 'gravbike') gravbike();
      else bike();
      if (kit.trophy) {                                   // a skull on a pole behind the saddle
        P(-19, -52 + mb, 1.5, 34, '#4a3a26');
        P(-21, -56 + mb, 6, 5, '#d8d0bc');
        P(-20, -54 + mb, 1.2, 1.2, '#1a1510'); P(-17.5, -54 + mb, 1.2, 1.2, '#1a1510');
        P(-24, -50 + mb, 5, 8, pal.cloth);
      }

      /* A horse in the colony's breeding, drawn from its parts: a deep chest
         and a round haunch joined by the barrel, the neck arched up to a long
         head, and four legs that bend at the knee and the hock and end in
         hooves. On the step frame it is mid-stride, a fore and a hind leg
         reaching out while the others push back. The saddle cloth is in the
         group's colours, and the reins run back to the rider's hands. */
      function horse() {
        var dark = !!kit.facewrap;                       // the Legends ride black horses
        var HB = dark ? '#2f2925' : '#76502f', HL = dark ? '#4c433c' : '#9a6d44', HD = dark ? '#171412' : '#4c321d',
          MANE = dark ? '#0d0b0a' : '#2a1b10', HOOF = '#1a1714', SOCK = dark ? '#5a524a' : '#d9cdb4';
        var st = step ? 1 : 0;
        // a leg: from the body down to the joint, then to the hoof, tapering
        function leg(x, top, jx, jy, fx, c, sock) {
          rod(x, top, jx, jy, 4.6, c);
          rod(jx, jy, fx, -2.2, 3.2, c);
          disc(jx, jy, 2.3, 2.3, c);                     // the knee (or hock), knobbly
          if (sock) rod(jx + (fx - jx) * 0.55, jy + (-2.2 - jy) * 0.55, fx, -2.2, 3.3, SOCK);
          shape([[fx - 2.2, -2.6], [fx + 2.6, -2.6], [fx + 3.2, 0], [fx - 2.4, 0]], HOOF);
        }
        // the far legs first, in shadow
        leg(12, -24, st ? 18 : 13, -13, st ? 22 : 12, HD);
        leg(-18, -25, st ? -22 : -15, -13, st ? -25 : -18, HD);
        // the tail, swept back from the croup and flicking on the stride
        shape([[-24, -33], [-29, -31], [-33 - st * 2, -20], [-31 - st * 2, -12], [-28, -15], [-27, -24], [-23, -29]], MANE);
        shape([[-25, -32], [-28, -30], [-30 - st * 2, -21], [-29, -22], [-26, -29]], dark ? '#262220' : '#3d2a1a');
        // the body: chest to haunch, a round belly, the topline dipping at the back
        shape([[16, -30], [15, -24], [9, -19], [-6, -18], [-16, -20], [-24, -24], [-26, -30], [-23, -35],
          [-14, -36], [-2, -35], [7, -37], [13, -36]], HB);
        disc(-19, -28, 7.5, 7, HB);                      // the haunch
        disc(12, -28, 6, 6.5, HB);                       // the chest
        shape([[-24, -33], [-14, -35.6], [-2, -34.6], [7, -36.6], [12, -35.8], [11, -33.5], [-2, -32.4], [-14, -33.5], [-23, -31]], HL);   // the lit back
        shape([[13, -22], [8, -18.8], [-6, -18], [-16, -20], [-12, -22], [0, -21], [9, -22]], HD);     // the belly in shadow
        disc(-20, -30, 3.5, 3, HL);                      // light on the round of the haunch
        // the neck, arched up from the withers, and the head at the end of it
        shape([[7, -36], [13, -41], [19, -48], [23, -52], [27, -50], [26, -44], [21, -36], [17, -28], [11, -30]], HB);
        shape([[8, -36], [14, -42], [20, -49], [22, -48], [15, -40], [10, -35]], HL);               // the crest caught by the light
        shape([[22, -53], [27, -54], [31, -50], [38, -42], [37, -39.5], [34, -38.5], [29, -41], [24, -46]], HB);   // the head, long, nose down
        shape([[34, -44], [38, -42], [37, -39.5], [34, -38.5], [32, -41]], HD);                       // the muzzle
        shape([[23, -52], [24, -57], [26, -53]], HB); shape([[23.8, -53], [24.4, -55.6], [25.2, -53]], HD);   // an ear
        P(29.5, -48 + mb, 1.8, 1.6, '#0b0908'); P(30, -48 + mb, 0.7, 0.6, 'rgba(255,255,255,.55)');   // an eye with its glint
        P(36, -41 + mb, 1.2, 1, '#0b0908');              // a nostril
        // the mane down the crest, and the forelock
        shape([[7, -37], [11, -41], [16, -46], [20, -51], [23, -54], [21, -49], [17, -43], [12, -37], [9, -34]], MANE);
        shape([[23, -54], [27, -52], [25, -50]], MANE);
        // the bridle, and the reins back to the rider's hands
        rod(26, -52, 30, -44, 0.9, '#1c1510'); rod(30, -44, 36, -41, 0.9, '#1c1510');
        rod(33, -41, 12, -37, 0.8, '#241a12');
        // the near legs over the body, one of each pair with a white sock
        leg(14, -25, st ? 9 : 15, -13, st ? 5 : 15, HB, !dark);
        leg(-15, -26, st ? -10 : -13, -13, st ? -8 : -15, HB);
        rod(14, -24, st ? 9 : 15, -14, 1.3, HL); rod(-15, -26, st ? -10 : -13, -14, 1.3, HL);   // light down their fronts
        // the saddle cloth in the group's colours, the saddle on it, and a bag behind
        shape([[-12, -36], [7, -37], [8, -27], [-12, -26]], pal.mid);
        shape([[-12, -36], [7, -37], [7, -35], [-12, -34]], pal.light);
        shape([[-12, -27.5], [8, -28.5], [8, -27], [-12, -26]], pal.dark);
        P(-11, -34 + mb, 1.2, 7, pal.light); P(6, -35 + mb, 1.2, 7, pal.light);                      // its trim
        shape([[-9, -38], [-6, -36], [4, -36], [6, -39], [7, -36], [5, -34], [-8, -34], [-10, -36]], '#3a2918');   // the saddle, cantle and pommel
        P(-7, -37 + mb, 10, 1, '#5a4128');
        rod(-1, -34, -1, -17, 0.9, '#2a1d12');           // the stirrup leather
        shape([[-3, -17.5], [1, -17.5], [1.5, -15], [-3.5, -15]], '#8a8f94');   // and its iron
        P(-19, -34 + mb, 7, 7, '#4a3a22'); P(-19, -34 + mb, 7, 1.5, '#6b5232'); P(-16, -31 + mb, 1.2, 2, '#b89a5a');   // a saddle bag and its buckle
      }

      /* A grav bike: no wheels, a long faired hull on two lift pads a hand's
         breadth over the ground. The nose is swept to a point, the tail kicks
         up into a fin, and the pads throw a blue glow on the ground under it.
         It bobs a little on the step frame. */
      function gravbike() {
        var hv = step ? -1 : 0, GL = '#7fe0ff';
        disc(0, 0.5 - mb, 24, 3.2, 'rgba(90,200,255,.20)');              // the glow on the ground
        disc(0, 0.5 - mb, 14, 1.8, 'rgba(160,235,255,.22)');
        // the lift pads, glowing underneath
        shape([[-22, -13 + hv], [-8, -13 + hv], [-9, -9.5 + hv], [-21, -9.5 + hv]], '#1a1d22');
        shape([[8, -13 + hv], [22, -13 + hv], [21, -9.5 + hv], [9, -9.5 + hv]], '#1a1d22');
        disc(-15, -9.3 + hv, 6, 1.1, GL); disc(15, -9.3 + hv, 6, 1.1, GL);
        disc(-15, -8.4 + hv, 4, 0.8, 'rgba(220,250,255,.8)'); disc(15, -8.4 + hv, 4, 0.8, 'rgba(220,250,255,.8)');
        // the hull: a low wedge from the tail fin to the pointed nose
        shape([[-28, -25 + hv], [-24, -17 + hv], [-18, -12.5 + hv], [18, -12.5 + hv], [31, -16 + hv], [33, -18 + hv],
          [20, -24 + hv], [10, -24 + hv], [4, -21 + hv], [-10, -21 + hv], [-18, -22 + hv]], '#262b32');
        shape([[-28, -25 + hv], [-18, -22 + hv], [-10, -21 + hv], [4, -21 + hv], [10, -24 + hv], [20, -24 + hv], [33, -18 + hv],
          [30, -17.5 + hv], [19, -22.5 + hv], [10, -22.5 + hv], [4, -19.5 + hv], [-10, -19.5 + hv], [-19, -20.5 + hv], [-26, -23 + hv]], '#4a5561');   // light along the top
        shape([[-18, -12.5 + hv], [18, -12.5 + hv], [26, -14.5 + hv], [-22, -14.5 + hv]], '#15181c');    // the shadowed belly
        // the side panel in the group's colours, a stripe through it
        shape([[-17, -19.5 + hv], [4, -18.5 + hv], [12, -21 + hv], [22, -20 + hv], [26, -16 + hv], [14, -15 + hv], [-15, -15 + hv]], pal.mid);
        shape([[-17, -19.5 + hv], [4, -18.5 + hv], [12, -21 + hv], [22, -20 + hv], [23, -19 + hv], [12, -19.5 + hv], [4, -17.4 + hv], [-16, -18.4 + hv]], pal.light);
        shape([[-14, -16.5 + hv], [20, -17 + hv], [21, -16 + hv], [-14, -15.5 + hv]], pal.dark);
        if (kit.flames) { shape([[-2, -18 + hv], [16, -19 + hv], [10, -17 + hv], [20, -16.5 + hv], [4, -16 + hv]], '#c9452a'); shape([[2, -17.6 + hv], [12, -18.3 + hv], [8, -17 + hv]], '#e0802a'); }
        // the tail fin and the thruster in it, burning
        shape([[-28, -25 + hv], [-31, -30 + hv], [-27, -30 + hv], [-22, -22 + hv]], '#323941');
        disc(-27, -19 + hv, 2.4, 2.6, '#1a1d22'); disc(-28, -19 + hv, 1.6, 1.8, step ? '#d8f7ff' : GL);
        if (step) disc(-31, -19 + hv, 2.4, 1.2, 'rgba(127,224,255,.45)');
        // the cowl, bars and screen up front, and the lamp in the nose
        shape([[10, -24 + hv], [14, -31 + hv], [19, -31 + hv], [20, -24 + hv]], '#303740');
        shape([[14, -31 + hv], [19, -35 + hv], [22, -34 + hv], [19, -31 + hv]], 'rgba(130,210,240,.55)');
        rod(11, -33 + hv, 17, -31 + hv, 1.6, '#59626d');
        shape([[29, -18.5 + hv], [33, -18 + hv], [31, -16.5 + hv], [28, -17 + hv]], '#f2d27a');
        disc(35, -17.5 + hv, 3, 1.4, 'rgba(242,210,122,.35)');
        // the seat, where the rider sits
        shape([[-14, -22 + hv], [2, -22 + hv], [4, -20 + hv], [-14, -20 + hv]], '#1f1a14');
      }

      /* A raider's motorbike, a desert scrambler: spoked wheels on knobbly
         tyres, the front one out on a raked fork, the engine slung low with
         its pipe swept up past the rear wheel, the tank in the group's
         colours under the rider. It does not stride: what says it is moving
         is the spokes turning, the frame bouncing on its springs and the
         exhaust smoking. */
      function bike() {
        var ST = '#15181d', RIM = '#59626d', CH = '#9aa3ac';
        function wheel(x) {
          disc(x, -7, 7.5, 7.5, ST);                     // the tyre, knobbly
          for (var k = 0; k < 10; k++) {
            var a = k / 10 * Math.PI * 2;
            disc(x + Math.cos(a) * 7.3, -7 + Math.sin(a) * 7.3, 1.1, 1.1, ST);
          }
          disc(x, -7, 5.4, 5.4, '#262b31');
          disc(x, -7, 4.8, 4.8, RIM); disc(x, -7, 4, 4, '#1f2328');
          for (var j = 0; j < 4; j++) {                  // the spokes, on the turn when it moves
            var b = j / 4 * Math.PI + (step ? Math.PI / 8 : 0);
            rod(x - Math.cos(b) * 4, -7 - Math.sin(b) * 4, x + Math.cos(b) * 4, -7 + Math.sin(b) * 4, 0.7, '#7b848e');
          }
          disc(x, -7, 1.6, 1.6, CH);
        }
        var bo = step ? -0.6 : 0;                        // the frame on its springs
        wheel(-17); wheel(19);
        // the swing arm back to the rear wheel, and the rear shock
        rod(-17, -7, -3, -12 + bo, 2.4, '#2a2f36');
        rod(-11, -9 + bo, -8, -20 + bo, 1.6, '#c9a642');
        // the engine, low between the wheels, its cooling fins lit
        shape([[-6, -18 + bo], [7, -18 + bo], [8, -9 + bo], [-5, -8 + bo]], '#2c3138');
        for (var f = 0; f < 4; f++) P(-4, -16.5 + f * 2 + bo + mb, 10, 0.8, '#4d5560');
        disc(2, -10 + bo, 2.4, 2.2, '#3d444d');
        // the exhaust, down from the engine and swept up past the back wheel
        rod(-4, -10 + bo, -12, -12 + bo, 2, '#6f757c');
        rod(-12, -12 + bo, -26, -18 + bo, 2.2, '#80868d');
        shape([[-27, -19.8 + bo], [-24, -19.8 + bo], [-24, -16.4 + bo], [-27, -16.8 + bo]], '#2a2d31');
        if (kit.flames) { disc(-29, -18 + bo, 2.6, 1.4, '#e0802a'); disc(-31, -18.5 + bo, 1.6, 1, '#f2c050'); }
        else if (step) disc(-31, -20 + bo, 3, 2.2, 'rgba(150,146,140,.55)');   // and its smoke
        // the rear mudguard over the back wheel, and the seat
        shape([[-26, -13 + bo], [-22, -17 + bo], [-14, -19 + bo], [-8, -18 + bo], [-10, -16 + bo], [-20, -14.5 + bo]], pal.dark);
        shape([[-16, -21 + bo], [-3, -21.5 + bo], [-2, -18.5 + bo], [-16, -18.5 + bo]], '#231d15');
        P(-16, -21.5 + bo + mb, 13, 1, '#3d3226');
        // the saddle bags and a bedroll
        P(-24, -21 + bo + mb, 7, 6, '#4a3a22'); P(-24, -21 + bo + mb, 7, 1.4, '#6b5232');
        P(-23, -24 + bo + mb, 6, 3, '#6b4a26');
        // the tank in the group's colours, a stripe down it
        shape([[-4, -21 + bo], [3, -25 + bo], [11, -25 + bo], [13, -20 + bo], [-3, -18 + bo]], pal.mid);
        shape([[-3, -21.5 + bo], [3, -25 + bo], [11, -25 + bo], [11.5, -23.6 + bo], [3, -23.4 + bo]], pal.light);
        shape([[0, -20.5 + bo], [10, -21.5 + bo], [10.6, -20.3 + bo], [0, -19.4 + bo]], pal.dark);
        if (kit.flames) {                                 // flames painted down the tank
          shape([[-1, -20 + bo], [4, -23 + bo], [3, -21.5 + bo], [8, -23.5 + bo], [7, -21.5 + bo], [12, -22 + bo], [11, -20 + bo]], '#c9452a');
          shape([[1, -20.6 + bo], [4, -22 + bo], [7, -22.4 + bo], [10, -21 + bo]], '#f2c050');
        }
        // the fork, raked out to the front wheel, and the mudguard over it
        rod(13, -25 + bo, 19, -7, 2.2, CH);
        rod(12.4, -25 + bo, 18.4, -7, 0.8, '#d8dde2');
        shape([[13, -15], [18, -16.5], [25, -14], [24, -12.5], [18, -14.8], [14, -13.5]], pal.dark);
        // the headlamp and its number board, the bars back to the rider
        shape([[12, -30 + bo], [16, -30 + bo], [17, -24 + bo], [12, -24 + bo]], '#2a2f36');
        disc(16.5, -27 + bo, 2, 2.2, '#e8c15a'); disc(17, -27.5 + bo, 0.8, 0.8, '#fff3c4');
        rod(8, -32 + bo, 14, -30 + bo, 1.6, '#4a535d');
        P(7, -33 + bo + mb, 2.4, 2.4, '#1c1f24');          // the grip
      }
    }

    function legs(P, kit, pal, pose, step) {
      /* ---- legs ---- */
      if (kit.mount && pose !== 'prone') {
        var kb = (pose === 'kneel' ? 6 : 0) - (step ? 1 : 0);
        P(-6, -30 + kb, 6, 12, pal.dark);                // thigh along the tank
        P(-6, -30 + kb, 3, 12, pal.mid);
        P(-2, -22 + kb, 6, 9, pal.dark);                 // shin dropped to the peg
        P(-3, -14 + kb, 8, 4, BOOT);
      } else if (kit.robot && pose === 'kneel') {
        /* A drone braced on one knee: struts and joints rather than cloth, the
           rear shin a strut laid along the ground, the front one a piston. */
        P(-7, -11, 3, 8, RB.strut);                      // rear thigh strut
        P(-9, -5, 5, 5, RB.joint); P(-8.5, -4.5, 1.5, 1.5, pal.light);   // knee joint, down
        P(-18, -3, 10, 2.4, RB.strut); P(-18, -3, 10, 0.8, pal.light);   // shin along the ground
        P(-21, -4, 4, 4, RB.foot);
        P(-1, -12, 10, 3, RB.strut); P(-1, -12, 10, 1, pal.light);       // front thigh, level
        P(7, -14, 5, 5, RB.joint); P(7.5, -13.5, 1.5, 1.5, pal.light);   // raised knee joint
        P(8, -9, 2.4, 6, RB.piston); P(9.2, -9, 0.8, 6, 'rgba(0,0,0,.35)');
        P(5, -3, 9, 3, RB.foot); P(5, -3, 9, 0.8, pal.light);            // the splayed foot
        P(5, -0.6, 9, 0.6, '#08090c');
      } else if (kit.robot) {
        // thin jointed legs: a strut to the knee, a piston below it, a flat splayed foot
        var rl = step ? [4, 0] : [0, 3];
        for (var RL = 0; RL < 2; RL++) {
          var rx = RL ? 2 : -6, rlift = rl[RL];
          P(rx, -20 + rlift, 3.5, 8, RB.strut);          // thigh strut
          P(rx, -20 + rlift, 1.2, 8, pal.light);
          P(rx - 0.5, -13 + rlift, 4.5, 4.5, RB.joint);  // knee joint
          P(rx, -12.5 + rlift, 1.5, 1.5, pal.light);
          P(rx + 0.8, -9 + rlift, 2, 6, RB.piston);      // shin piston
          P(rx + 2.2, -9 + rlift, 0.8, 6, 'rgba(0,0,0,.35)');
          P(rx - 1.5, -3 + rlift, 7, 3, RB.foot);        // foot
          P(rx - 1.5, -3 + rlift, 7, 0.8, pal.light);
          P(rx - 1.5, -0.6 + rlift, 7, 0.6, '#08090c');
        }
      } else if (pose === 'kneel') {
        /* Down on one knee: the rear knee on the ground with the shin laid out
           behind and the toes tucked, the front thigh level out to a raised knee
           and the shin straight down to a planted boot. */
        P(-8, -10, 7, 8, pal.dark);                      // rear thigh, down to the ground
        P(-8, -10, 3, 8, pal.mid);
        P(-9, -4, 6, 4, pal.helm);                       // its knee pad, on the ground
        P(-17, -4, 9, 4, pal.dark);                      // the shin laid out behind
        P(-17, -4, 9, 1.2, pal.mid);
        P(-21, -6, 5, 6, BOOT);                          // toes tucked under
        P(-21, -1, 5, 1, '#08090c');
        P(-1, -11, 12, 6, pal.dark);                     // front thigh, level out to the knee
        P(-1, -11, 12, 2, pal.mid);
        P(7, -12, 5, 4, pal.helm);                       // knee pad, up at the front
        P(7.5, -12, 3.5, 1, kit.blackPads ? '#4a4e4a' : pal.light);
        P(6, -7, 6, 4, pal.dark);                        // the shin, straight down
        P(6, -7, 2, 4, pal.mid);
        P(5, -4, 9, 4, BOOT);                            // the planted boot
        P(5, -4, 3, 1, '#3a3f47');
        P(5, -1, 9, 1, '#08090c');
      } else if (kit.armoured) {
        // powered armour is heavy: it lifts a foot, but not far
        var aL = step ? [3, 0] : [0, 2];
        P(-8, -21 + aL[0], 6, 21, pal.dark);             // armoured greaves
        P(-8, -21 + aL[0], 3, 21, pal.mid);
        P(2, -21 + aL[1], 6, 21, pal.dark);
        P(2, -21 + aL[1], 3, 21, pal.mid);
        P(-9, -5 + aL[0], 8, 5, BOOT); P(1, -5 + aL[1], 9, 5, BOOT);
        P(-8, -14 + aL[0], 6, 3, pal.helm); P(2, -14 + aL[1], 6, 3, pal.helm);
        // the plates are separate pieces: seams, rivets and a lit upper edge
        P(-8, -18 + aL[0], 6, 0.75, 'rgba(0,0,0,.35)'); P(2, -18 + aL[1], 6, 0.75, 'rgba(0,0,0,.35)');
        P(-8, -14 + aL[0], 6, 0.75, pal.light); P(2, -14 + aL[1], 6, 0.75, pal.light);
        P(-6.5, -9 + aL[0], 1, 1, pal.light); P(3.5, -9 + aL[1], 1, 1, pal.light);
        P(-9, -1 + aL[0], 8, 1, '#08090c'); P(1, -1 + aL[1], 9, 1, '#08090c');
      } else {
        var lifts = step ? [4, 0] : [0, 3];
        for (var L = 0; L < 2; L++) {
          var lx = L ? 1 : -7, lift = lifts[L];
          P(lx, -20 + lift, 6, 16, pal.dark);
          P(lx, -20 + lift, 2, 8, pal.mid);              // the thigh catches the light
          P(lx + 0.5, -11 + lift, 1.5, 7, pal.mid);      // and the shin, a little less
          P(lx + 4.5, -19 + lift, 1, 15, 'rgba(0,0,0,.28)');  // the crease in shadow
          if (kit.blackPads) {                           // a shin guard up to the knee
            P(lx, -12 + lift, 6, 8, pal.helm); P(lx + 0.5, -11 + lift, 1.2, 6, '#3c403c');
          }
          P(lx, -12 + lift, 6, 3, pal.helm);             // knee pad
          P(lx + 0.5, -12 + lift, 4, 1, kit.blackPads ? '#4a4e4a' : pal.light);      // and its hard top edge
          P(lx - 1, -4 + lift, 8, 4, BOOT);              // boot
          P(lx - 1, -4 + lift, 3, 1, '#3a3f47');         // the toe cap, scuffed pale
          P(lx - 1, -1 + lift, 8, 1, '#08090c');         // and the sole
        }
      }
    }

    function pack(P, drop, kit, pal, px) {
      switch (kit.pack) {
        case 'jetpack':                                   // twin jump jets on a heavy frame
          P(px - 1, -46 + drop, 9, 22, pal.dark);
          P(px - 1, -46 + drop, 9, 2, pal.helm);
          P(px + 1, -48 + drop, 4, 26, '#2a2f36');        // the two burners
          P(px + 5, -47 + drop, 4, 25, '#20252b');
          P(px + 1, -48 + drop, 1.5, 26, '#4a535d');
          P(px + 1, -23 + drop, 8, 3, '#15181d');         // their nozzles
          P(px + 2, -21 + drop, 6, 1, '#c96a2a');
          P(px - 1, -38 + drop, 3, 6, pal.helm);          // a fuel line
          break;
        case 'radio':
          P(px, -41 + drop, 9, 19, '#39413a');           // man-pack set
          P(px, -41 + drop, 9, 2, '#5c6659');
          P(px + 1, -37 + drop, 6, 4, pal.light);        // faceplate
          P(px + 2, -30 + drop, 4, 2, GUN.hot);
          P(px + 5, -70 + drop, 2, 30, '#4d564a');       // long whip antenna
          P(px + 4, -74 + drop, 4, 4, pal.light);        // pennant at the tip
          P(px - 2, -34 + drop, 3, 9, '#2a2f2a');        // handset cord
          break;
        case 'medic':
          P(px, -38 + drop, 7, 13, pal.dark);
          P(px + 1, -35 + drop, 5, 7, '#dfe8ef');
          P(px + 2, -34 + drop, 2, 5, '#c8384f');
          P(px + 1, -32 + drop, 5, 2, '#c8384f');
          break;
        case 'ammo':
          P(px, -33 + drop, 8, 11, '#4a4a33');
          P(px, -33 + drop, 8, 2, '#6d6d4a');
          P(px + 1, -28 + drop, 5, 1, GUN.hot);
          break;
        case 'charges':
          P(px, -37 + drop, 7, 12, pal.dark);
          P(px + 1, -35 + drop, 5, 3, '#8a5a2a');
          P(px + 1, -29 + drop, 5, 3, '#8a5a2a');
          break;
        case 'dish':
          P(px, -38 + drop, 6, 12, pal.dark);
          P(px + 2, -48 + drop, 1, 10, GUN.md);
          P(px - 1, -52 + drop, 8, 4, GUN.lt);           // dish
          P(px, -50 + drop, 6, 1, '#8fb8cc');
          break;
        case 'tanks':
          P(px, -40 + drop, 4, 17, '#3f4a3a');            // twin cylinders
          P(px + 4, -40 + drop, 4, 17, '#4d5a46');
          P(px, -40 + drop, 8, 2, '#6a7a60');
          P(px + 2, -42 + drop, 3, 2, GUN.md);            // regulator
          break;
        case 'missile':
          P(px, -38 + drop, 5, 13, pal.dark);
          P(px + 1, -44 + drop, 3, 12, '#4a4438');        // spare rocket
          P(px + 1, -46 + drop, 3, 3, '#8a5a2a');
          break;
        case 'mortarbase':
          P(px, -36 + drop, 7, 12, pal.dark);
          P(px - 1, -24 + drop, 9, 4, GUN.md);            // baseplate slung low
          P(px - 1, -24 + drop, 9, 1, GUN.lt);
          break;
        case 'minerpack':                                 // power cell, hose and a coil of cord
          P(px, -40 + drop, 8, 16, '#4a4030');
          P(px, -40 + drop, 8, 2, '#6d5e42');
          P(px + 1, -36 + drop, 5, 4, '#e0a33a');         // charge indicator
          P(px + 1, -35 + drop, 3, 1, '#ffe9a8');
          P(px + 6, -30 + drop, 3, 9, '#2c2c32');         // hose down to the cutter
          P(px - 1, -23 + drop, 9, 4, '#7a4a1e');         // det cord, coiled
          P(px, -22 + drop, 7, 1, '#b0742e');
          break;
        case 'none': break;
        default:
          P(px, -39 + drop, 7, 14, pal.dark);
          P(px, -39 + drop, 7, 1, pal.mid);
          P(px + 1, -33 + drop, 4, 1, pal.helm);
      }
    }

    function torso(P, b, carve, drop, kit, pal, pose, sw, tw, tx) {
      P(tx, -40 + drop, tw, 20, pal.mid);
      P(tx, -40 + drop, 5, 20, pal.light);               // lit side
      P(tx - 1, -41 + drop, sw, 2, pal.light);           // shoulder line
      P(tx, -22 + drop, tw, 3, pal.dark);                // belt
      P(tx + 2, -20 + drop, 4, 4, pal.helm);             // pouches
      P(tx + tw - 6, -20 + drop, 4, 4, pal.helm);
      if (kit.armoured) {
        P(tx + 1, -39 + drop, tw - 2, 11, pal.light);    // chest plate
        P(tx + 1, -39 + drop, tw - 2, 1, '#e8eef6');
        P(tx + 1, -28 + drop, tw - 2, 2, pal.dark);
        P(-2, -37 + drop, 4, 7, pal.helm);
        P(-0.5, -39 + drop, 1, 11, 'rgba(255,255,255,.22)');   // the breastplate's ridge
        P(tx + 2, -33 + drop, tw - 4, 0.75, 'rgba(0,0,0,.3)');  // where two plates overlap
        P(tx + 2, -25 + drop, tw - 4, 0.75, 'rgba(0,0,0,.35)'); // segments over the gut
        P(tx + 2, -23 + drop, tw - 4, 0.75, 'rgba(0,0,0,.35)');
        P(tx + 2, -36 + drop, 1, 1, pal.dark); P(tx + tw - 3, -36 + drop, 1, 1, pal.dark);   // bolts
        P(-1, -36 + drop, 2, 1, '#5fd0f0');              // a status light
      } else if (kit.robot) {
        /* A drone's chassis: a chest housing over a narrow spine, panel seams,
           a cooling grille and a single status light. No webbing, no pouches. */
        // the housing painted to the squad it stands in for: grey plate for the
        // assault drones, a green shell for the recon drones
        var hsg = kit.vest ? ['#383c42', '#51575f'] : kit.pouches ? ['#4c5c30', '#6a7a44'] : [pal.mid, pal.light];
        P(tx, -40 + drop, tw, 13, hsg[0]);               // the chest housing
        P(tx, -40 + drop, 4, 13, hsg[1]);
        P(tx, -27 + drop, tw, 1, 'rgba(0,0,0,.45)');     // its lower edge
        P(-3, -26 + drop, 6, 7, RB.joint);               // the exposed spine at the waist
        P(-3, -25 + drop, 6, 0.8, pal.light); P(-3, -23 + drop, 6, 0.8, pal.light); P(-3, -21 + drop, 6, 0.8, pal.light);
        P(tx + 1, -22 + drop, tw - 2, 3, pal.helm);      // hip plate
        P(tx + 1, -22 + drop, tw - 2, 0.8, pal.light);
        P(-0.4, -40 + drop, 0.8, 13, 'rgba(0,0,0,.35)'); // centre seam
        P(tx + 2, -34 + drop, tw - 4, 0.7, 'rgba(0,0,0,.3)');
        [0, 1, 2].forEach(function (gi) { P(2, -38 + drop + gi * 1.6, 5, 0.8, '#23272c'); });   // cooling grille
        P(-5, -37 + drop, 3, 3, '#1b1e22'); P(-4.5, -36.5 + drop, 2, 2, RB.eye);   // status light
        P(-3, -43 + drop, 7, 2, RB.joint);               // neck mount
      } else if (kit.vest) {
        /* Assault troops: a dark grey plate carrier over the fatigues, so they
           read at a glance as something heavier than the rifle line — a front
           plate, shoulder straps, rows of webbing and a cummerbund at the waist. */
        var V = '#383c42', VL = '#51575f', VD = '#24272c';
        P(tx + 1, -40 + drop, tw - 2, 16, V);            // the carrier
        P(tx + 1, -40 + drop, 4, 16, VL);                // its lit side
        P(tx + 1, -41 + drop, 4, 2, VD);                 // shoulder straps
        P(tx + tw - 5, -41 + drop, 4, 2, VD);
        P(tx + 1, -41 + drop, 4, 0.75, VL);
        P(-5, -39 + drop, 10, 9, VD);                    // the front plate pocket
        P(-5, -39 + drop, 10, 0.75, '#6b727b');          // its edge catching the light
        P(-4, -36 + drop, 8, 0.75, 'rgba(0,0,0,.45)');   // webbing rows across it
        P(-4, -34 + drop, 8, 0.75, 'rgba(0,0,0,.45)');
        P(-4, -32 + drop, 8, 0.75, 'rgba(0,0,0,.45)');
        P(-4, -29 + drop, 3, 4, V); P(1, -29 + drop, 3, 4, V);   // magazine pouches
        P(-4, -29 + drop, 3, 0.75, VL); P(1, -29 + drop, 3, 0.75, VL);
        P(tx + 1, -25 + drop, tw - 2, 3, VD);            // cummerbund
        P(tx + 1, -25 + drop, tw - 2, 0.75, VL);
        P(-3, -43 + drop, 7, 2, VD);                     // collar
      } else {
        /* A Y-harness: two straps coming in from the shoulders to a band of
           pouches. Drawn straight up and down they made a '#' on every chest. */
        P(-6, -41 + drop, 1.5, 1.5, pal.dark);           // straps, stepping in from the shoulders
        P(-5, -40 + drop, 1.5, 1.5, pal.dark);
        P(-4, -39 + drop, 1.5, 2, pal.dark);
        P(5, -41 + drop, 1.5, 1.5, pal.dark);
        P(4, -40 + drop, 1.5, 1.5, pal.dark);
        P(3, -39 + drop, 1.5, 2, pal.dark);
        P(-5, -37 + drop, 10, 4, pal.dark);              // the band of pouches
        P(-5, -37 + drop, 10, 0.75, pal.mid);            // its top edge, catching the light
        P(-2, -37 + drop, 0.75, 4, 'rgba(0,0,0,.4)');    // and the gaps between pouches
        P(1.5, -37 + drop, 0.75, 4, 'rgba(0,0,0,.4)');
        P(-3, -43 + drop, 7, 2, pal.dark);               // collar
      }
      if (!kit.robot) {
        P(-1, -22 + drop, 3, 3, '#8a8f98');              // belt buckle
        P(-1, -22 + drop, 3, 1, '#c9cdd4');
        P(tx + 2, -20 + drop, 4, 1, pal.light);          // pouch flaps catching the light
        P(tx + tw - 6, -20 + drop, 4, 1, pal.light);
      }
      if (!kit.armoured && !kit.robot && !kit.robe && !kit.cloak && !kit.tunic && pose !== 'prone') {
        // the torso tapers from the chest to the waist, not a box all the way down
        carve([[tx - 0.5, -32 + drop], [tx + 2.2, -22 + drop], [tx - 0.5, -22 + drop]]);
        carve([[tx + tw + 0.5, -32 + drop], [tx + tw - 2.2, -22 + drop], [tx + tw + 0.5, -22 + drop]]);
      }
      if (kit.badge) P(tx + 1, -38 + drop, 3, 3, kit.badge);
      if (kit.mark) P(tx + 1, -25 + drop, 2, 2, '#c8384f');
      if (kit.ragged) {                                   // work clothes, patched and open
        P(tx, -34 + drop, 4, 3, pal.dark);
        P(tx + tw - 5, -30 + drop, 4, 3, pal.dark);
        P(tx + 3, -21 + drop, tw - 6, 2, pal.dark);       // a hem that was never finished
        P(-6, -38 + drop, 3, 16, pal.cloth);              // an open shirt over a vest
        P(3, -38 + drop, 3, 16, pal.cloth);
      }
      if (kit.armband) {                                  // the group's colour, worn to be seen
        // penal troops wear the company's own colour on the arm, over the prison coveralls
        if (kit.armband !== 'force') {                  // (the penal band goes on over the sleeve, below)
          P(-15 - b, -37 + drop, 6, 4, '#c8384f');
          P(-15 - b, -37 + drop, 6, 1, '#e4657f');
        }
      }
      if (kit.tunic) {
        /* A long shirt to the knee over loose trousers, a dark waistcoat over
           it, and a chest rig of magazine pouches across the front. */
        P(tx - 1, -41 + drop, tw + 2, 25, pal.mid);
        P(tx - 1, -41 + drop, 5, 25, pal.light);
        P(tx + tw - 2, -40 + drop, 2, 23, pal.dark);      // the fall of the cloth
        P(tx, -18 + drop, tw, 2, pal.dark);               // the hem
        P(tx + 1, -41 + drop, tw - 2, 15, kit.vest || '#3b3a30');
        P(tx + 1, -41 + drop, 3, 15, 'rgba(255,255,255,.12)');
        P(-1.5, -41 + drop, 3, 15, pal.mid);              // the shirt showing down the front
        P(-6, -32 + drop, 12, 5, '#4a4030');              // chest rig
        P(-6, -32 + drop, 12, 1, '#6a5a40');
        P(-2.5, -32 + drop, 0.75, 5, 'rgba(0,0,0,.4)'); P(1.5, -32 + drop, 0.75, 5, 'rgba(0,0,0,.4)');
      }
      if (kit.sash) {                                     // a sash, shoulder to hip
        // 'force': in the side's own colour, the brightest thing on him
        var shc = kit.sash === 'force' ? vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.25) : kit.sash;
        for (var sh2 = 0; sh2 < 6; sh2++) P(tx + tw - 5 - sh2 * 2.4, -41 + drop + sh2 * 3.2, 4, 3.4, shc);
        if (kit.sash === 'force') for (var sh3 = 0; sh3 < 6; sh3++) P(tx + tw - 5 - sh3 * 2.4, -41 + drop + sh3 * 3.2, 4, 0.8, 'rgba(255,255,255,.3)');
      }
      if (kit.blade) {                                    // a curved sword at the belt, gold at the hilt
        P(tx + tw - 3, -27 + drop, 2.4, 13, '#2a1f14');      // the scabbard
        P(tx + tw - 2.2, -15 + drop, 3, 2, '#2a1f14');       // curving at the tip
        P(tx + tw - 4, -29.5 + drop, 5, 1.6, '#e0b43a');     // the guard
        P(tx + tw - 2.6, -32.5 + drop, 1.8, 3.2, '#c9a13a'); // the grip
        P(tx + tw - 2.8, -33.4 + drop, 2.2, 1.2, '#f0cf6a'); // the pommel
      }
      if (kit.grenades) {                                 // a belt hung with grenades, and a bandolier of them
        for (var gr2 = 0; gr2 < 5; gr2++) {
          P(tx + 1 + gr2 * (tw - 3) / 4, -24 + drop, 3, 3.5, '#4a5a34');
          P(tx + 1.5 + gr2 * (tw - 3) / 4, -24.5 + drop, 1.5, 1, '#8a8f98');
        }
        for (var gr3 = 0; gr3 < 4; gr3++) {
          P(tx + 3 + gr3 * 3.2, -39 + drop + gr3 * 3.4, 3, 3, '#4a5a34');
          P(tx + 3.5 + gr3 * 3.2, -39.5 + drop + gr3 * 3.4, 1.2, 1, '#8a8f98');
        }
      }
      if (kit.leathers) {                                 // a leather jacket, zipped, collar up
        P(tx, -40 + drop, tw, 18, pal.mid);
        P(tx, -40 + drop, 4, 18, 'rgba(255,255,255,.12)');
        P(-0.5, -40 + drop, 1, 18, '#8a8f98');             // the zip
        P(tx - 1, -42 + drop, 5, 4, pal.dark); P(tx + tw - 4, -42 + drop, 5, 4, pal.dark);
        if (kit.band) P(tx, -30 + drop, tw, 2, kit.band);
      }
      if (kit.bandolier) {                                // a belt of rounds across the chest
        for (var bd = 0; bd < 7; bd++) {
          P(tx + 1 + bd * (tw - 4) / 6, -40 + drop + bd * 2.6, 3, 2.2, '#4a3a22');
          P(tx + 1.8 + bd * (tw - 4) / 6, -40.4 + drop + bd * 2.6, 1.2, 1, '#b8923a');
        }
      }
      if (kit.pouches && !kit.armoured && !kit.robot) {                 // light infantry: a green smock and chest rig
        var GS = '#4c5c30', GSL = '#6a7a44', GSD = '#37431f';
        P(tx + 1, -41 + drop, tw - 2, 17, GS);            // the smock over the torso
        P(tx + 1, -41 + drop, 4, 17, GSL);                // its lit side
        P(tx + tw - 3, -41 + drop, 2, 17, GSD);           // and the shaded one
        P(tx + 3, -27 + drop, 4, 2, GSD); P(tx + tw - 8, -35 + drop, 4, 2, GSD);   // mottling
        P(tx + 2, -25 + drop, tw - 4, 1.5, GSD);          // the hem at the belt
        P(-3, -43 + drop, 6, 2, GSD);                     // collar
        P(-6, -38 + drop, 12, 5, kit.pouches);
        P(-6, -38 + drop, 12, 1, 'rgba(255,255,255,.2)');
        P(-6, -32 + drop, 5, 4, kit.pouches); P(1, -32 + drop, 5, 4, kit.pouches);
        P(-2, -38 + drop, 0.75, 5, 'rgba(0,0,0,.4)'); P(2, -38 + drop, 0.75, 5, 'rgba(0,0,0,.4)');
      }
      if (kit.dress) {
        /* Dress uniform, more of it the higher the command: a plain tunic and one
           shoulder board for the 4th grade; both boards and a ribbon bar for the
           3rd; the same under a peaked cap for the 2nd; a long greatcoat for the
           1st; and the greatcoat trimmed in gold for high command. */
        var lvl = kit.dress, DT = pal.dark, GOLD = '#e8c15a', GOLD_D = '#a8842c';
        // the 3rd and 2nd grades' tunics hang to mid-thigh, the 4th's to the waist
        var coat = lvl >= 4, hem = coat ? -9 : lvl >= 2 ? -16 : -23, len = hem - (-42);
        P(tx - (coat ? 1 : 0), -42 + drop, tw + (coat ? 2 : 0), len, DT);
        P(tx - (coat ? 1 : 0), -42 + drop, tw + (coat ? 2 : 0), len, 'rgba(18,20,26,.55)');   // a dress cloth, not field drab
        P(tx - (coat ? 1 : 0), -42 + drop, 3, len, 'rgba(255,255,255,.12)');
        P(tx + tw - 1 + (coat ? 1 : 0), -42 + drop, 1, len, lvl >= 5 ? GOLD : pal.light);    // piping down the front edge
        P(-3, -44 + drop, 6, 2, '#e9e4d6');               // the shirt collar
        P(-1, -43 + drop, 2, 3, '#20242a');               // and tie
        if (coat) {
          /* the greatcoat: wide lapels, two rows of buttons, a half belt, and
             the skirt falling open over the legs */
          P(-5, -42 + drop, 3, 8, 'rgba(0,0,0,.28)'); P(2, -42 + drop, 3, 8, 'rgba(0,0,0,.28)');   // lapels
          for (var cb = 0; cb < 3; cb++) {
            P(-3.5, -34 + drop + cb * 4, 1.4, 1.4, GOLD); P(2, -34 + drop + cb * 4, 1.4, 1.4, GOLD);
          }
          P(-0.5, -24 + drop, 1, 15, 'rgba(0,0,0,.35)');   // where the skirt parts
          P(tx - 1, -11 + drop, tw + 2, 2, 'rgba(0,0,0,.3)');   // the hem in shadow
          P(tx - 1, -26 + drop, tw + 2, 2.5, 'rgba(0,0,0,.4)'); // the half belt
          P(-1, -26 + drop, 2.5, 2.5, GOLD);
          P(tx - 1, -26 + drop, 3, 4, DT); P(tx + tw - 2, -26 + drop, 3, 4, DT);   // turned-back cuffs
          if (lvl >= 5) {
            P(tx - 1, -42 + drop, tw + 2, 1.2, GOLD);     // gold along the collar
            P(tx - 1, -11 + drop, tw + 2, 1.2, GOLD);     // and the hem
            P(-5, -42 + drop, 1, 8, GOLD); P(4, -42 + drop, 1, 8, GOLD);   // the lapel edges
            P(tx - 1, -26 + drop, 3, 1, GOLD); P(tx + tw - 2, -26 + drop, 3, 1, GOLD);   // cuff braid
            P(tx + tw - 2, -41 + drop, 2, 13, GOLD + 'cc');     // an aiguillette in loops
            P(tx + tw - 4, -30 + drop, 3, 1.5, GOLD + 'cc');
          }
        } else {
          for (var bt = 0; bt < 4; bt++) P(1, -39 + drop + bt * 4, 1.4, 1.4, GOLD);   // buttons down the tunic
          P(tx, -27 + drop, tw, 2.5, '#3a2a1a');          // the belt
          P(-1, -27 + drop, 2.5, 2.5, GOLD);              // its buckle
          if (lvl >= 2) P(tx, hem - 2 + drop, tw, 2, 'rgba(0,0,0,.3)');   // the long tunic's hem in shadow
        }
        // ribbons from the 3rd grade, a second row from the 1st
        if (lvl >= 2) {
          P(tx + 2, -39 + drop, 6, 1.4, '#c8384f'); P(tx + 2, -37.6 + drop, 6, 1.4, '#3a6fb0');
        }
        if (lvl >= 4) { P(tx + 2, -36.2 + drop, 6, 1.4, GOLD); P(tx + 2, -34.8 + drop, 6, 1.4, '#4f8a4a'); }
      }
      if (kit.heavyplate) {
        /* Protectors: a second skin of plate over the suit — a thick breastplate
           edged in the company colour, a plated girdle, a gorget under the helm. */
        P(tx, -41 + drop, tw, 13, pal.helm);
        P(tx, -41 + drop, tw, 2, pal.light);
        P(tx, -41 + drop, 4, 13, 'rgba(255,255,255,.14)');
        P(tx + 2, -29 + drop, tw - 4, 1.5, pal.dark);
        P(-3, -39 + drop, 6, 9, pal.mid);                 // the centre plate
        P(-3, -39 + drop, 6, 1, '#e8eef6');
        P(tx + 1, -26 + drop, tw - 2, 4, pal.helm);       // the girdle
        P(tx + 1, -26 + drop, tw - 2, 1, pal.light);
        P(-1, -22 + drop, 2, 1, '#5fd0f0');
      }
      if (kit.robe) {                                     // a pilgrim's robe, down to the boots
        P(tx - 3, -42 + drop, tw + 6, 26, pal.mid);
        P(tx - 3, -42 + drop, 6, 26, pal.light);
        P(tx + tw + 1, -42 + drop, 2, 24, pal.dark);
        P(tx - 2, -18 + drop, tw + 4, 4, pal.dark);       // the hem, dragging
        P(-2, -40 + drop, 3, 22, pal.dark);               // the fall of the cloth
        P(tx - 1, -30 + drop, tw + 2, 3, pal.cloth);      // a rope belt
        P(-4, -28 + drop, 9, 6, pal.cloth);               // prayer strips knotted at the waist
        P(-3, -24 + drop, 2, 8, pal.light);
        P(2, -24 + drop, 2, 7, pal.light);
      }

    }

    function arms(P, b, drop, kit, pal, pose, step, tw, tx) {
      var aw = 5 + b;
      if (kit.robot) {
        // strut arms with a ball elbow and a clamp for a hand
        P(-12 - b, -39 + drop, 3, 6, RB.strut); P(-12 - b, -39 + drop, 1, 6, pal.light);
        P(-13 - b, -34 + drop, 4.5, 4.5, RB.joint); P(-12.5 - b, -33.5 + drop, 1.4, 1.4, pal.light);
        P(-12 - b, -30 + drop, 2.6, 3, RB.piston);
        P(-14 - b, -28 + drop, 6, 3, RB.foot); P(-14 - b, -28 + drop, 1.2, 3, '#5a6068');   // the clamp
        P(tx + tw - 1, -38 + drop, 3, 5, RB.strut);
        P(tx + tw - 1.5, -34 + drop, 4, 4, RB.joint);
        P(tx + tw - 0.5, -30 + drop, 2.4, 3, RB.piston);
      } else {
      P(-13 - b, -39 + drop, aw, 13, pal.mid);           // forward arm, down to the grip
      P(-13 - b, -39 + drop, 2, 13, pal.light);
      P(-13 - b, -33 + drop, aw, 1, 'rgba(0,0,0,.30)');  // the elbow, bent
      P(-12 - b, -32 + drop, aw - 1, 1, pal.light);      // and the sleeve pulled over it
      P(-14 - b, -28 + drop, aw + 2, 3, BOOT);           // glove
      P(-13.5 - b, -28 + drop, 2, 1, '#454b54');         // knuckles catching the light
      P(tx + tw - 2, -38 + drop, aw, 11, pal.mid);       // rear arm
      P(tx + tw + aw - 3, -38 + drop, 1, 11, 'rgba(0,0,0,.30)');  // its far side in shadow
      }
      if (kit.sleeves === 'rolled') {
        /* shirt sleeves rolled to above the elbow: bare forearms and hands, the
           roll of cloth a lit band at the top of each */
        var FA = '#caa07e', FAD = '#8d6a4c';
        P(-13 - b, -37 + drop, aw, 10, FA);
        P(-13 - b, -37 + drop, 1.5, 10, '#e2b995');
        P(-13 - b + aw - 1.4, -37 + drop, 1.4, 10, FAD);
        P(-14 - b, -39 + drop, aw + 2, 2.4, pal.light);   // the rolled cuff
        P(-14 - b, -39 + drop, aw + 2, 0.7, 'rgba(255,255,255,.35)');
        P(-14 - b, -36.8 + drop, aw + 2, 0.9, pal.dark);
        P(-14 - b, -28 + drop, aw + 2, 3, FAD);          // bare hand on the grip
        P(-13.5 - b, -28 + drop, 2, 1, FA);
        P(tx + tw - 2, -33 + drop, aw, 6, FAD);
        P(tx + tw - 2.5, -35 + drop, aw + 1, 2.4, pal.light);
        P(tx + tw - 2.5, -32.8 + drop, aw + 1, 0.8, pal.dark);
      }
      if (kit.forceBelt) {
        // the partisans' one bit of uniform: a belt in the company's colour, buckled
        P(tx - 0.5, -27 + drop, tw + 1, 2.6, PALETTE_FORCE(pal));
        P(tx - 0.5, -27 + drop, tw + 1, 0.8, 'rgba(255,255,255,.3)');
        P(-1.2, -27.2 + drop, 2.6, 3, '#c9b37a');
      }
      if (kit.armband === 'force') {
        // penal troops: a band in the company's own colour round the upper arm, over the coveralls
        var abc = pal.forceDark ? PALETTE_FORCE(pal) : pal.light;
        abc = vividHex(pal.forceMid || abc, 3, 1.3);    // the armband is the brightest thing on him, convict or rebel
        P(-14 - b, -37.5 + drop, aw + 2, 4.2, abc);
        P(-14 - b, -37.5 + drop, aw + 2, 0.9, 'rgba(255,255,255,.35)');
        P(-14 - b, -34.1 + drop, aw + 2, 0.8, 'rgba(0,0,0,.35)');
      }
      P(tx - 2 - b, -41 + drop, 6 + b, 3, pal.helm);     // shoulder, barely a pad
      P(tx + tw - 3, -41 + drop, 6 + b, 3, pal.helm);
      P(tx - 1.5 - b, -41 + drop, 4 + b, 1, kit.blackPads ? '#4a4e4a' : pal.light);  // the pad's rounded top
      if (kit.forcePad) {
        // drones: the left shoulder plate alone in the company's colour
        var fpc = vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.25);
        P(tx - 3 - b, -42 + drop, 7 + b, 4.5, fpc);
        P(tx - 3 - b, -42 + drop, 7 + b, 1, 'rgba(255,255,255,.35)');
        P(tx - 3 - b, -38.3 + drop, 7 + b, 0.8, 'rgba(0,0,0,.35)');
      }
      if (kit.forceShoulders) {
        // miners: the shoulders of the work suit painted in the company's colour
        var fsc = PALETTE_FORCE(pal), fsd = pal.forceMid || pal.mid;
        P(tx - 3 - b, -42 + drop, 7 + b, 4, fsc); P(tx - 3 - b, -39 + drop, 7 + b, 1, fsd);
        P(tx + tw - 4, -42 + drop, 7 + b, 4, fsc); P(tx + tw - 4, -39 + drop, 7 + b, 1, fsd);
      }
      if (kit.plates) {
        /* bolted-on armour plate: a breastplate over the work suit, plates on
           the upper arms under the painted shoulders, and greaves on the shins */
        var PL = '#5d6168', PLL = '#8a9098', PLD = '#34373c';
        P(tx + 1, -38 + drop, tw - 2, 9, PL);
        P(tx + 1, -38 + drop, tw - 2, 1.2, PLL);
        P(tx + 1, -30 + drop, tw - 2, 1, PLD);
        P(tx + 2, -35 + drop, 1, 1, PLL); P(tx + tw - 3, -35 + drop, 1, 1, PLL);   // the bolts
        P(tx + 2, -32 + drop, 1, 1, PLL); P(tx + tw - 3, -32 + drop, 1, 1, PLL);
        P(-14 - b, -38 + drop, aw + 2, 5, PL); P(-14 - b, -38 + drop, aw + 2, 1, PLL);
        P(tx + tw - 3, -37 + drop, aw + 1, 4, PL);
        if (pose === 'stand' && !kit.mount) {
          var gl = step ? [4, 0] : [0, 3];
          [-7, 1].forEach(function (lx, li) {
            P(lx, -11 + gl[li], 6, 6, PL); P(lx, -11 + gl[li], 6, 1, PLL); P(lx + 5, -10 + gl[li], 1, 5, PLD);
          });
        }
      }
      if (kit.dress) {
        /* dress sleeves in the same dark cloth as the tunic, cuffs at the wrist,
           and the shoulder boards over the top: one for the 4th grade, two from
           the 3rd, fringed in gold for high command */
        var lv = kit.dress, GD = '#e8c15a', GDD = '#a8842c', SL = 'rgba(18,20,26,.55)';
        [[-13 - b, -39, 13], [tx + tw - 2, -38, 11]].forEach(function (am) {
          P(am[0], am[1] + drop, aw, am[2], pal.dark); P(am[0], am[1] + drop, aw, am[2], SL);
          P(am[0], am[1] + am[2] - 2 + drop, aw, 1.2, lv >= 5 ? GD : lv >= 4 ? GDD : 'rgba(255,255,255,.18)');   // cuff
        });
        P(-13 - b, -39 + drop, 1.5, 13, 'rgba(255,255,255,.12)');
        if (lv >= 5) { P(-14 - b, -28 + drop, aw + 2, 3, '#e9e4d6'); P(-14 - b, -26 + drop, aw + 2, 1, '#b8b2a2'); }   // white gloves
        var ew = 6 + b, ec = lv >= 3 ? GD : GDD;
        [[tx - 2 - b, lv >= 1], [tx + tw - 3, lv >= 2]].forEach(function (ep) {
          if (!ep[1]) { P(ep[0], -41 + drop, ew, 3, pal.dark); P(ep[0], -41 + drop, ew, 3, SL); return; }
          P(ep[0], -42 + drop, ew, 3, ec);                // the board
          P(ep[0], -42 + drop, ew, 0.8, '#f4d98a');
          P(ep[0] + ew / 2 - 0.7, -41.5 + drop, 1.4, 1.4, '#6a5a2a');   // its button
          if (lv >= 5) for (var fr = 0; fr < 4; fr++) P(ep[0] + 0.5 + fr * (ew - 1) / 3, -39 + drop, 0.9, 2.2, GD);   // bullion fringe
        });
      }
      if (kit.armoured) {
        // pauldrons: great curved plates, lit on top and hard-edged below
        var pld = kit.forceShoulders ? (pal.forceMid || pal.mid) : pal.helm;   // a miner's, in the company colour
        P(tx - 4 - b, -45 + drop, 8 + b, 6, pld);
        P(tx - 3 - b, -46 + drop, 6 + b, 1, pld);
        P(tx - 4 - b, -45 + drop, 8 + b, 1.5, pal.light);
        P(tx - 4 - b, -39.5 + drop, 8 + b, 0.75, pal.dark);
        P(tx + tw - 4, -45 + drop, 8 + b, 6, pld);
        P(tx + tw - 3, -46 + drop, 6 + b, 1, pld);
        P(tx + tw - 4, -45 + drop, 8 + b, 1.5, pal.light);
        P(tx + tw - 4, -39.5 + drop, 8 + b, 0.75, pal.dark);
      }
      if (kit.heavyplate) {
        // a second, larger layer of pauldron, stepped like a roof
        P(tx - 4 - b, -47 + drop, 8 + b, 3, pal.helm);
        P(tx - 4 - b, -47 + drop, 8 + b, 1, pal.light);
        P(tx - 5 - b, -42 + drop, 2, 4, pal.dark);          // the plates' rolled edges
        P(tx + tw - 4, -47 + drop, 8 + b, 3, pal.helm);
        P(tx + tw - 4, -47 + drop, 8 + b, 1, pal.light);
        P(tx + tw + 3, -42 + drop, 2, 4, pal.dark);
        P(-7, -20 + drop, 5, 5, pal.helm); P(3, -20 + drop, 5, 5, pal.helm);   // thigh plates
        P(-7, -20 + drop, 5, 1, pal.light); P(3, -20 + drop, 5, 1, pal.light);
      }
      if (kit.spikes) {                                   // spikes along the shoulders
        [tx - 3 - b, tx, tx + tw - 3, tx + tw].forEach(function (sx) {
          P(sx, -46 + drop, 2, 3, '#8a8f98');
          P(sx + 0.5, -48 + drop, 1, 2, '#c3c8d0');
        });
      }

      if (kit.cloak) {
        /* Nomads: line infantry under a camouflage cloak — a mantle over the
           shoulders and a cape down the back to the knee, broken up with
           blotches of green and brown, the hood hanging behind the helmet.
           The chest and rifle stay clear, so they read as soldiers. */
        var CM = '#5a6438', CL = '#76804c', CD = '#3a4226', CB = '#6e5a3a';
        P(tx - 3, -44 + drop, tw + 5, 5, CM);             // the mantle across the shoulders
        P(tx - 3, -44 + drop, tw + 5, 1.5, CL);
        P(tx + 4, -42 + drop, 5, 3, CB); P(tx + tw - 5, -43 + drop, 4, 3, CD);
        P(tx - 6, -41 + drop, 8, 28, CM);                 // the cape down the back
        P(tx - 6, -41 + drop, 2, 28, CL);
        P(tx - 4, -36 + drop, 5, 4, CB); P(tx - 6, -28 + drop, 4, 5, CD);   // blotches
        P(tx - 3, -22 + drop, 4, 3, CB); P(tx - 5, -32 + drop, 3, 2, CL);
        P(tx - 6, -14 + drop, 3, 2, CM); P(tx - 1, -14 + drop, 3, 2, CM);   // ragged hem
        P(tx - 6, -13 + drop, 8, 1, CD);
        P(tx + tw - 1, -40 + drop, 3, 10, CM);            // the cloak's front edge falling past the arm
        P(tx + tw - 1, -34 + drop, 3, 3, CD);
        P(-10, -52 + drop, 6, 8, CM);                     // the hood thrown back behind the helmet
        P(-10, -52 + drop, 6, 2, CL);
        P(-9, -48 + drop, 3, 3, CB);
      }

    }

    function helmet(P, drop, kit, pal) {
      switch (kit.helm) {
        case 'hood':
          P(-7, -53 + drop, 14, 9, pal.cloth);
          P(-7, -53 + drop, 5, 9, pal.dark);
          P(-8, -45 + drop, 5, 5, pal.cloth);             // cowl hanging at the neck
          P(0, -49 + drop, 7, 3, GLASS);
          P(0, -49 + drop, 2, 1, '#4e5c6a');
          break;
        case 'cap':
          P(-6, -50 + drop, 13, 4, pal.helm);
          P(-9, -49 + drop, 4, 2, pal.dark);              // peak
          P(-6, -51 + drop, 13, 1, pal.light);
          P(-4, -46 + drop, 10, 5, '#8d6f4e');            // face
          P(0, -45 + drop, 5, 2, GLASS);                  // shades
          P(-4, -46 + drop, 2, 5, '#6b5238');
          break;
        case 'heavy':
          P(-7, -54 + drop, 14, 10, pal.helm);
          P(-7, -54 + drop, 5, 9, pal.light);
          P(-5, -55 + drop, 10, 2, pal.helm);
          P(0, -50 + drop, 8, 4, GLASS);
          P(0, -50 + drop, 2, 1, '#4e5c6a');
          P(-8, -47 + drop, 2, 5, pal.dark);              // neck guard
          P(4, -56 + drop, 3, 2, pal.dark);               // crest fitting
          break;
        case 'bot':
          /* a drone's sensor head: a low wedge, wider than it is tall, with one
             lit optic band across the front and a stub aerial */
          P(-6, -53 + drop, 14, 7, pal.helm);
          P(-6, -53 + drop, 5, 7, pal.light);
          P(-4, -54.5 + drop, 10, 1.5, pal.helm);
          P(-6, -47 + drop, 14, 1, 'rgba(0,0,0,.4)');     // the jaw line
          P(0, -51 + drop, 8.5, 2.6, '#101418');          // the optic band
          P(1, -50.6 + drop, 6.5, 1.4, RB.eye);
          P(4.5, -50.8 + drop, 2, 1.8, '#e9fbff');        // the lens, brightest
          P(-5, -58 + drop, 1, 4, RB.joint);              // stub aerial
          P(-5.3, -59 + drop, 1.6, 1.4, RB.eye);
          break;
        case 'sealed':
          P(-7, -56 + drop, 15, 12, pal.helm);
          P(-7, -56 + drop, 5, 11, pal.light);
          P(-5, -58 + drop, 11, 2, pal.helm);
          P(-1, -51 + drop, 9, 3, '#2a1410');
          P(-1, -51 + drop, 9, 1, GUN.hot);               // lit eye slit
          P(-8, -45 + drop, 16, 3, pal.dark);             // collar seal
          break;
        case 'welder':
          P(-7, -53 + drop, 14, 9, pal.helm);
          P(-7, -53 + drop, 5, 9, pal.light);
          P(-1, -50 + drop, 8, 5, '#23180f');             // welding plate
          P(-1, -50 + drop, 8, 1, '#c8843a');
          P(1, -48 + drop, 3, 1, '#e8a13a');
          P(-8, -46 + drop, 2, 4, pal.dark);
          break;
        case 'scarf':
          P(-5, -52 + drop, 11, 8, '#8d6f4e');            // head
          P(-5, -52 + drop, 4, 8, '#6f573b');
          P(-6, -53 + drop, 13, 4, pal.cloth);            // headscarf
          P(-6, -53 + drop, 13, 1, pal.light);
          P(-8, -50 + drop, 3, 6, pal.cloth);             // tail hanging loose
          P(1, -47 + drop, 4, 2, '#20262d');
          break;
        case 'bare':
          P(-5, -52 + drop, 11, 8, '#8d6f4e');            // head
          P(-5, -52 + drop, 4, 8, '#6f573b');
          P(-5, -53 + drop, 11, 2, '#2e2419');            // hair
          P(1, -49 + drop, 4, 2, '#20262d');              // eyes in shadow
          if (kit.collar) {
            P(-4, -45 + drop, 9, 3, '#2a2f36');           // explosive collar
            P(1, -45 + drop, 2, 2, '#2d5a3a');           // its lamp, unlit (the board flashes it)
          }
          break;
        case 'wrap':                                      // a headwrap pulled over the face
          P(-6, -53 + drop, 13, 9, pal.cloth);
          P(-6, -53 + drop, 4, 9, pal.dark);
          P(-2, -49 + drop, 8, 3, '#20262d');             // the slit left for the eyes
          P(-2, -49 + drop, 3, 1, '#4e5c6a');
          P(-8, -47 + drop, 4, 8, pal.cloth);             // the tail, hanging
          P(-8, -40 + drop, 3, 4, pal.helm);
          break;
        case 'sidecap':                                  // a folded garrison cap, no peak
          P(-4, -47 + drop, 10, 6, '#8d6f4e');            // face
          P(-4, -47 + drop, 2, 6, '#6b5238');
          P(-7, -52 + drop, 14, 4, '#3a3024');            // hair at the sides
          P(3, -46 + drop, 1.5, 1.2, '#1c1a18');          // eye
          P(6, -45 + drop, 1, 2, '#7a5c3e');              // nose
          P(-7, -55 + drop, 13, 4, pal.mid);              // the cap, set on the head
          P(-6, -56 + drop, 10, 2, pal.mid);              // its folded ridge
          P(-7, -55 + drop, 13, 1, pal.light);
          P(-7, -52 + drop, 13, 1, '#e8c15a');            // the gold piping along its edge
          P(-5, -54 + drop, 2, 2, '#e8c15a');             // rank pin
          break;
        case 'peaked':                                   // an officer's service cap: wide crown, band, badge, peak
          P(-4, -47 + drop, 10, 6, '#8d6f4e');            // face
          P(-4, -47 + drop, 2, 6, '#6b5238');
          P(3, -46 + drop, 1.5, 1.2, '#1c1a18');          // eye
          P(6, -45 + drop, 1, 2, '#7a5c3e');              // nose
          P(-7, -52 + drop, 15, 3, pal.helm);             // the band
          P(-9, -56 + drop, 18, 4, pal.mid);              // the crown, wider than the head
          P(-9, -56 + drop, 18, 1, pal.light);
          P(-7, -52 + drop, 15, 1, '#e8c15a');            // gold braid on the band
          P(0, -55 + drop, 3, 3, '#e8c15a');              // cap badge
          P(4, -50 + drop, 7, 2, '#15171b');              // the peak, black and polished
          P(4, -50 + drop, 7, 0.6, '#5a6070');
          if (kit.goldpeak) {                             // oak leaves on the peak, a gold cord across it
            P(5, -49.4 + drop, 5, 1, '#e8c15a');
            P(-7, -51.2 + drop, 15, 0.8, '#f4d98a');
            P(-9, -56 + drop, 18, 0.8, '#e8c15a');
          }
          break;
        case 'beret':
          P(-6, -51 + drop, 13, 4, pal.mid);              // the group's colour, worn flat
          P(-6, -52 + drop, 9, 2, pal.light);
          P(5, -52 + drop, 4, 3, pal.dark);               // the fold over one ear
          P(-5, -47 + drop, 11, 7, '#8d6f4e');            // face
          P(-5, -47 + drop, 3, 7, '#6b5238');
          P(0, -45 + drop, 5, 2, '#20262d');
          P(-5, -46 + drop, 11, 1, '#2e2419');            // hair under the rim
          break;
        case 'cowl':                                      // a pilgrim's hood, face in shadow
          P(-8, -55 + drop, 16, 11, pal.cloth);
          P(-8, -55 + drop, 5, 11, pal.light);
          P(-6, -57 + drop, 12, 2, pal.cloth);
          P(-1, -50 + drop, 8, 6, '#1a1712');             // nothing but dark inside
          P(1, -48 + drop, 3, 1, '#c8843a');              // one eye catching the light
          P(-9, -46 + drop, 6, 8, pal.cloth);             // the cowl down over the shoulder
          P(-9, -40 + drop, 5, 4, pal.dark);
          break;
        case 'goggles':                                   // a rider's scarf and dust goggles
          P(-5, -52 + drop, 11, 8, '#8d6f4e');
          P(-5, -52 + drop, 4, 8, '#6f573b');
          P(-6, -53 + drop, 13, 3, pal.helm);             // a strip of cloth round the skull
          P(-3, -49 + drop, 10, 4, '#1b1f24');            // goggles
          P(-3, -49 + drop, 10, 1, '#4b545d');
          P(0, -48 + drop, 3, 2, '#8fd0e8');              // lens glare
          P(5, -48 + drop, 3, 2, '#8fd0e8');
          P(-4, -44 + drop, 9, 3, pal.cloth);             // scarf round the mouth
          P(-8, -44 + drop, 4, 6, pal.cloth);
          break;
        case 'balaclava':
          P(-6, -53 + drop, 13, 9, pal.dark);
          P(-6, -53 + drop, 4, 9, pal.helm);
          P(-1, -50 + drop, 7, 2, '#c9b28a');             // the strip of face left out
          P(-1, -50 + drop, 3, 1, '#20262d');
          P(-7, -45 + drop, 15, 3, pal.dark);             // rolled at the neck
          break;
        case 'hardhat':                                   // mining helmet, lamp lit
          P(-7, -52 + drop, 15, 7, pal.helm);
          P(-7, -52 + drop, 5, 7, pal.light);
          P(-9, -50 + drop, 4, 2, pal.helm);              // brim
          P(7, -50 + drop, 3, 2, pal.helm);
          P(-1, -53 + drop, 4, 2, pal.light);             // crown rib
          P(-6, -51 + drop, 4, 3, '#ffe9a8');             // the lamp
          P(-10, -50 + drop, 4, 2, 'rgba(255,233,168,.55)');
          P(-4, -45 + drop, 10, 5, '#8d6f4e');            // face below the brim
          P(-4, -45 + drop, 3, 5, '#6b5238');
          P(1, -44 + drop, 4, 2, '#20262d');
          P(-5, -41 + drop, 11, 3, '#2a2f36');            // dust mask at the chin
          break;
        case 'turban':                                    // a turban wound round the head, a beard below
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(1, -48 + drop, 4, 1.5, '#20262d');
          P(-4, -45 + drop, 10, 4, '#2a2118');            // the beard
          P(-2, -42 + drop, 7, 2, '#2a2118');
          var wrc = kit.wrap === 'force' ? vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.15) : (kit.wrap || '#d6ceb8');
          P(-7, -57 + drop, 15, 8, wrc);
          P(-7, -57 + drop, 5, 8, 'rgba(255,255,255,.18)');
          P(-6, -54 + drop, 13, 0.75, 'rgba(0,0,0,.2)');  // the turns of the cloth
          P(-6, -52 + drop, 13, 0.75, 'rgba(0,0,0,.18)');
          P(-9, -52 + drop, 3, 11, wrc);                  // the tail down the back
          P(-9, -52 + drop, 1, 11, 'rgba(0,0,0,.2)');
          if (kit.facewrap) {                              // the end of it wound across the face
            P(-5, -47 + drop, 11, 5, kit.wrap === 'force' ? vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.15) : (kit.wrap || '#d6ceb8'));
            P(-5, -47 + drop, 11, 0.8, 'rgba(255,255,255,.15)');
          }
          break;
        case 'pakol':                                     // a round flat wool cap, rolled at the brim
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(1, -48 + drop, 4, 1.5, '#20262d');
          P(-4, -45 + drop, 10, 4, '#3a2c1c');
          P(-2, -42 + drop, 6, 2, '#3a2c1c');
          P(-7, -54 + drop, 15, 4, '#6b5a44');            // the roll
          P(-7, -54 + drop, 15, 1, '#8a765a');
          P(-6, -57 + drop, 13, 3, '#7d6a51');            // the flat crown
          P(-6, -57 + drop, 5, 3, '#94805f');
          break;
        case 'boonie':                                    // a bush hat, brim pulled down
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(0, -48 + drop, 6, 2, '#15181d');              // dark glasses
          P(-4, -44 + drop, 9, 1.5, '#5a4632');           // stubble
          P(-6, -56 + drop, 12, 5, pal.cloth);
          P(-6, -56 + drop, 4, 5, 'rgba(255,255,255,.15)');
          P(-6, -52 + drop, 12, 1, pal.dark);             // the band
          P(-10, -51 + drop, 20, 2, pal.cloth);           // the brim, all round
          P(-10, -51 + drop, 20, 0.75, 'rgba(255,255,255,.15)');
          break;
        case 'bandana':                                   // a cloth tied over the head, knot at the back
          P(-5, -52 + drop, 11, 9, '#8d6f4e');
          P(-5, -52 + drop, 4, 9, '#6f573b');
          P(1, -49 + drop, 4, 1.5, '#20262d');
          P(-4, -44 + drop, 9, 1.5, '#3a2c1c');
          P(-6, -55 + drop, 13, 4, kit.band || '#7a2e28');
          P(-6, -55 + drop, 13, 1, 'rgba(255,255,255,.2)');
          P(-9, -53 + drop, 3, 3, kit.band || '#7a2e28');  // the knot and its ends
          P(-10, -50 + drop, 2, 4, kit.band || '#7a2e28');
          break;
        case 'biker':                                     // an open-face helmet, visor up, a bandana over the mouth
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(-3, -48 + drop, 9, 2.5, '#15181d');           // sunglasses
          P(-4, -45 + drop, 10, 3, kit.band || '#3a3e44');
          P(-7, -56 + drop, 15, 7, pal.helm);
          P(-7, -56 + drop, 5, 5, '#4a4e56');
          P(-7, -51 + drop, 3, 6, pal.helm);              // the sides, down over the ears
          P(6, -51 + drop, 2, 5, pal.helm);
          P(-5, -57 + drop, 11, 1.2, '#c0392b');          // a painted stripe
          P(-1, -58 + drop, 8, 2, '#3a3e44');             // the visor, pushed up
          break;
        case 'spiked':                                    // a blackened helmet crowned with spikes
          P(-4, -45 + drop, 9, 3, '#8d6f4e');
          P(-3, -45 + drop, 8, 2, '#c9c2b0');             // a skull mouth-guard
          P(-1, -45 + drop, 0.6, 2, '#2a2118'); P(1.5, -45 + drop, 0.6, 2, '#2a2118');
          P(-7, -55 + drop, 15, 10, pal.helm);
          P(-7, -55 + drop, 5, 10, '#454a52');
          P(-5, -56 + drop, 11, 2, pal.helm);
          P(0, -51 + drop, 8, 3, '#8c1f1f');              // red goggles
          P(1, -51 + drop, 2, 1, '#e05a4a');
          P(-5, -61 + drop, 2, 5, '#8a8f98'); P(-1, -62 + drop, 2, 6, '#8a8f98'); P(3, -60 + drop, 2, 4, '#8a8f98');
          P(-4.5, -61 + drop, 1, 2, '#c3c8d0'); P(-0.5, -62 + drop, 1, 2, '#c3c8d0');
          break;
        case 'protector':                                 // the Protectors' great helm: crested, a T-visor
          P(-8, -58 + drop, 17, 14, pal.helm);
          P(-8, -58 + drop, 6, 13, pal.light);
          P(-6, -60 + drop, 13, 2, pal.helm);
          P(-4, -62 + drop, 9, 2, pal.dark);              // the crest
          P(-4, -62 + drop, 9, 0.75, pal.light);
          P(0, -53 + drop, 9, 2, '#15181d');              // the T of the visor
          P(3, -53 + drop, 3, 6, '#15181d');
          P(0, -53 + drop, 9, 0.75, '#5fd0f0');
          P(-9, -50 + drop, 3, 7, pal.dark);              // cheek guard
          P(-9, -45 + drop, 19, 3, pal.dark);             // the gorget
          P(-9, -45 + drop, 19, 1, pal.helm);
          break;
        case 'riot':
          P(-8, -54 + drop, 16, 11, pal.helm);
          P(-8, -54 + drop, 5, 10, pal.light);
          P(-6, -56 + drop, 12, 2, pal.helm);
          P(-3, -50 + drop, 11, 6, '#1b2732');            // full face visor
          P(-3, -50 + drop, 11, 1, '#5b7284');
          P(-9, -44 + drop, 17, 3, pal.dark);             // gorget
          break;
        case 'mask':
          P(-6, -52 + drop, 13, 8, pal.helm);
          P(-6, -52 + drop, 4, 8, pal.light);
          P(-2, -48 + drop, 8, 5, '#23282e');             // respirator
          P(0, -45 + drop, 5, 3, '#3e4a44');              // filter canister
          P(0, -48 + drop, 3, 1, '#6fa08c');              // lens
          P(-7, -46 + drop, 2, 4, pal.dark);
          break;
        default:
          P(-4, -46 + drop, 9, 3, '#8d6f4e');             // the face under the rim
          P(-4, -46 + drop, 3, 3, '#6b5238');
          P(-6, -53 + drop, 13, 8, pal.helm);
          P(-6, -53 + drop, 4, 8, pal.light);
          P(-4, -54 + drop, 9, 2, pal.helm);              // crown
          P(-3, -55 + drop, 6, 1, pal.helm);              // rounded off at the top
          P(-3, -55 + drop, 3, 1, pal.light);
          P(-5, -53.5 + drop, 3, 1, '#f0e2c2');           // the dome's highlight
          P(-7, -46 + drop, 15, 1.5, pal.dark);           // the rim, all the way round
          P(-7, -46 + drop, 5, 0.75, pal.light);
          P(0, -49 + drop, 7, 3, GLASS);                  // visor
          P(0, -49 + drop, 2, 1, '#4e5c6a');              // glint
          P(4, -48.5 + drop, 2, 0.75, '#9fb6c6');         // and a second, where it curves
          P(-7, -47 + drop, 2, 4, pal.dark);              // neck guard
          P(-3, -44 + drop, 7, 1, pal.dark);              // chin strap
          P(5, -52 + drop, 2, 3, pal.dark);               // a strap clip on the side
      }
    }

    function weapon(P, kit, pal, wy) {
      /* A flag's cloth, stirring: a ripple runs out from the pole to the fly,
         the fly moving most, each fold lit or shaded as it turns. Laid in
         two-pixel columns; returns the lift of the cloth `x` out from the pole,
         for anything sewn on it. */
      function cloth(x0, y0, w, h, amp, mid, lit, dark) {
        var ph = Math.max(0, B.PH.flag || 0) / 8 * Math.PI * 2;
        function off(x) { var f = x / w; return amp * f * Math.sin(f * Math.PI * 2.2 - ph); }
        for (var x = 0; x < w; x += 2) {
          var cw = Math.min(2, w - x), f = (x + 1) / w, o = off(x + 1);
          var turn = Math.cos(f * Math.PI * 2.2 - ph) * f;
          P(x0 + x, y0 + o, cw, h, x >= w - 3 ? dark : mid);          // the fly ragged and in shadow
          if (turn < -0.3) P(x0 + x, y0 + o + 2, cw, h - 4, 'rgba(0,0,0,.16)');
          else if (turn > 0.3) P(x0 + x, y0 + o + 2, cw, h - 4, 'rgba(255,255,255,.1)');
          P(x0 + x, y0 + o, cw, 2, lit);
          P(x0 + x, y0 + o + h - 2, cw, 2, dark);
        }
        return off;
      }
      /* A five-pointed star sewn on a cloth, laid pixel by pixel (P draws only
         rectangles), each column lifted with the cloth under it. */
      function star(cx, cy, r, c, off) {
        var pts = [];
        for (var k = 0; k < 10; k++) {
          var an = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.42 : r;
          pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]);
        }
        function inside(x, y) {
          var hit = false;
          for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if ((pts[i][1] > y) !== (pts[j][1] > y) &&
                x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) hit = !hit;
          }
          return hit;
        }
        for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          var o = off ? off(x + 0.5) : 0;
          for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
            if (inside(x + 0.5, y + 0.5)) P(x, y + o, 1, 1, c);
          }
        }
      }
      switch (kit.gun) {
        case 'long':
          P(-7, wy, 34, 2, GUN.dk);
          P(12, wy - 4, 9, 3, GUN.md);                   // scope
          P(14, wy - 5, 3, 1, GUN.lt);
          P(25, wy + 2, 1, 6, GUN.md); P(28, wy + 2, 1, 6, GUN.md);
          P(-9, wy - 1, 5, 4, GUN.md);                   // stock
          break;
        case 'mg':
          P(-2, wy - 1, 28, 4, GUN.dk);
          P(-2, wy - 1, 28, 1, GUN.lt);
          P(4, wy + 3, 9, 3, '#8a7a3a');                 // ammo belt
          P(8, wy + 6, 6, 2, '#a89550');
          P(19, wy + 3, 1, 8, GUN.md); P(23, wy + 3, 1, 8, GUN.md);
          P(26, wy, 5, 3, GUN.lt);                       // flash hider
          break;
        case 'carbine':
          P(-2, wy, 17, 3, GUN.dk);
          P(0, wy + 3, 7, 6, GUN.md);                    // drum
          P(15, wy + 1, 4, 2, GUN.lt);
          P(-7, wy + 1, 6, 3, GUN.md);
          break;
        case 'heavy':
          if (kit.shoulderGL) {
            /* The Protectors' grenade launcher: an armoured box pod riding on the
               back and over the shoulder, a stubby muzzle at its front face. */
            var gy = wy - 20, bx = -25;
            P(bx, gy, 15, 12, GUN.md);                    // the box, on the back behind the shoulder
            P(bx, gy, 15, 2, GUN.lt);                     // its lit top
            P(bx, gy, 2.5, 12, 'rgba(255,255,255,.12)');
            P(bx, gy + 10, 15, 2, GUN.dk);                // its shadowed underside
            P(bx + 3, gy + 5, 9, 0.8, 'rgba(0,0,0,.45)'); // a panel seam
            P(bx + 7, gy + 3, 0.8, 7, 'rgba(0,0,0,.45)');
            P(bx + 14, gy + 2, 4, 6, GUN.dk);             // the muzzle, over the shoulder
            P(bx + 17, gy + 2.5, 1.5, 5, '#4a5260');
            P(bx + 2, gy - 2, 4, 2, '#5fd0f0');           // a sensor lens on the lid
            P(bx + 12, gy + 12, 4, 5, GUN.dk);            // its mount on the backplate
            if (kit.shoulderMsl) {                        // a drone's missile pod: two tubes, warheads showing
              P(bx + 14, gy + 1.5, 5, 4, GUN.dk); P(bx + 14, gy + 6.5, 5, 4, GUN.dk);
              P(bx + 17.5, gy + 2.5, 2, 2, '#b8b0a0'); P(bx + 17.5, gy + 7.5, 2, 2, '#b8b0a0');
            }
          }
          P(-3, wy, 23, 4, GUN.dk);                      // heavy gun
          P(20, wy + 1, 5, 3, GUN.lt);
          break;
        case 'pistol':
          P(2, wy + 3, 9, 3, GUN.dk);
          P(10, wy + 4, 3, 1, GUN.lt);
          break;
        case 'slate':
          P(-17, wy + 1, 10, 7, GUN.md);
          P(-16, wy + 2, 8, 5, '#59c6e0');
          P(-15, wy + 3, 3, 1, '#d8f4ff');
          P(-15, wy + 5, 5, 1, '#d8f4ff');
          break;
        case 'optics':
          P(-7, wy - 9, 15, 5, GUN.md);                  // raised optics
          P(-7, wy - 9, 15, 1, GUN.lt);
          P(8, wy - 8, 2, 3, '#8fe0ff');
          P(-5, wy - 4, 3, 4, GUN.dk);
          break;
        case 'case':
          P(-19, wy + 7, 12, 9, '#dfe8ef');
          P(-19, wy + 7, 12, 1, '#f4fafd');
          P(-15, wy + 9, 3, 6, '#c8384f');
          P(-17, wy + 11, 7, 2, '#c8384f');
          break;
        case 'shotgun':
          P(-3, wy + 1, 17, 4, GUN.dk);
          P(14, wy, 5, 5, GUN.lt);                       // wide muzzle
          P(0, wy + 5, 7, 3, '#4a3a26');                 // wooden fore-end
          P(-2, wy + 5, 3, 4, GUN.md);                   // pump
          P(-8, wy + 2, 6, 4, '#4a3a26');                // stock
          break;
        case 'battlerifle':
          P(-6, wy, 30, 3, GUN.dk);                      // longer barrel than a carbine
          P(-6, wy, 30, 1, GUN.lt);
          P(12, wy - 3, 5, 3, GUN.md);                   // iron sight
          P(24, wy - 1, 7, 2, GUN.md);                   // barrel shroud
          P(29, wy, 4, 3, GUN.lt);                       // muzzle brake
          P(-1, wy + 3, 5, 8, GUN.dk);                   // long box magazine
          P(-10, wy + 1, 7, 4, GUN.md);                  // stock
          break;
        case 'saw':
          P(-6, wy - 1, 31, 4, GUN.dk);                  // squad automatic
          P(-6, wy - 1, 31, 1, GUN.lt);
          P(0, wy + 3, 9, 7, '#3c4233');                 // drum
          P(0, wy + 3, 9, 1, '#5d6650');
          P(17, wy + 3, 1, 7, GUN.md); P(21, wy + 3, 1, 7, GUN.md);   // bipod
          P(25, wy - 1, 6, 4, GUN.lt);                   // flash hider
          P(-10, wy, 6, 4, GUN.md);
          break;
        case 'smg':
          P(-3, wy + 1, 15, 3, GUN.dk);
          P(-3, wy + 1, 15, 1, GUN.lt);
          P(1, wy + 4, 4, 7, GUN.dk);                    // stick magazine
          P(12, wy + 1, 4, 2, GUN.lt);
          P(-8, wy + 1, 6, 3, GUN.md);                   // folding stock
          break;
        case 'atlauncher':
          P(-13, wy - 11, 38, 8, '#3c4438');             // a big tube over the shoulder
          P(-13, wy - 11, 38, 2, '#5a6452');
          P(-17, wy - 13, 6, 12, '#2a3026');             // venturi
          P(23, wy - 13, 7, 12, '#6a5a3a');              // warhead
          P(23, wy - 13, 7, 2, '#8a7448');
          P(2, wy - 3, 5, 5, GUN.md);                    // grip
          P(6, wy - 15, 5, 4, GUN.lt);                   // optical sight
          break;
        case 'none': break;
        case 'shell':
          P(2, wy + 2, 4, 9, '#4a4438');                 // a round, held ready
          P(2, wy + 1, 4, 2, '#8a5a2a');
          P(2, wy + 9, 4, 2, GUN.md);
          break;
        case 'flamer':
          P(-4, wy, 22, 6, '#3a3f38');                   // heavy barrel
          P(-4, wy, 22, 2, '#5c6458');
          P(18, wy - 1, 7, 8, '#6a5a3a');                // flared muzzle
          P(18, wy - 1, 7, 2, '#8a7448');
          // the pilot flame at the muzzle, licking up and flickering
          var fp = B.PH.flame < 0 ? 1 : B.PH.flame, fh = [6, 9, 7, 10][fp], fl = [0, 1, 0, -1][fp];
          P(25, wy + 6 - fh, 5, fh, '#e08a3a');
          P(26 + fl, wy + 6 - fh - 3, 3, 3, '#e08a3a');
          P(26, wy + 6 - Math.ceil(fh * 0.65), 3, Math.ceil(fh * 0.65), '#ffc861');
          P(-8, wy + 5, 7, 3, '#2f3a34');                // fuel line to the tanks
          P(-6, wy + 3, 4, 3, GUN.md);
          break;
        case 'console':
          P(-16, wy + 2, 11, 8, '#2b3038');
          P(-15, wy + 3, 9, 6, '#3fa87f');
          P(-14, wy + 4, 4, 1, '#c9f6e2');
          P(-14, wy + 6, 6, 1, '#c9f6e2');
          break;
        case 'huntingrifle':                              // a long civilian rifle, wooden stock
          P(-6, wy, 28, 2, GUN.dk);
          P(-9, wy - 1, 8, 4, '#6b4a26');                // stock
          P(-9, wy - 1, 8, 1, '#8d6535');
          P(2, wy - 1, 7, 2, '#6b4a26');                 // fore-end
          P(9, wy - 3, 5, 2, GUN.md);                    // a hunting scope, taped on
          P(22, wy - 1, 3, 1, GUN.lt);
          break;
        case 'molotov':                                   // a bottle, a rag, and a lighter
          P(-13, wy - 2, 5, 8, '#3f6a3a');
          P(-13, wy - 2, 2, 8, '#6aa05f');
          P(-12, wy - 6, 3, 4, '#d8cfae');               // the rag
          P(-12, wy - 8, 3, 2, '#e08a3a');
          P(-12, wy - 10, 2, 2, '#ffc861');              // lit
          P(2, wy + 2, 12, 2, GUN.dk);                   // a pistol on the other hip
          P(2, wy + 4, 3, 4, GUN.md);
          break;
        case 'machete':                                   // a blade, held high
          P(-11, wy - 1, 4, 5, '#4a3a22');               // grip
          P(-9, wy - 22, 4, 22, '#8d98a4');              // the blade
          P(-9, wy - 22, 2, 22, '#c6d0da');
          P(-9, wy - 24, 5, 3, '#9aa6b2');               // the tip
          P(-12, wy - 3, 7, 2, '#2b2318');               // guard
          break;
        case 'lascutter':                                 // a mining cutter, beam struck
          P(-10, wy, 17, 5, '#4a4a52');
          P(-10, wy, 17, 2, '#6e6e78');
          P(-12, wy + 1, 4, 6, '#33333a');               // grip
          P(7, wy + 1, 6, 3, '#2a2a30');                 // emitter housing
          P(13, wy + 1, 12, 2, '#ff6a3a');               // the cutting beam
          P(13, wy + 1, 12, 1, '#ffd9a8');
          P(24, wy, 3, 4, 'rgba(255,150,80,.55)');       // the glare at the tip
          P(-6, wy + 5, 6, 3, '#7a4a1e');                // the cell on its strap
          break;
        case 'rpg': {                                     // an RPG-7, up on the shoulder
          var ry = wy - 10;
          P(-14, ry, 30, 3, '#2e2a24');                  // the tube
          P(-14, ry, 30, 1, '#57503f');
          P(-2, ry - 0.5, 9, 4, '#7a5230');              // wooden heat guard
          P(-2, ry - 0.5, 9, 1, '#9a6c40');
          P(-19, ry - 1.5, 6, 6, '#24211c');             // the flared venturi behind
          P(-20, ry - 2, 2, 7, '#3a352c');
          P(16, ry - 1, 4, 5, '#4a4a3a');                // the warhead: a neck, then the cone
          P(20, ry - 3, 6, 9, '#5a6038');
          P(20, ry - 3, 6, 2, '#7a8250');
          P(26, ry - 1.5, 3, 6, '#5a6038');
          P(29, ry + 0, 2, 3, '#3a3e26');                // the nose
          P(1, ry + 3, 3, 6, '#2e2a24');                 // grips below the tube
          P(-6, ry + 3, 3, 5, '#2e2a24');
          P(4, ry - 3, 3, 3, GUN.md);                    // the sight
          break;
        }
        case 'flagsmall': case 'flagbig': case 'flaghuge': {
          /* A flag in the side's own colour, so it is plain across the table whose
             leader this is: small for a local leader, large for a great one. */
          var huge = kit.gun === 'flaghuge', big = huge || kit.gun === 'flagbig';
          // the flag is the company's own colour (it was the revolution's red)
          var fm = pal.forceMid || pal.mid, fl2 = pal.force || pal.light, fd = pal.forceDark || pal.dark;
          var poleH = huge ? 92 : big ? 74 : 56, fw2 = huge ? 48 : big ? 36 : 24, fh2 = huge ? 32 : big ? 24 : 15;
          P(-10, wy - poleH + 8, 2, poleH, '#5b4326');
          P(-10, wy - poleH + 6, 3, 3, '#c8a33a');       // finial
          var fo = cloth(-8, wy - poleH + 8, fw2, fh2, huge ? 2.4 : big ? 2 : 1.5, fm, fl2, fd);
          // the revolution's black star, in the middle of the cloth
          star(-8 + fw2 * 0.45, wy - poleH + 8 + fh2 / 2 + 0.5, fh2 * 0.36, '#14161a', function (x) { return fo(x + 8); });
          P(2, wy + 2, 12, 2, GUN.dk);                   // a carbine besides
          break;
        }
        case 'banner': {                                  // the group's colours on a pole
          P(-10, wy - 40, 2, 48, '#5b4326');
          P(-10, wy - 42, 3, 3, '#c8a33a');              // finial
          // the banner, in the company's colour
          var bo = cloth(-8, wy - 40, 20, 15, 1.5, pal.forceMid || pal.mid, pal.force || pal.light, pal.forceDark || pal.dark);
          if (!kit.plainFlag) {                          // the star sewn on, riding the cloth
            var so = bo(10);
            P(-2, wy - 37 + so, 8, 8, '#e0b43a');
            P(1, wy - 39 + so, 2, 12, '#e0b43a');
          }
          P(2, wy + 2, 12, 2, GUN.dk);                   // and a carbine besides
          break;
        }
        case 'megaphone':
          P(-13, wy - 2, 6, 6, '#2b3038');
          P(-7, wy - 5, 9, 12, '#b8342f');               // the horn
          P(-7, wy - 5, 4, 12, '#d8554a');
          P(2, wy - 6, 3, 14, '#8f231f');
          P(-14, wy + 4, 5, 3, '#1b1f24');               // grip
          P(6, wy + 3, 11, 2, GUN.dk);                   // a pistol in the other hand
          break;
        default:                                          // service rifle
          P(-4, wy, 24, 3, GUN.dk);
          P(-4, wy, 24, 1, GUN.lt);
          P(2, wy - 1, 10, 1, GUN.md);                   // the receiver's top rail
          P(3, wy - 1.5, 1, 0.5, GUN.lt); P(6, wy - 1.5, 1, 0.5, GUN.lt); P(9, wy - 1.5, 1, 0.5, GUN.lt);
          P(14, wy - 3, 4, 4, GUN.md);                   // sight
          P(15, wy - 2, 2, 1, '#8fd0e8');                // its lens
          P(-2, wy + 3, 6, 5, GUN.dk);                   // magazine
          P(-2, wy + 3, 1, 5, GUN.md);                   // curved, lit down one edge
          P(-2, wy + 5.5, 6, 0.75, GUN.md);
          P(-6, wy + 3, 3, 3, GUN.dk);                   // pistol grip
          P(9, wy + 3, 7, 2, GUN.md);                    // foregrip
          P(9, wy + 3, 7, 0.75, GUN.lt);
          P(20, wy + 1, 5, 1, GUN.lt);                   // muzzle
          P(24, wy, 2, 3, GUN.md);                       // and its brake
          P(-9, wy + 1, 6, 3, GUN.md);                   // stock
          P(-9, wy + 1, 6, 0.75, GUN.lt);
          P(-9, wy + 3.5, 2, 0.75, '#08090c');           // the butt pad
          // the rear hand on the foregrip, over the gun — it is being held
          P(10, wy + 2, 4, 3, BOOT);
          P(10, wy + 2, 2, 1, '#454b54');
      }
    }

    return { mount: mount, legs: legs, pack: pack, torso: torso, arms: arms, helmet: helmet, weapon: weapon };
  };
})(window);
