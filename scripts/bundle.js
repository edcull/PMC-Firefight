/* PMC 2670 — Firefight : the site as it is published.

   index.html is the page as it is worked on, and as it runs straight from
   the repository: every script loaded on its own, in order, so an edit shows
   on a reload and an error names the file and line. The published site is
   built from it by CI (.github/workflows/pages.yml): the same page with those
   scripts folded into one minified file, dist/game.js — one download and one
   parse instead of seventy-odd, and under half the bytes. Nothing built is
   kept in the repository.

     node scripts/bundle.js      writes the site to build/site/

   build/site holds index.html (the bundled page), dist/game.js, and what the
   page and the unit viewer load as they are: viewer.html and src/. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'build', 'site');
const OUT = 'dist/game.js';
const TAG = /<script src="(src\/[^"?]+)(?:\?v=[0-9a-f]+)?"><\/script>\n?/g;
// what index.html loads only for the tests, left out of every published build
const DEV_ONLY = ['src/view/testhooks.js'];

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
// the scripts a page loads, in order, less the tests' own
function scriptsOf(html) { return Array.from(html.matchAll(TAG), (m) => m[1]).filter((f) => DEV_ONLY.indexOf(f) < 0); }
// the published page: the page with its script tags replaced by the one bundle, where the first of them stood
function pageFor(page, bundleRef) {
  let first = true;
  return page.replace(TAG, () => { if (!first) return ''; first = false; return '<script src="' + bundleRef + '"></script>\n'; });
}
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach((d) => {
    const a = path.join(from, d.name), b = path.join(to, d.name);
    if (d.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  });
}

async function build() {
  const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const list = scriptsOf(page);
  const input = {};
  list.forEach((f) => { input[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
  const res = await require('terser').minify(input, {
    compress: { passes: 1 }, mangle: true,
    format: { preamble: '/*! PMC 2670 Firefight: ' + list.length + ' scripts in one */' }
  });
  fs.rmSync(SITE, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'src'), path.join(SITE, 'src'));
  DEV_ONLY.forEach((f) => fs.rmSync(path.join(SITE, f), { force: true }));
  fs.copyFileSync(path.join(ROOT, 'viewer.html'), path.join(SITE, 'viewer.html'));
  fs.mkdirSync(path.join(SITE, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(SITE, OUT), res.code);
  fs.writeFileSync(path.join(SITE, 'index.html'), pageFor(page, OUT + '?v=' + sha(res.code).slice(0, 10)));
  const raw = list.reduce((n, f) => n + input[f].length, 0);
  console.log(list.length + ' scripts, ' + Math.round(raw / 1024) + ' KB → build/site/' + OUT + ' ' + Math.round(res.code.length / 1024) + ' KB');
}

module.exports = { scriptsOf, pageFor, build, SITE, OUT, DEV_ONLY };
if (require.main === module) build().catch((e) => { console.error(e); process.exit(1); });
