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
// (the defender is down; the attacker places nothing now — it enters in turn 1)
ok('online: everyone is down', e.state().phase === 'deploy' && e.query.deploymentDone());
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

// Invasion online: each player answers for their own split; one may be ready while the other's waves are not yet split
e = Engine.create({});
e.start({ tier: 3, pl: 2, scenario: 'invasion', attacker: 'B', armyA: ['cmd3', 'regular', 'regular', 'regular', 'veterans'], armyB: ['cmd3', 'regular', 'regular', 'regular', 'veterans', 'shock'],
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', readyUp: true });
for (let g = 0; g < 20 && e.state().phase === 'deploy'; g++) {
  if (e.state().deployReady && e.state().deployReady.A === false) e.intent('A', { k: 'deployready' });
  if (e.state().deployReady && e.state().deployReady.B === false) e.intent('B', { k: 'deployready' });
  if (e.state().swapAsk) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
  e.intent('A', { k: 'autosplit' }); e.intent('A', { k: 'autodeploy' });
  if (e.query.sideDone('A')) break;
}
const bSplit = e.query.splitFor('B');
if (bSplit && bSplit.held) e.state().units.filter(u => u.side === 'B' && u.reserve).forEach(u => e.intent('B', { k: 'holdback', id: u.id }));
const bNow = e.query.splitFor('B');
ok('invasion: the defender is set out and split, the invader’s waves not yet', e.query.sideDone('A') && bNow && !bNow.ok, JSON.stringify(bNow && { held: bNow.held, min: bNow.min }));
const ra = e.intent('A', { k: 'start' });
ok('...the defender may say they are ready all the same', ra.ok && e.state().startReady && e.state().startReady.A === true && e.state().phase === 'deploy', JSON.stringify(ra));
ok('...the invader may not until their waves are split', !e.intent('B', { k: 'start' }).ok && e.state().phase === 'deploy');
e.intent('B', { k: 'autosplit' });
e.intent('B', { k: 'start' });
ok('...and once split and ready, the battle begins', e.state().phase === 'battle', e.state().phase);
// the invader nominates the three landing zones: each one is on the table (for both screens) as soon as it is chosen
const lzs = [];
for (let i = 0; i < 3; i++) {
  const ins = e.snapshot().ui.insertion;
  if (!ins || ins.kind !== 'ilz') break;
  const sp = ins.spots[Math.floor(ins.spots.length / 2)];
  e.intent('B', { k: 'insert', x: sp.x, y: sp.y });
  lzs.push(e.state().objectives.length);
}
ok('each landing zone shows the moment it is nominated, not once all three are', lzs.join() === '1,2,3' && !e.state().sc.lzPending, lzs.join());

console.log('\n  ' + (checks - bad) + ' checks passed, ' + bad + ' failed.');
process.exit(bad ? 1 : 0);
