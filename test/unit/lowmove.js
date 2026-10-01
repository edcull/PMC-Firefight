/* The Low findings on movement and terrain (the rules review at 7dd7306,
   L-1 to L-8): a unit may Move off the table and count as fled (p. 31); no base
   ends a move astride a wall or over rocks (p. 42); a squad that counts as in a
   wood sees out of it (p. 42); entering and leaving a building measure 4" the
   same way (p. 41); low walls are laid up to 6" (p. 42); Riders do not cross
   barbed wire, and a grav bike pays nothing for it (p. 94, Appendix 3); and
   Sappers can cut wire that no gun can shoot down (p. 43). */
'use strict';
const { R, GEN, Engine } = require('../../server/rules.js');
let seed = 31;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
let n = 0;
function unit(key, side, x, y, extra) {
  const p = R.profile(key);
  return Object.assign(JSON.parse(JSON.stringify(p)), {
    id: side + (n++), side, label: p.name, models: p.size, x, y, sp: 0, alive: true, shotFrom: [], cargo: [], facing: 0
  }, extra || {});
}
const world = (units, terrain) => ({ units, terrain: terrain || [], objectives: [], log: [] });

console.log('\nA unit may Move off the table, and counts as fled (p. 31)');
(function () {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular', 'regular'], armyB: ['regular'], nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  let g = 0;
  while (e.state().phase === 'deploy' && g++ < 200) { const side = e.query.placingSide(); if (!side) break; e.intent(side, { k: 'autodeploy' }); }
  e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
  e.intent('A', { k: 'start' });
  for (g = 0; g < 60 && e.state().phase !== 'battle'; g++) e.intent(e.state().activeSide || 'A', { k: 'start' });
  const st = e.state();
  st.terrain.length = 0;
  st.units.forEach((u, i) => { u.reserve = false; u.aboard = null; u.activated = false; u.sp = 0; u.x = u.side === 'A' ? 20 : 30; u.y = 10 + i * 6; });
  st.activeSide = 'A'; st.chain = null; st.streak = 9;
  const [near, far] = st.units.filter((u) => u.side === 'A');
  near.x = 3; near.y = 24; far.x = 24; far.y = 24;
  ok('one near the edge is offered Leave the table', e.query.specialsFor(near).some((s) => s.id === 'leave'));
  ok('...one in the middle of the table is not', !e.query.specialsFor(far).some((s) => s.id === 'leave'));
  e.intent('A', { k: 'select', id: near.id });
  ok('it takes the action', e.intent('A', { k: 'action', id: 'leave' }).ok && e.sel().moves.length > 0);
  const spot = e.sel().moves[0];
  ok('...goes off from the lit ground', e.intent('A', { k: 'leave', x: spot.x, y: spot.y }).ok);
  ok('...and is gone, fled', !near.alive && near.fled);
})();

console.log('\nNo base ends a move astride a wall or over rocks (p. 42)');
(function () {
  const u = unit('regular', 'A', 10, 10);
  const wall = { kind: 'barricade', x: 13, y: 4, w: 0.6, h: 12 }, rock = { kind: 'rocks', x: 5, y: 14, w: 3, h: 3 };
  const sp = R.reachable(world([u], [wall, rock]), u, u.move + 2);
  ok('the move still crosses the low wall', sp.some((c) => c.x > 14));
  ok('...but ends with no base on it', sp.every((c) => R.rectPointDist(wall, c.x, c.y) >= R.UNIT_R - 1e-6),
    sp.filter((c) => R.rectPointDist(wall, c.x, c.y) < R.UNIT_R - 1e-6).length + ' astride');
  ok('...and none over the rocks', sp.every((c) => R.rectPointDist(rock, c.x, c.y) >= R.UNIT_R - 1e-6));
  const hull = unit('mcv', 'A', 10, 10);
  const hs = R.reachable(world([hull], [wall]), hull, hull.move + 4);
  ok('a Tier IV hull may still stop on a wall, flattening it (p. 35)', hs.some((c) => R.rectPointDist(wall, c.x, c.y) < R.UNIT_R - 1e-6));
})();

console.log('\nA squad that counts as in a wood sees out of it (p. 42)');
(function () {
  // a wood with a narrow ride cut in to the middle: the squad stands in the ride, most of its base under the trees
  const w = { kind: 'woods', x: 8, y: 4, w: 8, h: 12, poly: [[8, 4], [16, 4], [16, 16], [8, 16], [8, 10.3], [11, 10.3], [11, 9.7], [8, 9.7]] };
  const a = unit('regular', 'A', 10, 10), b = unit('regular', 'B', 30, 10), c = unit('regular', 'B', 10, 30);
  const st = world([a, b, c], [w]);
  ok('the squad counts as in the wood', R.kindsUnder(st, a)[0] === 'woods');
  ok('...and sees out of it, east', R.hasLoS(st, a, b));
  ok('...and south', R.hasLoS(st, a, c));
  const d = unit('regular', 'A', 4, 10);
  ok('one standing outside still cannot see through it', !R.hasLoS(world([d, b], [w]), d, b));
})();

console.log('\nIn and out of a building, 4" measured the same way (p. 41)');
(function () {
  const bld = { kind: 'building', x: 20, y: 20, w: 4, h: 4 };
  const out = unit('regular', 'A', 20 - 4 - R.UNIT_R + 0.2, 22);
  const st = world([out], [bld]);
  ok('a squad whose base is 4" off the wall may go in', R.enterTargets(st, out).length === 1);
  R.enterBuilding(st, out, bld, 0);
  const spots = R.exitSpots(st, out);
  const far = Math.max.apply(null, spots.map((c) => R.rectPointDist(bld, c.x, c.y) - R.UNIT_R));
  ok('...and comes out with its base up to 4" off it', far > 3.6 && far <= 4 + 1e-6, far.toFixed(2) + '"');
})();

console.log('\nLow walls are laid up to 6" (p. 42)');
(function () {
  let longest = 0, walls = 0;
  const planets = Object.keys(GEN.GENERATORS);
  for (let i = 0; i < 200; i++) {
    let s = 1000 + i * 7;
    const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    GEN.generate({ width: 48, height: 48, planet: planets[i % planets.length], rand }).terrain.forEach((p) => {
      if (p.kind !== 'barricade') return;
      walls++; longest = Math.max(longest, Math.max(p.w, p.h));
    });
  }
  ok('no low wall is longer than 6"', walls > 0 && longest <= 6 + 1e-6, walls + ' walls, the longest ' + longest.toFixed(2) + '"');
})();

console.log('\nRiders and barbed wire (p. 94, Appendix 3)');
(function () {
  const wire = { kind: 'wire', x: 14, y: 0, w: 0.6, h: 48 };
  const gang = unit('rridergang', 'A', 10, 12);
  ok('a Rider gang on bikes does not cross the wire', !R.reachable(world([gang], [wire]), gang, gang.move + 4).some((c) => c.x > 15));
  const horse = unit('rridergang', 'A', 10, 12, { mount: 'horse' });
  ok('...one on horses jumps it', R.reachable(world([horse], [wire]), horse, horse.move + 4).some((c) => c.x > 15));
  const grav = unit('rridergang', 'A', 10, 12, { mount: 'gravbike', wireRoll: 6 });
  ok('a grav bike pays no D6" for it', R.terrainCost(grav, 'wire') === 0);
  ok('...a man on foot does', R.terrainCost(unit('regular', 'A', 10, 12, { wireRoll: 4 }), 'wire') === 4);
})();

console.log('\nSappers cut barbed wire; nobody shoots it down (p. 43)');
(function () {
  const wire = { kind: 'wire', x: 14, y: 2, w: 0.6, h: 10 };
  const sap = unit('engineers', 'A', 12, 6), gun = unit('shock', 'A', 4, 6), plain = unit('regular', 'A', 12, 8);
  ok('Sappers may set charges against it', R.canCharge(sap, wire));
  ok('...squads without the rule may not', !R.canCharge(plain, wire));
  ok('...nor will a Destructive Weapon shoot it down', R.has(gun, 'Destructive Weapon') && !R.canDemolish(gun, wire));
  const st = world([sap], [wire]);
  R.destroyTerrain(st, wire, [], sap);
  ok('cut, it is a gap anyone may cross for nothing', wire.kind === 'cutwire' && R.terrainCost(unit('regular', 'A', 0, 0, { wireRoll: 6 }), 'cutwire') === 0);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
