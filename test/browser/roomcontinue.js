/* A game made over the network and not started yet is still a game under way:
   after a refresh the main menu's Continue list has it (in its room, its code),
   and picking it walks back into the seat held for it. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { ROOT, tmpData } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++; console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (note ? '  — ' + note : '')); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch('http://localhost:' + PORT + '/health').then((r) => r.ok).catch(() => false); }
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 420, height: 860 } })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(400);
    await p.evaluate(() => fetch('api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Roomer', password: 'secret123', email: 'roomer@example.com' }) }));
    await p.reload(); await p.waitForTimeout(800);

    console.log('\nA room made, then a refresh');
    await p.evaluate(() => document.getElementById('btn-multi').click()); await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelector('[data-lob="create"]').click()); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('[data-lob="create"][data-go="1"]').click()); await p.waitForTimeout(800);
    const code = await p.evaluate(() => (document.querySelector('.lob-code, #lobby-code') || {}).textContent || '');
    ok('a skirmish room is open, with its code', /^[A-Z0-9]{4,}$/.test(code.trim()), code);
    await p.reload(); await p.waitForTimeout(1500);

    const card = await p.evaluate(() => { const c = document.getElementById('btn-continue'); return c && !c.hidden ? c.textContent : ''; });
    ok('the main menu has a Continue card for it', /Online skirmish/.test(card), card);
    await p.evaluate(() => document.getElementById('btn-continue').click()); await p.waitForTimeout(300);
    const row = await p.evaluate((c) => {
      const b = [...document.querySelectorAll('#cont-list [data-cont]')].find((x) => x.getAttribute('data-cont') === 'r:' + c);
      return b ? b.textContent : '';
    }, code.trim());
    ok('...and the list has it: in its room, waiting for a player, with its code', /in its room/.test(row) && /waiting for a player/.test(row) && row.indexOf(code.trim()) >= 0, row);

    await p.evaluate((c) => document.querySelector('#cont-list [data-cont="r:' + c + '"]').click(), code.trim()); await p.waitForTimeout(1200);
    const back = await p.evaluate(() => ({
      lobby: !document.getElementById('lobby').hidden,
      code: ((document.querySelector('.lob-code, #lobby-code') || {}).textContent || '').trim(),
      seat: !!document.querySelector('[data-lob="ready"]')
    }));
    ok('picking it walks back into the room, in its seat', back.lobby && back.code === code.trim() && back.seat, JSON.stringify(back));

    console.log('\nLeft for good');
    await p.evaluate(() => document.querySelector('[data-lob="leave"]').click()); await p.waitForTimeout(600);
    await p.evaluate(() => window.PMCMenu.open()); await p.waitForTimeout(1200);
    const gone = await p.evaluate((c) => { window.PMCMenu.show('continue'); return ![...document.querySelectorAll('#cont-list [data-cont]')].some((x) => x.getAttribute('data-cont') === 'r:' + c); }, code.trim());
    ok('a room left is no longer in the list', gone);
  } catch (e) {
    fail++; console.log('  ✗ ' + ((e && e.message) || e));
  } finally {
    await b.close();
    srv.kill();
  }
  ok('no page errors', !errs.length, errs.join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
