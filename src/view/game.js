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

  // the terrain set-up (pp. 46-47): terrainset.js (installed with the modules, below)
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
    anims.splice.apply(anims, [0, anims.length].concat(alive));   // the same array: modules hold it

    FX.prune();

    drawBoard();

    if (!busy() && idleCbs.length) {
      var cbs = idleCbs.splice(0);                  // (the same array: callbacks added meanwhile wait)
      cbs.forEach(function (cb) { cb(); });
    }
    if (anims.length || fx.length || anyArriving()) loop = requestAnimationFrame(tick);
    else { loop = null; drawBoard(); show.pump(); }
  }

  // moves and shots played on the board: play.js (installed with the modules, below)
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

  // input: input.js (installed with the modules, below)
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

  // the ways in: hooks.js (installed with the modules, below)
  /* ================= the modules =================
     The parts of the board that live in files of their own, installed here —
     after everything they borrow of this closure is declared — each with the
     board it borrows from, and handing back what the rest of the game uses. */
  /* ---------- hooks.js: the ways in ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  window.PMCHooks({
    get FIRE() { return FIRE; }, get STANDARD() { return STANDARD; }, get VIEW_H() { return VIEW_H; },
    get VIEW_W() { return VIEW_W; }, get burrows() { return burrows; }, get gaitOf() { return gaitOf; },
    get held() { return held; }, get loop() { return loop; }, get muster() { return muster; },
    get seats() { return seats; }, get state() { return state; },
    get streamLength() { return streamLength; }, get addFx() { return addFx; },
    get anyArriving() { return anyArriving; }, get applyForce() { return applyForce; },
    get arriving() { return arriving; }, get bufferFromCanvas() { return bufferFromCanvas; },
    get burrowStep() { return burrowStep; }, get cancelPreview() { return cancelPreview; },
    get canvasFromWorld() { return canvasFromWorld; }, get centreOn() { return centreOn; },
    get clampCam() { return clampCam; }, get commitMove() { return commitMove; },
    get currentForce() { return currentForce; }, get drawBoard() { return drawBoard; },
    get drawColourPick() { return drawColourPick; }, get drawForceList() { return drawForceList; },
    get drawMuster() { return drawMuster; }, get hotBegin() { return hotBegin; },
    get hotEnd() { return hotEnd; }, get hotPaint() { return hotPaint; },
    get labelIcons() { return labelIcons; }, get landUnit() { return landUnit; },
    get loadForces() { return loadForces; }, get musterFaction() { return musterFaction; },
    get musterTactic() { return musterTactic; }, get onBoardTap() { return onBoardTap; },
    get pace() { return pace; }, get playShooting() { return playShooting; },
    get previewMove() { return previewMove; }, get render() { return render; },
    get saveCurrentForce() { return saveCurrentForce; }, get setHome() { return setHome; },
    get setMTab() { return setMTab; }, get setSoloMode() { return setSoloMode; },
    get snapReach() { return snapReach; }, get viewRect() { return viewRect; },
    get zoomLabel() { return zoomLabel; }, actionState: actionState, arrivalLegal: arrivalLegal,
    arrivalSpots: arrivalSpots, autoDeployMine: autoDeployMine, begin: begin, busy: busy, byId: byId,
    chooseAction: chooseAction, curArea: curArea, deployNext: deployNext, deployOK: deployOK,
    deploymentDone: deploymentDone, doAssault: doAssault, doBreach: doBreach, doDemolish: doDemolish,
    doDesignate: doDesignate, doDisembark: doDisembark, doEmbark: doEmbark, doHack: doHack,
    doMarkMove: doMarkMove, doMove: doMove, doShoot: doShoot, doSteady: doSteady, doStrafe: doStrafe,
    doSupport: doSupport, doWave: doWave, eligible: eligible, forcedCharge: forcedCharge,
    holdInsertion: holdInsertion, insertionLegal: insertionLegal, insertionSpots: insertionSpots,
    joinBattle: joinBattle, liftOf: liftOf, markReach: markReach, mySide: mySide, nowMs: nowMs,
    placeInsertion: placeInsertion, placingSide: placingSide, restoreCanvases: restoreCanvases,
    select: select, send: send, specialsFor: specialsFor, startBattle: startBattle, terrainAct: terrainAct,
    wireNet: wireNet, FX: FX, H: H, ISO: ISO, R: R, W: W, anims: anims, cam: cam, el: el, fx: fx,
    idleCbs: idleCbs, resQueue: resQueue, show: show, ui: ui
  });

  /* ---------- play.js: moves and shots played on the board ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var PLAY = window.PMCPlay({
    get held() { return held; }, get pctx() { return pctx; }, get state() { return state; },
    get handsOff() { return handsOff; }, get render() { return render; }, dispX: dispX, dispY: dispY,
    nowMs: nowMs, onTable: onTable, startLoop: startLoop, FX: FX, ISO: ISO, R: R, SFX: SFX,
    STANDING: STANDING, anims: anims
  });
  var FIRE = PLAY.FIRE, addFx = PLAY.addFx, animateMove = PLAY.animateMove, burrowStep = PLAY.burrowStep;
  var burrows = PLAY.burrows, drawFx = PLAY.drawFx, gaitOf = PLAY.gaitOf, pace = PLAY.pace;
  var playAssault = PLAY.playAssault, playShooting = PLAY.playShooting, playStrafe = PLAY.playStrafe;
  var streamLength = PLAY.streamLength;

  /* ---------- terrainset.js: the terrain set-up (pp. 46-47) ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var TERRAINSET = window.PMCTerrainSet({
    get seats() { return seats; }, get state() { return state; }, get buildScene() { return buildScene; },
    get clampCam() { return clampCam; }, get drawBoard() { return drawBoard; }, get esc() { return esc; },
    get render() { return render; }, curArea: curArea, isAI: isAI, pieceNoun: pieceNoun,
    placedSummary: placedSummary, placingSide: placingSide, sideName: sideName, specRange: specRange,
    zoneCentre: zoneCentre, H: H, ISO: ISO, K: K, R: R, W: W, cam: cam, ui: ui
  });
  var PIECE_NOUN = TERRAINSET.PIECE_NOUN, lookAtDeployment = TERRAINSET.lookAtDeployment;
  var queueBake = TERRAINSET.queueBake, terrainCard = TERRAINSET.terrainCard;

  /* ---------- input.js: input ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var INPUT = window.PMCInput({
    get STANDARD() { return STANDARD; }, get VIEW_H() { return VIEW_H; }, get VIEW_W() { return VIEW_W; },
    get canvas() { return canvas; }, get seats() { return seats; }, get state() { return state; },
    get closeDrawer() { return closeDrawer; }, get closeRes() { return closeRes; },
    get drawBoard() { return drawBoard; }, get drawerEl() { return drawerEl; }, get esc() { return esc; },
    get fitView() { return fitView; }, get handsOff() { return handsOff; },
    get insertionMine() { return insertionMine; }, get panBy() { return panBy; },
    get render() { return render; }, get returnHome() { return returnHome; },
    get setHint() { return setHint; }, get setZoom() { return setZoom; }, get tip() { return tip; },
    get viewRect() { return viewRect; }, chooseAction: chooseAction, curArea: curArea,
    deployNext: deployNext, deployOK: deployOK, deployRoster: deployRoster, dispX: dispX, dispY: dispY,
    doAssault: doAssault, doBreach: doBreach, doDemolish: doDemolish, doDesignate: doDesignate,
    doDisembark: doDisembark, doEmbark: doEmbark, doEnter: doEnter, doExitBld: doExitBld, doHack: doHack,
    doMarkMove: doMarkMove, doMove: doMove, doShoot: doShoot, doSteady: doSteady, doStrafe: doStrafe,
    doSupport: doSupport, doTeleport: doTeleport, doWave: doWave, finishTeleport: finishTeleport,
    garrisonAt: garrisonAt, garrisonable: garrisonable, isAI: isAI, liftOf: liftOf,
    lookAtDeployment: lookAtDeployment, moveBonus: moveBonus, nearestDeploySpot: nearestDeploySpot,
    onTable: onTable, pickToDeploy: pickToDeploy, placeInsertion: placeInsertion, relocTap: relocTap,
    select: select, send: send, terrainAct: terrainAct, terrainTap: terrainTap, watchUnit: watchUnit,
    ISO: ISO, R: R, SFX: SFX, UR: UR, cam: cam, el: el, ui: ui
  });
  var bufferFromCanvas = INPUT.bufferFromCanvas, cancelPreview = INPUT.cancelPreview;
  var canvasFromWorld = INPUT.canvasFromWorld, canvasPoint = INPUT.canvasPoint;
  var commitMove = INPUT.commitMove, hideTerrainTip = INPUT.hideTerrainTip;
  var movePreviewCard = INPUT.movePreviewCard, onBoardMove = INPUT.onBoardMove;
  var onBoardTap = INPUT.onBoardTap, onKey = INPUT.onKey, previewMove = INPUT.previewMove;
  var terrainBits = INPUT.terrainBits;

  /* ---------- arrive.js: arrivals ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ARRIVE = window.PMCArrive({
    get Q() { return Q; }, get seats() { return seats; }, get state() { return state; },
    get watching() { return watching; }, get esc() { return esc; }, get escHtml() { return escHtml; },
    get focusUnit() { return focusUnit; }, get render() { return render; }, addFx: addFx,
    animateMove: animateMove, arrivalWhere: arrivalWhere, byId: byId, nowMs: nowMs, sfName: sfName,
    sideName: sideName, soloOwnerName: soloOwnerName, H: H, ISO: ISO, R: R, SFX: SFX, W: W, cam: cam, ui: ui
  });
  var anyArriving = ARRIVE.anyArriving, arriving = ARRIVE.arriving;
  var boardAnim = ARRIVE.boardAnim, cmdOfferCard = ARRIVE.cmdOfferCard, insertionCard = ARRIVE.insertionCard;
  var insertionMine = ARRIVE.insertionMine, kyfCard = ARRIVE.kyfCard, landUnit = ARRIVE.landUnit;
  var martyrCard = ARRIVE.martyrCard, mineCard = ARRIVE.mineCard, placeCard = ARRIVE.placeCard;
  var snapReach = ARRIVE.snapReach, stepOff = ARRIVE.stepOff, swapCard = ARRIVE.swapCard;
  var walkOn = ARRIVE.walkOn;

  /* ---------- actions.js: the actions on offer, the results feed and the phone's tabs ----------
     The board it borrows from: getters for what changes as the game runs,
     and the functions and fixed values it uses. */
  var ACTIONS = window.PMCActions({
    get state() { return state; }, get render() { return render; },
    get scheduleReturn() { return scheduleReturn; }, isAI: isAI, SFX: SFX, el: el, resQueue: resQueue,
    show: show, ui: ui
  });
  var ICONS = ACTIONS.ICONS, SPECIAL_SLOTS = ACTIONS.SPECIAL_SLOTS, STANDARD = ACTIONS.STANDARD;
  var closeRes = ACTIONS.closeRes, feedHosts = ACTIONS.feedHosts, pushRes = ACTIONS.pushRes;
  var setMTab = ACTIONS.setMTab;

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
