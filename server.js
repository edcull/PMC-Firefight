/* The PMC 2670 server: hands the game out, and runs the games.

   Three things live behind one port, and none of them needs a dependency:

     the app      GET /            index.html and the scripts beside it
     campaigns    GET/PUT/DELETE /campaign[/name]      and GET /campaigns
     multiplayer  ws:// /ws        the lobby, and every battle in progress

   Every die in a networked battle is rolled here. The browser sends what the
   player is trying to do and draws what comes back; it never decides anything
   and it never rolls. engine.js is the game, and it runs in this process.

     node server.js                 then open http://localhost:8787
     PORT=9000 node server.js       somewhere else
     HOST=0.0.0.0 node server.js    so the rest of the house can join in
*/
'use strict';
const http = require('http');
const path = require('path');

const ws = require('./server/ws.js');
const statics = require('./server/static.js');
const { Lobby } = require('./server/lobby.js');
const { Campaigns } = require('./server/campaigns.js');
const tables = require('./server/table.js');

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

function log() {
  const at = new Date().toISOString().slice(11, 19);
  console.log(at + ' ' + Array.prototype.join.call(arguments, ' '));
}

/* ---- the pieces ---- */
const campaigns = new Campaigns(path.join(ROOT, 'campaigns'), { log: log });
const serve = statics.create(ROOT);
const lobby = new Lobby({
  log: log,
  makeTable: tables.make({ campaign: campaigns, log: log })
});

/* ---- the campaign routes ---- */
function json(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    // the game also runs from a file:// page, which arrives as a null origin
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,accept'
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req, done) {
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 4e6) req.destroy();     // a dossier is kilobytes, not megabytes
  });
  req.on('end', () => done(body));
}

function campaignRoute(req, res, url) {
  const m = /^\/campaign(?:\/([^/?#]*))?\/?$/.exec(url);
  if (!m) return false;
  const name = m[1] ? decodeURIComponent(m[1]) : 'default';

  if (req.method === 'GET') {
    const camp = campaigns.get(name);
    return json(res, camp ? 200 : 404, camp || { error: 'no campaign called ' + name }), true;
  }
  if (req.method === 'PUT') {
    readBody(req, (body) => {
      try { json(res, 200, campaigns.put(name, JSON.parse(body))); }
      catch (e) { json(res, 400, { error: String(e.message) }); }
    });
    return true;
  }
  if (req.method === 'DELETE') {
    return json(res, 200, { ok: campaigns.remove(name) }), true;
  }
  return json(res, 405, { error: 'method not allowed' }), true;
}

/* ---- the server ---- */
const server = http.createServer(function (req, res) {
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'OPTIONS') return json(res, 204);

  if (url === '/campaigns') return json(res, 200, { campaigns: campaigns.list() });
  if (campaignRoute(req, res, url)) return;
  if (url === '/health') return json(res, 200, { ok: true, rooms: lobby.rooms.size, players: lobby.players.size });

  if (serve(req, res)) return;
  json(res, 404, { error: 'not found' });
});

ws.attach(server, '/ws', function (sock) { lobby.connect(sock); });

/* A browser that goes away mid-request — a tab closed, a laptop shut, a network
   dropped — turns up here as a socket error. It is one player's connection, not
   the server's business, so it is noted and the game carries on. */
server.on('clientError', function (err, sock) {
  log('a connection failed: ' + (err && err.code ? err.code : err));
  try { sock.destroy(); } catch (e) { }
});
server.on('error', function (err) {
  if (err && err.code === 'EADDRINUSE') {
    log('port ' + PORT + ' is already in use — run it on another with PORT=9000 node server.js');
    process.exit(1);
  }
  log('the server hit a problem: ' + (err && err.message || err));
});

server.listen(PORT, HOST, function () {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  log('PMC 2670 on http://' + shown + ':' + PORT);
  log('  the game      http://' + shown + ':' + PORT + '/');
  log('  multiplayer   ws://' + shown + ':' + PORT + '/ws');
  log('  campaigns     ' + path.join(ROOT, 'campaigns'));
});

process.on('SIGINT', function () { log('shutting down'); process.exit(0); });
