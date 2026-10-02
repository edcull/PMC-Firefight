#!/usr/bin/env node
/* Looking after the accounts from the command line, on the machine the server
   runs on. There is no email, so a forgotten password is reset here.

     node server/admin.js users
     node server/admin.js create <name> <password> [admin]
     node server/admin.js reset-password <name> <new password>
     node server/admin.js admin <name> on|off
     node server/admin.js backup [file]      a consistent copy, safe while the server runs

   DATA_DIR says where the database is, as for the server (default: data/ beside server.js). */
'use strict';
const path = require('path');
const DB = require('./db.js');
const Auth = require('./auth.js');

// where the server keeps it: the same rule as server.js
const DATA = process.env.DATA_DIR || (process.env.CAMPAIGNS_DIR ? path.dirname(path.resolve(process.env.CAMPAIGNS_DIR)) : path.join(__dirname, '..', 'data'));
const FILE = path.join(DATA, 'pmc.db');

async function main(argv) {
  const db = DB.open(FILE), auth = Auth.create({ db: db });
  const [cmd, a, b, c] = argv;
  const say = (t) => console.log(t);
  try {
    if (cmd === 'users') {
      const all = db.users();
      if (!all.length) say('No accounts yet.');
      all.forEach((u) => say(u.name + (u.admin ? '  (admin)' : '') + '  made ' + new Date(u.created).toISOString().slice(0, 10) +
        ', last seen ' + new Date(u.seen).toISOString().slice(0, 10)));
      return 0;
    }
    if (cmd === 'create') {
      const r = await auth.createUser(a, b, c === 'admin');
      say(r.ok ? 'Made ' + a + '.' : r.why);
      return r.ok ? 0 : 1;
    }
    if (cmd === 'reset-password') {
      const r = await auth.resetPassword(a, b);
      say(r.ok ? a + '’s password is changed, and every device of theirs signed out.' : r.why);
      return r.ok ? 0 : 1;
    }
    if (cmd === 'admin') {
      const u = db.userByName(a);
      if (!u) { say('No account called ' + a + '.'); return 1; }
      db.setAdmin(u.id, b !== 'off');
      say(u.name + (b !== 'off' ? ' is now an admin.' : ' is no longer an admin.'));
      return 0;
    }
    if (cmd === 'backup') {
      const to = a || path.join(DATA, 'backup-' + new Date().toISOString().slice(0, 10) + '.db');
      await db.backup(to);
      say('Backed up to ' + to);
      return 0;
    }
    say('Usage: node server/admin.js users | create <name> <password> [admin] | reset-password <name> <password> | admin <name> on|off | backup [file]');
    return cmd ? 1 : 0;
  } finally { db.close(); }
}

if (require.main === module) main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
module.exports = { main: main };
