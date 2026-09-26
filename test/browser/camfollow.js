/* When the camera goes over to the AI's unit as it acts, it is the AI's
   until that side is done: the player cannot drag, pinch, zoom or tap it
   away meanwhile, the hint says so, and the view comes back on its own to
   where the player left it once the AI has finished. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
async function drain(p) {
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(150);
  }
}
const cam = (p) => p.evaluate(() => Object.assign(window.__cam(), { mine: !!window.__mySide(),
  hint: (document.getElementById('returnhint') || {}).textContent, hintOn: !document.getElementById('returnhint').hidden,
  dim: document.getElementById('viewctl').classList.contains('locked') }));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(800);
  await drain(p);

  console.log('\n  While the AI has the camera');
  /* The page watches for the moment the AI has the camera, and at once tries
     every way the player moves it — the wheel, the + key, the + button, a
     drag and a tap on open ground — noting the camera before and after. */
  await p.evaluate(() => {
    const canvas = document.getElementById('board');
    window.__lockSeen = null;
    const probe = setInterval(() => {
      const c = window.__cam();
      if (!window.__armed || !(c.borrowed && (!window.__mySide() || window.__busy())) || window.__lockSeen) return;
      clearInterval(probe);
      const before = { x: c.x, y: c.y, z: c.z };
      const hint = document.getElementById('returnhint');
      const r = canvas.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
      const zin = document.querySelector('#viewctl [data-zoom="in"]'); if (zin) zin.click();
      const pd = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true }));
      pd('pointerdown', r.left + 60, r.top + 60); pd('pointermove', r.left + 200, r.top + 160); pd('pointerup', r.left + 200, r.top + 160);
      pd('pointerdown', r.left + 30, r.top + 30); pd('pointerup', r.left + 30, r.top + 30);      // a tap on open ground
      const after = window.__cam();
      // and when it is handed back, where it was handed back to
      const back = setInterval(() => { const n = window.__cam(); if (!n.borrowed) { clearInterval(back); window.__backTo = n.home; } }, 5);
      window.__lockSeen = { home: c.home, before, after: { x: after.x, y: after.y, z: after.z, borrowed: after.borrowed },
        hint: hint.hidden ? '' : hint.textContent, dim: document.getElementById('viewctl').classList.contains('locked') };
    }, 5);
  });
  let c = await cam(p), home = null, seen = null;
  for (let k = 0; k < 600 && !seen; k++) {
    await drain(p);
    // the player acts once the other side's move has been drawn, as a player would
    if (c.mine && !c.borrowed && !(await p.evaluate(() => window.__busy() || window.__showQueue() > 0 || !!window.__resOpen()))) {
      await p.evaluate(() => {
        const u = window.__eligibleUnits()[0];
        if (u && window.__select(u) && window.__pressAction('regroup')) window.__armed = true;   // the player has chosen a view
      });
    }
    await p.waitForTimeout(40);
    c = await cam(p);
    seen = await p.evaluate(() => window.__lockSeen);
  }
  ok('the AI takes the camera for its own unit', !!seen);
  if (seen) {
    ok('...the hint says the view comes back by itself', /comes back/.test(seen.hint), seen.hint);
    ok('...and the zoom buttons are dimmed', seen.dim);
    ok('the wheel, the + key and the + button do not zoom it', seen.after.z === seen.before.z, seen.before.z + ' → ' + seen.after.z);
    // the AI's own follow may nudge it along; the player's drag would have thrown it 100+ px
    ok('a drag does not pan it, and a tap does not take it back', seen.after.borrowed &&
      Math.abs(seen.after.x - seen.before.x) < 40 && Math.abs(seen.after.y - seen.before.y) < 40, JSON.stringify(seen));
  }

  console.log('\n  When the AI is done');
  for (let k = 0; k < 300 && (c.borrowed || !c.mine); k++) {
    await drain(p);
    await p.waitForTimeout(60);
    c = await cam(p);
  }
  ok('the view comes back on its own', !c.borrowed && c.mine);
  const backTo = await p.evaluate(() => window.__backTo);
  home = seen && seen.home;
  ok('...to where the player left it', !!home && !!backTo && Math.abs(backTo.x - home.x) < 2 && Math.abs(backTo.y - home.y) < 2,
    JSON.stringify({ home, backTo }));
  ok('...and the zoom buttons are live again', !c.dim);

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
