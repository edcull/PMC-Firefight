/* Other Worlds (Appendix 2, pp. 164-165, an optional rule): the three D10s, and what
   each condition does — to the units' numbers, their Moves, an Advance, the hit
   tables, sight, jamming, a drone's link, the turn order — and the campaign's
   roll with the contract and its Trauma point. */
'use strict';
const { R, Engine, C } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const W0 = { gravity: 'standard', atmosphere: 'standard', anomaly: 'none' };
function battle(world, extra) {
  const e = Engine.create({});
  e.start(Object.assign({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular', 'lcv', 'lhunter:wheeled:drone'], armyB: ['regular'], nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto',
    options: world === null ? {} : { otherWorlds: true }, world: world ? Object.assign({}, W0, world) : undefined }, extra || {}));
  return e;
}
const sq = (st, side) => st.units.find((u) => u.side === (side || 'A') && u.key === 'regular');
const prof = R.profile('regular');

console.log('\nThe roll');
{
  const seen = { gravity: {}, atmosphere: {}, anomaly: {} };
  for (let i = 0; i < 3000; i++) { const w = R.rollWorld(); for (const k in seen) seen[k][w[k]] = (seen[k][w[k]] || 0) + 1; }
  ok('three D10s: standard on 0-5 (about 60%)', Math.abs(seen.gravity.standard / 3000 - 0.6) < 0.05 && Math.abs(seen.atmosphere.standard / 3000 - 0.6) < 0.05, JSON.stringify(seen.gravity));
  ok('...and every condition of the table comes up', ['low', 'high'].every((k) => seen.gravity[k]) && ['none', 'toxic', 'foggy', 'foggytoxic'].every((k) => seen.atmosphere[k]) &&
    ['radiation', 'time', 'weakness'].every((k) => seen.anomaly[k]), JSON.stringify(seen.anomaly));
  ok('the option off: no world at all, whatever is asked', battle(null, { world: { gravity: 'low' } }).state().cfg.world === null);
  const st = battle(undefined).state();
  ok('the option on and nothing given: rolled at the start of the battle', !!st.cfg.world && 'gravity' in st.cfg.world);
  ok('...and one given (a campaign’s contract) is kept', battle({ gravity: 'high' }).state().cfg.world.gravity === 'high');
}

console.log('\nGravity');
{
  let e = battle({ gravity: 'low' }), st = e.state(), u = sq(st), lcv = st.units.find((x) => x.key === 'lcv');
  ok('low: infantry M+6" on a Move', e.query.moveBonus ? e.query.moveBonus(u, 'move') === 6 : true);
  ok('...a ground vehicle’s turns cost 1" more', lcv.turn === R.profile('lcv').turn + 1, lcv.turn + ' vs ' + R.profile('lcv').turn);
  const foe = sq(st, 'B'); u.x = 10; u.y = 10; foe.x = 20; foe.y = 10;
  ok('...an Advance fires at Basic Firepower', R.shotMods(st, u, foe, 'advance', {}).basic && !R.shotMods(battle(W0).state(), u, foe, 'advance', {}).basic);
  e = battle({ gravity: 'high' }); st = e.state(); u = sq(st);
  ok('high: infantry +1 Defence', u.def === prof.def + 1);
  ok('...the vehicle’s Defence as it was', st.units.find((x) => x.key === 'lcv').def === R.profile('lcv').def);
}

console.log('\nAtmosphere');
{
  let st = battle({ atmosphere: 'none' }).state();
  ok('none: every weapon’s Range +6"', sq(st).range === prof.range + 6);
  for (const atmo of ['none', 'toxic', 'foggytoxic']) {
    st = battle({ atmosphere: atmo }).state();
    const keep = Math.random; let k = 0; const seq = [0.01, 0.2];       // a 1, then a 2
    Math.random = () => seq[k++ % 2];
    let res; try { res = R.resolveShootingHits(st, sq(st), 2, 0, null, true); } finally { Math.random = keep; }
    ok(atmo + ': +1 against infantry, a 1 still ignored', /D6 1.*Steady/.test(res.rolls[0]) && /Get down/.test(res.rolls[1]), res.rolls.join(' | '));
  }
  st = battle({ atmosphere: 'foggy' }).state();
  const a = sq(st), b = sq(st, 'B'); st.terrain.length = 0; a.x = 4; a.y = 24; b.x = 30; b.y = 24;
  ok('foggy: no line of sight past 18"', !R.hasLoS(st, a, b) && R.hasLoS(battle(W0).state(), a, b));
}

console.log('\nAnomalies');
{
  let st = battle({ anomaly: 'radiation' }).state();
  ok('high radiation: everyone counts as jammed', R.jammedNearby(st, sq(st)) && !R.jammedNearby(battle(W0).state(), sq(battle(W0).state())));
  st = battle({ anomaly: 'weakness' }).state();
  const u = sq(st);
  ok('unexplained weakness: −1 Movement, Firepower, Assault and Morale', u.move === prof.move - 1 && u.fp === prof.fp - 1 && u.assault === prof.assault - 1 && u.morale === prof.morale - 1);
  const drone = st.units.find((x) => x.drone);
  ok('...but not a drone', !!drone && drone.move === R.applyDrone(R.applyPropulsion(Object.assign({}, R.profile('lhunter'), { rules: R.profile('lhunter').rules.slice() }), 'wheeled'), true).move);
  // in a campaign, a Trauma point each (p. 165)
  const entry = C.newEntry('regular'), line = { startSize: 8, endSize: 8, weakened: true };
  const tp = C.tpFor(line, { entry: entry, company: { doctrines: [] } });
  ok('...and in a campaign, a Trauma point each', tp.total === 1 && /Unexplained weakness/.test(tp.lines.map((l) => l.text).join()), JSON.stringify(tp));
  // a drone vehicle whose link is down cannot move this activation
  st = battle({ anomaly: 'radiation' }).state();
  const e2 = battle({ anomaly: 'radiation' }), st2 = e2.state(), dv = st2.units.find((x) => x.drone);
  dv.radioRoll = { turn: st2.turn, ok: false };
  const as = e2.query.actionState(dv, 'move');
  ok('...a drone vehicle whose link is down (D6 1) cannot Move this activation', !as.on && /link is down/.test(as.hint || ''), as.hint);
  // time anomalies: a side with its activations done may go again on a 5+ (an AI battle, start to end)
  const e3 = Engine.create();
  e3.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'rebel'), nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', terrainSetup: 'auto', options: { otherWorlds: true }, world: Object.assign({}, W0, { anomaly: 'time' }) });
  for (let g = 0; g < 20000 && !e3.over(); g++) {
    const s = e3.state();
    if (s.swapAsk) { e3.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e3.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e3.intent('A', { k: 'autodeploy' }); e3.intent('B', { k: 'autodeploy' }); e3.intent('A', { k: 'start' }); continue; }
    if (!e3.intent(s.activeSide || 'A', { k: 'step' }).ok) break;
  }
  const extra = e3.state().log.filter((l) => /Time anomalies: D6 [56]/.test(l.text || '')).length;
  ok('time anomalies: in a whole battle, sides act again on a 5+', e3.over() && extra > 0, extra + ' extra activations');
}

console.log('\nGravity and the Move');
{
  const e = battle({ gravity: 'high' }), st = e.state();
  ok('high gravity: infantry M+1" on a Move (1" less)', e.query.moveBonus(sq(st), 'move') === 1);
  ok('...a ground vehicle M+2" (2" less)', e.query.moveBonus(st.units.find((x) => x.key === 'lcv'), 'move') === 2);
  const e2 = battle({ gravity: 'low' }), st2 = e2.state();
  ok('low gravity: a ground vehicle M+8"', e2.query.moveBonus(st2.units.find((x) => x.key === 'lcv'), 'move') === 8);
  ok('...and nothing changes off a Move (an Assault)', e2.query.moveBonus(sq(st2), 'assault') === battle(W0).query.moveBonus(sq(battle(W0).state()), 'assault'));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
