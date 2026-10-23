/* HTX's bonus and the side contracts (src/story/story.js; docs/story-mode-plan.md,
   section 4): the bonus a story battle won pays, by HTX Standing; the side
   contracts an interlude offers, taken or passed up, fought as a battle of their
   own and back to the interlude; more of them, and free of time, for a company
   behind the curve; more of them, and better paid, once HTX has stopped paying. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
const V = require('../../src/story/validate.js');
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
  S.begin(c, 'deep-contract');
  return c;
}
const dc = S.get('deep-contract');
// the story taken on from where it stands to the next interlude: the first open option each time, battles won
function toInterlude(c, grade) {
  for (let i = 0; i < 60; i++) {
    const v = S.view(c);
    if (v.type === 'interlude') return v;
    if (v.type === 'event' || v.type === 'pool') S.choose(c, v.options.find((o) => o.ok).id);
    else if (v.type === 'battle') S.resolveBattle(c, grade || 'victory');
    else S.proceed(c);
  }
  return null;
}

console.log('\nHTX’s bonus');
let c = campaign();
while (S.view(c).type !== 'battle') { const v = S.view(c); v.type === 'event' ? S.choose(c, v.options.find((o) => o.ok).id) : S.proceed(c); }
let before = c.companies.A.kUC;
c.story.meters.htx = 2;
S.resolveBattle(c, 'victory');
const won = c.story.journal[c.story.journal.length - 1];
ok('a story battle won pays HTX’s bonus, by HTX Standing: 2 × 1.5 at Standing 2', (won.effects || []).some((e) => e.kUC === 3) && c.companies.A.kUC - before === 3, JSON.stringify(won.effects));
const bonusAt = (htx, g, flags) => {
  const k = campaign();
  while (S.view(k).type !== 'battle') { const v = S.view(k); v.type === 'event' ? S.choose(k, v.options.find((o) => o.ok).id) : S.proceed(k); }
  k.story.meters.htx = htx; Object.assign(k.story.flags, flags || {});
  const b = k.companies.A.kUC; S.resolveBattle(k, g); return k.companies.A.kUC - b;
};
ok('...less at a lower Standing, and never below nothing', bonusAt(0, 'victory') === 2 && bonusAt(-6, 'victory') === 0);
ok('...half for a draw, nothing for a defeat', bonusAt(0, 'draw') === 1 && bonusAt(4, 'defeat') === 0);
ok('...and nothing once HTX has cut you off', bonusAt(4, 'decisive', { htx_cut_off: true }) === 0);

console.log('\nAn interlude’s side contracts');
c = campaign();
let v = toInterlude(c);
ok('the first interlude offers one side contract', v && v.id === 'c1.interlude' && v.side.length === 1, v && JSON.stringify(v.side.map((o) => o.id)));
const offer = v.side[0], job = dc.side.jobs.find((j) => j.id === offer.id);
ok('...with its words, what it pays and who it is against', !!offer.title && offer.text.length > 40 && offer.pay === job.pay && !!offer.against);
before = c.companies.A.kUC;
const hive0 = c.story.meters.hive, htx0 = c.story.meters.htx;
S.takeSide(c, offer.id);
v = S.view(c);
ok('taking it: a battle of its own, under its own name', v.type === 'battle' && v.battle.name === job.title && v.battle.scenario === job.scenario && v.sideJob === job.id);
const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: job.scenario });
const cfg = L.toCfg(c, { picks, role: 'A' });
ok('...set up as any story battle is, on its own ground', cfg.scenario === job.scenario && (!job.map || cfg.story.mapName === global.PMCStoryMaps['deep-contract'][job.map].name) && cfg.armyB.length > 0, cfg.story.mapName);
const e = Engine.create(); cfg.mode = 'ai'; e.start(cfg);
ok('...and it starts in the engine', !!e.state() && e.state().units.some((u) => u.side === 'B'));
ok('in the first half, it costs no time', c.story.meters.hive === hive0);
S.resolveBattle(c, 'victory');
v = S.view(c);
ok('won: its pay, and back to the interlude, with nothing more on offer there', v.type === 'interlude' && v.id === 'c1.interlude' && v.side.length === 0 && c.companies.A.kUC - before === job.pay,
  (c.companies.A.kUC - before) + ' kUC');
ok('...without HTX’s bonus or the story’s own after-battle rules', c.story.meters.htx === htx0 + ((job.on.success || [{}])[0].effects || []).filter((x) => x.meter === 'htx').reduce((s, x) => s + x.add, 0));
S.proceed(c);
ok('going on from it goes on with the story', S.view(c).id !== 'c1.interlude');

console.log('\nPassing them up, catching up, and cut off');
c = campaign();
v = toInterlude(c);
const passedJob = dc.side.jobs.find((j) => j.id === v.side[0].id);
const sent0 = c.story.meters.sentiment, htxB = c.story.meters.htx;
S.proceed(c);
const delta = (passedJob.passed || []).reduce((s, x) => s + (x.add || 0), 0);
ok('a side contract passed up costs what it says (' + passedJob.id + ')', (c.story.meters.sentiment - sent0) + (c.story.meters.htx - htxB) === delta);
// a company behind the curve: still Tier I at chapter 3's interlude (it was wanted at Tier II by then)
const late = campaign();
toInterlude(late); S.proceed(late); toInterlude(late); S.proceed(late);
v = toInterlude(late);
ok('a company behind the curve is offered two, to catch up', v.type === 'interlude' && v.side.length === 2 && v.side.every((o) => o.catchUp && !o.cost), JSON.stringify(v.side.map((o) => [o.id, o.catchUp])));
late.story.chapterNo = 6;
const hiveL = late.story.meters.hive;
S.takeSide(late, v.side[0].id);
ok('...and taking one costs no time, even in the second half', late.story.meters.hive === hiveL);
c = campaign();
c.story.flags.htx_cut_off = true;
v = toInterlude(c);
ok('cut off: two on offer, paid half as much again, and the Front’s money among the jobs', v.side.length === 2 && v.side.every((o) => o.pay === Math.round(dc.side.jobs.find((j) => j.id === o.id).pay * 1.5)) &&
  v.side.every((o) => !dc.side.jobs.find((j) => j.id === o.id).if || S.test(S.ctxOf(c), dc.side.jobs.find((j) => j.id === o.id).if)), JSON.stringify(v.side.map((o) => [o.id, o.pay])));
ok('in the second half a side contract taken costs time: Hive Growth +1', (() => {
  const k = campaign(); toInterlude(k); k.story.chapterNo = 6; k.companies.A.tier = 3; const off = S.view(k).side[0]; if (!off || off.catchUp) return true;
  const h = k.story.meters.hive; S.takeSide(k, off.id); return k.story.meters.hive === h + 1;
})());

console.log('\nDifficulty');
/* Chosen when the story begins: the enemy's share of the points, what the
   company's experience adds, and the pay. Contract is the story as tuned. */
const atDiff = (d) => {
  const k = C.newCampaign({ mode: 'solo' });
  C.found(k.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  k.companies.A.roster.forEach((e) => { e.exp = 12; });        // a company with some experience, so the allowance counts
  S.begin(k, 'deep-contract', d ? { difficulty: d } : {});
  k.story.chapter = 'c2d'; k.story.node = 'c2d.battle';
  const spec = S.battleSpec(k), co = k.companies.A;
  const f = L.buildForce(spec.enemy, { campaign: k, tier: 2, pl: 1, allowance: L.allowance(co) });
  const pts = f.picks.reduce((n, p) => n + R.profile(p.key).tier, 0);
  k.story.meters.htx = 2;
  const bonus = (() => { k.story.node = 'c1.battle'; k.story.chapter = 'c1'; const b0 = co.kUC; S.resolveBattle(k, 'victory'); return co.kUC - b0; })();
  return { pts, bonus, d: k.story.difficulty, def: S.difficultyOf(k) };
};
const easy = atDiff('story'), norm = atDiff('contract'), none = atDiff(null), hard = atDiff('hard');
ok('three settings, Contract the default when none is chosen', !!dc.difficulty.story && !!dc.difficulty.hard && none.def === dc.difficulty.contract && none.d === null);
ok('the enemy is smaller on Story, larger on Hard', easy.pts < norm.pts && norm.pts < hard.pts, easy.pts + ' / ' + norm.pts + ' / ' + hard.pts + ' points');
ok('...and HTX pays more on Story, less on Hard', easy.bonus > norm.bonus && norm.bonus > hard.bonus, easy.bonus + ' / ' + norm.bonus + ' / ' + hard.bonus + ' kUC');
ok('an unknown setting is not taken', atDiff('nightmare').d === null);

console.log('\nThe story checks out with them');
const r = V.check(dc, { scenarios: SC.SCENARIOS });
ok('Deep Contract validates with its side contracts', r.errors.length === 0, r.errors.slice(0, 3).join(' | '));
const w = V.walk(dc, 400, { campaign: campaign });
ok('the walk takes side contracts and still reaches an ending every time', !w.stuck.length && Object.keys(w.endings).every((k) => k !== '(none)'), JSON.stringify(w.endings));

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
