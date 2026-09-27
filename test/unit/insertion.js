/* Battlefield Insertion is the player's choice (p. 56): units with the rule
   "can" come in by it. They start held for it; the player may set one down on
   the table instead, or hold it back again, up to half the army. A unit set
   down on the table deploys like the rest and is not left counted as off it. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 56;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

console.log('\nBattlefield Insertion is a choice (p. 56)');
const e = Engine.create();
// four nomad squads with the rule among eight: half the army may come in by it
const armyA = ['cmd2', 'regular', 'regular', 'regular', 'nomads', 'nomads', 'nomads', 'nomads'];
e.start({
  tier: 3, pl: 1, scenario: 'meeting', mode: 'ai', planet: 'barren',
  armyA: armyA, armyB: R.rollArmy(3, 1, null, 'pmc'), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
});
const st = e.state();
const nomads = st.units.filter((u) => u.side === 'A' && u.key === 'nomads');
const ins = e.query.insertionFor('A');
ok('the player is offered the choice', !!ins && ins.units.length === 4, ins && ins.used + ' of up to ' + ins.cap);
ok('...and the units start held for insertion', nomads.every((u) => u.reserve));
const n0 = nomads[0];
ok('one can be set down on the table instead', e.intent('A', { k: 'insertion', id: n0.id }).ok && !n0.reserve && n0.x < 0);
ok('...and is then deployed with the rest', e.query.deployRoster('A').indexOf(n0) >= 0);
ok('...or held for insertion again', e.intent('A', { k: 'insertion', id: n0.id }).ok && n0.reserve);
// placing one held for insertion straight on the table releases it
const n1 = nomads[1], spot = e.query.nearestDeploySpot(n1, 24, 2, 20);
const put = spot && e.intent('A', { k: 'deploy', id: n1.id, x: spot.x, y: spot.y });
ok('an inserter set down on the table leaves the reserve', put && put.ok && !n1.reserve && n1.x >= 0,
  put && put.ok ? 'at ' + n1.x.toFixed(1) + ',' + n1.y.toFixed(1) : put && put.why);
ok('...and counts as on the table', e.query.onTable(n1));
// no more than half: with the four held and eight units, the cap is four
e.intent('A', { k: 'insertion', id: n1.id });
const cmd = st.units.find((u) => u.side === 'A' && u.key === 'cmd2');
ok('a unit without the rule is not offered it', !e.intent('A', { k: 'insertion', id: cmd.id }).ok);

// six with the rule among eight: four held, and a fifth is refused
const e2 = Engine.create();
e2.start({
  tier: 3, pl: 1, scenario: 'meeting', mode: 'ai', planet: 'barren',
  armyA: ['cmd2', 'regular', 'nomads', 'nomads', 'nomads', 'nomads', 'nomads', 'nomads'],
  armyB: R.rollArmy(3, 1, null, 'pmc'), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
});
const i2 = e2.query.insertionFor('A');
ok('with six that have the rule, four start held', i2.used === 4 && i2.cap === 4, i2.used + ' of ' + i2.cap);
const spare = e2.state().units.find((u) => u.side === 'A' && u.key === 'nomads' && !u.reserve);
const more = e2.intent('A', { k: 'insertion', id: spare.id });
ok('...and a fifth is refused: no more than half the army', !more.ok, more.why);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
