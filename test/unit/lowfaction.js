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

console.log('\nL-29 Two rebel forces choose their tactics in turn, the dice-off winner first (p. 96)');
(function () {
  const firsts = {};
  for (let k = 0; k < 12; k++) {
    const e = game(['rleaders', 'rmilitia', 'rmilitia', 'rdesrifle'], ['rleaders', 'rmilitia', 'rmilitia', 'rciv'], { A: 'laststand', B: null });
    const st = e.state(), ta = st.tacticAsk;
    if (!ta) { ok('two people playing rebels are asked', false); return; }
    const [first, second] = ta.order;
    firsts[first] = (firsts[first] || 0) + 1;
    if (k) continue;
    ok('two people playing rebels are asked, one side first', !!first && first !== second);
    ok('...nothing deploys meanwhile', !e.query.placingSide());
    ok('...the second may not choose before the first', !e.intent(second, { k: 'tactic', tactic: 'guerillas' }).ok);
    ok('the first chooses', e.intent(first, { k: 'tactic', tactic: 'guerillas' }).ok && st.tactics[first] === 'guerillas');
    const mil = st.units.find((u) => u.side === first && u.key === 'rmilitia');
    ok('...and its units take it, Guerillas\u2019 Stealth with it', mil.tactic === 'guerillas' && R.has(mil, 'Stealth'));
    ok('...then the second, knowing it', st.tacticAsk && st.tacticAsk.chosen[first] === 'guerillas' && e.intent(second, { k: 'tactic', tactic: null }).ok);
    ok('...and the set-up goes on', !st.tacticAsk && st.tactics[second] === null && (st.units.every((u) => u.tactic === st.tactics[u.side] || R.has(u, 'No Army Rules'))));
  }
  ok('either side may win the dice', firsts.A > 0 && firsts.B > 0, JSON.stringify(firsts));
  const vsAI = Engine.create({});
  vsAI.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['rleaders', 'rmilitia'], armyB: ['rleaders', 'rmilitia'], nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'sparse', terrainSetup: 'auto', tactics: { A: 'wave', B: null } });
  ok('against the AI nobody is asked', !vsAI.state().tacticAsk);
  const mixed = game(['rleaders', 'rmilitia'], ['regular', 'regular'], { A: 'wave', B: null });
  ok('...nor when only one side is rebel', !mixed.state().tacticAsk);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
