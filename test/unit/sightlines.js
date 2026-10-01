/* Line of sight, "seen by one soldier, seen by the whole unit" (p. 29; the rules
   review at 7dd7306, M-1): a squad sees past what hides only part of the line
   between the two bases, and not past what stands square across it. */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0;
function ok(what, got, want, note) {
  if (got === want) { pass++; console.log('  ✓ ' + what + (note ? '  (' + note + ')' : '')); }
  else { fail++; console.log('  ✗ ' + what + ' — got ' + got + ', wanted ' + want + (note ? '  (' + note + ')' : '')); }
}
var n = 0;
function unit(key, side, x, y) {
  var p = R.profile(key);
  return Object.assign(JSON.parse(JSON.stringify(p)), {
    id: side + (n++), side: side, label: p.name, models: p.size, x: x, y: y, sp: 0, alive: true, shotFrom: [], cargo: []
  });
}
function world(units, terrain) { return { units: units, terrain: terrain || [], objectives: [], log: [] }; }

console.log('\nWhat hides part of the line does not hide the squad');
(function () {
  var a = unit('regular', 'A', 10, 10), b = unit('regular', 'B', 26, 10);
  // rocks covering everything from y = 9.8 down across the gap: the bottom 0.8" of each base sees past
  var st = world([a, b], [{ kind: 'rocks', x: 16, y: 9.8, w: 4, h: 10 }]);
  ok('rocks covering the line between the middles, not the bases\' edges: seen', R.hasLoS(st, a, b), true);
  ok('...and it may be shot at', R.canShoot(st, a, b, 'fire'), true);
})();
(function () {
  var a = unit('regular', 'A', 10, 10), b = unit('regular', 'B', 26, 10), f = unit('regular', 'A', 18, 10.85);
  ok('a friendly squad standing just off the line: seen past it', R.hasLoS(world([a, b, f]), a, b), true);
})();

console.log('\nWhat stands square across it still does');
(function () {
  var a = unit('regular', 'A', 10, 10), b = unit('regular', 'B', 26, 10);
  ok('rocks wider than both bases across the line: hidden', R.hasLoS(world([a, b], [{ kind: 'rocks', x: 16, y: 7, w: 4, h: 6 }]), a, b), false);
  ok('a high wall across the whole gap: hidden', R.hasLoS(world([a, b], [{ kind: 'wall', x: 17.7, y: 4, w: 0.6, h: 12 }]), a, b), false);
  var f = unit('regular', 'A', 18, 10);
  ok('a squad standing right on the line: hidden', R.hasLoS(world([a, b, f]), a, b), false);
})();
(function () {
  var a = unit('regular', 'A', 10, 10), b = unit('regular', 'B', 26, 10);
  // a wood both ends are outside of, covering all of the line between them
  ok('woods across the whole of it: hidden', R.hasLoS(world([a, b], [{ kind: 'woods', x: 15, y: 5, w: 5, h: 10 }]), a, b), false);
})();

console.log('\nA point is just itself');
(function () {
  var a = unit('regular', 'A', 10, 10), spot = { x: 26, y: 10 };
  var st = world([a], [{ kind: 'rocks', x: 16, y: 9.8, w: 4, h: 10 }]);
  // from a squad to a bare point: the squad's own edge still looks past the rocks' corner
  ok('a squad to a spot on the ground with the line half hidden: the squad\'s edge sees it', R.lineClear(st, a, spot), true);
  var st2 = world([a], [{ kind: 'rocks', x: 16, y: 8.5, w: 4, h: 10 }]);
  ok('...but not when the rocks cover more than its half-width', R.lineClear(st2, a, spot), false);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
