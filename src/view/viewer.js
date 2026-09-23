/* PMC 2670 — Firefight : the unit viewer.

   A bench for looking at one unit at a time: every profile in both lists, in
   each of its states, walking, and firing whatever the weapon table says it
   carries. It draws with the same iso.js the battle does and plays the same
   effects out of fx.js, so what you see here is what happens on the table —
   this is a window onto the real code, not a mock-up of it.
*/
(function (root) {
  'use strict';

  var R = root.PMC, I = root.PMCIso, SFX = root.SFX;
  var el = function (id) { return document.getElementById(id); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  /* ---------- the stage ----------
     A small patch of flat ground with the unit in the middle and a target to
     its right, drawn at a fixed zoom. The world is 24" x 16"; the firer stands
     at 6" and the mark at 19". */
  var W = 24, H = 16;
  var FROM = { x: 6, y: 8 }, TO = { x: 19, y: 8 };

  var cv, g, FX;
  // the stage opens close on the unit; it pulls out to the whole firing line to show a shot
  var ZOOM_CLOSE = 3;
  var view = {
    zoom: ZOOM_CLOSE, zCur: ZOOM_CLOSE, wide: false,
    key: 'regular', prop: 'tracked', side: 'A', status: 'ready',
    models: null, walking: false, walkT: 0, at: null, facing: 0, face: 'SE',
    sound: true,
    // each side's paint, from every colour an army can take
    colour: { A: 'ochre', B: 'steel' }
  };
  var loop = null, last = 0;

  function profile() { return R.profile(view.key) || R.profile('regular'); }

  /* The unit as the battle would build it: a profile plus the state the bench
     is asking to see. Everything that draws a unit takes one of these. */
  function unit() {
    var p = profile();
    var u = Object.assign({}, p, {
      id: 'V' + p.code, side: view.side, label: p.name,
      models: view.models == null ? p.size : view.models,
      rules: p.rules.slice(), sp: 0, alive: true, damage: 0, cargo: [],
      x: (view.at || FROM).x, y: (view.at || FROM).y,
      facing: view.walking ? view.facing : faceAngle(view.face),
      // the turret stays on the mark it last fired at, until the hull is turned
      aim: view.aimFor === view.face + '|' + view.walking ? view.aim : null,
      faceL: view.faceL
    });
    if (p.cls === 'vehicle' && !R.alienHull(p)) R.applyPropulsion(u, view.prop);
    /* A machine shows wear as Damage — half its Structure gone is enough to set
       it smoking — and a squad shows it as Suppression. Destroyed is drawn by
       drawDestroyed rather than by any number here. */
    if (R.isMachine(u)) {
      u.damage = view.status === 'damaged' ? Math.ceil(u.str / 2) : 0;
    } else {
      var m = R.currentMorale(u);
      u.sp = view.status === 'broken' ? 2 * m + 1 : view.status === 'suppressed' ? m + 1 : 0;
    }
    return u;
  }
  /* Which way a machine points, picked on the screen: E is to the right, S
     toward you. A screen direction is turned into a heading on the table. */
  var FACES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  function faceAngle(name) {
    var i = FACES.indexOf(name || 'SE');
    var th = (i < 0 ? 1 : i) * Math.PI / 4;
    var u2 = Math.cos(th), v2 = 2 * Math.sin(th);
    return Math.atan2(v2 - u2, u2 + v2);
  }
  // the thing being shot at: a plain rifle team, so the eye is on the shooter
  function mark() {
    var p = R.profile('regular');
    return Object.assign({}, p, {
      id: 'VTGT', side: view.side === 'A' ? 'B' : 'A', label: 'target',
      models: p.size, rules: p.rules.slice(), sp: 0, alive: true,
      damage: 0, cargo: [], x: TO.x, y: TO.y, facing: Math.PI
    });
  }

  /* ---------- drawing ---------- */
  function toScreen(x, y) { return I.toScreen(x, y); }

  function frame() {
    var w = cv.width, h = cv.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0c1014';
    g.fillRect(0, 0, w, h);

    // centre the patch of ground in the canvas
    /* On a narrow screen the whole firing line — shooter, gap and mark — is
       scaled down to fit, rather than cut off at the sides. */
    var c = toScreen(W / 2, H / 2);
    var a0 = toScreen(FROM.x - 1.2, FROM.y + 1.2), a1 = toScreen(TO.x + 1.2, TO.y - 1.2);
    var span = Math.abs(a1.x - a0.x) + I.K;
    var zWide = Math.min(view.dpr || 1, w / span, h / (I.K * 6.5));
    /* Zoomed in, the camera closes on the unit wherever it stands (walking
       included) so the figures can be seen up close; at 1 it is the whole
       firing line. In between it slides from one framing to the other. */
    var zc = view.zCur || 1, z = zWide * zc;
    var at = view.at || FROM, f = toScreen(at.x, at.y);
    var k = Math.max(0, Math.min(1, zc - 1));
    var px = c.x + (f.x - c.x) * k, py = (c.y - I.K * 1.2) + ((f.y - I.K * 0.8) - (c.y - I.K * 1.2)) * k;
    g.setTransform(z, 0, 0, z, Math.round(w / 2 - px * z), Math.round(h / 2 - py * z));

    drawGround();
    var u = unit(), t = mark();
    var arr = arriving();
    // far to near, so the nearer of the two covers the other
    var order = [u, t].sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    order.forEach(function (m) {
      if (m === u && view.status === 'destroyed') { drawDestroyed(u); return; }
      I.drawUnit(g, m, {
        at: { x: m.x, y: m.y }, lift: m === u ? arr.lift : 0,
        hop: m === u ? (view.hop || 0) : 0,
        walk: m === u ? view.walkFrame : 0,
        arc: m === u && view.walking ? (view.arc || 0) : 0,
        status: m === u && !R.isMachine(m) ? (arr.status || view.status) : 'ready',
        morale: R.isMachine(m) ? 0 : R.currentMorale(m)
      });
    });
    FX.draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* What is left of it: a machine is a burning wreck, and a squad is its
     models lying where they fell, laid out the way the battle scatters them. */
  function drawDestroyed(u) {
    if (R.isMachine(u)) {
      var dead = Object.assign({}, u, { alive: false, cargo: [], damage: 0 });
      I.drawWreck(g, dead, { x: u.x, y: u.y }, 0, Date.now());
      return;
    }
    var p = I.toScreen(u.x, u.y);
    var n = u.models || u.size || 1;
    for (var i = n; i > 0; i--) {
      var cs = I.casualtySpot(u, i, i * 7);
      I.drawBody(g, p.x + cs.dx, p.y + cs.dy, {
        side: u.side, paint: u.paint || null, art: u.art, mi: cs.mi, flip: i % 3 === 0
      });
    }
  }

  // a plain checkered floor, so movement and distance are readable
  function drawGround() {
    for (var x = 0; x < W; x += 2) {
      for (var y = 0; y < H; y += 2) {
        var q = [toScreen(x, y), toScreen(x + 2, y), toScreen(x + 2, y + 2), toScreen(x, y + 2)];
        g.beginPath();
        g.moveTo(q[0].x, q[0].y);
        for (var n = 1; n < 4; n++) g.lineTo(q[n].x, q[n].y);
        g.closePath();
        g.fillStyle = ((x + y) / 2) % 2 ? '#1c2129' : '#191e25';
        g.fill();
      }
    }
    // the line the shot will take, and a tick every 2"
    var a = toScreen(FROM.x, FROM.y), b = toScreen(TO.x, TO.y);
    g.strokeStyle = 'rgba(140,160,190,.16)';
    g.setLineDash([4, 6]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(a.x, a.y - I.K * 0.5); g.lineTo(b.x, b.y - I.K * 0.5); g.stroke();
    g.setLineDash([]);
    g.font = '500 9px "IBM Plex Mono", monospace';
    g.fillStyle = 'rgba(140,160,190,.4)';
    g.textAlign = 'center';
    for (var d = 2; d < TO.x - FROM.x; d += 4) {
      var tk = toScreen(FROM.x + d, FROM.y);
      g.fillText(d + '"', tk.x, tk.y - I.K * 0.7);
    }
  }

  function tick(t) {
    loop = null;
    var dt = last ? Math.min(64, t - last) : 16;
    last = t;
    var busy = FX.prune();
    var acting = busy;
    if (view.walking) { stepWalk(dt); busy = true; }
    if (view.strafeAt) { strafing(); busy = true; acting = true; }
    /* Firing pulls the camera out to the whole line; once the shots have
       finished playing it goes back in to the zoom the viewer chose. */
    if (view.wide) {
      if (acting) view.wideUntil = t + 700;
      else if (t > (view.wideUntil || 0)) view.wide = false;
      busy = true;
    }
    var want = view.wide ? 1 : view.zoom;
    if (Math.abs((view.zCur || 1) - want) > 0.005) {
      view.zCur = (view.zCur || 1) + (want - (view.zCur || 1)) * Math.min(1, dt / 140);
      busy = true;
    } else view.zCur = want;
    // the wreck keeps burning, and a damaged hull keeps smoking
    if (R.isMachine(unit()) && view.status !== 'ready') busy = true;
    frame();
    if (busy) start(); else { last = 0; drawState(); }
  }
  function start() { if (!loop) loop = requestAnimationFrame(tick); }

  /* ---------- movement ----------
     The unit walks out to the mark and back at its own Movement in inches a
     second, so a Move 3" hull crawls and a Move 12" one does not.

     The same gait the battle uses (game.js: pace/gaitOf). A footfall happens
     every so many inches covered, not every so many milliseconds, so a fast
     unit puts its legs down faster rather than sliding. The body is up between
     footfalls and down on each one. */
  var PACE = 2.2, STRIDE = 3.4, ROLL = 2.8;
  function gaitOf(u) {
    if (!R.isMachine(u)) return { span: PACE, lift: 1.6, sound: true };
    if (u.prop === 'walker') return { span: STRIDE, lift: 1.3, sound: true };
    if (u.prop === 'grav' || u.prop === 'hover' || u.cls === 'aircraft') return null;
    return { span: ROLL, lift: 0.5, sound: false };
  }

  function stepWalk(dt) {
    var u = unit();
    var speed = Math.max(2, (u.move || 5)) * 0.9;          // inches a second
    view.walkT += (dt / 1000) * speed;
    var span = TO.x - FROM.x - 3;
    var f = (view.walkT % (span * 2)) / span;
    var back = f > 1;
    var d = back ? 2 - f : f;
    view.at = { x: FROM.x + d * span, y: FROM.y };
    view.facing = back ? Math.PI : 0;

    if (u.jets) {
      /* Jump troops cross the bench in bounds, one full move at a time: up on
         the jets, over, and down, with the burn flickering all the way. */
      var bound = Math.max(3, u.move || 7), bt = view.walkT / bound, bn = Math.floor(bt);
      view.walkFrame = 1 + (Math.floor(Date.now() / 70) % 2);
      view.hop = 0;
      view.arc = Math.sin((bt - bn) * Math.PI) * Math.min(I.K * 3, I.K * (0.9 + bound * 0.22));
      if (bn !== view.lastPace) {
        view.lastPace = bn;
        if (view.sound && SFX && SFX.jetpack) SFX.jetpack(bound / speed);
      }
      return;
    }
    var gait = gaitOf(u);
    if (!gait) { view.walkFrame = 0; view.hop = 0; return; }
    var paces = view.walkT / gait.span;
    var n = Math.floor(paces);
    view.walkFrame = 1 + (n % 2);
    view.hop = Math.sin((paces - n) * Math.PI) * gait.lift;
    if (n !== view.lastPace) {
      view.lastPace = n;
      if (gait.sound && view.sound && SFX) SFX.step();
    }
  }
  /* ---------- a strafing run ----------
     What an aircraft does instead of standing still and shooting (engine.js
     offers Strafe to anything of class aircraft): it comes across the bench at
     speed with its guns going, and the ground walks up under it. */
  var STRAFE_MS = 2200;
  function canStrafe() { return unit().cls === 'aircraft'; }
  function strafe() {
    showWide();
    if (!canStrafe()) { note('Only aircraft make strafing runs.'); return; }
    view.walking = false; view.walkFrame = 0; view.hop = 0; view.arc = 0;
    view.strafeAt = Date.now();
    view.facing = 0;
    note('A strafing run: it fires the length of the pass.');
    var fired = 0, guns = 7;
    (function burst() {
      if (fired >= guns || !view.strafeAt) return;
      var f = 0.2 + (fired / (guns - 1)) * 0.6;
      var x = FROM.x - 6 + (TO.x + 6 - (FROM.x - 6)) * f;
      FX.add({ kind: 'muzzle', x: x, y: FROM.y, dur: 180 });
      FX.add({ kind: 'impact', x: x, y: FROM.y, n: 3, dur: 320 });
      for (var d3 = 0; d3 < 3; d3++) {
        FX.add({
          kind: 'miss', x: x + (Math.random() - 0.5) * 2.4, y: FROM.y + (Math.random() - 0.5) * 2.4,
          dur: 380 + Math.random() * 220
        });
      }
      if (view.sound && SFX) SFX.burst(2, true);
      fired++;
      setTimeout(burst, STRAFE_MS * 0.6 / guns);
      start();
    })();
    setTimeout(function () { drawControls(); }, STRAFE_MS);
    start();
    drawControls();
  }
  // where it is along the run, or nothing once it has gone by
  function strafing() {
    if (!view.strafeAt) return null;
    var k = (Date.now() - view.strafeAt) / STRAFE_MS;
    if (k >= 1) { view.strafeAt = 0; view.at = null; view.facing = 0; return null; }
    var a = FROM.x - 6, b = TO.x + 6;
    view.at = { x: a + (b - a) * k, y: FROM.y };
    view.facing = 0;
    return k;
  }

  function toggleWalk() {
    view.walking = !view.walking;
    if (!view.walking) { view.at = null; view.facing = 0; view.walkFrame = 0; view.hop = 0; view.arc = 0; frame(); }
    else { view.walkT = 0; view.lastPace = -1; start(); }
    drawControls();
  }

  /* ---------- battlefield insertion ----------
     The same arrival the battle plays (game.js: arriving/landUnit), so the bench
     shows what a unit coming in off a Battlefield Insertion actually looks like.
     A craft — a rapid insertion platform, a drop pod, any hull — falls out of the
     sky onto its landing point and throws up the dust it lands in. A squad is
     already on the ground when you see it and comes up out of cover: drawn broken,
     then suppressed, then standing. It is only how it is drawn; the state the
     bench is set to is untouched. */
  var DROP_MS = 900, STAND_MS = 1150;

  function syncSound() {
    if (!SFX) return;
    if (!view.sound) SFX.setEnabled(false);
    else if (!SFX.enabled()) SFX.setEnabled(true);
  }

  function arriving() {
    if (!view.arriveAt) return { lift: 0, status: null };
    var age = Date.now() - view.arriveAt;
    if (view.arriveKind === 'drop') {
      if (age >= DROP_MS) { view.arriveAt = 0; return { lift: 0, status: null }; }
      // gathering speed the whole way down, so it arrives hard rather than drifting in
      var eased = 1 - Math.pow(1 - age / DROP_MS, 0.45);
      return { lift: Math.round(I.ELEV * 5.5 * (1 - eased)), status: null };
    }
    if (age >= STAND_MS) { view.arriveAt = 0; return { lift: 0, status: null }; }
    // flat on its face, then up on one knee, then standing
    return {
      lift: 0,
      status: age < STAND_MS * 0.38 ? 'broken' : age < STAND_MS * 0.74 ? 'suppressed' : null
    };
  }

  function insert() {
    var u = unit(), craft = R.isMachine(u) || !!u.jets;
    if (view.walking) toggleWalk();
    FX.clear();
    syncSound();
    view.arriveAt = Date.now();
    view.arriveKind = craft ? 'drop' : 'stand';
    var at = { x: u.x, y: u.y };
    if (craft) {
      FX.add({ kind: 'dropmark', x: at.x, y: at.y, dur: DROP_MS, blocking: true });
      setTimeout(function () {
        FX.add({ kind: 'collapse', x: at.x, y: at.y, r: 2.4, dur: 700, blocking: true });
        if (SFX) { SFX.impact(); SFX.impact(0.09); }
        start();
      }, DROP_MS - 60);
    } else {
      FX.add({ kind: 'collapse', x: at.x, y: at.y, r: 1.6, dur: 600, blocking: true });
      // boots, then the squad on its feet
      if (SFX) { SFX.step(); SFX.step(0.24); SFX.step(0.5); }
    }
    // keep the frame loop turning while the arrival plays out
    FX.add({ kind: 'hold', x: at.x, y: at.y, dur: craft ? DROP_MS + 300 : STAND_MS, blocking: true });
    start();
    note(craft
      ? u.name + ' comes down on its landing point — the dust goes up with it.'
      : u.name + ' is on the ground before you see it, and comes up out of cover.');
  }

  /* ---------- firing ----------
     The same effects the battle plays, driven from the same weapon table. Hits
     are made up here — the bench is about what it looks and sounds like, not
     about the dice. */
  // what the stage zooms between: 1 is the whole firing line, ZMAX a squad filling it
  var ZMIN = 1, ZMAX = 4.5;
  function setZoom(zz) {
    view.zoom = Math.max(ZMIN, Math.min(ZMAX, zz));
    view.wide = false;
    zoomLabel();
    start();
  }
  function zoomLabel() {
    var zl = el('vzoomlabel');
    if (zl) zl.textContent = '\u00d7' + (Math.round(view.zoom * 10) / 10);
  }
  // pull out to the whole line for the length of a shot
  function showWide() { view.wide = true; view.wideUntil = performance.now() + 900; start(); }
  function fire() {
    if (view.status === 'destroyed') { note('It is destroyed — it is not firing anything.'); return; }
    showWide();
    var u = unit(), spec = R.weaponSpec(u);
    // a flier shoots from its airframe, not from the grass under it
    var from = { x: u.x, y: u.y, up: I.flyLift(u) }, to = { x: TO.x, y: TO.y };
    // troopers turn to the mark, and every round leaves one of their own barrels
    if (!R.isMachine(u)) {
      var a0 = I.toScreen(u.x, u.y), b0 = I.toScreen(TO.x, TO.y);
      u.faceL = view.faceL = b0.x < a0.x;
      var pool = I.muzzles(u, view.status);
      if (pool.length) { from.mz = pool[0]; from.pool = pool; }
    }
    var mountFrom = function () { return from; };
    if (R.isMachine(u)) {
      u.aim = view.aim = Math.atan2(TO.y - u.y, TO.x - u.x);
      view.aimFor = view.face + '|' + view.walking;
      var M = I.mounts(u);
      var base = from;
      mountFrom = function (style) { return I.mountFor(M, style, u, base); };
      from = mountFrom(spec.p);
    }
    from.second = mountFrom(spec.s);
    var hits = 3;
    syncSound();
    play(spec, from, to, hits, u);
    start();
    note(describe(spec, u));
  }

  var FIRE = {
    small: { n: 9, gap: 112, spread: 0.42, muzzle: 520, perShot: true },
    pistol: { n: 5, gap: 185, spread: 0.34, short: true, muzzle: 150, perShot: true },
    smg:   { n: 10, gap: 68, spread: 0.5, short: true, muzzle: 460 },
    burst: { n: 10, gap: 38, spread: 0.55, muzzle: 460 },
    chain: { n: 9, gap: 92, spread: 0.3, fat: true, muzzle: 92, perShot: true },
    spine: { n: 10, gap: 45, spread: 0.6, short: true, bio: true, muzzle: 0, noFlash: true }
  };
  // a bug's acid: `n` globs lobbed low, each landing in a green splash
  function spit(from, to, n, big) {
    var fl = big ? 760 : 560;
    for (var q = 0; q < (n || 1); q++) {
      (function (j) {
        setTimeout(function () {
          if (SFX) SFX.spit(0, big);
          var aim = n > 1 ? { x: to.x + (j - (n - 1) / 2) * 0.9, y: to.y + (j % 2 ? 0.6 : -0.6), up: to.up } : to;
          FX.add({ kind: 'glob', from: from, to: aim, dur: fl, big: big });
          setTimeout(function () {
            FX.add({ kind: 'splat', x: aim.x, y: aim.y, up: aim.up, big: big, dur: 620 });
            if (SFX) SFX.splat();
            start();
          }, fl);
          start();
        }, j * (big ? 260 : 150));
      })(q);
    }
  }

  /* A missile off an aircraft flies level and leaves on the line the craft is
     flying, curving onto the mark from there — the same path the battle draws.
     This is the point out ahead of the nose that it bends through. */
  function flightCurve(from, to) {
    var u = unit();
    if (!u || u.cls !== 'aircraft') return null;
    var a = u.facing == null ? 0 : u.facing;
    var reach = Math.max(4, Math.hypot(to.x - from.x, to.y - from.y) * 0.55);
    return { x: from.x + Math.cos(a) * reach, y: from.y + Math.sin(a) * reach, up: I.flyLift(u) };
  }

  // a Xenotripod's weapons, burning in its army's colour
  // Xenotripod energy burns blue, as it does in the battle
  function glowRGB() { return '110,190,255'; }
  function shotRGB() { return R.isXeno(unit()) ? glowRGB() : null; }
  function energy(from, to, n, land) {
    var rgb = glowRGB();
    for (var q = 0; q < (n || 1); q++) {
      (function (j) {
        setTimeout(function () {
          if (SFX && SFX.zap) SFX.zap();
          FX.add({ kind: 'pulse', from: from, to: to, rgb: rgb, dur: 260 });
          if (land) setTimeout(function () { landing(to, 2); start(); }, 250);
          start();
        }, j * 120);
      })(q);
    }
  }
  function orbs(from, to, n, tele, big) {
    var rgb = glowRGB(), fl = tele ? 1000 : big ? 960 : 760;
    var exit = null;
    if (tele) {                                  // one exit portal for the whole salvo
      var ex = from.x - to.x, ey = from.y - to.y, ed = Math.hypot(ex, ey) || 1, eb = Math.min(ed * 0.45, 2.4);
      exit = { x: to.x + ex / ed * eb, y: to.y + ey / ed * eb, up: to.up };
      FX.add({ kind: 'exitportal', exit: exit, open: 300, dur: fl + ((n || 1) - 1) * 200 });
    }
    for (var q = 0; q < (n || 1); q++) {
      (function (j) {
        setTimeout(function () {
          if (tele && SFX && SFX.shimmer) SFX.shimmer(); else if (SFX && SFX.launch) SFX.launch();
          var aim = n > 1 ? { x: to.x + (j - (n - 1) / 2) * 1.1, y: to.y + (j % 2 ? 0.7 : -0.7), up: to.up } : to;
          FX.add({ kind: 'orb', from: from, to: aim, rgb: rgb, tele: !!tele, exit: exit, big: !!big, dur: fl });
          setTimeout(function () {
            FX.add({ kind: 'orbburst', x: aim.x, y: aim.y, up: aim.up, rgb: rgb, big: !!big, dur: big ? 800 : 600 });
            // a heavy round throws the ground up with it, in blue fire
            if (big) {
              FX.add({ kind: 'orbburst', x: aim.x, y: aim.y, up: aim.up, rgb: rgb, dur: 1000 });
              for (var sp = 0; sp < 5; sp++) {
                FX.add({
                  kind: 'orbburst', rgb: rgb, dur: 520 + Math.random() * 260,
                  x: aim.x + (Math.random() - 0.5) * 3.2, y: aim.y + (Math.random() - 0.5) * 3.2, up: aim.up
                });
              }
            }
            if (SFX) { SFX.impact(); if (big) SFX.impact(0.08); }
            start();
          }, fl);
          start();
        }, j * 200);
      })(q);
    }
  }

  function stream(style, from, to) {
    var f = FIRE[style] || FIRE.small;
    if (SFX && R.isXeno(unit()) && SFX.zaps) SFX.zaps(style, 3);
    else if (SFX) {
      if (style === 'chain') SFX.chain(3);
      else if (style === 'burst') SFX.rattle(3);
      else if (style === 'smg') SFX.smg(3);
      else if (style === 'pistol') SFX.pistol(3);
      else if (style === 'spine') SFX.spine(3);
      else SFX.burst(3, false);
    }
    var pool = from.pool || [from.mz];
    function gun(i) { return { x: from.x, y: from.y, up: from.up, mz: pool[i % pool.length] }; }
    if (f.noFlash) {
      // a bug has no muzzle to flash
    } else if (f.perShot) {
      for (var m = 0; m < f.n; m++) {
        FX.add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pool[m % pool.length], rgb: shotRGB(), delay: m * f.gap, dur: f.muzzle + m * f.gap });
      }
    } else {
      for (var m2 = 0; m2 < Math.min(pool.length, f.n); m2++) {
        FX.add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pool[m2], rgb: shotRGB(), delay: m2 * 23, dur: f.muzzle + m2 * 23 });
      }
    }
    for (var i = 0; i < f.n; i++) {
      var at = f.clump
        ? Math.floor(i / f.clump) * f.clumpGap + (i % f.clump) * f.gap
        : i * f.gap;
      FX.add({
        kind: 'tracer', from: gun(i), to: to, spread: f.spread, fat: f.fat, short: f.short, bio: f.bio, rgb: shotRGB(),
        delay: at, dur: 250 + at
      });
    }
  }
  /* The same pumped cone the battle draws: six jets in quick succession, barely
     off each other, converging on the same ground. */
  var FLAME_JET = 620, FLAME_GAP = 165;
  function flameJets(from, to, n, onLand) {
    var dx = to.x - from.x, dy = to.y - from.y;
    var len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    var px = -dy / len, py = dx / len;
    var span = (n - 1) * FLAME_GAP + FLAME_JET;      // how long the roar has to hold
    for (var i = 0; i < n; i++) {
      (function (j) {
        setTimeout(function () {
          var off = (j - (n - 1) / 2) * 0.45;
          var aim = { x: to.x + px * off, y: to.y + py * off };
          if (SFX) { if (j === 0) SFX.flame(0, span / 1000); else SFX.flamepuff(); }
          FX.add({ kind: 'flame', from: from, to: aim, dur: FLAME_JET });
          if (onLand && j === n - 1) setTimeout(function () { onLand(); start(); }, 360);
          start();
        }, j * FLAME_GAP);
      })(i);
    }
  }

  function landing(to, n, big) {
    FX.add({ kind: 'impact', x: to.x, y: to.y, n: n, rgb: shotRGB(), dur: big ? 560 : 420 });
    if (SFX) { SFX.impact(); if (big) SFX.impact(0.06); }
  }

  /* A secondary: a coaxial, a gunship's guns, or the grenades assault troops
     throw as they close. The same shapes the battle draws, minus the casualties. */
  function secondary(style, from, to, count) {
    if (FIRE[style]) { stream(style, from, to); return; }
    if (style === 'arc' || style === 'arcbig') {
      var thrown = count || 1;
      for (var q = 0; q < thrown; q++) {
        (function (j) {
          setTimeout(function () {
            var aim = thrown > 1
              ? { x: to.x + (j - (thrown - 1) / 2) * 1.4, y: to.y + (j % 2 ? 0.9 : -0.9), up: to.up }
              : to;
            if (SFX) SFX.launch();
            FX.add({ kind: 'lob', from: from, to: aim, dur: 520, heavy: style === 'arcbig' });
            setTimeout(function () { landing(aim, 4); start(); }, 520);
            start();
          }, j * 190);
        })(q);
      }
      return;
    }
    if (style === 'flame') { flameJets(from, to, 4, null); return; }
    if (style === 'spit' || style === 'spitbig') { spit(from, to, count || 1, style === 'spitbig'); return; }
    if (style === 'energy') { energy(from, to, count || 1, false); return; }
    if (style === 'orb') { orbs(from, to, count || 1, !R.isMachine(unit())); return; }
    if (style === 'orbbig') { orbs(from, to, count || 1, false, true); return; }
    if (style === 'rail') {
      for (var r1 = 0; r1 < (count || 1); r1++) {
        (function (j) {
          setTimeout(function () {
            if (SFX) SFX.rail();
            FX.add({ kind: 'rail', from: from, to: to, rgb: shotRGB(), dur: 380 });
            start();
          }, j * 170);
        })(r1);
      }
      return;
    }
    if (style === 'missile') {
      for (var m1 = 0; m1 < (count || 1); m1++) {
        (function (j) {
          setTimeout(function () {
            if (SFX) SFX.missile(0, 0.9, 0.47);
            // no flash at the tube: a missile is ejected cold and lights at the top
            FX.add({ kind: 'missile', from: from, to: to, seed: j, dur: 900, curve: flightCurve(from, to) });
            start();
          }, j * 260);
        })(m1);
      }
      return;
    }
    if (style === 'rocket') {
      if (SFX) SFX.rocket(3);
      for (var k1 = 0; k1 < 5; k1++) {
        (function (j) {
          setTimeout(function () {
            FX.add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: from.mz, dur: 180, big: true });
            FX.add({ kind: 'missile', from: from, to: to, rocket: true, seed: j, dur: 420 });
            start();
          }, j * 78);
        })(k1);
      }
      return;
    }
    if (style === 'shell' || style === 'shellbig') {
      var fired = count || 1;
      for (var q2 = 0; q2 < fired; q2++) {
        (function (j) {
          setTimeout(function () {
            if (SFX) SFX.shell();
            FX.add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: from.mz, dur: 240, big: true });
            FX.add({ kind: 'bolt', from: from, to: to, dur: 300, heavy: style === 'shellbig' });
            start();
          }, j * 230);
        })(q2);
      }
      return;
    }
    stream(style, from, to);
  }

  function play(spec, from, to, hits, u) {
    if (spec.s) setTimeout(function () { secondary(spec.s, from.second || from, to, spec.sn); start(); }, 150);
    switch (spec.p) {
      case 'none': note('This one has no weapon at all.'); return;
      case 'energy': energy(from, to, spec.n || 1, true); return;
      case 'orb': orbs(from, to, spec.n || 1, !R.isMachine(u || unit())); return;
      case 'orbbig': orbs(from, to, spec.n || 1, false, true); return;
      case 'spit': case 'spitbig':
        spit(from, to, spec.n || 1, spec.p === 'spitbig');
        setTimeout(function () { landing(to, spec.p === 'spitbig' ? 5 : 3); start(); }, spec.p === 'spitbig' ? 760 : 560);
        return;
      case 'shell': case 'shellbig': {
        var big = spec.p === 'shellbig';
        var rounds = spec.n || 1;
        for (var sh = 0; sh < rounds; sh++) {
          (function (j) {
            setTimeout(function () {
              if (SFX) SFX.shell();
              FX.add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: from.mz, dur: big ? 320 : 260, big: true });
              FX.add({ kind: 'bolt', from: from, to: to, dur: big ? 340 : 300, heavy: big });
              setTimeout(function () { landing(to, big ? 7 : 5, big); start(); }, big ? 340 : 300);
              start();
            }, j * 230);
          })(sh);
        }
        return;
      }
      case 'arc': case 'arcbig': {
        var heavy = spec.p === 'arcbig';
        var flight = heavy ? 900 : 760;
        for (var q = 0; q < (spec.n || 1); q++) {
          (function (i) {
            setTimeout(function () {
              if (SFX) SFX.launch();
              FX.add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: from.mz, dur: 220, big: true });
              var aim = (spec.n || 1) > 1
                ? { x: to.x + (i - ((spec.n || 1) - 1) / 2) * 1.6, y: to.y + (i % 2 ? 1 : -1) * 0.9 }
                : to;
              FX.add({ kind: 'lob', from: from, to: aim, dur: flight, heavy: heavy });
              if (SFX) SFX.incoming(flight / 1000 - 0.45, 0.45);
              setTimeout(function () { landing(aim, heavy ? 7 : 6, heavy); start(); }, flight);
              start();
            }, i * 130);
          })(q);
        }
        return;
      }
      case 'missile': {
        for (var mi2 = 0; mi2 < (spec.n || 1); mi2++) {
          (function (j) {
            setTimeout(function () {
              if (SFX) SFX.missile(0, 0.9, 0.47);
              FX.add({ kind: 'missile', from: from, to: to, seed: j, dur: 900, curve: flightCurve(from, to) });
              setTimeout(function () { landing(to, 6, true); start(); }, 900);
              start();
            }, j * 260);
          })(mi2);
        }
        return;
      }
      case 'rocket': {
        if (SFX) SFX.rocket(3);
        for (var r = 0; r < 5; r++) {
          (function (i) {
            setTimeout(function () {
              FX.add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: from.mz, dur: 180, big: true });
              FX.add({ kind: 'missile', from: from, to: to, rocket: true, seed: i, dur: 420 });
              setTimeout(function () { if (i === 4) landing(to, 6, true); start(); }, 420);
              start();
            }, i * 78);
          })(r);
        }
        return;
      }
      case 'flame':
        flameJets(from, to, 6, function () { landing(to, 5, true); });
        return;
      case 'rail': {
        // one line for a marksman's rifle, three in quick succession for a cannon
        var shots = spec.n || 1;
        for (var rs = 0; rs < shots; rs++) {
          (function (j) {
            setTimeout(function () {
              if (SFX) SFX.rail();
              FX.add({ kind: 'rail', from: from, to: to, rgb: shotRGB(), dur: 380 });
              if (j === shots - 1) setTimeout(function () { landing(to, 4); start(); }, 90);
              start();
            }, j * 170);
          })(rs);
        }
        return;
      }
      default:
        stream(spec.p, from, to);
        setTimeout(function () { landing(to, 4); start(); }, 330);
    }
  }

  var STYLE_NOTE = {
    small: 'a rifle line: aimed shots, ragged, a second of them',
    pistol: 'a sidearm: a few deliberate single shots',
    smg: 'a carbine, close in — quicker and lighter than a rifle',
    burst: 'a machine gun, rattling',
    chain: 'an autocannon: heavier, slower, countable',
    shell: 'a direct projectile, flat and fast',
    shellbig: 'a large direct projectile',
    arc: 'a lobbed projectile, up and over',
    arcbig: 'a large lobbed projectile',
    missile: 'a guided missile — out of the tube cold and level, then it lights at the top of its climb and comes down on the mark',
    rocket: 'unguided rockets, off the rails in a ripple',
    flame: 'a cone of fire; nothing flies, the ground burns',
    rail: 'a Gauss weapon: an instant white line that fades',
    spit: 'a bug\'s acid: a wet glob lobbed low, splashing green',
    spitbig: 'a sac of bio-plasma, glowing, bigger and slower',
    spine: 'a volley of chitin spines, dry and fast',
    energy: 'pulses of light in the army\'s colour',
    orb: 'a plasma orb — lobbed from a craft or turret, teleported onto the mark from a Gamma launcher',
    orbbig: 'an energy howitzer — heavy orbs lobbed over, bursting in blue fire on the ground',
    none: 'no weapon'
  };
  function describe(spec, u) {
    var s = STYLE_NOTE[spec.p] || spec.p;
    if (spec.n > 1) s += ' — ' + spec.n + ' tubes at once';
    if (spec.s) s += ', with ' + (STYLE_NOTE[spec.s] || spec.s) + ' alongside';
    return u.name + ': ' + s + '.';
  }


  /* ---------- the panels ---------- */
  function drawPicker() {
    var groups = {};
    R.CATALOGUE.forEach(function (p) {
      var f = (R.FACTIONS[p.faction] || R.FACTIONS.pmc).name;
      (groups[f + ' · ' + p.group] = groups[f + ' · ' + p.group] || []).push(p);
    });
    var h = '';
    Object.keys(groups).forEach(function (k) {
      h += '<h4>' + esc(k) + '</h4>';
      groups[k].forEach(function (p) {
        var w = R.weaponSpec(p);
        h += '<button class="vu' + (p.key === view.key ? ' on' : '') +
          '" data-unit="' + p.key + '">' +
          '<span class="vu-code">' + esc(p.code) + '</span>' +
          '<span class="vu-name">' + esc(p.name) + '</span>' +
          '<span class="vu-w">' + esc(w.p + (w.s ? '+' + w.s : '') + (w.n > 1 ? ' ×' + w.n : '')) + '</span>' +
          '</button>';
      });
    });
    el('vlist').innerHTML = h;
  }

  function drawControls() {
    var p = profile(), w = R.weaponSpec(p);
    var isVeh = p.cls === 'vehicle';
    var maxModels = p.cls === 'infantry' ? p.size : 1;
    var h = '<div class="vrow"><b>' + esc(p.name) + '</b>' +
      '<span class="vtier">Tier ' + R.ROMAN[p.tier] + ' · ' + esc(p.group) + '</span></div>';
    h += '<p class="vweap">' + esc(describe(w, p)) + '</p>';

    h += '<div class="vgrp"><label>Colours — ' + esc(I.COLOURS[view.colour[view.side]].name) + '</label>' +
      '<div class="vsw">' + swatches(view.colour[view.side]) + '</div></div>';
    h += '<div class="vgrp"><label>State</label><div class="vseg">' +
      seg('status', statesFor(p), view.status) + '</div></div>';
    if (isVeh) {
      h += '<div class="vgrp"><label>Propulsion</label><div class="vseg">' +
        seg('prop', R.PROP_ORDER, view.prop) + '</div></div>';
    }
    if (R.isMachine(p)) {
      h += '<div class="vgrp"><label>Facing</label><div class="vseg">' +
        seg('face', FACES, view.face || 'SE') + '</div></div>';
    }
    if (maxModels > 1) {
      var n = view.models == null ? p.size : view.models;
      h += '<div class="vgrp"><label>Models — ' + n + ' of ' + p.size + '</label>' +
        '<input type="range" id="vmodels" min="1" max="' + p.size + '" value="' + n + '"></div>';
    }
    h += '<div class="vacts">' +
      '<button class="vbtn primary" data-do="fire">Fire</button>' +
      '<button class="vbtn" data-do="walk">' + (view.walking ? 'Stop' : 'Walk') + '</button>' +
      '<button class="vbtn" data-do="insert">Insert</button>' +
      (canStrafe() ? '<button class="vbtn" data-do="strafe">Strafe</button>' : '') +
      '<button class="vbtn" data-do="sound">Sound ' + (view.sound ? 'on' : 'off') + '</button>' +
      '</div>';
    h += '<div class="vacts"><button class="vbtn" data-do="allstyles">Play every weapon style</button></div>';
    h += rulesHtml(p);
    el('vctl').innerHTML = h;
  }
  function swatches(now) {
    return I.COLOUR_KEYS.map(function (k) {
      var c = I.COLOURS[k];
      return '<button class="' + (k === now ? 'on' : '') + '" data-colour="' + k + '" title="' + esc(c.name) + '">' +
        '<span style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' + c.mid + ' 38% 74%,' +
        c.dark + ' 74%)"></span></button>';
    }).join('');
  }

  /* The whole profile as the book prints it — the statistics, then every
     special rule with what it does. The rule's text is written out in full and
     also sits on its name as a tooltip, the way the game shows it on a card. */
  var FACTION_NAME = { pmc: 'PMC', rebel: 'Rebels', bugs: 'Space Bugs', xeno: 'Xenotripods' };
  function rulesHtml(p) {
    var mach = R.isMachine(p);
    var cols = [['Tier', R.ROMAN[p.tier]], ['Size', p.size], ['Move', p.move + '"'],
      ['FP', p.fp === null ? '—' : p.fp], ['Range', p.range ? p.range + '"' : '—'],
      ['Def', p.def + (p.defPierced ? '/' + p.defPierced : '')], ['Asslt', p.assault],
      mach ? ['Str', p.str] : ['Mor', p.morale]];
    if (p.turn != null) cols.push(['Turn', p.turn]);
    var h = '<div class="vrules"><label>' + esc(FACTION_NAME[p.faction || 'pmc'] || '') + ' · ' +
      esc(p.group) + ' · ' + esc(p.code) + '</label>';
    h += '<table class="vtable"><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') +
      '</tr><tr>' + cols.map(function (c) { return '<td>' + esc(c[1]) + '</td>'; }).join('') + '</tr></table>';
    var TXT = root.PMCRuleText;
    if (!p.rules.length) h += '<p class="vrule">No special rules.</p>';
    p.rules.forEach(function (r) {
      var d = TXT ? TXT.describe(r) : { name: r, text: '' };
      var tip = d.text && root.PMCTips ? ' ' + root.PMCTips.attr(d.name, d.text) : '';
      h += '<div class="vrule"><b' + tip + '>' + esc(d.name) + '</b>' +
        (d.text ? '<p>' + esc(d.text) + '</p>' : '') + '</div>';
    });
    return h + '</div>';
  }

  /* The states a unit can be shown in. A machine is never suppressed or
     broken: it is whole, damaged (half its Structure gone, and smoking) or a
     wreck. A squad is steady, suppressed, broken or every model down. */
  function statesFor(p) {
    return R.isMachine(p) ? ['ready', 'damaged', 'destroyed'] : ['ready', 'suppressed', 'broken', 'destroyed'];
  }
  function setStatus(s) {
    if (statesFor(profile()).indexOf(s) < 0) s = 'ready';
    var was = view.status;
    view.status = s;
    if (s === 'destroyed' && was !== 'destroyed') {
      // the dead stand still: whatever it was doing stops
      view.walking = false; view.walkFrame = 0; view.hop = 0; view.arc = 0;
      view.strafeAt = 0; view.at = null; view.arriveAt = 0;
      FX.clear();
      note(R.isMachine(unit()) ? 'Destroyed: the hull burns where it stopped.'
        : 'Destroyed: every model in the squad is down.');
    } else if (s === 'damaged') note('Damaged: half its Structure gone, and trailing smoke.');
    else if (was === 'destroyed' || was === 'damaged') note('');
    drawControls(); drawState(); start(); frame();
  }
  function seg(name, opts, now) {
    return opts.map(function (o) {
      return '<button class="vsg' + (o === now ? ' on' : '') + '" data-set="' + name +
        '" data-val="' + o + '">' + esc(o) + '</button>';
    }).join('');
  }

  function drawState() {
    var u = unit();
    if (view.status === 'destroyed') {
      el('vstate').textContent = R.isMachine(u) ? 'destroyed — the hull is burning'
        : u.size + ' of ' + u.size + ' models down';
      return;
    }
    el('vstate').textContent = R.isMachine(u)
      ? u.damage + ' of ' + u.str + ' Structure gone'
      : u.models + '/' + u.size + ' models · ' + u.sp + ' SP · ' + R.status(u);
    if (view.dpr && window.matchMedia && window.matchMedia('(max-width: 1000px)').matches) {
      el('vstate').textContent += ' · tap to fire';
    }
  }
  function note(t) { el('vnote').textContent = t; }

  /* Walk every style in turn, so the whole set can be compared in one go. */
  function allStyles() {
    showWide();
    var order = ['pistol', 'small', 'smg', 'burst', 'chain', 'shell', 'shellbig',
      'arc', 'arcbig', 'missile', 'rocket', 'flame', 'rail', 'spit', 'spitbig', 'spine', 'energy', 'orb', 'orbbig'];
    var i = 0;
    (function next() {
      if (i >= order.length) { note('That is all of them.'); return; }
      var st = order[i++];
      FX.clear();
      note(st + ' — ' + (STYLE_NOTE[st] || ''));
      play({ p: st, n: st === 'arc' ? 2 : 1 }, FROM, TO, 3, { name: st });
      start();
      setTimeout(next, 1500);
    })();
  }

  /* ---------- wiring ---------- */
  function mount() {
    cv = el('vboard');
    if (!cv) return;
    g = cv.getContext('2d');
    FX = root.PMCFx.create({ lift: function () { return 0; } });
    I.setSideColour('A', view.colour.A);
    I.setSideColour('B', view.colour.B);
    fit();
    drawPicker();
    drawControls();
    drawState();
    fit();                 // again, now the footer has its text and the panels their size
    frame();

    // tap the stage to fire: on a phone the buttons are further down the page
    /* Tap the stage to fire; a pinch (or the wheel, or − / +) zooms, and a
       pinch is never taken for a tap. */
    var pts = {}, pinch = null, pinched = 0;
    cv.addEventListener('click', function () { if (Date.now() - pinched < 400) return; fire(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      setZoom(view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    }, { passive: false });
    cv.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b2 = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b2.x, a.y - b2.y) || 1, z: view.zoom };
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (pinch && ids.length === 2) {
        var a = pts[ids[0]], b2 = pts[ids[1]];
        setZoom(pinch.z * Math.hypot(a.x - b2.x, a.y - b2.y) / pinch.d);
        pinched = Date.now();
      }
    });
    function lift(e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; }
    cv.addEventListener('pointerup', lift);
    cv.addEventListener('pointercancel', lift);
    el('vzoom').addEventListener('click', function (e) {
      var zb = e.target.closest('[data-vzoom]');
      if (!zb) return;
      var how = zb.getAttribute('data-vzoom');
      setZoom(how === 'in' ? view.zoom * 1.35 : how === 'out' ? view.zoom / 1.35 : how === 'wide' ? 1 : ZOOM_CLOSE);
    });
    zoomLabel();
    el('vlist').addEventListener('click', function (e) {
      var b = e.target.closest('[data-unit]');
      if (!b) return;
      view.key = b.getAttribute('data-unit');
      view.models = null;
      // a state the new unit cannot be in (a tank cannot be suppressed) goes back to ready
      if (statesFor(profile()).indexOf(view.status) < 0 || view.status === 'destroyed') view.status = 'ready';
      var p = profile();
      if (p.cls !== 'vehicle') view.prop = 'tracked';
      FX.clear();
      drawPicker(); drawControls(); drawState(); frame();
      note('');
      // on a phone the list is below the stage: go back up to see the unit
      if (window.matchMedia && window.matchMedia('(max-width: 1000px)').matches) {
        // the page itself does not scroll on a phone: the panel under the stage does
        var sc = document.querySelector('main');
        if (sc && sc.scrollTo) sc.scrollTo({ top: 0, behavior: 'smooth' });
      } else b.scrollIntoView({ block: 'nearest' });
    });

    el('vctl').addEventListener('click', function (e) {
      var sw = e.target.closest('[data-colour]');
      if (sw) {
        view.colour[view.side] = sw.getAttribute('data-colour');
        I.setSideColour(view.side, view.colour[view.side]);
        // the target keeps a colour of its own, so the two never look alike
        var foe = view.side === 'A' ? 'B' : 'A';
        if (view.colour[foe] === view.colour[view.side]) {
          view.colour[foe] = I.COLOUR_KEYS.filter(function (k) { return k !== view.colour[view.side]; })[0];
          I.setSideColour(foe, view.colour[foe]);
        }
        drawControls(); frame(); return;
      }
      var s = e.target.closest('[data-set]');
      if (s) {
        if (s.getAttribute('data-set') === 'status') { setStatus(s.getAttribute('data-val')); return; }
        view[s.getAttribute('data-set')] = s.getAttribute('data-val');
        drawControls(); drawState(); frame(); return;
      }
      var d = e.target.closest('[data-do]');
      if (!d) return;
      var act = d.getAttribute('data-do');
      if (act === 'fire') fire();
      else if (act === 'walk') toggleWalk();
      else if (act === 'insert') insert();
      else if (act === 'strafe') strafe();
      else if (act === 'allstyles') allStyles();
      else if (act === 'sound') {
        view.sound = !view.sound;
        if (SFX) SFX.setEnabled(view.sound);
        drawControls();
      }
    });
    el('vctl').addEventListener('input', function (e) {
      if (e.target.id === 'vmodels') {
        view.models = +e.target.value;
        drawControls(); drawState(); frame();
      }
    });

    el('vsearch').addEventListener('input', function () {
      var q = el('vsearch').value.toLowerCase();
      el('vlist').querySelectorAll('.vu').forEach(function (b) {
        var hit = b.textContent.toLowerCase().indexOf(q) >= 0;
        b.style.display = hit ? '' : 'none';
      });
      el('vlist').querySelectorAll('h4').forEach(function (hd) {
        var any = false, n = hd.nextElementSibling;
        while (n && n.tagName !== 'H4') { if (n.style.display !== 'none') any = true; n = n.nextElementSibling; }
        hd.style.display = any ? '' : 'none';
      });
    });

    window.addEventListener('resize', function () { fit(); frame(); });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'f' || e.key === 'F') { fire(); e.preventDefault(); }
      if (e.key === 'w' || e.key === 'W') { toggleWalk(); e.preventDefault(); }
      if (e.key === 'i' || e.key === 'I') { insert(); e.preventDefault(); }
      if (e.key === 's' || e.key === 'S') { if (canStrafe()) strafe(); e.preventDefault(); }
      if (e.key === '+' || e.key === '=') { setZoom(view.zoom * 1.35); e.preventDefault(); }
      if (e.key === '-' || e.key === '_') { setZoom(view.zoom / 1.35); e.preventDefault(); }
    });
  }

  function fit() {
    var box = cv.parentElement.getBoundingClientRect();
    /* On a phone the canvas is drawn at the screen's own pixel density, and
       stretched back to the box by CSS, so the pixel art stays sharp. */
    var narrow = box.width < 1000;
    var dpr = narrow ? Math.min(3, window.devicePixelRatio || 1) : 1;
    /* The canvas is drawn at the size it is shown at, all the stage bar the
       footer. Left to CSS, flex stretched a canvas drawn half as tall as it
       was wide to the stage's whole height, and every figure came out tall. */
    /* The footer is measured with its line of text in it: fit() first runs
       before the state is written, when an empty footer is only its padding,
       and a canvas sized to that pushed the footer out of a fixed-height stage. */
    var foot = Math.max(28, el('vstate') ? el('vstate').parentElement.offsetHeight : 30);
    var cw = Math.max(260, Math.round(box.width - 2));
    var ch = Math.max(narrow ? 200 : 280, Math.round(box.height - foot - 2));
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    view.dpr = dpr;
  }

  /* test hooks: the harness drives the bench the way a player would */
  root.__viewer = {
    pick: function (k) {
      view.key = k; view.models = null;
      if (statesFor(profile()).indexOf(view.status) < 0 || view.status === 'destroyed') view.status = 'ready';
      drawPicker(); drawControls(); drawState(); frame();
    },
    zoom: function (z) { if (z != null) setZoom(z); return { zoom: view.zoom, cur: view.zCur, wide: view.wide }; },
    set: function (k, v) {
      if (k === 'status') { setStatus(v); return; }
      view[k] = v; drawControls(); drawState(); frame();
    },
    states: function () { return statesFor(profile()); },
    fire: fire,
    walk: toggleWalk,
    gait: function () { return gaitOf(unit()); },
    insert: insert,
    strafe: strafe,
    destroy: function (on) { setStatus(on === false ? 'ready' : 'destroyed'); },
    strafing: function () { return !!view.strafeAt; },
    arriving: arriving,
    fx: function () { return FX.kinds(); },
    state: function () { return Object.assign({}, view); },
    spec: function () { return R.weaponSpec(unit()); },
    unit: unit
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
