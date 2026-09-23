/* The main menu: the first screen, and the one every "back" leads to.

   Skirmish, Campaign and Multiplayer each hand over to the screen that already
   does the job — the muster sheet, the campaign dossier, the lobby — so this
   file only decides which one to open and how it is set up.

   Behind it, a table rolled from the book's generators and drawn by the
   board's own renderer. Every few seconds the next world in the list is
   rolled afresh and fades in over the last, and now and then a pair of
   interceptors goes over. */
(function (root) {
  'use strict';

  var R = root.PMC, ISO = root.PMCIso, GEN = root.PMCGen;
  var WORLDS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
  var EVERY = 10000;            // a new table this often, in ms: long enough to take one in
  var FADE = 1600;              // and this long to fade it in
  var SCALE = 0.5;              // a table is kept at half size: it is a backdrop
  var PASS = 3800;              // how long a pair of interceptors takes to cross, in ms
  var FLYBY = 0.35;             // the chance of a pair going over, each new table

  function el(id) { return document.getElementById(id); }

  /* ================= navigation ================= */
  function show(pane) {
    el('menu-main').hidden = pane !== 'main';
    el('menu-skirmish').hidden = pane !== 'skirmish';
    // the foot: the unit viewer under the main menu, the demo under the skirmish list
    var v = el('lnk-viewer'), d = el('btn-menu-demo');
    if (v) v.hidden = pane === 'skirmish';
    if (d) d.hidden = pane !== 'skirmish';
  }

  function open(pane) {
    var m = el('menu');
    if (!m) return;
    ['setup', 'camp', 'lobby'].forEach(function (id) { var o = el(id); if (o) o.hidden = true; });
    m.hidden = false;
    show(pane || 'main');
    paint();
    Table.start();
  }
  function close() {
    var m = el('menu');
    if (m) m.hidden = true;
    Table.stop();
  }
  function isOpen() { var m = el('menu'); return !!m && !m.hidden; }

  /* What the cards say depends on what there is to go back to. */
  function paint() {
    var live = root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE();
    el('btn-resume').hidden = !live;
    var camp = root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.get();
    var sub = el('menu-camp-sub');
    if (sub) {
      sub.textContent = camp && camp.companies && camp.companies.A
        ? 'Continue: ' + camp.companies.A.name + ', campaign turn ' + camp.turn
        : 'Raise a force and see it through a war';
    }
  }

  function wire() {
    var m = el('menu');
    if (!m) return;
    m.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button') : null;
      if (!b) return;
      if (root.SFX && root.SFX.click) { try { root.SFX.click(); } catch (e) { } }
      var go = b.getAttribute('data-menu');
      if (go) { show(go); return; }
      var kind = b.getAttribute('data-skirmish');
      if (kind) { close(); if (root.PMC_SKIRMISH) root.PMC_SKIRMISH(kind); return; }
      switch (b.id) {
        case 'btn-skirmish': show('skirmish'); return;
        case 'btn-resume': close(); return;
        /* The campaign and multiplayer cards are wired by the screens they
           open (dossier.js, game.js); all the menu does is get out of the way. */
        case 'btn-campaign': case 'btn-multi': close(); return;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') {
        if (!el('menu-skirmish').hidden) show('main');
        else if (root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE()) close();
      }
    });
    root.addEventListener('resize', function () { Table.fit(); if (isOpen()) Table.start(); });
  }

  /* ================= the table behind the menu ================= */
  var Table = (function () {
    var cv = null, g = null;
    var shown = null, prev = null;   // the table on screen, and the one it is fading from
    var fadeAt = 0, running = false, raf = 0, timer = 0;
    var world = Math.floor(Math.random() * WORLDS.length);   // where the cycle starts
    var z = 1, ox = 0, oy = 0;       // how the table sits on the canvas, for the aircraft
    var pass = null, passTimer = 0;  // a pair of interceptors on the way over

    function fit() {
      if (!cv) return false;
      var dpr = Math.min(2, root.devicePixelRatio || 1);
      var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; return true; }
      return false;
    }

    // what a hill lifts a prop by — the board's own reading (game.js liftOf)
    function lifter(terrain) {
      return function (x, y) {
        for (var i = 0; i < terrain.length; i++) {
          var r = terrain[i];
          if (r.kind === 'hill' && R.inRect(x, y, r)) return r.top && R.inPoly(x, y, r.top) ? ISO.ELEV * 2 : ISO.ELEV;
        }
        return 0;
      };
    }

    // a freshly rolled table on the next world in the cycle, ground and all
    function bake() {
      var planet = WORLDS[world++ % WORLDS.length];
      var seed = (Math.random() * 100000) | 0;
      var terrain = GEN.generate({ width: R.BOARD.w, height: R.BOARD.h, planet: planet }).terrain;
      var ground = ISO.bakeGround(terrain, seed, planet);
      var props = ISO.buildProps(terrain, [], seed, planet);
      var p = document.createElement('canvas');
      p.width = Math.round(ISO.PIXW * SCALE); p.height = Math.round(ISO.PIXH * SCALE);
      var pg = p.getContext('2d');
      pg.drawImage(ground, 0, 0, p.width, p.height);
      var s = document.createElement('canvas');
      s.width = ISO.PIXW; s.height = ISO.PIXH;
      var sg = s.getContext('2d'), lift = lifter(terrain);
      props.forEach(function (pr) { ISO.drawProp(sg, pr, lift(pr.x, pr.y)); });
      pg.drawImage(s, 0, 0, p.width, p.height);
      return p;
    }

    // one table, scaled to cover the screen
    function lay(p, alpha) {
      if (!p || alpha <= 0) return;
      var W = cv.width, H = cv.height;
      /* In close, so the table fills the screen. On a wide screen that is its
         longer side and then some; a tall phone, zoomed that way, came out
         twice as close as a desktop, so it takes instead the furthest out that
         still has the screen inside the table's diamond, corners and all. */
      var fw = W / p.width, fh = H / p.height;
      var dw = (ISO.W + ISO.H) * ISO.K * SCALE, dh = dw / 2, top = ISO.TOP * SCALE;   // the table's diamond, in the picture
      z = Math.min(Math.max(fw, fh) * 1.7, (W / dw + H / dh) * 1.02);
      ox = (W - p.width * z) / 2; oy = H / 2 - (top + dh / 2) * z;   // the diamond centred, not the picture
      g.globalAlpha = alpha;
      g.drawImage(p, ox, oy, p.width * z, p.height * z);
      g.globalAlpha = 1;
    }

    function paint(now) {
      raf = 0;
      if (!running) return;
      fit();
      var k = Math.min(1, ((now || 0) - fadeAt) / FADE);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      lay(prev, 1 - k);
      lay(shown, k);
      var flying = fly(now || 0);
      // frames only while something moves; a still table needs none
      if (k < 1 || flying) raf = root.requestAnimationFrame(paint);
      if (k >= 1) prev = null;
    }

    /* ---- the flypast ----
       Two interceptors, leader and wingman, drawn by the game's own machine
       art, crossing the table on a heading picked at random. They fly in the
       table's own coordinates, so they sit on it at the table's scale. */
    function jet(x, y, facing) {
      var p = R.profile('interceptor');
      return Object.assign({}, p, {
        id: 'M' + x, side: 'A', label: p.name, models: 1, rules: p.rules.slice(),
        sp: 0, alive: true, damage: 0, cargo: [], x: x, y: y, facing: facing
      });
    }
    function flyby() {
      passTimer = 0;
      if (!running || !R.profile('interceptor')) return;
      var ang = Math.random() * Math.PI * 2;
      var c = { x: R.BOARD.w / 2 + (Math.random() - 0.5) * 16, y: R.BOARD.h / 2 + (Math.random() - 0.5) * 16 };
      pass = { ang: ang, c: c, reach: reachFor(ang), at: root.performance && root.performance.now ? root.performance.now() : Date.now() };
      if (!raf) raf = root.requestAnimationFrame(paint);
    }
    /* How far out the pair starts and finishes, in inches: far enough that on
       this heading, at whatever the table is zoomed to, both are off the screen
       at each end. An inch along the heading moves the craft this far across
       the screen, and the flight only has to clear one of the two axes. */
    function reachFor(ang) {
      var s = ISO.K * SCALE * z;
      var ex = Math.abs((Math.cos(ang) - Math.sin(ang)) * s);
      var ey = Math.abs((Math.cos(ang) + Math.sin(ang)) * s / 2);
      var rx = ex > 0.01 ? (cv.width / 2 + 160) / ex : Infinity;
      var ry = ey > 0.01 ? (cv.height / 2 + 160) / ey : Infinity;
      // plus the slack for wherever the pass was centred, and the wingman behind
      return Math.max(20, Math.min(400, Math.min(rx, ry) + 14));
    }
    function fly(now) {
      if (!pass || !ISO.drawUnit) return false;
      var k = (now - pass.at) / PASS;
      if (k > 1) { pass = null; return false; }
      var dx = Math.cos(pass.ang), dy = Math.sin(pass.ang), reach = pass.reach || 46;
      var lead = { x: pass.c.x + dx * reach * (2 * k - 1), y: pass.c.y + dy * reach * (2 * k - 1) };
      g.save();
      g.setTransform(z * SCALE, 0, 0, z * SCALE, ox, oy);
      [[-3, 3], [0, 0]].forEach(function (o) {          // the wingman first: it is behind
        var x = lead.x + dx * o[0] - dy * o[1], y = lead.y + dy * o[0] + dx * o[1];
        try { ISO.drawUnit(g, jet(x, y, pass.ang), { at: { x: x, y: y }, status: 'ready' }); } catch (e) { pass = null; }
      });
      g.restore();
      return !!pass;
    }

    /* Roll the next table and fade it in over the last, then do it again. The
       bake waits a tick, so the menu is up and answering before the first. */
    function next() {
      timer = 0;
      if (!running) return;
      var p;
      try { p = bake(); }
      catch (e) { if (root.console) console.warn('the menu table could not be drawn', e); return; }
      if (!running) return;
      prev = shown; shown = p;
      // the pass goes over the table it was started with: a table that changed
      // half way through would leave the pair flying over the next one
      if (Math.random() < FLYBY) flyby();
      fadeAt = root.performance && root.performance.now ? root.performance.now() : Date.now();
      if (!raf) raf = root.requestAnimationFrame(paint);
      timer = setTimeout(next, EVERY);
    }

    function start() {
      if (running || root.PMC_NO_BACKDROP) return;
      cv = cv || el('menu-table');
      if (!cv || !cv.getContext || !root.requestAnimationFrame || !ISO || !GEN || !R) return;
      // a canvas that is not on screen has nothing to show a table on
      if (!(cv.clientWidth > 0 && cv.clientHeight > 0)) return;
      g = g || cv.getContext('2d');
      if (!g) return;
      running = true;
      if (shown) { fadeAt = -FADE; raf = root.requestAnimationFrame(paint); }   // the last one, at once
      timer = setTimeout(next, shown ? EVERY : 30);
    }
    function stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = 0; }
      if (passTimer) { clearTimeout(passTimer); passTimer = 0; }
      pass = null;
      if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf);
      raf = 0;
    }
    function resized() { if (running && fit() && !raf) raf = root.requestAnimationFrame(paint); }
    return { start: start, stop: stop, fit: resized, flyby: function () { if (running) flyby(); } };
  })();

  root.PMCMenu = { open: open, close: close, isOpen: isOpen, show: show, table: Table };

  function boot() {
    wire();
    if (isOpen()) { paint(); Table.start(); }
    /* The campaign is read from storage after the page loads; say "Continue"
       as soon as it is there. */
    setTimeout(paint, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : global);
