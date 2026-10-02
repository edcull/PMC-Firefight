/* A hotseat game plays both seats on one screen, and whichever side is being
   asked has to be the one that answers. The Local transport picks the seat an
   intent goes out as (seatNow): normally the side that is up, but an answer
   owed by the other side goes out as that side — the opponent shoving a
   Battlefield Insertion off its mark (p. 56) is asked while the inserting
   side is still up, and used to be answered as the wrong side and refused,
   leaving the game stuck on the prompt. */
global.window = global;
require('../../src/net/net.js');
var Local = global.PMCNet.Local;

var pass = 0, fail = 0;
function ok(name, got, want) {
  var good = got === want;
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name + '  — ' + got + (good ? '' : ' (expected ' + want + ')'));
}
// an engine that answers only what seatNow asks of it
function stub(st, sel) {
  return { state: function () { return st; }, sel: function () { return sel; }, query: { placingSide: function () { return 'A'; }, terrainSide: function () { return 'A'; } } };
}
function seat(seats, st, sel, it) {
  var l = new Local();
  l.seats = seats;
  l.engine = stub(st, sel);
  return l.seatNow(it);
}

console.log('\nWho answers, in a hotseat game');
ok('the side that is up acts', seat(['A', 'B'], { phase: 'battle', activeSide: 'B' }, {}), 'B');
ok('its own insertion is placed by the inserting side',
  seat(['A', 'B'], { phase: 'battle', activeSide: 'B' }, { insertion: { kind: 'insert', unit: { side: 'B' } } }), 'B');
ok('a shove is answered by the side shoving it, not the side that is up',
  seat(['A', 'B'], { phase: 'battle', activeSide: 'B' }, { insertion: { kind: 'shove', by: 'A', unit: { side: 'B' } } }), 'A');
ok('...either way round',
  seat(['A', 'B'], { phase: 'battle', activeSide: 'A' }, { insertion: { kind: 'shove', by: 'B', unit: { side: 'A' } } }), 'B');

console.log('\nSetting up, at one screen');
var setUp = { phase: 'deploy', units: [{ id: 'a1', side: 'A' }, { id: 'b1', side: 'B' }] };
ok('placing goes out as the side whose turn it is', seat(['A', 'B'], setUp, {}, { k: 'autodeploy' }), 'A');
ok('holding back one of Player 2\'s units goes out as Player 2 (an Invasion attacker sorting its waves)',
  seat(['A', 'B'], setUp, {}, { k: 'holdback', id: 'b1' }), 'B');
ok('...and loading one of its units', seat(['A', 'B'], setUp, {}, { k: 'load', hull: 'b1', unit: 'b1' }), 'B');

console.log('\nQuestions put to the side that is not up (hotseat review HB-1, HB-2)');
var up = { phase: 'battle', activeSide: 'A' };
ok('which of its reserves come on: the side choosing',
  seat(['A', 'B'], up, { reservePick: { side: 'B' } }, { k: 'rpick', id: 'x' }), 'B');
ok('...and its "done"', seat(['A', 'B'], up, { reservePick: { side: 'B' } }, { k: 'rpickdone' }), 'B');
ok('Know Your Foe!: the side holding it', seat(['A', 'B'], { phase: 'battle', activeSide: 'A', kyfAsk: { side: 'B' } }, {}, { k: 'kyf' }), 'B');
ok('Martyrdom: the side whose Holy Warriors are charged',
  seat(['A', 'B'], { phase: 'battle', activeSide: 'A', martyrAsk: { side: 'B' } }, {}, { k: 'nomartyr' }), 'B');
ok('...anything else still goes out as the side that is up',
  seat(['A', 'B'], { phase: 'battle', activeSide: 'A', kyfAsk: { side: 'B' } }, {}, { k: 'select', id: 'x' }), 'A');

// the real engine behind a Local transport: the reserve pick no longer leaves the game stuck
(function () {
  var Engine = require('../../server/rules.js').Engine;
  var e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular', 'regular'], armyB: ['regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  var l = new Local(); l.seats = ['A', 'B']; l.engine = e; l.rolling = function (f) { return f.call(this); }; l.flush = function () { }; l.keep = function () { };
  var st = e.state(), b = st.units.filter(function (u) { return u.side === 'B'; })[0], done = false;
  st.phase = 'battle'; st.activeSide = 'A';
  e.sel().reservePick = { side: 'B', ids: [b.id], chosen: [], min: 0, max: 1, finish: function () { done = true; e.sel().reservePick = null; } };
  l.intent({ k: 'rpick', id: b.id });
  ok('a real hotseat game: Player 2 picks its reserve while Player 1 is up', e.sel().reservePick && e.sel().reservePick.chosen[0], b.id);
  l.intent({ k: 'rpickdone' });
  ok('...and is done, nothing left stuck', done, true);
})();

console.log('\nA solitaire game has one seat');
ok('an OpFor shove still goes out as the one seat there is',
  seat(['A'], { phase: 'battle', activeSide: 'A' }, { insertion: { kind: 'shove', by: 'B', unit: { side: 'A' } } }), 'A');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
