/* Between battles in a hotseat campaign (the hotseat review, HC-1 to HC-3): each
   player runs their own force from the hub — Player 2 recruits from their own
   list into their own roster — and Player 2's company is never touched by the AI:
   no catch-up when a contract is drawn up, and no phantom AI force added on a
   reload. */
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
    const hit = await p.evaluate((s) => { const x = document.querySelector(s); if (!x || x.disabled) return false; x.click(); return true; }, sel);
    await p.waitForTimeout(220);
    // the contract changing hands asks for the device to be passed: tapped through here
    await p.evaluate(() => { const x = document.querySelector('#camp-body [data-go="passok"]'); if (x) x.click(); });
    await p.waitForTimeout(120);
    return hit;
  }

  await click('#btn-campaign');
  await p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat', nameA: 'Task Force Ironhold', nameB: 'The Red Dawn', factionA: 'pmc', factionB: 'rebel' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.B = C.newCompany('The Red Dawn', { faction: 'rebel' });
    C.found(camp.companies.B, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
    camp.companies.B.name = 'The Red Dawn'; camp.companies.B.colour = 'steel';
    camp.rivals = [camp.companies.B]; camp.facing = 0;     // as founding Player 2 leaves it
    camp.companies.A.kUC = 30; camp.companies.B.kUC = 30;
    window.PMC_CAMPAIGN.set(camp);
  });

  console.log('\nPlayer 2 runs their own force');
  check('the hub offers both players', await p.evaluate(() => document.querySelectorAll('#camp-body [data-go="hubside"]').length === 2));
  await click('#camp-body [data-go="hubside"][data-hs="B"]');
  const shown = await p.evaluate(() => document.getElementById('camp-body').innerText);
  check('...and turns to Player 2\'s force', /The Red Dawn/.test(shown.split('\n').slice(0, 6).join(' ')), shown.split('\n').slice(0, 4).join(' / '));
  await click('#camp-body [data-go="roster"]');
  await click('#camp-body [data-rtab="recruit"]');
  const offer = await p.evaluate(() => [...document.querySelectorAll('#camp-body [data-recruit]')].map(x => x.getAttribute('data-recruit')));
  check('the recruiting list is Player 2\'s own (insurgents)', offer.length > 0 && offer.some(k => /^r/.test(k)) && !offer.some(k => k === 'recruits'), offer.slice(0, 5).join(','));
  const before = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { a: c.companies.A.roster.length, b: c.companies.B.roster.length, bk: c.companies.B.kUC }; });
  const key = await p.evaluate((ks) => { const c = window.PMC_CAMPAIGN.get().companies.B; return ks.find(k => window.PMCCamp.recruitCost(c, k) > 0 && window.PMCCamp.canRecruit(c, k).ok); }, offer);
  await click('#camp-body [data-recruit="' + key + '"]:not([data-asriders])');
  await click('#camp-askbox [data-ask="ok"]');
  const after = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { a: c.companies.A.roster.length, b: c.companies.B.roster.length, bk: c.companies.B.kUC }; });
  check('...the unit joins Player 2\'s roster, paid from their purse', after.b === before.b + 1 && after.bk < before.bk, JSON.stringify(after));
  check('...and Player 1\'s is untouched', after.a === before.a);

  console.log('\nNo AI hand on Player 2');
  const tierB = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.B.tier);
  let caught = false;
  for (let i = 0; i < 20; i++) {
    await click('#camp-body [data-go="hub"]');
    await click('#camp-body [data-go="contract"]');
    const k = await p.evaluate(() => window.PMC_CAMPAIGN.contract());
    if (k && k.caught) caught = true;
    await click('#camp-body [data-go="hub"]');
  }
  const nowB = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get().companies.B; return { tier: c.tier, kUC: c.kUC, n: c.roster.length }; });
  check('drawing up contracts never brings Player 2 "up to strength"', !caught && nowB.tier === tierB && nowB.n === after.b && nowB.kUC === after.bk, JSON.stringify(nowB));
  await p.reload();
  await p.waitForTimeout(900);
  await p.evaluate(() => window.PMC_CAMPAIGN.enter()); await p.waitForTimeout(300);
  const world = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { rivals: (c.rivals || []).map(r => r.name), B: c.companies.B.name }; });
  check('a reload adds no phantom AI force', world.rivals.length === 1 && world.B === 'The Red Dawn', JSON.stringify(world));

  console.log('\nA force that can no longer fight ends the campaign');
  await p.evaluate(() => {
    const C = window.PMCCamp, real = C.cannotFight;
    window.__realCannot = real;
    C.cannotFight = (co) => co === window.PMC_CAMPAIGN.get().companies.B || real(co);
    window.PMC_CAMPAIGN.set(window.PMC_CAMPAIGN.get());
  });
  await click('#camp-body [data-go="hub"]');
  const warn = await p.evaluate(() => document.getElementById('camp-body').innerText);
  check('the hub says Player 2 can no longer field an army', /The Red Dawn can no longer field an army/.test(warn));
  await click('#camp-body [data-go="campend"]');
  const over = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { over: c.over, contract: !!document.querySelector('#camp-body .hubgo[disabled]') }; });
  check('...ends it, Player 1 the winner', !!over.over && over.over.winner === 'A' && over.over.loser === 'B', JSON.stringify(over.over));
  check('...and no contract can be drawn up', over.contract);
  await p.evaluate(() => { window.PMCCamp.cannotFight = window.__realCannot; });

  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
