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
   - the allies' orders: one marker the player puts down, and may move once a
     turn, that the allies' AI answers (allyOrder; ai.js);
   - the target variant: the target killed, or with `capture` Broken and then
     reached, ends the battle (targetCheck, asked by scenarios.js);
   - what is said: the story's lines, each put up on a card with the speaker's
     face when its moment comes (storyTalk). */
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
          if (x.skin) skin(u, x);
        }
        if (u.side === 'A' && sty.allyFrom != null && u.pickIdx != null && u.pickIdx >= sty.allyFrom) {
          u.ally = true; u.paint = 'C'; allies = true;
        }
      });
      if (allies) state.allies = { side: 'A' };
    }

    /* A unit in a story's reskinned force: the Hashamer's Esh-Aven, a
       Xenotripod unit with its own numbers and rules, drawn, named and counted
       as an Esh-Aven, each one named (`named`: never only a count), and the
       names the story kept from their last battle carried into this one. */
    var CASTE = /^x_(alpha|beta|gamma|delta)(\d)$/;
    function skin(u, x) {
      u.skin = x.skin;
      if (x.skin !== 'eshaven' || R.isMachine(u)) return;
      u.named = true;
      if (x.men && x.men.length) u.storyMen = x.men.map(function (n) { return { name: n }; });
      // every caste an Esh-Aven, in its own caste's kit (iso-troops.js `xesh_*`): the Alpha still the leader
      var m = CASTE.exec(u.art || '');
      if (m) u.art = 'xesh_' + m[1];
      if (!x.name) {
        u.name = 'Esh-Aven ' + u.name.charAt(0).toLowerCase() + u.name.slice(1);
        u.label = u.name + ' [' + u.side + ']';
      }
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

    /* An ambush an AI side springs: it sets up last, once the side it caught is
       down (scenarios.js `ambushed`; deploy.js startBattle). */
    function ambushWaits(side) {
      var sty = story(), state = E.state;
      return !!(sty && sty.ambush === side && state.phase !== 'battle' && E.isAI(side) &&
        state.units.some(function (u) { return u.side === side && u.alive && u.x < 0 && !u.reserve && !u.aboard; }));
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

    /* ================= the relic (docs/story-dead-reckoning-plan.md, section 5) =================
       `variant: { relic: true }` on Find and secure: what is found is a relic,
       and can be carried. At an End phase a unit on foot within 2" of it, with
       none of the other side's as close, picks it up; from then on the
       objective is wherever its carrier is, and the side that holds it is the
       side that has it. A carrier destroyed (or caught Broken) drops it where it
       stands. Carried into its own side's entry strip at an End phase, it is
       off the table: the battle is over, and won by the side that carried it.
       Who has it at the end goes in the report (`story.relic`). */
    var RELIC_REACH = 2;
    function relicOn(state) {
      var v = state && state.cfg && state.cfg.story && state.cfg.story.variant;
      return !!(v && v.relic && state.sc && state.sc.search && state.sc.found);
    }
    function unitById(state, id) { return state.units.filter(function (u) { return u.id === id; })[0] || null; }
    function canCarry(u) {
      return u.alive && !u.reserve && !u.aboard && u.x >= 0 && !R.isMachine(u) && R.holdsGround(u) && R.status(u) !== 'broken';
    }
    // where the relic is now: on its carrier, or on the ground; a carrier who can no longer carry it drops it
    function relicFollow() {
      var state = E.state;
      if (!relicOn(state)) return null;
      var rl = state.sc.relic = state.sc.relic || { x: state.sc.found.x, y: state.sc.found.y, carrier: null, off: null };
      var c = rl.carrier != null ? unitById(state, rl.carrier) : null;
      if (c && !canCarry(c) && !c.extracted) {
        E.logLine('note', c.label + ' drops the relic.');
        rl.carrier = null; c.relic = false; c = null;
      }
      if (c && !c.extracted) { rl.x = c.x; rl.y = c.y; }
      var o = state.objectives[0];
      if (o) {
        o.x = rl.x; o.y = rl.y; o.relic = true;
        // (picked up, it is a point: held within 4" of whoever has it)
        if (rl.carrier != null || rl.moved) o.rect = null;
        o.carried = c ? c.side : null;
      }
      return rl;
    }
    // who has it, for the report: its carrier's side, or whoever holds the ground it lies on
    function relicHolder(state) {
      var rl = state.sc.relic;
      if (!rl) return null;
      if (rl.off) return rl.off;
      var c = rl.carrier != null ? unitById(state, rl.carrier) : null;
      if (c) return c.side;
      var o = state.objectives[0];
      return E.SC.holderOf(state, rl.x, rl.y, 4, o && o.rect ? E.SC.areaOf(o) : undefined) || null;
    }
    function relicEndPhase(state, lines) {
      var rl = relicFollow();
      if (!rl || rl.off) return;
      var c = rl.carrier != null ? unitById(state, rl.carrier) : null;
      if (!c) {
        // picked up by the nearest unit on foot in reach, if the other side has nobody as close
        var near = state.units.filter(function (u) { return canCarry(u) && R.inches(u.x, u.y, rl.x, rl.y) <= RELIC_REACH + R.UNIT_R; })
          .sort(function (a, b) { return R.inches(a.x, a.y, rl.x, rl.y) - R.inches(b.x, b.y, rl.x, rl.y); });
        if (near.length && near.every(function (u) { return u.side === near[0].side; })) {
          c = near[0];
          rl.carrier = c.id; rl.moved = true; c.relic = true;
          lines.push({ side: c.side, text: c.label + ' picks up the relic.' });
          relicFollow();
        } else if (near.length) lines.push({ side: null, text: 'Both sides are on the relic: nobody can lift it.' });
        return;
      }
      // carried into its own entry strip: off the table, and theirs
      var strip = state.sc.entry && state.sc.entry[c.side];
      var home = strip && strip.some(function (b) { return c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h; });
      if (home) {
        rl.off = c.side;
        c.alive = false; c.extracted = true; c.activated = true;
        lines.push({ side: c.side, text: c.label + ' carries the relic off the table.' });
      }
    }
    // the AI's way home: a carrier makes for the nearest point of its own entry strip (ai.js goalPoints)
    function relicGoal(u) {
      var state = E.state;
      if (!u || !u.relic || !relicOn(state)) return null;
      var strip = state.sc.entry && state.sc.entry[u.side], best = null;
      (strip || []).forEach(function (b) {
        var p = { x: Math.max(b.x + 1, Math.min(b.x + b.w - 1, u.x)), y: Math.max(b.y + 1, Math.min(b.y + b.h - 1, u.y)) };
        if (!best || R.inches(u.x, u.y, p.x, p.y) < R.inches(u.x, u.y, best.x, best.y)) best = p;
      });
      return best;
    }
    // the relic carried off ends the battle; otherwise the report is told who has it, and the scenario goes on
    function relicCheck(state) {
      if (!relicOn(state) || !state.sc.relic) return null;
      state.storyOutcome = Object.assign({}, state.storyOutcome || {}, { relic: relicHolder(state) });
      var off = state.sc.relic.off;
      return off ? { winner: off, text: off + ' carries the relic off the table.' } : null;
    }

    /* ================= the End phase: the story scenarios' own events =================
       Set up by a scenario's deploy (src/story/scenarios-story.js) on state.sc,
       and run here, once an End phase, before the battle is checked. */

    /* Waves: from turn `from`, every End phase, `per` units come out of the
       tunnel mouths for `side`, ready to act from the next turn. */
    function waves(state, lines) {
      var w = state.sc && state.sc.waves;
      if (!w || state.turn < (w.from || 1) || (w.until && state.turn > w.until) || !(w.mouths || []).length) return;
      /* A mouth that is an objective (`obj`: a brood chamber) sends nothing once
         it is destroyed, nor while side A holds it. */
      var open = w.mouths.filter(function (m) {
        var o = m.obj != null ? state.objectives[m.obj] : null;
        return !o || (!o.destroyed && o.owner !== 'A');
      });
      if (!open.length) return;
      w.n = w.n || 0;
      for (var i = 0; i < w.per; i++) {
        var key = w.keys[(w.n + i) % w.keys.length], p = R.profile(key);
        if (!p) continue;
        var m = open[(w.n + i) % open.length];
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

    /* Unknown contacts (Dead Reckoning's first half, docs/story-dead-reckoning-plan.md
       section 0): `variant.contacts` { turn, found, keys }. At the End phase of
       `turn`, or the first after the objective is found (`found`), whatever side B
       had on the table breaks and runs (off the table, fled: not lost), and in its
       place something nobody has a name for steps out of the air by the objective:
       a unit for each key, two more than the battle's Tier (as many as there are
       keys at most), side B's from then on, and known only as an unknown contact. */
    function contacts(state, lines) {
      var sty = story(), ct = sty && sty.variant && sty.variant.contacts;
      if (!ct || state.sc.contacts) return;
      var due = (ct.turn && state.turn >= ct.turn) || (ct.found && state.sc.found);
      if (!due) return;
      state.sc.contacts = { turn: state.turn };
      // a carrier of side B's drops the relic as it runs
      var rl = state.sc.relic, carrier = rl && rl.carrier != null ? unitById(state, rl.carrier) : null;
      if (carrier && carrier.side === 'B') { rl.carrier = null; carrier.relic = false; }
      /* (the force that ran, and its dead, are no longer side B's for its rout:
         from here the tally is of the contacts, scenarios.js routed) */
      var ran = 0;
      state.units.forEach(function (u) {
        if (u.side !== 'B' || u.unknown) return;
        u.superseded = true;
        if (!u.alive || u.aboard) return;
        u.alive = false; u.extracted = true; u.fled = true; u.activated = true; ran++;
      });
      if (ran) lines.push({ side: 'B', text: (state.cfg.nameB || 'The enemy') + ' break and run.' });
      state.cfg.nameB = 'Unknown contacts';
      var o = state.objectives[0], at = rl ? { x: rl.x, y: rl.y } : o ? { x: o.x, y: o.y } : { x: R.BOARD.w / 2, y: R.BOARD.h / 2 };
      var n = Math.min(ct.keys.length, (state.cfg.tier || 1) + 2);
      for (var i = 0; i < n; i++) {
        var p = R.profile(ct.keys[i]);
        if (!p) continue;
        var u = E.makeUnit(p, 'B', 'k' + i, null, false, null, false);
        u.unknown = true;
        u.name = 'Unknown contact';
        u.code = '?' + (i + 1);
        u.label = 'Unknown contact ' + (i + 1) + ' [B]';
        u.startSize = u.models;
        u.spawned = true;
        var ang = (i / n) * Math.PI * 2, spot = R.nearestFree(state, at.x + Math.cos(ang) * 4, at.y + Math.sin(ang) * 4, u);
        u.x = spot ? spot.x : at.x; u.y = spot ? spot.y : at.y;
        u.facing = Math.PI;   // towards side A's edge
        R.musterMen(u, null, state.namesTaken || (state.namesTaken = {}));
        state.units.push(u);
      }
      lines.push({ side: 'B', text: 'Contact: ' + n + ' unknown, stepping out of the air by the objective.' });
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
      // (talked out, the conversation settled it: there are no talks left to break)
      if (pa.talked) return;
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
    /* ================= the talks (a parley's conversation) =================
       A Parley with a conversation (cfg.story.parley, story.js parleyFor) is
       talked out before anyone moves: as turn 1's Action phase opens, the
       talks are asked of side A (state.parleyAsk), a step at a time, the
       other side's lines and the answers open to the commander. Each answer
       moves Trust and Tension; Tension at the conversation's `breakAt` breaks
       the talks. An agreement ends the battle, won by side A, with the terms
       agreed in the report (story.terms); talks that break leave both sides
       where they stand, and it is a fight. A side A the AI plays talks it
       out at once, as reasonably as it can. */
    function parleyOf(state) { var p = state && state.cfg && state.cfg.story && state.cfg.story.parley; return p && p.steps ? p : null; }
    function parleyOptions(pr, ask) {
      return ((pr.steps[ask.step] || {}).options || []).map(function (o, i) {
        return { i: i, text: o.text, locked: o.need > ask.trust, need: o.need };
      });
    }
    function parleyEnter(state, pr, ask, id) {
      var s = pr.steps[id];
      if (!s) return;
      ask.step = id;
      s.say.forEach(function (l) { ask.log.push(l); });
      ask.options = s.end ? [] : parleyOptions(pr, ask);
      if (s.end) ask.ended = s.end;
    }
    /* As turn 1's Action phase opens, before anyone moves: true while the talks
       hold the phase (an answer owed, or the battle agreed over). Talks that
       break go on into the phase as it stands (parleyEnd). */
    function parleyOpen() {
      var state = E.state, pr = parleyOf(state), pa = state && state.sc && state.sc.parley;
      if (!pr || !pa || pa.talked) return false;
      if (state.parleyAsk) return true;
      var ask = state.parleyAsk = { side: 'A', step: null, trust: 0, tension: 0, terms: [], log: [], options: [], ended: null };
      parleyEnter(state, pr, ask, pr.start);
      E.logLine('note', 'Under the white flag, the talks begin.');
      if (E.isAI('A')) {
        ask.auto = true;
        for (var n = 0; n < 40 && state.parleyAsk && !state.over; n++) parleySay('A', parleyPick(ask));
        return !!state.over;
      }
      E.render();
      return true;
    }
    // the AI's answer: the one that builds most trust for least tension, of those it may give
    function parleyPick(ask) {
      var pr = parleyOf(E.state), opts = (pr.steps[ask.step] || {}).options || [], best = 0, score = -Infinity;
      opts.forEach(function (o, i) {
        if (o.need > ask.trust) return;
        var v = o.trust * 2 - o.tension * 1.5 + (o.terms.length ? 3 : 0) + Math.random() * 0.5;
        if (v > score) { score = v; best = i; }
      });
      return best;
    }
    // an answer given: `i`, the answer's place among the step's
    function parleySay(side, i) {
      var state = E.state, ask = state && state.parleyAsk, pr = parleyOf(state);
      if (!ask || !pr || side !== ask.side) return 'nothing to answer';
      if (ask.ended) return parleyEnd(state, ask);
      var o = (pr.steps[ask.step] || {}).options && pr.steps[ask.step].options[i];
      if (!o) return 'no such answer';
      if (o.need > ask.trust) return 'they do not trust you enough for that yet';
      ask.log.push(o.line);
      ask.trust += o.trust; ask.tension += o.tension;
      o.terms.forEach(function (t) { if (ask.terms.indexOf(t) < 0) ask.terms.push(t); });
      o.reply.forEach(function (l) { ask.log.push(l); });
      parleyEnter(state, pr, ask, ask.tension >= pr.breakAt && pr.broke ? pr.broke : o.next);
      if (!ask.ended) { E.render(); return null; }
      return parleyEnd(state, ask);
    }
    function parleyEnd(state, ask) {
      var pa = state.sc.parley;
      state.parleyAsk = null;
      pa.talked = { result: ask.ended, log: ask.log, trust: ask.trust, tension: ask.tension, terms: ask.terms };
      if (ask.ended === 'agreed') {
        pa.agreed = state.turn;
        state.storyOutcome = { parley: 'agreed', terms: ask.terms.slice() };
        E.logLine('note', 'An agreement is reached under the white flag.');
        E.pushRes({ kind: 'Parley', title: 'An agreement', side: 'A', note: 'The talks end in an agreement. Nobody fires today.',
          list: ask.log.slice(-2).map(function (l) { return { side: null, text: l.name + ': “' + l.text + '”' }; }) });
        E.finish('A', 'The talks end in an agreement. Both sides walk away.');
        E.render();
        return null;
      }
      pa.broken = state.turn || 1; pa.by = 'talks';
      state.storyOutcome = { parley: 'broke down' };
      E.logLine('note', 'The talks break down. It is a fight.');
      E.pushRes({ kind: 'Parley', title: 'The talks break down', side: 'B', note: 'Nobody is talking any more. Both sides stand where they are, and it is a fight.' });
      // (the AI talking for side A: the phase it was opened from goes on by itself)
      if (!ask.auto) { E.render(); E.maybeAI(); }
      return null;
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
      relicEndPhase(state, lines);
      contacts(state, lines);
      hiredWalk(state, lines);
      waves(state, lines);
      if (lines.length) {
        lines.forEach(function (l) { E.logLine('note', l.text); });
        E.pushRes({ kind: 'End phase', title: state.scen.name, list: lines });
      }
      storyTalk();
    }

    /* ================= what is said =================
       The story's lines for this battle (cfg.story.talk, from story.js talkFor),
       each put up once, on a card with the speaker's face, when its moment comes:
       asked at the start of every turn, after every activation and at the End
       phase. What has been said is kept on the battle, so a save carries it. */
    var TALK_VOICE = { ops: 'A' };
    function lostOf(side, all) {
      var units = E.state.units.filter(function (u) { return u.side === side && !u.ally && (all || !u.spawned); });
      return { n: units.length, lost: units.filter(function (u) { return !u.alive && !u.extracted; }).length };
    }
    function talkMoment(on, state) {
      if (on === 'start') return state.turn >= 1;
      if (on === 'allies') return !!state.allies;
      if (on === 'turn3') return state.turn >= 3;
      if (on === 'kill') return lostOf('B', true).lost >= 1;
      if (on === 'loss') return lostOf('A').lost >= 1;
      if (on === 'bhalf' || on === 'ahalf') { var l = lostOf(on === 'bhalf' ? 'B' : 'A'); return l.n > 1 && l.lost * 2 >= l.n; }
      if (on === 'wave') return !!(state.sc && state.sc.waves && state.sc.waves.n);
      if (on === 'contact') return !!(state.sc && state.sc.contacts);
      // (talks that broke down in the conversation said so there; this is for talks broken by a shot)
      if (on === 'parley') return !!(state.sc && state.sc.parley && state.sc.parley.broken && state.sc.parley.by !== 'talks');
      // Find and secure: a location searched and empty, and the one that holds the objective (`guard` its holders' answer)
      // the first of the enemy's hidden counters turned over (Close Encounters): what they are
      if (on === 'sighted') return state.units.some(function (u) { return u.side === 'B' && u.wasHidden && !u.hidden; });
      if (on === 'searched') return !!(state.sc && state.sc.search && state.sc.search.some(function (sp) { return sp.checked && sp !== state.sc.found; }));
      if (on === 'found' || on === 'guard') return !!(state.sc && state.sc.found);
      if (on === 'target') {
        var t = state.units.filter(function (u) { return u.storyTarget; })[0];
        return !!t && t.alive && ((t.sp || 0) > 0 || t.models < (t.startSize || t.models) || (t.damage || 0) > 0);
      }
      return false;
    }
    /* `setup`: asked once the table is laid and before anyone deploys, when
       only the allies speak: they report in as the force is placed. */
    function storyTalk(setup) {
      var sty = story(), state = E.state;
      if (!sty || !sty.talk || !sty.talk.length || state.over) return;
      if (!setup && (state.phase !== 'battle' || !state.turn)) return;
      var said = state.talkSaid = state.talkSaid || {}, before = Object.assign({}, said);
      sty.talk.forEach(function (l) {
        if (setup && l.on !== 'allies') return;
        if (said[l.on] != null || !talkMoment(l.on, state)) return;
        // (`after`: not until that line is said, and not on the same card run as it)
        if (l.after && before[l.after] == null) return;   // (the turn it was said: 0 while setting up)
        said[l.on] = state.turn || 0;
        say(l, TALK_VOICE[l.who] || null);
      });
    }
    function say(l, side) {
      E.logLine('note', l.name + ': \u201c' + l.text + '\u201d');
      E.pushRes({ kind: 'Comms', title: l.name, side: side, note: l.text,
        talk: { story: story().id, who: l.who, role: l.role } });
    }
    /* The allies answer an order (cfg.story.allyVoice): their words for it, in
       turn, so the same order twice is not answered the same way. */
    function allyAnswer(kind) {
      var av = story() && story().allyVoice, ls = av && av[kind || 'clear'];
      if (!ls || !ls.length) return;
      var n = E.state.allyTalkN = (E.state.allyTalkN || 0) + 1;
      say({ who: av.who, name: av.name, role: av.role, text: ls[(n - 1) % ls.length] }, 'A');
    }

    /* What a story asks of the check, before the scenario's own: its target, and
       its own turn limit (the scenario judged as at the end of its time). Null
       where the story asks nothing, and the scenario is checked as usual. */
    function storyCheck(state) {
      var t = targetCheck(state);
      if (t) return t;
      var rc = relicCheck(state);
      if (rc) return rc;
      var sty = state.cfg && state.cfg.story;
      if (!sty || !sty.turns || state.turn < sty.turns) return null;
      var real = state.turn;
      state.turn = Math.max(real, (state.scen && state.scen.turns) || 20);
      var res = E.SC.check(state);
      state.turn = real;
      return res || { winner: null, text: 'Time runs out, and nothing is settled — a draw.', timeout: true };
    }

    /* ================= a mission's own map =================
       A seeded random: the same numbers every time from the same seed (a string
       or a number), so a mission's map, and its compound, look the same each
       time it is fought. */
    function storySeeded(seed) {
      var h = 2166136261 >>> 0, str = String(seed);
      for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
      return function () {
        h = (h + 0x6D2B79F5) >>> 0;
        var t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    /* A story mission's setup, done the same way every time: what the scenario
       lays of its own at random (Find and secure's search sites, Demolish's
       target, Hostile takeover's fortifications, Last Stand's barricades, the
       landing zones, the story scenarios' tunnel mouths and decoys) is laid from
       the mission's seed. Only the setup: the battle's dice are its own. */
    function storyFixed(label, fn) {
      var sty = story();
      if (!sty || !sty.seed) return fn();
      var was = Math.random;
      Math.random = storySeeded(sty.seed + ':' + label);
      try { return fn(); } finally { Math.random = was; }
    }

    /* The map as the story wrote it (cfg.terrainPlan, already fitted to the table
       by levers.js): each piece given its outline, a wood its lobes, a building
       its wings, by the mission's seed, so it is drawn the same each time. */
    /* A map's skin for its pieces (levers.js `skin`): on a settlement's
       ('market'), a barricade is a boulevard's railings and planters and a crater field the
       market's clutter. The rules read them as they always did; only the look
       and the name change. Asked of the map's pieces and of any put down later. */
    function marketSkin(cfg, t) {
      if (cfg && cfg.story && cfg.story.skin === 'market' && (t.kind === 'barricade' || t.kind === 'crater')) t.market = true;
      return t;
    }
    function storyTerrain(cfg) {
      var rand = storySeeded((cfg.story && cfg.story.seed) || 'map');
      var terrain = cfg.terrainPlan.map(function (p) {
        var t = JSON.parse(JSON.stringify(p)), fam = t.shape || t.plan || null;
        delete t.shape;
        if (R.shapePiece) R.shapePiece(t, rand, fam);
        return t;
      });
      terrain.forEach(function (t) { marketSkin(cfg, t); });
      return { terrain: terrain, rolls: [], generator: (cfg.story && cfg.story.mapName) || 'The mission\u2019s own ground' };
    }

    /* The allies' orders: one marker for all of them, put down by the player and
       moved at most once a turn (until an ally has acted on it, it can still be
       put right). Move here: at the double, a Move with no shot on the way.
       Attack here: Advance on it, and engage the enemy round it. Hold here: get
       there, then take the best cover near it and shoot from there. Within
       ORDER_REACH of the marker, a unit has arrived. Kept on the battle, so a save
       and a replay carry it. */
    var ORDER_KINDS = { move: 'Move here', attack: 'Attack here', hold: 'Hold here' }, ORDER_REACH = 4;
    function allyOrder(u) {
      var o = E.state && E.state.allyOrder;
      return o && ORDER_KINDS[o.kind] && (!u || u.ally) ? o : null;
    }
    function orderReach() { return ORDER_REACH; }
    function orderLocked() {
      var o = E.state && E.state.allyOrder;
      return !!(o && o.turn === E.state.turn && o.acted);
    }
    /* Hired guns (Dead Reckoning; docs/story-dead-reckoning-plan.md, Hired
       guns). With their Trust low an order can be answered with a demand: at −1
       or −2 it is refused on a D6 of 1 to 3 (rolled once a turn), at −3 or lower
       always. A refused order stands only if the player pays on the spot, 1 kUC
       (`pay`), billed to the company after the battle (storyOutcome.allyPaid).
       With Trust −2 or lower from the start, or once they have lost half their
       units, they walk: at the next End phase they leave the table. */
    var HIRED_PAY = 1;
    function hired() { var sty = story(); return sty && sty.hired || null; }
    function demands(state) {
      var h = hired();
      if (!h || h.trust > -1) return false;
      if (h.trust <= -3) return true;
      var d = state.hiredRoll;
      if (!d || d.turn !== state.turn) d = state.hiredRoll = { turn: state.turn, refused: R.d6() <= 3 };
      return d.refused;
    }
    function hiredWalk(state, lines) {
      var h = hired();
      if (!h || state.hiredWalked) return;
      var mine = state.units.filter(function (u) { return u.side === 'A' && u.ally; });
      var gone = mine.filter(function (u) { return !u.alive && !u.extracted && !u.walked; }).length;
      if (!(h.trust <= -2 || (mine.length && gone * 2 >= mine.length))) return;
      state.hiredWalked = state.turn;
      var left = 0;
      mine.forEach(function (u) {
        if (!u.alive || u.aboard) return;
        // (gone, not lost and not got away: out of side A's tally, scenarios.js routed)
        u.alive = false; u.walked = true; u.superseded = true; u.activated = true; left++;
      });
      if (!left) return;
      if (state.allyOrder) state.allyOrder = null;
      lines.push({ side: 'A', text: h.name + ' walk off the table.' });
      state.storyOutcome = Object.assign({}, state.storyOutcome || {}, { allyWalked: true });
      allyAnswer('walk');
    }
    // { kind, x, y } (kind null: the order withdrawn); a reason it cannot be given, or null
    function giveAllyOrder(side, it) {
      var state = E.state;
      if (!state.allies || side !== state.allies.side) return 'there are no allies to order';
      if (state.phase !== 'battle' || state.over) return 'orders are given once the battle is under way';
      if (orderLocked()) return 'the allies are already acting on this turn’s orders';
      if (it.kind == null) {
        if (state.allyOrder) { E.logLine('note', 'The allies are left to their own judgement.'); allyAnswer(null); }
        state.allyOrder = null; state.allyDemand = null;
        return null;
      }
      if (!ORDER_KINDS[it.kind]) return 'no such order';
      var x = +it.x, y = +it.y;
      if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > R.BOARD.w || y > R.BOARD.h) return 'that is off the table';
      // hired guns with low Trust: that's extra (paid on the spot, or the order is refused)
      if (demands(state)) {
        if (!it.pay) {
          state.allyDemand = { kind: it.kind, x: x, y: y, turn: state.turn, kUC: HIRED_PAY };
          E.logLine('note', hired().name + ' want ' + HIRED_PAY + ' kUC for that order.');
          allyAnswer('demand');
          return null;
        }
        state.storyOutcome = Object.assign({}, state.storyOutcome || {}, { allyPaid: ((state.storyOutcome || {}).allyPaid || 0) + HIRED_PAY });
        E.logLine('note', 'Paid ' + HIRED_PAY + ' kUC on the spot.');
      }
      state.allyDemand = null;
      state.allyOrder = { kind: it.kind, x: x, y: y, turn: state.turn, acted: false };
      E.logLine('note', 'The allies’ orders: ' + ORDER_KINDS[it.kind].toLowerCase() + '.');
      allyAnswer(it.kind);
      return null;
    }
    // an ally acting on the order: from now, this turn's order stands
    function orderActed(u) {
      var o = allyOrder(u);
      if (o) { o.acted = true; o.turn = E.state.turn; }
      return o;
    }

    return {
      marketSkin: marketSkin, ambushWaits: ambushWaits, allyOrder: allyOrder, orderReach: orderReach, orderLocked: orderLocked, giveAllyOrder: giveAllyOrder, orderActed: orderActed,
      orderWord: function (k) { return ORDER_KINDS[k] || ''; },
      storySeeded: storySeeded, storyTerrain: storyTerrain, storyFixed: storyFixed,
      storyUnits: storyUnits, storyPrelude: storyPrelude, storyFirstTurn: storyFirstTurn, allyActs: allyActs, targetCheck: targetCheck,
      storyEndPhase: storyEndPhase, storyTalk: storyTalk, parleyOpen: parleyOpen, parleySay: parleySay, relicFollow: relicFollow, relicGoal: relicGoal, relicCheck: relicCheck, storyCheck: storyCheck, parleyHolds: parleyHolds
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineStory;
})(typeof window !== 'undefined' ? window : global);
