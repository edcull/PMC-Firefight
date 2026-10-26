/* A convoy on the road (src/story/scenarios-story.js, Convoy and Intercept):
   its cars come on where the road meets their edge and keep to the road on
   their way across; they are cargo, not in their side's rout tally; and to
   stop the convoy every car in it has to be destroyed. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/dead-reckoning.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
// a story's convoy battle, both sides the AI's
function battle(story, chapter, node, choose) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, story, {});
  c.companies.A.kUC = 20;
  c.story.chapter = chapter; c.story.node = node;
  if (choose) S.choose(c, choose);
  const spec = S.battleSpec(c);
  const cfg = L.toCfg(c, { picks: C.pickForce(c.companies.A, 1, 1, null, { scenario: spec.scenario }), role: 'A' });
  cfg.mode = 'demo';
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return { e, s: e.state() };
}
function play(e, until) {
  for (let i = 0, stuck = 0; i < 30000 && !e.over() && !until(e.state()); i++) {
    const t = e.state();
    if (t.swapAsk) { e.intent(t.swapAsk.side, { k: 'swapdone' }); continue; }
    if (t.faceAsk) { e.intent(t.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (e.intent(t.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
    if (++stuck > 20) break;
  }
}
// how far a point is off the road's line, east to west, at its own x (Infinity off any road)
function offRoad(s, u) {
  let best = Infinity;
  s.terrain.forEach((t) => {
    if (t.kind !== 'road' || u.x < t.x || u.x > t.x + t.w) return;
    let ys = [];
    if (t.poly) {
      for (let i = 0; i < t.poly.length; i++) {
        const a = t.poly[i], b = t.poly[(i + 1) % t.poly.length];
        if ((a[0] <= u.x && b[0] >= u.x) || (b[0] <= u.x && a[0] >= u.x)) ys.push(a[0] === b[0] ? a[1] : a[1] + (b[1] - a[1]) * (u.x - a[0]) / (b[0] - a[0]));
      }
    } else if (t.w >= t.h) ys = [t.y, t.y + t.h];
    if (ys.length < 2) return;
    best = Math.min(best, Math.abs(u.y - (Math.min(...ys) + Math.max(...ys)) / 2));
  });
  return best;
}
const cars = (s) => s.units.filter((u) => u.convoyCar);

console.log('\nOn the road');
for (const [label, args] of [['Claim Jumpers (Kestrel’s cars, a winding road)', ['dead-reckoning', 'claim', 'claim.scoop', 'race']],
  ['The Haul Road (HTX’s haulers, a straight one)', ['deep-contract', 'convoy', 'convoy.battle']]]) {
  const { e, s } = battle(...args);
  play(e, (t) => cars(t).every((u) => u.x >= 0 || !u.alive));
  const on = cars(s).filter((u) => u.alive && u.x >= 0);
  ok(label + ': the cars come on at the road', on.length === cars(s).length && on.every((u) => offRoad(s, u) <= 4.5), on.map((u) => offRoad(s, u).toFixed(1)).join(' '));
  const seen = [];
  play(e, (t) => { cars(t).forEach((u) => { if (u.alive && u.x >= 0 && !u.extracted) seen.push(offRoad(t, u)); }); return t.turn > 4; });
  const mean = seen.reduce((a, b) => a + b, 0) / Math.max(1, seen.length);
  ok('...and keep to it on the way across', seen.length > 10 && mean < 4, 'mean ' + mean.toFixed(1) + '" off the road\'s line, over ' + seen.length + ' looks');
}

console.log('\nEvery car');
{
  const { s } = battle('deep-contract', 'convoy', 'convoy.battle');
  const cs = cars(s), check = (st) => SC.SCENARIOS.convoy.check(st);
  cs.forEach((u) => { u.x = 5; u.y = 24; u.reserve = false; });
  cs.slice(0, cs.length - 1).forEach((u) => { u.alive = false; });
  ok('all but one car burning: the convoy is not stopped', !check(s));
  ok('...and the cars are cargo, not in the escort’s rout tally', !SC.routed(s, 'A'));
  cs[cs.length - 1].alive = false;
  const r = check(s);
  ok('every car burning: the hunters have stopped it', r && r.winner === 'B' && /Every car/.test(r.text), r && r.text);
  cs[cs.length - 1].alive = false; cs[cs.length - 1].extracted = true;
  const r2 = check(s);
  ok('the rest burning, one through: the convoy got through', r2 && r2.winner === 'A', r2 && r2.text);
}

console.log('\nHunting a convoy: reinforcements');
{
  // Claim Jumpers: the company out to stop Kestrel's cars, half of it on the road in time
  const { e, s } = battle('dead-reckoning', 'claim', 'claim.scoop', 'race');
  const mine = s.units.filter((u) => u.side === 'A' && !u.convoyCar);
  const held = mine.filter((u) => u.wave === 2);
  ok('Intercept: half the hunters held back as reinforcements', s.cfg.scenario === 'intercept' && (held.length === Math.ceil(mine.length / 2) || held.length === Math.floor(mine.length / 2)), held.length + ' of ' + mine.length);
  ok('...and the convoy’s side comes on whole', s.units.filter((u) => u.side === 'B' && u.wave === 2).length === 0);
  ok('...the setup says so', /reinforcements: from turn 3/.test(SC.SCENARIOS.intercept.deployText(s, 'A')) && !/reinforcements/.test(SC.SCENARIOS.convoy.deployText(s, 'A')));
  play(e, (t) => t.turn >= 2);
  ok('...none of them on before turn 3', held.every((u) => u.reserve || !u.alive));
  play(e, (t) => t.turn >= 4);
  ok('...from turn 3 they come on, up to the Priority Level a time', e.over() || held.some((u) => !u.reserve && u.x >= 0), held.map((u) => (u.reserve ? 'r' : 'on')).join(' '));
}
{
  // escorting one: the hunters come on whole
  const { s } = battle('deep-contract', 'convoy', 'convoy.battle');
  ok('escorting a convoy: the hunters come on whole', s.units.filter((u) => u.wave === 2).length === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
