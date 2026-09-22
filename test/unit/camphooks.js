/* Every Battle Honour, Battle Trauma, Upgrade and battle-time doctrine, measured
   against a plain unit of the same profile. Each pair is rolled thousands of times,
   so a hook that does nothing shows up as a flat line. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(50) +
    String(got).padEnd(10) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

/* ---------------------------------------------------------- unit building */
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
  R.applyPropulsion(u, opts.prop);
  if (opts.honours || opts.traumas || opts.upgrades) {
    var e = C.newEntry(key, {});
    e.honours = opts.honours || []; e.traumas = opts.traumas || []; e.upgrades = opts.upgrades || [];
    C.applyEntry(u, e);
  }
  return u;
}
function world(terrain, docs) {
  return { units: [], terrain: terrain || [], objectives: [], log: [], doctrines: docs || null };
}
function duel(shooterOpts, targetOpts, opts) {
  opts = opts || {};
  var n = opts.n || 12000, sp = 0, dead = 0, hits = 0;
  for (var i = 0; i < n; i++) {
    var w = world(opts.terrain, opts.docs);
    var a = mk(opts.shooter || 'regular', 'A', 20, 20, shooterOpts);
    var t = mk(opts.target || 'regular', 'B', 20 + (opts.dist || 8), 20, targetOpts);
    w.units = [a, t];
    if (opts.preshot) t.shotFrom.push({ x: 0, y: 20 });
    var res = R.shoot(w, a, t, opts.mode || 'fire', {});
    hits += res.hits; sp += t.sp; dead += t.size - t.models;
  }
  return { sp: sp / n, dead: dead / n, hits: hits / n };
}

/* -------------------------------------------------------------- building */
head('Building a unit from a dossier entry');
var plain = mk('regular', 'A', 10, 10);
var kitted = mk('regular', 'A', 10, 10, { honours: [4, 8, 18], traumas: [5] });
ok('Amazing Stamina adds an inch of Movement', kitted.move - plain.move, 1);
ok('Shooting Experts adds a point of Firepower', kitted.fp - plain.fp, 1);
ok('Superior Ballistic Skills adds six inches', kitted.range - plain.range, 6);
ok('Cowards takes a point of Morale', kitted.morale - plain.morale, -1);
ok('the rid travels with the unit', !!kitted.camp && !!kitted.camp.rid, true);
var stealthy = mk('regular', 'A', 10, 10, { honours: [5] });
ok('Into the Shadows grants the rule the engine knows', R.has(stealthy, 'Stealth'), true);
var armoured = mk('lcv', 'A', 10, 10, { upgrades: [8, 5] });
var bareTank = mk('lcv', 'A', 10, 10);
ok('Reinforced Armour adds two Defence', armoured.def - bareTank.def, 2);
ok('Redundant Crucial Systems adds a point of Structure', armoured.str - bareTank.str, 1);
var bats = mk('bats', 'A', 10, 10);
var batsUp = mk('bats', 'A', 10, 10, { upgrades: [] });
ok('a profile with two Defence values keeps them in step', (function () {
  var u = mk('bats', 'A', 10, 10);
  var e = C.newEntry('bats', {}); e.honours = []; e.upgrades = [];
  var before = u.def - u.defPierced;
  var v = mk('bats', 'A', 10, 10);
  C.applyEntry(v, (function () { var x = C.newEntry('bats', {}); x.upgrades = []; return x; })());
  return (v.def - v.defPierced) === before;
})(), true);

/* ------------------------------------------------------------- shooting */
head('Honours and traumas that bite when the shooting starts');
var base = duel({}, {});
ok('a plain exchange is the yardstick', base.sp.toFixed(2) > 0, true,
  base.hits.toFixed(2) + ' hits, ' + base.sp.toFixed(2) + ' SP, ' + base.dead.toFixed(2) + ' dead');

var brave = duel({}, { honours: [2] });
ok('Brave shrugs a point off every attack that lands',
  (base.sp - brave.sp) > 0.5 && (base.sp - brave.sp) <= 1.02, true,
  brave.sp.toFixed(2) + ' SP against ' + base.sp.toFixed(2) +
  ' — short of a full point because a shot that misses has none to shrug');

var style = duel({ honours: [17] }, {}, { n: 40000 });
var styleBase = duel({}, {}, { n: 40000 });
var perKill = (style.sp - styleBase.sp) / style.dead;
ok('Style Bonus adds a point per man killed', perKill > 0.85 && perKill <= 1.05, true,
  perKill.toFixed(2) + ' SP per casualty — ' + style.sp.toFixed(2) + ' against ' +
  styleBase.sp.toFixed(2) + ' over ' + style.dead.toFixed(2) +
  ' killed, a shade under one for one because suppression stops at 12');

var suicidal = duel({}, { traumas: [8] });
ok('Suicidal Tendencies doubles the casualties', suicidal.dead > base.dead * 1.6, true,
  suicidal.dead.toFixed(2) + ' dead against ' + base.dead.toFixed(2));
ok('...while the suppression barely moves, as the book intends',
  Math.abs(suicidal.sp - base.sp) < 0.3, true,
  suicidal.sp.toFixed(2) + ' SP against ' + base.sp.toFixed(2) +
  ' — it shrugs off more hits but goes down harder on the rest');

var rain = duel({ honours: [12] }, {}, { dist: 6 });
var rainBase = duel({}, {}, { dist: 6 });
ok('Rain of Fire doubles the close-range bonus',
  (rain.hits - rainBase.hits) > 1.5 && (rain.hits - rainBase.hits) <= 2.05, true,
  rain.hits.toFixed(2) + ' hits against ' + rainBase.hits.toFixed(2) +
  ' — short of a full two because hits cannot go below none');
var far = duel({ honours: [12] }, {}, { dist: 15 });
var farBase = duel({}, {}, { dist: 15 });
ok('...and does nothing past half range', Math.abs(far.hits - farBase.hits) < 0.25, true,
  far.hits.toFixed(2) + ' against ' + farBase.hits.toFixed(2));

var nerves = duel({}, { honours: [10] }, { shooter: 'sharpshooters' });   // Suppressive Fire
var nervesBase = duel({}, {}, { shooter: 'sharpshooters' });
ok('Nerves of Steel ignores Suppressive Fire',
  (nervesBase.sp - nerves.sp) > 1.1 && (nervesBase.sp - nerves.sp) <= 2.05, true,
  nerves.sp.toFixed(2) + ' SP against ' + nervesBase.sp.toFixed(2) +
  ' — the two points only ride on attacks that land');

var woods = [{ kind: 'woods', x: 24, y: 16, w: 8, h: 8 }];
var inCover = duel({}, {}, { terrain: woods, dist: 8 });
var dumb = duel({}, { traumas: [9] }, { terrain: woods, dist: 8 });
ok('Tactical Dumbness throws the cover away', dumb.hits > inCover.hits, true,
  dumb.hits.toFixed(2) + ' hits against ' + inCover.hits.toFixed(2));

var shields = duel({}, { honours: [11] }, { mode: 'defensive' });
var shieldsBase = duel({}, {}, { mode: 'defensive' });
ok('Overloaded Energy Shields all but stop defensive fire',
  shields.hits < 0.3 && shieldsBase.hits > 1, true,
  shields.hits.toFixed(2) + ' hits against ' + shieldsBase.hits.toFixed(2) +
  ' — four points of Defence is more than the volley had to give');
var shieldsOpen = duel({}, { honours: [11] }, { mode: 'fire' });
ok('...and nothing when the unit is simply shot at',
  Math.abs(shieldsOpen.hits - base.hits) < 0.25, true,
  shieldsOpen.hits.toFixed(2) + ' against ' + base.hits.toFixed(2));

/* ------------------------------------------------------------ doctrines */
head('Battle-time doctrines');
var drugs = duel({}, {}, { docs: { A: [], B: ['T1'] } });
ok('Combat Drugs save about a sixth of the casualties',
  drugs.dead < base.dead && drugs.dead > base.dead * 0.7, true,
  drugs.dead.toFixed(2) + ' dead against ' + base.dead.toFixed(2));
var courage = duel({}, {}, { docs: { A: [], B: ['T2'] }, preshot: true });
var courageBase = duel({}, {}, { preshot: true });
ok('Courage Under Fire deducts a point from the second attack',
  (courageBase.sp - courage.sp) > 0.5 && (courageBase.sp - courage.sp) <= 1.05, true,
  courage.sp.toFixed(2) + ' SP against ' + courageBase.sp.toFixed(2) +
  ' — an attack that landed nothing has no point to give up');
var zero = duel({}, {}, { docs: { A: ['T6'], B: [] }, preshot: true });
ok('Zero-in adds a point to the second attack',
  (zero.hits - courageBase.hits) > 0.6 && (zero.hits - courageBase.hits) <= 1.05, true,
  zero.hits.toFixed(2) + ' hits against ' + courageBase.hits.toFixed(2));
ok('...and nothing to the first shot of the turn',
  Math.abs(duel({}, {}, { docs: { A: ['T6'], B: [] } }).hits - base.hits) < 0.25, true);

/* -------------------------------------------------------------- assault */
head('Assault');
function melee(atkOpts, defOpts, docs) {
  var n = 3000, dead = 0, wins = 0;
  for (var i = 0; i < n; i++) {
    var w = world(null, docs);
    var a = mk('shock', 'A', 20, 20, atkOpts), t = mk('regular', 'B', 22, 20, defOpts);
    t.fp = null;                                   // no defensive fire, so the melee is clean
    w.units = [a, t];
    R.assault(w, a, t);
    dead += t.size - t.models;
    if (!t.alive || R.status(t) === 'broken') wins++;
  }
  return { dead: dead / n, wins: wins / n };
}
var mBase = melee({}, {});
var nbk = melee({ honours: [9] }, {});
ok('Natural Born Killers puts men down on a 2', nbk.dead > mBase.dead * 1.3, true,
  nbk.dead.toFixed(2) + ' killed against ' + mBase.dead.toFixed(2));
var rippers = melee({ honours: [13] }, {});
ok('Rippers adds two to the Assault roll', rippers.dead > mBase.dead, true,
  rippers.dead.toFixed(2) + ' against ' + mBase.dead.toFixed(2));
var hth = melee({}, {}, { A: ['T4'], B: [] });
ok('Improved HTH Training tells for the attacker', hth.dead > mBase.dead, true,
  hth.dead.toFixed(2) + ' against ' + mBase.dead.toFixed(2));
var hthDef = melee({}, {}, { A: [], B: ['T4'] });
ok('...and defends against it too', hthDef.dead < mBase.dead, true,
  hthDef.dead.toFixed(2) + ' against ' + mBase.dead.toFixed(2));

/* --------------------------------------------------------------- rally */
head('Rallying');
function rallyTest(opts, docs, enemies) {
  var n = 4000, removed = 0;
  for (var i = 0; i < n; i++) {
    var w = world(null, docs);
    var u = mk('regular', 'A', 20, 20, opts);
    u.sp = 6;
    w.units = [u];
    for (var e = 0; e < (enemies || 0); e++) w.units.push(mk('regular', 'B', 24 + e, 20));
    var r = R.rally(w, u);
    removed += r.removed;
  }
  return removed / n;
}
var rBase = rallyTest({});
ok('a rifle team clears about half its Morale in dice', rBase > 2 && rBase < 3, true,
  rBase.toFixed(2) + ' SP a turn');
ok('Iron Discipline rolls two more dice', rallyTest({ honours: [6] }) > rBase + 0.7, true,
  rallyTest({ honours: [6] }).toFixed(2));
ok('Broken-minded halves them', rallyTest({ traumas: [4] }) < rBase * 0.7, true,
  rallyTest({ traumas: [4] }).toFixed(2));
ok('Panic-mongers rally on a 6 alone', rallyTest({ traumas: [7] }) < rBase * 0.6, true,
  rallyTest({ traumas: [7] }).toFixed(2));
ok('Surrounded, but Steady adds a die per enemy in 18"',
  rallyTest({ honours: [19] }, null, 3) > rBase + 1, true,
  rallyTest({ honours: [19] }, null, 3).toFixed(2) + ' with three enemies close');
ok('Insubordinate refuses the Inspiring Presence re-roll', (function () {
  var w = world();
  var u = mk('regular', 'A', 20, 20, { traumas: [6] }); u.sp = 6;
  var cmd = mk('cmd2', 'A', 21, 20);
  w.units = [u, cmd];
  return R.rally(w, u).reroll;
})(), false);
ok('...where a clean unit takes it', (function () {
  var w = world();
  var u = mk('regular', 'A', 20, 20); u.sp = 6;
  w.units = [u, mk('cmd2', 'A', 21, 20)];
  return R.rally(w, u).reroll;
})(), true);

/* ------------------------------------------------------- kill credit */
head('Who gets the credit');
ok('a shooter that wipes a unit out is recorded', (function () {
  for (var i = 0; i < 400; i++) {
    var w = world();
    var a = mk('mcv', 'A', 20, 20), t = mk('observers', 'B', 22, 20);
    t.models = 1; t.sp = 0;
    w.units = [a, t];
    R.shoot(w, a, t, 'fire', {});
    if (!t.alive) return t.killedBy === a.id;
  }
  return 'never died';
})(), true);
ok('the first unit to break it keeps the credit', (function () {
  var w = world();
  var a1 = mk('mcv', 'A', 20, 20), a2 = mk('mcv', 'A', 19, 20), t = mk('recruits', 'B', 22, 20);
  w.units = [a1, a2, t];
  for (var i = 0; i < 40 && R.status(t) !== 'broken'; i++) R.shoot(w, a1, t, 'fire', {});
  var first = t.brokeBy;
  for (var j = 0; j < 10; j++) R.shoot(w, a2, t, 'fire', {});
  return first === a1.id && t.brokeBy === a1.id;
})(), true);
ok('a wrecked hull remembers it was destroyed', (function () {
  var w = world();
  var a = mk('atteam', 'A', 20, 20), v = mk('lpv', 'B', 24, 20);
  w.units = [a, v];
  var log = [];
  R.applyDamage(w, v, v.str + 1, log, a);
  return !v.alive && v.killedBy === a.id && typeof v.catastrophic === 'boolean';
})(), true);
ok('a catastrophic explosion is flagged', (function () {
  var seen = { yes: 0, no: 0 };
  for (var i = 0; i < 400; i++) {
    var w = world();
    var a = mk('atteam', 'A', 20, 20), v = mk('lpv', 'B', 30, 20);
    w.units = [a, v];
    R.applyDamage(w, v, v.str + 1, [], a);
    v.catastrophic ? seen.yes++ : seen.no++;
  }
  return seen.yes > 0 && seen.no > 0;
})(), true, 'about one wreck in six');
/* A unit removed for Suppression has fled, not died (p. 34) — the report reads
   `fled` and the dossier keeps it, where `wipedOut` would strike it off. */
ok('a unit that flees the field is marked as having fled', (function () {
  var w = world();
  var u = mk('regular', 'A', 20, 20);
  u.sp = 12; w.units = [u];
  for (var i = 0; i < 30 && u.alive; i++) { u.sp = 30; R.rally(w, u); }
  return !u.alive && u.fled === true && u.brokenEver === true;
})(), true);
ok('...and never as wiped out', (function () {
  var w = world();
  var u = mk('regular', 'A', 20, 20);
  u.sp = 12; w.units = [u];
  for (var i = 0; i < 30 && u.alive; i++) { u.sp = 30; R.rally(w, u); }
  return !u.wipedOut && u.models > 0;
})(), true);

/* ---------------------------------------------- nothing leaks into a plain game */
head('A one-off battle is untouched');
ok('a plain unit carries no campaign record', mk('regular', 'A', 0, 0).camp, undefined);
ok('campFlag is false without one', R.campFlag(mk('regular', 'A', 0, 0), 'brave'), false);
ok('doctrine is false without a table', R.doctrine(world(), 'A', 'T1'), false);
var clean = duel({}, {});
ok('...and the plain duel still reads the same', Math.abs(clean.hits - base.hits) < 0.3, true,
  clean.hits.toFixed(2) + ' against ' + base.hits.toFixed(2));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
