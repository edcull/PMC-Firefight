/* A Suppressed unit "may only move to terrain which provides a Defence bonus,
   or out of the enemy's Line of Sight. If the unit already is in such a terrain
   or place, it cannot move to another one" (p. 34) — and the book counts "area or
   linear terrain", so a low wall is such a place. Played through the engine. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 34;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

// open ground but for one low wall, a Suppressed squad of A's in plain view of B's
function battle(x) {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
    armyA: ['cmd3', 'regular', 'regular', 'regular'], armyB: ['cmd3', 'regular', 'regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  ['A', 'B'].forEach((sd) => { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); });
  ['A', 'B'].forEach((sd) => e.intent(sd, { k: 'start' }));
  const st = e.state();
  st.terrain = [{ kind: 'barricade', x: 26, y: 12, w: 0.5, h: 16 }];
  const sq = st.units.find((u) => u.side === 'A' && u.key === 'regular');
  const foe = st.units.find((u) => u.side === 'B' && u.key === 'regular');
  st.units.forEach((u, i) => { u.activated = false; u.sp = 0; if (u !== sq && u !== foe) { u.x = 4 + 4 * i; u.y = u.side === 'A' ? 2 : 46; } });
  sq.x = x; sq.y = 20; foe.x = 34; foe.y = 20;
  sq.sp = R.currentMorale(sq) + 1; st.activeSide = 'A';
  return { e, st, sq };
}

console.log('\nA low wall is cover to move into');
(function () {
  const { e, st, sq } = battle(20);
  ok('the squad is Suppressed', R.status(sq) === 'suppressed');
  e.intent('A', { k: 'select', id: sq.id });
  const r = e.intent('A', { k: 'action', id: 'move' });
  ok('it may move', r.ok, r.why);
  const behind = e.sel().moves.filter((c) => c.x > 24.5 && c.x < 26 && Math.abs(c.y - 20) < 3);
  ok('...to a spot tight behind the low wall', behind.length > 0, behind.length + ' such spots');
  const open = e.sel().moves.filter((c) => c.x < 23 && Math.abs(c.y - 20) < 3);
  ok('...but not out in the open, still in sight', open.length === 0, open.length + ' open spots');
})();

console.log('\nAlready behind one, it stays');
(function () {
  const { e, sq } = battle(25.3);
  e.intent('A', { k: 'select', id: sq.id });
  ok('a squad already behind the wall has no Move', !e.query.actionState(sq, 'move').on,
    e.query.actionState(sq, 'move').hint);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
