/* The turrets act as one (p. 130): once one has acted, the side's other
   turrets go before anything else does, and the bar says which ones. */
'use strict';
const { Engine } = require('../../server/rules.js');

let checks = 0, bad = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) { console.log('  ✓ ' + what); return true; }
  bad++;
  console.log('  ✗ ' + what + (detail ? ' — ' + detail : ''));
  return false;
}

const e = Engine.create({});
e.start({
  tier: 3, pl: 2, scenario: 'secure',
  armyA: ['regular', 'regular'],
  armyB: ['xalpha1', 'xdturret1', 'xdturret1', 'xdturret1'],
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse'
});
for (let g = 0; g < 4 && e.state().swapAsk; g++) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
for (let g = 0; g < 20 && e.state().phase === 'deploy'; g++) {
  e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
  e.intent('A', { k: 'start' }); e.intent('B', { k: 'start' });
}
const s = e.state();
const turrets = s.units.filter(u => u.side === 'B' && /turret/i.test(u.name));
const squad = s.units.find(u => u.side === 'B' && !/turret/i.test(u.name));
s.units.forEach(u => { u.activated = false; u.sp = 0; u.aboard = null; u.reserve = false; if (u.x < 0) { u.x = 20; u.y = 40; } });
s.activeSide = 'B'; s.mark = null; s.remark = null;
// one turret has acted: the other two are still to go
turrets[0].activated = true;
s.chain = { kind: 'turrets', side: 'B', remaining: 2 };
const q = e.query;
ok('three turrets and a squad on the table', turrets.length === 3 && !!squad);
ok('the turrets still to go may act', q.eligible('B').length === 2 && q.eligible('B').every(u => turrets.indexOf(u) > 0));
const h = q.actionState(squad, 'move');
ok('the squad may not act while the turrets go', !h.on, JSON.stringify(h));
ok('...and the bar says the turrets act as one, naming the ones still to go',
  /turrets act as one/.test(h.hint) && (h.hint.match(/DT\d/g) || []).length === 2, h.hint);
ok('a turret in the chain can at least Skip', q.actionState(turrets[1], 'skip').on);

console.log('\n  ' + (checks - bad) + ' checks passed, ' + bad + ' failed.');
process.exit(bad ? 1 : 0);
