/* The source, linted: nothing used that is not defined, no key given twice
   (eslint.config.cjs). The code is split across many files that bind each
   other's names by hand, so a name dropped in a move shows up here rather than
   the first time a player reaches the code that needed it. eslint is not a
   dependency of the game; where it cannot be found the check says so and
   passes. */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '../..');
let ESLint = null;
for (const where of [ROOT, '/opt/node22/lib/node_modules/eslint', '/usr/local/lib/node_modules/eslint', '/usr/lib/node_modules/eslint']) {
  try { ESLint = require(require.resolve('eslint', { paths: [where] })).ESLint; break; } catch (e) { /* not there */ }
}
if (!ESLint) { console.log('  - eslint not found: the lint is skipped'); process.exit(0); }
(async () => {
  const lint = new ESLint({ cwd: ROOT, overrideConfigFile: path.join(ROOT, 'eslint.config.cjs') });
  const res = await lint.lintFiles(['src', 'server', 'scripts', 'server.js']);
  let bad = 0;
  res.forEach((r) => r.messages.forEach((m) => {
    if (m.severity < 2) return;
    bad++;
    console.log('  ✗ ' + path.relative(ROOT, r.filePath) + ':' + m.line + ' ' + m.message + ' (' + m.ruleId + ')');
  }));
  console.log('\n' + res.length + ' files linted, ' + bad + ' problems.');
  process.exit(bad ? 1 : 0);
})();
