/* A campaign battle under way kept with its campaign in the account: begun on one
   device and played some way, the campaign then opened on another signed in as the
   same player finds the battle there to go back to, as far on as the first left it. */
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
  async function device(how) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    const got = await p.evaluate((h) => fetch('api/' + h, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Mover', password: 'mover password', email: 'mover@example.com' }) }).then((r) => r.status), how);
    await p.reload(); await p.waitForTimeout(900);
    return { p, got };
  }
  const onServer = (p) => p.evaluate(() => fetch('api/campaigns').then((r) => r.json()).then((j) => j.campaigns[0] ? fetch('api/campaigns/' + j.campaigns[0].id).then((r) => r.json()).then((x) => x.state) : null));

  const d1 = await device('register');
  ok('signed up on the first device', d1.got === 200);
  // a campaign, and its battle begun on this device (a contract taken: the campaign's battle pending)
  await d1.p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat', nameA: 'Iron Wolves', nameB: 'The Red Dawn', factionA: 'pmc', factionB: 'rebel' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.B = C.newCompany('The Red Dawn', { faction: 'rebel' });
    C.found(camp.companies.B, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
    camp.companies.A.name = 'Iron Wolves'; camp.companies.B.name = 'The Red Dawn'; camp.companies.B.colour = 'steel';
    camp.rivals = [camp.companies.B]; camp.facing = 0;
    camp.pending = { tier: 1, pl: 1, scenario: 'meeting', A: [], B: [], drugged: [] };
    window.PMC_CAMPAIGN.set(camp);
  });
  await d1.p.waitForTimeout(800);
  await d1.p.evaluate(() => {
    const lid = window.PMC_CAMPAIGN.lid();
    window.PMC_NEWGAME({ tier: 1, pl: 1, mode: 'ai', planet: 'desert', scenario: 'meeting', nameA: 'Iron Wolves', nameB: 'The Red Dawn',
      armyA: window.PMC.rollArmy(1, 1, null, 'pmc'), armyB: window.PMC.rollArmy(1, 1, null, 'rebel'), campaign: true, campLid: lid });
  });
  await d1.p.waitForTimeout(1200);
  // some way into it: the forces set up
  await d1.p.evaluate(() => { window.__sendIntent({ k: 'autodeploy' }); });
  await d1.p.waitForTimeout(800);
  const kept1 = await d1.p.evaluate(() => (window.PMCNet.savedBattles() || []).filter((x) => x.campaign).map((x) => x.id));
  ok('the battle is kept in the first browser', kept1.length === 1, JSON.stringify(kept1));
  await wait(5500);                                  // the campaign's save comes a few seconds after the battle's
  const st1 = await onServer(d1.p);
  ok('...and goes to the account with its campaign', !!(st1 && st1.battle && st1.battle.id === kept1[0] && Array.isArray(st1.battle.intents)),
    st1 && st1.battle ? st1.battle.id + ' with ' + st1.battle.intents.length + ' intents' : 'no battle on the campaign');
  ok('...with what has been played of it', !!(st1 && st1.battle && st1.battle.intents.length > 0));

  const d2 = await device('login');
  ok('signed in on a second device', d2.got === 200);
  await d2.p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
  await d2.p.waitForTimeout(800);
  await d2.p.evaluate(() => document.querySelector('#cont-list [data-cont^="a:"]').click());
  await d2.p.waitForTimeout(1000);
  const there = await d2.p.evaluate(() => ({
    kept: (window.PMCNet.savedBattles() || []).filter((x) => x.campaign).map((x) => x.id),
    pending: !!(window.PMC_CAMPAIGN.get() || {}).pending,
    lid: window.PMC_CAMPAIGN.lid()
  }));
  ok('the second device takes the battle into its own keeping', there.kept.length === 1 && there.kept[0] === kept1[0], JSON.stringify(there.kept));
  ok('...and the campaign’s battle is still pending there, to be gone back to', there.pending);
  const book = await d2.p.evaluate((id) => window.PMCNet.savedBattle(id), kept1[0]);
  ok('...as far on as the first device left it', !!(book && st1 && st1.battle && book.intents.length === st1.battle.intents.length && book.cfg.campLid === there.lid),
    book ? book.intents.length + ' intents' : 'none');

  // the Continue list's badges say in words where each game is kept
  await d2.p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
  await d2.p.waitForTimeout(600);
  const badges = await d2.p.evaluate(() => Array.from(document.querySelectorAll('#cont-list .cont-where')).map((x) => x.textContent));
  ok('a campaign kept in the account reads as synced, not offline', badges.length && badges.every((t) => !/Offline/.test(t)) && badges.some((t) => /Synced|In your account/.test(t)), JSON.stringify(badges));

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
