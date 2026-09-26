/* Demolition, driven through the interface: a wall shelled flat, a building burned
   out with its garrison turned into the street, and a tank driving through a
   barricade. Writes a before-and-after sheet. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS, startSkirmish } = require('../where.js');

async function drain(p) {
  for (let i = 0; i < 14; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(180);
  }
  await p.waitForTimeout(120);
}
async function shot(p, name) {
  await p.waitForTimeout(500);
  await p.locator('.board-wrap').screenshot({ path: path.join(SHOTS, name) });
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  // a meeting engagement: it opens straight on deployment, whatever the dice (the stage is rebuilt below anyway)
  await startSkirmish(p, { tier: 4, mode: 'hotseat', scenario: 'meeting', keys: ['cmd1', 'veterans', 'shock', 'mcv:tracked', 'protectors', 'veterans'] });
  await p.waitForTimeout(1400);
  await drain(p);
  // both forces down through the board's own hook: the deployment card may open on a unit already
  // being placed rather than on the list with Auto-deploy under it
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await drain(p);
  // and the battle begun the same way, as clienttest begins its own
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(800);
  await drain(p);

  // a clean stage: one wall, one building, one barricade, and nothing else
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A';
    s.terrain.length = 0;
    s.terrain.push({ kind: 'wall', x: 22, y: 14, w: 6, h: 1 });
    s.terrain.push({ kind: 'building', x: 21, y: 21, w: 4, h: 4 });
    s.terrain.push({ kind: 'barricade', x: 30, y: 20, w: 1, h: 6 });
    const mine = s.units.filter(u => u.side === 'A');
    const mcv = mine.find(u => u.cls === 'vehicle');
    const shock = mine.find(u => /Shock/.test(u.name));
    const rest = mine.filter(u => u !== mcv && u !== shock);
    mcv.x = 34; mcv.y = 23; mcv.facing = Math.PI; mcv.activated = false;
    shock.x = 18; shock.y = 16; shock.activated = false;
    rest.forEach((u, i) => { u.x = 12; u.y = 30 + i * 2; u.activated = true; });
    const foe = s.units.filter(u => u.side === 'B');
    foe[0].x = 23; foe[0].y = 23;                       // garrisoning the building
    foe.slice(1).forEach((u, i) => { u.x = 44; u.y = 40 + i; });
    window.__rebuildScene();
    window.PMC_SETVIEW(25, 20, 1.5);
    return true;
  });
  await shot(p, 'demolition-before.png');
  console.log('stage set');

  async function pick(code, action, at) {
    await p.evaluate((arg) => {
      const s = window.PMC_STATE();
      s.activeSide = 'A';
      const u = s.units.find(x => x.code === arg.c);
      u.activated = false;
      if (arg.at) { u.x = arg.at[0]; u.y = arg.at[1]; }   // a failed charge falls back
      const li = [...document.querySelectorAll('.ru')].find(e => e.textContent.includes(arg.c));
      if (li) li.click();
    }, { c: code, at: at });
    await p.waitForTimeout(250);
    await p.evaluate((a) => {
      const btn = [...document.querySelectorAll('.slot')].find(x => x.textContent.indexOf(a) >= 0);
      if (btn && !btn.disabled) btn.click();
    }, action);
    await p.waitForTimeout(200);
  }
  async function strike(kindWanted, code, action, at) {
    for (let k = 0; k < 14; k++) {
      await pick(code, action, at);
      if (k === 0) {
        console.log('  bar for ' + code + ':', await p.evaluate(() => [...document.querySelectorAll('.slot')]
          .map(x => x.textContent.replace(/\s+/g, '') + (x.disabled ? '(off)' : '')).join(' ')));
        console.log('  offered:', await p.evaluate(() => window.__terrainPicks()));
      }
      const i = await p.evaluate((kw) => {
        const s = window.PMC_STATE();
        const picks = window.__terrainList();
        return picks.findIndex(r => r.kind === kw);
      }, kindWanted);
      if (i < 0) return false;
      await p.evaluate((idx) => window.__tapTerrain(idx), i);
      await p.waitForTimeout(800);
      await drain(p);
      const done = await p.evaluate((kw) => !window.PMC_STATE().terrain.some(t => t.kind === kw), kindWanted);
      if (done) return k + 1;
    }
    return false;
  }

  const wallShots = await strike('wall', 'MCV', 'Demolish', [34, 23]);
  console.log('high wall shelled flat after', wallShots, 'shell(s)');
  const bldShots = await strike('building', 'SHK', 'Breach', [18, 16]);
  console.log('building breached after', bldShots, 'charge(s)');

  const after = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const foe = s.units.filter(u => u.side === 'B' && u.alive)[0];
    return {
      terrain: s.terrain.map(t => t.kind).join(', '),
      garrison: foe ? { x: +foe.x.toFixed(1), y: +foe.y.toFixed(1), inside: foe.x >= 21 && foe.x <= 25 && foe.y >= 21 && foe.y <= 25 } : null,
      log: s.log.filter(l => /brings down|scrambles/.test(l.text)).map(l => l.text)
    };
  });
  console.log('after the demolitions:', JSON.stringify(after, null, 1));
  await p.evaluate(() => { window.__clearSel(); window.PMC_SETVIEW(25, 20, 1.5); });
  await shot(p, 'demolition-after.png');

  // and the tank simply drives through what is left
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A';
    const mcv = s.units.find(u => u.side === 'A' && u.cls === 'vehicle');
    mcv.x = 34; mcv.y = 23; mcv.facing = Math.PI; mcv.activated = false;
    window.__clearSel();
    const li = [...document.querySelectorAll('.ru')].find(e => e.textContent.includes('MCV'));
    if (li) li.click();
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.slot')].find(x => /Move/.test(x.textContent));
    if (btn && !btn.disabled) btn.click();
  });
  await p.waitForTimeout(300);
  const drove = await p.evaluate(() => {
    const cells = window.__moves;
    if (!cells.length) return 'the move never opened (' + cells.length + ' cells)';
    const spot = cells.filter(c => c.x < 29.5 && Math.abs(c.y - 23) < 0.6)
      .sort((a, b) => a.x - b.x)[0];
    if (!spot) return 'no route past the barricade';
    window.__tapMove(spot);          // preview
    window.__previewConfirm();       // and go
    return spot.x.toFixed(1) + ',' + spot.y.toFixed(1);
  });
  await p.waitForTimeout(900);
  await drain(p);
  console.log('the tank drove to', drove, '— terrain now:',
    await p.evaluate(() => window.PMC_STATE().terrain.map(t => t.kind).join(', ')));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
