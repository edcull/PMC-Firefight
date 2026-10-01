/* PMC 2670 — Firefight : the game itself.

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
   browser; game.js is the view that sits on top of it. Most of the game has
   since moved into the files beside this one in src/engine/ (deployment,
   arrivals, actions, moves, combat, the end of the turn, saving, the OpFor
   and the rest), each a kit made by create() with one shared context and
   giving back its functions into the registry K (see makeKits below). What
   stays here is the battle's state, the view port, the setup, and intent():
   every command from a player or the network comes in there, and is handed to
   the handler registered under its name (on(), below). */
(function (root) {
  'use strict';
  var R = root.PMC, SC = root.PMCScen, GEN = root.PMCGen, C = root.PMCCamp, SOLO = root.PMCSolo;

  // the one list of colours, shared with the server (protocol.js)
  var COLOURS = root.PMCProto.COLOURS;
  var OBJECTIVES = [{ x: 12, y: 36 }, { x: 24, y: 24 }, { x: 36, y: 12 }];
  var STANDARD = [
    { id: 'move', label: 'Move' },
    { id: 'fire', label: 'Fire!' },
    { id: 'advance', label: 'Advance' },
    { id: 'assault', label: 'Assault' },
    { id: 'aux', label: 'Auxiliary' },
    { id: 'regroup', label: 'Regroup' },
    // doing nothing at all: the activation spent, play passing on
    { id: 'skip', label: 'Skip' }
  ];
  var SPECIAL_SLOTS = 4;
  /* How far off a legal spot a tap may land and still be taken to mean it. The
     client snaps to its own spot list before sending — it knows how far a
     fingertip is at the zoom it is drawn at — so this is only the check. */
  var SNAP_NEAR = 6;
  // what each kind of terrain piece is called, one and many
  var PIECE_NOUN = {
    woods: ['wood', 'woods'], ruins: ['ruin', 'ruins'], crater: ['rubble area', 'rubble areas'],
    barricade: ['low wall', 'low walls'], rocks: ['rock', 'rocks'], hill: ['hill', 'hills'],
    building: ['building', 'buildings'], bunker: ['reinforced building', 'reinforced buildings'],
    wall: ['high wall', 'high walls'], water: ['shallow pool', 'shallow pools'],
    deep: ['deep water', 'deep waters'], lava: ['lava field', 'lava fields'],
    crystal: ['crystal field', 'crystal fields'], ravine: ['ice ravine', 'ice ravines']
  };

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
      scenery: function () { }, fit: function () { }, structures: function () { },
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
       at their own pace. `onShow` and `onClose` are the engine's own wiring
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
    /* How a scenario reinforcement comes on. The Invasion attacker is coming
       down from orbit, so it lands the way a Battlefield Insertion does — out of
       the sky; a solitaire scenario may say a drop, or a walk from a particular
       spot; everyone else walks on from its own table edge. Either way it can
       draw the free shot an arrival within 12" invites (p. 30), which landUnit
       and walkOn both fire. (A stand-in here used to say "walk" for everyone
       and skip that shot; this is the decision game.js always made.) */
    function showArrival(u) {
      if (state.scen.id === 'invasion' && state.sc && u.side === state.sc.attacker) { landUnit(u); return; }
      var how = state.scen.arriveHow ? state.scen.arriveHow(state, u) : null;
      if (how === 'drop') { landUnit(u); return; }
      walkOn(u, how && how.x != null ? how : null);
    }
    /* A unit coming down on its landing point. The Invasion attacker is coming
       down from orbit, so everything it lands — squads included, which would
       otherwise be shown getting up off the ground — falls out of the sky the
       way a hull does. */
    function landUnit(u) {
      if (K.faces(u)) u.facing = K.faceDefault(u);
      var orbit = state.scen.id === 'invasion' && state.sc && u.side === state.sc.attacker;
      V.arrive(u, orbit ? 'orbital' : 'drop');
      greet(u);
    }
    function walkOn(u, start) { V.arrive(u, 'walk', start); greet(u); }
    /* Coming off a hull, or climbing aboard one: which hull matters to the
       view, because a squad drops out of an aircraft and walks out of a truck. */
    function stepOff(u, veh) { V.arrive(u, 'stepoff', veh ? { x: veh.x, y: veh.y } : null, veh); }
    function boardAnim(u, veh, from) { V.arrive(u, 'board', from, veh); }
    function focusUnit(u) { V.focus(u); }
    function setHint(id, text) { ui.hint = text || null; V.hint(text || null); }
    function lookAtDeployment(side) { V.look(side || K.placingSide()); }
    /* A piece has gone down during the terrain set-up. Re-baking the scenery
       is the view's business, and it paces that itself. */
    function queueBake() { V.scenery(); }
    /* Two more things the rules asked of the screen directly: show the whole
       table (a landing zone is being chosen), and repaint the structures (a
       searched location has its stake and beacon). Both are the view's. */
    function fitView() { V.fit(); }
    function paintStructures() { V.structures(); }
    // xenotech glows the blue game.js draws it in: teleports, repairs, the tribe's waves
    var XENO_GLOW = '110,190,255';
    function glowRGB() { return XENO_GLOW; }
    function soundFor(entries) {
      (entries || []).forEach(function (l) {
        if (l.t === 'suppressed') V.sound('suppress');
        else if (l.t === 'broken') V.sound('broken');
      });
    }
    /* The sounds the rules ask for as they happen — a teleport's shimmer, the
       swarm's chitter as the Endless Tide digs bugs back out, a squad's boots
       going into a building. Nothing plays here; each is passed to the view by
       name, with whatever it was given, and the view makes the noise. The
       animations make their own sounds besides: these are only the ones the
       rules themselves called for. */
    var SFX = {};
    ['click', 'step', 'impact', 'shell', 'shot', 'wave', 'suppress', 'broken',
      'chitter', 'casualty', 'shimmer', 'chime'].forEach(function (name) {
      SFX[name] = function () { V.sound(name, Array.prototype.slice.call(arguments)); };
    });
    /* Nothing is drawn, so nothing is ever mid-animation and nothing waits. */
    function render() { syncMen(); returnToPool(); syncMen(); V.changed(); }
    /* The named men caught up with the model counts, after every step: whoever
       the rules just took off the table is picked out as a casualty and marked
       with the turn it happened. Done before a unit goes back to the OpFor pool, so the
       men it lost are counted before it comes on again at full strength. */
    function syncMen() {
      if (!state || !state.units) return;
      state.namesTaken = state.namesTaken || {};
      state.units.forEach(function (u) { R.syncMen(u, state.turn, state.namesTaken); });
    }
    /* Protecting the VIP, Evacuation: "when an OpFor unit is destroyed, it
       returns to the pool" (pp. 151, 154) — at full strength, to come on again.
       This used to be done while the board was being redrawn, which is why it
       is checked at every point the game used to ask for a redraw. */
    function returnToPool() {
      if (!state || !state.scen || !state.scen.returnsToPool || state.over) return;
      state.units.forEach(function (u) {
        if (u.alive || u.side !== 'B') return;
        u.alive = true; u.fled = false; u.wipedOut = false; u._wrecked = false; u.wreckLoS = false;
        u.models = u.startSize || u.size; u.sp = 0; u.damage = 0; u.cargo = [];
        u.reserve = true; u.wave = 'pool'; u.x = -1; u.y = -1; u.activated = true;
        u.bld = null; u.sec = null;
        u.returned = (u.returned || 0) + 1;
        logLine('note', u.label + ' goes back into the OpFor pool.');
      });
    }
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
      var g = K.greetArrival(u);
      if (g) pushRes(K.fromLog('Hot landing zone', g.shooter.name + ' \u2192 ' + u.name, g.shooter.side, g.res.log));
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
    /* A demo has an AI on both sides, so a drain would play the whole battle
       out before the screen saw any of it. There it goes one activation at a
       time and waits to be asked for the next, which is what paces a game
       nobody is playing. */
    var draining = false, paced = false;
    function canAI() {
      /* An answer owed holds the AI: a player's Martyrdom answer holds its charge,
         and a Last Stand asked for, or the End phase asking a player to carry on
         or surrender, hold it as well — with nothing left to act, a step taken
         then would end the turn again and run the whole Rally phase once more. */
      return !!state && !state.over && state.phase === 'battle' && !ui.insertion &&
        !state.martyrAsk && !state.kyfAsk && !state.faceAsk && !state.standAsk && !state.endAsk && isAI(state.activeSide);
    }
    function maybeAI() {
      if (draining || !canAI()) return;
      draining = true;
      try {
        if (paced) { aiStep(); return; }
        for (var guard = 0; canAI() && guard < 4000; guard++) if (!aiStep()) break;
      } finally { draining = false; }
    }
    function aiStep() {
      if (!state || state.over || !isAI(state.activeSide) || state.martyrAsk) return false;
      K.aiStands(state.activeSide);
      var list = eligible(state.activeSide);
      if (!list.length) { endActivation(); return true; }
      if (state.solo && state.activeSide === 'B') {
        // the OpFor phase starts with the unit furthest from the players (p. 147)
        list.sort(function (a, b) { return K.gapToFoes(b) - K.gapToFoes(a); });
      } else list.sort(function (a, b) { return K.bestTarget(b).score - K.bestTarget(a).score; });
      var u = list[0];
      ui.selected = u; ui.mode = 'idle'; ui.moves = []; ui.targets = []; ui.preview = null;
      focusUnit(u);
      K.aiAct(u);
      return true;
    }

  /* ================= setup ================= */
  function makeUnit(p, side, i, prop, drone, entry, riders) {
    var u = R.applyRiders(R.applyDrone(R.applyPropulsion({
      id: side + i, side: side, code: p.code, art: p.art || 'rifle', name: p.name,
      label: p.name + ' [' + side + ']',
      tier: p.tier, size: p.size, models: p.size,
      move: p.move, fp: p.fp, range: p.range, def: p.def, defPierced: p.defPierced,
      assault: p.assault, morale: p.morale, group: p.group, key: p.key,
      faction: p.faction || 'pmc',
      tactic: (state && state.tactics && state.tactics[side]) || null,
      cls: p.cls || 'infantry', str: p.str, turn: p.turn, transport: p.transport, command: !!p.command,
      jets: !!p.jets,
      cargo: [], damage: 0, aboard: null, disembarked: false,
      facing: side === 'A' ? 0 : Math.PI,
      rules: p.rules.slice(), x: -1, y: -1, sp: 0, alive: true, activated: false,
      marked: false, shotFrom: [], coordUsed: false, hackUsed: false, drone: false,
      supportUsed: false
    }, prop), drone), riders);
    /* Guerillas (p. 95): every insurgent on foot knows the tunnels. Riders do not
       fit down them, so they are left out. */
    if (u.tactic === 'guerillas' && u.cls === 'infantry' && !R.has(u, 'Riders')) {
      ['Stealth', 'Battlefield Insertion'].forEach(function (r) {
        if (u.rules.indexOf(r) < 0) u.rules.push(r);
      });
    }
    // a campaign unit carries its dossier on its back: name, honours, traumas, upgrades
    if (entry && C) C.applyEntry(u, entry, state && state.doctrines ? state.doctrines[side] : null);
    return u;
  }

  function newGame(cfg) {
    /* The world is settled here, once: a random one picked, and a barren one
       made desert or arctic. Everything after — the table, the look of it on
       every screen — reads the one name this leaves in the config. */
    cfg.planet = GEN.resolvePlanet(cfg.planet, Math.random);
    var scenId = cfg.scenario && SC.SCENARIOS[cfg.scenario] ? cfg.scenario : 'secure';
    // a solitaire / cooperative game only runs the solitaire scenarios, and they only run in one
    if (cfg.solo && !(SC.SCENARIOS[scenId] || {}).solo) scenId = 's_crush';
    if (!cfg.solo && (SC.SCENARIOS[scenId] || {}).solo) scenId = 'secure';
    /* Terrain set-up (pp. 46-47): either the generator lays the whole table, or
       the players take the four areas in turn, roll for each and put the pieces
       down themselves. A demo is always generated. */
    var manual = K.wantsManualTerrain(cfg);
    var built = manual
      ? { terrain: [], rolls: [], generator: GEN.tableFor(cfg.planet).name }
      : GEN.generate({
        width: W, height: H, planet: cfg.planet,
        objectives: OBJECTIVES              // keeps the generator's clearings roughly central
      });
    state = {
      cfg: cfg,
      terrain: built.terrain,
      genCount: built.terrain.length,
      // nothing is nominated until the table is set (the scenario places them)
      objectives: manual ? [] : OBJECTIVES.map(function (o) { return { x: o.x, y: o.y, owner: null }; }),
      units: [], turn: 0, phase: 'deploy', activeSide: 'A', initiative: null,
      streak: 0, chain: null, rush: null, log: [], over: null,
      campaign: cfg.campaign || null,
      doctrines: cfg.doctrines || null,
      // "Rebel forces cannot use tactics" in a solitaire or cooperative game (p. 145)
      tactics: cfg.solo ? { A: null, B: null } : cfg.tactics || { A: null, B: null },
      routed: { A: false, B: false },
      seed: (Math.random() * 100000) | 0,
      /* Solitaire / cooperative (pp. 146-156): one or two players against an
         OpFor run by the behaviour table in a phase of its own. */
      solo: cfg.solo ? {
        coop: !!cfg.solo.coop, owners: cfg.solo.coop ? [1, 2] : [1],
        faction: cfg.solo.faction || 'pmc', opFaction: cfg.solo.opFaction || 'pmc',
        names: cfg.solo.names || ['Player 1', 'Player 2']
      } : null
    };
    state.cfg.aiSides = cfg.mode === 'demo' ? ['A', 'B'] : cfg.mode === 'ai' ? ['B'] : [];
    paced = state.cfg.aiSides.length === 2;
    state.cfg.scenario = scenId;
    // results wait for Continue unless the player has asked for auto-advance;
    // a hands-off demo starts with it on
    ['A', 'B'].forEach(function (side) {
      var keys = side === 'A' ? cfg.armyA : cfg.armyB;
      var roster = cfg.dossier ? cfg.dossier[side] : null;   // campaign entries, in list order
      keys.forEach(function (k, i) {
        var pick = R.splitPick(k);
        var entry = roster ? roster[i] : null;
        var prof = R.profile(pick.key);
        /* A Xenotripod turret set is one pick, but every turret in it stands on
           the table as a unit of its own, and counts as a Tier I unit for victory
           and the scenario (p. 130). */
        if (prof.turretSet) {
          for (var ts = 0; ts < prof.turretSet; ts++) {
            var tu = makeUnit(prof, side, i + 't' + ts, null, false, null, false);
            tu.name = /Teleport/.test(prof.name) ? 'Teleport turret' : 'Defensive turret';
            tu.label = tu.name + ' [' + side + ']';
            tu.tier = 1; tu.setTier = prof.tier; tu.drone = true;
            // Low-spectrum Cloaking (p. 142): every Teleport turret goes Stealth
            if (R.has(tu, 'Teleport') && docsOf(side).indexOf('XT4') >= 0) tu.rules.push('Stealth');
            tu.startSize = tu.models;
            state.units.push(tu);
          }
          return;
        }
        var u = makeUnit(prof, side, i, pick.prop || R.defaultDrive(prof), pick.drone, entry, pick.riders);
        u.pickIdx = i;                                     // its place in the list, for Modifying the armies
        if (R.has(u, 'Turret')) u.drone = true;             // a lone shield turret is Drone Controlled too
        if (R.canMount(prof, pick.riders)) R.applyMount(u, pick.mount || 'none');   // what it rides, and what that costs
        u.startSize = u.models;
        // in a cooperative game each player has a commando of their own
        if (state.solo && side === 'A') {
          u.owner = (cfg.ownersA && cfg.ownersA[i]) || 1;
          if (u.owner === 2) u.paint = 'C';
        }
        state.units.push(u);
      });
    });
    /* Complex Teleport Network (p. 141): a free set of Teleport turrets a
       Priority Level, of the Battle Tier — the sets run from Tier II to IV. */
    ['A', 'B'].forEach(function (side) {
      if (docsOf(side).indexOf('XO1') < 0) return;
      var tt = Math.max(2, Math.min(4, cfg.tier || 1)), tprof = R.profile('xtturret' + tt);
      for (var np = 0; np < (cfg.pl || 1); np++) {
        for (var ts2 = 0; ts2 < tprof.turretSet; ts2++) {
          var fu = makeUnit(tprof, side, 'net' + np + 't' + ts2, null, false, null, false);
          fu.name = 'Teleport turret'; fu.label = fu.name + ' [' + side + ']';
          fu.tier = 1; fu.setTier = tprof.tier; fu.drone = true; fu.startSize = fu.models; fu.free = true;
          if (docsOf(side).indexOf('XT4') >= 0) fu.rules.push('Stealth');
          state.units.push(fu);
        }
      }
      logLine('note', sideName(side) + ' — Complex Teleport Network: a free set of ' + tprof.turretSet + ' Teleport turrets' + ((cfg.pl || 1) > 1 ? ' a Priority Level' : '') + '.');
    });
    /* Mimicry (p. 124), and the tribe's Underground Advance (p. 141): up to a
       quarter of the force — rounded up, as every division is (p. 27) — may be
       held back and come in by Battlefield Insertion, on top of the units that
       have the rule of their own. A player chooses which: every infantry unit is
       offered the rule, and no more than the quarter may be held for it (u.mimic,
       state.mimicCap). The AI takes the first quarter. */
    state.mimicCap = {};
    ['A', 'B'].forEach(function (side) {
      var docs = (state.doctrines && state.doctrines[side]) || [];
      if (docs.indexOf('BB2') < 0 && docs.indexOf('XO2') < 0) return;
      var mine = state.units.filter(function (u) { return u.side === side; });
      var cap = Math.ceil(mine.length / 4);
      var able = mine.filter(function (u) {
        return u.cls === 'infantry' && !R.has(u, 'Battlefield Insertion') && !R.has(u, 'Overmind') && !R.has(u, 'Dominant Species');
      });
      if (isAI(side)) { able.slice(0, cap).forEach(function (u) { u.rules.push('Battlefield Insertion'); }); return; }
      state.mimicCap[side] = cap;
      able.forEach(function (u) { u.rules.push('Battlefield Insertion'); u.mimic = true; });
    });
    /* A solitaire scenario can bring units of its own: a VIP and bodyguard,
       civilians and militia to protect, the enemy leaders to kill. */
    var soloScen = SC.SCENARIOS[scenId];
    if (state.solo && soloScen.extraUnits) {
      soloScen.extraUnits(state).forEach(function (x) {
        var u = makeUnit(x.profile, x.side, state.units.length, null, false, null, false);
        u.startSize = u.models;
        if (x.side === 'A') { u.owner = x.owner || 1; if (u.owner === 2) u.paint = 'C'; }
        if (x.vip) u.vip = true;
        if (x.civ) u.soloCiv = true;
        if (x.militia) u.soloMilitia = true;
        if (x.leader) u.soloLeader = true;
        u.extra = true;
        state.units.push(u);
      });
    }
    dedupeCodes();
    /* Every soldier gets a name and a rank. A campaign unit brings its own
       survivors from the dossier; the gaps, and every other unit, are filled
       with fresh names, none repeated on the table. */
    state.namesTaken = {};
    state.units.forEach(function (u) { R.musterMen(u, u.camp && u.camp.men, state.namesTaken); });
    /* Paint the two companies. A colour the caller did not name is rolled from
       whatever the other side is not already wearing. */
    var ca = cfg.colourA && COLOURS.indexOf(cfg.colourA) >= 0 ? cfg.colourA : 'ochre';
    var cb = cfg.colourB && COLOURS.indexOf(cfg.colourB) >= 0 && cfg.colourB !== ca
      ? cfg.colourB : foeColour([ca]);
    state.cfg.colourA = ca; state.cfg.colourB = cb;
    V.colour('A', ca);
    V.colour('B', cb);
    // the second player in a cooperative game wears a third colour
    if (state.solo && state.solo.coop) {
      var cc = cfg.colourC && COLOURS.indexOf(cfg.colourC) >= 0 && cfg.colourC !== ca && cfg.colourC !== cb
        ? cfg.colourC : foeColour([ca, cb]);
      state.cfg.colourC = cc;
      V.colour('C', cc);
    }
    // the scenario, provisionally: the terrain phase wants its name and whether it has table edges
    state.scen = SC.SCENARIOS[scenId];
    state.sc = { id: scenId };
    /* When the commandos bring hulls or aircraft the OpFor needs a unit that can
       answer them (p. 148). Where its list has none at this Tier, say so rather
       than let it pass unremarked. */
    if (state.solo) {
      var theirMachines = state.units.some(function (u) { return u.side === 'A' && R.isMachine(u); });
      var answer = state.units.some(function (u) {
        if (u.side !== 'B') return false;
        if (u.rules.some(function (r) { return /^Anti-tank|^Anti-aircraft/.test(r); })) return true;
        return R.isMachine(u) && u.tier >= cfg.tier;
      });
      if (theirMachines && !answer) {
        logLine('note', 'The OpFor has nothing to answer your vehicles: its list offers no Anti-tank, Anti-aircraft ' +
          'or Tier ' + R.ROMAN[cfg.tier] + ' machine to take (p. 148).');
      }
    }
    V.clearCards();
    if (manual) { K.startTerrainSetup(built); return; }
    afterTerrain(built);
  }

  /* Everything that needs the table laid: the scenario's own terrain changes,
     the deployment, and the opening cards. */
  function afterTerrain(built) {
    var cfg = state.cfg, scenId = cfg.scenario;
    /* Terrorist (p. 112): a destructible piece other than the mission objective
       is quietly mined before deployment. Only the side that walked that Path
       knows which one — and only its leaders can set it off. */
    (function () {
      var docs = state.doctrines || {};
      ['A', 'B'].forEach(function (side) {
        if ((docs[side] || []).indexOf('V3') < 0) return;
        var pool = state.terrain.filter(function (r) {
          var t = R.TERRAIN[r.kind];
          return t.destructible && t.destructible !== 'target' && t.destructible !== 'wire';
        });
        if (!pool.length) return;
        state.mined = { side: side, piece: pool[Math.floor(Math.random() * pool.length)] };
      });
    })();
    // a player's Last Stand barricades are placed by hand, once the deployment zones are known
    state.manualLaststand = {};
    ['A', 'B'].forEach(function (sd) { if (state.tactics && state.tactics[sd] === 'laststand' && !isAI(sd)) state.manualLaststand[sd] = true; });
    // and so is a player's own position in Hostile takeover (p. 55)
    state.manualForts = { A: !isAI('A'), B: !isAI('B') };
    SC.begin(state, scenId, { attacker: cfg.attacker, roles: cfg.roles });
    // the scenario may have moved or dropped pieces to keep them apart; a mined one must still be there
    if (state.mined && state.terrain.indexOf(state.mined.piece) < 0) {
      var pool2 = state.terrain.filter(function (r) {
        var t = R.TERRAIN[r.kind];
        return t && t.destructible && t.destructible !== 'target' && t.destructible !== 'wire';
      });
      state.mined = pool2.length ? { side: state.mined.side, piece: pool2[Math.floor(Math.random() * pool2.length)] } : null;
    }
    /* "the Rebel player may secretly choose" the piece (p. 112): a player picks
       it — or none — before deploying; only the AI's is drawn for it. */
    if (state.mined && !isAI(state.mined.side)) {
      var mpool = state.terrain.map(function (r, i) {
        var t = R.TERRAIN[r.kind];
        return t && t.destructible && t.destructible !== 'target' && t.destructible !== 'wire' ? i : -1;
      }).filter(function (i) { return i >= 0; });
      state.minePick = { side: state.mined.side, pool: mpool };
      state.mined = null;
    }
    // Detailed Terrain Knowledge: the AI moves its pieces now; a player does, by hand, before deploying
    state.placeQueue = [];
    ['A', 'B'].forEach(function (side) {
      if (docsOf(side).indexOf('XO4') < 0) return;
      if (isAI(side)) K.terrainKnowledge(side);
      else state.placeQueue.push({ side: side, kind: 'move', why: 'terrain', left: 2, total: 2 });
    });
    /* Hostile takeover (p. 55): up to ten sections and a bunker within 12" of
       the objective, put down by the defender after the roles are known. */
    if (state.sc.fortsByHand) {
      var nf = SC.FORT_SECTIONS;
      state.placeQueue.push({ side: state.sc.defender, kind: 'fort', why: 'takeover', piece: 'trench', len: 6,
        sections: nf, bunkers: 1, left: nf + 1, total: nf + 1 });
    }
    ['A', 'B'].forEach(function (side) {
      if (state.manualLaststand[side]) {
        var nls = 4 * (cfg.pl || 1);
        state.placeQueue.push({ side: side, kind: 'barricade', why: 'laststand', left: nls, total: nls, len: 4 });
      }
    });
    /* Modifying the armies (p. 46): with the table laid and both lists known, a
       player may swap some of their units before anyone deploys. The set-up
       waits here, and finishSetup carries on once they are done. */
    finishSetup(built);
    K.beginSwaps();
  }
  /* ---- modifying the armies before the battle: in engine/swaps.js ---- */

  function finishSetup(built) {
    var cfg = state.cfg;
    ['A', 'B'].forEach(K.markReserves);
    /* A player's units held for Battlefield Insertion go into the scenario's own
       split, if it makes one, and are toggled with the rest of its reserves (a
       held one still comes in by insertion): so they are let go before it splits
       the force, and held again only where it makes no split. */
    var heldIns = {};
    ['A', 'B'].forEach(function (sd) {
      if (isAI(sd)) return;
      heldIns[sd] = state.units.filter(function (u) { return u.side === sd && u.reserve && u.wave == null; });
      heldIns[sd].forEach(function (u) { u.reserve = false; });
    });
    SC.deploy(state);
    Object.keys(heldIns).forEach(function (sd) {
      if (state.sc.split && state.sc.split[sd]) return;
      heldIns[sd].forEach(function (u) { if (!u.reserve) { u.reserve = true; u.x = -1; u.y = -1; } });
    });
    K.nextPlace();
    K.seatPlatforms();             // each drop pod starts with a squad in it, which the player may change
    K.baselineSplits();
    K.clearSplits();               // the players choose their own reserves
    var scen = state.scen;
    logLine('note', 'Battle Tier ' + R.ROMAN[cfg.tier] + ', Priority Level ' + cfg.pl +
      ' — ' + (R.COMPOSITION[cfg.tier].points * cfg.pl) + ' composition points a side. ' +
      scen.name + ' (p. ' + scen.page + ') on a 4′ × 4′ table.');
    logLine('note', scen.blurb + ' ' + scen.win);
    if (state.sc.attacker) logLine('note', roleSentence());
    pushRes({
      kind: 'Scenario', title: scen.name, note: scen.blurb,
      list: (state.sc.attacker ? [{ text: roleSentence() }] : [])
        .concat([{ text: scen.win }, { text: scen.hint }])
        .concat(!state.sc.attacker ? []
          : playerSide() ? [{ text: deployWhere(playerSide()) }]
            : [{ text: sideName('A') + ' — ' + deployWhere('A') },
              { text: sideName('B') + ' — ' + deployWhere('B') }])
    });
    logLine('note', cfg.nameA + ' [A] against ' + cfg.nameB + ' [B].');
    logLine('note', 'Terrain generator: ' + built.generator + '. ' +
      built.rolls.map(function (r) { return r.area + ' D6 ' + r.roll; }).join(', ') + '.');
    if (!built.manual) built.rolls.forEach(function (r) { logLine('terrain', r.area + ' — D6 ' + r.roll + ': ' + r.text); });
    if (!built.manual) pushRes({
      kind: 'Terrain', title: built.generator,
      note: 'The table is divided into 2′ × 2′ areas; a D6 is rolled for each and the result placed in it.',
      dice: built.rolls.map(function (r) { return { label: r.area, value: r.roll }; }),
      list: built.rolls.map(function (r) { return { text: r.area + ' — ' + r.text }; })
    });
    /* Open on a view that shows enough of the table to place a force in. On a
       phone the board now fills the screen, so a step above "the whole table" is
       readable; on a desktop it is a step above that again. */
    V.newTable();
    // (where both companies enter in turn 1, nobody is placed now: the OpFor comes on then, like everyone)
    state.cfg.aiSides.forEach(function (s2) { if (!K.entering(s2)) K.autoDeploy(s2); });
    /* Hero of the People (p. 111): "in scenarios using the alternating deployment
       sequence, the opponent has to set up half of their units first before the
       Rebel player deploys any" — that is turn 1's entry in the scenarios where both
       companies come on in turn (arrivals.js). Where a defender sets up first, the
       deployment is one side after the other, not alternating: it does not apply. */
    /* Look at the ground the player is being asked to fill. Zoomed in on a phone
       the middle of the table is nowhere near their own edge, and every tap used
       to land outside the strip with nothing on screen to say where it was. */
    lookAtDeployment();
    render();
    if (state.cfg.aiSides.length === 2) K.startBattle();
  }

  function isAI(side) { return state.cfg.aiSides.indexOf(side) >= 0; }
  /* ---- laying the terrain: in engine/terrainsetup.js ---- */

  function docsOf(side) { return (state && state.doctrines && state.doctrines[side]) || []; }

  // vehicles and aircraft get +4" on a Move; everyone else +2"
  function moveBonus(u, action) {
    var base = R.isMachine(u) ? 4 : 2;
    /* Riders take their Movement +4" whatever they are doing (p. 94), and a Human
       Wave moves the infantry M+4" on Move and Assault actions (p. 95) — in place
       of the usual +2", not on top of it, so a rider gains nothing more from it. */
    if (R.has(u, 'Riders')) base = Math.max(base, 4);
    if (u.tactic === 'wave' && u.cls === 'infantry' &&
      (action === 'move' || action === 'assault' || !action)) base = Math.max(base, 4);
    if (!C || !state) return base;
    return C.moveBonus(u, base, action || 'move', state.doctrines ? state.doctrines[u.side] : null);
  }
  /* ---- deployment: in engine/deploy.js ---- */

  function relocCap(side) {
    // "up to ½ of their units" (p. 89), rounded up (p. 27)
    return Math.ceil(state.units.filter(function (u) {
      return u.side === side && u.alive && u.x >= 0 && !u.reserve && !u.aboard;
    }).length / 2);
  }

  /* ---- turn 1, once the forces are on the table ----
     Rapid Relocation (O3): "after deployment in the Reserve phase of the 1st
     turn", up to half the units that start the battle on the table move to
     another place the scenario allows; no unit moves twice; with both sides
     holding it, they take it in turns, from the initiative. Then Fortify and
     Strike! (XO5): "in the first turn … after the Xenotripod force is
     deployed", four field fortifications in its deployment zone. Only then the
     Action phase. `then` goes on to it; it is kept off the state (ui), as a
     function would not survive a copy of the state. */
  function afterEntry(then) {
    ui.entryThen = then;
    state.relocDone = state.relocDone || {};
    var order = state.initiative === 'B' ? ['B', 'A'] : ['A', 'B'];
    state.relocs = {};
    order.forEach(function (sd) {
      if (state.relocDone[sd] || docsOf(sd).indexOf('O3') < 0 || relocCap(sd) < 1) return;
      state.relocDone[sd] = true;
      // the OpFor makes all its moves at once, in its turn
      if (isAI(sd)) { K.aiRelocate(sd); return; }
      state.relocs[sd] = { side: sd, cap: relocCap(sd), moved: [], done: false };
      logLine('note', sideName(sd) + ' — Rapid Relocation: up to ' + state.relocs[sd].cap + ' units may be moved.');
    });
    relocTurn(order[0]);
  }
  /* The next side to relocate a unit: `want` if it still may, otherwise the
     other. A side at its half keeps the card until it says Done (it may look it
     over first); with neither side left to say so, on to the fortifications. */
  function relocTurn(want) {
    var rs = state.relocs || {}, other2 = want === 'A' ? 'B' : 'A';
    var canMove = function (sd) { var r = rs[sd]; return r && !r.done && r.moved.length < r.cap; };
    var waiting = function (sd) { var r = rs[sd]; return r && !r.done; };
    var sd = canMove(want) ? want : canMove(other2) ? other2 : waiting(want) ? want : waiting(other2) ? other2 : null;
    ui.deployPick = null;
    if (!sd) {
      Object.keys(rs).forEach(function (k) {
        var r = rs[k];
        logLine('note', sideName(k) + ' — Rapid Relocation: ' + r.moved.length + ' unit' + (r.moved.length === 1 ? '' : 's') + ' moved.');
      });
      state.relocs = null; state.relocating = null;
      entryFortify();
      return;
    }
    state.relocating = rs[sd];
    lookAtDeployment(sd);
    var left = rs[sd].cap - rs[sd].moved.length;
    setHint(null, 'Rapid Relocation: tap one of your units, then where it should go — ' + left + ' more may move. Done when you have finished.');
    render();
  }
  // a side done relocating (by choice, or at half its force): the other takes over, or the turn goes on
  function finishRelocation() {
    var rl = state.relocating;
    if (!rl) return;
    rl.done = true;
    relocTurn(rl.side === 'A' ? 'B' : 'A');
  }
  function entryFortify() {
    state.fortAsked = state.fortAsked || {};
    ['A', 'B'].forEach(function (sd) {
      if (docsOf(sd).indexOf('XO5') >= 0 && isAI(sd) && !state.fortAsked[sd]) { state.fortAsked[sd] = true; fortify(sd); }
    });
    var fs = ['A', 'B'].filter(function (sd) { return docsOf(sd).indexOf('XO5') >= 0 && !isAI(sd) && !state.fortAsked[sd]; })[0];
    if (fs) {
      state.fortAsked[fs] = true;
      state.placeQueue = [{ side: fs, kind: 'barricade', why: 'fortify', left: 4, total: 4, len: 3, then: 'entry' }];
      K.nextPlace();
      return;
    }
    var then = ui.entryThen;
    ui.entryThen = null;
    render();
    if (then) then();
  }

  // a legal new place for a unit inside its own side's deployment ground
  function relocSpotOK(u, x, y) {
    return K.deployOK(u.side, x, y, u) && !R.barredAt(state, u, x, y) && !R.unitNear(state, x, y, u, 1);
  }

  /* ---- the OpFor: in engine/ai.js ---- */

  // a tap on the table while the player is relocating
  function relocTap(p) {
    var rl = state.relocating;
    var pick = ui.deployPick ? K.byId(ui.deployPick) : null;
    var under = state.units.filter(function (u) {
      return u.side === rl.side && u.alive && u.x >= 0 && !u.aboard && R.inches(u.x, u.y, p.x, p.y) < 1.1;
    })[0];
    if (under && (!pick || under.id !== pick.id)) { relocPick(under.id); return; }
    if (!pick) { setHint(null, 'Rapid Relocation: tap one of your units first.'); render(); return; }
    var q = relocSpotOK(pick, p.x, p.y) ? p : K.nearestDeploySpot(pick, p.x, p.y, 9);
    if (!q) { setHint(null, 'Not there — only somewhere your deployment allows.'); render(); return; }
    pick.bld = null; pick.sec = null;
    pick.x = q.x; pick.y = q.y;
    rl.moved.push(pick.id);
    ui.deployPick = null;
    if (SFX) SFX.step();
    // each unit moved hands the relocation to the other side, if it has any left to make (alternating)
    function next() { relocTurn(rl.side === 'A' ? 'B' : 'A'); }
    if (K.askFacing(rl.side, [pick], next)) return;
    next();
  }

  function relocPick(id) {
    var rl = state.relocating, u = K.byId(id);
    if (!rl) return;
    if (!u || u.side !== rl.side || u.x < 0) return;
    if (rl.moved.indexOf(u.id) >= 0) { setHint(null, u.name + ' has already been relocated — no unit moves twice.'); render(); return; }
    if (rl.moved.length >= rl.cap) { setHint(null, 'Rapid Relocation: half the force has already moved.'); render(); return; }
    ui.deployPick = u.id;
    setHint(null, 'Relocating ' + u.name + ' — tap where it should go.');
    render();
  }

  /* Fortify and Strike! (p. 141): with the tribe on the table, four field
     fortifications — low walls — go down in its deployment zone, each in front
     of one of its units, facing the enemy. */
  function fortify(side) {
    var foe = state.units.filter(function (u) { return u.side !== side && K.onTable(u); });
    var mine = state.units.filter(function (u) { return u.side === side && K.onTable(u) && !R.isMachine(u); });
    var placed = 0;
    mine.forEach(function (u) {
      if (placed >= 4) return;
      var aim = foe.length ? foe.reduce(function (b, e) { return !b || R.unitDist(u, e) < R.unitDist(u, b) ? e : b; }, null) : { x: W / 2, y: H / 2 };
      var dx = aim.x - u.x, dy = aim.y - u.y, d = Math.hypot(dx, dy) || 1;
      var cx = u.x + dx / d * 1.8, cy = u.y + dy / d * 1.8;
      var along = Math.abs(dx) > Math.abs(dy);
      var r = along ? { kind: 'barricade', x: cx - 0.3, y: cy - 1.5, w: 0.6, h: 3 } : { kind: 'barricade', x: cx - 1.5, y: cy - 0.3, w: 3, h: 0.6 };
      if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) return;
      var clash = state.terrain.some(function (o) { return r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y; }) ||
        state.units.some(function (o) { return o.alive && o.x >= 0 && o.x > r.x - 1 && o.x < r.x + r.w + 1 && o.y > r.y - 1 && o.y < r.y + r.h + 1; });
      if (clash) return;
      state.terrain.push(r);
      placed++;
    });
    if (placed) {
      queueBake();
      logLine('terrain', sideName(side) + ' — Fortify and Strike!: ' + placed + ' field fortifications thrown up.');
    }
  }
  /* ---- reserves and arrivals: in engine/arrivals.js ---- */
  /* ---- the solitaire turn: in engine/solo.js ---- */

  function beginTurn() {
    if (state.solo) { K.soloBeginTurn(); return; }
    state.turn += 1;
    state.units.forEach(function (u) {
      u.activated = false; u.marked = false; u.markMoved = false; u.shotFrom = []; u.coordUsed = false;
      u.hackUsed = false; u.hacked = false; u.supportUsed = false; u.advancing = false;
      u.disembarked = false; u.boarded = false;
    });
    state.chain = null; state.rush = null; state.cmdAct = null;
    state.mark = null; state.remark = null;
    var a, b;
    do { a = R.d10(); b = R.d10(); } while (a === b);
    state.initiative = a > b ? 'A' : 'B';
    state.activeSide = state.initiative;
    state.phaseCount = null;
    state.streak = streakFor(state.activeSide);
    logLine('turn', 'Turn ' + state.turn + ' — initiative to ' + sideName(state.initiative) + ' (D10 ' + a + ' vs ' + b + ').');
    pushRes({
      kind: 'Initiative', title: 'Turn ' + state.turn,
      dice: [{ label: 'A', value: a, tone: a > b ? 'crit' : '' }, { label: 'B', value: b, tone: b > a ? 'crit' : '' }],
      outcome: { text: sideName(state.initiative) + ' activates first.', tone: 'good' }
    });
    ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.vis = null; ui.visKey = ''; ui.preview = null;
    beginningRites();
    R.collars(state).forEach(function (l) { logLine(l.t, l.text); });
    render();
    revealBoard();
    whenIdle(function () {
      K.reservePhase(function () {
        function action() {
          state.phaseCount = { A: unbroken('A'), B: unbroken('B') };
          /* A side that wins the initiative with nothing it can activate (all Broken,
             say) hands the phase to the other, which then goes on freely (p. 27);
             with nothing to activate on either side, the Rally phase comes at once. */
          if (!state.solo && !eligible(state.activeSide).length) {
            var next = other(state.activeSide);
            if (!eligible(next).length) { K.rallyPhase(); return; }
            logLine('note', sideName(state.activeSide) + ' has no unit that can act — ' + sideName(next) + ' goes on.');
            state.activeSide = next;
          }
          state.streak = streakFor(state.activeSide);
          render();
          maybeAI();
        }
        if (state.turn === 1) afterEntry(action); else action();
      });
    });
  }

  /* The Beginning phase's Rites and Infamies (pp. 142-143). Rite of Unrest: every
     enemy infantry unit within 12" takes a Suppression point. Infamy of Madness:
     a unit with a friend in 12" and sight rolls a D6, and on a 1 fires on it. */
  function beginningRites() {
    state.units.forEach(function (u) {
      if (!K.onTable(u) || !R.campFlag(u, 'unrest') || R.status(u) === 'broken') return;
      var hit = K.activeUnits().filter(function (e) {
        return e.side !== u.side && e.cls === 'infantry' && !e.drone && !R.campFlag(e, 'shielding') && R.unitDist(u, e) <= 12;
      });
      hit.forEach(function (e) { R.addSP(e, 1); });
      if (hit.length) logLine('suppressed', 'Rite of Unrest — ' + u.label + ' unsettles ' + hit.map(function (e) { return e.label; }).join(', ') + ': 1 SP each.');
    });
    state.units.forEach(function (u) {
      if (!K.onTable(u) || !R.campFlag(u, 'madness') || u.fp == null) return;
      var friend = K.activeUnits(u.side).filter(function (f) { return f !== u && R.unitDist(u, f) <= 12 && R.hasLoS(state, u, f); })[0];
      if (!friend) return;
      var roll = R.d6();
      if (roll !== 1) { logLine('note', u.label + ' — Infamy of Madness: D6 ' + roll + ', it holds its fire.'); return; }
      var res = K.abShoot(state, u, friend, 'fire', {});
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      pushRes(K.fromLog('Infamy of Madness', u.name + ' → ' + friend.name, u.side, [{ t: 'note', text: 'D6 1: ' + u.label + ' turns its guns on ' + friend.label + '.' }].concat(res.log)));
    });
  }

  function unbroken(side) {
    // troops still in reserve or riding inside a hull are not on the table
    // turrets are not counted for Overwhelming Numbers (p. 130)
    return state.units.filter(function (u) {
      return K.onTable(u) && u.side === side && R.status(u) !== 'broken' && !R.has(u, 'Turret');
    }).length;
  }

  /* "For the purpose of this rule, always take into account the number of
     unbroken units at the beginning of the current phase" (p. 27): counted once
     as the Action phase opens, not again as units break during it. */
  function streakFor(side) {
    var cnt = state.phaseCount;
    var mine = cnt ? cnt[side] : unbroken(side), theirs = cnt ? cnt[other(side)] : unbroken(other(side));
    if (theirs === 0) return 99;
    var n = Math.max(1, Math.floor(mine / theirs));
    if (n > 1) logLine('note', sideName(side) + ' has overwhelming numbers — ' + n + ' activations in a row.');
    return n;
  }

  function other(s) { return s === 'A' ? 'B' : 'A'; }

  function sideName(s) { return (s === 'A' ? state.cfg.nameA : state.cfg.nameB) + ' [' + s + ']'; }

  /* ---------- attacker, defender, and where a side puts its troops ----------
     Three of the six scenarios (pp. 53-55) hand one company the attack and the
     other the ground, and the two play nothing alike — so the player is told
     which they are, in the header, on the deployment card and in the log. */
  /* "You" only means anything where one side is the player's and the other is
     the machine's. With a person on each side — hotseat, or two browsers — the
     engine writes for both of them at once, so it names the sides instead and
     each screen says which one it is sitting in. */
  function playerSide() {
    if (isAI('A')) return isAI('B') ? null : 'B';
    return isAI('B') ? 'A' : null;
  }

  function roleOf(side) {
    if (!state.sc || !state.sc.attacker || !side) return null;
    return state.sc.attacker === side ? 'attacker' : 'defender';
  }

  function bestDefenceNote() {
    var bd = state.sc && state.sc.bestDefence;
    return bd && bd.swapped
      ? ' The Best Defence is Good Offence: D6 ' + bd.roll + ' — the roles were swapped.' : '';
  }

  function roleSentence() {
    if (!state.sc || !state.sc.attacker) return '';
    var you = playerSide();
    if (!you) {
      return sideName(state.sc.attacker) + ' attacks; ' + sideName(state.sc.defender) +
        ' defends.' + bestDefenceNote();
    }
    return (roleOf(you) === 'attacker'
      ? 'You are the attacker. ' + sideName(state.sc.defender) + ' defends.'
      : 'You are the defender. ' + sideName(state.sc.attacker) + ' attacks.') + bestDefenceNote();
  }

  /* Read out of the scenario's own deployment data, so it always describes the
     ground the game will actually accept rather than a remembered rule. */
  function deployWhere(side) {
    var sc = state.sc || {};
    if (state.scen.deployText) return state.scen.deployText(state, side);
    if (sc.defCircle && sc.defender === side) {
      return 'Place each unit inside the shaded circle — within ' + sc.defCircle.r +
        '" of the objective.';
    }
    if (K.boxesFor(side)) {
      return 'Place each unit inside one of the shaded bands — the stretches of table edge that are yours.';
    }
    var z = K.zoneFor(side);
    if (!z || (sc.zones && sc.zones[side] === null && sc.attacker === side)) {
      return 'Nothing deploys before the battle. Split your force into two waves; once the defender is down you nominate three landing zones, and the first wave comes down into them in the Reserve phase of turn 1. The second wave follows from turn 4, on a roll.';
    }
    if (sc.inset && sc.defender === side) {
      return 'Place each unit inside the shaded box — anywhere at least ' + sc.inset +
        '" in from every table edge.';
    }
    var depth = side === 'A' ? z[1] : W - z[0];
    return 'Place each unit inside your own ' + Math.round(depth) +
      '" strip — the shaded band on your table edge.';
  }

  // two Regular rifle teams need telling apart on the table
  function dedupeCodes() {
    ['A', 'B'].forEach(function (side) {
      var seen = {};
      state.units.filter(function (u) { return u.side === side; }).forEach(function (u) {
        seen[u.code] = (seen[u.code] || 0) + 1;
      });
      var n = {};
      state.units.filter(function (u) { return u.side === side; }).forEach(function (u) {
        if (seen[u.code] < 2) return;
        n[u.code] = (n[u.code] || 0) + 1;
        u.code = (u.code.length > 2 ? u.code.slice(0, 2) : u.code) + n[u.code];
      });
    });
  }

  function eligible(side) {
    // an Adrenaline Rush: the unit's second action comes straight after its first
    // the Command Unit aboard a Command Vehicle taking its own action (p. 57)
    if (state.cmdAct) {
      var cv = K.byId(state.cmdAct.veh);
      if (cv && cv.side === side && !cv.activated) return cv.alive ? [cv] : [];
    }
    if (state.rush) {
      var ru = K.byId(state.rush);
      if (ru && ru.side === side) return ru.alive && !ru.activated && !ru.aboard && R.status(ru) !== 'broken' ? [ru] : [];
    }
    // a marker that stood still is naming its second target: nothing else goes until it has
    if (state.remark && state.remark.side === side) {
      var rm = K.byId(state.remark.by);
      return rm && rm.alive ? [rm] : [];
    }
    return state.units.filter(function (u) {
      if (!u.alive || u.side !== side || u.activated || u.aboard || u.reserve) return false;
      if (R.status(u) === 'broken') return false;
      // a cooperative game's players take their turns with their own commandos
      if (state.solo && state.solo.coop && side === 'A' && state.activeSide === 'A' &&
        state.activeOwner && (u.owner || 1) !== state.activeOwner && !ui.soloAll) return false;
      if (state.chain && state.chain.side === side) {
        // the turrets activate as one: while they go, nothing else does (p. 130)
        if (state.chain.kind === 'turrets') return R.has(u, 'Turret');
        // a marker's chain calls on whoever can answer the mark, wherever they stand
        if (state.chain.kind === 'mark') {
          var m = state.mark;
          if (!m) return false;
          return m.targets.some(function (t) { return K.canAnswerMark(u, t, m.kind); });
        }
        // 12" between the closest models of the two units, not their middles
        var cmdU = state.chain.by && K.byId(state.chain.by);
        if ((cmdU ? R.unitDist(u, cmdU) : R.inches(u.x, u.y, state.chain.x, state.chain.y)) > 12) return false;
        // "other Command Units" (p. 59): any of the list's command units, the 4th grade too
        if (R.commandUnit(u) || R.has(u, 'Command Unit')) return false;
        if (R.has(u, 'Turret')) return false;              // untouched by Command Units
        if (u.tier >= state.chain.tier + 2) return false;
        if (R.campFlag(u, 'insubordinate')) return false;      // Insubordinate
      }
      return true;
    });
  }

  function endActivation(actor) {
    ui.lastActed = actor || ui.selected || null;
    // a hacked drone's borrowed activation is over: back to its owner, and it burns
    var hj = K.hijacked();
    if (hj && (ui.lastActed === hj || !hj.alive)) K.endHijack(hj);
    R.collars(state).forEach(function (l) { logLine(l.t, l.text); });
    if (ui.lastActed) ui.lastActed.advancing = false;   // an Advance ends with its activation
    // Infamy of Melancholy (p. 143): its activation weighs on every friend within 6"
    var mel = ui.lastActed;
    if (mel && mel.alive && R.campFlag(mel, 'melancholy')) {
      var sad = K.activeUnits(mel.side).filter(function (f) { return f !== mel && !R.isMachine(f) && R.unitDist(f, mel) <= 6; });
      sad.forEach(function (f) { R.addSP(f, 1); });
      if (sad.length) logLine('suppressed', 'Infamy of Melancholy — ' + mel.label + ' weighs on ' + sad.map(function (f) { return f.label; }).join(', ') + ': 1 SP each.');
    }
    ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.vis = null; ui.visKey = ''; ui.preview = null;
    ui.sections = [];
    // the D6 for barbed wire is rolled for one move, not kept (p. 42)
    state.units.forEach(function (w) { w.wireRoll = null; });
    // a scenario that ends the moment something happens (the VIP killed) does not wait for the End phase
    if (!state.over && state.scen.sudden) {
      var sd = state.scen.sudden(state);
      if (sd) K.finish(sd.winner, sd.text.replace(/\bA\b/g, sideName('A')).replace(/\bB\b/g, sideName('B')));
    }
    if (state.over) { render(); return; }

    /* Command Vehicle (p. 57): "as soon as the Command Vehicle finishes its
       activation, the Command Unit on board MAY perform one of their special
       actions" — offered, not forced, and only to a steady Command Unit (a
       Suppressed one cannot Coordinate any more than on foot). */
    var just = ui.lastActed;
    // the Command Unit's own action from inside the vehicle is over: the go passes on
    if (state.cmdAct) { state.cmdAct = null; passOn(just); return; }
    if (just && just.alive && R.has(just, 'Command Vehicle') && !state.chain && !state.solo) {
      var cmd = R.commandAboard(just);
      var acts = cmd ? cmdOfferActs(just, cmd) : [];
      if (acts.length) {
        if (isAI(just.side)) { if (acts[0].id === 'coordinate') cmdCoordinate(just, cmd); }
        else {
          state.cmdOffer = { veh: just.id, cmd: cmd.id, acts: acts };
          setHint(null, cmd.name + ' is aboard ' + just.name + ': ' +
            acts.map(function (a) { return a.label.toLowerCase(); }).join(', ') + ' now, or let the activation pass.');
          render();
          return;
        }
      }
    }
    passOn(just);
  }
  /* What the Command Unit riding in a Command Vehicle may do once the vehicle has
     acted (p. 57): Coordinate, or "an action allowed by any other special rule" of
     its own — a hack, a mark or a designation. It counts as stationary for it, and
     a Suppressed Command Unit does nothing, as on foot. */
  function cmdOfferActs(veh, cmd) {
    if (R.status(cmd) !== 'ready' || R.status(veh) === 'broken') return [];
    var out = [];
    if (R.has(cmd, 'Command Unit') && !cmd.coordUsed) out.push({ id: 'coordinate', label: 'Coordinate' });
    var own = [];
    if (R.has(cmd, 'Hackers')) own.push({ id: 'hack', label: 'Hack' });
    if (R.has(cmd, 'Markerlights')) own.push({ id: 'designate', label: 'Designate' }, { id: 'marktarget', label: 'Mark' });
    else if (R.has(cmd, 'Smoke Markers')) own.push({ id: 'designate', label: 'Smoke & flare' });
    if (R.has(cmd, 'Dominant Species')) own.push({ id: 'regain', label: 'Regain Control' });
    // asked of the vehicle as it stands, the activation it has just spent put aside
    var was = veh.activated;
    veh.activated = false;
    own.forEach(function (a) { if (K.actionState(veh, a.id).on) out.push(a); });
    veh.activated = was;
    return out;
  }
  function cmdCoordinate(veh, cmd) {
    cmd.coordUsed = true;
    addFx({ kind: 'wave', x: veh.x, y: veh.y, up: 0, r: 12, rgb: '232,193,90', dur: 1300 });
    state.chain = {
      side: veh.side, remaining: R.ruleValue(veh, 'Command Unit') + 1,
      x: veh.x, y: veh.y, tier: cmd.tier, by: veh.id
    };
    logLine('note', cmd.label + ', riding in ' + veh.name + ', coordinates: up to ' +
      R.ruleValue(veh, 'Command Unit') + ' friendly units within 12" activate in a row.');
  }
  // the player's answer to the Command Vehicle's offer
  function answerCmdOffer(take) {
    var o = state.cmdOffer;
    if (!o) return;
    state.cmdOffer = null;
    var veh = K.byId(o.veh), cmd = K.byId(o.cmd);
    // one of its own special actions: the vehicle is readied for that one, and nothing else
    if (take && take !== true && veh && cmd) {
      cmd.coordUsed = true;
      veh.activated = false;
      state.cmdAct = { veh: veh.id, id: take };
      logLine('note', cmd.label + ', riding in ' + veh.name + ', takes its own action.');
      ui.selected = veh; ui.hint = null;
      focusUnit(veh);
      K.chooseAction(take);
      // it counts as stationary (p. 57): no move before a mark, and so a second call
      ui.moves = [];
      render();
      return;
    }
    if (take && veh && cmd) cmdCoordinate(veh, cmd);
    else if (cmd) { cmd.coordUsed = true; logLine('note', (cmd.label || 'The Command Unit') + ' stays quiet aboard ' + (veh ? veh.name : 'its vehicle') + '.'); }
    ui.hint = null;
    passOn(veh);
  }
  // the rest of an activation's ending: turrets together, chains, whose go it is next
  function passOn(just) {
    /* Adrenaline Rush (p. 88): after the first of its two actions the unit is
       readied to go again, and nothing else moves until it has; the second action
       ends the activation as usual, so the pair costs the side one activation. */
    if (just && state.rush === just.id) state.rush = null;
    else if (just && just.rushArmed) {
      just.rushArmed = false;
      if (just.alive && !just.aboard && R.status(just) !== 'broken' && !state.over) {
        just.activated = false;
        state.rush = just.id;
        logLine('note', just.label + ' goes again — Adrenaline Rush.');
        if (!isAI(just.side)) setHint(null, just.label + ' goes again: its second action of the Adrenaline Rush.');
        render(); maybeAI();
        return;
      }
    }
    /* All turrets are activated at once (p. 130): the first to act brings every
       other one of its side along before the activation passes. */
    if (just && R.has(just, 'Turret') && !state.chain && !state.solo) {
      var restT = eligible(just.side).filter(function (t) { return R.has(t, 'Turret'); });
      if (restT.length) {
        state.chain = { kind: 'turrets', side: just.side, remaining: restT.length + 1 };
        logLine('note', 'The turrets act as one — ' + restT.length + ' more to go before the activation passes.');
      }
    }
    /* A chain (a Command Unit's, the turrets', a marker's call) runs its course
       first — in a solitaire game as well, whose players have no streak to count. */
    if (state.chain && state.chain.side === state.activeSide) {
      state.chain.remaining -= 1;
      if (state.chain.remaining > 0 && eligible(state.activeSide).length > 0) { render(); maybeAI(); return; }
      if (state.chain.kind === 'mark') {
        // a marker that stood still names a second target once the first answer is in
        if (K.offerSecondMark()) return;
        K.clearMark();
      }
      state.chain = null;
    }
    afterChain();
  }
  // the activation (and any chain it started) is over: whose go is it now?
  function afterChain() {
    if (state.solo) { K.soloNext(); return; }
    state.streak -= 1;
    if (state.streak > 0 && eligible(state.activeSide).length > 0) { render(); maybeAI(); return; }

    var next = other(state.activeSide);
    if (eligible(next).length > 0) { state.activeSide = next; state.streak = streakFor(next); }
    else if (eligible(state.activeSide).length > 0) { state.streak = streakFor(state.activeSide); }
    else { K.rallyPhase(); return; }
    render();
    maybeAI();
  }
  /* ---- the end of the turn: in engine/endphase.js ---- */

  function specialsFor(u) {
    var out = [];
    /* Markerlights carry two different special actions (p. 58): Designate target
       calls up a gun that shoots without seeing, Mark the target calls up one that
       does see and fires as though at half range. Smoke Markers (p. 94) are the
       rebels' cut-down version: designate only, out to 12". Each is offered only
       when somebody on the table could actually answer it. */
    if (u && R.has(u, 'Markerlights')) {
      if (K.markAnswerable(u, 'designate')) out.push({ id: 'designate', label: 'Designate' });
      if (K.markAnswerable(u, 'mark')) out.push({ id: 'marktarget', label: 'Mark' });
    } else if (u && R.has(u, 'Smoke Markers')) {
      if (K.markAnswerable(u, 'designate')) out.push({ id: 'designate', label: 'Smoke & flare' });
    }
    // Sappers may charge without setting their demolition charges (p. 59)
    if (u && R.has(u, 'Sappers') && !R.isMachine(u)) out.push({ id: 'plainassault', label: 'Assault, no charges' });
    // the Command Unit rule is not used in solitaire games (p. 149)
    if (u && R.has(u, 'Command Unit') && !state.solo) out.push({ id: 'coordinate', label: 'Coordinate' });
    // a Coordinate chain activates "up to" so many (p. 59): it may be ended with units still to go
    if (u && state.chain && !state.chain.kind && state.chain.side === u.side) out.unshift({ id: 'endchain', label: 'End the chain' });
    if (u && u.transport) {
      /* A gun is towed rather than carried (Stationary Artillery, p. 94): where
         what it would take on, or has on, is a gun, the actions say Tow and Deploy. */
      var gunsIn = (u.cargo || []).filter(function (c) { return R.has(c, 'Stationary Artillery'); }).length;
      var near = K.activeUnits(u.side).filter(function (t2) { return t2 !== u && R.canEmbark(state, u, t2); });
      var gunsNear = near.filter(function (t2) { return R.has(t2, 'Stationary Artillery'); }).length;
      out.push({ id: 'embark', label: gunsNear && gunsNear === near.length ? 'Tow' : gunsNear ? 'Embark / tow' : 'Embark' });
      out.push({ id: 'disembark', label: gunsIn && gunsIn === (u.cargo || []).length ? 'Deploy gun' : gunsIn ? 'Disembark / deploy' : 'Disembark' });
      if (K.movesToCarry(u)) out.push({ id: 'drivefirst', label: u.cls === 'aircraft' ? 'Fly first' : 'Drive first' });
    }
    if (u && u.cls === 'aircraft') out.push({ id: 'strafe', label: 'Strafe' });
    if (u && R.has(u, 'Supporting Fire')) out.push({ id: 'support', label: 'Support' });
    if (u && R.has(u, 'Hackers')) out.push({ id: 'hack', label: 'Hack' });
    // NOT ONE STEP BACKWARDS! (T5): offered while a friend within reach is carrying Suppression
    if (u && state.phase === 'battle' && R.steadyShooter(state, u) && R.steadyTargets(state, u).length) {
      out.push({ id: 'steady', label: 'Not one step back!' });
    }
    if (u && (R.has(u, 'Destructive Weapon') || R.has(u, 'Incendiary Ammunition'))) {
      out.push({ id: 'demolish', label: 'Demolish' });
    }
    /* Sappers carry charges against anything destructible; in the Demolish
       scenario every infantry unit may go at the objective, at +2 rather than
       their +4 (pp. 49, 54). */
    if (u && breachTargets(u).length) {
      out.push({ id: 'breach', label: R.has(u, 'Sappers') ? 'Breach' : 'Demolish!' });
    }
    if (u && SC.searchSpots(state, u).length) out.push({ id: 'checkarea', label: 'Check area' });
    if (u && state.scen.sabotageSpots && state.scen.sabotageSpots(state, u).length) out.push({ id: 'sabotage', label: 'Destroy objective' });
    if (u && R.has(u, 'Stationary Artillery')) {
      out.push(u.dugIn ? { id: 'stance', label: 'Normal stance' } : { id: 'stance', label: 'Dig in!' });
    }
    if (u && K.minedFor(u)) out.push({ id: 'detonate', label: 'Detonate' });
    if (u && R.has(u, 'Psychic Wave')) out.push({ id: 'wave', label: 'Psychic Wave' });
    if (u && R.has(u, 'Dominant Species')) out.push({ id: 'regain', label: 'Regain Control' });
    if (u && R.has(u, 'Molecular Reconstruction')) out.push({ id: 'selfrepair', label: 'Self-repair' });
    if (u && R.has(u, 'Teleport')) out.push({ id: 'teleport', label: 'Teleport' });
    if (u && R.campFlag(u, 'vortex')) {
      out.push({ id: 'vortex', label: 'Time Vortex move' });
      out.push({ id: 'vortexadv', label: 'Time Vortex advance' });
    }
    /* Buildings (p. 41): entering and leaving are special actions, and from
       inside a building of several sections, so is moving to the next one. */
    if (u && state.phase === 'battle' && R.canGarrison(u)) {
      if (u.bld) out.unshift({ id: 'exitbld', label: 'Exit building' });
      if (R.enterTargets(state, u).length) out.unshift({ id: 'enter', label: u.bld ? 'Next section' : 'Enter building' });
    }
    // off the table on purpose (p. 31): offered when a Move would take it over an edge
    if (u && state.phase === 'battle' && K.leaveSpots(u).length) out.push({ id: 'leave', label: 'Leave the table' });
    if (R.campFlag(u, 'adrenaline')) out.push({ id: 'rush', label: 'Rush' });
    // Rite of Concentration (p. 142): a Fire! with the D10 doubled, once a battle
    if (R.campFlag(u, 'concentration')) out.push({ id: 'fireconc', label: 'Fire! — Concentration' });
    if (R.campFlag(u, 'lastStand')) out.push({ id: 'laststand', label: 'Last Stand' });
    return out;
  }

  function spent(u, which) { return !!(u && u.camp && u.camp.once && u.camp.once[which]); }

  /* Last Stand (p. 88): "once per battle the unit can remove all its Suppression
     points" — at any time, and not as an action. A player calls on it from the
     order of battle whenever they like, or from the unit's own action bar; the
     rally that would see the unit off the table stops to ask first (endphase.js). */
  function standable(u) {
    return !!(u && u.alive && !u.reserve && u.x >= 0 && u.sp > 0 && R.campFlag(u, 'lastStand') && !spent(u, 'lastStand') &&
      state && state.phase === 'battle' && !state.over);
  }
  function makeStand(u, why) {
    u.camp.once = u.camp.once || {};
    u.camp.once.lastStand = true;
    var was = u.sp;
    u.sp = 0;
    logLine('rally', u.label + ' makes a Last Stand' + (why ? ' ' + why : '') + ' and shakes off all ' + was + ' SP.');
    pushRes({
      kind: 'Honour', title: 'Last Stand', side: u.side,
      note: u.label + ' steadies and throws off every point of suppression.',
      outcome: { text: was + ' SP cleared — the unit is ready again.', tone: 'good' }
    });
    return was;
  }

  /* the destructible pieces this unit could shoot at, or set charges against */
  function demolishTargets(u, melee) {
    if (!state || !u) return [];
    return state.terrain.filter(function (r) {
      if (!R.canDemolish(u, r)) return false;
      var mid = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      var d = R.inches(u.x, u.y, mid.x, mid.y) - Math.max(r.w, r.h) / 2;
      if (melee) return d <= u.move + 2;
      if (!R.canShootTerrain(state, u, mid)) return false;
      if (d > u.range) return false;
      var minR = R.ruleValue(u, 'Minimum Range');
      if (minR && d < minR) return false;
      return R.hasLoS(state, u, mid);
    });
  }

  function breachTargets(u) {
    if (!state || !u) return [];
    return state.terrain.filter(function (r) {
      if (!R.canCharge(u, r)) return false;
      // the Demolish objective is the attacker's to blow up, never the defender's own (p. 54)
      if (r === (state.sc && state.sc.target) && state.sc.attacker && u.side !== state.sc.attacker) return false;
      var mid = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      return R.inches(u.x, u.y, mid.x, mid.y) - Math.max(r.w, r.h) / 2 <= u.move + 2;
    });
  }
  /* ---- what a unit may do: in engine/actions.js ---- */
  /* ---- moving: in engine/moves.js ---- */
  /* ---- unit abilities: in engine/abilities.js ---- */
  /* ---- shooting, assault, strafing and the special actions: in engine/combat.js ---- */
  /* ---- marking targets: in engine/marks.js ---- */
  /* ---- saving and loading a battle: in engine/save.js ---- */


  /* ---- the engine's parts ----
     Most of the game lives in the files beside this one (deploy.js, ai.js,
     combat.js and the rest), each a kit: a function handed one context that
     gives back the functions it adds. The context is the same for every kit —
     the engine's own functions and values (below), and any other name as a
     kit's function, looked up when it is called — so no kit carries a list of
     what it borrows from the others, and a new function is written once, in
     its kit. What the kits give back goes into K, which the engine calls. */
  var K = {};
  var KITS = [
    ['PMCEngineSwaps', './swaps.js'],
    ['PMCEngineTerrainSetup', './terrainsetup.js'],
    ['PMCEngineDeploy', './deploy.js'],
    ['PMCEngineAI', './ai.js'],
    ['PMCEngineArrivals', './arrivals.js'],
    ['PMCEngineSolo', './solo.js'],
    ['PMCEngineEndPhase', './endphase.js'],
    ['PMCEngineActions', './actions.js'],
    ['PMCEngineMoves', './moves.js'],
    ['PMCEngineAbilities', './abilities.js'],
    ['PMCEngineCombat', './combat.js'],
    ['PMCEngineMarks', './marks.js'],
    ['PMCEngineSave', './save.js']
  ];
  function kitContext() {
    var own = {
      GEN: GEN,
      H: H,
      OBJECTIVES: OBJECTIVES,
      PIECE_NOUN: PIECE_NOUN,
      R: R,
      SC: SC,
      SFX: SFX,
      SNAP_NEAR: SNAP_NEAR,
      SOLO: SOLO,
      UR: UR,
      V: V,
      W: W,
      addFx: addFx,
      afterChain: afterChain,
      afterTerrain: afterTerrain,
      animateMove: animateMove,
      beginTurn: beginTurn,
      boardAnim: boardAnim,
      breachTargets: breachTargets,
      closeDrawer: closeDrawer,
      demolishTargets: demolishTargets,
      docsOf: docsOf,
      eligible: eligible,
      endActivation: endActivation,
      afterEntry: afterEntry,
      entryFortify: entryFortify,
      finishRelocation: finishRelocation,
      fitView: fitView,
      focusUnit: focusUnit,
      fortify: fortify,
      glowRGB: glowRGB,
      isAI: isAI,
      landUnit: landUnit,
      logLine: logLine,
      lookAtDeployment: lookAtDeployment,
      makeStand: makeStand,
      makeUnit: makeUnit,
      maybeAI: maybeAI,
      moveBonus: moveBonus,
      other: other,
      paintStructures: paintStructures,
      playAssault: playAssault,
      playShooting: playShooting,
      playStrafe: playStrafe,
      pushRes: pushRes,
      queueBake: queueBake,
      relocCap: relocCap,
      relocSpotOK: relocSpotOK,
      render: render,
      repaintTerrain: repaintTerrain,
      revealBoard: revealBoard,
      revealConsole: revealConsole,
      setHint: setHint,
      showArrival: showArrival,
      sideName: sideName,
      soundFor: soundFor,
      spent: spent,
      standable: standable,
      stepOff: stepOff,
      terrainSide: terrainSide,
      ui: ui,
      whenIdle: whenIdle,
      get state() { return state; }, set state(v) { state = v; }
    };
    var forward = {};
    return new Proxy(own, {
      get: function (t, k) {
        if (k in t) return t[k];
        if (typeof k !== 'string') return undefined;
        if (K[k]) return K[k];
        // a kit made later: found when it is called
        return forward[k] || (forward[k] = function () {
          if (!K[k]) throw new Error('the engine has no ' + k);
          return K[k].apply(this, arguments);
        });
      },
      set: function (t, k, v) { t[k] = v; return true; }
    });
  }
  function makeKits() {
    var ctx = kitContext();
    KITS.forEach(function (kd) {
      var made = (root[kd[0]] || require(kd[1]))(ctx);
      Object.keys(made).forEach(function (fn) { K[fn] = made[fn]; });
    });
  }

    /* ---- intents ----
       One entry for every way a player can touch the table. Each says who may
       send it and when; anything else comes back as a refusal rather than a
       silent no-op, so a client that is out of step is told so. */
    function no(why) { return { ok: false, why: why }; }
    /* Getting on with the deployment (placing the next unit, beginning the
       battle) with a vehicle's facing still unanswered keeps the way offered. */
    function settleFacing() {
      for (var n = 0; state.faceAsk && state.phase === 'deploy' && n < 99; n++) K.answerFacing(null);
    }
    var yes = { ok: true };

    function mayDeploy(side) {
      return state.phase === 'deploy' && K.placingSide() === side && !state.placeAsk && !state.minePick && !modifying();
    }
    /* Arranging a side's own force before it goes down — who is held back, who
       rides in what, Battlefield Insertion — is that side's to do on its turn to
       place; or once everyone is down, before the battle begins; or while it has
       nothing to put on the table at all (an Invasion's attacker, all in its
       waves, sorting them while the defender sets up). Not while the other side
       is placing, once it has had its turn: that could hand it back a unit to place. */
    function mayArrange(side) {
      // (the swaps still open is no bar: sorting a side's own reserves puts nothing on the table)
      if (state.phase !== 'deploy' || state.placeAsk || state.minePick) return false;
      // a side entering in turn 1 places nothing now: its own force is its to sort at any time
      if (K.entering(side)) return true;
      var ps = K.placingSide();
      if (ps === side || ps === null) return true;
      return !state.units.some(function (u) { return u.side === side && u.alive && (u.x >= 0 || (!u.reserve && !u.aboard)); });
    }
    // the armies still being modified: a hotseat's secret round, or a player yet to continue to deployment
    function modifying() { return !!state.swapStage || K.stillChoosing().length > 0; }
    /* The terrain set-up goes an area at a time, and each area is one side's
       to lay (p. 47). Nobody else may touch it while it is being laid. */
    function terrainSide() {
      var a = K.curArea();
      return a ? a.side : null;
    }
    function mayLay(side) {
      return state.phase === 'terrain' && terrainSide() === side && !isAI(side);
    }
    function relocating(side) {
      return !!state.relocating && state.relocating.side === side;
    }
    function mayAct(side) {
      if (state.phase !== 'battle' || state.over) return false;
      if (ui.insertion || state.cmdOffer || state.martyrAsk || state.kyfAsk || state.standAsk || state.faceAsk || state.endAsk) return false;   // an answer is owed first
      if (state.relocating || state.placeAsk) return false;      // turn 1's relocations and fortifications come before the Action phase
      return state.activeSide === side;
    }
    function selected(side) {
      var u = ui.selected;
      return u && u.alive && u.side === side ? u : null;
    }
    function unitOf(id, side) {
      var u = K.byId(id);
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

    /* The intents, each a handler under its name: `on(names, guard, run)`. A
       guard is one of the common checks before any handler runs — whose
       activation it is ('act'), whose turn it is to place ('deploy') — and each
       handler returns yes, or no(why). */
    var INTENTS = {};
    var GUARD = {
      act: function (side) { return mayAct(side) ? null : 'not your activation'; },
      deploy: function (side) { return mayDeploy(side) ? null : 'not your turn to place'; }
    };
    // what changes a side's deployment once it has said it is ready to begin
    var UNREADY = { deploy: 1, autodeploy: 1, holdback: 1, insertion: 1, load: 1, unload: 1, garrison: 1,
      vface: 1, vfaceall: 1, digface: 1, holdinsert: 1, insert: 1, mine: 1 };
    function on(names, guard, run) {
      names.split(' ').forEach(function (n) { INTENTS[n] = { guard: guard && GUARD[guard], run: run }; });
    }

    /* ---- choosing, which changes nothing on the table ---- */
    on('select', null, function (side, it) {
      var u = unitOf(it.id);
      if (!u) return no('no such unit');
      if (!mayAct(side) && state.phase === 'battle') return no('not your activation');
      var hjk = K.hijacked();
      if (hjk && u !== hjk && u.side === side) return no(hjk.name + ' is hacked: act with it first');
      /* A unit half-way through an Advance has to finish it first; left
         behind, it could come back later in the turn for a whole action. */
      if (state.remark && state.remark.side === side && u.id !== state.remark.by) {
        return no('the marker is naming its second target — pick one, or Cancel');
      }
      if (state.cmdAct && u.side === side && u.id !== state.cmdAct.veh && !(K.byId(state.cmdAct.veh) || {}).activated) {
        return no('the Command Unit aboard is taking its action');
      }
      if (state.rush && state.phase === 'battle' && u.side === side && u.id !== state.rush) {
        var rsh = K.byId(state.rush);
        return no((rsh ? rsh.name : 'the rushing unit') + ' is taking its second action of the Adrenaline Rush');
      }
      var mid = ui.selected;
      if (mid && mid !== u && mid.advancing && !mid.activated) {
        return no(mid.name + ' is half-way through its Advance — let it shoot, or hold its fire, first');
      }
      if (mid && mid !== u && (mid.loading || mid.unloading) && !mid.activated) {
        return no(mid.name + ' is still ' + (mid.loading ? 'taking troops on' : 'putting troops down') + ' — load the next, or Cancel to drive on');
      }
      ui.selected = u; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.sections = [];
      ui.preview = null; ui.hint = null;
      focusUnit(u);
      return yes;
    });
    on('action', 'act', function (side, it) {
      var a = selected(side);
      if (!a) return no('nothing of yours is selected');
      if (!K.actionState(a, it.id).on) return no('that action is not available');
      K.chooseAction(it.id);
      return yes;
    });
    /* ---- deployment ---- */
    on('deploypick', 'deploy', function (side, it) {
      var p = unitOf(it.id, side);
      if (!p) return no('no such unit');
      K.pickToDeploy(p.id);
      return yes;
    });
    on('deploy', null, function (side, it) {
      K.readyToDeploy(side);                // putting a unit down is getting on with the deployment
      if (modifying()) return no('the other side is still modifying its army');
      if (state.swapAsk && state.swapAsk.side === side) K.swapsDone();   // placing a unit keeps the list
      if (!mayDeploy(side)) return no('not your turn to place');
      settleFacing();
      return deployAt(side, it);
    });
    on('autosplit', null, function (side, it) {
      if (state.phase !== 'deploy') return no('not deploying');
      if (!mayArrange(side)) return no('not your turn to set up');
      K.autoSplit(side);                        // the sender's own (the OpFor's already stands)
      render();
      return yes;
    });
    on('holdback', null, function (side, it) {
      if (state.phase !== 'deploy') return no('not deploying');
      if (!mayArrange(side)) return no('not your turn to set up');
      var why = K.toggleHold(side, it.id);
      if (why) return no(why);
      render();
      return yes;
    });
    on('insertion', null, function (side, it) {
      if (state.phase !== 'deploy') return no('not deploying');
      if (!mayArrange(side)) return no('not your turn to set up');
      var whyI = K.toggleInsertion(side, it.id);
      if (whyI) return no(whyI);
      render();
      return yes;
    });
    on('laststand', null, function (side, it) {
      var ls = unitOf(it.id, side);
      if (!ls) return no('no such unit');
      if (state.standAsk && state.standAsk.unit === ls.id && ui.standThen) { ui.standThen(true); return yes; }
      if (!standable(ls)) return no(spent(ls, 'lastStand') ? 'Last Stand is spent' : 'nothing to make a stand against');
      makeStand(ls);
      render();
      return yes;
    });
    on('stand nostand', null, function (side, it) {
      var sa = state.standAsk;
      if (!sa || sa.side !== side || !ui.standThen) return no('nothing to answer');
      ui.standThen(it.k === 'stand');
      return yes;
    });
    /* ---- the End phase: carry on to the next turn, or surrender ---- */
    on('enddone surrender', null, function (side, it) {
      var why = K.endAnswer(side, it.k === 'surrender' ? 'surrender' : 'done');
      return why ? no(why) : yes;
    });
    on('rpick', null, function (side, it) {
      var rp = ui.reservePick;
      if (!rp || rp.side !== side) return no('nothing to choose');
      if (rp.ids.indexOf(it.id) < 0) return no('that unit is not waiting');
      var at = rp.chosen.indexOf(it.id);
      if (at >= 0) rp.chosen.splice(at, 1);
      else if (rp.chosen.length < rp.max) rp.chosen.push(it.id);
      else if (rp.max === 1) rp.chosen = [it.id];
      else return no('that is as many as may come on');
      render();
      return yes;
    });
    on('rpickdone', null, function (side, it) {
      var rq = ui.reservePick;
      if (!rq || rq.side !== side) return no('nothing to choose');
      if (rq.chosen.length < rq.min || rq.chosen.length > rq.max) return no('choose ' + rq.min + (rq.max !== rq.min ? '-' + rq.max : '') + ' units');
      rq.finish();
      return yes;
    });
    on('autodeploy', null, function (side, it) {
      if (state.phase !== 'deploy') return no('not deploying');
      K.readyToDeploy(side);
      if (modifying()) return no('the other side is still modifying its army');
      // deploying straight away means keeping the list as it is
      if (state.swapAsk && state.swapAsk.side === side) K.swapsDone();
      /* Where both companies enter in turn 1 there is nothing to place now: Auto-deploy
         means "bring my units on for me" when their turn to enter comes. */
      if (K.entering(side)) {
        state.autoEnter = state.autoEnter || {};
        state.autoEnter[side] = true;
        render();
        return yes;
      }
      // the side whose turn it is to place, and no other: the other side waits for it (with everyone down, nothing to do)
      if (K.placingSide() !== null && !mayDeploy(side)) return no('not your turn to place');
      var hand = state.units.filter(function (u) { return u.side === side && u.x < 0; });
      K.autoDeploy(side);
      // placed for the player, but which way each hull faces is still theirs to say
      if (!K.askFacing(side, hand.filter(function (u) { return u.x >= 0; }), null, true)) render();
      return yes;
    });
    on('load', null, function (side, it) {
      if (state.phase !== 'deploy') return no('not deploying');
      if (!mayArrange(side)) return no('not your turn to set up');
      var hull = unitOf(it.hull, side), rider = unitOf(it.unit, side);
      if (!hull || !rider) return no('no such unit');
      /* A drop platform "has to start the battle with a single infantry unit
         onboard" (p. 79): a full one swaps its squad for this one. */
      var pod = R.has(hull, 'Immobile') && hull.transport, was = pod && (hull.cargo || []).length >= hull.transport ? hull.cargo[0] : null;
      if (was) K.unloadBefore(hull, was);
      if (!K.loadBefore(hull, rider)) { if (was) K.loadBefore(hull, was, true); return no('there is no room aboard'); }
      render();
      return yes;
    });
    on('unload', null, function (side, it) {
      if (state.phase !== 'deploy') return no('not deploying');
      if (!mayArrange(side)) return no('not your turn to set up');
      var uh = unitOf(it.hull, side), ur = unitOf(it.unit, side);
      if (!uh || !ur) return no('no such unit');
      if (R.has(uh, 'Immobile') && uh.transport) return no('a drop platform starts the battle with a squad aboard (p. 79): put another in instead');
      K.unloadBefore(uh, ur);
      render();
      return yes;
    });
    on('garrison', null, function (side, it) {
      /* Setting a unit up inside a building at deployment. The building is
         found again here from the tap rather than taken on trust. */
      if (!mayDeploy(side)) return no('not your turn to place');
      var gu = it.id ? unitOf(it.id, side) : K.deployNext();
      if (!gu || gu.side !== side) return no('no such unit');
      var gs = K.garrisonAt(+it.x, +it.y);
      if (!gs) return no('there is no building there');
      var gq = gs.rect, gOcc = R.occupant(state, gs.piece, gs.sec);
      if (!K.garrisonable(gu)) return no(gu.name + ' cannot go into a building');
      if (gOcc && gOcc !== gu) return no('that building already has ' + gOcc.name + ' in it');
      if (!K.deployOK(side, gq.x + gq.w / 2, gq.y + gq.h / 2, gu)) return no('that building is outside your deployment area');
      R.enterBuilding(state, gu, gs.piece, gs.sec);
      ui.deployPick = null;
      setHint(null, gu.name + ' sets up inside the building.');
      render();
      return yes;
    });
    /* One more activation, please: how a watched battle is walked forward,
     the client asking again once it has finished drawing the last one. */
    on('step', null, function (side, it) {
      if (state.phase !== 'battle' || !canAI()) return no('nothing to step');
      maybeAI();
      return yes;
    });
    on('deployready', null, function (side, it) {
      if (state.phase !== 'deploy' || !state.deployReady || state.deployReady[side] !== false) return no('nothing to continue from');
      K.readyToDeploy(side);
      return yes;
    });
    on('swapopen', null, function (side, it) {
      if (!K.canSwapNow(side)) return no('the list can no longer be changed');
      state.swapAsk = state.swapAvail[side];
      state.swapAsk.pick = null;
      render();
      return yes;
    });
    on('swappick swapin swapdone swapundo', null, function (side, it) {
      var sa2 = state.swapAsk;
      if (!sa2 || sa2.side !== side) return no('nothing to swap');
      if (it.who && it.who !== side) return no('that was the other player\u2019s list');
      if (it.k === 'swapdone') { K.swapsDone(); return yes; }
      if (it.k === 'swappick') { sa2.pick = it.id || null; render(); return yes; }
      if (it.k === 'swapundo') {
        var un = K.undoSwap(side, it.id);
        if (un) { setHint(null, un); render(); return no(un); }
        return yes;
      }
      var sw = K.doSwap(side, sa2.pick, it.id);
      if (sw) { setHint(null, sw); render(); return no(sw); }
      return yes;
    });
    on('placeat placerot placedone placekind placelen placeauto', null, function (side, it) {
      var pa = state.placeAsk;
      if (!pa || pa.side !== side) return no('nothing to place');
      if (it.k === 'placerot') { pa.vertical = !pa.vertical; render(); return yes; }
      if (it.k === 'placedone') { K.placeDone(); return yes; }
      if (it.k === 'placekind' || it.k === 'placelen' || it.k === 'placeauto') {
        if (pa.kind !== 'fort') return no('nothing to choose');
        if (it.k === 'placeauto') { K.placeAuto(); return yes; }
        if (it.k === 'placekind') {
          if (it.kind !== 'bunker' && !SC.FORT_KINDS[it.kind]) return no('not a fortification');
          if (it.kind === 'bunker' && !pa.bunkers) return no('the bunker is already down');
          if (it.kind !== 'bunker' && !pa.sections) return no('all ten sections are down');
          pa.piece = it.kind;
        } else pa.len = Math.max(2, Math.min(6, Math.round(+it.len) || 6));
        render(); return yes;
      }
      var pw = K.placeAt(+it.x, +it.y);
      if (pw) { setHint(null, pw); render(); return no(pw); }
      return yes;
    });
    on('mine', null, function (side, it) {
      var mp = state.minePick;
      if (!mp || mp.side !== side) return no('nothing to mine');
      var mi = +it.i;
      if (mi >= 0 && mp.pool.indexOf(mi) < 0) return no('that cannot be mined');
      state.mined = mi >= 0 ? { side: side, piece: state.terrain[mi] } : null;
      state.minePick = null;
      logLine('note', sideName(side) + (mi >= 0 ? ' has quietly mined a piece of the table.' : ' leaves the charges in the crates.'));
      render();
      return yes;
    });
    on('start', null, function (side, it) {
      if (state.phase !== 'deploy') return no('already under way');
      if (state.minePick) return no('the mined piece has not been chosen');
      if (state.placeAsk) return no('there are pieces still to place');
      settleFacing();
      if (modifying()) return no('the armies are still being modified');
      if (state.swapAsk) K.swapsDone();
      if (!K.deploymentDone()) return no('there are still units to place');
      /* Two players at two screens: each says they are ready, and the battle
         begins once both have — neither can start it on the other. */
      if (bothConfirm()) {
        state.startReady = state.startReady || { A: false, B: false };
        state.startReady[side] = true;
        if (!(state.startReady.A && state.startReady.B)) {
          logLine('note', sideName(side) + ' is ready to begin the battle.');
          render();
          return yes;
        }
        state.startReady = null;
      }
      K.startBattle();
      return yes;
    });
    // an online battle: two people at two screens, and neither may start it alone
    function bothConfirm() {
      var c = state.cfg || {};
      return !!c.readyUp && c.mode === 'hotseat' && !(c.aiSides || []).length && !state.solo;
    }
    /* ---- Rapid Relocation (O3, p. 87) ---- */
    on('relocpick', null, function (side, it) {
      if (!relocating(side)) return no('you are not relocating');
      relocPick(it.id);
      return yes;
    });
    on('relocdone', null, function (side, it) {
      if (!relocating(side)) return no('you are not relocating');
      finishRelocation();
      return yes;
    });
    on('reloctap', null, function (side, it) {
      if (!relocating(side)) return no('you are not relocating');
      relocTap({ x: +it.x, y: +it.y });
      return yes;
    });
    /* ---- laying the terrain by hand (pp. 46-47) ---- */
    on('terraintap', null, function (side, it) {
      if (!mayLay(side)) return no('this area is not yours to lay');
      K.terrainTap({ x: +it.x, y: +it.y });
      return yes;
    });
    on('terrain', null, function (side, it) {
      if (!mayLay(side)) return no('this area is not yours to lay');
      if (['talt', 'tnext', 'tauto', 'tautoall', 'trotate'].indexOf(it.act) < 0) return no('unknown terrain step');
      K.terrainAct(it.act, it.arg);
      return yes;
    });
    /* ---- a unit coming in ---- */
    on('insert', null, function (side, it) {
      if (!ui.insertion) return no('nothing is coming in');
      if (insertionSide() !== side) return no('that is not your unit');
      K.placeInsertion({ x: +it.x, y: +it.y });
      return yes;
    });
    on('holdinsert', null, function (side, it) {
      if (!ui.insertion || ui.insertion.kind !== 'insert') return no('nothing to hold back');
      if (insertionSide() !== side) return no('that is not your unit');
      K.holdInsertion();
      return yes;
    });
    on('kyf nokyf', null, function (side, it) {
      if (!state.kyfAsk || state.kyfAsk.side !== side || !ui.kyfThen) return no('nothing to answer');
      ui.kyfThen(it.k === 'kyf');
      return yes;
    });
    on('martyr nomartyr', null, function (side, it) {
      var ma = state.martyrAsk;
      if (!ma || ma.side !== side || !ui.martyrThen) return no('nothing to answer');
      ui.martyrThen(it.k === 'martyr');
      return yes;
    });
    on('cmdcoord cmdskip', null, function (side, it) {
      if (!state.cmdOffer) return no('nothing is offered');
      var ov = K.byId(state.cmdOffer.veh);
      if (!ov || ov.side !== side) return no('not your vehicle');
      answerCmdOffer(it.k === 'cmdcoord');
      return yes;
    });
    on('cmdact', null, function (side, it) {
      var co = state.cmdOffer;
      if (!co) return no('nothing is offered');
      var cv = K.byId(co.veh);
      if (!cv || cv.side !== side) return no('not your vehicle');
      if (!(co.acts || []).some(function (a) { return a.id === it.id && a.id !== 'coordinate'; })) return no('that action is not offered');
      answerCmdOffer(it.id);
      return yes;
    });
    // which of the side's waiting units comes on in this turn
    on('arrivepick', null, function (side, it) {
      if (!ui.insertion || ui.insertion.kind !== 'arrive') return no('nothing is coming on');
      if (insertionSide() !== side) return no('that is not your unit');
      var why = K.pickArrival(it.id);
      if (why) return no(why);
      render();
      return yes;
    });
    on('holdarrive', null, function (side, it) {
      // Semper Fidelis: a unit offered an early arrival may wait for its roll instead
      if (!ui.insertion || !ui.insertion.unit) return no('nothing to hold back');
      if (insertionSide() !== side) return no('that is not your unit');
      K.holdArrival();
      return yes;
    });
    /* ---- acting ---- */
    on('move advance markmove wave disembark strafe', null, function (side, it) {
      if (!mayAct(side) || !selected(side)) return no('not your activation');
      var spot = spotFrom(it);
      if (!spot) return no('that is out of reach');
      if (it.k === 'markmove') K.doMarkMove(spot);
      else if (it.k === 'wave') K.doWave(ui.selected, spot);
      else if (it.k === 'disembark') K.doDisembark(spot);
      else if (it.k === 'strafe') K.doStrafe(spot);
      else K.doMove(spot);
      return yes;
    });
    on('target', null, function (side, it) {
      if (!mayAct(side) || !selected(side)) return no('not your activation');
      var t = K.byId(it.id);
      if (!t || ui.targets.indexOf(t) < 0) return no('not a legal target');
      if (ui.mode === 'assault') K.doAssault(t);
      else if (ui.mode === 'designate') K.doDesignate(t);
      else if (ui.mode === 'embark') K.doEmbark(t);
      else if (ui.mode === 'teleport') K.doTeleport(ui.selected, t);
      else if (ui.mode === 'teleport-dest') K.finishTeleport(ui.teleport, t);
      else if (ui.mode === 'hack') K.doHack(t);
      else if (ui.mode === 'support') K.doSupport(t);
      else if (ui.mode === 'steady') K.doSteady(t);
      else K.doShoot(t);
      return yes;
    });
    /* ---- buildings ---- */
    on('enter', null, function (side, it) {
      if (!mayAct(side) || !selected(side)) return no('not your activation');
      if (ui.mode !== 'enter') return no('not going into a building');
      var bp = state.terrain[it.piece];
      var sec = (ui.sections || []).filter(function (q) { return q.piece === bp && q.sec === (+it.sec || 0); })[0];
      if (!sec) return no('that building is not one it can go into');
      K.doEnter(ui.selected, sec);
      return yes;
    });
    on('exitbld', null, function (side, it) {
      if (!mayAct(side) || !selected(side)) return no('not your activation');
      if (ui.mode !== 'exitbld') return no('not coming out of a building');
      var xs = spotFrom(it);
      if (!xs) return no('come out within 4" of the wall');
      K.doExitBld(ui.selected, xs);
      return yes;
    });
    on('leave', null, function (side, it) {
      if (!mayAct(side) || !selected(side)) return no('not your activation');
      if (ui.mode !== 'leave') return no('not leaving the table');
      var ls = spotFrom(it);
      if (!ls) return no('go off from the lit ground at the edge');
      K.doLeave(ui.selected, ls);
      return yes;
    });
    on('piece', null, function (side, it) {
      if (!mayAct(side) || !selected(side)) return no('not your activation');
      var r = state.terrain[it.i];
      if (!r || ui.terrain.indexOf(r) < 0) return no('not a legal piece');
      if (ui.mode === 'breach') K.doBreach(r); else K.doDemolish(r);
      return yes;
    });
    on('digface', null, function (side, it) {
      // Dig in!: the facing chosen, as a bearing (it is put on the nearest of the eight)
      if (!mayAct(side) || !selected(side)) return no('not your activation');
      if (ui.mode !== 'digface' || !ui.selected || !R.has(ui.selected, 'Stationary Artillery')) return no('not digging in');
      if (typeof it.dir !== 'number' || !isFinite(it.dir)) return no('which way?');
      K.finishStance(ui.selected, R.nearestFacing(it.dir));
      return yes;
    });
    on('vface vfaceall', null, function (side, it) {
      // which way a vehicle just put down faces; 'vfaceall' keeps the one offered for it and any still to ask about
      var fa = state.faceAsk;
      if (!fa || fa.side !== side) return no('nothing to face');
      if (it.k === 'vface' && (typeof it.dir !== 'number' || !isFinite(it.dir))) return no('which way?');
      // turning on the spot at the end of a move: only as far as what is left of the move pays for
      if (it.k === 'vface' && fa.pivot) {
        var pu = K.byId(fa.ids[0]);
        if (pu && R.turnCost(pu, fa.pivot.from, R.nearestFacing(it.dir)) > fa.pivot.left + 1e-6) return no('not enough of its move left to turn that far');
      }
      K.answerFacing(it.k === 'vface' ? it.dir : null);
      return yes;
    });
    on('cancel', 'act', function (side, it) {
      // a marker's second call, let go
      if (state.remark && state.remark.side === side) { K.declineSecondMark(); return yes; }
      // half-way through an Advance there is nothing to go back to: it holds its fire
      var adv = ui.selected;
      if (adv && adv.advancing && !adv.activated && adv.side === side) { K.holdFire(adv); return yes; }
      // loading or unloading a squad at a time: that is enough, now the hull may drive
      if (adv && (adv.loading || adv.unloading) && adv.side === side) {
        adv.loading = false; adv.unloading = false; adv.activated = true; K.carryMove(adv); return yes;
      }
      if (adv && (adv.carrying || adv.carryMoved) && adv.side === side) { K.stayPut(adv); return yes; }
      ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.sections = []; ui.preview = null;
      render();
      return yes;
    });

    function intent(seat, it) {
      if (!state) return no('no battle');
      if (!it || typeof it.k !== 'string') return no('unreadable intent');
      var side = K.sideOfSeat(seat);
      if (state.over && it.k !== 'chat') return no('the battle is over');
      var h = Object.prototype.hasOwnProperty.call(INTENTS, it.k) ? INTENTS[it.k] : null;
      if (!h) return no('unknown intent: ' + it.k);
      var why = h.guard && h.guard(side, it);
      if (why) return no(why);
      var res = h.run(side, it);
      // a player who was ready and then changes their deployment has to say so again
      if (res && res.ok && state && state.startReady && state.startReady[side] && UNREADY[it.k]) {
        state.startReady[side] = false;
        render();
      }
      return res;
    }

    function insertionSide() {
      var ins = ui.insertion;
      if (!ins) return null;
      if (ins.by) return ins.by;       // the opponent shoving an insertion off its mark
      if (ins.unit) return ins.unit.side;
      return 'A';                      // a landing zone is always the players' own
    }

    /* Putting a unit down before the battle. A tap that misses the strip by a
       little is pulled onto it, exactly as it is on one screen. */
    function deployAt(side, it) {
      var pending = it.id ? K.byId(it.id) : K.deployNext();
      if (!pending || pending.side !== side) return no('no such unit');
      /* A unit the scenario holds back is brought on through the split; one held
         for Battlefield Insertion, set down on the table, deploys like the rest
         (p. 56: it "can" come in that way, not must). */
      if (pending.reserve) {
        if (pending.wave === 2) return no(pending.name + ' is held back by the scenario — bring it onto the table in Reserves first');
        if (K.toggleInsertion(side, pending.id)) return no(pending.name + ' is in reserve');
      }
      if (pending.x < 0 && K.deployNext() !== pending) ui.deployPick = pending.id;
      var p = { x: +it.x, y: +it.y };
      var clear = K.deployOK(side, p.x, p.y, pending) &&
        !R.barredAt(state, pending, p.x, p.y) &&
        !R.unitNear(state, p.x, p.y, pending, 1);
      if (!clear) {
        var near = K.nearestDeploySpot(pending, p.x, p.y, 9);
        if (!near) return no('outside your deployment area');
        p = near;
      }
      // set down on open ground, it is no longer in whatever building it was in
      pending.bld = null; pending.sec = null;
      pending.x = p.x; pending.y = p.y;
      ui.deployPick = null;
      if (!K.askFacing(side, [pending])) render();
      return yes;
    }

    /* ---- starting ---- */
    function start(cfg) {
      newGame(cfg);
      return state;
    }

    makeKits();

    return {
      start: start,
      intent: intent,
      snapshot: K.snapshot,
      load: K.load,
      state: function () { return state; },
      sel: function () { return ui; },
      over: function () { return state && state.over; },
      report: function () { return state && state.report; },
      /* Queries a client runs over a battle it is only watching: what a unit may
         do, where it may go, what it may shoot. None of them roll a die or
         change anything, so both sides can ask freely. */
      query: {
        actionState: function (u, id) { return K.actionState(u, id); },
        specialsFor: function (u) { return specialsFor(u); },
        targetsFor: function (u, o) { return K.targetsFor(u, o); },
        eligible: function (s) { return eligible(s); },
        deployOK: function (s, x, y, u) { return K.deployOK(s, x, y, u); },
        deployNext: K.deployNext,
        deployRoster: K.deployRoster,
        deploymentDone: K.deploymentDone,
        splitFor: K.splitFor, insertionFor: K.insertionFor,
        placingSide: K.placingSide,
        zoneFor: K.zoneFor,
        zoneCentre: K.zoneCentre,
        boxesFor: K.boxesFor,
        nearestDeploySpot: K.nearestDeploySpot,
        deployWhere: deployWhere,
        roleOf: roleOf,
        roleSentence: roleSentence,
        arrivalWhere: K.arrivalWhere,
        markHint: K.markHint,
        markReach: K.markReach,
        canStand: K.canStand,
        moveBonus: moveBonus,
        demolishTargets: demolishTargets,
        breachTargets: breachTargets,
        activeUnits: K.activeUnits,
        onTable: K.onTable,
        byId: K.byId,
        sideName: sideName,
        other: other,
        carriersFor: K.carriersFor,
        boardableFor: K.boardableFor,
        emptyPlatforms: K.emptyPlatforms,
        forcedCharge: K.forcedCharge,
        snapToSpot: K.snapToSpot,
        insertionLegal: K.insertionLegal,
        // Modifying the armies: what could stand in for this unit
        canSwapNow: function (side) { return K.canSwapNow(side); },
        swapOptions: function (side, id) {
          return K.swapOptions(side, K.byId(id)).map(function (o) { return { id: o.id, name: o.name, key: o.key }; });
        },
        arrivalLegal: K.arrivalLegal,
        /* Who holds each objective as things stand. The board shows it live,
           between the End phases that actually score it. */
        scoreObjectives: K.scoreObjectives,
        insertionSpots: K.insertionSpots,
        arrivalSpots: K.arrivalSpots,
        // both companies enter in turn 1's Reserve phase: nothing is placed before the battle
        entering: function (side) { return K.entering(side); },
        markTargets: K.markTargets,
        inReserve: K.inReserve,
        unitById: K.unitById,
        playerSide: playerSide,
        soloOwnerName: K.soloOwnerName,
        docsOf: docsOf,
        spent: spent,
        objDist: K.objDist,
        unbroken: unbroken,
        isAI: isAI,
        fromLog: K.fromLog,
        /* The OpFor's opinion of a unit, which the board draws as the odds on a
           target and uses to point the camera. It rolls nothing. */
        bestTarget: K.bestTarget,
        gapToFoes: K.gapToFoes,
        expectedHits: K.expectedHits,
        // the terrain set-up, read by the card that walks a player through it
        curArea: K.curArea, terrainSide: terrainSide, fitGhost: K.fitGhost, clonePiece: K.clonePiece,
        pieceNoun: K.pieceNoun, specRange: K.specRange, placedSummary: K.placedSummary,
        // buildings, garrisons and the rules that ride on them
        garrisonAt: K.garrisonAt, garrisonable: K.garrisonable, garrisonSpots: K.garrisonSpots,
        assaultables: K.assaultables, semperFidelis: K.semperFidelis, sfName: K.sfName,
        relocCap: relocCap, relocSpotOK: relocSpotOK, wantsManualTerrain: K.wantsManualTerrain
      },
      STANDARD: STANDARD,
      SPECIAL_SLOTS: SPECIAL_SLOTS
    };
  }

  root.PMCEngine = {
    create: create, STANDARD: STANDARD, SPECIAL_SLOTS: SPECIAL_SLOTS, COLOURS: COLOURS,
    OBJECTIVES: OBJECTIVES, PIECE_NOUN: PIECE_NOUN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngine;
})(typeof window !== 'undefined' ? window : global);
