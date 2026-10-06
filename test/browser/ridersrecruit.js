/* The Riders upgrade is "decided when that unit is recruited. The decision is
   final" (p. 97; the rules review at a119ac2, REB-4): the recruiting list offers a
   squad on foot or as Riders, and the roster shows the choice fixed, with nothing
   to change it by. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.removeItem('pmc-campaign'); } catch (e) { } });
  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }
  async function click(sel) {
    const hit = await p.evaluate((s) => { const x = document.querySelector(s); if (!x || x.disabled || x.getAttribute('aria-disabled') === 'true') return false; x.click(); return true; }, sel);
    await p.waitForTimeout(220);
    return hit;
  }

  console.log('\nRecruiting Riders');
  await click('#btn-campaign');
  await p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat', nameA: 'The Red Dawn', nameB: 'Task Force Ironhold', factionA: 'rebel', factionB: 'pmc' });
    C.found(camp.companies.A, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
    C.found(camp.companies.B, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.A.kUC = 50;
    window.PMC_CAMPAIGN.set(camp);
  });
  await click('#camp-body [data-go="roster"]');
  await click('#camp-body [data-rtab="recruit"]');
  const offer = await p.evaluate(() => [...document.querySelectorAll('#camp-body [data-asriders]')].map(x => x.getAttribute('data-recruit')));
  check('the recruiting list offers squads as Riders', offer.length > 0, offer.join(', '));
  const key = offer[0];
  const before = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length);
  await click('#camp-body [data-asriders][data-recruit="' + key + '"]');
  const asked = await p.evaluate(() => document.getElementById('camp-askbox').textContent);
  check('...asking first, naming the upgrade', /Riders/.test(asked), asked.slice(0, 80));
  await click('#camp-askbox [data-ask="ok"]');
  const got = await p.evaluate(() => { const r = window.PMC_CAMPAIGN.get().companies.A.roster; return { n: r.length, last: r[r.length - 1] }; });
  check('...and the squad joins mounted', got.n === before + 1 && got.last.key === key && got.last.riders === true);
  await click('#camp-body [data-rtab="units"]');
  await p.evaluate((rid) => { const c = [...document.querySelectorAll('#camp-body .dcard.dclick')].find(x => x.outerHTML.indexOf(rid) >= 0) || document.querySelector('#camp-body .dcard.dclick'); if (c) c.click(); }, got.last.rid);
  await p.waitForTimeout(300);
  const card = await p.evaluate(() => { const o = document.querySelector('#camp-body .dcard.open'); return o ? o.innerText : ''; });
  check('its card shows it mounted, and fixed', /Mounted \(Riders\) \u2014 fixed/.test(card), card.slice(0, 60));
  check('...with nothing to change the upgrade by', await p.evaluate(() => !document.querySelector('#camp-body [data-eriders]')));
  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
