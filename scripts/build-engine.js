/* Assemble engine.js from game.js.

   The turn-structure functions are copied out verbatim — they carry the rules,
   and the rules are the tested part. What changes is only what they reach for
   when they want something drawn: those calls are rewritten to go through the
   view port, which on a server records an event and on a client draws. */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || '.';
const OUT = process.argv[3] || path.join(ROOT, 'src', 'engine', 'engine.js');
const src = fs.readFileSync(path.join(ROOT, 'src', 'view', 'game.js'), 'utf8').split('\n');

/* ---------- index game.js ---------- */
const { fns } = require('./index.js').index(src.join('\n'));

/* ---------- what moves ----------
   maybeAI and aiStep are deliberately absent: they paced the OpFor with timers,
   which a server has no use for, and they are rewritten below to drain the
   OpFor's activations in a flat loop instead. */
const MOVE = `
makeUnit newGame isAI terrainKnowledge docsOf moveBonus onTable activeUnits
zoneFor deployOK boxesFor pointInBox inReserve markReserves insertionLegal
scatterInsertion greetArrival autoDeploy clampY zoneCentre placingSide
deployRoster deployNext pickToDeploy nearestDeploySpot emptyPlatforms
seatPlatforms deploymentDone startBattle fortify reservePhase afterArrivals
lzWanted askLZ scenarioArrivals arrivalPoint arrivalLegal arrivalSpots aiInsert
insertionSpots askInsertion askArrival landArrival holdInsertion snapToSpot
placeInsertion arrivalWhere soloOwnerName soloEligible soloBeginTurn
soloOpForPhase soloNext beginTurn beginningRites unbroken streakFor other
sideName playerSide roleOf bestDefenceNote roleSentence deployWhere dedupeCodes
eligible endActivation rallyPhase rallyNext rallyCard repairCard endPhase
objDist scoreObjectives battleReport finish specialsFor spent demolishTargets
breachTargets actionState chooseAction doOnce doSabotage doCheckArea targetsFor
faceAlong crushAlong soloAfterMove scenarioMoveEnd forcedCharge doWave
bestWaveSpot aiCharge doMove doMarkMove doEmbark doRegain doSelfRepair
doTeleport finishTeleport aiPadFor doDisembark doStrafe resolveShot doShoot
doAssault doSupport doHack doDemolish doBreach minedFor doDetonate doStance
markReach markTargets markHint doDesignate commitMark clearMark canAnswerMark
markAnswerable aiDrive flightTurn aiTeleportPick aiRoll goalPoints
nearestObjective bestStrafe gapToFoes canStand expectedHits bestTarget
nearestEnemy aiAct fire pickGoal scoreSpot fromLog byId unitById carriersFor
boardableFor loadBefore unloadBefore snapshotAlive deathsSince
`.trim().split(/\s+/);

const missing = MOVE.filter((n) => !fns.has(n));
if (missing.length) { console.error('not found: ' + missing.join(', ')); process.exit(1); }

const taken = MOVE.map((n) => fns.get(n)).sort((a, b) => a.line - b.line);
let body = taken.map((f) => src.slice(f.top, f.end + 1).join('\n')).join('\n\n');

/* ---------- redirect what used to draw ---------- */
const PATCHES = [
  // the modules the browser hangs on window are arguments here
  [/window\.PMCGen/g, 'GEN'],
  [/window\.PMCSolo/g, 'SOLO'],

  // auto-advancing the result cards is the reader's preference, not the game's
  [/^\s*var stored = null;\n\s*try \{ stored = localStorage\.getItem\('pmc-autoadv'\); \} catch \(e\) \{ \}\n\s*ui\.autoAdvance = [^\n]*\n/m, ''],

  // colours: a name off a list, and the view is told to repaint the side
  [/cfg\.colour([ABC]) && ISO\.COLOURS\[cfg\.colour\1\]/g, 'cfg.colour$1 && COLOURS.indexOf(cfg.colour$1) >= 0'],
  [/ISO\.setSideColour\(/g, 'V.colour('],
  [/ISO\.flyLift\(/g, 'V.flyLift('],

  // clearing the card queue, laying out a fresh table, moving the camera
  [/^\s*resQueue\.length = 0; ui\.resOpen = false; el\('resolution'\)\.hidden = true;\n\s*clearTimeout\(ui\.resTimer\);\n\s*feedHosts\(\)[^\n]*\n\s*ui\.feedUnread = 0;\n/m, '    V.clearCards();\n'],
  [/^\s*sizeView\(false\);\n\s*var fit = ZOOMS\[0\];\n\s*cam\.z = [^\n]*\n\s*zoomLabel\(\);\n/m, '    V.newTable();\n'],
  [/^\s*setHome\(cam\.x, cam\.y\);\n/m, ''],
  [/^(\s*)else setTimeout\(revealConsole, 60\);\n/m, ''],
  [/ensureVisible\(u\)/g, 'focusUnit(u)'],

  // "bring the right panel to the front on a phone" has no meaning here
  [/^\s*if \(window\.innerWidth <= 1000\) setMTab\('act'\);\n/gm, ''],

  // a fingertip's worth of forgiveness, with no zoom to measure it against
  [/snapReach\(\)/g, 'SNAP_NEAR'],
  [/nowMs\(\)/g, 'Date.now()'],

  // the campaign is told the battle is over through the port like everything else
  [/if \(state\.cfg\.campaign && window\.PMC_ONFINISH\) \{\n\s*try \{ window\.PMC_ONFINISH\(state\.report\); \} catch \(e\) \{ \}\n\s*\}/m,
    'if (state.cfg.campaign) V.finished(state.report);'],

  /* Psychic Wave timed its own sound to land with the wave it was drawing. The
     effect carries its flight time, so the view makes that noise itself. */
  [/\s*setTimeout\(function \(\) \{\s*if \(!state\) return;\s*if \(SFX\) \{ SFX\.wave\(\);[^\n]*\s*\}, wait\);/m, ''],
];

PATCHES.forEach(([re, to]) => {
  const before = body;
  body = body.replace(re, to);
  if (before === body) console.error('PATCH DID NOT APPLY: ' + re);
});

/* ---------- the file ---------- */
const HEAD = `/* PMC 2670 — Firefight : the game itself.

   Every decision and every die roll lives here, and nothing in this file draws
   anything. It runs under node on the server, where it is the authority on what
   happened, and it runs in the browser too — behind a transport that loops back
   into the same process — so a solitaire game, a hotseat game and a game played
   across the world all go down exactly the same path.

   What used to be a call to redraw the table is now a call into the view port:
   on a server that records an event for the clients to replay, and in a browser
   it draws. The rules below are otherwise the ones game.js has always run.

   This was split out of game.js, which had grown to hold the turn structure
   and the isometric renderer in one closure and could therefore only run in a
   browser. scripts/build-engine.js is the tool that did the splitting, kept
   for the record; it has done its job and the file below is now the source.
   game.js is the view that sits on top of it. */
(function (root) {
  'use strict';
  var R = root.PMC, SC = root.PMCScen, GEN = root.PMCGen, C = root.PMCCamp, SOLO = root.PMCSolo;

  var COLOURS = ['ochre', 'steel', 'olive', 'crimson', 'slate', 'plum', 'sand', 'rust', 'jade', 'midnight'];
  var OBJECTIVES = [{ x: 12, y: 36 }, { x: 24, y: 24 }, { x: 36, y: 12 }];
  var STANDARD = [
    { id: 'move', label: 'Move' },
    { id: 'fire', label: 'Fire!' },
    { id: 'advance', label: 'Advance' },
    { id: 'assault', label: 'Assault' },
    { id: 'aux', label: 'Auxiliary' },
    { id: 'regroup', label: 'Regroup' }
  ];
  var SPECIAL_SLOTS = 4;
  /* How far off a legal spot a tap may land and still be taken to mean it. The
     client snaps to its own spot list before sending — it knows how far a
     fingertip is at the zoom it is drawn at — so this is only the check. */
  var SNAP_NEAR = 6;

  /* A view port that does nothing, so a caller that wants only the rules can
     leave it out. Every one of these is a thing the game used to draw. */
  function nullView() {
    return {
      log: function () { }, card: function () { }, fx: function () { },
      move: function () { }, shoot: function () { }, assault: function () { },
      strafe: function () { }, arrive: function () { }, sound: function () { },
      focus: function () { }, hint: function () { }, colour: function () { },
      terrain: function () { }, newTable: function () { }, clearCards: function () { },
      look: function () { }, finished: function () { }, changed: function () { },
      flyLift: function () { return 0; }
    };
  }

  function create(view) {
    var V = Object.assign(nullView(), view || {});
    var W = R.BOARD.w, H = R.BOARD.h, UR = R.UNIT_R;
    var state = null;

    /* The interaction the game itself cares about: who is selected, what action
       is being aimed, what it may legally be aimed at, and what the game is
       waiting on a player to answer. It is part of the battle, not of any one
       screen, so it goes out to both players and to anyone watching. */
    var ui = {
      mode: 'idle', selected: null, targets: [], moves: [], terrain: [],
      insertion: null, preview: null, deployPick: null, lastActed: null,
      markKind: null, markPicks: null, soloAll: false, hint: null
    };

    /* ---- the view port, as the rules below call it ---- */
    function logLine(t, text, math) {
      if (state) state.log.push({ t: t, text: text, math: math });
      V.log(t, text, math);
    }
    /* A result card used to sit on screen until the player pressed Continue,
       and the phase it belonged to carried on from the button. Nobody presses
       anything here: the card goes out as data and the game carries straight
       on, so a rally phase resolves in one go and the clients replay the cards
       at their own pace. \`onShow\` and \`onClose\` are the engine's own wiring
       and never leave the building. */
    function pushRes(card) {
      if (!card) return;
      var clean = {};
      Object.keys(card).forEach(function (k) {
        if (k !== 'onShow' && k !== 'onClose') clean[k] = card[k];
      });
      V.card(clean);
      if (card.onShow) card.onShow();
      if (card.onClose) card.onClose();
    }
    function addFx(f) { V.fx(f); }
    function animateMove(u, path, follow) { V.move(u, path, follow); }
    function playShooting(a, t, res, deaths, done) { V.shoot(a, t, res, deaths); if (done) done(); }
    function playAssault(a, t, deaths, done) { V.assault(a, t, deaths); if (done) done(); }
    function playStrafe(u, from, to, deaths, done) { V.strafe(u, from, to, deaths); if (done) done(); }
    function repaintTerrain(wrecks) { V.terrain(wrecks); }
    function showArrival(u) { V.arrive(u, 'walk'); }
    function landUnit(u) { V.arrive(u, 'drop'); greet(u); }
    function walkOn(u, start) { V.arrive(u, 'walk', start); greet(u); }
    function stepOff(u, veh) { V.arrive(u, 'stepoff', veh ? { x: veh.x, y: veh.y } : null); }
    function boardAnim(u, veh, from) { V.arrive(u, 'board', from); }
    function focusUnit(u) { V.focus(u); }
    function setHint(id, text) { ui.hint = text || null; V.hint(text || null); }
    function lookAtDeployment(side) { V.look(side || placingSide()); }
    function glowRGB() { return null; }
    function soundFor(entries) {
      (entries || []).forEach(function (l) {
        if (l.t === 'suppressed' || l.t === 'broken') V.sound(l.t);
      });
    }
    var SFX = {
      click: nil, step: nil, impact: nil, shell: nil, shot: nil, wave: nil,
      suppress: nil, broken: nil, chitter: nil, casualty: nil, shimmer: nil, chime: nil
    };
    function nil() { }
    /* Nothing is drawn, so nothing is ever mid-animation and nothing waits. */
    function render() { V.changed(); }
    function whenIdle(cb) { cb(); }
    function revealBoard() { }
    function revealConsole() { }
    function setMTab() { }
    function closeDrawer() { }
    function clearTimeout_() { }

    /* The free shot an arrival invites (p. 30). It used to be fired from inside
       the animation that put the unit down; here it is fired as the unit lands. */
    function greet(u) {
      if (!state || !u || !u.alive) return;
      var g = greetArrival(u);
      if (g) pushRes(fromLog('Hot landing zone', g.shooter.name + ' \\u2192 ' + u.name, g.shooter.side, g.res.log));
    }

    // a colour for the other side, out of whatever is left
    function foeColour(taken) {
      var left = COLOURS.filter(function (c) { return (taken || []).indexOf(c) < 0; });
      return left[Math.floor(Math.random() * left.length)] || 'steel';
    }

    /* ---- the OpFor, drained rather than paced ----
       The browser used to let the OpFor act on a timer so the player could watch
       it think. Here its whole turn resolves at once and the client replays it
       at whatever pace it likes. endActivation calls back into maybeAI, so the
       drain is guarded: the inner call returns and the loop below carries on,
       which keeps a long OpFor turn off the stack. */
    var draining = false;
    function canAI() {
      return !!state && !state.over && state.phase === 'battle' && !ui.insertion &&
        isAI(state.activeSide);
    }
    function maybeAI() {
      if (draining || !canAI()) return;
      draining = true;
      try {
        for (var guard = 0; canAI() && guard < 4000; guard++) if (!aiStep()) break;
      } finally { draining = false; }
    }
    function aiStep() {
      if (!state || state.over || !isAI(state.activeSide)) return false;
      var list = eligible(state.activeSide);
      if (!list.length) { endActivation(); return true; }
      if (state.solo && state.activeSide === 'B') {
        // the OpFor phase starts with the unit furthest from the players (p. 147)
        list.sort(function (a, b) { return gapToFoes(b) - gapToFoes(a); });
      } else list.sort(function (a, b) { return bestTarget(b).score - bestTarget(a).score; });
      var u = list[0];
      ui.selected = u; ui.mode = 'idle'; ui.moves = []; ui.targets = []; ui.preview = null;
      focusUnit(u);
      aiAct(u);
      return true;
    }

`;

const TAIL = `

    /* ================= what the outside world may ask for ================= */

    function sideOfSeat(seat) { return seat === 'B' ? 'B' : 'A'; }
    function idsOf(list) { return (list || []).map(function (u) { return u && u.id; }); }

    /* The battle, flattened. Unit-to-unit links become ids, the scenario's
       functions and the baked scenery are left out, and everything the client
       needs to draw the table is in what is left. */
    function snapshot() {
      if (!state) return null;
      var skip = { scen: 1, scene: 1, ground: 1, structs: 1, structsOpen: 1, props: 1, remains: 1, baking: 1, fireOnView: 1 };
      var out = {};
      Object.keys(state).forEach(function (k) {
        if (skip[k]) return;
        out[k] = state[k];
      });
      out.units = state.units.map(function (u) {
        var c = {};
        Object.keys(u).forEach(function (k) {
          if (k === 'cargo') { c.cargo = idsOf(u.cargo); return; }
          if (k === 'ax' || k === 'ay' || k === 'boarding' || k === 'arriveAt' || k === 'dropFrom') return;
          c[k] = u[k];
        });
        return c;
      });
      out.mark = state.mark ? {
        side: state.mark.side, kind: state.mark.kind, smoke: state.mark.smoke,
        targets: idsOf(state.mark.targets)
      } : null;
      out.mined = state.mined ? { side: state.mined.side, piece: state.terrain.indexOf(state.mined.piece) } : null;
      if (state.sc) {
        out.sc = Object.assign({}, state.sc);
        if (state.sc.search) {
          out.sc.search = state.sc.search.map(function (s) {
            var c = Object.assign({}, s);
            c.piece = s.piece ? state.terrain.indexOf(s.piece) : -1;
            return c;
          });
          out.sc.found = state.sc.found ? state.sc.search.indexOf(state.sc.found) : -1;
        }
      }
      out.ui = {
        mode: ui.mode,
        selected: ui.selected && ui.selected.id,
        targets: idsOf(ui.targets),
        moves: ui.moves.slice(),
        terrain: (ui.terrain || []).map(function (r) { return state.terrain.indexOf(r); }),
        deployPick: ui.deployPick,
        markKind: ui.markKind,
        markPicks: idsOf(ui.markPicks),
        hint: ui.hint,
        placing: state.phase === 'deploy' ? placingSide() : null,
        deployDone: state.phase === 'deploy' ? deploymentDone() : false,
        insertion: ui.insertion ? {
          unit: ui.insertion.unit && ui.insertion.unit.id,
          side: ui.insertion.unit ? ui.insertion.unit.side : 'A',
          owner: ui.insertion.owner || null,
          kind: ui.insertion.kind,
          spots: ui.insertion.spots
        } : null
      };
      return out;
    }

    /* The other direction, for a client mirroring a battle it is not running.
       Links are put back, and the scenario is looked up again by its id. */
    function load(snap) {
      if (!snap) { state = null; return; }
      state = snap;
      state.scen = SC.SCENARIOS[(snap.sc && snap.sc.id) || snap.cfg.scenario] || SC.SCENARIOS.secure;
      var by = {};
      state.units.forEach(function (u) { by[u.id] = u; });
      state.units.forEach(function (u) {
        u.cargo = (u.cargo || []).map(function (id) { return by[id]; }).filter(Boolean);
      });
      if (state.mark) {
        state.mark.targets = (state.mark.targets || []).map(function (id) { return by[id]; }).filter(Boolean);
      }
      if (state.mined && typeof state.mined.piece === 'number') {
        state.mined = state.terrain[state.mined.piece] ? { side: state.mined.side, piece: state.terrain[state.mined.piece] } : null;
      }
      if (state.sc && state.sc.search) {
        state.sc.search.forEach(function (s) { s.piece = s.piece >= 0 ? state.terrain[s.piece] : null; });
        state.sc.found = state.sc.found >= 0 ? state.sc.search[state.sc.found] : null;
      }
      var us = snap.ui || {};
      delete state.ui;
      ui.mode = us.mode || 'idle';
      ui.selected = by[us.selected] || null;
      ui.targets = (us.targets || []).map(function (id) { return by[id]; }).filter(Boolean);
      ui.moves = us.moves || [];
      ui.terrain = (us.terrain || []).map(function (i) { return state.terrain[i]; }).filter(Boolean);
      ui.deployPick = us.deployPick || null;
      ui.markKind = us.markKind || null;
      ui.markPicks = (us.markPicks || []).map(function (id) { return by[id]; }).filter(Boolean);
      ui.hint = us.hint || null;
      ui.insertion = us.insertion ? {
        unit: by[us.insertion.unit] || null, owner: us.insertion.owner,
        kind: us.insertion.kind, spots: us.insertion.spots, done: null
      } : null;
      return state;
    }

    /* ---- intents ----
       One entry for every way a player can touch the table. Each says who may
       send it and when; anything else comes back as a refusal rather than a
       silent no-op, so a client that is out of step is told so. */
    function no(why) { return { ok: false, why: why }; }
    var yes = { ok: true };

    function mayDeploy(side) {
      return state.phase === 'deploy' && placingSide() === side;
    }
    function mayAct(side) {
      if (state.phase !== 'battle' || state.over) return false;
      if (ui.insertion) return false;
      return state.activeSide === side;
    }
    function selected(side) {
      var u = ui.selected;
      return u && u.alive && u.side === side ? u : null;
    }
    function unitOf(id, side) {
      var u = byId(id);
      return u && u.alive && (!side || u.side === side) ? u : null;
    }
    function spotFrom(it) {
      var best = null, bd = Infinity;
      (ui.moves || []).forEach(function (c) {
        var d = R.inches(c.x, c.y, it.x, it.y);
        if (d < bd) { bd = d; best = c; }
      });
      return bd <= 1.2 ? best : null;
    }

    function intent(seat, it) {
      if (!state) return no('no battle');
      if (!it || typeof it.k !== 'string') return no('unreadable intent');
      var side = sideOfSeat(seat);
      if (state.over && it.k !== 'chat') return no('the battle is over');

      switch (it.k) {
        /* ---- choosing, which changes nothing on the table ---- */
        case 'select': {
          var u = unitOf(it.id);
          if (!u) return no('no such unit');
          if (!mayAct(side) && state.phase === 'battle') return no('not your activation');
          ui.selected = u; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
          ui.preview = null; ui.hint = null;
          focusUnit(u);
          return yes;
        }
        case 'action': {
          if (!mayAct(side)) return no('not your activation');
          var a = selected(side);
          if (!a) return no('nothing of yours is selected');
          if (!actionState(a, it.id).on) return no('that action is not available');
          chooseAction(it.id);
          return yes;
        }

        /* ---- deployment ---- */
        case 'deploypick': {
          if (!mayDeploy(side)) return no('not your turn to place');
          var p = unitOf(it.id, side);
          if (!p) return no('no such unit');
          pickToDeploy(p.id);
          return yes;
        }
        case 'deploy': {
          if (!mayDeploy(side)) return no('not your turn to place');
          return deployAt(side, it);
        }
        case 'autodeploy': {
          if (state.phase !== 'deploy') return no('not deploying');
          autoDeploy(side);
          render();
          return yes;
        }
        case 'load': {
          if (state.phase !== 'deploy') return no('not deploying');
          var hull = unitOf(it.hull, side), rider = unitOf(it.unit, side);
          if (!hull || !rider) return no('no such unit');
          if (!loadBefore(hull, rider)) return no('there is no room aboard');
          render();
          return yes;
        }
        case 'unload': {
          if (state.phase !== 'deploy') return no('not deploying');
          var uh = unitOf(it.hull, side), ur = unitOf(it.unit, side);
          if (!uh || !ur) return no('no such unit');
          unloadBefore(uh, ur);
          render();
          return yes;
        }
        case 'start': {
          if (state.phase !== 'deploy') return no('already under way');
          if (!deploymentDone()) return no('there are still units to place');
          startBattle();
          return yes;
        }

        /* ---- a unit coming in ---- */
        case 'insert': {
          if (!ui.insertion) return no('nothing is coming in');
          if (insertionSide() !== side) return no('that is not your unit');
          placeInsertion({ x: +it.x, y: +it.y });
          return yes;
        }
        case 'holdinsert': {
          if (!ui.insertion || ui.insertion.kind !== 'insert') return no('nothing to hold back');
          if (insertionSide() !== side) return no('that is not your unit');
          holdInsertion();
          return yes;
        }

        /* ---- acting ---- */
        case 'move': case 'advance': case 'markmove': case 'wave':
        case 'disembark': case 'strafe': {
          if (!mayAct(side) || !selected(side)) return no('not your activation');
          var spot = spotFrom(it);
          if (!spot) return no('that is out of reach');
          if (it.k === 'markmove') doMarkMove(spot);
          else if (it.k === 'wave') doWave(ui.selected, spot);
          else if (it.k === 'disembark') doDisembark(spot);
          else if (it.k === 'strafe') doStrafe(spot);
          else doMove(spot);
          return yes;
        }
        case 'target': {
          if (!mayAct(side) || !selected(side)) return no('not your activation');
          var t = byId(it.id);
          if (!t || ui.targets.indexOf(t) < 0) return no('not a legal target');
          if (ui.mode === 'assault') doAssault(t);
          else if (ui.mode === 'designate') doDesignate(t);
          else if (ui.mode === 'embark') doEmbark(t);
          else if (ui.mode === 'teleport') doTeleport(ui.selected, t);
          else if (ui.mode === 'teleport-dest') finishTeleport(ui.teleport, t);
          else if (ui.mode === 'hack') doHack(t);
          else if (ui.mode === 'support') doSupport(t);
          else doShoot(t);
          return yes;
        }
        case 'piece': {
          if (!mayAct(side) || !selected(side)) return no('not your activation');
          var r = state.terrain[it.i];
          if (!r || ui.terrain.indexOf(r) < 0) return no('not a legal piece');
          if (ui.mode === 'breach') doBreach(r); else doDemolish(r);
          return yes;
        }
        case 'cancel': {
          if (!mayAct(side)) return no('not your activation');
          ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.preview = null;
          render();
          return yes;
        }
        default:
          return no('unknown intent: ' + it.k);
      }
    }

    function insertionSide() {
      var ins = ui.insertion;
      if (!ins) return null;
      if (ins.unit) return ins.unit.side;
      return 'A';                      // a landing zone is always the players' own
    }

    /* Putting a unit down before the battle. A tap that misses the strip by a
       little is pulled onto it, exactly as it is on one screen. */
    function deployAt(side, it) {
      var pending = it.id ? byId(it.id) : deployNext();
      if (!pending || pending.side !== side) return no('no such unit');
      if (pending.x < 0 && deployNext() !== pending) ui.deployPick = pending.id;
      var p = { x: +it.x, y: +it.y };
      var clear = deployOK(side, p.x, p.y, pending) &&
        !R.TERRAIN[R.terrainAt(state, p.x, p.y)].impassable &&
        !R.unitNear(state, p.x, p.y, pending, 1);
      if (!clear) {
        var near = nearestDeploySpot(pending, p.x, p.y, 9);
        if (!near) return no('outside your deployment area');
        p = near;
      }
      pending.x = p.x; pending.y = p.y;
      ui.deployPick = null;
      render();
      return yes;
    }

    /* ---- starting ---- */
    function start(cfg) {
      newGame(cfg);
      return state;
    }

    return {
      start: start,
      intent: intent,
      snapshot: snapshot,
      load: load,
      state: function () { return state; },
      sel: function () { return ui; },
      over: function () { return state && state.over; },
      report: function () { return state && state.report; },
      /* Queries a client runs over a battle it is only watching: what a unit may
         do, where it may go, what it may shoot. None of them roll a die or
         change anything, so both sides can ask freely. */
      query: {
        actionState: function (u, id) { return actionState(u, id); },
        specialsFor: function (u) { return specialsFor(u); },
        targetsFor: function (u, o) { return targetsFor(u, o); },
        eligible: function (s) { return eligible(s); },
        deployOK: function (s, x, y, u) { return deployOK(s, x, y, u); },
        deployNext: deployNext,
        deployRoster: deployRoster,
        deploymentDone: deploymentDone,
        placingSide: placingSide,
        zoneFor: zoneFor,
        zoneCentre: zoneCentre,
        boxesFor: boxesFor,
        nearestDeploySpot: nearestDeploySpot,
        deployWhere: deployWhere,
        roleOf: roleOf,
        roleSentence: roleSentence,
        arrivalWhere: arrivalWhere,
        markHint: markHint,
        markReach: markReach,
        canStand: canStand,
        moveBonus: moveBonus,
        demolishTargets: demolishTargets,
        breachTargets: breachTargets,
        activeUnits: activeUnits,
        onTable: onTable,
        byId: byId,
        sideName: sideName,
        other: other,
        carriersFor: carriersFor,
        boardableFor: boardableFor,
        emptyPlatforms: emptyPlatforms,
        forcedCharge: forcedCharge,
        snapToSpot: snapToSpot,
        insertionLegal: insertionLegal,
        arrivalLegal: arrivalLegal
      },
      STANDARD: STANDARD,
      SPECIAL_SLOTS: SPECIAL_SLOTS
    };
  }

  root.PMCEngine = { create: create, STANDARD: STANDARD, SPECIAL_SLOTS: SPECIAL_SLOTS, COLOURS: COLOURS, OBJECTIVES: OBJECTIVES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngine;
})(typeof window !== 'undefined' ? window : global);
`;

fs.writeFileSync(OUT, HEAD + body + TAIL);
console.error('engine.js: ' + (HEAD + body + TAIL).split('\n').length + ' lines from ' + taken.length + ' functions');
