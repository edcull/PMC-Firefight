/* The admin's personality editor (net/archedit.js), from their Server tools: a
   personality picked, its tier preference and a weight changed in the form, a
   preview rolled with the change in force (nothing saved), then saved — the
   server keeps it, and a page loaded afresh lays it over its own — and reset. */
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
  execFileSync(process.execPath, ['server/admin.js', 'create', 'Boss', 'boss password', 'admin', 'boss@example.com'], { cwd: ROOT, env: env, stdio: 'pipe' });
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore', env: env });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch(URL + 'health').then((r) => r.ok).catch(() => false); }
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const click = (sel) => p.evaluate((s) => document.querySelector('#account ' + s).click(), sel);
  const has = (sel) => p.evaluate((s) => !!document.querySelector('#account ' + s), sel);
  async function till(fn, what) {
    for (let i = 0; i < 80; i++) { if (await p.evaluate(fn)) return true; await wait(100); }
    throw new Error('waited for ' + what);
  }

  try {
    await p.goto(URL); await wait(1000);
    await p.evaluate(() => fetch('api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'boss@example.com', password: 'boss password' }) }));
    await p.reload(); await wait(1200);
    await p.evaluate(() => window.PMCAccount.show()); await wait(400);
    await click('[data-acct="admin-open"]');
    await till(() => !!document.querySelector('#account [data-acct="admin-arch"]'), 'the Personalities section');
    ok('the Server tools have a Personalities section', true);
    await click('[data-acct="admin-arch"]');
    await till(() => !!document.querySelector('#arch-edit .ae select[data-ae="pick"]'), 'the editor');
    ok('the editor opens on Bastion, its default', await p.evaluate(() => document.querySelector('#arch-edit [data-ae="pick"]').value === 'armour' && /default/.test(document.querySelector('#arch-edit .ae-tag').textContent)));
    ok('...with its weighted list in the form', await has('#arch-edit input[data-ae-w="bats"]') && await p.evaluate(() => document.querySelector('#arch-edit input[data-ae-w="bats"]').value === '10'));

    console.log('\nPreview, not saved');
    await p.selectOption('#arch-edit [data-ae-f="tier"]', '-1');
    await p.fill('#arch-edit input[data-ae-w="sam"]', '0');
    await click('#arch-edit [data-ae="preview"]');
    await till(() => /Over 100 forces/.test(document.querySelector('#arch-edit').innerText), 'the preview');
    const prev = await p.evaluate(() => document.querySelector('#arch-edit').innerText);
    ok('a preview rolls forces and sums them up', /units/.test(prev) && /Tier below\/own\/above/.test(prev) && /In forces:/.test(prev), prev.slice(prev.indexOf('Over 100'), prev.indexOf('Over 100') + 160));
    ok('...without changing the personality in force', await p.evaluate(() => window.PMCCamp.archetype('armour').tier === 0));
    ok('...and the form keeps the edits', await p.evaluate(() => document.querySelector('#arch-edit [data-ae-f="tier"]').value === '-1' && document.querySelector('#arch-edit input[data-ae-w="sam"]').value === '0'));

    console.log('\nSaved');
    await click('#arch-edit [data-ae="save"]');
    await till(() => /Saved/.test(document.querySelector('#arch-edit').innerText), 'saved');
    const kept = await p.evaluate(() => fetch('api/archetypes').then((r) => r.json()));
    ok('the server keeps the change', kept.changes && kept.changes.armour && kept.changes.armour.force.tier === -1 && kept.updated[0].by === 'Boss', JSON.stringify(kept).slice(0, 160));
    ok('...this page uses it at once', await p.evaluate(() => window.PMCCamp.archetype('armour').tier === -1 && [].concat(window.PMCCamp.archetype('armour').weights.sam)[0] === 0));
    ok('...and marks it changed', await p.evaluate(() => /changed by Boss/.test(document.querySelector('#arch-edit .ae-tag').textContent)));
    const p2 = await (await b.newContext()).newPage();
    await p2.goto(URL); await wait(1500);
    ok('a page loaded afresh lays it over its own', await p2.evaluate(() => window.PMCCamp.archetype('armour').tier === -1));

    console.log('\nEvery field in the form');
    // each personality read back from its form, untouched, is no change at all
    const drift = await p.evaluate(() => {
      const out = [];
      ['pmc', 'rebel', 'bugs', 'xeno'].forEach((f) => window.PMCCamp.archetypesFor(f).forEach((a) => {
        window.PMCArchEdit.pick(a.id);
        // (against what it is now: one already changed by an admin stays as changed as it was)
        const ch = JSON.stringify(window.PMCCamp.archetypeChange(a.id, window.PMCArchEdit.read()));
        const was = JSON.stringify(window.PMCCamp.archetypeChange(a.id, window.PMCCamp.unifiedArchetype(a.id)));
        if (ch !== was) out.push(a.id + ': ' + ch.slice(0, 80));
      }));
      window.PMCArchEdit.pick('armour');
      return out;
    });
    ok('all 24 personalities read back from the form unchanged', !drift.length, drift.slice(0, 3).join(' | '));
    ok('the campaign, signature, hull and doctrine fields have their own controls (no JSON)', await p.evaluate(() =>
      !document.querySelector('#arch-edit [data-ae-f="advanced"]') && !!document.querySelector('#arch-edit [data-ae-v="campaign.spend"]') &&
      !!document.querySelector('#arch-edit [data-ae-row="campaign.found.t1"]') && !!document.querySelector('#arch-edit [data-ae-cb="force.favourites"]') &&
      !!document.querySelector('#arch-edit [data-ae="addstage"]')));
    await p.selectOption('#arch-edit [data-ae-v="campaign.spend"]', 'honours');
    await p.fill('#arch-edit [data-ae-v="campaign.leanSize"]', '20');
    await p.evaluate(() => document.querySelector('#arch-edit [data-ae-v="campaign.leanSize"]').dispatchEvent(new Event('change', { bubbles: true })));
    await click('#arch-edit [data-ae="add"][data-path="force.signature.units"]');
    await p.selectOption('#arch-edit [data-ae-row="force.signature.units"][data-r="0"][data-m="0"]', 'commandos');
    await p.evaluate(() => { const b = document.querySelector('#arch-edit [data-ae-cb="force.favourites"][value="Engineering and utility vehicles"]'); b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('#arch-edit [data-ae="addstage"]');
    await p.fill('#arch-edit [data-ae-stage="0"]', 'T5, T2');
    await p.evaluate(() => document.querySelector('#arch-edit [data-ae-stage="0"]').dispatchEvent(new Event('change', { bubbles: true })));
    ok('...and the tier preference typed above survives adding rows', await p.evaluate(() => document.querySelector('#arch-edit [data-ae-f="tier"]').value === '-1'));
    await click('#arch-edit [data-ae="save"]');
    await till(() => /Saved/.test(document.querySelector('#arch-edit').innerText) && window.PMCCamp.archetype('armour').spend === 'honours', 'the save of the new fields');
    const got = await p.evaluate(() => { const a = window.PMCCamp.archetype('armour'); return { spend: a.spend, lean: a.leanSize, sig: a.signature, fav: a.hullsFirst, stages: a.stages }; });
    ok('...saved and in force: spending, lean size, a signature set, a favourite hull, a stage',
      got.spend === 'honours' && got.lean === 20 && JSON.stringify(got.sig) === '["commandos"]' && got.fav.indexOf('Engineering and utility vehicles') >= 0 && JSON.stringify(got.stages) === '[["T5","T2"]]', JSON.stringify(got));

    console.log('\nA bad one refused');
    await p.fill('#arch-edit input[data-ae-w="bats"]', '15');
    await click('#arch-edit [data-ae="save"]');
    await till(() => !!document.querySelector('#arch-edit .faults'), 'the refusal');
    ok('a weight over 10 is refused, with the reason', await p.evaluate(() => /weight is 0-10/.test(document.querySelector('#arch-edit .faults').textContent)));
    await click('#arch-edit [data-ae="revert"]');

    console.log('\nReset');
    await click('#arch-edit [data-ae="reset"]');
    await till(() => /default/.test(document.querySelector('#arch-edit').innerText) && window.PMCCamp.archetype('armour').tier === 0, 'reset');
    ok('back to its default, here and on the server', await p.evaluate(() => fetch('api/archetypes').then((r) => r.json()).then((j) => !j.changes.armour && window.PMCCamp.archetype('armour').tier === 0)));

    console.log('\nAn older one, and a Rebel');
    await p.selectOption('#arch-edit [data-ae="pick"]', 'ivenbea');
    await till(() => /older rules/.test(document.querySelector('#arch-edit').innerText), 'the older personality');
    await click('#arch-edit [data-ae="convert"]');
    ok('a personality on the older rules can start a weighted list from its groups', await p.evaluate(() => !!document.querySelector('#arch-edit input[data-ae-w="Lesser Bugs"]') && +document.querySelector('#arch-edit input[data-ae-w="Lesser Bugs"]').value > 0));
    await p.selectOption('#arch-edit [data-ae="pick"]', 'redfront');
    await till(() => !!document.querySelector('#arch-edit [data-ae-tac="defend"]'), 'the Rebel form');
    ok('...and Rebels have their tactics in the form', true);
    await p.screenshot({ path: require('path').join(require('../where.js').SHOTS, 'archedit.png'), fullPage: false });
  } catch (e) {
    ok('the run finished', false, e.message);
  }
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
