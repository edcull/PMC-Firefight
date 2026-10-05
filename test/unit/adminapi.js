/* The admin tools in the game itself (server/adminapi.js): only an admin, the
   server looked at, a player helped, a stuck battle closed, old ones cleared, a
   backup taken; and a removal only with the admin's own password, a backup
   taken first, never their own account nor another admin's. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const DB = require('../../server/db.js');
const Games = require('../../server/games.js');
const Online = require('../../server/online.js');
const Auth = require('../../server/auth.js');
const Backups = require('../../server/backups.js');
const Lobby = require('../../server/lobby.js');
const AdminApi = require('../../server/adminapi.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-adminapi-'));
  const db = DB.open(path.join(dir, 'pmc.db'));
  const sent = [];
  const mailer = { live: true, link: (k, t) => '/?' + k + '=' + t, send: (m) => { sent.push(m); return Promise.resolve({ ok: true }); } };
  const auth = Auth.create({ db: db, mailer: mailer, limits: Object.assign({}, Auth.LIMITS, { register: { per: 1000, n: 1000 } }) });
  const reg = async (n, e) => { await auth.register(n, 'password ' + n, '1', e); return db.userByName(n); };
  const boss = await reg('Boss', 'boss@example.com'), ash = await reg('Ash', 'ash@example.com');
  const other = await reg('Other', 'other@example.com'), brann = await reg('Brann', 'brann@example.com');
  [boss, ash, other].forEach((u) => db.activate(u.id));
  db.setAdmin(boss.id, true); db.setAdmin(other.id, true);
  const me = { userId: boss.id, name: 'Boss' }, them = { userId: ash.id, name: 'Ash' };

  let clock = Date.now() - 60 * 86400000;
  const games = Games.create(db, { now: () => clock });
  const room = (code) => ({ id: code, name: 'Ash’s battle', settings: { tier: 3, pl: 1, scenario: 'meeting', planet: 'desert' },
    seats: { A: { id: 'u1', pub: 'p1', name: 'Ash' }, B: { id: 'u2', pub: 'p2', name: 'Brann' } } });
  games.ended(games.started(room('OLD11'), { tier: 3 }, 1), 'over', { winner: 'A' });
  clock = Date.now();
  games.started(room('LIVE2'), { tier: 3 }, 2);
  games.started(room('GONE3'), { tier: 3 }, 3);
  Online.create({ db: db }).make({ userId: ash.id, name: 'Ash', pub: ash.pub });

  const backups = Backups.create({ db: db, dir: path.join(dir, 'backups') });
  const lobby = new Lobby.Lobby({ games: games, log: () => { } });
  const logged = [];
  const api = AdminApi.create({ db: db, auth: auth, lobby: lobby, games: games, backups: backups, log: (t) => logged.push(t) });

  console.log('\nOnly an admin');
  ok('a player who is not an admin is refused', (await api.handle(them, 'overview')).code === 403);
  ok('a guest is refused', (await api.handle({ guest: true }, 'overview')).code === 401);
  db.setAdmin(boss.id, false);
  ok('an admin flag taken away in the database is noticed at once', (await api.handle(me, 'overview')).code === 403);
  db.setAdmin(boss.id, true);

  console.log('\nLooking');
  let r = await api.handle(me, 'overview');
  ok('the overview has the accounts, battles and campaigns', r.ok && r.users.length === 4 && r.games.length === 3 && r.campaigns.length === 1 && !!r.stats, JSON.stringify(r).slice(0, 200));
  ok('...each battle with its players and how it went', r.games.some((g) => g.code === 'OLD11' && g.winner === 'Ash' && g.players.join() === 'Ash,Brann'));
  ok('...and no password hash anywhere', !/\$|pass/.test(JSON.stringify(r.users)));

  console.log('\nHelping a player');
  r = await api.handle(me, 'resend', { name: 'Brann' });
  ok('an activation link is sent again', r.ok && sent.some((m) => m.to === 'brann@example.com' && /activate/i.test(m.text)), r.why);
  r = await api.handle(me, 'activate', { name: 'Brann' });
  ok('an account is activated', r.ok && !!db.userByName('Brann').active);
  ok('...and is not sent a link again', !(await api.handle(me, 'resend', { name: 'Brann' })).ok);
  r = await api.handle(me, 'reset-link', { name: 'Ash' });
  ok('a password-reset link is sent', r.ok && sent.some((m) => m.to === 'ash@example.com' && /reset/.test(m.text)), r.why);
  ok('an account that is not there is said so', /no such/.test((await api.handle(me, 'activate', { name: 'Nobody' })).why));

  console.log('\nBattles');
  r = await api.handle(me, 'close-game', { code: 'live2' });
  // a finished battle is not kept (lobby.js forget): closed, it is cleared away
  ok('a stuck battle is closed, and cleared away', r.ok && !db.gamesByCode('LIVE2').length, r.why);
  ok('...and closing one that is not under way is said so', !(await api.handle(me, 'close-game', { code: 'LIVE2' })).ok);
  r = await api.handle(me, 'prune', { days: 30 });
  ok('old finished battles are cleared, those under way kept', r.ok && !db.gamesByCode('OLD11').length && db.gamesByCode('GONE3').length === 1, r.text);

  console.log('\nRemoving');
  const before = backups.list().length;
  r = await api.handle(me, 'delete-game', { code: 'GONE3', password: 'wrong' });
  ok('a battle is not removed without the admin’s password', r.code === 401 && db.gamesByCode('GONE3').length === 1 && backups.list().length === before);
  r = await api.handle(me, 'delete-game', { code: 'GONE3', password: 'password Boss' });
  ok('...and with it, is removed after a backup', r.ok && !db.gamesByCode('GONE3').length && backups.list().length > before, r.why);
  const camp = db.allCampaigns(5)[0];
  r = await api.handle(me, 'delete-campaign', { id: camp.id, password: 'password Boss' });
  ok('a campaign is removed', r.ok && !db.campaign(camp.id), r.why);
  ok('the admin’s own account is not removed', /own/.test((await api.handle(me, 'delete-user', { name: 'Boss', password: 'password Boss' })).why));
  ok('nor another admin’s', /console/.test((await api.handle(me, 'delete-user', { name: 'Other', password: 'password Boss' })).why));
  r = await api.handle(me, 'delete-user', { name: 'Brann', password: 'password Boss' });
  ok('a player’s account is removed', r.ok && !db.userByName('Brann'), r.why);
  ok('every change is logged, with who made it', logged.length >= 7 && logged.every((t) => /^admin Boss /.test(t)), logged.join(' | '));

  console.log('\nA slip, not a script');
  let last;
  for (let i = 0; i < 30; i++) last = await api.handle(me, 'activate', { name: 'Ash' });
  ok('too many changes in a minute are refused', last.code === 429);
  ok('...while looking still works', (await api.handle(me, 'overview')).ok);

  db.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
