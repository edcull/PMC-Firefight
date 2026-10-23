/* The story's places as pixel-art scenes (src/view/story-scenes.js): each a
   128 x 48 picture, the same each time it is drawn and different from the
   rest; every chapter's card, every battle's map and every ending has one. */
'use strict';
const S = require('../../src/story/story.js');
require('../../src/story/deep-contract.js');
const SS = require('../../src/view/story-scenes.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const dc = S.get('deep-contract'), maps = global.PMCStoryMaps['deep-contract'];

console.log('\nThe scenes');
const ids = Object.keys(SS.SCENES), sig = (g) => g.map((r) => r.join('')).join('|');
const grids = ids.map((k) => SS.pixels(k));
ok('fifteen places, each a 128 x 48 picture', ids.length >= 15 && grids.every((g) => g.length === 48 && g.every((r) => r.length === 128)), ids.join(', '));
ok('...of many colours, not a flat fill', grids.every((g) => new Set([].concat(...g)).size >= 10));
ok('the same picture each time it is drawn', ids.every((k, i) => sig(SS.pixels(k)) === sig(grids[i])));
ok('no two places alike', new Set(grids.map(sig)).size === ids.length);
ok('a place at another time of day is another picture', sig(SS.pixels('starport', 'night')) !== sig(SS.pixels('starport')) && sig(SS.pixels('starport', 'night')) === sig(SS.pixels('starport', 'night')));
ok('an unknown place draws nothing', SS.pixels('atlantis') === null && SS.html('atlantis') === '');
const svg = SS.svg('refinery');
ok('drawn as an SVG of pixels where there is no canvas (the tests, the server)', /^<svg class="story-scene" viewBox="0 0 128 48" shape-rendering="crispEdges"/.test(svg) && (svg.match(/<rect /g) || []).length > 500);

console.log('\nWhere they are shown');
const cards = dc.chapters.filter((c) => !c.shared && c.id !== 'end');
ok('every chapter’s card has its place', cards.every((c) => c.scene && SS.SCENES[c.scene.place]), cards.filter((c) => !c.scene).map((c) => c.id).join(', '));
ok('every battle’s map has its picture', Object.keys(maps).every((m) => SS.SCENES[m]), Object.keys(maps).filter((m) => !SS.SCENES[m]).join(', '));
ok('every ending has its picture', dc.endings.every((e) => e.scene && SS.SCENES[e.scene.place]));

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
