/* Accounts and sessions (multiplayer plan, phase 1).

   A name and a password, nothing else (no email). Anyone who can reach the server
   may register (decision 3). One-off battles may also be played as a guest: a
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
  guest: { per: 60 * 60 * 1000, n: 30 }
};

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

  return {
    COOKIE: COOKIE,

    async register(name, pass, ip) {
      if (!allow('register', ip)) return no('too many accounts made from here lately — try again later', 429);
      const n = checkName(name), p = checkPass(pass);
      if (!n) return no('a name is 3 to 24 letters, numbers, spaces, dots, dashes or underscores');
      if (!p) return no('a password is at least ' + PASS_MIN + ' characters');
      if (db.userByName(n)) return no('that name is taken');
      const hash = await hashPassword(p);
      let id;
      try { id = db.addUser({ name: n, pass: hash, pub: pub(), admin: false, created: now() }); }
      catch (e) { return no('that name is taken'); }          // registered by someone else meanwhile
      log('account made: ' + n);
      const user = db.userById(id);
      return { ok: true, token: startSession(id, null, user.pub), who: who(user) };
    },

    async login(name, pass, ip) {
      const n = String(name || '').trim();
      // only wrong tries count against a name or an address: signing in is never held up by having done it before
      if (blocked('loginIp', ip) || blocked('loginName', n)) return no('too many tries — wait a few minutes and try again', 429);
      const user = n && db.userByName(n);
      // a missing name costs as long as a wrong password, so the time says nothing
      const good = await checkPassword(String(pass || ''), user ? user.pass : 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
      if (!user || !good) { note('loginIp', ip); note('loginName', n); return no('that name and password do not match', 401); }
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
    async createUser(name, pass, admin) {
      const n = checkName(name), p = checkPass(pass);
      if (!n) return no('a name is 3 to 24 letters, numbers, spaces, dots, dashes or underscores');
      if (!p) return no('a password is at least ' + PASS_MIN + ' characters');
      if (db.userByName(n)) return no('that name is taken');
      db.addUser({ name: n, pass: await hashPassword(p), pub: pub(), admin: !!admin, created: now() });
      return { ok: true };
    },
    sweep() { return db.dropExpired(now()); }
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
