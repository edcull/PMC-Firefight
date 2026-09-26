/* PMC 2670 — Firefight : input: taps, drags and keys on the board, the move preview, and the terrain tooltip.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCInput = function (B) {
    var chooseAction = B.chooseAction, curArea = B.curArea, deployNext = B.deployNext, deployOK = B.deployOK;
    var deployRoster = B.deployRoster, dispX = B.dispX, dispY = B.dispY, doAssault = B.doAssault;
    var doBreach = B.doBreach, doDemolish = B.doDemolish, doDesignate = B.doDesignate;
    var doDisembark = B.doDisembark, doEmbark = B.doEmbark, doEnter = B.doEnter, doExitBld = B.doExitBld;
    var doHack = B.doHack, doMarkMove = B.doMarkMove, doMove = B.doMove, doShoot = B.doShoot;
    var doSteady = B.doSteady, doStrafe = B.doStrafe, doSupport = B.doSupport, doTeleport = B.doTeleport;
    var doWave = B.doWave, finishTeleport = B.finishTeleport, garrisonAt = B.garrisonAt;
    var garrisonable = B.garrisonable, isAI = B.isAI, liftOf = B.liftOf;
    var lookAtDeployment = B.lookAtDeployment, moveBonus = B.moveBonus;
    var nearestDeploySpot = B.nearestDeploySpot, onTable = B.onTable, pickToDeploy = B.pickToDeploy;
    var placeInsertion = B.placeInsertion, relocTap = B.relocTap, select = B.select, send = B.send;
    var terrainAct = B.terrainAct, terrainTap = B.terrainTap, watchUnit = B.watchUnit, ISO = B.ISO, R = B.R;
    var SFX = B.SFX, UR = B.UR, cam = B.cam, el = B.el, ui = B.ui;
    // from modules installed after this one: looked up when called
    function closeDrawer() { return B.closeDrawer.apply(this, arguments); }
    function closeRes() { return B.closeRes.apply(this, arguments); }
    function drawBoard() { return B.drawBoard.apply(this, arguments); }
    function drawerEl() { return B.drawerEl.apply(this, arguments); }
    function esc() { return B.esc.apply(this, arguments); }
    function fitView() { return B.fitView.apply(this, arguments); }
    function handsOff() { return B.handsOff.apply(this, arguments); }
    function camLocked() { return B.camLocked.apply(this, arguments); }
    function insertionMine() { return B.insertionMine.apply(this, arguments); }
    function panBy() { return B.panBy.apply(this, arguments); }
    function render() { return B.render.apply(this, arguments); }
    function returnHome() { return B.returnHome.apply(this, arguments); }
    function setHint() { return B.setHint.apply(this, arguments); }
    function setZoom() { return B.setZoom.apply(this, arguments); }
    function tip() { return B.tip.apply(this, arguments); }
    function viewRect() { return B.viewRect.apply(this, arguments); }
    function slack() { return B.slack.apply(this, arguments); }
    function zoomAt() { return B.zoomAt.apply(this, arguments); }
    var nowMs = B.nowMs;

    /* ================= input ================= */
    // Three spaces: client (CSS px on the page), canvas (the 900x540 backing store)
    // and buffer (the pixel-art plate). Touch targets are sized in client px so a
    // fingertip works the same whether the board is 900px wide or 340.
    function canvasPoint(e) {
      if (e.__pt) return { x: e.__pt.x, y: e.__pt.y, scale: 1 };   // a synthetic tap, from a test
      var r = B.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / r.width * B.VIEW_W,
        y: (e.clientY - r.top) / r.height * B.VIEW_H,
        scale: r.width / B.VIEW_W                       // client px per canvas px
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
      B.state.units.forEach(function (u) {
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
      var path = R.pathTo(B.state, u, allowance, spot);
      var kind = R.terrainAt(B.state, spot.x, spot.y);
      var terr = R.TERRAIN[kind];
      // a ghost standing there, so the engine can be asked the same questions
      var ghost = {};
      for (var k in u) if (Object.prototype.hasOwnProperty.call(u, k)) ghost[k] = u[k];
      ghost.x = spot.x; ghost.y = spot.y;
      var seen = [], shots = [], watchers = [];
      B.state.units.forEach(function (o) {
        if (!onTable(o) || o.side === u.side) return;
        if (R.hasLoS(B.state, ghost, o)) seen.push(o);
        if (advance && R.canShoot(B.state, ghost, o, 'fire', {})) shots.push(o);
        // who would have the ghost in their sights, and in range, next activation
        if (o.fp && R.canShoot(B.state, o, ghost, 'fire', {})) watchers.push(o);
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
      var tk = R.terrainAt(B.state, p.x, p.y), t = R.TERRAIN[tk];
      var bits = [];
      var bp = t.enterable ? B.state.terrain.filter(function (r) { return r.kind === tk && R.inRect(p.x, p.y, r); })[0] : null;
      if (bp) {
        var bs = R.sectionsOf(bp), bi = 0;
        bs.forEach(function (q, n) { if (p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h) bi = n; });
        var occ = R.occupant(B.state, bp, bi), hi = R.sectionHigh(bp, bs[bi]);
        bits.push((tk === 'bunker' ? 'reinforced' : hi ? 'high' : 'low') + (bs.length > 1 ? ' · section ' + (bi + 1) + ' of ' + bs.length : ''));
        bits.push(occ ? 'held by ' + occ.label : 'empty — Enter from within 4"');
        bits.push('+2 Defence' + (hi ? ', +2 Firepower' : '') + ', no Crossfire inside');
      }
      else if (t.impassable) bits.push('impassable');
      bits = bits.concat(terrainBits(tk, !!bp));
      if (!bits.length) bits.push('no cover, no penalty');

      var extra = '';
      var obj = B.state.objectives.filter(function (o) { return R.inches(p.x, p.y, o.x, o.y) <= 4; })[0];
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
      var rw = tk === 'wall' && B.state.terrain.some(function (r) { return r.kind === 'wall' && r.reinforced && R.inRect(p.x, p.y, r); });
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
      if (!B.state || B.state.over || ui.resOpen) return;
      hideTerrainTip();
      var c = canvasPoint(e), p = ISO.toWorld(bufferFromCanvas(c).x, bufferFromCanvas(c).y);

      if (B.state.phase === 'terrain') { terrainTap(p); return; }
      // Dig in!: a tap round the gun chooses the way it faces
      if (ui.mode === 'digface' && ui.selected) {
        var dgx = p.x - dispX(ui.selected), dgy = p.y - dispY(ui.selected);
        if (Math.hypot(dgx, dgy) > 0.4) send({ k: 'digface', dir: Math.atan2(dgy, dgx) });
        return;
      }
      // a piece being put down or moved by hand
      if (B.state.placeAsk && !isAI(B.state.placeAsk.side)) { send({ k: 'placeat', x: p.x, y: p.y }); return; }
      // Terrorist: the tap nominates the piece to mine
      if (B.state.minePick && !isAI(B.state.minePick.side)) {
        var mpk = B.state.minePick.pool.filter(function (i) { return R.inRect(p.x, p.y, B.state.terrain[i]); })[0];
        if (mpk != null) send({ k: 'mine', i: mpk });
        return;
      }
      if (B.state.phase === 'deploy' && B.state.relocating) { relocTap(p); return; }
      if (B.state.phase === 'deploy') {
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
          var gOcc = R.occupant(B.state, gs.piece, gs.sec);
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
        var circleZone = B.state.sc.defCircle && pending.side === B.state.sc.defender;
        /* The engine forgives a near miss too, and by the same margin, but it
           cannot tell a near miss from a tap on the far side of the table — so
           a hopeless tap is answered here, where the camera is, rather than
           coming back as a refusal with nothing to look at. */
        var clear = deployOK(pending.side, p.x, p.y, pending) &&
          !R.TERRAIN[R.terrainAt(B.state, p.x, p.y)].impassable &&
          !R.unitNear(B.state, p.x, p.y, pending, 1);
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

      // the OpFor has been driving the camera: a tap on open ground gives it back —
      // once it has finished; while it is still moving, the view stays with it
      if (camLocked() && !hit) return;
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
      if (!B.state || e.pointerType === 'touch') return;
      ui.hover = worldFromEvent(e);
      if (ui.selected || B.state.phase === 'terrain') drawBoard();
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
      // the view follows the other side's move until it is done: the camera keys wait
      if (camLocked() && (/^[+=\-_0fF]$/.test(e.key) || e.key.indexOf('Arrow') === 0)) { e.preventDefault(); return; }
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
      if ((e.key === 'r' || e.key === 'R') && B.state && B.state.phase === 'terrain') {
        var ta = curArea();
        if (ta && B.seats.indexOf(ta.side) >= 0 && !isAI(ta.side) && B.state.tset.ghost) { terrainAct('trotate'); return; }
      }
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= B.STANDARD.length) chooseAction(B.STANDARD[n - 1].id);
    }



    /* The table itself, wired once at boot: a finger or the mouse button down
       and up again in place is a tap, down and moved is a drag of the camera,
       two fingers pinch the zoom, the wheel zooms about the pointer (or pans,
       sideways or with Shift), a right click turns the terrain piece in hand,
       and the keys and the zoom buttons do what they say. While the camera is
       following the other side's move (camLocked) none of it moves the view. */
    function wireTable(canvas) {
      var pointers = {}, pinch = null;
      var TAP_SLOP = 12;          // client px a finger may wander and still count as a tap
      var TAP_TIME = 700;         // ms

      function pointerList() {
        var out = [];
        for (var k in pointers) out.push(pointers[k]);
        return out;
      }

      canvas.addEventListener('pointerdown', function (e) {
        if (!B.state) return;
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
        } else if (list.length === 1 && !camLocked()) {
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
          if (camLocked()) return;                           // following the other side: no zooming it away
          var d = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
          if (d > pinch.d * 1.35) { setZoom(1); pinch.d = d; }
          else if (d < pinch.d * 0.74) { setZoom(-1); pinch.d = d; }
          return;
        }
        if (list.length === 1 && cam.drag && p.moved) {
          var sl = slack();
          var r = canvas.getBoundingClientRect(), scale = r.width / B.VIEW_W;
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
        if (!B.state) return;
        e.preventDefault();
        if (camLocked()) return;                              // following the other side's move
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
      canvas.addEventListener('mouseleave', function () { ui.hover = null; if (B.state) drawBoard(); });
      /* Laying terrain by hand, a right click turns the piece in hand a quarter —
         the same as R or the Turn it button, without taking the pointer off the
         spot it is about to go down on. Any other time the board is left alone. */
      canvas.addEventListener('contextmenu', function (e) {
        if (!B.state || B.state.phase !== 'terrain' || !B.state.tset || !B.state.tset.ghost) return;
        var ta = curArea();
        if (!ta || isAI(ta.side) || B.seats.indexOf(ta.side) < 0) return;
        e.preventDefault();
        terrainAct('trotate');
        if (SFX) SFX.click();
      });
      document.addEventListener('keydown', onKey);

      el('viewctl').addEventListener('click', function (e) {
        var b = e.target.closest('[data-zoom]'); if (!b || !B.state || camLocked()) return;
        var z = b.getAttribute('data-zoom');
        if (z === 'in') setZoom(1);
        else if (z === 'out') setZoom(-1);
        else fitView();
      });
    }

    return {
      bufferFromCanvas: bufferFromCanvas,
      cancelPreview: cancelPreview,
      canvasFromWorld: canvasFromWorld,
      canvasPoint: canvasPoint,
      commitMove: commitMove,
      hideTerrainTip: hideTerrainTip,
      movePreviewCard: movePreviewCard,
      onBoardMove: onBoardMove,
      onBoardTap: onBoardTap,
      onKey: onKey,
      previewMove: previewMove,
      terrainBits: terrainBits,
      wireTable: wireTable
    };
  };
})(window);
