/* A hotseat campaign founds two forces: the first player's, then the second
   player's — their own army, name, colours, units and doctrine — before the
   campaign goes on. A reload between the two brings the second player back to
   their founding screen. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

async function click(p, sel) {
  const hit = await p.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b || b.disabled) return false;
    b.click(); return true;
  }, sel);
  await p.waitForTimeout(200);
  return hit;
}
async function clickText(p, re) {
  const hit = await p.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll('#camp-body button')].find(x => rx.test(x.textContent) && !x.disabled);
    if (!b) return false;
    b.click(); return true;
  }, re);
  await p.waitForTimeout(200);
  return hit;
}
const body = (p) => p.evaluate(() => document.getElementById('camp-title').textContent + '\n' + document.getElementById('camp-body').innerText);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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

  console.log('\nA solo world, always rolled');
  await click(p, '#btn-campaign');
  check('there is no picking the rivals', await p.evaluate(() => !document.getElementById('camp-archline') && !document.getElementById('camp-archmodal')));
  await clickText(p, 'Raise the force');
  await p.evaluate(() => { document.getElementById('found-name').value = 'Solo Company'; });
  for (const k of ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng']) {
    await click(p, `#camp-body button[data-add="${k}"]`);
  }
  await click(p, '#camp-body button[data-doc="S2"]');
  await clickText(p, 'Sign the charter');
  const world = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return c.rivals.map(r => ({ plan: (r.docPlan || []).length, docs: r.doctrines.length, theme: window.PMCCamp.themeOf(r) })); });
  check('...three rivals, each with a random plan of doctrines and a character read from them',
    world.length === 3 && world.every(w => w.docs >= 1 && /^It /.test(w.theme)), world.map(w => w.theme).join(' | '));
  await p.evaluate(() => { try { localStorage.removeItem('pmc-campaign'); } catch (e) { } });
  await p.reload();
  await p.waitForTimeout(900);

  console.log('\nPlayer 1');
  await click(p, '#btn-campaign');
  await p.evaluate(() => {
    const m = document.getElementById('camp-mode'); m.value = 'hotseat'; m.dispatchEvent(new Event('change', { bubbles: true }));
  });
  check('...it asks what player 2 is running instead', await p.evaluate(() => !document.getElementById('camp-bwrap').hidden &&
    [...document.getElementById('camp-bfaction').options].map(o => o.value).join() === 'pmc,rebel,bugs,xeno'));
  await p.evaluate(() => { document.getElementById('camp-bfaction').value = 'xeno'; });
  await clickText(p, 'Raise the force');
  check('player 1 founds first', /Player 1 — Found a company/.test(await body(p)));
  await p.evaluate(() => { document.getElementById('found-name').value = 'Task Force Ironhold'; });
  for (const k of ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng']) {
    await click(p, `#camp-body button[data-add="${k}"]`);
  }
  await click(p, '#camp-body button[data-doc="S2"]');
  check('player 1 signs', await clickText(p, 'Sign the charter'));

  console.log('\nPlayer 2');
  let txt = await body(p);
  check('then player 2 founds their own force, of the kind chosen on the hub', /Player 2 — Claim a territory/.test(txt) && /Task Force Ironhold has signed/.test(txt) &&
    await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.B.faction === 'xeno'));
  check('...with no way back out until they have', !/^Back$/m.test(txt));
  check('...and a colour of their own to start from', await p.evaluate(() => {
    document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click();
    const on = document.querySelector('#camp-body [data-campcolour].on'); return !!on && on.getAttribute('data-campcolour') !== window.PMC_CAMPAIGN.get().companies.A.colour;
  }));

  // a reload between the two brings player 2 back
  await p.reload();
  await p.waitForTimeout(900);
  await click(p, '#btn-campaign');
  check('a reload comes back to player 2\'s founding', /Player 2 — /.test(await body(p)));

  // player 2 runs a swarm
  await click(p, '#camp-body button[data-bfaction="bugs"]');
  txt = await body(p);
  check('player 2 can choose a different kind of force', /Player 2 — Awaken a swarm/.test(txt) &&
    await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.B.faction === 'bugs'));
  check('...and is offered that force\'s own units', await p.evaluate(() => !!document.querySelector('#camp-body button[data-add="btiny"]') &&
    !document.querySelector('#camp-body button[data-add="recruits"]')));
  await p.evaluate(() => { document.getElementById('found-name').value = 'The Hive'; });
  // the same colour as player 1 is refused
  const aColour = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.colour);
  await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); });
  await click(p, `#camp-body button[data-campcolour="${aColour}"]`);
  for (const k of ['btiny', 'btiny', 'btiny', 'bspitlarva', 'bspitlarva', 'bspitlarva', 'bsmall', 'bimmspit']) {
    await click(p, `#camp-body button[data-add="${k}"]`);
  }
  const doc = await p.evaluate(() => document.querySelector('#camp-body button[data-doc]').getAttribute('data-doc'));
  await click(p, `#camp-body button[data-doc="${doc}"]`);
  await p.locator('#camp-body').screenshot({ path: path.join(SHOTS, 'camp-hotseat-p2.png') });
  await clickText(p, 'Wake the hive');
  check('player 2 cannot wear player 1\'s colour', await p.evaluate(() => !document.getElementById('camp-ask').hidden &&
    /colour is taken/.test(document.getElementById('camp-askbox').innerText)));
  await p.evaluate(() => document.querySelector('[data-ask="close"]').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); });
  const other = await p.evaluate((a) => [...document.querySelectorAll('#camp-body [data-campcolour]')].map(x => x.getAttribute('data-campcolour')).find(c => c !== a), aColour);
  await click(p, `#camp-body button[data-campcolour="${other}"]`);
  check('player 2 signs', await clickText(p, 'Wake the hive'));

  console.log('\nThe hub');
  txt = await body(p);
  const camp = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    return { A: c.companies.A.name, B: c.companies.B.name, bf: c.companies.B.faction, bn: c.companies.B.roster.length,
      bdoc: c.companies.B.doctrines.length, rivals: (c.rivals || []).length, colours: [c.companies.A.colour, c.companies.B.colour] };
  });
  check('both forces are on the hub', /Task Force Ironhold/.test(txt) && /The Hive/.test(txt), camp.A + ' / ' + camp.B);
  check('...player 2\'s as founded, and no generated rivals', camp.bf === 'bugs' && camp.bn === 9 && camp.bdoc === 1 && camp.rivals === 1,
    camp.bn + ' units, ' + camp.rivals + ' rival');
  check('...in two different colours', camp.colours[0] !== camp.colours[1], camp.colours.join(' / '));

  await p.reload();
  await p.waitForTimeout(900);
  await click(p, '#btn-campaign');
  check('both survive a reload', /Task Force Ironhold/.test(await body(p)) && /The Hive/.test(await body(p)));
  check('no page errors', errs.length === 0, errs.join('; '));

  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
