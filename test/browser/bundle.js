/* The page that is served: index.html, with every script folded into
   dist/game.js (scripts/bundle.js). The other browser tests play dev.html, the
   scripts one by one; this one checks the bundle itself does the same — it
   loads without an error, fetches nothing from src/, and a battle starts and
   plays between two AI sides. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1100, height: 850 } });
  const errs = [], fetched = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => fetched.push(r.url()));
  p.on('requestfailed', (r) => { if (/^file:/.test(r.url())) errs.push('failed to load ' + r.url()); });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(900);

  let pass = 0, fail = 0;
  function ok(name, cond, note) {
    cond ? pass++ : fail++;
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
  }
  console.log('\nThe served page');
  ok('it loads the one bundle', fetched.some((u) => /\/dist\/game\.js/.test(u)));
  ok('...and nothing from src/ but the stylesheets', !fetched.some((u) => /\/src\/.*\.js/.test(u)), fetched.filter((u) => /\/src\/.*\.js/.test(u)).slice(0, 3).join(' '));
  ok('the game is there', await p.evaluate(() => !!(window.PMC && window.PMCEngine && window.PMCIso && window.PMC_NEWGAME)));

  await startSkirmish(p, { tier: 3, pl: 1, mode: 'demo', scenario: 'meeting', planet: 'sparse', terrain: 'auto' });
  let turn = 0;
  for (let i = 0; i < 120 && turn < 2; i++) {
    await p.waitForTimeout(500);
    turn = await p.evaluate(() => {
      const r = document.getElementById('resolution'), c = document.getElementById('res-continue');
      if (r && !r.hidden && c) c.click();
      const s = window.PMC_STATE && window.PMC_STATE();
      return s && s.phase === 'battle' ? s.turn : 0;
    });
  }
  ok('a battle between two AI sides starts and plays into turn 2', turn >= 2, 'turn ' + turn);
  ok('no errors on the page', !errs.length, errs.slice(0, 3).join(' | '));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
