/* Solitaire and cooperative play (pp. 146-156): the commando and OpFor tables,
   and the six scenarios registered alongside the competitive ones. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/scenarios.js');
require('../../src/rules/solitaire.js');
var R = global.PMC, S = global.PMCSolo, SC = global.PMCScen;

var pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name.padEnd(62) + (note || ''));
}
function head(t) { console.log('\n' + t); }

head('The commando table (p. 147)');
ok('Battle Tier III is 12 points, 15 for a Rebel force', S.COMMANDO[3].points[0] === 12 && S.COMMANDO[3].points[1] === 15);
var allLegal = true, why = '';
[1, 2, 3, 4, 5].forEach(function (bt) {
  ['pmc', 'rebel'].forEach(function (f) {
    [1, 2].forEach(function (pl) {
      for (var i = 0; i < 12; i++) {
        var k = S.rollCommando(bt, pl, f), c = S.checkCommando(k, bt, pl, f);
        if (!c.ok) { allLegal = false; why = bt + '/' + f + '/' + pl + ': ' + c.faults.join(' '); }
      }
    });
  });
});
ok('every rolled commando is legal, every Tier, both lists, PL 1-2', allLegal, why);
ok('a Command Unit has no place in a commando', !S.checkCommando(['cmd2', 'regular', 'regular'], 3, 1, 'pmc').ok);
ok('one vehicle a Priority Level', !S.checkCommando(['regular', 'lcv', 'lcv'], 3, 1, 'pmc').ok &&
  S.checkCommando(['regular', 'lcv:tracked', 'regular'], 3, 1, 'pmc').faults.every(function (f) { return !/vehicle/.test(f); }));
ok('no vehicle above the Battle Tier', S.checkCommando(['regular', 'mcv'], 3, 1, 'pmc').faults.some(function (f) { return /above the Battle Tier/.test(f); }));
ok('over the budget is refused', !S.checkCommando(['veterans', 'veterans', 'veterans', 'regular'], 3, 1, 'pmc').ok);

head('The OpFor pool (p. 148)');
var opOK = true, opWhy = '';
[1, 2, 3, 4, 5].forEach(function (bt) {
  for (var i = 0; i < 20; i++) {
    var k = S.rollOpFor(bt, 1, i % 2 ? 'rebel' : 'pmc', false), spent = 0, counts = [0, 0, 0, 0, 0, 0];
    k.forEach(function (e) { var p = R.profile(R.splitPick(e).key); spent += p.tier; counts[p.tier]++; if (p.command) { opOK = false; opWhy = 'a command unit'; } });
    if (spent > S.OPFOR[bt].points) { opOK = false; opWhy = 'over points at BT ' + bt; }
    for (var t = 1; t <= 5; t++) {
      var lim = S.OPFOR[bt].limits[t - 1];
      if (counts[t] > (lim[1] === 99 ? 99 : lim[1])) { opOK = false; opWhy = 'Tier ' + t + ' over at BT ' + bt; }
    }
  }
});
ok('the pool keeps to the OpFor table', opOK, opWhy);
var answers = true;
for (var j = 0; j < 20; j++) {
  var pk = S.rollOpFor(3, 1, 'rebel', true);
  var any = pk.some(function (e) {
    var p = R.profile(R.splitPick(e).key);
    return (p.rules || []).some(function (r) { return /^Anti-tank|^Anti-aircraft/.test(r); }) || (p.cls !== 'infantry' && p.tier >= 3);
  });
  if (!any) answers = false;
}
ok('...and answers the players’ machines when they bring any', answers);

head('Six solitaire scenarios');
ok('all six are registered', S.ORDER.length === 6 && S.ORDER.every(function (id) { return SC.SCENARIOS[id] && SC.SCENARIOS[id].solo; }));
ok('...none of them in the competitive roll', S.ORDER.every(function (id) { return SC.ORDER.indexOf(id) < 0; }));
ok('...and none uses Battlefield Insertion', S.ORDER.every(function (id) { return SC.SCENARIOS[id].noInsertion; }));
ok('Protecting the VIP is aggressive, +3', SC.SCENARIOS.s_vip.behaviour().mod === 3);
ok('Decapitation is defensive, -1', SC.SCENARIOS.s_decap.behaviour({}, {}).mod === -1);
ok('...its leaders never move', SC.SCENARIOS.s_decap.noMove({}, { soloLeader: true }) === true);
ok('Evacuation is aggressive, +3', SC.SCENARIOS.s_evac.behaviour().mod === 3);
ok('the VIP scenario gives the players +2 on the hit table', SC.SCENARIOS.s_vip.hitMod({}, { side: 'A' }, { side: 'B' }) === 2);

head('A Decapitation leader can be pinned down but not broken');
var cu = { sp: 99, morale: 4, noBreak: true, rules: [], cls: 'infantry', models: 8, size: 8 };
ok('twenty SP on Morale 4 is only Suppressed', R.status(cu) === 'suppressed');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
