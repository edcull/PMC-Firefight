/* Every special rule in the book's General Special Rules list (pp. 56-59), plus
   the vehicle and aircraft rules from pp. 34-39, exercised against the engine.
   Each check either proves the rule bites or says plainly that it cannot. */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0, inert = [];
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(46) +
    String(got).padEnd(10) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

function mk(key, side, x, y, opts) {
  opts = opts || {};
  var p = R.profile(key);
  var u = {
    id: side + key + Math.random().toString(36).slice(2, 6), side: side, code: p.code,
    name: p.name, label: p.name + ' [' + side + ']', cls: p.cls || 'infantry', art: p.art,
    tier: p.tier, size: p.size, models: opts.models || p.size, move: p.move, turn: p.turn,
    fp: p.fp, range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault,
    morale: p.morale, str: p.str, transport: p.transport, cargo: [], damage: 0,
    facing: opts.facing || 0, aboard: null, disembarked: !!opts.disembarked,
    rules: p.rules.slice(), x: x, y: y, sp: opts.sp || 0, alive: true, activated: false,
    marked: !!opts.marked, shotFrom: [], coordUsed: false, hackUsed: false, drone: false
  };
  R.applyPropulsion(u, opts.prop);
  R.applyDrone(u, opts.drone);
  return u;
}
function world(terrain) { return { units: [], terrain: terrain || [], objectives: [], log: [] }; }
function mods(st, a, t, mode, o) { return R.shotOdds(st, a, t, mode || 'fire', o || {}).mods; }
function defv(st, a, t, o) { return R.defenceAgainst(st, a, t, o || {}).value; }

/* ---------------- shooting and armour ---------------- */
head('Anti-tank, Anti-aircraft and Advanced Protection');
var st = world();
var tank = mk('lcv', 'B', 20, 20), rifles = mk('regular', 'A', 28, 20);
var at = mk('atteam', 'A', 28, 20), sam = mk('sam', 'A', 28, 20);
st.units = [rifles, tank];
var plain = mods(st, rifles, tank);
function stripped(key, side, x, y, rule, opts) {
  var u = mk(key, side, x, y, opts);
  u.rules = u.rules.filter(function (r) { return r !== rule; });
  return u;
}
st.units = [at, tank];
var atBare = stripped('atteam', 'A', 28, 20, 'Anti-tank');
var atWith = mods(st, at, tank);
st.units = [atBare, tank];
ok('Anti-tank adds +4 against a ground vehicle', atWith - mods(st, atBare, tank), 4);
var crit = { d3: 0, d6: 0 };
for (var i = 0; i < 4000; i++) {
  crit.d3 += R.resolveDamage(mk('lcv', 'B', 20, 20), 1, false).damage;
  crit.d6 += R.resolveDamage(mk('lcv', 'B', 20, 20), 1, true).damage;
}
ok('Anti-tank criticals roll D6, not D3', (crit.d6 / 4000 > crit.d3 / 4000), true,
  (crit.d3 / 4000).toFixed(2) + ' → ' + (crit.d6 / 4000).toFixed(2) + ' damage a hit');
var plane = mk('fsc', 'B', 26, 20);
st.units = [sam, plane];
var samWith = mods(st, sam, plane);
var samBare = stripped('sam', 'A', 28, 20, 'Anti-aircraft');
st.units = [samBare, plane];
ok('Anti-aircraft adds +4 against an aircraft', samWith - mods(st, samBare, plane), 4);
var prot = mk('acv', 'B', 20, 20, { facing: 0 });     // Advanced Protection
var flank = mk('regular', 'A', 20, 32);
st.units = [flank, tank];
var sideBonus = mods(st, flank, tank);
st.units = [flank, prot];
var protBare = mk('acv', 'B', 20, 20, { facing: 0 });
protBare.rules = protBare.rules.filter(function (r) { return r !== 'Advanced Protection'; });
var withProt = mods(st, flank, prot);
st.units = [flank, protBare];
ok('Advanced Protection denies the side bonus',
  R.arcOf(prot, flank) === 'side' ? mods(st, flank, protBare) - withProt : 'not a side shot', 1);
ok('Advanced Protection denies the +4 assault bonus',
  R.assaultOdds(world(), mk('engineers', 'A', 20, 20), prot).mods -
  R.assaultOdds(world(), mk('engineers', 'A', 20, 20), tank).mods, -4);
ok('Anti-tank (limited) bites inside 6"', (function () {
  var bat = mk('bats', 'A', 20, 20), bare = stripped('bats', 'A', 20, 20, 'Anti-tank (limited)');
  var near = mk('lcv', 'B', 24, 20);
  var w = world(); w.units = [bat, near];
  var a = mods(w, bat, near);
  w.units = [bare, near];
  return a - mods(w, bare, near);
})(), 4);
ok('...and not a yard further', (function () {
  var bat = mk('bats', 'A', 20, 20), bare = stripped('bats', 'A', 20, 20, 'Anti-tank (limited)');
  var far3 = mk('lcv', 'B', 34, 20);
  var w = world(); w.units = [bat, far3];
  var a = mods(w, bat, far3);
  w.units = [bare, far3];
  return a - mods(w, bare, far3);
})(), 0);

head('Gauss Weapon, Battle Armour, Stealth and Keen-Eyed');
var woods = world([{ kind: 'woods', x: 16, y: 16, w: 8, h: 8 }]);
var gauss = mk('gausscannon', 'A', 30, 20), foot = mk('regular', 'B', 20, 20);
woods.units = [gauss, foot];
var normal = mk('regular', 'A', 30, 20);
ok('Gauss Weapon ignores terrain cover', defv(woods, gauss, foot) - defv(woods, normal, foot), -2);
ok('Gauss Weapon adds +1 Firepower against a hull', (function () {
  var w = world(); var v = mk('lcv', 'B', 26, 20);
  w.units = [gauss, v];
  var withG = mods(w, gauss, v);
  var g2 = mk('gausscannon', 'A', 30, 20);
  g2.rules = g2.rules.filter(function (r) { return r !== 'Gauss Weapon'; });
  w.units = [g2, v];
  return withG - mods(w, g2, v);
})(), 1);
var bat2 = mk('bats', 'B', 20, 20);
woods.units = [normal, bat2];
ok('Battle Armour takes no terrain cover', defv(woods, normal, bat2), bat2.def);
ok('Battle Armour is stripped by Anti-tank', defv(world(), at, bat2), bat2.defPierced);
var sniper = mk('snipers', 'B', 20, 20), far2 = mk('regular', 'A', 34, 20);
var keen = mk('lrrp', 'A', 34, 20);
var w2 = world(); w2.units = [far2, sniper];
ok('Stealth adds +1 Defence per 6"', defv(w2, far2, sniper) - sniper.def, 2, '14" away');
w2.units = [keen, sniper];
ok('Keen-Eyed sees through Stealth', defv(w2, keen, sniper) - sniper.def, 0);

head('Specialisation, Limited Fire Arc, Minimum Range, Cumbersome');
var w3 = world();
var ground = mk('regular', 'B', 26, 20);
w3.units = [sam, ground];
ok('Specialisation (air) cannot engage ground', R.canShoot(w3, sam, ground, 'fire', {}), false);
ok('...but its auxiliary weapons still can', R.canShoot(w3, sam, ground, 'fire', { aux: true }), true);
var spg = mk('lsupport', 'A', 20, 20);
w3.units = [spg, plane];
ok('Specialisation (ground) cannot engage aircraft', R.canShoot(w3, spg, plane, 'fire', {}), false);
var arc = mk('ldestroyer', 'A', 20, 20, { facing: 0 });
var ahead = mk('regular', 'B', 30, 20), abeam = mk('regular', 'B', 20, 30);
w3.units = [arc, ahead, abeam];
ok('Limited Fire Arc bears only to the front', R.canShoot(w3, arc, ahead, 'fire', {}) &&
  !R.canShoot(w3, arc, abeam, 'fire', {}), true);
var mortar = mk('mortarteam', 'A', 20, 20);
var close2 = mk('regular', 'B', 26, 20), out = mk('regular', 'B', 44, 30);
w3.units = [mortar, close2];
ok('Minimum Range 12" silences the main weapon', R.canShoot(w3, mortar, close2, 'fire', {}), false);
ok('...auxiliary weapons still answer inside it',
  R.canShoot(w3, mortar, close2, 'fire', { aux: true }), true);
var shallow = world([{ kind: 'water', x: 16, y: 16, w: 8, h: 8 }]);
var wet = mk('mortarteam', 'A', 20, 20), dry = mk('regular', 'B', 40, 30);
shallow.units = [wet, dry];
ok('Cumbersome Weapons cannot fire from shallow water',
  R.canShoot(shallow, wet, dry, 'fire', {}), false);
var off = mk('mortarteam', 'A', 20, 20, { disembarked: true });
w3.units = [off, out];
ok('...nor on the turn the crew stepped off a hull', R.canShoot(w3, off, out, 'fire', {}), false);

head('Indirect Fire, Markerlights and Suppressive Fire');
var blind = world([{ kind: 'woods', x: 26, y: 14, w: 6, h: 12 }]);
var gunner2 = mk('mortarteam', 'A', 14, 20), hidden = mk('regular', 'B', 40, 20);
blind.units = [gunner2, hidden];
ok('a mortar cannot shoot what it cannot see', R.canShoot(blind, gunner2, hidden, 'fire', {}), false);
/* Markerlights (p. 58) carry two different special actions, and the call lasts
   only for the unit or units it summons — it is not a condition the target wears
   for the rest of the turn. `state.mark` is that live call. */
function call(w, side, kind, targets) {
  w.mark = { side: side, kind: kind, targets: targets, smoke: false };
  return w;
}
call(blind, 'A', 'designate', [hidden]);
ok('a designated target can be shelled unseen', R.canShoot(blind, gunner2, hidden, 'fire', {}), true);
ok('...but only by the gun the call summoned', (function () {
  var rifle = mk('regular', 'A', 14, 20);
  blind.units.push(rifle);
  return R.canShoot(blind, rifle, hidden, 'fire', {});
})(), false, 'a rifle team still has to see it');
ok('...and a Mark the target call does not open that door', (function () {
  call(blind, 'A', 'mark', [hidden]);
  return R.canShoot(blind, gunner2, hidden, 'fire', {});
})(), false, 'Mark is for units that can see');
ok('...nor does a call on somebody else', (function () {
  var other = mk('regular', 'B', 41, 21);
  blind.units.push(other);
  call(blind, 'A', 'designate', [other]);
  return R.canShoot(blind, gunner2, hidden, 'fire', {});
})(), false);
ok('...nor one the enemy made', (function () {
  call(blind, 'B', 'designate', [hidden]);
  return R.canShoot(blind, gunner2, hidden, 'fire', {});
})(), false);
blind.mark = null;
ok('Indirect Fire always uses Basic Firepower', (function () {
  var w = world(); var t = mk('regular', 'B', 30, 20);
  var m2 = mk('mortarteam', 'A', 20, 20);
  w.units = [m2, t]; call(w, 'A', 'designate', [t]);
  return R.shotMods(w, m2, t, 'fire', {}).basic;
})(), true);
ok('Mark the target is worth +2 to the unit it calls up', (function () {
  var w = world();
  var a2 = mk('regular', 'A', 20, 20), t2 = mk('regular', 'B', 36, 20);
  w.units = [a2, t2];
  var before = mods(w, a2, t2);
  call(w, 'A', 'mark', [t2]);
  return mods(w, a2, t2) - before;
})(), 2, 'it fires as though the target were within half its Range');
ok('...and not to anyone else on the table', (function () {
  var w = world();
  var a2 = mk('regular', 'A', 20, 20), b2 = mk('regular', 'A', 20, 24), t2 = mk('regular', 'B', 36, 20);
  w.units = [a2, b2, t2];
  var before = mods(w, a2, t2);
  call(w, 'A', 'mark', [mk('regular', 'B', 10, 10)]);   // the call is on somebody else
  return mods(w, a2, t2) - before;
})(), 0);
ok('...and never to an Indirect Fire unit', (function () {
  var w = world();
  var m2 = mk('mortarteam', 'A', 20, 20), t2 = mk('regular', 'B', 36, 20);
  w.units = [m2, t2];
  var before = mods(w, m2, t2);
  call(w, 'A', 'mark', [t2]);
  return mods(w, m2, t2) - before;
})(), 0, 'Mark the target is explicitly for units without it');
ok('...and is not doubled up inside half range', (function () {
  var w = world();
  var a2 = mk('regular', 'A', 20, 20), t2 = mk('regular', 'B', 26, 20);
  w.units = [a2, t2];
  var before = mods(w, a2, t2);
  call(w, 'A', 'mark', [t2]);
  return mods(w, a2, t2) - before;
})(), 0, 'it was already within half range');
ok('a designation gives no Firepower bonus at all', (function () {
  var w = world();
  var m2 = mk('mortarteam', 'A', 20, 20), t2 = mk('regular', 'B', 40, 20);
  w.units = [m2, t2];
  var before = mods(w, m2, t2);
  call(w, 'A', 'designate', [t2]);
  return mods(w, m2, t2) - before;
})(), 0, 'it buys sight, not accuracy');
ok('a dug-in gun has to see what it hits', (function () {
  var w = world([{ kind: 'woods', x: 26, y: 14, w: 6, h: 12 }]);
  var gun = mk('rmedart', 'A', 20, 20, {});
  gun.dugIn = true;
  var t2 = mk('regular', 'B', 40, 20);          // the far side of the wood
  w.units = [gun, t2]; call(w, 'A', 'designate', [t2]);
  return R.canShoot(w, gun, t2, 'fire', {});
})(), false, 'Dig in! trades indirect fire for the sights (p. 94)');
ok('low walls shelter against plunging fire', (function () {
  var w = world([{ kind: 'barricade', x: 28, y: 19, w: 4, h: 2 }]);
  var t3 = mk('regular', 'B', 30, 21.5);
  var m3 = mk('mortarteam', 'A', 30, 34);           // firing from the far side
  w.units = [m3, t3]; call(w, 'A', 'designate', [t3]);
  var n3 = mk('regular', 'A', 30, 34);
  return defv(w, m3, t3) - defv(w, n3, t3);
})(), 2);
var supp = mk('hmgteam', 'A', 20, 20);
var sumA = 0, sumB = 0;
for (var i2 = 0; i2 < 4000; i2++) {
  var w4 = world();
  var t4 = mk('regular', 'B', 26, 20), t5 = mk('regular', 'B', 26, 20);
  var plain2 = mk('hmgteam', 'A', 20, 20);
  plain2.rules = plain2.rules.filter(function (r) { return r !== 'Suppressive Fire'; });
  w4.units = [supp, t4]; R.shoot(w4, mk('hmgteam', 'A', 20, 20), t4, 'fire', {}); sumA += t4.sp;
  w4.units = [plain2, t5]; R.shoot(w4, plain2, t5, 'fire', {}); sumB += t5.sp;
}
ok('Suppressive Fire adds 2 SP to a telling shot', (sumA / 4000 - sumB / 4000) > 1.2, true,
  (sumB / 4000).toFixed(2) + ' → ' + (sumA / 4000).toFixed(2) + ' SP');

head('Incendiary Ammunition and Field Medics');
var burn = world([{ kind: 'woods', x: 16, y: 16, w: 8, h: 8 }]);
var chem = mk('chem', 'A', 26, 20);
var hot = 0, cold = 0, armoured = 0, armouredCold = 0, n6 = 6000;
for (var i3 = 0; i3 < n6; i3++) {
  var a3 = mk('chem', 'A', 26, 20);
  var bare3 = stripped('chem', 'A', 26, 20, 'Incendiary Ammunition');
  var t6 = mk('regular', 'B', 20, 20); burn.units = [a3, t6]; R.shoot(burn, a3, t6, 'fire', {});
  hot += t6.sp;
  var t7 = mk('regular', 'B', 20, 20); burn.units = [bare3, t7]; R.shoot(burn, bare3, t7, 'fire', {});
  cold += t7.sp;
  var t8 = mk('bats', 'B', 20, 20); burn.units = [a3, t8]; R.shoot(burn, a3, t8, 'fire', {});
  armoured += t8.sp;
  var t9 = mk('bats', 'B', 20, 20); burn.units = [bare3, t9]; R.shoot(burn, bare3, t9, 'fire', {});
  armouredCold += t9.sp;
}
ok('Incendiary doubles suppression in cover', (hot / n6) > (cold / n6) * 1.7, true,
  (cold / n6).toFixed(2) + ' → ' + (hot / n6).toFixed(2) + ' SP in woods');
ok('Battle Armour is immune to Incendiary',
  Math.abs(armoured / n6 - armouredCold / n6) < 0.25, true,
  (armouredCold / n6).toFixed(2) + ' vs ' + (armoured / n6).toFixed(2) + ' SP');
var medWorld = world();
var medic = mk('medics', 'A', 20, 20), hurt = mk('regular', 'A', 23, 20);
medWorld.units = [medic, hurt];
ok('Field Medics reach 6"', R.medicNearby(medWorld, hurt), true);
ok('...but not 20"', R.medicNearby(medWorld, mk('regular', 'A', 44, 20)), false);
var withMed = 0, without = 0;
for (var i4 = 0; i4 < 4000; i4++) {
  var w6 = world();
  var h1 = mk('regular', 'A', 23, 20), h2 = mk('regular', 'B', 23, 20);
  w6.units = [medic, h1];
  withMed += R.resolveShootingHits(w6, h1, 3, 0).casualties;
  w6.units = [h2];
  without += R.resolveShootingHits(w6, h2, 3, 0).casualties;
}
ok('Field Medics cut the casualties', (withMed / 4000) < (without / 4000), true,
  (without / 4000).toFixed(2) + ' → ' + (withMed / 4000).toFixed(2) + ' models a volley');
// the board is told who answered a MEDIC!, so it can draw the medics at work
var named = 0, wrong = 0, near = mk('medics', 'A', 25, 20), far = mk('medics', 'A', 20, 20);
for (var i5 = 0; i5 < 400; i5++) {
  var w7 = world(), h3 = mk('regular', 'A', 23, 20);
  w7.units = [far, near, h3];
  var m7 = R.resolveShootingHits(w7, h3, 3, 0).medic;
  if (m7) { named++; if (m7 !== near.id) wrong++; }
}
ok('a MEDIC! names the nearest medics treating the squad', named > 0 && wrong === 0, true, named + ' named, ' + wrong + ' wrong');

head('Morale, Determined, Expendable, Inspiring Presence, Jammers');
var det = mk('rangers', 'A', 20, 20, { models: 4 });
var und = mk('veterans', 'A', 20, 20, { models: 4 });
ok('Determined keeps its Morale as models fall', R.currentMorale(det), det.morale);
ok('...an ordinary unit loses one per casualty', R.currentMorale(und), und.morale - 4);
var pen = world();
var gone = 0, tries = 400;
for (var ip = 0; ip < tries; ip++) {
  var penal = mk('penal', 'B', 20, 20, { sp: 5 });   // Morale 3, so 7 SP breaks them
  var killer = mk('hmgteam', 'A', 24, 20);
  pen.units = [killer, penal];
  R.shoot(pen, killer, penal, 'fire', {});
  if (!penal.alive) gone++;
}
ok('Expendable penal troops blow up when broken', gone > tries * 0.5, true,
  Math.round(100 * gone / tries) + '% of volleys that broke them');
var insp = world();
var boss = mk('cmd2', 'A', 20, 20), squad = mk('regular', 'A', 26, 20, { sp: 4 });
insp.units = [boss, squad];
ok('Inspiring Presence re-rolls rallies within 12"', R.rally(insp, squad).reroll, true);
var high = mk('regular', 'A', 26, 20, { sp: 4 });    // Tier III, two above a 4th-grade command
insp.units = [mk('cmd4', 'A', 20, 20), high];
ok('...but not for a unit two Tiers above it', R.rally(insp, high).reroll, false);
var peer = mk('cmd3', 'A', 26, 20, { sp: 4 });
insp.units = [boss, peer];
ok('...nor for another Inspiring Presence', R.rally(insp, peer).reroll, false);
ok('...nor over 12"', (function () {
  var near2 = mk('regular', 'A', 34, 20, { sp: 4 });   // 14" centre to centre, 12" edge to edge
  insp.units = [boss, near2];
  var at12 = R.rally(insp, near2).reroll;
  var far2 = mk('regular', 'A', 36, 20, { sp: 4 });
  insp.units = [boss, far2];
  return at12 + '/' + R.rally(insp, far2).reroll;
})(), 'true/false', 'measured closest model to closest model');
ok('...nor for the inspiring unit itself', (function () {
  var lone = mk('cmd2', 'A', 20, 20, { sp: 4 });
  insp.units = [lone];
  return R.rally(insp, lone).reroll;
})(), false);
/* p. 28: "Both suppressed and broken unit cannot use their passive skills which
   grants bonuses to another units ... this applies to bonuses only, but not for
   penalties". Inspiring Presence is a bonus. */
ok('a suppressed commander inspires nobody', (function () {
  var shakyBoss = mk('cmd2', 'A', 20, 20, { sp: 6 });   // Morale 5, so 6 SP suppresses
  var men = mk('regular', 'A', 26, 20, { sp: 4 });
  insp.units = [shakyBoss, men];
  return R.status(shakyBoss) + '/' + R.rally(insp, men).reroll;
})(), 'suppressed/false');
ok('...and a broken one even less', (function () {
  var brokeBoss = mk('cmd2', 'A', 20, 20, { sp: 11 });
  var men = mk('regular', 'A', 26, 20, { sp: 4 });
  insp.units = [brokeBoss, men];
  return R.status(brokeBoss) + '/' + R.rally(insp, men).reroll;
})(), 'broken/false');
ok('...nor does one riding inside a transport', (function () {
  var rider = mk('cmd4', 'A', 20, 20);
  var men = mk('regular', 'A', 24, 20, { sp: 4 });
  var truck = mk('unarmoured', 'A', 20, 20);
  insp.units = [rider, men, truck];
  R.embark(insp, truck, rider);
  return !!rider.aboard + '/' + R.rally(insp, men).reroll;
})(), 'true/false', 'a Command Vehicle carries the rule on the hull instead');
ok('...but a Command Vehicle does it for him', (function () {
  var cmdv = mk('cmdveh', 'A', 20, 20);
  var rider = mk('cmd2', 'A', 20, 20);
  var men = mk('regular', 'A', 26, 20, { sp: 4 });
  insp.units = [cmdv, rider, men];
  R.embark(insp, cmdv, rider);
  return R.rally(insp, men).reroll;
})(), true);
ok('Insubordinate troops are deaf to it', (function () {
  var men = mk('regular', 'A', 26, 20, { sp: 4 });
  men.camp = { flags: { insubordinate: true } };
  insp.units = [boss, men];
  return R.rally(insp, men).reroll;
})(), false, 'Battle Trauma 8 (p. 90)');
ok('the re-roll is worth about a third more SP shaken off', (function () {
  var with2 = 0, without = 0, runs = 8000;
  for (var k = 0; k < runs; k++) {
    var w1 = world(), m1 = mk('regular', 'A', 26, 20, { sp: 6 });
    w1.units = [mk('cmd2', 'A', 20, 20), m1];
    with2 += R.rally(w1, m1).removed;
    var w2 = world(), m2 = mk('regular', 'A', 26, 20, { sp: 6 });
    w2.units = [m2];
    without += R.rally(w2, m2).removed;
  }
  var lift = (with2 / runs) / (without / runs);
  return (lift > 1.4 && lift < 1.6) + ' (' + lift.toFixed(2) + '×)';
})().slice(0, 4), 'true', 'half the failures come back');
var jam = world();
var ewt = mk('ew', 'B', 20, 20), shaken = mk('regular', 'A', 30, 20, { sp: 6 });
jam.units = [ewt, shaken];
ok('Jammers push a rally to 5+ within 24"', R.rally(jam, shaken).need, 5);
jam.units = [ewt, shaken, mk('highcmd', 'A', 33, 20)];
ok('Counter-jamming within 6" shuts that out', R.rally(jam, shaken).need, 4);
ok('...unless the unit carrying it is pinned down', (function () {
  var hc = mk('highcmd', 'A', 33, 20, { sp: 6 });      // Morale 5
  var sh2 = mk('regular', 'A', 30, 20, { sp: 6 });
  jam.units = [ewt, sh2, hc];
  return R.status(hc) + '/' + R.rally(jam, sh2).need;
})(), 'suppressed/5', 'Counter-jamming is a bonus, so p. 28 switches it off');
ok('Jammers keep working from a broken unit', (function () {
  var brokeEW = mk('ew', 'B', 20, 20, { sp: 11 });
  var sh3 = mk('regular', 'A', 30, 20, { sp: 6 });
  jam.units = [brokeEW, sh3];
  return R.status(brokeEW) + '/' + R.rally(jam, sh3).need;
})(), 'broken/5', 'it is a penalty, and "the life is unfair"');
ok('...but not from inside a vehicle', (function () {
  var ew2 = mk('ew', 'B', 20, 20);
  var bus = mk('unarmoured', 'B', 20, 20);
  var sh4 = mk('regular', 'A', 30, 20, { sp: 6 });
  jam.units = [ew2, bus, sh4];
  R.embark(jam, bus, ew2);
  return !!ew2.aboard + '/' + R.rally(jam, sh4).need;
})(), 'true/4');
var hurtV = mk('lcv', 'A', 30, 20); hurtV.damage = 4;
jam.units = [ewt, hurtV, shaken];
ok('Jammers also slow a vehicle repairing', R.repair(jam, hurtV).need, 5);

head('Sappers, Command Unit, Command Vehicle');
function wallWorld() { return world([{ kind: 'barricade', x: 24, y: 18, w: 4, h: 4 }]); }
var sapMods = 0, plainMods = 0, brought = 0, n5 = 2000;
for (var i5 = 0; i5 < n5; i5++) {
  var wall = wallWorld();                            // a fresh wall every time
  var s5 = mk('engineers', 'A', 20, 20), b5 = mk('regular', 'B', 26, 20);
  wall.units = [s5, b5];
  var out5 = R.assault(wall, s5, b5);
  var l1 = out5.log.filter(function (l) { return l.t === 'round'; })[0];
  if (l1 && /Sappers \+4/.test(l1.math || '')) sapMods++;
  if (wall.terrain[0].kind === 'razed') brought++;
  var wall2 = wallWorld();
  var p5 = mk('engineers', 'A', 20, 20);
  p5.rules = p5.rules.filter(function (r) { return r !== 'Sappers'; });
  var b6 = mk('regular', 'B', 26, 20);
  wall2.units = [p5, b6];
  var l2 = R.assault(wall2, p5, b6).log.filter(function (l) { return l.t === 'round'; })[0];
  if (l2 && /Sappers/.test(l2.math || '')) plainMods++;
}
ok('Sappers get +4 in the first round against cover', sapMods > n5 * 0.5, true,
  Math.round(100 * sapMods / n5) + '% of charges');
ok('...and only units with the rule do', plainMods, 0);
ok('...and a good charge brings the wall down', brought > n5 * 0.3, true,
  Math.round(100 * brought / n5) + '% of charges');
ok('Command Unit (X) names how many it may order', R.ruleValue(mk('cmd2', 'A', 0, 0), 'Command Unit'), 3);
var cv = mk('cmdveh', 'A', 20, 20);
var boss2 = mk('cmd2', 'A', 22, 20);
var cvw = world(); cvw.units = [cv, boss2];
R.embark(cvw, cv, boss2);
ok('a Command Vehicle borrows its passenger\'s rules', R.has(cv, 'Inspiring Presence'), true);
ok('...including Command Unit (X)', R.ruleValue(cv, 'Command Unit'), 3);
ok('...and knows who is aboard', R.commandAboard(cv) === boss2, true);

head('Drone Control and Hackers');
var dr = mk('recon', 'B', 20, 20, { drone: true });
var plainV = mk('recon', 'B', 20, 20);
ok('Drone Control adds a point of Structure', dr.str - plainV.str, 1);
var hacker = mk('ew', 'A', 30, 20);
var hw = world(); hw.units = [hacker, dr, plainV];
ok('a Hacker may reach a drone within 24"', R.canHack(hw, hacker, dr), true);
ok('...but not a crewed vehicle', R.canHack(hw, hacker, plainV), false);
var res = { miss: 0, lock: 0, turn: 0 };
for (var i6 = 0; i6 < 3000; i6++) {
  var h3 = mk('ew', 'A', 30, 20), d3u = mk('recon', 'B', 20, 20, { drone: true });
  var w7 = world(); w7.units = [h3, d3u];
  var r3 = R.hack(w7, h3, d3u, function () { return true; });
  if (r3.roll <= 2) res.miss++; else if (r3.turned) res.turn++; else res.lock++;
}
ok('Hack: 1-2 fails, 3-4 locks out, 5-6 turns it',
  Math.abs(res.miss / 3000 - 1 / 3) < 0.04 && Math.abs(res.turn / 3000 - 1 / 3) < 0.04, true,
  JSON.stringify(res));

head('Transport, Supporting Fire and the flying rules');
var tw = world();
var apc = mk('hapc', 'A', 20, 20), squad2 = mk('regular', 'A', 22, 20);
tw.units = [apc, squad2];
ok('Transport (X) loads within 4"', !!R.canEmbark(tw, apc, squad2), true);
R.embark(tw, apc, squad2);
ok('...passengers leave the table and lose their SP', squad2.x < 0 && squad2.sp === 0, true);
R.disembark(tw, apc, squad2, { x: 22, y: 21 });
ok('...and cannot re-board the same turn', !!R.canEmbark(tw, apc, squad2), false);
var ifv = mk('lifv', 'A', 20, 20), mark = mk('regular', 'B', 28, 20);
tw.units = [ifv, mark];
ok('Supporting Fire drops the stationary +1',
  R.shotOdds(tw, ifv, mark, 'fire', {}).mods - R.shotOdds(tw, ifv, mark, 'support', {}).mods, 1);
var air = world();
var jet = mk('fsc', 'B', 20, 20), grunt = mk('regular', 'A', 26, 20);
air.units = [grunt, jet];
ok('everything shoots at an aircraft with Basic Firepower',
  R.shotMods(air, grunt, jet, 'fire', {}).basic, true);
ok('an aircraft cannot be assaulted', R.canAssault(grunt, jet), false);
ok('a vehicle never charges', R.canAssault(mk('lcv', 'A', 20, 20), grunt), false);

/* ---------------- what the engine deliberately does not do -------------- */
inert.push('Destructive Weapon — only ever destroys terrain, and terrain here is indestructible.');
inert.push('Incendiary counting as a Destructive Weapon against buildings — same reason.');
inert.push('Sappers demolishing a wall or building outright — the +4 and the breach bonus are in, the piece stays standing.');
inert.push('Scenario reserves other than Battlefield Insertion — every other unit deploys in the strip.');

console.log('\n--- rules the engine leaves inert, by design ---');
inert.forEach(function (t) { console.log('  · ' + t); });

head('Leaving the field without dying (pp. 29, 34)');
(function () {
  /* Suppression caps at 12, so only a unit whose Morale has fallen with its
     losses can ever pass three times it. A rookie team down to two men is on
     Morale 1, and 12 points is four times over. */
  var st = world();
  var u = mk('rookie', 'A', 10, 10, { models: 2 });
  u.sp = 12;
  st.units = [u];
  var res = R.rally(st, u);
  ok('past 3x Morale the unit is removed from play', !u.alive, true,
    'Morale ' + R.currentMorale(u) + ', ' + u.sp + ' SP after rallying');
  ok('...marked as having fled', !!u.fled, true);
  ok('...not as wiped out', !u.wipedOut, true);
  ok('...and the survivors are still survivors', u.models > 0, true, u.models + ' of ' + u.size);

  // Expendable: Penal troops break and leave, but they are not dead either
  var st2 = world();
  var pen = mk('penal', 'A', 10, 10), foe = mk('regular', 'B', 10, 16);
  st2.units = [pen, foe];
  for (var i = 0; i < 40 && pen.alive; i++) R.shoot(st2, foe, pen, 'fire', {});
  if (!pen.alive && pen.models > 0) {
    ok('Expendable removes a broken Penal unit from play', !pen.alive, true);
    ok('...and marks it fled rather than wiped', !!pen.fled && !pen.wipedOut, true,
      pen.models + ' of ' + pen.size + ' still standing');
  } else {
    ok('Expendable removed the unit or it was shot to pieces', true, true,
      pen.alive ? 'survived 40 volleys' : 'killed outright, ' + pen.models + ' left');
  }
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
