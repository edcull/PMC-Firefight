/* PMC 2670 — Firefight : the walkers: bipedal mechs

   Made by iso-machines.js for each machine it draws: drawMachineBody hands
   over what it has worked out for that machine (M) and the drawing kit its
   pieces share, and gets back the drawing functions below. */
(function (root) {
  'use strict';
  root.PMCIsoMechs = function (P) {
    var ARM_FOR = P.ARM_FOR, HULL = P.HULL, K = P.K, SHOULDER_STYLE = P.SHOULDER_STYLE, edge = P.edge,
        poly = P.poly, project = P.project;
    return function (M) {
      var AIM = M.AIM, GLASS = M.GLASS, GLINT = M.GLINT, S3 = M.S3, STEEL = M.STEEL, STEEL_LIT = M.STEEL_LIT,
          TB = M.TB, TS = M.TS, TT = M.TT, aerial = M.aerial, barrel = M.barrel, box = M.box, cos = M.cos,
          crossOn = M.crossOn, dead = M.dead, drawDamage = M.drawDamage, droneLamp = M.droneLamp, f = M.f,
          frameAt = M.frameAt, g = M.g, ground = M.ground, hexPanel = M.hexPanel, launcher = M.launcher,
          lift = M.lift, line = M.line, opts = M.opts, rectPts = M.rectPts, sEllipse = M.sEllipse,
          shape = M.shape, sin = M.sin, slabF = M.slabF, spec = M.spec, u = M.u, vents = M.vents;
      /* ================= bipedal walkers ================= */
      /* A walker is not a tank on legs: it is an upright machine that stands on two
         of them, with the crew in a cockpit head and the guns on its shoulders. */
      /* Walkers come in three weights, read off the size of the hull they
         replace: a light one is a slim humanoid, a wedge of chest over long thin
         legs with a finned head and a small gun on each forearm; a medium one is
         a rounded egg of a body with the cockpit glazed into its chest, heat
         sinks on its back and gun pods on its forearms; a heavy one is a hunched
         battle mech, a huge chest with its head sunk into it, missile boxes on
         its shoulders and blocky arms hanging low. */
      /* A walker is drawn a size down from the hull it stands in for: on legs
         the same footprint towered over everything near it. */
      var MS = null;
      function msInit() {
        var MECH = 0.8;
        MS = { len: spec.len * MECH, wid: spec.wid * MECH, hgt: spec.hgt * MECH, gun: (spec.gun || spec.fixedGun || spec.len * 0.9) * MECH };
      }
      function mechClass() {
        var base = HULL[u.art] || HULL.wheeled;
        // light tanks and cars under 2.3", the big future hulls from 2.55" — or whatever the hull says it is
        if (base.mech) return base.mech;
        return base.len < 2.3 ? 'light' : base.len >= 2.55 ? 'heavy' : 'medium';
      }
      /* legH: ground to hip; torsoH: hip to the top of the body; headH: what
         stands on top of that (a light mech's head and fin, a medium's crest
         and heat sinks, a heavy's missile boxes). headroom() repeats these. */
      function mechHeights() {
        if (!MS) msInit();
        var sf = MS.len / 2.0, cls = mechClass();
        if (cls === 'light') {
          return { legH: Math.round(30 * sf + MS.hgt * 0.4), torsoH: Math.round(13 * sf + MS.hgt * 0.3), headH: Math.round(12 * sf), sf: sf, cls: cls };
        }
        if (cls === 'heavy') {
          return { legH: Math.round(28 * sf + MS.hgt * 0.45), torsoH: Math.round(30 * sf + MS.hgt * 0.55), headH: Math.round(9 * sf), sf: sf, cls: cls };
        }
        return { legH: Math.round(26 * sf + MS.hgt * 0.45), torsoH: Math.round(26 * sf + MS.hgt * 0.5), headH: Math.round(7 * sf), sf: sf, cls: 'medium' };
      }

      /* What a walker carries is what the hull it stands in for carries: a tank's
         gun on the arm, an AA hull's twin cannon, a support hull's rockets on
         the shoulders, a plasma cannon, a flame projector; an ambulance carries
         nothing but its cross. */
      /* An arm carries what the unit's weapon table says it fires, so the barrel
         a shot comes out of is the barrel that looks like it fires it: the rail
         gun's thin blue line off the rail barrel, shells off the cannon. Each of
         these registers the muzzle mount that its style asks for. */
      function mechKit() {
        var st = spec.style, k = { main: 'cannon', off: 'mg', shoulder: null };
        /* What it actually carries comes first; the hull's own style only decides
           what hangs off the shoulders. */
        var spec2 = root.PMC && root.PMC.weaponSpec ? root.PMC.weaponSpec(u) : null;
        if (spec2 && ARM_FOR[spec2.p]) {
          /* Rockets lobbed in salvoes are a battery, not something a machine
             holds: they ride on the shoulder, where the hull carries its rack,
             and the arm takes whatever else it has. */
          var shoulderGun = SHOULDER_STYLE[spec2.p] || null;
          k.main = shoulderGun
            ? (spec2.s && ARM_FOR[spec2.s] !== 'rocket' ? ARM_FOR[spec2.s] : 'cannon')
            : ARM_FOR[spec2.p];
          k.off = spec2.s ? (ARM_FOR[spec2.s] || 'mg') : (k.main === 'mg' ? 'none' : 'mg');
          if (shoulderGun) { k.shoulder = shoulderGun; return k; }
          if (st) {
            k.shoulder = st.tMissiles || st.turret === 'mbt' || st.turret === 'future' ? 'missile'
              : st.mrl || st.mlrs || st.turret === 'calliope' ? 'rocket'
                : st.dish || st.turret === 'dish' ? 'dish'
                  : st.turret === 'flamer' ? 'tanks'
                    : st.turret === 'recon' || st.cross ? 'aerials' : null;
          } else if (spec.dish) k.shoulder = 'dish';
          // a launcher on both an arm and the shoulder is one launcher too many
          if (k.shoulder === k.off || k.shoulder === k.main) k.shoulder = null;
          return k;
        }
        if (!st) {
          k.main = spec.twin ? 'twinauto' : spec.fat ? 'howitzer' : spec.elev ? 'rocket' : 'cannon';
          k.off = spec.drum ? 'flame' : 'missile';
          if (spec.dish) k.shoulder = 'dish';
          return k;
        }
        if (st.plasma) { var pk = { main: 'plasma', off: st.turret === 'future' ? 'rail' : st.tMissiles ? 'missile' : 'mg', shoulder: st.turret === 'future' || st.tMissiles ? 'missile' : null }; return pk; }
        switch (st.turret) {
          case 'light': k.main = st.gunLen >= 2 ? 'long' : 'cannon'; if (st.tMissiles) k.off = 'missile'; break;
          case 'howitzer': k.main = 'howitzer'; break;
          case 'recon': k.main = 'auto'; k.shoulder = 'aerials'; break;
          case 'mbt': k.main = st.gunLen >= 2.4 ? 'long' : 'cannon'; k.shoulder = 'missile'; if (st.tMissiles) k.off = 'missile'; break;
          case 'future': k.main = 'long'; k.off = 'rail'; k.shoulder = 'missile'; break;
          case 'plasma': k.main = 'plasma'; break;
          case 'flamer': k.main = 'flame'; k.shoulder = 'tanks'; break;
          case 'ifv': k.main = 'auto'; k.off = 'missile'; break;
          case 'aa': k.main = 'twinauto'; k.off = 'twinauto'; k.shoulder = st.noMissiles ? 'dish' : 'missile'; break;
          case 'dish': k.main = 'mg'; k.off = 'none'; k.shoulder = 'dish'; break;
          case 'calliope': k.main = 'cannon'; k.shoulder = 'rocket'; break;
          case 'arty': k.main = 'howitzer'; break;
          case 'mg': k.main = 'mg'; break;
          case 'missile': k.main = 'missile'; break;
          default:
            if (st.casemate) { k.main = st.casemate.w > 4 ? 'howitzer' : 'long'; k.off = st.casemate.missiles ? 'missile' : 'mg'; }
            else if (st.mrl || st.mlrs) { k.main = 'rocket'; k.shoulder = 'rocket'; }
            else if (st.bedGun) { k.main = st.bedGun === 'auto' ? 'auto' : 'mg'; k.off = st.bedRack ? 'rocket' : 'mg'; }
            else if (st.cross) { k.main = 'none'; k.off = 'none'; k.shoulder = 'aerials'; }
            else if (st.pintle || st.rws) { k.main = 'mg'; k.off = 'none'; if (st.aerials) k.shoulder = 'aerials'; }
            else { k.main = 'none'; k.off = 'none'; }
        }
        return k;
      }
      // one weapon, laid along a frame from a0 at height z, reaching `reach`
      function armWeapon(type, fr, a0, b, z, reach, sc, across) {
        var wd = across || 0.1;
        switch (type) {
          case 'cannon': return barrel(fr, a0, reach, b, z, 2.6 * sc, 'gun', { brake: true, fume: 0.5 });
          case 'long': return barrel(fr, a0, reach * 1.2, b, z, 2.3 * sc, 'gun', { brake: true, fume: 0.45 });
          // a combat walker's main gun: a heavy cannon held level, long and thick, braked at the muzzle
          case 'bigcannon': return barrel(fr, a0, reach * 1.15, b, z, 3.4 * sc, 'gun', { brake: true, fume: 0.55 });
          case 'howitzer': return barrel(fr, a0, reach * 0.8, b, z, 4.6 * sc, 'gun', { brake: true, up: 3 });
          case 'plasma': {
            var pw = 4 * sc, tip = barrel(fr, a0, reach * 0.95, b, z, pw, 'gun', { col: '#1c2129' });
            vents(fr, a0, reach * 0.95, b, z, pw, 3);
            if (!dead) sEllipse(tip[0], tip[1], pw * 0.4, pw * 0.36, 'rgba(180,245,255,.95)');
            return tip;
          }
          case 'flame': {
            var ft = barrel(fr, a0, reach * 0.55, b, z, 3.8 * sc, 'flame', { col: '#3a3f38', lit: '#5c6458' });
            if (!dead) { sEllipse(ft[0], ft[1], 1.5 * sc, 1.3 * sc, '#e08a3a'); sEllipse(ft[0], ft[1], 0.8, 0.7, '#ffd070'); }
            return ft;
          }
          case 'auto': return barrel(fr, a0, reach * 0.95, b, z, 1.5 * sc, 'auto', { brake: true });
          case 'twinauto':
            barrel(fr, a0, reach * 0.9, b - wd * 0.5, z, 1.3 * sc, 'auto', { brake: true });
            return barrel(fr, a0, reach * 0.9, b + wd * 0.5, z, 1.3 * sc, 'auto', { brake: true });
          case 'rail': {
            // a Gauss weapon: a heavy barrel with the charge burning blue along it
            var rw = 2.4 * sc, rt = barrel(fr, a0, reach, b, z, rw, 'rail', { col: '#141b22', lit: '#2a313b' });
            vents(fr, a0, reach, b, z, rw, 3);
            if (!dead) sEllipse(rt[0], rt[1], rw * 0.42, rw * 0.38, 'rgba(190,245,255,.95)');
            return rt;
          }
          case 'mg': return barrel(fr, a0, a0 + (reach - a0) * 0.55, b, z, 1.3 * sc, 'mg', { col: '#15181e', brake: true });
          case 'missile':
            return launcher(fr, a0 - 0.1, a0 + 0.22, b - wd, b + wd, z - 2, 6 * sc, 2, 3, 'missile', { warheads: '#6a5a3a' });
          case 'rocket':
            return launcher(fr, a0 - 0.12, a0 + 0.22, b - wd * 1.2, b + wd * 1.2, z - 2, 7 * sc, 3, 3, 'rocket', { tone: TT, warheads: '#8a3a24', up: 2 });
          default: {
            // no weapon: a manipulator — a clamp at the end of the arm
            slabF(fr, a0, a0 + 0.1, b - wd * 0.6, b + wd * 0.6, z - 2, 4 * sc, TS);
            return null;
          }
        }
      }

      function drawMech() {
        var hm = mechHeights(), cls = hm.cls, KITM = mechKit(), sf = hm.sf;
        var heavy = cls === 'heavy', light = cls === 'light';
        // a heavy walker built on an advanced-protection hull wears its hex armour
        var hexMech = heavy && !!(spec.style && (spec.style.body === 'future' || spec.style.hexNose));
        var hipY = lift + hm.legH;                       // where the legs meet the body
        var shoulder = hipY + hm.torsoH;                 // the top of the torso
        var waistY = hipY + Math.round(3 * sf);          // where the chest starts
        // the torso's half-depth and half-width
        var tL = MS.len * (heavy ? 0.22 : light ? 0.13 : 0.2);
        var tW = MS.wid * (heavy ? 0.42 : light ? 0.26 : 0.42);
        var TF = frameAt(0, 0, AIM);                     // the body turns to its target
        var ca = Math.cos(AIM), sa = Math.sin(AIM);
        var fwd = ca + sa;                               // > 0: the chest is toward the viewer
        function nearOf(s) { return s * (ca - sa); }     // > 0: that side is toward the viewer
        var RED = dead ? '#3a2e22' : '#c8322a';          // missile tips

        // the shadow the machine casts is its feet, not a hull-sized slab
        var fpr = project(box(0, 0, MS.len * (heavy ? 0.66 : light ? 0.42 : 0.56), MS.wid * (heavy ? 0.9 : light ? 0.5 : 0.75)), ground);
        poly(g, fpr, 'rgba(14,11,8,.34)');

        /* Legs stride: one forward, one back, so the pair reads in three quarters.
           On the move the two swap over frame by frame, which is what makes a
           walker walk rather than slide. */
        var swing = opts.walk ? (opts.walk % 2 ? 1 : -1) : 1;
        var legs2 = [{ fore: swing, s: 1 }, { fore: -swing, s: -1 }];
        var legSpread = tW * (heavy ? 0.6 : light ? 0.7 : 0.58);
        legs2.forEach(function (L) {
          L.d = L.fore * MS.len * 0.1 * (cos + sin) + L.s * legSpread * (cos - sin);
        });
        legs2.sort(function (p, q) { return p.d - q.d; });
        /* The arms hang outside the body, so the side an arm is on says whether
           the torso hides it; square to the viewer, the forearms held out in
           front (or behind) decide. The far arm goes down before the legs, as it
           is further out than they are. */
        var armsBack = [], armsFront = [];
        [-1, 1].forEach(function (s) { (nearOf(s) + 0.3 * fwd > 0 ? armsFront : armsBack).push(s); });
        var byNear = function (p, q) { return nearOf(p) - nearOf(q); };
        armsBack.sort(byNear); armsFront.sort(byNear);

        armsBack.forEach(drawArm);
        drawLeg(legs2[0]);
        drawLeg(legs2[1]);
        if (KITM.shoulder === 'tanks' && fwd > 0) backTanks();   // behind the chest
        drawTorso();
        armsFront.forEach(drawArm);
        drawTop();
        drawDamage();

        // a sensor light or a hot muzzle: a small orange dot, out when dead
        function glow(p, r) {
          if (dead || !p || typeof p[0] !== 'number') return;
          sEllipse(p[0], p[1], r * 2, r * 1.7, 'rgba(255,138,42,.28)');
          sEllipse(p[0], p[1], r, r * 0.85, '#ff8a2a');
          sEllipse(p[0] - r * 0.2, p[1] - r * 0.2, r * 0.45, r * 0.4, '#ffd68a');
        }
        /* Cockpit glass and sensor lenses: a glassy blue, bright at the top where
           it catches the sky and deep below, with a glint along its upper edge. */
        function glass(pts, glint) {
          // a drone walker has nobody to see out: no cockpit glass at all
          if (u.drone) return;
          var ys = pts.map(function (q) { return q[1]; });
          var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
          var gl;
          if (dead) gl = GLASS;
          else {
            gl = g.createLinearGradient(0, y0, 0, y1 + 0.01);
            gl.addColorStop(0, '#c8f2ff'); gl.addColorStop(0.35, '#5cc0ec'); gl.addColorStop(0.75, '#1f6ea8'); gl.addColorStop(1, '#0f3456');
          }
          poly(g, pts, gl);
          if (glint) edge(g, glint[0], glint[1], dead ? GLINT : 'rgba(235,250,255,.9)', 0.8);
        }
        // a round lens of the same glass, with a highlight
        function lens(p, r) {
          if (!p || typeof p[0] !== 'number') return;
          sEllipse(p[0], p[1], r * 1.25, r * 1.1, '#0b0e12');
          if (dead) { sEllipse(p[0], p[1], r, r * 0.85, GLASS); return; }
          sEllipse(p[0], p[1], r * 2, r * 1.7, 'rgba(92,192,236,.22)');
          sEllipse(p[0], p[1], r, r * 0.85, '#2b86c4');
          sEllipse(p[0] + r * 0.1, p[1] + r * 0.15, r * 0.6, r * 0.5, '#1a5a8c');
          sEllipse(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.4, r * 0.34, '#d6f6ff');
        }
        // an outline with its corners cut: a plate that reads as rounded
        function oct(a0, a1, b0, b1, k) {
          var da = (a1 - a0) * (k || 0.3), db = (b1 - b0) * (k || 0.3);
          return [[a1, b0 + db], [a1, b1 - db], [a1 - da, b1], [a0 + da, b1], [a0, b1 - db], [a0, b0 + db], [a0 + da, b0], [a1 - da, b0]];
        }
        // a point on a front face raked back from a1 (at z0) to a1 - rake (at z0 + h)
        function onFront(a1, rake, z0, h, k, b) { return S3(TF(a1 - rake * k + 0.006, b), z0 + h * k); }

        /* ---- legs ---- */
        /* Hip, a knee bent a little forward, an ankle, a foot. A heavy leg is
           all armour, with a knee plate like a shield; a medium one is rounded
           plates over a clawed foot; a light one is thin, on a narrow foot. */
        function drawLeg(L) {
          var s = L.s * legSpread, fo = L.fore;
          var LF = frameAt(0, 0, f);                     // legs step the way the hull faces
          var front = cos + sin > 0;
          var hipT = fo * MS.len * 0.05;
          var kneeT = fo * MS.len * 0.1 + MS.len * 0.04;
          var ankT = fo * MS.len * 0.09;
          var kneeY = lift + Math.round(hm.legH * 0.5), ankY = lift + Math.round((heavy ? 5 : 4) * sf);
          var P = heavy ? { th: 0.1, tw: 0.13, sh: 0.1, sw: 0.13, fl: 0.15, fw: 0.15 }
            : light ? { th: 0.045, tw: 0.055, sh: 0.058, sw: 0.068, fl: 0.14, fw: 0.08 }
              : { th: 0.085, tw: 0.11, sh: 0.075, sw: 0.1, fl: 0.13, fw: 0.12 };
          var th = MS.len * P.th, tw = MS.wid * P.tw, sh = MS.len * P.sh, sw = MS.wid * P.sw;
          var fl = MS.len * P.fl, fw = MS.wid * P.fw;
          function J(t, z) { return S3(LF(t, s), z); }
          function outline(t, l, w) { return heavy || light ? rectPts(t - l, t + l, s - w, s + w) : oct(t - l, t + l, s - w, s + w, 0.3); }
          function foot() {
            if (light) {
              // a narrow foot, pointed at the toe
              shape(LF, [[ankT + fl, s], [ankT + fl * 0.45, s + fw], [ankT - fl * 0.6, s + fw], [ankT - fl * 0.6, s - fw], [ankT + fl * 0.45, s - fw]],
                lift, Math.round(4 * sf), TS, 0.75);
              return;
            }
            var toes = function () {
              if (heavy) {
                // two blocky toe plates
                [-0.5, 0.5].forEach(function (k) {
                  slabF(LF, ankT + fl * 0.3, ankT + fl * 1.05, s + k * fw - fw * 0.47, s + k * fw + fw * 0.47, lift, Math.round(4 * sf), TB, fl * 0.3, 0, fw * 0.05);
                });
              } else {
                // three claws forward, splayed a little
                [-0.7, 0, 0.7].forEach(function (k) {
                  var c0 = s + k * fw, c1 = s + k * fw * 1.35;
                  shape(LF, [[ankT + fl * 1.2, c1 - fw * 0.1], [ankT + fl * 1.2, c1 + fw * 0.1], [ankT + fl * 0.3, c0 + fw * 0.22], [ankT + fl * 0.3, c0 - fw * 0.22]],
                    lift, Math.round(3 * sf), TS, null, [[ankT + fl * 0.6, c1 - fw * 0.08], [ankT + fl * 0.6, c1 + fw * 0.08], [ankT + fl * 0.3, c0 + fw * 0.16], [ankT + fl * 0.3, c0 - fw * 0.16]]);
                });
              }
            };
            var heel = function () {
              if (!heavy) shape(LF, rectPts(ankT - fl * 1.0, ankT - fl * 0.4, s - fw * 0.18, s + fw * 0.18), lift, Math.round(3 * sf), TS, null,
                rectPts(ankT - fl * 0.6, ankT - fl * 0.4, s - fw * 0.14, s + fw * 0.14));
            };
            if (front) heel(); else toes();
            slabF(LF, ankT - fl * 0.6, ankT + fl * 0.55, s - fw, s + fw, lift, Math.round((heavy ? 6 : 4) * sf), heavy ? TS : TB, fl * 0.2, fl * 0.15, fw * 0.08);
            if (front) toes(); else heel();
          }
          function shin() {
            // a calf thicker below the knee than at the ankle
            shape(LF, outline(ankT, sh * 0.8, sw * 0.8), ankY, kneeY - ankY - 1, TB, null, outline(kneeT, sh, sw));
          }
          function thigh() {
            var hp = J(hipT, hipY - 1);
            sEllipse(hp[0], hp[1], tw * K * 0.9, tw * K * 0.7, STEEL);
            shape(LF, outline(kneeT, th * 0.85, tw * 0.85), kneeY + 1, hipY - kneeY - 3, heavy || light ? TS : TB, null, outline(hipT, th, tw));
          }
          function knee() {
            var kp = J(kneeT, kneeY);
            sEllipse(kp[0], kp[1], sw * K * 0.8, sw * K * 0.6, STEEL);
            if (light) { sEllipse(kp[0] - 0.4, kp[1] - 0.4, sw * K * 0.45, sw * K * 0.35, STEEL_LIT); return; }
            // an armour plate over the knee, raked back at the top
            var k0 = kneeT + sh * 0.6, kl = heavy ? sh * 1.1 : sh * 0.7;
            slabF(LF, k0, k0 + kl, s - sw * (heavy ? 1.08 : 0.8), s + sw * (heavy ? 1.08 : 0.8), kneeY - Math.round((heavy ? 5 : 4) * sf),
              Math.round((heavy ? 11 : 8) * sf), heavy ? TB : TT, kl * 0.5, 0, sw * 0.12);
          }
          foot();
          if (!front) knee();
          shin();
          if (front) { var kj = J(kneeT, kneeY); sEllipse(kj[0], kj[1], sw * K * 0.8, sw * K * 0.6, STEEL); }
          thigh();
          if (front) knee();
        }

        /* ---- the body ---- */
        function drawTorso() {
          if (heavy) heavyTorso(); else if (light) lightTorso(); else mediumTorso();
        }
        /* A heavy mech's chest is a huge armoured box, its front raked back,
           over a waist that tapers into a skirt of plates about the hips. The
           head is sunk in it: all that shows is a visor slot high on the front. */
        function heavyTorso() {
          slabF(TF, -tL * 0.45, tL * 0.45, -tW * 0.45, tW * 0.45, hipY - 4, Math.round(7 * sf), TS);
          var skZ = hipY - Math.round(6 * sf), skH = waistY - skZ;
          var skB = [-tL * 0.62, tL * 0.68, tW * 0.66], skT = [-tL * 0.5, tL * 0.52, tW * 0.52];
          shape(TF, rectPts(skB[0], skB[1], -skB[2], skB[2]), skZ, skH, TB, null, rectPts(skT[0], skT[1], -skT[2], skT[2]));
          // the seams between the skirt plates, on the faces the viewer sees
          var seam = function (p0, p1) { line(p0, p1, 0.8, 'rgba(8,10,14,.55)'); };
          [-0.34, 0.34].forEach(function (k) {
            if (fwd > 0) seam(S3(TF(skB[1], k * skB[2]), skZ), S3(TF(skT[1], k * skT[2]), skZ + skH));
            if (fwd < 0) seam(S3(TF(skB[0], k * skB[2]), skZ), S3(TF(skT[0], k * skT[2]), skZ + skH));
            [-1, 1].forEach(function (s) {
              if (nearOf(s) <= 0) return;
              var ka = (k + 1) / 2;
              seam(S3(TF(skB[0] + (skB[1] - skB[0]) * ka, s * skB[2]), skZ), S3(TF(skT[0] + (skT[1] - skT[0]) * ka, s * skT[2]), skZ + skH));
            });
          });
          var chestH = shoulder - waistY, lowH = Math.round(chestH * 0.34), zU = waistY + lowH, upH = chestH - lowH;
          // exhaust stacks up the back of the chest, behind it when it faces the viewer
          var stacks = function () {
            [-1, 1].forEach(function (s) {
              var e0 = S3(TF(-tL * 1.02, s * tW * 0.62), zU + upH * 0.65), e1 = S3(TF(-tL * 1.02, s * tW * 0.62), shoulder + 4);
              line(e0, e1, Math.max(2.2, 3.2 * sf), STEEL);
              line([e0[0] - sf, e0[1]], [e1[0] - sf, e1[1]], 1.2, STEEL_LIT);
              sEllipse(e1[0], e1[1], 2 * sf, 1.2 * sf, '#0c0f13');
            });
          };
          if (fwd > 0) stacks();
          // the waist flaring out into the chest
          shape(TF, rectPts(-tL * 0.5, tL * 0.5, -tW * 0.5, tW * 0.5), waistY, lowH, TT, null, rectPts(-tL * 0.95, tL * 0.9, -tW, tW), true);
          // the chest itself, hunched forward, its front plate raked back
          shape(TF, rectPts(-tL * 0.95, tL * 0.9, -tW, tW), zU, upH, TB, null,
            rectPts(-tL * 0.82, tL * 0.56, -tW * 0.94, tW * 0.94));
          // five hex tiles across the back of the chest, three over two, when the back is towards the eye
          if (hexMech && fwd < -0.05) hexPanel(TF, [-tL * 0.95, tW * 0.8], [-tL * 0.95, -tW * 0.8], [-tL * 0.82, tW * 0.75], [-tL * 0.82, -tW * 0.75], zU, upH, [3, 2]);
          /* the cockpit: an angular armoured wedge standing out of the chest —
             a raked front facet, its corners cut back into angled cheeks, the
             top drawn in narrower — glazed in a T: a wide pane across the front
             facet with a narrow one under its middle, and a pane on each cheek */
          if (fwd > -0.1) {
            var ca0 = tL * 0.45, ca1 = tL * 1.1, cb = tW * 0.46, cz = zU + Math.round(upH * 0.32), ch = Math.round(upH * 0.52);
            var rk = tL * 0.22, ck = tL * 0.16;                 // the rake of the front, the depth of the cheeks
            var lo = [[ca0, -cb], [ca1 - ck, -cb], [ca1, -cb * 0.38], [ca1, cb * 0.38], [ca1 - ck, cb], [ca0, cb]];
            var hi = [[ca0, -cb * 0.8], [ca1 - rk - ck * 0.8, -cb * 0.8], [ca1 - rk, -cb * 0.32], [ca1 - rk, cb * 0.32], [ca1 - rk - ck * 0.8, cb * 0.8], [ca0, cb * 0.8]];
            shape(TF, lo, cz, ch, TB, null, hi);
            // a point on the front facet: k up it, u across it (-1 to 1)
            var ff = function (k, u) { return S3(TF(ca1 - rk * k + 0.006, u * cb * (0.38 - 0.06 * k)), cz + ch * k); };
            var pane = function (P, k0, k1, u0, u1, fr) {
              if (u.drone) return;                          // no panes, nor their dark frames
              var q = [P(k0, u0), P(k0, u1), P(k1, u1), P(k1, u0)];
              poly(g, [P(k0 - fr, u0 - fr * 1.6), P(k0 - fr, u1 + fr * 1.6), P(k1 + fr, u1 + fr * 1.6), P(k1 + fr, u0 - fr * 1.6)], '#0b0e12');
              glass(q, [q[3], q[2]]);
            };
            pane(ff, 0.48, 0.9, -0.84, 0.84, 0.05);
            pane(ff, 0.1, 0.4, -0.34, 0.34, 0.05);
            // a cheek on side s: v from its outer edge (0) to where it meets the front (1)
            [-1, 1].forEach(function (s) {
              if (fwd * 0.8 + nearOf(s) * 0.6 <= 0.05) return;
              var cf2 = function (k, v) {
                var a = (ca1 - ck) + ck * v - (rk + ck * 0.8 * (1 - v)) * k * (1 - v) - rk * k * v;
                var b = s * cb * ((1 - v) + 0.38 * v) * (1 - k * 0.2);
                return S3(TF(a + 0.006, b), cz + ch * k);
              };
              pane(cf2, 0.48, 0.88, 0.16, 0.84, 0.05);
            });
          }
          if (fwd <= 0) stacks();
        }
        /* A medium mech is one rounded body, narrow at the waist, widest at the
           chest, domed over the top, with its cockpit glazed into the front and
           heat sinks standing up behind. */
        function mediumTorso() {
          shape(TF, oct(-tL * 0.5, tL * 0.5, -tW * 0.45, tW * 0.45, 0.25), hipY - 4, Math.round(6 * sf), TS);
          var H = shoulder - waistY, h1 = Math.round(H * 0.32), h2 = Math.round(H * 0.36), h3 = H - h1 - h2;
          var R0 = oct(-tL * 0.7, tL * 0.7, -tW * 0.66, tW * 0.66), R1 = oct(-tL, tL, -tW, tW), R2 = oct(-tL * 0.62, tL * 0.58, -tW * 0.62, tW * 0.62);
          if (fwd > 0) vents();
          shape(TF, R0, waistY, h1, TB, null, R1, true);
          shape(TF, R1, waistY + h1, h2, TB, null, null, true);
          shape(TF, R1, waistY + h1 + h2, h3, TB, null, R2);
          // the canopy, over the front plate and up onto the dome
          if (fwd > 0.05 && !u.drone) {
            var z1 = waistY + h1 + h2, z0 = waistY + h1 + Math.round(h2 * 0.45), kT = 0.6;
            var aT = tL - tL * 0.42 * kT, bT = tW * (0.32 - 0.12 * kT);
            var cp = [S3(TF(tL + 0.006, -tW * 0.26), z0), S3(TF(tL + 0.006, tW * 0.26), z0), S3(TF(tL + 0.006, tW * 0.32), z1),
              S3(TF(aT + 0.006, bT), z1 + h3 * kT), S3(TF(aT + 0.006, -bT), z1 + h3 * kT), S3(TF(tL + 0.006, -tW * 0.32), z1)];
            glass(cp, [cp[4], cp[3]]);
            edge(g, cp[0], cp[1], 'rgba(8,10,14,.6)', 0.8);
          }
          if (fwd <= 0) vents();
        }
        // box heat sinks standing up off the back and the tops of the shoulders
        function vents() {
          var H = shoulder - waistY, zV = shoulder - Math.round(H * 0.35), hV = Math.round(H * 0.35 + 6 * sf);
          var V = [[-tL * 0.8, -tW * 0.5], [-tL * 0.8, tW * 0.5], [-tL * 1.02, 0]];
          V.sort(function (p, q) { var P1 = TF(p[0], p[1]), Q1 = TF(q[0], q[1]); return (P1.x + P1.y) - (Q1.x + Q1.y); });
          V.forEach(function (v, i) {
            var hh = v[1] === 0 ? hV - 2 : hV;
            slabF(TF, v[0] - tL * 0.13, v[0] + tL * 0.13, v[1] - tW * 0.12, v[1] + tW * 0.12, zV, hh, TT);
            var vt = S3(TF(v[0], v[1]), zV + hh);
            line([vt[0] - 2 * sf, vt[1]], [vt[0] + 2 * sf, vt[1]], 1, 'rgba(8,10,14,.6)');
          });
        }
        /* A light mech is a compact wedge of chest, broad at the shoulders,
           with an accent plate across its front, over a thin waist. */
        function lightTorso() {
          slabF(TF, -tL * 0.55, tL * 0.55, -tW * 0.55, tW * 0.55, hipY - 3, Math.round(5 * sf), TS, tL * 0.1, tL * 0.1, tW * 0.05);
          var wp = S3(TF(0, 0), hipY + 1), wq = S3(TF(0, 0), waistY + 2);
          line(wp, wq, Math.max(2.5, 4 * sf), STEEL);
          var cH = shoulder - waistY;
          shape(TF, rectPts(-tL * 0.7, tL * 0.5, -tW * 0.55, tW * 0.55), waistY, cH, TB, null, rectPts(-tL, tL * 1.05, -tW, tW));
          if (fwd > -0.1) {
            var k0 = 0.3, k1 = 0.95, fa = function (k) { return tL * 0.5 + tL * 0.55 * k + 0.01; }, fb = function (k) { return tW * (0.55 + 0.45 * k); };
            poly(g, [S3(TF(fa(k0), -fb(k0) * 0.6), waistY + cH * k0), S3(TF(fa(k0), fb(k0) * 0.6), waistY + cH * k0),
              S3(TF(fa(k1), fb(k1) * 0.72), waistY + cH * k1), S3(TF(fa(k1), -fb(k1) * 0.72), waistY + cH * k1)], TT.mid);
            edge(g, S3(TF(fa(k1), fb(k1) * 0.72), waistY + cH * k1), S3(TF(fa(k1), -fb(k1) * 0.72), waistY + cH * k1), TT.lit, 0.8);
            /* a medical walker wears its red cross on the front of the chest, on the plate:
               a white square and the cross, laid on the plate as it leans out */
            if (spec.cross) {
              var CP = function (u2, k) { return S3(TF(fa(k) + 0.004, u2 * fb(k) * 0.5), waistY + cH * k); };
              var kc = (k0 + k1) / 2, kh = (k1 - k0) * 0.36;
              var sq = function (u0, u1, ka, kb) { return [CP(u0, ka), CP(u1, ka), CP(u1, kb), CP(u0, kb)]; };
              poly(g, sq(-0.72, 0.72, kc - kh, kc + kh), '#e8e3d8');
              poly(g, sq(-0.54, 0.54, kc - kh * 0.25, kc + kh * 0.25), '#c23a32');
              poly(g, sq(-0.18, 0.18, kc - kh * 0.75, kc + kh * 0.75), '#c23a32');
            }
          }
        }

        /* ---- arms ---- */
        /* The upper arm hangs from the shoulder, the forearm is held level at
           the target. A heavy arm is a big square pauldron over a blocky
           forearm ending in a cannon or a claw; a medium one a rounded shoulder
           over a banded gun pod, twin barrels on one side; a light one a thin
           arm with a small gun box. Main weapon right, second weapon left. */
        function drawArm(s) {
          var off = s * tW * (heavy ? 1.42 : light ? 1.2 : 1.14);   // a light arm hangs right off the shoulder
          var fz = shoulder - Math.round((heavy ? 25 : light ? 15 : 22) * sf);
          var fh = Math.round((heavy ? 10 : light ? 6 : 7) * sf);
          var fwid = tW * (heavy ? 0.32 : light ? 0.26 : 0.24);
          var fa0 = tL * (heavy ? 0.1 : light ? 0.2 : 0), fa1 = tL * (heavy ? 1.2 : light ? 1.6 : 1.05);
          var shZ = shoulder - Math.round((heavy ? 8 : light ? 4 : 7) * sf);
          var elb = [tL * (heavy ? 0.3 : 0.25), fz + fh - 1];
          var type = s > 0 ? KITM.main : KITM.off;
          var wz = fz + Math.round(fh * 0.5);
          var sh = KITM.shoulder, rack = (sh === 'missile' || sh === 'rocket') && !heavy && s < 0;
          function pauldron() {
            if (heavy) {
              // an accent rim, then the square pauldron over it
              var pz = shoulder - Math.round(14 * sf);
              slabF(TF, -tL * 0.66, tL * 0.62, off - tW * 0.42, off + tW * 0.42, pz - 2, 3, TS);
              slabF(TF, -tL * 0.64, tL * 0.6, off - tW * 0.4, off + tW * 0.4, pz, shoulder + 3 - pz, TT, tL * 0.18, tL * 0.18, tW * 0.12);
              /* the advanced protection hex armour: two tiles on the front, the outer
                 side and the rear of each shoulder, on whichever of them shows */
              if (hexMech) {
                var pa0 = -tL * 0.64, pa1 = tL * 0.6, pin = tL * 0.18, pb = tW * 0.4, ph = shoulder + 3 - pz;
                if (fwd > 0.05) hexPanel(TF, [pa1, off - pb], [pa1, off + pb], [pa1 - pin, off - pb * 0.7], [pa1 - pin, off + pb * 0.7], pz, ph, [2]);
                if (fwd < -0.05) hexPanel(TF, [pa0, off + pb], [pa0, off - pb], [pa0 + pin, off + pb * 0.7], [pa0 + pin, off - pb * 0.7], pz, ph, [2]);
                if (nearOf(s) > 0.05) hexPanel(TF, [pa0, off + s * pb], [pa1, off + s * pb], [pa0 + pin, off + s * pb * 0.7], [pa1 - pin, off + s * pb * 0.7], pz, ph, [2]);
              }
            } else if (light) {
              // a shoulder cap reaching in over the top of the chest, so the arm is plainly joined on
              slabF(TF, -tL * 0.55, tL * 0.55, off - tW * 0.34, off + tW * 0.3, shoulder - Math.round(6 * sf), Math.round(6 * sf), TB, tL * 0.15, tL * 0.1, tW * 0.05);
            } else {
              var mz = shoulder - Math.round(11 * sf);
              shape(TF, oct(-tL * 0.5, tL * 0.5, off - tW * 0.32, off + tW * 0.32, 0.3), mz, Math.round(9 * sf), TB, 0.6);
              if (rack) launcher(TF, -tL * 0.35, tL * 0.4, off - tW * 0.2, off + tW * 0.2, mz + Math.round(9 * sf) - 1, Math.round(6 * sf), 2, 2, sh,
                { tone: TT, warheads: RED, up: 1 });
            }
          }
          function upper() {
            if (heavy) {
              // a heavy arm's upper section is armoured too, from pauldron to elbow
              var uz = fz + fh - 2;
              slabF(TF, -tL * 0.28, tL * 0.24, off - tW * 0.26, off + tW * 0.26, uz, shoulder - Math.round(12 * sf) - uz + 3, TS, tL * 0.05, tL * 0.05, tW * 0.04);
              var ep = S3(TF(tL * 0.24, off), uz + 2);
              sEllipse(ep[0], ep[1], 3 * sf, 2.6 * sf, STEEL);
              return;
            }
            var p0 = S3(TF(0, off), shZ), p1 = S3(TF(elb[0], off), elb[1]);
            var w = Math.max(2, (light ? 3.6 : 5) * sf);
            line(p0, p1, w, STEEL);
            line([p0[0] - w * 0.2, p0[1]], [p1[0] - w * 0.2, p1[1]], Math.max(0.8, w * 0.2), STEEL_LIT);
            sEllipse(p1[0], p1[1], w * 0.62, w * 0.5, STEEL);
          }
          function forearm() {
            slabF(TF, fa0, fa1, off - fwid, off + fwid, fz, fh, TB, tL * 0.08, tL * 0.06, tW * 0.03);
            // accent bands round the forearm
            var bands = heavy ? [[0.78, 0.94]] : light ? [] : [[0.42, 0.56], [0.82, 0.96]];
            bands.forEach(function (bd) {
              slabF(TF, fa0 + (fa1 - fa0) * bd[0], fa0 + (fa1 - fa0) * bd[1], off - fwid * 1.08, off + fwid * 1.08, fz - 0.5, fh + 1, TT);
            });
          }
          function weapon() {
            var a0 = fa1 - tL * 0.05, reach = fa1 + MS.gun * (heavy ? 0.3 : light ? 0.2 : 0.28);
            var sc = sf * (heavy ? 1.6 : light ? 0.75 : 1.3);
            if (heavy && type === 'none') {
              // no gun on this arm: a clawed hand
              [-0.55, 0, 0.55].forEach(function (k) {
                var b = off + k * fwid;
                var c0 = S3(TF(fa1, b), fz + fh * 0.6), c1 = S3(TF(fa1 + tL * 0.3, b + k * fwid * 0.3), fz + fh * 0.3), c2 = S3(TF(fa1 + tL * 0.38, b), fz - 3 * sf);
                line(c0, c1, 2.2 * sf, STEEL); line(c1, c2, 1.8 * sf, STEEL);
                line([c0[0] - 0.5, c0[1] - 0.5], [c1[0] - 0.5, c1[1] - 0.5], 0.7, STEEL_LIT);
              });
              return;
            }
            if (!heavy && !light && s < 0 && (type === 'mg' || type === 'auto' || type === 'twinauto')) {
              // twin barrels, each with its muzzle glowing
              var kd = type === 'mg' ? 'mg' : 'auto';
              [-1, 1].forEach(function (k) {
                glow(barrel(TF, a0, reach * 0.92, off + k * fwid * 0.5, wz, 1.7 * sc, kd, { brake: true }), 0.9);
              });
              return;
            }
            var tip = armWeapon(type, TF, a0, off, wz, reach, sc, fwid * 0.9);
            if (!heavy && type !== 'plasma' && type !== 'flame') glow(tip, light ? 0.9 : 1);
          }
          if (fwd >= 0) { upper(); pauldron(); forearm(); weapon(); } else { weapon(); forearm(); upper(); pauldron(); }
        }

        /* ---- on top: a heavy's missile boxes, a medium's crest, a light's head ---- */
        /* The flame fuel slung on a walker's back: two tall bottles, the nearer
           drawn last. Facing the viewer they go down before the chest, which hides them. */
        function backTanks() {
          [-0.4, 0.4].sort(function (p, q) { return nearOf(p > 0 ? 1 : -1) * Math.abs(p) - nearOf(q > 0 ? 1 : -1) * Math.abs(q); }).forEach(function (b) {
            var t1 = S3(TF(-tL * 1.12, tW * b), shoulder - 16), t2 = S3(TF(-tL * 1.12, tW * b), shoulder);
            line(t1, t2, 8, '#3a3f38'); line([t1[0] - 2, t1[1]], [t2[0] - 2, t2[1]], 1.8, '#6a7064');
          });
        }
        function drawTop() {
          extras();
          // the dish on its back: behind the head facing us, over it facing away
          if (fwd >= 0) dishOn();
          /* A medium or heavy walker drone carries its sensor dome on its right
             shoulder pad and the aerial on its left (a light one's dome takes its
             head, below). */
          if (u.drone && !dead && !light) {
            var pad = tW * (heavy ? 1.42 : 1.14), pz = shoulder + (heavy ? 3 : 0);
            var dc2 = S3(TF(-tL * 0.1, pad), pz), dr6 = Math.max(4, 6 * sf);
            var kit = function () {
              sEllipse(dc2[0], dc2[1] + dr6 * 0.15, dr6 * 1.2, dr6 * 0.6, '#14171c');
              sEllipse(dc2[0], dc2[1] - dr6 * 0.35, dr6, dr6 * 0.85, '#aeb8c2');
              sEllipse(dc2[0], dc2[1] - dr6 * 0.05, dr6, dr6 * 0.42, '#7d8894');
              sEllipse(dc2[0] - dr6 * 0.35, dc2[1] - dr6 * 0.7, dr6 * 0.35, dr6 * 0.25, 'rgba(255,255,255,.75)');
              sEllipse(dc2[0] + dr6 * 0.2, dc2[1] - dr6 * 0.25, dr6 * 0.28, dr6 * 0.2, '#2a6f9a');
            };
            var mast = function () {
              var ab2 = S3(TF(-tL * 0.4, -pad), pz), at6 = S3(TF(-tL * 0.52, -pad), pz + Math.round(20 * sf));
              sEllipse(ab2[0], ab2[1], 2, 1.2, STEEL);
              line(ab2, at6, 1.4, STEEL_LIT);
              droneLamp(at6[0], at6[1]);
            };
            // the far one first, so the near one is drawn over it
            if (nearOf(1) > 0) { mast(); kit(); } else { kit(); mast(); }
          }
          if (heavy) {
            // a low cowl where the head is sunk into the chest
            slabF(TF, -tL * 0.1, tL * 0.46, -tW * 0.3, tW * 0.3, shoulder - 1, Math.round(3 * sf), TB, tL * 0.2, tL * 0.05, tW * 0.06);
            // a squat box on each front shoulder corner, its tubes facing forward
            var sh = KITM.shoulder, armed = sh === 'missile' || sh === 'rocket';
            var boxes = [-1, 1].sort(byNear);
            boxes.forEach(function (s) {
              var b0 = s * tW * 0.36, b1 = s * tW * 0.96, a0 = -tL * 0.3, a1 = tL * 0.58, bz = shoulder - 1, bh = Math.round(9 * sf);
              if (armed) launcher(TF, a0, a1, Math.min(b0, b1), Math.max(b0, b1), bz, bh, 2, 3, sh, { tone: TB, warheads: RED });
              else slabF(TF, a0, a1, Math.min(b0, b1), Math.max(b0, b1), bz, bh, TB, tL * 0.05, tL * 0.05, tW * 0.04);
            });
          } else if (light && u.drone && !dead) {
            /* A drone has no head to put a pilot in: the sensor dome sits on the
               chest where it was, and the aerial stands off the back shoulder. */
            // the dome on its right shoulder cap, the aerial on its left
            var dz = shoulder, dc = S3(TF(0, -tW * 1.12), dz), dr5 = Math.max(4, 5.5 * sf);
            sEllipse(dc[0], dc[1] + dr5 * 0.15, dr5 * 1.2, dr5 * 0.6, '#14171c');
            sEllipse(dc[0], dc[1] - dr5 * 0.35, dr5, dr5 * 0.85, '#aeb8c2');
            sEllipse(dc[0], dc[1] - dr5 * 0.05, dr5, dr5 * 0.42, '#7d8894');
            sEllipse(dc[0] - dr5 * 0.35, dc[1] - dr5 * 0.7, dr5 * 0.35, dr5 * 0.25, 'rgba(255,255,255,.75)');
            sEllipse(dc[0] + dr5 * 0.2, dc[1] - dr5 * 0.25, dr5 * 0.28, dr5 * 0.2, '#2a6f9a');
            var ab = S3(TF(-tL * 0.4, tW * 1.15), shoulder), at5 = S3(TF(-tL * 0.52, tW * 1.15), shoulder + Math.round(18 * sf));
            sEllipse(ab[0], ab[1], 2, 1.2, STEEL);                // its mount on the shoulder
            line(ab, at5, 1.4, STEEL_LIT);
            droneLamp(at5[0], at5[1]);
          } else if (light) {
            // the head sits straight on the chest, a size bigger, with a glassy blue eye
            var hz = shoulder - 1, hh = Math.round(9 * sf);
            slabF(TF, -tL * 0.45, tL * 0.62, -tW * 0.32, tW * 0.32, hz, hh, TB, tL * 0.34, tL * 0.05, tW * 0.06);
            if (fwd > -0.1) {
              var hf = function (k, b) { return onFront(tL * 0.62, tL * 0.34, hz, hh, k, b); };
              var vz = [hf(0.3, -tW * 0.26), hf(0.3, tW * 0.26), hf(0.7, tW * 0.23), hf(0.7, -tW * 0.23)];
              poly(g, vz, '#0b0e12');
              lens(hf(0.5, 0), 1.5 * Math.max(1, sf));
            }
            // the fin, a blade raked up and back to a point
            shape(TF, rectPts(-tL * 0.36, tL * 0.3, -tW * 0.08, tW * 0.08), hz + hh - 1, Math.round(7 * sf), TT, null,
              rectPts(-tL * 1.0, -tL * 0.72, -tW * 0.03, tW * 0.03));
          } else {
            // the dorsal crest over the dome, a sensor light at its brow
            slabF(TF, -tL * 0.62, tL * 0.52, -tW * 0.08, tW * 0.08, shoulder - 2, Math.round(6 * sf), TT, tL * 0.3, tL * 0.18, 0);
            glow(S3(TF(tL * 0.44, 0), shoulder + Math.round(2 * sf)), 1);
          }
          if (fwd < 0) dishOn();
        }
        // the dish on the walker's back, on a short mast
        function dishOn() {
          if (!(spec.dish || KITM.shoulder === 'dish')) return;
          var bz = shoulder - 1, dr = light ? 3.2 : heavy ? 5 : 4.2;
          var db = S3(TF(-tL * 0.7, -tW * 0.35), bz), dm = S3(TF(-tL * 0.7, -tW * 0.35), bz + (light ? 5 : 8));
          line(db, dm, 1.2, STEEL);
          sEllipse(dm[0], dm[1] - 1.2, dr, dr * 0.72, '#9aa4b0'); sEllipse(dm[0] + 0.5, dm[1] - 1, dr * 0.78, dr * 0.52, '#c3ccd6');
        }
        // what the hull's role puts on its back: aerials, fuel, a cross (the dish: dishOn)
        function extras() {
          var bz = shoulder - 1;
          if (KITM.shoulder === 'aerials') { aerial(TF, -tL * 0.7, tW * 0.5, bz, 20); aerial(TF, -tL * 0.7, -tW * 0.5, bz, 14); }
          if (KITM.shoulder === 'tanks' && fwd <= 0) backTanks();   // facing away, they are in front of the chest
          if (spec.cross && !light) crossOn(TF, -tL * 0.35, 0, shoulder + (heavy ? 0.3 : -0.7), tW * 0.3);
        }

      }

      return { mechHeights: mechHeights, drawMech: drawMech };
    };
  };
})(window);
