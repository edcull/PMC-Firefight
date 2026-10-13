/* An admin's Server tools, on their account pane: shown only to an admin, the
   accounts, battles and campaigns listed, a player's account activated, and one
   removed only once the admin's own password is typed again (a wrong one refused).
   The admin and the players are made from the console first. */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const { ROOT, tmpData } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
const URL = 'http://localhost:' + PORT + '/';
const DATA = tmpData();
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const env = Object.assign({}, process.env, { DATA_DIR: DATA, CAMPAIGNS_DIR: tmpData(), PORT: String(PORT), PUBLIC_URL: URL, MAIL_OUTBOX: tmpData() });
  const con = (...a) => execFileSync(process.execPath, ['server/admin.js'].concat(a), { cwd: ROOT, env: env, stdio: 'pipe' });
  con('create', 'Boss', 'boss password', 'admin', 'boss@example.com');
  con('create', 'Ash', 'ash password', '', 'ash@example.com');
  con('create', 'Brann', 'brann password', '', 'brann@example.com');
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore', env: env });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch(URL + 'health').then((r) => r.ok).catch(() => false); }
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const pane = () => p.evaluate(() => document.getElementById('acct-body').innerText);
  const click = (sel) => p.evaluate((s) => document.querySelector('#account ' + s).click(), sel);
  const has = (sel) => p.evaluate((s) => !!document.querySelector('#account ' + s), sel);
  async function till(pred, what) {
    for (let i = 0; i < 60; i++) { const t = await pane(); if (pred(t)) return t; await wait(100); }
    throw new Error('waited for ' + what + ': ' + (await pane()).slice(0, 400));
  }
  async function signIn(email, pw) {
    await p.evaluate(() => window.PMCAccount.show()); await wait(300);
    await p.fill('#acct-name', email); await p.fill('#acct-pass', pw);
    await click('[data-acct="go"]');
    // signed in, the screen goes straight to the main menu: the account opened again from there
    for (let i = 0; i < 60; i++) { if (await p.evaluate(() => document.getElementById('account').hidden && !document.getElementById('menu').hidden)) break; await wait(100); }
    ok('signing in goes straight to the main menu', await p.evaluate(() => document.getElementById('account').hidden && !document.getElementById('menu').hidden));
    await p.evaluate(() => window.PMCAccount.show()); await wait(300);
    await till((x) => /sign out/i.test(x), 'signed in');
  }
  const signOut = async () => { await click('[data-acct="out"]'); await till((x) => !/sign out/i.test(x), 'signed out'); };

  try {
    await p.goto(URL); await wait(1200);
    console.log('\nOnly for an admin');
    await signIn('ash@example.com', 'ash password');
    ok('a player has no Server tools', !(await has('[data-acct="admin-open"]')));
    const r = await p.evaluate(() => fetch('api/admin/overview').then((x) => x.status));
    ok('...and the server refuses them the overview', r === 403, String(r));
    // a campaign of Ash's kept on the server, for the admin to download below
    const saved = await p.evaluate(() => fetch('api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: { mode: 'solo', name: 'Ash Company', turn: 3, companies: { A: { name: 'Ash Company', roster: [] } } } }) }).then((x) => x.status));
    const peek = await p.evaluate(() => fetch('api/admin/campaigns-data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((x) => x.status));
    ok('...nor campaign data', peek === 403 && saved < 300, 'saved ' + saved + ', data ' + peek);
    await signOut();
    await signIn('boss@example.com', 'boss password');
    ok('an admin has them', await has('[data-acct="admin-open"]'));

    console.log('\nThe server');
    await click('[data-acct="admin-open"]');
    let t = await till((x) => /accounts/i.test(x) && /battles/i.test(x), 'the tools');
    ok('the accounts are listed, the admin marked', /Boss\s*admin/i.test(t) && /Ash/.test(t) && /Brann/.test(t), t.slice(0, 300));
    ok('the server, the battles and the campaigns too', /3 accounts/.test(t) && /campaigns/i.test(t) && /back up now/i.test(t));
    ok('the admin cannot remove their own account here', !(await has('[data-act="delete-user"][data-key="Boss"]')));
    // the campaigns' data in full, one or every one, as JSON
    const dl = async (sel) => {
      const [d] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), click(sel)]);
      return { name: d.suggestedFilename(), j: JSON.parse(fs.readFileSync(await d.path(), 'utf8')) };
    };
    const one = await dl('[data-acct="admin-dl-camp"]');
    ok('a campaign downloads in full, its owner named', /^pmc-campaign-\d+-ash-company-/.test(one.name) && one.j.campaigns.length === 1 &&
      one.j.campaigns[0].owner === 'Ash' && one.j.campaigns[0].state.companies.A.name === 'Ash Company', one.name);
    const all = await dl('[data-acct="admin-dl-camps"]');
    ok('...and every campaign at once', /^pmc-campaigns-/.test(all.name) && all.j.kind === 'campaigns' && all.j.campaigns.length >= 1, all.name + ' ' + all.j.campaigns.length);
    await click('[data-act="backup"]');
    t = await till((x) => /Backed up/.test(x), 'backed up');
    ok('a backup is taken', /pmc-.*\.db/.test(t) && fs.readdirSync(require('path').join(DATA, 'backups')).length >= 1);

    console.log('\nRemoving an account');
    await click('[data-act="delete-user"][data-key="Brann"]');
    ok('removing asks for the admin’s password', await has('#acct-admpass'));
    await p.fill('#acct-admpass', 'not it');
    await click('[data-acct="adm-confirm"]');
    t = await till((x) => /not your password/i.test(x), 'refused');
    ok('a wrong password is refused, nothing removed', /Brann/.test(t));
    await p.fill('#acct-admpass', 'boss password');
    await click('[data-acct="adm-confirm"]');
    t = await till((x) => /account removed/i.test(x) && !/brann@example/.test(x) && /2 accounts/.test(x), 'removed, and the list reloaded');
    ok('the right one removes it', !/brann@example/.test(t) && /2 accounts/.test(t), t.slice(0, 300));
    await click('[data-acct="admin-close"]');
    ok('Done goes back to the account', await has('[data-acct="admin-open"]'));
    ok('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) {
    fail++; console.log('  ✗ ' + e.message);
  }
  await b.close(); srv.kill();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
