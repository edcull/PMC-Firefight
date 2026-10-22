/* PMC 2670 — Firefight : a story battle's own changes (docs/story-mode-plan.md, section 5)

   A battle in story mode is an ordinary battle with cfg.story on it, written
   by src/story/levers.js. Everything it changes is read from there, so a save,
   a replay and the AI's lookahead all see the same battle:

   - the units: the enemy's named units and the rules a story gives them, the
     unit that is a battle's target, and the allies at the end of side A's list;
   - the prelude, after deployment and before turn 1 (or once the forces have
     entered, where they enter in turn 1's Reserve phase): strikes on the enemy, a
     failed recon's Suppression on your own units, and an ambushed side caught
     unready. Rolled here, and written to the battle log;
   - the allies' activations: side A's units the AI runs for the story, taking
     side A's activations in turn with the player's own (allyActs);
   - the target variant: the target killed, or with `capture` Broken and then
     reached, ends the battle (targetCheck, asked by scenarios.js). */
(function (root) {
  'use strict';
  root.PMCEngineStory = function (E) {
    var R = E.R;

    function story() { return E.state && E.state.cfg && E.state.cfg.story || null; }

    /* After the units are made. */
    function storyUnits() {
      var sty = story(), state = E.state;
      if (!sty) return;
      var allies = false;
      state.units.forEach(function (u) {
        var x = sty.units && sty.units[u.side] && sty.units[u.side][u.pickIdx];
        if (x) {
          if (x.name) { u.name = x.name; u.label = x.name + ' [' + u.side + ']'; }
          if (x.rules) x.rules.forEach(function (r) { if (u.rules.indexOf(r) < 0) u.rules.push(r); });
          if (x.target) u.storyTarget = true;
        }
        if (u.side === 'A' && sty.allyFrom != null && u.pickIdx != null && u.pickIdx >= sty.allyFrom) {
          u.ally = true; u.paint = 'C'; allies = true;
        }
      });
      if (allies) state.allies = { side: 'A' };
    }

    /* 'D3', 'D6', 'D3+PL', '2D3' or a plain number, rolled. */
    function count(what) {
      if (typeof what === 'number') return what;
      var pl = (E.state.cfg && E.state.cfg.pl) || 1, n = 0;
      String(what).split('+').forEach(function (part) {
        part = part.trim();
        var m = /^(\d*)D(\d+)$/i.exec(part);
        if (m) for (var i = 0; i < (+m[1] || 1); i++) n += m[2] === '3' ? R.d3() : R.d6();
        else if (part === 'PL') n += pl;
        else n += +part || 0;
      });
      return n;
    }

    function onTable(side) {
      return E.state.units.filter(function (u) {
        return u.side === side && u.alive && !u.reserve && !u.aboard && u.x >= 0 && !u.ally;
      });
    }

    /* A strike from above: each one falls on a unit of the side on the table, as
       a shot would: two hits on a squad, a damage roll on a machine. */
    function strike(side, n, lines) {
      var state = E.state, log = [];
      for (var i = 0; i < n; i++) {
        var pool = onTable(side);
        if (!pool.length) break;
        var t = pool[Math.floor(Math.random() * pool.length)];
        if (R.isMachine(t)) {
          var dmg = R.resolveDamage(t, 1, false, 0);
          lines.push({ side: side, text: 'Strike on ' + t.label + ': ' + dmg.rolls.join('; ') });
          if (dmg.damage) R.applyDamage(state, t, dmg.damage, log, null);
        } else {
          var res = R.resolveShootingHits(state, t, 2, 0, null);
          lines.push({ side: side, text: 'Strike on ' + t.label + ': ' + res.casualties + ' down, ' + res.sp + ' SP.' });
          R.applyResult(state, t, res, log, null);
        }
      }
      log.forEach(function (l) { lines.push({ side: side, text: l.text }); });
    }

    function suppress(side, n, lines) {
      var pool = onTable(side).filter(function (u) { return !R.isMachine(u); });
      for (var i = 0; i < n && pool.length; i++) {
        var t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        R.addSP(t, 1);
        lines.push({ side: side, text: t.label + ' starts the battle with 1 SP.' });
      }
    }

    /* Before turn 1: what the story's events bought or cost, each rolled once.
       Where a side enters in turn 1's Reserve phase it is not on the table yet,
       and what falls on it waits for it (afterEntry calls this again, `entered`). */
    function storyPrelude(entered) {
      var sty = story(), state = E.state;
      if (!sty) return;
      var done = state.prelude = state.prelude || {}, lines = [];
      function when(part, side, fn) {
        if (done[part] || (!entered && !onTable(side).length)) return;
        done[part] = true;
        fn();
      }
      if (sty.strikes) when('strikes', 'B', function () { strike('B', count(sty.strikes), lines); });
      if (sty.suppressOwn) when('own', 'A', function () { suppress('A', count(sty.suppressOwn), lines); });
      // an ambush: the side caught out has every squad on the table pinned at the start
      if (sty.ambush) {
        var caught = sty.ambush === 'A' ? 'B' : 'A';
        when('ambush', caught, function () { suppress(caught, onTable(caught).length, lines); });
      }
      if (!lines.length) return;
      lines.forEach(function (l) { E.logLine('suppressed', l.text); });
      E.pushRes({ kind: 'Prelude', title: 'Before the first turn', note: 'What the story brought to this battle.', list: lines });
    }

    /* Turn 1's initiative, where an ambush has settled it. */
    function storyFirstTurn() {
      var sty = story();
      return sty && sty.ambush && E.state.turn === 1 ? sty.ambush : null;
    }

    /* Whether side A's activation now is the allies': they take their share of
       side A's activations, in turn with the player's own units. Worked out from
       what has gone this turn, so a save in the middle of one needs nothing kept. */
    function allyActs() {
      var state = E.state;
      if (!state || !state.allies || state.activeSide !== 'A' || state.phase !== 'battle') return false;
      var ready = function (u) { return u.alive && u.side === 'A' && !u.aboard && !u.reserve && R.status(u) !== 'broken'; };
      var mine = state.units.filter(function (u) { return ready(u) && !u.ally; });
      var theirs = state.units.filter(function (u) { return ready(u) && u.ally; });
      var mineLeft = mine.filter(function (u) { return !u.activated; }).length;
      var theirsLeft = theirs.filter(function (u) { return !u.activated; }).length;
      if (!theirsLeft) return false;
      if (!mineLeft) return true;
      var mineDone = mine.length - mineLeft, theirsDone = theirs.length - theirsLeft;
      // the allies are behind their share of the turn's activations
      return theirsDone * mine.length < mineDone * theirs.length;
    }

    /* The target variant (from the solitaire Decapitation): the target killed
       ends the battle; with `capture`, it has to be Broken and a unit of side A in
       base contact, and killing it is still a win, as a kill. */
    function targetCheck(state) {
      var sty = state.cfg && state.cfg.story, v = sty && sty.variant;
      if (!v || !v.target) return null;
      var t = state.units.filter(function (u) { return u.storyTarget; })[0];
      if (!t) return null;
      if (!t.alive) {
        state.storyOutcome = { target: 'killed' };
        return { winner: 'A', text: t.name + ' is dead: A has done what it came to do.' };
      }
      if (v.capture && R.status(t) === 'broken') {
        var taker = state.units.filter(function (u) { return u.side === 'A' && u.alive && !R.isMachine(u) && R.unitDist(u, t) <= 1; })[0];
        if (taker) {
          state.storyOutcome = { target: 'captured' };
          return { winner: 'A', text: t.name + ' is taken alive by ' + taker.label + '.' };
        }
      }
      return null;
    }

    return { storyUnits: storyUnits, storyPrelude: storyPrelude, storyFirstTurn: storyFirstTurn, allyActs: allyActs, targetCheck: targetCheck };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineStory;
})(typeof window !== 'undefined' ? window : global);
