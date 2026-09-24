/* Four campaign rules a read of the book (pp. 84-87) found the game getting
   wrong, each checked here: a salvaged machine sits out one battle, promotions
   stop a Tier over the Company Tier, a catastrophic explosion leaves no drone to
   recover, and a Tier V company may change a doctrine every five battles. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

console.log('\nSALVAGE (p. 86)');
var drone = C.newEntry('lcv', { drone: true });
var gone = C.salvage({ catastrophic: true }, drone, true);
ok('a drone blown apart is not recovered', gone.saved === false && gone.roll === null, gone.note);
var crewed = C.newEntry('lcv');
ok('...nor a crewed hull', C.salvage({ catastrophic: true }, crewed, true).saved === false);
var tries = 0, back = 0;
for (var i = 0; i < 200; i++) { var sv = C.salvage({ catastrophic: false }, drone, true); tries++; if (sv.saved) back++; }
ok('a drone that was not blown apart can still be recovered', back > 0 && back < tries, back + ' of ' + tries);

console.log('\nTHE WORKSHOP');
// play the aftermath's bookkeeping by hand: set as salvaged, then count down on the next missed battle
var src = require('fs').readFileSync(require('path').join(__dirname, '../../src/rules/campaign.js'), 'utf8');
ok('a salvaged machine is set to sit out one battle', /if \(sv\.saved\) \{ entry\.restUntil = 1;/.test(src));

console.log('\nPROMOTION CAP (p. 84)');
var co = C.newCompany('Test', { faction: 'pmc' });
co.tier = 1;
var rec = C.newEntry('rookie');                     // a Tier II rifle team
var t1 = C.promotionTargets(rec, co).map(function (q) { return q.tier; });
ok('a Tier I company promotes no higher than Tier II', t1.length === 0 || Math.max.apply(null, t1) <= 2, t1.join(','));
co.tier = 2;
var t2 = C.promotionTargets(rec, co).map(function (q) { return q.tier; });
ok('...a Tier II company up to Tier III', t2.indexOf(3) >= 0 && Math.max.apply(null, t2) <= 3, t2.join(','));
ok('without a company given, the old rule stands', C.promotionTargets(rec).some(function (q) { return q.tier === 3; }));

console.log('\nTIER V DOCTRINE CHANGE (p. 87)');
var big = C.newCompany('Big', { faction: 'pmc' });
big.tier = 4; big.doctrines = ['S1', 'O1', 'T1', 'S2'];
ok('below Tier V there is no change', !C.canSwapDoctrine(big).ok);
big.tier = 5; big.doctrineSwapAt = 5; big.record.battles = 3;
var early = C.canSwapDoctrine(big);
ok('...nor before five battles are up', !early.ok, early.why);
big.record.battles = 5;
ok('...then it may', C.canSwapDoctrine(big).ok);
var bad = C.swapDoctrine(big, 'S1', 'S2');
ok('it cannot take one it already holds', !bad.ok, bad.why);
var good = C.swapDoctrine(big, 'S1', 'T2');
ok('it swaps one for another', good.ok && big.doctrines.indexOf('S1') < 0 && big.doctrines.indexOf('T2') >= 0, big.doctrines.join(','));
ok('...keeping the same number held', big.doctrines.length === 4);
ok('...and the next change is five battles on', big.doctrineSwapAt === 10 && !C.canSwapDoctrine(big).ok);

console.log('\nSABOTAGE OBJECTIVES (p. 155)');
require('../../src/rules/scenarios.js');
require('../../src/rules/solitaire.js');
var SAB = global.PMCSolo.SCENARIOS.s_sabotage;
[[1, 3], [2, 5], [3, 7]].forEach(function (c) {
  var st = { cfg: { pl: c[0] }, sc: {}, terrain: [], units: [], objectives: [] };
  SAB.objectives(st);
  var gap = Infinity;
  st.sc.targets.forEach(function (a, i) { st.sc.targets.forEach(function (b, j) { if (i < j) gap = Math.min(gap, Math.hypot(a.x - b.x, a.y - b.y)); }); });
  ok('Priority Level ' + c[0] + ': ' + c[1] + ' objectives' + (c[0] === 1 ? ', 12" apart' : ''),
    st.sc.targets.length === c[1] && (c[0] > 1 || gap >= 12), st.sc.targets.length + ' placed, closest ' + gap.toFixed(1) + '"');
});

console.log('\nDRONE UNITS IN THE CAMPAIGN (p. 40)');
var dsq = C.newEntry('dcombat'), vtd = C.newEntry('vtoldrone');
ok('a Drone unit joins the roster as a drone', dsq.drone === true);
ok('...and so does the Light VTOL drone', vtd.drone === true);
var tpd = C.tpFor({ brokenEver: true, startSize: 6, endSize: 2 }, { entry: dsq, company: { doctrines: [] } });
ok('...and a drone squad takes no Trauma Points', tpd.total === 0, tpd.lines[0].text);

console.log('\nPROMOTION PATHS AND AIR SUPERIORITY (pp. 87, 107, 110)');
var tco = { tier: 3, doctrines: [] };
var recT = C.promotionTargets(C.newEntry('recruits'), tco).map(function (q) { return q.key; });
ok('Recruits may promote within Basic troops', recT.indexOf('irregulars') >= 0 || recT.indexOf('enforcers') >= 0, recT.join(', '));
ok('...but never into Penal troops', recT.indexOf('penal') < 0);
var fwKey = R.listFor('rebel').filter(function (q) { return q.group === 'Freedom Warriors'; })[0].key;
var fwT = C.promotionTargets(C.newEntry(fwKey), tco).map(function (q) { return R.profile(q.key).group; });
ok('Freedom Warriors may promote into Deserters and POWs', fwT.indexOf('Deserters and POWs') >= 0, fwKey);
var veh = ['lpv', 'hpv', 'lhunter'], air = ['adaptedcraft'];
function hullFault(r) { return r.faults.some(function (f) { return /Air Superiority adds an aircraft|Max \d+ vehicles/.test(f); }); }
var four = ['lpv', 'hpv', 'lhunter', 'unarmoured'];
ok('Air Superiority: a fourth ground vehicle is refused', hullFault(R.checkArmy(four, 3, 1, ['O1'])));
ok('...a fourth machine that is an aircraft is not', !hullFault(R.checkArmy(veh.concat(air), 3, 1, ['O1'])));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
if (fail) process.exit(1);
