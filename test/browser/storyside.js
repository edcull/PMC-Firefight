/* A side contract through the interface (story mode): taken at the break
   between chapters, its briefing and the muster, the battle (conceded by the
   enemy, not played), the campaign's own aftermath, and back to the break with
   its pay; and a side contract taken and then the game left and come back to,
   still there to be fought. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS, seedDice } = require('../where.js');

async function body(p) { return p.evaluate(() => document.getElementById('camp-title').textContent + '\n' + document.getElementById('camp-body').innerText); }
async function go(p, sel) {
  const hit = await p.evaluate((s) => { const b = document.querySelector(s); if (!b || b.disabled) return false; b.click(); return true; }, sel);
  await p.waitForTimeout(250);
  return hit;
}
async function clickText(p, re) {
  const hit = await p.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll('#camp-body button')].find(x => rx.test(x.textContent) && !x.disabled);
    if (!b) return false;
    b.click(); return true;
  }, re);
  await p.waitForTimeout(250);
  return hit;
}
async function cards(p) {
  for (let i = 0; i < 10; i++) {
    await p.evaluate(() => { const r = document.getElementById('resolution'); if (r && !r.hidden) document.getElementById('res-continue').click(); });
    await p.waitForTimeout(150);
  }
}
const story = (p) => p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { node: c.story.node, side: c.story.side, detour: c.story.detour, kUC: c.companies.A.kUC, pending: !!c.pending, post: !!c.post }; });
// the battle under way: the enemy concedes it, and the dossier comes back
async function concede(p) {
  await p.waitForTimeout(1200);
  await cards(p);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^done$/i.test(x.textContent.trim()) && x.offsetParent); if (b) b.click(); });
  await p.evaluate(() => window.__concede('B'));
  await p.waitForTimeout(500);
  for (let i = 0; i < 20; i++) {
    if (await p.evaluate(() => !document.getElementById('camp').hidden)) break;
    await cards(p);
    await p.waitForTimeout(300);
  }
}
// the aftermath, through to its end, as a player reads it
async function throughAftermath(p) {
  await clickText(p, '^[Kk]eep them all$');
  await p.waitForTimeout(400);
  const seen = /Aftermath/.test(await body(p));
  await p.evaluate(() => { const b = document.querySelector('#camp-body [data-go="afterhub"]'); if (b) b.click(); });
  await p.waitForTimeout(400);
  return seen;
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  if (process.env.DBG) p.on('console', (m) => console.log('   [console]', m.type(), m.text().slice(0, 300)));
  await seedDice(p, 2670);
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload(); await p.waitForTimeout(800);

  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }

  // a new story, chapter 1 played to its break (the battle conceded)
  await go(p, '#btn-story');
  await go(p, '[data-go="storynew"]');
  await p.evaluate(() => { document.getElementById('found-name').value = 'Kessler Rifles'; });
  for (const k of ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng']) await go(p, `#camp-body button[data-add="${k}"]`);
  await go(p, '#camp-body button[data-doc="S2"]');
  await clickText(p, 'Sign the charter');
  await go(p, '[data-go="storyon"]');
  await go(p, '[data-go="storyopt"][data-o="send"]');
  await go(p, '[data-go="storymuster"]');
  await go(p, '[data-go="storyfight"]');
  await concede(p);
  await throughAftermath(p);
  await go(p, '[data-go="storyon"]');
  await go(p, '[data-go="storyopt"][data-o="bury"]');

  console.log('\nThe side contract');
  let txt = await body(p);
  const at0 = await story(p);
  check('at the break between chapters, a side contract on offer', at0.node === 'c1.interlude' && await p.evaluate(() => !!document.querySelector('#camp-body [data-go="storyside"]')), JSON.stringify(at0));
  const job = await p.evaluate(() => document.querySelector('#camp-body [data-go="storyside"]').getAttribute('data-j'));
  await go(p, `#camp-body [data-go="storyside"][data-j="${job}"]`);
  txt = await body(p);
  const at1 = await story(p);
  check('taken: its briefing, and the way to the muster', at1.node === '@side:' + job && /Choose your force/i.test(txt) && await p.evaluate(() => !!document.querySelector('#camp-body [data-go="storymuster"]')), JSON.stringify(at1) + ' ' + txt.slice(0, 200));

  // left, and come back to: the job still there to be fought
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => window.PMCMenu.open()); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('btn-continue').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#cont-list [data-cont^="c:"]').click()); await p.waitForTimeout(900);
  txt = await body(p);
  const at2 = await story(p);
  check('left and come back to: the side contract still there, its briefing and the way to the muster', at2.node === '@side:' + job && /Choose your force/i.test(txt), JSON.stringify(at2) + ' ' + txt.slice(0, 200));

  await go(p, '[data-go="storymuster"]');
  const kUC0 = (await story(p)).kUC;
  await go(p, '[data-go="storyfight"]');
  const cfg = await p.evaluate(() => { const s = window.PMC_STATE && window.PMC_STATE(); return s ? { node: s.cfg.story && s.cfg.story.node, name: s.scen && s.scen.name } : null; });
  check('the battle starts, the side contract’s own', cfg && cfg.node === '@side:' + job, JSON.stringify(cfg));
  await concede(p);
  const at3 = await story(p);
  check('won: the story is back at the break, the job done', at3.node === 'c1.interlude' && !at3.detour && at3.side && at3.side.taken === job, JSON.stringify(at3));
  const saw = await throughAftermath(p);
  check('...and the campaign’s own aftermath follows, as for any battle', saw);
  const at4 = await story(p);
  check('...the pay in the bank, and nothing left pending', at4.kUC > kUC0 && !at4.pending && !at4.post, JSON.stringify({ before: kUC0, after: at4.kUC, pending: at4.pending, post: at4.post }));
  txt = await body(p);
  check('...and back on the break’s page, no second job on offer', /Go on/i.test(txt) && await p.evaluate(() => !document.querySelector('#camp-body [data-go="storyside"]')), txt.slice(0, 200));

  check('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n' + (problems.length ? problems.length + ' failed: ' + problems.join('; ') : 'All passed.'));
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
