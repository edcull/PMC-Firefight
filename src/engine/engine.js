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
   browser. scripts/build-engine.js is the tool that did the splitting, kept
   for the record; it has done its job and the file below is now the source.
   game.js is the view that sits on top of it. */
(function (root) {
  'use strict';
  var R = root.PMC, SC = root.PMCScen, GEN = root.PMCGen, C = root.PMCCamp, SOLO = root.PMCSolo;

  var COLOURS = ['ochre', 'steel', 'olive', 'crimson', 'slate', 'plum', 'sand', 'rust', 'jade', 'midnight', 'charcoal', 'hazard', 'rose', 'forest'];
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
    deep: ['deep water', 'deep waters'], lava: ['lava field', 'lava fields']
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
        u.alive = true; u.fled = false; u.wipedOut = false; u._wrecked = false;
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
        isAI(state.activeSide);
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
      streak: 0, chain: null, log: [], over: null,
      campaign: cfg.campaign || null,
      doctrines: cfg.doctrines || null,
      tactics: cfg.tactics || { A: null, B: null },
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
        if (R.has(u, 'Turret')) u.drone = true;             // a lone shield turret is Drone Controlled too
        if (R.canMount(prof, pick.riders)) u.mount = pick.mount || 'bike';
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
       quarter of the force may be held back and come in by Battlefield
       Insertion. The ones that already can are counted first. */
    ['A', 'B'].forEach(function (side) {
      var docs = (state.doctrines && state.doctrines[side]) || [];
      if (docs.indexOf('BB2') < 0 && docs.indexOf('XO2') < 0) return;
      var mine = state.units.filter(function (u) { return u.side === side; });
      var cap = Math.floor(mine.length / 4);
      var have = mine.filter(function (u) { return R.has(u, 'Battlefield Insertion'); }).length;
      mine.filter(function (u) {
        return u.cls === 'infantry' && !R.has(u, 'Battlefield Insertion') && !R.has(u, 'Overmind') && !R.has(u, 'Dominant Species');
      }).slice(0, Math.max(0, cap - have)).forEach(function (u) { u.rules.push('Battlefield Insertion'); });
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
    SC.begin(state, scenId, { attacker: cfg.attacker, roles: cfg.roles });
    // the scenario may have moved or dropped pieces to keep them apart; a mined one must still be there
    if (state.mined && state.terrain.indexOf(state.mined.piece) < 0) {
      var pool2 = state.terrain.filter(function (r) {
        var t = R.TERRAIN[r.kind];
        return t && t.destructible && t.destructible !== 'target';
      });
      state.mined = pool2.length ? { side: state.mined.side, piece: pool2[Math.floor(Math.random() * pool2.length)] } : null;
    }
    ['A', 'B'].forEach(function (side) { if (docsOf(side).indexOf('XO4') >= 0) terrainKnowledge(side); });
    ['A', 'B'].forEach(markReserves);
    SC.deploy(state);
    seatPlatforms();             // every drop pod comes down with somebody in it
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

  function pieceNoun(spec, n) {
    var w = PIECE_NOUN[spec.kind] || [spec.kind, spec.kind + 's'];
    return (spec.big ? 'large ' : '') + w[n === 1 ? 0 : 1];
  }

  function specRange(spec) {
    return (spec.min === spec.max ? spec.max : (spec.min ? spec.min + '–' : 'up to ') + spec.max) + ' ' + pieceNoun(spec, spec.max);
  }

  function wantsManualTerrain(cfg) {
    if (cfg.mode === 'demo') return false;
    var t = cfg.terrainSetup;
    return t === 'manual';
  }

  function startTerrainSetup(built) {
    var gen = GEN.tableFor(state.cfg.planet);
    var starter = state.solo ? 'A' : (Math.random() < 0.5 ? 'A' : 'B');
    state.phase = 'terrain';
    state.tset = {
      gen: gen, memo: {}, i: -1, rolls: built.rolls, starter: starter, ghost: null, baked: 0,
      areas: GEN.areasOf(W, H).map(function (a, n) {
        a.side = state.solo ? 'A' : (n % 2 === 0 ? starter : other(starter));
        a.placed = []; a.count = []; a.spec = 0; a.alt = null;
        return a;
      })
    };
    logLine('note', 'Terrain set-up — ' + gen.name + '. The table is divided into four 2′ × 2′ areas; ' +
      (state.solo ? 'you lay all four.' : sideName(starter) + ' rolls for the first.'));
    V.newTable('whole');
    nextArea();
  }

  function curArea() {
    var ts = state && state.tset;
    return ts && state.phase === 'terrain' ? ts.areas[ts.i] || null : null;
  }

  function nextArea() {
    var ts = state.tset;
    ts.i++;
    ts.ghost = null;
    if (ts.i >= ts.areas.length) { finishTerrain(); return; }
    var a = ts.areas[ts.i];
    var r = GEN.rollArea(ts.gen, Math.random, ts.memo);
    a.roll = r.roll; a.first = r.first; a.row = r.row;
    a.alt = r.row.alts.length === 1 ? 0 : null;
    logLine('terrain', a.name + ' — ' + sideName(a.side) + ' rolls D6 ' +
      (a.first ? a.first + ', re-rolled ' : '') + a.roll + ': ' + r.row.text);
    if (isAI(a.side) || ts.autoAll) {
      autoArea(a);
      if (!ts.autoAll && !state.solo) pushRes({
        kind: 'Terrain', title: a.name + ' area', side: a.side,
        dice: [{ label: 'D6', value: a.roll }],
        note: sideName(a.side) + ' rolls for the ' + a.name + ' area: ' + a.row.text + '.',
        outcome: { text: a.placed.length ? 'Places ' + placedSummary(a) + '.' : 'Leaves it open.', tone: 'good' }
      });
      nextArea();
      return;
    }
    prepSpec(a);
    render();
  }

  function placedSummary(a) {
    var n = {}, order = [];
    a.placed.forEach(function (p) {
      var key = p.kind + (p.big ? '+' : '');
      if (!n[key]) { n[key] = 0; order.push({ kind: p.kind, big: p.big }); }
      n[key]++;
    });
    return order.map(function (o) { var c = n[o.kind + (o.big ? '+' : '')]; return c + ' ' + pieceNoun(o, c); }).join(' and ');
  }

  // the rolled result still to go down in this area, as the generator reads it
  function remainingAlt(a) {
    var alt = a.row.alts[a.alt === null ? Math.floor(Math.random() * a.row.alts.length) : a.alt];
    if (a.alt === null) return alt;
    return alt.slice(a.spec).map(function (spec, k) {
      var done = k === 0 ? (a.count[a.spec] || 0) : 0, o = {};
      for (var key in spec) o[key] = spec[key];
      o.min = Math.max(0, spec.min - done); o.max = Math.max(0, spec.max - done);
      return o;
    });
  }

  function autoArea(a) {
    var got = GEN.fillArea(remainingAlt(a), a, state.terrain, OBJECTIVES, Math.random, W, H);
    got.forEach(function (p) { state.terrain.push(p); a.placed.push(p); });
    completeArea(a);
  }

  function completeArea(a) {
    a.done = true;
    state.tset.rolls.push({ area: a.name, roll: a.roll, text: a.row.text, placed: a.placed.map(function (p) { return p.kind; }) });
    logLine('terrain', a.name + ' — ' + (a.placed.length ? placedSummary(a) : 'left open') + '.');
    queueBake();
  }

  /* Roll the footprint of the next piece to go down, and give it its outline,
     so the player sees exactly what they are putting on the table. */
  /* Every piece the area's result can put down is rolled as soon as the result
     is known — its size and its shape — so the player sees the whole set, and
     lays exactly the pieces shown, in order. Only the next one is "in hand": it
     is the one outlined under the pointer, and the one a quarter turn turns. */
  function makePiece(a, spec, shrink, turns) {
    var sz = GEN.sizeFor(spec, Math.random, shrink || 1);
    var g = { kind: spec.kind, x: 0, y: 0, w: Math.min(sz.w, a.w - 1), h: Math.min(sz.h, a.h - 1) };
    if (spec.big) g.big = true;
    if (R.shapePiece) R.shapePiece(g, Math.random);
    for (var t = 0; t < (turns || 0); t++) quarterTurn(g);
    return g;
  }
  function rollPieces(a) {
    a.pieces = a.row.alts[a.alt].map(function (spec) {
      var out = [];
      for (var i = 0; i < spec.max; i++) out.push(makePiece(a, spec, 1, 0));
      return out;
    });
    a.piecesFor = a.alt;
  }
  /* A quarter turn, about the piece's own corner: the table-turning the rules
     already do, then the piece set back where it was. The table is square, so
     a turn of it is a turn of anything on it. */
  function quarterTurn(p) {
    R.turnPiece(p, 1);
    R.placePiece(p, 0, 0, p.w, p.h);
    p.turns = ((p.turns || 0) + 1) % 4;
    return p;
  }
  function inHand(a) {
    return a.pieces && a.pieces[a.spec] ? a.pieces[a.spec][a.count[a.spec] || 0] || null : null;
  }
  function prepSpec(a) {
    var ts = state.tset;
    ts.ghost = null;
    if (a.alt === null) return;                   // waiting on the player's choice
    if (!a.pieces || a.piecesFor !== a.alt) rollPieces(a);
    var alt = a.row.alts[a.alt];
    while (a.spec < alt.length && (a.count[a.spec] || 0) >= alt[a.spec].max) a.spec++;
    if (a.spec >= alt.length) { completeArea(a); nextArea(); return; }
    var spec = alt[a.spec], n = a.count[a.spec] || 0;
    /* A crowded area gets a smaller piece rather than none, as the generator
       does: the one in hand is rolled again at the smaller size, turned the
       way the player had it. */
    if (a.shrink && a.shrink < 1) {
      var was = a.pieces[a.spec][n];
      a.pieces[a.spec][n] = makePiece(a, spec, a.shrink, was ? was.turns : 0);
    }
    ts.ghost = clonePiece(a.pieces[a.spec][n]);
  }

  function clonePiece(t) { return JSON.parse(JSON.stringify(t)); }

  /* The nearest place to (cx, cy) the next piece fits: wholly in its area, on
     the table, and half an inch clear of everything already down. */
  function fitGhost(a, cx, cy) {
    var g = state.tset.ghost;
    if (!g) return null;
    var x0 = Math.max(a.x, 0.5), x1 = Math.min(a.x + a.w, W - 0.5) - g.w;
    var y0 = Math.max(a.y, 0.5), y1 = Math.min(a.y + a.h, H - 0.5) - g.h;
    if (x1 < x0 || y1 < y0) return null;
    var best = null, bd = Infinity;
    for (var r = 0; r <= 12; r += 0.5) {
      var steps = r ? Math.max(8, Math.round(r * 8)) : 1;
      for (var k = 0; k < steps; k++) {
        var ang = k / steps * Math.PI * 2;
        var x = Math.max(x0, Math.min(x1, cx + Math.cos(ang) * r - g.w / 2));
        var y = Math.max(y0, Math.min(y1, cy + Math.sin(ang) * r - g.h / 2));
        if (GEN.clashes({ x: x, y: y, w: g.w, h: g.h }, state.terrain)) continue;
        var d = Math.hypot(x + g.w / 2 - cx, y + g.h / 2 - cy);
        if (d < bd) { bd = d; best = { x: x, y: y }; }
      }
      if (best) return best;
    }
    return null;
  }

  function terrainTap(p) {
    var a = curArea();
    if (!a || isAI(a.side) || !state.tset.ghost) return;
    if (p.x < a.x - 2 || p.x > a.x + a.w + 2 || p.y < a.y - 2 || p.y > a.y + a.h + 2) {
      ui.tsetHint = 'That is outside the ' + a.name + ' area — tap inside the lit quarter of the table.';
      render(); return;
    }
    var spot = fitGhost(a, p.x, p.y);
    if (!spot) {
      // a crowded area gets a smaller piece rather than none, as the generator does
      a.shrink = Math.max(0.55, (a.shrink || 1) * 0.8);
      prepSpec(a);
      ui.tsetHint = 'No room for it there. The next one is drawn a little smaller — try again, or move on.';
      render(); return;
    }
    var pc = clonePiece(state.tset.ghost);
    R.placePiece(pc, spot.x, spot.y);
    state.terrain.push(pc); a.placed.push(pc);
    a.count[a.spec] = (a.count[a.spec] || 0) + 1;
    ui.tsetHint = '';
    if (SFX && SFX.click) SFX.click();
    queueBake();
    prepSpec(a);
    render();
  }

  function terrainAct(act, arg) {
    var a = curArea();
    if (!a) return;
    ui.tsetHint = '';
    if (act === 'talt') { a.alt = +arg; a.spec = 0; a.count = []; prepSpec(a); }
    else if (act === 'tnext') {
      var spec = a.row.alts[a.alt][a.spec];
      if ((a.count[a.spec] || 0) < spec.min) return;
      a.spec++; a.shrink = 1; prepSpec(a);
    }
    else if (act === 'trotate') {
      // a quarter turn of the piece in hand
      var hand = inHand(a);
      if (!hand) return;
      quarterTurn(hand);
      state.tset.ghost = clonePiece(hand);
    }
    else if (act === 'tauto') { autoArea(a); nextArea(); return; }
    else if (act === 'tautoall') { state.tset.autoAll = true; autoArea(a); nextArea(); return; }
    render();
  }

  /* The table is set. "Before the battle, players randomize opposite table
     edges" (p. 50): the game always lays one company along the west edge and
     the other along the east, so the table itself is turned to bring the rolled
     edge round to the west. */
  function finishTerrain() {
    var ts = state.tset;
    ts.ghost = null;
    state.phase = 'deploy';
    state.genCount = state.terrain.length;
    if (state.scen && state.scen.edges) {
      var EDGES = ['west', 'north', 'east', 'south'];
      var d = 1 + Math.floor(Math.random() * 4), k = d - 1;
      state.terrain.forEach(function (t) { R.turnPiece(t, k); });
      var ea = EDGES[k], eb = EDGES[(k + 2) % 4];
      state.edges = { A: ea, B: eb, roll: d, turned: k };
      var turn = ['', 'a quarter turn', 'half a turn', 'three quarters of a turn'][k];
      var line = sideName('A') + ' takes the ' + ea + ' edge, ' + sideName('B') + ' the ' + eb + '.';
      logLine('note', 'Table edges — D4 ' + d + ': ' + line + (k ? ' The table is turned ' + turn + ' to put them where the game lays them out.' : ''));
      pushRes({
        kind: 'Table edges', title: 'The ' + ea + ' edge for ' + state.cfg.nameA,
        dice: [{ label: 'D4', value: d }],
        note: 'Before the battle, players randomize opposite table edges (p. 50) — after the terrain is down, so nobody knew which end was theirs while placing it.',
        list: [{ text: line }].concat(k ? [{ text: 'The table is turned ' + turn + ': ' + sideName('A') + '’s edge now runs along the upper left of the view, ' + sideName('B') + '’s along the lower right.' }] : [])
      });
    }
    afterTerrain({ terrain: state.terrain, rolls: ts.rolls, generator: ts.gen.name, manual: true });
  }

  /* Detailed Terrain Knowledge (p. 141): the tribe moves two terrain pieces up to
     12" after the table is set. It pulls cover toward the middle of its own half,
     where its troops will want it, keeping clear of objectives and other pieces. */
  function terrainKnowledge(side) {
    var mid = side === 'A' ? { x: W * 0.3, y: H * 0.5 } : { x: W * 0.7, y: H * 0.5 };
    var pieces = state.terrain.filter(function (r) {
      var t = R.TERRAIN[r.kind];
      return t && (t.cover || t.blocks) && !t.impassable && t.destructible !== 'target' && r.w * r.h < 40 && !r.fixed;
    }).sort(function (a, b) {
      return R.inches(b.x + b.w / 2, b.y + b.h / 2, mid.x, mid.y) - R.inches(a.x + a.w / 2, a.y + a.h / 2, mid.x, mid.y);
    });
    var moved = [];
    for (var i = 0; i < pieces.length && moved.length < 2; i++) {
      var r = pieces[i], cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      var dx = mid.x - cx, dy = mid.y - cy, d = Math.hypot(dx, dy);
      if (d < 3) continue;
      var step = Math.min(12, d - 2), nx = r.x + dx / d * step, ny = r.y + dy / d * step;
      if (nx < 0 || ny < 0 || nx + r.w > W || ny + r.h > H) continue;
      var clash = state.terrain.some(function (o) {
        return o !== r && nx < o.x + o.w + 0.5 && nx + r.w + 0.5 > o.x && ny < o.y + o.h + 0.5 && ny + r.h + 0.5 > o.y;
      }) || state.objectives.some(function (o) {
        return o.x > nx - 3 && o.x < nx + r.w + 3 && o.y > ny - 3 && o.y < ny + r.h + 3;
      });
      if (clash) continue;
      R.placePiece(r, nx, ny);                     // the outline goes with it
      moved.push(R.TERRAIN[r.kind].name.toLowerCase() + ' ' + step.toFixed(1) + '"');
    }
    if (moved.length) logLine('terrain', sideName(side) + ' — Detailed Terrain Knowledge: moves the ' + moved.join(' and the ') + '.');
  }

  function docsOf(side) { return (state && state.doctrines && state.doctrines[side]) || []; }

  // vehicles and aircraft get +4" on a Move; everyone else +2"
  function moveBonus(u, action) {
    var base = R.isMachine(u) ? 4 : 2;
    /* Riders take their Movement +4" whatever they are doing (p. 94), and a Human
       Wave carries the infantry 4" further on Move and Assault actions (p. 95). */
    if (R.has(u, 'Riders')) base = Math.max(base, 4);
    if (u.tactic === 'wave' && u.cls === 'infantry' &&
      (action === 'move' || action === 'assault')) base += 4;
    if (!C || !state) return base;
    return C.moveBonus(u, base, action || 'move', state.doctrines ? state.doctrines[u.side] : null);
  }

  function onTable(u) { return u.alive && u.x >= 0 && !u.aboard; }

  // troops riding inside are off the table entirely
  function activeUnits(side) {
    return state.units.filter(function (u) { return onTable(u) && (!side || u.side === side); });
  }

  function zoneFor(side) { return SC.zoneFor(state, side); }

  // the scenario may use a circle rather than a strip
  function deployOK(side, x, y, u) {
    if (x < UR || y < UR || x > W - UR || y > H - UR) return false;
    var say = SC.deployOK(state, side, x, y, u);
    if (say !== null) return say;
    var bx = boxesFor(side);
    if (bx) return SC.inBoxes(bx, x, y);
    var z = zoneFor(side);
    return !!z && x >= z[0] && x <= z[1];
  }

  // some scenarios hand a side a set of rectangles rather than a strip or a circle
  function boxesFor(side) {
    return (state.sc && state.sc.boxes && state.sc.boxes[side]) || null;
  }

  function pointInBox(b) {
    return {
      x: Math.max(UR, Math.min(W - UR, b.x + Math.random() * b.w)),
      y: Math.max(UR, Math.min(H - UR, b.y + Math.random() * b.h))
    };
  }

  function inReserve(side) {
    return state.units.filter(function (u) {
      return u.alive && u.reserve && (!side || u.side === side);
    });
  }

  /* No more than half the army may come in by Battlefield Insertion (p. 56), so
     the rest of the insertion troops deploy in the strip like everyone else. */
  function markReserves(side) {
    if (SC.noInsertion(state)) return 0;             // the scenario forbids it
    var mine = state.units.filter(function (u) { return u.side === side; });
    var cap = Math.floor(mine.length / 2);
    var n = 0;
    mine.forEach(function (u) {
      u.reserve = false;
      if (!R.has(u, 'Battlefield Insertion') || u.aboard) return;
      if (R.has(u, 'Stationary Artillery')) return;    // an emplaced gun is never in reserve
      if (n >= cap) return;
      u.reserve = true; u.x = -1; u.y = -1; n++;
    });
    return n;
  }

  // Battlefield Insertion: 12" from any objective, 4" in from the edge
  function insertionLegal(p) {
    if (SC.noInsertion(state)) return false;
    if (p.x < 4 || p.y < 4 || p.x > W - 4 || p.y > H - 4) return false;
    for (var i = 0; i < state.objectives.length; i++) {
      if (R.inches(p.x, p.y, state.objectives[i].x, state.objectives[i].y) < 12) return false;
    }
    return !R.TERRAIN[R.terrainAt(state, p.x, p.y)].impassable;
  }

  /* The arrival point holds on 1-3; on 4-6 the opponent shoves it up to 2D6" in
     any direction, and the opponent naturally shoves it towards their own guns. */
  function scatterInsertion(u) {
    var die = R.d6();
    var tell = !isAI(u.side);                        // the OpFor's own drops just go in the log
    // Coordinated Hive (p. 124): the swarm re-rolls a failed die in the Reserve phase
    if (die >= 4 && state.doctrines && (state.doctrines[u.side] || []).indexOf('BB1') >= 0) {
      var first = die;
      die = R.d6();
      logLine('note', 'Coordinated Hive — ' + u.label + ' re-rolls its insertion: D6 ' + first + ' → ' + die + '.');
    }
    if (die < 4) {
      logLine('note', u.label + ' inserts on target (D6 ' + die + ').');
      if (tell) pushRes({
        kind: 'Insertion', title: u.name, side: u.side,
        dice: [{ label: 'D6', value: die, tone: 'crit' }],
        note: 'Battlefield Insertion — on 1-3 the arrival point stays where it was put.',
        outcome: { text: 'Lands on the nominated point.', tone: 'good' }
      });
      return;
    }
    var drift = R.d6() + R.d6();
    // the enemy drags the marker towards their nearest gun; failing that, anywhere
    var foe = activeUnits(other(u.side)).filter(function (e) { return R.status(e) !== 'broken'; })
      .sort(function (a, b) { return R.inches(a.x, a.y, u.x, u.y) - R.inches(b.x, b.y, u.x, u.y); })[0];
    var ang = foe ? Math.atan2(foe.y - u.y, foe.x - u.x) : Math.random() * Math.PI * 2;
    var fixed = R.clampBoard({ x: u.x + Math.cos(ang) * drift, y: u.y + Math.sin(ang) * drift });
    for (var t = 0; t < 40 && (R.TERRAIN[R.terrainAt(state, fixed.x, fixed.y)].impassable
      || R.unitNear(state, fixed.x, fixed.y, u, 1)); t++) {
      var a2 = ang + (Math.random() - 0.5) * 1.6, d2 = 1 + Math.random() * 3;
      fixed = R.clampBoard({ x: fixed.x + Math.cos(a2) * d2, y: fixed.y + Math.sin(a2) * d2 });
    }
    u.x = fixed.x; u.y = fixed.y;
    logLine('note', u.label + ' inserts (D6 ' + die + ') and is shoved ' + drift + '" off the mark' +
      (foe ? ' — towards ' + foe.name + '.' : '.'));
    if (tell) pushRes({
      kind: 'Insertion', title: u.name, side: u.side,
      dice: [{ label: 'D6', value: die, tone: 'fail' }, { label: '2D6"', value: drift }],
      note: 'Battlefield Insertion — on 4-6 the opponent moves the arrival point up to 2D6" in any direction, and moves it towards their own guns.',
      outcome: { text: 'Shoved ' + drift + '" off the nominated point.', tone: 'warn' }
    });
  }

  /* Arriving within 12" of the enemy invites a free shot from the closest
     unsuppressed enemy that can see them (p. 30). It is not an activation. */
  function greetArrival(u) {
    var best = null, bd = Infinity;
    activeUnits(other(u.side)).forEach(function (e) {
      if (R.status(e) !== 'ready' || e.fp === null) return;
      var d = R.unitDist(e, u);
      if (d > 12 || d > e.range) return;
      if (!R.hasLoS(state, e, u)) return;
      if (d < bd) { bd = d; best = e; }
    });
    if (!best) return null;
    var res = R.shoot(state, best, u, 'basic', {});
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    logLine('note', best.label + ' was waiting for them — ' + u.label + ' came down inside 12".');
    return { shooter: best, res: res };
  }

  /* Auto-deployment samples the ground the scenario actually gives this side —
     a circle around the objective, a set of edge bands, or a strip — and never
     the default strip, which for a circle defender is entirely illegal ground. */
  function autoDeploy(side, limit) {
    var circ = state.sc && state.sc.defCircle && state.sc.defender === side
      ? state.sc.defCircle : null;
    var boxes = circ ? null : boxesFor(side);
    var z = (circ || boxes) ? null : zoneFor(side);
    var waiting = state.units.filter(function (u) {
      return u.side === side && u.x < 0 && !u.reserve && !u.aboard;
    });
    if (limit != null) waiting = waiting.slice(0, limit);
    var keen = state.sc && state.sc.defender === side ? 0.85 : 0.5;
    waiting.forEach(function (u, i) {
      if (garrisonable(u) && Math.random() < keen) {
        var gsp = garrisonSpots(side, u);
        if (gsp.length) { var g = gsp[Math.floor(Math.random() * gsp.length)]; R.enterBuilding(state, u, g.piece, g.sec); return; }
      }
      for (var attempt = 0; attempt < 400; attempt++) {
        var x, y;
        if (circ) {
          var a = Math.random() * Math.PI * 2;
          var r = Math.sqrt(Math.random()) * Math.max(1, circ.r - 1);
          x = R.clampBoard({ x: circ.x + Math.cos(a) * r, y: circ.y + Math.sin(a) * r }).x;
          y = clampY(circ.y + Math.sin(a) * r);
        } else if (boxes) {
          var pb = pointInBox(boxes[(i + attempt) % boxes.length]);
          x = pb.x; y = pb.y;
        } else if (z) {
          y = 3 + ((i * 5.2 + attempt * 0.7) % (H - 6));
          x = side === 'A' ? z[0] + 1 + (i % 3) * 1.6 : z[1] - 1 - (i % 3) * 1.6;
          if (z[0] > UR + 1 && z[1] < W - UR - 1) x = z[0] + ((i * 3.1 + attempt) % (z[1] - z[0]));
        } else {
          break;                                   // nothing deploys: it arrives by drop
        }
        if (!deployOK(side, x, y, u)) continue;
        if (R.TERRAIN[R.terrainAt(state, x, y)].impassable) continue;
        if (R.unitNear(state, x, y, u, 1)) continue;
        u.x = x; u.y = y; return;
      }
      /* Nowhere clear inside the zone — the ground is full or blocked. Spiral out
         from the middle of the zone for the nearest legal spot rather than dumping
         the unit on a table edge it has no right to be on. */
      var mid = zoneCentre(side), best = null;
      for (var rad = 0; rad <= 24 && !best; rad += 1) {
        for (var k = 0; k < 24; k++) {
          var ang = k / 24 * Math.PI * 2 + i;
          var px = mid.x + Math.cos(ang) * rad, py = mid.y + Math.sin(ang) * rad;
          if (px < UR || py < UR || px > W - UR || py > H - UR) continue;
          if (!deployOK(side, px, py, u)) continue;
          if (R.TERRAIN[R.terrainAt(state, px, py)].impassable) continue;
          if (R.unitNear(state, px, py, u, 0.6)) continue;
          best = { x: px, y: py }; break;
        }
      }
      if (best) { u.x = best.x; u.y = best.y; return; }
      u.x = clampY(mid.x); u.y = clampY(mid.y);
    });
  }

  function clampY(v) { return Math.max(UR, Math.min(H - UR, v)); }

  // the building section under a point, if any
  function garrisonAt(x, y) {
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i];
      if (!R.enterable(r) || !R.inRect(x, y, r)) continue;
      var ss = R.sectionsOf(r);
      for (var n = 0; n < ss.length; n++) {
        var q = ss[n];
        if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return { piece: r, sec: n, rect: q };
      }
    }
    return null;
  }

  // a unit that could hold a building (not yet on the table, so R.canGarrison's position test is skipped)
  function garrisonable(u) {
    return u.cls === 'infantry' && !R.has(u, 'Riders') && !R.isFlying(u) && !R.has(u, 'Stationary Artillery') && !R.has(u, 'Immobile');
  }

  /* The empty sections a side could garrison as it deploys. The machine puts a
     squad in one about half the time it can, and a defender nearly always. */
  function garrisonSpots(side, u) {
    var out = [];
    state.terrain.forEach(function (r) {
      if (!R.enterable(r)) return;
      R.sectionsOf(r).forEach(function (q, n) {
        if (R.occupant(state, r, n)) return;
        if (!deployOK(side, q.x + q.w / 2, q.y + q.h / 2, u)) return;
        out.push({ piece: r, sec: n, rect: q });
      });
    });
    return out;
  }

  /* The middle of the ground a side has to deploy into: the centre of its strip,
     or of its circle when the scenario gives it one. */
  function zoneCentre(side) {
    var circ = state.sc && state.sc.defCircle;
    if (circ && state.sc.defender === side) return { x: circ.x, y: circ.y };
    var bx = boxesFor(side);
    if (bx && bx.length) return { x: bx[0].x + bx[0].w / 2, y: bx[0].y + bx[0].h / 2 };
    var z = zoneFor(side);
    if (!z) return { x: W / 2, y: H / 2 };
    return { x: (z[0] + z[1]) / 2, y: H / 2 };
  }

  // whichever side still has units in hand, and is not the OpFor
  function placingSide() {
    if (state.relocating) return state.relocating.side;
    var u = deployNext();
    return u ? u.side : null;
  }

  /* ---- which unit the next tap puts down ----
     A commander sets his line down in the order he likes, so the player picks:
     any unit still in hand, or one already placed, to shift it. Until he picks,
     it is simply the next one still in hand. */
  function deployRoster(side) {
    return state.units.filter(function (u) {
      return u.alive && !isAI(u.side) && !u.reserve && !u.aboard &&
        (side ? u.side === side : true);
    });
  }

  function deployNext() {
    if (ui.deployPick) {
      var p = byId(ui.deployPick);
      if (p && p.alive && !isAI(p.side) && !p.reserve && !p.aboard) return p;
      ui.deployPick = null;
    }
    return deployRoster().filter(function (u) { return u.x < 0; })[0] || null;
  }

  function pickToDeploy(id) {
    var u = byId(id);
    if (!u || state.phase !== 'deploy') return;
    ui.deployPick = u.id;
    if (u.x >= 0) focusUnit(u); else lookAtDeployment(u.side);
    render();
  }

  /* A tap near the strip is a tap at the strip. Putting a model down on a real
     table is not a pixel-accurate business, and in this projection a 5" band runs
     across the view as a narrow diagonal — so a tap that misses by a few inches
     is pulled to the nearest legal ground rather than refused outright. */
  function nearestDeploySpot(u, x, y, pull) {
    var boxes = boxesFor(u.side);
    var z = boxes ? null : zoneFor(u.side);
    var circ = state.sc && state.sc.defCircle && state.sc.defender === u.side
      ? state.sc.defCircle : null;
    var from;
    if (boxes) {
      // pull the tap into whichever of the side's rectangles is nearest
      var bb = null, bbd = Infinity;
      boxes.forEach(function (b) {
        var qx = Math.max(b.x + UR, Math.min(b.x + b.w - UR, x));
        var qy = Math.max(b.y + UR, Math.min(b.y + b.h - UR, y));
        var d2 = Math.hypot(qx - x, qy - y);
        if (d2 < bbd) { bbd = d2; bb = { x: qx, y: qy }; }
      });
      from = bb || { x: x, y: y };
    } else if (circ) {
      var d = Math.hypot(x - circ.x, y - circ.y) || 1;
      var k = Math.min(1, Math.max(0, circ.r - UR) / d);
      from = { x: circ.x + (x - circ.x) * k, y: circ.y + (y - circ.y) * k };
    } else if (z) {
      from = { x: Math.max(z[0] + UR, Math.min(z[1] - UR, x)), y: clampY(y) };
    } else {
      return null;
    }
    var best = null, bd = Infinity;
    for (var r = 0; r <= 7 && !best; r += 0.5) {
      for (var a = 0; a < 16; a++) {
        var ang = a / 16 * Math.PI * 2;
        var px = from.x + Math.cos(ang) * r, py = from.y + Math.sin(ang) * r;
        if (!deployOK(u.side, px, py, u)) continue;
        if (R.TERRAIN[R.terrainAt(state, px, py)].impassable) continue;
        if (R.unitNear(state, px, py, u, 1)) continue;
        var dd = Math.hypot(px - x, py - y);
        if (dd < bd) { bd = dd; best = { x: px, y: py }; }
      }
    }
    return best && bd <= (pull || 9) ? best : null;
  }

  // a Rapid insertion platform that nobody is riding down in (p. 79)
  function emptyPlatforms(side) {
    return state.units.filter(function (u) {
      return u.alive && u.transport && R.has(u, 'Immobile') && !(u.cargo || []).length &&
        (!side || u.side === side);
    });
  }

  /* Every platform starts the battle with a squad aboard. This seats them as the
     table is laid out, so the rule holds even when nobody touches the card. */
  function seatPlatforms() {
    emptyPlatforms().forEach(function (v) {
      /* A line squad rather than the colonel: a command unit is the last thing
         anyone straps into a drop pod, and a Cumbersome Weapon cannot fire the
         turn it steps off anyway. */
      var pool = boardableFor(v).slice().sort(function (a, b2) {
        var pa = (a.command ? 4 : 0) + (R.has(a, 'Cumbersome Weapon') ? 2 : 0) + a.tier * 0.1;
        var pb = (b2.command ? 4 : 0) + (R.has(b2, 'Cumbersome Weapon') ? 2 : 0) + b2.tier * 0.1;
        return pa - pb;
      });
      if (pool.length) loadBefore(v, pool[0], true);
    });
  }

  function deploymentDone() {
    if (emptyPlatforms().length) return false;
    return state.units.every(function (u) { return u.x >= 0 || u.aboard || u.reserve; });
  }

  function startBattle() {
    /* Rapid Relocation (O3, p. 87): once everyone is down, a side holding the
       doctrine may pick up to half the units it put on the table and set them
       down again, anywhere its deployment allows. No unit moves twice. */
    if (state.relocating) { finishRelocation(); return; }
    state.relocDone = state.relocDone || {};
    var rs = ['A', 'B'].filter(function (sd) {
      return !state.relocDone[sd] && docsOf(sd).indexOf('O3') >= 0 && relocCap(sd) > 0;
    });
    // the OpFor makes its choice at once; a player (or two, in hotseat) is asked in turn
    rs.sort(function (a, b) { return (isAI(b) ? 1 : 0) - (isAI(a) ? 1 : 0); });
    for (var ri = 0; ri < rs.length; ri++) {
      var sd = rs[ri];
      state.relocDone[sd] = true;
      if (isAI(sd)) { aiRelocate(sd); continue; }
      state.relocating = { side: sd, cap: relocCap(sd), moved: [] };
      ui.deployPick = null;
      logLine('note', sideName(sd) + ' — Rapid Relocation: up to ' + state.relocating.cap + ' units may be moved.');
      lookAtDeployment(sd);
      setHint(null, 'Rapid Relocation: tap one of your units, then tap where it should go — up to ' +
        state.relocating.cap + ' of them. Begin the battle when you are done.');
      render();
      return;
    }
    state.phase = 'battle';
    ['A', 'B'].forEach(function (side) { if (docsOf(side).indexOf('XO5') >= 0) fortify(side); });
    // Ambush!: each unit settles into its hide before the first turn (p. 156)
    if (state.scen.beforeBattle) {
      var moved = state.scen.beforeBattle(state) || [];
      moved.forEach(function (l) { logLine('note', l.text); });
      if (moved.length) pushRes({ kind: 'Deployment', title: 'Taking cover', note: state.scen.name + ': each unit rolls a D6 as it finds its hiding place.', list: moved });
    }
    beginTurn(); revealBoard();
  }

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

  /* The OpFor, having seen the other side go down: each unit standing in the
     open looks for cover somewhere else in its ground, the ones closest to the
     enemy first, and half the force at most makes the move. */
  function aiRelocate(side) {
    var cap = relocCap(side), n = 0;
    var foe = state.units.filter(function (e) { return e.side !== side && onTable(e); });
    function coverAt(x, y) { return R.TERRAIN[R.terrainAt(state, x, y)].cover || 0; }
    function nearFoe(u) { return foe.reduce(function (m, e) { return Math.min(m, R.unitDist(u, e)); }, 999); }
    var cand = state.units.filter(function (u) {
      return u.side === side && u.alive && u.x >= 0 && !u.reserve && !u.aboard && !R.isMachine(u) && !coverAt(u.x, u.y);
    }).sort(function (a, b) { return nearFoe(a) - nearFoe(b); });
    cand.forEach(function (u) {
      if (n >= cap) return;
      var best = null, bs = 0;
      for (var k = 0; k < 160; k++) {
        var q = nearestDeploySpot(u, u.x + (Math.random() - 0.5) * 36, u.y + (Math.random() - 0.5) * 36, 40);
        if (!q || !relocSpotOK(u, q.x, q.y)) continue;
        var sc = coverAt(q.x, q.y) * 10 - Math.hypot(q.x - u.x, q.y - u.y) * 0.1;
        if (coverAt(q.x, q.y) && sc > bs) { bs = sc; best = q; }
      }
      if (best) { u.bld = null; u.sec = null; u.x = best.x; u.y = best.y; n++; }
    });
    if (n) logLine('note', sideName(side) + ' — Rapid Relocation: ' + n + ' unit' + (n === 1 ? '' : 's') + ' shift into cover.');
  }

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

  /* ================= turn structure ================= */
  /* Reserve phase (p. 30): from the second turn on, units held back may come in.
     Placing them is not an action, so they can act normally afterwards. */
  function reservePhase(done) {
    // the scenario's own reinforcements arrive first — the player choosing where
    scenarioArrivals(function () { afterArrivals(done); });
  }

  function afterArrivals(done) {
    if (state.turn < 2 || state.solo) { done(); return; }
    /* Know Your Foe! (p. 141): once a battle, the tribe stops every enemy
       reinforcement arriving this turn — used the first turn the enemy has any. */
    state.kyf = state.kyf || {};
    ['A', 'B'].forEach(function (side) {
      var foe = other(side);
      if (docsOf(side).indexOf('XO6') < 0 || state.kyf[side]) return;
      if (!inReserve().some(function (u) { return u.side === foe && !u.wave; })) return;
      state.kyf[side] = state.turn;
      logLine('note', sideName(side) + ' — Know Your Foe!: no reinforcements reach ' + sideName(foe) + ' this turn.');
      pushRes({ kind: 'Advancement', title: 'Know Your Foe!', side: side, note: 'Once a battle: every enemy reinforcement is held back this turn.' });
    });
    function held(u) { var f = other(u.side); return state.kyf && state.kyf[f] === state.turn; }
    var mine = inReserve().filter(function (u) { return !u.wave && !held(u); });
    var i = 0;
    if (!mine.length) { done(); return; }
    // the sides take it in turn, starting with the initiative
    var order = [];
    var a = mine.filter(function (u) { return u.side === state.initiative; });
    var b = mine.filter(function (u) { return u.side !== state.initiative; });
    for (var k = 0; k < Math.max(a.length, b.length); k++) {
      if (a[k]) order.push(a[k]);
      if (b[k]) order.push(b[k]);
    }
    function next() {
      if (i >= order.length) { done(); return; }
      var u = order[i++];
      if (!u.alive || !u.reserve) { next(); return; }
      if (isAI(u.side)) { aiInsert(u); whenIdle(next); return; }
      askInsertion(u, next);
    }
    next();
  }

  /* Scenario reinforcements: units the scenario holds back and then releases —
     a second wave, a defender's reserve, an orbital drop into a landing zone.
     They are placed where the scenario says rather than by the player. */
  /* Crushing the Resistance and Sabotage: before the first drop, each player
     nominates the landing zone their commando comes down in (pp. 150, 155). */
  function lzWanted() {
    if (!state.scen.needLZ || state.turn !== 1) return null;
    state.sc.lz = state.sc.lz || {};
    var own = state.solo ? state.solo.owners : [1];
    for (var i = 0; i < own.length; i++) {
      var o = own[i];
      if (state.sc.lz[o]) continue;
      var any = state.units.some(function (u) { return u.side === 'A' && (u.owner || 1) === o && u.reserve && u.wave === 1; });
      if (any) return o;
    }
    return null;
  }

  function askLZ(owner, done) {
    if (isAI('A')) {
      state.sc.lz[owner] = SOLO.autoLZ(state, owner);
      logLine('note', (state.solo ? soloOwnerName(owner) : 'The commando') + ' nominates a landing zone.');
      done(); return;
    }
    var spots = SOLO.lzSpots(state, owner);
    if (!spots.length) { state.sc.lz[owner] = SOLO.autoLZ(state, owner); done(); return; }
    ui.insertion = { unit: null, owner: owner, done: done, spots: spots, kind: 'lz' };
    ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
    fitView();
    setHint(null, (state.solo && state.solo.coop ? soloOwnerName(owner) + ': tap' : 'Tap') +
      ' the shaded ground to nominate your landing zone.');
    revealConsole();
    render();
  }

  function scenarioArrivals(after) {
    var lzFor = lzWanted();
    if (lzFor) { askLZ(lzFor, function () { scenarioArrivals(after); }); return; }
    var log = [];
    /* The OpFor's reinforcements are placed for it; the player's are asked for,
       one at a time, because where along a landing zone or a table edge a unit
       comes on is a decision the book leaves open and a dice roll should not
       be making. */
    var ask = [];
    ['A', 'B'].forEach(function (side) {
      var coming = SC.reserves(state, side);
      /* Semper Fidelis (Battle Honour, p. 88): a unit held in the scenario's
         reserve may come on automatically on any turn but the first — no roll,
         no waiting for its wave. Where it may come on is still the scenario's. */
      if (state.turn >= 2 && !(state.sc && state.sc.zonesHot === state.turn && state.sc.attacker === side)) {
        state.units.forEach(function (u) {
          if (u.side !== side || !u.alive || !u.reserve || coming.indexOf(u) >= 0) return;
          if (!semperFidelis(u) || u.wave == null || u.wave === 'pool') return;
          u.sfOffer = true;
          coming.push(u);
        });
      }
      coming.forEach(function (u) {
        if (!u.alive || !u.reserve) return;
        // a solitaire scenario says exactly where its units come on
        if (!isAI(u.side) && !state.scen.autoArrive) { ask.push(u); return; }
        u.sfOffer = false;
        var p = arrivalPoint(u);
        if (!p) return;
        landArrival(u, p, log);
        if (semperFidelis(u)) log.push(u.label + ' — Semper Fidelis: arrives when called for.');
        showArrival(u);
      });
    });
    // Invasion: the second wave waved off because every zone is in enemy hands (p. 53)
    if (state.sc && state.sc.zonesHot === state.turn) {
      var hot = 'All landing zones are hot! Repeat! All landing zones are hot! — the '
        + 'second wave cannot come down this turn.';
      logLine('note', hot);
      log.push(hot);
    }
    function report() {
      if (log.length) {
        pushRes({
          kind: 'Reserves', title: 'Turn ' + state.turn + ' — reinforcements',
          note: state.scen.name + ': units held back come onto the table.',
          list: log.map(function (t) { return { text: t }; })
        });
        render();
      }
      if (after) after();
    }

    // ask for each of the player's in turn, then report the lot together
    var i = 0;
    (function next() {
      if (i >= ask.length) { report(); return; }
      var u = ask[i++];
      if (!u.alive || !u.reserve) { next(); return; }
      askArrival(u, log, next);
    })();
  }

  /* Where a scenario reinforcement comes on. Landing zones for an Invasion drop,
     the side's own table edge otherwise. */
  function arrivalPoint(u) {
    if (state.scen.arrivalPoint) return state.scen.arrivalPoint(state, u);
    var sc = state.sc;
    if (state.scen.id === 'invasion' && u.side === sc.attacker) {
      // into a zone the attacker holds, or a neutral one
      var zones = state.objectives.filter(function (o) { return o.owner !== sc.defender; });
      if (!zones.length) zones = state.objectives.slice();
      for (var t = 0; t < 400; t++) {
        var z = zones[Math.floor(Math.random() * zones.length)];
        var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 4;
        var p = R.clampBoard({ x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r });
        if (R.TERRAIN[R.terrainAt(state, p.x, p.y)].impassable) continue;
        if (R.unitNear(state, p.x, p.y, u, 1)) continue;
        p.why = 'in the landing zone';
        return p;
      }
      return null;
    }
    /* Everyone else walks on from their own table edge — which in Demolish is the
       stretches of edge around the corners that side owns, not a whole side of
       the table (p. 54). */
    var entry = sc && sc.entry && sc.entry[u.side];
    if (entry && entry.length) {
      for (var e = 0; e < 600; e++) {
        // which band — which table edge, which corner — is chosen fresh each time
        var b = entry[Math.floor(Math.random() * entry.length)];
        var q = {
          x: Math.max(UR, Math.min(W - UR, b.x + Math.random() * b.w)),
          y: Math.max(UR, Math.min(H - UR, b.y + Math.random() * b.h))
        };
        if (R.TERRAIN[R.terrainAt(state, q.x, q.y)].impassable) continue;
        if (R.unitNear(state, q.x, q.y, u, 1)) continue;
        return { x: q.x, y: q.y, why: 'from its own table edge' };
      }
      return null;
    }
    var edge = u.side === 'A' ? UR + 0.5 : W - UR - 0.5;
    for (var k = 0; k < 400; k++) {
      var y = UR + Math.random() * (H - 2 * UR);
      var x = edge + (Math.random() - 0.5) * 2;
      if (R.TERRAIN[R.terrainAt(state, x, y)].impassable) continue;
      if (R.unitNear(state, x, y, u, 1)) continue;
      return { x: R.clampBoard({ x: x, y: y }).x, y: y, why: 'from its own table edge' };
    }
    return null;
  }

  /* ---- where a scenario reinforcement may legally come on ----

     `arrivalPoint` picks one of these at random, which is right for the OpFor
     and wrong for the player: the book gives a landing zone or a stretch of
     table edge, and choosing where inside it to come on is a decision worth
     making — behind the wall, or out wide. So the same area is sampled on a 2"
     lattice and offered the way an insertion is. */
  function arrivalLegal(u, p) {
    if (p.x < UR || p.y < UR || p.x > W - UR || p.y > H - UR) return false;
    if (state.scen.arrivalLegal) return state.scen.arrivalLegal(state, u, p) && !R.unitNear(state, p.x, p.y, u, 1);
    if (R.TERRAIN[R.terrainAt(state, p.x, p.y)].impassable) return false;
    if (R.unitNear(state, p.x, p.y, u, 1)) return false;
    var sc = state.sc;
    // Invasion: the attacker comes down in a zone the defender does not hold
    if (state.scen.id === 'invasion' && sc && u.side === sc.attacker) {
      var zones = state.objectives.filter(function (o) { return o.owner !== sc.defender; });
      if (!zones.length) zones = state.objectives;
      return zones.some(function (z) { return R.inches(p.x, p.y, z.x, z.y) <= 4; });
    }
    // everyone else walks on from their own edge, or the corners they own
    var entry = sc && sc.entry && sc.entry[u.side];
    if (entry && entry.length) {
      return entry.some(function (b) {
        return p.x >= b.x - 0.5 && p.x <= b.x + b.w + 0.5 &&
          p.y >= b.y - 0.5 && p.y <= b.y + b.h + 0.5;
      });
    }
    var edge = u.side === 'A' ? UR + 0.5 : W - UR - 0.5;
    return Math.abs(p.x - edge) <= 1.5;
  }

  function arrivalSpots(u) {
    var out = [];
    for (var x = 1; x <= W - 1; x += 1) {
      for (var y = 1; y <= H - 1; y += 1) {
        var p = { x: x, y: y };
        if (arrivalLegal(u, p)) out.push(p);
      }
    }
    return out;
  }

  // the OpFor drops on the objective it most wants, or behind the player's line
  function aiInsert(u) {
    var want = null, wd = Infinity;
    state.objectives.forEach(function (o) {
      var held = o.owner && o.owner !== u.side ? -6 : 0;
      var d = held + R.inches(o.x, o.y, W / 2, H / 2);
      if (d < wd) { wd = d; want = o; }
    });
    for (var k = 0; k < 400; k++) {
      var ang = Math.random() * Math.PI * 2, rad = 12 + Math.random() * 8;
      var p = want
        ? { x: want.x + Math.cos(ang) * rad, y: want.y + Math.sin(ang) * rad }
        : { x: 8 + Math.random() * (W - 16), y: 4 + Math.random() * (H - 8) };
      if (!insertionLegal(p)) continue;
      if (R.unitNear(state, p.x, p.y, u, 1)) continue;
      u.x = p.x; u.y = p.y; u.reserve = false;
      logLine('note', u.label + ' comes in by Battlefield Insertion.');
      scatterInsertion(u);
      landUnit(u);
      return;
    }
    u.reserve = false;                                // nowhere legal: it stays out
    logLine('note', u.label + ' could find no drop zone and stays in reserve.');
  }

  /* Where a drop may legally go, sampled across the table on a 2" lattice. It
     shades the ground for the player, and it answers the question that used to
     wedge the game: whether there is anywhere to drop at all. */
  function insertionSpots(u) {
    var out = [];
    if (SC.noInsertion(state)) return out;
    for (var x = 4; x <= W - 4; x += 2) {
      for (var y = 4; y <= H - 4; y += 2) {
        var p = { x: x, y: y };
        if (!insertionLegal(p)) continue;
        if (R.unitNear(state, x, y, u, 1)) continue;
        out.push(p);
      }
    }
    return out;
  }

  // the player picks the drop point by tapping the table
  function askInsertion(u, done) {
    var spots = insertionSpots(u);
    /* No legal ground anywhere — the objectives and the table edge between them
       cover it. The unit stays out rather than the turn stopping dead. */
    if (!spots.length) {
      u.reserve = true;
      logLine('note', u.label + ' could find no drop zone clear of the objectives and stays in reserve.');
      setHint(null, u.name + ' has nowhere legal to come down this turn and stays in reserve.');
      whenIdle(function () { done(); });
      return;
    }
    ui.insertion = { unit: u, done: done, spots: spots, kind: 'insert' };
    ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
    focusUnit(u, false, true);
    setHint(null, u.name + ' is coming in: tap the shaded ground — 12" from every objective and 4" in from the edge.');
    /* On a phone the panel under the board is a stack of tabs, and the player is
       often sitting on the combat results when this fires — so the prompt was
       rendered into a pane nobody was looking at and the turn appeared to stop
       for no reason. Bring the Actions pane to the front before asking. */
    revealConsole();
    render();
  }

  /* A scenario reinforcement: the scenario says it is coming on this turn, so
     there is no holding it back — but where inside the legal ground it arrives
     is the player's call, not a dice roll. */
  function askArrival(u, log, done) {
    var spots = arrivalSpots(u);
    if (!spots.length) {
      // no legal ground: fall back to the old random point rather than stalling
      var p = arrivalPoint(u);
      if (p) { landArrival(u, p, log); showArrival(u); }
      whenIdle(function () { done(); });
      return;
    }
    ui.insertion = { unit: u, done: done, spots: spots, kind: 'arrive', log: log };
    ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
    focusUnit(u, false, true);
    setHint(null, u.name + ' is arriving: tap the shaded ground to choose where it comes on.');
    revealConsole();
    render();
  }

  // put an arriving unit down and tell the player what the scenario makes of it
  function landArrival(u, p, log) {
    u.x = p.x; u.y = p.y; u.reserve = false; u.wave = 0;
    var note = state.scen.onArrive ? state.scen.onArrive(state, u) : null;
    var line = u.label + ' arrives' + (p.why ? ' ' + p.why : '') + (note ? ' — ' + note.text : '') + '.';
    if (log) log.push(line);
    logLine('note', u.label + ' arrives' + (p.why ? ' ' + p.why : '') + '.');
    if (note) logLine('note', note.text);
    return line;
  }

  // the player would rather keep it back for a turn (p. 56: coming in is optional)
  function holdInsertion() {
    var ins = ui.insertion;
    if (!ins) return;
    ins.unit.reserve = true;
    logLine('note', ins.unit.label + ' holds off and stays in reserve.');
    ui.insertion = null; ui.mode = 'idle'; ui.hint = null;
    var done = ins.done;
    render();
    whenIdle(function () { done(); });
  }

  /* Semper Fidelis (p. 88) brings the unit's transport with it — but only when
     the unit is the one thing riding in it. */
  function semperFidelis(u) {
    if (R.campFlag(u, 'semperFidelis')) return true;
    var c = u.cargo || [];
    return c.length === 1 && R.campFlag(c[0], 'semperFidelis');
  }

  function sfName(u) {
    var c = u.cargo || [];
    return !R.campFlag(u, 'semperFidelis') && c.length === 1 ? c[0].name + ' (aboard ' + u.name + ')' : u.name;
  }

  // Semper Fidelis: the player would rather call the unit in on a later turn
  function holdArrival() {
    var ins = ui.insertion;
    if (!ins || !ins.unit) return;
    ins.unit.sfOffer = false;
    logLine('note', ins.unit.label + ' — Semper Fidelis: held back for now.');
    ui.insertion = null; ui.mode = 'idle'; ui.hint = null;
    var done = ins.done;
    render();
    whenIdle(function () { done(); });
  }

  // in the player's words, where this unit is allowed to come on
  function arrivalWhere(u) {
    var sc = state.sc;
    if (state.scen.id === 'invasion' && sc && u.side === sc.attacker) {
      return 'within 4" of a landing zone you hold or that is still neutral';
    }
    var entry = sc && sc.entry && sc.entry[u.side];
    if (entry && entry.length > 1) return 'along the stretches of table edge your side owns';
    return 'along your own table edge';
  }

  function snapToSpot(ins, p) {
    var spots = ins.spots || [];
    if (!spots.length) return null;
    var reach = SNAP_NEAR;
    var best = null, bd = Infinity;
    for (var i = 0; i < spots.length; i++) {
      var d = R.inches(p.x, p.y, spots[i].x, spots[i].y);
      if (d < bd) { bd = d; best = spots[i]; }
    }
    return bd <= reach ? best : null;
  }

  function placeInsertion(p) {
    var ins = ui.insertion;
    if (!ins) return;
    var u = ins.unit;
    if (ins.kind === 'lz') {
      var lzOK = SOLO.lzLegal(state, p, ins.owner);
      if (!lzOK) {
        var nz = snapToSpot(ins, p);
        if (!nz) { setHint(null, 'Not there — open ground, 12" clear of every table edge' + (state.solo && state.solo.coop ? ', and 18" from the other landing zone' : '') + '.'); return; }
        p = nz;
      }
      state.sc.lz[ins.owner] = { x: p.x, y: p.y };
      logLine('note', (state.solo && state.solo.coop ? soloOwnerName(ins.owner) : 'The commando') + ' will come down in the landing zone at (' + p.x.toFixed(0) + '", ' + p.y.toFixed(0) + '").');
      ui.insertion = null; ui.mode = 'idle';
      var doneL = ins.done;
      render();
      whenIdle(function () { doneL(); });
      return;
    }
    if (ins.kind === 'arrive') {
      if (!arrivalLegal(u, p)) {
        var near = snapToSpot(ins, p);
        if (!near) {
          setHint(null, 'Not there — ' + arrivalWhere(u) + ', and off impassable ground.');
          return;
        }
        p = near;
      }
      if (u.sfOffer && ins.log) ins.log.push(u.label + ' — Semper Fidelis: called in.');
      u.sfOffer = false;
      landArrival(u, { x: p.x, y: p.y, why: 'where you put it' }, ins.log || null);
      showArrival(u);
      ui.insertion = null; ui.mode = 'idle';
      var doneA = ins.done;
      whenIdle(function () { doneA(); });
      return;
    }
    if (!insertionLegal(p) || R.unitNear(state, p.x, p.y, u, 1)) {
      var spot = snapToSpot(ins, p);
      if (!spot) {
        setHint(null, 'Not there — 12" clear of every objective, 4" in from the edge, and off impassable ground.');
        return;
      }
      p = spot;
    }
    u.x = p.x; u.y = p.y; u.reserve = false;
    logLine('note', u.label + ' comes in by Battlefield Insertion.');
    scatterInsertion(u);
    landUnit(u);
    ui.insertion = null; ui.mode = 'idle';
    var done = ins.done;
    whenIdle(function () { done(); });
  }

  /* ---- solitaire / cooperative turns (p. 146) ----
     Beginning, Reserve, Action (the players, alternating in a cooperative
     game), OpFor (every enemy unit, furthest from the players first), End. */
  function soloOwnerName(o) {
    var n = state.solo.names && state.solo.names[o - 1];
    return n || ('Player ' + o);
  }

  function soloEligible(owner) {
    ui.soloAll = true;                       // every player's units, not only the active one's
    try { return eligible('A').filter(function (u) { return !owner || (u.owner || 1) === owner; }); }
    finally { ui.soloAll = false; }
  }

  function soloBeginTurn() {
    state.turn += 1;
    state.units.forEach(function (u) {
      u.activated = false; u.marked = false; u.markMoved = false; u.shotFrom = []; u.coordUsed = false;
      u.hackUsed = false; u.hacked = false; u.supportUsed = false; u.advancing = false;
      u.disembarked = false;
    });
    state.chain = null; state.mark = null;
    state.initiative = null;
    state.activeSide = 'A';
    state.activeOwner = state.solo.owners[0];
    state.streak = 99;
    logLine('turn', 'Turn ' + state.turn + ' — Beginning phase.');
    ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.vis = null; ui.visKey = ''; ui.preview = null;
    // the scenario's own business: counters revealed, OpFor steadied, civilians handed over
    var news = state.scen.beginning ? state.scen.beginning(state) || [] : [];
    news.forEach(function (l) {
      logLine('note', l.text);
      if (l.unit) { l.unit.arriveAt = Date.now(); l.unit.arriveKind = 'stand'; addFx({ kind: 'collapse', x: l.unit.x, y: l.unit.y, r: 1.4, dur: 520, blocking: true }); }
    });
    if (state.structs) { paintStructures(); ui.vis = null; ui.visKey = ''; }
    pushRes({
      kind: 'Beginning phase', title: 'Turn ' + state.turn,
      note: state.scen.name + ' — the players act first, then the OpFor in a phase of its own.',
      list: news.length ? news.map(function (l) { return { text: l.text, side: l.unit ? 'B' : null }; }) : [{ text: 'Nothing new shows itself.' }]
    });
    var shown = news.filter(function (l) { return l.unit; })[0];
    if (shown) focusUnit(shown.unit, false, true);
    render();
    revealBoard();
    whenIdle(function () {
      reservePhase(function () {
        logLine('phase', 'Action phase — ' + (state.solo.coop ? soloOwnerName(state.activeOwner) + ' first.' : 'your commando.'));
        if (!soloEligible().length) { soloOpForPhase(); return; }
        render();
        maybeAI();
      });
    });
  }

  function soloOpForPhase() {
    state.activeSide = 'B';
    state.activeOwner = null;
    logLine('phase', 'OpFor phase.');
    pushRes({ kind: 'OpFor phase', title: 'Turn ' + state.turn + ' — the OpFor acts',
      note: 'Every enemy unit on the table activates, starting from the one furthest from your forces, and rolls on the behaviour table.' });
    render();
    if (!eligible('B').length) { rallyPhase(); return; }
    maybeAI();
  }

  // after any activation in a solitaire game: whose go is it now?
  function soloNext() {
    if (state.activeSide === 'A') {
      if (state.solo.coop) {
        var cur = state.activeOwner, o = state.solo.owners.filter(function (x) { return x !== cur; })[0];
        if (soloEligible(o).length) state.activeOwner = o;
        else if (!soloEligible(cur).length) { soloOpForPhase(); return; }
      } else if (!soloEligible().length) { soloOpForPhase(); return; }
      render(); maybeAI(); return;
    }
    if (eligible('B').length) { render(); maybeAI(); return; }
    rallyPhase();
  }

  function beginTurn() {
    if (state.solo) { soloBeginTurn(); return; }
    state.turn += 1;
    state.units.forEach(function (u) {
      u.activated = false; u.marked = false; u.markMoved = false; u.shotFrom = []; u.coordUsed = false;
      u.hackUsed = false; u.hacked = false; u.supportUsed = false; u.advancing = false;
      u.disembarked = false;
    });
    state.chain = null;
    state.mark = null;
    var a, b;
    do { a = R.d10(); b = R.d10(); } while (a === b);
    state.initiative = a > b ? 'A' : 'B';
    state.activeSide = state.initiative;
    state.streak = streakFor(state.activeSide);
    logLine('turn', 'Turn ' + state.turn + ' — initiative to ' + sideName(state.initiative) + ' (D10 ' + a + ' vs ' + b + ').');
    pushRes({
      kind: 'Initiative', title: 'Turn ' + state.turn,
      dice: [{ label: 'A', value: a, tone: a > b ? 'crit' : '' }, { label: 'B', value: b, tone: b > a ? 'crit' : '' }],
      outcome: { text: sideName(state.initiative) + ' activates first.', tone: 'good' }
    });
    ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.vis = null; ui.visKey = ''; ui.preview = null;
    beginningRites();
    render();
    revealBoard();
    whenIdle(function () {
      reservePhase(function () {
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
      var res = R.shoot(state, u, friend, 'fire', {});
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

  function streakFor(side) {
    var mine = unbroken(side), theirs = unbroken(other(side));
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
        if (R.inches(u.x, u.y, state.chain.x, state.chain.y) > 12) return false;
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
    if (state.over) { render(); return; }

    // a Command Unit riding in a Command Vehicle may coordinate once the hull has acted
    var just = ui.lastActed;
    if (just && just.alive && R.has(just, 'Command Vehicle') && !state.chain) {
      var cmd = R.commandAboard(just);
      if (cmd && !cmd.coordUsed && R.status(cmd) !== 'broken') {
        cmd.coordUsed = true;
        state.chain = {
          side: just.side, remaining: R.ruleValue(just, 'Command Unit') + 1,
          x: just.x, y: just.y, tier: cmd.tier
        };
        logLine('note', cmd.label + ', riding in ' + just.name + ', coordinates: up to ' +
          R.ruleValue(just, 'Command Unit') + ' friendly units within 12" activate in a row.');
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
    if (state.solo) { soloNext(); return; }
    if (state.chain && state.chain.side === state.activeSide) {
      state.chain.remaining -= 1;
      if (state.chain.remaining > 0 && eligible(state.activeSide).length > 0) { render(); maybeAI(); return; }
      if (state.chain.kind === 'mark') clearMark();
      state.chain = null;
      state.streak -= 1;
    } else {
      state.streak -= 1;
    }

    if (state.streak > 0 && eligible(state.activeSide).length > 0) { render(); maybeAI(); return; }

    var next = other(state.activeSide);
    if (eligible(next).length > 0) { state.activeSide = next; state.streak = streakFor(next); }
    else if (eligible(state.activeSide).length > 0) { state.streak = streakFor(state.activeSide); }
    else { rallyPhase(); return; }
    render();
    maybeAI();
  }

  // The rally phase is walked unit by unit: roll, show the card, wait for Continue.
  function rallyPhase() {
    logLine('phase', 'Rally phase.');
    // Psychic Amplifier (a tribe aircraft upgrade, p. 143): friendly infantry within 6" shed a point
    state.units.forEach(function (c) {
      if (!onTable(c) || c.cls !== 'aircraft' || !R.campFlag(c, 'psychicAmp')) return;
      var calm = activeUnits(c.side).filter(function (f) { return f.cls === 'infantry' && f.sp > 0 && R.unitDist(f, c) <= 6; });
      calm.forEach(function (f) { f.sp -= 1; });
      if (calm.length) logLine('rally', 'Psychic Amplifier — ' + c.label + ' steadies ' + calm.map(function (f) { return f.label; }).join(', ') + ': 1 SP each.');
    });
    /* Strong Nervous System (p. 124): once a battle, every Suppression point on
       every bug is wiped away. It is spent the first time a real share of the
       swarm is pinned down — two units or a third of it, whichever is more. */
    ['A', 'B'].forEach(function (side) {
      var docs = (state.doctrines && state.doctrines[side]) || [];
      state.nervous = state.nervous || {};
      if (docs.indexOf('BP3') < 0 || state.nervous[side]) return;
      var mine = state.units.filter(function (u) { return u.side === side && onTable(u) && !R.isMachine(u); });
      var pinned = mine.filter(function (u) { return u.sp > 0 && R.status(u) !== 'ready'; });
      if (pinned.length < Math.max(2, Math.ceil(mine.length / 3))) return;
      state.nervous[side] = true;
      var cleared = mine.filter(function (u) { return u.sp > 0; });
      cleared.forEach(function (u) { u.sp = 0; });
      logLine('rally', 'Strong Nervous System — the hive-mind steadies ' + sideName(side) + ': every Suppression point on ' +
        cleared.length + ' units is gone.');
      pushRes({ kind: 'Rally', title: 'Strong Nervous System', side: side,
        note: 'Once a battle, in the Rally phase, the swarm sheds all its Suppression.',
        outcome: { text: cleared.length + ' units steady at once.', tone: 'good' } });
    });
    // Evacuation: everyone inside the safe zone is rallied without a roll (p. 154)
    if (state.scen.rallyFree) {
      state.units.forEach(function (u) {
        if (!onTable(u) || R.isMachine(u) || !u.sp || !state.scen.rallyFree(state, u)) return;
        u.sp = 0;
        logLine('rally', u.label + ' is inside the safe zone and rallies completely.');
      });
    }
    var list = state.units.filter(function (u) {
      return u.alive && !u.aboard && u.x >= 0 && (R.isMachine(u) ? u.damage > 0 : u.sp > 0);
    });
    rallyNext(list, 0);
  }

  function rallyNext(list, i) {
    if (i >= list.length) { endPhase(); return; }
    var u = list[i];
    if (!u.alive) { rallyNext(list, i + 1); return; }
    if (R.isMachine(u)) {
      var rep = R.repair(state, u);
      if (!rep) { rallyNext(list, i + 1); return; }
      logLine('rally', rep.text);
      var card = repairCard(u, rep);
      card.progress = 'Unit ' + (i + 1) + ' of ' + list.length;
      card.onShow = function () { ui.selected = u; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; focusUnit(u, false, true); render(); };
      card.onClose = function () { rallyNext(list, i + 1); };
      pushRes(card);
      render();
      return;
    }
    if (u.sp === 0) { rallyNext(list, i + 1); return; }
    var r = R.rally(state, u);
    if (!r) { rallyNext(list, i + 1); return; }
    logLine('rally', r.text);
    if (SFX && r.gone) SFX.broken();
    pushRes(rallyCard(u, r, i + 1, list.length, function () { rallyNext(list, i + 1); }));
    render();
  }

  function rallyCard(u, r, n, total, done) {
    var outcome;
    if (r.gone) {
      outcome = { text: u.name + ' flees the field — suppression over three times Morale.', tone: 'bad' };
    } else if (r.statusBefore !== r.statusAfter) {
      outcome = r.statusAfter === 'ready'
        ? { text: u.name + ' steadies — no longer ' + r.statusBefore + '.', tone: 'good' }
        : { text: u.name + ' is now ' + r.statusAfter + '.', tone: 'warn' };
    } else if (r.after === 0) {
      outcome = { text: 'All suppression shaken off.', tone: 'good' };
    } else {
      outcome = {
        text: 'Still ' + r.statusAfter + ' — ' + r.after + ' SP against Morale ' + r.morale + '.',
        tone: r.statusAfter === 'broken' ? 'bad' : r.statusAfter === 'suppressed' ? 'warn' : ''
      };
    }
    return {
      kind: 'Rally', side: u.side,
      title: u.name + ' [' + u.side + ']',
      note: 'Morale ' + r.morale + ' — roll ' + r.morale + 'D6, each 4+ clears 1 SP' +
        (r.reroll ? '. Inspiring Presence re-rolls the failures.' : '.'),
      dice: r.dice.map(function (d) {
        return { label: d.second ? d.first + '→' : 'D6', value: d.value, tone: d.ok ? 'crit' : 'fail' };
      }),
      calc: 'Suppression ' + r.before + ' SP · ' + r.removed + ' success' + (r.removed === 1 ? '' : 'es') +
        ' → ' + r.after + ' SP',
      outcome: outcome,
      progress: 'Unit ' + n + ' of ' + total,
      onShow: function () {
        ui.selected = u.alive ? u : null;
        ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
        focusUnit(u, false, true);
        render();
      },
      onClose: done
    };
  }

  function repairCard(u, rep) {
    if (!rep) {
      return {
        kind: 'Repair', title: u.name + ' [' + u.side + ']', side: u.side,
        note: 'Nothing to repair.', outcome: { text: 'The hull is sound.', tone: 'good' }
      };
    }
    return {
      kind: 'Repair', side: u.side, title: u.name + ' [' + u.side + ']',
      note: 'Structure ' + u.str + ', ' + rep.before + ' damage — roll ' + rep.dice +
        'D6, each ' + rep.need + '+ clearing a point' + (rep.need === 5 ? ' (Jammers).' : '.'),
      dice: rep.rolls.map(function (d) { return { label: 'D6', value: d.value, tone: d.ok ? 'crit' : 'fail' }; }),
      calc: 'Damage ' + rep.before + ' · ' + rep.fixed + ' repaired → ' + rep.after,
      outcome: rep.after === 0
        ? { text: 'Fully repaired.', tone: 'good' }
        : { text: rep.after + ' damage still on the hull, against Structure ' + u.str + '.', tone: 'warn' }
    };
  }

  function endPhase() {
    state.units.forEach(function (u) {
      if (!onTable(u) || R.status(u) !== 'broken') return;
      var awayFrom = { x: u.side === 'A' ? W + 5 : -5, y: u.y };
      /* A solitaire game has no "own lines": broken units fall back away from
         the enemy — or, in the Evacuation, run for the safe zone, and in
         Protecting the VIP, back towards the evacuation point. */
      var to = state.solo && state.scen.fallTo ? state.scen.fallTo(state, u) : null;
      if (state.solo && !to && u.side === 'B') {
        var nearP = nearestEnemy(u);
        to = nearP ? { x: u.x + (u.x - nearP.unit.x) * 3, y: u.y + (u.y - nearP.unit.y) * 3 } : null;
      }
      if (to) awayFrom = { x: u.x - (to.x - u.x), y: u.y - (to.y - u.y) };
      if (to && to.flee === undefined && to.limit == null && R.inches(u.x, u.y, to.x, to.y) < 0.5) return;
      var was = { x: u.x, y: u.y };
      if (R.fallBack(state, u, awayFrom, 4)) {
        if (to && to.limit != null && R.inches(u.x, u.y, to.x, to.y) > to.limit) { u.x = was.x; u.y = was.y; return; }
        logLine('note', u.label + ' is broken and falls back' + (to && to.flee ? ' towards the safe zone.' : state.solo ? '.' : ' toward its own lines.'));
        soloAfterMove(u);
      }
    });

    /* Endless Tide (p. 116): an unbroken swarm near an unsuppressed Overmind
       digs D3 lost bugs back out of the ground. */
    var tide = R.endlessTide(state);
    if (tide.length) {
      tide.forEach(function (l) { logLine('rally', l.text); });
      if (SFX) SFX.chitter();
      pushRes({ kind: 'Endless Tide', title: 'The swarm replenishes', side: tide[0].unit.side,
        list: tide.map(function (l) { return { text: l.text, side: l.unit.side }; }) });
    }

    scoreObjectives();
    state.routed.A = SC.routed(state, 'A');
    state.routed.B = SC.routed(state, 'B');
    var res = SC.check(state);
    if (res) {
      // the scenario names the sides A and B; give them the companies' own names
      var text = res.text.replace(/\bA\b/g, sideName('A')).replace(/\bB\b/g, sideName('B'));
      finish(res.winner, text);
    }
    if (state.over) { render(); return; }
    beginTurn();
  }

  function objDist(u, o) { return Math.max(0, R.inches(u.x, u.y, o.x, o.y) - UR); }

  function scoreObjectives() {
    state.objectives.forEach(function (o) {
      var claim = { A: 0, B: 0 };
      state.units.forEach(function (u) {
        if (!onTable(u) || R.status(u) !== 'ready' || R.isFlying(u)) return;   // aircraft cannot hold ground
        if (objDist(u, o) <= 4) claim[u.side]++;
      });
      o.owner = claim.A > 0 && claim.B === 0 ? 'A' : (claim.B > 0 && claim.A === 0 ? 'B' : null);
    });
  }

  /* What the campaign needs back from a battle: one line per unit that took the
     field, with who it broke and what it cost. Built once, when the game ends. */
  function battleReport(winner) {
    state.units.forEach(function (u) { R.syncMen(u, state.turn, state.namesTaken); });
    var byId = {};
    state.units.forEach(function (u) { byId[u.rid || u.id] = u; });
    var lines = {};
    state.units.forEach(function (u) {
      lines[u.rid || u.id] = {
        rid: u.rid || u.id, side: u.side, key: u.key, tier: u.tier,
        startSize: u.startSize != null ? u.startSize : u.size,
        /* The men still standing when it ended, which is not the same as the men
           still on the table: a unit that scattered and ran took its survivors
           with it, and only its actual casualties count against it. */
        endSize: R.isMachine(u) ? (u.alive ? 1 : 0) : u.models,
        destroyed: !u.alive && R.isMachine(u),
        catastrophic: !!u.catastrophic,
        brokenEver: !!u.brokenEver,
        /* Wiped out means every soldier was killed (p. 85) — that, and only that,
           takes a unit off the dossier. A unit that scattered and ran, or that
           Expendable removed from play, still has men left and comes back. */
        wiped: !R.isMachine(u) && u.models <= 0,
        fled: !!u.fled,
        aboardDowned: !!u.lostAboard,
        lostAboard: u.lostAboard || null,
        drugged: !!u.drugged,            // Drug Dealer: the comedown comes after
        // the swarm's own bookkeeping (p. 124): its low point, and what it ate
        minSize: R.isMachine(u) ? null : (u.minModels != null ? Math.min(u.minModels, u.models) : u.models),
        assaultKills: u.assaultKills || 0, assaultKillsHuman: u.assaultKillsHuman || 0,
        // the men who carry on, by name, for the dossier to keep
        men: R.survivors(u),
        kills: []
      };
    });
    // one credit per enemy unit: whoever broke it, or failing that whoever killed it
    state.units.forEach(function (u) {
      var who = u.brokeBy || (u.wipedOut ? u.killedBy : null);
      if (!who) return;
      var owner = byId[who];
      if (!owner || owner.side === u.side) return;          // no credit for friendly fire
      var line = lines[who];
      if (line) line.kills.push({ tier: u.tier, broken: !!u.brokenEver, key: u.key });
    });
    return {
      winner: winner, battleTier: state.cfg.tier, pl: state.cfg.pl,
      scenario: state.cfg.scenario || 'secure',
      // a tribe's payment reads whether this was an attacker-defender fight (p. 140)
      attackDefend: !!(state.sc && state.sc.attacker),
      routed: { A: state.routed.A, B: state.routed.B },
      turns: state.turn,
      units: Object.keys(lines).map(function (k) { return lines[k]; }),
      casualties: casualtyList()
    };
  }

  /* The casualty list: every named soldier lost, by name, rank and the kind of
     unit they served in, side by side, in the order they were lost. A bug unit
     has one line instead, with the count of what it lost. */
  function casualtyList() {
    var out = [];
    state.units.forEach(function (u) {
      var p = R.profile(u.key);
      /* The swarm and the Esh-Aven have no names: such a unit reports how many
         it lost, and a bug unit what that was worth in biomass. */
      if (R.counted(u)) {
        if (u.lostModels) {
          var line = { side: u.side, count: u.lostModels, type: (p && p.name) || u.name, unit: u.name, rid: u.rid || u.id, turn: 0 };
          if (u.faction === 'bugs') { line.swarm = true; line.mass = u.lostModels * R.biomassOf(p); }
          else line.anon = true;
          out.push(line);
        }
        return;
      }
      (u.men || []).forEach(function (m) {
        if (m.lost == null) return;
        out.push({
          side: u.side, name: m.name, rank: m.rank, turn: m.lost,
          type: (p && p.name) || u.name, unit: u.name, rid: u.rid || u.id
        });
      });
    });
    out.sort(function (a, b) { return a.side < b.side ? -1 : a.side > b.side ? 1 : a.turn - b.turn; });
    return out;
  }

  function finish(winner, text) {
    state.over = { winner: winner, text: text };
    state.report = battleReport(winner);
    logLine('turn', text);
    // a campaign battle hands its report back to the dossier
    if (state.cfg.campaign) V.finished(state.report);
    pushRes({ kind: 'Result', title: winner ? sideName(winner) + ' wins' : 'Draw', outcome: { text: text, tone: 'good' } });
  }

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
      out.push({ id: 'embark', label: 'Embark' });
      out.push({ id: 'disembark', label: 'Disembark' });
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
    if (u && R.campFlag(u, 'vortex')) out.push({ id: 'vortex', label: 'Time Vortex' });
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
      var mid = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      return R.inches(u.x, u.y, mid.x, mid.y) - Math.max(r.w, r.h) / 2 <= u.move + 2;
    });
  }

  function actionState(u, id) {
    if (!u) return { on: false, hint: 'Select one of your units on the table.' };
    if (u.supportUsed && ['embark', 'disembark', 'regroup'].indexOf(id) < 0) {
      return { on: false, hint: 'Supporting Fire given — load or unload, or pass.' };
    }
    if (isAI(u.side)) return { on: false, hint: u.label + ' is under OpFor control.' };
    if (u.side !== state.activeSide) return { on: false, hint: state.solo ? 'The OpFor is acting.' : 'It is ' + sideName(state.activeSide) + '’s activation.' };
    if (u.activated) return { on: false, hint: u.name + ' has already acted this turn.' };
    /* An Advance is one action: the move, then the shot (p. 27). Half-way
       through it, Fire!, Assault, another move — none of them is on; the unit
       shoots without the Fire! bonus, or holds its fire. */
    if (u.advancing) {
      return id === 'advance'
        ? { on: true, hint: 'Advancing: it has moved. Pick a target to shoot, without the Fire! bonus — or press Advance again to hold its fire.' }
        : { on: false, hint: 'Advancing: it has already moved, so all that is left of this activation is the Advance shot, or holding its fire.' };
    }
    if (state.solo && state.solo.coop && (u.owner || 1) !== state.activeOwner) {
      return { on: false, hint: 'That is ' + soloOwnerName(u.owner || 1) + '’s unit — it is ' + soloOwnerName(state.activeOwner) + '’s turn to activate.' };
    }
    var st = R.status(u), sup = st === 'suppressed';
    var machine = R.isMachine(u), bonus = moveBonus(u);
    /* Aggressive (p. 116): with no Overmind within 18" to hold it back, a bug
       that can reach an enemy must charge the closest one — nothing else. */
    var fc = forcedCharge(u);
    if (fc && id !== 'assault') {
      if (R.campFlag(u, 'bloodlust')) return { on: false, hint: 'Bloodlust: ' + u.name + ' must charge the closest enemy it can reach, ' + fc.name + '.' };
      return { on: false, hint: 'Aggressive: ' + u.name + ' must charge the closest enemy, ' + fc.name +
        ' — no Overmind within ' + R.overmindReach(state, u.side) + '" to hold it back.' };
    }

    /* A unit inside a building "may only exit it or make actions which do not
       require any movement (so it cannot Move, Advance, Assault, etc.)" (p. 41). */
    if (u.bld && ['move', 'advance', 'wave', 'vortex', 'rush'].indexOf(id) >= 0) {
      return { on: false, hint: 'Inside a building — only actions that need no movement. Exit the building first.' };
    }

    switch (id) {
      case 'enter': {
        var ents = R.enterTargets(state, u);
        if (!ents.length) return { on: false, hint: u.bld ? 'No empty section in contact with this one.' : 'No empty building within 4".' };
        return { on: true, hint: u.bld
          ? 'Move through to an empty section of the building in contact with this one. Counts as the action.'
          : 'Go into an empty building within 4" — one unit to a building. Inside: +2 Defence, no Crossfire, range measured from the wall' +
            ' — but no moving until you come out.' };
      }
      case 'exitbld': {
        var outs = R.exitSpots(state, u);
        return outs.length ? { on: true, hint: 'Come out and be placed within 4" of the building. Counts as the action.' }
          : { on: false, hint: 'There is no clear ground within 4" of the building to come out onto.' };
      }
      case 'move':
        if (R.has(u, 'Immobile')) {
          return { on: false, hint: 'A Rapid insertion platform came down where it came down. It may only put its troops out (p. 79).' };
        }
        if (R.has(u, 'Stationary Artillery')) {
          return { on: false, hint: 'Stationary Artillery: the piece is emplaced and does not move. A transport may tow it.' };
        }
        if (R.has(u, 'Turret')) return { on: false, hint: 'A turret is a stationary ground vehicle: it stays where it was teleported in.' };
        if (machine) return { on: true, hint: 'Drive up to Movement +4" — ' + (u.move + 4) + '". The hull ends up facing the way it travelled.' };
        return sup
          ? { on: true, hint: 'Suppressed: may only move into cover or out of sight, up to ' + (u.move + 2) + '".' }
          : { on: true, hint: 'Move up to Movement +2" — ' + (u.move + 2) + '". Ends the activation.' };
      case 'fire': {
        if (sup) return { on: false, hint: 'Suppressed units may only fire auxiliary weapons.' };
        if (u.fp === null) return { on: false, hint: 'This unit has no Firepower.' };
        var t = targetsFor(u, {});
        return t.length
          ? { on: true, hint: 'Stand and shoot: +1 to the firing roll, +2 inside ' + (u.range / 2) + '". ' + t.length + ' target' + (t.length > 1 ? 's' : '') + ' in range.' }
          : { on: false, hint: 'No enemy within ' + u.range + '" and line of sight.' };
      }
      case 'advance': {
        if (R.campFlag(u, 'noAdvance')) return { on: false, hint: 'Uncoordinated: this unit cannot Advance.' };
        if (sup) return { on: false, hint: 'Suppressed units cannot Advance.' };
        if (R.has(u, 'Stationary Artillery')) return { on: false, hint: 'Stationary Artillery: the piece does not move, so it cannot Advance.' };
        if (R.has(u, 'Turret')) return { on: false, hint: 'A turret does not move, so it cannot Advance.' };
        if (R.has(u, 'Cumbersome Weapon')) return { on: false, hint: 'Cumbersome Weapon: may not Advance.' };
        if (u.fp === null) return { on: false, hint: 'This unit has no Firepower.' };
        return { on: true, hint: 'Move up to ' + u.move + '", then shoot without the Fire! bonus.' };
      }
      case 'assault': {
        if (machine && !R.isOvergrown(u)) return { on: false, hint: 'Vehicles and aircraft never charge.' };
        if (fc) return { on: true, hint: R.campFlag(u, 'bloodlust')
          ? 'Bloodlust: ' + u.name + ' charges the closest enemy it can reach — ' + fc.name + '.'
          : 'Aggressive: no Overmind near, so ' + u.name + ' charges the closest enemy — ' + fc.name + '.' };
        // "Death or Glory, Comrades!" (p. 94) shakes a suppressed unit into the charge
        var dog = R.deathOrGlory(state, u);
        if (sup && !dog) return { on: false, hint: 'Suppressed units cannot charge.' };
        if (R.has(u, 'Cumbersome Weapon')) return { on: false, hint: 'Cumbersome Weapon: may not Assault.' };
        var reachA = u.move + moveBonus(u, 'assault') - 2;
        var near = assaultables(u, reachA);
        if (u.bld && !near.length) return { on: false, hint: 'Inside a building — the only charge is at an enemy in a section next to this one.' };
        if (!near.length) return { on: false, hint: 'No enemy within charge reach of ' + reachA + '".' };
        return { on: true, hint: dog
          ? '"Death or Glory, Comrades!" — ' + dog.name + ' is shouting: charge within ' + reachA +
            '" and every Suppression point falls away as you go in.'
          : 'Charge within ' + reachA + '": defensive fire, then three rounds each way.' };
      }
      case 'aux': {
        if (u.fp === null) return { on: false, hint: 'This unit has no Firepower.' };
        var ta = targetsFor(u, { aux: true });
        if (!ta.length) return { on: false, hint: 'Auxiliary weapons reach 12" — nothing in range.' };
        return { on: true, hint: 'Auxiliary weapons: FP 1, Range 12", no special rules. The only shot a suppressed unit may take.' };
      }
      case 'regroup':
        if (machine) {
          return u.damage
            ? { on: true, hint: 'Stand down and patch up: ' + Math.max(1, u.str - u.damage) + 'D6, each 4+ clearing a damage point.' }
            : { on: true, hint: 'Nothing to repair — this only passes the activation.' };
        }
        return { on: true, hint: 'Pass and regroup: an immediate bonus Rally roll of ' + R.currentMorale(u) + 'D6, each 4+ clearing 1 SP.' };
      case 'embark': {
        if (!u.transport) return { on: false, hint: 'This unit carries no troops.' };
        if (R.has(u, 'Immobile')) {
          return { on: false, hint: 'A Rapid insertion platform is a one-way ride: it only puts troops out (p. 79).' };
        }
        var room = u.transport - (u.cargo || []).length;
        if (room <= 0) return { on: false, hint: 'Full — carrying ' + u.cargo.length + ' of ' + u.transport + '.' };
        var ready = activeUnits(u.side).filter(function (t2) { return R.canEmbark(state, u, t2); });
        return ready.length
          ? { on: true, hint: 'Pick up a squad within 4". Room for ' + room + '. They lose their suppression on boarding.' }
          : { on: false, hint: 'No steady squad within 4" to pick up.' };
      }
      case 'disembark': {
        if (!(u.cargo || []).length) return { on: false, hint: 'Nobody aboard.' };
        return { on: true, hint: 'Put the troops down within 4" of the hull. They may act again next turn.' };
      }
      case 'strafe': {
        if (u.cls !== 'aircraft') return { on: false, hint: 'Only aircraft may strafe.' };
        return { on: true, hint: 'Strafing run: fly up to ' + u.move + '" and fire at every enemy passed over. They may fire back.' };
      }
      case 'designate':
      case 'marktarget': {
        if (sup) return { on: false, hint: 'Suppressed units cannot use their markers.' };
        var mkKind = id === 'marktarget' ? 'mark' : 'designate';
        var smoke = !R.has(u, 'Markerlights') && R.has(u, 'Smoke Markers');
        var td = markTargets(u);
        if (!td.length) return { on: false, hint: 'Nothing within ' + markReach(u) + '" and sight to mark.' };
        if (!markAnswerable(u, mkKind)) {
          return { on: false, hint: mkKind === 'designate'
            ? 'No Indirect Fire unit left that could reach it.'
            : 'No unit left that can see it and reach it.' };
        }
        if (smoke) {
          return { on: true, hint: 'Smoke Markers: a grenade and a flare on an enemy within 12". ' +
            'Two Indirect Fire units shoot at it there and then, without needing sight — and this unit may move first (p. 94).' };
        }
        return { on: true, hint: mkKind === 'designate'
          ? 'Designate target: an enemy within 24" and in sight. Indirect Fire units shoot it at once, no sight needed. ' +
            'Stand still for two of them, or move up to ' + u.move + '" first and get one.'
          : 'Mark the target: an enemy within 24" and in sight. A unit that can see it fires at once, as though at half range. ' +
            'Stand still for two of them, or move up to ' + u.move + '" first and get one.' };
      }
      case 'support': {
        if (u.supportUsed) return { on: false, hint: 'Supporting Fire already given — now load or unload.' };
        var sf = targetsFor(u, {});
        return sf.length
          ? { on: true, hint: 'Supporting Fire: shoot without the Fire! bonus, then load or unload troops.' }
          : { on: false, hint: 'Nothing in range to support against.' };
      }
      case 'steady': {
        var stT = R.steadyTargets(state, u);
        return stT.length
          ? { on: true, hint: 'NOT ONE STEP BACKWARDS! Shoot at a friendly unit carrying Suppression: it is resolved as normal — a Man down! still kills — but every Suppression point it would give is taken away instead.' }
          : { on: false, hint: 'No suppressed friend within range and sight.' };
      }
      case 'hack': {
        if (sup) return { on: false, hint: 'Suppressed units cannot hack.' };
        if (u.hackUsed) return { on: false, hint: 'Already hacked this turn.' };
        var dr = state.units.filter(function (t2) { return R.canHack(state, u, t2); });
        return dr.length
          ? { on: true, hint: 'Hack an enemy drone within 24": D6 — 3-4 locks it out and burns it, 5-6 turns it on its own side first.' }
          : { on: false, hint: 'No enemy drone within 24".' };
      }
      case 'demolish': {
        if (sup) return { on: false, hint: 'Suppressed units cannot take aim at a wall.' };
        var dt = demolishTargets(u, false);
        return dt.length
          ? { on: true, hint: 'Bring a wall or building down: a final 15+, or an unmodified 9.' }
          : { on: false, hint: 'Nothing destructible in range and sight.' };
      }
      case 'breach': {
        if (sup) return { on: false, hint: 'Suppressed units cannot set charges.' };
        if (R.has(u, 'Cumbersome Weapon')) return { on: false, hint: 'Cumbersome Weapon: may not Assault.' };
        var bt = breachTargets(u);
        if (!bt.length) {
          return { on: false, hint: R.has(u, 'Sappers')
            ? 'Nothing destructible within reach.'
            : 'Only Sappers may demolish anything but the scenario objective.' };
        }
        return { on: true, hint: R.has(u, 'Sappers')
          ? 'Sappers: charge a wall or building with demolition charges, +4 — 15+, or an unmodified 9. A failure falls back 2".'
          : 'Demolish the objective: charges by hand at +2, where Sappers would get +4 — 15+, or an unmodified 9. A failure falls back 2".' };
      }
      case 'sabotage': {
        var tg = state.scen.sabotageSpots ? state.scen.sabotageSpots(state, u) : [];
        if (!tg.length) return { on: false, hint: 'No objective within 1".' };
        return { on: true, hint: 'Destroy the objective: a special action, and the unit does nothing else this activation (p. 155).' };
      }
      case 'checkarea': {
        if (sup) return { on: false, hint: 'Suppressed units cannot search.' };
        var sp = SC.searchSpots(state, u);
        if (!sp.length) return { on: false, hint: 'Nothing to search within 4".' };
        var order = state.sc.order;
        var need = order === 0 ? '5+' : order === 1 ? '4+' : 'automatically';
        return { on: true, hint: 'Check the area! — D6, and the ' +
          (order === 0 ? 'first' : order === 1 ? 'second' : 'third') + ' location gives it up on ' + need + '.' };
      }
      case 'detonate': {
        var mine = minedFor(u);
        if (!mine) return { on: false, hint: 'Nothing was mined, or this is not the unit that knows where.' };
        if (sup) return { on: false, hint: 'Suppressed units cannot work the detonator.' };
        return { on: true, hint: 'Terrorist: set off the charge under the ' +
          R.TERRAIN[mine.piece.kind].name.toLowerCase() + ' — a shooting attack at Firepower 10 ' +
          'with the Destructive Weapon rule, wherever it is on the table.' };
      }
      case 'stance': {
        if (!R.has(u, 'Stationary Artillery')) return { on: false, hint: 'Only an emplaced gun changes stance.' };
        return u.dugIn
          ? { on: true, hint: 'Normal stance!: back to indirect fire — Range ' + u.range +
              '", minimum ' + (R.ruleValue(u, 'Minimum Range') || 0) + '", all round, on Basic Firepower.' }
          : { on: true, hint: 'Dig in!: lay the piece over open sights — Range 24", minimum 6", front quarter only, ' +
              'but it shoots with every modifier instead of Basic Firepower.' };
      }
      case 'wave': {
        if (sup) return { on: false, hint: 'Suppressed units cannot send out a Psychic Wave.' };
        return { on: true, hint: 'Psychic Wave: move up to ' + u.move + '" (or stay), then every enemy within 12" — no sight needed, Drones excepted — takes D6−1 Suppression.' };
      }
      case 'regain': {
        if (sup) return { on: false, hint: 'Suppressed units cannot reach out to the Esh-Aven.' };
        var rg = R.regainTargets(state, u);
        return rg.length
          ? { on: true, hint: 'Regain Control: stay put, and ' + rg.length + ' shaken Epsilon squad' + (rg.length > 1 ? 's' : '') +
              ' of Tier ' + R.ROMAN[u.tier] + ' or lower within 12" shed' + (rg.length > 1 ? '' : 's') + ' every Suppression point.' }
          : { on: false, hint: 'Regain Control: no shaken Epsilon squad of Tier ' + R.ROMAN[u.tier] + ' or lower within 12".' };
      }
      case 'selfrepair': {
        if (!u.damage) return { on: false, hint: 'Molecular Reconstruction: nothing to rebuild.' };
        return { on: true, hint: 'Self-repair: stay where it is and clear all ' + u.damage + ' Damage point' + (u.damage > 1 ? 's' : '') + '.' };
      }
      case 'vortex': {
        if (spent(u, 'vortex')) return { on: false, hint: 'Time Vortex Generator: already used this battle.' };
        return { on: true, hint: 'Time Vortex Generator: a Move at double Movement — ' + 2 * (u.move + moveBonus(u)) + '". Once a battle.' };
      }
      case 'teleport': {
        var tpads = R.teleportPads(state, u.side);
        var tpax = R.teleportFrom(state, u);
        if (!tpax.length) return { on: false, hint: 'Teleport: no steady infantry unit within 4" that has still to act.' };
        return { on: true, hint: 'Teleport: take in an infantry unit within 4". D6 — 1-2 it comes out at a random Teleport unit, 3-6 at the one you pick (' +
          tpads.length + ' on the table). It may still act this turn.' };
      }
      case 'rush': {
        if (spent(u, 'adrenaline')) return { on: false, hint: 'Adrenaline Rush: already used this battle.' };
        return { on: true, hint: 'Adrenaline Rush: act now, then act again straight away. Once a battle.' };
      }
      case 'laststand': {
        if (spent(u, 'lastStand')) return { on: false, hint: 'Last Stand: already used this battle.' };
        if (!u.sp) return { on: false, hint: 'Nothing to shake off.' };
        return { on: true, hint: 'Last Stand: shed all ' + u.sp + ' Suppression at once. Once a battle, and it ends the activation.' };
      }
      case 'coordinate': {
        if (sup) return { on: false, hint: 'Suppressed units cannot coordinate.' };
        if (u.coordUsed) return { on: false, hint: 'Already coordinated this turn.' };
        return { on: true, hint: 'Command Unit: stay put and activate up to ' + R.ruleValue(u, 'Command Unit') + ' friendly units within 12" in a row.' };
      }
    }
    return { on: false, hint: '' };
  }

  function chooseAction(id) {
    var u = ui.selected; if (!u) return;
    if (u.advancing) {
      if (id !== 'advance') return;
      if (ui.mode === 'advance-fire') { holdFire(u); return; }     // pressed again: it holds its fire
      ui.mode = 'advance-fire'; ui.moves = []; ui.terrain = [];
      ui.targets = targetsFor(u, {});
      render();
      return;
    }
    if (ui.mode === id || (ui.mode === 'advance-move' && id === 'advance')) {   // toggle off
      ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.preview = null; render(); return;
    }
    if (!actionState(u, id).on) return;
    var st = R.status(u);

    if (id === 'rush' || id === 'laststand') { doOnce(u, id); return; }
    if (id === 'checkarea') { doCheckArea(u); return; }
    if (id === 'sabotage') { doSabotage(u); return; }
    // Unreliable: a D6 before any action, and on a 1 the unit simply stands there
    if (R.campFlag(u, 'unreliable') && ['embark', 'disembark'].indexOf(id) < 0) {
      var ur = R.d6();
      if (ur === 1) {
        logLine('note', u.label + ' — Unreliable: D6 1, the order is not carried out.');
        pushRes({
          kind: 'Trauma', title: 'Unreliable', side: u.side,
          note: u.label + ' fails to move off. The action is wasted.',
          dice: [{ label: 'D6', value: ur }]
        });
        u.activated = true;
        endActivation(u);
        return;
      }
    }

    if (id === 'move') {
      ui.mode = 'move';
      ui.moves = R.reachable(state, u, u.move + moveBonus(u, 'move')).filter(function (c) { return canStand(u, c); });
      wireNote(u);
      if (st === 'suppressed') {
        ui.moves = ui.moves.filter(function (c) {
          if (R.TERRAIN[R.terrainAt(state, c.x, c.y)].cover > 0) return true;
          var ghost = { x: c.x, y: c.y, alive: true };
          return !state.units.some(function (e) { return e.alive && e.side !== u.side && R.hasLoS(state, e, ghost); });
        });
      }
    } else if (id === 'fire' || id === 'aux') {
      ui.mode = id === 'aux' ? 'aux' : 'fire';
      ui.targets = targetsFor(u, { aux: id === 'aux' });
    } else if (id === 'advance') {
      ui.mode = 'advance-move';
      ui.moves = R.reachable(state, u, u.move).filter(function (c) { return canStand(u, c); });
      wireNote(u);
    } else if (id === 'assault') {
      ui.mode = 'assault';
      var reach = u.move + moveBonus(u, 'assault') - 2;   // the charge bonus is +2 as standard
      var must = forcedCharge(u);
      ui.targets = must ? [must] : assaultables(u, reach + 2);
    } else if (id === 'wave') {
      ui.mode = 'wave';
      ui.moves = R.reachable(state, u, u.move).filter(function (c) { return canStand(u, c); });
      ui.moves.push({ x: u.x, y: u.y, cost: 0, spent: 0, turns: 0 });
    } else if (id === 'enter') {
      ui.mode = 'enter';
      ui.sections = R.enterTargets(state, u);
      setHint(null, u.bld ? 'Tap the section to move into.' : 'Tap the lit building to go in.');
    } else if (id === 'exitbld') {
      ui.mode = 'exitbld';
      ui.moves = R.exitSpots(state, u);
    } else if (id === 'embark') {
      ui.mode = 'embark';
      ui.targets = activeUnits(u.side).filter(function (t) { return R.canEmbark(state, u, t); });
    } else if (id === 'disembark') {
      ui.mode = 'disembark';
      ui.moves = R.reachable(state, u, 4).filter(function (c) { return R.inches(c.x, c.y, u.x, u.y) <= 4; });
      if (!ui.moves.length) ui.moves = [{ x: u.x, y: u.y, cost: 0 }];
    } else if (id === 'strafe') {
      ui.mode = 'strafe';
      ui.moves = R.reachable(state, u, u.move);
    } else if (id === 'demolish') {
      ui.mode = 'demolish';
      ui.terrain = demolishTargets(u, false);
    } else if (id === 'breach') {
      ui.mode = 'breach';
      ui.terrain = breachTargets(u);
    } else if (id === 'support') {
      ui.mode = 'support';
      ui.targets = targetsFor(u, {});
    } else if (id === 'steady') {
      ui.mode = 'steady';
      ui.targets = R.steadyTargets(state, u);
    } else if (id === 'hack') {
      ui.mode = 'hack';
      ui.targets = state.units.filter(function (t) { return R.canHack(state, u, t); });
    } else if (id === 'designate' || id === 'marktarget') {
      ui.mode = 'designate';
      ui.markKind = id === 'marktarget' ? 'mark' : 'designate';
      ui.markPicks = [];
      u.markMoved = false;
      ui.targets = markTargets(u);
      // "the unit may move up to its standard Movement range and designate" (p. 58)
      ui.moves = R.has(u, 'Stationary Artillery') ? [] : R.reachable(state, u, u.move);
      setHint(null, markHint(u));
    } else if (id === 'vortex') {
      u.camp.once.vortex = true; u.vortexNow = true;
      ui.mode = 'move';
      ui.moves = R.reachable(state, u, 2 * (u.move + moveBonus(u, 'move'))).filter(function (c) { return canStand(u, c); });
      logLine('note', u.label + ' — Time Vortex Generator: double Movement for this Move.');
    } else if (id === 'regain') {
      doRegain(u); return;
    } else if (id === 'selfrepair') {
      doSelfRepair(u); return;
    } else if (id === 'teleport') {
      ui.mode = 'teleport';
      ui.targets = R.teleportFrom(state, u);
      setHint(null, 'Teleport: tap the infantry unit to send.');
    } else if (id === 'detonate') {
      doDetonate(u); return;
    } else if (id === 'stance') {
      doStance(u); return;
    } else if (id === 'coordinate') {
      u.coordUsed = true; u.activated = true;
      state.chain = { side: u.side, remaining: R.ruleValue(u, 'Command Unit') + 1, x: u.x, y: u.y, tier: u.tier };
      logLine('note', u.label + ' coordinates: up to ' + R.ruleValue(u, 'Command Unit') + ' friendly units within 12" activate in a row.');
      endActivation(); return;
    } else if (id === 'regroup') {
      u.activated = true;
      closeDrawer();
      if (R.isMachine(u)) {
        var rep = R.repair(state, u);
        logLine('rally', rep ? rep.text : u.label + ' stands down — no damage to repair.');
        pushRes(repairCard(u, rep));
      } else {
        // Meditation (p. 142): a Xenotripod regrouping sheds two more points outright
        if (R.isXeno(u) && u.sp && R.doctrine(state, u.side, 'XT2')) {
          var med = Math.min(2, u.sp); u.sp -= med;
          logLine('rally', u.label + ' — Meditation: ' + med + ' SP gone before the dice.');
        }
        var r = R.rally(state, u);
        logLine('rally', r ? r.text : u.label + ' regroups — no suppression to shake off.');
        pushRes({
          kind: 'Regroup', title: u.name + ' regroups', side: u.side,
          list: [{ text: r ? r.text : 'No suppression to shake off.', side: u.side }]
        });
      }
      endActivation(); return;
    }
    render();
    if (ui.targets.length || ui.moves.length) revealConsole();
  }

  /* Adrenaline Rush and Last Stand: each once a battle, each spent from u.camp.once. */
  function doOnce(u, id) {
    u.camp.once[id === 'rush' ? 'adrenaline' : 'lastStand'] = true;
    if (id === 'laststand') {
      var was = u.sp;
      u.sp = 0;
      logLine('note', u.label + ' makes a Last Stand and shakes off all ' + was + ' SP.');
      pushRes({
        kind: 'Honour', title: 'Last Stand', side: u.side,
        note: u.label + ' steadies and throws off every point of suppression.',
        outcome: { text: was + ' SP cleared — the unit is ready again.', tone: 'good' }
      });
      u.activated = true;
      endActivation(u);
      return;
    }
    // a Rush buys one more activation in a row, on top of whatever the side has left
    state.streak = (state.streak || 1) + 1;
    logLine('note', u.label + ' — Adrenaline Rush: two actions in a row.');
    pushRes({
      kind: 'Honour', title: 'Adrenaline Rush', side: u.side,
      note: u.label + ' goes again the moment this action ends.',
      outcome: { text: 'One extra activation in a row.', tone: 'good' }
    });
    ui.mode = 'idle'; render();
  }

  /* Check the area! (p. 52): the first location gives the objective up on a 5+,
     the second on a 4+, and the third is where it was all along. */
  function doSabotage(u) {
    var t = (state.scen.sabotageSpots(state, u) || [])[0];
    if (!t) return;
    t.destroyed = true;
    u.activated = true;
    var left = state.sc.targets.filter(function (x) { return !x.destroyed; }).length;
    logLine('note', u.label + ' destroys an objective — ' + left + ' left.');
    addFx({ kind: 'collapse', x: t.x, y: t.y, r: 2.6, dur: 800, blocking: true });
    if (SFX) { SFX.impact(); SFX.impact(0.12); SFX.shell(0.05); }
    pushRes({ kind: 'Sabotage', title: u.name + ' blows an objective', side: u.side,
      outcome: { text: left ? left + ' objective' + (left === 1 ? '' : 's') + ' still standing.' : 'That was the last of them.', tone: 'good' } });
    render();
    endActivation(u);
  }

  function doCheckArea(u) {
    var spot = SC.searchSpots(state, u)[0];
    if (!spot) return;
    var res = SC.checkArea(state, u, spot);
    u.activated = true;
    logLine('note', u.label + ' checks the area — D6 ' + res.roll + ' on ' + res.need + '+: ' +
      (res.found ? 'this is the place.' : 'nothing here.'));
    pushRes({
      kind: 'Search', title: u.name + ' checks the area', side: u.side,
      note: 'The ' + (res.order === 1 ? 'first' : res.order === 2 ? 'second' : 'third') +
        ' location searched — it gives the objective up on a ' + res.need + '+.',
      dice: [{ label: 'D6', value: res.roll, tone: res.found ? 'crit' : 'fail' }],
      outcome: res.found
        ? { text: 'Found it. Hold this ground to the end.', tone: 'good' }
        : { text: 'Nothing here — one fewer place for it to be.', tone: 'warn' }
    });
    // the stake goes over at every searched location, and the beacon goes up at the real one
    if (state.structs) { paintStructures(); ui.vis = null; ui.visKey = ''; }
    render();
    endActivation(u);
  }

  function targetsFor(u, opts) {
    var out = activeUnits().filter(function (t) {
      return t.side !== u.side && R.canShoot(state, u, t, 'fire', opts);
    });
    /* A unit called up out of sequence by a Markerlight was activated to shoot
       the unit that was marked, and nothing else (p. 58). */
    var m = state.mark;
    if (m && state.chain && state.chain.kind === 'mark' && m.side === u.side &&
      m.targets.some(function (t) { return canAnswerMark(u, t, m.kind); })) {
      out = out.filter(function (t) { return m.targets.indexOf(t) >= 0; });
    }
    return out;
  }

  // a hull ends up pointing the way it drove
  function faceAlong(u, fromX, fromY, toX, toY) {
    if (!R.isMachine(u)) return;
    if (Math.hypot(toX - fromX, toY - fromY) < 0.2) return;
    u.facing = Math.atan2(toY - fromY, toX - fromX);
  }

  /* A Tier III-V hull knocks over any low or high wall it drives across (p. 35). */
  function crushAlong(u, path) {
    if (!path || path.length < 2) return;
    var log = [], wrecks = [];
    for (var i = 1; i < path.length; i++) {
      R.crushOnMove(state, u, path[i - 1], path[i], log).forEach(function (w) { wrecks.push(w); });
    }
    if (!wrecks.length) return;
    log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    whenIdle(function () { repaintTerrain(wrecks); });
  }

  /* Some scenarios answer a move: the Demolish objective's SAM system opens up on
     any aircraft that finishes within 12" of it (p. 54). */
  // Evacuation: a civilian group that reaches the safe-zone building is safe (p. 154)
  function soloAfterMove(u) {
    if (!state.scen.afterMove || !u) return;
    var r = state.scen.afterMove(state, u);
    if (!r) return;
    logLine('note', r.text);
    pushRes({ kind: 'Evacuation', title: u.name + ' is safe', side: u.side, list: [{ text: r.text }] });
  }

  function scenarioMoveEnd(u) {
    soloAfterMove(u);
    if (!state.scen.onMoveEnd) return;
    var res = state.scen.onMoveEnd(state, u);
    if (!res) return;
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    pushRes(fromLog('SAM system', 'The objective fires on ' + u.name,
      u.side === 'A' ? 'B' : 'A', res.log));
    render();
  }

  /* Aggressive (p. 116): the closest enemy this bug can charge, when it is not
     held back by an Overmind and one is in reach — or null when it is free. */
  function forcedCharge(u) {
    if (!state || !u) return null;
    /* Bloodlust (Battle Trauma, p. 89): the unit has to assault the closest enemy
       it can reach — Cumbersome Weapon or not. */
    var blood = R.campFlag(u, 'bloodlust') && !R.isMachine(u);
    if (!blood && !R.aggressiveNow(state, u)) return null;
    if (R.status(u) !== 'ready' || (!blood && R.has(u, 'Cumbersome Weapon'))) return null;
    if (R.has(u, 'Stationary Artillery') || R.has(u, 'Immobile')) return null;
    var reach = u.move + moveBonus(u, 'assault') - 2, best = null, bd = Infinity;
    activeUnits().forEach(function (e) {
      if (e.side === u.side || !R.canAssault(u, e)) return;
      var d = R.unitDist(u, e);
      if (d <= reach && d < bd) { bd = d; best = e; }
    });
    return best;
  }

  /* Psychic Wave (p. 116): move up to Movement, then every enemy within 12" —
     no line of sight, Drones excepted — takes D6-1 Suppression points. */
  function doWave(u, pt) {
    if (!u) return;
    var d = R.inches(u.x, u.y, pt.x, pt.y), wait = 0;
    if (d > 0.2) {
      var path = R.pathTo(state, u, u.move, pt);
      faceAlong(u, u.x, u.y, pt.x, pt.y);
      u.x = pt.x; u.y = pt.y; ui.vis = null; ui.visKey = '';
      crushAlong(u, path);
      animateMove(u, path, isAI(u.side));
      wait = Math.min(1400, 240 + d * 42);
      logLine('move', u.label + ' moves ' + d.toFixed(1) + '".');
      soloAfterMove(u);
    }
    u.activated = true;
    ui.mode = 'idle'; ui.moves = []; ui.targets = [];
    if (!u.alive || u.x < 0) { endActivation(u); return; }
    var res = R.psychicWave(state, u);
    res.log.forEach(function (l) { logLine(l.t === 'hits' ? 'suppressed' : 'note', l.text); });
    addFx({ kind: 'wave', x: u.x, y: u.y, up: V.flyLift(u), r: 12, delay: wait, dur: wait + 1300, blocking: true });
    var list = res.log.slice(1).map(function (l) { return { text: l.text, side: u.side }; });
    whenIdle(function () {
      if (!state) return;
      pushRes({ kind: 'Psychic Wave', title: u.name + ' — Psychic Wave', side: u.side,
        note: 'Every enemy within 12", no line of sight needed: D6−1 Suppression each.', list: list });
    });
    render();
    endActivation(u);
  }

  /* The AI's reading of a wave: the spot within Movement that catches the most
     enemies inside 12", and how many that is. */
  function bestWaveSpot(u) {
    var foes = state.units.filter(function (e) {
      return e.alive && !e.aboard && e.x >= 0 && !e.reserve && e.side !== u.side && !e.drone && !R.has(e, 'Drone Control');
    });
    if (!foes.length) return null;
    function count(c) { return foes.filter(function (e) { return R.inches(c.x, c.y, e.x, e.y) - 2 * UR <= 12; }).length; }
    var best = { x: u.x, y: u.y }, bn = count(best), bs = bn * 10 + R.TERRAIN[R.terrainOf(state, u)].cover;
    R.reachable(state, u, u.move).forEach(function (c) {
      if ((Math.round(c.x * 2) % 2) || (Math.round(c.y * 2) % 2) || !canStand(u, c)) return;
      var n = count(c), sc = n * 10 + R.TERRAIN[R.terrainAt(state, c.x, c.y)].cover - c.cost * 0.1;
      if (sc > bs) { bs = sc; bn = n; best = c; }
    });
    return { pt: best, n: bn };
  }

  // an Overgrown bug charging from the AI's hands, when something is in reach
  function aiCharge(u, t) {
    var snap = snapshotAlive();
    var res = R.assault(state, u, t);
    if (res.wreck) whenIdle(function () { repaintTerrain([res.wreck]); });
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    soundFor(res.log);
    var card = fromLog('Assault', u.name + ' → ' + t.name, u.side, res.log);
    playAssault(u, t, deathsSince(snap), function () { pushRes(card); });
    u.activated = true; endActivation(u);
  }

  // an Advance that moves and then does not shoot: the activation ends there
  function holdFire(u) {
    u.advancing = false;
    u.activated = true;
    logLine('note', u.label + ' holds its fire.');
    ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
    endActivation(u);
  }

  function doMove(pt) {
    var u = ui.selected;
    var d = R.inches(u.x, u.y, pt.x, pt.y);
    var allowance = ui.mode === 'advance-move' ? u.move : u.move + moveBonus(u);
    if (u.vortexNow) { allowance *= 2; u.vortexNow = false; }
    if (u.repairMove) { allowance = u.move; u.repairMove = false; }
    var path = R.pathTo(state, u, allowance, pt);
    faceAlong(u, u.x, u.y, pt.x, pt.y);
    flightTurn(u);
    u.x = pt.x; u.y = pt.y; ui.vis = null; ui.visKey = '';
    crushAlong(u, path);
    animateMove(u, path);
    if (ui.mode === 'advance-move') {
      /* Moved, and not yet shot: the unit is half-way through its Advance. It
         has used its move, so all that is left to it is the Advance's shot. */
      u.advancing = true;
      ui.mode = 'advance-fire'; ui.moves = [];
      ui.targets = targetsFor(u, {});
      logLine('move', u.label + ' advances ' + d.toFixed(1) + '".');
      soloAfterMove(u);
      if (!u.alive || u.x < 0) { u.activated = true; endActivation(); return; }
      if (!ui.targets.length) { u.activated = true; endActivation(); } else render();
      return;
    }
    var terr = R.TERRAIN[R.terrainOf(state, u)];
    logLine('move', u.label + ' moves ' + d.toFixed(1) + '"' + (terr.cover ? ' into ' + terr.name.toLowerCase() + '.' : '.'));
    u.activated = true;
    scenarioMoveEnd(u);
    endActivation();
  }

  /* The marker walks, then calls. "The unit may move up to its standard Movement
     range and designate an enemy unit within 24\"" (p. 58) — and having moved, it
     brings one gun down on the target rather than two. */
  function doMarkMove(pt) {
    var u = ui.selected;
    if (!u) return;
    var d = R.inches(u.x, u.y, pt.x, pt.y);
    var path = R.pathTo(state, u, u.move, pt);
    faceAlong(u, u.x, u.y, pt.x, pt.y);
    u.x = pt.x; u.y = pt.y; ui.vis = null; ui.visKey = '';
    u.markMoved = true;
    crushAlong(u, path);
    animateMove(u, path);
    logLine('move', u.label + ' moves ' + d.toFixed(1) + '" to get eyes on.');
    ui.moves = [];
    ui.targets = markTargets(u);
    if (!ui.targets.length) {
      logLine('note', u.label + ' has nothing in sight to mark from there.');
      u.activated = true; ui.markPicks = []; ui.markKind = null;
      endActivation(u); return;
    }
    setHint(null, markHint(u));
    render();
  }

  function doEmbark(target) {
    var u = ui.selected;
    var was = target ? { x: target.x, y: target.y } : null;
    var r = R.embark(state, u, target);
    if (!r) return;
    boardAnim(target, u, was);
    logLine('note', r.text);
    if (SFX) SFX.click();
    u.activated = true;
    pushRes({
      kind: 'Embark', title: u.name + ' takes on troops', side: u.side,
      note: r.text, outcome: {
        text: 'Carrying ' + u.cargo.length + ' of ' + u.transport + '. Passengers are off the table until they debus.',
        tone: 'good'
      }
    });
    endActivation();
  }

  /* ---------- the Xenotripods' special actions ---------- */
  function doRegain(u) {
    u.activated = true;
    ui.mode = 'idle'; ui.targets = []; ui.moves = [];
    var res = R.regainControl(state, u);
    res.log.forEach(function (l) { logLine(l.t, l.text); });
    addFx({ kind: 'wave', x: u.x, y: u.y, up: 0, r: 12, rgb: glowRGB(u), dur: 1100, blocking: true });
    if (SFX && SFX.shimmer) SFX.shimmer();
    pushRes({ kind: 'Regain Control', title: u.name + ' — Regain Control', side: u.side,
      note: 'Dominant Species: every Epsilon squad of Tier ' + R.ROMAN[u.tier] + ' or lower within 12" removes all its Suppression.',
      list: res.log.slice(1).map(function (l) { return { text: l.text, side: u.side }; }),
      outcome: { text: res.freed.length ? res.freed.length + ' squad' + (res.freed.length > 1 ? 's' : '') + ' steadied.' : 'Nobody needed it.', tone: res.freed.length ? 'good' : '' } });
    render();
    endActivation(u);
  }

  function doSelfRepair(u) {
    ui.mode = 'idle'; ui.targets = []; ui.moves = [];
    var res = R.selfRepair(state, u);
    /* Emergency Batteries (p. 143): the aircraft may still fly its Movement as
       part of the Self-repair — the player picks where; the OpFor stays put. */
    if (u.cls === 'aircraft' && R.campFlag(u, 'batteries') && !isAI(u.side)) {
      res.log.forEach(function (l) { logLine(l.t, l.text); });
      u.repairMove = true;
      ui.selected = u; ui.mode = 'move';
      ui.moves = R.reachable(state, u, u.move).filter(function (c) { return canStand(u, c); });
      ui.moves.push({ x: u.x, y: u.y, cost: 0, spent: 0, turns: 0 });
      setHint(null, 'Emergency Batteries: repaired — now fly up to ' + u.move + '", or tap the craft to stay.');
      render();
      return;
    }
    u.activated = true;
    res.log.forEach(function (l) { logLine(l.t, l.text); });
    addFx({ kind: 'wave', x: u.x, y: u.y, up: V.flyLift(u), r: 2.5, rgb: glowRGB(u), dur: 900, blocking: true });
    pushRes({ kind: 'Repair', title: u.name + ' — Self-repair', side: u.side,
      note: 'Molecular Reconstruction: the unit stays where it is and removes every Damage point.',
      outcome: { text: res.cleared + ' Damage cleared — Structure ' + u.str + ' intact.', tone: 'good' } });
    render();
    endActivation(u);
  }

  /* Teleport (p. 130): the pad takes the unit in, then the dice say where it
     comes out — a random pad on 1-2, the owner's choice on 3-6. */
  function doTeleport(tp, u) {
    if (!tp || !u) return;
    var roll = R.teleportRoll(state, u, tp);
    var pads = roll.pads;
    ui.teleport = { tp: tp, u: u, roll: roll };
    if (roll.random || pads.length <= 1 || isAI(tp.side)) {
      finishTeleport(ui.teleport, roll.random ? roll.randomPad : (ui.teleportPick || aiPadFor(u, pads) || tp));
      return;
    }
    ui.mode = 'teleport-dest';
    ui.targets = pads;
    setHint(null, 'Teleport — D6 ' + roll.value + ': choose the pad ' + u.name + ' comes out at.');
    render();
  }

  function finishTeleport(tpc, dest) {
    if (!tpc || !dest) return;
    var tp = tpc.tp, u = tpc.u, roll = tpc.roll;
    ui.teleport = null; ui.teleportPick = null;
    var from = { x: u.x, y: u.y };
    var res = R.teleport(state, u, tp, dest);
    logLine('note', res.text);
    if (res.ok && SFX && SFX.shimmer) SFX.shimmer();
    if (res.ok) {
      addFx({ kind: 'wave', x: from.x, y: from.y, up: 0, r: 2, rgb: glowRGB(u), dur: 700, blocking: true });
      addFx({ kind: 'wave', x: u.x, y: u.y, up: 0, r: 2, rgb: glowRGB(u), delay: 350, dur: 1050, blocking: true });
      ui.vis = null; ui.visKey = '';
    }
    tp.activated = true;
    ui.mode = 'idle'; ui.targets = []; ui.moves = [];
    pushRes({ kind: 'Teleport', title: tp.name + ' → ' + dest.name, side: tp.side,
      dice: [{ label: 'D6', value: roll.roll, tone: roll.random && roll.reroll == null ? 'fail' : '' }]
        .concat(roll.reroll != null ? [{ label: 'Knowledge', value: roll.reroll, tone: roll.random ? 'fail' : '' }] : []),
      note: roll.random ? '1-2: the unit comes out at a random Teleport unit.' : '3-6: the unit comes out where its owner chose.',
      outcome: { text: res.text + (res.ok ? ' It may still act this turn.' : ''), tone: res.ok ? 'good' : 'warn' } });
    render();
    endActivation(tp);
  }

  // the pad nearest to what the unit ought to be doing: the objective, else the enemy
  function aiPadFor(u, pads) {
    var goal = nearestObjective(u) || (nearestEnemy(u) || {}).unit;
    if (!goal) return null;
    var best = null, bd = Infinity;
    pads.forEach(function (p) {
      var d = R.inches(p.x, p.y, goal.x, goal.y);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  /* Who this unit could charge: anyone in reach — measured to the wall of a
     building — or, from inside a building, only an enemy in the section next
     door (p. 41, Huge buildings). */
  // barbed wire: the D6 is rolled before the move, and the player sees it (p. 42)
  function wireNote(u) {
    if (!u.wireRoll) return;
    logLine('note', u.label + ' — barbed wire: D6 ' + u.wireRoll + '. Crossing a section of it costs ' + u.wireRoll + '" of this move.');
    setHint(null, 'Barbed wire on the table: D6 ' + u.wireRoll + ' — each section crossed costs ' + u.wireRoll + '" of this move.');
  }

  function assaultables(u, reach) {
    return activeUnits().filter(function (e) {
      if (e.side === u.side || !R.canAssault(u, e)) return false;
      if (u.bld) return e.bld === u.bld && R.unitDist(u, e) <= 0.6;
      return R.unitDist(u, e) <= reach;
    });
  }

  function doEnter(u, s) {
    var wasIn = !!u.bld;
    R.enterBuilding(state, u, s.piece, s.sec);
    var what = R.TERRAIN[s.piece.kind].name.toLowerCase();
    var high = R.sectionHigh(s.piece, s.rect);
    logLine('move', u.label + (wasIn ? ' moves through to the next section of the ' + what + '.' : ' goes into the ' + what +
      (s.piece.kind === 'building' ? (high ? ' — a high building, +2 Firepower from its windows' : ' — a low building') : '') + '.'));
    if (SFX) SFX.step();
    u.activated = true;
    endActivation(u);
  }

  function doExitBld(u, spot) {
    R.exitBuilding(state, u, spot);
    logLine('move', u.label + ' comes out of the building.');
    if (SFX) SFX.step();
    u.activated = true;
    endActivation(u);
  }

  function doDisembark(pt) {
    var u = ui.selected;
    var out = (u.cargo || []).slice();
    var lines = [];
    out.forEach(function (rider, i) {
      var spot = { x: pt.x + (i % 2 ? 1.6 : -1.6), y: pt.y + (i > 1 ? 1.6 : 0) };
      var r = R.disembark(state, u, rider, spot);
      if (r) { logLine('note', r.text); lines.push({ text: r.text }); stepOff(rider, u); }
    });
    if (SFX) { SFX.step(); SFX.step(0.22); }
    u.activated = true;
    pushRes({
      kind: 'Disembark', title: u.name + ' unloads', side: u.side,
      note: 'Troops are placed within 4" of the hull and may act from next turn.',
      list: lines
    });
    endActivation();
  }

  // Strafing run: fly the line, hit everything under it, and take the return fire.
  function doStrafe(pt) {
    var u = ui.selected;
    var from = { x: u.x, y: u.y };
    faceAlong(u, u.x, u.y, pt.x, pt.y);
    var snap = snapshotAlive();
    var hitList = activeUnits().filter(function (t) {
      return t.side !== u.side && !R.isFlying(t) &&
        R.pointSegDist(t.x, t.y, from.x, from.y, pt.x, pt.y) <= 2.2;
    });
    var friends = activeUnits(u.side).filter(function (t) {
      return t !== u && R.pointSegDist(t.x, t.y, from.x, from.y, pt.x, pt.y) <= 2.2;
    });
    u.x = pt.x; u.y = pt.y;
    var log = [];
    logLine('move', u.label + ' makes a strafing run.');
    hitList.forEach(function (t) {
      var res = R.shoot(state, u, t, 'basic', {});
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); log.push(l); });
    });
    // friendly fire, on a 1-3
    friends.forEach(function (t) {
      var die = R.d6();
      if (die > 3) return;
      logLine('note', 'Friendly fire! D6 ' + die + ' — ' + t.label + ' is caught in the strafe.');
      var res2 = R.shoot(state, u, t, 'basic', {});
      res2.log.forEach(function (l) { logLine(l.t, l.text, l.math); log.push(l); });
    });
    // everything still standing may shoot back, free of charge
    hitList.forEach(function (t) {
      if (!t.alive || R.status(t) !== 'ready' || t.fp === null) return;
      if (!R.canShoot(state, t, u, 'basic', {})) return;
      var back = R.shoot(state, t, u, 'basic', {});
      back.log.forEach(function (l) { logLine(l.t, l.text, l.math); log.push(l); });
    });
    soundFor(log);
    var card = fromLog('Strafing run', u.name + ' over the line', u.side, log);
    if (!log.length) card = { kind: 'Strafing run', title: u.name, side: u.side, note: 'Nothing under the flight path.' };
    u.activated = true;
    playStrafe(u, from, pt, deathsSince(snap), function () { pushRes(card); });
    endActivation();
  }

  function resolveShot(u, target, mode, opts) {
    var snap = snapshotAlive();
    var res = R.shoot(state, u, target, mode, opts || {});
    if (res.wreck) whenIdle(function () { repaintTerrain([res.wreck]); });
    // Ambush!: the column caught off guard in the first turn (p. 156)
    if (state.scen.afterShot) {
      var extra = state.scen.afterShot(state, u, target);
      if (extra) res.log.push({ t: 'note', text: extra.text });
    }
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    soundFor(res.log);
    var card = fromLog('Shooting', u.name + ' → ' + target.name, u.side, res.log);
    playShooting(u, target, res, deathsSince(snap), function () { pushRes(card); });
    u.activated = true;
    endActivation();
  }

  function doShoot(target) {
    var u = ui.selected;
    resolveShot(u, target, ui.mode === 'advance-fire' ? 'advance' : 'fire', { aux: ui.mode === 'aux' });
  }

  function doAssault(target) {
    var u = ui.selected;
    var snap = snapshotAlive();
    var res = R.assault(state, u, target);
    if (res.wreck) whenIdle(function () { repaintTerrain([res.wreck]); });
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    soundFor(res.log);
    var card = fromLog('Assault', u.name + ' → ' + target.name, u.side, res.log);
    playAssault(u, target, deathsSince(snap), function () { pushRes(card); });
    u.activated = true; endActivation();
  }

  /* Supporting Fire: shoot without the stationary bonus, then stay active so the
     hull can still load or unload its passengers. */
  function doSupport(target) {
    var u = ui.selected;
    var snap = snapshotAlive();
    var res = R.shoot(state, u, target, 'support', {});
    if (res.wreck) whenIdle(function () { repaintTerrain([res.wreck]); });
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    soundFor(res.log);
    var card = fromLog('Supporting Fire', u.name + ' → ' + target.name, u.side, res.log);
    playShooting(u, target, res, deathsSince(snap), function () { pushRes(card); });
    u.supportUsed = true;
    ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
    setHint(null, 'Supporting Fire given — now load or unload, or pass to end the activation.');
    render();
  }

  function doSteady(target, shooter) {
    var u = shooter || ui.selected;
    if (!u || !target) return;
    var res = R.steadyFire(state, u, target);
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    faceAlong(u, u.x, u.y, target.x, target.y);
    addFx({ kind: 'muzzle', x: u.x, y: u.y, dur: 180 });
    addFx({ kind: 'tracer', from: { x: u.x, y: u.y }, to: { x: target.x, y: target.y }, dur: 220 });
    if (SFX && SFX.shot) SFX.shot();
    pushRes(fromLog('NOT ONE STEP BACKWARDS!', u.name + ' → ' + target.name, u.side, res.log));
    u.activated = true;
    endActivation(u);
  }

  function doHack(target) {
    var u = ui.selected;
    var res = R.hack(state, u, target, function (drone) {
      // the drone is turned on the nearest unit of its own side
      var own = activeUnits(drone.side).filter(function (o) {
        return o !== drone && R.canShoot(state, drone, o, 'basic', {});
      }).sort(function (a, b) { return R.unitDist(drone, a) - R.unitDist(drone, b); })[0];
      if (!own) return false;
      var back = R.shoot(state, drone, own, 'basic', {});
      back.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      return true;
    });
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    var card = fromLog('Hack', u.name + ' → ' + target.name, u.side, res.log);
    u.activated = true;
    pushRes(card);
    endActivation();
  }

  function doDemolish(piece) {
    var u = ui.selected;
    var res = R.shootTerrain(state, u, piece);
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    var mid = { x: piece.x + piece.w / 2, y: piece.y + piece.h / 2 };
    addFx({ kind: 'muzzle', x: u.x, y: u.y, dur: 180 });
    addFx({ kind: 'tracer', from: { x: u.x, y: u.y }, to: mid, dur: 220 });
    addFx({ kind: 'impact', x: mid.x, y: mid.y, n: 3, dur: 380, delay: 200 });
    if (SFX) SFX.shot && SFX.shot();
    if (res.result) whenIdle(function () { repaintTerrain([res.result]); });
    pushRes(fromLog('Demolition', u.name + ' → ' + piece.kind, u.side, res.log));
    endActivation(u);
  }

  function doBreach(piece) {
    var u = ui.selected;
    var res = R.assaultTerrain(state, u, piece);
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    var mid = { x: piece.x + piece.w / 2, y: piece.y + piece.h / 2 };
    addFx({ kind: 'clash', x: mid.x, y: mid.y, dur: 420 });
    if (res.result) whenIdle(function () { repaintTerrain([res.result]); });
    pushRes(fromLog('Demolition charges', u.name + ' → ' + piece.kind, u.side, res.log));
    endActivation(u);
  }

  /* Terrorist (p. 112): only a First Among Equals of the side that mined the
     board may set the charge off, and only while the piece is still standing. */
  function minedFor(u) {
    var m = state && state.mined;
    if (!m || !u || u.side !== m.side) return null;
    if (state.terrain.indexOf(m.piece) < 0) return null;
    var p = R.profile(u.key);
    return (p && p.group === 'First Among Equals') ? m : null;
  }

  function doDetonate(u) {
    var m = minedFor(u);
    if (!m) return;
    var snap = snapshotAlive();
    var res = R.detonate(state, u, m.piece);
    res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
    soundFor(res.log);
    var mid = { x: m.piece.x + m.piece.w / 2, y: m.piece.y + m.piece.h / 2 };
    addFx({ kind: 'clash', x: mid.x, y: mid.y, dur: 520 });
    if (res.result) whenIdle(function () { repaintTerrain([res.result]); });
    deathsSince(snap);
    pushRes(fromLog('Terrorist', u.name + ' → the charge', u.side, res.log));
    endActivation(u);
  }

  /* "Dig in!" / "Normal stance!" (p. 94). The trails swing round to face whatever
     the gun is being laid on, since an emplaced piece dug in this way only bears
     on its front quarter. */
  function doStance(u) {
    u.dugIn = !u.dugIn; u.activated = true;
    if (u.dugIn) {
      var foe = null, best = Infinity;
      state.units.forEach(function (o) {
        if (!o.alive || o.aboard || o.side === u.side) return;
        var d = R.unitDist(u, o);
        if (d < best) { best = d; foe = o; }
      });
      if (foe) u.facing = Math.atan2(foe.y - u.y, foe.x - u.x);
      else if (u.facing == null) u.facing = u.side === 'A' ? 0 : Math.PI;
    }
    logLine('note', u.dugIn
      ? u.label + ' digs in: Range 24", minimum 6", front quarter only — but firing with every modifier.'
      : u.label + ' returns to normal stance: indirect fire out to ' + u.range + '" again.');
    endActivation(u);
  }

  /* Markerlights reach 24", or 12" against a Stealth unit (p. 58). Smoke Markers
     are the rebels' answer: a flare and a smoke grenade, out to 12" (p. 94). */
  function markReach(u) {
    return R.has(u, 'Markerlights') ? 24 : 12;
  }

  function markTargets(u) {
    var far = markReach(u);
    return state.units.filter(function (t) {
      if (!t.alive || t.aboard || t.side === u.side) return false;
      var lim = R.has(t, 'Stealth') && !R.has(u, 'Keen-Eyed') ? Math.min(12, far) : far;
      return R.unitDist(u, t) <= lim && R.hasLoS(state, u, t);
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
    return 'Tap the same enemy again to send both guns at it, or a second enemy to split them.';
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
    ui.markPicks = ui.markPicks || [];
    var already = ui.markPicks.indexOf(target) >= 0;
    if (!already) ui.markPicks.push(target);

    /* Stand still and you may name a second target before the guns answer. The
       same target tapped twice is the book's other stationary option — one target,
       two units — so either way the second tap sends them. */
    var canSplit = !u.markMoved && !R.has(u, 'Smoke Markers') &&
      ui.markPicks.length < 2 && !already &&
      markTargets(u).some(function (t) { return ui.markPicks.indexOf(t) < 0; });
    if (canSplit && u.side === state.activeSide && !isAI(u.side)) {
      ui.targets = markTargets(u);
      setHint(null, markHint(u));
      render();
      return;
    }
    commitMark(u, mk);
  }

  function commitMark(u, kind) {
    var picks = (ui.markPicks || []).slice();
    if (!picks.length) return;
    var smoke = !R.has(u, 'Markerlights') && R.has(u, 'Smoke Markers');
    var shots = smoke ? 2 : (u.markMoved ? 1 : 2);
    state.mark = { side: u.side, kind: kind, targets: picks, smoke: smoke };
    picks.forEach(function (t) { t.marked = true; });
    u.activated = true;

    var ready = state.units.filter(function (o) {
      return o.alive && !o.aboard && !o.activated && !o.reserve && o.side === u.side && o !== u &&
        R.status(o) !== 'broken' && picks.some(function (t) { return canAnswerMark(o, t, kind); });
    });
    var calls = Math.min(shots, ready.length);
    logLine('note', u.label + (smoke ? ' puts smoke and a flare on ' :
      kind === 'mark' ? ' marks ' : ' designates ') +
      picks.map(function (t) { return t.label; }).join(' and ') +
      (u.markMoved ? ', on the move' : '') + ' — ' +
      (calls ? calls + ' friendly unit' + (calls > 1 ? 's fire' : ' fires') + ' at once' +
        (kind === 'mark' ? ', as though at half range' : ', without needing to see it')
        : 'but nobody is in a position to answer') + '.');
    if (calls && !state.chain) {
      state.chain = {
        side: u.side, remaining: calls + 1,
        kind: 'mark', target: picks[0], x: u.x, y: u.y, tier: 99
      };
    } else if (!calls) {
      clearMark();
    }
    ui.markPicks = []; ui.markKind = null;
    endActivation(u);
  }

  function clearMark() {
    if (state.mark) state.mark.targets.forEach(function (t) { t.marked = false; });
    state.mark = null;
  }

  /* Could this unit answer a call of this kind? `R.canShoot` is asked the whole
     question — range, minimum range, arc, specialisation and, for a designation,
     the line of sight it is allowed to do without. */
  function canAnswerMark(o, target, kind) {
    if (!target || !target.alive || target.aboard) return false;
    if (o.fp == null || !o.fp || !o.range) return false;
    /* Designate target calls up a unit WITH Indirect Fire; Mark the target calls
       up one WITHOUT it. Neither will do for the other's call (p. 58). */
    var indirect = R.has(o, 'Indirect Fire') && !R.dugIn(o);
    if ((kind === 'mark') === indirect) return false;
    return R.canShoot(state, o, target, 'fire', { markKind: kind || 'designate' });
  }

  // is there anybody at all who could answer a call of this kind?
  function markAnswerable(u, kind) {
    var td = markTargets(u);
    if (!td.length) return false;
    return state.units.some(function (o) {
      return o.alive && !o.aboard && !o.activated && !o.reserve && o.side === u.side && o !== u &&
        R.status(o) !== 'broken' &&
        td.some(function (t) { return canAnswerMark(o, t, kind); });
    });
  }

  // Machines think differently: they have no nerve to lose, they never charge,
  // and a transport's job is to get its passengers forward and put them down.
  function aiDrive(u) {
    var shot = bestTarget(u, 'fire');
    var carrying = (u.cargo || []).length;

    /* Xenotripod hardware: a Teleport unit sends the squad that gains most from
       the jump; anything with Molecular Reconstruction rebuilds when it is badly
       hurt and has nothing better to do; a turret never moves. */
    if (R.has(u, 'Teleport')) {
      var tj = aiTeleportPick(u);
      if (tj) { ui.teleportPick = tj.pad; doTeleport(u, tj.unit); return; }
    }
    if (R.has(u, 'Molecular Reconstruction') && u.damage && (u.damage >= u.str - 1 || !shot.t)) {
      doSelfRepair(u); return;
    }
    if (R.has(u, 'Turret')) {
      if (shot.t) { fire(u, shot.t, 'fire'); return; }
      u.activated = true; endActivation(u); return;
    }

    /* An Overgrown bug is a beast, not a hull: the Queen sends out her wave when
       it catches two or more, and anything with more bite than spit charges. */
    if (R.isOvergrown(u) && R.status(u) !== 'broken') {
      if (R.has(u, 'Psychic Wave') && R.status(u) === 'ready') {
        var wq = bestWaveSpot(u);
        if (wq && wq.n >= 2) { doWave(u, wq.pt); return; }
      }
      var ogReach = u.move + moveBonus(u, 'assault') - 2;
      var prey = nearestEnemy(u);
      if (prey && R.status(u) === 'ready' && R.canAssault(u, prey.unit) && prey.dist <= ogReach &&
        (u.fp == null || u.assault >= u.fp || !shot.t)) { aiCharge(u, prey.unit); return; }
    }

    /* A Rapid insertion platform does one thing and then it is scenery (p. 79). */
    if (R.has(u, 'Immobile')) {
      if (carrying) {
        var spot = null;
        for (var a2 = 0; a2 < 16 && !spot; a2++) {
          var ang = a2 / 16 * Math.PI * 2;
          var q = R.clampBoard({ x: u.x + Math.cos(ang) * 3, y: u.y + Math.sin(ang) * 3 });
          if (R.TERRAIN[R.terrainAt(state, q.x, q.y)].impassable) continue;
          if (R.unitNear(state, q.x, q.y, u, 0.6)) continue;
          spot = q;
        }
        ui.selected = u; doDisembark(spot || { x: u.x, y: u.y }); return;
      }
      u.activated = true; endActivation(u); return;
    }

    // a transport with troops aboard heads for the nearest objective and unloads
    if (carrying) {
      var obj = nearestObjective(u);
      if (obj && R.inches(u.x, u.y, obj.x, obj.y) < 9) {
        var spot = { x: u.x + Math.cos(u.facing || 0) * 2.5, y: u.y + Math.sin(u.facing || 0) * 2.5 };
        var lines = [];
        (u.cargo || []).slice().forEach(function (rider, i) {
          var r = R.disembark(state, u, rider, { x: spot.x + (i % 2 ? 1.6 : -1.6), y: spot.y });
          if (r) { logLine('note', r.text); lines.push({ text: r.text }); stepOff(rider, u); }
        });
        if (SFX) { SFX.step(); SFX.step(0.22); }
        u.activated = true;
        pushRes({ kind: 'Disembark', title: u.name + ' unloads', side: u.side, list: lines });
        endActivation(); return;
      }
      return aiRoll(u, obj || nearestEnemy(u), true);
    }

    // an empty transport picks up the nearest squad that will fit
    if (u.transport && !carrying) {
      var pax = activeUnits(u.side).filter(function (t) { return R.canEmbark(state, u, t); });
      if (pax.length) {
        var was2 = { x: pax[0].x, y: pax[0].y };
        var r2 = R.embark(state, u, pax[0]);
        if (r2) boardAnim(pax[0], u, was2);
        logLine('note', r2.text);
        u.activated = true;
        pushRes({ kind: 'Embark', title: u.name + ' takes on troops', side: u.side, note: r2.text });
        endActivation(); return;
      }
    }

    // an aircraft with a line of targets makes a run
    if (u.cls === 'aircraft') {
      var lane = bestStrafe(u);
      if (lane && lane.count) { ui.selected = u; doStrafe(lane.pt); return; }
    }

    // badly damaged and nothing worth shooting: pull back and patch up
    if (u.damage >= u.str && !shot.t) {
      var rep = R.repair(state, u);
      logLine('rally', rep ? rep.text : u.label + ' stands down.');
      if (rep) pushRes(repairCard(u, rep));
      u.activated = true; endActivation(); return;
    }

    if (shot.t && shot.score > 0.35) { fire(u, shot.t, 'fire'); return; }
    aiRoll(u, nearestEnemy(u), false);
  }

  /* Advanced Control System (p. 143): after a Move the aircraft may turn up to
     90° — it swings its nose toward the nearest enemy, as far as that allows. */
  function flightTurn(u) {
    if (!u || u.cls !== 'aircraft' || !R.campFlag(u, 'advControl')) return;
    var ne = nearestEnemy(u);
    if (!ne) return;
    var want = Math.atan2(ne.unit.y - u.y, ne.unit.x - u.x), d = want - (u.facing || 0);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    u.facing = (u.facing || 0) + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d));
  }

  // which squad a Teleport unit should send, and where: worth it only for a real jump
  function aiTeleportPick(tp) {
    var pax = R.teleportFrom(state, tp), pads = R.teleportPads(state, tp.side);
    if (!pax.length || pads.length < 2) return null;
    var best = null;
    pax.forEach(function (u) {
      var goal = nearestObjective(u) || (nearestEnemy(u) || {}).unit;
      if (!goal) return;
      var now = R.inches(u.x, u.y, goal.x, goal.y);
      pads.forEach(function (p) {
        if (p === tp) return;
        var gain = now - R.inches(p.x, p.y, goal.x, goal.y);
        if (gain > 8 && (!best || gain > best.gain)) best = { unit: u, pad: p, gain: gain };
      });
    });
    return best;
  }

  // drive toward something, then shoot if anything comes into arc
  function aiRoll(u, goalUnit, cautious) {
    var goal = goalUnit && goalUnit.unit ? { x: goalUnit.unit.x, y: goalUnit.unit.y }
      : goalUnit ? { x: goalUnit.x, y: goalUnit.y } : pickGoal(u, 'offensive');
    var allowance = u.move + moveBonus(u);
    var spots = R.reachable(state, u, allowance).filter(function (c) { return canStand(u, c); }), best = null, bestD = Infinity;
    var want = cautious ? 6 : Math.max(4, u.range * 0.45);
    spots.forEach(function (c) {
      var d = Math.abs(R.inches(c.x, c.y, goal.x, goal.y) - want);
      if (d < bestD) { bestD = d; best = c; }
    });
    if (best && R.inches(u.x, u.y, best.x, best.y) > 0.6) {
      var path = R.pathTo(state, u, allowance, best);
      faceAlong(u, u.x, u.y, best.x, best.y);
      var dist = R.inches(u.x, u.y, best.x, best.y);
      u.x = best.x; u.y = best.y;
      flightTurn(u);
      logLine('move', u.label + ' drives ' + dist.toFixed(1) + '".');
      crushAlong(u, path);
      animateMove(u, path, true);
    }
    var t2 = bestTarget(u, 'advance');
    if (t2.t && t2.score > 0.2) {
      whenIdle(function () { if (state && !state.over && u.alive) fire(u, t2.t, 'advance'); });
      return;
    }
    u.activated = true;
    whenIdle(function () { if (state && !state.over) endActivation(u); });
  }

  /* What the AI walks towards. Usually the objectives; in Find and secure, until
     the objective turns up, the locations nobody has checked yet. */
  function goalPoints() {
    if (state.scen.goals) return state.scen.goals(state);
    if (state.objectives.length) return state.objectives;
    if (state.sc && state.sc.search && !state.sc.found) {
      return state.sc.search.filter(function (sp) { return !sp.checked; });
    }
    return [];
  }

  function nearestObjective(u) {
    var best = null, bd = Infinity;
    goalPoints().forEach(function (o) {
      var d = R.inches(u.x, u.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }

  // the flight path that catches the most enemies
  function bestStrafe(u) {
    var spots = R.reachable(state, u, u.move), best = null;
    spots.forEach(function (c) {
      if ((Math.round(c.x * 2) % 2) || (Math.round(c.y * 2) % 2)) return;
      var n = 0;
      activeUnits().forEach(function (t) {
        if (t.side === u.side || R.isFlying(t)) return;
        if (R.pointSegDist(t.x, t.y, u.x, u.y, c.x, c.y) <= 2.2) n++;
      });
      if (n && (!best || n > best.count)) best = { pt: c, count: n };
    });
    return best;
  }

  // how far a unit stands from the nearest of the other side's units on the table
  function gapToFoes(u) {
    var d = Infinity;
    state.units.forEach(function (e) { if (onTable(e) && e.side !== u.side) d = Math.min(d, R.unitDist(u, e)); });
    return d;
  }

  // a scenario may put ground off limits: the VIP's leash, the safe zone the OpFor cannot enter
  function canStand(u, c) {
    return !state.scen.moveOK || state.scen.moveOK(state, u, c);
  }

  function expectedHits(u, t, mode, opts) {
    if (!R.canShoot(state, u, t, mode, opts)) return -1;
    var d = R.unitDist(u, t);
    var mods = (opts && opts.aux ? 1 : u.fp) + R.sizeBonus(u.models);
    if (mode === 'fire') mods += 1;
    if (d <= u.range / 2) mods += 2;
    if (R.terrainOf(state, u) === 'hill') mods += 2;
    var def = R.defenceAgainst(state, u, t, {}).value;
    var e = 0;
    for (var roll = 1; roll <= 9; roll++) {
      e += (roll === 9 ? Math.max(1, roll + mods - def) : Math.max(0, roll + mods - def)) / 10;
    }
    var st = R.status(t);
    if (st === 'suppressed') e *= 1.25;
    if (st === 'broken') e *= 1.4;
    if (t.models <= 2) e *= 1.2;
    return e;
  }

  function bestTarget(u, mode, opts) {
    var best = { t: null, score: -1 };
    /* Protecting the VIP: "whenever an OpFor unit can attack the VIP unit, it
       will do so" (p. 151) — whatever else is a better shot. */
    if (state.scen.mustTarget && u.side === 'B') {
      var vip = state.scen.mustTarget(state, u);
      if (vip && vip.alive && onTable(vip)) {
        var ev = expectedHits(u, vip, mode || 'fire', opts);
        if (ev >= 0) return { t: vip, score: Math.max(ev, 0.5), forced: true };
      }
    }
    state.units.forEach(function (t) {
      // an enemy in reserve or riding in a hull is not on the table to be shot at
      if (!t.alive || t.side === u.side || !onTable(t)) return;
      var e = expectedHits(u, t, mode || 'fire', opts);
      if (e > best.score) best = { t: t, score: e };
    });
    return best;
  }

  function nearestEnemy(u) {
    var best = null, bd = Infinity;
    state.units.forEach(function (t) {
      // only enemies on the table: one waiting in reserve sits off its corner, and chasing it walks nowhere
      if (!t.alive || t.side === u.side || !onTable(t)) return;
      var d = R.unitDist(u, t);
      if (d < bd) { bd = d; best = t; }
    });
    return best ? { unit: best, dist: bd } : null;
  }

  function aiAct(u) {
    if (R.isMachine(u)) { aiDrive(u); return; }
    /* "Death or Glory, Comrades!" (p. 94): a shaken unit with a leader shouting
       at it goes in rather than going to ground — that is the whole point of the
       rule, and the Suppression falls away as the charge starts. */
    if (R.status(u) === 'suppressed' && R.deathOrGlory(state, u) && !R.has(u, 'Cumbersome Weapon')) {
      var dogReach = u.move + moveBonus(u, 'assault') - 2;
      var dogT = nearestEnemy(u);
      if (dogT && R.canAssault(u, dogT.unit) && dogT.dist <= dogReach) {
        var dsnap = snapshotAlive();
        var dres = R.assault(state, u, dogT.unit);
        dres.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
        soundFor(dres.log);
        var dcard = fromLog('Assault', u.name + ' → ' + dogT.unit.name, u.side, dres.log);
        playAssault(u, dogT.unit, deathsSince(dsnap), function () { pushRes(dcard); });
        u.activated = true; endActivation(u); return;
      }
    }
    // a pinned squad beside an empty building gets inside it
    if (R.status(u) === 'suppressed' && !u.bld && R.TERRAIN[R.terrainOf(state, u)].cover === 0) {
      var sin = R.enterTargets(state, u);
      if (sin.length) {
        sin.sort(function (a, b) { return R.rectPointDist(a.rect, u.x, u.y) - R.rectPointDist(b.rect, u.x, u.y); });
        logLine('ai', u.label + ' is suppressed and gets into the nearest building.');
        doEnter(u, sin[0]); return;
      }
    }
    if (R.status(u) === 'suppressed') {
      var spots = R.reachable(state, u, u.move + 2).filter(function (c) { return R.TERRAIN[R.terrainAt(state, c.x, c.y)].cover > 0 && canStand(u, c); });
      if (spots.length && R.TERRAIN[R.terrainOf(state, u)].cover === 0) {
        spots.sort(function (a, b) { return a.cost - b.cost; });
        var spath = R.pathTo(state, u, u.move + 2, spots[0]);
        u.x = spots[0].x; u.y = spots[0].y;
        animateMove(u, spath, true);
        logLine('move', u.label + ' is suppressed and scrambles into ' + R.TERRAIN[R.terrainOf(state, u)].name.toLowerCase() + '.');
      } else {
        var rr = R.rally(state, u);
        logLine('rally', rr ? rr.text : u.label + ' regroups.');
        if (rr) pushRes({ kind: 'Regroup', title: u.name + ' regroups', side: u.side, list: [{ text: rr.text, side: u.side }] });
      }
      u.activated = true; endActivation(u); return;
    }

    // a Crock steadies its Esh-Aven when enough of them are shaken
    if (R.has(u, 'Dominant Species') && R.status(u) === 'ready') {
      var rgt = R.regainTargets(state, u);
      var shaken = rgt.reduce(function (n, o) { return n + o.sp; }, 0);
      if (rgt.some(function (o) { return R.status(o) !== 'ready'; }) || shaken >= 4) { doRegain(u); return; }
    }
    // Aggressive bugs with no Overmind near charge the closest enemy in reach (p. 116)
    var mustC = forcedCharge(u);
    if (mustC) { logLine('ai', u.label + (R.campFlag(u, 'bloodlust') ? ' — Bloodlust' : ' — Aggressive') + ': charges the closest enemy.'); aiCharge(u, mustC); return; }
    /* NOT ONE STEP BACKWARDS! (T5): a commander, or a unit beside one, puts a burst
       over the heads of a broken friend — or one badly shaken — to get it moving */
    if (R.steadyShooter(state, u)) {
      var shaken2 = R.steadyTargets(state, u).filter(function (t) { return R.status(t) === 'broken' || (t.sp || 0) >= 4; })
        .sort(function (a, b) { return (b.sp || 0) - (a.sp || 0); })[0];
      if (shaken2) { logLine('ai', u.label + ' — NOT ONE STEP BACKWARDS!: steadies ' + shaken2.label + '.'); doSteady(shaken2, u); return; }
    }
    // a Psychic Wave that catches two or more is worth more than a shot
    if (R.has(u, 'Psychic Wave') && R.status(u) === 'ready') {
      var wv = bestWaveSpot(u);
      if (wv && wv.n >= 2) { doWave(u, wv.pt); return; }
    }

    // standing over an unchecked location is worth more than any other action
    if (SC.searchSpots(state, u).length) { doCheckArea(u); return; }

    /* An emplaced gun cannot manoeuvre, so its only decision is its stance: with
       an enemy inside 24" and in front of it, direct fire hits far harder than
       Basic Firepower does (p. 94). */
    if (R.has(u, 'Stationary Artillery')) {
      var close = state.units.filter(function (e) {
        return e.alive && !e.aboard && e.side !== u.side && R.unitDist(u, e) <= 24 &&
          R.unitDist(u, e) >= 6 && R.hasLoS(state, u, e);
      });
      if ((close.length > 0) !== !!u.dugIn) { doStance(u); return; }
    }

    /* A marker is worth more than the shot the unit could take itself: it puts two
       friendly guns onto the target at once (p. 58, and Smoke Markers on p. 94). */
    if (R.has(u, 'Markerlights') || R.has(u, 'Smoke Markers')) {
      /* Designating is worth more than the shot this unit could take itself, so
         it is tried first — and the kind that brings the most guns wins. */
      var kinds = R.has(u, 'Markerlights') ? ['designate', 'mark'] : ['designate'];
      var best = null;
      kinds.forEach(function (k) {
        var marks = markTargets(u).filter(function (t) {
          return state.units.some(function (o) {
            return o.alive && !o.aboard && !o.activated && !o.reserve && o.side === u.side && o !== u &&
              R.status(o) !== 'broken' && canAnswerMark(o, t, k);
          });
        });
        if (!marks.length) return;
        marks.sort(function (a2, b2) { return (b2.models || 1) * b2.tier - (a2.models || 1) * a2.tier; });
        var worth = (marks[0].models || 1) * marks[0].tier + (k === 'designate' ? 1 : 0);
        if (!best || worth > best.worth) best = { kind: k, target: marks[0], worth: worth };
      });
      if (best) {
        ui.markPicks = []; ui.markKind = best.kind;
        u.markMoved = false;
        doDesignate(best.target, u, best.kind);
        return;
      }
    }

    /* Decapitation: the OpFor's leaders always act Reasonably Defensive and never
       Move nor Advance (p. 152) — they shoot from where they are, or keep their heads down. */
    if (state.scen.noMove && state.scen.noMove(state, u)) {
      var still = bestTarget(u, 'fire');
      logLine('ai', u.label + ' holds its position (Reasonably Defensive).');
      if (still.t) { fire(u, still.t, 'fire'); return; }
      u.activated = true; endActivation(u); return;
    }

    var roll = R.d6(), mods = 0, why = [];
    if (u.fp && u.assault >= 2 * u.fp) { mods += 2; why.push('Assault ≥ 2× Firepower +2'); }
    else if (u.assault > u.fp) { mods += 1; why.push('Assault > Firepower +1'); }
    var shot = bestTarget(u, 'fire');
    if (!shot.t) { mods += 2; why.push('no enemy in range +2'); }
    // the scenario's own temper: aggressive, defensive, or aggressive near the objectives
    if (state.solo && u.side === 'B' && state.scen.behaviour) {
      var bm = state.scen.behaviour(state, u) || {};
      if (bm.mod) { mods += bm.mod; why.push(bm.why || ((bm.mod > 0 ? '+' : '') + bm.mod)); }
    }
    var total = roll + mods;
    var behaviour = total <= 0 ? 'flee' : total <= 2 ? 'defensive' : total <= 4 ? 'neutral' : total <= 6 ? 'offensive' : 'assault';
    // units with Cumbersome Weapons count 4-7 as Reasonably Neutral (p. 147)
    if (R.has(u, 'Cumbersome Weapon') && total >= 4 && total <= 7) behaviour = 'neutral';
    logLine('ai', u.label + ' — behaviour D6 ' + roll + (why.length ? ' (' + why.join(', ') + ')' : '') + ' = ' + total + ': ' + behaviour + '.');

    /* A garrison (p. 41) shoots from where it is, charges only an enemy in the
       next section, and comes out when it wants to press on and has nothing to
       shoot at. Otherwise it holds the building. */
    if (u.bld) {
      if (behaviour === 'assault' && !R.has(u, 'Cumbersome Weapon')) {
        var adj = assaultables(u, 0)[0];
        if (adj) { aiCharge(u, adj); return; }
      }
      if (shot.t && shot.score > 0.2) { fire(u, shot.t, 'fire'); return; }
      if (behaviour === 'offensive' || behaviour === 'assault') {
        var goalB = pickGoal(u, behaviour), outs = R.exitSpots(state, u);
        if (outs.length) {
          outs.sort(function (a, b) { return R.inches(a.x, a.y, goalB.x, goalB.y) - R.inches(b.x, b.y, goalB.x, goalB.y); });
          logLine('ai', u.label + ' comes out of the building to press on.');
          doExitBld(u, outs[0]); return;
        }
      }
      logLine('ai', u.label + ' holds the building.');
      u.activated = true; endActivation(u); return;
    }
    var ne = nearestEnemy(u);
    // the VIP draws the charge too, when it is in reach
    if (behaviour === 'assault' && state.scen.mustTarget && u.side === 'B') {
      var vipA = state.scen.mustTarget(state, u);
      if (vipA && vipA.alive && onTable(vipA) && R.canAssault(u, vipA) && R.unitDist(u, vipA) <= u.move + 2) ne = { unit: vipA, dist: R.unitDist(u, vipA) };
    }
    if (behaviour === 'assault' && ne && R.canAssault(u, ne.unit) && ne.dist <= u.move + 2 && !R.has(u, 'Cumbersome Weapon')) {
      var snap = snapshotAlive();
      var res = R.assault(state, u, ne.unit);
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      soundFor(res.log);
      var card = fromLog('Assault', u.name + ' → ' + ne.unit.name, u.side, res.log);
      playAssault(u, ne.unit, deathsSince(snap), function () { pushRes(card); });
      u.activated = true; endActivation(u); return;
    }
    if ((behaviour === 'defensive' || behaviour === 'neutral' || shot.forced) && shot.t && shot.score > 0.4) {
      fire(u, shot.t, 'fire'); return;
    }

    // a cautious squad next to an empty building takes it rather than standing in the open
    if ((behaviour === 'defensive' || behaviour === 'neutral') && R.TERRAIN[R.terrainOf(state, u)].cover === 0 && Math.random() < 0.7) {
      var ins = R.enterTargets(state, u);
      if (ins.length) {
        ins.sort(function (a, b) { return R.rectPointDist(a.rect, u.x, u.y) - R.rectPointDist(b.rect, u.x, u.y); });
        logLine('ai', u.label + ' takes the building beside it.');
        doEnter(u, ins[0]); return;
      }
    }
    var goal = pickGoal(u, behaviour);
    var allowance = behaviour === 'flee' ? u.move + 2 : u.move;
    var here = scoreSpot(u, { x: u.x, y: u.y }, goal, behaviour);
    var best = null, bestScore = here + 0.6;
    R.reachable(state, u, allowance).forEach(function (c) {
      if ((Math.round(c.x * 2) % 2) || (Math.round(c.y * 2) % 2)) return;
      if (!canStand(u, c)) return;
      var s = scoreSpot(u, c, goal, behaviour);
      if (s > bestScore) { bestScore = s; best = c; }
    });
    if (best) {
      var d = R.inches(u.x, u.y, best.x, best.y);
      var path = R.pathTo(state, u, allowance, best);
      u.x = best.x; u.y = best.y;
      logLine('move', u.label + (behaviour === 'flee' ? ' withdraws ' : ' advances ') + d.toFixed(1) + '".');
      crushAlong(u, path);
      animateMove(u, path, true);
      soloAfterMove(u);
      if (u.x < 0) { u.activated = true; endActivation(u); return; }
    }
    if (behaviour !== 'flee' && !R.campFlag(u, 'noAdvance')) {
      var t2 = bestTarget(u, 'advance');
      if (t2.t && t2.score > 0.2) {
        whenIdle(function () { if (state && !state.over && u.alive) fire(u, t2.t, 'advance'); });
        return;
      }
    }
    u.activated = true; endActivation(u);
  }

  function fire(u, t, mode) { resolveShot(u, t, mode, {}); }

  function pickGoal(u, behaviour) {
    if (behaviour === 'flee') {
      var ne = nearestEnemy(u);
      return ne ? { x: u.x + (u.x - ne.unit.x), y: u.y + (u.y - ne.unit.y) } : { x: u.side === 'A' ? 1 : W - 1, y: u.y };
    }
    if (behaviour === 'assault') {
      var t = nearestEnemy(u);
      if (t) return { x: t.unit.x, y: t.unit.y };
    }
    var goals = goalPoints();
    var standing = goals.filter(function (o) { return objDist(u, o) <= 4; })[0];
    if (standing && behaviour !== 'offensive') return standing;
    var best = null, bd = Infinity;
    goals.forEach(function (o) {
      var crowd = state.units.filter(function (f) {
        return f.alive && f !== u && f.side === u.side && objDist(f, o) <= 6;
      }).length;
      var d = R.inches(u.x, u.y, o.x, o.y) + crowd * 14 + (o.owner === u.side ? 8 : 0);
      if (d < bd) { bd = d; best = o; }
    });
    if (best) return best;
    // nothing to hold and nothing to find: the enemy is the objective
    var foe = nearestEnemy(u);
    return foe ? { x: foe.unit.x, y: foe.unit.y } : { x: W / 2, y: H / 2 };
  }

  function scoreSpot(u, c, goal, behaviour) {
    var s = 0;
    var terr = R.TERRAIN[R.terrainAt(state, c.x, c.y)];
    s += terr.cover * 1.6;
    if (terr.fp) s += 2;
    s -= 0.6 * R.inches(c.x, c.y, goal.x, goal.y);
    var ghost = { x: c.x, y: c.y, alive: true };
    var exposure = 0, opportunity = 0;
    state.units.forEach(function (e) {
      if (!e.alive || e.side === u.side) return;
      if (!R.hasLoS(state, e, ghost)) return;
      var d = Math.max(0, R.inches(c.x, c.y, e.x, e.y) - 2 * UR);
      if (d <= u.range) opportunity += 1.4;
      if (d <= e.range) exposure += 1.0;
    });
    state.units.forEach(function (f) {
      if (!f.alive || f === u || f.side !== u.side) return;
      if (R.inches(c.x, c.y, f.x, f.y) <= 4) s -= 1.3;
    });
    /* An Overmind is worth more alive and near its swarm than at the front: it
       wants every bug it leads inside its reach, and keeps its own head down. */
    if (R.has(u, 'Overmind')) {
      var reach = R.overmindReach(state, u.side), led = 0;
      state.units.forEach(function (f) {
        if (!f.alive || f === u || f.side !== u.side || f.x < 0 || !R.has(f, 'Animal Behaviour') || f.tier > u.tier) return;
        if (R.inches(c.x, c.y, f.x, f.y) <= reach) led++;
      });
      s += led * 1.5 - exposure * 1.2;
    }
    if (behaviour === 'flee') s -= exposure * 3;
    else if (behaviour === 'defensive') s += opportunity * 1.2 - exposure * 0.9;
    else s += opportunity * 1.6 - exposure * 0.3;
    return s;
  }

  /* ================= resolution cards ================= */
  function fromLog(kind, title, side, entries) {
    var blocks = [], cur = null;
    entries.forEach(function (l) {
      if (l.t === 'shoot' || l.t === 'round') {
        cur = { head: l.text, math: l.math || '', die: null, chips: [], banners: [] };
        var m = (l.math || '').match(/D10 rolls (\d)/);
        if (m) cur.die = parseInt(m[1], 10);
        blocks.push(cur);
      } else if (l.t === 'hits' && cur) {
        cur.chips = l.text.split(' · ');
      } else if (cur && (l.t === 'suppressed' || l.t === 'broken' || l.t === 'kill' || l.t === 'note')) {
        cur.banners.push({ text: l.text, tone: l.t === 'note' ? '' : l.t === 'suppressed' ? 'warn' : 'bad' });
      } else if (!cur) {
        blocks.push({ head: l.text, math: '', die: null, chips: [], banners: [] });
      }
    });
    return { kind: kind, title: title, side: side, blocks: blocks };
  }

  function snapshotAlive() {
    return state.units.filter(function (u) { return u.alive; }).map(function (u) {
      return { u: u, x: u.x, y: u.y };
    });
  }

  function deathsSince(snap) {
    return snap.filter(function (s) { return !s.u.alive; });
  }

  /* What a fight leaves behind. Each redraw compares every unit with how it
     stood at the last one: a squad that has lost models leaves a body for each
     where the model stood, and a machine destroyed on the table leaves its
     wreck, burning. A unit that ran, or was aboard something, leaves nothing. */
  function unitById(id) {
    for (var i = 0; i < state.units.length; i++) if (state.units[i].id === id) return state.units[i];
    return null;
  }

  /* ================= loading transports before the battle =================
     "If the ground troops and transport vehicle are in reserve, the troops can
     enter the table on-board the vehicle, but this has to be declared before the
     game" (p. 36) — and a Rapid insertion platform "has to start the battle with
     a single infantry unit onboard" (p. 79). Both want the same thing: a way to
     put a squad inside a hull during deployment, before a shot is fired. */
  function byId(id) {
    for (var i = 0; i < state.units.length; i++) if (state.units[i].id === id) return state.units[i];
    return null;
  }

  function carriersFor(side) {
    return state.units.filter(function (u) {
      return u.side === side && u.alive && u.transport && !u.aboard;
    });
  }

  // who could ride in this hull before the battle: any of the side's own infantry
  function boardableFor(veh) {
    return state.units.filter(function (u) {
      return u.side === veh.side && u.alive && u.cls === 'infantry' && !u.aboard &&
        !R.has(u, 'Riders') && !R.has(u, 'Stationary Artillery') && u !== veh;
    });
  }

  function loadBefore(veh, u, quiet) {
    if (!veh || !u || (veh.cargo || []).length >= veh.transport) return false;
    veh.cargo = veh.cargo || [];
    veh.cargo.push(u);
    u.aboard = veh.id;
    u.x = veh.x; u.y = veh.y;
    u.sp = 0;
    u.reserve = false;                   // it rides in with the hull, not on its own
    if (!quiet) logLine('note', u.label + ' loads aboard ' + veh.name + ' before the battle.');
    return true;
  }

  function unloadBefore(veh, u) {
    if (!veh || !u) return false;
    veh.cargo = (veh.cargo || []).filter(function (c) { return c !== u; });
    u.aboard = null;
    u.x = -1; u.y = -1;                  // back in hand, to be put down again
    logLine('note', u.label + ' steps back off ' + veh.name + '.');
    return true;
  }

    /* ================= what the outside world may ask for ================= */

    function sideOfSeat(seat) { return seat === 'B' ? 'B' : 'A'; }
    function idsOf(list) { return (list || []).map(function (u) { return u && u.id; }); }

    /* The battle, flattened. Unit-to-unit links become ids, the scenario's
       functions and the baked scenery are left out, and everything the client
       needs to draw the table is in what is left. */
    function snapshot() {
      if (!state) return null;
      var skip = { namesTaken: 1, scen: 1, scene: 1, ground: 1, structs: 1, structsOpen: 1, props: 1, remains: 1, baking: 1, fireOnView: 1, hazeOnView: 1 };
      var out = {};
      Object.keys(state).forEach(function (k) {
        if (skip[k]) return;
        out[k] = state[k];
      });
      out.units = state.units.map(function (u) {
        var c = {};
        Object.keys(u).forEach(function (k) {
          if (k === 'cargo') { c.cargo = idsOf(u.cargo); return; }
          // a garrison names its building by the piece itself; the wire wants where it is in the list
          if (k === 'bld') { c.bld = u.bld ? state.terrain.indexOf(u.bld) : null; return; }
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
      /* The terrain set-up. The generator's table is looked up again from the
         planet rather than sent, and the pieces each area has put down are
         already in the terrain list, so they go as places in it. */
      if (state.tset) {
        out.tset = Object.assign({}, state.tset);
        delete out.tset.gen;
        out.tset.areas = state.tset.areas.map(function (a) {
          var c = Object.assign({}, a);
          c.placed = (a.placed || []).map(function (p) { return state.terrain.indexOf(p); });
          return c;
        });
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
        tsetHint: ui.tsetHint || '',
        // the buildings a unit could go into, as a piece and a section of it
        sections: (ui.sections || []).map(function (s) {
          return { piece: state.terrain.indexOf(s.piece), sec: s.sec, move: !!s.move };
        }),
        placing: state.phase === 'deploy' ? placingSide() : state.phase === 'terrain' ? terrainSide() : null,
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
      /* The table is painted once and then scrolled over: baking the ground,
         the structures and the props costs real time, and none of it travels
         on the wire. Carry it across from the battle we were already holding,
         as long as it is the same battle on the same ground — a new battle, or
         terrain that has been blown apart, and it is painted again. */
      var was = state;
      var same = was && was.seed === snap.seed && was.terrain.length === snap.terrain.length;
      state = snap;
      if (same) {
        ['scene', 'ground', 'structs', 'structsOpen', 'props', 'remains'].forEach(function (k) {
          if (was[k] !== undefined) state[k] = was[k];
        });
      }
      state.scen = SC.SCENARIOS[(snap.sc && snap.sc.id) || snap.cfg.scenario] || SC.SCENARIOS.secure;
      var by = {};
      state.units.forEach(function (u) { by[u.id] = u; });
      state.units.forEach(function (u) {
        u.cargo = (u.cargo || []).map(function (id) { return by[id]; }).filter(Boolean);
        /* A garrison's building has to be the very piece in the terrain list:
           who is in a building is worked out by asking which unit holds it. */
        if (typeof u.bld === 'number') u.bld = state.terrain[u.bld] || null;
      });
      if (state.tset) {
        state.tset.gen = GEN.tableFor(state.cfg.planet);
        state.tset.areas.forEach(function (a) {
          a.placed = (a.placed || []).map(function (i) { return state.terrain[i]; }).filter(Boolean);
        });
      }
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
      ui.tsetHint = us.tsetHint || '';
      ui.sections = (us.sections || []).map(function (s) {
        var piece = state.terrain[s.piece];
        if (!piece) return null;
        var parts = piece.parts && piece.parts.length ? piece.parts : [piece];
        return { piece: piece, sec: s.sec, rect: parts[s.sec] || parts[0], move: s.move };
      }).filter(Boolean);
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
          /* A unit half-way through an Advance has to finish it first; left
             behind, it could come back later in the turn for a whole action. */
          var mid = ui.selected;
          if (mid && mid !== u && mid.advancing && !mid.activated) {
            return no(mid.name + ' is half-way through its Advance — let it shoot, or hold its fire, first');
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
        case 'start': {
          if (state.phase !== 'deploy') return no('already under way');
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
        case 'cancel': {
          if (!mayAct(side)) return no('not your activation');
          // half-way through an Advance there is nothing to go back to: it holds its fire
          var adv = ui.selected;
          if (adv && adv.advancing && !adv.activated && adv.side === side) { holdFire(adv); return yes; }
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
        arrivalLegal: arrivalLegal,
        /* Who holds each objective as things stand. The board shows it live,
           between the End phases that actually score it. */
        scoreObjectives: scoreObjectives,
        insertionSpots: insertionSpots,
        arrivalSpots: arrivalSpots,
        markTargets: markTargets,
        targetsFor: targetsFor,
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
