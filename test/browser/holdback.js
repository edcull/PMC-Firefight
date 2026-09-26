/* A unit an attack displaces without a move of its own — the loser of an
   assault falling back 2" — is drawn where it was hit until the attack has
   been drawn, and only then goes where the rules put it. Otherwise the
   blows land on empty ground and the unit is already somewhere else. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
async function drain(p) {
  for (let i = 0; i < 20; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(110);
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  let got = null;
  for (let tries = 0; tries < 8 && !got; tries++) {
    await p.evaluate(() => {
      window.PMC_NEWGAME({ tier: 4, pl: 2, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
        armyA: ['cmd1', 'veterans', 'veterans', 'regular'], armyB: ['cmd1', 'rookie', 'rookie', 'regular'] });
    });
    await p.waitForTimeout(900);
    await drain(p);
    await p.evaluate(() => {
      const s = window.PMC_STATE();
      s.terrain.length = 0;
      s.units.forEach(u => { u.reserve = false; u.aboard = null; u.activated = false; });
      s.units.filter(u => u.side === 'A').forEach((u, i) => { u.x = 10; u.y = 10 + i * 6; });
      s.units.filter(u => u.side === 'B').forEach((t, i) => { t.x = 30; t.y = 10 + i * 6; });
      window.__rebuildScene(); window.__clearSel();
    });
    await p.waitForTimeout(200);
    await p.evaluate(() => { const b2 = document.querySelector('button[data-act="start"]'); if (b2) b2.click(); });
    await p.waitForTimeout(450);
    await drain(p);
    // a veteran squad a step from a rookie one, ready to go in
    const pair = await p.evaluate(() => {
      const s = window.PMC_STATE();
      s.activeSide = 'A'; s.initiative = 'A';
      s.units.forEach(u => { u.activated = false; });
      const a = s.units.find(u => u.side === 'A' && u.key === 'veterans');
      const t = s.units.find(u => u.side === 'B' && u.key === 'rookie');
      a.x = 20; a.y = 20; t.x = 23; t.y = 20; t.sp = 2;
      window.__rebuildScene(); window.__clearSel();
      window.__select(a);
      if (!window.__pressAction('assault')) return null;
      return { a: a.id, t: t.id, x: t.x, y: t.y };
    });
    if (!pair) continue;
    await p.waitForTimeout(150);
    // go in, and watch where the rookies are drawn while it plays
    const seen = await p.evaluate(async (pr) => {
      window.__shootAt(pr.t);
      const out = [];
      for (let i = 0; i < 120; i++) {
        const d = window.__drawnAt(pr.t);
        out.push({ busy: window.__busy(), q: window.__showQueue(), d: d });
        await new Promise(r => setTimeout(r, 25));
        if (i > 20 && !window.__busy() && !window.__showQueue()) break;
      }
      return out;
    }, pair);
    // where it is once everything has settled, taken fresh rather than the last sample in flight
    await p.waitForTimeout(300);
    const last = await p.evaluate((pr) => window.__drawnAt(pr.t), pair);
    const pushed = Math.hypot(last.rx - pair.x, last.ry - pair.y) > 0.5;
    if (!pushed) continue;                  // it held its ground (or was wiped out): try again
    got = { pair, seen, last };
  }
  ok('an assault drove the defenders back', !!got);
  if (process.env.DUMP && got) console.log(JSON.stringify(got.pair), got.seen.map(s => (s.busy ? 'B' : '-') + s.q + ' ' + s.d.x.toFixed(2) + ',' + s.d.y.toFixed(2)).join(' | '));
  if (got) {
    const during = got.seen.filter(s => s.busy);
    const heldBack = during.filter(s => Math.hypot(s.d.x - got.pair.x, s.d.y - got.pair.y) < 0.05).length;
    ok('...and while the assault was drawn they stood where they were hit', heldBack >= 3,
      heldBack + ' of ' + during.length + ' busy frames at the spot they were charged on');
    ok('...then went back to where the rules put them', Math.hypot(got.last.x - got.last.rx, got.last.y - got.last.ry) < 0.05,
      JSON.stringify(got.last));
  }
  /* A tank gun's first round goes up a moment after the shot is called. The
     table has to count as busy from the start, or the replay takes the shot
     as over, shows what it did and moves on before a round is in the air. */
  const shot = await p.evaluate(async () => {
    window.PMC_NEWGAME({ tier: 4, pl: 2, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd1', 'mcv:tracked', 'regular'], armyB: ['cmd1', 'rookie', 'rookie', 'regular'] });
    await new Promise(r => setTimeout(r, 900));
    for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await new Promise(r => setTimeout(r, 100)); }
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach(u => { u.reserve = false; u.aboard = null; u.activated = false; });
    s.units.filter(u => u.side === 'A').forEach((u, i) => { u.x = 10; u.y = 10 + i * 6; });
    s.units.filter(u => u.side === 'B').forEach((t, i) => { t.x = 26; t.y = 10 + i * 6; });
    window.__rebuildScene(); window.__clearSel();
    const b2 = document.querySelector('button[data-act="start"]'); if (b2) b2.click();
    await new Promise(r => setTimeout(r, 450));
    for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await new Promise(r => setTimeout(r, 100)); }
    s.activeSide = 'A'; s.initiative = 'A'; s.units.forEach(u => { u.activated = false; });
    const tank = s.units.find(u => u.side === 'A' && u.key === 'mcv');
    window.__clearSel(); window.__select(tank);
    if (!window.__pressAction('fire')) return { none: 'no fire' };
    const e = s.units.find(x => x.side === 'B' && x.alive && window.PMC.canShoot(s, tank, x, 'fire', {}));
    if (!e) return { none: 'nothing in sight' };
    window.__shootAt(e.id);
    const early = [];
    for (let i = 0; i < 6; i++) { early.push(window.__busy()); await new Promise(r => setTimeout(r, 0)); }
    return { early };
  });
  ok('a shot keeps the table busy from the moment it is taken', !shot.none && shot.early.every(Boolean),
    shot.none || shot.early.join(' '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
