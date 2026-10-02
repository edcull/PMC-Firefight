/* Accounts and sessions (multiplayer plan, phase 1), on a database in memory:
   the schema made by its migrations, passwords hashed and checked, sessions made,
   renewed, expired and signed out, guests, the limits on trying, and the admin's
   reset. */
'use strict';
const DB = require('../../server/db.js');
const Auth = require('../../server/auth.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  let clock = Date.parse('2026-01-01T00:00:00Z');
  const now = () => clock;
  const db = DB.open(':memory:');
  const auth = Auth.create({ db: db, now: now });

  console.log('\nThe database');
  ok('made by its migrations, the version kept', db.raw.pragma('user_version', { simple: true }) === DB.MIGRATIONS.length);
  ok('...with the accounts and sessions tables', ['users', 'sessions'].every((t) => !!db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t)));

  console.log('\nRegistering and signing in');
  const r1 = await auth.register('Ash Test', 'correct horse', '10.0.0.1');
  ok('an account is made, signed in at once', r1.ok && !!r1.token && r1.who.name === 'Ash Test' && !r1.who.guest);
  const row = db.userByName('ash test');
  ok('names are matched whatever their case', !!row);
  ok('the password is kept hashed (scrypt), never as typed', /^scrypt\$/.test(row.pass) && row.pass.indexOf('correct horse') < 0);
  ok('the same name cannot be taken twice', !(await auth.register('ASH TEST', 'another pass', '10.0.0.2')).ok);
  ok('a short password is refused', !(await auth.register('Brann', 'short', '10.0.0.3')).ok);
  ok('an odd name is refused', !(await auth.register('<b>x</b>', 'long enough', '10.0.0.3')).ok && !(await auth.register(' x', 'long enough', '10.0.0.3')).ok);
  const bad = await auth.login('Ash Test', 'wrong horse', '10.0.0.4');
  ok('a wrong password is refused', !bad.ok && bad.code === 401);
  const nobody = await auth.login('Nobody', 'whatever1', '10.0.0.4');
  ok('...as is a name nobody has, in the same words', !nobody.ok && nobody.why === bad.why);
  const good = await auth.login('ash test', 'correct horse', '10.0.0.4');
  ok('the right one signs in', good.ok && good.who.name === 'Ash Test');

  console.log('\nSessions');
  const me = auth.session(good.token);
  ok('a session says who it is', !!me && me.name === 'Ash Test' && me.userId === row.id && me.pub === row.pub);
  ok('...kept hashed: the token itself is not in the database', !db.raw.prepare('SELECT 1 FROM sessions WHERE token = ?').get(good.token));
  ok('a made-up token is nobody', auth.session('made-up') === null && auth.session('') === null);
  clock += 2 * 24 * 3600e3;
  auth.session(good.token);
  const s1 = db.raw.prepare('SELECT expires FROM sessions WHERE user_id = ? ORDER BY expires DESC').get(row.id).expires;
  ok('used, a session is kept going for another 30 days', s1 === clock + 30 * 24 * 3600e3);
  clock += 31 * 24 * 3600e3;
  ok('left unused past its 30 days, it is gone', auth.session(good.token) === null);
  clock += 1000;
  const again = await auth.login('Ash Test', 'correct horse', '10.0.0.5');
  auth.logout(again.token);
  ok('signing out ends it', auth.session(again.token) === null);

  console.log('\nGuests');
  const g = auth.guest('Wanderer', '10.0.0.6');
  ok('a guest has a session and a name, but no account', g.ok && auth.session(g.token).guest && auth.session(g.token).name === 'Wanderer' && !db.userByName('Wanderer'));
  ok('a guest may not take an account\'s name', !auth.guest('ash test', '10.0.0.6').ok);
  ok('a guest cannot change a password', !(await auth.changePassword(g.token, 'x', 'new password')).ok);

  console.log('\nChanging and resetting a password');
  const d1 = await auth.login('Ash Test', 'correct horse', '10.0.0.7'), d2 = await auth.login('Ash Test', 'correct horse', '10.0.0.8');
  ok('a change needs the current password', !(await auth.changePassword(d1.token, 'wrong horse', 'battery staple')).ok);
  ok('...and with it, goes through', (await auth.changePassword(d1.token, 'correct horse', 'battery staple')).ok);
  ok('...the other devices signed out, this one kept', auth.session(d2.token) === null && !!auth.session(d1.token));
  ok('...and the new password is the one that works', (await auth.login('Ash Test', 'battery staple', '10.0.0.9')).ok && !(await auth.login('Ash Test', 'correct horse', '10.0.0.9')).ok);
  const reset = await auth.resetPassword('Ash Test', 'staple battery');
  ok('the admin\'s reset changes it and signs every device out', reset.ok && auth.session(d1.token) === null && (await auth.login('Ash Test', 'staple battery', '10.0.0.10')).ok);

  console.log('\nThe limits on trying');
  clock += 16 * 60e3;                       // past the wrong tries above
  ok('signing in is never held up by having signed in before', (await auth.login('Ash Test', 'staple battery', '10.0.1.99')).ok);
  let refused = 0;
  for (let i = 0; i < 14; i++) if ((await auth.login('Ash Test', 'guess ' + i, '10.0.1.' + i)).code === 429) refused++;
  ok('ten wrong tries at one name, from anywhere, and the rest wait', refused === 4, refused + ' refused');
  const fresh = Auth.create({ db: DB.open(':memory:'), now: now });
  let made = 0;
  for (let i = 0; i < 12; i++) if ((await fresh.register('Bot ' + i, 'password ' + i, '10.0.2.1')).ok) made++;
  ok('ten new accounts an hour from one address', made === 10, made + ' made');

  console.log('\nAn account removed');
  const gone = await fresh.register('Leaver', 'password gone', '10.0.3.1'), stay = await fresh.register('Stayer', 'password stay', '10.0.3.2');
  const fdb = fresh.db, at = Date.now();
  const mineId = fdb.addCampaign({ owner: gone.who.userId, kind: 'solo', name: 'Theirs', turn: 0, state: {}, at: at });
  const otherId = fdb.addCampaign({ owner: stay.who.userId, kind: 'online', name: 'Shared', turn: 0, state: {}, at: at });
  fdb.addMember(otherId, stay.who.userId, 'A', at); fdb.addMember(otherId, gone.who.userId, 'B', at);
  const holds = fdb.userHolds(gone.who.userId);
  ok('what it takes with it is told first: its own campaigns, its seats in others', holds.owned === 1 && holds.member === 1, JSON.stringify(holds));
  ok('removed', fdb.dropUser(gone.who.userId) && !fdb.userByName('Leaver'));
  ok('...its sessions with it', !fresh.session(gone.token));
  ok('...and its own campaigns, and its seat in another\'s; that one stays for its maker', !fdb.campaign(mineId) && !!fdb.campaign(otherId) && fdb.members(otherId).length === 1);

  console.log('\nThe cookie');
  const req = { headers: { 'x-forwarded-proto': 'https' }, socket: {} };
  const c = Auth.cookie('tok', req);
  ok('HttpOnly, SameSite=Lax, Secure behind TLS, for 30 days', /HttpOnly/.test(c) && /SameSite=Lax/.test(c) && /Secure/.test(c) && /Max-Age=2592000/.test(c));
  ok('...and read back from a request', Auth.tokenFrom({ headers: { cookie: 'a=1; pmc_session=tok; b=2' } }) === 'tok');

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
