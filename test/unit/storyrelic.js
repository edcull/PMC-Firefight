/* The relic variant (docs/story-dead-reckoning-plan.md, section 5; phase 2):
   on Find and secure, what is found is a relic that can be carried. Picked up
   at an End phase by a unit on foot within 2", with none of the other side's
   as close; the objective goes where its carrier goes; a carrier destroyed
   drops it; carried into its own entry strip, it is off the table and the
   battle won. The report says who has it, the story reads `{ relic: 'A' }`,
   and Dead Reckoning's two relic battles, the Glass Flats and the Drowned
   Beacon, pay out on it. And one battle of it, AI against AI. */
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
function at(node, flags) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'dead-reckoning', { commander: 'Ines Okoro' });
  c.story.chapter = dr._nodes[node]._chapter; c.story.node = node;
  Object.assign(c.story.flags, flags || {});
  return c;
}
function started(cfg) {
  const e = Engine.create();
  cfg.mode = cfg.mode || 'ai';
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
const held = (d6, fn) => { const r = R.d6; R.d6 = () => d6; try { return fn(); } finally { R.d6 = r; } };
const c0 = at('c2f.battle');
const picks = C.pickForce(c0.companies.A, 1, 1, null, { scenario: 'find' });
const cfgOf = (c) => L.toCfg(c, { picks, role: 'A' });

console.log('\nSet up');
const cfg = cfgOf(c0);
ok('the Glass Flats is fought for a relic: Find and secure, with the relic variant', cfg.scenario === 'find' && cfg.story.variant && cfg.story.variant.relic === true);
ok('...and so is the Drowned Beacon', (() => { const c = at('c3.battle'); const f = cfgOf(c); return f.scenario === 'find' && f.story.variant.relic; })());
ok('...but stormed as a Strike, the beacon has no relic to find', (() => {
  const c = at('c3.battle'); c.story.pending = { scenario: 'strike' };
  S.resolveBattle(c, 'victory');
  return c.story.lastRelic === null;
})());

console.log('\nFound, picked up, carried, dropped');
const e = started(cfg), st = e.state();
const K = global.PMCEngineStory({ R, SC, get state() { return st; }, logLine() {}, pushRes() {} });
const foot = (side) => st.units.filter((u) => u.side === side && u.alive && !R.isMachine(u) && R.holdsGround(u));
const [a1, a2] = foot('A'), [b1] = foot('B');
const away = () => st.units.forEach((u, i) => { if (u.alive) { u.x = 6 + (i % 8) * 4; u.y = u.side === 'A' ? 4 : R.BOARD.h - 4; u.reserve = false; u.aboard = null; u.sp = 0; } });
away();
ok('nothing to carry before anything is found', K.relicFollow() === null && !st.sc.relic);
const spot = st.sc.search[0];
a1.x = spot.x; a1.y = spot.y + 3;
held(6, () => SC.checkArea(st, a1, spot));
ok('found: the relic lies where it was found', st.sc.found === spot && (() => { const rl = K.relicFollow(); return rl && rl.x === spot.x && rl.y === spot.y && rl.carrier === null; })());
b1.x = spot.x + 1; b1.y = spot.y;
a1.x = spot.x - 1; a1.y = spot.y;
K.storyEndPhase();
ok('both sides on it: nobody lifts it', st.sc.relic.carrier === null);
b1.x = spot.x + 10;
K.storyEndPhase();
ok('one side alone within 2": its nearest unit on foot picks it up', st.sc.relic.carrier === a1.id && a1.relic);
a1.x += 5; a1.y += 2;
K.relicFollow();
ok('the objective goes where its carrier goes, held within 4" of it', st.objectives[0].x === a1.x && st.objectives[0].y === a1.y && !st.objectives[0].rect && st.objectives[0].carried === 'A');
ok('...and Find and secure holds it there', SC.holderOf(st, a1.x, a1.y, 4) === 'A' && st.scen.check(st) == null && st.sc.hold.A === 1);
ok('the AI carrying it makes for its own table edge', (() => { const g = K.relicGoal(a1); const s = st.sc.entry.A[0]; return g && g.x >= s.x && g.x <= s.x + s.w; })(), JSON.stringify(K.relicGoal(a1)));
ok('...and nobody else is sent there', K.relicGoal(a2) === null && K.relicGoal(b1) === null);
const dropAt = { x: a1.x, y: a1.y };
a1.alive = false;
K.relicFollow();
ok('its carrier destroyed: dropped where it fell', st.sc.relic.carrier === null && st.sc.relic.x === dropAt.x && st.sc.relic.y === dropAt.y && !st.objectives[0].carried);
b1.x = dropAt.x + 1; b1.y = dropAt.y;
a2.x = dropAt.x + 12;
K.storyEndPhase();
ok('...and the other side can pick it up', st.sc.relic.carrier === b1.id);
b1.sp = 99;
K.relicFollow();
ok('a carrier caught Broken drops it', R.status(b1) === 'broken' && st.sc.relic.carrier === null, R.status(b1));
b1.sp = 0;
st.sc.relic.carrier = null;
b1.x = dropAt.x; b1.y = dropAt.y;
K.storyEndPhase();
const strip = st.sc.entry.B[0];
b1.x = strip.x + strip.w / 2; b1.y = strip.y + strip.h / 2;
K.relicFollow();
K.storyEndPhase();
const res = K.storyCheck(st);
ok('carried into its own entry strip: off the table, and the battle won', st.sc.relic.off === 'B' && b1.extracted && res && res.winner === 'B', res && res.text);
ok('...the report told who has it', st.storyOutcome && st.storyOutcome.relic === 'B');

console.log('\nHeld at the end');
{
  const e2 = started(cfgOf(at('c2f.battle'))), s2 = e2.state();
  const K2 = global.PMCEngineStory({ R, SC, get state() { return s2; }, logLine() {}, pushRes() {} });
  const sp = s2.sc.search[1], u = s2.units.find((x) => x.side === 'A' && x.alive && !R.isMachine(x));
  s2.units.forEach((x) => { if (x.alive) { x.x = x.side === 'A' ? 3 : R.BOARD.w - 3; x.y = 20; } });
  u.x = sp.x; u.y = sp.y + 5; u.reserve = false;
  held(6, () => SC.checkArea(s2, u, sp));
  K2.relicFollow();
  K2.storyCheck(s2);
  ok('lying where it was found, the side holding the site has it', s2.storyOutcome.relic === 'A');
  u.x = R.BOARD.w / 2; u.y = 2;
  K2.storyCheck(s2);
  ok('...and nobody, if nobody holds it', s2.storyOutcome.relic === null);
}

console.log('\nThe story reads it');
const after = (node, report, set) => { const c = at(node); if (set) set(c.story); const m = Object.assign({}, c.story.meters); S.resolveBattle(c, report); return { c, m }; };
const rep = (winner, relic) => ({ winner, routed: {}, story: { relic }, units: [{ side: 'A', tier: 1, startSize: 5, endSize: 5 }, { side: 'B', tier: 1, startSize: 5, endSize: winner === 'A' ? 0 : 5, wiped: winner === 'A' }] });
{
  let r = after('c2f.battle', rep('A', 'A'));
  ok('the Glass Flats won with the lodestone: one more stone', r.c.story.meters.stones === r.m.stones + 1 && r.c.story.meters.theirs === r.m.theirs && r.c.story.lastRelic === 'A');
  ok('...{ relic: \'A\' } holds, and the debrief says so', S.test(S.ctxOf(r.c), { relic: 'A' }) && /yours/.test(S.render(r.c, dr._nodes['c2f.debrief'].text)));
  r = after('c2f.battle', rep('A', 'B'));
  ok('won, but Wraith carried it off: theirs, not yours', r.c.story.meters.stones === r.m.stones && r.c.story.meters.theirs === r.m.theirs + 1);
  r = after('c2f.battle', rep('B', 'A'));
  ok('lost, but carried off all the same: yours', r.c.story.meters.stones === r.m.stones + 1);
  r = after('c2f.battle', rep('A', null));
  ok('nobody has it at the end: nobody’s', r.c.story.meters.stones === r.m.stones && r.c.story.meters.theirs === r.m.theirs && S.test(S.ctxOf(r.c), { relic: 'none' }));
  r = after('c2f.battle', 'victory');
  ok('settled by a grade alone (a walk, a forfeit): the relic goes with the grade', r.c.story.lastRelic === 'A' && after('c2f.battle', 'defeat').c.story.lastRelic === 'B' && after('c2f.battle', 'draw').c.story.lastRelic === null);
  r = after('c3.battle', rep('A', 'A'));
  ok('the Drowned Beacon’s lodestone carried off: one more stone, and the Sh’kar roused', r.c.story.meters.stones === r.m.stones + 1 && r.c.story.meters.alarm === r.m.alarm + 1);
  ok('...and nothing is left in the socket for the debrief to offer', !S.test(S.ctxOf(r.c), dr._nodes['c3.left'].if));
}

console.log('\nOne battle, AI against AI');
{
  const cfgD = cfgOf(at('c2f.battle'));
  cfgD.mode = 'demo';
  const eD = started(cfgD);
  let lifted = false;
  for (let i = 0, stuck = 0; i < 30000 && !eD.over(); i++) {
    const s = eD.state();
    if (s.swapAsk) { eD.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { eD.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.sc && s.sc.relic && s.sc.relic.moved) lifted = true;
    if (eD.intent(s.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
    if (++stuck > 20) break;
  }
  const sD = eD.state(), rpt = eD.report && eD.report();
  ok('it plays to an end', !!eD.over(), 'turn ' + sD.turn);
  ok('...the relic found', !!sD.sc.found);
  ok('...and the report says who has it, if anyone', sD.storyOutcome && ['A', 'B', null].indexOf(sD.storyOutcome.relic) >= 0 &&
    (!rpt || !rpt.story || rpt.story.relic === sD.storyOutcome.relic), JSON.stringify(sD.storyOutcome) + (lifted ? ', lifted' : ', never lifted') + '; ' + (sD.over && sD.over.text));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
