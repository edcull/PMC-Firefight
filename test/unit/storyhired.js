/* Hired guns answering back (Dead Reckoning, phase 5d; docs/story-dead-reckoning-plan.md,
   Hired guns): a rival hired to fight beside the company takes orders as
   allies do, but with its Trust low an order is answered with a demand. At −1
   or −2 that is on a D6 of 1 to 3, rolled once a turn; at −3 or lower always.
   The order stands only if paid on the spot, 1 kUC, billed after the battle.
   With Trust −2 or lower from the start, or half its units lost, it walks off
   the table at the next End phase, out of the company's tally. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/dead-reckoning.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
// The Broker, with Brass Ledger hired for the takeover, at a Trust
function hiredAt(trust) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'dead-reckoning', {});
  c.companies.A.kUC = 20;
  c.story.flags.kettle_contact = true;
  c.story.chapter = 'c4'; c.story.node = 'c4.lot';
  S.choose(c, 'hire_kettle');
  c.story.meters.kettle_trust = trust;
  const cfg = L.toCfg(c, { picks: C.pickForce(c.companies.A, 1, 1, null, { scenario: 'takeover' }), role: 'A' });
  cfg.mode = 'ai';
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return { c, cfg, e, s: e.state() };
}
const order = { k: 'allyorder', kind: 'attack', x: 30, y: 24 };

console.log('\nThe hire');
{
  const { cfg, s } = hiredAt(0);
  ok('Brass Ledger fight beside the company at the Broker, their Trust carried into the battle', cfg.story.hired && cfg.story.hired.side === 'kettle' && cfg.story.hired.trust === 0 && cfg.story.hired.name === 'Brass Ledger' &&
    s.units.some((u) => u.ally && u.alive), JSON.stringify(cfg.story.hired));
  ok('...and they have words for asking to be paid, and for walking', cfg.story.allyVoice.demand.length && cfg.story.allyVoice.walk.length);
}

console.log('\nOrders');
{
  const { e, s } = hiredAt(0);
  e.intent('A', order);
  ok('Trust 0: an order is taken, unpaid', s.allyOrder && s.allyOrder.kind === 'attack' && !s.allyDemand && !(s.storyOutcome || {}).allyPaid);
}
{
  const { e, s } = hiredAt(-3);
  e.intent('A', order);
  ok('Trust −3: the order is answered with a demand, and does not stand', !s.allyOrder && s.allyDemand && s.allyDemand.kUC === 1 && s.allyDemand.kind === 'attack');
  e.intent('A', Object.assign({ pay: true }, order));
  ok('...paid on the spot, it stands, and the bill is kept for after the battle', s.allyOrder && s.allyOrder.kind === 'attack' && !s.allyDemand && s.storyOutcome.allyPaid === 1);
  e.intent('A', { k: 'allyorder', kind: null });
  e.intent('A', order);
  ok('...and asked again, it is extra again', !s.allyOrder && s.allyDemand);
  e.intent('A', { k: 'allyorder', kind: null });
  ok('...or the demand turned down: no order, no bill', !s.allyOrder && !s.allyDemand && s.storyOutcome.allyPaid === 1);
}
{
  let refused = 0, n = 0;
  for (let i = 0; i < 24; i++) {
    const { e, s } = hiredAt(-1);
    e.intent('A', order);
    n++; if (s.allyDemand) refused++;
    e.intent('A', { k: 'allyorder', kind: null }); e.intent('A', order);
    if (!!s.allyDemand !== (refused > 0 && !!s.hiredRoll.refused)) n = -1000;
  }
  ok('Trust −1: refused on a D6 of 1 to 3, about half the time, the same answer all turn', refused > 4 && refused < 20 && n > 0, refused + ' of 24');
}

console.log('\nWalking');
{
  const { s } = hiredAt(-2);
  const K = global.PMCEngineStory({ R, SC, get state() { return s; }, logLine() {}, pushRes() {}, makeUnit: null });
  const before = s.units.filter((u) => u.ally && u.alive).length;
  K.storyEndPhase();
  const walked = s.units.filter((u) => u.ally && u.walked);
  ok('Trust −2 from the start: at the first End phase they walk off the table', before > 0 && walked.length === before && walked.every((u) => !u.alive && u.superseded && !u.extracted), walked.length + ' of ' + before);
  ok('...the report says so', s.storyOutcome.allyWalked === true);
  ok('...and it is no rout of the company’s, nor anyone got away', !SC.SCENARIOS.takeover.check(s) || !/routs/.test((SC.SCENARIOS.takeover.check(s) || {}).text || ''));
}
{
  const { s } = hiredAt(0);
  const K = global.PMCEngineStory({ R, SC, get state() { return s; }, logLine() {}, pushRes() {}, makeUnit: null });
  K.storyEndPhase();
  ok('Trust 0, nobody lost: they stay', s.units.filter((u) => u.ally).every((u) => u.alive && !u.walked));
  const mine = s.units.filter((u) => u.ally);
  mine.slice(0, Math.ceil(mine.length / 2)).forEach((u) => { u.alive = false; });
  K.storyEndPhase();
  ok('...half of them lost: the rest walk', mine.filter((u) => u.alive).length === 0 && mine.some((u) => u.walked));
}

console.log('\nThe bill');
{
  // the same battle, the same result, resolved twice: once with 2 kUC paid on the spot
  const res = (paid) => ({ winner: 'A', units: [], turns: 5, story: paid ? { allyPaid: paid } : {} });
  const a = hiredAt(-3).c, b = hiredAt(-3).c;
  a.companies.A.kUC = b.companies.A.kUC = 20;
  S.resolveBattle(a, res(0)); S.resolveBattle(b, res(2));
  ok('what was paid on the spot comes out of the company’s money after the battle', a.companies.A.kUC - b.companies.A.kUC === 2, a.companies.A.kUC + ' / ' + b.companies.A.kUC);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
