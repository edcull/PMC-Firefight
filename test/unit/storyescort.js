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
ok('Vesk’s market on the table: every barricade a stall and every crater field the market’s clutter, and the roads paved', cfg.story.skin === 'market' &&
  st.terrain.filter((t) => t.kind === 'barricade' || t.kind === 'crater').every((t) => t.market) && st.terrain.some((t) => t.kind === 'barricade') &&
  st.terrain.filter((t) => t.kind === 'road').every((t) => t.paved) && R.terrainName(st, 'barricade') === 'Market stalls');
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

console.log('\nLot 47 lost: Brass Ledger have the log');
{
  const lost = () => {
    const c = C.newCampaign({ mode: 'solo' });
    C.found(c.companies.A, FOUNDING, 'S2');
    S.begin(c, 'dead-reckoning', {});
    c.story.chapter = 'c1'; c.story.node = 'c1.battle';
    S.resolveBattle(c, 'defeat');
    for (let i = 0; i < 6 && S.view(c).type !== 'event'; i++) S.proceed(c);
    // (the agent first, then the log)
    if (S.view(c).id === 'c1.agent') S.choose(c, 'message');
    for (let i = 0; i < 6 && S.view(c).id !== 'c1.lost'; i++) S.proceed(c);
    return c;
  };
  let c = lost();
  ok('lost, the debrief says so: Brass Ledger have the log', /Brass Ledger have the log/.test(global.PMCStoryText['dead-reckoning']['c1.debrief']) && c.story.lastGrade === 'defeat');
  ok('...and what comes next is about the log: hit their ship, have Vane buy it back, or follow it', S.view(c).id === 'c1.lost' && ['raid', 'buy', 'follow'].every((o) => S.view(c).options.some((x) => x.id === o && x.ok)),
    S.view(c).id);
  S.choose(c, 'raid');
  ok('hitting their ship: a battle on Vesk’s landing field for the log, carried off or not', S.view(c).type === 'battle' && c.story.node === 'c1r.battle' && S.battleSpec(c).variant.relic && S.battleSpec(c).map === 'veskfield');
  S.resolveBattle(c, { winner: 'A', units: [], turns: 6, story: { relic: 'A' } });
  ok('...carried off: the log is the company’s again, and nothing follows from it', !c.story.flags.log_lost && !c.story.flags.ledger_has_log);
  c = lost(); S.choose(c, 'raid');
  S.resolveBattle(c, { winner: 'A', units: [], turns: 6, story: { relic: 'B' } });
  ok('...won, but the log still aboard when they lift: Brass Ledger keep it', c.story.flags.ledger_has_log === true && !c.story.flags.log_lost);
  c = lost(); const v0 = c.story.meters.vane;
  S.choose(c, 'buy');
  ok('Vane buying it back: it costs his Trust, and Brass Ledger are the stronger for it', !c.story.flags.ledger_has_log && c.story.meters.vane === v0 - 2);
  c = lost(); const t0 = c.story.meters.theirs;
  S.choose(c, 'follow');
  ok('following it: the rivals have its pages, and the company only the first eleven', c.story.flags.ledger_has_log === true && c.story.meters.theirs === t0 + 1 &&
    /without the log/.test(S.render(c, global.PMCStoryText['dead-reckoning']['c1.interlude'])));
  // ...or rebuilt on the way, from what the company finds: Wraith's copy on the flats, or Morrow's records at Thule
  const r1 = lost(); S.choose(r1, 'follow');
  r1.story.chapter = 'c2'; r1.story.node = 'c2f.drop';
  S.choose(r1, 'take');
  ok('...unless it is rebuilt on the way: Wraith Section’s stolen copy, with Halloran’s pages', !r1.story.flags.ledger_has_log &&
    r1.story.journal.some((j) => (j.effects || []).some((e) => /rebuilds the log from Wraith/.test(e.journal || ''))));
  const r2 = lost(); S.choose(r2, 'follow');
  r2.story.chapter = 'c2'; r2.story.node = 'c2t.records';
  S.choose(r2, 'listen');
  ok('...or Morrow’s own records at Station Thule', !r2.story.flags.ledger_has_log);
  // ...and at the Broker, the log is on the block beside the heading
  c.story.chapter = 'c4'; c.story.node = 'c4.lot'; c.companies.A.kUC = 10;
  ok('...until Kerrigan, where Lot 47 itself is back on the block', /Lot 47 itself/.test(S.render(c, global.PMCStoryText['dead-reckoning']['c4.lot'])));
  const t1 = c.story.meters.theirs;
  S.choose(c, 'buy');
  ok('...and whoever takes the heading there takes the log back with it', !c.story.flags.ledger_has_log && c.story.meters.theirs === t1 - 1);
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
