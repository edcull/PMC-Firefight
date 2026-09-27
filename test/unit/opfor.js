/* When the commandos bring hulls or aircraft, the OpFor needs a unit that can
   answer them (p. 148). A list with nothing to offer at the Tier — the Bugs have
   no such unit at Tiers I-III — is rolled without one, and the player is told. */
'use strict';
const { Engine } = require('../../server/rules.js');
const S = global.PMCSolo;

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function told(tier, armyA, op) {
  const e = Engine.create();
  e.start({ tier: tier, pl: 1, scenario: 's_crush', mode: 'ai', planet: 'barren',
    armyA: armyA, armyB: S.rollOpFor(tier, 1, op, true), nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel',
    solo: { faction: 'pmc', opFaction: op, names: ['A'] } });
  return e.state().log.some((l) => /answer your vehicles/.test(l.text));
}
ok('a swarm at Battle Tier I has nothing for a patrol vehicle, and says so', told(1, ['regular', 'lpv:wheeled'], 'bugs'));
ok('a PMC OpFor at Tier III has an answer, and says nothing', !told(3, ['regular', 'lcv:tracked'], 'pmc'));
ok('...nor when the commando brings no vehicle', !told(1, ['regular', 'regular'], 'bugs'));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
