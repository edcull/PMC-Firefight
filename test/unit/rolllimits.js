/* A rolled force is kept to a sensible mix: PMC drone units only where its
   personality weights them, and at most one anti-air unit, one electronic-warfare
   unit and one medic unit — and it is still a legal army. */
'use strict';
const { R, C } = require('../../server/rules.js');

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
    // (a drone its personality does not weight, or more than its limit of one a Priority Level)
    const a = keys.style ? C.archetype(keys.style) : null, wOf = (p) => { const e = a && a.weights ? (a.weights[p.key] != null ? a.weights[p.key] : a.weights[p.group]) : null; return Array.isArray(e) ? e[0] : e || 0; };
    const dr = f === 'pmc' ? ps.filter(p => (p.rules || []).includes('Drone unit')) : [];
    const perKey = {}; dr.forEach(p => { perKey[p.key] = (perKey[p.key] || 0) + 1; });
    const drones = dr.filter(p => !wOf(p)).length + Object.keys(perKey).filter(k => perKey[k] > pl).length;
    if (count('Anti-aircraft') > 1 || count('Jammers') > 1 || count('Field Medics') > 1 || drones) {
      over.push(f + ' T' + t + ' PL' + pl + ': AA ' + count('Anti-aircraft') + ', EW ' + count('Jammers') + ', medic ' + count('Field Medics') + ', drones ' + drones);
    }
  }
}
ok(n + ' rolled forces: PMC drones only where weighted (one a PL), at most one anti-air, one EW and one medic unit', over.length === 0, over.slice(0, 3).join(' | '));
ok('...and every one a legal army', illegal.length === 0, illegal.slice(0, 5).join(', '));

console.log('\n  ' + (checks - bad) + ' checks passed, ' + bad + ' failed.');
process.exit(bad ? 1 : 0);
