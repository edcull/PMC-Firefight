/* Dead Reckoning, the second story, as data (docs/story-dead-reckoning-plan.md,
   phase 0): the validator finds nothing wrong with its graph, and walking it
   many times with random choices and random grades, and no battle, reaches
   every ending, every chapter and every event, with the shares the plan aims
   at. And what it needed of the story engine: a price read from a meter, one
   meter compared with another, and interlude events that come up once. */
'use strict';
const { R, SC } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const V = require('../../src/story/validate.js');
const dr = require('../../src/story/dead-reckoning.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// the walks are random, but the same each run
{
  let h = 2670 >>> 0;
  Math.random = function () {
    h = (h + 0x6D2B79F5) >>> 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log('\nThe graph');
const r = V.check(dr, { scenarios: SC.SCENARIOS, profile: R.profile });
ok('the validator finds nothing wrong', r.errors.length === 0, r.errors.slice(0, 3).join(' | '));
ok('...and warns of nothing', r.warnings.length === 0, r.warnings.slice(0, 3).join(' | '));
ok('both stories are registered, side by side', !!S.get('deep-contract') && S.get('dead-reckoning') === dr, S.list().map((d) => d.id).join(', '));
const ch = (id) => dr._chapters[id];
ok('eight chapters: four of the contract (two one-offs among them), three picks, a finale',
  dr.length === 8 && ['c1', 'c2', 'c3', 'c4'].every((c) => ch(c).half === 1) && ch('warren').oneOff && ch('doublecross').oneOff && dr.picks === 3);
ok('four threads; First Contact has no finale, the others one each',
  Object.keys(dr.threads).join() === 'race,tribes,contact,patron' && dr.threads.contact.finale === false &&
  ['landing', 'spire', 'collector'].every((c) => ch(c).finale) && !dr.chapters.some((c) => c.thread === 'contact' && c.finale));
ok('the Quiet wakes at Alarm 8: Recall, whatever was due', dr.finaleOverride[0].chapter === 'recall' && dr.finaleOverride[0].if.meter === 'alarm');
const noPlace = dr.chapters.reduce((a, c) => a.concat(c.nodes.filter((n) => n.type === 'battle' && !n.place && !c.place).map((n) => n.id)), []);
ok('every battle has a place on the trail: its own, or its chapter\u2019s', !noPlace.length, noPlace.join(', '));

console.log('\nThe forces');
const forces = [];
dr.chapters.forEach((c) => c.nodes.forEach((n) => {
  if (n.enemy) forces.push({ at: n.id, f: n.enemy });
  (n.options || []).forEach((o) => { if (o.battle && o.battle.allies) forces.push({ at: n.id + '/' + o.id, f: o.battle.allies }); });
  (n.adjust || []).forEach((a) => { if (a.levers && a.levers.allies) forces.push({ at: n.id + ' (adjust)', f: a.levers.allies }); });
}));
dr.side.jobs.forEach((j) => forces.push({ at: 'side ' + j.id, f: j.enemy }));
const keysOf = (f) => [].concat(f.core || [], (f.optional && f.optional.units) || [], (f.fill && f.fill.from) || []).map((u) => (typeof u === 'string' ? u : u.key));
const { C } = require('../../server/rules.js');
ok('every force, enemy or ally, and every side names its archetype, and it exists', forces.every((x) => C.archetype(x.f.archetype)) && Object.keys(dr.sides).every((k) => C.archetype(dr.sides[k].archetype)),
  forces.filter((x) => !C.archetype(x.f.archetype)).map((x) => x.at).join(', '));
const hash = forces.filter((x) => x.f.side === 'hashamer');
ok('the Hashamer, enemy or ally, are all Esh-Aven: skinned, and without craft or teleport turrets',
  hash.length >= 3 && hash.every((x) => x.f.skin === 'eshaven' && ['Strike Aviation', 'Support Aviation', 'Teleport Turrets'].every((g) => x.f.without.indexOf(g) >= 0)) &&
  hash.every((x) => keysOf(x.f).every((k) => { const p = R.profile(k); return p && p.faction === 'xeno' && !/Aviation|Teleport/.test(p.group || '') && p.cls !== 'aircraft'; })),
  hash.length + ' forces');
ok('every Xenotripod force is Xenotripods, every rival PMCs', forces.every((x) => keysOf(x.f).every((k) => R.profile(k).faction === (x.f.faction === 'xeno' ? 'xeno' : x.f.faction === 'rebel' ? 'rebel' : 'pmc'))));

console.log('\nThe hired guns');
const hires = [];
dr.chapters.forEach((c) => c.nodes.forEach((n) => (n.options || []).forEach((o) => { if (o.hire) hires.push({ c, n, o }); })));
ok('nobody is for hire before chapter 4 (The Broker)', hires.every((h) => ['c1', 'c2', 'c3', 'warren', 'doublecross'].indexOf(h.c.id) < 0), hires.map((h) => h.n.id).join(', '));
ok('every hire asks for what opened that company’s door, and costs its price', hires.every((h) => JSON.stringify(h.o.if).indexOf(h.o.hire === 'kettle' ? 'kettle_contact' : h.o.hire === 'kestrel' ? 'kestrel_' : h.o.hire === 'reavers' ? 'reavers_spared' : 'sable_owed') >= 0 &&
  h.o.cost.kUC === h.o.hire + '_price'));
{
  const c = { companies: { A: { name: 'T', kUC: 10, tier: 1, roster: [] } } };
  S.begin(c, 'dead-reckoning', {});
  c.story.chapter = 'c4'; c.story.node = 'c4.lot'; c.story.flags.kettle_contact = true; c.story.meters.kettle_price = 3;
  const opt = S.view(c).options.find((o) => o.id === 'hire_kettle'), had = c.companies.A.kUC;
  ok('a price read from a meter: shown as what it is now', opt && opt.ok && opt.cost.kUC === 3, JSON.stringify(opt && opt.cost));
  S.choose(c, 'hire_kettle');
  ok('...paid as that, and the price goes up for next time', c.companies.A.kUC === had - 3 && c.story.meters.kettle_price === 4 && c.story.flags.kettle_hired);
  c.story.meters.kettle_price = 20;
  c.story.node = 'c4.lot';
  ok('...and closed when the company can’t pay it', S.view(c).options.find((o) => o.id === 'hire_kettle').ok === false);
}

console.log('\nThe engine’s new words');
{
  const c = { companies: { A: { name: 'T', kUC: 0, tier: 1, roster: [] } } };
  S.begin(c, 'dead-reckoning', {});
  const ctx = S.ctxOf(c);
  c.story.meters.theirs = 4; c.story.meters.stones = 3;
  ok('one meter above another: { more: [theirs, stones] }', S.test(ctx, { more: ['theirs', 'stones'] }) && !S.test(ctx, { more: ['stones', 'theirs'] }));
  c.story.meters.stones = 4;
  ok('...and not when they are level', !S.test(ctx, { more: ['theirs', 'stones'] }));
}

console.log('\nWalked through, ' + 6000 + ' times');
const w = V.walk(dr, { walks: 6000 });
const pct = (n) => Math.round(1000 * n / w.walks) / 10;
ok('no walk gets stuck, and no event is left with nothing open', !w.stuck.length && !Object.keys(w.noOptions).length, w.stuck.concat(Object.keys(w.noOptions)).slice(0, 3).join(', '));
ok('every ending is reached, each in 5% of walks or more', dr.endings.filter((e) => !e.broken).every((e) => pct(w.endings[e.id] || 0) >= 5),
  Object.keys(w.endings).map((k) => k + ' ' + pct(w.endings[k]) + '%').join(', '));
ok('...and none in more than 30%', Object.keys(w.endings).every((k) => pct(w.endings[k]) <= 30));
ok('Lost Signal (the Quiet woken) in a fifth of walks or fewer', pct(w.endings.lostsignal || 0) <= 20, pct(w.endings.lostsignal || 0) + '%');
ok('each one-off in 5 to 15% of walks', ['warren', 'doublecross'].every((c) => pct(w.oneOffs[c] || 0) >= 5 && pct(w.oneOffs[c] || 0) <= 15),
  ['warren', 'doublecross'].map((c) => c + ' ' + pct(w.oneOffs[c] || 0) + '%').join(', '));
ok('every finale is reached, and nearly always with its thread’s chapters played', ['landing', 'spire', 'collector', 'recall'].every((f) => w.finales[f]) && pct(w.finaleWithArc) >= 90,
  Object.keys(w.finales).map((k) => k + ' ' + pct(w.finales[k]) + '%').join(', ') + '; with the arc ' + pct(w.finaleWithArc) + '%');
// (the wake needs a unit wiped out, which a walk with no battles never has)
ok('every page is reached by some walk, but the wake', w.unreached.filter((id) => id !== 'i.wake').length === 0, w.unreached.join(', '));
ok('interlude events marked once come up once a story at most', (() => {
  const c = { companies: { A: { name: 'T', kUC: 20, tier: 1, roster: [] } } };
  S.begin(c, 'dead-reckoning', {});
  const st = c.story;
  for (let g = 0; !st.ended && g < 1000; g++) {
    const v = S.view(c); if (!v) break;
    if (v.type === 'event' || v.type === 'pool') { const o = v.options.filter((x) => x.ok); if (!o.length) break; S.choose(c, o[Math.floor(Math.random() * o.length)].id); }
    else if (v.type === 'battle') S.resolveBattle(c, 'victory'); else if (v.type === 'ending') break; else S.proceed(c);
  }
  return ['i.sendahead', 'i.voices', 'i.warm', 'i.newsfeed', 'i.catalogue'].every((id) => st.journal.filter((j) => j.node === id).length <= 1);
})());

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
