/* PMC 2670 — Firefight : marking targets: designating for artillery and air, and who may answer a mark

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineMarks = function (E) {
    var R = E.R, addFx = E.addFx, afterChain = E.afterChain, byId = E.byId, endActivation = E.endActivation,
        isAI = E.isAI, keenFx = E.keenFx, logLine = E.logLine, maybeAI = E.maybeAI, render = E.render,
        setHint = E.setHint, ui = E.ui;

    /* Markerlights reach 24", or 12" against a Stealth unit (p. 58). Smoke Markers
       are the rebels' answer: a flare and a smoke grenade, out to 12" (p. 94). */
    function markReach(u) {
      return R.has(u, 'Markerlights') ? 24 : 12;
    }

    function markTargets(u) {
      var far = markReach(u);
      return E.state.units.filter(function (t) {
        // only what is on the table: a reserve or a passenger is parked at (-1, -1)
        if (!R.onTable(t) || t.side === u.side) return false;
        var lim = R.has(t, 'Stealth') && !R.has(u, 'Keen-Eyed') ? Math.min(12, far) : far;
        if (R.unitDist(u, t) > lim) return false;
        if (R.hasLoS(E.state, u, t)) return true;
        // Mental Projection (p. 129): what one of the tribe sees, every Xenotripod sees — a marker included
        return R.xenoSenses(u) && !R.campFlag(u, 'banished') && R.tribeSees(E.state, u.side, t);
      });
    }

    /* What the marker is being asked to do, in the player's words. */
    function markHint(u) {
      var kind = ui.markKind === 'mark' ? 'mark' : 'designate';
      var picks = (ui.markPicks || []).length;
      if (!picks) {
        return (ui.moves.length ? 'Move up to ' + u.move + '" first if you like, then pick ' : 'Pick ') +
          'an enemy to ' + (kind === 'mark' ? 'mark' : 'designate') + '.';
      }
      return 'Pick the enemy for this call.';
    }

    /* Designate target / Mark the target (p. 58), and Smoke Markers (p. 94).

       The call is not a condition the target wears for the rest of the turn: it
       summons one or two friendly units, out of sequence, and dies with them. A
       marker that stood still calls two; one that moved first calls one; Smoke
       Markers always call two. Standing still also lets the marker put the call on
       two different enemies instead of doubling up on one. */
    function doDesignate(target, actor, kind) {
      var u = actor || ui.selected;
      if (!u) return;
      var mk = kind || ui.markKind || 'designate';
      if (!R.has(u, 'Markerlights')) mk = 'designate';       // Smoke Markers designate only
      /* One target at a time: it is named, one unit answers it, and only then does
         a marker that stood still name its second — the same enemy again, or
         another (see offerSecondMark). */
      ui.markPicks = [target];
      commitMark(u, mk);
    }

    function commitMark(u, kind) {
      var picks = (ui.markPicks || []).slice();
      if (!picks.length) return;
      var smoke = !R.has(u, 'Markerlights') && R.has(u, 'Smoke Markers');
      /* A marker that stood still (and Smoke Markers, moved or not: p. 94) calls two
         units; one that moved calls one. They come one at a time, each on a target
         named just before it fires. */
      var second = !!E.state.remark;
      if (second) { E.state.remark = null; E.state.chain = null; }
      var shots = 1;
      E.state.mark = { side: u.side, kind: kind, targets: picks, smoke: smoke, by: u.id,
        again: !second && (smoke || !u.markMoved) };
      picks.forEach(function (t) {
        t.marked = true;
        // the marker's laser (or smoke round's trace) onto each mark
        // drawn over whatever follows: the guns it calls are the player's to pick, and need not wait for it
        if (smoke) {
          /* Smoke Markers: a grenade thrown onto the mark, bursting where it lands,
             the flare burning in the smoke — in flight a little longer the further it goes */
          var gt = Math.round(Math.min(1000, 450 + R.unitDist(u, t) * 40));
          addFx({ kind: 'lob', grenade: true, unit: u.id, from: { x: u.x, y: u.y }, to: { x: t.x, y: t.y }, dur: gt });
          addFx({ kind: 'puff', x: t.x, y: t.y, delay: gt - 30, dur: gt + 1800 });
        } else addFx({ kind: 'beam', unit: u.id, x: u.x, y: u.y, tx: t.x, ty: t.y, rgb: '255,70,60', dur: 1200 });
        keenFx(u, t, 12);                                    // marking a Stealth unit past 12"
      });
      u.activated = true;

      var ready = E.state.units.filter(function (o) {
        return o.alive && !o.aboard && !o.activated && !o.reserve && o.side === u.side && o !== u &&
          R.status(o) !== 'broken' && picks.some(function (t) { return canAnswerMark(o, t, kind); });
      });
      var calls = Math.min(shots, ready.length);
      logLine('note', u.label + (smoke ? ' puts smoke and a flare on ' :
        kind === 'mark' ? ' marks ' : ' designates ') +
        picks.map(function (t) { return t.label; }).join(' and ') +
        (second ? ' for its second call' : u.markMoved ? ', on the move' : '') + ' — ' +
        (calls ? calls + ' friendly unit' + (calls > 1 ? 's fire' : ' fires') + ' at once' +
          (kind === 'mark' ? ', as though at half range' : ', without needing to see it')
          : 'but nobody is in a position to answer') + '.');
      if (calls && !E.state.chain) {
        E.state.chain = {
          side: u.side, remaining: calls + 1,
          kind: 'mark', target: picks[0], x: u.x, y: u.y, tier: 99
        };
      } else if (!calls) {
        clearMark();
      }
      ui.markPicks = []; ui.markKind = null;
      if (second) {
        /* The marker already had its activation: the second call runs as a chain of
           its own, and when nobody could answer it the go passes on as usual. */
        ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = [];
        if (calls) { E.state.chain.remaining = calls; render(); maybeAI(); }
        else afterChain();
        return;
      }
      endActivation(u);
    }

    /* After the first answer, a marker that stood still names its second target:
       the same enemy again, or another, so long as someone is left to answer it.
       The player picks it (or Cancels to let the call go); the AI takes the best. */
    function offerSecondMark() {
      var m = E.state.mark;
      if (!m || !m.again) return false;
      var u = byId(m.by);
      if (!u || !u.alive || R.status(u) === 'broken') return false;
      var kind = m.kind;
      var can = markTargets(u).filter(function (t) {
        return E.state.units.some(function (o) {
          return o.alive && !o.aboard && !o.activated && !o.reserve && o.side === u.side && o !== u &&
            R.status(o) !== 'broken' && canAnswerMark(o, t, kind);
        });
      });
      clearMark();
      if (!can.length) return false;
      E.state.chain = null;
      E.state.remark = { by: u.id, side: u.side, kind: kind };
      ui.selected = u; ui.mode = 'designate'; ui.markKind = kind; ui.markPicks = [];
      ui.targets = can; ui.moves = []; ui.terrain = []; ui.preview = null;
      if (isAI(u.side)) {
        can.sort(function (a2, b2) { return (b2.models || 1) * b2.tier - (a2.models || 1) * a2.tier; });
        doDesignate(can[0], u, kind);
        return true;
      }
      setHint(null, u.name + ' stood still: ' + (kind === 'mark' ? 'mark' : 'designate') +
        ' a second target — the same one again, or another — or Cancel to let the second call go.');
      render();
      return true;
    }
    // the player lets the second call go
    function declineSecondMark() {
      var u = E.state.remark && byId(E.state.remark.by);
      E.state.remark = null;
      ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.markPicks = []; ui.markKind = null;
      if (u) logLine('note', u.label + ' makes no second call.');
      afterChain();
    }

    function clearMark() {
      if (E.state.mark) E.state.mark.targets.forEach(function (t) { t.marked = false; });
      E.state.mark = null;
    }

    /* Could this unit answer a call of this kind? `R.canShoot` is asked the whole
       question — range, minimum range, arc, specialisation and, for a designation,
       the line of sight it is allowed to do without. */
    function canAnswerMark(o, target, kind) {
      if (!target || !target.alive || target.aboard) return false;
      if (o.fp == null || !o.fp || !o.range) return false;
      /* Answering is a Fire! — which a Suppressed unit cannot take (only its
         auxiliary weapon, p. 34) — so one is never called up, nor waited on. */
      var st = R.status(o);
      if (st === 'suppressed' || st === 'broken') return false;
      /* Turrets "are not affected by any other rule which changes activation order"
         (p. 130): a call fetches no turret out of its turn, which is all of them at once. */
      if (R.has(o, 'Turret')) return false;
      /* Designate target calls up a unit WITH Indirect Fire; Mark the target calls
         up one WITHOUT it. Neither will do for the other's call (p. 58). */
      var indirect = R.has(o, 'Indirect Fire') && !R.dugIn(o);
      if ((kind === 'mark') === indirect) return false;
      return R.canShoot(E.state, o, target, 'fire', { markKind: kind || 'designate' });
    }

    // is there anybody at all who could answer a call of this kind?
    function markAnswerable(u, kind) {
      var td = markTargets(u);
      if (!td.length) return false;
      return E.state.units.some(function (o) {
        return o.alive && !o.aboard && !o.activated && !o.reserve && o.side === u.side && o !== u &&
          R.status(o) !== 'broken' &&
          td.some(function (t) { return canAnswerMark(o, t, kind); });
      });
    }

    return {
      markReach: markReach, markTargets: markTargets, markHint: markHint, doDesignate: doDesignate,
      offerSecondMark: offerSecondMark, declineSecondMark: declineSecondMark, clearMark: clearMark,
      canAnswerMark: canAnswerMark, markAnswerable: markAnswerable
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineMarks;
})(typeof window !== 'undefined' ? window : global);
