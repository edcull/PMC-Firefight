/* The three High findings of the rules review at 7dd7306:
   a Broken unit by its own edge runs off the table (p. 34); troops are put down
   anywhere within 4" of their hull (p. 36); and a side that wins the initiative
   with nothing it can activate hands the phase to the other (p. 27). */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 3;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

// a hotseat battle on an empty table, everything on it, A to act
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
  st.units.forEach((u) => { if (u.reserve) u.reserve = false; });
  st.terrain.length = 0;
  st.units.forEach((u, i) => {
    u.x = u.side === 'A' ? 30 : 44; u.y = 4 + i * 3.2; u.activated = false; u.sp = 0; u.cargo = u.cargo || [];
  });
  st.activeSide = 'A';
  return { e, st };
}
// every unit skips until the End phase asks, then both sides carry on
function playOut(e, st) {
  for (let i = 0; i < 300 && !st.endAsk && !st.over; i++) {
    if (st.faceAsk) { e.intent(st.faceAsk.side, { k: 'vfaceall' }); continue; }
    const s = st.activeSide, u = e.query.eligible(s)[0];
    if (!u) break;
    e.intent(s, { k: 'select', id: u.id }); e.intent(s, { k: 'action', id: 'skip' });
  }
}

console.log('\nA Broken unit by its own edge runs off the table (p. 34)');
[1.5, 3, 4].forEach((x0) => {
  const { e, st } = battle(['regular', 'regular'], ['regular']);
  const [vic, mate] = st.units.filter((u) => u.side === 'A');
  const foe = st.units.find((u) => u.side === 'B');
  vic.x = x0; vic.y = 24; vic.sp = 3 * R.currentMorale(vic);       // Broken, not past 3x
  foe.x = 16; foe.y = 24; mate.x = 30; mate.y = 40;
  playOut(e, st);
  ok('from ' + x0 + '" off the edge, its Movement + 2" carries it off — fled', !vic.alive && vic.fled,
    'at ' + vic.x.toFixed(1) + ',' + vic.y.toFixed(1));
});
(function () {
  const { e, st } = battle(['regular', 'regular'], ['regular']);
  const [vic, mate] = st.units.filter((u) => u.side === 'A');
  const foe = st.units.find((u) => u.side === 'B');
  vic.x = 24; vic.y = 24; vic.sp = 3 * R.currentMorale(vic);
  foe.x = 30; foe.y = 24; mate.x = 10; mate.y = 40;
  const d0 = R.inches(vic.x, vic.y, foe.x, foe.y);
  playOut(e, st);
  ok('one in the middle of the table flees away from the enemy and stays on it',
    vic.alive && !vic.fled && R.inches(vic.x, vic.y, foe.x, foe.y) > d0 + 4,
    R.inches(vic.x, vic.y, foe.x, foe.y).toFixed(1) + '" from the enemy, was ' + d0.toFixed(1) + '"');
})();

console.log('\nTroops are put down anywhere within 4" of their hull (p. 36)');
(function () {
  const { e, st } = battle(['lapc:hover', 'regular', 'regular'], ['regular']);
  const apc = st.units.find((u) => u.key === 'lapc'), sq = st.units.find((u) => u.key === 'regular' && u.side === 'A');
  apc.x = 24; apc.y = 24; apc.facing = 0;
  sq.x = 24; sq.y = 27;
  R.embark(st, apc, sq); sq.boarded = false;                     // as though it boarded last turn
  ok('the hull may unload', e.intent('A', { k: 'select', id: apc.id }).ok && e.intent('A', { k: 'action', id: 'disembark' }).ok);
  const mv = e.sel().moves;
  const reach = (dx, dy) => mv.some((c) => Math.abs(c.x - (apc.x + dx)) < 0.3 && Math.abs(c.y - (apc.y + dy)) < 0.3);
  ok('the spots reach 4" from the hull behind it, not only ahead', reach(-6, 0), 'a hull drives backwards at half speed; troops are placed');
  ok('...and beside it', reach(0, 6) && reach(0, -6));
  ok('...but no further than 4"', mv.every((c) => R.unitDist(c, apc) <= 4 + 1e-6));
  ok('...and never on the hull itself', mv.every((c) => R.inches(c.x, c.y, apc.x, apc.y) >= 2 * R.UNIT_R));
  const tgt = { x: apc.x - 6, y: apc.y };
  const r = e.intent('A', { k: 'disembark', x: tgt.x, y: tgt.y });
  ok('the squad goes down exactly where it was put', r.ok && Math.abs(sq.x - tgt.x) < 1e-6 && Math.abs(sq.y - tgt.y) < 1e-6,
    sq.x.toFixed(2) + ',' + sq.y.toFixed(2) + ', ' + R.unitDist(sq, apc).toFixed(2) + '" from the hull');
})();
(function () {
  const { e, st } = battle(['ltransport', 'regular'], ['regular']);
  const tr = st.units.find((u) => u.key === 'ltransport'), sq = st.units.find((u) => u.key === 'regular' && u.side === 'A');
  tr.x = 24; tr.y = 24; tr.facing = 0;
  sq.x = 22; sq.y = 27;
  // a low wall across its nose: a Tier II hull may not cross it, the infantry may
  st.terrain.push({ kind: 'barricade', x: 26.2, y: 18, w: 0.6, h: 12 });
  R.embark(st, tr, sq); sq.boarded = false;
  e.intent('A', { k: 'select', id: tr.id }); e.intent('A', { k: 'action', id: 'disembark' });
  const beyond = e.sel().moves.filter((c) => c.x > 27.5);
  ok('a squad may be put down beyond a low wall its hull could not cross', beyond.length > 0, beyond.length + ' spots beyond it');
})();
(function () {
  const { e, st } = battle(['lapc', 'regular'], ['regular']);
  const apc = st.units.find((u) => u.key === 'lapc'), sq = st.units.find((u) => u.key === 'regular' && u.side === 'A');
  const foe = st.units.find((u) => u.side === 'B');
  apc.x = 24; apc.y = 24; apc.facing = 0;
  foe.x = 29; foe.y = 24; sq.x = 22; sq.y = 27;
  R.embark(st, apc, sq); sq.boarded = false;
  e.intent('A', { k: 'select', id: apc.id }); e.intent('A', { k: 'action', id: 'disembark' });
  const mv = e.sel().moves;
  ok('...and never within 1" of anyone else', mv.length > 1 && mv.every((c) => R.unitDist(c, foe) >= 1 - 1e-6),
    mv.length + ' spots, the enemy 3" from the hull');
})();

console.log('\nA side with the initiative and nothing to activate hands the phase on (p. 27)');
(function () {
  // a battle into turn 2 with every A unit Broken; the dice decide who has the initiative
  function turnTwo(sd) {
    seed = sd;
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
      armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'pmc'),
      nameA: 'Alpha', nameB: 'Bravo', colourA: 'ochre', colourB: 'steel' });
    ['A', 'B'].forEach((x) => { e.intent(x, { k: 'autosplit' }); e.intent(x, { k: 'autodeploy' }); });
    ['A', 'B'].forEach((x) => e.intent(x, { k: 'start' }));
    const st = e.state();
    playOut(e, st);
    // A: everything on the table Broken (but short of 3x, so they stay), everything off it gone
    st.units.forEach((u) => {
      if (u.side !== 'A') return;
      if (u.x < 0 || R.isMachine(u)) u.alive = false; else u.sp = 2 * R.currentMorale(u) + 1;
    });
    let y = 10;
    st.units.forEach((u) => { if (u.side === 'A' && u.alive) { u.x = 24; u.y = y; y += 3; } });
    e.intent('A', { k: 'enddone' }); e.intent('B', { k: 'enddone' });
    return { e, st };
  }
  // the case wanted: A wins the initiative with nothing it can activate
  let g = null;
  for (let sd = 1; sd < 60 && !g; sd++) {
    const t = turnTwo(sd);
    if (t.st.initiative === 'A' && t.st.turn === 2) g = t;
  }
  if (!g) { ok('the case comes up (A has the initiative)', false); return; }
  const { e, st } = g;
  ok('A has the initiative and nothing to activate', e.query.eligible('A').length === 0 && e.query.eligible('B').length > 0);
  ok('...so the phase goes to B', st.activeSide === 'B');
  const b = e.query.eligible('B')[0];
  ok('...whose units may act', e.intent('B', { k: 'select', id: b.id }).ok && e.intent('B', { k: 'action', id: 'skip' }).ok);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
