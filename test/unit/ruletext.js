/* Every special rule on every profile has a line for its tooltip.

   The rules are gathered from all four factions' lists as they stand, so a
   profile added later with a rule nobody has written up fails here rather than
   showing an empty tooltip. A rule that carries a number reads with that
   number in it, and never with the {X} placeholder left behind. */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/ruletext.js');
var R = global.PMC, T = global.PMCRuleText;

var pass = 0, fail = 0;
function ok(what, got, want, note) {
  if (got === want) { pass++; console.log('  ✓ ' + what + (note ? '  (' + note + ')' : '')); }
  else { fail++; console.log('  ✗ ' + what + ' — got ' + got + ', wanted ' + want + (note ? '  (' + note + ')' : '')); }
}

var seen = {};
['pmc', 'rebel', 'bugs', 'xeno'].forEach(function (f) {
  R.listFor(f).forEach(function (p) {
    (p.rules || []).forEach(function (r) { seen[r] = true; });
  });
});
var rules = Object.keys(seen).sort();

console.log('\nEvery rule has a line (' + rules.length + ' distinct)');
ok('the four lists carry some rules', rules.length > 0, true);
rules.forEach(function (r) {
  var d = T.describe(r);
  ok(r, d.name === r && d.text.length > 0, true, d.text ? '' : 'no text');
});

console.log('\nNumbered rules read with their number');
rules.filter(function (r) { return /\(\d+\)\s*$/.test(r); }).forEach(function (r) {
  var n = r.match(/\((\d+)\)\s*$/)[1], text = T.describe(r).text;
  ok(r + ' has no {X} left', text.indexOf('{X}') < 0, true);
  ok(r + ' mentions ' + n, text.indexOf(n) >= 0, true);
});
ok('Command Unit (2) says 2', /\b2\b/.test(T.describe('Command Unit (2)').text), true);
ok('Transport (4) says 4', /\b4\b/.test(T.describe('Transport (4)').text), true);

console.log('\nThe edges');
ok('an unknown rule comes back empty', T.describe('Not A Rule').text, '');
ok('...under its own name', T.describe('Not A Rule').name, 'Not A Rule');
ok('a named variant is found exactly', T.describe('Anti-tank (limited)').text === T.TEXT['Anti-tank (limited)'], true);
ok('no entry leaves a stray placeholder outside "(X)" rules',
  Object.keys(T.TEXT).filter(function (k) { return !/\(X\)$/.test(k) && T.TEXT[k].indexOf('{X}') >= 0; }).join(', '), '');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
