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
  await click('#camp-body [data-go="fmodal"][data-kind="recruit"]');
  // one row a unit: whether it rides, and on what, is picked in the question that asks for the money
  check('the list has no separate Riders or drone rows', await p.evaluate(() => !document.querySelector('#camp-body [data-asriders], #camp-body [data-asdrone]')));
  const key = await p.evaluate(() => [...document.querySelectorAll('#camp-body [data-recruit]')].map(x => x.getAttribute('data-recruit'))
    .find(k => window.PMC.canRide(window.PMC.profile(k))));
  check('the recruiting list has a squad that may ride', !!key, key);
  const before = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length);
  await click('#camp-body [data-recruit="' + key + '"]');
  const opts = () => p.evaluate(() => [...document.querySelectorAll('#camp-askbox .askpick')].map(x => x.querySelector('label').textContent + ':' +
    [...x.querySelectorAll('.askopt')].map(o => o.getAttribute('data-v') + (o.classList.contains('on') ? '*' : '')).join(',')));
  const o1 = await opts();
  check('...asking first, on foot or as Riders, on foot to begin with', o1.some(x => /^Mounted:foot\*,riders$/.test(x)) && !o1.some(x => /^Mount:/.test(x)), o1.join(' | '));
  const pic = () => p.evaluate(() => { const c = document.querySelector('#camp-askbox canvas.dportrait'); if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return { riders: !!c.dataset.riders, mount: c.dataset.mount || '', inked: n }; });
  const pic1 = await pic();
  check('...with a picture of the squad', !!pic1 && pic1.inked > 200 && !pic1.riders, JSON.stringify(pic1));
  await click('#camp-askbox [data-v="riders"]');
  const o2 = await opts();
  check('picking Riders offers the mount', o2.some(x => /^Mount:none\*,bike,gravbike,horse$/.test(x)), o2.join(' | '));
  await click('#camp-askbox [data-v="horse"]');
  const pic2 = await pic();
  check('...and the picture follows: mounted, on a horse', !!pic2 && pic2.riders && pic2.mount === 'horse' && pic2.inked > 200, JSON.stringify(pic2));
  await click('#camp-askbox [data-ask="ok"]');
  const got = await p.evaluate(() => { const r = window.PMC_CAMPAIGN.get().companies.A.roster; return { n: r.length, last: r[r.length - 1] }; });
  check('...and the squad joins mounted, on its horse', got.n === before + 1 && got.last.key === key && got.last.riders === true && got.last.mount === 'horse', JSON.stringify(got.last && { riders: got.last.riders, mount: got.last.mount }));
  // a hull: its drive and its crew, asked the same way
  await click('#camp-body [data-recruit="rtechnical"]');
  const o3 = await opts();
  check('a vehicle is asked its propulsion and its crew', o3.some(x => /^Propulsion:none\*,wheeled,tracked,grav,hover,walker$/.test(x)) && o3.some(x => /^Crew:crew\*,drone$/.test(x)), o3.join(' | '));
  await click('#camp-askbox [data-v="tracked"]');
  await click('#camp-askbox [data-v="drone"]');
  const pic3 = await p.evaluate(() => { const c = document.querySelector('#camp-askbox canvas.dportrait'); return c ? { prop: c.dataset.prop, drone: !!c.dataset.drone } : null; });
  check('...its picture tracked, flown as a drone', !!pic3 && pic3.prop === 'tracked' && pic3.drone, JSON.stringify(pic3));
  await click('#camp-askbox [data-ask="ok"]');
  const hull = await p.evaluate(() => { const r = window.PMC_CAMPAIGN.get().companies.A.roster; return r[r.length - 1]; });
  check('...and it joins as picked', hull.key === 'rtechnical' && hull.prop === 'tracked' && hull.drone === true, JSON.stringify({ prop: hull.prop, drone: hull.drone }));
  await click('#camp-body .cmodal:not([hidden]) [data-go="fmodalclose"]');
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
