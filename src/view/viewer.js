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
  var MOTION = root.PMCMotion;   // how things move: the battle's own gait, burrow, flight and arrival (motion.js)
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

  var cv, g, FX, STANDING;
  // the stage opens close on the unit; it pulls out to the whole firing line to show a shot
  // the stage's zooms: the whole firing line, the unit, and a close look at it
  var ZOOMS = [1, 3, 4.5], ZOOM_CLOSE = 3;
  var view = {
    zoom: ZOOM_CLOSE, zCur: ZOOM_CLOSE, wide: false,
    key: 'regular', prop: 'none', side: 'A', status: 'ready',
    models: null, walking: false, walkT: 0, at: null, facing: 0, face: 'SE',
    sound: true,
    // each side's paint, from every colour an army can take
    colour: { A: 'ochre', B: 'steel' }
  };
  var loop = null, last = 0;

  function profile() { return R.profile(view.key) || R.profile('regular'); }

  /* Put a unit on the stage: every model, a state it can be in (a tank cannot
     be suppressed), and a ground vehicle on the running gear it usually has. */
  // each army's own colour, put on when the viewer turns to one of its units
  var ARMY_COLOUR = { pmc: 'ochre', rebel: 'crimson', bugs: 'olive', xeno: 'steel' };
  function choose(k) {
    var wasFac = view.pickFac;
    view.key = k; view.models = null; view.tele = null; view.abNext = 0;
    view.ride = 'foot';                       // a new unit starts on foot, its upgrade a tap away
    var p = profile();
    view.pickFac = p.faction || 'pmc';
    // a different army wears its own colour; a colour picked for this one stays while browsing it
    if (view.pickFac !== wasFac && ARMY_COLOUR[view.pickFac]) paint('A', ARMY_COLOUR[view.pickFac]);
    if (statesFor(p).indexOf(view.status) < 0 || view.status === 'destroyed') view.status = 'ready';
    // an Overgrown Bug or a Xenotripod hull has no drive: its stats stand as printed
    view.prop = R.defaultDrive(p);
  }

  /* The unit as the battle would build it: a profile plus the state the bench
     is asking to see. Everything that draws a unit takes one of these. */
  // a crew-served piece drawn in 3D: it has a facing to choose, as a machine does
  function turns(p) { return !!p && !!I.turnsLikeMachine && I.turnsLikeMachine(p.art); }
  // what a Lifter can be shown carrying: any of the rebels' ground vehicles (p. 94)
  var SLUNG = ['rtechnical', 'rlicv', 'ricv', 'rhicv', 'rltv', 'ritv', 'rshtv', 'rlflak', 'rmflak', 'rhflak'];
  function stationary(p) { return !!p && (p.rules || []).indexOf('Stationary Artillery') >= 0; }
  /* On tow: the piece hitched behind a technical, which is what is drawn in its place. */
  function towing(u) {
    var tp = R.profile('rtechnical');
    if (!tp) return null;
    var t = Object.assign({}, tp, {
      id: 'VTOW', side: u.side, paint: u.paint, rules: tp.rules.slice(), alive: true, damage: 0, sp: 0,
      x: u.x, y: u.y, facing: faceAngle(view.face), cargo: [u]
    });
    if (R.propsFor(tp).length) R.applyPropulsion(t, R.defaultDrive(tp));
    return t;
  }
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
      faceL: view.faceL,
      ringUntil: view.ringUntil || 0                  // a teleport craft's gate, while it is sending
    });
    if (R.propsFor(p).length) R.applyPropulsion(u, view.prop);
    R.applyDrone(u, view.drone === 'drone' && R.canBeDrone(p));
    // Stationary Artillery (p. 94): dug in behind its sandbags, or not
    if (stationary(p)) u.dugIn = view.stance === 'dug';
    // a Lifter carrying: the rebels' technical, slung under it
    if ((p.rules || []).indexOf('Lifter') >= 0 && view.sling && view.sling !== 'none') {
      var tp = R.profile(SLUNG.indexOf(view.sling) >= 0 ? view.sling : 'rtechnical');
      if (tp) {
        var t = Object.assign({}, tp, { id: 'VSLG', side: u.side, paint: u.paint, rules: tp.rules.slice(), alive: true, damage: 0, sp: 0, cargo: [], aboard: u.id });
        if (R.propsFor(tp).length) R.applyPropulsion(t, view.slingProp || 'wheeled');
        u.cargo = [t];
      }
    }
    // a crew-served piece stays laid on the mark it last fired at, until it is turned
    if (turns(p) && view.stance !== 'towed' && !view.walking && view.gunAim != null && view.aimFor === view.face + '|gun') u.aim = view.gunAim;
    if (turns(p) && view.turn && Date.now() - view.turn.t0 < view.turn.d1 + view.turn.d2) u._turn = view.turn;   // swinging onto the mark
    /* The Riders upgrade (p. 93): Holy Warriors and the First Among Equals may
       ride — half the models, mounted. Anyone riding is on the mount picked. */
    var riding = R.canRide(p) && view.ride === 'mounted';
    if (riding) { R.applyRiders(u, true); if (view.models != null) u.models = Math.min(view.models, u.size); }
    if (R.canMount(p, riding)) u.mount = view.mount || 'none';
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
  // the eight facings, 45° apart on the table as the battle has them (E straight right, S straight down)
  function faceAngle(name) {
    var i = FACES.indexOf(name || 'SE');
    return -Math.PI / 4 + (i < 0 ? 1 : i) * Math.PI / 4;
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
    // a unit that moves by itself (rotors, scanners, a deflector, a cloak, a brain) keeps the bench running
    if (!loop && I.animates(unit()) && view.status !== 'destroyed') start();
    var w = cv.width, h = cv.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0c1014';
    g.fillRect(0, 0, w, h);

    // centre the patch of ground in the canvas
    /* On a narrow screen the whole firing line — shooter, gap and mark — is
       scaled down to fit, rather than cut off at the sides. */
    var a0 = toScreen(FROM.x - 1.2, FROM.y + 1.2), a1 = toScreen(TO.x + 1.2, TO.y - 1.2);
    var span = Math.abs(a1.x - a0.x) + I.K;
    var zWide = Math.min(view.dpr || 1, w / span, h / (I.K * 6.5));
    /* Zoomed in, the camera closes on the unit wherever it stands (walking
       included) so the figures can be seen up close; at 1 it is the whole
       firing line. In between it slides from one framing to the other. */
    var zc = view.zCur || 1, z = zWide * zc;
    // wide, the middle of the line between the two units; any closer, the unit itself (a flier up where it flies)
    var mid = toScreen((FROM.x + TO.x) / 2, (FROM.y + TO.y) / 2);
    var at = view.at || FROM, f = toScreen(at.x, at.y), up = I.flyLift(unit()) * 0.6;
    var k = Math.max(0, Math.min(1, zc - 1));
    var px = mid.x + (f.x - mid.x) * k, py = (mid.y - I.K * 1.2) + ((f.y - I.K * 0.8 - up) - (mid.y - I.K * 1.2)) * k;
    g.setTransform(z, 0, 0, z, Math.round(w / 2 - px * z), Math.round(h / 2 - py * z));

    drawGround();
    var u = unit(), t = mark();
    var arr = arriving();
    // a burrowing bug part way into or out of the ground, or under it
    if (view.walking && view.burrow && !arr.hidden) arr = Object.assign({}, arr, view.burrow);
    // far to near, so the nearer of the two covers the other
    var tv = traveller();
    FX.drawGround(g);                                    // the ground broken open under what comes up through it
    var order = [u, t].concat(tv ? [tv.u, tv.pad] : []).sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    order.forEach(function (m) {
      if (tv && (m === tv.u || m === tv.pad)) {
        var ma = m === tv.pad ? tv.padAlpha : tv.alpha;
        if (ma <= 0) return;
        g.save(); g.globalAlpha = ma;
        I.drawUnit(g, m, { at: { x: m.x, y: m.y }, lift: 0, status: 'ready', morale: R.isMachine(m) ? 0 : R.currentMorale(m) });
        g.restore();
        return;
      }
      if (m === u && view.status === 'destroyed') { drawDestroyed(u); return; }
      // a gun on tow is drawn hitched behind the technical towing it
      if (m === u && stationary(u) && view.stance === 'towed') {
        var tw = towing(u);
        if (tw) { I.drawUnit(g, tw, { at: { x: u.x, y: u.y }, lift: 0, status: 'ready', morale: 0 }); return; }
      }
      if (m === u && arr.hidden) return;                 // not on the field yet
      var fading = m === u && arr.alpha != null;          // teleporting in
      if (fading) { g.save(); g.globalAlpha = arr.alpha; }
      I.drawUnit(g, m, {
        at: { x: m.x, y: m.y }, lift: m === u ? arr.lift : 0,
        hop: m === u ? (view.hop || 0) : 0,
        walk: m === u ? view.walkFrame : 0,
        arc: m === u && view.walking ? (view.arc || 0) : 0,
        status: m === u && !R.isMachine(m) ? view.status : 'ready',
        // getting up as it arrives is a pose, not a state
        pose: m === u && !R.isMachine(m) && arr.pose || undefined,
        morale: R.isMachine(m) ? 0 : R.currentMorale(m)
      });
      if (fading) g.restore();
    });
    // a shield generator's dome is always up, as it is in the battle, while the unit is on the field
    STANDING.clear();
    if (shielded(u) && !arr.hidden) STANDING.add({ kind: 'dome', x: u.x, y: u.y, r: 12, steady: true, a: 0.4, dur: 1e9 });
    STANDING.draw(g);
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
    // a gun crew leaves its gun, knocked out, as the last of its fallen
    if (I.hasPiece && I.hasPiece(u.art)) I.drawBody(g, p.x, p.y, { piece: true, side: u.side, paint: u.paint || null, art: u.art, key: u.key, aim: u.facing, flip: !!u.faceL });
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
    if (view.tele) { busy = true; acting = true; }       // a squad teleporting by the gate
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
    // and a shield's band of light keeps turning
    if (shielded(unit())) busy = true;
    // and a piece swinging onto its mark
    if (view.turn && Date.now() - view.turn.t0 < view.turn.d1 + view.turn.d2) busy = true;
    // an aircraft's rotors turn and its scanners sweep, even hanging still
    if (I.animates(unit()) && view.status !== 'destroyed') busy = true;
    frame();
    if (busy) start(); else last = 0;
  }
  function start() { if (!loop) loop = requestAnimationFrame(tick); }
  function shielded(u) { return view.status !== 'destroyed' && !!R.ruleValue(u, 'Shield Generator'); }

  /* ---------- movement ----------
     The unit walks out to the mark and back at its own Movement in inches a
     second, so a Move 3" hull crawls and a Move 12" one does not.

     The same gait the battle uses (game.js: pace/gaitOf). A footfall happens
     every so many inches covered, not every so many milliseconds, so a fast
     unit puts its legs down faster rather than sliding. The body is up between
     footfalls and down on each one. */
  var gaitOf = MOTION.gaitOf;

  function stepWalk(dt) {
    var u = unit();
    var speed = Math.max(2, (u.move || 5)) * 0.9;          // inches a second
    /* An aircraft crosses the bench at the pace it flies in a battle: the game
       times a flight at 0.7s plus 85ms an inch, to 3.2s at most (game.js
       moveMs), and a full Move is Movement +4" for a machine. */
    if (u.cls === 'aircraft') {
      var full = (u.move || 12) + 4;
      speed = full * 1000 / MOTION.moveMs(u, full);
    }
    view.walkT += (dt / 1000) * speed;
    var span = TO.x - FROM.x - 3;
    var f = (view.walkT % (span * 2)) / span;
    var back = f > 1;
    var d = back ? 2 - f : f;
    view.at = { x: FROM.x + d * span, y: FROM.y };
    view.facing = back ? Math.PI : 0;

    if (burrows(u)) { burrowWalk(u, span); return; }
    if (u.jets) {
      /* Jump troops cross the bench in bounds, one full move at a time: up on
         the jets, over, and down, with the burn flickering all the way. */
      var bound = Math.max(3, u.move || 7), bt = view.walkT / bound, bn = Math.floor(bt);
      view.walkFrame = 1 + (Math.floor(Date.now() / 70) % 2);
      view.hop = 0;
      view.arc = Math.sin((bt - bn) * Math.PI) * MOTION.jetApex(bound);
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
  /* Underground Bugs do not walk the bench: each leg they sink into the ground
     where they stand, go along it unseen under a line of churned earth, and
     heave themselves up at the far end — the move the battle plays (game.js:
     burrowStep). */
  var burrows = MOTION.burrows, B_SINK = MOTION.BURROW_SINK, B_RISE = MOTION.BURROW_RISE;
  function burrowWalk(u, span) {
    var leg = Math.floor(view.walkT / span), k = (view.walkT % span) / span;
    var back = leg % 2 === 1, x0 = back ? FROM.x + span : FROM.x, x1 = back ? FROM.x : FROM.x + span;
    var r = MOTION.burrowR(u), e;
    view.facing = back ? Math.PI : 0;
    view.walkFrame = 0; view.hop = 0; view.arc = 0;
    var phase = k < B_SINK ? 0 : k < B_RISE ? 1 : 2;
    if (leg !== view.burrowLeg || phase !== view.burrowPhase) {
      // the ground falling in as it goes down, and again as it comes up
      if (phase === 0) { FX.add({ kind: 'collapse', x: x0, y: FROM.y, r: r, dur: 700 }); if (view.sound && SFX) { SFX.step(); SFX.step(0.12); SFX.step(0.3); } }
      if (phase === 2) { FX.add({ kind: 'collapse', x: x1, y: FROM.y, r: r, dur: 800 }); if (view.sound && SFX) { SFX.impact(0.05); SFX.step(0.15); } }
      view.burrowLeg = leg; view.burrowPhase = phase;
    }
    if (phase === 0) {
      e = Math.pow(k / B_SINK, 2);
      view.at = { x: x0, y: FROM.y };
      view.burrow = { lift: 0, alpha: Math.max(0, 1 - e) };            // fading out as it goes down
    } else if (phase === 1) {
      var d = (k - B_SINK) / (B_RISE - B_SINK), x = x0 + (x1 - x0) * d;
      view.at = { x: x, y: FROM.y };
      view.burrow = { hidden: true };
      // the ground heaving over it, an inch at a time
      if (Math.floor(x) !== view.burrowDirt) {
        view.burrowDirt = Math.floor(x);
        FX.add({ kind: 'miss', x: x, y: FROM.y, dur: 700 });
        FX.add({ kind: 'miss', x: x + (Math.random() - 0.5) * 1.2, y: FROM.y + (Math.random() - 0.5) * 1.2, dur: 900 });
        if (view.sound && SFX && view.burrowDirt % 2 === 0) SFX.step(0.02);
      }
    } else {
      e = 1 - Math.pow(1 - (k - B_RISE) / (1 - B_RISE), 2);
      view.at = { x: x1, y: FROM.y };
      view.burrow = { lift: 0, alpha: Math.min(1, e) };                 // and back in where it comes up
    }
  }
  /* ---------- a strafing run ----------
     What an aircraft does instead of standing still and shooting (engine.js
     offers Strafe to anything of class aircraft): it comes across the bench at
     speed with its guns going, and the ground walks up under it. */
  /* A strafing run takes as long as the game gives the same stretch of table
     (game.js playStrafe: 1.1s plus 140ms an inch, between 1.9s and 4s). The
     bench's run is from 6" short of the start mark to 6" past the target. */
  var STRAFE_MS = MOTION.strafeMs((TO.x + 6) - (FROM.x - 6));
  function canStrafe() { return unit().cls === 'aircraft'; }

  /* A unit's special ability, played on the stage: the first rule it has that
     shows as something — a Psychic Wave rolling out, a hacker's data stream
     into the mark, medics' crosses rising, a Xenotripod shield going up.
     Each is the rule, in the size the rule gives it, in inches. */
  var ABILITIES = [
    { rule: 'Psychic Wave', name: 'Psychic Wave', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 12, dur: 1500 }]; }, sfx: 'wave' },
    { rule: 'Dominant Species', name: 'Regain Control', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 12, rgb: '110,190,255', dur: 1500 }]; }, sfx: 'shimmer' },
    { rule: 'Overmind', name: 'Overmind', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 18, rgb: '150,215,90', dur: 1700 }]; }, sfx: 'chitter' },
    { rule: 'Shield Generator', name: 'Shield', play: function (u) { return [{ kind: 'dome', x: u.x, y: u.y, r: 12, dur: 2200 }]; }, sfx: 'shimmer' },
    { rule: 'Hackers', name: 'Hack', play: function (u) { return [{ kind: 'beam', x: u.x, y: u.y, mz: beamFrom(u), tx: TO.x, ty: TO.y, rgb: '90,255,140', data: true, dur: 1800 }]; }, sfx: 'zap' },
    { rule: 'Jammers', name: 'Jam', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 24, rgb: '200,215,225', dash: true, dur: 1800 }]; }, sfx: 'shimmer' },
    { rule: 'Field Medics', name: 'Medics', play: function (u) { return [{ kind: 'rise', x: u.x, y: u.y, glyph: 'cross', dur: 1800 }]; }, sfx: 'chime' },
    { rule: 'Markerlights', name: 'Mark target', play: function (u) { return [{ kind: 'beam', x: u.x, y: u.y, mz: beamFrom(u), tx: TO.x, ty: TO.y, dur: 1600 }]; }, sfx: 'zap' },
    // a smoke grenade thrown onto the mark, bursting where it lands, the flare burning in it
    { rule: 'Smoke Markers', name: 'Smoke marker', play: function (u) { return [{ kind: 'lob', grenade: true, from: R.isMachine(u) ? I.mountFor(I.mounts(u), R.weaponSpec(u).p, u, { x: u.x, y: u.y }) : { x: u.x, y: u.y }, to: { x: TO.x, y: TO.y }, dur: 750 }, { kind: 'puff', x: TO.x, y: TO.y, delay: 720, dur: 2500 }]; } },
    { rule: 'Keen-Eyed', name: 'Keen-eyed', play: function (u) { return [{ kind: 'glint', x: u.x, y: u.y, mz: glintFrom(u), dur: 800 }, { kind: 'glint', x: TO.x, y: TO.y, up: 0.8, delay: 300, dur: 1100 }]; } },
    { rule: 'Sappers', name: 'Demolition charges', play: function (u) { return [{ kind: 'charges', x: TO.x, y: TO.y, r: 1.5, n: 5, dur: 1600 }, { kind: 'clash', x: TO.x, y: TO.y, delay: 950, dur: 1400 }]; }, sfx: 'boom' },
    { rule: 'Pheromone Markers', name: 'Pheromones', play: function (u) { return [{ kind: 'beam', x: u.x, y: u.y, mz: beamFrom(u), tx: TO.x, ty: TO.y, rgb: '170,230,90', dur: 1600 }]; }, sfx: 'chitter' },
    { rule: 'Teleport', name: 'Teleport', play: function (u) { return teleportThrough(u); }, sfx: 'shimmer' },
    { rule: 'Molecular Reconstruction', name: 'Self-repair', play: function (u) { return [{ kind: 'rise', x: u.x, y: u.y, rgb: '120,220,255', n: 12, dur: 1600 }]; }, sfx: 'shimmer' },
    { rule: 'Psychic Support', name: 'Psychic Support', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 6, dur: 1300 }]; }, sfx: 'wave' },
    /* the leader's shout, and the unit it reaches throwing off its Suppression to charge */
    { rule: 'Death or Glory, Comrades!', name: 'Death or Glory', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 12, rgb: '235,85,70', dur: 1300 }, { kind: 'beam', x: u.x, y: u.y, mz: beamFrom(u), tx: TO.x, ty: TO.y, rgb: '235,85,70', dur: 1100 }, { kind: 'wave', x: TO.x, y: TO.y, up: 0, r: 3, rgb: '235,85,70', delay: 350, dur: 1400 }, { kind: 'rise', x: TO.x, y: TO.y, rgb: '235,85,70', n: 10, delay: 350, dur: 1700 }]; }, sfx: 'clash' },
    { rule: '…but they\'ll never take our freedom!', name: 'Rally cry', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 12, rgb: '240,120,80', dur: 1400 }, { kind: 'rise', x: u.x, y: u.y, rgb: '240,120,80', n: 8, dur: 1400 }]; }, sfx: 'chime' },
    { rule: 'Command Unit', name: 'Command', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 12, rgb: '232,193,90', dur: 1500 }]; }, sfx: 'chime' },
    { rule: 'Command Vehicle', name: 'Command', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 12, rgb: '232,193,90', dur: 1500 }]; }, sfx: 'chime' },
    { rule: 'Inspiring Presence', name: 'Inspire', play: function (u) { return [{ kind: 'wave', x: u.x, y: u.y, r: 6, rgb: '232,193,90', dur: 1300 }]; }, sfx: 'chime' },
    { rule: 'Counter-jamming', name: 'Counter-jam', play: function (u) { return [{ kind: 'dome', x: u.x, y: u.y, r: 6, rgb: '120,200,255', dur: 1800 }]; }, sfx: 'shimmer' }
  ];
  /* Where a beam leaves a machine: a craft's nose, else the first barrel it has.
     A trooper's beam leaves from about chest height (fx.js's default). */
  // a keen eye looks out of a machine's own sensor, and a flier's up where it flies (as in the battle)
  // a squad's laser and glint come off the eyes of its man with optics: the spotter, the observer
  function eyeFrom(u) {
    var e = I.muzzles(u, view.status).filter(function (m) { return m.eye; })[0];
    return e ? e.eye : undefined;
  }
  function glintFrom(u) {
    if (!R.isMachine(u)) return eyeFrom(u);
    var M = I.mounts(u), k = ['scan', 'nose'].filter(function (n) { return M[n] && M[n].length; })[0];
    if (k) return M[k][0];
    return I.flyLift(u) ? { dx: 0, dy: -I.flyLift(u) } : undefined;
  }
  function beamFrom(u) {
    if (!R.isMachine(u)) return eyeFrom(u);
    var M = I.mounts(u), k = ['nose', 'gun', 'mg', 'auto', 'rocket'].filter(function (n) { return M[n] && M[n].length; })[0];
    return k ? M[k][0] : undefined;
  }
  /* Teleport (p. 130), as the battle shows it (game.js): no walk in or out.
     A Teleport turret comes in halfway to the target, the far end of the
     network; a squad standing behind this unit is gone in a ring of light,
     the two ends joined by a pulsing line while it is between, and it
     flickers back in out of the column in front of the turret. The squad
     and the turret are drawn by frame() from view.tele. */
  var TP = { PAD: 700, OUT: 950, GONE: 1350, IN: 1700, SHOWN: 2200, END: 3400, BY: 2.4 };
  function teleportThrough(u) {
    var dx = TO.x - u.x, dy = TO.y - u.y, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    var from = { x: u.x - ux * TP.BY, y: u.y - uy * TP.BY };          // the squad, behind this unit
    var pad = { x: u.x + dx * 0.5, y: u.y + dy * 0.5 };                // the turret it comes out at
    var to = { x: pad.x + ux * TP.BY, y: pad.y + uy * TP.BY };         // ...in front of the turret
    view.tele = { t0: Date.now(), from: from, pad: pad, to: to };
    var rgb = glowRGB();
    // a teleport craft sends from its own gate: the link meets its middle, and the gate runs while it is up
    var src = { x: u.x, y: u.y };
    if (u.cls === 'aircraft') {
      src.up = I.craftCentreUp(u);
      view.ringUntil = (root.performance ? performance.now() : 0) + TP.OUT + TP.SHOWN + 200;
    }
    return [
      // the far turret teleported in first
      { kind: 'teleportin', x: pad.x, y: pad.y, r: 2.2, dur: TP.PAD + 200 },
      // the squad going: a ring of light where it stood
      { kind: 'wave', x: from.x, y: from.y, up: 0, r: 2, rgb: rgb, delay: TP.OUT, dur: TP.OUT + 700 },
      // the two ends joined while it is between them
      { kind: 'tplink', from: src, to: pad, rgb: rgb, delay: TP.OUT, dur: TP.SHOWN },
      // and coming out, in front of the turret
      { kind: 'teleportin', x: to.x, y: to.y, r: 1.4, delay: TP.IN - 250, dur: TP.IN - 250 + 1400 },
      { kind: 'wave', x: to.x, y: to.y, up: 0, r: 2, rgb: rgb, delay: TP.IN, dur: TP.IN + 1050 }
    ];
  }
  // the squad going through, and how much of it is there, and the far turret, or null once it is done
  function traveller() {
    var T = view.tele;
    if (!T) return null;
    var t = Date.now() - T.t0, alpha;
    if (t >= TP.END) { view.tele = null; return null; }
    if (t < TP.OUT) alpha = 1;
    else if (t < TP.GONE) alpha = 1 - (t - TP.OUT) / (TP.GONE - TP.OUT);
    else if (t < TP.IN) alpha = 0;
    else if (t < TP.SHOWN) {
      // flickering back in, as a squad teleporting in does in the battle
      var ta = (t - TP.IN) / (TP.SHOWN - TP.IN);
      alpha = Math.floor(t / 55) % (ta < 0.5 ? 2 : 4) === 0 ? ta * 0.3 : ta;
    } else alpha = 1;
    var at = t < TP.GONE ? T.from : T.to;
    var p = R.profile('xbeta3');
    var m = Object.assign({}, p, {
      id: 'VTELE', side: view.side, label: p.name, models: p.size, rules: p.rules.slice(),
      sp: 0, alive: true, damage: 0, cargo: [], x: at.x, y: at.y, facing: 0
    });
    // the turret: flickering in out of its column, then standing; gone with the rest at the end
    var pa = t < TP.PAD * 0.35 ? 0 : t < TP.PAD ? (Math.floor(t / 55) % 2 ? 0.3 : 1) * (t - TP.PAD * 0.35) / (TP.PAD * 0.65) : 1;
    if (t > TP.END - 300) pa = Math.max(0, (TP.END - t) / 300);
    var q = R.profile('xtturret2');
    var pad = Object.assign({}, q, {
      id: 'VPAD', side: view.side, label: q.name, models: 1, rules: q.rules.slice(),
      sp: 0, alive: true, damage: 0, cargo: [], x: T.pad.x, y: T.pad.y, facing: Math.atan2(T.to.y - T.pad.y, T.to.x - T.pad.x)
    });
    if (t > TP.END - 300) alpha = Math.min(alpha, pa);
    return { u: m, alpha: alpha, pad: pad, padAlpha: pa };
  }
  // every ability a unit has, in that order — an EW team hacks and jams — to a button each, three at most
  function abilitiesOf(u) {
    var rules = (u && u.rules) || [], out = [];
    ABILITIES.forEach(function (a) {
      // every ability the unit has gets a button: a leader has a good many (Rebellion leaders six)
      if (out.some(function (o) { return o.name === a.name; })) return;
      if (rules.some(function (r) { return r === a.rule || r.indexOf(a.rule + ' (') === 0; })) out.push(a);
    });
    return out;
  }
  function ability(i) {
    var u = unit(), a = abilitiesOf(u)[i || 0];
    if (!a || view.status === 'destroyed') return;
    showWide();
    if (view.walking) toggleWalk();
    syncSound();
    a.play(u).forEach(function (f) { FX.add(f); });
    if (SFX && view.sound && SFX[a.sfx]) SFX[a.sfx]();
    start();
  }
  function strafe() {
    showWide();
    if (!canStrafe()) { return; }
    view.walking = false; view.walkFrame = 0; view.hop = 0; view.arc = 0;
    view.strafeAt = Date.now();
    view.facing = 0;
    var fired = 0, guns = 7;
    var hitRGB = R.isXeno(unit()) ? glowRGB() : unit().faction === 'bugs' ? '150,220,80' : null;
    (function burst() {
      if (fired >= guns || !view.strafeAt) return;
      var f = 0.2 + (fired / (guns - 1)) * 0.6;
      var x = FROM.x - 6 + (TO.x + 6 - (FROM.x - 6)) * f;
      FX.add({ kind: 'muzzle', x: x, y: FROM.y, rgb: hitRGB, dur: 180 });
      FX.add({ kind: 'impact', x: x, y: FROM.y, n: 3, rgb: hitRGB, dur: 320 });
      for (var d3 = 0; d3 < 3; d3++) {
        FX.add({
          kind: 'miss', x: x + (Math.random() - 0.5) * 2.4, y: FROM.y + (Math.random() - 0.5) * 2.4,
          rgb: hitRGB, dur: 380 + Math.random() * 220
        });
      }
      if (view.sound && SFX) SFX.strafe(R.isXeno(unit()) ? 'xeno' : unit().faction, R.weaponStyle(unit()));
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
    view.burrow = null; view.burrowLeg = view.burrowPhase = view.burrowDirt = null;
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
  var DROP_MS = MOTION.DROP_MS, STAND_MS = MOTION.STAND_MS, TELE_MS = MOTION.TELE_MS;

  function syncSound() {
    if (!SFX) return;
    if (!view.sound) SFX.setEnabled(false);
    else if (!SFX.enabled()) SFX.setEnabled(true);
  }

  function arriving() {
    if (!view.arriveAt) return { lift: 0, pose: null };
    var age = Date.now() - view.arriveAt;
    // before it arrives the field is empty: the unit is not on the table yet
    if (age < 0) return { lift: 0, pose: null, hidden: true };
    var a = MOTION.arrival(view.arriveKind, age, R.isMachine(unit()));
    if (!a) { view.arriveAt = 0; return { lift: 0, pose: null }; }
    return a;
  }

  /* An arrival starts from an empty field: the unit is taken off the stage
     for a moment first, so it is seen coming in from nowhere rather than
     dropping to the ground from where it stood and getting back up. */
  var CLEAR_MS = 450;
  function insert() {
    var u = unit(), craft = R.isMachine(u) || !!u.jets;
    // a swarm comes up out of the ground, giants and all; only what flies drops from the sky
    if (u.faction === 'bugs') craft = R.isFlying(u) || R.flyInf(u);
    // the Xenotripods teleport in, hulls and craft too; the Esh-Aven come up out of the ground
    var pr = R.profile(u.key), tele = u.faction === 'xeno' && !u.eshAven && !(pr && pr.eshAven);
    if (view.walking) toggleWalk();
    FX.clear();
    syncSound();
    var at = { x: u.x, y: u.y };
    view.arriveAt = Date.now() + CLEAR_MS;
    view.arriveKind = tele ? 'teleport' : craft ? 'drop' : 'stand';
    // the empty moment: nothing on the field, and the frame loop kept turning through it
    FX.add({ kind: 'hold', x: at.x, y: at.y, dur: CLEAR_MS + 50, blocking: true });
    var landing = view.arriveAt;
    setTimeout(function () {
      if (view.arriveAt !== landing) return;          // another arrival or a new unit since
      if (tele) {
        FX.add({ kind: 'teleportin', x: at.x, y: at.y, r: MOTION.teleportR(u), dur: TELE_MS + 200, blocking: true });
        if (SFX && SFX.shimmer) SFX.shimmer();
      } else if (craft) {
        FX.add({ kind: 'dropmark', x: at.x, y: at.y, dur: DROP_MS, blocking: true });
        setTimeout(function () {
          if (view.arriveAt !== landing && view.arriveAt !== 0) return;
          FX.add({ kind: 'collapse', x: at.x, y: at.y, r: 2.4, dur: 700, blocking: true });
          if (SFX) { SFX.impact(); SFX.impact(0.09); }
          start();
        }, DROP_MS - 60);
      } else if (R.isMachine(u)) {
        // the ground breaking open under a giant bug, and the dust thrown up round it
        FX.add({ kind: 'groundbreak', x: at.x, y: at.y, r: 2.4, dur: STAND_MS + 500, blocking: true });
        FX.add({ kind: 'collapse', x: at.x, y: at.y, r: 2.8, dur: STAND_MS, blocking: true });
        if (SFX) { SFX.impact(0.05); SFX.impact(0.18); }
      } else {
        FX.add({ kind: 'collapse', x: at.x, y: at.y, r: 1.6, dur: 600, blocking: true });
        // boots, then the squad on its feet
        if (SFX) { SFX.step(); SFX.step(0.24); SFX.step(0.5); }
      }
      // keep the frame loop turning while the arrival plays out
      FX.add({ kind: 'hold', x: at.x, y: at.y, dur: tele ? TELE_MS : craft ? DROP_MS + 300 : STAND_MS, blocking: true });
      start();
    }, CLEAR_MS);
    start();
  }

  /* ---------- firing ----------
     The same effects the battle plays, driven from the same weapon table. Hits
     are made up here — the bench is about what it looks and sounds like, not
     about the dice. */
  // the stage snaps to one of ZOOMS; Wide and Close step out and in through them
  function setZoom(zz) {
    view.zoom = ZOOMS.reduce(function (a, b) { return Math.abs(b - zz) < Math.abs(a - zz) ? b : a; });
    view.wide = false;
    zoomLabel();
    start();
  }
  function stepZoom(d) {
    var i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(view.zoom) + d));
    if (ZOOMS[i] !== view.zoom) setZoom(ZOOMS[i]);
  }
  function zoomLabel() {
    el('vzoom').querySelectorAll('[data-vzoom]').forEach(function (b) {
      var i = ZOOMS.indexOf(view.zoom);
      b.disabled = b.getAttribute('data-vzoom') === 'close' ? i === ZOOMS.length - 1 : i === 0;
    });
  }
  // pull out to the whole line for the length of a shot
  function showWide() { view.wide = true; view.wideUntil = performance.now() + 900; start(); }
  function onTow() { return stationary(profile()) && view.stance === 'towed'; }
  // dug in, a gun cannot be turned: a mark outside the front 90° cannot be fired on (p. 94)
  function outOfArc() {
    if (!stationary(profile()) || view.stance !== 'dug') return false;
    var u = unit(), f = faceAngle(view.face), b = Math.atan2(TO.y - u.y, TO.x - u.x);
    return Math.abs(R.angleWrap(b - f)) > Math.PI / 4 + 1e-6;
  }
  // the bearing from the unit to the mark, and the facing nearest it
  function bearingToMark(u) { return Math.atan2(TO.y - u.y, TO.x - u.x); }
  function nearestFace(brg) {
    var best = view.face, bd = Infinity;
    FACES.forEach(function (fn) {
      var d = Math.abs(R.angleWrap(brg - faceAngle(fn)));
      if (d < bd) { bd = d; best = fn; }
    });
    return best;
  }
  /* Fire!: a crew-served piece first swings onto the mark — the carriage round
     to the nearest facing (unless dug in), then the gun traversing onto it —
     and only then shoots. */
  function fire() {
    if (view.status === 'destroyed' || onTow() || outOfArc() || view.turning) return;
    var u0 = unit();
    if (turns(u0)) {
      var from = { f: u0.facing, a: u0.aim }, brg = bearingToMark(u0);
      if (!u0.dugIn) view.face = nearestFace(brg);
      view.gunAim = brg; view.aimFor = view.face + '|gun';
      var u1 = unit();
      u1._turnFrom = from;
      var D = I.startTurn(u1);
      if (D > 0) {
        view.turn = u1._turn; view.turning = true;
        drawControls(); showWide(); start();
        setTimeout(function () { view.turning = false; fireNow(); }, D + 40);
        return;
      }
    }
    fireNow();
  }
  function fireNow() {
    if (view.status === 'destroyed' || onTow() || outOfArc()) return;
    showWide();
    var u = unit(), spec = R.weaponSpec(u);
    // a flier shoots from its airframe, not from the grass under it
    var from = { x: u.x, y: u.y, up: I.flyLift(u) }, to = { x: TO.x, y: TO.y };
    // troopers turn to the mark, and every round leaves one of their own barrels
    /* A piece lays its weapon on the mark, traversed like a turret; its mount
       turns to the nearest facing first — unless it is dug in, which cannot be
       turned (p. 94), and traverses only within its front arc. */
    if (turns(u)) {
      var brg = bearingToMark(u);
      if (!u.dugIn) {
        var best = nearestFace(brg);
        if (best !== view.face) { view.face = best; drawControls(); }
        u.facing = faceAngle(view.face);
      }
      u.aim = view.gunAim = brg;
      view.aimFor = view.face + '|gun';
    }
    if (!R.isMachine(u)) {
      var a0 = I.toScreen(u.x, u.y), b0 = I.toScreen(TO.x, TO.y);
      u.faceL = view.faceL = b0.x < a0.x;
      root.PMCFire.troop(from, spec, I.muzzles(u, view.status));
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
    from.second = from.poolFor ? from.poolFor(spec.s) : mountFrom(spec.s);
    var hits = 3;
    syncSound();
    play(spec, from, to, hits, u);
    start();
  }

  /* The shots themselves are fire.js's, the battle's own: the same cadence,
     the same flight and the same landing for every weapon, with three hits
     scored so there is something to see land. Nothing is resolved here. */
  var SHOTS = root.PMCFire.make({ add: function (f) { FX.add(f); start(); }, redraw: start });
  function glowRGB() { return root.PMCFire.XENO_BLUE; }
  function play(spec, from, to, hits, u) {
    var dist = R.unitDist(u, to);
    if (spec.s) setTimeout(function () { SHOTS.secondary(spec.s, u, from.second || from, to, hits, spec.sn); start(); }, 150);
    SHOTS.primary(spec, u, from, to, { hits: hits, dist: dist, land: function (extra) { SHOTS.hit(u, to, hits, extra); } });
  }



  /* ---------- the panels ---------- */
  // a side's colour; the other side keeps one of its own, so the two never look alike
  function paint(side, k) {
    view.colour[side] = k;
    I.setSideColour(side, k);
    var foe = side === 'A' ? 'B' : 'A';
    if (view.colour[foe] === k) {
      view.colour[foe] = I.COLOUR_KEYS.filter(function (c) { return c !== k; })[0];
      I.setSideColour(foe, view.colour[foe]);
    }
    // the unit list's cards are drawn in the first side's colour
    if (side === 'A' && picker) picker.setColour(k);
  }

  function phone() { return !!(window.matchMedia && window.matchMedia('(max-width: 1000px)').matches); }
  // the phone's unit sidebar, opened from the header and closed by a pick, the ×, the scrim or Escape
  function showSide(open) {
    document.body.classList.toggle('vside-open', !!open);
    el('vunits').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var on = el('vlist').querySelector('.unit.on');
      if (on) on.scrollIntoView({ block: 'center' });
    }
  }
  /* The list has a tab for each army; a search looks through all four. The
     open tab follows the unit on the stage until another is chosen. */
  var FAC_TABS = [['pmc', 'PMC'], ['rebel', 'Rebels'], ['bugs', 'Bugs'], ['xeno', 'Xeno']];
  /* The unit list is itself an atlas: a card for each unit, drawn by the
     game's renderer, grouped the way the book groups them, one army to a tab.
     A search looks through all four armies at once. Picking a card puts the
     unit on the stage. */
  var picker = null, pickerShown;
  function pickerFaction() { return el('vsearch').value.trim() ? null : (view.pickFac || 'pmc'); }
  function drawPicker() {
    if (!view.pickFac) view.pickFac = profile().faction || 'pmc';
    el('vfacs').innerHTML = FAC_TABS.map(function (t) {
      var on = t[0] === view.pickFac;
      return '<button type="button" role="tab" data-fac="' + t[0] + '" aria-selected="' + on + '"' +
        (on ? ' class="on"' : '') + '>' + t[1] + '</button>';
    }).join('');
    el('vfacs').classList.toggle('searching', !!el('vsearch').value.trim());
    var want = pickerFaction();
    if (!picker) {
      picker = root.PMCAtlas.mount({
        main: el('vlist'), scroller: el('vside').querySelector('.vlistscroll'), search: el('vsearch'),
        faction: pickerFaction, colour: view.colour.A, prefix: 'vp-',
        fit: { inf: 120, other: 112 },     // the list's own tile sizes; the desktop's three-to-a-row tiles come smaller
        nameOnly: true                     // the search box looks for a unit by its name
      });
    } else if (want !== pickerShown) { picker.render(); el('vside').querySelector('.vlistscroll').scrollTop = 0; }
    pickerShown = want;
    markPicked();
  }
  // the card of the unit on the stage, picked out
  function markPicked() {
    el('vlist').querySelectorAll('.unit.on').forEach(function (c) { c.classList.remove('on'); });
    var c = el('vlist').querySelector('#vp-' + view.key);
    if (c) c.classList.add('on');
  }

  function drawControls() {
    drawColourButton();
    var p = profile();
    var riding = R.canRide(p) && view.ride === 'mounted';
    var maxModels = p.cls === 'infantry' ? (riding ? Math.max(1, Math.round(p.size / 2)) : p.size) : 1;
    var h = '<div class="vrow"><b>' + esc(p.name) + '</b>' +
      '<span class="vtier">Tier ' + R.ROMAN[p.tier] + ' · ' + esc(p.group) + '</span></div>';
    // two tabs under the name: what to do with the unit, and what the book says of it
    // the profile first: the options are a tab away
    var tab = view.tab === 'opts' ? 'opts' : 'stats';
    h += '<div class="vtabs" role="tablist">' +
      '<button type="button" role="tab" data-tab="stats" aria-selected="' + (tab === 'stats') + '"' + (tab === 'stats' ? ' class="on"' : '') + '>Stats</button>' +
      '<button type="button" role="tab" data-tab="opts" aria-selected="' + (tab === 'opts') + '"' + (tab === 'opts' ? ' class="on"' : '') + '>Options</button></div>';
    h += '<div class="vtabbody vstatsbody" role="tabpanel"' + (tab === 'stats' ? '' : ' hidden') + '>' + rulesHtml(p) + '</div>';
    h += '<div class="vtabbody voptsbody" role="tabpanel"' + (tab === 'opts' ? '' : ' hidden') + '>';
    h += '<div class="vacts">' +
      // a gun on tow is limbered up behind its vehicle: it does not fire
      '<button class="vbtn primary" data-do="fire"' + (onTow() ? ' disabled title="On tow: deploy it to fire"'
        : outOfArc() ? ' disabled title="Dug in: the mark is outside its 90° fire arc — turn it to face the mark"' : '') + '>Fire</button>' +
      '<button class="vbtn" data-do="walk">' + (view.walking ? 'Stop' : 'Walk') + '</button>' +
      '<button class="vbtn" data-do="insert">Insert</button>' +
      (canStrafe() ? '<button class="vbtn" data-do="strafe">Strafe</button>' : '') +
      abilitiesOf(unit()).map(function (a, i) { return '<button class="vbtn" data-do="ability" data-ab="' + i + '">' + esc(a.name) + '</button>'; }).join('') +
      '<button class="vbtn" data-do="sound">Sound ' + (view.sound ? 'on' : 'off') + '</button>' +
      '</div>';
    h += '<div class="vgrp"><label>State</label><div class="vseg">' +
      seg('status', statesFor(p), view.status) + '</div></div>';
    // on foot or mounted, where the unit may take the Riders upgrade; and on what, if it rides
    if (R.canRide(p)) {
      h += '<div class="vgrp"><label>Riders</label><div class="vseg">' +
        segL('ride', [['foot', 'On foot'], ['mounted', 'Mounted']], view.ride || 'foot') + '</div></div>';
    }
    // Stationary Artillery (p. 94): emplaced, dug in behind sandbags, or on tow behind a vehicle
    if (stationary(p)) {
      h += '<div class="vgrp"><label>Stance</label><div class="vseg">' +
        segL('stance', [['ready', 'Emplaced'], ['dug', 'Dug in'], ['towed', 'Towed']], view.stance || 'ready') + '</div></div>';
    }
    // a Lifter (p. 94): flying empty, or with a technical slung under it
    if ((p.rules || []).indexOf('Lifter') >= 0) {
      h += '<div class="vgrp"><label>Load</label><div class="vseg">' +
        segL('sling', [['none', 'Empty']].concat(SLUNG.map(function (k) { var sp = R.profile(k); return [k, sp ? sp.name : k]; })), view.sling || 'none') + '</div></div>';
      if (view.sling && view.sling !== 'none') {
        h += '<div class="vgrp"><label>Its drive</label><div class="vseg">' +
          seg('slingProp', R.PROP_ORDER, view.slingProp || 'wheeled') + '</div></div>';
      }
    }
    // Drone Control (p. 37): any hull or craft without Transport, in any army but the Bugs
    if (R.canBeDrone(p)) {
      h += '<div class="vgrp"><label>Control</label><div class="vseg">' +
        segL('drone', [['crew', 'Crewed'], ['drone', 'Drone']], view.drone || 'crew') + '</div></div>';
    }
    if (R.canMount(p, riding)) {
      h += '<div class="vgrp"><label>Mount</label><div class="vseg">' +
        segL('mount', R.MOUNT_ORDER.map(function (m) { return [m, R.MOUNTS[m].name]; }), view.mount || 'none') + '</div></div>';
    }
    // an Overgrown Bug walks on its own legs: there is no drive to choose
    if (R.propsFor(p).length) {                  // no drive to choose for an Overgrown Bug or a drop pod
      h += '<div class="vgrp"><label>Propulsion</label><div class="vseg">' +
        seg('prop', R.PROP_ORDER, view.prop) + '</div></div>';
    }
    if (R.isMachine(p) || turns(p)) {
      h += '<div class="vgrp"><label>Facing</label><div class="vseg">' +
        seg('face', FACES, view.face || 'SE') + '</div></div>';
    }
    if (maxModels > 1) {
      var n = view.models == null ? maxModels : Math.min(view.models, maxModels);
      h += '<div class="vgrp"><label>Models — ' + n + ' of ' + maxModels + '</label>' +
        '<input type="range" id="vmodels" min="1" max="' + maxModels + '" value="' + n + '"></div>';
    }
    h += '</div>';
    var was = el('vctl').querySelector('.vtabbody:not([hidden])'), top = was ? was.scrollTop : 0, all = el('vctl').scrollTop;
    el('vctl').innerHTML = h;
    var now = el('vctl').querySelector('.vtabbody:not([hidden])');
    if (now) now.scrollTop = top;       // a redraw (a colour picked, a state set) keeps the place
    el('vctl').scrollTop = all;         // on a desktop the whole panel scrolls, options over stats
  }
  /* The colours, a swatch at the top left of the stage: tap it for the whole
     set, dropped down under it; a pick or a tap anywhere else puts them away. */
  var colOpen = false;
  function drawColourButton() {
    var box = el('vcolbtn');
    if (!box) return;
    var k = view.colour[view.side], c = I.COLOURS[k];
    box.innerHTML = '<button type="button" class="vcolnow" aria-expanded="' + colOpen + '" title="Colours: ' + esc(c.name) + '" aria-label="Colours: ' + esc(c.name) + '">' +
      '<span style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span></button>' +
      (colOpen ? '<div class="vcolpop"><label>Colours — ' + esc(c.name) + '</label><div class="vsw">' + swatches(k) + '</div></div>' : '');
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
    /* The stats as fielded: a ground vehicle's propulsion (Appendix 3) changes
       its Movement, turn cost, Structure or Defence, and a changed figure is
       marked, with the printed one on it as a tooltip. */
    var pr = R.propsFor(p).length && R.PROPULSION[view.prop] ? R.PROPULSION[view.prop] : null;
    var u = Object.assign({}, p, { rules: p.rules.slice(), models: p.size });
    if (pr) R.applyPropulsion(u, pr.key);
    R.applyDrone(u, view.drone === 'drone' && R.canBeDrone(p));
    // the Riders upgrade (p. 93): half the models, mounted, Movement 10" and the Riders rule
    if (R.canRide(p) && view.ride === 'mounted') R.applyRiders(u, true);
    // what it rides (Appendix 3): a grav bike costs a point of Defence
    var mt = R.canMount(p, R.canRide(p) && view.ride === 'mounted') ? R.MOUNTS[view.mount || 'none'] : null;
    if (mt) R.applyMount(u, view.mount || 'none');
    function mod(v, was, txt) {
      return v === was ? { t: txt } : { t: txt, mod: true, was: was };
    }
    // the turn cost rides with Movement, as the book prints it: 8 (1)
    var mv = u.move + '"' + (u.turn != null ? ' (' + u.turn + ')' : '');
    var cols = [['Tier', R.ROMAN[p.tier]], ['Size', mod(u.size, p.size, u.size)],
      ['Move', u.move === p.move && u.turn === p.turn ? mv
        : { t: mv, mod: true, was: p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') }],
      ['FP', p.fp === null ? '—' : p.fp], ['Range', p.range ? p.range + '"' : '—'],
      ['Def', mod(u.def, p.def, u.def + (p.defPierced ? '/' + p.defPierced : ''))], ['Asslt', p.assault],
      mach ? ['Str', mod(u.str, p.str, u.str)] : ['Mor', p.morale]];
    var h = '<div class="vrules"><label>' + esc(FACTION_NAME[p.faction || 'pmc'] || '') + ' · ' +
      esc(p.group) + ' · ' + esc(p.code) + '</label>';
    h += '<table class="vtable"><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') +
      '</tr><tr>' + cols.map(function (c) {
        var v = c[1];
        if (v && typeof v === 'object') {
          return v.mod ? '<td class="vmod" title="' + esc('Printed: ' + v.was) + '">' + esc(v.t) + '</td>' : '<td>' + esc(v.t) + '</td>';
        }
        return '<td>' + esc(v) + '</td>';
      }).join('') + '</tr></table>';
    var TXT = root.PMCRuleText;
    if (!u.rules.length && !pr) h += '<p class="vrule">No special rules.</p>';
    if (pr && pr.key !== 'none') h += '<div class="vrule"><b>Propulsion: ' + esc(pr.name) + '</b><p>' + esc(pr.note) + '</p></div>';
    if (mt && mt !== R.MOUNTS.none) h += '<div class="vrule"><b>Mount: ' + esc(mt.name) + '</b><p>' + esc(mt.note) + '</p></div>';
    u.rules.forEach(function (r) {
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
    }
    drawControls(); start(); frame();
  }
  // a segmented choice whose buttons read differently from the values they set
  function segL(name, opts, now) {
    return opts.map(function (o) {
      return '<button class="vsg' + (o[0] === now ? ' on' : '') + '" data-set="' + name +
        '" data-val="' + o[0] + '">' + esc(o[1]) + '</button>';
    }).join('');
  }
  function seg(name, opts, now) {
    return opts.map(function (o) {
      return '<button class="vsg' + (o === now ? ' on' : '') + '" data-set="' + name +
        '" data-val="' + o + '">' + esc(o) + '</button>';
    }).join('');
  }



  /* ---------- wiring ---------- */
  function mount() {
    cv = el('vboard');
    if (!cv) return;
    g = cv.getContext('2d');
    FX = root.PMCFx.create({ lift: function () { return 0; } });
    STANDING = root.PMCFx.create({ lift: function () { return 0; } });
    I.setSideColour('A', view.colour.A);
    I.setSideColour('B', view.colour.B);
    fit();
    drawPicker();
    drawControls();
   
    fit();                 // again, now the footer has its text and the panels their size
    frame();

    // tap the stage to fire: on a phone the buttons are further down the page
    /* Tap the stage to fire; a pinch or the wheel steps through the zooms, and a pinch is never taken for a tap. */
    var pts = {}, pinch = null, pinched = 0, wheeled = 0;
    cv.addEventListener('click', function () { if (Date.now() - pinched < 400) return; fire(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (Date.now() - wheeled > 250) { wheeled = Date.now(); stepZoom(e.deltaY < 0 ? 1 : -1); }   // one step a flick
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
        var r = Math.hypot(a.x - b2.x, a.y - b2.y) / pinch.d;
        if (r > 1.25 || r < 0.8) { stepZoom(r > 1 ? 1 : -1); pinch.d *= r; pinched = Date.now(); }
      }
    });
    function lift(e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; }
    cv.addEventListener('pointerup', lift);
    cv.addEventListener('pointercancel', lift);
    el('vzoom').addEventListener('click', function (e) {
      var zb = e.target.closest('[data-vzoom]');
      if (!zb) return;
      var how = zb.getAttribute('data-vzoom');
      stepZoom(how === 'wide' ? -1 : 1);
    });
    zoomLabel();
    el('vunits').addEventListener('click', function () { showSide(!document.body.classList.contains('vside-open')); });
    el('vclose').addEventListener('click', function () { showSide(false); });
    el('vscrim').addEventListener('click', function () { showSide(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('vside-open')) showSide(false);
    });
    el('vlist').addEventListener('click', function (e) {
      var b = e.target.closest('.unit[data-k]');
      if (!b) return;
      choose(b.getAttribute('data-k'));
      FX.clear();
      drawPicker(); drawControls(); frame();
      // on a phone the list is a sidebar over the stage: put it away and go back up to see the unit
      if (phone()) {
        showSide(false);
        var sc = document.querySelector('main');
        if (sc && sc.scrollTo) sc.scrollTo({ top: 0, behavior: 'smooth' });
      } else b.scrollIntoView({ block: 'nearest' });
    });

    el('vctl').addEventListener('click', function (e) {
      var sw = e.target.closest('[data-colour]');
      if (sw) {
        paint(view.side, sw.getAttribute('data-colour'));
        drawControls(); frame(); return;
      }
      var tb = e.target.closest('[data-tab]');
      if (tb) {
        if (view.tab !== tb.getAttribute('data-tab')) {
          view.tab = tb.getAttribute('data-tab');
          drawControls();
          el('vctl').querySelector('.vtabbody:not([hidden])').scrollTop = 0;
        }
        return;
      }
      var s = e.target.closest('[data-set]');
      if (s) {
        if (s.getAttribute('data-set') === 'status') { setStatus(s.getAttribute('data-val')); return; }
        view[s.getAttribute('data-set')] = s.getAttribute('data-val');
        drawControls(); frame(); return;
      }
      var d = e.target.closest('[data-do]');
      if (!d) return;
      var act = d.getAttribute('data-do');
      if (act === 'fire') fire();
      else if (act === 'walk') toggleWalk();
      else if (act === 'insert') insert();
      else if (act === 'strafe') strafe();
      else if (act === 'ability') ability(+d.getAttribute('data-ab') || 0);
      else if (act === 'sound') {
        view.sound = !view.sound;
        if (SFX) SFX.setEnabled(view.sound);
        drawControls();
      }
    });
    el('vcolbtn') && el('vcolbtn').addEventListener('click', function (e) {
      e.stopPropagation();                         // redrawn under the tap: not a tap elsewhere
      var sw = e.target.closest('[data-colour]');
      if (sw) { paint(view.side, sw.getAttribute('data-colour')); colOpen = false; drawControls(); frame(); return; }
      if (e.target.closest('.vcolnow')) { colOpen = !colOpen; drawColourButton(); }
    });
    document.addEventListener('click', function (e) {
      if (colOpen && !e.target.closest('#vcolbtn')) { colOpen = false; drawColourButton(); }
    });
    el('vctl').addEventListener('input', function (e) {
      if (e.target.id === 'vmodels') {
        view.models = +e.target.value;
        drawControls(); frame();
      }
    });

    // a search spans every army: the list is drawn again as it starts and as it is cleared
    el('vsearch').addEventListener('input', drawPicker);
    el('vfacs').addEventListener('click', function (e) {
      var t = e.target.closest('[data-fac]');
      if (!t) return;
      view.pickFac = t.getAttribute('data-fac');
      el('vsearch').value = '';
      // turning to an army's tab puts on that army's own colour, cards and bench alike
      if (ARMY_COLOUR[view.pickFac]) paint('A', ARMY_COLOUR[view.pickFac]);
      drawPicker();
      // and puts that army's first unit on the stage
      var first = el('vlist').querySelector('.unit[data-k]');
      if (first) { choose(first.getAttribute('data-k')); FX.clear(); markPicked(); }
      drawControls(); frame();
      el('vside').querySelector('.vlistscroll').scrollTop = 0;
    });

    window.addEventListener('resize', function () { fit(); frame(); });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'f' || e.key === 'F') { fire(); e.preventDefault(); }
      if (e.key === 'w' || e.key === 'W') { toggleWalk(); e.preventDefault(); }
      if (e.key === 'i' || e.key === 'I') { insert(); e.preventDefault(); }
      // S steps through the unit's states; A through its abilities, one each press
      if (e.key === 's' || e.key === 'S') {
        var sts = statesFor(profile());
        setStatus(sts[(sts.indexOf(view.status) + 1) % sts.length]); e.preventDefault();
      }
      if (e.key === 'a' || e.key === 'A') {
        var abs = abilitiesOf(unit());
        if (abs.length) { view.abNext = ((view.abNext || 0) % abs.length); ability(view.abNext); view.abNext++; }
        e.preventDefault();
      }
      // D: crewed or a drone, where it may be one; P: the next drive it may have
      if (e.key === 'd' || e.key === 'D') {
        if (R.canBeDrone(profile())) { view.drone = view.drone === 'drone' ? 'crew' : 'drone'; drawControls(); frame(); }
        e.preventDefault();
      }
      if (e.key === 'p' || e.key === 'P') {
        var props = R.propsFor(profile());
        if (props.length) {
          var order = R.PROP_ORDER.filter(function (q) { return props.indexOf(q) >= 0 || q === view.prop; });
          if (order.indexOf(view.prop) < 0) order.unshift(view.prop);
          view.prop = order[(order.indexOf(view.prop) + 1) % order.length];
          drawControls(); frame();
        }
        e.preventDefault();
      }
      if (e.key === '+' || e.key === '=') { stepZoom(1); e.preventDefault(); }
      if (e.key === '-' || e.key === '_') { stepZoom(-1); e.preventDefault(); }
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
    var cw = Math.max(260, Math.round(box.width - 2));
    var ch = Math.max(narrow ? 200 : 280, Math.round(box.height - 2));
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    view.dpr = dpr;
  }

  /* test hooks: the harness drives the bench the way a player would */
  root.__viewer = {
    pick: function (k) {
      choose(k);
      drawPicker(); drawControls(); frame();
    },
    zoom: function (z) { if (z != null) setZoom(z); return { zoom: view.zoom, cur: view.zCur, wide: view.wide }; },
    set: function (k, v) {
      if (k === 'status') { setStatus(v); return; }
      view[k] = v; drawControls(); frame();
    },
    states: function () { return statesFor(profile()); },
    fire: fire,
    fireNow: function () { fireNow(); },
    walk: toggleWalk,
    gait: function () { return gaitOf(unit()); },
    insert: insert,
    strafe: strafe,
    ability: function (i) { var a = abilitiesOf(unit())[i || 0]; ability(i); return a ? a.name : null; },
    abilities: function () { return abilitiesOf(unit()).map(function (a) { return a.name; }); },
    destroy: function (on) { setStatus(on === false ? 'ready' : 'destroyed'); },
    strafing: function () { return !!view.strafeAt; },
    burrow: function () { return view.burrow ? Object.assign({}, view.burrow) : null; },
    arriving: arriving,
    fx: function () { return FX.kinds(); },
    state: function () { return Object.assign({}, view); },
    spec: function () { return R.weaponSpec(unit()); },
    unit: unit
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
