/* An AI tribe holds its teleport turrets back for Battlefield Insertion — ahead of
   anything else that may come in by it, defensive turrets included — and brings
   them down from turn 2, rather than standing them in its deployment zone. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 23;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const isTT = (u) => R.has(u, 'Teleport') && R.has(u, 'Turret');
function battle(scenario, army) {
  const e = Engine.create();
  e.start({ tier: 4, pl: 1, mode: 'demo', planet: 'sparse', scenario, nameA: 'I', nameB: 'K', colourA: 'ochre', colourB: 'steel',
    armyA: R.rollArmy(4, 1), armyB: army });
  for (let g = 0; g < 50; g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    break;
  }
  return e;
}

console.log('\nThe AI holds its teleport turrets back');
(function () {
  // more units with Battlefield Insertion than half the force may hold: defensive turrets and teleport turrets both
  const army = ['xalpha3', 'xdturret4', 'xtturret4', 'xbeta2', 'xbeta2', 'xbeta2'];
  let held = 0, all = 0, mixed = 0;
  ['meeting', 'secure', 'find', 'demolish', 'takeover'].forEach((sc) => {
    const e = battle(sc, army), B = e.state().units.filter((u) => u.side === 'B');
    const tt = B.filter(isTT);
    all += tt.length; held += tt.filter((u) => u.reserve).length;
    if (B.some((u) => R.has(u, 'Turret') && !isTT(u) && R.has(u, 'Battlefield Insertion'))) mixed++;
  });
  ok('the force has defensive turrets competing for the places', mixed > 0, mixed + ' of 5');
  ok('every teleport turret is held back, in every scenario that allows insertion', all > 0 && held === all, held + ' of ' + all);
})();

console.log('\n...and brings them down in the battle');
(function () {
  const e = battle('meeting', ['xalpha3', 'xtturret4', 'xbeta2', 'xbeta2', 'xbeta2', 'xbeta2']);
  const came = {};
  for (let g = 0; g < 4000 && !e.over() && e.state().turn <= 3; g++) {
    const s = e.state();
    s.units.forEach((u) => { if (u.side === 'B' && isTT(u) && u.x >= 0 && came[u.id] == null) came[u.id] = s.turn; });
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) {
      const sel = e.sel();
      if (!sel.insertion) break;
      const sp = (sel.insertion.spots || [])[0];
      e.intent(sel.insertion.by || sel.insertion.unit.side, sp ? { k: 'insert', x: sp.x, y: sp.y } : { k: 'holdinsert' });
    }
  }
  const n = e.state().units.filter((u) => u.side === 'B' && isTT(u)).length;
  ok('they come down by turn 3', Object.keys(came).length === n && n > 0, JSON.stringify(came));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
