/* PMC 2670 — Firefight : the OpFor: how the AI picks its moves, targets and ground

   Made once by engine.js for each game it runs, the first time it is wanted.
   E is what it needs of the engine: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineAI = function (E) {
    var H = E.H, R = E.R, SC = E.SC, SFX = E.SFX, UR = E.UR, W = E.W, abAssault = E.abAssault,
        abRally = E.abRally, abRepair = E.abRepair, activeUnits = E.activeUnits, alreadySafe = E.alreadySafe,
        animateMove = E.animateMove, assaultables = E.assaultables, boardAnim = E.boardAnim,
        canAnswerMark = E.canAnswerMark, canReachCharge = E.canReachCharge, chargeAllow = E.chargeAllow,
        crushAlong = E.crushAlong, deathsSince = E.deathsSince, doCheckArea = E.doCheckArea,
        doDesignate = E.doDesignate, doDisembark = E.doDisembark, doEnter = E.doEnter,
        doExitBld = E.doExitBld, doRegain = E.doRegain, doSelfRepair = E.doSelfRepair, doStance = E.doStance,
        doSteady = E.doSteady, doStrafe = E.doStrafe, doTeleport = E.doTeleport, doWave = E.doWave,
        endActivation = E.endActivation, faceAfter = E.faceAfter, forcedCharge = E.forcedCharge,
        fromLog = E.fromLog, insertionLegal = E.insertionLegal, landUnit = E.landUnit, logLine = E.logLine,
        markTargets = E.markTargets, martyrFirst = E.martyrFirst, moveBonus = E.moveBonus,
        nearestDeploySpot = E.nearestDeploySpot, objDist = E.objDist, objReach = E.objReach, onTable = E.onTable,
        playAssault = E.playAssault, pushRes = E.pushRes, relocCap = E.relocCap, relocSpotOK = E.relocSpotOK,
        repaintTerrain = E.repaintTerrain, repairCard = E.repairCard, resolveShot = E.resolveShot,
        samCheck = E.samCheck, scatterInsertion = E.scatterInsertion, sideName = E.sideName,
        snapshotAlive = E.snapshotAlive, soloAfterMove = E.soloAfterMove, soundFor = E.soundFor,
        stepOff = E.stepOff, ui = E.ui, whenIdle = E.whenIdle;
    /* The OpFor, having seen the other side go down: each unit standing in the
       open looks for cover somewhere else in its ground, the ones closest to the
       enemy first, and half the force at most makes the move. */
    function aiRelocate(side) {
      var cap = relocCap(side), n = 0;
      var foe = E.state.units.filter(function (e) { return e.side !== side && onTable(e); });
      function coverAt(x, y) { return R.coverAt(E.state, x, y); }
      function nearFoe(u) { return foe.reduce(function (m, e) { return Math.min(m, R.unitDist(u, e)); }, 999); }
      var cand = E.state.units.filter(function (u) {
        return u.side === side && u.alive && u.x >= 0 && !u.reserve && !u.aboard && !R.isMachine(u) && !coverAt(u.x, u.y);
      }).sort(function (a, b) { return nearFoe(a) - nearFoe(b); });
      cand.forEach(function (u) {
        if (n >= cap) return;
        var best = null, bs = 0;
        for (var k = 0; k < 160; k++) {
          var q = nearestDeploySpot(u, u.x + (Math.random() - 0.5) * 36, u.y + (Math.random() - 0.5) * 36, 40);
          if (!q || !relocSpotOK(u, q.x, q.y)) continue;
          var sc = coverAt(q.x, q.y) * 10 - Math.hypot(q.x - u.x, q.y - u.y) * 0.1;
          if (coverAt(q.x, q.y) && sc > bs) { bs = sc; best = q; }
        }
        if (best) { u.bld = null; u.sec = null; u.x = best.x; u.y = best.y; n++; }
      });
      if (n) logLine('note', sideName(side) + ' — Rapid Relocation: ' + n + ' unit' + (n === 1 ? '' : 's') + ' shift into cover.');
    }

    // the OpFor drops on the objective it most wants, or behind the player's line
    function aiInsert(u, done) {
      done = done || function () {};
      var want = null, wd = Infinity;
      E.state.objectives.forEach(function (o) {
        var held = o.owner && o.owner !== u.side ? -6 : 0;
        var d = held + R.inches(o.x, o.y, W / 2, H / 2);
        if (d < wd) { wd = d; want = o; }
      });
      for (var k = 0; k < 400; k++) {
        var ang = Math.random() * Math.PI * 2, rad = 12 + Math.random() * 8;
        var p = want
          ? { x: want.x + Math.cos(ang) * rad, y: want.y + Math.sin(ang) * rad }
          : { x: 8 + Math.random() * (W - 16), y: 4 + Math.random() * (H - 8) };
        if (!insertionLegal(p)) continue;
        if (R.unitNear(E.state, p.x, p.y, u, 1)) continue;
        u.x = p.x; u.y = p.y; u.reserve = false;
        logLine('note', u.label + ' comes in by Battlefield Insertion.');
        scatterInsertion(u, function () { landUnit(u); done(); });
        return;
      }
      // nowhere legal: it stays in reserve, to try again next Reserve phase (as the player's does)
      logLine('note', u.label + ' could find no drop zone and stays in reserve.');
      done();
    }

    /* The AI's reading of a wave: the spot within Movement that catches the most
       enemies inside 12", and how many that is. */
    function bestWaveSpot(u) {
      var foes = E.state.units.filter(function (e) {
        return e.alive && !e.aboard && e.x >= 0 && !e.reserve && e.side !== u.side && !e.drone && !R.has(e, 'Drone Control');
      });
      if (!foes.length) return null;
      function count(c) { return foes.filter(function (e) { return R.inches(c.x, c.y, e.x, e.y) - 2 * UR <= 12; }).length; }
      var best = { x: u.x, y: u.y }, bn = count(best), bs = bn * 10 + R.coverAt(E.state, u.x, u.y, u);
      R.reachable(E.state, u, u.move).forEach(function (c) {
        if ((Math.round(c.x * 2) % 2) || (Math.round(c.y * 2) % 2) || !canStand(u, c)) return;
        var n = count(c), sc = n * 10 + R.coverAt(E.state, c.x, c.y, u) - c.cost * 0.1;
        if (sc > bs) { bs = sc; bn = n; best = c; }
      });
      return { pt: best, n: bn };
    }

    // an Overgrown bug charging from the AI's hands, when something is in reach
    function aiCharge(u, t) {
      martyrFirst(u, t, function (m) {
        var snap = snapshotAlive();
        var res = abAssault(E.state, u, t, m);
        res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
        soundFor(res.log);
        var card = fromLog('Assault', u.name + ' → ' + t.name, u.side, res.log);
        playAssault(u, t, deathsSince(snap), function () { pushRes(card); });
        u.activated = true; endActivation(u);
      });
    }

    // the pad nearest to what the unit ought to be doing: the objective, else the enemy
    function aiPadFor(u, pads) {
      var goal = nearestObjective(u) || (nearestEnemy(u) || {}).unit;
      if (!goal) return null;
      var best = null, bd = Infinity;
      pads.forEach(function (p) {
        var d = R.inches(p.x, p.y, goal.x, goal.y);
        if (d < bd) { bd = d; best = p; }
      });
      return best;
    }

    // Machines think differently: they have no nerve to lose, they never charge,
    // and a transport's job is to get its passengers forward and put them down.
    function aiDrive(u) {
      var shot = bestTarget(u, 'fire');
      var carrying = (u.cargo || []).length;

      /* Xenotripod hardware: a Teleport unit sends the squad that gains most from
         the jump; anything with Molecular Reconstruction rebuilds when it is badly
         hurt and has nothing better to do; a turret never moves. */
      if (R.has(u, 'Teleport')) {
        var tj = aiTeleportPick(u);
        if (tj) { ui.teleportPick = tj.pad; doTeleport(u, tj.unit); return; }
      }
      if (R.has(u, 'Turret')) {
        if (shot.t) { fire(u, shot.t, 'fire'); return; }
        u.activated = true; endActivation(u); return;
      }

      // a solitaire OpFor hull rolls on the behaviour table like everything else (p. 147)
      var soloB = !!E.state.solo && u.side === 'B';
      /* ...and it rolls first: its special actions (self-repair, a transport's
         loading and unloading) are taken on a 1-6, not on Run for Your Lives! or
         Kill Them All! (a reading: the book does not place them on the table). */
      var bhV = soloB ? rollBehaviour(u) : null;
      var specialsV = !soloB || ['defensive', 'neutral', 'offensive'].indexOf(bhV) >= 0;
      if (soloB && (bhV === 'defensive' || bhV === 'neutral')) shot = threatTarget(u, 'fire');   // the biggest threat (SOL-6)
      if (specialsV && R.has(u, 'Molecular Reconstruction') && u.damage && (u.damage >= u.str - 1 || !shot.t)) {
        doSelfRepair(u); return;
      }
      /* An Overgrown bug is a beast, not a hull: the Queen sends out her wave when
         it catches two or more, and anything with more bite than spit charges. */
      if (R.isOvergrown(u) && R.status(u) !== 'broken' && !soloB) {
        if (R.has(u, 'Psychic Wave') && R.status(u) === 'ready') {
          var wq = bestWaveSpot(u);
          if (wq && wq.n >= 2) { doWave(u, wq.pt); return; }
        }
        var prey = nearestEnemy(u);
        if (prey && R.status(u) === 'ready' && R.canAssault(u, prey.unit) && prey.dist <= chargeAllow(u) && canReachCharge(u, prey.unit) &&
          (u.fp == null || u.assault >= u.fp || !shot.t)) { aiCharge(u, prey.unit); return; }
      }

      /* A Rapid insertion platform does one thing and then it is scenery (p. 79). */
      if (R.has(u, 'Immobile')) {
        if (carrying) {
          // the squad steps off towards the nearest enemy, wherever it may be put down
          var foeP = nearestEnemy(u), want = foeP ? foeP.unit : { x: u.x, y: u.y };
          var spot = nearestTo(E.dropFor(u), want);
          ui.selected = u; doDisembark(spot || { x: u.x, y: u.y }, true); return;
        }
        u.activated = true; endActivation(u); return;
      }

      // a transport with troops aboard heads for the nearest objective and unloads
      if (carrying && specialsV) {
        var obj = nearestObjective(u);
        if (obj && R.inches(u.x, u.y, obj.x, obj.y) < 9) {
          // each squad put down where it may be (R.dropSpots), as near the hull's front as it can
          var spot = { x: u.x + Math.cos(u.facing || 0) * 2.5, y: u.y + Math.sin(u.facing || 0) * 2.5 };
          var lines = [];
          (u.cargo || []).slice().forEach(function (rider) {
            var at = nearestTo(R.dropSpots(E.state, u, rider).filter(function (c) { return canStand(rider, c); }), spot);
            var r = R.disembark(E.state, u, rider, at);
            if (r) { logLine('note', r.text); lines.push({ text: r.text }); stepOff(rider, u); }
          });
          if (SFX) { SFX.step(); SFX.step(0.22); }
          u.activated = true;
          pushRes({ kind: 'Disembark', title: u.name + ' unloads', side: u.side, list: lines });
          endActivation(); return;
        }
        /* An OpFor hull told to hold — Reasonably Defensive or Neutral (p. 147) — keeps
           its troops aboard where it stands, rather than driving them in. */
        if (!(soloB && (bhV === 'defensive' || bhV === 'neutral'))) return aiRoll(u, obj || nearestEnemy(u), true);
      }

      // an empty transport picks up the nearest squad that will fit
      if (u.transport && !carrying && specialsV) {
        var pax = activeUnits(u.side).filter(function (t) { return R.canEmbark(E.state, u, t); });
        if (pax.length) {
          var was2 = { x: pax[0].x, y: pax[0].y };
          var r2 = R.embark(E.state, u, pax[0]);
          if (r2) boardAnim(pax[0], u, was2);
          logLine('note', r2.text);
          u.activated = true;
          pushRes({ kind: 'Embark', title: u.name + ' takes on troops', side: u.side, note: r2.text });
          endActivation(); return;
        }
      }

      if (soloB) {
        var bh = bhV;
        // Run for Your Lives!: a Move as far as it can get from the player's units, no shot
        if (bh === 'flee') return aiRoll(u, nearestEnemy(u), false, { flee: true, noShoot: true });
        // Kill Them All!: charge the closest enemy — only an Overgrown bug can — or else Move at it, no shot
        if (bh === 'assault') {
          // "Whenever an OpFor unit can attack the VIP unit, it will do so" (p. 152): a hull shoots it
          if (E.state.scen.mustTarget && shot.forced && shot.t) { fire(u, shot.t, 'fire'); return; }
          var prey2 = nearestEnemy(u);
          if (R.isOvergrown(u) && prey2 && R.status(u) === 'ready' && R.canAssault(u, prey2.unit) &&
            prey2.dist <= chargeAllow(u) && canReachCharge(u, prey2.unit)) { aiCharge(u, prey2.unit); return; }
          return aiRoll(u, prey2, false, { close: true, noShoot: true });
        }
        // Reasonably Defensive or Neutral: engage from where it stands, or keep its distance
        if (bh === 'defensive' || bh === 'neutral') {
          if (shot.t) { fire(u, shot.t, 'fire'); return; }
          // Neutral "holds its position" (p. 147) as Defensive does: a hull has no cover to make for
          logLine('ai', u.label + (bh === 'defensive' ? ' holds back.' : ' holds its position.'));
          u.activated = true; endActivation(u); return;
        }
        // Reasonably Offensive: on at them, as it always did
      }
      /* An aircraft makes a run when there is a line of targets: two or more under
         it — every one of them gets a free shot back — or one when there is no
         ordinary shot to take instead. */
      if (u.cls === 'aircraft' && u.fp !== null) {
        var lane = bestStrafe(u);
        if (lane && (lane.count >= 2 || (lane.count === 1 && !shot.t))) { ui.selected = u; doStrafe(lane.pt); return; }
      }

      // badly damaged and nothing worth shooting: pull back and patch up
      if (u.damage >= u.str && !shot.t) {
        var rep = abRepair(E.state, u);
        logLine('rally', rep ? rep.text : u.label + ' stands down.');
        if (rep) pushRes(repairCard(u, rep));
        u.activated = true; endActivation(); return;
      }

      if (shot.t && shot.score > 0.35) { fire(u, shot.t, 'fire'); return; }
      aiRoll(u, nearestEnemy(u), false);
    }

    /* Advanced Control System (p. 143): after a Move the aircraft may turn up to
       90° — it swings its nose toward the nearest enemy, as far as that allows. */
    function flightTurn(u) {
      if (!u || u.cls !== 'aircraft' || !R.campFlag(u, 'advControl')) return;
      var ne = nearestEnemy(u);
      if (!ne) return;
      var want = Math.atan2(ne.unit.y - u.y, ne.unit.x - u.x), d = R.angleWrap(want - (u.facing || 0));
      u.facing = (u.facing || 0) + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d));
    }

    // which squad a Teleport unit should send, and where: worth it only for a real jump
    function aiTeleportPick(tp) {
      var pax = R.teleportFrom(E.state, tp), pads = R.teleportPads(E.state, tp.side);
      if (!pax.length || pads.length < 2) return null;
      var best = null;
      pax.forEach(function (u) {
        var goal = nearestObjective(u) || (nearestEnemy(u) || {}).unit;
        if (!goal) return;
        var now = R.inches(u.x, u.y, goal.x, goal.y);
        pads.forEach(function (p) {
          if (p === tp) return;
          var gain = now - R.inches(p.x, p.y, goal.x, goal.y);
          if (gain > 8 && (!best || gain > best.gain)) best = { unit: u, pad: p, gain: gain };
        });
      });
      return best;
    }

    // drive toward something, then shoot if anything comes into arc
    /* `o.flee`: as far from the goal (the nearest enemy) as it can get; `o.close`:
       as close as it can get; `o.noShoot`: a Move, so no shot after it. */
    function aiRoll(u, goalUnit, cautious, o) {
      o = o || {};
      var goal = goalUnit && goalUnit.unit ? { x: goalUnit.unit.x, y: goalUnit.unit.y }
        : goalUnit ? { x: goalUnit.x, y: goalUnit.y } : pickGoal(u, 'offensive');
      /* Either an Advance — its Movement, then a shot — or a Move: Movement and the
         +4" (p. 36), with no shot after it. A hull told not to shoot, carrying a
         Cumbersome Weapon (which may not advance, p. 57) or with no gun takes the Move. */
      var advance = !o.noShoot && u.fp != null && !R.has(u, 'Cumbersome Weapon');
      var allowance = advance ? u.move : u.move + moveBonus(u, 'move');
      var spots = R.reachable(E.state, u, allowance).filter(function (c) { return canStand(u, c); }), best = null, bestD = Infinity;
      var want = cautious ? 6 : Math.max(4, u.range * 0.45);
      spots.forEach(function (c) {
        var gd = R.inches(c.x, c.y, goal.x, goal.y);
        var d = o.flee ? -gd : o.close ? gd : Math.abs(gd - want);
        if (d < bestD) { bestD = d; best = c; }
      });
      if (best && R.inches(u.x, u.y, best.x, best.y) > 0.6) {
        var path = R.pathTo(E.state, u, allowance, best);
        faceAfter(u, path, best);
        var dist = R.inches(u.x, u.y, best.x, best.y);
        u.x = best.x; u.y = best.y;
        if (!advance) flightTurn(u);                // Advanced Control System: on a Move action only (p. 143)
        logLine('move', u.label + ' drives ' + dist.toFixed(1) + '".');
        crushAlong(u, path);
        animateMove(u, path, true);
        samCheck(u);
        if (!u.alive) { u.activated = true; whenIdle(function () { if (E.state && !E.state.over) endActivation(u); }); return; }
      }
      var t2 = advance ? bestTarget(u, 'advance') : {};
      if (t2.t && t2.score > 0.2) {
        whenIdle(function () { if (E.state && !E.state.over && u.alive) fire(u, t2.t, 'advance'); });
        return;
      }
      u.activated = true;
      whenIdle(function () { if (E.state && !E.state.over) endActivation(u); });
    }

    /* What the AI walks towards. Usually the objectives; in Find and secure, until
       the objective turns up, the locations nobody has checked yet. */
    function goalPoints() {
      if (E.state.scen.goals) return E.state.scen.goals(E.state);
      if (E.state.objectives.length) return E.state.objectives;
      if (E.state.sc && E.state.sc.search && !E.state.sc.found) {
        return E.state.sc.search.filter(function (sp) { return !sp.checked; });
      }
      return [];
    }

    function nearestObjective(u) {
      var best = null, bd = Infinity;
      goalPoints().forEach(function (o) {
        var d = R.inches(u.x, u.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      });
      return best;
    }

    // the flight path that catches the most enemies
    function bestStrafe(u) {
      var spots = R.reachable(E.state, u, u.move), best = null;
      spots.forEach(function (c) {
        if ((Math.round(c.x * 2) % 2) || (Math.round(c.y * 2) % 2)) return;
        if (!canStand(u, c)) return;                     // nowhere it could not hover (p. 38)
        var n = 0, own = 0;
        activeUnits().forEach(function (t) {
          if (t === u || R.isFlying(t) || husk(t)) return;
          if (R.pointSegDist(t.x, t.y, u.x, u.y, c.x, c.y) > 2.2) return;
          if (t.side === u.side) own++; else n++;
        });
        // never a run over its own side's ground units: they would be caught on a 1-3
        if (n && !own && (!best || n > best.count)) best = { pt: c, count: n };
      });
      return best;
    }

    // how far a unit stands from the nearest of the other side's units on the table
    function gapToFoes(u) {
      var d = Infinity;
      E.state.units.forEach(function (e) { if (onTable(e) && e.side !== u.side) d = Math.min(d, R.unitDist(u, e)); });
      return d;
    }

    // a scenario may put ground off limits: the VIP's leash, the safe zone the OpFor cannot enter
    // of the spots given, the one nearest p (null if there are none)
    function nearestTo(spots, p) {
      var best = null, bd = Infinity;
      (spots || []).forEach(function (c) { var d = R.inches(c.x, c.y, p.x, p.y); if (d < bd) { bd = d; best = c; } });
      return best;
    }
    function canStand(u, c) {
      // an aircraft keeps low: never over a tall building or a hilltop (p. 38)
      if (R.isFlying(u) && R.tooHighToHover(E.state, c.x, c.y)) return false;
      return !E.state.scen.moveOK || E.state.scen.moveOK(E.state, u, c);
    }

    function expectedHits(u, t, mode, opts) {
      if (!R.canShoot(E.state, u, t, mode, opts)) return -1;
      var d = R.unitDist(u, t);
      var mods = (opts && opts.aux ? 1 : u.fp) + R.sizeBonus(u.models);
      if (mode === 'fire') mods += 1;
      if (d <= u.range / 2) mods += 2;
      if (R.levelOf(E.state, u) > 0) mods += 2;
      var def = R.defenceAgainst(E.state, u, t, {}).value;
      var e = 0;
      for (var roll = 1; roll <= 9; roll++) {
        e += (roll === 9 ? Math.max(1, roll + mods - def) : Math.max(0, roll + mods - def)) / 10;
      }
      var st = R.status(t);
      if (st === 'suppressed') e *= 1.25;
      if (st === 'broken') e *= 1.4;
      if (t.models <= 2) e *= 1.2;
      return e;
    }

    /* An empty Rapid insertion platform is scenery with a Defence value: it counts
       for no victory condition (p. 79) and carries nobody, so shooting it, charging
       it or walking towards it gains nothing. One with a squad still inside is
       another matter. */
    function husk(t) { return !R.countsForVictory(t) && !(t.cargo || []).length; }

    function bestTarget(u, mode, opts) {
      var best = { t: null, score: -1 };
      /* Protecting the VIP: "whenever an OpFor unit can attack the VIP unit, it
         will do so" (p. 151) — whatever else is a better shot. */
      if (E.state.scen.mustTarget && u.side === 'B') {
        var vip = E.state.scen.mustTarget(E.state, u);
        if (vip && vip.alive && onTable(vip)) {
          var ev = expectedHits(u, vip, mode || 'fire', opts);
          if (ev >= 0) return { t: vip, score: Math.max(ev, 0.5), forced: true };
        }
      }
      E.state.units.forEach(function (t) {
        // an enemy in reserve or riding in a hull is not on the table to be shot at
        if (!t.alive || t.side === u.side || !onTable(t) || husk(t)) return;
        var e = expectedHits(u, t, mode || 'fire', opts);
        if (e > best.score) best = { t: t, score: e };
      });
      return best;
    }

    /* Reasonably Defensive and Neutral (p. 147): "The OpFor unit engages the enemy unit
       which poses the biggest threat. If you're not sure which one it is, choose the
       target at random or select the mission objective" — where Reasonably Offensive
       "attacks the enemies where they can do the most damage" (bestTarget, above).
       The threat an enemy poses is the most it could do to any one of the OpFor's
       units it can reach — its shooting, and a charge if one is in reach — and an
       enemy on or by a mission objective counts as the biggest threat of all (the
       owner's ruling, rules review a119ac2 SOL-6). Only a target this unit can hurt
       is chosen; the score handed back is still the hits it expects to do. */
    function objectivePoints() {
      var pts = (E.state.objectives || []).map(function (o) { return { x: o.x, y: o.y }; });
      var sc = E.state.sc || {};
      (sc.targets || []).forEach(function (o) { if (!o.done && !o.destroyed) pts.push({ x: o.x, y: o.y }); });
      if (sc.found) pts.push({ x: sc.found.x, y: sc.found.y });
      return pts;
    }
    function threatOf(t, side, pts) {
      var worst = 0;
      E.state.units.forEach(function (o) {
        if (!o.alive || o.side !== side || !onTable(o)) return;
        var e = t.fp != null ? Math.max(0, expectedHits(t, o, 'fire')) : 0;
        if (t.assault > 0 && R.canAssault(t, o) && R.unitDist(t, o) <= (t.move || 0) + 2) e += 0.15 * t.assault;
        if (e > worst) worst = e;
      });
      var onObj = pts.some(function (p) { return R.inches(t.x, t.y, p.x, p.y) <= 4 + R.UNIT_R; });
      return worst + (onObj ? 3 : 0);
    }
    function threatTarget(u, mode, opts) {
      var forced = bestTarget(u, mode, opts);
      if (forced.forced) return forced;                   // the VIP first, always (p. 151)
      var pts = objectivePoints(), best = { t: null, score: -1, threat: -1 };
      E.state.units.forEach(function (t) {
        if (!t.alive || t.side === u.side || !onTable(t) || husk(t)) return;
        var e = expectedHits(u, t, mode || 'fire', opts);
        if (e <= 0) return;
        var th = threatOf(t, u.side, pts);
        if (th > best.threat + 0.05 || (Math.abs(th - best.threat) <= 0.05 && e > best.score)) best = { t: t, score: e, threat: th };
      });
      return best.t ? best : forced;
    }

    function nearestEnemy(u) {
      var best = null, bd = Infinity;
      E.state.units.forEach(function (t) {
        // only enemies on the table: one waiting in reserve sits off its corner, and chasing it walks nowhere
        if (!t.alive || t.side === u.side || !onTable(t) || husk(t)) return;
        var d = R.unitDist(u, t);
        if (d < bd) { bd = d; best = t; }
      });
      return best ? { unit: best, dist: bd } : null;
    }

    /* The behaviour table (p. 147), rolled for every unit as it activates —
       a hull or an aircraft as much as a squad. */
    function rollBehaviour(u) {
      var roll = R.d6(), mods = 0, why = [];
      var fp = u.fp || 0, as = u.assault || 0;
      if (as >= 2 * fp && as > 0) { mods += 2; why.push('Assault ≥ 2× Firepower +2'); }
      else if (as > fp) { mods += 1; why.push('Assault > Firepower +1'); }
      // a plain distance (p. 147): an enemy in range behind a building is still within it
      if (!R.enemyWithinRange(E.state, u)) { mods += 2; why.push('no enemy in range +2'); }
      // the scenario's own temper: aggressive, defensive, or aggressive near the objectives
      if (E.state.solo && u.side === 'B' && E.state.scen.behaviour) {
        var bm = E.state.scen.behaviour(E.state, u) || {};
        if (bm.mod) { mods += bm.mod; why.push(bm.why || ((bm.mod > 0 ? '+' : '') + bm.mod)); }
      }
      var total = roll + mods;
      var behaviour = total <= 0 ? 'flee' : total <= 2 ? 'defensive' : total <= 4 ? 'neutral' : total <= 6 ? 'offensive' : 'assault';
      // units with Cumbersome Weapons count 4-7 as Reasonably Neutral (p. 147)
      if (R.has(u, 'Cumbersome Weapon') && total >= 4 && total <= 7) behaviour = 'neutral';
      logLine('ai', u.label + ' — behaviour D6 ' + roll + (why.length ? ' (' + why.join(', ') + ')' : '') + ' = ' + total + ': ' + behaviour + '.');
      return behaviour;
    }

    /* The once-a-battle honours (p. 88), which the AI spends as a player would.
       Last Stand: a Broken unit cannot act, and runs in the End phase, so it stands
       as soon as its side has the go (and in the End phase, endphase.js); a
       Suppressed one stands when it has an enemy in range to fight. Otherwise
       the stand is kept for the rally that would see the unit flee. */
    function aiStands(side) {
      E.state.units.forEach(function (u) {
        if (u.side === side && R.status(u) === 'broken' && E.standable(u)) E.makeStand(u, 'rather than stay broken');
      });
    }
    function aiHonours(u) {
      if (u.side !== E.state.activeSide || u.hijack) return;
      if (R.status(u) === 'suppressed' && E.standable(u) && R.enemyWithinRange(E.state, u) && !R.deathOrGlory(E.state, u)) {
        E.makeStand(u, 'to fight on');
      }
      /* Adrenaline Rush: two actions in a row, spent when the first is a good shot
         (a hit or better expected), as the second will very likely be another. */
      if (R.campFlag(u, 'adrenaline') && !E.spent(u, 'adrenaline') && E.state.rush !== u.id && R.status(u) === 'ready') {
        var rs = bestTarget(u, 'fire');
        if (rs.t && rs.score >= 1) E.doOnce(u, 'rush');
      }
    }

    function aiAct(u) {
      /* Decapitation: the OpFor's leaders "always act according to the Reasonably
         Defensive result and never Move nor Advance" (p. 152) — whatever state they
         are in, they shoot from where they are or keep their heads down. */
      if (E.state.scen.noMove && E.state.scen.noMove(E.state, u)) {
        /* Reasonably Defensive: the biggest threat (SOL-6); Suppressed, its Auxiliary
           weapons — the one shot a pinned unit has (p. 34; rules review a119ac2 SOL-8) */
        var pinned = R.status(u) !== 'ready';
        var still = threatTarget(u, 'fire', pinned ? { aux: true } : undefined);
        logLine('ai', u.label + ' holds its position (Reasonably Defensive).');
        if (still.t) { resolveShot(u, still.t, 'fire', pinned ? { aux: true } : {}); return; }
        if (u.sp) {
          var rr0 = abRally(E.state, u, { regroup: true });
          if (rr0) { logLine('rally', rr0.text); pushRes(E.regroupCard(u, rr0)); E.regroupFx(u, rr0); }
        }
        u.activated = true; endActivation(u); return;
      }
      aiHonours(u);
      if (R.isMachine(u)) { aiDrive(u); return; }
      /* "Death or Glory, Comrades!" (p. 94): a shaken unit with a leader shouting
         at it goes in rather than going to ground — that is the whole point of the
         rule, and the Suppression falls away as the charge starts. */
      if (R.status(u) === 'suppressed' && R.deathOrGlory(E.state, u) && !R.has(u, 'Cumbersome Weapon')) {
        var dogT = nearestEnemy(u);
        if (dogT && R.canAssault(u, dogT.unit) && dogT.dist <= chargeAllow(u) && canReachCharge(u, dogT.unit)) {
          martyrFirst(u, dogT.unit, function (m) {
            var dsnap = snapshotAlive();
            var dres = abAssault(E.state, u, dogT.unit, m);
            dres.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
            soundFor(dres.log);
            var dcard = fromLog('Assault', u.name + ' → ' + dogT.unit.name, u.side, dres.log);
            playAssault(u, dogT.unit, deathsSince(dsnap), function () { pushRes(dcard); });
            u.activated = true; endActivation(u);
          });
          return;
        }
      }
      /* A Suppressed solitaire OpFor unit still rolls its behaviour (p. 147), and takes
         from what a Suppressed unit may do (p. 34) — a Move into cover or out of sight,
         a Fire! with its Auxiliary weapons, or Pass/Regroup — the one that answers the
         roll (the owner's ruling, rules review a119ac2 SOL-8). */
      if (R.status(u) === 'suppressed' && E.state.solo && u.side === 'B') { pinnedOpFor(u); return; }
      // a pinned squad beside an empty building gets inside it
      if (R.status(u) === 'suppressed' && !alreadySafe(u)) {
        var sin = R.enterTargets(E.state, u);
        if (sin.length) {
          sin.sort(function (a, b) { return R.rectPointDist(a.rect, u.x, u.y) - R.rectPointDist(b.rect, u.x, u.y); });
          logLine('ai', u.label + ' is suppressed and gets into the nearest building.');
          doEnter(u, sin[0]); return;
        }
      }
      if (R.status(u) === 'suppressed') {
        var spots = R.reachable(E.state, u, u.move + 2).filter(function (c) { return R.coverAt(E.state, c.x, c.y, u) > 0 && canStand(u, c); });
        if (spots.length && !alreadySafe(u)) {
          spots.sort(function (a, b) { return a.cost - b.cost; });
          var spath = R.pathTo(E.state, u, u.move + 2, spots[0]);
          u.x = spots[0].x; u.y = spots[0].y;
          animateMove(u, spath, true);
          logLine('move', u.label + ' is suppressed and scrambles into ' + R.TERRAIN[R.kindsUnder(E.state, u)[0]].name.toLowerCase() + '.');
        } else {
          var rr = abRally(E.state, u, { regroup: true });
          logLine('rally', rr ? rr.text : u.label + ' regroups.');
          if (rr) { pushRes(E.regroupCard(u, rr)); E.regroupFx(u, rr); }
        }
        u.activated = true; endActivation(u); return;
      }

      /* A solitaire OpFor unit rolls its behaviour as it activates (p. 147), before
         anything else; its special actions are taken on a 1-6 — not on Run for
         Your Lives! or Kill Them All! (a reading: the book does not place them on
         the table). Everyone else keeps the AI's own order. */
      var soloI = !!E.state.solo && u.side === 'B';
      var preB = soloI ? rollBehaviour(u) : null;
      var specials = !soloI || ['defensive', 'neutral', 'offensive'].indexOf(preB) >= 0;

      // a Crock steadies its Esh-Aven when enough of them are shaken
      if (specials && R.has(u, 'Dominant Species') && R.status(u) === 'ready') {
        var rgt = R.regainTargets(E.state, u);
        var shaken = rgt.reduce(function (n, o) { return n + o.sp; }, 0);
        if (rgt.some(function (o) { return R.status(o) !== 'ready'; }) || shaken >= 4) { doRegain(u); return; }
      }
      // Aggressive bugs with no Overmind near charge the closest enemy in reach (p. 116)
      var mustC = forcedCharge(u);
      if (mustC) { logLine('ai', u.label + (R.campFlag(u, 'bloodlust') ? ' — Bloodlust' : ' — Aggressive') + ': charges the closest enemy.'); aiCharge(u, mustC); return; }
      /* NOT ONE STEP BACKWARDS! (T5): a commander, or a unit beside one, puts a burst
         over the heads of a broken friend — or one badly shaken — to get it moving */
      if (specials && R.steadyShooter(E.state, u)) {
        var shaken2 = R.steadyTargets(E.state, u).filter(function (t) { return R.status(t) === 'broken' || (t.sp || 0) >= 4; })
          .sort(function (a, b) { return (b.sp || 0) - (a.sp || 0); })[0];
        if (shaken2) { logLine('ai', u.label + ' — NOT ONE STEP BACKWARDS!: steadies ' + shaken2.label + '.'); doSteady(shaken2, u); return; }
      }
      // a Psychic Wave that catches two or more is worth more than a shot
      if (specials && R.has(u, 'Psychic Wave') && R.status(u) === 'ready') {
        var wv = bestWaveSpot(u);
        if (wv && wv.n >= 2) { doWave(u, wv.pt); return; }
      }

      // standing over an unchecked location is worth more than any other action
      if (specials && SC.searchSpots(E.state, u).length) { doCheckArea(u); return; }

      /* An emplaced gun cannot manoeuvre, so its only decision is its stance: with
         an enemy inside 24" and in front of it, direct fire hits far harder than
         Basic Firepower does (p. 94). */
      if (specials && R.has(u, 'Stationary Artillery')) {
        var close = E.state.units.filter(function (e) {
          return e.alive && !e.aboard && e.side !== u.side && !husk(e) && R.unitDist(u, e) <= 24 &&
            R.unitDist(u, e) >= 6 && R.hasLoS(E.state, u, e);
        });
        if ((close.length > 0) !== !!u.dugIn) { doStance(u); return; }
      }

      /* A marker is worth more than the shot the unit could take itself: it puts two
         friendly guns onto the target at once (p. 58, and Smoke Markers on p. 94). */
      if (specials && (R.has(u, 'Markerlights') || R.has(u, 'Smoke Markers'))) {
        /* Designating is worth more than the shot this unit could take itself, so
           it is tried first — and the kind that brings the most guns wins. */
        var kinds = R.has(u, 'Markerlights') ? ['designate', 'mark'] : ['designate'];
        var best = null;
        kinds.forEach(function (k) {
          var marks = markTargets(u).filter(function (t) {
            return E.state.units.some(function (o) {
              return o.alive && !o.aboard && !o.activated && !o.reserve && o.side === u.side && o !== u &&
                R.status(o) !== 'broken' && canAnswerMark(o, t, k);
            });
          });
          if (!marks.length) return;
          marks.sort(function (a2, b2) { return (b2.models || 1) * b2.tier - (a2.models || 1) * a2.tier; });
          var worth = (marks[0].models || 1) * marks[0].tier + (k === 'designate' ? 1 : 0);
          if (!best || worth > best.worth) best = { kind: k, target: marks[0], worth: worth };
        });
        if (best) {
          ui.markPicks = []; ui.markKind = best.kind;
          u.markMoved = false;
          doDesignate(best.target, u, best.kind);
          return;
        }
      }

      var behaviour = preB || rollBehaviour(u);
      // Defensive and Neutral OpFor engage the biggest threat; everyone else the best shot (SOL-6)
      var shot = soloI && (behaviour === 'defensive' || behaviour === 'neutral') ? threatTarget(u, 'fire') : bestTarget(u, 'fire');
      /* Kill Them All! (p. 147): "The unit makes an Assault action, charging at the
         closest enemy unit. If there are no valid targets, it makes a Move towards
         the closest enemy" — a Move, so it does not shoot as well. */
      var killAll = !!E.state.solo && u.side === 'B' && behaviour === 'assault';

      /* A garrison (p. 41) shoots from where it is, charges only an enemy in the
         next section, and comes out when it wants to press on and has nothing to
         shoot at. Otherwise it holds the building. */
      if (u.bld) {
        /* Run for Your Lives! (p. 147): a garrison gets out, through the wall away
           from the nearest enemy, and does not stop to shoot. With no way out it
           keeps its head down. */
        if (behaviour === 'flee') {
          var nf = nearestEnemy(u), outF = R.exitSpots(E.state, u);
          if (outF.length && nf) {
            outF.sort(function (a, b) { return R.inches(b.x, b.y, nf.unit.x, nf.unit.y) - R.inches(a.x, a.y, nf.unit.x, nf.unit.y); });
            logLine('ai', u.label + ' bolts out of the building, away from the enemy.');
            doExitBld(u, outF[0]); return;
          }
          logLine('ai', u.label + ' keeps its head down in the building.');
          u.activated = true; endActivation(u); return;
        }
        if (behaviour === 'assault' && !R.has(u, 'Cumbersome Weapon')) {
          var adj = assaultables(u, 0)[0];
          if (adj) { aiCharge(u, adj); return; }
        }
        if (shot.t && shot.score > 0.2 && (!killAll || shot.forced)) { fire(u, shot.t, 'fire'); return; }
        if (behaviour === 'offensive' || behaviour === 'assault') {
          var goalB = pickGoal(u, behaviour), outs = R.exitSpots(E.state, u);
          if (outs.length) {
            outs.sort(function (a, b) { return R.inches(a.x, a.y, goalB.x, goalB.y) - R.inches(b.x, b.y, goalB.x, goalB.y); });
            logLine('ai', u.label + ' comes out of the building to press on.');
            doExitBld(u, outs[0]); return;
          }
        }
        logLine('ai', u.label + ' holds the building.');
        u.activated = true; endActivation(u); return;
      }
      var ne = nearestEnemy(u);
      // the VIP draws the charge too, when it is in reach
      if (behaviour === 'assault' && E.state.scen.mustTarget && u.side === 'B') {
        var vipA = E.state.scen.mustTarget(E.state, u);
        if (vipA && vipA.alive && onTable(vipA) && R.canAssault(u, vipA) && canReachCharge(u, vipA)) ne = { unit: vipA, dist: R.unitDist(u, vipA) };
        /* "Whenever an OpFor unit can attack the VIP unit, it will do so" (p. 152): one
           that cannot charge it but can shoot it does that, rather than charging
           someone else or only moving (a hull on 7+ included). */
        else if (shot.forced && shot.t) { fire(u, shot.t, 'fire'); return; }
      }
      if (behaviour === 'assault' && ne && R.canAssault(u, ne.unit) && ne.dist <= chargeAllow(u) && canReachCharge(u, ne.unit) && !R.has(u, 'Cumbersome Weapon')) {
        var nt = ne.unit;
        martyrFirst(u, nt, function (m) {
          var snap = snapshotAlive();
          var res = abAssault(E.state, u, nt, m);
          res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
          soundFor(res.log);
          var card = fromLog('Assault', u.name + ' → ' + nt.name, u.side, res.log);
          playAssault(u, nt, deathsSince(snap), function () { pushRes(card); });
          u.activated = true; endActivation(u);
        });
        return;
      }
      /* Reasonably Neutral, in a solitaire game (p. 147): "Unit holds its position,
         engaging the enemy. If there is suitable cover within its Movement distance,
         the unit will make an Advance action towards that terrain piece, but only if
         it won't reduce the effectiveness of the unit's attack" — it does not leave
         cover for a better shot. So: a spot within Movement with better cover than
         here, from which its best shot is at least as good as the one it has; else
         it fires from where it is, or holds. */
      if (E.state.solo && u.side === 'B' && behaviour === 'neutral') { neutralHold(u, shot); return; }
      if ((behaviour === 'defensive' || behaviour === 'neutral' || shot.forced) && shot.t && shot.score > 0.4) {
        fire(u, shot.t, 'fire'); return;
      }

      // a cautious squad next to an empty building takes it rather than standing in the open
      if ((behaviour === 'defensive' || behaviour === 'neutral') && R.coverAt(E.state, u.x, u.y, u) === 0 && Math.random() < 0.7) {
        var ins = R.enterTargets(E.state, u);
        if (ins.length) {
          ins.sort(function (a, b) { return R.rectPointDist(a.rect, u.x, u.y) - R.rectPointDist(b.rect, u.x, u.y); });
          logLine('ai', u.label + ' takes the building beside it.');
          doEnter(u, ins[0]); return;
        }
      }
      var goal = pickGoal(u, behaviour);
      /* An Advance (Movement, then a shot) unless it is running, charging in, or
         carries a Cumbersome Weapon, which may not advance (p. 57): that is a Move. */
      var noAdv = R.has(u, 'Cumbersome Weapon');
      var allowance = behaviour === 'flee' || killAll || noAdv ? u.move + moveBonus(u, 'move') : u.move;
      var look = R.groundLookup(E.state);             // the ground under every spot, read off the shared grid
      var here = scoreSpot(u, { x: u.x, y: u.y }, goal, behaviour, look);
      var best = null, bestScore = here + 0.6;
      R.reachable(E.state, u, allowance).forEach(function (c) {
        if ((Math.round(c.x * 2) % 2) || (Math.round(c.y * 2) % 2)) return;
        if (!canStand(u, c)) return;
        var s = scoreSpot(u, c, goal, behaviour, look);
        if (s > bestScore) { bestScore = s; best = c; }
      });
      if (best) {
        var d = R.inches(u.x, u.y, best.x, best.y);
        var path = R.pathTo(E.state, u, allowance, best);
        faceAfter(u, path, best);
        u.x = best.x; u.y = best.y;
        logLine('move', u.label + (behaviour === 'flee' ? ' withdraws ' : noAdv ? ' moves ' : ' advances ') + d.toFixed(1) + '".');
        crushAlong(u, path);
        animateMove(u, path, true);
        soloAfterMove(u);
        if (u.x < 0) { u.activated = true; endActivation(u); return; }
      }
      if (behaviour !== 'flee' && !killAll && !R.campFlag(u, 'noAdvance')) {
        var t2 = bestTarget(u, 'advance');
        if (t2.t && t2.score > 0.2) {
          whenIdle(function () { if (E.state && !E.state.over && u.alive) fire(u, t2.t, 'advance'); });
          return;
        }
      }
      u.activated = true; endActivation(u);
    }

    function fire(u, t, mode) { resolveShot(u, t, mode, {}); }

    // the Suppressed unit's Move: into the nearest cover (or a building), nearest the `toward` point if given
    function scrambleToCover(u, toward) {
      if (alreadySafe(u)) return false;
      var sin = R.enterTargets(E.state, u);
      if (sin.length && !toward) {
        sin.sort(function (a, b) { return R.rectPointDist(a.rect, u.x, u.y) - R.rectPointDist(b.rect, u.x, u.y); });
        logLine('ai', u.label + ' is suppressed and gets into the nearest building.');
        doEnter(u, sin[0]); return true;
      }
      var spots = R.reachable(E.state, u, u.move + 2).filter(function (c) { return R.coverAt(E.state, c.x, c.y, u) > 0 && canStand(u, c); });
      if (!spots.length) return false;
      spots.sort(toward ? function (a, b) { return R.inches(a.x, a.y, toward.x, toward.y) - R.inches(b.x, b.y, toward.x, toward.y); }
        : function (a, b) { return a.cost - b.cost; });
      var spath = R.pathTo(E.state, u, u.move + 2, spots[0]);
      u.x = spots[0].x; u.y = spots[0].y;
      animateMove(u, spath, true);
      logLine('move', u.label + ' is suppressed and scrambles into ' + R.TERRAIN[R.kindsUnder(E.state, u)[0]].name.toLowerCase() + '.');
      u.activated = true; endActivation(u);
      return true;
    }
    function regroupNow(u) {
      var rr = abRally(E.state, u, { regroup: true });
      logLine('rally', rr ? rr.text : u.label + ' regroups.');
      if (rr) { pushRes(E.regroupCard(u, rr)); E.regroupFx(u, rr); }
      u.activated = true; endActivation(u);
    }
    function pinnedOpFor(u) {
      var bh = rollBehaviour(u), AUX = { aux: true };
      if (bh === 'flee') { if (!scrambleToCover(u)) regroupNow(u); return; }
      if (bh === 'defensive' || bh === 'neutral') {
        var th = threatTarget(u, 'fire', AUX);
        if (th.t) { resolveShot(u, th.t, 'fire', AUX); return; }
        regroupNow(u); return;
      }
      if (bh === 'offensive') {
        var bt = bestTarget(u, 'fire', AUX);
        if (bt.t) { resolveShot(u, bt.t, 'fire', AUX); return; }
        if (!scrambleToCover(u)) regroupNow(u);
        return;
      }
      // Kill Them All!: no charge while pinned — its sidearms at the closest enemy, or cover on the way to it
      var ne = nearestEnemy(u);
      if (ne && R.canShoot(E.state, u, ne.unit, 'fire', AUX)) { resolveShot(u, ne.unit, 'fire', AUX); return; }
      if (!scrambleToCover(u, ne ? ne.unit : null)) regroupNow(u);
    }

    // the solitaire OpFor's Reasonably Neutral infantry (see actInfantry)
    function neutralHold(u, shot) {
      var here = R.coverAt(E.state, u.x, u.y, u), hereScore = shot.t ? shot.score : 0;
      var cands = R.reachable(E.state, u, u.move).filter(function (c) {
        if (!canStand(u, c)) return false;
        c.cv = R.coverAt(E.state, c.x, c.y, u);
        return c.cv > here;
      });
      // the best cover first, the nearest of it first
      cands.sort(function (a, b) { return (b.cv - a.cv) || ((a.cost || 0) - (b.cost || 0)); });
      var pick = null, pickShot = null, ox = u.x, oy = u.y;
      for (var i = 0; i < cands.length && i < 16 && !pick; i++) {
        u.x = cands[i].x; u.y = cands[i].y;
        var s2 = bestTarget(u, 'advance');
        u.x = ox; u.y = oy;
        if ((s2.t ? s2.score : 0) >= hereScore - 1e-9) { pick = cands[i]; pickShot = s2; }
      }
      if (pick) {
        var path = R.pathTo(E.state, u, u.move, pick);
        faceAfter(u, path, pick);
        var d = R.inches(u.x, u.y, pick.x, pick.y);
        u.x = pick.x; u.y = pick.y;
        logLine('move', u.label + ' advances ' + d.toFixed(1) + '" into cover.');
        crushAlong(u, path);
        animateMove(u, path, true);
        soloAfterMove(u);
        if (u.x < 0) { u.activated = true; endActivation(u); return; }
        if (pickShot.t && pickShot.score > 0.2) {
          whenIdle(function () { if (E.state && !E.state.over && u.alive) fire(u, pickShot.t, 'advance'); });
          return;
        }
        u.activated = true; endActivation(u); return;
      }
      if (shot.t && shot.score > 0) { fire(u, shot.t, 'fire'); return; }
      logLine('ai', u.label + ' holds its position.');
      u.activated = true; endActivation(u);
    }

    function pickGoal(u, behaviour) {
      if (behaviour === 'flee') {
        var ne = nearestEnemy(u);
        return ne ? { x: u.x + (u.x - ne.unit.x), y: u.y + (u.y - ne.unit.y) } : { x: u.side === 'A' ? 1 : W - 1, y: u.y };
      }
      if (behaviour === 'assault') {
        var t = nearestEnemy(u);
        if (t) return { x: t.unit.x, y: t.unit.y };
      }
      var goals = goalPoints();
      var standing = goals.filter(function (o) { return objDist(u, o) <= objReach(o); })[0];
      if (standing && behaviour !== 'offensive') return standing;
      var best = null, bd = Infinity;
      goals.forEach(function (o) {
        var crowd = E.state.units.filter(function (f) {
          return f.alive && f !== u && f.side === u.side && objDist(f, o) <= objReach(o) + 2;
        }).length;
        var d = R.inches(u.x, u.y, o.x, o.y) + crowd * 14 + (o.owner === u.side ? 8 : 0);
        if (d < bd) { bd = d; best = o; }
      });
      if (best) return best;
      // nothing to hold and nothing to find: the enemy is the objective
      var foe = nearestEnemy(u);
      return foe ? { x: foe.unit.x, y: foe.unit.y } : { x: W / 2, y: H / 2 };
    }

    function scoreSpot(u, c, goal, behaviour, look) {
      var s = 0;
      var terr = R.TERRAIN[look ? look.at(c.x, c.y) : R.terrainAt(E.state, c.x, c.y)];
      var cover = look ? R.TERRAIN[look.under(c.x, c.y)].cover || 0 : R.coverAt(E.state, c.x, c.y, u);
      /* Reasonably Offensive "will choose terrain pieces granting a Firepower bonus
         over those that give a Defence bonus" (p. 147): there, the Firepower ground
         outweighs the best cover; everyone else values cover first. */
      if (behaviour === 'offensive') { s += cover * 1.0; if (terr.fp) s += 4.5; }
      else { s += cover * 1.6; if (terr.fp) s += 2; }
      s -= 0.6 * R.inches(c.x, c.y, goal.x, goal.y);
      var ghost = { x: c.x, y: c.y, alive: true, of: u };
      var exposure = 0, opportunity = 0;
      E.state.units.forEach(function (e) {
        if (!e.alive || e.side === u.side || husk(e)) return;
        var d = Math.max(0, R.inches(c.x, c.y, e.x, e.y) - 2 * UR);
        if (d > u.range && d > e.range) return;          // out of reach either way: no need to look
        if (!R.hasLoS(E.state, e, ghost)) return;
        if (d <= u.range) opportunity += 1.4;
        if (d <= e.range) exposure += 1.0;
      });
      E.state.units.forEach(function (f) {
        if (!f.alive || f === u || f.side !== u.side) return;
        if (R.inches(c.x, c.y, f.x, f.y) <= 4) s -= 1.3;
      });
      /* An Overmind is worth more alive and near its swarm than at the front: it
         wants every bug it leads inside its reach, and keeps its own head down. */
      if (R.has(u, 'Overmind')) {
        var reach = R.overmindReach(E.state, u.side), led = 0;
        E.state.units.forEach(function (f) {
          if (!f.alive || f === u || f.side !== u.side || f.x < 0 || !R.has(f, 'Animal Behaviour') || f.tier > u.tier) return;
          if (R.inches(c.x, c.y, f.x, f.y) <= reach) led++;
        });
        s += led * 1.5 - exposure * 1.2;
      }
      if (behaviour === 'flee') s -= exposure * 3;
      else if (behaviour === 'defensive') s += opportunity * 1.2 - exposure * 0.9;
      else s += opportunity * 1.6 - exposure * 0.3;
      return s;
    }

    return {
      threatTarget: threatTarget, aiRelocate: aiRelocate, aiInsert: aiInsert, aiPadFor: aiPadFor, flightTurn: flightTurn,
      gapToFoes: gapToFoes, canStand: canStand, expectedHits: expectedHits, bestTarget: bestTarget,
      nearestEnemy: nearestEnemy, aiAct: aiAct, aiStands: aiStands, scoreSpot: scoreSpot
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineAI;
})(typeof window !== 'undefined' ? window : global);
