/* A hotseat campaign's contract (the rules review at 7dd7306, M-7): each player
   picks their own force (pp. 84-85). Player 1 picks and hands over; Player 2
   picks theirs from their own dossier, with their own tactic, on the terms
   Player 1 settled; and the battle starts with the two lists as picked. */
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
    return hit;
  }
  // the contract asks for the device to be passed each time it changes hands: whose card is up, then tap it
  async function pass() {
    const who = await p.evaluate(() => { const x = document.querySelector('#camp-body [data-go="passok"]'); return x ? x.getAttribute('data-seat') : null; });
    if (who) await click('#camp-body [data-go="passok"]');
    return who;
  }
  const text = () => p.evaluate(() => document.getElementById('camp-body').innerText);

  console.log('\nEach player picks their own force');
  await click('#btn-campaign');
  await p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat', nameA: 'Task Force Ironhold', nameB: 'The Red Dawn', factionA: 'pmc', factionB: 'rebel' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    C.found(camp.companies.B, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
    // two the contract will not take at Tier I or II: they stay home, on the bench
    camp.companies.B.roster.push(C.newEntry('rhardened'), C.newEntry('rguard'));
    window.PMC_CAMPAIGN.set(camp);
    window.__cfg = null;
    window.PMC_NEWGAME = (cfg) => { window.__cfg = cfg; };
  });
  const rosterB = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.B.roster.map(e => e.rid));
  check('Player 2 has founded a force', rosterB.length > 3, rosterB.length + ' units');
  check('the contract opens', await click('#camp-body [data-go="contract"]'));
  check('...asking for the device to be passed to Player 1', await pass() === 'A');
  let t = await text();
  check('...on Player 1\'s list', /Player 1/.test(t) && /Task Force Ironhold/.test(t));
  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());
  await p.waitForTimeout(200);
  const startA = await p.evaluate(() => { const s = document.querySelector('#camp-body button.start[data-go="fight"]'); return s && { live: s.getAttribute('aria-disabled') !== 'true', txt: s.textContent }; });
  check('Player 1\'s button hands over, not starts the battle', !!startA && startA.live && /Player 2/.test(startA.txt), startA && startA.txt);
  const picksA = await p.evaluate(() => window.PMC_CAMPAIGN.get() && [...document.querySelectorAll('#camp-body [data-unpick]')].length);
  await click('#camp-body button.start[data-go="fight"]');
  check('handing over asks for the device to be passed to Player 2', await pass() === 'B');
  t = await text();
  check('no battle has started yet', await p.evaluate(() => window.__cfg === null));
  check('Player 2 picks next, from The Red Dawn', /Player 2/.test(t) && /The Red Dawn/.test(t));
  const offered = await p.evaluate(() => [...document.querySelectorAll('#camp-body [data-pick]')].map(x => x.getAttribute('data-pick')));
  check('...offered their own units and none of Player 1\'s', offered.length > 0 && offered.every(r => rosterB.indexOf(r) >= 0), offered.length + ' offered');
  check('...with the terms settled: no Priority Level to change', await p.evaluate(() => document.getElementById('camp-pl').disabled));
  check('...and a rebel tactic of their own to choose', await click('#camp-body [data-tactic="wave"]'));
  // back to Player 1's list keeps it, and handing over again starts Player 2 afresh
  check('Player 2 can go back to Player 1\'s list', await click('#camp-body [data-go="seatback"]'));
  await pass();
  check('...which is still picked', await p.evaluate((n) => document.querySelectorAll('#camp-body [data-unpick]').length === n, picksA));
  await click('#camp-body button.start[data-go="fight"]');
  await pass();
  await click('#camp-body [data-tactic="wave"]');
  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());
  await p.waitForTimeout(200);
  const chosen = await p.evaluate(() => window.PMC_CAMPAIGN.get() && [...document.querySelectorAll('#camp-body [data-unpick]')].length);
  check('Player 2\'s list fills', chosen > 0, chosen + ' units');
  await click('#camp-body button.start[data-go="fight"]');
  for (let i = 0; i < 20; i++) {
    if (await p.evaluate(() => !!window.__cfg)) break;
    await p.evaluate(() => { const n = document.querySelector('.note-ok, #note-ok, [data-go="noteok"]'); if (n) n.click(); });
    await p.waitForTimeout(150);
  }
  const cfg = await p.evaluate(() => {
    const c = window.__cfg; if (!c) return null;
    return { a: c.dossier.A.map(e => e.rid), b: c.dossier.B.map(e => e.rid), bench: c.bench.B.map(e => e.rid), tac: c.tactics.B,
      mode: c.mode, secret: !!c.secretSwaps, rosterB: window.PMC_CAMPAIGN.get().companies.B.roster.map(e => e.rid) };
  });
  check('the battle starts', !!cfg);
  if (cfg) {
    check('...with Player 2\'s own list', cfg.b.length === chosen && cfg.b.every(r => rosterB.indexOf(r) >= 0));
    check('...and Player 1\'s', cfg.a.length === picksA && cfg.a.every(r => rosterB.indexOf(r) < 0));
    check('...Player 2\'s tactic as chosen', cfg.tac === 'wave', cfg.tac);
    check('...the rest of Player 2\'s units on the bench to swap in', cfg.bench.length > 0 && cfg.bench.length === rosterB.length - cfg.b.length, cfg.bench.length + '');
    check('...nobody hired into Player 2\'s company behind their back', cfg.rosterB.length === rosterB.length);
    check('...a hotseat battle', cfg.mode === 'hotseat');
    check('...with the secret round of swaps from the benches (HC-8)', cfg.secret);
  }
  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
