/* The allies' orders through the interface (story mode): Landfall with the
   port's men, set up as the story sets it up; the orders card beside the
   board, an order picked and put down with a tap on the table, the marker
   drawn, and the order kept once the allies have acted on it. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS, seedDice } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await seedDice(p, 2670);
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  // Landfall, the port master's men taken on: the story's own cfg
  await p.evaluate(() => {
    const C = window.PMCCamp, S = window.PMCStory, L = window.PMCStoryLevers;
    const c = C.newCampaign({ mode: 'solo' });
    C.found(c.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    S.begin(c, 'deep-contract');
    S.proceed(c); S.choose(c, 'take');
    const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: S.battleSpec(c).scenario });
    const cfg = L.toCfg(c, { picks, role: 'A' });
    cfg.mode = 'ai';
    window.__begin(cfg);
  });
  await p.waitForTimeout(1200);
  const card = () => p.evaluate(() => !document.getElementById('resolution').hidden);
  const cont = () => p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
  const settle = async () => { for (let i = 0; i < 20 && await card(); i++) { await cont(); await p.waitForTimeout(150); } };
  await settle();
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await settle();
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(1200);
  // the side A player's turn, with the table still
  for (let i = 0; i < 40; i++) {
    await settle();
    const ready = await p.evaluate(() => window.PMC_STATE().phase === 'battle' && !!window.__mySide() && !window.__busy() && !window.__aiOwed());
    if (ready) break;
    await p.waitForTimeout(300);
  }
  await p.evaluate(() => window.__clearSel());

  console.log('\n  THE ORDERS CARD');
  let txt = await p.evaluate(() => document.getElementById('context').innerText);
  ok('beside the board: the allies’ orders, none given yet', /Allies’ orders/.test(txt) && /their own judgement/.test(txt), txt.slice(0, 160));
  ok('...Move here, Attack here, Hold here', await p.evaluate(() => ['move', 'attack', 'hold'].every((k) => !!document.querySelector('#context [data-act="allyorder"][data-kind="' + k + '"]'))));
  await p.evaluate(() => document.querySelector('#context [data-act="allyorder"][data-kind="hold"]').click());
  await p.waitForTimeout(200);
  txt = await p.evaluate(() => document.getElementById('context').innerText);
  ok('picking one asks for a tap on the table', /Tap the table where they should hold here/i.test(txt), txt.slice(0, 160));

  // the allies' ground looked at, and tapped a little in front of them
  const aim = await p.evaluate(() => {
    const us = window.PMC_STATE().units.filter((u) => u.ally && u.alive);
    const x = us.reduce((s, u) => s + u.x, 0) / us.length + 6, y = us.reduce((s, u) => s + u.y, 0) / us.length;
    window.__lookAt(x, y);
    const c = document.getElementById('board').getBoundingClientRect();
    return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  });
  await p.waitForFunction(() => !window.__busy() && window.__showQueue() === 0, null, { timeout: 20000 }).catch(() => {});
  await p.mouse.click(aim.x, aim.y);
  await p.waitForTimeout(500);
  const order = await p.evaluate(() => window.PMC_STATE().allyOrder);
  ok('the tap puts the marker down: Hold here, on the table', order && order.kind === 'hold' && order.x > 0 && order.y > 0, JSON.stringify(order));
  txt = await p.evaluate(() => document.getElementById('context').innerText);
  ok('...and the card says so, with the way to change or clear it', /Hold here/.test(txt) && /take cover/.test(txt) &&
    await p.evaluate(() => !!document.querySelector('#context [data-act="allyorderclear"]')), txt.slice(0, 200));
  await p.screenshot({ path: path.join(SHOTS, 'story-allyorder.png') });

  console.log('\n  CHANGED, AND KEPT');
  await p.evaluate(() => document.querySelector('#context [data-act="allyorder"][data-kind="attack"]').click());
  await p.waitForTimeout(150);
  await p.mouse.click(aim.x, aim.y);
  await p.waitForTimeout(400);
  ok('before the allies act, it can be put right: now Attack here', await p.evaluate(() => (window.PMC_STATE().allyOrder || {}).kind === 'attack'));
  // an ally acts on it (the engine's own hook: an ally taking its activation)
  await p.evaluate(() => { const s = window.PMC_STATE(); s.allyOrder.acted = true; });
  await p.evaluate(() => window.__clearSel());
  await p.waitForTimeout(200);
  txt = await p.evaluate(() => document.getElementById('context').innerText);
  ok('once they are acting on it, it stands for the turn', /acting on it/.test(txt) && await p.evaluate(() => !document.querySelector('#context [data-act="allyorder"]')), txt.slice(0, 200));

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
