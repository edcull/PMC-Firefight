/* Before anyone deploys, each player with a swap to make modifies their army
   or goes on (Continue to deployment); nobody deploys until every one has. */
'use strict';
const { R, Engine } = require('../../server/rules.js');
let seed = 991;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function game(readyUp) {
  const e = Engine.create();
  e.start({
    // Demolish, with Player 1 defending: its defender sets up before the battle (p. 54)
    tier: 3, pl: 1, scenario: 'demolish', attacker: 'B', mode: 'hotseat', planet: 'barren', readyUp: readyUp,
    armyA: ['cmd3', 'regular', 'veterans', 'shock'], armyB: ['cmd3', 'regular', 'veterans', 'shock'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  return e;
}

console.log('\nTwo players, each with a swap to make');
(function () {
  const e = game(true), st = e.state();
  ok('both are asked first', !!st.deployReady && st.deployReady.A === false && st.deployReady.B === false, JSON.stringify(st.deployReady));
  ok('the swap is open meanwhile', e.intent('A', { k: 'swapopen' }).ok);
  e.intent('A', { k: 'autosplit' });
  const r = e.intent('A', { k: 'autodeploy' });
  ok('deploying counts as going on, but waits for the other player', !r.ok && st.deployReady && st.deployReady.A === true, r.why);
  ok('...nothing of A\'s is down', !st.units.some((u) => u.side === 'A' && u.x >= 0));
  ok('...and A\'s list stands (the swap is closed)', !e.intent('A', { k: 'swapopen' }).ok);
  ok('B goes on', e.intent('B', { k: 'deployready' }).ok && !st.deployReady);
  ok('now A deploys', e.intent('A', { k: 'autodeploy' }).ok && st.units.some((u) => u.side === 'A' && u.x >= 0));
  ok('going on twice is refused', !e.intent('B', { k: 'deployready' }).ok);
})();

console.log('\nThe swaps are secret until both have gone on');
(function () {
  const cards = [], logs = [];
  const e = Engine.create({ card: (c) => cards.push(c), log: (t, text) => logs.push(text) });
  e.start({
    tier: 3, pl: 1, scenario: 'demolish', attacker: 'B', mode: 'hotseat', planet: 'barren', readyUp: true,
    armyA: ['cmd3', 'regular', 'veterans', 'shock'], armyB: ['cmd3', 'regular', 'veterans', 'shock'],
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
  });
  const st = e.state();
  e.intent('A', { k: 'swapopen' });
  const out = st.units.find((u) => u.side === 'A' && u.key === 'regular');
  const opt = e.query.swapOptions ? e.query.swapOptions('A', out)[0] : null;
  e.intent('A', { k: 'swappick', id: out.id });
  const pickable = st.swapAsk && st.swapAsk.pick === out.id;
  // what can come in for it: whatever the swap card offers
  const choice = opt ? opt.id : (require('../../server/rules.js').R.listFor('pmc').filter((p) => p.tier === out.tier && p.key !== out.key && !p.command)[0] || {}).key;
  const sw = e.intent('A', { k: 'swapin', id: choice });
  ok('A swaps a unit', pickable && sw.ok, sw.why);
  e.intent('A', { k: 'deployready' });
  const stillOld = st.units.find((u) => u.id === out.id);
  ok('...but until B goes on, the unit on the table is the one mustered', stillOld && stillOld.key === 'regular', stillOld && stillOld.key);
  ok('...no card says so', !cards.some((c) => c.kind === 'Modifying the armies'));
  ok('...and nothing in the log gives it away', !logs.some((t) => /swaps/.test(t)), logs.filter((t) => /swaps/.test(t)).join(' | '));
  e.intent('B', { k: 'deployready' });
  const now = st.units.find((u) => u.id === out.id);
  ok('once both have gone on, the swap is made', now && now.key !== 'regular', now && now.key);
  ok('...and said, in a card', cards.some((c) => c.kind === 'Modifying the armies' && c.side === 'A'));
})();

console.log('\nA look at the table and back, and a swap changed, before going on');
(function () {
  const e = game(true), st = e.state();
  e.intent('A', { k: 'swapopen' });
  const out = st.units.find((u) => u.side === 'A' && u.key === 'regular');
  e.intent('A', { k: 'swappick', id: out.id });
  const opts = e.query.swapOptions('A', out.id);
  ok('A swaps their one unit', e.intent('A', { k: 'swapin', id: opts[0].id }).ok && st.swapAvail.A.left === 0);
  ok('...and the swaps stay open, to be changed', !!st.swapAsk && st.swapAsk.side === 'A');
  ok('closing them is a look at the table', e.intent('A', { k: 'swapdone' }).ok && !st.swapAsk && st.deployReady.A === false);
  ok('...and they open again, with no swaps left', e.intent('A', { k: 'swapopen' }).ok && !!st.swapAsk);
  ok('the swap is taken back', e.intent('A', { k: 'swapundo', id: out.id }).ok && st.swapAvail.A.left === 1 && !st.swapAvail.A.done.length);
  e.intent('A', { k: 'swappick', id: out.id });
  const other = opts[1] || opts[0];
  ok('...and another made in its place', e.intent('A', { k: 'swapin', id: other.id }).ok);
  e.intent('A', { k: 'deployready' });
  ok('once gone on, the list stands', !e.intent('A', { k: 'swapopen' }).ok);
  e.intent('B', { k: 'deployready' });
  const now = st.units.find((u) => u.id === out.id);
  ok('...and the swap chosen last is the one made', now && now.key === other.key, now && now.key);
})();

console.log('\nBoth players with their swaps open at once, at their own screens');
(function () {
  const e = game(true), st = e.state();
  e.intent('A', { k: 'swapopen' });
  const opened = e.intent('B', { k: 'swapopen' }).ok;
  ok('the second player opening theirs leaves the first one\u2019s open', opened && st.swapOpen.A && st.swapOpen.B && st.swapAsk && st.swapAsk.side === 'A', JSON.stringify(st.swapOpen));
  const ua = st.units.find((u) => u.side === 'A' && u.key === 'regular'), ub = st.units.find((u) => u.side === 'B' && u.key === 'regular');
  ok('...each picks from their own list meanwhile', e.intent('A', { k: 'swappick', id: ua.id }).ok && e.intent('B', { k: 'swappick', id: ub.id }).ok &&
    st.swapAvail.A.pick === ua.id && st.swapAvail.B.pick === ub.id);
  ok('the first closing theirs leaves the second one\u2019s open', e.intent('A', { k: 'swapdone' }).ok && !st.swapOpen.A && st.swapOpen.B && st.swapAsk && st.swapAsk.side === 'B');
  ok('...and the second closes theirs', e.intent('B', { k: 'swapdone' }).ok && !st.swapOpen.B && !st.swapAsk);
})();

console.log('\nWithout it (a hotseat\'s own secret round, or an older save)');
(function () {
  const e = game(false), st = e.state();
  ok('nobody is asked', !st.deployReady);
})();

console.log('\n' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
process.exit(fail ? 1 : 0);
