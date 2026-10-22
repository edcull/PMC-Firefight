/* The allies' orders in a story battle (src/engine/storybattle.js, ai.js): one
   marker the player puts down — Move here, Attack here, Hold here — moved at
   most once a turn, and the allies' AI answering it. The battle is Landfall
   with the port's men taken on; only the allies act, as the AI runs them. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];

/* Landfall with the port's men, at turn 1, side A to act: the player's own
   units spent, so every activation left is the allies'. */
function battle() {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'deep-contract');
  S.proceed(c); S.choose(c, 'take');
  const spec = S.battleSpec(c);
  const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: spec.scenario });
  const cfg = L.toCfg(c, { picks, role: 'A' });
  cfg.mode = 'ai';
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 6 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  const st = e.state();
  st.activeSide = 'A';
  st.units.forEach((u) => { if (u.side === 'A') { u.activated = !u.ally; u.reserve = false; u.aboard = false; } });
  return { e, st, allies: st.units.filter((u) => u.ally && u.alive) };
}
// every ally takes its activation, as the AI runs it
function allTheAllies(e, allies) {
  for (let i = 0; i < 20 && allies.some((u) => u.alive && !u.activated); i++) e.sim.steps(1);
}
const near = (u, p) => R.inches(u.x, u.y, p.x, p.y);
const centre = (us) => ({ x: us.reduce((s, u) => s + u.x, 0) / us.length, y: us.reduce((s, u) => s + u.y, 0) / us.length });

console.log('\nGiving the order');
let { e, st, allies } = battle();
ok('the battle has allies, at the start of side A’s turn', allies.length >= 2 && st.phase === 'battle' && !st.allyOrder);
e.intent('B', { k: 'allyorder', kind: 'move', x: 24, y: 24 });
ok('the enemy cannot order them', !st.allyOrder);
e.intent('A', { k: 'allyorder', kind: 'charge', x: 24, y: 24 });
ok('only Move, Attack and Hold are orders', !st.allyOrder);
e.intent('A', { k: 'allyorder', kind: 'move', x: -3, y: 24 });
ok('the marker goes on the table', !st.allyOrder);
const from = centre(allies), to = { x: Math.min(R.BOARD.w - 6, from.x + 20), y: from.y };
e.intent('A', { k: 'allyorder', kind: 'move', x: to.x, y: to.y });
ok('Move here: one marker, on the battle, in the log', st.allyOrder && st.allyOrder.kind === 'move' && st.allyOrder.x === to.x && st.log.some((l) => /allies’ orders: move here/.test(l.text || '')));
e.intent('A', { k: 'allyorder', kind: 'hold', x: to.x, y: to.y });
ok('...and until an ally acts on it, it can be put right', st.allyOrder.kind === 'hold');
e.intent('A', { k: 'allyorder', kind: 'move', x: to.x, y: to.y });

console.log('\nMove here');
const before = allies.map((u) => near(u, to));
const shotsBefore = st.log.filter((l) => /\[C\]|fires/.test(l.text || '') && allies.some((u) => (l.text || '').indexOf(u.label) === 0)).length;
allTheAllies(e, allies);
const after = allies.map((u) => near(u, to));
ok('every ally acted under the order', allies.every((u) => u.activated) && st.log.some((l) => /under orders: move here, on its way/.test(l.text || '')));
ok('...each nearer the marker by more than its Movement: a Move, at the double',
  allies.every((u, i) => !u.alive || before[i] - after[i] > u.move), before.map((b, i) => b.toFixed(1) + '\u2192' + after[i].toFixed(1)).join(' '));
ok('...without stopping to shoot', st.log.filter((l) => /fires|Fire!/.test(l.text || '') && allies.some((u) => (l.text || '').indexOf(u.label) >= 0)).length === shotsBefore);
e.intent('A', { k: 'allyorder', kind: 'hold', x: from.x, y: from.y });
ok('once they have acted on it, the order stands for the turn', st.allyOrder.kind === 'move');
st.turn++;
e.intent('A', { k: 'allyorder', kind: 'hold', x: to.x, y: to.y });
ok('the next turn it can be moved again', st.allyOrder.kind === 'hold' && st.allyOrder.turn === st.turn && !st.allyOrder.acted);

console.log('\nHold here');
({ e, st, allies } = battle());
const hold = centre(allies), held0 = allies.map((u) => near(u, hold)), holdAt = st.log.length;
e.intent('A', { k: 'allyorder', kind: 'hold', x: hold.x, y: hold.y });
allTheAllies(e, allies);
ok('Hold here: each ally ends at the marker, or nearer it', allies.every((u, i) => !u.alive || near(u, hold) <= Math.max(4.5, held0[i] - 1)),
  held0.map((h, i) => h.toFixed(1) + '\u2192' + near(allies[i], hold).toFixed(1)).join(' '));
ok('...carefully: Reasonably Defensive, there or on its way', st.log.slice(holdAt).some((l) => /under orders: hold here, (there|on its way): defensive/.test(l.text || '')));

console.log('\nAttack here');
({ e, st, allies } = battle());
const foe = st.units.filter((u) => u.side === 'B' && u.alive && u.x >= 0).sort((a, b) => near(a, centre(allies)) - near(b, centre(allies)))[0];
const gap0 = allies.map((u) => near(u, foe));
e.intent('A', { k: 'allyorder', kind: 'attack', x: foe.x, y: foe.y });
allTheAllies(e, allies);
ok('Attack here: they go for the enemy at the marker', allies.every((u, i) => !u.alive || near(u, foe) < gap0[i] || u.activated && st.log.some((l) => (l.text || '').indexOf(u.label) >= 0 && /fires|assault|charges/i.test(l.text || ''))),
  gap0.map((g, i) => g.toFixed(1) + '→' + near(allies[i], foe).toFixed(1)).join(' '));
ok('...pressing on (Reasonably Offensive) while they are on their way', st.log.some((l) => /under orders: attack here, on its way: (offensive|assault)/.test(l.text || '')));

console.log('\nWithdrawn, and kept');
e.intent('A', { k: 'allyorder', kind: 'hold', x: 10, y: 10 });
ok('an order already acted on this turn cannot be withdrawn either', st.allyOrder.kind === 'attack');
st.turn++;
e.intent('A', { k: 'allyorder', kind: null });
ok('the next turn, it can be withdrawn: the allies are left to their own judgement', st.allyOrder === null);
e.intent('A', { k: 'allyorder', kind: 'hold', x: 12, y: 30 });
const snap = JSON.parse(JSON.stringify(e.snapshot()));
ok('the order is plain data on the battle, kept by a save', snap.allyOrder && snap.allyOrder.kind === 'hold' && snap.allyOrder.x === 12);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
