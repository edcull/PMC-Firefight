/* Buildings and falling back (the rules review at 7dd7306, M-3, M-4, M-5):
   a small building holds one unit (pp. 41-42), a garrison that loses an
   assault ends 2" from its building (p. 41), and Broken artillery stays where
   it is (p. 97). */
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
function seeded(s) {
  s = Math.imul(s ^ 0x9e3779b9, 2654435761) >>> 0;
  var f = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  f(); f(); f();
  return f;
}
var n = 0;
function unit(key, side, x, y) {
  var p = R.profile(key);
  return Object.assign(JSON.parse(JSON.stringify(p)), {
    id: side + (n++), side: side, label: p.name + ' [' + side + ']', models: p.size, x: x, y: y,
    sp: 0, alive: true, shotFrom: [], cargo: [], facing: 0
  });
}
function world(units, terrain) { return { units: units, terrain: terrain || [], objectives: [], log: [] }; }

head('A small building holds one unit; only a big one is built of sections (pp. 41-42)');
(function () {
  var small = 0, smallSplit = 0, big = 0, bigSplit = 0;
  var planets = Object.keys(G.GENERATORS);
  for (var i = 0; i < 300; i++) {
    G.generate({ width: 48, height: 48, planet: planets[i % planets.length], rand: seeded(500 + i) }).terrain.forEach(function (p) {
      if (p.kind !== 'building') return;
      var parts = R.sectionsOf(p).length;
      if (Math.max(p.w, p.h) <= 5.5) { small++; if (parts > 1) smallSplit++; } else { big++; if (parts > 1) bigSplit++; }
    });
  }
  ok('no small building (up to 5.5" across) is split into sections', smallSplit, 0, small + ' small buildings');
  ok('...while bigger ones may still be wings and sections', bigSplit > 0, true, bigSplit + ' of ' + big);
})();

head('A garrison that loses its building falls back 2" from it (p. 41)');
(function () {
  var worst = 0, runs = 0;
  for (var k = 0; k < 40; k++) {
    var piece = { kind: 'building', x: 20, y: 20, w: 4, h: 4 };
    var def = unit('regular', 'B', 22, 22), atk = unit('regular', 'A', 22 + (k % 2 ? 5 : -5), 22 + (k % 3) - 1);
    def.bld = piece; def.sec = 0;
    var st = world([def, atk], [piece]);
    if (!R.fallBack(st, def, atk, 2)) continue;
    runs++;
    worst = Math.max(worst, R.rectPointDist(piece, def.x, def.y) - R.UNIT_R);
  }
  ok('out of the building, its base no more than 2" from the wall', runs > 0 && worst <= 2 + 1e-6, true,
    runs + ' runs, furthest ' + worst.toFixed(2) + '"');
})();

head('Broken artillery does not retreat (p. 97)');
(function () {
  var gun = unit('rmedart', 'B', 24, 24), atk = unit('commandos', 'A', 20, 24);
  var st = world([gun, atk]);
  ok('it does not fall back', R.fallBack(st, gun, atk, 2), false);
  ok('...and is where it was', gun.x === 24 && gun.y === 24, true);
})();
(function () {
  // charges until the gun breaks: it never moves
  var keep = Math.random, s = 9;
  Math.random = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  var broke = 0, moved = 0;
  try {
    for (var i = 0; i < 300; i++) {
      var gun = unit('rmedart', 'B', 24, 24), atk = unit('commandos', 'A', 21.5, 24);
      var st = world([gun, atk]);
      R.assault(st, atk, gun);
      if (gun.alive && R.status(gun) === 'broken') { broke++; if (gun.x !== 24 || gun.y !== 24) moved++; }
    }
  } finally { Math.random = keep; }
  ok('in an assault, a gun that breaks stays put', broke > 0 && moved === 0, true, broke + ' broke, ' + moved + ' moved');
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
