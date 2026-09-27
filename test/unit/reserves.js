/* A scenario that holds part of a force back leaves the choice to the player:
   nothing of theirs starts in reserve, the battle cannot begin until they have
   held back as many as the scenario asks, and the OpFor's split stands as the
   scenario made it. */
'use strict';
const { R, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

console.log('\nChoosing the reserves (Find & Secure: half held back)');
const e = Engine.create();
e.start({
  tier: 3, pl: 1, scenario: 'find',
  armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'pmc'),
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'barren'
});
const sp = e.query.splitFor('A');
ok('the player has a split to make', !!sp, sp && sp.min + '-' + sp.max);
ok('...and none of their units starts in reserve', sp && sp.held === 0 &&
  !e.state().units.some((u) => u.side === 'A' && u.reserve && u.wave === 2));
ok('the OpFor\'s reserves are held back as the scenario made them',
  e.state().units.some((u) => u.side === 'B' && u.reserve && u.wave === 2));
e.intent('A', { k: 'autodeploy' });
ok('with everyone down but nobody held back, the battle cannot begin',
  !e.query.deploymentDone() && !e.intent('A', { k: 'start' }).ok);
// hold back as many as the scenario asks, one at a time
const want = e.query.splitFor('A').min;
e.query.splitFor('A').units.filter((x) => !x.locked).slice(0, want)
  .forEach((x) => e.intent('A', { k: 'holdback', id: x.id }));
const now = e.query.splitFor('A');
ok('holding back the number asked for makes the split good', now.ok, now.held + ' of ' + now.min + '-' + now.max);
ok('...and the battle can begin', e.intent('A', { k: 'start' }).ok);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
