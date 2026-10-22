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

    /* ================= the End phase: the story scenarios' own events =================
       Set up by a scenario's deploy (src/story/scenarios-story.js) on state.sc,
       and run here, once an End phase, before the battle is checked. */

    /* Waves: from turn `from`, every End phase, `per` units come out of the
       tunnel mouths for `side`, ready to act from the next turn. */
    function waves(state, lines) {
      var w = state.sc && state.sc.waves;
      if (!w || state.turn < (w.from || 1) || (w.until && state.turn > w.until) || !(w.mouths || []).length) return;
      w.n = w.n || 0;
      for (var i = 0; i < w.per; i++) {
        var key = w.keys[(w.n + i) % w.keys.length], p = R.profile(key);
        if (!p) continue;
        var m = w.mouths[(w.n + i) % w.mouths.length];
        var u = E.makeUnit(p, w.side, 'w' + (w.n + i), null, false, null, false);
        u.code = (u.code || 'W') + (w.n + i + 1);
        u.label = u.name + ' [' + w.side + ']';
        u.startSize = u.models;
        u.spawned = true;
        var spot = R.nearestFree ? R.nearestFree(state, m.x, m.y, u) : null;
        u.x = spot ? spot.x : m.x; u.y = spot ? spot.y : m.y;
        u.facing = Math.atan2(R.BOARD.h / 2 - u.y, R.BOARD.w / 2 - u.x);
        R.musterMen(u, null, state.namesTaken || (state.namesTaken = {}));
        state.units.push(u);
        lines.push({ side: w.side, text: u.label + ' comes out of the ' + (m.name || 'tunnel mouth') + '.' });
      }
      w.n += w.per;
    }

    /* The orbital countdown: from turn `from`, D3 of the table's areas are hit
       each End phase, and an area hit once burns on. A unit in a burning area
       takes the strike: two hits on a squad, a damage roll on a machine. The
       landing zone is never hit. */
    function countdown(state, lines) {
      var cd = state.sc && state.sc.countdown;
      if (!cd || state.turn < cd.from) return;
      var left = cd.areas.filter(function (a) { return !a.struck && !a.safe; });
      for (var n = R.d3(); n > 0 && left.length; n--) {
        var a = left.splice(Math.floor(Math.random() * left.length), 1)[0];
        a.struck = state.turn;
        lines.push({ side: null, text: 'The orbital strike hits ' + a.name + '.' });
      }
      var log = [];
      state.units.forEach(function (u) {
        if (!u.alive || u.reserve || u.aboard || u.x < 0) return;
        var a = cd.areas.filter(function (r) { return r.struck && R.inRect(u.x, u.y, r); })[0];
        if (!a) return;
        if (R.isMachine(u)) {
          var dmg = R.resolveDamage(u, 1, false, 0);
          if (dmg.damage) R.applyDamage(state, u, dmg.damage, log, null);
        } else R.applyResult(state, u, R.resolveShootingHits(state, u, 2, 0, null), log, null);
        lines.push({ side: u.side, text: u.label + ' is caught in the burning ' + a.name + '.' });
      });
      log.forEach(function (l) { lines.push({ side: null, text: l.text }); });
    }

    /* Extraction: a unit of `side` standing in the landing zone (a circle, or
       everything past `rectX`: the far edge) at the End phase leaves the table,
       safe. It is out of the battle, and no loss. `only`: the units that may. */
    function extraction(state, lines) {
      var ex = state.sc && state.sc.extract;
      if (!ex || state.turn < (ex.from || 1)) return;
      state.units.forEach(function (u) {
        if (u.side !== ex.side || !u.alive || u.reserve || u.aboard || u.x < 0 || u.ally) return;
        if (ex.only && ex.only.indexOf(u.id) < 0) return;
        if (ex.rectX != null ? u.x < ex.rectX : R.inches(u.x, u.y, ex.x, ex.y) > ex.r) return;
        u.alive = false; u.extracted = true; u.activated = true;
        (u.cargo || []).forEach(function (cid) {
          var c = state.units.filter(function (x) { return x.id === cid; })[0];
          if (c) { c.alive = false; c.extracted = true; }
        });
        ex.out = (ex.out || 0) + (u.tier || 1);
        lines.push({ side: u.side, text: u.label + ' is lifted out.' });
      });
    }

    /* A parley: while it holds, the enemy (and the allies) hold their fire.
       It breaks when side A hurts side B, or on a 6 at an End phase. */
    function parley(state, lines) {
      var pa = state.sc && state.sc.parley;
      if (!pa || pa.broken) return;
      var hurt = state.units.some(function (u) {
        if (u.side !== 'B') return false;
        var was = pa.seen && pa.seen[u.id];
        return !u.alive || (was && (u.sp > was.sp || u.models < was.models || (u.damage || 0) > was.damage));
      });
      if (hurt) { pa.broken = state.turn; pa.by = 'A'; lines.push({ side: 'A', text: 'Shots are fired. The talks are over.' }); }
      else if (R.d6() === 6) { pa.broken = state.turn; pa.by = 'roll'; lines.push({ side: null, text: 'Somebody panics. The talks are over.' }); }
      pa.seen = {};
      state.units.forEach(function (u) { if (u.side === 'B') pa.seen[u.id] = { sp: u.sp, models: u.models, damage: u.damage || 0 }; });
    }
    /* Whether this unit holds its fire: the enemy, and the allies, while the talks hold. */
    function parleyHolds(u) {
      var pa = E.state && E.state.sc && E.state.sc.parley;
      if (!pa || pa.broken) return false;
      return !u || u.side === 'B' || u.ally;
    }

    function storyEndPhase() {
      var state = E.state;
      if (!state || !state.sc) return;
      var lines = [];
      parley(state, lines);
      countdown(state, lines);
      extraction(state, lines);
      waves(state, lines);
      if (!lines.length) return;
      lines.forEach(function (l) { E.logLine('note', l.text); });
      E.pushRes({ kind: 'End phase', title: state.scen.name, list: lines });
    }

    /* What a story asks of the check, before the scenario's own: its target, and
       its own turn limit (the scenario judged as at the end of its time). Null
       where the story asks nothing, and the scenario is checked as usual. */
    function storyCheck(state) {
      var t = targetCheck(state);
      if (t) return t;
      var sty = state.cfg && state.cfg.story;
      if (!sty || !sty.turns || state.turn < sty.turns) return null;
      var real = state.turn;
      state.turn = Math.max(real, (state.scen && state.scen.turns) || 20);
      var res = E.SC.check(state);
      state.turn = real;
      return res || { winner: null, text: 'Time runs out, and nothing is settled — a draw.', timeout: true };
    }

    return {
      storyUnits: storyUnits, storyPrelude: storyPrelude, storyFirstTurn: storyFirstTurn, allyActs: allyActs, targetCheck: targetCheck,
      storyEndPhase: storyEndPhase, storyCheck: storyCheck, parleyHolds: parleyHolds
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineStory;
})(typeof window !== 'undefined' ? window : global);
