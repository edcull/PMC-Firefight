/* PMC 2670 — Firefight : the alien races: the Space Bugs from larva to the Overgrown the size of a tank, and the Xenotripods with their shields, their cloaks and their dead - each drawn in its own way, and the sprite() every figure on the table is fetched through.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoAliens = function (B) {
    var a = B.a, dot = B.dot, ellipse = B.ellipse, fbm = B.fbm, hullSpec = B.hullSpec, poly = B.poly;
    var rng = B.rng, toScreen = B.toScreen, A = B.A, ELEV = B.ELEV, K = B.K, PH = B.PH;
    // from modules installed after this one: looked up when called
    function eyeArt() { return B.eyeArt.apply(this, arguments); }
    function finishFigure() { return B.finishFigure.apply(this, arguments); }
    function hex3() { return B.hex3.apply(this, arguments); }
    function muzzleArt() { return B.muzzleArt.apply(this, arguments); }
    function paintFigure() { return B.paintFigure.apply(this, arguments); }
    function podArt() { return B.podArt.apply(this, arguments); }
    function lampArt() { return B.lampArt.apply(this, arguments); }
    function roleAt() { return B.roleAt.apply(this, arguments); }
    function vividHex() { return B.vividHex.apply(this, arguments); }

    /* ---------- the Space Bugs ----------
       Not men, so not paintFigure. Each bug is drawn side-on facing right, like a
       trooper, in the same art units (feet on y = 0, up is negative), and goes
       through the same outline, shadow and cache as a figure does. The shells are
       the army's colour; legs, bellies and joints are dark chitin; acid glows
       green, and the leader-caste brains glow violet. Poses: 'stand' (with a
       step frame), 'kneel' — suppressed, hunkered down low — and 'prone', broken
       or dead, sprawled with the legs drawn in. */
    var CHITIN = '#211915', CHITIN_L = '#3a2d24', LEGC = '#1a1411', LEG_LIT = '#4a3a2e';
    var BONE = '#dcd2b0', BONE_D = '#9d9174', BUG_EYE = '#f2f07a', BUG_EYE_D = '#9aa832';
    var ACID = '#8fd84a', ACID_L = '#d8ff96', ACID_D = '#4f8a24';
    var PSY = '#b98cf2', PSY_L = '#eedcff', PSY_D = '#6b4a9a';
    var FUNGUS_CAP = '#e9e2c6';
    function hexMix(c1, c2, k) {
      function p(h, i) { return parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); }
      var o = '#';
      for (var i = 0; i < 3; i++) o += ('0' + Math.round(p(c1, i) + (p(c2, i) - p(c1, i)) * k).toString(16)).slice(-2);
      return o;
    }
  /* ---- the Space Bugs: in view/iso-bugs.js ---- */
  var KIT_BUGS = null;
  function kitBugs() {
    return KIT_BUGS || (KIT_BUGS = root.PMCIsoBugs({
      A: A, ACID: ACID, ACID_D: ACID_D, ACID_L: ACID_L, B: B, BIGBUG: BIGBUG, BONE: BONE, BONE_D: BONE_D,
      BRAIN_PHASES: BRAIN_PHASES, BUG3D: BUG3D, BUG_EYE: BUG_EYE, CHITIN: CHITIN, CHITIN_L: CHITIN_L,
      ELEV: ELEV, FUNGUS_CAP: FUNGUS_CAP, K: K, LEGC: LEGC, LEG_LIT: LEG_LIT, PH: PH, PSY: PSY, PSY_D: PSY_D,
      PSY_L: PSY_L, WING_PHASES: WING_PHASES, a: a, dot: dot, ellipse: ellipse, hexMix: hexMix,
      hullSpec: hullSpec, nowT: nowT, poly: poly, rng: rng, root: root, toScreen: toScreen
    }));
  }
  function deadBug(g, w, h, ox, oy, pal, kit, s) { return (KIT_BUGS || kitBugs()).deadBug(g, w, h, ox, oy, pal, kit, s); }
  function paintBug(g, ox, oy, pal, kit, pose, step, s, dead) { return (KIT_BUGS || kitBugs()).paintBug(g, ox, oy, pal, kit, pose, step, s, dead); }
  function paintFungus(g, ox, oy, pal, kit, pose, s) { return (KIT_BUGS || kitBugs()).paintFungus(g, ox, oy, pal, kit, pose, s); }
  function burrowBug(g, w, h, ox, oy, pal, kit, step, s) { return (KIT_BUGS || kitBugs()).burrowBug(g, w, h, ox, oy, pal, kit, step, s); }
  function bugMuzzle(kit, pose) { return (KIT_BUGS || kitBugs()).bugMuzzle(kit, pose); }
  function drawBigBug(g, u, opts) { return (KIT_BUGS || kitBugs()).drawBigBug(g, u, opts); }
  function carcassSteam(g, sx, sy, t, seed) { return (KIT_BUGS || kitBugs()).carcassSteam(g, sx, sy, t, seed); }

    /* ---------- the Overgrown: bugs the size of a tank ----------
       Drawn with the same brush as the swarm, a size up, and cached as one sprite
       per side, pose and direction — they turn to the screen, left or right, the
       way their heading points. Each is a creature, so it has no turret and no
       tracks: where a machine's gun would be, its weapon is its mouth. */
    // where a bug's spit or spines leave it, in art units from its feet
    /* ---------- the Xenotripods ----------
       Crocks and their Esh-Aven, drawn side-on facing right in the figure's own
       art units (feet on y = 0, up negative), through the same outline, rim light
       and cache as a trooper. The Crocks are armoured in ivory-white ceramic,
       and the army's colour is the light in it — eyes, seams, weapon cells. An
       Alpha's plates are trimmed in gold. The Esh-Aven are ash-grey gargoyles in a
       few white plates, with the army's colour on their shoulders and weapons. */
    var XW = { lt: '#f5f3eb', md: '#dedbd0', dk: '#b0ac9f', sh: '#7e7b71', seam: '#46443e' };
    var XGOLD = { lt: '#f4dc8e', md: '#d6b054', dk: '#8f6c24' };
    var XFLESH = { lt: '#cfc3cf', md: '#a99bab', dk: '#6d6070' };
    var XASH = { lt: '#a7a7a1', md: '#83837e', dk: '#555553', sh: '#3a3a3a' };
  /* ---- the Xenotripods' figures: in view/iso-xenofig.js ---- */
  var KIT_XENOFIG = null;
  function kitXenoFig() {
    return KIT_XENOFIG || (KIT_XENOFIG = root.PMCIsoXenoFig({
      B: B, PH: PH, SHIELD_PHASES: SHIELD_PHASES, XASH: XASH, XFLESH: XFLESH, XGOLD: XGOLD, XW: XW,
      hexMix: hexMix, vividHex: vividHex
    }));
  }
  function xenoGlow(pal) { return (KIT_XENOFIG || kitXenoFig()).xenoGlow(pal); }
  function hexA(hex, al) { return (KIT_XENOFIG || kitXenoFig()).hexA(hex, al); }
  function paintXeno(g, ox, oy, pal, kit, pose, step, s, dead) { return (KIT_XENOFIG || kitXenoFig()).paintXeno(g, ox, oy, pal, kit, pose, step, s, dead); }
  /* ---- the prawns: in view/iso-prawnfig.js ---- */
  var KIT_PRAWNFIG = null;
  function kitPrawnFig() {
    return KIT_PRAWNFIG || (KIT_PRAWNFIG = root.PMCIsoPrawnFig({ hexMix: hexMix, vividHex: vividHex }));
  }
  function paintPrawn(g, ox, oy, pal, kit, pose, step, s, dead, corpse) { return kitPrawnFig().paintPrawn(g, ox, oy, pal, kit, pose, step, s, dead, corpse); }
  function prawnMuzzle(kit, pose) { return kitPrawnFig().prawnMuzzle(kit, pose); }

    var BIGBUG = {
      bugfirebeetle: { kind: 'firebeetle', h: 44 },
      bugsandworm: { kind: 'sandworm', h: 72 },
      bugbioplasma: { kind: 'bioplasma', h: 66 },
      bugshadow: { kind: 'shadow', h: 96 },
      bugqueen: { kind: 'queen', h: 92 },
      bugcarrier: { kind: 'carrier', h: 48, fly: true }
    };
    // segments: [along, height px, radius inch]; legs: [attach along, knee reach, foot along]
    var BUG3D = {
      firebeetle: {
        segs: [[-0.62, 22, 0.66], [0.1, 22, 0.44], [0.62, 18, 0.3]],
        legs: [[0.32, 0.7, 0.85], [0.1, 0.8, 0.35], [-0.2, 0.85, -0.3], [-0.5, 0.8, -0.95]], side: 0.36, knee: 40, foot: 1.15, legW: 4.2,
        head: 2, mouth: [0.95, 16]
      },
      bioplasma: {
        segs: [[-0.55, 20, 0.58], [0.12, 21, 0.42], [0.6, 22, 0.28]],
        legs: [[0.32, 0.7, 0.8], [0.1, 0.8, 0.3], [-0.2, 0.85, -0.3], [-0.5, 0.8, -0.95]], side: 0.34, knee: 38, foot: 1.1, legW: 3.9,
        head: 2, mouth: [1.12, 50]
      },
      shadow: {
        segs: [[-0.7, 40, 0.34], [-0.35, 42, 0.36], [0, 48, 0.26], [0.08, 62, 0.22], [0.2, 76, 0.2]],
        legs: [[0.02, 0.6, 0.7], [-0.15, 0.75, 0.25], [-0.35, 0.8, -0.35], [-0.6, 0.75, -1.0]], side: 0.2, knee: 70, foot: 1.35, legW: 3.4,
        head: 4, mouth: [0.42, 74]
      },
      queen: {
        segs: [[-1.05, 26, 0.72], [-0.45, 32, 0.66], [0.25, 40, 0.44], [0.72, 46, 0.3]],
        legs: [[0.4, 0.75, 1.0], [0.18, 0.9, 0.45], [-0.15, 0.95, -0.35], [-0.5, 0.9, -1.1]], side: 0.4, knee: 58, foot: 1.35, legW: 4.8,
        head: 3, mouth: [1.08, 42]
      },
      carrier: {
        segs: [[-0.8, 0, 0.5], [-0.2, 4, 0.78], [0.5, 2, 0.6], [1.05, 0, 0.3]],
        legs: [[0.4, 0.4, 0.6], [0, 0.45, 0.1], [-0.4, 0.4, -0.4]], side: 0.4, knee: -14, foot: 0.55, legW: 2.6, hang: true,
        head: 3, mouth: [1.3, -2]
      }
    };


    /* Two-tone camouflage: every pixel painted in one of the uniform's own
       tones is over-printed in black where a coarse blotch pattern says so, so
       the pattern follows the cloth and never touches skin, kit or helmet. */
    function applyCamo(cv, tint, s) {
      var g = cv.getContext('2d'), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
      var keys = ['light', 'mid', 'dark', 'helm', 'cloth'].map(function (k) { return hex3(tint[k]); });
      var black = [[40, 44, 38], [28, 31, 27], [16, 18, 15], [22, 25, 21], [20, 22, 19]];
      for (var y = 0; y < cv.height; y++) {
        for (var x = 0; x < cv.width; x++) {
          var o = (y * cv.width + x) * 4;
          if (d[o + 3] < 200) continue;
          var best = -1, bd = 22 * 22 * 3;
          for (var k = 0; k < keys.length; k++) {
            var dr = d[o] - keys[k][0], dg = d[o + 1] - keys[k][1], db = d[o + 2] - keys[k][2];
            var dist = dr * dr + dg * dg + db * db;
            if (dist < bd) { bd = dist; best = k; }
          }
          if (best < 0) continue;
          // blotches a few art units across, stretched a little sideways
          var n = fbm(x / (s * 5.5), y / (s * 4.2), 71, 2);
          if (n > 0.54) { d[o] = black[best][0]; d[o + 1] = black[best][1]; d[o + 2] = black[best][2]; }
        }
      }
      g.putImageData(im, 0, 0);
    }
    var SHIELD_PHASES = 8;
    var BRAIN_PHASES = 10;
    // a flamer's pilot light flickers through FLAME_PHASES baked states (-1: not burning)
    var FLAME_PHASES = 4;
    var WING_PHASES = 6;
    var FLAG_PHASES = 8;
    var CRYSTAL_PHASES = 8;
    function alphaKit(kit) { return !!kit && !!kit.xeno && kit.rank === 'alpha'; }
    function flagged(kit) { return !!kit && /^(flagsmall|flagbig|flaghuge|banner)$/.test(kit.gun || ''); }
    function winged(kit) { return !!kit && !!kit.bug && !!kit.fly; }
    function brainy(kit) { return !!kit && ['watchlarva', 'immwatch', 'watcher', 'overmind'].indexOf(kit.bug) >= 0; }
    function nowT() { return root.performance ? performance.now() : 0; }
    function shieldAnimated(kit) { return !!kit && kit.xeno === 'crock' && (kit.rank || 'beta') === 'beta'; }
    function cloakedKit(kit) { return !!kit && !!kit.xeno && !!kit.cloak; }
    /* A cloaked model fades in and out between whole and a quarter there, each at
       its own beat so the squad shimmers rather than blinking as one. */
    function cloakFade(mi) { return 0.625 + 0.375 * Math.sin(nowT() / 700 + mi * 1.7); }
    // whether a unit is drawn differently from one moment to the next, so the board keeps redrawing it
    function animates(u) {
      if (!u || u.alive === false) return false;          // (a bench unit need not say it is alive)
      if (u.cls === 'aircraft') return true;
      if (u.cls === 'vehicle' && /queen/.test(u.art || '')) return true;   // the queen's brain beats too
      if (u.art === 'engflame') return true;                                // the flame gun's pilot light
      if (u.drone && (u.cls === 'vehicle' || u.cls === 'aircraft')) return true;   // a drone's aerial light blinks
      return (B.ROLES[u.art] || []).some(function (r) { return (B.KIT[r] && B.KIT[r].collar) || flagged(B.KIT[r]) || alphaKit(B.KIT[r]) || shieldAnimated(B.KIT[r]) || cloakedKit(B.KIT[r]) || brainy(B.KIT[r]) || winged(B.KIT[r]) || (B.KIT[r] && B.KIT[r].gun === 'flamer'); });
    }
    function sprite(side, art, i, pose, step, scale, shade, mountKind) {
      var role = roleAt(art, i);
      var kit = B.KIT[role] || B.KIT.rifle;
      // a rider on something other than the bike: the same kit, a different mount
      if (kit.mount && mountKind && mountKind !== 'bike' && mountKind !== 'none') {
        var mk = {}; for (var kk in kit) mk[kk] = kit[kk];
        mk.mount = mountKind; kit = mk;
      } else mountKind = null;
      /* Kneeling and lying down are firing positions, not poses a figure holds
         while it crosses the table: a gun crew that is moving is up on its feet.
         So a kit that kneels or goes prone does so only when it is standing still,
         and every figure has a step frame when the unit is on the move. */
      if (pose === 'stand' && !step) {
        if (kit.prone) pose = 'prone';
        else if (kit.kneel) pose = 'kneel';
      }
      if (pose !== 'stand') step = 0;
      // a man flat in the dirt is drawn a size up to read; a bug that has gone to ground is not
      if (pose === 'prone' && !kit.bug) scale *= 1.25;
      var sq = Math.round(scale * 60) / 60;
      // a Beta's deflector is baked in SHIELD_PHASES states, one for each beat of its light
      var shieldy = shieldAnimated(kit) && !PH.corpse;
      if (shieldy) PH.shield = Math.floor(nowT() / 110) % SHIELD_PHASES;
      // a leader bug's brain beats slowly, about once in two seconds
      var thinking = brainy(kit);
      if (thinking) PH.brain = Math.floor(nowT() / 200) % BRAIN_PHASES;
      // a winged bug's wings beat, about four times a second, unless it has gone to ground
      var flapping = winged(kit) && pose !== 'prone';
      PH.wing = flapping ? (Math.floor(nowT() / 40) + i * 2) % WING_PHASES : -1;   // each bug at its own beat
      // a flamer's pilot light flickers, each man's at his own beat
      var burning = kit.gun === 'flamer' && !PH.corpse;
      PH.flame = burning ? (Math.floor(nowT() / 90) + i) % FLAME_PHASES : -1;
      // a flag stirs in the wind, a ripple running out along the cloth
      var waving = flagged(kit) && !PH.corpse;
      PH.flag = waving ? (Math.floor(nowT() / 140) + i * 3) % FLAG_PHASES : -1;
      // an Alpha leader's brow crystal pulses, slowly, with its mind
      var pulsing = alphaKit(kit) && i === 0 && !PH.corpse;
      PH.crystal = pulsing ? Math.floor(nowT() / 160) % CRYSTAL_PHASES : -1;
      var key = side + '|' + role + '|' + pose + '|' + step + '|' + sq + '|' + shade + (mountKind ? '|' + mountKind : '') + (shieldy ? '|sp' + PH.shield : '') + (thinking ? '|bp' + PH.brain : '') + (flapping ? '|wp' + PH.wing : '') + (burning ? '|fp' + PH.flame : '') + (waving ? '|gp' + PH.flag : '') + (pulsing ? '|cp' + PH.crystal : '') + (PH.corpse ? '|corpse' : '');
      var c = B.sprites[key];
      if (c) return c;

      var s = B.SU * sq * B.SPRITE_RES;
      var w = Math.ceil(B.SPR.w * s), h = Math.ceil(B.SPR.h * s);
      var ma = kit.prawn ? prawnMuzzle(kit, pose) : kit.bug || kit.xeno ? bugMuzzle(kit, pose) : muzzleArt(kit, pose);
      var ox = Math.round(B.SPR.ox * s), oy = Math.round(B.SPR.oy * s);

      // paint the figure, then ring it in near-black so it reads against the rank behind
      var body = document.createElement('canvas');
      body.width = w; body.height = h;
      var glows = [];                                    // lights that shine past the outline
      var pal = B.PALETTE[side] || B.PALETTE.A;
      if (kit.tint) {                                    // penal coveralls and the like
        var mixed = {};
        for (var pk in pal) mixed[pk] = kit.tint[pk] || pal[pk];
        mixed.force = pal.light;                         // the company's colour still shows
        mixed.forceMid = pal.mid; mixed.forceDark = pal.dark;
        /* On a rebel the company colour is the one bright thing about them —
           armband, helmet, belt or flag — so it is pushed to full strength. */
        if (kit.tint.rebel) {
          mixed.isRebel = true;
          // helmets in the side's colour, a touch less loud than the armbands
          mixed.helmForce = vividHex(pal.mid, 1.3, 1.04);
          mixed.helmLit = vividHex(pal.light, 1.3, 1.0);
          mixed.helmDark = pal.dark;
          mixed.force = vividHex(pal.light, 1.9, 1.05);
          mixed.forceMid = vividHex(pal.mid, 1.9, 1.12);
          mixed.forceDark = vividHex(pal.dark, 1.7, 1.1);
        }
        pal = mixed;
      }
      // a helmet painted in the company's colour, whatever the rest of the kit is
      // a helmet painted in the company's colour — the helmet alone, not the pads
      if (kit.redHelm) {                                 // a red helmet, whatever the side's colour
        var rh = {};
        for (var rk in pal) rh[rk] = pal[rk];
        rh.hat = '#a8322a'; rh.hatLit = '#d0584a'; rh.hatDark = '#5c1a16';
        pal = rh;
      }
      if (kit.forceHelm) {
        var hp = {};
        for (var hk in pal) hp[hk] = pal[hk];
        hp.hat = pal.helmForce || pal.forceMid || pal.mid; hp.hatLit = pal.helmLit || pal.force || pal.light; hp.hatDark = pal.helmDark || pal.forceDark || pal.dark;
        pal = hp;
      }
      if (kit.bug && PH.corpse) deadBug(body.getContext('2d'), w, h, ox, oy, pal, kit, s);
      else if (kit.bug && pose === 'prone' && !kit.fly && kit.bug !== 'under' && kit.bug !== 'hugeunder') {
        ma = [ma[0], ma[1] + burrowBug(body.getContext('2d'), w, h, ox, oy, pal, kit, step, s)];
      } else if (kit.bug) paintBug(body.getContext('2d'), ox, oy, pal, kit, pose, step, s, false);
      else if (kit.xeno) {
        paintXeno(body.getContext('2d'), ox, oy, pal, kit, pose, step, s, false);
        finishFigure(body, ox, oy, s, pose);
      } else if (kit.prawn) {
        paintPrawn(body.getContext('2d'), ox, oy, pal, kit, pose, step, s, false, !!PH.corpse);
        finishFigure(body, ox, oy, s, pose);
      } else {
        glows = paintFigure(body.getContext('2d'), ox, oy, pal, kit, pose, step, s) || [];
        finishFigure(body, ox, oy, s, pose);
        if (kit.camo) applyCamo(body, kit.tint, s);
        if (kit.fungus) paintFungus(body.getContext('2d'), ox, oy, pal, kit, pose, s);
      }

      var sil = document.createElement('canvas');
      sil.width = w; sil.height = h;
      var sg = sil.getContext('2d');
      sg.drawImage(body, 0, 0);
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = '#080a0e';
      sg.fillRect(0, 0, w, h);

      c = document.createElement('canvas');
      c.width = w; c.height = h;
      var g = c.getContext('2d');
      // the model's own shadow is baked in, so a rank costs one blit per model
      ellipse(g, ox + 2 * s, oy, 13 * s, 5 * s, 'rgba(12,10,8,.34)');
      var o = Math.max(1, Math.round(s));
      g.globalAlpha = 0.55;                              // a touch of separation up-light
      g.drawImage(sil, -o, 0); g.drawImage(sil, 0, -o);
      g.globalAlpha = 1;
      g.drawImage(sil, o, 0); g.drawImage(sil, 0, o);    // the shadow side, solid
      g.drawImage(body, 0, 0);
      if (shade) {                                       // ranks behind sit in shadow
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(8,10,14,' + (shade >= 3 ? 0.46 + (shade - 3) * 0.05 : shade * 0.16) + ')';
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
      }
      // lights that shine past the outline, laid over everything, shade included
      if (!PH.corpse) glows.forEach(function (L) {   // (a dead man's goggles are dark)
        var gr = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
        gr.addColorStop(0, 'rgba(' + L.c + ',.75)');
        gr.addColorStop(0.3, 'rgba(' + L.c + ',.35)');
        gr.addColorStop(1, 'rgba(' + L.c + ',0)');
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr;
        g.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2); g.restore();
      });
      c.ox = ox; c.oy = oy; c.res = B.SPRITE_RES;
      c.muz = [ma[0] * B.SU * sq, ma[1] * B.SU * sq];      // the muzzle, in board pixels from the feet
      var alien = kit.bug || kit.xeno || kit.prawn;
      var pa = alien ? null : podArt(kit, pose), ea = alien ? null : eyeArt(kit, pose);
      c.pod = pa ? [pa[0] * B.SU * sq, pa[1] * B.SU * sq] : null;
      c.eye = ea ? [ea[0] * B.SU * sq, ea[1] * B.SU * sq] : null;
      var la = alien ? null : lampArt(kit, pose);
      c.lamp = la ? [la[0] * B.SU * sq, la[1] * B.SU * sq] : null;
      // a man whose hands hold optics, a slate or a case is not one of the guns
      c.tool = /^(optics|slate|case|console)$/.test(kit.gun || '');
      c.gun = kit.gun || null;                          // which weapon the man holds, for which shots he fires
      B.sprites[key] = c;
      return c;
    }


    return {
      BIGBUG: BIGBUG,
      XW: XW,
      animates: animates,
      carcassSteam: carcassSteam,
      cloakFade: cloakFade,
      cloakedKit: cloakedKit,
      drawBigBug: drawBigBug,
      hexA: hexA,
      hexMix: hexMix,
      sprite: sprite,
      xenoGlow: xenoGlow
    };
  };
})(window);
