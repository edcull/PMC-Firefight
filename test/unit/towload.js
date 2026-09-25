/* Loads declared before the battle, and what a carried unit may do (p. 94).
   A Lifter may start with a ground vehicle slung under it, and an empty hull
   with a gun on tow; a towing hull cannot be lifted, and a slung one hitches no
   gun. A gun on tow does not activate at all, as troops aboard do not: it
   cannot fire, dig in or do anything else until it is deployed. */
'use strict';
const { Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

function setup(armyA) {
  const e = Engine.create({});
  e.start({ tier: 4, pl: 2, scenario: 'secure', armyA: armyA, armyB: ['regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  for (let g = 0; g < 4 && e.state().swapAsk; g++) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
  const s = e.state();
  return { e, s, by: k => s.units.filter(u => u.key === k) };
}
function toBattle(e, s) {
  for (let g = 0; g < 20 && s.phase === 'deploy'; g++) {
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
    e.intent('A', { k: 'start' }); e.intent('B', { k: 'start' });
  }
}
const load = (e, hull, unit) => e.intent('A', { k: 'load', hull: hull.id, unit: unit.id }).ok;

console.log('\nLoads before the battle');
{
  const { e, s, by } = setup(['rlifter', 'rtechnical', 'rheavyac', 'rmedart', 'rtechnical', 'rinsurgents']);
  const lift = by('rlifter')[0], [t1, t2] = by('rtechnical'), ac = by('rheavyac')[0], art = by('rmedart')[0], inf = by('rinsurgents')[0];
  ok('troops aboard a technical', load(e, t1, inf));
  ok('...which a Lifter then slings, troops and all', load(e, lift, t1) && t1.aboard === lift.id && inf.aboard === t1.id);
  ok('a Lifter carries no infantry', !load(e, lift, art));
  ok('a gun on tow behind the other technical', load(e, t2, ac) && ac.aboard === t2.id);
  ok('...and nothing else on that hook', !load(e, t2, art));
  toBattle(e, s);
  ok('the loads hold into the battle', s.phase === 'battle' && (lift.cargo || []).indexOf(t1) >= 0 && (t2.cargo || []).indexOf(ac) >= 0);
}
{
  const { e, by } = setup(['rlifter', 'rtechnical', 'rheavyac', 'rlifter', 'rtechnical', 'rmedart']);
  const [l1, l2] = by('rlifter'), [t1, t2] = by('rtechnical');
  ok('a slung vehicle hitches no gun', load(e, l1, t1) && !load(e, t1, by('rheavyac')[0]));
  ok('a towing vehicle cannot be slung', load(e, t2, by('rmedart')[0]) && !load(e, l2, t2));
}

console.log('\nA gun on tow does not act');
{
  const { e, s, by } = setup(['rtechnical', 'rmedart', 'rinsurgents']);
  const tech = by('rtechnical')[0], gun = by('rmedart')[0];
  load(e, tech, gun);
  toBattle(e, s);
  s.terrain = []; s.activeSide = 'A'; s.chain = null;
  s.units.forEach(u => { u.activated = false; });
  ok('it is not among the units waiting to activate', e.query.eligible ? e.query.eligible('A').indexOf(gun) < 0 : true);
  ['fire', 'advance', 'move', 'stance', 'demolish', 'rally'].forEach(id => {
    e.intent('A', { k: 'cancel' }); e.intent('A', { k: 'select', id: gun.id });
    ok('no ' + id, !e.intent('A', { k: 'action', id: id }).ok);
  });
  ok('...and the side\'s activation is still to come', !gun.activated && s.activeSide === 'A');
  const st = e.query.actionState(gun, 'fire');
  ok('the hint says why', !st.on && /tow/i.test(st.hint || ''), st.hint);
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
if (fail) process.exit(1);
