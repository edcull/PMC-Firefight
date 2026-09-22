/* The Rebel army, checked against the book (pp. 92-109).

   Every profile below was typed out a second time from the rulebook and is
   compared column by column against what the game holds, the way roster.js does
   for the PMC list. After that the army rules, the unit rules and the three
   Tactics are each put to work and measured. */
global.window = {};
require('../../src/rules/rules.js');
var R = window.PMC;

var pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + (name.length > 56 ? name.slice(0, 55) + '…' : name).padEnd(57) +
    (note === undefined ? '' : note));
}

/* ---------------------------------------------------------------- profiles */
/* name, Tier, Size, Move, FP, Range, Def, Assault, Morale-or-Structure */
var BOOK = [
  // Freedom Warriors (p. 96)
  ['Armed civilians', 1, 10, 4, 1, 12, 7, 1, 3],
  ['Militia', 2, 10, 4, 2, 18, 7, 1, 4],
  ['Organized insurgents', 3, 10, 4, 3, 18, 8, 2, 4],
  ['Hardened insurgents', 4, 10, 5, 3, 18, 9, 3, 5],
  ['Revolutionary guard', 5, 10, 5, 4, 18, 10, 4, 5],
  // Holy Warriors (p. 97)
  ['Acolytes', 2, 6, 5, 1, 12, 6, 2, 4],
  ['Fanatics', 3, 6, 6, 1, 12, 7, 4, 5],
  ['Enlightened ones', 4, 6, 6, 1, 18, 8, 5, 5],
  ['Mujahideen / Crusaders / Kshatriya', 5, 6, 6, 2, 18, 9, 7, 5],
  // Mounted Warriors (p. 98)
  ['Rider gang', 1, 4, 10, 2, 12, 7, 1, 3],
  ['Rider warriors', 2, 4, 10, 3, 12, 7, 1, 4],
  ['Hellriders', 3, 4, 10, 4, 12, 8, 1, 4],
  ['Legendary Hellriders', 4, 4, 12, 5, 12, 9, 1, 4],
  // Support troops (p. 99)
  ['LMG squads', 2, 6, 4, 3, 24, 7, 1, 3],
  ['Light autocannon squad', 3, 6, 4, 4, 24, 7, 1, 4],
  ['Insurgents with AT weapons', 3, 6, 4, 4, 24, 7, 1, 4],
  ['Insurgents with AA weapons', 3, 6, 4, 4, 24, 7, 1, 3],
  // Rebel artillery (p. 100)
  ['Rebel light artillery', 2, 4, 3, 3, 42, 6, 1, 3],
  ['Rebel medium artillery', 3, 6, 0, 4, 48, 6, 1, 3],
  ['Rebel heavy artillery', 4, 6, 0, 5, 60, 6, 1, 3],
  ['Heavy autocannon', 4, 4, 0, 4, 30, 8, 1, 4],
  // Chosen warriors (p. 101)
  ['Partisans – assault commando', 4, 8, 5, 3, 12, 8, 5, 5],
  ['Partisans – sabotage commando', 4, 8, 4, 2, 12, 8, 4, 5],
  ['Partisans – sniper commando', 4, 4, 5, 5, 24, 8, 1, 4],
  // Miners (p. 102)
  ['Miners team', 2, 6, 4, 3, 12, 9, 2, 3],
  ['Face miners team', 3, 6, 4, 4, 12, 9, 2, 4],
  ['Harsh-environment miners', 4, 6, 3, 4, 12, 11, 3, 4],
  // Deserters and POWs (p. 103)
  ['Deserter team (conscripts)', 1, 8, 4, 1, 18, 8, 1, 2],
  ['POWs', 2, 8, 6, 3, 12, 8, 3, 3],
  ['Deserters team (rookie rifle)', 2, 8, 4, 2, 18, 9, 2, 3],
  ['Deserters team (rifle)', 3, 8, 5, 3, 18, 10, 3, 4],
  // First Among Equals (p. 104)
  ['Instigators', 1, 6, 5, 2, 18, 7, 2, 4],
  ['Secondary insurgent leaders', 2, 6, 5, 3, 18, 8, 3, 4],
  ['Insurgent leaders', 3, 6, 5, 3, 18, 9, 3, 5],
  ['Influential leaders', 4, 6, 5, 4, 18, 9, 4, 5],
  ['Rebellion leaders', 5, 6, 5, 4, 18, 10, 4, 5],
  // Rebel combat vehicles (p. 105) — the last column is Structure
  ['Technical', 1, 1, 12, 2, 18, 9, 1, 3],
  ['Light improvised combat vehicle', 2, 1, 12, 4, 18, 9, 1, 4],
  ['Improvised combat vehicle', 3, 1, 8, 6, 24, 10, 3, 12],
  ['Heavy improvised combat vehicle', 4, 1, 6, 7, 24, 10, 2, 16],
  // Rebel transport vehicles (p. 106)
  ['Light transport vehicle', 2, 1, 10, 2, 12, 8, 1, 4],
  ['Improved transport vehicle', 3, 1, 10, 4, 18, 10, 3, 12],
  ['Super heavy transport-combat vehicle', 4, 1, 8, 6, 18, 10, 4, 14],
  // Flak vehicles (p. 107)
  ['Light FlaK vehicle', 2, 1, 10, 3, 18, 9, 2, 4],
  ['Medium FlaK vehicle', 3, 1, 8, 4, 24, 11, 2, 6],
  ['Heavy FlaK vehicle', 4, 1, 6, 5, 30, 12, 2, 6],
  // Rebel aviation (p. 108)
  ['Captured patrol craft', 2, 1, 18, 3, 12, 9, 1, 4],
  ['Armed light shuttle', 3, 1, 18, 5, 18, 11, 1, 6],
  ['Armed medium shuttle', 4, 1, 18, 5, 18, 11, 1, 7],
  ['Armed heavy shuttle', 5, 1, 18, 5, 18, 11, 1, 8],
  ['Lifter', 3, 1, 16, 0, 0, 10, 1, 7]
];
/* the turn cost printed in brackets after a ground vehicle's Movement */
var TURNS = {
  'Technical': 1, 'Light improvised combat vehicle': 1,
  'Improvised combat vehicle': 2, 'Heavy improvised combat vehicle': 2,
  'Light transport vehicle': 1, 'Improved transport vehicle': 2,
  'Super heavy transport-combat vehicle': 2,
  'Light FlaK vehicle': 2, 'Medium FlaK vehicle': 2, 'Heavy FlaK vehicle': 2
};

console.log('\nTHE REBEL LIST, COLUMN BY COLUMN (pp. 96-108)');
var list = R.listFor('rebel');
ok('every rebel row from the book is in the game', list.length === BOOK.length,
  list.length + ' profiles against ' + BOOK.length + ' rows');
var wrong = 0;
BOOK.forEach(function (row) {
  var p = list.filter(function (x) { return x.name === row[0]; })[0];
  if (!p) { wrong++; console.log('    missing: ' + row[0]); return; }
  var last = p.cls === 'infantry' ? p.morale : p.str;
  var got = [p.name, p.tier, p.size, p.move, p.fp, p.range, p.def, p.assault, last];
  for (var i = 1; i < row.length; i++) {
    if (got[i] !== row[i]) {
      wrong++;
      console.log('    ' + row[0] + ' column ' + i + ': game ' + got[i] + ', book ' + row[i]);
    }
  }
  if (TURNS[row[0]] !== undefined && p.turn !== TURNS[row[0]]) {
    wrong++;
    console.log('    ' + row[0] + ' turn cost: game ' + p.turn + ', book ' + TURNS[row[0]]);
  }
});
ok('every column matches the printed table', wrong === 0, wrong + ' mismatches');
ok('the whole list is one faction', list.every(function (p) { return p.faction === 'rebel'; }));
ok('the two lists never share a key',
  R.listFor('pmc').every(function (p) { return list.indexOf(p) < 0; }));

/* the pieces of the list that carry rules rather than numbers */
var by = {};
list.forEach(function (p) { by[p.key] = p; });
ok('the Lifter is the only unit with the Lifter rule',
  list.filter(function (p) { return p.rules.indexOf('Lifter') >= 0; })
    .map(function (p) { return p.name; }).join('') === 'Lifter');
ok('Deserters and POWs stand outside the army rules',
  list.filter(function (p) { return p.group === 'Deserters and POWs'; })
    .every(function (p) { return p.rules.indexOf('No Army Rules') >= 0; }), '4 units');
ok('every First Among Equals shouts the rally cry',
  list.filter(function (p) { return p.group === 'First Among Equals'; })
    .every(function (p) { return p.rules.indexOf('…but they\'ll never take our freedom!') >= 0; }));
ok('only the four lowest leaders may be mounted',
  list.filter(function (p) { return p.group === 'First Among Equals' && p.ridersUpgrade; }).length === 4,
  'the Rebellion leader stays on foot');
ok('three artillery pieces are emplaced',
  list.filter(function (p) { return p.rules.indexOf('Stationary Artillery') >= 0; }).length === 3);
ok('the las-cutters count as a Gauss Weapon',
  R.has({ rules: by.rminers.rules, cargo: [] }, 'Gauss Weapon'), by.rminers.rules[0]);

/* ------------------------------------------------------------- composition */
console.log('\nCOMPOSITION AND THE REBEL LIMITS (p. 92)');
var bad = 0, rolled = 0;
for (var t = 1; t <= 5; t++) {
  for (var pl = 1; pl <= 2; pl++) {
    for (var n = 0; n < 60; n++) {
      var army = R.rollArmy(t, pl, null, 'rebel');
      rolled++;
      var c = R.checkArmy(army, t, pl);
      if (!c.ok) { bad++; if (bad < 4) console.log('    ' + army.join(' ') + ' — ' + c.faults.join(' ')); }
    }
  }
}
ok('every rolled insurgent group is legal', bad === 0, rolled + ' rolled, ' + bad + ' illegal');

ok('mercenaries and insurgents cannot muster together',
  R.checkArmy(['rmilitia', 'rmilitia', 'rmilitia', 'rookie'], 2, 1).faults
    .some(function (f) { return /one faction/.test(f); }));
ok('no more than four Deserter and POW units',
  R.checkArmy(['rleaders', 'rdesrifle', 'rdesrifle', 'rdesrifle', 'rdesrifle', 'rdesrifle'], 3, 1).faults
    .some(function (f) { return /Max 4 Deserters and POWs/.test(f); }));
ok('four of them is fine',
  !R.checkArmy(['rinsurgents', 'rinsurgents', 'rinsurgents', 'rdesrifle', 'rdesrifle', 'rdesrifle', 'rdesrifle'], 3, 2)
    .faults.some(function (f) { return /Deserters and POWs/.test(f); }));
ok('one First Among Equals a Priority Level',
  R.checkArmy(['rleaders', 'rsecondary', 'rinsurgents', 'rinsurgents', 'rinsurgents'], 3, 1).faults
    .some(function (f) { return /First Among Equals/.test(f); }));
ok('two of them at Priority Level 2',
  !R.checkArmy(['rleaders', 'rsecondary', 'rinsurgents', 'rinsurgents', 'rinsurgents',
    'rinsurgents', 'rinsurgents', 'rinsurgents'], 3, 2).faults
    .some(function (f) { return /First Among Equals/.test(f); }));
ok('one aircraft a Priority Level, even at Level 2',
  R.checkArmy(['rinsurgents', 'rinsurgents', 'rinsurgents', 'rinsurgents', 'rinsurgents',
    'rinsurgents', 'rlshuttle', 'rlshuttle', 'rlshuttle'], 3, 2).faults
    .some(function (f) { return /aircraft at Priority Level 2/.test(f); }),
  'where a PMC has no such cap above Level 1');
ok('a PMC may still field three aircraft at Level 2',
  !R.checkArmy(['regular', 'regular', 'regular', 'regular', 'regular', 'regular',
    'fsc', 'fsc', 'fsc'], 3, 2).faults
    .some(function (f) { return /aircraft/.test(f); }));

/* Rebel Tactics */
console.log('\nREBEL TACTICS (p. 95)');
var lean = ['rinsurgents', 'rinsurgents', 'rinsurgents', 'rinsurgents', 'rinsurgents', 'rinsurgents',
  'rinsurgents', 'rinsurgents'];    // 8 x Tier III = 24 points against a budget of 18
ok('eight Tier III units are over budget without a tactic',
  R.checkArmy(lean, 3, 1).faults.some(function (f) { return /Over budget/.test(f); }),
  R.checkArmy(lean, 3, 1).spent + ' of 18');
ok('Human Wave Attacks pays for two of them',
  R.checkArmy(lean, 3, 1, null, 'wave').ok,
  R.checkArmy(lean, 3, 1, null, 'wave').spent + ' of 18');
ok('four extra units at Priority Level 2',
  R.checkArmy(lean.concat(lean).slice(0, 16), 3, 2, null, 'wave').ok);
ok('a PMC cannot take a Rebel tactic',
  R.checkArmy(['regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular'],
    3, 1, null, 'wave').faults.some(function (f) { return /Over budget/.test(f); }));
ok('three tactics are offered', R.TACTICS.length === 3,
  R.TACTICS.map(function (t2) { return t2.name; }).join(', '));

/* ------------------------------------------------------- the army rules */
console.log('\n"HASTA LA VICTORIA SIEMPRE!" AND UNDISCIPLINED (p. 94)');
function unit(key, over) {
  var p = R.profile(key);
  var u = {
    id: key, side: 'A', key: key, name: p.name, label: p.name, code: p.code,
    tier: p.tier, size: p.size, models: p.size, move: p.move, fp: p.fp, range: p.range,
    def: p.def, defPierced: p.defPierced, assault: p.assault, morale: p.morale,
    faction: p.faction, cls: p.cls || 'infantry', str: p.str, turn: p.turn,
    transport: p.transport, cargo: [], damage: 0, rules: p.rules.slice(),
    x: 10, y: 10, sp: 0, alive: true, tactic: null, facing: 0,
    shotFrom: [], marked: false, activated: false, aboard: null, disembarked: false
  };
  for (var k in (over || {})) u[k] = over[k];
  return u;
}

var mil = unit('rmilitia');
ok('a rebel squad at full strength has its printed Morale', R.currentMorale(mil) === 4, '4');
mil.models = 8;
ok('...and two men down changes nothing', R.currentMorale(mil) === 4, '2 lost, Morale 4');
mil.models = 7;
ok('...but the third loss bites', R.currentMorale(mil) === 3, '3 lost, Morale 3');
mil.models = 5;
ok('...and after that it falls as normal', R.currentMorale(mil) === 1, '5 lost, Morale 1');

var rifle = unit('rookie');
rifle.models = 6;
ok('a mercenary squad has no such grace', R.currentMorale(rifle) === 2, '2 lost, Morale 2');

var des = unit('rdesrifle');
des.models = 6;
ok('deserters follow no army rule either', R.currentMorale(des) === 2, '2 lost, Morale 2');
ok('...and are not Undisciplined', R.undisciplined(des) === false);
ok('but every other rebel is', R.undisciplined(mil) === true);
ok('a rebel machine is too', R.undisciplined(unit('rtechnical')) === true);
ok('a mercenary never is', R.undisciplined(rifle) === false);

/* the +2 has to show up in the shooting, not just in a flag */
function volley(target, n) {
  var state = { units: [], terrain: [], objectives: [] };
  var atk = unit('rlmg', { side: 'B', x: 10, y: 16 });
  state.units = [target, atk];
  var cas = 0;
  for (var i = 0; i < n; i++) {
    target.models = target.size; target.sp = 3 * target.morale + 1;   // broken
    var before = target.models;
    var res = R.shoot(state, atk, target, 'fire', {});
    cas += before - target.models;
  }
  return cas / n;
}
var brokenRebel = unit('rmilitia', { side: 'A' });
var brokenMerc = unit('rookie', { side: 'A', def: 7, size: 10, models: 10, morale: 4 });
var a1 = volley(brokenRebel, 4000), a2 = volley(brokenMerc, 4000);
ok('shooting a Broken rebel kills more than a Broken mercenary of the same Defence',
  a1 > a2 * 1.05, a1.toFixed(2) + ' against ' + a2.toFixed(2) + ' casualties a volley');

/* ------------------------------------------------------- the unit rules */
console.log('\nTHE LEADERS\' TWO SHOUTS (p. 94)');
function table(units) {
  units.forEach(function (u, i) { u.id = 'u' + i; });
  return { units: units, terrain: [], objectives: [], doctrines: null };
}
var leader = unit('rleaders', { x: 10, y: 10 });
var near1 = unit('rmilitia', { x: 10, y: 18 });      // 8" away, allowing for the bases
var far1 = unit('rmilitia', { x: 10, y: 40 });
var big = unit('rguard', { x: 10, y: 18 });          // two Tiers above the leader
var st = table([leader, near1, far1, big]);
ok('a rebel inside 12" gets three more rally dice', R.freedomDice(st, near1) === 3);
ok('one outside 12" gets none', R.freedomDice(st, far1) === 0);
ok('a unit two Tiers higher is past shouting at', R.freedomDice(st, big) === 0,
  'Tier V beside a Tier III leader');
ok('the leader does not shout at himself', R.freedomDice(st, leader) === 0);
near1.tactic = 'wave';
far1.tactic = 'wave';
ok('Human Wave Attacks carries the shout to 18"', R.freedomDice(st, far1) === 0, 'still 30" away');
var mid = unit('rmilitia', { x: 10, y: 26, tactic: 'wave' });   // 16"
st = table([leader, mid]);
ok('...and a unit at 16" now hears it', R.freedomDice(st, mid) === 3);
mid.tactic = null;
ok('...but not without the tactic', R.freedomDice(st, mid) === 0);

/* and that the dice really arrive */
function rallyRuns(withLeader, n) {
  var total = 0;
  for (var i = 0; i < n; i++) {
    var sq = unit('rmilitia', { x: 10, y: 18 });
    sq.sp = 6;
    var ld = unit('rleaders', { x: 10, y: 10 });
    var s2 = table(withLeader ? [ld, sq] : [sq]);
    var res = R.rally(s2, sq);
    total += res.removed;
  }
  return total / n;
}
var withL = rallyRuns(true, 6000), without = rallyRuns(false, 6000);
/* Morale 4 rolls 4 dice at 4+, so 2 SP a turn; three more dice add 1.5, but the
   unit only carries 6 SP, so the top of the range is clipped a little. */
ok('a rally with the leader clears a good deal more suppression',
  withL - without > 1.2 && withL - without < 1.7,
  without.toFixed(2) + ' SP alone against ' + withL.toFixed(2) + ' with the leader');

var glory = unit('rsecondary', { x: 10, y: 10 });
var comrade = unit('rmilitia', { x: 10, y: 16 });
var stubborn = unit('rguard', { x: 10, y: 16 });
st = table([glory, comrade, stubborn]);
ok('"Death or Glory, Comrades!" reaches a nearby unit', !!R.deathOrGlory(st, comrade));
ok('...but not one two Tiers above it', !R.deathOrGlory(st, stubborn));
ok('...and not the leader himself', !R.deathOrGlory(st, glory));
comrade.sp = comrade.morale + 1;
ok('a suppressed comrade is still eligible', R.status(comrade) === 'suppressed' && !!R.deathOrGlory(st, comrade));
var was = comrade.sp;
var foe = unit('rookie', { side: 'B', x: 10, y: 18, fp: null });
st = table([glory, comrade, foe]);
var res = R.assault(st, comrade, foe);
var shoutLine = res.log.filter(function (l) { return /Death or Glory/.test(l.text); })[0];
ok('...and the shout goes up as the charge begins', !!shoutLine,
  shoutLine ? shoutLine.text : 'no such line in the log');
ok('...clearing every point the unit was carrying',
  !!shoutLine && shoutLine.text.indexOf('all ' + was + ' Suppression') >= 0,
  'it had ' + was + ' SP');
// the melee itself piles more on, which is the assault working, not the shout failing
var quiet = unit('rmilitia', { x: 30, y: 30, sp: 5 });
var quietFoe = unit('rookie', { side: 'B', x: 30, y: 38, fp: null });
var res2 = R.assault(table([quiet, quietFoe]), quiet, quietFoe);
ok('a unit with no leader nearby gets no such help',
  !res2.log.some(function (l) { return /Death or Glory/.test(l.text); }));

/* ------------------------------------------------------------- Riders */
console.log('\nRIDERS AND THE RIDERS UPGRADE (pp. 93-94)');
var gang = unit('rridergang');
ok('a rider pays 2" for difficult ground where a man pays 1"',
  R.terrainCost(gang, 'woods') === 2 && R.terrainCost(unit('rmilitia'), 'woods') === 1);
ok('a rider cannot occupy a building', !R.canGarrison(Object.assign(gang, { x: 10, y: 10 })));
ok('...nor cross a low wall', R.terrainBars(gang, 'barricade') === true);
ok('...though infantry may do both',
  R.canGarrison(Object.assign(unit('rmilitia'), { x: 10, y: 10 })) && !R.terrainBars(unit('rmilitia'), 'barricade'));
var truck = unit('rltv', { x: 10, y: 10 });
ok('a rider will not board a transport',
  R.canEmbark(table([truck, gang]), truck, unit('rridergang', { x: 10, y: 12 })) === false);
ok('...but a militia squad will',
  R.canEmbark(table([truck, unit('rmilitia', { x: 10, y: 12 })]), truck,
    unit('rmilitia', { x: 10, y: 12 })) === true);

var fan = R.applyRiders(unit('rfanatics'), true);
ok('the Riders upgrade halves the unit', fan.size === 3, '6 models became ' + fan.size);
ok('...raises Movement to 10', fan.move === 10);
ok('...and adds the Riders rule', fan.rules.indexOf('Riders') >= 0);
var noRide = R.applyRiders(unit('rmilitia'), true);
ok('a unit the book does not offer it to is unchanged',
  noRide.size === 10 && noRide.move === 4 && noRide.rules.indexOf('Riders') < 0);
ok('a mounted pick survives a round trip through the army list',
  R.joinPick('rfanatics', null, false, true) === 'rfanatics:riders' &&
  R.splitPick('rfanatics:riders').riders === true);

/* ------------------------------------------------ Stationary Artillery */
console.log('\nSTATIONARY ARTILLERY AND "DIG IN!" (p. 94)');
var gun = unit('rmedart', { x: 24, y: 24, facing: 0 });
ok('an emplaced gun has no Movement at all', gun.move === 0);
ok('it fires indirectly out to its full range', R.shotRange(gun) === 48);
ok('...at a minimum of 12"', R.shotMinRange(gun) === 12);
ok('...and is not dug in to start with', R.dugIn(gun) === false);
gun.dugIn = true;
ok('dug in, the reach falls to 24"', R.shotRange(gun) === 24);
ok('...the minimum to 6"', R.shotMinRange(gun) === 6);
var target = unit('rookie', { side: 'B', x: 40, y: 24 });
var sBoth = table([gun, target]);
ok('a dug-in gun will not reach a target 16" outside its new range',
  R.canShoot(sBoth, gun, target, 'fire', {}) === true, '16" away, inside 24"');
var farT = unit('rookie', { side: 'B', x: 24, y: 24 + 30 });
ok('...but nothing at 30"', R.canShoot(table([gun, farT]), gun, farT, 'fire', {}) === false);
gun.dugIn = false;
farT.marked = true;
ok('indirectly, that same target is fair game',
  R.canShoot(table([gun, farT]), gun, farT, 'fire', {}) === true, 'marked, 30" away');
var behind = unit('rookie', { side: 'B', x: 24 - 16, y: 24 });   // straight behind the gun
gun.dugIn = true;
ok('a dug-in gun only bears on its front quarter',
  R.canShoot(table([gun, behind]), gun, behind, 'fire', {}) === false);
// and the trade: full modifiers instead of Basic Firepower
gun.dugIn = false;
var indirect = R.shotMods(table([gun, target]), gun, target, 'fire', {});
gun.dugIn = true;
var direct = R.shotMods(table([gun, target]), gun, target, 'fire', {});
ok('dug in, the piece shoots with every modifier',
  direct.total > indirect.total,
  indirect.total + ' firing indirectly against ' + direct.total + ' over open sights');
ok('...including the Fire! bonus it never had before',
  direct.parts.some(function (p) { return /Fire!/.test(p.label); }));

/* ---------------------------------------------------------------- Lifter */
console.log('\nTHE LIFTER (p. 94)');
var lift = unit('rlifter', { x: 10, y: 10 });
var hull = unit('rtechnical', { x: 10, y: 12 });
var foot = unit('rmilitia', { x: 10, y: 12 });
ok('a Lifter picks up a vehicle', R.canEmbark(table([lift, hull]), lift, hull) === true);
ok('...and never infantry', R.canEmbark(table([lift, foot]), lift, foot) === false);
var shuttle = unit('rlshuttle', { x: 10, y: 10 });
ok('an ordinary shuttle is the other way about',
  R.canEmbark(table([shuttle, foot]), shuttle, foot) === true &&
  R.canEmbark(table([shuttle, hull]), shuttle, hull) === false);

/* ------------------------------------------------------------ Last Stand */
console.log('\nLAST STAND IN COVER (p. 95)');
var woods = [{ kind: 'woods', x: 8, y: 8, w: 8, h: 8 }];
function coverIn(u) {
  var s2 = { units: [u], terrain: woods, objectives: [] };
  return R.coverFor(s2, unit('rookie', { side: 'B', x: 30, y: 30 }), u).v;
}
var holder = unit('rmilitia', { x: 12, y: 12 });
ok('woods shelter a rebel squad for the usual +2', coverIn(holder) === 2);
holder.tactic = 'laststand';
ok('Last Stand digs them in for +4', coverIn(holder) === 4);
var hullIn = unit('rtechnical', { x: 12, y: 12, tactic: 'laststand' });
ok('...but the tactic is for the infantry', coverIn(hullIn) === 2);
var mercIn = unit('rookie', { x: 12, y: 12, tactic: 'laststand' });
ok('...and for the rebels', coverIn(mercIn) === 2);
var lsq = unit('rmilitia', { tactic: 'laststand', models: 7 });
ok('Last Stand also buys a third free casualty', R.currentMorale(lsq) === 4,
  '3 lost, Morale still 4');
lsq.models = 6;
ok('...and the fourth still bites', R.currentMorale(lsq) === 3);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
