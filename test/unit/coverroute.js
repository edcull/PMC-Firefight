/* The choosing AI's covered approaches (engine/ai.js): the table as a grid of
   1" cells, each with the enemy guns that can see and reach it; a unit makes for
   its goal by the way least watched, ends its move where it is least exposed, and
   is put down — deploying, or walking on from its edge — where its way forward is.
   Exposure is its own: cover is nothing to Battle Armour, and a Cloaking System
   cannot be drawn a bead on from further than 12" (p. 129). */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 17;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

/* A bare table: one enemy rifle team at the east (x 40, y 24, 18" range), a
   building (blocks sight) between x 26 and 30, y 16 to 24, and a field of craters
   (cover, no block) at x 22 to 26, y 30 to 34. The computer runs side A. */
const e = Engine.create();
e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular', 'regular'], armyB: ['regular'],
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'sparse', campaign: true, terrainSetup: 'auto' });
const s = e.state();
s.cfg.aiSides = ['A'];
s.terrain = [{ kind: 'building', x: 26, y: 16, w: 4, h: 8 }, { kind: 'crater', x: 22, y: 30, w: 4, h: 4 }];
const [u, mate] = s.units.filter((x) => x.side === 'A'), foe = s.units.find((x) => x.side === 'B');
Object.assign(foe, { x: 40, y: 24, reserve: false, aboard: null, alive: true });
Object.assign(u, { x: 10, y: 20, reserve: false, aboard: null, alive: true });
Object.assign(mate, { x: -1, reserve: true });
const risk = (x, y) => e.query.riskAt(u, x, y);

console.log('\nWhat a spot costs: the guns that see it and reach it');
ok('in the open in reach of the enemy: exposed', risk(30, 30) > 0, risk(30, 30).toFixed(2));
ok('behind the building: unseen', risk(24, 20) === 0);
ok('out of the enemy’s reach: nothing', risk(4, 4) === 0);
ok('in the craters (cover, no block): seen, but it counts for less', risk(24, 32) > 0 && risk(24, 32) < risk(24, 37), risk(24, 32).toFixed(2) + ' against ' + risk(24, 37).toFixed(2) + ' in the open beside them');

console.log('\nEach unit minds it its own way');
u.rules = ['Battle Armour'];
ok('Battle Armour: cover is nothing to it, the craters no better than the open', risk(24, 32) === risk(24, 37) && risk(24, 32) > 0);
u.rules = ['Cloaking System'];
ok('a Cloaking System: only guns within 12" count', risk(25, 30) === 0 && risk(32, 26) > 0, risk(25, 30).toFixed(2) + ' at 16", ' + risk(32, 26).toFixed(2) + ' at 8"');
u.rules = [];

console.log('\nPut down where its way forward is least watched');
const goal = { x: 36, y: 20 };
s.objectives = [{ x: goal.x, y: goal.y, owner: null }];
// two spots as far from the goal: one in the building's shadow, one out in the open to the south
const hidden = { x: 20, y: 20 }, open = { x: 20, y: 30 };
const pick = e.query.aiPlace(u, [open, hidden]);
ok('the spot behind the building, not the open one', pick === hidden, JSON.stringify(pick));

console.log('\nMoving: the covered spot beats the exposed one as near the goal');
// (a short gun: neither spot gives it a shot, so it is the exposure alone that differs)
u.range = 6;
const sc = (c) => e.query.scoreSpot(u, c, goal, 'offensive');
ok('behind the building scores above the open ground beside it', sc({ x: 24, y: 20 }) > sc({ x: 24, y: 27 }),
  sc({ x: 24, y: 20 }).toFixed(2) + ' against ' + sc({ x: 24, y: 27 }).toFixed(2));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
