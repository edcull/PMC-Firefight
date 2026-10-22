/* Story mode's engine (src/story/story.js): conditions, effects, grading,
   walking the graph to an ending, the pool and the finale, saving and loading,
   checkpoints and rewinding, and ironman. No battle is played: a battle's
   result is handed in as a grade or a made-up report. */
'use strict';
const { C } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
require('../story-fixture.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

/* A founded company, as the campaign's own founding makes one. */
function campaign(opts) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  c.companies.A.name = 'Kessler Rifles';
  S.begin(c, 'test-story', opts);
  return c;
}
const st = (c) => c.story;
const reload = (c) => C.rehydrate(JSON.parse(JSON.stringify(C.forSave(c))));

console.log('\nStarting');
let c = campaign();
ok('the story starts at its first node, in chapter 1', st(c).node === 'c1.brief' && st(c).chapterNo === 1 && st(c).chapter === 'c1');
ok('...with each meter where the story starts it', st(c).meters.htx === 1 && st(c).meters.hive === 0);
ok('...and a checkpoint at the chapter\'s start', st(c).checkpoints.length === 1 && st(c).checkpoints[0].kind === 'chapter');
ok('S.active knows a story dossier', S.active(c) && !S.active(C.newCampaign({ mode: 'solo' })));
ok('text: {name} and {if} with the flag unset', S.render(c, '{name} lands.{if spared} Nobody died.{/if}') === 'Kessler Rifles lands.');
const vet = S.render(c, '{soldier:veteran}');
ok('text: a soldier token names somebody, and keeps them for the chapter', vet && vet === S.render(c, '{soldier:veteran}'), vet);

console.log('\nConditions');
const ctx = S.ctxOf(c, { grade: 'decisive' });
ok('meters compare', S.test(ctx, { meter: 'htx', gte: 1 }) && !S.test(ctx, { meter: 'htx', gt: 1 }) && S.test(ctx, { meter: 'hive', eq: 0 }));
ok('all, any and not', S.test(ctx, { all: [{ meter: 'htx', gte: 1 }, { not: { flag: 'x' } }] }) && S.test(ctx, { any: [{ flag: 'x' }, { meter: 'hive', lte: 0 }] }));
ok('grade: success and failure', S.test(ctx, { grade: 'success' }) && !S.test(ctx, { grade: 'failure' }) && S.test(ctx, { grade: ['decisive', 'draw'] }));
ok('the roster and the bank', S.test(ctx, { roster: 'size', gte: 8 }) && S.test(ctx, { kUC: { gte: 0 } }));

console.log('\nAn event and its battle');
S.proceed(c);
let v = S.view(c);
ok('the brief leads to the event, with its three options open', v.type === 'event' && v.options.length === 3 && v.options.every((o) => o.ok));
S.choose(c, 'snatch');
v = S.view(c);
ok('the snatch team: on to the battle', v.type === 'battle' && st(c).flags.aim_capture === 'local');
ok('...the spec carries the variant and the smaller battle', v.battle.variant.capture === true && v.battle.tier === 'max-1' && v.battle.scenario === 'find');
ok('...and the written enemy force', v.battle.enemy.core.length === 2);
const report = {
  winner: 'A', routed: { A: false, B: false },
  units: [
    { side: 'A', rid: c.companies.A.roster[0].rid, tier: 1, startSize: 10, endSize: 9 },
    { side: 'A', rid: c.companies.A.roster[1].rid, tier: 1, startSize: 10, endSize: 10 },
    { side: 'B', tier: 2, startSize: 10, endSize: 4 }
  ]
};
ok('the report is graded: won, and the enemy lost twice what we did', S.grade(report) === 'decisive');
S.resolveBattle(c, report);
ok('success with aim_capture: Varga taken, on to the debrief', st(c).flags.captured && st(c).node === 'c1.debrief' && st(c).lastGrade === 'decisive');
ok('...the units that fought are kept', st(c).fielded.length === 2);
S.proceed(c);
ok('the debrief queues the event its flags call for (the cell, not the door)', st(c).node === 'c1.cell');
const exp0 = c.companies.A.roster.map((u) => u.exp || 0);
S.choose(c, 'keep');
ok('keeping her: the flag set, and every unit gets its EXP', st(c).flags.held && c.companies.A.roster.every((u, i) => u.exp === exp0[i] + 1));
ok('the branch at the chapter\'s end sends a plain choice on to chapter 2', st(c).chapter === 'c2' && st(c).chapterNo === 2);
ok('...the happening and its roll were passed straight through to the interlude', st(c).node === 'c2.interlude' && st(c).journal.some((j) => j.node === 'c2.time'));
ok('...and the chapter-local flag went with chapter 1', !('aim_capture' in st(c).flags) && st(c).flags.held === true);

console.log('\nGrades');
const r = (winner, ra, rb, la, lb) => ({ winner, routed: { A: ra, B: rb }, units: [{ side: 'A', tier: 2, startSize: 10, endSize: 10 - la }, { side: 'B', tier: 2, startSize: 10, endSize: 10 - lb }] });
ok('decisive: won, and the enemy routed', S.grade(r('A', false, true, 5, 5)) === 'decisive');
ok('victory: won, losses close', S.grade(r('A', false, false, 4, 5)) === 'victory');
ok('draw: no winner', S.grade(r(null, false, false, 0, 0)) === 'draw');
ok('defeat: lost, not routed', S.grade(r('B', false, false, 5, 1)) === 'defeat');
ok('rout: lost and routed', S.grade(r('B', true, false, 5, 1)) === 'rout');
ok('a wiped-out unit counts in full', S.grade({ winner: 'A', routed: {}, units: [{ side: 'A', tier: 1, startSize: 5, endSize: 5 }, { side: 'B', tier: 1, wiped: true, startSize: 5, endSize: 0 }] }) === 'decisive');

console.log('\nA skipped battle, a cost, and a lever by condition');
c = campaign();
S.proceed(c);
S.choose(c, 'talk');
ok('talking: the cost paid, the battle skipped by its skip branch', st(c).meters.htx === -1 && st(c).flags.spared && st(c).chapter === 'c2');
ok('...and the journal says it was skipped', st(c).journal.some((j) => j.node === 'c1.battle' && j.skipped));
c = campaign();
S.proceed(c);
S.choose(c, 'gunship');
ok('the gunship: HTX up, and the battle node shows the enemy because aim_kill is set', st(c).meters.htx === 2 && S.battleSpec(c).levers.intel === 2 && S.intel(c) === 2 && S.battleSpec(c).levers.strikes === 'D3');
c = campaign();
st(c).meters.htx = 0;
S.proceed(c);
v = S.view(c);
const gun = v.options.find((o) => o.id === 'gunship'), talk = v.options.find((o) => o.id === 'talk');
ok('an option whose condition fails is shown closed, with why', !gun.ok && gun.why === 'HTX will not lend it.');
ok('...and one that cannot be paid for is closed too', !talk.ok);
let threw = false;
try { S.choose(c, 'gunship'); } catch (e) { threw = true; }
ok('...and cannot be taken', threw);

console.log('\nThe one-off, by an extreme choice');
c = campaign();
S.proceed(c); S.choose(c, 'snatch'); S.resolveBattle(c, 'defeat');
ok('a lost hunt: the door, not the cell', (S.proceed(c), st(c).node === 'c1.door'));
S.choose(c, 'follow');
ok('following her down leads into the Sump', st(c).chapter === 'sump' && st(c).node === 'sump.battle');
S.resolveBattle(c, 'victory');
ok('...which reveals the hive, and goes on to chapter 2', st(c).revealed.hive && st(c).chapter === 'c2');
ok('...where time has started to tell (chapter 3: the hive grows)', st(c).chapterNo === 3 && st(c).meters.hive === 3);

console.log('\nThe pool, the passed-up job, the finale');
c = campaign();
S.proceed(c); S.choose(c, 'snatch'); S.resolveBattle(c, 'victory'); S.proceed(c); S.choose(c, 'hand');
S.proceed(c);                                     // the interlude: its event
ok('the interlude queues one event', st(c).node === 'c2.wake');
S.choose(c, 'pay');
v = S.view(c);
ok('the pool offers a chapter from each of the two threads under the most pressure', v.type === 'pool' && v.options.length === 2, v.options.map((o) => o.id).join(','));
const pressureFront = S.pressure(S.ctxOf(c), S.get('test-story').threads.front), pressureHive = S.pressure(S.ctxOf(c), S.get('test-story').threads.hive);
ok('...the threads ranked by their pressure', pressureFront !== undefined && pressureHive !== undefined, 'front ' + pressureFront + ', hive ' + pressureHive);
const htxBefore = st(c).meters.htx;
const hiveOffer = v.options.find((o) => o.thread === 'hive'), frontOffer = v.options.find((o) => o.thread === 'front');
S.choose(c, hiveOffer.id);
ok('taking the hive\'s job: the Front\'s passed up, with its own effect (HTX −1)', frontOffer && st(c).meters.htx === htxBefore - 1 && st(c).chapter === 'h1');
S.resolveBattle(c, 'victory');
ok('back to the pool, which offers again', S.view(c).type === 'pool' && st(c).pool.left === 1);
ok('a chapter played is not offered twice', !S.view(c).options.some((o) => o.id === 'h1'));
S.choose(c, S.view(c).options[0].id);
v = S.view(c);
if (v.type === 'battle') S.resolveBattle(c, 'victory'); else if (v.type === 'event') S.choose(c, v.options[0].id);
ok('with the picks spent, the finale: a thread\'s that had its arc played', ['ffin', 'hfin'].indexOf(st(c).pool.finale) >= 0 && st(c).played[st(c).pool.finale], st(c).pool.finale);
S.resolveBattle(c, 'rout');
ok('a lost finale ends the story with the ending it reads', st(c).ended === 'lost' && S.view(c).type === 'ending');

c = campaign();
st(c).flags.spared = true; st(c).meters.htx = -5; st(c).meters.hive = 0;
ok('the truce never takes the finale, however strong', S.finaleChapter(S.ctxOf(c)).thread !== 'truce');
st(c).meters.hive = 8;
ok('Hive Growth 8: the Breakout, whatever else', S.finaleChapter(S.ctxOf(c)).id === 'breakout');
st(c).meters.hive = 2; st(c).flags = {};
ok('with nothing set, the catch-all ending', S.endingFor(c) === 'paid');
st(c).flags.held = true;
ok('...and the first ending that fits, in order', S.endingFor(c) === 'hero');

console.log('\nBroken Company');
c = campaign();
ok('a founded company is not broken', !S.broken(c));
c.companies.A.roster = [];
ok('one with nobody left is', S.broken(c));
ok('...and the story ends there, on Broken Company', S.breakCompany(c) === 'broken' && st(c).ended === 'broken');

console.log('\nSaving, checkpoints and rewinding');
c = campaign();
S.proceed(c); S.choose(c, 'snatch');
let back = reload(c);
ok('a save and a load bring the story back as it was', back.story.node === 'c1.battle' && back.story.pending.variant.capture && back.story.flags.aim_capture === 'local');
S.resolveBattle(back, 'victory');
ok('...and it carries on from there', back.story.node === 'c1.debrief');
c = campaign();
const kuc0 = c.companies.A.kUC, roster0 = c.companies.A.roster.length;
S.proceed(c); S.choose(c, 'snatch'); S.resolveBattle(c, 'defeat'); S.proceed(c); S.choose(c, 'wait');
ok('the company has moved on (kUC from the door)', c.companies.A.kUC === kuc0 + 1 && st(c).chapter === 'c2');
c.companies.A.roster.pop();
const cps = st(c).checkpoints.length;
ok('chapter 2 took a checkpoint of its own', cps === 2, cps + '');
S.rewind(c, 0);
ok('rewinding to chapter 1 puts the story back', st(c).node === 'c1.brief' && st(c).chapter === 'c1' && !st(c).flags.escaped);
ok('...and the company: its kUC and its units', c.companies.A.kUC === kuc0 && c.companies.A.roster.length === roster0);
ok('...keeping the checkpoint rewound to', st(c).checkpoints.length === 1);
S.proceed(c); S.choose(c, 'talk');
S.rewind(c, 1);
ok('a checkpoint at a node nobody waits at carries on from it', st(c).node === 'c2.interlude', st(c).node);

console.log('\nIronman');
c = campaign({ ironman: true });
ok('no checkpoints are kept', st(c).checkpoints.length === 0);
threw = false;
try { S.rewind(c, 0); } catch (e) { threw = true; }
ok('...and there is nothing to rewind to', threw);
S.proceed(c); S.choose(c, 'snatch');
S.forfeit(c);
ok('a battle thrown away counts as a rout: the failure branch', st(c).lastGrade === 'rout' && st(c).flags.escaped && st(c).meters.htx === 0);
// a roll made at a choice is kept with it: a reload brings back the result, not the choice
c = campaign({ ironman: true });
st(c).flags.spared = true;
S.proceed(c); S.choose(c, 'talk');
S.proceed(c); S.choose(c, 'refuse');
// (spared puts the truce under the most pressure, so the pool offers it first)
ok('the pool offers the truce', S.view(c).type === 'pool' && S.view(c).options.some((o) => o.id === 't1'));
S.choose(c, 't1');
S.choose(c, 'nothing');
const rolled = st(c).journal[st(c).journal.length - 1];
back = reload(c);
const again = back.story.journal[back.story.journal.length - 1];
ok('a roll at a choice is saved with it: the reload shows the same result', rolled.choice === 'nothing' && rolled.effects.some((e) => e.roll) &&
  JSON.stringify(rolled.effects) === JSON.stringify(again.effects) && back.story.node !== 't1.terms');
ok('...and the flag travels with the save', back.story.ironman === true);

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
