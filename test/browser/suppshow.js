/* Against the AI, on a phone: the player's unit acts, and the other side's
   answer — already resolved — comes back in the same batch. A unit of the
   player's that the answer shoots at keeps the suppression it had until the
   shot at it is drawn: it does not take it the moment its own activation has
   finished playing, before the enemy has so much as fired. */
const { chromium } = require('playwright');
const { page: PAGE } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

async function boot(p) {
  await p.evaluate(() => window.PMC_NEWGAME({
    tier: 3, pl: 1, mode: 'ai', aiSides: ['B'], planet: 'industrial', scenario: 'meeting',
    nameA: 'Ours', nameB: 'Theirs',
    armyA: ['cmd3', 'regular', 'veterans', 'shock'],
    armyB: ['cmd3', 'regular', 'veterans', 'shock']
  }));
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = window.__beginButton(); if (b) b.click(); });
  await p.waitForTimeout(500);
}
const card = (p) => p.evaluate(() => !document.getElementById('resolution').hidden);
const cont = (p) => p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
// put the cards away, and wait for the table to be the player's again
async function settle(p, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await card(p)) { await cont(p); await p.waitForTimeout(80); continue; }
    if (await p.evaluate(() => { const s = window.PMC_STATE(); return !!s.over || (s.activeSide === 'A' && !!window.__mySide() && !window.__busy() && !window.__showQueue()); })) return true;
    await p.waitForTimeout(80);
  }
  return false;
}

/* One exchange: one of ours squared up to one of theirs in the open, the rest
   of theirs already spent so the AI answers with that unit. Ours acts (`how`),
   and each shot of theirs at it is sampled as it starts to be drawn. */
async function exchange(p, how) {
  return p.evaluate((how) => {
    const s = window.PMC_STATE(), R = window.PMC;
    // a full squad of ours, and their hardest-hitting one
    const squad = (side) => s.units.filter(u => u.side === side && u.alive && u.x >= 0 && !u.aboard && u.cls === 'infantry' && !u.command && u.fp !== null && !u.activated);
    const mine = squad('A').sort((x, y) => y.models - x.models);
    const theirs = squad('B').sort((x, y) => y.fp * y.models - x.fp * x.models);
    if (!mine.length || !theirs.length) return { skip: 'no pair' };
    const a = mine[0], b = theirs[0];
    // somewhere in the open, in sight and in range of each other
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      const x = 6 + Math.random() * 36, y = 8 + Math.random() * 30, d = 6 + Math.random() * 6;
      const ang = Math.random() * Math.PI * 2;
      a.x = x; a.y = y; b.x = x + Math.cos(ang) * d; b.y = y + Math.sin(ang) * d;
      if (b.x < 1 || b.y < 1 || b.x > 47 || b.y > 47) continue;
      found = R.canShoot(s, b, a, 'fire', {}) && R.canShoot(s, a, b, 'fire', {});
    }
    if (!found) return { skip: 'no open ground' };
    s.units.forEach(u => { if (u.side === 'B' && u !== b) u.activated = true; });
    b.activated = false; a.sp = 0; b.sp = 0;
    const before = {};
    s.units.forEach(u => { if (u.side === 'A') before[u.id] = window.__shownAs(u.id); });
    window.__shots = [];
    window.__traceShow = {
      push(o) {
        if (o.e !== 'shoot' && o.e !== 'assault') return;
        const t = s.units.find(u => u.id === o.to);
        if (t === a) window.__shots.push({ to: o.to, before: before[o.to], drawn: window.__shownAs(o.to), now: t.sp + ' SP, ' + t.models + ' models' });
      }
    };
    window.__select(a);
    if (how === 'move') {
      if (!window.__pressAction('move')) return { skip: 'no move' };
      // a short step, staying where it can be seen
      const near = window.__moveSpots().filter(m => Math.hypot(m.x - a.x, m.y - a.y) < 2.5);
      const spot = near[0];
      if (!spot) return { skip: 'no spot' };
      window.__tapMove(spot);
      window.__previewConfirm();
    } else if (!window.__pressAction(how)) return { skip: 'no ' + how };
    return { a: a.id, b: b.id };
  }, how);
}

(async () => {
  const br = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const p = await br.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + PAGE); await p.waitForTimeout(600);

  for (const how of ['skip', 'regroup', 'move']) {
    console.log('\n  our unit acts (' + how + '), and theirs shoots back');
    const shots = [];
    for (let game = 0; game < 10 && !shots.some(x => x.hit); game++) {
      await boot(p);
      if (!await settle(p, 20000)) continue;
      const r = await exchange(p, how);
      if (r.skip) continue;
      await settle(p, 20000);
      const got = await p.evaluate(() => window.__shots);
      got.forEach(x => { x.hit = x.now !== x.before; shots.push(x); });
      await p.evaluate(() => { window.__traceShow = null; });
    }
    const hits = shots.filter(x => x.hit);
    ok('the other side’s shot suppressed one of ours', hits.length > 0, shots.length + ' shots sampled');
    const early = hits.filter(x => x.drawn !== x.before);
    ok('...which still looked as it was until the shot was drawn', hits.length > 0 && early.length === 0,
      early.map(x => x.to + ' showed ' + x.drawn + ' (was ' + x.before + ', after ' + x.now + ')').join('; '));
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
