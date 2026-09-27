/* The Battle Honours a player uses in the battle itself, played through the
   engine rather than measured: Adrenaline Rush and Last Stand (p. 88). */
'use strict';
const { R, Engine } = require('../../server/rules.js');
// the same armies and table every run
let seed = 2670;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

// a hotseat Meeting engagement, both sides down and the battle begun
function battle() {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
    armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'pmc'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  ['A', 'B'].forEach((sd) => { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); });
  ['A', 'B'].forEach((sd) => e.intent(sd, { k: 'start' }));
  return e;
}
// an infantry unit of the side whose go it is, given an honour flag
function honoured(e, flag) {
  const st = e.state(), side = st.activeSide;
  const u = e.query.eligible(side).filter((x) => x.cls === 'infantry')[0];
  u.camp = { flags: {}, once: {} };
  u.camp.flags[flag] = true;
  return { e, st, side, u };
}
// a Move of an inch or so, wherever there is room
function step(e, side, u) {
  e.intent(side, { k: 'action', id: 'move' });
  const st = e.state();
  const reach = R.reachable(st, u, 2).filter((q) => Math.hypot(q.x - u.x, q.y - u.y) > 0.5 && e.query.canStand(u, q.x, q.y));
  if (!reach.length) return false;
  return e.intent(side, { k: 'move', x: reach[0].x, y: reach[0].y }).ok;
}

console.log('\nAdrenaline Rush (p. 88): "two actions in a row"');
(function () {
  const { e, st, side, u } = honoured(battle(), 'adrenaline');
  ok('the side has a unit to act with', !!u, u && u.label);
  const sel = e.intent(side, { k: 'select', id: u.id });
  const rush = e.intent(side, { k: 'action', id: 'rush' });
  ok('Rush is offered', rush.ok, rush.why || (sel.ok ? '' : 'select: ' + sel.why));
  ok('declaring it is not an action', !u.activated && st.activeSide === side);
  ok('the first action', step(e, side, u));
  ok('...leaves the unit ready to go again', !u.activated && st.rush === u.id);
  ok('...and it is still this side\'s go', st.activeSide === side);
  ok('...with nothing else able to act', e.query.eligible(side).length === 1 && e.query.eligible(side)[0] === u);
  const other = st.units.find((x) => x.side === side && x !== u && x.alive && !x.reserve && !x.aboard);
  ok('...or be selected', !other || !e.intent(side, { k: 'select', id: other.id }).ok);
  e.intent(side, { k: 'select', id: u.id });
  ok('the second action', step(e, side, u));
  ok('...ends the activation', u.activated && st.rush === null);
  ok('...and the go passes as after any one activation', st.activeSide !== side || e.query.eligible(R.other ? R.other(side) : (side === 'A' ? 'B' : 'A')).length === 0,
    'now ' + st.activeSide);
  ok('the Rush is spent for the battle', u.camp.once.adrenaline === true);
})();

console.log('\nLast Stand (p. 88): "once per battle the unit can remove all its Suppression points"');
(function () {
  const { e, st, side, u } = honoured(battle(), 'lastStand');
  u.sp = u.morale + 1;                       // Suppressed
  e.intent(side, { k: 'select', id: u.id });
  const ls = e.intent(side, { k: 'action', id: 'laststand' });
  ok('a Suppressed unit makes its stand', ls.ok && u.sp === 0, ls.why);
  ok('...and it is not an action: the unit still has its activation', !u.activated && st.activeSide === side);
  e.intent(side, { k: 'select', id: u.id });
  ok('...which it spends steady', step(e, side, u) && u.activated);
  ok('once a battle', !e.query.actionState(u, 'laststand').on);
})();
(function () {
  const { e, st, side, u } = honoured(battle(), 'lastStand');
  const other = side === 'A' ? 'B' : 'A';
  u.sp = u.morale + 1;
  // it is not this unit's activation, nor even its side's: the other side is acting
  st.activeSide = other;
  const off = e.intent(side, { k: 'laststand', id: u.id });
  ok('at any time: off its side\'s turn too', off.ok && u.sp === 0, off.why);
  ok('...and only the once', !e.intent(side, { k: 'laststand', id: u.id }).ok);
})();
(function () {
  const { e, st, side, u } = honoured(battle(), 'lastStand');
  u.sp = 2 * u.morale + 1;                   // Broken
  const last = e.query.eligible(side).filter((x) => x !== u && x.cls === 'infantry')[0];
  st.units.forEach((x) => { if (x !== last && x !== u) x.activated = true; });
  e.intent(side, { k: 'select', id: last.id });
  step(e, side, last);
  ok('a Broken unit is not made to stand at the start of the Rally phase', !u.camp.once.lastStand);
})();
(function () {
  // pushed past three times its Morale, the rally stops to ask
  const { e, st, side, u } = honoured(battle(), 'lastStand');
  u.sp = 12; u.morale = 2; u.x = 24; u.y = 24;       // mid-table, where fleeing cannot take it off it
  const last = e.query.eligible(side).filter((x) => x !== u && x.cls === 'infantry')[0];
  st.units.forEach((x) => { if (x !== last && x !== u) x.activated = true; });
  e.intent(side, { k: 'select', id: last.id });
  step(e, side, last);
  // the rally cards before it are walked on until the question comes
  for (let i = 0; i < 40 && !st.standAsk && u.alive && !u.camp.once.lastStand; i++) e.intent(side, { k: 'step' });
  ok('about to flee, the player is asked', !!st.standAsk && st.standAsk.unit === u.id && u.alive,
    st.standAsk ? u.sp + ' SP against Morale ' + st.standAsk.morale : 'not asked: ' + st.log.slice(-4).map((l) => l.text).join(' / '));
  const ans = e.intent(side, { k: 'stand' });
  ok('...and making it keeps the unit on the table, steady', ans.ok && u.alive && u.sp === 0 && !st.standAsk, ans.why);
})();
(function () {
  const { e, st, side, u } = honoured(battle(), 'lastStand');
  u.sp = 12; u.morale = 2; u.x = 24; u.y = 24;       // mid-table, where fleeing cannot take it off it
  const last = e.query.eligible(side).filter((x) => x !== u && x.cls === 'infantry')[0];
  st.units.forEach((x) => { if (x !== last && x !== u) x.activated = true; });
  e.intent(side, { k: 'select', id: last.id });
  step(e, side, last);
  for (let i = 0; i < 40 && !st.standAsk && u.alive; i++) e.intent(side, { k: 'step' });
  e.intent(side, { k: 'nostand' });
  ok('...or letting it go, it flees', !u.alive && u.fled && !u.camp.once.lastStand);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
