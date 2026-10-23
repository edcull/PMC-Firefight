/* The hive's barriers are shed carapace: a barricade the bugs put down (a
   story's Readiness, Last Stand) or a Ballistic Barrier one of their units
   sets up is marked so, and drawn so (iso-props.js); anybody else's is not.
   The same low wall either way. */
'use strict';
const { R, SC, Engine } = require('../../server/rules.js');
require('../../src/rules/compound.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function started(armyB) {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: ['cmd2', 'regular', 'regular'], armyB, mode: 'ai', planet: 'sparse' });
  return e.state();
}
for (const [who, army, bugs] of [['the hive', R.rollArmy(2, 1, null, 'bugs'), true], ['a company', ['cmd2', 'regular', 'regular'], false]]) {
  const st = started(army);
  st.terrain = st.terrain.filter((t) => t.kind !== 'barricade');
  st.cfg.story = { barricades: { B: 3 } };
  SC.lastStandBarricades(st);
  const laid = st.terrain.filter((t) => t.kind === 'barricade');
  ok(who + '’s barricades ' + (bugs ? 'are' : 'are not') + ' carapace', laid.length > 0 && laid.every((t) => !!t.carapace === bugs), laid.length + ' laid');
  ok('...and a low wall, as any barricade', laid.every((t) => R.TERRAIN[t.kind] === R.TERRAIN.barricade));
  const u = st.units.find((x) => x.side === 'B' && x.alive);
  Object.assign(u, { x: 24, y: 24 });
  st.terrain = [];
  const plan = global.PMCCompound.barrierPlan(st, u, 0);
  ok('...and ' + (bugs ? 'so is' : 'nor is') + ' a Ballistic Barrier one of theirs sets up', plan.ok && plan.pieces.every((p) => p.shield && !!p.carapace === bugs), plan.why || '');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
