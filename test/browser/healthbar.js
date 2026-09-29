/* A machine's health is drawn in the same bar as a squad's Suppression: a
   segment a point of Structure, the points left green while over two thirds
   of it, amber down to a third, red below, and the points lost black at the
   end. On the board only once it has taken damage; in its panel always. */
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

  // the segments themselves: G green, A amber, R red, b lost
  const cols = await p.evaluate(() => [0, 1, 2, 3, 4, 5].map((d) => window.PMCIso.strSegments(6, d)
    .map((q) => ({ good: 'G', warn: 'A', bad: 'R', lost: 'b' })[q]).join('')));
  console.log('\nStructure 6');
  ok('undamaged: all green', cols[0] === 'GGGGGG', cols[0]);
  ok('1 damage: G,G,G,G,G,b', cols[1] === 'GGGGGb', cols[1]);
  ok('2 damage (two thirds left): A,A,A,A,b,b', cols[2] === 'AAAAbb', cols[2]);
  ok('3 damage: still amber', cols[3] === 'AAAbbb', cols[3]);
  ok('4 damage (a third left): R,R,b,b,b,b', cols[4] === 'RRbbbb', cols[4]);
  ok('5 damage: R,b,b,b,b,b', cols[5] === 'Rbbbbb', cols[5]);
  const n = await p.evaluate(() => [3, 16].map((s) => window.PMCIso.strSegments(s, 0).length));
  ok('a segment a point, whatever the Structure', n[0] === 3 && n[1] === 16, n.join(' / '));

  // in the panel: a Light command vehicle (Structure 6), always shown
  await p.evaluate(() => {
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd2', 'regular', 'regular', 'lcv'], armyB: ['cmd2', 'regular', 'regular', 'regular'] });
  });
  await p.waitForTimeout(900);
  for (let i = 0; i < 4; i++) {
    const done = p.getByRole('button', { name: /^done$/i });
    if (!(await done.count())) break;
    await done.first().click();
    await p.waitForTimeout(200);
  }
  const id = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach((x) => { x.reserve = false; x.aboard = null; x.bld = null; x.x = 2; x.y = 34; x.sp = 0; });
    const v = s.units.find((x) => x.side === 'A' && x.key === 'lcv');
    v.x = 22; v.y = 18; v.cargo = [];
    window.__rebuildScene();
    return v.id;
  });
  const panel = (d) => p.evaluate(({ id, d }) => {
    const v = window.PMC_STATE().units.find((x) => x.id === id);
    v.damage = d; window.__clearSel(); window.__select(v);
    const bar = document.querySelector('.healthbar');
    return bar ? [...bar.querySelectorAll('.sp-seg')].map((q) => q.classList.contains('flee') ? 'b' : ({ good: 'G', warn: 'A', bad: 'R' })[q.classList[1]]).join('') : null;
  }, { id, d });
  console.log('\nIn the panel');
  ok('undamaged, the bar is there, all green', (await panel(0)) === 'GGGGGG');
  ok('2 damage: as the board draws it', (await panel(2)) === 'AAAAbb');
  ok('4 damage', (await panel(4)) === 'RRbbbb');
  const squad = await p.evaluate(() => {
    const u = window.PMC_STATE().units.find((x) => x.side === 'A' && x.key === 'regular');
    u.sp = 0; window.__clearSel(); window.__select(u);
    return document.querySelectorAll('.moralebar')[0].querySelectorAll('.sp-seg').length;
  });
  ok('a squad with no Suppression: its bar is there too', squad === 12);

  // to look at: 2 damage on the board, and the panel
  await p.evaluate((id) => { const v = window.PMC_STATE().units.find((x) => x.id === id); v.damage = 2; window.__select(v); window.PMC_SETVIEW(22, 18, 2); }, id);
  await p.waitForTimeout(800);
  const box = await p.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await p.screenshot({ path: shot('healthbar.png'), clip: { x: box.x + box.width / 2 - 200, y: box.y + box.height / 2 - 220, width: 400, height: 300 } });
  const pr = await p.evaluate(() => { const r = document.querySelector('.healthbar').parentElement.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 200) }; });
  await p.screenshot({ path: shot('healthbar-panel.png'), clip: pr });

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
