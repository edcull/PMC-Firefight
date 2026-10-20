/* The average shot, worked out rather than rolled (R.expectedShot, the unit
   viewer's Fire!): the hits off the D10's ten faces, each hit off the hit table
   with its special rules, the attack's own extras on top. */
'use strict';
const { R } = require('../../server/rules.js');
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
function unit(key, side, x, extra) {
  const p = R.profile(key);
  return Object.assign({}, p, { id: side + key, side, x, y: 0, models: p.size, sp: 0, alive: true, damage: 0, shotFrom: [], rules: p.rules.slice(),
    cls: p.cls || 'infantry', faction: p.faction || 'pmc', label: p.name }, extra || {});
}
function at(a, t) { return { units: [a, t], terrain: [], objectives: [], cfg: { aiSides: [], tier: 3, pl: 1 }, turn: 1, sc: {}, scen: {}, phase: 'battle' }; }

let a = unit('regular', 'A', 0), t = unit('regular', 'B', 11);
let st = at(a, t), ex = R.expectedShot(st, a, t, 'fire', {}), odds = R.shotOdds(st, a, t, 'fire', {});
ok('the average hits are the D10’s ten faces, as the odds shown on the table', near(ex.avgHits, odds.avgHits) && near(ex.chance, odds.chance), ex.avgHits + ' / ' + odds.avgHits);
// the hit table: 1 nothing, 2-5 one SP, 6 a man down and 2 SP — a sixth of a casualty and one SP a hit
ok('each hit is a sixth of a casualty and one SP on average', near(ex.casualties, ex.avgHits / 6) && near(ex.sp, ex.avgHits), JSON.stringify(ex));
ok('nothing on the target is changed by working it out', t.models === R.profile('regular').size && t.sp === 0 && t.shotFrom.length === 0);
ok('the same shot works out the same every time', JSON.stringify(R.expectedShot(st, a, t, 'fire', {})) === JSON.stringify(ex));

// a broken target is hit one step harder (+1 on the table): a 5 now downs a man as well as a 6
const tb = unit('regular', 'B', 11, { sp: 20 });
const exb = R.expectedShot(at(a, tb), a, tb, 'fire', {});
const perB = exb.casualties / exb.avgHits;
ok('a broken target is hit one step harder (a third of a casualty a hit)', near(perB, 2 / 6), String(perB));

// a machine: Damage, not casualties — 1 bounces, 2-5 a point, 6 a critical D3 (average 2)
const v = unit('lcv', 'B', 11);
if (v && R.isMachine(v)) {
  const exv = R.expectedShot(at(a, v), a, v, 'fire', {});
  ok('a machine takes Damage on average (4/6 + 2/6 a hit)', exv.casualties === 0 && near(exv.damage, exv.avgHits * (4 / 6 + 2 / 6)), JSON.stringify(exv));
}

/* the chance a hull is knocked out (Damage past its Structure), worked out, not
   read off the average: Battle armour troopers at 6", Anti-tank (limited), into a
   Hunter's front — an average Damage past its Structure, knocked out about half the time */
function shotAt(akey, tkey, range) {
  const sh = unit(akey, 'A', 6, { y: 8, facing: 0 }), tt = unit(tkey, 'B', 6 + range + 2 * R.UNIT_R, { y: 8, facing: Math.PI });
  return { sh, tt, st: at(sh, tt) };
}
{
  const { sh, tt, st } = shotAt('bats', 'hunter', 6), ex = R.expectedShot(st, sh, tt, 'fire', {});
  let kills = 0, N = 3000;
  for (let i = 0; i < N; i++) {
    const s = shotAt('bats', 'hunter', 6); s.st.log = [];
    R.shoot(s.st, s.sh, s.tt, 'fire', {});
    if (!s.tt.alive) kills++;
  }
  ok('an average Damage past the Structure is not a certain kill', ex.damage > tt.str && ex.kill > 0.3 && ex.kill < 0.8, ex.damage + ' / ' + ex.kill);
  ok('the knock-out chance is what the dice give', Math.abs(ex.kill - kills / N) < 0.05, ex.kill + ' vs ' + kills / N);
  const far = shotAt('bats', 'hunter', 10), exf = R.expectedShot(far.st, far.sh, far.tt, 'fire', {});
  ok('past 6" the limited Anti-tank is gone, and the chance with it', exf.kill < ex.kill, String(exf.kill));
}
console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
