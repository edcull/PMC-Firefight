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
   CREATE INDEX sessions_user ON sessions(user_id);`
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
    dropExpired: db.prepare('DELETE FROM sessions WHERE expires < ?')
  };
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
    // a copy of the whole database, consistent, while it is in use (the nightly backup)
    backup: (to) => db.backup(to),
    close: () => db.close()
  };
}

module.exports = { open: open, MIGRATIONS: MIGRATIONS };
