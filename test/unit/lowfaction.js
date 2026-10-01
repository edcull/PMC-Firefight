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
  const mixed = game(['rleaders', 'rmilitia'], ['regular', 'regular'], { A: null, B: null });
  ok('one rebel player alone is asked too, with no dice', !!mixed.state().tacticAsk && mixed.state().tacticAsk.order.join() === 'A');
})();

console.log('\nREB-2 The tactic is chosen once attacker and defender are known, before the terrain (p. 95)');
(function () {
  function takeover(mode, armyB) {
    const e = Engine.create({});
    e.start({ tier: 3, pl: 1, scenario: 'takeover', armyA: ['rleaders', 'rmilitia', 'rmilitia'], armyB: armyB || ['regular', 'regular'],
      nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode, planet: 'sparse', terrainSetup: 'auto' });
    return e;
  }
  const e = takeover('hotseat'), st = e.state();
  ok('the rebel player is asked', !!st.tacticAsk && st.tacticAsk.order.join() === 'A');
  ok('...with the roles already rolled', !!st.cfg.roles && ['A', 'B'].indexOf(st.cfg.roles.attacker) >= 0, JSON.stringify(st.cfg.roles && st.cfg.roles.attacker));
  ok('...and no terrain laid', st.phase === 'tactics' && !st.sc.attacker);
  const n0 = st.units.filter((u) => u.side === 'A').length;
  ok('Human Wave calls up the wave before going on', e.intent('A', { k: 'tactic', tactic: 'wave' }).ok && !!st.tacticAsk && !!st.tacticAsk.wave);
  ok('...only infantry of the Battle Tier', !e.intent('A', { k: 'waveadd', key: 'rleaders' }).ok);
  const inf = R.listFor('rebel').filter((p) => p.cls === 'infantry' && p.tier === 3 && !p.command && !p.noSlot)[0];
  ok('...one added', e.intent('A', { k: 'waveadd', key: inf.key }).ok && st.units.filter((u) => u.side === 'A').length === n0 + 1);
  ok('...and taken back', e.intent('A', { k: 'waveundo' }).ok && st.units.filter((u) => u.side === 'A').length === n0);
  ok('...two, the most at PL 1', e.intent('A', { k: 'waveadd', key: inf.key }).ok && e.intent('A', { k: 'waveadd', key: inf.key }).ok &&
    !e.intent('A', { k: 'waveadd', key: inf.key }).ok);
  ok('...then on to the table', e.intent('A', { k: 'wavedone' }).ok && !st.tacticAsk && st.sc.attacker === st.cfg.roles.attacker);
  const keys = st.cfg.armyA;
  ok('the list with its wave is legal under Human Wave', R.checkArmy(keys, 3, 1, [], 'wave', 'rebel').ok, R.checkArmy(keys, 3, 1, [], 'wave', 'rebel').faults.join('; '));
  ok('...and every unit of it fights under the tactic', st.units.filter((u) => u.side === 'A').every((u) => u.tactic === 'wave'));
  // the AI chooses by its role: Last Stand to hold, Human Wave (and its wave) to take
  const seen = {};
  for (let k = 0; k < 10; k++) {
    const ai = takeover('ai', ['rleaders', 'rmilitia', 'rmilitia']), as = ai.state();
    const role = as.cfg.roles.attacker === 'B' ? 'attacker' : 'defender';
    seen[role + ':' + as.tactics.B + ':' + as.units.filter((u) => u.side === 'B' && u.waveExtra).length] = 1;
  }
  const keysSeen = Object.keys(seen);
  ok('the AI defending takes Last Stand; attacking, Human Wave with its wave', keysSeen.every((k) => k === 'defender:laststand:0' || k === 'attacker:wave:2'), keysSeen.join(' '));
})();

console.log('\nBUG-1 Strong Nervous System is the Bug player\u2019s to call, before anyone flees (p. 124)');
(function () {
  function swarm() {
    const e = Engine.create({});
    e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: R.rollArmy(3, 1, null, 'bugs'), armyB: ['regular', 'regular'],
      nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto',
      doctrines: { A: ['BP3'], B: [] } });
    const st = e.state();
    st.phase = 'battle'; st.turn = 2; st.terrain.length = 0;
    st.units.forEach((u, i) => { u.reserve = false; u.aboard = null; u.sp = 0; u.x = u.side === 'A' ? 10 + (i % 5) * 4 : 40; u.y = 10 + Math.floor(i / 5) * 4 + (u.side === 'B' ? i * 3 : 0); });
    return { e, st };
  }
  const { e, st } = swarm();
  const bugs = st.units.filter((u) => u.side === 'A' && !R.isMachine(u));
  const brk = bugs[0], shaken = bugs[1];
  brk.sp = 2 * R.currentMorale(brk) + 1; shaken.sp = 1;
  const at = { x: brk.x, y: brk.y };
  e.query.rallyPhase();
  ok('a Bug player is asked at the start of the Rally phase', !!st.nervousAsk && st.nervousAsk.side === 'A' && st.nervousAsk.broken === 1);
  ok('...before the Broken unit flees', brk.x === at.x && brk.y === at.y);
  ok('...and the other side cannot answer', !e.intent('B', { k: 'nervous' }).ok);
  ok('steadied, every Suppression point on the swarm is gone', e.intent('A', { k: 'nervous' }).ok && brk.sp === 0 && shaken.sp === 0 && !st.nervousAsk);
  ok('...so the Broken unit never ran', brk.alive && brk.x === at.x && brk.y === at.y);
  shaken.sp = 2;
  st.nervousAsk = null;
  e.query.rallyPhase();
  ok('once a battle: the next Rally phase does not ask again', !st.nervousAsk);
  const two = swarm();
  const b2 = two.st.units.find((u) => u.side === 'A' && !R.isMachine(u));
  b2.sp = 1;
  two.e.query.rallyPhase();
  ok('kept for later, nothing is cleared', two.e.intent('A', { k: 'nonervous' }).ok && !two.st.nervous.A);
  b2.sp = 1;
  two.e.query.rallyPhase();
  ok('...and it is offered again the next Rally phase', !!two.st.nervousAsk);
})();

console.log('\nXEN-1 Know Your Foe! holds back every enemy reinforcement, decided at the start of the turn (p. 141)');
(function () {
  function invasion() {
    const e = Engine.create({});
    e.start({ tier: 3, pl: 1, scenario: 'invasion', attacker: 'B', armyA: ['regular', 'regular'], armyB: ['regular', 'regular', 'regular', 'regular'],
      nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'sparse', terrainSetup: 'auto',
      doctrines: { A: ['XO6'], B: [] } });
    const st = e.state();
    st.phase = 'battle'; st.turn = 8; st.initiative = 'A';
    st.objectives = st.objectives.length ? st.objectives : [{ x: 24, y: 24, r: 4, lz: true }];
    // two of the attacker's units still to come down in the second wave, which is certain by turn 8
    const atk = st.units.filter((u) => u.side === 'B');
    atk.forEach((u, i) => { if (i < 2) { u.reserve = false; u.x = 20 + i * 3; u.y = 20; } else { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; } });
    st.units.filter((u) => u.side === 'A').forEach((u, i) => { u.reserve = false; u.x = 10 + i * 3; u.y = 40; });
    return { e, st, wave: atk.slice(2) };
  }
  const { e, st, wave } = invasion();
  let finished = false;
  e.query.reservePhase(() => { finished = true; });
  ok('asked before anything arrives, with no Battlefield Insertion unit in sight', !!st.kyfAsk && st.kyfAsk.side === 'A' && st.kyfAsk.n === 2 && wave.every((u) => u.reserve));
  ok('...and the other side cannot answer', !e.intent('B', { k: 'kyf' }).ok);
  e.intent('A', { k: 'kyf' });
  ok('used, the second wave does not come down this turn', wave.every((u) => u.reserve && u.x < 0), wave.map((u) => u.reserve ? 'held' : 'down').join(','));
  ok('...and the turn goes on', finished && !st.kyfAsk);
  st.turn = 9;
  e.query.reservePhase(() => {});
  ok('once a battle: next turn it is not asked, and the wave lands', !st.kyfAsk && wave.every((u) => !u.reserve), wave.map((u) => u.reserve ? 'held' : 'down').join(','));
  const two = invasion();
  two.e.query.reservePhase(() => {});
  two.e.intent('A', { k: 'nokyf' });
  ok('kept for later, the wave comes down as normal', two.wave.every((u) => !u.reserve) && !two.st.kyf.A);
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

console.log('\nL-34 A Psychic Wave passes the machines by (pp. 35, 116)');
(function () {
  let n = 0;
  const mk = (key, side, x, y) => Object.assign(JSON.parse(JSON.stringify(R.profile(key))), { id: side + (n++), side, x, y, alive: true,
    models: R.profile(key).size, sp: 0, damage: 0, shotFrom: [], cargo: [], facing: 0, label: key });
  const bug = mk(R.listFor('bugs').find((p) => (p.rules || []).includes('Psychic Wave')).key, 'A', 10, 10);
  const squad = mk('regular', 'B', 16, 10), hull = mk('lcv', 'B', 10, 16);
  const res = R.psychicWave({ units: [bug, squad, hull], terrain: [], objectives: [], log: [] }, bug);
  ok('the squad is caught in it, the hull is not', res.hit.indexOf(squad) >= 0 && res.hit.indexOf(hull) < 0 &&
    !res.log.some((l) => (l.text || '').indexOf(hull.label) === 0));
})();

console.log('\nL-35 An Assault of "-" charges nobody (p. 123)');
(function () {
  let n = 0;
  const mk = (key, side, x, y) => Object.assign(JSON.parse(JSON.stringify(R.profile(key))), { id: side + (n++), side, x, y, alive: true,
    models: R.profile(key).size, sp: 0, damage: 0, shotFrom: [], cargo: [], facing: 0, label: key });
  const carrier = mk('bcarrier', 'A', 10, 10), squad = mk('regular', 'B', 13, 10);
  ok('the Carrier bug cannot charge', !R.canAssault(carrier, squad));
  const brood = mk(R.listFor('bugs').find((p) => (p.rules || []).includes('Overgrown Bug') && p.assault > 0 && p.cls !== 'aircraft').key, 'A', 10, 10);
  ok('...another Overgrown bug still can', R.canAssault(brood, squad), brood.key);
})();

console.log('\nL-36 A Psychic Wave goes out from a building too (p. 116)');
(function () {
  const waver = R.listFor('bugs').find((p) => (p.rules || []).includes('Psychic Wave') && p.cls === 'infantry');
  const e = game([waver.key, 'bwatchlarva'], ['regular'], null);
  const st = e.state();
  st.phase = 'battle'; st.turn = 1; st.phaseCount = 1; st.activeSide = 'A'; st.chain = null; st.streak = 9;
  st.terrain.length = 0;
  const bld = { kind: 'building', x: 18, y: 18, w: 4, h: 4 };
  st.terrain.push(bld);
  const u = st.units.find((x) => x.key === waver.key), foe = st.units.find((x) => x.side === 'B');
  st.units.forEach((x, i) => { x.reserve = false; x.aboard = null; x.activated = false; x.x = 6 + i; x.y = 6 + i * 3; });
  R.enterBuilding(st, u, bld, 0);
  foe.x = 28; foe.y = 20; foe.sp = 0;
  e.intent('A', { k: 'select', id: u.id });
  ok('a garrison is offered the wave', e.query.actionState(u, 'wave').on, e.query.actionState(u, 'wave').hint);
  const r = e.intent('A', { k: 'action', id: 'wave' });
  ok('...with no move: only where it stands', r.ok && e.sel().moves.length === 1);
  const spot = e.sel().moves[0];
  ok('...and sends it out, staying inside', e.intent('A', { k: 'wave', x: spot.x, y: spot.y }).ok && u.bld === bld && u.activated);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
