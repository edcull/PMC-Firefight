/* Fitting the evaluation: how a position's features (planner.js planFeatures,
   recorded by evaldata.js) predict who wins. Logistic regression, as chess
   programs tune their evaluation against game results (Texel's method): the
   chance side A wins is the logistic of a weighted sum of its features, the weights
   those that best predict the results. Fitted on four battles in five, tested on
   the rest (whole battles kept together, so a battle's own positions do not
   test it), and set against a coin and against "whoever has more worth left".

     node scripts/balance/evalfit.js positions.jsonl [...] [--out weights.json] */
'use strict';
const fs = require('fs');
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outFile = outAt >= 0 ? args[outAt + 1] : null;
const files = args.filter((a, i) => a !== '--out' && (outAt < 0 || i !== outAt + 1));
const rows = [];
files.forEach((f) => fs.readFileSync(f, 'utf8').split('\n').forEach((l) => { if (l.trim()) rows.push(JSON.parse(l)); }));
if (!rows.length) { console.error('no positions'); process.exit(1); }
const NAMES = Object.keys(rows[0].f);

// whole battles to one side or the other: every fifth battle tests
const battles = Array.from(new Set(rows.map((r) => r.b)));
const testSet = new Set(battles.filter((b, i) => i % 5 === 4));
const train = rows.filter((r) => !testSet.has(r.b)), test = rows.filter((r) => testSet.has(r.b));

// each feature scaled by its spread in the training set, so the fit treats them alike
const mean = {}, sd = {};
NAMES.forEach((k) => {
  const v = train.map((r) => r.f[k]);
  mean[k] = v.reduce((a, b) => a + b, 0) / v.length;
  sd[k] = Math.sqrt(v.reduce((a, b) => a + (b - mean[k]) ** 2, 0) / v.length) || 1;
});
const x = (r) => NAMES.map((k) => (r.f[k] - mean[k]) / sd[k]);
const sig = (z) => 1 / (1 + Math.exp(-z));

// gradient descent on the log loss, a little L2 to keep the weights sensible
let w = NAMES.map(() => 0), b = 0;
const lr = 0.1, l2 = 0.001, X = train.map(x);
for (let it = 0; it < 3000; it++) {
  const gw = w.map(() => 0); let gb = 0;
  for (let i = 0; i < train.length; i++) {
    const p = sig(b + X[i].reduce((a, v, j) => a + v * w[j], 0)), e = p - train[i].y;
    gb += e; for (let j = 0; j < w.length; j++) gw[j] += e * X[i][j];
  }
  b -= lr * gb / train.length;
  w = w.map((wj, j) => wj - lr * (gw[j] / train.length + l2 * wj));
}
const predict = (r) => sig(b + x(r).reduce((a, v, j) => a + v * w[j], 0));

// how well it does: log loss and accuracy (decided battles only), by how far into the battle
function score(set, p) {
  let ll = 0, ok = 0, n = 0;
  set.forEach((r) => {
    const q = Math.min(1 - 1e-6, Math.max(1e-6, p(r)));
    ll += -(r.y * Math.log(q) + (1 - r.y) * Math.log(1 - q));
    // (a call of even chances is half right)
    if (r.y !== 0.5) { n++; ok += q === 0.5 ? 0.5 : (q > 0.5) === (r.y === 1) ? 1 : 0; }
  });
  return { logloss: (ll / set.length).toFixed(3), accuracy: n ? (100 * ok / n).toFixed(1) + '%' : '-', positions: set.length };
}
const coin = () => 0.5, more = (r) => (r.f.worth > 0 ? 0.75 : r.f.worth < 0 ? 0.25 : 0.5);
console.log(rows.length + ' positions from ' + battles.length + ' battles (' + train.length + ' to fit, ' + test.length + ' to test)\n');
console.log('Tested on the battles it never saw:');
console.log('  the fitted evaluation  ', JSON.stringify(score(test, predict)));
console.log('  "more worth left wins" ', JSON.stringify(score(test, more)));
console.log('  a coin                 ', JSON.stringify(score(test, coin)));
console.log('\nBy how far into the battle (fitted, tested):');
[[1, 1], [2, 2], [3, 4], [5, 7], [8, 99]].forEach(([a, z]) => {
  const s = test.filter((r) => r.turn >= a && r.turn <= z);
  if (s.length) console.log('  turn ' + String(a === z ? a : a + '-' + (z === 99 ? '' : z)).padEnd(6) + JSON.stringify(score(s, predict)));
});
console.log('\nWeights (per unit of each feature, as the planner computes them):');
const raw = {};
NAMES.forEach((k, j) => { raw[k] = w[j] / sd[k]; console.log('  ' + k.padEnd(11) + raw[k].toFixed(3).padStart(8) + '   (scaled ' + w[j].toFixed(3) + ')'); });
const bias = b - NAMES.reduce((a, k, j) => a + w[j] * mean[k] / sd[k], 0);
console.log('  ' + 'bias'.padEnd(11) + bias.toFixed(3).padStart(8));
if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify({ weights: raw, bias: bias, fitted: new Date().toISOString().slice(0, 10), positions: rows.length, battles: battles.length, test: score(test, predict) }, null, 2) + '\n');
  console.log('\nwritten to ' + outFile);
}
