/* The AI against the book (the rules review at 7dd7306, M-10, M-14, M-15):
   nothing fires a Cumbersome Weapon on the move (p. 57); a Reasonably Neutral
   OpFor unit holds its position, moving only into better cover (p. 147); and
   in Decapitation every OpFor Command Unit is a leader to be killed (p. 152). */
'use strict';
const { R, Engine, SOLO } = require('../../server/rules.js');
let seed = 21;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function steps(e, max) {
  let n = 0;
  while (!e.over() && n < max) { if (!e.intent('A', { k: 'step' }).ok) break; n++; }
}

console.log('\nCumbersome Weapons may not advance (p. 57)');
(function () {
  const hmg = Object.assign(JSON.parse(JSON.stringify(R.profile('hmgteam'))), { id: 'A1', side: 'A', x: 10, y: 10, alive: true, models: 3, sp: 0, shotFrom: [] });
  const foe = Object.assign(JSON.parse(JSON.stringify(R.profile('regular'))), { id: 'B1', side: 'B', x: 20, y: 10, alive: true, models: 5, sp: 0, shotFrom: [] });
  const st = { units: [hmg, foe], terrain: [], objectives: [], log: [] };
  ok('a Heavy MG team may Fire! at a squad in range', R.canShoot(st, hmg, foe, 'fire'));
  ok('...but not take an Advance shot at it', !R.canShoot(st, hmg, foe, 'advance'));
})();
(function () {
  // whole AI battles: no Cumbersome main weapon is ever fired in Advance mode
  const orig = R.shoot;
  let cumb = 0, adv = 0;
  R.shoot = function (st, a, t, mode, opts) {
    if (R.has(a, 'Cumbersome Weapon') && !(opts && opts.aux)) { cumb++; if (mode === 'advance') adv++; }
    return orig.apply(this, arguments);
  };
  try {
    for (let n = 0; n < 4; n++) {
      const e = Engine.create();
      e.start({ tier: 4, pl: 1, scenario: 'meeting', armyA: R.rollArmy(4, 1, null, 'pmc'), armyB: R.rollArmy(4, 1, null, 'rebel'),
        nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' });
      for (let g = 0; g < 4 && e.state() && e.state().swapAsk; g++) e.intent(e.state().swapAsk.side, { k: 'swapdone' });
      steps(e, 4000);
    }
  } finally { R.shoot = orig; }
  ok('in AI battles, no Cumbersome Weapon fires on the move', cumb > 0 && adv === 0, cumb + ' Cumbersome shots, ' + adv + ' of them Advance shots');
})();

console.log('\nReasonably Neutral holds its position (p. 147)');
(function () {
  let moves = 0, intoCover = 0, closer = 0;
  for (let i = 0; i < 6; i++) for (const scen of ['s_crush', 's_sabotage', 's_decap']) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: scen, armyA: SOLO.rollCommando(3, 1, 'pmc'), armyB: SOLO.rollOpFor(3, 1, 'rebel', false),
      nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
      solo: { coop: false, faction: 'pmc', opFaction: 'rebel', names: ['A'] } });
    let n = 0;
    while (!e.over() && n < 3000) {
      const st = e.state(), n0 = st.log.length, pos = {};
      st.units.forEach((u) => { pos[u.id] = { x: u.x, y: u.y }; });
      if (!e.intent('A', { k: 'step' }).ok) break;
      n++;
      for (let j = n0; j < st.log.length; j++) {
        const m = /^(.*) — behaviour D6 .* = (-?\d+): (\w+)\./.exec(st.log[j].text || '');
        if (!m || m[3] !== 'neutral') continue;
        const u = st.units.find((v) => v.label === m[1] && v.side === 'B');
        if (!u || !pos[u.id] || pos[u.id].x < 0 || u.x < 0) continue;
        if (R.inches(u.x, u.y, pos[u.id].x, pos[u.id].y) < 0.5) continue;
        // a step can run on into the Rally phase: a unit that broke and fled there made no Neutral move
        if (st.log.slice(j).some((l) => (l.text || '').indexOf(u.label + ' is broken and flees') === 0 || (l.text || '').indexOf(u.label + ' falls back') === 0)) continue;
        moves++;
        if (R.coverAt(st, u.x, u.y, u) > R.coverAt(st, pos[u.id].x, pos[u.id].y, u)) intoCover++;
        else {
          const foes = st.units.filter((v) => v.side === 'A' && v.alive && v.x >= 0);
          const nd = (p) => Math.min.apply(null, foes.map((f) => R.inches(f.x, f.y, p.x, p.y)));
          if (nd(u) < nd(pos[u.id]) - 2) closer++;
        }
      }
    }
  }
  ok('a Neutral unit that moves goes into better cover', moves >= 3 && intoCover === moves, intoCover + ' of ' + moves + ' moves into cover');
  ok('...and never closes on the players in the open', closer === 0, closer + '');
})();

console.log('\nDecapitation: every OpFor Command Unit is a leader (p. 152)');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_decap', armyA: SOLO.rollCommando(3, 1, 'pmc'),
    armyB: ['cmd3', 'regular', 'regular', 'rookie', 'recruits'],
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'dense',
    solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
  const st = e.state();
  const cmd = st.units.filter((u) => u.side === 'B' && (u.command || R.has(u, 'Command Unit')));
  ok('the pool\'s Command Unit and the scenario\'s own are both on the field', cmd.length >= 2, cmd.map((u) => u.name).join(', '));
  ok('...both are leaders: placed, fixed and unbreakable', cmd.every((u) => u.soloLeader && u.soloFixed && u.noBreak && u.x >= 0));
  ok('...in place from the start, not under a counter', cmd.every((u) => !u.reserve));
  // kill the scenario's leader only: the game is not won while the pool's one lives
  const extra = cmd.find((u) => u.key !== 'cmd3') || cmd[0], pooled = cmd.find((u) => u !== extra);
  extra.alive = false;
  const r1 = st.scen.check(st);
  ok('killing one leader is not enough', !r1 || r1.winner !== 'A');
  pooled.alive = false;
  const r2 = st.scen.check(st);
  ok('...killing every one wins', !!r2 && r2.winner === 'A', r2 && r2.text);
})();

console.log('\nThe OpFor answers the commando\u2019s machines, threat by threat (p. 148)');
(function () {
  const aa = (p) => (p.rules || []).some((r) => r === 'Anti-aircraft' || r === 'Specialisation (air)');
  const at = (p) => (p.rules || []).some((r) => /^Anti-tank/.test(r));
  let airMiss = 0, groundMiss = 0, n = 0;
  for (const f of ['rebel', 'pmc', 'bugs', 'xeno']) for (const bt of [2, 3, 4, 5]) for (let i = 0; i < 10; i++) {
    n++;
    const ps = SOLO.rollOpFor(bt, 1, f, { air: true, ground: true }).map((k) => R.profile(R.splitPick(k).key));
    if (!ps.some((p) => aa(p) || (p.cls === 'aircraft' && p.tier >= bt))) airMiss++;
    // a swarm has no anti-tank bugs, and its only machines are Tier V: below Battle Tier V it cannot (p. 114)
    if (f === 'bugs' && bt < 5) continue;
    if (!ps.some((p) => at(p) || (p.cls !== 'infantry' && p.tier >= bt))) groundMiss++;
  }
  ok('against an aircraft, it always has an anti-air unit or an aircraft of the Battle Tier', airMiss === 0, airMiss + ' of ' + n + ' without');
  ok('...and against a hull, an anti-tank unit or a machine of the Battle Tier', groundMiss === 0, groundMiss + ' of ' + n + ' without');
})();

console.log('\nReasonably Offensive takes Firepower ground over cover (p. 147)');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular'], armyB: ['regular'], nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' });
  const st = e.state(), u = st.units.find((x) => x.side === 'B'), foe = st.units.find((x) => x.side === 'A');
  st.terrain.length = 0;
  st.terrain.push({ kind: 'hill', x: 18, y: 8, w: 6, h: 6 }, { kind: 'ruins', x: 18, y: 34, w: 6, h: 6 });
  u.x = 30; u.y = 24; foe.x = 4; foe.y = 24;
  const goal = { x: 10, y: 24 }, hill = { x: 21, y: 11 }, ruin = { x: 21, y: 37 };
  const off = (c) => e.query.scoreSpot(u, c, goal, 'offensive'), def = (c) => e.query.scoreSpot(u, c, goal, 'defensive');
  ok('Reasonably Offensive prefers the hill (Firepower) to the ruins (cover)', off(hill) > off(ruin), off(hill).toFixed(1) + ' vs ' + off(ruin).toFixed(1));
  ok('...where a defensive unit prefers the ruins', def(ruin) > def(hill), def(ruin).toFixed(1) + ' vs ' + def(hill).toFixed(1));
})();

console.log('\nRun for Your Lives! gets a garrison out of its building (p. 147)');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_crush', armyA: ['regular'], armyB: ['regular', 'regular'], nameA: 'A', nameB: 'OpFor',
    colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
  const st = e.state();
  st.phase = 'battle'; st.turn = 2; st.terrain.length = 0;
  const bld = { kind: 'building', x: 22, y: 22, w: 4, h: 4 };
  st.terrain.push(bld);
  const foe = st.units.find((x) => x.side === 'A'), [g, other] = st.units.filter((x) => x.side === 'B');
  st.units.forEach((x) => { x.reserve = false; x.aboard = null; x.activated = false; x.wave = 0; });
  foe.x = 14; foe.y = 24; other.x = 44; other.y = 44;
  R.enterBuilding(st, g, bld, 0);
  st.scen.behaviour = () => ({ mod: -9, why: 'test' });           // whatever the die, Run for Your Lives!
  const n0 = st.log.length;
  e.query.aiAct(g);
  const said = st.log.slice(n0).map((l) => l.text).join(' | ');
  ok('the garrison comes out rather than firing', !g.bld && said.indexOf(g.label + ' fires at') < 0, (g.bld ? 'still inside; ' : '') + said.slice(-200));
  ok('...on the side away from the enemy', g.x > bld.x + bld.w / 2, g.x.toFixed(1));
})();

console.log('\nThe VIP draws the OpFor\u2019s attack, Kill Them All! or not (p. 152)');
(function () {
  let fired = 0, charged = 0, runs = 0;
  for (let k = 0; k < 6; k++) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 's_vip', armyA: ['cmd3', 'regular', 'regular'], armyB: ['regular', 'regular'], nameA: 'A', nameB: 'OpFor',
      colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
    const st = e.state();
    st.phase = 'battle'; st.turn = 2; st.terrain.length = 0;
    const b = st.units.filter((x) => x.side === 'B'), a = st.units.filter((x) => x.side === 'A');
    st.units.forEach((x) => { x.reserve = false; x.aboard = null; x.activated = false; x.wave = 0; x.sp = 0; x.x = 44; x.y = 44; });
    const u = b[0], vip = st.scen.mustTarget(st, u);
    if (!vip) continue;
    // the VIP 14" off, in range but beyond a charge; another squad 4" off, easily charged
    u.x = 20; u.y = 24; vip.x = 34; vip.y = 24;
    const near = a.find((x) => x !== vip); near.x = 20; near.y = 30;
    b[1].x = 2; b[1].y = 2;
    st.scen.behaviour = () => ({ mod: 9, why: 'test' });          // Kill Them All!
    const n0 = st.log.length;
    e.query.aiAct(u);
    runs++;
    const said = st.log.slice(n0).map((l) => l.text || '').join(' | ');
    if (said.indexOf(u.label + ' fires at ' + vip.label) >= 0) fired++;
    if (said.indexOf(u.label + ' charges') >= 0 || said.indexOf(u.label + ' assaults') >= 0) charged++;
  }
  ok('a squad on Kill Them All! that cannot reach the VIP to charge shoots it instead', runs > 0 && fired === runs && charged === 0, fired + ' of ' + runs + ' shot it, ' + charged + ' charged');
})();

console.log('\nProtecting the VIP: a Broken unit flees from the enemy, not to the evacuation point (p. 151)');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_vip', armyA: ['cmd3', 'regular', 'regular'], armyB: ['regular', 'regular'], nameA: 'A', nameB: 'OpFor',
    colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
  const st = e.state();
  st.phase = 'battle'; st.turn = 2; st.terrain.length = 0;
  st.units.forEach((x) => { x.reserve = false; x.aboard = null; x.activated = false; x.wave = 0; x.sp = 0; x.x = 44; x.y = 44; });
  const ev = st.sc.evac, a = st.units.filter((x) => x.side === 'A'), b = st.units.filter((x) => x.side === 'B');
  const vip = a.find((x) => x.vip), sq = a.find((x) => !x.vip);
  a.filter((x) => x !== vip && x !== sq).forEach((x) => { x.x = 4; x.y = 44; });
  // the enemy on the far side of the evacuation point from each: fleeing away takes them outwards
  vip.x = ev.x + 4; vip.y = ev.y; b[0].x = ev.x - 3; b[0].y = ev.y;
  sq.x = ev.x; sq.y = ev.y + 10; b[1].x = ev.x; b[1].y = ev.y + 4;
  [vip, sq].forEach((x) => { x.sp = 3 * R.currentMorale(x); });
  const d0 = R.inches(vip.x, vip.y, b[0].x, b[0].y), s0 = R.inches(sq.x, sq.y, b[1].x, b[1].y);
  e.query.fleeBroken();
  ok('the Broken VIP falls back away from the enemy', R.inches(vip.x, vip.y, b[0].x, b[0].y) > d0 + 0.5,
    R.inches(vip.x, vip.y, b[0].x, b[0].y).toFixed(1) + '" from it, was ' + d0.toFixed(1) + '"');
  ok('...but stays within 6" of the evacuation point', R.inches(vip.x, vip.y, ev.x, ev.y) <= 6 + 1e-6, R.inches(vip.x, vip.y, ev.x, ev.y).toFixed(1) + '"');
  ok('another Broken unit flees away from the enemy, past the 12" ring', sq.fled || R.inches(sq.x, sq.y, ev.x, ev.y) > 12,
    sq.fled ? 'fled' : R.inches(sq.x, sq.y, ev.x, ev.y).toFixed(1) + '" from the point, was 10"');
  ok('...not back towards the evacuation point', sq.fled || R.inches(sq.x, sq.y, b[1].x, b[1].y) > s0 + 4);
})();

console.log('\nIn a solitaire battle a Broken unit by the table edge runs off (p. 34)');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_crush', armyA: ['regular', 'regular'], armyB: ['regular'], nameA: 'A', nameB: 'OpFor',
    colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
  const st = e.state();
  st.phase = 'battle'; st.turn = 2; st.terrain.length = 0;
  st.units.forEach((x) => { x.reserve = false; x.aboard = null; x.activated = false; x.wave = 0; x.sp = 0; });
  const [vic, mate] = st.units.filter((x) => x.side === 'A'), foe = st.units.find((x) => x.side === 'B');
  vic.x = 3; vic.y = 24; foe.x = 16; foe.y = 24; mate.x = 30; mate.y = 44;
  vic.sp = 3 * R.currentMorale(vic);
  e.query.fleeBroken();
  ok('its flight away from the enemy carries it off the table — fled', !vic.alive && vic.fled, 'at ' + vic.x.toFixed(1) + ',' + vic.y.toFixed(1));
})();

console.log('\nEvacuation: the entry points keep their distances (p. 153)');
(function () {
  const gap = (b, x, y) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.y - y, 0, y - (b.y + b.h)));
  let tables = 0, short = 0, close = 0, home = 0, safe = 0;
  for (let i = 0; i < 120; i++) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 's_evac', armyA: ['regular', 'regular'], armyB: ['regular'], nameA: 'A', nameB: 'OpFor',
      colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
    const sc = e.state().sc, en = sc.entries;
    tables++;
    if (en.length < 6) short++;
    en.forEach((p, k) => en.slice(k + 1).forEach((q) => { if (Math.hypot(p.x - q.x, p.y - q.y) < 12) close++; }));
    en.forEach((p) => {
      if (sc.homes.some((b) => gap(b, p.x, p.y) < 6)) home++;
      if (Math.hypot(p.x - sc.safe.x, p.y - sc.safe.y) < sc.safe.r + 12) safe++;
    });
  }
  ok('six entry points on every table', short === 0, tables + ' tables, ' + short + ' short');
  ok('...at least 12" from each other', close === 0, close + ' pairs closer');
  ok('...6" from every reinforced building\'s walls', home === 0, home + ' too close');
  ok('...and 12" from the safe zone', safe === 0, safe + ' too close');
})();

console.log('\nAmbush!: two even halves either side of the road, 6" apart (p. 156)');
(function () {
  // random commandos: some of them garrison the buildings by the road, which must keep the split too
  function ambush(fixed) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 's_ambush', armyA: fixed ? ['cmd3', 'regular', 'regular', 'rookie', 'rookie'] : SOLO.rollCommando(3, 1, 'pmc'), armyB: ['regular', 'regular'],
      nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
    return e;
  }
  const H = R.BOARD.h, UR = R.UNIT_R;
  let worst = 0, close = 0;
  for (let k = 0; k < 60; k++) {
    const e = ambush(), st = e.state();
    e.intent('A', { k: 'autodeploy' });
    const a = st.units.filter((u) => u.side === 'A' && u.x >= 0 && !u.aboard);
    const n = a.filter((u) => u.y < H / 2).length;
    worst = Math.max(worst, Math.abs(n - (a.length - n)));
    a.forEach((u) => a.forEach((o) => { if ((u.y < H / 2) !== (o.y < H / 2) && R.inches(u.x, u.y, o.x, o.y) - 2 * UR < 6 - 1e-6) close++; }));
  }
  ok('auto-deploy splits the force evenly', worst <= 1, 'worst difference ' + worst);
  ok('...with the halves at least 6" apart', close === 0, close + ' pairs closer');
  const e = ambush(true), st = e.state();
  const a = st.units.filter((u) => u.side === 'A');
  a.forEach((u, i) => { u.x = 6 + i * 4; u.y = H / 2 - 6; });         // everyone on the north side
  ok('all on one side, the battle will not begin', !e.intent('A', { k: 'start' }).ok && st.phase === 'deploy');
  a.forEach((u, i) => { if (i % 2) u.y = H / 2 + 8; });
  const res = e.intent('A', { k: 'start' });
  ok('...split, it does', res.ok || st.phase !== 'deploy', res.why || '');
  const e2 = ambush(true), s2 = e2.state(), u0 = s2.units.find((u) => u.side === 'A'), u1 = s2.units.filter((u) => u.side === 'A')[1];
  u0.x = 20; u0.y = H / 2 - 4;
  ok('a unit may not stand within 6" of the other half across the road', !s2.scen.deployOK(s2, 'A', 20, H / 2 + 3.5, u1) && s2.scen.deployOK(s2, 'A', 30, H / 2 + 4, u1));
})();

console.log('\nAn OpFor unit rolls first, and takes its special actions on a 1-6 (p. 147)');
(function () {
  function trial(mod) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 's_crush', armyA: ['regular', 'regular'], armyB: ['snipers', 'regular', 'regular'], nameA: 'A', nameB: 'OpFor',
      colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
    const st = e.state();
    st.phase = 'battle'; st.turn = 2; st.terrain.length = 0;
    st.units.forEach((x, i) => { x.reserve = false; x.aboard = null; x.activated = false; x.wave = 0; x.sp = 0; x.x = x.side === 'A' ? 10 : 22; x.y = 14 + i * 3; });
    const sn = st.units.find((x) => x.key === 'snipers');
    st.scen.behaviour = () => ({ mod, why: 'test' });
    const keep = R.d6; R.d6 = () => 3;                            // 3 + mod on the table
    const n0 = st.log.length;
    try { e.query.aiAct(sn); } finally { R.d6 = keep; }
    const said = st.log.slice(n0).map((l) => l.text || '').join(' | ');
    return { said, marked: /designates|marks/i.test(said) };
  }
  const calm = trial(0), run = trial(-9), wild = trial(9);
  ok('on a 1-6 (here Neutral) the marker designates', /neutral/.test(calm.said) && calm.marked, calm.said.slice(0, 120));
  ok('...on Run for Your Lives! it does not', /flee/.test(run.said) && !run.marked, run.said.slice(0, 120));
  ok('...nor on Kill Them All!', /assault/.test(wild.said) && !wild.marked, wild.said.slice(0, 120));
})();

console.log('\nSOL-6 Defensive and Neutral OpFor engage the biggest threat (p. 147)');
(function () {
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_crush', armyA: ['hmgteam', 'recruits'], armyB: ['regular', 'regular'],
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
    solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
  const st = e.state();
  st.terrain.length = 0; st.objectives.length = 0; if (st.sc) st.sc.targets = [];
  const hmg = st.units.find((u) => u.key === 'hmgteam'), soft = st.units.find((u) => u.key === 'recruits');
  const [ob, mate] = st.units.filter((u) => u.side === 'B');
  st.units.forEach((u) => { u.reserve = false; u.aboard = null; u.alive = true; u.sp = 0; u.bld = null; });
  // the shooter at 20,24; its friend at 30,24; the Heavy MG 16" off its friend, the recruits shaken and close by
  ob.x = 20; ob.y = 24; mate.x = 30; mate.y = 24;
  hmg.x = 30; hmg.y = 8; hmg.models = 3;
  soft.x = 22; soft.y = 30; soft.models = 2; soft.sp = soft.morale + 1;
  const best = (() => { const t = e.query.threatTarget(ob); return t && t.t; })();
  ok('a Defensive or Neutral unit picks the Heavy MG that threatens its friends', best === hmg, best && best.key);
  // the recruits on a mission objective: now they are the biggest threat
  st.objectives.push({ x: 22, y: 30 });
  const best2 = e.query.threatTarget(ob).t;
  ok('...but an enemy on a mission objective comes first', best2 === soft, best2 && best2.key);
})();

console.log('\nSOL-8 A Suppressed OpFor unit rolls its behaviour, and takes from the Suppressed options (pp. 34, 147)');
(function () {
  const seen = {}; let bad = 0, rolled = 0;
  for (let k = 0; k < 24; k++) {
    const e = Engine.create();
    e.start({ tier: 3, pl: 1, scenario: 's_crush', armyA: ['regular', 'regular'], armyB: ['regular', 'regular'],
      nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
      solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
    const st = e.state();
    st.terrain.length = 0; st.objectives.length = 0;
    const [a1, a2] = st.units.filter((u) => u.side === 'A'), [b1, b2] = st.units.filter((u) => u.side === 'B');
    st.units.forEach((u) => { u.reserve = false; u.aboard = null; u.alive = true; u.sp = 0; u.bld = null; u.activated = false; });
    b1.x = 20; b1.y = 24; b2.x = 40; b2.y = 40; a1.x = 26; a1.y = 24; a2.x = k % 2 ? 4 : 30; a2.y = 4;
    b1.sp = b1.morale + 1;
    st.activeSide = 'B';
    const n0 = st.log.length;
    e.query.aiAct(b1);
    const lines = st.log.slice(n0).map((l) => l.text || '');
    const cut = lines.findIndex((t, j) => j > 0 && /behaviour D6|Rally phase/.test(t));
    const txt = lines.slice(0, cut < 0 ? lines.length : cut).join(' | ');
    if (/behaviour D6/.test(lines[0])) rolled++;
    const what = /charges|Assault/.test(txt) ? 'charge' : /\(auxiliary weapons\) fires/.test(txt) ? 'aux' : /fires/.test(txt) ? 'main' :
      /scrambles|gets into/.test(txt) ? 'cover' : /regroup|rall/i.test(txt) ? 'regroup' : 'other';
    seen[what] = (seen[what] || 0) + 1;
    if (what === 'charge' || what === 'main' || what === 'other') bad++;
  }
  ok('it rolls its behaviour as it activates', rolled === 24, rolled + ' of 24');
  ok('...and only fires its Auxiliary weapons, moves to cover or regroups', bad === 0 && (seen.aux || 0) > 0, JSON.stringify(seen));
})();

(function () {
  // a Decapitation leader, Suppressed: still shoots, with its Auxiliary weapons
  const e = Engine.create();
  e.start({ tier: 3, pl: 1, scenario: 's_decap', armyA: ['regular', 'regular'], armyB: SOLO.rollOpFor(3, 1, 'pmc', false),
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse',
    solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['A'] } });
  const st = e.state();
  const lead = st.units.find((u) => u.side === 'B' && u.soloLeader), foe = st.units.find((u) => u.side === 'A');
  if (!lead) { ok('a Decapitation leader is on the table', false); return; }
  st.terrain.length = 0;
  st.units.forEach((u) => { if (u !== lead && u !== foe) { u.x = u.side === 'A' ? 2 : 46; u.y = 2; } u.reserve = false; u.aboard = null; u.bld = null; });
  lead.x = 20; lead.y = 24; foe.x = 25; foe.y = 24; foe.alive = true; foe.reserve = false;
  lead.sp = lead.morale + 1; lead.activated = false; st.activeSide = 'B';
  const n0 = st.log.length;
  e.query.aiAct(lead);
  const txt = st.log.slice(n0, n0 + 4).map((l) => l.text || '').join(' | ');
  ok('a Suppressed Decapitation leader fires its Auxiliary weapons', /\(auxiliary weapons\) fires/.test(txt), txt.slice(0, 140));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
