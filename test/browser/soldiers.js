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
  await clickText(p, '^Dossier$');
  await p.waitForTimeout(250);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#camp-body button[data-men]')].map(b => b.textContent));
  check('every unit card opens to its details', cards.length === 9 && cards.every(c => /Details/.test(c)), cards.join(' | '));
  const rid = await p.evaluate(() => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.key === 'recruits');
    return e.rid;
  });
  check('...and nothing is shown until asked', await p.evaluate(() => !document.querySelector('#camp-body .ddet')));
  const lpv = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.key === 'lpv').rid);
  await click(p, `#camp-body button[data-men="${lpv}"]`);
  const hullDet = await p.evaluate(() => document.querySelector('#camp-body .ddet').innerText);
  check('a vehicle shows its Structure and its crew', /Str/.test(hullDet) && /Crew \(1\)/i.test(hullDet), hullDet.split('\n').slice(0, 3).join(' '));
  await click(p, `#camp-body button[data-men="${lpv}"]`);

  // an honour and a trauma, to see them spelled out and worked into the numbers
  await p.evaluate((rid) => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.rid === rid);
    e.honours = [4]; e.traumas = [5];
  }, rid);
  await click(p, `#camp-body button[data-men="${rid}"]`);
  const det = await p.evaluate((rid) => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.rid === rid), C = window.PMCCamp;
    const box = document.querySelector('#camp-body .ddet');
    return {
      text: box.innerText, heads: [...box.querySelectorAll('h5')].map(h => h.textContent),
      honour: C.honourTable(e.key)[3], trauma: C.traumaTable(e.key)[4],
      marked: [...box.querySelectorAll('.ddet-stats td.up, .ddet-stats td.down')].length,
      stats: [...box.querySelectorAll('.ddet-stats th')].map(t => t.textContent).join(' '),
      statRow: [...box.querySelectorAll('.ddet-stats th')].map((t, i) => t.textContent + ' ' + box.querySelectorAll('.ddet-stats td')[i].textContent).join(' ')
    };
  }, rid);
  check('the details show the full stat line', /Tier Men Move FP Range Def Asslt Mor/.test(det.stats), det.stats);
  check('...special rules, honours, traumas and soldiers', det.heads.join('|') === 'Special rules|Battle Honours|Battle Traumas|Soldiers (8)', det.heads.join(' | '));
  check('...each honour and trauma spelled out', det.text.indexOf(det.honour.name) >= 0 && det.text.indexOf(det.honour.text) >= 0 &&
    det.text.indexOf(det.trauma.name) >= 0, det.honour.name + ' / ' + det.trauma.name);
  check('...with what they changed marked on the stats', det.marked === 2 && /Move\s*5"\s*\+1/.test(det.statRow), det.statRow);
  await p.locator('#camp-body .dcard:has(.ddet)').screenshot({ path: path.join(SHOTS, 'camp-details.png') });
  await p.evaluate((rid) => {
    const e = window.PMC_CAMPAIGN.get().companies.A.roster.find(x => x.rid === rid);
    e.honours = []; e.traumas = [];
  }, rid);
  await clickText(p, '^Spend EXP$');
  await clickText(p, '^Units$');
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
  check('...and the details close again', await p.evaluate(() => !document.querySelector('#camp-body .ddet')));

  console.log('\nExperience');
  const expText = () => p.evaluate(() => { const d = document.querySelector('#camp-body .dexpr:not(.dtrau):not(.dwin)'); return d ? d.textContent : ''; });
  const winText = () => p.evaluate(() => { const d = document.querySelector('#camp-body .dwin'); return d ? d.textContent : ''; });
  check('no win rate before the first battle', (await winText()) === '');
  const trauText = () => p.evaluate(() => { const d = document.querySelector('#camp-body .dtrau'); return d ? d.textContent : ''; });
  check('the dossier shows veterancy', /^0% veterancy 0 Battle Honours across 9 units$/.test(await expText()), await expText());
  await p.evaluate(() => {
    const r = window.PMC_CAMPAIGN.get().companies.A.roster;
    r[1].honours = [2, 5]; r[2].honours = [4]; r[3].traumas = [1];
    window.PMC_CAMPAIGN.get().companies.A.record = { battles: 4, wins: 3, draws: 0, losses: 1 };
  });
  await clickText(p, '^Spend EXP$');
  await clickText(p, '^Units$');
  check('...as honours held over units on the books', /^33\.3% veterancy 3 Battle Honours across 9 units$/.test(await expText()), await expText());
  check('...with the win rate first', /^75% won 3 of 4 battles$/.test(await winText()), await winText());
  check('...and trauma beside it', /^11\.1% trauma 1 Battle Trauma across 9 units$/.test(await trauText()), await trauText());
  // the head of the dossier, down to its tabs
  const top = await p.evaluate(() => {
    const a = document.getElementById('camp-body').getBoundingClientRect(), t = document.querySelector('#camp-body .dtabs').getBoundingClientRect();
    return { x: a.x, y: a.y, width: a.width, height: t.bottom - a.y + 12 };
  });
  await p.screenshot({ path: path.join(SHOTS, 'camp-veterancy.png'), clip: top });
  await p.evaluate(() => { window.PMC_CAMPAIGN.get().companies.A.roster.forEach(e => { e.honours = []; e.traumas = []; });
    window.PMC_CAMPAIGN.get().companies.A.record = { battles: 0, wins: 0, draws: 0, losses: 0 }; });

  console.log('\nThe memorial');
  await clickText(p, '^Memorial$');
  check('an empty memorial says so', /No one has been lost yet/.test(await p.evaluate(() => document.getElementById('camp-body').innerText)));
  await p.evaluate(() => {
    const co = window.PMC_CAMPAIGN.get().companies.A;
    co.losses = { soldiers: { lost: 3, departed: 0 } };
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
  check('the memorial has no separate casualty count line', !/casualties in \d+ battle/.test(mem.text));
  const lossText = await p.evaluate(() => { const d = document.querySelector('#camp-body .dloss:not(.dexpr)'); return d ? d.textContent : ''; });
  check('...and shows the loss rate against everyone who has served', /^[\d.]+% lost 3 of \d+ soldiers$/.test(lossText), lossText);
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
  const bioLoss = await p.evaluate(() => document.querySelector('#camp-body .dloss:not(.dexpr)').textContent);
  check('a swarm\'s loss rate is in biomass', /^[\d.]+% lost 80 of \d+ biomass$/.test(bioLoss), bioLoss);
  check('...and the memorial totals it', /Biomass lost\s*80/.test(bio.text));
  check('...by kind of bug, most biomass first', bio.rows.length === 3 && /Small bugs × 14 · 28 biomass/.test(bio.rows[0]) &&
    /Queen × 1 · 25 biomass/.test(bio.rows[2]), bio.rows.join(' | '));
  await p.locator('#camp-body').screenshot({ path: path.join(SHOTS, 'camp-biomass.png') });
  await p.evaluate(() => {
    const co = window.PMC_CAMPAIGN.get().companies.A;
    co.faction = co._was.faction; co.memorial = co._was.memorial; delete co.biomass; delete co._was;
  });
  await clickText(p, '^Units$');

  // the tribe keeps two counts: its Crocks and its Esh-Aven
  await p.evaluate(() => {
    const co = window.PMC_CAMPAIGN.get().companies.A, C = window.PMCCamp;
    co._was = { faction: co.faction, roster: co.roster, losses: co.losses, memorial: co.memorial };
    co.faction = 'xeno'; co.memorial = [];
    co.roster = [C.newEntry('xalpha3'), C.newEntry('xeps3'), C.newEntry('xeps2')];
    co.losses = { crocks: { lost: 1, departed: 0 }, eshaven: { lost: 6, departed: 0 } };
  });
  await clickText(p, '^Memorial$');
  const tribe = await p.evaluate(() => [...document.querySelectorAll('#camp-body .dloss:not(.dexpr)')].map(d => d.textContent));
  check('the tribe shows a loss rate for its Crocks and one for its Esh-Aven',
    tribe.length === 2 && /lost 1 of 4 Crocks$/.test(tribe[0]) && /lost 6 of \d+ Esh-Aven$/.test(tribe[1]), tribe.join(' | '));
  await p.locator('#camp-body').screenshot({ path: path.join(SHOTS, 'camp-tribe.png') });
  await p.evaluate(() => {
    const co = window.PMC_CAMPAIGN.get().companies.A;
    Object.assign(co, co._was); delete co._was;
  });
  await clickText(p, '^Units$');

  console.log('\nOn the field');
  const icons = await p.evaluate(() => {
    const C = window.PMCCamp;
    const mk = (k, h, t) => { const e = C.newEntry(k); e.honours = h; e.traumas = t; return e; };
    const A = [mk('cmd2', [], []), mk('regular', [4], []), mk('veterans', [4, 8], [5]), mk('rookie', [], [5])];
    const B = [mk('cmd2', [], []), mk('regular', [], [])];
    document.getElementById('camp').hidden = true;
    window.PMC_NEWGAME({ tier: 4, pl: 1, mode: 'demo', planet: 'sparse', scenario: 'meeting', nameA: 'Ironhold', nameB: 'Orlov',
      armyA: A.map(e => e.key), armyB: B.map(e => e.key), dossier: { A, B } });
    return window.__labelIcons().filter(i => i.side === 'A').map(i => i.code + (i.star ? '*' : '') + (i.heart ? '+' : '')).join(' ');
  });
  check('a unit with an honour wears a star, with a trauma a heart', /RIF\*(\s|$)/.test(icons) && /VET\*\+/.test(icons) &&
    /RKI\+/.test(icons) && /CMD(\s|$)/.test(icons), icons);
  await p.reload();
  await p.waitForTimeout(900);

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
