/* A drone squad's losses are machines, not people: they go neither on the
   memorial nor into the loss rate, while a squad of men's do. */
'use strict';
const { R, C } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

const camp = C.newCampaign({ mode: 'solo' });
C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'dcombat', 'unarmoured', 'rookie', 'lighteng'], 'S2');
C.found(camp.companies.B, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'O1');
const A = camp.companies.A;
const drones = A.roster.find(e => e.key === 'dcombat'), men = A.roster.find(e => e.key === 'recruits');
ok('the drone squad is on the books', !!drones && !!men);
C.menOf(drones, A); C.menOf(men, A);
// the drones are named here as an older version named them; they still count for nothing
const cas = (e, n) => (e.men && e.men.length ? e.men : [1, 2, 3, 4].map(i => ({ name: 'Drone ' + i, rank: 'Private' })))
  .slice(0, n).map(m => ({ side: 'A', name: m.name, rank: m.rank, turn: 2, type: R.profile(e.key).name, unit: e.name, rid: e.rid }));
const report = {
  winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: true },
  casualties: cas(drones, 2).concat(cas(men, 3)),
  units: A.roster.map(e => {
    const p = R.profile(e.key);
    const lost = e === drones ? 2 : e === men ? 3 : 0;
    return { rid: e.rid, side: 'A', key: e.key, startSize: p.size, endSize: p.size - lost, destroyed: false, brokenEver: false, wiped: false, kills: [] };
  })
};
const before = C.lossStats(A)[0].lost;
const d6 = R.d6; R.d6 = () => 1;          // every man lost is killed
C.aftermath(camp, report);
R.d6 = d6;
const types = (A.memorial || []).map(m => m.type);
ok('the men lost go on the memorial', types.filter(t => t === R.profile('recruits').name).length === 3, types.join(', '));
ok('...and the drones do not', !types.some(t => t === R.profile('dcombat').name));
ok('only the men count as losses', C.lossStats(A)[0].lost - before === 3, String(C.lossStats(A)[0].lost - before));

console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
