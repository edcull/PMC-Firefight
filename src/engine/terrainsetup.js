/* PMC 2670 — Firefight : laying the terrain: the areas, the pieces, placing and turning them, and Terrain Knowledge

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineTerrainSetup = function (E) {
    var GEN = E.GEN, H = E.H, OBJECTIVES = E.OBJECTIVES, PIECE_NOUN = E.PIECE_NOUN, R = E.R, SFX = E.SFX,
        V = E.V, W = E.W, afterTerrain = E.afterTerrain, deployOK = E.deployOK, fitView = E.fitView,
        isAI = E.isAI, logLine = E.logLine, other = E.other, paintStructures = E.paintStructures, pushRes = E.pushRes, queueBake = E.queueBake,
        render = E.render, revealConsole = E.revealConsole, setHint = E.setHint, sideName = E.sideName,
        startBattle = E.startBattle, ui = E.ui;

    function pieceNoun(spec, n) {
      var w = PIECE_NOUN[spec.kind] || [spec.kind, spec.kind + 's'];
      return (spec.big ? 'large ' : '') + w[n === 1 ? 0 : 1];
    }

    function specRange(spec) {
      return (spec.min === spec.max ? spec.max : (spec.min ? spec.min + '–' : 'up to ') + spec.max) + ' ' + pieceNoun(spec, spec.max);
    }

    function wantsManualTerrain(cfg) {
      if (cfg.mode === 'demo') return false;
      var t = cfg.terrainSetup;
      return t === 'manual';
    }

    function startTerrainSetup(built) {
      var gen = GEN.tableFor(E.state.cfg.planet);
      var starter = E.state.solo ? 'A' : (Math.random() < 0.5 ? 'A' : 'B');
      E.state.phase = 'terrain';
      E.state.tset = {
        gen: gen, memo: {}, i: -1, rolls: built.rolls, starter: starter, ghost: null, baked: 0,
        areas: GEN.areasOf(W, H).map(function (a, n) {
          a.side = E.state.solo ? 'A' : (n % 2 === 0 ? starter : other(starter));
          a.placed = []; a.count = []; a.spec = 0; a.alt = null;
          return a;
        })
      };
      logLine('note', 'Terrain set-up — ' + gen.name + '. The table is divided into four 2′ × 2′ areas; ' +
        (E.state.solo ? 'you lay all four.' : sideName(starter) + ' rolls for the first.'));
      V.newTable('whole');
      nextArea();
    }

    function curArea() {
      var ts = E.state && E.state.tset;
      return ts && E.state.phase === 'terrain' ? ts.areas[ts.i] || null : null;
    }

    function nextArea() {
      var ts = E.state.tset;
      ts.i++;
      ts.ghost = null;
      if (ts.i >= ts.areas.length) { finishTerrain(); return; }
      var a = ts.areas[ts.i];
      var r = GEN.rollArea(ts.gen, Math.random, ts.memo);
      a.roll = r.roll; a.first = r.first; a.row = r.row;
      a.alt = r.row.alts.length === 1 ? 0 : null;
      logLine('terrain', a.name + ' — ' + sideName(a.side) + ' rolls D6 ' +
        (a.first ? a.first + ', re-rolled ' : '') + a.roll + ': ' + r.row.text);
      if (isAI(a.side) || ts.autoAll) {
        autoArea(a);
        if (!ts.autoAll && !E.state.solo) pushRes({
          kind: 'Terrain', title: a.name + ' area', side: a.side,
          dice: [{ label: 'D6', value: a.roll }],
          note: sideName(a.side) + ' rolls for the ' + a.name + ' area: ' + a.row.text + '.',
          outcome: { text: a.placed.length ? 'Places ' + placedSummary(a) + '.' : 'Leaves it open.', tone: 'good' }
        });
        nextArea();
        return;
      }
      prepSpec(a);
      render();
    }

    function placedSummary(a) {
      var n = {}, order = [];
      a.placed.forEach(function (p) {
        var key = p.kind + (p.big ? '+' : '');
        if (!n[key]) { n[key] = 0; order.push({ kind: p.kind, big: p.big }); }
        n[key]++;
      });
      return order.map(function (o) { var c = n[o.kind + (o.big ? '+' : '')]; return c + ' ' + pieceNoun(o, c); }).join(' and ');
    }

    // the rolled result still to go down in this area, as the generator reads it
    function remainingAlt(a) {
      var alt = a.row.alts[a.alt === null ? Math.floor(Math.random() * a.row.alts.length) : a.alt];
      if (a.alt === null) return alt;
      return alt.slice(a.spec).map(function (spec, k) {
        var done = k === 0 ? (a.count[a.spec] || 0) : 0, o = {};
        for (var key in spec) o[key] = spec[key];
        o.min = Math.max(0, spec.min - done); o.max = Math.max(0, spec.max - done);
        return o;
      });
    }

    function autoArea(a) {
      var got = GEN.fillArea(remainingAlt(a), a, E.state.terrain, OBJECTIVES, Math.random, W, H);
      got.forEach(function (p) { E.state.terrain.push(p); a.placed.push(p); });
      completeArea(a);
    }

    function completeArea(a) {
      a.done = true;
      E.state.tset.rolls.push({ area: a.name, roll: a.roll, text: a.row.text, placed: a.placed.map(function (p) { return p.kind; }) });
      logLine('terrain', a.name + ' — ' + (a.placed.length ? placedSummary(a) : 'left open') + '.');
      queueBake();
    }

    /* Roll the footprint of the next piece to go down, and give it its outline,
       so the player sees exactly what they are putting on the table. */
    /* Every piece the area's result can put down is rolled as soon as the result
       is known — its size and its shape — so the player sees the whole set, and
       lays exactly the pieces shown, in order. Only the next one is "in hand": it
       is the one outlined under the pointer, and the one a quarter turn turns. */
    function makePiece(a, spec, shrink, turns) {
      var sz = GEN.sizeFor(spec, Math.random, shrink || 1);
      var g = { kind: spec.kind, x: 0, y: 0, w: Math.min(sz.w, a.w - 1), h: Math.min(sz.h, a.h - 1) };
      if (spec.big) g.big = true;
      if (R.shapePiece) R.shapePiece(g, Math.random);
      for (var t = 0; t < (turns || 0); t++) quarterTurn(g);
      return g;
    }
    function rollPieces(a) {
      a.pieces = a.row.alts[a.alt].map(function (spec) {
        var out = [];
        for (var i = 0; i < spec.max; i++) out.push(makePiece(a, spec, 1, 0));
        return out;
      });
      a.piecesFor = a.alt;
    }
    /* A quarter turn, about the piece's own corner: the table-turning the rules
       already do, then the piece set back where it was. The table is square, so
       a turn of it is a turn of anything on it. */
    function quarterTurn(p) {
      R.turnPiece(p, 1);
      R.placePiece(p, 0, 0, p.w, p.h);
      p.turns = ((p.turns || 0) + 1) % 4;
      return p;
    }
    function inHand(a) {
      return a.pieces && a.pieces[a.spec] ? a.pieces[a.spec][a.count[a.spec] || 0] || null : null;
    }
    function prepSpec(a) {
      var ts = E.state.tset;
      ts.ghost = null;
      if (a.alt === null) return;                   // waiting on the player's choice
      if (!a.pieces || a.piecesFor !== a.alt) rollPieces(a);
      var alt = a.row.alts[a.alt];
      while (a.spec < alt.length && (a.count[a.spec] || 0) >= alt[a.spec].max) a.spec++;
      if (a.spec >= alt.length) { completeArea(a); nextArea(); return; }
      var spec = alt[a.spec], n = a.count[a.spec] || 0;
      /* A crowded area gets a smaller piece rather than none, as the generator
         does: the one in hand is rolled again at the smaller size, turned the
         way the player had it. */
      if (a.shrink && a.shrink < 1) {
        var was = a.pieces[a.spec][n];
        a.pieces[a.spec][n] = makePiece(a, spec, a.shrink, was ? was.turns : 0);
      }
      ts.ghost = clonePiece(a.pieces[a.spec][n]);
    }

    function clonePiece(t) { return JSON.parse(JSON.stringify(t)); }

    /* The nearest place to (cx, cy) the next piece fits: wholly in its area, on
       the table, and half an inch clear of everything already down. */
    function fitGhost(a, cx, cy) {
      var g = E.state.tset.ghost;
      if (!g) return null;
      var x0 = Math.max(a.x, 0.5), x1 = Math.min(a.x + a.w, W - 0.5) - g.w;
      var y0 = Math.max(a.y, 0.5), y1 = Math.min(a.y + a.h, H - 0.5) - g.h;
      if (x1 < x0 || y1 < y0) return null;
      /* Tapped on a hill: a wood, a ruin, rubble, rocks or a building may stand
         on it (p. 42) — inside its crest, clear of anything else up there. */
      if (GEN.ONHILL[g.kind]) {
        var hill = E.state.terrain.filter(function (h) {
          return h.kind === 'hill' && R.inRect(cx, cy, h) && h.w >= g.w + 1 && h.h >= g.h + 1;
        })[0];
        if (hill) {
          var hx = Math.max(hill.x + 0.5, Math.min(hill.x + hill.w - 0.5 - g.w, cx - g.w / 2));
          var hy = Math.max(hill.y + 0.5, Math.min(hill.y + hill.h - 0.5 - g.h, cy - g.h / 2));
          var others = E.state.terrain.filter(function (o) { return o !== hill; });
          if (!GEN.clashes({ x: hx, y: hy, w: g.w, h: g.h }, others)) return { x: hx, y: hy, onHill: true };
        }
      }
      var best = null, bd = Infinity;
      for (var r = 0; r <= 12; r += 0.5) {
        var steps = r ? Math.max(8, Math.round(r * 8)) : 1;
        for (var k = 0; k < steps; k++) {
          var ang = k / steps * Math.PI * 2;
          var x = Math.max(x0, Math.min(x1, cx + Math.cos(ang) * r - g.w / 2));
          var y = Math.max(y0, Math.min(y1, cy + Math.sin(ang) * r - g.h / 2));
          if (GEN.clashes({ x: x, y: y, w: g.w, h: g.h }, E.state.terrain)) continue;
          var d = Math.hypot(x + g.w / 2 - cx, y + g.h / 2 - cy);
          if (d < bd) { bd = d; best = { x: x, y: y }; }
        }
        if (best) return best;
      }
      return null;
    }

    function terrainTap(p) {
      var a = curArea();
      if (!a || isAI(a.side) || !E.state.tset.ghost) return;
      if (p.x < a.x - 2 || p.x > a.x + a.w + 2 || p.y < a.y - 2 || p.y > a.y + a.h + 2) {
        ui.tsetHint = 'That is outside the ' + a.name + ' area — tap inside the lit quarter of the table.';
        render(); return;
      }
      var spot = fitGhost(a, p.x, p.y);
      if (!spot) {
        // a crowded area gets a smaller piece rather than none, as the generator does
        a.shrink = Math.max(0.55, (a.shrink || 1) * 0.8);
        prepSpec(a);
        ui.tsetHint = 'No room for it there. The next one is drawn a little smaller — try again, or move on.';
        render(); return;
      }
      var pc = clonePiece(E.state.tset.ghost);
      if (spot.onHill) pc.onHill = true;
      R.placePiece(pc, spot.x, spot.y);
      E.state.terrain.push(pc); a.placed.push(pc);
      if (pc.onHill && GEN.levelUnder) GEN.levelUnder(E.state.terrain);
      a.count[a.spec] = (a.count[a.spec] || 0) + 1;
      ui.tsetHint = '';
      if (SFX && SFX.click) SFX.click();
      queueBake();
      prepSpec(a);
      render();
    }

    function terrainAct(act, arg) {
      var a = curArea();
      if (!a) return;
      ui.tsetHint = '';
      if (act === 'talt') { a.alt = +arg; a.spec = 0; a.count = []; prepSpec(a); }
      else if (act === 'tnext') {
        var spec = a.row.alts[a.alt][a.spec];
        if ((a.count[a.spec] || 0) < spec.min) return;
        a.spec++; a.shrink = 1; prepSpec(a);
      }
      else if (act === 'trotate') {
        // a quarter turn of the piece in hand
        var hand = inHand(a);
        if (!hand) return;
        quarterTurn(hand);
        E.state.tset.ghost = clonePiece(hand);
      }
      else if (act === 'tauto') { autoArea(a); nextArea(); return; }
      else if (act === 'tautoall') { E.state.tset.autoAll = true; autoArea(a); nextArea(); return; }
      render();
    }

    /* The table is set. "Before the battle, players randomize opposite table
       edges" (p. 50): the game always lays one company along the west edge and
       the other along the east, so the table itself is turned to bring the rolled
       edge round to the west. */
    function finishTerrain() {
      var ts = E.state.tset;
      ts.ghost = null;
      E.state.phase = 'deploy';
      E.state.genCount = E.state.terrain.length;
      if (E.state.scen && E.state.scen.edges) {
        var EDGES = ['west', 'north', 'east', 'south'];
        var d = 1 + Math.floor(Math.random() * 4), k = d - 1;
        E.state.terrain.forEach(function (t) { R.turnPiece(t, k); });
        var ea = EDGES[k], eb = EDGES[(k + 2) % 4];
        E.state.edges = { A: ea, B: eb, roll: d, turned: k };
        var turn = ['', 'a quarter turn', 'half a turn', 'three quarters of a turn'][k];
        var line = sideName('A') + ' takes the ' + ea + ' edge, ' + sideName('B') + ' the ' + eb + '.';
        logLine('note', 'Table edges — D4 ' + d + ': ' + line + (k ? ' The table is turned ' + turn + ' to put them where the game lays them out.' : ''));
        pushRes({
          kind: 'Table edges', title: 'The ' + ea + ' edge for ' + E.state.cfg.nameA,
          dice: [{ label: 'D4', value: d }],
          note: 'Before the battle, players randomize opposite table edges — after the terrain is down, so nobody knew which end was theirs while placing it.',
          list: [{ text: line }].concat(k ? [{ text: 'The table is turned ' + turn + ': ' + sideName('A') + '’s edge now runs along the upper left of the view, ' + sideName('B') + '’s along the lower right.' }] : [])
        });
      }
      afterTerrain({ terrain: E.state.terrain, rolls: ts.rolls, generator: ts.gen.name, manual: true });
    }

    /* Detailed Terrain Knowledge (p. 141): the tribe moves two terrain pieces up to
       12" after the table is set. It pulls cover toward the middle of its own half,
       where its troops will want it, keeping clear of objectives and other pieces. */
    function terrainKnowledge(side) {
      var mid = side === 'A' ? { x: W * 0.3, y: H * 0.5 } : { x: W * 0.7, y: H * 0.5 };
      var pieces = E.state.terrain.filter(function (r) {
        var t = R.TERRAIN[r.kind];
        return t && (t.cover || t.blocks) && !t.impassable && t.destructible !== 'target' && r.w * r.h < 40 && !r.fixed;
      }).sort(function (a, b) {
        return R.inches(b.x + b.w / 2, b.y + b.h / 2, mid.x, mid.y) - R.inches(a.x + a.w / 2, a.y + a.h / 2, mid.x, mid.y);
      });
      var moved = [];
      for (var i = 0; i < pieces.length && moved.length < 2; i++) {
        var r = pieces[i], cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        var dx = mid.x - cx, dy = mid.y - cy, d = Math.hypot(dx, dy);
        if (d < 3) continue;
        var step = Math.min(12, d - 2), nx = r.x + dx / d * step, ny = r.y + dy / d * step;
        if (nx < 0 || ny < 0 || nx + r.w > W || ny + r.h > H) continue;
        var clash = E.state.terrain.some(function (o) {
          return o !== r && nx < o.x + o.w + 0.5 && nx + r.w + 0.5 > o.x && ny < o.y + o.h + 0.5 && ny + r.h + 0.5 > o.y;
        }) || E.state.objectives.some(function (o) {
          return o.x > nx - 3 && o.x < nx + r.w + 3 && o.y > ny - 3 && o.y < ny + r.h + 3;
        });
        if (clash) continue;
        R.placePiece(r, nx, ny);                     // the outline goes with it
        moved.push(R.TERRAIN[r.kind].name.toLowerCase() + ' ' + step.toFixed(1) + '"');
      }
      if (moved.length) logLine('terrain', sideName(side) + ' — Detailed Terrain Knowledge: moves the ' + moved.join(' and the ') + '.');
    }

    /* ---- a player putting pieces on the table by hand: Last Stand's barricades,
       Fortify and Strike!'s field fortifications, Detailed Terrain Knowledge's
       moves. One spec at a time off state.placeQueue into state.placeAsk. ---- */
    function nextPlace() {
      E.state.placeAsk = (E.state.placeQueue && E.state.placeQueue.shift()) || null;
      if (E.state.placeAsk) {
        var pa = E.state.placeAsk;
        setHint(null, pa.why === 'terrain' ? 'Detailed Terrain Knowledge: tap a piece, then where it goes (up to 12").'
          : pa.why === 'takeover' ? 'Hostile takeover: tap the table within 12" of the objective to put down your fortifications — or let them be placed for you.'
          : 'Tap the table to put down ' + (pa.why === 'fortify' ? 'a field fortification' : 'a barricade') + ' — ' + pa.left + ' to place.');
        fitView();
        revealConsole();
      } else if (E.state.phase === 'deploy') E.lookAtDeployment();   // back to the ground to fill
      render();
    }
    // may a barricade stand here? on the table, clear of terrain and troops, in the right ground
    function placeOK(pa, r) {
      if (r.x < 0.5 || r.y < 0.5 || r.x + r.w > W - 0.5 || r.y + r.h > H - 0.5) return 'Not so close to the edge.';
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (pa.why === 'fortify' && !deployOK(pa.side, cx, cy)) return 'Field fortifications go in your own deployment zone.';
      if (pa.why === 'laststand' && deployOK(other(pa.side), cx, cy)) return 'Not in the enemy deployment zone.';
      if (E.state.terrain.some(function (o) { return r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y; })) return 'That ground is taken.';
      if (E.state.units.some(function (o) { return o.alive && o.x >= 0 && o.x > r.x - 1 && o.x < r.x + r.w + 1 && o.y > r.y - 1 && o.y < r.y + r.h + 1; })) return 'Troops are standing there.';
      return null;
    }
    // the pieces Detailed Terrain Knowledge may move
    function movablePieces() {
      return E.state.terrain.filter(function (r) {
        var t = R.TERRAIN[r.kind];
        return t && t.destructible !== 'target' && !r.fixed && r.kind !== 'objective' && r.kind !== 'searchsite';
      });
    }
    function placeAt(x, y) {
      var pa = E.state.placeAsk;
      if (!pa) return 'Nothing to place.';
      if (pa.kind === 'fort') {
        var SCN = root.PMCScen;
        var fr = SCN.fortRect(pa.piece, x, y, pa.len, pa.vertical);
        var fw = SCN.fortWhy(E.state, fr);
        if (fw) return fw;
        E.state.terrain.push(fr);
        fortLaid(pa, fr);
      } else if (pa.kind === 'barricade') {
        var len = pa.len || 3, th = pa.why === 'fortify' ? 0.6 : 1;
        var r = pa.vertical ? { kind: 'barricade', x: x - th / 2, y: y - len / 2, w: th, h: len }
          : { kind: 'barricade', x: x - len / 2, y: y - th / 2, w: len, h: th };
        var why = placeOK(pa, r);
        if (why) return why;
        E.state.terrain.push(r);
        paintStructures();
        pa.left--;
      } else {
        var pool = movablePieces();
        if (pa.pick == null) {
          var hit = pool.filter(function (q) { return R.inRect(x, y, q); })[0];
          if (!hit) return 'Tap a piece of terrain to move.';
          pa.pick = E.state.terrain.indexOf(hit);
          setHint(null, 'Now tap where the ' + R.TERRAIN[hit.kind].name.toLowerCase() + ' goes — up to 12" away.');
          render();
          return null;
        }
        var q = E.state.terrain[pa.pick], ocx = q.x + q.w / 2, ocy = q.y + q.h / 2;
        if (R.inRect(x, y, q)) { pa.pick = null; render(); return null; }      // tap it again to put it down
        if (Math.hypot(x - ocx, y - ocy) > 12) return 'Up to 12" from where it stands.';
        var nx = x - q.w / 2, ny = y - q.h / 2;
        if (nx < 0 || ny < 0 || nx + q.w > W || ny + q.h > H) return 'It would go off the table.';
        var clash = E.state.terrain.some(function (o) {
          return o !== q && nx < o.x + o.w + 0.5 && nx + q.w + 0.5 > o.x && ny < o.y + o.h + 0.5 && ny + q.h + 0.5 > o.y;
        }) || E.state.objectives.some(function (o) { return o.x > nx - 3 && o.x < nx + q.w + 3 && o.y > ny - 3 && o.y < ny + q.h + 3; });
        if (clash) return 'Too close to other terrain or an objective.';
        R.placePiece(q, nx, ny);
        logLine('terrain', sideName(pa.side) + ' — Detailed Terrain Knowledge: moves the ' + R.TERRAIN[q.kind].name.toLowerCase() + ' ' + Math.hypot(x - ocx, y - ocy).toFixed(1) + '".');
        queueBake();
        pa.pick = null;
        pa.left--;
      }
      if (pa.left <= 0) placeDone();
      else { setHint(null, pa.left + ' more to ' + (pa.kind === 'move' ? 'move' : 'place') + '.'); render(); }
      return null;
    }
    // a Hostile takeover piece is down: count it off, and change the tool once the kind runs out
    function fortLaid(pa, r) {
      if (r.kind === 'bunker') pa.bunkers--; else pa.sections--;
      pa.left = pa.sections + pa.bunkers;
      if (pa.piece === 'bunker' && !pa.bunkers) pa.piece = 'trench';
      if (pa.piece !== 'bunker' && !pa.sections && pa.bunkers) pa.piece = 'bunker';
      pa.laid = (pa.laid || []).concat(r.kind);
      queueBake();
    }
    /* "Auto-deploy fortifications": the rest of the defender's allowance put down
       as the machine would, and the placing is over. */
    function placeAuto() {
      var pa = E.state.placeAsk;
      if (!pa || pa.kind !== 'fort') return;
      var laid = root.PMCScen.takeoverForts(E.state, pa.side, pa.sections, pa.bunkers);
      laid.forEach(function (r) { fortLaid(pa, r); });
      pa.sections = 0; pa.bunkers = 0; pa.left = 0;
      placeDone();
    }
    function placeDone() {
      var pa = E.state.placeAsk;
      if (!pa) return;
      var n = pa.total - pa.left;
      if (pa.kind === 'fort') {
        var laid = pa.laid || [];
        logLine('terrain', sideName(pa.side) + ' — Hostile takeover: ' + (laid.length ? 'digs in round the objective with ' + fortTally(laid) + '.' : 'puts up no fortifications.'));
      }
      if (pa.kind === 'barricade' && n) logLine('terrain', sideName(pa.side) + ' — ' + (pa.why === 'fortify' ? 'Fortify and Strike!: ' + n + ' field fortifications thrown up.' : 'Last Stand: ' + n + ' barricades put up.'));
      E.state.placeAsk = null;
      if (pa.then === 'entry') { E.entryFortify(); return; }     // Fortify and Strike!, in turn 1: then the Action phase
      nextPlace();
    }

    // "3 trenches, 2 low walls and a bunker"
    var FORT_NOUN = { trench: ['trench', 'trenches'], barricade: ['low wall', 'low walls'], wall: ['high wall', 'high walls'],
      wire: ['stretch of barbed wire', 'stretches of barbed wire'], bunker: ['bunker', 'bunkers'] };
    function fortTally(kinds) {
      var n = {}, order = [];
      kinds.forEach(function (k) { if (!n[k]) { n[k] = 0; order.push(k); } n[k]++; });
      var parts = order.map(function (k) { var w = FORT_NOUN[k] || [k, k]; return n[k] === 1 ? 'a ' + w[0] : n[k] + ' ' + w[1]; });
      return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    }

    return {
      placeAuto: placeAuto,
      pieceNoun: pieceNoun, specRange: specRange, wantsManualTerrain: wantsManualTerrain,
      startTerrainSetup: startTerrainSetup, curArea: curArea, placedSummary: placedSummary,
      clonePiece: clonePiece, fitGhost: fitGhost, terrainTap: terrainTap, terrainAct: terrainAct,
      terrainKnowledge: terrainKnowledge, nextPlace: nextPlace, placeAt: placeAt, placeDone: placeDone
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineTerrainSetup;
})(typeof window !== 'undefined' ? window : global);
