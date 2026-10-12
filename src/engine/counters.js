/* PMC 2670 — Firefight : Close Encounters' hidden movement and reaction fire
   (Appendix 1, p. 158): units that start the battle as counters, what reveals
   them, the Fire at Will! exchange when one walks into an enemy's sight, the
   Detect special action of Advanced Sensors and Sixth Sense, Covering Fire!
   and Opportunity Fire; dangerous and burning sections (p. 159), and the
   special equipment each side carries in (p. 159).

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
        isAI = E.isAI, ui = E.ui, setHint = E.setHint, revealConsole = E.revealConsole, render = E.render,
        repaintTerrain = E.repaintTerrain, UR = E.UR;

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
      firingHazard(a, t, res.roll);
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

    /* ---- sections (p. 159) ---- */
    var FLOORS = { corridor: 1, room: 1, hall: 1 };
    function sectionOf(x, y) {
      var ts = E.state.terrain;
      for (var i = 0; i < ts.length; i++) {
        var r = ts[i];
        if (FLOORS[r.kind] && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
      }
      return null;
    }
    function secName(r) { return r.name ? r.name.toLowerCase() : r.kind === 'corridor' ? 'corridor section' : r.kind; }
    function inside(u, r) { return u.alive && onTable(u) && !u.aboard && u.x >= r.x && u.x <= r.x + r.w && u.y >= r.y && u.y <= r.y + r.h; }
    // whether a unit sees into a section: to the nearest point of it, a little way in
    function seesInto(u, r) {
      var x = Math.max(r.x + 0.3, Math.min(r.x + r.w - 0.3, u.x)), y = Math.max(r.y + 0.3, Math.min(r.y + r.h - 0.3, u.y));
      return R.lineClear(E.state, u, { x: x, y: y });
    }
    /* A shooting attack with no shooter (an explosion, a fire): "Firepower X and
       no Defence bonuses" — the D10 and the Firepower against the unit's own
       Defence, an unmodified 0 a miss and a 9 at least a hit, as any shot. */
    function blast(u, fp, what, log) {
      var a = { id: 'blast', label: what, name: what, side: null, fp: fp, rules: [], x: u.x, y: u.y, alive: true, cls: 'infantry', models: 1 };
      var roll = R.d10(), total = roll + fp, def = u.def;
      var hits = roll === 0 ? 0 : roll === 9 ? Math.max(1, total - def) : Math.max(0, total - def);
      log.push({ t: 'shoot', text: what + ' catches ' + u.label + '.', math: 'D10 ' + roll + ', Firepower ' + fp + ' = ' + total + ' vs Defence ' + def + ' (no bonuses) → ' + hits + ' hit' + (hits === 1 ? '' : 's') });
      if (!hits) return;
      if (R.isMachine(u)) {
        var dm = R.resolveDamage(u, hits, false, 0);
        log.push({ t: 'hits', text: dm.rolls.join(' · ') });
        R.applyDamage(E.state, u, dm.damage, log, a);
      } else {
        var hr = R.resolveShootingHits(E.state, u, hits, 0, a);
        log.push({ t: 'hits', text: hr.rolls.join(' · ') });
        R.applyResult(E.state, u, hr, log, a);
      }
    }
    function tell(title, side, log, note) {
      log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      pushRes(fromLog(title, note || '', side || null, log));
    }
    /* Exploding sections (p. 159): "all units inside suffer a shooting attack with
       Firepower 10 and no Defence bonuses. Additionally, any unit which has the
       exploding sector in its line of sight and is within 6" of that sector
       suffers a shooting firing attack with Firepower 6." A dangerous section
       goes up once a battle. */
    function explodeSection(r, why) {
      if (!r) return;
      var log = [{ t: 'note', text: 'The ' + secName(r) + ' explodes' + (why ? ' — ' + why : '') + '!' }];
      r.dangerous = false; r.blown = true;
      var near = E.state.units.filter(function (u) {
        return u.alive && onTable(u) && !u.aboard && !inside(u, r) && Math.max(0, R.rectPointDist(r, u.x, u.y) - UR) <= 6 && seesInto(u, r);
      });
      E.state.units.filter(function (u) { return inside(u, r); }).forEach(function (u) { blast(u, 10, 'The explosion', log); });
      near.forEach(function (u) { if (u.alive) blast(u, 6, 'The blast', log); });
      tell('Explosion', null, log, 'The ' + secName(r));
      if (E.addFx) E.addFx({ kind: 'collapse', x: r.x + r.w / 2, y: r.y + r.h / 2, r: Math.max(2, Math.max(r.w, r.h) * 0.6), dur: 1100 });
      repaintTerrain([{ piece: r }]);
    }
    // a section set on fire; a dangerous one "starts to burn, it explodes immediately"
    function setBurning(r, by) {
      if (!r || r.burning) return;
      r.burning = E.state.turn; r.burnRolled = false;
      logLine('note', 'The ' + secName(r) + ' is on fire' + (by ? ' — ' + by : '') + '.');
      repaintTerrain([{ piece: r }]);
      if (r.dangerous) explodeSection(r, 'the fire reaches what is stored there');
    }
    function putOut(r, how) {
      if (!r || !r.burning) return;
      r.burning = null; r.burnRolled = false;
      logLine('note', 'The fire in the ' + secName(r) + ' ' + how + '.');
      repaintTerrain([{ piece: r }]);
    }
    /* "We can't have any firing in there" (p. 159): firing at a target inside a
       dangerous section sets it off on a Firing roll of 7+; a unit inside one
       firing out sets it off on a 0. `roll` is the shot's D10 as it fell. */
    function firingHazard(a, t, roll) {
      if (!E.state || !E.state.compound || roll == null || !a || !t) return;
      var rt = sectionOf(t.x, t.y), ra = a.x >= 0 ? sectionOf(a.x, a.y) : null;
      if (rt && rt.dangerous && roll >= 7) explodeSection(rt, 'a stray round from ' + a.label);
      else if (ra && ra.dangerous && roll === 0) explodeSection(ra, a.label + '’s own fire');
    }
    /* Beginning phase: "roll a D6; on 4+ the fire burns out or is extinguished and
       has no further effects. If the section had been burning in previous turns,
       the fire burns out automatically." */
    function hazardsBeginning() {
      if (!E.state.compound) return;
      E.state.terrain.forEach(function (r) {
        if (!r.burning || r.burning >= E.state.turn) return;
        if (r.burnRolled) { putOut(r, 'burns itself out'); return; }
        r.burnRolled = true;
        var d = R.d6();
        if (d >= 4) putOut(r, 'dies down (D6 ' + d + ')');
        else logLine('note', 'The ' + secName(r) + ' burns on (D6 ' + d + ').');
      });
    }
    /* End phase: "each unit inside a burning section suffers a Firepower 6 shooting
       attack with no Defence bonuses"; and the Satchel Charges set this turn go off. */
    function hazardsEnd() {
      if (!E.state.compound) return;
      E.state.terrain.forEach(function (r) {
        if (!r.burning) return;
        var log = [];
        E.state.units.filter(function (u) { return inside(u, r); }).forEach(function (u) { blast(u, 6, 'The fire', log); });
        if (log.length) tell('Fire', null, log, 'The ' + secName(r));
      });
      (E.state.charges || []).forEach(function (c) {
        var r = E.state.terrain[c.sec], d = R.d6(), tot = d + (c.sappers ? 1 : 0);
        if (tot >= 3) explodeSection(r, 'Satchel Charges (D6 ' + d + (c.sappers ? '+1' : '') + ')');
        else logLine('note', 'Satchel Charges in the ' + secName(r) + ' — D6 ' + d + (c.sappers ? '+1' : '') + ': duds, or found and disarmed.');
      });
      E.state.charges = [];
    }

    /* ---- special equipment (p. 159): the list and the choosing in rules/compound.js ---- */
    var KIT = root.PMCCompound.KIT, cleanKit = root.PMCCompound.cleanKit, defaultKit = root.PMCCompound.defaultKit;
    function kitLeft(u, key) { var k = E.state.kit && E.state.kit[u.side]; return k ? k[key] || 0 : 0; }
    function spend(u, key) { E.state.kit[u.side][key] -= 1; }
    // may this unit use that piece now: unsuppressed, on the table, revealed, in a compound
    function kitUsable(u, key) {
      return !!(E.state.compound && u && !u.hidden && onTable(u) && !u.aboard && R.status(u) === 'ready' && kitLeft(u, key) > 0);
    }
    // the sections an incendiary (or vacuum) charge may go into from where the unit stands
    function throwTargets(u, burningOnly) {
      return E.state.terrain.filter(function (r) {
        if (!FLOORS[r.kind] || (burningOnly && !r.burning) || (!burningOnly && r.burning)) return false;
        if (inside(u, r)) return true;
        return Math.max(0, R.rectPointDist(r, u.x, u.y) - UR) <= 6 && seesInto(u, r);
      });
    }
    function satchel(u) {
      var r = sectionOf(u.x, u.y);
      spend(u, 'satchel');
      E.state.charges = E.state.charges || [];
      E.state.charges.push({ sec: E.state.terrain.indexOf(r), side: u.side, sappers: R.has(u, 'Sappers') });
      logLine('note', u.label + ' plants Satchel Charges in the ' + secName(r) + ' — they go off in the End phase.');
    }
    /* Ballistic Barrier: a low wall up to 6" long within 1" of the unit. Put across
       the way the nearest enemy (as the walk goes) would come: across a corridor,
       wall to wall; in a room, 6" wide, and kept inside it. */
    function barrier(u) {
      var r = sectionOf(u.x, u.y);
      var foes = E.state.units.filter(function (e) { return e.alive && e.side !== u.side && onTable(e) && !e.aboard; });
      var wf = R.walkField(E.state, u.x, u.y, u.side);
      var foe = foes.sort(function (a2, b2) { return (wf ? wf(a2.x, a2.y) : 0) - (wf ? wf(b2.x, b2.y) : 0) || R.unitDist(u, a2) - R.unitDist(u, b2); })[0];
      var dx = foe ? foe.x - u.x : 1, dy = foe ? foe.y - u.y : 0;
      var along = r && r.axis ? r.axis : Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      // within 1" of it, and near enough to shelter behind (the low wall's 1.5" to the middle)
      var T = 0.6, gap = UR + 0.3, piece;
      if (along === 'h') {
        var x = u.x + (dx >= 0 ? gap : -gap - T), y0 = r ? r.y : u.y - 3, h = r ? Math.min(6, r.h) : 6;
        if (r && r.h > 6) y0 = Math.max(r.y, Math.min(r.y + r.h - 6, u.y - 3));
        piece = { kind: 'barricade', x: x, y: y0, w: T, h: h, kit: true };
      } else {
        var y = u.y + (dy >= 0 ? gap : -gap - T), x0 = r ? r.x : u.x - 3, w = r ? Math.min(6, r.w) : 6;
        if (r && r.w > 6) x0 = Math.max(r.x, Math.min(r.x + r.w - 6, u.x - 3));
        piece = { kind: 'barricade', x: x0, y: y, w: w, h: T, kit: true };
      }
      spend(u, 'barrier');
      E.state.terrain.push(piece);
      logLine('note', u.label + ' throws up a Ballistic Barrier — a low wall ' + Math.max(piece.w, piece.h).toFixed(0) + '" long' + (foe ? ', facing ' + foe.label : '') + '.');
      repaintTerrain([{ piece: piece }]);
    }
    // after the move an incendiary or vacuum charge comes with: the section, picked off the board
    function afterKitMove(u, key) {
      var tg = throwTargets(u, key === 'vacuum');
      if (!tg.length) {
        logLine('note', u.label + ' finds nowhere within 6" to use its ' + (key === 'vacuum' ? 'Vacuum Charges' : 'Incendiary Grenades') + ' and keeps them.');
        return false;
      }
      ui.mode = 'throw-at'; ui.throwKey = key; ui.terrain = tg; ui.moves = []; ui.targets = [];
      setHint(null, 'Tap the section ' + u.name + ' throws its ' + (key === 'vacuum' ? 'Vacuum Charges' : 'Incendiary Grenades') + ' into.');
      render();
      return true;
    }
    function doThrow(r) {
      var u = ui.selected, key = ui.throwKey;
      ui.mode = 'idle'; ui.terrain = []; ui.throwKey = null;
      throwAt(u, r, key);
      u.activated = true;
      E.endActivation(u);
    }
    function throwAt(u, r, key) {
      spend(u, key);
      var d = R.d6();
      if (key === 'incendiary') {
        if (d === 1) logLine('note', u.label + '’s Incendiary Grenades fizzle in the ' + secName(r) + ' (D6 1).');
        else setBurning(r, u.label + '’s Incendiary Grenades (D6 ' + d + ')');
      } else {
        if (d === 1) logLine('note', u.label + '’s Vacuum Charges fail to smother the fire in the ' + secName(r) + ' (D6 1).');
        else putOut(r, 'is smothered by ' + u.label + '’s Vacuum Charges (D6 ' + d + ')');
      }
    }

    return {
      sectionOf: sectionOf, explodeSection: explodeSection, setBurning: setBurning, putOut: putOut, firingHazard: firingHazard,
      hazardsBeginning: hazardsBeginning, hazardsEnd: hazardsEnd,
      KIT: KIT, cleanKit: cleanKit, defaultKit: defaultKit, kitLeft: kitLeft, kitUsable: kitUsable, throwTargets: throwTargets,
      satchel: satchel, barrier: barrier, throwAt: throwAt, spendKit: spend, doThrow: doThrow, afterKitMove: afterKitMove,
      seerOf: seerOf, hiddenStop: hiddenStop, hiddenMove: hiddenMove, afterHiddenMove: afterHiddenMove,
      revealUnit: revealUnit, revealSweep: revealSweep, fireAtWill: fireAtWill, reactShot: reactShot,
      detectReveal: detectReveal, canDetect: canDetect,
      coverers: coverers, startCover: startCover, coverBy: coverBy, coverAt: coverAt,
      oppCheck: oppCheck, oppFire: oppFire
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineCounters;
})(typeof window !== 'undefined' ? window : global);
