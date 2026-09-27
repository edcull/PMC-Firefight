/* Loads declared before the battle, and what a carried unit may do (pp. 94-95).
   A Lifter may start with a ground vehicle slung under it. Stationary Artillery
   is towed by transport vehicles only, the gun taking one of the hull's places;
   a towing hull cannot be lifted, and a slung one hitches no gun. A gun on tow
   does not activate at all, as troops aboard do not: it cannot fire, dig in or
   do anything else until it is deployed. */
'use strict';
const { R, Engine } = require('../../server/rules.js');

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
  const { e, s, by } = setup(['rlifter', 'rltv', 'rheavyac', 'rmedart', 'ritv', 'rinsurgents', 'rmilitia']);
  const lift = by('rlifter')[0], ltv = by('rltv')[0], itv = by('ritv')[0];
  const ac = by('rheavyac')[0], art = by('rmedart')[0], inf = by('rinsurgents')[0], mil = by('rmilitia')[0];
  ok('troops aboard a light transport vehicle', load(e, ltv, inf));
  ok('...which a Lifter then slings, troops and all', load(e, lift, ltv) && ltv.aboard === lift.id && inf.aboard === ltv.id);
  ok('a Lifter carries no infantry', !load(e, lift, mil));
  ok('...nor a gun: it is not a vehicle', !load(e, lift, art));
  ok('a gun on tow behind the improved transport vehicle', load(e, itv, ac) && ac.aboard === itv.id);
  ok('...taking one of its two places, so a squad still rides', load(e, itv, mil) && mil.aboard === itv.id);
  ok('...and then it is full', (itv.cargo || []).length === itv.transport && !load(e, itv, art));
  toBattle(e, s);
  ok('the loads hold into the battle', s.phase === 'battle' && (lift.cargo || []).indexOf(ltv) >= 0 && (itv.cargo || []).indexOf(ac) >= 0);
}
{
  const { e, by } = setup(['rshtv', 'rheavyac', 'rmedart', 'rinsurgents']);
  const sh = by('rshtv')[0];
  ok('one gun to a hull, however big', load(e, sh, by('rheavyac')[0]) && !load(e, sh, by('rmedart')[0]));
  ok('...with the rest of its places for troops', load(e, sh, by('rinsurgents')[0]));
}
{
  const { e, by } = setup(['rlifter', 'rltv', 'rheavyac', 'rlifter', 'rltv', 'rmedart']);
  const [l1, l2] = by('rlifter'), [t1, t2] = by('rltv');
  ok('a slung vehicle hitches no gun', load(e, l1, t1) && !load(e, t1, by('rheavyac')[0]));
  ok('a towing vehicle cannot be slung', load(e, t2, by('rmedart')[0]) && !load(e, l2, t2));
}
{
  const { e, by } = setup(['rtechnical', 'rlicv', 'rlshuttle', 'rmedart']);
  const art = by('rmedart')[0];
  ok('a technical tows no gun: it is not a transport vehicle', !load(e, by('rtechnical')[0], art));
  ok('nor a combat vehicle', !load(e, by('rlicv')[0], art));
  ok('nor a shuttle: aircraft do not tow', !load(e, by('rlshuttle')[0], art));
}

console.log('\nTowing in the battle (p. 95)');
{
  const { e, s, by } = setup(['rltv', 'rlshuttle', 'rlicv', 'rmedart', 'rinsurgents']);
  toBattle(e, s);
  const ltv = by('rltv')[0], sh = by('rlshuttle')[0], cv = by('rlicv')[0], art = by('rmedart')[0], inf = by('rinsurgents')[0];
  // (the deployment may have garrisoned any of them in a building: out of it, as the buildings go)
  [ltv, sh, cv, art, inf].forEach((u, i) => { u.aboard = null; u.cargo = u.transport ? [] : u.cargo; u.x = 20 + i; u.y = 20; u.sp = 0; u.disembarked = false; u.bld = null; u.sec = null; });
  s.terrain = [];
  ok('a transport vehicle may hitch a gun beside it', R.canEmbark(s, ltv, art));
  ok('an aircraft may not', !R.canEmbark(s, sh, art));
  ok('nor a combat vehicle', !R.canEmbark(s, cv, art));
  art.dugIn = true;
  ok('a gun dug in cannot be hitched (p. 95)', !R.canEmbark(s, ltv, art));
  art.dugIn = false;
  R.embark(s, ltv, art);
  ok('towing, it still takes a squad on', R.canEmbark(s, ltv, inf));
}

console.log('\nA gun on tow does not act');
{
  const { e, s, by } = setup(['rltv', 'rmedart', 'rinsurgents']);
  const tech = by('rltv')[0], gun = by('rmedart')[0];
  ok('the gun is on tow', load(e, tech, gun));
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
