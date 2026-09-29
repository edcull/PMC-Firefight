/* How fast the rules run, held to a generous ceiling.

   The movement search is most of what the OpFor spends its time on, and it
   was once a scan of every open point on every step: a battle played by the
   AI on both sides took four seconds. These two runs catch a slide back to
   anything like that. The ceilings are several times what they take here, so
   a slow machine passes and only a real regression fails. */
'use strict';
global.window = global;
const { R, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(what, ms, limit) {
  const good = ms <= limit;
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + what + ' — ' + ms + ' ms (ceiling ' + limit + ' ms)');
}
const real = Math.random;
function seeded(n) { let s = n; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// 100 searches for where a squad can get to, from all over a dense table
seeded(7);
const G = global.PMCGen;
const terr = G.generate({ width: 48, height: 48, planet: 'dense' }).terrain;
const p = R.profile('regular');
const u = { id: 'u', side: 'A', key: 'regular', code: p.code, cls: 'infantry', models: 6, move: 6, rules: p.rules.slice(), x: 10, y: 10, alive: true, facing: 0, cargo: [] };
const st = { units: [u], terrain: terr, objectives: [], log: [] };
let t0 = Date.now(), n = 0;
for (let i = 0; i < 100; i++) { u.x = 6 + (i * 1.7) % 36; u.y = 6 + (i * 2.3) % 36; n += R.reachable(st, u, 8).length; }
ok('100 reachability searches on a dense table', Date.now() - t0, 3000);

// a whole battle, the AI on both sides
seeded(11);
const e = Engine.create();
t0 = Date.now();
e.start({ tier: 3, pl: 2, scenario: 'meeting', armyA: R.rollArmy(3, 2, null, 'pmc'), armyB: R.rollArmy(3, 2, null, 'rebel'),
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'dense' });
for (let guard = 0; !e.over() && guard < 20000; guard++) {
  const s = e.state();
  if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
  if (s.phase === 'deploy') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); if (e.state().phase === 'deploy') break; continue; }
  const r = e.intent(s.activeSide || 'A', { k: 'step' });
  if (!r.ok) {
    const sel = e.sel();
    if (e.state().faceAsk) { e.intent(e.state().faceAsk.side, { k: 'vfaceall' }); continue; }
    if (e.state().endAsk) { e.intent(e.state().endAsk.side, { k: 'enddone' }); continue; }
    if (sel.insertion) { const sp = (sel.insertion.spots || [])[0]; e.intent(sel.insertion.by || 'A', sp ? { k: 'insert', x: sp.x, y: sp.y } : { k: 'holdinsert' }); continue; }
    break;
  }
}
const took = Date.now() - t0;
Math.random = real;
console.log('  (the battle ran to turn ' + e.state().turn + (e.over() ? ', finished' : ', unfinished') + ')');
ok('a battle played out by the AI on both sides', took, 12000);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
