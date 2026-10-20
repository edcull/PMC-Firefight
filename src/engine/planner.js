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
    var R = E.R, UR = E.UR;

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

    // a unit as it would stand at c: for the rules' sight, reach and cover to read
    function ghostAt(u, c) { return Object.assign({}, u, { x: c.x, y: c.y, bld: null }); }

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
        var v = cached('s|' + mode + '|' + t.id + '|' + half + '|' + (R.levelOf(E.state, g) > 0 ? 1 : 0), function () { return shotValue(g, t, mode); });
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
        var v = cached('t|' + e.id + '|' + cover + '|' + half, function () { return shotValue(e, g, 'fire'); });
        // how many of ours it has to choose from (this one at c, and the rest where they stand)
        var choices = cached('n|' + e.id, function () {
          return mine.filter(function (f) { return f !== u && R.canShoot(E.state, e, f, 'fire', {}); }).length;
        }) + 1;
        total += v / choices;
      });
      return total;
    }

    /* The choice, for a unit about to move or shoot: `cands` are the utility AI's best
       spots ({ c, base }, base its score without shots and sightlines), `here` its
       score where it stands. Each spot is worth its base plus, in the planner's
       currency, what it can shoot from there less what standing there costs it; Fire!
       from where it stands is weighed the same way. `k` turns worth into the utility
       AI's units (an inch of the way to the goal is 0.6). Returns { kind: 'fire', t },
       { kind: 'move', c } or { kind: 'hold' }. */
    function choose(u, cands, here, opts) {
      memo = {};
      try {
        var k = (opts && opts.k) || 2.5, canAdvance = !(opts && opts.noAdvance);
        var at = { x: u.x, y: u.y };
        var fireNow = u.fp != null ? bestShotFrom(u, at, 'fire') : { t: null, v: 0 };
        var riskHere = threatAt(u, at);
        var best = { kind: fireNow.t ? 'fire' : 'hold', t: fireNow.t, score: here + k * (fireNow.v - riskHere) };
        cands.forEach(function (cd) {
          var shot = canAdvance && u.fp != null ? bestShotFrom(u, cd.c, 'advance') : { v: 0 };
          var s = cd.base + k * (shot.v - threatAt(u, cd.c));
          // (a move must be worth its trouble: the same margin the utility AI asks)
          if (s > best.score + 0.3) best = { kind: 'move', c: cd.c, score: s };
        });
        return best;
      } finally { memo = null; }
    }

    return { planChoose: choose, planWorth: worthNow, planThreat: threatAt, planShot: bestShotFrom };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEnginePlanner;
})(typeof window !== 'undefined' ? window : global);
