/* Close Encounters' dangerous and burning sections, and the special equipment
   carried in (Appendix 1, p. 159): explosions, fires, "We can't have any firing
   in there", and Satchel Charges, the Ballistic Barrier, Stun, Incendiary and
   Vacuum charges — each once, by any unsuppressed unit. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
const CMP = global.PMCCompound;

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// the dice made to fall one way while `fn` runs
function dice(v, fn) { const was = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = was; } }

/* A battle at its first Action phase, handed to two players on a table of our own:
   a corridor along the top, and a room below it (x 15-24, y 24-33). */
function stage(armyA, armyB, extra) {
  const e = Engine.create();
  e.start(Object.assign({ tier: 3, pl: 1, scenario: 'ce_clear', armyA, armyB, nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' }, extra || {}));
  for (let g = 0; g < 400; g++) {
    const s = e.state();
    if (s.phase === 'battle' && s.phaseCount) break;
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    e.intent(s.activeSide || 'A', { k: 'step' });
  }
  const st = e.state();
  st.cfg.aiSides = [];
  st.terrain = [
    { kind: 'corridor', x: 0, y: 21, w: 36, h: 3, axis: 'h' }, { kind: 'room', x: 15, y: 24, w: 9, h: 9, name: 'Room 1' },
    { kind: 'bulkhead', x: 0, y: 0, w: 48, h: 21 }, { kind: 'bulkhead', x: 36, y: 21, w: 12, h: 3 },
    { kind: 'bulkhead', x: 0, y: 24, w: 15, h: 24 }, { kind: 'bulkhead', x: 24, y: 24, w: 24, h: 24 }, { kind: 'bulkhead', x: 15, y: 33, w: 9, h: 15 }
  ];
  st.compound = { cell: 3, cols: 16, rows: 16, entries: { L: [], R: [] } };
  st.units.forEach((u) => { u.x = -1; u.y = -1; u.reserve = true; u.activated = false; u.sp = 0; u.hidden = false; });
  st.activeSide = 'A';
  return { e, st, room: st.terrain[1] };
}
function put(u, x, y) { u.x = x; u.y = y; u.reserve = false; u.hidden = false; u.activated = false; }
const text = (st) => st.log.map((l) => l.text).join('\n');

console.log('\nThe kit');
{
  ok('the standard set: one of each but Vacuum Charges, a Priority Level', JSON.stringify(CMP.defaultKit(2)) === '{"satchel":2,"barrier":2,"stun":2,"incendiary":2}');
  ok('a choice is kept to 4 pieces a Priority Level', JSON.stringify(CMP.cleanKit({ satchel: 3, vacuum: 9, bogus: 2 }, 1)) === '{"satchel":3,"vacuum":1}');
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'ce_clear', armyA: ['regular'], armyB: ['regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
    kit: { A: { incendiary: 2, vacuum: 2 } } });
  ok('each side carries what it chose, or the standard set', JSON.stringify(e.state().kit) === '{"A":{"incendiary":2,"vacuum":2},"B":{"satchel":1,"barrier":1,"stun":1,"incendiary":1}}', JSON.stringify(e.state().kit));
}

console.log('\nExplosions (p. 159)');
{
  const { e, st, room } = stage(['regular', 'regular'], ['regular']);
  const [a, near] = st.units.filter((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  room.dangerous = true;
  put(a, 19.5, 28); put(near, 19.5, 22.5); put(b, 4, 22.5);
  const m0 = a.models, n0 = near.models;
  dice(0.95, () => e.query.explodeSection(room, 'a test'));
  const log = text(st);
  ok('everyone inside takes Firepower 10, no Defence bonuses', /The explosion catches/.test(log) && a.models < m0, a.models + ' of ' + m0 + ' left');
  ok('...anyone in sight of it within 6" takes Firepower 6', /The blast catches .*\[A\]/.test(log) && near.models < n0);
  ok('...nobody further off', !new RegExp('catches ' + b.label.replace(/[[\]]/g, '\\$&')).test(log));
  ok('a section goes up once a battle', !room.dangerous && room.blown);
}
{
  const { e, st, room } = stage(['regular'], ['regular']);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  room.dangerous = true;
  put(a, 19.5, 22.5); put(b, 19.5, 29);
  e.intent('A', { k: 'select', id: a.id });
  e.intent('A', { k: 'action', id: 'fire' });
  dice(0.75, () => e.intent('A', { k: 'target', id: b.id }));          // the D10 falls 7
  ok('"We can\'t have any firing in there": a Firing roll of 7+ at a target inside sets it off', room.blown && /explodes — a stray round/.test(text(st)));
}
{
  const { e, st, room } = stage(['regular'], ['regular']);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  room.dangerous = true;
  put(a, 19.5, 28); put(b, 19.5, 22.5);
  e.intent('A', { k: 'select', id: a.id });
  e.intent('A', { k: 'action', id: 'fire' });
  dice(0.02, () => e.intent('A', { k: 'target', id: b.id }));          // a 0
  ok('...firing out of one, on a 0', room.blown && /own fire/.test(text(st)));
}

console.log('\nFire (p. 159)');
{
  const { e, st, room } = stage(['regular', 'regular'], ['regular']);
  const [a, c] = st.units.filter((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 19.5, 28); put(c, 4, 22.5); put(b, 30, 22.5);
  e.query.setBurning(room);
  ok('a burning section blocks sight through it', !R.lineClear(st, { x: 19.5, y: 22.5 }, { x: 19.5, y: 32.5 }));
  ok('...but a unit in it still sees out', R.lineClear(st, a, { x: 19.5, y: 22.5 }));
  const m0 = a.models;
  dice(0.95, () => e.query.hazardsEnd());
  ok('the End phase: Firepower 6 at everyone inside', /The fire catches/.test(text(st)) && a.models < m0);
  st.turn += 1;
  dice(0.1, () => e.query.hazardsBeginning());                      // D6 1: burns on
  ok('the Beginning phase: D6 4+ puts it out, else it burns on', !!room.burning && /burns on \(D6 1\)/.test(text(st)));
  st.turn += 1;
  dice(0.1, () => e.query.hazardsBeginning());
  ok('...and a fire that has burnt a turn already goes out by itself', !room.burning && /burns itself out/.test(text(st)));
  room.dangerous = true; room.blown = false;
  e.query.setBurning(room);
  ok('a dangerous section that catches fire explodes at once', room.blown && !room.dangerous);
}

console.log('\nSpecial equipment (p. 159)');
{
  const { e, st, room } = stage(['regular', 'regular'], ['regular', 'regular']);
  const [a, a2] = st.units.filter((u) => u.side === 'A'), [b, b2] = st.units.filter((u) => u.side === 'B');
  put(a, 19.5, 28); put(b, 30, 22.5); put(b2, 32, 22.5);
  e.intent('A', { k: 'select', id: a.id });
  ok('Satchel Charges: set where it stands', e.intent('A', { k: 'action', id: 'kit-satchel' }).ok && st.charges.length === 1 && st.kit.A.satchel === 0);
  ok('...then it moves on', e.intent('A', { k: 'move', x: 19.5, y: 22.5 }).ok && a.activated && a.y < 24);
  put(b2, 21, 30);
  const m0 = b2.models;
  dice(0.6, () => e.query.hazardsEnd());                             // D6 4
  ok('...and in the End phase, 3+ on a D6, the section explodes', room.blown && (b2.models < m0 || b2.sp > 0) && !st.charges.length && /Satchel Charges \(D6 4\)/.test(text(st)));
  ok('once used, it is gone', !e.query.actionState(a, 'kit-satchel').on);
}
{
  const { e, st } = stage(['regular'], ['regular']);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 6, 22.5); put(b, 30, 22.5);
  const n0 = st.terrain.length;
  e.intent('A', { k: 'select', id: a.id });
  const x0 = a.x;
  ok('Ballistic Barrier: the way the shields go up is asked', e.intent('A', { k: 'action', id: 'kit-barrier' }).ok && st.terrain.length === n0);
  ok('...a way with no room for them is refused', !e.intent('A', { k: 'barrierface', dir: -Math.PI / 2 }).ok && st.terrain.length === n0);
  ok('...towards the enemy: shields across its frontage, 1" off it, a low wall', e.intent('A', { k: 'barrierface', dir: 0 }).ok &&
    st.terrain.length === n0 + 1 && st.terrain[n0].kind === 'barricade' && st.terrain[n0].shield && Math.abs(st.terrain[n0].x - (x0 + R.UNIT_R + 1)) < 1e-6 &&
    st.terrain[n0].h > 2 * R.UNIT_R && st.terrain[n0].h < 3, JSON.stringify(st.terrain[n0]));
  ok('...and the unit moves up behind them', a.x > x0 && a.x + R.UNIT_R < st.terrain[n0].x && a.activated, a.x + '');
  ok('...in cover behind it from the enemy\'s fire', R.coverFor(st, b, a).v === 2, R.coverFor(st, b, a).why);
}
{
  const { e, st } = stage(['regular'], ['regular']);
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 6, 22.5); put(b, 11, 22.5);
  e.intent('A', { k: 'select', id: a.id });
  ok('Stun Grenades: an Assault with them', e.intent('A', { k: 'action', id: 'kit-stun' }).ok);
  e.intent('A', { k: 'target', id: b.id });
  const log = text(st);
  ok('...the defender dazed with D6-1 SP and no defensive fire', /Stun Grenades — .* dazed/.test(log) && !/\(Basic Firepower\) fires at/.test(log) && st.kit.A.stun === 0);
}
{
  const { e, st, room } = stage(['regular'], ['regular'], { kit: { A: { incendiary: 1, vacuum: 1 } } });
  const a = st.units.find((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  put(a, 12, 22.5); put(b, 40, 22.5);
  e.intent('A', { k: 'select', id: a.id });
  ok('Incendiary Grenades: it moves', e.intent('A', { k: 'action', id: 'kit-incendiary' }).ok && e.intent('A', { k: 'move', x: 18, y: 22.5 }).ok);
  const rr = st.terrain.indexOf(room);
  ok('...then picks a section in sight within 6"', dice(0.6, () => e.intent('A', { k: 'piece', i: rr })).ok);
  ok('...and on 2+ it burns', !!room.burning && st.kit.A.incendiary === 0);
  a.activated = false; st.activeSide = 'A';
  e.intent('A', { k: 'select', id: a.id });
  e.intent('A', { k: 'action', id: 'kit-vacuum' });
  e.intent('A', { k: 'move', x: 18, y: 22.5 });
  dice(0.6, () => e.intent('A', { k: 'piece', i: rr }));
  ok('Vacuum Charges put it out again', !room.burning && st.kit.A.vacuum === 0);
}

console.log('\nAutomated defence system (p. 160)');
{
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'ce_clear', armyA: ['regular', 'ew'], armyB: ['regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel',
    mode: 'demo', planet: 'sparse', options: { autoDefence: true } });
  const st = e.state(), guns = st.units.filter((u) => u.side === 'N');
  const wf = R.walkField(st, st.adPanel.x, st.adPanel.y, 'N');
  ok('with the option: a control panel and three guns, belonging to neither side', !!st.adPanel && guns.length === 3 && guns.every((g) => g.key === 'adgun' && g.cls === 'vehicle'));
  ok('...each within 12" of the panel, 6" apart', guns.every((g) => wf(g.x, g.y) <= 12.5) && guns.every((g, i) => guns.every((h, j) => i === j || R.inches(g.x, g.y, h.x, h.y) >= 6)));
  ok('...as an Automatic defence system has them: Tier III, FP 6, Range 18", Defence 11, Structure 3, a limited arc, going nowhere',
    guns.every((g) => g.tier === 3 && g.fp === 6 && g.range === 18 && g.def === 11 && g.str === 3 && R.has(g, 'Limited Fire Arc') && g.move === 0));
  ok('without the option, none', (() => { const f = Engine.create(); f.start({ tier: 3, pl: 1, scenario: 'ce_clear', armyA: ['regular'], armyB: ['regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' }); return !f.state().units.some((u) => u.side === 'N') && !f.state().adPanel; })());
}
{
  const { e, st } = stage(['regular', 'ew'], ['regular'], { options: { autoDefence: true } });
  const [a, h] = st.units.filter((u) => u.side === 'A'), b = st.units.find((u) => u.side === 'B');
  // one gun at the corridor's end facing back along it, the panel in the room
  const g = st.units.find((u) => u.side === 'N');
  st.units.filter((u) => u.side === 'N' && u !== g).forEach((u) => { u.alive = false; });
  put(g, 34, 22.5); g.facing = Math.PI; g.damage = 0;
  st.adPanel = { x: 19.5, y: 28, by: null };
  put(a, 22, 22.5); put(b, 8, 22.5); put(h, 19.5, 29.5);
  // the guns fire at the start of the Action phase: at the nearest in sight, arc and range, whoever it is
  e.query.autoGuns();
  ok('at the start of the Action phase each gun fires at the nearest unit in its sight, arc and range, whoever it is',
    new RegExp(g.label + ' fires at ' + a.label.replace(/[[\]]/g, '\\$&')).test(text(st)), (text(st).match(/Automatic gun[^\n]*/g) || []).join(' | '));
  ok('...and either side may shoot it', R.canShoot(st, a, g, 'fire', {}) && !R.canShoot(st, g, h, 'react', {}));
  e.intent('A', { k: 'select', id: h.id });
  ok('Control the Guns: a unit within 1" of the panel has it on its bar', e.query.actionState(h, 'controlguns').on);
  dice(0.3, () => e.intent('A', { k: 'action', id: 'controlguns' }));          // D6 2: enough for Hackers
  ok('...Hackers take it on 2+, and the guns turn on the enemy', st.adPanel.by === 'A' && Math.abs(g.facing - Math.PI) < 0.2 && /takes the automated defence system/.test(text(st)),
    'facing ' + g.facing.toFixed(2));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
