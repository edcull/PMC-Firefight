/* The Low findings of the rules review at 57a1b3d (docs/rules-review-57a1b3d.md),
   each checked as fixed: the rules and the engine, run in Node. */
'use strict';
const { R, Engine, SOLO } = require('../../server/rules.js');
/* These checks are of the behaviour table (p. 147): the computer's sides here roll on
   it, as the solitaire OpFor always does, rather than choosing (engine/ai.js). */
{ const create = Engine.create; Engine.create = function () { const e = create.apply(this, arguments), start = e.start;
  e.start = (cfg) => start(Object.assign({ aiRolled: { A: true, B: true } }, cfg)); return e; }; }
const SC = global.PMCScen;
let seed = 57;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
let n = 0;
function mk(key, side, x, y, extra) {
  const p = R.profile(key);
  return Object.assign({
    id: side + key + (n++), key, side, code: p.code, group: p.group, name: p.name, label: p.name + ' [' + side + ']',
    cls: p.cls || 'infantry', art: p.art, faction: p.faction, tier: p.tier, size: p.size, models: p.size, move: p.move, turn: p.turn,
    fp: p.fp, range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault, morale: p.morale, str: p.str,
    transport: p.transport, cargo: [], damage: 0, facing: 0, aboard: null, rules: p.rules.slice(), x, y, sp: 0,
    alive: true, activated: false, marked: false, shotFrom: [], command: !!p.command
  }, extra || {});
}
const world = (units, terrain) => ({ units, terrain: terrain || [], objectives: [], log: [], scen: {}, cfg: { aiSides: [] }, doctrines: { A: [], B: [] } });
// a solitaire table with one squad a side, nothing else on it, the OpFor to act
function solo(scenario) {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: scenario || 's_crush', armyA: ['regular'], armyB: ['regular'], nameA: 'A', nameB: 'OpFor',
    colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
  const st = e.state();
  st.terrain.length = 0; st.objectives.length = 0; if (st.sc) { st.sc.targets = []; st.sc.counters = []; }
  st.units.forEach((u) => { u.reserve = false; u.aboard = null; u.sp = 0; u.bld = null; u.activated = false; });
  st.activeSide = 'B';
  return { e, st, a: st.units.find((u) => u.side === 'A'), b: st.units.find((u) => u.side === 'B') };
}
// the next d6 rolled is `v`, and the rest as they come
function firstD6(v, fn) { const d6 = R.d6; let first = true; R.d6 = () => { if (first) { first = false; return v; } return d6(); }; try { return fn(); } finally { R.d6 = d6; } }

console.log('\nSPR-5 A breach on a marked target does not give it its Stealth back');
(function () {
  const piece = { kind: 'building', x: 38, y: 8, w: 4, h: 4 };
  const fo = mk('observers', 'B', 40, 10, { bld: piece, sec: 0 }), sh = mk('mcv', 'A', 18, 10);
  const st = world([fo, sh], [piece]);
  st.mark = { side: 'A', kind: 'mark', targets: [fo] };
  const keep = Math.random; let i = 0; Math.random = () => (i++ === 0 ? 0.95 : 0.5);   // a natural 9: the breach
  let res; try { res = R.shoot(st, sh, fo, 'fire', {}); } finally { Math.random = keep; }
  const m = res.log[0].math || '';
  ok('Defence after the breach is the bare 8, Stealth still ignored', /vs Defence 8 /.test(m) && /Stealth — ignored/.test(m), m.slice(0, 140));
})();

console.log('\nVEH-4 A Lifter shot down takes the troops in its load with it');
(function () {
  const L = mk('rlifter', 'A', 20, 20), V = mk('rltv', 'A', 22, 20), sq = mk('regular', 'A', 25, 20);
  const st = world([L, V, sq]);
  R.embark(st, V, sq); R.embark(st, L, V);
  R.applyDamage(st, L, L.str + 1, [], null);
  ok('the truck and the squad in it are both lost', !V.alive && !sq.alive && sq.lostAboard, 'truck ' + V.alive + ', squad ' + sq.alive);
})();

console.log('\nCMP-8 Tactical Dumbness: no Firepower from the hill either');
(function () {
  const hill = { kind: 'hill', x: 10, y: 10, w: 12, h: 12 };
  const a = mk('regular', 'A', 16, 16, { camp: { flags: { dumb: true }, once: {} } }), t = mk('regular', 'B', 35, 16);
  const m = R.shotMods(world([a, t], [hill]), a, t, 'fire', {});
  ok('no "firing from a hill"', !m.parts.some((p) => /hill/.test(p.label)), m.parts.map((p) => p.label).join(', '));
})();

console.log('\nCMP-7 Unreliable is rolled for the AI’s units too');
(function () {
  // a campaign's traumas: an ordinary battle, not a solitaire one
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren', armyA: R.rollArmy(3, 1, null, 'pmc', false),
    armyB: R.rollArmy(3, 1, null, 'pmc', false), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel' });
  ['A', 'B'].forEach((sd) => { e.intent(sd, { k: 'autosplit' }); e.intent(sd, { k: 'autodeploy' }); });
  ['A', 'B'].forEach((sd) => e.intent(sd, { k: 'start' }));
  const st = e.state(), b = e.query.eligible(st.activeSide).filter((x) => x.cls === 'infantry')[0];
  b.camp = { flags: { unreliable: true }, once: {} };
  const x0 = b.x, n0 = st.log.length;
  const d6 = R.d6; R.d6 = () => 1;
  try { e.query.aiAct(b); } finally { R.d6 = d6; }
  ok('a 1 wastes the action: it does not move or shoot', b.x === x0 && b.activated && st.log.slice(n0).some((l) => /Unreliable/.test(l.text || '')));
})();

console.log('\nXEN-17 Infamy of Panic does not answer a break twice');
(function () {
  const p = mk('xeps5', 'A', 5, 5, { morale: 99, camp: { flags: { infamyPanic: true } } }), f = mk('xeps3', 'A', 5, 10), e = mk('regular', 'B', 30, 30);
  const st = world([p, f, e]);
  f.sp = 12;
  R.panicSweep(st, []);
  const after = p.sp; p.sp = 0;
  f.alive = false; f.fled = true;                    // runs off the table in the Rally phase
  R.panicSweep(st, []);
  ok('the break draws Suppression; fleeing off afterwards draws none', after > 0 && p.sp === 0, after + ' then ' + p.sp);
})();

console.log('\nREB-7 / REB-9 The Human Wave keeps to the caps, and may ride');
(function () {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['rleaders', 'rdesrifle', 'rdesrifle', 'rdesrifle', 'rdesrifle', 'raa'],
    armyB: ['regular', 'regular', 'regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse',
    terrainSetup: 'auto', tactics: { A: null, B: null } });
  const st = e.state();
  e.intent('A', { k: 'tactic', tactic: 'wave' });
  ok('a 5th Deserter unit is refused', !e.intent('A', { k: 'waveadd', key: 'rdesrifle' }).ok);
  ok('...and a 2nd AA team', !e.intent('A', { k: 'waveadd', key: 'raa' }).ok);
  ok('Fanatics may come as Riders', e.intent('A', { k: 'waveadd', key: 'rfanatics', riders: true }).ok);
  const r = st.units.find((u) => u.waveExtra && u.key === 'rfanatics');
  ok('...mounted: half the models, Movement 10', r && r.riders && r.move === 10 && r.models === Math.ceil(R.profile('rfanatics').size / 2));
  ok('the list stays legal', R.checkArmy(st.cfg.armyA, 3, 1, [], 'wave', 'rebel').ok);
})();

console.log('\nREB-8 Last Stand barricades stay out of the enemy deployment zone');
(function () {
  let bars = 0, bad = 0;
  for (const scen of ['invasion', 'demolish', 'takeover']) for (let g = 0; g < 3; g++) {
    const e = Engine.create({});
    e.start({ tier: 3, pl: 1, scenario: scen, armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'rebel'), nameA: 'A', nameB: 'B',
      colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'sparse', terrainSetup: 'auto', tactics: { A: null, B: 'laststand' },
      roles: { attacker: 'B', defender: 'A' } });
    for (let i = 0; i < 6 && e.state().swapAsk; i++) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
    const st = e.state();
    const inA = (x, y) => { const say = SC.deployOK(st, 'A', x, y); if (say !== null) return !!say; const bx = SC.boxesFor(st, 'A'); if (bx) return SC.inBoxes(bx, x, y); const z = SC.zoneFor(st, 'A'); return !!z && x >= z[0] && x <= z[1]; };
    st.terrain.filter((t) => t.lastStand === 'B').forEach((t) => { bars++; if (inA(t.x + t.w / 2, t.y + t.h / 2)) bad++; });
  }
  ok('attacking, the rebels put all 4 down, none in the defender’s zone', bars === 36 && bad === 0, bars + ' placed, ' + bad + ' in the zone');
})();

console.log('\nSOL-12 Run for Your Lives! goes straight away from the enemy');
(function () {
  const { e, st, a, b } = solo();
  st.scen = Object.assign({}, st.scen, { behaviour: () => ({ mod: -5, why: 'test' }) });
  b.x = 24; b.y = 24; a.x = 34; a.y = 24;
  st.terrain.push({ kind: 'woods', x: 18, y: 28, w: 4, h: 4 });          // cover off to one side
  firstD6(1, () => e.query.aiAct(b));
  // (its own move: in a demo the other side may move on afterwards)
  ok('as far as its Move takes it, straight back', b.x <= 24 - 6.5 && Math.abs(b.y - 24) < 1, b.x + ',' + b.y);
})();

console.log('\nSOL-15 Reasonably Neutral leaves cover for half range and a Firepower bonus');
(function () {
  const { e, st, a, b } = solo();
  b.x = 10; b.y = 24; a.x = 25; a.y = 24;
  st.terrain.push({ kind: 'woods', x: 8, y: 22, w: 4, h: 4 }, { kind: 'hill', x: 13, y: 21, w: 4, h: 6 });
  firstD6(4, () => e.query.aiAct(b));
  ok('up the hill, the enemy inside half range', R.terrainAt(st, b.x, b.y) === 'hill', b.x + ',' + b.y);
})();

console.log('\nSOL-13 / SOL-14 / SOL-16 / SOL-17 The solitaire set-ups');
(function () {
  let close = 0, games = 0;
  for (const pl of [1, 2]) for (let g = 0; g < 6; g++) {
    const e = Engine.create();
    e.start({ tier: 3, pl, scenario: 's_sabotage', armyA: SOLO.rollCommando(3, 1, 'pmc'), armyB: SOLO.rollOpFor(3, pl, 'pmc', false),
      nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
      solo: { coop: pl > 1, faction: 'pmc', opFaction: 'pmc', names: pl > 1 ? ['A', 'B'] : ['A'] } });
    const st = e.state(); games++;
    const t = st.sc.targets;
    t.forEach((p, i) => t.slice(i + 1).forEach((q) => { if (R.inches(p.x, p.y, q.x, q.y) < 12 - 1e-6) close++; }));
  }
  ok('Sabotage: every objective 12" from every other, at Level 1 and 2', close === 0, close + ' pairs too close in ' + games + ' tables');
  let short = 0;
  for (let g = 0; g < 8; g++) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 's_decap', armyA: SOLO.rollCommando(3, 1, 'pmc'), armyB: SOLO.rollOpFor(3, 1, 'pmc', false),
      nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
    const st = e.state(), ls = st.units.filter((u) => u.soloLeader), cs = st.sc.counters;
    const near = cs.filter((c) => ls.some((l) => R.inches(c.x, c.y, l.x, l.y) <= 12)).length;
    if (near < Math.ceil(cs.length / 2)) short++;
  }
  ok('Decapitation: at least half the counters within 12" of a leader', short === 0, short + ' of 8 tables short');
  const { st } = solo();
  st.sc.lz = {};
  st.terrain.push({ kind: 'woods', x: 18, y: 18, w: 4, h: 12 });
  ok('a landing zone with woods inside its circle is not legal', !SOLO.lzLegal(st, { x: 23.5, y: 24 }, 1));
  ok('...one in clear ground is', SOLO.lzLegal(st, { x: 30, y: 24 }, 1));
  const home = { kind: 'bunker', x: 20, y: 20, w: 4, h: 4, home: true };
  const civ = mk('regular', 'A', 26, 22, { soloCiv: true }), mil = mk('regular', 'A', 26, 22);
  const s2 = world([civ, mil], [home]);
  ok('Evacuation: civilians may not go back into a reinforced building', !R.enterTargets(s2, civ).length && R.enterTargets(s2, mil).length > 0);
})();

console.log('\nVEH-5 A Tier III hull pays 2" to drive through a high wall, as through a low one');
(function () {
  const lcv = mk('lcv', 'A', 10, 24);
  ok('high wall: 2"', R.terrainCost(lcv, 'wall') === 2, String(R.terrainCost(lcv, 'wall')));
  ok('low wall: 2"', R.terrainCost(lcv, 'barricade') === 2, String(R.terrainCost(lcv, 'barricade')));
})();

console.log('\nVEH-7 Martyrdom against a machine rolls on the assault table');
(function () {
  const holy = mk('racolytes', 'A', 10, 10), lcv = mk('lcv', 'B', 11.5, 10, { fp: null });   // (no defensive fire to stop the charge)
  const st = world([holy, lcv]); st.doctrines = { A: ['P1'], B: [] };
  const res = R.assault(st, holy, lcv, { martyr: { A: true } });
  const lines = res.log.map((l) => l.text || '').join(' | ');
  const mart = lines.indexOf('Martyrdom') >= 0;
  ok('the martyr goes in, and its hits read off the assault table', mart && /Bounced off the armour|Hull breached|Charge placed/.test(lines.slice(lines.indexOf('Martyrdom'))), lines.slice(0, 160));
})();

console.log('\nCMP-9 Rapid Relocation: up to half the units, rounded down');
(function () {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular', 'regular', 'regular', 'regular', 'regular'], armyB: ['regular'], nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto', tactics: { A: null, B: null } });
  const st = e.state();
  st.units.forEach((u, i) => { u.reserve = false; u.aboard = null; u.x = 5 + i; u.y = 5; });
  const n = st.units.filter((u) => u.side === 'A').length;
  ok(n + ' units: ' + Math.floor(n / 2) + ' may relocate', e.query.relocCap('A') === Math.floor(n / 2), String(e.query.relocCap('A')));
})();

console.log('\nCMP-13 Suicidal Tendencies near Field Medics: a 6 is still MEDIC!');
(function () {
  const sq = mk('regular', 'A', 10, 10, { camp: { flags: { suicidal: true }, once: {} } }), med = mk('medics', 'A', 12, 10);
  const st = world([sq, med]);
  // damage.js binds its own d6 at start: fix Math.random for the one call instead
  const roll = (v, fn) => { const keep = Math.random; Math.random = () => (v - 0.5) / 6; try { return fn(); } finally { Math.random = keep; } };
  const six = roll(6, () => R.resolveShootingHits(st, sq, 1, 0, null, true));
  ok('a 6 goes to the medic', /MEDIC!/.test(six.rolls.join(' ')), six.rolls.join(' '));
  const five = roll(5, () => R.resolveShootingHits(st, sq, 1, 0, null, true));
  ok('...a 5 is still Man down!', /Man down!/.test(five.rolls.join(' ')) && five.casualties === 1, five.rolls.join(' '));
  const alone = world([mk('regular', 'A', 10, 10, { camp: { flags: { suicidal: true }, once: {} } })]);
  const six2 = roll(6, () => R.resolveShootingHits(alone, alone.units[0], 1, 0, null, true));
  ok('...and with no medic near, a 6 is Man down!', /Man down!/.test(six2.rolls.join(' ')), six2.rolls.join(' '));
})();

console.log('\nXEN-18 A Markerlight marks what the tribe sees only along a clear line');
(function () {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['xalpha3', 'xbeta3', 'xgamma3'], armyB: ['regular'], nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto', tactics: { A: null, B: null } });
  const st = e.state();
  st.terrain.length = 0;
  const beta = st.units.find((u) => u.key === 'xbeta3'), spot = st.units.find((u) => u.key === 'xgamma3');
  const alpha = st.units.find((u) => u.key === 'xalpha3'), foe = st.units.find((u) => u.side === 'B');
  st.units.forEach((u) => { u.reserve = false; u.aboard = null; });
  beta.x = 6; beta.y = 24; alpha.x = 4; alpha.y = 4; foe.x = 26; foe.y = 24; spot.x = 20; spot.y = 30;
  ok('the tribe sees it and the line is clear: it can mark', e.query.markTargets(beta).indexOf(foe) >= 0);
  st.terrain.push({ kind: 'building', x: 13, y: 21, w: 4, h: 6 });
  ok('...a building between the marker and the target: it cannot', e.query.markTargets(beta).indexOf(foe) < 0);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
