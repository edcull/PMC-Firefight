/* The optional rules (Appendix 3, roadmap v0.3): a game's `cfg.options`, from
   the rules' list (R.OPTIONS) to the engine, through the online room's settings
   and the server's battle config. Off unless switched on; a battle saved before
   there were any reads as all off. (The campaigns' own: test/unit/online.js.) */
'use strict';
const { R, Engine } = require('../../server/rules.js');
const P = require('../../src/engine/protocol.js');
const { Table } = require('../../server/table.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const json = (o) => JSON.stringify(o);

console.log('\nThe list');
ok('each option has a key, a name, a page and what it does', R.OPTIONS.length >= 2 &&
  R.OPTIONS.every((d) => /^[a-zA-Z]+$/.test(d.key) && d.name && d.page > 0 && d.text));
ok('cleaned: only the options there are, each on or left out', json(R.cleanOptions({ onlyTwo: true, bookkeeper: false, bogus: true })) === '{"onlyTwo":true}');
ok('..."true" from a form counts, anything else does not', json(R.cleanOptions({ onlyTwo: 'true', bookkeeper: 1 })) === '{"onlyTwo":true}');
ok('...nothing at all is all off', json(R.cleanOptions(undefined)) === '{}' && json(R.cleanOptions('x')) === '{}');
ok('named for a card', R.optionNames({ bookkeeper: true }).join() === 'Bad, worse, the bookkeeper');

console.log('\nIn a battle');
function battle(extra) {
  const e = Engine.create({});
  e.start(Object.assign({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular'], armyB: ['regular'], nameA: 'A', nameB: 'B',
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: 'auto' }, extra || {}));
  return e.state();
}
let st = battle({ options: { onlyTwo: true, bogus: true } });
ok('the engine keeps the ones switched on, cleaned', json(st.cfg.options) === '{"onlyTwo":true}', json(st.cfg.options));
ok('...and R.opt reads them', R.opt(st, 'onlyTwo') && !R.opt(st, 'bookkeeper'));
st = battle();
ok('a battle set up with none (or saved before there were any) has them all off', json(st.cfg.options) === '{}' && !R.opt(st, 'onlyTwo'));
ok('...and so does no battle at all', !R.opt(null, 'onlyTwo') && !R.opt({}, 'onlyTwo'));

console.log('\nOnline');
let s = P.defaultSettings();
ok('a new room has them all off', json(s.options) === '{}');
s = P.cleanSettings({ options: { bookkeeper: true, bogus: true, onlyTwo: 'yes' } });
ok('the host switches some on: only the real ones, only when on', json(s.options) === '{"bookkeeper":true}', json(s.options));
s = P.cleanSettings({ options: 'all' }, s);
ok('...a patch that is not a list of them switches them all off', json(s.options) === '{}');
// the server's battle config, from a room's terms and two forces
function config(settings) {
  const room = { settings: Object.assign(P.defaultSettings(), settings),
    seats: { A: { force: P.defaultForce('A') }, B: { force: P.defaultForce('B') } } };
  return new Table(room, null, {}).buildConfig();
}
ok('a skirmish is fought under the room’s options', config({ options: { onlyTwo: true } }).options.onlyTwo === true);
ok('...and so is a co-op game', config({ kind: 'coop', options: { bookkeeper: true } }).options.bookkeeper === true);
ok('...none chosen, none on', json(config({}).options) === '{}');

// a bare table with these units, the options given switched on
let n = 0;
function mk(key, side, x, y, extra) {
  const p = R.profile(key);
  return Object.assign({
    id: side + key + (n++), key, side, code: p.code, group: p.group, name: p.name, label: p.name + ' [' + side + ']',
    cls: p.cls || 'infantry', art: p.art, faction: p.faction, tier: p.tier, size: p.size, models: p.size, move: p.move, turn: p.turn,
    fp: p.fp, range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault, morale: p.morale, str: p.str,
    transport: p.transport, cargo: [], damage: 0, facing: 0, aboard: null, rules: p.rules.slice(), x, y, sp: 0,
    alive: true, activated: false, marked: false, shotFrom: [], command: !!p.command
  }, extra || {});
}
const world = (units, options) => ({ units, terrain: [], objectives: [], log: [], scen: {}, cfg: { aiSides: [], options: options || {} }, doctrines: { A: [], B: [] } });

console.log('\n"There can be only two!" (p. 166)');
{
  const sh = mk('regular', 'A', 10, 24);
  // spread out, so none stands in another's line
  const near1 = mk('regular', 'B', 16, 24), near2 = mk('regular', 'B', 16, 31), far = mk('regular', 'B', 19, 16);
  const tank = mk('lcv', 'B', 22, 34, { facing: Math.PI });
  const units = [sh, near1, near2, far, tank];
  let st = world(units);
  ok('off: any enemy in range and sight may be shot', R.canShoot(st, sh, far, 'fire', {}));
  st = world(units, { onlyTwo: true });
  ok('on: the two nearest may be shot', R.canShoot(st, sh, near1, 'fire', {}) && R.canShoot(st, sh, near2, 'fire', {}));
  ok('...the third nearest may not', !R.canShoot(st, sh, far, 'fire', {}));
  ok('...nor may an Advance shoot it', !R.canShoot(st, sh, far, 'advance', {}));
  ok('a vehicle counts among vehicles: the nearest hull may be shot, though three squads are nearer', R.canShoot(st, sh, tank, 'fire', {}),
    R.unitDist(sh, tank).toFixed(1) + '"');
  ok('a reaction is not bound by it: defensive fire and the arrival shot still go at anyone', R.canShoot(st, far, sh, 'basic', {}) && R.canShoot(st, sh, far, 'defensive', {}));
  ok('...nor is a shot called in by a mark', R.canShoot(st, sh, far, 'fire', { markKind: 'mark' }));
  near1.alive = false;
  ok('one of the two nearest falls: the next comes into the two', R.canShoot(st, sh, far, 'fire', {}));
  near1.alive = true;
  const mortar = mk('mortarteam', 'A', 10, 30);
  const st2 = world([mortar, near1, near2, far], { onlyTwo: true });
  ok('Indirect Fire is not bound by it', R.canShoot(st2, mortar, far, 'fire', {}) === R.canShoot(world([mortar, far]), mortar, far, 'fire', {}));
  const charger = mk('regular', 'A', 12, 24);
  ok('an assault goes only at one of the two nearest', R.canAssault(charger, near1, st) && !R.canAssault(charger, far, st));
  ok('...and at anyone with the option off', R.canAssault(charger, far, world(units)));
}

console.log('\n"Bad, worse, the bookkeeper" (p. 167)');
{
  const SC = global.PMCScen;
  // a Tier V unit and four Tier I squads: losing the big one is 5 of 9 points, but 1 of 5 units
  const big = mk('rangers', 'A', 5, 5), smalls = [0, 1, 2, 3].map((i) => mk('recruits', 'A', 10 + i * 3, 5));
  const foe = mk('regular', 'B', 40, 40);
  big.alive = false;
  const units = [big].concat(smalls, [foe]);
  ok('off: one unit of five gone is no rout', !SC.routed(world(units), 'A'));
  ok('on: its five points of nine are half the army’s points gone — routed', SC.routed(world(units, { bookkeeper: true }), 'A'));
  big.alive = true; smalls[0].alive = smalls[1].alive = smalls[2].alive = false;
  ok('...and three Tier I squads of five units are a rout counted by units', SC.routed(world(units), 'A'));
  ok('...but only 3 of 9 points by the bookkeeper’s count', !SC.routed(world(units, { bookkeeper: true }), 'A'));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
