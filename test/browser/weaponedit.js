/* The unit viewer's weapon editor: what a unit is drawn firing (the style of
   its primary and secondary, how many go at once) changed on the bench, seen
   and heard at once, kept in the browser and copied out as lines for the
   weapon table in rules/data.js. It is an admin's tool: offered only to an
   admin signed in to the game server the viewer is served from — not to
   another player, and not to a viewer opened from a file or a static site. */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const { ROOT, tmpData } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const window_RED = '255,110,90';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tabs = (p) => p.evaluate(() => [...document.querySelectorAll('#vctl .vtabs [data-tab]')].map((b) => b.getAttribute('data-tab')));

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];

  console.log('\n  Opened from a file: nobody to ask, no editor');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('file://' + path.join(ROOT, 'viewer.html'));
    await p.waitForTimeout(800);
    ok('the unit has its Stats and Options tabs and no Weapon tab', (await tabs(p)).join(',') === 'stats,opts');

    // the bench as an admin has it (the harness's door in, as the server's answer would open it)
    await p.evaluate(() => { window.__viewer.admin(true); window.__viewer.pick('aaveh'); window.__viewer.set('tab', 'weapon'); });
    await p.waitForTimeout(200);
    ok('as an admin, a Weapon tab', (await tabs(p)).indexOf('weapon') >= 0);
    const before = await p.evaluate(() => ({ spec: window.__viewer.spec(), src: document.querySelector('.vesrc').textContent }));
    ok('...showing the unit’s entry as the table writes it', /^aaveh: \{ p: 'missile', n: 2, s: 'chain', launch: 'samturret' \}$/.test(before.src), before.src);
    ok('...with its missiles’ surface-to-air launch, chosen from the table', await p.evaluate(() => document.querySelector('[data-w="launch"]').value === 'samturret' && window.__viewer.spec().launch === 'samturret'));

    await p.selectOption('[data-w="p"]', 'rail');
    await p.selectOption('[data-w="n"]', '4');
    await p.waitForTimeout(150);
    const after = await p.evaluate(() => ({ spec: window.__viewer.spec(), edits: window.__viewer.edits(), src: document.querySelector('.vesrc').textContent,
      changed: !!document.querySelector('.vedited') }));
    ok('changing the primary changes what the unit fires', after.spec.p === 'rail' && after.spec.n === 4 && after.spec.s === 'chain', JSON.stringify(after.spec));
    ok('...marked as changed, and its line written out', after.changed && /^aaveh: \{ p: 'rail', n: 4, s: 'chain', launch: 'samturret' \}$/.test(after.src), after.src);

    await p.evaluate(() => { window.__viewer.range(8); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
    let seen = [];
    for (let i = 0; i < 20 && seen.indexOf('rail') < 0; i++) { await p.waitForTimeout(80); seen = seen.concat(await p.evaluate(() => window.__viewer.fx())); }
    ok('Fire on the tab fires it as changed', seen.indexOf('rail') >= 0, [...new Set(seen)].join(','));

    const lines = await p.evaluate(() => window.__viewer.exportEdits());
    ok('Copy changes gives the lines to paste into the table', /aaveh: \{ p: 'rail', n: 4, s: 'chain', launch: 'samturret' \},\s+\/\/ Anti-aircraft vehicle/.test(lines), lines);

    await p.reload(); await p.waitForTimeout(800);
    ok('the change is kept in the browser, but not drawn for anyone not an admin', await p.evaluate(() => {
      window.__viewer.pick('aaveh'); return window.__viewer.spec().p === 'missile' && !!JSON.parse(localStorage.getItem('pmc-weapon-edits')).aaveh;
    }));
    await p.evaluate(() => { window.__viewer.admin(true); window.__viewer.pick('aaveh'); window.__viewer.set('tab', 'weapon'); });
    ok('...and back for the admin', await p.evaluate(() => window.__viewer.spec().p === 'rail'));

    await p.selectOption('[data-w="s"]', '');
    await p.click('[data-w="splash"]');
    await p.waitForTimeout(100);
    const s2 = await p.evaluate(() => document.querySelector('.vesrc').textContent);
    ok('the secondary can be taken off, and splash set', /^aaveh: \{ p: 'rail', n: 4, splash: true, launch: 'samturret' \}$/.test(s2), s2);

    await p.click('[data-do="wrevert"]');
    await p.waitForTimeout(100);
    const back = await p.evaluate(() => ({ spec: window.__viewer.spec(), edits: Object.keys(window.__viewer.edits()) }));
    ok('Revert puts the table’s own entry back', back.spec.p === 'missile' && back.spec.n === 2 && back.spec.s === 'chain' && !back.edits.length, JSON.stringify(back));

    await p.selectOption('[data-w="p"]', 'missile');
    await p.waitForTimeout(100);
    ok('choosing what the table already says is no change', await p.evaluate(() => !Object.keys(window.__viewer.edits()).length));

    // the rest of how it is drawn: the launch, the shots' colour, an orb's flight
    await p.selectOption('[data-w="launch"]', '');
    await p.waitForTimeout(100);
    ok('its missiles can be made to fly flat', await p.evaluate(() => window.__viewer.spec().launch === undefined &&
      document.querySelector('.vesrc').textContent === "aaveh: { p: 'missile', n: 2, s: 'chain' }"));
    await p.click('[data-do="wrevert"]');
    await p.evaluate(() => { window.__viewer.pick('regular'); });
    await p.waitForTimeout(100);
    ok('a rifle team has no missile launch or orbs to choose, but a shot colour', await p.evaluate(() =>
      !document.querySelector('[data-w="launch"]') && !document.querySelector('[data-w="orb"]') && !!document.querySelector('[data-w="glow"]')));
    await p.selectOption('[data-w="glow"]', 'red');
    await p.waitForTimeout(100);
    const red = await p.evaluate(() => ({ spec: window.__viewer.spec(), src: document.querySelector('.vesrc').textContent }));
    ok('...and given red tracers', red.spec.glow === 'red' && /glow: 'red'/.test(red.src), red.src);
    await p.evaluate(() => { window.__viewer.range(8); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
    let rgbs = [];
    for (let i = 0; i < 20 && !rgbs.length; i++) { await p.waitForTimeout(80); rgbs = await p.evaluate(() => window.__viewer.fxRGB()); }
    ok('...which fire red', rgbs.indexOf(window_RED) >= 0, rgbs.join(' | '));
    await p.click('[data-do="wrevert"]');
    await p.evaluate(() => { window.__viewer.pick('xgamma3'); });
    await p.waitForTimeout(100);
    const orb = await p.evaluate(() => ({ has: !!document.querySelector('[data-w="orb"]'), now: (document.querySelector('[data-w="orb"]') || {}).value }));
    ok('an orb launcher team has its orbs’ flight to choose, teleported by default', orb.has && orb.now === '', JSON.stringify(orb));
    await p.selectOption('[data-w="orb"]', 'lob');
    await p.waitForTimeout(100);
    ok('...and they can be lobbed', await p.evaluate(() => window.__viewer.spec().orb === 'lob'));
    await p.click('[data-do="wrevert"]');
    await ctx.close();
  }

  console.log('\n  Served by a game server');
  const D = tmpData();
  execFileSync(process.execPath, ['server/admin.js', 'create', 'Chief', 'chief password', 'admin'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: D }), stdio: 'ignore' });
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: D, CAMPAIGNS_DIR: tmpData(), PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch('http://localhost:' + PORT + '/health').then((r) => r.ok).catch(() => false); }
  const URL = 'http://localhost:' + PORT + '/';
  async function as(how, body) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    const got = how ? await p.evaluate((a) => fetch('api/' + a.how, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a.body) }).then((r) => r.status), { how, body }) : 0;
    await p.goto(URL + 'viewer.html'); await p.waitForTimeout(900);
    return { p, ctx, got };
  }
  const nobody = await as(null);
  ok('nobody signed in: no Weapon tab', (await tabs(nobody.p)).indexOf('weapon') < 0);
  await nobody.ctx.close();
  const player = await as('register', { name: 'Grunt', password: 'grunt password', email: 'grunt@example.com' });
  ok('a player signed in who is not an admin: no Weapon tab', player.got === 200 && (await tabs(player.p)).indexOf('weapon') < 0, String(player.got));
  await player.ctx.close();
  const chief = await as('login', { name: 'Chief', password: 'chief password' });
  ok('an admin signed in: the Weapon tab', chief.got === 200 && (await tabs(chief.p)).indexOf('weapon') >= 0, String(chief.got));
  await chief.ctx.close();
  srv.kill();

  await b.close();
  ok('no page errors', !errs.length, errs.join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
