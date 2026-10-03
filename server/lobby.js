/* The lobby: who is connected, what rooms exist, and who sits where.

   The lobby knows nothing about the rules. It gathers two players, their forces
   and a set of options, and when both say they are ready it hands the whole lot
   to the table layer, which owns the battle from there. Everything below is
   bookkeeping and broadcasting. */
'use strict';
const crypto = require('crypto');
const P = require('../src/engine/protocol.js');
const Hidden = require('./hidden.js');
// how long a seat is kept in setup for someone who dropped out (a refresh, a phone gone to sleep)
const HOLD_SETUP_MS = 3 * 60 * 1000;
/* Rooms nobody is connected to are put away (MP-7): a battle both players have
   left the browser on is kept a good while (until there is a database to keep it
   in, multiplayer plan phase 2), anything else not long. */
const IDLE_BATTLE_MS = 6 * 60 * 60 * 1000;
// a kept battle nobody is at is put away sooner: it is in the database, and comes back when someone does
const IDLE_KEPT_MS = 30 * 60 * 1000;
const IDLE_ROOM_MS = 10 * 60 * 1000;
/* What one connection may send (MP-8): a bucket of messages that refills, a
   tighter one for chat and one for making and joining rooms. Over it, the
   message is dropped and the sender told (once a second at most); a connection
   that keeps on is closed. */
const LIMITS = {
  all: { per: 1000, n: 40 },        // 40 a second, which no player's hands come near
  chat: { per: 10000, n: 8 },       // 8 lines in 10 seconds
  rooms: { per: 60000, n: 12 }      // 12 rooms made or joined a minute
};
const ROOM_MSGS = { 'game.create': 1, 'game.join': 1 };
const CHAT_MSGS = { 'lobby.chat': 1, 'game.chat': 1 };
function bucket(lim) { return { lim: lim, left: lim.n, at: Date.now() }; }
function take(b) {
  const t = Date.now();
  b.left = Math.min(b.lim.n, b.left + (t - b.at) * b.lim.n / b.lim.per);
  b.at = t;
  if (b.left < 1) return false;
  b.left -= 1;
  return true;
}

function now() { return Date.now(); }

function code() {
  // short enough to read out across a room, long enough not to collide
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

/* Who a browser is (until there are accounts, multiplayer plan phase 1). The
   server gives each new browser a private id and a secret to go with it, and a
   browser coming back must present both: an id alone, which anyone in a room
   could once read off the room, takes nobody's seat any more. What other players
   see is a separate public id, which can be shown to anyone. */
function token(n) { return crypto.randomBytes(n).toString('hex'); }
function same(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const KEEP_IDS = 5000;          // browsers remembered between visits; the oldest forgotten first

class Player {
  constructor(sock, limits) {
    this.sock = sock;
    this.id = null;              // private, issued by the server: a refresh brings it back with its secret
    this.pub = null;             // public: what the room shows of this player
    this.name = 'Commander';
    this.room = null;
    this.seat = null;            // 'A', 'B' or null for a watcher
    this.ready = false;
    this.force = null;
    this.at = now();
    const L = limits || LIMITS;
    this.buckets = { all: bucket(L.all), chat: bucket(L.chat), rooms: bucket(L.rooms) };
    this.slowSaid = 0; this.over = 0;
  }
  // whether this message may go through, by the limits above
  allowed(t) {
    const b = this.buckets;
    const ok = take(b.all) && (!CHAT_MSGS[t] || take(b.chat)) && (!ROOM_MSGS[t] || take(b.rooms));
    this.over = ok ? Math.max(0, this.over - 1) : this.over + 1;
    return ok;
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
    this.idleSince = null;       // when the last connected person in it went
  }
  anyoneHere() { return this.everyone().some((p) => p.sock && p.sock.open); }

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
        seat: s, id: p.pub, name: p.name, ready: p.ready, force: p.force,
        host: p.id === this.hostId, away: !p.sock
      };
    };
    const host = this.everyone().filter((p) => p.id === this.hostId)[0];
    return {
      id: this.id, name: this.name, phase: this.phase, hostId: host ? host.pub : null,
      settings: this.settings,
      seats: { A: seat('A'), B: seat('B') },
      watchers: this.watchers.map((w) => ({ id: w.pub, name: w.name })),
      canStart: this.bothReady(),
      chat: this.chat.slice(-40)
    };
  }

  broadcast(t, body) {
    const msg = JSON.stringify(body ? Object.assign({ t: t }, body) : { t: t });
    this.everyone().forEach((p) => { if (p.sock && p.sock.open) p.sock.send(msg); });
  }
  // each person in it is sent the room as they may see it: the other player's list kept from them (hidden.js)
  push() {
    const v = this.view();
    this.everyone().forEach((p) => p.send('game', { room: Hidden.roomFor(v, p.seat || null) }));
  }
}

class Lobby {
  constructor(opts) {
    opts = opts || {};
    this.players = new Set();
    this.rooms = new Map();
    this.chat = [];
    this.makeTable = opts.makeTable || null;   // (room, lobby) => Table, injected
    this.known = new Map();                     // private id -> { secret, pub }, every browser seen
    this.limits = opts.limits || LIMITS;        // what a connection may send (a test may raise them)
    this.games = opts.games || null;            // the battles kept in the database (games.js), when there is one
    this.onCampaignBattle = opts.onCampaignBattle || null;
    this.listedCampaigns = opts.listedCampaigns || null;   // the online campaigns open to anyone: () => [{ invite, owner, at }]   // an online campaign's battle over: (campaign id, report, game id)
    this.log = opts.log || function () { };
    // rooms nobody is connected to are looked for every minute
    if (opts.sweep !== false) {
      this.sweeper = setInterval(() => this.sweep(), 60000);
      if (this.sweeper.unref) this.sweeper.unref();
    }
  }

  /* Rooms nobody has been connected to for a while are closed (MP-7): a battle
     after IDLE_BATTLE_MS, anything else after IDLE_ROOM_MS. `at` is for the tests. */
  sweep(at) {
    const t = at || now();
    this.rooms.forEach((room) => {
      if (room.anyoneHere()) { room.idleSince = null; return; }
      if (room.idleSince == null) { room.idleSince = t; return; }
      const kept = room.phase === P.PHASE.BATTLE && room.table && room.table.gameId != null;
      const limit = kept ? IDLE_KEPT_MS : room.phase === P.PHASE.BATTLE ? IDLE_BATTLE_MS : IDLE_ROOM_MS;
      if (t - room.idleSince < limit) return;
      if (room.table) room.table.stop();
      this.rooms.delete(room.id);
      this.log('room ' + room.id + (kept ? ' put away (kept, to come back to)' : ' closed') + ': nobody has been in it for ' + Math.round((t - room.idleSince) / 60000) + ' minutes');
    });
    this.pushLobby();
  }

  /* ---- battles kept in the database (phase 2) ---- */
  /* After a restart, every battle still being fought is brought back, its seats
     held for the players, who walk back into them when they reconnect. */
  restore() {
    if (!this.games) return 0;
    let n = 0;
    this.games.live().forEach((g) => { try { if (this.revive(g)) n++; } catch (e) { this.log('could not bring back battle ' + g.code + ': ' + ((e && e.stack) || e)); } });
    if (n) this.log('brought back ' + n + ' battle' + (n === 1 ? '' : 's') + ' in progress');
    return n;
  }
  // one kept battle, as a room in memory again, played back to where it was; null if it turns out to be over
  revive(g) {
    const have = this.rooms.get(g.code);
    if (have && have.table && have.table.gameId === g.id) return have;
    const seats = g.seats || {};
    const host = seats.A || seats.B || { id: null, name: 'Commander' };
    const room = new Room(g.name, { id: host.id, name: host.name });
    // the same code it had, unless another room has it now
    room.id = have ? code() : g.code;
    room.settings = g.settings;
    room.phase = P.PHASE.BATTLE;
    P.SEATS.forEach((sd) => {
      const s = seats[sd];
      if (!s) return;
      const held = new Player(null, this.limits);
      held.id = s.id; held.pub = s.pub; held.name = s.name; held.force = s.force;
      held.seat = sd; held.room = room; held.ready = true;
      room.seats[sd] = held;
    });
    const table = this.makeTable(room, this);
    table.restore(g, this.games.intents(g.id));
    if (table.stopped) {
      // it ended just before the restart: an online campaign still has its aftermath to apply (once, by the game's id)
      if (room.settings && room.settings.onlineCampaign && this.onCampaignBattle && table.engine.report()) {
        try { this.onCampaignBattle(room.settings.onlineCampaign, table.engine.report(), g.id, room.settings.onlineRef || null); }
        catch (e) { this.log('could not apply the campaign battle ' + g.id + ': ' + ((e && e.stack) || e)); }
      }
      return null;
    }
    room.table = table;
    this.rooms.set(room.id, room);
    return room;
  }
  /* Put this connection back in a seat being held for it (a refresh, a dropped
     connection, a restart): the room it is in now, or null. */
  rejoinHeld(p) {
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
    return rejoined;
  }
  welcomeBack(p, room) {
    room.broadcast('game.chat', { from: null, text: p.name + ' is back.', at: now() });
    if (room.phase === P.PHASE.BATTLE) room.broadcast('game.presence', { kind: 'back', id: p.pub, name: p.name, seat: p.seat });
    room.push();
    if (room.table) room.table.rejoin(p);
    this.pushLobby();
  }
  /* An online campaign's battle, made from its contract (online.js): a private room
     with both seats held for the two players, who walk into them by its code. */
  campaignBattle(o) {
    const room = new Room(o.name, { id: o.seats.A.id, name: o.seats.A.name });
    while (this.rooms.has(room.id) || (this.games && this.games.byCode(room.id))) room.id = code();
    room.settings.private = true;
    room.settings.onlineCampaign = o.campaignId;
    room.settings.onlineRef = o.ref || null;          // which of the campaign's battles it is
    room.settings.tier = o.cfg.tier; room.settings.pl = o.cfg.pl; room.settings.scenario = o.cfg.scenario;
    room.phase = P.PHASE.BATTLE;
    // a seat with nobody in it is the AI's side (cfg.mode 'ai'): nobody sits there
    P.SEATS.forEach((sd) => {
      const s = o.seats[sd];
      if (!s) return;
      const held = new Player(null, this.limits);
      held.id = s.id; held.pub = s.pub; held.name = s.name; held.seat = sd; held.room = room; held.ready = true;
      room.seats[sd] = held;
    });
    const table = this.makeTable(room, this);
    room.table = table;
    this.rooms.set(room.id, room);
    table.begin(o.cfg);
    this.log('room ' + room.id + ' opened for an online campaign battle');
    return room.id;
  }
  // a message to every connection a signed-in player has open (an online campaign changed, say)
  notifyUser(userId, msg) {
    const text = JSON.stringify(msg);
    this.players.forEach((p) => { if (p.who && p.who.userId === userId && p.sock && p.sock.open) p.sock.send(text); });
  }
  // a player's own games, the latest first: the ones under way to go back to, and how the rest went
  mine(p) {
    p.send('mine', { games: this.games ? this.games.mine(p.id) : [] });
  }

  /* ---- connections ---- */
  /* `who`: the signed-in player behind this connection (auth.js), when the server
     has accounts. Their identity is that, never anything the connection says. */
  connect(sock, who) {
    const p = new Player(sock, this.limits);
    if (who) { p.who = who; p.id = who.id; p.pub = who.pub; p.name = who.name; }
    this.players.add(p);
    sock.on('message', (text) => {
      let msg;
      try { msg = JSON.parse(text); }
      catch (e) { p.fail('unreadable message'); return; }
      if (!msg || typeof msg.t !== 'string') { p.fail('unreadable message'); return; }
      if (!p.allowed(msg.t)) {
        if (Date.now() - p.slowSaid > 1000) { p.slowSaid = Date.now(); p.fail('slow down — that was too much at once'); }
        // a connection that will not slow down is let go
        if (p.over > 200) { this.log('closing a connection that would not slow down'); try { sock.close(1008, 'too many messages'); } catch (e) { } }
        return;
      }
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
      room.broadcast('game.presence', { kind: 'dropped', id: p.pub, name: p.name, seat: p.seat });
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
      case 'games.mine': return this.mine(p);
      default: return p.fail('unknown message: ' + msg.t);
    }
  }

  hello(p, msg) {
    // signed in: who it is comes from the session; the hello only asks to be welcomed (and rejoined)
    if (p.who && !p.greeted) { p.greeted = true; return this.greet(p, null); }
    // once a connection has said who it is, that stands: a second hello only changes the name (not a signed-in one's)
    if (p.id) {
      if (p.who) { p.send('welcome', { you: { id: p.pub, name: p.name, guest: p.who.guest }, games: this.list(), chat: this.chat.slice(-40) }); return; }
      p.name = P.clampText(msg.name, P.LIMITS.name) || p.name;
      p.send('welcome', { you: { id: p.pub, name: p.name }, games: this.list(), chat: this.chat.slice(-40) });
      if (p.room) p.room.push();
      return;
    }
    const want = P.clampText(msg.playerId, 64), rec = want && this.known.get(want);
    let key = null;
    if (rec && same(rec.secret, msg.secret)) { p.id = want; p.pub = rec.pub; }
    else {
      // new here (or the secret is wrong): a new id, and the secret that goes with it
      p.id = 'p' + token(12); p.pub = 'u' + token(6);
      key = { id: p.id, secret: token(24) };
      this.known.set(p.id, { secret: key.secret, pub: p.pub });
      if (this.known.size > KEEP_IDS) this.known.delete(this.known.keys().next().value);
    }
    p.name = P.clampText(msg.name, P.LIMITS.name) || 'Commander';
    this.greet(p, key);
  }

  greet(p, key) {
    /* A reconnect: the same browser coming back to a seat still being held for
       it. Find that room and put them back in it. */
    const rejoined = this.rejoinHeld(p);
    p.send('welcome', {
      you: { id: p.pub, name: p.name, guest: !!(p.who && p.who.guest) },
      key: key,                  // only to a browser just given one: kept, and presented next time
      games: this.list(),
      chat: this.chat.slice(-40)
    });
    if (rejoined) this.welcomeBack(p, rejoined);
  }

  /* ---- the lobby proper ---- */
  list() {
    const out = [];
    // a private game is not listed: only those given its code can find it
    this.rooms.forEach((r) => { if (!r.settings.private) out.push(P.summarise(r)); });
    // and the online campaigns listed for anyone to join, their second seat open
    if (this.listedCampaigns) {
      try { this.listedCampaigns().forEach((c) => out.push({ online: true, id: c.invite, name: c.owner + '’s campaign', host: c.owner, at: c.at, slots: c.slots || 2, open: c.open || 1 })); } catch (e) { }
    }
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
    // a code nobody else has: not a room's in memory, nor a kept battle's waiting to be come back to
    while (this.rooms.has(room.id) || (this.games && this.games.byCode(room.id))) room.id = code();
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
    const want = P.clampText(msg.id, 16).toUpperCase();
    let room = this.rooms.get(want);
    /* A battle put away (nobody at it for a while) comes back for one of its
       players: played back to where it was, and their seat given back. */
    if (!room && this.games) {
      const g = this.games.byCode(want);
      if (g && (g.seat_a === p.id || g.seat_b === p.id)) {
        try { room = this.revive(g); } catch (e) { this.log('could not bring back ' + want + ': ' + ((e && e.stack) || e)); }
        if (room) {
          if (p.room && p.room !== room) this.leave(p);
          if (this.rejoinHeld(p) === room) { this.welcomeBack(p, room); return; }
        }
      }
    }
    if (!room) return p.fail('no game with that code');
    // one of its players, coming back to the seat held for them
    if (p.room !== room && P.SEATS.some((sd) => room.seats[sd] && !room.seats[sd].sock && room.seats[sd].id === p.id)) {
      if (p.room) this.leave(p);
      if (this.rejoinHeld(p) === room) { this.welcomeBack(p, room); return; }
    }
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
    const seat = p.seat && room.seats[p.seat] === p ? p.seat : null;
    if (seat) room.seats[seat] = null;
    const w = room.watchers.indexOf(p);
    if (w >= 0) room.watchers.splice(w, 1);
    p.room = null; p.seat = null; p.ready = false;

    /* The only player at a battle against the AI (an online campaign's) walking
       away: a forfeit all the same, so the campaign has its result to apply. */
    if (!room.everyone().length && room.phase === P.PHASE.BATTLE && seat && room.table && !room.table.stopped) room.table.forfeit(seat);
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
      if (room.phase === P.PHASE.BATTLE && seat) {
        // a forfeit (decision 5): the side still at the table wins, and it is kept so
        const winner = room.table ? room.table.forfeit(seat) : null;
        if (room.table) { room.table.stop(); room.table = null; }
        room.phase = P.PHASE.SETUP;
        // said to the board as well as the chat: the battle on the screen is over
        room.broadcast('game.presence', { kind: 'left', id: p.pub, name: p.name, seat: seat, forfeit: !!winner, winner: winner });
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
    const who = room.everyone().filter((q) => q.pub === msg.playerId)[0];
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
    // a battle that cannot be laid out goes back to setup, rather than leaving the room stuck in it (MP-7)
    try { table.begin(); }
    catch (e) {
      this.log('could not begin ' + room.id + ': ' + ((e && e.stack) || e));
      try { table.stop(); } catch (e2) { }
      room.table = null;
      room.phase = P.PHASE.SETUP;
      room.players().forEach((q) => { q.ready = false; });
      room.broadcast('error', { text: 'the battle could not be set up: ' + ((e && e.message) || e) });
      room.push();
      this.pushLobby();
    }
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

  /* Called by the table when a battle ends. The room goes back to setup with both
     forces as they were (MP-7): ready up again for a rematch, change the terms or
     the forces first, or leave. */
  /* An admin closing a battle that has stuck (adminapi.js): its players told and
     put back in the lobby, the battle kept as abandoned with no winner. True if
     there was one, open here or kept as still under way. */
  adminClose(code) {
    const room = this.rooms.get(code);
    let found = false;
    if (room && room.phase === P.PHASE.BATTLE) {
      found = true;
      const t = room.table;
      if (t && t.store && t.gameId != null) { try { t.store.ended(t.gameId, 'abandoned', { winner: null, closed: 'admin' }); } catch (e) { } }
      if (t) t.stop();
      room.broadcast('game.presence', { kind: 'left', id: null, name: 'An admin', seat: null, forfeit: false, winner: null });
      room.everyone().forEach((p) => { p.room = null; p.seat = null; p.ready = false; p.send('game', { room: null }); });
      this.rooms.delete(code);
      this.pushLobby();
    }
    // kept as under way, but not open here (put away): ended as well
    if (this.games) {
      const g = this.games.byCode(code);
      if (g) { found = true; try { this.games.ended(g.id, 'abandoned', { winner: null, closed: 'admin' }); } catch (e) { } }
    }
    return found;
  }

  finished(room, report, gameId) {
    // an online campaign's battle: the campaign is told, to apply its aftermath (once, by the game's id)
    if (room.settings.onlineCampaign && this.onCampaignBattle && report) {
      try { this.onCampaignBattle(room.settings.onlineCampaign, report, gameId, room.settings.onlineRef || null); }
      catch (e) { this.log('could not apply the campaign battle ' + gameId + ': ' + ((e && e.stack) || e)); }
    }
    room.table = null;
    /* An online campaign's battle is fought once: there is no rematch, so the room
       closes and its players go back to the lobby (the campaign carries on in the
       dossier). */
    if (room.settings.onlineCampaign) {
      room.everyone().forEach((q) => { q.room = null; q.seat = null; q.ready = false; if (q.sock) q.send('game', { room: null }); });
      room.seats = { A: null, B: null }; room.watchers = [];
      this.rooms.delete(room.id);
      this.log('room ' + room.id + ' closed: its online campaign battle is over');
      this.pushLobby();
      return;
    }
    room.phase = P.PHASE.SETUP;
    room.players().forEach((q) => { q.ready = false; });
    room.broadcast('game.chat', { from: null, text: 'The battle is over. Ready up for a rematch, or leave the game.', at: now() });
    room.push();
    this.pushLobby();
  }
}

module.exports = { Lobby: Lobby, Room: Room, Player: Player, LIMITS: LIMITS };
