/* How an AI side drives its transports: the squads go down short of the enemy's
   guns, not inside them, and an empty hull never takes troops back off the line. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 11;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// a campaign battle, both sides the AI, walked on to the first turn of the battle
function battle(armyA) {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: armyA || ['cmd3', 'rookie', 'recruits', 'ltransport:wheeled', 'ltransport:wheeled'],
    armyB: R.rollArmy(2, 1, null, 'pmc'), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo',
    planet: 'sparse', campaign: true, terrainSetup: 'auto' });
  for (let g = 0; g < 400 && !e.over() && e.state().phase !== 'battle'; g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
// the AI acts for `u` alone, the rest of the table cleared but for one enemy rifle squad
function setUp(e) {
  const st = e.state();
  // everyone off the hulls first: each check puts its own squad aboard
  st.units.forEach((v) => { (v.cargo || []).forEach((c) => { c.aboard = null; }); v.cargo = []; });
  const hull = st.units.filter((u) => u.side === 'A' && u.transport && u.alive)[0];
  const squad = st.units.filter((u) => u.side === 'A' && u.alive && !R.isMachine(u) && !R.has(u, 'Command'))[0];
  const foe = st.units.filter((u) => u.side === 'B' && u.alive && !R.isMachine(u) && u.fp != null)[0];
  st.units.forEach((u) => { if (u !== hull && u !== squad && u !== foe && !u.aboard) { u.alive = false; } });
  st.terrain = st.terrain.filter((t) => t.kind === 'objective');
  st.objectives = [];
  [hull, squad, foe].forEach((u) => { u.sp = 0; u.activated = false; u.bld = null; u.disembarked = false; u.aboard = null; u.reserve = false; });
  hull.cargo = []; hull.damage = 0;
  st.activeSide = 'A';
  return { st, hull, squad, foe };
}

// the one activation, and no more: the battle is marked over so the AI does not play on
function act(e, u) { e.state().over = { winner: null, text: 'test' }; e.query.aiAct(u); }

console.log('\nTransports start the battle full');
(function () {
  const e = battle(), st = e.state();
  const hulls = st.units.filter((u) => u.side === 'A' && u.transport && u.alive);
  ok('each of the AI\'s transports on the table has a squad aboard at the start', hulls.length === 2 && hulls.every((v) => (v.cargo || []).length > 0),
    hulls.map((v) => v.name + ' ' + (v.cargo || []).length).join(', '));
})();

console.log('\nA loaded transport puts its squad down once the enemy has it in sight and range');
(function () {
  const e = battle(), { st, hull, squad, foe } = setUp(e);
  ok('(a transport, a squad and an enemy rifle squad)', !!(hull && squad && foe));
  if (!hull || !squad || !foe) return;
  hull.x = 30; hull.y = 24; foe.x = 30 + Math.min(foe.range - 2, 14); foe.y = 24;
  squad.x = hull.x - 2; squad.y = hull.y;
  R.embark(st, hull, squad); squad.boarded = false;      // (aboard from an earlier turn)
  ok('...the squad is aboard', (hull.cargo || []).length === 1);
  act(e, hull);
  ok('...and it gets out rather than riding on into the enemy', !squad.aboard && squad.x >= 0, 'squad at ' + squad.x.toFixed(1) + ', ' + squad.y.toFixed(1));
  ok('...on the side toward the enemy, between it and the hull', R.inches(squad.x, squad.y, foe.x, foe.y) < R.inches(hull.x, hull.y, foe.x, foe.y));
})();

console.log('\nAn armoured carrier spearheads where a light transport would stop');
(function () {
  const e = battle(['cmd3', 'rookie', 'recruits', 'lapc:tracked']), { st, hull, squad, foe } = setUp(e);
  if (!hull || !squad || !foe) { ok('(set up)', false); return; }
  hull.x = 20; hull.y = 24; foe.x = 36; foe.y = 24; foe.range = Math.max(foe.range, 18); squad.x = 18; squad.y = 24;
  R.embark(st, hull, squad); squad.boarded = false;
  const x0 = hull.x;
  act(e, hull);
  ok('a Light APC under the enemy\'s guns 16" out keeps its squad aboard and drives on', !!squad.aboard && hull.x > x0 + 1,
    hull.name + ' moved ' + (hull.x - x0).toFixed(1) + '", squad ' + (squad.aboard ? 'aboard' : 'out'));
})();

console.log('\nAn empty transport never takes a squad back off the line');
(function () {
  const e = battle(), { hull, squad, foe } = setUp(e);
  if (!hull || !squad || !foe) { ok('(set up)', false); return; }
  hull.x = 30; hull.y = 24; squad.x = 32; squad.y = 24; foe.x = 42; foe.y = 24;
  act(e, hull);
  ok('a squad 10" from the enemy stays where it is', !squad.aboard);
})();
(function () {
  const e = battle(), { st, hull, squad, foe } = setUp(e);
  if (!hull || !squad || !foe) { ok('(set up)', false); return; }
  // the rest of the force out ahead: this squad is stranded well behind its own front line
  const lead = st.units.filter((u) => u.side === 'A' && !R.isMachine(u) && u !== squad)[0];
  Object.assign(lead, { alive: true, x: 40, y: 24, aboard: null, reserve: false, sp: 0 });
  hull.x = 8; hull.y = 24; squad.x = 10; squad.y = 24; foe.x = 60; foe.y = 24;
  act(e, hull);
  ok('...but one stranded far behind its own front line is picked up', !!squad.aboard);
})();

console.log('\nBattlefield Insertion: the AI comes down clear of the enemy');
(function () {
  let landed = 0, exposed = 0, close = 0;
  for (let n = 0; n < 6; n++) {
    const e = Engine.create();
    e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: R.rollArmy(2, 1, null, 'rebel'), armyB: R.rollArmy(2, 1, null, 'pmc'),
      nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'dense', campaign: true, terrainSetup: 'auto',
      tactics: { A: 'guerillas', B: null } });
    for (let g = 0; g < 400 && !e.over() && e.state().phase !== 'battle'; g++) {
      const s = e.state();
      if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
      if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
      e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
    }
    const st = e.state();
    st.units.filter((u) => u.side === 'A' && u.reserve && R.has(u, 'Battlefield Insertion')).forEach((u) => {
      e.state().over = { winner: null, text: 'test' };
      // the AI's own choice of spot: the scatter die held at 1, on target
      const d6 = R.d6; R.d6 = () => 1;
      try { e.query.aiInsert(u); } finally { R.d6 = d6; }
      if (u.reserve || u.x < 0) return;
      landed++;
      const ghost = { x: u.x, y: u.y, alive: true, of: u };
      // (Stealth, which Guerillas have: an enemy beyond 12" is shooting at +2 Defence or more, a risk worth taking)
      if (st.units.some((f) => f.side === 'B' && f.alive && f.x >= 0 && !f.aboard && f.fp != null &&
        R.inches(f.x, f.y, u.x, u.y) <= Math.min(12, f.range || 0) && R.hasLoS(st, f, ghost))) exposed++;
      if (st.units.some((f) => f.side === 'B' && f.alive && f.x >= 0 && !f.aboard && R.inches(f.x, f.y, u.x, u.y) < 10)) close++;
    });
  }
  ok('Guerillas come down by insertion', landed >= 6, landed + ' landed');
  ok('...never within 10" of an enemy', close === 0, close + ' of ' + landed);
  ok('...nor where an enemy within 12" has them in sight and range', exposed <= landed * 0.1, exposed + ' of ' + landed + ' exposed');
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
