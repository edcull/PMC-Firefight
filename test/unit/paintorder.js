/* The order units and buildings are painted in (draw.js paintOrder). The
   camera looks in from the far +x, +y corner, so a building shows its +x and
   +y faces: a squad standing past either of them is in front of it and painted
   after it, wherever it is along that face; a squad on the other side is
   behind it and painted first; a squad inside it (its garrison) is painted
   over it. A single depth per building got the squad in front of the end wall
   of a long building wrong. */
'use strict';
global.window = {};
require('../../src/view/draw.js');
const paintOrder = window.PMCPaintOrder;

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

const spot = (it) => ({ x: it.x, y: it.y });
const unit = (name, x, y, inside) => ({ name, x, y, depth: x + y, inside: inside || null });
const block = (name, x, y, w, h) => { const pr = { x, y, w, h }; return { name, pr, depth: x + w + y + h }; };
const names = (list) => list.map((it) => it.name);
const before = (list, a, b) => names(list).indexOf(a) < names(list).indexOf(b);

// a long building, 8" along x, 4" deep
const big = block('big', 20, 20, 8, 4);
{
  const out = paintOrder([
    unit('end', 29, 21),          // in front of its +x end wall, near the far end
    unit('side', 21, 25),         // in front of its +y face, near the far end
    unit('backx', 19, 22),        // behind its -x end
    unit('backy', 24, 19)         // behind its -y side
  ], [big], spot);
  ok('a squad in front of the end wall of a long building is painted over it', before(out, 'big', 'end'), names(out).join(' '));
  ok('...and one in front of its long side', before(out, 'big', 'side'));
  ok('a squad behind either far side is painted first, so the building hides it',
    before(out, 'backx', 'big') && before(out, 'backy', 'big'), names(out).join(' '));
}
{
  // the garrison is over the building, a squad behind it still under it
  const g = unit('garrison', 22, 22, big.pr);
  const out = paintOrder([g, unit('behind', 24, 19)], [big], spot);
  ok('the squad inside a building is painted over it', before(out, 'big', 'garrison'));
  ok('...and a squad behind it under it', before(out, 'behind', 'big'), names(out).join(' '));
}
{
  // a small building in front of the long one's side; a squad between them
  const small = block('small', 23, 26, 3, 3);
  const out = paintOrder([unit('between', 24.5, 25), unit('front', 24.5, 30)], [big, small], spot);
  ok('the building in front of another is painted after it', before(out, 'big', 'small'), names(out).join(' '));
  ok('a squad between two buildings is over the far one and under the near one',
    before(out, 'big', 'between') && before(out, 'between', 'small'), names(out).join(' '));
  ok('a squad in front of both is over both', before(out, 'small', 'front'));
}
{
  // a long building and a short one in front of its middle: the long one's far corner is the deeper
  const long = block('long', 0, 0, 10, 1), near = block('near', 4, 2, 1, 1);
  const out = paintOrder([], [near, long], spot);
  ok('a long building behind a short one is still painted first', before(out, 'long', 'near'), names(out).join(' '));
}
{
  // squads apart from any building keep to their depth
  const out = paintOrder([unit('a', 5, 5), unit('b', 2, 2), unit('c', 9, 2)], [big], spot);
  ok('squads clear of the buildings are painted back to front', names(out).filter((n) => n !== 'big').join('') === 'bac', names(out).join(' '));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
