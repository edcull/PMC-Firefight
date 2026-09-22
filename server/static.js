/* Hand the game out over HTTP: index.html and the scripts beside it, the build
   directory, and nothing above the project root. No dependencies, no cleverness
   — just enough to load the app in a browser on the far side of the room. */
'use strict';
const fs = require('fs');
const path = require('path');

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
const CLOSED = [/^server[\\/]/, /^campaigns[\\/]/, /^node_modules[\\/]/, /(^|[\\/])\./];

function create(rootDir, opts) {
  opts = opts || {};
  const root = path.resolve(rootDir);
  /* Scripts change every time the developer saves one and the game is one page
     with a dozen of them, so nothing is cached for long. A build asset carries
     its own name and can be held. */
  const maxAge = opts.maxAge === undefined ? 0 : opts.maxAge;

  function resolve(urlPath) {
    let rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
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

    const etag = '"' + st.size.toString(16) + '-' + st.mtimeMs.toString(16) + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag: etag });
      res.end();
      return true;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'content-length': st.size,
      'etag': etag,
      'cache-control': maxAge ? 'public, max-age=' + maxAge : 'no-cache'
    });
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(file).pipe(res);
    return true;
  };
}

module.exports = { create: create, TYPES: TYPES };
