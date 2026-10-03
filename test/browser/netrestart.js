/* An online battle across a server restart (multiplayer plan, phase 5), in two
   browsers as players see it: both sign up, start a game and deploy part-way; the
   server is stopped and started again on the same data; both screens find their
   way back to the same table by themselves — every unit where it was — and the
   battle goes on. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const { ROOT, tmpData, signInLobby } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
const URL = 'http://localhost:' + PORT + '/';
const DATA = tmpData(), CAMPS = tmpData();
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function serve() {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore', env: Object.assign({}, process.env, { DATA_DIR: DATA, CAMPAIGNS_DIR: CAMPS, PORT: String(PORT), BACKUPS: 'off' }) });
  for (let i = 0; i < 60; i++) { await wait(150); if (await fetch(URL + 'health').then((r) => r.ok).catch(() => false)) return srv; }
  throw new Error('the server did not start');
}
function stopped(srv) { return new Promise((r) => { srv.on('exit', r); srv.kill('SIGTERM'); }); }

(async () => {
  let srv = await serve();
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  async function page(name) {
    const p = await (await b.newContext({ viewport: { width: 1200, height: 860 } })).newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.goto(URL); await wait(700);
    await signInLobby(p, name, 'register');
    await p.evaluate(() => { window.__room = null; window.PMCLobby.net().on('game', (m) => { window.__room = m.room; }); });
    return p;
  }
  const p1 = await page('Restart Ash'), p2 = await page('Restart Brann');
  const force = { faction: 'pmc', tactic: '', keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'], colour: 'ochre', name: '' };
  await p1.evaluate((f) => window.PMCLobby.net().send('game.create', { name: 'Restart', settings: { tier: 3, pl: 1, planet: 'desert', scenario: 'meeting', private: true }, force: f }), force);
  await wait(600);
  const code = await p1.evaluate(() => window.__room && window.__room.id);
  await p2.evaluate((c) => window.PMCLobby.net().send('game.join', { id: c }), code);
  await wait(500);
  await p2.evaluate((f) => window.PMCLobby.net().send('game.force', { force: Object.assign({}, f, { colour: 'rose' }) }), force);
  await wait(300);
  for (const p of [p1, p2]) await p.evaluate(() => window.PMCLobby.net().send('game.ready', { ready: true }));
  await wait(400);
  await p1.evaluate(() => window.PMCLobby.net().send('game.start'));
  let on = false;
  for (let i = 0; i < 40 && !on; i++) { await wait(200); on = await p1.evaluate(() => !!(window.PMC_STATE && window.PMC_STATE())) && await p2.evaluate(() => !!(window.PMC_STATE && window.PMC_STATE())); }
  ok('both are at the table', on);
  // both say they are done with their lists, and deploy a while
  for (let k = 0; k < 4; k++) {
    for (const p of [p1, p2]) await p.evaluate(() => {
      const st = window.PMC_STATE(); if (!st || st.phase !== 'deploy') return;
      const me = window.__seats()[0];
      if (st.swapAvail && st.swapAvail[me]) { window.__sendIntent({ k: 'swapopen' }); window.__sendIntent({ k: 'swapdone' }); }
      if (st.deployReady && !st.deployReady[me]) window.__sendIntent({ k: 'deployready' });
      window.__sendIntent({ k: 'autodeploy' });
    });
    await wait(500);
  }
  const where = (p) => p.evaluate(() => window.PMC_STATE().units.map((u) => u.id + '@' + Math.round(u.x * 10) + ',' + Math.round(u.y * 10)).sort().join(' '));
  const before = await where(p1), phase0 = await p1.evaluate(() => window.PMC_STATE().phase);
  // Player 1 says they are ready to begin; Player 2 has not yet
  await p1.evaluate(() => window.__sendIntent({ k: 'start' }));
  await wait(600);
  const ready0 = await p2.evaluate(() => JSON.stringify(window.PMC_STATE().startReady || {}));
  ok('...part of the way through it: Player 1 ready to begin, Player 2 not yet', /"A":true/.test(ready0) && !/"B":true/.test(ready0), phase0 + ' ' + ready0);

  console.log('\nThe server stopped and started again');
  await stopped(srv);
  await wait(500);
  srv = await serve();
  // the screens reconnect by themselves: each is sent the table again
  const back = async (p) => {
    for (let i = 0; i < 80; i++) {
      await wait(250);
      const live = await p.evaluate(() => !!(window.PMCLobby.net() && window.PMCLobby.net().live));
      if (live && (await p.evaluate(() => !!window.PMC_STATE()))) return true;
    }
    return false;
  };
  ok('Player 1 is back at the table by itself', await back(p1));
  ok('Player 2 is back at the table by itself', await back(p2));
  await wait(800);
  ok('every unit where it was, on both screens', (await where(p1)) === before && (await where(p2)) === before);
  ok('...the battle where it was', (await p1.evaluate(() => window.PMC_STATE().phase)) === phase0);
  ok('...Player 1 still ready to begin', /"A":true/.test(await p2.evaluate(() => JSON.stringify(window.PMC_STATE().startReady || {}))));
  // and it goes on: Player 2 is ready too, and the battle begins on both screens
  await p2.evaluate(() => window.__sendIntent({ k: 'start' }));
  let both = false;
  for (let i = 0; i < 30 && !both; i++) { await wait(200); both = (await p1.evaluate(() => window.PMC_STATE().phase)) === 'battle' && (await p2.evaluate(() => window.PMC_STATE().phase)) === 'battle'; }
  ok('the battle goes on from there: Player 2 ready too, and it begins on both screens', both);

  // the battle is in the main menu's Continue list, as one online
  await p2.evaluate(() => window.PMCMenu.refresh());
  let listed = false;
  for (let i = 0; i < 20 && !listed; i++) { await wait(150); listed = await p2.evaluate((c) => window.PMCMenu.games().some((g) => g.key === 'live' && g.kind === 'Online battle' && g.where === 'server'), code); }
  ok('the battle is first in the Continue list, as the one on the table, kept on the server', listed);

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
