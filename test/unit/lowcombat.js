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

console.log('\nBAT-2 Defensive fire falls back on the Auxiliary weapons (pp. 30, 57, 59)');
(function () {
  [['mortarteam', 'inside its Minimum Range'], ['sam', 'Specialisation (air) against infantry']].forEach(([key, why]) => {
    let shots = 0;
    for (let i = 0; i < 20; i++) {
      const def = unit(key, 'B', 20, 20), atk = unit('regular', 'A', 26, 20);
      const st = world([def, atk]);
      const r = R.assault(st, atk, def, {});
      if (r.log.some((l) => /fires|Auxiliary|defensive/i.test(l.text || '') && (l.text || '').indexOf(def.label) >= 0)) shots++;
    }
    ok('a charged ' + def0(key) + ' fires its Auxiliary weapons (' + why + ')', shots === 20, shots + ' of 20 charges drew fire');
  });
  function def0(k) { return R.profile(k).name; }
})();

console.log('\nBAT-3 The free shot at an arrival respects the weapon\'s limits (pp. 30, 57, 59)');
(function () {
  function arrival(gun, at) {
    const e = Engine.create({});
    e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular', 'regular'], armyB: [gun, 'regular'], nameA: 'A', nameB: 'B',
      colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto' });
    const st = e.state(); st.terrain.length = 0; st.phase = 'battle';
    st.units.forEach((u) => { u.reserve = false; u.x = 44; u.y = 44; u.sp = 0; });
    const g0 = st.units.find((u) => u.side === 'B' && u.key === gun), arr = st.units.find((u) => u.side === 'A');
    st.units.find((u) => u.side === 'B' && u !== g0).x = 2;
    g0.x = 20; g0.y = 20; arr.x = 20 + at; arr.y = 20;
    const g = e.query.greetArrival(arr);
    return g ? g.res.log.map((l) => l.text).join(' | ') : '';
  }
  const mor = arrival('mortarteam', 6), sam = arrival('sam', 6);
  ok('a mortar team inside its Minimum Range greets an arrival with its Auxiliary weapons', /auxiliary weapons\) fires/.test(mor), mor.slice(0, 90));
  ok('...and so does a SAM team at a ground unit', /auxiliary weapons\) fires/.test(sam), sam.slice(0, 90));
  const rifle = arrival('regular', 6);
  ok('a rifle team fires its main weapon as before', /fires at/.test(rifle) && !/auxiliary/.test(rifle), rifle.slice(0, 90));
})();

console.log('\nVEH-2 A catastrophic explosion is an ordinary shooting attack, Firepower Tier + 3 (p. 36)');
(function () {
  const hull = unit('lapc', 'B', 20, 20, { str: 5, damage: 0 }), near = unit('regular', 'A', 21.5, 20), far = unit('regular', 'A', 23.5, 20);
  const st = world([hull, near, far]);
  const keep = Math.random; let first = true;
  Math.random = () => (first ? (first = false, 0.99) : keep());      // the 6 that blows it up, then ordinary dice
  const log = [];
  try { R.applyDamage(st, hull, 6, log, null); } finally { Math.random = keep; }
  const text = log.map((l) => (l.text || '') + ' ' + (l.math || '')).join(' | ');
  ok('it blew up', hull.catastrophic, text.slice(0, 120));
  ok('...and the blast is not Basic Firepower', /The exploding/.test(text) && !/exploding[^|]*Basic Firepower/.test(text));
  const m = R.shotMods(st, { label: 'blast', side: 'B', alive: true, models: 1, fp: 3 + hull.tier, range: 4, rules: [], x: 20, y: 20, shotFrom: [], cls: 'infantry' }, near, 'blast', {});
  ok('...a unit within 2" of the wreck takes it at half range (+2), with no Fire! bonus',
    m.parts.some((p) => p.label === 'within half range' && p.v === 2) && !m.parts.some((p) => /^Fire!/.test(p.label)) && !m.basic,
    m.parts.map((p) => p.label + ' ' + p.v).join(', '));
})();

console.log('\nCrossfire needs the target between the two shooters (p. 31)');
(function () {
  const t = unit('regular', 'B', 20, 20), a = unit('regular', 'A', 21.5, 20);
  const st = world([t, a]);
  const x = (from) => { t.shotFrom = [{ x: from.x, y: from.y, basic: false }]; return R.shotMods(st, a, t, 'fire', {}).crossfire; };
  ok('a second attack from the same spot, close by, is no crossfire', !x({ x: 21.5, y: 20 }));
  ok('...nor one from the same side', !x({ x: 26, y: 20.5 }));
  ok('an attack from the far side is', x({ x: 12, y: 20 }));
})();

console.log('\nTER-4 A unit in a wood or building on the same hill is not below the shooter (p. 42)');
(function () {
  const hill = { kind: 'hill', x: 10, y: 10, w: 12, h: 12 };
  const woods = { kind: 'woods', x: 17, y: 12, w: 4, h: 6 };
  const shooter = unit('regular', 'A', 13, 16);
  const hillFP = (t, terrain) => R.shotMods(world([shooter, t], terrain), shooter, t, 'fire', {}).parts.some((p) => /hill/.test(p.label));
  ok('in a wood on the same hill: no +2 from the hill', !hillFP(unit('regular', 'B', 19, 15), [hill, woods]));
  const bld = { kind: 'building', x: 17, y: 12, w: 4, h: 4 };
  ok('...nor in a building on it', !hillFP(unit('regular', 'B', 19, 14, { bld, sec: 0 }), [hill, bld]));
  ok('on the level ground below, the +2 stands', hillFP(unit('regular', 'B', 30, 16), [hill]));
  ok('...and in a wood down there too', hillFP(unit('regular', 'B', 30, 16), [hill, { kind: 'woods', x: 28, y: 13, w: 4, h: 6 }]));
})();

console.log('\nTER-6 Bringing down one section of a building burns that section only (p. 41)');
(function () {
  const bld = { kind: 'building', x: 10, y: 10, w: 8, h: 4, parts: [{ x: 10, y: 10, w: 4, h: 4 }, { x: 14, y: 10, w: 4, h: 4 }] };
  const west = unit('regular', 'B', 12, 12, { bld, sec: 0 }), east = unit('regular', 'B', 16, 12, { bld, sec: 1 });
  const st = world([west, east], [bld]);
  const res = R.destroyTerrain(st, bld, [], null, 0);
  ok('the west wing goes up in flames', res && res.kind === 'burning' && st.terrain.some((r) => r.kind === 'burning' && r.x === 10 && r.w === 4));
  ok('...the building keeps its east wing', bld.kind === 'building' && bld.parts.length === 1 && bld.parts[0].x === 14);
  ok('...its garrison scrambles out', west.bld === null && res.evicted.indexOf(west) >= 0);
  ok('...and the east wing\'s stays put, in what is now the only section', east.bld === bld && east.sec === 0);
  const whole = { kind: 'building', x: 30, y: 10, w: 8, h: 4, parts: [{ x: 30, y: 10, w: 4, h: 4 }, { x: 34, y: 10, w: 4, h: 4 }] };
  R.destroyTerrain(world([], [whole]), whole, [], null);
  ok('with no section named (a charge on the building), all of it burns', whole.kind === 'burning');
})();

console.log('\nSPR-4 Cover blown in: +1 to every hit roll that round, the defenders\' too (p. 59)');
(function () {
  let seen = 0, plus = 0, later = 0, laterPlus = 0;
  for (let i = 0; i < 600 && seen < 20; i++) {
    const a = unit('engineers', 'A', 24.5, 20), t = unit('veterans', 'B', 27.5, 20);
    const st = world([a, t], [{ kind: 'barricade', x: 26, y: 12, w: 0.5, h: 16 }]);
    const L = R.assault(st, a, t, {}).log;
    if (!L.some((l) => /blow the cover in/.test(l.text || ''))) continue;
    L.forEach((l, k) => {
      const next = L[k + 1];
      if (!/^Round \d — .*\(defender\)/.test(l.text || '') || !next || next.t !== 'hits') return;
      if (/^Round 1 /.test(l.text)) { seen++; if (/\+1 →/.test(next.text)) plus++; }
      else { later++; if (/\+1 →/.test(next.text)) laterPlus++; }
    });
  }
  ok('the defenders\' answer in the breach round gets the +1', seen > 0 && plus === seen, plus + ' of ' + seen);
  ok('...and not in the rounds after', laterPlus === 0, laterPlus + ' of ' + later);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
