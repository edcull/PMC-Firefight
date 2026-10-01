/* Seeded dice for a unit test, loaded before it by scripts/test.js (node -r): a
   test that rolls its own set-up then plays the same rolls every run, so a rare
   roll never decides whether it passes. A file that seeds Math.random itself
   simply replaces this. Set PMC_TEST_DICE=random to roll free. */
'use strict';
if (process.env.PMC_TEST_DICE !== 'random') {
  let s = (+process.env.PMC_TEST_DICE || 2670) >>> 0;
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
