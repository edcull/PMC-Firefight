/* PMC 2670 — Firefight : the planner, the choosing AI's judge of its options

   The utility AI (ai.js) adds up a dozen considerations, each with a weight of its
   own; the planner instead weighs a unit's options in one currency: what of the
   enemy force it can expect to destroy or break, less what of its own it can expect
   to lose standing there through the enemy's turn. A unit's worth is its Tier's
   value (each Tier doubles it) times what is left of it — men, or hull — and how
   far its Suppression has it from breaking. Chance is taken as its average: the
   rules' own expected shot (R.expectedShot), never a roll, so planning never touches
   the game's dice. See docs/ai-research.md.

   The utility AI still proposes: its best few spots, scored without its own count
   of shots and sightlines, which the planner's expected values replace. The planner
   picks among them — and Fire! from where the unit stands — and says what to do.

   Made once by engine.js, the first time it is wanted, as the other kits are. */
(function (root) {
  'use strict';
  root.PMCEnginePlanner = function (E) {
    var R = E.R, SC = E.SC, UR = E.UR;

    // what a Tier is worth: each doubles it, as a recruit's cost does (camp-company RECRUIT_COST)
    function tierValue(u) { return Math.pow(2, Math.max(0, (u.tier || 1) - 1)); }

    /* A unit's worth as it would stand with `models` men (or `dmg` Damage on its hull)
       and `sp` Suppression: its Tier's value, times what is left of it, times how much
       fight its Suppression leaves it — the closer to breaking, the less (p. 34). */
    function worth(u, models, sp, dmg) {
      var v = tierValue(u);
      if (R.isMachine(u)) {
        var str = u.str || 1;
        return v * Math.max(0, (str - (dmg || 0)) / str);
      }
      var size = u.startSize != null ? u.startSize : (u.size || 1);
      if (models <= 0) return 0;
      var m = R.currentMorale(Object.assign({}, u, { models: models })) || 1;
      var eff = 1 - 0.35 * Math.min(1, sp / m) - 0.5 * Math.max(0, Math.min(1, (sp - m) / m));
      return v * (models / size) * Math.max(0.1, eff);
    }
    function worthNow(u) { return worth(u, u.models, u.sp || 0, u.damage || 0); }

    /* What a's shot at t takes off t's worth, on average (R.expectedShot): men lost,
       Suppression added, hull Damage done. */
    function shotValue(a, t, mode) {
      var ex;
      try { ex = R.expectedShot(E.state, a, t, mode, {}); } catch (e) { return 0; }
      var before = worthNow(t);
      var after = worth(t, Math.max(0, t.models - (ex.casualties || 0)), (t.sp || 0) + (ex.sp || 0), (t.damage || 0) + (ex.damage || 0));
      return Math.max(0, before - after);
    }

    /* A unit as it would stand at c, for the rules' sight, reach and cover to read: the
       unit itself where it stands; elsewhere a copy that the rules' line of sight knows
       for it (`of`), so the unit, still standing where it is, does not hide its own
       copy (space.js hasLoS). */
    function ghostAt(u, c) {
      if (c.x === u.x && c.y === u.y) return u;
      return Object.assign({}, u, { x: c.x, y: c.y, bld: null, of: u });
    }

    /* Planning one activation: the expected values are kept for its length, keyed by
       what changes them — who shoots whom, from half range or not, the cover at the
       spot — so the dozens of spots weighed cost a handful of expected shots. */
    var memo = null;
    function cached(key, f) {
      if (!memo) return f();
      if (!(key in memo)) memo[key] = f();
      return memo[key];
    }

    // the best this unit can do to the enemy from c: its expected shot at the best target there
    function bestShotFrom(u, c, mode) {
      var g = ghostAt(u, c), best = { t: null, v: 0 };
      E.state.units.forEach(function (t) {
        if (!t.alive || t.side === u.side || t.x < 0 || t.aboard || t.fp === undefined) return;
        if (!R.canShoot(E.state, g, t, mode, {})) return;
        var half = R.unitDist(g, t) <= (u.range || 0) / 2 ? 1 : 0;
        var v = cached('s|' + u.id + '|' + mode + '|' + t.id + '|' + half + '|' + (R.levelOf(E.state, g) > 0 ? 1 : 0), function () { return shotValue(g, t, mode); });
        if (v > best.v) best = { t: t, v: v };
      });
      return best;
    }

    /* What standing at c is expected to cost it through the enemy's turn: every enemy
       that could shoot it there, its expected shot at it — shared by the targets that
       enemy has to choose from, as it will shoot only one of them. */
    function threatAt(u, c) {
      var g = ghostAt(u, c), mine = E.state.units.filter(function (f) { return f.alive && f.side === u.side && f.x >= 0 && !f.aboard; });
      var cover = R.coverAt(E.state, c.x, c.y, u) || 0, total = 0;
      E.state.units.forEach(function (e) {
        if (!e.alive || e.side === u.side || e.x < 0 || e.aboard || e.fp === null || e.fp === undefined) return;
        if (R.status(e) === 'broken') return;
        if (R.inches(e.x, e.y, c.x, c.y) > (e.range || 0) + 3) return;
        if (!R.canShoot(E.state, e, g, 'fire', {})) return;
        var half = R.unitDist(e, g) <= (e.range || 0) / 2 ? 1 : 0;
        var v = cached('t|' + u.id + '|' + e.id + '|' + cover + '|' + half, function () { return shotValue(e, g, 'fire'); });
        // how many of ours it has to choose from (this one at c, and the rest where they stand)
        var choices = cached('n|' + u.id + '|' + e.id, function () {
          return mine.filter(function (f) { return f !== u && R.canShoot(E.state, e, f, 'fire', {}); }).length;
        }) + 1;
        total += v / choices;
      });
      return total;
    }

    /* ---- The fitted evaluation ----
       How a position's features predict the winner, fitted by logistic regression on
       2,000 battles between the AI as it is (scripts/balance/evalfit.js, October 2026):
       on battles it never saw it calls the winner 73.5% of the time (80.7% by turns
       5-7), against 67.9% for "more worth left wins". Units still in the fight (a rout
       reads them) count the most, then objectives held and progress to a held win; Stress,
       broken units and the losses to be expected count against; fire to bring counts for
       little of itself. Refit when the AI or the rules change (evaldata.js, evalfit.js). */
    var EVAL = { worth: 0.018, worthShare: 0.387, unitsShare: 3.849, broken: -0.303, stress: -0.554, held: 0.606, clock: 2.005, fire: -0.040, risk: -0.167 };

    /* What a's shot at t does to the features, on average: the enemy's Stress (its mean,
       over its units on the table), whether it breaks t, whether it takes t out of the
       fight, and the worth it takes off. Signed for the side shooting: good for it is +. */
    function shotDelta(a, t, mode) {
      var ex;
      try { ex = R.expectedShot(E.state, a, t, mode, {}); } catch (e) { return 0; }
      return lossDelta(t, ex);
    }
    // what losing ex (men, Suppression, Damage, on average) does to t's side, in the evaluation's log-odds
    function lossDelta(t, ex) {
      var foes = E.state.units.filter(function (f) { return f.side === t.side && R.countsForVictory(f); });
      var onTable = foes.filter(function (f) { return f.alive && !f.fled && f.x >= 0 && !f.aboard && !R.isMachine(f); }).length || 1;
      var d = 0;
      if (R.isMachine(t)) {
        if ((t.damage || 0) + (ex.damage || 0) >= (t.str || 1)) d += EVAL.unitsShare / (foes.length || 1);
      } else {
        var left = Math.max(0, t.models - (ex.casualties || 0)), sp = (t.sp || 0) + (ex.sp || 0);
        if (left <= 0) d += EVAL.unitsShare / (foes.length || 1);
        else {
          var m0 = R.currentMorale(t) || 1, m1 = R.currentMorale(Object.assign({}, t, { models: left })) || 1;
          var st0 = Math.min(3, (t.sp || 0) / m0), st1 = Math.min(3, sp / m1);
          d -= EVAL.stress * (st1 - st0) / onTable;                      // (theirs: good for us when it rises)
          if (sp > 2 * m1 && (t.sp || 0) <= 2 * m0) d -= EVAL.broken;
        }
      }
      var w0 = worthNow(t), w1 = worth(t, Math.max(0, t.models - (ex.casualties || 0)), (t.sp || 0) + (ex.sp || 0), (t.damage || 0) + (ex.damage || 0));
      return d + EVAL.worth * (w0 - w1);
    }
    /* A charge, in the same currency: the first round each way (R.assaultOdds), a hit
       on a squad as the assault's own table has it (damage.js resolveAssaultHits: a
       man down on 4+, 1 SP on 2-3), what it does to them less what their answer does
       to us. A hull or a gun answers with Damage, which this leaves out. */
    var PER_HIT = { c: 0.5, sp: 1 / 3 + 1 };
    function chargeDelta(u, t) {
      var mine, theirs;
      try { mine = R.assaultOdds(E.state, u, t).avgHits; theirs = R.isMachine(u) ? 0 : R.assaultOdds(E.state, t, u).avgHits; } catch (e) { return 0; }
      var hurt = function (who, hits) {
        if (R.isMachine(who)) return { damage: hits * 0.5 };
        return { casualties: Math.min(who.models, hits * PER_HIT.c), sp: hits * PER_HIT.sp };
      };
      return lossDelta(t, hurt(t, mine)) - lossDelta(u, hurt(u, theirs));
    }
    function bestDeltaFrom(u, c, mode) {
      var g = ghostAt(u, c), best = { t: null, v: 0 };
      E.state.units.forEach(function (t) {
        if (!t.alive || t.side === u.side || t.x < 0 || t.aboard || t.fp === undefined) return;
        if (!R.canShoot(E.state, g, t, mode, {})) return;
        var half = R.unitDist(g, t) <= (u.range || 0) / 2 ? 1 : 0;
        var v = cached('d|' + u.id + '|' + mode + '|' + t.id + '|' + half + '|' + (R.levelOf(E.state, g) > 0 ? 1 : 0), function () { return shotDelta(g, t, mode); });
        if (v > best.v) best = { t: t, v: v };
      });
      return best;
    }
    // objectives this side would hold with u at c (a count, as the evaluation's own feature)
    function heldAt(u, c) {
      if (!E.state.objectives || !E.state.objectives.length) return 0;
      return cached('h|' + u.id + '|' + Math.round(c.x * 2) + ',' + Math.round(c.y * 2), function () {
        var ox = u.x, oy = u.y, ob = u.bld, n = 0;
        try {
          if (c.x !== ox || c.y !== oy) { u.x = c.x; u.y = c.y; u.bld = null; }
          E.state.objectives.forEach(function (o) {
            var h = SC.holderOf(E.state, o.x, o.y, 4, SC.areaOf(o));
            if (h === u.side) n++; else if (h) n--;
          });
        } finally { u.x = ox; u.y = oy; u.bld = ob; }
        return n;
      });
    }
    /* The planner judging by the fitted evaluation: each option's worth is how far it is
       expected to move the side's chance of winning (in the evaluation's log-odds) — the
       shot's effect on the enemy, the ground held, the losses to be expected standing
       there — turned into the utility AI's units by `ke`, on top of the spot's base
       score (the way to the goal, which the evaluation does not see). */
    function chooseByEval(u, cands, here, opts) {
      memo = {};
      try {
        var ke = (opts && opts.ke) || 10, canAdvance = !(opts && opts.noAdvance);
        var at = { x: u.x, y: u.y };
        var fireNow = u.fp != null ? bestDeltaFrom(u, at, 'fire') : { t: null, v: 0 };
        var heldHere = heldAt(u, at), riskHere = threatAt(u, at);
        // (`rk`, a tuning: the losses to be expected where it stands counted that many times over)
        var rk = (opts && opts.rk) || 1;
        var val = function (shotV, held, risk) { return shotV + EVAL.held * (held - heldHere) + rk * EVAL.risk * (risk - riskHere); };
        var best = { kind: fireNow.t ? 'fire' : 'hold', t: fireNow.t, base: here, score: here + ke * val(fireNow.v, heldHere, riskHere) };
        var all = [best];
        // (experiment 'lfire', for a lookahead) every target it could Fire! at from here, not only the best
        if (opts && opts.fireAll && u.fp != null) E.state.units.forEach(function (t) {
          if (t === fireNow.t || !t.alive || t.side === u.side || t.x < 0 || t.aboard || t.fp === undefined) return;
          if (!R.canShoot(E.state, u, t, 'fire', {})) return;
          all.push({ kind: 'fire', t: t, base: here, score: here + ke * val(shotDelta(u, t, 'fire'), heldHere, riskHere) });
        });
        cands.forEach(function (cd) {
          var shot = canAdvance && u.fp != null ? bestDeltaFrom(u, cd.c, 'advance') : { v: 0 };
          var s = cd.base + ke * val(shot.v, heldAt(u, cd.c), threatAt(u, cd.c));
          all.push({ kind: 'move', c: cd.c, base: cd.base, score: s - 0.3 });
          if (s > best.score + 0.3) best = { kind: 'move', c: cd.c, base: cd.base, score: s };
        });
        // a charge the AI could make (opts.charge, an enemy in reach), weighed the same way
        if (opts && opts.charge) {
          var sc = here + ke * chargeDelta(u, opts.charge);
          all.push({ kind: 'charge', t: opts.charge, base: here, score: sc - 0.3 });
          if (sc > best.score + 0.3) best = { kind: 'charge', t: opts.charge, base: here, score: sc };
        }
        // (every option, best first, for a lookahead to choose among: ai.js lookahead)
        best.all = all.sort(function (a, b) { return b.score - a.score; });
        return best;
      } finally { memo = null; }
    }

    /* ---- The ground, in the same currency ----
       What the objectives are worth to a side, as they would stand with this unit
       somewhere: each objective held counts its worth, each the enemy holds counts
       against, one nobody holds nothing. An objective's worth is `gw` (a few units'
       worth) and grows with the progress either side has toward a win by holding it
       over time (SC.holdClock: Secure and control's same two, Find and secure's prize)
       — taking it from the enemy then, or keeping it, counts for the more. */
    function objWorth(i, gw) {
      var w = gw, clock = SC.holdClock ? SC.holdClock(E.state, i) : null;
      if (clock && clock.side && clock.n > 0) w *= 1 + clock.n / Math.max(1, clock.need - 1);
      return w;
    }
    function controlValue(side, gw) {
      var v = 0;
      E.state.objectives.forEach(function (o, i) {
        var h = SC.holderOf(E.state, o.x, o.y, 4, SC.areaOf(o));
        if (h) v += (h === side ? 1 : -1) * objWorth(i, gw);
      });
      return v;
    }
    // the ground's worth to u's side with u standing at c (the board as it is otherwise)
    function groundAt(u, c, gw) {
      if (!E.state.objectives || !E.state.objectives.length) return 0;
      return cached('g|' + Math.round(c.x * 2) + ',' + Math.round(c.y * 2), function () {
        var ox = u.x, oy = u.y, ob = u.bld;
        var moved = c.x !== ox || c.y !== oy;
        try {
          if (moved) { u.x = c.x; u.y = c.y; u.bld = null; }
          return controlValue(u.side, gw);
        } finally { u.x = ox; u.y = oy; u.bld = ob; }
      });
    }

    /* The choice, for a unit about to move or shoot: `cands` are the utility AI's best
       spots ({ c, base }, base its score without shots and sightlines), `here` its
       score where it stands. Each spot is worth its base plus, in the planner's
       currency, what it can shoot from there less what standing there costs it; Fire!
       from where it stands is weighed the same way. `k` turns worth into the utility
       AI's units (an inch of the way to the goal is 0.6); `ground`, the worth of an
       objective (0 or none: the ground is not weighed). Returns { kind: 'fire', t },
       { kind: 'move', c } or { kind: 'hold' }. */
    function choose(u, cands, here, opts) {
      memo = {};
      try {
        var k = (opts && opts.k) || 2.5, canAdvance = !(opts && opts.noAdvance), gw = opts && opts.ground;
        var at = { x: u.x, y: u.y };
        var fireNow = u.fp != null ? bestShotFrom(u, at, 'fire') : { t: null, v: 0 };
        var riskHere = threatAt(u, at), groundHere = gw ? groundAt(u, at, gw) : 0;
        var best = { kind: fireNow.t ? 'fire' : 'hold', t: fireNow.t, score: here + k * (fireNow.v - riskHere + groundHere) };
        cands.forEach(function (cd) {
          var shot = canAdvance && u.fp != null ? bestShotFrom(u, cd.c, 'advance') : { v: 0 };
          var s = cd.base + k * (shot.v - threatAt(u, cd.c) + (gw ? groundAt(u, cd.c, gw) : 0));
          // (a move must be worth its trouble: the same margin the utility AI asks)
          if (s > best.score + 0.3) best = { kind: 'move', c: cd.c, score: s };
        });
        return best;
      } finally { memo = null; }
    }

    /* ---- The commander ----
       Once a turn, for a side: which objectives it goes for — the scenario's need
       (two in Secure and control, the one in Find and secure, otherwise all) ranked
       by how near its force is, whether it holds them already and what enemy strength
       stands round them — and which of its units go to each, nearest first, until
       each has more worth than the enemy there; the rest where they are most needed.
       A unit's goal is then its assignment (ai.js pickGoal). */
    var NEAR = 9;
    function strengthNear(side, o, own) {
      var w = 0;
      E.state.units.forEach(function (f) {
        if (!f.alive || f.x < 0 || f.aboard || (own ? f.side !== side : f.side === side) || R.status(f) === 'broken') return;
        if (R.inches(f.x, f.y, o.x, o.y) <= NEAR) w += worthNow(f);
      });
      return w;
    }
    function orders(side, objs) {
      var c = E.state.cmdPlan = E.state.cmdPlan || {};
      var key = E.state.turn + '|' + E.state.units.filter(function (f) { return f.alive && f.x >= 0; }).length;
      if (c[side] && c[side].key === key) return c[side].by;
      var scen = E.state.cfg && E.state.cfg.scenario;
      var need = scen === 'secure' ? 2 : scen === 'find' ? 1 : objs.length;
      var mine = E.state.units.filter(function (f) {
        return f.alive && f.side === side && f.x >= 0 && !f.aboard && R.status(f) !== 'broken' && R.holdsGround(f) && !R.isFlying(f);
      });
      if (!mine.length) { c[side] = { key: key, by: {} }; return {}; }
      var ranked = objs.map(function (o, i) {
        var avg = mine.reduce(function (a, f) { return a + R.inches(f.x, f.y, o.x, o.y); }, 0) / mine.length;
        var enemy = strengthNear(side, o, false), ours = strengthNear(side, o, true);
        var pri = (o.owner === side ? 1.5 : 1) / (1 + enemy / (ours + 1)) / (1 + avg / 24);
        return { o: o, i: i, enemy: enemy, pri: pri, got: 0 };
      }).sort(function (a, b) { return b.pri - a.pri; }).slice(0, Math.max(1, need));
      var by = {};
      var free = mine.slice();
      // each chosen objective first gets strength enough to outweigh the enemy there, nearest units first
      ranked.forEach(function (r) {
        var want = r.enemy * 1.3 + 1;
        free.sort(function (a, b) { return R.inches(a.x, a.y, r.o.x, r.o.y) - R.inches(b.x, b.y, r.o.x, r.o.y); });
        while (free.length && r.got < want) { var f = free.shift(); by[f.id] = r.i; r.got += worthNow(f); }
      });
      // the rest go where the shortfall is greatest, or failing that the nearest chosen one
      free.forEach(function (f) {
        var bestR = null, bs = -Infinity;
        ranked.forEach(function (r) {
          var sc = (r.enemy * 1.3 + 1 - r.got) - R.inches(f.x, f.y, r.o.x, r.o.y) / 12;
          if (sc > bs) { bs = sc; bestR = r; }
        });
        if (bestR) { by[f.id] = bestR.i; bestR.got += worthNow(f); }
      });
      c[side] = { key: key, by: by };
      return by;
    }
    // the objective the commander gives this unit, or null (none to give, or none for it)
    function goalFor(u, objs) {
      if (!objs || !objs.length) return null;
      var i = orders(u.side, objs)[u.id];
      return i == null ? null : objs[i];
    }

    /* ---- What a position looks like, for the evaluation ----
       A side's standing as numbers, each its own less the enemy's: what it has left
       (worth, on the table or still to come, and as a share of what it began with;
       units left as a share, which a rout reads), how close to breaking (broken units,
       Stress against Morale), the ground (objectives held, progress to a win by
       holding), and the fire each can bring now and the losses each can expect.
       scripts/balance/evaldata.js records them through battles, and evalfit.js fits
       how they predict the winner. */
    var FEATURES = ['worth', 'worthShare', 'unitsShare', 'broken', 'stress', 'held', 'clock', 'fire', 'risk'];
    function sideNumbers(side) {
      var out = { worth: 0, start: 0, units: 0, units0: 0, broken: 0, stress: 0, n: 0, held: 0, clock: 0, fire: 0, risk: 0 };
      E.state.units.forEach(function (u) {
        if (u.side !== side || !R.countsForVictory(u)) return;
        out.units0++; out.start += tierValue(u);
        if (!u.alive || u.fled) return;
        out.units++;
        out.worth += worthNow(u);
        if (u.x < 0 || u.aboard) return;
        if (!R.isMachine(u)) {
          if (R.status(u) === 'broken') out.broken++;
          out.stress += Math.min(3, (u.sp || 0) / (R.currentMorale(u) || 1)); out.n++;
        }
        if (u.fp != null && R.status(u) !== 'broken') out.fire += bestShotFrom(u, { x: u.x, y: u.y }, 'fire').v;
        out.risk += threatAt(u, { x: u.x, y: u.y });
      });
      (E.state.objectives || []).forEach(function (o, i) {
        var h = SC.holderOf(E.state, o.x, o.y, 4, SC.areaOf(o));
        if (h === side) out.held++;
        var c = SC.holdClock ? SC.holdClock(E.state, i) : null;
        if (c && c.side === side) out.clock = Math.max(out.clock, c.n / (c.need || 1));
      });
      return out;
    }
    function features(side) {
      memo = {};
      try {
        var a = sideNumbers(side), b = sideNumbers(side === 'A' ? 'B' : 'A');
        var share = function (x, y) { return y ? x / y : 0; };
        return {
          worth: a.worth - b.worth,
          worthShare: share(a.worth, a.start) - share(b.worth, b.start),
          unitsShare: share(a.units, a.units0) - share(b.units, b.units0),
          broken: a.broken - b.broken,
          stress: share(a.stress, a.n) - share(b.stress, b.n),
          held: a.held - b.held,
          clock: a.clock - b.clock,
          fire: a.fire - b.fire,
          risk: a.risk - b.risk
        };
      } finally { memo = null; }
    }

    // the evaluation's log-odds for a side as the battle stands (its bias left out: it is the same for every option)
    function planValue(side) {
      var f = features(side), v = 0;
      Object.keys(EVAL).forEach(function (k) { v += EVAL[k] * (f[k] || 0); });
      return v;
    }
    // the best a unit's Fire! from where it stands does, in the evaluation's log-odds
    function deltaHere(u) {
      memo = {};
      try { return u.fp != null ? bestDeltaFrom(u, { x: u.x, y: u.y }, 'fire').v : 0; } finally { memo = null; }
    }
    return { planDeltaHere: deltaHere, planValue: planValue, planChoose: choose, planChooseEval: chooseByEval, planEvalWeights: EVAL, planWorth: worthNow, planThreat: threatAt, planShot: bestShotFrom, planGoal: goalFor,
      planFeatures: features, PLAN_FEATURES: FEATURES };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEnginePlanner;
})(typeof window !== 'undefined' ? window : global);
