/* Find and secure, where the AI plays a person: once the player holds the found
   objective with the hold clock running, an AI unit sitting in cover does not
   stay there shooting while the clock runs out — every step nearer counts (ai.js
   clockedObjective). 'noclock' turns it off, for the comparison. */
'use strict';
const { Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// how far the AI's unit closes on the objective in one activation
function closes(exp, sd) {
  let seed = sd;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'find', armyA: ['cmd2', 'regular', 'regular', 'regular'], armyB: ['cmd2', 'regular', 'regular', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto',
    aiExp: exp, aiExpSide: 'B' });
  for (let g = 0; g < 400 && !e.over(); g++) {
    const s = e.state();
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    if (s.phase === 'battle' && s.turn >= 2) break;
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) {
      const rp = e.sel().reservePick;
      if (!rp) break;
      rp.ids.forEach((id) => e.intent(rp.side, { k: 'rpick', id })); e.intent(rp.side, { k: 'rpickdone' });
    }
  }
  const st = e.state();
  // the objective found at the first location, A on it with one End phase held
  st.terrain = st.terrain.filter((t) => t.kind === 'searchsite');
  const spot = st.sc.search[0];
  st.sc.found = spot; spot.checked = true; st.sc.order = 1;
  st.objectives = [{ x: spot.x, y: spot.y, rect: { x: spot.x - 2, y: spot.y - 2, w: 4, h: 4 }, owner: 'A' }];
  st.sc.hold = { A: 1, B: 0 };
  const a = st.units.find((x) => x.side === 'A' && x.key === 'regular');
  const [r, b] = st.units.filter((x) => x.side === 'B' && x.key === 'regular');
  st.units.forEach((x) => { if (x !== a && x !== b && x !== r) x.alive = false; });
  [a, b, r].forEach((x) => { x.alive = true; x.models = x.startSize; x.aboard = null; x.bld = null; x.reserve = false; x.hidden = false; x.sp = 0; x.activated = false; });
  // r, nearer, is the side's runner (and has gone); b sits in woods 16" off, within range
  a.x = spot.x; a.y = spot.y;
  r.x = spot.x + 14; r.y = spot.y + 6; r.activated = true;
  b.x = spot.x + 16; b.y = spot.y - 4;
  st.terrain.push({ kind: 'woods', x: b.x - 3, y: b.y - 3, w: 6, h: 6 });
  st.cfg.aiSides = ['B']; st.activeSide = 'B';                 // B the computer, A a person
  const d0 = Math.hypot(b.x - spot.x, b.y - spot.y);
  e.intent('B', { k: 'step' });
  return d0 - Math.hypot(b.x - spot.x, b.y - spot.y);
}

console.log('\nThe enemy on its hold clock: the AI closes in');
const on = [], off = [];
[3, 5, 9, 17, 23].forEach((sd) => { on.push(closes({}, sd)); off.push(closes({ noclock: true }, sd)); });
const sum = (a) => a.reduce((x, y) => x + y, 0);
const fmt = (a) => a.map((d) => d.toFixed(1)).join(' ');
ok('a unit in cover moves nearer than it would without the clock', sum(on) > sum(off) + 2, fmt(on) + ' against ' + fmt(off));
ok('...and never less near', on.every((d, i) => d >= off[i] - 0.05));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
