/* The star system (roadmap v0.5): a single-player campaign's Contract button
   opens the system, a planet its map, a pin the offer, and Take this contract
   takes it — the contract carrying the planet's site and conditions. The plain
   list is a tap away. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(600);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload(); await p.waitForTimeout(700);

  console.log('\nThe system');
  const made = await p.evaluate(() => {
    window.PMC_CAMPAIGN.fresh('solo');
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'solo', nameA: 'Tunnel Rats', factionA: 'pmc' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.A.name = 'Tunnel Rats';
    camp.rivals = C.foundRivals(camp, 3) || camp.rivals;
    camp.options = { otherWorlds: true };
    camp.system = window.PMCSystem.makeSystem(camp, { seed: 4242 });
    window.PMC_CAMPAIGN.set(camp);
    window.PMC_CAMPAIGN.open('hub');
    return camp.system.planets.length;
  });
  await p.evaluate(() => document.querySelector('#camp-body [data-go="offers"]').click());
  await p.waitForTimeout(300);
  const sys = await p.evaluate(() => ({
    planets: document.querySelectorAll('#camp-body .sys-planet').length,
    head: (document.querySelector('#camp-body .sys-head h2') || {}).textContent,
    badges: [...document.querySelectorAll('#camp-body .sys-badge text')].reduce((a, t) => a + +t.textContent, 0),
    offers: window.PMC_CAMPAIGN.get().offers.length
  }));
  ok('Contract opens the star system: its planets on their orbits', sys.planets === made && /Reach$/.test(sys.head || ''), JSON.stringify(sys));
  ok('...each planet badged with its contracts, every offer on one', sys.badges === sys.offers, sys.badges + ' of ' + sys.offers);
  await p.screenshot({ path: path.join(SHOTS, 'system.png') });

  console.log('\nA planet');
  const target = await p.evaluate(() => window.PMC_CAMPAIGN.get().offers[0].site.planet);
  await p.click('#camp-body .sys-planet[data-planet="' + target + '"]');
  await p.waitForTimeout(200);
  const card = await p.evaluate(() => {
    const c = document.querySelector('#camp-body .sys-card');
    return { text: c.textContent, bar: !!c.querySelector('.sys-bar span'), land: !!c.querySelector('[data-sys="land"]') };
  });
  ok('a tap on a planet: its kind, conditions, who holds it and its contracts', /world/.test(card.text) && card.bar && /standing/.test(card.text) && card.land, card.text.slice(0, 160));
  await p.click('#camp-body [data-sys="land"]');
  await p.waitForTimeout(500);
  const map = await p.evaluate(() => ({ map: !!document.querySelector('#camp-body .sys-map'), pins: document.querySelectorAll('#camp-body .sys-pin').length, back: !!document.querySelector('#camp-body [data-sys="back"]') }));
  ok('Land on it: its map, the contracts pinned on it', map.map && map.pins >= 1 && map.back, JSON.stringify(map));
  await p.click('#camp-body .sys-pin');
  await p.waitForTimeout(300);
  const offer = await p.evaluate(() => {
    const c = document.querySelector('#camp-body .sys-card');
    return { take: !!c.querySelector('[data-take-offer]'), site: (c.querySelector('.offer-site') || {}).textContent || '' };
  });
  ok('a pin: the offer, with where it is and the company\'s standing there', offer.take && /standing/.test(offer.site), offer.site);
  await p.screenshot({ path: path.join(SHOTS, 'system-planet.png') });
  const want = await p.evaluate(() => { const i = +document.querySelector('#camp-body .sys-card [data-take-offer]').getAttribute('data-take-offer'); return window.PMC_CAMPAIGN.get().offers[i]; });
  await p.click('#camp-body .sys-card [data-take-offer]');
  await p.waitForTimeout(300);
  const took = await p.evaluate(() => ({ body: document.getElementById('camp-body').textContent }));
  ok('Take this contract: the contract, at that site', took.body.indexOf(want.site.name) >= 0, want.site.name);

  console.log('\nThe list');
  await p.evaluate(() => window.PMC_CAMPAIGN.open('hub'));
  await p.evaluate(() => document.querySelector('#camp-body [data-go="offers"]').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#camp-body [data-go="offerlist"]').click());
  await p.waitForTimeout(200);
  const list = await p.evaluate(() => ({ panels: document.querySelectorAll('#camp-body .cpan-offer').length, back: !!document.querySelector('#camp-body [data-go="offersys"]') }));
  ok('the plain list is a tap away, and the way back to the system with it', list.panels > 0 && list.back, JSON.stringify(list));

  console.log('\nThe new-campaign form, and an older campaign');
  await p.evaluate(() => window.PMC_CAMPAIGN.fresh('solo'));
  await p.waitForTimeout(200);
  const form = await p.evaluate(() => { const s = document.getElementById('camp-system'); return s ? s.value : null; });
  ok('a new single-player campaign is fought across a star system unless asked otherwise', form === 'system', String(form));
  const old = await p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'solo', nameA: 'Old Guard', factionA: 'pmc' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.A.name = 'Old Guard';
    camp.rivals = C.foundRivals(camp, 3) || camp.rivals;
    window.PMC_CAMPAIGN.set(camp);
    window.PMC_CAMPAIGN.open('hub');
    const before = C.rollOffers(camp).map((o) => o.scenario.id + o.tier).join();
    const btn = document.querySelector('#camp-body [data-go="chartsys"]');
    if (!btn) return { btn: false };
    btn.click();
    const okb = [...document.querySelectorAll('button')].find((x) => /Chart it/.test(x.textContent));
    if (okb) okb.click();
    const c = window.PMC_CAMPAIGN.get();
    return { btn: true, sys: !!c.system, ow: !!(c.options && c.options.otherWorlds), same: C.rollOffers(c).map((o) => o.scenario.id + o.tier).join() === before,
      placed: C.rollOffers(c).every((o) => o.site && o.site.planet) };
  });
  ok('an older one may have a system charted from the hub: Other Worlds on, this turn\'s offers kept and placed on it', old.btn && old.sys && old.ow && old.same && old.placed, JSON.stringify(old));
  await p.evaluate(() => { window.PMC_CAMPAIGN.open('hub'); document.querySelector('#camp-body [data-go="offers"]').click(); });
  await p.waitForTimeout(200);

  console.log('\nOn a phone');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => { window.PMC_CAMPAIGN.open('hub'); document.querySelector('#camp-body [data-go="offers"]').click(); });
  await p.waitForTimeout(300);
  const phone = await p.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth, narrow: !!document.querySelector('#camp-body .sys-svg.narrow') }));
  ok('the system fits the width, drawn larger to tap', !phone.wide && phone.narrow, JSON.stringify(phone));
  await p.screenshot({ path: path.join(SHOTS, 'system-phone.png'), fullPage: true });
  // the card is not the battle's slide-out drawer (every <aside> is, on a phone): a tap shows it, on the page
  const onPage = () => p.evaluate(() => { const c = document.querySelector('#camp-body .sys-card'), r = c.getBoundingClientRect();
    return { fixed: getComputedStyle(c).position === 'fixed', inside: r.left >= 0 && r.right <= innerWidth + 1, take: !!c.querySelector('[data-take-offer]'), land: !!c.querySelector('[data-sys="land"]'), zoom: !!document.querySelector('#camp-body .sys-view.zoomin') }; });
  const pid = await p.evaluate(() => window.PMC_CAMPAIGN.get().offers[0].site.planet);
  await p.click('#camp-body .sys-planet[data-planet="' + pid + '"]');
  await p.waitForTimeout(300);
  const pc = await onPage();
  ok('a planet tapped on a phone: its card on the page, under the system', !pc.fixed && pc.inside && pc.land, JSON.stringify(pc));
  await p.click('#camp-body [data-sys="land"]');
  await p.waitForTimeout(300);
  const landed = await onPage();
  await p.click('#camp-body .sys-pin');
  await p.waitForTimeout(300);
  const pinned = await onPage();
  ok('...a pin tapped: the offer shown, and the map not zoomed in again', landed.zoom && pinned.take && pinned.inside && !pinned.fixed && !pinned.zoom, JSON.stringify([landed, pinned]));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
