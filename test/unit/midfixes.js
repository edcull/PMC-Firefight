/* Medium findings of the rules review at 7dd7306: nobody hacks or marks a unit
   that is not on the table (M-12, L-14); a call fetches no turret out of its
   turn (M-13); shooting a wall down is still shooting (M-11); and the Riders
   upgrade is final once chosen (M-16). */
'use strict';
const { R, Engine, C } = require('../../server/rules.js');
let seed = 13;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// a hotseat battle on an empty table with everything placed, A to act
function battle(armyA, armyB) {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA, armyB, nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  let g = 0;
  while (e.state().phase === 'deploy' && g++ < 200) { const side = e.query.placingSide(); if (!side) break; e.intent(side, { k: 'autodeploy' }); }
  e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
  e.intent('A', { k: 'start' });
  for (g = 0; g < 60 && e.state().phase !== 'battle'; g++) e.intent(e.state().activeSide || 'A', { k: 'start' });
  const st = e.state();
  st.terrain.length = 0;
  st.units.forEach((u, i) => {
    u.reserve = false; u.aboard = null; u.x = u.side === 'A' ? 8 : 30; u.y = 6 + i * 3;
    u.activated = false; u.sp = 0; u.cargo = u.cargo || []; u.facing = 0;
  });
  st.activeSide = 'A'; st.chain = null; st.streak = 9;
  return { e, st };
}

console.log('\nNobody hacks or marks what is not on the table (p. 58)');
(function () {
  const { e, st } = battle(['ew', 'regular'], ['dcombat', 'regular']);
  const ew = st.units.find((u) => u.key === 'ew'), dr = st.units.find((u) => u.key === 'dcombat');
  ew.x = 6; ew.y = 6; dr.x = 20; dr.y = 6;
  ok('a drone on the table within 24" can be hacked', R.canHack(st, ew, dr));
  dr.reserve = true; dr.x = -1; dr.y = -1;
  ok('...one held in reserve cannot', !R.canHack(st, ew, dr));
  void e;
})();
(function () {
  const { e, st } = battle(['snipers', 'regular'], ['regular', 'regular']);
  const sn = st.units.find((u) => u.key === 'snipers');
  const [f1, f2] = st.units.filter((u) => u.side === 'B');
  sn.x = 6; sn.y = 6; f1.x = 20; f1.y = 6; f2.reserve = true; f2.x = -1; f2.y = -1;
  const ts = e.query.markTargets(sn);
  ok('a Markerlight picks the enemy on the table', ts.indexOf(f1) >= 0);
  ok('...and never the one in reserve', ts.indexOf(f2) < 0);
})();

console.log('\nA call fetches no turret out of its turn (p. 130)');
(function () {
  const { e, st } = battle(['xbeta3', 'xdturret2', 'xgamma3'], ['regular', 'regular']);
  const beta = st.units.find((u) => u.key === 'xbeta3');
  const foe = st.units.find((u) => u.side === 'B');
  beta.x = 14; beta.y = 20; foe.x = 26; foe.y = 20;
  st.units.filter((u) => u.side === 'A' && u !== beta).forEach((u, i) => { u.x = 4; u.y = 8 + i * 4; });
  const turrets = st.units.filter((u) => u.side === 'A' && R.has(u, 'Turret'));
  ok('the turrets are on the table and in range', turrets.length >= 2 && turrets.every((t) => R.unitDist(t, foe) <= t.range));
  e.intent('A', { k: 'select', id: beta.id });
  const a1 = e.intent('A', { k: 'action', id: 'designate' });
  const a2 = a1.ok ? e.intent('A', { k: 'target', id: foe.id }) : a1;
  ok('the Beta designates the squad', a1.ok && a2.ok, a2.why || '');
  const answer = e.query.eligible('A');
  ok('...and no turret may answer the call', answer.length > 0 && answer.every((u) => !R.has(u, 'Turret')),
    answer.map((u) => u.name).join(', '));
})();

console.log('\nShooting a wall down is shooting (pp. 57-58)');
(function () {
  const { e, st } = battle(['gausscannon', 'regular'], ['regular']);
  const gc = st.units.find((u) => u.key === 'gausscannon');
  gc.x = 10; gc.y = 20; gc.facing = 0;
  st.terrain.push({ kind: 'building', x: 18, y: 18, w: 4, h: 4 });
  ok('a Gauss cannon may shoot at a building in range and sight', e.query.demolishTargets(gc, false).length === 1);
  gc.disembarked = true;
  ok('...but not on the turn it was unloaded (Cumbersome)', e.query.demolishTargets(gc, false).length === 0);
})();
(function () {
  const { e, st } = battle(['mortarteam', 'regular'], ['regular']);
  const mt = st.units.find((u) => u.key === 'mortarteam');
  mt.x = 6; mt.y = 20;
  st.terrain.push({ kind: 'building', x: 24, y: 18, w: 4, h: 4 });
  ok('a mortar team may shoot at a building it can see', e.query.demolishTargets(mt, false).length === 1);
  st.terrain.push({ kind: 'wall', reinforced: true, x: 14, y: 12, w: 0.6, h: 18 });
  ok('...but not at one it cannot: nobody calls a wall in for Indirect Fire', e.query.demolishTargets(mt, false).length === 0);
})();

console.log('\nThe Riders upgrade is chosen on recruiting, and final (p. 97; review a119ac2 REB-4)');
(function () {
  const co = C.newCompany('Red Dawn', { faction: 'rebel' });
  co.kUC = 100;
  const r = C.recruit(co, 'rfanatics', { riders: true });
  ok('a squad may be recruited as Riders', r.ok && r.entry.riders);
  ok('...and nothing else changes it: there is no toggle left', C.ridersOpen === undefined);
})();

console.log('\nA hull may turn where it stands at the end of its move (p. 35)');
(function () {
  const { e, st } = battle(['lcv', 'regular'], ['regular']);
  const v = st.units.find((u) => u.key === 'lcv');
  v.x = 10; v.y = 24; v.facing = 0;
  e.intent('A', { k: 'select', id: v.id }); e.intent('A', { k: 'action', id: 'move' });
  const spot = e.sel().moves.filter((c) => Math.abs(c.y - 24) < 0.01 && Math.abs(c.x - 12) < 0.01)[0];
  ok('it drives 2" ahead', !!spot && e.intent('A', { k: 'move', x: spot.x, y: spot.y }).ok);
  const fa = st.faceAsk;
  ok('...and is asked which way it ends facing, with most of its move in hand', !!fa && !!fa.pivot && fa.pivot.left > 8,
    fa && fa.pivot ? fa.pivot.left.toFixed(1) + '" left' : 'not asked');
  ok('...turns to face north for its turn cost', e.intent('A', { k: 'vface', dir: -Math.PI / 2 }).ok && Math.abs(R.angleWrap(v.facing + Math.PI / 2)) < 0.01);
  ok('...and its activation is over', v.activated && !st.faceAsk);
})();
(function () {
  const { e, st } = battle(['lcv', 'regular'], ['regular']);
  const v = st.units.find((u) => u.key === 'lcv');
  v.x = 6; v.y = 24; v.facing = 0;
  e.intent('A', { k: 'select', id: v.id }); e.intent('A', { k: 'action', id: 'move' });
  // as far as it can go straight ahead, with 1" or so left over
  const ahead = e.sel().moves.filter((c) => Math.abs(c.y - 24) < 0.01 && c.x > 6).sort((a, b) => b.x - a.x);
  const spot = ahead.find((c) => (v.move + 4) - c.spent >= v.turn && (v.move + 4) - c.spent < 2 * v.turn);
  ok('a long drive leaves too little to turn far', !!spot && e.intent('A', { k: 'move', x: spot.x, y: spot.y }).ok && !!st.faceAsk);
  ok('...so turning about is refused', !e.intent('A', { k: 'vface', dir: Math.PI }).ok);
  ok('...but a quarter turn is not', e.intent('A', { k: 'vface', dir: Math.PI / 2 }).ok);
})();
(function () {
  const { e, st } = battle(['lcv', 'regular'], ['regular']);
  const v = st.units.find((u) => u.key === 'lcv');
  v.x = 6; v.y = 24; v.facing = 0;
  e.intent('A', { k: 'select', id: v.id }); e.intent('A', { k: 'action', id: 'move' });
  const last = e.sel().moves.filter((c) => Math.abs(c.y - 24) < 0.01 && c.x > 6 && (v.move + 4) - c.spent < v.turn - 1e-6)[0];
  ok('with nothing left to turn with, it is not asked', !!last && e.intent('A', { k: 'move', x: last.x, y: last.y }).ok && !st.faceAsk && v.activated);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
