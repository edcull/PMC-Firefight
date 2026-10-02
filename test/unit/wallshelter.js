/* Behind a wall, one test for everything that asks (the rules review at 7dd7306,
   M-8 and M-9): the low wall that gives a unit its +2 cover (p. 42) is the wall
   a Destructive Weapon brings down on it (p. 57) and Sappers storm (p. 59) — and
   "behind a small/high wall" means high walls too, which plunging fire finds on
   any side (p. 58). */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0;
function ok(what, got, want, note) {
  if (got === want) { pass++; console.log('  ✓ ' + what + (note ? '  (' + note + ')' : '')); }
  else { fail++; console.log('  ✗ ' + what + ' — got ' + got + ', wanted ' + want + (note ? '  (' + note + ')' : '')); }
}
function head(t) { console.log('\n' + t); }

var n = 0;
function unit(key, side, x, y) {
  var p = R.profile(key);
  return Object.assign(JSON.parse(JSON.stringify(p)), {
    id: side + (n++), side: side, label: p.name + ' [' + side + ']', models: p.size, x: x, y: y,
    sp: 0, alive: true, shotFrom: [], cargo: [], facing: 0
  });
}
function world(units, terrain) { return { units: units, terrain: terrain, objectives: [], log: [] }; }
// a low wall running north-south at x 20-20.6, from y 14 to 20 (6" long)
function lowWall() { return { kind: 'barricade', x: 20, y: 14, w: 0.6, h: 6 }; }
function highWall() { return { kind: 'wall', x: 20, y: 14, w: 0.6, h: 6 }; }

head('A unit just back from a low wall: the cover and the wall it shelters behind agree');
// cover reaches 1.5" to the unit's middle (R.WALL_REACH, a house rule)
[0.5, 1.0, 1.5].forEach(function (back) {
  var shooter = unit('atteam', 'A', 8, 17), target = unit('regular', 'B', 20.6 + back, 17);
  var st = world([shooter, target], [lowWall()]);
  var cover = R.coverFor(st, shooter, target).v, shelter = R.shelterOf(st, shooter, target);
  ok('centre ' + back + '" behind the wall: +2 cover', cover, 2);
  ok('...and the same wall is its shelter for a Destructive Weapon', !!shelter && shelter.kind, 'barricade');
});
(function () {
  var shooter = unit('atteam', 'A', 8, 17), target = unit('regular', 'B', 22.4, 17);
  var st = world([shooter, target], [lowWall()]);
  ok('1.8" back: no cover', R.coverFor(st, shooter, target).v, 0);
  ok('...and no shelter', R.shelterOf(st, shooter, target), null);
})();
(function () {
  // the wall on the far side of the target from the shooter is not between them
  var shooter = unit('atteam', 'A', 30, 17), target = unit('regular', 'B', 21.6, 17);
  var st = world([shooter, target], [lowWall()]);
  ok('a wall behind the target, away from the shooter, is not its shelter', R.shelterOf(st, shooter, target), null);
})();

head('A Destructive Weapon brings the low wall down on the men behind it (p. 57)');
(function () {
  var shooter = unit('atteam', 'A', 8, 17), target = unit('regular', 'B', 22.1, 17);
  var wall = lowWall(), st = world([shooter, target], [wall]);
  var keep = Math.random;
  Math.random = function () { return 0.95; };            // an unmodified 9 on every die
  try { R.shoot(st, shooter, target, 'fire'); } finally { Math.random = keep; }
  ok('an unmodified 9 against a squad 1.5" back takes the wall down', wall.kind === 'razed', true);
})();

head('...and a high wall: "behind a small/high wall" (p. 57)');
(function () {
  // a mortar (Indirect Fire, Destructive Weapon) dropping rounds over a high wall
  var mortar = unit('mortarteam', 'A', 8, 17), target = unit('regular', 'B', 21.6, 17);
  var wall = highWall(), st = world([mortar, target], [wall]);
  var shelter = R.shelterOf(st, mortar, target);
  ok('a squad 1" behind a high wall shelters behind it against plunging fire', !!shelter && shelter.kind, 'wall');
  var keep = Math.random;
  Math.random = function () { return 0.95; };
  try { R.shoot(st, mortar, target, 'fire', { designated: true }); } finally { Math.random = keep; }
  ok('an unmodified 9 brings the high wall down', wall.kind === 'razed', true);
})();
(function () {
  // plunging fire finds the wall on any side (p. 58): here it is behind the target
  var mortar = unit('mortarteam', 'A', 8, 17), target = unit('regular', 'B', 19, 17);
  var st = world([mortar, target], [highWall()]);
  var shelter = R.shelterOf(st, mortar, target);
  ok('...on whichever side of the squad it stands', !!shelter && shelter.kind, 'wall');
})();
(function () {
  var mortar = unit('mortarteam', 'A', 8, 17), target = unit('regular', 'B', 24, 17);
  var st = world([mortar, target], [highWall()]);
  ok('a high wall 3.4" off is not its shelter', R.shelterOf(st, mortar, target), null);
})();
(function () {
  // a reinforced wall cannot be brought down at all (p. 42)
  var mortar = unit('mortarteam', 'A', 8, 17), target = unit('regular', 'B', 21.6, 17);
  var st = world([mortar, target], [{ kind: 'wall', reinforced: true, x: 20, y: 14, w: 0.6, h: 6 }]);
  ok('a reinforced wall is nobody\'s breachable shelter', R.shelterOf(st, mortar, target), null);
})();

head('Sappers storm the same wall (p. 59)');
(function () {
  var sap = unit('engineers', 'A', 18.8, 17), target = unit('regular', 'B', 22.1, 17);
  var st = world([sap, target], [lowWall()]);
  ok('a squad 1.5" behind a low wall is behind it for Sappers too', !!R.shelterOf(st, sap, target), true);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
