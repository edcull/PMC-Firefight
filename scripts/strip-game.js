/* Take out of game.js everything that now lives in engine.js.

   The other half of the split, run once alongside build-engine.js. It reads
   the same list of names, so the two cannot disagree about what moved, and it
   reports what the code left behind still calls — which is the list of things
   the view has to ask the engine for instead. */
'use strict';
const fs = require('fs');
const path = require('path');
const { index } = require('./index.js');

const ROOT = process.argv[2] || '.';
const OUT = process.argv[3] || path.join(ROOT, 'src', 'view', 'game.js');
const source = fs.readFileSync(path.join(ROOT, 'src', 'view', 'game.js'), 'utf8');
const { lines, fns } = index(source);

const MOVE = fs.readFileSync(path.join(__dirname, 'build-engine.js'), 'utf8')
  .match(/const MOVE = `([\s\S]*?)`/)[1].trim().split(/\s+/);

const drop = new Set();
MOVE.forEach((n) => {
  const f = fns.get(n);
  if (!f) { console.error('not in game.js: ' + n); return; }
  for (let i = f.top; i <= f.end; i++) drop.add(i);
});

/* Two blank lines where a function used to be reads as a mistake; one reads as
   a paragraph break, which is what it is. */
const kept = [];
lines.forEach((l, i) => {
  if (drop.has(i)) return;
  if (!l.trim() && kept.length && !kept[kept.length - 1].trim()) return;
  kept.push(l);
});
fs.writeFileSync(OUT, kept.join('\n'));

const text = kept.join('\n');
const moved = new Set(MOVE);
const calls = new Map();
const re = /(\.\s*)?\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
let m;
while ((m = re.exec(text))) {
  if (m[1]) continue;                      // a method on something else, not ours
  if (!moved.has(m[2])) continue;
  calls.set(m[2], (calls.get(m[2]) || 0) + 1);
}
console.error('game.js: ' + lines.length + ' -> ' + kept.length + ' lines');
console.error('\nthe view still calls, of what moved:');
[...calls.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([n, c]) => console.error('  ' + n + ' x' + c));
