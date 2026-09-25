/* The Xenotripods (pp. 128-143): the list, the army rules and the unit rules,
   exercised against the engine. */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(56) +
    String(got).padEnd(8) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }
function mk(key, side, x, y, opts) {
  opts = opts || {};
  var p = R.profile(key);
  return {
    id: side + key + Math.random().toString(36).slice(2, 6), key: key, side: side, code: p.code,
    name: p.name, label: p.name + ' [' + side + ']', cls: p.cls || 'infantry', art: p.art, faction: p.faction,
    group: p.group, tier: p.tier, size: p.size, startSize: p.size, models: opts.models || p.size, move: p.move, turn: p.turn,
    fp: p.fp, range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault,
    morale: p.morale, str: p.str, transport: p.transport, cargo: [], damage: opts.damage || 0,
    facing: opts.facing || 0, aboard: null, rules: p.rules.slice(), x: x, y: y, sp: opts.sp || 0,
    alive: true, activated: false, marked: false, shotFrom: [], drone: !!opts.drone
  };
}
function world(units, terrain) { return { units: units || [], terrain: terrain || [], objectives: [], log: [] }; }

head('The tribe list');
var xs = R.CATALOGUE.filter(function (p) { return p.faction === 'xeno'; });
ok('39 Xenotripod rows (turret sets one row each)', xs.length, 39);
ok('no ground vehicles but turrets', xs.filter(function (p) { return p.cls === 'vehicle' && p.rules.indexOf('Turret') < 0; }).length, 0);
ok('Epsilon squads are nine Esh-Aven', R.profile('xeps3').size, 9);
ok('the faction pays in Territorial Points', R.FACTIONS.xeno.money, 'TP');
ok('turrets take no propulsion', R.propsFor(R.profile('xdturret3')).length, 0);
ok('and are not offered as drones (they already are)', R.canBeDrone(R.profile('xdturret3')), false);
for (var bt = 1; bt <= 5; bt++) for (var pl = 1; pl <= 2; pl++) {
  var good = 0;
  for (var k = 0; k < 20; k++) if (R.checkArmy(R.rollArmy(bt, pl, null, 'xeno'), bt, pl).ok) good++;
  ok('rolled tribes are legal, BT ' + bt + ' PL ' + pl, good, 20);
}
ok('one Alpha squad per PL', R.checkArmy(['xalpha1', 'xalpha1', 'xeps1', 'xeps1', 'xeps1'], 1, 1).faults.some(function (f) { return /Alpha/.test(f); }), true);
ok('one Defensive turret set per army', R.checkArmy(['xalpha3', 'xeps3', 'xeps3', 'xeps3', 'xdturret1', 'xdturret2'], 3, 2).faults.some(function (f) { return /Defensive Turrets/.test(f); }), true);
ok('four turret sets and craft is one too many at PL1', R.checkArmy(['xalpha5', 'xeps5', 'xeps5', 'xeps5', 'xdturret1', 'xtturret2', 'xsturret3', 'xrecon'], 5, 1).faults.some(function (f) { return /turrets/.test(f); }), true);
ok('no aircraft at BT I', R.checkArmy(['xalpha1', 'xeps1', 'xeps1', 'xeps1'].concat(['xstrike2']), 1, 2).faults.some(function (f) { return /Aircraft/.test(f); }), true);

head('Limited Senses and Mental Projection (p. 129)');
var eps = mk('xeps3', 'A', 5, 5), rifle = mk('regular', 'B', 5, 20);
var st = world([eps, rifle]);
ok('an Esh-Aven squad sees only 12"', R.sightRange(eps), 12);
ok('so a rifle team 13" off, in range, is out of sight', R.canShoot(st, eps, rifle, 'fire'), false);
ok('...but the rifle team sees it back', R.canShoot(st, rifle, eps, 'fire'), true);
var beta = mk('xbeta3', 'A', 9, 12);
st.units.push(beta);
ok('a Beta 7" from the enemy sees it for the whole tribe', R.tribeSees(st, 'A', rifle), true);
ok('and now the Epsilon squad may shoot', R.canShoot(st, eps, rifle, 'fire'), true);
beta.sp = 20;
ok('a broken Beta projects nothing', R.canShoot(st, eps, rifle, 'fire'), false);
beta.sp = 0;
var wall = { kind: 'rocks', x: 3, y: 15, w: 5, h: 2 };
var st2 = world([mk('xeps3', 'A', 5, 5), mk('xbeta3', 'A', 10, 22), mk('regular', 'B', 5, 20)], [wall]);
ok('seen by the tribe, but rocks in the Epsilon line', R.canShoot(st2, st2.units[0], st2.units[2], 'fire'), false);
var gam = mk('xgamma3', 'A', 5, 4);
st2.units.push(gam);
ok('a Gamma (Indirect Fire) lobs over the rocks at it', R.canShoot(st2, gam, st2.units[2], 'fire'), true);
var tur = mk('xdturret1', 'A', 5, 5, { drone: true });
ok('a turret is a drone: normal 36" sight', R.sightRange(tur), 36);
var strike = mk('xstrike3', 'A', 5, 5);
ok('a Strike craft sees 12" too', R.canShoot(world([strike, mk('regular', 'B', 5, 25)]), strike, mk('regular', 'B', 5, 25), 'fire'), false);

head('Cloaking System (p. 129)');
var hb = mk('xbeta4', 'A', 5, 5), sh = mk('regular', 'B', 5, 20);
var st3 = world([hb, sh]);
ok('a cloaked Beta can not be shot from 13"', R.canShoot(st3, sh, hb, 'fire'), false);
sh.y = 16;
ok('...but can from 9"', R.canShoot(st3, sh, hb, 'fire'), true);
ok('nor charged from further than 12"', R.canAssault(mk('commandos', 'B', 5, 20), hb), false);

head('Shield Generator (p. 130)');
var sg = mk('xsturret3', 'A', 10, 10, { drone: true }), crocks = mk('xeps3', 'A', 10, 14);
var gun = mk('regular', 'B', 10, 30), close = mk('regular', 'B', 10, 20);
var st4 = world([sg, crocks, gun, close]);
var dfar = R.defenceAgainst(st4, gun, crocks, {}).value, dnear = R.defenceAgainst(st4, close, crocks, {}).value;
ok('+2 Defence against a shot from outside the dome', dfar - crocks.def, 2);
ok('nothing against a shot from inside it', dnear - crocks.def, 0);
var craft = mk('xshieldb', 'A', 10, 12);
st4.units.push(craft);
ok('the craft\'s +1 does not stack with the turret\'s +2', R.defenceAgainst(st4, gun, crocks, {}).value - crocks.def, 2);

head('Psychic Bond (p. 129)');
var a1 = mk('xeps2', 'A', 10, 10), a2 = mk('xalpha3', 'A', 13, 10), a3 = mk('xbeta3', 'A', 30, 10);
var st5 = world([a1, a2, a3]);
var lg = [];
R.shoot && null;
var res = { casualties: 2, sp: 0 };
(function () {
  // applyResult is internal: drive it through a resolved shot's result
  var fakeLog = [];
  R.psychicBond(st5, a1, 2, fakeLog);
  lg = fakeLog;
})();
ok('two Esh-Aven die: the Alpha 3" off takes 2 SP', a2.sp, 2);
ok('the Beta 20" off feels nothing', a3.sp, 0);
ok('it is in the log', /Psychic Bond/.test(lg[0].text), true);
a1.sp = 5; a1.models = 9;
var bond = R.bondMorale(st5, a1);
ok('a shaken Esh-Aven rallies on the Alpha\'s Morale', bond && bond.m, 5);
a2.camp = { flags: { stability: true } }; a2.sp = 0;
R.psychicBond(st5, a1, 1, []);
ok('the Rite of Stability shrugs it off', a2.sp, 0);

head('Dominant Species, Molecular Reconstruction, Psychic Support');
var al = mk('xalpha3', 'A', 10, 10), e1 = mk('xeps3', 'A', 14, 10, { sp: 4 }), e2 = mk('xeps4', 'A', 14, 12, { sp: 3 }), e3 = mk('xeps2', 'A', 30, 10, { sp: 2 });
var st6 = world([al, e1, e2, e3]);
ok('Regain Control reaches the Tier III squad in range', R.regainTargets(st6, al).indexOf(e1) >= 0, true);
ok('not the Tier IV one', R.regainTargets(st6, al).indexOf(e2) >= 0, false);
ok('nor the one 20" off', R.regainTargets(st6, al).indexOf(e3) >= 0, false);
R.regainControl(st6, al);
ok('and clears it', e1.sp, 0);
var hsc = mk('xstrike4', 'A', 5, 5, { damage: 4 });
R.selfRepair(world([hsc]), hsc);
ok('Self-repair clears every Damage point', hsc.damage, 0);
ok('an Alpha squad counts as Field Medics', R.medicNearby(world([al, e1]), e1), true);

head('Turrets (p. 130)');
var tt = mk('xdturret3', 'A', 20, 20, { drone: true, facing: 0 });
ok('no rear: a shot from behind is on the front', R.arcOf(tt, { x: 10, y: 20 }), 'front');
ok('a turret never charges', R.canAssault(tt, mk('regular', 'B', 22, 20)), false);
var rolls = [], turnedEver = false;
for (var h = 0; h < 200; h++) {
  var t2 = mk('xdturret1', 'A', 20, 20, { drone: true });
  var hr = R.hack(world([t2]), { alive: true, side: 'B', label: 'H', hackUsed: false, rules: ['Hackers'] }, t2, function () { turnedEver = true; return true; });
  rolls.push(hr.roll);
}
ok('a hacked turret is never turned on its own side', turnedEver, false);

head('Teleport (p. 130)');
var p1 = mk('xtturret2', 'A', 5, 5, { drone: true }), p2 = mk('xtturret2', 'A', 40, 40, { drone: true });
var sq = mk('xeps3', 'A', 7, 5);
var st7 = world([p1, p2, sq]);
ok('a squad within 4" can be sent', R.teleportFrom(st7, p1).indexOf(sq) >= 0, true);
var tr = R.teleport(st7, sq, p1, p2);
ok('and comes out within 4" of the other pad', tr.ok && R.unitDist(sq, p2) <= 4, true);
ok('it has not used its activation', sq.activated, false);
ok('but it will not go back through this turn', R.teleportFrom(st7, p2).indexOf(sq) >= 0, false);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
