/* The database copied once a day (multiplayer plan, phase 5): a copy made when
   there is none, none again within the day, another a day on; the copy a working
   database with what the original held; only the last ones kept. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const DB = require('../../server/db.js');
const Backups = require('../../server/backups.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-bk-'));
  const db = DB.open(path.join(dir, 'pmc.db'));
  db.addUser({ name: 'Ash', pass: 'x', pub: 'u1', admin: false, created: 1, email: 'ash@example.com' });
  let clock = Date.parse('2026-10-03T02:00:00Z');
  const said = [];
  const bk = Backups.create({ db: db, dir: path.join(dir, 'backups'), keep: 3, now: () => clock, log: (t) => said.push(t) });

  console.log('\nOnce a day');
  ok('with none yet, one is due', bk.due());
  const first = await bk.check();
  ok('...and made', !!first && fs.existsSync(first) && bk.list().length === 1, first);
  const copy = DB.open(first);
  ok('the copy is a working database holding what the original did', copy.userByName('ash') && copy.userByName('ash').email === 'ash@example.com');
  copy.close();
  clock += 6 * 60 * 60 * 1000;
  ok('six hours on, none is due', !bk.due() && (await bk.check()) === null && bk.list().length === 1);
  clock += 20 * 60 * 60 * 1000;
  ok('a day on, another is made', !!(await bk.check()) && bk.list().length === 2);

  console.log('\nThe last few kept');
  for (let i = 0; i < 4; i++) { clock += 25 * 60 * 60 * 1000; await bk.check(); }
  const left = bk.list();
  ok('only the newest three are kept', left.length === 3 && left[0].at > left[2].at, left.map((b) => path.basename(b.file)).join(' '));
  ok('each one said in the log', said.filter((t) => /backed up/.test(t)).length === 6);

  console.log('\nGoing wrong');
  const bad = Backups.create({ db: { backup: () => Promise.reject(new Error('disk full')) }, dir: path.join(dir, 'b2'), now: () => clock, log: (t) => said.push(t) });
  ok('a copy that fails is logged, and does not throw', (await bad.make()) === null && said.some((t) => /backup failed: disk full/.test(t)));

  db.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
