/* The Hunt (Deep Contract, chapter 3): Find and secure on the pumping station,
   whose three possible locations are the station's pump houses, where its map
   puts them. Each is a shed that blocks line of sight and that nobody crosses,
   searched and held from within 4" of its walls; the AI walks to them and
   searches them like any other; and what is said follows the search: a pump
   house drawn blank, and the one Varga is in, called by the company's net and
   answered by her own people. Every other Find and secure is as it was. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
function hunt(flags) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'deep-contract');
  c.story.chapter = 'c3'; c.story.node = 'c3.battle';
  Object.assign(c.story.flags, flags || {});
  return c;
}
function started(cfg) {
  const e = Engine.create();
  cfg.mode = 'ai';
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
const c = hunt();
const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: 'find' });
const cfg = L.toCfg(c, { picks, role: 'A' });

console.log('\nThe pump houses');
ok('the map hands its sites to the battle: three pump houses, named', cfg.story.sites && cfg.story.sites.kind === 'pumphouse' &&
  cfg.story.sites.at.length === 3 && cfg.story.sites.at.every((s) => /pump house/.test(s.name)));
const e = started(cfg), st = e.state();
const houses = st.terrain.filter((t) => t.kind === 'pumphouse');
ok('they stand on the table as the three possible locations, and nothing else is one', houses.length === 3 && !st.terrain.some((t) => t.kind === 'searchsite') &&
  st.sc.search.length === 3 && st.sc.search.every((s) => houses.indexOf(s.piece) >= 0));
ok('...where the map says, stretched onto the table', houses.every((h, i) => Math.abs(h.x + 2 - cfg.story.sites.at[i].x) < 0.01 && Math.abs(h.y + 2 - cfg.story.sites.at[i].y) < 0.01));
ok('...12" or more apart, as the book has its locations', houses.every((h, i) => houses.every((k, j) => i === j || Math.hypot(h.x - k.x, h.y - k.y) >= 12)));
ok('...and no other piece is laid over them', houses.every((h) => !st.terrain.some((t) => t !== h && t.kind !== 'hill' &&
  t.x < h.x + h.w && h.x < t.x + t.w && t.y < h.y + h.h && h.y < t.y + t.h)));
ok('a pump house blocks line of sight, and is impassable', R.TERRAIN.pumphouse.blocks && R.TERRAIN.pumphouse.impassable && !R.TERRAIN.pumphouse.destructible);
{
  const h = houses[0], a = { x: h.x - 3, y: h.y + h.h / 2, side: 'A' }, b = { x: h.x + h.w + 3, y: h.y + h.h / 2, side: 'B' };
  const u = st.units.find((x) => x.side === 'A' && x.alive), v = st.units.find((x) => x.side === 'B' && x.alive);
  const ux = u.x, uy = u.y, vx = v.x, vy = v.y;
  u.x = a.x; u.y = a.y; v.x = b.x; v.y = b.y;
  ok('...two units either side of one cannot see each other', !R.hasLoS(st, u, v));
  v.x = a.x; v.y = a.y - 3;
  ok('...and can, with nothing between them', R.hasLoS(st, u, v));
  u.x = h.x - 3.5; u.y = h.y + h.h / 2;
  ok('searched from within 4" of its wall', SC.searchSpots(st, u).some((s) => s.piece === h));
  u.x = h.x - 4 - R.UNIT_R - 1;
  ok('...and not from further off', !SC.searchSpots(st, u).some((s) => s.piece === h));
  u.x = ux; u.y = uy; v.x = vx; v.y = vy;
}

console.log('\nThe search, and what is said');
const said = (s) => (s.talkSaid || {});
{
  const e2 = started(L.toCfg(hunt(), { picks, role: 'A' })), s2 = e2.state();
  const talk = s2.cfg.story.talk;
  ok('the battle has its lines for the search: a pump house drawn blank, Varga found, and her people’s answer',
    ['searched', 'found', 'guard'].every((m) => talk.some((l) => l.on === m)) &&
    /Target located/.test(talk.find((l) => l.on === 'found').text) && /Protect Varga/.test(talk.find((l) => l.on === 'guard').text));
  ok('...nothing said of the search before anyone has searched', !['searched', 'found', 'guard'].some((m) => said(s2)[m] != null));
  const u = s2.units.find((x) => x.side === 'A' && x.alive && x.x >= 0 && !R.isMachine(x));
  const spot = s2.sc.search[0], h = spot.piece;
  u.x = h.x - 1.5; u.y = h.y + h.h / 2;
  // the first search, made to come up empty
  const d6 = R.d6; R.d6 = () => 1;
  SC.checkArea(s2, u, spot);
  R.d6 = d6;
  const k = global.PMCEngineStory;
  ok('a pump house searched and empty', spot.checked && !s2.sc.found);
  const net = [];
  const tk = k({ R, state: s2, logLine() {}, pushRes(r) { net.push(r); }, SC });
  const before = Object.assign({}, said(s2));
  if (tk.storyTalk) tk.storyTalk();
  ok('...and the company’s net says so', net.some((r) => r.talk && r.talk.who === 'ops') && said(s2).searched != null && said(s2).found == null, JSON.stringify(Object.keys(said(s2))) + ' ' + JSON.stringify(Object.keys(before)));
  const spot2 = s2.sc.search[1], h2 = spot2.piece;
  u.x = h2.x - 1.5; u.y = h2.y + h2.h / 2;
  R.d6 = () => 6;
  SC.checkArea(s2, u, spot2);
  R.d6 = d6;
  ok('the next one is where she is', s2.sc.found === spot2 && h2.found);
  net.length = 0;
  tk.storyTalk();
  const ord = net.filter((r) => r.talk).map((r) => r.talk.who);
  ok('...“Target located!” over the net, then “Protect Varga!” from her people', ord.join() === 'ops,fighter' &&
    /Target located/.test(net[0].note) && /Protect Varga/.test(net[1].note), ord.join());
  ok('...and the pump house is the objective: held from within 4" of its walls', s2.objectives.length === 1 && s2.objectives[0].rect &&
    s2.objectives[0].rect.x === h2.x && s2.objectives[0].rect.w === h2.w);
  s2.units.filter((x) => x.side === 'B').forEach((x) => { x.x = -50; x.y = -50; });
  u.x = h2.x - 3.5; u.y = h2.y + h2.h / 2;
  ok('...by a unit standing at its wall', SC.holderOf(s2, s2.objectives[0].x, s2.objectives[0].y, 4, SC.areaOf(s2.objectives[0])) === 'A');
}
{
  const e3 = started(L.toCfg(hunt({ aim_capture: 'local' }), { picks, role: 'A' }));
  ok('sent to take her alive, the net says so when she is found', /breathing/.test(e3.state().cfg.story.talk.find((l) => l.on === 'found').text));
}

console.log('\nThe AI searches them');
{
  const e4 = started(L.toCfg(hunt(), { picks, role: 'A' })), s4 = e4.state();
  // one squad of side A, alone on the table, 12" short of the nearest pump house
  const sq = s4.units.find((x) => x.side === 'A' && x.alive && x.cls === 'infantry' && !R.has(x, 'Command'));
  s4.units.forEach((x) => { if (x !== sq) x.alive = false; });
  const h = s4.sc.search[0].piece;
  Object.assign(sq, { x: h.x - 12, y: h.y + h.h / 2, sp: 0, activated: false, bld: null, aboard: null, reserve: false });
  let acts = 0;
  for (; acts < 6 && !s4.sc.search.some((sp) => sp.checked); acts++) {
    sq.activated = false; s4.activeSide = 'A'; s4.over = { winner: null, text: 'test' };
    e4.query.aiAct(sq);
  }
  ok('the AI walks to one, round its walls, and searches it', s4.sc.search.some((sp) => sp.checked), acts + ' activations; at ' + sq.x.toFixed(1) + ',' + sq.y.toFixed(1));
  ok('...never standing inside one', !s4.terrain.some((t) => t.kind === 'pumphouse' && sq.x > t.x && sq.x < t.x + t.w && sq.y > t.y && sq.y < t.y + t.h));
}

console.log('\nEvery other Find and secure');
{
  const e5 = Engine.create();
  e5.start({ tier: 1, pl: 1, scenario: 'find', armyA: ['recruits', 'enforcers'], armyB: ['recruits', 'enforcers'], mode: 'ai' });
  const s5 = e5.state();
  ok('its locations are as the book has them: passable, seen through, placed by the roll', s5.terrain.filter((t) => t.kind === 'searchsite').length === 3 &&
    !s5.terrain.some((t) => t.kind === 'pumphouse'));
}
{
  // (the Guild's Pithead, a side job, is fought there as Secure and control)
  const s6 = started(Object.assign(L.toCfg(hunt(), { picks, role: 'A' }), { scenario: 'secure' })).state();
  ok('the pumping station fought over as anything else has no pump houses on it', !s6.terrain.some((t) => t.kind === 'pumphouse') && s6.objectives.length > 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
