/* Run many simulated campaign worlds in parallel (see README.md here).

     node scripts/balance/run.js <dir> [campaigns=32] [workers=4] [turns=24]

   Each world is written to <dir>/run<N>.json by world.js; FACTION, SCEN, OVERRIDE and
   STACK are passed through to it. Worlds already in <dir> are kept and skipped, so a
   run that was stopped carries on where it left off. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = process.argv[2];
const N = +process.argv[3] || 32, WORKERS = +process.argv[4] || 4, TURNS = +process.argv[5] || 24;
if (!DIR) { console.error('usage: node scripts/balance/run.js <dir> [campaigns] [workers] [turns]'); process.exit(2); }
fs.mkdirSync(DIR, { recursive: true });
const todo = [];
for (let r = 1; r <= N; r++) if (!fs.existsSync(path.join(DIR, 'run' + r + '.json'))) todo.push(r);
console.log(todo.length + ' of ' + N + ' worlds to run, ' + WORKERS + ' at a time, into ' + DIR);
let done = N - todo.length, errors = 0;
const t0 = Date.now();
function next() {
  const r = todo.shift();
  if (r == null) return null;
  return new Promise((resolve) => {
    const out = path.join(DIR, 'run' + r + '.json');
    const p = spawn(process.execPath, [path.join(__dirname, 'world.js'), String(r), out, String(TURNS)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let said = '';
    p.stdout.on('data', (b) => { said += b; });
    p.on('close', (code) => {
      done++;
      if (code) errors++;
      const mins = ((Date.now() - t0) / 60000).toFixed(1);
      console.log('[' + done + '/' + N + ', ' + mins + ' min] ' + (code ? 'world ' + r + ' failed (exit ' + code + ')' : said.trim()));
      resolve();
    });
  }).then(next);
}
Promise.all(Array.from({ length: WORKERS }, next)).then(() => {
  console.log('done' + (errors ? ', ' + errors + ' worlds failed' : ''));
  process.exit(errors ? 1 : 0);
});
