/* What the server answers over HTTP: the app, the campaign routes and a health
   check. Made here rather than in server.js so the tests drive the same routes
   the real server does. */
'use strict';

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

function create(opts) {
  const campaigns = opts.campaigns, lobby = opts.lobby, serve = opts.serve;

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
    if (url === '/campaigns') return json(res, 200, { campaigns: campaigns.list() });
    if (campaignRoute(req, res, url)) return;
    if (url === '/health') return json(res, 200, { ok: true, rooms: lobby.rooms.size, players: lobby.players.size });
    if (serve(req, res)) return;
    json(res, 404, { error: 'not found' });
  };
}

module.exports = { create: create };
