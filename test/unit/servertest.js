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
const { Lobby } = require('../../server/lobby.js');
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
    this.id = 'test-' + name.toLowerCase().replace(/\W/g, '');
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
  open(url) {
    return new Promise((resolve, reject) => {
      ws.connect(url, (err, sock) => {
        if (err) return reject(err);
        this.sock = sock;
        sock.on('message', (text) => {
          const m = JSON.parse(text);
          this.inbox.push(m);
          if (m.t === 'welcome') { this.me = m.you; this.games = m.games; }
          if (m.t === 'lobby') this.games = m.games;
          if (m.t === 'lobby.chat') this.lobbyChat.push(m);
          if (m.t === 'game') { this.room = m.room; this.seat = seatOf(m.room, this.id); }
          if (m.t === 'game.chat') this.gameChat.push(m);
          if (m.t === 'started') { this.seat = m.seat; this.cfg = m.cfg; }
          if (m.t === 'turn') { this.state = m.state; this.turns = (this.turns || 0) + 1; this.events = this.events.concat(m.events || []); }
          if (m.t === 'over') this.over = m;
          if (m.t === 'refused') this.refusals.push(m);
          if (m.t === 'error') this.errors.push(m);
        });
        resolve(this);
      });
    });
  }
  send(t, body) { this.sock.send(JSON.stringify(Object.assign({ t: t }, body || {}))); }
  hello() { this.send('hello', { playerId: this.id, name: this.name }); }
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
  const lobby = new Lobby({ log: () => { }, makeTable: tables.make({ campaign: campaigns, log: () => { } }) });
  const server = http.createServer((req, res) => {
    if (serve(req, res)) return;
    res.writeHead(404); res.end('{}');
  });
  ws.attach(server, '/ws', (sock) => lobby.connect(sock));
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
  const a = await new Client('Ash').open(URL);
  const b = await new Client('Brann').open(URL);
  a.hello(); b.hello();
  await a.until('welcome'); await b.until('welcome');
  ok('both are welcomed', a.me.name === 'Ash' && b.me.name === 'Brann');

  /* ---- lobby chat ---- */
  a.send('lobby.chat', { text: 'anyone for a game?' });
  await b.until('lobby.chat');
  ok('lobby chat reaches the other player',
    b.lobbyChat[0].from === 'Ash' && /anyone for a game/.test(b.lobbyChat[0].text));

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
  await a.till('both forces', (c) => c.room.seats.A.force.keys.length && c.room.seats.B.force.keys.length);
  ok('a force reaches the other side', b.room.seats.A.force.name === 'Ash Company');

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
  let guard = 0;
  while (a.state && a.state.phase === 'deploy' && guard++ < 400) {
    const side = a.state.ui.placing;
    if (!side) break;
    both[side].send('intent', { intent: { k: 'autodeploy' } });
    await a.settle(40);
  }
  ok('both forces are on the table', a.state.ui.deployDone === true);

  a.send('intent', { intent: { k: 'start' } });
  await a.settle(200);
  ok('the battle is under way', a.state.phase === 'battle');
  ok('initiative was rolled on the server', !!a.state.initiative);

  /* ---- reconnecting mid-battle ---- */
  const c = await new Client('Brann').open(URL);
  c.id = b.id;                       // the same browser, coming back
  b.close();
  await wait(120);
  c.hello();
  const back = await c.until('game');
  ok('a dropped player walks back into their seat', seatOf(back.room, c.id) === 'B');
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

  ok('the battle reached a result', !!a.over, 'after ' + guard + ' activations');
  ok('both sides were told', !!both.B.over);
  if (a.over) {
    ok('a report came with it', Array.isArray(a.over.report.units) && a.over.report.units.length > 0);
    ok('the result is the same on both screens',
      JSON.stringify(a.over.over) === JSON.stringify(both.B.over.over));
  }
  ok('the show was sent as well as the score', a.events.some((e) => e.e === 'shoot' || e.e === 'move'));
  ok('the log came down the wire', a.events.filter((e) => e.e === 'log').length > 10);
  ok('the dice came down the wire', a.events.some((e) => e.e === 'card' && e.card.dice));


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
