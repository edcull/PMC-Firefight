/* The other forces' battles, fought out: the world always has an even number
   of forces, the aftermath hands their pairings back when asked to, and a
   battle between two rivals is played through by the engine to a report that
   the campaign settles like any other. */
'use strict';
const { C } = require('../../server/rules.js');
const OT = global.PMCOffTable;

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

console.log('\nAn even world');
const solo = C.newCampaign({ mode: 'solo' });
C.found(solo.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
C.foundRivals(solo); C.evenWorld(solo); C.faceRival(solo, 0);
ok('solo: the player and the rivals make an even number', (1 + solo.rivals.length) % 2 === 0, solo.rivals.length + ' rivals');
ok('...and asking again adds nobody', C.evenWorld(solo) === null);
const hs = C.newCampaign({ mode: 'hotseat' });
C.foundRivals(hs); C.evenWorld(hs);
ok('hotseat: two players and an even number of rivals', hs.rivals.length % 2 === 0, hs.rivals.length + ' rivals');
ok('...every rival its own name', new Set(hs.rivals.map(r => r.name)).size === hs.rivals.length);

console.log('\nPairing off');
const pairs = C.elsewherePairs(solo, solo.companies.B);
ok('the rivals not facing the player all pair off, none left over',
  pairs.length * 2 === solo.rivals.length - 1 && pairs.every(p => p[1] != null), JSON.stringify(pairs));
ok('...and the one facing the player is not among them', pairs.every(p => p.indexOf(solo.facing) < 0));

console.log('\nA battle nobody watches');
const x = solo.rivals[pairs[0][0]], y = solo.rivals[pairs[0][1]];
ok('each side can field a legal force', C.pickForce(x, 1, 1, null).length > 0 && C.pickForce(y, 1, 1, null).length > 0);
let rep = null;
for (let i = 0; i < 3 && !rep; i++) rep = OT.playNow(x, y, {});
ok('it is played to the end and hands back a report', !!rep && Array.isArray(rep.units) && rep.units.length > 0,
  rep ? rep.scenario + ', ' + rep.turns + ' turns, winner ' + (rep.winner || 'none') : 'no report');
ok('...with each unit known by its place on the roster',
  !!rep && rep.units.every(u => (u.side === 'A' ? x : y).roster.some(e => e.rid === u.rid)));
const sums = C.battleElsewhere(solo, x, y, rep);
ok('both forces come out of it with a summary', sums.length === 2 && sums[0].name === x.name && sums[1].name === y.name);
ok('...which tells the battle unit by unit', sums[0].battle && !sums[0].battle.paper && sums[0].battle.sides.every(s => s.units.length > 0));
ok('...and the result agrees with the report', sums[0].result === (rep.winner === 'A' ? 'won' : rep.winner ? 'lost' : 'drew'));

console.log('\nThe aftermath, deferred');
let mine = null;
for (let i = 0; i < 3 && !mine; i++) mine = OT.playNow(solo.companies.A, solo.companies.B, {});
const out = C.aftermath(solo, mine, { defer: true });
ok('asked to wait, it hands the pairings back unfought', Array.isArray(out.pairs) && out.pairs.length === pairs.length && out.elsewhere.length === 0);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
