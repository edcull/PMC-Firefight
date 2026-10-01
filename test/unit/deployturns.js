/* Whose turn it is to set up. Where the scenario has a defender (Hostile
   takeover, Demolish, Invasion) the defender sets up first; otherwise Player 1,
   then Player 2. Nothing of a side's goes down, or is held back, loaded or
   split, while it is the other side's turn — and the automatic split sorts only
   the sender's own force. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 4242;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function game(scenario, attacker) {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: scenario, mode: 'hotseat', planet: 'barren', attacker: attacker,
    armyA: ['cmd3', 'regular', 'veterans', 'shock', 'regular', 'veterans'],
    armyB: ['cmd3', 'regular', 'veterans', 'shock', 'regular', 'veterans'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  // the defender's own position goes down by the auto button, and any other piece is skipped
  for (let k = 0; k < 10 && e.state().placeAsk; k++) {
    const pa = e.state().placeAsk;
    e.intent(pa.side, { k: pa.kind === 'fort' ? 'placeauto' : 'placedone' });
  }
  return e;
}
const down = (e, side) => e.state().units.filter(u => u.side === side && u.x >= 0).length;

console.log('\nHostile takeover: the defender sets up first');
(function () {
  const e = game('takeover', 'A');
  const def = e.state().sc.defender;
  ok('the defender is Player 2 here', def === 'B', def);
  ok('...and it is the defender\'s turn to set up', e.query.placingSide() === 'B', e.query.placingSide());
  const a = e.state().units.find(u => u.side === 'A');
  ok('the attacker places nothing before the battle: it enters in turn 1 (p. 55)', !e.intent('A', { k: 'deploy', id: a.id, x: 3, y: 20 }).ok && down(e, 'A') === 0);
  const r = e.intent('A', { k: 'autodeploy' });
  ok('...its Auto-deploy means "bring my units on for me"', r.ok && down(e, 'A') === 0 && e.state().autoEnter.A, r.why);
  ok('...and it sorts its two parts while the defender sets up', e.intent('A', { k: 'autosplit' }).ok);
  ok('the defender sets up', e.intent('B', { k: 'autodeploy' }).ok && down(e, 'B') > 0);
  ok('...and then there is nothing left to place', e.query.placingSide() === null && e.query.deploymentDone());
  e.intent('A', { k: 'start' });
  const st = e.state(), W = 48, H = 48;
  const first = st.units.filter(u => u.side === 'A' && u.x >= 0 && !u.aboard);
  ok('in turn 1 the attacker\'s first part comes on', st.phase === 'battle' && first.length > 0 && st.units.some(u => u.side === 'A' && u.reserve && u.wave === 2), first.length + ' on');
  // one edge every unit of the part is within 4" of (a unit in a corner is near two)
  const near = { W: u => u.x <= 4.6, E: u => u.x >= W - 4.6, N: u => u.y <= 4.6, S: u => u.y >= H - 4.6 };
  const shared = Object.keys(near).filter(g => first.every(near[g]));
  ok('...along the one table edge its first unit chose, within 4"', shared.length > 0, shared.join(',') || first.map(u => u.x.toFixed(0) + ',' + u.y.toFixed(0)).join(' '));
})();

console.log('\nInvasion: the defender first, while the attacker sorts its waves');
(function () {
  const e = game('invasion', 'A');
  ok('the defender (Player 2) sets up first', e.query.placingSide() === 'B', e.query.placingSide());
  const w = e.state().units.find(u => u.side === 'A' && u.reserve);
  const r = e.intent('A', { k: 'holdback', id: w && w.id });
  ok('the attacker, with nothing to put down, may move a unit between its waves meanwhile', !!w && r.ok, r.why);
})();

console.log('\nMeeting engagement: nobody is placed before the battle; both enter in turn 1');
(function () {
  const e = game('meeting');
  ok('nobody has anything to place before the battle', e.query.placingSide() === null && down(e, 'A') + down(e, 'B') === 0);
  ok('...so Begin the battle is open at once', e.query.deploymentDone());
  ok('Auto-deploy now means "bring my units on for me" (Player 2 asks)', e.intent('B', { k: 'autodeploy' }).ok && down(e, 'B') === 0 && e.state().autoEnter.B);
  e.intent('A', { k: 'start' });
  const st = e.state();
  ok('turn 1 begins with the initiative roll', st.phase === 'battle' && st.turn === 1 && !!st.initiative);
  // Player 1 places its own; Player 2's are brought on for it, a unit each in turn from the initiative
  const order = [];
  for (let k = 0; k < 40 && e.sel().insertion; k++) {
    const u = e.sel().insertion.unit;
    order.push(u.side);
    const spots = e.query.arrivalSpots(u);
    e.intent(u.side, { k: 'insert', x: spots[0].x, y: spots[0].y });
    for (let f = 0; f < 5 && e.state().faceAsk; f++) e.intent(e.state().faceAsk.side, { k: 'vfaceall' });
  }
  ok('Player 1 is asked where each of its units comes on', order.length === 6 && order.every(s => s === 'A'), order.join(''));
  ok('...and every unit on both sides is on the table', down(e, 'A') === 6 && down(e, 'B') === 6);
  // who came on in what order, from the log: a unit each in turn, from the side with the initiative
  const labels = {}; st.units.forEach(u => { labels[u.label] = u.side; });
  const seq = st.log.filter(l => / arrives/.test(l.text)).map(l => labels[Object.keys(labels).find(k => l.text.indexOf(k + ' arrives') === 0)]).join('');
  const other = st.initiative === 'A' ? 'B' : 'A';
  ok('...a unit each in turn, from the side with the initiative', seq === (st.initiative + other).repeat(6), seq + ' (initiative ' + st.initiative + ')');
  ok('...each within 4" of its own edge', st.units.every(u => u.side === 'A' ? u.x <= 4.6 : u.x >= 48 - 4.6), st.units.map(u => u.side + u.x.toFixed(1)).join(' '));
})();

console.log('\nChoosing which unit comes on in each turn');
(function () {
  const e = game('secure');
  e.intent('B', { k: 'autodeploy' });            // Player 2's brought on for it
  e.intent('A', { k: 'start' });
  const st = e.state(), ins = () => e.sel().insertion;
  const first = ins() && ins().unit;
  const choices = (ins() && ins().choices) || [];
  ok('Player 1 is offered every unit of its own still to come on', !!first && first.side === 'A' && choices.length === 5, choices.length + ' others');
  const want = choices[choices.length - 1];
  const r = e.intent('A', { k: 'arrivepick', id: want });
  ok('...and may bring another on in this turn instead', r.ok && ins().unit.id === want && ins().choices.indexOf(first.id) >= 0, r.why);
  ok('...not one of the enemy\'s', !e.intent('A', { k: 'arrivepick', id: st.units.find(u => u.side === 'B').id }).ok);
  const order = [];
  for (let k = 0; k < 40 && ins(); k++) {
    const u = ins().unit; order.push(u.id);
    const spots = e.query.arrivalSpots(u);
    e.intent('A', { k: 'insert', x: spots[0].x, y: spots[0].y });
    for (let f = 0; f < 5 && st.faceAsk; f++) e.intent(st.faceAsk.side, { k: 'vfaceall' });
  }
  ok('the one chosen came on first, and the one it replaced later', order[0] === want && order.indexOf(first.id) > 0, order.join(' '));
  ok('...every unit is on, still a unit each in turn', st.units.every(u => u.x >= 0 || u.aboard));
})();

console.log('\nFind and secure: each side sorts its own halves, both at once');
(function () {
  const e = game('find');
  const sp = e.state().sc.split;
  ok('both forces are split', !!(sp && sp.A && sp.B));
  const heldB = () => e.state().units.filter(u => u.side === 'B' && u.reserve).map(u => u.id).sort().join();
  const heldA = () => e.state().units.filter(u => u.side === 'A' && u.reserve).length;
  const before = heldB();
  ok('Player 1\'s automatic split sorts its own halves and leaves Player 2\'s alone', e.intent('A', { k: 'autosplit' }).ok && heldA() > 0 && heldB() === before, heldA() + ' held');
  ok('Player 2 sorts its own at the same time', e.intent('B', { k: 'autosplit' }).ok && heldB() !== before);
  const bId = sp.B.ids[sp.B.ids.length - 1];
  ok('...and may change a unit of its own', e.intent('B', { k: 'holdback', id: bId }).ok);
  ok('...but not one of Player 1\'s', !e.intent('B', { k: 'holdback', id: sp.A.ids[0] }).ok);
})();

console.log('\n' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
process.exit(fail ? 1 : 0);
