/* PMC 2670 — Firefight : battles nobody watches.

   Between the player's battles the other forces on the world fight each other,
   and those battles are played out in full: the same engine, the same rules,
   the AI on both sides, on a table that is never drawn. Each force takes the
   field the way a rival does (C.pickForce); the battle's report is the one a
   played battle hands back, and the campaign's aftermath takes it from there.

   play() walks the battle an activation at a time in slices of a few
   milliseconds, handing the browser back between them, so the page stays alive
   while it runs; playNow() does it in one go (the tests, and node). */
(function (root) {
  'use strict';
  var R = root.PMC, C = root.PMCCamp, SC = root.PMCScen;
  var TACTICS = [null, 'laststand', 'wave', 'guerillas'];

  function pickArmy(co, tier, pl, tactic, scen) {
    var picks = C.pickForce(co, tier, pl, tactic, { scenario: scen });
    var keys = picks.map(function (e) { return R.entryPick(e); });
    return R.checkArmy(keys, tier, pl, co.doctrines || [], tactic).ok ? { picks: picks, keys: keys } : null;
  }

  /* Set a battle up between two companies: the Battle Tier the weaker can
     field, Priority Level 1, a scenario rolled as for any battle. Null if
     either force cannot put a legal army on the table even after hiring in. */
  function setUp(coA, coB, opts) {
    opts = opts || {};
    // the Battle Tier the weaker side can field near full strength (no army a third short)
    var fa = C.fullTier ? C.fullTier(coA, 1) : 0, fb = C.fullTier ? C.fullTier(coB, 1) : 0;
    var tier = Math.max(1, Math.min(coA.tier || 1, coB.tier || 1, fa || coA.tier || 1, fb || coB.tier || 1)), pl = 1;
    var tacA = coA.faction === 'rebel' ? TACTICS[Math.floor(Math.random() * TACTICS.length)] : null;
    var tacB = coB.faction === 'rebel' ? TACTICS[Math.floor(Math.random() * TACTICS.length)] : null;
    // (the scenario first: the forces are picked for it)
    var scen = SC && SC.ORDER ? SC.ORDER[Math.floor(Math.random() * SC.ORDER.length)] : 'meeting';
    var a = pickArmy(coA, tier, pl, tacA, scen), b = pickArmy(coB, tier, pl, tacB, scen);
    if (!a) { C.developRival(coA); a = pickArmy(coA, tier, pl, tacA, scen); }
    if (!b) { C.developRival(coB); b = pickArmy(coB, tier, pl, tacB, scen); }
    if (!a || !b) return null;
    return {
      tier: tier, pl: pl, scenario: scen,
      cfg: {
        tier: tier, pl: pl, scenario: scen,
        armyA: a.keys, armyB: b.keys, nameA: coA.name, nameB: coB.name,
        colourA: coA.colour || 'ochre', colourB: coB.colour || 'steel',
        dossier: { A: a.picks, B: b.picks },
        doctrines: { A: (coA.doctrines || []).slice(), B: (coB.doctrines || []).slice() },
        tactics: { A: tacA, B: tacB },
        campaign: true, mode: 'demo', planet: opts.planet || 'random'
      }
    };
  }

  /* One activation at a time: whatever the engine is waiting on (a list to
     keep, a zone to deploy in, a landing spot) is answered the way the AI would
     answer it, and otherwise the next activation is asked for. False when the
     battle is over or cannot go on. */
  function stepper(e) {
    var stuck = 0;
    return function () {
      if (e.over()) return false;
      var s = e.state();
      if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); return true; }
      if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); return true; }
      if (s.phase === 'deploy' || s.phase === 'terrain') {
        e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
        e.intent('A', { k: 'start' });
        return e.state().phase === 'battle' || ++stuck < 5;
      }
      var r = e.intent(s.activeSide || 'A', { k: 'step' });
      if (r.ok) { stuck = 0; return true; }
      var sel = e.sel();
      if (sel.insertion) {
        var sp = (sel.insertion.spots || [])[0];
        e.intent(sel.insertion.by || (sel.insertion.unit ? sel.insertion.unit.side : 'A'), sp ? { k: 'insert', x: sp.x, y: sp.y } : { k: 'holdinsert' });
        return true;
      }
      if (sel.reservePick) {
        var rp = sel.reservePick;
        rp.ids.slice(0, Math.max(rp.min, 1)).forEach(function (id) { e.intent(rp.side, { k: 'rpick', id: id }); });
        e.intent(rp.side, { k: 'rpickdone' });
        return true;
      }
      return ++stuck < 20;
    };
  }

  function finish(e, set) {
    if (!e.over()) return null;
    var rep = e.report();
    if (!rep) return null;
    rep.battleTier = set.tier; rep.pl = set.pl; rep.scenario = set.scenario;
    rep.turns = rep.turns || e.state().turn;
    rep.planet = e.state().cfg && e.state().cfg.planet;
    rep.text = e.state().over && e.state().over.text;
    return rep;
  }

  // the whole battle at once: the report, or null if it could not be fought
  function playNow(coA, coB, opts) {
    var set = setUp(coA, coB, opts);
    if (!set) return null;
    var e = root.PMCEngine.create();
    e.start(set.cfg);
    var step = stepper(e);
    for (var guard = 0; guard < 20000 && step(); guard++) { /* on to the end */ }
    return finish(e, set);
  }

  /* The same, a slice at a time: done(report or null) when it is over;
     progress(turn) now and then, for the page to show how far it has got. */
  function play(coA, coB, opts, done, progress) {
    var set = setUp(coA, coB, opts);
    if (!set) { setTimeout(function () { done(null); }, 0); return; }
    var e = root.PMCEngine.create();
    e.start(set.cfg);
    var step = stepper(e), guard = 0, SLICE = 12;
    (function slice() {
      var t0 = Date.now(), going = true;
      while (going && Date.now() - t0 < SLICE) { going = step() && guard++ < 20000; }
      if (progress) progress(e.state().turn || 0);
      if (going) setTimeout(slice, 0); else done(finish(e, set));
    })();
  }

  root.PMCOffTable = { play: play, playNow: playNow, setUp: setUp };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCOffTable;
})(typeof window !== 'undefined' ? window : global);
