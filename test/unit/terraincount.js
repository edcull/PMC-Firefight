/* How many pieces a rolled result puts down.

   Straight off the book's range (p. 47): a "1-6" can be one, every count is
   as likely as any other, an "up to" count may be none, and nothing ever goes
   over the top of its range. */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/gen.js');
var G = global.PMCGen;

var pass = 0, fail = 0;
function ok(what, got, want, note) {
  if (got === want) { pass++; console.log('  ✓ ' + what + (note ? '  (' + note + ')' : '')); }
  else { fail++; console.log('  ✗ ' + what + ' — got ' + got + ', wanted ' + want + (note ? '  (' + note + ')' : '')); }
}
/* A repeatable dice stream. Neighbouring seeds are spread apart and the first
   few draws thrown away: straight off a plain LCG, seeds 500 and 501 give
   nearly the same first roll, and a count test would only ever see one number. */
function seeded(s) {
  s = Math.imul(s ^ 0x9e3779b9, 2654435761) >>> 0;
  var f = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  f(); f(); f();
  return f;
}

// an empty quarter, so every piece asked for has room and the count is what was rolled
var area = { name: 'NW', x: 0, y: 0, w: 24, h: 24 };
function counts(spec, n) {
  var seen = {};
  for (var i = 0; i < n; i++) {
    var got = G.fillArea([spec], area, [], [], seeded(500 + i), 48, 48).length;
    seen[got] = (seen[got] || 0) + 1;
  }
  return seen;
}
function range(seen) {
  var ks = Object.keys(seen).map(Number);
  return [Math.min.apply(null, ks), Math.max.apply(null, ks)];
}

console.log('\nHow many go down');
var six = counts({ kind: 'rocks', min: 1, max: 6 }, 400);
ok('"1-6 rocks" can give a single rock, as the book rolls it', six[1] > 0, true, JSON.stringify(six));
ok('...every count about as likely as any other', Object.keys(six).every(function (k) { return six[k] > 40 && six[k] < 95; }), true);
ok('...and still reaches six', range(six)[1], 6);
var two = counts({ kind: 'woods', min: 1, max: 2 }, 200);
ok('"1-2 woods" gives one or two', range(two).join('-'), '1-2');
var one = counts({ kind: 'crater', min: 1, max: 1 }, 100);
ok('"a single crater" is still one', range(one).join('-'), '1-1');
var upTo = counts({ kind: 'barricade', min: 0, max: 4 }, 400);
ok('"up to 4 low walls" can still be none', upTo[0] > 0, true, JSON.stringify(upTo));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
