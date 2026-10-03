/* Hidden information online (multiplayer plan, phase 4; decision 4): each seat is
   sent the battle with the other side's secrets left out, and a watcher with
   both sides' left out — the swaps noted but not yet made, the mined piece and
   the pieces it could be chosen from, a campaign force's bench — and, in a room
   before the battle, the other player's list. Played on a real table on the
   server, with a connection for each player and one for a watcher. */
'use strict';
const Hidden = require('../../server/hidden.js');
const tables = require('../../server/table.js');
const { Lobby, Room, Player } = require('../../server/lobby.js');
const { R } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// a connection that keeps what it is sent
function sock() { const s = { open: true, got: [], send: (t) => s.got.push(JSON.parse(t)) }; return s; }
const lastTurn = (s) => s.got.filter((m) => m.t === 'turn').pop();

console.log('\nThe battle, as each seat sees it');
const snap = {
  swapAvail: {
    A: { side: 'A', left: 1, total: 2, pick: 'A3', done: [{ out: 'Riflemen', in: 'Snipers', outId: 'A3', key: 'snipers', held: true }] },
    B: { side: 'B', left: 2, total: 2, pick: null, done: [] }
  },
  swapAsk: { side: 'A', left: 1, total: 2, pick: 'A3', done: [{ out: 'Riflemen', in: 'Snipers', outId: 'A3', key: 'snipers', held: true }] },
  mined: { side: 'B', piece: 7 },
  minePick: null,
  cfg: { tier: 2, bench: { A: [{ rid: 'a1', key: 'recruits' }], B: [{ rid: 'b1', key: 'rciv' }] } },
  units: [{ id: 'A3', side: 'A' }]
};
const forA = Hidden.battleFor(snap, 'A'), forB = Hidden.battleFor(snap, 'B'), forW = Hidden.battleFor(snap, null);
ok('a side sees its own swaps noted, in full', forA.swapAvail.A.done[0].key === 'snipers' && forA.swapAsk.pick === 'A3');
ok('...the other side sees how many, but not which', forB.swapAvail.A.done.length === 1 && !forB.swapAvail.A.done[0].key && !forB.swapAvail.A.done[0].outId && forB.swapAvail.A.left === 1 && forB.swapAsk.pick === null && !forB.swapAsk.done[0].in);
ok('...nor does a watcher', !forW.swapAvail.A.done[0].key && !forW.swapAsk.done[0].outId);
ok('the mined piece: its own side’s secret', forB.mined && forB.mined.piece === 7 && forA.mined === null && forW.mined === null);
const picking = Hidden.battleFor(Object.assign({}, snap, { minePick: { side: 'B', pool: [3, 7, 9] } }), 'A');
ok('...and the pieces it is chosen from, while it is chosen', picking.minePick.side === 'B' && picking.minePick.pool.length === 0 && Hidden.battleFor(Object.assign({}, snap, { minePick: { side: 'B', pool: [3, 7, 9] } }), 'B').minePick.pool.length === 3);
ok('a campaign force’s bench is its own', forA.cfg.bench.A.length === 1 && forA.cfg.bench.B.length === 0 && forB.cfg.bench.A.length === 0 && forW.cfg.bench.A.length + forW.cfg.bench.B.length === 0 && forA.cfg.tier === 2);
ok('the snapshot itself is left as it was', snap.swapAvail.A.done[0].key === 'snipers' && snap.mined.piece === 7 && snap.cfg.bench.B.length === 1);

console.log('\nThe room before the battle');
const room = new Room('Test', { id: 'u1', name: 'Ash' });
const pa = new Player(sock()), pb = new Player(sock()), pw = new Player(sock());
pa.id = 'u1'; pa.pub = 'pa'; pa.name = 'Ash'; pa.seat = 'A'; pa.room = room;
pb.id = 'u2'; pb.pub = 'pb'; pb.name = 'Brann'; pb.seat = 'B'; pb.room = room;
pw.id = 'u3'; pw.pub = 'pw'; pw.name = 'Cole'; pw.room = room;
pa.force = { faction: 'pmc', name: 'Iron Wolves', colour: 'ochre', tactic: '', keys: ['recruits', 'enforcers', 'lpv'] };
pb.force = { faction: 'rebel', name: 'Red Dawn', colour: 'steel', tactic: 'guerrillas', keys: ['rciv', 'rciv'] };
room.seats.A = pa; room.seats.B = pb; room.watchers.push(pw);
room.push();
const rv = (p) => p.sock.got.filter((m) => m.t === 'game').pop().room;
ok('each player sees their own list', rv(pa).seats.A.force.keys.length === 3 && rv(pb).seats.B.force.keys.length === 2);
ok('...and of the other’s, its name, colours, army and size, not its units or tactic', rv(pa).seats.B.force.name === 'Red Dawn' && rv(pa).seats.B.force.units === 2 && !rv(pa).seats.B.force.keys && !rv(pa).seats.B.force.tactic && rv(pa).seats.B.force.hidden === true);
ok('a watcher sees neither list', !rv(pw).seats.A.force.keys && !rv(pw).seats.B.force.keys && rv(pw).seats.A.force.units === 3);

console.log('\nOn a table on the server');
const lobby = new Lobby({ sweep: false, makeTable: tables.make({}) });
const cfg = {
  tier: 2, pl: 1, scenario: 'secure', armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'pmc'),
  nameA: 'Iron Wolves', nameB: 'Red Dawn', colourA: 'ochre', colourB: 'steel', tactics: { A: null, B: null },
  mode: 'hotseat', readyUp: true, terrainSetup: 'auto'
};
const code = lobby.campaignBattle({ campaignId: null, name: 'Hidden test', cfg: cfg, seats: { A: { id: 'u1', pub: 'pa', name: 'Ash' }, B: { id: 'u2', pub: 'pb', name: 'Brann' } } });
const r2 = lobby.rooms.get(code), table = r2.table;
const sa = sock(), sb = sock(), sw = sock();
r2.seats.A.sock = sa; r2.seats.B.sock = sb;
const watcher = new Player(sw); watcher.id = 'u3'; watcher.pub = 'pw'; watcher.room = r2; r2.watchers.push(watcher);
const st0 = table.engine.snapshot();
ok('(the battle is at deployment, each side with swaps to make)', st0.phase === 'deploy' && st0.swapAvail && !!st0.swapAvail.A, st0.phase);
// Player 1 notes a swap: a unit of theirs, for another of its Tier
table.intent(r2.seats.A, { k: 'swapopen' });
const ask = table.engine.snapshot().swapAsk;
const unit = table.engine.snapshot().units.filter((u) => u.side === 'A' && u.pickIdx != null && !u.command)[0];
table.intent(r2.seats.A, { k: 'swappick', id: unit.id });
// the first other profile of the same Tier, from the list
const p0 = R.profile(unit.key);
const swapIn = R.listFor('pmc').filter((p) => p.tier === p0.tier && p.key !== p0.key && !p.command && !p.turretSet && !p.noSlot)[0];
table.intent(r2.seats.A, { k: 'swapin', id: swapIn.key });
const held = table.engine.snapshot().swapAvail.A.done.filter((d) => d.held);
ok('(Player 1 has a swap noted, not yet made)', !!ask && held.length === 1 && held[0].key === swapIn.key, JSON.stringify(held).slice(0, 120));
const tA = lastTurn(sa).state, tB = lastTurn(sb).state, tW = lastTurn(sw).state;
ok('Player 1 is sent their swap in full', tA.swapAvail.A.done.some((d) => d.key === swapIn.key && d.outId === unit.id));
ok('Player 2 is sent that one is noted, not what', tB.swapAvail.A.done.length === 1 && !JSON.stringify(tB.swapAvail).includes(swapIn.key) && !JSON.stringify(tB.swapAsk || {}).includes(swapIn.key));
ok('...nor is the watcher', !JSON.stringify(tW.swapAvail).includes(swapIn.key));
ok('the events of it carry nothing of it either', ![sb, sw].some((s) => s.got.some((m) => m.t === 'turn' && JSON.stringify(m.events).includes(swapIn.key))));
sb.got.length = 0;
table.resync(r2.seats.B);
ok('a player brought up to date again is sent their own view', !JSON.stringify(lastTurn(sb).state.swapAvail).includes(swapIn.key));
// both go on: every swap made at once, for everyone to see
table.intent(r2.seats.A, { k: 'swapdone' });
['A', 'B'].forEach((sd) => table.intent(r2.seats[sd], { k: 'deployready', ready: true }));
table.intent(r2.seats.B, { k: 'swapopen' }); table.intent(r2.seats.B, { k: 'swapdone' });
const after = table.engine.snapshot();
const madeNow = after.units.filter((u) => u.id === unit.id)[0];
if (madeNow && madeNow.key === swapIn.key) {
  ok('once both go on, the swap is made, and Player 2 sees the new unit on the table', lastTurn(sb).state.units.some((u) => u.id === unit.id && u.key === swapIn.key));
} else {
  ok('(the swap waits for both players to go on)', !!(after.swapAvail && after.swapAvail.A), JSON.stringify(after.deployReady));
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
