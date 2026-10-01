/* Turn 1's entry, watched: in an AI-against-AI game of a scenario where both
   companies come on in turn 1, every unit starts off the table and appears
   only when its walk-on is drawn. The engine has them all down at once; the
   table must not show them until their arrival plays. */
const { chromium } = require('playwright');
const { page: PAGE } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const br = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const p = await br.newPage({ viewport: { width: 1340, height: 900 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + PAGE); await p.waitForTimeout(600);

  console.log('\n  an AI-against-AI meeting engagement');
  await p.evaluate(() => window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'demo', aiSides: ['A', 'B'], planet: 'sparse', scenario: 'meeting',
    nameA: 'A', nameB: 'B', armyA: window.PMC.rollArmy(3, 1), armyB: window.PMC.rollArmy(3, 1) }));
  // the first look, as soon as the battle's first batch is in
  await p.waitForFunction(() => window.PMC_STATE() && window.PMC_STATE().phase === 'battle' && window.__showQueue() > 0, null, { timeout: 20000 }).catch(() => {});
  const first = await p.evaluate(() => {
    const s = window.PMC_STATE(), on = s.units.filter((u) => u.alive && u.x >= 0 && !u.aboard);
    return { on: on.length, waiting: on.filter((u) => window.__arrivalQueued(u.id)).length };
  });
  ok('the engine has the companies down at once', first.on > 6, first.on + ' on the table');
  ok('...but the table leaves off every unit whose walk-on is still to play', first.waiting >= first.on - 2,
    first.waiting + ' of ' + first.on + ' waiting');
  // then they come on, one by one, as their arrivals are drawn
  await p.waitForFunction(() => {
    const s = window.PMC_STATE();
    return s.units.every((u) => !(u.alive && u.x >= 0 && !u.aboard) || !window.__arrivalQueued(u.id));
  }, null, { timeout: 90000 }).catch(() => {});
  const later = await p.evaluate(() => window.PMC_STATE().units.filter((u) => u.alive && u.x >= 0 && !u.aboard && window.__arrivalQueued(u.id)).length);
  ok('...and each one appears as its arrival plays', later === 0, later + ' still waiting');

  console.log('\n  page errors: ' + (errs.join(' | ') || 'none'));
  if (errs.length) fail++;
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
