/* Close Encounters' hidden movement (Appendix 1, p. 158): units that start as
   counters, move no more than 6", cannot be shot or Suppressed, are revealed by
   an enemy's sight (stopping where they are seen, and trading Fire at Will!),
   by choice, by a charge or by Detect — and online the other side is told
   nothing of a counter but where it is. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
const Hidden = require('../../server/hidden.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

/* A battle brought to its first Action phase by the two AIs, then handed to two
   players on a table of our own: a corridor along the top and a branch running
   down from it at x 18-21, everything else solid. */
function stage(armyA, armyB) {
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
  st.cfg.aiSides = [];
  st.terrain = [
    { kind: 'corridor', x: 0, y: 21, w: 30, h: 3, axis: 'h' }, { kind: 'corridor', x: 18, y: 24, w: 3, h: 12, axis: 'v' },
    { kind: 'bulkhead', x: 0, y: 0, w: 48, h: 21 }, { kind: 'bulkhead', x: 30, y: 21, w: 18, h: 3 },
    { kind: 'bulkhead', x: 0, y: 24, w: 18, h: 24 }, { kind: 'bulkhead', x: 21, y: 24, w: 27, h: 24 }, { kind: 'bulkhead', x: 18, y: 36, w: 3, h: 12 }
  ];
  st.compound = { cell: 3, cols: 16, rows: 16, entries: { L: [], R: [] } };
  st.units.forEach((u) => { u.x = -1; u.y = -1; u.reserve = true; u.activated = false; u.sp = 0; });
  st.activeSide = 'A';
  return { e, st };
}
function put(u, x, y, hidden) { u.x = x; u.y = y; u.reserve = false; u.hidden = !!hidden; u.activated = false; }

console.log('\nCounters');
{
  const { e, st } = stage(['regular', 'observers'], ['regular', 'regular']);
  const a = st.units.find((u) => u.side === 'A' && u.key === 'regular'), b = st.units.find((u) => u.side === 'B');
  const fresh = Engine.create();
  fresh.start({ tier: 3, pl: 1, scenario: 'ce_control', armyA: ['regular', 'veterans'], armyB: ['regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' });
  ok('every unit of a Close Encounters scenario starts as a counter', fresh.state().units.length === 3 && fresh.state().units.every((u) => u.hidden));
  put(a, 12, 22.5, true); put(b, 19.5, 33, false);
  ok('a counter cannot be shot, nor shoot', !R.canShoot(st, b, a, 'fire', {}) && !R.canShoot(st, a, b, 'fire', {}));
  R.addSP(a, 4);
  ok('...nor be Suppressed', a.sp === 0);
  ok('its bar: Move, Reveal or Skip, and nothing else', e.intent('A', { k: 'select', id: a.id }).ok && !e.intent('A', { k: 'action', id: 'fire' }).ok && !e.intent('A', { k: 'action', id: 'advance' }).ok);
  ok('...a Move of 6" at most', e.intent('A', { k: 'action', id: 'move' }).ok);
  // walk it along the corridor, past the branch the enemy watches
  const r = e.intent('A', { k: 'move', x: 18, y: 22.5 });
  const log = st.log.map((l) => l.text).join('\n');
  ok('walking into an enemy\'s sight, it stops there and is revealed', r.ok && !a.hidden && a.x < 18 && /is revealed — seen by/.test(log), a.x.toFixed(1) + ', ' + a.y.toFixed(1));
  ok('...and the enemy fires at will, and it answers if it can', /Fire at Will! — /.test(log), (log.match(/Fire at Will![^\n]*/g) || []).join(' | '));
  ok('...neither counting as an activation', !b.activated);
}
{
  const { e, st } = stage(['regular'], ['regular']);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 5, 22.5, true); put(b, 19.5, 33, true);
  e.intent('A', { k: 'select', id: a.id });
  e.intent('A', { k: 'action', id: 'move' });
  const r = e.intent('A', { k: 'move', x: 11, y: 22.5 });
  ok('a counter that stays out of sight moves on, unseen, and the log does not say which unit it is', r.ok && a.hidden && Math.abs(a.x - 11) < 0.6 &&
    /A counter \[A\] moves [\d.]+", unseen\./.test(st.log.map((l) => l.text).join('\n')));
  a.activated = false; st.activeSide = 'A';
  e.intent('A', { k: 'select', id: a.id });
  ok('choosing to show itself, it is revealed and acts as normal', e.intent('A', { k: 'action', id: 'reveal' }).ok && !a.hidden && e.intent('A', { k: 'action', id: 'move' }).ok);
}
{
  const { st } = stage(['regular'], ['regular']);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 10, 22.5, false); put(b, 14, 22.5, true);
  ok('a counter may be charged — a charge needs no sight — and shows itself', R.canAssault(a, b, st) && !R.canAssault(b, a, st));
  const res = R.assault(st, a, b, {});
  ok('...revealed by it', !b.hidden && res.log.some((l) => /revealed — charged/.test(l.text)));
}
{
  const { e, st } = stage(['observers'], ['regular', 'regular']);
  const fo = st.units.find((u) => u.side === 'A'), [b1, b2] = st.units.filter((u) => u.side === 'B');
  ok('inside, observers carry Advanced Sensors', fo.rules.indexOf('Advanced Sensors') >= 0);
  put(fo, 19.5, 30, false); put(b1, 3, 22.5, true); put(b2, 27, 22.5, true);
  e.intent('A', { k: 'select', id: fo.id });
  ok('Detect is on its bar', e.intent('A', { k: 'action', id: 'detect' }).ok);
  const r = e.intent('A', { k: 'move', x: 19.5, y: 26 });
  ok('...it moves, and every enemy counter within 12" is revealed, seen or not', r.ok && !b2.hidden && b1.hidden && fo.activated,
    'near ' + R.unitDist(fo, b2).toFixed(1) + '" ' + (b2.hidden ? 'hidden' : 'revealed') + ', far ' + R.unitDist(fo, b1).toFixed(1) + '" ' + (b1.hidden ? 'hidden' : 'revealed'));
}

console.log('\nReaction fire');
// a room off the corridor at x 15-24, y 24-33: the enemy in it sees a stretch of the corridor and no more
function roomTable(st) {
  st.terrain = [
    { kind: 'corridor', x: 0, y: 21, w: 36, h: 3, axis: 'h' }, { kind: 'room', x: 15, y: 24, w: 9, h: 9 },
    { kind: 'bulkhead', x: 0, y: 0, w: 48, h: 21 }, { kind: 'bulkhead', x: 36, y: 21, w: 12, h: 3 },
    { kind: 'bulkhead', x: 0, y: 24, w: 15, h: 24 }, { kind: 'bulkhead', x: 24, y: 24, w: 24, h: 24 }, { kind: 'bulkhead', x: 15, y: 33, w: 9, h: 15 }
  ];
}
for (const answer of ['opp', 'noopp']) {
  const { e, st } = stage(['regular'], ['regular']);
  roomTable(st);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(b, 19.5, 31, false);
  const sees = (x) => R.hasLoS(st, b, Object.assign({}, a, { x, y: 22.5, of: a }));
  // the stretch of corridor it sees: the dash starts short of it and ends past it
  let lo = null, hi = null;
  for (let x = 2; x <= 34; x += 0.5) if (sees(x)) { if (lo === null) lo = x; hi = x; }
  const x0 = lo - 1.5, x1 = hi + 1.5;
  put(a, x0, 22.5, false);
  a.move = Math.ceil(x1 - x0);                       // a long dash across the doorway
  e.intent('A', { k: 'select', id: a.id });
  e.intent('A', { k: 'action', id: 'move' });
  const r = e.intent('A', { k: 'move', x: x1, y: 22.5 });
  const asked = st.oppAsk;
  if (answer === 'opp') {
    ok('crossing the enemy\'s sight and out again, the move waits on the enemy', r.ok && asked && asked.side === 'B' && asked.shooter === b.id && !sees(x0) && !sees(x1),
      'seen from ' + lo + ' to ' + hi + '; ' + JSON.stringify(asked));
    ok('...whose player is asked, and nobody else may act meanwhile', !e.intent('A', { k: 'select', id: a.id }).ok || !!st.oppAsk);
  }
  const r2 = e.intent('B', { k: answer });
  const log = st.log.map((l) => l.text).join('\n');
  if (answer === 'opp') {
    ok('Open fire: it shoots the mover where it crossed, and that is its activation', r2.ok && /Opportunity Fire — /.test(log) && b.activated && !st.oppAsk);
    ok('...the mover goes on, or stops where it was caught if pinned', R.status(a) === 'ready' ? Math.abs(a.x - x1) < 0.6 : a.x < x1 && a.x >= lo - 0.5,
      R.status(a) + ' at ' + a.x.toFixed(1));
  } else {
    ok('Let it pass: the move goes on, the enemy keeps its activation', r2.ok && Math.abs(a.x - x1) < 0.6 && !b.activated && !/Opportunity Fire — /.test(log));
  }
}
{
  const { e, st } = stage(['regular', 'regular'], ['regular']);
  roomTable(st);
  const [u, f] = st.units.filter((x) => x.side === 'A'), b = st.units.find((x) => x.side === 'B');
  put(u, 17, 26, false); put(f, 21, 27, false); put(b, 19.5, 22.5, false);
  e.intent('A', { k: 'select', id: u.id });
  ok('Covering Fire! is on the bar of a unit with a friend in reach', e.intent('A', { k: 'action', id: 'cover' }).ok);
  ok('...pick the friend', e.intent('A', { k: 'target', id: f.id }).ok);
  ok('...then the enemy it fires at', e.intent('A', { k: 'target', id: b.id }).ok);
  const log = st.log.map((l) => l.text).join('\n');
  ok('the friend fires first, and has spent its activation', /Covering Fire! — /.test(log) && f.activated && !u.activated && u.covered === st.turn);
  ok('...and the covered unit then acts', e.intent('A', { k: 'action', id: 'move' }).ok);
}

console.log('\nOnline');
{
  const { e, st } = stage(['regular'], ['veterans']);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 5, 22.5, true); put(b, 27, 22.5, true);
  const snap = JSON.parse(JSON.stringify(e.snapshot()));
  const forA = Hidden.battleFor(snap, 'A'), bA = forA.units.find((u) => u.id === b.id), aA = forA.units.find((u) => u.id === a.id);
  ok('the other side\'s counter: where it is, and nothing of what it is', bA.x === 27 && bA.name === 'Hidden counter' && bA.code === '?' && bA.key !== 'veterans' && !bA.rules.length,
    bA.name + ' / ' + bA.key);
  ok('...its own, as it is', aA.name === a.name && aA.key === 'regular');
  b.hidden = false;
  const forA2 = Hidden.battleFor(JSON.parse(JSON.stringify(e.snapshot())), 'A');
  ok('revealed, it is shown as itself', forA2.units.find((u) => u.id === b.id).key === 'veterans');
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
