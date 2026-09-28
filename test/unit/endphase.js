/* A unit that does nothing (Skip), and the End phase's one choice: surrender
   the battle. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 4411;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function battle() {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
    armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'pmc'),
    nameA: 'Alpha', nameB: 'Bravo', colourA: 'ochre', colourB: 'steel'
  });
  ['A', 'B'].forEach((sd) => { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); });
  ['A', 'B'].forEach((sd) => e.intent(sd, { k: 'start' }));
  return e;
}
// every unit skips until the turn's End phase asks its question
function skipToEnd(e) {
  const st = e.state();
  for (let i = 0; i < 200 && !st.endAsk && !st.over; i++) {
    if (st.faceAsk) { e.intent(st.faceAsk.side, { k: 'vfaceall' }); continue; }
    const side = st.activeSide, u = e.query.eligible(side)[0];
    if (!u) break;
    e.intent(side, { k: 'select', id: u.id });
    e.intent(side, { k: 'action', id: 'skip' });
  }
  return st.endAsk;
}

console.log('\nSkip');
(function () {
  const e = battle(), st = e.state(), side = st.activeSide;
  const u = e.query.eligible(side)[0];
  const x = u.x, y = u.y, sp = u.sp;
  e.intent(side, { k: 'select', id: u.id });
  const r = e.intent(side, { k: 'action', id: 'skip' });
  ok('a unit may skip its action', r.ok, r.why);
  ok('...and is spent, where it was, no worse off', u.activated && u.x === x && u.y === y && u.sp === sp);
  ok('...and play passes on', st.activeSide !== side || e.query.eligible(side).indexOf(u) < 0);
})();

console.log('\nEnd phase: victory checked, then either side may surrender');
(function () {
  const e = battle(), st = e.state();
  const ask = skipToEnd(e);
  ok('each player is asked at the end of the turn', !!ask && ask.side === 'A', ask ? '' : st.log.slice(-3).map((l) => l.text).join(' / '));
  ok('...after the Rally phase', st.log.some((l) => /^Rally phase/.test(l.text)));
  ok('...and nothing else can be done meanwhile', !e.intent(st.activeSide, { k: 'action', id: 'skip' }).ok);
  ok('the other player cannot answer for them', !e.intent('B', { k: 'enddone' }).ok);
  ok('there is no withdrawing units', !e.intent('A', { k: 'endflee', id: st.units[0].id }).ok);
  const r = e.intent('A', { k: 'enddone' });
  ok('carrying on, the other player is asked', r.ok && st.endAsk && st.endAsk.side === 'B', r.why);
  e.intent('B', { k: 'enddone' });
  ok('and with both answered the next turn starts', !st.endAsk && st.turn === 2 && !st.over);
})();
(function () {
  const e = battle(), st = e.state();
  skipToEnd(e);
  e.intent('A', { k: 'enddone' });
  e.intent('B', { k: 'surrender' });
  ok('one press does not surrender', !st.over && st.endAsk.sure);
  e.intent('B', { k: 'surrender' });
  ok('the second does: the other side wins', !!st.over && st.over.winner === 'A', JSON.stringify(st.over && st.over.winner));
})();
console.log('\n' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
process.exit(fail ? 1 : 0);
