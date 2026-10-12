/* Besieged (Close Encounters, p. 163): the solitaire rescue inside a compound —
   counters twice the OpFor, each turned over on a D6 (1-2 nothing, 3-5 an
   enemy, 6 the important unit, the last one always it), the clock from turn 6,
   and the way out through an entry point before the end of turn 16. */
'use strict';
const { R, Engine, SOLO, SC } = require('../../server/rules.js');
let seed = 7;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function dice(v, fn) { const was = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = was; } }
const SCEN = (global.PMCScen || SC).SCENARIOS.s_besieged;

function battle(armyA) {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_besieged', armyA: armyA || ['regular', 'regular', 'veterans'], armyB: ['rinsurgents', 'rinsurgents', 'rmilitia'],
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
    solo: { coop: false, faction: 'pmc', opFaction: 'rebel', names: ['A'] } });
  return e;
}

/* One player's unit at the first entry point, the rest of them off the table, and
   every counter but the first `keep` tucked away where it cannot be seen. */
function lone(st, key, keep) {
  const by = st.units.find((u) => u.side === 'A' && !u.soloObjective && (!key || u.key === key));
  st.units.forEach((u) => { if (u.side === 'A' && u !== by) { u.reserve = true; u.x = -1; u.y = -1; } });
  // at an entry point with somewhere round a corner within 12" (and further off)
  const ents = st.sc.entry.A.concat(st.compound.entries.R);
  for (const b of ents) {
    by.x = b.x < 24 ? b.x + 1.2 : b.x + b.w - 1.2; by.y = b.y + b.h / 2; by.reserve = false;
    if (hidden(st, by, 4, 11) && hidden(st, by, 13, 99)) break;
  }
  // the important unit still to be found (turn 1's entry may have turned it up)
  const obj = st.units.find((u) => u.soloObjective);
  obj.reserve = true; obj.wave = 'objective'; obj.x = -1; obj.y = -1;
  const hid = hidden(st, by, 13, 99);
  st.sc.counters.forEach((c, i) => { if (i >= keep) { c.x = hid.x; c.y = hid.y; } });
  return by;
}
// a floor spot `lo`-`hi` inches from the unit that it does not see
function hidden(st, by, lo, hi) {
  for (let x = 1; x < 47; x += 0.5) for (let y = 1; y < 47; y += 0.5) {
    if (R.TERRAIN[R.terrainAt(st, x, y)].impassable) continue;
    const d = R.inches(x, y, by.x, by.y) - R.UNIT_R;
    if (d > hi || d < lo || R.hasLoS(st, by, { x, y, alive: true })) continue;
    return { x, y };
  }
  return null;
}

console.log('\nThe set-up');
{
  const e = battle(), st = e.state();
  const obj = st.units.find((u) => u.soloObjective), mine = st.units.filter((u) => u.side === 'A' && !u.soloObjective);
  ok('a solitaire battle fought in a compound', st.cfg.scenario === 's_besieged' && !!st.compound && !!st.solo);
  // (some may already have been turned over by the units coming in on turn 1)
  const laid = st.sc.counters.length + st.log.filter((l) => /^Counter C\d+ /.test(l.text || '')).length;
  ok('counters: twice the OpFor\'s units', laid === 6, laid + ' counters');
  ok('...every one on floor, none in a wall', st.sc.counters.every((c) => !R.TERRAIN[R.terrainAt(st, c.x, c.y)].impassable));
  ok('the important unit: a Command Unit\'s numbers of the Battle Tier, no special rules, waiting among the counters',
    !!obj && obj.tier === 3 && !obj.rules.length && obj.reserve && obj.wave === 'objective', obj && (obj.name + ' T' + obj.tier));
  ok('half the commando comes in on turn 1, the rest held for turn 2, none of it hidden',
    mine.filter((u) => !u.reserve).length === 2 && mine.filter((u) => u.reserve && u.wave === 2).length === 1 && mine.every((u) => !u.hidden));
  ok('...through the entry points on its own edge', st.sc.entry.A.length >= 2 && st.sc.entry.A.every((b) => b.x === 0));
}

console.log('\nTurning the counters over');
{
  const e = battle(), st = e.state();
  const obj = st.units.find((u) => u.soloObjective);
  const by = lone(st, null, 1);
  const n0 = st.sc.counters.length;
  // the first counter put where the unit sees it
  const place = () => { const c = st.sc.counters[0]; c.x = by.x + 4; c.y = by.y; };
  let out = [];
  const pool0 = SOLO.pool(st).length;
  place();
  dice(0.1, () => { out = SCEN.spot(st, null); });         // D6 1
  ok('one a player\'s unit sees is turned over: on 1-2, nothing', st.sc.counters.length === n0 - 1 && out.length === 1 && /nothing there/.test(out[0].text), out.map((l) => l.text).join(' | '));
  place();
  dice(0.5, () => { out = SCEN.spot(st, null); });         // D6 4
  const foe = out.find((l) => l.unit);
  ok('...on 3-5, an enemy from the pool stands up there', !!foe && foe.unit.side === 'B' && !foe.unit.reserve && SOLO.pool(st).length === pool0 - 1, out.map((l) => l.text).join(' | '));
  foe.unit.x = -1; foe.unit.y = -1; foe.unit.alive = false;
  place();
  dice(0.99, () => { out = SCEN.spot(st, null); });        // D6 6
  ok('...on a 6, the important unit, now the finder\'s', !obj.reserve && obj.x >= 0 && obj.owner === 1 && out.some((l) => l.objective), out.map((l) => l.text).join(' | '));
  ok('the OpFor goes for it before anything else', SCEN.mustTarget(st) === obj);
  obj.x = -1; obj.y = -1;
  place();
  dice(0.99, () => { out = SCEN.spot(st, null); });
  ok('once it is found, a 6 is an enemy', out.some((l) => l.unit && l.unit.side === 'B'), out.map((l) => l.text).join(' | '));
}
{
  const e = battle(), st = e.state();
  const by = lone(st, null, 1);
  st.sc.counters.splice(1);
  st.sc.counters[0].x = by.x + 4; st.sc.counters[0].y = by.y;
  let out = [];
  dice(0.1, () => { out = SCEN.spot(st, null); });
  ok('the last counter is always the important unit, whatever the die', out.some((l) => l.objective), out.map((l) => l.text).join());
}
{
  const e = battle(['regular', 'observers']), st = e.state();
  const by = lone(st, 'observers', 1);
  // round a corner: out of sight, within 12"
  const spot = hidden(st, by, 4, 11), c = st.sc.counters[0];
  c.x = spot.x; c.y = spot.y;
  const n0 = st.sc.counters.length;
  dice(0.1, () => SCEN.spot(st, null));
  ok('a counter round the corner stays put...', st.sc.counters.length === n0);
  dice(0.1, () => SCEN.spot(st, by));
  ok('...until a Detect sweeps it up, within 12"', st.sc.counters.length === n0 - 1);
}

console.log('\nThe clock and the way out');
{
  const e = battle(), st = e.state();
  st.turn = 5;
  ok('nothing ends before turn 6 with the unit still to find', !dice(0.99, () => SCEN.check(st)));
  st.turn = 6;
  ok('from the end of turn 6, a 6 ends it — too late', /Too late/.test((dice(0.99, () => SCEN.check(st)) || {}).text || ''));
  st.turn = 8;
  ok('...4+ by turn 8', !dice(0.4, () => SCEN.check(st)) && /Too late/.test((dice(0.55, () => SCEN.check(st)) || {}).text || ''));
}
{
  const e = battle(), st = e.state();
  const obj = st.units.find((u) => u.soloObjective), mate = st.units.find((u) => u.side === 'A' && !u.soloObjective);
  const b = st.sc.entry.A[0];
  mate.x = 20; mate.y = 20; mate.reserve = false;
  obj.reserve = false; obj.wave = 0; obj.x = b.x + 6; obj.y = b.y + b.h / 2;
  st.turn = 9;
  ok('found, the clock stops', !dice(0.99, () => SCEN.check(st)) && !SCEN.sudden(st));
  const g = SCEN.goals(st, obj), g2 = SCEN.goals(st, mate);
  ok('the AI\'s important unit makes for the way out, the rest for it', g.length >= 4 && g.every((p) => p.exit) && g2.length === 1 && g2[0].x === obj.x);
  obj.x = R.UNIT_R;
  const w = SCEN.sudden(st);
  ok('brought to the edge through an entry point: won, then and there', w && w.winner === 'A', w && w.text);
  obj.x = b.x + 6; st.turn = 16;
  ok('still inside at the end of turn 16: lost', (SCEN.check(st) || {}).winner === 'B');
  st.turn = 10; obj.alive = false;
  ok('the important unit killed: lost at once', (SCEN.sudden(st) || {}).winner === 'B');
}

console.log('\nPlayed out');
{
  let crashes = 0, walled = 0, ended = 0, turned = 0;
  for (let i = 0; i < 3; i++) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 's_besieged', armyA: SOLO.rollCommando(3, 1, 'pmc'), armyB: SOLO.rollOpFor(3, 1, 'rebel', false),
      nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
      solo: { coop: false, faction: 'pmc', opFaction: 'rebel', names: ['A'] } });
    const st = e.state(), n0 = st.sc.counters.length;
    try { for (let n = 0; !e.over() && n < 6000; n++) if (!e.intent('A', { k: 'step' }).ok) break; } catch (err) { crashes++; console.log(err.stack); }
    if (e.over()) ended++;
    if (st.sc.counters.length < n0) turned++;
    walled += st.units.filter((u) => u.alive && u.x >= 0 && R.TERRAIN[R.terrainAt(st, u.x, u.y)].impassable).length;
  }
  ok('three AI battles run to their end, nobody in a wall, counters turned over', !crashes && ended === 3 && !walled && turned >= 2, ended + ' ended, ' + turned + ' turned counters');
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
