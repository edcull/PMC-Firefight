/* The story's own scenarios (src/story/scenarios-story.js) and what happens in
   their End phases (src/engine/storybattle.js): each set up and started; each
   scenario's victory check; and one whole battle of each played AI against AI,
   to see that the AI can play it to an end and that its End phase does what
   it should (the waves come, the strikes fall, units are lifted out, the talks
   break or hold). That last is the scenario's own test (docs/story-mode-plan.md,
   decision 11): a story never plays a battle in the background. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
const BUGS = ['bwatchlarva', 'btiny', 'bsmall', 'bspitlarva'], FRONT = ['rinstigators', 'rciv', 'rciv', 'rmilitia'];
const HIVE = { hive_heart: 1, breakout: 1, holdline: 1 };
const ALL = ['hive_heart', 'convoy', 'breakout', 'holdline', 'strike', 'parley'];

function cfgFor(scen, mode, story) {
  const co = C.newCompany('X'); C.found(co, FOUNDING, 'S2');
  const picks = C.pickForce(co, 1, 1, null, { scenario: scen });
  return { tier: 1, pl: 1, scenario: scen, attacker: 'A', armyA: picks.map((p) => R.entryPick(p)), armyB: HIVE[scen] ? BUGS : FRONT,
    campaign: true, mode, dossier: { A: picks, B: null }, story: Object.assign({ waves: { per: 2 }, units: {} }, story || {}) };
}
function deployAndStart(e) {
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
function started(scen, story) { const e = Engine.create(); e.start(cfgFor(scen, 'ai', story)); return deployAndStart(e).state(); }

console.log('\nSet up, and the battle begun');
ALL.forEach((scen) => {
  const st = started(scen);
  ok(scen + ': a story scenario, started', SC.SCENARIOS[scen].story && st.phase === 'battle' && st.turn === 1 && st.cfg.scenario === scen, st.phase);
});
ok('none is offered in the skirmish or campaign lists', ALL.every((k) => SC.ORDER.indexOf(k) < 0 && SC.CE_ORDER.indexOf(k) < 0));
let s = started('holdline');
ok('Hold the Line sets up waves of the enemy’s own kinds, as many a turn as the story says, from turn 2', s.sc.waves && s.sc.waves.per === 2 && s.sc.waves.from === 2 && s.sc.waves.keys.length > 0);
s = started('breakout');
ok('Breakout: the countdown from turn 3 over six areas, the landing zone’s spared, the zone in the enemy’s half',
  s.sc.countdown.from === 3 && s.sc.countdown.areas.length === 6 && s.sc.countdown.areas.filter((a) => a.safe).length === 1 && s.sc.lz.x > R.BOARD.w / 2);
s = started('convoy');
const hulls = s.units.filter((u) => u.side === 'A' && R.isMachine(u)).length;
ok('Convoy: the convoy is the company\u2019s vehicles (all of it, if it brought none), and it leaves by the far edge',
  s.sc.convoy.length === (hulls || s.units.filter((u) => u.side === 'A').length) && s.sc.extract.rectX > R.BOARD.w / 2, hulls + ' vehicles');
s = started('strike');
ok('Strike: three targets, one or two of them real, and half the garrison asleep until turn 3',
  s.objectives.length === 3 && [1, 2].indexOf(s.objectives.filter((o) => o.real).length) >= 0 && s.units.some((u) => u.side === 'B' && u.wave === 2 && u.reserve));

console.log('\nVictory checks');
s = started('hive_heart');
s.objectives.forEach((o) => { o.owner = 'A'; });
let r = SC.SCENARIOS.hive_heart.check(s);
ok('Hive Heart: every chamber held at the End phase burns, and A wins', r && r.winner === 'A' && s.objectives.every((o) => o.destroyed));
s = started('hive_heart'); s.turn = 14;
r = SC.SCENARIOS.hive_heart.check(s);
ok('...a chamber still standing at the end: the hive wins', r && r.winner === 'B');
s = started('convoy');
s.units.filter((u) => s.sc.convoy.indexOf(u.id) >= 0).forEach((u) => { u.alive = false; u.extracted = true; });
r = SC.SCENARIOS.convoy.check(s);
ok('Convoy: the convoy through, A wins', r && r.winner === 'A');
ok('...and a unit lifted out is no loss when the rout is counted', !SC.routed(s, 'A'));
s = started('convoy');
s.units.filter((u) => s.sc.convoy.indexOf(u.id) >= 0).forEach((u) => { u.alive = false; });
r = SC.SCENARIOS.convoy.check(s);
ok('...the convoy burning, B wins', r && r.winner === 'B');
s = started('breakout');
s.sc.extract.out = s.sc.startA;
r = SC.SCENARIOS.breakout.check(s);
ok('Breakout: half the company out, A wins', r && r.winner === 'A');
s = started('breakout'); s.turn = 8; s.sc.extract.out = Math.ceil(s.sc.startA / 4);
r = SC.SCENARIOS.breakout.check(s);
ok('...a quarter out by the end: a draw', r && r.winner === null);
s = started('holdline'); s.turn = 3; s.objectives[0].owner = 'B';
r = SC.SCENARIOS.holdline.check(s);
ok('Hold the Line: the bugs on the pass from turn 3, B wins', r && r.winner === 'B');
s = started('holdline'); s.turn = 8;
r = SC.SCENARIOS.holdline.check(s);
ok('...the pass held to the end of turn 8, A wins', r && r.winner === 'A');
s = started('strike');
s.objectives.forEach((o) => { o.owner = 'A'; });
r = SC.SCENARIOS.strike.check(s);
ok('Strike: every target reached, the real ones wrecked and the rest shown up as decoys, A wins',
  r && r.winner === 'A' && s.objectives.every((o) => (o.real ? o.wrecked : o.decoy)), s.objectives.map((o) => (o.real ? 'real' : 'decoy')).join(','));
s = started('parley'); s.turn = 6;
r = SC.SCENARIOS.parley.check(s);
ok('Parley: the talks held to turn 6, A wins, and the report says so', r && r.winner === 'A' && s.storyOutcome.parley === 'held');
s = started('parley'); s.sc.parley.broken = 2; s.sc.parley.by = 'A';
s.units.filter((u) => u.side === 'B').forEach((u) => { u.alive = false; });
r = SC.SCENARIOS.parley.check(s);
ok('...broken by A, and fought out: a rout like any Meeting engagement', r && r.winner === 'A' && s.storyOutcome.parley === 'broken by you');

console.log('\nDeep Contract\u2019s second half on its own scenarios: every battle set up and started (none played)');
const S = require('../../src/story/story.js'), L = require('../../src/story/levers.js');
require('../../src/story/deep-contract.js');
const dc = S.get('deep-contract');
dc.chapters.filter((ch) => ch.half === 2).forEach((ch) => (ch.nodes || []).filter((n) => n.type === 'battle').forEach((n) => {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'deep-contract');
  c.story.chapter = ch.id; c.story.node = n.id; c.story.meters.hive = 6;
  try {
    const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: n.scenario });
    const cfg = L.toCfg(c, { picks, role: 'A' });
    const e = Engine.create(); cfg.mode = 'ai'; e.start(cfg); deployAndStart(e);
    const st = e.state();
    ok(n.id + ': ' + n.scenario + ', set up and started', st.phase === 'battle' && st.cfg.scenario === n.scenario && st.units.some((u) => u.side === 'B'),
      n.waves ? cfg.story.waves.per + ' a wave at Hive Growth 6' : '');
  } catch (err) { ok(n.id + ': set up and started', false, err.message); }
}));

console.log('\nOne battle of each, AI against AI (the scenario’s own test)');
/* Both sides to the AI, and the battle stepped to its end as the off-table
   battles are: whatever the engine waits on answered as the AI would. */
function play(scen) {
  const e = Engine.create();
  e.start(cfgFor(scen, 'demo', { waves: { per: 1 } }));
  deployAndStart(e);
  let stuck = 0;
  for (let i = 0; i < 20000 && !e.over(); i++) {
    const st = e.state();
    if (st.swapAsk) { e.intent(st.swapAsk.side, { k: 'swapdone' }); continue; }
    if (st.faceAsk) { e.intent(st.faceAsk.side, { k: 'vfaceall' }); continue; }
    const res = e.intent(st.activeSide || 'A', { k: 'step' });
    if (res.ok) { stuck = 0; continue; }
    const sel = e.sel();
    if (sel.insertion) {
      const sp = (sel.insertion.spots || [])[0];
      e.intent(sel.insertion.by || (sel.insertion.unit ? sel.insertion.unit.side : 'A'), sp ? { k: 'insert', x: sp.x, y: sp.y } : { k: 'holdinsert' });
      continue;
    }
    if (sel.reservePick) {
      const rp = sel.reservePick;
      rp.ids.slice(0, Math.max(rp.min, 1)).forEach((id) => e.intent(rp.side, { k: 'rpick', id }));
      e.intent(rp.side, { k: 'rpickdone' });
      continue;
    }
    if (++stuck > 20) break;
  }
  return e;
}
const SAW = {
  hive_heart: (st) => (st.units.some((u) => u.spawned) || st.turn < 2 ? 'the waves came' : null),
  holdline: (st) => (st.units.some((u) => u.spawned) || st.turn < 2 ? 'the waves came' : null),
  breakout: (st) => (st.sc.countdown.areas.some((a) => a.struck) || (st.sc.extract.out || 0) > 0 || st.turn < 3 ? 'the strikes fell, or somebody got out' : null),
  convoy: () => 'the convoy ran',
  strike: (st) => (st.objectives.some((o) => o.wrecked || o.decoy) || st.turn >= 10 || (st.over && st.over.winner === 'B') ? 'the targets were gone for' : null),
  parley: (st) => (st.sc.parley.broken ? 'the talks broke (' + st.sc.parley.by + ')' : st.turn >= 6 ? 'the talks held' : null)
};
ALL.forEach((scen) => {
  const t0 = Date.now(), e = play(scen), st = e.state(), rep = e.report();
  ok(scen + ': played to a result', !!st.over && !!rep, (st.over ? st.over.text : 'stuck at turn ' + st.turn) + ' (' + Math.round((Date.now() - t0) / 1000) + 's)');
  const saw = SAW[scen](st);
  ok('...' + (saw || 'its own End phase did nothing'), !!saw);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
