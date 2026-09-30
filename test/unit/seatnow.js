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

console.log('\nA solitaire game has one seat');
ok('an OpFor shove still goes out as the one seat there is',
  seat(['A'], { phase: 'battle', activeSide: 'A' }, { insertion: { kind: 'shove', by: 'B', unit: { side: 'A' } } }), 'A');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
