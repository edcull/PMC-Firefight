/* Where the player's units stood and where the computer's did, read out of the
   battles a campaign tracked turn by turn (its Debug tracking, set when it was
   raised; battletrack.js). Takes the file the server exports
   (node server/admin.js export-campaign <name> file.json, or the full dump of
   every campaign, admin.js campaigns) and sets the two sides
   side by side, per look at the table (each turn's, its activations done): how much of each
   is in cover and what ground, how close it keeps to its own and to the enemy,
   how near the objectives and how many it holds, how far it moves a turn and how
   much of it does not move at all. The deployment too: how wide, how deep.
   See README.md.

     node scripts/balance/tracks.js export.json [--battles] */
'use strict';
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/balance/tracks.js export.json [--battles]'); process.exit(1); }
const perBattle = process.argv.indexOf('--battles') >= 0;
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
function blank() {
  return { battles: 0, looks: 0, units: 0, cover: [], inCover: [], ground: {}, friend: [], enemy: [], objective: [], held: [],
    moved: [], still: [], depWidth: [], depDepth: [], depEnemy: [] };
}

// one battle's track added to the two sides' running figures; `who`: { A: 'player'|'ai', B: ... }
function read(track, who, S) {
  const T = track.table || {}, objs = T.objectives || [], turns = (track.turns || []).filter((t) => t.when === 'turn');
  const dep = (track.turns || []).filter((t) => t.when === 'deploy')[0];
  ['A', 'B'].forEach((s) => { S[who[s]].battles++; });
  turns.forEach((look, li) => {
    ['A', 'B'].forEach((s) => {
      const o = S[who[s]], mine = look.units.filter((u) => u.side === s), theirs = look.units.filter((u) => u.side !== s);
      if (!mine.length) return;
      o.looks++; o.units += mine.length;
      mine.forEach((u) => {
        o.cover.push(u.cover || 0); o.inCover.push(u.cover > 0 ? 1 : 0);
        o.ground[u.ground] = (o.ground[u.ground] || 0) + 1;
        const fr = mine.filter((v) => v !== u).map((v) => dist(u, v));
        if (fr.length) o.friend.push(Math.min(...fr));
        if (theirs.length) o.enemy.push(Math.min(...theirs.map((v) => dist(u, v))));
        if (objs.length) o.objective.push(Math.min(...objs.map((q) => dist(u, q))));
      });
      o.held.push((look.holders || []).filter((h) => h === s).length);
      // how far each moved since the last look (or its deployment), and how much of it did not
      const prev = li ? turns[li - 1] : dep;
      if (prev) mine.forEach((u) => {
        const v = prev.units.find((x) => x.id === u.id);
        if (!v) return;
        const d = dist(u, v);
        o.moved.push(d); o.still.push(d < 0.5 ? 1 : 0);
      });
    });
  });
  // the deployment: as it stood before anything moved (or, all of it coming on from an edge, the first turn's)
  const first = dep && ['A', 'B'].every((s) => dep.units.some((u) => u.side === s)) ? dep : turns[0];
  if (first) {
    ['A', 'B'].forEach((s) => {
      const o = S[who[s]], mine = first.units.filter((u) => u.side === s), theirs = first.units.filter((u) => u.side !== s);
      if (mine.length) {
        const xs = mine.map((u) => u.x), ys = mine.map((u) => u.y);
        o.depWidth.push(Math.max(...xs) - Math.min(...xs));
        o.depDepth.push(Math.max(...ys) - Math.min(...ys));
        if (theirs.length) o.depEnemy.push(mean(mine.map((u) => Math.min(...theirs.map((v) => dist(u, v))))));
      }
    });
  }
}

function rows(S) {
  const f1 = (x) => (isNaN(x) ? '-' : (Math.round(x * 10) / 10).toFixed(1)), pc = (x) => (isNaN(x) ? '-' : Math.round(100 * x) + '%');
  const out = [];
  const row = (name, fn, fmt) => out.push([name, (fmt || f1)(fn(S.player)), (fmt || f1)(fn(S.ai))]);
  row('battles tracked', (o) => o.battles);
  row('units on the table a turn', (o) => o.units / Math.max(1, o.looks));
  row('in cover', (o) => mean(o.inCover), pc);
  row('  cover, average', (o) => mean(o.cover));
  const kinds = Object.keys(Object.assign({}, S.player.ground, S.ai.ground)).sort();
  kinds.forEach((k) => row('  on ' + k, (o) => (o.ground[k] || 0) / Math.max(1, o.units), pc));
  row('nearest friend, inches', (o) => mean(o.friend));
  row('nearest enemy, inches', (o) => mean(o.enemy));
  row('nearest objective, inches', (o) => mean(o.objective));
  row('objectives held a turn', (o) => mean(o.held));
  row('moved a turn, inches', (o) => mean(o.moved));
  row('  units that stayed put', (o) => mean(o.still), pc);
  row('deployment width', (o) => mean(o.depWidth));
  row('deployment depth', (o) => mean(o.depDepth));
  row('deployed from the enemy', (o) => mean(o.depEnemy));
  return out;
}
function print(title, S) {
  const r = rows(S), w = Math.max(...r.map((x) => x[0].length));
  console.log(title + '\n');
  console.log('metric'.padEnd(w) + '  ' + 'player'.padStart(8) + '  ' + 'AI'.padStart(8));
  r.forEach((x) => console.log(x[0].padEnd(w) + '  ' + x[1].padStart(8) + '  ' + x[2].padStart(8)));
  console.log('');
}

const all = { player: blank(), ai: blank() };
let tracked = 0, untracked = 0;
// export-campaign lists each campaign's battles; the full dump (admin.js campaigns) has only its state, read the same way
const { battlesOf } = require('../../server/admin.js');
(data.campaigns || []).forEach((c) => {
  (c.battles || (c.state ? battlesOf(c.state) : [])).forEach((b) => {
    if (!b.track) { untracked++; return; }
    if (!b.vsAI) return;                           // a duel between players is no measure of the computer
    tracked++;
    // the campaign's line has the player as A
    const who = { A: 'player', B: 'ai' };
    read(b.track, who, all);
    if (perBattle) {
      const one = { player: blank(), ai: blank() };
      read(b.track, who, one);
      print((c.title || c.name) + ' — turn ' + b.turn + ', ' + (b.scenario || '?') + ' against ' + (b.against || '?') + ', ' + (b.winner === 'A' ? 'won' : b.winner === 'B' ? 'lost' : 'drawn'), one);
    }
  });
});
console.log(tracked + ' tracked battles against the computer (' + untracked + ' untracked)\n');
if (tracked) print('All tracked battles', all);
