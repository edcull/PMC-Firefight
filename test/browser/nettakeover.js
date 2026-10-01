/* Hostile takeover over the network: while the defender digs in, the
   attacker's screen says so (no fortification buttons, no prompt to tap the
   table) and goes on by itself once the defender is done. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { ROOT, SHOTS } = require('../where.js');
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
  // a Light APC in each, so a unit can be aboard one
  const force = { faction: 'pmc', tactic: '', keys: ['cmd2', 'regular', 'regular', 'lapc', 'rookie', 'rookie'], colour: 'ochre', name: '' };
  const p1 = await page(ctx1);
  const p2 = await page(ctx2);
  await p1.evaluate((f) => window.PMCLobby.net().send('game.create', { name: 'Takeover', settings: { tier: 3, pl: 1, planet: 'barren', scenario: 'takeover', terrain: 'manual', private: true }, force: f }), force);
  await p1.waitForTimeout(600);
  const code = await p1.evaluate(() => window.__room && window.__room.id);
  await p2.evaluate((c) => window.PMCLobby.net().send('game.join', { id: c }), code);
  await p2.waitForTimeout(600);
  await p2.evaluate((f) => window.PMCLobby.net().send('game.force', { force: Object.assign({}, f, { colour: 'rose' }) }), force);
  await p2.waitForTimeout(300);
  for (const p of [p1, p2]) await p.evaluate(() => window.PMCLobby.net().send('game.ready', { ready: true }));
  await p1.waitForTimeout(400);
  await p1.evaluate(() => window.PMCLobby.net().send('game.start'));
  // the briefing, and the terrain cards, out of the way
  let pa = null;
  for (let k = 0; k < 30 && !pa; k++) {
    await wait(300);
    for (const p of [p1, p2]) await p.evaluate(() => { const d = document.getElementById('obj-done'); if (d && d.offsetParent) d.click(); });
    // the table is laid by hand: whoever is rolling has the rest placed, and the fortifications stay the defender's
    for (const p of [p1, p2]) await p.evaluate(() => { const s = window.PMC_STATE(); if (s && s.phase === 'terrain' && window.__terrainAct) window.__terrainAct('tautoall'); });
    pa = await p1.evaluate(() => { const s = window.PMC_STATE(); return s && s.placeAsk ? { side: s.placeAsk.side, why: s.placeAsk.why } : null; });
  }
  ok('the defender is asked to dig in', pa && pa.why === 'takeover', JSON.stringify(pa));
  const seatOf = (p) => p.evaluate(() => window.__seats()[0]);
  const def = (await seatOf(p1)) === pa.side ? p1 : p2, att = def === p1 ? p2 : p1;
  await wait(800);
  const look = (p) => p.evaluate(() => ({
    card: document.getElementById('context').textContent,
    buttons: !!document.querySelector('#context [data-act="placeauto"]'),
    hint: document.getElementById('hintbar').textContent,
    pill: document.getElementById('hdr-active').textContent
  }));
  const a = await look(att), d = await look(def);
  await att.screenshot({ path: require('path').join(SHOTS, 'takeover-attacker.png') }).catch(() => {});
  ok('the attacker is told the defender is setting up', /Setting up/.test(a.card) && /digging in/.test(a.card), a.card.slice(0, 120));
  ok('...with no fortifications to place and no prompt to tap the table', !a.buttons && !/tap the table/.test(a.hint), a.hint);
  ok('...and the header says whose set-up it is', /^Setting up: /.test(a.pill), a.pill);
  ok('the defender has the fortifications to place', d.buttons, d.card.slice(0, 80));
  // a tap on the attacker's table puts nothing down
  const before = await def.evaluate(() => window.PMC_STATE().placeAsk.left);
  const bx = await att.evaluate(() => { const c = document.getElementById('board').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
  await att.mouse.click(bx.x, bx.y);
  await wait(400);
  ok('...a tap on the attacker\'s table places nothing', (await def.evaluate(() => window.PMC_STATE().placeAsk && window.PMC_STATE().placeAsk.left)) === before);
  await def.evaluate(() => document.querySelector('#context [data-act="placeauto"]').click());
  let gone = false;
  for (let k = 0; k < 20 && !gone; k++) { await wait(300); gone = await att.evaluate(() => !window.PMC_STATE().placeAsk && !/Setting up/.test(document.getElementById('context').textContent)); }
  ok('once the defender is done, the attacker goes on by itself', gone,
    await att.evaluate(() => document.getElementById('context').textContent.slice(0, 80)));

  // on to the deployment: each goes on from Before deploying, then one side deploys while the other watches
  for (const p of [p1, p2]) await p.evaluate(() => { if (window.PMC_STATE().deployReady) window.__sendIntent({ k: 'deployready' }); });
  let ps = null;
  for (let k = 0; k < 20 && !ps; k++) { await wait(300); ps = await p1.evaluate(() => { const s = window.PMC_STATE(); return !s.deployReady && s.phase === 'deploy' ? window.__placingSide() : null; }); }
  const placer = (await seatOf(p1)) === ps ? p1 : p2, watcher = placer === p1 ? p2 : p1;
  await wait(600);
  /* The attacker places nothing before the battle (p. 55): its screen shows the
     defender setting up — their card, first — and under it its own entry to sort. */
  const w = await watcher.evaluate(() => ({
    card: document.querySelector('#context .card').textContent,
    auto: !!document.querySelector('#context .card:first-child [data-act="autodeploy"]'),
    list: !!document.querySelector('#context [data-deploy]'),
    entry: /Entering the table/.test(document.getElementById('context').textContent),
    theirs: [...document.querySelectorAll('#context .card:first-child .dpr-view')].map(r => r.textContent),
    stats: (document.getElementById('statstrip-side') || {}).textContent || ''
  }));
  const pl = await placer.evaluate(() => !!document.querySelector('#context [data-act="autodeploy"]'));
  await watcher.screenshot({ path: require('path').join(SHOTS, 'deploy-watcher.png') }).catch(() => {});
  ok('while the other side deploys, this screen says so', /is deploying/.test(w.card), w.card.slice(0, 100));
  ok('...with none of their controls (auto-deploy, picking a unit to place) and no prompt to pick one', !w.auto && !w.list && !/No unit selected/.test(w.stats), JSON.stringify(w));
  ok('...while the side deploying has its own card', pl);
  ok('...and the attacker, entering in turn 1, sorts its own entry meanwhile', w.entry);
  ok('...but their units are listed, to look at: which are still to deploy, held back or aboard', w.theirs.length === 6 && w.theirs.every(t => /to deploy|on the table|in reserve|second wave|aboard|insertion/.test(t)), w.theirs.join(' | '));
  // the one deploying puts a rookie aboard the APC and splits off its reserves: the other screen shows it
  await placer.evaluate(() => {
    const s = window.PMC_STATE(), me = window.__seats()[0];
    const hull = s.units.find(u => u.side === me && u.key === 'lapc'), rk = s.units.find(u => u.side === me && u.key === 'rookie');
    window.__sendIntent({ k: 'autosplit' });
    if (hull && rk) window.__sendIntent({ k: 'load', hull: hull.id, unit: rk.id });
  });
  await wait(800);
  const rows = await watcher.evaluate(() => [...document.querySelectorAll('#context .card:first-child .dpr-view .dpr-note')].map(n => n.textContent));
  ok('...and who is aboard what, as it is set', rows.some(t => /^aboard /.test(t)), rows.join(' | '));
  await watcher.screenshot({ path: require('path').join(SHOTS, 'deploy-watcher.png') }).catch(() => {});
  await watcher.setViewportSize({ width: 390, height: 844 });
  await watcher.evaluate(() => window.__setMTab('act'));
  await wait(500);
  await watcher.evaluate(() => { const c = document.getElementById('context'); c.scrollTop = 0; });
  await watcher.screenshot({ path: require('path').join(SHOTS, 'deploy-watcher-phone.png') }).catch(() => {});
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
