/* Several campaigns at once in one browser, and the main menu's Continue list:
   each campaign begun from a Campaign card is a new one, the last kept; the list
   names every one; picking one opens it as it was; one put away goes; and a
   battle fought for a campaign that is not the one open (another opened while it
   was on) goes to its own campaign, not the one on screen. */
const { chromium } = require('playwright');
const { page } = require('../where.js');
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++; console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (note ? '  — ' + note : '')); };
(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + page);
  await p.waitForTimeout(500);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload(); await p.waitForTimeout(700);
  // a campaign, founded through the rules and handed to the dossier as one begun from a card
  const begin = (mode, name) => p.evaluate((o) => {
    window.PMC_CAMPAIGN.fresh(o.mode);
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: o.mode, nameA: o.name, factionA: 'pmc' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.A.name = o.name;
    camp.rivals = C.foundRivals(camp, 1) || camp.rivals;
    window.PMC_CAMPAIGN.set(camp);
    return window.PMC_CAMPAIGN.lid();
  }, { mode, name });

  console.log('\nTwo campaigns');
  ok('with nothing under way, there is no Continue card', await p.evaluate(() => { window.PMCMenu.open(); return document.getElementById('btn-continue').hidden; }));
  const one = await begin('solo', 'First Company');
  await p.waitForTimeout(200);
  const two = await begin('solo', 'Second Company');
  await p.waitForTimeout(200);
  ok('a Campaign card begins a new one; the last is kept beside it', one && two && one !== two &&
    await p.evaluate(() => window.PMC_CAMPAIGN.list().length === 2 && window.PMC_CAMPAIGN.get().companies.A.name === 'Second Company'));
  const fresh = await p.evaluate(() => { window.PMC_CAMPAIGN.fresh('solo'); return { none: !window.PMC_CAMPAIGN.get(), form: !!document.querySelector('#camp-body [data-go="newcamp"]') }; });
  ok('...the card opens on the new-campaign form', fresh.none && fresh.form, JSON.stringify(fresh));

  console.log('\nThe Continue list');
  await p.evaluate(() => { window.PMCMenu.open(); });
  const card = await p.evaluate(() => ({ shown: !document.getElementById('btn-continue').hidden, sub: document.getElementById('menu-continue-sub').textContent }));
  ok('the menu offers Continue, saying how many', card.shown && /2 games under way/.test(card.sub), JSON.stringify(card));
  await p.evaluate(() => document.getElementById('btn-continue').click());
  await p.waitForTimeout(200);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#cont-list [data-cont]')].map((x) => x.textContent));
  ok('...a list of both, the latest first', rows.length === 2 && /Second Company/.test(rows[0]) && /First Company/.test(rows[1]), JSON.stringify(rows));
  await p.evaluate((lid) => document.querySelector('#cont-list [data-cont="c:' + lid + '"]').click(), one);
  await p.waitForTimeout(700);
  ok('picking one opens it, on its hub', await p.evaluate(() => !document.getElementById('camp').hidden && window.PMC_CAMPAIGN.get().companies.A.name === 'First Company'));
  await p.reload(); await p.waitForTimeout(900);
  ok('after a reload, the one last opened is the one open', await p.evaluate(() => window.PMC_CAMPAIGN.get() && window.PMC_CAMPAIGN.get().companies.A.name === 'First Company'));

  console.log('\nA battle for the other one');
  // the first campaign's battle under way, and the second opened meanwhile
  await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); c.pending = { tier: 1, pl: 1, scenario: 'meeting' }; window.PMC_CAMPAIGN.set(c); });
  await p.evaluate((lid) => window.PMC_CAMPAIGN.resume(lid), two);
  await p.waitForTimeout(500);
  await p.evaluate((lid) => {
    window.PMC_AFTER_RESULT = (fn) => fn();
    window.PMC_ONFINISH({ winner: 'A', units: [] }, { campaign: true, campLid: lid });
  }, one);
  await p.waitForTimeout(400);
  const went = await p.evaluate(() => ({ lid: window.PMC_CAMPAIGN.lid(), name: window.PMC_CAMPAIGN.get().companies.A.name, post: !!(window.PMC_CAMPAIGN.get().post || window.PMC_CAMPAIGN.get().log.length) }));
  ok('its result goes to its own campaign, which is opened for it', went.lid === one && went.name === 'First Company' && went.post, JSON.stringify(went));
  const second = await p.evaluate((lid) => { return JSON.parse(localStorage.getItem('pmc-campaign:' + lid)).companies.A.name; }, two);
  ok('...and the other is left as it was', second === 'Second Company', second);

  console.log('\nPut away');
  await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
  await p.evaluate((lid) => document.querySelector('#cont-list [data-contdel="c:' + lid + '"]').click(), two);
  ok('the x asks first', await p.evaluate(() => window.PMC_CAMPAIGN.list().length === 2 && /Delete\?/.test(document.querySelector('#cont-list .resume-x.confirm').textContent)));
  await p.evaluate((lid) => document.querySelector('#cont-list [data-contdel="c:' + lid + '"]').click(), two);
  ok('...and a second tap puts it away', await p.evaluate((lid) => window.PMC_CAMPAIGN.list().length === 1 && !localStorage.getItem('pmc-campaign:' + lid) &&
    document.querySelectorAll('#cont-list [data-cont]').length === 1, two));

  console.log('\nKept by an older build');
  await p.evaluate(() => {
    const keep = localStorage.getItem('pmc-campaign:' + window.PMC_CAMPAIGN.lid());
    localStorage.clear();
    localStorage.setItem('pmc-campaign', keep);
  });
  await p.reload(); await p.waitForTimeout(900);
  ok('the one campaign an older build kept is moved in, and open', await p.evaluate(() => window.PMC_CAMPAIGN.list().length === 1 &&
    window.PMC_CAMPAIGN.get() && window.PMC_CAMPAIGN.get().companies.A.name === 'First Company' && !localStorage.getItem('pmc-campaign')));

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
