/* A battle in this browser outlives a refresh. A skirmish against the AI is
   played a few activations in, the page is reloaded, and the menu offers it
   back — the same table, units where they were, and it plays on. A second
   begun beside it leaves it kept: both in the Continue list, either picked up.
   Then a campaign's battle: reloaded mid-fight, the campaign goes back to it
   rather than to the hub, and a skirmish begun meanwhile does not lose it. */
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
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
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
  const menu = await p.evaluate(() => { window.PMCMenu.show('continue'); const r = document.querySelector('#cont-list [data-cont^="b:"]');
    return { open: !document.getElementById('menu').hidden, live: !!window.PMC_BATTLE_LIVE(), resume: !!r, sub: r ? r.textContent : '' }; });
  ok('a refresh opens on the main menu, not the battle; Continue offers it back', menu.open && !menu.live && menu.resume, JSON.stringify(menu));
  await p.click('#cont-list [data-cont^="b:"]');
  await p.waitForTimeout(600);
  const after = await table(p);
  ok('...the same table, every unit where it was', !!before && before === after,
    before === after ? '' : (before || '').slice(0, 200) + ' ≠ ' + (after || '').slice(0, 200));
  const logAfter = await p.evaluate(() => document.querySelectorAll('#log > *').length);
  ok('...with the log written up to where it was', logAfter > 0, logBefore + ' → ' + logAfter);
  ok('picking it shows the table', await p.evaluate(() => document.getElementById('menu').hidden && document.body.getAttribute('data-battle') === 'ai'));
  await play(p, 2);
  const logLater = await p.evaluate(() => document.querySelectorAll('#log > *').length);
  ok('...and it plays on', logLater > logAfter, logAfter + ' → ' + logLater);

  console.log('\n  A second skirmish while this one is on');
  const tFirst = await table(p);
  const firstId = await p.evaluate(() => window.PMC_BATTLE_ID());
  const f1 = await p.evaluate(() => { window.PMCMenu.open(); document.querySelector('[data-skirmish="ai"]').click();
    const n = document.getElementById('menu-note');
    return { menu: !document.getElementById('menu').hidden, setup: !document.getElementById('setup').hidden, note: n.hidden ? '' : n.textContent }; });
  ok('a new skirmish goes straight to its muster sheet: nothing to be lost', !f1.menu && f1.setup && !f1.note, JSON.stringify(f1));
  await p.evaluate(() => { document.getElementById('setup').hidden = true; });
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'arctic', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  await drain(p);
  const two = await p.evaluate(() => window.PMCNet.savedBattles().map((x) => x.id));
  ok('...and once it is begun, both are kept', two.length === 2 && two.indexOf(firstId) >= 0, two.join());
  await p.evaluate(() => { window.PMCMenu.open(); document.getElementById('btn-continue').click(); });
  await p.waitForTimeout(200);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#cont-list [data-cont]')].map((x) => x.getAttribute('data-cont') + ' ' + x.textContent));
  ok('Continue lists the two, the one on the table first', rows.length === 2 && rows[0].indexOf('live') === 0 && /On the table now/.test(rows[0]) && rows[1].indexOf('b:' + firstId) === 0, JSON.stringify(rows));
  await p.evaluate((id) => document.querySelector('#cont-list [data-cont="b:' + id + '"]').click(), firstId);
  await p.waitForTimeout(900);
  ok('picking the first goes back to it, every unit where it was', (await table(p)) === tFirst && await p.evaluate(() => document.getElementById('menu').hidden));
  // the second, put away from the list (asked twice)
  const secondId = two.find((x) => x !== firstId);
  await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
  await p.evaluate((id) => document.querySelector('#cont-list [data-contdel="b:' + id + '"]').click(), secondId);
  const asked = await p.evaluate((id) => document.querySelector('#cont-list [data-contdel="b:' + id + '"]').textContent, secondId);
  await p.evaluate((id) => document.querySelector('#cont-list [data-contdel="b:' + id + '"]').click(), secondId);
  ok('one put away from the list is asked first, then gone', asked === 'Delete?' && await p.evaluate(() => window.PMCNet.savedBattles().length === 1), asked);
  await p.evaluate(() => window.PMCMenu.show('main'));

  console.log('\n  Thrown away');
  await p.evaluate(() => window.PMCMenu.open());
  await p.evaluate(() => window.PMCMenu.show('continue'));
  await p.click('#cont-list [data-contdel="live"]'); await p.click('#cont-list [data-contdel="live"]');
  await p.reload();
  await p.waitForTimeout(700);
  ok('a discarded battle is not offered after a refresh', await p.evaluate(() =>
    document.getElementById('btn-continue').hidden && !window.PMC_BATTLE_LIVE()));

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
  await p.evaluate(() => document.querySelector('#camp-body [data-rivcontract]').click()); await p.waitForTimeout(200);   // a contract is made from the other forces
  await p.evaluate(() => { const t = document.querySelector('#camp-body [data-take-offer]'); if (t) t.click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());
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
  await p.evaluate(() => window.PMC_CAMPAIGN.enter()); await p.waitForTimeout(300);
  await p.waitForTimeout(400);
  const back = await p.evaluate(() => ({ menu: !document.getElementById('menu').hidden, camp: !document.getElementById('camp').hidden,
    live: window.PMC_BATTLE_LIVE(), campaign: !!(window.PMC_STATE() && window.PMC_STATE().cfg.campaign),
    pending: !!(window.PMC_CAMPAIGN.get() && window.PMC_CAMPAIGN.get().pending) }));
  ok('after a refresh, Campaign goes back to the battle', !back.menu && !back.camp && back.live && back.campaign, JSON.stringify(back));
  ok('...the same battle', campBefore === await table(p));
  ok('...and the campaign is still waiting on its result', back.pending);
  const camp2 = await p.evaluate(() => { window.PMCMenu.open(); document.querySelector('[data-skirmish="ai"]').click();
    return { setup: !document.getElementById('setup').hidden, kept: window.PMCNet.savedBattles().some((x) => x.campaign && x.campLid === window.PMC_CAMPAIGN.lid()) }; });
  ok('a new skirmish can be begun: the campaign\'s battle is kept for it', camp2.setup && camp2.kept, JSON.stringify(camp2));
  await p.evaluate(() => { document.getElementById('setup').hidden = true; });
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'arctic', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  await drain(p);
  await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
  const crow = await p.evaluate(() => { const r = document.querySelector('#cont-list [data-cont^="c:"]'); return r ? r.textContent : ''; });
  ok('the campaign is in the Continue list, its battle under way', /Refresh Company/.test(crow) && /a battle under way/.test(crow), crow);
  await p.evaluate(() => document.querySelector('#cont-list [data-cont^="c:"]').click());
  await p.waitForTimeout(1200);
  ok('...and picking it goes back to its battle, as it was', (await p.evaluate(() => !!window.PMC_STATE().cfg.campaign && window.PMC_BATTLE_LIVE())) && (await table(p)) === campBefore);

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
