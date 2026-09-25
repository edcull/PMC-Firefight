/* A skirmish can be thrown away from the main menu: "Discard this battle",
   asked twice. It is not offered for a campaign's battle. After it the menu
   has no battle to go back to, and a new one starts cleanly. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const menu = (p) => p.evaluate(() => ({
  open: !document.getElementById('menu').hidden,
  resume: !document.getElementById('btn-resume').hidden,
  discard: !document.getElementById('btn-discard').hidden,
  confirm: document.getElementById('btn-discard').classList.contains('confirm'),
  sub: document.getElementById('menu-resume-sub').textContent,
  x: document.getElementById('btn-discard').textContent,
  live: !!window.PMC_BATTLE_LIVE()
}));
async function skirmish(p, extra) {
  await p.evaluate((x) => {
    window.PMC_NEWGAME(Object.assign({ tier: 3, pl: 1, mode: 'ai', planet: 'sparse', scenario: 'meeting', nameA: 'A', nameB: 'B',
      armyA: ['regular', 'regular'], armyB: ['recruits', 'recruits'] }, x || {}));
  }, extra || null);
  await p.waitForTimeout(600);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  console.log('\n  Discarding a skirmish');
  await skirmish(p);
  await p.evaluate(() => window.PMCMenu.open());
  await p.waitForTimeout(200);
  let m = await menu(p);
  ok('the menu offers the battle back, with an x on it to discard it', m.open && m.resume && m.discard && m.live && m.x === '\u00d7', m.x);
  await p.evaluate(() => document.getElementById('btn-discard').click());
  await p.waitForTimeout(150);
  m = await menu(p);
  ok('the first tap on the x only asks to be sure', m.confirm && m.live && /undone/i.test(m.sub) && /discard/i.test(m.x), m.x + ' / ' + m.sub);
  await p.evaluate(() => document.getElementById('btn-discard').click());
  await p.waitForTimeout(250);
  m = await menu(p);
  ok('the second throws it away: no battle, nothing to go back to', !m.live && !m.resume && !m.discard && m.open);
  ok('...and nothing is left of it', await p.evaluate(() => window.PMC_STATE() === null));
  await p.waitForTimeout(400);                              // any frame still queued must cope with no battle

  console.log('\n  A new battle after it');
  await p.evaluate(() => window.PMCMenu.close());
  await skirmish(p);
  m = await p.evaluate(() => ({ live: !!window.PMC_BATTLE_LIVE(), units: window.PMC_STATE().units.length }));
  ok('a fresh skirmish starts cleanly', m.live && m.units === 4, JSON.stringify(m));
  await p.evaluate(() => window.PMCMenu.open());
  await p.waitForTimeout(150);
  m = await menu(p);
  ok('...and the discard asks afresh, not already primed', m.discard && !m.confirm);

  console.log('\n  Not for a campaign battle');
  await p.evaluate(() => window.PMCMenu.close());
  await skirmish(p, { campaign: true });
  await p.evaluate(() => window.PMCMenu.open());
  await p.waitForTimeout(150);
  m = await menu(p);
  ok('a campaign\'s battle cannot be discarded from here', m.resume && !m.discard);

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
