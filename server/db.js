/* The server's database: one SQLite file in the data directory, through
   better-sqlite3 (multiplayer plan, decision 1). Every query the server makes is
   here, so nothing else needs to know it is SQL.

   The schema grows by numbered migrations, each run once, in order, and
   remembered in SQLite's own user_version: a database from any earlier build is
   brought up to date when the server starts. */
'use strict';
const path = require('path');
const fs = require('fs');

const MIGRATIONS = [
  // 1: accounts, and the sessions that keep a browser signed in
  `CREATE TABLE users (
     id      INTEGER PRIMARY KEY,
     name    TEXT NOT NULL UNIQUE COLLATE NOCASE,
     pass    TEXT NOT NULL,
     pub     TEXT NOT NULL UNIQUE,
     admin   INTEGER NOT NULL DEFAULT 0,
     created INTEGER NOT NULL,
     seen    INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token   TEXT PRIMARY KEY,
     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
     guest   TEXT,
     pub     TEXT NOT NULL,
     created INTEGER NOT NULL,
     expires INTEGER NOT NULL,
     used    INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);`,
  /* 2: battles, kept as they are played (phase 2). A battle is its config, the
     seed its dice were rolled from, and every intent in order: played through
     again, the same dice give the same battle (net.js keeps one the same way). */
  `CREATE TABLE games (
     id       INTEGER PRIMARY KEY,
     code     TEXT NOT NULL,
     name     TEXT NOT NULL,
     status   TEXT NOT NULL,          -- battle | over | abandoned
     settings TEXT NOT NULL,          -- the room's terms (JSON)
     seats    TEXT NOT NULL,          -- { A: { id, pub, name, force }, B: ... } (JSON)
     seat_a   TEXT,                   -- who sits where, by their identity (u<user> or g<guest>)
     seat_b   TEXT,
     cfg      TEXT NOT NULL,          -- what the engine was started with (JSON)
     seed     INTEGER NOT NULL,
     result   TEXT,                   -- { winner, forfeit?, over } once it is over (JSON)
     created  INTEGER NOT NULL,
     updated  INTEGER NOT NULL
   );
   CREATE INDEX games_a ON games(seat_a, updated);
   CREATE INDEX games_b ON games(seat_b, updated);
   CREATE INDEX games_status ON games(status);
   CREATE TABLE game_intents (
     game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
     seq     INTEGER NOT NULL,
     seat    TEXT NOT NULL,
     intent  TEXT NOT NULL,
     at      INTEGER NOT NULL,
     PRIMARY KEY (game_id, seq)
   );`,
  /* 3: a signed-in player's campaigns, kept whole (decision 7), with the version
     they were last saved at: a save made from an older copy is refused, so two
     devices never quietly overwrite each other (phase 3a). */
  `CREATE TABLE campaigns (
     id      INTEGER PRIMARY KEY,
     owner   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     kind    TEXT NOT NULL,           -- solo | hotseat (online: phase 3b)
     name    TEXT NOT NULL,
     turn    INTEGER NOT NULL DEFAULT 0,
     state   TEXT NOT NULL,           -- the campaign (JSON)
     version INTEGER NOT NULL DEFAULT 1,
     created INTEGER NOT NULL,
     updated INTEGER NOT NULL
   );
   CREATE INDEX campaigns_owner ON campaigns(owner, updated);`,
  /* 4: online campaigns (phase 3b): the two players in each, and the code that
     brings the second one in. */
  `CREATE TABLE campaign_members (
     campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
     user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     side        TEXT NOT NULL,
     joined      INTEGER NOT NULL,
     PRIMARY KEY (campaign_id, side)
   );
   CREATE UNIQUE INDEX members_user ON campaign_members(campaign_id, user_id);
   ALTER TABLE campaigns ADD COLUMN invite TEXT;
   CREATE UNIQUE INDEX campaigns_invite ON campaigns(invite);`
];

function open(file) {
  const Database = require('better-sqlite3');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');        // readers are not held up by a write
  db.pragma('foreign_keys = ON');
  migrate(db);
  return wrap(db);
}

function migrate(db) {
  const at = db.pragma('user_version', { simple: true });
  for (let v = at; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma('user_version = ' + (v + 1));
    })();
  }
}

/* The queries, prepared once. Times are milliseconds since 1970. */
function wrap(db) {
  const q = {
    userByName: db.prepare('SELECT * FROM users WHERE name = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    addUser: db.prepare('INSERT INTO users (name, pass, pub, admin, created, seen) VALUES (?, ?, ?, ?, ?, ?)'),
    setPass: db.prepare('UPDATE users SET pass = ? WHERE id = ?'),
    setAdmin: db.prepare('UPDATE users SET admin = ? WHERE id = ?'),
    seen: db.prepare('UPDATE users SET seen = ? WHERE id = ?'),
    users: db.prepare('SELECT id, name, admin, created, seen FROM users ORDER BY name'),
    countUsers: db.prepare('SELECT COUNT(*) n FROM users'),
    addSession: db.prepare('INSERT INTO sessions (token, user_id, guest, pub, created, expires, used) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    session: db.prepare('SELECT * FROM sessions WHERE token = ?'),
    renew: db.prepare('UPDATE sessions SET expires = ?, used = ? WHERE token = ?'),
    dropSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    dropSessionsOf: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?'),
    dropAllSessionsOf: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    dropExpired: db.prepare('DELETE FROM sessions WHERE expires < ?'),
    addGame: db.prepare('INSERT INTO games (code, name, status, settings, seats, seat_a, seat_b, cfg, seed, created, updated) VALUES (?, ?, \'battle\', ?, ?, ?, ?, ?, ?, ?, ?)'),
    game: db.prepare('SELECT * FROM games WHERE id = ?'),
    gameByCode: db.prepare('SELECT * FROM games WHERE code = ? AND status = \'battle\' ORDER BY id DESC'),
    liveGames: db.prepare('SELECT * FROM games WHERE status = \'battle\' ORDER BY id'),
    addIntent: db.prepare('INSERT INTO game_intents (game_id, seq, seat, intent, at) VALUES (?, ?, ?, ?, ?)'),
    touch: db.prepare('UPDATE games SET updated = ? WHERE id = ?'),
    intents: db.prepare('SELECT seat, intent FROM game_intents WHERE game_id = ? ORDER BY seq'),
    endGame: db.prepare('UPDATE games SET status = ?, result = ?, updated = ? WHERE id = ? AND status = \'battle\''),
    mine: db.prepare('SELECT id, code, name, status, seats, seat_a, seat_b, result, created, updated FROM games WHERE seat_a = ? OR seat_b = ? ORDER BY updated DESC LIMIT ?'),
    addCampaign: db.prepare('INSERT INTO campaigns (owner, kind, name, turn, state, version, created, updated) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'),
    campaign: db.prepare('SELECT * FROM campaigns WHERE id = ?'),
    campaignsOf: db.prepare('SELECT id, kind, name, turn, version, created, updated FROM campaigns WHERE owner = ? ORDER BY updated DESC'),
    saveCampaign: db.prepare('UPDATE campaigns SET state = ?, name = ?, turn = ?, kind = ?, version = version + 1, updated = ? WHERE id = ? AND owner = ? AND version = ?'),
    dropCampaign: db.prepare('DELETE FROM campaigns WHERE id = ? AND owner = ?'),
    setInvite: db.prepare('UPDATE campaigns SET invite = ? WHERE id = ?'),
    byInvite: db.prepare('SELECT * FROM campaigns WHERE invite = ?'),
    addMember: db.prepare('INSERT INTO campaign_members (campaign_id, user_id, side, joined) VALUES (?, ?, ?, ?)'),
    members: db.prepare('SELECT m.side, m.user_id, u.name, u.pub FROM campaign_members m JOIN users u ON u.id = m.user_id WHERE m.campaign_id = ? ORDER BY m.side'),
    onlineOf: db.prepare("SELECT c.id, c.name, c.turn, c.version, c.updated, m.side FROM campaign_members m JOIN campaigns c ON c.id = m.campaign_id WHERE m.user_id = ? AND c.kind = 'online' ORDER BY c.updated DESC"),
    // an online campaign is saved by whichever of its players sent the command: not only its owner
    saveOnline: db.prepare("UPDATE campaigns SET state = ?, name = ?, turn = ?, version = version + 1, updated = ? WHERE id = ? AND kind = 'online' AND version = ?")
  };
  const addIntent = db.transaction((gameId, seq, seat, it, at) => {
    q.addIntent.run(gameId, seq, seat, JSON.stringify(it), at);
    q.touch.run(at, gameId);
  });
  const parse = (g) => g && Object.assign({}, g, {
    settings: JSON.parse(g.settings), seats: JSON.parse(g.seats), cfg: g.cfg ? JSON.parse(g.cfg) : null,
    result: g.result ? JSON.parse(g.result) : null
  });
  return {
    raw: db,
    userByName: (name) => q.userByName.get(name),
    userById: (id) => q.userById.get(id),
    addUser: (u) => q.addUser.run(u.name, u.pass, u.pub, u.admin ? 1 : 0, u.created, u.created).lastInsertRowid,
    setPass: (id, pass) => q.setPass.run(pass, id),
    setAdmin: (id, on) => q.setAdmin.run(on ? 1 : 0, id),
    seen: (id, at) => q.seen.run(at, id),
    users: () => q.users.all(),
    countUsers: () => q.countUsers.get().n,
    addSession: (s) => q.addSession.run(s.token, s.userId || null, s.guest || null, s.pub, s.created, s.expires, s.created),
    session: (token) => q.session.get(token),
    renew: (token, expires, used) => q.renew.run(expires, used, token),
    dropSession: (token) => q.dropSession.run(token),
    // every other session of a user (a password changed: the other devices signed out)
    dropOtherSessions: (userId, keep) => q.dropSessionsOf.run(userId, keep || ''),
    dropAllSessions: (userId) => q.dropAllSessionsOf.run(userId),
    dropExpired: (at) => q.dropExpired.run(at).changes,
    // ---- battles (phase 2) ----
    addGame: (g) => q.addGame.run(g.code, g.name, JSON.stringify(g.settings), JSON.stringify(g.seats), g.seatA, g.seatB,
      JSON.stringify(g.cfg), g.seed, g.at, g.at).lastInsertRowid,
    game: (id) => parse(q.game.get(id)),
    gameByCode: (code) => parse(q.gameByCode.get(code)),
    liveGames: () => q.liveGames.all().map(parse),
    // one intent, in order, written before anyone is told what came of it
    addIntent: (gameId, seq, seat, it, at) => addIntent(gameId, seq, seat, it, at),
    intents: (gameId) => q.intents.all(gameId).map((r) => ({ seat: r.seat, intent: JSON.parse(r.intent) })),
    // over (or abandoned): only once — a battle already finished is left as it was
    endGame: (id, status, result, at) => q.endGame.run(status, JSON.stringify(result), at, id).changes > 0,
    // a player's games, the latest first (the cfg left out: it is large, and not wanted for a list)
    mine: (who, n) => q.mine.all(who, who, n || 20).map((g) => Object.assign({}, g, { seats: JSON.parse(g.seats), result: g.result ? JSON.parse(g.result) : null })),
    // ---- campaigns (phase 3a) ----
    addCampaign: (c) => q.addCampaign.run(c.owner, c.kind, c.name, c.turn || 0, JSON.stringify(c.state), c.at, c.at).lastInsertRowid,
    campaign: (id) => { const c = q.campaign.get(id); return c && Object.assign({}, c, { state: JSON.parse(c.state) }); },
    campaignsOf: (owner) => q.campaignsOf.all(owner),
    // saved only over the version it was read at: false if someone has saved it since (or it is not theirs)
    saveCampaign: (c) => q.saveCampaign.run(JSON.stringify(c.state), c.name, c.turn || 0, c.kind, c.at, c.id, c.owner, c.version).changes > 0,
    dropCampaign: (id, owner) => q.dropCampaign.run(id, owner).changes > 0,
    // ---- online campaigns (phase 3b) ----
    setInvite: (id, code) => q.setInvite.run(code, id),
    byInvite: (code) => { const c = q.byInvite.get(code); return c && Object.assign({}, c, { state: JSON.parse(c.state) }); },
    addMember: (id, userId, side, at) => q.addMember.run(id, userId, side, at),
    members: (id) => q.members.all(id),
    onlineOf: (userId) => q.onlineOf.all(userId),
    saveOnline: (c) => q.saveOnline.run(JSON.stringify(c.state), c.name, c.turn || 0, c.at, c.id, c.version).changes > 0,
    transaction: (fn) => db.transaction(fn)(),
    // a copy of the whole database, consistent, while it is in use (the nightly backup)
    backup: (to) => db.backup(to),
    close: () => db.close()
  };
}

module.exports = { open: open, MIGRATIONS: MIGRATIONS };
