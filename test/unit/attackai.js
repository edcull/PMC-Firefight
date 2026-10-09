/* An AI side attacking a held position (Demolish p. 54, Hostile takeover p. 55):
   it sets charges against the Demolish objective when it can, and a shattered AI
   force surrenders there as anywhere else. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 7;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// a campaign battle, both sides the AI, walked on until the attacker has troops on the table
function battle(scenario) {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario, armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'pmc'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', campaign: true,
    roles: { attacker: 'A' }, terrainSetup: 'auto' });
  for (let g = 0; g < 4000 && !e.over(); g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') {
      e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue;
    }
    if (s.phase === 'battle' && s.units.some((u) => u.side === 'A' && u.alive && u.cls === 'infantry' && u.x >= 0 && !u.aboard)) return e;
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) break;
  }
  return e;
}

console.log('\nDemolish: the attacking AI sets charges against the objective (p. 54)');
(function () {
  const e = battle('demolish'), st = e.state(), t = st.sc.target;
  const u = st.units.filter((x) => x.side === 'A' && x.alive && x.cls === 'infantry' && x.x >= 0 && !x.aboard &&
    !R.has(x, 'Cumbersome Weapon'))[0];
  ok('the attacker has infantry on the table', !!u && !!t);
  if (!u || !t) return;
  // beside the objective, steady, and its turn
  u.x = t.x + t.w + 1.5; u.y = t.y + t.h / 2; u.sp = 0; u.activated = false; u.bld = null; st.activeSide = 'A';
  const n0 = st.log.length;
  e.query.aiAct(u);
  const txt = st.log.slice(n0).map((l) => l.text || '').join(' | ');
  ok('...and one beside it goes in with charges', /sets charges against the objective/.test(txt), txt.slice(0, 160));
})();

console.log('\nA shattered AI attacker surrenders, whatever the scenario');
// the AI attacker, most of its men gone and nothing held, at the End phase of turn 5
function yieldsIn(scenario) {
  const e = battle(scenario), st = e.state();
  st.turn = 5;
  // every squad down to its last man, every hull but one gone: far worse off than B, but not wiped out
  let spared = false;
  st.units.filter((u) => u.side === 'A' && !u.free).forEach((u) => {
    if (!R.isMachine(u)) { u.startSize = Math.max(u.startSize || u.models || 1, 6); u.models = 1; }
    else if (spared) { u.alive = false; } else spared = true;
  });
  for (let g = 0; g < 3000 && !e.over() && e.state().turn === 5; g++) {
    if (!e.intent(e.state().activeSide || 'A', { k: 'step' }).ok) break;
  }
  return e.state().log.some((l) => / surrenders, its force shattered/.test(l.text || ''));
}
ok('a shattered AI attacker surrenders in a Meeting engagement', yieldsIn('meeting'));
ok('...in Demolish', yieldsIn('demolish'));
ok('...and in Hostile takeover', yieldsIn('takeover'));

console.log('\nThe computer turns down The Best Defence in Hostile takeover');
(function () {
  const { SC } = require('../../server/rules.js');
  const count = (id, ask, ai, what) => { let n = 0; for (let i = 0; i < 200; i++) { const r = SC.rollRoles(id, { A: ['S1'], B: [] }, 'B', ask, ai); if (r.bestDefence && r.bestDefence[what]) n++; } return n; };
  ok('an AI defender holding S1 keeps the Takeover position (contract roll, the player asked)', count('takeover', ['B'], null, 'declined') === 200);
  ok('...and in a battle the engine rolls for two AI sides', count('takeover', null, ['A', 'B'], 'declined') === 200);
  ok('...but still uses it in Demolish', count('demolish', ['B'], null, 'swapped') > 120);
  ok('...and a player holding it is still asked', count('takeover', ['A', 'B'], null, 'pending') === 200);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
