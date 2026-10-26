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
ok('...he is on the table with side A, an ally, not the player’s to move: named, a Command Unit’s statline, no special rules', vane && vane.side === 'A' && vane.name === 'Halloran' && vane.ally && st.allies && st.allies.side === 'A' &&
  vane.rules.length === 0 && vane.models >= 1, vane && JSON.stringify({ name: vane.name, side: vane.side, models: vane.models, rules: vane.rules }));
ok('...and he comes on in turn 1 with the rest of side A', vane.x >= 0 && !vane.reserve, vane.x + ',' + vane.y);
ok('Vesk’s market on the table: every barricade a railing and every crater field the market’s clutter, and the roads paved', cfg.story.skin === 'market' &&
  st.terrain.filter((t) => t.kind === 'barricade' || t.kind === 'crater').every((t) => t.market) && st.terrain.some((t) => t.kind === 'barricade') &&
  st.terrain.filter((t) => t.kind === 'road').every((t) => t.paved) && R.terrainName(st, 'barricade') === 'Railings and planters');
ok('the bidding’s first answer no longer asks the company for money it has not got', !dr._nodes['c1.bidding'].options[0].cost);
{
  // the bidding sets the crossing: walked into an ambush, an ambush seen laid, or Brass Ledger hit first
  const chosen = (opt) => {
    const c = C.newCampaign({ mode: 'solo' });
    C.found(c.companies.A, FOUNDING, 'S2');
    S.begin(c, 'dead-reckoning', {});
    c.story.chapter = 'c1'; c.story.node = 'c1.bidding';
    S.choose(c, opt);
    const cf = L.toCfg(c, { picks: C.pickForce(c.companies.A, 1, 1, null, { scenario: 'escort' }), role: 'A' });
    return { c, cf, text: S.render(c, cf.story.blurb || '') };
  };
  const a = chosen('outbid'), b = chosen('watch'), f = chosen('follow');
  ok('standing with Halloran: an Escort still, walked into Brass Ledger’s ambush', a.c.story.node === 'c1.battle' && a.cf.scenario === 'escort' && a.cf.story.ambush === 'B' && !a.cf.story.ambushExpected && !a.cf.story.strikes &&
    /Ambush!/.test(a.text) && !/knows where it is/.test(a.text), JSON.stringify({ am: a.cf.story.ambush, ex: a.cf.story.ambushExpected }));
  ok('...watching the room: the same ambush, seen laid (nobody pinned, the first turn rolled for), and their force seen', b.cf.story.ambush === 'B' && b.cf.story.ambushExpected === true &&
    JSON.stringify(b.cf.story.intel) !== JSON.stringify(a.cf.story.intel) && /knows where it is/.test(b.text) && !/Ambush!/.test(b.text));
  ok('...marking Kettering’s men: no ambush, the company strikes first as they come on', !f.cf.story.ambush && f.cf.story.strikes === 'D3' && /opens fire/.test(f.text));
  // and the ambushed crossing starts: Halloran with the company on its edge, Brass Ledger lying in wait
  const e = Engine.create(); const cf = Object.assign({}, a.cf, { mode: 'ai' }); e.start(cf);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s2 = e.state();
    if (s2.swapAsk) e.intent(s2.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('A', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  const s3 = e.state(), h = s3.units.find((u) => u.escort);
  ok('...and the ambushed crossing begins: Halloran on the company’s edge, Brass Ledger lying in wait', s3.phase === 'battle' && h && h.x >= 0 && h.x <= 6.5 && s3.log.some((l) => /lying in wait/.test(l.text || '')), h && h.x);
}
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
  ok('brought down: hit, not killed, and B has the log', r && r.winner === 'B' && s.storyOutcome.escort === 'down' && /hit and down/.test(r.text), r && r.text);
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
  ok('...and what comes next is about the log, and not about money: hit their ship, cut Kettering in on the claim, or follow it', S.view(c).id === 'c1.lost' &&
    ['raid', 'cutin', 'follow'].every((o) => S.view(c).options.some((x) => x.id === o && x.ok)) && S.view(c).options.length === 3,
    S.view(c).id);
  S.choose(c, 'raid');
  ok('hitting their ship: a battle on Vesk’s landing field for the log, carried off or not', S.view(c).type === 'battle' && c.story.node === 'c1r.battle' && S.battleSpec(c).variant.relic && S.battleSpec(c).map === 'veskfield');
  S.resolveBattle(c, { winner: 'A', units: [], turns: 6, story: { relic: 'A' } });
  ok('...carried off: the log is the company’s again, and nothing follows from it', !c.story.flags.log_lost && !c.story.flags.ledger_has_log);
  c = lost(); S.choose(c, 'raid');
  S.resolveBattle(c, { winner: 'A', units: [], turns: 6, story: { relic: 'B' } });
  ok('...won, but the log still aboard when they lift: Brass Ledger keep it', c.story.flags.ledger_has_log === true && !c.story.flags.log_lost);
  c = lost();
  S.choose(c, 'cutin');
  ok('cutting Kettering in on the claim: the log back now, paid for at the end of the road (Brass Ledger are partners)', !c.story.flags.ledger_has_log && !c.story.flags.log_lost &&
    c.story.flags.kettle_partner === true && c.companies.A.kUC === 0);
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
  // ...a second chance at the beacon: Kettering has brought it to sell to the Reavers
  const at3 = () => { const x = lost(); S.choose(x, 'follow'); x.story.chapter = 'c3'; x.story.node = 'c3.brief'; S.proceed(x); return x; };
  let s3 = at3();
  ok('at the beacon, a second chance: the private sale, Brass Ledger selling the log to the Reavers', S.view(s3).id === 'c3.sale' && ['raid', 'wait'].every((o) => S.view(s3).options.some((x) => x.id === o)) && S.view(s3).options.length === 2, S.view(s3).id);
  S.choose(s3, 'raid');
  ok('...broken up: a battle on the mud bank for the case', S.view(s3).type === 'battle' && s3.story.node === 'c3s.battle' && S.battleSpec(s3).variant.relic && S.battleSpec(s3).map === 'mudbank');
  S.resolveBattle(s3, { winner: 'A', units: [], turns: 6, story: { relic: 'A' } });
  ok('...the case carried off: the log is back, and the beacon is next', !s3.story.flags.ledger_has_log && S.view(s3).id !== 'c3s.battle');
  s3 = at3(); S.choose(s3, 'wait');
  ok('...or let go: the sale goes through, and Kerrigan is the next chance', s3.story.flags.ledger_has_log === true && s3.story.node === 'c3.contact');
  const nw = lost(); S.choose(nw, 'follow');
  ok('...and a company that never had the log back has it rebuilt as the second half begins, from the stones', (() => {
    nw.story.chapter = 'c4'; nw.story.node = 'c4.interlude';
    for (let i = 0; i < 12 && nw.story.chapter !== 'fault'; i++) { const v = S.view(nw); if (v.type === 'event') S.choose(nw, v.options.filter((o) => o.ok)[0].id); else S.proceed(nw); }
    return nw.story.chapter === 'fault' && !nw.story.flags.ledger_has_log && nw.story.journal.some((j) => (j.effects || []).some((e) => /lodestones themselves/.test(e.journal || '')));
  })(), nw.story.chapter);
  // ...and at the Broker, the log is on the block beside the heading
  c.story.chapter = 'c4'; c.story.node = 'c4.lot'; c.companies.A.kUC = 10;
  ok('...until Kerrigan, where Lot 47 itself is back on the block', /Lot 47 itself/.test(S.render(c, global.PMCStoryText['dead-reckoning']['c4.lot'])));
  const t1 = c.story.meters.theirs;
  const k = JSON.parse(JSON.stringify(c));
  S.choose(k, 'buy');
  ok('...not for any money: buying the heading there leaves the log with them', k.story.flags.ledger_has_log === true);
  S.choose(c, 'take');
  S.resolveBattle(c, 'victory');
  ok('...only the warehouse taken by force brings it back with the heading', !c.story.flags.ledger_has_log && c.story.meters.theirs === t1 - 1);
}

console.log('\nHalloran, an ally');
{
  // the player's own units spent, side A to act: what is left is Halloran's, and the AI runs him
  const fresh = () => {
    const r = started('ai'), t = r.st;
    t.activeSide = 'A';
    t.units.forEach((u) => { if (u.side === 'A') { u.activated = !u.ally; u.reserve = false; u.aboard = false; } });
    return Object.assign(r, { h: t.units.find((u) => u.escort) });
  };
  let { e, st: s, h } = fresh();
  ok('the player cannot pick him: his activations are his own', !e.intent('A', { k: 'select', id: h.id }).ok || (e.sel && e.sel() && e.sel().id) !== h.id);
  const x0 = h.x;
  for (let i = 0; i < 20 && !h.activated; i++) e.sim.steps(1);
  ok('...left alone, he makes his own way towards the far edge', h.activated && h.x > x0 + 1, 'x ' + x0.toFixed(1) + ' \u2192 ' + h.x.toFixed(1));
  ({ e, st: s, h } = fresh());
  const to = { x: h.x, y: h.y < 24 ? h.y + 10 : h.y - 10 };
  e.intent('A', { k: 'allyorder', kind: 'move', x: to.x, y: to.y });
  const d0 = R.inches(h.x, h.y, to.x, to.y);
  for (let i = 0; i < 20 && !h.activated; i++) e.sim.steps(1);
  ok('...and goes where the company tells him: Move here', s.allyOrder && R.inches(h.x, h.y, to.x, to.y) < d0 - 1, d0.toFixed(1) + ' \u2192 ' + R.inches(h.x, h.y, to.x, to.y).toFixed(1));
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
