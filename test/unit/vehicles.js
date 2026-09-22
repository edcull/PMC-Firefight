/* Vehicles, aircraft and transport, checked against the rulebook (pp. 34-39). */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

function mk(key, side, x, y, facing) {
  var p = R.profile(key);
  return {
    id: side + key + Math.random().toString(36).slice(2, 6), side: side, code: p.code,
    name: p.name, label: p.name + ' [' + side + ']', cls: p.cls, art: p.art,
    tier: p.tier, size: p.size, models: p.size, move: p.move, turn: p.turn, fp: p.fp,
    range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault,
    morale: p.morale, str: p.str, transport: p.transport, cargo: [], damage: 0,
    facing: facing === undefined ? 0 : facing, aboard: null,
    rules: p.rules.slice(), x: x, y: y, sp: 0, alive: true, activated: false,
    marked: false, shotFrom: [], coordUsed: false
  };
}
function world(terrain) { return { units: [], terrain: terrain || [], objectives: [], log: [] }; }

/* 1. arcs — side is +1 to the firing roll, rear +2 */
var st = world();
var tank = mk('lcv', 'B', 20, 20, 0);
['front', 'side', 'rear'].forEach(function (want, i) {
  var pos = [[32, 20], [20, 32], [8, 20]][i];
  var gun = mk('regular', 'A', pos[0], pos[1]);
  st.units = [gun, tank];
  console.log('shot from the', R.arcOf(tank, gun), '(expect ' + want + ')');
});

/* 2. a rifle team against armour: the damage table, not the hit table */
st.units = [];
var shots = 0, dmg = 0, n = 4000;
for (var i = 0; i < n; i++) {
  var t = mk('lcv', 'B', 20, 20, 0), a = mk('regular', 'A', 28, 20);
  st.units = [a, t];
  R.shoot(st, a, t, 'fire', {});
  dmg += t.damage;
  if (t.damage) shots++;
}
console.log('rifle team vs Light combat vehicle: avg', (dmg / n).toFixed(2),
  'damage a turn,', Math.round(100 * shots / n) + '% of attacks tell');

/* 3. the same team with an anti-tank weapon */
dmg = 0;
for (var i = 0; i < n; i++) {
  var t2 = mk('lcv', 'B', 20, 20, 0), a2 = mk('atteam', 'A', 28, 20);
  st.units = [a2, t2];
  R.shoot(st, a2, t2, 'fire', {});
  dmg += t2.damage;
}
console.log('anti-tank team vs the same vehicle: avg', (dmg / n).toFixed(2), 'damage a turn');

/* 4. a vehicle takes no cover from terrain */
var woods = world([{ kind: 'woods', x: 16, y: 16, w: 8, h: 8 }]);
var inWoods = mk('lcv', 'B', 20, 20, 0), gunner = mk('regular', 'A', 30, 20);
woods.units = [gunner, inWoods];
var foot = mk('regular', 'B', 20, 20);
console.log('vehicle in woods Def', R.defenceAgainst(woods, gunner, inWoods, {}).value,
  '(expect 13, no cover) · infantry in the same woods Def',
  R.defenceAgainst(woods, gunner, foot, {}).value, '(expect 12)');

/* 5. knocked out: destruction results over many wrecks */
var results = { abandoned: 0, fire: 0, boom: 0 };
for (var i = 0; i < 3000; i++) {
  var v = mk('lpv', 'B', 20, 20, 0), log = [];
  st.units = [v];
  R.applyDamage(st, v, v.str + 1, log, null);
  var txt = log.map(function (l) { return l.text; }).join(' ');
  if (/Abandoned/.test(txt)) results.abandoned++;
  else if (/on fire/.test(txt)) results.fire++;
  else if (/Catastrophic/.test(txt)) results.boom++;
}
console.log('destruction rolls:', JSON.stringify(results), '(expect roughly 50/33/17)');

/* 6. overkill pushes the result up the table */
var over = { abandoned: 0, fire: 0, boom: 0 };
for (var i = 0; i < 3000; i++) {
  var v2 = mk('lpv', 'B', 20, 20, 0), log2 = [];
  st.units = [v2];
  R.applyDamage(st, v2, v2.str + 6, log2, null);      // 5 past the kill
  var txt2 = log2.map(function (l) { return l.text; }).join(' ');
  if (/Abandoned/.test(txt2)) over.abandoned++;
  else if (/on fire/.test(txt2)) over.fire++;
  else if (/Catastrophic/.test(txt2)) over.boom++;
}
console.log('with 5 points of overkill:', JSON.stringify(over), '(expect the boom share to rise)');

/* 7. the wreck goes off: troops within 4" are caught */
var blast = world();
var wreck = mk('mcv', 'B', 20, 20, 0);
var near = mk('regular', 'A', 23, 20), far = mk('regular', 'A', 34, 20);
blast.units = [wreck, near, far];
var boomNear = 0, boomFar = 0, quietNear = 0, booms = 0, quiets = 0;
for (var i = 0; i < 600; i++) {
  var w2 = mk('mcv', 'B', 20, 20, 0);
  var n2 = mk('regular', 'A', 23, 20), f2 = mk('regular', 'A', 34, 20);
  blast.units = [w2, n2, f2];
  var blog = [];
  R.applyDamage(blast, w2, w2.str + 1, blog, null);
  var went = /Catastrophic/.test(blog.map(function (l) { return l.text; }).join(' '));
  if (went) { booms++; boomNear += n2.sp; boomFar += f2.sp; }
  else { quiets++; quietNear += n2.sp; }
}
console.log('catastrophic wrecks:', booms, '— troops 3" away took', (boomNear / booms).toFixed(1),
  'SP on average, troops 14" away', (boomFar / booms).toFixed(1),
  '· abandoned or burning wrecks:', quiets, 'and nearby troops took', (quietNear / quiets).toFixed(1));

/* 8. transport */
var road = world();
var apc = mk('hapc', 'A', 20, 20, 0);
var squad = mk('regular', 'A', 22, 20), far2 = mk('regular', 'A', 40, 20);
var shaken = mk('regular', 'A', 21, 20); shaken.sp = 99;
road.units = [apc, squad, far2, shaken];
console.log('embark within 4":', !!R.canEmbark(road, apc, squad),
  '· at 18":', !!R.canEmbark(road, apc, far2),
  '· a suppressed squad:', !!R.canEmbark(road, apc, shaken));
squad.sp = 4;
R.embark(road, apc, squad);
console.log('aboard:', apc.cargo.length, '· off the table:', squad.x < 0, '· SP cleared:', squad.sp === 0);
R.disembark(road, apc, squad, { x: 22, y: 21 });
console.log('after disembark: cargo', apc.cargo.length, '· back on the table at',
  squad.x.toFixed(1) + ',' + squad.y.toFixed(1), '· cannot re-board:', !R.canEmbark(road, apc, squad));

/* 9. a destroyed transport turns out its passengers */
var doomed = mk('lapc', 'B', 20, 20, 0);
var riders = mk('regular', 'B', 21, 20);
var t9 = world(); t9.units = [doomed, riders];
R.embark(t9, doomed, riders);
var log9 = [];
R.applyDamage(t9, doomed, doomed.str + 1, log9, null);
console.log('passengers after the wreck: alive', riders.alive, '· on the table', riders.x >= 0,
  '· SP', riders.sp);

/* 10. aircraft */
var air = world();
var jet = mk('fsc', 'B', 20, 20, 0);
var rifles = mk('regular', 'A', 26, 20), sam = mk('sam', 'A', 26, 20);
air.units = [rifles, jet];
console.log('rifles may shoot at an aircraft:', R.canShoot(air, rifles, jet, 'fire', {}),
  '· a SAM team may:', R.canShoot(air, sam, jet, 'fire', {}));
air.units = [sam, jet];
var ground = mk('regular', 'A', 26, 20);
air.units = [sam, ground];
console.log('the SAM team may not shoot infantry:', !R.canShoot(air, sam, ground, 'fire', {}));
console.log('nothing may assault an aircraft:', !R.canAssault(rifles, jet),
  '· a vehicle may not charge:', !R.canAssault(tank, rifles));

/* 11. Limited Fire Arc */
var arcTest = world();
var destroyer = mk('ldestroyer', 'A', 20, 20, 0);     // facing +x
var ahead = mk('regular', 'B', 30, 20), beside = mk('regular', 'B', 20, 30);
arcTest.units = [destroyer, ahead, beside];
console.log('limited arc — ahead:', R.canShoot(arcTest, destroyer, ahead, 'fire', {}),
  '· abeam:', R.canShoot(arcTest, destroyer, beside, 'fire', {}), '(expect true, false)');

/* 12. repairs */
var fix = mk('hapc', 'A', 20, 20, 0);
fix.damage = 4;
var rep = R.repair(world(), fix);
console.log('repair roll:', rep.text);

/* 13. infantry assaulting armour get +4 and use the breach table */
var melee = world();
var eng = mk('engineers', 'A', 20, 20), target = mk('lapc', 'B', 22, 20, 0);
melee.units = [eng, target];
var res = R.assault(melee, eng, target);
console.log('--- engineers charge an APC ---');
res.log.forEach(function (l) { console.log('  ', l.text, l.math ? '| ' + l.math : ''); });

/* 14. the specialist vehicles from pp. 77-79 */
var spec = world();
var spg = mk('lsupport', 'A', 10, 20, 0);
var closeTgt = mk('regular', 'B', 18, 20), farTgt = mk('regular', 'B', 40, 30);
spec.units = [spg, closeTgt, farTgt];
console.log('artillery at 8" (inside its 12" minimum):', R.canShoot(spec, spg, closeTgt, 'fire', {}),
  '· at 32":', R.canShoot(spec, spg, farTgt, 'fire', {}), '(expect false, true)');
farTgt.marked = true;
console.log('a marked target may be shelled without sight:', R.canShoot(spec, spg, farTgt, 'fire', {}));

var flak = mk('aaveh', 'A', 20, 20, 0);
var plane = mk('fsc', 'B', 30, 20, 0), walker = mk('regular', 'B', 30, 20);
spec.units = [flak, plane];
console.log('AA vehicle vs aircraft:', R.canShoot(spec, flak, plane, 'fire', {}));
spec.units = [flak, walker];
console.log('AA vehicle vs infantry:', R.canShoot(spec, flak, walker, 'fire', {}), '(expect false)');

var jamWorld = world();
var ewv = mk('ewveh', 'A', 20, 20, 0), hurt = mk('mcv', 'B', 26, 20, 0);
hurt.damage = 5;
jamWorld.units = [ewv, hurt];
var clean = 0, jammed = 0;
for (var i = 0; i < 2000; i++) {
  var v3 = mk('mcv', 'B', 26, 20, 0); v3.damage = 5;
  jamWorld.units = [ewv, v3]; R.repair(jamWorld, v3); jammed += 5 - v3.damage;
  var v4 = mk('mcv', 'B', 26, 20, 0); v4.damage = 5;
  jamWorld.units = [v4]; R.repair(jamWorld, v4); clean += 5 - v4.damage;
}
console.log('repairs a turn — unjammed', (clean / 2000).toFixed(2),
  '· under an EW vehicle', (jammed / 2000).toFixed(2), '(expect the jammed figure to be lower)');

var medWorld = world();
var mdv = mk('medveh', 'A', 20, 20, 0), hurtFoot = mk('regular', 'A', 22, 20);
medWorld.units = [mdv, hurtFoot];
console.log('a medical vehicle counts as medics within 6":', R.medicNearby(medWorld, hurtFoot),
  '· a squad 20" away:', R.medicNearby(medWorld, mk('regular', 'A', 40, 20)), '(expect true, false)');

var flame = mk('lengveh', 'A', 20, 20, 0), hut = mk('regular', 'B', 26, 20);
var burn = world(); burn.units = [flame, hut];
var sp = 0;
for (var i = 0; i < 2000; i++) {
  var h2 = mk('regular', 'B', 26, 20); burn.units = [flame, h2];
  R.shoot(burn, flame, h2, 'fire', {}); sp += h2.sp;
}
console.log('light engineering vehicle (incendiary) puts', (sp / 2000).toFixed(2),
  'SP a turn on a rifle team');
