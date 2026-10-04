/* The end of a battle on the server, as the two screens hear of it: the events
   that ended it (the result card among them) always go out before the word that
   it is over, whichever way it ended — so no screen is told it is over while its
   board is a move behind, with no result on it to read before the aftermath.
   A campaign's battle is the case that went wrong: the engine says it is finished
   in the middle of the intent that ended it. */
'use strict';
const { Table } = require('../../server/table.js');
const P = require('../../src/engine/protocol.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

// a seat whose socket keeps what it is sent, in order
function seat(name, sd) {
  const got = [];
  return { name: name, seat: sd, got: got, sock: { open: true, send(text) { got.push(JSON.parse(text)); } },
    send(t, body) { got.push(Object.assign({ t: t }, body || {})); }, fail() { } };
}
function room(settings) {
  const r = { id: 'END01', settings: P.cleanSettings(settings || {}), seats: { A: seat('Ash', 'A'), B: seat('Brann', 'B') }, watchers: [] };
  r.everyone = () => [r.seats.A, r.seats.B].filter(Boolean);
  r.broadcast = (t, body) => r.everyone().forEach((p) => p.sock.send(JSON.stringify(Object.assign({ t: t }, body || {}))));
  return r;
}
const cfgOf = (campaign) => ({
  tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', campaign: !!campaign, planet: 'sparse', terrainSetup: 'auto',
  armyA: ['cmd3', 'regular', 'veterans'], armyB: ['cmd3', 'regular', 'veterans'], nameA: 'Iron Wolves', nameB: 'Red Dawn',
  colourA: 'ochre', colourB: 'steel', tactics: { A: null, B: null }
});
// what one screen heard from the end: where the result card came, and where the word that it is over
function heard(p) {
  const card = p.got.findIndex((m) => m.t === 'turn' && (m.events || []).some((e) => e.e === 'card' && e.card && e.card.kind === 'Result'));
  const over = p.got.findIndex((m) => m.t === 'over');
  const lastTurn = p.got.map((m) => m.t).lastIndexOf('turn');
  return { card: card, over: over, overState: lastTurn >= 0 && lastTurn < over ? !!p.got[lastTurn].state.over : false, msg: p.got[over] };
}
const finished = [];
const lobby = { finished(r, report) { finished.push(report); } };

console.log('\nA campaign battle ended by an intent (a surrender in the End phase)');
let r = room({});
let t = new Table(r, lobby, {});
t.begin(cfgOf(true));
// straight to the End phase, the defender asked and already sure
const st = t.engine.state();
st.phase = 'battle'; st.endAsk = { side: 'B', sure: true, rest: [] };
r.seats.A.got.length = 0; r.seats.B.got.length = 0;
t.intent(r.seats.B, { k: 'surrender' });
['A', 'B'].forEach((sd) => {
  const h = heard(r.seats[sd]);
  ok('seat ' + sd + ': the result card comes, then the word that it is over', h.card >= 0 && h.over > h.card, JSON.stringify([h.card, h.over, r.seats[sd].got.map((m) => m.t)]));
  ok('...the table sent before it already over', h.overState);
  ok('...and the word says who won and why', h.msg && h.msg.over && h.msg.over.winner === 'A' && /surrenders/.test(h.msg.over.text), JSON.stringify(h.msg && h.msg.over));
});
ok('the lobby is told once, with the report', finished.length === 1 && !!finished[0]);
ok('nothing more is taken once it is over', (() => { const n = r.seats.A.got.length; t.intent(r.seats.A, { k: 'enddone' }); return !r.seats.A.got.slice(n).some((m) => m.t === 'turn' || m.t === 'over'); })());

console.log('\nA skirmish walked away from');
finished.length = 0;
r = room({});
t = new Table(r, lobby, {});
t.begin(cfgOf(false));
r.seats.A.got.length = 0;
const leaver = r.seats.B;
r.seats.B = null;                                    // gone from the room before the battle is ended (lobby.leave)
ok('the forfeit gives it to the side still there', t.forfeit('B') === 'A');
let h = heard(r.seats.A);
ok('...who is sent the result card, then the word that it is over', h.card >= 0 && h.over > h.card, JSON.stringify(r.seats.A.got.map((m) => m.t)));
ok('...saying they win by forfeit', h.msg && h.msg.over && h.msg.over.winner === 'A' && /walks away/.test(h.msg.over.text) && /forfeit/.test(h.msg.over.text), JSON.stringify(h.msg && h.msg.over));
ok('...and the one who left is sent nothing', !leaver.got.some((m) => m.t === 'over'));
ok('the lobby is told, so the room goes back to its set-up', finished.length === 1);

console.log('\nA campaign battle walked away from');
finished.length = 0;
r = room({});
t = new Table(r, lobby, {});
t.begin(cfgOf(true));
r.seats.A.got.length = 0;
r.seats.B = null;
t.forfeit('B');
h = heard(r.seats.A);
ok('the side still there is sent the result card before the word that it is over', h.card >= 0 && h.over > h.card, JSON.stringify(r.seats.A.got.map((m) => m.t)));
ok('...once', r.seats.A.got.filter((m) => m.t === 'over').length === 1 && finished.length === 1);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
