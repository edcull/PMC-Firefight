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
// a hotseat world is the two players and nobody else (hotseat review HC-3)
const hs = C.newCampaign({ mode: 'hotseat' });
hs.companies.B = C.newCompany('Player 2', { faction: 'rebel' }); hs.rivals = [hs.companies.B]; hs.facing = 0;
ok('hotseat: no AI force is added to the two players', C.evenWorld(hs) === null && hs.rivals.length === 1, hs.rivals.length + '');
ok('...and nobody fights elsewhere', C.elsewherePairs(hs, hs.companies.B).length === 0);
// a save from before, which picked up a phantom AI force on a reload: it is dropped, Player 2 kept
const old = JSON.parse(JSON.stringify(C.forSave(hs)));
old.rivals.push(C.newCompany('Rival 2', { faction: 'pmc' }));
const back = C.rehydrate(old);
ok('...a saved hotseat campaign with a phantom force loses it on loading', back.rivals.length === 1 && back.companies.B.name === 'Player 2', back.rivals.map(r => r.name).join(','));

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
  // (a free unit for the battle alone, such as the Complex Teleport Network's turrets, is on no roster, and says so)
  !!rep && rep.units.every(u => u.free || (u.side === 'A' ? x : y).roster.some(e => e.rid === u.rid)));
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
