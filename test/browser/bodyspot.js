/* The dead lie where their squad is drawn. A squad shot and then moved on in the
   same batch (your shot, then the AI's answer) stands where it was hit until its
   move plays; the men the shot killed fall there, not where the move will end. */
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
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  const got = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const drain = async () => { for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await wait(100); } };
    window.PMC_NEWGAME({ tier: 2, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: ['regular', 'regular'], armyB: ['regular', 'regular'] });
    await wait(900); await drain();
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach((u) => { u.reserve = false; u.aboard = null; u.bld = null; });
    s.units.filter((u) => u.side === 'A').forEach((u, i) => { u.x = 8; u.y = 8 + i * 10; });
    s.units.filter((u) => u.side === 'B').forEach((u, i) => { u.x = 36; u.y = 8 + i * 10; });
    window.__rebuildScene();
    window.__drawNow(); await wait(100);
    const t = s.units.find((u) => u.side === 'B');
    const before = window.__bodies()[t.id] || 0;
    // the batch is in: the rules have it 10" on, the table still draws it where it was hit
    t.ax = t.x; t.ay = t.y; t.x += 10;
    window.__drawNow(); await wait(100);
    // and the shot lands: two men down
    t.models -= 2;
    window.__drawNow(); await wait(100);
    return { before, after: window.__bodies()[t.id] || 0, at: window.__bodySpots ? window.__bodySpots(t.id) : null, drawn: { x: t.ax, y: t.ay }, rules: { x: t.x, y: t.y } };
  });
  ok('two men fall', got.after - got.before === 2, JSON.stringify(got));
  ok('...where the squad is drawn, not where the rules have it',
    got.at && got.at.length && got.at.every((q) => Math.abs(q.x - got.drawn.x) < 0.01 && Math.abs(q.y - got.drawn.y) < 0.01), JSON.stringify(got.at));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
