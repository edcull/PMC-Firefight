/* What the server answers over HTTP: the app, the campaign routes and a health
   check. Made here rather than in server.js so the tests drive the same routes
   the real server does. */
'use strict';
const Auth = require('./auth.js');

/* The game also runs from a file:// page, which arrives as a null origin, so
   the campaign routes answer any origin. A write is safe all the same: it must
   carry the campaign's key (campaigns.js), which no other site's page can read. */
function json(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,accept,x-campaign-key'
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req, done) {
  let body = '', over = false;
  req.on('data', (c) => {
    if (over) return;
    body += c;
    // a dossier is kilobytes, not megabytes
    if (body.length > 4e6) { over = true; done(null); req.destroy(); }
  });
  req.on('end', () => { if (!over) done(body); });
}

/* Who sent a request: the socket's own address, or, from a proxy on this same
   machine (nginx on the Pi), the address it says it is passing on. */
function ipOf(req) {
  const own = String((req.socket && req.socket.remoteAddress) || '');
  if (/^(::1|127\.|::ffff:127\.)/.test(own)) {
    const fwd = String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0]).trim();
    if (fwd) return fwd;
  }
  return own;
}

function create(opts) {
  const campaigns = opts.campaigns, lobby = opts.lobby, serve = opts.serve, auth = opts.auth;
  const allowOrigin = opts.allowOrigin || function () { return true; };

  /* The accounts (multiplayer plan, phase 1): this server's own pages only — no
     CORS — and a write from a page elsewhere is refused by its Origin as well as
     its cookie's SameSite. Bodies are small JSON. */
  function api(req, res, url) {
    const m = /^\/api\/(me|games|register|login|guest|logout|password|activate|resend|forgot|reset|rename|email|confirm-email|notify)$/.exec(url);
    if (!m) return false;
    const send = (code, body, cookie) => {
      const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
      if (cookie) h['set-cookie'] = cookie;
      res.writeHead(code, h);
      res.end(JSON.stringify(body));
    };
    if (!auth) return send(503, { error: 'this server has no accounts' }), true;
    // what a page is told of who it is: the name and the public id, nothing internal
    const shown = (w) => w ? { id: w.pub, name: w.name, guest: w.guest, admin: w.admin } : null;
    const t = Auth.tokenFrom(req);
    if (m[1] === 'me') {
      if (req.method !== 'GET') return send(405, { error: 'method not allowed' }), true;
      const me = auth.session(t);
      // a signed-in player's own address too (to them only), and whether this server sends mail
      const mine = me ? Object.assign(shown(me), auth.details(me) || {}) : null;
      return send(me ? 200 : 401, { who: mine, mail: !!auth.mailLive }), true;
    }
    // the player's own battles, the latest first (the account screen's list; the lobby has it over the socket)
    if (m[1] === 'games') {
      if (req.method !== 'GET') return send(405, { error: 'method not allowed' }), true;
      const me = auth.session(t);
      if (!me) return send(401, { error: 'sign in first' }), true;
      return send(200, { games: opts.games ? opts.games.mine(me.id) : [] }), true;
    }
    if (req.method !== 'POST') return send(405, { error: 'method not allowed' }), true;
    if (req.headers.origin && !allowOrigin(req.headers.origin, req)) return send(403, { error: 'not from here' }), true;
    readBody(req, async (body) => {
      let b = {};
      try { b = body ? JSON.parse(body) : {}; } catch (e) { return send(400, { error: 'that is not JSON' }); }
      const ip = ipOf(req);
      try {
        let r;
        if (m[1] === 'register') {
          r = await auth.register(b.name, b.password, ip, b.email);
          // waiting for its link: nobody is signed in yet
          if (r.ok && r.pending) return send(200, { ok: true, pending: true, email: r.email });
        }
        else if (m[1] === 'login') {
          r = await auth.login(b.name, b.password, ip);
          if (!r.ok && r.inactive) return send(403, { error: r.why, inactive: true });
        }
        else if (m[1] === 'activate') r = auth.activate(b.token);
        else if (m[1] === 'resend') r = await auth.resend(b.name, ip);
        else if (m[1] === 'forgot') r = await auth.forgot(b.email, ip);
        else if (m[1] === 'reset') r = await auth.resetWith(b.token, b.password);
        else if (m[1] === 'rename') r = auth.rename(t, b.name);
        else if (m[1] === 'notify') r = auth.setNotify(t, !!b.on);
        else if (m[1] === 'email') {
          r = await auth.changeEmail(t, b.email, b.password, ip);
          if (r.ok) return send(200, { ok: true, email: r.email, pending: r.pending });
        }
        else if (m[1] === 'confirm-email') {
          r = auth.confirmEmail(b.token);
          if (r.ok) return send(200, { ok: true, email: r.email });
        }
        else if (m[1] === 'guest') r = auth.guest(b.name, ip);
        else if (m[1] === 'logout') { auth.logout(t); return send(200, { ok: true }, Auth.cookie('', req, true)); }
        else r = await auth.changePassword(t, b.old, b.password);
        if (!r.ok) return send(r.code || 400, { error: r.why });
        const now = r.who || auth.session(r.token || t);
        send(200, { ok: true, who: now ? Object.assign(shown(now), auth.details(now) || {}) : null }, r.token ? Auth.cookie(r.token, req) : null);
      } catch (e) { send(500, { error: 'the server could not do that' }); }
    });
    return true;
  }

  function campaignRoute(req, res, url) {
    const m = /^\/campaign(?:\/([^/?#]*))?\/?$/.exec(url);
    if (!m) return false;
    let name = 'default';
    // a malformed percent-escape is the caller's mistake, not a reason to fall over (MP-1)
    if (m[1]) { try { name = decodeURIComponent(m[1]); } catch (e) { return json(res, 400, { error: 'that is not a campaign name' }), true; } }
    const key = String(req.headers['x-campaign-key'] || '');

    if (req.method === 'GET') {
      const camp = campaigns.get(name);
      return json(res, camp ? 200 : 404, camp || { error: 'no campaign called ' + name }), true;
    }
    if (req.method === 'PUT') {
      readBody(req, (body) => {
        if (body === null) return json(res, 413, { error: 'too large' });
        try { json(res, 200, campaigns.put(name, JSON.parse(body), key)); }
        catch (e) { json(res, e.code === 403 ? 403 : 400, { error: String(e.message) }); }
      });
      return true;
    }
    if (req.method === 'DELETE') {
      const gone = campaigns.remove(name, key);
      return json(res, gone === null ? 403 : 200, gone === null ? { error: 'that campaign is someone else’s to change' } : { ok: gone }), true;
    }
    return json(res, 405, { error: 'method not allowed' }), true;
  }

  /* A signed-in player's own campaigns (phase 3a, decision 7), kept whole, each
     with a version: a save carries the version it was read at, and one made from
     an older copy is refused (409) with the newer one, so two devices never
     quietly overwrite each other. Accounts only: a guest has nowhere to keep one. */
  const CAMP_KINDS = ['solo', 'hotseat'];
  function campaignsApi(req, res, url) {
    const m = /^\/api\/campaigns(?:\/(\d+|import))?$/.exec(url);
    if (!m) return false;
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const me = auth && auth.session(Auth.tokenFrom(req));
    if (!me || me.guest) return send(401, { error: 'sign in to keep campaigns on the server' }), true;
    if (req.method !== 'GET' && req.headers.origin && !allowOrigin(req.headers.origin, req)) return send(403, { error: 'not from here' }), true;
    const db = auth.db, id = m[1] && m[1] !== 'import' ? +m[1] : null, at = Date.now();
    // a campaign as it is saved keeps the second force among the rivals (campaign.js forSave)
    const nameOf = (st) => {
      const B = (st.companies && st.companies.B) || (st.rivals || [])[st.facing || 0];
      return String((st.companies && st.companies.A && st.companies.A.name) || 'Campaign').slice(0, 60) +
        (st.mode === 'hotseat' && B && B.name ? ' v ' + String(B.name).slice(0, 60) : '');
    };
    const kindOf = (st) => CAMP_KINDS.indexOf(st.mode) >= 0 ? st.mode : 'solo';
    if (!id && m[1] !== 'import') {
      if (req.method === 'GET') return send(200, { campaigns: db.campaignsOf(me.userId) }), true;
      if (req.method !== 'POST') return send(405, { error: 'method not allowed' }), true;
      readBody(req, (body) => {
        let st;
        try { st = JSON.parse(body).state; } catch (e) { return send(400, { error: 'that is not JSON' }); }
        if (!st || !st.companies) return send(400, { error: 'that is not a campaign' });
        if (db.campaignsOf(me.userId).length >= 50) return send(400, { error: 'that is as many campaigns as one account keeps — delete one first' });
        const nid = db.addCampaign({ owner: me.userId, kind: kindOf(st), name: nameOf(st), turn: st.turn, state: st, at: at });
        send(200, { id: nid, version: 1 });
      });
      return true;
    }
    /* An old campaign file (kept as JSON before there were accounts) taken into
       this account by whoever holds its key. */
    if (m[1] === 'import') {
      if (req.method !== 'POST') return send(405, { error: 'method not allowed' }), true;
      readBody(req, (body) => {
        let b;
        try { b = JSON.parse(body); } catch (e) { return send(400, { error: 'that is not JSON' }); }
        const st = campaigns.get(String(b.name || ''));
        if (!st) return send(404, { error: 'no campaign called ' + b.name });
        if (!campaigns.mayWrite(b.name, String(b.key || ''))) return send(403, { error: 'that campaign is someone else\u2019s' });
        const nid = db.addCampaign({ owner: me.userId, kind: kindOf(st), name: nameOf(st), turn: st.turn, state: st, at: at });
        send(200, { id: nid, version: 1 });
      });
      return true;
    }
    const row = db.campaign(id);
    if (!row || row.owner !== me.userId) return send(404, { error: 'no such campaign of yours' }), true;
    if (req.method === 'GET') return send(200, { id: row.id, kind: row.kind, version: row.version, state: row.state }), true;
    if (req.method === 'DELETE') return send(200, { ok: db.dropCampaign(id, me.userId) }), true;
    if (req.method !== 'PUT') return send(405, { error: 'method not allowed' }), true;
    readBody(req, (body) => {
      if (body === null) return send(413, { error: 'too large' });
      let b;
      try { b = JSON.parse(body); } catch (e) { return send(400, { error: 'that is not JSON' }); }
      if (!b.state || !b.state.companies) return send(400, { error: 'that is not a campaign' });
      const okd = db.saveCampaign({ id: id, owner: me.userId, version: +b.version, state: b.state, name: nameOf(b.state), turn: b.state.turn, kind: kindOf(b.state), at: at });
      if (okd) return send(200, { version: +b.version + 1 });
      // saved from an older copy: refused, and the newer one handed back
      const now = db.campaign(id);
      send(409, { error: 'this campaign was saved somewhere else since', version: now.version, state: now.state });
    });
    return true;
  }

  /* Online campaigns (phase 3b): made, joined with a code, read by their two
     players, and changed only by commands the server runs (online.js). */
  function onlineApi(req, res, url) {
    const m = /^\/api\/online(?:\/(join|\d+)(?:\/(cmd))?)?$/.exec(url);
    if (!m) return false;
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const online = opts.online;
    if (!online || !auth) return send(503, { error: 'this server has no online campaigns' }), true;
    const me = auth.session(Auth.tokenFrom(req));
    if (!me || me.guest) return send(401, { error: 'sign in to play a campaign online' }), true;
    if (req.method !== 'GET' && req.headers.origin && !allowOrigin(req.headers.origin, req)) return send(403, { error: 'not from here' }), true;
    const answer = (r) => r.ok ? send(200, r) : send(r.code || 400, { error: r.why });
    if (!m[1]) {
      if (req.method === 'GET') return send(200, { campaigns: online.list(me) }), true;
      // a new one, listed in the lobby for anyone to join or not ({ listed })
      if (req.method === 'POST') {
        readBody(req, (body) => { let b = {}; try { b = JSON.parse(body || '{}'); } catch (e) { b = {}; } answer(online.make(me, { listed: !!b.listed })); });
        return true;
      }
      return send(405, { error: 'method not allowed' }), true;
    }
    if (m[1] === 'join') {
      if (req.method !== 'POST') return send(405, { error: 'method not allowed' }), true;
      readBody(req, (body) => {
        let b = {};
        try { b = JSON.parse(body || '{}'); } catch (e) { return send(400, { error: 'that is not JSON' }); }
        answer(online.join(me, b.code));
      });
      return true;
    }
    const id = +m[1];
    if (!m[2]) {
      if (req.method !== 'GET') return send(405, { error: 'method not allowed' }), true;
      return answer(online.view(me, id)), true;
    }
    if (req.method !== 'POST') return send(405, { error: 'method not allowed' }), true;
    readBody(req, (body) => {
      if (body === null) return send(413, { error: 'too large' });
      let b = {};
      try { b = JSON.parse(body || '{}'); } catch (e) { return send(400, { error: 'that is not JSON' }); }
      answer(online.command(me, id, String(b.cmd || ''), b.args || {}));
    });
    return true;
  }

  /* An admin's tools (adminapi.js): GET overview, POST the rest; who is asking is
     the session, and adminapi.js checks the account is an admin's every time. */
  function adminApi(req, res, url) {
    const m = /^\/api\/admin\/([a-z-]+)$/.exec(url);
    if (!m) return false;
    const send = (code, body) => json(res, code, body);
    if (!opts.admin || !auth) return send(503, { error: 'this server has no admin tools' }), true;
    if (req.method !== 'GET' && req.headers.origin && !allowOrigin(req.headers.origin, req)) return send(403, { error: 'not from here' }), true;
    const me = auth.session(Auth.tokenFrom(req));
    const go = (b) => opts.admin.handle(me, m[1], b).then((r) => {
      if (!r.ok) return send(r.code || 400, { error: r.why });
      send(200, r);
    }, () => send(500, { error: 'the server could not do that' }));
    if (req.method === 'GET') { if (m[1] !== 'overview') return send(405, { error: 'method not allowed' }), true; go({}); return true; }
    if (m[1] === 'overview') return send(405, { error: 'method not allowed' }), true;
    readBody(req, (body) => { let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { return send(400, { error: 'that is not JSON' }); } go(b); });
    return true;
  }

  return function handle(req, res) {
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'OPTIONS') return json(res, 204);
    if (api(req, res, url)) return;
    if (adminApi(req, res, url)) return;
    if (campaignsApi(req, res, url)) return;
    if (onlineApi(req, res, url)) return;
    if (url === '/campaigns') return json(res, 200, { campaigns: campaigns.list() });
    if (campaignRoute(req, res, url)) return;
    if (url === '/health') return json(res, 200, Object.assign({ ok: true, rooms: lobby.rooms.size, players: lobby.players.size }, opts.health ? opts.health() : {}));
    if (serve(req, res)) return;
    json(res, 404, { error: 'not found' });
  };
}

module.exports = { create: create, ipOf: ipOf };
