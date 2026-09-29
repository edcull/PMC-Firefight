/* Two browsers at one game server, a battle between them: each screen says
   whose turn it is from its own seat, forces left unnamed are named for their
   seat, the other player dropping out and coming back is said on the board,
   and abandoning from the menu ends the battle for both. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { ROOT } = require('../where.js');
const PORT = 9300 + Math.floor(Math.random() * 400);

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await wait(150);
    up = await fetch('http://localhost:' + PORT + '/health').then(r => r.ok).catch(() => false);
  }
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const ctx1 = await b.newContext({ viewport: { width: 1340, height: 900 } });
  let ctx2 = await b.newContext({ viewport: { width: 1340, height: 900 } });
  async function page(ctx) {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:' + PORT + '/');
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      window.PMCLobby.open();
      window.__room = null;
      window.PMCLobby.net().on('game', m => { window.__room = m.room; });
    });
    await p.waitForTimeout(500);
    return p;
  }
  const force = { faction: 'pmc', tactic: '', keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'], colour: 'ochre', name: '' };
  const p1 = await page(ctx1);
  let p2 = await page(ctx2);
  await p1.evaluate((f) => window.PMCLobby.net().send('game.create', { name: 'Test', settings: { tier: 3, pl: 1, planet: 'desert', scenario: 'meeting', private: false }, force: f }), force);
  await p1.waitForTimeout(600);
  const code = await p1.evaluate(() => window.__room && window.__room.id);
  await p2.evaluate((c) => window.PMCLobby.net().send('game.join', { id: c }), code);
  await p2.waitForTimeout(600);
  await p2.evaluate((f) => window.PMCLobby.net().send('game.force', { force: Object.assign({}, f, { colour: 'rose' }) }), force);
  await p2.waitForTimeout(300);
  for (const p of [p1, p2]) await p.evaluate(() => window.PMCLobby.net().send('game.ready', { ready: true }));
  await p1.waitForTimeout(400);
  await p1.evaluate(() => window.PMCLobby.net().send('game.start'));
  await p1.waitForTimeout(2000);
  // both deploy and begin
  for (let k = 0; k < 14; k++) {
    for (const p of [p1, p2]) await p.evaluate(() => {
      const st = window.PMC_STATE(); if (!st || st.phase === 'battle') return;
      const me = window.__seats()[0];
      if (st.deployReady && !st.deployReady[me]) window.__sendIntent({ k: 'deployready' });
      window.__sendIntent({ k: 'autosplit' }); window.__sendIntent({ k: 'autodeploy' }); window.__sendIntent({ k: 'start' });
    });
    await wait(400);
    if (await p1.evaluate(() => window.PMC_STATE() && window.PMC_STATE().phase === 'battle')) break;
  }
  await wait(1200);
  const look = (p) => p.evaluate(() => ({
    seat: window.__seats()[0], active: window.PMC_STATE().activeSide, pill: document.getElementById('hdr-active').textContent,
    names: [window.PMC_STATE().cfg.nameA, window.PMC_STATE().cfg.nameB]
  }));
  const s1 = await look(p1), s2 = await look(p2);
  ok('the battle is on for both', s1.active && s2.active, JSON.stringify([s1.active, s2.active]));
  const mine = s1.active === s1.seat ? s1 : s2, theirs = mine === s1 ? s2 : s1;
  ok('the screen whose go it is says so', mine.pill === 'Your turn', mine.pill);
  ok('...and the other says whose it is, by name', /Player [12] Force’s turn/.test(theirs.pill), theirs.pill);
  ok('forces left unnamed are named for their seats', s1.names[0] === 'Player 1 Force' && s1.names[1] === 'Player 2 Force', s1.names.join(' / '));

  // the second player's browser goes away, then comes back
  const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent));
  await ctx2.close();
  await wait(1200);
  const dropped = await toasts(p1);
  ok('the other player dropping out is said on the board', dropped.some(t => /lost connection/.test(t)), dropped.join(' | ') || 'no toast');
  ctx2 = await b.newContext({ viewport: { width: 1340, height: 900 } });
  // the same browser, as far as the server knows: the player id is kept in storage
  const id2 = await p1.evaluate(() => window.__room && window.__room.seats.B && window.__room.seats.B.id);
  await ctx2.addInitScript((id) => { try { localStorage.setItem('pmc-player-id', id); } catch (e) { } }, id2);
  p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('http://localhost:' + PORT + '/');
  await p2.waitForTimeout(700);
  await p2.evaluate(() => window.PMCLobby.open());
  await wait(1800);
  const back = await toasts(p1);
  ok('...and coming back', back.some(t => /is back/.test(t)), back.join(' | ') || 'no toast');

  // the first player abandons it from the menu, asked twice
  await p1.evaluate(() => window.PMCMenu.open());
  await p1.waitForTimeout(300);
  const x = await p1.evaluate(() => { const d = document.getElementById('btn-discard'); return { shown: !d.hidden, label: d.getAttribute('aria-label') }; });
  ok('the menu offers to abandon the battle', x.shown && /Abandon/.test(x.label), JSON.stringify(x));
  await p1.click('#btn-discard');
  const asked = await p1.evaluate(() => document.getElementById('btn-discard').textContent + ' / ' + document.getElementById('menu-resume-sub').textContent);
  ok('...asking once more first', /Abandon\?/.test(asked) && /opponent/.test(asked), asked);
  await p1.click('#btn-discard');
  await wait(1200);
  const gone1 = await p1.evaluate(() => ({ live: window.PMC_BATTLE_LIVE(), resume: !document.getElementById('btn-resume').hidden }));
  ok('abandoned, the battle is gone from this screen', !gone1.live && !gone1.resume, JSON.stringify(gone1));
  const left = await toasts(p2);
  const gone2 = await p2.evaluate(() => window.PMC_BATTLE_LIVE());
  ok('the other player is told it is over', left.some(t => /has left the battle/.test(t)), left.join(' | ') || 'no toast');
  ok('...and their board lets it go', !gone2);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
