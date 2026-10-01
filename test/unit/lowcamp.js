/* The Low findings on the campaign (the rules review at 7dd7306, L-42, L-43). */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(what, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + what + (note ? '  — ' + note : ''));
}

console.log('\nL-42 No Place for the Weak! counts a safe landing’s 5 TP (p. 86)');
(function () {
  var camp = C.newCampaign({ mode: 'solo', nameA: 'Ironhold' });
  var co = camp.companies.A;
  C.found(co, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.foundRival(camp.companies.B, 'swarm');
  co.kUC = 100;
  var air = C.recruit(co, 'adaptedcraft').entry;
  var troops = co.roster.filter(function (e) { return e.key === 'rookie'; })[0], p2 = R.profile(troops.key);
  var seenSaved = 0, agree = 0, five = 0;
  for (var n = 0; n < 60; n++) {
    var c2 = JSON.parse(JSON.stringify(camp));
    var rep = {
      winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false },
      units: [
        { rid: air.rid, side: 'A', key: air.key, tier: 2, startSize: 1, endSize: 0, destroyed: true, wiped: false, fled: false, brokenEver: false, kills: [] },
        { rid: troops.rid, side: 'A', key: troops.key, tier: p2.tier, startSize: p2.size, endSize: 0, wiped: true, fled: false, destroyed: false,
          brokenEver: false, aboardDowned: true, lostAboard: air.rid, kills: [] }
      ]
    };
    // as the No Place for the Weak! step does it: the salvage dice, then the Trauma Points
    var sv = C.salvageRolls(c2, rep, 'A');
    var tp = C.rollTP(c2, rep, 'A');
    if (!sv[air.rid].saved) continue;
    seenSaved++;
    if (tp[troops.rid].total === 5) five++;
    var res = C.aftermath(c2, rep, { salvage: { A: sv }, tp: { A: tp } });
    var u = res.sides.A.units.filter(function (x) { return x.rid === troops.rid; })[0];
    if (u && u.aircraftSaved) agree++;
  }
  ok('passengers of an aircraft that landed take the 5 TP, not a casualty’s', seenSaved > 0 && five === seenSaved, five + ' of ' + seenSaved);
  ok('...and the aftermath uses the same landing roll', agree === seenSaved, agree + ' of ' + seenSaved);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
