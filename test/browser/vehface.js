/* A vehicle put down on the table is asked which way it faces, the way a gun
   digging in is: the same octagon on the panel and round the hull on the
   table. Placed by hand or auto-deployed, each of the player's hulls is
   asked about in turn; the AI's face the enemy. The facing chosen is the one
   it starts the battle with, so its side and rear are where they should be. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, shot } = require('../where.js');

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
const ask = (p) => p.evaluate(() => {
  const fa = window.PMC_STATE().faceAsk;
  return fa ? { side: fa.side, ids: fa.ids.slice(), dir: fa.dir, card: !!document.querySelector('#context [data-vface]'),
    title: (document.querySelector('#context .card h2') || {}).textContent || '' } : null;
});
const near = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.01;

async function stage(p) {
  await p.evaluate(() => {
    if (window.PMCMenu) window.PMCMenu.close();
    window.PMC_NEWGAME({
      // Demolish with the player defending, who places before the battle (p. 54)
      tier: 3, pl: 1, mode: 'ai', planet: 'barren', scenario: 'demolish', roles: { attacker: 'B', defender: 'A' }, nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd3', 'regular', 'lcv', 'lcv', 'regular', 'regular'], armyB: ['regular', 'regular'], terrainSetup: 'auto'
    });
  });
  await p.waitForTimeout(900);
  await drain(p);
  /* the defender holds half back (p. 54): both vehicles go down now, so a rifle
     team waits in place of any vehicle the split held back */
  await p.evaluate(() => {
    window.__sendIntent({ k: 'autosplit' });
    const s = window.PMC_STATE();
    s.units.filter(u => u.side === 'A' && u.key === 'lcv' && u.reserve).forEach((v) => {
      const r = s.units.find(u => u.side === 'A' && u.key === 'regular' && !u.reserve);
      window.__sendIntent({ k: 'holdback', id: v.id });
      if (r) window.__sendIntent({ k: 'holdback', id: r.id });
    });
  });
  await p.waitForTimeout(200);
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  console.log('\n  Placing a vehicle by hand');
  await stage(p);
  const placed = await p.evaluate(() => {
    const s = window.PMC_STATE(), v = s.units.find(u => u.side === 'A' && u.key === 'lcv' && u.x < 0);
    window.__sendIntent({ k: 'deploypick', id: v.id });
    const at = window.__deployAim(4);
    window.__sendIntent({ k: 'deploy', id: v.id, x: at.x, y: at.y });
    return { id: v.id, x: v.x, y: v.y };
  });
  await p.waitForTimeout(250);
  let a = await ask(p);
  ok('it is asked which way it faces', !!a && a.ids[0] === placed.id && a.side === 'A', JSON.stringify(a));
  ok('...on the panel, with the octagon', !!a && a.card && /which way/.test(a.title), a && a.title);
  const offered = a && a.dir;
  // the enemy is off to the other side of the table: that is what is offered
  const toFoe = await p.evaluate((id) => {
    const s = window.PMC_STATE(), u = s.units.find(x => x.id === id);
    return u.side === 'A' ? Math.cos(s.faceAsk.dir) > 0.5 || Math.abs(Math.cos(s.faceAsk.dir)) < 0.8 : true;
  }, placed.id);
  ok('...offering the way towards the enemy', toFoe, 'dir ' + offered);
  ok('nothing else may be placed meanwhile from the table', await p.evaluate(() => !document.querySelector('#context [data-deploy], #context [data-act="autodeploy"]')));
  await p.screenshot({ path: shot('vehface-deploy.png') });
  // a tap round the hull, due south of it on the table
  await p.evaluate((pl) => { window.__boardTapAt(pl.x, pl.y + 2.2); }, placed);
  await p.waitForTimeout(250);
  const f1 = await p.evaluate((id) => window.PMC_STATE().units.find(u => u.id === id).facing, placed.id);
  ok('a tap round it on the table sets the facing', near(f1, Math.PI / 2), 'facing ' + f1);
  ok('...and the question is answered', !(await ask(p)));

  console.log('\n  Auto-deploying the rest');
  await p.evaluate(() => { const bt = document.querySelector('#context [data-act="autodeploy"]'); if (bt) bt.click(); else window.__sendIntent({ k: 'autodeploy' }); });
  await p.waitForTimeout(300);
  a = await ask(p);
  ok('the other vehicle is asked about too', !!a && a.ids.length === 1 && a.ids[0] !== placed.id, JSON.stringify(a));
  const second = a && a.ids[0];
  // the panel's octagon: NW on the screen, which is due west (a bearing of π) on the table
  await p.evaluate(() => { const bt = [...document.querySelectorAll('#context [data-vface]')].find(x => x.textContent === 'NW'); bt.click(); });
  await p.waitForTimeout(250);
  const f2 = await p.evaluate((id) => window.PMC_STATE().units.find(u => u.id === id).facing, second);
  ok('the panel octagon sets its facing', near(f2, Math.PI), 'facing ' + f2);
  ok('...and the battle may begin', !(await ask(p)) && !!(await p.evaluate(() => window.__beginButton())));
  await p.evaluate(() => window.__beginButton().click());
  await p.waitForTimeout(600);
  await drain(p);
  const kept = await p.evaluate((ids) => {
    const s = window.PMC_STATE();
    return { phase: s.phase, f: ids.map(id => s.units.find(u => u.id === id).facing),
      ai: s.units.filter(u => u.side === 'B' && u.cls === 'vehicle' && u.x >= 0).map(u => u.facing) };
  }, [placed.id, second]);
  ok('the battle starts with the facings chosen', kept.phase === 'battle' && near(kept.f[0], Math.PI / 2) && near(kept.f[1], Math.PI), JSON.stringify(kept));

  console.log('\n  Several at once');
  await stage(p);
  await p.evaluate(() => { window.__sendIntent({ k: 'autodeploy' }); });
  await p.waitForTimeout(300);
  a = await ask(p);
  ok('an auto-deploy asks about each vehicle in turn', !!a && a.ids.length === 2, JSON.stringify(a));
  ok('...offering to face them all at the enemy', await p.evaluate(() => /all at the enemy/.test((document.querySelector('#context [data-act="vfaceall"]') || {}).textContent || '')));
  await p.evaluate(() => document.querySelector('#context [data-act="vfaceall"]').click());
  await p.waitForTimeout(250);
  const all = await p.evaluate(() => window.PMC_STATE().units.filter(u => u.side === 'A' && u.cls === 'vehicle').map(u => u.facing));
  ok('...which answers for them all', !(await ask(p)) && all.every(f => f != null), JSON.stringify(all));

  console.log('\n  On a phone');
  await p.setViewportSize({ width: 400, height: 860 });
  await stage(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE(), v = s.units.find(u => u.side === 'A' && u.key === 'lcv' && u.x < 0);
    const at = window.__deployAim(4);
    window.__sendIntent({ k: 'deploy', id: v.id, x: at.x, y: at.y });
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: shot('vehface-phone.png') });
  ok('on a phone the octagon card shows too', !!(await ask(p)) && (await ask(p)).card);

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
