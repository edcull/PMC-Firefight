const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

async function dismissEarly(page) {
  for (let i = 0; i < 10; i++) {
    const open = await page.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await page.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await page.waitForTimeout(220);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1340, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL/.test(m.text())) errors.push(m.text()); });

  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(500);
  await page.click('#btn-start');
  await page.waitForTimeout(600);
  await page.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
  await page.waitForTimeout(300);
  await dismissEarly(page);
  await page.evaluate(() => document.querySelector('button[data-act="autodeploy"]').click());
  await page.waitForTimeout(400);
  await dismissEarly(page);
  await page.waitForSelector('button[data-act="start"]', { timeout: 15000 });
  await page.evaluate(() => document.querySelector('button[data-act="start"]').click());
  await page.waitForTimeout(500);

  const dismiss = async () => {
    for (let i = 0; i < 6; i++) {
      const open = await page.evaluate(() => !document.getElementById('resolution').hidden);
      if (!open) break;
      // the card may auto-advance under us, so never wait on a real click
      await page.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
      await page.waitForTimeout(220);
    }
  };
  await dismiss();

  for (let i = 0; i < 16; i++) {
    if (await page.evaluate(() => !!(window.PMC_STATE() || {}).over)) break;
    await dismiss();
    const picked = await page.evaluate(() => {
      const list = document.querySelectorAll('.force-A .ru:not(.done):not(.dead)');
      if (!list.length) return false;
      list[0].click();
      return true;
    });
    if (!picked) { await page.waitForTimeout(800); continue; }
    await page.waitForTimeout(150);
    const acted = await page.evaluate(() => {
      const fire = document.querySelector('.slot[data-action="fire"]:not([disabled])');
      if (fire) { fire.click(); return 'fire'; }
      const mv = document.querySelector('.slot[data-action="move"]:not([disabled])');
      if (mv) { mv.click(); return 'move'; }
      return 'none';
    });
    await page.waitForTimeout(200);
    if (acted === 'fire') {
      await page.evaluate(() => { const t = document.querySelector('button[data-target]'); if (t) t.click(); });
    } else if (acted === 'move') {
      const box = await page.locator('#board').boundingBox();
      const pt = await page.evaluate(() => {
        const moves = window.__moves || [];
        if (!moves.length) return null;
        const v = window.PMC_VIEW();
        for (let i = moves.length - 1; i >= 0; i--) {
          const p = window.PMCIso.toScreen(moves[i].x, moves[i].y);
          const cx = (p.x - v.sx) * v.z + v.dx, cy = (p.y - v.sy) * v.z + v.dy;
          if (cx > 20 && cx < v.W - 20 && cy > 20 && cy < v.H - 20) return { fx: cx / v.W, fy: cy / v.H };
        }
        return null;
      });
      if (pt) {
        // the first click previews the move, the second confirms it
        await page.mouse.click(box.x + box.width * pt.fx, box.y + box.height * pt.fy);
        await page.waitForTimeout(200);
        await page.mouse.click(box.x + box.width * pt.fx, box.y + box.height * pt.fy);
      }
    } else {
      await page.evaluate(() => { const r = document.querySelector('.slot[data-action="regroup"]:not([disabled])'); if (r) r.click(); });
    }
    await page.waitForTimeout(500);
    await dismiss();
    await page.waitForTimeout(900);
  }

  const info = await page.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      turn: s.turn, logs: s.log.length, over: s.over ? s.over.text : null,
      shots: s.log.filter(l => l.t === 'shoot').length,
      props: (s.props || []).length
    };
  });
  console.log(info);
  console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
  await page.screenshot({ path: 'shot-iso.png' });
  await browser.close();
})();
