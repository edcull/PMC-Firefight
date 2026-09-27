/* The odds shown before a charge (assaultOdds) against the round the charge
   then rolls (assault): the same modifiers, whoever is charging whom. */
'use strict';
const { R } = require('../../server/rules.js');
let seed = 33;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function mk(key, side, x, y) {
  const p = R.profile(key);
  const u = {
    id: side + key + Math.random().toString(36).slice(2, 6), key: key, side: side, code: p.code,
    name: p.name, label: p.name + ' [' + side + ']', cls: p.cls || 'infantry', art: p.art, faction: p.faction,
    group: p.group, tier: p.tier, size: p.size, models: p.size, move: p.move, turn: p.turn, fp: p.fp,
    range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault, morale: p.morale,
    str: p.str, transport: p.transport, cargo: [], damage: 0, facing: 0, aboard: null,
    rules: p.rules.slice(), x: x, y: y, sp: 0, alive: true, activated: false, marked: false, shotFrom: []
  };
  return R.applyPropulsion(u);
}
// the first round the attacker rolls, less its D10
function rolled(st, a, t, opts) {
  t.fp = null;                   // no defensive fire to stop the charge short
  const res = R.assault(st, a, t, opts);
  const line = res.log.find((l) => l.t === 'round' && / \(attacker\)/.test(l.text));
  const m = /^D10 rolls (\d+).* = (-?\d+) vs/.exec(line.math);
  if (!m) throw new Error(line.math);
  return +m[2] - +m[1];
}
function check(name, build, opts) {
  const s = build(), shown = R.assaultOdds(s.st, s.a, s.t, opts).mods;
  const s2 = build(), got = rolled(s2.st, s2.a, s2.t, opts);
  ok(name, shown === got, 'shown +' + shown + ', rolled +' + got);
}
const world = (units, terrain, doctrines) => ({ units, terrain: terrain || [], objectives: [], log: [], doctrines: doctrines || {} });

console.log('\nThe odds shown are the odds rolled');
check('a rifle team against a rifle team', () => {
  const a = mk('regular', 'A', 20, 20), t = mk('regular', 'B', 23, 20);
  return { st: world([a, t]), a, t };
});
check('a Sandworm against a vehicle (Overgrown Bug)', () => {
  const a = mk('bsandworm', 'A', 20, 20), t = mk('lcv', 'B', 24, 20);
  return { st: world([a, t]), a, t };
});
check('Fanatics with Holy Fury', () => {
  const a = mk('rfanatics', 'A', 20, 20), t = mk('regular', 'B', 23, 20);
  return { st: world([a, t], [], { A: ['P4'] }), a, t };
});
check('Sappers against a squad behind a low wall', () => {
  const a = mk('engineers', 'A', 24.5, 20), t = mk('regular', 'B', 27.5, 20);
  return { st: world([a, t], [{ kind: 'barricade', x: 26, y: 12, w: 0.5, h: 16 }]), a, t };
});
check('...ordered to a standard Assault instead', () => {
  const a = mk('engineers', 'A', 24.5, 20), t = mk('regular', 'B', 27.5, 20);
  return { st: world([a, t], [{ kind: 'barricade', x: 26, y: 12, w: 0.5, h: 16 }]), a, t };
}, { noSap: true });
check('bugs with Metal-covered Talons against a vehicle', () => {
  const a = mk('battack', 'A', 20, 20), t = mk('lcv', 'B', 24, 20);
  return { st: world([a, t], [], { A: ['BP6'] }), a, t };
});

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
