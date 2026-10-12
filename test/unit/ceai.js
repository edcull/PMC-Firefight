/* The AI inside a compound (Close Encounters, Appendix 1): the special equipment
   it carries in (p. 159) — Incendiary Grenades into a section full of the enemy
   and none of its own, Vacuum Charges on a fire it stands in, a Ballistic Barrier
   when it is shot at with nothing to answer — and Covering Fire! from a friend
   before it charges (p. 158). */
'use strict';
const { R, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function dice(v, fn) { const was = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = was; } }

/* A battle at its first Action phase on a table of our own: a corridor along the
   top (y 21-24), and a room below it (x 15-24, y 24-33). Side A is the computer's. */
function stage(armyA, armyB, kitA) {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'ce_clear', armyA, armyB, nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' });
  for (let g = 0; g < 400; g++) {
    const s = e.state();
    if (s.phase === 'battle' && s.phaseCount) break;
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    e.intent(s.activeSide || 'A', { k: 'step' });
  }
  const st = e.state();
  st.cfg.aiSides = ['A'];
  st.terrain = [
    { kind: 'corridor', x: 0, y: 21, w: 36, h: 3, axis: 'h', name: 'Corridor 1' }, { kind: 'room', x: 15, y: 24, w: 9, h: 9, name: 'Room 1' },
    { kind: 'bulkhead', x: 0, y: 0, w: 48, h: 21 }, { kind: 'bulkhead', x: 36, y: 21, w: 12, h: 3 },
    { kind: 'bulkhead', x: 0, y: 24, w: 15, h: 24 }, { kind: 'bulkhead', x: 24, y: 24, w: 24, h: 24 }, { kind: 'bulkhead', x: 15, y: 33, w: 9, h: 15 }
  ];
  st.compound = { cell: 3, cols: 16, rows: 16, entries: { L: [], R: [] } };
  st.units.forEach((u) => { u.x = -1; u.y = -1; u.reserve = true; u.activated = false; u.sp = 0; u.hidden = false; });
  st.kit = { A: kitA || {}, B: {} };
  st.activeSide = 'A';
  return { e, st, corridor: st.terrain[0], room: st.terrain[1] };
}
function put(u, x, y) { u.x = x; u.y = y; u.reserve = false; u.hidden = false; u.activated = false; }
const text = (st) => st.log.map((l) => l.text).join('\n');

console.log('\nIncendiary Grenades');
{
  const { e, st, room } = stage(['regular'], ['regular', 'regular'], { incendiary: 1 });
  const a = st.units.find((u) => u.side === 'A'), [b1, b2] = st.units.filter((u) => u.side === 'B');
  put(a, 12.5, 22.5); put(b1, 18, 29); put(b2, 21.5, 31);
  dice(0.5, () => e.query.aiAct(a));
  ok('two of the enemy in a room within 6", none of its own: the AI sets it alight', room.burning && st.kit.A.incendiary === 0 && a.activated, (text(st).match(/[^\n]*(Incendiary|burn)[^\n]*/g) || []).join(' | '));
}
{
  const { e, st, room } = stage(['regular', 'regular'], ['regular', 'regular'], { incendiary: 1 });
  const [a, h] = st.units.filter((u) => u.side === 'A'), [b1, b2] = st.units.filter((u) => u.side === 'B');
  put(a, 12.5, 22.5); put(h, 16.5, 25.5); put(b1, 18, 29); put(b2, 21.5, 31);
  h.activated = true;
  dice(0.5, () => e.query.aiAct(a));
  ok('...but never one a friend of its own stands in', !room.burning && st.kit.A.incendiary === 1);
}

console.log('\nVacuum Charges');
{
  const { e, st, room } = stage(['regular'], ['regular'], { vacuum: 1 });
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 19.5, 28); put(b, 4, 22.5);
  dice(0.5, () => e.query.setBurning(room));
  ok('(the room is alight)', room.burning);
  dice(0.5, () => e.query.aiAct(a));
  ok('standing in a fire, the AI smothers it', !room.burning && st.kit.A.vacuum === 0 && a.activated);
}

console.log('\nBallistic Barrier');
{
  const { e, st, corridor } = stage(['regular'], ['hmgteam'], { barrier: 1 });
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 4, 22.5); put(b, 28, 22.5);
  a.facing = 0; b.facing = Math.PI;
  const n0 = st.terrain.length;
  ok('(the heavy machine gun reaches it; its own rifles do not reach back)', R.canShoot(st, b, a, 'fire', {}) && !R.canShoot(st, a, b, 'fire', {}));
  dice(0.5, () => e.query.aiAct(a));
  const wall = st.terrain[n0];
  ok('shot at down a bare corridor with nothing to answer: it throws up a Ballistic Barrier', !!wall && wall.kit && st.kit.A.barrier === 0 && a.activated,
    wall ? JSON.stringify(wall) : 'none');
  ok('...across the corridor, between it and the gun', wall && wall.x > a.x && wall.x < b.x && wall.y <= corridor.y + 0.01 && wall.y + wall.h >= corridor.y + corridor.h - 0.01);
}
{
  const { e, st } = stage(['regular'], ['regular'], { barrier: 1 });
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 4, 22.5); put(b, 14, 22.5);
  a.facing = 0; b.facing = Math.PI;
  dice(0.5, () => e.query.aiAct(a));
  ok('...not when it can shoot back', st.kit.A.barrier === 1);
}

console.log('\nCovering Fire! before a charge');
{
  const { e, st } = stage(['regular', 'regular'], ['regular']);
  const [a, f] = st.units.filter((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 10, 22.5); put(f, 5, 22.5); put(b, 15, 22.5);
  a.facing = 0; f.facing = 0; b.facing = Math.PI;
  dice(0.5, () => e.query.aiCharge(a, b));
  ok('a friend within 6" that sees the target fires first, past the charging unit', /Covering Fire! — .*\[A\] opens up on .*\[B\]/.test(text(st)) && f.activated, (text(st).match(/Covering Fire![^\n]*/g) || []).join(' | '));
  ok('...and the charge goes in', /charges/.test(text(st)) && a.activated);
}
{
  const { e, st } = stage(['regular', 'regular'], ['regular'], { stun: 1 });
  const [a, f] = st.units.filter((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 10, 22.5); put(f, 5, 22.5); put(b, 15, 22.5);
  a.facing = 0; f.facing = 0; b.facing = Math.PI;
  dice(0.5, () => e.query.aiCharge(a, b));
  ok('...not needed with Stun Grenades going in (no defensive fire to stop)', !/Covering Fire!/.test(text(st)) && st.kit.A.stun === 0);
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
