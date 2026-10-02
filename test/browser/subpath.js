/* The game server behind a reverse proxy on a sub-path, as nginx serves it on
   the Pi: https://host/pmc/ proxied to the server's own root. The page, its
   health check, the campaign list and the lobby's WebSocket all have to be
   found under /pmc/, not at the root of the site (where something else is). */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const { ROOT , signInLobby, tmpData } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const PORT = 9700 + Math.floor(Math.random() * 200), PROXY = PORT + 300;
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT), HOST: '127.0.0.1' }), stdio: 'ignore' });
  /* What nginx does with `location /pmc/ { proxy_pass http://127.0.0.1:PORT/; }`:
     /pmc/... goes to the server as /..., WebSocket upgrades included; anything
     else is somebody else's (here, a 404 that says so). */
  const seen = { outside: [] };
  const strip = (u) => u.replace(/^\/pmc\//, '/');
  const proxy = http.createServer((req, res) => {
    if (!req.url.startsWith('/pmc/')) { seen.outside.push(req.url); res.writeHead(404); res.end('not the game'); return; }
    const up = http.request({ host: '127.0.0.1', port: PORT, path: strip(req.url), method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode, r.headers); r.pipe(res);
    });
    up.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  proxy.on('upgrade', (req, sock, head) => {
    if (!req.url.startsWith('/pmc/')) { seen.outside.push(req.url); sock.destroy(); return; }
    const up = net.connect(PORT, '127.0.0.1', () => {
      let h = req.method + ' ' + strip(req.url) + ' HTTP/1.1\r\n';
      for (let i = 0; i < req.rawHeaders.length; i += 2) h += req.rawHeaders[i] + ': ' + req.rawHeaders[i + 1] + '\r\n';
      up.write(h + '\r\n'); if (head && head.length) up.write(head);
      up.pipe(sock); sock.pipe(up);
    });
    up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
  });
  await new Promise((r) => proxy.listen(PROXY, '127.0.0.1', r));
  for (let i = 0; i < 40; i++) {
    await wait(150);
    if (await fetch('http://127.0.0.1:' + PORT + '/health').then((r) => r.ok).catch(() => false)) break;
  }

  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:' + PROXY + '/pmc/');
  await p.waitForTimeout(1200);
  ok('the page loads under /pmc/', await p.evaluate(() => !!window.PMC && !!document.getElementById('menu')));
  ok('...finds the game server (the Multiplayer card is live)', await p.evaluate(() => !document.getElementById('btn-multi').disabled));
  // signed in under /pmc/ (the account routes are relative too), then the socket
  let welcomed = false;
  try { await signInLobby(p, 'Subpath Sam', 'register'); welcomed = await p.evaluate(() => window.PMCLobby.net().url || true); } catch (e) { welcomed = false; }
  ok('...and the lobby connects over the WebSocket under /pmc/', !!welcomed, String(welcomed));
  await p.waitForTimeout(500);
  // (bar the browser's own favicon lookup, which every page gets)
  const astray = seen.outside.filter((u) => u !== '/favicon.ico');
  ok('nothing was asked of the root of the site', astray.length === 0, astray.join(', '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close(); proxy.close(); srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
