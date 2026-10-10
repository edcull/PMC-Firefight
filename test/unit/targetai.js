/* Which of several targets an AI unit shoots (the owner's ruling): the one its weapon
   is made for, then an unsuppressed unit already carrying Suppression Points, then a
   Suppressed one that is not Broken, then the rest — and a Hacker reaches for drones. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 17;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// both sides the AI, walked on to the battle; A gets the shooter, B the targets
function battle(armyA, armyB) {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA, armyB, nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel',
    mode: 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto' });
  for (let g = 0; g < 400 && !e.over() && e.state().phase !== 'battle'; g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  const st = e.state();
  st.terrain = st.terrain.filter((t) => t.kind === 'objective');
  st.units.forEach((u) => { Object.assign(u, { sp: 0, aboard: null, reserve: false, bld: null }); u.cargo = []; });
  return { e, st };
}
// the shooter at the left, everyone else of A out of the way, B's units set out in a row at `range`
function lineUp(st, shooterKey, targets, range) {
  const sh = st.units.filter((u) => u.side === 'A' && u.key === shooterKey)[0];
  st.units.forEach((u) => { if (u.side === 'A' && u !== sh) u.alive = false; });
  Object.assign(sh, { x: 10, y: 24, facing: 0, activated: false });
  const tg = targets.map((k, i) => {
    const t = st.units.filter((u) => u.side === 'B' && u.key === k && u.alive && !u.used)[0];
    t.used = true; Object.assign(t, { x: 10 + range, y: 16 + i * 6 });
    return t;
  });
  st.units.forEach((u) => { if (u.side === 'B' && !u.used) u.alive = false; });
  return { sh, tg };
}

console.log('\nA weapon goes for what it is made for');
(function () {
  const { e, st } = battle(['cmd3', 'lightat'], ['cmd3', 'regular', 'lpv']);
  const { sh, tg } = lineUp(st, 'lightat', ['regular', 'lpv'], 10);
  const pick = e.query.bestTarget(sh);
  ok('an Anti-tank team with a rifle squad and a vehicle in reach shoots the vehicle', pick.t === tg[1], pick.t && pick.t.name);
})();
(function () {
  const { e, st } = battle(['cmd3', 'hmgteam'], ['cmd3', 'regular', 'lpv']);
  const { sh, tg } = lineUp(st, 'hmgteam', ['lpv', 'regular'], 10);
  const pick = e.query.bestTarget(sh);
  ok('a Suppressive Fire team shoots the infantry', pick.t === tg[1], pick.t && pick.t.name);
})();
(function () {
  const { e, st } = battle(['cmd3', 'gausscannon'], ['cmd3', 'regular', 'regular']);
  const { sh, tg } = lineUp(st, 'gausscannon', ['regular', 'regular'], 12);
  // the second squad in a wood
  st.terrain.push({ kind: 'woods', x: tg[1].x - 3, y: tg[1].y - 3, w: 6, h: 6 });
  const pick = e.query.bestTarget(sh);
  ok('a Gauss weapon picks the squad in cover over the one in the open', pick.t === tg[1], pick.t && pick.t.name + ' cover ' + R.coverAt(st, pick.t.x, pick.t.y, pick.t));
})();

console.log('\nThen by suppression');
(function () {
  const { e, st } = battle(['cmd3', 'regular'], ['cmd3', 'regular', 'regular', 'regular']);
  const { sh, tg } = lineUp(st, 'regular', ['regular', 'regular', 'regular'], 10);
  const m = R.currentMorale(tg[0]);
  tg[0].sp = 0; tg[1].sp = m + 1; tg[2].sp = 1;          // fresh · Suppressed · shaken but standing
  let pick = e.query.bestTarget(sh);
  ok('an unsuppressed squad carrying Suppression Points first', pick.t === tg[2], pick.t && (pick.t.sp + ' SP'));
  tg[2].sp = 0;
  pick = e.query.bestTarget(sh);
  ok('...then a Suppressed one', pick.t === tg[1], pick.t && (pick.t.sp + ' SP'));
  tg[1].sp = 2 * m + 1;                                  // Broken
  tg[0].sp = 0;
  pick = e.query.bestTarget(sh);
  ok('...a Broken one only when there is nothing else to tell them apart', pick.t === tg[0] || pick.t === tg[1], pick.t && (pick.t.sp + ' SP'));
})();

console.log('\nHackers go for the drones');
(function () {
  const { e, st } = battle(['cmd3', 'ew'], ['cmd3', 'regular', 'drecon']);
  const { sh, tg } = lineUp(st, 'ew', ['regular', 'drecon'], 12);
  st.activeSide = 'A'; st.over = { winner: null, text: 'test' };
  const n0 = st.log.length;
  e.query.aiAct(sh);
  const txt = st.log.slice(n0).map((l) => l.text || '').join(' | ');
  ok('an EW team with a drone in reach hacks it', /reaches into|[Hh]ack/.test(txt), txt.slice(0, 160));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
