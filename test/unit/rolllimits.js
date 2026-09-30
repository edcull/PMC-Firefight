/* A rolled force is kept to a sensible mix: no PMC drone units, and at most one
   anti-air unit, one electronic-warfare unit and one medic unit — and it is
   still a legal army. */
'use strict';
const { R } = require('../../server/rules.js');

let checks = 0, bad = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) { console.log('  ✓ ' + what); return true; }
  bad++;
  console.log('  ✗ ' + what + (detail ? ' — ' + detail : ''));
  return false;
}

// a seeded roll, so a failure can be run again
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const over = [], illegal = [];
let n = 0;
for (const f of ['pmc', 'rebel', 'xeno']) {
  for (let t = 1; t <= 5; t++) for (const pl of [1, 2]) for (let i = 0; i < 25; i++) {
    const keys = R.rollArmy(t, pl, rnd, f); n++;
    if (!R.checkArmy(keys, t, pl).ok) illegal.push(f + ' T' + t + ' PL' + pl);
    const ps = keys.map(k => R.profile(R.splitPick(k).key));
    const count = (r) => ps.filter(p => (p.rules || []).includes(r)).length;
    const drones = f === 'pmc' ? count('Drone unit') : 0;
    if (count('Anti-aircraft') > 1 || count('Jammers') > 1 || count('Field Medics') > 1 || drones) {
      over.push(f + ' T' + t + ' PL' + pl + ': AA ' + count('Anti-aircraft') + ', EW ' + count('Jammers') + ', medic ' + count('Field Medics') + ', drones ' + drones);
    }
  }
}
ok(n + ' rolled forces: no PMC drones, at most one anti-air, one EW and one medic unit', over.length === 0, over.slice(0, 3).join(' | '));
ok('...and every one a legal army', illegal.length === 0, illegal.slice(0, 5).join(', '));

console.log('\n  ' + (checks - bad) + ' checks passed, ' + bad + ' failed.');
process.exit(bad ? 1 : 0);
