/* Battles kept in the database (multiplayer plan, phase 2): a battle played
   part-way, the server stopped and started again on the same database, both
   players back in their seats at the same table, and the battle played on to a
   result; a battle nobody is at put away and brought back for one of its players;
   a player walking away losing by forfeit; and each player's own list of games. */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ws = require('../../server/ws.js');
const { Lobby, LIMITS } = require('../../server/lobby.js');
const tables = require('../../server/table.js');
const DB = require('../../server/db.js');
const Auth = require('../../server/auth.js');
const Games = require('../../server/games.js');
const { R, Engine } = require('../../server/rules.js');

let checks = 0, bad = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) { console.log('  ok   ' + what); return true; }
  bad++;
  console.log('  FAIL ' + what + (detail ? ' — ' + detail : ''));
  return false;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name, cookie) { this.name = name; this.cookie = cookie; this.inbox = []; this.room = null; this.state = null; this.over = null; this.turns = 0; this.mine = null; this.presence = []; }
  open(url) {
    return new Promise((resolve, reject) => ws.connect(url, (err, sock) => {
      if (err) return reject(err);
      this.sock = sock;
      sock.on('message', (text) => {
        const m = JSON.parse(text);
        this.inbox.push(m);
        if (m.t === 'welcome') this.me = m.you;
        if (m.t === 'game') this.room = m.room;
        if (m.t === 'started') { this.seat = m.seat; this.started = (this.started || 0) + 1; }
        if (m.t === 'turn') { this.state = m.state; this.turns++; }
        if (m.t === 'over') this.over = m;
        if (m.t === 'mine') this.mine = m.games;
        if (m.t === 'game.presence') this.presence.push(m);
      });
      resolve(this);
    }, { cookie: this.cookie }));
  }
  send(t, body) { this.sock.send(JSON.stringify(Object.assign({ t: t }, body || {}))); }
  async till(what, pred, ms) {
    const stop = Date.now() + (ms || 5000);
    for (;;) {
      try { if (pred(this)) return true; } catch (e) { }
      if (Date.now() > stop) throw new Error(this.name + ' waited for ' + what);
      await wait(5);
    }
  }
  async answered(ms) {
    const from = this.turns, stop = Date.now() + (ms || 3000);
    while (this.turns === from) { if (Date.now() > stop) return false; await wait(3); }
    return true;
  }
  close() { try { this.sock.close(1000, 'done'); } catch (e) { } }
}

// the table as it stands, in a few numbers: the same battle reads the same
function print(st) {
  return st ? [st.phase, st.turn, st.activeSide, st.units.map((u) => u.id + ':' + u.x.toFixed(2) + ',' + u.y.toFixed(2) + ':' + u.models + ':' + (u.sp || 0) + ':' + (u.alive ? 1 : 0)).join('|')].join('#') : null;
}

/* Play on as the two players, through intents only: set up, then each activation
   tried action by action until one takes. Stops after `n` activations, or at the end. */
const engineForQueries = Engine.create();
async function play(a, both, n) {
  let acts = 0;
  for (let guard = 0; guard < 3000 && !a.over && acts < n; guard++) {
    const st = a.state;
    if (!st) { await wait(10); continue; }
    // a rebel's tactic, asked before the table is laid: none (a wave called up is picked for it)
    if (st.tacticAsk) {
      const ta = st.tacticAsk, sd = ta.order[ta.step];
      both[sd].send('intent', { intent: ta.wave ? { k: 'waveauto' } : { k: 'tactic', tactic: null } });
      await both[sd].answered();
      if (ta.wave) { both[sd].send('intent', { intent: { k: 'wavedone' } }); await both[sd].answered(); }
      continue;
    }
    if (st.phase === 'deploy') {
      if (st.deployReady) { ['A', 'B'].forEach((sd) => { if (st.deployReady[sd] === false) both[sd].send('intent', { intent: { k: 'deployready' } }); }); await a.answered(); continue; }
      if (st.ui && st.ui.placing) { both[st.ui.placing].send('intent', { intent: { k: 'autodeploy' } }); await a.answered(); continue; }
      ['A', 'B'].forEach((sd) => both[sd].send('intent', { intent: { k: 'start' } }));
      await a.answered(); await wait(30);
      continue;
    }
    if (st.faceAsk) { both[st.faceAsk.side].send('intent', { intent: { k: 'vfaceall' } }); await both[st.faceAsk.side].answered(); continue; }
    if (st.endAsk) { both[st.endAsk.side].send('intent', { intent: { k: 'enddone' } }); await both[st.endAsk.side].answered(); continue; }
    if (st.ui && st.ui.insertion) {
      const sd = st.ui.insertion.side, spot = (st.ui.insertion.spots || [])[0];
      both[sd].send('intent', spot ? { intent: { k: 'insert', x: spot.x, y: spot.y } } : { intent: { k: 'holdinsert' } });
      await both[sd].answered(); continue;
    }
    if (st.phase !== 'battle') { await wait(10); continue; }
    const side = st.activeSide;
    engineForQueries.load(JSON.parse(JSON.stringify(st)));
    const list = engineForQueries.query.eligible(side);
    if (!list.length) { await wait(10); continue; }
    both[side].send('intent', { intent: { k: 'select', id: list[0].id } });
    await both[side].answered();
    const key = () => JSON.stringify([a.state.turn, a.state.activeSide, a.state.units.filter((x) => x.activated).length]);
    const before = key();
    for (const id of Engine.STANDARD.map((x) => x.id).filter((x) => x !== 'regroup').concat(['regroup'])) {
      both[side].send('intent', { intent: { k: 'action', id: id } });
      await both[side].answered(300);
      if (key() !== before) break;
      const s2 = a.state.ui;
      if (s2.targets && s2.targets.length) both[side].send('intent', { intent: { k: 'target', id: s2.targets[0] } });
      else if (s2.moves && s2.moves.length) { const c = s2.moves[s2.moves.length - 1]; both[side].send('intent', { intent: { k: s2.mode === 'disembark' ? 'disembark' : s2.mode === 'strafe' ? 'strafe' : s2.mode === 'designate' ? 'markmove' : 'move', x: c.x, y: c.y } }); }
      else if (s2.terrain && s2.terrain.length) both[side].send('intent', { intent: { k: 'piece', i: s2.terrain[0] } });
      else { both[side].send('intent', { intent: { k: 'cancel' } }); await both[side].answered(300); continue; }
      await both[side].answered(300);
      if (key() !== before) break;
      both[side].send('intent', { intent: { k: 'cancel' } });
      await both[side].answered(300);
    }
    if (key() !== before) acts++;
  }
  return acts;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-restart-'));
  const file = path.join(dir, 'pmc.db');
  const quick = { all: { per: 1000, n: 100000 }, chat: LIMITS.chat, rooms: LIMITS.rooms };
  const many = { per: 1000, n: 1000 };
  const authLimits = { loginName: many, loginIp: many, register: many, guest: many };

  /* A server on the database file: the accounts, the kept battles, the lobby
     (bringing back whatever was being fought), on a port of its own. */
  async function boot() {
    const db = DB.open(file), auth = Auth.create({ db: db, limits: authLimits }), games = Games.create(db);
    const lobby = new Lobby({ log: () => { }, limits: quick, sweep: false, games: games, makeTable: tables.make({ log: () => { }, store: games }) });
    const brought = lobby.restore();
    const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
    ws.attach(server, '/ws', (sock, req, who) => lobby.connect(sock, who), { authorize: (req) => auth.session(Auth.tokenFrom(req)) });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { db, auth, games, lobby, server, brought, url: 'ws://127.0.0.1:' + server.address().port + '/ws' };
  }
  async function down(s, clients) {
    clients.forEach((c) => c.close());
    await wait(60);
    await new Promise((r) => s.server.close(r));
    s.db.close();
  }
  const force = (faction) => ({ faction: faction, keys: R.rollArmy(3, 1, null, faction), colour: faction === 'pmc' ? 'ochre' : 'steel', name: '', tactic: '' });

  console.log('kept battles — a restart part-way through');
  let s1 = await boot();
  const tokA = (await s1.auth.register('Ash', 'password one', '1', 'ash@example.com')).token, tokB = (await s1.auth.register('Brann', 'password two', '1', 'brann@example.com')).token;
  const cookie = (t) => Auth.COOKIE + '=' + t;
  let a = await new Client('Ash', cookie(tokA)).open(s1.url), b = await new Client('Brann', cookie(tokB)).open(s1.url);
  a.send('hello'); b.send('hello');
  await a.till('welcome', (x) => !!x.me); await b.till('welcome', (x) => !!x.me);
  a.send('game.create', { name: 'Kept', settings: { tier: 3, pl: 1, planet: 'desert', scenario: 'meeting' }, force: force('pmc') });
  await a.till('a room', (x) => !!x.room);
  const code = a.room.id;
  b.send('game.join', { id: code });
  await b.till('a seat', (x) => x.room && x.room.seats.B && x.room.seats.B.name === 'Brann');
  b.send('game.force', { force: force('rebel') });
  a.send('game.ready', { ready: true }); b.send('game.ready', { ready: true });
  await a.till('both ready', (x) => x.room && x.room.canStart);
  a.send('game.start');
  await a.till('the battle', (x) => !!x.state);
  let both = { A: a, B: b };
  const played = await play(a, both, 6);
  await wait(80);
  const before = print(a.state), turnsBefore = a.state.turn;
  ok('a battle is under way, some activations in', played >= 3 && a.state.phase === 'battle', played + ' activations, phase ' + a.state.phase);
  const kept = s1.games.live();
  ok('...kept in the database as it goes: its config, its seed and every intent', kept.length === 1 && kept[0].code === code && s1.games.intents(kept[0].id).length > 10,
    kept.length + ' kept, ' + (kept[0] ? s1.games.intents(kept[0].id).length : 0) + ' intents');

  // the server goes down, and comes back on the same database
  await down(s1, [a, b]);
  const s2 = await boot();
  ok('started again, the battle in progress is brought back', s2.brought === 1 && s2.lobby.rooms.has(code));
  a = await new Client('Ash', cookie(tokA)).open(s2.url); b = await new Client('Brann', cookie(tokB)).open(s2.url);
  a.send('hello'); b.send('hello');
  await a.till('the table again', (x) => !!x.state); await b.till('the table again', (x) => !!x.state);
  ok('both players are back in their seats, signed in as before', a.seat === 'A' && b.seat === 'B' && a.room.id === code);
  ok('...at the same table, every unit where it was', print(a.state) === before && print(b.state) === before, print(a.state) === before ? '' : 'turn ' + turnsBefore + ' -> ' + (a.state && a.state.turn));
  both = { A: a, B: b };
  await play(a, both, 100000);
  ok('...and the battle goes on to a result', !!a.over && !!b.over, a.over ? '' : 'turn ' + (a.state && a.state.turn));
  a.send('games.mine'); b.send('games.mine');
  await a.till('their games', (x) => !!x.mine); await b.till('their games', (x) => !!x.mine);
  const ma = a.mine.find((g) => g.code === code), mb = b.mine.find((g) => g.code === code);
  const w = a.over && a.over.over && a.over.over.winner;
  const want = (sd) => !w ? 'drawn' : w === sd ? 'won' : 'lost';
  ok('each player\'s own list has it, how it went for them, and who they played', !!ma && !!mb && ma.result === want('A') && mb.result === want('B') && ma.against === 'Brann',
    JSON.stringify({ ma, mb, w }));
  ok('...and it is no longer among the battles being fought', s2.games.live().length === 0);

  console.log('kept battles — put away, and brought back');
  // the rematch in the same room, then both go
  a.send('game.ready', { ready: true }); b.send('game.ready', { ready: true });
  await a.till('both ready again', (x) => x.room && x.room.canStart);
  a.over = null; b.over = null; a.state = null;
  a.send('game.start');
  await a.till('the second battle', (x) => !!x.state && !x.state.over);
  await play(a, both, 3);
  await wait(60);
  const second = print(a.state), code2 = a.room.id;
  a.close(); b.close();
  await wait(60);
  const t0 = Date.now();
  s2.lobby.sweep(t0); s2.lobby.sweep(t0 + 31 * 60 * 1000);
  ok('a battle nobody has been at for half an hour is put away, still kept', !s2.lobby.rooms.has(code2) && s2.games.live().length === 1);
  a = await new Client('Ash', cookie(tokA)).open(s2.url);
  a.send('hello');
  await a.till('welcome', (x) => !!x.me);
  a.send('games.mine');
  await a.till('their games', (x) => !!x.mine);
  ok('...and listed among the player\'s games as under way', a.mine.some((g) => g.code === code2 && g.status === 'battle'));
  a.send('game.join', { id: code2 });
  await a.till('the table again', (x) => !!x.state);
  ok('going back to it brings it back: the seat, and the table as it was', a.seat === 'A' && print(a.state) === second);
  const stranger = await new Client('Cole', cookie((await s2.auth.register('Cole', 'password three', '1', 'cole@example.com')).token)).open(s2.url);
  stranger.send('hello'); await stranger.till('welcome', (x) => !!x.me);

  console.log('kept battles — a forfeit');
  b = await new Client('Brann', cookie(tokB)).open(s2.url);
  b.send('hello');
  await b.till('back in the seat', (x) => !!x.state && x.seat === 'B');
  a.send('game.leave');
  await b.till('told', (x) => x.presence.some((m) => m.kind === 'left'));
  const left = b.presence.find((m) => m.kind === 'left');
  ok('walking away from a battle loses it by forfeit, and the other player is told they win', left.forfeit === true && left.winner === 'B', JSON.stringify(left));
  b.send('games.mine');
  await b.till('their games', (x) => (x.mine || []).some((g) => g.code === code2 && g.status !== 'battle'));
  ok('...kept so in both players\' games', b.mine.find((g) => g.code === code2).result === 'won by forfeit');

  console.log('kept battles — an online campaign’s, over without its campaign told');
  const told = [];
  s2.lobby.onCampaignBattle = (id, report, gameId, ref) => told.push({ id, report, gameId, ref });
  const ccode = s2.lobby.campaignBattle({ campaignId: 7, ref: { kind: 'ai', slot: 0 }, name: 'Against the AI',
    cfg: { tier: 3, pl: 1, scenario: 'meeting', armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'pmc'), nameA: 'Iron Wolves', nameB: 'OpFor',
      colourA: 'ochre', colourB: 'steel', tactics: { A: null, B: null }, mode: 'ai', terrainSetup: 'auto' },
    seats: { A: { id: s2.auth.session(tokA).id, pub: null, name: 'Ash' } } });
  const cgame = s2.games.byCode(ccode);
  // kept as won, and gone from memory (a restart), the campaign never having heard
  s2.games.ended(cgame.id, 'over', { winner: 'A', why: 'kept so' });
  s2.lobby.rooms.delete(ccode);
  a.inbox = [];
  a.send('game.join', { id: ccode });
  await a.till('an answer', (x) => x.inbox.some((m) => m.t === 'error'));
  // known to the campaign by its row and its code together: a cleared battle's number is given again
  ok('going back to it: the campaign is given its result then (known by row and code), and the player told it is over',
    told.length === 1 && told[0].id === 7 && told[0].gameId === cgame.id + ':' + ccode && told[0].ref.slot === 0 && told[0].report && told[0].report.winner === 'A' &&
    a.inbox.some((m) => m.t === 'error' && /that battle is over/.test(m.text)), JSON.stringify(told.map((t) => [t.id, t.gameId, t.report && t.report.winner])));

  await down(s2, [a, b, stranger]);
  console.log((bad ? 'FAILED ' + bad + ' of ' : 'all ') + checks + ' checks' + (bad ? '' : ' passed'));
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.log('  FAIL ' + (e && e.stack || e)); process.exit(1); });
