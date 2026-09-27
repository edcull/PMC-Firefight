/* PMC 2670 — Firefight : the solitaire turn: whose unit goes next, and the OpFor's phase

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineSolo = function (E) {
    var eligible = E.eligible, focusUnit = E.focusUnit, logLine = E.logLine, maybeAI = E.maybeAI,
        paintStructures = E.paintStructures, pushRes = E.pushRes, rallyPhase = E.rallyPhase,
        render = E.render, reservePhase = E.reservePhase, revealBoard = E.revealBoard, stepOff = E.stepOff,
        ui = E.ui, whenIdle = E.whenIdle;

    /* ---- solitaire / cooperative turns (p. 146) ----
       Beginning, Reserve, Action (the players, alternating in a cooperative
       game), OpFor (every enemy unit, furthest from the players first), End. */
    function soloOwnerName(o) {
      var n = E.state.solo.names && E.state.solo.names[o - 1];
      return n || ('Player ' + o);
    }

    function soloEligible(owner) {
      ui.soloAll = true;                       // every player's units, not only the active one's
      try { return eligible('A').filter(function (u) { return !owner || (u.owner || 1) === owner; }); }
      finally { ui.soloAll = false; }
    }

    function soloBeginTurn() {
      E.state.turn += 1;
      E.state.units.forEach(function (u) {
        u.activated = false; u.marked = false; u.markMoved = false; u.shotFrom = []; u.coordUsed = false;
        u.hackUsed = false; u.hacked = false; u.supportUsed = false; u.advancing = false;
        u.disembarked = false; u.boarded = false;
      });
      E.state.chain = null; E.state.mark = null; E.state.remark = null;
      E.state.initiative = null;
      E.state.activeSide = 'A';
      E.state.activeOwner = E.state.solo.owners[0];
      E.state.streak = 99;
      logLine('turn', 'Turn ' + E.state.turn + ' — Beginning phase.');
      ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.vis = null; ui.visKey = ''; ui.preview = null;
      // the scenario's own business: counters revealed, OpFor steadied, civilians handed over
      var news = E.state.scen.beginning ? E.state.scen.beginning(E.state) || [] : [];
      news.forEach(function (l) {
        logLine('note', l.text);
        /* A counter turned over is shown getting up where it lay. The view keeps
           its own clock for that, so it is asked to draw it rather than handed a
           time stamp: the engine's Date.now() against the page's performance.now()
           left the unit "still arriving" for ever, and the whole replay with it. */
        if (l.unit) stepOff(l.unit, null);
      });
      paintStructures(); ui.vis = null; ui.visKey = '';
      pushRes({
        kind: 'Beginning phase', title: 'Turn ' + E.state.turn,
        note: E.state.scen.name + ' — the players act first, then the OpFor in a phase of its own.',
        list: news.length ? news.map(function (l) { return { text: l.text, side: l.unit ? 'B' : null }; }) : [{ text: 'Nothing new shows itself.' }]
      });
      var shown = news.filter(function (l) { return l.unit; })[0];
      if (shown) focusUnit(shown.unit, false, true);
      render();
      revealBoard();
      whenIdle(function () {
        reservePhase(function () {
          logLine('phase', 'Action phase — ' + (E.state.solo.coop ? soloOwnerName(E.state.activeOwner) + ' first.' : 'your commando.'));
          if (!soloEligible().length) { soloOpForPhase(); return; }
          render();
          maybeAI();
        });
      });
    }

    function soloOpForPhase() {
      E.state.activeSide = 'B';
      E.state.activeOwner = null;
      logLine('phase', 'OpFor phase.');
      pushRes({ kind: 'OpFor phase', title: 'Turn ' + E.state.turn + ' — the OpFor acts',
        note: 'Every enemy unit on the table activates, starting from the one furthest from your forces, and rolls on the behaviour table.' });
      render();
      if (!eligible('B').length) { rallyPhase(); return; }
      maybeAI();
    }

    // after any activation in a solitaire game: whose go is it now?
    function soloNext() {
      if (E.state.activeSide === 'A') {
        if (E.state.solo.coop) {
          var cur = E.state.activeOwner, o = E.state.solo.owners.filter(function (x) { return x !== cur; })[0];
          if (soloEligible(o).length) E.state.activeOwner = o;
          else if (!soloEligible(cur).length) { soloOpForPhase(); return; }
        } else if (!soloEligible().length) { soloOpForPhase(); return; }
        render(); maybeAI(); return;
      }
      if (eligible('B').length) { render(); maybeAI(); return; }
      rallyPhase();
    }

    return {
      soloOwnerName: soloOwnerName, soloBeginTurn: soloBeginTurn, soloNext: soloNext
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineSolo;
})(typeof window !== 'undefined' ? window : global);
