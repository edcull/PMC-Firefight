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
      if (open && open !== lastCard && !c.borrowed) window.__mineCards++;     // the camera is ours: our own activation's card
      lastCard = open || null;
      if (c.borrowed && !was) { window.__aiStarts++; if (open) window.__bad.push(open); }
      // while the other side's move is still being drawn, nothing is the player's to do
      if (window.__showQueue() > 0 && c.borrowed && window.__mySide()) window.__early = (window.__early || 0) + 1;
      was = c.borrowed;
    }, 4);
  });
  // play a few activations, leaving each card up a while before putting it away
  // by the clock rather than a count of loops: a busy machine gets through fewer of them
  let acts = 0;
  const until = Date.now() + 120000;
  for (let k = 0; Date.now() < until && acts < 5; k++) {
    if (await card()) {
      const mine = await p.evaluate(() => !window.__cam().borrowed);
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
  // and let the other side answer the last of them
  const answer = Date.now() + 30000;
  while (Date.now() < answer) {
    if (await card()) { await p.waitForTimeout(300); await cont(); }
    await p.waitForTimeout(60);
    if (await p.evaluate(() => window.__aiStarts >= 3 && !!window.__mySide())) break;
  }
  const r = await p.evaluate(() => ({ bad: window.__bad, mine: window.__mineCards, ai: window.__aiStarts, early: window.__early || 0 }));
  ok('the player acted, and the other side answered', acts >= 3 && r.ai >= 2, acts + ' activations, the AI started ' + r.ai + ' times');
  ok('...with cards up on the player’s turn to read', r.mine >= 1, r.mine + ' cards');
  ok('the other side never started while a card was up', r.bad.length === 0, r.bad.join(' | '));
  ok('the player could not act while the other side\u2019s move was still being drawn', r.early === 0, r.early + ' moments it could');
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
