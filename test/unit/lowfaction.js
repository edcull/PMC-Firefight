/* The Low findings on the faction rules (the rules review at 7dd7306,
   L-28 to L-37), taken one at a time. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 61;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function game(armyA, armyB, tactics) {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA, armyB, nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto', tactics: tactics || { A: null, B: null } });
  return e;
}

console.log('\nL-28 Deserters and POWs follow no army rule, a tactic included (p. 103)');
(function () {
  const rebels = ['rleaders', 'rmilitia', 'rdesrifle', 'rpow'];
  ['laststand', 'guerillas', 'wave'].forEach((tac) => {
    const st = game(rebels, ['regular'], { A: tac, B: null }).state();
    const mil = st.units.find((u) => u.key === 'rmilitia'), des = st.units.find((u) => u.key === 'rdesrifle'), pow = st.units.find((u) => u.key === 'rpow');
    ok(tac + ': the militia take it, the deserters and POWs do not', mil.tactic === tac && des.tactic === null && pow.tactic === null);
  });
  const st = game(rebels, ['regular'], { A: 'guerillas', B: null }).state();
  const des = st.units.find((u) => u.key === 'rdesrifle');
  ok('...so no Guerillas’ Stealth or Battlefield Insertion for the deserters', !R.has(des, 'Stealth') && !R.has(des, 'Battlefield Insertion'));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
