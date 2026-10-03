/* The database copied once a day (multiplayer plan, phase 5): a consistent copy
   made while the server runs (better-sqlite3's backup), kept in a folder of its
   own beside the database, the last week of them kept and older ones removed.

     BACKUP_DIR    where the copies go (default: backups/ beside the database)
     BACKUP_KEEP   how many to keep (default 7)
     BACKUPS=off   none at all

   It looks every few hours whether the newest copy is a day old, so a server
   restarted often still makes one a day, and one that was off for a week makes
   one as soon as it is back. */
'use strict';
const fs = require('fs');
const path = require('path');

const DAY = 24 * 60 * 60 * 1000;
const NAME = /^pmc-(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})\.db$/;

function create(opts) {
  const db = opts.db, dir = opts.dir, log = opts.log || function () { };
  const keep = Math.max(1, +opts.keep || 7);
  const now = opts.now || Date.now;
  let timer = null, busy = false;

  // the copies there are, the newest first: { file, at }
  function list() {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return []; }
    return names.map((n) => {
      const m = NAME.exec(n);
      return m ? { file: path.join(dir, n), at: Date.parse(m[1] + 'T' + m[2] + ':' + m[3] + ':00Z') } : null;
    }).filter(Boolean).sort((a, b) => b.at - a.at);
  }
  // one copy now, then the oldest beyond the week removed
  async function make() {
    if (busy) return null;
    busy = true;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date(now()).toISOString().slice(0, 16).replace(':', '');
      const file = path.join(dir, 'pmc-' + stamp + '.db');
      await db.backup(file);
      list().slice(keep).forEach((b) => { try { fs.unlinkSync(b.file); } catch (e) { } });
      log('database backed up to ' + file);
      return file;
    } catch (e) {
      log('the database backup failed: ' + ((e && e.message) || e));
      return null;
    } finally { busy = false; }
  }
  // a copy if the newest is a day old (or there is none)
  function due() {
    const last = list()[0];
    return !last || now() - last.at >= DAY;
  }
  function check() { return due() ? make() : Promise.resolve(null); }

  return {
    list: list, make: make, due: due, check: check,
    // looked at a minute after starting, then every few hours
    start(every) {
      if (timer) return;
      setTimeout(() => { check(); }, 60 * 1000).unref();
      timer = setInterval(() => { check(); }, every || 3 * 60 * 60 * 1000);
      timer.unref();
    },
    stop() { if (timer) clearInterval(timer); timer = null; },
    dir: dir, keep: keep
  };
}

module.exports = { create: create };
