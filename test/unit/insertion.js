/* Battlefield Insertion is the player's choice (p. 56): units with the rule
   "can" come in by it. They start held for it; the player may set one down on
   the table instead, or hold it back again, up to half the army. A unit set
   down on the table deploys like the rest and is not left counted as off it. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 56;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

console.log('\nBattlefield Insertion is a choice (p. 56)');
const e = Engine.create();
// four nomad squads with the rule among eight: half the army may come in by it
const armyA = ['cmd2', 'regular', 'regular', 'regular', 'nomads', 'nomads', 'nomads', 'nomads'];
e.start({
  tier: 3, pl: 1, scenario: 'meeting', mode: 'ai', planet: 'barren',
  armyA: armyA, armyB: R.rollArmy(3, 1, null, 'pmc'), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
});
const st = e.state();
const nomads = st.units.filter((u) => u.side === 'A' && u.key === 'nomads');
const ins = e.query.insertionFor('A');
ok('the player is offered the choice', !!ins && ins.units.length === 4, ins && ins.used + ' of up to ' + ins.cap);
ok('...and the units start held for insertion', nomads.every((u) => u.reserve));
const n0 = nomads[0];
ok('one can be set down on the table instead', e.intent('A', { k: 'insertion', id: n0.id }).ok && !n0.reserve && n0.x < 0);
ok('...or held for insertion again', e.intent('A', { k: 'insertion', id: n0.id }).ok && n0.reserve);
e.intent('A', { k: 'insertion', id: n0.id });
const cmd = st.units.find((u) => u.side === 'A' && u.key === 'cmd2');
ok('a unit without the rule is not offered it', !e.intent('A', { k: 'insertion', id: cmd.id }).ok);
// both companies enter in turn 1 (p. 50): the one let go comes on with the rest; insertion never in turn 1 (p. 56)
e.intent('A', { k: 'autodeploy' });
e.intent('A', { k: 'start' });
ok('...and enters with the rest in turn 1', st.phase === 'battle' && st.turn === 1 && n0.x >= 0 && !n0.reserve, n0.x + ',' + n0.reserve);
ok('...while those held for insertion wait: never in turn 1', nomads.slice(1).every((u) => u.reserve && u.x < 0));

// six with the rule among eight: four held, and a fifth is refused
const e2 = Engine.create();
e2.start({
  tier: 3, pl: 1, scenario: 'meeting', mode: 'ai', planet: 'barren',
  armyA: ['cmd2', 'regular', 'nomads', 'nomads', 'nomads', 'nomads', 'nomads', 'nomads'],
  armyB: R.rollArmy(3, 1, null, 'pmc'), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
});
const i2 = e2.query.insertionFor('A');
ok('with six that have the rule, four start held', i2.used === 4 && i2.cap === 4, i2.used + ' of ' + i2.cap);
const spare = e2.state().units.find((u) => u.side === 'A' && u.key === 'nomads' && !u.reserve);
const more = e2.intent('A', { k: 'insertion', id: spare.id });
ok('...and a fifth is refused: no more than half the army', !more.ok, more.why);

console.log('\nIn a scenario with reserves, inserters are held back with the rest');
(function () {
  const SC = global.PMCScen;
  const e3 = Engine.create();
  e3.start({
    tier: 3, pl: 1, scenario: 'find', mode: 'ai', planet: 'barren',
    armyA: ['cmd2', 'regular', 'regular', 'regular', 'nomads', 'nomads', 'nomads', 'nomads'],
    armyB: R.rollArmy(3, 1, null, 'pmc'), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  const st3 = e3.state(), sp = e3.query.splitFor('A');
  const nm = st3.units.filter((u) => u.side === 'A' && u.key === 'nomads');
  ok('they are in the scenario\'s own split', nm.every((u) => sp.units.some((x) => x.id === u.id)));
  ok('...not in a list of their own', !e3.query.insertionFor('A'));
  ok('...and, like the rest, none starts held back', sp.held === 0 && nm.every((u) => !u.reserve));
  e3.intent('A', { k: 'holdback', id: nm[0].id });
  const sp2 = e3.query.splitFor('A');
  ok('held back, an inserter counts toward the scenario\'s reserves', sp2.held === 1);
  ok('...and comes in by insertion, not on the scenario\'s schedule', nm[0].insert === true &&
    SC.reserves(st3, 'A').indexOf(nm[0]) < 0 && sp2.units.find((x) => x.id === nm[0].id).insert);
  const reg = st3.units.find((u) => u.side === 'A' && u.key === 'regular');
  e3.intent('A', { k: 'holdback', id: reg.id });
  ok('a unit without the rule held back waits for the scenario', !reg.insert);
  e3.intent('A', { k: 'holdback', id: nm[0].id });
  ok('let go again, it is on the table like any other', !nm[0].reserve && !nm[0].insert);
})();

console.log('\nMimicry: the player picks up to a quarter (p. 124)');
(function () {
  const e2 = Engine.create();
  // Mimicry lets up to a quarter, rounded down, come in by insertion (review a119ac2 BUG-2)
  const swarm = R.rollArmy(3, 1, null, 'bugs');
  e2.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'ai', planet: 'barren', factionA: 'bugs',
    armyA: swarm, armyB: R.rollArmy(3, 1, null, 'pmc'), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel',
    doctrines: { A: ['BB2'], B: [] } });
  const s2 = e2.state();
  const mine = s2.units.filter((u) => u.side === 'A');
  const cap = Math.floor(mine.length / 4);
  const offered = mine.filter((u) => u.mimic);
  ok('every unit without the rule is offered it', offered.length > cap,
    offered.length + ' offered, ' + cap + ' may use it');
  ok('...the Leader Bugs and Overgrown bugs among them', mine.filter((u) => R.has(u, 'Overmind') || R.has(u, 'Overgrown')).every((u) => u.mimic || R.has(u, 'Battlefield Insertion')),
    mine.filter((u) => R.has(u, 'Overmind') || R.has(u, 'Overgrown')).map((u) => u.name + (u.mimic ? '+' : '-')).join(', '));
  ok('...no more than a quarter start held for it', offered.filter((u) => u.reserve).length <= cap);
  const held = offered.filter((u) => u.reserve), free = offered.filter((u) => !u.reserve);
  if (held.length === cap && free.length) {
    ok('...the quarter is the limit', !e2.intent('A', { k: 'insertion', id: free[0].id }).ok);
    ok('...but the player may swap which', e2.intent('A', { k: 'insertion', id: held[0].id }).ok &&
      e2.intent('A', { k: 'insertion', id: free[0].id }).ok && free[0].reserve && !held[0].reserve);
  } else ok('the quarter is taken at the start', false, held.length + ' held of ' + cap);
})();

console.log('\nMimicry and Underground Advance round the quarter down (review a119ac2 BUG-2)');
(function () {
  function capFor(n, doc, faction, army) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'ai', planet: 'barren', factionA: faction,
      armyA: army.slice(0, n), armyB: ['regular', 'regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel',
      doctrines: { A: [doc], B: [] } });
    return { cap: e.state().mimicCap.A, units: e.state().units.filter((u) => u.side === 'A') };
  }
  const bugs = ['bsmall', 'bsmall', 'bsmall', 'bsmall', 'bsmall', 'bsmall', 'bsmall', 'bsmall', 'bwatchers'];
  ok('nine units: two may come in by Mimicry', capFor(9, 'BB2', 'bugs', bugs).cap, 2);
  ok('three units: none', capFor(3, 'BB2', 'bugs', bugs).cap === undefined);
  const tribe = ['xalpha3', 'xbeta3', 'xbeta3', 'xbeta3', 'xbeta3'];
  const t = capFor(5, 'XO2', 'xeno', tribe);
  ok('five of a tribe: one by Underground Advance', t.cap, 1);
  ok('...and an Alpha squad may be the one', t.units.some((u) => u.key === 'xalpha3' && u.mimic));
  // XEN-9: any unit without Battlefield Insertion, an aircraft too
  const air = capFor(4, 'XO2', 'xeno', ['xalpha3', 'xbeta3', 'xbeta3', 'xshieldb']);
  ok('...an aircraft too (XEN-9)', air.units.some((u) => u.key === 'xshieldb' && u.mimic));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
