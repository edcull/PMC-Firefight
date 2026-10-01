/* Turn 1, once the forces are on the table. Rapid Relocation (O3) comes
   "after deployment in the Reserve phase of the 1st turn": after turn 1's
   initiative roll, and, with both sides holding it, a unit each in turn from
   the side with the initiative. Fortify and Strike! (XO5) follows, "in the first
   turn … after the Xenotripod force is deployed". Nothing acts until both are done. */
'use strict';
const { Engine } = require('../../server/rules.js');
let seed = 777;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const ARMY = ['cmd3', 'regular', 'veterans', 'shock', 'regular', 'veterans'];
function battle(doctrines) {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren', doctrines: doctrines,
    armyA: ARMY, armyB: ARMY,
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  for (const sd of ['A', 'B']) { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); }
  for (let k = 0; k < 20 && e.state().faceAsk; k++) e.intent(e.state().faceAsk.side, { k: 'vfaceall' });
  e.intent('A', { k: 'start' });
  return e;
}
// move one of `side`'s units a few inches, as a tap would
function relocateOne(e, side) {
  const st = e.state();
  const u = st.units.find(x => x.side === side && x.x >= 0 && !x.aboard && st.relocating.moved.indexOf(x.id) < 0);
  const was = { x: u.x, y: u.y };
  e.intent(side, { k: 'relocpick', id: u.id });
  e.intent(side, { k: 'reloctap', x: u.x + 4, y: u.y + 1 });
  for (let k = 0; k < 5 && e.state().faceAsk; k++) e.intent(e.state().faceAsk.side, { k: 'vfaceall' });
  return Math.hypot(u.x - was.x, u.y - was.y) > 0.5;
}

console.log('\nRapid Relocation on both sides');
(function () {
  const e = battle({ A: ['O3'], B: ['O3'] });
  const st = e.state();
  ok('it comes in turn 1, after the initiative roll', st.phase === 'battle' && st.turn === 1 && !!st.initiative && !!st.relocating, JSON.stringify({ phase: st.phase, turn: st.turn, init: st.initiative }));
  const first = st.initiative, second = first === 'A' ? 'B' : 'A';
  ok('...the side with the initiative relocates first', st.relocating.side === first, st.relocating.side);
  const u = st.units.find(x => x.side === first && x.x >= 0);
  const sel = e.intent(first, { k: 'select', id: u.id });
  ok('nothing acts meanwhile', !sel.ok, sel.why);
  ok('the first side moves a unit', relocateOne(e, first));
  ok('...and it is the other side\'s turn', e.state().relocating && e.state().relocating.side === second, e.state().relocating && e.state().relocating.side);
  ok('the second side moves one', relocateOne(e, second));
  ok('...and it is back to the first', e.state().relocating && e.state().relocating.side === first);
  ok('the first side is done', e.intent(first, { k: 'relocdone' }).ok);
  ok('...so the second carries on alone', e.state().relocating && e.state().relocating.side === second);
  ok('...a unit more', relocateOne(e, second) && e.state().relocating && e.state().relocating.side === second);
  e.intent(second, { k: 'relocdone' });
  ok('when both are done, the Action phase begins', !e.state().relocating && !!e.state().phaseCount && e.state().activeSide === first);
})();

console.log('\nRapid Relocation on one side');
(function () {
  const e = battle({ A: ['O3'], B: [] });
  const cap = e.state().relocating && e.state().relocating.cap;
  ok('Player 1 alone relocates', e.state().relocating && e.state().relocating.side === 'A' && cap > 0, 'up to ' + cap);
  for (let k = 0; k < cap; k++) relocateOne(e, 'A');
  ok('at half its force the card stays until it says Done', !!e.state().relocating && e.state().relocating.moved.length === cap && !e.state().phaseCount);
  e.intent('A', { k: 'relocdone' });
  ok('...then the Action phase', !e.state().relocating && !!e.state().phaseCount);
})();

console.log('\nFortify and Strike!');
(function () {
  const e = battle({ A: ['XO5'], B: [] });
  const st = e.state();
  ok('the field fortifications are placed in turn 1, after the initiative roll', st.phase === 'battle' && st.turn === 1 && !!st.placeAsk && st.placeAsk.why === 'fortify',
    JSON.stringify({ phase: st.phase, turn: st.turn, ask: st.placeAsk && st.placeAsk.why }));
  ok('...before the Action phase', !st.phaseCount);
  e.intent('A', { k: 'placedone' });
  ok('then the Action phase begins', !e.state().placeAsk && !!e.state().phaseCount);
})();

console.log('\nHero of the People (H2): half the enemy first, then alternating');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren', doctrines: { A: ['H2'], B: [] },
    armyA: ARMY, armyB: ARMY, nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel' });
  for (const sd of ['A', 'B']) { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); }
  e.intent('A', { k: 'start' });
  const st = e.state(), labels = {};
  st.units.forEach(u => { labels[u.label] = u.side; });
  const seq = st.log.filter(l => / arrives/.test(l.text)).map(l => labels[Object.keys(labels).find(k => l.text.indexOf(k + ' arrives') === 0)]).join('');
  ok('the enemy brings on half its force before the first insurgent, then they alternate, the revolt first', seq === 'BBB' + 'ABABAB' + 'AAA', seq);
  ok('...and the log says why', st.log.some(l => /Hero of the People/.test(l.text)));
})();
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'demolish', attacker: 'B', mode: 'hotseat', planet: 'barren', doctrines: { A: ['H2'], B: [] },
    armyA: ARMY, armyB: ARMY, nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel' });
  ok('where a defender sets up first (no alternating deployment), nothing of the enemy is placed for it', e.state().units.filter(u => u.side === 'B' && u.x >= 0).length === 0);
})();

console.log('\nWithout either');
(function () {
  const e = battle(null);
  ok('the Action phase begins straight after the Reserve phase', e.state().phase === 'battle' && !e.state().relocating && !!e.state().phaseCount);
})();

console.log('\n' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
process.exit(fail ? 1 : 0);
