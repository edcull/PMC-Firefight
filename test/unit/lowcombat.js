/* The Low findings on combat and special rules (the rules review at 7dd7306,
   L-9 to L-17): a bailing crew is put down as a disembark is, and its
   Suppression can break it out loud (p. 36); a squad already Suppressed shoots
   back at a strafing run (p. 39); drones and the Overmind's bugs shed their
   Suppression in the Rally phase, not on a Regroup (pp. 40, 116); a Coordinate
   chain may stop short (p. 59); Incendiary doubles only the hit table's
   Suppression (p. 58); a Command Vehicle carries the rules of any command unit
   aboard (p. 59); and a drop platform never goes in empty (p. 79). */
'use strict';
const { R, Engine, SC } = require('../../server/rules.js');
let seed = 41;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
let n = 0;
function unit(key, side, x, y, extra) {
  const p = R.profile(key);
  return Object.assign(JSON.parse(JSON.stringify(p)), {
    id: side + (n++), side, label: p.name + ' [' + side + ']', models: p.size, x, y, sp: 0, alive: true, shotFrom: [], cargo: [], facing: 0,
    command: !!p.command, damage: 0
  }, extra || {});
}
const world = (units, terrain) => ({ units, terrain: terrain || [], objectives: [], log: [], doctrines: { A: [], B: [] } });
function battle(armyA, armyB) {
  const e = Engine.create({});
  e.start({ tier: 4, pl: 1, scenario: 'meeting', armyA, armyB, nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  let g = 0;
  while (e.state().phase === 'deploy' && g++ < 200) { const side = e.query.placingSide(); if (!side) break; e.intent(side, { k: 'autodeploy' }); }
  e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
  e.intent('A', { k: 'start' });
  for (g = 0; g < 60 && e.state().phase !== 'battle'; g++) e.intent(e.state().activeSide || 'A', { k: 'start' });
  const st = e.state();
  st.terrain.length = 0;
  st.units.forEach((u, i) => {
    (u.cargo || []).forEach((c) => { c.aboard = null; }); u.cargo = [];
    u.reserve = false; u.aboard = null; u.x = u.side === 'A' ? 6 : 40; u.y = 4 + i * 4;
    u.activated = false; u.sp = 0; u.facing = 0;
  });
  st.activeSide = 'A'; st.chain = null; st.streak = 9;
  return { e, st };
}

console.log('\nA crew bailing out disembarks, and its Suppression counts (p. 36)');
(function () {
  let placed = 0, near = 0, tooClose = 0, broke = 0, said = 0;
  for (let k = 0; k < 40; k++) {
    const veh = unit('lpv', 'A', 20, 20, { str: 1, damage: 0 }), crew = unit('rookie', 'A', 20, 20, { aboard: null });
    crew.sp = 2 * R.currentMorale(crew);               // on the edge: the bail-out's D6 breaks it
    const foe = unit('regular', 'B', 23.5, 20);
    veh.cargo = [crew]; crew.aboard = veh.id;
    const st = world([veh, crew, foe]);
    const log = [];
    // knocked out with a 1-3: Abandoned!
    const keep = Math.random; Math.random = () => 0.1;
    try { R.applyDamage(st, veh, 5, log, foe); } finally { Math.random = keep; }
    if (veh.alive) continue;
    placed++;
    const d = Math.hypot(crew.x - veh.x, crew.y - veh.y);
    if (d <= 4 + 2 * R.UNIT_R + 1e-6) near++;
    if (R.unitDist(crew, foe) < 1) tooClose++;
    if (R.status(crew) === 'broken') { broke++; if (log.some((l) => /BROKEN/.test(l.text || ''))) said++; }
  }
  ok('the crew gets out of an abandoned hull', placed > 0, placed + '');
  ok('...within 4" of it, as any disembark', near === placed, near + ' of ' + placed);
  ok('...and not within 1" of the enemy', tooClose === 0);
  ok('...and when the D6 breaks it, it is said to break', broke === said, said + ' of ' + broke);
})();

console.log('\nA squad already Suppressed fires back at a strafing run (p. 39)');
(function () {
  let back = 0, runs = 0;
  for (let k = 0; k < 12; k++) {
    const { e, st } = battle(['fsc', 'regular'], ['regular', 'regular']);
    const craft = st.units.find((u) => u.cls === 'aircraft');
    const foes = st.units.filter((u) => u.side === 'B');
    craft.x = 10; craft.y = 24; craft.facing = 0;
    foes[0].x = 16; foes[0].y = 24; foes[0].sp = R.currentMorale(foes[0]) + 1;   // Suppressed before the run
    foes[1].x = 40; foes[1].y = 44;
    e.intent('A', { k: 'select', id: craft.id });
    if (!e.intent('A', { k: 'action', id: 'strafe' }).ok) continue;
    const end = e.sel().moves.filter((c) => Math.abs(c.y - 24) < 0.01 && c.x > 20).sort((a, b) => b.x - a.x)[0];
    if (!end) continue;
    const n0 = st.log.length;
    e.intent('A', { k: 'strafe', x: end.x, y: end.y });
    runs++;
    const fired = st.log.slice(n0).some((l) => (l.text || '').indexOf(foes[0].label + ' (Basic Firepower) fires at ' + craft.label) === 0);
    if (fired && R.status(foes[0]) !== 'broken') back++;
  }
  ok('it shoots back when the run left it no worse than Suppressed', runs > 0 && back > 0, back + ' of ' + runs + ' runs');
})();

console.log('\nDrones shed their Suppression in the Rally phase only (p. 40)');
(function () {
  const d1 = unit('dcombat', 'A', 10, 10, { sp: 3 }), d2 = unit('dcombat', 'A', 20, 10, { sp: 3 });
  const st = world([d1, d2]);
  const r1 = R.rally(st, d1);
  ok('in the Rally phase every point goes', d1.sp === 0 && r1.removed === 3);
  const keep = Math.random; Math.random = () => 0.01;     // every die a 1
  try { R.rally(st, d2, { regroup: true }); } finally { Math.random = keep; }
  ok('...a Regroup rolls for them like anyone else', d2.sp === 3, d2.sp + ' SP left');
})();

console.log('\nA Coordinate chain may stop short (p. 59)');
(function () {
  const { e, st } = battle(['cmd2', 'regular', 'regular', 'regular'], ['regular']);
  const cmd = st.units.find((u) => u.key === 'cmd2');
  const line = st.units.filter((u) => u.side === 'A' && u !== cmd);
  cmd.x = 10; cmd.y = 20; line.forEach((u, i) => { u.x = 14; u.y = 14 + i * 5; });
  st.streak = 1;                                     // this is A's last activation before B's
  e.intent('A', { k: 'select', id: cmd.id });
  ok('the Command Unit coordinates', e.intent('A', { k: 'action', id: 'coordinate' }).ok && !!st.chain);
  e.intent('A', { k: 'select', id: line[0].id });
  ok('...a unit in the chain may end it', e.query.specialsFor(line[0]).some((s) => s.id === 'endchain'));
  ok('...and does, keeping its activation', e.intent('A', { k: 'action', id: 'endchain' }).ok && !st.chain && !line[0].activated);
  ok('...and play passes on', st.activeSide === 'B', st.activeSide);
})();

console.log('\nIncendiary doubles the hit table\u2019s Suppression only (p. 58)');
(function () {
  // every die high: a 9 on the D10, so one hit at least, and a 6 on the table, a Man down!
  function volley(flags) {
    const a = unit('rciv', 'A', 10, 10), t = unit('veterans', 'B', 16, 10, flags ? { camp: { flags } } : {});
    const st = world([a, t], [{ kind: 'woods', x: 14, y: 6, w: 6, h: 8 }]);
    a.rules = a.rules.concat(['Incendiary Ammunition']); a.fp = Math.max(0, a.fp - 2); a.models = 1;   // one hit on a 9, no more
    const keep = Math.random; Math.random = () => 0.95;
    let res;
    try { res = R.shoot(st, a, t, 'fire', {}); } finally { Math.random = keep; }
    return { sp: t.sp, hits: res.hits, lost: t.size - t.models };
  }
  const plain = volley(null), over = volley({ overreact: true });
  ok('in a wood, an Incendiary Man down! is worth twice the table\u2019s 2 SP', plain.lost >= 1 && plain.sp === 4 * plain.lost, JSON.stringify(plain));
  ok('...and Overreact\u2019s 2 more are added after, not doubled', over.lost >= 1 && over.sp === Math.min(12, 6 * over.lost) && 8 * over.lost > over.sp, JSON.stringify(over));
})();

console.log('\nA Command Vehicle carries the rules of any command unit aboard (p. 59)');
(function () {
  const cv = unit('cmdveh', 'A', 10, 10), c4 = unit('cmd4', 'A', 10, 10);
  cv.cargo = [c4]; c4.aboard = cv.id;
  ok('a Field command 4th grade aboard lends it Inspiring Presence', R.has(cv, 'Inspiring Presence'));
  ok('...and is the command unit aboard', R.commandAboard(cv) === c4);
})();

console.log('\nA drop platform never goes in empty (p. 79)');
(function () {
  ok('a list with more platforms than squads to fill them is refused',
    R.checkArmy(['cmd3', 'insertplat', 'insertplat', 'lpv'], 2, 1, []).faults.some((f) => /insertion platform/.test(f)));
  ok('...one with a squad for each is not', !R.checkArmy(['cmd3', 'insertplat', 'recruits', 'recruits'], 2, 1, []).faults.some((f) => /insertion platform/.test(f)));
  const e = Engine.create({});
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: ['cmd3', 'insertplat', 'recruits', 'recruits', 'enforcers', 'rookie'], armyB: ['regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  const st = e.state(), pod = st.units.find((u) => u.key === 'insertplat');
  ok('the platform is seated with a squad', pod && pod.cargo.length === 1, pod ? pod.cargo.map((c) => c.name).join() : 'no platform');
  const rider = pod.cargo[0];
  const un = e.intent('A', { k: 'unload', hull: pod.id, unit: rider.id });
  ok('...which cannot simply be taken out', !un.ok && pod.cargo.length === 1, un.why);
  const other = st.units.find((u) => u.side === 'A' && u.cls === 'infantry' && !u.aboard && u !== rider && !u.command && u.x < 0);
  const ld = other ? e.intent('A', { k: 'load', hull: pod.id, unit: other.id }) : { ok: false, why: 'no other squad' };
  ok('...but may be swapped for another', ld.ok && pod.cargo[0] === other && !rider.aboard, ld.why || '');
})();

console.log('\nAn emptied drop platform does nothing more, and touches no objective (p. 79)');
(function () {
  const e = Engine.create({});
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: ['cmd3', 'insertplat', 'recruits', 'recruits', 'enforcers'], armyB: ['regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto' });
  const st = e.state(), pod = st.units.find((u) => u.key === 'insertplat');
  st.phase = 'battle'; st.turn = 1; st.phaseCount = 1; st.activeSide = 'A'; st.chain = null; st.streak = 9; st.terrain.length = 0;
  st.units.forEach((u, i) => { u.reserve = false; u.activated = false; if (!u.aboard) { u.x = 6 + i * 3; u.y = 10 + i * 3; } });
  pod.x = 20; pod.y = 20;
  ok('a platform with its squad aboard may act, to put them down', e.query.eligible('A').indexOf(pod) >= 0);
  const rider = pod.cargo[0];
  pod.cargo = []; rider.aboard = null; rider.x = 24; rider.y = 20;
  ok('...once empty, it is not activated again', e.query.eligible('A').indexOf(pod) < 0 && !e.query.actionState(pod, 'skip').on);
  // the Find and secure locations and a Secure objective at its feet
  st.sc.search = [{ x: 20, y: 24, i: 0, checked: false, piece: { kind: 'searchsite', x: 18, y: 22, w: 4, h: 4 } }];
  st.sc.found = null; st.sc.order = 0;
  ok('...it cannot search a location', SC.searchSpots(st, pod).length === 0 && SC.searchSpots(st, rider).length === 1);
  st.units.forEach((u, i) => { if (u !== pod && u.x >= 0) { u.x = 40; u.y = 4 + i * 3; } });
  ok('...nor hold an objective it stands on', SC.holderOf(st, 20, 20, 4) === null);
})();

console.log('\nA shot called in by Markerlights ignores Stealth (pp. 58-59)');
(function () {
  const fo = unit('observers', 'B', 40, 10), rif = unit('regular', 'A', 10, 10), mor = unit('mortarteam', 'A', 10, 14);
  const st = world([fo, rif, mor]);
  const def = (a, opts) => R.shotMods(st, a, fo, 'fire', opts || {}).def;
  const plain = def(rif);
  ok('unmarked, a Stealth unit 30" off gets its Stealth bonus', plain.parts.some((p) => p.label === 'Stealth' && p.v === 4), 'Defence ' + plain.value);
  st.mark = { side: 'A', kind: 'mark', targets: [fo] };
  const marked = def(rif);
  ok('marked, the shot it calls in ignores it', marked.value === plain.value - 4 && marked.parts.some((p) => /ignored/.test(p.label)),
    'Defence ' + marked.value + ' (' + marked.parts.map((p) => p.label + ' ' + p.v).join(', ') + ')');
  st.mark = { side: 'A', kind: 'designate', targets: [fo] };
  ok('...and so does an Indirect Fire shot at a designated target', def(mor).value === R.shotMods(world([fo, mor]), mor, fo, 'fire', {}).def.value - 4);
  st.mark = { side: 'B', kind: 'mark', targets: [fo] };
  ok('a mark by the other side does nothing for this shooter', def(rif).value === plain.value);
})();

console.log('\nTER-1 Only a unit that may garrison occupies the building it wins (pp. 41, 94)');
(function () {
  ['rridergang', 'bqueen', 'regular'].forEach((key) => {
    let wins = 0, inside = 0, empty = 0;
    for (let i = 0; i < 60; i++) {
      const piece = { kind: 'building', x: 20, y: 20, w: 4, h: 4 };
      const def = unit('regular', 'B', 22, 22, { bld: piece, sec: 0, sp: 5 });
      const atk = unit(key, 'A', 25.5, 22, { assault: 8 });
      const st = world([def, atk], [piece]);
      R.assault(st, atk, def, {});
      if (!def.alive || def.bld !== piece) {
        wins++;
        if (atk.bld === piece) inside++;
        if (!st.units.some((u) => u.alive && u.bld === piece)) empty++;
      }
    }
    if (key === 'regular') ok('infantry that win move in', wins > 0 && inside === wins, inside + ' of ' + wins);
    else ok(key === 'bqueen' ? 'a Queen that wins clears it but stays outside, and it stands empty' : 'Riders that win clear it but stay outside, and it stands empty', wins > 0 && inside === 0 && empty === wins, wins + ' wins, ' + inside + ' inside');
  });
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
