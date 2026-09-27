/* PMC 2670 — Firefight : the page as it is served.

   dev.html is the page as it is worked on: every script loaded on its own, in
   order, so an edit shows on a reload (and an error names the file and line).
   index.html is built from it: the same page with those scripts folded into
   one minified file, dist/game.js. One download and one parse instead of
   seventy-odd, and under half the bytes. It is committed, since the pages are
   served straight from the repository, so it carries no source map: debug on
   dev.html.

   The bundle's first line names a fingerprint of the sources it was made from;
   test/unit/loadlists.js checks it against the sources as they are, and
   index.html against dev.html, so a stale build cannot go out unnoticed. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const OUT = 'dist/game.js';
const TAG = /<script src="(src\/[^"?]+)(?:\?v=[0-9a-f]+)?"><\/script>\n?/g;

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
// the scripts a page loads, in order
function scriptsOf(html) { return Array.from(html.matchAll(TAG), (m) => m[1]); }
// a fingerprint of what those scripts say now
function sourceHash(list) { return sha(list.map((f) => f + '\n' + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')).slice(0, 16); }
// the served page: dev.html with its script tags replaced by the one bundle, where the first of them stood
function pageFor(dev, bundleRef) {
  let first = true;
  return dev
    .replace(/<!-- dev:[\s\S]*?-->\n/, '<!-- Built from dev.html by `npm run build`: edit that, not this. -->\n')
    .replace(TAG, () => { if (!first) return ''; first = false; return '<script src="' + bundleRef + '"></script>\n'; });
}
function bundleRef(code) { return OUT + '?v=' + sha(code).slice(0, 10); }
function headerHash(code) { const m = /^\/\*! PMC 2670 Firefight: \d+ scripts, sources ([0-9a-f]+) \*\//.exec(code); return m ? m[1] : null; }

async function build() {
  const dev = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8');
  const list = scriptsOf(dev), hash = sourceHash(list);
  const outFile = path.join(ROOT, OUT);
  let code = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  // made again only when the sources have changed, so the build is quick and the file stays put
  if (headerHash(code) !== hash) {
    const terser = require('terser');
    const input = {};
    list.forEach((f) => { input[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
    const res = await terser.minify(input, {
      compress: { passes: 1 }, mangle: true,
      format: { preamble: '/*! PMC 2670 Firefight: ' + list.length + ' scripts, sources ' + hash + ' */' }
    });
    code = res.code;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, code);
  }
  fs.writeFileSync(path.join(ROOT, 'index.html'), pageFor(dev, bundleRef(code)));
  const raw = list.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
  console.log(list.length + ' scripts, ' + Math.round(raw / 1024) + ' KB → ' + OUT + ' ' + Math.round(code.length / 1024) + ' KB');
}

module.exports = { scriptsOf, sourceHash, pageFor, bundleRef, headerHash, OUT };
if (require.main === module) build().catch((e) => { console.error(e); process.exit(1); });
module.exports.build = build;
