/* Accounts with an email address, from the main menu's account pane: a new account
   waits for the link mailed to it (signing in before is refused, and the link may
   be sent again), the link activates it and signs the player in; the name is
   changed (not to one taken); a forgotten password is reset by a mailed link; and
   a new address is kept once its link is followed. The server writes its mail to
   a folder here (MAIL_OUTBOX) instead of sending it. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT, tmpData } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
const URL = 'http://localhost:' + PORT + '/';
const OUTBOX = tmpData();
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// the mail written so far, oldest first
function mail() {
  return fs.readdirSync(OUTBOX).sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b)).map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')));
}
async function latest(to, kind) {
  for (let i = 0; i < 40; i++) {
    const m = mail().filter((x) => x.to === to && new RegExp('[?&]' + kind + '=').test(x.text)).pop();
    if (m) return /https?:\/\/\S+/.exec(m.text)[0];
    await wait(100);
  }
  throw new Error('no ' + kind + ' mail to ' + to);
}

(async () => {
  const srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: 'ignore',
    env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT), PUBLIC_URL: URL, MAIL_OUTBOX: OUTBOX })
  });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch(URL + 'health').then((r) => r.ok).catch(() => false); }
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const pane = () => p.evaluate(() => document.getElementById('menu-account').innerText);
  const click = (sel) => p.evaluate((s) => document.querySelector('#menu-account ' + s).click(), sel);
  const fill = (id, v) => p.fill('#' + id, v);
  async function till(pred, what) {
    for (let i = 0; i < 60; i++) { const t = await pane(); if (pred(t)) return t; await wait(100); }
    throw new Error('waited for ' + what + ': ' + (await pane()).slice(0, 300));
  }
  async function accountPane() {
    await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('account'); });
    await wait(300);
  }

  await p.goto(URL); await wait(1200);
  console.log('\nA new account waits for its link');
  await accountPane();
  await click('[data-acct="mode"][data-mode="register"]');
  await fill('acct-name', 'Morgan'); await fill('acct-email', 'morgan@example.com'); await fill('acct-pass', 'first password');
  await click('[data-acct="go"]');
  let t = await till((x) => /has been sent to/i.test(x), 'the account made');
  ok('made: a link to activate it has been sent to the address', /morgan@example\.com/.test(t));
  const act = await latest('morgan@example.com', 'activate');
  ok('...and the mail is there, its link to this game', act.indexOf(URL + '?activate=') === 0, act.slice(0, 60));
  await click('[data-acct="mode"][data-mode="signin"]');
  await fill('acct-name', 'Morgan'); await fill('acct-pass', 'first password');
  await click('[data-acct="go"]');
  t = await till((x) => /not activated/i.test(x), 'refused');
  ok('signing in first is refused, and says why', /not activated/i.test(t));
  const n0 = mail().length;
  await click('[data-acct="resend"]');
  await till((x) => /sent again/i.test(x), 'sent again');
  ok('...with the link sent again on asking', mail().length === n0 + 1);
  const act2 = await latest('morgan@example.com', 'activate');
  await p.goto(act2); await wait(1500);
  t = await till((x) => /active/i.test(x), 'activated');
  ok('the link opens the game: the account is active, and signed in', /signed in/i.test(t) && (await p.textContent('#btn-menu-account')) === 'Morgan', t.slice(0, 80));
  ok('...and the address is clean of the link', !/activate=/.test(p.url()));

  console.log('\nA new name');
  // somebody else, made the same way (through the server's own API)
  await p.evaluate(() => fetch('api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Rowan', email: 'rowan@example.com', password: 'rowan password' }) }));
  await click('[data-acct="edit"][data-what="name"]');
  await fill('acct-newname', 'rowan');
  await click('[data-acct="rename"]');
  t = await till((x) => /taken/i.test(x), 'refused');
  ok('a name somebody has is refused', /taken/i.test(t));
  await fill('acct-newname', 'Morgan Vale');
  await click('[data-acct="rename"]');
  t = await till((x) => /now Morgan Vale/.test(x), 'renamed');
  ok('one nobody has is taken, and the menu says so', (await p.textContent('#btn-menu-account')) === 'Morgan Vale');

  console.log('\nA forgotten password');
  await click('[data-acct="out"]');
  await wait(400);
  await click('[data-acct="mode"][data-mode="forgot"]');
  await fill('acct-email', 'morgan@example.com');
  await click('[data-acct="forgot"]');
  t = await till((x) => /on its way/i.test(x), 'sent');
  ok('Forgot password sends a link (said the same whoever asks)', /If an account has the address/.test(t));
  const reset = await latest('morgan@example.com', 'reset');
  await p.goto(reset); await wait(1500);
  await till((x) => /new password/i.test(x), 'the form');
  await fill('acct-pass', 'second password');
  await click('[data-acct="reset"]');
  t = await till((x) => /password is changed/i.test(x), 'reset');
  ok('the link opens a form for the new password; set, and signed in', (await p.textContent('#btn-menu-account')) === 'Morgan Vale');
  const tryLogin = (pw) => p.evaluate((pw) => fetch('api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Morgan Vale', password: pw }) }).then((r) => r.status), pw);
  ok('the new password works, the old one does not', (await tryLogin('second password')) === 200 && (await tryLogin('first password')) === 401);
  ok('...and the link works once', await p.evaluate((u) => fetch('api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: decodeURIComponent(u.split('reset=')[1]), password: 'third password' }) }).then((r) => r.status), reset) === 400);

  console.log('\nA new address');
  await accountPane();
  await click('[data-acct="edit"][data-what="email"]');
  await fill('acct-newemail', 'morgan.vale@example.com'); await fill('acct-pass', 'second password');
  await click('[data-acct="email"]');
  t = await till((x) => /link has been sent/i.test(x), 'sent');
  ok('a new address waits for its own link; the old one stays meanwhile', /morgan@example\.com/.test(t));
  const conf = await latest('morgan.vale@example.com', 'confirm-email');
  await p.goto(conf); await wait(1500);
  t = await till((x) => /now morgan\.vale@example\.com/i.test(x), 'confirmed');
  ok('followed, it is the account’s address', /morgan\.vale@example\.com/.test(t));

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
