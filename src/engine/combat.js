/* PMC 2670 — Firefight : shooting, assault, strafing and the special actions: hacking, hijack, demolition, breaching, mines, stances

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineCombat = function (E) {
    var R = E.R, SFX = E.SFX, abAssault = E.abAssault, abShoot = E.abShoot, activeUnits = E.activeUnits,
        addFx = E.addFx, aiAct = E.aiAct, carryMove = E.carryMove, deathsSince = E.deathsSince,
        endActivation = E.endActivation, faceAlong = E.faceAlong, focusUnit = E.focusUnit,
        fromLog = E.fromLog, isAI = E.isAI, logLine = E.logLine, martyrFirst = E.martyrFirst,
        medicFx = E.medicFx, moveBonus = E.moveBonus, playAssault = E.playAssault,
        playShooting = E.playShooting, playStrafe = E.playStrafe, pushRes = E.pushRes, render = E.render,
        repaintTerrain = E.repaintTerrain, samCheck = E.samCheck, setHint = E.setHint, sideName = E.sideName,
        snapshotAlive = E.snapshotAlive, soundFor = E.soundFor, stepOff = E.stepOff, ui = E.ui,
        whenIdle = E.whenIdle;


    /* Who this unit could charge: anyone in reach — measured to the wall of a
       building — or, from inside a building, only an enemy in the section next
       door (p. 41, Huge buildings). */
    // barbed wire: the D6 is rolled before the move, and the player sees it (p. 42)
    function wireNote(u) {
      if (!u.wireRoll) return;
      logLine('note', u.label + ' — barbed wire: D6 ' + u.wireRoll + '. Crossing a section of it costs ' + u.wireRoll + '" of this move.');
      setHint(null, 'Barbed wire on the table: D6 ' + u.wireRoll + ' — each section crossed costs ' + u.wireRoll + '" of this move.');
    }

    /* A charge covers Movement +2" (p. 33) — or whatever the unit's charge bonus
       is — walked over the ground, not measured through it. */
    function chargeAllow(u) { return u.move + moveBonus(u, 'assault'); }
    function assaultables(u, reach) {
      var within = u.bld ? null : R.chargeReach(E.state, u, reach == null ? chargeAllow(u) : reach);
      return activeUnits().filter(function (e) {
        if (e.side === u.side || !R.canAssault(u, e)) return false;
        if (u.bld) return e.bld === u.bld && R.unitDist(u, e) <= 0.6;
        return !!within(e);
      });
    }
    function canReachCharge(u, t) {
      if (u.bld) return t.bld === u.bld && R.unitDist(u, t) <= 0.6;
      return !!R.chargeRoute(E.state, u, t, chargeAllow(u));
    }

    function doEnter(u, s) {
      var wasIn = !!u.bld;
      R.enterBuilding(E.state, u, s.piece, s.sec);
      var what = R.TERRAIN[s.piece.kind].name.toLowerCase();
      var high = R.sectionHigh(s.piece, s.rect);
      logLine('move', u.label + (wasIn ? ' moves through to the next section of the ' + what + '.' : ' goes into the ' + what +
        (s.piece.kind === 'building' ? (high ? ' — a high building, +2 Firepower from its windows' : ' — a low building') : '') + '.'));
      if (SFX) SFX.step();
      u.activated = true;
      endActivation(u);
    }

    function doExitBld(u, spot) {
      R.exitBuilding(E.state, u, spot);
      logLine('move', u.label + ' comes out of the building.');
      if (SFX) SFX.step();
      u.activated = true;
      endActivation(u);
    }

    /* Disembark (p. 36): "one or more" of those aboard. A player puts them down a
       squad a tap, and may stop there and drive on (Cancel); the AI empties the hull. */
    function doDisembark(pt, all) {
      var u = ui.selected;
      var out = (u.cargo || []).filter(function (c) { return !c.boarded; });
      if (!all) out = out.slice(0, 1);
      var lines = [];
      out.forEach(function (rider, i) {
        /* The first squad goes where it was put; any more (the AI empties the hull)
           to the free spot nearest that, each placed before the next is chosen. */
        var spot = pt;
        if (i > 0) {
          var near = null, nd = Infinity;
          R.dropSpots(E.state, u, rider).forEach(function (c) {
            var d = R.inches(c.x, c.y, pt.x, pt.y);
            if (d < nd) { nd = d; near = c; }
          });
          spot = near;
        }
        var r = R.disembark(E.state, u, rider, spot);
        if (r) { logLine('note', r.text); lines.push({ text: r.text }); stepOff(rider, u); }
      });
      if (SFX) { SFX.step(); SFX.step(0.22); }
      pushRes({
        kind: 'Disembark', title: u.name + ' unloads', side: u.side,
        note: 'Troops are placed within 4" of the hull and may act this turn if they have not already.',
        list: lines
      });
      // more still aboard: another tap puts the next squad down, Cancel keeps them in and drives on
      if (!all && !isAI(u.side) && (u.cargo || []).some(function (c) { return !c.boarded; })) {
        u.unloading = true; u.activated = false;
        ui.moves = E.dropFor(u);
        setHint(null, 'Tap where the next squad gets off — or Cancel to keep the rest aboard.');
        render();
        return;
      }
      u.unloading = false; u.activated = true;
      carryMove(u);
    }

    // Strafing run: fly the line, hit everything under it, and take the return fire.
    function doStrafe(pt) {
      var u = ui.selected;
      var from = { x: u.x, y: u.y };
      faceAlong(u, u.x, u.y, pt.x, pt.y);
      var snap = snapshotAlive();
      var hitList = activeUnits().filter(function (t) {
        return t.side !== u.side && !R.isFlying(t) &&
          R.pointSegDist(t.x, t.y, from.x, from.y, pt.x, pt.y) <= 2.2;
      });
      // the run is against ground units: its own side's aircraft are above it, not under it
      var friends = activeUnits(u.side).filter(function (t) {
        return t !== u && !R.isFlying(t) && R.pointSegDist(t.x, t.y, from.x, from.y, pt.x, pt.y) <= 2.2;
      });
      u.x = pt.x; u.y = pt.y;
      var log = [];
      logLine('move', u.label + ' makes a strafing run.');
      hitList.forEach(function (t) {
        var res = abShoot(E.state, u, t, 'basic', {});
        var ex = [];
        scenAfterShot(u, t, ex);
        res.log.concat(ex).forEach(function (l) { logLine(l.t, l.text, l.math); log.push(l); });
      });
      // friendly fire, on a 1-3
      friends.forEach(function (t) {
        var die = R.d6();
        if (die > 3) return;
        logLine('note', 'Friendly fire! D6 ' + die + ' — ' + t.label + ' is caught in the strafe.');
        var res2 = abShoot(E.state, u, t, 'basic', {});
        res2.log.forEach(function (l) { logLine(l.t, l.text, l.math); log.push(l); });
      });
      // everything still standing may shoot back, free of charge
      hitList.forEach(function (t) {
        if (!t.alive || R.status(t) !== 'ready' || t.fp === null) return;
        if (!R.canShoot(E.state, t, u, 'basic', {})) return;
        var back = abShoot(E.state, t, u, 'basic', {});
        back.log.forEach(function (l) { logLine(l.t, l.text, l.math); log.push(l); });
      });
      soundFor(log);
      var card = fromLog('Strafing run', u.name + ' over the line', u.side, log);
      if (!log.length) card = { kind: 'Strafing run', title: u.name, side: u.side, note: 'Nothing under the flight path.' };
      u.activated = true;
      playStrafe(u, from, pt, deathsSince(snap), function () { pushRes(card); });
      samCheck(u);
      endActivation();
    }

    // Ambush!: an OpFor unit shot at in the first turn — by any shooting, a strafe included (p. 156)
    function scenAfterShot(u, t, log) {
      if (!E.state.scen.afterShot) return;
      var extra = E.state.scen.afterShot(E.state, u, t);
      if (extra) { log.push({ t: 'note', text: extra.text }); return extra; }
    }
    function resolveShot(u, target, mode, opts) {
      var snap = snapshotAlive();
      var res = abShoot(E.state, u, target, mode, opts || {});
      if (opts && opts.aux) res.aux = true;          // the view draws a sidearm, not the unit's main weapon
      // Ambush!: the column caught off guard in the first turn (p. 156)
      if (E.state.scen.afterShot) {
        var extra = E.state.scen.afterShot(E.state, u, target);
        if (extra) res.log.push({ t: 'note', text: extra.text });
      }
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      soundFor(res.log);
      var card = fromLog('Shooting', u.name + ' → ' + target.name, u.side, res.log);
      playShooting(u, target, res, deathsSince(snap), function () { pushRes(card); });
      u.activated = true;
      endActivation();
    }

    function doShoot(target) {
      var u = ui.selected;
      // an Advance's shot at a friend is NOT ONE STEP BACKWARDS! (T5), fired on the move
      if (u && target && target.side === u.side && ui.mode === 'advance-fire') { doSteady(target, u, 'advance'); return; }
      // a player's shot spends the Rite of Concentration only when called for
      resolveShot(u, target, ui.mode === 'advance-fire' ? 'advance' : 'fire',
        { aux: ui.mode === 'aux', concentrate: ui.mode === 'fire' && !!ui.concentrate });
      ui.concentrate = false;
    }

    function doAssault(target) {
      var u = ui.selected;
      martyrFirst(u, target, function (m) {
        var snap = snapshotAlive();
        var res = abAssault(E.state, u, target, m, ui.noSap);
        ui.noSap = false;
        res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
        soundFor(res.log);
        var card = fromLog('Assault', u.name + ' → ' + target.name, u.side, res.log);
        playAssault(u, target, deathsSince(snap), function () { pushRes(card); });
        u.activated = true; endActivation();
      });
    }

    /* Supporting Fire: shoot without the stationary bonus, then stay active so the
       hull can still load or unload its passengers. */
    function doSupport(target) {
      var u = ui.selected;
      var snap = snapshotAlive();
      var res = abShoot(E.state, u, target, 'support', {});
      scenAfterShot(u, target, res.log);
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      soundFor(res.log);
      var card = fromLog('Supporting Fire', u.name + ' → ' + target.name, u.side, res.log);
      playShooting(u, target, res, deathsSince(snap), function () { pushRes(card); });
      u.supportUsed = true;
      ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
      setHint(null, 'Supporting Fire given — now load or unload, or pass to end the activation.');
      render();
    }

    function doSteady(target, shooter, mode) {
      var u = shooter || ui.selected;
      if (!u || !target) return;
      var res = R.steadyFire(E.state, u, target, mode);
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      faceAlong(u, u.x, u.y, target.x, target.y);
      addFx({ kind: 'muzzle', x: u.x, y: u.y, dur: 180 });
      addFx({ kind: 'tracer', from: { x: u.x, y: u.y }, to: { x: target.x, y: target.y }, dur: 220 });
      if (SFX && SFX.shot) SFX.shot();
      medicFx(target, res.medic, 250);
      pushRes(fromLog('NOT ONE STEP BACKWARDS!', u.name + ' → ' + target.name, u.side, res.log));
      u.activated = true;
      endActivation(u);
    }

    function doHack(target) {
      var u = ui.selected;
      // the hack goes out from the unit's own eyes (its spotter, where it has one)
      if (u && target) addFx({ kind: 'beam', unit: u.id, x: u.x, y: u.y, tx: target.x, ty: target.y, rgb: '90,255,140', data: true, dur: 1300, blocking: true });
      var res = R.hack(E.state, u, target, function (drone, hits) {
        // taken over: it will act for the hacker's side, then burn
        drone.hijack = { from: drone.side, paint: drone.paint, hits: hits, by: u.id };
        if (!drone.paint) drone.paint = drone.side;          // it keeps its own colours
        drone.side = u.side;
        return true;
      });
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      var card = fromLog('Hack', u.name + ' → ' + target.name, u.side, res.log);
      u.activated = true;
      pushRes(card);
      if (res.pending) { startHijack(target); return; }
      endActivation();
    }
    /* The hacked drone's one activation for the hacker's side (p. 57): the player
       who hacked it picks what it does (the AI, for the AI), and only then does it
       burn and go back to its owner. */
    function hijacked() {
      if (!E.state || !E.state.hijackId) return null;
      return E.state.units.filter(function (x) { return x.id === E.state.hijackId; })[0] || null;
    }
    function startHijack(drone) {
      E.state.hijackId = drone.id;
      logLine('note', drone.label + ' is under ' + sideName(drone.side) + '’s control for one activation.');
      ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
      if (isAI(drone.side)) { whenIdle(function () { if (E.state && !E.state.over && drone.alive) aiAct(drone); else endHijack(drone); }); return; }
      ui.selected = drone;
      focusUnit(drone);
      setHint(null, drone.name + ' is hacked: give it one action for your side, then it burns.');
      render();
    }
    function endHijack(drone) {
      var h = drone && drone.hijack;
      if (!h) return;
      drone.side = h.from; drone.paint = h.paint;
      delete drone.hijack;
      E.state.hijackId = null;
      drone.activated = true; drone.hacked = true;
      if (drone.alive) {
        var log = [];
        var hacker = E.state.units.filter(function (x) { return x.id === h.by; })[0] || null;
        R.hackBurn(E.state, hacker, drone, h.hits, log);
        log.forEach(function (l) { logLine(l.t, l.text, l.math); });
        pushRes(fromLog('Hack', drone.name + ' burns', h.from, [{ t: 'note', text: drone.label + ' goes back to its own side and burns for ' + h.hits + ' hits.' }].concat(log)));
      }
    }

    function doDemolish(piece) {
      var u = ui.selected;
      var res = R.shootTerrain(E.state, u, piece);
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      var mid = { x: piece.x + piece.w / 2, y: piece.y + piece.h / 2 };
      // the unit's own weapons, drawn and heard as any shot of theirs is, at the piece
      faceAlong(u, u.x, u.y, mid.x, mid.y);
      var card = fromLog('Demolition', u.name + ' → ' + piece.kind, u.side, res.log);
      playShooting(u, mid, { hits: res.down ? 4 : 2 }, [], function () { pushRes(card); });
      if (res.result) whenIdle(function () { repaintTerrain([res.result]); });
      endActivation(u);
    }

    function doBreach(piece) {
      var u = ui.selected;
      var res = R.assaultTerrain(E.state, u, piece);
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      var mid = { x: piece.x + piece.w / 2, y: piece.y + piece.h / 2 };
      // Sappers set their charges round the piece first; anyone else just goes at it
      if (R.has(u, 'Sappers')) addFx({ kind: 'charges', x: mid.x, y: mid.y, r: Math.min(piece.w, piece.h) / 2 + 0.5, n: 5, dur: 1400, blocking: true });
      addFx({ kind: 'clash', x: mid.x, y: mid.y, delay: R.has(u, 'Sappers') ? 850 : 0, dur: R.has(u, 'Sappers') ? 1270 : 420 });
      if (res.result) whenIdle(function () { repaintTerrain([res.result]); });
      pushRes(fromLog('Demolition charges', u.name + ' → ' + piece.kind, u.side, res.log));
      endActivation(u);
    }

    /* Terrorist (p. 112): only a First Among Equals of the side that mined the
       board may set the charge off, and only while the piece is still standing. */
    function minedFor(u) {
      var m = E.state && E.state.mined;
      if (!m || !u || u.side !== m.side) return null;
      if (E.state.terrain.indexOf(m.piece) < 0) return null;
      var p = R.profile(u.key);
      return (p && p.group === 'First Among Equals') ? m : null;
    }

    function doDetonate(u) {
      var m = minedFor(u);
      if (!m) return;
      var snap = snapshotAlive();
      var res = R.detonate(E.state, u, m.piece);
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      soundFor(res.log);
      var mid = { x: m.piece.x + m.piece.w / 2, y: m.piece.y + m.piece.h / 2 };
      addFx({ kind: 'clash', x: mid.x, y: mid.y, dur: 520 });
      (res.treated || []).forEach(function (tr) {
        medicFx(E.state.units.filter(function (o) { return o.id === tr.id; })[0], tr.medic, 600);
      });
      if (res.result) whenIdle(function () { repaintTerrain([res.result]); });
      deathsSince(snap);
      pushRes(fromLog('Terrorist', u.name + ' → the charge', u.side, res.log));
      endActivation(u);
    }

    /* "Dig in!" / "Normal stance!" (p. 94). The trails swing round to face whatever
       the gun is being laid on, since an emplaced piece dug in this way only bears
       on its front quarter. */
    // the facing a gun digs in on unless told otherwise: towards the nearest enemy
    function digDefault(u) {
      var foe = null, best = Infinity;
      E.state.units.forEach(function (o) {
        if (!o.alive || o.aboard || o.side === u.side || o.x < 0) return;
        var d = R.unitDist(u, o);
        if (d < best) { best = d; foe = o; }
      });
      if (foe) return R.nearestFacing(Math.atan2(foe.y - u.y, foe.x - u.x));
      return R.nearestFacing(u.facing == null ? (u.side === 'A' ? 0 : Math.PI) : u.facing);
    }
    /* Dig in! (p. 94): the gun is laid over open sights facing one way, and
       cannot be turned after — so a player chooses which of the eight facings
       it digs in on (a tap round the gun, or on the panel's octagon). The AI
       faces its nearest enemy. Normal stance! needs no choosing. */
    function doStance(u) {
      if (!u.dugIn && !isAI(u.side)) {
        ui.mode = 'digface'; ui.targets = []; ui.moves = [];
        ui.digDir = digDefault(u);
        setHint(null, 'Dig in!: choose the way it faces — tap a direction around the gun, or on the octagon. Its fire arc is the 90° in front.');
        render();
        return;
      }
      finishStance(u, u.dugIn ? null : digDefault(u));
    }
    function finishStance(u, dir) {
      u.dugIn = !u.dugIn; u.activated = true;
      if (u.dugIn) { u.facing = dir; u.aim = null; }
      ui.mode = 'idle'; ui.digDir = null;
      logLine('note', u.dugIn
        ? u.label + ' digs in: Range 24", minimum 6", front quarter only — but firing with every modifier.'
        : u.label + ' returns to normal stance: indirect fire out to ' + u.range + '" again.');
      endActivation(u);
    }

    return {
      wireNote: wireNote, chargeAllow: chargeAllow, assaultables: assaultables,
      canReachCharge: canReachCharge, doEnter: doEnter, doExitBld: doExitBld, doDisembark: doDisembark,
      doStrafe: doStrafe, resolveShot: resolveShot, doShoot: doShoot, doAssault: doAssault,
      doSupport: doSupport, doSteady: doSteady, doHack: doHack, hijacked: hijacked, endHijack: endHijack,
      doDemolish: doDemolish, doBreach: doBreach, minedFor: minedFor, doDetonate: doDetonate,
      doStance: doStance, finishStance: finishStance
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineCombat;
})(typeof window !== 'undefined' ? window : global);
