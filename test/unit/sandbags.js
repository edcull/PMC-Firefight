/* A dug-in gun's sandbags (p. 94): a short linear obstacle across its front.
   Like a low wall they shelter it from direct fire coming over them — from the
   front — and from plunging fire from any side, but not from a shot in the
   flank or rear. The gun cannot be turned once dug in. Under Last Stand the
   sandbags, being terrain with a Defence bonus, give the crew +4. */
'use strict';
const { R, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

const e = Engine.create({});
e.start({ tier: 4, pl: 2, scenario: 'secure', armyA: ['rmedart', 'rinsurgents'], armyB: ['regular', 'mortarteam'],
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
for (let g = 0; g < 4 && e.state().swapAsk; g++) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
for (let g = 0; g < 20 && e.state().phase === 'deploy'; g++) {
  e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
  e.intent('A', { k: 'start' }); e.intent('B', { k: 'start' });
}
const s = e.state();
s.terrain = [];
const gun = s.units.find(u => u.key === 'rmedart'), rifles = s.units.find(u => u.key === 'regular'), mortar = s.units.find(u => u.key === 'mortarteam');
gun.x = 20; gun.y = 20; gun.facing = 0; gun.dugIn = true;       // dug in facing +x
const at = (u, x, y) => { u.x = x; u.y = y; };

console.log('\nSandbags');
at(rifles, 32, 21);
ok('direct fire from the front: +2', R.coverFor(s, rifles, gun).v === 2, R.coverFor(s, rifles, gun).why);
at(rifles, 20, 34);
ok('from the flank: nothing', R.coverFor(s, rifles, gun).v === 0);
at(rifles, 8, 20);
ok('from behind: nothing', R.coverFor(s, rifles, gun).v === 0);
at(mortar, 8, 22);
ok('plunging fire from behind: +2', R.coverFor(s, mortar, gun).v === 2, R.coverFor(s, mortar, gun).why);
gun.dugIn = false;
at(rifles, 32, 21);
ok('not dug in: no sandbags', R.coverFor(s, rifles, gun).v === 0);

console.log('\nA dug-in gun is not turned');
gun.dugIn = true; gun.facing = 0;
at(rifles, 30, 26);
R.shoot(s, gun, rifles, 'fire', {});
const brg = Math.atan2(6, 10);
ok('it keeps the facing it dug in with', gun.facing === 0, String(gun.facing));
ok('...and traverses its barrel onto the target', Math.abs(gun.aim - brg) < 1e-6);
gun.dugIn = false;
R.shoot(s, gun, rifles, 'fire', {});
ok('one on its trails turns its carriage to the nearest facing', Math.abs(gun.facing - R.nearestFacing(brg)) < 1e-9 && gun.facing !== 0,
  gun.facing.toFixed(3) + ' for a bearing of ' + brg.toFixed(3));
ok('...and lays its barrel exactly on the target', Math.abs(gun.aim - brg) < 1e-6);

console.log('\nLast Stand');
gun.tactic = 'laststand'; gun.dugIn = true; gun.facing = 0;
at(rifles, 32, 21);
ok('Last Stand makes the sandbags +4 for the gun crew', R.coverFor(s, rifles, gun).v === 4, R.coverFor(s, rifles, gun).why);
at(rifles, 20, 34);
ok('...but still nothing in the flank', R.coverFor(s, rifles, gun).v === 0);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
if (fail) process.exit(1);
