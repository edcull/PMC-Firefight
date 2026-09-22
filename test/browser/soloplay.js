/* Every solitaire scenario played AI against AI for a few turns, solitaire
   and co-op: the turn loop has to keep turning (Beginning, Reserve, Action,
   OpFor, End) without stalling or throwing. COOP=1 runs the co-op version. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto('file://' + require('path').join(__dirname, 'index.html') + ''); await p.waitForTimeout(600); if (process.env.COOP) await p.evaluate(() => { window.__coop = true; });
  const scens = (process.env.SCENS || 's_crush,s_vip,s_decap,s_evac,s_sabotage,s_ambush').split(',');
  for (const sc of scens) {
    await p.evaluate((sc) => {
      const S = window.PMCSolo;
      const coop = !!window.__coop;
      const a1 = S.rollCommando(3, 1, 'pmc'), a2 = coop ? S.rollCommando(3, 1, 'rebel') : [];
      window.PMC_NEWGAME({ tier: 3, pl: coop ? 2 : 1, mode: 'demo', planet: 'sparse', scenario: sc, nameA: 'Commando', nameB: 'OpFor',
        armyA: a1.concat(a2), ownersA: a1.map(() => 1).concat(a2.map(() => 2)),
        armyB: S.rollOpFor(3, coop ? 2 : 1, 'rebel', false),
        solo: { coop: coop, faction: 'pmc', opFaction: 'rebel' } });
    }, sc);
    let last = null;
    for (let i = 0; i < (+process.env.STEPS || 400); i++) {
      await p.waitForTimeout(200);
      const r = await p.evaluate(() => {
        const s = window.PMC_STATE(); const c = document.getElementById('res-continue');
        if (c && !document.getElementById('resolution').hidden) c.click();
        return { t: s.turn, side: s.activeSide, over: s.over && s.over.text, ph: s.phase,
          A: s.units.filter(u => u.side === 'A' && u.alive && u.x >= 0).length,
          B: s.units.filter(u => u.side === 'B' && u.alive && u.x >= 0).length,
          pool: s.units.filter(u => u.side === 'B' && u.reserve).length, counters: (s.sc.counters || []).length };
      });
      last = r;
      if (r.over || r.t >= (+process.env.TURNS || 5)) break;
    }
    console.log(sc, JSON.stringify(last));
    if (!last || (!last.over && last.t < 2)) { errs.push(sc + ' stalled at turn ' + (last && last.t)); }
  }
  console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
