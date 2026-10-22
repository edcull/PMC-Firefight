/* Deep Contract played through from Landfall to an ending, many times, with
   made-up results (docs/story-mode-plan.md, section 6, phase 6): the choices at
   random, battles won six times in ten, a side contract taken half the times
   one is offered, the campaign's real aftermath taking every report, and the
   company spending between chapters as the computer's companies do. Measured
   against the growth curve (Company Tier III by the finale) and the endings'
   spread. No battle is played. */
'use strict';
const { C } = require('../../server/rules.js');
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
const dc = S.get('deep-contract');
const N = +process.env.STORY_WALKS || 30, t = { endings: {}, tierEnd: {}, finaleTier: [], battles: [], sides: 0, errors: [], kUC: [] };

for (let w = 0; w < N; w++) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'deep-contract');
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
        if (ch && (ch.finale || ch.id === 'breakout') && !v.sideJob) t.finaleTier.push(tier);
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
  t.endings[c.story.ended || '(none)'] = (t.endings[c.story.ended || '(none)'] || 0) + 1;
  t.tierEnd[co.tier] = (t.tierEnd[co.tier] || 0) + 1;
  t.battles.push(battles); t.kUC.push(co.kUC);
}
const avg = (xs) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
const share = (n) => Math.round(100 * n / N) + '%';

console.log('\nThe whole story, played through ' + N + ' times');
ok('nothing goes wrong on the way', !t.errors.length, t.errors.slice(0, 2).join(' | '));
ok('every walk reaches an ending', !t.endings['(none)'], JSON.stringify(t.endings));
ok('...and Broken Company is rare (a tenth or fewer)', (t.endings.broken || 0) <= N * 0.1, share(t.endings.broken || 0));
ok('Scorched Earth comes to a quarter or fewer', (t.endings.scorched || 0) <= N * 0.25, share(t.endings.scorched || 0));
ok('more than one way it ends: four endings or more', Object.keys(t.endings).filter((k) => k !== 'broken').length >= 4, Object.keys(t.endings).join(', '));
ok('the growth curve: Company Tier III by the end, in half the walks or more', (t.tierEnd[3] || 0) + (t.tierEnd[4] || 0) >= N * 0.5, JSON.stringify(t.tierEnd));
ok('the finale is fought at Tier II or higher, nearly always', t.finaleTier.filter((x) => x >= 2).length >= t.finaleTier.length * 0.85, t.finaleTier.join(''));
console.log('  (battles ' + avg(t.battles) + ' a walk, side contracts ' + (t.sides / N).toFixed(1) + ', kUC at the end ' + avg(t.kUC) + ')');

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
