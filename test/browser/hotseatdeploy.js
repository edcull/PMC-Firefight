/* Setting up a hotseat battle (the hotseat review, HB-3 and HB-6): "Auto-deploy
   the rest" places only the side whose turn it is to place, never the other
   player's army; and with everything down, either player can still reach their
   own transports and insertions — the card switches between them, not stuck on
   Player 1's. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }
  const placed = () => p.evaluate(() => {
    const s = window.PMC_STATE(), on = (sd) => s.units.filter(u => u.side === sd && (u.x >= 0 || u.aboard || u.reserve)).length;
    return { A: on('A'), B: on('B'), nA: s.units.filter(u => u.side === 'A').length, nB: s.units.filter(u => u.side === 'B').length, who: window.__placingSide() };
  });
  const click = (sel) => p.evaluate((s) => { const x = document.querySelector(s); if (!x) return false; x.click(); return true; }, sel);

  console.log('\nAuto-deploy in a hotseat battle (Invasion: Player 1 defends, Player 2 lands)');
  await p.evaluate(() => {
    if (window.PMCMenu) window.PMCMenu.close();
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'invasion', attacker: 'B',
      nameA: 'Defenders', nameB: 'Landing force', colourA: 'ochre', colourB: 'steel',
      armyA: ['regular', 'regular', 'regular', 'regular', 'regular', 'regular'], armyB: ['regular', 'regular', 'regular', 'lapc', 'regular', 'regular'] });
  });
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.__noTactics) window.__noTactics(); const o = document.getElementById('obj-modal'); if (o) o.hidden = true; });
  await p.waitForTimeout(300);
  const before = await placed();
  check('the defender is up to place', before.who === 'A', JSON.stringify(before));
  await click('button[data-act="autodeploy"]');
  await p.waitForTimeout(300);
  for (let n = 0; n < 12 && await p.evaluate(() => !!window.PMC_STATE().faceAsk); n++) await p.evaluate(() => window.__sendIntent({ k: 'vfaceall' }));
  const mid = await placed();
  check('the button sets up the defender', mid.A === mid.nA, JSON.stringify(mid));
  const hint = await p.evaluate(() => (document.getElementById('hint') || {}).textContent || '');
  check('...with no stray refusal for the other player', !/not your turn/i.test(hint), hint);

  console.log('\nEverything down: either player\'s transports');
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-act="deployfor"]')].map(x => x.getAttribute('data-side')));
  check('the card offers both players', tabs.length === 2 && tabs.indexOf('A') >= 0 && tabs.indexOf('B') >= 0, tabs.join(','));
  await click('[data-act="deployfor"][data-side="B"]');
  await p.waitForTimeout(200);
  const onB = await p.evaluate(() => { const x = document.querySelector('[data-act="deployfor"].on'); return x && x.getAttribute('data-side'); });
  check('...and switches to Player 2\'s', onB === 'B', onB);
  const head = await p.evaluate(() => (document.querySelector('#hdr-act, .pill') || {}).textContent || '');
  check('the header no longer says "Deploy your force" for Player 1', !/Deploy your force/.test(head), head);

  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
