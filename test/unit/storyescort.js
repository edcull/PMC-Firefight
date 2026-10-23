/* The Escort (src/story/scenarios-story.js): someone who matters crosses the
   table with side A, and the other side wants them. Dead Reckoning's Lot 47 is
   one: Halloran, Lucan Vane's reader, with the log, across Vesk's market
   square to Vane's ship.
   She comes on as a unit of side A's own to move, a Command Unit's statline of
   the Tier and no special rules; through to the far edge she is out and A has
   won; killed, B has; the enemy goes for her and nothing else. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
const dr = require('../../src/story/dead-reckoning.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
function cfgOf(mode) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'dead-reckoning', {});
  c.story.chapter = 'c1'; c.story.node = 'c1.battle';
  const cfg = L.toCfg(c, { picks: C.pickForce(c.companies.A, 1, 1, null, { scenario: 'escort' }), role: 'A' });
  cfg.mode = mode || 'ai';
  return { c, cfg };
}
function started(mode) {
  const { c, cfg } = cfgOf(mode);
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return { c, cfg, e, st: e.state() };
}

console.log('\nLot 47: an Escort');
const { cfg, st } = started();
ok('Lot 47 is fought as an Escort, Halloran the one to be got across', cfg.scenario === 'escort' && cfg.story.variant.escort === 'Halloran' && /across/.test(SC.SCENARIOS.escort.win + ' ' + dr._nodes['c1.battle'].text));
const vane = st.units.find((u) => u.escort);
ok('...he is on the table with side A, its own to move: named, a Command Unit’s statline, no special rules', vane && vane.side === 'A' && vane.name === 'Halloran' && !vane.ally &&
  vane.rules.length === 0 && vane.models >= 1, vane && JSON.stringify({ name: vane.name, side: vane.side, models: vane.models, rules: vane.rules }));
ok('...and he comes on in turn 1 with the rest of side A', vane.x >= 0 && !vane.reserve, vane.x + ',' + vane.y);
ok('the bidding’s first answer no longer asks the company for money it has not got', !dr._nodes['c1.bidding'].options[0].cost);
{
  const s = st, g = SC.SCENARIOS.escort.goals;
  const b = s.units.find((u) => u.side === 'B' && u.alive);
  ok('the enemy goes for her and nothing else; side A’s own for the far edge', g(s, b).length === 1 && g(s, b)[0] === vane && g(s, s.units.find((u) => u.side === 'A' && !u.escort)).every((p) => p.x > R.BOARD.w - 3));
}

console.log('\nThrough, or not');
{
  const { st: s } = started();
  const K = global.PMCEngineStory({ R, SC, get state() { return s; }, logLine() {}, pushRes() {}, makeUnit: null });
  const v = s.units.find((u) => u.escort);
  v.x = R.BOARD.w - 1.5;
  s.turn = 3;
  K.storyEndPhase();
  const r = SC.SCENARIOS.escort.check(s);
  ok('within 3" of the far edge at an End phase she is through, and A has won', v.extracted && r && r.winner === 'A', r && r.text);
}
{
  const { st: s } = started();
  s.units.find((u) => u.escort).alive = false;
  const r = SC.SCENARIOS.escort.check(s);
  ok('killed: B has the log', r && r.winner === 'B' && s.storyOutcome.escort === 'killed', r && r.text);
}
{
  const { st: s } = started();
  s.turn = 10;
  const r = SC.SCENARIOS.escort.check(s);
  ok('still on the table at the end of turn 10: B has won', r && r.winner === 'B' && r.timeout);
}
{
  const { st: s } = started();
  s.units.filter((u) => u.side === 'B').forEach((u) => { u.alive = false; });
  const r = SC.SCENARIOS.escort.check(s);
  ok('the enemy routed: A has won, and she walks on', r && r.winner === 'A' && /routs/.test(r.text));
}
{
  // a scenario that is no story's brings no one: the Escort's unit is only the story scenario's
  const e = Engine.create();
  e.start({ tier: 1, pl: 1, scenario: 'meeting', armyA: ['cmd2', 'regular'], armyB: ['cmd2', 'regular'], mode: 'ai' });
  ok('...and a battle that is not an Escort has no one to escort', !e.state().units.some((u) => u.escort));
}

console.log('\nOne battle, AI against AI');
{
  const { e, st: s } = started('demo');
  for (let i = 0, stuck = 0; i < 30000 && !e.over(); i++) {
    const t = e.state();
    if (t.swapAsk) { e.intent(t.swapAsk.side, { k: 'swapdone' }); continue; }
    if (t.faceAsk) { e.intent(t.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (e.intent(t.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
    if (++stuck > 20) break;
  }
  const v = s.units.find((u) => u.escort);
  ok('it plays to an end', !!e.over(), (s.over && s.over.text) + ' (turn ' + s.turn + ')');
  ok('...and Vane got through, or did not, or somebody broke', !!s.over && (v.extracted || !v.alive || /routs|surrender|still on the table/.test(s.over.text || '')), JSON.stringify({ out: v.extracted, alive: v.alive, x: Math.round(v.x) }));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
