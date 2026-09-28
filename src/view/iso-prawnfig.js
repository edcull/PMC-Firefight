/* PMC 2670 — Firefight : the prawns: the rebel army as tall crustacean aliens, drawn side-on

   Made once by iso-aliens.js, the first time it is wanted, with E: the names
   of iso-aliens.js this needs, bound here once. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCIsoPrawnFig = function (E) {
    var hexMix = E.hexMix, vividHex = E.vividHex;
    /* The bare shell comes in three browns, each a hard carapace over a paler
       belly and softer joints; the armour is black plate with white panels. */
    var SHELLS = [
      { lt: '#d9b458', md: '#a57d36', dk: '#654822', sh: '#3d2b16', belly: '#e0c985', soft: '#b98a55', eye: '#1c140c' },
      { lt: '#cf9a52', md: '#9a6431', dk: '#5e3a1e', sh: '#3a2413', belly: '#dcb982', soft: '#b07a50', eye: '#1c120a' },
      { lt: '#c2a55c', md: '#8e7638', dk: '#56461f', sh: '#352b14', belly: '#d6c68c', soft: '#a88a58', eye: '#171209' }
    ];
    var PLATE = { lt: '#565c66', md: '#30343b', dk: '#1b1d22', sh: '#0e0f12' };
    var WHITE = { lt: '#f1efe8', md: '#c9c5bb', dk: '#8c887f' };
    var DEAD = { lt: '#8c887c', md: '#6f6b62', dk: '#4c4943', sh: '#34322e', belly: '#9a958a', soft: '#77736a', eye: '#2a2826' };
        // a giant shrimp: paler and pinker than the prawns who ride it
    var SHRIMP = { lt: '#e2a57a', md: '#bf7a52', dk: '#7c4a30', sh: '#4c2c1c', belly: '#efc7a2', eye: '#140c08' };

    // the army's colour as the prawns burn it in their weapons and armour: bright
    function glowOf(pal) { return vividHex(pal.light, 1.5, 1.1); }
    function hexA(hex, al) {
      var r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + gg + ',' + b + ',' + al + ')';
    }

    /* Where the shot leaves, in art units from the feet, for each weapon a
       prawn carries (standing; kneeling, prone and mounted are worked from it). */
    var MUZ = {
      pistol: [24, -46], carbine: [29, -47], rifle: [34, -47], long: [41, -47], mg: [33, -43],
      launcher: [30, -58], orb: [16, -70], cutter: [27, -45]
    };
    var SEAT = 26;                                  // a shrimp's back, and so its rider's seat, above the ground
    function prawnMuzzle(kit, pose) {
      var m = MUZ[kit.gun] || [14, -46];
      if (kit.mount) return [m[0] + 3, m[1] - (SEAT - 30) - 22];
      if (pose === 'kneel') return [m[0], m[1] + 12];
      if (pose === 'prone') return [m[0], m[1] + 22];
      return m;
    }

    function paintPrawn(g, ox, oy, pal, kit, pose, step, s, dead, corpse) {
      var SK = dead ? DEAD : SHELLS[kit.shell || 0];
      var armoured = kit.prawn === 'armour';
      var AR = dead ? { lt: '#6a6862', md: '#4e4c47', dk: '#383632', sh: '#262522' } : PLATE;
      var WH = dead ? { lt: '#8c887c', md: '#77736a', dk: '#5a574f' } : WHITE;
      var GW = dead ? '#4c4a44' : glowOf(pal), GWL = dead ? '#5e5b54' : hexMix(GW, '#ffffff', 0.55);
      var FORCE = dead ? '#55524c' : vividHex(pal.mid, 1.6, 1.08), FORCE_L = dead ? '#5e5b54' : vividHex(pal.light, 1.6, 1.04);
      /* Only the dead lie flat out; a live prawn gone to ground (a marksman,
         a squad getting up as it arrives) is down on its folded legs, lower
         than kneeling, its weapon still to the front. */
      var prone = pose === 'prone' && !!corpse, flat = pose === 'prone' && !corpse;
      var kneel = pose === 'kneel' || flat, rid = !!kit.mount;
      function X(x) { return ox + x * s; }
      function Y(y) { return oy + y * s; }
      function El(cx, cy, rx, ry, c, rot) {
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
      function Q(pts, w, c) {                            // a smooth curve through the points
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
      // a shell plate: the shadow under it, its body, a lit crown
      function plate(cx, cy, rx, ry, rot, T) {
        El(cx + rx * 0.08, cy + ry * 0.1, rx, ry, T.sh || T.dk, rot);
        El(cx, cy, rx * 0.96, ry * 0.94, T.dk, rot);
        El(cx - rx * 0.08, cy - ry * 0.12, rx * 0.84, ry * 0.78, T.md, rot);
        El(cx - rx * 0.26, cy - ry * 0.36, rx * 0.46, ry * 0.34, T.lt, rot);
      }
      function glow(cx, cy, r) {
        if (dead) { El(cx, cy, r, r, GW); return; }
        El(cx, cy, r * 2.3, r * 2.3, hexA(GW, 0.26));
        El(cx, cy, r, r, GW);
        El(cx - r * 0.25, cy - r * 0.25, r * 0.45, r * 0.45, GWL);
      }
      /* A limb: a chain of hard segments, each a tapered plate with a darker
         joint where it meets the next. */
      function limb(pts, w0, w1, T, joints) {
        var n = pts.length - 1;
        for (var i = 0; i < n; i++) {
          var wa = w0 + (w1 - w0) * i / n, wb = w0 + (w1 - w0) * (i + 1) / n;
          L([pts[i], pts[i + 1]], (wa + wb) / 2 + 0.5, T.sh || T.dk);
          L([pts[i], pts[i + 1]], (wa + wb) / 2, T.dk);
          L([[pts[i][0] - 0.2, pts[i][1] - 0.3], [pts[i + 1][0] - 0.2, pts[i + 1][1] - 0.3]], (wa + wb) / 4, T.md);
        }
        if (joints !== false) for (var j = 1; j < n; j++) El(pts[j][0], pts[j][1], w0 * 0.55, w0 * 0.5, T.sh || T.dk);
      }

      g.save();
      if (prone) {                                        // flat on its belly, head to the right
        g.translate(X(-16), Y(-3)); g.rotate(1.42); g.translate(-X(-16), -Y(-3));
      }

      /* ---- the shrimp it rides: horse-sized, side-on, walking on its many legs ---- */
      var up = 0;                                         // how far the rider's body is lifted off the ground
      if (rid) {
        var SH = dead ? DEAD : SHRIMP, st2 = step ? 1 : 0;
        var bb = -SEAT + 4;                               // the middle of its body
        // the far legs, dark, under the body
        for (var fl = 0; fl < 4; fl++) {
          var fx = 12 - fl * 7, sw = ((fl + st2) % 2) ? 2.4 : -2.4, out = fl < 2 ? 5 : -4;
          limb([[fx, bb + 4], [fx + out + sw * 0.4, bb + 8], [fx + out * 1.3 + sw, 0]], 1.6, 0.8, { md: SH.dk, dk: SH.sh, sh: SH.sh }, false);
        }
        // the tail: segments curling down behind it to a fan
        var tail = [[-12, bb - 1], [-20, bb + 1], [-26, bb + 5], [-29, bb + 11], [-28, bb + 16]];
        for (var ti = tail.length - 1; ti >= 0; ti--) {
          var tr = 5.6 - ti * 0.75;
          plate(tail[ti][0], tail[ti][1], tr, tr * 0.88, -0.4 - ti * 0.25, SH);
        }
        F([[-28, bb + 15], [-35, bb + 22], [-30, bb + 23], [-26, bb + 19], [-23, bb + 23], [-22, bb + 18]], SH.md);   // the fan
        L([[-28, bb + 16], [-33, bb + 21]], 0.5, SH.dk); L([[-27, bb + 17], [-25, bb + 22]], 0.5, SH.dk);
        // the body: a long curved carapace, segmented behind, a cephalothorax in front
        plate(-3, bb, 15, 8, 0.05, SH);
        plate(11, bb - 1.5, 10, 7.5, -0.12, SH);
        El(-3, bb + 5, 13, 3, SH.belly);                   // the pale underside
        [-12, -7, -2, 3].forEach(function (x) { L([[x, bb - 6.5], [x - 1, bb + 6]], 0.5, SH.dk); });
        // the rostrum, a spike out over the face, and eyes on stalks
        F([[18, bb - 5], [33, bb - 8], [19, bb - 2]], SH.md);
        L([[18, bb - 5], [33, bb - 8]], 0.5, SH.lt);
        L([[17, bb - 4], [20, bb - 8]], 1.3, SH.dk);
        El(20.4, bb - 8.6, 1.9, 1.7, SH.eye); if (!dead) El(19.9, bb - 9.1, 0.6, 0.5, '#f0e2c8');
        // antennae: two long whips swept back over it
        Q([[19, bb - 4], [26, bb - 12], [14, bb - 13], [-14, bb - 8], [-30, bb - 2]], 0.55, SH.dk);
        Q([[20, bb - 3], [29, bb - 9], [20, bb - 11], [-6, bb - 11], [-24, bb - 6]], 0.5, SH.md);
        // feelers in front, under the rostrum
        L([[20, bb + 1], [26, bb + 5], [27, bb + 10]], 0.8, SH.md);
        L([[19, bb + 2], [23, bb + 8], [22, bb + 12]], 0.8, SH.dk);
        // the near legs
        for (var nl = 0; nl < 4; nl++) {
          var nx = 13 - nl * 7, sw2 = ((nl + st2) % 2) ? -2.8 : 2.8, out2 = nl < 2 ? 6 : -5;
          limb([[nx, bb + 5], [nx + out2 + sw2 * 0.4, bb + 9], [nx + out2 * 1.3 + sw2, 0]], 2, 1, SH, false);
        }
        // a saddle cloth in the army's colour, and the saddle
        F([[-9, bb - 7], [5, bb - 7.5], [6, bb + 1], [-10, bb + 1.5]], FORCE);
        L([[-9, bb + 1.2], [6, bb + 0.8]], 0.8, dead ? '#3a3834' : hexMix(FORCE, '#000000', 0.35));
        L([[-8, bb - 7], [5, bb - 7.5]], 0.7, FORCE_L);
        El(-2, bb - 8, 6.5, 2.2, dead ? '#3a3834' : '#3a2616');
        up = SEAT - 30 + 2;                                // seated: the hip on the saddle
      }

      /* ---- the prawn: reverse-jointed legs, a hunched segmented body, a long
         head thrust forward over a beard of mouth-feelers, and thin plated arms ---- */
      var lo = flat ? 22 : kneel ? 12 : 0, bob = step ? -1 : 0, st = step ? 1 : 0;
      var hipY = -30 + lo - up;
      var FAR = { lt: SK.md, md: SK.dk, dk: SK.sh, sh: SK.sh };
      var LEGT = armoured ? { lt: AR.lt, md: AR.md, dk: AR.dk, sh: AR.sh } : SK;
      var LEGF = armoured ? { lt: AR.md, md: AR.dk, dk: AR.sh, sh: AR.sh } : FAR;
      function leg(near) {
        var T = near ? LEGT : LEGF, dx = near ? 1 : -1;
        var hip = [dx * 0.5, hipY];
        if (rid) {                                        // astride: the thigh along the flank, the shin hanging
          limb([hip, [7 * dx + 4, hipY + 4], [5 * dx + 3, hipY + 13]], 2.6, 1.6, T);
          L([[5 * dx + 3, hipY + 13], [9 * dx + 5, hipY + 14]], 1.4, T.dk);
          return;
        }
        var knee, hock, foot, toe;
        if (flat) {
          knee = [near ? 10 : 7, -4]; hock = [near ? 0 : -3, -2]; foot = [near ? -6 : -9, 0]; toe = [foot[0] + 6, 0];
        } else if (kneel) {
          knee = [near ? 9 : 5, -9]; hock = [near ? 1 : -3, -3]; foot = [near ? -4 : -8, 0]; toe = [foot[0] + 7, 0];
        } else {
          var sw = (near ? 1 : -1) * (st ? 3 : -2);
          knee = [8 + sw * 0.5, hipY + 10]; hock = [-5 + sw, -11]; foot = [0 + sw * 1.2, 0]; toe = [foot[0] + 8, 0.2];
        }
        limb([hip, knee, hock, foot], 3.6, 1.5, T);
        L([foot, toe], 1.3, T.dk);                        // the long foot and its claw
        L([[foot[0] + 1, foot[1]], [toe[0] - 2, toe[1] - 1.2], toe], 0.6, T.sh || T.dk);
        if (armoured) {                                   // a shin guard and a knee plate
          L([knee, [(knee[0] + hock[0]) / 2, (knee[1] + hock[1]) / 2]], 3.2, T.md);
          plate(knee[0], knee[1], 2.3, 2, 0, near ? AR : { lt: AR.md, md: AR.dk, dk: AR.sh, sh: AR.sh });
          if (near) L([[knee[0] - 1.2, knee[1] - 0.8], [knee[0] + 1.2, knee[1] - 0.6]], 0.5, WH.lt);
        }
      }
      leg(false);

      // the far arm, reaching round behind the weapon
      var by = hipY - 14 + bob;                            // the chest
      var shx = 4, shy = hipY - 21 + bob;                  // the shoulder
      var gy = hipY - 17 + bob;                            // the weapon's line
      var wpn = kit.gun || 'rifle';
      var grip = [11, gy + 1.4], fore = [19, gy - 0.2];
      if (wpn === 'pistol') { grip = [18, gy + 0.6]; fore = [17, gy + 1.6]; }
      else if (wpn === 'mg') { grip = [9, gy + 4]; fore = [18, gy + 3]; }
      else if (wpn === 'launcher') { grip = [8, gy - 5]; fore = [16, gy - 7]; }
      else if (wpn === 'orb') { grip = [12, gy - 18]; fore = [10, gy + 4]; }
      else if (/^flag/.test(wpn)) { grip = [13, gy]; fore = [13, gy - 8]; }
      else if (wpn === 'shell' || wpn === 'none') { grip = [12, gy + 3]; fore = [16, gy + 2]; }
      else if (wpn === 'optics') { grip = [15, gy - 11]; fore = [16, gy - 12]; }
      var farT = armoured ? { lt: AR.md, md: AR.dk, dk: AR.sh, sh: AR.sh } : FAR;
      var farEl = [shx + 1, shy + 9];
      limb([[shx - 2, shy + 1], farEl, [fore[0] - 0.5, fore[1] + 0.8]], 2.2, 1.3, farT);

      /* the body: a long abdomen of overlapping plates hunched forward from the
         hips, a paler belly, and a broad back carapace over the shoulders */
      var body = armoured ? AR : SK;
      [[1, hipY - 2, 5.5, 4.2], [2, hipY - 6.5, 6.4, 4.4], [3, hipY - 11, 7, 4.6]].forEach(function (b, i) {
        plate(b[0], b[1] + bob, b[2], b[3], -0.35, armoured ? AR : SK);
      });
      if (armoured) {                                                  // a white belly plate, ribbed
        El(5.5, hipY - 7 + bob, 2.6, 6.4, WH.md, -0.35);
        El(5, hipY - 8 + bob, 1.4, 4.4, WH.lt, -0.35);
        [0, 1, 2].forEach(function (i) { L([[3.6 + i * 0.9, hipY - 3.4 - i * 3.4 + bob], [7.8 + i * 0.9, hipY - 4.6 - i * 3.4 + bob]], 0.45, WH.dk); });
      } else {
        El(5.5, hipY - 7 + bob, 3, 7, SK.belly, -0.35);                // the soft belly, under the plates
        [0, 1, 2, 3].forEach(function (i) { L([[3 + i * 0.9, hipY - 2 - i * 3.4 + bob], [8 + i * 0.9, hipY - 3.6 - i * 3.4 + bob]], 0.45, SK.soft); });
      }
      plate(1.5, by - 2, 8.2, 7.2, -0.5, body);                          // the back carapace
      if (!armoured) {
        // ridges down the back, and a frill of spines along the top
        L([[-5, by + 2], [-3, by - 5], [2, by - 8.5]], 0.6, SK.dk);
        for (var sp = 0; sp < 4; sp++) F([[-4.5 + sp * 2.2, by - 3 - sp * 1.7], [-7 + sp * 2.1, by - 6 - sp * 1.9], [-3.2 + sp * 2.2, by - 5 - sp * 1.7]], SK.dk);
      } else {
        // armour: white panels on the back plate, a stripe of the army's colour, a power cell
        F([[-3.5, by - 7.2], [3.5, by - 8.8], [5, by - 5.2], [-2.5, by - 3.6]], WH.md);
        F([[-3.2, by - 7], [3.2, by - 8.5], [3.8, by - 7.2], [-2.8, by - 5.8]], WH.lt);
        L([[-6, by + 1.5], [4.5, by - 1.5]], 1.2, FORCE);
        L([[-6, by + 0.9], [4.5, by - 2.1]], 0.45, FORCE_L);
        if (kit.plates) {                                              // the harsh-environment rig: tanks on the back
          El(-7.5, by - 1, 2.6, 5.6, AR.md); El(-8.2, by - 2.6, 1, 3.2, AR.lt);
          glow(-7.5, by + 3.6, 0.7);
        } else glow(-5.6, by - 1.2, 0.8);
      }
      // a leader wears a sash of the army's colour across the body
      if (kit.mark) {
        L([[-2, by - 7], [6, hipY - 4 + bob]], 2.2, dead ? '#44423e' : hexMix(FORCE, '#000000', 0.25));
        L([[-2, by - 7], [6, hipY - 4 + bob]], 1.3, FORCE);
      } else if (!armoured) {
        // the rest tie a rag of it round the upper arm (drawn with the arm, below)
      }
      // a pack, slung on the back
      if (kit.pack && kit.pack !== 'none' && !rid) {
        var pc = kit.pack === 'ammo' ? '#5a5a3a' : kit.pack === 'charges' ? '#4a3a2a' : kit.pack === 'missile' ? '#4a5238' : '#4d4232';
        El(-6.5, by + 1, 3.4, 4.6, dead ? '#3a3834' : pc);
        El(-7.2, by - 0.4, 1.4, 2.4, dead ? '#4c4a44' : hexMix(pc, '#ffffff', 0.2));
        if (kit.pack === 'missile') { L([[-7, by - 4], [-6, by - 11]], 2.2, dead ? '#3a3834' : '#56603e'); El(-6, by - 11.4, 1.1, 1.1, '#6a3a24'); }
      }

      /* the head: a long crested skull thrust forward and down from the
         shoulders, two dark eyes set in its side, and under it the beard of
         mouth-feelers that hangs where a jaw would be */
      var hx = 12, hy = by - 13 + bob;
      // the near leg, over the body
      leg(true);

      /* the head, before the weapon held up in front of it: a long crested skull thrust forward and
         down from the shoulders, two dark eyes set in its side, and under it
         the beard of mouth-feelers that hangs where a jaw would be */
      limb([[shx, shy + 1], [hx - 3, hy + 3]], 3, 2.4, SK, false);        // the neck, thrust forward
      // antennae, first: two long whips from the brow, swept up and back
      Q([[hx + 1, hy - 3], [hx - 2, hy - 11], [hx - 9, hy - 16], [hx - 16, hy - 16]], 0.6, dead ? DEAD.dk : SK.dk);
      Q([[hx + 2, hy - 3], [hx + 1, hy - 12], [hx - 4, hy - 19], [hx - 10, hy - 22]], 0.55, dead ? DEAD.md : SK.md);
      // the skull: a long wedge, the crest raked back off it
      var HD = armoured ? AR : SK;                      // an armoured prawn's head is all helmet
      F([[hx - 8, hy - 1], [hx - 12, hy - 7], [hx - 3, hy - 4.5]], HD.dk);                   // the crest
      El(hx + 0.5, hy + 0.3, 7.6, 4.6, HD.sh, 0.12);
      El(hx, hy - 0.2, 7.2, 4.2, HD.md, 0.12);
      El(hx - 1.8, hy - 2, 4.6, 2, HD.lt, 0.12);
      F([[hx + 5, hy - 1.2], [hx + 11.5, hy + 3.4], [hx + 9, hy + 4.4], [hx + 4.5, hy + 3]], HD.md);   // the snout, drooping
      L([[hx + 5, hy - 1.1], [hx + 11.3, hy + 3.3]], 0.5, HD.lt);
      if (armoured) {                                    // a white stripe over the crown, a visor of the army's light
        L([[hx - 6.5, hy - 1.6], [hx - 1, hy - 4], [hx + 4.5, hy - 2.4]], 0.9, WH.lt);
        L([[hx + 0.8, hy + 0.2], [hx + 5.2, hy + 0.4]], 1.3, GW);
        if (!dead) El(hx + 3, hy + 0.2, 3.4, 1.8, hexA(GW, 0.3));
      } else {
        [[-3, -3.4], [0, -3.9], [3, -3.2]].forEach(function (r) { L([[hx + r[0], hy + r[1]], [hx + r[0] + 1.2, hy + r[1] + 3]], 0.4, SK.dk); });   // the head's ridges
        El(hx + 3, hy - 0.2, 1.9, 1.5, SK.eye);                       // the eye, deep and wet
        if (!dead) El(hx + 2.5, hy - 0.7, 0.6, 0.5, '#f4ecd6');
      }
      // the mouth-feelers: a dozen short tendrils hanging from under the snout
      var FT = dead ? { a: DEAD.soft, b: DEAD.dk } : { a: SK.soft, b: hexMix(SK.soft, '#6a2a28', 0.35) };
      El(hx + 6, hy + 3.8, 3, 1.4, FT.b);                              // the mouth, under the snout
      [[3, 5.5, -1], [4.6, 7, 0], [6.2, 7.6, 1], [7.8, 7, 1.8], [9.4, 5.6, 2.6]].forEach(function (f, i) {
        var sway = step && i % 2 ? 0.7 : 0;
        Q([[hx + f[0], hy + 3.4], [hx + f[0] + f[2] * 0.3, hy + 3.4 + f[1] * 0.55], [hx + f[0] + f[2] * 0.2 + sway, hy + 3.4 + f[1]]], 0.75, i % 2 ? FT.b : FT.a);
      });


      /* the weapon, in the aliens' own make: a white shell, black grips,
         prongs and mouths, and the army's colour burning in its cells and
         its charge. Arc rifles, sonic guns, missile pods. */
      var WG = dead ? { lt: '#8c887c', md: '#77736a', dk: '#5a574f', sh: '#3a3834' }
        : { lt: '#fbfaf6', md: '#e2ded4', dk: '#aaa59a', sh: '#5e5a53' };
      var BK = dead ? { lt: '#4c4a44', md: '#3a3834', dk: '#2a2826' } : { lt: '#4a4e55', md: '#23262b', dk: '#111215' };
      // a white housing from x0 to x1 along y, t thick: outlined, lit along the top, shaded under
      function housing(x0, x1, y, t, y1) {
        y1 = y1 == null ? y : y1;
        L([[x0, y], [x1, y1]], t + 0.9, WG.sh);
        L([[x0, y], [x1, y1]], t, WG.md);
        L([[x0 + 0.6, y + t * 0.3], [x1 - 0.6, y1 + t * 0.3]], t * 0.35, WG.dk);
        L([[x0 + 0.8, y - t * 0.28], [x1 - 0.8, y1 - t * 0.28]], t * 0.3, WG.lt);
      }
      function cell(x, y, r) {                                     // a glowing charge cell, set in black
        El(x, y, r * 1.35, r * 1.1, BK.dk);
        glow(x, y, r * 0.8);
      }
      function stock(x0, y, t) {                                   // the black butt to the shoulder, and a grip
        L([[x0 + 2, y + t * 0.3], [x0 - 1.5, y + t + 1.6]], t * 0.8, BK.md);
        L([[x0 + 7, y + t * 0.4], [x0 + 7.4, y + t + 2.4]], 1.5, BK.md);
      }
      // an arc rifle: the white body, a strip of the army's colour, and two black prongs with the arc between
      function arcRifle(x0, x1, y, t, cells) {
        stock(x0, y, t);
        housing(x0, x1, y, t);
        L([[x0 + 3, y + t * 0.05], [x1 - 3, y + t * 0.05]], 0.5, FORCE);
        for (var c = 0; c < cells; c++) cell(x0 + (x1 - x0) * (0.4 + 0.18 * c), y - 0.1, t * 0.34);
        L([[x1 - 1, y - t * 0.45], [x1 + 3.5, y - t * 0.55]], 0.9, BK.md);     // the prongs
        L([[x1 - 1, y + t * 0.45], [x1 + 3.5, y + t * 0.55]], 0.9, BK.md);
        if (!dead) L([[x1 + 3.4, y - t * 0.5], [x1 + 2.4, y - 0.1], [x1 + 3.6, y + 0.2], [x1 + 2.6, y + t * 0.5]], 0.45, GWL);
        glow(x1 + 3.8, y, t * 0.26);
      }
      if (wpn === 'rifle') arcRifle(4, 30, gy, 3.4, 2);
      else if (wpn === 'carbine') arcRifle(6, 25, gy, 3.1, 1);
      else if (wpn === 'long') {
        arcRifle(3, 37, gy, 2.8, 3);
        L([[11, gy - 2.8], [20, gy - 2.8]], 1.9, BK.md); El(20.6, gy - 2.8, 0.8, 1, GW);   // the sight
      } else if (wpn === 'pistol') {
        housing(15, 22, gy + 0.6, 2.4, gy);
        L([[16.5, gy + 1.2], [16, gy + 3.8]], 1.5, BK.md);
        L([[22, gy - 0.5], [24, gy - 0.6]], 0.7, BK.md); L([[22, gy + 0.6], [24, gy + 0.7]], 0.7, BK.md);
        glow(24.4, gy, 0.6);
      } else if (wpn === 'mg') {
        /* a sonic gun, at the hip: a fat white housing, a black carrying
           handle, and a flared black horn with the army's colour ringing in it */
        L([[8, gy - 1], [11, gy - 2.6], [19, gy - 2.6], [21, gy - 0.6]], 1.1, BK.md);
        housing(3, 25, gy + 3.4, 4.6, gy + 3);
        L([[6, gy + 4], [22, gy + 3.6]], 0.6, FORCE);
        cell(10, gy + 7.2, 1.4);
        F([[24, gy + 0.6], [31.5, gy - 1.6], [31.5, gy + 7.8], [24, gy + 5.6]], BK.md);      // the horn
        F([[24, gy + 0.6], [31.5, gy - 1.6], [31.5, gy - 0.4], [24, gy + 1.6]], BK.lt);
        g.strokeStyle = dead ? '#555' : GW; g.lineWidth = Math.max(1, 0.55 * s);
        [0.9, 1.9, 2.9].forEach(function (r) {
          g.beginPath(); g.ellipse(X(31.4), Y(gy + 3.1), Math.max(0.5, r * 0.45 * s), Math.max(0.5, r * s), 0, 0, Math.PI * 2); g.stroke();
        });
        if (!dead) El(33, gy + 3.1, 3, 4.8, hexA(GW, 0.2));
      } else if (wpn === 'launcher') {
        /* a missile pod on the shoulder: a white box, black mouths at the front
           with the warheads tipped in the army's colour, and a sighting arm */
        F([[-5, gy - 5], [23, gy - 9.6], [23, gy - 15.8], [-5, gy - 11.2]], WG.sh);
        F([[-4.4, gy - 5.6], [22.4, gy - 10], [22.4, gy - 15.2], [-4.4, gy - 10.6]], WG.md);
        F([[-4.4, gy - 10], [22.4, gy - 14.4], [22.4, gy - 15.2], [-4.4, gy - 10.6]], WG.lt);
        L([[-4, gy - 6.1], [22, gy - 10.5]], 0.6, WG.dk);
        L([[2, gy - 8.2], [18, gy - 10.9]], 0.6, FORCE);
        F([[22.4, gy - 9.6], [26, gy - 10.4], [26, gy - 16.4], [22.4, gy - 15.6]], BK.md);   // the front face
        [[23.6, -12], [25, -12.3], [23.6, -14.3], [25, -14.6]].forEach(function (m) {
          El(m[0], gy + m[1], 0.62, 0.8, BK.dk);
          El(m[0] + 0.3, gy + m[1], 0.38, 0.5, dead ? '#555' : GW);
        });
        L([[8, gy - 6], [8.5, gy - 2.5]], 1.5, BK.md);                                         // the grip
        L([[16, gy - 15], [18, gy - 18], [21, gy - 18]], 0.8, BK.md); El(21.4, gy - 18, 0.7, 0.8, GW);   // the sight arm
      } else if (wpn === 'orb') {
        El(grip[0] + 1.6, grip[1] - 1.8, 2, 2, WG.md);
        glow(grip[0] + 1.6, grip[1] - 1.8, 1.3);                      // a charge, held up to throw
      } else if (wpn === 'cutter') {
        // a mining cutter: a squat white housing, a black emitter ring, the cutting light
        stock(4, gy, 3);
        housing(4, 19, gy + 1.2, 5, gy + 0.6);
        L([[6, gy + 1.6], [17, gy + 1]], 0.6, FORCE);
        El(21, gy + 0.8, 1.9, 3.8, BK.md); El(21.4, gy + 0.8, 1.1, 2.6, dead ? '#555' : GW);
        if (!dead) El(23, gy + 0.8, 3, 2.6, hexA(GW, 0.35));
      } else if (/^flag/.test(wpn)) {
        var top = wpn === 'flaghuge' ? -50 : wpn === 'flagbig' ? -42 : -32;
        var fw = wpn === 'flaghuge' ? 18 : wpn === 'flagbig' ? 14 : 10, fh = wpn === 'flaghuge' ? 12 : wpn === 'flagbig' ? 9.5 : 7;
        L([[13.5, gy + 12], [14, gy + top]], 1, dead ? '#3a3027' : '#5a4632');
        var wv = step ? 1 : 0;
        F([[14, gy + top], [14 + fw * 0.5, gy + top + 1.4 + wv], [14 + fw, gy + top - 0.4], [14 + fw, gy + top + fh - 0.4], [14 + fw * 0.5, gy + top + fh + 1.4 + wv], [14, gy + top + fh]], FORCE);
        L([[14, gy + top + 0.4], [14 + fw * 0.5, gy + top + 1.8 + wv], [14 + fw, gy + top]], 0.6, FORCE_L);
        El(14, gy + top - 0.6, 0.9, 0.9, dead ? '#555' : '#d8c07a');
      } else if (wpn === 'shell') {
        L([[9, gy + 1], [19, gy - 1]], 3.4, dead ? '#5e5b54' : '#b08a3a'); El(19.5, gy - 1.1, 1.8, 1.7, dead ? '#555' : '#8a3a24');
      } else if (wpn === 'optics') {
        L([[hx + 3, hy - 1.5], [hx + 8, hy - 2]], 2.6, WG.md); L([[hx + 3, hy - 0.6], [hx + 8, hy - 1.1]], 0.8, BK.md); El(hx + 8.4, hy - 2, 1, 1.3, dead ? '#555' : GW);
      }

      // the near arm: shoulder to elbow, the forearm to the grip, three hooked fingers
      var nearT = armoured ? AR : SK;
      var nearEl = [shx + 2, shy + 9];
      limb([[shx, shy], nearEl, grip], 2.6, 1.6, nearT);
      if (armoured) {                                    // a white shoulder plate, edged in the army's colour
        plate(shx, shy - 0.5, 3.6, 2.8, -0.3, WH);
        L([[shx - 3.2, shy + 1], [shx + 3.2, shy - 0.6]], 0.8, FORCE);
      } else if (!kit.mark) {                            // a rag of the army's colour round the upper arm
        L([[shx + 0.2, shy + 3.6], [shx + 2.6, shy + 3.2]], 2.2, FORCE);
        L([[shx + 1.4, shy + 3.8], [shx + 0.6, shy + 6.2]], 0.8, FORCE);
      }
      [[1.4, 1.6], [0.2, 2], [-0.9, 1.5]].forEach(function (f) {
        L([[grip[0], grip[1]], [grip[0] + f[0], grip[1] + f[1]]], 0.6, nearT.dk);
      });
      El(grip[0], grip[1], 1.2, 1, nearT.dk);

      g.restore();
    }

    return { paintPrawn: paintPrawn, prawnMuzzle: prawnMuzzle };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCIsoPrawnFig;
})(typeof window !== 'undefined' ? window : global);
