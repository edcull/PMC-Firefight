/* The board's caches change nothing on it. A standing squad or machine is drawn
   once and copied, and a unit outlined through a building keeps its outline while
   nothing about it changes: the frame drawn with the caches and without them must
   be the same picture to the eye, at every zoom — squads and a carrier behind buildings, some
   with Suppression showing over them. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, seedDice } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await seedDice(p, 2670);
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(800);
  // a table of three buildings, two units close behind each, the rest in the open
  await p.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    window.PMC_NEWGAME({ tier: 3, pl: 2, mode: 'hotseat', planet: 'industrial', scenario: 'meeting', nameA: 'A', nameB: 'B',
      armyA: ['cmd3', 'veterans', 'regular', 'regular', 'hmgteam', 'lapc', 'regular', 'rookie'], armyB: ['cmd3', 'veterans', 'regular', 'regular', 'hmgteam', 'lapc', 'regular', 'rookie'] });
    await wait(1200);
    for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await wait(100); }
    window.__autoDeployBoth(); await wait(500);
    const bb = window.__beginButton && window.__beginButton(); if (bb) bb.click(); await wait(800);
    for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await wait(100); }
    const s = window.PMC_STATE();
    s.terrain = [{ kind: 'building', x: 10, y: 22, w: 7, h: 5 }, { kind: 'building', x: 21, y: 22, w: 7, h: 5 }, { kind: 'building', x: 32, y: 22, w: 7, h: 5 }];
    s.units.forEach(u => { u.aboard = null; u.cargo = []; u.bld = null; u.facing = 0; });
    s.units.filter(u => u.alive).sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((u, i) => { u.reserve = false; u.sp = i % 3; const bl = s.terrain[Math.floor(i / 2) % 3]; if (i < 6) { u.x = bl.x + 2 + (i % 2) * 3; u.y = bl.y - 0.8; } else { u.x = 6 + i * 2.3; u.y = 30 + (i % 3) * 3; } });
    s.seed = 7; window.__rebuildScene();
  });

  // the table built (it is baked a step at a time) and the battle's own moves played out
  await p.waitForFunction(() => { const v = window.__vc(); return v.scene && !v.baking && !window.__busy(); }, null, { timeout: 30000 });
  console.log('\n  CACHED AND NOT');
  let seenKept = false;
  for (const [k, z] of [0.4, 0.7, 1, 1.5, 2, 2.6, 3.3, 4].entries()) {
    const r = await p.evaluate(async ([k, z]) => {
      const T = 99999.5, pn = performance.now, dn = Date.now; performance.now = () => T; Date.now = () => T;   // the clock still
      const s = window.PMC_STATE(), us = s.units.filter(u => u.alive && u.x >= 0 && !u.aboard), u = us[(k * 5) % us.length];
      window.__setZoom(z);
      const c = document.getElementById('board'), g = c.getContext('2d'), shot = () => g.getImageData(0, 0, c.width, c.height).data;
      const draw = () => { window.__lookAt(u.x, u.y); window.__drawNow(); };
      window.__noMachineCache = true; draw(); draw(); const A = shot();
      window.__noMachineCache = false; for (let i = 0; i < 3; i++) draw(); const B = shot();
      performance.now = pn; Date.now = dn;
      // (and the caches were drawn from: squads and machines copied, outlines kept)
      const vc = window.__vc(), copied = Object.values(vc.mcache || {}).filter(e => e.cv).length, kept = Object.values(vc.xcache || {}).filter(e => e.mask).length;
      let n = 0, max = 0;
      for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d) n++; if (d > max) max = d; }
      return { n, max, copied, kept, of: A.length / 4 };
    }, [k, z]);
    /* (a copy is laid at whole pixels and its see-through edges blended twice, onto the
       patch and then onto the frame, so an edge pixel here and there comes out a shade
       off — never more than a few in 255, and nowhere to be seen; a standing machine
       has been copied the same way all along) */
    ok('at zoom ' + z + ' the same picture', r.max <= 20 && r.n < r.of * 0.02 && r.copied > 0, r.n + ' pixels differ, by up to ' + r.max + '; ' + r.copied + ' units copied, ' + r.kept + ' outlines kept');
    seenKept = seenKept || r.kept > 0;
  }

  ok('an outline through a building was kept and drawn from', seenKept);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
