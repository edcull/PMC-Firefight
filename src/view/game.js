/* PMC 2670 — Firefight : turn structure, isometric presentation, console UI and OpFor AI.
   The rules run on a flat 48" x 36" table in inches; PMCIso projects that into the view. */
(function () {
  'use strict';
  var R = window.PMC, ISO = window.PMCIso, C = window.PMCCamp, SC = window.PMCScen;
  var W = R.BOARD.w, H = R.BOARD.h, UR = R.UNIT_R;
  var K = ISO.K;
  var VIEW_W = 900, VIEW_H = 540;                 // the window onto the table, in screen px
  /* The board used to be drawn at one canvas pixel per CSS pixel, whatever the
     screen. A phone has two or three physical pixels to every CSS one, so the
     browser was stretching the whole table 3x and everything on it went soft
     and blocky — far more resolution lost there than anywhere in the art.

     DPR is how many backing pixels the board gets per CSS pixel: the screen's
     own density, capped at 2, which is the resolution asked for and keeps a
     phone's canvas to a sensible size. SS is how finely the working window is
     drawn this frame, in buffer pixels per plate pixel: never less than the
     plate (1), never more than the screen can show (z * DPR), and no more than
     2. Units, effects and rings are drawn at SS; the terrain plate is scaled up
     into it, so it looks exactly as it did. */
  var DPR = 1, SS = 1;
  /* The zoom ladder. ZOOMS[0] is replaced at boot with "the whole table"; these
     are the real magnifications above it, and sizeView() drops any that would
     show less than the table already does. */
  var ZOOM_STEPS = [0.4, 0.55, 0.75, 1, 1.4, 2, 3, 4];
  var ZOOMS = [0.25].concat(ZOOM_STEPS);
  var cam = { x: 0, y: 0, tx: 0, ty: 0, z: 0.5, ox: 0, oy: 0, anim: null, drag: null };
  var anims = [], idleCbs = [], loop = null;
  var SFX = window.SFX;

  var state = null;
  var ui = {
    mode: 'idle', selected: null, targets: [], moves: [], terrain: [], hover: null,
    aiTimer: null, vis: null, visKey: '', resOpen: false, hint: null, insertion: null,
    preview: null, previewVis: null, previewKey: '', deployPick: null, sections: []
  };
  var resQueue = [];
  /* The effects in flight. Created here rather than per battle: it is cleared
     when a new one starts, and it needs the terrain to answer `lift`. */
  var FX = window.PMCFx.create({ lift: function (x, y) { return liftOf(x, y); } });
  var fx = FX.list;
  var el = function (id) { return document.getElementById(id); };

  var OBJECTIVES = [{ x: 12, y: 36 }, { x: 24, y: 24 }, { x: 36, y: 12 }];

  /* ================= where the game actually happens =================

     None of it happens here. engine.js decides everything and rolls every die;
     this file draws the answer. Between them sits a transport: a socket to a
     server for a game against somebody else, or the engine running in this tab
     for a solitaire or hotseat game and for the published single file. Both
     speak the same messages, so there is one path through this code.

     What comes back from an intent is a pair — the events, in the order they
     happened, and the table they left behind. The events are replayed at the
     speed the animations take, which is what makes a shot look like a shot;
     the table is the truth, and the board is drawn from it once the show has
     caught up. */
  var net = null;                 // the transport
  var mirror = null;              // an engine instance holding the battle we are shown
  var Q = null;                   // its queries: everything the board needs to ask
  var seats = ['A'];              // the sides this screen plays; both, in hotseat
  var watching = false;           // true when this screen has no seat at all

  /* The battle as this screen has it. In a local game it is the live object
     the engine is working on; across a network it is the snapshot, rebuilt in
     place each time one arrives. */
  function useEngine(e) {
    mirror = e;
    Q = e.query;
    state = e.state();
  }

  /* Start a battle. Every way into the game — the setup screen, solitaire, a
     campaign contract, a room in the lobby — comes through here. */
  function begin(cfg, opts) {
    opts = opts || {};
    if (window.PMCMenu) window.PMCMenu.close();       // however the battle was reached
    seats = opts.seats || (cfg.mode === 'hotseat' || cfg.mode === 'demo' ? ['A', 'B'] : ['A']);
    watching = false;
    /* Whether the terrain is laid by hand is remembered in this browser. The
       engine is told in the config, because on a server there is no browser to
       remember anything in. */
    if (!cfg.terrainSetup) {
      try { cfg.terrainSetup = localStorage.getItem('pmc-terrainsetup') || undefined; } catch (e) { }
    }
    loadAutoAdvance(cfg.mode);
    resetShow();
    /* A battle started from this screen runs in this tab, whatever was here
       before — somebody who has just come out of a networked game and pressed
       New battle is starting a local one, not sending anything to a server. */
    net = new window.PMCNet.Local();
    wireNet(net);
    net.connect();
    net.begin(cfg, seats);
    return state;
  }

  /* Join a battle already running on a server: the seat is given, the table
     arrives by itself. */
  function joinBattle(transport, seat) {
    net = transport;
    seats = seat ? [seat] : [];
    watching = !seat;
    loadAutoAdvance(null);
    resetShow();
    if (!mirror) useEngine(window.PMCEngine.create());
  }

  /* Whether the OpFor's result cards advance on their own. It is a preference
     about reading, not about the game, so it lives here and is remembered in
     this browser — a hands-off demo starts with it on. */
  function loadAutoAdvance(mode) {
    var stored = null;
    try { stored = localStorage.getItem('pmc-autoadv'); } catch (e) { }
    ui.autoAdvance = stored === null ? mode === 'demo' : stored === '1';
  }

  function resetShow() {
    if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; }
    show.queue.length = 0;
    anims.length = 0;
    FX.clear && FX.clear();
    resQueue.length = 0; ui.resOpen = false;
    var box = el('resolution'); if (box) box.hidden = true;
    clearTimeout(ui.resTimer);
    feedHosts().forEach(function (h) { h.innerHTML = ''; });
    ui.feedUnread = 0;
    ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
    ui.insertion = null; ui.preview = null; ui.deployPick = null;
  }

  /* ---- sending ---- */
  /* Is this screen allowed to act right now? The engine decides for real; this
     is so the board can grey a button out rather than offer a refusal. */
  function mySide() {
    if (!state || watching) return null;
    if (ui.insertion) {
      var s = ui.insertion.unit ? ui.insertion.unit.side : 'A';
      return seats.indexOf(s) >= 0 ? s : null;
    }
    var want = state.phase === 'deploy' ? Q.placingSide()
      : state.phase === 'terrain' ? Q.terrainSide() : state.activeSide;
    return seats.indexOf(want) >= 0 ? want : null;
  }
  function myTurn() { return !!mySide(); }

  function send(intent) {
    if (!net) return false;
    return net.send('intent', { intent: intent });
  }

  /* ---- receiving ---- */
  function wireNet(transport) {
    // a battle running in this tab hands its engine straight over
    transport.on('engine', function (m) { useEngine(m.engine); });
    transport.on('turn', function (m) {
      if (m.live) { state = mirror ? mirror.state() : state; }
      else if (mirror) { state = mirror.load(m.state); }
      show.play(m.events || []);
    });
    transport.on('refused', function (m) {
      /* The engine would not do it. Usually this screen is simply a moment
         behind — the table that comes with the refusal puts it right — so the
         reason is shown where the hint goes rather than as an alarm. */
      window.__lastRefusal = m;
      setHint(null, m.why ? m.why.charAt(0).toUpperCase() + m.why.slice(1) + '.' : 'Not allowed.');
      render();
    });
    transport.on('over', function () { render(); });
    transport.on('finished', function (m) {
      if (window.PMC_ONFINISH) { try { window.PMC_ONFINISH(m.report); } catch (e) { } }
    });
    return transport;
  }

  /* ---- replaying what happened ----
     One event at a time, waiting for the animation each one starts before the
     next goes in. That is the pacing the game has always had: the shot is
     drawn, and only when it lands does the card come up. */
  var show = {
    queue: [],
    running: false,
    play: function (events) {
      this.queue = this.queue.concat(events || []);
      this.pump();
    },
    pump: function () {
      while (show.queue.length) {
        var ev = show.queue[0];
        var waits = SHOWN[ev.e] === 'wait';
        if (waits && busy()) { whenIdle(show.pump); return; }
        show.queue.shift();
        try { applyEvent(ev); }
        catch (e) { if (window.console) console.error('replaying ' + ev.e, e); }
        if (waits) { whenIdle(show.pump); return; }
      }
      show.running = false;
      syncUI();
      render();
      stepWatched();
    }
  };
  // which events start something that takes time, and which land at once
  var SHOWN = {
    move: 'wait', shoot: 'wait', assault: 'wait', strafe: 'wait', arrive: 'wait',
    // the camera settling on the other side's unit is itself worth a moment
    focus: 'wait'
  };
  /* A beat before the other side acts. Their whole turn arrives at once and
     would otherwise start drawing the instant the player's own shot finished,
     which reads as the opponent interrupting rather than answering. */
  var OPPONENT_BEAT = 700;
  function beat(ms) {
    anims.push({ kind: 'beat', dur: ms, t0: nowMs() });
    startLoop();
  }

  /* A battle nobody is playing — a demo, both sides on the behaviour table —
     is walked forward one activation at a time: the engine resolves one, this
     draws it, and only then is the next asked for. Otherwise the whole battle
     would resolve before a single shot was drawn. */
  var stepTimer = null;
  function stepWatched() {
    if (stepTimer || !net || !state || state.over) return;
    if (!state.cfg || state.cfg.aiSides.length !== 2) return;
    if (state.phase !== 'battle' || ui.resOpen) return;
    stepTimer = setTimeout(function () {
      stepTimer = null;
      if (!state || state.over || ui.resOpen) return;
      send({ k: 'step' });
    }, 260);
  }

  function evUnit(id) { return id ? Q.byId(id) : null; }

  function applyEvent(ev) {
    switch (ev.e) {
      case 'log': logLine(ev.t, ev.text, ev.math); return;
      case 'card': pushRes(ev.card); return;
      case 'fx': addFx(reLift(ev.f)); return;
      case 'sound': {
        // a sound the rules asked for, by name; 'suppressed' is an older word for it
        if (!SFX) return;
        var sn = ev.what === 'suppressed' ? 'suppress' : ev.what;
        if (typeof SFX[sn] === 'function') SFX[sn].apply(SFX, ev.args || []);
        return;
      }
      case 'move': {
        var mu = evUnit(ev.id);
        if (mu) animateMove(mu, ev.path, ev.follow);
        return;
      }
      case 'shoot': {
        var sa = evUnit(ev.from), sb = evUnit(ev.to);
        if (sa && sb) playShooting(sa, sb, ev.res || { hits: 0 }, deathsOf(ev.deaths), null);
        return;
      }
      case 'assault': {
        var aa = evUnit(ev.from), ab = evUnit(ev.to);
        if (aa && ab) playAssault(aa, ab, deathsOf(ev.deaths), null);
        return;
      }
      case 'strafe': {
        var su = evUnit(ev.id);
        if (su) playStrafe(su, ev.from, ev.to, deathsOf(ev.deaths), null);
        return;
      }
      case 'arrive': {
        var au = evUnit(ev.id);
        if (!au) return;
        if (ev.how === 'drop') landUnit(au);
        else if (ev.how === 'orbital') landUnit(au, true);
        else if (ev.how === 'stepoff') stepOff(au, evUnit(ev.veh));
        else if (ev.how === 'board') boardAnim(au, evUnit(ev.veh) || au, ev.from);
        else walkOn(au, ev.from);
        return;
      }
      case 'focus': {
        var fu = evUnit(ev.id);
        if (!fu) return;
        focusUnit(fu, false, !myTurn());
        if (seats.indexOf(fu.side) < 0) beat(OPPONENT_BEAT);
        return;
      }
      case 'hint': setHint(null, ev.text || undefined); return;
      case 'colour': ISO.setSideColour(ev.side, ev.key); return;
      case 'terrain': {
        var pieces = (ev.pieces || []).map(function (i) { return { piece: state.terrain[i] }; })
          .filter(function (w) { return !!w.piece; });
        repaintTerrain(pieces);
        return;
      }
      case 'newtable': newTable(ev.whole); return;
      case 'scenery': queueBake(); return;
      case 'fit': fitView(); return;
      case 'structures': if (state.structs) paintStructures(); return;
      case 'clearcards': resetShow(); return;
      case 'look': lookAtDeployment(ev.side); return;
      default: return;
    }
  }

  /* An effect the engine described without knowing how high anything is drawn.
     A flier's height is a matter for the view, so it is filled in here. */
  function reLift(f) {
    if (!f || f.up !== 0 || !f.unit) return f;
    var u = evUnit(f.unit);
    if (u) f.up = ISO.flyLift(u);
    return f;
  }
  function deathsOf(list) {
    return (list || []).map(function (d) {
      var u = evUnit(d.id);
      return u ? { u: u, x: d.x, y: d.y } : null;
    }).filter(Boolean);
  }

  /* The selection, the shaded ground and the prompts all belong to the battle
     rather than to either screen, so they arrive with it. */
  function syncUI() {
    if (!state) return;
    var s = mirror.sel();
    ui.mode = s.mode;
    ui.selected = s.selected;
    ui.targets = s.targets;
    ui.moves = s.moves;
    ui.terrain = s.terrain;
    ui.markKind = s.markKind;
    ui.markPicks = s.markPicks;
    ui.deployPick = s.deployPick;
    ui.insertion = s.insertion;
    ui.sections = s.sections || [];
    ui.tsetHint = s.tsetHint || '';
    ui.vis = null; ui.visKey = '';
    ui.preview = null;
  }

  /* ---- asking the engine ----
     The board has to know a great deal about the battle to draw it: who may
     act, what a unit could do, where it could go, which ground is whose. None
     of it rolls a die or changes anything, so the same code answers whether
     the battle is running here or on a server — it is asked of the engine
     holding the table this screen is looking at. The names are the ones the
     drawing code has always used. */
  function isAI(side) { return Q.isAI(side); }
  function actionState(u, id) { return Q.actionState(u, id); }
  function specialsFor(u) { return Q.specialsFor(u); }
  function targetsFor(u, o) { return Q.targetsFor(u, o); }
  function eligible(side) { return Q.eligible(side); }
  function activeUnits(side) { return Q.activeUnits(side); }
  function onTable(u) { return Q.onTable(u); }
  function byId(id) { return Q.byId(id); }
  function unitById(id) { return Q.unitById(id); }
  function sideName(s) { return Q.sideName(s); }
  function other(s) { return Q.other(s); }
  /* Which side this screen is sitting in. With a seat of its own that is the
     seat, whoever else is playing; sharing a screen, or watching, there is no
     "you" and the engine's answer stands. */
  function playerSide() { return seats.length === 1 ? seats[0] : Q.playerSide(); }
  function roleOf(side) { return Q.roleOf(side); }
  function roleSentence() { return Q.roleSentence(); }
  function deployWhere(side) { return Q.deployWhere(side); }
  function deployNext() { return Q.deployNext(); }
  function deployRoster(side) { return Q.deployRoster(side); }
  function deploymentDone() { return Q.deploymentDone(); }
  function deployOK(side, x, y, u) { return Q.deployOK(side, x, y, u); }
  function placingSide() { return Q.placingSide(); }
  function zoneFor(side) { return Q.zoneFor(side); }
  function zoneCentre(side) { return Q.zoneCentre(side); }
  function boxesFor(side) { return Q.boxesFor(side); }
  function nearestDeploySpot(u, x, y, pull) { return Q.nearestDeploySpot(u, x, y, pull); }
  function insertionSpots(u) { return Q.insertionSpots(u); }
  function insertionLegal(p) { return Q.insertionLegal(p); }
  function arrivalSpots(u) { return Q.arrivalSpots(u); }
  function arrivalLegal(u, p) { return Q.arrivalLegal(u, p); }
  function arrivalWhere(u) { return Q.arrivalWhere(u); }
  function inReserve(side) { return Q.inReserve(side); }
  function emptyPlatforms(side) { return Q.emptyPlatforms(side); }
  function carriersFor(side) { return Q.carriersFor(side); }
  function boardableFor(v) { return Q.boardableFor(v); }
  function moveBonus(u, a) { return Q.moveBonus(u, a); }
  function markReach(u) { return Q.markReach(u); }
  function markHint(u) { return Q.markHint(u); }
  function demolishTargets(u, m) { return Q.demolishTargets(u, m); }
  function breachTargets(u) { return Q.breachTargets(u); }
  function forcedCharge(u) { return Q.forcedCharge(u); }
  function canStand(u, c) { return Q.canStand(u, c); }
  function soloOwnerName(o) { return Q.soloOwnerName(o); }
  function bestTarget(u, mode, opts) { return Q.bestTarget(u, mode, opts); }
  function gapToFoes(u) { return Q.gapToFoes(u); }
  function fromLog(kind, title, side, entries) { return Q.fromLog(kind, title, side, entries); }
  function snapToSpot(ins, p) { return Q.snapToSpot(ins, p); }
  function scoreObjectives() { return Q.scoreObjectives(); }
  function curArea() { return Q.curArea(); }
  function fitGhost(a, x, y) { return Q.fitGhost(a, x, y); }
  function clonePiece(p) { return Q.clonePiece(p); }
  function pieceNoun(spec, n) { return Q.pieceNoun(spec, n); }
  function specRange(spec) { return Q.specRange(spec); }
  function placedSummary(a) { return Q.placedSummary(a); }
  function garrisonAt(x, y) { return Q.garrisonAt(x, y); }
  function garrisonable(u) { return Q.garrisonable(u); }
  function sfName(u) { return Q.sfName(u); }

  /* ---- what a tap means ----
     Every one of these used to change the table on the spot. Now each is a
     sentence sent to the engine — "shoot that", "go there" — and the table
     comes back changed. The names are unchanged so the code that wires up the
     buttons and the board reads as it did. */
  function chooseAction(id) {
    if (ui.mode === id || (ui.mode === 'advance-move' && id === 'advance')) {
      send({ k: 'cancel' }); return;          // pressing it again puts it away
    }
    send({ k: 'action', id: id });
  }
  function select(u) {
    if (!u) return;
    /* On a phone the panel is one slice of screen: picking a unit is a request
       to act with it, so the panel comes back to the actions. */
    if (window.innerWidth <= 1000) setMTab('act');
    dropFollow();
    ensureVisible(u);
    if (cam.borrowed) setHome(cam.x, cam.y);     // the player is driving again
    send({ k: 'select', id: u.id });
    revealConsole();
  }
  function doShoot(t) { send({ k: 'target', id: t.id }); }
  function doAssault(t) { send({ k: 'target', id: t.id }); }
  function doDesignate(t) { send({ k: 'target', id: t.id }); }
  function doHack(t) { send({ k: 'target', id: t.id }); }
  function doSupport(t) { send({ k: 'target', id: t.id }); }
  function doEmbark(t) { send({ k: 'target', id: t.id }); }
  function doTeleport(tp, t) { send({ k: 'target', id: t.id }); }
  function finishTeleport(tp, t) { send({ k: 'target', id: t.id }); }
  function doMove(pt) { send({ k: 'move', x: pt.x, y: pt.y }); }
  function doMarkMove(pt) { send({ k: 'markmove', x: pt.x, y: pt.y }); }
  function doWave(u, pt) { send({ k: 'wave', x: pt.x, y: pt.y }); }
  function doDisembark(pt) { send({ k: 'disembark', x: pt.x, y: pt.y }); }
  function doStrafe(pt) { send({ k: 'strafe', x: pt.x, y: pt.y }); }
  function doDemolish(piece) { send({ k: 'piece', i: state.terrain.indexOf(piece) }); }
  function doBreach(piece) { send({ k: 'piece', i: state.terrain.indexOf(piece) }); }
  function pickToDeploy(id) {
    var u = byId(id);
    if (u) { if (u.x >= 0) ensureVisible(u); else lookAtDeployment(u.side); }
    send({ k: 'deploypick', id: id });
  }
  function autoDeploy(side) { send({ k: 'autodeploy', side: side }); }
  /* "Put the rest down for me". In hotseat this screen holds both sides, so
     it asks once for each in turn; across a network it can only ever fill its
     own half of the table, and the engine says so if it tries otherwise. */
  function autoDeployMine() { seats.forEach(function () { autoDeploy(); }); }
  function startBattle() { send({ k: 'start' }); }
  function loadBefore(veh, u) { send({ k: 'load', hull: veh.id, unit: u.id }); }
  function unloadBefore(veh, u) { send({ k: 'unload', hull: veh.id, unit: u.id }); }
  function holdInsertion() { send({ k: 'holdinsert' }); }
  function holdArrival() { send({ k: 'holdarrive' }); }
  function doSteady(t) { send({ k: 'target', id: t.id }); }
  // a building, and which section of it
  function doEnter(u, s) { send({ k: 'enter', piece: state.terrain.indexOf(s.piece), sec: s.sec || 0 }); }
  function doExitBld(u, spot) { send({ k: 'exitbld', x: spot.x, y: spot.y }); }
  // laying the terrain: a piece put down where the tap was, or a step on the card
  function terrainTap(p) { send({ k: 'terraintap', x: p.x, y: p.y }); }
  function terrainAct(act, arg) { send({ k: 'terrain', act: act, arg: arg }); }
  // Rapid Relocation: pick a unit up, then put it down again
  function relocPick(id) { send({ k: 'relocpick', id: id }); }
  function relocTap(p) { send({ k: 'reloctap', x: p.x, y: p.y }); }
  /* A drop point is snapped here rather than on the far side: how close a tap
     has to be depends on how far the table is zoomed out, which only this
     screen knows. The engine checks what arrives regardless. */
  function placeInsertion(p) {
    var ins = ui.insertion;
    if (!ins) return;
    var near = snapToSpot({ spots: ins.spots }, p) || nearestByReach(ins.spots, p);
    send({ k: 'insert', x: (near || p).x, y: (near || p).y });
  }
  function nearestByReach(spots, p) {
    var reach = snapReach(), best = null, bd = Infinity;
    (spots || []).forEach(function (s) {
      var d = R.inches(p.x, p.y, s.x, s.y);
      if (d < bd) { bd = d; best = s; }
    });
    return bd <= reach ? best : null;
  }

  /* A fresh table: fit the camera to ground nobody has seen yet. The terrain
     set-up asks for the whole table, since all four areas are about to be laid;
     otherwise it opens on the ground the first side deploys into. */
  function newTable(whole) {
    state.scene = null; state.ground = null; state.structs = null;
    sizeView(false);
    if (whole) {
      cam.z = ZOOMS[0];
      zoomLabel();
      var mid = ISO.toScreen(W / 2, H / 2);
      cam.x = cam.tx = mid.x; cam.y = cam.ty = mid.y;
      clampCam();
    } else {
      cam.z = ZOOMS[Math.min(ZOOMS.length - 1, window.innerWidth <= 1000 ? 1 : 2)] || ZOOMS[0];
      zoomLabel();
      lookAtDeployment();
    }
    setHome(cam.x, cam.y);
    render();
    if (whole) setTimeout(revealConsole, 60);
  }

  /* ================= terrain set-up (pp. 46-47) =================
     "Divide the table into areas 2'x2'. Starting from a random player, the
     players alternately roll 1D6 for each area, placing the rolled terrain in it
     ... any number of terrain pieces up to the number indicated in the rolled
     column on the chosen area in any way he/she wishes." The four areas are
     taken in turn; the OpFor lays its own at once, a player taps theirs down one
     piece at a time. Once the table is set, the scenario randomises the table
     edges if it has them — so nobody knows which end is theirs while placing. */
  // what each kind of piece is called — the engine's list, so the two never differ
  var PIECE_NOUN = window.PMCEngine.PIECE_NOUN;
  /* Baking the table takes the best part of a second, so it is not done for
     every piece: a piece that has just gone down is drawn as a flat footprint
     at once, and the table is re-baked a moment after the player stops. The
     old plate stays on screen while it bakes — no black flash. */
  function queueBake() {
    if (!state || state.phase !== 'terrain') { if (state) { state.scene = null; state.ground = null; state.structs = null; } return; }
    clearTimeout(ui.bakeTimer);
    ui.bakeTimer = setTimeout(function () {
      if (!state || state.phase !== 'terrain' || !state.scene) return;
      buildScene();
      state.tset.baked = state.terrain.length;
      drawBoard();
    }, 650);
  }
  function terrainCard() {
    var ts = state.tset, a = curArea();
    var h = '<div class="card"><h2>Terrain set-up</h2>' +
      '<p class="sub">' + esc(ts.gen.name) + '. The table is four 2′ × 2′ areas; ' +
      (state.solo ? 'you roll a D6 for each' : 'the players take turns to roll a D6 for each') +
      ' and place up to what it gives, anywhere in that area (pp. 46–47).' +
      (state.scen && state.scen.edges ? ' Table edges are rolled once the table is set.' : '') + '</p>';
    /* The area being laid belongs to one side. Its player gets the choices and
       the buttons; anyone else — the opponent across a network — sees the same
       pieces and whose turn it is, and waits. */
    var mine = a && !isAI(a.side) && seats.indexOf(a.side) >= 0;
    if (a && !isAI(a.side) && !mine) {
      h += '<p class="hint"><b>' + a.name + ' — ' + esc(sideName(a.side)) + '’s roll: ' + a.roll + '.</b> ' + esc(a.row.text) + '.</p>' +
        (a.alt === null ? '<p class="sub">Waiting for them to choose.</p>' : terrainPreview(a) + '<p class="sub">Waiting for them to lay it.</p>');
    }
    if (mine) {
      h += '<p class="hint"><b>' + a.name + ' — ' + (state.solo ? 'your' : esc(sideName(a.side)) + '’s') + ' roll: ' +
        (a.first ? a.first + ', re-rolled ' : '') + a.roll + '.</b> ' + esc(a.row.text) + '.</p>';
      if (a.alt === null) {
        h += '<p class="sub">The result gives a choice — which will it be?</p><div class="acts">' +
          a.row.alts.map(function (alt, n) {
            return '<button class="act" data-act="talt" data-alt="' + n + '"><span>' +
              alt.map(specRange).join(' and ') + '</span></button>';
          }).join('') + '</div>';
      } else {
        var alt = a.row.alts[a.alt], spec = alt[a.spec], cnt = a.count[a.spec] || 0;
        var more = alt[a.spec + 1];
        h += '<p class="sub">Tap inside the lit area to put down <b>' + pieceNoun(spec, 1) + ' ' + (cnt + 1) + '</b> of up to ' + spec.max +
          (cnt < spec.min ? ' — at least ' + spec.min + ' must go down' : '') + '. The piece lands as close to the tap as it fits.</p>';
        if (ui.tsetHint) h += '<p class="cpwarn">' + esc(ui.tsetHint) + '</p>';
        // everything this result still has to put down, drawn; the next one outlined
        h += terrainPreview(a);
        h += '<div class="acts">';
        h += '<button class="act" data-act="trotate"><span>Turn it</span><small>A quarter turn · R or right click</small></button>';
        if (cnt >= spec.min) h += '<button class="act primary" data-act="tnext"><span>' +
          (more ? 'On to the ' + pieceNoun(more, 2) : 'Done with the ' + a.name + ' area') + '</span><small>' +
          cnt + ' ' + pieceNoun(spec, cnt) + ' placed</small></button>';
        h += '</div>';
      }
      h += '<div class="acts"><button class="act" data-act="tauto"><span>Auto-place this area</span></button>' +
        '<button class="act" data-act="tautoall"><span>Auto-place the rest</span><small>Every area left, both sides</small></button></div>';
    }
    h += '<ul class="tset">' + ts.areas.map(function (ar, n) {
      var st = n < ts.i ? (ar.placed.length ? placedSummary(ar) : 'left open')
        : n === ts.i ? 'placing now' : 'to come';
      return '<li class="' + (n === ts.i ? 'now' : n < ts.i ? 'done' : '') + '"><b>' + ar.name + '</b> · ' +
        esc(sideName(ar.side)) + (ar.roll ? ' · D6 ' + ar.roll : '') + ' — ' + st + '</li>';
    }).join('') + '</ul>';
    return h + '</div>';
  }

  /* ---------- the pieces still to come, drawn ----------
     Every piece this area's result will put down, in the order they go, drawn
     with the table's own art — the ground painted under the hills and pools,
     the buildings, walls, rocks and trees stood on it — so a player sees what
     they are about to lay rather than a list of names. The one in hand is
     outlined. The board still shows only an outline under the pointer; this is
     the picture of the set.

     Painting ground is slow, so it is done a moment after the card is shown,
     over just the patch the pieces stand on, and kept until the pieces or the
     way one is turned change. The last picture stays up while the next one is
     drawn. */
  var tprev = { key: '', url: '', wanting: '' };

  function stillToCome(a) {
    var list = [];
    if (!a || a.alt === null || !a.pieces) return list;
    a.pieces.forEach(function (row, si) {
      if (si < a.spec) return;
      var from = si === a.spec ? (a.count[si] || 0) : 0;
      row.slice(from).forEach(function (p, k) { list.push({ p: p, next: si === a.spec && k === 0 }); });
    });
    return list;
  }

  function terrainPreview(a) {
    var list = stillToCome(a);
    if (!list.length) return '';
    var key = state.cfg.planet + '|' + JSON.stringify(list.map(function (q) {
      return [q.p.kind, q.p.big, q.p.w, q.p.h, q.p.poly, q.p.parts, q.p.top, q.next];
    }));
    if (key !== tprev.key && key !== tprev.wanting) {
      tprev.wanting = key;
      setTimeout(function () { drawPreview(key, list); }, 40);
    }
    var label = list.length + ' piece' + (list.length === 1 ? '' : 's') + ' to lay, the next one outlined';
    return tprev.url
      ? '<img class="tprev" src="' + tprev.url + '" alt="' + label + '" title="' + label + '" style="display:block;width:100%;' +
        'max-width:360px;margin:8px 0 6px;border-radius:6px;background:#0b0f15">'
      : '<div class="tprev" style="margin:8px 0 6px;padding:18px 0;text-align:center;border-radius:6px;background:#0b0f15;' +
        'font-size:12px;opacity:.7">Drawing the pieces…</div>';
  }

  function drawPreview(key, list) {
    if (key !== tprev.wanting) return;             // a newer set has been asked for since
    try {
      /* Lay them out in rows that run straight across the screen. On this
         projection that is along x, back along y: a step of d in x and -d in
         y moves a piece sideways on screen and not up or down. */
      var laid = [], GAP = 1.2, ROW = 26;
      var rows = [[]], rowLen = 0;
      list.forEach(function (q) {
        var span = (q.p.w + q.p.h) / 2 + GAP;
        if (rows[rows.length - 1].length && rowLen + span > ROW) { rows.push([]); rowLen = 0; }
        rows[rows.length - 1].push(q); rowLen += span;
      });
      // the rows stacked back from the middle of the table, the whole block centred on it
      var deeps = rows.map(function (row) { return row.reduce(function (m, q) { return Math.max(m, Math.max(q.p.w, q.p.h)); }, 0); });
      var stack = deeps.reduce(function (s3, d3) { return s3 + d3 / 2 + GAP * 2; }, 0);
      var depth = -stack / 2;
      rows.forEach(function (row) {
        var total = row.reduce(function (s2, q) { return s2 + (q.p.w + q.p.h) / 2 + GAP; }, -GAP);
        var t = -total / 2, deep = 0;
        row.forEach(function (q) {
          var p = JSON.parse(JSON.stringify(q.p));
          var half = (p.w + p.h) / 4;
          var cx = W / 2 + depth + (t + half), cy = H / 2 + depth - (t + half);
          R.placePiece(p, cx - p.w / 2, cy - p.h / 2, p.w, p.h);
          laid.push({ p: p, next: q.next });
          t += half * 2 + GAP;
          deep = Math.max(deep, Math.max(p.w, p.h));
        });
        depth += deep / 2 + GAP * 2;
      });
      var terrain = laid.map(function (q) { return q.p; });

      // the patch of plate they stand on, with room above for roofs and treetops
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      terrain.forEach(function (p) {
        [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]].forEach(function (c) {
          var sp = ISO.toScreen(c[0], c[1]);
          x0 = Math.min(x0, sp.x); x1 = Math.max(x1, sp.x); y0 = Math.min(y0, sp.y); y1 = Math.max(y1, sp.y);
        });
      });
      var clip = { x0: x0 - K * 1.2, x1: x1 + K * 1.2, y0: y0 - K * 4.5, y1: y1 + K * 1.2 };
      var seed = 7919;
      var ground = ISO.bakeGround(terrain, seed, state.cfg.planet, clip);
      var props = ISO.buildProps(terrain, [], seed, state.cfg.planet);

      var cw = Math.round(clip.x1 - clip.x0), chh = Math.round(clip.y1 - clip.y0);
      var cv = document.createElement('canvas');
      cv.width = cw; cv.height = chh;
      var g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#0b0f15'; g.fillRect(0, 0, cw, chh);
      g.drawImage(ground, clip.x0, clip.y0, cw, chh, 0, 0, cw, chh);
      g.save();
      g.translate(-clip.x0, -clip.y0);
      // the piece in hand: its footprint outlined on the ground, under anything standing on it
      laid.forEach(function (q) {
        if (!q.next) return;
        var p = q.p;
        var shapes = p.parts ? p.parts.map(function (r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })
          : [p.poly || [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]]];
        shapes.forEach(function (pts) {
          g.beginPath();
          pts.forEach(function (c, n) { var sp = ISO.toScreen(c[0], c[1]); if (n) g.lineTo(sp.x, sp.y); else g.moveTo(sp.x, sp.y); });
          g.closePath();
          g.lineWidth = 5; g.strokeStyle = 'rgba(8,10,14,.55)'; g.stroke();
          g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
        });
      });
      props.forEach(function (pr) { ISO.drawProp(g, pr, 0); });
      g.restore();

      // down to the card's size, smoothed: this is a reduction, not a zoom
      var MAXW = 720, k2 = Math.min(1, MAXW / cw);
      var out = document.createElement('canvas');
      out.width = Math.round(cw * k2); out.height = Math.round(chh * k2);
      var og = out.getContext('2d');
      og.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in og) og.imageSmoothingQuality = 'high';
      og.drawImage(cv, 0, 0, out.width, out.height);
      if (!out.toDataURL) return;                   // no real canvas (the headless test page)
      if (key !== tprev.wanting) return;
      tprev.key = key; tprev.url = out.toDataURL('image/png');
      render();
    } catch (e) {
      // a picture that cannot be drawn is not worth stopping the set-up for
      if (window.console) console.error('terrain preview', e);
    }
  }

  function lookAtDeployment(forSide) {
    var side = forSide || placingSide();
    var at = side ? zoneCentre(side) : { x: W / 2, y: H / 2 };
    var mid = ISO.toScreen(at.x, at.y);
    cam.x = cam.tx = mid.x; cam.y = cam.ty = mid.y;
    clampCam();
  }

  // on a phone the panels sit below the table; make sure the table comes back into view
  function revealBoard() {
    if (window.innerWidth > 1000) return;
    var b = document.querySelector('.board-wrap');
    if (!b) return;
    var r = b.getBoundingClientRect();
    if (r.top >= -12 && r.top < window.innerHeight * 0.4) return;
    try { b.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    catch (e) { b.scrollIntoView(); }
  }

  /* ================= coming down ==================
     A Battlefield Insertion is not a unit blinking into existence. A craft drops
     out of the sky onto its landing point and throws up the dust it lands in; a
     squad is already on the ground when you see it, and comes up out of cover —
     which the game already has a way of drawing, because a unit flat on its face
     is a broken one. So an arriving squad is drawn broken, then suppressed, then
     standing, over about a second. It is only how it is drawn: the unit's real
     status, and everything the rules ask of it, is untouched. */
  var DROP_MS = 900;          // how long a craft is falling
  var STAND_MS = 1150;        // how long a squad takes to get up

  function arriving(u) {
    if (!u || !u.arriveAt) return { lift: 0, status: null };
    var age = nowMs() - u.arriveAt;
    if (u.arriveKind === 'drop') {
      if (age >= DROP_MS) { u.arriveAt = 0; u.dropFrom = null; return { lift: 0, status: null }; }
      var k = age / DROP_MS;
      // gathering speed the whole way down, so it arrives hard rather than drifting in
      var eased = 1 - Math.pow(1 - k, 0.45);
      var fromUp = u.dropFrom != null ? u.dropFrom : ISO.ELEV * 5.5;
      return { lift: Math.round(fromUp * (1 - eased)), status: null };
    }
    if (age >= STAND_MS) { u.arriveAt = 0; return { lift: 0, status: null }; }
    // flat on its face, then up on one knee, then standing
    return { lift: 0, status: age < STAND_MS * 0.38 ? 'broken' : age < STAND_MS * 0.74 ? 'suppressed' : null };
  }
  function anyArriving() {
    /* An arrival ends by the clock, drawn or not: a unit that came up off screen
       used to hold the whole game waiting for a frame that never drew it. */
    return state && state.units.some(function (u) {
      if (!u.arriveAt) return false;
      var span = u.arriveKind === 'drop' ? DROP_MS : STAND_MS;
      if (nowMs() - u.arriveAt >= span) { u.arriveAt = 0; u.dropFrom = null; return false; }
      return true;
    });
  }

  /* Troops stepping off a hull are not set down on the ground fully formed
     either — least of all out of a drop platform that has just come in hard. A
     disembarking squad comes up the same way an inserted one does, a beat
     quicker, because it only has to get clear of the ramp. */
  function stepOff(u, veh) {
    if (!u || !u.alive || R.isMachine(u)) return;
    var from = veh ? { x: veh.x, y: veh.y } : null;
    if (veh && veh.cls === 'aircraft') {
      /* Out of an aircraft the squad comes down from the airframe itself: from
         the craft's own height, sliding out from under it to where it lands. */
      u.arriveAt = nowMs();
      u.arriveKind = 'drop';
      u.dropFrom = ISO.flyLift(veh) || ISO.ELEV * 4;
      if (from) animateMove(u, [from, { x: u.x, y: u.y }], false);
      setTimeout(function () {
        if (!state || !u.alive) return;
        addFx({ kind: 'collapse', x: u.x, y: u.y, r: 1.4, dur: 480, blocking: true });
        if (SFX) { SFX.step(); SFX.step(0.12); }
      }, DROP_MS - 60);
      addFx({ kind: 'hold', x: u.x, y: u.y, dur: DROP_MS + 200, blocking: true });
      return;
    }
    // off a ground hull the squad walks out of the back of it to where it was put
    if (from) { animateMove(u, [from, { x: u.x, y: u.y }], false); return; }
    u.arriveAt = nowMs();
    u.arriveKind = 'stand';
    addFx({ kind: 'collapse', x: u.x, y: u.y, r: 1.2, dur: 480, blocking: true });
    addFx({ kind: 'hold', x: u.x, y: u.y, dur: STAND_MS, blocking: true });
  }
  /* Boarding: the squad is aboard as far as the rules go at once, but it is
     drawn walking from where it stood to the hull — or, for an aircraft, up
     into it — before it vanishes inside. */
  function boardAnim(u, veh, from) {
    if (!u || !from) return;
    var dist = R.inches(from.x, from.y, veh.x, veh.y);
    u.boarding = { a: from, b: { x: veh.x, y: veh.y }, t0: nowMs(), dur: Math.min(1100, 320 + dist * 90),
      up: veh.cls === 'aircraft' ? (ISO.flyLift(veh) || 0) : 0 };
    u.faceL = veh.x < from.x - ISO.K * 0.3 ? true : veh.x > from.x + ISO.K * 0.3 ? false : u.faceL;
    addFx({ kind: 'hold', x: veh.x, y: veh.y, dur: u.boarding.dur + 60, blocking: true });
  }

  /* How a scenario reinforcement is shown coming on. The Invasion attacker is
     coming down from orbit, so it lands the way a Battlefield Insertion does;
     everyone else is walking or driving on from a table edge, so it is shown
     doing exactly that — from the nearest edge in to where it was put. */
  function showArrival(u) {
    if (state.scen.id === 'invasion' && state.sc && u.side === state.sc.attacker) { landUnit(u); return; }
    // a solitaire scenario: a drop into a landing zone, or a walk in from where the unit came out
    var how = state.scen.arriveHow ? state.scen.arriveHow(state, u) : null;
    if (how === 'drop') { landUnit(u); return; }
    walkOn(u, how && how.x != null ? how : null);
  }
  function walkOn(u, start) {
    var dl = u.x, dr = W - u.x, dt = u.y, db = H - u.y, m = Math.min(dl, dr, dt, db);
    var from = start ? { x: start.x, y: start.y } : m === dl ? { x: 0.2, y: u.y } : m === dr ? { x: W - 0.2, y: u.y }
      : m === dt ? { x: u.x, y: 0.2 } : { x: u.x, y: H - 0.2 };
    focusUnit(u, false, true);
    animateMove(u, [from, { x: u.x, y: u.y }], false);
    /* Arriving within 12" of the enemy invites a free shot (p. 30). The engine
       has already fired it and sent the result along behind this arrival. */
    render();
  }

  function landUnit(u, fromOrbit) {
    focusUnit(u, false, true);
    /* A hull comes down on its landing point, and so do jump troops on their
       jets. A squad landing by Battlefield Insertion is shown getting up off
       the ground it came down on — except out of orbit in an Invasion, where
       it falls out of the sky like everything else that side lands. */
    var craft = !!fromOrbit || R.isMachine(u) || !!u.jets;
    u.arriveAt = nowMs();
    u.arriveKind = craft ? 'drop' : 'stand';
    if (craft) {
      // the dust it throws up as it touches down, and the shockwave after it
      addFx({ kind: 'dropmark', x: u.x, y: u.y, dur: DROP_MS, blocking: true });
      setTimeout(function () {
        if (!state || !u.alive) return;
        addFx({ kind: 'collapse', x: u.x, y: u.y, r: 2.4, dur: 700, blocking: true });
        if (SFX) { SFX.impact(); SFX.impact(0.09); }
        render();
      }, DROP_MS - 60);
    } else {
      addFx({ kind: 'collapse', x: u.x, y: u.y, r: 1.6, dur: 600, blocking: true });
      // boots, then the squad on its feet
      if (SFX) { SFX.step(); SFX.step(0.24); SFX.step(0.5); }
    }
    // keep the frame loop turning while the arrival plays out
    addFx({ kind: 'hold', x: u.x, y: u.y, dur: craft ? DROP_MS + 300 : STAND_MS, blocking: true });
    render();
  }

  function insertionCard() {
    var ins = ui.insertion;
    if (!ins) return '';
    var u = ins.unit;
    if (ins.kind === 'lz') {
      return '<div class="card"><h2>Landing zone</h2>' +
        '<p class="sub">' + (state.solo && state.solo.coop ? '<b>' + esc(soloOwnerName(ins.owner)) + '</b>: n' : 'N') +
        'ominate the landing zone your commando drops into — an 8″ circle of open ground, no closer than 12″ to any table edge' +
        (state.solo && state.solo.coop ? ', and 18″ from the other player\u2019s' : '') +
        '. Every unit (except vehicles) takes D3 SP as it lands.</p>' +
        '<p class="hint">Tap the shaded ground.</p></div>';
    }
    /* Two things ask the same way: a Battlefield Insertion, which may come down
       almost anywhere and can be held back, and a scenario reinforcement, which
       is coming on whether you like it or not but still lets you choose where
       along its landing zone or table edge. */
    if (ins.kind === 'arrive' && u.sfOffer) {
      return '<div class="card"><h2>Semper Fidelis</h2>' +
        '<p class="sub"><b>' + esc(sfName(u)) + '</b> may come on now without waiting for its roll. Tap the shaded ground ' +
        'to bring it on — ' + esc(arrivalWhere(u)) + ' — or keep it back for a later turn.</p>' +
        '<p class="hint">' + ins.spots.length + ' place' + (ins.spots.length === 1 ? '' : 's') + ' it can come on.</p>' +
        '<div class="acts"><button class="act" data-act="holdarrive">' +
        '<span>Keep it in reserve</span><small>Call it in on a later turn</small></button></div></div>';
    }
    if (ins.kind === 'arrive') {
      return '<div class="card"><h2>Reinforcements</h2>' +
        '<p class="sub"><b>' + esc(u.name) + '</b> is arriving this turn. Tap the shaded ground ' +
        'to choose where it comes on — ' + esc(arrivalWhere(u)) + '.</p>' +
        '<p class="hint">' + ins.spots.length + ' place' + (ins.spots.length === 1 ? '' : 's') +
        ' it can come on.</p></div>';
    }
    return '<div class="card"><h2>Battlefield Insertion</h2>' +
      '<p class="sub"><b>' + esc(u.name) + '</b> is coming in. Tap anywhere in the shaded ground: ' +
      'at least 12" from every objective and 4" in from the table edge. On a D6 of 4+ your opponent ' +
      'will shove the arrival point up to 2D6" (p. 56).</p>' +
      '<p class="hint">' + ins.spots.length + ' legal drop point' + (ins.spots.length === 1 ? '' : 's') + ' on the table.</p>' +
      '<div class="acts"><button class="act" data-act="holdinsert">' +
      '<span>Keep it in reserve</span><small>Try again next turn</small></button></div></div>';
  }

  /* A tap is a finger, not a pixel. The ground a reinforcement may come on is
     often a band an inch or two wide down one edge of the table — thinner, at
     any sensible zoom, than the fingertip aiming at it. Demanding an exact hit
     meant the only way to place a unit was to zoom all the way in.

     So the tap is snapped to the nearest legal spot it could plausibly have
     meant. Placing a unit at deployment already forgives a near miss by nine
     inches; this is the same idea, with the fingertip's own width added on when
     the table is zoomed out far enough for that to be the larger of the two. */
  var SNAP_NEAR = 6;              // inches of forgiveness, whatever the zoom
  function snapReach() {
    // 54 buffer pixels is about a fingertip; K of them is one inch at zoom 1
    return Math.max(SNAP_NEAR, (54 / Math.max(0.2, cam.z)) / ISO.K);
  }

  /* ================= actions ================= */
  var ICONS = {
    enter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-5 8 5v12z"/><path d="M10 21v-6h4v6"/><path d="M2 14h6M6 12l2 2-2 2"/></svg>',
    exitbld: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-5 8 5v12z"/><path d="M10 21v-6h4v6"/><path d="M16 14h6M20 12l2 2-2 2"/></svg>',
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/><path d="M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    advance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h7l4-9"/><path d="M14 8h6v6"/><circle cx="18.5" cy="17" r="2.2"/></svg>',
    assault: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L15 9M9 4l11 11"/><path d="M4 20l1-4 3 3zM20 20l-4-1 3-3z"/></svg>',
    aux: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="6.5" stroke-dasharray="3 3"/><path d="M12 6v3M12 15v3M6 12h3M15 12h3"/></svg>',
    regroup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
    designate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l7 8-7 8-7-8z"/><circle cx="12" cy="12" r="2"/><path d="M12 1v2M12 21v2"/></svg>',
    coordinate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="M10.4 10.4L6.4 7.4M13.6 10.4l4-3M12 14.4V18"/></svg>',
    embark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="13" height="7" rx="1.5"/><circle cx="6.5" cy="19" r="1.6"/><circle cx="13" cy="19" r="1.6"/><path d="M20 4v7M20 11l-2.5-2.5M20 11l2.5-2.5"/></svg>',
    disembark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="13" height="7" rx="1.5"/><circle cx="6.5" cy="19" r="1.6"/><circle cx="13" cy="19" r="1.6"/><path d="M20 11V4M20 4l-2.5 2.5M20 4l2.5 2.5"/></svg>',
    strafe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h13l4 2-4 2H2z"/><path d="M9 12v4M13 12v4M5 12v4"/></svg>',
    support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="12" height="6" rx="1.5"/><circle cx="6.5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><path d="M15 10l6-4M17 5l4 1-1 4"/></svg>',
    hack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="10" rx="2"/><path d="M8 11l2 1-2 1M12.5 14h3"/><path d="M12 3v4M9 3h6"/></svg>',
    demolish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20v-6h5v6M12 20v-9h4v9"/><path d="M17 4l3 3-3 3"/><path d="M20 7h-6"/></svg>',
    breach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20V9h6v11"/><path d="M14 20v-5h5v5"/><circle cx="16.5" cy="7" r="2.5"/><path d="M16.5 4.5V3"/></svg>',
    sabotage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="9" width="12" height="10" rx="1"/><path d="M12 9V5l3-2"/><path d="M9 13l6 4M15 13l-6 4"/></svg>',
    checkarea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L21 21"/><path d="M11 8v6M8 11h6"/></svg>',
    wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="2.2"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9"/><path d="M4.4 4.4a10.8 10.8 0 000 15.2M19.6 4.4a10.8 10.8 0 010 15.2"/></svg>',
    rush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L5 14h6l-2 8 8-12h-6z"/></svg>',
    laststand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6z"/><path d="M12 8v5M12 16h.01"/></svg>',
    detonate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="13" width="9" height="8" rx="1"/><path d="M8.5 13V9"/><path d="M8.5 9l7-4"/><path d="M15 3l2 1-1 2"/><path d="M18 11l1.5-1.5M20 15h2M18 19l1.5 1.5"/></svg>',
    stance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18"/><path d="M6 19l3-5M18 19l-3-5"/><path d="M8 14l9-7"/><path d="M16 5l3 1-1 3"/></svg>',
    empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 12h10"/></svg>'
  };

  /* The six standard actions, and how many special slots sit beside them. The
     engine owns the list, because the engine is what decides whether any of
     them is available; the icons above are the view's business. */
  var STANDARD = window.PMCEngine.STANDARD;
  var SPECIAL_SLOTS = window.PMCEngine.SPECIAL_SLOTS;

  function soundFor(entries) {
    if (!SFX) return;
    entries.forEach(function (l) {
      if (l.t === 'suppressed') SFX.suppress();
      else if (l.t === 'broken') SFX.broken();
    });
  }



  function pushRes(res) {
    resQueue.push(res);
    if (!ui.resOpen) showNextRes();
  }

  /* On a desktop the results are a running feed down the right-hand rail rather
     than a card to dismiss: nothing waits for a click, and every roll stays on
     screen to be read back. A narrow screen has no room for a rail, so it keeps
     the card — and so does the end of the battle, wherever it is played. */
  function feedHosts() {
    return ['resfeed-list', 'resfeed-m'].map(el).filter(Boolean);
  }
  function feedMode(res) {
    if (!feedHosts().length) return false;
    if (res && res.kind === 'Result') return false;         // the battle is over: say so properly
    return true;
  }

  function pushFeed(res) {
    var html = resHTML(res, true);
    var cls = 'feedcard fresh' + (res.side ? ' side-' + res.side : '');
    feedHosts().forEach(function (host) {
      var card = document.createElement('div');
      card.className = cls;
      card.innerHTML = html;
      host.appendChild(card);
      setTimeout(function () { card.classList.remove('fresh'); }, 300);
      // a rail is not a log: keep the last thirty and let the dock hold the rest
      while (host.children.length > 30) host.removeChild(host.firstChild);
    });
    ui.feedUnread = (ui.feedUnread || 0) + 1;
    markFeedTab();
  }
  /* On a phone the results share the panel with everything else, so the tab
     carries a count of what has landed since it was last looked at. */
  function markFeedTab() {
    var n = el('mtab-n');
    if (!n) return;
    var con = document.querySelector('.console');
    var showing = con && con.getAttribute('data-mtab') === 'res';
    if (showing) ui.feedUnread = 0;
    n.textContent = ui.feedUnread ? (ui.feedUnread > 9 ? '9+' : ui.feedUnread) : '';
  }
  function setMTab(which) {
    var con = document.querySelector('.console');
    if (!con) return;
    con.setAttribute('data-mtab', which);
    document.querySelectorAll('#mtabs .mtab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mtab') === which);
    });
    if (which === 'res') { ui.feedUnread = 0; }
    markFeedTab();
  }

  function showNextRes() {
    var res = resQueue.shift();
    if (!res) { ui.resOpen = false; ui.currentRes = null; el('resolution').hidden = true; show.pump(); return; }
    if (feedMode(res)) {
      ui.resOpen = true;
      ui.currentRes = res;
      if (res.onShow) res.onShow();
      pushFeed(res);
      if (SFX) {
        if (res.kind === 'Initiative') { SFX.dice(); SFX.chime(); }
        else if (res.dice || res.blocks) SFX.dice();
      }
      clearTimeout(ui.resTimer);
      // straight on to the next one; the card it just wrote stays in the rail
      ui.resTimer = setTimeout(closeRes, 130);
      return;
    }
    ui.resOpen = true;
    ui.currentRes = res;
    if (res.onShow) res.onShow();
    el('res-card').innerHTML = resHTML(res);
    el('resolution').hidden = false;
    el('res-continue').addEventListener('click', closeRes);
    if (SFX) {
      if (res.kind === 'Result') SFX.victory();
      else if (res.kind === 'Initiative') { SFX.dice(); SFX.chime(); }
      else if (res.dice || res.blocks) SFX.dice();
      else SFX.click();
    }
    var chk = el('res-auto');
    if (chk) {
      chk.addEventListener('change', function () {
        ui.autoAdvance = chk.checked;
        try { localStorage.setItem('pmc-autoadv', ui.autoAdvance ? '1' : '0'); } catch (e) { }
        clearTimeout(ui.resTimer);
        if (ui.autoAdvance) armAutoClose(res);
      });
    }
    clearTimeout(ui.resTimer);
    armAutoClose(res);
    el('res-continue').focus();
  }

  // Cards wait for Continue. Only an explicit auto-advance, for OpFor activations,
  // closes them on a timer.
  function armAutoClose(res) {
    if (!ui.autoAdvance) return;
    var actor = res.side || state.activeSide;
    if (!isAI(actor) && state.cfg.aiSides.length < 2) return;
    var wait = res.kind === 'Assault' ? 3200 : res.kind === 'Initiative' ? 1400 : 2200;
    ui.resTimer = setTimeout(closeRes, wait);
  }

  function closeRes() {
    clearTimeout(ui.resTimer);
    el('resolution').hidden = true;
    ui.resOpen = false;
    var res = ui.currentRes;
    ui.currentRes = null;
    if (res && res.onClose) res.onClose();     // may queue the next step
    if (resQueue.length) showNextRes();
    else { render(); show.pump(); }
  }

  function chipClass(text) {
    if (/Man down/.test(text)) return 'hitchip kill';
    if (/Get down|Ouch|SP/.test(text)) return 'hitchip sp';
    return 'hitchip';
  }

  function resHTML(res, feed) {
    var h = '<div class="res-top"><span class="res-kind">' + res.kind + '</span><h3>' + res.title + '</h3></div><div class="res-body">';
    if (res.dice) {
      h += '<div class="dice">' + res.dice.map(function (d) {
        return '<div class="die ' + (d.tone || '') + '">' + d.value + '<small>' + d.label + '</small></div>';
      }).join('') + '</div>';
    }
    if (res.blocks) {
      res.blocks.forEach(function (b) {
        h += '<div>';
        if (b.die !== null && b.die !== undefined) {
          var tone = b.die === 9 ? 'crit' : b.die === 0 ? 'fail' : 'd10';
          h += '<div class="dice"><div class="die ' + tone + '">' + b.die + '<small>D10</small></div>' +
            '<div class="res-note" style="flex:1">' + b.head + '</div></div>';
        } else {
          h += '<div class="res-note">' + b.head + '</div>';
        }
        if (b.math) h += '<div class="calc">' + b.math.replace(/→ (\d+ hits?)/, '→ <b>$1</b>') + '</div>';
        if (b.chips.length) h += '<div class="hitrow">' + b.chips.map(function (c) {
          return '<span class="' + chipClass(c) + '">' + c + '</span>';
        }).join('') + '</div>';
        b.banners.forEach(function (bn) {
          h += '<div class="outcome ' + bn.tone + '">' + bn.text + '</div>';
        });
        h += '</div>';
      });
    }
    if (res.note) h += '<div class="res-note">' + res.note + '</div>';
    if (res.calc) h += '<div class="calc">' + res.calc + '</div>';
    if (res.list) {
      h += '<div class="calc">' + res.list.map(function (l) { return l.text; }).join('\n') + '</div>';
    }
    if (res.outcome) h += '<div class="outcome ' + (res.outcome.tone || '') + '">' + res.outcome.text + '</div>';
    if (feed) return h + '</div>';
    var count = res.progress || (resQueue.length ? resQueue.length + ' more' : '');
    h += '</div><div class="res-foot"><button class="start" id="res-continue">Continue</button>' +
      (count ? '<span class="res-count">' + count + '</span>' : '') + '</div>';
    if (state.cfg.aiSides.length) {
      h += '<label class="autochk" for="res-auto"><input type="checkbox" id="res-auto"' +
        (ui.autoAdvance ? ' checked' : '') + '> Advance OpFor cards automatically</label>';
    }
    return h;
  }

  /* ================= motion and effects ================= */
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function busy() {
    return anims.length > 0 || anyArriving() || FX.busy();
  }

  function whenIdle(cb) {
    if (!busy()) { cb(); return; }
    idleCbs.push(cb);
  }

  function startLoop() {
    if (loop) return;
    loop = requestAnimationFrame(tick);
  }

  function tick() {
    var t = nowMs(), alive = [];
    anims.forEach(function (an) {
      var k = Math.min(1, (t - an.t0) / an.dur);
      if (an.kind === 'move') {
        var d = k * an.total, seg = 0;
        while (seg < an.segs.length - 1 && d > an.segs[seg].end) seg++;
        var s = an.segs[seg];
        var f = s.len ? Math.max(0, Math.min(1, (d - s.start) / s.len)) : 1;
        an.unit.ax = s.a.x + (s.b.x - s.a.x) * f;
        an.unit.ay = s.a.y + (s.b.y - s.a.y) * f;
        pace(an, d, k, t);
        if (an.follow) {                       // ride along with the unit
          var sp = ISO.toScreen(an.unit.ax, an.unit.ay);
          cam.tx = sp.x; cam.ty = sp.y - ISO.ELEV;
          cam.x += (cam.tx - cam.x) * 0.16;
          cam.y += (cam.ty - cam.y) * 0.16;
          clampCam();
          cam.tx = cam.x; cam.ty = cam.y;
          borrowCamera();
        }
      }
      if (an.kind === 'strafe') {
        an.unit.ax = an.from.x + (an.to.x - an.from.x) * k;
        an.unit.ay = an.from.y + (an.to.y - an.from.y) * k;
      }
      if (k >= 1) {
        if (an.kind === 'move') { an.unit.ax = an.unit.ay = null; an.unit.walk = 0; an.unit.hop = 0; an.unit.arc = 0; }
        if (an.kind === 'strafe') { an.unit.ax = an.unit.ay = null; }
        if (an.done) an.done();
      } else alive.push(an);
    });
    anims = alive;

    FX.prune();

    drawBoard();

    if (!busy() && idleCbs.length) {
      var cbs = idleCbs; idleCbs = [];
      cbs.forEach(function (cb) { cb(); });
    }
    if (anims.length || fx.length || anyArriving()) loop = requestAnimationFrame(tick);
    else { loop = null; drawBoard(); show.pump(); }
  }

  /* ---- how a unit is drawn crossing the ground ----

     A walk is made of footfalls, and a footfall happens every so many inches —
     not every so many milliseconds. Driving the frames off the clock instead
     made the feet slide: the same eleven paces whether the unit shuffled 3" or
     sprinted 12". Driving them off distance covered means a squad hurrying puts
     its legs down faster, which is what the eye is looking for.

     The body rides with the feet: up between paces, down onto each one, so the
     bob and the step land together instead of drifting against each other as
     they did when both ran on their own timers. A step is heard on each footfall,
     rate-limited so a long sprint is a walk rather than a drum roll. */
  var PACE = 2.2;          // inches a pace, for a squad on foot
  var STRIDE = 3.4;        // a walker's legs are longer, and slower
  var ROLL = 2.8;          // how often a ground hull pitches on its suspension
  var STEP_GAP = 130;      // never more than one footstep sound this often

  function gaitOf(u) {
    // jump troops go up on their jets and come down where they were going
    if (u.jets) return { arc: true };
    if (!R.isMachine(u)) return { span: PACE, lift: 1.6, sound: true };
    if (u.prop === 'walker') return { span: STRIDE, lift: 1.3, sound: true };
    // grav and hover hulls float: nothing to bounce, nothing to hear
    if (u.prop === 'grav' || u.prop === 'hover') return null;
    if (u.cls === 'aircraft') return null;
    return { span: ROLL, lift: 0.5, sound: false };   // wheels and tracks, pitching
  }

  // how high a jump squad's arc peaks, in plate pixels, for a bound this long
  function jetApex(inches) { return Math.min(ISO.K * 3, ISO.K * (0.9 + inches * 0.22)); }

  function pace(an, d, k, t) {
    var gait = gaitOf(an.unit);
    if (!gait) { an.unit.walk = 0; an.unit.hop = 0; return; }
    if (gait.arc) {
      /* A jet-assisted bound: one arc from where the squad stood to where it
         lands, higher the further it goes, the burn flickering all the way. */
      an.unit.walk = 1 + (Math.floor(t / 70) % 2);
      an.unit.hop = 0;
      an.unit.arc = Math.sin(Math.min(1, k) * Math.PI) * jetApex(an.total || d);
      if (an.lastPace < 0 && k < 1) {
        an.lastPace = 0;
        if (SFX && SFX.jetpack) SFX.jetpack((an.dur || 800) / 1000);
      }
      return;
    }
    var paces = d / gait.span;
    var n = Math.floor(paces);
    an.unit.walk = 1 + (n % 2);
    // the body is highest halfway between footfalls and lowest on each one
    an.unit.hop = Math.sin((paces - n) * Math.PI) * gait.lift;
    if (n !== an.lastPace && k < 1) {
      an.lastPace = n;
      if (gait.sound && t - an.lastStep > STEP_GAP) { an.lastStep = t; if (SFX) SFX.step(); }
    }
  }

  function animateMove(u, path, follow) {
    if (!path || path.length < 2) return;
    var segs = [], total = 0;
    for (var i = 1; i < path.length; i++) {
      var len = R.inches(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
      segs.push({ a: path[i - 1], b: path[i], start: total, len: len, end: total + len });
      total += len;
    }
    if (!total) return;
    // a squad turns to the way it is going; a turret swings back to the front
    faceToward(u, path[path.length - 1].x, path[path.length - 1].y, path[0]);
    if (R.isMachine(u)) u.aim = null;
    anims.push({
      kind: 'move', unit: u, segs: segs, total: total, follow: !!follow,
      dur: Math.min(1400, 240 + total * 42), t0: nowMs(), lastStep: 0, lastPace: -1
    });
    u.ax = path[0].x; u.ay = path[0].y;
    startLoop();
  }

  function addFx(f) {
    FX.add(f);
    startLoop();
  }

  /* ---- a shot, played the way that unit's weapon actually works ----
     `R.weaponSpec` says what it carries: a primary, sometimes a secondary that
     goes off with it, and how many tubes fire at once. Each style has its own
     cadence, its own effect on the table and its own sound, and the whole thing
     is timed so the hits land when the rounds arrive rather than on a fixed
     beat. Every one of them ends by calling `done`, once. */
  var FIRE = {
    /* A rifle line: aimed shots, not a stream. Eight men firing deliberately put
       fewer rounds down per second than an autocannon does — what makes it read
       as a volley is that it runs on for a second, not that it is fast. */
    small:    { n: function (h) { return clampN(h * 2 + 3, 5, 11); }, gap: 112, tracer: { spread: 0.42 }, land: 330, muzzle: 520, perShot: true },
    /* A sidearm: a few deliberate shots with a long gap between them, at close
       range. Fewer rounds than anything else fires, and you can count them. */
    pistol:   { n: function (h) { return clampN(h + 2, 3, 6); }, gap: 185, tracer: { spread: 0.34, short: true }, land: 300, muzzle: 150, perShot: true },
    /* A carbine at close range: quicker than an aimed rifle line and with more
       rounds in it, but still recognisably single shots rather than a stream. */
    smg:      { n: function (h) { return clampN(h * 2 + 4, 5, 12); }, gap: 68, tracer: { spread: 0.5, short: true }, land: 300, muzzle: 460 },
    // a machine gun, rattling
    burst:    { n: function (h) { return clampN(h * 2 + 4, 6, 12); }, gap: 38, tracer: { spread: 0.55 }, land: 300, muzzle: 460 },
    // an autocannon: heavier, slower, countable
    chain:    { n: function (h) { return clampN(h * 2 + 3, 5, 10); }, gap: 92, tracer: { spread: 0.3, fat: true }, land: 330, muzzle: 92, perShot: true },
    // a bug's volley of chitin spines: a quick dry spray, bone-pale, no flash
    spine:    { n: function (h) { return clampN(h * 2 + 4, 6, 12); }, gap: 45, tracer: { spread: 0.6, short: true, bio: true }, land: 320, muzzle: 0, noFlash: true }
  };
  function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // how long a stream of that style takes to get all its rounds away
  function streamLength(style, hits) {
    var f = FIRE[style] || FIRE.small;
    var n = f.n(hits);
    if (!f.clump) return n * f.gap;
    return Math.floor((n - 1) / f.clump) * f.clumpGap + ((n - 1) % f.clump) * f.gap;
  }

  /* A flamethrower is not one squeeze of a trigger. The operator holds it down
     and walks the cone across the frontage, in two or three jets, each one
     laid a little off the last — which is why it takes ground rather than
     picking a target out of it. */
  var FLAME_JET = 620, FLAME_GAP = 165;
  function flameJets(from, to, n, onLand) {
    var dx = to.x - from.x, dy = to.y - from.y;
    var len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    var px = -dy / len, py = dx / len;               // across the line of fire
    var span = (n - 1) * FLAME_GAP + FLAME_JET;      // how long the roar has to hold
    for (var i = 0; i < n; i++) {
      (function (j) {
        setTimeout(function () {
          if (!state) return;
          // barely off the mark: the jets converge rather than sweeping a line
          var off = (j - (n - 1) / 2) * 0.45;
          var aim = { x: to.x + px * off, y: to.y + py * off, up: to.up };
          if (SFX) { if (j === 0) SFX.flame(0, span / 1000); else SFX.flamepuff(); }
          addFx({ kind: 'flame', from: from, to: aim, dur: FLAME_JET, blocking: true });
          if (onLand && j === n - 1) setTimeout(onLand, 360);
          render();
        }, j * FLAME_GAP);
      })(i);
    }
    return span;
  }

  // a squad on foot turns to face left or right on the screen
  function faceToward(u, x, y, from) {
    if (R.isMachine(u)) return;
    from = from || u;
    var a = ISO.toScreen(from.x, from.y), b = ISO.toScreen(x, y);
    if (b.x < a.x - ISO.K * 0.3) u.faceL = true;
    else if (b.x > a.x + ISO.K * 0.3) u.faceL = false;
  }

  // the i-th round of a volley leaves the i-th barrel or tube in the pool
  function pick(from, i) {
    if (!from.pool || from.pool.length < 2) return from;
    return { x: from.x, y: from.y, up: from.up, mz: from.pool[i % from.pool.length], pool: from.pool };
  }

  // the colour a Xenotripod's weapons burn: the light of its army
  /* Xenotripod energy — their shots, the orbs and the blasts — burns blue,
     whatever the army's colour; the colour stays on the models. */
  var XENO_BLUE = '110,190,255';
  function glowRGB(u) { return XENO_BLUE; }
  function shotRGB(u) { return R.isXeno(u) ? XENO_BLUE : null; }
  function playEnergy(shooter, from, to, count, land, gap) {
    var rgb = glowRGB(shooter), n = count || 1;
    for (var q = 0; q < n; q++) {
      (function (j) {
        setTimeout(function () {
          if (!state) return;
          if (SFX) (SFX.zap || SFX.rail).call(SFX);
          addFx({ kind: 'pulse', from: pick(from, j), to: to, rgb: rgb, dur: 260, blocking: true });
          if (land) setTimeout(function () { land(j === n - 1 ? 1 : 0); }, 250);
          render();
        }, j * (gap || 120));
      })(q);
    }
    return n * (gap || 120) + 300;
  }
  function playOrbs(shooter, from, to, count, land, tele, big) {
    var rgb = glowRGB(shooter), n = count || 1;
    var fl = tele ? 1000 : Math.round((big ? 760 : 560) + Math.min(600, R.unitDist(shooter, { x: to.x, y: to.y }) * 12));
    /* a Gamma's salvo all comes out of one exit portal, hanging short of the
       target on the shooter's side, and spreads from it */
    var exit = null;
    if (tele) {
      var ex = shooter.x - to.x, ey = shooter.y - to.y, ed = Math.hypot(ex, ey) || 1, eb = Math.min(ed * 0.45, 2.4);
      exit = { x: to.x + ex / ed * eb, y: to.y + ey / ed * eb, up: to.up };
      addFx({ kind: 'exitportal', exit: exit, open: 300, dur: fl + (n - 1) * 200, blocking: true });
    }
    for (var q = 0; q < n; q++) {
      (function (j) {
        setTimeout(function () {
          if (!state) return;
          if (tele && SFX && SFX.shimmer) SFX.shimmer(); else if (SFX && SFX.launch) SFX.launch();
          var aim = n > 1 ? { x: to.x + (j - (n - 1) / 2) * 1.1, y: to.y + (j % 2 ? 0.7 : -0.7), up: to.up } : to;
          addFx({ kind: 'orb', from: pick(from, j), to: aim, rgb: rgb, tele: !!tele, exit: exit, big: !!big, dur: fl, blocking: true });
          setTimeout(function () {
            if (!state) return;
            addFx({ kind: 'orbburst', x: aim.x, y: aim.y, up: aim.up, rgb: rgb, big: !!big, dur: big ? 800 : 600, blocking: true });
            /* A heavy round throws the ground up with it: a wider ring of blue
               fire and a scatter of it around the crater. */
            if (big) {
              addFx({ kind: 'orbburst', x: aim.x, y: aim.y, up: aim.up, rgb: rgb, dur: 1000, blocking: true });
              for (var sp = 0; sp < 5; sp++) {
                addFx({
                  kind: 'orbburst', rgb: rgb, dur: 520 + Math.random() * 260, blocking: true,
                  x: aim.x + (Math.random() - 0.5) * 3.2, y: aim.y + (Math.random() - 0.5) * 3.2, up: aim.up
                });
              }
            }
            if (SFX) { SFX.impact(); if (big) SFX.impact(0.08); }
            if (land && j === n - 1) land(2);
          }, fl);
          render();
        }, j * 200);
      })(q);
    }
    return fl + (n - 1) * 200 + 600;
  }

  /* A unit fires its sequence twice over: the same volley, a beat apart. The
     first pass is the animation alone — nobody falls and no card comes up — and
     the second carries the casualties and the result, so a shot reads as a
     burst of fire rather than one round going out. */
  var TWICE_GAP = 280;
  function playShooting(shooter, target, res, deaths, done) {
    playOneVolley(shooter, target, res, [], function () {
      beat(TWICE_GAP);
      setTimeout(function () {
        if (!state) { if (done) done(); return; }
        playOneVolley(shooter, target, res, deaths, done);
      }, TWICE_GAP);
    });
  }

  function playOneVolley(shooter, target, res, deaths, done) {
    var spec = R.weaponSpec(shooter);
    /* A gunship fires from its airframe and is hit on its airframe, not on the
       ground it happens to be over. Every point a shot is drawn between carries
       how high above its own ground it sits. */
    var from = { x: shooter.x, y: shooter.y, up: ISO.flyLift(shooter) };
    var to = { x: target.x, y: target.y, up: ISO.flyLift(target) };
    /* Troopers turn to face what they are shooting at, and each shot leaves one
       of their own barrels: the pool is every surviving model's muzzle. */
    if (!R.isMachine(shooter)) {
      faceToward(shooter, target.x, target.y);
      var pool = ISO.muzzles(shooter, R.status(shooter));
      if (pool.length) { from.mz = pool[0]; from.pool = pool; }
    }
    /* A machine turns its turret onto the target, and each weapon fires from
       its own barrel or tubes: the main gun from the muzzle, the machine gun
       from the machine gun, rockets from the rack. */
    var mountFrom = function () { return from; };
    if (R.isMachine(shooter)) {
      shooter.aim = Math.atan2(target.y - shooter.y, target.x - shooter.x);
      var M = ISO.mounts(shooter);
      mountFrom = function (style) { return ISO.mountFor(M, style, shooter, from); };
      from = mountFrom(spec.p);
    }
    /* An aircraft's missiles leave on the line the craft is flying and turn
       onto the mark from there, rather than climbing over it: it is already
       above everything, so the climb read as the missile going the wrong way.
       The control point is a spot out ahead of the nose, and the missile is
       drawn along the curve through it. */
    var curve = null;
    if (shooter.cls === 'aircraft' && shooter.facing != null) {
      var reach = Math.max(4, R.unitDist(shooter, target) * 0.55);
      curve = {
        x: shooter.x + Math.cos(shooter.facing) * reach,
        y: shooter.y + Math.sin(shooter.facing) * reach,
        up: ISO.flyLift(shooter)
      };
    }
    var hits = res.hits || 1;
    var fired = false;
    function land(extra, at) {
      if (!state) return;
      if (res.hits > 0) {
        addFx({
          kind: 'impact', x: to.x, y: to.y, up: to.up, rgb: shotRGB(shooter),
          n: Math.min(9, hits + (extra || 0)), dur: extra ? 560 : 420, blocking: true
        });
        if (SFX) { SFX.impact(); if (extra) SFX.impact(0.06); }
      } else {
        addFx({ kind: 'miss', x: to.x, y: to.y, up: to.up, dur: 320, blocking: true });
      }
      if (!fired) { fired = true; spawnDeaths(deaths); }
    }
    function finish(ms) { setTimeout(function () { if (done) done(); }, ms); }

    // the secondary goes off alongside the primary, a beat later
    if (spec.s) setTimeout(function () {
      if (state) playSecondary(spec.s, shooter, mountFrom(spec.s), to, hits, spec.sn);
    }, 150);

    var tail = spec.s ? 320 + ((spec.sn || 1) - 1) * 260 : 0;

    switch (spec.p) {
      case 'none':
        finish(120); return;

      // Xenotripod small arms: pulses of the army's own light
      case 'energy': {
        finish(playEnergy(shooter, from, to, spec.n, land, R.isMachine(shooter) ? 150 : 110) + tail); return;
      }
      // plasma orbs: lobbed from craft and turrets, teleported from a Gamma's launcher
      case 'orb': {
        finish(playOrbs(shooter, from, to, spec.n, land, !R.isMachine(shooter)) + tail); return;
      }
      // an energy howitzer: heavier orbs, lobbed, bursting blue on the ground
      case 'orbbig': {
        finish(playOrbs(shooter, from, to, spec.n, land, false, true) + tail); return;
      }

      /* Bug acid: a glob (or `n` of them from the squad) lobbed low, landing in
         a green splash. `spitbig` is a sac of bio-plasma, bigger and slower. */
      case 'spit':
      case 'spitbig': {
        var sbig = spec.p === 'spitbig';
        var sr = R.unitDist(shooter, target);
        var sflight = Math.round((sbig ? 560 : 420) + Math.min(600, sr * 12));
        var globs = spec.n || 1, sgap = sbig ? 260 : 150;
        for (var gi = 0; gi < globs; gi++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              var F = pick(from, j);
              if (SFX) SFX.spit(0, sbig);
              var aim = globs > 1
                ? { x: to.x + (j - (globs - 1) / 2) * 0.9, y: to.y + (j % 2 ? 0.6 : -0.6), up: to.up }
                : to;
              addFx({ kind: 'glob', from: F, to: aim, dur: sflight, big: sbig, blocking: true });
              setTimeout(function () {
                if (!state) return;
                addFx({ kind: 'splat', x: aim.x, y: aim.y, up: aim.up, big: sbig, dur: 620, blocking: true });
                if (SFX) SFX.splat();
                if (j === globs - 1) land(sbig ? 3 : 1);
              }, sflight);
              render();
            }, j * sgap);
          })(gi);
        }
        finish(sflight + (globs - 1) * sgap + 520 + tail); return;
      }

      /* One heavy round, flat and fast. `shellbig` is the same thing with more
         behind it: a bigger blast at the muzzle and a heavier landing. */
      case 'shell':
      case 'shellbig': {
        var big = spec.p === 'shellbig';
        var rounds = spec.n || 1, shellGap = 230;
        var flightMs = big ? 340 : 300;
        for (var sh = 0; sh < rounds; sh++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              var F = pick(from, j);
              if (SFX) SFX.shell();
              addFx({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: big ? 320 : 260, big: true, blocking: true });
              addFx({ kind: 'bolt', from: F, to: to, dur: flightMs, heavy: big, blocking: true });
              setTimeout(function () { land(big ? 4 : 2); }, flightMs);
              render();
            }, j * shellGap);
          })(sh);
        }
        finish((big ? 900 : 820) + (rounds - 1) * shellGap + tail); return;
      }

      /* Up and over. The round is in the air for as long as the range warrants,
         and `n` tubes fire together — a section, a team or a battery. */
      case 'arc':
      case 'arcbig': {
        var heavy = spec.p === 'arcbig';
        var range = R.unitDist(shooter, target);
        var flight = Math.round((heavy ? 640 : 520) + Math.min(760, range * 16));
        var tubes = spec.n || 1;
        for (var q = 0; q < tubes; q++) {
          (function (i) {
            var off = i * 130;
            setTimeout(function () {
              if (!state) return;
              var F = pick(from, i);
              if (SFX) SFX.launch();
              // a mortar's tube gives a short flash at its mouth, not a tank gun's blast
              addFx({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: 220, big: !F.mz, blocking: true });
              // each tube walks its round a little off the others
              var aim = tubes > 1
                ? { x: to.x + (i - (tubes - 1) / 2) * 1.6, y: to.y + (i % 2 ? 1 : -1) * 0.9, up: to.up }
                : to;
              addFx({ kind: 'lob', from: F, to: aim, dur: flight, heavy: heavy, blocking: true });
              if (SFX) SFX.incoming(flight / 1000 - 0.45, 0.45);
              setTimeout(function () { land(heavy ? 4 : 3); }, flight);
            }, off);
          })(q);
        }
        finish(flight + (tubes - 1) * 130 + 480 + tail); return;
      }

      /* A guided missile: off the rail, then it turns onto the target. */
      case 'missile': {
        var mr = R.unitDist(shooter, target);
        // longer than the distance alone asks for: it leaves the tube slowly
        var mflight = Math.round(700 + Math.min(700, mr * 14));
        // `n` birds off the rail one after another, not all at once
        var birdsP = spec.n || 1, birdGap = 260;
        for (var mi2 = 0; mi2 < birdsP; mi2++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              var F = pick(from, j);
              if (SFX) SFX.missile(0, mflight / 1000, mflight / 1000 * 0.52);
              // no flash at the tube: it is ejected cold and lights further out
              addFx({ kind: 'missile', from: F, to: to, seed: j, dur: mflight, curve: curve, blocking: true });
              setTimeout(function () { land(3); }, mflight);
              render();
            }, j * birdGap);
          })(mi2);
        }
        finish(mflight + 460 + (birdsP - 1) * birdGap + tail); return;
      }

      /* Unguided rockets, off the rails in a ripple. */
      case 'rocket': {
        var rn = clampN(hits + 2, 3, 6);
        var rflight = 420;
        if (SFX) SFX.rocket(hits);
        for (var r = 0; r < rn; r++) {
          (function (i) {
            setTimeout(function () {
              if (!state) return;
              var F = pick(from, i);
              addFx({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: 180, big: true, blocking: true });
              addFx({
                kind: 'missile', from: F, to: to, rocket: true, seed: i,
                dur: rflight, blocking: true
              });
              setTimeout(function () { land(i === rn - 1 ? 3 : 0); }, rflight);
            }, i * 78);
          })(r);
        }
        finish(rn * 78 + rflight + 420 + tail); return;
      }

      /* A cone of fire. Nothing flies: the ground between burns. */
      case 'flame': {
        var span = flameJets(from, to, 6, function () { land(2); });
        finish(span + 220 + tail); return;
      }

      /* A Gauss weapon: an instant white line, gone as you look at it. */
      /* A Gauss weapon: an instant white line, gone as you look at it. `n` is
         how many go out — a marksman's rifle fires one, a crew-served cannon
         puts three down in quick succession. */
      case 'rail': {
        var shots = spec.n || 1;
        var railGap = 170;
        for (var rs = 0; rs < shots; rs++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              if (SFX) SFX.rail();
              addFx({ kind: 'rail', from: pick(from, j), to: to, rgb: shotRGB(shooter), dur: 380, blocking: true });
              if (j === shots - 1) setTimeout(function () { land(1); }, 90);
              render();
            }, j * railGap);
          })(rs);
        }
        finish(560 + (shots - 1) * railGap + tail); return;
      }

      default:
        playStream(spec.p, shooter, from, to, hits, land);
        finish(Math.max(820, streamLength(spec.p, hits) + 320) + tail); return;
    }
  }

  /* A secondary weapon: the coaxial under a tank's main gun, the guns beneath a
     gunship's rockets, the grenades assault troops throw as they close. It makes
     its own noise and its own mark, but the casualties belong to the primary —
     they are one attack, resolved once. */
  function playSecondary(style, shooter, from, to, hits, count) {
    if (FIRE[style]) { playStream(style, shooter, from, to, hits, null); return; }
    switch (style) {
      case 'energy': playEnergy(shooter, from, to, count, null, 120); return;
      case 'orb': playOrbs(shooter, from, to, count, null, !R.isMachine(shooter)); return;
      case 'orbbig': playOrbs(shooter, from, to, count, null, false, true); return;
      case 'spit': case 'spitbig': {
        var sn = count || 1, sfl = 480;
        for (var q0 = 0; q0 < sn; q0++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              if (SFX) SFX.spit(0, style === 'spitbig');
              var aim = sn > 1 ? { x: to.x + (j - (sn - 1) / 2) * 0.9, y: to.y + (j % 2 ? 0.6 : -0.6), up: to.up } : to;
              addFx({ kind: 'glob', from: pick(from, j), to: aim, dur: sfl, big: style === 'spitbig', blocking: true });
              setTimeout(function () {
                if (!state) return;
                addFx({ kind: 'splat', x: aim.x, y: aim.y, up: aim.up, dur: 560, blocking: true });
                if (SFX) SFX.splat();
              }, sfl);
              render();
            }, j * 170);
          })(q0);
        }
        return;
      }
      case 'arc': case 'arcbig': {
        /* Thrown charges: a short, high lob with a puff where it lands, and
           `count` of them — assault troops go in with a grenade in each hand. */
        var flight = 520, thrown = count || 1;
        for (var q = 0; q < thrown; q++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              // spread them either side of the mark rather than one on top of the other
              var aim = thrown > 1
                ? { x: to.x + (j - (thrown - 1) / 2) * 1.4, y: to.y + (j % 2 ? 0.9 : -0.9), up: to.up }
                : to;
              if (SFX) SFX.launch();
              addFx({ kind: 'lob', from: pick(from, j), to: aim, dur: flight, heavy: style === 'arcbig', blocking: true });
              setTimeout(function () {
                if (!state) return;
                addFx({ kind: 'impact', x: aim.x, y: aim.y, up: aim.up, n: 4, dur: 380, blocking: true });
                if (SFX) SFX.impact();
              }, flight);
              render();
            }, j * 190);
          })(q);
        }
        return;
      }
      case 'shell': case 'shellbig': {
        // `count` rounds in quick succession, each with its own flash and bolt
        var fired = count || 1;
        for (var q2 = 0; q2 < fired; q2++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              if (SFX) SFX.shell();
              addFx({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pick(from, j).mz, dur: 240, big: true, blocking: true });
              addFx({ kind: 'bolt', from: pick(from, j), to: to, dur: 300, heavy: style === 'shellbig', blocking: true });
              render();
            }, j * 230);
          })(q2);
        }
        return;
      }
      case 'rail': {
        var lines = count || 1;
        for (var q3 = 0; q3 < lines; q3++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              if (SFX) SFX.rail();
              addFx({ kind: 'rail', from: pick(from, j), to: to, rgb: shotRGB(shooter), dur: 380, blocking: true });
              render();
            }, j * 170);
          })(q3);
        }
        return;
      }
      case 'missile': {
        // missiles off the rail one after another, not all at once
        var birds = count || 1;
        for (var q4 = 0; q4 < birds; q4++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              if (SFX) SFX.missile(0, 0.9, 0.47);
              addFx({ kind: 'missile', from: pick(from, j), to: to, seed: j, dur: 900, blocking: true });
              render();
            }, j * 260);
          })(q4);
        }
        return;
      }
      case 'rocket': {
        // a rack of unguided rockets, rippling off in a salvo
        if (SFX) SFX.rocket(3);
        for (var q5 = 0; q5 < 5; q5++) {
          (function (j) {
            setTimeout(function () {
              if (!state) return;
              addFx({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pick(from, j).mz, dur: 180, big: true, blocking: true });
              addFx({ kind: 'missile', from: pick(from, j), to: to, rocket: true, seed: j, dur: 420, blocking: true });
              render();
            }, j * 78);
          })(q5);
        }
        return;
      }
      case 'flame':
        flameJets(from, to, 4, null);
        return;
      default:
        playStream(style, shooter, from, to, hits, null);
    }
  }

  /* The four styles that put a stream of rounds down: rifles, SMGs, machine guns
     and autocannon. They differ only in how many, how fast and how they look, so
     one routine draws them all. `land` is null for a secondary, which does its
     own noise but leaves the casualties to the primary. */
  function playStream(style, shooter, from, to, hits, land) {
    var f = FIRE[style] || FIRE.small;
    var n = f.n(hits);
    var heavy = shooter.fp >= 5;
    // a Xenotripod unit's guns keep their rhythm but fire energy, not rounds
    if (SFX && R.isXeno(shooter) && SFX.zaps) SFX.zaps(style, hits);
    else if (SFX) {
      if (style === 'chain') SFX.chain(hits);
      else if (style === 'burst') SFX.rattle(hits);
      else if (style === 'smg') SFX.smg(hits);
      else if (style === 'pistol') SFX.pistol(hits);
      else if (style === 'spine') SFX.spine(hits);
      else SFX.burst(hits, heavy);
    }
    // each round goes to the next man along, so a volley comes from the rank
    var pool = from.pool || [from.mz];
    function gun(i) { return { x: from.x, y: from.y, up: from.up, mz: pool[i % pool.length] }; }
    if (f.noFlash) {
      // nothing to flash: a bug has no muzzle
    } else if (f.perShot) {
      for (var m = 0; m < n; m++) {
        addFx({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pool[m % pool.length], rgb: shotRGB(shooter), delay: m * f.gap, dur: f.muzzle + m * f.gap, blocking: true });
      }
    } else {
      // a sustained burst: every gun in the squad flashing for the length of it
      for (var m2 = 0; m2 < Math.min(pool.length, n); m2++) {
        addFx({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pool[m2], rgb: shotRGB(shooter), delay: m2 * 23, dur: f.muzzle + m2 * 23, blocking: true });
      }
    }
    for (var i = 0; i < n; i++) {
      // a clumped weapon pauses between bursts; the rest fire evenly
      var at = f.clump
        ? Math.floor(i / f.clump) * f.clumpGap + (i % f.clump) * f.gap
        : i * f.gap;
      addFx({
        kind: 'tracer', from: gun(i), to: to,
        spread: f.tracer.spread, fat: f.tracer.fat, short: f.tracer.short, bio: f.tracer.bio, rgb: shotRGB(shooter),
        delay: at, dur: 250 + at, blocking: true
      });
    }
    if (land) setTimeout(function () { land(style === 'chain' ? 1 : 0); }, f.land);
  }

  // the aircraft runs the line, throwing fire out to either side
  /* A strafing run: the craft flies the length of it, guns going, and the
     ground walks up under it. It used to stand still while the fire appeared
     along the line, which read as somebody else shooting. */
  function playStrafe(u, from, to, deaths, done) {
    var span = Math.hypot(to.x - from.x, to.y - from.y);
    var dur = Math.max(1200, Math.min(2600, 700 + span * 90));
    var steps = Math.max(5, Math.round(span * 1.2) + 4);
    if (u) {
      u.facing = Math.atan2(to.y - from.y, to.x - from.x);
      u.aim = null;
      u.ax = from.x; u.ay = from.y;
      anims.push({ kind: 'strafe', unit: u, from: from, to: to, dur: dur, t0: nowMs() });
      startLoop();
    }
    /* The bursts go down where the craft is as it passes, over the middle of
       the run — it opens up after the approach and stops before it pulls off. */
    for (var i = 0; i < steps; i++) {
      (function (n) {
        setTimeout(function () {
          if (!state) return;
          var f = 0.18 + (n / (steps - 1)) * 0.64;
          var x = from.x + (to.x - from.x) * f, y = from.y + (to.y - from.y) * f;
          addFx({ kind: 'muzzle', x: x, y: y, dur: 180, blocking: true });
          /* The ground going up under it: rounds walking along the line, each
             throwing its own dirt, spread either side of the run. */
          addFx({ kind: 'impact', x: x, y: y, n: 3, dur: 320, blocking: true });
          for (var d2 = 0; d2 < 3; d2++) {
            addFx({
              kind: 'miss', x: x + (Math.random() - 0.5) * 2.4, y: y + (Math.random() - 0.5) * 2.4,
              dur: 380 + Math.random() * 220, blocking: true
            });
          }
          if (SFX) SFX.burst(2, true);
        }, dur * 0.18 + n * (dur * 0.64 / Math.max(1, steps - 1)));
      })(i);
    }
    setTimeout(function () { spawnDeaths(deaths); }, dur * 0.6);
    setTimeout(function () { if (done) done(); }, dur + 220);
  }

  function playAssault(attacker, target, deaths, done) {
    var mid = { x: (attacker.x + target.x) / 2, y: (attacker.y + target.y) / 2 };
    for (var i = 0; i < 4; i++) {
      (function (n) {
        setTimeout(function () {
          if (!state) return;
          addFx({ kind: 'clash', x: mid.x + (Math.random() - 0.5), y: mid.y + (Math.random() - 0.5), dur: 300, blocking: true });
          // an assault goes in firing carbines from the hip — or, for bugs, all mandibles
          if (SFX) { if (attacker.faction === 'bugs') SFX.chitter(); else SFX.smg(4); }
        }, n * 170);
      })(i);
    }
    setTimeout(function () { spawnDeaths(deaths); }, 320);
    setTimeout(function () { if (done) done(); }, 900);
  }

  function spawnDeaths(deaths) {
    (deaths || []).forEach(function (d) {
      addFx({
        kind: 'ghost', x: d.x, y: d.y, side: d.u.side, code: d.u.code,
        models: Math.max(1, d.u.size), dur: 700, blocking: true
      });
    });
    if (deaths && deaths.length && SFX) SFX.casualty();
  }

  /* The effects themselves live in fx.js, so the game and the unit viewer draw
     the same ones from the same code. This is only the game's window onto it. */
  function drawFx() { FX.draw(pctx); }

  /* ================= logging ================= */
  function logLine(t, text, math) {
    state.log.push({ t: t, text: text, math: math || null });
    if (state.log.length > 400) state.log.shift();
  }

  /* ================= rendering ================= */
  var canvas, ctx, pix, pctx;

  function dispX(u) { return u.ax === null || u.ax === undefined ? u.x : u.ax; }
  function dispY(u) { return u.ay === null || u.ay === undefined ? u.y : u.ay; }

  function liftOf(x, y) {
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i];
      // the whole rectangle is the hill, exactly as the rules read it
      if (r.kind === 'hill' && R.inRect(x, y, r)) return r.top && R.inPoly(x, y, r.top) ? ISO.ELEV * 2 : ISO.ELEV;
    }
    return 0;
  }

  /* ---------- camera ---------- */
  function viewRect() {
    var z = cam.z;
    var sw = Math.min(ISO.PIXW, Math.round(VIEW_W / z));
    var sh = Math.min(ISO.PIXH, Math.round(VIEW_H / z));
    return {
      z: z, sw: sw, sh: sh,
      sx: Math.max(0, Math.min(ISO.PIXW - sw, Math.round(cam.x - sw / 2))),
      sy: Math.max(0, Math.min(ISO.PIXH - sh, Math.round(cam.y - sh / 2))),
      dx: Math.round((VIEW_W - sw * z) / 2 + (cam.ox || 0)),
      dy: Math.round((VIEW_H - sh * z) / 2 + (cam.oy || 0))
    };
  }
  /* A line on the ground in a side's colour gets a dark edge under it. On
     soil the colour carries it; on sand or snow — desert ochre on desert sand —
     it is the edge that shows. The dash pattern is kept for both strokes. */
  function edgedStroke(dark) {
    var col = ctx.strokeStyle, lw = ctx.lineWidth;
    ctx.strokeStyle = 'rgba(8,10,14,' + (dark == null ? 0.45 : dark) + ')';
    ctx.lineWidth = lw + 2;
    ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.stroke();
  }
  function hud(x, y, lift) {
    var p = ISO.toScreen(x, y), v = viewRect();
    return { x: (p.x - v.sx) * v.z + v.dx, y: (p.y - (lift || 0) - v.sy) * v.z + v.dy };
  }
  // The view the player last chose. The AI borrows the camera while it acts;
  // a tap on open ground hands it back.
  // Once the player drives the camera, a move still playing out must stop
  // riding along with it.
  function dropFollow() {
    for (var i = 0; i < anims.length; i++) anims[i].follow = false;
  }

  function setHome(x, y) {
    cam.home = { x: x, y: y, z: cam.z };
    cam.borrowed = false;
    dropFollow();
    updateReturnHint();
  }
  function borrowCamera() {
    if (!state || state.cfg.aiSides.length === 2) return;   // in a demo nobody is waiting for it
    if (cam.borrowed) return;
    cam.borrowed = true;
    updateReturnHint();
  }
  function returnHome() {
    if (!cam.home) return;
    if (cam.home.z !== cam.z) { cam.z = cam.home.z; zoomLabel(); }
    cam.borrowed = false;
    dropFollow();
    updateReturnHint();
    centreOn(cam.home.x, cam.home.y);
    if (SFX) SFX.click();
  }
  function updateReturnHint() {
    var h = el('returnhint');
    if (h) h.hidden = !cam.borrowed;
  }

  /* How much empty frame there is around the table on each axis, in screen pixels.
     Zoomed right out the table is narrower than the window, and this is the room
     the player has to slide it about in. */
  function slack() {
    var sw = Math.min(ISO.PIXW, Math.round(VIEW_W / cam.z));
    var sh = Math.min(ISO.PIXH, Math.round(VIEW_H / cam.z));
    return {
      x: Math.max(0, (VIEW_W - sw * cam.z) / 2),
      y: Math.max(0, (VIEW_H - sh * cam.z) / 2)
    };
  }
  function clampCam() {
    var v = viewRect();
    cam.x = Math.max(v.sw / 2, Math.min(ISO.PIXW - v.sw / 2, cam.x));
    cam.y = Math.max(v.sh / 2, Math.min(ISO.PIXH - v.sh / 2, cam.y));
    // the table can be slid into the empty frame, but never out of it
    var s = slack();
    cam.ox = Math.max(-s.x, Math.min(s.x, cam.ox || 0));
    cam.oy = Math.max(-s.y, Math.min(s.y, cam.oy || 0));
  }

  function centreOn(bx, by, instant) {
    cam.tx = bx; cam.ty = by;
    if (instant) { cam.x = bx; cam.y = by; drawBoard(); return; }
    if (cam.anim) return;
    cam.anim = requestAnimationFrame(stepCam);
  }
  function stepCam() {
    hideTerrainTip();
    var dx = cam.tx - cam.x, dy = cam.ty - cam.y;
    if (Math.abs(dx) < 0.7 && Math.abs(dy) < 0.7) {
      cam.x = cam.tx; cam.y = cam.ty; cam.anim = null; drawBoard(); return;
    }
    cam.x += dx * 0.24; cam.y += dy * 0.24;
    drawBoard();
    cam.anim = requestAnimationFrame(stepCam);
  }
  function focusUnit(u, instant, borrowed) {
    if (!u || u.x < 0) return;
    var p = ISO.toScreen(u.x, u.y);
    centreOn(p.x, p.y - ISO.ELEV, instant);
    if (borrowed) borrowCamera(); else setHome(p.x, p.y - ISO.ELEV);
  }
  function ensureVisible(u) {
    if (!u || u.x < 0) return;
    var v = viewRect(), p = ISO.toScreen(u.x, u.y);
    var marginX = v.sw * 0.22, marginY = v.sh * 0.22;
    if (p.x < v.sx + marginX || p.x > v.sx + v.sw - marginX ||
      p.y < v.sy + marginY || p.y > v.sy + v.sh - marginY) focusUnit(u);
  }
  function zoomLabel() {
    var lbl = el('zoomlabel');
    if (lbl) lbl.textContent = cam.z <= ZOOMS[0] ? 'all' : '×' + cam.z;
  }
  function nearestZoom(z) {
    var best = ZOOMS[0];
    ZOOMS.forEach(function (q) { if (Math.abs(q - z) < Math.abs(best - z)) best = q; });
    return best;
  }
  function setZoom(dir) {
    hideTerrainTip();
    var i = ZOOMS.indexOf(cam.z);
    if (i < 0) i = ZOOMS.indexOf(nearestZoom(cam.z));
    i = Math.max(0, Math.min(ZOOMS.length - 1, i + dir));
    cam.z = ZOOMS[i];
    cam.tx = cam.x; cam.ty = cam.y;
    zoomLabel();
    setHome(cam.x, cam.y);
    drawBoard();
  }
  /* Zoom a step in or out, keeping whatever is under the given canvas point
     where it is — so the wheel magnifies what the pointer is looking at rather
     than the middle of the frame. */
  function zoomAt(dir, c) {
    var was = cam.z;
    var under = bufferFromCanvas(c);                 // the pixel we are holding
    setZoom(dir);
    if (cam.z === was) return;
    var v = viewRect();
    // where that pixel now sits, and how far the camera must slide to fix it
    var nowAt = { x: (under.x - v.sx) * v.z + v.dx, y: (under.y - v.sy) * v.z + v.dy };
    panBy((nowAt.x - c.x) / cam.z, (nowAt.y - c.y) / cam.z);
    setHome(cam.x, cam.y);
  }
  function fitView() {
    hideTerrainTip();
    cam.z = ZOOMS[0];
    cam.ox = 0; cam.oy = 0;
    cam.x = cam.tx = ISO.PIXW / 2; cam.y = cam.ty = ISO.PIXH / 2;
    zoomLabel();
    setHome(cam.x, cam.y);
    drawBoard();
  }
  function panBy(dx, dy) {
    hideTerrainTip();
    var s = slack();
    // an axis with empty frame either side has no board left to scroll: slide the
    // table through that slack instead, so a drag always does something
    if (s.x > 0.5) cam.ox = (cam.ox || 0) - dx * cam.z; else cam.x = cam.x + dx;
    if (s.y > 0.5) cam.oy = (cam.oy || 0) - dy * cam.z; else cam.y = cam.y + dy;
    clampCam();
    cam.tx = cam.x; cam.ty = cam.y;
    setHome(cam.x, cam.y);            // panning by hand is the player choosing a view
    drawBoard();
  }

  /* Put one structure back on top of whatever has been drawn over it, taking the
     pixels from the layer it was baked into. The clip is the structure's own
     screen quad plus its height, so nothing outside its outline is touched. */
  /* One letter and a colour for the ground a unit is standing on, or nothing at
     all in the open. The letter says what it is; the colour says whether it
     helps (cover, high ground) or hinders (water it cannot fire heavy weapons
     from). A machine takes no cover from terrain (p. 35), so it is only marked
     where the ground still bears on it. */
  var TERRAIN_MARK = {
    woods:     { ch: 'W', col: '#7fc48c' },
    ruins:     { ch: 'R', col: '#b9b4a6' },
    crater:    { ch: 'C', col: '#c0a880' },
    barricade: { ch: 'L', col: '#d8b870' },
    building:  { ch: 'B', col: '#c9c3b4' },
    bunker:    { ch: 'F', col: '#8fb8d0' },
    hill:      { ch: 'H', col: '#e0b464' },
    water:     { ch: '~', col: '#6fb0cc' },
    razed:     { ch: 'r', col: '#9a948a' }
  };
  function terrainMark(u) {
    var kind = R.terrainOf(state, u);
    var m = TERRAIN_MARK[kind];
    if (!m) return null;
    // a hull gets no cover, so only the ground that still costs or helps it shows
    if (R.isMachine(u) && kind !== 'hill' && kind !== 'water') return null;
    return m;
  }

  // the screen rectangle a structure and its height occupy
  function propBox(pr) {
    var c = [
      ISO.toScreen(pr.x, pr.y), ISO.toScreen(pr.x + pr.w, pr.y),
      ISO.toScreen(pr.x + pr.w, pr.y + pr.h), ISO.toScreen(pr.x, pr.y + pr.h)
    ];
    var lift = liftOf(pr.x + pr.w / 2, pr.y + pr.h / 2);
    var top = (pr.height || 0) + lift + K * 0.5;     // a little headroom for the roof trim
    var x0 = Math.floor(Math.min(c[0].x, c[1].x, c[2].x, c[3].x)) - 2;
    var x1 = Math.ceil(Math.max(c[0].x, c[1].x, c[2].x, c[3].x)) + 2;
    var y0 = Math.floor(Math.min(c[0].y, c[1].y, c[2].y, c[3].y) - top) - 2;
    var y1 = Math.ceil(Math.max(c[0].y, c[1].y, c[2].y, c[3].y)) + 3;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /* Put one structure back on top of whatever has been drawn over it, taking the
     pixels from the layer it was baked into. */
  function repaintProp(pr, open) {
    var src = open ? state.structsOpen : state.structs;
    if (!src) return;
    var b = propBox(pr);
    if (b.w <= 0 || b.h <= 0) return;
    pctx.drawImage(src, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
  }

  /* ---------- company colours ----------
     A mercenary outfit that wants its work recognised paints its kit. The player
     picks; the opposition takes one of the colours left, so no two companies on
     the table are ever the same. */
  function drawColourPick() {
    var host = el('colourpick');
    if (!host) return;
    if (!muster.colour) {
      try { muster.colour = localStorage.getItem('pmc-colour') || 'ochre'; } catch (e) { muster.colour = 'ochre'; }
      if (!ISO.COLOURS[muster.colour]) muster.colour = 'ochre';
    }
    host.innerHTML = ISO.COLOUR_KEYS.map(function (k) {
      var c = ISO.COLOURS[k];
      return '<button type="button" class="sw' + (k === muster.colour ? ' on' : '') +
        '" data-colour="' + k + '" title="' + c.name + '">' +
        '<span class="sw-chip" style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' +
        c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span>' +
        '<span class="sw-name">' + c.name + '</span></button>';
    }).join('');
    host.querySelectorAll('[data-colour]').forEach(function (b) {
      b.addEventListener('click', function () {
        muster.colour = b.getAttribute('data-colour');
        try { localStorage.setItem('pmc-colour', muster.colour); } catch (e2) { }
        if (SFX) SFX.click();
        drawColourPick();
      });
    });
  }
  /* A colour for the opposition: anything but the ones already on the table. */
  function foeColour(taken) {
    var free = ISO.COLOUR_KEYS.filter(function (k) { return taken.indexOf(k) < 0; });
    if (!free.length) free = ISO.COLOUR_KEYS.slice();
    return free[Math.floor(Math.random() * free.length)];
  }

  /* Every side's colour in one place, so the markers, rings and zones follow the
     company colours the player chose rather than a pair of constants. */
  function sideInk(side) { return ISO.PALETTE[side] ? ISO.PALETTE[side].ink : '#e7ecf4'; }
  function sideRGB(side) {
    var hex = sideInk(side).replace('#', '');
    return parseInt(hex.slice(0, 2), 16) + ',' + parseInt(hex.slice(2, 4), 16) + ',' + parseInt(hex.slice(4, 6), 16);
  }

  function render() {
    if (!state) return;
    if (state.phase === 'battle') scoreObjectives();
    drawBoard();
    drawHeader();
    drawBar();
    drawStats();
    drawPanel();
    drawLog();
  }

  /* The header's height is what the board is pinned under, and it changes when
     the phase text does. Keep the custom property honest, and resize the board
     when it actually moves. */
  function syncHeaderHeight() {
    var hdr = document.querySelector('header');
    if (!hdr) return;
    var h = Math.round(hdr.getBoundingClientRect().height);
    if (!h || h === ui.hdrH) return;
    ui.hdrH = h;
    document.documentElement.style.setProperty('--hdr', h + 'px');
    if (window.innerWidth > 1000) return;
    requestAnimationFrame(function () {
      if (sizeView(false)) { clampCam(); drawBoard(); }
    });
  }

  function drawHeader() {
    syncHeaderHeight();
    el('hdr-phase').textContent = state.phase === 'terrain' ? 'Terrain set-up' : state.phase === 'deploy' ? 'Deployment' : 'Turn ' + state.turn + ' · Action phase';
    el('hdr-init').textContent = state.initiative ? 'Initiative ' + state.initiative : '—';
    var act = el('hdr-active');
    if (state.over) {
      act.textContent = state.over.winner ? 'Victory: ' + state.over.winner : 'Draw';
      act.className = 'pill pill-' + (state.over.winner || 'none');
    } else if (state.phase === 'terrain') {
      var ta = curArea();
      act.textContent = ta ? 'Terrain: ' + ta.name : 'Terrain';
      act.className = 'pill pill-' + (ta ? ta.side : 'A');
    } else if (state.phase === 'deploy') {
      act.textContent = 'Deploy your force'; act.className = 'pill pill-A';
    } else if (ui.insertion) {
      /* The game is waiting for a place on the table and nothing else. That has
         to be legible from the header, because the prompt itself sits in a panel
         that a phone can have scrolled past or hidden behind another tab. */
      act.textContent = ui.insertion.kind === 'arrive'
        ? 'Place your reinforcements' : 'Pick a landing zone';
      act.className = 'pill pill-wait';
    } else if (state.solo) {
      if (state.activeSide === 'B') { act.textContent = 'OpFor phase'; act.className = 'pill pill-B'; }
      else {
        act.textContent = state.solo.coop ? soloOwnerName(state.activeOwner) + ' to act' : 'Your commando';
        act.className = 'pill pill-' + (state.solo.coop && state.activeOwner === 2 ? 'C' : 'A');
      }
    } else {
      act.textContent = 'Activating: ' + sideName(state.activeSide);
      act.className = 'pill pill-' + state.activeSide;
    }
    if (state.solo && state.phase !== 'deploy' && state.phase !== 'terrain') {
      el('hdr-phase').textContent = 'Turn ' + state.turn + ' · ' + (state.activeSide === 'B' ? 'OpFor phase' : 'Action phase');
      el('hdr-init').textContent = state.scen.name;
    }
    var held = { A: 0, B: 0 };
    state.objectives.forEach(function (o) { if (o.owner) held[o.owner]++; });
    el('hdr-obj').innerHTML = 'Objectives <b>' + held.A + '</b>–<b>' + held.B + '</b>';
    // in the three asymmetric scenarios, which side of it the player is on
    var rl = el('hdr-role');
    if (rl) {
      var you = playerSide(), r = roleOf(you);
      if (r) {
        rl.hidden = false;
        rl.textContent = r === 'attacker' ? 'You attack' : 'You defend';
        rl.className = 'meta role role-' + r;
      } else if (state.sc && state.sc.attacker) {
        rl.hidden = false;
        rl.textContent = (state.cfg[state.sc.attacker === 'A' ? 'nameA' : 'nameB']) + ' attacks';
        rl.className = 'meta role role-attacker';
      } else { rl.hidden = true; }
    }
  }

  /* ---------- board ---------- */
  /* The table is painted onto two plates: the ground, which is expensive to bake
     and never changes, and the structures, which are cheap and have to be repainted
     whenever something is knocked down. */
  function buildScene() {
    state.ground = ISO.bakeGround(state.terrain, state.seed, state.cfg.planet);
    state.structs = document.createElement('canvas');
    state.structs.width = ISO.PIXW; state.structs.height = ISO.PIXH;
    paintStructures();
    state.scene = state.ground;
    if (state.tset && state.phase === 'terrain') state.tset.baked = state.terrain.length;
  }

  function paintStructures() {
    state.props = ISO.buildProps(state.terrain, state.objectives, state.seed, state.cfg.planet);
    var sg = state.structs.getContext('2d');
    sg.clearRect(0, 0, state.structs.width, state.structs.height);
    state.props.forEach(function (p) { ISO.drawProp(sg, p, liftOf(p.x, p.y)); });
    /* And the same table again with every building cut away — the near walls off
       so you can see into the room. A building with somebody inside it, or with
       somebody behind it, is composited from this layer instead of the solid
       one, which is what lets the player see the troops a wall would hide. */
    state.structsOpen = document.createElement('canvas');
    state.structsOpen.width = ISO.PIXW; state.structsOpen.height = ISO.PIXH;
    var og = state.structsOpen.getContext('2d');
    og.clearRect(0, 0, state.structsOpen.width, state.structsOpen.height);
    state.props.forEach(function (p) { ISO.drawProp(og, p, liftOf(p.x, p.y), true); });
  }

  /* Something has come down: repaint the structures and let the player see it. */
  function repaintTerrain(wrecks) {
    if (!wrecks || !wrecks.length || !state.structs) return;
    paintStructures();
    ui.vis = null; ui.visKey = '';
    wrecks.forEach(function (w) {
      var r = w.piece;
      addFx({
        kind: 'collapse', x: r.x + r.w / 2, y: r.y + r.h / 2,
        r: Math.max(1.5, Math.max(r.w, r.h) * 0.7), dur: 900
      });
    });
    if (SFX && SFX.broken) SFX.broken();
    render();
  }

  function syncRemains() {
    if (!state || !state.units) return;
    var rem = state.remains || (state.remains = []);
    state.units.forEach(function (u) {
      var seen = u._seen, here = u.alive && u.x >= 0 && !u.aboard;
      if (seen && seen.here) {
        if (R.isMachine(u)) {
          if (!u.alive && !u.fled && !u._wrecked) {
            u._wrecked = true;
            // a snapshot, so the wreck stays a wreck even if the unit itself is used again
            var snap = {};
            for (var k in u) snap[k] = u[k];
            snap.alive = false; snap.cargo = []; snap.damage = 0; snap.marked = false;
            rem.push({ kind: 'wreck', id: u.id, x: seen.x, y: seen.y, snap: snap, t0: Math.floor(Math.random() * 5000) });
          }
        } else {
          var left = u.alive ? (u.models || 0) : u.fled ? seen.models : 0;
          for (var n = seen.models; n > left; n--) {
            var cs = ISO.casualtySpot(u, n, rem.length * 7 + n);
            rem.push({ kind: 'body', x: seen.x, y: seen.y, dx: cs.dx, dy: cs.dy, side: u.side, paint: u.paint || null,
              art: u.art, mi: cs.mi, flip: (rem.length % 3 === 0) !== !!u.faceL });
          }
        }
      }
      u._seen = { here: here, x: u.x, y: u.y, models: u.models || 0 };
      // a unit the engine has sent back to the OpFor pool is off the table now
      if (u.wave === 'pool' && u.x < 0) u._seen = { here: false, x: -1, y: -1, models: u.models };
    });
    // the table only holds so many; the oldest dead go first, never a wreck
    var bodies = rem.filter(function (r) { return r.kind === 'body'; });
    if (bodies.length > 240) {
      var drop = bodies.slice(0, bodies.length - 240);
      state.remains = rem.filter(function (r) { return drop.indexOf(r) < 0; });
    }
  }
  /* Between moves the board is still: it is only redrawn while something on
     screen is alive by itself. A burning wreck flickers well enough at about
     eight frames a second; heat haze is a slow ripple, and at that rate it
     steps rather than flows, so lava in view gets about sixteen. */
  var ambientTick = 0;
  setInterval(function () {
    if (!state || !state.scene || loop || document.hidden) return;
    ambientTick++;
    if (state.hazeOnView || (state.fireOnView && ambientTick % 2 === 0)) drawBoard();
  }, 60);

  /* ================= heat haze =================
     The air over a lava field shimmers. The ground under and just above the
     melt is taken back off the frame and laid down again in bands a pixel
     tall, each pushed sideways by a ripple that drifts upward, the way hot air
     rises — strongest at the melt, fading to nothing a couple of inches up.

     It is done to the terrain only, before any unit or prop is drawn, so the
     ground wavers while the troops standing by it stay sharp enough to read.
     The offsets are whole pixels, so the pixel art is never smeared, and it is
     left out entirely for a player whose system asks for less motion. */
  var hazeBuf = null, hazeCtx = null;
  var calmMotion = false;
  try { calmMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { }

  // the outline round a set of points, for clipping the shimmer to the air over the melt
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    if (pts.length < 3) return pts;
    function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
    var lo = [], up = [];
    pts.forEach(function (p) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
      lo.push(p);
    });
    for (var i = pts.length - 1; i >= 0; i--) {
      var p = pts[i];
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
      up.push(p);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  function heatHaze(v) {
    state.hazeOnView = false;
    if (calmMotion || !state.terrain) return;
    var lavas = state.terrain.filter(function (r) { return r.kind === 'lava' && !r.wrecked; });
    if (!lavas.length) return;
    var t = nowMs() / 1000;
    var rise = K * 2.2;                 // how high over the melt the air still wavers, in plate pixels
    var AMP = 1.3;                      // the widest sway, in plate pixels: heat haze, not an earthquake

    lavas.forEach(function (r, li) {
      var foot = (r.poly || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])
        .map(function (q) { return ISO.toScreen(q[0], q[1]); });
      // the melt, and the same outline lifted: the column of hot air standing over it
      var shape = hull(foot.concat(foot.map(function (p) { return { x: p.x, y: p.y - rise }; })));
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      shape.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      var meltTop = Math.min.apply(null, foot.map(function (p) { return p.y; }));
      // only what is in the window, with room either side for the sway
      var bx0 = Math.max(v.sx, Math.floor(x0 - AMP - 1)), bx1 = Math.min(v.sx + v.sw, Math.ceil(x1 + AMP + 1));
      var by0 = Math.max(v.sy, Math.floor(y0)), by1 = Math.min(v.sy + v.sh, Math.ceil(y1));
      if (bx1 <= bx0 || by1 <= by0) return;
      state.hazeOnView = true;

      // the patch as it stands, in the window's own pixels
      var px0 = Math.round((bx0 - v.sx) * SS), py0 = Math.round((by0 - v.sy) * SS);
      var pwid = Math.round((bx1 - bx0) * SS), phei = Math.round((by1 - by0) * SS);
      if (pwid < 1 || phei < 1) return;
      if (!hazeBuf) { hazeBuf = document.createElement('canvas'); hazeCtx = hazeBuf.getContext('2d'); }
      if (hazeBuf.width < pwid || hazeBuf.height < phei) {
        hazeBuf.width = Math.max(hazeBuf.width, pwid); hazeBuf.height = Math.max(hazeBuf.height, phei);
      }
      hazeCtx.setTransform(1, 0, 0, 1, 0, 0);
      hazeCtx.clearRect(0, 0, pwid, phei);
      hazeCtx.drawImage(pix, px0, py0, pwid, phei, 0, 0, pwid, phei);

      pctx.save();
      // clip to the column of air, in plate coordinates, then work in the window's pixels
      pctx.beginPath();
      shape.forEach(function (p, n) { if (n) pctx.lineTo(p.x, p.y); else pctx.moveTo(p.x, p.y); });
      pctx.closePath();
      pctx.clip();
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.imageSmoothingEnabled = false;
      var band = Math.max(1, Math.round(SS));           // a plate pixel tall
      var seed = li * 1.7;                              // no two fields ripple in step
      for (var yy = 0; yy < phei; yy += band) {
        var plateY = by0 + yy / SS;
        // full strength over the melt and just above it, dying away to the top of the column
        var k = plateY >= meltTop ? 0.75 : Math.max(0, 1 - (meltTop - plateY) / rise);
        if (k <= 0.02) continue;
        // two ripples of different lengths, both drifting up, so it never looks like a pattern
        var sway = Math.sin(plateY * 0.9 + t * 5.2 + seed) + 0.45 * Math.sin(plateY * 0.37 - t * 2.3 + seed * 2);
        var dx = Math.round(AMP * k * sway * SS / 1.45);
        if (!dx) continue;
        var hgt = Math.min(band, phei - yy);
        pctx.drawImage(hazeBuf, 0, yy, pwid, hgt, px0 + dx, py0 + yy, pwid, hgt);
      }
      pctx.restore();
    });
  }

  function drawBoard() {
    // everything drawn on the board itself is in CSS pixels, scaled to its density
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // the plate is large: paint it once, off the first frame, with a word to the player
    if (!state.scene) {
      if (!state.baking) {
        state.baking = true;
        ctx.fillStyle = '#080b10';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.fillStyle = '#93a1b5';
        ctx.font = '600 15px Oxanium, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Building the table…', VIEW_W / 2, VIEW_H / 2);
        setTimeout(function () {
          if (!state) return;
          buildScene();
          state.baking = false;
          drawBoard();
        }, 30);
      }
      return;
    }

    syncRemains();
    // only the visible window is redrawn each frame, so cost does not follow the plate size
    var v = viewRect();
    /* The working window is drawn as finely as the screen can show, up to twice
       the plate: the terrain is scaled up into it pixel for pixel, and the units,
       rings and effects are drawn straight in at that resolution. Its size is
       bounded by the screen, never by the plate, so a phone's memory is safe. */
    SS = Math.min(2, Math.max(1, v.z * DPR));
    var pw = Math.ceil(v.sw * SS), ph = Math.ceil(v.sh * SS);
    if (pix.width < pw || pix.height < ph) {
      pix.width = Math.max(pix.width, pw);
      pix.height = Math.max(pix.height, ph);
    }
    pctx.setTransform(SS, 0, 0, SS, -v.sx * SS, -v.sy * SS);
    pctx.imageSmoothingEnabled = false;
    // the plate is transparent outside the table's diamond, so the window has to be
    // cleared first — otherwise sprites drawn over that void smear as the camera moves
    pctx.fillStyle = '#080b10';
    pctx.fillRect(v.sx, v.sy, v.sw, v.sh);
    pctx.drawImage(state.ground, v.sx, v.sy, v.sw, v.sh, v.sx, v.sy, v.sw, v.sh);
    pctx.drawImage(state.structs, v.sx, v.sy, v.sw, v.sh, v.sx, v.sy, v.sw, v.sh);
    heatHaze(v);

    var pad = K * 3;
    function onView(x, y) {
      var p = ISO.toScreen(x, y);
      return p.x > v.sx - pad && p.x < v.sx + v.sw + pad &&
        p.y > v.sy - pad * 2 && p.y < v.sy + v.sh + pad;
    }

    function propDepth(pr) { return pr.x + pr.w + pr.y + pr.h; }
    /* A building opens up — drawn with its near walls off — when it would
       otherwise hide somebody: a squad standing inside it, or one behind it that
       its silhouette covers. Every other building stays solid, and is put back
       over the units the depth sort says are behind it. */
    var blockers = [];
    (state.props || []).forEach(function (pr) {
      if (pr.kind !== 'building' && pr.kind !== 'bunker' && pr.kind !== 'highwall') return;
      if (!onView(pr.x + pr.w / 2, pr.y + pr.h / 2)) return;
      var depth = propDepth(pr), b = null;
      var open = state.units.some(function (u) {
        if (!onTable(u)) return false;
        var ux = dispX(u), uy = dispY(u);
        if (R.inRect(ux, uy, pr)) return true;                 // inside it — a garrison is seen through the cut-away walls
        if (ux + uy >= depth) return false;                    // in front: nothing to hide
        if (!b) b = propBox(pr);
        // behind it, and under its outline
        var sp = ISO.toScreen(ux, uy), l = liftOf(ux, uy);
        var head = ISO.headroom(u.models, R.status(u), u);
        return sp.x > b.x - K * 0.6 && sp.x < b.x + b.w + K * 0.6 &&
          sp.y - l > b.y && sp.y - l - head < b.y + b.h;
      });
      blockers.push({ pr: pr, depth: depth, draw: 'block', open: open });
    });

    // a building that is hiding somebody is recomposited with its near walls off
    blockers.forEach(function (it) { if (it.open) repaintProp(it.pr, true); });

    // reachable ground
    if (ui.moves.length) {
      var mw = Math.ceil(K * 0.6), mh = Math.ceil(K * 0.35);
      ui.moves.forEach(function (c) {
        if (!onView(c.x, c.y)) return;
        var p = ISO.toScreen(c.x, c.y);
        var l = liftOf(c.x, c.y);
        pctx.fillStyle = ((c.x * 2 + c.y * 2) | 0) % 2 ? 'rgba(122,206,152,.30)' : 'rgba(96,180,130,.26)';
        pctx.fillRect(Math.round(p.x) - mw / 2, Math.round(p.y) - l - mh / 2, mw, mh);
      });
    }

    /* ---- units and the buildings that hide them ----
       The structures are one baked layer under everything, so a unit used to be
       drawn over every building whatever side of it the unit was on — an empty
       block read as glass with troops behind it. So the solid buildings are put
       back into the same depth sort as the units: anything further from the
       camera than a building is drawn first and then covered by it, and only the
       garrison of an occupied building — drawn at its own depth, just after it —
       is meant to show through the near wall.

       Occupied is what the player cares about: a squad is in the building if it
       is standing inside its footprint, and then you want to see it. */
    var now0 = nowMs();
    var order = state.units.filter(function (u) { return onTable(u) && onView(dispX(u), dispY(u)); })
      .map(function (u) {
        var d = dispX(u) + dispY(u);
        /* A unit inside a building belongs just in front of it, so it is drawn
           over the near wall rather than being buried by it. */
        (state.props || []).forEach(function (pr) {
          if (pr.kind !== 'building' && pr.kind !== 'bunker') return;
          if (R.inRect(dispX(u), dispY(u), pr)) d = Math.max(d, propDepth(pr) + 0.01);
        });
        return { unit: u, depth: d, draw: 'unit' };
      });

    // squads walking into a hull, drawn until they are inside it
    state.units.forEach(function (u) {
      var bd = u.boarding;
      if (!bd) return;
      var age = now0 - bd.t0;
      if (age >= bd.dur || !u.alive) { u.boarding = null; return; }
      var k = age / bd.dur, bx = bd.a.x + (bd.b.x - bd.a.x) * k, by = bd.a.y + (bd.b.y - bd.a.y) * k;
      if (!onView(bx, by)) return;
      order.push({ depth: bx + by, draw: 'boarding', u: u, x: bx, y: by, k: k, age: age, up: bd.up });
    });
    // the dead and the wrecks stay where they fell
    var now = now0, anyFire = false;
    (state.remains || []).forEach(function (r) {
      if (!onView(r.x, r.y)) return;
      if (r.kind === 'wreck') {
        var wu = r.snap || unitById(r.id);
        if (!wu) return;
        anyFire = true;
        order.push({ depth: r.x + r.y, draw: 'wreck', r: r, u: wu });
      } else order.push({ depth: r.x + r.y - 0.4, draw: 'body', r: r });
    });
    state.fireOnView = anyFire;

    order.concat(blockers)
      .sort(function (a, b) { return a.depth - b.depth; })
      .forEach(function (it) {
        if (it.draw === 'block') { if (!it.open) repaintProp(it.pr); return; }
        if (it.draw === 'body') {
          var bp = ISO.toScreen(it.r.x, it.r.y);
          ISO.drawBody(pctx, bp.x + it.r.dx, bp.y + it.r.dy - liftOf(it.r.x, it.r.y), it.r);
          return;
        }
        if (it.draw === 'boarding') {
          pctx.save();
          if (it.up) pctx.globalAlpha = Math.max(0.15, 1 - it.k * 0.7);   // climbing up into the craft
          ISO.drawUnit(pctx, it.u, {
            at: { x: it.x, y: it.y }, lift: liftOf(it.x, it.y) + (it.up ? it.up * Math.max(0, (it.k - 0.35) / 0.65) : 0),
            hop: 0, walk: 1 + Math.floor(it.age / 170) % 2, status: 'ready', activated: false, selected: false, morale: 0
          });
          pctx.restore();
          return;
        }
        if (it.draw === 'wreck') {
          ISO.drawWreck(pctx, it.u, { x: it.r.x, y: it.r.y }, liftOf(it.r.x, it.r.y), now + it.r.t0);
          return;
        }
        var u = it.unit, ax = dispX(u), ay = dispY(u);
        var arr = arriving(u);
        ISO.drawUnit(pctx, u, {
          at: { x: ax, y: ay },
          around: u.bld ? R.sectionRect(u) : null,
          lift: liftOf(ax, ay) + arr.lift,
          hop: u.hop || 0,
          walk: u.walk || 0,
          arc: u.arc || 0,
          status: arr.status || R.status(u),
          activated: u.activated,
          selected: ui.selected === u,
          morale: R.currentMorale(u)
        });
      });

    /* The ghost: where the unit would stand if the move went ahead. Drawn over
       everything at half weight, with the path it would walk. */
    if (ui.preview && ui.preview.unit && onView(ui.preview.spot.x, ui.preview.spot.y)) {
      var pv = ui.preview, gx = pv.spot.x, gy = pv.spot.y;
      var from = ISO.toScreen(pv.unit.x, pv.unit.y), to = ISO.toScreen(gx, gy);
      pctx.save();
      pctx.globalAlpha = 0.55;
      pctx.strokeStyle = sideInk(pv.unit.side);
      pctx.lineWidth = Math.max(1, ISO.PIXEL);
      pctx.setLineDash([Math.max(2, ISO.PIXEL * 2), Math.max(2, ISO.PIXEL * 2)]);
      pctx.beginPath();
      pctx.moveTo(from.x, from.y - liftOf(pv.unit.x, pv.unit.y));
      (pv.path || []).forEach(function (q) {
        var sp = ISO.toScreen(q.x, q.y);
        pctx.lineTo(sp.x, sp.y - liftOf(q.x, q.y));
      });
      pctx.lineTo(to.x, to.y - liftOf(gx, gy));
      pctx.stroke();
      pctx.setLineDash([]);
      ISO.ellipse(pctx, to.x, to.y - liftOf(gx, gy), K * 0.8, K * 0.4,
        pv.unit.side === 'A' ? 'rgba(240,182,74,.25)' : 'rgba(111,196,226,.25)');
      pctx.globalAlpha = 0.5;
      ISO.drawUnit(pctx, pv.unit, {
        at: { x: gx, y: gy }, lift: liftOf(gx, gy), hop: 0, walk: 0,
        status: R.status(pv.unit), activated: false, selected: false,
        morale: R.currentMorale(pv.unit)
      });
      pctx.restore();
    }

    drawFx();
    pctx.setTransform(1, 0, 0, 1, 0, 0);

    /* Put the window on the screen in backing pixels. When the working window
       is already at the screen's own density this is one-to-one; zoomed out it
       is a downscale, and only then is smoothing allowed, so the art is never
       blurred on the way up.

       Any downscale, not only a big one. Shrinking pixel art without smoothing
       keeps some rows and drops others, and at a ratio like 0.55 that is close
       to every other row: the ground's dithered blend between grass and dirt
       then beats into a coarse checkerboard. The threshold used to be 0.5,
       which left exactly that band — ×0.55 on a one-to-one screen — unsmoothed. */
    var f = v.z * DPR / SS;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = f < 0.999;
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(pix, 0, 0, v.sw * SS, v.sh * SS,
      v.dx * DPR, v.dy * DPR, v.sw * v.z * DPR, v.sh * v.z * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;

    drawHUD();
  }

  /* What a solitaire table carries besides terrain: the OpFor counters still to
     be revealed, the entry points it pours in through, the players' landing
     zones, the evacuation point or the safe zone, and the objectives to blow. */
  function drawSoloMarks() {
    var sc = state.sc || {}, z = cam.z;
    var inkB = sideInk('B'), inkA = sideInk('A');
    function label(x, y, text, col) {
      var p = hud(x, y, liftOf(x, y));
      ctx.font = '600 ' + Math.max(9, Math.round(10 * Math.min(1.4, z + 0.2))) + 'px Oxanium, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,.75)'; ctx.strokeText(text, p.x, p.y);
      ctx.fillStyle = col; ctx.fillText(text, p.x, p.y);
    }
    ctx.save();
    // the safe zone and the evacuation point
    if (sc.safe) {
      ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(122,206,144,.8)';
      ctx.fillStyle = 'rgba(122,206,144,.08)';
      isoRing(sc.safe.x, sc.safe.y, sc.safe.r, 0); ctx.fill(); ctx.stroke();
      var b = sc.safeBuilding;
      if (b) label(b.x + b.w / 2, b.y + b.h / 2 + 3.2, 'SAFE ZONE', 'rgb(150,226,170)');
      (sc.homes || []).forEach(function (h) { label(h.x + h.w / 2, h.y + h.h / 2 + 2.8, 'CIVILIANS', 'rgb(236,228,200)'); });
    }
    if (sc.evac) {
      ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(122,206,144,.85)';
      isoRing(sc.evac.x, sc.evac.y, 6, liftOf(sc.evac.x, sc.evac.y)); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(122,206,144,.4)';
      isoRing(sc.evac.x, sc.evac.y, 12, liftOf(sc.evac.x, sc.evac.y)); ctx.stroke();
      label(sc.evac.x, sc.evac.y, 'EVAC', 'rgb(150,226,170)');
    }
    // the landing zones
    if (sc.lz) Object.keys(sc.lz).forEach(function (o) {
      var l = sc.lz[o];
      ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
      ctx.strokeStyle = o === '2' ? sideInk('C') : inkA;
      isoRing(l.x, l.y, 4, liftOf(l.x, l.y)); ctx.stroke();
      if (state.turn <= 2) label(l.x, l.y, state.solo.coop ? 'LZ ' + o : 'LZ', o === '2' ? sideInk('C') : inkA);
    });
    ctx.setLineDash([]);
    // entry points
    (sc.entries || []).forEach(function (e) {
      var p = hud(e.x, e.y, liftOf(e.x, e.y)), r = Math.max(5, 7 * z);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); ctx.closePath();
      ctx.fillStyle = 'rgba(8,10,14,.55)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = inkB; ctx.stroke();
      label(e.x + 1.2, e.y + 1.2, e.id, inkB);
    });
    // Sabotage: the targets, standing or blown
    (sc.targets || []).forEach(function (t) {
      ctx.lineWidth = 2.5; ctx.strokeStyle = t.destroyed ? 'rgba(140,140,140,.6)' : '#e8c15a';
      isoRing(t.x, t.y, 1, liftOf(t.x, t.y)); ctx.stroke();
      var p = hud(t.x, t.y, liftOf(t.x, t.y)), r = Math.max(3, 4 * z);
      ctx.beginPath(); ctx.moveTo(p.x - r, p.y - r / 2); ctx.lineTo(p.x + r, p.y + r / 2);
      ctx.moveTo(p.x + r, p.y - r / 2); ctx.lineTo(p.x - r, p.y + r / 2); ctx.stroke();
      if (!t.destroyed) label(t.x + 1.6, t.y + 1.6, 'TARGET', '#e8c15a');
    });
    // the counters: a token each, still hiding a unit from the pool
    (sc.counters || []).forEach(function (c) {
      var p = hud(c.x, c.y, liftOf(c.x, c.y)), rx = Math.max(6, 0.9 * K * z * Math.SQRT2), ry = rx / 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8,10,14,.45)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(30,34,42,.92)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = inkB; ctx.stroke();
      ctx.font = '700 ' + Math.max(9, Math.round(ry * 1.5)) + 'px Oxanium, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = inkB; ctx.fillText('?', p.x, p.y + 0.5);
    });
    ctx.restore();
  }

  function isoRing(cx, cy, rad, lift) {
    var p = hud(cx, cy, lift), z = cam.z;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.SQRT2 * rad * K * z, Math.SQRT2 * rad * K * z / 2, 0, 0, Math.PI * 2);
  }

  function blockingAt(x, y) {
    var out = [];
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i];
      if (R.TERRAIN[r.kind].blocks && R.inRect(x, y, r)) out.push(r);
    }
    return out;
  }

  /* What a unit can see from where it stands — or, with `at`, from a spot it is
     thinking about moving to, which is what the move preview draws. */
  function visibility(u, at) {
    var from = at || u;
    // a Xenotripod sees no further than its Limited Senses let it (p. 129)
    var radius = Math.min(R.sightRange(u), R.xenoSenses(u) ? 99 : u.range + 2 * UR);
    var inside = blockingAt(from.x, from.y);
    var pts = [];
    for (var a = 0; a < Math.PI * 2; a += Math.PI / 96) {
      var dx = Math.cos(a), dy = Math.sin(a), last = 0;
      for (var d = 0.5; d <= radius; d += 0.5) {
        var x = from.x + dx * d, y = from.y + dy * d;
        if (x < 0 || y < 0 || x > W || y > H) break;
        var blocked = false;
        for (var i = 0; i < state.terrain.length; i++) {
          var r = state.terrain[i];
          if (!R.TERRAIN[r.kind].blocks) continue;
          if (inside.indexOf(r) >= 0) continue;
          if (R.inRect(x, y, r)) { blocked = true; break; }
        }
        if (blocked) break;
        last = d;
      }
      pts.push({ x: from.x + dx * last, y: from.y + dy * last });
    }
    return pts;
  }

  function drawHUD() {
    var i;
    /* The ground each side may deploy into. It used to be painted as a flat 6"
       band on each table edge whatever the scenario actually said — wrong for
       Invasion's inset zones and for the circles in Demolish and Hostile
       takeover — and faint enough to be invisible on a phone. It now draws the
       real zone, and the one the player has to fill is the one that stands out. */
    /* Terrain set-up: the area being laid is lit and the rest of the table
       dimmed, each area carries its compass name, and the next piece follows
       the pointer where it would land. */
    if (state.phase === 'terrain' && state.tset) {
      var ta = curArea();
      state.tset.areas.forEach(function (ar) {
        var q = [hud(ar.x, ar.y), hud(ar.x + ar.w, ar.y), hud(ar.x + ar.w, ar.y + ar.h), hud(ar.x, ar.y + ar.h)];
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (var n = 1; n < 4; n++) ctx.lineTo(q[n].x, q[n].y);
        ctx.closePath();
        var now = ar === ta;
        if (!now) { ctx.fillStyle = 'rgba(6,9,14,' + (ar.done ? .18 : .38) + ')'; ctx.fill(); }
        else {
          var col = sideRGB(ar.side);
          ctx.fillStyle = 'rgba(' + col + ',.1)'; ctx.fill();
          ctx.strokeStyle = 'rgba(' + col + ',.95)'; ctx.lineWidth = 2.5; ctx.setLineDash([9, 7]); edgedStroke(); ctx.setLineDash([]);
        }
        var c0 = hud(ar.x + ar.w / 2, ar.y + ar.h / 2);
        ctx.font = '700 ' + Math.round(13 + 6 * Math.min(1, cam.z)) + 'px Oxanium, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // outlined dark, so the name reads over snow and sand as well as over soil
        ctx.lineJoin = 'round'; ctx.lineWidth = 4;
        ctx.strokeStyle = now ? 'rgba(8,10,14,.6)' : 'rgba(8,10,14,.35)';
        ctx.strokeText(ar.name, c0.x, c0.y);
        ctx.fillStyle = now ? 'rgba(255,255,255,.85)' : 'rgba(220,228,240,.45)';
        ctx.fillText(ar.name, c0.x, c0.y);
      });
      // pieces down since the table was last baked, as flat footprints until it is
      var TINT = { woods: '64,110,52', ruins: '120,112,100', crater: '110,96,80', barricade: '150,140,112', rocks: '118,112,104',
        hill: '128,120,82', building: '150,138,120', bunker: '120,126,130', wall: '140,136,128', water: '70,110,140', deep: '40,70,110', lava: '200,80,30' };
      state.terrain.slice(state.tset.baked || 0).forEach(function (pc) {
        var sh = pc.parts ? pc.parts.map(function (r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })
          : [pc.poly || [[pc.x, pc.y], [pc.x + pc.w, pc.y], [pc.x + pc.w, pc.y + pc.h], [pc.x, pc.y + pc.h]]];
        ctx.fillStyle = 'rgba(' + (TINT[pc.kind] || '140,140,140') + ',.85)';
        ctx.strokeStyle = 'rgba(20,20,20,.6)'; ctx.lineWidth = 1;
        sh.forEach(function (pts) {
          ctx.beginPath();
          pts.forEach(function (q, n) { var s2 = hud(q[0], q[1]); if (n) ctx.lineTo(s2.x, s2.y); else ctx.moveTo(s2.x, s2.y); });
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      });
      var g = state.tset.ghost;
      if (ta && g && ui.hover && !isAI(ta.side)) {
        var spot = fitGhost(ta, ui.hover.x, ui.hover.y);
        var inside = ui.hover.x >= ta.x - 2 && ui.hover.x <= ta.x + ta.w + 2 && ui.hover.y >= ta.y - 2 && ui.hover.y <= ta.y + ta.h + 2;
        var at = spot && inside ? spot : { x: ui.hover.x - g.w / 2, y: ui.hover.y - g.h / 2 };
        var gp = clonePiece(g);
        R.placePiece(gp, at.x, at.y);
        var shapes = gp.parts ? gp.parts.map(function (r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })
          : [gp.poly || [[gp.x, gp.y], [gp.x + gp.w, gp.y], [gp.x + gp.w, gp.y + gp.h], [gp.x, gp.y + gp.h]]];
        var ok = spot && inside;
        ctx.fillStyle = ok ? 'rgba(' + sideRGB(ta.side) + ',.38)' : 'rgba(200,72,64,.32)';
        ctx.strokeStyle = ok ? 'rgba(255,255,255,.9)' : 'rgba(230,110,100,.9)';
        ctx.lineWidth = 1.6;
        shapes.forEach(function (pts) {
          ctx.beginPath();
          pts.forEach(function (q, n) { var s2 = hud(q[0], q[1]); if (n) ctx.lineTo(s2.x, s2.y); else ctx.moveTo(s2.x, s2.y); });
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      }
    }
    if (state.phase === 'deploy') {
      var placing = placingSide();
      ['A', 'B'].forEach(function (side) {
        var own = side === placing;
        var col = sideRGB(side);
        var circ = state.sc && state.sc.defCircle && state.sc.defender === side
          ? state.sc.defCircle : null;
        ctx.fillStyle = 'rgba(' + col + ',' + (own ? .3 : .12) + ')';
        ctx.strokeStyle = 'rgba(' + col + ',' + (own ? .95 : .35) + ')';
        ctx.lineWidth = own ? 2.5 : 1.2;
        ctx.setLineDash(own ? [9, 7] : [5, 7]);
        var boxes = boxesFor(side);
        if (circ) {
          isoRing(circ.x, circ.y, circ.r, liftOf(circ.x, circ.y));
          ctx.fill(); edgedStroke(own ? 0.45 : 0.2);
        } else if (boxes) {
          // Demolish: the stretches of table edge this side owns
          ctx.beginPath();
          boxes.forEach(function (b) {
            var q = [hud(b.x, b.y), hud(b.x + b.w, b.y), hud(b.x + b.w, b.y + b.h), hud(b.x, b.y + b.h)];
            ctx.moveTo(q[0].x, q[0].y);
            for (var n = 1; n < 4; n++) ctx.lineTo(q[n].x, q[n].y);
            ctx.closePath();
          });
          ctx.fill(); edgedStroke(own ? 0.45 : 0.2);
        } else {
          var z = zoneFor(side);
          if (!z) { ctx.setLineDash([]); return; }
          // Invasion's defender holds a box set in from every edge, not a strip
          var ins = (state.sc && state.sc.inset && state.sc.defender === side) ? state.sc.inset : 0;
          /* the strip is kept a model's radius in from the edge so a unit's centre
             stays on the table, but the ground it covers runs right to the edge */
          var zx0 = z[0] <= UR + 0.01 ? 0 : z[0], zx1 = z[1] >= W - UR - 0.01 ? W : z[1];
          var a = hud(zx0, ins), b = hud(zx1, ins), c = hud(zx1, H - ins), d = hud(zx0, H - ins);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
          ctx.closePath();
          ctx.fill(); edgedStroke(own ? 0.45 : 0.2);
        }
        ctx.setLineDash([]);
      });
    }

    /* The ground a Battlefield Insertion may legally come down on — everything
       outside 12" of an objective and 4" in from the edge. It used to be an
       invisible rule the player had to guess at, one refused tap at a time. */
    if (ui.insertion) {
      /* Painted strongly enough to be read at arm's length on a phone with the
         table zoomed out: at the old .16 the legal ground was all but invisible,
         and a player who missed the prompt had nothing on the table to go on. */
      var forbid = 'rgba(200,72,64,.15)';
      ctx.fillStyle = 'rgba(122,206,144,.28)';
      ui.insertion.spots.forEach(function (s) {
        var q = [hud(s.x - 1, s.y - 1), hud(s.x + 1, s.y - 1), hud(s.x + 1, s.y + 1), hud(s.x - 1, s.y + 1)];
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (var n = 1; n < 4; n++) ctx.lineTo(q[n].x, q[n].y);
        ctx.closePath(); ctx.fill();
      });
      // and the 12" exclusion round each objective, so the shape makes sense
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(224,120,104,.6)';
      ctx.fillStyle = forbid;
      state.objectives.forEach(function (o) {
        isoRing(o.x, o.y, 12, liftOf(o.x, o.y));
        ctx.fill(); ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    if (state.solo) drawSoloMarks();

    // objective control radius
    state.objectives.forEach(function (o) {
      var col = o.owner ? sideInk(o.owner) : 'rgba(235,240,248,.6)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,.5)';
      isoRing(o.x, o.y, 4, liftOf(o.x, o.y)); ctx.stroke();
      ctx.lineWidth = 1.4; ctx.strokeStyle = col;
      isoRing(o.x, o.y, 4, liftOf(o.x, o.y)); ctx.stroke();
      ctx.setLineDash([]);
    });

    var u = ui.selected;
    if (u && u.alive) {
      var lift = liftOf(u.x, u.y);
      // keep the auras on the table
      ctx.save();
      var corners = [hud(0, 0), hud(W, 0), hud(W, H), hud(0, H)];
      ctx.beginPath();
      corners.forEach(function (c, n) { if (n === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y); });
      ctx.closePath(); ctx.clip();
      /* While a move is being previewed the sight lines and the range rings are
         drawn from where the unit WOULD be, because that is the question the
         player is actually asking. */
      var eye = ui.preview ? ui.preview.spot : u;
      var eyeLift = ui.preview ? liftOf(eye.x, eye.y) : lift;
      var key = u.id + ':' + eye.x.toFixed(2) + ':' + eye.y.toFixed(2);
      if (!ui.vis || ui.visKey !== key) { ui.vis = visibility(u, eye); ui.visKey = key; }
      ctx.save();
      ctx.beginPath();
      ui.vis.forEach(function (p, n) {
        var s = hud(p.x, p.y, 0);
        if (n === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(' + sideRGB(u.side) + ',.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.4)';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();

      /* Mental Projection (p. 129): what one Xenotripod sees, the tribe sees.
         Every other unbroken member's 12" of sight is drawn faintly across the
         table, and each enemy the tribe can see is ringed. */
      if (R.xenoSenses(u) && !R.campFlag(u, 'banished')) {
        var tkey = state.turn + ':' + state.log.length + ':' + u.id;
        if (ui.tribeKey !== tkey) {
          ui.tribeKey = tkey;
          ui.tribe = {
            seers: activeUnits(u.side).filter(function (o) {
              return o !== u && R.xenoSenses(o) && !R.campFlag(o, 'banished') && R.status(o) !== 'broken';
            }),
            seen: activeUnits().filter(function (e) { return e.side !== u.side && R.tribeSees(state, u.side, e); })
          };
        }
        ctx.lineWidth = 1;
        ui.tribe.seers.forEach(function (o) {
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.32)';
          isoRing(o.x, o.y, R.sightRange(o), liftOf(o.x, o.y)); ctx.stroke();
          ctx.fillStyle = 'rgba(' + sideRGB(u.side) + ',.04)'; ctx.fill();
        });
        ctx.setLineDash([]);
        ctx.lineWidth = 1.6;
        ui.tribe.seen.forEach(function (e) {
          ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.85)';
          isoRing(e.x, e.y, UR * 1.5, liftOf(e.x, e.y) + ISO.flyLift(e)); ctx.stroke();
        });
      }
      // a Shield Generator's dome: 12" of +2 (or +1) against fire from outside it
      if (R.ruleValue(u, 'Shield Generator')) {
        ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.6)';
        isoRing(eye.x, eye.y, 12, eyeLift); ctx.stroke();
        ctx.fillStyle = 'rgba(' + sideRGB(u.side) + ',.05)'; ctx.fill();
      }
      /* An Overmind's reach (p. 116): 18", or 24" with Increased Control — the
         bugs inside it are held back, sheltered and called back from the dead. */
      if (R.has(u, 'Overmind')) {
        ctx.setLineDash([2, 5]);
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(190,140,245,.7)';
        isoRing(eye.x, eye.y, R.overmindReach(state, u.side) + UR, eyeLift); ctx.stroke();
        ctx.fillStyle = 'rgba(190,140,245,.06)'; ctx.fill();
        ctx.setLineDash([]);
      }
      if (u.fp !== null) {
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(232,193,90,.5)'; ctx.lineWidth = 1.2;
        isoRing(eye.x, eye.y, u.range + 2 * UR, eyeLift); ctx.stroke();
        ctx.strokeStyle = 'rgba(232,193,90,.3)';
        isoRing(eye.x, eye.y, u.range / 2 + 2 * UR, eyeLift); ctx.stroke();
        ctx.setLineDash([]);
      }
      // the enemies the move would put in reach, and the ones it would expose it to
      if (ui.preview) {
        ctx.lineWidth = 1.6;
        ui.preview.watchers.forEach(function (o) {
          ctx.strokeStyle = 'rgba(224,85,122,.75)';
          isoRing(o.x, o.y, 1.4, liftOf(o.x, o.y)); ctx.stroke();
        });
        (ui.preview.shots || []).forEach(function (o) {
          ctx.strokeStyle = 'rgba(122,206,152,.9)';
          isoRing(o.x, o.y, 1.9, liftOf(o.x, o.y)); ctx.stroke();
        });
      }
      if (ui.mode === 'assault') {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(228,105,63,.65)'; ctx.lineWidth = 1.4;
        isoRing(u.x, u.y, u.move + 2 + 2 * UR, lift); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // the building sections a unit could go into
    if (ui.mode === 'enter' && ui.sections && ui.sections.length) {
      ctx.save();
      ui.sections.forEach(function (q) {
        var r = q.rect, c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(function (p2) { return hud(p2[0], p2[1], 0); });
        ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y);
        for (var i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(122,206,144,.26)'; ctx.fill();
        ctx.setLineDash([6, 4]); ctx.strokeStyle = '#8fe0a6'; ctx.lineWidth = 2; ctx.stroke();
        var mid = hud(r.x + r.w / 2, r.y + r.h / 2, ISO.K * 2.2);
        ctx.setLineDash([]);
        var label = R.sectionHigh(q.piece, r) ? (q.piece.kind === 'bunker' ? 'Reinforced' : 'High · +2 FP') : 'Low building';
        ctx.font = '600 11px Oxanium, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var w = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(8,11,16,.86)';
        roundRect(ctx, mid.x - w / 2, mid.y - 9, w, 18, 4); ctx.fill();
        ctx.strokeStyle = '#8fe0a6'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e7ecf4'; ctx.fillText(label, mid.x, mid.y + 1);
      });
      ctx.restore();
    }
    // destructible pieces offered as targets
    if (ui.terrain.length) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = ui.mode === 'breach' ? '#e4693f' : '#e8c15a';
      ctx.lineWidth = 2;
      ui.terrain.forEach(function (r) {
        var c = (r.poly || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])
          .map(function (q) { return hud(q[0], q[1], liftOf(q[0], q[1])); });
        ctx.beginPath();
        ctx.moveTo(c[0].x, c[0].y);
        for (var i = 1; i < c.length; i++) ctx.lineTo(c[i].x, c[i].y);
        ctx.closePath();
        ctx.stroke();
        var mid = hud(r.x + r.w / 2, r.y + r.h / 2, liftOf(r.x + r.w / 2, r.y + r.h / 2) + ISO.K * 1.4);
        ctx.setLineDash([]);
        var label = R.TERRAIN[r.kind].name;
        ctx.font = '600 11px Oxanium, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var w = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(8,11,16,.86)';
        roundRect(ctx, mid.x - w / 2, mid.y - 9, w, 18, 4); ctx.fill();
        ctx.strokeStyle = ui.mode === 'breach' ? '#e4693f' : '#e8c15a';
        ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e7ecf4';
        ctx.fillText(label, mid.x, mid.y + 1);
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
      });
      ctx.restore();
    }

    // targets
    ui.targets.forEach(function (t) {
      var p = hud(t.x, t.y, liftOf(t.x, t.y));
      ctx.strokeStyle = ui.mode === 'assault' ? '#e4693f' : '#e8c15a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, ISO.K * 0.8 * cam.z, ISO.K * 0.44 * cam.z, 0, 0, Math.PI * 2); ctx.stroke();
      if (ui.selected) {
        var a = hud(ui.selected.x, ui.selected.y, liftOf(ui.selected.x, ui.selected.y) + 8);
        var b = hud(t.x, t.y, liftOf(t.x, t.y) + ISO.K * 0.5);
        ctx.save(); ctx.globalAlpha = .35; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
      }
      // the chance of telling, worked out over all ten faces of the die
      var odds = oddsOn(t);
      if (odds) drawOdds(t, odds);
    });

    /* Unit labels. A unit standing in terrain carries a mark for it, because the
       ground it is on is the single biggest modifier on the table and it is not
       always obvious from above which piece a base is actually inside. */
    ctx.font = '600 10px Oxanium, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    state.units.forEach(function (u2) {
      if (!u2.alive || u2.x < 0) return;
      var p = hud(u2.x, u2.y, liftOf(u2.x, u2.y) + ISO.headroom(u2.models, R.status(u2), u2) + ISO.K * 0.5);
      var mark = terrainMark(u2);
      var w = ctx.measureText(u2.code).width + 8 + (mark ? 12 : 0);
      ctx.fillStyle = 'rgba(8,11,16,.72)';
      ctx.fillRect(p.x - w / 2, p.y - 10, w, 13);
      ctx.fillStyle = sideInk(u2.side);
      ctx.fillText(u2.code, p.x - (mark ? 6 : 0), p.y);
      if (mark) {
        ctx.fillStyle = mark.col;
        ctx.fillRect(p.x + w / 2 - 11, p.y - 8, 8, 9);
        ctx.fillStyle = 'rgba(8,11,16,.82)';
        ctx.font = '700 8px "IBM Plex Mono", monospace';
        ctx.fillText(mark.ch, p.x + w / 2 - 7, p.y - 1);
        ctx.font = '600 10px Oxanium, system-ui, sans-serif';
      }
    });

    // measuring tape
    if (u && ui.hover) {
      var a2 = hud(u.x, u.y, liftOf(u.x, u.y));
      var b2 = hud(ui.hover.x, ui.hover.y, 0);
      var dist = Math.max(0, R.inches(u.x, u.y, ui.hover.x, ui.hover.y) - UR);
      // a dark edge under the light dash, so the tape reads on snow as well as on soil
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(8,10,14,.45)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(231,236,244,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      ctx.setLineDash([]);
      var label = dist.toFixed(1) + '"';
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      var lw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(10,14,20,.85)';
      ctx.fillRect(b2.x + 8, b2.y - 20, lw, 15);
      ctx.fillStyle = '#e7ecf4'; ctx.textAlign = 'left';
      ctx.fillText(label, b2.x + 12, b2.y - 9);
      ctx.textAlign = 'center';
    }
  }

  /* ---------- action bar ---------- */
  function drawBar() {
    var u = ui.selected, bar = el('bar');
    var specials = specialsFor(u);
    var html = '';

    STANDARD.forEach(function (a, n) {
      var st = actionState(u, a.id);
      var active = ui.mode === a.id || (a.id === 'advance' && (ui.mode === 'advance-move' || ui.mode === 'advance-fire'));
      html += '<button class="slot' + (active ? ' active' : '') + '" data-action="' + a.id + '"' +
        (st.on ? '' : ' disabled') + ' title="' + a.label + ' — ' + st.hint.replace(/"/g, '&quot;') + '">' +
        '<kbd>' + (n + 1) + '</kbd>' + ICONS[a.id] + '<span>' + a.label + '</span></button>';
    });
    for (var s = 0; s < SPECIAL_SLOTS; s++) {
      var sp = specials[s];
      if (!sp) {
        html += '<button class="slot special empty" disabled title="Special action slot"><span style="opacity:.6">' + ICONS.empty + '</span><span>—</span></button>';
      } else {
        var st2 = actionState(u, sp.id);
        html += '<button class="slot special' + (ui.mode === sp.id ? ' active' : '') + '" data-action="' + sp.id + '"' +
          (st2.on ? '' : ' disabled') + ' title="' + sp.label + ' — ' + st2.hint.replace(/"/g, '&quot;') + '">' +
          ICONS[sp.id] + '<span>' + sp.label + '</span></button>';
      }
    }
    bar.innerHTML = html;

    bar.querySelectorAll('[data-action]').forEach(function (b) {
      var id = b.getAttribute('data-action');
      b.addEventListener('click', function () { if (SFX) SFX.click(); chooseAction(id); });
      b.addEventListener('mouseenter', function () { setHint(id); });
      b.addEventListener('mouseleave', function () { setHint(null); });
      b.addEventListener('focus', function () { setHint(id); });
    });
    setHint(null);
  }

  function setHint(id, override) {
    ui.hint = id;
    var u = ui.selected, box = el('hintbar');
    if (override) { box.textContent = override; return; }
    if (id) {
      var all = STANDARD.concat(specialsFor(u));
      var a = all.filter(function (x) { return x.id === id; })[0];
      var st = actionState(u, id);
      box.innerHTML = '<b>' + (a ? a.label : id) + '</b> — ' + st.hint;
      return;
    }
    if (state.over) { box.textContent = state.over.text; return; }
    if (state.phase === 'terrain') {
      var ta = curArea(), tg = state.tset && state.tset.ghost;
      box.innerHTML = !ta ? 'Setting the table…'
        : isAI(ta.side) ? esc(sideName(ta.side)) + ' is laying the ' + ta.name + ' area.'
          : !tg ? 'Choose what the ' + ta.name + ' roll gives, in the panel.'
            : 'Tap inside the lit <b>' + ta.name + '</b> area to put down the ' + (PIECE_NOUN[tg.kind] || [tg.kind])[0] + ' outlined under the pointer.';
      return;
    }
    if (state.phase === 'deploy') {
      var next = deployNext(), dside = placingSide();
      // somebody else's deployment is watched, not played
      if (next && dside && !mySide()) {
        box.innerHTML = '<b>' + esc(sideName(dside)) + '</b> is putting its force down.';
        return;
      }
      box.innerHTML = next
        ? 'Placing <b>' + esc(next.name) + '</b> — click inside your shaded strip, or pick a different unit from the order of battle. ' +
        'Tapping a model already down picks it up to shift.'
        : 'All units are on the table. Begin the battle from the panel.';
      return;
    }
    if (!u && state.solo && state.activeSide === 'B') { box.textContent = 'OpFor phase — the enemy acts, furthest from your forces first.'; return; }
    if (!u && state.solo && state.solo.coop) {
      box.innerHTML = '<b>' + esc(soloOwnerName(state.activeOwner)) + '</b>: select one of your units — the players take turns, one activation each.';
      return;
    }
    if (!u) { box.textContent = 'Select one of your units on the table — those not shaded darker have still to act.'; return; }
    if (ui.mode === 'move' || ui.mode === 'advance-move') {
      box.innerHTML = 'Click anywhere in the shaded ground to move <b>' + u.name + '</b> there.';
    } else if (ui.mode === 'fire' || ui.mode === 'aux' || ui.mode === 'advance-fire') {
      box.innerHTML = 'Pick a target — ringed units are in range and sight.';
    } else if (ui.mode === 'assault') {
      box.innerHTML = 'Pick the unit to charge. The defender fires first, at Basic Firepower.';
    } else if (ui.mode === 'breach') {
      box.innerHTML = 'Pick what to charge — tap the outlined structure on the table, or a line in the panel below. ' +
        '<b>' + esc(u.name) + '</b> walks up to it and sets the charges as an Assault.';
    } else if (ui.mode === 'demolish') {
      box.innerHTML = 'Pick what to shoot down — tap the outlined structure on the table, or a line in the panel below.';
    } else if (ui.mode === 'designate') {
      box.innerHTML = 'Pick the enemy to mark for the rest of the turn.';
    } else if (ui.mode === 'wave') {
      box.innerHTML = 'Psychic Wave: tap where <b>' + esc(u.name) + '</b> moves to — or the unit itself to stay — and every enemy within 12" of it takes D6−1 SP.';
    } else {
      box.innerHTML = '<b>' + u.name + '</b> — ' + (isAI(u.side) ? 'under OpFor control.' :
        u.activated ? 'already acted this turn.' :
          u.side === state.activeSide ? 'choose an action.' : 'waiting for its activation.');
    }
  }

  /* ---------- drawer ---------- */
  function drawerEl() { return el('drawer'); }
  function openDrawer(tab) {
    var d = drawerEl();
    if (tab) setDrawerTab(tab);
    d.classList.add('open');
    el('scrim').hidden = false;
    if (SFX) SFX.click();
  }
  function closeDrawer() {
    var d = drawerEl();
    if (!d.classList.contains('open')) return;
    d.classList.remove('open');
    el('scrim').hidden = true;
  }
  function toggleDrawer() {
    if (drawerEl().classList.contains('open')) closeDrawer(); else openDrawer();
  }
  function setDrawerTab(tab) {
    var d = drawerEl();
    d.classList.remove('tab-forces', 'tab-log');
    d.classList.add('tab-' + tab);
    d.querySelectorAll('.dtab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
    if (tab === 'log') { var lb = el('log'); lb.parentElement.scrollTop = lb.parentElement.scrollHeight; }
  }

  /* ---------- stat strip ---------- */
  /* The selected unit's card is shown twice on a desktop — in the left rail and
     under the board — and once on a phone. Both hosts are filled; CSS decides
     which is on screen. */
  function drawStats() {
    statsInto(el('statstrip'));
    statsInto(el('statstrip-side'));
  }
  function statsInto(box) {
    if (!box) return;
    var u = ui.selected;
    // keep whatever the layout put on it; only the statstrip's own state changes
    var keep = (box.getAttribute('data-keep') || '').trim();
    if (!keep) {
      keep = box.className.split(/\s+/).filter(function (c) { return c !== 'compact' && c !== 'statstrip'; }).join(' ');
      box.setAttribute('data-keep', keep);
    }
    box.className = (keep ? keep + ' ' : '') + 'statstrip' + (ui.statsOpen ? '' : ' compact');
    if (!u) {
      box.innerHTML = '<p class="hint small">No unit selected. Stats, suppression and special rules appear here.</p>';
      return;
    }
    if (R.isMachine(u)) { drawMachineStats(u, box); return; }
    var st = R.status(u), m = R.currentMorale(u);
    var h = '<div class="stat-head"><span class="code code-' + u.side + '">' + u.code + '</span>' +
      '<div><h2>' + u.name + honourMarks(u) + '</h2><p class="sub">Tier ' + u.tier + ' · ' + sideName(u.side) +
      '</p><span class="stat-sum">' + u.models + '/' + u.size + ' · ' + u.sp + ' SP · Move ' + u.move +
      '" · FP ' + (u.fp === null ? '—' : u.fp) + ' · Rng ' + u.range + '"</span></div>' +
      '<span class="status-tag status-' + st + '">' + st + '</span>' +
      '<button class="statbtn" data-act="statdetails">' + (ui.statsOpen ? 'Less' : 'Details') + '</button></div>';
    h += '<div class="stats">' +
      stat('Models', u.models + '/' + u.size) + stat('Move', u.move + '"') +
      stat('FP', u.fp === null ? '—' : u.fp) + stat('Range', u.range + '"') +
      stat('Def', u.def + (R.has(u, 'Battle Armour') ? '/' + (u.def - 2) : '')) +
      stat('Assault', u.assault) + stat('Morale', m + (m !== u.morale ? ' of ' + u.morale : '')) +
      stat('SP', u.sp) + '</div>';
    h += '<div class="spbar"><div class="spbar-fill" style="width:' + Math.min(100, (u.sp / (3 * m)) * 100) + '%"></div>' +
      '<span class="spmark" style="left:33.3%"></span><span class="spmark" style="left:66.6%"></span></div>' +
      '<p class="hint small">Suppressed above ' + m + ' SP · broken above ' + (2 * m) + ' · removed above ' + (3 * m) +
      ' · standing in ' + R.TERRAIN[R.terrainOf(state, u)].name.toLowerCase() + '</p>';
    h += honourChips(u);
    if (u.rules.length) h += '<div class="chips">' + u.rules.map(function (r) { return '<span class="chip">' + r + '</span>'; }).join('') + '</div>';
    box.innerHTML = h;
    wireHost(box);
  }
  function stat(k, v) { return '<div class="st"><span>' + k + '</span><b>' + v + '</b></div>'; }

  /* What a campaign unit is carrying into the fight, at a glance: a star for every
     Battle Honour it has earned (p. 88), a heart for every Battle Trauma it is
     living with (p. 90), and a spanner for a vehicle Upgrade. Hover or tap for
     the names. A one-off battle shows nothing, because nobody has a history. */
  /* The stars beside a name, and behind each one the rules they stand for —
     a name like "Rain of Fire" means nothing until you have read the sentence,
     so the tip carries the sentence, not just the name. */
  function spellOut(list, table) {
    return list.map(function (n) {
      var x = table[n - 1];
      return x ? x.name + ' — ' + x.text : '?';
    }).join('\n');
  }
  function honourMarks(u) {
    var c = u && u.camp;
    if (!c) return '';
    var hon = c.honours || [], tra = c.traumas || [], up = c.upgrades || [];
    if (!hon.length && !tra.length && !up.length) return '';
    var bug = u.faction === 'bugs';
    var h = '<span class="marks">';
    if (hon.length) {
      h += '<span class="mark-hon" ' + tip(
        hon.length === 1 ? (bug ? 'Adaptation' : 'Battle Honour') : hon.length + (bug ? ' Adaptations' : ' Battle Honours'),
        spellOut(hon, C.honourTable(u.key))) + '>' + new Array(hon.length + 1).join('★') + '</span>';
    }
    if (tra.length) {
      h += '<span class="mark-tra" ' + tip(
        tra.length === 1 ? (bug ? 'Genetic Flaw' : 'Battle Trauma') : tra.length + (bug ? ' Genetic Flaws' : ' Battle Traumas'),
        spellOut(tra, C.traumaTable(u.key))) + '>' + new Array(tra.length + 1).join('♥') + '</span>';
    }
    if (up.length) {
      h += '<span class="mark-up" ' + tip(
        up.length === 1 ? 'Upgrade' : up.length + ' upgrades',
        spellOut(up, C.UPGRADES)) + '>' + new Array(up.length + 1).join('⚙') + '</span>';
    }
    return h + '</span>';
  }
  /* The names behind the marks, spelled out under the stats. */
  function honourChips(u) {
    var c = u && u.camp;
    if (!c) return '';
    var out = [];
    (c.honours || []).forEach(function (n) {
      var x = C.honourTable(u.key)[n - 1];
      if (x) out.push('<span class="chip chip-hon" ' + tip(x.name, x.text) + '>★ ' + esc(x.name) + '</span>');
    });
    (c.traumas || []).forEach(function (n) {
      var x = C.traumaTable(u.key)[n - 1];
      if (x) out.push('<span class="chip chip-tra" ' + tip(x.name, x.text) + '>♥ ' + esc(x.name) + '</span>');
    });
    (c.upgrades || []).forEach(function (n) {
      var x = C.UPGRADES[n - 1];
      if (x) out.push('<span class="chip chip-up" ' + tip(x.name, x.text) + '>⚙ ' + esc(x.name) + '</span>');
    });
    return out.length ? '<div class="chips">' + out.join('') + '</div>' : '';
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // the tooltip attributes, from tips.js; a page without it falls back to `title`
  function tip(head, body) {
    return window.PMCTips ? window.PMCTips.attr(head, body)
      : 'title="' + esc((head ? head + ' — ' : '') + body) + '"';
  }

  // a machine has Structure and Damage where a squad has Morale and suppression
  function drawMachineStats(u, box) {
    var left = Math.max(0, u.str - u.damage);
    var tag = u.damage === 0 ? 'ready' : u.damage >= u.str ? 'broken' : 'suppressed';
    var word = u.damage === 0 ? 'undamaged' : u.damage >= u.str ? 'crippled' : 'damaged';
    var pr = R.propOf(u);
    var kind = u.cls === 'aircraft' ? 'Aircraft'
      : pr ? pr.name + ' ground vehicle' : 'Ground vehicle';
    if (u.drone) kind += ' · drone';
    var h = '<div class="stat-head"><span class="code code-' + u.side + '">' + u.code + '</span>' +
      '<div><h2>' + u.name + honourMarks(u) + '</h2><p class="sub">Tier ' + u.tier + ' · ' + kind + ' · ' + sideName(u.side) +
      '</p><span class="stat-sum">' + u.damage + '/' + u.str + ' damage · Move ' + u.move +
      '" · FP ' + (u.fp === null ? '—' : u.fp) + '</span></div>' +
      '<span class="status-tag status-' + tag + '">' + word + '</span>' +
      '<button class="statbtn" data-act="statdetails">' + (ui.statsOpen ? 'Less' : 'Details') + '</button></div>';
    h += '<div class="stats">' +
      stat('Structure', left + '/' + u.str) + stat('Move', u.move + '"' + (u.turn ? ' (' + u.turn + ')' : '')) +
      stat('FP', u.fp === null ? '—' : u.fp) + stat('Range', u.range + '"') +
      stat('Def', u.def) + stat('Assault', u.assault) +
      stat('Damage', u.damage) +
      stat('Carrying', u.transport ? (u.cargo || []).length + '/' + u.transport : '—') + '</div>';
    h += '<div class="spbar"><div class="spbar-fill" style="width:' +
      Math.min(100, (u.damage / Math.max(1, u.str)) * 100) + '%"></div></div>' +
      '<p class="hint small">Knocked out above ' + u.str + ' damage · repairs ' + Math.max(1, left) +
      'D6 on 4+ · ' + (u.cls === 'aircraft'
        ? 'flies over everything, always fires and is fired at with Basic Firepower, and cannot hold ground'
        : (pr && pr.cover ? 'takes cover like infantry, and its flanks deny the +1 side shot, but it is hit +2 in the rear'
          : 'takes no cover from terrain, and is hit +1 in the side, +2 in the rear')) + '</p>';
    if (pr && pr.key !== 'wheeled') h += '<p class="hint small">' + pr.name + ' — ' + pr.note + '</p>';
    if ((u.cargo || []).length) {
      h += '<div class="chips">' + u.cargo.map(function (c) {
        return '<span class="chip">aboard: ' + c.name + '</span>';
      }).join('') + '</div>';
    }
    if (u.rules.length) h += '<div class="chips">' + u.rules.map(function (r) { return '<span class="chip">' + r + '</span>'; }).join('') + '</div>';
    box.innerHTML = h;
    wireHost(box);
  }

  /* ---------- side panel ---------- */
  // What you act with lives under the board; the roster and log live in the panel
  // (a slide-out drawer on a narrow screen).
  function drawPanel() {
    var ctxBox = el('context'), html = '';
    if (state.phase === 'terrain') html = terrainCard();
    else if (state.phase === 'deploy') html = deployCard();
    else if (ui.insertion) html = insertionCard();
    else if (state.over) html = overCard();
    else if (ui.terrain.length && ui.selected &&
      (ui.mode === 'breach' || ui.mode === 'demolish')) html = terrainPanel(ui.selected);
    else if (ui.mode === 'enter' && ui.sections.length && ui.selected) html = sectionPanel(ui.selected);
    else if (ui.preview) html = movePreviewCard();
    else if (ui.targets.length && ui.selected && ['fire', 'aux', 'advance-fire', 'assault', 'designate'].indexOf(ui.mode) >= 0) {
      html = targetPanel(ui.selected);
    }
    else if (ui.selected && !isAI(ui.selected.side)) html = idleCard(ui.selected);
    ctxBox.innerHTML = html;
    el('panel').innerHTML = forceList();
    /* The desktop rails: your own order of battle on the left, the enemy's on
       the right. They are the same list, split. */
    var me = playerSide() || 'A', foe = me === 'A' ? 'B' : 'A';
    var own = el('panel-own'), opp = el('panel-foe'), both = el('panel-m');
    if (own) own.innerHTML = forceList(me);
    if (opp) opp.innerHTML = forceList(foe);
    if (both) both.innerHTML = forceList();
    var con = document.querySelector('.console');
    if (con) con.classList.toggle('deploying', state.phase === 'deploy' || state.phase === 'terrain');
    wirePanel();
    if (own) wireHost(own);
    if (opp) wireHost(opp);
    if (both) wireHost(both);
  }

  function forceList(only) {
    var h = '<div class="forces">';
    (only ? [only] : ['A', 'B']).forEach(function (side) {
      h += '<div class="force force-' + side + '"><h3>' + (side === 'A' ? state.cfg.nameA : state.cfg.nameB) +
        ' <span class="tag">' + side + '</span></h3><ul>';
      state.units.filter(function (u) { return u.side === side; }).forEach(function (u) {
        var st = u.alive ? R.status(u) : 'dead';
        h += '<li class="ru ' + st + (u.activated && u.alive ? ' done' : '') + (ui.selected === u ? ' sel' : '') +
          '" data-unit="' + u.id + '"><span class="ru-code">' + u.code + '</span>' +
          '<span class="ru-name">' + u.name + honourMarks(u) +
          (state.solo && state.solo.coop && side === 'A' ? ' <small class="own own' + (u.owner || 1) + '">P' + (u.owner || 1) + '</small>' : '') + '</span>' +
          '<span class="ru-num">' + (!u.alive ? '—' : R.isMachine(u)
            ? Math.max(0, u.str - u.damage) + '/' + u.str
            : u.models + '/' + u.size) + '</span>' +
          '<span class="ru-sp">' + (!u.alive ? 'lost' : u.safe ? 'safe' : u.reserve && u.wave === 'pool' ? (state.sc.counters ? 'hidden' : 'pool') : u.reserve ? 'reserve' : u.aboard ? 'aboard'
            : R.isMachine(u) ? u.damage + ' DP' : u.sp + ' SP') + '</span></li>';
      });
      h += '</ul></div>';
    });
    return h + '</div>';
  }

  /* the odds of the pending shot or charge against one target, or null when the
     mode is not an attack */
  function oddsOn(t) {
    var u = ui.selected;
    if (!u) return null;
    if (ui.mode === 'assault') return R.assaultOdds(state, u, t);
    if (['fire', 'aux', 'advance-fire'].indexOf(ui.mode) < 0) return null;
    return R.shotOdds(state, u, t, ui.mode === 'aux' ? 'fire' : ui.mode,
      { aux: ui.mode === 'aux' });
  }

  function drawOdds(t, odds) {
    var pct = Math.round(odds.chance * 100) + '%';
    var avg = odds.avgHits.toFixed(1) + (odds.avgHits === 1 ? ' hit' : ' hits');
    var head = ISO.headroom(t.models, R.status(t), t);
    var p = hud(t.x, t.y, liftOf(t.x, t.y) + head + ISO.K * 1.15);
    var warm = ui.mode === 'assault' ? '#e4693f' : '#e8c15a';
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px Oxanium, system-ui, sans-serif';
    var wPct = ctx.measureText(pct).width;
    ctx.font = '500 10px IBM Plex Mono, ui-monospace, monospace';
    var wAvg = ctx.measureText(avg).width;
    var w = wPct + wAvg + 18, x0 = p.x - w / 2;
    ctx.fillStyle = 'rgba(8,11,16,.88)';
    roundRect(ctx, x0, p.y - 10, w, 20, 4);
    ctx.fill();
    ctx.strokeStyle = warm; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '700 13px Oxanium, system-ui, sans-serif';
    ctx.fillStyle = odds.chance >= .7 ? '#7ed6a0' : odds.chance >= .4 ? '#e8c15a' : '#e0557a';
    ctx.fillText(pct, x0 + 6, p.y + 1);
    ctx.font = '500 10px IBM Plex Mono, ui-monospace, monospace';
    ctx.fillStyle = 'rgba(231,236,244,.62)';
    ctx.fillText(avg, x0 + 6 + wPct + 6, p.y + 1);
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function sectionPanel(u) {
    var h = '<div class="targets"><h4>' + (u.bld ? 'Move into which section?' : 'Go into which building?') + '</h4>';
    ui.sections.forEach(function (q, n) {
      var t = R.TERRAIN[q.piece.kind], high = R.sectionHigh(q.piece, q.rect);
      var d = Math.max(0, R.rectPointDist(q.rect, u.x, u.y) - UR);
      h += '<button class="tgt" data-act="entersec" data-alt="' + n + '"><b>' + t.name +
        (q.piece.kind === 'building' ? (high ? ' — high' : ' — low') : '') + '</b><span>' +
        (u.bld ? 'next section' : d.toFixed(1) + '" away') + ' · +2 Defence' + (high ? ' · +2 Firepower' : '') + ' · no Crossfire</span></button>';
    });
    return h + '</div>';
  }
  function targetPanel(u) {
    var heads = {
      assault: 'Charge which unit?', designate: 'Designate which unit?',
      hack: 'Hack which drone?', support: 'Supporting Fire on which unit?',
      embark: 'Load which unit?', 'advance-fire': 'Advance — fire on which unit?'
    };
    var h = '<div class="targets"><h4>' + (heads[ui.mode] || 'Fire on which unit?') + '</h4>';
    ui.targets.forEach(function (t) {
      var d = R.unitDist(u, t).toFixed(1), extra = '';
      if (ui.mode === 'assault') {
        var ao = R.assaultOdds(state, u, t);
        extra = 'Assault +' + ao.mods + ' vs Def ' + ao.def + ' · hits on ' + ao.need + '+ · ' +
          Math.round(ao.chance * 100) + '% a round';
      } else if (ui.mode !== 'designate') {
        var aux = ui.mode === 'aux';
        // the Advance's shot is odds for an Advance: no bonus for standing still
        var oddsMode = ui.mode === 'aux' ? 'fire' : ui.mode === 'advance-fire' ? 'advance' : ui.mode;
        var o = R.shotOdds(state, u, t, oddsMode, { aux: aux });
        extra = '+' + o.mods + ' vs Def ' + o.def + ' · hits on ' + o.need + '+ · ' +
          Math.round(o.chance * 100) + '% · ' + o.avgHits.toFixed(1) + ' hits';
      }
      h += '<button class="tgt" data-target="' + t.id + '"><b>' + t.name + '</b><span>' + d + '" · ' + t.models + ' models · ' + extra + '</span></button>';
    });
    // having moved, an Advance may still decline its shot — and that ends the activation
    if (ui.mode === 'advance-fire') {
      h += '<div class="acts"><button class="act" data-act="holdfire"><span>Hold its fire</span><small>Ends the activation</small></button></div>';
    }
    return h + '</div>';
  }

  /* With a unit picked and no action chosen yet, the card says what each of the
     buttons would do — and, for the ones that are out, why. A phone has no
     tooltips, and a greyed-out button that will not say why is the commonest
     thing to be stuck on. */
  function idleCard(u) {
    var all = STANDARD.concat(specialsFor(u));
    var live = [], out = [];
    all.forEach(function (a) {
      var st = actionState(u, a.id);
      (st.on ? live : out).push({ label: a.label, hint: st.hint });
    });
    var h = '<div class="card idle"><h2>' + esc(u.name) +
      (R.status(u) !== 'ready' ? ' <span class="role role-defender">' + R.status(u) + '</span>' : '') +
      '</h2>';
    if (!live.length) {
      h += '<p class="sub">Nothing it can do this activation.</p>';
    } else {
      h += '<ul class="idlelist">' + live.map(function (a) {
        return '<li><b>' + esc(a.label) + '</b><span>' + esc(a.hint) + '</span></li>';
      }).join('') + '</ul>';
    }
    if (out.length) {
      h += '<ul class="idlelist out">' + out.slice(0, 4).map(function (a) {
        return '<li><b>' + esc(a.label) + '</b><span>' + esc(a.hint) + '</span></li>';
      }).join('') + '</ul>';
    }
    return h + '</div>';
  }

  /* Demolition picks a piece of the table rather than a unit, and hunting for a
     dashed outline on a zoomed-out board is not a fair ask — so the pieces in
     reach are listed as buttons too, the nearest first. */
  function terrainPanel(u) {
    var breach = ui.mode === 'breach';
    var sap = R.has(u, 'Sappers');
    var h = '<div class="targets"><h4>' +
      (breach
        ? (sap ? 'Set charges on what?' : 'Demolish which objective?')
        : 'Bring down which structure?') + '</h4>' +
      '<p class="sub">' + (breach
        ? 'A charge is an Assault: ' + esc(u.name) + ' walks up to it, rolls Assault ' +
        (sap ? '+4 (Sappers)' : '+2') + ', and needs a final 15+ or an unmodified 9. ' +
        'A failure falls back 2". Tap one below, or the outlined piece on the table.'
        : 'Shooting a structure down needs a Destructive Weapon: a final 15+, or an unmodified 9. ' +
        'Tap one below, or the outlined piece on the table.') + '</p>';
    var mid = function (r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    ui.terrain.slice().sort(function (a, b2) {
      return R.inches(u.x, u.y, mid(a).x, mid(a).y) - R.inches(u.x, u.y, mid(b2).x, mid(b2).y);
    }).forEach(function (r) {
      var m = mid(r), d = R.inches(u.x, u.y, m.x, m.y);
      var what = r.objective ? 'The objective' : (R.TERRAIN[r.kind] ? r.kind : 'structure');
      var i = state.terrain.indexOf(r);
      h += '<button class="tgt" data-piece="' + i + '"><b>' +
        esc(what.charAt(0).toUpperCase() + what.slice(1)) + '</b><span>' +
        d.toFixed(1) + '" away · ' + Math.round(r.w) + '"×' + Math.round(r.h) + '"' +
        (r.objective ? ' · this is what the scenario is fought over' : '') +
        '</span></button>';
    });
    return h + '</div>';
  }

  /* The order of battle, as a list the player can pick from: anything still in
     hand can be set down next, and anything already down can be picked up and
     shifted, until he calls the deployment finished. */
  function deployList(side) {
    var roster = deployRoster(side);
    if (!roster.length) return '';
    var next = deployNext();
    var rows = roster.map(function (u) {
      var down = u.x >= 0;
      var cls = 'dpr' + (next && u.id === next.id ? ' dpr-now' : '') + (down ? ' dpr-set' : '');
      return '<button class="' + cls + '" data-deploy="' + u.id + '">' +
        '<span class="dpr-mark">' + (down ? '✓' : '·') + '</span>' +
        '<span class="dpr-name">' + esc(u.name) + '</span>' +
        '<span class="dpr-note">' + (down ? 'on the table — tap to shift' : 'in hand') + '</span>' +
        '</button>';
    }).join('');
    var left = roster.filter(function (u) { return u.x < 0; }).length;
    return '<div class="dplist"><div class="dphead">Order of battle — ' +
      (left ? left + ' still to place' : 'all set down') +
      '</div>' + rows + '</div>';
  }

  function relocCard() {
    var rl = state.relocating, me = rl.side;
    var pick = ui.deployPick ? byId(ui.deployPick) : null;
    var rows = state.units.filter(function (u) { return u.side === me && u.alive && u.x >= 0 && !u.aboard; }).map(function (u) {
      var moved = rl.moved.indexOf(u.id) >= 0;
      return '<button class="dpr' + (pick && pick.id === u.id ? ' dpr-now' : '') + (moved ? ' dpr-set' : '') + '" data-deploy="' + u.id + '">' +
        '<span class="dpr-mark">' + (moved ? '✓' : '·') + '</span><span class="dpr-name">' + esc(u.name) + '</span>' +
        '<span class="dpr-note">' + (moved ? 'relocated' : 'tap to move') + '</span></button>';
    }).join('');
    return '<div class="card"><h2>Rapid Relocation</h2>' +
      '<p class="sub">Everyone is down. You may pick up to <b>' + rl.cap + '</b> of your units and set them down again anywhere your deployment allows (p. 87). No unit moves twice.</p>' +
      '<p class="hint">' + rl.moved.length + ' of ' + rl.cap + ' moved' + (pick ? ' — tap the table where <b>' + esc(pick.name) + '</b> should go' : '') + '.</p>' +
      '<div class="dplist"><div class="dphead">Your units</div>' + rows + '</div>' +
      '<div class="acts"><button class="act primary" data-act="start"><span>Begin the battle</span><small>Roll for initiative</small></button></div></div>';
  }

  function deployCard() {
    if (state.relocating) return relocCard();
    var next = deployNext();
    var held = inReserve().filter(function (u) { return !isAI(u.side); });
    var me = next ? next.side : (playerSide() || 'A');
    var role = roleOf(me);
    var h = '<div class="card"><h2>' + (state.scen ? state.scen.name : 'Deployment') +
      (role ? ' <span class="role role-' + role + '">You ' +
        (role === 'attacker' ? 'attack' : 'defend') + '</span>' : '') + '</h2>' +
      (role ? '<p class="sub"><b>' + roleSentence() + '</b></p>' : '') +
      '<p class="sub">' + (state.scen ? state.scen.hint : '') + '</p>' +
      '<p class="sub">' + deployWhere(me) +
      (held.length ? ' <b>' + held.map(function (u) { return u.name; }).join(', ') +
        '</b> stay in reserve and come in by Battlefield Insertion from the second turn on.' : '') + '</p>';
    if (next) h += '<p class="hint"><b>' + esc(next.name) + '</b> · ' + next.models + ' models · Move ' + next.move + '" · FP ' + next.fp + ' · Range ' + next.range + '" · Def ' + next.def +
      (next.x >= 0 ? ' — already down; tap the table to shift it' : '') + '</p>';
    h += deployList(me);
    h += loadingCard(me);
    h += '<div class="acts"><button class="act" data-act="autodeploy"><span>Auto-deploy the rest</span></button>';
    if (deploymentDone()) h += '<button class="act primary" data-act="start"><span>Begin the battle</span><small>Roll for initiative</small></button>';
    else if (emptyPlatforms(me).length) {
      h += '</div><p class="cpwarn">A Rapid insertion platform has to start the battle with a squad aboard (p. 79). Put one in, or the battle cannot begin.</p><div class="acts">';
    }
    return h + '</div></div>';
  }

  function loadingCard(side) {
    var hulls = carriersFor(side).filter(function (u) { return !isAI(u.side); });
    if (!hulls.length) return '';
    var h = '<div class="loadbox"><h3>Aboard before the battle</h3>' +
      '<p class="hint small">Troops can start the game inside a hull, declared before a shot is fired ' +
      '(p. 36). A Rapid insertion platform has to.</p>';
    hulls.forEach(function (v) {
      var cargo = v.cargo || [], room = v.transport - cargo.length;
      var must = R.has(v, 'Immobile');
      h += '<div class="loadrow' + (must && !cargo.length ? ' needs' : '') + '">' +
        '<div class="loadhead"><b>' + esc(v.name) + '</b>' +
        '<span class="mk">' + cargo.length + ' of ' + v.transport + ' aboard</span>' +
        (must ? '<span class="mk warn">must carry a squad</span>' : '') + '</div>';
      if (cargo.length) {
        h += '<div class="loadlist">' + cargo.map(function (c) {
          return '<button class="lnk" data-unload="' + c.id + '" data-hull="' + v.id + '">' +
            esc(c.name) + ' ✕</button>';
        }).join('') + '</div>';
      }
      if (room > 0) {
        var can = boardableFor(v);
        h += can.length
          ? '<div class="loadlist">' + can.slice(0, 8).map(function (c) {
            return '<button class="lnk" data-load="' + c.id + '" data-hull="' + v.id + '">+ ' +
              esc(c.name) + '</button>';
          }).join('') + '</div>'
          : '<div class="hint small">No infantry left to put aboard.</div>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }

  function overCard() {
    return '<div class="card"><h2>' + (state.over.winner ? sideName(state.over.winner) + ' wins' : 'Draw') + '</h2>' +
      '<p class="sub">' + state.over.text + '</p><div class="acts"><button class="act primary" data-act="restart"><span>Main menu</span></button></div></div>';
  }

  function wirePanel() {
    [el('context'), el('panel')].forEach(wireHost);
  }

  function wireHost(host) {
    if (!host) return;
    /* The load and unload buttons carry `data-load`/`data-unload` and no
       `data-act`, so selecting on `[data-act]` alone never bound them and
       nothing happened when they were pressed: troops could not be put aboard
       a hull, or taken off one, during deployment. All three are selected. */
    host.querySelectorAll('[data-act], [data-load], [data-unload]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        if (SFX) SFX.click();
        if (b.hasAttribute('data-load')) {
          var lv = byId(b.getAttribute('data-hull')), lu = byId(b.getAttribute('data-load'));
          loadBefore(lv, lu); render(); return;
        }
        if (b.hasAttribute('data-unload')) {
          var uv = byId(b.getAttribute('data-hull')), uu = byId(b.getAttribute('data-unload'));
          unloadBefore(uv, uu); render(); return;
        }
        if (!a) return;
        if (a === 'movego') { commitMove(); return; }
        else if (a === 'movecancel') { cancelPreview(); return; }
        else if (a === 'holdinsert') { holdInsertion(); return; }
        else if (a === 'holdfire') { send({ k: 'cancel' }); return; }
        else if (a === 'holdarrive') { holdArrival(); return; }
        else if (a === 'entersec') { var sq = ui.sections[+b.getAttribute('data-alt')]; if (sq && ui.selected) doEnter(ui.selected, sq); }
        else if (a === 'talt' || a === 'tnext' || a === 'tauto' || a === 'tautoall' || a === 'trotate') terrainAct(a, b.getAttribute('data-alt'));
        else if (a === 'autodeploy') autoDeployMine();
        else if (a === 'start') startBattle();
        else if (a === 'restart') openMenu();
        else if (a === 'statdetails') { ui.statsOpen = !ui.statsOpen; drawStats(); }
      });
    });
    host.querySelectorAll('[data-piece]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = state.terrain[+b.getAttribute('data-piece')];
        if (!r || ui.terrain.indexOf(r) < 0) return;
        if (SFX) SFX.click();
        if (ui.mode === 'breach') doBreach(r); else doDemolish(r);
      });
    });
    host.querySelectorAll('[data-deploy]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (SFX) SFX.click();
        if (state.relocating) relocPick(b.getAttribute('data-deploy'));
        else pickToDeploy(b.getAttribute('data-deploy'));
      });
    });
    host.querySelectorAll('[data-target]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = state.units.filter(function (u) { return u.id === b.getAttribute('data-target'); })[0];
        if (!t) return;
        if (ui.mode === 'assault') doAssault(t);
        else if (ui.mode === 'designate') doDesignate(t);
        else if (ui.mode === 'hack') doHack(t);
        else if (ui.mode === 'steady') doSteady(t);
        else if (ui.mode === 'support') doSupport(t);
        else doShoot(t);
      });
    });
    host.querySelectorAll('[data-unit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var u = state.units.filter(function (x) { return x.id === b.getAttribute('data-unit'); })[0];
        if (u && u.alive) { closeDrawer(); select(u); }
      });
    });
  }

  function drawLog() {
    var html = state.log.map(function (l) {
      return '<div class="le le-' + l.t + '"><p>' + l.text + '</p>' + (l.math ? '<code>' + l.math + '</code>' : '') + '</div>';
    }).join('');
    ['log', 'log-dock'].forEach(function (id) {
      var host = el(id);
      if (!host) return;
      host.innerHTML = html;
      host.parentElement.scrollTop = host.parentElement.scrollHeight;
    });
    var n = el('logdock-n');
    if (n) n.textContent = state.log.length + ' entr' + (state.log.length === 1 ? 'y' : 'ies');
  }

  // On a narrow screen the action bar sits below the board. Bring it into view,
  // but never so far that the table itself is pushed off the top.
  function revealConsole() {
    if (window.innerWidth > 1000) return;
    var bar = el('bar'), ctxBox = el('context'), board = document.querySelector('.board-wrap');
    if (!bar || !board) return;
    var br = bar.getBoundingClientRect();
    if (br.height < 10 && ctxBox && ctxBox.firstChild) br = ctxBox.getBoundingClientRect();
    var bd = board.getBoundingClientRect();
    var vh = window.innerHeight;
    var need = br.bottom - (vh - 10);
    if (need <= 4) return;
    // scroll only as far as still leaves a good part of the table on screen
    var delta = Math.min(need, Math.max(0, bd.bottom - vh * 0.42));
    if (delta <= 4) return;
    try { window.scrollBy({ top: delta, behavior: 'smooth' }); }
    catch (e) { window.scrollBy(0, delta); }
  }

  /* ================= input ================= */
  // Three spaces: client (CSS px on the page), canvas (the 900x540 backing store)
  // and buffer (the pixel-art plate). Touch targets are sized in client px so a
  // fingertip works the same whether the board is 900px wide or 340.
  function canvasPoint(e) {
    if (e.__pt) return { x: e.__pt.x, y: e.__pt.y, scale: 1 };   // a synthetic tap, from a test
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * VIEW_W,
      y: (e.clientY - r.top) / r.height * VIEW_H,
      scale: r.width / VIEW_W                       // client px per canvas px
    };
  }
  function bufferFromCanvas(c) {
    var v = viewRect();
    return { x: (c.x - v.dx) / v.z + v.sx, y: (c.y - v.dy) / v.z + v.sy };
  }
  function canvasFromWorld(x, y, lift) {
    var p = ISO.toScreen(x, y), v = viewRect();
    return { x: (p.x - v.sx) * v.z + v.dx, y: (p.y - (lift || 0) - v.sy) * v.z + v.dy };
  }
  function bufferFromEvent(e) { return bufferFromCanvas(canvasPoint(e)); }
  function worldFromCanvas(c) { var b = bufferFromCanvas(c); return ISO.toWorld(b.x, b.y); }
  function worldFromEvent(e) {
    var b = bufferFromEvent(e);
    return ISO.toWorld(b.x, b.y);
  }
  function tolerance(scale, clientPx) { return (clientPx || 24) / Math.max(0.2, scale); }

  function unitUnder(c) {
    var tol = tolerance(c.scale, 26), best = null, bd = Infinity;
    state.units.forEach(function (u) {
      if (!u.alive || u.x < 0) return;
      var base = canvasFromWorld(dispX(u), dispY(u), liftOf(dispX(u), dispY(u)));
      var body = { x: base.x, y: base.y - ISO.K * 0.85 * cam.z };     // the troopers stand above the base
      var d = Math.min(Math.hypot(c.x - base.x, c.y - base.y), Math.hypot(c.x - body.x, c.y - body.y));
      /* A garrison stands round its building: a tap anywhere on the building,
         or on the men along its walls, picks it. */
      if (u.bld) {
        var q = R.sectionRect(u), w = worldFromCanvas(c);
        if (w && w.x >= q.x - 1.2 && w.x <= q.x + q.w + 1.2 && w.y >= q.y - 1.2 && w.y <= q.y + q.h + 1.2) d = Math.min(d, tol * 0.5);
      }
      if (d < tol && d < bd) { bd = d; best = u; }
    });
    return best;
  }

  /* ================= the move preview =================
     A move used to happen the moment the ground was tapped, which on a phone is
     one mis-tap away from an activation spent in the open. Tapping a spot now
     puts a ghost of the unit there and shows what the move would mean — the
     ground it would be standing in, what it could see and shoot from there, and,
     for an Advance, who it could shoot — and the move only happens when the
     player says so. */
  function previewFor(spot) {
    var u = ui.selected;
    if (!u || !spot) return null;
    var advance = ui.mode === 'advance-move';
    var allowance = advance ? u.move : u.move + moveBonus(u, 'move');
    var dist = R.inches(u.x, u.y, spot.x, spot.y);
    var path = R.pathTo(state, u, allowance, spot);
    var kind = R.terrainAt(state, spot.x, spot.y);
    var terr = R.TERRAIN[kind];
    // a ghost standing there, so the engine can be asked the same questions
    var ghost = {};
    for (var k in u) if (Object.prototype.hasOwnProperty.call(u, k)) ghost[k] = u[k];
    ghost.x = spot.x; ghost.y = spot.y;
    var seen = [], shots = [], watchers = [];
    state.units.forEach(function (o) {
      if (!onTable(o) || o.side === u.side) return;
      if (R.hasLoS(state, ghost, o)) seen.push(o);
      if (advance && R.canShoot(state, ghost, o, 'fire', {})) shots.push(o);
      // who would have the ghost in their sights, and in range, next activation
      if (o.fp && R.canShoot(state, o, ghost, 'fire', {})) watchers.push(o);
    });
    /* What the drive actually costs a hull: the ground, plus a turn for every
       90° it has to come round — or, if it would be going backwards, twice the
       distance at no turn cost (p. 35). */
    var turns = u.cls === 'vehicle' ? R.turnsTo(u, spot.x, spot.y) : 0;
    var ground = spot.cost !== undefined ? spot.cost : dist;
    var spent = u.cls === 'vehicle' ? R.driveCost(u, spot.x, spot.y, ground) : ground;
    return {
      unit: u, spot: spot, advance: advance, dist: dist, path: path,
      kind: kind, terrain: terr, ghost: ghost,
      seen: seen, shots: shots, watchers: watchers,
      allowance: allowance, ground: ground, spent: spent, turns: turns,
      reverse: u.cls === 'vehicle' && u.turn > 0 && turns === 2 && spent < ground + turns * u.turn,
      crushes: R.isMachine(u) && u.tier >= 3
    };
  }

  function previewMove(spot) {
    var pv = ui.preview;
    // a second tap on the same ground is the confirmation
    if (pv && Math.abs(pv.spot.x - spot.x) < 0.01 && Math.abs(pv.spot.y - spot.y) < 0.01) {
      commitMove();
      return;
    }
    ui.preview = previewFor(spot);
    ui.previewVis = null; ui.previewKey = '';
    if (SFX) SFX.click();
    render();
  }
  function cancelPreview() {
    ui.preview = null; ui.previewVis = null; ui.previewKey = '';
    render();
  }
  function commitMove() {
    var pv = ui.preview;
    if (!pv) return;
    ui.preview = null; ui.previewVis = null; ui.previewKey = '';
    doMove(pv.spot);
  }

  /* The card that asks. It says what the ground is worth, what the unit would be
     able to see and shoot, and who would be able to see it back. */
  function movePreviewCard() {
    var pv = ui.preview;
    if (!pv) return '';
    var u = pv.unit, t = pv.terrain;
    var bits = [];
    if (t.cover) bits.push('+' + t.cover + ' Defence');
    if (t.fp && t.hill) bits.push('+' + t.fp + ' Firepower firing down');
    if (t.movePenalty) bits.push(t.movePenalty + '" off the move to go through, once a move');
    if (t.blocks) bits.push('blocks line of sight');
    if (t.shallow) bits.push('no Cumbersome Weapons from here');
    var h = '<div class="card preview"><h2>' + (pv.advance ? 'Advance' : 'Move') + ' ' +
      pv.dist.toFixed(1) + '"</h2>';
    h += '<p class="sub"><b>' + esc(u.name) + '</b> ends up in <b>' + esc(t.name.toLowerCase()) + '</b>' +
      (bits.length ? ' — ' + bits.join(', ') : ' — open ground, no cover') + '.</p>';
    h += '<div class="pv-grid">';
    h += '<div class="pv-cell"><span>Sees</span><b>' + pv.seen.length + '</b>' +
      '<em>' + (pv.seen.length ? pv.seen.map(function (o) { return o.code; }).join(' ') : 'nothing') + '</em></div>';
    if (pv.advance) {
      h += '<div class="pv-cell' + (pv.shots.length ? ' good' : '') + '"><span>Can shoot</span><b>' +
        pv.shots.length + '</b><em>' +
        (pv.shots.length ? pv.shots.map(function (o) { return o.code; }).join(' ') : 'nothing in range') +
        '</em></div>';
    }
    h += '<div class="pv-cell' + (pv.watchers.length ? ' bad' : '') + '"><span>Exposed to</span><b>' +
      pv.watchers.length + '</b><em>' +
      (pv.watchers.length ? pv.watchers.map(function (o) { return o.code; }).join(' ') : 'nobody') +
      '</em></div></div>';
    if (pv.advance) {
      h += '<p class="hint small">An Advance moves up to ' + u.move +
        '" and then fires without the Fire! bonus.</p>';
    } else if (u.fp !== null) {
      h += '<p class="hint small">The gold rings are Range and half Range from there; ' +
        'the lit ground is what it would be able to see.</p>';
    }
    if (pv.unit.cls === 'vehicle' && pv.unit.turn) {
      /* A hull does not pivot for free: this is where its allowance goes, and
         why the shaded ground reaches further ahead than behind. */
      h += '<p class="hint small">' + (pv.reverse
        ? 'It backs up in a straight line — half speed, so ' + pv.ground.toFixed(1) +
          '" of ground costs ' + pv.spent.toFixed(1) + '" of its ' + pv.allowance.toFixed(1) + '".'
        : pv.turns
          ? pv.turns + (pv.turns === 1 ? ' turn' : ' turns') + ' of up to 90° at ' + pv.unit.turn +
            '" each — ' + pv.ground.toFixed(1) + '" of ground costs ' + pv.spent.toFixed(1) +
            '" of its ' + pv.allowance.toFixed(1) + '".'
          : 'Straight ahead, so no turn to pay — ' + pv.spent.toFixed(1) + '" of its ' +
            pv.allowance.toFixed(1) + '".') + '</p>';
    }
    if (pv.crushes) h += '<p class="hint small">A Tier III hull flattens any low or high wall it drives over.</p>';
    h += '<div class="acts"><button class="act primary" data-act="movego"><span>' +
      (pv.advance ? 'Advance here' : 'Move here') + '</span><small>or tap the same ground again</small></button>' +
      '<button class="act" data-act="movecancel"><span>Pick another spot</span></button></div>';
    return h + '</div>';
  }

  function moveSpotUnder(c) {
    var tol = tolerance(c.scale, 30), best = null, bd = Infinity;
    ui.moves.forEach(function (m) {
      var p = canvasFromWorld(m.x, m.y, liftOf(m.x, m.y));
      var d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = m; }
    });
    return best && bd < tol ? best : null;
  }

  /* ---------- terrain tooltip ---------- */
  function hideTerrainTip() {
    clearTimeout(ui.tipTimer);
    var tip = el('terraintip');
    if (tip) tip.hidden = true;
  }

  function showTerrainTip(e, p) {
    var tip = el('terraintip'), wrap = document.querySelector('.board-wrap');
    if (!tip || !wrap) return;
    var tk = R.terrainAt(state, p.x, p.y), t = R.TERRAIN[tk];
    var bits = [];
    var bp = t.enterable ? state.terrain.filter(function (r) { return r.kind === tk && R.inRect(p.x, p.y, r); })[0] : null;
    if (bp) {
      var bs = R.sectionsOf(bp), bi = 0;
      bs.forEach(function (q, n) { if (p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h) bi = n; });
      var occ = R.occupant(state, bp, bi), hi = R.sectionHigh(bp, bs[bi]);
      bits.push((tk === 'bunker' ? 'reinforced' : hi ? 'high' : 'low') + (bs.length > 1 ? ' · section ' + (bi + 1) + ' of ' + bs.length : ''));
      bits.push(occ ? 'held by ' + occ.label : 'empty — Enter from within 4"');
      bits.push('+2 Defence' + (hi ? ', +2 Firepower' : '') + ', no Crossfire inside');
    }
    else if (t.impassable) bits.push('impassable');
    if (t.cover && !bp) bits.push('+' + t.cover + ' Defence ' + (tk === 'barricade' ? 'within 2" behind it' : 'in it'));
    if (t.fp && t.hill) bits.push('+' + t.fp + ' Firepower shooting down');
    if (t.hill) bits.push('blocks sight across it');
    if (t.wire) bits.push('an extra D6" to cross');
    if (t.noCrossfire) bits.push('no Crossfire');
    if (t.blocks) bits.push('blocks line of sight');
    if (t.movePenalty) bits.push(t.movePenalty + '" off a move ' + (t.linear ? 'for each crossing' : 'into or through it — once a move'));
    if (t.shallow) bits.push('no Cumbersome Weapons');
    if (t.destructible) bits.push('can be brought down');
    if (t.wreck) bits.push('what is left of it');
    if (!bits.length) bits.push('no cover, no penalty');

    var extra = '';
    var obj = state.objectives.filter(function (o) { return R.inches(p.x, p.y, o.x, o.y) <= 4; })[0];
    if (obj) extra += 'Inside an objective — hold it with an unsuppressed unit and no enemy within 4".<br>';
    var u = ui.selected;
    if (u && u.alive) {
      var d = Math.max(0, R.inches(u.x, u.y, p.x, p.y) - UR);
      extra += d.toFixed(1) + '" from ' + u.code;
      if (u.fp !== null) extra += d <= u.range / 2 ? ' · inside half range' : d <= u.range ? ' · in range' : ' · out of range';
      var spot = ui.moves.length ? nearestMoveSpot(p) : null;
      if (spot) extra += '<br>Reachable — ' + spot.cost.toFixed(1) + '" of movement';
    }

    tip.innerHTML = '<b>' + t.name + '</b><span>' + bits.join(' · ') + '</span>' +
      (extra ? '<em>' + extra + '</em>' : '');
    tip.hidden = false;

    var r = wrap.getBoundingClientRect();
    var x = e.clientX - r.left - tip.offsetWidth / 2;
    var y = e.clientY - r.top - tip.offsetHeight - 14;
    if (y < 6) y = e.clientY - r.top + 18;
    tip.style.left = Math.max(6, Math.min(r.width - tip.offsetWidth - 6, x)) + 'px';
    tip.style.top = Math.max(6, Math.min(r.height - tip.offsetHeight - 6, y)) + 'px';

    clearTimeout(ui.tipTimer);
    ui.tipTimer = setTimeout(hideTerrainTip, 6000);
    if (SFX) SFX.click();
  }

  function nearestMoveSpot(p) {
    var best = null, bd = Infinity;
    ui.moves.forEach(function (m) {
      var d = R.inches(p.x, p.y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    });
    return best && bd < 1.2 ? best : null;
  }

  function onBoardTap(e) {
    if (!state || state.over || ui.resOpen) return;
    hideTerrainTip();
    var c = canvasPoint(e), p = ISO.toWorld(bufferFromCanvas(c).x, bufferFromCanvas(c).y);

    if (state.phase === 'terrain') { terrainTap(p); return; }
    if (state.phase === 'deploy' && state.relocating) { relocTap(p); return; }
    if (state.phase === 'deploy') {
      var pending = deployNext();
      if (!pending) return;
      /* Tapping a model already on the table picks that one up instead — the
         natural way to shuffle a line before the first turn. */
      var under = deployRoster(pending.side).filter(function (u) {
        return u.x >= 0 && u.id !== pending.id && R.inches(u.x, u.y, p.x, p.y) < 1.1;
      })[0];
      if (under) { pickToDeploy(under.id); return; }
      /* A building in the deployment zone may be garrisoned from the start: a
         tap on one puts the unit inside, if it is empty and the unit can go in. */
      var gs = garrisonAt(p.x, p.y);
      if (gs) {
        var gq = gs.rect, gx = gq.x + gq.w / 2, gy = gq.y + gq.h / 2;
        var gOcc = R.occupant(state, gs.piece, gs.sec);
        if (garrisonable(pending) && (!gOcc || gOcc === pending) && deployOK(pending.side, gx, gy, pending)) {
          // the engine finds the building again from the tap and puts the unit inside
          if (SFX) SFX.step();
          send({ k: 'garrison', id: pending.id, x: p.x, y: p.y });
          return;
        }
        setHint(null, gOcc ? 'That building already has ' + gOcc.name + ' in it — one unit to a building.'
          : !garrisonable(pending) ? pending.name + ' cannot go into a building.' : 'That building is outside your deployment area.');
        render();
        return;
      }
      var circleZone = state.sc.defCircle && pending.side === state.sc.defender;
      /* The engine forgives a near miss too, and by the same margin, but it
         cannot tell a near miss from a tap on the far side of the table — so
         a hopeless tap is answered here, where the camera is, rather than
         coming back as a refusal with nothing to look at. */
      var clear = deployOK(pending.side, p.x, p.y, pending) &&
        !R.TERRAIN[R.terrainAt(state, p.x, p.y)].impassable &&
        !R.unitNear(state, p.x, p.y, pending, 1);
      var nudged = false;
      if (!clear) {
        var near = nearestDeploySpot(pending, p.x, p.y, 9);
        if (near) { p = near; nudged = true; }
        else {
          // too far off to be a near miss: show them where the ground actually is
          lookAtDeployment();
          render();
          setHint(null, circleZone
            ? 'Outside your deployment area — the camera has gone back to the shaded circle around the objective.'
            : 'Outside your deployment strip — the camera has gone back to the shaded band on your edge.');
          return;
        }
      }
      if (SFX) SFX.step();
      send({ k: 'deploy', id: pending.id, x: p.x, y: p.y });
      if (nudged) {
        setHint(null, pending.name + ' set down at the near edge of your ' +
          (circleZone ? 'deployment area' : 'strip') + '.');
      }
      return;
    }

    // a unit is coming in: the tap is the drop point, nothing else
    if (ui.insertion) {
      var v0 = viewRect();
      placeInsertion(ISO.toWorld(c.x + v0.sx, c.y + v0.sy));
      return;
    }

    var hit = unitUnder(c);

    // the OpFor has been driving the camera: a tap on open ground gives it back
    if (cam.borrowed && !hit) {
      var reclaim = !(ui.moves.length && moveSpotUnder(c));
      if (reclaim) { returnHome(); return; }
    }

    // a demolition pick takes priority: the piece is the target, not a unit
    if (ui.terrain.length) {
      var w = ISO.toWorld(c.x + viewRect().sx, c.y + viewRect().sy);
      var piece = ui.terrain.filter(function (r) { return R.inRect(w.x, w.y, r); })[0];
      if (piece) {
        if (ui.mode === 'breach') doBreach(piece); else doDemolish(piece);
        return;
      }
    }

    // going into a building: the tap picks the section
    if (ui.mode === 'enter' && ui.sections && ui.sections.length) {
      var wq = p;
      var sct = ui.sections.filter(function (q) {
        return wq.x >= q.rect.x - 0.4 && wq.x <= q.rect.x + q.rect.w + 0.4 && wq.y >= q.rect.y - 0.4 && wq.y <= q.rect.y + q.rect.h + 0.4;
      })[0];
      if (sct) { doEnter(ui.selected, sct); return; }
      if (!hit || hit === ui.selected) { setHint(null, 'Tap one of the lit buildings.'); return; }
    }
    if (ui.moves.length && ui.mode === 'exitbld') {
      var xs = moveSpotUnder(c);
      if (xs) { doExitBld(ui.selected, xs); return; }
      if (!hit) { setHint(null, 'Come out onto the shaded ground, within 4" of the wall.'); return; }
    }
    // acting on a target takes priority over re-selecting it
    if (ui.targets.length && hit && ui.targets.indexOf(hit) >= 0) {
      if (ui.mode === 'assault') doAssault(hit);
      else if (ui.mode === 'steady') doSteady(hit);
      else if (ui.mode === 'designate') doDesignate(hit);
      else if (ui.mode === 'embark') doEmbark(hit);
      else if (ui.mode === 'teleport') doTeleport(ui.selected, hit);
      else if (ui.mode === 'teleport-dest') finishTeleport(ui.teleport, hit);
      else if (ui.mode === 'hack') doHack(hit);
      else if (ui.mode === 'support') doSupport(hit);
      else doShoot(hit);
      return;
    }
    if (ui.moves.length && ui.mode === 'disembark') {
      var spot = moveSpotUnder(c);
      if (spot) { doDisembark(spot); return; }
      if (!hit) { setHint(null, 'Put them down inside the shaded ground, within 4" of the hull.'); return; }
    }
    if (ui.moves.length && ui.mode === 'strafe') {
      var lane = moveSpotUnder(c);
      if (lane) { doStrafe(lane); return; }
      if (!hit) { setHint(null, 'Pick the far end of the run inside the shaded ground.'); return; }
    }
    // Psychic Wave: move, then the wave goes out from wherever it stops
    if (ui.moves.length && ui.mode === 'wave') {
      var wspot = moveSpotUnder(c);
      if (!wspot && hit === ui.selected) wspot = { x: hit.x, y: hit.y };
      if (wspot) { doWave(ui.selected, wspot); return; }
      if (!hit) { setHint(null, 'Tap inside the shaded ground to move there first, or tap the unit to send the wave from where it stands.'); return; }
    }
    // a marker may move up to its Movement and then call the shot (p. 58)
    if (ui.moves.length && ui.mode === 'designate') {
      var mspot = moveSpotUnder(c);
      if (mspot) { doMarkMove(mspot); return; }
    }
    if (ui.moves.length && (ui.mode === 'move' || ui.mode === 'advance-move')) {
      var spot = moveSpotUnder(c);
      if (spot) { previewMove(spot); return; }
      if (!hit) {
        if (ui.preview) { cancelPreview(); return; }
        setHint(null, 'Out of reach — tap inside the shaded ground.');
        showTerrainTip(e, p);
        return;
      }
    }
    if (hit) { select(hit); return; }
    showTerrainTip(e, p);            // open ground: say what is there
  }

  function onBoardMove(e) {
    if (!state || e.pointerType === 'touch') return;
    ui.hover = worldFromEvent(e);
    if (ui.selected || state.phase === 'terrain') drawBoard();
  }

  function onKey(e) {
    if (ui.resOpen) {
      var ae = document.activeElement;
      // let the focused Continue button handle its own Enter/Space
      if ((e.key === 'Enter' || e.key === ' ') && ae && ae.id === 'res-continue') return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); closeRes(); }
      return;
    }
    if (e.key === 'Escape') {
      if (drawerEl().classList.contains('open')) { closeDrawer(); return; }
      // putting an aimed action away is the engine's business, like taking it up
      cancelPreview();
      send({ k: 'cancel' });
      return;
    }
    if (e.key === '+' || e.key === '=') { setZoom(1); return; }
    if (e.key === '-' || e.key === '_') { setZoom(-1); return; }
    if (e.key === '0' || e.key.toLowerCase() === 'f') { fitView(); return; }
    if (e.key.indexOf('Arrow') === 0) {
      var step = 40 / cam.z;
      panBy(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
        e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
      e.preventDefault(); return;
    }
    // R turns the piece in hand while the terrain is being laid
    if ((e.key === 'r' || e.key === 'R') && state && state.phase === 'terrain') {
      var ta = curArea();
      if (ta && seats.indexOf(ta.side) >= 0 && !isAI(ta.side) && state.tset.ghost) { terrainAct('trotate'); return; }
    }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= STANDARD.length) chooseAction(STANDARD[n - 1].id);
  }

  /* ================= mustering a company ================= */
  var muster = { keys: [], name: '', opFaction: null, solo: false, players: null, cur: 0 };
  var SOLO = window.PMCSolo;

  /* The composition check the muster screen is building against: the standard
     table, or in a solitaire game the commando table (p. 147). */
  function musterCheck(keys) {
    if (muster.solo) return SOLO.checkCommando(keys, musterTier(), musterPL(), musterFaction());
    return R.checkArmy(keys, musterTier(), musterPL(), null, musterTactic(), musterFaction());
  }
  function musterLimits(tier, pl, c) {
    if (muster.solo) return c.limits;
    return R.compFor(musterFaction(), tier).limits.map(function (l) { return [l[0] * pl, l[1] === 99 ? 99 : l[1] * pl]; });
  }
  // co-op: two players, each with a commando of their own
  function soloSave() {
    if (!muster.players) return;
    muster.players[muster.cur] = { keys: muster.keys.slice(), name: muster.name, faction: musterFaction() };
  }
  function soloLoad(i) {
    soloSave();
    muster.cur = i;
    var p = muster.players[i] || { keys: [], name: '', faction: musterFaction() };
    muster.keys = p.keys.slice(); muster.name = p.name || '';
    if (el('sel-faction')) el('sel-faction').value = p.faction || 'pmc';
    Array.prototype.forEach.call(document.querySelectorAll('#solo-players [data-player]'), function (b) {
      b.setAttribute('aria-pressed', String(+b.getAttribute('data-player') === i));
    });
    drawMuster();
  }
  function setSoloMode(on) {
    muster.solo = on;
    el('setup').classList.toggle('solo-mode', on);
    el('solo-box').hidden = !on;
    el('setup-title').textContent = on ? 'Muster your commando' : 'Muster your force';
    var b = el('btn-setup-solo');
    if (b) b.textContent = on ? 'Back to a standard battle' : 'Solitaire or co-op against the OpFor';
    muster.keys = []; muster.name = '';
    muster.players = on ? [{ keys: [], name: '', faction: musterFaction() }, { keys: [], name: '', faction: musterFaction() }] : null;
    muster.cur = 0;
    soloPlayersUI();
    drawMuster();
  }
  function soloPlayersUI() {
    var coop = muster.solo && el('sel-solo-mode').value === 'coop';
    el('solo-players').hidden = !coop;
    if (!coop && muster.cur !== 0) soloLoad(0);
  }

  function musterTier() { return parseInt(el('sel-tier').value, 10) || 3; }
  function musterPL() { return parseInt(el('sel-pl').value, 10) || 1; }
  function musterFaction() { return el('sel-faction') ? el('sel-faction').value : 'pmc'; }
  function musterTactic() {
    if (musterFaction() !== 'rebel') return null;
    return (el('sel-tactic') && el('sel-tactic').value) || null;
  }

  // would this unit still be legal if one more were added?
  function hasRoom(p) {
    var trial = muster.keys.concat([p.key]);
    if (muster.solo && !SOLO.usable(p)) return false;
    var c = musterCheck(trial);
    if (c.spent > c.budget) return false;
    for (var i = 0; i < c.faults.length; i++) {
      // a shortfall of the battle tier's own units is fine while building
      if (c.faults[i].indexOf('Needs at least') !== 0) return false;
    }
    return true;
  }

  function statLine(p) {
    if (p.cls && p.cls !== 'infantry') {
      return (p.cls === 'aircraft' ? 'aircraft' : 'vehicle') +
        ' · M' + p.move + (p.turn ? ' (' + p.turn + ')' : '') +
        ' · FP' + (p.fp === null ? '—' : p.fp) + ' · ' + p.range + '" · Def ' + p.def +
        ' · A' + p.assault + ' · Str ' + p.str +
        (p.transport ? ' · carries ' + p.transport : '') +
        (p.turretSet > 1 ? ' · a set of ' + p.turretSet : '');
    }
    return p.size + ' models · M' + p.move + ' · FP' + (p.fp === null ? '—' : p.fp) +
      ' · ' + p.range + '" · Def ' + p.def + (p.defPierced ? '/' + p.defPierced : '') +
      ' · A' + p.assault + ' · Mor ' + p.morale;
  }

  function drawMuster() {
    var tier = musterTier(), pl = musterPL(), faction = musterFaction(), tactic = musterTactic();
    var c = musterCheck(muster.keys);
    var lims = musterLimits(tier, pl, c);

    var tf = el('tactic-field');
    // Rebels cannot use Tactics in a solitaire game; they get the extra points instead (p. 147)
    if (tf) tf.hidden = faction !== 'rebel' || muster.solo;
    var mh = document.querySelector('.muster-head b');
    if (mh) mh.textContent = muster.solo
      ? (el('sel-solo-mode').value === 'coop' ? 'Player ' + (muster.cur + 1) + '\u2019s commando' : 'Your commando')
      : musterFaction() === 'bugs' ? 'Your swarm' : musterFaction() === 'xeno' ? 'Your tribe' : musterFaction() === 'rebel' ? 'Your group' : 'Your company';
    var tn = el('tactic-note');
    if (tn) {
      var td = tactic ? R.tacticById(tactic) : null;
      tn.textContent = td ? td.text : (faction === 'rebel'
        ? 'A rebel force may take one tactic, or none. It is declared once the scenario is known but before a single piece of terrain is placed — and never in a solitaire game.'
        : '');
    }
    /* The opposition follows the player's choice of force — mercenaries draw
       insurgents and the other way about — but only until the player says
       otherwise, and only when the force itself changes. */
    var op = el('sel-op');
    if (op && muster.opFaction !== faction) {
      muster.opFaction = faction;
      if (op.dataset.touched !== '1') op.value = faction === 'rebel' || faction === 'bugs' || faction === 'xeno' ? 'roll:pmc' : 'roll:rebel';
    }

    var pts = el('pts');
    pts.textContent = c.spent + ' / ' + c.budget + ' points';
    pts.classList.toggle('over', c.spent > c.budget);

    el('limits').innerHTML = (muster.solo ? 'Commando, by Tier — ' : 'Units by Tier — ') + [1, 2, 3, 4, 5].map(function (t) {
      var lo = lims[t - 1][0], hi = lims[t - 1][1];
      if (hi === 0) return null;
      var txt = hi === 99 ? lo + '+' : lo + '-' + hi;
      var short = c.counts[t] < lo || c.counts[t] > hi;
      return R.ROMAN[t] + ' <b' + (short ? ' class="short"' : '') + '>' + c.counts[t] + '/' + txt + '</b>';
    }).filter(Boolean).join(' · ');

    el('chosen').innerHTML = muster.keys.map(function (k, i) {
      var pick = R.splitPick(k), p = R.profile(pick.key);
      if (!p) return '';
      var props = R.propsFor(p);
      var drive = props.length
        ? '<select class="drive" data-drive="' + i + '" title="Propulsion — Appendix 3, p. 166">' +
        props.map(function (pr) {
          var d = R.PROPULSION[pr];
          return '<option value="' + pr + '"' + ((pick.prop || R.defaultDrive(p) || 'wheeled') === pr ? ' selected' : '') +
            '>' + d.name + '</option>';
        }).join('') + '</select>'
        : '';
      var drone = R.canBeDrone(p)
        ? '<button type="button" class="drone' + (pick.drone ? ' on' : '') + '" data-drone="' + i +
        '" title="Drone Control (p. 37): +1 Structure, no crew — but enemy Hackers can reach it">DRN</button>'
        : '';
      var mnt = R.canMount(p, pick.riders)
        ? '<select class="drive" data-mount="' + i + '" title="What they ride — the models only; the rules are the same">' +
        R.MOUNT_ORDER.map(function (m) {
          return '<option value="' + m + '"' + ((pick.mount || 'bike') === m ? ' selected' : '') + '>' + R.MOUNTS[m].name + '</option>';
        }).join('') + '</select>'
        : '';
      var ride = R.canRide(p)
        ? '<button type="button" class="drone' + (pick.riders ? ' on' : '') + '" data-riders="' + i +
        '" title="Riders upgrade (p. 93): half the models, Movement 10, and the Riders rule — no buildings, no walls, no lifts">RDR</button>'
        : '';
      return '<span class="pickwrap">' +
        '<button type="button" class="pick" data-drop="' + i + '" title="Remove">' +
        p.name + (pick.riders ? ' (mounted)' : '') + ' <b>' + R.ROMAN[p.tier] + '</b></button>' + drive + drone + ride + mnt + '</span>';
    }).join('');

    var f = el('faults');
    if (!muster.keys.length) { f.textContent = 'Pick units from the list below, or roll a force.'; f.className = 'faults'; }
    else if (c.ok) { f.textContent = 'A legal ' + (muster.solo ? 'commando' : 'company') + ' at Battle Tier ' + R.ROMAN[tier] + ', Priority Level ' + pl + '.'; f.className = 'faults ok'; }
    else { f.textContent = c.faults.join(' '); f.className = 'faults'; }

    var groups = [], seen = {};
    (muster.solo ? SOLO.catalogue(faction) : R.listFor(faction)).forEach(function (p) {
      if (!seen[p.group]) { seen[p.group] = []; groups.push(p.group); }
      seen[p.group].push(p);
    });
    el('cat').innerHTML = groups.map(function (g) {
      return '<h4>' + g + '</h4>' + seen[g].map(function (p) {
        var allowed = lims[p.tier - 1][1] > 0;
        var ok = allowed && hasRoom(p);
        var why = !allowed ? 'Tier ' + R.ROMAN[p.tier] + ' units cannot be fielded at Battle Tier ' + R.ROMAN[tier]
          : ok ? ((p.rules.join(', ') || 'No special rules') +
            (R.propsFor(p).length ? ' — pick its propulsion once it is in the list' : ''))
            : 'No room left — over points, or at this unit\'s limit';
        return '<button type="button" class="cu" data-add="' + p.key + '"' + (ok ? '' : ' disabled') +
          ' title="' + why + '">' +
          '<span class="t">' + R.ROMAN[p.tier] + '</span>' +
          '<span>' + p.name + '<small>' + statLine(p) + (p.rules.length ? ' · ' + p.rules.join(', ') : '') + '</small></span>' +
          '<span class="st">+' + p.tier + '</span></button>';
      }).join('');
    }).join('');

    var sel = el('sel-preset');
    var want = muster.solo ? [] : R.presetsFor(tier, faction);
    sel.innerHTML = '<option value="">Ready-made…</option>' + want.map(function (pr) {
      return '<option value="' + pr.id + '">' + pr.name + '</option>';
    }).join('');
  }

  /* ================= saved skirmish forces =================
     A force that took ten minutes to put together should not have to be built
     again next time. Each one is kept whole — the units and their propulsions
     and upgrades, but also the Battle Tier, the Priority Level, the faction,
     the rebel tactic and the colour — because a list of units without the Tier
     it was legal at is not a force, it is a pile of names.

     They live in this browser, and they export to a file so a force can be
     carried to another device or handed to an opponent. */
  var FORCE_KEY = 'pmc-forces';

  function loadForces() {
    try {
      var raw = localStorage.getItem(FORCE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(isForce) : [];
    } catch (e) { return []; }
  }
  function saveForces(list) {
    try { localStorage.setItem(FORCE_KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }
  function isForce(f) {
    return !!f && typeof f.name === 'string' && Array.isArray(f.keys);
  }

  // everything about the force as it stands, in one object
  function currentForce(name) {
    return {
      v: 1,
      name: name,
      faction: musterFaction(),
      tier: musterTier(),
      pl: musterPL(),
      tactic: musterTactic(),
      colour: muster.colour || 'ochre',
      keys: muster.keys.slice(),
      saved: new Date().toISOString().slice(0, 10)
    };
  }

  /* Put a saved force back on the screen. A saved file can be older than the
     army list it was built from, so every unit is checked against the
     catalogue and anything that no longer exists is dropped and reported
     rather than quietly breaking the muster. */
  function applyForce(f) {
    if (!isForce(f)) return { ok: false, why: 'That file is not a saved force.' };
    var lost = [];
    var keys = f.keys.filter(function (k) {
      var pick = R.splitPick(k);
      if (R.profile(pick.key)) return true;
      lost.push(pick.key);
      return false;
    });
    if (el('sel-faction') && f.faction) el('sel-faction').value = f.faction;
    if (el('sel-tier') && f.tier) el('sel-tier').value = String(f.tier);
    if (el('sel-pl') && f.pl) el('sel-pl').value = String(f.pl);
    if (el('sel-tactic')) el('sel-tactic').value = f.tactic || '';
    if (f.colour && ISO.COLOURS[f.colour]) {
      muster.colour = f.colour;
      try { localStorage.setItem('pmc-colour', f.colour); } catch (e) { }
    }
    muster.keys = keys;
    muster.name = f.name || '';
    muster.opFaction = null;                 // let the opposition follow again
    if (el('force-name')) el('force-name').value = f.name || '';
    drawMuster();
    return { ok: true, lost: lost, force: f };
  }

  function forceNote(text, tone) {
    var n = el('force-note');
    if (!n) return;
    n.textContent = text || '';
    n.className = 'forcenote' + (tone ? ' ' + tone : '');
  }

  function drawForceList() {
    var sel = el('sel-force');
    if (!sel) return;
    var list = loadForces();
    var cur = sel.value;
    sel.innerHTML = '<option value="">' +
      (list.length ? 'Saved forces…' : 'No saved forces yet') + '</option>' +
      list.map(function (f, i) {
        var sub = R.ROMAN[f.tier] + '/' + f.pl + ' · ' + f.keys.length + ' units';
        return '<option value="' + i + '">' + esc(f.name) + ' — ' + sub + '</option>';
      }).join('');
    if (cur && list[cur]) sel.value = cur;
    var del = document.querySelector('[data-force="del"]');
    if (del) del.disabled = !sel.value;
  }

  function saveCurrentForce() {
    var input = el('force-name');
    var name = (input ? input.value : '').trim();
    if (!muster.keys.length) { forceNote('There is nothing in the force to save yet.', 'bad'); return; }
    if (!name) {
      forceNote('Give the force a name first.', 'bad');
      if (input) input.focus();
      return;
    }
    var list = loadForces();
    var at = -1;
    for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === name.toLowerCase()) at = i;
    var f = currentForce(name);
    if (at >= 0) list[at] = f; else list.push(f);
    if (!saveForces(list)) {
      forceNote('This browser will not let the game save — try the file instead.', 'bad');
      return;
    }
    muster.name = name;
    drawForceList();
    if (el('sel-force')) el('sel-force').value = String(at >= 0 ? at : list.length - 1);
    var del = document.querySelector('[data-force="del"]');
    if (del) del.disabled = false;
    forceNote((at >= 0 ? 'Replaced' : 'Saved') + ' "' + name + '" — ' + f.keys.length +
      ' units at Battle Tier ' + R.ROMAN[f.tier] + ', Priority Level ' + f.pl + '.', 'ok');
  }

  function deleteForce() {
    var sel = el('sel-force');
    if (!sel || !sel.value) return;
    var list = loadForces();
    var f = list[parseInt(sel.value, 10)];
    if (!f) return;
    list.splice(parseInt(sel.value, 10), 1);
    saveForces(list);
    sel.value = '';
    drawForceList();
    forceNote('Deleted "' + f.name + '".');
  }

  function exportForce() {
    var name = (el('force-name') ? el('force-name').value : '').trim() || muster.name || 'force';
    if (!muster.keys.length) { forceNote('There is nothing in the force to save yet.', 'bad'); return; }
    var f = currentForce(name);
    var blob = new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() + '.pmcforce.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    forceNote('Written to ' + a.download + '.', 'ok');
  }

  function importForce(file) {
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      var f;
      try { f = JSON.parse(rd.result); } catch (e) {
        forceNote('That file could not be read.', 'bad');
        return;
      }
      var r = applyForce(f);
      if (!r.ok) { forceNote(r.why, 'bad'); return; }
      forceNote('Loaded "' + (f.name || 'a force') + '"' +
        (r.lost.length ? ' — ' + r.lost.length + ' unit' + (r.lost.length > 1 ? 's are' : ' is') +
          ' no longer in the army list and were left out.' : '.'),
        r.lost.length ? 'bad' : 'ok');
      drawForceList();
    };
    rd.readAsText(file);
  }

  function wireMuster() {
    ['sel-tier', 'sel-pl', 'sel-faction'].forEach(function (id) {
      if (!el(id)) return;
      el(id).addEventListener('change', function () {
        muster.keys = []; muster.name = '';
        if (el('sel-force')) el('sel-force').value = '';
        var db = document.querySelector('[data-force="del"]');
        if (db) db.disabled = true;
        forceNote('');
        drawMuster();
      });
    });
    if (el('sel-tactic')) el('sel-tactic').addEventListener('change', drawMuster);
    if (el('sel-op')) el('sel-op').addEventListener('change', function () { el('sel-op').dataset.touched = '1'; });
    el('chosen').addEventListener('click', function (e) {
      var dr = e.target.closest('[data-drone]');
      if (dr) {
        var di = parseInt(dr.getAttribute('data-drone'), 10);
        var dp = R.splitPick(muster.keys[di]);
        muster.keys[di] = R.joinPick(dp.key, dp.prop, !dp.drone, dp.riders, dp.mount);
        drawMuster();
        return;
      }
      var rb = e.target.closest('[data-riders]');
      if (rb) {
        var ri = parseInt(rb.getAttribute('data-riders'), 10);
        var rp = R.splitPick(muster.keys[ri]);
        muster.keys[ri] = R.joinPick(rp.key, rp.prop, rp.drone, !rp.riders, rp.mount);
        drawMuster();
        return;
      }
      var b = e.target.closest('[data-drop]');
      if (!b) return;
      muster.keys.splice(parseInt(b.getAttribute('data-drop'), 10), 1);
      muster.name = '';
      drawMuster();
    });
    el('chosen').addEventListener('change', function (e) {
      var ms = e.target.closest('[data-mount]');
      if (ms) {
        var mi = parseInt(ms.getAttribute('data-mount'), 10);
        var mp = R.splitPick(muster.keys[mi]);
        muster.keys[mi] = R.joinPick(mp.key, mp.prop, mp.drone, mp.riders, ms.value);
        drawMuster();
        return;
      }
      var sel = e.target.closest('[data-drive]');
      if (!sel) return;
      var i = parseInt(sel.getAttribute('data-drive'), 10);
      var cur = R.splitPick(muster.keys[i]);
      muster.keys[i] = R.joinPick(cur.key, sel.value, cur.drone, cur.riders, cur.mount);
      drawMuster();
    });
    el('cat').addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]');
      if (!b || b.disabled) return;
      // a hull goes in on the running gear it usually goes to war on
      var addP = R.profile(b.getAttribute('data-add'));
      var addD = R.defaultDrive(addP);
      muster.keys.push(addD ? R.joinPick(addP.key, addD) : addP.key);
      muster.name = '';
      drawMuster();
    });
    el('sel-preset').addEventListener('change', function () {
      var pr = R.presetsFor(musterTier(), musterFaction()).filter(function (x) { return x.id === el('sel-preset').value; })[0];
      if (!pr) return;
      muster.keys = pr.keys.slice();
      muster.name = pr.name;
      drawMuster();
    });
    document.querySelector('.muster-btns').addEventListener('click', function (e) {
      var b = e.target.closest('[data-army]');
      if (!b) return;
      if (b.getAttribute('data-army') === 'roll' && muster.solo) {
        muster.keys = SOLO.rollCommando(musterTier(), musterPL(), musterFaction());
        muster.name = 'Commando';
      } else if (b.getAttribute('data-army') === 'roll') {
        muster.keys = R.rollArmy(musterTier(), musterPL(), null, musterFaction());
        muster.name = 'Battle Tier ' + R.ROMAN[musterTier()] +
          (musterFaction() === 'rebel' ? ' insurgent group' : musterFaction() === 'bugs' ? ' swarm' : musterFaction() === 'xeno' ? ' tribe' : ' company');
      } else { muster.keys = []; muster.name = ''; }
      drawMuster();
    });
    var bar = document.querySelector('.forcebar');
    if (bar) {
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-force]');
        if (!b || b.disabled) return;
        var what = b.getAttribute('data-force');
        if (what === 'save') saveCurrentForce();
        else if (what === 'del') deleteForce();
        else if (what === 'export') exportForce();
        else if (what === 'import') el('force-file').click();
      });
      el('sel-force').addEventListener('change', function () {
        var sel = el('sel-force');
        document.querySelector('[data-force="del"]').disabled = !sel.value;
        if (!sel.value) { forceNote(''); return; }
        var f = loadForces()[parseInt(sel.value, 10)];
        var r = applyForce(f);
        if (!r.ok) { forceNote(r.why, 'bad'); return; }
        // applyForce redraws, which rebuilds nothing here — put the pick back
        el('sel-force').value = sel.value;
        forceNote('Loaded "' + f.name + '"' +
          (r.lost.length ? ' — ' + r.lost.length + ' unit' + (r.lost.length > 1 ? 's are' : ' is') +
            ' no longer in the army list and were left out.' : ', saved ' + f.saved + '.'),
          r.lost.length ? 'bad' : 'ok');
      });
      el('force-file').addEventListener('change', function (e) {
        importForce(e.target.files && e.target.files[0]);
        e.target.value = '';
      });
      // Enter in the name box saves, because that is what Enter is for
      el('force-name').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveCurrentForce(); }
      });
      drawForceList();
    }
    // solitaire and co-op: the switch, the player tabs, and the mode
    if (el('btn-setup-solo')) el('btn-setup-solo').addEventListener('click', function () { setSoloMode(!muster.solo); });
    if (el('sel-solo-mode')) el('sel-solo-mode').addEventListener('change', function () { soloPlayersUI(); drawMuster(); });
    if (el('solo-players')) el('solo-players').addEventListener('click', function (e) {
      var b = e.target.closest('[data-player]');
      if (!b) return;
      soloLoad(+b.getAttribute('data-player'));
    });
    // open empty, with the whole list live to pick from
    drawMuster();
  }

  /* Start a solitaire or co-op game from the muster screen. Each player's
     commando is checked against the commando table and rolled if it is not
     legal; the OpFor pool is rolled against its own table, a Priority Level
     higher for every extra player (p. 147). */
  function startSolo() {
    var tier = musterTier(), pl = musterPL();
    var coop = el('sel-solo-mode').value === 'coop';
    soloSave();
    var plist = coop ? muster.players.slice(0, 2) : [muster.players ? muster.players[0] : { keys: muster.keys, faction: musterFaction() }];
    var armyA = [], ownersA = [], names = [];
    plist.forEach(function (p, i) {
      var f = p.faction || 'pmc', keys = p.keys || [];
      if (!SOLO.checkCommando(keys, tier, pl, f).ok) keys = SOLO.rollCommando(tier, pl, f);
      keys.forEach(function (k) { armyA.push(k); ownersA.push(i + 1); });
      names.push(coop ? 'Player ' + (i + 1) : 'Your commando');
    });
    var gamePL = pl + (coop ? 1 : 0);
    var opFaction = el('sel-solo-op').value;
    var machines = armyA.some(function (k) { var p = R.profile(R.splitPick(k).key); return p && p.cls !== 'infantry'; });
    var armyB = SOLO.rollOpFor(tier, gamePL, opFaction, machines);
    var scen = el('sel-solo-scen').value;
    if (scen === 'roll') scen = SOLO.ORDER[Math.floor(Math.random() * SOLO.ORDER.length)];
    el('setup').hidden = true;
    var colA = muster.colour || 'ochre';
    begin({
      tier: tier, pl: gamePL, scenario: scen,
      armyA: armyA, armyB: armyB, ownersA: ownersA,
      nameA: coop ? 'The commandos' : (muster.players && muster.players[0].name) || 'Your commando',
      nameB: 'OpFor',
      colourA: colA, colourB: foeColour([colA]),
      tactics: { A: null, B: null },
      mode: 'ai', planet: el('sel-planet').value,
      terrainSetup: el('sel-terrain') ? el('sel-terrain').value : 'auto',
      solo: { coop: coop, faction: (plist[0].faction || 'pmc'), opFaction: opFaction, names: names }
    });
  }

  /* The board window is sized to the screen it is on rather than to a fixed
     900x540 box: on a desktop it takes the whole width left over beside the
     panel, and as much height as is free above the action bar, so the table
     fills the screen instead of sitting in a letterbox. */
  function sizeView(first) {
    var wrap = document.querySelector('.board-wrap');
    /* The header's real height, so the board can be pinned under it. */
    var hdr = document.querySelector('header');
    if (hdr) document.documentElement.style.setProperty('--hdr', Math.round(hdr.getBoundingClientRect().height) + 'px');
    if (window.innerWidth <= 1000) {
      /* The table fills everything above the panel. The buffer is sized to that
         box rather than to a fixed portrait window, so the board really is full
         screen and the projection is not stretched to fit. */
      var bw = wrap ? wrap.clientWidth : window.innerWidth;
      var bh = wrap ? wrap.clientHeight : Math.round(window.innerHeight * 0.62);
      VIEW_W = Math.max(320, Math.min(1400, Math.round(bw)));
      VIEW_H = Math.max(260, Math.min(1400, Math.round(bh)));
    } else {
      var avail = wrap ? wrap.clientWidth - 12 : window.innerWidth - 380;
      /* What is left of the window once the header, the action bar, the context
         card and the terrain key have taken their share. */
      var used = 380;
      var top = wrap ? wrap.getBoundingClientRect().top : 120;
      var room = Math.round(window.innerHeight - top - used);
      VIEW_W = Math.max(720, Math.min(2200, Math.round(avail)));
      VIEW_H = Math.max(460, Math.min(1400, Math.max(room, Math.round(VIEW_W * 0.46))));
      // never taller than it is wide: the projection is a wide diamond
      VIEW_H = Math.min(VIEW_H, Math.round(VIEW_W * 0.72));
    }
    DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    var bw2 = Math.round(VIEW_W * DPR), bh2 = Math.round(VIEW_H * DPR);
    if (!first && canvas.width === bw2 && canvas.height === bh2) return false;
    canvas.width = bw2; canvas.height = bh2;
    if (first) cam.z = 0;                    // the first view is the whole table
    canvas.style.maxWidth = VIEW_W + 'px';
    /* ZOOMS[0] is "the whole table"; the rest are real magnifications, and any
       that would show less than the fit level are dropped so the ladder always
       climbs. */
    var fit = Math.floor(Math.min(VIEW_W / ISO.PIXW, VIEW_H / ISO.PIXH) * 100) / 100;
    ZOOMS.length = 0;
    ZOOMS.push(fit);
    ZOOM_STEPS.forEach(function (z) { if (z > fit + 0.02) ZOOMS.push(z); });
    if (cam.z <= fit) cam.z = fit;
    if (ZOOMS.indexOf(cam.z) < 0) cam.z = nearestZoom(cam.z);
    return true;
  }

  /* ================= boot ================= */
  function boot() {
    canvas = el('board'); ctx = canvas.getContext('2d');
    /* A phone screen is tall and narrow, but the isometric table is 1.7:1 the
       other way. A 560x680 window used to leave the whole-table view sitting in
       360px of black — over half the frame — with nothing to pan into. The window
       is still portrait enough to be useful zoomed in, without that waste. */
    sizeView(true);
    /* The fixed panels settle after the first layout, so the board box is only
       its real size on the next frame — measure again then. */
    requestAnimationFrame(function () {
      if (!sizeView(false)) return;
      clampCam();
      if (state) render();
    });
    pix = document.createElement('canvas');
    pix.width = ISO.PIXW; pix.height = ISO.PIXH;
    pctx = pix.getContext('2d');
    cam.x = cam.tx = ISO.PIXW / 2; cam.y = cam.ty = ISO.PIXH / 2;

    var pointers = {}, pinch = null;
    var TAP_SLOP = 12;          // client px a finger may wander and still count as a tap
    var TAP_TIME = 700;         // ms

    function pointerList() {
      var out = [];
      for (var k in pointers) out.push(pointers[k]);
      return out;
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (!state) return;
      /* Only the primary button taps. A right or middle button still drags the
         camera, but a right click is a turn of the piece in hand (see the
         contextmenu handler), and must never also put the piece down. */
      pointers[e.pointerId] = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: nowMs(), moved: false,
        tapless: e.pointerType === 'mouse' && e.button > 0 };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      var list = pointerList();
      if (list.length === 2) {
        pinch = { d: Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) };
        list.forEach(function (p) { p.moved = true; });        // a pinch is never a tap
      } else if (list.length === 1) {
        cam.drag = { cx: cam.x, cy: cam.y, ox: cam.ox || 0, oy: cam.oy || 0 };
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      var p = pointers[e.pointerId];
      if (!p) { onBoardMove(e); return; }
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > TAP_SLOP) p.moved = true;

      var list = pointerList();
      if (list.length === 2 && pinch) {
        var d = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
        if (d > pinch.d * 1.35) { setZoom(1); pinch.d = d; }
        else if (d < pinch.d * 0.74) { setZoom(-1); pinch.d = d; }
        return;
      }
      if (list.length === 1 && cam.drag && p.moved) {
        var sl = slack();
        var r = canvas.getBoundingClientRect(), scale = r.width / VIEW_W;
        if (sl.x > 0.5) cam.ox = cam.drag.ox + (p.x - p.x0) / scale;
        else cam.x = cam.drag.cx - (p.x - p.x0) / scale / cam.z;
        if (sl.y > 0.5) cam.oy = cam.drag.oy + (p.y - p.y0) / scale;
        else cam.y = cam.drag.cy - (p.y - p.y0) / scale / cam.z;
        panBy(0, 0);
      }
    });

    function endPointer(e) {
      var p = pointers[e.pointerId];
      delete pointers[e.pointerId];
      if (!pointerList().length) { pinch = null; cam.drag = null; }
      if (!p) return;
      var ux = (typeof e.clientX === 'number' && (e.clientX || e.clientY)) ? e.clientX : p.x;
      var uy = (typeof e.clientY === 'number' && (e.clientX || e.clientY)) ? e.clientY : p.y;
      if (Math.hypot(ux - p.x0, uy - p.y0) > TAP_SLOP) p.moved = true;
      // act where the finger landed, not where the up event reports
      if (!p.moved && !p.tapless && nowMs() - p.t0 < TAP_TIME) {
        onBoardTap({ clientX: p.x0, clientY: p.y0, pointerType: e.pointerType });
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', function (e) {
      delete pointers[e.pointerId];
      if (!pointerList().length) { pinch = null; cam.drag = null; }
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    /* The wheel zooms, about whatever is under the pointer — which is what a
       mouse expects on a map. Shift (or a sideways wheel) pans instead, and so
       does a trackpad's two-finger drag, which arrives as a wheel with both
       axes moving. */
    canvas.addEventListener('wheel', function (e) {
      if (!state) return;
      e.preventDefault();
      var sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (e.shiftKey || sideways) {
        panBy(e.deltaX * 0.7 / cam.z, e.deltaY * 0.7 / cam.z);
        return;
      }
      if (!e.deltaY) return;
      var now2 = nowMs();
      if (now2 - (ui.wheelAt || 0) < 55) return;      // one notch at a time
      ui.wheelAt = now2;
      zoomAt(e.deltaY < 0 ? 1 : -1, canvasPoint(e));
    }, { passive: false });
    canvas.addEventListener('mouseleave', function () { ui.hover = null; if (state) drawBoard(); });
    /* Laying terrain by hand, a right click turns the piece in hand a quarter —
       the same as R or the Turn it button, without taking the pointer off the
       spot it is about to go down on. Any other time the board is left alone. */
    canvas.addEventListener('contextmenu', function (e) {
      if (!state || state.phase !== 'terrain' || !state.tset || !state.tset.ghost) return;
      var ta = curArea();
      if (!ta || isAI(ta.side) || seats.indexOf(ta.side) < 0) return;
      e.preventDefault();
      terrainAct('trotate');
      if (SFX) SFX.click();
    });
    document.addEventListener('keydown', onKey);

    el('viewctl').addEventListener('click', function (e) {
      var b = e.target.closest('[data-zoom]'); if (!b || !state) return;
      var z = b.getAttribute('data-zoom');
      if (z === 'in') setZoom(1);
      else if (z === 'out') setZoom(-1);
      else fitView();
    });

    wireMuster();
    el('btn-start').addEventListener('click', function () {
      /* The lobby borrowed this screen to have a force built. Hand the force
         back rather than starting a battle: the one that matters is being
         arranged in the room, and it starts when both sides say so. */
      if (muster.forLobby) {
        var want = muster.forLobby;
        muster.forLobby = null;
        el('setup').hidden = true;
        want.done(window.PMC_MUSTER_NOW());
        return;
      }
      if (muster.solo) { startSolo(); return; }
      var tier = parseInt(el('sel-tier').value, 10), pl = parseInt(el('sel-pl').value, 10);
      var faction = musterFaction(), tactic = musterTactic();
      var mine = muster.keys.slice();
      if (!R.checkArmy(mine, tier, pl, null, tactic, faction).ok) mine = R.rollArmy(tier, pl, null, faction);
      var opChoice = el('sel-op').value;
      var opFaction = opChoice === 'mirror' ? faction : opChoice.split(':')[1] || 'pmc';
      var theirs = opChoice === 'mirror' ? mine.slice() : R.rollArmy(tier, pl, null, opFaction);
      // the OpFor rebels pick a tactic of their own, the way a player would
      var opTactic = opFaction !== 'rebel' ? null
        : opChoice === 'mirror' ? tactic
          : R.TACTICS[Math.floor(Math.random() * R.TACTICS.length)].id;
      /* Randomising the mission (p. 46) is a D6 across all six. The book also
         allows a D3 in a smaller game, which only ever reaches the first three —
         that is the player's choice to make, not the game's, so it is its own
         option rather than a coin flip hidden in here. */
      var pickScen = el('sel-scen') ? el('sel-scen').value : 'secure';
      if (pickScen === 'roll') pickScen = SC.ORDER[R.d6() - 1];
      else if (pickScen === 'rolld3') pickScen = SC.ORDER[R.d3() - 1];
      el('setup').hidden = true;
      begin({
        tier: tier, pl: pl, scenario: pickScen,
        armyA: mine, armyB: theirs,
        nameA: muster.name || ('Battle Tier ' + R.ROMAN[tier] + ' company'),
        nameB: opChoice === 'mirror' ? 'Mirror force'
          : opFaction === 'rebel' ? 'Insurgent group' : opFaction === 'bugs' ? 'Bug swarm' : opFaction === 'xeno' ? 'Xenotripod tribe' : 'OpFor company',
        colourA: muster.colour || 'ochre',
        colourB: foeColour([muster.colour || 'ochre']),
        tactics: { A: tactic, B: opTactic },
        mode: el('sel-mode').value, planet: el('sel-planet').value,
        terrainSetup: el('sel-terrain') ? el('sel-terrain').value : 'auto'
      });
    });
    /* The terrain set-up choice is remembered, and a campaign battle — which
       starts without this screen — uses whichever was picked last. */
    (function () {
      var st = el('sel-terrain');
      if (!st) return;
      try { var v = localStorage.getItem('pmc-terrainsetup'); if (v) st.value = v; } catch (e) { }
      st.addEventListener('change', function () { try { localStorage.setItem('pmc-terrainsetup', st.value); } catch (e) { } });
    })();
    drawColourPick();
    // the phone header's overflow menu
    var more = el('btn-more');
    if (more) {
      more.hidden = false;
      more.addEventListener('click', function () {
        var box = document.querySelector('.hdr-btns');
        if (box) box.classList.toggle('open');
        if (SFX) SFX.click();
      });
      document.addEventListener('click', function (e) {
        var box = document.querySelector('.hdr-btns');
        if (box && box.classList.contains('open') && !box.contains(e.target)) box.classList.remove('open');
      });
    }
    var mt = el('mtabs');
    if (mt) {
      mt.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mtab]');
        if (!b) return;
        setMTab(b.getAttribute('data-mtab'));
        if (SFX) SFX.click();
      });
      setMTab('act');
    }
    // the board window follows the window it is in
    var rsz = null;
    window.addEventListener('resize', function () {
      clearTimeout(rsz);
      rsz = setTimeout(function () {
        if (!sizeView(false)) return;
        clampCam();
        if (state) render();
      }, 120);
    });
    // the log dock: shut by default, and it remembers if you open it
    var dock = el('logdock'), dockBtn = el('btn-logdock');
    if (dock && dockBtn) {
      try { if (localStorage.getItem('pmc-logdock') === '1') dock.classList.add('open'); } catch (e4) { }
      dockBtn.setAttribute('aria-expanded', dock.classList.contains('open') ? 'true' : 'false');
      dockBtn.addEventListener('click', function () {
        var open = dock.classList.toggle('open');
        dockBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        try { localStorage.setItem('pmc-logdock', open ? '1' : '0'); } catch (e5) { }
        if (open) { var h = el('log-dock'); if (h) h.parentElement.scrollTop = h.parentElement.scrollHeight; }
        if (SFX) SFX.click();
      });
    }
    var fc = el('btn-feedclear');
    if (fc) fc.addEventListener('click', function () {
      var host = el('resfeed-list');
      if (host) host.innerHTML = '';
      if (SFX) SFX.click();
    });
    el('btn-menu').addEventListener('click', openMenu);
    el('btn-setup-menu').addEventListener('click', openMenu);
    /* Multiplayer is only offered when this page came from a game server. A
       game opened from a file, or the published single file, has nowhere to
       send an intent and nobody to send it to, so the button stays hidden
       rather than leading to a screen that cannot work. */
    if (window.PMCLobby && window.PMCLobby.available()) {
      var mb = el('btn-multi');
      mb.hidden = false;
      mb.addEventListener('click', function () {
        el('setup').hidden = true;
        if (window.PMCMenu) window.PMCMenu.close();
        window.PMCLobby.open();
      });
    }
    el('btn-drawer').addEventListener('click', toggleDrawer);
    el('btn-drawer-close').addEventListener('click', closeDrawer);
    el('scrim').addEventListener('click', closeDrawer);
    drawerEl().querySelectorAll('.dtab').forEach(function (b) {
      b.addEventListener('click', function () { setDrawerTab(b.getAttribute('data-tab')); if (SFX) SFX.click(); });
    });
    setDrawerTab('forces');
    ui.statsOpen = window.innerWidth > 760;
    el('btn-notes').addEventListener('click', function () { el('notes').hidden = false; });
    if (el('btn-menu-rules')) el('btn-menu-rules').addEventListener('click', function () { el('notes').hidden = false; });

    // the same switch on the top bar and on the menu
    var sndBtns = [el('btn-sound'), el('btn-menu-sound')].filter(Boolean);
    function paintSound() {
      var live = SFX && SFX.enabled();
      sndBtns.forEach(function (b) {
        b.textContent = live ? 'Sound on' : 'Sound off';
        b.setAttribute('aria-pressed', live ? 'true' : 'false');
        b.style.opacity = live ? '' : '.55';
      });
    }
    sndBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (!SFX) return;
        SFX.setEnabled(!SFX.enabled());
        paintSound();
        if (SFX.enabled()) SFX.chime();
      });
    });
    paintSound();
    document.addEventListener('pointerdown', function unlock() {
      if (SFX) SFX.unlock();
      document.removeEventListener('pointerdown', unlock);
    });
    el('btn-notes-close').addEventListener('click', function () { el('notes').hidden = true; });
    el('resolution').addEventListener('click', function (e) { if (e.target.id === 'resolution') closeRes(); });
  }

  window.PMC_STATE = function () { return state; };

  function openMenu() {
    if (window.PMCMenu) window.PMCMenu.open();
    else el('setup').hidden = false;
  }
  /* The menu's Skirmish choices all land on the muster sheet, set up for the
     kind of battle picked: the four standard ways to play read the "Play
     against" choice, and solitaire and co-op switch the sheet into commando
     mode. */
  window.PMC_SKIRMISH = function (kind) {
    var solo = kind === 'solo' || kind === 'coop';
    if (solo !== !!muster.solo) setSoloMode(solo);
    el('solo-box').hidden = !solo;
    el('setup').classList.toggle('solo-mode', solo);
    if (solo) { el('sel-solo-mode').value = kind; soloPlayersUI(); }
    else el('sel-mode').value = kind;
    el('setup-title').textContent = {
      ai: 'Muster your force', hotseat: 'Muster your force — hotseat', demo: 'Muster a force to watch',
      solo: 'Muster your commando', coop: 'Muster your commandos'
    }[kind] || 'Muster your force';
    el('setup').hidden = false;
  };
  window.PMC_BATTLE_LIVE = function () {
    return !!(state && state.phase && !state.over);
  };

  /* ---- the ways in ----
     Four screens start a battle — the muster screen, solitaire, a campaign
     contract and a room in the lobby — and all four arrive here. The first
     three run the engine in this tab; the fourth is already running on a
     server and only hands over the seat. */
  window.PMC_JOIN_BATTLE = function (transport, seat, cfg) {
    var setup = el('setup');
    if (setup) setup.hidden = true;
    if (window.PMCMenu) window.PMCMenu.close();
    if (cfg && cfg.colourA) ISO.setSideColour('A', cfg.colourA);
    if (cfg && cfg.colourB) ISO.setSideColour('B', cfg.colourB);
    wireNet(transport);
    joinBattle(transport, seat);
    transport.send('resync');
  };
  /* The lobby borrows the muster screen to build a force: it is the one place
     that knows the composition table and the unit cards. */
  window.PMC_MUSTER_FOR = function (terms, done) {
    el('setup').hidden = false;
    muster.forLobby = { terms: terms, done: done };
    if (terms) {
      if (el('sel-tier')) el('sel-tier').value = terms.tier;
      if (el('sel-pl')) el('sel-pl').value = terms.pl;
    }
    setSoloMode(false);
    drawMuster();
  };
  window.PMC_MUSTER_NOW = function () {
    return {
      faction: musterFaction(), tactic: musterTactic() || '',
      keys: muster.keys.slice(), colour: muster.colour || 'ochre',
      name: muster.name || ''
    };
  };
  window.__begin = function (cfg, opts) { return begin(cfg, opts); };
  window.__startBattle = function () { startBattle(); };
  window.__deployDone = function () { return deploymentDone(); };
  /* Driving the board the way a player does: the units that may act, the
     actions on offer for one of them, and whatever the chosen action is
     waiting to be pointed at. */
  window.__eligibleUnits = function () { return eligible(state.activeSide); };
  window.__actionIds = function (u) {
    return STANDARD.map(function (a) { return a.id; })
      .filter(function (id) { return id !== 'regroup'; })
      .concat(specialsFor(u).map(function (a) { return a.id; }))
      .concat(['regroup']);
  };
  window.__commitWhatever = function () {
    if (ui.targets.length) { doShoot(ui.targets[0]); return true; }
    if (ui.terrain.length) { doDemolish(ui.terrain[0]); return true; }
    if (ui.moves.length) {
      var c = ui.moves[ui.moves.length - 1];
      if (ui.mode === 'wave') doWave(ui.selected, c);
      else if (ui.mode === 'disembark') doDisembark(c);
      else if (ui.mode === 'strafe') doStrafe(c);
      else if (ui.mode === 'designate') doMarkMove(c);
      else doMove(c);
      return true;
    }
    return false;
  };
  window.__actionState = function (u, id) { return actionState(u, id); };
  window.__showQueue = function () { return show.queue.length; };
  window.__busy = function () { return busy(); };
  window.__uiMode = function () { return ui.mode; };
  window.__uiCounts = function () { return { targets: ui.targets.length, moves: ui.moves.length, terrain: ui.terrain.length }; };
  window.__pressCancel = function () { send({ k: 'cancel' }); };
  window.__holdInsertion = function () { holdInsertion(); };
  window.__insertionSpotsNow = function () { return ui.insertion ? ui.insertion.spots : null; };
  window.__seats = function () { return seats.slice(); };
  window.__mySide = function () { return mySide(); };

  /* Test hooks: where a canvas pixel lands on the table, and whether the side
     still placing units may deploy there. */
  window.__toWorldFromCanvasPx = function (px, py) {
    var b = bufferFromCanvas({ x: px, y: py });
    return ISO.toWorld(b.x, b.y);
  };
  window.__autoDeployBoth = function () { autoDeployMine(); };
  window.__deployOK = function (x, y, side) {
    side = side || placingSide();
    return !!side && deployOK(side, x, y);
  };
  /* The campaign layer starts a battle through here rather than through the
     muster screen: the same config, plus the dossier entries and the doctrines. */
  window.PMC_NEWGAME = function (cfg) {
    var setup = el('setup');
    if (setup) setup.hidden = true;
    begin(cfg);
  };
  window.__report = function () { return state && state.report; };
  Object.defineProperty(window, '__moves', { get: function () { return ui.moves; } });
  window.__clearSel = function () { ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; render(); };
  window.__fxdebug = function () { return { anims: anims.length, fx: fx.length, tracers: fx.filter(function (f) { return f.kind === 'tracer'; }).length }; };
  window.PMC_VIEW = function () { var v = viewRect(); v.W = VIEW_W; v.H = VIEW_H; return v; };
  window.PMC_LIFT = function (x, y) { return liftOf(x, y); };
  // put an arriving unit down where the harness says, through the engine
  window.__forceDrop = function (u, p) {
    send({ k: 'insert', x: p.x, y: p.y });
    return !!(u && u.alive);
  };
  window.__insertionAsking = function () { return ui.insertion ? (ui.insertion.unit ? ui.insertion.unit.code : 'LZ') : null; };
  window.__insertionState = function () {
    return ui.insertion
      ? { unit: ui.insertion.unit ? ui.insertion.unit.code : null, spots: ui.insertion.spots.length, kind: ui.insertion.kind }
      : null;
  };
  window.__insertionSpots = function (u) { return insertionSpots(u || null); };
  window.__arrivalSpots = function (u) { return arrivalSpots(u); };
  window.__arrivalLegal = function (u, p) { return arrivalLegal(u, p); };
  // how far off a tap may be and still count, at the zoom in use
  window.__snapReach = function () { return snapReach(); };
  window.__setZoom = function (z) { cam.z = z; };
  window.__landUnit = function (u) { landUnit(u); };
  window.__setMTab = function (which) { setMTab(which); };
  // saved skirmish forces, for the harness
  window.__forces = {
    list: function () { return loadForces(); },
    current: function (n) { return currentForce(n || 'test'); },
    apply: function (f) { return applyForce(f); },
    save: function () { return saveCurrentForce(); },
    note: function () { var n = el('force-note'); return n ? n.textContent : ''; },
    muster: function () { return muster.keys.slice(); },
    clear: function () { try { localStorage.removeItem('pmc-forces'); } catch (e) { } drawForceList(); }
  };
  window.__mTab = function () {
    var c = document.querySelector('.console');
    return c ? c.getAttribute('data-mtab') : null;
  };
  /* The gait a unit is drawn with, and a sampling of it across a move: the
     harness uses this to check that feet and body stay in step. */
  window.__gait = function (u) { return gaitOf(u); };
  window.__pacing = function (u, inches, samples) {
    var g2 = gaitOf(u);
    if (!g2) return null;
    var out = [];
    var an = { unit: { prop: u.prop, cls: u.cls, rules: u.rules || [] }, lastPace: -1, lastStep: 0 };
    an.unit = Object.assign({}, u);
    an.total = inches;
    for (var i = 0; i <= samples; i++) {
      var d = inches * (i / samples);
      pace(an, d, i / samples, 0);
      out.push({ d: d, walk: an.unit.walk, hop: Math.round(an.unit.hop * 100) / 100, arc: Math.round((an.unit.arc || 0) * 10) / 10 });
    }
    return { span: g2.span, lift: g2.lift, sound: g2.sound, samples: out };
  };
  window.__deployNext = deployNext;
  // a legal spot in the deploying side's own zone, n places along
  window.__deployAim = function (n) {
    var u = deployNext();
    if (!u) return null;
    var got = [];
    for (var x = 1; x < W; x += 1.5) {
      for (var y = 1; y < H; y += 1.5) {
        if (!deployOK(u.side, x, y, u)) continue;
        if (R.TERRAIN[R.terrainAt(state, x, y)].impassable) continue;
        if (R.unitNear(state, x, y, u, 1)) continue;
        got.push({ x: x, y: y });
      }
    }
    return got[Math.min(got.length - 1, n || 0)] || null;
  };
  // a board tap at a table point, bypassing the pixel maths
  window.__boardTapAt = function (x, y) {
    var s = ISO.toScreen(x, y), v = viewRect();
    onBoardTap({
      clientX: 0, clientY: 0,
      __pt: { x: (s.x - v.sx) * v.z + v.dx, y: (s.y - v.sy) * v.z + v.dy }
    });
  };
  window.__tset = function () {
    if (!state || !state.tset) return null;
    var a = curArea(), ts = state.tset;
    return {
      phase: state.phase, i: ts.i, starter: ts.starter, edges: state.edges || null,
      sides: ts.areas.map(function (x) { return x.side; }),
      area: a ? { name: a.name, side: a.side, x: a.x, y: a.y, w: a.w, h: a.h, alt: a.alt, spec: a.spec, count: a.count.slice(), alts: a.row.alts.length, roll: a.roll } : null,
      ghost: ts.ghost ? { kind: ts.ghost.kind, w: ts.ghost.w, h: ts.ghost.h } : null,
      placed: a ? a.placed.length : 0
    };
  };
  window.__terrainAct = function (act, arg) { terrainAct(act, arg); };
  window.__uiMode = function () { return { mode: ui.mode, sections: (ui.sections || []).length, sel: ui.selected ? ui.selected.id : null, moves: ui.moves.length }; };
  window.__resOpen = function () { return ui.resOpen ? (ui.currentRes ? ui.currentRes.kind + ':' + ui.currentRes.title : 'open') + ' q' + resQueue.length : false; };
  window.__insertionLegal = function (p) { return insertionLegal(p) && !R.unitNear(state, p.x, p.y, ui.insertion ? ui.insertion.unit : null, 1); };
  window.__dropHere = function (p) { placeInsertion(p); };
  window.__terrainPicks = function () { return ui.mode + ': ' + ui.terrain.map(function (r) { return r.kind; }).join(', '); };
  window.__terrainList = function () { return ui.terrain.map(function (r) { return { kind: r.kind, x: r.x, y: r.y }; }); };
  window.__tapMove = function (spot) { if (ui.mode === 'disembark') doDisembark(spot); else previewMove(spot); };
  window.__sel = function () { return ui.selected; };
  window.__canvasAt = function (x, y) {
    var c = canvasFromWorld(x, y, liftOf(x, y));
    var r = el('board').getBoundingClientRect();
    return { x: Math.round(c.x + r.left), y: Math.round(c.y + r.top) };
  };
  window.__moveSpots = function () { return ui.moves.slice(); };
  window.__previewState = function () {
    var pv = ui.preview;
    if (!pv) return null;
    return {
      at: { x: Math.round(pv.spot.x * 10) / 10, y: Math.round(pv.spot.y * 10) / 10 },
      advance: pv.advance, dist: Math.round(pv.dist * 10) / 10,
      terrain: pv.terrain.name, cover: pv.terrain.cover,
      sees: pv.seen.map(function (o) { return o.code; }),
      shots: pv.shots.map(function (o) { return o.code; }),
      watchers: pv.watchers.map(function (o) { return o.code; }),
      moved: pv.unit.x !== pv.spot.x || pv.unit.y !== pv.spot.y,
      card: (document.getElementById('context') || {}).textContent || ''
    };
  };
  window.__previewConfirm = function () { commitMove(); };
  window.__previewCancel = function () { cancelPreview(); };
  window.__rebuildScene = function () { state.scene = null; state.ground = null; state.structs = null; drawBoard(); };
  window.__tapTerrain = function (i) {
    var r = ui.terrain[i];
    if (!r) return false;
    if (ui.mode === 'breach') doBreach(r); else doDemolish(r);
    return true;
  };
  window.__targetCodes = function () { return ui.mode + ': ' + ui.targets.map(function (t) { return t.code + '/' + t.side; }).join(', '); };
  window.__testShoot = function (a, b) { playShooting(a, b, { hits: 2 }, [], null); };
  window.__shootAt = function (id) { doShoot(byId(id)); };
  window.__fxkinds = function () { return fx.map(function (f) { return f.kind; }); };
  /* What the effects layer was told, not just what kind it was: the harness uses
     this to check that a shot to or from a flier leaves the airframe. */
  window.__fxlive = function () {
    return fx.map(function (f) {
      return {
        kind: f.kind,
        // how high the effect starts: its lift plus, when it leaves a barrel,
        // how far that barrel sits above the ground
        up: (f.up || 0) + (f.mz ? -f.mz.dy : 0),
        fromUp: f.from ? (f.from.up || 0) + (f.from.mz ? -f.from.mz.dy : 0) : null,
        toUp: f.to ? (f.to.up || 0) : null
      };
    });
  };
  window.__flyLift = function (u) { return ISO.flyLift(u); };
  window.__addFx = function (f) { addFx(f); };
  // the cadence each streaming style fires at, which the viewer also reads
  window.__fireSpec = function (style) {
    var f = FIRE[style];
    return f ? { gap: f.gap, clump: f.clump || 0, clumpGap: f.clumpGap || 0,
      min: f.n(0), max: f.n(99), length: streamLength(style, 2) } : null;
  };
  // test hook: act on a unit as though it had been tapped on the table
  window.__tapUnit = function (u) {
    if (!u) return false;
    if (ui.targets.indexOf(u) < 0) return false;
    if (ui.mode === 'assault') doAssault(u);
    else if (ui.mode === 'designate') doDesignate(u);
    else if (ui.mode === 'embark') doEmbark(u);
    else if (ui.mode === 'hack') doHack(u);
    else if (ui.mode === 'steady') doSteady(u);
    else if (ui.mode === 'support') doSupport(u);
    else doShoot(u);
    return true;
  };
  // test hooks: drive a unit through the bar the way a player would
  window.__select = function (u) { if (!u) return false; select(u); return ui.selected === u; };
  window.__actionState = function (id) { return ui.selected ? actionState(ui.selected, id) : null; };
  window.__specials = function () { return specialsFor(ui.selected).map(function (x) { return x.id; }); };
  window.__forcedCharge = function (u) { var f = forcedCharge(u); return f ? f.id : null; };
  window.__relocating = function () { return state.relocating ? { side: state.relocating.side, cap: state.relocating.cap, moved: state.relocating.moved.slice() } : null; };
  window.__pressAction = function (id) {
    var u = ui.selected;
    if (!u) return false;
    var st = actionState(u, id);
    if (!st.on) return false;
    chooseAction(id);
    return true;
  };
  window.__eligibleCodes = function () {
    return eligible(state.activeSide).map(function (u) { return u.code; });
  };
  window.__markState = function () {
    return {
      mode: ui.mode, kind: ui.markKind || null, reach: ui.selected ? markReach(ui.selected) : 0,
      targets: ui.targets.length, moves: ui.moves.length,
      picks: (ui.markPicks || []).length
    };
  };
  window.__setMuster = function (keys) { muster.keys = keys.slice(); muster.name = 'Test force'; drawMuster(); };
  window.__colours = function () { return { A: muster.colour, B: ui.foeColour || null }; };
  window.PMC_SETVIEW = function (wx, wy, z) {
    var p = ISO.toScreen(wx, wy);
    if (z) { cam.z = z; zoomLabel(); }
    cam.x = cam.tx = p.x; cam.y = cam.ty = p.y;
    clampCam(); setHome(cam.x, cam.y); drawBoard();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
