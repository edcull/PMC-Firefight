/* PMC 2670 — Firefight : what a unit may do: each action's state on the bar, and choosing one

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineActions = function (E) {
    var R = E.R, SC = E.SC, abRally = E.abRally, abRepair = E.abRepair, activeUnits = E.activeUnits,
        addFx = E.addFx, alreadySafe = E.alreadySafe, assaultables = E.assaultables,
        breachTargets = E.breachTargets, byId = E.byId, canStand = E.canStand, chargeAllow = E.chargeAllow,
        closeDrawer = E.closeDrawer, demolishTargets = E.demolishTargets, doCheckArea = E.doCheckArea,
        doDetonate = E.doDetonate, doOnce = E.doOnce, doRegain = E.doRegain, doSabotage = E.doSabotage,
        doSelfRepair = E.doSelfRepair, doStance = E.doStance, eligible = E.eligible,
        endActivation = E.endActivation, forcedCharge = E.forcedCharge, holdFire = E.holdFire, isAI = E.isAI,
        logLine = E.logLine, markAnswerable = E.markAnswerable, markHint = E.markHint,
        markReach = E.markReach, markTargets = E.markTargets, minedFor = E.minedFor, moveBonus = E.moveBonus,
        movesToCarry = E.movesToCarry, pushRes = E.pushRes, render = E.render, repairCard = E.repairCard,
        revealConsole = E.revealConsole, safeSpot = E.safeSpot, setHint = E.setHint, sideName = E.sideName,
        soloOwnerName = E.soloOwnerName, spent = E.spent, stayPut = E.stayPut, targetsFor = E.targetsFor,
        ui = E.ui, wireNote = E.wireNote;

    var SUPPRESSED_OK = { move: 1, enter: 1, exitbld: 1, aux: 1, regroup: 1, assault: 1, plainassault: 1, laststand: 1 };
    function actionState(u, id) {
      if (!u) return { on: false, hint: 'Select one of your units on the table.' };
      /* Carried or towed, a unit does not activate at all: a gun on the hook is
         limbered up, and nobody fires, digs in or does anything else from the back
         of a hull (p. 94). It acts once it is off. */
      if (u.aboard) {
        var carrier = byId(u.aboard);
        return { on: false, hint: R.has(u, 'Stationary Artillery')
          ? 'On tow behind ' + (carrier ? carrier.name : 'its vehicle') + ': it cannot act until the vehicle deploys it.'
          : 'Aboard ' + (carrier ? carrier.name : 'a transport') + ': it cannot act until it gets off.' };
      }
      if (u.carryMoved && id !== 'embark' && id !== 'disembark') {
        return { on: false, hint: 'Driven first — now Embark or Disembark (or press any action to stop there).' };
      }
      if (u.supportUsed && ['embark', 'disembark', 'regroup', 'skip'].indexOf(id) < 0) {
        return { on: false, hint: 'Supporting Fire given — load or unload, or pass.' };
      }
      if (isAI(u.side)) return { on: false, hint: u.label + ' is under OpFor control.' };
      if (u.side !== E.state.activeSide) return { on: false, hint: E.state.solo ? 'The OpFor is acting.' : 'It is ' + sideName(E.state.activeSide) + '’s activation.' };
      if (u.activated) return { on: false, hint: u.name + ' has already acted this turn.' };
      // an emptied drop platform is done: it is not activated again (p. 79)
      if (R.has(u, 'Immobile') && u.transport && !(u.cargo || []).length) {
        return { on: false, hint: u.name + ' has put its troops down: it does nothing more this battle.' };
      }
      // the Command Unit aboard has one action of its own to take from the vehicle (p. 57)
      var ca = E.state.cmdAct;
      if (ca && ca.veh === u.id && id !== ca.id) {
        return { on: false, hint: 'The Command Unit aboard is taking its own action — only that one now.' };
      }
      /* Broken (p. 34): it is not activated at all — it flees at the start of
         the Rally phase, and rallies, if it can, in it. It can still be picked
         to look at, but nothing on its bar is live. */
      if (R.status(u) === 'broken') {
        return { on: false, hint: u.name + ' is Broken: it cannot act. It flees at the start of the Rally phase, and may rally there.' };
      }
      /* In the middle of a chain — a marker's call, a Command Unit's, the turrets
         acting as one — only the units the chain calls on may act. */
      if (E.state.chain && E.state.chain.side === u.side && eligible(u.side).indexOf(u) < 0) {
        // say which units the chain is waiting on, so it is plain what to pick
        var waiting = eligible(u.side).map(function (w) { return w.code || w.name; }).join(', ');
        var cmdBy = E.state.chain.by && byId(E.state.chain.by);
        return { on: false, hint: E.state.chain.kind === 'mark'
          ? 'Answering the ' + (E.state.mark && E.state.mark.kind === 'mark' ? 'mark' : 'designation') + ': only a unit that can fire at ' +
            (E.state.mark && E.state.mark.targets[0] ? E.state.mark.targets[0].name : 'the target') + ' may act.'
          : E.state.chain.kind === 'turrets'
            ? 'The turrets act as one (p. 130): ' + waiting + ' must act (or Skip) first.'
            : 'Only the units in ' + (cmdBy ? cmdBy.name + '’s' : 'this') + ' chain may act now' + (waiting ? ': ' + waiting + '.' : '.') };
      }
      /* An Advance is one action: the move, then the shot (p. 27). Half-way
         through it, Fire!, Assault, another move — none of them is on; the unit
         shoots without the Fire! bonus, or holds its fire. */
      if (u.advancing) {
        return id === 'advance'
          ? { on: true, hint: 'Advancing: it has moved. Pick a target to shoot, without the Fire! bonus — or press Advance again to hold its fire.' }
          : { on: false, hint: 'Advancing: it has already moved, so all that is left of this activation is the Advance shot, or holding its fire.' };
      }
      if (E.state.solo && E.state.solo.coop && (u.owner || 1) !== E.state.activeOwner) {
        return { on: false, hint: 'That is ' + soloOwnerName(u.owner || 1) + '’s unit — it is ' + soloOwnerName(E.state.activeOwner) + '’s turn to activate.' };
      }
      var st = R.status(u), sup = st === 'suppressed';
      var machine = R.isMachine(u), bonus = moveBonus(u);
      /* Aggressive (p. 116): with no Overmind within 18" to hold it back, a bug
         that can reach an enemy must charge the closest one — nothing else. */
      // "whenever possible" — and a Suppressed bug cannot charge, so it is not held to it
      var fc = sup && !R.deathOrGlory(E.state, u) ? null : forcedCharge(u);
      if (fc && id !== 'assault' && id !== 'plainassault') {
        if (R.campFlag(u, 'bloodlust')) return { on: false, hint: 'Bloodlust: ' + u.name + ' must charge the closest enemy it can reach, ' + fc.name + '.' };
        return { on: false, hint: 'Aggressive: ' + u.name + ' must charge the closest enemy, ' + fc.name +
          ' — no Overmind within ' + R.overmindReach(E.state, u.side) + '" to hold it back.' };
      }

      /* A Suppressed unit has three things it may do instead of a standard
         action (p. 34): a Move into cover or out of sight, a Fire! with its
         Auxiliary weapons, or Pass/Regroup. Going into a building is that move;
         a charge only when "Death or Glory, Comrades!" shakes it loose (the
         assault case says so); Last Stand is how it sheds the Suppression.
         Nothing else — no special action, no ability — is on while it is pinned. */
      if (sup && !SUPPRESSED_OK[id]) {
        return { on: false, hint: 'Suppressed: it may only move into cover or out of sight, fire its Auxiliary weapons, or Pass/Regroup (p. 34).' };
      }

      /* A unit inside a building "may only exit it or make actions which do not
         require any movement (so it cannot Move, Advance, Assault, etc.)" (p. 41). */
      // (a Psychic Wave moves "up to" its Movement: from a building it goes out from where it stands)
      if (u.bld && ['move', 'advance', 'vortex', 'vortexadv', 'rush'].indexOf(id) >= 0) {
        return { on: false, hint: 'Inside a building — only actions that need no movement. Exit the building first.' };
      }

      switch (id) {
        case 'enter': {
          if (sup && alreadySafe(u)) return { on: false, hint: 'Suppressed, and already in cover or out of sight: it stays where it is (p. 34).' };
          var ents = R.enterTargets(E.state, u);
          if (!ents.length) return { on: false, hint: u.bld ? 'No empty section in contact with this one.' : 'No empty building within 4".' };
          return { on: true, hint: u.bld
            ? 'Move through to an empty section of the building in contact with this one. Counts as the action.'
            : 'Go into an empty building within 4" — one unit to a building. Inside: +2 Defence, no Crossfire, range measured from the wall' +
              ' — but no moving until you come out.' };
        }
        case 'leave': {
          var lv = E.leaveSpots(u);
          return lv.length ? { on: true, hint: 'A Move off the table edge: the unit leaves the battle and counts as fled (p. 31). Pick the ground it goes off from.' }
            : { on: false, hint: 'It cannot reach the table edge with a Move.' };
        }
        case 'exitbld': {
          if (sup) return { on: false, hint: 'Suppressed: it keeps the cover of the building (p. 34).' };
          var outs = R.exitSpots(E.state, u);
          return outs.length ? { on: true, hint: 'Come out and be placed within 4" of the building. Counts as the action.' }
            : { on: false, hint: 'There is no clear ground within 4" of the building to come out onto.' };
        }
        case 'move':
          if (R.has(u, 'Immobile')) {
            return { on: false, hint: 'A Rapid insertion platform came down where it came down. It may only put its troops out.' };
          }
          if (R.has(u, 'Stationary Artillery')) {
            return { on: false, hint: 'Stationary Artillery: the piece is emplaced and does not move. A transport may tow it.' };
          }
          if (R.has(u, 'Turret')) return { on: false, hint: 'A turret is a stationary ground vehicle: it stays where it was teleported in.' };
          if (machine) return { on: true, hint: 'Drive up to Movement +4" — ' + (u.move + 4) + '". The hull ends up facing the way it travelled.' };
          if (sup && alreadySafe(u)) return { on: false, hint: 'Suppressed, and already in cover or out of sight: it cannot move to another such place (p. 34).' };
          return sup
            ? { on: true, hint: 'Suppressed: may only move into cover or out of sight, up to ' + (u.move + 2) + '".' }
            : { on: true, hint: 'Move up to Movement +2" — ' + (u.move + 2) + '". Ends the activation.' };
        case 'fire': {
          if (sup) return { on: false, hint: 'Suppressed units may only fire auxiliary weapons.' };
          if (u.fp === null) return { on: false, hint: 'This unit has no Firepower.' };
          var t = targetsFor(u, {});
          return t.length
            ? { on: true, hint: 'Stand and shoot: +1 to the firing roll, +2 inside ' + (u.range / 2) + '". ' + t.length + ' target' + (t.length > 1 ? 's' : '') + ' in range.' }
            : { on: false, hint: 'No enemy within ' + u.range + '" and line of sight.' };
        }
        case 'fireconc': {
          if (spent(u, 'concentration')) return { on: false, hint: 'Rite of Concentration: already used this battle.' };
          var fc2 = actionState(u, 'fire');
          if (!fc2.on) return fc2;
          return { on: true, hint: 'Fire! with the Rite of Concentration: the D10 is doubled. Once a battle — kept if the die shows 0 or 9.' };
        }
        case 'advance': {
          if (R.campFlag(u, 'noAdvance')) return { on: false, hint: 'Uncoordinated: this unit cannot Advance.' };
          if (sup) return { on: false, hint: 'Suppressed units cannot Advance.' };
          if (R.has(u, 'Stationary Artillery')) return { on: false, hint: 'Stationary Artillery: the piece does not move, so it cannot Advance.' };
          if (R.has(u, 'Turret')) return { on: false, hint: 'A turret does not move, so it cannot Advance.' };
          if (R.has(u, 'Cumbersome Weapon')) return { on: false, hint: 'Cumbersome Weapon: may not Advance.' };
          if (u.fp === null) return { on: false, hint: 'This unit has no Firepower.' };
          return { on: true, hint: 'Move up to ' + u.move + '", then shoot without the Fire! bonus.' };
        }
        /* Sappers "do not have to attempt to destroy that terrain piece – the player
           may order them to perform a standard Assault action" (p. 59): the charge
           without the demolition charges, and without their +4. */
        case 'plainassault': {
          if (!R.has(u, 'Sappers')) return { on: false, hint: 'Only Sappers carry demolition charges to leave behind.' };
          var pa = actionState(u, 'assault');
          if (!pa.on) return pa;
          var walled = (fc ? [fc] : assaultables(u, chargeAllow(u))).some(function (t) { return !R.isMachine(t) && R.shelterOf(E.state, u, t); });
          if (!walled) return { on: false, hint: 'No enemy within reach is in or behind something to blow in: a plain Assault is all there is.' };
          return { on: true, hint: 'A standard Assault: charge in without setting the demolition charges — no +4, and the wall or building stays.' };
        }
        case 'assault': {
          if (machine && !R.isOvergrown(u)) return { on: false, hint: 'Vehicles and aircraft never charge.' };
          if (fc) return { on: true, hint: R.campFlag(u, 'bloodlust')
            ? 'Bloodlust: ' + u.name + ' charges the closest enemy it can reach — ' + fc.name + '.'
            : 'Aggressive: no Overmind near, so ' + u.name + ' charges the closest enemy — ' + fc.name + '.' };
          // "Death or Glory, Comrades!" (p. 94) shakes a suppressed unit into the charge
          var dog = R.deathOrGlory(E.state, u);
          if (sup && !dog) return { on: false, hint: 'Suppressed units cannot charge.' };
          if (R.has(u, 'Cumbersome Weapon')) return { on: false, hint: 'Cumbersome Weapon: may not Assault.' };
          var reachA = chargeAllow(u);
          var near = assaultables(u, reachA);
          if (u.bld && !near.length) return { on: false, hint: 'Inside a building — the only charge is at an enemy in a section next to this one.' };
          if (!near.length) return { on: false, hint: 'No enemy within charge reach of ' + reachA + '".' };
          return { on: true, hint: dog
            ? '"Death or Glory, Comrades!" — ' + dog.name + ' is shouting: charge within ' + reachA +
              '" and every Suppression point falls away as you go in.'
            : 'Charge within ' + reachA + '": defensive fire, then three rounds each way.' };
        }
        case 'aux': {
          if (u.fp === null) return { on: false, hint: 'This unit has no Firepower.' };
          // aircraft carry no auxiliary weapons (p. 32)
          if (R.isFlying(u)) return { on: false, hint: 'Aircraft have no auxiliary weapons.' };
          var ta = targetsFor(u, { aux: true });
          if (!ta.length) return { on: false, hint: 'Auxiliary weapons reach 12" — nothing in range.' };
          return { on: true, hint: 'Auxiliary weapons: FP 1, Range 12", no special rules. The only shot a suppressed unit may take.' };
        }
        case 'endchain':
          return { on: true, hint: 'End the Command Unit\u2019s chain here: ' + u.name + ' and the rest keep their activations for later, and play passes on.' };
        case 'skip':
          return { on: true, hint: 'Skip: ' + u.name + ' does nothing this turn — it stays where it is, its activation is spent, and play passes on.' };
        case 'regroup':
          if (machine) {
            return u.damage
              ? { on: true, hint: 'Stand down and patch up: ' + Math.max(1, u.str - u.damage) + 'D6, each 4+ clearing a damage point.' }
              : { on: true, hint: 'Nothing to repair — this only passes the activation.' };
          }
          return { on: true, hint: 'Pass and regroup: an immediate bonus Rally roll of ' + R.currentMorale(u) + 'D6, each 4+ clearing 1 SP.' };
        case 'embark': {
          if (!u.transport) return { on: false, hint: 'This unit carries no troops.' };
          if (R.has(u, 'Immobile')) {
            return { on: false, hint: 'A Rapid insertion platform is a one-way ride: it only puts troops out.' };
          }
          var room = u.transport - (u.cargo || []).length;
          if (room <= 0) return { on: false, hint: 'Full — carrying ' + u.cargo.length + ' of ' + u.transport + '.' };
          var ready = activeUnits(u.side).filter(function (t2) { return R.canEmbark(E.state, u, t2); });
          var guns = ready.filter(function (t2) { return R.has(t2, 'Stationary Artillery'); }).length;
          if (guns && guns === ready.length) return { on: true, hint: 'Hitch up a gun within 4" and tow it. It goes where the vehicle goes, and deploys again when unloaded.' };
          return ready.length
            ? { on: true, hint: 'Pick up a squad within 4". Room for ' + room + '. They lose their suppression on boarding.' }
            : { on: false, hint: 'No steady squad within 4" to pick up.' };
        }
        case 'disembark': {
          if (!(u.cargo || []).length) return { on: false, hint: 'Nobody aboard.' };
          if (!(u.cargo || []).some(function (c) { return !c.boarded; })) return { on: false, hint: 'Loaded this turn: they cannot get off again until the next (p. 36).' };
          return { on: true, hint: 'Put the troops down within 4" of the hull, then drive on up to half its Movement if you like.' };
        }
        case 'drivefirst': {
          if (!movesToCarry(u)) return { on: false, hint: 'This transport cannot move before loading.' };
          if (u.carryMoved) return { on: false, hint: 'Already driven: now load or unload.' };
          var roomF = u.transport - (u.cargo || []).length;
          if (!(u.cargo || []).length && roomF <= 0) return { on: false, hint: 'Nothing to load or unload.' };
          return { on: true, hint: 'Drive up to half its Movement (' + (Math.ceil(u.move / 2)) + '"), then Embark or Disembark (p. 36).' };
        }
        case 'strafe': {
          if (u.cls !== 'aircraft') return { on: false, hint: 'Only aircraft may strafe.' };
          // a Strafing run fires at every enemy passed over; one with no Firepower cannot (p. 27)
          if (u.fp === null) return { on: false, hint: 'This aircraft has no Firepower.' };
          return { on: true, hint: 'Strafing run: fly up to ' + u.move + '" and fire at every enemy passed over. They may fire back.' };
        }
        case 'designate':
        case 'marktarget': {
          if (sup) return { on: false, hint: 'Suppressed units cannot use their markers.' };
          var mkKind = id === 'marktarget' ? 'mark' : 'designate';
          var smoke = !R.has(u, 'Markerlights') && R.has(u, 'Smoke Markers');
          var td = markTargets(u);
          if (!td.length) return { on: false, hint: 'Nothing within ' + markReach(u) + '" and sight to mark.' };
          if (!markAnswerable(u, mkKind)) {
            return { on: false, hint: mkKind === 'designate'
              ? 'No Indirect Fire unit left that could reach it.'
              : 'No unit left that can see it and reach it.' };
          }
          if (smoke) {
            return { on: true, hint: 'Smoke Markers: a grenade and a flare on an enemy within 12". ' +
              'An Indirect Fire unit shoots at it there and then, without needing sight; then another smoke round, and a second unit — and this unit may move first.' };
          }
          return { on: true, hint: mkKind === 'designate'
            ? 'Designate target: an enemy within 24" and in sight, and an Indirect Fire unit shoots it at once, no sight needed. ' +
              'Stand still and, after that, designate again (the same enemy or another) for a second; move up to ' + u.move + '" first and get one.'
            : 'Mark the target: an enemy within 24" and in sight, and a unit that can see it fires at once, as though at half range. ' +
              'Stand still and, after that, mark again (the same enemy or another) for a second; move up to ' + u.move + '" first and get one.' };
        }
        case 'support': {
          if (u.supportUsed) return { on: false, hint: 'Supporting Fire already given — now load or unload.' };
          var sf = targetsFor(u, {});
          return sf.length
            ? { on: true, hint: 'Supporting Fire: shoot without the Fire! bonus, then load or unload troops.' }
            : { on: false, hint: 'Nothing in range to support against.' };
        }
        case 'steady': {
          var stT = R.steadyTargets(E.state, u);
          return stT.length
            ? { on: true, hint: 'NOT ONE STEP BACKWARDS! Shoot at a friendly unit carrying Suppression: it is resolved as normal — a Man down! still kills — but every Suppression point it would give is taken away instead.' }
            : { on: false, hint: 'No suppressed friend within range and sight.' };
        }
        case 'hack': {
          if (sup) return { on: false, hint: 'Suppressed units cannot hack.' };
          if (u.hackUsed) return { on: false, hint: 'Already hacked this turn.' };
          var dr = E.state.units.filter(function (t2) { return R.canHack(E.state, u, t2); });
          return dr.length
            ? { on: true, hint: 'Hack an enemy drone within 24": D6 — 3-4 locks it out and burns it, 5-6 turns it on its own side first.' }
            : { on: false, hint: 'No enemy drone within 24".' };
        }
        case 'demolish': {
          if (sup) return { on: false, hint: 'Suppressed units cannot take aim at a wall.' };
          var dt = demolishTargets(u, false);
          return dt.length
            ? { on: true, hint: 'Bring a wall or building down: a final 15+, or an unmodified 9.' }
            : { on: false, hint: 'Nothing destructible in range and sight.' };
        }
        case 'breach': {
          if (sup) return { on: false, hint: 'Suppressed units cannot set charges.' };
          if (R.has(u, 'Cumbersome Weapon')) return { on: false, hint: 'Cumbersome Weapon: may not Assault.' };
          var bt = breachTargets(u);
          if (!bt.length) {
            return { on: false, hint: R.has(u, 'Sappers')
              ? 'Nothing destructible within reach.'
              : 'Only Sappers may demolish anything but the scenario objective.' };
          }
          return { on: true, hint: R.has(u, 'Sappers')
            ? 'Sappers: charge a wall or building with demolition charges, +4 — 15+, or an unmodified 9. A failure falls back 2".'
            : 'Demolish the objective: charges by hand at +2, where Sappers would get +4 — 15+, or an unmodified 9. A failure falls back 2".' };
        }
        case 'sabotage': {
          var tg = E.state.scen.sabotageSpots ? E.state.scen.sabotageSpots(E.state, u) : [];
          if (!tg.length) return { on: false, hint: 'No objective within 1".' };
          return { on: true, hint: 'Destroy the objective: a special action, and the unit does nothing else this activation.' };
        }
        case 'checkarea': {
          if (sup) return { on: false, hint: 'Suppressed units cannot search.' };
          var sp = SC.searchSpots(E.state, u);
          if (!sp.length) return { on: false, hint: 'Nothing to search within 4".' };
          var order = E.state.sc.order;
          var need = order === 0 ? '5+' : order === 1 ? '4+' : 'automatically';
          return { on: true, hint: 'Check the area! — D6, and the ' +
            (order === 0 ? 'first' : order === 1 ? 'second' : 'third') + ' location gives it up on ' + need + '.' };
        }
        case 'detonate': {
          var mine = minedFor(u);
          if (!mine) return { on: false, hint: 'Nothing was mined, or this is not the unit that knows where.' };
          if (sup) return { on: false, hint: 'Suppressed units cannot work the detonator.' };
          return { on: true, hint: 'Terrorist: set off the charge under the ' +
            R.TERRAIN[mine.piece.kind].name.toLowerCase() + ' — a shooting attack at Firepower 10 ' +
            'with the Destructive Weapon rule, wherever it is on the table.' };
        }
        case 'stance': {
          if (!R.has(u, 'Stationary Artillery')) return { on: false, hint: 'Only an emplaced gun changes stance.' };
          return u.dugIn
            ? { on: true, hint: 'Normal stance!: back to indirect fire — Range ' + u.range +
                '", minimum ' + (R.ruleValue(u, 'Minimum Range') || 0) + '", all round, on Basic Firepower.' }
            : { on: true, hint: 'Dig in!: lay the piece over open sights — Range 24", minimum 6", front quarter only, ' +
                'but it shoots with every modifier instead of Basic Firepower.' };
        }
        case 'wave': {
          if (sup) return { on: false, hint: 'Suppressed units cannot send out a Psychic Wave.' };
          return { on: true, hint: (u.bld ? 'Psychic Wave, from the building: ' : 'Psychic Wave: move up to ' + u.move + '" (or stay), then ') +
            'every enemy within 12" — no sight needed, Drones excepted — takes D6−1 Suppression.' };
        }
        case 'regain': {
          if (sup) return { on: false, hint: 'Suppressed units cannot reach out to the Esh-Aven.' };
          var rg = R.regainTargets(E.state, u);
          return rg.length
            ? { on: true, hint: 'Regain Control: stay put, and ' + rg.length + ' shaken Epsilon squad' + (rg.length > 1 ? 's' : '') +
                ' of Tier ' + R.ROMAN[u.tier] + ' or lower within 12" shed' + (rg.length > 1 ? '' : 's') + ' every Suppression point.' }
            : { on: false, hint: 'Regain Control: no shaken Epsilon squad of Tier ' + R.ROMAN[u.tier] + ' or lower within 12".' };
        }
        case 'selfrepair': {
          if (!u.damage) return { on: false, hint: 'Molecular Reconstruction: nothing to rebuild.' };
          return { on: true, hint: 'Self-repair: stay where it is and clear all ' + u.damage + ' Damage point' + (u.damage > 1 ? 's' : '') + '.' };
        }
        /* Time Vortex Generator (p. 142): "Once per game the aircraft may double
           its Movement parameter for a Move or Advance action." */
        case 'vortex': case 'vortexadv': {
          if (spent(u, 'vortex')) return { on: false, hint: 'Time Vortex Generator: already used this battle.' };
          if (id === 'vortexadv') {
            var adv = actionState(u, 'advance');
            if (!adv.on) return adv;
            return { on: true, hint: 'Time Vortex Generator: an Advance at double Movement — ' + 2 * u.move + '", then fire. Once a battle.' };
          }
          return { on: true, hint: 'Time Vortex Generator: a Move at double Movement — ' + (2 * u.move + moveBonus(u)) + '". Once a battle.' };
        }
        case 'teleport': {
          var tpads = R.teleportPads(E.state, u.side);
          var tpax = R.teleportFrom(E.state, u);
          if (!tpax.length) return { on: false, hint: 'Teleport: no steady infantry unit within 4" that has still to act.' };
          return { on: true, hint: 'Teleport: take in an infantry unit within 4". D6 — 1-2 it comes out at a random Teleport unit, 3-6 at the one you pick (' +
            tpads.length + ' on the table). It may still act this turn.' };
        }
        case 'rush': {
          if (spent(u, 'adrenaline')) return { on: false, hint: 'Adrenaline Rush: already used this battle.' };
          return { on: true, hint: 'Adrenaline Rush: act now, then act again straight away. Once a battle.' };
        }
        case 'laststand': {
          if (spent(u, 'lastStand')) return { on: false, hint: 'Last Stand: already used this battle.' };
          if (!u.sp) return { on: false, hint: 'Nothing to shake off.' };
          return { on: true, hint: 'Last Stand: shed all ' + u.sp + ' Suppression at once, and still act. Once a battle.' };
        }
        case 'coordinate': {
          if (sup) return { on: false, hint: 'Suppressed units cannot coordinate.' };
          if (u.coordUsed) return { on: false, hint: 'Already coordinated this turn.' };
          return { on: true, hint: 'Command Unit: stay put and activate up to ' + R.ruleValue(u, 'Command Unit') + ' friendly units within 12" in a row.' };
        }
      }
      return { on: false, hint: '' };
    }

    function chooseAction(id) {
      var u = ui.selected; if (!u) return;
      if (u.carrying) { stayPut(u); return; }             // loaded or unloaded: any button now means stay
      // driven first: all that is left is to load or unload, and anything else ends it where it stands
      if (u.carryMoved && id !== 'embark' && id !== 'disembark') { stayPut(u); return; }
      if (u.advancing) {
        if (id !== 'advance') return;
        if (ui.mode === 'advance-fire') { holdFire(u); return; }     // pressed again: it holds its fire
        ui.mode = 'advance-fire'; ui.moves = []; ui.terrain = [];
        ui.targets = targetsFor(u, {}).concat(R.steadyTargets(E.state, u));
        render();
        return;
      }
      if (ui.mode === id || (ui.mode === 'advance-move' && id === 'advance')) {   // toggle off
        ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.preview = null; render(); return;
      }
      if (!actionState(u, id).on) return;
      var st = R.status(u);
      u.vortexNow = false;                               // only the Time Vortex actions switch it on

      if (id === 'rush' || id === 'laststand') { doOnce(u, id); return; }
      // Skip: nothing done, nothing rolled (not even Unreliable's D6), the activation spent
      if (id === 'endchain') {
        if (!E.state.chain || E.state.chain.kind) return;
        E.state.chain = null;
        closeDrawer();
        logLine('note', 'The chain ends there; the rest keep their activations.');
        ui.selected = null; ui.mode = null; ui.moves = []; ui.targets = [];
        E.afterChain();
        return;
      }
      if (id === 'skip') {
        u.activated = true;
        closeDrawer();
        logLine('note', u.label + ' holds where it is and skips its action.');
        endActivation(u);
        return;
      }
      if (id === 'checkarea') {
        // two locations in reach: the player says which one is searched
        var sites = SC.searchSpots(E.state, u);
        if (sites.length > 1 && !isAI(u.side)) {
          ui.mode = 'checkarea';
          ui.moves = sites.map(function (s) { return { x: s.x, y: s.y, cost: 0, spent: 0, site: s }; });
          setHint(null, 'Two locations in reach: tap the one to search.');
          render();
          return;
        }
        doCheckArea(u); return;
      }
      if (id === 'sabotage') { doSabotage(u); return; }
      // Unreliable: a D6 before any action, and on a 1 the unit simply stands there
      if (R.campFlag(u, 'unreliable') && ['embark', 'disembark'].indexOf(id) < 0) {
        var ur = R.d6();
        if (ur === 1) {
          logLine('note', u.label + ' — Unreliable: D6 1, the order is not carried out.');
          pushRes({
            kind: 'Trauma', title: 'Unreliable', side: u.side,
            note: u.label + ' fails to move off. The action is wasted.',
            dice: [{ label: 'D6', value: ur }]
          });
          u.activated = true;
          endActivation(u);
          return;
        }
      }

      if (id === 'move') {
        ui.mode = 'move';
        ui.moves = R.reachable(E.state, u, u.move + moveBonus(u, 'move')).filter(function (c) { return canStand(u, c); });
        wireNote(u);
        if (st === 'suppressed') ui.moves = ui.moves.filter(function (c) { return safeSpot(u, c.x, c.y); });
      } else if (id === 'fire' || id === 'aux' || id === 'fireconc') {
        ui.mode = id === 'aux' ? 'aux' : 'fire';
        ui.concentrate = id === 'fireconc';
        ui.targets = targetsFor(u, { aux: id === 'aux' });
      } else if (id === 'advance') {
        ui.mode = 'advance-move';
        ui.moves = R.reachable(E.state, u, u.move).filter(function (c) { return canStand(u, c); });
        wireNote(u);
      } else if (id === 'assault' || id === 'plainassault') {
        ui.mode = 'assault';
        ui.noSap = id === 'plainassault';
        var must = forcedCharge(u);
        ui.targets = must ? [must] : assaultables(u);
      } else if (id === 'wave') {
        ui.mode = 'wave';
        // a garrison sends it out from the building, with no move
        ui.moves = u.bld ? [] : R.reachable(E.state, u, u.move).filter(function (c) { return canStand(u, c); });
        ui.moves.push({ x: u.x, y: u.y, cost: 0, spent: 0, turns: 0 });
      } else if (id === 'enter') {
        ui.mode = 'enter';
        ui.sections = R.enterTargets(E.state, u);
        setHint(null, u.bld ? 'Tap the section to move into.' : 'Tap the lit building to go in.');
      } else if (id === 'leave') {
        ui.mode = 'leave';
        ui.moves = E.leaveSpots(u);
        setHint(null, 'Tap the lit ground at the edge it goes off from. It leaves the battle and counts as fled.');
      } else if (id === 'exitbld') {
        ui.mode = 'exitbld';
        ui.moves = R.exitSpots(E.state, u);
      } else if (id === 'drivefirst') {
        ui.mode = 'carry-first';
        ui.moves = R.reachable(E.state, u, Math.ceil(u.move / 2)).filter(function (c) { return canStand(u, c); });
      } else if (id === 'embark') {
        ui.mode = 'embark';
        ui.targets = activeUnits(u.side).filter(function (t) { return R.canEmbark(E.state, u, t); });
      } else if (id === 'disembark') {
        ui.mode = 'disembark';
        ui.moves = dropFor(u);
      } else if (id === 'strafe') {
        ui.mode = 'strafe';
        // the run ends where the craft could stop: not over a tall building or a hilltop (p. 38)
        ui.moves = R.reachable(E.state, u, u.move).filter(function (c) { return canStand(u, c); });
      } else if (id === 'demolish') {
        ui.mode = 'demolish';
        ui.terrain = demolishTargets(u, false);
      } else if (id === 'breach') {
        ui.mode = 'breach';
        ui.terrain = breachTargets(u);
      } else if (id === 'support') {
        ui.mode = 'support';
        ui.targets = targetsFor(u, {});
      } else if (id === 'steady') {
        ui.mode = 'steady';
        ui.targets = R.steadyTargets(E.state, u);
      } else if (id === 'hack') {
        ui.mode = 'hack';
        ui.targets = E.state.units.filter(function (t) { return R.canHack(E.state, u, t); });
      } else if (id === 'designate' || id === 'marktarget') {
        ui.mode = 'designate';
        ui.markKind = id === 'marktarget' ? 'mark' : 'designate';
        ui.markPicks = [];
        u.markMoved = false;
        ui.targets = markTargets(u);
        // "the unit may move up to its standard Movement range and designate" (p. 58)
        ui.moves = R.has(u, 'Stationary Artillery') ? [] : R.reachable(E.state, u, u.move);
        setHint(null, markHint(u));
      } else if (id === 'vortex') {
        u.vortexNow = true;
        ui.mode = 'move';
        ui.moves = R.reachable(E.state, u, 2 * u.move + moveBonus(u, 'move')).filter(function (c) { return canStand(u, c); });
      } else if (id === 'vortexadv') {
        u.vortexNow = true;
        ui.mode = 'advance-move';
        ui.moves = R.reachable(E.state, u, 2 * u.move).filter(function (c) { return canStand(u, c); });
      } else if (id === 'regain') {
        doRegain(u); return;
      } else if (id === 'selfrepair') {
        doSelfRepair(u); return;
      } else if (id === 'teleport') {
        ui.mode = 'teleport';
        ui.targets = R.teleportFrom(E.state, u);
        setHint(null, 'Teleport: tap the infantry unit to send.');
      } else if (id === 'detonate') {
        doDetonate(u); return;
      } else if (id === 'stance') {
        doStance(u); return;
      } else if (id === 'coordinate') {
        u.coordUsed = true; u.activated = true;
        addFx({ kind: 'wave', x: u.x, y: u.y, up: 0, r: 12, rgb: '232,193,90', dur: 1300, blocking: true });
        E.state.chain = { side: u.side, remaining: R.ruleValue(u, 'Command Unit') + 1, x: u.x, y: u.y, tier: u.tier, by: u.id };
        logLine('note', u.label + ' coordinates: up to ' + R.ruleValue(u, 'Command Unit') + ' friendly units within 12" activate in a row.');
        endActivation(); return;
      } else if (id === 'regroup') {
        u.activated = true;
        closeDrawer();
        if (R.isMachine(u)) {
          var rep = abRepair(E.state, u);
          logLine('rally', rep ? rep.text : u.label + ' stands down — no damage to repair.');
          pushRes(repairCard(u, rep));
        } else {
          // Meditation (p. 142): a Xenotripod regrouping sheds two more points outright
          var pre = '';
          if (R.isXeno(u) && u.sp && R.doctrine(E.state, u.side, 'XT2')) {
            var med = Math.min(2, u.sp); u.sp -= med;
            pre = 'Meditation: ' + med + ' SP gone before the dice.';
            logLine('rally', u.label + ' — ' + pre);
          }
          var r = abRally(E.state, u, { regroup: true });
          logLine('rally', r ? r.text : u.label + ' regroups — no suppression to shake off.');
          // the End phase's rally card and the unit seen to regroup (endphase.js)
          pushRes(E.regroupCard(u, r, pre));
          E.regroupFx(u, r);
        }
        endActivation(); return;
      }
      render();
      if (ui.targets.length || ui.moves.length) revealConsole();
    }

    /* Which squad aboard u gets off next: the one the player picked (dropNext),
       if it is still aboard and may get off, else the first loaded. */
    function nextOff(u) {
      var free = (u.cargo || []).filter(function (c) { return !c.boarded; });
      return free.filter(function (c) { return c.id === u.dropNext; })[0] || free[0] || null;
    }
    /* Where the next squad aboard u may be put down (R.dropSpots), inside the
       scenario's bounds; the hull's own spot if nowhere will do. */
    function dropFor(u) {
      var rider = nextOff(u);
      var spots = rider ? R.dropSpots(E.state, u, rider).filter(function (c) { return canStand(rider, c); }) : [];
      return spots.length ? spots : [{ x: u.x, y: u.y, cost: 0 }];
    }

    return {
      actionState: actionState, chooseAction: chooseAction, dropFor: dropFor, nextOff: nextOff
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineActions;
})(typeof window !== 'undefined' ? window : global);
