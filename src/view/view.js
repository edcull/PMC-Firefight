/* PMC 2670 — Firefight : the view: the camera and zoom, the company colours and the header.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCView = function (B) {
    var bufferFromCanvas = B.bufferFromCanvas, busy = B.busy, curArea = B.curArea, deployNext = B.deployNext;
    var dispX = B.dispX, dispY = B.dispY, drawBoard = B.drawBoard, hideTerrainTip = B.hideTerrainTip;
    var liftOf = B.liftOf, myTurn = B.myTurn, other = B.other, playerSide = B.playerSide, roleOf = B.roleOf;
    var scoreObjectives = B.scoreObjectives, sideName = B.sideName, sizeView = B.sizeView;
    var soloOwnerName = B.soloOwnerName, whenIdle = B.whenIdle, ISO = B.ISO, K = B.K, R = B.R, SFX = B.SFX;
    var ZOOMS = B.ZOOMS, cam = B.cam, el = B.el, resQueue = B.resQueue, show = B.show, ui = B.ui;
    // from modules installed after this one: looked up when called
    function colourPop() { return B.colourPop.apply(this, arguments); }
    function demoRename() { return B.demoRename.apply(this, arguments); }
    function drawBar() { return B.drawBar.apply(this, arguments); }
    function drawLog() { return B.drawLog.apply(this, arguments); }
    function drawPanel() { return B.drawPanel.apply(this, arguments); }
    function drawStats() { return B.drawStats.apply(this, arguments); }
    function esc() { return B.esc.apply(this, arguments); }
    function isDemoName() { return B.isDemoName.apply(this, arguments); }
    function isMadeUpName() { return B.isMadeUpName.apply(this, arguments); }
    function musterFaction() { return B.musterFaction.apply(this, arguments); }

    /* ---------- camera ---------- */
    function viewRect() {
      var z = cam.z;
      var sw = Math.min(ISO.PIXW, Math.round(B.VIEW_W / z));
      var sh = Math.min(ISO.PIXH, Math.round(B.VIEW_H / z));
      return {
        z: z, sw: sw, sh: sh,
        sx: Math.max(0, Math.min(ISO.PIXW - sw, Math.round(cam.x - sw / 2))),
        sy: Math.max(0, Math.min(ISO.PIXH - sh, Math.round(cam.y - sh / 2))),
        dx: Math.round((B.VIEW_W - sw * z) / 2 + (cam.ox || 0)),
        dy: Math.round((B.VIEW_H - sh * z) / 2 + (cam.oy || 0))
      };
    }
    /* A line on the ground in a side's colour gets a dark edge under it. On
       soil the colour carries it; on sand or snow — desert ochre on desert sand —
       it is the edge that shows. The dash pattern is kept for both strokes. */
    function edgedStroke(dark) {
      var col = B.ctx.strokeStyle, lw = B.ctx.lineWidth;
      B.ctx.strokeStyle = 'rgba(8,10,14,' + (dark == null ? 0.45 : dark) + ')';
      B.ctx.lineWidth = lw + 2;
      B.ctx.stroke();
      B.ctx.strokeStyle = col; B.ctx.lineWidth = lw;
      B.ctx.stroke();
    }
    // what a unit's label carries beside its code: a star for honours held, a heart for traumas carried
    function labelIcons(u) {
      var c = u && u.camp;
      return { star: !!(c && (c.honours || []).length), heart: !!(c && (c.traumas || []).length) };
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
      for (var i = 0; i < B.anims.length; i++) B.anims[i].follow = false;
    }

    function setHome(x, y) {
      cam.home = { x: x, y: y, z: cam.z };
      cam.borrowed = false;
      dropFollow();
      updateReturnHint();
    }
    function borrowCamera() {
      if (!B.state || B.state.cfg.aiSides.length === 2) return;   // in a demo nobody is waiting for it
      if (cam.borrowed) return;
      cam.borrowed = true;
      updateReturnHint();
    }
    /* The camera goes over to the other side's unit as it activates. Once that
       side is done — nothing left to draw, no card up, and it is this screen's
       turn again — it waits a second, then comes back to where the player left it. */
    var RETURN_AFTER = 1000;
    function scheduleReturn() {
      function cancel() { if (ui.retTimer) { clearTimeout(ui.retTimer); ui.retTimer = 0; } }
      if (!cam.borrowed || !cam.home || handsOff() || !B.state || B.state.over) { cancel(); return; }
      if (busy()) { cancel(); if (!ui.retIdle) { ui.retIdle = true; whenIdle(function () { ui.retIdle = false; scheduleReturn(); }); } return; }
      if (!myTurn() || ui.resOpen || resQueue.length || show.queue.length) { cancel(); return; }
      if (ui.retTimer) return;
      ui.retTimer = setTimeout(function () {
        ui.retTimer = 0;
        if (cam.borrowed && myTurn() && !ui.resOpen && !busy() && !show.queue.length) returnHome(true);
      }, RETURN_AFTER);
    }
    function returnHome(quiet) {
      if (!cam.home) return;
      if (cam.home.z !== cam.z) { cam.z = cam.home.z; zoomLabel(); }
      cam.borrowed = false;
      dropFollow();
      updateReturnHint();
      centreOn(cam.home.x, cam.home.y);
      if (SFX && !quiet) SFX.click();
    }
    function updateReturnHint() {
      var h = el('returnhint');
      if (h) h.hidden = !cam.borrowed;
    }

    /* How much empty frame there is around the table on each axis, in screen pixels.
       Zoomed right out the table is narrower than the window, and this is the room
       the player has to slide it about in. */
    function slack() {
      var sw = Math.min(ISO.PIXW, Math.round(B.VIEW_W / cam.z));
      var sh = Math.min(ISO.PIXH, Math.round(B.VIEW_H / cam.z));
      return {
        x: Math.max(0, (B.VIEW_W - sw * cam.z) / 2),
        y: Math.max(0, (B.VIEW_H - sh * cam.z) / 2)
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
    /* In a demo the camera is the watcher's: nothing the AI does moves it, not
       a unit activating, landing or on the move — only the watcher pans and zooms. */
    function handsOff() { return !!(B.state && B.state.cfg && B.state.cfg.mode === 'demo'); }
    function focusUnit(u, instant, borrowed) {
      if (!u || u.x < 0 || handsOff()) return;
      var p = ISO.toScreen(dispX(u), dispY(u));
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
      var kind = R.terrainOf(B.state, u);
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
      var src = open ? B.state.structsOpen : B.state.structs;
      if (!src) return;
      var b = propBox(pr);
      if (b.w <= 0 || b.h <= 0) return;
      B.pctx.drawImage(src, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    }

    /* ---------- company colours ----------
       A mercenary outfit that wants its work recognised paints its kit. The player
       picks; the opposition takes one of the colours left, so no two companies on
       the table are ever the same. */
    function drawColourPick() {
      var host = el('colourpick');
      if (!host) return;
      if (!B.muster.colour) {
        try { B.muster.colour = localStorage.getItem('pmc-colour') || 'ochre'; } catch (e) { B.muster.colour = 'ochre'; }
        if (!ISO.COLOURS[B.muster.colour]) B.muster.colour = 'ochre';
      }
      // in a hotseat muster the second player cannot wear the first player's colour
      var taken = B.muster.hot && B.muster.hot.step === 2 && B.muster.hot.sides[0] ? B.muster.hot.sides[0].colour : null;
      // a square each, as the unit viewer has them, and the colour picked named in the label
      host.innerHTML = ISO.COLOUR_KEYS.map(function (k) {
        var c = ISO.COLOURS[k];
        return '<button type="button" class="' + (k === B.muster.colour ? 'on' : '') +
          '" data-colour="' + k + '" title="' + c.name + (k === taken ? ' \u2014 Player 1\u2019s colour' : '') + '"' +
          (k === taken ? ' disabled' : '') + '>' +
          '<span style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' +
          c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span></button>';
      }).join('');
      colourLabel();
      var chip = el('colour-btn-chip'), cc = ISO.COLOURS[B.muster.colour];
      if (chip && cc) chip.style.background = 'linear-gradient(135deg,' + cc.light + ' 0 38%,' + cc.mid + ' 38% 74%,' + cc.dark + ' 74%)';
      if (el('btn-colour-pop') && cc) el('btn-colour-pop').title = 'Colours: ' + cc.name;
      host.querySelectorAll('[data-colour]').forEach(function (b) {
        b.addEventListener('click', function () {
          B.muster.colour = b.getAttribute('data-colour'); B.muster.colourChosen = true;
          // only the first player's choice is remembered as "your" colour
          if (!B.muster.hot || B.muster.hot.step === 1) { try { localStorage.setItem('pmc-colour', B.muster.colour); } catch (e2) { } }
          if (SFX) SFX.click();
          // its name is its colour: a demo force's, and the AI opposition's until someone types one
          var nm0 = ((el('hot-name') && el('hot-name').value) || '').trim();
          if (B.muster.hot && (B.muster.hot.kind === 'demo' || (B.muster.hot.kind === 'ai' && B.muster.hot.step === 2)) && (!nm0 || isDemoName(nm0))) demoRename();
          // a made-up name follows the colour
          if (B.muster.hot && B.muster.hot.kind !== 'demo' && !(B.muster.hot.kind === 'ai' && B.muster.hot.step === 2)) {
            var hn = el('hot-name'), nm = ((hn && hn.value) || '').trim();
            if (!nm || isMadeUpName(nm)) { B.muster.name = ISO.COLOURS[B.muster.colour].name + ' ' + B.FORCE_NOUN[musterFaction()]; if (hn) hn.value = B.muster.name; }
          }
          colourPop(false);                  // the pick shuts the pop-up
          drawColourPick();
        });
      });
    }
    // "Tribe colours — Jade": the kind of force's word in a stepped skirmish, and the colour picked
    function colourLabel() {
      var lb = el('colour-box-label'), c = ISO.COLOURS[B.muster.colour];
      if (!lb) return;
      var n = B.muster.hot ? (B.ID_NOUN[musterFaction()] || 'Force') : 'Company';
      lb.textContent = n + ' colours' + (c ? ' \u2014 ' + c.name : '');
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
      if (!B.state) return;
      if (B.state.phase === 'battle') scoreObjectives();
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
      // two players at one screen: the phone's one-row header shows whose turn it is too
      var hdrEl = document.querySelector('header');
      if (hdrEl) hdrEl.classList.toggle('two-seat', B.state.cfg.mode === 'hotseat' || !!(B.state.solo && B.state.solo.coop));
      syncHeaderHeight();
      // the phone's turn counter, a fixed width at the right of its one-row header
      if (el('hdr-turn')) el('hdr-turn').textContent = B.state.phase === 'terrain' ? 'Setup' : B.state.phase === 'deploy' ? 'Deploy' : 'Turn ' + B.state.turn;
      el('hdr-phase').textContent = B.state.phase === 'terrain' ? 'Terrain set-up' : B.state.phase === 'deploy' ? 'Deployment' : 'Turn ' + B.state.turn + ' · Action phase';
      el('hdr-init').textContent = B.state.initiative ? 'Initiative ' + B.state.initiative : '—';
      var act = el('hdr-active');
      if (B.state.over) {
        act.textContent = B.state.over.winner ? 'Victory: ' + B.state.over.winner : 'Draw';
        act.className = 'pill pill-' + (B.state.over.winner || 'none');
      } else if (B.state.phase === 'terrain') {
        var ta = curArea();
        act.textContent = ta ? 'Terrain: ' + ta.name : 'Terrain';
        act.className = 'pill pill-' + (ta ? ta.side : 'A');
      } else if (B.state.phase === 'deploy') {
        // in a hotseat the header says whose turn it is to place a unit
        var dn = B.state.cfg.mode === 'hotseat' ? deployNext() : null;
        var nm = function (sd) { return sd === 'A' ? B.state.cfg.nameA : B.state.cfg.nameB; };
        if (B.state.swapStage && B.state.swapAsk) { act.textContent = 'Modifying: ' + nm(B.state.swapAsk.side); act.className = 'pill pill-' + B.state.swapAsk.side; }
        else if (dn) { act.textContent = 'Deploying: ' + nm(dn.side); act.className = 'pill pill-' + dn.side; }
        else { act.textContent = 'Deploy your force'; act.className = 'pill pill-A'; }
      } else if (ui.insertion) {
        /* The game is waiting for a place on the table and nothing else. That has
           to be legible from the header, because the prompt itself sits in a panel
           that a phone can have scrolled past or hidden behind another tab. */
        act.textContent = ui.insertion.kind === 'arrive'
          ? 'Place your reinforcements' : ui.insertion.kind === 'shove' ? 'Shove the enemy drop'
            : ui.insertion.kind === 'ilz' ? 'Nominate landing zone ' + ui.insertion.n + ' of 3' : 'Pick a landing zone';
        act.className = 'pill pill-wait';
      } else if (B.state.solo) {
        if (B.state.activeSide === 'B') { act.textContent = 'OpFor phase'; act.className = 'pill pill-B'; }
        else {
          act.textContent = B.state.solo.coop ? soloOwnerName(B.state.activeOwner) + ' to act' : 'Your commando';
          act.className = 'pill pill-' + (B.state.solo.coop ? (B.state.activeOwner === 2 ? 'C' : 'P1') : 'A');
        }
      } else {
        act.textContent = 'Activating: ' + sideName(B.state.activeSide);
        act.className = 'pill pill-' + B.state.activeSide;
      }
      if (B.state.solo && B.state.phase !== 'deploy' && B.state.phase !== 'terrain') {
        el('hdr-phase').textContent = 'Turn ' + B.state.turn + ' · ' + (B.state.activeSide === 'B' ? 'OpFor phase' : 'Action phase');
        el('hdr-init').textContent = B.state.scen.name;
      }
      var held = { A: 0, B: 0 };
      B.state.objectives.forEach(function (o) { if (o.owner) held[o.owner]++; });
      el('hdr-obj').innerHTML = 'Objectives <b>' + held.A + '</b>–<b>' + held.B + '</b>';
      // in the three asymmetric scenarios, which side of it the player is on
      var rl = el('hdr-role');
      if (rl) {
        var you = playerSide(), r = roleOf(you);
        if (r) {
          rl.hidden = false;
          rl.textContent = r === 'attacker' ? 'You attack' : 'You defend';
          rl.className = 'meta role role-' + r;
        } else if (B.state.sc && B.state.sc.attacker) {
          rl.hidden = false;
          rl.textContent = (B.state.cfg[B.state.sc.attacker === 'A' ? 'nameA' : 'nameB']) + ' attacks';
          rl.className = 'meta role role-attacker';
        } else { rl.hidden = true; }
      }
    }

    /* The Objectives button: the scenario, which side attacks and which defends
       (or that both are after the same thing), what wins it, and who holds each
       objective now. */
    function objectivesHTML() {
      var sc = B.state.scen || {}, h = '<h3>' + esc(sc.name || 'Scenario') + '</h3>';
      if (sc.blurb) h += '<p>' + esc(sc.blurb) + '</p>';
      function side(s, role) {
        var pal = ISO.PALETTE[s] || {};
        return '<div><b style="color:' + (pal.light || 'inherit') + '">' + esc(sideName(s)) + '</b><span>' + role + '</span></div>';
      }
      var att = B.state.sc && B.state.sc.attacker;
      h += '<div class="objroles">' + (att
        ? side(att, 'Attacker') + side(other(att), 'Defender')
        : side('A', B.state.solo ? 'Your side' : 'Side A') + side('B', B.state.solo ? 'OpFor' : 'Side B')) + '</div>';
      if (sc.win) h += '<p><b>To win:</b> ' + esc(sc.win) + '</p>';
      if (B.state.objectives.length) {
        h += '<ul>' + B.state.objectives.map(function (o, i) {
          return '<li>Objective ' + (i + 1) + ' — ' + (o.owner ? 'held by <b>' + esc(sideName(o.owner)) + '</b>' : 'nobody holds it') + '</li>';
        }).join('') + '</ul>';
      }
      if (sc.hint) h += '<p class="hint small">' + esc(sc.hint) + '</p>';
      if (sc.turns) h += '<p class="hint small">At most ' + sc.turns + ' turns.</p>';
      return h + '<div class="askrow"><button type="button" class="start" id="obj-done">Done</button></div>';
    }
    function openObjectives() {
      if (!B.state) return;
      el('obj-box').innerHTML = objectivesHTML();
      el('obj-modal').hidden = false;
      if (SFX) SFX.click();
    }

    return {
      TERRAIN_MARK: TERRAIN_MARK,
      borrowCamera: borrowCamera,
      centreOn: centreOn,
      clampCam: clampCam,
      colourLabel: colourLabel,
      drawColourPick: drawColourPick,
      dropFollow: dropFollow,
      edgedStroke: edgedStroke,
      ensureVisible: ensureVisible,
      fitView: fitView,
      focusUnit: focusUnit,
      foeColour: foeColour,
      handsOff: handsOff,
      hud: hud,
      labelIcons: labelIcons,
      nearestZoom: nearestZoom,
      openObjectives: openObjectives,
      panBy: panBy,
      propBox: propBox,
      render: render,
      repaintProp: repaintProp,
      returnHome: returnHome,
      scheduleReturn: scheduleReturn,
      setHome: setHome,
      setZoom: setZoom,
      sideInk: sideInk,
      sideRGB: sideRGB,
      slack: slack,
      terrainMark: terrainMark,
      viewRect: viewRect,
      zoomAt: zoomAt,
      zoomLabel: zoomLabel
    };
  };
})(window);
