/* Fold every script into one file, which is what the Artifact tool publishes. */
const fs = require('fs'), path = require('path');
// the tool lives in scripts/; everything it reads and writes is a level up
const ROOT = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
  return '<script>\n/* ---- ' + src + ' ---- */\n' + code + '\n</script>';
});
const out = path.join(ROOT, 'build', 'firefight.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log((fs.statSync(out).size / 1024).toFixed(0) + ' KB → ' + out);

// the attack viewer, inlined the same way, so it can be published on its own
(function () {
  var fs2 = require('fs'), p2 = require('path');
  var v = fs2.readFileSync(p2.join(ROOT, 'viewer.html'), 'utf8');
  v = v.replace(/<script src="([^"]+)"><\/script>/g, function (m, src) {
    return '<script>\n' + fs2.readFileSync(p2.join(ROOT, src), 'utf8').replace(/<\/script/g, '<\\/script') + '\n</script>';
  });
  v = v.replace(/<title>[^<]*<\/title>/, '<title>PMC 2670 Attack Viewer</title>');
  // beside the single-file build, the game it goes back to is firefight.html
  v = v.replace('href="index.html"', 'href="firefight.html"');
  fs2.writeFileSync(p2.join(ROOT, 'build', 'viewer.html'), v);
  console.log(Math.round(v.length / 1024) + ' KB → build/viewer.html');
})();
