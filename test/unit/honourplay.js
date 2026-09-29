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
  for (let i = 0; i < 40 && !st.standAsk && u.alive && !u.camp.once.lastStand; i++) e.intent(st.endAsk ? st.endAsk.side : side, { k: st.endAsk ? 'enddone' : 'step' });
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
  for (let i = 0; i < 40 && !st.standAsk && u.alive; i++) e.intent(st.endAsk ? st.endAsk.side : side, { k: st.endAsk ? 'enddone' : 'step' });
  e.intent(side, { k: 'nostand' });
  ok('...or letting it go, it flees', !u.alive && u.fled && !u.camp.once.lastStand);
})();

/* ---- the AI spends them too ----
   A demo (both sides the AI), stepped one activation at a time, between two
   fixed forces so the squads and their shots are the same whatever the dice. */
const FORCE = ['cmd2', 'regular', 'regular', 'regular', 'veterans', 'veterans', 'recon'];
function aiBattle() {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'demo', planet: 'barren',
    armyA: FORCE.slice(), armyB: FORCE.slice(),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  return e;
}
// out of everyone's way, on the table: far corners, apart
function aside(st, units) { units.forEach((x, i) => { x.x = 2 + (i % 4) * 2; x.y = 2 + Math.floor(i / 4) * 2; }); }
// a squad of veterans of the side whose go it is, the only one left to act, given an honour
function aiLast(e, flag) {
  const st = e.state(), side = st.activeSide;
  const u = st.units.find((x) => x.side === side && x.key === 'veterans' && x.alive);
  u.activated = false; u.reserve = false; u.aboard = null;
  st.units.forEach((x) => { if (x.side === side && x !== u) x.activated = true; });
  u.camp = { flags: {}, once: {} };
  u.camp.flags[flag] = true;
  return { st, side, u };
}
const aiStep = (e) => e.intent('A', { k: 'step' });

console.log('\nThe AI and Last Stand');
(function () {
  const e = aiBattle();
  const { st, u } = aiLast(e, 'lastStand');
  u.sp = 2 * u.morale + 1;                   // Broken: it cannot act at all
  ok('a Broken unit is not eligible to act', !e.query.eligible(st.activeSide).includes(u));
  aiStep(e);
  ok('...so the AI makes its stand when its side has the go', u.camp.once.lastStand === true && u.alive,
    u.sp + ' SP; ' + st.log.slice(-3).map((l) => l.text).join(' / '));
  ok('...and the unit then acts', u.activated);
})();
(function () {
  const e = aiBattle();
  const { st, u } = aiLast(e, 'lastStand');
  u.sp = u.morale + 1;                       // Suppressed
  // one enemy squad a few inches off, in the open: in range
  const foe = st.units.find((x) => x.side !== u.side && x.key === 'regular');
  foe.reserve = false; foe.aboard = null;
  st.terrain.length = 0;
  u.x = 30; u.y = 18; foe.x = 36; foe.y = 18; u.bld = foe.bld = u.sec = foe.sec = null;
  const ready = R.enemyWithinRange(st, u) && !R.deathOrGlory(st, u);
  aiStep(e);
  ok('a Suppressed unit with an enemy in range stands to fight on', ready && u.camp.once.lastStand === true,
    ready ? st.log.slice(-3).map((l) => l.text).join(' / ') : 'the enemy was not in range');
})();
(function () {
  // Broken on the other side's go: in the End phase it stands rather than run
  const e = aiBattle();
  const st = e.state(), side = st.activeSide, other = side === 'A' ? 'B' : 'A';
  const u = st.units.find((x) => x.side === other && x.cls === 'infantry' && x.alive && x.x >= 0);
  u.camp = { flags: { lastStand: true }, once: {} };
  u.sp = 2 * u.morale + 1;
  // the other side has nothing left to do this turn, and this side one unit
  const last = e.query.eligible(side)[0];
  st.units.forEach((x) => { if (x !== last) x.activated = true; });
  const turn = st.turn;
  for (let i = 0; i < 20 && st.turn === turn && !st.over; i++) aiStep(e);
  ok('a Broken unit stands in the End phase rather than run', u.alive && u.camp.once.lastStand === true &&
    st.log.some((l) => /Last Stand rather than run/.test(l.text)), st.log.filter((l) => l.text.indexOf(u.label) >= 0).slice(-2).map((l) => l.text).join(' / '));
})();
(function () {
  const e = aiBattle();
  const { st, u } = aiLast(e, 'lastStand');
  u.sp = u.morale + 1;
  // every enemy far out of range: nothing to fight
  aside(st, st.units.filter((x) => x.side !== u.side && x.alive && x.x >= 0));
  u.x = 46; u.y = 34; u.bld = u.sec = null;
  const far = !R.enemyWithinRange(st, u);
  aiStep(e);
  ok('a Suppressed unit with no enemy in range keeps its stand for later', far && !u.camp.once.lastStand,
    far ? '' : 'the enemy was still in range');
})();

console.log('\nThe AI and Adrenaline Rush');
(function () {
  const e = aiBattle();
  const { st, side, u } = aiLast(e, 'adrenaline');
  // an enemy squad in the open, well inside half range: a good shot
  const foe = st.units.find((x) => x.side !== side && x.key === 'regular');
  foe.reserve = false; foe.aboard = null;
  aside(st, st.units.filter((x) => x.side !== side && x !== foe && x.alive && x.x >= 0));
  st.terrain.length = 0;
  u.x = 30; u.y = 18; foe.x = 35; foe.y = 18; foe.sp = 0; u.bld = foe.bld = u.sec = foe.sec = null;
  aiStep(e);
  ok('with a good shot, the AI declares its Rush', u.camp.once.adrenaline === true,
    st.log.slice(-4).map((l) => l.text).join(' / '));
  ok('...and after its first action the unit goes again', st.over || (st.rush === u.id && !u.activated && st.activeSide === side));
  if (!st.over) aiStep(e);
  ok('...its second action ends the activation', st.over || (u.activated && st.rush === null));
  ok('the log says so', st.log.some((l) => /goes again — Adrenaline Rush/.test(l.text)));
})();
(function () {
  const e = aiBattle();
  const { st, side, u } = aiLast(e, 'adrenaline');
  // nothing on the table to shoot at: the Rush is kept
  aside(st, st.units.filter((x) => x.side !== side && x.alive && x.x >= 0));
  u.x = 46; u.y = 34; u.bld = u.sec = null;
  aiStep(e);
  ok('with no good shot, the Rush is kept', u.activated && !u.camp.once.adrenaline);
})();
(function () {
  // a whole battle with every unit honoured: the AI spends both, and it still ends
  const e = aiBattle();
  e.state().units.forEach((x) => { x.camp = { flags: { adrenaline: true, lastStand: true }, once: {} }; });
  let steps = 0;
  while (!e.over() && steps < 4000 && aiStep(e).ok) steps++;
  const st = e.state();
  const rushed = st.units.filter((x) => x.camp.once.adrenaline).length;
  const stood = st.units.filter((x) => x.camp.once.lastStand).length;
  ok('a whole battle: the AI spends Rushes', rushed > 0, rushed + ' of ' + st.units.length);
  ok('...and the battle still plays out', e.over(), steps + ' steps, turn ' + st.turn + '; ' + stood + ' Last Stands made');
})();

/* ---- rally cards name the unit ----
   Two squads of the same name on one side rally on two cards that say which is
   which: their codes, where one squad's name alone would read as one unit
   rallying twice. */
console.log('\nRally cards, two squads of one name');
(function () {
  const cards = [];
  const e = Engine.create({ card: (c) => cards.push(c) });
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
    armyA: ['cmd2', 'regular', 'regular', 'veterans'], armyB: ['cmd2', 'regular', 'regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  ['A', 'B'].forEach((sd) => { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); });
  ['A', 'B'].forEach((sd) => e.intent(sd, { k: 'start' }));
  const st = e.state(), side = st.activeSide;
  const twins = st.units.filter((x) => x.side === side && x.key === 'regular').slice(0, 2);
  const vet = st.units.find((x) => x.side === 'A' && x.key === 'veterans');
  twins.forEach((x) => { x.sp = 2; });
  vet.sp = 2;
  const last = e.query.eligible(side).filter((x) => twins.indexOf(x) < 0 && x.cls === 'infantry')[0];
  st.units.forEach((x) => { if (x !== last) x.activated = true; });
  e.intent(side, { k: 'select', id: last.id });
  step(e, side, last);
  for (let i = 0; i < 20 && cards.filter((c) => c.kind === 'Rally').length < 3; i++) e.intent(side, { k: 'step' });
  const titles = cards.filter((c) => c.kind === 'Rally').map((c) => c.title);
  const tw = twins.map((x) => titles.find((t) => t.indexOf(x.code) >= 0));
  ok('each of the two carries its code', tw.every(Boolean) && tw[0] !== tw[1], titles.join(' / '));
  ok('...and a unit with no twin its name alone', titles.indexOf(vet.name + ' [A]') >= 0);
})();

/* ---- the End phase waits for the player's answer ----
   Against the AI, when the AI's side has the last activation and the End phase
   is asking the player to carry on or surrender, a step (the view keeps pacing
   the AI) must not end the turn again: it ran the whole Rally phase once more
   each time — a unit rallying three times in one End phase. */
console.log('\nThe End phase, waiting on the player');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'ai', planet: 'barren',
    armyA: ['cmd2', 'regular', 'regular', 'veterans'], armyB: ['cmd2', 'regular', 'regular', 'regular'], nameA: 'A', nameB: 'B' });
  e.intent('A', { k: 'autosplit' }); e.intent('A', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  const st = e.state();
  const last = st.units.find((u) => u.side === 'B' && u.key === 'regular');
  st.units.forEach((u) => { u.activated = u !== last; if (u.side === 'B') u.sp = 2; });
  st.activeSide = 'B';
  const rallies = () => st.log.filter((l) => l.t === 'phase' && /Rally phase/.test(l.text)).length;
  const turn = st.turn;
  e.intent('A', { k: 'step' });
  ok('the AI\'s last activation ends the turn, and the player is asked', !!st.endAsk && st.endAsk.side === 'A' && rallies() === 1, rallies() + ' Rally phases');
  for (let i = 0; i < 3; i++) e.intent('A', { k: 'step' });
  ok('...and steps taken while the question is open run no more rallies', rallies() === 1 && st.turn === turn, rallies() + ' Rally phases');
  const ans = e.intent('A', { k: 'enddone' });
  ok('carrying on starts the next turn', ans.ok && st.turn === turn + 1 && !st.endAsk, ans.why || 'turn ' + st.turn);
  for (let i = 0; i < 40 && st.activeSide === 'B' && !st.over; i++) e.intent('A', { k: 'step' });
  ok('...and the AI plays on in it', st.log.some((l, i) => l.t === 'turn' && /Turn 2/.test(l.text)) && st.units.some((u) => u.side === 'B' && u.activated) || st.activeSide === 'A');
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
