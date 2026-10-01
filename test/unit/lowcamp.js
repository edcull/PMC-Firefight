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

console.log('\nL-43 A rival swarm grows Adaptations on its Overgrown bugs (p. 124)');
(function () {
  var grew = 0, n = 0;
  var og = R.listFor('bugs').filter(function (p) { return p.cls !== 'infantry' && (p.rules || []).indexOf('Overgrown Bug') >= 0; })[0];
  for (var i = 0; i < 20; i++) {
    var camp = C.newCampaign({ mode: 'solo' });
    C.foundRival(camp.companies.B, 'swarm');
    var co = camp.companies.B, e = C.newEntry(og.key);
    co.tier = 5; co.kUC = 500; e.exp = 40; co.roster.push(e);
    C.developRival(co);
    n++;
    if ((e.honours || []).length) grew++;
  }
  ok('an Overgrown bug with the experience for it grows an Adaptation', grew === n, grew + ' of ' + n);
})();

console.log('\nL-43 A rival prices its promotions with its own doctrines (pp. 112, 141)');
(function () {
  function rival(doc) {
    var camp = C.newCampaign({ mode: 'solo' });
    C.foundRival(camp.companies.B);
    var co = camp.companies.B;
    co.doctrines = [doc];
    return co;
  }
  // a promotion this company's doctrine makes cheaper, and its price with and without the company
  function cheaper(co, field) {
    for (var i = 0; i < co.roster.length; i++) {
      var e = co.roster[i], qs = C.promotionTargets(e, co);
      for (var j = 0; j < qs.length; j++) {
        var mine = C.promotionCost(e, qs[j].key, co), list = C.promotionCost(e, qs[j].key);
        if (mine[field] < list[field]) return { e: e, key: qs[j].key, mine: mine, list: list };
      }
    }
    return null;
  }
  var her = rival('XS4'), h = cheaper(her, 'exp');
  ok('Hermetic Society: a promotion at half the EXP is found', !!h);
  if (h) {
    h.e.exp = h.mine.exp; her.kUC = 999;
    ok('...and the rival takes it with only the half', C.rivalCanAfford(her, h.e, h.key), h.mine.exp + ' of ' + h.list.exp + ' EXP');
  }
  var smu = rival('V1'), m = cheaper(smu, 'kUC');
  ok('Smuggler: a promotion a point cheaper is found', !!m);
  if (m) {
    m.e.exp = 99; smu.kUC = m.mine.kUC;
    ok('...and the rival takes it with only the cheaper price in hand', C.rivalCanAfford(smu, m.e, m.key), m.mine.kUC + ' of ' + m.list.kUC);
  }
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
