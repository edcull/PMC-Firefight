/* The unit viewer's weapon editor: what a unit is drawn firing (the style of
   its primary and secondary, how many go at once, a missile's launch, the
   shots' colour, an orb's flight) changed on the bench and seen and heard at
   once. It is an admin's tool, offered only to an admin signed in to the game
   server the viewer is served from — not to another player, and not to a
   viewer opened from a file or a static site. A change is kept on that server
   and every page it serves draws it, the game's as well as the viewer's; Revert
   puts a unit back as the table in rules/data.js has it, and Copy changes gives
   the lines to make a change the table's own. */
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
const RED = '255,110,90';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tabs = (p) => p.evaluate(() => [...document.querySelectorAll('#vctl .vtabs [data-tab]')].map((b) => b.getAttribute('data-tab')));
const src = (p) => p.evaluate(() => document.querySelector('.vesrc').textContent);
const note = (p) => p.evaluate(() => document.querySelector('.vweaponbody .vtgtline').textContent);
// a field changed, and the server's answer waited for
async function pickW(p, field, value) { await p.selectOption('[data-w="' + field + '"]', value); await p.waitForTimeout(250); }

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
    ok('...and fires as the table in data.js has it', await p.evaluate(() => { window.__viewer.pick('aaveh'); return window.__viewer.spec().p === 'missile'; }));
    // a splashing round's own bursts take the army's colour: amber for the mercenaries and the revolt, blue for a Xenotripod
    const splashed = async (key) => {
      await p.evaluate((k) => { window.PMC.WEAPONS[k] = { p: 'smg', splash: true }; window.__viewer.pick(k); window.__viewer.range(8); window.__viewer.fireNow(); }, key);
      let rgbs = [];
      for (let i = 0; i < 30 && !rgbs.length; i++) { await p.waitForTimeout(80); rgbs = await p.evaluate(() => window.__viewer.fxRGB()); }
      return rgbs;
    };
    const pmc = await splashed('regular'), reb = await splashed('rmilitia');
    ok('a splashing round bursts amber for the mercenaries and the revolt, not blue', pmc.indexOf('255,190,90') >= 0 && pmc.indexOf('110,190,255') < 0 &&
      reb.indexOf('255,190,90') >= 0 && reb.indexOf('110,190,255') < 0, pmc.join(' ') + ' | ' + reb.join(' '));
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
    p.on('dialog', (d) => d.accept());
    await p.goto(URL); await p.waitForTimeout(400);
    const got = how ? await p.evaluate((a) => fetch('api/' + a.how, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a.body) }).then((r) => r.status), { how, body }) : 0;
    await p.goto(URL + 'viewer.html'); await p.waitForTimeout(900);
    return { p, ctx, got };
  }
  const nobody = await as(null);
  ok('nobody signed in: no Weapon tab', (await tabs(nobody.p)).indexOf('weapon') < 0);
  const player = await as('register', { name: 'Grunt', password: 'grunt password', email: 'grunt@example.com' });
  ok('a player signed in who is not an admin: no Weapon tab', player.got === 200 && (await tabs(player.p)).indexOf('weapon') < 0, String(player.got));
  const chief = await as('login', { name: 'Chief', password: 'chief password' });
  ok('an admin signed in: the Weapon tab', chief.got === 200 && (await tabs(chief.p)).indexOf('weapon') >= 0, String(chief.got));

  console.log('\n  The admin at the bench');
  const p = chief.p;
  await p.evaluate(() => { window.__viewer.pick('aaveh'); window.__viewer.set('tab', 'weapon'); });
  await p.waitForTimeout(200);
  const before = await src(p);
  ok('the unit’s entry, as the table writes it', /^aaveh: \{ p: 'missile', n: 2, s: 'chain', launch: 'samturret', blast: 'frag' \}$/.test(before), before);
  ok('...with its missiles’ surface-to-air launch, chosen from the table', await p.evaluate(() => document.querySelector('[data-w="launch"]').value === 'samturret' && window.__viewer.spec().launch === 'samturret'));

  await pickW(p, 'p', 'rail');
  await pickW(p, 'n', '4');
  const after = await p.evaluate(() => ({ spec: window.__viewer.spec(), src: document.querySelector('.vesrc').textContent, changed: !!document.querySelector('.vedited') }));
  ok('changing the primary changes what the unit fires', after.spec.p === 'rail' && after.spec.n === 4 && after.spec.s === 'chain', JSON.stringify(after.spec));
  ok('...marked as changed, and its line written out', after.changed && /^aaveh: \{ p: 'rail', n: 4, s: 'chain', launch: 'samturret', blast: 'frag' \}$/.test(after.src), after.src);
  ok('...and saved to the server', /^Saved/.test(await note(p)) &&
    (await fetch(URL + 'api/weapons').then((r) => r.json())).weapons.aaveh.p === 'rail', await note(p));

  await p.evaluate(() => { window.__viewer.range(8); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
  let seen = [];
  for (let i = 0; i < 20 && seen.indexOf('rail') < 0; i++) { await p.waitForTimeout(80); seen = seen.concat(await p.evaluate(() => window.__viewer.fx())); }
  ok('Fire on the tab fires it as changed', seen.indexOf('rail') >= 0, [...new Set(seen)].join(','));

  const lines = await p.evaluate(() => window.__viewer.exportEdits());
  ok('Copy changes gives the lines to make it the table’s own', /aaveh: \{ p: 'rail', n: 4, s: 'chain', launch: 'samturret', blast: 'frag' \},\s+\/\/ Anti-aircraft vehicle/.test(lines), lines);

  // everyone else: a page loaded now draws the change, in the viewer and in the game
  await player.p.reload(); await player.p.waitForTimeout(900);
  ok('another player’s viewer fires it as changed', await player.p.evaluate(() => { window.__viewer.pick('aaveh'); return window.__viewer.spec().p === 'rail'; }));
  await nobody.p.goto(URL); await nobody.p.waitForTimeout(900);
  ok('...and so does the game, for anyone', await nobody.p.evaluate(() => {
    const s = window.PMC.weaponSpec(window.PMC.profile('aaveh')); return s.p === 'rail' && s.n === 4;
  }));

  await pickW(p, 's', '');
  await p.click('[data-w="splash"]'); await p.waitForTimeout(250);
  const s2 = await src(p);
  ok('the secondary can be taken off, and splash set', /^aaveh: \{ p: 'rail', n: 4, splash: true, launch: 'samturret', blast: 'frag' \}$/.test(s2), s2);

  await p.click('.vweaponbody [data-do="wrevert"]'); await p.waitForTimeout(250);
  const back = await p.evaluate(() => ({ spec: window.__viewer.spec(), edits: Object.keys(window.__viewer.edits()) }));
  const kept = (await fetch(URL + 'api/weapons').then((r) => r.json())).weapons;
  ok('Revert puts the table’s own entry back, on the server too', back.spec.p === 'missile' && back.spec.n === 2 && back.spec.s === 'chain' && !back.edits.length && !kept.aaveh, JSON.stringify(back) + ' ' + JSON.stringify(kept));

  await pickW(p, 'p', 'missile');
  ok('choosing what the table already says is no change', await p.evaluate(() => !Object.keys(window.__viewer.edits()).length));

  // the rest of how it is drawn: the launch, the shots' colour, an orb's flight
  await pickW(p, 'launch', '');
  ok('its missiles can be made to fly flat', await p.evaluate(() => window.__viewer.spec().launch === undefined &&
    document.querySelector('.vesrc').textContent === "aaveh: { p: 'missile', n: 2, s: 'chain', blast: 'frag' }"));
  await p.evaluate(() => { window.__viewer.pick('regular'); });
  await p.waitForTimeout(100);
  ok('a rifle team has no missile launch or orbs to choose, but a shot colour', await p.evaluate(() =>
    !document.querySelector('[data-w="launch"]') && !document.querySelector('[data-w="orb"]') && !!document.querySelector('[data-w="glow"]')));
  await pickW(p, 'glow', 'red');
  const red = await p.evaluate(() => ({ spec: window.__viewer.spec(), src: document.querySelector('.vesrc').textContent }));
  ok('...and given red tracers', red.spec.glow === 'red' && /glow: 'red'/.test(red.src), red.src);
  await p.evaluate(() => { window.__viewer.range(8); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
  let rgbs = [];
  for (let i = 0; i < 20 && !rgbs.length; i++) { await p.waitForTimeout(80); rgbs = await p.evaluate(() => window.__viewer.fxRGB()); }
  ok('...which fire red', rgbs.indexOf(RED) >= 0, rgbs.join(' | '));
  await p.evaluate(() => { window.__viewer.pick('xgamma3'); });
  await p.waitForTimeout(100);
  const orb = await p.evaluate(() => ({ has: !!document.querySelector('[data-w="orb"]'), now: (document.querySelector('[data-w="orb"]') || {}).value }));
  ok('an orb launcher team has its orbs’ flight to choose, teleported by default', orb.has && orb.now === '', JSON.stringify(orb));
  await pickW(p, 'orb', 'lob');
  ok('...and they can be lobbed', await p.evaluate(() => window.__viewer.spec().orb === 'lob'));
  await pickW(p, 'blast', 'frag');
  await p.evaluate(() => { window.__viewer.range(8); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
  let blasts = [];
  for (let i = 0; i < 40 && blasts.indexOf('fragburst') < 0; i++) { await p.waitForTimeout(80); blasts = blasts.concat(await p.evaluate(() => window.__viewer.fx())); }
  ok('...and made to go off as a fragmentation blast where they land', blasts.indexOf('fragburst') >= 0 && blasts.indexOf('orbburst') < 0 &&
    /blast: 'frag'/.test(await src(p)), [...new Set(blasts)].join(','));

  // a gun's shells too: the assault gun's, set to burst as frag
  await p.evaluate(() => { window.__viewer.pick('asc'); });
  await p.waitForTimeout(100);
  ok('a gun firing shells has where they land to choose, its usual burst by default', await p.evaluate(() =>
    !!document.querySelector('[data-w="blast"]') && document.querySelector('[data-w="blast"]').value === ''));
  await pickW(p, 'blast', 'frag');
  await p.evaluate(() => { window.__viewer.range(8); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
  let shells = [];
  for (let i = 0; i < 40 && shells.indexOf('fragburst') < 0; i++) { await p.waitForTimeout(80); shells = shells.concat(await p.evaluate(() => window.__viewer.fx())); }
  ok('...and its shells made to go off as fragmentation blasts', shells.indexOf('bolt') >= 0 && shells.indexOf('fragburst') >= 0, [...new Set(shells)].join(','));

  // and a mortar's rounds, up and over, burst as frag as the table has it
  await p.evaluate(() => { window.__viewer.pick('mortarsection'); });
  await p.waitForTimeout(100);
  ok('a mortar has where its rounds land to choose, frag by default', await p.evaluate(() =>
    !!document.querySelector('[data-w="blast"]') && document.querySelector('[data-w="blast"]').value === 'frag'));
  await p.evaluate(() => { window.__viewer.range(14); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
  let mortar = [];
  for (let i = 0; i < 50 && mortar.indexOf('fragburst') < 0; i++) { await p.waitForTimeout(80); mortar = mortar.concat(await p.evaluate(() => window.__viewer.fx())); }
  ok('...and its rounds made to go off as fragmentation blasts', mortar.indexOf('lob') >= 0 && mortar.indexOf('fragburst') >= 0, [...new Set(mortar)].join(','));

  // missiles and rockets: a missile team's birds, and a support vehicle's ripple, frag as the table has them
  for (const [key, style, kind] of [['missile', 'missile', 'missile'], ['impsupport', 'rocket', 'missile']]) {
    await p.evaluate((k) => { window.__viewer.pick(k); }, key);
    await p.waitForTimeout(100);
    const has = await p.evaluate(() => (document.querySelector('[data-w="blast"]') || {}).value === 'frag');
    await p.evaluate(() => { window.__viewer.range(14); document.querySelector('.vweaponbody [data-do="fire"]').click(); });
    let got = [];
    for (let i = 0; i < 60 && got.filter((x) => x === 'fragburst').length < 2; i++) { await p.waitForTimeout(80); got = got.concat(await p.evaluate(() => window.__viewer.fx())); }
    ok('a ' + style + ' unit has where it lands to choose, frag by default, and goes off in fragmentation blasts',
      has && got.indexOf(kind) >= 0 && got.indexOf('fragburst') >= 0, [...new Set(got)].join(','));
  }

  // the server tools: everything both editors decide, downloaded as JSON
  {
    const q = await chief.ctx.newPage();
    q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(URL); await q.waitForTimeout(700);
    await q.evaluate(() => window.PMCAccount.show()); await q.waitForTimeout(300);
    await q.click('[data-acct="admin-open"]');
    await q.waitForSelector('#account [data-acct="admin-dl-weapons"]', { timeout: 5000 });
    const fileOf = async (sel) => {
      const [dl] = await Promise.all([q.waitForEvent('download'), q.click(sel)]);
      return { name: dl.suggestedFilename(), data: JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8')) };
    };
    const w = await fileOf('[data-acct="admin-dl-weapons"]');
    ok('Server tools downloads the weapon animations in full, as JSON', /^pmc-weapons-.*\.json$/.test(w.name) && w.data.kind === 'weapon animations' &&
      Object.keys(w.data.units).length > 100 && w.data.units.asc.entry.blast === 'frag' && w.data.units.asc.changed &&
      w.data.units.asc.default.p === 'shellbig' && w.data.units.veterans.changed === false &&
      JSON.stringify(w.data.units.asc.entry) === '{"p":"shellbig","n":3,"s":"rail","sn":3,"blast":"frag"}' && Object.keys(w.data.changes).length >= 3,
      w.name + ' ' + Object.keys(w.data.units || {}).length + ' units, ' + Object.keys(w.data.changes || {}).length + ' changed');
    const a = await fileOf('[data-acct="admin-dl-arch"]');
    ok('...and the personalities in full', /^pmc-personalities-.*\.json$/.test(a.name) && a.data.kind === 'personalities' &&
      Array.isArray(a.data.personalities) && a.data.personalities.length > 10 && !!a.data.personalities[0].id && typeof a.data.changes === 'object',
      a.name + ' ' + (a.data.personalities || []).length);
    await q.close();
  }

  const n = Object.keys((await fetch(URL + 'api/weapons').then((r) => r.json())).weapons).length;
  await p.click('.vweaponbody [data-do="wrevertall"]'); await p.waitForTimeout(300);
  const none = (await fetch(URL + 'api/weapons').then((r) => r.json())).weapons;
  ok('Revert all puts every changed unit back, once asked', n === 4 && !Object.keys(none).length &&
    await p.evaluate(() => { window.__viewer.pick('regular'); return !window.__viewer.spec().glow; }), n + ' ' + JSON.stringify(none));

  // a save the server will not take is taken back on the bench
  await player.p.reload(); await player.p.waitForTimeout(900);
  await player.p.evaluate(() => window.__viewer.admin(true));
  await player.p.evaluate(() => { window.__viewer.pick('aaveh'); window.__viewer.set('tab', 'weapon'); });
  await pickW(player.p, 'p', 'rail');
  const refused = await player.p.evaluate(() => ({ p: window.__viewer.spec().p, note: document.querySelector('.vweaponbody .vtgtline').textContent }));
  ok('a change the server refuses (not an admin’s) is not kept', refused.p === 'missile' && /^Not saved/.test(refused.note), JSON.stringify(refused));

  await nobody.ctx.close(); await player.ctx.close(); await chief.ctx.close();
  srv.kill();
  await b.close();
  ok('no page errors', !errs.length, errs.join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
