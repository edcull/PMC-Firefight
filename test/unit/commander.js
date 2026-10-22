/* The company's commander (the officer at the head of its field command): never
   a casualty, so never in the hospital, and never replaced. Followed from the
   founding through the muster, the casualties a battle takes, a squad wiped
   out, the aftermath and the next muster, and named as a story names them. */
'use strict';
const { R, C } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];

console.log('\nThe founding');
const c = C.newCampaign({ mode: 'solo' }), co = c.companies.A;
C.found(co, FOUNDING, 'S2');
const cmd = C.byRid(co, co.cmdRid);
ok('the field command is named at the founding, its officer the commander', cmd.men && cmd.men[0] && cmd.men[0].commander === true && cmd.men.filter((m) => m.commander).length === 1, JSON.stringify(cmd.men));
S.begin(c, 'deep-contract', { commander: 'Mara Okafor' });
ok('a story names the same officer', cmd.men[0].name === 'Mara Okafor' && cmd.men[0].commander);

console.log('\nThe battle');
// the squad as the engine musters it: the commander carried in any place stands first
const p = R.profile(cmd.key);
const unit = () => ({ key: p.key, faction: 'pmc', group: p.group, tier: p.tier, size: p.size, models: p.size, cls: 'infantry', command: !!p.command, rules: (p.rules || []).slice() });
let u = unit();
R.musterMen(u, cmd.men.slice().reverse(), {});
ok('mustered: the commander first, with the first rank', u.men[0].name === 'Mara Okafor' && u.men[0].commander && u.men[0].rank === R.rankFor(u, 0), JSON.stringify(u.men));
let commanderLost = 0;
for (let i = 0; i < 400; i++) {
  u = unit(); R.musterMen(u, cmd.men, {});
  u.models = Math.floor(Math.random() * u.size);
  R.syncMen(u, 1, {});
  if (u.men.some((m) => m.commander && m.lost != null)) commanderLost++;
}
ok('every casualty a squad takes is one of the others: never the commander (400 battles)', commanderLost === 0);
u = unit(); R.musterMen(u, cmd.men, {});
u.models = 0;
const lost = R.syncMen(u, 2, {});
ok('a squad wiped out: everyone else is a casualty, and the commander comes through', lost.length === u.men.length - 1 && !lost.some((m) => m.commander) && R.survivors(u).length === 1 && R.survivors(u)[0].commander,
  lost.map((m) => m.name).join(', '));

console.log('\nThe aftermath');
// the report for that battle: the squad wiped, its casualties by name, the commander among the survivors
const report = {
  winner: 'B', routed: { A: false, B: false }, battleTier: 1, pl: 1, scenario: 'meeting', turns: 6,
  units: [{ rid: cmd.rid, side: 'A', key: cmd.key, tier: p.tier, startSize: p.size, endSize: 0, wiped: true, destroyed: false, kills: [], men: R.survivors(u) }],
  casualties: lost.map((m) => ({ side: 'A', name: m.name, rank: m.rank, role: m.role || null, turn: m.lost, type: p.name, unit: cmd.name, rid: cmd.rid })),
  story: null
};
const rec = C.aftermath(c, report, {});
const hospital = JSON.stringify(rec || {});
ok('the commander is in nobody’s casualty list: not killed, not wounded', !/Mara Okafor/.test(JSON.stringify(report.casualties)) && !/Mara Okafor/.test(hospital.replace(/"men":\[[^\]]*\]/g, '')));
ok('the field command is reconstituted around the commander', C.byRid(co, co.cmdRid) && C.byRid(co, co.cmdRid).men[0].name === 'Mara Okafor' && C.byRid(co, co.cmdRid).men[0].commander);
C.menOf(C.byRid(co, co.cmdRid), co);
const after = C.byRid(co, co.cmdRid).men;
ok('...filled up with new men, the commander still at its head', after.length === p.size && after[0].name === 'Mara Okafor' && after.filter((m) => m.commander).length === 1, after.map((m) => m.name).join(', '));
ok('...and the story still says the same name', S.render(c, '{commander}') === 'Mara Okafor' && /Okafor/.test(S.render(c, '{commander:rank}')));

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
