/* A question asked from the side column is in front of the board. The
   deployment card's Empty transports question (and the other modals the
   columns open) used to be painted under the board — the column and the
   pinned Begin bar are each their own stacking layer — so only its backdrop
   showed, over the left column, and the game looked stuck. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  console.log('\n  Empty transports, asked from the deployment card');
  /* A Hostile takeover defended, as it was found: the defender sets its force
     down on the table, a transport craft among it, so Begin asks about the
     craft going in empty. (Whoever attacks is rolled: until it is the AI.) */
  for (let t = 0; t < 12; t++) {
    await p.evaluate(() => window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'ai', scenario: 'takeover', planet: 'desert', terrainSetup: 'auto',
      nameA: 'Us', nameB: 'Them', armyA: ['cmd2', 'regular', 'adaptedcraft'], armyB: ['cmd2', 'regular', 'veterans'] }));
    await p.waitForTimeout(900);
    if (await p.evaluate(() => window.PMC_STATE().sc.attacker === 'B')) break;
  }
  // through the deployment as a player goes: the briefing put away, the list kept, Auto-deploy pressed
  for (let i = 0; i < 30; i++) {
    const done = await p.evaluate(() => {
      if (document.querySelector('button[data-act="startask"]')) return true;
      if (document.getElementById('obj-modal')) document.getElementById('obj-modal').hidden = true;
      const c = document.getElementById('res-continue'); if (c && !document.getElementById('resolution').hidden) c.click();
      const go = [...document.querySelectorAll('button')].find(x => x.offsetParent && !x.disabled &&
        /continue to deployment|auto-deploy the rest/i.test(x.textContent));
      if (go) go.click();
      return false;
    });
    if (done) break;
    await p.waitForTimeout(300);
  }
  await p.waitForSelector('button[data-act="startask"]', { timeout: 15000 });
  await p.click('button[data-act="startask"]');
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const box = [...document.querySelectorAll('.cmodal-box')].find(x => /Empty transports/.test(x.textContent) && x.offsetParent);
    if (!box) return { open: false };
    const q = box.getBoundingClientRect();
    const top = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
    const go = box.querySelector('button[data-act="start"]'), g = go.getBoundingClientRect();
    const onGo = document.elementFromPoint(g.x + g.width / 2, g.y + g.height / 2);
    return { open: true, inBox: box.contains(top), what: top && (top.tagName + '#' + top.id), goTop: go.contains(onGo) };
  });
  ok('Begin the battle with an empty transport asks about it', r.open);
  ok('...and the question is in front of the board, not under it', r.inBox, r.what);
  ok('...with its Begin the battle button there to be pressed', r.goTop);
  if (r.goTop) {
    await p.click('.cmodal-box button[data-act="start"]');
    await p.waitForTimeout(800);
  }
  ok('...which begins the battle', await p.evaluate(() => window.PMC_STATE().phase === 'battle'));

  await b.close();
  ok('no page errors', !errs.length, errs.join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
