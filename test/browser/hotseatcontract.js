/* A hotseat contract is kept while it is drawn up (the hotseat review, HC-6 and
   HC-7): going back to the hub and in again does not roll it afresh, a reload
   finds it as it was — terms, roles and both players' picks — and the attacker
   and defender are settled on the contract, before either player picks. */
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
    await p.evaluate(() => { const x = document.querySelector('#camp-body [data-go="passok"]'); if (x) x.click(); });
    await p.waitForTimeout(120);
    return hit;
  }
  const terms = () => p.evaluate(() => {
    const k = window.PMC_CAMPAIGN.contract();
    return k && { tier: k.tier, scen: k.scenario && k.scenario.id, side: k.side || 'A', picks: (k.picks || []).map(e => e.rid).join(','),
      first: k.first ? k.first.picks.map(e => e.rid).join(',') : null, roles: k.roles ? JSON.stringify(k.roles.attacker || null) : 'none' };
  });

  await click('#btn-campaign');
  await p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat', nameA: 'Task Force Ironhold', nameB: 'The Red Dawn', factionA: 'pmc', factionB: 'rebel' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.B = C.newCompany('The Red Dawn', { faction: 'rebel' });
    C.found(camp.companies.B, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
    camp.companies.B.name = 'The Red Dawn'; camp.companies.B.colour = 'steel';
    camp.rivals = [camp.companies.B]; camp.facing = 0;
    window.PMC_CAMPAIGN.set(camp);
  });

  console.log('\nThe contract is kept');
  await click('#camp-body [data-go="contract"]');
  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());
  await p.waitForTimeout(200);
  const t0 = await terms();
  check('a contract is drawn up and Player 1 picks', !!t0 && t0.picks.length > 0, JSON.stringify(t0));
  await click('#camp-body [data-go="hub"]');
  await click('#camp-body [data-go="contract"]');
  const t1 = await terms();
  check('back to the hub and in again: the same contract, the picks kept', JSON.stringify(t1) === JSON.stringify(t0), JSON.stringify(t1));
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => window.PMC_CAMPAIGN.enter()); await p.waitForTimeout(300);
  await click('#camp-body [data-go="contract"]');
  const t2 = await terms();
  check('after a reload, the same contract and Player 1\'s picks', !!t2 && t2.tier === t0.tier && t2.scen === t0.scen && t2.picks === t0.picks && t2.roles === t0.roles, JSON.stringify(t2));
  // handed over, then reloaded: Player 2's turn, with Player 1's list kept
  await click('#camp-body button.start[data-go="fight"]');
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => window.PMC_CAMPAIGN.enter()); await p.waitForTimeout(300);
  await click('#camp-body [data-go="contract"]');
  const t3 = await terms();
  check('handed over and reloaded: Player 2 picks, Player 1\'s list kept', !!t3 && t3.side === 'B' && t3.first === t0.picks, JSON.stringify(t3));

  console.log('\nWho attacks is settled on the contract (HC-7)');
  await p.evaluate(() => {
    window.PMC_CAMPAIGN.dropContract();
    window.PMC_CAMPAIGN.open('hub');
    window.__realForesight = window.PMCCamp.foresight;
    window.PMCCamp.foresight = () => ({ scenario: { id: 'invasion', name: 'Invasion', roll: 4 } });
  });
  await click('#camp-body [data-go="contract"]');
  const k4 = await p.evaluate(() => { const k = window.PMC_CAMPAIGN.contract(); return k && { roles: k.roles, picks: k.picks.length, text: document.getElementById('camp-body').innerText }; });
  check('an Invasion contract has its attacker and defender before anyone picks', !!k4 && !!k4.roles && k4.picks === 0 && /^[AB]$/.test(k4.roles.attacker), JSON.stringify(k4 && { r: k4.roles, p: k4.picks, t: k4.text.slice(0, 200) }));
  check('...and names both forces on the screen', !!k4 && /attacks;/.test(k4.text) && /defends/.test(k4.text));
  await click('#camp-body button.start[data-go="fight"]');
  const k5 = await p.evaluate(() => document.getElementById('camp-body').innerText);
  check('...the same for Player 2', /attacks;/.test(k5));
  await p.evaluate(() => { window.PMCCamp.foresight = window.__realForesight; });

  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
