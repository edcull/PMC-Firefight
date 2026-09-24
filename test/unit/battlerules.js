/* Core battle rules that a full read of the book (pp. 30-37) found the game
   getting wrong, each put to work and measured: Suppressive Fire at Basic
   Firepower, the auxiliary weapon's modifiers, the order of assault rounds and a
   Broken unit taking all three, and the vehicle's straight lines and turns. */
global.window = {};
require('../../src/rules/rules.js');
var R = window.PMC;

var pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + (name.length > 56 ? name.slice(0, 55) + '…' : name).padEnd(57) +
    (note === undefined ? '' : note));
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
function labels(parts) { return parts.map(function (p) { return p.label; }); }

/* ---------------------------------------------------- Suppressive Fire */
console.log('\nSUPPRESSIVE FIRE (p. 59)');
var told = 0, tried = 0;
for (var i = 0; i < 400; i++) {
  var mortar = unit('mortarteam', { x: 10, y: 10 }), mark = unit('recruits', { side: 'B', x: 10, y: 40 });
  var r = R.shoot(table([mortar, mark]), mortar, mark, 'fire', {});
  if (r.hits > 0) { tried++; if (r.log.some(function (l) { return /Suppressive Fire \+2 SP/.test(l.text); })) told++; }
}
ok('an Indirect Fire mortar, firing basic, still adds +2 SP', tried > 0 && told === tried, told + ' of ' + tried + ' hitting volleys');
var auxHits = 0, auxSupp = 0;
for (var j = 0; j < 400; j++) {
  var hmg = unit('mortarteam', { x: 10, y: 10 }), near = unit('recruits', { side: 'B', x: 10, y: 16 });
  var ra = R.shoot(table([hmg, near]), hmg, near, 'fire', { aux: true });
  if (ra.hits > 0) { auxHits++; if (ra.log.some(function (l) { return /Suppressive Fire/.test(l.text); })) auxSupp++; }
}
ok('...but not with its auxiliary weapon', auxHits > 0 && auxSupp === 0, auxSupp + ' of ' + auxHits);

/* ------------------------------------------------- auxiliary weapons */
console.log('\nAUXILIARY WEAPONS (p. 32)');
var rifle = unit('regular', { x: 10, y: 10 }), foe = unit('recruits', { side: 'B', x: 10, y: 15 });
var m = R.shotMods(table([rifle, foe]), rifle, foe, 'fire', { aux: true });
ok('Firepower 1', m.parts[0].label === 'Auxiliary FP' && m.parts[0].v === 1);
ok('...still gets the +1 for Fire!', labels(m.parts).indexOf('Fire! (stationary)') >= 0, labels(m.parts).join(', '));
ok('...and +2 inside half of its 12"', labels(m.parts).indexOf('within half range') >= 0);
var far = unit('recruits', { side: 'B', x: 10, y: 20 });
var m2 = R.shotMods(table([rifle, far]), rifle, far, 'fire', { aux: true });
ok('...but not beyond 6"', labels(m2.parts).indexOf('within half range') < 0, R.unitDist(rifle, far).toFixed(1) + '" apart');
var wall = { kind: 'barricade', x: 4, y: 14.2, w: 12, h: 0.6 };
var hid = unit('recruits', { side: 'B', x: 10, y: 15.5 });
var m3 = R.shotMods(table([rifle, hid], [wall]), rifle, hid, 'fire', { aux: true });
ok('a target behind a low wall keeps its cover', m3.def.value === hid.def + 2, 'Defence ' + m3.def.value);
var lrrp = unit('lrrp', { x: 10, y: 10 });
var m4 = R.shotMods(table([lrrp, hid], [wall]), lrrp, hid, 'fire', { aux: true });
ok('...a Gauss unit\'s aux shot does not strip it', m4.def.value === hid.def + 2, 'Defence ' + m4.def.value);
var m5 = R.shotMods(table([lrrp, hid], [wall]), lrrp, hid, 'fire', {});
ok('...where its main weapon does', m5.def.value === hid.def, 'Defence ' + m5.def.value);

/* --------------------------------------------------------- assaults */
console.log('\nASSAULTS (p. 33)');
function rounds(res) {
  return res.log.filter(function (l) { return l.t === 'round'; }).map(function (l) { return /\(attacker\)/.test(l.text) ? 'A' : 'D'; }).join('');
}
var alternating = 0, sixes = 0, fought = 0;
for (var k = 0; k < 300; k++) {
  // two even, hard-to-hurt squads, so most fights go the distance
  var a = unit('veterans', { x: 10, y: 10, sp: 0 }), d = unit('veterans', { side: 'B', x: 10, y: 13, fp: null });
  var res = R.assault(table([a, d]), a, d);
  var seq = rounds(res);
  if (!seq) continue;
  fought++;
  if (/^(AD)*A?$/.test(seq)) alternating++;
  if (seq === 'ADADAD') sixes++;
}
ok('rounds alternate, attacker first', fought > 0 && alternating === fought, alternating + ' of ' + fought + ' fights');
ok('...six rounds when neither side breaks', sixes > 0, sixes + ' went the distance');
var full = 0, n3 = 0;
for (var b = 0; b < 200; b++) {
  var hit = unit('recruits', { x: 10, y: 10 }), run = unit('veterans', { side: 'B', x: 10, y: 13, fp: null });
  run.sp = 2 * R.currentMorale(run) + 1;                      // Broken before the charge
  var rb = R.assault(table([hit, run]), hit, run);
  var sq = rounds(rb);
  if (!run.alive) continue;
  n3++;
  if (sq === 'AAA') full++;
}
ok('a Broken unit takes all three rounds and strikes none', n3 > 0 && full === n3, full + ' of ' + n3);

/* ------------------------------------------------------ vehicle moves */
console.log('\nVEHICLES: STRAIGHT LINES AND TURNS (p. 35)');
function lcv(over) { return unit('lcv', Object.assign({ x: 10, y: 24, facing: 0 }, over || {})); }
function spotAt(list, x, y) { return list.filter(function (c) { return Math.abs(c.x - x) < 0.01 && Math.abs(c.y - y) < 0.01; })[0]; }
var car = lcv(), open1 = table([car]);
var reach = R.reachable(open1, car, 14);
var ahead = spotAt(reach, 20, 24);
ok('straight ahead costs the distance, no turn', ahead && Math.abs(ahead.spent - 10) < 0.01 && ahead.turns === 0, ahead && ahead.spent + '" · ' + ahead.turns + ' turns');
var side = spotAt(reach, 10, 34);
ok('a quarter turn costs one turn', side && side.turns === 1 && Math.abs(side.spent - 11) < 0.3, side && side.spent.toFixed(1) + '" · ' + side.turns + ' turn');
var slight = spotAt(reach, 20, 29);
ok('...and so does a turn of well under 45°', slight && slight.turns >= 1, slight && slight.turns + ' turn');
var back = spotAt(reach, 5, 24);
ok('coming about and driving on beats a long reverse', back && !back.reverse && Math.abs(back.spent - 7) < 0.01, back && back.spent + '" (2 turns + 5")');
// a hull that turns slowly backs up instead
var slow = lcv({ turn: 2 }), open2 = table([slow]);
var back2 = spotAt(R.reachable(open2, slow, 14), 8, 24);
ok('straight back is half speed, no turn', back2 && back2.reverse && Math.abs(back2.spent - 4) < 0.01, back2 && back2.spent + '" reversing 2"');
var bp = R.pathTo(open2, slow, 14, { x: 8, y: 24 });
ok('...and leaves the hull facing the way it did', bp.reverse === true && bp.facing === null);
var sp = R.pathTo(open1, car, 14, { x: 10, y: 34 });
ok('after a turn the hull faces its last leg', sp.facing !== null && Math.abs(Math.abs(sp.facing) - Math.PI / 2) < 0.5, (sp.facing * 180 / Math.PI).toFixed(0) + '°');
// a building square across the road: the hull has to go round, and pays for every bend
var blockB = { kind: 'building', x: 16, y: 20, w: 6, h: 8, id: 'b1' };
var car2 = lcv(), walled = table([car2], [blockB]);
var round = spotAt(R.reachable(walled, car2, 30), 28, 24);
ok('going round a building pays a turn for each bend', round && round.turns >= 2, round && round.turns + ' turns · ' + round.spent.toFixed(1) + '"');
ok('...so the far side costs more than the straight run', round && round.spent > 18 + 2 * 1 - 0.01, round && round.spent.toFixed(1) + '" for 18" as the crow flies');
var t0 = Date.now(); for (var z = 0; z < 5; z++) R.reachable(table([lcv({ x: 10 + z })]), lcv({ x: 10 + z }), 20);
ok('a drive is worked out quickly', (Date.now() - t0) / 5 < 400, ((Date.now() - t0) / 5).toFixed(0) + ' ms a drive');

/* ------------------------------------------------ the smaller rules */
console.log('\nSMALLER RULES');
ok('the Demolish objective cannot be shot down', !R.canDemolish(unit('regular'), { kind: 'objective', x: 20, y: 20, w: 4, h: 4 }));
var flak = R.checkArmy(['rlflak', 'rmflak', 'rhflak', 'rmilitia', 'rmilitia', 'rmilitia', 'rleaders'], 4, 1);
ok('one FlaK vehicle a Priority Level, of any kind', flak.faults.some(function (f) { return /flak/i.test(f); }), flak.faults.join(' ').slice(0, 60));
var boss = unit('rleaders', { x: 10, y: 10 }), pow = unit('rpow', { x: 10, y: 16, sp: 3 }), mil2 = unit('rmilitia', { x: 12, y: 16, sp: 3 });
var dst = table([boss, pow, mil2]);
ok('Deserters and POWs get no Death or Glory', !R.deathOrGlory(dst, pow) && !!R.deathOrGlory(dst, mil2));
ok('...nor the leader\'s rally dice', R.freedomDice(dst, pow) === 0 && R.freedomDice(dst, mil2) > 0);
var ls = unit('rmilitia', { side: 'B', x: 10, y: 15.5, tactic: 'laststand' });
var mls = R.shotMods(table([rifle, ls], [wall]), rifle, ls, 'fire', {});
ok('Last Stand: +4 behind a low wall too', mls.def.value === ls.def + 4, 'Defence ' + mls.def.value);
var gun = unit('rmedart', { side: 'B', x: 10, y: 30, dugIn: true });
if (R.profile('rmedart')) {
  var mg = R.shotMods(table([rifle, gun]), rifle, gun, 'fire', {});
  ok('a dug-in gun has its sandbags', mg.def.value === gun.def + 2, 'Defence ' + mg.def.value);
}
var shadow = unit('bshadow', { side: 'B', x: 10, y: 30 });
var ms = R.shotMods(table([rifle, shadow]), rifle, shadow, 'fire', {});
ok('Stealth works on a hull (the Shadow bug)', ms.def.parts.some(function (p) { return p.label === 'Stealth'; }));
ok('a Tier I-II hull cannot cross a low wall', R.terrainBars(unit('lpv'), 'barricade') === true);
ok('...a Tier III one drives through it', R.terrainBars(unit('lcv'), 'barricade') === false);
ok('...and either crosses barbed wire', R.terrainBars(unit('lpv'), 'wire') === false);
var tA = unit('recruits', { side: 'B', x: 20, y: 20 }), s1 = unit('mortarteam', { x: 20, y: 40 }), s2 = unit('regular', { x: 20, y: 5 });
var xst = table([tA, s1, s2]);
R.shoot(xst, s1, tA, 'fire', {});
var xm = R.shotMods(xst, s2, tA, 'fire', {});
ok('a Basic Firepower shot sets up no Crossfire', !xm.crossfire);
var hull = unit('lcv', { side: 'B', x: 20, y: 20, alive: false, wreckLoS: true });
ok('a wrecked hull blocks sight', !R.lineClear(table([hull]), { x: 20, y: 10 }, { x: 20, y: 30 }));
var jet = unit('fsc', { x: 10, y: 24, facing: 0 }), wallOfFoes = [];
for (var yy = 4; yy <= 44; yy += 4) wallOfFoes.push(unit('recruits', { side: 'B', x: 20, y: yy }));
if (R.profile('fsc')) {
  var sky = table([jet].concat(wallOfFoes));
  var over = R.reachable(sky, jet, 30).some(function (c) { return c.x > 26; });
  ok('aircraft fly over a line of enemies', over);
}

/* ------------------------------------------------------ drone control */
console.log('\nDRONE CONTROL (p. 37)');
ok('a hull without Transport may be a drone', R.canBeDrone(R.profile('lcv')));
ok('...and so may an aircraft', R.canBeDrone(R.profile('fsc')));
ok('...and a Xenotripod craft', R.canBeDrone(R.profile('xstrike3')));
ok('...but not a transport', !R.canBeDrone(R.profile('lapc')));
ok('...nor anything of the Bugs', !R.canBeDrone(R.profile('bfirebeetle')));
var dr = R.applyDrone(unit('lcv'), true);
ok('a drone has +1 Structure and the Drone Control rule', dr.str === R.profile('lcv').str + 1 && dr.rules.indexOf('Drone Control') >= 0);
global.window.PMC = R; require('../../src/rules/campaign.js');
var CC = window.PMCCamp;
if (CC && CC.expFor) {
  var ex = CC.expFor({}, { entry: { key: 'lcv', drone: true }, company: {}, won: true, enemyTier: 3, ownTier: 1 });
  ok('a drone earns no experience in a campaign', ex.total === 0, ex.lines[0].text);
}

/* ------------------------------------------------------ the Overmind */
console.log('\nOVERMIND (p. 116)');
var watchers = unit('bimmwatch', { x: 10, y: 10, side: 'A' });
var forms = unit('battack', { x: 10, y: 18, side: 'A', models: 4 });
if (R.profile('bimmwatch') && R.profile('battack')) {
  var hive = table([watchers, forms]);
  ok('a Tier II Overmind holds back Tier III Aggressive bugs', !R.aggressiveNow(hive, forms));
  var tide = R.endlessTide(hive);
  ok('...and brings their losses back', tide.length === 1 && forms.models > 4, forms.models + ' models');
  ok('...but gives them no terrain bonus above its Tier', !R.overmindFor(hive, forms, false));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
if (fail) process.exit(1);
