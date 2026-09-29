/* A Shield Generator's dome goes with the unit: while it moves the dome is
   drawn round it where it is drawn, not already waiting where it is going. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: window.PMC.rollArmy(3, 1, null, 'xeno').concat(['xshieldb']), armyB: ['cmd2', 'regular', 'regular', 'regular'] });
  });
  await p.waitForTimeout(900);
  for (let i = 0; i < 4; i++) {
    const done = p.getByRole('button', { name: /^done$/i });
    if (!(await done.count())) break;
    await done.first().click();
    await p.waitForTimeout(200);
  }
  const got = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach((x) => { x.reserve = false; x.aboard = null; x.bld = null; x.activated = false; });
    s.units.filter((x) => x.side === 'A').forEach((x, i) => { x.x = 4 + (i % 6) * 3; x.y = 30 + Math.floor(i / 6) * 3; });
    s.units.filter((x) => x.side === 'B').forEach((x, i) => { x.x = 40 + i * 2; x.y = 4; });
    const g = s.units.find((x) => x.side === 'A' && x.key === 'xshieldb');
    g.x = 10; g.y = 20;
    window.__rebuildScene(); window.__clearSel();
    const b2 = window.__beginButton(); if (b2) b2.click();
    await new Promise((r) => setTimeout(r, 450));
    for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await new Promise((r) => setTimeout(r, 100)); }
    s.activeSide = 'A'; s.units.forEach((x) => { x.activated = false; });
    const dome = () => window.__standing().find((f) => f.kind === 'dome');
    const start = dome();
    window.__select(g);
    if (!window.__pressAction('move')) return { none: 'no move' };
    const spots = window.__moveSpots().filter((q) => Math.hypot(q.x - g.x, q.y - g.y) > 6).sort((a, c) => Math.hypot(c.x - g.x, c.y - g.y) - Math.hypot(a.x - g.x, a.y - g.y));
    if (!spots.length) return { none: 'nowhere to go' };
    const to = spots[0];
    window.__tapMove(to); window.__previewConfirm();
    const frames = [];
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const d = dome(), at = window.__drawnAt(g.id);
      frames.push({ dx: d ? d.x : null, dy: d ? d.y : null, ux: at.x, uy: at.y });
      if (i > 20 && !window.__busy()) break;
    }
    return { start, to: { x: g.x, y: g.y }, frames };
  });
  if (got.none) { ok('the shield unit moved', false, got.none); }
  else {
    const f = got.frames;
    ok('the shield unit moved', Math.hypot(got.to.x - got.start.x, got.to.y - got.start.y) > 6,
      got.start.x.toFixed(1) + ',' + got.start.y.toFixed(1) + ' → ' + got.to.x.toFixed(1) + ',' + got.to.y.toFixed(1));
    const between = f.filter((q) => q.dx != null && Math.hypot(q.dx - got.to.x, q.dy - got.to.y) > 1 && Math.hypot(q.dx - got.start.x, q.dy - got.start.y) > 1);
    ok('its dome was drawn part way along while it moved', between.length >= 3, between.length + ' frames');
    ok('...always round the unit where it was drawn', f.every((q) => q.dx == null || Math.hypot(q.dx - q.ux, q.dy - q.uy) < 1e-6));
    const last = f[f.length - 1];
    ok('...and ends round it where it stopped', Math.hypot(last.dx - got.to.x, last.dy - got.to.y) < 1e-6);
  }
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
