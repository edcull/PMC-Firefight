/* PMC 2670 — Firefight : Close Encounters' compounds (Appendix 1, p. 157): the
   underground base, the mine, the ship laid out as corridors, rooms and halls
   joined by doors, with solid bulkhead everywhere else.

   The compound is drawn on a 3" grid, the widest a corridor may be. Each floor
   cell belongs to one section: a corridor section (a straight run, up to 12"),
   a room (up to 9" a side) or a hall (anything bigger). Between two cells of
   one section the way is open; between two sections it is open only where a
   corridor was dug through, and a door may stand there. Anywhere else two
   floor cells side by side have a wall between them.

   What it hands back is ordinary terrain, so every rule that reads the table
   reads a compound the same way:
     - `corridor`, `room`, `hall`: the floor sections, open ground;
     - `bulkhead`: solid rock or plating, impassable and blocking sight, laid as
       a few big blocks for the solid cells and thin strips for the walls
       between sections;
     - `door`: linear, blocking sight, crossed freely (p. 157) — and destructible.
   and `compound`, the grid and the entry points on each long edge. */
(function (root) {
  'use strict';

  var CELL = 3;                 // a corridor is up to 3" wide (p. 157)
  var RUN = 4;                  // ...and a section of it never longer than 12"
  var WALL = 0.4;               // a wall between two sections, drawn and ruled this thick
  var DOOR = 0.5;               // a door across its doorway

  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* The corridor cells (marked `corr` in the grid) cut into sections: straight
     runs of up to four cells, along the way the cells are open to each other.
     The grid is rewritten in place; the axis of each new section handed back. */
  function cutCorridors(cols, rows, grid, kindOf, open, corr) {
    var N = cols * rows;
    function idx(i, j) { return j * cols + i; }
    function ek(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
    function linkedTo(c, d) {
      var i = c % cols, j = (c / cols) | 0, ni = i + d[0], nj = j + d[1];
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) return -1;
      var nc = idx(ni, nj);
      return grid[nc] === corr && open[ek(c, nc)] ? nc : -1;
    }
    var axisOf = {};
    for (var c0 = 0; c0 < N; c0++) {
      if (grid[c0] !== corr) continue;
      // the longer of the two straight runs through this cell, as far as four
      var runs = [[[1, 0], [-1, 0]], [[0, 1], [0, -1]]].map(function (dirs) {
        var cells = [c0];
        dirs.forEach(function (d) {
          var cc = c0;
          while (cells.length < RUN) { var nx = linkedTo(cc, d); if (nx < 0) break; cells.push(nx); cc = nx; }
        });
        return cells;
      });
      var pick = runs[0].length >= runs[1].length ? 0 : 1;
      var s = kindOf.length; kindOf.push('corridor'); axisOf[s] = runs[pick].length > 1 ? (pick === 0 ? 'h' : 'v') : null;
      runs[pick].forEach(function (cc) { grid[cc] = s; });
    }
    return axisOf;
  }

  /* One try at a compound on a table `w` x `h` inches. Entry points are on the
     two long edges that the players come in from: x = 0 (`L`) and x = w (`R`). */
  function attempt(w, h, rand, opts) {
    var cols = Math.floor(w / CELL), rows = Math.floor(h / CELL);
    var N = cols * rows;
    var grid = new Int16Array(N).fill(-1);          // the section a cell is in, -1 solid
    var kindOf = [];                                // per section: 'room', 'hall', 'corridor'
    var open = {};                                  // edges dug through: 'a|b' (a < b) -> true
    function idx(i, j) { return j * cols + i; }
    function ek(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

    /* --- rooms and halls, a cell clear of each other and of the entry columns --- */
    var rooms = [];
    var want = Math.max(4, Math.round(N / 42)), halls = rows > 18 ? 2 : 1;
    var need = opts.rooms || 0;
    for (var t = 0; t < 400 && rooms.length < want; t++) {
      var hall = rooms.length < halls;
      var rw = hall ? 4 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2);
      var rh = hall ? 3 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2);
      if (rand() < 0.5) { var sw = rw; rw = rh; rh = sw; }
      var ri = 3 + Math.floor(rand() * (cols - 6 - rw + 1)), rj = 1 + Math.floor(rand() * (rows - 2 - rh + 1));
      if (ri < 3 || rj < 1 || ri + rw > cols - 3 || rj + rh > rows - 1) continue;
      var clash = rooms.some(function (r) {
        return ri <= r.i + r.w && ri + rw >= r.i && rj <= r.j + r.h && rj + rh >= r.j;
      });
      if (clash) continue;
      rooms.push({ i: ri, j: rj, w: rw, h: rh, kind: hall ? 'hall' : 'room' });
    }
    if (rooms.length < 3 || rooms.filter(function (r) { return r.kind === 'room'; }).length < need) return null;
    rooms.forEach(function (r) {
      var s = kindOf.length; kindOf.push(r.kind); r.sec = s;
      for (var jj = r.j; jj < r.j + r.h; jj++) for (var ii = r.i; ii < r.i + r.w; ii++) {
        grid[idx(ii, jj)] = s;
        if (ii > r.i) open[ek(idx(ii - 1, jj), idx(ii, jj))] = true;
        if (jj > r.j) open[ek(idx(ii, jj - 1), idx(ii, jj))] = true;
      }
    });

    /* --- entry points, spread down each long edge --- */
    var nEntry = opts.entries || (rows > 18 ? 3 : 2);
    var entries = { L: [], R: [] };
    ['L', 'R'].forEach(function (side) {
      var band = (rows - 2) / nEntry;
      for (var e = 0; e < nEntry; e++) {
        var j0 = 1 + Math.floor(e * band), j1 = Math.max(j0, Math.floor((e + 1) * band) - 1);
        entries[side].push({ i: side === 'L' ? 0 : cols - 1, j: j0 + Math.floor(rand() * (j1 - j0 + 1)) });
      }
    });

    /* --- corridors: dug from node to node, round the rooms, preferring straight
       runs and old corridor to new --- */
    var CORR = -2;                                  // a corridor cell, not yet cut into sections
    var nodes = rooms.map(function (r) { return { room: r, x: r.i + r.w / 2, y: r.j + r.h / 2 }; });
    entries.L.concat(entries.R).forEach(function (e) { nodes.push({ entry: e, x: e.i + 0.5, y: e.j + 0.5 }); });
    function inRoom(c, r) { var i = c % cols, j = (c / cols) | 0; return i >= r.i && i < r.i + r.w && j >= r.j && j < r.j + r.h; }
    function dig(a, b) {
      // a search over (cell, heading); the start is the whole of a room, or the entry cell
      var H = 4, D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      var cost = new Float64Array(N * H).fill(Infinity), came = new Int32Array(N * H).fill(-1);
      var heap = [];
      function push(c, h, v) { heap.push([v, c, h]); var n = heap.length - 1; while (n > 0) { var p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; var q = heap[p]; heap[p] = heap[n]; heap[n] = q; n = p; } }
      function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var n = 0; for (;;) { var l = 2 * n + 1, r2 = l + 1, m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2; if (m === n) break; var q = heap[m]; heap[m] = heap[n]; heap[n] = q; n = m; } } return top; }
      var starts = a.room ? [] : [idx(a.entry.i, a.entry.j)];
      if (a.room) for (var jj = a.room.j; jj < a.room.j + a.room.h; jj++) for (var ii = a.room.i; ii < a.room.i + a.room.w; ii++) starts.push(idx(ii, jj));
      starts.forEach(function (c) { for (var h0 = 0; h0 < H; h0++) { cost[c * H + h0] = 0; push(c, h0, 0); } });
      function goal(c) { return b.room ? inRoom(c, b.room) : c === idx(b.entry.i, b.entry.j); }
      var end = -1;
      while (heap.length) {
        var top = pop(), v = top[0], c = top[1], hd = top[2];
        if (v > cost[c * H + hd]) continue;
        if (goal(c) && !(a.room && inRoom(c, a.room))) { end = c * H + hd; break; }
        var ci = c % cols, cj = (c / cols) | 0;
        for (var k = 0; k < 4; k++) {
          var ni = ci + D[k][0], nj = cj + D[k][1];
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          var nc = idx(ni, nj), g = grid[nc];
          // through another room never; along the entry columns only at the entry itself
          var isGoal = goal(nc);
          if (g >= 0 && !isGoal && !(a.room && inRoom(nc, a.room))) continue;
          if ((ni === 0 || ni === cols - 1) && !isGoal && starts.indexOf(nc) < 0) continue;
          // leaving a room or an entry, or entering one, only straight out of its side
          var step = g === CORR ? 0.55 : 1;
          if (k !== hd && !(a.room && inRoom(c, a.room)) && starts.indexOf(c) < 0) step += 0.9;
          // a corridor run along a room's wall is fine, but new corridor hugging old is not wanted
          if (g === -1) {
            for (var k2 = 0; k2 < 4; k2++) {
              var hi = ni + D[k2][0], hj = nj + D[k2][1];
              if (hi < 0 || hj < 0 || hi >= cols || hj >= rows) continue;
              var hc = idx(hi, hj);
              if (hc !== c && grid[hc] === CORR) step += 0.8;
            }
          }
          var nv = v + step + rand() * 0.25;
          if (nv < cost[nc * H + k]) { cost[nc * H + k] = nv; came[nc * H + k] = c * H + hd; push(nc, k, nv); }
        }
      }
      if (end < 0) return false;
      // walk back, marking the corridor and the way through
      var cur = end, path = [];
      while (cur >= 0) { path.push((cur / H) | 0); cur = came[cur]; }
      path.reverse();
      for (var p = 0; p < path.length; p++) {
        var cc = path[p];
        if (grid[cc] === -1) grid[cc] = CORR;
        if (p > 0) open[ek(path[p - 1], cc)] = true;
      }
      return true;
    }
    // a tree joining every node, nearest first, and a few loops besides
    var linked = [0], pairs = [];
    while (linked.length < nodes.length) {
      var best = null;
      linked.forEach(function (a) {
        nodes.forEach(function (n, b) {
          if (linked.indexOf(b) >= 0) return;
          // an entry joins the compound through a room or a corridor, never straight to the far edge
          if (nodes[a].entry && n.entry) return;
          var d = Math.abs(nodes[a].x - n.x) + Math.abs(nodes[a].y - n.y);
          if (!best || d < best.d) best = { a: a, b: b, d: d };
        });
      });
      if (!best) return null;
      linked.push(best.b); pairs.push([best.a, best.b]);
    }
    nodes.forEach(function (n, a) {
      if (!n.room || rand() > 0.45) return;
      var far = nodes.map(function (m, b) { return { b: b, d: Math.abs(m.x - n.x) + Math.abs(m.y - n.y) }; })
        .filter(function (q) { return q.b !== a && nodes[q.b].room && !pairs.some(function (pr) { return (pr[0] === a && pr[1] === q.b) || (pr[1] === a && pr[0] === q.b); }); })
        .sort(function (p1, p2) { return p1.d - p2.d; })[0];
      if (far) pairs.push([a, far.b]);
    });
    for (var pi = 0; pi < pairs.length; pi++) if (!dig(nodes[pairs[pi][0]], nodes[pairs[pi][1]])) return null;

    var axisOf = cutCorridors(cols, rows, grid, kindOf, open, CORR);

    /* --- entries must not be seen from the enemy's edge: a straight corridor
       running the width of the table is no good --- */
    for (var jr = 0; jr < rows; jr++) {
      var through = true;
      for (var ir = 0; ir < cols && through; ir++) {
        if (grid[idx(ir, jr)] < 0) through = false;
        else if (ir > 0 && !open[ek(idx(ir - 1, jr), idx(ir, jr))]) through = false;
      }
      if (through) return null;
    }
    // ...nor any entry corridor that runs straight on further than half the table
    var straight = true;
    ['L', 'R'].forEach(function (side) {
      entries[side].forEach(function (e) {
        var run = 0, i = e.i, d = side === 'L' ? 1 : -1;
        while (i >= 0 && i < cols && grid[idx(i, e.j)] >= 0 && (i === e.i || open[ek(idx(i - d, e.j), idx(i, e.j))])) { run++; i += d; }
        if (run > cols / 2) straight = false;
      });
    });
    if (!straight) return null;

    return { cols: cols, rows: rows, grid: grid, kindOf: kindOf, axisOf: axisOf, open: open, rooms: rooms, entries: entries };
  }

  /* The pieces of terrain a laid-out compound stands as. */
  function piecesOf(g, opts) {
    var cols = g.cols, rows = g.rows, grid = g.grid, out = [];
    function idx(i, j) { return j * cols + i; }
    function ek(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
    // each section, as the rectangle of its cells
    var box = {};
    for (var c = 0; c < grid.length; c++) {
      var s = grid[c];
      if (s < 0) continue;
      var i = c % cols, j = (c / cols) | 0, b = box[s];
      if (!b) box[s] = { i0: i, j0: j, i1: i, j1: j };
      else { b.i0 = Math.min(b.i0, i); b.j0 = Math.min(b.j0, j); b.i1 = Math.max(b.i1, i); b.j1 = Math.max(b.j1, j); }
    }
    var names = { room: 0, hall: 0, corridor: 0 };
    Object.keys(box).forEach(function (k) {
      var s = +k, b = box[s], kind = g.kindOf[s];
      names[kind]++;
      var p = { kind: kind, x: b.i0 * CELL, y: b.j0 * CELL, w: (b.i1 - b.i0 + 1) * CELL, h: (b.j1 - b.j0 + 1) * CELL, sec: s };
      if (kind === 'corridor') p.axis = g.axisOf[s] || null;
      else p.name = (kind === 'hall' ? 'Hall ' : 'Room ') + names[kind];
      /* "Some sections may be designated as dangerous due to the presence of
         explosive materials, toxic chemicals, fragile tanks" (p. 158): the odd room
         or hall of the compound, at the chance asked for (opts.danger). */
      if (kind !== 'corridor' && g.danger && g.danger[s]) p.dangerous = true;
      out.push(p);
    });
    // the solid cells, gathered into as few blocks as will cover them
    var done = new Uint8Array(grid.length);
    for (var j0 = 0; j0 < rows; j0++) {
      for (var i0 = 0; i0 < cols; i0++) {
        var c0 = idx(i0, j0);
        if (grid[c0] >= 0 || done[c0]) continue;
        var w = 1;
        while (i0 + w < cols && grid[idx(i0 + w, j0)] < 0 && !done[idx(i0 + w, j0)]) w++;
        var h = 1;
        for (;;) {
          if (j0 + h >= rows) break;
          var row = true;
          for (var q = 0; q < w; q++) { var cq = idx(i0 + q, j0 + h); if (grid[cq] >= 0 || done[cq]) { row = false; break; } }
          if (!row) break;
          h++;
        }
        for (var jj = 0; jj < h; jj++) for (var ii = 0; ii < w; ii++) done[idx(i0 + ii, j0 + jj)] = 1;
        var bx = i0 * CELL, by = j0 * CELL, bw = w * CELL, bh = h * CELL;
        // the last cells run on to the table's edge, where the grid stops short of it
        if (i0 + w === cols) bw = opts.w - bx;
        if (j0 + h === rows) bh = opts.h - by;
        out.push({ kind: 'bulkhead', x: bx, y: by, w: bw, h: bh });
      }
    }
    // past the last row and column of cells (a table not a whole number of cells): solid
    // the walls and doors between sections
    var doors = 0;
    for (var cj = 0; cj < rows; cj++) {
      for (var ci = 0; ci < cols; ci++) {
        var a = idx(ci, cj);
        if (grid[a] < 0) continue;
        [[1, 0], [0, 1]].forEach(function (d) {
          var ni = ci + d[0], nj = cj + d[1];
          if (ni >= cols || nj >= rows) return;
          var b2 = idx(ni, nj);
          if (grid[b2] < 0 || grid[b2] === grid[a]) return;
          var vert = d[0] === 1;                   // the edge between them runs up and down
          var ex = ni * CELL, ey = nj * CELL;       // where the shared edge is
          if (!g.open[ek(a, b2)]) {
            out.push(vert ? { kind: 'bulkhead', thin: true, x: ex - WALL / 2, y: cj * CELL, w: WALL, h: CELL }
              : { kind: 'bulkhead', thin: true, x: ci * CELL, y: ey - WALL / 2, w: CELL, h: WALL });
            return;
          }
          if (!g.doors[ek(a, b2)]) return;
          doors++;
          out.push(vert ? { kind: 'door', x: ex - DOOR / 2, y: cj * CELL, w: DOOR, h: CELL }
            : { kind: 'door', x: ci * CELL, y: ey - DOOR / 2, w: CELL, h: DOOR });
        });
      }
    }
    // and the entry points: the corridor sections that open onto each long edge
    var entries = { L: [], R: [] };
    ['L', 'R'].forEach(function (side) {
      g.entries[side].forEach(function (e) {
        var sec = grid[idx(e.i, e.j)];
        var p = out.filter(function (r) { return r.sec === sec; })[0];
        if (p) entries[side].push({ x: p.x, y: p.y, w: p.w, h: p.h, sec: sec });
      });
    });
    return { terrain: out, entries: entries, doors: doors };
  }

  /* The generator's doors and dangerous sections. A doorway where a corridor
     meets a room or a hall mostly has a door; between two corridor sections, a
     few do. "Some sections may be designated as dangerous due to the presence
     of explosive materials, toxic chemicals, fragile tanks" (p. 158): the odd
     room or hall, at the chance asked for. */
  function furnish(g, rand, danger) {
    var cols = g.cols, grid = g.grid;
    g.doors = {}; g.danger = {};
    Object.keys(g.open).sort().forEach(function (k) {
      var ab = k.split('|'), a = +ab[0], b = +ab[1];
      if (grid[a] < 0 || grid[b] < 0 || grid[a] === grid[b]) return;
      var both = g.kindOf[grid[a]] === 'corridor' && g.kindOf[grid[b]] === 'corridor';
      if (rand() < (both ? 0.12 : 0.75)) g.doors[k] = true;
    });
    g.kindOf.forEach(function (kind, s) { if (kind !== 'corridor' && danger && rand() < danger) g.danger[s] = true; });
  }

  /* A compound for a table `w` x `h` inches. `opts.rooms`: at least so many
     rooms (not counting halls); `opts.entries`: entry points on each long edge;
     `opts.danger`: the chance a room or hall is a dangerous section. */
  function generate(w, h, rand, opts) {
    rand = rand || Math.random;
    opts = opts || {};
    for (var t = 0; t < 200; t++) {
      var g = attempt(w, h, rand, opts);
      if (!g) continue;
      furnish(g, rand, opts.danger || 0);
      var laid = piecesOf(g, { w: w, h: h });
      return {
        terrain: laid.terrain,
        compound: { cell: CELL, cols: g.cols, rows: g.rows, entries: laid.entries },
        rolls: [], generator: 'Close Encounters compound'
      };
    }
    throw new Error('no compound could be laid on a ' + w + '" x ' + h + '" table');
  }

  /* ---- hand-built compounds ----
     "Set up the complex in agreeable way" (p. 163): the players lay it out
     themselves, on the same 3" grid. A plan is
       { cols, rows, cells, walls, doors, danger }
     `cells` a string, a character a cell row by row: '.' solid, 'c' corridor,
     'r' room floor; `walls` and `doors` the edges between two floor cells
     ('a|b', the lower cell index first) closed by a wall or hung with a door —
     every other edge between floor cells is open; `danger`, a cell of each
     dangerous room. A run of room cells open to each other is one room (a hall
     when it is more than 9" a side), and has to be a rectangle; corridor cells
     are cut into straight sections of up to 12", a door always ending one; and
     every corridor cell on the left or right edge is an entry point. */
  function ekOf(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function setOf(list) { var o = {}; (list || []).forEach(function (k) { o[k] = true; }); return o; }
  function planSize(w, h) { return { cols: Math.floor(w / CELL), rows: Math.floor(h / CELL) }; }
  function blankPlan(w, h) {
    var sz = planSize(w, h);
    return { cols: sz.cols, rows: sz.rows, cells: new Array(sz.cols * sz.rows + 1).join('.'), walls: [], doors: [], danger: [] };
  }
  // a plan's grid, laid out as the generator lays its own, with what is wrong with it
  function gridOf(plan) {
    var cols = plan.cols, rows = plan.rows, N = cols * rows, cells = plan.cells || '';
    var faults = [], warnings = [];
    var grid = new Int16Array(N).fill(-1), kindOf = [], open = {}, link = {};
    var walls = setOf(plan.walls), doorSet = setOf(plan.doors);
    function idx(i, j) { return j * cols + i; }
    function kind(c) { var ch = cells.charAt(c); return ch === 'c' || ch === 'r' ? ch : '.'; }
    var CORR = -2;
    for (var c = 0; c < N; c++) if (kind(c) === 'c') grid[c] = CORR;
    // the open edges; a door keeps an edge open but ends a section there
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      var a = idx(i, j);
      if (kind(a) === '.') continue;
      [[1, 0], [0, 1]].forEach(function (d) {
        if (i + d[0] >= cols || j + d[1] >= rows) return;
        var b = idx(i + d[0], j + d[1]);
        if (kind(b) === '.') return;
        var k = ekOf(a, b);
        if (walls[k]) return;
        open[k] = true;
        if (!doorSet[k] && kind(a) === kind(b)) link[k] = true;
      });
    }
    // rooms and halls: room cells linked to each other, each a rectangle
    var rooms = [];
    for (var r0 = 0; r0 < N; r0++) {
      if (kind(r0) !== 'r' || grid[r0] >= 0) continue;
      var s = kindOf.length, stack = [r0], n = 0, i0 = cols, j0 = rows, i1 = -1, j1 = -1;
      kindOf.push('room'); grid[r0] = s;
      while (stack.length) {
        var q = stack.pop(), qi = q % cols, qj = (q / cols) | 0;
        n++; i0 = Math.min(i0, qi); j0 = Math.min(j0, qj); i1 = Math.max(i1, qi); j1 = Math.max(j1, qj);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var ni = qi + d[0], nj = qj + d[1];
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) return;
          var nc = idx(ni, nj);
          if (kind(nc) === 'r' && grid[nc] < 0 && link[ekOf(q, nc)]) { grid[nc] = s; stack.push(nc); }
        });
      }
      var rw = i1 - i0 + 1, rh = j1 - j0 + 1;
      if (n !== rw * rh) faults.push('A room has to be a rectangle (the one at column ' + (i0 + 1) + ', row ' + (j0 + 1) + ' is not).');
      kindOf[s] = rw > 3 || rh > 3 ? 'hall' : 'room';
      rooms.push({ i: i0, j: j0, w: rw, h: rh, kind: kindOf[s], sec: s });
    }
    var axisOf = cutCorridors(cols, rows, grid, kindOf, link, CORR);
    // doors only between two sections, across an open edge
    var doors = {};
    Object.keys(doorSet).forEach(function (k) {
      var ab = k.split('|'), a2 = +ab[0], b2 = +ab[1];
      if (open[k] && grid[a2] >= 0 && grid[b2] >= 0 && grid[a2] !== grid[b2]) doors[k] = true;
    });
    var danger = {};
    (plan.danger || []).forEach(function (c2) { var s2 = grid[c2]; if (s2 >= 0 && kindOf[s2] !== 'corridor') danger[s2] = true; });
    // the entry points: corridor cells on the two long edges, one a section
    var entries = { L: [], R: [] };
    ['L', 'R'].forEach(function (side) {
      var col = side === 'L' ? 0 : cols - 1, seen = {};
      for (var jj = 0; jj < rows; jj++) {
        var ec = idx(col, jj);
        if (kind(ec) !== 'c' || seen[grid[ec]]) continue;
        seen[grid[ec]] = true;
        entries[side].push({ i: col, j: jj });
      }
    });
    if (!entries.L.length) faults.push('No entry point on the left edge: run a corridor out to it.');
    if (!entries.R.length) faults.push('No entry point on the right edge: run a corridor out to it.');
    // everything reachable from the entry points
    var reach = new Uint8Array(N), todo = [];
    entries.L.concat(entries.R).forEach(function (e) { var ec = idx(e.i, e.j); reach[ec] = 1; todo.push(ec); });
    while (todo.length) {
      var t = todo.pop(), ti = t % cols, tj = (t / cols) | 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var ni = ti + d[0], nj = tj + d[1];
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) return;
        var nc = idx(ni, nj);
        if (!reach[nc] && kind(nc) !== '.' && open[ekOf(t, nc)]) { reach[nc] = 1; todo.push(nc); }
      });
    }
    var cut = 0;
    for (var c3 = 0; c3 < N; c3++) if (kind(c3) !== '.' && !reach[c3]) cut++;
    if (cut) faults.push(cut + ' floor cell' + (cut === 1 ? ' is' : 's are') + ' cut off from every entry point.');
    else if (entries.L.length && entries.R.length) {
      // the two edges joined at all (the reach above runs from both)
      var fromL = new Uint8Array(N), td = [];
      entries.L.forEach(function (e) { var ec = idx(e.i, e.j); fromL[ec] = 1; td.push(ec); });
      while (td.length) {
        var u = td.pop(), ui = u % cols, uj = (u / cols) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var ni = ui + d[0], nj = uj + d[1];
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) return;
          var nc = idx(ni, nj);
          if (!fromL[nc] && kind(nc) !== '.' && open[ekOf(u, nc)]) { fromL[nc] = 1; td.push(nc); }
        });
      }
      if (!entries.R.some(function (e) { return fromL[idx(e.i, e.j)]; })) faults.push('There is no way through from the left edge to the right.');
    }
    // a straight line of sight from edge to edge (the generator never lays one)
    for (var jr = 0; jr < rows; jr++) {
      var through = true;
      for (var ir = 0; ir < cols && through; ir++) {
        if (grid[idx(ir, jr)] < 0) through = false;
        else if (ir > 0 && !open[ekOf(idx(ir - 1, jr), idx(ir, jr))]) through = false;
      }
      if (through) { warnings.push('Row ' + (jr + 1) + ' is open from edge to edge: each side can see the other\u2019s entry.'); break; }
    }
    return { g: { cols: cols, rows: rows, grid: grid, kindOf: kindOf, axisOf: axisOf, open: open, rooms: rooms, entries: entries, doors: doors, danger: danger },
      faults: faults, warnings: warnings };
  }
  // is the plan one for this table, and can it be fought in
  // a plan as it came (saved, typed in, sent over the wire), made safe to read
  function cleanPlan(p) {
    if (!p || typeof p !== 'object') return null;
    var keys = function (l) { return Array.isArray(l) ? l.filter(function (k) { return typeof k === 'string' && /^\d+\|\d+$/.test(k); }) : []; };
    return { cols: p.cols | 0, rows: p.rows | 0, cells: typeof p.cells === 'string' ? p.cells.replace(/[^.cr]/g, '.') : '',
      walls: keys(p.walls), doors: keys(p.doors),
      danger: Array.isArray(p.danger) ? p.danger.filter(function (c) { return typeof c === 'number' && c >= 0; }) : [] };
  }
  function checkPlan(plan, w, h) {
    plan = cleanPlan(plan);
    var sz = planSize(w, h);
    if (!plan || plan.cols !== sz.cols || plan.rows !== sz.rows || (plan.cells || '').length !== sz.cols * sz.rows) {
      return { ok: false, faults: ['This compound is laid out for a different table size (' + (plan ? plan.cols * CELL + '" x ' + plan.rows * CELL + '"' : 'none') + ').'], warnings: [] };
    }
    var r = gridOf(plan);
    return { ok: !r.faults.length, faults: r.faults, warnings: r.warnings,
      rooms: r.g.rooms.filter(function (q) { return q.kind === 'room'; }).length, halls: r.g.rooms.filter(function (q) { return q.kind === 'hall'; }).length,
      entries: { L: r.g.entries.L.length, R: r.g.entries.R.length } };
  }
  // the compound a plan makes, as `generate` hands one back (null if it cannot be fought in)
  function build(plan, w, h) {
    plan = cleanPlan(plan);
    if (!checkPlan(plan, w, h).ok) return null;
    var g = gridOf(plan).g;
    var laid = piecesOf(g, { w: w, h: h });
    return {
      terrain: laid.terrain,
      compound: { cell: CELL, cols: g.cols, rows: g.rows, entries: laid.entries, built: true },
      rolls: [], generator: 'Hand-built compound'
    };
  }
  // a generated layout as a plan, to start a hand-built one from
  function planOf(g) {
    var N = g.cols * g.rows, cells = '', walls = [], doors = Object.keys(g.doors || {}), danger = [], dz = {};
    for (var c = 0; c < N; c++) {
      var s = g.grid[c];
      cells += s < 0 ? '.' : g.kindOf[s] === 'corridor' ? 'c' : 'r';
      if (s >= 0 && g.danger && g.danger[s] && !dz[s]) { dz[s] = true; danger.push(c); }
    }
    for (var j = 0; j < g.rows; j++) for (var i = 0; i < g.cols; i++) {
      var a = j * g.cols + i;
      if (g.grid[a] < 0) continue;
      [[1, 0], [0, 1]].forEach(function (d) {
        if (i + d[0] >= g.cols || j + d[1] >= g.rows) return;
        var b = (j + d[1]) * g.cols + i + d[0];
        if (g.grid[b] < 0) return;
        var k = ekOf(a, b);
        if (!g.open[k]) walls.push(k);
      });
    }
    return { cols: g.cols, rows: g.rows, cells: cells, walls: walls, doors: doors, danger: danger };
  }
  // a fresh generated compound, as a plan to edit
  function generatedPlan(w, h, rand, opts) {
    rand = rand || Math.random; opts = opts || {};
    for (var t = 0; t < 200; t++) {
      var g = attempt(w, h, rand, opts);
      if (!g) continue;
      furnish(g, rand, opts.danger != null ? opts.danger : 0.15);
      return planOf(g);
    }
    return blankPlan(w, h);
  }

  /* ---- special equipment (p. 159) ----
     "Before the game, players may select up to 4 pieces of special equipment per
     Priority Level ... Each piece may be used once per game by any unsuppressed
     friendly unit." Chosen on the battlefield step (cfg.kit), or, if not, a set
     of the four that need no fire to work with for each Priority Level. */
  var KIT = [
    { key: 'satchel', name: 'Satchel Charges', text: 'Plant them where the unit stands, then move up to its Movement. In the End phase, D6: 1-2 duds, 3-6 the section explodes (+1 with Sappers).' },
    { key: 'barrier', name: 'Ballistic Barrier', text: 'Put down a low wall up to 6" long within 1" of the unit, towards the nearest enemy.' },
    { key: 'stun', name: 'Stun Grenades', text: 'With an Assault: the defender takes D6-1 SP and cannot fire at the attackers in that Assault.' },
    { key: 'incendiary', name: 'Incendiary Grenades', text: 'Move up to Movement, then a section it stands in or sees within 6": D6 2-6 sets it on fire.' },
    { key: 'vacuum', name: 'Vacuum Charges', text: 'Move up to Movement, then a burning section it stands in or sees within 6": D6 2-6 puts the fire out.' }
  ];
  // a side's choice, kept to what there is and to 4 a Priority Level in all
  function cleanKit(k, pl) {
    var cap = 4 * Math.max(1, pl || 1), out = {}, n = 0;
    KIT.forEach(function (d) {
      var v = Math.max(0, Math.floor(+((k || {})[d.key]) || 0));
      v = Math.min(v, cap - n);
      if (v) { out[d.key] = v; n += v; }
    });
    return out;
  }
  function defaultKit(pl) { var n = Math.max(1, pl || 1); return { satchel: n, barrier: n, stun: n, incendiary: n }; }

  var KINDS = ['corridor', 'room', 'hall', 'bulkhead', 'door'];
  function isCompound(state) { return !!(state && state.compound); }
  // the floor section a point is in (a corridor, room or hall piece), or null
  function sectionAt(state, x, y) {
    var ts = state.terrain;
    for (var i = 0; i < ts.length; i++) {
      var r = ts[i];
      if ((r.kind === 'corridor' || r.kind === 'room' || r.kind === 'hall') && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  }

  root.PMCCompound = { CELL: CELL, KINDS: KINDS, generate: generate, blankPlan: blankPlan, cleanPlan: cleanPlan, layout: function (plan) { return gridOf(cleanPlan(plan)).g; }, checkPlan: checkPlan, build: build, generatedPlan: generatedPlan, planSize: planSize, isCompound: isCompound, sectionAt: sectionAt, KIT: KIT, cleanKit: cleanKit, defaultKit: defaultKit };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCCompound;
})(typeof window !== 'undefined' ? window : global);
