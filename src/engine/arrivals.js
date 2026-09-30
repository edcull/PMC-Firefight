/* PMC 2670 — Firefight : reserves and arrivals: landing zones, entry points, insertion and where each unit comes on

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineArrivals = function (E) {
    var H = E.H, R = E.R, SC = E.SC, SNAP_NEAR = E.SNAP_NEAR, SOLO = E.SOLO, UR = E.UR, W = E.W,
        aiInsert = E.aiInsert, byId = E.byId, docsOf = E.docsOf, fitView = E.fitView,
        focusUnit = E.focusUnit, inReserve = E.inReserve, insertionLegal = E.insertionLegal, isAI = E.isAI,
        landUnit = E.landUnit, logLine = E.logLine, other = E.other, pushRes = E.pushRes, render = E.render,
        revealConsole = E.revealConsole, samCheck = E.samCheck, scatterInsertion = E.scatterInsertion,
        setHint = E.setHint, showArrival = E.showArrival, sideName = E.sideName,
        soloOwnerName = E.soloOwnerName, ui = E.ui, whenIdle = E.whenIdle;

    /* ================= turn structure ================= */
    /* Reserve phase (p. 30): from the second turn on, units held back may come in.
       Placing them is not an action, so they can act normally afterwards. */
    function reservePhase(done) {
      // the scenario's own reinforcements arrive first — the player choosing where
      scenarioArrivals(function () { afterArrivals(done); });
    }

    function afterArrivals(done) {
      if (E.state.turn < 2 || E.state.solo) { done(); return; }
      /* Know Your Foe! (p. 141): once a battle, the tribe stops every enemy
         reinforcement arriving this turn — used the first turn the enemy has any. */
      E.state.kyf = E.state.kyf || {};
      E.state.kyfAsked = E.state.kyfAsked || {};
      function useKyf(side) {
        var foe = other(side);
        E.state.kyf[side] = E.state.turn;
        logLine('note', sideName(side) + ' — Know Your Foe!: no reinforcements reach ' + sideName(foe) + ' this turn.');
        pushRes({ kind: 'Advancement', title: 'Know Your Foe!', side: side, note: 'Once a battle: every enemy reinforcement is held back this turn.' });
      }
      var kyfWait = null;
      ['A', 'B'].forEach(function (side) {
        var foe = other(side);
        if (docsOf(side).indexOf('XO6') < 0 || E.state.kyf[side]) return;
        if (!inReserve().some(function (u) { return u.side === foe && (!u.wave || u.insert); })) return;
        // the AI uses it the first turn it can; a player is asked, once a turn, whether this is the turn
        if (isAI(side)) { useKyf(side); return; }
        if (E.state.kyfAsked[side] !== E.state.turn && !kyfWait) kyfWait = side;
      });
      if (kyfWait) {
        E.state.kyfAsked[kyfWait] = E.state.turn;
        E.state.kyfAsk = { side: kyfWait, n: inReserve().filter(function (u) { return u.side === other(kyfWait) && (!u.wave || u.insert); }).length };
        ui.kyfThen = function (yes) {
          var sd = E.state.kyfAsk.side;
          E.state.kyfAsk = null; ui.kyfThen = null;
          if (yes) useKyf(sd);
          afterArrivals(done);
        };
        setHint(null, 'Know Your Foe! — hold back every enemy reinforcement this turn?');
        revealConsole();
        render();
        return;
      }
      function held(u) { var f = other(u.side); return E.state.kyf && E.state.kyf[f] === E.state.turn; }
      // by Battlefield Insertion: those held for it, and those the scenario's split holds back to come in by it
      var mine = inReserve().filter(function (u) { return (!u.wave || u.insert) && !held(u); });
      var i = 0;
      if (!mine.length) { done(); return; }
      // the sides take it in turn, starting with the initiative
      var order = [];
      var a = mine.filter(function (u) { return u.side === E.state.initiative; });
      var b = mine.filter(function (u) { return u.side !== E.state.initiative; });
      for (var k = 0; k < Math.max(a.length, b.length); k++) {
        if (a[k]) order.push(a[k]);
        if (b[k]) order.push(b[k]);
      }
      function next() {
        if (i >= order.length) { done(); return; }
        var u = order[i++];
        if (!u.alive || !u.reserve) { next(); return; }
        if (isAI(u.side)) { aiInsert(u, function () { whenIdle(next); }); return; }
        askInsertion(u, next);
      }
      next();
    }

    /* Scenario reinforcements: units the scenario holds back and then releases —
       a second wave, a defender's reserve, an orbital drop into a landing zone.
       They are placed where the scenario says rather than by the player. */
    /* Crushing the Resistance and Sabotage: before the first drop, each player
       nominates the landing zone their commando comes down in (pp. 150, 155). */
    function lzWanted() {
      if (!E.state.scen.needLZ || E.state.turn !== 1) return null;
      E.state.sc.lz = E.state.sc.lz || {};
      var own = E.state.solo ? E.state.solo.owners : [1];
      for (var i = 0; i < own.length; i++) {
        var o = own[i];
        if (E.state.sc.lz[o]) continue;
        var any = E.state.units.some(function (u) { return u.side === 'A' && (u.owner || 1) === o && u.reserve && u.wave === 1; });
        if (any) return o;
      }
      return null;
    }

    function askLZ(owner, done) {
      if (isAI('A')) {
        E.state.sc.lz[owner] = SOLO.autoLZ(E.state, owner);
        logLine('note', (E.state.solo ? soloOwnerName(owner) : 'The commando') + ' nominates a landing zone.');
        done(); return;
      }
      var spots = SOLO.lzSpots(E.state, owner);
      if (!spots.length) { E.state.sc.lz[owner] = SOLO.autoLZ(E.state, owner); done(); return; }
      ui.insertion = { unit: null, owner: owner, done: done, spots: spots, kind: 'lz' };
      ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
      fitView();
      setHint(null, (E.state.solo && E.state.solo.coop ? soloOwnerName(owner) + ': tap' : 'Tap') +
        ' the shaded ground to nominate your landing zone.');
      revealConsole();
      render();
    }

    /* Where the scenario leaves it to the player which reserves come on this turn
       (Find and secure's Priority Level a turn, Hostile takeover's second part),
       they pick them before any are placed. */
    function askReservePick(side, done) {
      var p = SC.reservePick(E.state, side);
      var ids = p.pool.map(function (u) { return u.id; });
      ui.reservePick = {
        side: side, ids: ids, min: p.min, max: p.max, text: p.text,
        chosen: p.min === ids.length ? ids.slice() : [],
        finish: function () {
          var ch = ui.reservePick.chosen.slice();
          E.state.sc.picked[side] = ch.map(byId).filter(Boolean);
          logLine('note', sideName(side) + ' brings on ' + (ch.length ? E.state.sc.picked[side].map(function (u) { return u.label; }).join(', ') : 'nobody from reserve') + '.');
          ui.reservePick = null;
          done();
        }
      };
      ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
      setHint(null, 'Reserves: choose which units come on this turn.');
      revealConsole();
      render();
    }

    /* Invasion (p. 53): with the defender down, the attacker nominates the three
       landing zones before the first wave drops — a tap for each, or the AI's pick. */
    function askInvasionLZ(done) {
      var atk = E.state.sc.attacker;
      if (isAI(atk)) {
        SC.setLZs(E.state, SC.autoLZs(E.state));
        logLine('note', sideName(atk) + ' nominates three landing zones.');
        done(); return;
      }
      var chosen = [];
      function ask() {
        var spots = SC.lzSpots(E.state, chosen);
        if (!spots.length) { SC.setLZs(E.state, chosen.concat(SC.autoLZs(E.state)).slice(0, 3)); done(); return; }
        ui.insertion = { unit: null, by: atk, owner: null, spots: spots, kind: 'ilz', chosen: chosen.slice(), n: chosen.length + 1,
          done: function (p) {
            chosen.push(p);
            logLine('note', sideName(atk) + ' nominates landing zone ' + chosen.length + '.');
            if (chosen.length >= 3) { SC.setLZs(E.state, chosen); done(); } else ask();
          } };
        ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
        setHint(null, 'Tap the shaded ground to nominate landing zone ' + (chosen.length + 1) + ' of 3.');
        revealConsole();
        render();
      }
      fitView();
      ask();
    }

    function scenarioArrivals(after) {
      if (E.state.sc && E.state.sc.lzPending) { askInvasionLZ(function () { scenarioArrivals(after); }); return; }
      var lzFor = lzWanted();
      if (lzFor) { askLZ(lzFor, function () { scenarioArrivals(after); }); return; }
      if (E.state.sc.pickedTurn !== E.state.turn) { E.state.sc.picked = {}; E.state.sc.pickedTurn = E.state.turn; }
      var pickSide = ['A', 'B'].filter(function (sd) {
        if (isAI(sd) || E.state.sc.picked[sd] || (E.state.scen.autoArrive && !E.state.scen.pickReserves)) return false;
        var pk = SC.reservePick(E.state, sd);
        if (!pk) return false;
        if (!pk.pool.length) { E.state.sc.picked[sd] = []; return false; }
        return true;
      })[0];
      if (pickSide) { askReservePick(pickSide, function () { scenarioArrivals(after); }); return; }
      var log = [];
      /* The OpFor's reinforcements are placed for it; the player's are asked for,
         one at a time, because where along a landing zone or a table edge a unit
         comes on is a decision the book leaves open and a dice roll should not
         be making. */
      var ask = [];
      /* Who comes on first. Normally both sides alternate; an Invasion's attacker
         lands after the defender's reserves are down, and a Demolish defender
         after the attacker's (pp. 53-54). Every unit is taken in that order, the
         placed ones and the asked-for ones alike. */
      // alternating from the side with the initiative (p. 27), unless the scenario orders them
      var sides = E.state.initiative === 'B' ? ['B', 'A'] : ['A', 'B'], inTurn = true;
      if (E.state.sc && E.state.sc.attacker) {
        var atk0 = E.state.sc.attacker, def0 = atk0 === 'A' ? 'B' : 'A';
        if (E.state.scen.id === 'invasion') { sides = [def0, atk0]; inTurn = false; }
        else if (E.state.scen.id === 'demolish') { sides = [atk0, def0]; inTurn = false; }
      }
      var bySide = {};
      sides.forEach(function (side) {
        var coming = E.state.sc.picked[side] ? E.state.sc.picked[side].slice() : SC.reserves(E.state, side);
        // Evacuation: the pick is only the player's own reserves; the civilians still roll to come out
        if (E.state.sc.picked[side] && E.state.scen.pickReserves) {
          SC.reserves(E.state, side).forEach(function (u) { if (coming.indexOf(u) < 0) coming.push(u); });
        }
        /* Semper Fidelis (Battle Honour, p. 88): a unit held in the scenario's
           reserve may come on automatically on any turn but the first — no roll,
           no waiting for its wave. Where it may come on is still the scenario's. */
        if (E.state.turn >= 2 && !(E.state.sc && E.state.sc.zonesHot === E.state.turn && E.state.sc.attacker === side)) {
          E.state.units.forEach(function (u) {
            if (u.side !== side || !u.alive || !u.reserve || coming.indexOf(u) >= 0) return;
            if (!semperFidelis(u) || u.wave == null || u.wave === 'pool') return;
            u.sfOffer = true;
            coming.push(u);
          });
        }
        bySide[side] = coming;
      });
      /* "Apply the Alternate activation rule" to the Reserve phase (p. 26): one of
         the first side's, one of the other's, and so on, until both are done. */
      if (inTurn) {
        for (var k = 0; k < Math.max(bySide[sides[0]].length, bySide[sides[1]].length); k++) {
          if (bySide[sides[0]][k]) ask.push(bySide[sides[0]][k]);
          if (bySide[sides[1]][k]) ask.push(bySide[sides[1]][k]);
        }
      } else sides.forEach(function (side) { bySide[side].forEach(function (u) { ask.push(u); }); });
      function placeAuto(u) {
        u.sfOffer = false;
        var p = arrivalPoint(u);
        if (!p) return;
        landArrival(u, p, log);
        if (semperFidelis(u)) log.push(u.label + ' — Semper Fidelis: arrives when called for.');
        showArrival(u);
      }
      // Coordinated Hive (p. 124): the swarm's failed reserve dice, rolled again
      if (E.state.sc && E.state.sc.hive && E.state.sc.hive.turn === E.state.turn && !E.state.sc.hive.told) {
        E.state.sc.hive.told = true;
        var hv = E.state.sc.hive;
        var hl = 'Coordinated Hive — ' + sideName(hv.side) + ' re-rolls ' + hv.n + ' failed reserve ' + (hv.n === 1 ? 'die' : 'dice') + ': ' + hv.up + ' come' + (hv.up === 1 ? 's' : '') + ' on after all.';
        logLine('note', hl); log.push(hl);
      }
      // Invasion: the second wave waved off because every zone is in enemy hands (p. 53)
      if (E.state.sc && E.state.sc.zonesHot === E.state.turn) {
        var hot = 'All landing zones are hot! Repeat! All landing zones are hot! — the '
          + 'second wave cannot come down this turn.';
        logLine('note', hot);
        log.push(hot);
      }
      function report() {
        if (log.length) {
          var entry = E.state.turn === 1 && E.state.scen.entersTurn1;
          pushRes({
            kind: 'Reserves', title: 'Turn ' + E.state.turn + (entry ? ' — entering the table' : ' — reinforcements'),
            note: entry ? E.state.scen.name + ': the companies come on from their own table edges, a unit each in turn from the initiative.'
              : E.state.scen.name + ': units held back come onto the table.',
            list: log.map(function (t) { return { text: t }; })
          });
          render();
        }
        if (after) after();
      }

      // in order: the OpFor's placed, the player's asked for, then the lot reported together
      var i = 0;
      (function next() {
        while (i < ask.length) {
          var u = ask[i++];
          if (!u.alive || !u.reserve) continue;
          // a solitaire scenario says exactly where its units come on
          // (turn 1's entry, for a player who asked to have their units brought on for them)
          var auto = E.state.turn === 1 && E.state.autoEnter && E.state.autoEnter[u.side];
          if (isAI(u.side) || E.state.scen.autoArrive || auto) { placeAuto(u); continue; }
          askArrival(u, log, next);
          return;
        }
        report();
      })();
    }

    /* Where a scenario reinforcement comes on. Landing zones for an Invasion drop,
       the side's own table edge otherwise. */
    function arrivalPoint(u) {
      if (E.state.scen.arrivalPoint) return E.state.scen.arrivalPoint(E.state, u);
      var sc = E.state.sc;
      if (E.state.scen.id === 'invasion' && u.side === sc.attacker) {
        // into a zone the attacker holds, or a neutral one
        var zones = E.state.objectives.filter(function (o) { return o.owner !== sc.defender; });
        if (!zones.length) zones = E.state.objectives.slice();
        for (var t = 0; t < 400; t++) {
          var z = zones[Math.floor(Math.random() * zones.length)];
          var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 4;
          var p = R.clampBoard({ x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r });
          if (R.TERRAIN[R.terrainAt(E.state, p.x, p.y)].impassable) continue;
          if (R.unitNear(E.state, p.x, p.y, u, 1)) continue;
          p.why = 'in the landing zone';
          return p;
        }
        return null;
      }
      /* Everyone else walks on from their own table edge — which in Demolish is the
         stretches of edge around the corners that side owns, not a whole side of
         the table (p. 54). */
      var entry = entryFor(u);
      if (entry && entry.length) {
        // 12" clear of the enemy if it can be, closer only if it cannot (p. 30)
        for (var pass = 0; pass < 2; pass++) {
          for (var e = 0; e < 600; e++) {
            // which band — which table edge, which corner — is chosen fresh each time
            var b = entry[Math.floor(Math.random() * entry.length)];
            var q = {
              x: Math.max(UR, Math.min(W - UR, b.x + Math.random() * b.w)),
              y: Math.max(UR, Math.min(H - UR, b.y + Math.random() * b.h))
            };
            if (R.TERRAIN[R.terrainAt(E.state, q.x, q.y)].impassable) continue;
            if (R.unitNear(E.state, q.x, q.y, u, 1)) continue;
            if (!pass && !clearOfEnemy(u, q)) continue;
            return { x: q.x, y: q.y, why: 'from its own table edge' };
          }
        }
        return null;
      }
      var edge = u.side === 'A' ? UR + 0.5 : W - UR - 0.5;
      for (var pass2 = 0; pass2 < 2; pass2++) for (var k = 0; k < 400; k++) {
        var y = UR + Math.random() * (H - 2 * UR);
        var x = edge + (Math.random() - 0.5) * 2;
        if (R.TERRAIN[R.terrainAt(E.state, x, y)].impassable) continue;
        if (R.unitNear(E.state, x, y, u, 1)) continue;
        if (!pass2 && !clearOfEnemy(u, { x: x, y: y })) continue;
        return { x: R.clampBoard({ x: x, y: y }).x, y: y, why: 'from its own table edge' };
      }
      return null;
    }

    /* ---- where a scenario reinforcement may legally come on ----

       `arrivalPoint` picks one of these at random, which is right for the OpFor
       and wrong for the player: the book gives a landing zone or a stretch of
       table edge, and choosing where inside it to come on is a decision worth
       making — behind the wall, or out wide. So the same area is sampled on a 2"
       lattice and offered the way an insertion is. */
    /* Where a unit walks on from. Invasion's defender comes on "from a random
       table edge (but from a point nominated by the defender)" (p. 53): the edge
       is rolled for the unit as it arrives, and only the point along it chosen. */
    var EDGE_NAMES = ['top', 'bottom', 'left', 'right'];
    function entryFor(u) {
      var sc = E.state.sc, entry = sc && sc.entry && sc.entry[u.side];
      if (!entry || !entry.length) return entry;
      if (!(sc.randomEdge && sc.randomEdge[u.side]) || entry.length !== 4) return entry;
      if (u.entryEdge == null) {
        u.entryEdge = Math.floor(Math.random() * 4);
        logLine('note', u.label + ' — random table edge: the ' + EDGE_NAMES[u.entryEdge] + ' edge.');
      }
      return [entry[u.entryEdge]];
    }
    function arrivalLegal(u, p) {
      if (p.x < UR || p.y < UR || p.x > W - UR || p.y > H - UR) return false;
      if (E.state.scen.arrivalLegal) return E.state.scen.arrivalLegal(E.state, u, p) && !R.unitNear(E.state, p.x, p.y, u, 1);
      if (R.TERRAIN[R.terrainAt(E.state, p.x, p.y)].impassable) return false;
      if (R.unitNear(E.state, p.x, p.y, u, 1)) return false;
      var sc = E.state.sc;
      // Invasion: the attacker comes down in a zone the defender does not hold
      if (E.state.scen.id === 'invasion' && sc && u.side === sc.attacker) {
        var zones = E.state.objectives.filter(function (o) { return o.owner !== sc.defender; });
        if (!zones.length) zones = E.state.objectives;
        return zones.some(function (z) { return R.inches(p.x, p.y, z.x, z.y) <= 4; });
      }
      // everyone else walks on from their own edge, or the corners they own
      var entry = entryFor(u);
      if (entry && entry.length) {
        return entry.some(function (b) {
          return p.x >= b.x - 0.5 && p.x <= b.x + b.w + 0.5 &&
            p.y >= b.y - 0.5 && p.y <= b.y + b.h + 0.5;
        });
      }
      var edge = u.side === 'A' ? UR + 0.5 : W - UR - 0.5;
      return Math.abs(p.x - edge) <= 1.5;
    }

    /* "...placed up to 4\" from the table border and at least 12\" from the enemy.
       If for any reason it is impossible, they should be placed closer" (p. 30). */
    function clearOfEnemy(u, p) {
      return !E.state.units.some(function (e) {
        return e.alive && e.side !== u.side && !e.aboard && !e.reserve && e.x >= 0 && R.unitDist({ x: p.x, y: p.y }, e) < 12;
      });
    }
    // a walk-on from a table edge keeps its distance; a landing zone or a scenario's own entry points do not
    function edgeArrival(u) {
      var sc = E.state.sc;
      if (E.state.scen.arrivalPoint || E.state.scen.arrivalLegal) return false;
      return !(E.state.scen.id === 'invasion' && sc && u.side === sc.attacker);
    }
    function arrivalSpots(u) {
      var out = [];
      for (var x = 1; x <= W - 1; x += 1) {
        for (var y = 1; y <= H - 1; y += 1) {
          var p = { x: x, y: y };
          if (arrivalLegal(u, p)) out.push(p);
        }
      }
      if (edgeArrival(u)) {
        var far = out.filter(function (p) { return clearOfEnemy(u, p); });
        if (far.length) return far;
      }
      return out;
    }


    /* Where a drop may legally go, sampled across the table on a 2" lattice. It
       shades the ground for the player, and it answers the question that used to
       wedge the game: whether there is anywhere to drop at all. */
    function insertionSpots(u) {
      var out = [];
      if (SC.noInsertion(E.state)) return out;
      for (var x = 4; x <= W - 4; x += 2) {
        for (var y = 4; y <= H - 4; y += 2) {
          var p = { x: x, y: y };
          if (!insertionLegal(p)) continue;
          if (R.unitNear(E.state, x, y, u, 1)) continue;
          out.push(p);
        }
      }
      return out;
    }

    // the player picks the drop point by tapping the table
    function askInsertion(u, done) {
      var spots = insertionSpots(u);
      /* No legal ground anywhere — the objectives and the table edge between them
         cover it. The unit stays out rather than the turn stopping dead. */
      if (!spots.length) {
        u.reserve = true;
        logLine('note', u.label + ' could find no drop zone clear of the objectives and stays in reserve.');
        setHint(null, u.name + ' has nowhere legal to come down this turn and stays in reserve.');
        whenIdle(function () { done(); });
        return;
      }
      ui.insertion = { unit: u, done: done, spots: spots, kind: 'insert' };
      ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
      focusUnit(u, false, true);
      setHint(null, u.name + ' is coming in: tap the shaded ground — 12" from every objective and 4" in from the edge.');
      /* On a phone the panel under the board is a stack of tabs, and the player is
         often sitting on the combat results when this fires — so the prompt was
         rendered into a pane nobody was looking at and the turn appeared to stop
         for no reason. Bring the Actions pane to the front before asking. */
      revealConsole();
      render();
    }

    /* A scenario reinforcement: the scenario says it is coming on this turn, so
       there is no holding it back — but where inside the legal ground it arrives
       is the player's call, not a dice roll. */
    function askArrival(u, log, done) {
      var spots = arrivalSpots(u);
      if (!spots.length) {
        // no legal ground: fall back to the old random point rather than stalling
        var p = arrivalPoint(u);
        if (p) { landArrival(u, p, log); showArrival(u); }
        whenIdle(function () { done(); });
        return;
      }
      ui.insertion = { unit: u, done: done, spots: spots, kind: 'arrive', log: log };
      ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
      // a unit not yet on the table has nowhere to be looked at: the ground it may come on is shown instead
      if (u.x < 0 && E.lookAtDeployment) E.lookAtDeployment(u.side); else focusUnit(u, false, true);
      setHint(null, u.name + ' is arriving: tap the shaded ground to choose where it comes on.');
      revealConsole();
      render();
    }

    // put an arriving unit down and tell the player what the scenario makes of it
    function landArrival(u, p, log) {
      u.x = p.x; u.y = p.y; u.reserve = false; u.wave = 0;
      if (E.faces(u)) u.facing = E.faceDefault(u);
      var note = E.state.scen.onArrive ? E.state.scen.onArrive(E.state, u) : null;
      var line = u.label + ' arrives' + (p.why ? ' ' + p.why : '') + (note ? ' — ' + note.text : '') + '.';
      if (log) log.push(line);
      logLine('note', u.label + ' arrives' + (p.why ? ' ' + p.why : '') + '.');
      if (note) logLine('note', note.text);
      samCheck(u);
      return line;
    }

    // the player would rather keep it back for a turn (p. 56: coming in is optional)
    function holdInsertion() {
      var ins = ui.insertion;
      if (!ins) return;
      ins.unit.reserve = true;
      logLine('note', ins.unit.label + ' holds off and stays in reserve.');
      ui.insertion = null; ui.mode = 'idle'; ui.hint = null;
      var done = ins.done;
      render();
      whenIdle(function () { done(); });
    }

    /* Semper Fidelis (p. 88) brings the unit's transport with it — but only when
       the unit is the one thing riding in it. */
    function semperFidelis(u) {
      if (R.campFlag(u, 'semperFidelis')) return true;
      var c = u.cargo || [];
      return c.length === 1 && R.campFlag(c[0], 'semperFidelis');
    }

    function sfName(u) {
      var c = u.cargo || [];
      return !R.campFlag(u, 'semperFidelis') && c.length === 1 ? c[0].name + ' (aboard ' + u.name + ')' : u.name;
    }

    // Semper Fidelis: the player would rather call the unit in on a later turn
    function holdArrival() {
      var ins = ui.insertion;
      if (!ins || !ins.unit) return;
      ins.unit.sfOffer = false;
      logLine('note', ins.unit.label + ' — Semper Fidelis: held back for now.');
      ui.insertion = null; ui.mode = 'idle'; ui.hint = null;
      var done = ins.done;
      render();
      whenIdle(function () { done(); });
    }

    // in the player's words, where this unit is allowed to come on
    function arrivalWhere(u) {
      var sc = E.state.sc;
      if (E.state.scen.id === 'invasion' && sc && u.side === sc.attacker) {
        return 'within 4" of a landing zone you hold or that is still neutral';
      }
      var entry = entryFor(u);
      if (sc && sc.randomEdge && sc.randomEdge[u.side] && u.entryEdge != null) return 'along the ' + EDGE_NAMES[u.entryEdge] + ' table edge, the one rolled for it';
      if (entry && entry.length > 1) return 'along the stretches of table edge your side owns';
      return 'along your own table edge';
    }

    function snapToSpot(ins, p, reach) {
      var spots = ins.spots || [];
      if (!spots.length) return null;
      reach = reach || SNAP_NEAR;
      var best = null, bd = Infinity;
      for (var i = 0; i < spots.length; i++) {
        var d = R.inches(p.x, p.y, spots[i].x, spots[i].y);
        if (d < bd) { bd = d; best = spots[i]; }
      }
      return bd <= reach ? best : null;
    }

    function placeInsertion(p) {
      var ins = ui.insertion;
      if (!ins) return;
      var u = ins.unit;
      if (ins.kind === 'ilz') {
        if (!SC.lzOK(E.state, p, ins.chosen)) {
          var nz2 = snapToSpot(ins, p);
          if (!nz2) { setHint(null, 'Not there — open ground, 8" clear of every table edge and 12" from the other landing zones.'); return; }
          p = nz2;
        }
        ui.insertion = null; ui.mode = 'idle';
        var doneI = ins.done;
        render();
        whenIdle(function () { doneI({ x: p.x, y: p.y }); });
        return;
      }
      if (ins.kind === 'lz') {
        var lzOK = SOLO.lzLegal(E.state, p, ins.owner);
        if (!lzOK) {
          var nz = snapToSpot(ins, p);
          if (!nz) { setHint(null, 'Not there — open ground, 12" clear of every table edge' + (E.state.solo && E.state.solo.coop ? ', and 18" from the other landing zone' : '') + '.'); return; }
          p = nz;
        }
        E.state.sc.lz[ins.owner] = { x: p.x, y: p.y };
        logLine('note', (E.state.solo && E.state.solo.coop ? soloOwnerName(ins.owner) : 'The commando') + ' will come down in the landing zone at (' + p.x.toFixed(0) + '", ' + p.y.toFixed(0) + '").');
        ui.insertion = null; ui.mode = 'idle';
        var doneL = ins.done;
        render();
        whenIdle(function () { doneL(); });
        return;
      }
      if (ins.kind === 'shove') {
        var sh = snapToSpot(ins, p);
        if (!sh || R.inches(sh.x, sh.y, u.x, u.y) > ins.drift + 0.01) { setHint(null, 'Not there — within ' + ins.drift + '" of the arrival point, off impassable ground and clear of other units.'); return; }
        var moved = R.inches(sh.x, sh.y, u.x, u.y);
        u.x = sh.x; u.y = sh.y;
        logLine('note', sideName(ins.by) + ' shoves ' + u.label + '\u2019s arrival point ' + moved.toFixed(1) + '".');
        pushRes({
          kind: 'Insertion', title: u.name, side: u.side,
          dice: [{ label: 'D6', value: ins.die, tone: 'fail' }, { label: '2D6"', value: ins.drift }],
          note: 'Battlefield Insertion — on 4-6 the opponent moves the arrival point up to 2D6" in any direction.',
          outcome: { text: moved < 0.1 ? 'Left where it was.' : 'Shoved ' + moved.toFixed(1) + '" off the nominated point.', tone: 'warn' }
        });
        ui.insertion = null; ui.mode = 'idle'; ui.hint = null;
        var doneS = ins.done;
        doneS();
        return;
      }
      if (ins.kind === 'arrive') {
        // with ground 12" clear of the enemy on offer, it has to come on there
        var mustClear = edgeArrival(u) && (ins.spots || []).some(function (q) { return clearOfEnemy(u, q); });
        if (!arrivalLegal(u, p) || (mustClear && !clearOfEnemy(u, p))) {
          // walking on from its own edge forgives a miss as far as deploying on it does (9")
          var near = snapToSpot(ins, p, edgeArrival(u) ? 9 : null);
          if (!near) {
            setHint(null, 'Not there — ' + arrivalWhere(u) + (mustClear ? ', 12" clear of the enemy' : '') + ', and off impassable ground.');
            return;
          }
          p = near;
        }
        if (u.sfOffer && ins.log) ins.log.push(u.label + ' — Semper Fidelis: called in.');
        u.sfOffer = false;
        landArrival(u, { x: p.x, y: p.y, why: 'where you put it' }, ins.log || null);
        showArrival(u);
        ui.insertion = null; ui.mode = 'idle';
        var doneA = ins.done;
        E.askFacing(u.side, [u], function () { whenIdle(function () { doneA(); }); });
        return;
      }
      if (!insertionLegal(p) || R.unitNear(E.state, p.x, p.y, u, 1)) {
        var spot = snapToSpot(ins, p);
        if (!spot) {
          setHint(null, 'Not there — 12" clear of every objective, 4" in from the edge, and off impassable ground.');
          return;
        }
        p = spot;
      }
      u.x = p.x; u.y = p.y; u.reserve = false;
      logLine('note', u.label + ' comes in by Battlefield Insertion.');
      ui.insertion = null; ui.mode = 'idle';
      var done = ins.done;
      scatterInsertion(u, function () {
        landUnit(u); render();
        E.askFacing(u.side, [u], function () { whenIdle(function () { done(); }); });
      });
    }

    return {
      reservePhase: reservePhase, arrivalLegal: arrivalLegal, arrivalSpots: arrivalSpots,
      insertionSpots: insertionSpots, holdInsertion: holdInsertion, semperFidelis: semperFidelis,
      sfName: sfName, holdArrival: holdArrival, arrivalWhere: arrivalWhere, snapToSpot: snapToSpot,
      placeInsertion: placeInsertion
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineArrivals;
})(typeof window !== 'undefined' ? window : global);
