/* PMC 2670 — Firefight : the table drawn: the board, its terrain and structures, the heat haze, and every unit and marker on it.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCDraw = function (B) {
    var activeUnits = B.activeUnits, addFx = B.addFx, arrivalQueued = B.arrivalQueued, arriving = B.arriving;
    var boxesFor = B.boxesFor, clonePiece = B.clonePiece, curArea = B.curArea, dispX = B.dispX;
    var dispY = B.dispY, drawFx = B.drawFx, fitGhost = B.fitGhost, insertionMine = B.insertionMine;
    var isAI = B.isAI, liftOf = B.liftOf, nowMs = B.nowMs, onTable = B.onTable, placingSide = B.placingSide;
    var shownAs = B.shownAs, unitById = B.unitById, zoneFor = B.zoneFor, FX = B.FX, H = B.H, ISO = B.ISO;
    var K = B.K, R = B.R, SFX = B.SFX, UR = B.UR, W = B.W, cam = B.cam, ui = B.ui;
    // from modules installed after this one: looked up when called
    function drawOdds() { return B.drawOdds.apply(this, arguments); }
    function edgedStroke() { return B.edgedStroke.apply(this, arguments); }
    function hud() { return B.hud.apply(this, arguments); }
    function labelIcons() { return B.labelIcons.apply(this, arguments); }
    function oddsOn() { return B.oddsOn.apply(this, arguments); }
    function propBox() { return B.propBox.apply(this, arguments); }
    function render() { return B.render.apply(this, arguments); }
    function repaintProp() { return B.repaintProp.apply(this, arguments); }
    function roundRect() { return B.roundRect.apply(this, arguments); }
    function sideInk() { return B.sideInk.apply(this, arguments); }
    function sideRGB() { return B.sideRGB.apply(this, arguments); }
    function terrainMark() { return B.terrainMark.apply(this, arguments); }
    function viewRect() { return B.viewRect.apply(this, arguments); }

    /* ---------- board ---------- */
    var SS = 1;       // how finely this frame is drawn, in buffer pixels a plate pixel (see DPR, at the top)
    /* The table is painted onto two plates: the ground, which is expensive to bake
       and never changes, and the structures, which are cheap and have to be repainted
       whenever something is knocked down. */
    function buildScene() {
      B.state.ground = ISO.bakeGround(B.state.terrain, B.state.seed, B.state.cfg.planet);
      B.state.structs = document.createElement('canvas');
      B.state.structs.width = ISO.PIXW; B.state.structs.height = ISO.PIXH;
      paintStructures();
      B.state.scene = B.state.ground;
      if (B.state.tset && B.state.phase === 'terrain') B.state.tset.baked = B.state.terrain.length;
    }

    function paintStructures() {
      B.state.props = ISO.buildProps(B.state.terrain, B.state.objectives, B.state.seed, B.state.cfg.planet);
      var sg = B.state.structs.getContext('2d');
      sg.clearRect(0, 0, B.state.structs.width, B.state.structs.height);
      B.state.props.forEach(function (p) { ISO.drawProp(sg, p, liftOf(p.x, p.y)); });
      /* And the same table again with every building cut away — the near walls off
         so you can see into the room. A building with somebody inside it, or with
         somebody behind it, is composited from this layer instead of the solid
         one, which is what lets the player see the troops a wall would hide. */
      B.state.structsOpen = document.createElement('canvas');
      B.state.structsOpen.width = ISO.PIXW; B.state.structsOpen.height = ISO.PIXH;
      var og = B.state.structsOpen.getContext('2d');
      og.clearRect(0, 0, B.state.structsOpen.width, B.state.structsOpen.height);
      B.state.props.forEach(function (p) { ISO.drawProp(og, p, liftOf(p.x, p.y), true); });
    }

    /* Something has come down: repaint the structures and let the player see it. */
    function repaintTerrain(wrecks) {
      if (!wrecks || !wrecks.length || !B.state.structs) return;
      paintStructures();
      ui.vis = null; ui.visKey = '';
      wrecks.forEach(function (w) {
        var r = w.piece;
        addFx({
          kind: 'collapse', x: r.x + r.w / 2, y: r.y + r.h / 2,
          r: Math.max(1.5, Math.max(r.w, r.h) * 0.7), dur: 900
        });
      });
      if (SFX && SFX.broken) SFX.broken();
      render();
    }

    function syncRemains() {
      if (!B.state || !B.state.units) return;
      var rem = B.state.remains || (B.state.remains = []);
      B.state.units.forEach(function (u0) {
        // as it is drawn: the dead fall when the shot that kills them lands, not before
        var u = shownAs(u0);
        var seen = u0._seen, here = u.alive && u.x >= 0 && !u.aboard;
        if (seen && seen.here) {
          if (R.isMachine(u)) {
            if (!u.alive && !u.fled && !u0._wrecked) {
              u0._wrecked = true;
              // a snapshot, so the wreck stays a wreck even if the unit itself is used again
              var snap = {};
              for (var k in u) snap[k] = u[k];
              snap.alive = false; snap.cargo = []; snap.damage = 0; snap.marked = false;
              rem.push({ kind: 'wreck', id: u.id, x: seen.x, y: seen.y, snap: snap, t0: Math.floor(Math.random() * 5000) });
            }
          } else {
            var left = u.alive ? (u.models || 0) : u.fled ? seen.models : 0;
            for (var n = seen.models; n > left; n--) {
              var cs = ISO.casualtySpot(u, n, rem.length * 7 + n);
              rem.push({ kind: 'body', x: seen.x, y: seen.y, dx: cs.dx, dy: cs.dy, side: u.side, paint: u.paint || null,
                art: u.art, mi: cs.mi, flip: (rem.length % 3 === 0) !== !!u.faceL });
              // the last of a gun crew to fall leaves the gun behind, knocked out where it stood
              if (n === 1 && left === 0 && ISO.hasPiece && ISO.hasPiece(u.art)) {
                rem.push({ kind: 'body', piece: true, x: seen.x, y: seen.y, dx: 0, dy: 0, side: u.side, paint: u.paint || null,
                  art: u.art, key: u.key, aim: u.facing, flip: !!u.faceL });
              }
            }
          }
        }
        u0._seen = { here: here, x: u.x, y: u.y, models: u.models || 0 };
        // a unit the engine has sent back to the OpFor pool is off the table now
        if (u.wave === 'pool' && u.x < 0) u0._seen = { here: false, x: -1, y: -1, models: u.models };
      });
      // the table only holds so many; the oldest dead go first, never a wreck
      var bodies = rem.filter(function (r) { return r.kind === 'body'; });
      if (bodies.length > 240) {
        var drop = bodies.slice(0, bodies.length - 240);
        B.state.remains = rem.filter(function (r) { return drop.indexOf(r) < 0; });
      }
    }
    /* Between moves the board is still: it is only redrawn while something on
       screen is alive by itself. A burning wreck flickers well enough at about
       eight frames a second; heat haze is a slow ripple, and at that rate it
       steps rather than flows, so lava in view gets about sixteen. */
    var ambientTick = 0;
    setInterval(function () {
      if (!B.state || !B.state.scene || B.loop || document.hidden) return;
      ambientTick++;
      // an aircraft keeps its rotors turning and scanners sweeping, a Beta's deflector breathes, a cloak shimmers
      var flying = B.state.units.some(function (u) { return !u.aboard && u.x >= 0 && ISO.animates(u); });
      if (B.state.hazeOnView || flying || (B.state.fireOnView && ambientTick % 2 === 0)) drawBoard();
    }, 60);

    /* ================= heat haze =================
       The air over a lava field shimmers. The ground under and just above the
       melt is taken back off the frame and laid down again in bands a pixel
       tall, each pushed sideways by a ripple that drifts upward, the way hot air
       rises — strongest at the melt, fading to nothing a couple of inches up.

       It is done to the terrain only, before any unit or prop is drawn, so the
       ground wavers while the troops standing by it stay sharp enough to read.
       The offsets are whole pixels, so the pixel art is never smeared, and it is
       left out entirely for a player whose system asks for less motion. */
    var hazeBuf = null, hazeCtx = null;
    // a new table: the haze buffer is made again, the size the new view wants
    function dropHaze() { hazeBuf = null; hazeCtx = null; }
    var calmMotion = false;
    try { calmMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { }

    // the outline round a set of points, for clipping the shimmer to the air over the melt
    function hull(pts) {
      pts = pts.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
      if (pts.length < 3) return pts;
      function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
      var lo = [], up = [];
      pts.forEach(function (p) {
        while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
        lo.push(p);
      });
      for (var i = pts.length - 1; i >= 0; i--) {
        var p = pts[i];
        while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
        up.push(p);
      }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    }

    function heatHaze(v) {
      B.state.hazeOnView = false;
      if (calmMotion || !B.state.terrain) return;
      var lavas = B.state.terrain.filter(function (r) { return r.kind === 'lava' && !r.wrecked; });
      if (!lavas.length) return;
      var t = nowMs() / 1000;
      var rise = K * 2.2;                 // how high over the melt the air still wavers, in plate pixels
      var AMP = 1.3;                      // the widest sway, in plate pixels: heat haze, not an earthquake

      lavas.forEach(function (r, li) {
        var foot = (r.poly || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])
          .map(function (q) { return ISO.toScreen(q[0], q[1]); });
        // the melt, and the same outline lifted: the column of hot air standing over it
        var shape = hull(foot.concat(foot.map(function (p) { return { x: p.x, y: p.y - rise }; })));
        var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        shape.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
        var meltTop = Math.min.apply(null, foot.map(function (p) { return p.y; }));
        // only what is in the window, with room either side for the sway
        var bx0 = Math.max(v.sx, Math.floor(x0 - AMP - 1)), bx1 = Math.min(v.sx + v.sw, Math.ceil(x1 + AMP + 1));
        var by0 = Math.max(v.sy, Math.floor(y0)), by1 = Math.min(v.sy + v.sh, Math.ceil(y1));
        if (bx1 <= bx0 || by1 <= by0) return;
        B.state.hazeOnView = true;

        // the patch as it stands, in the window's own pixels
        var px0 = Math.round((bx0 - v.sx) * SS), py0 = Math.round((by0 - v.sy) * SS);
        var pwid = Math.round((bx1 - bx0) * SS), phei = Math.round((by1 - by0) * SS);
        if (pwid < 1 || phei < 1) return;
        if (!hazeBuf) { hazeBuf = document.createElement('canvas'); hazeCtx = hazeBuf.getContext('2d'); }
        if (hazeBuf.width < pwid || hazeBuf.height < phei) {
          hazeBuf.width = Math.max(hazeBuf.width, pwid); hazeBuf.height = Math.max(hazeBuf.height, phei);
        }
        hazeCtx.setTransform(1, 0, 0, 1, 0, 0);
        hazeCtx.clearRect(0, 0, pwid, phei);
        hazeCtx.drawImage(B.pix, px0, py0, pwid, phei, 0, 0, pwid, phei);

        B.pctx.save();
        // clip to the column of air, in plate coordinates, then work in the window's pixels
        B.pctx.beginPath();
        shape.forEach(function (p, n) { if (n) B.pctx.lineTo(p.x, p.y); else B.pctx.moveTo(p.x, p.y); });
        B.pctx.closePath();
        B.pctx.clip();
        B.pctx.setTransform(1, 0, 0, 1, 0, 0);
        B.pctx.imageSmoothingEnabled = false;
        var band = Math.max(1, Math.round(SS));           // a plate pixel tall
        var seed = li * 1.7;                              // no two fields ripple in step
        for (var yy = 0; yy < phei; yy += band) {
          var plateY = by0 + yy / SS;
          // full strength over the melt and just above it, dying away to the top of the column
          var k = plateY >= meltTop ? 0.75 : Math.max(0, 1 - (meltTop - plateY) / rise);
          if (k <= 0.02) continue;
          // two ripples of different lengths, both drifting up, so it never looks like a pattern
          var sway = Math.sin(plateY * 0.9 + t * 5.2 + seed) + 0.45 * Math.sin(plateY * 0.37 - t * 2.3 + seed * 2);
          var dx = Math.round(AMP * k * sway * SS / 1.45);
          if (!dx) continue;
          var hgt = Math.min(band, phei - yy);
          B.pctx.drawImage(hazeBuf, 0, yy, pwid, hgt, px0 + dx, py0 + yy, pwid, hgt);
        }
        B.pctx.restore();
      });
    }

    /* ---- Dig in!: choosing the facing ----
       The eight facings, as bearings on the table, and the one the player is
       pointing at (the mouse round the gun), else the one on offer. */
    var DIG_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    // (45° apart on the table, as the rules have them: E, SE, S, ... on the screen)
    function digFacings() {
      var out = [];
      for (var i = 0; i < 8; i++) out.push(-Math.PI / 4 + i * Math.PI / 4);
      return out;
    }
    function digPreview(u) {
      if (ui.digHover != null) return ui.digHover;
      if (ui.hover && !isTouch()) {
        var dx = ui.hover.x - dispX(u), dy = ui.hover.y - dispY(u);
        if (Math.hypot(dx, dy) > 0.4) return R.nearestFacing(Math.atan2(dy, dx));
      }
      return ui.digDir != null ? ui.digDir : (u.facing || 0);
    }
    function isTouch() { return !!(window.matchMedia && window.matchMedia('(hover: none)').matches); }
    /* The overlay round the gun: an octagon of eight wedges, one to a facing,
       the one pointed at lit; and that facing's fire arc (the front 90°) laid out
       on the ground from its 6" minimum to its 24" dug-in range. */
    function drawDigFacing(g, u) {
      var cx = dispX(u), cy = dispY(u), lift = liftOf(cx, cy), F = digFacings(), pick = digPreview(u);
      function P(ang, r) { var q = ISO.toScreen(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); return [q.x, q.y - lift]; }
      function fan(a0, a1, r0, r1, n) {
        var pts = [], i;
        for (i = 0; i <= n; i++) pts.push(P(a0 + (a1 - a0) * i / n, r1));
        for (i = n; i >= 0; i--) pts.push(P(a0 + (a1 - a0) * i / n, r0));
        g.beginPath(); pts.forEach(function (q, j) { if (j) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath();
      }
      g.save();
      // the fire arc for the facing pointed at
      fan(pick - Math.PI / 4, pick + Math.PI / 4, 6, 24, 24);
      g.fillStyle = 'rgba(232,193,90,.20)'; g.fill();
      g.strokeStyle = 'rgba(12,10,6,.5)'; g.lineWidth = 3.5; g.stroke();              // a dark edge, so it reads on pale ground
      g.strokeStyle = '#f0cf72'; g.lineWidth = 1.8; g.setLineDash([7, 5]); g.stroke(); g.setLineDash([]);
      // the octagon: a wedge to each facing, split half-way between its neighbours
      F.forEach(function (f, i) {
        var a0 = f - Math.PI / 8, a1 = f + Math.PI / 8;       // each a 45° slice of the ground round the gun
        var on = Math.abs(R.angleWrap(f - pick)) < 0.01;
        fan(a0 + 0.02, a1 - 0.02, 1.5, 2.7, 6);
        g.fillStyle = on ? 'rgba(232,193,90,.75)' : 'rgba(20,24,30,.55)'; g.fill();
        g.strokeStyle = on ? '#ffe39a' : 'rgba(232,193,90,.45)'; g.lineWidth = on ? 2 : 1; g.stroke();
        var lp = P(f, 2.1);
        g.fillStyle = on ? '#1a1407' : 'rgba(232,193,90,.85)';
        g.font = '700 ' + Math.max(9, Math.round(ISO.K * 0.32)) + 'px Oxanium, system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(DIG_NAMES[i], lp[0], lp[1]);
      });
      g.restore();
    }
    function drawBoard() {
      if (!B.state) return;
      /* Choosing a facing to dig in on: the gun is shown turned to it while the
         player looks round, and put back after. */
      var dg = ui.mode === 'digface' && ui.selected && B.state && B.state.phase === 'battle' ? ui.selected : null, keep = null;
      if (dg) { keep = { f: dg.facing, a: dg.aim }; dg.facing = digPreview(dg); dg.aim = null; }
      try { drawBoardNow(); } finally { if (dg) { dg.facing = keep.f; dg.aim = keep.a; } }
    }
    function drawBoardNow() {
      // everything drawn on the board itself is in CSS pixels, scaled to its density
      B.ctx.setTransform(B.DPR, 0, 0, B.DPR, 0, 0);
      /* The objectives' beacons are painted with the structures: when they move
         or arrive (an Invasion's zones are nominated after deployment), repaint. */
      // a barricade put down by hand: the structures again, not the whole table
      if (B.state.structsDirty && B.state.structs) { B.state.structsDirty = false; paintStructures(); }
      var ok0 = B.state.objectives.map(function (o) { return o.x.toFixed(1) + ',' + o.y.toFixed(1); }).join(';');
      if (B.state.structs && B.state.objKey != null && B.state.objKey !== ok0) paintStructures();
      B.state.objKey = ok0;
      // the plate is large: paint it once, off the first frame, with a word to the player
      if (!B.state.scene) {
        if (!B.state.baking) {
          B.state.baking = true;
          B.ctx.fillStyle = '#080b10';
          B.ctx.fillRect(0, 0, B.VIEW_W, B.VIEW_H);
          B.ctx.fillStyle = '#93a1b5';
          B.ctx.font = '600 15px Oxanium, system-ui, sans-serif';
          B.ctx.textAlign = 'center'; B.ctx.textBaseline = 'middle';
          B.ctx.fillText('Building the table…', B.VIEW_W / 2, B.VIEW_H / 2);
          setTimeout(function () {
            if (!B.state) return;
            buildScene();
            B.state.baking = false;
            drawBoard();
          }, 30);
        }
        return;
      }

      syncRemains();
      // only the visible window is redrawn each frame, so cost does not follow the plate size
      var v = viewRect();
      /* The working window is drawn as finely as the screen can show, up to twice
         the plate: the terrain is scaled up into it pixel for pixel, and the units,
         rings and effects are drawn straight in at that resolution. Its size is
         bounded by the screen, never by the plate, so a phone's memory is safe. */
      SS = Math.min(2, Math.max(1, v.z * B.DPR));
      var pw = Math.ceil(v.sw * SS), ph = Math.ceil(v.sh * SS);
      if (B.pix.width < pw || B.pix.height < ph) {
        B.pix.width = Math.max(B.pix.width, pw);
        B.pix.height = Math.max(B.pix.height, ph);
      }
      B.pctx.setTransform(SS, 0, 0, SS, -v.sx * SS, -v.sy * SS);
      B.pctx.imageSmoothingEnabled = false;
      // the plate is transparent outside the table's diamond, so the window has to be
      // cleared first — otherwise sprites drawn over that void smear as the camera moves
      B.pctx.fillStyle = '#080b10';
      B.pctx.fillRect(v.sx, v.sy, v.sw, v.sh);
      B.pctx.drawImage(B.state.ground, v.sx, v.sy, v.sw, v.sh, v.sx, v.sy, v.sw, v.sh);
      B.pctx.drawImage(B.state.structs, v.sx, v.sy, v.sw, v.sh, v.sx, v.sy, v.sw, v.sh);
      heatHaze(v);

      var pad = K * 3;
      function onView(x, y) {
        var p = ISO.toScreen(x, y);
        return p.x > v.sx - pad && p.x < v.sx + v.sw + pad &&
          p.y > v.sy - pad * 2 && p.y < v.sy + v.sh + pad;
      }

      function propDepth(pr) { return pr.x + pr.w + pr.y + pr.h; }
      /* A building opens up — drawn with its near walls off — when it would
         otherwise hide somebody: a squad standing inside it, or one behind it that
         its silhouette covers. Every other building stays solid, and is put back
         over the units the depth sort says are behind it. */
      var blockers = [];
      (B.state.props || []).forEach(function (pr) {
        if (pr.kind !== 'building' && pr.kind !== 'bunker' && pr.kind !== 'highwall') return;
        if (!onView(pr.x + pr.w / 2, pr.y + pr.h / 2)) return;
        var depth = propDepth(pr), b = null;
        var open = B.state.units.some(function (u) {
          if (!onTable(u)) return false;
          var ux = dispX(u), uy = dispY(u);
          if (R.inRect(ux, uy, pr)) return true;                 // inside it — a garrison is seen through the cut-away walls
          if (ux + uy >= depth) return false;                    // in front: nothing to hide
          if (!b) b = propBox(pr);
          // behind it, and under its outline
          var sp = ISO.toScreen(ux, uy), l = liftOf(ux, uy);
          var head = ISO.headroom(u.models, R.status(u), u);
          return sp.x > b.x - K * 0.6 && sp.x < b.x + b.w + K * 0.6 &&
            sp.y - l > b.y && sp.y - l - head < b.y + b.h;
        });
        blockers.push({ pr: pr, depth: depth, draw: 'block', open: open });
      });

      // a building that is hiding somebody is recomposited with its near walls off
      blockers.forEach(function (it) { if (it.open) repaintProp(it.pr, true); });

      /* The AI's choices are not drawn: its reach, its targets and its range rings
         are where the rules have already left it, ahead of the move still being
         shown, and they are its business rather than the player's. */
      var aiSel = !!(ui.selected && B.state.cfg.aiSides.indexOf(ui.selected.side) >= 0);
      // reachable ground
      if (ui.moves.length && !aiSel) {
        var mw = Math.ceil(K * 0.6), mh = Math.ceil(K * 0.35);
        ui.moves.forEach(function (c) {
          if (!onView(c.x, c.y)) return;
          var p = ISO.toScreen(c.x, c.y);
          var l = liftOf(c.x, c.y);
          B.pctx.fillStyle = ((c.x * 2 + c.y * 2) | 0) % 2 ? 'rgba(122,206,152,.30)' : 'rgba(96,180,130,.26)';
          B.pctx.fillRect(Math.round(p.x) - mw / 2, Math.round(p.y) - l - mh / 2, mw, mh);
        });
      }

      if (ui.mode === 'digface' && ui.selected && !aiSel) drawDigFacing(B.pctx, ui.selected);

      /* ---- units and the buildings that hide them ----
         The structures are one baked layer under everything, so a unit used to be
         drawn over every building whatever side of it the unit was on — an empty
         block read as glass with troops behind it. So the solid buildings are put
         back into the same depth sort as the units: anything further from the
         camera than a building is drawn first and then covered by it, and only the
         garrison of an occupied building — drawn at its own depth, just after it —
         is meant to show through the near wall.

         Occupied is what the player cares about: a squad is in the building if it
         is standing inside its footprint, and then you want to see it. */
      FX.drawGround && FX.drawGround(B.pctx);        // the ground broken open under what comes up through it
      var now0 = nowMs();
      var order = B.state.units.filter(function (u) { return (onTable(u) || (B.held[u.id] && onTable(shownAs(u)))) && onView(dispX(u), dispY(u)); })
        .map(function (u) {
          var d = dispX(u) + dispY(u);
          /* A unit inside a building belongs just in front of it, so it is drawn
             over the near wall rather than being buried by it. */
          (B.state.props || []).forEach(function (pr) {
            if (pr.kind !== 'building' && pr.kind !== 'bunker') return;
            if (R.inRect(dispX(u), dispY(u), pr)) d = Math.max(d, propDepth(pr) + 0.01);
          });
          return { unit: u, depth: d, draw: 'unit' };
        });

      // squads walking into a hull, drawn until they are inside it
      B.state.units.forEach(function (u) {
        var bd = u.boarding;
        if (!bd) return;
        var age = now0 - bd.t0;
        if (age >= bd.dur || !u.alive) { u.boarding = null; return; }
        var k = age / bd.dur, bx = bd.a.x + (bd.b.x - bd.a.x) * k, by = bd.a.y + (bd.b.y - bd.a.y) * k;
        if (!onView(bx, by)) return;
        order.push({ depth: bx + by, draw: 'boarding', u: u, x: bx, y: by, k: k, age: age, up: bd.up });
      });
      // the dead and the wrecks stay where they fell
      var now = now0, anyFire = false;
      (B.state.remains || []).forEach(function (r) {
        if (!onView(r.x, r.y)) return;
        if (r.kind === 'wreck') {
          var wu = r.snap || unitById(r.id);
          if (!wu) return;
          anyFire = true;
          order.push({ depth: r.x + r.y, draw: 'wreck', r: r, u: wu });
        } else order.push({ depth: r.x + r.y - 0.4, draw: 'body', r: r });
      });
      // a machine at half Structure trails smoke, which has to keep moving too
      if (!anyFire) anyFire = order.some(function (it) { return it.draw === 'unit' && ISO.smoking(it.unit); });
      B.state.fireOnView = anyFire;

      order.concat(blockers)
        .sort(function (a, b) { return a.depth - b.depth; })
        .forEach(function (it) {
          if (it.draw === 'block') { if (!it.open) repaintProp(it.pr); return; }
          if (it.draw === 'body') {
            var bp = ISO.toScreen(it.r.x, it.r.y);
            ISO.drawBody(B.pctx, bp.x + it.r.dx, bp.y + it.r.dy - liftOf(it.r.x, it.r.y), it.r);
            return;
          }
          if (it.draw === 'boarding') {
            B.pctx.save();
            if (it.up) B.pctx.globalAlpha = Math.max(0.15, 1 - it.k * 0.7);   // climbing up into the craft
            ISO.drawUnit(B.pctx, it.u, {
              at: { x: it.x, y: it.y }, lift: liftOf(it.x, it.y) + (it.up ? it.up * Math.max(0, (it.k - 0.35) / 0.65) : 0),
              hop: 0, walk: 1 + Math.floor(it.age / 170) % 2, status: 'ready', activated: false, selected: false, morale: 0
            });
            B.pctx.restore();
            return;
          }
          if (it.draw === 'wreck') {
            ISO.drawWreck(B.pctx, it.u, { x: it.r.x, y: it.r.y }, liftOf(it.r.x, it.r.y), now + it.r.t0);
            return;
          }
          var u = shownAs(it.unit), ax = dispX(u), ay = dispY(u);
          if (arrivalQueued(u)) return;                 // its arrival has not played yet
          var arr = arriving(u);
          if (u.burrow) arr = { lift: arr.lift + (u.burrow.lift || 0), pose: arr.pose, alpha: u.burrow.alpha, hidden: u.burrow.hidden };
          if (arr.hidden) return;                       // teleporting in, or under the ground: not here yet
          if (arr.alpha != null) { B.pctx.save(); B.pctx.globalAlpha = arr.alpha; }
          ISO.drawUnit(B.pctx, u, {
            at: { x: ax, y: ay },
            around: u.bld ? R.sectionRect(u) : null,
            lift: liftOf(ax, ay) + arr.lift,
            hop: u.hop || 0,
            walk: u.walk || 0,
            arc: u.arc || 0,
            status: R.status(u),
            // getting up as it arrives is a pose, not a state
            pose: arr.pose || undefined,
            activated: u.activated,
            selected: ui.selected === u,
            morale: R.currentMorale(u)
          });
          if (arr.alpha != null) B.pctx.restore();
        });

      /* The ghost: where the unit would stand if the move went ahead. Drawn over
         everything at half weight, with the path it would walk. */
      if (ui.preview && ui.preview.unit && onView(ui.preview.spot.x, ui.preview.spot.y)) {
        var pv = ui.preview, gx = pv.spot.x, gy = pv.spot.y;
        var from = ISO.toScreen(pv.unit.x, pv.unit.y), to = ISO.toScreen(gx, gy);
        B.pctx.save();
        B.pctx.globalAlpha = 0.55;
        B.pctx.strokeStyle = sideInk(pv.unit.side);
        B.pctx.lineWidth = Math.max(1, ISO.PIXEL);
        B.pctx.setLineDash([Math.max(2, ISO.PIXEL * 2), Math.max(2, ISO.PIXEL * 2)]);
        B.pctx.beginPath();
        B.pctx.moveTo(from.x, from.y - liftOf(pv.unit.x, pv.unit.y));
        (pv.path || []).forEach(function (q) {
          var sp = ISO.toScreen(q.x, q.y);
          B.pctx.lineTo(sp.x, sp.y - liftOf(q.x, q.y));
        });
        B.pctx.lineTo(to.x, to.y - liftOf(gx, gy));
        B.pctx.stroke();
        B.pctx.setLineDash([]);
        ISO.ellipse(B.pctx, to.x, to.y - liftOf(gx, gy), K * 0.8, K * 0.4,
          pv.unit.side === 'A' ? 'rgba(240,182,74,.25)' : 'rgba(111,196,226,.25)');
        B.pctx.globalAlpha = 0.5;
        ISO.drawUnit(B.pctx, pv.unit, {
          at: { x: gx, y: gy }, lift: liftOf(gx, gy), hop: 0, walk: 0,
          status: R.status(pv.unit), activated: false, selected: false,
          morale: R.currentMorale(pv.unit)
        });
        B.pctx.restore();
      }

      drawFx();
      B.pctx.setTransform(1, 0, 0, 1, 0, 0);

      /* Put the window on the screen in backing pixels. When the working window
         is already at the screen's own density this is one-to-one; zoomed out it
         is a downscale, and only then is smoothing allowed, so the art is never
         blurred on the way up.

         Any downscale, not only a big one. Shrinking pixel art without smoothing
         keeps some rows and drops others, and at a ratio like 0.55 that is close
         to every other row: the ground's dithered blend between grass and dirt
         then beats into a coarse checkerboard. The threshold used to be 0.5,
         which left exactly that band — ×0.55 on a one-to-one screen — unsmoothed. */
      var f = v.z * B.DPR / SS;
      B.ctx.setTransform(1, 0, 0, 1, 0, 0);
      B.ctx.imageSmoothingEnabled = f < 0.999;
      B.ctx.fillStyle = '#080b10';
      B.ctx.fillRect(0, 0, B.canvas.width, B.canvas.height);
      B.ctx.drawImage(B.pix, 0, 0, v.sw * SS, v.sh * SS,
        v.dx * B.DPR, v.dy * B.DPR, v.sw * v.z * B.DPR, v.sh * v.z * B.DPR);
      B.ctx.setTransform(B.DPR, 0, 0, B.DPR, 0, 0);
      B.ctx.imageSmoothingEnabled = true;

      drawHUD();
    }

    /* What a solitaire table carries besides terrain: the OpFor counters still to
       be revealed, the entry points it pours in through, the players' landing
       zones, the evacuation point or the safe zone, and the objectives to blow. */
    function drawSoloMarks() {
      var sc = B.state.sc || {}, z = cam.z;
      var inkB = sideInk('B'), inkA = sideInk('A');
      function label(x, y, text, col) {
        var p = hud(x, y, liftOf(x, y));
        B.ctx.font = '600 ' + Math.max(9, Math.round(10 * Math.min(1.4, z + 0.2))) + 'px Oxanium, system-ui, sans-serif';
        B.ctx.textAlign = 'center'; B.ctx.textBaseline = 'middle';
        B.ctx.lineWidth = 3; B.ctx.strokeStyle = 'rgba(8,10,14,.75)'; B.ctx.strokeText(text, p.x, p.y);
        B.ctx.fillStyle = col; B.ctx.fillText(text, p.x, p.y);
      }
      B.ctx.save();
      // the safe zone and the evacuation point
      if (sc.safe) {
        B.ctx.setLineDash([8, 6]); B.ctx.lineWidth = 2; B.ctx.strokeStyle = 'rgba(122,206,144,.8)';
        B.ctx.fillStyle = 'rgba(122,206,144,.08)';
        isoRing(sc.safe.x, sc.safe.y, sc.safe.r, 0); B.ctx.fill(); B.ctx.stroke();
        var b = sc.safeBuilding;
        if (b) label(b.x + b.w / 2, b.y + b.h / 2 + 3.2, 'SAFE ZONE', 'rgb(150,226,170)');
        (sc.homes || []).forEach(function (h) { label(h.x + h.w / 2, h.y + h.h / 2 + 2.8, 'CIVILIANS', 'rgb(236,228,200)'); });
      }
      if (sc.evac) {
        B.ctx.setLineDash([6, 6]); B.ctx.lineWidth = 2; B.ctx.strokeStyle = 'rgba(122,206,144,.85)';
        isoRing(sc.evac.x, sc.evac.y, 6, liftOf(sc.evac.x, sc.evac.y)); B.ctx.stroke();
        B.ctx.lineWidth = 1; B.ctx.strokeStyle = 'rgba(122,206,144,.4)';
        isoRing(sc.evac.x, sc.evac.y, 12, liftOf(sc.evac.x, sc.evac.y)); B.ctx.stroke();
        label(sc.evac.x, sc.evac.y, 'EVAC', 'rgb(150,226,170)');
      }
      // the landing zones
      if (sc.lz) Object.keys(sc.lz).forEach(function (o) {
        var l = sc.lz[o];
        B.ctx.setLineDash([5, 5]); B.ctx.lineWidth = 2;
        B.ctx.strokeStyle = o === '2' ? sideInk('C') : inkA;
        isoRing(l.x, l.y, 4, liftOf(l.x, l.y)); B.ctx.stroke();
        if (B.state.turn <= 2) label(l.x, l.y, B.state.solo.coop ? 'LZ ' + o : 'LZ', o === '2' ? sideInk('C') : inkA);
      });
      B.ctx.setLineDash([]);
      // entry points
      (sc.entries || []).forEach(function (e) {
        var p = hud(e.x, e.y, liftOf(e.x, e.y)), r = Math.max(5, 7 * z);
        B.ctx.beginPath();
        B.ctx.moveTo(p.x, p.y - r); B.ctx.lineTo(p.x + r, p.y); B.ctx.lineTo(p.x, p.y + r); B.ctx.lineTo(p.x - r, p.y); B.ctx.closePath();
        B.ctx.fillStyle = 'rgba(8,10,14,.55)'; B.ctx.fill();
        B.ctx.lineWidth = 2; B.ctx.strokeStyle = inkB; B.ctx.stroke();
        label(e.x + 1.2, e.y + 1.2, e.id, inkB);
      });
      // Sabotage: the targets, standing or blown
      (sc.targets || []).forEach(function (t) {
        B.ctx.lineWidth = 2.5; B.ctx.strokeStyle = t.destroyed ? 'rgba(140,140,140,.6)' : '#e8c15a';
        isoRing(t.x, t.y, 1, liftOf(t.x, t.y)); B.ctx.stroke();
        var p = hud(t.x, t.y, liftOf(t.x, t.y)), r = Math.max(3, 4 * z);
        B.ctx.beginPath(); B.ctx.moveTo(p.x - r, p.y - r / 2); B.ctx.lineTo(p.x + r, p.y + r / 2);
        B.ctx.moveTo(p.x + r, p.y - r / 2); B.ctx.lineTo(p.x - r, p.y + r / 2); B.ctx.stroke();
        if (!t.destroyed) label(t.x + 1.6, t.y + 1.6, 'TARGET', '#e8c15a');
      });
      // the counters: a token each, still hiding a unit from the pool
      (sc.counters || []).forEach(function (c) {
        var p = hud(c.x, c.y, liftOf(c.x, c.y)), rx = Math.max(6, 0.9 * K * z * Math.SQRT2), ry = rx / 2;
        B.ctx.beginPath(); B.ctx.ellipse(p.x, p.y + 2, rx, ry, 0, 0, Math.PI * 2);
        B.ctx.fillStyle = 'rgba(8,10,14,.45)'; B.ctx.fill();
        B.ctx.beginPath(); B.ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        B.ctx.fillStyle = 'rgba(30,34,42,.92)'; B.ctx.fill();
        B.ctx.lineWidth = 2; B.ctx.strokeStyle = inkB; B.ctx.stroke();
        B.ctx.font = '700 ' + Math.max(9, Math.round(ry * 1.5)) + 'px Oxanium, system-ui, sans-serif';
        B.ctx.textAlign = 'center'; B.ctx.textBaseline = 'middle';
        B.ctx.fillStyle = inkB; B.ctx.fillText('?', p.x, p.y + 0.5);
      });
      B.ctx.restore();
    }

    function isoRing(cx, cy, rad, lift) {
      var p = hud(cx, cy, lift), z = cam.z;
      B.ctx.beginPath();
      B.ctx.ellipse(p.x, p.y, Math.SQRT2 * rad * K * z, Math.SQRT2 * rad * K * z / 2, 0, 0, Math.PI * 2);
    }

    function blockingAt(x, y) {
      var out = [];
      for (var i = 0; i < B.state.terrain.length; i++) {
        var r = B.state.terrain[i];
        if (R.TERRAIN[r.kind].blocks && R.inRect(x, y, r)) out.push(r);
      }
      return out;
    }

    /* What a unit can see from where it stands — or, with `at`, from a spot it is
       thinking about moving to, which is what the move preview draws. */
    function visibility(u, at) {
      var from = at || u;
      // a Xenotripod sees no further than its Limited Senses let it (p. 129)
      var radius = Math.min(R.sightRange(u), R.xenoSenses(u) ? 99 : u.range + 2 * UR);
      var inside = blockingAt(from.x, from.y);
      var pts = [];
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 96) {
        var dx = Math.cos(a), dy = Math.sin(a), last = 0;
        for (var d = 0.5; d <= radius; d += 0.5) {
          var x = from.x + dx * d, y = from.y + dy * d;
          if (x < 0 || y < 0 || x > W || y > H) break;
          var blocked = false;
          for (var i = 0; i < B.state.terrain.length; i++) {
            var r = B.state.terrain[i];
            if (!R.TERRAIN[r.kind].blocks) continue;
            if (inside.indexOf(r) >= 0) continue;
            if (R.inRect(x, y, r)) { blocked = true; break; }
          }
          if (blocked) break;
          last = d;
        }
        pts.push({ x: from.x + dx * last, y: from.y + dy * last });
      }
      return pts;
    }

    function drawHUD() {
      var i;
      // the AI's own choices are not drawn (see drawBoard)
      var aiSel = !!(ui.selected && B.state.cfg.aiSides.indexOf(ui.selected.side) >= 0);
      /* The ground each side may deploy into. It used to be painted as a flat 6"
         band on each table edge whatever the scenario actually said — wrong for
         Invasion's inset zones and for the circles in Demolish and Hostile
         takeover — and faint enough to be invisible on a phone. It now draws the
         real zone, and the one the player has to fill is the one that stands out. */
      /* Terrain set-up: the area being laid is lit and the rest of the table
         dimmed, each area carries its compass name, and the next piece follows
         the pointer where it would land. */
      if (B.state.phase === 'terrain' && B.state.tset) {
        var ta = curArea();
        B.state.tset.areas.forEach(function (ar) {
          var q = [hud(ar.x, ar.y), hud(ar.x + ar.w, ar.y), hud(ar.x + ar.w, ar.y + ar.h), hud(ar.x, ar.y + ar.h)];
          B.ctx.beginPath();
          B.ctx.moveTo(q[0].x, q[0].y);
          for (var n = 1; n < 4; n++) B.ctx.lineTo(q[n].x, q[n].y);
          B.ctx.closePath();
          var now = ar === ta;
          if (!now) { B.ctx.fillStyle = 'rgba(6,9,14,' + (ar.done ? .18 : .38) + ')'; B.ctx.fill(); }
          else {
            var col = sideRGB(ar.side);
            B.ctx.fillStyle = 'rgba(' + col + ',.1)'; B.ctx.fill();
            B.ctx.strokeStyle = 'rgba(' + col + ',.95)'; B.ctx.lineWidth = 2.5; B.ctx.setLineDash([9, 7]); edgedStroke(); B.ctx.setLineDash([]);
          }
          var c0 = hud(ar.x + ar.w / 2, ar.y + ar.h / 2);
          B.ctx.font = '700 ' + Math.round(13 + 6 * Math.min(1, cam.z)) + 'px Oxanium, system-ui, sans-serif';
          B.ctx.textAlign = 'center'; B.ctx.textBaseline = 'middle';
          // outlined dark, so the name reads over snow and sand as well as over soil
          B.ctx.lineJoin = 'round'; B.ctx.lineWidth = 4;
          B.ctx.strokeStyle = now ? 'rgba(8,10,14,.6)' : 'rgba(8,10,14,.35)';
          B.ctx.strokeText(ar.name, c0.x, c0.y);
          B.ctx.fillStyle = now ? 'rgba(255,255,255,.85)' : 'rgba(220,228,240,.45)';
          B.ctx.fillText(ar.name, c0.x, c0.y);
        });
        // pieces down since the table was last baked, as flat footprints until it is
        var TINT = { woods: '64,110,52', ruins: '120,112,100', crater: '110,96,80', barricade: '150,140,112', rocks: '118,112,104',
          hill: '128,120,82', building: '150,138,120', bunker: '120,126,130', wall: '140,136,128', water: '70,110,140', deep: '40,70,110', lava: '200,80,30', crystal: '110,210,150', ravine: '170,210,235' };
        B.state.terrain.slice(B.state.tset.baked || 0).forEach(function (pc) {
          var sh = pc.parts ? pc.parts.map(function (r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })
            : [pc.poly || [[pc.x, pc.y], [pc.x + pc.w, pc.y], [pc.x + pc.w, pc.y + pc.h], [pc.x, pc.y + pc.h]]];
          B.ctx.fillStyle = 'rgba(' + (TINT[pc.kind] || '140,140,140') + ',.85)';
          B.ctx.strokeStyle = 'rgba(20,20,20,.6)'; B.ctx.lineWidth = 1;
          sh.forEach(function (pts) {
            B.ctx.beginPath();
            pts.forEach(function (q, n) { var s2 = hud(q[0], q[1]); if (n) B.ctx.lineTo(s2.x, s2.y); else B.ctx.moveTo(s2.x, s2.y); });
            B.ctx.closePath(); B.ctx.fill(); B.ctx.stroke();
          });
        });
        var g = B.state.tset.ghost;
        if (ta && g && ui.hover && !isAI(ta.side)) {
          var spot = fitGhost(ta, ui.hover.x, ui.hover.y);
          var inside = ui.hover.x >= ta.x - 2 && ui.hover.x <= ta.x + ta.w + 2 && ui.hover.y >= ta.y - 2 && ui.hover.y <= ta.y + ta.h + 2;
          var at = spot && inside ? spot : { x: ui.hover.x - g.w / 2, y: ui.hover.y - g.h / 2 };
          var gp = clonePiece(g);
          R.placePiece(gp, at.x, at.y);
          var shapes = gp.parts ? gp.parts.map(function (r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })
            : [gp.poly || [[gp.x, gp.y], [gp.x + gp.w, gp.y], [gp.x + gp.w, gp.y + gp.h], [gp.x, gp.y + gp.h]]];
          var ok = spot && inside;
          B.ctx.fillStyle = ok ? 'rgba(' + sideRGB(ta.side) + ',.38)' : 'rgba(200,72,64,.32)';
          B.ctx.strokeStyle = ok ? 'rgba(255,255,255,.9)' : 'rgba(230,110,100,.9)';
          B.ctx.lineWidth = 1.6;
          shapes.forEach(function (pts) {
            B.ctx.beginPath();
            pts.forEach(function (q, n) { var s2 = hud(q[0], q[1]); if (n) B.ctx.lineTo(s2.x, s2.y); else B.ctx.moveTo(s2.x, s2.y); });
            B.ctx.closePath(); B.ctx.fill(); B.ctx.stroke();
          });
        }
      }
      if (B.state.phase === 'deploy') {
        var placing = placingSide();
        ['A', 'B'].forEach(function (side) {
          var own = side === placing;
          var col = sideRGB(side);
          var circ = B.state.sc && B.state.sc.defCircle && B.state.sc.defender === side
            ? B.state.sc.defCircle : null;
          B.ctx.fillStyle = 'rgba(' + col + ',' + (own ? .3 : .12) + ')';
          B.ctx.strokeStyle = 'rgba(' + col + ',' + (own ? .95 : .35) + ')';
          B.ctx.lineWidth = own ? 2.5 : 1.2;
          B.ctx.setLineDash(own ? [9, 7] : [5, 7]);
          var boxes = boxesFor(side);
          if (circ) {
            isoRing(circ.x, circ.y, circ.r, liftOf(circ.x, circ.y));
            B.ctx.fill(); edgedStroke(own ? 0.45 : 0.2);
          } else if (boxes) {
            // Demolish: the stretches of table edge this side owns
            B.ctx.beginPath();
            boxes.forEach(function (b) {
              var q = [hud(b.x, b.y), hud(b.x + b.w, b.y), hud(b.x + b.w, b.y + b.h), hud(b.x, b.y + b.h)];
              B.ctx.moveTo(q[0].x, q[0].y);
              for (var n = 1; n < 4; n++) B.ctx.lineTo(q[n].x, q[n].y);
              B.ctx.closePath();
            });
            B.ctx.fill(); edgedStroke(own ? 0.45 : 0.2);
          } else {
            var z = zoneFor(side);
            if (!z) { B.ctx.setLineDash([]); return; }
            // Invasion's defender holds a box set in from every edge, not a strip
            var ins = (B.state.sc && B.state.sc.inset && B.state.sc.defender === side) ? B.state.sc.inset : 0;
            /* the strip is kept a model's radius in from the edge so a unit's centre
               stays on the table, but the ground it covers runs right to the edge */
            var zx0 = z[0] <= UR + 0.01 ? 0 : z[0], zx1 = z[1] >= W - UR - 0.01 ? W : z[1];
            var a = hud(zx0, ins), b = hud(zx1, ins), c = hud(zx1, H - ins), d = hud(zx0, H - ins);
            B.ctx.beginPath();
            B.ctx.moveTo(a.x, a.y); B.ctx.lineTo(b.x, b.y); B.ctx.lineTo(c.x, c.y); B.ctx.lineTo(d.x, d.y);
            B.ctx.closePath();
            B.ctx.fill(); edgedStroke(own ? 0.45 : 0.2);
          }
          B.ctx.setLineDash([]);
        });
      }

      /* The ground a Battlefield Insertion may legally come down on — everything
         outside 12" of an objective and 4" in from the edge. It used to be an
         invisible rule the player had to guess at, one refused tap at a time. */
      if (ui.insertion && insertionMine()) {
        /* Painted strongly enough to be read at arm's length on a phone with the
           table zoomed out: at the old .16 the legal ground was all but invisible,
           and a player who missed the prompt had nothing on the table to go on. */
        var forbid = 'rgba(200,72,64,.15)';
        B.ctx.fillStyle = 'rgba(122,206,144,.28)';
        ui.insertion.spots.forEach(function (s) {
          var q = [hud(s.x - 1, s.y - 1), hud(s.x + 1, s.y - 1), hud(s.x + 1, s.y + 1), hud(s.x - 1, s.y + 1)];
          B.ctx.beginPath();
          B.ctx.moveTo(q[0].x, q[0].y);
          for (var n = 1; n < 4; n++) B.ctx.lineTo(q[n].x, q[n].y);
          B.ctx.closePath(); B.ctx.fill();
        });
        // an Invasion's zones already nominated, while the next is chosen
        (ui.insertion.chosen || []).forEach(function (z) {
          B.ctx.setLineDash([6, 6]); B.ctx.lineWidth = 2; B.ctx.strokeStyle = 'rgba(235,240,248,.85)';
          isoRing(z.x, z.y, 4, liftOf(z.x, z.y)); B.ctx.stroke(); B.ctx.setLineDash([]);
        });
        // and the 12" exclusion round each objective, so the shape makes sense
        B.ctx.setLineDash([7, 6]);
        B.ctx.lineWidth = 1.6; B.ctx.strokeStyle = 'rgba(224,120,104,.6)';
        B.ctx.fillStyle = forbid;
        B.state.objectives.forEach(function (o) {
          isoRing(o.x, o.y, 12, liftOf(o.x, o.y));
          B.ctx.fill(); B.ctx.stroke();
        });
        B.ctx.setLineDash([]);
      }

      if (B.state.solo) drawSoloMarks();

      // objective control radius
      B.state.objectives.forEach(function (o) {
        var col = o.owner ? sideInk(o.owner) : 'rgba(235,240,248,.6)';
        B.ctx.setLineDash([6, 6]);
        B.ctx.lineWidth = 3; B.ctx.strokeStyle = 'rgba(8,10,14,.5)';
        isoRing(o.x, o.y, 4, liftOf(o.x, o.y)); B.ctx.stroke();
        B.ctx.lineWidth = 1.4; B.ctx.strokeStyle = col;
        isoRing(o.x, o.y, 4, liftOf(o.x, o.y)); B.ctx.stroke();
        B.ctx.setLineDash([]);
      });

      var u = ui.selected;
      if (u && u.alive && !aiSel) {
        var lift = liftOf(u.x, u.y);
        // keep the auras on the table
        B.ctx.save();
        var corners = [hud(0, 0), hud(W, 0), hud(W, H), hud(0, H)];
        B.ctx.beginPath();
        corners.forEach(function (c, n) { if (n === 0) B.ctx.moveTo(c.x, c.y); else B.ctx.lineTo(c.x, c.y); });
        B.ctx.closePath(); B.ctx.clip();
        /* While a move is being previewed the sight lines and the range rings are
           drawn from where the unit WOULD be, because that is the question the
           player is actually asking. */
        var eye = ui.preview ? ui.preview.spot : u;
        var eyeLift = ui.preview ? liftOf(eye.x, eye.y) : lift;
        var key = u.id + ':' + eye.x.toFixed(2) + ':' + eye.y.toFixed(2);
        if (!ui.vis || ui.visKey !== key) { ui.vis = visibility(u, eye); ui.visKey = key; }
        B.ctx.save();
        B.ctx.beginPath();
        ui.vis.forEach(function (p, n) {
          var s = hud(p.x, p.y, 0);
          if (n === 0) B.ctx.moveTo(s.x, s.y); else B.ctx.lineTo(s.x, s.y);
        });
        B.ctx.closePath();
        B.ctx.fillStyle = 'rgba(' + sideRGB(u.side) + ',.12)';
        B.ctx.fill();
        B.ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.4)';
        B.ctx.lineWidth = 1; B.ctx.stroke();
        B.ctx.restore();

        /* Mental Projection (p. 129): what one Xenotripod sees, the tribe sees.
           Every other unbroken member's 12" of sight is drawn faintly across the
           table, and each enemy the tribe can see is ringed. */
        if (R.xenoSenses(u) && !R.campFlag(u, 'banished')) {
          var tkey = B.state.turn + ':' + B.state.log.length + ':' + u.id;
          if (ui.tribeKey !== tkey) {
            ui.tribeKey = tkey;
            ui.tribe = {
              seers: activeUnits(u.side).filter(function (o) {
                return o !== u && R.xenoSenses(o) && !R.campFlag(o, 'banished') && R.status(o) !== 'broken';
              }),
              seen: activeUnits().filter(function (e) { return e.side !== u.side && R.tribeSees(B.state, u.side, e); })
            };
          }
          B.ctx.lineWidth = 1;
          ui.tribe.seers.forEach(function (o) {
            B.ctx.setLineDash([3, 4]);
            B.ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.32)';
            isoRing(o.x, o.y, R.sightRange(o), liftOf(o.x, o.y)); B.ctx.stroke();
            B.ctx.fillStyle = 'rgba(' + sideRGB(u.side) + ',.04)'; B.ctx.fill();
          });
          B.ctx.setLineDash([]);
          B.ctx.lineWidth = 1.6;
          ui.tribe.seen.forEach(function (e) {
            B.ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.85)';
            isoRing(e.x, e.y, UR * 1.5, liftOf(e.x, e.y) + ISO.flyLift(e)); B.ctx.stroke();
          });
        }
        // a Shield Generator's dome: 12" of +2 (or +1) against fire from outside it
        if (R.ruleValue(u, 'Shield Generator')) {
          B.ctx.lineWidth = 1.4; B.ctx.strokeStyle = 'rgba(' + sideRGB(u.side) + ',.6)';
          isoRing(eye.x, eye.y, 12, eyeLift); B.ctx.stroke();
          B.ctx.fillStyle = 'rgba(' + sideRGB(u.side) + ',.05)'; B.ctx.fill();
        }
        /* An Overmind's reach (p. 116): 18", or 24" with Increased Control — the
           bugs inside it are held back, sheltered and called back from the dead. */
        if (R.has(u, 'Overmind')) {
          B.ctx.setLineDash([2, 5]);
          B.ctx.lineWidth = 1.6; B.ctx.strokeStyle = 'rgba(190,140,245,.7)';
          isoRing(eye.x, eye.y, R.overmindReach(B.state, u.side) + UR, eyeLift); B.ctx.stroke();
          B.ctx.fillStyle = 'rgba(190,140,245,.06)'; B.ctx.fill();
          B.ctx.setLineDash([]);
        }
        if (u.fp !== null) {
          B.ctx.setLineDash([4, 5]);
          B.ctx.strokeStyle = 'rgba(232,193,90,.5)'; B.ctx.lineWidth = 1.2;
          isoRing(eye.x, eye.y, u.range + 2 * UR, eyeLift); B.ctx.stroke();
          B.ctx.strokeStyle = 'rgba(232,193,90,.3)';
          isoRing(eye.x, eye.y, u.range / 2 + 2 * UR, eyeLift); B.ctx.stroke();
          B.ctx.setLineDash([]);
        }
        // the enemies the move would put in reach, and the ones it would expose it to
        if (ui.preview) {
          B.ctx.lineWidth = 1.6;
          ui.preview.watchers.forEach(function (o) {
            B.ctx.strokeStyle = 'rgba(224,85,122,.75)';
            isoRing(o.x, o.y, 1.4, liftOf(o.x, o.y)); B.ctx.stroke();
          });
          (ui.preview.shots || []).forEach(function (o) {
            B.ctx.strokeStyle = 'rgba(122,206,152,.9)';
            isoRing(o.x, o.y, 1.9, liftOf(o.x, o.y)); B.ctx.stroke();
          });
        }
        if (ui.mode === 'assault') {
          B.ctx.setLineDash([3, 4]);
          B.ctx.strokeStyle = 'rgba(228,105,63,.65)'; B.ctx.lineWidth = 1.4;
          isoRing(u.x, u.y, u.move + 2 + 2 * UR, lift); B.ctx.stroke();
          B.ctx.setLineDash([]);
        }
        B.ctx.restore();
      }

      // the building sections a unit could go into
      if (ui.mode === 'enter' && ui.sections && ui.sections.length) {
        B.ctx.save();
        ui.sections.forEach(function (q) {
          var r = q.rect, c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(function (p2) { return hud(p2[0], p2[1], 0); });
          B.ctx.beginPath(); B.ctx.moveTo(c[0].x, c[0].y);
          for (var i = 1; i < 4; i++) B.ctx.lineTo(c[i].x, c[i].y);
          B.ctx.closePath();
          B.ctx.fillStyle = 'rgba(122,206,144,.26)'; B.ctx.fill();
          B.ctx.setLineDash([6, 4]); B.ctx.strokeStyle = '#8fe0a6'; B.ctx.lineWidth = 2; B.ctx.stroke();
          var mid = hud(r.x + r.w / 2, r.y + r.h / 2, ISO.K * 2.2);
          B.ctx.setLineDash([]);
          var label = R.sectionHigh(q.piece, r) ? (q.piece.kind === 'bunker' ? 'Reinforced' : 'High · +2 FP') : 'Low building';
          B.ctx.font = '600 11px Oxanium, system-ui, sans-serif';
          B.ctx.textAlign = 'center'; B.ctx.textBaseline = 'middle';
          var w = B.ctx.measureText(label).width + 12;
          B.ctx.fillStyle = 'rgba(8,11,16,.86)';
          roundRect(B.ctx, mid.x - w / 2, mid.y - 9, w, 18, 4); B.ctx.fill();
          B.ctx.strokeStyle = '#8fe0a6'; B.ctx.lineWidth = 1; B.ctx.stroke();
          B.ctx.fillStyle = '#e7ecf4'; B.ctx.fillText(label, mid.x, mid.y + 1);
        });
        B.ctx.restore();
      }
      // Detailed Terrain Knowledge: the piece in hand, and how far it may go
      if (B.state.placeAsk && B.state.placeAsk.kind === 'move' && !isAI(B.state.placeAsk.side) && B.state.placeAsk.pick != null) {
        var mp = B.state.terrain[B.state.placeAsk.pick];
        if (mp) {
          B.ctx.save(); B.ctx.setLineDash([6, 5]); B.ctx.strokeStyle = '#e8c15a'; B.ctx.lineWidth = 2;
          isoRing(mp.x + mp.w / 2, mp.y + mp.h / 2, 12, liftOf(mp.x + mp.w / 2, mp.y + mp.h / 2)); B.ctx.stroke();
          B.ctx.restore();
        }
      }
      // Terrorist: the pieces that may be mined
      if (B.state.minePick && !isAI(B.state.minePick.side)) {
        B.ctx.save(); B.ctx.setLineDash([5, 4]); B.ctx.strokeStyle = '#e4693f'; B.ctx.lineWidth = 2;
        B.state.minePick.pool.forEach(function (i) {
          var r = B.state.terrain[i];
          var c = (r.poly || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])
            .map(function (q) { return hud(q[0], q[1], liftOf(q[0], q[1])); });
          B.ctx.beginPath(); B.ctx.moveTo(c[0].x, c[0].y);
          for (var j = 1; j < c.length; j++) B.ctx.lineTo(c[j].x, c[j].y);
          B.ctx.closePath(); B.ctx.stroke();
        });
        B.ctx.restore();
      }
      // destructible pieces offered as targets
      if (ui.terrain.length && !aiSel) {
        B.ctx.save();
        B.ctx.setLineDash([5, 4]);
        B.ctx.strokeStyle = ui.mode === 'breach' ? '#e4693f' : '#e8c15a';
        B.ctx.lineWidth = 2;
        ui.terrain.forEach(function (r) {
          var c = (r.poly || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])
            .map(function (q) { return hud(q[0], q[1], liftOf(q[0], q[1])); });
          B.ctx.beginPath();
          B.ctx.moveTo(c[0].x, c[0].y);
          for (var i = 1; i < c.length; i++) B.ctx.lineTo(c[i].x, c[i].y);
          B.ctx.closePath();
          B.ctx.stroke();
          var mid = hud(r.x + r.w / 2, r.y + r.h / 2, liftOf(r.x + r.w / 2, r.y + r.h / 2) + ISO.K * 1.4);
          B.ctx.setLineDash([]);
          var label = R.TERRAIN[r.kind].name;
          B.ctx.font = '600 11px Oxanium, system-ui, sans-serif';
          B.ctx.textAlign = 'center'; B.ctx.textBaseline = 'middle';
          var w = B.ctx.measureText(label).width + 12;
          B.ctx.fillStyle = 'rgba(8,11,16,.86)';
          roundRect(B.ctx, mid.x - w / 2, mid.y - 9, w, 18, 4); B.ctx.fill();
          B.ctx.strokeStyle = ui.mode === 'breach' ? '#e4693f' : '#e8c15a';
          B.ctx.lineWidth = 1; B.ctx.stroke();
          B.ctx.fillStyle = '#e7ecf4';
          B.ctx.fillText(label, mid.x, mid.y + 1);
          B.ctx.setLineDash([5, 4]);
          B.ctx.lineWidth = 2;
        });
        B.ctx.restore();
      }

      // targets
      (aiSel ? [] : ui.targets).forEach(function (t) {
        var p = hud(t.x, t.y, liftOf(t.x, t.y));
        B.ctx.strokeStyle = ui.mode === 'assault' ? '#e4693f' : '#e8c15a';
        B.ctx.lineWidth = 2;
        B.ctx.beginPath(); B.ctx.ellipse(p.x, p.y, ISO.K * 0.8 * cam.z, ISO.K * 0.44 * cam.z, 0, 0, Math.PI * 2); B.ctx.stroke();
        if (ui.selected) {
          var a = hud(ui.selected.x, ui.selected.y, liftOf(ui.selected.x, ui.selected.y) + 8);
          var b = hud(t.x, t.y, liftOf(t.x, t.y) + ISO.K * 0.5);
          B.ctx.save(); B.ctx.globalAlpha = .35; B.ctx.setLineDash([4, 4]);
          B.ctx.beginPath(); B.ctx.moveTo(a.x, a.y); B.ctx.lineTo(b.x, b.y); B.ctx.stroke();
          B.ctx.restore();
        }
        // the chance of telling, worked out over all ten faces of the die
        var odds = oddsOn(t);
        if (odds) drawOdds(t, odds);
      });

      /* Unit labels. A unit standing in terrain carries a mark for it, because the
         ground it is on is the single biggest modifier on the table and it is not
         always obvious from above which piece a base is actually inside. */
      /* A campaign unit wears its record beside its code: a gold star once it
         holds a Battle Honour, a red heart once it carries a Battle Trauma. They
         are drawn rather than typed, so they look the same on every machine. */
      function star(cx, cy, r) {
        B.ctx.beginPath();
        for (var k = 0; k < 10; k++) {
          var rr = k % 2 ? r * 0.45 : r, an = -Math.PI / 2 + k * Math.PI / 5;
          B.ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * rr, cy + Math.sin(an) * rr);
        }
        B.ctx.closePath(); B.ctx.fillStyle = '#f2c14e'; B.ctx.fill();
      }
      function heart(cx, cy, r) {
        B.ctx.beginPath();
        B.ctx.moveTo(cx, cy + r * 0.9);
        B.ctx.bezierCurveTo(cx - r * 1.3, cy - r * 0.1, cx - r * 0.6, cy - r * 1.2, cx, cy - r * 0.4);
        B.ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.2, cx + r * 1.3, cy - r * 0.1, cx, cy + r * 0.9);
        B.ctx.closePath(); B.ctx.fillStyle = '#e0557a'; B.ctx.fill();
      }
      B.ctx.font = '600 10px Oxanium, system-ui, sans-serif';
      B.ctx.textAlign = 'center'; B.ctx.textBaseline = 'alphabetic';
      B.state.units.forEach(function (u2) {
        if (!u2.alive || u2.x < 0) return;
        // the label rides with the model as it is shown — mid-move, where the move has got to — not where the rules have put it
        var lx = dispX(u2), ly = dispY(u2);
        var p = hud(lx, ly, liftOf(lx, ly) + ISO.headroom(u2.models, R.status(u2), u2) + ISO.K * 0.5);
        var mark = terrainMark(u2);
        var rec = labelIcons(u2), honoured = rec.star, scarred = rec.heart;
        var icons = (honoured ? 1 : 0) + (scarred ? 1 : 0);
        var tw = B.ctx.measureText(u2.code).width;
        var w = tw + 8 + icons * 11 + (mark ? 12 : 0);
        B.ctx.fillStyle = 'rgba(8,11,16,.72)';
        B.ctx.fillRect(p.x - w / 2, p.y - 10, w, 13);
        B.ctx.fillStyle = sideInk(u2.side);
        var tx = p.x - w / 2 + 4 + tw / 2;
        B.ctx.fillText(u2.code, tx, p.y);
        var ix = tx + tw / 2 + 6.5;
        if (honoured) { star(ix, p.y - 3.5, 4.6); ix += 11; }
        if (scarred) heart(ix, p.y - 3.5, 4.2);
        if (mark) {
          B.ctx.fillStyle = mark.col;
          B.ctx.fillRect(p.x + w / 2 - 11, p.y - 8, 8, 9);
          B.ctx.fillStyle = 'rgba(8,11,16,.82)';
          B.ctx.font = '700 8px "IBM Plex Mono", monospace';
          B.ctx.fillText(mark.ch, p.x + w / 2 - 7, p.y - 1);
          B.ctx.font = '600 10px Oxanium, system-ui, sans-serif';
        }
      });

      // measuring tape
      if (u && ui.hover) {
        var a2 = hud(dispX(u), dispY(u), liftOf(dispX(u), dispY(u)));
        var b2 = hud(ui.hover.x, ui.hover.y, 0);
        var dist = Math.max(0, R.inches(u.x, u.y, ui.hover.x, ui.hover.y) - UR);
        // a dark edge under the light dash, so the tape reads on snow as well as on soil
        B.ctx.setLineDash([3, 4]);
        B.ctx.strokeStyle = 'rgba(8,10,14,.45)'; B.ctx.lineWidth = 3;
        B.ctx.beginPath(); B.ctx.moveTo(a2.x, a2.y); B.ctx.lineTo(b2.x, b2.y); B.ctx.stroke();
        B.ctx.strokeStyle = 'rgba(231,236,244,.55)'; B.ctx.lineWidth = 1;
        B.ctx.beginPath(); B.ctx.moveTo(a2.x, a2.y); B.ctx.lineTo(b2.x, b2.y); B.ctx.stroke();
        B.ctx.setLineDash([]);
        var label = dist.toFixed(1) + '"';
        B.ctx.font = '500 11px "IBM Plex Mono", monospace';
        var lw = B.ctx.measureText(label).width + 8;
        B.ctx.fillStyle = 'rgba(10,14,20,.85)';
        B.ctx.fillRect(b2.x + 8, b2.y - 20, lw, 15);
        B.ctx.fillStyle = '#e7ecf4'; B.ctx.textAlign = 'left';
        B.ctx.fillText(label, b2.x + 12, b2.y - 9);
        B.ctx.textAlign = 'center';
      }
    }

    return {
      DIG_NAMES: DIG_NAMES,
      buildScene: buildScene,
      digFacings: digFacings,
      digPreview: digPreview,
      drawBoard: drawBoard,
      dropHaze: dropHaze,
      hull: hull,
      paintStructures: paintStructures,
      repaintTerrain: repaintTerrain
    };
  };
})(window);
