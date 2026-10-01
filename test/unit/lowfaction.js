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

console.log('\nL-30 Teleport takes a unit in by the standard embarking rules (pp. 36, 130)');
(function () {
  let n = 0;
  const mk = (key, x, y, extra) => Object.assign(JSON.parse(JSON.stringify(R.profile(key))), { id: 'A' + (n++), side: 'A', x, y, alive: true,
    models: R.profile(key).size, sp: 0, shotFrom: [], cargo: [], facing: 0, label: key }, extra || {});
  const tp = mk('xtturret2', 10, 10), tp2 = mk('xtturret2', 30, 30);
  const acted = mk('xeps1', 12, 10, { activated: true, sp: 1 });
  const bld = { kind: 'building', x: 6, y: 12, w: 4, h: 4 };
  const garrison = mk('xeps1', 8, 14, { bld: bld, sec: 0 });
  const st = { units: [tp, tp2, acted, garrison], terrain: [bld], objectives: [], log: [], doctrines: { A: [], B: [] } };
  const from = R.teleportFrom(st, tp);
  ok('a squad that has already acted may still be taken in', from.indexOf(acted) >= 0);
  ok('...a garrison may not, until it comes out', from.indexOf(garrison) < 0);
  const res = R.teleport(st, acted, tp, tp2);
  ok('...and it comes out with no Suppression', res.ok && acted.sp === 0, acted.sp + ' SP');
})();

console.log('\nL-31 A Xenotripod Markerlight marks what the tribe sees (p. 129)');
(function () {
  const e = game(['xalpha3', 'xbeta3', 'xgamma3'], ['regular'], null);
  const st = e.state();
  st.terrain.length = 0;
  const beta = st.units.find((u) => u.key === 'xbeta3'), spot = st.units.find((u) => u.key === 'xgamma3');
  const alpha = st.units.find((u) => u.key === 'xalpha3'), foe = st.units.find((u) => u.side === 'B');
  st.units.forEach((u) => { u.reserve = false; u.aboard = null; });
  beta.x = 6; beta.y = 24; alpha.x = 4; alpha.y = 4; foe.x = 26; foe.y = 24; spot.x = 6; spot.y = 44;
  ok('beyond its own 12" sight, with nobody else looking, it cannot mark', e.query.markTargets(beta).indexOf(foe) < 0);
  spot.x = 20; spot.y = 30;
  ok('...with a squad of the tribe in sight of the enemy, it can', e.query.markTargets(beta).indexOf(foe) >= 0);
})();

console.log('\nL-32 Psychic Bond lends no Morale from a Suppressed or Broken friend (pp. 29, 129)');
(function () {
  let n = 0;
  const mk = (key, x, y, extra) => Object.assign(JSON.parse(JSON.stringify(R.profile(key))), { id: 'A' + (n++), side: 'A', faction: 'xeno', x, y, alive: true,
    models: R.profile(key).size, sp: 0, shotFrom: [], cargo: [], facing: 0, label: key }, extra || {});
  const low = mk('xdelta1', 10, 10), high = mk('xalpha3', 13, 10);
  const st = { units: [low, high], terrain: [], objectives: [], log: [], doctrines: { A: [], B: [] } };
  const lent = R.bondMorale(st, low);
  ok('a steady friend within 6" lends its Morale', !!lent && lent.from === high, lent ? lent.m + '' : 'none');
  high.sp = R.currentMorale(high) + 1;
  ok('...a Suppressed one does not', !R.bondMorale(st, low));
})();

console.log('\nL-33 In a co-op game, a player\u2019s turrets still act as one (p. 130)');
(function () {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 2, scenario: 's_crush', armyA: ['xbeta3', 'xdturret2', 'xgamma3', 'xalpha3'], ownersA: [1, 1, 2, 2],
    armyB: ['regular', 'regular', 'regular'], nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse',
    terrainSetup: 'auto', solo: { coop: true, faction: 'xeno', opFaction: 'pmc', names: ['P1', 'P2'] } });
  const st = e.state();
  st.phase = 'battle'; st.turn = 1; st.phaseCount = 1; st.activeSide = 'A'; st.activeOwner = 1; st.chain = null;
  st.units.forEach((u, i) => { u.reserve = false; u.aboard = null; u.activated = false; u.x = u.side === 'A' ? 6 + i * 3 : 40; u.y = 10 + i * 4; u.wave = 0; });
  const turrets = st.units.filter((u) => u.side === 'A' && R.has(u, 'Turret'));
  turrets.forEach((t) => { t.owner = 1; });
  ok('the first player has two turrets', turrets.length === 2);
  e.intent('A', { k: 'select', id: turrets[0].id });
  ok('one turret acts', e.intent('A', { k: 'action', id: 'skip' }).ok && turrets[0].activated);
  const next = e.query.eligible('A');
  ok('...and the other is the only one that may go next', next.length === 1 && next[0] === turrets[1], next.map((u) => u.name).join(', '));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
