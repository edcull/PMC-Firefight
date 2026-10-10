/* A report (PDF, and the HTML beside it) on the worlds in a directory (see README.md).

     node scripts/balance/report.js <dir> <out.pdf> [previous-dir]

   Worlds of all 24 personalities get the all-faction report; one faction's six get the
   one-faction report. With a previous directory, a "what changed" section compares the
   two (PREV_NOTE, if set, says what the change was). */
'use strict';
const fs = require('fs');
const path = require('path');

const [dir, out, prev] = process.argv.slice(2);
if (!dir || !out) { console.error('usage: node scripts/balance/report.js <dir> <out.pdf> [previous-dir]'); process.exit(2); }
const first = fs.readdirSync(dir).filter((f) => /^run\d+\.json$/.test(f))[0];
if (!first) { console.error('no run*.json worlds in ' + dir); process.exit(1); }
const faction = JSON.parse(fs.readFileSync(path.join(dir, first))).faction || 'all';
process.env.DIR = dir; process.env.OUT = out;
if (prev) process.env.PREV = prev;
if (faction === 'all') require('./report-all.js');
else { process.env.FACTION = faction; require('./report-faction.js'); }
