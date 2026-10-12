/* PMC 2670 — Firefight : Close Encounters' hidden movement (Appendix 1, p. 158):
   units that start the battle as counters, what reveals them, the Fire at Will!
   exchange when one walks into an enemy's sight, and the Detect special action
   of Advanced Sensors and Sixth Sense.

   Made once by engine.js, the first time it is wanted. E is what it needs of
   engine.js: what never changes bound here once, and what does (the battle
   itself, and anything else reassigned) read through E as it is now. It hands
   back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineCounters = function (E) {
    var R = E.R, logLine = E.logLine, pushRes = E.pushRes, onTable = E.onTable,
        abShoot = E.abShoot, snapshotAlive = E.snapshotAlive, deathsSince = E.deathsSince,
        playShooting = E.playShooting, fromLog = E.fromLog, soundFor = E.soundFor;

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

    return {
      seerOf: seerOf, hiddenStop: hiddenStop, hiddenMove: hiddenMove, afterHiddenMove: afterHiddenMove,
      revealUnit: revealUnit, revealSweep: revealSweep, fireAtWill: fireAtWill, reactShot: reactShot,
      detectReveal: detectReveal, canDetect: canDetect
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineCounters;
})(typeof window !== 'undefined' ? window : global);
