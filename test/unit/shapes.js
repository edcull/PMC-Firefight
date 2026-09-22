/* Natural terrain in natural outlines: woods, rubble, rocks, water and lava are
   drawn as irregular shapes inside their rectangles, and the rules must read the
   shape, not the rectangle — cover, movement, line of sight and impassability
   all stop at the drawn edge. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/gen.js');
var R = global.PMC, G = global.PMCGen;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(60) + String(got).padEnd(10) +
    (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }
var seed = 7; function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

head('Shaping a piece');
var wood = R.shapePiece({ kind: 'woods', x: 10, y: 10, w: 10, h: 8 }, rand);
ok('woods take an outline', !!wood.poly, true, wood.poly ? wood.poly.length + ' points' : '');
ok('...that stays inside its rectangle', wood.poly.every(function (q) {
  return q[0] >= 10 - 1e-9 && q[0] <= 20 + 1e-9 && q[1] >= 10 - 1e-9 && q[1] <= 18 + 1e-9;
}), true);
var fams = {};
['blob', 'lobed', 'kidney', 'long'].forEach(function (f) {
  var fill = 0;
  for (var k = 0; k < 40; k++) {
    var w2 = R.shapePiece({ kind: 'woods', x: 10, y: 10, w: 10, h: 8 }, rand, f), inside = 0, tot = 0;
    for (var x = 10; x <= 20; x += 0.4) for (var y = 10; y <= 18; y += 0.4) { tot++; if (R.inRect(x, y, w2)) inside++; }
    fill += inside / tot;
  }
  fams[f] = Math.round(fill / 40 * 100);
});
ok('every family fills a fair share of its ground', fams.blob > 60 && fams.lobed > 50 && fams.kidney > 55 && fams.long > 35, true, JSON.stringify(fams));
// no outline ever crosses itself (each is star-shaped about its centre)
var simple = true;
for (var q = 0; q < 300; q++) {
  var pc = R.shapePiece({ kind: ['woods', 'water', 'lava', 'hill', 'crater'][q % 5], x: 0, y: 0, w: 4 + rand() * 10, h: 4 + rand() * 10 }, rand), P = pc.poly;
  for (var i = 0; i < P.length && simple; i++) for (var j = i + 2; j < P.length; j++) {
    if (i === 0 && j === P.length - 1) continue;
    var A = P[i], B = P[(i + 1) % P.length], C = P[j], D = P[(j + 1) % P.length];
    var d1 = (D[0] - C[0]) * (A[1] - C[1]) - (D[1] - C[1]) * (A[0] - C[0]), d2 = (D[0] - C[0]) * (B[1] - C[1]) - (D[1] - C[1]) * (B[0] - C[0]);
    var d3 = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]), d4 = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) { simple = false; break; }
  }
}
ok('no outline ever crosses itself', simple, true);
var bld = R.shapePiece({ kind: 'building', x: 30, y: 10, w: 6, h: 6 }, rand);
ok('a building stays square', !!bld.poly, false);
ok('a hill takes a rise of ground of its own shape', !!R.shapePiece({ kind: 'hill', x: 0, y: 0, w: 10, h: 10 }, rand).poly, true);
ok('...but ruins stay square', !!R.shapePiece({ kind: 'ruins', x: 0, y: 0, w: 10, h: 10 }, rand).poly, false);

var mv = R.shapePiece({ kind: 'hill', x: 10, y: 10, w: 10, h: 8 }, rand);
R.placePiece(mv, 30, 5, 8, 6.4);
ok('moving and trimming a piece takes its outline with it', mv.poly.every(function (q) {
  return q[0] >= 30 - 1e-6 && q[0] <= 38 + 1e-6 && q[1] >= 5 - 1e-6 && q[1] <= 11.4 + 1e-6;
}), true);
ok('...so its middle is still a hill', R.terrainAt({ terrain: [mv], units: [], objectives: [] }, 34, 8.2), 'hill');

head('The rules read the outline');
var st = { terrain: [wood], units: [], objectives: [] };
ok('the middle of the wood is woods', R.terrainAt(st, 15, 14), 'woods');
ok("the rectangle's corner is open ground", R.terrainAt(st, 10.1, 10.1), 'open');
ok('a point just inside the outline is woods', R.pieceDepth(wood, 15, 14) > 0, true);
ok('...and the corner is outside it', R.pieceDepth(wood, 10.1, 10.1) < 0, true);
var a = { x: 5, y: 5, alive: true }, b = { x: 13, y: 5, alive: true };
// a line clipping only the rectangle's empty corner
var c1 = { x: 8, y: 10.6 }, c2 = { x: 10.6, y: 8 };
ok("a sight line across the rectangle's empty corner is clear", R.segRect(c1.x, c1.y, c2.x, c2.y, wood), false);
ok('a sight line through the trees is blocked', R.lineClear(st, { x: 5, y: 14 }, { x: 25, y: 14 }), false);

head('Buildings have floor plans');
var ub = R.shapePiece({ kind: 'building', x: 10, y: 10, w: 8, h: 8 }, rand, 'U');
var yard = null;
for (var yx = 10.2; yx < 18 && !yard; yx += 0.2) for (var yy = 10.2; yy < 18 && !yard; yy += 0.2) {
  if (!R.inRect(yx, yy, ub)) yard = [yx, yy];
}
ok('a U-shaped building has a yard inside its footprint', !!yard, true);
ok("...and the yard is open ground", yard && R.terrainAt({ terrain: [ub], units: [], objectives: [] }, yard[0], yard[1]), 'open');
ok('...while its wings are building', R.terrainAt({ terrain: [ub], units: [], objectives: [] }, ub.parts[0].x + 0.5, ub.parts[0].y + 0.5), 'building');
var plans = {};
for (var pb = 0; pb < 200; pb++) plans[R.shapePiece({ kind: 'building', x: 0, y: 0, w: 7, h: 6 }, rand).plan] = 1;
ok('every floor plan turns up', Object.keys(plans).sort().join(' '), 'L T U annex block tower');
var lb = R.shapePiece({ kind: 'building', x: 10, y: 10, w: 8, h: 6 }, rand, 'L');
R.placePiece(lb, 30, 20, 6.4, 4.8);
ok('a building moved and trimmed keeps its wings inside it', lb.parts.every(function (q) {
  return q.x >= 30 - 1e-6 && q.y >= 20 - 1e-6 && q.x + q.w <= 36.4 + 1e-6 && q.y + q.h <= 24.8 + 1e-6;
}), true);

head('Turning the table');
var tt = G.generate({ width: 48, height: 48, planet: 'dense', rand: rand }).terrain;
var before = JSON.stringify(tt);
var probe = [];
for (var pi = 0; pi < 200; pi++) probe.push([rand() * 48, rand() * 48]);
var was = probe.map(function (q) { return R.terrainAt({ terrain: tt, units: [], objectives: [] }, q[0], q[1]); });
tt.forEach(function (t) { R.turnPiece(t, 1); });
var agree = probe.every(function (q, n) {
  var m = R.turnPoint(q[0], q[1], 1);
  return R.terrainAt({ terrain: tt, units: [], objectives: [] }, m[0], m[1]) === was[n];
});
ok('a quarter turn carries every piece with its ground', agree, true);
ok('...the north edge comes round to the west', R.turnPoint(20, 0, 1).join(), '0,28');
ok('...every piece still on the table and inside its box', tt.every(function (t) {
  return t.x >= -1e-9 && t.y >= -1e-9 && t.x + t.w <= 48 + 1e-9 && t.y + t.h <= 48 + 1e-9 &&
    (!t.poly || t.poly.every(function (q) { return q[0] >= t.x - 1e-6 && q[0] <= t.x + t.w + 1e-6 && q[1] >= t.y - 1e-6 && q[1] <= t.y + t.h + 1e-6; }));
}), true);
tt.forEach(function (t) { R.turnPiece(t, 3); });
ok('four quarter turns bring it home', JSON.stringify(tt.map(function (t) { return [t.x.toFixed(6), t.y.toFixed(6), t.w.toFixed(6)]; })) ===
  JSON.stringify(JSON.parse(before).map(function (t) { return [t.x.toFixed(6), t.y.toFixed(6), t.w.toFixed(6)]; })), true);

head('The generator shapes what grows');
var shaped = 0, square = 0, bad = 0;
['sparse', 'dense', 'jungle', 'barren', 'industrial', 'mountain', 'unstable'].forEach(function (pl) {
  if (!G.GENERATORS[pl]) return;
  for (var n = 0; n < 20; n++) {
    var out = G.generate({ width: 72, height: 48, planet: pl, rand: rand }).terrain;
    out.forEach(function (p) {
      if (R.SHAPED[p.kind]) { if (p.poly) shaped++; else bad++; }
      else if (p.poly) bad++; else square++;
      if (p.kind === 'building' && p.w >= 4 && p.h >= 4 && !p.parts) bad++;
    });
  }
});
ok('every natural piece comes out shaped', bad, 0, shaped + ' shaped, ' + square + ' built pieces square');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
