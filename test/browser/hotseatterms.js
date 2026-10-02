/* On Our Terms… in a hotseat contract (the rules review at a119ac2, CMP-3): when
   both companies hold it, each player says which way. Both the same way, the
   Battle Tier moves and Player 1 picks again; otherwise it stays. When only
   Player 2 holds it, their shift sends the screen back to Player 1. */
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
  const text = () => p.evaluate(() => document.getElementById('camp-body').innerText);
  const tier = () => p.evaluate(() => window.PMC_CAMPAIGN.contract().tier);
  const seat = () => p.evaluate(() => window.PMC_CAMPAIGN.contract().side === 'B' ? 'B' : 'A');

  // a fresh contract at Tier II that both could field at III; who holds the doctrine as given
  async function setup(holders) {
    await p.evaluate((holders) => {
      const C = window.PMCCamp;
      const camp = C.newCampaign({ mode: 'hotseat', nameA: 'Task Force Ironhold', nameB: 'The Red Dawn', factionA: 'pmc', factionB: 'rebel' });
      C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
      C.found(camp.companies.B, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
      holders.forEach(s => camp.companies[s].doctrines.push('S4'));
      window.PMC_CAMPAIGN.set(camp);
      window.PMC_NEWGAME = () => { };
    }, holders);
    await click('#camp-body [data-go="contract"]');
    await p.evaluate(() => {
      const k = window.PMC_CAMPAIGN.contract(), C = window.PMCCamp, camp = window.PMC_CAMPAIGN.get();
      k.side = 'A'; delete k.first; k.picks = [];
      k.standard = false; k.tier = 2; k.tierRoll.cap = 3; k.terms = {};
      k.levels = C.levelsFor(camp.companies.A, camp.companies.B, 2); k.pl = k.levels[0] || 1;
    });
    await click('#camp-body [data-go="contract"]');   // re-render (a no-op click on the open contract)
    await p.evaluate(() => window.PMC_CAMPAIGN.set(window.PMC_CAMPAIGN.get()));
  }
  // hand over as Player 1's start button does (dossier-contract.js) — the forces these
  // companies were founded with cannot fill Tier II, and what they field is not the point
  async function handOver() {
    await p.evaluate(() => {
      const k = window.PMC_CAMPAIGN.contract();
      k.first = { picks: k.picks, tactic: k.tactic || null, drugs: k.drugs || [] };
      k.picks = []; k.side = 'B'; k.tactic = null;
      window.PMC_CAMPAIGN.set(window.PMC_CAMPAIGN.get());
    });
    await p.waitForTimeout(200);
  }

  for (const [a, bv, want, name] of [[1, 1, 3, 'both up: up'], [-1, -1, 1, 'both down: down'], [1, -1, 2, 'up and down: it stays'], [0, 1, 2, 'Player 1 keeps, Player 2 up: it stays']]) {
    console.log('\nBoth hold it — ' + name);
    await setup(['A', 'B']);
    check('Player 1 is offered the choice, with Keep', /On Our Terms/.test(await text()) && await p.evaluate(() => !!document.querySelector('#camp-body [data-tier="0"]')));
    await click('#camp-body [data-tier="' + a + '"]');
    check('...Player 1\'s choice alone moves nothing', await tier() === 2);
    await handOver();
    check('Player 2 is offered it too', await seat() === 'B' && /On Our Terms/.test(await text()));
    await click('#camp-body [data-tier="' + bv + '"]');
    check('...the Tier ends at ' + want, await tier() === want, 'Tier ' + await tier());
    if (want !== 2) {
      check('...and Player 1 picks again for it', await seat() === 'A' && /agreed/.test(await text()));
      check('...with no second go at the terms', !/On Our Terms…\s*(Both|lets)/.test(await text()));
    } else {
      check('...Player 2 stays and is told why', await seat() === 'B' && /stays at II/.test(await text()));
      check('...with no second go', await p.evaluate(() => !document.querySelector('#camp-body [data-tier]')));
    }
  }

  console.log('\nOnly Player 2 holds it');
  await setup(['B']);
  check('Player 1 is not offered it', await p.evaluate(() => !document.querySelector('#camp-body [data-tier]')));
  await handOver();
  check('Player 2 is', await p.evaluate(() => !!document.querySelector('#camp-body [data-tier="1"]')));
  await click('#camp-body [data-tier="1"]');
  check('...and the Tier moves up', await tier() === 3);
  check('...sending Player 1 back to pick again', await seat() === 'A' && /used On Our Terms/.test(await text()));

  console.log('\nOnly Player 1 holds it');
  await setup(['A']);
  await click('#camp-body [data-tier="-1"]');
  check('Player 1\'s shift moves it at once', await tier() === 1);
  await handOver();
  check('...and Player 2 is not offered it', await seat() === 'B' && await p.evaluate(() => !document.querySelector('#camp-body [data-tier]')));

  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
