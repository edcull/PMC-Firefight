/* PMC 2670 — Firefight : moving: one-off actions, waves, forced charges, moves, embarking

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineMoves = function (E) {
    var R = E.R, SC = E.SC, SFX = E.SFX, V = E.V, activeUnits = E.activeUnits, addFx = E.addFx,
        animateMove = E.animateMove, assaultables = E.assaultables, boardAnim = E.boardAnim,
        canAnswerMark = E.canAnswerMark, canStand = E.canStand, endActivation = E.endActivation,
        flightTurn = E.flightTurn, fromLog = E.fromLog, isAI = E.isAI, logLine = E.logLine,
        markHint = E.markHint, markTargets = E.markTargets, moveBonus = E.moveBonus, onTable = E.onTable,
        paintStructures = E.paintStructures, pushRes = E.pushRes, render = E.render,
        repaintTerrain = E.repaintTerrain, setHint = E.setHint, ui = E.ui, whenIdle = E.whenIdle;

    /* Adrenaline Rush and Last Stand: each once a battle, each spent from u.camp.once;
       neither is an action in itself. */
    function doOnce(u, id) {
      if (id === 'laststand') {
        /* "Once per battle the unit can remove all its Suppression points" (p. 88):
           at any time, and not an action, so the unit still has its activation to
           spend, steady (engine.js makeStand). */
        E.makeStand(u);
        ui.mode = 'idle'; render();
        return;
      }
      u.camp.once.adrenaline = true;
      /* "Once per battle the unit can make two actions in a row" (p. 88): the unit
         itself goes again the moment this action ends (engine.js passOn), and the
         two count as the one activation. */
      u.rushArmed = true;
      logLine('note', u.label + ' — Adrenaline Rush: two actions in a row.');
      pushRes({
        kind: 'Honour', title: 'Adrenaline Rush', side: u.side,
        note: u.label + ' goes again the moment this action ends.',
        outcome: { text: 'Two actions in a row.', tone: 'good' }
      });
      ui.mode = 'idle'; render();
    }

    /* Check the area! (p. 52): the first location gives the objective up on a 5+,
       the second on a 4+, and the third is where it was all along. */
    function doSabotage(u) {
      var t = (E.state.scen.sabotageSpots(E.state, u) || [])[0];
      if (!t) return;
      t.destroyed = true;
      u.activated = true;
      var left = E.state.sc.targets.filter(function (x) { return !x.destroyed; }).length;
      logLine('note', u.label + ' destroys an objective — ' + left + ' left.');
      addFx({ kind: 'collapse', x: t.x, y: t.y, r: 2.6, dur: 800, blocking: true });
      if (SFX) { SFX.impact(); SFX.impact(0.12); SFX.shell(0.05); }
      pushRes({ kind: 'Sabotage', title: u.name + ' blows an objective', side: u.side,
        outcome: { text: left ? left + ' objective' + (left === 1 ? '' : 's') + ' still standing.' : 'That was the last of them.', tone: 'good' } });
      render();
      endActivation(u);
    }

    function doCheckArea(u) {
      var spot = SC.searchSpots(E.state, u)[0];
      if (!spot) return;
      var res = SC.checkArea(E.state, u, spot);
      u.activated = true;
      logLine('note', u.label + ' checks the area — D6 ' + res.roll + ' on ' + res.need + '+: ' +
        (res.found ? 'this is the place.' : 'nothing here.'));
      if (res.revealed) logLine('note', 'Two locations drawn blank — the objective has to be at the third. No search needed.');
      pushRes({
        kind: 'Search', title: u.name + ' checks the area', side: u.side,
        note: 'The ' + (res.order === 1 ? 'first' : res.order === 2 ? 'second' : 'third') +
          ' location searched — it gives the objective up on a ' + res.need + '+.',
        dice: [{ label: 'D6', value: res.roll, tone: res.found ? 'crit' : 'fail' }],
        outcome: res.found
          ? { text: 'Found it. Hold this ground to the end.', tone: 'good' }
          : res.revealed ? { text: 'Nothing here — so it must be at the last location. Go and hold it.', tone: 'warn' }
          : { text: 'Nothing here — one fewer place for it to be.', tone: 'warn' }
      });
      // the stake goes over at every searched location, and the beacon goes up at the real one
      paintStructures(); ui.vis = null; ui.visKey = '';
      render();
      endActivation(u);
    }

    function targetsFor(u, opts) {
      var out = activeUnits().filter(function (t) {
        return t.side !== u.side && R.canShoot(E.state, u, t, 'fire', opts);
      });
      /* A unit called up out of sequence by a Markerlight was activated to shoot
         the unit that was marked, and nothing else (p. 58). */
      var m = E.state.mark;
      if (m && E.state.chain && E.state.chain.kind === 'mark' && m.side === u.side &&
        m.targets.some(function (t) { return canAnswerMark(u, t, m.kind); })) {
        out = out.filter(function (t) { return m.targets.indexOf(t) >= 0; });
      }
      return out;
    }

    // a hull ends up pointing the way it drove
    /* A hull ends its drive facing the way its last straight leg ran; one that
       went backwards still faces the way it did (p. 35). Other machines turn to
       the way they went. */
    function faceAfter(u, path, pt) {
      if (path && path.facing !== undefined && R.drives(u)) {
        if (path.facing !== null) u.facing = path.facing;
        return;
      }
      faceAlong(u, u.x, u.y, pt.x, pt.y);
    }
    // (a squad's facing turns only its drawing: its crew-served pieces point the way it went)
    function faceAlong(u, fromX, fromY, toX, toY) {
      if (!R.isMachine(u)) u.aim = null;                // a piece on the move carries its weapon straight ahead
      if (Math.hypot(toX - fromX, toY - fromY) < 0.2) return;
      u.facing = Math.atan2(toY - fromY, toX - fromX);
    }

    /* A Tier III-V hull knocks over any low or high wall it drives across (p. 35). */
    function crushAlong(u, path) {
      if (!path || path.length < 2) return;
      var log = [], wrecks = [];
      for (var i = 1; i < path.length; i++) {
        R.crushOnMove(E.state, u, path[i - 1], path[i], log).forEach(function (w) { wrecks.push(w); });
      }
      if (!wrecks.length) return;
      log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      whenIdle(function () { repaintTerrain(wrecks); });
    }

    /* Some scenarios answer a move: the Demolish objective's SAM system opens up on
       any aircraft that finishes within 12" of it (p. 54). */
    // Evacuation: a civilian group that reaches the safe-zone building is safe (p. 154)
    function soloAfterMove(u) {
      if (!E.state.scen.afterMove || !u) return;
      var r = E.state.scen.afterMove(E.state, u);
      if (!r) return;
      logLine('note', r.text);
      pushRes({ kind: 'Evacuation', title: u.name + ' is safe', side: u.side, list: [{ text: r.text }] });
    }

    function scenarioMoveEnd(u) {
      soloAfterMove(u);
      samCheck(u);
    }
    /* Demolish's SAM system (p. 54) fires on "any aircraft finishing its move"
       within 12" — a Move, an Advance, a strafing run, the AI's own flying or an
       arrival from reserve alike. */
    function samCheck(u) {
      if (!E.state || !E.state.scen.onMoveEnd || !u || !u.alive) return;
      var res = E.state.scen.onMoveEnd(E.state, u);
      if (!res) return;
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      pushRes(fromLog('SAM system', 'The objective fires on ' + u.name,
        u.side === 'A' ? 'B' : 'A', res.log));
      render();
    }

    /* Aggressive (p. 116): the closest enemy this bug can charge, when it is not
       held back by an Overmind and one is in reach — or null when it is free. */
    function forcedCharge(u) {
      if (!E.state || !u) return null;
      /* Bloodlust (Battle Trauma, p. 89): the unit has to assault the closest enemy
         it can reach — Cumbersome Weapon or not. */
      var blood = R.campFlag(u, 'bloodlust') && !R.isMachine(u);
      if (!blood && !R.aggressiveNow(E.state, u)) return null;
      if (R.status(u) !== 'ready' || (!blood && R.has(u, 'Cumbersome Weapon'))) return null;
      if (R.has(u, 'Stationary Artillery') || R.has(u, 'Immobile')) return null;
      var best = null, bd = Infinity;
      assaultables(u).forEach(function (e) {
        var d = R.unitDist(u, e);
        if (d < bd) { bd = d; best = e; }
      });
      return best;
    }

    /* Psychic Wave (p. 116): move up to Movement, then every enemy within 12" —
       no line of sight, Drones excepted — takes D6-1 Suppression points. */
    function doWave(u, pt) {
      if (!u) return;
      var d = R.inches(u.x, u.y, pt.x, pt.y), wait = 0;
      if (d > 0.2) {
        var path = R.pathTo(E.state, u, u.move, pt);
        faceAfter(u, path, pt);
        u.x = pt.x; u.y = pt.y; ui.vis = null; ui.visKey = '';
        crushAlong(u, path);
        animateMove(u, path, isAI(u.side));
        wait = Math.min(1400, 240 + d * 42);
        logLine('move', u.label + ' moves ' + d.toFixed(1) + '".');
        soloAfterMove(u);
      }
      u.activated = true;
      ui.mode = 'idle'; ui.moves = []; ui.targets = [];
      if (!u.alive || u.x < 0) { endActivation(u); return; }
      var res = R.psychicWave(E.state, u);
      res.log.forEach(function (l) { logLine(l.t === 'hits' ? 'suppressed' : 'note', l.text); });
      addFx({ kind: 'wave', x: u.x, y: u.y, up: V.flyLift(u), r: 12, delay: wait, dur: wait + 1300, blocking: true });
      var list = res.log.slice(1).map(function (l) { return { text: l.text, side: u.side }; });
      whenIdle(function () {
        if (!E.state) return;
        pushRes({ kind: 'Psychic Wave', title: u.name + ' — Psychic Wave', side: u.side,
          note: 'Every enemy within 12", no line of sight needed: D6−1 Suppression each.', list: list });
      });
      render();
      endActivation(u);
    }


    // an Advance that moves and then does not shoot: the activation ends there
    function holdFire(u) {
      u.advancing = false;
      u.activated = true;
      logLine('note', u.label + ' holds its fire.');
      ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
      endActivation(u);
    }

    function doMove(pt) {
      var u = ui.selected;
      var d = R.inches(u.x, u.y, pt.x, pt.y);
      var carryFirst = ui.mode === 'carry-first';
      var allowance = ui.mode === 'advance-move' ? u.move : (ui.mode === 'carry-move' || carryFirst) ? u.move / 2 : u.move + moveBonus(u);
      u.carrying = false;
      if (u.vortexNow) {
        // the Movement parameter doubled, the move bonus on top of it as usual
        allowance += u.move; u.vortexNow = false; u.camp.once.vortex = true;
        logLine('note', u.label + ' — Time Vortex Generator: double Movement for this ' + (ui.mode === 'advance-move' ? 'Advance' : 'Move') + '.');
      }
      if (u.repairMove) { allowance = u.move; u.repairMove = false; }
      var path = R.pathTo(E.state, u, allowance, pt);
      faceAfter(u, path, pt);
      u.x = pt.x; u.y = pt.y; ui.vis = null; ui.visKey = '';
      flightTurn(u);                                 // Advanced Control System: the turn "after moving" (p. 143), from where it ends
      crushAlong(u, path);
      animateMove(u, path);
      if (carryFirst) {
        /* Driven its half: now it loads or unloads where it stands (p. 36). If
           there is nobody to take on and nobody aboard, that is the end of it. */
        logLine('move', u.label + ' drives ' + d.toFixed(1) + '" before loading.');
        scenarioMoveEnd(u);
        u.carryMoved = true; u.activated = false;
        ui.mode = 'idle'; ui.moves = []; ui.targets = []; ui.preview = null;
        var canLoad = (u.transport - (u.cargo || []).length) > 0 &&
          activeUnits(u.side).some(function (t2) { return R.canEmbark(E.state, u, t2); });
        if (!canLoad && !(u.cargo || []).length) { stayPut(u); return; }
        render();
        return;
      }
      if (ui.mode === 'advance-move') {
        /* Moved, and not yet shot: the unit is half-way through its Advance. It
           has used its move, so all that is left to it is the Advance's shot. */
        u.advancing = true;
        ui.mode = 'advance-fire'; ui.moves = [];
        // what it may shoot at: the enemy, and (NOT ONE STEP BACKWARDS!) a friend carrying Suppression
        ui.targets = targetsFor(u, {}).concat(R.steadyTargets(E.state, u));
        logLine('move', u.label + ' advances ' + d.toFixed(1) + '".');
        soloAfterMove(u);
        samCheck(u);
        if (!u.alive || u.x < 0) { u.activated = true; endActivation(); return; }
        if (!ui.targets.length) { u.activated = true; endActivation(); } else render();
        return;
      }
      var terr = R.TERRAIN[R.kindsUnder(E.state, u)[0]];
      logLine('move', u.label + ' moves ' + d.toFixed(1) + '"' + (terr.cover ? ' into ' + terr.name.toLowerCase() + '.' : '.'));
      u.activated = true;
      scenarioMoveEnd(u);
      endActivation();
    }

    /* The marker walks, then calls. "The unit may move up to its standard Movement
       range and designate an enemy unit within 24\"" (p. 58) — and having moved, it
       brings one gun down on the target rather than two. */
    function doMarkMove(pt) {
      var u = ui.selected;
      if (!u) return;
      var d = R.inches(u.x, u.y, pt.x, pt.y);
      var path = R.pathTo(E.state, u, u.move, pt);
      faceAfter(u, path, pt);
      u.x = pt.x; u.y = pt.y; ui.vis = null; ui.visKey = '';
      u.markMoved = true;
      crushAlong(u, path);
      animateMove(u, path);
      logLine('move', u.label + ' moves ' + d.toFixed(1) + '" to get eyes on.');
      ui.moves = [];
      ui.targets = markTargets(u);
      if (!ui.targets.length) {
        logLine('note', u.label + ' has nothing in sight to mark from there.');
        u.activated = true; ui.markPicks = []; ui.markKind = null;
        endActivation(u); return;
      }
      setHint(null, markHint(u));
      render();
    }

    /* Embark and Disembark (p. 36): the hull loads or unloads and "then may move up
       to half its Movement". The player's hull is offered that drive as a
       follow-up — tap the ground, or press the action again to stay put. */
    /* A transport's half move around loading or unloading (p. 36) — and "aircraft
       which transport troops follow the same rules as ground transport vehicles"
       (p. 39), so a transport craft flies its half as well. */
    function movesToCarry(u) { return R.drives(u) || (!!u && u.cls === 'aircraft' && u.move > 0 && !!u.transport); }
    /* A Suppressed unit "may only move to terrain which provides a Defence bonus,
       or out of the enemy's Line of Sight. If the unit already is in such a
       terrain or place, it cannot move to another one" (p. 34). Only enemies on
       the table see anything. */
    function safeSpot(u, x, y) {
      if (R.coverAt(E.state, x, y, u) > 0) return true;
      var ghost = { x: x, y: y, alive: true, of: u };
      var foes = E.state.units.filter(function (e) { return onTable(e) && e.side !== u.side; });
      /* "area or linear terrain" (p. 34): behind a low wall is cover too, when the
         wall stands between the unit and an enemy (or anyone's plunging fire) */
      var there = Object.create(u);
      there.x = x; there.y = y; there.bld = null;
      if (foes.some(function (e) { return /low wall/.test(R.coverFor(E.state, e, there).why); })) return true;
      return !foes.some(function (e) { return R.hasLoS(E.state, e, ghost); });
    }
    function alreadySafe(u) { return !!u.bld || safeSpot(u, u.x, u.y); }
    function carryMove(u) {
      ui.targets = []; ui.terrain = [];
      // it drove before it loaded or unloaded: that was its half move
      if (u.carryMoved) { u.carryMoved = false; ui.moves = []; ui.mode = 'idle'; endActivation(); return; }
      if (!movesToCarry(u) || isAI(u.side) || !u.alive) { endActivation(); return; }
      ui.moves = R.reachable(E.state, u, u.move / 2).filter(function (c) { return canStand(u, c); });
      if (!ui.moves.length) { ui.moves = []; endActivation(); return; }
      u.carrying = true; u.activated = false;         // not done yet: the drive is still to come
      ui.mode = 'carry-move';
      render();
    }
    function stayPut(u) {
      u.carrying = false; u.carryMoved = false; u.activated = true;
      ui.mode = 'idle'; ui.moves = []; ui.targets = []; ui.preview = null;
      logLine('note', u.label + ' stays where it is.');
      endActivation();
    }

    function doEmbark(target) {
      var u = ui.selected;
      var was = target ? { x: target.x, y: target.y } : null;
      var r = R.embark(E.state, u, target);
      if (!r) return;
      boardAnim(target, u, was);
      logLine('note', r.text);
      if (SFX) SFX.click();
      pushRes({
        kind: 'Embark', title: u.name + ' takes on troops', side: u.side,
        note: r.text, outcome: {
          text: 'Carrying ' + u.cargo.length + ' of ' + u.transport + '. Passengers are off the table until they debus.',
          tone: 'good'
        }
      });
      /* Embark (p. 36) loads "one or more" squads: with room left and somebody else
         in reach, another tap loads them too, and Cancel drives on without. */
      var more = !isAI(u.side) && u.cargo.length < u.transport &&
        activeUnits(u.side).filter(function (t2) { return R.canEmbark(E.state, u, t2); });
      if (more && more.length) {
        u.loading = true; u.activated = false;
        ui.mode = 'embark'; ui.targets = more;
        setHint(null, 'Room for ' + (u.transport - u.cargo.length) + ' more: tap another squad to load it — or Cancel to drive on.');
        render();
        return;
      }
      u.loading = false; u.activated = true;
      carryMove(u);
    }

    return {
      doOnce: doOnce, doSabotage: doSabotage, doCheckArea: doCheckArea, targetsFor: targetsFor,
      faceAfter: faceAfter, faceAlong: faceAlong, crushAlong: crushAlong, soloAfterMove: soloAfterMove,
      samCheck: samCheck, forcedCharge: forcedCharge, doWave: doWave, holdFire: holdFire, doMove: doMove,
      doMarkMove: doMarkMove, movesToCarry: movesToCarry, safeSpot: safeSpot, alreadySafe: alreadySafe,
      carryMove: carryMove, stayPut: stayPut, doEmbark: doEmbark
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineMoves;
})(typeof window !== 'undefined' ? window : global);
