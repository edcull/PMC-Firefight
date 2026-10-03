/* The console's look at the battles and campaigns (server/admin.js): listed, one
   shown in full, one removed (asked first), old finished ones cleared out, and a
   campaign removed. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const DB = require('../../server/db.js');
const Games = require('../../server/games.js');
const Online = require('../../server/online.js');
const Auth = require('../../server/auth.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-admin-'));
  process.env.DATA_DIR = dir;
  const db = DB.open(path.join(dir, 'pmc.db'));
  const auth = Auth.create({ db: db, limits: { register: { per: 1000, n: 1000 } } });
  const ash = (await auth.register('Ash', 'password one', '1')).who;
  let clock = Date.now() - 60 * 86400000;
  const games = Games.create(db, { now: () => clock });
  const room = (code) => ({ id: code, name: 'Ash’s battle', settings: { tier: 3, pl: 1, scenario: 'meeting', planet: 'desert' },
    seats: { A: { id: 'u1', pub: 'p1', name: 'Ash' }, B: { id: 'u2', pub: 'p2', name: 'Brann' } } });
  const old = games.started(room('OLD11'), { tier: 3 }, 1);
  games.intent(old, 1, 'A', { k: 'select' });
  games.ended(old, 'over', { winner: 'A' });
  clock = Date.now();
  games.started(room('LIVE2'), { tier: 3 }, 2);
  Online.create({ db: db }).make(ash);
  db.close();

  const admin = require('../../server/admin.js');
  const run = async (...args) => {
    const out = [], log = console.log;
    console.log = (t) => out.push(String(t));
    let code;
    try { code = await admin.main(args); } finally { console.log = log; }
    return { code: code, text: out.join('\n') };
  };

  console.log('\nBattles');
  let r = await run('games');
  ok('games lists them, the latest first, with how each went', /^LIVE2.*under way.*Ash v Brann/m.test(r.text) && /OLD11.*won by Ash.*1 move\)/.test(r.text) && r.text.indexOf('LIVE2') < r.text.indexOf('OLD11'), r.text);
  r = await run('game', 'old11');
  ok('game shows one in full', /OLD11/.test(r.text) && /players\s+Ash v Brann/.test(r.text) && /Tier 3/.test(r.text), r.text);
  r = await run('delete-game', 'LIVE2');
  ok('delete-game asks first', r.code === 1 && /--yes/.test(r.text) && /LIVE2/.test((await run('games')).text));
  r = await run('delete-game', 'LIVE2', '--yes');
  ok('...and with --yes removes it, saying to restart for one still under way', r.code === 0 && /restart the server/.test(r.text) && !/LIVE2/.test((await run('games')).text), r.text);
  r = await run('prune-games', '30');
  ok('prune-games asks first, saying how many', r.code === 1 && /1 finished or abandoned battle/.test(r.text), r.text);
  r = await run('prune-games', '30', '--yes');
  ok('...and clears the finished ones older than that', r.code === 0 && /No battles kept/.test((await run('games')).text), r.text);

  console.log('\nCampaigns');
  r = await run('campaigns');
  const id = (/^\s*(\d+)\s/m.exec(r.text) || [])[1];
  ok('campaigns lists them, an online one with its players and open code', !!id && /online/.test(r.text) && /Ash \(slot 1\)/.test(r.text) && /code \w+ open/.test(r.text), r.text);
  r = await run('delete-campaign', id);
  ok('delete-campaign asks first', r.code === 1 && /all its players/.test(r.text));
  r = await run('delete-campaign', id, '--yes');
  ok('...and with --yes removes it', r.code === 0 && /No campaigns kept/.test((await run('campaigns')).text), r.text);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
