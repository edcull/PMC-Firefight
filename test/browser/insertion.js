/* Battlefield Insertion: held in reserve, arriving from the second turn on. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');
async function drain(p) {
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(180);
  }
  await p.waitForTimeout(120);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  // LRRP, snipers and nomads all carry Battlefield Insertion
  await startSkirmish(p, { tier: 4, mode: 'ai', keys: ['cmd1', 'veterans', 'veterans', 'lrrp', 'shock', 'protectors'] });
  await p.waitForTimeout(1300);
  await drain(p);

  const held = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return s.units.filter(u => u.reserve).map(u => u.code + '/' + u.side);
  });
  console.log('held in reserve at setup:', held.join(', ') || 'none');

  await p.evaluate(() => document.querySelector('button[data-act="autodeploy"]').click());
  await p.waitForTimeout(400);
  await drain(p);
  console.log('deployment complete with reserves out:', await p.evaluate(() => {
    const s = window.PMC_STATE();
    return { onTable: s.units.filter(u => u.x >= 0).length, reserve: s.units.filter(u => u.reserve).length };
  }));
  await p.waitForSelector('button[data-act="start"]', { timeout: 15000 });
  await p.evaluate(() => document.querySelector('button[data-act="start"]').click());
  await p.waitForTimeout(900);
  await drain(p);
  console.log('turn 1 — reserves still out:', await p.evaluate(() => {
    const s = window.PMC_STATE();
    return { turn: s.turn, reserve: s.units.filter(u => u.reserve).map(u => u.code) };
  }));

  // run the battle on by passing with every unit: on turn 2 the reserve phase fires
  for (let k = 0; k < 160; k++) {
    await drain(p);
    const st = await p.evaluate(() => {
      const s = window.PMC_STATE();
      return { turn: s.turn, over: !!s.over, asking: !!window.__insertionAsking(), reserve: s.units.filter(u => u.reserve).length };
    });
    if (!st.asking && !st.over) {
      await p.evaluate(() => {
        const s = window.PMC_STATE();
        if (s.activeSide !== 'A') return;
        const u = s.units.find(x => x.side === 'A' && x.alive && !x.activated && !x.reserve && !x.aboard && window.PMC.status(x) !== 'broken');
        if (!u) return;
        const li = [...document.querySelectorAll('.ru')].find(e => e.dataset.unit === u.id);
        if (li) li.click();
      });
      await p.waitForTimeout(120);
      await p.evaluate(() => {
        const btn = [...document.querySelectorAll('.slot')].find(x => /Regroup/.test(x.textContent));
        if (btn && !btn.disabled) btn.click();
      });
      await p.waitForTimeout(260);
    }
    if (st.asking) {
      const where = await p.evaluate(() => {
        // find any legal drop point
        const s = window.PMC_STATE();
        for (let i = 0; i < 4000; i++) {
          const x = 6 + Math.random() * 36, y = 6 + Math.random() * 36;
          if (window.__insertionLegal({ x, y })) { window.__dropHere({ x, y }); return x.toFixed(1) + ',' + y.toFixed(1); }
        }
        return 'no legal point found';
      });
      console.log('turn', st.turn, '— player drop placed at', where);
      await p.waitForTimeout(900);
      await drain(p);
      continue;
    }
    if (st.over || (st.turn >= 4 && !st.reserve)) break;
  }

  // and a drop inside 12" of the enemy draws a free shot from the nearest gun
  const hot = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.filter(x => x.side === 'A' && x.alive && x.x >= 0)[0];
    if (!u) return 'nothing left to drop';
    const foe = s.units.find(x => x.side === 'B' && x.alive && x.x >= 0 && x.fp !== null);
    if (!foe) return 'no enemy left';
    u.reserve = true; u.x = -1; u.y = -1; u.sp = 0;
    const before = s.log.length;
    window.__forceDrop(u, { x: foe.x + 5, y: foe.y });
    return s.log.slice(before).map(l => l.text).join(' | ');
  });
  console.log('a hot landing zone:', hot);

  console.log('final:', await p.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      turn: s.turn,
      reserve: s.units.filter(u => u.reserve).map(u => u.code),
      arrived: s.log.filter(l => /Battlefield Insertion|inserts/.test(l.text)).map(l => l.text)
    };
  }));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
