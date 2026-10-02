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
    const m = /^\/api\/(me|register|login|guest|logout|password)$/.exec(url);
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
      return send(me ? 200 : 401, { who: shown(me) }), true;
    }
    if (req.method !== 'POST') return send(405, { error: 'method not allowed' }), true;
    if (req.headers.origin && !allowOrigin(req.headers.origin, req)) return send(403, { error: 'not from here' }), true;
    readBody(req, async (body) => {
      let b = {};
      try { b = body ? JSON.parse(body) : {}; } catch (e) { return send(400, { error: 'that is not JSON' }); }
      const ip = ipOf(req);
      try {
        let r;
        if (m[1] === 'register') r = await auth.register(b.name, b.password, ip);
        else if (m[1] === 'login') r = await auth.login(b.name, b.password, ip);
        else if (m[1] === 'guest') r = auth.guest(b.name, ip);
        else if (m[1] === 'logout') { auth.logout(t); return send(200, { ok: true }, Auth.cookie('', req, true)); }
        else r = await auth.changePassword(t, b.old, b.password);
        if (!r.ok) return send(r.code || 400, { error: r.why });
        send(200, { ok: true, who: shown(r.who || auth.session(t)) }, r.token ? Auth.cookie(r.token, req) : null);
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

  return function handle(req, res) {
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'OPTIONS') return json(res, 204);
    if (api(req, res, url)) return;
    if (url === '/campaigns') return json(res, 200, { campaigns: campaigns.list() });
    if (campaignRoute(req, res, url)) return;
    if (url === '/health') return json(res, 200, { ok: true, rooms: lobby.rooms.size, players: lobby.players.size });
    if (serve(req, res)) return;
    json(res, 404, { error: 'not found' });
  };
}

module.exports = { create: create, ipOf: ipOf };
