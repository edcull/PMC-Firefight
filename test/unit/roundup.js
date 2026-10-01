/* "If any number should be divided, it is always rounded up to a whole number"
   (p. 27) — the rounding sweep of the rules review at 7dd7306 (M-6): every place
   the game halves, quarters or takes a share of something rounds up. */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, got, want) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(62) + String(got).padEnd(8) + (good ? '' : '(expected ' + want + ')'));
}
function ctx(co) {
  return { entry: C.newEntry('regular'), company: co, won: true, lost: false,
    ownTier: 1, enemyTier: 1, routed: false, consecutive: false, halveTP: false };
}
function tpOf(start, end, co) {
  return C.tpFor({ startSize: start, endSize: end }, ctx(co || C.newCompany('a'))).total;
}

console.log('\nTrauma Points: "from one to half" +1, "more than half" +4 (p. 86)');
ok('3 men who lose 2 have lost half (2 of 3), not more: +1', tpOf(3, 1), 1);
ok('3 men who lose all 3 have lost more than half: +4', tpOf(3, 0), 4);
ok('5 men who lose 3 have lost half (3 of 5): +1', tpOf(5, 2), 1);
ok('5 men who lose 4: +4', tpOf(5, 1), 4);
ok('10 men who lose 5: +1', tpOf(10, 5), 1);
ok('10 men who lose 6: +4', tpOf(10, 4), 4);

console.log('\nSwapping units before the battle: ¼, or ½ with Tactical Flexibility (pp. 47, 89)');
ok('3 units may swap 1', R.swapAllowance(3, false), 1);
ok('6 units may swap 2', R.swapAllowance(6, false), 2);
ok('8 units may swap 2', R.swapAllowance(8, false), 2);
ok('5 units with Tactical Flexibility may swap 3', R.swapAllowance(5, true), 3);

console.log('\nRob the Rich, Give to the Poor: 75% of the Influence Points (p. 112)');
(function () {
  // payments are dice: run until one comes out where rounding matters
  var seen = false, right = true;
  for (var i = 0; i < 200; i++) {
    var a = C.newCompany('a', { faction: 'rebel' }); a.doctrines = ['H5'];
    var p = C.payment(3, 1, a, C.newCompany('b', { faction: 'rebel' }), 'A');
    if (!p.thin.A) continue;
    if (p.thin.A.was % 4) seen = true;
    if (p.A !== Math.ceil(p.thin.A.was * 0.75)) right = false;
  }
  ok('75% of the pay, rounded up (6 is 5, not 4)', right && seen, true);
})();

console.log('\nPropulsion (Appendix 3): tracked ¾ Movement, anti-grav +¼');
function moveWith(key, prop) { return R.applyPropulsion(JSON.parse(JSON.stringify(R.profile(key))), prop).move; }
ok('a tracked Move 10 is 8, not 7.5', moveWith('lcv', 'tracked'), 8);
ok('an anti-grav Move 10 is 13, not 12.5', moveWith('lcv', 'grav'), 13);
ok('a tracked Move 14 is 11, not 10.5', moveWith('lhunter', 'tracked'), 11);
ok('an anti-grav Move 14 is 18, not 17.5', moveWith('lhunter', 'grav'), 18);

console.log('\nRiders upgrade: "Size halved" (p. 97)');
(function () {
  var u = JSON.parse(JSON.stringify(R.profile('rfanatics')));
  u.size = 5; u.models = 5;                      // an odd Size, as a campaign entry may carry
  ok('Size 5 halved is 3', R.applyRiders(u, true).size, 3);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
