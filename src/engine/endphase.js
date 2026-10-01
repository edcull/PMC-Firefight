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
        sideName = E.sideName, soloAfterMove = E.soloAfterMove, ui = E.ui, isAI = E.isAI, makeStand = E.makeStand,
        revealConsole = E.revealConsole;

    // The rally phase is walked unit by unit: roll, show the card, wait for Continue.
    /* The start of the Rally phase (p. 34): every Broken unit on the table flees
       Movement + 2" away from the closest enemy, paying for terrain as usual and
       keeping away from the enemy as long as it can. One that can run off the
       table does, and is gone — fled. Only then do the rally rolls come.
       A solitaire game has no "own lines" either way: its scenarios may send a
       broken unit somewhere instead — to the safe zone in the Evacuation, back
       towards the evacuation point in Protecting the VIP. */
    /* How far a unit at c has still to go, straight on away from the enemy at f,
       for every model to be past the edge that way. Fleeing is away from the
       enemy first (p. 34); the table edge is only where that flight may end. */
    function outAway(c, f) {
      var dx = c.x - f.x, dy = c.y - f.y, n = Math.hypot(dx, dy);
      if (n < 1e-6) return Infinity;
      dx /= n; dy /= n;
      var t = Infinity;
      if (dx > 1e-6) t = Math.min(t, (W - c.x + UR) / dx);
      if (dx < -1e-6) t = Math.min(t, (c.x + UR) / -dx);
      if (dy > 1e-6) t = Math.min(t, (H - c.y + UR) / dy);
      if (dy < -1e-6) t = Math.min(t, (c.y + UR) / -dy);
      return t;
    }
    function runOff(u) {
      u.alive = false; u.fled = true; u.brokenEver = true;
      logLine('kill', u.label + ' is broken and runs off the table — fled.');
    }
    function fleeBroken() {
      E.state.units.forEach(function (u) {
        if (!onTable(u) || R.status(u) !== 'broken' || R.isMachine(u)) return;
        // the AI makes a Last Stand it still has rather than run (p. 88)
        if (isAI(u.side) && E.standable(u)) { makeStand(u, 'rather than run'); return; }
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
            animateMove(u, [was, { x: u.x, y: u.y }]);
            // and if what it has left of its flight takes it past the edge, it is gone
            if (!to && !u.noFlee && allow - R.inches(was.x, was.y, u.x, u.y) >= outAway(u, foe.unit)) { runOff(u); return; }
            logLine('note', u.label + ' is broken and flees the building.');
          }
          return;
        }
        var foes = E.state.units.filter(function (t) { return t.alive && t.side !== u.side && onTable(t); });
        function closest(c) {
          var m = Infinity, f = null;
          foes.forEach(function (t) { var d = R.inches(c.x, c.y, t.x, t.y); if (d < m) { m = d; f = t; } });
          return { d: m, f: f };
        }
        var spots = R.reachable(E.state, u, allow).filter(function (c) { return canStand(u, c); });
        spots.push({ x: u.x, y: u.y, spent: 0 });
        /* The flight is straight away from the closest enemy (p. 34). If, along that
           line (within 30° of it), the unit can reach a spot from which what is left
           of its flight carries every model past the edge, it runs off and is gone:
           so one with its back to its own edge leaves, while one by a flank edge, the
           enemy in front, falls back and stays. Otherwise it goes to the spot it can
           reach furthest from the enemy. */
        var ax = foe ? u.x - foe.unit.x : 0, ay = foe ? u.y - foe.unit.y : 0, an = Math.hypot(ax, ay);
        function offFrom(c) {
          if (to || u.noFlee || !foe || an < 1e-6) return false;
          var dx = c.x - u.x, dy = c.y - u.y, dn = Math.hypot(dx, dy);
          if (dn > 1e-6 && (dx * ax + dy * ay) / (dn * an) < Math.cos(Math.PI / 6)) return false;
          return allow - (c.spent || 0) >= outAway(c, foe.unit);
        }
        if (spots.some(offFrom)) {
          var out = spots.filter(offFrom).sort(function (p, q) { return (p.spent || 0) - (q.spent || 0); })[0];
          if (out.x !== u.x || out.y !== u.y) animateMove(u, [{ x: u.x, y: u.y }, { x: out.x, y: out.y }]);
          runOff(u); return;
        }
        var best = null, bv = -Infinity;
        spots.forEach(function (c) {
          var v;
          if (to) {
            if (to.limit != null && R.inches(c.x, c.y, to.x, to.y) > to.limit) return;
            v = -R.inches(c.x, c.y, to.x, to.y);
          } else v = closest(c).d;
          if (v > bv + 1e-6) { bv = v; best = c; }
        });
        if (!best || (best.x === u.x && best.y === u.y)) return;
        var path = R.pathTo(E.state, u, allow, best);
        u.x = best.x; u.y = best.y; ui.vis = null; ui.visKey = '';
        animateMove(u, path && path.length > 1 ? path : [was, { x: best.x, y: best.y }]);
        logLine('note', u.label + ' is broken and flees ' + R.inches(was.x, was.y, u.x, u.y).toFixed(1) + '"' +
          (to && to.flee ? ' towards the safe zone.' : to ? '.' : ' from the enemy.'));
        soloAfterMove(u);
      });
    }

    /* ---- surrender, in the End phase ----
       Once the scenario's victory conditions have been checked and nobody has
       won, each player at the table (not the AI) may surrender the battle: the
       opponent wins at once. Asked in turn, a side at a time, and kept on the
       battle's state (endAsk) so a reload or the other end of a network game
       sees the same question. */
    function askEnd(sides) {
      var side = sides[0];
      if (!side) { E.state.endAsk = null; beginTurn(); return; }
      E.state.endAsk = { side: side, rest: sides.slice(1), sure: false };
      logLine('phase', 'End phase — ' + sideName(side) + ' may surrender, or carry on to the next turn.');
      revealConsole();
      render();
    }
    function endAsks() {
      askEnd(['A', 'B'].filter(function (s) {
        return !isAI(s) && E.state.units.some(function (u) { return u.side === s && onTable(u); });
      }));
    }
    /* Carry on, or surrender: a first press asks for a second, so a battle is
       not thrown away by one stray tap. */
    function endAnswer(side, what) {
      var ea = E.state.endAsk;
      if (!ea || ea.side !== side) return 'nothing to answer';
      if (what === 'surrender') {
        if (!ea.sure) { ea.sure = true; render(); return null; }
        var winner = side === 'A' ? 'B' : 'A';
        E.state.endAsk = null;
        finish(winner, sideName(side) + ' surrenders — ' + sideName(winner) + ' wins the battle.');
        render();
        return null;
      }
      askEnd(ea.rest || []);
      return null;
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
      if (r.standing) { askStand(u, r, function () { showRally(list, i, u, r); }); return; }
      showRally(list, i, u, r);
    }
    function showRally(list, i, u, r) {
      logLine('rally', r.text);
      if (SFX && r.gone) SFX.broken();
      pushRes(rallyCard(u, r, i + 1, list.length, function () { rallyNext(list, i + 1); }));
      regroupFx(u, r);
      render();
    }

    /* The Regroup action (p. 33) is the rally made in the unit's own activation:
       the same card, the dice and what they cleared, under its own name. `pre`
       is anything that happened first (Meditation). */
    function regroupCard(u, r, pre) {
      if (!r) {
        return {
          kind: 'Regroup', side: u.side, title: cardName(u),
          note: (pre ? pre + ' ' : '') + 'No suppression to shake off.', outcome: { text: 'Steady.', tone: 'good' }
        };
      }
      var c = rallyCard(u, r);
      c.kind = 'Regroup';
      if (pre) c.note = pre + ' ' + c.note;
      return c;
    }
    /* A unit regrouping, on the table: its men closing up round it, and a
       chevron lifting away for each point of Suppression it shakes off. */
    function regroupFx(u, r) {
      if (!u.alive || u.x < 0 || u.aboard) return;
      addFx({ kind: 'regroup', x: u.x, y: u.y, n: r ? (r.stood ? r.before : r.removed) : 0, delay: 150, dur: 1400, blocking: true });
    }

    /* The rally has left the unit over three times its Morale, and it has a Last
       Stand still to make (p. 88): it may make it now, or scatter and flee. A
       player is asked; the AI makes its stand. */
    function askStand(u, r, then) {
      function answer(yes) {
        E.state.standAsk = null; ui.standThen = null;
        if (yes) {
          makeStand(u, 'rather than flee');
          r.after = 0; r.statusAfter = 'ready'; r.stood = true;
        } else {
          u.alive = false; u.fled = true; u.brokenEver = true;
          r.gone = true; r.statusAfter = 'removed';
          r.text += ' — SP exceeds 3× Morale: the unit scatters and flees the field.';
        }
        then();
      }
      if (isAI(u.side)) { answer(true); return; }
      E.state.standAsk = { unit: u.id, side: u.side, sp: u.sp, morale: r.morale };
      ui.standThen = answer;
      ui.selected = u; focusUnit(u, false, true);
      revealConsole();
      render();
    }

    /* A card's name for a unit: its name and side — and its code as well, when its
       side has more than one of that name (three squads of Instigators are three
       cards, not one squad rallying three times). */
    function cardName(u) {
      var twins = E.state.units.some(function (o) { return o !== u && o.side === u.side && o.name === u.name; });
      return u.name + (twins ? ' ' + u.code : '') + ' [' + u.side + ']';
    }
    function rallyCard(u, r, n, total, done) {
      var outcome;
      if (r.gone) {
        outcome = { text: u.name + ' flees the field — suppression over three times Morale.', tone: 'bad' };
      } else if (r.stood) {
        outcome = { text: u.name + ' makes its Last Stand instead of fleeing — every point of suppression is gone.', tone: 'good' };
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
        title: cardName(u),
        note: 'Morale ' + r.morale + ' — roll ' + r.morale + 'D6, each 4+ clears 1 SP' +
          (r.reroll ? '. Inspiring Presence re-rolls the failures.' : '.'),
        dice: r.dice.map(function (d) {
          return { label: d.second ? d.first + '→' : 'D6', value: d.value, tone: d.ok ? 'crit' : 'fail' };
        }),
        calc: 'Suppression ' + r.before + ' SP · ' + r.removed + ' success' + (r.removed === 1 ? '' : 'es') +
          ' → ' + r.after + ' SP',
        outcome: outcome,
        progress: n ? 'Unit ' + n + ' of ' + total : undefined,
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
          kind: 'Repair', title: cardName(u), side: u.side,
          note: 'Nothing to repair.', outcome: { text: 'The hull is sound.', tone: 'good' }
        };
      }
      return {
        kind: 'Repair', side: u.side, title: cardName(u),
        note: 'Structure ' + u.str + ', ' + rep.before + ' damage — roll ' + rep.dice +
          'D6, each ' + rep.need + '+ clearing a point' + (rep.need === 5 ? ' (Jammers)' : '') +
          (rep.reroll ? '. Superior Self-repair re-rolls the failures.' : '.'),
        dice: rep.rolls.map(function (d) { return { label: d.first != null ? d.first + '→' : 'D6', value: d.value, tone: d.ok ? 'crit' : 'fail' }; }),
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
          addFx({ kind: 'rise', x: l.unit.x, y: l.unit.y, rgb: '205,170,95', n: 10, delay: 300, dur: 1400, blocking: true });
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
      endAsks();
    }

    /* Who holds each objective, by the one test the scenarios use (scenarios.js
       holderOf, p. 49): a drop pod holds nothing, an area objective is measured
       from its edge, and the units inside it count first. */
    // from a token's edge to an objective's: a marker's point, or an area's own edge
    function objDist(u, o) {
      var a = SC.areaOf(o), d;
      if (a && a.rect) d = R.rectPointDist(a.rect, u.x, u.y);
      else d = Math.max(0, R.inches(u.x, u.y, o.x, o.y) - (a && a.r || 0));
      return Math.max(0, d - UR);
    }
    function scoreObjectives() {
      E.state.objectives.forEach(function (o) {
        o.owner = SC.holderOf(E.state, o.x, o.y, 4, SC.areaOf(o));
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
          // a free unit for this battle alone (the Complex Teleport Network's turrets): on no roster
          free: !!u.free && !u.rid,
          startSize: u.startSize != null ? u.startSize : u.size,
          /* The men still standing when it ended, which is not the same as the men
             still on the table: a unit that scattered and ran took its survivors
             with it, and only its actual casualties count against it. */
          endSize: R.isMachine(u) ? (u.alive ? 1 : 0) : u.models,
          destroyed: !u.alive && R.isMachine(u),
          catastrophic: !!u.catastrophic,
          brokenEver: !!u.brokenEver,
          /* Wiped out means every soldier was killed (p. 85) — that, and only that,
             takes a unit off the dossier. A unit that scattered and ran still has
             men left and comes back; penal troops whose collars went off do not. */
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
            if (u.faction === 'bugs') { line.swarm = true; line.mass = u.lostModels * R.biomassOf(p); if (u.beast) line.beast = u.beast; }
            else line.anon = true;
            out.push(line);
          }
          return;
        }
        (u.men || []).forEach(function (m) {
          if (m.lost == null) return;
          out.push({
            side: u.side, name: m.name, rank: m.rank, role: m.role || null, turn: m.lost,
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
      // what ended it, on its own card: a campaign goes on to the aftermath from there
      pushRes({ kind: 'Result', title: winner ? sideName(winner) + ' wins' : 'Draw', outcome: { text: text, tone: 'good' },
        cont: E.state.cfg.campaign ? 'To the aftermath' : null });
    }

    return {
      rallyPhase: rallyPhase, endAnswer: endAnswer, repairCard: repairCard, regroupCard: regroupCard, regroupFx: regroupFx,
      objDist: objDist, scoreObjectives: scoreObjectives,
      finish: finish
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineEndPhase;
})(typeof window !== 'undefined' ? window : global);
