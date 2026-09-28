/* Before anyone deploys, each player with a swap to make modifies their army
   or goes on (Continue to deployment); nobody deploys until every one has. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 991;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function game(readyUp) {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren', readyUp: readyUp,
    armyA: ['cmd3', 'regular', 'veterans', 'shock'], armyB: ['cmd3', 'regular', 'veterans', 'shock'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  return e;
}

console.log('\nTwo players, each with a swap to make');
(function () {
  const e = game(true), st = e.state();
  ok('both are asked first', !!st.deployReady && st.deployReady.A === false && st.deployReady.B === false, JSON.stringify(st.deployReady));
  ok('the swap is open meanwhile', e.intent('A', { k: 'swapopen' }).ok);
  e.intent('A', { k: 'autosplit' });
  const r = e.intent('A', { k: 'autodeploy' });
  ok('deploying counts as going on, but waits for the other player', !r.ok && st.deployReady && st.deployReady.A === true, r.why);
  ok('...nothing of A\'s is down', !st.units.some((u) => u.side === 'A' && u.x >= 0));
  ok('...and A\'s list stands (the swap is closed)', !e.intent('A', { k: 'swapopen' }).ok);
  ok('B goes on', e.intent('B', { k: 'deployready' }).ok && !st.deployReady);
  ok('now A deploys', e.intent('A', { k: 'autodeploy' }).ok && st.units.some((u) => u.side === 'A' && u.x >= 0));
  ok('going on twice is refused', !e.intent('B', { k: 'deployready' }).ok);
})();

console.log('\nWithout it (a hotseat\'s own secret round, or an older save)');
(function () {
  const e = game(false), st = e.state();
  ok('nobody is asked', !st.deployReady);
})();

console.log('\n' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
process.exit(fail ? 1 : 0);
