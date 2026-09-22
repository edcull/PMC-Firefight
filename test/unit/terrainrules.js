/* Terrain, against pp. 41-43: movement penalties (area once a move, linear
   every crossing), barbed wire, hills, low walls, rubble, trenches, and
   buildings — entering, holding, leaving, being charged out of them. */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(64) + String(got).padEnd(10) +
    (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }
var nid = 0;
function mk(key, side, x, y) {
  var p = R.profile(key);
  return {
    id: side + key + (nid++), side: side, code: p.code, key: key, name: p.name, label: p.name + ' [' + side + ']',
    cls: p.cls || 'infantry', tier: p.tier, size: p.size, models: p.size, move: p.move, turn: p.turn,
    fp: p.fp, range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault, morale: p.morale,
    str: p.str, transport: p.transport, cargo: [], damage: 0, facing: 0, aboard: null,
    rules: p.rules.slice(), x: x, y: y, sp: 0, alive: true, activated: false, shotFrom: []
  };
}
function world(units, terrain) { return { units: units, terrain: terrain || [], objectives: [], log: [] }; }
function reachCost(st, u, allow, x, y) {
  var c = R.reachable(st, u, allow).filter(function (q) { return Math.abs(q.x - x) < 0.01 && Math.abs(q.y - y) < 0.01; })[0];
  return c ? +c.cost.toFixed(2) : null;
}

head('Movement penalty (p. 42)');
var inf = mk('regular', 'A', 5, 24);
var twoWoods = world([inf], [{ kind: 'woods', x: 8, y: 20, w: 3, h: 8 }, { kind: 'woods', x: 13, y: 20, w: 3, h: 8 }]);
ok('two woods crossed in one move cost 1", not 2"', reachCost(twoWoods, inf, 20, 18, 24), 14);
var woodThenRubble = world([inf], [{ kind: 'woods', x: 8, y: 20, w: 3, h: 8 }, { kind: 'crater', x: 13, y: 20, w: 3, h: 8 }]);
ok('...and woods then rubble, still once', reachCost(woodThenRubble, inf, 20, 18, 24), 14);
var twoWalls = world([inf], [{ kind: 'barricade', x: 8, y: 18, w: 1, h: 12 }, { kind: 'barricade', x: 12, y: 18, w: 1, h: 12 }]);
ok('two low walls crossed cost 1" each', reachCost(twoWalls, inf, 20, 16, 24), 13);
var starts = mk('regular', 'A', 10, 24);
var inWood = world([starts], [{ kind: 'woods', x: 7, y: 20, w: 6, h: 8 }]);
ok('a unit starting in woods pays to move out of them', reachCost(inWood, starts, 20, 16, 24), 7);
var truck = mk('lcv', 'A', 5, 24);
ok('a vehicle pays 2" into area terrain', reachCost(world([truck], [{ kind: 'crater', x: 8, y: 20, w: 3, h: 8 }]), truck, 20, 14, 24), 11);
var wireU = mk('regular', 'A', 5, 24);
var wired = world([wireU], [{ kind: 'wire', x: 8, y: 18, w: 1, h: 12 }]);
var wc = reachCost(wired, wireU, 30, 12, 24);
ok('barbed wire costs the D6 rolled for the move', wc === 7 + wireU.wireRoll, true, 'D6 ' + wireU.wireRoll + ' → ' + wc + '"');
wireU.wireRoll = 6;
ok('...rolled once, before the move', reachCost(wired, wireU, 30, 12, 24), 13);

var jet = mk('protectorshm', 'A', 5, 24); jet.jets = true;
var pond = world([jet], [{ kind: 'deep', x: 8, y: 18, w: 5, h: 12 }, { kind: 'woods', x: 14, y: 18, w: 3, h: 12 }]);
ok('hi-mobility Protectors jump deep water and woods at no cost', reachCost(pond, jet, 20, 19, 24), 14);
ok('...but do not land in the water', R.reachable(pond, jet, 20).some(function (c) { return c.x > 8.6 && c.x < 12.4 && c.y > 18.6 && c.y < 29.4; }), false);
var plain = mk('protectors', 'A', 5, 24);
ok('(ordinary Protectors have to go round)', reachCost(pond, plain, 40, 19, 24) > 15, true);

head('Hills (p. 42)');
var hill = { kind: 'hill', x: 20, y: 20, w: 8, h: 8 };
var a1 = mk('regular', 'A', 14, 24), b1 = mk('regular', 'B', 34, 24);
ok('a hill blocks sight between two units off it', R.lineClear(world([a1, b1], [hill]), a1, b1), false);
var up = mk('regular', 'A', 24, 24);
ok('...but not for one standing on it', R.lineClear(world([up, b1], [hill]), up, b1), true);
var friend = mk('regular', 'A', 30, 24), foe = mk('regular', 'B', 30, 24);
ok('from a hill a unit shoots over its own side below', R.lineClear(world([up, friend, b1], [hill]), up, b1), true);
ok('...but not over the enemy', R.lineClear(world([up, foe, b1], [hill]), up, b1), false);
var mods = R.shotMods(world([up, b1], [hill]), up, b1, 'fire', {});
ok('+2 Firepower shooting down from it', mods.parts.some(function (p) { return /hill/.test(p.label) && p.v === 2; }), true);

head('A hill on a hill');
/* A big hill may rise in two steps: the crown is a hill standing on the hill.
   It blocks sight across it as a hill does, for everyone but a unit up on it,
   and standing on it is standing higher than the slope below. */
var big = { kind: 'hill', x: 10, y: 10, w: 20, h: 14,
  poly: [[10, 10], [30, 10], [30, 24], [10, 24]],
  top: [[17, 14], [23, 14], [23, 20], [17, 20]] };
var slopeW = mk('regular', 'A', 12, 17), slopeE = mk('regular', 'B', 28, 17);
var crown = mk('regular', 'A', 20, 17), below = mk('regular', 'B', 4, 17);
ok('the crown blocks sight between two units on the slope either side of it',
  R.lineClear(world([slopeW, slopeE], [big]), slopeW, slopeE), false);
ok('...and between the slope and the ground beyond it', R.lineClear(world([slopeE, below], [big]), slopeE, below), false);
ok('a unit up on the crown sees the slope', R.lineClear(world([crown, slopeE], [big]), crown, slopeE), true);
ok('...and the ground beyond', R.lineClear(world([crown, below], [big]), crown, below), true);
var aside = mk('regular', 'A', 26, 12);
ok('on the slope with the crown not in the way, sight is as it was', R.lineClear(world([aside, slopeE], [big]), aside, slopeE), true);
ok('the crown stands higher than the slope, and the slope than the ground',
  [R.levelOf(world([], [big]), crown), R.levelOf(world([], [big]), slopeE), R.levelOf(world([], [big]), below)].join(), '2,1,0');
var down = R.shotMods(world([crown, slopeE], [big]), crown, slopeE, 'fire', {});
ok('+2 Firepower firing down from the crown on to the slope',
  down.parts.some(function (p) { return /crown/.test(p.label) && p.v === 2; }), true);
var level = R.shotMods(world([slopeW, aside], [big]), slopeW, mk('regular', 'B', 26, 12), 'fire', {});
ok('...but none between two units on the same slope', level.parts.some(function (p) { return /hill|crown/.test(p.label); }), false);
var toGround = R.shotMods(world([crown, below], [big]), crown, below, 'fire', {});
ok('from the crown to the ground it is still +2, not +4',
  toGround.parts.filter(function (p) { return /hill|crown/.test(p.label); }).reduce(function (s, p) { return s + p.v; }, 0), 2);
var up2 = R.shotMods(world([slopeE, crown], [big]), slopeE, crown, 'fire', {});
ok('nothing for firing up at the crown', up2.parts.some(function (p) { return /hill|crown/.test(p.label); }), false);
var mate = mk('regular', 'A', 25, 17);
ok('from the crown a unit shoots over its own side on the slope below',
  R.lineClear(world([crown, mate, slopeE], [big]), crown, slopeE), true);
// a line along the south slope, clear of the crown, with a friend on the same slope between
var onSlope = mk('regular', 'A', 24, 22), mate2 = mk('regular', 'A', 27, 22), past = mk('regular', 'B', 36, 22);
ok('...but on the slope it cannot shoot over a friend on the same slope',
  R.lineClear(world([onSlope, mate2, past], [big]), onSlope, past), false);
ok('(with that friend out of the way it can)', R.lineClear(world([onSlope, past], [big]), onSlope, past), true);

head('Low walls and rubble (p. 42)');
var wall = { kind: 'barricade', x: 23, y: 18, w: 1, h: 12 };
var shooter = mk('regular', 'A', 10, 24);
var tight = mk('regular', 'B', 25, 24), loose = mk('regular', 'B', 27, 24);
ok('a unit right behind a low wall has cover', R.coverFor(world([shooter, tight], [wall]), shooter, tight).v, 2);
ok('...one 2" back from it does not (not the whole unit within 2")', R.coverFor(world([shooter, loose], [wall]), shooter, loose).v, 0);
var rubble = { kind: 'crater', x: 16, y: 20, w: 4, h: 8 };
var open = mk('regular', 'B', 25, 24);
ok('rubble between shooter and target gives no cover', R.coverFor(world([shooter, open], [rubble]), shooter, open).v, 0);
var inRub = mk('regular', 'B', 18, 24);
ok('...only to the men in it', R.coverFor(world([shooter, inRub], [rubble]), shooter, inRub).v, 2);

head('Trenches (p. 42)');
var trench = { kind: 'trench', x: 22, y: 20, w: 4, h: 8 };
var dug = mk('regular', 'B', 24, 24);
ok('a trench gives cover', R.coverFor(world([shooter, dug], [trench]), shooter, dug).v, 2);
dug.shotFrom = [{ x: 38, y: 24 }];
var xm = R.shotMods(world([shooter, dug], [trench]), shooter, dug, 'fire', {});
ok('...and Crossfire does not touch the men in it', xm.crossfire, false);
var openX = mk('regular', 'B', 24, 24); openX.shotFrom = [{ x: 38, y: 24 }];
ok('(in the open the same shot is Crossfire)', R.shotMods(world([shooter, openX], []), shooter, openX, 'fire', {}).crossfire, true);

head('Buildings (p. 41)');
var house = { kind: 'building', x: 20, y: 20, w: 4, h: 4 };
var sq = mk('regular', 'A', 17, 22), sq2 = mk('regular', 'A', 27, 22);
var bw = world([sq, sq2], [house]);
ok('a squad within 4" may enter', R.enterTargets(bw, sq).length, 1);
ok('a unit cannot walk in', R.reachable(bw, sq, 10).some(function (c) { return R.inRect(c.x, c.y, house); }), false);
R.enterBuilding(bw, sq, house, 0);
ok('once in, it is inside', !!sq.bld && R.inRect(sq.x, sq.y, house), true);
ok('...and nobody else may enter: one unit to a building', R.enterTargets(bw, sq2).length, 0);
ok('...nor may it move about', R.reachable(bw, sq, 10).filter(function (c) { return R.inches(c.x, c.y, sq.x, sq.y) > 0.6; }).length, 0);
var far = mk('regular', 'B', 32, 22);
bw.units.push(far);
ok('range is measured from the wall', R.unitDist(sq, far).toFixed(1), (32 - 24 - 1).toFixed(1));
ok('+2 Defence inside', R.coverFor(bw, far, sq).v, 2);
far.shotFrom = [];
sq.shotFrom = [{ x: 10, y: 22 }];
ok('no Crossfire on a garrison', R.shotMods(bw, far, sq, 'fire', {}).crossfire, false);
var lowFp = R.shotMods(bw, sq, far, 'fire', {}).parts.some(function (p) { return /building/.test(p.label); });
ok('a low building gives no Firepower', lowFp, false);
var tower = { kind: 'building', x: 20, y: 20, w: 7, h: 7 };
var sqT = mk('regular', 'A', 23.5, 23.5);
var tw = world([sqT, far], [tower]);
R.enterBuilding(tw, sqT, tower, 0);
ok('a high building gives +2 Firepower', R.shotMods(tw, sqT, far, 'fire', {}).parts.some(function (p) { return /high building/.test(p.label) && p.v === 2; }), true);
var bunker = { kind: 'bunker', x: 20, y: 20, w: 4, h: 4 };
var sqB = mk('regular', 'A', 22, 22);
var bk = world([sqB, far], [bunker]);
R.enterBuilding(bk, sqB, bunker, 0);
ok('a reinforced building: +2 Defence', R.coverFor(bk, far, sqB).v, 2);
ok('...and +2 Firepower', R.shotMods(bk, sqB, far, 'fire', {}).parts.some(function (p) { return /reinforced/.test(p.label) && p.v === 2; }), true);
var outs = R.exitSpots(bw, sq);
ok('it comes out within 4" of the wall', outs.length > 0 && outs.every(function (p) { return R.rectPointDist(house, p.x, p.y) <= 4; }), true);
R.exitBuilding(bw, sq, outs[0]);
ok('...and then it is outside again', !sq.bld && !R.inRect(sq.x, sq.y, house), true);

head('Charging a garrison (p. 41)');
var won = 0, took = 0, fellBack = 0, lost = 0, bounced = 0, tries = 300;
for (var i = 0; i < tries; i++) {
  var h2 = { kind: 'building', x: 20, y: 20, w: 4, h: 4 };
  var def = mk('rookie', 'B', 22, 22), atk = mk('veterans', 'A', 16, 22);
  var aw = world([def, atk], [h2]);
  R.enterBuilding(aw, def, h2, 0);
  R.assault(aw, atk, def);
  if (atk.alive && R.status(atk) !== 'broken' && (!def.alive || R.status(def) === 'broken')) {
    won++;
    if (atk.bld === h2) took++;
    if (!def.alive || (!def.bld && !R.inRect(def.x, def.y, h2))) fellBack++;
  } else if (atk.alive) {
    lost++;
    if (!atk.bld && !R.inRect(atk.x, atk.y, h2)) bounced++;
  }
}
ok('when the attackers win they take the building', took === won && won > 0, true, won + ' won of ' + tries);
ok('...and the defenders are out of it', fellBack, won);
ok('when they do not, they are left outside', bounced, lost);
var h3 = { kind: 'building', x: 20, y: 20, w: 4, h: 4 };
var d3 = mk('regular', 'B', 22, 22), a3 = mk('regular', 'A', 12, 22);
var cw = world([d3, a3], [h3]);
R.enterBuilding(cw, d3, h3, 0);
ok('the charge is measured to the wall', R.unitDist(a3, d3).toFixed(1), '7.0');

head('Sections of a big building (p. 41)');
var big = R.shapePiece({ kind: 'building', x: 20, y: 20, w: 8, h: 8 }, Math.random, 'U');
var s0 = mk('regular', 'A', 0, 0), sEnemy = mk('regular', 'B', 0, 0);
var hw = world([s0, sEnemy], [big]);
R.enterBuilding(hw, s0, big, 0);
var nextTo = R.enterTargets(hw, s0);
ok('from one wing a unit may move to another in contact', nextTo.length >= 1 && nextTo.every(function (q) { return q.piece === big && q.sec !== 0; }), true, nextTo.length + ' sections');
R.enterBuilding(hw, sEnemy, big, nextTo[0].sec);
ok('...an enemy in the next section is in contact', R.unitDist(s0, sEnemy) <= 0.6, true);

head('A building brought down (p. 41)');
var burn = { kind: 'building', x: 20, y: 20, w: 4, h: 4 };
var gar = mk('regular', 'A', 22, 22);
var fw = world([gar], [burn]);
R.enterBuilding(fw, gar, burn, 0);
R.destroyTerrain(fw, burn, [], null);
ok('the garrison leaves at once', !gar.bld && !R.inRect(gar.x, gar.y, burn), true);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
