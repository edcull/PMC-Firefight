/* On a phone the results come up as cards to be read. The other side's next
   activation waits until the player's own cards are put away: the AI does not
   take the camera and start moving while the player is still reading what
   their unit just did. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  const card = () => p.evaluate(() => !document.getElementById('resolution').hidden);
  const cont = () => p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
  for (let i = 0; i < 12 && await card(); i++) { await cont(); await p.waitForTimeout(150); }
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  for (let i = 0; i < 12 && await card(); i++) { await cont(); await p.waitForTimeout(150); }
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(800);

  /* The page watches every few milliseconds: the moment the camera goes over
     to the other side is the moment its activation starts, and no card of the
     player's may be up then. Cards opened on the player's turn are counted. */
  await p.evaluate(() => {
    window.__bad = []; window.__mineCards = 0; window.__aiStarts = 0;
    let was = false, lastCard = null;
    setInterval(() => {
      const c = window.__cam(), open = window.__resOpen();
      if (open && open !== lastCard && window.__mySide()) window.__mineCards++;
      lastCard = open || null;
      if (c.borrowed && !was) { window.__aiStarts++; if (open) window.__bad.push(open); }
      was = c.borrowed;
    }, 4);
  });
  // play a few activations, leaving each card up a while before putting it away
  let acts = 0;
  for (let k = 0; k < 500 && acts < 5; k++) {
    if (await card()) {
      const mine = await p.evaluate(() => !!window.__mySide());
      await p.waitForTimeout(mine ? 900 : 100);      // reading it
      await cont();
      await p.waitForTimeout(80);
      continue;
    }
    const did = await p.evaluate(() => {
      if (!window.__mySide() || window.__busy()) return false;
      const u = window.__eligibleUnits()[0];
      return !!(u && window.__select(u) && window.__pressAction('regroup'));
    });
    if (did) acts++;
    await p.waitForTimeout(60);
  }
  for (let k = 0; k < 120; k++) {
    if (await card()) { await p.waitForTimeout(300); await cont(); }
    await p.waitForTimeout(60);
  }
  const r = await p.evaluate(() => ({ bad: window.__bad, mine: window.__mineCards, ai: window.__aiStarts }));
  ok('the player acted, and the other side answered', acts >= 3 && r.ai >= 2, acts + ' activations, the AI started ' + r.ai + ' times');
  ok('...with cards up on the player’s turn to read', r.mine >= 1, r.mine + ' cards');
  ok('the other side never started while a card was up', r.bad.length === 0, r.bad.join(' | '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
