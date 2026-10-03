/* PMC 2670 — Firefight : the hooks the tests drive the board through (__*, and
   PMC_VIEW, PMC_LIFT and PMC_SETVIEW for the camera). Loaded by index.html as it
   runs from the repository, where the tests play it; the published builds
   (scripts/bundle.js, scripts/build.js) leave this file out, so a player's
   page has none of them.

   Installed by game.js, when it is there, with the same board (B) as hooks.js. */
(function (root) {
  'use strict';
  root.PMCTestHooks = function (B) {
    var actionState = B.actionState, arrivalLegal = B.arrivalLegal, arrivalSpots = B.arrivalSpots;
    var autoDeployMine = B.autoDeployMine, begin = B.begin, busy = B.busy, byId = B.byId;
    var chooseAction = B.chooseAction, curArea = B.curArea, deployNext = B.deployNext, deployOK = B.deployOK;
    var deploymentDone = B.deploymentDone, doAssault = B.doAssault, doBreach = B.doBreach;
    var doDemolish = B.doDemolish, doDesignate = B.doDesignate, doDisembark = B.doDisembark, doTeleportSpot = B.doTeleportSpot;
    var doEmbark = B.doEmbark, doHack = B.doHack, doMarkMove = B.doMarkMove, doMove = B.doMove;
    var doShoot = B.doShoot, doSteady = B.doSteady, doStrafe = B.doStrafe, doSupport = B.doSupport;
    var doWave = B.doWave, eligible = B.eligible, forcedCharge = B.forcedCharge;
    var holdInsertion = B.holdInsertion, insertionLegal = B.insertionLegal;
    var insertionSpots = B.insertionSpots, joinBattle = B.joinBattle, liftOf = B.liftOf;
    var markReach = B.markReach, mySide = B.mySide, nowMs = B.nowMs, placeInsertion = B.placeInsertion;
    var placingSide = B.placingSide, restoreCanvases = B.restoreCanvases, select = B.select, send = B.send;
    var specialsFor = B.specialsFor, startBattle = B.startBattle, terrainAct = B.terrainAct;
    var wireNet = B.wireNet, FX = B.FX, H = B.H, ISO = B.ISO, R = B.R, W = B.W, anims = B.anims, cam = B.cam;
    var el = B.el, fx = B.fx, idleCbs = B.idleCbs, resQueue = B.resQueue, show = B.show, ui = B.ui;
    // from modules installed after this one: looked up when called
    function addFx() { return B.addFx.apply(this, arguments); }
    function anyArriving() { return B.anyArriving.apply(this, arguments); }
    function applyForce() { return B.applyForce.apply(this, arguments); }
    function arriving() { return B.arriving.apply(this, arguments); }
    function bufferFromCanvas() { return B.bufferFromCanvas.apply(this, arguments); }
    function burrowStep() { return B.burrowStep.apply(this, arguments); }
    function cancelPreview() { return B.cancelPreview.apply(this, arguments); }
    function canvasFromWorld() { return B.canvasFromWorld.apply(this, arguments); }
    function centreOn() { return B.centreOn.apply(this, arguments); }
    function clampCam() { return B.clampCam.apply(this, arguments); }
    function commitMove() { return B.commitMove.apply(this, arguments); }
    function currentForce() { return B.currentForce.apply(this, arguments); }
    function drawBoard() { return B.drawBoard.apply(this, arguments); }
    function drawColourPick() { return B.drawColourPick.apply(this, arguments); }
    function drawForceList() { return B.drawForceList.apply(this, arguments); }
    function drawMuster() { return B.drawMuster.apply(this, arguments); }
    function hotBegin() { return B.hotBegin.apply(this, arguments); }
    function hotEnd() { return B.hotEnd.apply(this, arguments); }
    function hotPaint() { return B.hotPaint.apply(this, arguments); }
    function labelIcons() { return B.labelIcons.apply(this, arguments); }
    function landUnit() { return B.landUnit.apply(this, arguments); }
    function loadForces() { return B.loadForces.apply(this, arguments); }
    function musterFaction() { return B.musterFaction.apply(this, arguments); }
    function musterTactic() { return B.musterTactic.apply(this, arguments); }
    function onBoardTap() { return B.onBoardTap.apply(this, arguments); }
    function pace() { return B.pace.apply(this, arguments); }
    function playShooting() { return B.playShooting.apply(this, arguments); }
    function previewMove() { return B.previewMove.apply(this, arguments); }
    function render() { return B.render.apply(this, arguments); }
    function saveCurrentForce() { return B.saveCurrentForce.apply(this, arguments); }
    function setHome() { return B.setHome.apply(this, arguments); }
    function setMTab() { return B.setMTab.apply(this, arguments); }
    function setSoloMode() { return B.setSoloMode.apply(this, arguments); }
    function snapReach() { return B.snapReach.apply(this, arguments); }
    function viewRect() { return B.viewRect.apply(this, arguments); }
    function zoomLabel() { return B.zoomLabel.apply(this, arguments); }

    window.__begin = function (cfg, opts) { return begin(cfg, opts); };
    window.__startBattle = function () { startBattle(); };
    /* The deployment card's Begin the battle, for a harness to press: pressing
       it goes through the question about empty transports, as a player
       answering "Begin" would. Null while it is not on offer. */
    window.__beginButton = function () {
      // a vehicle's facing still asked about: beginning keeps the way offered (the engine settles it)
      if (B.state && B.state.faceAsk && B.state.phase === 'deploy' && deploymentDone()) return { click: function () { startBattle(); } };
      var b = document.querySelector('.cmodal button[data-act="start"]') || document.querySelector('button[data-act="start"], button[data-act="startask"]');
      if (!b) return null;
      return { click: function () { if (b.getAttribute('data-act') === 'startask') { ui.startAsk = false; startBattle(); } else b.click(); } };
    };
    window.__deployDone = function () { return deploymentDone(); };
    /* Driving the board the way a player does: the units that may act, the
       actions on offer for one of them, and whatever the chosen action is
       waiting to be pointed at. */
    window.__eligibleUnits = function () { return eligible(B.state.activeSide); };
    window.__actionIds = function (u) {
      return B.STANDARD.map(function (a) { return a.id; })
        .filter(function (id) { return id !== 'regroup' && id !== 'skip'; })
        .concat(specialsFor(u).map(function (a) { return a.id; }))
        .concat(['regroup', 'skip']);
    };
    window.__commitWhatever = function () {
      if (ui.targets.length) { doShoot(ui.targets[0]); return true; }
      if (ui.terrain.length) { doDemolish(ui.terrain[0]); return true; }
      if (ui.moves.length) {
        var c = ui.moves[ui.moves.length - 1];
        if (ui.mode === 'wave') doWave(ui.selected, c);
        else if (ui.mode === 'disembark') doDisembark(c);
        else if (ui.mode === 'teleport-spot') doTeleportSpot(c);
        else if (ui.mode === 'strafe') doStrafe(c);
        else if (ui.mode === 'designate') doMarkMove(c);
        else doMove(c);
        return true;
      }
      return false;
    };
    window.__showQueue = function () { return show.queue.length; };
    window.__held = function () { return Object.keys(B.held).length; };
    // a unit whose arrival is queued but not yet drawn (the table leaves it off until then)
    window.__arrivalQueued = function (id) { var u = byId(id); return !!(u && B.arrivalQueued(u)); };
    // a unit's suppression and models as the table draws them: what is held back of it, else the rules' own
    // the Suppression a unit is drawn with this instant (it fills as an attack lands)
    window.__shownSp = function (id) { var u = byId(id); return u ? B.shownAs(u).sp : null; };
    // the Morale its bar's bands are drawn to this instant: its men fall as the rounds land
    window.__shownMorale = function (id) { var u = byId(id); return u ? R.currentMorale(B.shownAs(u)) : null; };
    window.__shownAs = function (id) { var u = byId(id), h = u && (B.held[id] || u); return h ? h.sp + ' SP, ' + h.models + ' models' : null; };
    window.__busy = function () { return busy(); };
    window.__busyWhy = function () { return { anims: anims.map(function (a) { return a.kind + ':' + Math.round(nowMs() - a.t0) + '/' + a.dur; }), arriving: anyArriving(), fx: FX.busy(), fxk: FX.kinds ? FX.kinds() : null, idle: idleCbs.length, loop: !!B.loop }; };
    window.__uiCounts = function () { return { targets: ui.targets.length, moves: ui.moves.length, terrain: ui.terrain.length }; };
    window.__pressCancel = function () { send({ k: 'cancel' }); };
    window.__holdInsertion = function () { holdInsertion(); };
    window.__insertionSpotsNow = function () { return ui.insertion ? ui.insertion.spots : null; };
    window.__tapInsertion = function (q) { placeInsertion(q); };
    window.__sendIntent = function (it) { send(it); };
    window.__lookAt = function (x, y) { var q = ISO.toScreen(x, y); centreOn(q.x, q.y, true); render(); };
    // the part of the table on screen, in table pixels: { sx, sy, sw, sh }
    window.__viewRect = function () { return viewRect(); };
    window.__seats = function () { return B.seats.slice(); };
    // the dead lying on the table, by the unit they fell from
    window.__bodies = function () { var o = {}; (B.vc.remains || []).forEach(function (r) { if (r.kind === 'body' && !r.piece) o[r.of || '?'] = (o[r.of || '?'] || 0) + 1; }); return o; };
    window.__mySide = function () { return mySide(); };
    window.__placingSide = function () { return placingSide(); };

    /* Test hooks: where a canvas pixel lands on the table, and whether the side
       still placing units may deploy there. */
    window.__toWorldFromCanvasPx = function (px, py) {
      var b = bufferFromCanvas({ x: px, y: py });
      return ISO.toWorld(b.x, b.y);
    };
    // the test harness's way through deployment: the scenario's own reserves, then everyone down
    window.__autoDeployBoth = function () {
      // the briefing read and put away, as a player would before deploying
      if (el('obj-modal')) el('obj-modal').hidden = true;
      // a Hostile takeover defender's position first: nothing deploys until it is dug in
      var pa = B.state && B.state.placeAsk;
      if (pa && pa.kind === 'fort') send({ k: 'placeauto' });
      // each side at this screen sorts its own reserves (where nobody is placing, it has to say which side)
      if (B.seats.length > 1) B.seats.forEach(function (s) { send({ k: 'autosplit', side: s }); }); else send({ k: 'autosplit' });
      // each side in its turn to place (the button places only the side whose turn it is), every hull keeping the way it was offered
      for (var r = 0; r < 4; r++) {
        autoDeployMine();
        for (var n = 0; n < 12 && B.state && B.state.faceAsk; n++) send({ k: 'vfaceall' });
        if (!B.state || B.state.phase !== 'deploy') break;
        // nobody left to place: the sides that enter in turn 1 are named, each at this screen
        if (!placingSide()) { autoDeployMine(); for (var m = 0; m < 12 && B.state && B.state.faceAsk; m++) send({ k: 'vfaceall' }); break; }
      }
    };
    // a rebel force's tactic, asked before the terrain (p. 95): none, for every side asked here
    window.__noTactics = function () {
      for (var n = 0; n < 4 && B.state && B.state.tacticAsk; n++) {
        var ta = B.state.tacticAsk;
        send(ta.wave ? { k: 'wavedone' } : { k: 'tactic', tactic: null });
      }
    };
    window.__deployOK = function (x, y, side) {
      side = side || placingSide();
      return !!side && deployOK(side, x, y);
    };
    window.__report = function () { return B.state && B.state.report; };
    window.__labelIcons = function () {
      return B.state ? B.state.units.filter(function (u) { return u.alive && u.x >= 0; }).map(function (u) {
        var r = labelIcons(u); return { code: u.code, side: u.side, star: r.star, heart: r.heart };
      }) : [];
    };
    Object.defineProperty(window, '__moves', { get: function () { return ui.moves; } });
    window.__clearSel = function () { ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; render(); };
    window.__fxdebug = function () { return { anims: anims.length, fx: fx.length, tracers: fx.filter(function (f) { return f.kind === 'tracer'; }).length }; };
    window.PMC_VIEW = function () { var v = viewRect(); v.W = B.VIEW_W; v.H = B.VIEW_H; return v; };
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
    // `orbit`: as an Invasion's attacker comes down
    window.__landUnit = function (u, orbit) { landUnit(u, orbit); };
    window.__setMTab = function (which) { setMTab(which); };
    // saved skirmish forces, for the harness
    window.__forces = {
      list: function () { return loadForces(); },
      current: function (n) { return currentForce(n || 'test'); },
      apply: function (f) { return applyForce(f); },
      save: function () { return saveCurrentForce(); },
      note: function () { var n = el('force-note'); return n ? n.textContent : ''; },
      muster: function () { return B.muster.keys.slice(); },
      clear: function () { try { localStorage.removeItem('pmc-forces'); } catch (e) { } drawForceList(); }
    };
    window.__mTab = function () {
      var c = document.querySelector('.console');
      return c ? c.getAttribute('data-mtab') : null;
    };
    /* The gait a unit is drawn with, and a sampling of it across a move: the
       harness uses this to check that feet and body stay in step. */
    window.__gait = function (u) { return B.gaitOf(u); };
    window.__pacing = function (u, inches, samples) {
      var g2 = B.gaitOf(u);
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
      if (!B.burrows(u)) return null;
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
          if (R.TERRAIN[R.terrainAt(B.state, x, y)].impassable) continue;
          if (R.unitNear(B.state, x, y, u, 1)) continue;
          got.push({ x: x, y: y });
        }
      }
      return got[Math.min(got.length - 1, n || 0)] || null;
    };
    // a board tap at a table point, bypassing the pixel maths
    // a table point on the board's own picture, where the camera would centre on it
    window.__toScreen = function (x, y) { var q = ISO.toScreen(x, y); return { x: q.x, y: q.y - ISO.ELEV }; };
    window.__boardTapAt = function (x, y) {
      var s = ISO.toScreen(x, y), v = viewRect();
      onBoardTap({
        clientX: 0, clientY: 0,
        __pt: { x: (s.x - v.sx) * v.z + v.dx, y: (s.y - v.sy) * v.z + v.dy }
      });
    };
    window.__tset = function () {
      if (!B.state || !B.state.tset) return null;
      var a = curArea(), ts = B.state.tset;
      return {
        phase: B.state.phase, i: ts.i, starter: ts.starter, edges: B.state.edges || null,
        sides: ts.areas.map(function (x) { return x.side; }),
        area: a ? { name: a.name, side: a.side, x: a.x, y: a.y, w: a.w, h: a.h, alt: a.alt, spec: a.spec, count: a.count.slice(), alts: a.row.alts.length, roll: a.roll } : null,
        ghost: ts.ghost ? { kind: ts.ghost.kind, w: ts.ghost.w, h: ts.ghost.h } : null,
        placed: a ? a.placed.length : 0
      };
    };
    window.__terrainAct = function (act, arg) { terrainAct(act, arg); };
    // the sight as last drawn (the eye button): how many eyes, how far each sees, how many enemies ringed
    window.__tribeSight = function () {
      if (!ui.sight) return null;
      return { eyes: ui.sight.eyes.length, seen: ui.sight.seen.length, reach: ui.sight.eyes.map(function (o) { return R.sightRange(o); }) };
    };
    // a unit picked to look at only, kept on this screen (as a pick out of turn is)
    window.__inspect = function (u) { if (!u) return false; ui.inspect = true; ui.watch = u.id; ui.selected = u; ui.mode = 'idle'; ui.targets = []; ui.moves = []; return true; };
    window.__uiMode = function () { return { mode: ui.mode, sections: (ui.sections || []).length, sel: ui.selected ? ui.selected.id : null, moves: ui.moves.length }; };
    window.__resOpen = function () { return ui.resOpen ? (ui.currentRes ? ui.currentRes.kind + ':' + ui.currentRes.title : 'open') + ' q' + resQueue.length : false; };
    window.__insertionLegal = function (p) { return insertionLegal(p) && !R.unitNear(B.state, p.x, p.y, ui.insertion ? ui.insertion.unit : null, 1); };
    window.__dropHere = function (p) { placeInsertion(p); };
    window.__terrainPicks = function () { return ui.mode + ': ' + ui.terrain.map(function (r) { return r.kind; }).join(', '); };
    window.__terrainList = function () { return ui.terrain.map(function (r) { return { kind: r.kind, x: r.x, y: r.y }; }); };
    window.__tapMove = function (spot) { if (ui.mode === 'disembark') doDisembark(spot); else if (ui.mode === 'teleport-spot') doTeleportSpot(spot); else previewMove(spot); };
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
    window.__restoreCanvases = restoreCanvases;
    /* What the performance harness (test/perf/board.js) times and weighs: a
       run of frames, a structures repaint, a bake from nothing, and the pixels
       the view is holding in canvases. */
    window.__perf = {
      frames: function (n) {
        var t0 = performance.now();
        for (var i = 0; i < n; i++) B.drawBoard();
        return (performance.now() - t0) / n;
      },
      paint: function () { var t0 = performance.now(); B.paintStructures(); return performance.now() - t0; },
      bake: function () {
        var c = B.vc; c.scene = null; c.ground = null; c.structs = null; c.opened = null; c.baking = false;
        B.drawBoard();                                  // starts the bake (it runs off this frame)
        return new Promise(function (res) {
          var t0 = performance.now();
          (function wait() { if (B.vc.scene) res(performance.now() - t0); else setTimeout(wait, 5); })();
        });
      },
      canvases: function () {
        var c = B.vc, out = {};
        ['ground', 'structs'].forEach(function (k) { if (c[k] && c[k].width) out[k] = c[k].width * c[k].height * 4; });
        if (c.opened) out.opened = c.opened.reduce(function (a, o) { return a + o.cv.width * o.cv.height * 4; }, 0);
        var px = document.getElementById('board');
        if (B.pix && B.pix.width) out.pix = B.pix.width * B.pix.height * 4;
        if (px) out.board = px.width * px.height * 4;
        return out;
      }
    };
    // the view's own caches of the table (the baked plates, the bodies): not the battle's
    window.__vc = function () { return B.vc; };
    window.__rebuildScene = function () { var c = B.vc; c.scene = null; c.ground = null; c.structs = null; c.opened = null; drawBoard(); };
    window.__tapTerrain = function (i) {
      var r = ui.terrain[i];
      if (!r) return false;
      if (ui.mode === 'breach') doBreach(r); else doDemolish(r);
      return true;
    };
    window.__targetCodes = function () { return ui.mode + ': ' + ui.targets.map(function (t) { return t.code + '/' + t.side; }).join(', '); };
    window.__testShoot = function (a, b, res) { playShooting(a, b, res || { hits: 2 }, [], null); };
    window.__shootAt = function (id) { doShoot(byId(id)); };
    // where a unit is drawn this moment, which a replay may hold back from where the rules have it
    // where a squad's men are drawn when it lines a wall or a trench (table inches), or null
    window.__lineUp = function (id, x, y) { var u = byId(id); return u ? B.lineUp(u, x == null ? u.x : x, y == null ? u.y : y) : null; };
    window.__drawnAt = function (id) { var u = byId(id); return u ? { x: u.ax == null ? u.x : u.ax, y: u.ay == null ? u.y : u.ay, rx: u.x, ry: u.y } : null; };
    // the effects that stand on the table while a unit is there (a Shield Generator's dome...), and where
    window.__standing = function () { return B.STANDING.list.map(function (f) { return { kind: f.kind, x: f.x, y: f.y }; }); };
    window.__fxkinds = function () { return fx.map(function (f) { return f.kind; }); };
    /* What the effects layer was told, not just what kind it was: the harness uses
       this to check that a shot to or from a flier leaves the airframe. */
    window.__fxlive = function () {
      return fx.map(function (f) {
        return {
          kind: f.kind,
          // a ghost's unit: what fades into the ground where a unit was wiped out
          unit: f.unit ? { key: f.unit.key, art: f.unit.art, side: f.unit.side } : null,
          // how high the effect starts: its lift plus, when it leaves a barrel,
          // how far that barrel sits above the ground
          up: (f.up || 0) + (f.mz ? -f.mz.dy : 0),
          fromUp: f.from ? (f.from.up || 0) + (f.from.mz ? -f.from.mz.dy : 0) : null,
          toUp: f.to ? (f.to.up || 0) : null,
          // where a burst or a splash is on the table
          x: f.x != null ? Math.round(f.x * 10) / 10 : null, y: f.y != null ? Math.round(f.y * 10) / 10 : null
        };
      });
    };
    window.__flyLift = function (u) { return ISO.flyLift(u); };
    window.__addFx = function (f) { addFx(f); };
    // the cadence each streaming style fires at, which the viewer also reads
    window.__fireSpec = function (style) {
      var f = B.FIRE[style];
      return f ? { gap: f.gap, clump: f.clump || 0, clumpGap: f.clumpGap || 0, bursts: f.bursts || 1,
        min: f.n(0), max: f.n(99), length: B.streamLength(style, 2) } : null;
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
    window.__relocating = function () { return B.state.relocating ? { side: B.state.relocating.side, cap: B.state.relocating.cap, moved: B.state.relocating.moved.slice() } : null; };
    window.__pressAction = function (id) {
      var u = ui.selected;
      if (!u) return false;
      var st = actionState(u, id);
      if (!st.on) return false;
      chooseAction(id);
      return true;
    };
    window.__eligibleCodes = function () {
      return eligible(B.state.activeSide).map(function (u) { return u.code; });
    };
    window.__markState = function () {
      return {
        mode: ui.mode, kind: ui.markKind || null, reach: ui.selected ? markReach(ui.selected) : 0,
        targets: ui.targets.length, moves: ui.moves.length,
        picks: (ui.markPicks || []).length
      };
    };
    window.__colours = function () { return { A: B.muster.colour, B: ui.foeColour || null }; };
    window.PMC_SETVIEW = function (wx, wy, z) {
      var p = ISO.toScreen(wx, wy);
      if (z) { cam.z = z; zoomLabel(); }
      cam.x = cam.tx = p.x; cam.y = cam.ty = p.y;
      clampCam(); setHome(cam.x, cam.y); drawBoard();
    };
    // the skirmish set-up in progress, and where the camera is
    window.__hot = function () { return B.muster.hot ? JSON.parse(JSON.stringify(B.muster.hot)) : null; };
    window.__cam = function () { return { x: cam.x, y: cam.y, tx: cam.tx, ty: cam.ty, z: cam.z, borrowed: !!cam.borrowed, home: cam.home ? { x: cam.home.x, y: cam.home.y } : null }; };
  };
  /* The campaign dossier's, installed by dossier.js (D): its own choice of
     contract, and a contract's scenario set by hand, to look at each one's
     briefing. */
  root.PMCTestHooks.dossier = function (D) {
    window.__autopick = D.autoPick;
    window.__forceScenario = function (id) {
      var contract = D.contract, camp = D.camp, C = D.C;
      if (!contract) return null;
      contract.scenario = { roll: C.SCENARIOS.indexOf(id) + 1, id: id, name: C.SCENARIO_NAMES[id] };
      contract.roles = root.PMCScen ? root.PMCScen.rollRoles(id, {
        A: camp.companies.A.doctrines || [], B: camp.companies.B.doctrines || []
      }) : null;
      D.render();
      return { scenario: contract.scenario, roles: contract.roles };
    };
  };
})(window);
