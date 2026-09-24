/* A transport's half move (p. 36): it may load or unload and then drive half
   its Movement, or drive half first and then load or unload — played through
   the headless engine the way a client would, with nothing but intents. */
'use strict';
const { R, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

function battle() {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['lapc', 'regular', 'regular', 'recruits'], armyB: ['recruits', 'recruits', 'regular'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  let g = 0;
  while (e.state().phase === 'deploy' && g++ < 200) {
    const side = e.query.placingSide(); if (!side) break;
    e.intent(side, { k: 'autodeploy' });
  }
  e.intent('A', { k: 'start' });
  // walk forward until side A has the activation, passing B's units with Regroup
  for (g = 0; g < 60 && e.state().phase !== 'battle'; g++) e.intent(e.state().activeSide || 'A', { k: 'start' });
  const st = e.state();
  st.units.forEach(u => { if (u.reserve) { u.reserve = false; } });
  st.terrain.length = 0;                               // an open table: the test is about the drive, not the ground
  const apc = st.units.find(u => u.key === 'lapc'), sq = st.units.find(u => u.key === 'regular' && u.side === 'A');
  const foes = st.units.filter(u => u.side === 'B');
  // put everyone somewhere sensible: the carrier and a squad beside it, the enemy far off
  apc.x = 12; apc.y = 24; apc.facing = 0; apc.activated = false; apc.cargo = []; apc.aboard = null;
  sq.x = 12; sq.y = 27.5; sq.sp = 0; sq.activated = false; sq.aboard = null; sq.bld = null; sq.sec = null;
  st.units.filter(u => u.side === 'A' && u !== apc && u !== sq).forEach((u, i) => { u.x = 4 + i * 3; u.y = 44; });
  foes.forEach((u, i) => { u.x = 40; u.y = 6 + i * 8; });
  st.activeSide = 'A';
  return { e, st, apc, sq };
}

console.log('\nLOAD, THEN DRIVE HALF');
{
  const { e, apc, sq } = battle();
  ok('the carrier can be selected', e.intent('A', { k: 'select', id: apc.id }).ok);
  ok('Embark is on offer', e.intent('A', { k: 'action', id: 'embark' }).ok);
  ok('the squad goes aboard', e.intent('A', { k: 'target', id: sq.id }).ok && sq.aboard === apc.id || !!sq.aboard, String(sq.aboard));
  ok('...and the carrier is offered half its Movement to drive', e.sel().mode === 'carry-move' && e.sel().moves.length > 0, e.sel().mode);
  const far = e.sel().moves.reduce((m, c) => Math.max(m, R.inches(c.x, c.y, apc.x, apc.y)), 0);
  ok('...no further than half', far <= apc.move / 2 + 0.75, far.toFixed(1) + '" of ' + apc.move / 2);
  const spot = e.sel().moves[e.sel().moves.length - 1], was = { x: apc.x, y: apc.y };
  e.intent('A', { k: 'move', x: spot.x, y: spot.y });
  ok('it drives on, and its activation is over', (apc.x !== was.x || apc.y !== was.y) && apc.activated && !apc.carrying);
}

console.log('\nDRIVE HALF, THEN LOAD');
{
  const { e, apc, sq } = battle();
  sq.y = 33;                                            // out of reach to begin with
  e.intent('A', { k: 'select', id: apc.id });
  ok('Drive first is on offer', e.intent('A', { k: 'action', id: 'drivefirst' }).ok);
  ok('...over half its Movement', e.sel().mode === 'carry-first' && e.sel().moves.length > 0);
  const near = e.sel().moves.slice().sort((a, b) => R.inches(a.x, a.y, sq.x, sq.y) - R.inches(b.x, b.y, sq.x, sq.y))[0];
  ok('there is ground within reach of the squad', !!near && R.inches(near.x, near.y, sq.x, sq.y) <= 6, near && R.inches(near.x, near.y, sq.x, sq.y).toFixed(1) + '"');
  if (near) {
    e.intent('A', { k: 'move', x: near.x, y: near.y });
    ok('having driven, it is still its activation', !apc.activated && apc.carryMoved);
    ok('...and only Embark is left to do', e.intent('A', { k: 'action', id: 'embark' }).ok && e.sel().mode === 'embark');
    e.intent('A', { k: 'target', id: sq.id });
    ok('it loads the squad and is done — no second drive', !!sq.aboard && apc.activated && !apc.carryMoved && e.sel().mode !== 'carry-move');
  }
}

console.log('\nDRIVE HALF, THEN STOP');
{
  const { e, apc, sq } = battle();
  sq.y = 40;
  e.intent('A', { k: 'select', id: apc.id });
  e.intent('A', { k: 'action', id: 'drivefirst' });
  const any = e.sel().moves[0];
  e.intent('A', { k: 'move', x: any.x, y: any.y });
  ok('with nobody to load or unload, the drive ends it', apc.activated && !apc.carryMoved);
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
if (fail) process.exit(1);
