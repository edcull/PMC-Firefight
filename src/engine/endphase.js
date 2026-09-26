/* PMC 2670 — Firefight : the end of the turn: fleeing, rallying, repairs, objectives, the battle report

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineEndPhase = function (E) {
    var H = E.H, R = E.R, SC = E.SC, SFX = E.SFX, UR = E.UR, V = E.V, W = E.W, abRally = E.abRally,
        abRepair = E.abRepair, activeUnits = E.activeUnits, addFx = E.addFx, animateMove = E.animateMove,
        beginTurn = E.beginTurn, canStand = E.canStand, focusUnit = E.focusUnit, logLine = E.logLine,
        nearestEnemy = E.nearestEnemy, onTable = E.onTable, pushRes = E.pushRes, render = E.render,
        sideName = E.sideName, soloAfterMove = E.soloAfterMove, ui = E.ui;

    // The rally phase is walked unit by unit: roll, show the card, wait for Continue.
    /* The start of the Rally phase (p. 34): every Broken unit on the table flees
       Movement + 2" away from the closest enemy, paying for terrain as usual and
       keeping away from the enemy as long as it can. One that can run off the
       table does, and is gone — fled. Only then do the rally rolls come.
       A solitaire game has no "own lines" either way: its scenarios may send a
       broken unit somewhere instead — to the safe zone in the Evacuation, back
       towards the evacuation point in Protecting the VIP. */
    function fleeBroken() {
      E.state.units.forEach(function (u) {
        if (!onTable(u) || R.status(u) !== 'broken' || R.isMachine(u)) return;
        // what cannot move stays put: emplaced guns, platforms (p. 94)
        if (!u.move || R.has(u, 'Stationary Artillery') || R.has(u, 'Immobile')) return;
        var allow = u.move + 2;
        var to = E.state.solo && E.state.scen.fallTo ? E.state.scen.fallTo(E.state, u) : null;
        var foe = nearestEnemy(u);
        if (!to && !foe) return;                                   // no one to run from
        if (to && to.flee === undefined && to.limit == null && R.inches(u.x, u.y, to.x, to.y) < 0.5) return;
        var was = { x: u.x, y: u.y };
        if (u.bld) {
          // out of a building the old way: through the far wall and straight on
          var away = to ? { x: u.x - (to.x - u.x), y: u.y - (to.y - u.y) } : foe.unit;
          if (R.fallBack(E.state, u, away, allow)) {
            logLine('note', u.label + ' is broken and flees the building.');
            animateMove(u, [was, { x: u.x, y: u.y }]);
          }
          return;
        }
        var foes = E.state.units.filter(function (t) { return t.alive && t.side !== u.side && onTable(t); });
        function gap(c) {
          var m = Infinity;
          foes.forEach(function (t) { m = Math.min(m, R.inches(c.x, c.y, t.x, t.y)); });
          return m;
        }
        var spots = R.reachable(E.state, u, allow).filter(function (c) { return canStand(u, c); });
        spots.push({ x: u.x, y: u.y, spent: 0 });
        var best = null, bv = -Infinity;
        spots.forEach(function (c) {
          var v;
          if (to) {
            if (to.limit != null && R.inches(c.x, c.y, to.x, to.y) > to.limit) return;
            v = -R.inches(c.x, c.y, to.x, to.y);
          } else v = gap(c);
          if (v > bv + 1e-6) { bv = v; best = c; }
        });
        if (!best || (best.x === u.x && best.y === u.y)) return;
        var path = R.pathTo(E.state, u, allow, best);
        u.x = best.x; u.y = best.y; ui.vis = null; ui.visKey = '';
        animateMove(u, path && path.length > 1 ? path : [was, { x: best.x, y: best.y }]);
        /* Off the edge: what it has left of its flight carries it clear of the table
           (every model past the edge), and it does not come back. */
        var edge = Math.min(u.x, W - u.x, u.y, H - u.y) + UR;
        if (!to && !u.noFlee && allow - (best.spent || 0) >= edge) {
          u.alive = false; u.fled = true; u.brokenEver = true;
          logLine('kill', u.label + ' is broken and runs off the table — fled.');
          return;
        }
        logLine('note', u.label + ' is broken and flees ' + R.inches(was.x, was.y, u.x, u.y).toFixed(1) + '"' +
          (to && to.flee ? ' towards the safe zone.' : to ? '.' : ' from the enemy.'));
        soloAfterMove(u);
      });
    }

    function rallyPhase() {
      logLine('phase', 'Rally phase.');
      R.collars(E.state).forEach(function (l) { logLine(l.t, l.text); });
      fleeBroken();
      // Psychic Amplifier (a tribe aircraft upgrade, p. 143): friendly infantry within 6" shed a point
      E.state.units.forEach(function (c) {
        if (!onTable(c) || c.cls !== 'aircraft' || !R.campFlag(c, 'psychicAmp')) return;
        var calm = activeUnits(c.side).filter(function (f) { return f.cls === 'infantry' && f.sp > 0 && R.unitDist(f, c) <= 6; });
        calm.forEach(function (f) { f.sp -= 1; });
        if (calm.length) logLine('rally', 'Psychic Amplifier — ' + c.label + ' steadies ' + calm.map(function (f) { return f.label; }).join(', ') + ': 1 SP each.');
      });
      /* Strong Nervous System (p. 124): once a battle, every Suppression point on
         every bug is wiped away. It is spent the first time a real share of the
         swarm is pinned down — two units or a third of it, whichever is more. */
      ['A', 'B'].forEach(function (side) {
        var docs = (E.state.doctrines && E.state.doctrines[side]) || [];
        E.state.nervous = E.state.nervous || {};
        if (docs.indexOf('BP3') < 0 || E.state.nervous[side]) return;
        var mine = E.state.units.filter(function (u) { return u.side === side && onTable(u) && !R.isMachine(u); });
        var pinned = mine.filter(function (u) { return u.sp > 0 && R.status(u) !== 'ready'; });
        if (pinned.length < Math.max(2, Math.ceil(mine.length / 3))) return;
        E.state.nervous[side] = true;
        var cleared = mine.filter(function (u) { return u.sp > 0; });
        cleared.forEach(function (u) { u.sp = 0; });
        logLine('rally', 'Strong Nervous System — the hive-mind steadies ' + sideName(side) + ': every Suppression point on ' +
          cleared.length + ' units is gone.');
        pushRes({ kind: 'Rally', title: 'Strong Nervous System', side: side,
          note: 'Once a battle, in the Rally phase, the swarm sheds all its Suppression.',
          outcome: { text: cleared.length + ' units steady at once.', tone: 'good' } });
      });
      // Evacuation: everyone inside the safe zone is rallied without a roll (p. 154)
      if (E.state.scen.rallyFree) {
        E.state.units.forEach(function (u) {
          if (!onTable(u) || R.isMachine(u) || !u.sp || !E.state.scen.rallyFree(E.state, u)) return;
          u.sp = 0;
          logLine('rally', u.label + ' is inside the safe zone and rallies completely.');
        });
      }
      var list = E.state.units.filter(function (u) {
        return u.alive && !u.aboard && u.x >= 0 && (R.isMachine(u) ? u.damage > 0 : u.sp > 0);
      });
      rallyNext(list, 0);
    }

    function rallyNext(list, i) {
      if (i >= list.length) { endPhase(); return; }
      var u = list[i];
      if (!u.alive) { rallyNext(list, i + 1); return; }
      if (R.isMachine(u)) {
        var rep = abRepair(E.state, u);
        if (!rep) { rallyNext(list, i + 1); return; }
        logLine('rally', rep.text);
        var card = repairCard(u, rep);
        card.progress = 'Unit ' + (i + 1) + ' of ' + list.length;
        card.onShow = function () { ui.selected = u; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; focusUnit(u, false, true); render(); };
        card.onClose = function () { rallyNext(list, i + 1); };
        pushRes(card);
        render();
        return;
      }
      if (u.sp === 0) { rallyNext(list, i + 1); return; }
      var r = abRally(E.state, u);
      if (!r) { rallyNext(list, i + 1); return; }
      logLine('rally', r.text);
      if (SFX && r.gone) SFX.broken();
      pushRes(rallyCard(u, r, i + 1, list.length, function () { rallyNext(list, i + 1); }));
      render();
    }

    function rallyCard(u, r, n, total, done) {
      var outcome;
      if (r.gone) {
        outcome = { text: u.name + ' flees the field — suppression over three times Morale.', tone: 'bad' };
      } else if (r.statusBefore !== r.statusAfter) {
        outcome = r.statusAfter === 'ready'
          ? { text: u.name + ' steadies — no longer ' + r.statusBefore + '.', tone: 'good' }
          : { text: u.name + ' is now ' + r.statusAfter + '.', tone: 'warn' };
      } else if (r.after === 0) {
        outcome = { text: 'All suppression shaken off.', tone: 'good' };
      } else {
        outcome = {
          text: 'Still ' + r.statusAfter + ' — ' + r.after + ' SP against Morale ' + r.morale + '.',
          tone: r.statusAfter === 'broken' ? 'bad' : r.statusAfter === 'suppressed' ? 'warn' : ''
        };
      }
      return {
        kind: 'Rally', side: u.side,
        title: u.name + ' [' + u.side + ']',
        note: 'Morale ' + r.morale + ' — roll ' + r.morale + 'D6, each 4+ clears 1 SP' +
          (r.reroll ? '. Inspiring Presence re-rolls the failures.' : '.'),
        dice: r.dice.map(function (d) {
          return { label: d.second ? d.first + '→' : 'D6', value: d.value, tone: d.ok ? 'crit' : 'fail' };
        }),
        calc: 'Suppression ' + r.before + ' SP · ' + r.removed + ' success' + (r.removed === 1 ? '' : 'es') +
          ' → ' + r.after + ' SP',
        outcome: outcome,
        progress: 'Unit ' + n + ' of ' + total,
        onShow: function () {
          ui.selected = u.alive ? u : null;
          ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
          focusUnit(u, false, true);
          render();
        },
        onClose: done
      };
    }

    function repairCard(u, rep) {
      if (!rep) {
        return {
          kind: 'Repair', title: u.name + ' [' + u.side + ']', side: u.side,
          note: 'Nothing to repair.', outcome: { text: 'The hull is sound.', tone: 'good' }
        };
      }
      return {
        kind: 'Repair', side: u.side, title: u.name + ' [' + u.side + ']',
        note: 'Structure ' + u.str + ', ' + rep.before + ' damage — roll ' + rep.dice +
          'D6, each ' + rep.need + '+ clearing a point' + (rep.need === 5 ? ' (Jammers).' : '.'),
        dice: rep.rolls.map(function (d) { return { label: 'D6', value: d.value, tone: d.ok ? 'crit' : 'fail' }; }),
        calc: 'Damage ' + rep.before + ' · ' + rep.fixed + ' repaired → ' + rep.after,
        outcome: rep.after === 0
          ? { text: 'Fully repaired.', tone: 'good' }
          : { text: rep.after + ' damage still on the hull, against Structure ' + u.str + '.', tone: 'warn' }
      };
    }

    function endPhase() {
      /* Endless Tide (p. 116): an unbroken swarm near an unsuppressed Overmind
         digs D3 lost bugs back out of the ground. */
      var tide = R.endlessTide(E.state);
      if (tide.length) {
        tide.forEach(function (l) { logLine('rally', l.text); });
        // the Overmind's reach rolling out, and the lost bugs coming back up out of the ground
        var minds = [];
        tide.forEach(function (l) {
          var om = R.overmindFor(E.state, l.unit, true, true);
          if (om && minds.indexOf(om) < 0) { minds.push(om); addFx({ kind: 'wave', x: om.x, y: om.y, up: 0, r: 18, rgb: '150,215,90', dur: 1400, blocking: true }); }
          addFx({ kind: 'rise', x: l.unit.x, y: l.unit.y, rgb: '205,170,95', n: 10, delay: 300, dur: 1400 });
        });
        if (SFX) SFX.chitter();
        pushRes({ kind: 'Endless Tide', title: 'The swarm replenishes', side: tide[0].unit.side,
          list: tide.map(function (l) { return { text: l.text, side: l.unit.side }; }) });
      }

      scoreObjectives();
      E.state.routed.A = SC.routed(E.state, 'A');
      E.state.routed.B = SC.routed(E.state, 'B');
      var res = SC.check(E.state);
      if (res) {
        // the scenario names the sides A and B; give them the companies' own names
        var text = res.text.replace(/\bA\b/g, sideName('A')).replace(/\bB\b/g, sideName('B'));
        finish(res.winner, text);
      }
      if (E.state.over) { render(); return; }
      beginTurn();
    }

    function objDist(u, o) { return Math.max(0, R.inches(u.x, u.y, o.x, o.y) - UR); }

    function scoreObjectives() {
      E.state.objectives.forEach(function (o) {
        /* Held by an unsuppressed, unbroken unit within 4"; denied by any enemy
           there that is not Broken — a Suppressed one still stands in the way
           (p. 49). Aircraft neither hold nor deny. */
        var claim = { A: 0, B: 0 }, deny = { A: 0, B: 0 };
        E.state.units.forEach(function (u) {
          if (!onTable(u) || R.isFlying(u) || objDist(u, o) > 4) return;
          var st = R.status(u);
          if (st === 'ready') claim[u.side]++;
          if (st !== 'broken') deny[u.side]++;
        });
        o.owner = claim.A > 0 && deny.B === 0 ? 'A' : (claim.B > 0 && deny.A === 0 ? 'B' : null);
      });
    }

    /* What the campaign needs back from a battle: one line per unit that took the
       field, with who it broke and what it cost. Built once, when the game ends. */
    function battleReport(winner) {
      E.state.units.forEach(function (u) { R.syncMen(u, E.state.turn, E.state.namesTaken); });
      var byId = {};
      E.state.units.forEach(function (u) { byId[u.rid || u.id] = u; });
      var lines = {};
      E.state.units.forEach(function (u) {
        lines[u.rid || u.id] = {
          rid: u.rid || u.id, side: u.side, key: u.key, tier: u.tier,
          startSize: u.startSize != null ? u.startSize : u.size,
          /* The men still standing when it ended, which is not the same as the men
             still on the table: a unit that scattered and ran took its survivors
             with it, and only its actual casualties count against it. */
          endSize: R.isMachine(u) ? (u.alive ? 1 : 0) : u.models,
          destroyed: !u.alive && R.isMachine(u),
          catastrophic: !!u.catastrophic,
          brokenEver: !!u.brokenEver,
          /* Wiped out means every soldier was killed (p. 85) — that, and only that,
             takes a unit off the dossier. A unit that scattered and ran, or that
             Expendable removed from play, still has men left and comes back. */
          wiped: !R.isMachine(u) && u.models <= 0,
          fled: !!u.fled,
          aboardDowned: !!u.lostAboard,
          lostAboard: u.lostAboard || null,
          drugged: !!u.drugged,            // Drug Dealer: the comedown comes after
          // the swarm's own bookkeeping (p. 124): its low point, and what it ate
          minSize: R.isMachine(u) ? null : (u.minModels != null ? Math.min(u.minModels, u.models) : u.models),
          assaultKills: u.assaultKills || 0, assaultKillsHuman: u.assaultKillsHuman || 0,
          // the men who carry on, by name, for the dossier to keep
          men: R.survivors(u),
          kills: []
        };
      });
      // one credit per enemy unit: whoever broke it, or failing that whoever killed it
      E.state.units.forEach(function (u) {
        var who = u.brokeBy || (u.wipedOut ? u.killedBy : null);
        if (!who) return;
        var owner = byId[who];
        if (!owner || owner.side === u.side) return;          // no credit for friendly fire
        var line = lines[who];
        if (line) line.kills.push({ tier: u.tier, broken: !!u.brokenEver, key: u.key });
      });
      return {
        winner: winner, battleTier: E.state.cfg.tier, pl: E.state.cfg.pl,
        scenario: E.state.cfg.scenario || 'secure',
        // a tribe's payment reads whether this was an attacker-defender fight (p. 140)
        attackDefend: !!(E.state.sc && E.state.sc.attacker),
        routed: { A: E.state.routed.A, B: E.state.routed.B },
        turns: E.state.turn,
        units: Object.keys(lines).map(function (k) { return lines[k]; }),
        casualties: casualtyList()
      };
    }

    /* The casualty list: every named soldier lost, by name, rank and the kind of
       unit they served in, side by side, in the order they were lost. A bug unit
       has one line instead, with the count of what it lost. */
    function casualtyList() {
      var out = [];
      E.state.units.forEach(function (u) {
        var p = R.profile(u.key);
        /* The swarm and the Esh-Aven have no names: such a unit reports how many
           it lost, and a bug unit what that was worth in biomass. */
        if (R.counted(u)) {
          if (u.lostModels) {
            var line = { side: u.side, count: u.lostModels, type: (p && p.name) || u.name, unit: u.name, rid: u.rid || u.id, turn: 0 };
            if (u.faction === 'bugs') { line.swarm = true; line.mass = u.lostModels * R.biomassOf(p); }
            else line.anon = true;
            out.push(line);
          }
          return;
        }
        (u.men || []).forEach(function (m) {
          if (m.lost == null) return;
          out.push({
            side: u.side, name: m.name, rank: m.rank, turn: m.lost,
            type: (p && p.name) || u.name, unit: u.name, rid: u.rid || u.id
          });
        });
      });
      out.sort(function (a, b) { return a.side < b.side ? -1 : a.side > b.side ? 1 : a.turn - b.turn; });
      return out;
    }

    function finish(winner, text) {
      E.state.over = { winner: winner, text: text };
      E.state.report = battleReport(winner);
      logLine('turn', text);
      // a campaign battle hands its report back to the dossier
      if (E.state.cfg.campaign) V.finished(E.state.report);
      pushRes({ kind: 'Result', title: winner ? sideName(winner) + ' wins' : 'Draw', outcome: { text: text, tone: 'good' } });
    }

    return {
      rallyPhase: rallyPhase, repairCard: repairCard, objDist: objDist, scoreObjectives: scoreObjectives,
      finish: finish
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineEndPhase;
})(typeof window !== 'undefined' ? window : global);
