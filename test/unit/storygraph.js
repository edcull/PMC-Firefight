/* A story's graph, checked before anyone plays it (src/story/validate.js):
   the test story passes, every way of writing one wrong is caught, and the
   Monte Carlo walk gets through without sticking. */
'use strict';
const { R, SC } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const V = require('../../src/story/validate.js');
const fixture = require('../story-fixture.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const OPTS = { profile: R.profile, scenarios: SC.SCENARIOS };

/* A copy of the test story, changed by fn and registered under its own id. */
let n = 0;
function variant(fn) {
  const d = JSON.parse(JSON.stringify(fixture, (k, v) => (k[0] === '_' ? undefined : v)));
  d.id = 'broken-' + (++n);
  fn(d);
  return S.register(d);
}
const node = (d, id) => d.chapters.flatMap((c) => c.nodes).find((x) => x.id === id);
const opt = (d, id, o) => node(d, id).options.find((x) => x.id === o);
function catches(name, fn, re) {
  const r = V.check(variant(fn), OPTS);
  const hit = r.errors.find((e) => re.test(e));
  ok(name, !!hit, hit || r.errors.join(' | ') || 'no error');
}

console.log('\nThe test story');
const res = V.check(fixture, OPTS);
ok('passes with no errors', res.ok, res.errors.join(' | '));
ok('...and no warnings', !res.warnings.length, res.warnings.join(' | '));

console.log('\nWritten wrong, and caught');
catches('a next that leads nowhere', (d) => { node(d, 'c1.brief').next = 'c1.nowhere'; }, /leads nowhere/);
catches('a battle with no failure branch', (d) => { delete node(d, 'f1.battle').on.failure; }, /no failure branch/);
catches('an id used twice', (d) => { node(d, 'f2.ev').id = 'c1.cell'; }, /used twice/);
catches('a node nobody can reach', (d) => { d.chapters[0].nodes.push({ id: 'c1.lost', type: 'brief', next: 'c2' }); }, /can never be reached/);
catches('a flag set and never read', (d) => { opt(d, 'c2.wake', 'pay').effects.push({ flag: 'orphan' }); }, /orphan is set but never read/);
catches('a flag read and never set', (d) => { opt(d, 'c2.wake', 'pay').if = { flag: 'ghost' }; }, /ghost is read but never set/);
catches('a flag only read by text', (d) => {
  opt(d, 'c2.wake', 'pay').effects.push({ flag: 'mourned' });
  node(d, 'c2.interlude').text = '{if mourned}They remember.{/if}';
}, /only read by text/);
catches('a chapter-local flag read only outside its chapter', (d) => {
  node(d, 'c1.battle').adjust = [];
  opt(d, 'c2.wake', 'pay').if = { not: { flag: 'aim_kill' } };
}, /Local flag aim_kill/);
catches('a solitaire scenario', (d) => { node(d, 'f1.battle').scenario = 's_decap'; }, /solitaire/);
catches('a lever that swaps to a solitaire scenario', (d) => { opt(d, 'c1.choice', 'snatch').battle.scenario = 's_ambush'; }, /solitaire/);
catches('a scenario that does not exist', (d) => { node(d, 'f1.battle').scenario = 'nonesuch'; }, /no scenario/);
catches('a unit key that does not exist', (d) => { node(d, 'f1.battle').enemy.core.push('rnobody'); }, /no unit "rnobody"/);
catches('an unknown effect', (d) => { opt(d, 'c2.wake', 'pay').effects.push({ morale: 1 }); }, /unknown effect "morale"/);
catches('an unknown condition', (d) => { opt(d, 'c2.wake', 'pay').if = { mood: 'grim' }; }, /unknown condition/);
catches('an unknown battle lever', (d) => { opt(d, 'c1.choice', 'snatch').battle.commando = true; }, /unknown battle lever "commando"/);
catches('a one-off reached by a choice not marked extreme', (d) => { delete opt(d, 'c1.cell', 'release').extreme; }, /released leads to a one-off/);
catches('a one-off reached without a condition', (d) => { node(d, 'c1.end').when.unshift({ next: 'sump' }); }, /without a condition/);
catches('a last ending with a condition', (d) => { d.endings[d.endings.length - 1].if = { flag: 'held' }; }, /last ending must have no conditions/);
catches('a meter never lowered in a half', (d) => {
  d.meters.cash = { start: 0, uses: ['pay'] };
  opt(d, 'c2.wake', 'pay').effects.push({ meter: 'cash', add: 1 });
  opt(d, 'c1.door', 'wait').effects.push({ meter: 'cash', add: 1 });
  opt(d, 'c1.cell', 'hand').effects.push({ meter: 'cash', add: -1 });
}, /cash is never lowered by an event in half 2/);
catches('a meter that changes nothing', (d) => {
  d.meters.mood = { start: 0, twoWay: [] };
}, /mood is never read/);
catches('a truce thread with a finale of its own', (d) => { d.chapters.find((c) => c.id === 't1').finale = true; }, /no finale of its own/);
catches('a thread with no fallback', (d) => { delete d.chapters.find((c) => c.id === 'h1').fallback; }, /hive: no fallback/);
catches('two events in a half with the same battle levers', (d) => {
  d.chapters[0].nodes.splice(1, 0, { id: 'c1.copy', type: 'event', options: [
    { id: 'a', text: 'a', battle: { strikes: 'D3' }, effects: [{ meter: 'htx', add: 1 }] },
    { id: 'b', text: 'b', battle: { variant: { ambush: true }, tier: 'max-1' }, effects: [{ meter: 'htx', add: -1 }] },
    { id: 'c', text: 'c', battle: { skip: true }, effects: [{ meter: 'htx', add: -1 }] }
  ], next: 'c1.choice' });
  node(d, 'c1.brief').next = 'c1.copy';
}, /same battle levers/);

console.log('\nThe Monte Carlo walk');
const w = V.walk(fixture, { walks: 2000 });
ok('no walk gets stuck', !w.stuck.length, w.stuck.slice(0, 3).join(','));
ok('no event is ever left with no option open', !Object.keys(w.noOptions).length, Object.keys(w.noOptions).join(','));
ok('every walk ends with an ending', !w.endings['(none)'], JSON.stringify(w.endings));
ok('the one-off comes up, but not always', w.oneOffs.sump > 0 && w.oneOffs.sump < w.walks, String(w.oneOffs.sump));
ok('the finales come with their arc played', w.finaleWithArc === Object.keys(w.finales).reduce((s, f) => s + w.finales[f], 0));
ok('the report reads', /Endings/.test(V.describe(fixture, w)) && /Thresholds crossed/.test(V.describe(fixture, w)));
const zero = variant((d) => { opt(d, 'c2.wake', 'pay').if = { meter: 'htx', gte: 9 }; opt(d, 'c2.wake', 'refuse').if = { meter: 'htx', gte: 9 }; });
const wz = V.walk(zero, { walks: 50 });
ok('a walk finds an event with every option closed', wz.noOptions['c2.wake'] > 0);

console.log('\nDeep Contract');
const dc = require('../../src/story/deep-contract.js');
const dres = V.check(dc, OPTS);
ok('passes with no errors', dres.ok, dres.errors.join(' | '));
const dw = V.walk(dc, { walks: 3000 });
ok('no walk gets stuck, and no event is left with no option open', !dw.stuck.length && !Object.keys(dw.noOptions).length,
  dw.stuck.slice(0, 3).concat(Object.keys(dw.noOptions)).join(','));
ok('every ending but Broken Company is reached', !dw.unreachedEndings.length, dw.unreachedEndings.join(','));
ok('every node is reached by some walk', !dw.unreached.length, dw.unreached.join(','));
const pc = (x) => 100 * (x || 0) / dw.walks;
ok('each one-off comes up in roughly 5 to 15% of walks', pc(dw.oneOffs.sump) > 3 && pc(dw.oneOffs.sump) < 20 && pc(dw.oneOffs.relief) > 3 && pc(dw.oneOffs.relief) < 20,
  'sump ' + pc(dw.oneOffs.sump).toFixed(1) + '%, relief ' + pc(dw.oneOffs.relief).toFixed(1) + '%');
ok('Scorched Earth stays rare (target under 15%; the test allows 25%)', pc(dw.endings.scorched) < 25, pc(dw.endings.scorched).toFixed(1) + '%');

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
