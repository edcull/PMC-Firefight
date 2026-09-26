/* A battle in this browser outlives a refresh. A skirmish against the AI is
   played a few activations in, the page is reloaded, and the menu offers it
   back — the same table, units where they were, and it plays on. Then a
   campaign's battle: reloaded mid-fight, the Campaign card goes back to it
   rather than to the hub. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
async function drain(p) {
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(150);
  }
}
// the table as the rules see it
const table = (p) => p.evaluate(() => {
  const s = window.PMC_STATE();
  return s ? JSON.stringify({ phase: s.phase, turn: s.turn, active: s.activeSide,
    units: s.units.map(u => [u.id, Math.round(u.x * 100), Math.round(u.y * 100), u.models, u.alive, u.sp || 0]) }) : null;
});
async function play(p, n) {
  for (let k = 0, acts = 0; k < 400 && acts < n; k++) {
    await drain(p);
    const did = await p.evaluate(() => {
      if (!window.__mySide() || window.__busy()) return false;
      const u = window.__eligibleUnits()[0];
      return !!(u && window.__select(u) && window.__pressAction('regroup'));
    });
    if (did) acts++;
    await p.waitForTimeout(60);
  }
  // let the AI answer and the table settle
  for (let k = 0; k < 100; k++) {
    await drain(p);
    if (await p.evaluate(() => !!window.__mySide() && !window.__busy())) break;
    await p.waitForTimeout(80);
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + path.join(ROOT, 'index.html');
  await p.goto(url);
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  await p.waitForTimeout(500);

  console.log('\n  A skirmish, refreshed');
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(800);
  await play(p, 3);
  const before = await table(p);
  const logBefore = await p.evaluate(() => document.querySelectorAll('#log > *').length);
  await p.reload();
  await p.waitForTimeout(900);
  const menu = await p.evaluate(() => ({ open: !document.getElementById('menu').hidden,
    resume: !document.getElementById('btn-resume').hidden, sub: document.getElementById('menu-resume-sub').textContent }));
  ok('the menu offers the battle back', menu.open && menu.resume, JSON.stringify(menu));
  const after = await table(p);
  ok('...the same table, every unit where it was', !!before && before === after,
    before === after ? '' : (before || '').slice(0, 200) + ' ≠ ' + (after || '').slice(0, 200));
  const logAfter = await p.evaluate(() => document.querySelectorAll('#log > *').length);
  ok('...with the log written up to where it was', logAfter > 0, logBefore + ' → ' + logAfter);
  await p.click('#btn-resume');
  await p.waitForTimeout(400);
  ok('Resume shows the table', await p.evaluate(() => document.getElementById('menu').hidden && document.body.getAttribute('data-battle') === 'ai'));
  await play(p, 2);
  const logLater = await p.evaluate(() => document.querySelectorAll('#log > *').length);
  ok('...and it plays on', logLater > logAfter, logAfter + ' → ' + logLater);

  console.log('\n  Thrown away');
  await p.evaluate(() => window.PMCMenu.open());
  await p.click('#btn-discard'); await p.click('#btn-discard');
  await p.reload();
  await p.waitForTimeout(700);
  ok('a discarded battle is not offered after a refresh', await p.evaluate(() =>
    document.getElementById('btn-resume').hidden && !window.PMC_BATTLE_LIVE()));

  console.log('\n  A campaign battle, refreshed');
  // a company founded through the interface, as campflow does it, and a contract taken
  const click = async (sel) => { const hit = await p.evaluate((s) => { const b = document.querySelector(s); if (!b || b.disabled) return false; b.click(); return true; }, sel); await p.waitForTimeout(220); return hit; };
  const clickText = async (re) => { const hit = await p.evaluate((src) => { const rx = new RegExp(src);
    const b = [...document.querySelectorAll('#camp-body button')].find(x => rx.test(x.textContent) && !x.disabled);
    if (!b) return false; b.click(); return true; }, re); await p.waitForTimeout(220); return hit; };
  await click('#btn-campaign');
  await clickText('Raise the force');
  await p.evaluate(() => { document.getElementById('found-name').value = 'Refresh Company'; });
  for (const k of ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng']) await click(`#camp-body button[data-add="${k}"]`);
  await click('#camp-body button[data-doc="S2"]');
  await clickText('Sign the charter');
  ok('a company is founded', await p.evaluate(() => !!(window.PMC_CAMPAIGN.get() && window.PMC_CAMPAIGN.get().companies.A)));
  await clickText('^Contract$');
  await p.evaluate(() => { const t = document.querySelector('#camp-body [data-take-offer]'); if (t) t.click(); });
  await p.waitForTimeout(250);
  await clickText('Fill the list for me');
  await p.evaluate(() => window.__forceScenario('meeting'));
  await p.waitForTimeout(150);
  await clickText('Take the field');
  await p.waitForTimeout(1200);
  ok('...and its battle begun', await p.evaluate(() => !!window.PMC_STATE() && !!window.PMC_STATE().cfg.campaign && !!window.PMC_CAMPAIGN.get().pending));
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await drain(p);
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(800);
  await play(p, 2);
  const campBefore = await table(p);
  await p.reload();
  await p.waitForTimeout(1200);
  await click('#btn-campaign');
  await p.waitForTimeout(400);
  const back = await p.evaluate(() => ({ menu: !document.getElementById('menu').hidden, camp: !document.getElementById('camp').hidden,
    live: window.PMC_BATTLE_LIVE(), campaign: !!(window.PMC_STATE() && window.PMC_STATE().cfg.campaign),
    pending: !!(window.PMC_CAMPAIGN.get() && window.PMC_CAMPAIGN.get().pending) }));
  ok('after a refresh, Campaign goes back to the battle', !back.menu && !back.camp && back.live && back.campaign, JSON.stringify(back));
  ok('...the same battle', campBefore === await table(p));
  ok('...and the campaign is still waiting on its result', back.pending);

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
