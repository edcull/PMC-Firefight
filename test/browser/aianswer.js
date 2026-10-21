/* The OpFor answers a player in a battle of their own, not inside the tap that
   asked: the player's move is the engine's whole work in that tap, and the
   computer thinks after the board has drawn it (net.js settleAI). Nothing else
   comes between the two, and the save marks where the answer came, so the
   battle kept on this device plays back to the same place — the new way, and
   the old way too, with the answer given at once. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish, seedDice } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await seedDice(p, 2670);
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

  console.log('\n  THE ANSWER AFTER THE TAP');
  // the player's units move up, one an activation; each move asked for in a tap of its own
  let acts = 0, owedAfter = 0, settled = 0;
  const until = Date.now() + 150000;
  while (Date.now() < until && acts < 10) {
    if (await card()) { await cont(); await p.waitForTimeout(60); continue; }
    const r = await p.evaluate(async () => {
      const s = window.PMC_STATE(), side = s.activeSide;     // (the state is the live one: its side read now)
      if (s.over) return 'over';
      if (s.endAsk) { window.__sendIntent({ k: 'enddone' }); return 'end'; }
      if (!window.__mySide() || window.__busy() || window.__aiOwed()) return null;
      const u = window.__eligibleUnits()[0];
      if (!u || !window.__select(u) || !window.__pressAction('move')) return null;
      const spots = window.__moveSpots();
      if (!spots.length) { window.__sendIntent({ k: 'action', id: 'skip' }); return 'skip'; }
      const c = spots.reduce((a, q) => (Math.hypot(q.x - 24, q.y - 24) < Math.hypot(a.x - 24, a.y - 24) ? q : a));
      window.__sendIntent({ k: 'move', x: c.x, y: c.y });
      // the tap is over: if it is the other side's go now, its answer has not been given yet
      const theirs = window.PMC_STATE().activeSide !== side;
      return { owed: window.__aiOwed(), theirs };
    });
    if (r === 'over') break;
    if (r && typeof r === 'object') {
      acts++;
      if (r.theirs) {
        if (r.owed) owedAfter++;
        // ...and it comes on its own, without being asked
        const came = await p.waitForFunction(() => !window.__aiOwed(), null, { timeout: 10000 }).then(() => true, () => false);
        if (came) settled++;
      }
    }
    await p.waitForTimeout(60);
  }
  ok('the player moved, and the other side answered', acts >= 6 && settled >= 3, acts + ' moves, ' + settled + ' answered');
  ok('...each answer still to come when the tap was over', owedAfter === settled && owedAfter > 0, owedAfter + ' owed after the tap');

  console.log('\n  THE BATTLE KEPT');
  await p.waitForTimeout(500);
  const back = await p.evaluate(() => {
    const L = window.PMCNet.Local, idx = JSON.parse(localStorage.getItem('pmc-battles') || '[]');
    const book = idx.map(e => JSON.parse(localStorage.getItem('pmc-battle:' + e.id))).filter(Boolean).sort((a, b) => b.at - a.at)[0];
    if (!book) return null;
    const marks = book.intents.filter(x => x[1] && x[1].k === '*ai').length;
    const copy = (o) => JSON.parse(JSON.stringify(o));
    // (each played back on an engine of its own; a book that does not come out the same is dropped, so copies)
    const asKept = new L().resume(copy(book));
    const old = copy(book); old.aiMarks = false; old.intents = old.intents.filter(x => !(x[1] && x[1].k === '*ai'));
    old.id = 'old-' + old.id;
    const asOld = new L().resume(old);
    return { marks, asKept, asOld, aiMarks: !!book.aiMarks };
  });
  ok('the save marks where each answer came', back && back.aiMarks && back.marks >= 3, back && back.marks + ' marks');
  ok('...and plays back to the same place', back && back.asKept);
  ok('...as it does with the answers given at once, the old way', back && back.asOld);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
