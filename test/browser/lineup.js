/* The men of a squad only arrange themselves to the terrain the unit is
   tagged as in (R.kindsUnder, the terrain icon): lined along a low wall or
   down a trench, brought into a wood. A squad only near one keeps its ranks.
   And only the men move, never the unit, so a squad at a wall's end keeps its
   men to the stretch of wall its own base is against. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, shot } = require('../where.js');

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
      armyA: window.PMC.rollArmy(3, 1, null, 'rebel'), armyB: window.PMC.rollArmy(3, 1, null, 'pmc') });
  });
  await p.waitForTimeout(900);

  // a clear table, a line of sandbags 8" long running along x (1" thick, as they are laid), and the biggest squad of ours
  const id = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.terrain.push({ kind: 'barricade', x: 10, y: 20, w: 8, h: 1 });
    const u = s.units.filter((x) => x.side === 'A' && x.cls === 'infantry').sort((a, c) => (c.models || 1) - (a.models || 1))[0];
    s.units.forEach((x) => { x.reserve = false; x.aboard = null; x.bld = null; x.x = x.side === 'A' ? 40 : 44; x.y = 4; });
    u.x = 14; u.y = 20.5;
    s.units.filter((x) => x.side === 'B').forEach((x, i) => { x.x = 6 + i * 4; x.y = 32; });
    window.__rebuildScene();
    return u.id;
  });
  const models = await p.evaluate((id) => window.PMC_STATE().units.find((x) => x.id === id).models, id);
  const at = (x, y) => p.evaluate(({ id, x, y }) => window.__lineUp(id, x, y), { id, x, y });
  const tag = (x, y) => p.evaluate(({ x, y }) => window.PMC.kindsUnder(window.PMC_STATE(), null, x, y)[0], { x, y });
  // the first spot across the piece, at this point along it, where the rules tag the unit as in it
  const tagged = (x, y0, y1, kind) => p.evaluate(({ x, y0, y1, kind }) => {
    for (let y = y0; y <= y1; y += 0.02) if (window.PMC.kindsUnder(window.PMC_STATE(), null, x, y)[0] === kind) return y;
    return null;
  }, { x, y0, y1, kind });
  const REACH = 1.3 + 0.35;                    // the stretch either side of the unit, and half a step for a second rank
  const n = Math.min(10, models);

  console.log('\nA squad of ' + models + ' at a line of sandbags from x 10" to 18"');
  const yMid = await tagged(14, 19.5, 21.5, 'barricade');
  ok('on the wall, it is tagged as at the low wall', yMid != null, 'y ' + yMid);
  const mid = await at(14, yMid);
  ok('...and its men line it', !!mid && mid.length === n);
  ok('...all of them in behind it, away from the enemy', mid && mid.every((q) => q.y < 20), mid && mid.map((q) => q.y.toFixed(1)).join(' '));
  ok('...within the unit\'s reach along it', mid && mid.every((q) => Math.abs(q.x - 14) <= REACH + 1e-6), mid && mid.map((q) => q.x.toFixed(1)).join(' '));

  const yEnd = await tagged(17, 19.5, 21.5, 'barricade');
  ok('at the end of the wall, still tagged', yEnd != null, 'y ' + yEnd);
  const end = await at(17, yEnd);
  ok('...its men keep to the stretch its base is against, not slid down the wall away from it',
    end && end.every((q) => q.x >= 17 - REACH - 1e-6 && q.x <= 18), end && end.map((q) => q.x.toFixed(1)).join(' '));

  console.log('\nNot tagged as in the terrain: the men keep their ranks');
  for (const [x, y, what] of [[14, 21.4, 'beside the wall, not on it'], [18.6, 21.1, 'past the end of the wall']]) {
    const t = await tag(x, y);
    ok(what + ': not tagged', t !== 'barricade', t);
    ok('...and not lined up', (await at(x, y)) === null);
  }

  // a wood, and a trench
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.terrain.push({ kind: 'woods', x: 10, y: 10, w: 6, h: 6 }, { kind: 'trench', x: 24, y: 10, w: 8, h: 1.2 });
  });
  const beside = [16.9, 13];
  ok('beside a wood, not tagged', (await tag(...beside)) !== 'woods');
  ok('...and not drawn into it', (await at(...beside)) === null);
  ok('half in a trench\'s side but not tagged: not lined', (await tag(28, 11.9)) !== 'trench' && (await at(28, 11.9)) === null);
  const yTr = await tagged(28, 9.5, 11.7, 'trench');
  const tr = yTr == null ? null : await at(28, yTr);
  ok('tagged in the trench: lined down it, within its width', !!tr && tr.every((q) => q.y >= 10 && q.y <= 11.2),
    tr && tr.map((q) => q.y.toFixed(2)).join(' '));

  // to look at: the squad on the wall near its end, and past the end — each with its marker
  for (let i = 0; i < 4; i++) {
    const done = p.getByRole('button', { name: /^done$/i });
    if (!(await done.count())) break;
    await done.first().click();
    await p.waitForTimeout(200);
  }
  async function look(name, x, y) {
    await p.evaluate(({ id, x, y }) => {
      const s = window.PMC_STATE(), u = s.units.find((q) => q.id === id);
      s.terrain.length = 0;
      s.terrain.push({ kind: 'barricade', x: 10, y: 20, w: 8, h: 1 });
      u.x = x; u.y = y;
      window.__rebuildScene(); window.__select(u); window.PMC_SETVIEW(16, 20.5, 2);
    }, { id, x, y });
    await p.waitForTimeout(1500);
    console.log('    ' + name + ': wall ends at ' + JSON.stringify(await p.evaluate(() => [window.__canvasAt(10, 20.5), window.__canvasAt(18, 20.5)])) +
      ', unit at ' + JSON.stringify(await p.evaluate(({ x, y }) => window.__canvasAt(x, y), { x, y })));
    const box = await p.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    await p.screenshot({ path: shot(name), clip: box });
  }
  await look('lineup-end.png', 17, yEnd);
  await look('lineup-past.png', 18.6, 21.1);

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
