/* The OpFor of a battle on the server answers after the intent that asked for it
   has gone out (table.js settleAI): the player's own events reach both players
   first, and the computer thinks on the next turn of the event loop. Nothing of
   the battle's comes between the two, the database marks where each answer came,
   and a battle brought back from it plays to the same place — as it does kept
   before there were marks, with the answer given at once. */
'use strict';
const { Table } = require('../../server/table.js');
const { R } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const tick = () => new Promise((r) => setImmediate(r));

// a room of one player at seat A, its socket a list of what it was sent
function room() {
  const sent = [];
  const player = {
    seat: 'A', sock: { open: true, send: (m) => sent.push(JSON.parse(m)) },
    send: (t, body) => sent.push(Object.assign({ t: t }, body)), fail: (why) => sent.push({ t: 'fail', why: why })
  };
  return { sent, player, room: { id: 'T', settings: {}, everyone: () => [player], broadcast: () => { } } };
}
// a database of one game
function store() {
  const rows = [], kept = { seed: null };
  return { rows, kept, started: (room, cfg, seed) => { kept.seed = seed; return 1; }, intent: (g, n, seat, it) => rows.push({ seat: seat, intent: JSON.parse(JSON.stringify(it)) }), ended: () => { } };
}
function where(t) {
  const s = t.engine.state();
  return JSON.stringify([s.turn, s.phase, s.activeSide, s.log.map((l) => l.text), s.units.map((u) => [u.id, u.x, u.y, u.models, u.sp, u.alive])]);
}

(async () => {
  let seed = 4242;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const r = room(), db = store();
  const t = new Table(r.room, null, { store: db });
  t.begin({ tier: 2, pl: 1, scenario: 'meeting', armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'rebel'),
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel', mode: 'ai', planet: 'sparse', terrainSetup: 'auto' });
  const say = (it) => t.intent(r.player, it);
  say({ k: 'autodeploy' }); say({ k: 'start' });

  console.log('\nThe answer after the intent');
  let asked = 0, owed = 0, sentFirst = 0, came = 0;
  for (let g = 0; g < 400 && asked < 12 && !t.engine.over(); g++) {
    const s = t.engine.state();
    if (s.faceAsk) { say({ k: 'vfaceall' }); continue; }
    if (s.endAsk) { say({ k: 'enddone' }); await tick(); continue; }
    if (s.phase !== 'battle' || s.activeSide !== 'A' || t.engine.owedAI()) { await tick(); continue; }
    const u = s.units.find((x) => x.side === 'A' && x.alive && x.x >= 0 && !x.activated && !x.aboard);
    if (!u) { await tick(); continue; }
    say({ k: 'select', id: u.id });
    const before = r.sent.length;
    say({ k: 'action', id: 'skip' });
    asked++;
    if (t.engine.state().activeSide === 'A') continue;
    if (t.engine.owedAI()) owed++;
    // the player's own events went out before the computer thought
    if (r.sent.slice(before).some((m) => m.t === 'turn')) sentFirst++;
    await tick();
    if (!t.engine.owedAI() && r.sent.length > before + 1) came++;
  }
  ok('the player acted, and the OpFor answered', asked >= 6 && came >= 3, asked + ' actions, ' + came + ' answered');
  ok('...each answer still to come when the intent was over', owed === came, owed + ' owed');
  ok('...the player’s own events sent out first', sentFirst === came, sentFirst + ' of ' + came);
  const marks = db.rows.filter((x) => x.intent.k === '*ai');
  ok('the database marks where each answer came', marks.length >= came && marks.every((x) => x.seat === '*'), marks.length + ' marks');

  console.log('\nA mark is the table’s own');
  const n0 = db.rows.length;
  say({ k: '*ai' });
  ok('a player sending one is refused, and it is not kept', db.rows.length === n0 && r.sent[r.sent.length - 1].t === 'refused');

  console.log('\nThe battle brought back');
  const live = where(t);
  const kept = (rows) => { const b = new Table(room().room, null, {}); b.restore({ id: 1, cfg: t.cfg, seed: db.kept.seed }, rows); return b; };
  ok('...plays to the same place from its marks', where(kept(db.rows)) === live);
  ok('...and from the intents alone, the answers given at once (a battle kept before the marks)', where(kept(db.rows.filter((x) => x.intent.k !== '*ai'))) === live);
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
