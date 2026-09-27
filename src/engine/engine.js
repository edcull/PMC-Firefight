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
   and the rest), each made from create() below the first time it is wanted.
   What stays here is the battle's state, the view port, the setup, and
   intent(): every command from a player or the network comes in there. */
(function (root) {
  'use strict';
  var R = root.PMC, SC = root.PMCScen, GEN = root.PMCGen, C = root.PMCCamp, SOLO = root.PMCSolo;

  var COLOURS = ['ochre', 'steel', 'olive', 'crimson', 'slate', 'plum', 'sand', 'rust', 'jade', 'midnight', 'charcoal', 'hazard', 'rose', 'forest',
    'maroon', 'khaki', 'mud', 'lime', 'teal', 'cobalt', 'sky', 'violet', 'magenta', 'arctic'];
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
    function lookAtDeployment(side) { V.look(side || placingSide()); }
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
      var g = greetArrival(u);
      if (g) pushRes(fromLog('Hot landing zone', g.shooter.name + ' \u2192 ' + u.name, g.shooter.side, g.res.log));
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
      return !!state && !state.over && state.phase === 'battle' && !ui.insertion &&
        !state.martyrAsk && !state.kyfAsk && isAI(state.activeSide);          // a player's Martyrdom answer holds the AI's charge
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
    var manual = wantsManualTerrain(cfg);
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
       have the rule of their own. */
    ['A', 'B'].forEach(function (side) {
      var docs = (state.doctrines && state.doctrines[side]) || [];
      if (docs.indexOf('BB2') < 0 && docs.indexOf('XO2') < 0) return;
      var mine = state.units.filter(function (u) { return u.side === side; });
      var cap = Math.ceil(mine.length / 4);
      mine.filter(function (u) {
        return u.cls === 'infantry' && !R.has(u, 'Battlefield Insertion') && !R.has(u, 'Overmind') && !R.has(u, 'Dominant Species');
      }).slice(0, cap).forEach(function (u) { u.rules.push('Battlefield Insertion'); });
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
    V.clearCards();
    if (manual) { startTerrainSetup(built); return; }
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
          return t.destructible && t.destructible !== 'target';
        });
        if (!pool.length) return;
        state.mined = { side: side, piece: pool[Math.floor(Math.random() * pool.length)] };
      });
    })();
    // a player's Last Stand barricades are placed by hand, once the deployment zones are known
    state.manualLaststand = {};
    ['A', 'B'].forEach(function (sd) { if (state.tactics && state.tactics[sd] === 'laststand' && !isAI(sd)) state.manualLaststand[sd] = true; });
    SC.begin(state, scenId, { attacker: cfg.attacker, roles: cfg.roles });
    // the scenario may have moved or dropped pieces to keep them apart; a mined one must still be there
    if (state.mined && state.terrain.indexOf(state.mined.piece) < 0) {
      var pool2 = state.terrain.filter(function (r) {
        var t = R.TERRAIN[r.kind];
        return t && t.destructible && t.destructible !== 'target';
      });
      state.mined = pool2.length ? { side: state.mined.side, piece: pool2[Math.floor(Math.random() * pool2.length)] } : null;
    }
    /* "the Rebel player may secretly choose" the piece (p. 112): a player picks
       it — or none — before deploying; only the AI's is drawn for it. */
    if (state.mined && !isAI(state.mined.side)) {
      var mpool = state.terrain.map(function (r, i) {
        var t = R.TERRAIN[r.kind];
        return t && t.destructible && t.destructible !== 'target' ? i : -1;
      }).filter(function (i) { return i >= 0; });
      state.minePick = { side: state.mined.side, pool: mpool };
      state.mined = null;
    }
    // Detailed Terrain Knowledge: the AI moves its pieces now; a player does, by hand, before deploying
    state.placeQueue = [];
    ['A', 'B'].forEach(function (side) {
      if (docsOf(side).indexOf('XO4') < 0) return;
      if (isAI(side)) terrainKnowledge(side);
      else state.placeQueue.push({ side: side, kind: 'move', why: 'terrain', left: 2, total: 2 });
    });
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
    beginSwaps();
  }
  /* ---- modifying the armies before the battle: in engine/swaps.js ---- */
  var KIT_SWAPS = null;
  function kitSwaps() {
    return KIT_SWAPS || (KIT_SWAPS = (root.PMCEngineSwaps || require('./swaps.js'))({
      R: R, byId: byId, docsOf: docsOf, isAI: isAI, logLine: logLine, lookAtDeployment: lookAtDeployment,
      makeUnit: makeUnit, pushRes: pushRes, render: render, sideName: sideName, get state() { return state; }
    }));
  }
  function swapOptions(side, u) { return (KIT_SWAPS || kitSwaps()).swapOptions(side, u); }
  function beginSwaps() { return (KIT_SWAPS || kitSwaps()).beginSwaps(); }
  function canSwapNow(side) { return (KIT_SWAPS || kitSwaps()).canSwapNow(side); }
  function doSwap(side, outId, inId) { return (KIT_SWAPS || kitSwaps()).doSwap(side, outId, inId); }
  function swapsDone() { return (KIT_SWAPS || kitSwaps()).swapsDone(); }

  function finishSetup(built) {
    var cfg = state.cfg;
    ['A', 'B'].forEach(markReserves);
    SC.deploy(state);
    nextPlace();
    seatPlatforms();             // every drop pod comes down with somebody in it
    baselineSplits();
    clearSplits();               // the players choose their own reserves
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
    state.scene = null; state.ground = null; state.structs = null;
    /* Open on a view that shows enough of the table to place a force in. On a
       phone the board now fills the screen, so a step above "the whole table" is
       readable; on a desktop it is a step above that again. */
    V.newTable();
    state.cfg.aiSides.forEach(function (s2) { autoDeploy(s2); });
    /* Hero of the People (p. 111): the locals have already told the revolt where
       the enemy is putting everyone. Against the OpFor that is how the game
       always worked — it deploys first. In hotseat, half the other side goes
       down before the rebel player places a single unit. */
    ['A', 'B'].forEach(function (side) {
      var docs = (state.doctrines && state.doctrines[side]) || [];
      if (docs.indexOf('H2') < 0) return;
      var foe = side === 'A' ? 'B' : 'A';
      if (isAI(foe)) return;                     // already on the table
      var n = state.units.filter(function (u) { return u.side === foe && !u.reserve; }).length;
      autoDeploy(foe, Math.ceil(n / 2));
      logLine('note', 'Hero of the People — the locals have talked. Half of ' + sideName(foe) +
        '\u2019s force is already placed.');
    });
    /* Look at the ground the player is being asked to fill. Zoomed in on a phone
       the middle of the table is nowhere near their own edge, and every tap used
       to land outside the strip with nothing on screen to say where it was. */
    lookAtDeployment();
    render();
    if (state.cfg.aiSides.length === 2) startBattle();
  }

  function isAI(side) { return state.cfg.aiSides.indexOf(side) >= 0; }
  /* ---- laying the terrain: in engine/terrainsetup.js ---- */
  var KIT_TERRAINSETUP = null;
  function kitTerrainSetup() {
    return KIT_TERRAINSETUP || (KIT_TERRAINSETUP = (root.PMCEngineTerrainSetup || require('./terrainsetup.js'))({
      GEN: GEN, H: H, OBJECTIVES: OBJECTIVES, PIECE_NOUN: PIECE_NOUN, R: R, SFX: SFX, V: V, W: W,
      afterTerrain: afterTerrain, deployOK: deployOK, fitView: fitView, isAI: isAI, logLine: logLine,
      other: other, pushRes: pushRes, queueBake: queueBake, render: render, revealConsole: revealConsole,
      setHint: setHint, sideName: sideName, startBattle: startBattle, ui: ui, get state() { return state; }
    }));
  }
  function pieceNoun(spec, n) { return (KIT_TERRAINSETUP || kitTerrainSetup()).pieceNoun(spec, n); }
  function specRange(spec) { return (KIT_TERRAINSETUP || kitTerrainSetup()).specRange(spec); }
  function wantsManualTerrain(cfg) { return (KIT_TERRAINSETUP || kitTerrainSetup()).wantsManualTerrain(cfg); }
  function startTerrainSetup(built) { return (KIT_TERRAINSETUP || kitTerrainSetup()).startTerrainSetup(built); }
  function curArea() { return (KIT_TERRAINSETUP || kitTerrainSetup()).curArea(); }
  function placedSummary(a) { return (KIT_TERRAINSETUP || kitTerrainSetup()).placedSummary(a); }
  function clonePiece(t) { return (KIT_TERRAINSETUP || kitTerrainSetup()).clonePiece(t); }
  function fitGhost(a, cx, cy) { return (KIT_TERRAINSETUP || kitTerrainSetup()).fitGhost(a, cx, cy); }
  function terrainTap(p) { return (KIT_TERRAINSETUP || kitTerrainSetup()).terrainTap(p); }
  function terrainAct(act, arg) { return (KIT_TERRAINSETUP || kitTerrainSetup()).terrainAct(act, arg); }
  function terrainKnowledge(side) { return (KIT_TERRAINSETUP || kitTerrainSetup()).terrainKnowledge(side); }
  function nextPlace() { return (KIT_TERRAINSETUP || kitTerrainSetup()).nextPlace(); }
  function placeAt(x, y) { return (KIT_TERRAINSETUP || kitTerrainSetup()).placeAt(x, y); }
  function placeDone() { return (KIT_TERRAINSETUP || kitTerrainSetup()).placeDone(); }

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
  var KIT_DEPLOY = null;
  function kitDeploy() {
    return KIT_DEPLOY || (KIT_DEPLOY = (root.PMCEngineDeploy || require('./deploy.js'))({
      H: H, R: R, SC: SC, UR: UR, W: W, abShoot: abShoot, aiRelocate: aiRelocate, beginTurn: beginTurn,
      boardableFor: boardableFor, byId: byId, docsOf: docsOf, finishRelocation: finishRelocation,
      focusUnit: focusUnit, fortify: fortify, isAI: isAI, loadBefore: loadBefore, logLine: logLine,
      lookAtDeployment: lookAtDeployment, nextPlace: nextPlace, other: other, pushRes: pushRes,
      relocCap: relocCap, render: render, revealBoard: revealBoard, revealConsole: revealConsole,
      setHint: setHint, sideName: sideName, ui: ui, unloadBefore: unloadBefore, get state() { return state; }
    }));
  }
  function onTable(u) { return (KIT_DEPLOY || kitDeploy()).onTable(u); }
  function activeUnits(side) { return (KIT_DEPLOY || kitDeploy()).activeUnits(side); }
  function zoneFor(side) { return (KIT_DEPLOY || kitDeploy()).zoneFor(side); }
  function deployOK(side, x, y, u) { return (KIT_DEPLOY || kitDeploy()).deployOK(side, x, y, u); }
  function boxesFor(side) { return (KIT_DEPLOY || kitDeploy()).boxesFor(side); }
  function inReserve(side) { return (KIT_DEPLOY || kitDeploy()).inReserve(side); }
  function markReserves(side) { return (KIT_DEPLOY || kitDeploy()).markReserves(side); }
  function insertionLegal(p) { return (KIT_DEPLOY || kitDeploy()).insertionLegal(p); }
  function scatterInsertion(u, after) { return (KIT_DEPLOY || kitDeploy()).scatterInsertion(u, after); }
  function greetArrival(u) { return (KIT_DEPLOY || kitDeploy()).greetArrival(u); }
  function autoDeploy(side, limit) { return (KIT_DEPLOY || kitDeploy()).autoDeploy(side, limit); }
  function garrisonAt(x, y) { return (KIT_DEPLOY || kitDeploy()).garrisonAt(x, y); }
  function garrisonable(u) { return (KIT_DEPLOY || kitDeploy()).garrisonable(u); }
  function garrisonSpots(side, u) { return (KIT_DEPLOY || kitDeploy()).garrisonSpots(side, u); }
  function zoneCentre(side) { return (KIT_DEPLOY || kitDeploy()).zoneCentre(side); }
  function placingSide() { return (KIT_DEPLOY || kitDeploy()).placingSide(); }
  function deployRoster(side) { return (KIT_DEPLOY || kitDeploy()).deployRoster(side); }
  function deployNext() { return (KIT_DEPLOY || kitDeploy()).deployNext(); }
  function pickToDeploy(id) { return (KIT_DEPLOY || kitDeploy()).pickToDeploy(id); }
  function nearestDeploySpot(u, x, y, pull) { return (KIT_DEPLOY || kitDeploy()).nearestDeploySpot(u, x, y, pull); }
  function emptyPlatforms(side) { return (KIT_DEPLOY || kitDeploy()).emptyPlatforms(side); }
  function seatPlatforms() { return (KIT_DEPLOY || kitDeploy()).seatPlatforms(); }
  function splitFor(side) { return (KIT_DEPLOY || kitDeploy()).splitFor(side); }
  function baselineSplits() { return (KIT_DEPLOY || kitDeploy()).baselineSplits(); }
  function toggleHold(side, id) { return (KIT_DEPLOY || kitDeploy()).toggleHold(side, id); }
  function insertionFor(side) { return (KIT_DEPLOY || kitDeploy()).insertionFor(side); }
  function toggleInsertion(side, id) { return (KIT_DEPLOY || kitDeploy()).toggleInsertion(side, id); }
  function clearSplits() { return (KIT_DEPLOY || kitDeploy()).clearSplits(); }
  function autoSplit(side) { return (KIT_DEPLOY || kitDeploy()).autoSplit(side); }
  function splitsOK() { return (KIT_DEPLOY || kitDeploy()).splitsOK(); }
  function deploymentDone() { return (KIT_DEPLOY || kitDeploy()).deploymentDone(); }
  function startBattle() { return (KIT_DEPLOY || kitDeploy()).startBattle(); }

  function relocCap(side) {
    return Math.floor(state.units.filter(function (u) {
      return u.side === side && u.alive && u.x >= 0 && !u.reserve && !u.aboard;
    }).length / 2);
  }

  function finishRelocation() {
    var rl = state.relocating;
    state.relocating = null; ui.deployPick = null;
    if (rl) logLine('note', sideName(rl.side) + ' — Rapid Relocation: ' + rl.moved.length + ' unit' + (rl.moved.length === 1 ? '' : 's') + ' moved.');
    startBattle();
  }

  // a legal new place for a unit inside its own side's deployment ground
  function relocSpotOK(u, x, y) {
    return deployOK(u.side, x, y, u) && !R.TERRAIN[R.terrainAt(state, x, y)].impassable && !R.unitNear(state, x, y, u, 1);
  }

  /* ---- the OpFor: in engine/ai.js ---- */
  var KIT_AI = null;
  function kitAI() {
    return KIT_AI || (KIT_AI = root.PMCEngineAI({
      H: H, R: R, SC: SC, SFX: SFX, UR: UR, W: W, abAssault: abAssault, abRally: abRally, abRepair: abRepair,
      activeUnits: activeUnits, alreadySafe: alreadySafe, animateMove: animateMove,
      assaultables: assaultables, boardAnim: boardAnim, canAnswerMark: canAnswerMark,
      canReachCharge: canReachCharge, chargeAllow: chargeAllow, crushAlong: crushAlong,
      deathsSince: deathsSince, doCheckArea: doCheckArea, doDesignate: doDesignate, doDisembark: doDisembark,
      doEnter: doEnter, doExitBld: doExitBld, doRegain: doRegain, doSelfRepair: doSelfRepair,
      doStance: doStance, doSteady: doSteady, doStrafe: doStrafe, doTeleport: doTeleport, doWave: doWave,
      endActivation: endActivation, faceAfter: faceAfter, forcedCharge: forcedCharge, fromLog: fromLog,
      insertionLegal: insertionLegal, landUnit: landUnit, logLine: logLine, markTargets: markTargets,
      martyrFirst: martyrFirst, moveBonus: moveBonus, nearestDeploySpot: nearestDeploySpot, objDist: objDist,
      onTable: onTable, playAssault: playAssault, pushRes: pushRes, relocCap: relocCap,
      relocSpotOK: relocSpotOK, repaintTerrain: repaintTerrain, repairCard: repairCard,
      resolveShot: resolveShot, samCheck: samCheck, scatterInsertion: scatterInsertion, sideName: sideName,
      snapshotAlive: snapshotAlive, soloAfterMove: soloAfterMove, soundFor: soundFor, stepOff: stepOff,
      ui: ui, whenIdle: whenIdle, get state() { return state; }
    }));
  }
  function aiRelocate(side) { return (KIT_AI || kitAI()).aiRelocate(side); }
  function aiInsert(u, done) { return (KIT_AI || kitAI()).aiInsert(u, done); }
  function aiPadFor(u, pads) { return (KIT_AI || kitAI()).aiPadFor(u, pads); }
  function flightTurn(u) { return (KIT_AI || kitAI()).flightTurn(u); }
  function gapToFoes(u) { return (KIT_AI || kitAI()).gapToFoes(u); }
  function canStand(u, c) { return (KIT_AI || kitAI()).canStand(u, c); }
  function expectedHits(u, t, mode, opts) { return (KIT_AI || kitAI()).expectedHits(u, t, mode, opts); }
  function bestTarget(u, mode, opts) { return (KIT_AI || kitAI()).bestTarget(u, mode, opts); }
  function nearestEnemy(u) { return (KIT_AI || kitAI()).nearestEnemy(u); }
  function aiAct(u) { return (KIT_AI || kitAI()).aiAct(u); }

  // a tap on the table while the player is relocating
  function relocTap(p) {
    var rl = state.relocating;
    var pick = ui.deployPick ? byId(ui.deployPick) : null;
    var under = state.units.filter(function (u) {
      return u.side === rl.side && u.alive && u.x >= 0 && !u.aboard && R.inches(u.x, u.y, p.x, p.y) < 1.1;
    })[0];
    if (under && (!pick || under.id !== pick.id)) { relocPick(under.id); return; }
    if (!pick) { setHint(null, 'Rapid Relocation: tap one of your units first.'); render(); return; }
    var q = relocSpotOK(pick, p.x, p.y) ? p : nearestDeploySpot(pick, p.x, p.y, 9);
    if (!q) { setHint(null, 'Not there — only somewhere your deployment allows.'); render(); return; }
    pick.bld = null; pick.sec = null;
    pick.x = q.x; pick.y = q.y;
    rl.moved.push(pick.id);
    ui.deployPick = null;
    if (SFX) SFX.step();
    var left = rl.cap - rl.moved.length;
    setHint(null, left > 0 ? 'Rapid Relocation: ' + left + ' more unit' + (left === 1 ? '' : 's') + ' may move.' : 'Rapid Relocation: that is half the force. Begin the battle.');
    render();
  }

  function relocPick(id) {
    var rl = state.relocating, u = byId(id);
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
    var foe = state.units.filter(function (u) { return u.side !== side && onTable(u); });
    var mine = state.units.filter(function (u) { return u.side === side && onTable(u) && !R.isMachine(u); });
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
      state.scene = null; state.ground = null; state.structs = null;
      logLine('terrain', sideName(side) + ' — Fortify and Strike!: ' + placed + ' field fortifications thrown up.');
    }
  }
  /* ---- reserves and arrivals: in engine/arrivals.js ---- */
  var KIT_ARRIVALS = null;
  function kitArrivals() {
    return KIT_ARRIVALS || (KIT_ARRIVALS = (root.PMCEngineArrivals || require('./arrivals.js'))({
      H: H, R: R, SC: SC, SNAP_NEAR: SNAP_NEAR, SOLO: SOLO, UR: UR, W: W, aiInsert: aiInsert, byId: byId,
      docsOf: docsOf, fitView: fitView, focusUnit: focusUnit, inReserve: inReserve,
      insertionLegal: insertionLegal, isAI: isAI, landUnit: landUnit, logLine: logLine, other: other,
      pushRes: pushRes, render: render, revealConsole: revealConsole, samCheck: samCheck,
      scatterInsertion: scatterInsertion, setHint: setHint, showArrival: showArrival, sideName: sideName,
      soloOwnerName: soloOwnerName, ui: ui, whenIdle: whenIdle, get state() { return state; }
    }));
  }
  function reservePhase(done) { return (KIT_ARRIVALS || kitArrivals()).reservePhase(done); }
  function arrivalLegal(u, p) { return (KIT_ARRIVALS || kitArrivals()).arrivalLegal(u, p); }
  function arrivalSpots(u) { return (KIT_ARRIVALS || kitArrivals()).arrivalSpots(u); }
  function insertionSpots(u) { return (KIT_ARRIVALS || kitArrivals()).insertionSpots(u); }
  function holdInsertion() { return (KIT_ARRIVALS || kitArrivals()).holdInsertion(); }
  function semperFidelis(u) { return (KIT_ARRIVALS || kitArrivals()).semperFidelis(u); }
  function sfName(u) { return (KIT_ARRIVALS || kitArrivals()).sfName(u); }
  function holdArrival() { return (KIT_ARRIVALS || kitArrivals()).holdArrival(); }
  function arrivalWhere(u) { return (KIT_ARRIVALS || kitArrivals()).arrivalWhere(u); }
  function snapToSpot(ins, p) { return (KIT_ARRIVALS || kitArrivals()).snapToSpot(ins, p); }
  function placeInsertion(p) { return (KIT_ARRIVALS || kitArrivals()).placeInsertion(p); }
  /* ---- the solitaire turn: in engine/solo.js ---- */
  var KIT_SOLO = null;
  function kitSolo() {
    return KIT_SOLO || (KIT_SOLO = (root.PMCEngineSolo || require('./solo.js'))({
      eligible: eligible, focusUnit: focusUnit, logLine: logLine, maybeAI: maybeAI,
      paintStructures: paintStructures, pushRes: pushRes, rallyPhase: rallyPhase, render: render,
      reservePhase: reservePhase, revealBoard: revealBoard, stepOff: stepOff, ui: ui, whenIdle: whenIdle,
      get state() { return state; }
    }));
  }
  function soloOwnerName(o) { return (KIT_SOLO || kitSolo()).soloOwnerName(o); }
  function soloBeginTurn() { return (KIT_SOLO || kitSolo()).soloBeginTurn(); }
  function soloNext() { return (KIT_SOLO || kitSolo()).soloNext(); }

  function beginTurn() {
    if (state.solo) { soloBeginTurn(); return; }
    state.turn += 1;
    state.units.forEach(function (u) {
      u.activated = false; u.marked = false; u.markMoved = false; u.shotFrom = []; u.coordUsed = false;
      u.hackUsed = false; u.hacked = false; u.supportUsed = false; u.advancing = false;
      u.disembarked = false; u.boarded = false;
    });
    state.chain = null; state.rush = null;
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
      reservePhase(function () {
        state.phaseCount = { A: unbroken('A'), B: unbroken('B') };
        state.streak = streakFor(state.activeSide);
        render();
        maybeAI();
      });
    });
  }

  /* The Beginning phase's Rites and Infamies (pp. 142-143). Rite of Unrest: every
     enemy infantry unit within 12" takes a Suppression point. Infamy of Madness:
     a unit with a friend in 12" and sight rolls a D6, and on a 1 fires on it. */
  function beginningRites() {
    state.units.forEach(function (u) {
      if (!onTable(u) || !R.campFlag(u, 'unrest') || R.status(u) === 'broken') return;
      var hit = activeUnits().filter(function (e) {
        return e.side !== u.side && e.cls === 'infantry' && !e.drone && !R.campFlag(e, 'shielding') && R.unitDist(u, e) <= 12;
      });
      hit.forEach(function (e) { R.addSP(e, 1); });
      if (hit.length) logLine('suppressed', 'Rite of Unrest — ' + u.label + ' unsettles ' + hit.map(function (e) { return e.label; }).join(', ') + ': 1 SP each.');
    });
    state.units.forEach(function (u) {
      if (!onTable(u) || !R.campFlag(u, 'madness') || u.fp == null) return;
      var friend = activeUnits(u.side).filter(function (f) { return f !== u && R.unitDist(u, f) <= 12 && R.hasLoS(state, u, f); })[0];
      if (!friend) return;
      var roll = R.d6();
      if (roll !== 1) { logLine('note', u.label + ' — Infamy of Madness: D6 ' + roll + ', it holds its fire.'); return; }
      var res = abShoot(state, u, friend, 'fire', {});
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      pushRes(fromLog('Infamy of Madness', u.name + ' → ' + friend.name, u.side, [{ t: 'note', text: 'D6 1: ' + u.label + ' turns its guns on ' + friend.label + '.' }].concat(res.log)));
    });
  }

  function unbroken(side) {
    // troops still in reserve or riding inside a hull are not on the table
    // turrets are not counted for Overwhelming Numbers (p. 130)
    return state.units.filter(function (u) {
      return onTable(u) && u.side === side && R.status(u) !== 'broken' && !R.has(u, 'Turret');
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
    if (boxesFor(side)) {
      return state.scen && state.scen.id === 'takeover'
        ? 'Place each unit inside the shaded band — you may come on from any table edge you like.'
        : 'Place each unit inside one of the shaded bands — the stretches of table edge that are yours.';
    }
    var z = zoneFor(side);
    if (!z || (sc.zones && sc.zones[side] === null && sc.attacker === side)) {
      return 'Nothing deploys: your whole force comes down into the landing zones in the first Reserve phase.';
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
    if (state.rush) {
      var ru = byId(state.rush);
      if (ru && ru.side === side) return ru.alive && !ru.activated && !ru.aboard && R.status(ru) !== 'broken' ? [ru] : [];
    }
    // a marker that stood still is naming its second target: nothing else goes until it has
    if (state.remark && state.remark.side === side) {
      var rm = byId(state.remark.by);
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
          return m.targets.some(function (t) { return canAnswerMark(u, t, m.kind); });
        }
        // 12" between the closest models of the two units, not their middles
        var cmdU = state.chain.by && byId(state.chain.by);
        if ((cmdU ? R.unitDist(u, cmdU) : R.inches(u.x, u.y, state.chain.x, state.chain.y)) > 12) return false;
        if (R.has(u, 'Command Unit')) return false;
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
    var hj = hijacked();
    if (hj && (ui.lastActed === hj || !hj.alive)) endHijack(hj);
    R.collars(state).forEach(function (l) { logLine(l.t, l.text); });
    if (ui.lastActed) ui.lastActed.advancing = false;   // an Advance ends with its activation
    // Infamy of Melancholy (p. 143): its activation weighs on every friend within 6"
    var mel = ui.lastActed;
    if (mel && mel.alive && R.campFlag(mel, 'melancholy')) {
      var sad = activeUnits(mel.side).filter(function (f) { return f !== mel && !R.isMachine(f) && R.unitDist(f, mel) <= 6; });
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
      if (sd) finish(sd.winner, sd.text.replace(/\bA\b/g, sideName('A')).replace(/\bB\b/g, sideName('B')));
    }
    if (state.over) { render(); return; }

    /* Command Vehicle (p. 57): "as soon as the Command Vehicle finishes its
       activation, the Command Unit on board MAY perform one of their special
       actions" — offered, not forced, and only to a steady Command Unit (a
       Suppressed one cannot Coordinate any more than on foot). */
    var just = ui.lastActed;
    if (just && just.alive && R.has(just, 'Command Vehicle') && !state.chain && !state.solo) {
      var cmd = R.commandAboard(just);
      if (cmd && !cmd.coordUsed && R.status(cmd) === 'ready') {
        if (isAI(just.side)) cmdCoordinate(just, cmd);
        else {
          state.cmdOffer = { veh: just.id, cmd: cmd.id };
          setHint(null, cmd.name + ' is aboard ' + just.name + ': coordinate now, or let the activation pass.');
          render();
          return;
        }
      }
    }
    passOn(just);
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
    var veh = byId(o.veh), cmd = byId(o.cmd);
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
        if (offerSecondMark()) return;
        clearMark();
      }
      state.chain = null;
    }
    afterChain();
  }
  // the activation (and any chain it started) is over: whose go is it now?
  function afterChain() {
    if (state.solo) { soloNext(); return; }
    state.streak -= 1;
    if (state.streak > 0 && eligible(state.activeSide).length > 0) { render(); maybeAI(); return; }

    var next = other(state.activeSide);
    if (eligible(next).length > 0) { state.activeSide = next; state.streak = streakFor(next); }
    else if (eligible(state.activeSide).length > 0) { state.streak = streakFor(state.activeSide); }
    else { rallyPhase(); return; }
    render();
    maybeAI();
  }
  /* ---- the end of the turn: in engine/endphase.js ---- */
  var KIT_ENDPHASE = null;
  function kitEndPhase() {
    return KIT_ENDPHASE || (KIT_ENDPHASE = (root.PMCEngineEndPhase || require('./endphase.js'))({
      H: H, R: R, SC: SC, SFX: SFX, UR: UR, V: V, W: W, abRally: abRally, abRepair: abRepair,
      activeUnits: activeUnits, addFx: addFx, animateMove: animateMove, beginTurn: beginTurn,
      canStand: canStand, focusUnit: focusUnit, logLine: logLine, nearestEnemy: nearestEnemy,
      onTable: onTable, pushRes: pushRes, render: render, sideName: sideName, soloAfterMove: soloAfterMove,
      isAI: isAI, makeStand: makeStand, revealConsole: revealConsole,
      ui: ui, get state() { return state; }
    }));
  }
  function rallyPhase() { return (KIT_ENDPHASE || kitEndPhase()).rallyPhase(); }
  function repairCard(u, rep) { return (KIT_ENDPHASE || kitEndPhase()).repairCard(u, rep); }
  function objDist(u, o) { return (KIT_ENDPHASE || kitEndPhase()).objDist(u, o); }
  function scoreObjectives() { return (KIT_ENDPHASE || kitEndPhase()).scoreObjectives(); }
  function finish(winner, text) { return (KIT_ENDPHASE || kitEndPhase()).finish(winner, text); }

  function specialsFor(u) {
    var out = [];
    /* Markerlights carry two different special actions (p. 58): Designate target
       calls up a gun that shoots without seeing, Mark the target calls up one that
       does see and fires as though at half range. Smoke Markers (p. 94) are the
       rebels' cut-down version: designate only, out to 12". Each is offered only
       when somebody on the table could actually answer it. */
    if (u && R.has(u, 'Markerlights')) {
      if (markAnswerable(u, 'designate')) out.push({ id: 'designate', label: 'Designate' });
      if (markAnswerable(u, 'mark')) out.push({ id: 'marktarget', label: 'Mark' });
    } else if (u && R.has(u, 'Smoke Markers')) {
      if (markAnswerable(u, 'designate')) out.push({ id: 'designate', label: 'Smoke & flare' });
    }
    // the Command Unit rule is not used in solitaire games (p. 149)
    if (u && R.has(u, 'Command Unit') && !state.solo) out.push({ id: 'coordinate', label: 'Coordinate' });
    if (u && u.transport) {
      /* A gun is towed rather than carried (Stationary Artillery, p. 94): where
         what it would take on, or has on, is a gun, the actions say Tow and Deploy. */
      var gunsIn = (u.cargo || []).filter(function (c) { return R.has(c, 'Stationary Artillery'); }).length;
      var near = activeUnits(u.side).filter(function (t2) { return t2 !== u && R.canEmbark(state, u, t2); });
      var gunsNear = near.filter(function (t2) { return R.has(t2, 'Stationary Artillery'); }).length;
      out.push({ id: 'embark', label: gunsNear && gunsNear === near.length ? 'Tow' : gunsNear ? 'Embark / tow' : 'Embark' });
      out.push({ id: 'disembark', label: gunsIn && gunsIn === (u.cargo || []).length ? 'Deploy gun' : gunsIn ? 'Disembark / deploy' : 'Disembark' });
      if (movesToCarry(u)) out.push({ id: 'drivefirst', label: u.cls === 'aircraft' ? 'Fly first' : 'Drive first' });
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
    if (u && minedFor(u)) out.push({ id: 'detonate', label: 'Detonate' });
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
    if (R.campFlag(u, 'adrenaline')) out.push({ id: 'rush', label: 'Rush' });
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
      if (d > u.range) return false;
      var minR = R.ruleValue(u, 'Minimum Range');
      if (minR && d < minR) return false;
      return R.hasLoS(state, u, mid) || R.has(u, 'Indirect Fire');
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
  var KIT_ACTIONS = null;
  function kitActions() {
    return KIT_ACTIONS || (KIT_ACTIONS = (root.PMCEngineActions || require('./actions.js'))({
      R: R, SC: SC, abRally: abRally, abRepair: abRepair, activeUnits: activeUnits, addFx: addFx,
      alreadySafe: alreadySafe, assaultables: assaultables, breachTargets: breachTargets, byId: byId,
      canStand: canStand, chargeAllow: chargeAllow, closeDrawer: closeDrawer,
      demolishTargets: demolishTargets, doCheckArea: doCheckArea, doDetonate: doDetonate, doOnce: doOnce,
      doRegain: doRegain, doSabotage: doSabotage, doSelfRepair: doSelfRepair, doStance: doStance,
      eligible: eligible, endActivation: endActivation, forcedCharge: forcedCharge, holdFire: holdFire,
      isAI: isAI, logLine: logLine, markAnswerable: markAnswerable, markHint: markHint, markReach: markReach,
      markTargets: markTargets, minedFor: minedFor, moveBonus: moveBonus, movesToCarry: movesToCarry,
      pushRes: pushRes, render: render, repairCard: repairCard, revealConsole: revealConsole,
      safeSpot: safeSpot, setHint: setHint, sideName: sideName, soloOwnerName: soloOwnerName, spent: spent,
      stayPut: stayPut, targetsFor: targetsFor, ui: ui, wireNote: wireNote, get state() { return state; }
    }));
  }
  function actionState(u, id) { return (KIT_ACTIONS || kitActions()).actionState(u, id); }
  function chooseAction(id) { return (KIT_ACTIONS || kitActions()).chooseAction(id); }
  /* ---- moving: in engine/moves.js ---- */
  var KIT_MOVES = null;
  function kitMoves() {
    return KIT_MOVES || (KIT_MOVES = (root.PMCEngineMoves || require('./moves.js'))({
      R: R, SC: SC, SFX: SFX, V: V, activeUnits: activeUnits, addFx: addFx, animateMove: animateMove,
      assaultables: assaultables, boardAnim: boardAnim, canAnswerMark: canAnswerMark, canStand: canStand,
      endActivation: endActivation, flightTurn: flightTurn, fromLog: fromLog, isAI: isAI, logLine: logLine,
      markHint: markHint, markTargets: markTargets, moveBonus: moveBonus, onTable: onTable,
      paintStructures: paintStructures, pushRes: pushRes, render: render, repaintTerrain: repaintTerrain,
      setHint: setHint, ui: ui, whenIdle: whenIdle, makeStand: makeStand, get state() { return state; }
    }));
  }
  function doOnce(u, id) { return (KIT_MOVES || kitMoves()).doOnce(u, id); }
  function doSabotage(u) { return (KIT_MOVES || kitMoves()).doSabotage(u); }
  function doCheckArea(u) { return (KIT_MOVES || kitMoves()).doCheckArea(u); }
  function targetsFor(u, opts) { return (KIT_MOVES || kitMoves()).targetsFor(u, opts); }
  function faceAfter(u, path, pt) { return (KIT_MOVES || kitMoves()).faceAfter(u, path, pt); }
  function faceAlong(u, fromX, fromY, toX, toY) { return (KIT_MOVES || kitMoves()).faceAlong(u, fromX, fromY, toX, toY); }
  function crushAlong(u, path) { return (KIT_MOVES || kitMoves()).crushAlong(u, path); }
  function soloAfterMove(u) { return (KIT_MOVES || kitMoves()).soloAfterMove(u); }
  function samCheck(u) { return (KIT_MOVES || kitMoves()).samCheck(u); }
  function forcedCharge(u) { return (KIT_MOVES || kitMoves()).forcedCharge(u); }
  function doWave(u, pt) { return (KIT_MOVES || kitMoves()).doWave(u, pt); }
  function holdFire(u) { return (KIT_MOVES || kitMoves()).holdFire(u); }
  function doMove(pt) { return (KIT_MOVES || kitMoves()).doMove(pt); }
  function doMarkMove(pt) { return (KIT_MOVES || kitMoves()).doMarkMove(pt); }
  function movesToCarry(u) { return (KIT_MOVES || kitMoves()).movesToCarry(u); }
  function safeSpot(u, x, y) { return (KIT_MOVES || kitMoves()).safeSpot(u, x, y); }
  function alreadySafe(u) { return (KIT_MOVES || kitMoves()).alreadySafe(u); }
  function carryMove(u) { return (KIT_MOVES || kitMoves()).carryMove(u); }
  function stayPut(u) { return (KIT_MOVES || kitMoves()).stayPut(u); }
  function doEmbark(target) { return (KIT_MOVES || kitMoves()).doEmbark(target); }
  /* ---- unit abilities: in engine/abilities.js ---- */
  var KIT_ABILITIES = null;
  function kitAbilities() {
    return KIT_ABILITIES || (KIT_ABILITIES = (root.PMCEngineAbilities || require('./abilities.js'))({
      R: R, SFX: SFX, V: V, addFx: addFx, aiPadFor: aiPadFor, canStand: canStand, chargeAllow: chargeAllow,
      endActivation: endActivation, glowRGB: glowRGB, isAI: isAI, logLine: logLine, pushRes: pushRes,
      render: render, repaintTerrain: repaintTerrain, revealConsole: revealConsole, setHint: setHint, ui: ui,
      whenIdle: whenIdle, get state() { return state; }
    }));
  }
  function doRegain(u) { return (KIT_ABILITIES || kitAbilities()).doRegain(u); }
  function abShoot(st, a, t, mode, opts) { return (KIT_ABILITIES || kitAbilities()).abShoot(st, a, t, mode, opts); }
  function martyrFirst(a, t, go) { return (KIT_ABILITIES || kitAbilities()).martyrFirst(a, t, go); }
  function abAssault(st, a, t, martyr) { return (KIT_ABILITIES || kitAbilities()).abAssault(st, a, t, martyr); }
  function abRally(st, u) { return (KIT_ABILITIES || kitAbilities()).abRally(st, u); }
  function abRepair(st, u) { return (KIT_ABILITIES || kitAbilities()).abRepair(st, u); }
  function medicFx(t, medicId, delay) { return (KIT_ABILITIES || kitAbilities()).medicFx(t, medicId, delay); }
  function keenFx(a, t, from) { return (KIT_ABILITIES || kitAbilities()).keenFx(a, t, from); }
  function doSelfRepair(u) { return (KIT_ABILITIES || kitAbilities()).doSelfRepair(u); }
  function doTeleport(tp, u) { return (KIT_ABILITIES || kitAbilities()).doTeleport(tp, u); }
  function finishTeleport(tpc, dest) { return (KIT_ABILITIES || kitAbilities()).finishTeleport(tpc, dest); }
  /* ---- shooting, assault, strafing and the special actions: in engine/combat.js ---- */
  var KIT_COMBAT = null;
  function kitCombat() {
    return KIT_COMBAT || (KIT_COMBAT = (root.PMCEngineCombat || require('./combat.js'))({
      R: R, SFX: SFX, abAssault: abAssault, abShoot: abShoot, activeUnits: activeUnits, addFx: addFx,
      aiAct: aiAct, carryMove: carryMove, deathsSince: deathsSince, endActivation: endActivation,
      faceAlong: faceAlong, focusUnit: focusUnit, fromLog: fromLog, isAI: isAI, logLine: logLine,
      martyrFirst: martyrFirst, medicFx: medicFx, moveBonus: moveBonus, playAssault: playAssault,
      playShooting: playShooting, playStrafe: playStrafe, pushRes: pushRes, render: render,
      repaintTerrain: repaintTerrain, samCheck: samCheck, setHint: setHint, sideName: sideName,
      snapshotAlive: snapshotAlive, soundFor: soundFor, stepOff: stepOff, ui: ui, whenIdle: whenIdle,
      get state() { return state; }
    }));
  }
  function wireNote(u) { return (KIT_COMBAT || kitCombat()).wireNote(u); }
  function chargeAllow(u) { return (KIT_COMBAT || kitCombat()).chargeAllow(u); }
  function assaultables(u, reach) { return (KIT_COMBAT || kitCombat()).assaultables(u, reach); }
  function canReachCharge(u, t) { return (KIT_COMBAT || kitCombat()).canReachCharge(u, t); }
  function doEnter(u, s) { return (KIT_COMBAT || kitCombat()).doEnter(u, s); }
  function doExitBld(u, spot) { return (KIT_COMBAT || kitCombat()).doExitBld(u, spot); }
  function doDisembark(pt, all) { return (KIT_COMBAT || kitCombat()).doDisembark(pt, all); }
  function doStrafe(pt) { return (KIT_COMBAT || kitCombat()).doStrafe(pt); }
  function resolveShot(u, target, mode, opts) { return (KIT_COMBAT || kitCombat()).resolveShot(u, target, mode, opts); }
  function doShoot(target) { return (KIT_COMBAT || kitCombat()).doShoot(target); }
  function doAssault(target) { return (KIT_COMBAT || kitCombat()).doAssault(target); }
  function doSupport(target) { return (KIT_COMBAT || kitCombat()).doSupport(target); }
  function doSteady(target, shooter) { return (KIT_COMBAT || kitCombat()).doSteady(target, shooter); }
  function doHack(target) { return (KIT_COMBAT || kitCombat()).doHack(target); }
  function hijacked() { return (KIT_COMBAT || kitCombat()).hijacked(); }
  function endHijack(drone) { return (KIT_COMBAT || kitCombat()).endHijack(drone); }
  function doDemolish(piece) { return (KIT_COMBAT || kitCombat()).doDemolish(piece); }
  function doBreach(piece) { return (KIT_COMBAT || kitCombat()).doBreach(piece); }
  function minedFor(u) { return (KIT_COMBAT || kitCombat()).minedFor(u); }
  function doDetonate(u) { return (KIT_COMBAT || kitCombat()).doDetonate(u); }
  function doStance(u) { return (KIT_COMBAT || kitCombat()).doStance(u); }
  function finishStance(u, dir) { return (KIT_COMBAT || kitCombat()).finishStance(u, dir); }
  /* ---- marking targets: in engine/marks.js ---- */
  var KIT_MARKS = null;
  function kitMarks() {
    return KIT_MARKS || (KIT_MARKS = (root.PMCEngineMarks || require('./marks.js'))({
      R: R, addFx: addFx, afterChain: afterChain, byId: byId, endActivation: endActivation, isAI: isAI,
      keenFx: keenFx, logLine: logLine, maybeAI: maybeAI, render: render, setHint: setHint, ui: ui,
      get state() { return state; }
    }));
  }
  function markReach(u) { return (KIT_MARKS || kitMarks()).markReach(u); }
  function markTargets(u) { return (KIT_MARKS || kitMarks()).markTargets(u); }
  function markHint(u) { return (KIT_MARKS || kitMarks()).markHint(u); }
  function doDesignate(target, actor, kind) { return (KIT_MARKS || kitMarks()).doDesignate(target, actor, kind); }
  function offerSecondMark() { return (KIT_MARKS || kitMarks()).offerSecondMark(); }
  function declineSecondMark() { return (KIT_MARKS || kitMarks()).declineSecondMark(); }
  function clearMark() { return (KIT_MARKS || kitMarks()).clearMark(); }
  function canAnswerMark(o, target, kind) { return (KIT_MARKS || kitMarks()).canAnswerMark(o, target, kind); }
  function markAnswerable(u, kind) { return (KIT_MARKS || kitMarks()).markAnswerable(u, kind); }
  /* ---- saving and loading a battle: in engine/save.js ---- */
  var KIT_SAVE = null;
  function kitSave() {
    return KIT_SAVE || (KIT_SAVE = (root.PMCEngineSave || require('./save.js'))({
      GEN: GEN, R: R, SC: SC, deploymentDone: deploymentDone, logLine: logLine, placingSide: placingSide,
      terrainSide: terrainSide, ui: ui, get state() { return state; }, set state(v) { state = v; }
    }));
  }
  function fromLog(kind, title, side, entries) { return (KIT_SAVE || kitSave()).fromLog(kind, title, side, entries); }
  function snapshotAlive() { return (KIT_SAVE || kitSave()).snapshotAlive(); }
  function deathsSince(snap) { return (KIT_SAVE || kitSave()).deathsSince(snap); }
  function unitById(id) { return (KIT_SAVE || kitSave()).unitById(id); }
  function byId(id) { return (KIT_SAVE || kitSave()).byId(id); }
  function carriersFor(side) { return (KIT_SAVE || kitSave()).carriersFor(side); }
  function boardableFor(veh) { return (KIT_SAVE || kitSave()).boardableFor(veh); }
  function loadBefore(veh, u, quiet) { return (KIT_SAVE || kitSave()).loadBefore(veh, u, quiet); }
  function unloadBefore(veh, u) { return (KIT_SAVE || kitSave()).unloadBefore(veh, u); }
  function sideOfSeat(seat) { return (KIT_SAVE || kitSave()).sideOfSeat(seat); }
  function snapshot() { return (KIT_SAVE || kitSave()).snapshot(); }
  function load(snap) { return (KIT_SAVE || kitSave()).load(snap); }

    /* ---- intents ----
       One entry for every way a player can touch the table. Each says who may
       send it and when; anything else comes back as a refusal rather than a
       silent no-op, so a client that is out of step is told so. */
    function no(why) { return { ok: false, why: why }; }
    var yes = { ok: true };

    function mayDeploy(side) {
      return state.phase === 'deploy' && placingSide() === side && !state.placeAsk && !state.minePick && !state.swapStage;
    }
    /* The terrain set-up goes an area at a time, and each area is one side's
       to lay (p. 47). Nobody else may touch it while it is being laid. */
    function terrainSide() {
      var a = curArea();
      return a ? a.side : null;
    }
    function mayLay(side) {
      return state.phase === 'terrain' && terrainSide() === side && !isAI(side);
    }
    function relocating(side) {
      return state.phase === 'deploy' && !!state.relocating && state.relocating.side === side;
    }
    function mayAct(side) {
      if (state.phase !== 'battle' || state.over) return false;
      if (ui.insertion || state.cmdOffer || state.martyrAsk || state.kyfAsk || state.standAsk) return false;   // an answer is owed first
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
          var hjk = hijacked();
          if (hjk && u !== hjk && u.side === side) return no(hjk.name + ' is hacked: act with it first');
          /* A unit half-way through an Advance has to finish it first; left
             behind, it could come back later in the turn for a whole action. */
          if (state.remark && state.remark.side === side && u.id !== state.remark.by) {
            return no('the marker is naming its second target — pick one, or Cancel');
          }
          if (state.rush && state.phase === 'battle' && u.side === side && u.id !== state.rush) {
            var rsh = byId(state.rush);
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
          if (state.swapStage) return no('the armies are still being modified');
          if (state.swapAsk && state.swapAsk.side === side) swapsDone();   // placing a unit keeps the list
          if (!mayDeploy(side)) return no('not your turn to place');
          return deployAt(side, it);
        }
        case 'autosplit': {
          if (state.phase !== 'deploy') return no('not deploying');
          ['A', 'B'].forEach(autoSplit);          // every player's (the OpFor's already stands)
          render();
          return yes;
        }
        case 'holdback': {
          if (state.phase !== 'deploy') return no('not deploying');
          var why = toggleHold(side, it.id);
          if (why) return no(why);
          render();
          return yes;
        }
        case 'insertion': {
          if (state.phase !== 'deploy') return no('not deploying');
          var whyI = toggleInsertion(side, it.id);
          if (whyI) return no(whyI);
          render();
          return yes;
        }
        case 'laststand': {
          var ls = unitOf(it.id, side);
          if (!ls) return no('no such unit');
          if (state.standAsk && state.standAsk.unit === ls.id && ui.standThen) { ui.standThen(true); return yes; }
          if (!standable(ls)) return no(spent(ls, 'lastStand') ? 'Last Stand is spent' : 'nothing to make a stand against');
          makeStand(ls);
          render();
          return yes;
        }
        case 'stand': case 'nostand': {
          var sa = state.standAsk;
          if (!sa || sa.side !== side || !ui.standThen) return no('nothing to answer');
          ui.standThen(it.k === 'stand');
          return yes;
        }
        case 'rpick': {
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
        }
        case 'rpickdone': {
          var rq = ui.reservePick;
          if (!rq || rq.side !== side) return no('nothing to choose');
          if (rq.chosen.length < rq.min || rq.chosen.length > rq.max) return no('choose ' + rq.min + (rq.max !== rq.min ? '-' + rq.max : '') + ' units');
          rq.finish();
          return yes;
        }
        case 'autodeploy': {
          if (state.phase !== 'deploy') return no('not deploying');
          if (state.swapStage) return no('the armies are still being modified');
          // deploying straight away means keeping the list as it is
          if (state.swapAsk && state.swapAsk.side === side) swapsDone();
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
        case 'garrison': {
          /* Setting a unit up inside a building at deployment. The building is
             found again here from the tap rather than taken on trust. */
          if (!mayDeploy(side)) return no('not your turn to place');
          var gu = it.id ? unitOf(it.id, side) : deployNext();
          if (!gu || gu.side !== side) return no('no such unit');
          var gs = garrisonAt(+it.x, +it.y);
          if (!gs) return no('there is no building there');
          var gq = gs.rect, gOcc = R.occupant(state, gs.piece, gs.sec);
          if (!garrisonable(gu)) return no(gu.name + ' cannot go into a building');
          if (gOcc && gOcc !== gu) return no('that building already has ' + gOcc.name + ' in it');
          if (!deployOK(side, gq.x + gq.w / 2, gq.y + gq.h / 2, gu)) return no('that building is outside your deployment area');
          R.enterBuilding(state, gu, gs.piece, gs.sec);
          ui.deployPick = null;
          setHint(null, gu.name + ' sets up inside the building.');
          render();
          return yes;
        }
        /* One more activation, please: how a watched battle is walked forward,
           the client asking again once it has finished drawing the last one. */
        case 'step': {
          if (state.phase !== 'battle' || !canAI()) return no('nothing to step');
          maybeAI();
          return yes;
        }
        case 'swapopen': {
          if (!canSwapNow(side)) return no('the list can no longer be changed');
          state.swapAsk = state.swapAvail[side];
          state.swapAsk.pick = null;
          render();
          return yes;
        }
        case 'swappick': case 'swapin': case 'swapdone': {
          var sa2 = state.swapAsk;
          if (!sa2 || sa2.side !== side) return no('nothing to swap');
          if (it.who && it.who !== side) return no('that was the other player\u2019s list');
          if (it.k === 'swapdone') { swapsDone(); return yes; }
          if (it.k === 'swappick') { sa2.pick = it.id || null; render(); return yes; }
          var sw = doSwap(side, sa2.pick, it.id);
          if (sw) { setHint(null, sw); render(); return no(sw); }
          return yes;
        }
        case 'placeat': case 'placerot': case 'placedone': {
          var pa = state.placeAsk;
          if (!pa || pa.side !== side) return no('nothing to place');
          if (it.k === 'placerot') { pa.vertical = !pa.vertical; render(); return yes; }
          if (it.k === 'placedone') { placeDone(); return yes; }
          var pw = placeAt(+it.x, +it.y);
          if (pw) { setHint(null, pw); render(); return no(pw); }
          return yes;
        }
        case 'mine': {
          var mp = state.minePick;
          if (!mp || mp.side !== side) return no('nothing to mine');
          var mi = +it.i;
          if (mi >= 0 && mp.pool.indexOf(mi) < 0) return no('that cannot be mined');
          state.mined = mi >= 0 ? { side: side, piece: state.terrain[mi] } : null;
          state.minePick = null;
          logLine('note', sideName(side) + (mi >= 0 ? ' has quietly mined a piece of the table.' : ' leaves the charges in the crates.'));
          render();
          return yes;
        }
        case 'start': {
          if (state.phase !== 'deploy') return no('already under way');
          if (state.minePick) return no('the mined piece has not been chosen');
          if (state.placeAsk) return no('there are pieces still to place');
          if (state.swapStage) return no('the armies are still being modified');
          if (state.swapAsk) swapsDone();
          if (!deploymentDone()) return no('there are still units to place');
          // Rapid Relocation is one side's to finish, and it starts the battle when it does
          if (state.relocating && state.relocating.side !== side) return no('the other side is still relocating');
          startBattle();
          return yes;
        }

        /* ---- Rapid Relocation (O3, p. 87) ---- */
        case 'relocpick': {
          if (!relocating(side)) return no('you are not relocating');
          relocPick(it.id);
          return yes;
        }
        case 'reloctap': {
          if (!relocating(side)) return no('you are not relocating');
          relocTap({ x: +it.x, y: +it.y });
          return yes;
        }

        /* ---- laying the terrain by hand (pp. 46-47) ---- */
        case 'terraintap': {
          if (!mayLay(side)) return no('this area is not yours to lay');
          terrainTap({ x: +it.x, y: +it.y });
          return yes;
        }
        case 'terrain': {
          if (!mayLay(side)) return no('this area is not yours to lay');
          if (['talt', 'tnext', 'tauto', 'tautoall', 'trotate'].indexOf(it.act) < 0) return no('unknown terrain step');
          terrainAct(it.act, it.arg);
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
        case 'kyf': case 'nokyf': {
          if (!state.kyfAsk || state.kyfAsk.side !== side || !ui.kyfThen) return no('nothing to answer');
          ui.kyfThen(it.k === 'kyf');
          return yes;
        }
        case 'martyr': case 'nomartyr': {
          var ma = state.martyrAsk;
          if (!ma || ma.side !== side || !ui.martyrThen) return no('nothing to answer');
          ui.martyrThen(it.k === 'martyr');
          return yes;
        }
        case 'cmdcoord': case 'cmdskip': {
          if (!state.cmdOffer) return no('nothing is offered');
          var ov = byId(state.cmdOffer.veh);
          if (!ov || ov.side !== side) return no('not your vehicle');
          answerCmdOffer(it.k === 'cmdcoord');
          return yes;
        }
        case 'holdarrive': {
          // Semper Fidelis: a unit offered an early arrival may wait for its roll instead
          if (!ui.insertion || !ui.insertion.unit) return no('nothing to hold back');
          if (insertionSide() !== side) return no('that is not your unit');
          holdArrival();
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
          else if (ui.mode === 'steady') doSteady(t);
          else doShoot(t);
          return yes;
        }

        /* ---- buildings ---- */
        case 'enter': {
          if (!mayAct(side) || !selected(side)) return no('not your activation');
          if (ui.mode !== 'enter') return no('not going into a building');
          var bp = state.terrain[it.piece];
          var sec = (ui.sections || []).filter(function (q) { return q.piece === bp && q.sec === (+it.sec || 0); })[0];
          if (!sec) return no('that building is not one it can go into');
          doEnter(ui.selected, sec);
          return yes;
        }
        case 'exitbld': {
          if (!mayAct(side) || !selected(side)) return no('not your activation');
          if (ui.mode !== 'exitbld') return no('not coming out of a building');
          var xs = spotFrom(it);
          if (!xs) return no('come out within 4" of the wall');
          doExitBld(ui.selected, xs);
          return yes;
        }
        case 'piece': {
          if (!mayAct(side) || !selected(side)) return no('not your activation');
          var r = state.terrain[it.i];
          if (!r || ui.terrain.indexOf(r) < 0) return no('not a legal piece');
          if (ui.mode === 'breach') doBreach(r); else doDemolish(r);
          return yes;
        }
        case 'digface': {
          // Dig in!: the facing chosen, as a bearing (it is put on the nearest of the eight)
          if (!mayAct(side) || !selected(side)) return no('not your activation');
          if (ui.mode !== 'digface' || !ui.selected || !R.has(ui.selected, 'Stationary Artillery')) return no('not digging in');
          if (typeof it.dir !== 'number' || !isFinite(it.dir)) return no('which way?');
          finishStance(ui.selected, R.nearestFacing(it.dir));
          return yes;
        }
        case 'cancel': {
          if (!mayAct(side)) return no('not your activation');
          // a marker's second call, let go
          if (state.remark && state.remark.side === side) { declineSecondMark(); return yes; }
          // half-way through an Advance there is nothing to go back to: it holds its fire
          var adv = ui.selected;
          if (adv && adv.advancing && !adv.activated && adv.side === side) { holdFire(adv); return yes; }
          // loading or unloading a squad at a time: that is enough, now the hull may drive
          if (adv && (adv.loading || adv.unloading) && adv.side === side) {
            adv.loading = false; adv.unloading = false; adv.activated = true; carryMove(adv); return yes;
          }
          if (adv && (adv.carrying || adv.carryMoved) && adv.side === side) { stayPut(adv); return yes; }
          ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.sections = []; ui.preview = null;
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
      if (ins.by) return ins.by;       // the opponent shoving an insertion off its mark
      if (ins.unit) return ins.unit.side;
      return 'A';                      // a landing zone is always the players' own
    }

    /* Putting a unit down before the battle. A tap that misses the strip by a
       little is pulled onto it, exactly as it is on one screen. */
    function deployAt(side, it) {
      var pending = it.id ? byId(it.id) : deployNext();
      if (!pending || pending.side !== side) return no('no such unit');
      /* A unit the scenario holds back is brought on through the split; one held
         for Battlefield Insertion, set down on the table, deploys like the rest
         (p. 56: it "can" come in that way, not must). */
      if (pending.reserve) {
        if (pending.wave === 2) return no(pending.name + ' is held back by the scenario — bring it onto the table in Reserves first');
        if (toggleInsertion(side, pending.id)) return no(pending.name + ' is in reserve');
      }
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
      // set down on open ground, it is no longer in whatever building it was in
      pending.bld = null; pending.sec = null;
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
        splitFor: splitFor, insertionFor: insertionFor,
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
        // Modifying the armies: what could stand in for this unit
        canSwapNow: function (side) { return canSwapNow(side); },
        swapOptions: function (side, id) {
          return swapOptions(side, byId(id)).map(function (o) { return { id: o.id, name: o.name, key: o.key }; });
        },
        arrivalLegal: arrivalLegal,
        /* Who holds each objective as things stand. The board shows it live,
           between the End phases that actually score it. */
        scoreObjectives: scoreObjectives,
        insertionSpots: insertionSpots,
        arrivalSpots: arrivalSpots,
        markTargets: markTargets,
        inReserve: inReserve,
        unitById: unitById,
        playerSide: playerSide,
        soloOwnerName: soloOwnerName,
        docsOf: docsOf,
        spent: spent,
        objDist: objDist,
        unbroken: unbroken,
        isAI: isAI,
        fromLog: fromLog,
        /* The OpFor's opinion of a unit, which the board draws as the odds on a
           target and uses to point the camera. It rolls nothing. */
        bestTarget: bestTarget,
        gapToFoes: gapToFoes,
        expectedHits: expectedHits,
        // the terrain set-up, read by the card that walks a player through it
        curArea: curArea, terrainSide: terrainSide, fitGhost: fitGhost, clonePiece: clonePiece,
        pieceNoun: pieceNoun, specRange: specRange, placedSummary: placedSummary,
        // buildings, garrisons and the rules that ride on them
        garrisonAt: garrisonAt, garrisonable: garrisonable, garrisonSpots: garrisonSpots,
        assaultables: assaultables, semperFidelis: semperFidelis, sfName: sfName,
        relocCap: relocCap, relocSpotOK: relocSpotOK, wantsManualTerrain: wantsManualTerrain
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
