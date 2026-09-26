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
        nearestDeploySpot = E.nearestDeploySpot, objDist = E.objDist, onTable = E.onTable,
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
      u.reserve = false;                                // nowhere legal: it stays out
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
        if (res.wreck) whenIdle(function () { repaintTerrain([res.wreck]); });
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
      if (R.has(u, 'Molecular Reconstruction') && u.damage && (u.damage >= u.str - 1 || !shot.t)) {
        doSelfRepair(u); return;
      }
      if (R.has(u, 'Turret')) {
        if (shot.t) { fire(u, shot.t, 'fire'); return; }
        u.activated = true; endActivation(u); return;
      }

      // a solitaire OpFor hull rolls on the behaviour table like everything else (p. 147)
      var soloB = !!E.state.solo && u.side === 'B';
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
          var spot = null;
          for (var a2 = 0; a2 < 16 && !spot; a2++) {
            var ang = a2 / 16 * Math.PI * 2;
            var q = R.clampBoard({ x: u.x + Math.cos(ang) * 3, y: u.y + Math.sin(ang) * 3 });
            if (R.TERRAIN[R.terrainAt(E.state, q.x, q.y)].impassable) continue;
            if (R.unitNear(E.state, q.x, q.y, u, 0.6)) continue;
            spot = q;
          }
          ui.selected = u; doDisembark(spot || { x: u.x, y: u.y }, true); return;
        }
        u.activated = true; endActivation(u); return;
      }

      // a transport with troops aboard heads for the nearest objective and unloads
      if (carrying) {
        var obj = nearestObjective(u);
        if (obj && R.inches(u.x, u.y, obj.x, obj.y) < 9) {
          var spot = { x: u.x + Math.cos(u.facing || 0) * 2.5, y: u.y + Math.sin(u.facing || 0) * 2.5 };
          var lines = [];
          (u.cargo || []).slice().forEach(function (rider, i) {
            var r = R.disembark(E.state, u, rider, { x: spot.x + (i % 2 ? 1.6 : -1.6), y: spot.y });
            if (r) { logLine('note', r.text); lines.push({ text: r.text }); stepOff(rider, u); }
          });
          if (SFX) { SFX.step(); SFX.step(0.22); }
          u.activated = true;
          pushRes({ kind: 'Disembark', title: u.name + ' unloads', side: u.side, list: lines });
          endActivation(); return;
        }
        return aiRoll(u, obj || nearestEnemy(u), true);
      }

      // an empty transport picks up the nearest squad that will fit
      if (u.transport && !carrying) {
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
        var bh = rollBehaviour(u, shot);
        // Run for Your Lives!: a Move as far as it can get from the player's units, no shot
        if (bh === 'flee') return aiRoll(u, nearestEnemy(u), false, { flee: true, noShoot: true });
        // Kill Them All!: charge the closest enemy — only an Overgrown bug can — or else Move at it, no shot
        if (bh === 'assault') {
          var prey2 = nearestEnemy(u);
          if (R.isOvergrown(u) && prey2 && R.status(u) === 'ready' && R.canAssault(u, prey2.unit) &&
            prey2.dist <= chargeAllow(u) && canReachCharge(u, prey2.unit)) { aiCharge(u, prey2.unit); return; }
          return aiRoll(u, prey2, false, { close: true, noShoot: true });
        }
        // Reasonably Defensive or Neutral: engage from where it stands, or keep its distance
        if (bh === 'defensive' || bh === 'neutral') {
          if (shot.t) { fire(u, shot.t, 'fire'); return; }
          if (bh === 'defensive') {
            logLine('ai', u.label + ' holds back.');
            u.activated = true; endActivation(u); return;
          }
          return aiRoll(u, nearestObjective(u) || nearestEnemy(u), true);
        }
        // Reasonably Offensive: on at them, as it always did
      }
      // an aircraft with a line of targets makes a run
      if (u.cls === 'aircraft') {
        var lane = bestStrafe(u);
        if (lane && lane.count) { ui.selected = u; doStrafe(lane.pt); return; }
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
      var allowance = u.move + moveBonus(u);
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
        flightTurn(u);
        logLine('move', u.label + ' drives ' + dist.toFixed(1) + '".');
        crushAlong(u, path);
        animateMove(u, path, true);
        samCheck(u);
        if (!u.alive) { u.activated = true; whenIdle(function () { if (E.state && !E.state.over) endActivation(u); }); return; }
      }
      var t2 = o.noShoot ? {} : bestTarget(u, 'advance');
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
        var n = 0;
        activeUnits().forEach(function (t) {
          if (t.side === u.side || R.isFlying(t)) return;
          if (R.pointSegDist(t.x, t.y, u.x, u.y, c.x, c.y) <= 2.2) n++;
        });
        if (n && (!best || n > best.count)) best = { pt: c, count: n };
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
        if (!t.alive || t.side === u.side || !onTable(t)) return;
        var e = expectedHits(u, t, mode || 'fire', opts);
        if (e > best.score) best = { t: t, score: e };
      });
      return best;
    }

    function nearestEnemy(u) {
      var best = null, bd = Infinity;
      E.state.units.forEach(function (t) {
        // only enemies on the table: one waiting in reserve sits off its corner, and chasing it walks nowhere
        if (!t.alive || t.side === u.side || !onTable(t)) return;
        var d = R.unitDist(u, t);
        if (d < bd) { bd = d; best = t; }
      });
      return best ? { unit: best, dist: bd } : null;
    }

    /* The behaviour table (p. 147), rolled for every unit as it activates —
       a hull or an aircraft as much as a squad. */
    function rollBehaviour(u, shot) {
      var roll = R.d6(), mods = 0, why = [];
      var fp = u.fp || 0, as = u.assault || 0;
      if (as >= 2 * fp && as > 0) { mods += 2; why.push('Assault ≥ 2× Firepower +2'); }
      else if (as > fp) { mods += 1; why.push('Assault > Firepower +1'); }
      if (!shot.t) { mods += 2; why.push('no enemy in range +2'); }
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

    function aiAct(u) {
      /* Decapitation: the OpFor's leaders "always act according to the Reasonably
         Defensive result and never Move nor Advance" (p. 152) — whatever state they
         are in, they shoot from where they are or keep their heads down. */
      if (E.state.scen.noMove && E.state.scen.noMove(E.state, u)) {
        var still = R.status(u) === 'ready' ? bestTarget(u, 'fire') : {};
        logLine('ai', u.label + ' holds its position (Reasonably Defensive).');
        if (still.t) { fire(u, still.t, 'fire'); return; }
        if (u.sp) {
          var rr0 = abRally(E.state, u);
          if (rr0) { logLine('rally', rr0.text); pushRes({ kind: 'Regroup', title: u.name + ' regroups', side: u.side, list: [{ text: rr0.text, side: u.side }] }); }
        }
        u.activated = true; endActivation(u); return;
      }
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
          var rr = abRally(E.state, u);
          logLine('rally', rr ? rr.text : u.label + ' regroups.');
          if (rr) pushRes({ kind: 'Regroup', title: u.name + ' regroups', side: u.side, list: [{ text: rr.text, side: u.side }] });
        }
        u.activated = true; endActivation(u); return;
      }

      // a Crock steadies its Esh-Aven when enough of them are shaken
      if (R.has(u, 'Dominant Species') && R.status(u) === 'ready') {
        var rgt = R.regainTargets(E.state, u);
        var shaken = rgt.reduce(function (n, o) { return n + o.sp; }, 0);
        if (rgt.some(function (o) { return R.status(o) !== 'ready'; }) || shaken >= 4) { doRegain(u); return; }
      }
      // Aggressive bugs with no Overmind near charge the closest enemy in reach (p. 116)
      var mustC = forcedCharge(u);
      if (mustC) { logLine('ai', u.label + (R.campFlag(u, 'bloodlust') ? ' — Bloodlust' : ' — Aggressive') + ': charges the closest enemy.'); aiCharge(u, mustC); return; }
      /* NOT ONE STEP BACKWARDS! (T5): a commander, or a unit beside one, puts a burst
         over the heads of a broken friend — or one badly shaken — to get it moving */
      if (R.steadyShooter(E.state, u)) {
        var shaken2 = R.steadyTargets(E.state, u).filter(function (t) { return R.status(t) === 'broken' || (t.sp || 0) >= 4; })
          .sort(function (a, b) { return (b.sp || 0) - (a.sp || 0); })[0];
        if (shaken2) { logLine('ai', u.label + ' — NOT ONE STEP BACKWARDS!: steadies ' + shaken2.label + '.'); doSteady(shaken2, u); return; }
      }
      // a Psychic Wave that catches two or more is worth more than a shot
      if (R.has(u, 'Psychic Wave') && R.status(u) === 'ready') {
        var wv = bestWaveSpot(u);
        if (wv && wv.n >= 2) { doWave(u, wv.pt); return; }
      }

      // standing over an unchecked location is worth more than any other action
      if (SC.searchSpots(E.state, u).length) { doCheckArea(u); return; }

      /* An emplaced gun cannot manoeuvre, so its only decision is its stance: with
         an enemy inside 24" and in front of it, direct fire hits far harder than
         Basic Firepower does (p. 94). */
      if (R.has(u, 'Stationary Artillery')) {
        var close = E.state.units.filter(function (e) {
          return e.alive && !e.aboard && e.side !== u.side && R.unitDist(u, e) <= 24 &&
            R.unitDist(u, e) >= 6 && R.hasLoS(E.state, u, e);
        });
        if ((close.length > 0) !== !!u.dugIn) { doStance(u); return; }
      }

      /* A marker is worth more than the shot the unit could take itself: it puts two
         friendly guns onto the target at once (p. 58, and Smoke Markers on p. 94). */
      if (R.has(u, 'Markerlights') || R.has(u, 'Smoke Markers')) {
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

      var shot = bestTarget(u, 'fire');
      var behaviour = rollBehaviour(u, shot);
      /* Kill Them All! (p. 147): "The unit makes an Assault action, charging at the
         closest enemy unit. If there are no valid targets, it makes a Move towards
         the closest enemy" — a Move, so it does not shoot as well. */
      var killAll = !!E.state.solo && u.side === 'B' && behaviour === 'assault';

      /* A garrison (p. 41) shoots from where it is, charges only an enemy in the
         next section, and comes out when it wants to press on and has nothing to
         shoot at. Otherwise it holds the building. */
      if (u.bld) {
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
      var allowance = behaviour === 'flee' || killAll ? u.move + moveBonus(u, 'move') : u.move;
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
        logLine('move', u.label + (behaviour === 'flee' ? ' withdraws ' : ' advances ') + d.toFixed(1) + '".');
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
      var standing = goals.filter(function (o) { return objDist(u, o) <= 4; })[0];
      if (standing && behaviour !== 'offensive') return standing;
      var best = null, bd = Infinity;
      goals.forEach(function (o) {
        var crowd = E.state.units.filter(function (f) {
          return f.alive && f !== u && f.side === u.side && objDist(f, o) <= 6;
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
      s += (look ? R.TERRAIN[look.under(c.x, c.y)].cover || 0 : R.coverAt(E.state, c.x, c.y, u)) * 1.6;
      if (terr.fp) s += 2;
      s -= 0.6 * R.inches(c.x, c.y, goal.x, goal.y);
      var ghost = { x: c.x, y: c.y, alive: true };
      var exposure = 0, opportunity = 0;
      E.state.units.forEach(function (e) {
        if (!e.alive || e.side === u.side) return;
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
      aiRelocate: aiRelocate, aiInsert: aiInsert, aiPadFor: aiPadFor, flightTurn: flightTurn,
      gapToFoes: gapToFoes, canStand: canStand, expectedHits: expectedHits, bestTarget: bestTarget,
      nearestEnemy: nearestEnemy, aiAct: aiAct
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineAI;
})(typeof window !== 'undefined' ? window : global);
