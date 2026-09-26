const { chromium, devices } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');

/* The battle on a phone, driven by touch: tapping a unit selects it, Move then
   two taps on a spot previews and makes the move, and a drag pans the table
   without selecting anything. Each is checked, not just printed. */
(async () => {
  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    hasTouch: true, isMobile: true
  });
  /* The unit the test picks up: one of ours that can take a Move action now —
     on the table, not garrisoned, riding or broken, and not still landing. */
  await ctx.addInitScript(() => {
    window.__movable = (x, s) => x.side === s && x.alive && !x.activated && x.x >= 0 && !x.aboard && !x.reserve &&
      x.bld == null && x.move > 0 && !x.arriveAt && window.PMC.status(x) !== 'broken' &&
      !window.PMC.has(x, 'Immobile') && !window.PMC.has(x, 'Stationary Artillery');
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
  /* One battle, the same every run: an infantry company in a meeting
     engagement on open desert, against the AI. Left to chance, some battles
     start with the whole force in reserve or tucked inside buildings, and the
     touch checks below would be testing the dice rather than the fingers. */
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
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
  let ours = false;
  for (let i = 0; i < 120 && !ours; i++) {
    const ok = await p.evaluate(() => {
      const s = window.PMC_STATE();
      // our turn, with the other side's moves finished playing (the board takes no taps while they do)
      return s && !s.over && s.phase === 'battle' && s.activeSide === 'A' && document.getElementById('resolution').hidden &&
        !(window.__busy && window.__busy()) &&
        s.units.some(x => window.__movable(x, 'A'));
    });
    if (ok) { ours = true; break; }
    /* our turn, but nothing of ours can take a Move just now (all garrisoned,
       broken or landing): spend an activation on Regroup, as a player would */
    const idle = await p.evaluate(() => {
      const s = window.PMC_STATE();
      if (!s || s.over || s.phase !== 'battle' || s.activeSide !== 'A' || (window.__busy && window.__busy())) return null;
      if (window.__insertionAsking && window.__insertionAsking()) return null;
      const u = s.units.find(x => x.side === 'A' && x.alive && !x.activated && x.x >= 0 && !x.aboard);
      if (!u) return null;
      const li = [...document.querySelectorAll('.ru')].find(e => e.dataset.unit === u.id);
      if (li) li.click();
      return u.id;
    });
    if (idle) {
      await p.waitForTimeout(150);
      await p.evaluate(() => {
        const btn = [...document.querySelectorAll('.slot')].find(x => /Regroup/.test(x.textContent));
        if (btn && !btn.disabled) btn.click();
      });
    }
    // a force that starts in reserve is asked where each unit lands: put it down anywhere legal
    await p.evaluate(() => {
      if (!window.__insertionAsking || !window.__insertionAsking()) return;
      for (let i = 0; i < 4000; i++) {
        const x = 6 + Math.random() * 36, y = 6 + Math.random() * 36;
        if (window.__insertionLegal({ x, y })) { window.__dropHere({ x, y }); return; }
      }
    });
    await p.evaluate(() => {
      if (!document.getElementById('resolution').hidden) {
        const c = document.getElementById('res-continue'); if (c) c.click();
      }
    });
    await p.waitForTimeout(500);
  }
  check('the battle comes round to our activation', ours);
  if (!ours) {
    await browser.close();
    console.log('\n' + problems.length + ' problem(s)');
    process.exit(1);
  }
  const zoom = await p.evaluate(() => window.PMC_VIEW().z);
  /* On a phone the table opens fitted to the screen, where a squad is a few
     pixels across; a player zooms in to pick one out, and so does this. */
  await p.evaluate(() => window.__setZoom(1));
  await p.waitForTimeout(200);
  console.log('canvas css width:', await p.evaluate(() => Math.round(document.getElementById('board').getBoundingClientRect().width)));

  // tap a friendly unit through the canvas, with a little finger jitter
  async function tapUnit(side) {
    // select through the roster first so the camera centres on it, then tap the sprite
    await p.evaluate((s) => {
      const st = window.PMC_STATE();
      const u = st.units.find(x => window.__movable(x, s));
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
      const u = st.units.find(x => window.__movable(x, s));
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
  const picked = await p.evaluate(() => { const u = window.__sel(); return u ? u.code : null; });
  check('a tap on a unit selects it', picked === code, code + ' tapped, ' + (picked || 'nothing') + ' selected');

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
      check('Move, then a tap on a spot, shows the move', previewed);
      await p.touchscreen.tap(spot.x, spot.y);          // and confirms it
      await p.waitForTimeout(1600);
      const after = await p.evaluate(({ wx, wy }) => {
        const s = window.PMC_STATE();
        // it went where it was sent, give or take the half-inch the movement lattice snaps to
        const moved = s.units.find(u => u.side === 'A' && Math.hypot(u.x - wx, u.y - wy) < 1.5);
        const line = s.log.filter(l => l.t === 'move' && /\[A\]/.test(l.text)).slice(-1)[0];
        return { landed: moved ? moved.code : null, line: line && line.text };
      }, spot);
      check('...and a second tap makes it', after.landed === code, after.line || 'did not move');
    } else check('there is somewhere on screen to move to', false);
  } else {
    check('Move is offered for the selected unit', false, 'disabled');
  }

  // drag should pan, not select — once the other side's answer to that move has played out,
  // since while the camera is following it the table is not the player's to pan
  for (let i = 0; i < 200; i++) {
    const idle = await p.evaluate(() => !window.__cam().borrowed && !window.__busy() && !window.__showQueue());
    if (idle) break;
    await p.evaluate(() => { const r = document.getElementById('resolution'); if (r && !r.hidden) document.getElementById('res-continue').click(); });
    await p.waitForTimeout(100);
  }
  await p.evaluate(() => window.__clearSel && window.__clearSel());
  await p.waitForTimeout(150);
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
  const selAfterDrag = await p.evaluate(() => { const u = window.__sel(); return u ? u.code : null; });
  check('a drag pans the table', v0.sx !== v1.sx || v0.sy !== v1.sy, 'opened at zoom ' + zoom.toFixed(2));
  check('...without selecting anything', !selAfterDrag, selAfterDrag || '');
  check('no page errors', errs.length === 0, errs.join('; '));
  await browser.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
