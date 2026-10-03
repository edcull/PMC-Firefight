/* Accounts and sessions (multiplayer plan, phase 1).

   A name, an email address and a password. Anyone who can reach the server may
   register (decision 3); where the server can send mail (mail.js), a new account
   waits until the link emailed to it is followed. A forgotten password is reset
   by a link sent to the account's address; a name or an address may be changed
   (a new address confirmed by a link sent to it). One-off battles may also be played as a guest: a
   session with a name and no account, which campaigns will not accept (decision 2).

   A session is a random token in an HttpOnly cookie; only its hash is stored, so
   a copy of the database signs nobody in. It lasts 30 days, renewed as it is used.
   Who a connection is comes from its session, never from anything it says. */
'use strict';
const crypto = require('crypto');

const DAY = 24 * 60 * 60 * 1000;
const SESSION_MS = 30 * DAY;
const COOKIE = 'pmc_session';
const NAME = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{1,22}[A-Za-z0-9_.\-]$/;   // 3-24, no space at either end
const PASS_MIN = 8, PASS_MAX = 200;
// scrypt's cost: about 50ms on a Raspberry Pi 4, so a guessing attacker gets nowhere fast
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/* How often anyone may try (per name and per address): enough for a person
   mistyping, far too few for a script guessing. */
const LIMITS = {
  loginName: { per: 15 * 60 * 1000, n: 10 },
  loginIp: { per: 15 * 60 * 1000, n: 30 },
  register: { per: 60 * 60 * 1000, n: 10 },
  guest: { per: 60 * 60 * 1000, n: 30 },
  // mail sent at someone's asking (a link again, a password reset): per address asked from, and per account
  mail: { per: 60 * 60 * 1000, n: 6 }
};
const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]{1,180}\.[^\s@<>()",;:.]{2,}$/;
const HOUR = 60 * 60 * 1000;
// how long each emailed link lasts
const LINK_MS = { activate: 48 * HOUR, reset: HOUR, email: 24 * HOUR };
// what each link is called in the address it opens (account.js reads it)
const LINK_AS = { activate: 'activate', reset: 'reset', email: 'confirm-email' };

function sha(t) { return crypto.createHash('sha256').update(String(t)).digest('hex'); }
function token() { return crypto.randomBytes(32).toString('base64url'); }
function pub() { return 'u' + crypto.randomBytes(6).toString('hex'); }

function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  return new Promise((res, rej) => {
    crypto.scrypt(pass, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) return rej(err);
      res(['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$'));
    });
  });
}
function checkPassword(pass, stored) {
  const f = String(stored || '').split('$');
  if (f[0] !== 'scrypt' || f.length !== 6) return Promise.resolve(false);
  const want = Buffer.from(f[5], 'base64');
  return new Promise((res) => {
    crypto.scrypt(pass, Buffer.from(f[4], 'base64'), want.length, { N: +f[1], r: +f[2], p: +f[3] }, (err, key) => {
      res(!err && key.length === want.length && crypto.timingSafeEqual(key, want));
    });
  });
}

function create(opts) {
  const db = opts.db, log = opts.log || function () { };
  const limits = opts.limits || LIMITS;
  const now = opts.now || Date.now;
  // the mail (mail.js): none, and nothing is sent — accounts are active at once
  const mailer = opts.mailer || { live: false, link: (k, t) => '/?' + k + '=' + t, send: () => Promise.resolve({ ok: false }) };
  const tries = new Map();          // what has been tried lately, by name or address

  // the tries under this limit for this key still in its window
  function recent(kind, key) {
    const lim = limits[kind], k = kind + ':' + String(key).toLowerCase(), t = now();
    const got = (tries.get(k) || []).filter((at) => t - at < lim.per);
    tries.set(k, got);
    return got;
  }
  function blocked(kind, key) { return recent(kind, key).length >= limits[kind].n; }
  function note(kind, key) {
    recent(kind, key).push(now());
    if (tries.size > 20000) tries.delete(tries.keys().next().value);
  }
  // whether one more is allowed, counting it (accounts and guests made: every one counts)
  function allow(kind, key) {
    if (blocked(kind, key)) return false;
    note(kind, key);
    return true;
  }
  function no(why, code) { return { ok: false, why: why, code: code || 400 }; }

  function startSession(userId, guest, pubId) {
    const t = token(), at = now();
    db.addSession({ token: sha(t), userId: userId, guest: guest, pub: pubId, created: at, expires: at + SESSION_MS });
    return t;
  }
  function who(user, s) {
    if (user) return { id: 'u' + user.id, userId: user.id, pub: user.pub, name: user.name, guest: false, admin: !!user.admin };
    return { id: 'g' + s.pub, userId: null, pub: s.pub, name: s.guest, guest: true, admin: false };
  }
  function checkName(name) {
    name = String(name || '').trim();
    return NAME.test(name) ? name : null;
  }
  function checkPass(pass) {
    pass = String(pass || '');
    return pass.length >= PASS_MIN && pass.length <= PASS_MAX ? pass : null;
  }
  function checkEmail(email) {
    email = String(email || '').trim();
    return email.length <= 254 && EMAIL.test(email) ? email : null;
  }
  /* A link by email, for one account and one purpose: any earlier one for the same
     purpose stops working. Only its hash is kept. */
  function mailLink(user, kind, to, subject, lines) {
    const t = token();
    db.dropMailTokens(user.id, kind);
    db.addMailToken({ token: sha(t), userId: user.id, kind: kind, email: to, expires: now() + LINK_MS[kind] });
    const link = mailer.link(LINK_AS[kind], t);
    const text = 'Hello ' + user.name + ',\n\n' + lines.join('\n') + '\n\n' + link + '\n\n' +
      'The link works once, for ' + (LINK_MS[kind] >= DAY ? Math.round(LINK_MS[kind] / DAY) * 24 + ' hours' : 'an hour') + '.\n' +
      'If this was not you, you can ignore this email.\n\nPMC 2670 \u2014 Firefight';
    return mailer.send({ to: to, subject: subject, text: text });
  }
  // a link followed: the account and the address it was for, or null (unknown, used, or out of date)
  function useLink(t, kind) {
    const row = t ? db.mailToken(sha(t)) : null;
    if (!row || row.kind !== kind) return null;
    db.dropMailTokens(row.user_id, kind);
    if (row.expires < now()) return null;
    const user = db.userById(row.user_id);
    return user ? { user: user, email: row.email } : null;
  }
  function sendActivation(user) {
    return mailLink(user, 'activate', user.email, 'Activate your PMC 2670 account',
      ['Your account is made. Follow this link to activate it:']);
  }

  return {
    COOKIE: COOKIE,
    db: db,                                      // for the routes that keep a signed-in player's things (app.js)

    /* A new account. Where mail goes out, it waits for the link sent to its
       address (and nobody is signed in yet); where it does not, it is active at once. */
    async register(name, pass, ip, email) {
      if (!allow('register', ip)) return no('too many accounts made from here lately — try again later', 429);
      // the address is wanted only where mail goes out (the link to activate, a reset); otherwise it may be left out
      const given = String(email || '').trim(), e = given ? checkEmail(given) : null;
      const n = checkName(name), p = checkPass(pass);
      if (!n) return no('a name is 3 to 24 letters, numbers, spaces, dots, dashes or underscores');
      if (mailer.live && !e) return no('give an email address — it is where your activation link goes, and a password reset if you ever need one');
      if (given && !e) return no('that does not look like an email address');
      if (!p) return no('a password is at least ' + PASS_MIN + ' characters');
      if (db.userByName(n)) return no('that name is taken');
      if (e && db.userByEmail(e)) return no('that email address already has an account \u2014 sign in, or use Forgot password');
      const hash = await hashPassword(p);
      let id;
      try { id = db.addUser({ name: n, pass: hash, pub: pub(), admin: false, created: now(), email: e, emailOk: false, active: !mailer.live }); }
      catch (err) { return no(/email/.test(String(err && err.message)) ? 'that email address already has an account' : 'that name is taken'); }   // made by someone else meanwhile
      log('account made: ' + n);
      const user = db.userById(id);
      if (mailer.live) {
        await sendActivation(user);
        return { ok: true, pending: true, email: e };
      }
      return { ok: true, token: startSession(id, null, user.pub), who: who(user) };
    },
    // the link in the activation email followed: the account is active, and signed in
    activate(t) {
      const got = useLink(t, 'activate');
      if (!got) return no('that link has been used or has run out \u2014 sign in to have another sent', 400);
      db.activate(got.user.id);
      log('account activated: ' + got.user.name);
      const user = db.userById(got.user.id);
      return { ok: true, token: startSession(user.id, null, user.pub), who: who(user) };
    },
    // the activation email again, for an account not yet active (said the same either way)
    async resend(nameOrEmail, ip) {
      const k = String(nameOrEmail || '').trim();
      if (!allow('mail', ip)) return no('too many emails asked for from here lately \u2014 try again later', 429);
      const user = k && (db.userByName(k) || db.userByEmail(k));
      if (user && !user.active && user.email && allow('mail', 'u' + user.id)) await sendActivation(user);
      return { ok: true };
    },
    /* Forgotten the password: a link to choose another, sent to the account's
       address — said the same whether or not there is one, so the answer gives
       nobody's address away. */
    async forgot(email, ip) {
      const e = checkEmail(email);
      if (!e) return no('give the email address the account has');
      if (!allow('mail', ip)) return no('too many emails asked for from here lately \u2014 try again later', 429);
      const user = db.userByEmail(e);
      if (user && allow('mail', 'u' + user.id)) {
        await mailLink(user, 'reset', user.email, 'Reset your PMC 2670 password',
          ['Someone (we hope you) asked to reset the password of your account, ' + user.name + '. Follow this link to choose a new one:']);
      }
      return { ok: true };
    },
    // the reset link followed, with the new password: set, every device signed out, and this one signed in
    async resetWith(t, pass) {
      const p = checkPass(pass);
      if (!p) return no('a password is at least ' + PASS_MIN + ' characters');
      const got = useLink(t, 'reset');
      if (!got) return no('that link has been used or has run out \u2014 ask for another', 400);
      db.setPass(got.user.id, await hashPassword(p));
      db.dropAllSessions(got.user.id);
      db.activate(got.user.id);                   // the link reached their inbox: the address is theirs
      log('password reset by email: ' + got.user.name);
      const user = db.userById(got.user.id);
      return { ok: true, token: startSession(user.id, null, user.pub), who: who(user) };
    },
    // a new name, if nobody else has it
    rename(t, name) {
      const me = this.session(t);
      if (!me || me.guest) return no('sign in first', 401);
      const n = checkName(name);
      if (!n) return no('a name is 3 to 24 letters, numbers, spaces, dots, dashes or underscores');
      const other = db.userByName(n);
      if (other && other.id !== me.userId) return no('that name is taken');
      try { db.setName(me.userId, n); } catch (e) { return no('that name is taken'); }
      log('account renamed: ' + me.name + ' -> ' + n);
      return { ok: true, who: who(db.userById(me.userId)) };
    },
    /* A new email address, with the password to show it is them: kept once the link
       sent to it is followed (the old one stays until then). */
    async changeEmail(t, email, pass, ip) {
      const me = this.session(t);
      if (!me || me.guest) return no('sign in first', 401);
      const user = db.userById(me.userId), e = checkEmail(email);
      if (!e) return no('that does not look like an email address');
      if (blocked('loginName', user.name)) return no('too many tries \u2014 wait a few minutes and try again', 429);
      if (!(await checkPassword(String(pass || ''), user.pass))) { note('loginName', user.name); return no('that is not your password', 401); }
      const other = db.userByEmail(e);
      if (other && other.id !== user.id) return no('another account has that email address');
      if (!mailer.live) { db.setEmail(user.id, e, false); return { ok: true, email: e, pending: false }; }
      if (!allow('mail', ip) || !allow('mail', 'u' + user.id)) return no('too many emails asked for lately \u2014 try again later', 429);
      await mailLink(user, 'email', e, 'Confirm your new PMC 2670 email address',
        ['Follow this link to make this the email address of your account, ' + user.name + ':']);
      return { ok: true, email: e, pending: true };
    },
    // the new address's link followed: it is the account's now
    confirmEmail(t) {
      const got = useLink(t, 'email');
      if (!got || !got.email) return no('that link has been used or has run out', 400);
      const other = db.userByEmail(got.email);
      if (other && other.id !== got.user.id) return no('another account has that email address now');
      db.setEmail(got.user.id, got.email, true);
      return { ok: true, email: got.email };
    },
    // the account's own details, for its own screen (api/me)
    details(me) {
      const user = me && !me.guest ? db.userById(me.userId) : null;
      return user ? { email: user.email || null, emailOk: !!user.email_ok } : null;
    },
    mailLive: !!mailer.live,

    async login(name, pass, ip) {
      const n = String(name || '').trim();
      // only wrong tries count against a name or an address: signing in is never held up by having done it before
      if (blocked('loginIp', ip) || blocked('loginName', n)) return no('too many tries — wait a few minutes and try again', 429);
      const user = n && db.userByName(n);
      // a missing name costs as long as a wrong password, so the time says nothing
      const good = await checkPassword(String(pass || ''), user ? user.pass : 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
      if (!user || !good) { note('loginIp', ip); note('loginName', n); return no('that name and password do not match', 401); }
      if (!user.active) return Object.assign(no('this account is not activated yet \u2014 follow the link in the email sent to ' + (user.email || 'it'), 403), { inactive: true });
      db.seen(user.id, now());
      return { ok: true, token: startSession(user.id, null, user.pub), who: who(user) };
    },

    // a battle without an account: a name for this browser, kept with its session
    guest(name, ip) {
      if (!allow('guest', ip)) return no('too many guests from here lately — try again later', 429);
      const n = checkName(name);
      if (!n) return no('a name is 3 to 24 letters, numbers, spaces, dots, dashes or underscores');
      if (db.userByName(n)) return no('that name belongs to an account — sign in, or pick another');
      const p = pub(), t = startSession(null, n, p);
      return { ok: true, token: t, who: who(null, { pub: p, guest: n }) };
    },

    logout(t) { if (t) db.dropSession(sha(t)); return { ok: true }; },

    /* Who a session token belongs to, or null (none, expired, or its account gone).
       Used now and again, it is kept going for another 30 days. */
    session(t) {
      if (!t) return null;
      const s = db.session(sha(t)), at = now();
      if (!s) return null;
      if (s.expires < at) { db.dropSession(s.token); return null; }
      const user = s.user_id ? db.userById(s.user_id) : null;
      if (s.user_id && !user) return null;
      if (s.expires - at < SESSION_MS - DAY) {
        db.renew(s.token, at + SESSION_MS, at);
        if (user) db.seen(user.id, at);
      }
      return who(user, s);
    },

    async changePassword(t, old, pass) {
      const me = this.session(t);
      if (!me || me.guest) return no('sign in first', 401);
      const user = db.userById(me.userId), p = checkPass(pass);
      if (!p) return no('a password is at least ' + PASS_MIN + ' characters');
      if (blocked('loginName', user.name)) return no('too many tries — wait a few minutes and try again', 429);
      if (!(await checkPassword(String(old || ''), user.pass))) { note('loginName', user.name); return no('that is not your current password', 401); }
      db.setPass(user.id, await hashPassword(p));
      db.dropOtherSessions(user.id, sha(t));       // every other device signs in again
      return { ok: true };
    },

    // from the command line (admin.js): there is no email to send a reset to
    async resetPassword(name, pass) {
      const user = db.userByName(String(name || '').trim()), p = checkPass(pass);
      if (!user) return no('no account called ' + name);
      if (!p) return no('a password is at least ' + PASS_MIN + ' characters');
      db.setPass(user.id, await hashPassword(p));
      db.dropAllSessions(user.id);
      return { ok: true };
    },
    async createUser(name, pass, admin, email) {
      const n = checkName(name), p = checkPass(pass), e = email ? checkEmail(email) : null;
      if (!n) return no('a name is 3 to 24 letters, numbers, spaces, dots, dashes or underscores');
      if (!p) return no('a password is at least ' + PASS_MIN + ' characters');
      if (email && !e) return no('that does not look like an email address');
      if (db.userByName(n)) return no('that name is taken');
      if (e && db.userByEmail(e)) return no('that email address already has an account');
      db.addUser({ name: n, pass: await hashPassword(p), pub: pub(), admin: !!admin, created: now(), email: e, emailOk: !!e });
      return { ok: true };
    },
    sweep() { db.dropExpiredMail(now()); return db.dropExpired(now()); }
  };
}

/* The cookie that carries a session: HttpOnly (no script reads it), SameSite=Lax
   (another site's page does not send it), Secure when the page came over TLS. */
function cookie(t, req, clear) {
  const secure = !!(req && ((req.socket && req.socket.encrypted) || /^https/i.test(String(req.headers['x-forwarded-proto'] || ''))));
  return COOKIE + '=' + (clear ? '' : t) + '; Path=/; HttpOnly; SameSite=Lax' +
    (clear ? '; Max-Age=0' : '; Max-Age=' + Math.floor(SESSION_MS / 1000)) + (secure ? '; Secure' : '');
}
function tokenFrom(req) {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]*)').exec(String((req && req.headers.cookie) || ''));
  return m ? m[1] : null;
}

module.exports = { create: create, cookie: cookie, tokenFrom: tokenFrom, hashPassword: hashPassword, checkPassword: checkPassword, LIMITS: LIMITS, COOKIE: COOKIE };
