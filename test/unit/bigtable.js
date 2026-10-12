/* Priority Level 3 on a 6' x 4' table (p. 45; roadmap v0.3 step 5): the table's
   size goes with the battle (48" across, 72" along, the long edges the players'),
   the terrain fills it, every scenario plays out on it, and two battles of
   different sizes run side by side in one process as they do on a server. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
const P = require('../../src/engine/protocol.js');
const SC = global.PMCScen, GEN = global.PMCGen;

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const json = (o) => JSON.stringify(o);
function battle(pl, scen, extra) {
  const e = Engine.create();
  e.start(Object.assign({ tier: 3, pl, scenario: scen || 'secure', armyA: R.rollArmy(3, pl, null, 'pmc'), armyB: R.rollArmy(3, pl, null, 'rebel'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', terrainSetup: 'auto' }, extra || {}));
  return e;
}
function playOut(e) {
  for (let g = 0; g < 40000 && !e.over(); g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) break;
  }
  return e;
}

console.log('\nThe table');
ok('4\' x 4\' at Priority Level 1 and 2; 48" x 72" at 3', json(R.boardFor(1)) === '{"w":48,"h":48}' && json(R.boardFor(2)) === '{"w":48,"h":48}' && json(R.boardFor(3)) === '{"w":48,"h":72}');
ok('Priority Level 3 may be chosen online', P.PLS.indexOf(3) >= 0 && P.cleanSettings({ pl: 3 }).pl === 3);
ok('...the terrain rolled for six 2\' x 2\' areas', GEN.areasOf(48, 72).map((a) => a.name).join() === 'NW,NE,W,E,SW,SE');
{
  const st = battle(3).state();
  const out = st.terrain.filter((t) => t.x < -0.01 || t.y < -0.01 || t.x + t.w > 48.01 || t.y + t.h > 72.01).length;
  ok('a PL3 battle is fought on 48" x 72"', json(st.cfg.board) === '{"w":48,"h":72}' && R.BOARD.h === 72, json(st.cfg.board));
  ok('...its terrain over the whole of it, and none off it', out === 0 && st.terrain.some((t) => t.y > 50), st.terrain.length + ' pieces');
  ok('...a solitaire game stays on 4\' x 4\', whatever its Level', json(battle(2, 's_crush', { solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] }, mode: 'ai' }).state().cfg.board) === '{"w":48,"h":48}');
  ok('Detailed Terrain Knowledge moves three pieces on 6\' x 4\', two on 4\' x 4\'', (R.setBoard({ w: 48, h: 72 }), R.dtkPieces()) === 3 && (R.setBoard({ w: 48, h: 48 }), R.dtkPieces()) === 2);
}

console.log('\nEvery scenario, played out on 6\' x 4\'');
for (const scen of SC.ORDER) {
  const e = playOut(battle(3, scen)), st = e.state();
  const off = st.units.filter((u) => u.alive && u.x >= 0 && (u.x > 48.5 || u.y > 72.5)).length;
  const objOff = (st.objectives || []).filter((o) => o.x > 48 || o.y > 72).length;
  ok(SC.SCENARIOS[scen].name + ': to the end, nobody and nothing off the table', e.over() && !off && !objOff, 'turn ' + st.turn + (st.over ? ', ' + (st.over.winner || 'draw') : ''));
}

console.log('\nTwo battles side by side (a server)');
{
  const big = battle(3, 'meeting'), small = battle(1, 'meeting');
  const step = (e) => { const s = e.state(); if (s.phase === 'deploy') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); } else e.intent(s.activeSide || 'A', { k: 'step' }); };
  let wrong = 0;
  for (let i = 0; i < 300 && !(big.over() && small.over()); i++) {
    if (!big.over()) { step(big); if (R.BOARD.h !== 72) wrong++; }
    if (!small.over()) { step(small); if (R.BOARD.h !== 48) wrong++; }
  }
  const offSmall = small.state().units.filter((u) => u.alive && u.x >= 0 && u.y > 48.5).length;
  ok('each intent is answered on its own battle’s table', wrong === 0 && offSmall === 0, wrong + ' wrong, ' + offSmall + ' off the small table');
  // a battle saved before tables had sizes: 4' x 4'
  const snap = JSON.parse(JSON.stringify(small.snapshot()));
  delete snap.cfg.board;
  R.setBoard({ w: 48, h: 72 });
  const m = Engine.create(); m.load(snap);
  ok('a battle saved before tables had sizes is put back on 4\' x 4\'', R.BOARD.h === 48);
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
