/* Walls are built, not scattered.

   A roll that gives buildings and walls should give a walled compound: the
   walls round the buildings, a yard to stand in, a way in, and no gap in it
   that a 2" base could slip through except that way in. A roll that gives
   walls and nothing to go round should give lengths of wall rather than loose
   slabs. And nothing the generator lays may be closer than the half inch
   every two pieces keep, or the scenario's clean-up would pull the wall apart
   again. */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/gen.js');
var R = global.PMC, G = global.PMCGen;

var pass = 0, fail = 0;
function ok(what, got, want, note) {
  if (got === want) { pass++; console.log('  ✓ ' + what + (note ? '  (' + note + ')' : '')); }
  else { fail++; console.log('  ✗ ' + what + ' — got ' + got + ', wanted ' + want + (note ? '  (' + note + ')' : '')); }
}
function head(t) { console.log('\n' + t); }

// a repeatable dice stream, so a failure can be looked at again
function seeded(s) {
  // neighbouring seeds spread apart, first draws thrown away: a plain LCG's first roll barely moves with the seed
  s = Math.imul(s ^ 0x9e3779b9, 2654435761) >>> 0;
  var f = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  f(); f(); f();
  return f;
}

var LINEAR = { wall: 1, barricade: 1 };
var BUILT = { building: 1, bunker: 1 };
var W = 48, H = 48, UR = R.UNIT_R;
/* How near a wall must be to count as going round a building: the widest yard
   plus the wall, measured to a corner section, which sits diagonally off the
   building's own corner. */
var NEAR = (4 + 1) * Math.SQRT2 + 0.5;
// what stops a unit walking: the rules' own word on it, not a guess about kinds
function solid(p) { return !!(R.TERRAIN[p.kind] && R.TERRAIN[p.kind].impassable); }

function gap(a, b) {
  var dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  var dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

/* Can a unit standing in the yard walk out? A flood fill over the ground
   round the compound, a quarter inch to the cell, where a cell is open only if
   a base centred on it would clear every wall and building by its radius.
   Reaching the edge of the search box means it got out. */
function canWalkOut(building, walls) {
  var pad = 9, step = 0.25;
  var x0 = building.x - pad, y0 = building.y - pad;
  var nx = Math.ceil((building.w + 2 * pad) / step), ny = Math.ceil((building.h + 2 * pad) / step);
  var solid = walls.concat([building]);
  function open(i, j) {
    var x = x0 + i * step, y = y0 + j * step;
    if (x < UR || y < UR || x > W - UR || y > H - UR) return false;     // the table's own edge
    for (var k = 0; k < solid.length; k++) {
      var s = solid[k];
      var dx = Math.max(s.x - x, 0, x - (s.x + s.w)), dy = Math.max(s.y - y, 0, y - (s.y + s.h));
      if (dx * dx + dy * dy < UR * UR) return false;
    }
    return true;
  }
  // start in the yard: the first open cell just off the building
  var start = null;
  for (var r = UR + 0.1; r < 4 && !start; r += 0.25) {
    [[building.x - r, building.y + building.h / 2], [building.x + building.w + r, building.y + building.h / 2],
      [building.x + building.w / 2, building.y - r], [building.x + building.w / 2, building.y + building.h + r]].forEach(function (p) {
      if (start) return;
      var i = Math.round((p[0] - x0) / step), j = Math.round((p[1] - y0) / step);
      if (i >= 0 && j >= 0 && i < nx && j < ny && open(i, j)) start = [i, j];
    });
  }
  if (!start) return 'no room in the yard';
  var seen = new Uint8Array(nx * ny), q = [start];
  seen[start[1] * nx + start[0]] = 1;
  while (q.length) {
    var c = q.pop();
    if (c[0] === 0 || c[1] === 0 || c[0] === nx - 1 || c[1] === ny - 1) return 'out';
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var i = c[0] + d[0], j = c[1] + d[1];
      if (i < 0 || j < 0 || i >= nx || j >= ny || seen[j * nx + i] || !open(i, j)) return;
      seen[j * nx + i] = 1; q.push([i, j]);
    });
  }
  return 'shut in';
}

/* ---- one compound, laid by hand so its shape can be read ---- */
head('A building and its walls');
(function () {
  var area = { name: 'NW', x: 0, y: 0, w: 24, h: 24 };
  var bld = { kind: 'building', x: 8, y: 8, w: 6, h: 5 };
  // a full ring's worth of high wall, round a building laid by hand
  var got = G.fillArea([{ kind: 'wall', min: 12, max: 12 }], area, [bld], [], seeded(7), W, H);
  var walls = got.filter(function (p) { return p.kind === 'wall'; });
  /* Twelve sections is more than one ring takes. The ring is built first and
     in full; what is left over is laid as a length of wall of its own. */
  var ring = walls.filter(function (w) { return gap(w, bld) <= NEAR; });
  var spare = walls.filter(function (w) { return ring.indexOf(w) < 0; });
  ok('the walls go round the building', ring.length >= 8, true,
    ring.length + ' sections in the ring, ' + spare.length + ' over');
  ok('...and any left over join up rather than lie loose', spare.every(function (w) {
    return spare.concat(ring).some(function (o) { return o !== w && gap(o, w) <= 0.6; });
  }), true);
  ok('...leaving a yard to stand in', walls.every(function (w) { return gap(w, bld) >= 2 * UR; }), true);
  ok('...on all four sides', ['N', 'S', 'W', 'E'].every(function (s) {
    return walls.some(function (w) {
      return s === 'N' ? w.y + w.h <= bld.y : s === 'S' ? w.y >= bld.y + bld.h : s === 'W' ? w.x + w.w <= bld.x : w.x >= bld.x + bld.w;
    });
  }), true);
  ok('no section is longer than the book allows', walls.every(function (w) { return Math.max(w.w, w.h) <= 6 + 1e-9; }), true);
  ok('a unit inside can walk out through the gateway', canWalkOut(bld, walls), 'out');
  // the gateway is in the side facing the middle of the table: here, south-east of the building
  var front = walls.filter(function (w) { return w.h === 1 && w.y >= bld.y + bld.h; })
    .concat(walls.filter(function (w) { return w.w === 1 && w.x >= bld.x + bld.w; }));
  var frontSpan = front.reduce(function (s, w) { return s + Math.max(w.w, w.h); }, 0);
  var backSpan = walls.filter(function (w) { return w.h === 1 && w.y + w.h <= bld.y; })
    .reduce(function (s, w) { return s + w.w; }, 0);
  ok('the way in faces the middle of the table', frontSpan > 0 && backSpan > 0, true);

  // with only three sections, the front goes up first and the back stays open
  var few = G.fillArea([{ kind: 'wall', min: 3, max: 3 }], area, [bld], [], seeded(11), W, H)
    .filter(function (p) { return p.kind === 'wall'; });
  var towardMiddle = few.filter(function (w) { return w.y >= bld.y + bld.h || w.x >= bld.x + bld.w; }).length;
  ok('a short roll builds the front before the back', towardMiddle, few.length, few.length + ' sections');
})();

/* ---- a building against the table edge ---- */
head('Against the table edge');
(function () {
  var area = { name: 'NW', x: 0, y: 0, w: 24, h: 24 };
  var bld = { kind: 'bunker', x: 1, y: 9, w: 5, h: 5 };
  var walls = G.fillArea([{ kind: 'wall', min: 12, max: 12 }], area, [bld], [], seeded(3), W, H)
    .filter(function (p) { return p.kind === 'wall'; });
  ok('no wall is laid between the building and the table edge', walls.every(function (w) { return w.x >= bld.x + bld.w || w.y + w.h <= bld.y || w.y >= bld.y + bld.h; }), true);
  ok('the edge side is left to the table edge, and the rest still has a way out', canWalkOut(bld, walls), 'out');
})();

/* ---- the tables the generator actually rolls ---- */
head('Rolled tables');
(function () {
  var compounds = 0, out = 0, round = 0, loose = 0, crowded = 0, long = 0, runs = 0, runJoined = 0;
  var planets = ['dense', 'industrial', 'unstable', 'barren', 'sparse'];
  for (var n = 0; n < 250; n++) {
    var pl = planets[n % planets.length];
    var t = G.generate({ width: W, height: H, planet: pl, rand: seeded(1000 + n) }).terrain;
    // every pair of pieces keeps the half inch, so the scenario's clean-up leaves them where they are
    for (var i = 0; i < t.length; i++) for (var j = i + 1; j < t.length; j++) {
      var a = t[i], b = t[j];
      if (a.x < b.x + b.w + 0.5 && b.x < a.x + a.w + 0.5 && a.y < b.y + b.h + 0.5 && b.y < a.y + a.h + 0.5) crowded++;
    }
    var walls = t.filter(function (p) { return LINEAR[p.kind]; });
    var built = t.filter(function (p) { return BUILT[p.kind]; });
    walls.forEach(function (w) { if (w.kind === 'wall' && Math.max(w.w, w.h) > 6 + 1e-9) long++; });
    built.forEach(function (bld) {
      var mine = walls.filter(function (w) { return w.kind === 'wall' && gap(w, bld) <= NEAR; });
      if (mine.length < 4) return;
      compounds++;
      var blocks = t.filter(function (o) { return o !== bld && solid(o) && gap(o, bld) <= 14; });
      if (canWalkOut(bld, blocks) === 'out') out++;
    });
    // how many walls on a table that has buildings are near one
    if (built.length) walls.forEach(function (w) {
      if (built.some(function (bld) { return gap(w, bld) <= NEAR; })) round++; else loose++;
    });
    // walls on a table with no buildings: are they joined into lengths?
    if (!built.length && walls.length > 1) walls.forEach(function (w) {
      runs++;
      if (walls.some(function (o) { return o !== w && gap(o, w) <= 0.6; })) runJoined++;
    });
  }
  ok('nothing is laid closer than the half inch', crowded, 0);
  ok('no high-wall section longer than 6"', long, 0);
  ok('walled compounds turn up', compounds > 10, true, compounds + ' compounds of high wall');
  ok('every compound has a way out', out, compounds, out + ' of ' + compounds);
  var share = round / Math.max(1, round + loose);
  ok('walls on a table with buildings mostly go round them', share > 0.75, true, Math.round(share * 100) + '% near a building');
  var joined = runJoined / Math.max(1, runs);
  ok('walls with nothing to go round mostly join up', joined > 0.6, true, Math.round(joined * 100) + '% joined to another');
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
