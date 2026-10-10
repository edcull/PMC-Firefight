/* A computer side in a battle for ground (Secure and control, Find and secure):
   a cautious squad makes for an objective rather than holding at its table edge,
   and a unit with nobody in reach takes the Move, not a short Advance. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 13;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// both sides the AI, walked on to the first turn of the battle
function battle(scenario, solo) {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario, armyA: ['cmd3', 'rookie', 'recruits'], armyB: R.rollArmy(2, 1, null, 'pmc'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: solo ? 'solo' : 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto' });
  for (let g = 0; g < 400 && !e.over() && e.state().phase !== 'battle'; g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
// one A rifle squad at its own edge, the enemy far off, the ground open; the behaviour die held at 1
function standAlone(e) {
  const st = e.state();
  const squad = st.units.filter((u) => u.side === 'A' && u.alive && u.cls === 'infantry' && !R.has(u, 'Command') && u.fp != null)[0];
  const foe = st.units.filter((u) => u.side === 'B' && u.alive && !u.aboard)[0];
  st.units.forEach((u) => { if (u !== squad && u !== foe) u.alive = false; });
  st.terrain = st.terrain.filter((t) => t.kind === 'objective' || t.kind === 'searchsite');
  Object.assign(squad, { x: 3, y: 24, sp: 0, activated: false, bld: null, aboard: null, reserve: false });
  Object.assign(foe, { x: 46, y: 24, sp: 0, reserve: false, aboard: null });
  st.activeSide = 'A';
  st.over = { winner: null, text: 'test' };          // the one activation, and no more
  return { st, squad };
}
function nearestGoal(st, u) {
  const pts = st.objectives.length ? st.objectives : (st.sc.search || []);
  return Math.min.apply(null, pts.map((o) => R.inches(u.x, u.y, o.x, o.y)));
}
function actHeld(e, u) { const d6 = R.d6; R.d6 = () => 1; try { e.query.aiAct(u); } finally { R.d6 = d6; } }

console.log('\nSecure and control: a cautious squad goes for the ground');
(function () {
  const e = battle('secure'), { st, squad } = standAlone(e);
  const d0 = nearestGoal(st, squad), x0 = squad.x;
  actHeld(e, squad);
  const moved = R.inches(x0, 24, squad.x, squad.y);
  ok('a Neutral squad at its table edge moves toward an objective instead of holding', nearestGoal(st, squad) < d0 - 1,
    'nearest objective ' + d0.toFixed(1) + '" → ' + nearestGoal(st, squad).toFixed(1) + '"');
  ok('...taking the Move (+4") with nobody in reach to shoot', moved > squad.move + 0.5, 'moved ' + moved.toFixed(1) + '" on Movement ' + squad.move);
})();

console.log('\nFind and secure: the same toward the unchecked locations');
(function () {
  const e = battle('find'), { st, squad } = standAlone(e);
  const d0 = nearestGoal(st, squad);
  actHeld(e, squad);
  ok('a Neutral squad moves toward a location to search', nearestGoal(st, squad) < d0 - 1, d0.toFixed(1) + '" → ' + nearestGoal(st, squad).toFixed(1) + '"');
})();

console.log('\nA Meeting engagement keeps the behaviour table');
(function () {
  const e = battle('meeting'), { squad } = standAlone(e);
  const x0 = squad.x;
  actHeld(e, squad);
  ok('a Neutral squad with no objectives to take holds its position', Math.abs(squad.x - x0) < 0.01, 'x ' + x0 + ' → ' + squad.x.toFixed(1));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
