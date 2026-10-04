#!/usr/bin/env node
/* Runs the test files side by side and keeps going past a failure.

   Every file in test/unit and test/browser is its own script that exits
   non-zero when something in it fails, so this only has to start them, a few
   at a time, and say at the end which ones failed and how long each took.

     node scripts/test.js            the unit tests (seconds)
     node scripts/test.js quick      unit tests and the quick browser tests
     node scripts/test.js slow       the browser tests that play whole games
     node scripts/test.js all        everything
     node scripts/test.js terrain    any test whose name has "terrain" in it
     options: -j N  how many at once · -v  print every test's output

   A failing test's output is printed after the summary, and every test's
   output is kept in build/test-logs/<name>.log. */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGS = path.join(ROOT, 'build', 'test-logs');

/* The browser tests that play one or more whole battles, or a whole campaign,
   through to the end: minutes each rather than seconds. Anything in quick
   that starts taking this long is flagged in the summary so it can be moved. */
// the longest plain scripts, started first so the run is not left waiting on them
const LONG = ['clienttest', 'enginetest', 'servertest'];
const SLOW = ['scentest', 'soloplay', 'rebelplay', 'xenoplay', 'report', 'hotseatsweep', 'followtoggle', 'bugplay', 'hotseatworld'];
const SLOW_AFTER = 90;          // seconds before a quick test is called out as slow
/* The browser tests run the board's clock this many times over (test/fast.js), so
   the animations they wait through are quicker — except the ones that time the
   drawing itself, which run at the real pace. `--speed 1` runs them all as a player sees it. */
let SPEED = 3;
const REAL_TIME = ['bundle', 'collars', 'demoentry', 'artsnap', 'fireart', 'mobile', 'netplay', 'spfill', 'stepoff', 'viewertest'];

const args = process.argv.slice(2);
let jobs = 0, verbose = false;
const words = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-j') jobs = +args[++i];
  else if (/^-j\d+$/.test(args[i])) jobs = +args[i].slice(2);
  else if (args[i] === '-v') verbose = true;
  else if (args[i] === '--speed') SPEED = +args[++i] || 1;
  else words.push(args[i]);
}
const SETS = { unit: 1, quick: 1, slow: 1, all: 1, browser: 1 };
const set = words.find((w) => SETS[w]) || (words.length ? 'all' : 'unit');
const filters = words.filter((w) => !SETS[w]);

function list(dir) {
  return fs.readdirSync(path.join(ROOT, 'test', dir)).filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f.slice(0, -3), file: path.join('test', dir, f), browser: dir === 'browser' }));
}
const unit = list('unit'), browser = list('browser');
browser.forEach((t) => { t.slow = SLOW.includes(t.name); });
let tests = {
  unit: unit,
  quick: unit.concat(browser.filter((t) => !t.slow)),
  slow: browser.filter((t) => t.slow),
  browser: browser,
  all: unit.concat(browser)
}[set];
if (filters.length) tests = tests.filter((t) => filters.some((f) => t.name.includes(f)));
if (!tests.length) { console.log('No tests match.'); process.exit(1); }

// the browser tests want playwright; take the global copy when there is no local one
const env = Object.assign({}, process.env);
try { require.resolve('playwright', { paths: [ROOT] }); } catch (e) {
  try {
    const g = execSync('npm root -g', { encoding: 'utf8' }).trim();
    env.NODE_PATH = [g, env.NODE_PATH].filter(Boolean).join(path.delimiter);
  } catch (e2) { /* the browser tests will say so themselves */ }
}

/* Browsers are heavy, so fewer of those run at once than plain node scripts.
   The slow ones go first, so the run is not left waiting on one at the end. */
const cpus = os.cpus().length;
const maxUnit = jobs || Math.max(2, cpus);
// browser tests spend most of their time waiting on the page, not the processor: one a core
const maxBrowser = jobs || Math.max(1, cpus);
const weight = (t) => t.slow ? 3 : LONG.includes(t.name) ? 2 : t.browser ? 1 : 0;
tests.sort((a, b) => weight(b) - weight(a));

fs.mkdirSync(LOGS, { recursive: true });
const results = [];
let running = 0, runningBrowser = 0, runningSlow = 0, next = 0;
// the slow ones play whole battles, some two at a time themselves: at most half the cores of them at once
const maxSlow = jobs || Math.max(1, Math.floor(cpus / 2));
const t0 = Date.now();

function start(t) {
  running++; if (t.browser) runningBrowser++; if (t.slow) runningSlow++;
  const began = Date.now();
  const out = [];
  // unit tests roll seeded dice (test/seed.js); browser tests seed their pages themselves (where.js seedDice)
  const args = t.browser ? ['-r', path.join(ROOT, 'test', 'fast.js'), t.file] : ['-r', path.join(ROOT, 'test', 'seed.js'), t.file];
  const child = spawn(process.execPath, args, { cwd: ROOT, env: Object.assign({}, env, { PMC_TEST_SPEED: t.browser && REAL_TIME.indexOf(t.name) < 0 ? String(SPEED) : '1' }) });
  const limit = (t.slow ? 20 : t.browser ? 3 : 5) * 60 * 1000;
  let hung = false;
  const timer = setTimeout(() => { hung = true; out.push('\n[timed out after ' + limit / 60000 + ' min]\n'); child.kill('SIGKILL'); }, limit);
  child.stdout.on('data', (d) => { out.push(d); if (verbose) process.stdout.write(d); });
  child.stderr.on('data', (d) => { out.push(d); if (verbose) process.stderr.write(d); });
  child.on('close', (code) => {
    clearTimeout(timer);
    const secs = (Date.now() - began) / 1000, text = Buffer.concat(out.map((b) => Buffer.isBuffer(b) ? b : Buffer.from(b))).toString();
    fs.writeFileSync(path.join(LOGS, t.name + '.log'), text);
    /* A browser test that hung or failed (a page that fell behind under the load of
       the others) is run once more, at the back of the queue; said in the summary,
       with how the second run went. A real fault fails both times. */
    if ((hung || code !== 0) && t.browser && !t.retried) {
      t.retried = true;
      console.log('  … ' + t.file.padEnd(34) + (hung ? ' hung after ' : ' failed after ') + secs.toFixed(0) + 's: run again');
      running--; if (t.browser) runningBrowser--; if (t.slow) runningSlow--;
      tests.push(t);
      pump();
      return;
    }
    results.push({ t: t, ok: code === 0, secs: secs, text: text });
    console.log((code === 0 ? '  ✓ ' : '  ✗ ') + t.file.padEnd(34) + secs.toFixed(1).padStart(7) + 's');
    running--; if (t.browser) runningBrowser--; if (t.slow) runningSlow--;
    pump();
  });
}
function pump() {
  // take the first waiting test there is room for: a browser test waiting on a
  // browser slot does not hold back the plain scripts behind it
  while (running < maxUnit && next < tests.length) {
    let k = next;
    while (k < tests.length && ((tests[k].browser && runningBrowser >= maxBrowser) || (tests[k].slow && runningSlow >= maxSlow))) k++;
    if (k >= tests.length) break;
    const t = tests.splice(k, 1)[0];
    tests.splice(next, 0, t);
    start(tests[next++]);
  }
  if (!running && next >= tests.length) finish();
}
function finish() {
  const bad = results.filter((r) => !r.ok);
  bad.forEach((r) => {
    console.log('\n──── ' + r.t.file + ' ────');
    console.log(r.text.split('\n').slice(-40).join('\n'));
  });
  const again = results.filter((r) => r.t.retried);
  if (again.length) console.log('\nRun a second time (hung or failed the first): ' + again.map((r) => r.t.name + (r.ok ? ' (passed)' : ' (failed)')).join(', '));
  const slowQuick = results.filter((r) => r.t.browser && !r.t.slow && r.secs > SLOW_AFTER);
  if (slowQuick.length) console.log('\nTaking long for the quick set (move to SLOW in scripts/test.js?): ' + slowQuick.map((r) => r.t.name + ' ' + r.secs.toFixed(0) + 's').join(', '));
  console.log('\n' + (results.length - bad.length) + ' passed, ' + bad.length + ' failed, in ' +
    ((Date.now() - t0) / 1000).toFixed(0) + 's' + (bad.length ? ' — failed: ' + bad.map((r) => r.t.name).join(', ') : ''));
  process.exit(bad.length ? 1 : 0);
}

console.log('Running ' + tests.length + ' test file' + (tests.length > 1 ? 's' : '') + ' (' + set + (filters.length ? ', matching ' + filters.join(' ') : '') + '), ' +
  maxUnit + ' at once, ' + maxBrowser + ' browser' + (maxBrowser > 1 ? 's' : '') + ' at once');
pump();
