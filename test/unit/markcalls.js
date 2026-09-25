/* Markerlights, one call at a time (p. 58).

   A marker names a target and one friendly unit answers it. One that stood
   still then names a second target (the same enemy again, or another) and a
   second unit answers that. One that moved first gets a single call. Designate
   calls Indirect Fire units, Mark calls direct fire. Every unit that answers
   has had its activation for the turn. */
'use strict';
const { R, Engine } = require('../../server/rules.js');

let checks = 0, bad = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) { console.log('  ✓ ' + what); return true; }
  bad++;
  console.log('  ✗ ' + what + (detail ? ' — ' + detail : ''));
  return false;
}

// a hotseat battle with the forces laid out by hand: a marker, two mortars, two rifle squads; two enemy squads
function battle() {
  const e = Engine.create({});
  e.start({
    tier: 3, pl: 2, scenario: 'secure',
    armyA: ['observers', 'mortarteam', 'mortarteam', 'regular', 'regular'],
    armyB: ['regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse'
  });
  for (let g = 0; g < 4 && e.state().swapAsk; g++) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
  for (let g = 0; g < 20 && e.state().phase === 'deploy'; g++) {
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
    e.intent('A', { k: 'start' }); e.intent('B', { k: 'start' });
  }
  const s = e.state();
  s.terrain = [];                                    // an open table: nothing in the way of sight
  const by = id => s.units.find(u => u.id === id);
  const at = (id, x, y) => { const u = by(id); u.x = x; u.y = y; u.bld = null; u.aboard = null; u.reserve = false; u.sp = 0; u.activated = false; };
  at('A0', 10, 18);                                  // the observers
  at('A1', 4, 6); at('A2', 4, 30);                   // mortars, well back
  at('A3', 12, 12); at('A4', 12, 24);                // rifles, within sight and range
  at('B0', 26, 14); at('B1', 26, 22);
  s.activeSide = 'A'; s.streak = 1; s.chain = null; s.mark = null; s.remark = null;
  s.units.forEach(u => { u.activated = false; });
  return { e, s, by };
}
const fired = s => s.units.filter(u => u.side === 'A' && u.activated).map(u => u.id).sort().join(',');

console.log('\nDesignate, standing still');
{
  const { e, s, by } = battle();
  ok('the observers can designate', e.intent('A', { k: 'select', id: 'A0' }).ok && e.intent('A', { k: 'action', id: 'designate' }).ok);
  ok('...a target', e.intent('A', { k: 'target', id: 'B0' }).ok);
  ok('one call goes out, on that one target', s.mark && s.mark.targets.length === 1 && s.mark.targets[0] === by('B0') && s.mark.again,
    JSON.stringify(s.mark && { t: s.mark.targets.map(t => t.id), again: s.mark.again }));
  ok('...only a mortar may answer it', e.intent('A', { k: 'select', id: 'A3' }).ok && !e.intent('A', { k: 'action', id: 'fire' }).ok);
  e.intent('A', { k: 'select', id: 'A1' });
  ok('the first mortar answers', e.intent('A', { k: 'action', id: 'fire' }).ok && e.intent('A', { k: 'target', id: 'B0' }).ok);
  ok('then the observers, who stood still, name a second target', !!s.remark && s.remark.by === 'A0' && e.sel().mode === 'designate' &&
    e.sel().selected && e.sel().selected.id === 'A0', JSON.stringify(s.remark));
  ok('...nothing else may be picked meanwhile', !e.intent('A', { k: 'select', id: 'A3' }).ok);
  ok('...the other enemy, this time', e.intent('A', { k: 'target', id: 'B1' }).ok && s.mark && s.mark.targets[0] === by('B1') && !s.mark.again);
  e.intent('A', { k: 'select', id: 'A2' });
  ok('the second mortar answers that', e.intent('A', { k: 'action', id: 'fire' }).ok && e.intent('A', { k: 'target', id: 'B1' }).ok);
  ok('the call is over', !s.mark && !s.remark && !s.chain);
  ok('the marker and both mortars have had their activations', fired(s) === 'A0,A1,A2', fired(s));
}

console.log('\nMark, the same target twice');
{
  const { e, s, by } = battle();
  e.intent('A', { k: 'select', id: 'A0' }); e.intent('A', { k: 'action', id: 'marktarget' });
  e.intent('A', { k: 'target', id: 'B0' });
  ok('a mark calls direct fire: a rifle squad answers, a mortar cannot', (() => {
    e.intent('A', { k: 'select', id: 'A1' });
    const mortar = e.intent('A', { k: 'action', id: 'fire' }).ok;
    if (mortar) e.intent('A', { k: 'cancel' });
    e.intent('A', { k: 'select', id: 'A3' });
    return !mortar && e.intent('A', { k: 'action', id: 'fire' }).ok && e.intent('A', { k: 'target', id: 'B0' }).ok;
  })());
  ok('the marker marks the same enemy again', !!s.remark && e.intent('A', { k: 'target', id: 'B0' }).ok && s.mark && s.mark.targets[0] === by('B0'));
  e.intent('A', { k: 'select', id: 'A4' });
  ok('...and the second rifle squad answers', e.intent('A', { k: 'action', id: 'fire' }).ok && e.intent('A', { k: 'target', id: 'B0' }).ok);
  ok('the answers count as activated', fired(s) === 'A0,A3,A4', fired(s));
}

console.log('\nA marker that moved');
{
  const { e, s } = battle();
  e.intent('A', { k: 'select', id: 'A0' }); e.intent('A', { k: 'action', id: 'designate' });
  ok('moves first', e.intent('A', { k: 'markmove', x: 11, y: 18 }).ok && by0(s).markMoved);
  e.intent('A', { k: 'target', id: 'B0' });
  ok('...and makes one call', s.mark && !s.mark.again);
  e.intent('A', { k: 'select', id: 'A1' }); e.intent('A', { k: 'action', id: 'fire' }); e.intent('A', { k: 'target', id: 'B0' });
  ok('after its one answer there is no second call', !s.remark && !s.mark && !s.chain, JSON.stringify({ remark: s.remark, chain: s.chain }));
  ok('...the marker and one mortar have acted', fired(s) === 'A0,A1', fired(s));
}
function by0(s) { return s.units.find(u => u.id === 'A0'); }

console.log('\nLetting the second call go');
{
  const { e, s } = battle();
  e.intent('A', { k: 'select', id: 'A0' }); e.intent('A', { k: 'action', id: 'designate' }); e.intent('A', { k: 'target', id: 'B0' });
  e.intent('A', { k: 'select', id: 'A1' }); e.intent('A', { k: 'action', id: 'fire' }); e.intent('A', { k: 'target', id: 'B0' });
  ok('Cancel lets the second call go', !!s.remark && e.intent('A', { k: 'cancel' }).ok && !s.remark && !s.chain);
  ok('...and the activation passes on', s.activeSide === 'B' || fired(s) === 'A0,A1', s.activeSide + ' ' + fired(s));
}

console.log('\n' + checks + ' checks, ' + bad + ' failed.');
process.exit(bad ? 1 : 0);
