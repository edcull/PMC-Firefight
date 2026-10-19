/* The computer's forces choose what each unit does instead of rolling on the
   behaviour table (p. 147), and concentrate their fire. The same rules and dice
   otherwise. The solitaire OpFor keeps the book's table, and so does a side a test
   or the measuring harness marks cfg.aiRolled. */
'use strict';
const { R, Engine, SOLO } = require('../../server/rules.js');
let seed = 31;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function run(e, steps) {
  for (let g = 0; g < steps && !e.over(); g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) break;
  }
  return e.state().log.map((l) => l.text || '');
}
const count = (L, side, re) => L.filter((t) => t.indexOf('[' + side + ']') >= 0 && re.test(t)).length;

console.log('\nThe computer chooses');
(function () {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'rebel'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto' });
  const L = run(e, 1500);
  const chose = count(L, 'A', / — chooses: /) + count(L, 'B', / — chooses: /), rolled = count(L, 'A', / — behaviour D6 /) + count(L, 'B', / — behaviour D6 /);
  ok('both computer sides choose', chose > 10 && rolled === 0, chose + ' choices, ' + rolled + ' rolls');
  ok('...and never choose to run', !L.some((t) => / — chooses: .*: flee\./.test(t)));
})();

console.log('\n...unless a side is marked to roll (the tests, the measuring harness)');
(function () {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'rebel'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto',
    aiRolled: { A: true, B: true } });
  const L = run(e, 1500);
  const chose = count(L, 'A', / — chooses: /) + count(L, 'B', / — chooses: /), rolled = count(L, 'A', / — behaviour D6 /) + count(L, 'B', / — behaviour D6 /);
  ok('both sides roll the behaviour table', rolled > 10 && chose === 0, rolled + ' rolls, ' + chose + ' choices');
  ok('it is no optional rule a game can set', !R.OPTIONS.some((d) => /rolled|classic/i.test(d.key)) && !R.cleanOptions({ rolledAI: true }).rolledAI);
  // (and one side alone, as the measuring harness asks)
  const e2 = Engine.create();
  e2.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'rebel'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto',
    aiRolled: { B: true } });
  const L2 = run(e2, 1500);
  ok('...or for one side only', count(L2, 'A', / — chooses: /) > 3 && count(L2, 'A', / — behaviour D6 /) === 0 &&
    count(L2, 'B', / — behaviour D6 /) > 3 && count(L2, 'B', / — chooses: /) === 0);
})();

console.log('\n...but the solitaire OpFor keeps the book’s table');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_crush', armyA: SOLO.rollCommando(3, 1, 'pmc'), armyB: SOLO.rollOpFor(3, 1, 'rebel', false),
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
    solo: { coop: false, faction: 'pmc', opFaction: 'rebel', names: ['A'] } });
  const L = run(e, 1500);
  ok('the OpFor rolls its behaviour', count(L, 'B', / — behaviour D6 /) > 5 && count(L, 'B', / — chooses: /) === 0,
    count(L, 'B', / — behaviour D6 /) + ' rolls');
})();

console.log('\nThe choosing AI finishes what it has started');
(function () {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: ['cmd2', 'regular', 'regular', 'regular'], armyB: ['cmd2', 'regular', 'regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto' });
  run(e, 40);
  const st = e.state();
  st.terrain = [];
  const u = st.units.find((x) => x.side === 'A' && x.key === 'regular'), [a, b] = st.units.filter((x) => x.side === 'B' && x.key === 'regular');
  st.units.forEach((x) => { if (x.side === 'B' && x !== a && x !== b) x.alive = false; });
  // (whatever the opening moves did to them: whole, on the table, steady)
  [u, a, b].forEach((x) => { x.alive = true; x.models = x.startSize; x.aboard = null; x.bld = null; x.reserve = false; x.hidden = false; x.sp = 0; });
  u.x = 30; u.y = 16; a.x = 27; a.y = 24; b.x = 33; b.y = 24;
  b.models = Math.max(1, b.models - 3);
  st.cfg.aiRolled = { A: true };
  const norm1 = e.query.bestTarget(u).t;
  st.cfg.aiRolled = null;
  const hard1 = e.query.bestTarget(u).t;
  a.models = Math.max(1, a.startSize - 3); b.models = b.startSize;
  const hard2 = e.query.bestTarget(u).t;
  ok('a side rolling the table shoots the fuller squad, the bigger mark', norm1 === a, norm1 && norm1.id);
  ok('the choosing AI the hurt one, whichever it is', hard1 === b && hard2 === a, (hard1 && hard1.id) + ', ' + (hard2 && hard2.id));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
