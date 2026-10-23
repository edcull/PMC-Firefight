/* The story's people as pixel-art faces (src/view/story-portraits.js): every
   person a story names has a face, drawn as a 32 x 32 head and shoulders with a
   black edge round it, each different from the rest, and every event's `who`
   one of them. */
'use strict';
const S = require('../../src/story/story.js');
require('../../src/story/deep-contract.js');
const P = require('../../src/view/story-portraits.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const dc = S.get('deep-contract'), people = dc.people;

console.log('\nThe faces');
const ids = Object.keys(people);
ok('every person in the story has a face', ids.length >= 8 && ids.every((k) => people[k].face && people[k].name), ids.join(', '));
const grids = ids.map((k) => P.pixels(people[k].face));
ok('each is a 32 x 32 grid of colours', grids.every((g) => g.length === 32 && g.every((r) => r.length === 32 && r.every((c) => /^#[0-9a-f]{3,6}$/i.test(c)))));
ok('...a figure on its background, a black edge traced round it', grids.every((g, i) => {
  const bg = people[ids[i]].face.bg, flat = [].concat(...g);
  return flat.filter((c) => c === bg).length > 150 && flat.filter((c) => c === '#0d0c10').length > 40 && flat.filter((c) => c !== bg && c !== '#0d0c10').length > 250;
}));
const sigs = grids.map((g) => g.map((r) => r.join('')).join('|'));
ok('no two alike', new Set(sigs).size === sigs.length);
ok('the same face every time it is drawn', P.pixels(people.varga.face).map((r) => r.join('')).join('|') === sigs[ids.indexOf('varga')]);
const svg = P.svg(people.okonkwo.face, 64);
ok('drawn as an SVG of square pixels, crisp at any size', /^<svg class="story-portrait" width="64" height="64" viewBox="0 0 32 32" shape-rendering="crispEdges"/.test(svg) && (svg.match(/<rect /g) || []).length > 100);

console.log('\nWho the events are about');
const nodes = Object.keys(dc._nodes).map((k) => dc._nodes[k]);
const named = nodes.filter((n) => n.who);
ok('events name who they are about, each one of the story’s people', named.length >= 40 && named.every((n) => people[n.who]), named.length + ' events');
// (the voices heard only in battle speak there: deep-contract-talk.js)
const talkers = [];
[dc.talk.sides, dc.talk.battles].forEach((g) => Object.keys(g).forEach((k) => Object.keys(g[k]).forEach((m) => g[k][m].forEach((l) => talkers.push(l.who)))));
Object.keys(dc.talk.allies).forEach((k) => talkers.push(dc.talk.allies[k].who));
ok('...and every person is in at least one, or speaks in a battle', ids.every((k) => named.some((n) => n.who === k) || talkers.indexOf(k) >= 0));

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
