/* Two worlds from one table.

   The book's "barren / arctic world" is fought as either a desert or an
   arctic world: the same rolls and the same pieces, a different look. A random
   planet still picks each of the book's seven kinds of world as often as the
   next — the barren kind is not made twice as common by coming in two looks —
   and a battle is always settled onto one world or the other, never left as
   "barren", so every screen paints the same ground. */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/gen.js');
var G = global.PMCGen;
var P = require('../../src/engine/protocol.js');
var E = require('../../server/rules.js');

var pass = 0, fail = 0;
function ok(what, got, want, note) {
  if (got === want) { pass++; console.log('  ✓ ' + what + (note ? '  (' + note + ')' : '')); }
  else { fail++; console.log('  ✗ ' + what + ' — got ' + got + ', wanted ' + want + (note ? '  (' + note + ')' : '')); }
}
function seeded(s) {
  s = Math.imul(s ^ 0x9e3779b9, 2654435761) >>> 0;
  var f = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  f(); f(); f();
  return f;
}

console.log('\nOne table');
// the barren table, row for row — only its impassable ground is the world's own (mesas, ice ravines)
function sameTable(pl, kind) {
  var rows = G.tableFor(pl).rows, base = G.GENERATORS.barren.rows;
  return rows.length === base.length && rows.every(function (r, i) {
    var kinds = JSON.stringify(r.alts.map(function (a) { return a.map(function (q) { return q.kind; }); }));
    var want = JSON.stringify(base[i].alts.map(function (a) { return a.map(function (q) { return q.kind === 'lava' ? kind : q.kind; }); }));
    return kinds === want;
  });
}
ok('a desert is laid from the barren table, with mesas for impassable ground', sameTable('desert', 'mesa'), true);
ok('...and an arctic world with ice ravines', sameTable('arctic', 'ravine'), true);
ok('each goes by its own name', G.tableFor('desert').name + ' / ' + G.tableFor('arctic').name,
  'Desert world (barren) / Arctic world (barren)');
var laid = G.generate({ width: 48, height: 48, planet: 'arctic', rand: seeded(3) });
ok('the generator lays an arctic table', laid.terrain.length > 0 && laid.generator === 'Arctic world (barren)', true,
  laid.terrain.length + ' pieces');

console.log('\nSettling the world');
var tally = {}, rand = seeded(77), N = 7000;
for (var i = 0; i < N; i++) { var w = G.resolvePlanet('random', rand); tally[w] = (tally[w] || 0) + 1; }
ok('a random world is never left as "barren"', !tally.barren, true);
var barrenKind = (tally.desert || 0) + (tally.arctic || 0);
ok('the barren kind turns up as often as any other kind', Math.abs(barrenKind / N - 1 / 7) < 0.02, true,
  Math.round(barrenKind / N * 1000) / 10 + '% against ' + Math.round(1000 / 7) / 10 + '%');
ok('...split about evenly between desert and arctic', Math.abs(tally.desert - tally.arctic) / barrenKind < 0.1, true,
  tally.desert + ' desert, ' + tally.arctic + ' arctic');
var old = {};
for (var j = 0; j < 200; j++) old[G.resolvePlanet('barren', rand)] = 1;
ok('an old "barren" contract is settled into one or the other', Object.keys(old).sort().join(','), 'arctic,desert');
ok('a world asked for by name is kept', G.resolvePlanet('jungle', rand) + ' ' + G.resolvePlanet('desert', rand), 'jungle desert');

console.log('\nA battle');
var e = E.Engine.create();
e.start({
  tier: 2, pl: 1, scenario: 'secure', planet: 'barren',
  armyA: E.R.rollArmy(2, 1, null, 'pmc'), armyB: E.R.rollArmy(2, 1, null, 'pmc'),
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat'
});
var world = e.state().cfg.planet;
ok('a battle on a barren world is fought on one of the two', world === 'desert' || world === 'arctic', true, world);
var snap = JSON.parse(JSON.stringify(e.snapshot()));
ok('...and every screen is told which', snap.cfg.planet, world);

console.log('\nThe lobby');
ok('the lobby offers both worlds', P.PLANET_CHOICES.indexOf('desert') >= 0 && P.PLANET_CHOICES.indexOf('arctic') >= 0, true);
ok('...and not the old name', P.PLANET_CHOICES.indexOf('barren'), -1);
ok('an older client asking for "barren" is still understood', P.cleanSettings({ planet: 'barren' }).planet, 'barren');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
