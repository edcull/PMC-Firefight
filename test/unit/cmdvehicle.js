/* A Command Unit riding in a Command Vehicle (p. 57): once the vehicle has
   acted, the Command Unit "may perform one of their special actions (e.g.
   Coordinate or an action allowed by any other special rule)". Played through
   the engine. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 57;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

/* A hotseat Meeting engagement: a Tier I Command Unit (Markerlights and Hackers)
   aboard a Command Vehicle, with riflemen to answer a mark; across the table a
   Combat drone unit to hack and a squad to mark. */
function battle() {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
    armyA: ['cmd1', 'cmdveh', 'regular', 'regular', 'regular'],
    armyB: ['cmd3', 'dcombat', 'regular', 'regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  ['A', 'B'].forEach((sd) => { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); });
  ['A', 'B'].forEach((sd) => e.intent(sd, { k: 'start' }));
  const st = e.state();
  const mine = (s, key) => st.units.filter((u) => u.side === s && u.key.split(/[~:]/)[0] === key);
  const veh = mine('A', 'cmdveh')[0], cmd = mine('A', 'cmd1')[0];
  // the Command Unit rides inside, the vehicle and its riflemen in sight of the enemy
  if (cmd.aboard !== veh.id) {
    veh.cargo = (veh.cargo || []).concat([cmd]);
    cmd.aboard = veh.id;
  }
  st.terrain = [];
  veh.x = 20; veh.y = 20;
  mine('A', 'regular').forEach((u, i) => { u.x = 18 + 3 * i; u.y = 14; });
  mine('B', 'regular').forEach((u, i) => { u.x = 18 + 3 * i; u.y = 32; });
  mine('B', 'dcombat')[0].x = 30; mine('B', 'dcombat')[0].y = 30;
  mine('B', 'cmd3')[0].x = 40; mine('B', 'cmd3')[0].y = 40;
  st.units.forEach((u) => { u.activated = false; u.sp = 0; });
  st.activeSide = 'A';
  return { e, st, veh, cmd };
}
// the vehicle's own activation: Pass/Regroup
function vehicleActs(e, veh) {
  e.intent('A', { k: 'select', id: veh.id });
  return e.intent('A', { k: 'action', id: 'regroup' });
}

console.log('\nThe offer names every special action the Command Unit has');
(function () {
  const { e, st, veh, cmd } = battle();
  ok('the Command Unit is aboard', cmd.aboard === veh.id);
  const r = vehicleActs(e, veh);
  ok('the vehicle acts', r.ok, r.why);
  const ids = (st.cmdOffer && st.cmdOffer.acts || []).map((a) => a.id);
  ok('an offer is made once the vehicle has acted', !!st.cmdOffer);
  ok('...Coordinate among it', ids.indexOf('coordinate') >= 0, ids.join(', '));
  ok('...and the Hack its Hackers allow', ids.indexOf('hack') >= 0);
  ok('...and the Mark its Markerlights allow', ids.indexOf('marktarget') >= 0);
  ok('nothing else of side A may act while it is asked', !e.intent('A', { k: 'select', id: st.units.filter((u) => u.side === 'A' && u.key.indexOf('regular') === 0)[0].id }).ok);
})();

console.log('\nTaking the Hack');
(function () {
  const { e, st, veh, cmd } = battle();
  vehicleActs(e, veh);
  const r = e.intent('A', { k: 'cmdact', id: 'hack' });
  ok('the Hack is taken', r.ok, r.why);
  ok('the vehicle is readied for it alone', st.cmdAct && st.cmdAct.id === 'hack' && !veh.activated);
  ok('...a Move is not on', !e.query.actionState(veh, 'move').on);
  ok('...nor a Fire!', !e.query.actionState(veh, 'fire').on);
  const other = st.units.filter((u) => u.side === 'A' && u.key.indexOf('regular') === 0)[0];
  ok('no other unit of the side may act first', !e.intent('A', { k: 'select', id: other.id }).ok);
  const drone = st.units.filter((u) => u.key.indexOf('dcombat') === 0)[0];
  const h = e.intent('A', { k: 'target', id: drone.id });
  ok('the hack goes out at the drone', h.ok && veh.activated, h.why);
  ok('...and the go passes on as usual', !st.cmdAct && !st.cmdOffer);
})();

console.log('\nTaking the Mark');
(function () {
  const { e, st, veh } = battle();
  vehicleActs(e, veh);
  const r = e.intent('A', { k: 'cmdact', id: 'marktarget' });
  ok('the Mark is taken', r.ok, r.why);
  const sel = e.sel();
  ok('it counts as stationary: no move is offered before the mark', sel.mode === 'designate' && sel.moves.length === 0, sel.mode);
})();

console.log('\nNo action');
(function () {
  const { e, st, veh } = battle();
  vehicleActs(e, veh);
  const r = e.intent('A', { k: 'cmdskip' });
  ok('the offer may be let go', r.ok && !st.cmdOffer && !st.cmdAct, r.why);
  ok('...and a made-up action is refused', (() => {
    const b = battle(); vehicleActs(b.e, b.veh);
    return !b.e.intent('A', { k: 'cmdact', id: 'demolish' }).ok;
  })());
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
