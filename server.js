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
     DATA_DIR=/var/lib/pmc          the database (accounts, and later the games) kept outside the code
     CAMPAIGNS_DIR=/var/lib/pmc     the campaigns kept outside the code, so a deploy leaves them be
     ALLOWED_ORIGINS=https://a.b    pages elsewhere allowed to open the game's socket
*/
'use strict';
const http = require('http');
const path = require('path');

const ws = require('./server/ws.js');
const statics = require('./server/static.js');
const { Lobby } = require('./server/lobby.js');
const { Campaigns } = require('./server/campaigns.js');
const tables = require('./server/table.js');
const app = require('./server/app.js');
const DB = require('./server/db.js');
const Auth = require('./server/auth.js');

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

function log() {
  const at = new Date().toISOString().slice(11, 19);
  console.log(at + ' ' + Array.prototype.join.call(arguments, ' '));
}

/* ---- the pieces ---- */
/* The database's folder: DATA_DIR, or beside the campaigns where only those were
   placed (an install from before there was a database: /var/lib/pmc-firefight on the
   Pi, where the service may write), or data/ beside this file. */
const DATA_DIR = process.env.DATA_DIR || (process.env.CAMPAIGNS_DIR ? path.dirname(path.resolve(process.env.CAMPAIGNS_DIR)) : path.join(ROOT, 'data'));
const db = DB.open(path.join(DATA_DIR, 'pmc.db'));
const auth = Auth.create({ db: db, log: log });
// sessions long expired are cleared out now and again
setInterval(function () { auth.sweep(); }, 6 * 60 * 60 * 1000).unref();
const campaigns = new Campaigns(process.env.CAMPAIGNS_DIR || path.join(ROOT, 'campaigns'), { log: log });
const serve = statics.create(ROOT);
const lobby = new Lobby({
  log: log,
  makeTable: tables.make({ campaign: campaigns, log: log })
});

/* ---- the server ---- */
const handle = app.create({ campaigns: campaigns, lobby: lobby, serve: serve, auth: auth, allowOrigin: allowOrigin });
const server = http.createServer(function (req, res) {
  // one request going wrong is answered and logged; it does not take the server down (MP-1)
  try { handle(req, res); }
  catch (e) {
    log('a request failed: ' + ((e && e.stack) || e));
    try { if (!res.headersSent) { res.writeHead(500); } res.end(); } catch (e2) { }
  }
});

/* Sockets only from pages of this server's own (MP-8): the Host it was asked
   for, or the one a proxy in front says it was asked for, or any named in
   ALLOWED_ORIGINS (comma-separated, e.g. https://example.org). */
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
function allowOrigin(origin, req) {
  if (ALLOWED.indexOf(origin) >= 0 || ws.sameHost(origin, req)) return true;
  let host; try { host = new URL(origin).host; } catch (e) { return false; }
  return String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() === host;
}
// a socket is opened only by someone signed in (or playing as a guest): the session behind its cookie
ws.attach(server, '/ws', function (sock, req, who) { lobby.connect(sock, who); }, {
  allowOrigin: allowOrigin,
  authorize: function (req) { return auth.session(Auth.tokenFrom(req)); }
});

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
  log('  campaigns     ' + (process.env.CAMPAIGNS_DIR || path.join(ROOT, 'campaigns')));
  log('  database      ' + path.join(DATA_DIR, 'pmc.db') + ' (' + db.users().length + ' accounts)');
});

/* Anything thrown that nothing caught is logged, and the server carries on: one
   player's bad message must not end everyone's battle (MP-1). */
process.on('uncaughtException', function (e) { log('uncaught: ' + ((e && e.stack) || e)); });
process.on('unhandledRejection', function (e) { log('unhandled: ' + ((e && e.stack) || e)); });
// stopped (Ctrl-C, or systemd): stop taking connections, then go
function stop(sig) {
  log('shutting down (' + sig + ')');
  server.close(function () { try { db.close(); } catch (e) { } process.exit(0); });
  setTimeout(function () { process.exit(0); }, 2000).unref();
}
process.on('SIGINT', function () { stop('SIGINT'); });
process.on('SIGTERM', function () { stop('SIGTERM'); });
