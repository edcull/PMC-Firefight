/* PMC 2670 — Firefight : the terrain set-up (pp. 46-47): the areas rolled and the pieces laid by hand, and the pieces still to come drawn waiting.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCTerrainSet = function (B) {
    var curArea = B.curArea, isAI = B.isAI, pieceNoun = B.pieceNoun, placedSummary = B.placedSummary;
    var placingSide = B.placingSide, sideName = B.sideName, specRange = B.specRange;
    var zoneCentre = B.zoneCentre, H = B.H, ISO = B.ISO, K = B.K, R = B.R, W = B.W, cam = B.cam, ui = B.ui;
    // from modules installed after this one: looked up when called
    function buildScene() { return B.buildScene.apply(this, arguments); }
    function clampCam() { return B.clampCam.apply(this, arguments); }
    function drawBoard() { return B.drawBoard.apply(this, arguments); }
    function esc() { return B.esc.apply(this, arguments); }
    function render() { return B.render.apply(this, arguments); }

    /* ================= terrain set-up (pp. 46-47) =================
       "Divide the table into areas 2'x2'. Starting from a random player, the
       players alternately roll 1D6 for each area, placing the rolled terrain in it
       ... any number of terrain pieces up to the number indicated in the rolled
       column on the chosen area in any way he/she wishes." The four areas are
       taken in turn; the OpFor lays its own at once, a player taps theirs down one
       piece at a time. Once the table is set, the scenario randomises the table
       edges if it has them — so nobody knows which end is theirs while placing. */
    // what each kind of piece is called — the engine's list, so the two never differ
    var PIECE_NOUN = window.PMCEngine.PIECE_NOUN;
    /* Baking the table takes the best part of a second, so it is not done for
       every piece: a piece that has just gone down is drawn as a flat footprint
       at once, and the table is re-baked a moment after the player stops. The
       old plate stays on screen while it bakes — no black flash. */
    function queueBake() {
      if (!B.state || B.state.phase !== 'terrain') { if (B.state) { B.state.scene = null; B.state.ground = null; B.state.structs = null; } return; }
      clearTimeout(ui.bakeTimer);
      ui.bakeTimer = setTimeout(function () {
        if (!B.state || B.state.phase !== 'terrain' || !B.state.scene) return;
        buildScene();
        B.state.tset.baked = B.state.terrain.length;
        drawBoard();
      }, 650);
    }
    function terrainCard() {
      var ts = B.state.tset, a = curArea();
      var h = '<div class="card"><h2>Terrain set-up</h2>' +
        '<p class="sub">' + esc(ts.gen.name) + '. The table is four 2′ × 2′ areas; ' +
        (B.state.solo ? 'you roll a D6 for each' : 'the players take turns to roll a D6 for each') +
        ' and place up to what it gives, anywhere in that area.' +
        (B.state.scen && B.state.scen.edges ? ' Table edges are rolled once the table is set.' : '') + '</p>';
      /* The area being laid belongs to one side. Its player gets the choices and
         the buttons; anyone else — the opponent across a network — sees the same
         pieces and whose turn it is, and waits. */
      var mine = a && !isAI(a.side) && B.seats.indexOf(a.side) >= 0;
      if (a && !isAI(a.side) && !mine) {
        h += '<p class="hint"><b>' + a.name + ' — ' + esc(sideName(a.side)) + '’s roll: ' + a.roll + '.</b> ' + esc(a.row.text) + '.</p>' +
          (a.alt === null ? '<p class="sub">Waiting for them to choose.</p>' : terrainPreview(a) + '<p class="sub">Waiting for them to lay it.</p>');
      }
      if (mine) {
        h += '<p class="hint"><b>' + a.name + ' — ' + (B.state.solo ? 'your' : esc(sideName(a.side)) + '’s') + ' roll: ' +
          (a.first ? a.first + ', re-rolled ' : '') + a.roll + '.</b> ' + esc(a.row.text) + '.</p>';
        if (a.alt === null) {
          h += '<p class="sub">The result gives a choice — which will it be?</p><div class="acts">' +
            a.row.alts.map(function (alt, n) {
              return '<button class="act" data-act="talt" data-alt="' + n + '"><span>' +
                alt.map(specRange).join(' and ') + '</span></button>';
            }).join('') + '</div>';
        } else {
          var alt = a.row.alts[a.alt], spec = alt[a.spec], cnt = a.count[a.spec] || 0;
          var more = alt[a.spec + 1];
          h += '<p class="sub">Tap inside the lit area to put down <b>' + pieceNoun(spec, 1) + ' ' + (cnt + 1) + '</b> of up to ' + spec.max +
            (cnt < spec.min ? ' — at least ' + spec.min + ' must go down' : '') + '. The piece lands as close to the tap as it fits.</p>';
          if (ui.tsetHint) h += '<p class="cpwarn">' + esc(ui.tsetHint) + '</p>';
          // everything this result still has to put down, drawn; the next one outlined
          h += terrainPreview(a);
          h += '<div class="acts">';
          h += '<button class="act" data-act="trotate"><span>Turn it</span><small>A quarter turn · R or right click</small></button>';
          if (cnt >= spec.min) h += '<button class="act primary" data-act="tnext"><span>' +
            (more ? 'On to the ' + pieceNoun(more, 2) : 'Done with the ' + a.name + ' area') + '</span><small>' +
            cnt + ' ' + pieceNoun(spec, cnt) + ' placed</small></button>';
          h += '</div>';
        }
        h += '<div class="acts"><button class="act" data-act="tauto"><span>Auto-place this area</span></button>' +
          '<button class="act" data-act="tautoall"><span>Auto-place the rest</span><small>Every area left, both sides</small></button></div>';
      }
      h += '<ul class="tset">' + ts.areas.map(function (ar, n) {
        var st = n < ts.i ? (ar.placed.length ? placedSummary(ar) : 'left open')
          : n === ts.i ? 'placing now' : 'to come';
        return '<li class="' + (n === ts.i ? 'now' : n < ts.i ? 'done' : '') + '"><b>' + ar.name + '</b> · ' +
          esc(sideName(ar.side)) + (ar.roll ? ' · D6 ' + ar.roll : '') + ' — ' + st + '</li>';
      }).join('') + '</ul>';
      return h + '</div>';
    }

    /* ---------- the pieces still to come, drawn ----------
       Every piece this area's result will put down, in the order they go, drawn
       with the table's own art — the ground painted under the hills and pools,
       the buildings, walls, rocks and trees stood on it — so a player sees what
       they are about to lay rather than a list of names. The one in hand is
       outlined. The board still shows only an outline under the pointer; this is
       the picture of the set.

       Painting ground is slow, so it is done a moment after the card is shown,
       over just the patch the pieces stand on, and kept until the pieces or the
       way one is turned change. The last picture stays up while the next one is
       drawn. */
    var tprev = { key: '', url: '', wanting: '' };

    function stillToCome(a) {
      var list = [];
      if (!a || a.alt === null || !a.pieces) return list;
      a.pieces.forEach(function (row, si) {
        if (si < a.spec) return;
        var from = si === a.spec ? (a.count[si] || 0) : 0;
        row.slice(from).forEach(function (p, k) { list.push({ p: p, next: si === a.spec && k === 0 }); });
      });
      return list;
    }

    function terrainPreview(a) {
      var list = stillToCome(a);
      if (!list.length) return '';
      var key = B.state.cfg.planet + '|' + JSON.stringify(list.map(function (q) {
        return [q.p.kind, q.p.big, q.p.w, q.p.h, q.p.poly, q.p.parts, q.p.top, q.next];
      }));
      if (key !== tprev.key && key !== tprev.wanting) {
        tprev.wanting = key;
        setTimeout(function () { drawPreview(key, list); }, 40);
      }
      var label = list.length + ' piece' + (list.length === 1 ? '' : 's') + ' to lay, the next one outlined';
      return tprev.url
        ? '<img class="tprev" src="' + tprev.url + '" alt="' + label + '" title="' + label + '" style="display:block;width:100%;' +
          'max-width:360px;margin:8px 0 6px;border-radius:6px;background:#0b0f15">'
        : '<div class="tprev" style="margin:8px 0 6px;padding:18px 0;text-align:center;border-radius:6px;background:#0b0f15;' +
          'font-size:12px;opacity:.7">Drawing the pieces…</div>';
    }

    function drawPreview(key, list) {
      if (key !== tprev.wanting) return;             // a newer set has been asked for since
      try {
        /* Lay them out in rows that run straight across the screen. On this
           projection that is along x, back along y: a step of d in x and -d in
           y moves a piece sideways on screen and not up or down. */
        var laid = [], GAP = 1.2, ROW = 26;
        var rows = [[]], rowLen = 0;
        list.forEach(function (q) {
          var span = (q.p.w + q.p.h) / 2 + GAP;
          if (rows[rows.length - 1].length && rowLen + span > ROW) { rows.push([]); rowLen = 0; }
          rows[rows.length - 1].push(q); rowLen += span;
        });
        // the rows stacked back from the middle of the table, the whole block centred on it
        var deeps = rows.map(function (row) { return row.reduce(function (m, q) { return Math.max(m, Math.max(q.p.w, q.p.h)); }, 0); });
        var stack = deeps.reduce(function (s3, d3) { return s3 + d3 / 2 + GAP * 2; }, 0);
        var depth = -stack / 2;
        rows.forEach(function (row) {
          var total = row.reduce(function (s2, q) { return s2 + (q.p.w + q.p.h) / 2 + GAP; }, -GAP);
          var t = -total / 2, deep = 0;
          row.forEach(function (q) {
            var p = JSON.parse(JSON.stringify(q.p));
            var half = (p.w + p.h) / 4;
            var cx = W / 2 + depth + (t + half), cy = H / 2 + depth - (t + half);
            R.placePiece(p, cx - p.w / 2, cy - p.h / 2, p.w, p.h);
            laid.push({ p: p, next: q.next });
            t += half * 2 + GAP;
            deep = Math.max(deep, Math.max(p.w, p.h));
          });
          depth += deep / 2 + GAP * 2;
        });
        var terrain = laid.map(function (q) { return q.p; });

        // the patch of plate they stand on, with room above for roofs and treetops
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        terrain.forEach(function (p) {
          [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]].forEach(function (c) {
            var sp = ISO.toScreen(c[0], c[1]);
            x0 = Math.min(x0, sp.x); x1 = Math.max(x1, sp.x); y0 = Math.min(y0, sp.y); y1 = Math.max(y1, sp.y);
          });
        });
        var clip = { x0: x0 - K * 1.2, x1: x1 + K * 1.2, y0: y0 - K * 4.5, y1: y1 + K * 1.2 };
        var seed = 7919;
        var ground = ISO.bakeGround(terrain, seed, B.state.cfg.planet, clip);
        var props = ISO.buildProps(terrain, [], seed, B.state.cfg.planet);

        var cw = Math.round(clip.x1 - clip.x0), chh = Math.round(clip.y1 - clip.y0);
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = chh;
        var g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#0b0f15'; g.fillRect(0, 0, cw, chh);
        g.drawImage(ground, clip.x0, clip.y0, cw, chh, 0, 0, cw, chh);
        g.save();
        g.translate(-clip.x0, -clip.y0);
        // the piece in hand: its footprint outlined on the ground, under anything standing on it
        laid.forEach(function (q) {
          if (!q.next) return;
          var p = q.p;
          var shapes = p.parts ? p.parts.map(function (r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })
            : [p.poly || [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]]];
          shapes.forEach(function (pts) {
            g.beginPath();
            pts.forEach(function (c, n) { var sp = ISO.toScreen(c[0], c[1]); if (n) g.lineTo(sp.x, sp.y); else g.moveTo(sp.x, sp.y); });
            g.closePath();
            g.lineWidth = 5; g.strokeStyle = 'rgba(8,10,14,.55)'; g.stroke();
            g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
          });
        });
        props.forEach(function (pr) { ISO.drawProp(g, pr, 0); });
        g.restore();

        // down to the card's size, smoothed: this is a reduction, not a zoom
        var MAXW = 720, k2 = Math.min(1, MAXW / cw);
        var out = document.createElement('canvas');
        out.width = Math.round(cw * k2); out.height = Math.round(chh * k2);
        var og = out.getContext('2d');
        og.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in og) og.imageSmoothingQuality = 'high';
        og.drawImage(cv, 0, 0, out.width, out.height);
        if (!out.toDataURL) return;                   // no real canvas (the headless test page)
        if (key !== tprev.wanting) return;
        tprev.key = key; tprev.url = out.toDataURL('image/png');
        render();
      } catch (e) {
        // a picture that cannot be drawn is not worth stopping the set-up for
        if (window.console) console.error('terrain preview', e);
      }
    }

    function lookAtDeployment(forSide) {
      var side = forSide || placingSide();
      var at = side ? zoneCentre(side) : { x: W / 2, y: H / 2 };
      var mid = ISO.toScreen(at.x, at.y);
      cam.x = cam.tx = mid.x; cam.y = cam.ty = mid.y;
      clampCam();
    }

    // arrivals: arrive.js (installed with the modules, below)
    // the actions on offer, the results feed and the phone's tabs: actions.js (installed with the modules, below)

    return {
      PIECE_NOUN: PIECE_NOUN,
      lookAtDeployment: lookAtDeployment,
      queueBake: queueBake,
      terrainCard: terrainCard
    };
  };
})(window);
