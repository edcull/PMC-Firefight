/* Dig in! (p. 94) chooses the facing: the gun "cannot be turned" once dug in,
   so the player picks which of the eight facings it digs in on — from an
   octagon on the panel, or a tap round the gun on the table, with the chosen
   facing's front 90° fire arc shown on the ground while choosing. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

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
    await p.waitForTimeout(140);
  }
  await p.waitForTimeout(120);
}

async function stage(p) {
  await p.evaluate(() => {
    window.PMC_NEWGAME({
      tier: 4, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: ['rmedart', 'rmilitia'], armyB: ['regular', 'regular']
    });
  });
  await p.waitForTimeout(800);
  await drain(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach((u) => { u.reserve = false; u.aboard = null; u.activated = false; u.dugIn = false; });
    const mine = s.units.filter(u => u.side === 'A'), theirs = s.units.filter(u => u.side === 'B');
    mine[0].x = 20; mine[0].y = 20; mine[0].facing = 0;
    mine[1].x = 10; mine[1].y = 36;
    theirs.forEach((t, i) => { t.x = 34 + i * 3; t.y = 24; });            // the enemy out to the east
    window.__rebuildScene();
    window.__clearSel();
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
  });
  await p.waitForTimeout(500);
  await drain(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A'; s.initiative = 'A';
    s.units.forEach(u => { u.activated = false; });
    window.__clearSel();
  });
  await p.waitForTimeout(150);
}
async function digIn(p) {
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    window.__select(s.units.find(u => u.key === 'rmedart'));
  });
  await p.waitForTimeout(200);
  return p.evaluate(() => {
    const b = [...document.querySelectorAll('.slot')].find(x => /Dig in/i.test(x.textContent));
    if (!b || b.disabled) return false;
    b.click(); return true;
  });
}
const gun = (p) => p.evaluate(() => { const g = window.PMC_STATE().units.find(u => u.key === 'rmedart'); return { dug: !!g.dugIn, facing: g.facing, activated: g.activated }; });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  console.log('\n  Choosing from the octagon');
  await stage(p);
  ok('Dig in! is offered and pressed', await digIn(p));
  await p.waitForTimeout(250);
  const card = await p.evaluate(() => ({
    dirs: [...document.querySelectorAll('.dig-dir')].map(x => x.textContent),
    on: (document.querySelector('.dig-dir.on') || {}).textContent || null
  }));
  ok('the panel shows an octagon of the eight facings', card.dirs.length === 8, card.dirs.join(' '));
  ok('...offering the one towards the enemy first', !!card.on, card.on);
  let g = await gun(p);
  ok('...and it has not dug in yet, nor spent its activation', !g.dug && !g.activated);
  if (process.env.DIG_SHOT) await p.screenshot({ path: process.env.DIG_SHOT }).catch(() => {});
  // choose south
  await p.evaluate(() => { const b2 = [...document.querySelectorAll('.dig-dir')].find(x => x.textContent === 'S'); b2.click(); });
  await p.waitForTimeout(400);
  await drain(p);
  g = await gun(p);
  const south = Math.PI / 4;                                   // straight down the screen
  ok('pressing S digs it in facing south', g.dug && Math.abs(g.facing - south) < 1e-6, (g.facing || 0).toFixed(3) + ' vs ' + south.toFixed(3));
  ok('...and that is its activation', g.activated);

  console.log('\n  Choosing with a tap round the gun');
  await stage(p);
  await digIn(p);
  await p.waitForTimeout(250);
  // a tap well to the west of the gun, on the table
  await p.evaluate(() => {
    const s = window.PMC_STATE(), gg = s.units.find(u => u.key === 'rmedart');
    window.__sendIntent({ k: 'digface', dir: Math.atan2(20.3 - gg.y, 14 - gg.x) });
  });
  await p.waitForTimeout(400);
  await drain(p);
  g = await gun(p);
  const facings = [0, 1, 2, 3, 4, 5, 6, 7].map(i => -Math.PI / 4 + i * Math.PI / 4);   // 45° apart on the table
  ok('it digs in on one of the eight facings', g.dug && facings.some(f => Math.abs(f - g.facing) < 1e-6), (g.facing || 0).toFixed(3));
  ok('...the one pointing west-ish', Math.cos(g.facing) < -0.3);

  console.log('\n  Letting it go');
  await stage(p);
  await digIn(p);
  await p.waitForTimeout(200);
  await p.evaluate(() => { const c = document.querySelector('[data-act="digcancel"]'); if (c) c.click(); });
  await p.waitForTimeout(300);
  g = await gun(p);
  ok('Cancel leaves it in its normal stance, still to act', !g.dug && !g.activated);

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
