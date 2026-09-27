/* A Strafing run ends where the craft could stop: never over a tall building or
   the crown of a stepped hill, which an aircraft cannot hover above (p. 38). */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 38;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

const e = Engine.create();
e.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
  armyA: ['cmd3', 'fsc', 'regular', 'regular'], armyB: ['cmd3', 'regular', 'regular', 'regular'],
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel' });
['A', 'B'].forEach((sd) => { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); });
['A', 'B'].forEach((sd) => e.intent(sd, { k: 'start' }));
const st = e.state();
// a hill with a second step on it, the crown too high to hover over, right in the craft's path
st.terrain = [{ kind: 'hill', x: 24, y: 14, w: 12, h: 12, top: [[27, 17], [33, 17], [33, 23], [27, 23]] }];
const craft = st.units.find((u) => u.key === 'fsc');
st.units.forEach((u, i) => { u.activated = false; if (u !== craft) { u.x = 4 + 4 * i; u.y = u.side === 'A' ? 2 : 46; } });
craft.x = 16; craft.y = 20; st.activeSide = 'A';
ok('the crown of the hill is too high to hover over', R.tooHighToHover(st, 30, 20));
e.intent('A', { k: 'select', id: craft.id });
const r = e.intent('A', { k: 'action', id: 'strafe' });
ok('a strafing run is on', r.ok, r.why);
const ends = e.sel().moves;
const over = ends.filter((c) => R.tooHighToHover(st, c.x, c.y));
ok('it may end on the lower slope', ends.some((c) => R.terrainAt(st, c.x, c.y) === 'hill' && !R.tooHighToHover(st, c.x, c.y)));
ok('...but not over the crown', over.length === 0, over.length + ' of ' + ends.length + ' end points over it');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
