/* A cooperative game over the network, in two browsers: both sign up, one starts a
   cooperative game and the other takes the second seat; the battle begins with both
   players' commandos on one side against the OpFor, each screen in charge of its
   own player's units, and only on its own go. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const { ROOT, tmpData, signInLobby } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
const URL = 'http://localhost:' + PORT + '/';
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore', env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT), BACKUPS: 'off' }) });
  for (let i = 0; i < 60; i++) { await wait(150); if (await fetch(URL + 'health').then((r) => r.ok).catch(() => false)) break; }
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  async function page(name) {
    const p = await (await b.newContext({ viewport: { width: 1200, height: 860 } })).newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.goto(URL); await wait(700);
    await signInLobby(p, name, 'register');
    return p;
  }
  const p1 = await page('Coop Ash'), p2 = await page('Coop Brann');

  console.log('\nStarted from Start a game');
  await p1.evaluate(() => document.querySelector('#lobby [data-lob="create"]').click());
  await wait(200);
  const offered = await p1.evaluate(() => { const o = document.querySelector('#lob-kind option[value="coop"]'); return o && !o.disabled ? o.textContent : ''; });
  ok('Start a game offers a cooperative game', /Cooperative/.test(offered), offered);
  await p1.evaluate(() => { const s = document.getElementById('lob-kind'); s.value = 'coop'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#lobby [data-lob="create"][data-go]').click(); });
  await wait(700);
  const room = await p1.evaluate(() => ({ code: document.getElementById('lobby-code').textContent, terms: !!document.getElementById('term-soloScen') && !!document.getElementById('term-opFaction') && !document.getElementById('term-pl') }));
  ok('its room has a cooperative game’s terms: a solitaire scenario and the OpFor, no Priority Level', room.terms && !!room.code, JSON.stringify(room));
  await p2.evaluate((c) => window.PMCLobby.net().send('game.join', { id: c }), room.code);
  await wait(600);
  for (const p of [p1, p2]) await p.evaluate(() => window.PMCLobby.net().send('game.ready', { ready: true }));
  await wait(400);
  await p1.evaluate(() => window.PMCLobby.net().send('game.start'));
  let on = false;
  for (let i = 0; i < 40 && !on; i++) { await wait(250); on = await p1.evaluate(() => !!(window.PMC_STATE && window.PMC_STATE())) && await p2.evaluate(() => !!(window.PMC_STATE && window.PMC_STATE())); }
  ok('both are at the table', on);
  const st = await p2.evaluate(() => { const s = window.PMC_STATE(); return { coop: !!(s.solo && s.solo.coop), net: !!s.cfg.netCoop, own1: s.units.filter((u) => u.side === 'A' && u.owner === 1).length, own2: s.units.filter((u) => u.side === 'A' && u.owner === 2).length, foe: s.units.filter((u) => u.side === 'B').length }; });
  ok('one side of both players’ commandos, against the OpFor', st.coop && st.net && st.own1 > 0 && st.own2 > 0 && st.foe > 0, JSON.stringify(st));

  console.log('\nEach their own');
  // into the battle: every unit put down, the battle begun
  for (let k = 0; k < 8; k++) {
    for (const p of [p1, p2]) await p.evaluate(() => {
      const s = window.PMC_STATE(); if (!s || s.phase === 'battle') return;
      if (s.tacticAsk) window.__sendIntent({ k: 'tactic', tactic: '' });
      window.__sendIntent({ k: 'autodeploy' });
      window.__sendIntent({ k: 'start' });
    });
    await wait(500);
    if (await p1.evaluate(() => window.PMC_STATE().phase === 'battle')) break;
  }
  let turn = null;
  for (let i = 0; i < 60; i++) {
    await wait(250);
    turn = await p1.evaluate(() => { const s = window.PMC_STATE(); return s.phase === 'battle' && s.activeSide === 'A' && s.activeOwner ? s.activeOwner : null; });
    if (turn) break;
  }
  ok('the battle comes to the players’ turn', !!turn, String(turn));
  if (turn) {
    // what has happened is drawn first: nobody acts while it is
    for (let i = 0; i < 160 && !(await p1.evaluate(() => !window.__busy())); i++) await wait(250);
    const mine = await p1.evaluate(() => window.__mySide()), theirs = await p2.evaluate(() => window.__mySide());
    const goer = turn === 1 ? mine : theirs, waiter = turn === 1 ? theirs : mine;
    ok('only the player whose go it is may act: their screen is in charge, the other waits', goer === 'A' && waiter === null, 'P' + turn + ' go: ' + mine + ' / ' + theirs);
  }

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
