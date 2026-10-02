/* A signed-in player's campaign kept by their account (multiplayer plan, phase 3a,
   decision 7): made in one browser, found in another signed in as the same
   player, and a save from a browser holding an older copy refused — the hub then
   offers the newer one, which it takes up. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { ROOT, tmpData } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch('http://localhost:' + PORT + '/health').then((r) => r.ok).catch(() => false); }
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const URL = 'http://localhost:' + PORT + '/';
  // a browser, signed in (a new account, or the one already made), the page then loaded afresh as a player would find it
  async function device(sign) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    const got = await p.evaluate((s) => fetch('api/' + s.how, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Keeper', password: 'keeper password' }) }).then((r) => r.status), sign);
    await p.reload(); await p.waitForTimeout(900);
    return { p, got };
  }
  const list = (p) => p.evaluate(() => fetch('api/campaigns').then((r) => r.json()).then((j) => j.campaigns || []));

  const d1 = await device({ how: 'register' });
  ok('signed up on the first device', d1.got === 200);
  await d1.p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat', nameA: 'Iron Wolves', nameB: 'The Red Dawn', factionA: 'pmc', factionB: 'rebel' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.B = C.newCompany('The Red Dawn', { faction: 'rebel' });
    C.found(camp.companies.B, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
    camp.companies.A.name = 'Iron Wolves'; camp.companies.B.name = 'The Red Dawn'; camp.companies.B.colour = 'steel';
    camp.rivals = [camp.companies.B]; camp.facing = 0;
    window.PMC_CAMPAIGN.set(camp);
  });
  await d1.p.waitForTimeout(800);
  const kept = await list(d1.p);
  ok('a campaign begun there is kept by the account', kept.length === 1 && /Iron Wolves/.test(kept[0].name), JSON.stringify(kept));

  const d2 = await device({ how: 'login' });
  ok('signed in on a second device', d2.got === 200);
  await d2.p.evaluate(() => document.getElementById('btn-campaign').click());
  await d2.p.waitForTimeout(800);
  const found = await d2.p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return c && c.companies.A.name; });
  ok('...where the same campaign is found, from the account', found === 'Iron Wolves', String(found));

  // the second device moves on; the first, still holding the older copy, then saves
  await d2.p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); c.companies.A.kUC = 99; window.PMC_CAMPAIGN.set(c); });
  await d2.p.waitForTimeout(600);
  await d1.p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); c.companies.A.kUC = 5; window.PMC_CAMPAIGN.set(c); });
  await d1.p.waitForTimeout(800);
  await d1.p.evaluate(() => { if (document.getElementById('camp').hidden) document.getElementById('btn-campaign').click(); window.PMC_CAMPAIGN.open('hub'); });
  await d1.p.waitForTimeout(400);
  const note = await d1.p.evaluate(() => { const n = document.querySelector('#camp-body .hubnote'); return n ? n.textContent : ''; });
  ok('a save from the older copy is refused, and the hub says so', /saved on another device/.test(note) && /Use that copy/.test(note), note);
  const onServer = await d1.p.evaluate(() => fetch('api/campaigns').then((r) => r.json()).then((j) => fetch('api/campaigns/' + j.campaigns[0].id)).then((r) => r.json()).then((j) => j.state.companies.A.kUC));
  ok('...the newer copy is left as it was', onServer === 99, String(onServer));
  await d1.p.evaluate(() => document.querySelector('#camp-body [data-go="storeuse"]').click());
  await d1.p.waitForTimeout(400);
  const took = await d1.p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.kUC);
  ok('"Use that copy" takes up the newer one', took === 99, String(took));
  await d1.p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); c.companies.A.kUC = 100; window.PMC_CAMPAIGN.set(c); });
  await d1.p.waitForTimeout(600);
  const after = await d1.p.evaluate(() => fetch('api/campaigns').then((r) => r.json()).then((j) => fetch('api/campaigns/' + j.campaigns[0].id)).then((r) => r.json()).then((j) => j.state.companies.A.kUC));
  ok('...and saving goes on from there', after === 100, String(after));

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
