/* A Rapid insertion platform counts for nothing in a rout and, once empty, is
   nothing the AI should waste a shot or a charge on. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 2027;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

const e = Engine.create();
e.start({
  tier: 2, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
  armyA: ['recruits', 'recruits', 'recruits', 'insertplat'], armyB: ['recruits', 'recruits', 'recruits'],
  nameA: 'Alpha', nameB: 'Bravo', colourA: 'ochre', colourB: 'steel'
});
const st = e.state();
const pod = st.units.find(u => u.key === 'insertplat');
const shooter = st.units.find(u => u.side === 'B');
const squad = st.units.find(u => u.side === 'A' && u.key === 'recruits');
// the two pieces side by side, in the open and in easy reach of the shooter
st.units.forEach((u) => { u.reserve = false; u.x = -1; u.y = -1; (u.cargo || []).forEach(c => { c.aboard = null; }); u.cargo = []; });
shooter.x = 20; shooter.y = 20;
pod.x = 30; pod.y = 20;
squad.x = 30; squad.y = 60;

console.log('\nRouting');
ok('a platform counts for no victory condition', !R.countsForVictory(pod));

console.log('\nThe AI and an empty platform');
let pick = e.query.bestTarget(shooter);
ok('an empty platform is never picked as a target', !pick.t || pick.t.id !== pod.id, pick.t ? pick.t.name : 'nothing in reach');
squad.x = 30; squad.y = 24;
pick = e.query.bestTarget(shooter);
ok('...the squad beside it is', pick.t && pick.t.id === squad.id, pick.t ? pick.t.name : 'none');
squad.x = 30; squad.y = 60;
pod.cargo = [squad]; squad.aboard = pod.id; squad.x = -1; squad.y = -1;
pick = e.query.bestTarget(shooter);
ok('...but a platform with a squad still inside is fair game', pick.t && pick.t.id === pod.id, pick.t ? pick.t.name : 'none');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
