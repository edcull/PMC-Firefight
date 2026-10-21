/* The game's files over HTTP (server/static.js): text gzipped for a browser that
   takes it, plain for one that does not; the bundle, asked for under its own
   fingerprint, kept for good; everything else checked each time, and answered
   "not changed" when it has not. */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const Static = require('../../server/static.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-static-'));
  const js = 'var game = ' + JSON.stringify(Array.from({ length: 2000 }, (x, i) => 'unit' + i)) + ';\n';
  fs.mkdirSync(path.join(dir, 'dist'));
  fs.writeFileSync(path.join(dir, 'dist', 'game.js'), js);
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>t</title>' + 'x'.repeat(2000));
  fs.writeFileSync(path.join(dir, 'tiny.js'), 'var a=1;');
  const serve = Static.create(dir);
  const srv = http.createServer((req, res) => { if (!serve(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const get = (p, headers) => new Promise((r) => {
    http.get({ port, path: p, headers: headers || {} }, (res) => {
      const parts = []; res.on('data', (c) => parts.push(c)); res.on('end', () => r({ code: res.statusCode, h: res.headers, body: Buffer.concat(parts) }));
    });
  });

  console.log('THE GAME’S FILES OVER HTTP');
  const gz = await get('/dist/game.js?v=0123abcd', { 'accept-encoding': 'gzip, deflate, br' });
  ok('a script goes gzipped to a browser that takes it', gz.code === 200 && gz.h['content-encoding'] === 'gzip', gz.h['content-encoding']);
  ok('...and comes out as the file', zlib.gunzipSync(gz.body).toString() === js);
  ok('...smaller than the file', gz.body.length < js.length / 2, gz.body.length + ' of ' + js.length + ' bytes');
  ok('...saying it varies by what the browser takes', /accept-encoding/i.test(gz.h.vary || ''));
  const plain = await get('/dist/game.js?v=0123abcd');
  ok('plain to a browser that does not take gzip', plain.code === 200 && !plain.h['content-encoding'] && plain.body.toString() === js);
  ok('the two have ETags of their own', gz.h.etag && plain.h.etag && gz.h.etag !== plain.h.etag, gz.h.etag + ' / ' + plain.h.etag);
  ok('the bundle under its fingerprint is kept for good', /immutable/.test(gz.h['cache-control'] || '') && /max-age=31536000/.test(gz.h['cache-control']), gz.h['cache-control']);
  const page = await get('/', { 'accept-encoding': 'gzip' });
  ok('the page is checked each time (no-cache), gzipped too', page.h['cache-control'] === 'no-cache' && page.h['content-encoding'] === 'gzip', page.h['cache-control']);
  const bare = await get('/dist/game.js', { 'accept-encoding': 'gzip' });
  ok('the bundle without a fingerprint is not kept for good', bare.h['cache-control'] === 'no-cache', bare.h['cache-control']);
  const again = await get('/dist/game.js?v=0123abcd', { 'accept-encoding': 'gzip', 'if-none-match': gz.h.etag });
  ok('asked again with its ETag: not changed (304)', again.code === 304);
  const tiny = await get('/tiny.js', { 'accept-encoding': 'gzip' });
  ok('a file too small to be worth it goes plain', tiny.code === 200 && !tiny.h['content-encoding'] && tiny.body.toString() === 'var a=1;');
  const head = await new Promise((r) => { const q = http.request({ port, path: '/dist/game.js?v=0123abcd', method: 'HEAD', headers: { 'accept-encoding': 'gzip' } }, (res) => { res.resume(); res.on('end', () => r(res)); }); q.end(); });
  ok('HEAD says the gzipped length, with no body', +head.headers['content-length'] === gz.body.length);

  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
