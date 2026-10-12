/* PMC 2670 — Firefight : Close Encounters' hidden movement and reaction fire
   (Appendix 1, p. 158): units that start the battle as counters, what reveals
   them, the Fire at Will! exchange when one walks into an enemy's sight, the
   Detect special action of Advanced Sensors and Sixth Sense, Covering Fire!
   and Opportunity Fire.

   Made once by engine.js, the first time it is wanted. E is what it needs of
   engine.js: what never changes bound here once, and what does (the battle
   itself, and anything else reassigned) read through E as it is now. It hands
   back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineCounters = function (E) {
    var R = E.R, logLine = E.logLine, pushRes = E.pushRes, onTable = E.onTable,
        abShoot = E.abShoot, snapshotAlive = E.snapshotAlive, deathsSince = E.deathsSince,
        playShooting = E.playShooting, fromLog = E.fromLog, soundFor = E.soundFor,
        isAI = E.isAI, ui = E.ui, setHint = E.setHint, revealConsole = E.revealConsole, render = E.render;

    /* The enemy unit nearest a point that sees a unit of u's standing there (u
       itself out of the way), or null. A counter is a unit on the table: hidden
       or not, an enemy that sees it gives it away. */
    function seerOf(u, p) {
      var ghost = { x: p.x, y: p.y, alive: true, of: u, side: u.side };
      var best = null, bd = Infinity;
      E.state.units.forEach(function (e) {
        if (!e.alive || e.side === u.side || !onTable(e) || e.aboard) return;
        if (!R.hasLoS(E.state, e, ghost)) return;
        var d = R.inches(e.x, e.y, p.x, p.y);
        if (d < bd) { bd = d; best = e; }
      });
      return best;
    }

    /* "Hidden units are automatically revealed when they come into line of sight
       of an enemy unit (when that happens, the hidden unit immediately stops its
       movement)" (p. 158). Walked along the route half an inch at a time: the
       first place it could stand where an enemy sees it, or null if none does.
       `path` is the route from where it starts to where it was going. */
    function hiddenStop(u, path) {
      if (!u.hidden || !path || path.length < 2) return null;
      var pts = [];
      for (var i = 1; i < path.length; i++) {
        var a = path[i - 1], b = path[i], len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(len / 0.5));
        for (var k = 1; k <= n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
      }
      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        // it stops somewhere it can stand: past a corner it cannot halt in the wall
        if (R.TERRAIN[R.terrainAt(E.state, p.x, p.y)].impassable || R.unitNear(E.state, p.x, p.y, u, 1)) continue;
        var e = seerOf(u, p);
        if (e) return { at: p, by: e, path: [path[0]].concat(pts.slice(0, j + 1)) };
      }
      return null;
    }

    function revealUnit(u, why) {
      if (!u || !u.hidden) return false;
      u.hidden = false;
      logLine('note', u.label + ' is revealed' + (why ? ' — ' + why : '') + '.');
      return true;
    }
    /* After anything moves or arrives: every counter an enemy now sees is
       revealed, but `skip` (a mover the caller is revealing itself). */
    function revealSweep(skip) {
      if (!E.state || !E.state.compound) return [];
      var out = [];
      E.state.units.forEach(function (h) {
        if (!h.alive || !h.hidden || !onTable(h) || h.aboard || h === skip) return;
        var e = seerOf(h, h);
        if (e) out.push({ h: h, e: e });
      });
      out.forEach(function (q) { revealUnit(q.h, 'in sight of ' + q.e.label); });
      return out.map(function (q) { return q.h; });
    }

    // a shot that is no activation: Fire at Will! (and Opportunity Fire, Covering Fire!, later)
    function reactShot(a, t, title) {
      var snap = snapshotAlive();
      var res = abShoot(E.state, a, t, 'react', {});
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      soundFor(res.log);
      var card = fromLog(title, a.name + ' → ' + t.name, a.side, res.log);
      playShooting(a, t, res, deathsSince(snap), function () { pushRes(card); });
      return res;
    }
    /* Fire at Will! (p. 158): a counter that walked into an enemy's sight and was
       revealed by it is shot at by that enemy, "right after it is placed on the
       table (as long as the revealed unit is in Range)" — the nearest unsuppressed
       enemy that can shoot it. "If the revealed unit is not Suppressed, Broken or
       destroyed as a result of this attack, it may shoot back." Neither gets the
       Fire! +1, and neither counts as an activation. Both always take the shot. */
    function fireAtWill(u) {
      if (!u || !u.alive || u.hidden || !onTable(u)) return null;
      var shooter = null, bd = Infinity;
      E.state.units.forEach(function (e) {
        if (!e.alive || e.hidden || e.side === u.side || !onTable(e) || e.aboard || R.status(e) !== 'ready' || e.fp === null) return;
        if (!R.canShoot(E.state, e, u, 'react', {})) return;
        var d = R.unitDist(e, u);
        if (d < bd) { bd = d; shooter = e; }
      });
      if (!shooter) return null;
      logLine('note', 'Fire at Will! — ' + shooter.label + ' opens up on ' + u.label + ' as it shows itself.');
      reactShot(shooter, u, 'Fire at Will!');
      var back = false;
      if (u.alive && R.status(u) === 'ready' && shooter.alive && R.canShoot(E.state, u, shooter, 'react', {})) {
        reactShot(u, shooter, 'Fire at Will! — the answer');
        back = true;
      }
      return { shooter: shooter, back: back };
    }

    /* Detect (Advanced Sensors / Sixth Sense, p. 158): after its move, every enemy
       counter within 12" is revealed, "whether they are in that unit's line of
       sight or not". */
    function detectReveal(u) {
      var out = E.state.units.filter(function (h) {
        return h.alive && h.hidden && h.side !== u.side && onTable(h) && !h.aboard && R.unitDist(u, h) <= 12;
      });
      out.forEach(function (h) { revealUnit(h, 'picked up by ' + u.label + '’s sensors'); });
      if (!out.length) logLine('note', u.label + ' sweeps the corridors: no enemy counter within 12".');
      return out;
    }
    function canDetect(u) {
      return !!(E.state && E.state.compound && u && !u.hidden && (R.has(u, 'Advanced Sensors') || R.has(u, 'Sixth Sense')));
    }

    /* A hidden unit's move, ending where it was going or where it was seen: the
       place it ends, the route it took, and the enemy that saw it (or null). */
    function hiddenMove(u, path, to) {
      var full = path && path.length && (Math.abs(path[0].x - u.x) > 1e-6 || Math.abs(path[0].y - u.y) > 1e-6)
        ? [{ x: u.x, y: u.y }].concat(path) : (path || []).slice();
      if (!full.length || Math.abs(full[full.length - 1].x - to.x) > 1e-6 || Math.abs(full[full.length - 1].y - to.y) > 1e-6) full.push({ x: to.x, y: to.y });
      var hs = hiddenStop(u, full);
      return hs ? { at: hs.at, path: hs.path, by: hs.by } : { at: to, path: full, by: null };
    }
    /* After the move is made: revealed where it was seen (and the exchange of
       fire), then anything else the move brought into sight. */
    function afterHiddenMove(u, seenBy) {
      if (seenBy) {
        revealUnit(u, 'seen by ' + seenBy.label + ', it stops where it is');
        revealSweep(u);
        fireAtWill(u);
      } else revealSweep();
    }

    /* ---- Covering Fire! (p. 158) ----
       "made by a non-active unit (the 'covering unit') as soon as a friendly unit
       (the 'covered unit') within 6" and in line of sight is activated and
       assigned an action. The covering unit remains in place and fires ... at
       an enemy unit in line of sight and within Range ... may shoot through the
       covered unit (but not through other friendly units). All standard bonuses
       apply except from the +1 bonus for making a Fire! action. Covering Fire!
       counts as an activation, and the attack is resolved BEFORE the covered
       unit makes its action." Here it is taken from the covered unit's bar, at
       the start of its activation: the cover first, then whatever it does. */
    // a shot by `a` that may pass through `through` (the unit it covers)
    function through(a, past, fn) {
      var was = a.of;
      a.of = past;
      try { return fn(); } finally { if (was === undefined) delete a.of; else a.of = was; }
    }
    function coverTargets(f, u) {
      return E.state.units.filter(function (t) {
        return t.alive && t.side !== f.side && onTable(t) && !t.aboard && !t.hidden &&
          through(f, u, function () { return R.canShoot(E.state, f, t, 'react', {}); });
      });
    }
    function coverers(u) {
      if (!E.state || !E.state.compound || !u || u.hidden || u.covered === E.state.turn) return [];
      return E.state.units.filter(function (f) {
        if (f === u || !f.alive || f.side !== u.side || !onTable(f) || f.aboard || f.hidden || f.activated) return false;
        if (R.status(f) !== 'ready' || f.fp === null || R.unitDist(f, u) > 6 || !R.hasLoS(E.state, f, u)) return false;
        return coverTargets(f, u).length > 0;
      });
    }
    function startCover(u) {
      ui.mode = 'cover-by';
      ui.targets = coverers(u); ui.moves = []; ui.terrain = [];
      setHint(null, 'Covering Fire! — tap the friend within 6" that fires first for ' + u.name + '.');
      render();
    }
    function coverBy(f) {
      var u = ui.selected;
      ui.cover = { by: f.id };
      ui.mode = 'cover-at';
      ui.targets = coverTargets(f, u);
      setHint(null, 'Covering Fire! — tap the enemy ' + f.name + ' fires at.');
      render();
    }
    function coverAt(t) {
      var u = ui.selected, f = ui.cover && E.byId(ui.cover.by);
      ui.cover = null; ui.mode = 'idle'; ui.targets = [];
      if (!u || !f) { render(); return; }
      logLine('note', 'Covering Fire! — ' + f.label + ' opens up on ' + t.label + ' before ' + u.label + ' goes.');
      through(f, u, function () { reactShot(f, t, 'Covering Fire!'); });
      f.activated = true;                                // its activation, spent on the cover
      u.covered = E.state.turn;
      setHint(null, f.name + ' has fired: now ' + u.name + '’s action.');
      render();
    }

    /* ---- Opportunity Fire (p. 158) ----
       "When a unit enters an enemy unit's Line of Sight while moving, but ends the
       move outside that unit's LoS (e.g. when crossing a corridor junction), the
       enemy unit may react and shoot at the moving unit during it's move action,
       thus interrupting it's activation. The moving unit must be in Range ... All
       standard shooting modifiers are applied except the +1 bonus for the Fire!
       action. Opportunity Fire counts as an activation." The enemy that could: one
       not yet activated, steady, out of sight of the mover where it starts and
       where it ends, with it in sight and in range somewhere on the way. The first
       place along the route any of them could fire is where it is caught. */
    function oppCheck(u, path, to) {
      if (!E.state.compound || u.hidden || !path || path.length < 2) return null;
      var pts = [];
      for (var i = 1; i < path.length; i++) {
        var a = path[i - 1], b = path[i], len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(len / 0.5));
        for (var k = 1; k <= n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
      }
      var start = Object.assign({}, u, { of: u }), end = Object.assign({}, u, { x: to.x, y: to.y, of: u });
      var foes = E.state.units.filter(function (e) {
        return e.alive && e.side !== u.side && onTable(e) && !e.aboard && !e.hidden && !e.activated &&
          R.status(e) === 'ready' && e.fp !== null && !R.hasLoS(E.state, e, start) && !R.hasLoS(E.state, e, end);
      });
      if (!foes.length) return null;
      for (var j = 0; j < pts.length - 1; j++) {
        var g = Object.assign({}, u, { x: pts[j].x, y: pts[j].y, of: u });
        for (var f = 0; f < foes.length; f++) {
          if (R.canShoot(E.state, foes[f], g, 'react', {})) return { e: foes[f], at: pts[j], path: [path[0]].concat(pts.slice(0, j + 1)) };
        }
      }
      return null;
    }
    /* Put to the enemy (the AI always fires); `done(stop)` carries on with the
       move — `stop` the place and route it ends at if the shot pinned it there,
       or null to go on to where it was going. */
    function oppFire(u, opp, done) {
      var e = opp.e, p = opp.at, x0 = u.x, y0 = u.y;
      function answer(yes) {
        E.state.oppAsk = null; ui.oppThen = null;
        if (!yes || !e.alive || !u.alive) { done(null); return; }
        u.x = p.x; u.y = p.y;
        logLine('note', 'Opportunity Fire — ' + e.label + ' catches ' + u.label + ' crossing its line of sight.');
        reactShot(e, u, 'Opportunity Fire');
        e.activated = true;
        var pinned = !u.alive || R.status(u) !== 'ready';
        u.x = x0; u.y = y0;
        if (pinned && u.alive) logLine('note', u.label + ' goes to ground where it was caught.');
        done(pinned ? { at: p, path: opp.path } : null);
      }
      if (isAI(e.side)) { answer(true); return; }
      E.state.oppAsk = { side: e.side, shooter: e.id, mover: u.id, x: p.x, y: p.y };
      ui.oppThen = answer;
      setHint(null, 'Opportunity Fire — ' + u.name + ' is crossing ' + e.name + '’s line of sight.');
      revealConsole();
      render();
    }

    return {
      seerOf: seerOf, hiddenStop: hiddenStop, hiddenMove: hiddenMove, afterHiddenMove: afterHiddenMove,
      revealUnit: revealUnit, revealSweep: revealSweep, fireAtWill: fireAtWill, reactShot: reactShot,
      detectReveal: detectReveal, canDetect: canDetect,
      coverers: coverers, startCover: startCover, coverBy: coverBy, coverAt: coverAt,
      oppCheck: oppCheck, oppFire: oppFire
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineCounters;
})(typeof window !== 'undefined' ? window : global);
