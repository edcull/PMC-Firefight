/* Close Encounters in a campaign (Appendix 1; roadmap v0.4 decision 6): how often
   a contract is fought inside a compound — never, 1 in 10, half, or all — set
   with the campaign's optional rules; the computer leaving its machines at home
   for one; and a contract fought in a compound, its vehicles staying outside,
   brought through the aftermath. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

console.log('\nThe setting');
ok('kept with the optional rules: low, mid or all', JSON.stringify(R.cleanOptions({ ceFreq: 'mid', onlyTwo: true })) === '{"onlyTwo":true,"ceFreq":"mid"}' &&
  JSON.stringify(R.cleanOptions({ ceFreq: 'often' })) === '{}');
ok('...and named on the campaign\'s card', R.optionNames({ ceFreq: 'low' }).join() === 'Close Encounters (1 contract in 10)');

const camp = C.newCampaign({ mode: 'solo' });
C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'rookie', 'rookie', 'lighteng', 'lpv'], 'S2');
C.found(camp.companies.B, ['recruits', 'enforcers', 'irregulars', 'rookie', 'lighteng', 'unarmoured', 'lpv'], 'O1');
const A = camp.companies.A, B = camp.companies.B;
function rate(freq, n) {
  let ce = 0;
  for (let i = 0; i < n; i++) if (/^ce_/.test(C.foresight(A, B, true, freq ? { ceFreq: freq } : {}).scenario.id)) ce++;
  return ce / n;
}
const off = rate(null, 300), low = rate('low', 2000), mid = rate('mid', 2000), all = rate('all', 300);
ok('never with it off; every contract with it on "all"', off === 0 && all === 1, off + ' / ' + all);
ok('about 1 in 10, and about half, between', low > 0.06 && low < 0.14 && mid > 0.44 && mid < 0.56, low.toFixed(3) + ' / ' + mid.toFixed(3));
const fs = C.foresight(A, B, true, { ceFreq: 'all' });
ok('a compound contract is one of the two Close Encounters scenarios, with no second die to choose from',
  ['ce_clear', 'ce_control'].indexOf(fs.scenario.id) >= 0 && !fs.alt && !fs.fore && !!fs.scenario.name);

console.log('\nThe forces');
{
  const pick = C.pickForce(A, 2, 1, null, { scenario: 'ce_clear' });
  const any = C.pickForce(A, 2, 1, null, {});
  ok('the computer leaves its vehicles at home for a compound, where the army stays legal without them',
    pick.length > 0 && pick.every((e) => R.profile(e.key).cls === 'infantry'), pick.map((e) => e.key).join());
  ok('...and takes them anywhere else', any.length > 0, any.map((e) => e.key).join());
}

console.log('\nA contract in a compound');
{
  const picks = A.roster.slice();
  const theirs = C.pickForce(B, 2, 1, null, { scenario: 'ce_control' });
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'ce_control', armyA: picks.map((x) => R.entryPick(x)), armyB: theirs.map((x) => R.entryPick(x)),
    nameA: A.name, nameB: B.name, colourA: 'ochre', colourB: 'steel', dossier: { A: picks, B: theirs }, campaign: true, mode: 'demo', planet: 'sparse',
    doctrines: { A: A.doctrines.slice(), B: B.doctrines.slice() }, options: { ceFreq: 'all' } });
  const st0 = e.state();
  ok('the vehicle stays outside the compound', !st0.units.some((u) => u.key === 'lpv') && st0.homeBound.some((h) => h.key === 'lpv'));
  ok('...and every other unit is there, its dossier with it', st0.units.filter((u) => u.side === 'A').length === picks.length - 1 &&
    st0.units.filter((u) => u.side === 'A').every((u) => picks.some((p) => p.name === u.name)), st0.units.filter((u) => u.side === 'A').map((u) => u.name).join(', '));
  for (let g = 0; g < 40000 && !e.over(); g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) break;
  }
  ok('the battle is fought to the end', e.over());
  const lpv = A.roster.find((x) => x.key === 'lpv'), before = JSON.stringify({ exp: lpv.exp, tp: lpv.tp, damage: lpv.damage });
  let threw = null;
  try { C.aftermath(camp, e.report()); } catch (err) { threw = err.message; }
  ok('the aftermath takes the report', !threw, threw || '');
  ok('...and the vehicle that stayed outside comes out of it untouched', JSON.stringify({ exp: lpv.exp, tp: lpv.tp, damage: lpv.damage }) === before && A.roster.indexOf(lpv) >= 0,
    before + ' → ' + JSON.stringify({ exp: lpv.exp, tp: lpv.tp, damage: lpv.damage }));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
