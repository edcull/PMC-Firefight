/* Stationary Artillery counts shallow water as impassable (p. 95): a gun is
   never put down in it — deployed, relocated, or unhitched from its tow. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const e = Engine.create();
e.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
  armyA: ['rmedart', 'rmilitia', 'rtechnical'], armyB: R.rollArmy(3, 1, null, 'pmc'),
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel' });
const st = e.state();
const gun = st.units.find((u) => u.side === 'A' && R.has(u, 'Stationary Artillery'));
const squad = st.units.find((u) => u.side === 'A' && u.cls === 'infantry' && !R.has(u, 'Stationary Artillery'));
ok('the army has a gun and a squad', !!gun && !!squad, st.units.filter((u) => u.side === 'A').map((u) => u.key).join(','));
// a pool of shallow water in the middle of A's strip
st.terrain.push({ kind: 'water', shape: 'rect', x: 10, y: 20, w: 8, h: 8 });
const x = 14, y = 24;
ok('the ground there is shallow water', R.terrainAt(st, x, y) === 'water', R.terrainAt(st, x, y));
ok('a squad may stand in it', !R.barredAt(st, squad, x, y));
ok('a gun may not', R.barredAt(st, gun, x, y));
ok('...and is not barred from dry ground', !R.barredAt(st, gun, 30, 5));
ok('a gun is kept out of it on the move as well', R.terrainBars(gun, 'water') && !R.terrainBars(squad, 'water'));
// unhitched from a tow parked in the water: it comes down on dry ground
const veh = { x: x, y: y, facing: 0, cargo: [gun], name: 'tow', id: 'tow' };
gun.aboard = 'tow'; gun.boarded = false;
const r = R.disembark(st, veh, gun, { x: x + 1, y: y });
ok('unhitched towards the water, the gun is set down clear of it', !!r && R.terrainAt(st, gun.x, gun.y) !== 'water', gun.x.toFixed(1) + ',' + gun.y.toFixed(1) + ' ' + R.terrainAt(st, gun.x, gun.y));
console.log('\n' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
process.exit(fail ? 1 : 0);
