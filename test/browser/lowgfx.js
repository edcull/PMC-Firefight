/* Low graphics, the switch beside Sound on the menu: the board drawn at one
   pixel per CSS pixel, and nothing on it moving by itself between actions —
   the board is not redrawn while it waits, and drawn again a moment later it
   is the same picture. Switched back, the board is sharp and alive again; the
   choice is kept for the next visit. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish, seedDice } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// the board's own redraws, counted while nobody does anything
async function idleDraws(p, ms) {
  await p.evaluate(() => { window.__boardDraws = 0; });
  await p.waitForTimeout(ms);
  return p.evaluate(() => window.__boardDraws);
}
// the board drawn twice, a moment apart, on the same spot: the same picture?
async function stillFrame(p) {
  return p.evaluate(async () => {
    const o = window.__smoker;
    const c = document.getElementById('board');
    window.__lookAt(o.x, o.y); const a = c.toDataURL();
    await new Promise(r => setTimeout(r, 400));
    window.__lookAt(o.x, o.y); const b = c.toDataURL();
    return a === b;
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await seedDice(p, 2670);
  await p.addInitScript(() => {
    const di = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function () { if (this.canvas.id === 'board') window.__boardDraws = (window.__boardDraws || 0) + 1; return di.apply(this, arguments); };
  });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.evaluate(() => { try { localStorage.removeItem('pmc-lowgfx'); } catch (e) { } });
  await p.reload();
  await p.waitForTimeout(500);

  console.log('\n  THE SWITCH');
  const m = await p.evaluate(() => {
    const g = document.getElementById('btn-menu-gfx'), s = document.getElementById('btn-menu-sound');
    const gr = g.getBoundingClientRect(), sr = s.getBoundingClientRect();
    return { text: g.textContent, shown: gr.width > 0, beside: g.parentNode === s.parentNode && Math.abs(gr.top - sr.top) < 20 };
  });
  ok('the menu has a Graphics switch beside Sound', m.shown && m.beside, JSON.stringify(m));
  ok('...reading high to begin with', m.text === 'Graphics high', m.text);

  console.log('\n  HIGH');
  await startSkirmish(p, { tier: 3, mode: 'hotseat', scenario: 'meeting', planet: 'sparse', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'lapc'], mirror: true });
  await p.waitForTimeout(1200);
  for (let i = 0; i < 16 && await p.evaluate(() => !document.getElementById('resolution').hidden); i++) {
    await p.evaluate(() => document.getElementById('res-continue').click()); await p.waitForTimeout(150);
  }
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await p.evaluate(() => { const bb = window.__beginButton && window.__beginButton(); if (bb) bb.click(); });
  await p.waitForTimeout(800);
  for (let i = 0; i < 16 && await p.evaluate(() => !document.getElementById('resolution').hidden); i++) {
    await p.evaluate(() => document.getElementById('res-continue').click()); await p.waitForTimeout(150);
  }
  // a carrier at half its Structure trails smoke, which keeps moving by itself; the camera on it
  const smoker = await p.evaluate(() => {
    const u = window.PMC_STATE().units.find(x => x.alive && x.cls === 'vehicle' && x.str && !x.aboard);
    if (!u) return null;
    u.damage = Math.ceil(u.str / 2); window.__smoker = u; window.__lookAt(u.x, u.y);
    return u.id;
  });
  ok('a smoking vehicle is on the table to watch', !!smoker);
  await p.waitForTimeout(1500);
  const css = await p.evaluate(() => document.getElementById('board').getBoundingClientRect().width);
  const hiW = await p.evaluate(() => document.getElementById('board').width);
  ok('the board is drawn at two pixels per CSS pixel', Math.abs(hiW / css - 2) < 0.05, hiW + ' for ' + css.toFixed(0));
  const hiDraws = await idleDraws(p, 1500);
  ok('waiting, the board is redrawn for what moves on it', hiDraws > 5, hiDraws + ' redraws');
  ok('...and is not the same picture a moment later', !(await stillFrame(p)));

  console.log('\n  LOW');
  await p.evaluate(() => document.getElementById('btn-menu-gfx').click());
  await p.waitForTimeout(300);
  ok('the switch reads low', await p.evaluate(() => document.getElementById('btn-menu-gfx').textContent) === 'Graphics low');
  const loW = await p.evaluate(() => document.getElementById('board').width);
  ok('the board is drawn at one pixel per CSS pixel', Math.abs(loW / css - 1) < 0.05, loW + ' for ' + css.toFixed(0));
  const loDraws = await idleDraws(p, 1500);
  ok('waiting, the board is not redrawn at all', loDraws === 0, loDraws + ' redraws');
  ok('...and drawn again it is the same picture: nothing moves by itself', await stillFrame(p));
  await p.reload();
  await p.waitForTimeout(500);
  ok('the choice is kept', await p.evaluate(() => document.getElementById('btn-menu-gfx').textContent) === 'Graphics low');
  await p.evaluate(() => document.getElementById('btn-menu-gfx').click());
  ok('...and switched back', await p.evaluate(() => localStorage.getItem('pmc-lowgfx')) === '0');

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
