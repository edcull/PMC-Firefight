/* Online, both players say they are ready before the battle begins: one press
   alone does not start it, and a player who changes their deployment after
   pressing has to press again. On one screen, one press is enough. */
'use strict';
const { Engine } = require('../../server/rules.js');

let checks = 0, bad = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) { console.log('  ✓ ' + what); return true; }
  bad++;
  console.log('  ✗ ' + what + (detail ? ' — ' + detail : ''));
  return false;
}

function deployed(readyUp) {
  const e = Engine.create({});
  e.start({
    // Demolish: a defender who sets up before the battle
    tier: 3, pl: 2, scenario: 'demolish', attacker: 'B', armyA: ['cmd3', 'regular'], armyB: ['cmd3', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', readyUp
  });
  for (let g = 0; g < 20 && e.state().phase === 'deploy' && e.state().units.some(u => u.x < 0 && !u.reserve && !u.aboard); g++) {
    for (const sd of ['A', 'B']) {
      if (e.state().deployReady && e.state().deployReady[sd] === false) e.intent(sd, { k: 'deployready' });
      if (e.state().swapAsk) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
      e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' });
    }
  }
  return e;
}

let e = deployed(true);
ok('online: everyone is down', e.state().phase === 'deploy' && e.state().units.every(u => u.x >= 0 || u.reserve || u.aboard));
e.intent('A', { k: 'start' });
ok('one player pressing Begin does not start the battle', e.state().phase === 'deploy' && e.state().startReady && e.state().startReady.A === true);
// a deployment intent after pressing (here Auto-deploy) takes the ready back
const again = e.intent('A', { k: 'autodeploy' });
ok('...going back to the deployment after, they have to say so again', again.ok && e.state().startReady.A === false, JSON.stringify(e.state().startReady));
e.intent('A', { k: 'start' });
e.intent('B', { k: 'start' });
ok('...and once both have, it begins', e.state().phase === 'battle' && !e.state().startReady, e.state().phase);

e = deployed(false);
e.intent('A', { k: 'start' });
ok('on one screen, one press begins it', e.state().phase === 'battle', e.state().phase);

console.log('\n  ' + (checks - bad) + ' checks passed, ' + bad + ' failed.');
process.exit(bad ? 1 : 0);
