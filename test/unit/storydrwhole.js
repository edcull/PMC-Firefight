/* Dead Reckoning played through from Lot 47 to an ending, many times, with
   made-up results (docs/story-dead-reckoning-plan.md, phase 5e), as
   storywhole.js plays Deep Contract: the choices at random, battles won six
   times in ten, a side contract taken half the times one is offered, the
   campaign's real aftermath taking every report, and the company spending
   between chapters as the computer's companies do. Measured against the
   growth curve, the endings' spread (every ending reached), the threads
   reaching their finales, and Recall. No battle is played. */
'use strict';
const { C } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
const { makeReport } = require('../story-report.js');
require('../../src/story/dead-reckoning.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
const dc = S.get('dead-reckoning');
const N = +process.env.STORY_WALKS || 60;
/* The walks are random, but the same each run (STORY_SEED for others): thirty
   walks are a small sample, and the shares below are measured against it. */
{
  let h = (+process.env.STORY_SEED || 2670) >>> 0;
  Math.random = function () {
    h = (h + 0x6D2B79F5) >>> 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// the walks at one difficulty (null: the story's default), tallied
function walks(n, difficulty) {
  const t = { epilogues: [], endings: {}, tierEnd: {}, finaleTier: [], battles: [], sides: 0, errors: [], kUC: [], finales: {}, oneOffs: {}, played: {} };
  for (let w = 0; w < n; w++) {
    const c = C.newCampaign({ mode: 'solo' });
    C.found(c.companies.A, FOUNDING, 'S2');
    S.begin(c, 'dead-reckoning', difficulty ? { difficulty } : {});
    let battles = 0, guard = 0;
    try {
      while (guard++ < 600) {
        const v = S.view(c);
        if (!v || c.story.ended) break;
        if (v.type === 'event' || v.type === 'pool') {
          const open = v.options.filter((o) => o.ok);
          if (!open.length) throw new Error('nothing open at ' + v.id);
          S.choose(c, open[Math.floor(Math.random() * open.length)].id);
        } else if (v.type === 'battle') {
          const co = c.companies.A, b = v.battle;
          const tier = L.tierFor(co, { tier: b.tier, minTier: b.minTier, maxTier: b.maxTier }), pl = L.plFor(co, tier, b.levers.pl || b.pl);
          const picks = C.pickForce(co, tier, pl, null, { scenario: b.scenario });
          const cfg = L.toCfg(c, { picks, role: 'A', tier, pl });
          const ch = dc._chapters[c.story.chapter];
          if (ch && (ch.finale || ch.id === 'recall') && !v.sideJob) { t.finaleTier.push(tier); t.finales[ch.id] = (t.finales[ch.id] || 0) + 1; }
          if (ch && ch.oneOff && !v.sideJob) t.oneOffs[ch.id] = (t.oneOffs[ch.id] || 0) + 1;
          if (ch && ch.half === 2 && !v.sideJob) t.played[ch.id] = (t.played[ch.id] || 0) + 1;
          const grade = Math.random() < 0.6 ? (Math.random() < 0.3 ? 'decisive' : 'victory') : ['draw', 'defeat', 'defeat', 'rout'][Math.floor(Math.random() * 4)];
          const report = makeReport(picks, cfg.armyB, grade, cfg);
          S.resolveBattle(c, report);
          C.aftermath(c, report, {});
          battles++;
        } else if (v.type === 'interlude' && v.side && v.side.length && Math.random() < 0.5) {
          t.sides++;
          S.takeSide(c, v.side[Math.floor(Math.random() * v.side.length)].id);
        } else if (v.type === 'interlude') {
          C.developRival(c.companies.A);
          if (S.broken(c)) { S.breakCompany(c); break; }
          S.proceed(c);
        } else S.proceed(c);
      }
    } catch (e) { t.errors.push(e.message); }
    const co = c.companies.A;
    if (c.story.ended) t.epilogues.push({ ending: c.story.ended, ep: S.epilogue(c) });
    t.endings[c.story.ended || '(none)'] = (t.endings[c.story.ended || '(none)'] || 0) + 1;
    t.tierEnd[co.tier] = (t.tierEnd[co.tier] || 0) + 1;
    t.battles.push(battles); t.kUC.push(co.kUC);
  }
  return t;
}
const t = walks(N, null);
const avg = (xs) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
const share = (n) => Math.round(100 * n / N) + '%';

console.log('\nThe whole story, played through ' + N + ' times');
ok('nothing goes wrong on the way', !t.errors.length, t.errors.slice(0, 2).join(' | '));
ok('every walk reaches an ending', !t.endings['(none)'], JSON.stringify(t.endings));
ok('...and Broken Company is rare (a tenth or fewer)', (t.endings.broken || 0) <= N * 0.1, share(t.endings.broken || 0));
ok('no one ending takes more than half the walks', Object.keys(t.endings).every((k) => t.endings[k] <= N * 0.5), JSON.stringify(t.endings));
ok('more than one way it ends: four endings or more', Object.keys(t.endings).filter((k) => k !== 'broken').length >= 4, Object.keys(t.endings).join(', '));
ok('each of the three finales is reached, and Recall too, in some walk', ['landing', 'spire', 'collector', 'recall'].every((f) => t.finales[f]), JSON.stringify(t.finales));
ok('...and no finale shuts out the others: each in a twentieth of the walks or more, none in two thirds', ['landing', 'spire', 'collector'].every((f) => (t.finales[f] || 0) >= N * 0.05 && (t.finales[f] || 0) <= N * 0.66), JSON.stringify(t.finales));
ok('both one-offs come up, now and then: Beyond the Gate and the Double-Cross', ['warren', 'doublecross'].every((f) => t.oneOffs[f]), JSON.stringify(t.oneOffs));
// (a fallback is offered only when its thread has nothing else to give: rare by design, so most of them, not every one)
const pool = Object.keys(dc._chapters).filter((id) => dc._chapters[id].half === 2 && dc._chapters[id].nodes.some((n) => n.type === 'battle') && !dc._chapters[id].finale && id !== 'recall');
const arcs = pool.filter((id) => !dc._chapters[id].fallback), falls = pool.filter((id) => dc._chapters[id].fallback);
ok('...every chapter of the second half’s threads is played in some walk, and most of the fallbacks', arcs.every((id) => t.played[id]) && falls.filter((id) => t.played[id]).length >= falls.length - 1,
  arcs.filter((id) => !t.played[id]).concat(falls.filter((id) => !t.played[id]).map((id) => id + ' (fallback)')).join(', '));
ok('the growth curve: Company Tier III by the end, in half the walks or more', (t.tierEnd[3] || 0) + (t.tierEnd[4] || 0) >= N * 0.5, JSON.stringify(t.tierEnd));
ok('the finale is fought at Tier II or higher, nearly always', t.finaleTier.filter((x) => x >= 2).length >= t.finaleTier.length * 0.85, t.finaleTier.join(''));
const eps = t.epilogues.filter((x) => x.ending !== 'broken');
ok('every ending has its epilogue: the Quiet, the Esh-Aven, Vane, the rivals, the company', eps.every((x) => x.ep.lines.length >= 3),
  eps.map((x) => x.ep.lines.length).join(''));
ok('...written out in full, nothing left in braces', t.epilogues.every((x) => x.ep.lines.every((l) => !/[{}]/.test(l))));
console.log('  (an epilogue: ' + (eps[0] ? eps[0].ending + ': ' + eps[0].ep.lines.join(' ') : '') + ')');
console.log('  (battles ' + avg(t.battles) + ' a walk, side contracts ' + (t.sides / N).toFixed(1) + ', kUC at the end ' + avg(t.kUC) + ')');
console.log('  (finales ' + JSON.stringify(t.finales) + ', second half played ' + JSON.stringify(t.played) + ')');

console.log('\nAt the other difficulties');
const byDiff = {};
['story', 'hard'].forEach((d) => {
  const td = walks(Math.ceil(N / 2), d), n = Math.ceil(N / 2);
  byDiff[d] = td;
  ok(dc.difficulty[d].name + ': every walk reaches an ending, nothing going wrong', !td.errors.length && !td.endings['(none)'], JSON.stringify(td.endings));
  ok('...and Broken Company stays rare', (td.endings.broken || 0) <= n * 0.15, (td.endings.broken || 0) + ' of ' + n);
});

/* the difficulties in order: Story leaves the company better off than Hard. A
   company spends what it has on growing between chapters, so better off is
   richer or a higher Tier, and never a lower one. */
const kOf = (td) => +avg(td.kUC), tierOf = (td) => avg(Object.keys(td.tierEnd).reduce((xs, k) => xs.concat(Array(td.tierEnd[k]).fill(+k)), []));
ok('...and they are in order: a company ends a Story walk better off than a Hard one (richer, or higher in Tier), and never lower in Tier',
  (kOf(byDiff.story) > kOf(byDiff.hard) || +tierOf(byDiff.story) > +tierOf(byDiff.hard)) && +tierOf(byDiff.story) >= +tierOf(byDiff.hard),
  'kUC ' + kOf(byDiff.story) + ' / ' + kOf(t) + ' / ' + kOf(byDiff.hard) + ', Tier ' + tierOf(byDiff.story) + ' / ' + tierOf(t) + ' / ' + tierOf(byDiff.hard));
console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
