/* The forces on the world that you did not fight this turn fought somebody
   else — each other, or the locals — on paper, through the same aftermath as
   a battle on the table: experience, trauma, losses and the pay. Run a long
   campaign and see that it moves them along and never leaves one illegal. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
require('../../src/rules/scenarios.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

var camp = C.newCampaign({ mode: 'solo', nameA: 'Ironhold' });
C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
C.foundRivals(camp, 4);
var rivals = camp.rivals.slice();
var firstExp = rivals.map(function (co) { return co.roster.reduce(function (n, e) { return n + e.exp; }, 0); });
var seen = { elsewhere: 0, vs: 0, results: {}, fell: 0, gone: 0, errors: [] };

for (var t = 0; t < 30; t++) {
  var A = camp.companies.A, B = camp.companies.B;
  var units = [];
  [['A', A], ['B', B]].forEach(function (pair) {
    pair[1].roster.slice(0, 6).forEach(function (e) {
      var p = R.profile(e.key);
      units.push({ rid: e.rid, side: pair[0], key: e.key, tier: p.tier, startSize: p.size, endSize: p.size,
        destroyed: false, wiped: false, fled: false, men: [], kills: [] });
    });
  });
  var out;
  try {
    out = C.aftermath(camp, { winner: Math.random() < 0.5 ? 'A' : 'B', battleTier: 1, pl: 1, scenario: 'secure',
      routed: { A: false, B: false }, units: units, casualties: [] });
  } catch (e) { seen.errors.push(e.stack.split('\n').slice(0, 3).join(' / ')); break; }
  (out.elsewhere || []).forEach(function (e) {
    seen.elsewhere++;
    if (e.vs) seen.vs++;
    seen.results[e.result] = (seen.results[e.result] || 0) + 1;
    seen.fell += e.fell; seen.gone += e.gone.length;
  });
  C.developRival(camp.companies.B);
  C.drawRival(camp);
}

ok('no errors across thirty turns', !seen.errors.length, seen.errors.join(' | '));
ok('the forces you did not fight fought somebody', seen.elsewhere >= 30 * 2, seen.elsewhere + ' battles elsewhere');
ok('...every one against someone by name', seen.vs === seen.elsewhere);
ok('...won, lost and drawn among them', !!(seen.results.won && seen.results.lost), JSON.stringify(seen.results));
ok('...with soldiers lost, and now and then a unit gone', seen.fell > 0 && seen.gone > 0, seen.fell + ' fell, ' + seen.gone + ' units gone');
ok('they gained experience on the way', rivals.some(function (co, i) {
  return co.roster.reduce(function (n, e) { return n + e.exp; }, 0) !== firstExp[i] || co.tier > 1;
}));
ok('...and carry trauma from it', rivals.some(function (co) { return co.roster.some(function (e) { return e.tp > 0 || e.traumas.length; }); }));
ok('...and have a record and a memorial', rivals.every(function (co) { return co.record.battles > 0; }) &&
  rivals.some(function (co) { return (co.memorial || []).length > 0; }));
ok('every force can still field a legal army at Tier I', rivals.every(function (co) { return C.rebuildNeeds(co).indexOf(1) < 0; }),
  rivals.map(function (co) { return co.name + ' ' + C.rebuildNeeds(co).join(','); }).join('; '));

console.log('  ' + rivals.map(function (co) { return co.name + ' T' + co.tier + ' ' + co.roster.length + 'u ' + co.kUC + 'k ' + co.record.wins + '/' + co.record.battles; }).join('; '));
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
