/* PMC 2670 — Firefight : laying out a compound by hand (Close Encounters, p. 163:
   "Set up the complex in agreeable way").

   A window over the battlefield step with the compound's 3" grid on it. The
   player paints cells as corridor, room or solid; sets the edge between two
   sections open, hung with a door, or walled; and marks rooms as dangerous.
   Corridor cells on the left and right edges are the entry points. The plan
   (rules/compound.js) is checked as it is drawn, and handed back on Done.

   PMCCompoundEdit.open({ w, h, plan, onDone(plan) }) */
(function (root) {
  'use strict';
  var CMP = root.PMCCompound;
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ek(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  var TOOLS = [
    { key: 'c', name: 'Corridor', tip: 'Paint corridor: 3" wide; cut into sections of up to 12"' },
    { key: 'r', name: 'Room', tip: 'Paint room floor: up to 9" a side is a room, bigger a hall; each one a rectangle' },
    { key: '.', name: 'Solid', tip: 'Paint solid rock or plating' },
    { key: 'edge', name: 'Doors & walls', tip: 'Tap the line between two floor cells: open, then a door, then a wall' },
    { key: 'danger', name: 'Dangerous', tip: 'Tap a room or hall to mark it dangerous (or not)' }
  ];
  var ed = null;           // the window as it stands: { w, h, plan, tool, onDone, painting }

  function colours() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (n, d) { return (cs.getPropertyValue(n) || '').trim() || d; };
    return { solid: v('--ground', '#0d1117'), grid: v('--line', '#26303f'), corridor: '#3b4658', room: '#4f5d72', hall: '#5a6982',
      wall: v('--ink', '#e7ecf4'), door: v('--amber', '#f0b64a'), danger: v('--warn', '#e08a3a'), a: v('--alpha', '#d8a13a'), b: v('--bravo', '#5aa9c8') };
  }

  function open(o) {
    var m = el('cmp-modal');
    if (!m || !CMP) return;
    var fit = CMP.checkPlan(o.plan, o.w, o.h);
    var plan = o.plan && !/different table size/.test(fit.faults[0] || '') ? CMP.cleanPlan(o.plan) : CMP.blankPlan(o.w, o.h);
    ed = { w: o.w, h: o.h, plan: plan, tool: 'c', onDone: o.onDone };
    m.hidden = false;
    m.innerHTML = '<div class="cmodal-box cmp-box" role="dialog" aria-modal="true" aria-label="Lay out the compound">' +
      '<div class="cmodal-head"><h3>Lay out the compound — ' + o.w + '" × ' + o.h + '"</h3>' +
      '<button type="button" class="xclose" data-cmp="cancel" title="Close" aria-label="Close">✕</button></div>' +
      '<div class="cmp-tools" role="group" aria-label="Tool">' + TOOLS.map(function (t) {
        return '<button type="button" class="cmp-tool" data-tool="' + t.key + '" title="' + esc(t.tip) + '">' + esc(t.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="cmp-wrap cmodal-scroll"><canvas id="cmp-canvas"></canvas></div>' +
      '<p class="hint small cmp-key">Each square is 3". Corridor cells on the left and right edges are the entry points; the battle’s sides are given an edge each at random.</p>' +
      '<p class="faults" id="cmp-status"></p>' +
      '<div class="askrow">' +
      '<button type="button" class="lnk" data-cmp="gen">Start from a generated one</button>' +
      '<button type="button" class="lnk" data-cmp="clear">Clear</button>' +
      '<button type="button" class="lnk" data-cmp="cancel">Cancel</button>' +
      '<button type="button" class="start" data-cmp="done" id="cmp-done">Use this compound</button></div></div>';
    m.onclick = click;
    var cv = el('cmp-canvas');
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { cv.addEventListener(n, function () { if (ed) ed.painting = null; }); });
    draw();
  }
  function close() {
    var m = el('cmp-modal');
    if (m) { m.hidden = true; m.innerHTML = ''; m.onclick = null; }
    ed = null;
  }

  function click(ev) {
    if (!ed) return;
    var t = ev.target.closest && ev.target.closest('button');
    if (!t) { if (ev.target === el('cmp-modal')) close(); return; }
    if (t.hasAttribute('data-tool')) { ed.tool = t.getAttribute('data-tool'); draw(); return; }
    var a = t.getAttribute('data-cmp');
    if (a === 'cancel') close();
    else if (a === 'clear') { ed.plan = CMP.blankPlan(ed.w, ed.h); draw(); }
    else if (a === 'gen') { ed.plan = CMP.generatedPlan(ed.w, ed.h); draw(); }
    else if (a === 'done') {
      if (t.disabled) return;
      var done = ed.onDone, plan = tidy(ed.plan);
      close();
      if (done) done(plan);
    }
  }

  // the cell (and the nearest edge) under a pointer
  function at(ev) {
    var cv = el('cmp-canvas'), b = cv.getBoundingClientRect(), p = ed.plan;
    var fx = (ev.clientX - b.left) / b.width * p.cols, fy = (ev.clientY - b.top) / b.height * p.rows;
    var i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= p.cols || j >= p.rows) return null;
    var dx = fx - Math.round(fx), dy = fy - Math.round(fy), edge = null;
    // the line between two cells, if the tap is nearer it than the middle of the cell
    if (Math.abs(dx) <= Math.abs(dy) && Math.abs(dx) < 0.3) {
      var ri = Math.round(fx);
      if (ri > 0 && ri < p.cols) edge = [j * p.cols + ri - 1, j * p.cols + ri];
    } else if (Math.abs(dy) < 0.3) {
      var rj = Math.round(fy);
      if (rj > 0 && rj < p.rows) edge = [(rj - 1) * p.cols + i, rj * p.cols + i];
    }
    return { c: j * p.cols + i, edge: edge };
  }
  function down(ev) {
    if (!ed) return;
    var h = at(ev);
    if (!h) return;
    ev.preventDefault();
    var p = ed.plan;
    if (ed.tool === 'edge') {
      if (!h.edge || p.cells.charAt(h.edge[0]) === '.' || p.cells.charAt(h.edge[1]) === '.') return;
      var k = ek(h.edge[0], h.edge[1]), wi = p.walls.indexOf(k), di = p.doors.indexOf(k);
      // open, then a door, then a wall, then open again
      if (di >= 0) { p.doors.splice(di, 1); p.walls.push(k); }
      else if (wi >= 0) p.walls.splice(wi, 1);
      else p.doors.push(k);
      draw();
      return;
    }
    if (ed.tool === 'danger') {
      if (p.cells.charAt(h.c) !== 'r') return;
      var g = CMP.layout(p), s = g.grid[h.c];
      if (g.danger[s]) p.danger = p.danger.filter(function (c) { return g.grid[c] !== s; });
      else p.danger.push(h.c);
      draw();
      return;
    }
    ed.painting = ed.tool;
    paint(h.c);
    try { el('cmp-canvas').setPointerCapture(ev.pointerId); } catch (e) { }
  }
  function move(ev) {
    if (!ed || !ed.painting) return;
    var h = at(ev);
    if (h) paint(h.c);
  }
  function paint(c) {
    var p = ed.plan;
    if (p.cells.charAt(c) === ed.painting) return;
    p.cells = p.cells.slice(0, c) + ed.painting + p.cells.slice(c + 1);
    draw();
  }
  // walls, doors and dangers left on cells painted over go
  function tidy(p) {
    var floor = function (c) { return p.cells.charAt(c) !== '.'; };
    var keep = function (k) { var ab = k.split('|'); return floor(+ab[0]) && floor(+ab[1]); };
    return { cols: p.cols, rows: p.rows, cells: p.cells, walls: p.walls.filter(keep), doors: p.doors.filter(keep),
      danger: p.danger.filter(function (c) { return p.cells.charAt(c) === 'r'; }) };
  }

  function draw() {
    if (!ed) return;
    var p = ed.plan, cv = el('cmp-canvas');
    Array.prototype.forEach.call(document.querySelectorAll('.cmp-tool'), function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === ed.tool); });
    var avail = Math.max(240, Math.min(560, (cv.parentNode.clientWidth || 560) - 4));
    var cs = Math.max(12, Math.floor(Math.min(avail / p.cols, (window.innerHeight * 0.55) / p.rows)));
    var dpr = window.devicePixelRatio || 1;
    cv.width = p.cols * cs * dpr; cv.height = p.rows * cs * dpr;
    cv.style.width = p.cols * cs + 'px'; cv.style.height = p.rows * cs + 'px';
    var x = cv.getContext('2d'), C = colours(), g = CMP.layout(p);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = C.solid; x.fillRect(0, 0, p.cols * cs, p.rows * cs);
    for (var c = 0; c < p.cols * p.rows; c++) {
      var s = g.grid[c];
      if (s < 0) continue;
      var i = c % p.cols, j = (c / p.cols) | 0, kind = g.kindOf[s];
      x.fillStyle = kind === 'corridor' ? C.corridor : kind === 'hall' ? C.hall : C.room;
      x.fillRect(i * cs, j * cs, cs, cs);
      if (g.danger[s]) {
        x.save(); x.beginPath(); x.rect(i * cs, j * cs, cs, cs); x.clip();
        x.strokeStyle = C.danger; x.globalAlpha = 0.55; x.lineWidth = 2;
        for (var d = -cs; d < cs; d += 6) { x.beginPath(); x.moveTo(i * cs + d, j * cs + cs); x.lineTo(i * cs + d + cs, j * cs); x.stroke(); }
        x.restore();
      }
    }
    // the faint 3" grid
    x.strokeStyle = C.grid; x.lineWidth = 1; x.globalAlpha = 0.6;
    for (var gi = 1; gi < p.cols; gi++) { x.beginPath(); x.moveTo(gi * cs + 0.5, 0); x.lineTo(gi * cs + 0.5, p.rows * cs); x.stroke(); }
    for (var gj = 1; gj < p.rows; gj++) { x.beginPath(); x.moveTo(0, gj * cs + 0.5); x.lineTo(p.cols * cs, gj * cs + 0.5); x.stroke(); }
    x.globalAlpha = 1;
    // the edges between sections: walls, doors, and a faint line where one section meets the next
    for (var cj = 0; cj < p.rows; cj++) for (var ci = 0; ci < p.cols; ci++) {
      var a = cj * p.cols + ci;
      if (g.grid[a] < 0) continue;
      [[1, 0], [0, 1]].forEach(function (dd) {
        var ni = ci + dd[0], nj = cj + dd[1];
        if (ni >= p.cols || nj >= p.rows) return;
        var b = nj * p.cols + ni;
        if (g.grid[b] < 0 || g.grid[b] === g.grid[a] && !g.doors[ek(a, b)]) return;
        var k = ek(a, b), vert = dd[0] === 1;
        var x0 = vert ? ni * cs : ci * cs, y0 = vert ? cj * cs : nj * cs, x1 = vert ? x0 : x0 + cs, y1 = vert ? y0 + cs : y0;
        x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1);
        if (!g.open[k]) { x.strokeStyle = C.wall; x.lineWidth = 3; x.setLineDash([]); }
        else if (g.doors[k]) { x.strokeStyle = C.door; x.lineWidth = 4; x.setLineDash([]); }
        else { x.strokeStyle = C.wall; x.globalAlpha = 0.25; x.lineWidth = 1; x.setLineDash([3, 3]); }
        x.stroke(); x.globalAlpha = 1; x.setLineDash([]);
      });
    }
    // the entry points
    [['L', C.a], ['R', C.b]].forEach(function (q) {
      g.entries[q[0]].forEach(function (e) {
        var cx = q[0] === 'L' ? 0 : p.cols * cs, cy = e.j * cs + cs / 2, dir = q[0] === 'L' ? 1 : -1;
        x.fillStyle = q[1];
        x.beginPath(); x.moveTo(cx, cy - cs * 0.35); x.lineTo(cx + dir * cs * 0.45, cy); x.lineTo(cx, cy + cs * 0.35); x.closePath(); x.fill();
      });
    });
    // halls and rooms named at their middles
    x.fillStyle = 'rgba(231,236,244,.75)'; x.font = Math.max(9, Math.floor(cs * 0.42)) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    g.rooms.forEach(function (r) { x.fillText(r.kind === 'hall' ? 'Hall' : 'Room', (r.i + r.w / 2) * cs, (r.j + r.h / 2) * cs); });
    var ck = CMP.checkPlan(p, ed.w, ed.h), st = el('cmp-status'), done = el('cmp-done');
    st.className = 'faults' + (ck.ok ? ' ok' : '');
    st.textContent = ck.ok
      ? ck.rooms + ' room' + (ck.rooms === 1 ? '' : 's') + ', ' + ck.halls + ' hall' + (ck.halls === 1 ? '' : 's') + '; ' + ck.entries.L + ' entry point' + (ck.entries.L === 1 ? '' : 's') + ' on the left, ' + ck.entries.R + ' on the right.' + (ck.warnings.length ? ' ' + ck.warnings.join(' ') : '')
      : ck.faults.join(' ');
    done.disabled = !ck.ok;
  }

  root.PMCCompoundEdit = { open: open, close: close, isOpen: function () { return !!ed; }, plan: function () { return ed ? ed.plan : null; } };
})(typeof window !== 'undefined' ? window : this);
