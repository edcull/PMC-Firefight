/* The aistats.js runs added up and set side by side: the choosing AI and the
   behaviour table, per battle (and per shot, per charge, per activation where that
   says more).

     node scripts/balance/aistats-report.js run1.json run2.json ... */
'use strict';
const fs = require('fs');
const files = process.argv.slice(2);
const sum = { chose: null, rolled: null, errs: 0 };
function add(a, b) {
  if (!a) return JSON.parse(JSON.stringify(b));
  Object.keys(b).forEach((k) => {
    if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k];
    else { a[k] = a[k] || {}; Object.keys(b[k]).forEach((g) => { a[k][g] = (a[k][g] || 0) + b[k][g]; }); }
  });
  return a;
}
files.forEach((f) => {
  const d = JSON.parse(fs.readFileSync(f, 'utf8').trim().split('\n').pop());
  sum.chose = add(sum.chose, d.chose); sum.rolled = add(sum.rolled, d.rolled); sum.errs += d.errs;
});
const C = sum.chose, Rl = sum.rolled, n = C.battles;
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), f2 = (x) => (Math.round(x * 100) / 100).toFixed(2), pc = (x) => Math.round(100 * x) + '%';
const rows = [];
const row = (name, fn, fmt) => rows.push([name, (fmt || f1)(fn(C)), (fmt || f1)(fn(Rl))]);
row('wins (draws half)', (t) => (t.wins + t.draws / 2) / t.battles, pc);
row('battle length, turns', (t) => t.turns / t.battles);
row('activations / battle', (t) => t.activations / t.battles);
['assault', 'offensive', 'neutral', 'defensive', 'flee'].forEach((b) => row('  decided ' + b, (t) => (t.decide[b] || 0) / Math.max(1, t.activations), pc));
row('held position / battle', (t) => t.holds / t.battles);
row('  ...and did not shoot', (t) => t.holdNoShot / t.battles);
row('moves / battle', (t) => t.moves / t.battles);
row('  inches a move', (t) => t.inches / Math.max(1, t.moves));
row('shots / battle', (t) => t.shots / t.battles);
row('  stationary (Fire!)', (t) => t.shotsStill / Math.max(1, t.shots), pc);
row('  within half range', (t) => t.shotsHalf / Math.max(1, t.shots), pc);
row('  auxiliary only (pinned)', (t) => t.shotsAux / Math.max(1, t.shots), pc);
row('  range, inches', (t) => t.shotDist / Math.max(1, t.shots));
row('  hits a shot', (t) => t.hits / Math.max(1, t.shots), f2);
row('  no hit at all', (t) => t.zeroHit / Math.max(1, t.shots), pc);
row('SP inflicted / battle', (t) => t.sp / t.battles);
row('men killed / battle', (t) => t.men / t.battles);
row('hull damage dealt / battle', (t) => t.machineDmg / t.battles);
row('charges / battle', (t) => t.charges / t.battles, f2);
row('  Death or Glory (forced)', (t) => (t.chargeDog || 0) / Math.max(1, t.charges), pc);
row('  stopped by defensive fire', (t) => (t.chargeStopped || 0) / Math.max(1, t.charges), pc);
row('  won (defender broken/out/back)', (t) => t.chargeWon / Math.max(1, t.charges), pc);
row('  lost (attacker broken/out)', (t) => t.chargeLost / Math.max(1, t.charges), pc);
row('regroups / battle', (t) => t.regroups / t.battles);
row('SP rallied off / battle', (t) => t.rallied / t.battles);
row('times Suppressed / battle', (t) => t.suppressedTaken / t.battles);
row('times Broken / battle', (t) => t.brokenTaken / t.battles);
row('units lost / battle', (t) => t.unitsLost / t.battles);
[1, 2, 3, 4, 5, 6].forEach((tn) => row('  lost in turn ' + tn, (t) => (t.lostByTurn[tn] || 0) / t.battles, f2));
row('  lost after turn 6', (t) => Object.keys(t.lostByTurn).filter((k) => +k > 6).reduce((a, k) => a + t.lostByTurn[k], 0) / t.battles, f2);
const w = [Math.max(...rows.map((r) => r[0].length)), 8, 8];
console.log(n + ' battles a side, ' + sum.errs + ' errors\n');
console.log('metric'.padEnd(w[0]) + '  ' + 'chose'.padStart(w[1]) + '  ' + 'rolled'.padStart(w[2]));
rows.forEach((r) => console.log(r[0].padEnd(w[0]) + '  ' + r[1].padStart(w[1]) + '  ' + r[2].padStart(w[2])));
