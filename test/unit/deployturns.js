/* Whose turn it is to set up. Where the scenario has a defender (Hostile
   takeover, Demolish, Invasion) the defender sets up first; otherwise Player 1,
   then Player 2. Nothing of a side's goes down, or is held back, loaded or
   split, while it is the other side's turn — and the automatic split sorts only
   the sender's own force. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 4242;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function game(scenario, attacker) {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: scenario, mode: 'hotseat', planet: 'barren', attacker: attacker,
    armyA: ['cmd3', 'regular', 'veterans', 'shock', 'regular', 'veterans'],
    armyB: ['cmd3', 'regular', 'veterans', 'shock', 'regular', 'veterans'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  // the defender's own position goes down by the auto button, and any other piece is skipped
  for (let k = 0; k < 10 && e.state().placeAsk; k++) {
    const pa = e.state().placeAsk;
    e.intent(pa.side, { k: pa.kind === 'fort' ? 'placeauto' : 'placedone' });
  }
  return e;
}
const down = (e, side) => e.state().units.filter(u => u.side === side && u.x >= 0).length;

console.log('\nHostile takeover: the defender sets up first');
(function () {
  const e = game('takeover', 'A');
  const def = e.state().sc.defender;
  ok('the defender is Player 2 here', def === 'B', def);
  ok('...and it is the defender\'s turn to set up', e.query.placingSide() === 'B', e.query.placingSide());
  const r = e.intent('A', { k: 'autodeploy' });
  ok('the attacker\'s Auto-deploy is refused meanwhile', !r.ok && down(e, 'A') === 0, r.why);
  const a = e.state().units.find(u => u.side === 'A');
  ok('...as is placing one of its units', !e.intent('A', { k: 'deploy', id: a.id, x: 3, y: 20 }).ok && down(e, 'A') === 0);
  ok('the defender sets up', e.intent('B', { k: 'autodeploy' }).ok && down(e, 'B') > 0);
  ok('...then it is the attacker\'s turn', e.query.placingSide() === 'A', e.query.placingSide());
})();

console.log('\nInvasion: the defender first, while the attacker sorts its waves');
(function () {
  const e = game('invasion', 'A');
  ok('the defender (Player 2) sets up first', e.query.placingSide() === 'B', e.query.placingSide());
  const w = e.state().units.find(u => u.side === 'A' && u.reserve);
  const r = e.intent('A', { k: 'holdback', id: w && w.id });
  ok('the attacker, with nothing to put down, may move a unit between its waves meanwhile', !!w && r.ok, r.why);
})();

console.log('\nMeeting engagement: Player 1, then Player 2');
(function () {
  const e = game('meeting');
  ok('no defender, so Player 1 sets up first', e.query.placingSide() === 'A', e.query.placingSide());
  ok('Player 2\'s Auto-deploy is refused until then', !e.intent('B', { k: 'autodeploy' }).ok && down(e, 'B') === 0);
  e.intent('A', { k: 'autodeploy' });
  ok('...and allowed once Player 1 is down', e.query.placingSide() === 'B' && e.intent('B', { k: 'autodeploy' }).ok && down(e, 'B') > 0);
})();

console.log('\nFind and secure: each side sorts its own halves, on its own turn');
(function () {
  const e = game('find');
  const sp = e.state().sc.split;
  ok('both forces are split', !!(sp && sp.A && sp.B));
  const heldB = () => e.state().units.filter(u => u.side === 'B' && u.reserve).map(u => u.id).sort().join();
  const before = heldB();
  const bId = sp.B.ids[sp.B.ids.length - 1];
  ok('Player 2 may not hold units back while Player 1 sets up', !e.intent('B', { k: 'holdback', id: bId }).ok && heldB() === before);
  ok('...nor use the automatic split', !e.intent('B', { k: 'autosplit' }).ok);
  const heldA = () => e.state().units.filter(u => u.side === 'A' && u.reserve).length;
  ok('Player 1\'s automatic split sorts its own halves and leaves Player 2\'s alone', e.intent('A', { k: 'autosplit' }).ok && heldA() > 0 && heldB() === before, heldA() + ' held');
  e.intent('A', { k: 'autodeploy' });
  ok('once Player 1 is down it is Player 2\'s turn', e.query.placingSide() === 'B');
  const a = e.state().units.find(u => u.side === 'A' && u.x >= 0);
  ok('...and Player 1 may no longer hold a unit back (it would have another to place)', !e.intent('A', { k: 'holdback', id: a.id }).ok && a.x >= 0);
  ok('Player 2 sorts its halves on its turn', e.intent('B', { k: 'autosplit' }).ok);
})();

console.log('\n' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
process.exit(fail ? 1 : 0);
