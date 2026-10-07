/* The force builder (main menu): a skirmish force built for a Battle Tier and
   Priority Level and saved, then loaded when a skirmish is mustered; and a
   campaign's starting company, built with its doctrine and saved, then loaded
   on the founding sheet of a new campaign. Kept in the browser when nobody is
   signed in, and on the account when they are: built on one device, there to
   load on another. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const { ROOT, tmpData } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const START = ['rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rmilitia', 'rmilitia'];

// the skirmish force builder: a legal force at Tier II, named and saved
async function buildSkirmish(p, name) {
  await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('builder'); });
  await p.click('[data-build="skirmish"]');
  await p.waitForTimeout(300);
  await p.evaluate((nm) => {
    window.__forces.apply({ name: nm, faction: 'pmc', tier: 2, pl: 1, keys: window.PMC.rollArmy(2, 1, null, 'pmc') });
    document.getElementById('hot-name').value = nm;
  }, name);
  await p.click('#btn-start');
  await p.waitForTimeout(700);
  return p.evaluate(() => document.getElementById('faults').textContent);
}
// the start force builder: rebels, six Tier I and two Tier II, a Path, named and saved
async function buildStart(p, name) {
  await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('builder'); });
  await p.click('[data-build="start"]');
  await p.waitForTimeout(300);
  await p.click('[data-buildfaction="rebel"]');
  await p.click('[data-go="fmodal"][data-kind="units"]');
  for (const k of START) await p.click('#found-cat [data-add="' + k + '"]');
  await p.evaluate(() => document.querySelector('[data-go="fmodalclose"]').click());
  await p.click('[data-go="fmodal"][data-kind="doctrine"]');
  await p.click('[data-doc="H1"]');
  await p.evaluate(() => { const x = document.querySelector('[data-go="fmodalclose"]'); if (x) x.click(); });
  await p.fill('#found-name', name);
  await p.waitForTimeout(150);
  await p.click('#found-sign');
  await p.waitForTimeout(700);
  const note = await p.evaluate(() => (document.getElementById('camp-ask') || {}).textContent || '');
  await p.evaluate(() => { const b = document.querySelector('#camp-ask button'); if (b) b.click(); });
  return note;
}
// a new rebel campaign's founding sheet, and the start forces it offers to load
async function foundingLoadList(p) {
  await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('single'); });
  await p.click('[data-camp="solo"]');
  await p.waitForTimeout(400);
  await p.evaluate(() => { const s = document.getElementById('camp-faction'); s.value = 'rebel'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('[data-go="newcamp"]').click());
  await p.waitForTimeout(400);
  await p.click('[data-go="fmodal"][data-kind="fload"]');
  await p.waitForTimeout(300);
  return p.evaluate(() => [...document.querySelectorAll('[data-fload]')].map((x) => x.textContent));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];

  console.log('\n  In a browser on its own (nobody signed in)');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    await p.waitForTimeout(600);
    const menu = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('#menu-main .mcard')].map((x) => x.id || x.getAttribute('data-menu'));
      return { builder: cards.indexOf('builder'), viewer: cards.indexOf('lnk-viewer') };
    });
    ok('the main menu has a Force builder, just above the unit viewer', menu.builder >= 0 && menu.builder === menu.viewer - 1, JSON.stringify(menu));

    await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('builder'); });
    await p.click('[data-build="skirmish"]');
    await p.waitForTimeout(300);
    const sk = await p.evaluate(() => ({ title: document.getElementById('setup-title').textContent, btn: document.getElementById('btn-start').textContent,
      tier: !document.getElementById('sel-tier').disabled && !document.getElementById('sel-pl').disabled }));
    ok('Skirmish force opens the muster sheet to build one, its Tier and Priority Level to set, and Save force', /Force builder/.test(sk.title) && sk.btn === 'Save force' && sk.tier, JSON.stringify(sk));
    await p.evaluate(() => { window.__forces.apply({ name: 'Too Big', faction: 'pmc', tier: 1, pl: 1, keys: window.PMC.rollArmy(3, 2, null, 'pmc') }); document.getElementById('sel-tier').value = '1'; document.getElementById('hot-name').value = 'Too Big'; });
    await p.click('#btn-start');
    await p.waitForTimeout(200);
    const refused = await p.evaluate(() => ({ note: document.getElementById('faults').textContent, kept: localStorage.getItem('pmc-forces') }));
    ok('...a force that is not legal is not saved, and says why', /not legal/.test(refused.note) && !refused.kept, refused.note);
    await p.evaluate(() => document.getElementById('btn-setup-back').click());
    const saved = await buildSkirmish(p, 'Iron Line');
    ok('...a legal one is saved in this browser', /Saved .Iron Line. in this browser/.test(saved), saved);
    await p.evaluate(() => document.getElementById('btn-setup-back').click());
    await p.waitForTimeout(200);
    ok('...and Back goes to the force builder', await p.evaluate(() => !document.getElementById('menu').hidden && !document.getElementById('menu-builder').hidden));

    await p.evaluate(() => { window.PMCMenu.show('single'); });
    await p.click('[data-skirmish="ai"]');
    await p.waitForTimeout(400);
    const opts = await p.evaluate(() => [...document.getElementById('sel-force').options].map((o) => o.textContent));
    ok('mustering a skirmish, it is among the saved forces to load', opts.some((t) => /Iron Line — II\/1/.test(t)), opts.join(' | '));

    const note = await buildStart(p, 'The Free Hills');
    const kept = await p.evaluate(() => ({ starts: JSON.parse(localStorage.getItem('pmc-startforces') || '[]'), camps: Object.keys(localStorage).filter((k) => /camp/i.test(k)) }));
    ok('Campaign start force: built on the founding sheet with its kind of force and doctrine, and saved', /Start force saved/.test(note) &&
      kept.starts.length === 1 && kept.starts[0].faction === 'rebel' && kept.starts[0].doctrine === 'H1' && kept.starts[0].keys.length === 8, note);
    ok('...without a campaign being made', !kept.camps.length, kept.camps.join(','));
    await p.evaluate(() => document.querySelector('[data-go="foundback"]').click());
    await p.waitForTimeout(200);

    const offered = await foundingLoadList(p);
    ok('a new campaign’s founding sheet offers it to load', offered.some((t) => /The Free Hills/.test(t) && /H|Viva/.test(t)), offered.join(' | '));
    await p.evaluate(() => document.querySelector('[data-fload]').click());
    await p.waitForTimeout(300);
    const loaded = await p.evaluate(() => ({ name: document.getElementById('found-name').value, head: document.querySelector('.found-units .pts').textContent,
      ready: document.getElementById('found-sign').getAttribute('aria-disabled') === 'false' }));
    ok('...loading it fills the units, the doctrine and the name, ready to sign', loaded.name === 'The Free Hills' && /6\/6 Tier I · 2\/2 Tier II/.test(loaded.head) && loaded.ready, JSON.stringify(loaded));
    await p.click('#found-sign');
    await p.waitForTimeout(600);
    ok('...and the campaign is founded from it', await p.evaluate(() => window.PMCCamp && document.getElementById('camp-title').textContent !== '' && !document.getElementById('found-sign')));
    await ctx.close();
  }

  console.log('\n  Signed in to a game server: kept on the account');
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch('http://localhost:' + PORT + '/health').then((r) => r.ok).catch(() => false); }
  const URL = 'http://localhost:' + PORT + '/';
  async function device(how) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    const got = await p.evaluate((h) => fetch('api/' + h, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Builder', password: 'builder password', email: 'builder@example.com' }) }).then((r) => r.status), how);
    await p.reload(); await p.waitForTimeout(1000);
    return { p, ctx, got };
  }
  const d1 = await device('register');
  ok('signed up on the first device', d1.got === 200);
  const where = await d1.p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('main'); document.querySelector('[data-menu="builder"]').click(); return document.getElementById('menu-builder-where').textContent; });
  ok('the force builder says forces are kept on the account', /on your account/.test(where), where);
  const s1 = await buildSkirmish(d1.p, 'Account Line');
  await d1.p.evaluate(() => document.getElementById('btn-setup-back').click());
  const s2 = await buildStart(d1.p, 'Account Hills');
  const onServer = await d1.p.evaluate(() => fetch('api/forces').then((r) => r.json()).then((j) => j.forces.map((f) => f.kind + ':' + f.name)));
  ok('a skirmish force and a start force are saved to the account', /on your account/.test(s1) && /on your account/.test(s2) &&
    onServer.indexOf('skirmish:Account Line') >= 0 && onServer.indexOf('start:Account Hills') >= 0, s1 + ' / ' + s2 + ' / ' + onServer.join(','));
  ok('...and not in that browser', await d1.p.evaluate(() => !localStorage.getItem('pmc-forces') && !localStorage.getItem('pmc-startforces')));
  await d1.p.evaluate(() => document.querySelector('[data-go="foundback"]').click());

  const d2 = await device('login');
  ok('signed in on a second device', d2.got === 200);
  await d2.p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('single'); });
  await d2.p.click('[data-skirmish="ai"]');
  await d2.p.waitForTimeout(800);
  const opts2 = await d2.p.evaluate(() => {
    const sel = document.getElementById('sel-force');
    const g = sel.querySelector('optgroup[label="On your account"]');
    return { acct: g ? [...g.querySelectorAll('option')].map((o) => o.textContent + '=' + o.value) : [] };
  });
  ok('mustering a skirmish there, the account’s force is among the saved forces', opts2.acct.some((t) => /Account Line/.test(t)), JSON.stringify(opts2));
  const applied = await d2.p.evaluate(() => {
    const sel = document.getElementById('sel-force');
    const o = [...sel.options].find((x) => /Account Line/.test(x.textContent));
    sel.value = o.value; sel.dispatchEvent(new Event('change'));
    return { n: window.__forces.muster().length, tier: document.getElementById('sel-tier').value, note: window.__forces.note() };
  });
  ok('...and loads into the muster', applied.n > 0 && applied.tier === '2' && /Loaded/.test(applied.note), JSON.stringify(applied));
  await d2.p.evaluate(() => document.getElementById('btn-setup-back').click());
  const offered2 = await foundingLoadList(d2.p);
  ok('a new campaign there offers the account’s start force to load', offered2.some((t) => /Account Hills/.test(t) && /on your account/.test(t)), offered2.join(' | '));

  await b.close();
  srv.kill();
  ok('no page errors', !errs.length, errs.join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
