const { chromium, devices } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    hasTouch: true, isMobile: true
  });
  await ctx.addInitScript(() => {
    const add = () => {
      if (document.querySelector('meta[name=viewport]')) return;
      const m = document.createElement('meta');
      m.name = 'viewport'; m.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
      (document.head || document.documentElement).appendChild(m);
    };
    if (document.head) add(); else document.addEventListener('readystatechange', add, { once: true });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);

  await p.tap('#btn-start');
  await p.waitForTimeout(1200);
  // results are a running feed now, not a card to dismiss — but keep the tap
  // working for the one card that is still modal
  if (await p.evaluate(() => !document.getElementById('resolution').hidden)) {
    await p.tap('#res-continue');
  }
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('button[data-act="autodeploy"]').click());
  await p.waitForTimeout(400);
  for (let i = 0; i < 12; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(200);
  }
  await p.waitForSelector('button[data-act="start"]', { timeout: 15000 });
  await p.evaluate(() => document.querySelector('button[data-act="start"]').click());
  await p.waitForTimeout(800);
  await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
  await p.waitForTimeout(400);

  // wait until it is our force's activation
  for (let i = 0; i < 40; i++) {
    const ok = await p.evaluate(() => {
      const s = window.PMC_STATE();
      return s && !s.over && s.phase === 'battle' && s.activeSide === 'A' && document.getElementById('resolution').hidden;
    });
    if (ok) break;
    await p.evaluate(() => {
      if (!document.getElementById('resolution').hidden) {
        const c = document.getElementById('res-continue'); if (c) c.click();
      }
    });
    await p.waitForTimeout(500);
  }
  const zoom = await p.evaluate(() => window.PMC_VIEW().z);
  console.log('canvas css width:', await p.evaluate(() => Math.round(document.getElementById('board').getBoundingClientRect().width)));

  // tap a friendly unit through the canvas, with a little finger jitter
  async function tapUnit(side) {
    // select through the roster first so the camera centres on it, then tap the sprite
    await p.evaluate((s) => {
      const st = window.PMC_STATE();
      const u = st.units.find(x => x.side === s && x.alive && !x.activated);
      document.querySelector('[data-unit="' + u.id + '"]').click();
    }, side);
    await p.waitForTimeout(600);
    await p.evaluate(() => {
      window.__clearSel && window.__clearSel();
      document.querySelector('.board-wrap').scrollIntoView({ block: 'start' });
    });
    await p.waitForTimeout(300);
    const pos = await p.evaluate((s) => {
      const st = window.PMC_STATE();
      const u = st.units.find(x => x.side === s && x.alive && !x.activated);
      const v = window.PMC_VIEW();
      const q = window.PMCIso.toScreen(u.x, u.y);
      const c = document.getElementById('board').getBoundingClientRect();
      return {
        code: u.code,
        box: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)],
        x: c.left + ((q.x - v.sx) * v.z + v.dx) / v.W * c.width,
        y: c.top + ((q.y - v.sy) * v.z + v.dy) / v.H * c.height
      };
    }, side);
    console.log('  tap at client', Math.round(pos.x), Math.round(pos.y), '| canvas box', pos.box);
    // simulate a slightly sloppy tap: small movement between down and up
    console.log('  elementFromPoint:', await p.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el.id || el.className || el.tagName) : 'none';
    }, [pos.x + 2, pos.y - 3]));
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pos.x + 2, y: pos.y - 3, id: 1 }] });
    await p.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(350);
    return pos.code;
  }

  const code = await tapUnit('A');
  const selected = await p.evaluate(() => {
    const h = document.querySelector('.stat-head h2');
    return h ? h.textContent : null;
  });
  console.log('tapped unit', code, '-> selected:', selected, '| activeSide:', await p.evaluate(() => window.PMC_STATE().activeSide));

  // now tap Move, then tap a reachable spot
  const moveEnabled = await p.evaluate(() => !!document.querySelector('.slot[data-action="move"]:not([disabled])'));
  if (moveEnabled) {
    await p.tap('.slot[data-action="move"]');
    await p.waitForTimeout(400);
    const before = await p.evaluate(() => {
      const s = window.PMC_STATE();
      const u = s.units.find(x => x.side === 'A' && !x.activated);
      return { x: u.x, y: u.y, moves: (window.__moves || []).length };
    });
    const spot = await p.evaluate(() => {
      const v = window.PMC_VIEW();
      const c = document.getElementById('board').getBoundingClientRect();
      const ms = window.__moves || [];
      for (let i = ms.length - 1; i >= 0; i--) {
        const q = window.PMCIso.toScreen(ms[i].x, ms[i].y);
        const cx = (q.x - v.sx) * v.z + v.dx, cy = (q.y - v.sy) * v.z + v.dy;
        if (cx > 40 && cx < v.W - 40 && cy > 40 && cy < v.H - 40) {
          return { x: c.left + cx / v.W * c.width, y: c.top + cy / v.H * c.height, wx: ms[i].x, wy: ms[i].y };
        }
      }
      return null;
    });
    if (spot) {
      await p.touchscreen.tap(spot.x, spot.y);          // opens the preview
      await p.waitForTimeout(500);
      const previewed = await p.evaluate(() => !!window.__previewState());
      console.log('move tap -> preview shown:', previewed);
      await p.touchscreen.tap(spot.x, spot.y);          // and confirms it
      await p.waitForTimeout(1600);
      const after = await p.evaluate(({ wx, wy }) => {
        const s = window.PMC_STATE();
        const moved = s.units.find(u => u.side === 'A' && Math.hypot(u.x - wx, u.y - wy) < 0.6);
        const line = s.log.filter(l => l.t === 'move' && /\[A\]/.test(l.text)).slice(-1)[0];
        return { landed: moved ? moved.code : null, line: line && line.text };
      }, spot);
      console.log('move tap -> unit at target:', after.landed, '|', after.line);
    } else console.log('no on-screen move spot');
  } else console.log('move was disabled (not this force\'s turn)');

  // drag should pan, not select
  const v0 = await p.evaluate(() => window.PMC_VIEW());
  const bb = await p.locator('#board').boundingBox();
  const cdp2 = await p.context().newCDPSession(p);
  const dy = bb.y + bb.height * 0.5;
  await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width * 0.8, y: dy, id: 2 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bb.x + bb.width * (0.8 - i * 0.06), y: dy, id: 2 }] });
    await p.waitForTimeout(25);
  }
  await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(300);
  const v1 = await p.evaluate(() => window.PMC_VIEW());
  const selAfterDrag = await p.evaluate(() => { const h = document.querySelector('.stat-head h2'); return h ? h.textContent : null; });
  console.log('zoom on phone:', zoom, '| drag panned:', v0.sx !== v1.sx || v0.sy !== v1.sy, '| selection after drag:', selAfterDrag);
  console.log('errors:', errs.length ? errs : 'none');
  await p.screenshot({ path: 'shot-phone.png' });
  await browser.close();
})();
