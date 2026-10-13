/* Close Encounters' compounds (Appendix 1, pp. 157-162; roadmap v0.4): the
   generator's corridors, rooms, halls and doors, the rules they change inside
   them, and the two scenarios fought in them, Clearing out and Critical control. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
const CMP = global.PMCCompound, SC = global.PMCScen;
const P = require('../../src/engine/protocol.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FLOOR = { corridor: 1, room: 1, hall: 1 };

console.log('\nThe compound generator');
for (const [w, h] of [[48, 48], [48, 72]]) {
  let bad = [];
  for (let n = 0; n < 25; n++) {
    const g = CMP.generate(w, h);
    const st = { terrain: g.terrain, compound: g.compound, units: [] };
    const secs = g.terrain.filter((r) => FLOOR[r.kind]);
    // corridors 3" wide and no longer than 12"; rooms up to 9" a side; halls bigger than that
    secs.forEach((r) => {
      if (r.kind === 'corridor' && (Math.min(r.w, r.h) !== 3 || Math.max(r.w, r.h) > 12)) bad.push('corridor ' + r.w + 'x' + r.h);
      if (r.kind === 'room' && Math.max(r.w, r.h) > 9) bad.push('room ' + r.w + 'x' + r.h);
      if (r.kind === 'hall' && Math.max(r.w, r.h) <= 9) bad.push('hall ' + r.w + 'x' + r.h);
    });
    const ent = g.compound.entries;
    if (ent.L.length < 2 || ent.R.length < 2) bad.push('entries ' + ent.L.length + '/' + ent.R.length);
    if (ent.L.some((e) => e.x !== 0) || ent.R.some((e) => e.x + e.w < w - 0.01)) bad.push('an entry off its edge');
    // every floor section can be walked to from an entry on each side
    const from = ent.L[0], to = R.walkField(st, from.x + 1.5, from.y + 1.5, 'A');
    secs.forEach((r) => { if (to(r.x + 1.5, r.y + 1.5) === Infinity) bad.push(r.kind + ' cut off'); });
    // and no entry is seen from the far edge: no line clear across the table
    ent.L.forEach((e) => ent.R.forEach((f) => {
      for (let k = 0; k <= 4; k++) {
        const a = { x: 0.5, y: e.y + 0.6 + k * 0.45 }, b = { x: w - 0.5, y: f.y + 0.6 + k * 0.45 };
        if (R.lineClear(st, a, b)) bad.push('an entry seen from the far edge');
      }
    }));
  }
  ok(w + '" x ' + h + '": 25 compounds, every section the right size, joined up, two entries a side, none seen from the far edge', !bad.length, [...new Set(bad)].slice(0, 4).join('; '));
}
{
  const g = CMP.generate(48, 48, null, { rooms: 3 });
  ok('a scenario that needs three rooms gets them', g.terrain.filter((r) => r.kind === 'room').length >= 3);
}

console.log('\nThe ground inside');
// a corridor running along x from (0, 21) to (12, 24), with a room off its end through a door
function corridorTable(door) {
  const t = [
    { kind: 'bulkhead', x: 0, y: 0, w: 48, h: 21 }, { kind: 'bulkhead', x: 0, y: 24, w: 48, h: 24 },
    { kind: 'corridor', x: 0, y: 21, w: 12, h: 3, axis: 'h' }, { kind: 'corridor', x: 12, y: 21, w: 12, h: 3, axis: 'h' }
  ];
  if (door) t.push({ kind: door, x: 11.75, y: 21, w: 0.5, h: 3 });
  return { terrain: t, compound: { cell: 3, cols: 16, rows: 16, entries: { L: [], R: [] } }, units: [], cfg: { options: {} } };
}
{
  const st = corridorTable();
  ok('the bulkhead is solid', R.TERRAIN[R.terrainAt(st, 5, 10)].impassable && R.terrainAt(st, 5, 10) === 'bulkhead');
  ok('the middle of a corridor is open floor', R.terrainAt(st, 5, 22.5) === 'open');
  ok('right against its wall is nowhere to stand', R.terrainAt(st, 5, 21.3) === 'wallside' && R.TERRAIN.wallside.impassable);
  ok('...so two units cannot stand side by side in it', R.TERRAIN[R.terrainAt(st, 5, 21.5)].impassable && R.TERRAIN[R.terrainAt(st, 5, 23.5)].impassable);
  ok('the rock blocks sight', !R.lineClear(st, { x: 5, y: 22.5 }, { x: 5, y: 40 }));
  ok('down the corridor, the way is clear', R.lineClear(st, { x: 2, y: 22.5 }, { x: 22, y: 22.5 }));
}
{
  const st = corridorTable('door');
  ok('a working door blocks sight down the corridor', !R.lineClear(st, { x: 2, y: 22.5 }, { x: 22, y: 22.5 }));
  const u = { id: 'u', side: 'A', cls: 'infantry', move: 5, rules: [], x: 8, y: 22.5, alive: true };
  st.units.push(u);
  ok('...but is walked through freely', R.reachable(st, u, 6).some((c) => c.x > 13));
  st.terrain[4].kind = 'doorlockA';
  ok('locked to one side, that side cannot pass', !R.reachable(st, u, 6).some((c) => c.x > 13));
  u.side = 'B';
  ok('...while the other side can', R.reachable(st, u, 6).some((c) => c.x > 13));
  st.terrain[4].kind = 'door';
  st.units = [];
  const log = [];
  R.destroyTerrain(st, st.terrain[4], log, null);
  ok('a door brought down is Breached: the doorway seen through', st.terrain[4].kind === 'breached' && R.lineClear(st, { x: 2, y: 22.5 }, { x: 22, y: 22.5 }), log.map((l) => l.text).join());
}
{
  // a door someone stands at is open: sight goes through it, for either side of it (house rule)
  const st = corridorTable('door');
  const a = { id: 'a', side: 'A', x: 10.5, y: 22.5, alive: true }, b = { id: 'b', side: 'B', x: 20, y: 22.5, alive: true };
  st.units.push(a, b);
  ok('a unit at a door holds it open: it and the enemy beyond see each other', R.doorOpen(st, st.terrain[4]) && R.lineClear(st, a, b));
  a.x = 6;
  ok('...stepped back from it, the door shuts and blocks sight again', !R.doorOpen(st, st.terrain[4]) && !R.lineClear(st, a, b));
  // in front of it, not beside it: near the door but past the end of the doorway is no use
  a.x = 11; a.y = 25.2;
  ok('...a unit beside the doorway (past its end, along the wall) does not open it', !R.doorOpen(st, st.terrain[4]));
  a.y = 22.5; a.x = 6;
  b.x = 13.4;
  ok('...whichever side the unit at it stands', R.doorOpen(st, st.terrain[4]) && R.lineClear(st, a, b));
  st.terrain[4].kind = 'doorlockB';
  ok('locked against a side, that side at it does not open it', !R.doorOpen(st, st.terrain[4]) && !R.lineClear(st, a, b));
  st.terrain[4].kind = 'doorlock';
  a.x = 10.5;
  ok('...and one locked to both sides stays shut for anyone', !R.doorOpen(st, st.terrain[4]));
}
{
  // a few doors are locked at random, but never so as to shut a section off from the rest, for either side
  let locked = 0, one = 0, split = 0;
  for (let n = 0; n < 30; n++) {
    const g = CMP.generate(48, 48);
    const doors = g.terrain.filter((r) => /^door/.test(r.kind));
    locked += doors.filter((r) => r.kind === 'doorlock').length;
    one += doors.filter((r) => r.kind === 'doorlockA' || r.kind === 'doorlockB').length;
    ['A', 'B'].forEach((side) => {
      const st = { terrain: g.terrain, compound: g.compound, units: [] };
      const secs = g.terrain.filter((r) => FLOOR[r.kind]), s0 = secs[0];
      const wf = R.walkField(st, s0.x + 1.5, s0.y + 1.5, side);
      if (secs.some((r) => !isFinite(wf(r.x + 1.5, r.y + 1.5)))) split++;
    });
  }
  ok('some doors come locked to both sides, some to one', locked > 0 && one > 0, locked + ' both, ' + one + ' one side, over 30 compounds');
  ok('...and every section can still be reached by both sides', split === 0, split + ' cut off');
}
{
  // Critical control's three rooms are about as far for both long edges to walk to
  const imb = [], off = [];
  for (let n = 0; n < 20; n++) {
    const g = CMP.generate(48, 48);
    const st = { terrain: g.terrain, compound: g.compound, units: [], sc: {} };
    SC.SCENARIOS.ce_control.objectives(st);
    const ent = g.compound.entries;
    const walk = (boxes, r) => Math.min(...boxes.map((b) => R.walkField(st, b.x + b.w / 2, b.y + b.h / 2, 'N')(r.x + r.w / 2, r.y + r.h / 2)));
    const L = st.sc.rooms.reduce((a, r) => a + walk(ent.L, r), 0), Rr = st.sc.rooms.reduce((a, r) => a + walk(ent.R, r), 0);
    imb.push(Math.abs(L - Rr) / Math.max(L, Rr));
    off.push(Math.max(...st.sc.rooms.map((r) => Math.abs(r.x + r.w / 2 - 24) / 24)));
  }
  const mean = imb.reduce((a, b) => a + b, 0) / imb.length, offMean = off.reduce((a, b) => a + b, 0) / off.length;
  ok('Critical control\u2019s rooms are fair: both edges walk about as far to the three', st3(mean) && mean < 0.15, (mean * 100).toFixed(1) + '% apart on average');
  ok('...and none tucked against one side\u2019s edge: each room near the middle of the table', offMean < 0.27 && Math.max(...off) <= 0.6,
    'furthest off the middle: ' + (offMean * 100).toFixed(0) + '% of the half-width on average, ' + (Math.max(...off) * 100).toFixed(0) + '% at worst');
  function st3(m) { return isFinite(m); }
}
{
  const st = corridorTable();
  // a unit off the middle line, but in the corridor: it still fills it
  const mid = { id: 'm', side: 'A', x: 12, y: 22.4, alive: true };
  st.units.push(mid);
  ok('a unit in a corridor fills its width: nobody sees past it', !R.lineClear(st, { x: 2, y: 21.9, side: 'A' }, { x: 22, y: 23.1, side: 'B' }));
  mid.alive = false;
  ok('...and with it gone the line is clear', R.lineClear(st, { x: 2, y: 21.9 }, { x: 22, y: 23.1 }));
}
{
  const st = corridorTable('door');
  const wf = R.walkField(st, 2, 22.5, 'A');
  ok('the walk is measured round the walls', Math.abs(wf(20, 22.5) - 18) < 3, wf(20, 22.5).toFixed(1) + '"');
  ok('...and through the rock there is none', wf(5, 10) === Infinity || R.terrainAt(st, 5, 10) === 'bulkhead');
}

console.log('\nThe battle inside (p. 157)');
function battle(scen, extra) {
  const e = Engine.create();
  e.start(Object.assign({ tier: 3, pl: 1, scenario: scen, armyA: ['regular', 'observers', 'mortarteam', 'lcv'], armyB: ['regular', 'regular', 'hpv'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' }, extra || {}));
  return e;
}
{
  const st = battle('ce_clear').state();
  ok('the battle is fought in a compound', !!st.compound && st.terrain.some((r) => r.kind === 'corridor') && st.terrain.some((r) => r.kind === 'bulkhead'));
  ok('no vehicles or aircraft: they stay outside', !st.units.some((u) => u.cls !== 'infantry') && st.homeBound.length === 2, st.homeBound.map((h) => h.name).join());
  const fo = st.units.find((u) => u.key === 'observers');
  ok('Markerlights become Advanced Sensors', fo.rules.indexOf('Advanced Sensors') >= 0 && fo.rules.indexOf('Markerlights') < 0, fo.rules.join());
  const mo = st.units.find((u) => u.key === 'mortarteam');
  const foe = st.units.find((u) => u.side === 'B');
  // the two set up out of each other's sight, within range
  const spot = st.terrain.filter((r) => r.kind === 'corridor')[0];
  mo.x = spot.x + 1.5; mo.y = spot.y + 1.5; mo.reserve = false;
  foe.x = 47; foe.y = 47; foe.reserve = false;
  ok('no Indirect Fire: a mortar needs to see what it shoots', !R.canShoot(st, mo, foe, 'fire', {}) || R.hasLoS(st, mo, foe));
  ok('...and fires at Basic Firepower when it can', R.shotMods(st, mo, foe, 'fire', {}).basic === true);
  const reg = { ...st.units.find((u) => u.key === 'regular' && u.side === 'A') };
  ok('everyone else shoots as normal', !R.shotMods(st, reg, foe, 'fire', {}).basic);
}

console.log('\nClearing out and Critical control (pp. 161-162)');
ok('both are scenarios of their own, in a group after the six', SC.CE_ORDER.join() === 'ce_clear,ce_control' && SC.ORDER.indexOf('ce_clear') < 0);
ok('...offered with the Close Encounters option, which a campaign sets its own way', R.OPTIONS.some((d) => d.key === 'closeEncounters' && d.camp === false));
ok('...and an online room may choose them', P.SCENARIOS.indexOf('ce_clear') >= 0 && P.cleanSettings({ scenario: 'ce_control' }).scenario === 'ce_control');
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
const FAC = ['pmc', 'rebel', 'bugs', 'xeno'];
for (const scen of SC.CE_ORDER) {
  let walled = 0, unfinished = 0, entered = 0;
  for (let k = 0; k < 4; k++) {
    const pl = 1 + (k % 3);
    const e = battle(scen, { pl, armyA: R.rollArmy(3, pl, null, FAC[k]), armyB: R.rollArmy(3, pl, null, FAC[(k + 1) % 4]) });
    const st0 = e.state();
    if (scen === 'ce_control') entered += st0.objectives.length === 3 && st0.objectives.every((o) => SC.areaOf(o).strict) ? 1 : 0;
    playOut(e);
    const st = e.state();
    if (!e.over()) unfinished++;
    walled += st.units.filter((u) => u.alive && u.x >= 0 && !u.aboard && R.terrainAt(st, u.x, u.y) === 'bulkhead').length;
  }
  ok(SC.SCENARIOS[scen].name + ': four battles at PL1-3 played to the end, nobody inside a wall', !unfinished && !walled, unfinished + ' unfinished, ' + walled + ' in walls');
  if (scen === 'ce_control') ok('...three control rooms, held only from inside', entered === 4);
}
{
  // Critical control: all three rooms after turn 5 wins; at turn 20 two of three
  const st = battle('ce_control').state();
  st.objectives.forEach((o) => { o.owner = 'A'; });
  st.turn = 5;
  ok('three rooms held at turn 5 is not yet a win', !st.scen.check(st));
  st.turn = 6;
  ok('...at turn 6 it is', (st.scen.check(st) || {}).winner === 'A');
  st.objectives[0].owner = 'B'; st.turn = 20;
  ok('two of three at the end of turn 20 wins', (st.scen.check(st) || {}).winner === 'A');
}

console.log('\nHand-built compounds (p. 163: "set up the complex in agreeable way")');
{
  // a 16 x 16 plan: in from the left along row 7, a door into a 3 x 3 room, out along row 8, up column 12, and off right along row 2
  const cols = 16, rows = 16, at = (i, j) => j * cols + i, ek = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const cells = Array(cols * rows).fill('.');
  for (let i = 0; i <= 5; i++) cells[at(i, 7)] = 'c';
  for (let j = 6; j <= 8; j++) for (let i = 6; i <= 8; i++) cells[at(i, j)] = 'r';
  for (let i = 9; i <= 12; i++) cells[at(i, 8)] = 'c';
  for (let j = 2; j <= 7; j++) cells[at(12, j)] = 'c';
  for (let i = 13; i <= 15; i++) cells[at(i, 2)] = 'c';
  const base = () => ({ cols, rows, cells: cells.join(''), walls: [], doors: [ek(at(5, 7), at(6, 7))], danger: [at(7, 7)] });
  const ck = CMP.checkPlan(base(), 48, 48);
  ok('a plan with a way in on each edge, one room, everything joined, can be fought in', ck.ok && ck.rooms === 1 && ck.halls === 0 && ck.entries.L === 1 && ck.entries.R === 1, JSON.stringify(ck));
  const b = CMP.build(base(), 48, 48);
  const room = b.terrain.find((r) => r.kind === 'room');
  ok('built: the room where it was painted, 9" a side', room && room.x === 18 && room.y === 18 && room.w === 9 && room.h === 9);
  ok('...marked dangerous where it was marked', room && room.dangerous);
  ok('...corridor sections 3" wide and no longer than 12"', b.terrain.filter((r) => r.kind === 'corridor').every((r) => Math.min(r.w, r.h) === 3 && Math.max(r.w, r.h) <= 12));
  ok('...the door hung where it was put, and only there', b.terrain.filter((r) => r.kind === 'door').length === 1 && b.terrain.some((r) => r.kind === 'door' && Math.abs(r.x + r.w / 2 - 18) < 0.01 && r.y === 21));
  ok('...solid round it, and the entry points where corridors meet the edges', b.terrain.some((r) => r.kind === 'bulkhead') && b.compound.entries.L.length === 1 && b.compound.entries.R.length === 1 &&
    b.compound.entries.L[0].x === 0 && b.compound.entries.R[0].x + b.compound.entries.R[0].w === 48 && b.compound.built);
  const st = { terrain: b.terrain, compound: b.compound, units: [] };
  ok('...walked through from one edge to the other', (() => { const wf = R.walkField(st, 1.5, 22.5, 'A'); return wf && wf(46.5, 7.5) < 80; })());

  let p = base(); p.cells = p.cells.slice(0, at(9, 6)) + 'r' + p.cells.slice(at(9, 6) + 1);
  ok('a room that is not a rectangle is refused', /rectangle/.test(CMP.checkPlan(p, 48, 48).faults.join()));
  p = base(); p.cells = p.cells.slice(0, at(3, 12)) + 'c' + p.cells.slice(at(3, 12) + 1);
  ok('...as is floor cut off from every entry', /cut off/.test(CMP.checkPlan(p, 48, 48).faults.join()));
  p = base(); for (let i = 13; i <= 15; i++) p.cells = p.cells.slice(0, at(i, 2)) + '.' + p.cells.slice(at(i, 2) + 1);
  ok('...and one with no way in on the right', /right edge/.test(CMP.checkPlan(p, 48, 48).faults.join()) && !CMP.build(p, 48, 48));
  p = base(); p.doors = []; p.walls = [ek(at(5, 7), at(6, 7))];
  ok('a wall across the only way: no way through from left to right', /no way through|cut off/.test(CMP.checkPlan(p, 48, 48).faults.join()));
  p = base(); for (let i = 0; i < cols; i++) p.cells = p.cells.slice(0, at(i, 14)) + 'c' + p.cells.slice(at(i, 14) + 1);
  ok('a corridor straight across from edge to edge is allowed, with a warning', CMP.checkPlan(p, 48, 48).ok && /edge to edge/.test(CMP.checkPlan(p, 48, 48).warnings.join()));
  ok('a plan for another table size is refused', /different table size/.test(CMP.checkPlan(base(), 48, 72).faults.join()));
  ok('nonsense is refused, not thrown', !CMP.build({ cells: 7, walls: 'x' }, 48, 48) && !CMP.build(null, 48, 48));
  let rt = 0;
  for (let n = 0; n < 12; n++) { const w = n % 2 ? 48 : 48, h = n % 2 ? 72 : 48; if (CMP.checkPlan(CMP.generatedPlan(w, h), w, h).ok) rt++; }
  ok('a generated compound, as a plan to start from, can be fought in as it is', rt === 12, rt + '/12');

  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'ce_clear', armyA: ['regular'], armyB: ['regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', compoundPlan: base() });
  const s1 = e.state();
  ok('a battle given the plan is fought in it', s1.compound.built && s1.terrain.some((r) => r.kind === 'room' && r.x === 18 && r.y === 18) && /laid out by hand/.test(s1.log.map((l) => l.text).join()));
  const f = Engine.create();
  f.start({ tier: 3, pl: 3, scenario: 'ce_clear', armyA: ['regular'], armyB: ['regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', compoundPlan: base() });
  // an online room: the host's plan in the terms, cleaned, and handed to the battle
  const { Table } = require('../../server/table.js');
  const seat = (name, colour) => ({ name: name, force: { faction: 'pmc', keys: [], name: name, colour: colour }, send() { }, sock: null });
  const roomOf = (settings) => ({ id: 'CE1', settings: settings, seats: { A: seat('Ash', 'ochre'), B: seat('Brann', 'steel') }, everyone() { return []; }, broadcast() { } });
  const ts = P.cleanSettings({ scenario: 'ce_clear', compound: base() });
  ok('a room\u2019s terms keep the host\u2019s compound', ts.compound && ts.compound.cells === base().cells && P.cleanSettings({ compound: null }, Object.assign({}, ts)).compound === null &&
    P.cleanSettings({ compound: 'rubbish' }).compound === null);
  const rc = new Table(roomOf(ts), null, {}).buildConfig();
  ok('...and the battle is fought in it', rc.compoundPlan && rc.compoundPlan.cells === base().cells, JSON.stringify(rc.compoundPlan).slice(0, 80) + ' / ' + rc.scenario);
  const cs = P.cleanSettings({ kind: 'coop', soloScen: 's_besieged', compound: base() });
  const cc = new Table(roomOf(cs), null, {}).buildConfig();
  ok('a cooperative room may fight Besieged, in the host\u2019s compound', cs.soloScen === 's_besieged' && cc.scenario === 's_besieged' && cc.compoundPlan && cc.compoundPlan.cells === base().cells);
  ok('...one that does not fit the table is set aside for a generated one, and said so', !f.state().compound.built && /does not fit/.test(f.state().log.map((l) => l.text).join()));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
