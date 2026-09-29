/* An Overgrown bug on the ground (the Shadow bug) follows the ground vehicle's
   rules but may still charge (p. 116). Its charge used to be measured in a
   straight line, as an aircraft's is, so it went through a building to reach
   what stood behind it and could finish in contact on the far side — inside
   the building. It drives round, as any move of its own would. */
global.window = {};
require('../../src/rules/rules.js');
var R = window.PMC;

var pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note === undefined ? '' : '  — ' + note));
}
function unit(key, over) {
  var p = R.profile(key);
  var u = {
    id: key, side: 'A', key: key, name: p.name, label: p.name, code: p.code,
    tier: p.tier, size: p.size, models: p.size, move: p.move, fp: p.fp, range: p.range,
    def: p.def, defPierced: p.defPierced, assault: p.assault, morale: p.morale,
    faction: p.faction || 'pmc', cls: p.cls || 'infantry', str: p.str, turn: p.turn,
    transport: p.transport, cargo: [], damage: 0, rules: p.rules.slice(),
    x: 10, y: 10, sp: 0, alive: true, tactic: null, facing: 0,
    shotFrom: [], marked: false, activated: false, aboard: null, disembarked: false
  };
  for (var k in (over || {})) u[k] = over[k];
  return u;
}
function table(units, terrain) {
  units.forEach(function (u, i) { u.id = 'u' + i; });
  return { units: units, terrain: terrain || [], objectives: [], doctrines: null, turn: 1 };
}
// does a route (and the straight run into contact at its end) cross a building?
function crossesBuilding(st, pts) {
  for (var i = 1; i < pts.length; i++) {
    var a = pts[i - 1], b = pts[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25);
    for (var s = 0; s <= n; s++) {
      var x = a.x + (b.x - a.x) * s / n, y = a.y + (b.y - a.y) * s / n;
      if (R.TERRAIN[R.terrainAt(st, x, y)].impassable) return true;
    }
  }
  return false;
}
function contact(u, t) {
  var v = Math.hypot(t.x - u.x, t.y - u.y) || 1;
  return { x: t.x - (t.x - u.x) / v * 2 * R.UNIT_R, y: t.y - (t.y - u.y) / v * 2 * R.UNIT_R };
}

console.log('\nTHE SHADOW BUG\'S CHARGE');
var sb = unit('bshadow', { x: 10, y: 10, facing: Math.PI / 2 });
ok('the Shadow bug is a ground vehicle that drives', sb.cls === 'vehicle' && R.drives(sb));
ok('...and, being Overgrown, may charge', R.canAssault(sb, unit('regular', { side: 'B' })));

// a wide building between it and its prey, 10" away as the crow flies
var wall = table([sb, unit('regular', { side: 'B', x: 10, y: 20 })], [{ kind: 'building', x: 2, y: 13, w: 16, h: 5.5 }]);
var allow = sb.move + 2;
ok('in the open the prey would be in reach', !!R.chargeRoute(table([unit('bshadow', { x: 10, y: 10, facing: Math.PI / 2 }),
  unit('regular', { side: 'B', x: 10, y: 20 })]), wall.units[0], wall.units[1], allow));
var thru = R.chargeRoute(wall, wall.units[0], wall.units[1], allow);
ok('it does not charge through a building to reach it', !thru,
  thru ? 'reached for ' + thru.cost.toFixed(1) + '", ending at ' + JSON.stringify(contact(thru.path[thru.path.length - 1], wall.units[1])) : 'out of reach');

// a small building it can drive round
var hut = table([unit('bshadow', { x: 10, y: 10, facing: Math.PI / 2 }), unit('regular', { side: 'B', x: 10, y: 20 })],
  [{ kind: 'building', x: 8, y: 13.5, w: 4, h: 3 }]);
var bug = hut.units[0], prey = hut.units[1];
var round = R.chargeRoute(hut, bug, prey, allow);
ok('round a small building it can still reach the prey', !!round, round ? round.cost.toFixed(1) + '"' : 'out of reach');
if (round) {
  var pts = round.path.concat([contact(round.path[round.path.length - 1], prey)]);
  ok('...by a route that never enters it', !crossesBuilding(hut, pts), JSON.stringify(round.path));
  ok('...and finishes in contact off it', !R.TERRAIN[R.terrainAt(hut, pts[pts.length - 1].x, pts[pts.length - 1].y)].impassable);
  var res = R.assault(hut, bug, prey, { path: round.path });
  ok('the assault leaves it standing off the building', !R.TERRAIN[R.terrainAt(hut, bug.x, bug.y)].impassable,
    bug.x.toFixed(1) + ',' + bug.y.toFixed(1) + (res.ok ? '' : ' (charge stopped)'));
}

/* Wherever the route went, the charge ends in contact at the end of it: not
   2" short of the prey along the straight line from where it began, which here
   is inside the building it drove round. The prey holds its fire, so the
   charge is not stopped part way. */
var hut2 = table([unit('bshadow', { x: 10, y: 10, facing: Math.PI / 2 }), unit('regular', { side: 'B', x: 10, y: 18, fp: null })],
  [{ kind: 'building', x: 8, y: 13.5, w: 4, h: 3 }]);
var bug2 = hut2.units[0], prey2 = hut2.units[1];
var round2 = R.chargeRoute(hut2, bug2, prey2, allow);
ok('round the building to prey just behind it', !!round2, round2 ? round2.cost.toFixed(1) + '"' : 'out of reach');
if (round2) {
  R.assault(hut2, bug2, prey2, { path: round2.path });
  ok('...it ends the assault off the building', !R.TERRAIN[R.terrainAt(hut2, bug2.x, bug2.y)].impassable,
    bug2.x.toFixed(1) + ',' + bug2.y.toFixed(1));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
