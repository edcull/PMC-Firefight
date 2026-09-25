/* The lobby: who is connected, what rooms exist, and who sits where.

   The lobby knows nothing about the rules. It gathers two players, their forces
   and a set of options, and when both say they are ready it hands the whole lot
   to the table layer, which owns the battle from there. Everything below is
   bookkeeping and broadcasting. */
'use strict';
const P = require('../src/engine/protocol.js');
// how long a seat is kept in setup for someone who dropped out (a refresh, a phone gone to sleep)
const HOLD_SETUP_MS = 3 * 60 * 1000;

function now() { return Date.now(); }

function code() {
  // short enough to read out across a room, long enough not to collide
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

class Player {
  constructor(sock) {
    this.sock = sock;
    this.id = null;              // the browser's own, so a refresh keeps the seat
    this.name = 'Commander';
    this.room = null;
    this.seat = null;            // 'A', 'B' or null for a watcher
    this.ready = false;
    this.force = null;
    this.at = now();
  }
  send(t, body) {
    if (!this.sock || !this.sock.open) return;
    this.sock.send(JSON.stringify(body ? Object.assign({ t: t }, body) : { t: t }));
  }
  fail(text, fatal) { this.send('error', { text: text, fatal: !!fatal }); }
}

class Room {
  constructor(name, host) {
    this.id = code();
    this.name = name || (host.name + ' vs all comers');
    this.host = host.name;
    this.hostId = host.id;
    this.phase = P.PHASE.SETUP;
    this.seats = { A: null, B: null };
    this.watchers = [];
    this.settings = P.defaultSettings();
    this.chat = [];
    this.table = null;           // the live battle, once it starts
    this.at = now();
  }

  everyone() {
    const out = [];
    if (this.seats.A) out.push(this.seats.A);
    if (this.seats.B) out.push(this.seats.B);
    return out.concat(this.watchers);
  }
  players() { return [this.seats.A, this.seats.B].filter(Boolean); }
  isHost(p) { return !!p && p.id === this.hostId; }
  freeSeat() { return !this.seats.A ? 'A' : !this.seats.B ? 'B' : null; }
  bothReady() {
    return !!(this.seats.A && this.seats.B && this.seats.A.ready && this.seats.B.ready);
  }

  /* The room as someone in it sees it. A watcher sees the same: before the
     battle the forces are the whole point of the screen, and after it starts
     they are on the table anyway. */
  view() {
    const seat = (s) => {
      const p = this.seats[s];
      if (!p) return null;
      return {
        seat: s, id: p.id, name: p.name, ready: p.ready, force: p.force,
        host: p.id === this.hostId, away: !p.sock
      };
    };
    return {
      id: this.id, name: this.name, phase: this.phase, hostId: this.hostId,
      settings: this.settings,
      seats: { A: seat('A'), B: seat('B') },
      watchers: this.watchers.map((w) => ({ id: w.id, name: w.name })),
      canStart: this.bothReady(),
      chat: this.chat.slice(-40)
    };
  }

  broadcast(t, body) {
    const msg = JSON.stringify(body ? Object.assign({ t: t }, body) : { t: t });
    this.everyone().forEach((p) => { if (p.sock && p.sock.open) p.sock.send(msg); });
  }
  push() { this.everyone().forEach((p) => p.send('game', { room: this.view() })); }
}

class Lobby {
  constructor(opts) {
    opts = opts || {};
    this.players = new Set();
    this.rooms = new Map();
    this.chat = [];
    this.makeTable = opts.makeTable || null;   // (room, lobby) => Table, injected
    this.log = opts.log || function () { };
  }

  /* ---- connections ---- */
  connect(sock) {
    const p = new Player(sock);
    this.players.add(p);
    sock.on('message', (text) => {
      let msg;
      try { msg = JSON.parse(text); }
      catch (e) { p.fail('unreadable message'); return; }
      if (!msg || typeof msg.t !== 'string') { p.fail('unreadable message'); return; }
      try { this.handle(p, msg); }
      catch (e) {
        this.log('handler error on ' + msg.t + ': ' + ((e && e.stack) || e));
        p.fail('the server could not deal with that');
      }
    });
    sock.on('close', () => this.disconnect(p));
    return p;
  }

  disconnect(p) {
    this.players.delete(p);
    const room = p.room;
    if (!room) return;
    /* A battle in progress is not abandoned because someone's wifi dropped: the
       seat is held, marked away, and the room stays up. A room still in setup
       with nobody left in it goes. */
    if (room.phase === P.PHASE.BATTLE && p.seat) {
      p.sock = null;
      room.broadcast('game.chat', { from: null, text: p.name + ' has dropped out — the seat is being held.', at: now() });
      room.push();
      this.pushLobby();
      return;
    }
    /* In setup a refresh, or a phone locking its screen, should not cost the seat
       and the force built for it either: it is held for a while, and given up only
       if they do not come back. */
    if (room.phase === P.PHASE.SETUP && p.seat) {
      p.sock = null;
      room.push();
      this.pushLobby();
      const t = setTimeout(() => {
        if (!p.sock && p.room === room && room.seats[p.seat] === p) this.leave(p);
      }, HOLD_SETUP_MS);
      if (t.unref) t.unref();
      return;
    }
    this.leave(p);
  }

  /* ---- routing ---- */
  handle(p, msg) {
    if (msg.t === 'hello') return this.hello(p, msg);
    if (msg.t === 'ping') return p.send('pong');
    if (!p.id) return p.fail('say hello first');
    switch (msg.t) {
      case 'lobby.chat': return this.lobbyChat(p, msg);
      case 'game.create': return this.create(p, msg);
      case 'game.join': return this.join(p, msg);
      case 'game.leave': return this.leave(p);
      case 'game.seat': return this.takeSeat(p, msg);
      case 'game.kick': return this.kick(p, msg);
      case 'game.settings': return this.settings(p, msg);
      case 'game.force': return this.setForce(p, msg);
      case 'game.ready': return this.setReady(p, msg);
      case 'game.start': return this.start(p);
      case 'game.chat': return this.gameChat(p, msg);
      case 'intent': return this.intent(p, msg);
      case 'resync': return this.resync(p);
      default: return p.fail('unknown message: ' + msg.t);
    }
  }

  hello(p, msg) {
    p.id = P.clampText(msg.playerId, 64) || ('anon-' + Math.random().toString(36).slice(2, 10));
    p.name = P.clampText(msg.name, P.LIMITS.name) || 'Commander';
    /* A reconnect: the same browser coming back to a seat still being held for
       it. Find that room and put them back in it. */
    let rejoined = null;
    this.rooms.forEach((room) => {
      P.SEATS.forEach((s) => {
        const held = room.seats[s];
        if (!held || held.sock || held.id !== p.id) return;
        room.seats[s] = p;
        p.room = room; p.seat = s; p.ready = held.ready; p.force = held.force;
        rejoined = room;
      });
    });
    p.send('welcome', {
      you: { id: p.id, name: p.name },
      games: this.list(),
      chat: this.chat.slice(-40)
    });
    if (!rejoined) return;
    rejoined.broadcast('game.chat', { from: null, text: p.name + ' is back.', at: now() });
    rejoined.push();
    if (rejoined.table) rejoined.table.rejoin(p);
    this.pushLobby();
  }

  /* ---- the lobby proper ---- */
  list() {
    const out = [];
    this.rooms.forEach((r) => out.push(P.summarise(r)));
    out.sort((a, b) => b.at - a.at);
    return out;
  }
  pushLobby() {
    const msg = JSON.stringify({ t: 'lobby', games: this.list() });
    this.players.forEach((p) => { if (p.sock && p.sock.open) p.sock.send(msg); });
  }

  lobbyChat(p, msg) {
    const text = P.clampText(msg.text, P.LIMITS.chat);
    if (!text) return;
    const line = { from: p.name, text: text, at: now() };
    this.chat.push(line);
    if (this.chat.length > P.LIMITS.chatLog) this.chat.shift();
    const out = JSON.stringify(Object.assign({ t: 'lobby.chat' }, line));
    this.players.forEach((q) => { if (q.sock && q.sock.open) q.sock.send(out); });
  }

  /* ---- rooms ---- */
  create(p, msg) {
    if (this.rooms.size >= P.LIMITS.rooms) return p.fail('the server is full of games — try again shortly');
    if (p.room) this.leave(p);
    const room = new Room(P.clampText(msg.name, P.LIMITS.name), p);
    P.cleanSettings(msg.settings, room.settings);
    room.seats.A = p;
    p.room = room; p.seat = 'A'; p.ready = false;
    p.force = P.cleanForce(msg.force, 'A');
    this.rooms.set(room.id, room);
    this.log('room ' + room.id + ' opened by ' + p.name);
    room.push();
    this.pushLobby();
  }

  join(p, msg) {
    const room = this.rooms.get(P.clampText(msg.id, 16).toUpperCase());
    if (!room) return p.fail('no game with that code');
    if (p.room === room) return room.push();
    if (p.room) this.leave(p);
    const seat = room.phase === P.PHASE.SETUP ? room.freeSeat() : null;
    p.room = room;
    if (seat) {
      room.seats[seat] = p;
      p.seat = seat; p.ready = false;
      p.force = P.cleanForce(null, seat);
    } else {
      p.seat = null;
      room.watchers.push(p);
    }
    room.broadcast('game.chat', {
      from: null,
      text: p.name + (seat ? ' takes seat ' + seat + '.' : ' is watching.'),
      at: now()
    });
    room.push();
    // walking in on a battle already being fought: the board, then the table as it stands
    if (room.table) room.table.rejoin(p);
    this.pushLobby();
  }

  leave(p) {
    const room = p.room;
    if (!room) return;
    if (p.seat && room.seats[p.seat] === p) room.seats[p.seat] = null;
    const w = room.watchers.indexOf(p);
    if (w >= 0) room.watchers.splice(w, 1);
    p.room = null; p.seat = null; p.ready = false;

    if (!room.everyone().length) {
      if (room.table) room.table.stop();
      this.rooms.delete(room.id);
      this.log('room ' + room.id + ' closed');
    } else {
      // the host walking away hands the room to whoever is still there
      if (room.hostId === p.id) {
        const heir = room.players()[0] || room.watchers[0];
        if (heir) { room.hostId = heir.id; room.host = heir.name; }
      }
      /* A player leaving a live battle for good ends it: there is no third
         party to take the seat over, and the room goes back to setup so the
         rest can arrange another one. */
      if (room.phase === P.PHASE.BATTLE) {
        if (room.table) { room.table.stop(); room.table = null; }
        room.phase = P.PHASE.SETUP;
      }
      room.players().forEach((q) => { q.ready = false; });
      room.broadcast('game.chat', { from: null, text: p.name + ' has left.', at: now() });
      room.push();
    }
    p.send('game', { room: null });
    this.pushLobby();
  }

  kick(p, msg) {
    const room = p.room;
    if (!room || !room.isHost(p)) return p.fail('only the host can do that');
    const who = room.everyone().filter((q) => q.id === msg.playerId)[0];
    if (!who || who === p) return;
    who.fail('the host has removed you from the game');
    this.leave(who);
  }

  takeSeat(p, msg) {
    const room = p.room;
    if (!room) return p.fail('you are not in a game');
    if (room.phase !== P.PHASE.SETUP) return p.fail('the battle has started');
    const want = msg.seat === 'watch' ? null : P.oneOf(msg.seat, P.SEATS, null);
    if (want && room.seats[want] && room.seats[want] !== p) return p.fail('that seat is taken');
    if (p.seat && room.seats[p.seat] === p) room.seats[p.seat] = null;
    const w = room.watchers.indexOf(p);
    if (w >= 0) room.watchers.splice(w, 1);
    p.ready = false;
    if (want) {
      room.seats[want] = p; p.seat = want;
      if (!p.force) p.force = P.cleanForce(null, want);
    } else {
      p.seat = null;
      room.watchers.push(p);
    }
    room.push();
    this.pushLobby();
  }

  settings(p, msg) {
    const room = p.room;
    if (!room || !room.isHost(p)) return p.fail('only the host sets the terms');
    if (room.phase !== P.PHASE.SETUP) return p.fail('the battle has started');
    P.cleanSettings(msg.patch, room.settings);
    // the terms changed under them, so both sides say yes again
    room.players().forEach((q) => { q.ready = false; });
    room.push();
    this.pushLobby();
  }

  setForce(p, msg) {
    const room = p.room;
    if (!room || !p.seat) return p.fail('only a player has a force');
    if (room.phase !== P.PHASE.SETUP) return p.fail('the battle has started');
    p.force = P.cleanForce(msg.force, p.seat);
    p.ready = false;
    room.push();
  }

  setReady(p, msg) {
    const room = p.room;
    if (!room || !p.seat) return p.fail('only a player can be ready');
    if (room.phase !== P.PHASE.SETUP) return;
    p.ready = !!msg.ready;
    room.push();
    this.pushLobby();
  }

  start(p) {
    const room = p.room;
    if (!room || !room.isHost(p)) return p.fail('only the host starts the battle');
    if (room.phase !== P.PHASE.SETUP) return p.fail('already under way');
    if (!room.bothReady()) return p.fail('both sides must be ready');
    if (!this.makeTable) return p.fail('this server cannot run battles');
    let table;
    try { table = this.makeTable(room, this); }
    catch (e) {
      this.log('could not start ' + room.id + ': ' + ((e && e.stack) || e));
      return room.broadcast('error', { text: 'the battle could not be set up: ' + ((e && e.message) || e) });
    }
    room.table = table;
    room.phase = P.PHASE.BATTLE;
    room.push();
    this.pushLobby();
    table.begin();
  }

  gameChat(p, msg) {
    const room = p.room;
    if (!room) return p.fail('you are not in a game');
    const text = P.clampText(msg.text, P.LIMITS.chat);
    if (!text) return;
    const line = { from: p.name, seat: p.seat, text: text, at: now() };
    room.chat.push(line);
    if (room.chat.length > P.LIMITS.chatLog) room.chat.shift();
    room.broadcast('game.chat', line);
  }

  /* ---- the table ---- */
  intent(p, msg) {
    const room = p.room;
    if (!room || !room.table) return p.fail('no battle is running');
    if (!p.seat) return p.fail('watchers cannot act');
    room.table.intent(p, msg.intent);
  }

  resync(p) {
    const room = p.room;
    if (!room) return p.send('game', { room: null });
    room.push();
    if (room.table) room.table.resync(p);
  }

  /* Called by the table when a battle ends, so the room can be used again. */
  finished(room) {
    room.phase = P.PHASE.OVER;
    room.players().forEach((q) => { q.ready = false; });
    room.push();
    this.pushLobby();
  }
}

module.exports = { Lobby: Lobby, Room: Room, Player: Player };
