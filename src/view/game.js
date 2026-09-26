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
  var DPR = 1;
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
  // what is always up on the table: every Xenotripod shield generator's dome, faint, redrawn each frame
  var STANDING = window.PMCFx.create({ lift: function (x, y) { return liftOf(x, y); } });
  var el = function (id) { return document.getElementById(id); };

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
    // a demo is for watching: there is nothing to act with, so no Actions tab, and it opens on the results
    document.body.setAttribute('data-battle', cfg.mode || '');
    if (window.innerWidth <= 1000) setMTab(cfg.mode === 'demo' ? 'res' : 'act');
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
    pendingArrive = {};
    held = {};
    if (state) state.units.forEach(function (u) { u.ax = u.ay = null; });   // nothing is part-way through a move now
    anims.forEach(function (an) { if (an.unit) an.unit.burrow = null; });
    anims.length = 0;
    FX.clear && FX.clear();
    resQueue.length = 0; ui.resOpen = false;
    var box = el('resolution'); if (box) box.hidden = true;
    clearTimeout(ui.resTimer);
    feedHosts().forEach(function (h) { h.innerHTML = ''; });
    ui.feedUnread = 0;
    ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
    ui.insertion = null; ui.preview = null; ui.deployPick = null;
    ui.watch = null; ui.inspect = false;
  }

  /* ---- sending ---- */
  /* Is this screen allowed to act right now? The engine decides for real; this
     is so the board can grey a button out rather than offer a refusal. */
  function mySide() {
    if (!state || watching) return null;
    if (ui.insertion) {
      var s = ui.insertion.by || (ui.insertion.unit ? ui.insertion.unit.side : 'A');
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
  /* A unit whose arrival is still waiting in the queue is already on the
     table in the state that came with it — but it is not drawn until the
     arrival plays, so an AI's Battlefield Insertion does not sit there through
     the beat before its drop. Kept by id: a networked state is rebuilt each turn. */
  var pendingArrive = {};
  function moveQueued(u) {
    return !!u && show.queue.some(function (ev) { return ev.e === 'move' && ev.id === u.id; });
  }
  function arrivalQueued(u) { return !!(u && pendingArrive[u.id]); }
  /* The battle arrives already resolved, and what happened is played out after
     it. Until each part plays, the table should show things as they stood: a
     unit that is about to move stands where it started, and a unit about to be
     shot keeps the models, the suppression and the life it had until the shots
     land. `shown` is the table as it was last drawn at rest; `held` is what is
     kept back from the new state until its event plays. */
  var shown = {}, held = {};
  function snapshotShown() {
    shown = {};
    if (!state) return;
    state.units.forEach(function (u) {
      shown[u.id] = { models: u.models, sp: u.sp, alive: u.alive, x: u.x, y: u.y, aboard: u.aboard, reserve: u.reserve, damage: u.damage, fled: u.fled };
    });
  }
  function holdForShow(events) {
    if (!state) return;
    var moved = {};
    events.forEach(function (ev) {
      if (ev.e === 'move' && ev.id && !moved[ev.id]) {
        moved[ev.id] = true;
        var mu = evUnit(ev.id), p0 = ev.path && ev.path[0];
        // it stands where it started until its move is drawn
        if (mu && p0 && (mu.ax === null || mu.ax === undefined) && !anims.some(function (an) { return an.unit === mu; })) {
          mu.ax = p0.x; mu.ay = p0.y;
        }
      }
      var hit = [];
      if (ev.e === 'shoot' || ev.e === 'assault') hit.push(ev.to, ev.from);
      (ev.deaths || []).forEach(function (d) { hit.push(d.id); });
      hit.forEach(function (id) {
        if (!id || held[id] || !shown[id]) return;
        var was = shown[id], u = evUnit(id);
        if (!u || !was.alive) return;
        if (was.models !== u.models || was.sp !== u.sp || was.alive !== u.alive || was.damage !== u.damage) held[id] = was;
      });
    });
  }
  function releaseFor(ev) {
    if (!ev) return;
    [ev.to, ev.from, ev.id].concat((ev.deaths || []).map(function (d) { return d.id; }))
      .forEach(function (id) { if (id) delete held[id]; });
  }
  // the unit as it should be drawn: itself, or itself as it stood before what is still to be played
  function shownAs(u) {
    var h = u && held[u.id];
    if (!h) return u;
    var o = Object.create(u);
    o.models = h.models; o.sp = h.sp; o.alive = h.alive; o.damage = h.damage; o.fled = h.fled;
    if (!u.alive) { o.x = h.x; o.y = h.y; o.aboard = h.aboard; o.reserve = h.reserve; }
    return o;
  }
  var show = {
    queue: [],
    running: false,
    play: function (events) {
      (events || []).forEach(function (ev) { if (ev.e === 'arrive' && ev.id && ev.how !== 'board') pendingArrive[ev.id] = true; });
      holdForShow(events || []);
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
        // what it did to them shows on the panels once it has been drawn, not before
        if (waits) { whenIdle(function () { releaseFor(ev); drawStats(); drawPanel(); show.pump(); }); return; }
      }
      held = {};
      snapshotShown();
      show.running = false;
      syncUI();
      render();
      stepWatched();
      scheduleReturn();
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
  var OPPONENT_BEAT = 1400;             // long enough to see which unit is about to act
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
    if (state.phase !== 'battle' || ui.resOpen || menuUp()) return;
    stepTimer = setTimeout(function () {
      stepTimer = null;
      if (!state || state.over || ui.resOpen || menuUp()) return;
      send({ k: 'step' });
    }, 260);
  }
  /* Gone back to the menu, the demo stops where it is: nothing more is asked
     for until the menu is put away again (Resume carries it on). */
  /* On a desktop what the unit may do, and what it is being asked, is read in
     the left rail under its stats (scrolling there); the buttons stay under the
     table. On a narrower screen the text goes back to the console. */
  var consoleHome = null;
  function placeConsole() {
    var hint = el('hintbar'), ctx = el('context'), side = el('statstrip-side');
    if (!hint || !ctx || !side || !side.parentNode) return;
    if (!consoleHome) consoleHome = { parent: ctx.parentNode, hintNext: hint.nextSibling, ctxNext: ctx.nextSibling };
    if (window.innerWidth > 1000) {
      if (ctx.parentNode !== side.parentNode) {
        side.parentNode.insertBefore(hint, side.nextSibling);
        side.parentNode.insertBefore(ctx, hint.nextSibling);
      }
    } else if (ctx.parentNode !== consoleHome.parent) {
      consoleHome.parent.insertBefore(ctx, consoleHome.ctxNext);
      consoleHome.parent.insertBefore(hint, ctx);
    }
  }
  placeConsole();
  window.addEventListener('resize', placeConsole);
  /* On a desktop, a new battle's set-up has the menu's table rolling behind it;
     it stops when the set-up goes away (or the screen is too narrow for it). */
  function setupBackdrop() {
    var T = window.PMCMenu && window.PMCMenu.table;
    if (!T || !T.on) return;
    var wide = window.innerWidth > 1000, want = null;
    [['setup', 'setup-table'], ['camp', 'camp-table']].forEach(function (pr) {
      var sp = el(pr[0]), cv = el(pr[1]);
      if (sp && cv && !sp.hidden && wide && !want) want = cv;
    });
    if (want) { if (T.on() !== want) T.start(want); }
    else if (T.on() === el('setup-table') || T.on() === el('camp-table')) T.stop();
  }
  (function () {
    if (!window.MutationObserver) return;
    ['setup', 'camp'].forEach(function (id) {
      var sp = el(id);
      if (sp) new MutationObserver(setupBackdrop).observe(sp, { attributes: true, attributeFilter: ['hidden'] });
    });
    window.addEventListener('resize', function () {
      setupBackdrop();
      var on = window.PMCMenu && window.PMCMenu.table.on();
      if (on && (on === el('setup-table') || on === el('camp-table'))) window.PMCMenu.table.fit();
    });
  })();
  function menuUp() {
    if (window.PMCMenu && window.PMCMenu.isOpen()) return true;
    // nor while a new battle is being set up, or the campaign is open, over the top of it
    return ['setup', 'camp'].some(function (id) { var x = el(id); return !!x && !x.hidden; });
  }
  window.addEventListener('pmc-menu-closed', function () { stepWatched(); });

  function evUnit(id) { return id ? Q.byId(id) : null; }

  function applyEvent(ev) {
    // a test can ask for the order the show is played in, and when
    if (window.__traceShow) window.__traceShow.push({ t: Math.round(nowMs()), e: ev.e, id: ev.id || ev.from || (ev.f && ev.f.kind) || (ev.card && ev.card.kind) || '', to: ev.to || '', busy: busy() });
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
        var sa = evUnit(ev.from), sb = ev.at ? { x: ev.at.x, y: ev.at.y } : evUnit(ev.to);
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
        delete pendingArrive[ev.id];
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
        // the other side's unit borrows the camera; it is handed back once they are done. (Whose
        // turn it is by the state would be wrong here: by the time this is drawn it is already ours.)
        focusUnit(fu, false, seats.indexOf(fu.side) < 0);
        // a pause before the other side's unit acts — and before every unit in a demo, where both sides are the AI's
        if (seats.indexOf(fu.side) < 0 || handsOff()) beat(OPPONENT_BEAT);
        return;
      }
      case 'hint': setHint(null, ev.text || undefined); return;
      case 'colour': {
        ISO.setSideColour(ev.side, ev.key);
        // the panels, pills and P1/P2 tags wear the colours the forces are painted in
        var cvar = { A: '--own-A', C: '--own-C' }[ev.side];
        if (cvar && ISO.PALETTE[ev.side]) document.documentElement.style.setProperty(cvar, sideInk(ev.side));
        return;
      }
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
      case 'clearcards': {
        /* Clear the table's cards and effects, but not the rest of the batch
           this came in: the new game's table, its zoom and its first look are
           queued right behind it. */
        var rest = show.queue.slice();
        resetShow();
        Array.prototype.push.apply(show.queue, rest);
        return;
      }
      case 'look': lookAtDeployment(ev.side); return;
      default: return;
    }
  }

  /* An effect the engine described without knowing how high anything is drawn.
     A flier's height is a matter for the view, so it is filled in here. */
  function reLift(f) {
    /* A teleport link to or from a craft meets the craft's middle, and the
       craft's gate runs for as long as the link is up. */
    if (f && f.kind === 'tplink') {
      [['fromId', 'from'], ['toId', 'to']].forEach(function (e) {
        var cu = evUnit(f[e[0]]);
        if (cu && cu.cls === 'aircraft') {
          f[e[1]] = { x: f[e[1]].x, y: f[e[1]].y, up: ISO.craftCentreUp(cu) };
          cu.ringUntil = nowMs() + (f.delay || 0) + (f.dur || 1500);
        }
      });
      return f;
    }
    /* A smoke round fired by a machine — a captured patrol craft's — leaves its
       gun, up where the craft flies, not the grass under it. */
    if (f && f.kind === 'lob' && f.unit) {
      var sm = evUnit(f.unit);
      if (sm && R.isMachine(sm)) f.from = ISO.mountFor(ISO.mounts(sm), R.weaponSpec(sm).p, sm, f.from);
      return f;
    }
    /* A marker's laser and a Keen-Eyed glint come off the machine's own
       sensor, however high it flies: the nose of a craft, its scanner. */
    if (f && f.unit && (f.kind === 'beam' || f.kind === 'glint')) {
      var src = evUnit(f.unit);
      if (src && !R.isMachine(src)) {
        // a squad's laser and glint come off the eyes of the man with the optics — the spotter, the observer
        var sq = ISO.muzzles(src, R.status(src)).filter(function (m) { return m.eye; })[0];
        if (sq) f.mz = sq.eye;
      } else if (src && (src.cls === 'aircraft' || src.cls === 'vehicle')) {
        var M = ISO.mounts(src), at = f.kind === 'beam' ? (M.nose || M.scan) : (M.scan || M.nose);
        if (at && at.length) f.mz = at[0];
        else if (ISO.flyLift(src)) f.mz = { dx: 0, dy: -ISO.flyLift(src) };
      }
      return f;
    }
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
    ui.digDir = s.digDir == null ? null : s.digDir;     // Dig in!: the facing on offer
    ui.deployPick = s.deployPick;
    var wasAsked = !!ui.insertion || !!ui.reservePick;
    ui.reservePick = s.reservePick || null;
    ui.insertion = s.insertion;
    // a drop point being asked for: on a phone the Actions pane, where the ask is, comes to the front
    if ((ui.insertion || ui.reservePick) && !wasAsked && window.innerWidth <= 1000) setMTab('act');
    ui.sections = s.sections || [];
    ui.tsetHint = s.tsetHint || '';
    ui.vis = null; ui.visKey = '';
    ui.preview = null;
    /* In a demo the watcher's pick is the selection, and it stays picked
       while the AI activates one unit after another — until it is gone. */
    if ((handsOff() || ui.inspect) && ui.watch) {
      var w = byId(ui.watch);
      if (w && w.alive) { ui.selected = w; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.sections = []; }
      else { ui.watch = null; ui.inspect = false; }
    }
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
  function splitFor(side) { return Q.splitFor ? Q.splitFor(side) : null; }
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
  function forcedCharge(u) { return Q.forcedCharge(u); }
  function soloOwnerName(o) { return Q.soloOwnerName(o); }
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
  // the watcher's own pick in a demo: shown, kept, and never sent to the engine
  function inspectUnit(u) {
    ui.inspect = true;
    watchUnit(u);
  }
  function watchUnit(u) {
    ui.watch = u.id;
    ui.selected = u; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.sections = [];
    if (window.innerWidth <= 1000) setMTab('unit');
    if (SFX) SFX.click();
    render();
  }
  function select(u) {
    if (!u) return;
    if (handsOff()) { watchUnit(u); return; }
    /* Out of turn, or an enemy's unit: picked to look at, on this screen only.
       The selection the engine keeps belongs to whoever is acting, and both
       screens are shown it — so a look is kept here and nothing is sent. */
    if (!myTurn() || seats.indexOf(u.side) < 0) { inspectUnit(u); return; }
    ui.inspect = false; ui.watch = null;
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
      ' and place up to what it gives, anywhere in that area.' +
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

  /* ================= coming down ==================
     A Battlefield Insertion is not a unit blinking into existence. A craft drops
     out of the sky onto its landing point and throws up the dust it lands in; a
     squad is already on the ground when you see it, and comes up out of cover —
     which the game already has a way of drawing, because a unit flat on its face
     is a broken one. So an arriving squad is drawn broken, then suppressed, then
     standing, over about a second. It is only how it is drawn: the unit's real
     status, and everything the rules ask of it, is untouched. */
  var MOTION = window.PMCMotion;   // the timings and shapes of movement, shared with the Unit Viewer (motion.js)
  var DROP_MS = MOTION.DROP_MS, STAND_MS = MOTION.STAND_MS, TELE_MS = MOTION.TELE_MS;
  // how an arriving unit is drawn now (motion.js: arrival); once it is over, it is done arriving
  function arriving(u) {
    if (!u || !u.arriveAt) return { lift: 0, pose: null };
    var a = MOTION.arrival(u.arriveKind, nowMs() - u.arriveAt, R.isMachine(u), u.dropFrom);
    if (!a) { u.arriveAt = 0; u.dropFrom = null; return { lift: 0, pose: null }; }
    return a;
  }
  function anyArriving() {
    /* An arrival ends by the clock, drawn or not: a unit that came up off screen
       used to hold the whole game waiting for a frame that never drew it. */
    return state && state.units.some(function (u) {
      if (!u.arriveAt) return false;
      if (nowMs() - u.arriveAt >= MOTION.arrivalMs(u.arriveKind)) { u.arriveAt = 0; u.dropFrom = null; return false; }
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

  /* A unit walking or driving on from a table edge, shown coming in from the
     nearest edge (or from `start`, where the scenario says it came out) to
     where it was put. */
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

  function teleportsIn(u) {
    var p = R.profile(u.key);
    return u.faction === 'xeno' && !u.eshAven && !(p && p.eshAven);
  }
  // the pillar is sized to what comes through it
  var teleportR = MOTION.teleportR;
  function landUnit(u, fromOrbit) {
    focusUnit(u, false, true);
    /* A hull comes down on its landing point, and so do jump troops on their
       jets. A squad landing by Battlefield Insertion is shown getting up off
       the ground it came down on — except out of orbit in an Invasion, where
       it falls out of the sky like everything else that side lands. */
    var craft = !!fromOrbit || R.isMachine(u) || !!u.jets;
    /* A swarm comes up out of the ground, whatever the scenario, giants and
       all — only what flies drops out of the sky. */
    if (u.faction === 'bugs') craft = R.isFlying(u) || R.flyInf(u);
    u.arriveAt = nowMs();
    /* The Xenotripods teleport in rather than land, hulls and craft as well as
       squads — all but the Esh-Aven, who come up out of the ground as men do. */
    if (!fromOrbit && teleportsIn(u)) {
      u.arriveKind = 'teleport';
      addFx({ kind: 'teleportin', x: u.x, y: u.y, r: teleportR(u), dur: TELE_MS + 200, blocking: true });
      if (SFX && SFX.shimmer) SFX.shimmer();
      render();
      return;
    }
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
    } else if (R.isMachine(u)) {
      // the ground breaking open under it, and the dust thrown up round it
      addFx({ kind: 'groundbreak', x: u.x, y: u.y, r: 2.4, dur: STAND_MS + 500, blocking: true });
      addFx({ kind: 'collapse', x: u.x, y: u.y, r: 2.8, dur: STAND_MS, blocking: true });
      if (SFX) { SFX.impact(0.05); SFX.impact(0.18); }
    } else {
      addFx({ kind: 'collapse', x: u.x, y: u.y, r: 1.6, dur: 600, blocking: true });
      // boots, then the squad on its feet
      if (SFX) { SFX.step(); SFX.step(0.24); SFX.step(0.5); }
    }
    // keep the frame loop turning while the arrival plays out
    addFx({ kind: 'hold', x: u.x, y: u.y, dur: craft ? DROP_MS + 300 : STAND_MS, blocking: true });
    render();
  }

  // a Command Unit riding in a Command Vehicle, offered its special action (p. 57)
  function cmdOfferCard() {
    var o = state.cmdOffer, veh = byId(o.veh), cmd = byId(o.cmd);
    if (!veh || !cmd) return '';
    var n = R.ruleValue(veh, 'Command Unit');
    return '<div class="card"><h2>Command Vehicle</h2>' +
      '<p class="sub"><b>' + esc(cmd.name) + '</b> is riding in <b>' + esc(veh.name) + '</b>. Now the vehicle has acted, it may Coordinate: ' +
      'up to ' + n + ' friendly units within 12" of the vehicle activate in a row.</p>' +
      '<div class="acts"><button class="act" data-act="cmdcoord"><span>Coordinate</span><small>' + n + ' more activations in a row</small></button>' +
      '<button class="act" data-act="cmdskip"><span>No action</span><small>Let the activation pass</small></button></div></div>';
  }
  /* Modifying the armies (p. 46): before deployment, with the enemy's list on
     the other panel, a player swaps some units for others of the same Tier. */
  function swapCard() {
    var sa = state.swapAsk, foeSide = sa.side === 'A' ? 'B' : 'A';
    var mine = state.units.filter(function (u) { return u.side === sa.side && u.pickIdx != null; });
    var theirs = state.units.filter(function (u) { return u.side === foeSide; });
    // a hotseat's secret round: whose turn it is, and what they have down to swap so far
    var stg = state.swapStage, held = {};
    sa.done.forEach(function (d) { if (d.held) held[d.outId] = d.in; });
    var h = '<div class="cmodal" data-swapbox><div class="cmodal-box wide" role="dialog" aria-modal="true" aria-label="Modify your army">' +
      '<h3>' + (stg ? esc(sideName(sa.side)) + ' — modify your army' : 'Modify your army') + '</h3>' +
      (stg ? '<p class="sub"><b>' + esc(sideName(foeSide)) + ', look away.</b> Your swaps stay secret until ' +
        (stg.order.length > 1 ? 'both of you are done' : 'you are done') + '; the other side sees your force as it was mustered.</p>' : '') +
      '<p class="sub">Swap up to <b>' + sa.total + '</b> unit' + (sa.total === 1 ? '' : 's') +
      ' for others of the same Tier' + (state.cfg.dossier ? ' from your dossier' : '') + ' — <b>' + sa.left + ' left</b>. ' +
      'You have seen the table and their force.</p><div class="cmodal-scroll"><div class="swapgrid">';
    // your list, the unit being swapped marked
    h += '<div class="swapcol"><h4>Your force</h4>' + mine.map(function (m) {
      var n = Q.swapOptions(sa.side, m.id).length, on = sa.pick === m.id;
      if (held[m.id]) return '<button class="act on" disabled><span>' + esc(m.name) + ' → ' + esc(held[m.id]) + '</span><small>Tier ' + R.ROMAN[m.tier] + ' — swapped</small></button>';
      return '<button class="act' + (on ? ' on' : '') + '" data-swappick="' + (on ? '' : m.id) + '"' + (n ? '' : ' disabled') + '><span>' + esc(m.name) +
        '</span><small>Tier ' + R.ROMAN[m.tier] + (n ? (on ? ' — swapping' : '') : ' — nothing to swap in') + '</small></button>';
    }).join('') + '</div>';
    // what could stand in for it
    h += '<div class="swapcol"><h4>' + (sa.pick ? 'Swap for' : 'Swap in') + '</h4>';
    if (sa.pick) {
      var opts = Q.swapOptions(sa.side, sa.pick);
      h += opts.length ? opts.map(function (o) {
        var pr = R.profile(R.splitPick(o.key).key);
        return '<button class="act" data-swapin="' + escHtml(o.id) + '"><span>' + esc(o.name) + '</span><small>' +
          esc(pr ? (pr.name !== o.name ? pr.name + ' · ' : '') + 'Move ' + pr.move + '" · FP ' + (pr.fp == null ? '—' : pr.fp) + ' · Range ' + pr.range + '" · Def ' + pr.def : '') + '</small></button>';
      }).join('') : '<p class="hint">Nothing of that Tier to swap in.</p>';
    } else h += '<p class="hint">Pick one of your units to see what could take its place.</p>';
    h += '</div>';
    // and what they are bringing, to swap against
    h += '<div class="swapcol theirs"><h4>' + esc(sideName(foeSide)) + '</h4>' + theirs.map(function (t) {
      return '<div class="swapfoe"><b>' + esc(t.name) + '</b><small>Tier ' + R.ROMAN[t.tier] + ' · ' + (t.cls === 'infantry' ? t.models + ' models' : t.cls) + '</small></div>';
    }).join('') + '</div>';
    h += '</div></div><div class="askrow"><button class="start" data-act="swapdone" data-who="' + sa.side + '">' + (sa.left === sa.total ? 'Keep the list' : 'Done') + '</button></div></div></div>';
    return h;
  }
  // placing pieces by hand: Last Stand, Fortify and Strike!, Detailed Terrain Knowledge
  function placeCard() {
    var pa = state.placeAsk;
    var T = { laststand: ['Last Stand', 'Put up to ' + pa.total + ' barricades (low walls) anywhere but the enemy deployment zone.'],
      fortify: ['Fortify and Strike!', 'Put up to ' + pa.total + ' field fortifications (low walls) in your deployment zone.'],
      terrain: ['Detailed Terrain Knowledge', 'Move up to ' + pa.total + ' pieces of terrain up to 12" each. Tap a piece, then where it goes.'] }[pa.why];
    var picked = pa.kind === 'move' && pa.pick != null ? state.terrain[pa.pick] : null;
    return '<div class="card"><h2>' + T[0] + '</h2><p class="sub">' + T[1] + '</p>' +
      '<p class="hint">' + (picked ? 'Moving the ' + esc(R.TERRAIN[picked.kind].name.toLowerCase()) + ' — tap where it goes, or tap it again to put it back down.'
        : pa.left + ' of ' + pa.total + ' left.') + '</p>' +
      '<div class="acts">' +
      (pa.kind === 'barricade' ? '<button class="act" data-act="placerot"><span>Turn</span><small>' + (pa.vertical ? 'Running up the table' : 'Running across the table') + '</small></button>' : '') +
      '<button class="act" data-act="placedone"><span>' + (pa.left === pa.total ? 'Skip' : 'Done') + '</span><small>' +
      (pa.left === pa.total ? 'Leave the table as it is' : 'That will do') + '</small></button></div></div>';
  }
  /* Terrorist (p. 112): before deploying, the side on the Path of the Villain
     picks one destructible piece to mine — or none. */
  // Know Your Foe! (p. 141): once a battle, at the start of a turn the enemy has reinforcements coming
  function kyfCard() {
    var k = state.kyfAsk;
    return '<div class="card"><h2>Know Your Foe!</h2>' +
      '<p class="sub">The enemy has ' + k.n + ' unit' + (k.n === 1 ? '' : 's') + ' waiting to come on. Once a battle, the tribe may stop every enemy reinforcement arriving this turn.</p>' +
      '<div class="acts"><button class="act" data-act="kyf"><span>Hold them back</span><small>This turn — it cannot be used again</small></button>' +
      '<button class="act" data-act="nokyf"><span>Not now</span><small>Keep it for a later turn</small></button></div></div>';
  }
  // Martyrdom (p. 112): asked as each assault with Holy Warriors in it begins
  function martyrCard() {
    var m = state.martyrAsk, u = byId(m.unit), foe = byId(m.foe);
    if (!u || !foe) return '';
    return '<div class="card"><h2>Martyrdom</h2>' +
      '<p class="sub">' + (m.charging ? '<b>' + esc(u.name) + '</b> is charging <b>' + esc(foe.name) + '</b>'
        : '<b>' + esc(foe.name) + '</b> is charging <b>' + esc(u.name) + '</b>') +
      '. Before the first round, one of the Holy Warriors may walk into the enemy alone: ' +
      'one model is removed, and ' + esc(foe.name) + ' takes D3 automatic hits. No Suppression for the death.</p>' +
      '<div class="acts"><button class="act" data-act="martyr"><span>Send one in</span><small>' + u.models + ' models, one of them goes</small></button>' +
      '<button class="act" data-act="nomartyr"><span>Hold back</span><small>Fight the assault as it stands</small></button></div></div>';
  }
  function mineCard() {
    var mp = state.minePick;
    return '<div class="card"><h2>Terrorist</h2>' +
      '<p class="sub">Before anyone deploys, you may secretly mine one destructible piece of terrain other than the objective. ' +
      'Any First Among Equals unit can set it off during the battle — Firepower 10, Destructive Weapon.</p>' +
      '<p class="hint">Tap one of the ' + mp.pool.length + ' outlined pieces.</p>' +
      '<div class="acts"><button class="act" data-act="nomine"><span>No mine</span><small>Leave the charges in the crates</small></button></div></div>';
  }
  // is the insertion being asked for this screen's to answer? (on a network, the other player may be the one asked)
  function insertionMine() {
    var ins = ui.insertion;
    if (!ins) return false;
    var by = ins.by || (ins.unit ? ins.unit.side : 'A');
    return !watching && seats.indexOf(by) >= 0;
  }
  function insertionCard() {
    var ins = ui.insertion;
    if (!ins) return '';
    var u = ins.unit;
    if (!insertionMine()) {
      /* The other player is the one asked — the opponent shoving this side's
         drop, or placing their own arrival. This screen waits and says for what. */
      var byS = ins.by || (u ? u.side : 'A');
      return '<div class="card"><h2>' + (ins.kind === 'shove' ? 'Insertion' : 'Waiting') + '</h2>' +
        '<p class="sub">' + (ins.kind === 'shove' && u
          ? '<b>' + esc(u.name) + '</b> rolled a ' + ins.die + ' coming in: ' + esc(sideName(byS)) +
            ' may move its arrival point up to <b>' + ins.drift + '″</b>.'
          : esc(sideName(byS)) + ' is placing ' + (u ? '<b>' + esc(u.name) + '</b>' : 'a landing zone') + '.') + '</p>' +
        '<p class="hint">Waiting for ' + esc(sideName(byS)) + '. Battlefield Insertion, p. 56.</p></div>';
    }
    if (ins.kind === 'ilz') {
      return '<div class="card"><h2>Landing zone ' + ins.n + ' of 3</h2>' +
        '<p class="sub">The defender is down: nominate where the invasion comes in — an 8″ circle of open ground, ' +
        '8″ clear of every table edge and 12″ from the other zones. The first wave drops into one, two or all three of them.</p>' +
        '<p class="hint">Tap the shaded ground. Invasion, p. 53.</p></div>';
    }
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
    if (ins.kind === 'shove') {
      return '<div class="card"><h2>Enemy insertion</h2>' +
        '<p class="sub"><b>' + esc(u.name) + '</b> rolled a ' + ins.die + ' coming in: you may move its arrival point up to <b>' +
        ins.drift + '″</b> in any direction. Tap the shaded ground — or its own point to leave it.</p>' +
        '<p class="hint">Battlefield Insertion, p. 56.</p></div>';
    }
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
      'will shove the arrival point up to 2D6".</p>' +
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
    drivefirst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="13" height="7" rx="1.5"/><circle cx="6.5" cy="19" r="1.6"/><circle cx="13" cy="19" r="1.6"/><path d="M13 6h8M18 3l3 3-3 3"/></svg>',
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
  // marking a target for the fire-support team is designating it by another name
  ICONS.marktarget = ICONS.designate;

  /* The six standard actions, and how many special slots sit beside them. The
     engine owns the list, because the engine is what decides whether any of
     them is available; the icons above are the view's business. */
  var STANDARD = window.PMCEngine.STANDARD;
  var SPECIAL_SLOTS = window.PMCEngine.SPECIAL_SLOTS;




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
      if (state && state.cfg.mode === 'demo') feedToNewest(host);   // a demo is watched as it happens
    });
    ui.feedUnread = (ui.feedUnread || 0) + 1;
    markFeedTab();
  }
  /* The feed stacks newest first, at the top, but a scrolled list stays where
     it is as cards land: this brings the newest back into view. (A reversed
     column scrolls with negative offsets; a plain one clamps to its top.) */
  function feedToNewest(host) {
    [host, host && host.parentElement].forEach(function (s) {
      if (s && s.scrollHeight > s.clientHeight) s.scrollTop = -s.scrollHeight;
    });
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
    if (which === 'act' && document.body.getAttribute('data-battle') === 'demo') which = 'res';   // a demo has no Actions tab
    con.setAttribute('data-mtab', which);
    document.querySelectorAll('#mtabs .mtab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mtab') === which);
    });
    if (which === 'res') { ui.feedUnread = 0; if (state && state.cfg.mode === 'demo' && el('resfeed-m')) feedToNewest(el('resfeed-m')); }
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
    scheduleReturn();
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
    if (!state) { loop = null; return; }              // the battle was put away between frames
    var t = nowMs(), alive = [];
    anims.forEach(function (an) {
      var k = Math.min(1, (t - an.t0) / an.dur);
      if (an.kind === 'move' && an.burrow) {
        burrowStep(an, k);
        if (an.follow) {
          var bp = ISO.toScreen(an.unit.ax, an.unit.ay);
          cam.x += (bp.x - cam.x) * 0.16;
          cam.y += (bp.y - ISO.ELEV - cam.y) * 0.16;
          clampCam();
          cam.tx = cam.x; cam.ty = cam.y;
          borrowCamera();
        }
      } else if (an.kind === 'move') {
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
        if (an.kind === 'move') {
          an.unit.walk = 0; an.unit.hop = 0; an.unit.arc = 0; an.unit.burrow = null;
          /* The state is already where everything still queued leaves it. A unit
             with another move to come waits at the end of this one — and shoots
             from there — rather than jumping ahead to where its last move ends. */
          var endAt = an.segs[an.segs.length - 1].b;
          if (moveQueued(an.unit)) { an.unit.ax = endAt.x; an.unit.ay = endAt.y; }
          else an.unit.ax = an.unit.ay = null;
        }
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
  // the gait itself — pace, stride, how high a jump arcs — is motion.js's
  var STEP_GAP = MOTION.STEP_GAP, gaitOf = MOTION.gaitOf, jetApex = MOTION.jetApex;

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

  // Underground Bugs do not walk across the table: they go down and come up (motion.js)
  var burrows = MOTION.burrows, burrowR = MOTION.burrowR, moveMs = MOTION.moveMs;
  /* A burrowing move in three parts: the unit fades out where it stands as it
     goes down, travels unseen under a line of churned earth, and fades back in
     where it comes up. */
  var SINK = MOTION.BURROW_SINK, RISE = MOTION.BURROW_RISE;
  function burrowStep(an, k) {
    var u = an.unit, sub, e;
    if (k < SINK) {
      sub = k / SINK; e = sub * sub;
      u.burrow = { lift: 0, alpha: Math.max(0, 1 - e) };
      var p0 = an.segs[0].a;
      u.ax = p0.x; u.ay = p0.y;
      if (an.phase === 0) {
        an.phase = 1;
        addFx({ kind: 'collapse', x: p0.x, y: p0.y, r: burrowR(u), dur: 700, blocking: true });
        if (SFX) { SFX.step(); SFX.step(0.12); SFX.step(0.3); }
      }
      return;
    }
    if (k < RISE) {
      u.burrow = { hidden: true };
      var d = (k - SINK) / (RISE - SINK) * an.total, seg = 0;
      while (seg < an.segs.length - 1 && d > an.segs[seg].end) seg++;
      var sg = an.segs[seg];
      var f = sg.len ? Math.max(0, Math.min(1, (d - sg.start) / sg.len)) : 1;
      u.ax = sg.a.x + (sg.b.x - sg.a.x) * f;
      u.ay = sg.a.y + (sg.b.y - sg.a.y) * f;
      // the ground heaving over it as it goes, an inch at a time
      if (Math.floor(d) !== an.lastDirt) {
        an.lastDirt = Math.floor(d);
        addFx({ kind: 'miss', x: u.ax, y: u.ay, dur: 700, blocking: true });
        addFx({ kind: 'miss', x: u.ax + (Math.random() - 0.5) * 1.2, y: u.ay + (Math.random() - 0.5) * 1.2, dur: 900, blocking: true });
        if (SFX && an.lastDirt % 2 === 0) SFX.step(0.02);
      }
      return;
    }
    var pe = an.segs[an.segs.length - 1].b;
    u.ax = pe.x; u.ay = pe.y;
    if (an.phase < 2) {
      an.phase = 2;
      addFx({ kind: 'collapse', x: pe.x, y: pe.y, r: burrowR(u), dur: 800, blocking: true });
      if (SFX) { SFX.impact(0.05); SFX.step(0.15); SFX.step(0.35); }
    }
    sub = (k - RISE) / (1 - RISE); e = 1 - Math.pow(1 - sub, 2);
    u.burrow = { lift: 0, alpha: Math.min(1, e) };
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
    var dig = burrows(u);
    anims.push({
      kind: 'move', unit: u, segs: segs, total: total, follow: !!follow && !handsOff(),
      dur: dig ? MOTION.burrowMs(total) : moveMs(u, total),
      t0: nowMs(), lastStep: 0, lastPace: -1, burrow: dig, lastDirt: -1, phase: 0
    });
    u.ax = path[0].x; u.ay = path[0].y;
    startLoop();
  }

  function addFx(f) {
    FX.add(f);
    startLoop();
  }

  /* ---- a shot, played the way that unit's weapon actually works ----
     The weapons themselves are drawn by fire.js, which the Unit Viewer shares:
     each style with its own cadence, its own effect on the table and its own
     sound, timed so the hits land when the rounds arrive. What is the
     battle's is around them: the gun swinging onto its target, where each
     shot leaves, and the casualties when it lands. */
  var SHOTS = window.PMCFire.make({
    add: addFx,
    redraw: function () { render(); },
    alive: function () { return !!state; }
  });
  var FIRE = SHOTS.FIRE, streamLength = SHOTS.streamLength;
  var playSecondary = SHOTS.secondary;
  var XENO_BLUE = window.PMCFire.XENO_BLUE, BUG_GREEN = window.PMCFire.BUG_GREEN;

  // a squad on foot turns to face left or right on the screen
  function faceToward(u, x, y, from) {
    if (R.isMachine(u)) return;
    from = from || u;
    var a = ISO.toScreen(from.x, from.y), b = ISO.toScreen(x, y);
    if (b.x < a.x - ISO.K * 0.3) u.faceL = true;
    else if (b.x > a.x + ISO.K * 0.3) u.faceL = false;
  }


  function playShooting(shooter, target, res, deaths, done) {
    /* A crew-served piece swings onto its target before it fires: the carriage
       round to its new facing, then the gun traversing onto the bearing. */
    if (shooter && ISO.startTurn && ISO.turnsLikeMachine(shooter.art)) {
      var swing = ISO.startTurn(shooter);
      if (swing > 0) {
        anims.push({ kind: 'turn', unit: shooter, t0: nowMs(), dur: swing });
        startLoop();
        setTimeout(function () { if (state) playShooting(shooter, target, res, deaths, done); }, swing + 40);
        return;
      }
    }
    var spec = R.weaponSpec(shooter);
    /* A gunship fires from its airframe and is hit on its airframe, not on the
       ground it happens to be over. Every point a shot is drawn between carries
       how high above its own ground it sits. */
    /* Where each is drawn, not where the rules have already put it: a target that
       breaks and runs is still standing where it was hit until its own move plays. */
    var from = { x: dispX(shooter), y: dispY(shooter), up: ISO.flyLift(shooter) };
    var to = { x: dispX(target), y: dispY(target), up: ISO.flyLift(target) };
    /* Troopers turn to face what they are shooting at, and each shot leaves one
       of their own barrels: the pool is every surviving model's muzzle. */
    if (!R.isMachine(shooter)) {
      faceToward(shooter, to.x, to.y, from);
      window.PMCFire.troop(from, spec, ISO.muzzles(shooter, R.status(shooter)));
    }
    /* A machine turns its turret onto the target, and each weapon fires from
       its own barrel or tubes: the main gun from the muzzle, the machine gun
       from the machine gun, rockets from the rack. */
    var mountFrom = function () { return from; };
    if (R.isMachine(shooter)) {
      shooter.aim = Math.atan2(to.y - from.y, to.x - from.x);
      var M = ISO.mounts(shooter);
      mountFrom = function (style) { return ISO.mountFor(M, style, shooter, from); };
      from = mountFrom(spec.p);
    }
    var hits = res.hits || 1;
    var fired = false;
    function land(extra, at) {
      if (!state) return;
      if (res.hits > 0) {
        SHOTS.hit(shooter, to, hits, extra);
      } else {
        addFx({ kind: 'miss', x: to.x, y: to.y, up: to.up, dur: 320, blocking: true });
      }
      if (!fired) { fired = true; spawnDeaths(deaths); }
    }
    function finish(ms) { setTimeout(function () { if (done) done(); }, ms); }

    // the secondary goes off alongside the primary, a beat later
    if (spec.s) setTimeout(function () {
      if (state) playSecondary(spec.s, shooter, from.poolFor ? from.poolFor(spec.s) : mountFrom(spec.s), to, hits, spec.sn);
    }, 150);

    var tail = spec.s ? 320 + ((spec.sn || 1) - 1) * 260 : 0;

    finish(SHOTS.primary(spec, shooter, from, to, { hits: hits, dist: R.unitDist(shooter, target), land: land }) + tail);
  }

  // the aircraft runs the line, throwing fire out to either side
  /* A strafing run: the craft flies the length of it, guns going, and the
     ground walks up under it. It used to stand still while the fire appeared
     along the line, which read as somebody else shooting. */
  function playStrafe(u, from, to, deaths, done) {
    var span = Math.hypot(to.x - from.x, to.y - from.y);
    var dur = MOTION.strafeMs(span);
    var steps = Math.max(5, Math.round(span * 1.2) + 4);
    // the ground goes up in the colour of what hits it: xeno energy, bug acid
    var hitRGB = !u ? null : R.isXeno(u) ? XENO_BLUE : u.faction === 'bugs' ? BUG_GREEN : null;
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
          addFx({ kind: 'muzzle', x: x, y: y, rgb: hitRGB, dur: 180, blocking: true });
          /* The ground going up under it: rounds walking along the line, each
             throwing its own dirt, spread either side of the run. */
          addFx({ kind: 'impact', x: x, y: y, n: 3, rgb: hitRGB, dur: 320, blocking: true });
          for (var d2 = 0; d2 < 3; d2++) {
            addFx({
              kind: 'miss', x: x + (Math.random() - 0.5) * 2.4, y: y + (Math.random() - 0.5) * 2.4,
              rgb: hitRGB, dur: 380 + Math.random() * 220, blocking: true
            });
          }
          if (SFX) SFX.strafe(R.isXeno(u) ? 'xeno' : u.faction, R.weaponStyle(u));
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
    (deaths || []).forEach(function (d) { if (d.u) delete held[d.u.id]; });
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
  function drawFx() {
    STANDING.clear();
    if (state) state.units.forEach(function (u) {
      if (!u.alive || u.aboard || u.x < 0 || u.reserve || !R.ruleValue(u, 'Shield Generator')) return;
      STANDING.add({ kind: 'dome', x: u.x, y: u.y, r: 12, steady: true, a: 0.4, dur: 1e9 });
    });
    /* Counter-jamming, while it is doing something: its 6" marked out on the ground round a
       counter-jammer that has a friend (itself included) inside it who stands
       within 24" of an enemy's Jammers — the ground it is winning back. */
    if (state) {
      var onTable = function (u) { return u.alive && !u.aboard && !u.reserve && u.x >= 0; };
      var jammers = state.units.filter(function (e) { return onTable(e) && R.has(e, 'Jammers'); });
      if (jammers.length) state.units.forEach(function (c) {
        if (!onTable(c) || !R.projects(c) || !R.has(c, 'Counter-jamming')) return;
        var covering = state.units.some(function (f) {
          return onTable(f) && f.side === c.side && R.unitDist(c, f) <= 6 &&
            jammers.some(function (e) { return e.side !== f.side && R.unitDist(e, f) <= 24; });
        });
        if (covering) STANDING.add({ kind: 'cjam', x: c.x, y: c.y, r: 6, a: 1, dur: 1e9 });
      });
    }
    STANDING.draw(pctx);
    FX.draw(pctx);
  }

  /* ================= logging ================= */
  /* The engine has already written the line into state.log (the page's state
     is the engine's, or a snapshot of it): the event is only word that it
     happened. Adding it again kept every line twice. What is left for the page
     is to keep the log to its last 400 lines. */
  function logLine() {
    if (state && state.log && state.log.length > 400) state.log.splice(0, state.log.length - 400);
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

  // the view: view.js (installed with the modules, below)

  // the table drawn: draw.js (installed with the modules, below)

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
    var allowance = advance ? u.move : (ui.mode === 'carry-move' || ui.mode === 'carry-first') ? u.move / 2 : u.move + moveBonus(u, 'move');
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
    var drive = R.drives(u);
    var turns = drive ? (spot.turns != null ? spot.turns : (path.turns || 0)) : 0;
    var ground = spot.cost !== undefined ? spot.cost : dist;
    var spent = spot.spent !== undefined ? spot.spent : ground;
    return {
      unit: u, spot: spot, advance: advance, dist: dist, path: path,
      kind: kind, terrain: terr, ghost: ghost,
      seen: seen, shots: shots, watchers: watchers,
      allowance: allowance, ground: ground, spent: spent, turns: turns,
      reverse: drive && !!(spot.reverse || path.reverse),
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

  // what a kind of ground does, in short — for the map's tip and the unit tab's pill
  function terrainBits(tk, inside) {
    var t = R.TERRAIN[tk], bits = [];
    if (inside) bits.push('+2 Defence, and no Crossfire inside');
    if (t.cover && !inside) bits.push('+' + t.cover + ' Defence ' + (tk === 'barricade' ? 'within 2" behind it' : 'in it'));
    if (t.fp && t.hill) bits.push('+' + t.fp + ' Firepower shooting down');
    if (t.hill) bits.push('blocks sight across it');
    if (t.wire) bits.push('an extra D6" to cross');
    if (t.noCrossfire && !inside) bits.push('no Crossfire');
    if (t.blocks && !inside) bits.push('blocks line of sight');
    if (t.movePenalty) bits.push(t.movePenalty + '" off a move ' + (t.linear ? 'for each crossing' : 'into or through it — once a move'));
    if (t.shallow) bits.push('no Cumbersome Weapons');
    if (t.destructible && !inside) bits.push('can be brought down');
    if (t.wreck) bits.push('what is left of it');
    return bits;
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
    bits = bits.concat(terrainBits(tk, !!bp));
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

    // a reinforced wall is a high wall that stays up
    var rw = tk === 'wall' && state.terrain.some(function (r) { return r.kind === 'wall' && r.reinforced && R.inRect(p.x, p.y, r); });
    if (rw) bits = bits.filter(function (b) { return b !== 'can be brought down'; }).concat(['cannot be destroyed']);
    tip.innerHTML = '<b>' + (rw ? 'Reinforced wall' : t.name) + '</b><span>' + bits.join(' · ') + '</span>' +
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
    // Dig in!: a tap round the gun chooses the way it faces
    if (ui.mode === 'digface' && ui.selected) {
      var dgx = p.x - dispX(ui.selected), dgy = p.y - dispY(ui.selected);
      if (Math.hypot(dgx, dgy) > 0.4) send({ k: 'digface', dir: Math.atan2(dgy, dgx) });
      return;
    }
    // a piece being put down or moved by hand
    if (state.placeAsk && !isAI(state.placeAsk.side)) { send({ k: 'placeat', x: p.x, y: p.y }); return; }
    // Terrorist: the tap nominates the piece to mine
    if (state.minePick && !isAI(state.minePick.side)) {
      var mpk = state.minePick.pool.filter(function (i) { return R.inRect(p.x, p.y, state.terrain[i]); })[0];
      if (mpk != null) send({ k: 'mine', i: mpk });
      return;
    }
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
    // (p is the tap on the table, zoom and pan taken out; the raw canvas point is not)
    if (ui.insertion) {
      if (insertionMine()) placeInsertion(p);
      return;
    }

    var hit = unitUnder(c);

    // a demo is watched: a tap picks a unit to look at, and never acts for the AI
    if (handsOff()) {
      if (hit) watchUnit(hit); else showTerrainTip(e, p);
      return;
    }

    // the OpFor has been driving the camera: a tap on open ground gives it back
    if (cam.borrowed && !hit) {
      var reclaim = !(ui.moves.length && moveSpotUnder(c));
      if (reclaim) { returnHome(); return; }
    }

    // a demolition pick takes priority: the piece is the target, not a unit
    if (ui.terrain.length) {
      var piece = ui.terrain.filter(function (r) { return R.inRect(p.x, p.y, r); })[0];
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
    if (ui.moves.length && (ui.mode === 'move' || ui.mode === 'advance-move' || ui.mode === 'carry-move' || ui.mode === 'carry-first')) {
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
      /* The table takes all the room its box has: the box is the column under
         the header, less the action row pinned at its foot, so this is just the
         box less its padding and the hint line under the table. */
      var avail = wrap ? wrap.clientWidth - 12 : window.innerWidth - 380;
      var hintEl = wrap && wrap.querySelector('.viewhint');
      var room = wrap ? wrap.clientHeight - 10 - (hintEl ? hintEl.offsetHeight + 4 : 20)
        : Math.round(window.innerHeight - 280);
      VIEW_W = Math.max(320, Math.min(2200, Math.round(avail)));
      VIEW_H = Math.max(240, Math.min(1600, Math.round(room)));
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
    canvas.addEventListener('contextrestored', function () { restoreCanvases(true); });
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
    /* On a desktop the table's box is whatever the action row leaves it, and
       that row changes height as the phases come and go: follow the box. */
    var bwrap = document.querySelector('.board-wrap');
    if (bwrap && window.ResizeObserver) {
      var roPend = 0;
      new ResizeObserver(function () {
        if (window.innerWidth <= 1000 || roPend) return;
        roPend = requestAnimationFrame(function () {
          roPend = 0;
          if (!sizeView(false)) return;
          clampCam();
          if (state) render();
        });
      }).observe(bwrap);
    }
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
    if (el('btn-setup-back')) el('btn-setup-back').addEventListener('click', setupBack);
    // a demo force: rolled again as the same kind, or loaded and saved from a modal
    if (el('btn-demo-roll')) el('btn-demo-roll').addEventListener('click', function () {
      if (!muster.hot || muster.hot.step > 2) return;
      hotRandomise(muster.hot.step - 1, true, true);
      drawMuster();
    });
    if (el('btn-quick-clear')) el('btn-quick-clear').addEventListener('click', function () {
      if (!muster.hot || muster.hot.step > 2) return;
      muster.keys = [];
      drawMuster();
    });
    // the units to pick from, in a modal
    if (el('btn-colour-pop')) el('btn-colour-pop').addEventListener('click', function (ev) {
      ev.stopPropagation();
      colourPop(!el('colour-wrap').classList.contains('open'));
    });
    // a tap anywhere else puts it away
    document.addEventListener('click', function (ev) {
      var cw = el('colour-wrap');
      if (cw && cw.classList.contains('open') && !cw.contains(ev.target)) colourPop(false);
    });
    if (el('btn-cat-open')) el('btn-cat-open').addEventListener('click', function () { catModal(true); });
    if (el('btn-army')) el('btn-army').addEventListener('click', function () { armyModal(true); });
    if (el('btn-army-done')) el('btn-army-done').addEventListener('click', function () { armyModal(false); });
    if (el('army-modal')) el('army-modal').addEventListener('click', function (ev) {
      if (ev.target === el('army-modal')) { armyModal(false); return; }
      var a = ev.target.closest('[data-army-pick]'), t = ev.target.closest('[data-tactic-pick]');
      if (a) pickInto('sel-faction', a.getAttribute('data-army-pick'));
      else if (t) pickInto('sel-tactic', t.getAttribute('data-tactic-pick'));
      else return;
      if (SFX) SFX.click();
      drawArmyModal();
    });
    if (el('btn-cat-add2')) el('btn-cat-add2').addEventListener('click', function () { catModal(true); });
    if (el('btn-cat-done')) el('btn-cat-done').addEventListener('click', function () { catModal(false); });
    if (el('cat-back')) el('cat-back').addEventListener('click', function () { catModal(false); });
    var saves = el('forcebar-wrap');
    if (el('btn-demo-saves')) el('btn-demo-saves').addEventListener('click', function () { saves.classList.add('open'); });
    if (el('btn-demo-saves-done')) el('btn-demo-saves-done').addEventListener('click', function () { saves.classList.remove('open'); });
    if (saves) saves.addEventListener('click', function (ev) { if (ev.target === saves) saves.classList.remove('open'); });
    if (el('hot-sum')) el('hot-sum').addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-hotside]');
      if (b) hotEdit(+b.getAttribute('data-hotside'));
    });
    el('btn-start').addEventListener('click', function () {
      /* The lobby borrowed this screen to have a force built. Hand the force
         back rather than starting a battle: the one that matters is being
         arranged in the room, and it starts when both sides say so. */
      if (muster.forLobby && !(muster.hot && muster.hot.kind === 'net')) {
        var want = muster.forLobby;
        muster.forLobby = null;
        el('setup').hidden = true;
        want.done(window.PMC_MUSTER_NOW());
        return;
      }
      // every skirmish is mustered in steps now: Take the field is the next one
      if (muster.hot) hotNext();
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
    if (el('btn-obj')) el('btn-obj').addEventListener('click', openObjectives);
    if (el('obj-modal')) el('obj-modal').addEventListener('click', function (e) {
      if (e.target === el('obj-modal') || e.target.id === 'obj-done') el('obj-modal').hidden = true;
    });

    /* Multiplayer only works when this page came from a game server. A game
       opened from a file, or the published single file, has nowhere to send an
       intent and nobody to send it to, so there the card is shown greyed out
       and disabled, saying what it needs, rather than leading to a screen that
       cannot work. */
    /* Being on http is not enough: a static host (GitHub Pages, say) serves the
       page with no game server behind it. So the card stays greyed out until
       the server's own /health answers. */
    var mb = el('btn-multi'), online = !!(window.PMCLobby && window.PMCLobby.available());
    if (mb) mb.disabled = true;
    function serverUp() {
      mb.disabled = false;
      var back = window.PMCLobby.resumable && window.PMCLobby.resumable();
      if (el('menu-multi-sub')) el('menu-multi-sub').textContent = back
        ? 'Resume your game — code ' + back : 'Play somebody else over the network';
      mb.addEventListener('click', function () {
        el('setup').hidden = true;
        if (window.PMCMenu) window.PMCMenu.close();
        window.PMCLobby.open();
      });
    }
    if (mb && online && window.fetch) {
      window.fetch('/health', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (h) { if (h && h.ok === true && h.rooms != null) serverUp(); })
        .catch(function () { });
    }
    el('btn-drawer').addEventListener('click', toggleDrawer);
    el('btn-drawer-close').addEventListener('click', closeDrawer);
    el('scrim').addEventListener('click', closeDrawer);
    drawerEl().querySelectorAll('.dtab').forEach(function (b) {
      b.addEventListener('click', function () { setDrawerTab(b.getAttribute('data-tab')); if (SFX) SFX.click(); });
    });
    setDrawerTab('forces');
    if (el('btn-notes')) el('btn-notes').addEventListener('click', function () { el('notes').hidden = false; });

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
  /* A demo starts on the battlefield step with everything already rolled:
     Battle Tier III at Priority Level 2, and two random kinds of force
     with rolled builds in colours of their own. Watch the battle at once, or
     tap either force to change it first. */
  function demoBegin(kind) {
    kind = kind || 'demo';
    var tierSel = el('sel-tier'), plSel = el('sel-pl');
    if (tierSel) tierSel.value = '3';
    // a commando is always Priority Level 1 a player (p. 147): the OpFor grows with the players instead
    if (plSel) plSel.value = kind === 'solo' || kind === 'coop' ? '1' : '2';
    hotBegin(kind);                                   // force 1, rolled
    hotSaveSide();
    if (kind !== 'solo') { muster.hot.step = 2; hotLoadSide(1); hotSaveSide(); }   // force 2, rolled, in another colour
    muster.hot.step = 3; muster.hot.from3 = true;
    hotPaint(); drawMuster();
  }
  window.PMC_SKIRMISH = function (kind) {
    var solo = kind === 'solo' || kind === 'coop';
    if (solo !== !!muster.solo) setSoloMode(solo);
    el('solo-box').hidden = !solo;
    el('setup').classList.toggle('solo-mode', solo);
    el('setup-title').textContent = {
      ai: 'Muster your force', hotseat: 'Muster your force — hotseat', demo: 'Muster a force to watch',
      solo: 'Muster your commando', coop: 'Muster your commandos'
    }[kind] || 'Muster your force';
    // hotseat, co-op and demo build both forces, one step each, before the battlefield
    // a demo, and a battle against the AI, open on the battlefield with both forces rolled
    if (hotQuick(kind)) demoBegin(kind); else hotEnd();
    backLabel(el('btn-setup-back'), setupGoesHome());
    el('setup').hidden = false;
  };
  window.PMC_BATTLE_LIVE = function () {
    return !!(state && state.phase && !state.over);
  };
  /* A skirmish running in this browser can be thrown away from the menu. Not a
     campaign's battle (the campaign is waiting on its result), and not one on
     a game server (the other player is still in it). */
  function discardable() {
    return !!(state && state.phase && !state.over && net && window.PMCNet && net instanceof window.PMCNet.Local &&
      !(state.cfg && state.cfg.campaign));
  }
  window.PMC_BATTLE_DISCARDABLE = discardable;
  window.PMC_DISCARD_BATTLE = function () {
    if (!discardable()) return false;
    resetShow();
    try { net.disconnect(); } catch (e) { }
    net = null; mirror = null; Q = null; state = null;
    ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.sections = [];
    ui.preview = null; ui.hover = null; ui.insertion = null; ui.reservePick = null; ui.digHover = null;
    document.body.removeAttribute('data-battle');
    return true;
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
    // the same connection comes back here on every rejoin: its handlers go on once
    if (!transport.__board) { wireNet(transport); transport.__board = true; }
    joinBattle(transport, seat);
    transport.send('resync');
  };
  /* The lobby borrows the muster screen to build a force: it is the one place
     that knows the composition table and the unit cards. */
  window.PMC_MUSTER_FOR = function (terms, done, have, room) {
    hotEnd();
    el('setup').hidden = false;
    muster.forLobby = { terms: terms, done: done, room: room || '' };
    setSoloMode(false);
    if (terms) {
      if (el('sel-tier')) el('sel-tier').value = terms.tier;
      if (el('sel-pl')) el('sel-pl').value = terms.pl;
    }
    hotBegin('net');
    // the force already sent to the room, to change rather than start again
    if (have && have.keys && have.keys.length) {
      el('sel-faction').value = have.faction || 'pmc';
      if (el('sel-tactic')) el('sel-tactic').value = have.tactic || '';
      muster.keys = have.keys.slice();
      muster.colour = have.colour || muster.colour;
      muster.name = have.name || muster.name;
      if (el('hot-name')) el('hot-name').value = muster.name;
      drawColourPick();
    }
    hotPaint();
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
  window.__held = function () { return Object.keys(held).length; };
  window.__busy = function () { return busy(); };
  window.__busyWhy = function () { return { anims: anims.map(function (a) { return a.kind + ':' + Math.round(nowMs() - a.t0) + '/' + a.dur; }), arriving: anyArriving(), fx: FX.busy(), fxk: FX.kinds ? FX.kinds() : null, idle: idleCbs.length, loop: !!loop }; };
  window.__uiMode = function () { return ui.mode; };
  window.__uiCounts = function () { return { targets: ui.targets.length, moves: ui.moves.length, terrain: ui.terrain.length }; };
  window.__pressCancel = function () { send({ k: 'cancel' }); };
  window.__holdInsertion = function () { holdInsertion(); };
  window.__insertionSpotsNow = function () { return ui.insertion ? ui.insertion.spots : null; };
  window.__tapInsertion = function (q) { placeInsertion(q); };
  window.__sendIntent = function (it) { send(it); };
  window.__lookAt = function (x, y) { var q = ISO.toScreen(x, y); centreOn(q.x, q.y, true); render(); };
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
  window.__labelIcons = function () {
    return state ? state.units.filter(function (u) { return u.alive && u.x >= 0; }).map(function (u) {
      var r = labelIcons(u); return { code: u.code, side: u.side, star: r.star, heart: r.heart };
    }) : [];
  };
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
  // how a unit's move is drawn part way through (0-1): a burrower sinks, goes unseen and comes up
  window.__burrowSample = function (u, ks) {
    if (!burrows(u)) return null;
    var an = { unit: Object.assign({}, u), total: 6, phase: 0, lastDirt: -1,
      segs: [{ a: { x: u.x, y: u.y }, b: { x: u.x + 6, y: u.y }, start: 0, end: 6, len: 6 }] };
    return ks.map(function (k) { burrowStep(an, k); return Object.assign({}, an.unit.burrow); });
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
  /* A phone that puts the tab in the background may throw away every canvas
     it holds and hand them back blank — the table, the troops, the lot. Coming
     back, look at the table: if it has gone clear, paint everything again. */
  function canvasesLost() {
    if (!state || !state.ground || !state.ground.getContext) return false;
    try {
      var gg = state.ground.getContext('2d');
      if (gg.isContextLost && gg.isContextLost()) return true;
      var d = gg.getImageData(state.ground.width >> 1, state.ground.height >> 1, 1, 1).data;
      return d[3] === 0;                            // the ground is opaque everywhere
    } catch (e) { return false; }
  }
  function restoreCanvases(force) {
    if (!state || !pix || !(force || canvasesLost())) return;
    ISO.flush();
    if (pix.getContext) pctx = pix.getContext('2d');
    dropHaze();
    state.scene = null; state.ground = null; state.structs = null; state.structsOpen = null;
    drawBoard();
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () { if (!document.hidden) restoreCanvases(false); });
    window.addEventListener('pageshow', function () { restoreCanvases(false); });
    window.addEventListener('focus', function () { restoreCanvases(false); });
  }
  window.__restoreCanvases = restoreCanvases;
  window.__rebuildScene = function () { state.scene = null; state.ground = null; state.structs = null; drawBoard(); };
  window.__tapTerrain = function (i) {
    var r = ui.terrain[i];
    if (!r) return false;
    if (ui.mode === 'breach') doBreach(r); else doDemolish(r);
    return true;
  };
  window.__targetCodes = function () { return ui.mode + ': ' + ui.targets.map(function (t) { return t.code + '/' + t.side; }).join(', '); };
  window.__testShoot = function (a, b, res) { playShooting(a, b, res || { hits: 2 }, [], null); };
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
  window.__colours = function () { return { A: muster.colour, B: ui.foeColour || null }; };
  window.PMC_SETVIEW = function (wx, wy, z) {
    var p = ISO.toScreen(wx, wy);
    if (z) { cam.z = z; zoomLabel(); }
    cam.x = cam.tx = p.x; cam.y = cam.ty = p.y;
    clampCam(); setHome(cam.x, cam.y); drawBoard();
  };

  /* ================= the modules =================
     The parts of the board that live in files of their own, installed here —
     after everything they borrow of this closure is declared — each with the
     board it borrows from, and handing back what the rest of the game uses. */
  /* ---------- draw.js: the table drawn ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var DRAW = window.PMCDraw({
    get DPR() { return DPR; }, get VIEW_H() { return VIEW_H; }, get VIEW_W() { return VIEW_W; },
    get canvas() { return canvas; }, get ctx() { return ctx; }, get held() { return held; },
    get loop() { return loop; }, get pctx() { return pctx; }, get pix() { return pix; },
    get state() { return state; }, get drawOdds() { return drawOdds; },
    get edgedStroke() { return edgedStroke; }, get hud() { return hud; },
    get labelIcons() { return labelIcons; }, get oddsOn() { return oddsOn; },
    get propBox() { return propBox; }, get render() { return render; },
    get repaintProp() { return repaintProp; }, get roundRect() { return roundRect; },
    get sideInk() { return sideInk; }, get sideRGB() { return sideRGB; },
    get terrainMark() { return terrainMark; }, get viewRect() { return viewRect; }, activeUnits: activeUnits,
    addFx: addFx, arrivalQueued: arrivalQueued, arriving: arriving, boxesFor: boxesFor,
    clonePiece: clonePiece, curArea: curArea, dispX: dispX, dispY: dispY, drawFx: drawFx, fitGhost: fitGhost,
    insertionMine: insertionMine, isAI: isAI, liftOf: liftOf, nowMs: nowMs, onTable: onTable,
    placingSide: placingSide, shownAs: shownAs, unitById: unitById, zoneFor: zoneFor, FX: FX, H: H, ISO: ISO,
    K: K, R: R, SFX: SFX, UR: UR, W: W, cam: cam, ui: ui
  });
  var DIG_NAMES = DRAW.DIG_NAMES, buildScene = DRAW.buildScene, digFacings = DRAW.digFacings;
  var digPreview = DRAW.digPreview, drawBoard = DRAW.drawBoard, dropHaze = DRAW.dropHaze, hull = DRAW.hull;
  var paintStructures = DRAW.paintStructures, repaintTerrain = DRAW.repaintTerrain;

  /* ---------- view.js: the view ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var VIEW = window.PMCView({
    get FORCE_NOUN() { return FORCE_NOUN; }, get ID_NOUN() { return ID_NOUN; },
    get VIEW_H() { return VIEW_H; }, get VIEW_W() { return VIEW_W; }, get anims() { return anims; },
    get ctx() { return ctx; }, get muster() { return muster; }, get pctx() { return pctx; },
    get state() { return state; }, get colourPop() { return colourPop; },
    get demoRename() { return demoRename; }, get drawBar() { return drawBar; },
    get drawLog() { return drawLog; }, get drawPanel() { return drawPanel; },
    get drawStats() { return drawStats; }, get esc() { return esc; },
    get isDemoName() { return isDemoName; }, get isMadeUpName() { return isMadeUpName; },
    get musterFaction() { return musterFaction; }, bufferFromCanvas: bufferFromCanvas, busy: busy,
    curArea: curArea, deployNext: deployNext, dispX: dispX, dispY: dispY, drawBoard: drawBoard,
    hideTerrainTip: hideTerrainTip, liftOf: liftOf, myTurn: myTurn, other: other, playerSide: playerSide,
    roleOf: roleOf, scoreObjectives: scoreObjectives, sideName: sideName, sizeView: sizeView,
    soloOwnerName: soloOwnerName, whenIdle: whenIdle, ISO: ISO, K: K, R: R, SFX: SFX, ZOOMS: ZOOMS, cam: cam,
    el: el, resQueue: resQueue, show: show, ui: ui
  });
  var TERRAIN_MARK = VIEW.TERRAIN_MARK, borrowCamera = VIEW.borrowCamera, centreOn = VIEW.centreOn;
  var clampCam = VIEW.clampCam, colourLabel = VIEW.colourLabel, drawColourPick = VIEW.drawColourPick;
  var dropFollow = VIEW.dropFollow, edgedStroke = VIEW.edgedStroke, ensureVisible = VIEW.ensureVisible;
  var fitView = VIEW.fitView, focusUnit = VIEW.focusUnit, foeColour = VIEW.foeColour;
  var handsOff = VIEW.handsOff, hud = VIEW.hud, labelIcons = VIEW.labelIcons, nearestZoom = VIEW.nearestZoom;
  var openObjectives = VIEW.openObjectives, panBy = VIEW.panBy, propBox = VIEW.propBox, render = VIEW.render;
  var repaintProp = VIEW.repaintProp, returnHome = VIEW.returnHome, scheduleReturn = VIEW.scheduleReturn;
  var setHome = VIEW.setHome, setZoom = VIEW.setZoom, sideInk = VIEW.sideInk, sideRGB = VIEW.sideRGB;
  var slack = VIEW.slack, terrainMark = VIEW.terrainMark, viewRect = VIEW.viewRect, zoomAt = VIEW.zoomAt;
  var zoomLabel = VIEW.zoomLabel;

  /* ---------- panels.js: the panels ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var PANELS = window.PMCPanels({
    get Q() { return Q; }, get ctx() { return ctx; }, get state() { return state; },
    actionState: actionState, autoDeployMine: autoDeployMine, boardableFor: boardableFor, byId: byId,
    cancelPreview: cancelPreview, carriersFor: carriersFor, chooseAction: chooseAction,
    cmdOfferCard: cmdOfferCard, commitMove: commitMove, curArea: curArea, deployNext: deployNext,
    deployRoster: deployRoster, deployWhere: deployWhere, deploymentDone: deploymentDone,
    digFacings: digFacings, digPreview: digPreview, doAssault: doAssault, doBreach: doBreach,
    doDemolish: doDemolish, doDesignate: doDesignate, doEnter: doEnter, doHack: doHack, doShoot: doShoot,
    doSteady: doSteady, doSupport: doSupport, drawBoard: drawBoard, emptyPlatforms: emptyPlatforms,
    holdArrival: holdArrival, holdInsertion: holdInsertion, hud: hud, inReserve: inReserve,
    insertionCard: insertionCard, isAI: isAI, kyfCard: kyfCard, liftOf: liftOf, loadBefore: loadBefore,
    martyrCard: martyrCard, mineCard: mineCard, movePreviewCard: movePreviewCard, mySide: mySide,
    openMenu: openMenu, pickToDeploy: pickToDeploy, placeCard: placeCard, placingSide: placingSide,
    playerSide: playerSide, relocPick: relocPick, render: render, roleOf: roleOf, roleSentence: roleSentence,
    select: select, send: send, shownAs: shownAs, sideName: sideName, soloOwnerName: soloOwnerName,
    specialsFor: specialsFor, splitFor: splitFor, startBattle: startBattle, swapCard: swapCard,
    terrainAct: terrainAct, terrainBits: terrainBits, terrainCard: terrainCard, terrainMark: terrainMark,
    unloadBefore: unloadBefore, C: C, DIG_NAMES: DIG_NAMES, ICONS: ICONS, ISO: ISO, PIECE_NOUN: PIECE_NOUN,
    R: R, SFX: SFX, SPECIAL_SLOTS: SPECIAL_SLOTS, STANDARD: STANDARD, TERRAIN_MARK: TERRAIN_MARK, UR: UR,
    el: el, ui: ui
  });
  var closeDrawer = PANELS.closeDrawer, drawBar = PANELS.drawBar, drawLog = PANELS.drawLog;
  var drawOdds = PANELS.drawOdds, drawPanel = PANELS.drawPanel, drawStats = PANELS.drawStats;
  var drawerEl = PANELS.drawerEl, esc = PANELS.esc, oddsOn = PANELS.oddsOn;
  var revealConsole = PANELS.revealConsole, roundRect = PANELS.roundRect, setDrawerTab = PANELS.setDrawerTab;
  var setHint = PANELS.setHint, tip = PANELS.tip, toggleDrawer = PANELS.toggleDrawer;

  /* ================= mustering a company =================
     The muster screen, the saved skirmish forces and the two-force skirmish's
     steps are in muster.js; it borrows these of the game, and the game uses
     what it hands back. */
  var MUSTER = window.PMCMuster({
    ISO: ISO, R: R, SC: SC, el: el, esc: esc, tip: tip, cam: cam,
    begin: begin, openMenu: openMenu, colourLabel: colourLabel, drawColourPick: drawColourPick, foeColour: foeColour
  });
  var FORCE_NOUN = MUSTER.FORCE_NOUN, ID_NOUN = MUSTER.ID_NOUN, applyForce = MUSTER.applyForce;
  var armyModal = MUSTER.armyModal, backLabel = MUSTER.backLabel, catModal = MUSTER.catModal;
  var colourPop = MUSTER.colourPop, currentForce = MUSTER.currentForce, demoRename = MUSTER.demoRename;
  var drawArmyModal = MUSTER.drawArmyModal, drawForceList = MUSTER.drawForceList;
  var drawMuster = MUSTER.drawMuster, escHtml = MUSTER.escHtml, hotBegin = MUSTER.hotBegin;
  var hotEdit = MUSTER.hotEdit, hotEnd = MUSTER.hotEnd, hotLoadSide = MUSTER.hotLoadSide;
  var hotNext = MUSTER.hotNext, hotPaint = MUSTER.hotPaint, hotQuick = MUSTER.hotQuick;
  var hotRandomise = MUSTER.hotRandomise, hotSaveSide = MUSTER.hotSaveSide, isDemoName = MUSTER.isDemoName;
  var isMadeUpName = MUSTER.isMadeUpName, loadForces = MUSTER.loadForces, muster = MUSTER.muster;
  var musterFaction = MUSTER.musterFaction, musterTactic = MUSTER.musterTactic, pickInto = MUSTER.pickInto;
  var saveCurrentForce = MUSTER.saveCurrentForce, setSoloMode = MUSTER.setSoloMode;
  var setupBack = MUSTER.setupBack, setupGoesHome = MUSTER.setupGoesHome;
  var wireMuster = MUSTER.wireMuster;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
