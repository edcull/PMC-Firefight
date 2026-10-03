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
  const r1 = await auth.register('Ash Test', 'correct horse', '10.0.0.1', 'ashtest@example.com');
  ok('an account is made, signed in at once', r1.ok && !!r1.token && r1.who.name === 'Ash Test' && !r1.who.guest);
  const row = db.userByName('ash test');
  ok('names are matched whatever their case', !!row);
  ok('the password is kept hashed (scrypt), never as typed', /^scrypt\$/.test(row.pass) && row.pass.indexOf('correct horse') < 0);
  ok('the same name cannot be taken twice', !(await auth.register('ASH TEST', 'another pass', '10.0.0.2', 'ashtest@example.com')).ok);
  ok('a short password is refused', !(await auth.register('Brann', 'short', '10.0.0.3', 'brann@example.com')).ok);
  ok('an odd name is refused', !(await auth.register('<b>x</b>', 'long enough', '10.0.0.3', 'bxb@example.com')).ok && !(await auth.register(' x', 'long enough', '10.0.0.3', 'x@example.com')).ok);
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
  for (let i = 0; i < 12; i++) if ((await fresh.register('Bot ' + i, 'password ' + i, '10.0.2.1', 'bot' + i + '@example.com')).ok) made++;
  ok('ten new accounts an hour from one address', made === 10, made + ' made');

  console.log('\nAn account removed');
  const gone = await fresh.register('Leaver', 'password gone', '10.0.3.1', 'leaver@example.com'), stay = await fresh.register('Stayer', 'password stay', '10.0.3.2', 'stayer@example.com');
  const fdb = fresh.db, at = Date.now();
  const mineId = fdb.addCampaign({ owner: gone.who.userId, kind: 'solo', name: 'Theirs', turn: 0, state: {}, at: at });
  const otherId = fdb.addCampaign({ owner: stay.who.userId, kind: 'online', name: 'Shared', turn: 0, state: {}, at: at });
  fdb.addMember(otherId, stay.who.userId, 'A', at); fdb.addMember(otherId, gone.who.userId, 'B', at);
  const holds = fdb.userHolds(gone.who.userId);
  ok('what it takes with it is told first: its own campaigns, its seats in others', holds.owned === 1 && holds.member === 1, JSON.stringify(holds));
  ok('removed', fdb.dropUser(gone.who.userId) && !fdb.userByName('Leaver'));
  ok('...its sessions with it', !fresh.session(gone.token));
  ok('...and its own campaigns, and its seat in another\'s; that one stays for its maker', !fdb.campaign(mineId) && !!fdb.campaign(otherId) && fdb.members(otherId).length === 1);

  console.log('\nEmail: activation, a forgotten password, a new name and address');
  const sent = [];
  const mailer = { live: true, link: (k, t) => 'https://pmc.example/?' + k + '=' + t, send: (m) => { sent.push(m); return Promise.resolve({ ok: true }); } };
  const ma = Auth.create({ db: DB.open(':memory:'), now: now, mailer: mailer });
  const linkIn = (m, kind) => { const x = new RegExp('\\?' + kind + '=([^\\s]+)').exec(m.text); return x ? decodeURIComponent(x[1]) : null; };
  ok('a new account needs an email address', !(await ma.register('Dara', 'password dara', '10.1.0.1')).ok && !(await ma.register('Dara', 'password dara', '10.1.0.1', 'not an address')).ok);
  const reg = await ma.register('Dara', 'password dara', '10.1.0.1', 'dara@example.com');
  ok('with mail going out, it waits for its link: nobody is signed in yet', reg.ok && reg.pending && !reg.token && !reg.who);
  ok('...and the link is mailed to the address given', sent.length === 1 && sent[0].to === 'dara@example.com' && /activate/i.test(sent[0].subject) && !!linkIn(sent[0], 'activate'));
  ok('one account an address (whatever its case)', /already has an account/.test((await ma.register('Dara Two', 'password two', '10.1.0.2', 'DARA@example.com')).why));
  const early = await ma.login('Dara', 'password dara', '10.1.0.1');
  ok('signing in before activating is refused, and says why', !early.ok && early.inactive && early.code === 403);
  await ma.resend('dara@example.com', '10.1.0.1');
  const act = linkIn(sent[sent.length - 1], 'activate');
  ok('the link can be sent again (the first stops working)', sent.length === 2 && !ma.activate(linkIn(sent[0], 'activate')).ok);
  const on = ma.activate(act);
  ok('following the link activates the account and signs it in', on.ok && !!on.token && on.who.name === 'Dara');
  ok('...once', !ma.activate(act).ok);
  ok('then signing in works', (await ma.login('Dara', 'password dara', '10.1.0.1')).ok);
  const n0 = sent.length;
  ok('Forgot password: the same answer for an address with no account, and nothing sent', (await ma.forgot('nobody@example.com', '10.1.0.3')).ok && sent.length === n0);
  await ma.forgot('Dara@Example.com', '10.1.0.3');
  const rt = linkIn(sent[sent.length - 1], 'reset');
  ok('...for one with, a reset link mailed to it', sent.length === n0 + 1 && sent[n0].to === 'dara@example.com' && !!rt);
  ok('a too-short new password is refused (and the link still works)', !(await ma.resetWith(rt, 'short')).ok);
  const rs = await ma.resetWith(rt, 'a new password');
  ok('the new password is set, other devices signed out, this one signed in', rs.ok && !!rs.token && !ma.session(on.token) && (await ma.login('Dara', 'a new password', '1')).ok && !(await ma.login('Dara', 'password dara', '1')).ok);
  ok('...the link used once', !(await ma.resetWith(rt, 'another one!')).ok);
  // a reset link out of date
  await ma.forgot('dara@example.com', '10.1.0.4');
  const old = linkIn(sent[sent.length - 1], 'reset');
  clock += 2 * 60 * 60 * 1000;
  ok('a reset link lasts an hour', !(await ma.resetWith(old, 'too late now')).ok);
  // names
  await ma.register('Eli', 'password eli', '10.1.0.5', 'eli@example.com');
  ma.activate(linkIn(sent[sent.length - 1], 'activate'));
  const dTok = (await ma.login('Dara', 'a new password', '1')).token;
  ok('a name may be changed to one nobody has', ma.rename(dTok, 'Dara Vance').ok && !!ma.db.userByName('dara vance') && !ma.db.userByName('Dara'));
  ok('...not to one somebody has, whatever its case', /taken/.test(ma.rename(dTok, 'ELI').why));
  ok('...nor to a name that breaks the rules, nor by a guest', !ma.rename(dTok, ' x').ok && !ma.rename(ma.guest('Wanderer', '1').token, 'Wanderer Two').ok);
  ok('the session follows the new name', ma.session(dTok).name === 'Dara Vance');
  // a new address
  ok('a new address needs the password', !(await ma.changeEmail(dTok, 'new@example.com', 'wrong one', '1')).ok);
  ok('...and not another account\'s', /another account/.test((await ma.changeEmail(dTok, 'eli@example.com', 'a new password', '1')).why));
  const ce = await ma.changeEmail(dTok, 'dara.new@example.com', 'a new password', '1');
  ok('it is kept once the link sent to it is followed; the old one meanwhile', ce.ok && ce.pending && sent[sent.length - 1].to === 'dara.new@example.com' && ma.details(ma.session(dTok)).email === 'dara@example.com');
  const cf = ma.confirmEmail(linkIn(sent[sent.length - 1], 'confirm-email'));
  ok('...followed, the address is the account\'s', cf.ok && ma.details(ma.session(dTok)).email === 'dara.new@example.com' && ma.details(ma.session(dTok)).emailOk);
  // asking for mail again and again
  let refusedMail = 0;
  for (let i = 0; i < 10; i++) if ((await ma.forgot('eli@example.com', '10.1.9.9')).code === 429) refusedMail++;
  ok('mail asked for is limited per address asked from', refusedMail >= 3, refusedMail + ' refused');
  // without mail, accounts are active at once (nobody could activate them otherwise)
  const nm = Auth.create({ db: DB.open(':memory:'), now: now });
  const quick = await nm.register('Fen', 'password fen', '1', 'fen@example.com');
  ok('where no mail goes out, a new account is active and signed in at once', quick.ok && !!quick.token && (await nm.login('Fen', 'password fen', '1')).ok);

  console.log('\nThe cookie');
  const req = { headers: { 'x-forwarded-proto': 'https' }, socket: {} };
  const c = Auth.cookie('tok', req);
  ok('HttpOnly, SameSite=Lax, Secure behind TLS, for 30 days', /HttpOnly/.test(c) && /SameSite=Lax/.test(c) && /Secure/.test(c) && /Max-Age=2592000/.test(c));
  ok('...and read back from a request', Auth.tokenFrom({ headers: { cookie: 'a=1; pmc_session=tok; b=2' } }) === 'tok');

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
