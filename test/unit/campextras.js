/* The last of the campaign rules that had no behaviour: NOT ONE STEP BACKWARDS!
   (T5), Nanobots, and the engine halves of Bloodlust and Semper Fidelis flags.
   The table-side flows (Rapid Relocation, Semper Fidelis arrivals, Bloodlust's
   forced charge) are played through the page in extrasflow.js. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(56) +
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
    str: p.str, transport: p.transport, cargo: [], damage: 0, facing: 0,
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
function world(units, docs) {
  return { units: units, terrain: [], objectives: [], log: [], doctrines: docs || null };
}

/* ------------------------------------------------ NOT ONE STEP BACKWARDS! */
head('NOT ONE STEP BACKWARDS! (T5, p. 87)');
var cmd = mk('cmd2', 'A', 10, 10), line = mk('regular', 'A', 14, 16), far = mk('regular', 'A', 40, 10);
var shaken = mk('regular', 'A', 20, 10); shaken.sp = 6;
var w = world([cmd, line, far, shaken], { A: ['T5'], B: [] });
ok('a Command Unit may steady a friend', R.steadyShooter(w, cmd), true);
ok('...and so may a unit within 12" of one', R.steadyShooter(w, line), true);
ok('...but not one out beyond 12"', R.steadyShooter(w, far), false);
ok('without the doctrine nobody may', R.steadyShooter(world([cmd, shaken], { A: [], B: [] }), cmd), false);
ok('only friends carrying Suppression are targets', R.steadyTargets(w, cmd).map(function (t) { return t.id; }).join(),
  shaken.id);
var removedTot = 0, killed = 0, N = 4000, never = true, matches = true;
for (var i = 0; i < N; i++) {
  var c2 = mk('veterans', 'A', 10, 10), t2 = mk('regular', 'A', 20, 10);
  c2.rules.push('Command Unit (1)');
  t2.sp = 12;
  var r2 = R.steadyFire(world([c2, t2], { A: ['T5'] }), c2, t2);
  removedTot += 12 - t2.sp; killed += t2.size - t2.models;
  if (t2.sp > 12) never = false;
  if (r2.killed !== t2.size - t2.models) matches = false;
}
ok('the shot takes Suppression away, on average', removedTot / N > 0.3, true, (removedTot / N).toFixed(2) + ' SP per shot');
ok('...and never adds any', never, true);
ok('a Man down! still kills, as the book reads it', killed > 0, true, (killed / N).toFixed(2) + ' models per shot');
ok('...and the result says so', matches, true);
/* p. 87's own example: two Get down! and one Man down! take 4 Suppression away */
var ex = mk('regular', 'A', 20, 10); ex.sp = 6;
var exS = mk('veterans', 'A', 10, 10); exS.rules.push('Command Unit (1)');
var exW = world([exS, ex], { A: ['T5'] });
var got = null;
for (var tries = 0; tries < 20000 && !got; tries++) {
  ex.sp = 6; ex.models = ex.size; ex.alive = true;
  var r3 = R.steadyFire(exW, exW.units[0], ex);
  var txt = r3.log.map(function (l) { return l.text; }).join(' ');
  if (r3.hits === 3 && (txt.match(/Get down!/g) || []).length === 2 && (txt.match(/Man down!/g) || []).length === 1) got = r3;
}
ok("the book's example: two Get down! and a Man down! remove 4", got && got.removed, 4);
var low = mk('regular', 'A', 20, 10); low.sp = 1;
var c3 = mk('cmd2', 'A', 10, 10), floorOK = true;
for (var j = 0; j < 500; j++) { low.sp = 1; R.steadyFire(world([c3, low], { A: ['T5'] }), c3, low); if (low.sp < 0) floorOK = false; }
ok('Suppression never goes below zero', floorOK, true);

/* ------------------------------------------------------------- Nanobots */
head('Nanobots (Upgrade 6, p. 89)');
var dice = [], plainDice = [];
for (var k = 0; k < 200; k++) {
  var v = mk('lpv', 'A', 10, 10, { upgrades: [6] }); v.damage = v.str - 1;
  var p2 = mk('lpv', 'A', 10, 10); p2.damage = p2.str - 1;
  dice.push(R.repair(world([v]), v).dice);
  plainDice.push(R.repair(world([p2]), p2).dice);
}
var vv = mk('lpv', 'A', 10, 10);
ok('a hull with Nanobots rolls dice for its full Structure', dice[0], vv.str);
ok('...where a plain one rolls for what is left', plainDice[0], 1);

/* ----------------------------------------------------- the flags themselves */
head('The flags reach the table');
var bl = mk('regular', 'A', 10, 10, { traumas: [3] });
ok('Bloodlust is on a unit that drew it', R.campFlag(bl, 'bloodlust'), true);
var sf = mk('regular', 'A', 10, 10, { honours: [16] });
ok('Semper Fidelis is on a unit that earned it', R.campFlag(sf, 'semperFidelis'), true);
ok('Rapid Relocation is a battle doctrine', C.doctrine('O3').where, 'battle');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
