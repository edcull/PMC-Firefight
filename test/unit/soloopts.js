/* Solitaire as the owner wants it in v0.3 (docs/roadmap.md, step 3): Evacuation's
   militia from the player's own army, an OpFor chosen by hand under the OpFor
   table, and the table laid by hand. */
'use strict';
const { R, Engine, SOLO } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function solo(scenario, faction, extra) {
  const e = Engine.create();
  e.start(Object.assign({ tier: 3, pl: 1, scenario, armyA: SOLO.rollCommando(3, 1, faction), armyB: SOLO.rollOpFor(3, 1, 'pmc', false),
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'sparse',
    solo: { coop: false, faction, opFaction: 'pmc', names: ['A'] } }, extra || {}));
  return e;
}

console.log('\nEvacuation: the militia is the player’s own army (p. 153)');
const want = { pmc: 'Regular rifle team', rebel: 'Organized insurgents', bugs: 'Attack forms', xeno: 'Core Epsilon troopers' };
for (const f of Object.keys(want)) {
  const mil = solo('s_evac', f).state().units.filter((u) => u.soloMilitia);
  ok(f + ': one militia unit, ' + want[f] + ' of the Battle Tier', mil.length === 1 && mil[0].name === 'Militia (' + want[f] + ')' && mil[0].faction === f && mil[0].tier === 3,
    mil.map((u) => u.name + '/' + u.faction).join());
}
{
  const bugs = solo('s_evac', 'bugs').state().units.filter((u) => u.soloMilitia)[0];
  ok('...its statline only, but a bug is still a bug', bugs.rules.join() === 'Determined,Animal Behaviour', bugs.rules.join());
  const vets = solo('s_evac', 'pmc', { tier: 5, armyA: SOLO.rollCommando(5, 1, 'pmc') }).state().units.filter((u) => u.soloMilitia)[0];
  ok('...no special rules for anyone else (Rangers without Determined)', vets.name === 'Militia (Rangers)' && !vets.rules.length, vets.rules.join());
  const big = solo('s_evac', 'bugs', { tier: 5, armyA: SOLO.rollCommando(5, 1, 'bugs') }).state().units.filter((u) => u.soloMilitia)[0];
  ok('...a Tier V swarm sends Oversized attack forms, not a Fire beetle', big.name === 'Militia (Oversized attack forms)' && big.cls === 'infantry', big.name);
}
{
  // co-op: a militia unit each, each from its owner's army
  const e = Engine.create(), a = SOLO.rollCommando(3, 1, 'xeno'), b = SOLO.rollCommando(3, 1, 'rebel');
  e.start({ tier: 3, pl: 2, scenario: 's_evac', armyA: a.concat(b), ownersA: a.map(() => 1).concat(b.map(() => 2)), armyB: SOLO.rollOpFor(3, 2, 'pmc', false),
    nameA: 'A & B', nameB: 'OpFor', colourA: 'ochre', colourC: 'cobalt', colourB: 'steel', mode: 'ai', planet: 'sparse',
    solo: { coop: true, faction: 'xeno', opFaction: 'pmc', names: ['A', 'B'] } });
  const mil = e.state().units.filter((u) => u.soloMilitia).map((u) => u.owner + ':' + u.faction).sort().join();
  ok('co-op: a militia unit each, from each player’s own army', mil === '1:xeno,2:rebel', mil);
}

console.log('\nThe OpFor chosen by hand (p. 148)');
{
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const f = ['pmc', 'rebel', 'bugs', 'xeno'][i % 4], bt = 1 + (i % 5), pl = 1 + ((i >> 2) % 2), m = { ground: i % 3 === 0, air: i % 5 === 0 };
    if (!SOLO.checkOpFor(SOLO.rollOpFor(bt, pl, f, m), bt, pl, f, m).ok) bad++;
  }
  ok('every pool the dice roll is a legal one by the same check', bad === 0, bad + ' of 200');
  const c0 = SOLO.checkOpFor([], 3, 1, 'pmc');
  ok('an empty pool is not', !c0.ok && /No units/.test(c0.faults.join()));
  const over = SOLO.checkOpFor(['rangers', 'rangers', 'rangers', 'rangers', 'rangers'], 3, 1, 'pmc');
  ok('over the points, or over a Tier’s share, is refused', !over.ok && /Over budget/.test(over.faults.join()) && /At most 2 Tier V/.test(over.faults.join()), over.faults.join(' | '));
  const mix = SOLO.checkOpFor(['regular', 'rinsurgents'], 3, 1, 'pmc');
  ok('one army list only', !mix.ok && /one army list/.test(mix.faults.join()));
  const k = SOLO.rollOpFor(3, 1, 'pmc', false).filter((x) => R.profile(R.splitPick(x).key).cls === 'infantry' && !/Anti-tank/.test(R.profile(R.splitPick(x).key).rules.join()));
  const noAnswer = SOLO.checkOpFor(k, 3, 1, 'pmc', { ground: true });
  ok('no answer to the players’ hulls is a warning, not a fault (the book says "should")', noAnswer.warnings.length === 1 && !noAnswer.faults.some((f) => /answer/.test(f)), noAnswer.warnings.join());
}

console.log('\nThe table laid by hand');
for (const scen of SOLO.ORDER) {
  const e = solo(scen, 'pmc', { terrainSetup: 'manual', planet: 'dense' });
  let st = e.state(), g = 0;
  const opened = st.phase === 'terrain';
  while (st.phase === 'terrain' && g++ < 50 && e.intent('A', { k: 'terrain', act: 'tauto' }).ok) st = e.state();
  ok(SOLO.SCENARIOS[scen].name + ': the player lays the table, then the scenario sets up on it', opened && st.phase === 'deploy' && st.terrain.length > 0 &&
    st.units.some((u) => u.side === 'A'), st.phase + ', ' + st.terrain.length + ' pieces');
}

console.log('\nThe counters and objectives moved by hand');
function placing(scen) {
  const e = solo(scen, 'pmc', { solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'], handPlace: true } });
  return e;
}
{
  const off = solo('s_crush', 'pmc');
  ok('off (the default): nothing may be moved', !off.intent('A', { k: 'marker', kind: 'counter', i: 0, x: 24, y: 24 }).ok);
  const e = placing('s_crush'), st = e.state(), cs = st.sc.counters;
  ok('on: the game lays them out first, as ever', st.phase === 'deploy' && cs.length > 0);
  // a spot 6" clear of every other counter, on open ground
  let spot = null;
  for (let x = 4; x <= 44 && !spot; x += 1) for (let y = 4; y <= 44 && !spot; y += 1) {
    if (cs.every((c, j) => j === 0 || Math.hypot(c.x - x, c.y - y) >= 6.5) && !R.TERRAIN[R.terrainAt(st, x, y)].impassable) spot = { x, y };
  }
  const r = e.intent('A', { k: 'marker', kind: 'counter', i: 0, x: spot.x, y: spot.y });
  ok('a counter goes where the player puts it', r.ok && cs[0].x === spot.x && cs[0].y === spot.y, JSON.stringify(spot));
  const tooNear = e.intent('A', { k: 'marker', kind: 'counter', i: 1, x: spot.x + 2, y: spot.y });
  ok('...but not within 6" of another', !tooNear.ok && /6" apart/.test(tooNear.why || ''), tooNear.why);
  ok('...nor off the edge of the table', !e.intent('A', { k: 'marker', kind: 'counter', i: 1, x: 1, y: 24 }).ok);
  ok('...and not by the OpFor', !e.intent('B', { k: 'marker', kind: 'counter', i: 1, x: 30, y: 30 }).ok);
}
{
  const e = placing('s_decap'), st = e.state(), ls = st.units.filter((u) => u.soloLeader);
  ok('Decapitation: none within 12" of a table corner', !e.intent('A', { k: 'marker', kind: 'counter', i: 0, x: 5, y: 5 }).ok);
  // every counter as far from the leaders as the rules let it go: the battle will not start
  st.sc.counters.forEach((c) => { c.x = 24; c.y = 24; });
  let far = 0;
  st.sc.counters.forEach((c, i) => {
    for (let t = 0; t < 400; t++) {
      const x = 13 + Math.random() * 22, y = 13 + Math.random() * 22;
      if (ls.every((l) => Math.hypot(l.x - x, l.y - y) > 12.5) && e.intent('A', { k: 'marker', kind: 'counter', i, x, y }).ok) { far++; break; }
    }
  });
  const blk = st.scen.startBlock(st);
  ok('...and fewer than half near a leader holds the start back, saying why', far > st.sc.counters.length / 2 ? /half the counters/.test(blk || '') : true, blk || far + ' moved');
}
{
  const e = placing('s_sabotage'), st = e.state(), tg = st.sc.targets;
  ok('Sabotage: an objective may be moved too, but not within 12" of the edge', !e.intent('A', { k: 'marker', kind: 'target', i: 0, x: 6, y: 24 }).ok);
  ok('...nor within ' + st.sc.targetApart + '" of another objective', !e.intent('A', { k: 'marker', kind: 'target', i: 0, x: tg[1].x + 1, y: tg[1].y }).ok);
  ok('as the game laid them, the battle may start', !st.scen.startBlock(st), st.scen.startBlock(st));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
