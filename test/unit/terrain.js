/* Destructible terrain (pp. 35, 41-43, 57-58): what can be brought down, by what,
   and what it leaves behind. */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(48) +
    String(got).padEnd(10) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

function mk(key, side, x, y, opts) {
  opts = opts || {};
  var p = R.profile(key);
  var u = {
    id: side + key + Math.random().toString(36).slice(2, 6), side: side, code: p.code,
    name: p.name, label: p.name + ' [' + side + ']', cls: p.cls || 'infantry', art: p.art,
    tier: p.tier, size: p.size, models: p.size, move: p.move, turn: p.turn, fp: p.fp,
    range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault, morale: p.morale,
    str: p.str, transport: p.transport, cargo: [], damage: 0, facing: opts.facing || 0,
    aboard: null, rules: p.rules.slice(), x: x, y: y, sp: 0, alive: true, activated: false,
    marked: false, shotFrom: [], coordUsed: false
  };
  return R.applyPropulsion(u, opts.prop);
}
function world(terrain) { return { units: [], terrain: terrain || [], objectives: [], log: [] }; }

head('What the book lets you knock down');
var WANT = {
  barricade: 'linear', wall: 'linear', building: 'building',
  bunker: null, woods: null, ruins: null, rocks: null, crater: null, hill: null
};
Object.keys(WANT).forEach(function (k) {
  ok(R.TERRAIN[k].name, R.destructibleKind({ kind: k }) || 'no', WANT[k] || 'no');
});

head('Destructive Weapon, firing at the piece itself');
var down = 0, n = 4000;
for (var i = 0; i < n; i++) {
  var w = world([{ kind: 'barricade', x: 26, y: 18, w: 4, h: 4 }]);
  var gun = mk('mcv', 'A', 18, 20);                   // Destructive Weapon
  w.units = [gun];
  if (R.shootTerrain(w, gun, w.terrain[0]).down) down++;
}
ok('a 15+ or an unmodified 9 brings a wall down', down > n * 0.1 && down < n * 0.9, true,
  Math.round(100 * down / n) + '% of shots');
var noDW = world([{ kind: 'barricade', x: 26, y: 18, w: 4, h: 4 }]);
ok('rifles carry no Destructive Weapon',
  R.canDemolish(mk('regular', 'A', 18, 20), noDW.terrain[0]), false);
ok('...a medium combat vehicle does',
  R.canDemolish(mk('mcv', 'A', 18, 20), noDW.terrain[0]), true);
ok('Incendiary counts as one, against buildings only', (function () {
  var chem = mk('chem', 'A', 18, 20);
  return R.canDemolish(chem, { kind: 'building' }) && !R.canDemolish(chem, { kind: 'barricade' });
})(), true);
ok('a bunker shrugs it all off',
  R.canDemolish(mk('mcv', 'A', 18, 20), { kind: 'bunker' }), false);

head('Firing through cover: the breach (p. 57)');
var breached = 0, coverKept = 0, m = 6000;
for (var i2 = 0; i2 < m; i2++) {
  var w2 = world([{ kind: 'barricade', x: 24, y: 18, w: 4, h: 4 }]);
  var a2 = mk('mcv', 'A', 14, 20), t2 = mk('regular', 'B', 26, 20);
  w2.units = [a2, t2];
  R.shoot(w2, a2, t2, 'fire', {});
  if (w2.terrain[0].kind === 'razed') breached++;
  var w3 = world([{ kind: 'barricade', x: 24, y: 18, w: 4, h: 4 }]);
  var a3 = mk('regular', 'A', 14, 20), t3 = mk('regular', 'B', 26, 20);
  w3.units = [a3, t3];
  R.shoot(w3, a3, t3, 'fire', {});
  if (w3.terrain[0].kind === 'barricade') coverKept++;
}
ok('a Destructive Weapon sometimes blows the cover in', breached > m * 0.05, true,
  Math.round(100 * breached / m) + '% of attacks');
ok('...and an ordinary rifle team never does', coverKept, m);

head('What the wreckage does');
var wr = world([{ kind: 'barricade', x: 24, y: 18, w: 4, h: 4 }]);
var shooter = mk('regular', 'A', 14, 20), hider = mk('regular', 'B', 26, 20);
wr.units = [shooter, hider];
var before = R.defenceAgainst(wr, shooter, hider, {}).value;
R.destroyTerrain(wr, wr.terrain[0], [], shooter);
ok('rubble no longer shelters anyone', before - R.defenceAgainst(wr, shooter, hider, {}).value, 2);
ok('...and can be walked over', R.terrainBars(hider, 'razed'), false);

var bw = world([{ kind: 'building', x: 24, y: 18, w: 4, h: 4 }]);
var inside = mk('regular', 'B', 26, 20), outside = mk('regular', 'A', 12, 20);
bw.units = [outside, inside];
var log = [];
var res = R.destroyTerrain(bw, bw.terrain[0], log, outside);
ok('a wrecked building burns', bw.terrain[0].kind, 'burning');
ok('...blocks line of sight', R.TERRAIN.burning.blocks, true);
ok('...is impassable', R.terrainBars(inside, 'burning'), true);
ok('...and turns its garrison out', res.evicted.length === 1 &&
  !R.inRect(inside.x, inside.y, bw.terrain[0]), true,
  'to ' + inside.x.toFixed(1) + ',' + inside.y.toFixed(1));

head('Sappers, and heavy hulls driving through');
var sapDown = 0, k = 3000;
for (var i3 = 0; i3 < k; i3++) {
  var w4 = world([{ kind: 'wall', x: 26, y: 16, w: 1, h: 8 }]);
  var eng = mk('engineers', 'A', 22, 20);
  w4.units = [eng];
  if (R.assaultTerrain(w4, eng, w4.terrain[0]).down) sapDown++;
}
ok('Sappers blow a high wall in on 15+ or a 9', sapDown > k * 0.4, true,
  Math.round(100 * sapDown / k) + '% of charges');
var fb = world([{ kind: 'wall', x: 26, y: 16, w: 1, h: 8 }]);
var eng2 = mk('engineers', 'A', 22, 20);
fb.units = [eng2];
var start = eng2.x;
var tries = 0;
while (tries++ < 200) {
  var f2 = world([{ kind: 'wall', x: 26, y: 16, w: 1, h: 8 }]);
  var e2 = mk('engineers', 'A', 22, 20);
  f2.units = [e2];
  var r2 = R.assaultTerrain(f2, e2, f2.terrain[0]);
  if (!r2.down) { ok('a failed charge falls back 2"', Math.abs(e2.x - 22) > 1.5, true); break; }
}
var heavy = mk('lcv', 'A', 20, 20);                   // Tier III
var light = mk('lpv', 'A', 20, 20);                   // Tier I
ok('a Tier III hull may drive through a high wall', R.terrainBars(heavy, 'wall'), false);
ok('...a Tier I one may not', R.terrainBars(light, 'wall'), true);
ok('...and neither may enter a burning building', R.terrainBars(heavy, 'burning'), true);
var crushWorld = world([{ kind: 'barricade', x: 24, y: 18, w: 2, h: 4 }]);
crushWorld.units = [heavy];
var clog = [];
var crushed = R.crushOnMove(crushWorld, heavy, { x: 20, y: 20 }, { x: 30, y: 20 }, clog);
ok('driving over a low wall flattens it', crushed.length === 1 &&
  crushWorld.terrain[0].kind === 'razed', true);
var lw = world([{ kind: 'barricade', x: 24, y: 18, w: 2, h: 4 }]);
lw.units = [light];
ok('...but a Tier I hull just bumps over it',
  R.crushOnMove(lw, light, { x: 20, y: 20 }, { x: 30, y: 20 }, []).length, 0);

head('Line of sight reopens and closes');
var los = world([{ kind: 'wall', x: 24, y: 14, w: 1, h: 12 }]);
var west = mk('regular', 'A', 18, 20), east = mk('regular', 'B', 30, 20);
los.units = [west, east];
ok('a high wall blocks the view', R.hasLoS(los, west, east), false);
R.destroyTerrain(los, los.terrain[0], [], west);
ok('...and the rubble does not', R.hasLoS(los, west, east), true);
var burn2 = world([{ kind: 'building', x: 24, y: 16, w: 4, h: 8 }]);
burn2.units = [mk('regular', 'A', 16, 20), mk('regular', 'B', 32, 20)];
R.destroyTerrain(burn2, burn2.terrain[0], [], burn2.units[0]);
ok('a burning shell still blocks it',
  R.hasLoS(burn2, burn2.units[0], burn2.units[1]), false);

/* ------------------------------------- the Demolish objective is open to all */
head('Bringing the scenario objective down (pp. 49, 54)');
var target = { kind: 'objective', x: 22, y: 22, w: 4, h: 4, cx: 24, cy: 24 };
var wall = { kind: 'barricade', x: 22, y: 30, w: 4, h: 1 };
var bldg = { kind: 'building', x: 30, y: 22, w: 4, h: 4 };
function who(key) { return mk(key, 'A', 24, 20); }
ok('any infantry unit may put charges against the objective',
  ['recruits', 'regular', 'veterans', 'enforcers', 'irregulars', 'penal', 'shock', 'medics']
    .every(function (k) { return R.canCharge(who(k), target); }), true);
ok('...including a Sapper, who does it better',
  R.canCharge(who('engineers'), target), true);
ok('...but only Sappers may charge anything else',
  ['recruits', 'regular', 'veterans'].some(function (k) {
    return R.canCharge(who(k), wall) || R.canCharge(who(k), bldg);
  }), false);
ok('...which Sappers may', R.canCharge(who('engineers'), wall) &&
  R.canCharge(who('engineers'), bldg), true);
ok('a vehicle never assaults anything', R.canCharge(mk('lcv', 'A', 24, 20), target), false);
ok('...nor does a Cumbersome Weapon', R.canCharge(who('mortarteam'), target), false,
  'it may not Assault at all');
ok('a Sapper brings it down more often than a rifle team', (function () {
  var w = world([target]);
  var sap = 0, plain = 0, runs = 4000;
  for (var i = 0; i < runs; i++) {
    var t1 = { kind: 'objective', x: 22, y: 22, w: 4, h: 4, cx: 24, cy: 24 };
    var t2 = { kind: 'objective', x: 22, y: 22, w: 4, h: 4, cx: 24, cy: 24 };
    var w1 = world([t1]); w1.units = [who('engineers')];
    var w2 = world([t2]); w2.units = [who('regular')];
    if (R.assaultTerrain(w1, w1.units[0], t1).down) sap++;
    if (R.assaultTerrain(w2, w2.units[0], t2).down) plain++;
  }
  return (sap > plain) + ' (' + Math.round(100 * sap / runs) + '% against ' +
    Math.round(100 * plain / runs) + '%)';
})().slice(0, 4), 'true');
ok('gunfire alone will not bring the objective down',
  R.canDemolish(who('regular'), target) && !R.canDemolish(mk('lcv', 'A', 24, 20), target), true,
  'a hull needs a Destructive Weapon even for that');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
