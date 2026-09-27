/* PMC 2670 — Firefight : deployment: zones, reserves, garrisons, placing units, platforms and starting the battle

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineDeploy = function (E) {
    var H = E.H, R = E.R, SC = E.SC, UR = E.UR, W = E.W, abShoot = E.abShoot, aiRelocate = E.aiRelocate,
        beginTurn = E.beginTurn, boardableFor = E.boardableFor, byId = E.byId, docsOf = E.docsOf,
        finishRelocation = E.finishRelocation, focusUnit = E.focusUnit, fortify = E.fortify, isAI = E.isAI,
        loadBefore = E.loadBefore, logLine = E.logLine, lookAtDeployment = E.lookAtDeployment,
        nextPlace = E.nextPlace, other = E.other, pushRes = E.pushRes, relocCap = E.relocCap,
        render = E.render, revealBoard = E.revealBoard, revealConsole = E.revealConsole, setHint = E.setHint,
        sideName = E.sideName, ui = E.ui, unloadBefore = E.unloadBefore;

    function onTable(u) { return u.alive && u.x >= 0 && !u.aboard; }

    // troops riding inside are off the table entirely
    function activeUnits(side) {
      return E.state.units.filter(function (u) { return onTable(u) && (!side || u.side === side); });
    }

    // nothing has a zone until the scenario has laid out the deployment (after any army swaps)
    function zoneFor(side) { return SC.zoneFor(E.state, side); }

    // the scenario may use a circle rather than a strip
    function deployOK(side, x, y, u) {
      if (x < UR || y < UR || x > W - UR || y > H - UR) return false;
      var say = SC.deployOK(E.state, side, x, y, u);
      if (say !== null) return say;
      var bx = boxesFor(side);
      if (bx) return SC.inBoxes(bx, x, y);
      var z = zoneFor(side);
      return !!z && x >= z[0] && x <= z[1];
    }

    // some scenarios hand a side a set of rectangles rather than a strip or a circle
    function boxesFor(side) {
      return (E.state.sc && E.state.sc.boxes && E.state.sc.boxes[side]) || null;
    }

    function pointInBox(b) {
      return {
        x: Math.max(UR, Math.min(W - UR, b.x + Math.random() * b.w)),
        y: Math.max(UR, Math.min(H - UR, b.y + Math.random() * b.h))
      };
    }

    function inReserve(side) {
      return E.state.units.filter(function (u) {
        return u.alive && u.reserve && (!side || u.side === side);
      });
    }

    /* No more than half the army may come in by Battlefield Insertion (p. 56), so
       the rest of the insertion troops deploy in the strip like everyone else. */
    function markReserves(side) {
      if (SC.noInsertion(E.state)) return 0;             // the scenario forbids it
      var mine = E.state.units.filter(function (u) { return u.side === side; });
      var cap = Math.ceil(mine.length / 2);             // "no more than half", rounded up (p. 27)
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
      if (SC.noInsertion(E.state)) return false;
      if (p.x < 4 || p.y < 4 || p.x > W - 4 || p.y > H - 4) return false;
      for (var i = 0; i < E.state.objectives.length; i++) {
        if (R.inches(p.x, p.y, E.state.objectives[i].x, E.state.objectives[i].y) < 12) return false;
      }
      return !R.TERRAIN[R.terrainAt(E.state, p.x, p.y)].impassable;
    }

    /* The arrival point holds on 1-3; on 4-6 the opponent shoves it up to 2D6" in
       any direction, and the opponent naturally shoves it towards their own guns. */
    function scatterInsertion(u, after) {
      after = after || function () {};
      var die = R.d6();
      var tell = !isAI(u.side);                        // the OpFor's own drops just go in the log
      // Coordinated Hive (p. 124): the swarm re-rolls a failed die in the Reserve phase
      if (die >= 4 && E.state.doctrines && (E.state.doctrines[u.side] || []).indexOf('BB1') >= 0) {
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
        after();
        return;
      }
      var drift = R.d6() + R.d6();
      /* "...it can be moved by opponent up to 2D6 in any direction" (p. 56): a
         human opponent makes that call, on the table. */
      var foeSide = other(u.side);
      if (!isAI(foeSide) && !(E.state.solo && foeSide === 'A')) {
        var shoves = [];
        for (var sx = Math.floor(u.x - drift); sx <= u.x + drift; sx += 1) {
          for (var sy = Math.floor(u.y - drift); sy <= u.y + drift; sy += 1) {
            var sp = { x: sx, y: sy };
            if (R.inches(sp.x, sp.y, u.x, u.y) > drift) continue;
            if (sp.x < UR || sp.y < UR || sp.x > W - UR || sp.y > H - UR) continue;
            if (R.TERRAIN[R.terrainAt(E.state, sp.x, sp.y)].impassable) continue;
            if (R.unitNear(E.state, sp.x, sp.y, u, 1)) continue;
            shoves.push(sp);
          }
        }
        shoves.push({ x: u.x, y: u.y });                  // "up to": it may be left where it is
        logLine('note', u.label + ' inserts (D6 ' + die + '): ' + sideName(foeSide) + ' may shove it up to ' + drift + '".');
        ui.insertion = { unit: u, by: foeSide, done: after, spots: shoves, kind: 'shove', drift: drift, die: die };
        ui.selected = null; ui.mode = 'insert'; ui.targets = []; ui.moves = []; ui.terrain = [];
        focusUnit(u, false, true);
        setHint(null, 'D6 ' + die + ': move ' + u.name + '\u2019s arrival point up to ' + drift + '" — tap the shaded ground.');
        revealConsole();
        render();
        return;
      }
      // the enemy drags the marker towards their nearest gun; failing that, anywhere
      var foe = activeUnits(other(u.side)).filter(function (e) { return R.status(e) !== 'broken'; })
        .sort(function (a, b) { return R.inches(a.x, a.y, u.x, u.y) - R.inches(b.x, b.y, u.x, u.y); })[0];
      var ang = foe ? Math.atan2(foe.y - u.y, foe.x - u.x) : Math.random() * Math.PI * 2;
      var fixed = R.clampBoard({ x: u.x + Math.cos(ang) * drift, y: u.y + Math.sin(ang) * drift });
      for (var t = 0; t < 40 && (R.TERRAIN[R.terrainAt(E.state, fixed.x, fixed.y)].impassable
        || R.unitNear(E.state, fixed.x, fixed.y, u, 1)); t++) {
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
      after();
    }

    /* Arriving within 12" of the enemy invites a free shot from the closest
       unsuppressed enemy that can see them (p. 30). It is not an activation. */
    function greetArrival(u) {
      var best = null, bd = Infinity;
      activeUnits(other(u.side)).forEach(function (e) {
        if (R.status(e) !== 'ready' || e.fp === null) return;
        var d = R.unitDist(e, u);
        if (d > 12 || d > e.range) return;
        if (!R.hasLoS(E.state, e, u)) return;
        if (d < bd) { bd = d; best = e; }
      });
      if (!best) return null;
      var res = abShoot(E.state, best, u, 'basic', {});
      res.log.forEach(function (l) { logLine(l.t, l.text, l.math); });
      logLine('note', best.label + ' was waiting for them — ' + u.label + ' came down inside 12".');
      return { shooter: best, res: res };
    }

    /* Auto-deployment samples the ground the scenario actually gives this side —
       a circle around the objective, a set of edge bands, or a strip — and never
       the default strip, which for a circle defender is entirely illegal ground. */
    function autoDeploy(side, limit) {
      var circ = E.state.sc && E.state.sc.defCircle && E.state.sc.defender === side
        ? E.state.sc.defCircle : null;
      var boxes = circ ? null : boxesFor(side);
      var z = (circ || boxes) ? null : zoneFor(side);
      var waiting = E.state.units.filter(function (u) {
        return u.side === side && u.x < 0 && !u.reserve && !u.aboard;
      });
      if (limit != null) waiting = waiting.slice(0, limit);
      var keen = E.state.sc && E.state.sc.defender === side ? 0.85 : 0.5;
      waiting.forEach(function (u, i) {
        if (garrisonable(u) && Math.random() < keen) {
          var gsp = garrisonSpots(side, u);
          if (gsp.length) { var g = gsp[Math.floor(Math.random() * gsp.length)]; R.enterBuilding(E.state, u, g.piece, g.sec); return; }
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
          if (R.TERRAIN[R.terrainAt(E.state, x, y)].impassable) continue;
          if (R.unitNear(E.state, x, y, u, 1)) continue;
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
            if (R.TERRAIN[R.terrainAt(E.state, px, py)].impassable) continue;
            if (R.unitNear(E.state, px, py, u, 0.6)) continue;
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
      for (var i = 0; i < E.state.terrain.length; i++) {
        var r = E.state.terrain[i];
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
      E.state.terrain.forEach(function (r) {
        if (!R.enterable(r)) return;
        R.sectionsOf(r).forEach(function (q, n) {
          if (R.occupant(E.state, r, n)) return;
          if (!deployOK(side, q.x + q.w / 2, q.y + q.h / 2, u)) return;
          out.push({ piece: r, sec: n, rect: q });
        });
      });
      return out;
    }

    /* The middle of the ground a side has to deploy into: the centre of its strip,
       or of its circle when the scenario gives it one. */
    function zoneCentre(side) {
      var circ = E.state.sc && E.state.sc.defCircle;
      if (circ && E.state.sc.defender === side) return { x: circ.x, y: circ.y };
      var bx = boxesFor(side);
      if (bx && bx.length) return { x: bx[0].x + bx[0].w / 2, y: bx[0].y + bx[0].h / 2 };
      var z = zoneFor(side);
      if (!z) return { x: W / 2, y: H / 2 };
      return { x: (z[0] + z[1]) / 2, y: H / 2 };
    }

    // whichever side still has units in hand, and is not the OpFor
    function placingSide() {
      if (E.state.relocating) return E.state.relocating.side;
      var u = deployNext();
      return u ? u.side : null;
    }

    /* ---- which unit the next tap puts down ----
       A commander sets his line down in the order he likes, so the player picks:
       any unit still in hand, or one already placed, to shift it. Until he picks,
       it is simply the next one still in hand. */
    function deployRoster(side) {
      return E.state.units.filter(function (u) {
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
      if (!u || E.state.phase !== 'deploy') return;
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
      var circ = E.state.sc && E.state.sc.defCircle && E.state.sc.defender === u.side
        ? E.state.sc.defCircle : null;
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
          if (R.TERRAIN[R.terrainAt(E.state, px, py)].impassable) continue;
          if (R.unitNear(E.state, px, py, u, 1)) continue;
          var dd = Math.hypot(px - x, py - y);
          if (dd < bd) { bd = dd; best = { x: px, y: py }; }
        }
      }
      return best && bd <= (pull || 9) ? best : null;
    }

    // a Rapid insertion platform that nobody is riding down in (p. 79)
    function emptyPlatforms(side) {
      return E.state.units.filter(function (u) {
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

    /* ---- the scenario's split, the player's to change ----
       A scenario that holds part of a force back (Find and secure, Invasion,
       Demolish, Hostile takeover) splits it for them; before the battle the
       player may change which units go on the table and which wait, or which
       come down in the first wave and which the second, within the rule's
       numbers. The OpFor keeps the split it was given. */
    function splitFor(side) {
      var sp = E.state && E.state.sc && E.state.sc.split && E.state.sc.split[side];
      if (!sp || isAI(side) || E.state.phase !== 'deploy') return null;
      var units = sp.ids.map(byId).filter(function (u) { return u && u.alive; });
      function held(u) { return sp.kind === 'wave' ? u.wave === 2 : !!(u.reserve && u.wave === 2); }
      var n = units.filter(held).length;
      return {
        side: side, kind: sp.kind, rule: sp.rule, min: sp.min, max: sp.max, held: n,
        ok: n >= sp.min && n <= sp.max,
        units: units.map(function (u) {
          return { id: u.id, name: u.name, held: held(u), locked: R.has(u, 'Stationary Artillery'), aboard: !!u.aboard };
        })
      };
    }
    /* Seating the drop pods can take a squad the scenario held back: it rides in
       the pod now, and is no longer part of the choice. Whatever the split is
       once the table is ready is always within the rule's numbers. */
    function baselineSplits() {
      var all = (E.state.sc && E.state.sc.split) || {};
      Object.keys(all).forEach(function (side) {
        var sp = all[side];
        sp.ids = sp.ids.filter(function (id) { var u = byId(id); return u && u.alive && !u.aboard; });
        var n = sp.ids.map(byId).filter(function (u) { return sp.kind === 'wave' ? u.wave === 2 : (u.reserve && u.wave === 2); }).length;
        sp.min = Math.min(sp.min, n); sp.max = Math.max(sp.max, n);
      });
    }
    /* A player's split starts empty: who is held back (or goes in the second
       wave) is theirs to choose, and the battle waits until they have. What the
       scenario would have held is kept, for autoSplit to put back on request.
       The OpFor's split stands as the scenario made it. */
    function clearSplits() {
      var all = (E.state.sc && E.state.sc.split) || {};
      Object.keys(all).forEach(function (side) {
        if (isAI(side)) return;
        var sp = all[side];
        sp.auto = [];
        sp.ids.forEach(function (id) {
          var u = byId(id);
          if (!u) return;
          if (sp.kind === 'wave') { if (u.wave === 2) { sp.auto.push(id); u.wave = 1; } return; }
          if (u.reserve && u.wave === 2) { sp.auto.push(id); u.reserve = false; delete u.wave; u.x = -1; u.y = -1; }
        });
      });
    }
    // the scenario's own split, put back (the test harness's way through; the page never does it unasked)
    function autoSplit(side) {
      var sp = E.state.sc && E.state.sc.split && E.state.sc.split[side], f = splitFor(side);
      if (!sp || !f) return;
      (sp.auto || []).forEach(function (id) {
        var x = f.units.filter(function (w) { return w.id === id; })[0];
        if (x && !x.held) toggleHold(side, id);
      });
    }
    function splitsOK() {
      return ['A', 'B'].every(function (side) { var f = splitFor(side); return !f || f.ok; });
    }
    function toggleHold(side, id) {
      var sp = splitFor(side), u = byId(id);
      if (!sp || !u || sp.units.every(function (x) { return x.id !== id; })) return 'that unit is not part of the split';
      if (R.has(u, 'Stationary Artillery')) return 'an emplaced gun is never held back';
      if (sp.kind === 'wave') { u.wave = u.wave === 2 ? 1 : 2; return null; }
      if (u.reserve && u.wave === 2) {
        u.reserve = false; delete u.wave; u.x = -1; u.y = -1;      // back in hand, to be set down
        return null;
      }
      if (u.aboard) return 'take it out of the hull first';
      (u.cargo || []).slice().forEach(function (c) { unloadBefore(u, c); });
      if (u.bld) R.exitBuilding(E.state, u, null);
      u.reserve = true; u.wave = 2; u.x = -1; u.y = -1;
      if (ui.deployPick === u.id) ui.deployPick = null;
      return null;
    }

    function deploymentDone() {
      if (emptyPlatforms().length) return false;
      if (!splitsOK()) return false;
      return E.state.units.every(function (u) { return u.x >= 0 || u.aboard || u.reserve; });
    }

    function startBattle() {
      /* Rapid Relocation (O3, p. 87): once everyone is down, a side holding the
         doctrine may pick up to half the units it put on the table and set them
         down again, anywhere its deployment allows. No unit moves twice. */
      if (E.state.relocating) { finishRelocation(); return; }
      E.state.relocDone = E.state.relocDone || {};
      var rs = ['A', 'B'].filter(function (sd) {
        return !E.state.relocDone[sd] && docsOf(sd).indexOf('O3') >= 0 && relocCap(sd) > 0;
      });
      // the OpFor makes its choice at once; a player (or two, in hotseat) is asked in turn
      rs.sort(function (a, b) { return (isAI(b) ? 1 : 0) - (isAI(a) ? 1 : 0); });
      for (var ri = 0; ri < rs.length; ri++) {
        var sd = rs[ri];
        E.state.relocDone[sd] = true;
        if (isAI(sd)) { aiRelocate(sd); continue; }
        E.state.relocating = { side: sd, cap: relocCap(sd), moved: [] };
        ui.deployPick = null;
        logLine('note', sideName(sd) + ' — Rapid Relocation: up to ' + E.state.relocating.cap + ' units may be moved.');
        lookAtDeployment(sd);
        setHint(null, 'Rapid Relocation: tap one of your units, then tap where it should go — up to ' +
          E.state.relocating.cap + ' of them. Begin the battle when you are done.');
        render();
        return;
      }
      /* Fortify and Strike! (p. 141): once the tribe is deployed, a player puts
         down its four field fortifications by hand before the first turn. */
      E.state.fortAsked = E.state.fortAsked || {};
      var fs = ['A', 'B'].filter(function (sd) { return docsOf(sd).indexOf('XO5') >= 0 && !isAI(sd) && !E.state.fortAsked[sd]; })[0];
      if (fs) {
        E.state.fortAsked[fs] = true;
        E.state.placeQueue = [{ side: fs, kind: 'barricade', why: 'fortify', left: 4, total: 4, len: 3, then: 'battle' }];
        nextPlace();
        return;
      }
      E.state.phase = 'battle';
      ['A', 'B'].forEach(function (side) { if (docsOf(side).indexOf('XO5') >= 0 && isAI(side)) fortify(side); });
      // Ambush!: each unit settles into its hide before the first turn (p. 156)
      if (E.state.scen.beforeBattle) {
        var moved = E.state.scen.beforeBattle(E.state) || [];
        moved.forEach(function (l) { logLine('note', l.text); });
        if (moved.length) pushRes({ kind: 'Deployment', title: 'Taking cover', note: E.state.scen.name + ': each unit rolls a D6 as it finds its hiding place.', list: moved });
      }
      beginTurn(); revealBoard();
    }

    return {
      onTable: onTable, activeUnits: activeUnits, zoneFor: zoneFor, deployOK: deployOK, boxesFor: boxesFor,
      inReserve: inReserve, markReserves: markReserves, insertionLegal: insertionLegal,
      scatterInsertion: scatterInsertion, greetArrival: greetArrival, autoDeploy: autoDeploy,
      garrisonAt: garrisonAt, garrisonable: garrisonable, garrisonSpots: garrisonSpots,
      zoneCentre: zoneCentre, placingSide: placingSide, deployRoster: deployRoster, deployNext: deployNext,
      pickToDeploy: pickToDeploy, nearestDeploySpot: nearestDeploySpot, emptyPlatforms: emptyPlatforms,
      seatPlatforms: seatPlatforms, splitFor: splitFor, baselineSplits: baselineSplits,
      toggleHold: toggleHold, deploymentDone: deploymentDone, startBattle: startBattle,
      clearSplits: clearSplits, autoSplit: autoSplit, splitsOK: splitsOK
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineDeploy;
})(typeof window !== 'undefined' ? window : global);
