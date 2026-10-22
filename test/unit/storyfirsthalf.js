/* Deep Contract's first half, playable (docs/story-mode-plan.md, phase 4):
   every battle of chapters 1 to 4 and the two one-offs, under every choice
   that changes it, is set up and started in the engine (and none is played);
   and the first half is played through many times with made-up reports, the
   campaign's real aftermath taking each one, to see that the company stays
   able to fight and how it grows. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
const { makeReport } = require('../story-report.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
function campaign() {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  c.companies.A.name = 'Kessler Rifles';
  S.begin(c, 'deep-contract');
  return c;
}
/* The story put at an event, as if the chapters before it had been played. */
function at(c, node, flags, meters) {
  const d = S.get('deep-contract'), n = d._nodes[node];
  c.story.chapter = n._chapter; c.story.node = node;
  Object.assign(c.story.flags, flags || {});
  Object.assign(c.story.meters, meters || {});
  return c;
}
/* A battle set up and taken to turn 1, as a campaign battle starts. Nothing played. */
function started(cfg) {
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 6 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    if (s.placeQueue && s.placeQueue.length) e.intent(s.placeQueue[0].side, { k: 'autoplace' });
    // a scenario that splits the forces into waves (Find and secure, Invasion): the split, as the AI makes it
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}

console.log('\nEvery first-half battle, under every choice that changes it');
const PATHS = [
  ['c1.portmaster', 'take', {}, {}], ['c1.portmaster', 'send', {}, {}], ['c1.portmaster', 'ask', {}, {}],
  ['c2r.nightshift', 'free', {}, {}], ['c2r.nightshift', 'shield', {}, {}], ['c2r.nightshift', 'sabotage', {}, { intel: 6 }],
  ['c2d.truck', 'pay', {}, {}], ['c2d.truck', 'grab', {}, {}], ['c2d.truck', 'blind', {}, {}], ['c2d.truck', 'night', {}, {}],
  ['c3.killorcapture', 'gunship', { depot_raided: true }, {}], ['c3.killorcapture', 'snatch', {}, {}], ['c3.killorcapture', 'wait', { varga_dead: true }, {}],
  ['c4.school', 'clear', {}, {}], ['c4.school', 'shell', {}, {}], ['c4.school', 'talk', { nightshift_freed: true }, { sentiment: -9 }],
  ['sump.map', 'trust', {}, {}], ['sump.map', 'surveys', {}, {}], ['sump.map', 'blast', {}, {}],
  ['relief.handover', 'refuse', {}, {}], ['relief.handover', 'fire', { lantern_crossed: true }, {}]
];
const fair = [];
PATHS.forEach(([node, opt, flags, meters]) => {
  const c = at(campaign(), node, flags, meters);
  c.companies.A.kUC = 5;
  let why = '';
  try {
    S.choose(c, opt);
    const v = S.view(c);
    if (v.type !== 'battle') throw new Error('not at a battle: ' + v.id);
    const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: v.battle.scenario });
    const cfg = L.toCfg(c, { picks, role: 'A' });
    cfg.mode = 'ai';
    const e = started(cfg), s = e.state();
    const a = s.units.filter((u) => u.side === 'A').length, b = s.units.filter((u) => u.side === 'B').length;
    const pts = (side) => s.units.filter((u) => u.side === side && !u.ally).reduce((n, u) => n + (u.tier || 1), 0);
    fair.push(node + '/' + opt + ': ' + cfg.scenario + ', ' + pts('A') + ' v ' + pts('B') + ' points' + (s.units.some((u) => u.ally) ? ' (+ allies)' : ''));
    why = cfg.scenario + ', ' + s.phase + ', ' + a + ' v ' + b;
    ok(node + ' / ' + opt + ': set up and started', s.phase === 'battle' && s.turn === 1 && a > 0 && b > 0 && !s.over, why);
  } catch (err) {
    ok(node + ' / ' + opt + ': set up and started', false, err.message);
  }
});
console.log('\n  (how even each one is, for a new company: its points against the enemy’s)');
fair.forEach((f) => console.log('    ' + f));

console.log('\nEvery battle on its own ground, the same each time');
/* Each battle of the story, set up twice: its map laid as written (or its
   compound from its seed), its objectives where the map puts them, its name
   over the book's scenario. */
function ground(st) { return JSON.stringify(st.terrain.map((t) => [t.kind, +t.x.toFixed(2), +t.y.toFixed(2), +t.w.toFixed(2), +t.h.toFixed(2)])); }
const dc = S.get('deep-contract'), MAPS = global.PMCStoryMaps['deep-contract'];
dc.chapters.forEach((ch) => (ch.nodes || []).filter((n) => n.type === 'battle').forEach((n) => {
  const runs = [0, 1].map(() => {
    const c = campaign();
    c.story.chapter = ch.id; c.story.node = n.id;
    const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: n.scenario });
    const cfg = L.toCfg(c, { picks, role: 'A' });
    cfg.mode = 'ai';
    return { cfg, st: started(cfg).state() };
  });
  const [a, b] = runs, map = n.map && MAPS[n.map];
  const same = ground(a.st) === ground(b.st);
  const named = a.st.scen.name === n.name && a.st.scen.bookName === (SC.SCENARIOS[n.scenario] || {}).name;
  let laid = true, note = '';
  if (map && !SC.SCENARIOS[n.scenario].compound) {
    // every piece of the map is on the table (a scenario's own pieces besides)
    laid = map.pieces.every((p) => a.st.terrain.some((t) => t.kind === p.kind && Math.abs(t.x - p.x) < 0.01 && Math.abs(t.y - p.y) < 0.01));
    const objs = map.objectives && map.objectives.length === a.st.objectives.length;
    if (objs) laid = laid && map.objectives.every((o, i) => Math.abs(a.st.objectives[i].x - o.x) < 0.01 && Math.abs(a.st.objectives[i].y - o.y) < 0.01);
    note = map.name + (objs ? ', its objectives' : '');
  } else note = 'a compound from its seed';
  ok(n.id + ' \u2014 ' + n.name + ': ' + note, same && named && laid, (same ? '' : 'not the same twice; ') + (named ? '' : 'named ' + a.st.scen.name + '; ') + (laid ? '' : 'the map not laid as written'));
}));

console.log('\nThe first half, played through with made-up results');
const N = 40, tally = { done: 0, broken: 0, sump: 0, relief: 0, tierAt4: {}, kUC: [], battles: [], units: [] };
for (let w = 0; w < N; w++) {
  const c = campaign();
  let battles = 0, guard = 0;
  while (guard++ < 300) {
    const v = S.view(c);
    if (!v || c.story.ended) break;
    const ch = S.get('deep-contract')._chapters[c.story.chapter];
    if (ch && ch.half === 2) break;                      // the second half: done
    if (v.type === 'event' || v.type === 'pool') {
      const open = v.options.filter((o) => o.ok);
      if (!open.length) { ok('an event left with nothing open: ' + v.id, false); break; }
      S.choose(c, open[Math.floor(Math.random() * open.length)].id);
    } else if (v.type === 'battle') {
      const co = c.companies.A;
      const tier = L.tierFor(co, { tier: v.battle.tier }), pl = L.plFor(co, tier, v.battle.pl);
      const picks = C.pickForce(co, tier, pl, null, { scenario: v.battle.scenario });
      const cfg = L.toCfg(c, { picks, role: 'A', tier, pl });
      const grade = Math.random() < 0.6 ? (Math.random() < 0.3 ? 'decisive' : 'victory') : ['draw', 'defeat', 'defeat', 'rout'][Math.floor(Math.random() * 4)];
      const report = makeReport(picks, cfg.armyB, grade, cfg);
      S.resolveBattle(c, report);
      C.aftermath(c, report, {});
      battles++;
    } else if (v.type === 'interlude') {
      // the company spends as a sensible player would, between chapters
      C.developRival(c.companies.A);
      if (S.broken(c)) { S.breakCompany(c); break; }
      S.proceed(c);
    } else S.proceed(c);
  }
  const co = c.companies.A;
  if (c.story.ended === 'broken') tally.broken++;
  else tally.done++;
  if (c.story.played.sump) tally.sump++;
  if (c.story.played.relief) tally.relief++;
  tally.tierAt4[co.tier] = (tally.tierAt4[co.tier] || 0) + 1;
  tally.kUC.push(co.kUC); tally.battles.push(battles); tally.units.push(co.roster.length);
}
const avg = (xs) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
ok('every walk reaches the second half, or ends on Broken Company', tally.done + tally.broken === N);
ok('...and the company stays able to fight in nearly all of them', tally.broken <= N * 0.1, tally.broken + ' of ' + N + ' broken');
ok('a first half is four or five battles', Math.min(...tally.battles) >= 3 && Math.max(...tally.battles) <= 5, avg(tally.battles) + ' on average');
console.log('  (Company Tier at the end of the first half: ' + JSON.stringify(tally.tierAt4) + '; kUC in the bank ' + avg(tally.kUC) +
  '; units ' + avg(tally.units) + '; the Sump ' + tally.sump + ', the Relief ' + tally.relief + ' of ' + N + ')');

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
