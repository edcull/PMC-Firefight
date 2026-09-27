/* Follow, the toggle beside the zoom level: whether the camera goes over to the
   other side's units as they act. Shown on a desktop and on a phone; off, the
   AI's turns leave the camera where the player put it; on, it rides along as
   ever; the choice is kept for the next battle. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish, SHOTS } = require('../where.js');

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
async function battle(p) {
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
}
// watch the camera through the AI's turns: did it ever go over to them, and did it move?
async function watch(p, ms) {
  await p.evaluate(() => {
    const c0 = window.__cam();
    window.__watch = { borrowed: false, moved: 0, aiTime: 0, last: null };
    window.__watchT = setInterval(() => {
      const c = window.__cam(), w = window.__watch, s = window.PMC_STATE();
      if (c.borrowed) w.borrowed = true;
      /* Where the camera is headed, through the other side's activations only:
         the player's own taps aim it too, and it may still be easing there
         when the other side starts — that is not the other side moving it. */
      const theirs = s && s.phase === 'battle' && !window.__mySide();
      if (theirs) {
        w.aiTime++;
        if (w.last && Math.hypot(c.tx - w.last.x, c.ty - w.last.y) > 1) {
          // aimed somewhere new: at one of theirs (chasing), or at one of the player's own (its own action replayed)?
          const me = s.cfg.aiSides.indexOf('A') < 0 ? 'A' : 'B', I = window.PMCIso;
          let foe = Infinity, own = Infinity;
          s.units.forEach(u => {
            if (!u.alive || u.x < 0 || u.aboard) return;
            const q = I.toScreen(u.x, u.y), d = Math.hypot(q.x - c.tx, q.y - I.ELEV - c.ty);
            if (u.side === me) own = Math.min(own, d); else foe = Math.min(foe, d);
          });
          if (foe < 40 && foe < own) w.moved = Math.max(w.moved, 1 + foe);
        }
        w.last = { x: c.tx, y: c.ty };
      } else w.last = null;
    }, 40);
  });
  const t0 = Date.now();
  while (Date.now() - t0 < ms || (Date.now() - t0 < ms * 3 && (await p.evaluate(() => window.__watch.aiTime)) < 150)) {
    await drain(p);
    // the player acts once the other side's move has been drawn, as a player would: a unit regroups
    await p.evaluate(() => {
      if (!window.__mySide() || window.__busy() || window.__showQueue() > 0 || window.__resOpen()) return;
      const u = window.__eligibleUnits()[0];
      if (u && window.__select(u)) window.__pressAction('regroup');
    });
    await p.waitForTimeout(80);
  }
  return p.evaluate(() => {
    clearInterval(window.__watchT);
    return window.__watch;
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];

  console.log('\n  DESKTOP');
  const ctx = await b.newContext({ viewport: { width: 1340, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.evaluate(() => { try { localStorage.removeItem('pmc.followOther'); } catch (e) { } });
  await p.waitForTimeout(500);
  await battle(p);
  const d = await p.evaluate(() => {
    const t = document.getElementById('follow-toggle'), z = document.getElementById('zoomlabel');
    const r = t.getBoundingClientRect(), zr = z.getBoundingClientRect(), br = document.getElementById('board').getBoundingClientRect();
    return { shown: r.width > 0 && getComputedStyle(t).display !== 'none', on: t.classList.contains('on'),
      besideZoom: Math.abs(r.top - zr.top) < 20 && r.left > zr.left, topRight: r.right > br.left + br.width * 0.7 && r.top < br.top + 60 };
  });
  ok('Follow is by the zoom level, top right of the table', d.shown && d.besideZoom && d.topRight, JSON.stringify(d));
  ok('...and on to begin with', d.on);
  await p.click('#follow-toggle');
  ok('a click turns it off', !(await p.evaluate(() => document.getElementById('follow-toggle').classList.contains('on'))));
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(600);
  const off = await watch(p, 9000);
  ok('off, the AI\'s turns never take the camera', off.aiTime > 10 && !off.borrowed, JSON.stringify(off));
  ok('...and it is never aimed at their units', off.moved < 1, off.moved ? 'aimed within ' + (off.moved - 1).toFixed(0) + ' px of one' : '');
  await p.screenshot({ path: path.join(SHOTS, 'follow-off.png') });
  await p.click('#follow-toggle');
  // a fresh battle for it (the first may be over): Follow, back on, carries into it
  await battle(p);
  ok('...and it carries into the next battle', await p.evaluate(() => document.getElementById('follow-toggle').classList.contains('on')));
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(600);
  const on = await watch(p, 9000);
  ok('on again, the camera goes over to the AI\'s units', on.borrowed, JSON.stringify(on));
  ok('the choice is kept', await p.evaluate(() => localStorage.getItem('pmc.followOther')) === 'on');
  await ctx.close();

  console.log('\n  PHONE');
  const mctx = await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mctx.newPage();
  m.on('pageerror', e => errs.push(e.message));
  await m.goto('file://' + path.join(ROOT, 'index.html'));
  await m.waitForTimeout(500);
  await battle(m);
  const mm = await m.evaluate(() => {
    const t = document.getElementById('follow-toggle'), r = t.getBoundingClientRect();
    const zin = document.querySelector('#viewctl [data-zoom="in"]');
    return { shown: r.width > 0 && getComputedStyle(t).display !== 'none', h: Math.round(r.height), label: getComputedStyle(document.getElementById('zoomlabel')).display !== 'none',
      zoomBtns: getComputedStyle(zin).display };
  });
  ok('on a phone Follow shows, by the zoom level', mm.shown && mm.label, JSON.stringify(mm));
  ok('...with the + / − / Fit buttons left to the fingers', mm.zoomBtns === 'none');
  await m.tap('#follow-toggle');
  ok('a tap turns it off', !(await m.evaluate(() => document.getElementById('follow-toggle').classList.contains('on'))));
  await m.screenshot({ path: path.join(SHOTS, 'follow-phone.png') });
  await mctx.close();

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
