/* Two players, two sockets, one server — the whole way through.

   This drives the real server over a real WebSocket: the handshake, the lobby,
   the chat, creating and joining a game, agreeing the terms, both sides ready,
   and then a battle played to a result with nothing but intents going up and
   nothing but events and state coming down. If this passes, the wire works. */
'use strict';
const http = require('http');
const path = require('path');
const os = require('os');
const { ROOT } = require('../where.js');
const ws = require('../../server/ws.js');
const statics = require('../../server/static.js');
const { Lobby, Player, LIMITS } = require('../../server/lobby.js');
const app = require('../../server/app.js');
const DB = require('../../server/db.js');
const Auth = require('../../server/auth.js');
const { Campaigns } = require('../../server/campaigns.js');
const tables = require('../../server/table.js');
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

/* ---- a player, as a script ---- */
class Client {
  constructor(name) {
    this.name = name;
    this.key = null;             // the id and secret the server issues at the first hello
    this.inbox = [];
    this.room = null;
    this.seat = null;
    this.state = null;
    this.events = [];
    this.over = null;
    this.refusals = [];
    this.errors = [];
    this.lobbyChat = [];
    this.gameChat = [];
    this.games = [];
  }
  open(url, opts) {
    // signed in (a session's cookie), unless told otherwise
    opts = Object.assign({ cookie: this.cookie }, opts || {});
    return new Promise((resolve, reject) => {
      ws.connect(url, (err, sock) => {
        if (err) return reject(err);
        this.sock = sock;
        sock.on('message', (text) => {
          const m = JSON.parse(text);
          this.inbox.push(m);
          if (m.t === 'welcome') { this.me = m.you; this.games = m.games; if (m.key) this.key = m.key; }
          if (m.t === 'lobby') this.games = m.games;
          if (m.t === 'lobby.chat') this.lobbyChat.push(m);
          if (m.t === 'game') { this.room = m.room; this.seat = seatOf(m.room, this.me && this.me.id); }
          if (m.t === 'game.chat') this.gameChat.push(m);
          if (m.t === 'started') { this.seat = m.seat; this.cfg = m.cfg; }
          if (m.t === 'turn') { this.state = m.state; this.turns = (this.turns || 0) + 1; this.events = this.events.concat(m.events || []); }
          if (m.t === 'over') this.over = m;
          if (m.t === 'refused') this.refusals.push(m);
          if (m.t === 'error') this.errors.push(m);
        });
        resolve(this);
      }, opts);
    });
  }
  send(t, body) { this.sock.send(JSON.stringify(Object.assign({ t: t }, body || {}))); }
  hello(extra) { this.send('hello', Object.assign({ playerId: this.key && this.key.id, secret: this.key && this.key.secret, name: this.name }, extra || {})); }
  /* Wait for the next message of this type. A message that arrived while we
     were waiting on something else still counts — the cursor is per type, so
     each wait takes the next one rather than the same one twice. */
  async until(t, ms) {
    const stop = Date.now() + (ms || 4000);
    this.seen = this.seen || {};
    for (;;) {
      for (let i = this.seen[t] || 0; i < this.inbox.length; i++) {
        if (this.inbox[i].t !== t) continue;
        this.seen[t] = i + 1;
        return this.inbox[i];
      }
      if (Date.now() > stop) throw new Error(this.name + ' waited for "' + t + '" and it never came');
      await wait(5);
    }
  }
  /* Wait for something to become true. The room arrives whole and often, so
     most waits are about the state it settles into rather than any one
     message. */
  async till(what, pred, ms) {
    const stop = Date.now() + (ms || 4000);
    for (;;) {
      try { if (pred(this)) return true; } catch (e) { }
      if (Date.now() > stop) {
        throw new Error(this.name + ' waited for ' + what + ' and it never happened' +
          (this.errors.length ? ' (last error: ' + this.errors[this.errors.length - 1].text + ')' : ''));
      }
      await wait(5);
    }
  }
  async settle(ms) { await wait(ms || 60); }
  /* Wait for the next table to arrive. Every intent the server accepts is
     answered with one, so this is how long an action takes — which is not a
     number a test should be guessing at. */
  async answered(ms) {
    const from = this.turns || 0;
    const stop = Date.now() + (ms || 4000);
    while ((this.turns || 0) === from) {
      if (Date.now() > stop) return false;
      await wait(4);
    }
    return true;
  }
  close() { try { this.sock.close(1000, 'done'); } catch (e) { } }
}

function seatOf(room, id) {
  if (!room) return null;
  if (room.seats.A && room.seats.A.id === id) return 'A';
  if (room.seats.B && room.seats.B.id === id) return 'B';
  return null;
}

/* ---- a force that will pass the composition table ---- */
function force(faction, tier, pl, colour, name) {
  return { faction: faction, keys: R.rollArmy(tier, pl, null, faction), colour: colour, name: name, tactic: '' };
}

async function main() {
  /* ---- the server, on a port of its own ---- */
  // a campaign store of its own, out of the way of any real one
  const campaigns = new Campaigns(path.join(os.tmpdir(), 'pmc-test-campaigns'), { log: () => { } });
  const serve = statics.create(ROOT);
  // the battle below is played by a script as fast as the server answers: far past what a player's hands send
  const quick = { all: { per: 1000, n: 100000 }, chat: LIMITS.chat, rooms: LIMITS.rooms };
  const lobby = new Lobby({ log: () => { }, limits: quick, sweep: false, makeTable: tables.make({ campaign: campaigns, log: () => { } }) });
  // accounts on a database in memory, as the real server keeps them in a file; signing up as often as the test likes
  const many = { per: 1000, n: 1000 };
  const auth = Auth.create({ db: DB.open(':memory:'), limits: { loginName: { per: 900000, n: 10 }, loginIp: many, register: many, guest: many } });
  const server = http.createServer(app.create({ campaigns: campaigns, lobby: lobby, serve: serve, auth: auth, allowOrigin: ws.sameHost }));
  ws.attach(server, '/ws', (sock, req, who) => lobby.connect(sock, who), { authorize: (req) => auth.session(Auth.tokenFrom(req)) });
  // a player signed up, their session's cookie kept to open sockets with
  async function signed(name) {
    const r = await auth.register(name, 'password ' + name, '127.0.0.1', name.replace(/\W/g, '').toLowerCase() + '@example.com');
    const c = new Client(name);
    c.cookie = Auth.COOKIE + '=' + r.token;
    return c;
  }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const URL = 'ws://127.0.0.1:' + port + '/ws';

  console.log('server — two players over a socket');

  /* ---- static hosting ---- */
  const page = await new Promise((r) => {
    http.get('http://127.0.0.1:' + port + '/index.html', (res) => {
      let b = ''; res.on('data', (c) => b += c); res.on('end', () => r({ code: res.statusCode, body: b }));
    });
  });
  ok('the app is served', page.code === 200 && /<canvas id="board"/.test(page.body));
  const closed = {};
  for (const p of ['/server/lobby.js', '/campaigns/default.json', '/.git/config']) {
    closed[p] = await new Promise((r) => {
      // a raw request, so nothing normalises the path before the server sees it
      const req = http.request({ host: '127.0.0.1', port: port, path: p }, (res) => r(res.statusCode));
      req.end();
    });
  }
  ok('the server’s own source is not handed out', closed['/server/lobby.js'] !== 200, 'got ' + closed['/server/lobby.js']);
  ok('the saved campaigns are not handed out', closed['/campaigns/default.json'] !== 200);
  ok('hidden files are not handed out', closed['/.git/config'] !== 200);

  /* ---- two players arrive ---- */
  const a = await (await signed('Ash')).open(URL);
  const b = await (await signed('Brann')).open(URL);
  a.hello(); b.hello();
  await a.until('welcome'); await b.until('welcome');
  ok('both are welcomed', a.me.name === 'Ash' && b.me.name === 'Brann');

  /* ---- lobby chat ---- */
  a.send('lobby.chat', { text: 'anyone for a game?' });
  await b.until('lobby.chat');
  ok('lobby chat reaches the other player',
    b.lobbyChat[0].from === 'Ash' && /anyone for a game/.test(b.lobbyChat[0].text));

  /* ---- a private game: out of the list, joined by its code ---- */
  const cole = await (await signed('Cole')).open(URL);
  cole.hello(); await cole.until('welcome');
  cole.send('game.create', { name: 'Cole’s secret', settings: { tier: 3, pl: 1, private: true } });
  await cole.until('game');
  const secret = cole.room.id;
  ok('a private game is marked so', cole.room.settings.private === true);
  await b.settle();
  ok('...and is not in anyone’s game list', !b.games.some((g) => g.id === secret));
  b.send('game.join', { id: secret });
  await b.until('game');
  ok('...but its code still joins it', b.room && b.room.id === secret && b.seat === 'B');
  cole.send('game.settings', { patch: { private: false } });
  await a.till('the game to be listed', (x) => x.games.some((g) => g.id === secret));
  ok('the host can list it after all', true);
  b.send('game.leave'); cole.send('game.leave');
  await b.till('Brann to be back in the lobby', (x) => !x.room);
  await a.till('the private game to close', (x) => !x.games.some((g) => g.id === secret));
  // what came of it is behind us: the waits below start from here
  for (const x of [a, b]) { x.seen = {}; x.inbox.forEach((m) => { x.seen[m.t] = x.inbox.length; }); }

  /* ---- create and join ---- */
  a.send('game.create', { name: 'Ash vs Brann', settings: { tier: 3, pl: 1, planet: 'sparse', scenario: 'secure' } });
  await a.until('game');
  ok('the host is in seat A', a.seat === 'A');
  const code = a.room.id;
  await b.until('lobby');
  ok('the game shows up in the lobby', b.games.some((g) => g.id === code));

  b.send('game.join', { id: code });
  await b.until('game');
  ok('the second player takes seat B', b.seat === 'B');
  await a.settle();
  ok('the host sees them arrive', a.room.seats.B && a.room.seats.B.name === 'Brann');

  /* ---- the terms ---- */
  b.send('game.settings', { patch: { tier: 5 } });
  await b.settle();
  ok('only the host sets the terms', b.errors.some((e) => /only the host/.test(e.text)));

  a.send('game.settings', { patch: { tier: 4, pl: 1, planet: 'jungle', scenario: 'meeting' } });
  await b.until('game');
  ok('the terms reach both sides', b.room.settings.tier === 4 && b.room.settings.planet === 'jungle');

  /* ---- forces, and being ready ---- */
  a.send('game.force', { force: force('pmc', 4, 1, 'ochre', 'Ash Company') });
  b.send('game.force', { force: force('rebel', 4, 1, 'crimson', 'The Brannite Front') });
  await a.till('both forces', (c) => c.room.seats.A.force.keys.length && c.room.seats.B.force.units);
  ok('a force reaches the other side by its name and size, not its list (phase 4)', b.room.seats.A.force.name === 'Ash Company' && b.room.seats.A.force.units > 0 && !b.room.seats.A.force.keys && a.room.seats.A.force.keys.length > 0);

  a.send('game.ready', { ready: true });
  await b.till('Ash to be ready', (c) => c.room.seats.A.ready === true);
  ok('readiness is visible to the other side', true);

  a.send('game.start');
  await a.till('a refusal', (c) => c.errors.some((e) => /both sides must be ready/.test(e.text)));
  ok('the battle will not start with one side unready', true);

  b.send('game.ready', { ready: true });
  await a.till('both ready', (c) => c.room.canStart === true);
  ok('both ready', true);

  /* changing the terms after that unreadies everyone, which it must */
  a.send('game.settings', { patch: { tier: 3 } });
  await a.till('the terms to unready everyone', (c) => c.room.canStart === false);
  ok('changing the terms asks both sides again', true);

  // and the forces must be rebuilt for the tier that is now being fought
  a.send('game.force', { force: force('pmc', 3, 1, 'ochre', 'Ash Company') });
  b.send('game.force', { force: force('rebel', 3, 1, 'crimson', 'The Brannite Front') });
  await a.settle(80);
  a.send('game.ready', { ready: true });
  b.send('game.ready', { ready: true });
  await a.till('both ready again', (c) => c.room.canStart === true);

  /* ---- the battle ---- */
  a.send('game.start');
  const started = await a.until('started');
  await b.until('started');
  ok('the battle starts', started.seat === 'A' && !!a.cfg);
  ok('the scenario was settled by the server', !!a.cfg.scenario && a.cfg.scenario !== 'roll');
  await a.until('turn'); await b.until('turn');
  ok('both sides are sent the table', !!a.state && !!b.state);
  ok('and the same table', a.state.units.length === b.state.units.length &&
    a.state.terrain.length === b.state.terrain.length);
  /* the rebel player chooses a tactic, knowing the roles, before the table is laid (p. 95) */
  if (a.state.phase === 'tactics') {
    ok('the rebel player is asked a tactic first', !!b.state.tacticAsk && b.state.tacticAsk.order[0] === 'B');
    a.refusals.length = 0;
    a.send('intent', { intent: { k: 'tactic', tactic: 'guerillas' } });
    await a.settle(80);
    ok('...which the other player cannot answer for them', a.refusals.some((r) => r.intent.k === 'tactic') && !!a.state.tacticAsk);
    b.send('intent', { intent: { k: 'tactic', tactic: null } });
    await a.till('the tactic to be taken', (c) => c.state && !c.state.tacticAsk);
  }
  ok('the table arrives ready to deploy', a.state.phase === 'deploy');
  ok('the terrain was rolled by the server', a.state.terrain.length > 0);

  /* in-game chat */
  a.send('game.chat', { text: 'good luck' });
  await b.till('the chat line', (c) => c.gameChat.some((l) => l.text === 'good luck' && l.seat === 'A'));
  ok('in-game chat works', true);

  /* a player may not act for the other side */
  const foreign = a.state.units.filter((u) => u.side === 'B')[0];
  b.refusals.length = 0;
  a.send('intent', { intent: { k: 'deploy', id: foreign.id, x: 40, y: 20 } });
  await a.settle(120);
  ok('a player cannot place the other side’s troops',
    a.refusals.some((r) => r.intent.k === 'deploy'));

  /* ---- deploy and fight ---- */
  const both = { A: a, B: b };
  /* Each player looks over the table and modifies their army, or goes on;
     nobody deploys while the other is still choosing. */
  const choosing = a.state.deployReady && Object.keys(a.state.deployReady).filter((s) => a.state.deployReady[s] === false);
  if (choosing && choosing.length === 2) {
    a.send('intent', { intent: { k: 'deployready' } });
    await a.settle(60);
    a.send('intent', { intent: { k: 'autodeploy' } });
    await a.settle(60);
    ok('a player cannot deploy while the other is still modifying their army',
      a.refusals.some((r) => r.intent.k === 'autodeploy') && !a.state.units.some((u) => u.side === 'A' && u.x >= 0));
    b.send('intent', { intent: { k: 'deployready' } });
    await a.settle(60);
    ok('...and may once both have gone on', !a.state.deployReady);
  } else {
    ['A', 'B'].forEach((sd) => { if (choosing && choosing.includes(sd)) both[sd].send('intent', { intent: { k: 'deployready' } }); });
    await a.settle(60);
  }
  let guard = 0;
  while (a.state && a.state.phase === 'deploy' && guard++ < 400) {
    const side = a.state.ui.placing;
    if (!side) break;
    both[side].send('intent', { intent: { k: 'autodeploy' } });
    await a.settle(40);
  }
  ok('both forces are on the table', a.state.ui.deployDone === true);

  // both players say they are ready: one alone does not start it
  a.send('intent', { intent: { k: 'start' } });
  await a.settle(200);
  ok('one player alone cannot begin the battle', a.state.phase === 'deploy' && !!a.state.startReady);
  b.send('intent', { intent: { k: 'start' } });
  await a.settle(200);
  ok('the battle is under way', a.state.phase === 'battle');
  ok('initiative was rolled on the server', !!a.state.initiative);

  /* ---- reconnecting mid-battle ---- */
  const c = new Client('Brann');
  c.cookie = b.cookie;               // the same browser, coming back signed in as before
  await c.open(URL);
  b.close();
  await wait(120);
  c.hello();
  const back = await c.until('game');
  ok('a dropped player walks back into their seat', seatOf(back.room, c.me.id) === 'B');
  const again = await c.until('started');
  ok('...told the battle is on again, so the board can be put back up', again.seat === 'B' && !!again.cfg && !!again.cfg.nameA, JSON.stringify(again));
  const resync = await c.until('turn');
  ok('and is sent the table again', !!resync.state && resync.state.turn === a.state.turn);
  both.B = c;                        // and plays out the rest of the battle

  /* Play it out. The client knows nothing about the rules beyond what the
     server tells it is on offer — which is the whole point. */
  const engineForQueries = Engine.create();
  guard = 0;
  while (!a.over && guard++ < 2500) {
    const st = a.state;
    if (!st) break;
    const sel = st.ui;
    // a vehicle just come on: it keeps the way it was offered
    if (st.faceAsk) {
      both[st.faceAsk.side].send('intent', { intent: { k: 'vfaceall' } });
      await both[st.faceAsk.side].answered();
      continue;
    }
    // the End phase: each seat carries on, nobody withdrawing or giving up
    if (st.endAsk) {
      both[st.endAsk.side].send('intent', { intent: { k: 'enddone' } });
      await both[st.endAsk.side].answered();
      continue;
    }
    if (sel.insertion) {
      const side = sel.insertion.side;
      const spot = (sel.insertion.spots || [])[0];
      both[side].send('intent', spot
        ? { intent: { k: 'insert', x: spot.x, y: spot.y } }
        : { intent: { k: 'holdinsert' } });
      await both[side].answered();
      continue;
    }
    if (st.phase !== 'battle') break;
    const side = st.activeSide;
    // the client reads the mirrored table to find something of its own to do
    engineForQueries.load(JSON.parse(JSON.stringify(st)));
    const list = engineForQueries.query.eligible(side);
    if (!list.length) break;
    const u = list[0];
    both[side].send('intent', { intent: { k: 'select', id: u.id } });
    await both[side].answered();
    // try each action until one takes
    let moved = false;
    const ids = Engine.STANDARD.map((x) => x.id).filter((x) => x !== 'regroup').concat(['regroup']);
    for (const id of ids) {
      const before = JSON.stringify([a.state.turn, a.state.activeSide, a.state.units.filter((x) => x.activated).length]);
      both[side].send('intent', { intent: { k: 'action', id: id } });
      await both[side].answered();
      if (JSON.stringify([a.state.turn, a.state.activeSide, a.state.units.filter((x) => x.activated).length]) !== before) { moved = true; break; }
      const s2 = a.state.ui;
      if (s2.targets && s2.targets.length) {
        both[side].send('intent', { intent: { k: 'target', id: s2.targets[0] } });
      } else if (s2.moves && s2.moves.length) {
        const c = s2.moves[s2.moves.length - 1];
        const kind = s2.mode === 'wave' ? 'wave' : s2.mode === 'disembark' ? 'disembark'
          : s2.mode === 'strafe' ? 'strafe' : s2.mode === 'designate' ? 'markmove' : 'move';
        both[side].send('intent', { intent: { k: kind, x: c.x, y: c.y } });
      } else if (s2.terrain && s2.terrain.length) {
        both[side].send('intent', { intent: { k: 'piece', i: s2.terrain[0] } });
      } else {
        both[side].send('intent', { intent: { k: 'cancel' } });
        continue;
      }
      await both[side].answered();
      if (JSON.stringify([a.state.turn, a.state.activeSide, a.state.units.filter((x) => x.activated).length]) !== before) { moved = true; break; }
      both[side].send('intent', { intent: { k: 'cancel' } });
      await both[side].answered();
    }
    if (!moved) { ok('every activation moves the battle on', false, u.name + ' on turn ' + st.turn); break; }
  }

  ok('the battle reached a result', !!a.over, 'after ' + guard + ' activations; errors ' + JSON.stringify(a.errors.concat(both.B.errors).slice(-3)) + ' refusals ' + JSON.stringify(a.refusals.concat(both.B.refusals).slice(-3).map(r => r.why)));
  ok('both sides were told', !!both.B.over);
  if (a.over) {
    ok('a report came with it', Array.isArray(a.over.report.units) && a.over.report.units.length > 0);
    ok('the result is the same on both screens',
      JSON.stringify(a.over.over) === JSON.stringify(both.B.over.over));
  }
  ok('the show was sent as well as the score', a.events.some((e) => e.e === 'shoot' || e.e === 'move'));
  ok('the log came down the wire', a.events.filter((e) => e.e === 'log').length > 10);
  ok('the dice came down the wire', a.events.some((e) => e.e === 'card' && e.card.dice));


  /* ---- hardening: the multiplayer plan's phase 0 ---- */
  console.log('server — hardening');
  const req = (method, p, headers, body) => new Promise((r) => {
    const q = http.request({ host: '127.0.0.1', port: port, path: p, method: method, headers: headers || {} }, (res) => {
      let t = ''; res.on('data', (c) => t += c); res.on('end', () => r({ code: res.statusCode, body: t, headers: res.headers }));
    });
    q.on('error', (e) => r({ code: 0, body: e.message }));
    if (body) q.write(body);
    q.end();
  });
  // MP-1: a malformed percent-escape is refused, and the server is still there afterwards
  const bad1 = await req('GET', '/%E0%A4%A'), bad2 = await req('GET', '/campaign/%zz');
  const alive = await req('GET', '/health');
  ok('a malformed URL is refused, and the server carries on', bad1.code >= 400 && bad2.code === 400 && alive.code === 200, bad1.code + ' ' + bad2.code + ' ' + alive.code);

  // MP-3: a campaign's first save is given a key; later writes without it are refused
  const nm = 'keytest' + Date.now().toString(36), body = JSON.stringify({ companies: { A: { name: 'Keyholders' } }, turn: 1 });
  const json = { 'content-type': 'application/json' };
  const first = await req('PUT', '/campaign/' + nm, json, body);
  const key = first.code === 200 && JSON.parse(first.body).key;
  ok('the first save of a campaign is given its key', !!key, first.code + ' ' + first.body);
  const stranger = await req('PUT', '/campaign/' + nm, Object.assign({ 'x-campaign-key': 'not-it' }, json), body);
  const anon = await req('PUT', '/campaign/' + nm, json, body);
  ok('...a save without it is refused', stranger.code === 403 && anon.code === 403, stranger.code + ' ' + anon.code);
  const holder = await req('PUT', '/campaign/' + nm, Object.assign({ 'x-campaign-key': key }, json), body);
  ok('...and one with it goes through', holder.code === 200, holder.code);
  const del1 = await req('DELETE', '/campaign/' + nm, { 'x-campaign-key': 'not-it' });
  const del2 = await req('DELETE', '/campaign/' + nm, { 'x-campaign-key': key });
  ok('...as does deleting it: refused without the key, done with it', del1.code === 403 && del2.code === 200, del1.code + ' ' + del2.code);

  // MP-7: the room goes back to setup when the battle is over, and can be played again
  await a.till('the room to reopen', (x) => x.room && x.room.phase === 'setup');
  ok('a finished battle puts the room back in setup, both forces kept', !!a.room.seats.A.force && !!a.room.seats.B.force);
  a.send('game.ready', { ready: true }); both.B.send('game.ready', { ready: true });
  await a.till('both ready again', (x) => x.room && x.room.canStart);
  a.send('game.start');
  const rematch = await a.until('started');
  ok('...and the same two can play a rematch in it', !!rematch && !!rematch.cfg);

  // phase 1: who a connection is comes from its session, and what a room shows of anyone is a public id
  const ashUser = auth.session(a.cookie.split('=')[1]);
  ok('a room shows the public id, never the account\'s own', a.room.seats.A.id === ashUser.pub && JSON.stringify(a.room).indexOf('"' + ashUser.id + '"') < 0);
  const m = await (await signed('Mallory')).open(URL);
  m.hello({ playerId: ashUser.id, name: 'Ash' });         // says it is Ash
  await m.until('welcome');
  ok('a signed-in connection is who its session says, whatever its hello claims', m.me.name === 'Mallory' && m.me.id !== a.me.id);
  let none = null, forged = null;
  try { const o = await new Client('Nobody').open(URL, { cookie: '' }); o.close(); none = false; } catch (e) { none = /401/.test(e.message); }
  try { const o = await new Client('Forger').open(URL, { cookie: Auth.COOKIE + '=made-up' }); o.close(); forged = false; } catch (e) { forged = /401/.test(e.message); }
  ok('a socket without a session is refused, as is one with a made-up session', none === true && forged === true, none + ' ' + forged);
  m.close();
  // the account routes over HTTP: made, signed in, asked who, signed out
  const reg = await req('POST', '/api/register', json, JSON.stringify({ name: 'Webster', password: 'long enough', email: 'webster@example.com' }));
  const ck = String((reg.headers || {})['set-cookie'] || '');
  ok('registering over HTTP signs in with an HttpOnly, SameSite cookie', reg.code === 200 && /pmc_session=/.test(ck) && /HttpOnly/.test(ck) && /SameSite=Lax/.test(ck), reg.code + ' ' + ck);
  const sess = ck.split(';')[0];
  const who = await req('GET', '/api/me', { cookie: sess });
  ok('...and the page is told who it is, by its public id only', who.code === 200 && JSON.parse(who.body).who.name === 'Webster' && !('userId' in JSON.parse(who.body).who), who.body);
  const out = await req('POST', '/api/logout', { cookie: sess });
  const after = await req('GET', '/api/me', { cookie: sess });
  ok('...signing out ends the session', out.code === 200 && after.code === 401);
  const offsite = await req('POST', '/api/login', Object.assign({ origin: 'http://evil.example' }, json), JSON.stringify({ name: 'Webster', password: 'long enough', email: 'webster@example.com' }));
  ok('a sign-in posted from another site\'s page is refused', offsite.code === 403, offsite.code);

  // phase 3a: a signed-in player's campaigns kept on the server, each save over the version it was read at
  const sessOf = async (name) => {
    const r = await req('POST', '/api/register', json, JSON.stringify({ name: name, password: 'password ' + name, email: name.replace(/\W/g, '').toLowerCase() + '@example.com' }));
    return String((r.headers || {})['set-cookie'] || '').split(';')[0];
  };
  const owner = await sessOf('Keeper'), other = await sessOf('Snoop');
  const withC = (c) => Object.assign({ cookie: c }, json);
  const camp1 = { mode: 'solo', turn: 2, companies: { A: { name: 'Iron Wolves', roster: [] } }, log: [] };
  const made = await req('POST', '/api/campaigns', withC(owner), JSON.stringify({ state: camp1 }));
  const cid = made.code === 200 && JSON.parse(made.body).id;
  const listed = await req('GET', '/api/campaigns', { cookie: owner });
  ok('a signed-in player\'s campaign is kept on the server, and listed as theirs', !!cid && JSON.parse(listed.body).campaigns.some((c) => c.id === cid && c.name === 'Iron Wolves' && c.turn === 2), made.code + ' ' + listed.body);
  const v2 = await req('PUT', '/api/campaigns/' + cid, withC(owner), JSON.stringify({ state: Object.assign({}, camp1, { turn: 3 }), version: 1 }));
  const stale = await req('PUT', '/api/campaigns/' + cid, withC(owner), JSON.stringify({ state: Object.assign({}, camp1, { turn: 4 }), version: 1 }));
  const st409 = stale.code === 409 && JSON.parse(stale.body);
  ok('...saved over the version it was read at; a save from an older copy is refused, the newer one handed back',
    v2.code === 200 && JSON.parse(v2.body).version === 2 && !!st409 && st409.version === 2 && st409.state.turn === 3, v2.code + ' ' + stale.code);
  const peek = await req('GET', '/api/campaigns/' + cid, { cookie: other });
  const anonList = await req('GET', '/api/campaigns', {});
  const g = await req('POST', '/api/guest', json, JSON.stringify({ name: 'Passer By' }));
  const guestCamp = await req('POST', '/api/campaigns', withC(String(g.headers['set-cookie']).split(';')[0]), JSON.stringify({ state: camp1 }));
  ok('...nobody else\'s to read; nobody signed out, nor a guest, keeps one', peek.code === 404 && anonList.code === 401 && guestCamp.code === 401, peek.code + ' ' + anonList.code + ' ' + guestCamp.code);

  // the force builder's saved forces: a player's own, one of each name and kind
  const sk = { faction: 'pmc', tier: 3, pl: 1, colour: 'ochre', keys: ['cmd2', 'regular', 'regular'] };
  const f1 = await req('POST', '/api/forces', withC(owner), JSON.stringify({ kind: 'skirmish', name: 'Iron Line', data: sk }));
  const f2 = await req('POST', '/api/forces', withC(owner), JSON.stringify({ kind: 'start', name: 'Iron Line', data: { faction: 'pmc', doctrine: 'x', keys: ['regular'] } }));
  const f3 = await req('POST', '/api/forces', withC(owner), JSON.stringify({ kind: 'skirmish', name: 'iron line', data: Object.assign({}, sk, { tier: 4 }) }));
  const fl = JSON.parse((await req('GET', '/api/forces', { cookie: owner })).body).forces;
  const fsk = fl.filter((f) => f.kind === 'skirmish');
  ok('a signed-in player keeps forces on the server, a skirmish force and a start force under one name',
    f1.code === 200 && f2.code === 200 && fl.length === 2 && fl.some((f) => f.kind === 'start'), f1.code + ' ' + f2.code + ' ' + JSON.stringify(fl));
  ok('...saving again under the same name (any case) replaces it', f3.code === 200 && fsk.length === 1 && fsk[0].data.tier === 4 && JSON.parse(f3.body).id === JSON.parse(f1.body).id);
  const otherF = JSON.parse((await req('GET', '/api/forces', { cookie: other })).body).forces;
  const snoopDel = await req('DELETE', '/api/forces/' + JSON.parse(f1.body).id, withC(other));
  const anonF = await req('GET', '/api/forces', {});
  const badF = await req('POST', '/api/forces', withC(owner), JSON.stringify({ kind: 'skirmish', name: 'Junk', data: { keys: 'nope' } }));
  ok('...nobody else\'s to see or delete; signed out, none; a force with no list is refused',
    otherF.length === 0 && JSON.parse(snoopDel.body).ok === false && anonF.code === 401 && badF.code === 400, otherF.length + ' ' + snoopDel.body + ' ' + anonF.code + ' ' + badF.code);
  const delF = await req('DELETE', '/api/forces/' + JSON.parse(f1.body).id, withC(owner));
  const left = JSON.parse((await req('GET', '/api/forces', { cookie: owner })).body).forces;
  ok('...and deleted by its owner', JSON.parse(delF.body).ok === true && left.length === 1 && left[0].kind === 'start');
  // an admin's changes to how units are drawn firing: anyone reads them, only an admin changes them
  await auth.createUser('Armourer', 'armourer password', true, 'armourer@example.com');
  const adm = String(((await req('POST', '/api/login', json, JSON.stringify({ name: 'Armourer', password: 'armourer password' }))).headers || {})['set-cookie'] || '').split(';')[0];
  const wGet = async () => JSON.parse((await req('GET', '/api/weapons', {})).body).weapons;
  ok('nobody has changed the weapon table yet, and anyone may read it', JSON.stringify(await wGet()) === '{}');
  const wPlayer = await req('POST', '/api/weapons', withC(owner), JSON.stringify({ key: 'aaveh', data: { p: 'rail' } }));
  const wAnon = await req('POST', '/api/weapons', json, JSON.stringify({ key: 'aaveh', data: { p: 'rail' } }));
  ok('...a player who is not an admin, or nobody, may not change it', wPlayer.code === 403 && wAnon.code === 403, wPlayer.code + ' ' + wAnon.code);
  const wSet = await req('POST', '/api/weapons', withC(adm), JSON.stringify({ key: 'aaveh', data: { p: 'rail', n: 3, s: null, sn: 1, splash: false, glow: 'red' } }));
  await req('POST', '/api/weapons', withC(adm), JSON.stringify({ key: 'regular', data: { p: 'burst' } }));
  const w1 = await wGet();
  ok('an admin changes a unit\'s entry, kept tidy as the table writes it, and every page reads it',
    wSet.code === 200 && JSON.stringify(w1.aaveh) === '{"p":"rail","n":3,"glow":"red"}' && w1.regular.p === 'burst', wSet.code + ' ' + JSON.stringify(w1));
  const wBadKey = await req('POST', '/api/weapons', withC(adm), JSON.stringify({ key: 'nosuchunit', data: { p: 'rail' } }));
  const wBadStyle = await req('POST', '/api/weapons', withC(adm), JSON.stringify({ key: 'aaveh', data: { p: 'laser' } }));
  const wBadField = await req('POST', '/api/weapons', withC(adm), JSON.stringify({ key: 'aaveh', data: { p: 'rail', fp: 99 } }));
  const wOffsite = await req('POST', '/api/weapons', Object.assign({ origin: 'http://evil.example' }, withC(adm)), JSON.stringify({ key: 'aaveh', data: { p: 'rail' } }));
  ok('...not for a unit that is not in the catalogue, a style that is not one, a field the table has not got, or from another site',
    wBadKey.code === 400 && wBadStyle.code === 400 && wBadField.code === 400 && wOffsite.code === 403, [wBadKey.code, wBadStyle.code, wBadField.code, wOffsite.code].join(' '));
  const wRev = await req('DELETE', '/api/weapons/aaveh', withC(adm));
  const wRevP = await req('DELETE', '/api/weapons/regular', withC(owner));
  const w2 = await wGet();
  ok('a unit is put back as the table has it by an admin only', JSON.parse(wRev.body).ok === true && wRevP.code === 403 && !w2.aaveh && !!w2.regular, wRev.body + ' ' + wRevP.code);
  await req('DELETE', '/api/weapons', withC(adm));
  ok('...and every unit at once', JSON.stringify(await wGet()) === '{}');

  // an old campaign file, taken into the account by whoever holds its key
  const legacyName = 'old' + Date.now().toString(36);
  const legacy = await req('PUT', '/campaign/' + legacyName, json, JSON.stringify(camp1));
  const lkey = JSON.parse(legacy.body).key;
  const badImport = await req('POST', '/api/campaigns/import', withC(owner), JSON.stringify({ name: legacyName, key: 'not-it' }));
  const goodImport = await req('POST', '/api/campaigns/import', withC(owner), JSON.stringify({ name: legacyName, key: lkey }));
  ok('an old campaign file is taken into an account with its key, and not without', badImport.code === 403 && goodImport.code === 200, badImport.code + ' ' + goodImport.code);
  const gone = await req('DELETE', '/api/campaigns/' + cid, { cookie: owner });
  ok('...and a campaign deleted is gone', gone.code === 200 && (await req('GET', '/api/campaigns/' + cid, { cookie: owner })).code === 404);

  // MP-8: a page on another site may not open a socket here
  let refused = null;
  try { const o = await new Client('Elsewhere').open(URL, { origin: 'http://evil.example' }); o.close(); refused = false; }
  catch (e) { refused = true; }
  const home = await (await signed('Here')).open(URL, { origin: 'http://127.0.0.1:' + port });
  ok('a socket from another site is refused; one from this one is not', refused === true && !!home.sock);
  home.close();
  // MP-8: a flood of chat, at the real limits, is cut short and the sender told
  const flood = new Player(null);
  let let_ = 0;
  for (let i = 0; i < 30; i++) if (flood.allowed('lobby.chat')) let_++;
  ok('a flood of chat is cut short at the limit', let_ === LIMITS.chat.n, let_ + ' let through');
  let msgs = 0;
  for (let i = 0; i < 200; i++) if (flood.allowed('ping')) msgs++;
  ok('...as is a flood of anything', msgs <= LIMITS.all.n, msgs + ' let through');

  // MP-7: a room nobody is connected to is put away after a while
  const idle = await (await signed('Idle')).open(URL);
  idle.hello(); await idle.until('welcome');
  idle.send('game.create', { name: 'Nobody home', settings: {}, force: force('pmc', 3, 1, 'ochre', 'Idle') });
  await idle.till('a room', (x) => !!x.room);
  const idleId = idle.room.id;
  idle.close();
  await wait(80);
  const t0 = Date.now();
  lobby.sweep(t0);
  ok('a room just left is kept for now', lobby.rooms.has(idleId));
  lobby.sweep(t0 + 11 * 60 * 1000);
  ok('...and closed once nobody has been in it for ten minutes', !lobby.rooms.has(idleId));

  /* ---- tidy up ---- */
  a.close(); both.B.close();
  await wait(60);
  server.close();
  console.log((bad ? 'FAILED ' + bad + ' of ' : 'all ') + checks + ' checks' + (bad ? '' : ' passed'));
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.log('  FAIL ' + (e && e.stack || e));
  process.exit(1);
});
