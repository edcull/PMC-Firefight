/* Hand the game out over HTTP: index.html and the scripts beside it, the build
   directory, and nothing above the project root. No dependencies, no cleverness
   — just enough to load the app in a browser on the far side of the room. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

/* The app is the page, the scripts beside it and the build. The server's own
   source, the saved campaigns and anything hidden are not part of the app and
   are not handed out — the campaigns have a route of their own, which says
   what a client may see of them. */
/* Text is sent gzipped to a browser that takes it: the bundle is a third the size
   (1.9 MB to 0.6 MB), which counts on a phone. Each file is compressed once for
   each version of it and kept, so a busy server is not compressing the same bytes
   over and over. */
const PACK = /^(text\/|application\/json|image\/svg)/;
const PACKED = new Map();                         // file -> { etag, body }
const PACK_MAX = 64;
function packed(file, etag) {
  const had = PACKED.get(file);
  if (had && had.etag === etag) return had.body;
  const body = zlib.gzipSync(fs.readFileSync(file), { level: 6 });
  if (PACKED.size >= PACK_MAX) PACKED.delete(PACKED.keys().next().value);
  PACKED.set(file, { etag: etag, body: body });
  return body;
}

const CLOSED = [/^server[\\/]/, /^campaigns[\\/]/, /^data[\\/]/, /^node_modules[\\/]/, /(^|[\\/])\./];

function create(rootDir, opts) {
  opts = opts || {};
  const root = path.resolve(rootDir);
  /* Scripts change every time the developer saves one and the game is one page
     with a dozen of them, so nothing is cached for long. A build asset carries
     its own name and can be held. */
  const maxAge = opts.maxAge === undefined ? 0 : opts.maxAge;

  function resolve(urlPath) {
    let rel;
    // a malformed percent-escape is a bad request, not a reason for the server to fall over (MP-1)
    try { rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch (e) { return null; }
    if (rel === '/' || rel === '') rel = '/index.html';
    // strip leading slashes, then resolve and check we are still inside the root
    const full = path.resolve(root, '.' + path.posix.normalize(rel));
    if (full !== root && !full.startsWith(root + path.sep)) return null;
    const inside = path.relative(root, full);
    if (inside && CLOSED.some((re) => re.test(inside))) return null;
    return full;
  }

  return function serve(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain' });
      res.end('method not allowed');
      return true;
    }
    let file = resolve(req.url);
    if (!file) { res.writeHead(403); res.end('forbidden'); return true; }

    let st;
    try { st = fs.statSync(file); }
    catch (e) { return false; }                 // not ours — let the caller 404 it
    if (st.isDirectory()) {
      file = path.join(file, 'index.html');
      try { st = fs.statSync(file); } catch (e) { return false; }
    }

    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const gzip = PACK.test(type) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    // (the gzipped copy is another representation, with an ETag of its own)
    const base = st.size.toString(16) + '-' + st.mtimeMs.toString(16);
    const etag = '"' + base + (gzip ? '-gz' : '') + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag: etag });
      res.end();
      return true;
    }
    /* The bundle (dist/, scripts/bundle.js) is asked for under its content's own
       fingerprint (?v=...): a new build is a new address, so it may be kept for good.
       Everything else is checked each time (the ETag makes that a 304 when unchanged). */
    const forGood = /^\/dist\//.test(req.url) && /[?&]v=[0-9a-f]+/.test(req.url);
    const cache = forGood ? 'public, max-age=31536000, immutable' : maxAge ? 'public, max-age=' + maxAge : 'no-cache';
    let body = null;
    if (gzip) { try { body = packed(file, etag); } catch (e) { body = null; } }
    const head = { 'content-type': type, 'etag': etag, 'cache-control': cache, 'content-length': body ? body.length : st.size };
    if (PACK.test(type)) head.vary = 'Accept-Encoding';
    if (body) head['content-encoding'] = 'gzip';
    res.writeHead(200, head);
    if (req.method === 'HEAD') { res.end(); return true; }
    if (body) res.end(body);
    else fs.createReadStream(file).pipe(res);
    return true;
  };
}

module.exports = { create: create, TYPES: TYPES };
