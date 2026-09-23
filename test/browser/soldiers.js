/* A unit's soldiers on the campaign dossier: every card opens to show its
   men by rank and name, each can be renamed in the page, and the name is
   still there after a reload. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

async function click(p, sel) {
  const hit = await p.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b || b.disabled) return false;
    b.click(); return true;
  }, sel);
  await p.waitForTimeout(220);
  return hit;
}
async function clickText(p, re) {
  const hit = await p.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll('#camp-body button')].find(x => rx.test(x.textContent) && !x.disabled);
    if (!b) return false;
    b.click(); return true;
  }, re);
  await p.waitForTimeout(220);
  return hit;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  let nativeDialogs = 0;
  p.on('dialog', async d => { nativeDialogs++; await d.dismiss(); });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.removeItem('pmc-campaign'); } catch (e) { } });

  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }

  console.log('\nFounding a company');
  await click(p, '#btn-campaign');
  await clickText(p, 'Raise the force');
  await p.evaluate(() => { document.getElementById('found-name').value = 'Task Force Ironhold'; });
  for (const k of ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng']) {
    await click(p, `#camp-body button[data-add="${k}"]`);
  }
  await click(p, '#camp-body button[data-doc="S2"]');
  check('the charter can be signed', await clickText(p, 'Sign the charter'));

  console.log('\nThe soldiers');
  await clickText(p, 'The dossier');
  await p.waitForTimeout(250);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#camp-body button[data-men]')].map(b => b.textContent));
  check('every crewed unit offers its soldiers or crew', cards.length >= 9, cards.join(' | '));
  const rid = await p.evaluate(() => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.key === 'recruits');
    return e.rid;
  });
  check('...a squad lists its soldiers', cards.some(c => /Soldiers \(8\)/.test(c)));
  check('...a vehicle its crew', cards.some(c => /Crew \(1\)/.test(c)));
  check('...and nothing is shown until asked', await p.evaluate(() => !document.querySelector('#camp-body .dmen')));

  await click(p, `#camp-body button[data-men="${rid}"]`);
  const listed = await p.evaluate((rid) => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.rid === rid);
    const rows = [...document.querySelectorAll('#camp-body .dmen li')].map(li => li.innerText.replace(/\s+/g, ' '));
    return { rows, men: e.men };
  }, rid);
  check('the list opens with every soldier by rank and name',
    listed.rows.length === 8 && listed.rows.every((r, i) => r.indexOf(listed.men[i].rank) === 0 && r.indexOf(listed.men[i].name) > 0),
    listed.rows[0]);
  await p.locator('#camp-body .dcard:has(.dmen)').screenshot({ path: path.join(SHOTS, 'camp-soldiers.png') });

  await click(p, `#camp-body button[data-rsoldier="${rid}"][data-i="1"]`);
  check('Renaming a soldier asks in the page', await p.evaluate(() => !!document.getElementById('ask-input')));
  await p.evaluate(() => { document.getElementById('ask-input').value = 'Jan "Tank" Novak'; });
  await p.evaluate(() => document.querySelector('[data-ask="ok"]').click());
  await p.waitForTimeout(350);
  check('...the new name is on the dossier and on the screen', await p.evaluate((rid) => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.rid === rid);
    const list = document.querySelector('#camp-body .dmen');
    return e.men[1].name === 'Jan "Tank" Novak' && !!list && /Jan "Tank" Novak/.test(list.innerText);
  }, rid));
  await click(p, `#camp-body button[data-men="${rid}"]`);
  check('...and the list closes again', await p.evaluate(() => !document.querySelector('#camp-body .dmen')));

  console.log('\nThe memorial');
  await clickText(p, '^Memorial$');
  check('an empty memorial says so', /No one has been lost yet/.test(await p.evaluate(() => document.getElementById('camp-body').innerText)));
  await p.evaluate(() => {
    const co = window.PMC_CAMPAIGN.get().companies.A;
    co.lostModels = 3;
    co.memorial = [
      { name: 'Rhys Walsh', rank: 'Sergeant', type: 'Rookie rifle team', unit: 'Second Section', turn: 3, battle: 1, against: 'Red Dawn', scenario: 'meeting' },
      { name: 'Ana Silva', rank: 'Private', type: 'Recruits', unit: 'Recruits', turn: 2, battle: 2, against: 'Salvage Rights', scenario: 'secure' },
      { name: 'Kofi Park', rank: 'Commander', type: 'Light patrol vehicle', unit: 'Light patrol vehicle', turn: 5, battle: 2, against: 'Salvage Rights', scenario: 'secure' }
    ];
  });
  await clickText(p, '^Units$');
  await clickText(p, '^Memorial$');
  const mem = await p.evaluate(() => ({
    text: document.getElementById('camp-body').innerText,
    heads: [...document.querySelectorAll('#camp-body .dmem-head')].map(h => h.innerText.replace(/\s+/g, ' '))
  }));
  check('the memorial counts every casualty', /3 casualties in 2 battles/.test(mem.text));
  const lossText = await p.evaluate(() => { const d = document.querySelector('#camp-body .dloss'); return d ? d.textContent : ''; });
  check('...and shows the loss rate against everyone who has served', /^[\d.]+% lost 3 of the \d+ soldiers who have served/.test(lossText), lossText);
  check('...most recent battle first, with the enemy and the scenario',
    mem.heads.length === 2 && /Campaign turn 2 · against Salvage Rights · Secure and control/.test(mem.heads[0]), mem.heads[0]);
  check('...each by rank, name and unit', /Sergeant\s+Rhys Walsh/.test(mem.text) && /Rookie rifle team · Second Section · turn 3 of the battle/.test(mem.text));
  await p.locator('#camp-body').screenshot({ path: path.join(SHOTS, 'camp-memorial.png') });

  // the swarm's memorial is biomass by kind of bug, not names
  await p.evaluate(() => {
    const co = window.PMC_CAMPAIGN.get().companies.A;
    co._was = { faction: co.faction, memorial: co.memorial };
    co.faction = 'bugs'; co.memorial = []; co.biomass = { 'Small bugs': { models: 14, mass: 28 }, 'Attack forms': { models: 9, mass: 27 }, 'Queen': { models: 1, mass: 25 } };
  });
  await clickText(p, '^Units$');
  await clickText(p, '^Memorial$');
  const bio = await p.evaluate(() => ({
    text: document.getElementById('camp-body').innerText,
    rows: [...document.querySelectorAll('#camp-body .dmem-list li')].map(li => li.innerText.replace(/\s+/g, ' '))
  }));
  check('a swarm\'s memorial totals its biomass', /80 biomass lost/.test(bio.text));
  check('...by kind of bug, most biomass first', bio.rows.length === 3 && /Small bugs × 14 · 28 biomass/.test(bio.rows[0]) &&
    /Queen × 1 · 25 biomass/.test(bio.rows[2]), bio.rows.join(' | '));
  await p.locator('#camp-body').screenshot({ path: path.join(SHOTS, 'camp-biomass.png') });
  await p.evaluate(() => {
    const co = window.PMC_CAMPAIGN.get().companies.A;
    co.faction = co._was.faction; co.memorial = co._was.memorial; delete co.biomass; delete co._was;
  });
  await clickText(p, '^Units$');

  console.log('\nReloading the page');
  await p.reload();
  await p.waitForTimeout(900);
  check('the renamed soldier is still on the books', await p.evaluate((rid) => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.rid === rid);
    return e.men[1].name === 'Jan "Tank" Novak';
  }, rid));
  check('no native dialog was raised', nativeDialogs === 0);
  check('no page errors', errs.length === 0, errs.join('; '));

  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
