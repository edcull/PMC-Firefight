/* PMC 2670 — Firefight : moves and shots played on the board: a unit's gait crossing the ground, burrowing, and every shot, strafe and assault.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCPlay = function (B) {
    var dispX = B.dispX, dispY = B.dispY, nowMs = B.nowMs, onTable = B.onTable, startLoop = B.startLoop;
    var FX = B.FX, ISO = B.ISO, R = B.R, SFX = B.SFX, STANDING = B.STANDING, anims = B.anims;
    // from modules installed after this one: looked up when called
    function handsOff() { return B.handsOff.apply(this, arguments); }
    function render() { return B.render.apply(this, arguments); }

    /* ---- how a unit is drawn crossing the ground ----

       A walk is made of footfalls, and a footfall happens every so many inches —
       not every so many milliseconds. Driving the frames off the clock instead
       made the feet slide: the same eleven paces whether the unit shuffled 3" or
       sprinted 12". Driving them off distance covered means a squad hurrying puts
       its legs down faster, which is what the eye is looking for.

       The body rides with the feet: up between paces, down onto each one, so the
       bob and the step land together instead of drifting against each other as
       they did when both ran on their own timers. A step is heard on each footfall,
       rate-limited so a long sprint is a walk rather than a drum roll. */
    // the gait itself — pace, stride, how high a jump arcs — is motion.js's
    var MOTION = window.PMCMotion;   // the timings and shapes of movement, shared with the Unit Viewer (motion.js)
    var STEP_GAP = MOTION.STEP_GAP, gaitOf = MOTION.gaitOf, jetApex = MOTION.jetApex;

    function pace(an, d, k, t) {
      var gait = gaitOf(an.unit);
      if (!gait) { an.unit.walk = 0; an.unit.hop = 0; return; }
      if (gait.arc) {
        /* A jet-assisted bound: one arc from where the squad stood to where it
           lands, higher the further it goes, the burn flickering all the way. */
        an.unit.walk = 1 + (Math.floor(t / 70) % 2);
        an.unit.hop = 0;
        an.unit.arc = Math.sin(Math.min(1, k) * Math.PI) * jetApex(an.total || d);
        if (an.lastPace < 0 && k < 1) {
          an.lastPace = 0;
          if (SFX && SFX.jetpack) SFX.jetpack((an.dur || 800) / 1000);
        }
        return;
      }
      var paces = d / gait.span;
      var n = Math.floor(paces);
      an.unit.walk = 1 + (n % 2);
      // the body is highest halfway between footfalls and lowest on each one
      an.unit.hop = Math.sin((paces - n) * Math.PI) * gait.lift;
      if (n !== an.lastPace && k < 1) {
        an.lastPace = n;
        if (gait.sound && t - an.lastStep > STEP_GAP) { an.lastStep = t; if (SFX) SFX.step(); }
      }
    }

    // Underground Bugs do not walk across the table: they go down and come up (motion.js)
    var burrows = MOTION.burrows, burrowR = MOTION.burrowR, moveMs = MOTION.moveMs;
    /* A burrowing move in three parts: the unit fades out where it stands as it
       goes down, travels unseen under a line of churned earth, and fades back in
       where it comes up. */
    var SINK = MOTION.BURROW_SINK, RISE = MOTION.BURROW_RISE;
    function burrowStep(an, k) {
      var u = an.unit, sub, e;
      if (k < SINK) {
        sub = k / SINK; e = sub * sub;
        u.burrow = { lift: 0, alpha: Math.max(0, 1 - e) };
        var p0 = an.segs[0].a;
        u.ax = p0.x; u.ay = p0.y;
        if (an.phase === 0) {
          an.phase = 1;
          addFx({ kind: 'collapse', x: p0.x, y: p0.y, r: burrowR(u), dur: 700, blocking: true });
          if (SFX) { SFX.step(); SFX.step(0.12); SFX.step(0.3); }
        }
        return;
      }
      if (k < RISE) {
        u.burrow = { hidden: true };
        var d = (k - SINK) / (RISE - SINK) * an.total, seg = 0;
        while (seg < an.segs.length - 1 && d > an.segs[seg].end) seg++;
        var sg = an.segs[seg];
        var f = sg.len ? Math.max(0, Math.min(1, (d - sg.start) / sg.len)) : 1;
        u.ax = sg.a.x + (sg.b.x - sg.a.x) * f;
        u.ay = sg.a.y + (sg.b.y - sg.a.y) * f;
        // the ground heaving over it as it goes, an inch at a time
        if (Math.floor(d) !== an.lastDirt) {
          an.lastDirt = Math.floor(d);
          addFx({ kind: 'miss', x: u.ax, y: u.ay, dur: 700, blocking: true });
          addFx({ kind: 'miss', x: u.ax + (Math.random() - 0.5) * 1.2, y: u.ay + (Math.random() - 0.5) * 1.2, dur: 900, blocking: true });
          if (SFX && an.lastDirt % 2 === 0) SFX.step(0.02);
        }
        return;
      }
      var pe = an.segs[an.segs.length - 1].b;
      u.ax = pe.x; u.ay = pe.y;
      if (an.phase < 2) {
        an.phase = 2;
        addFx({ kind: 'collapse', x: pe.x, y: pe.y, r: burrowR(u), dur: 800, blocking: true });
        if (SFX) { SFX.impact(0.05); SFX.step(0.15); SFX.step(0.35); }
      }
      sub = (k - RISE) / (1 - RISE); e = 1 - Math.pow(1 - sub, 2);
      u.burrow = { lift: 0, alpha: Math.min(1, e) };
    }
    // `done`, if given, is called once the move has been drawn (at once, when there is nothing to draw)
    function animateMove(u, path, follow, done) {
      if (!path || path.length < 2) { if (done) done(); return; }
      var segs = [], total = 0;
      for (var i = 1; i < path.length; i++) {
        var len = R.inches(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
        segs.push({ a: path[i - 1], b: path[i], start: total, len: len, end: total + len });
        total += len;
      }
      if (!total) { if (done) done(); return; }
      // a squad turns to the way it is going; a turret swings back to the front
      faceToward(u, path[path.length - 1].x, path[path.length - 1].y, path[0]);
      if (R.isMachine(u)) u.aim = null;
      var dig = burrows(u);
      anims.push({
        kind: 'move', unit: u, segs: segs, total: total, follow: !!follow && !handsOff(),
        dur: dig ? MOTION.burrowMs(total) : moveMs(u, total),
        t0: nowMs(), lastStep: 0, lastPace: -1, burrow: dig, lastDirt: -1, phase: 0, done: done || null
      });
      u.ax = path[0].x; u.ay = path[0].y;
      startLoop();
    }

    function addFx(f) {
      FX.add(f);
      startLoop();
    }

    /* ---- a shot, played the way that unit's weapon actually works ----
       The weapons themselves are drawn by fire.js, which the Unit Viewer shares:
       each style with its own cadence, its own effect on the table and its own
       sound, timed so the hits land when the rounds arrive. What is the
       battle's is around them: the gun swinging onto its target, where each
       shot leaves, and the casualties when it lands. */
    var SHOTS = window.PMCFire.make({
      add: addFx,
      redraw: function () { render(); },
      alive: function () { return !!B.state; }
    });
    var FIRE = SHOTS.FIRE, streamLength = SHOTS.streamLength;
    var playSecondary = SHOTS.secondary;
    var XENO_BLUE = window.PMCFire.XENO_BLUE, BUG_GREEN = window.PMCFire.BUG_GREEN;

    // a squad on foot turns to face left or right on the screen
    function faceToward(u, x, y, from) {
      if (R.isMachine(u)) return;
      from = from || u;
      var a = ISO.toScreen(from.x, from.y), b = ISO.toScreen(x, y);
      if (b.x < a.x - ISO.K * 0.3) u.faceL = true;
      else if (b.x > a.x + ISO.K * 0.3) u.faceL = false;
    }


    function playShooting(shooter, target, res, deaths, done) {
      /* A crew-served piece swings onto its target before it fires: the carriage
         round to its new facing, then the gun traversing onto the bearing. */
      if (shooter && ISO.startTurn && ISO.turnsLikeMachine(shooter.art)) {
        var swing = ISO.startTurn(shooter);
        if (swing > 0) {
          anims.push({ kind: 'turn', unit: shooter, t0: nowMs(), dur: swing });
          holdFor(swing + 80);               // no gap between the swing and the shot
          startLoop();
          setTimeout(function () { if (B.state) playShooting(shooter, target, res, deaths, done); }, swing + 40);
          return;
        }
      }
      var spec = R.weaponSpec(shooter);
      /* A gunship fires from its airframe and is hit on its airframe, not on the
         ground it happens to be over. Every point a shot is drawn between carries
         how high above its own ground it sits. */
      /* Where each is drawn, not where the rules have already put it: a target that
         breaks and runs is still standing where it was hit until its own move plays. */
      var from = { x: dispX(shooter), y: dispY(shooter), up: ISO.flyLift(shooter) };
      var to = { x: dispX(target), y: dispY(target), up: ISO.flyLift(target) };
      /* Troopers turn to face what they are shooting at, and each shot leaves one
         of their own barrels: the pool is every surviving model's muzzle. */
      if (!R.isMachine(shooter)) {
        faceToward(shooter, to.x, to.y, from);
        window.PMCFire.troop(from, spec, ISO.muzzles(shooter, R.status(shooter)));
      }
      /* A machine turns its turret onto the target, and each weapon fires from
         its own barrel or tubes: the main gun from the muzzle, the machine gun
         from the machine gun, rockets from the rack. */
      var mountFrom = function () { return from; };
      if (R.isMachine(shooter)) {
        shooter.aim = Math.atan2(to.y - from.y, to.x - from.x);
        var M = ISO.mounts(shooter);
        mountFrom = function (style) { return ISO.mountFor(M, style, shooter, from); };
        from = mountFrom(spec.p);
      }
      var hits = res.hits || 1;
      var fired = false;
      // `at`: where this round came down, when a salvo spreads its rounds round the mark
      function land(extra, at) {
        if (!B.state) return;
        var p = at || to;
        if (res.hits > 0) {
          SHOTS.hit(shooter, p, hits, extra);
        } else {
          addFx({ kind: 'miss', x: p.x, y: p.y, up: p.up, dur: 320, blocking: true });
        }
        if (!fired) { fired = true; spawnDeaths(deaths); }
      }
      function finish(ms) { setTimeout(function () { if (done) done(); }, ms); }

      // the secondary goes off alongside the primary, a beat later
      if (spec.s) setTimeout(function () {
        if (B.state) playSecondary(spec.s, shooter, from.poolFor ? from.poolFor(spec.s) : mountFrom(spec.s), to, hits, spec.sn);
      }, 150);

      var tail = spec.s ? 320 + ((spec.sn || 1) - 1) * 260 : 0;

      var ms = SHOTS.primary(spec, shooter, from, to, { hits: hits, dist: R.unitDist(shooter, target), land: land }) + tail;
      holdFor(ms);
      finish(ms);
    }
    /* The replay waits on the table being busy. Most weapons put their first
       effect up a moment after they are called (a timer, not at once), and in
       that moment the table was idle: the shot counted as over before it began,
       the target showed what it did to them and the next event came on. So an
       attack keeps the table busy for as long as it takes. */
    function holdFor(ms) {
      anims.push({ kind: 'beat', dur: ms, t0: nowMs() });
      startLoop();
    }

    // the aircraft runs the line, throwing fire out to either side
    /* A strafing run: the craft flies the length of it, guns going, and the
       ground walks up under it. It used to stand still while the fire appeared
       along the line, which read as somebody else shooting. */
    function playStrafe(u, from, to, deaths, done) {
      var span = Math.hypot(to.x - from.x, to.y - from.y);
      var dur = MOTION.strafeMs(span);
      var steps = Math.max(5, Math.round(span * 1.2) + 4);
      // the ground goes up in the colour of what hits it: xeno energy, bug acid
      var hitRGB = !u ? null : R.isXeno(u) ? XENO_BLUE : u.faction === 'bugs' ? BUG_GREEN : null;
      if (u) {
        u.facing = Math.atan2(to.y - from.y, to.x - from.x);
        u.aim = null;
        u.ax = from.x; u.ay = from.y;
        anims.push({ kind: 'strafe', unit: u, from: from, to: to, dur: dur, t0: nowMs() });
        startLoop();
      }
      /* The bursts go down where the craft is as it passes, over the middle of
         the run — it opens up after the approach and stops before it pulls off. */
      for (var i = 0; i < steps; i++) {
        (function (n) {
          setTimeout(function () {
            if (!B.state) return;
            var f = 0.18 + (n / (steps - 1)) * 0.64;
            var x = from.x + (to.x - from.x) * f, y = from.y + (to.y - from.y) * f;
            addFx({ kind: 'muzzle', x: x, y: y, rgb: hitRGB, dur: 180, blocking: true });
            /* The ground going up under it: rounds walking along the line, each
               throwing its own dirt, spread either side of the run. */
            addFx({ kind: 'impact', x: x, y: y, n: 3, rgb: hitRGB, dur: 320, blocking: true });
            for (var d2 = 0; d2 < 3; d2++) {
              addFx({
                kind: 'miss', x: x + (Math.random() - 0.5) * 2.4, y: y + (Math.random() - 0.5) * 2.4,
                rgb: hitRGB, dur: 380 + Math.random() * 220, blocking: true
              });
            }
            if (SFX) SFX.strafe(R.isXeno(u) ? 'xeno' : u.faction, R.weaponStyle(u));
          }, dur * 0.18 + n * (dur * 0.64 / Math.max(1, steps - 1)));
        })(i);
      }
      setTimeout(function () { spawnDeaths(deaths); }, dur * 0.6);
      setTimeout(function () { if (done) done(); }, dur + 220);
    }

    function playAssault(attacker, target, deaths, done) {
      // where the two are drawn: a defender driven back is still where it was charged
      var mid = { x: (dispX(attacker) + dispX(target)) / 2, y: (dispY(attacker) + dispY(target)) / 2 };
      holdFor(900);
      for (var i = 0; i < 4; i++) {
        (function (n) {
          setTimeout(function () {
            if (!B.state) return;
            addFx({ kind: 'clash', x: mid.x + (Math.random() - 0.5), y: mid.y + (Math.random() - 0.5), dur: 300, blocking: true });
            // an assault goes in firing carbines from the hip — or, for bugs, all mandibles
            if (SFX) { if (attacker.faction === 'bugs') SFX.chitter(); else SFX.smg(4); }
          }, n * 170);
        })(i);
      }
      setTimeout(function () { spawnDeaths(deaths); }, 320);
      setTimeout(function () { if (done) done(); }, 900);
    }

    function spawnDeaths(deaths) {
      (deaths || []).forEach(function (d) { if (d.u) delete B.held[d.u.id]; });
      (deaths || []).forEach(function (d) {
        addFx({
          kind: 'ghost', x: d.x, y: d.y, side: d.u.side, code: d.u.code,
          models: Math.max(1, d.u.size), dur: 700, blocking: true
        });
      });
      if (deaths && deaths.length && SFX) SFX.casualty();
    }

    /* The effects themselves live in fx.js, so the game and the unit viewer draw
       the same ones from the same code. This is only the game's window onto it. */
    function drawFx() {
      STANDING.clear();
      if (B.state) B.state.units.forEach(function (u) {
        if (!u.alive || u.aboard || u.x < 0 || u.reserve || !R.ruleValue(u, 'Shield Generator')) return;
        STANDING.add({ kind: 'dome', x: u.x, y: u.y, r: 12, steady: true, a: 0.4, dur: 1e9 });
      });
      /* Counter-jamming, while it is doing something: its 6" marked out on the ground round a
         counter-jammer that has a friend (itself included) inside it who stands
         within 24" of an enemy's Jammers — the ground it is winning back. */
      if (B.state) {
        var onTable = function (u) { return u.alive && !u.aboard && !u.reserve && u.x >= 0; };
        var jammers = B.state.units.filter(function (e) { return onTable(e) && R.has(e, 'Jammers'); });
        if (jammers.length) B.state.units.forEach(function (c) {
          if (!onTable(c) || !R.projects(c) || !R.has(c, 'Counter-jamming')) return;
          var covering = B.state.units.some(function (f) {
            return onTable(f) && f.side === c.side && R.unitDist(c, f) <= 6 &&
              jammers.some(function (e) { return e.side !== f.side && R.unitDist(e, f) <= 24; });
          });
          if (covering) STANDING.add({ kind: 'cjam', x: c.x, y: c.y, r: 6, a: 1, dur: 1e9 });
        });
      }
      STANDING.draw(B.pctx);
      FX.draw(B.pctx);
    }


    return {
      FIRE: FIRE,
      addFx: addFx,
      animateMove: animateMove,
      burrowStep: burrowStep,
      burrows: burrows,
      drawFx: drawFx,
      gaitOf: gaitOf,
      pace: pace,
      playAssault: playAssault,
      playShooting: playShooting,
      playStrafe: playStrafe,
      streamLength: streamLength
    };
  };
})(window);
