/* How the board performs, measured in a browser: the numbers the v0.1 review's
   performance items (4.4-4.7) are judged by, before and after each change.

   node test/perf/board.js [--json]

   - menu: the long tasks the menu's backdrop costs in its first 25 seconds (4.4)
   - bake: building the table from nothing, and repainting its structures (4.5)
   - frames: a frame at the zoom a player plays at, over troops and over a column
     of vehicles and aircraft (4.6)
   - canvases: the pixels the view holds for the table, in MB (4.7)
   Not a pass/fail test: timings differ machine to machine; compare runs on one. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

const JSON_OUT = process.argv.includes('--json');
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mb = (b) => +(b / 1048576).toFixed(1);

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    // the same table every run: dice and terrain from a fixed seed (the clock is left alone)
    let seed = 12345;
    Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    window.__reseed = (s) => { seed = s || 12345; };
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) })))
      .observe({ type: 'longtask', buffered: true });
  });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  const out = {};

  // ---- 4.4: the menu, left alone
  await p.waitForTimeout(25000);
  const lt = await p.evaluate(() => window.__long.slice());
  out.menu = { longTasks: lt.length, worstMs: lt.reduce((m, e) => Math.max(m, e.ms), 0), totalMs: lt.reduce((m, e) => m + e.ms, 0), list: lt.filter(e => e.ms > 100) };

  // ---- a battle on a built-up world, with plenty of hulls
  await p.evaluate(() => {
    window.__reseed(4242);
    window.PMC_NEWGAME({ tier: 4, pl: 2, mode: 'ai', planet: 'industrial', scenario: 'meeting', terrainSetup: 'auto',
      armyA: window.PMC.rollArmy(4, 2), armyB: window.PMC.rollArmy(4, 2) });
  });
  await p.waitForFunction(() => window.__vc && window.__vc().scene, null, { timeout: 30000 });
  await p.waitForTimeout(500);
  const bakes = [], paints = [];
  for (let i = 0; i < 3; i++) bakes.push(await p.evaluate(() => window.__perf.bake()));
  for (let i = 0; i < 5; i++) paints.push(await p.evaluate(() => window.__perf.paint()));
  out.bake = { bakeMs: Math.round(med(bakes)), paintMs: Math.round(med(paints)) };

  // ---- 4.6: frames at play zoom, over troops, then over a line of machines
  const frames = async () => { const r = []; for (let i = 0; i < 5; i++) r.push(await p.evaluate(() => window.__perf.frames(10))); return +med(r).toFixed(1); };
  await p.evaluate(() => { window.PMC_SETVIEW(24, 24, 2); });
  out.frames = { tableMs: await frames() };
  await p.evaluate(() => {
    const s = window.PMC_STATE(), R = window.PMC;
    const hulls = s.units.filter(u => R.isMachine(u) && u.alive);
    // every hull in the middle of the table, in two ranks, all in view
    hulls.forEach((u, i) => { u.x = 14 + (i % 8) * 2.6; u.y = 20 + Math.floor(i / 8) * 4; u.aboard = null; });
    window.PMC_SETVIEW(24, 24, 2);
  });
  out.frames.machinesMs = await frames();
  out.frames.machines = await p.evaluate(() => window.PMC_STATE().units.filter(u => window.PMC.isMachine(u) && u.alive).length);
  // the ground machines alone (an aircraft's rotors turn, so it is drawn afresh every frame)
  out.frames.groundMachines = await p.evaluate(() => {
    const s = window.PMC_STATE(), R = window.PMC;
    s.units.forEach(u => { if (u.cls === 'aircraft') u.x = -1; });
    return s.units.filter(u => R.isMachine(u) && u.alive && u.x >= 0).length;
  });
  out.frames.groundMs = await frames();

  // ---- 4.7: what the table holds
  const cv = await p.evaluate(() => window.__perf.canvases());
  out.canvases = Object.fromEntries(Object.entries(cv).map(([k, v]) => [k, mb(v)]));
  out.canvases.total = mb(Object.values(cv).reduce((a, v) => a + v, 0));
  out.errors = errs;

  if (JSON_OUT) console.log(JSON.stringify(out));
  else {
    console.log('menu      long tasks ' + out.menu.longTasks + ', worst ' + out.menu.worstMs + ' ms, total ' + out.menu.totalMs + ' ms');
    console.log('          ' + out.menu.list.map(e => e.ms + 'ms@' + e.at).join('  '));
    console.log('bake      table ' + out.bake.bakeMs + ' ms, structures repaint ' + out.bake.paintMs + ' ms');
    console.log('frames    table ' + out.frames.tableMs + ' ms, ' + out.frames.machines + ' machines in view ' + out.frames.machinesMs + ' ms, ' + out.frames.groundMachines + ' of them on the ground ' + out.frames.groundMs + ' ms');
    console.log('canvases  ' + Object.entries(out.canvases).map(([k, v]) => k + ' ' + v + ' MB').join(', '));
    console.log('errors    ' + (errs.join(' | ') || 'none'));
  }
  await b.close();
})();
