/* Every file the game is made of is loaded by the pages and lists that need it.

   The rules, the engine, the campaign and the renderer each make their parts
   from files beside them (root.PMCMove, root.PMCEngineAI, ...). A part left
   off a page's script tags, the unit gallery's list or the server's list is a
   page that breaks the first time it wants that part, so each is checked
   here: every file is loaded by one page or the other; the viewer's page
   loads every part the rules and the renderer are made from; the gallery and
   the server load every part the rules (and, on the server, the engine and
   the campaign) are made from. The server's list is the one the page's AI
   worker loads too (src/engine/files.js), and the worker counts as a page. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
function ok(what, missing) {
  if (!missing.length) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + ' — missing: ' + missing.join(', ')); }
}
const files = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => dir + '/' + f);
const tags = (page) => (read(page).match(/<script src="([^"?]+)/g) || []).map((m) => m.slice(13));

// the parts a host file makes itself from: every root.PMCXxx it looks for beside it
function partsOf(host) {
  const src = read(host), want = new Set();
  (src.match(/root\.(PMC\w+)\s*\|\|\s*require\('\.\/([\w-]+)\.js'\)/g) || []).forEach((m) => want.add(m.match(/'\.\/([\w-]+)\.js'/)[1]));
  (src.match(/root\.(PMC\w+)\(/g) || []).forEach((m) => want.add(m.slice(5, -1)));
  return want;
}
// which file defines each global
const defines = {};
['src/rules', 'src/engine', 'src/view', 'src/net'].forEach((d) => files(d).forEach((f) => {
  (read(f).match(/root\.(PMC\w+)\s*=\s*(function|\{)/g) || []).forEach((m) => { defines[m.match(/PMC\w+/)[0]] = f; });
}));
function partFiles(host) {
  return [...partsOf(host)].map((w) => (w.startsWith('PMC') ? defines[w] : path.dirname(host) + '/' + w + '.js')).filter(Boolean);
}

console.log('\nTHE GAME\'S PAGE');
const index = tags('index.html'), viewer = tags('viewer.html');
// the engine's own list (the server's and the worker's), and the workers a script on the page starts
const engineFiles = require(path.join(ROOT, 'src/engine/files.js'));
const workers = index.flatMap((f) => (read(f).match(/new root\.Worker\('(src\/[\w/.-]+\.js)/g) || []).map((m) => m.match(/'(src[^']+)/)[1]));
const byWorker = workers.length ? workers.concat(['src/engine/files.js'], engineFiles) : [];
ok('every file under src/ is loaded by one page or the other',
  ['src/rules', 'src/engine', 'src/view', 'src/net'].flatMap(files).filter((f) => index.indexOf(f) < 0 && viewer.indexOf(f) < 0 && byWorker.indexOf(f) < 0));
ok('every script index.html loads exists', index.filter((f) => !fs.existsSync(path.join(ROOT, f))));

console.log('\nTHE UNIT VIEWER\'S PAGE');
const drawParts = files('src/view').filter((f) => /\/iso-[\w-]+\.js$/.test(f));
ok('it loads every part the rules are made from', partFiles('src/rules/rules.js').filter((f) => viewer.indexOf(f) < 0));
ok('...and every part of the renderer', drawParts.filter((f) => viewer.indexOf(f) < 0));
ok('every script viewer.html loads exists', viewer.filter((f) => !fs.existsSync(path.join(ROOT, f))));

console.log('\nTHE UNIT GALLERY AND THE SERVER');
const gallery = read('scripts/gallery.js');
ok('the gallery loads every part the rules are made from', partFiles('src/rules/rules.js').filter((f) => gallery.indexOf(f) < 0));
ok('the server loads the engine\'s list', /src\/engine\/files\.js/.test(read('server/rules.js')) ? [] : ['src/engine/files.js']);
ok('...which has every part of the rules, the campaign and the engine (the AI worker\'s too)',
  ['src/rules/rules.js', 'src/rules/campaign.js', 'src/engine/engine.js'].flatMap(partFiles).filter((f) => engineFiles.indexOf(f) < 0));
ok('the AI worker loads the engine\'s list', /PMC_ENGINE_FILES/.test(read('src/engine/aiworker.js')) && /files\.js/.test(read('src/engine/aiworker.js')) ? [] : ['src/engine/files.js']);
// and the parts come before the file that makes them, on every page
function order(list, host, parts) { const h = list.indexOf(host); return parts.filter((f) => list.indexOf(f) > h); }
ok('on the game\'s page each part comes before the file made from it',
  ['src/rules/rules.js', 'src/rules/campaign.js', 'src/engine/engine.js', 'src/view/dossier.js'].flatMap((h) => order(index, h, partFiles(h)))
    .concat(order(index, 'src/view/iso.js', drawParts)));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
