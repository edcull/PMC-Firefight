/* The red ! by a unit's suppression bar says it is past three times its
   Morale: at the Rally it flees the field unless it sheds enough first
   (p. 34). At Morale 3 that is 10 SP and over, not 9, and nothing to do with
   the 12 SP a unit can carry at most. */
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
      armyA: ['cmd2', 'regular', 'regular', 'regular', 'veterans', 'veterans', 'recon'], armyB: window.PMC.rollArmy(3, 1, null, 'pmc') });
  });
  await p.waitForTimeout(900);
  for (let i = 0; i < 4; i++) {
    const done = p.getByRole('button', { name: /^done$/i });
    if (!(await done.count())) break;
    await done.first().click();
    await p.waitForTimeout(200);
  }
  // a squad on the table, Morale set to 3 with no one lost
  const id = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find((x) => x.side === 'A' && x.key === 'regular');
    u.reserve = false; u.aboard = null; u.bld = null; u.x = 20; u.y = 18; u.morale = 3; u.models = u.size;
    window.__rebuildScene();
    return u.id;
  });
  async function mark(sp) {
    return p.evaluate(({ id, sp }) => {
      const u = window.PMC_STATE().units.find((x) => x.id === id);
      u.sp = sp; window.__clearSel(); window.__select(u);
      const m = document.querySelector('.moralebar .mb-max');
      const segs = [...(document.querySelector('.moralebar') || document).querySelectorAll('.sp-seg')];
      return { morale: window.PMC.currentMorale(u), shown: !!m, title: m ? m.title : '',
        segs: segs.length, lit: segs.filter((q) => q.classList.contains('lit')).length,
        bands: segs.map((q) => ({ good: 'g', warn: 'a', bad: 'r', flee: '.' })[q.classList[1]]).join('') };
    }, { id, sp });
  }
  console.log('\nA squad at Morale 3');
  const at9 = await mark(9);
  ok('9 SP (three times its Morale): no !', at9.morale === 3 && !at9.shown);
  const at10 = await mark(10);
  ok('10 SP (over three times): the !', at10.shown, at10.title);
  ok('...which says why', /over three times its Morale/.test(at10.title) && /flees/.test(at10.title));
  const at12 = await mark(12);
  ok('12 SP: still the !', at12.shown);
  const at5 = await mark(5);
  ok('5 SP: none', !at5.shown);
  ok('the panel\'s bar is the board\'s: twelve segments, in bands of the Morale', at5.segs === 12 && at5.bands === 'gggaaarrr...', at5.bands);
  ok('...lit one an SP', at5.lit === 5 && at10.lit === 10 && at12.lit === 12, [at5.lit, at10.lit, at12.lit].join(' / '));
  // a Morale lowered by losses lowers the line with it: 2 lost of a 6-man squad at Morale 3 is Morale 1 or so
  const lost = await p.evaluate((id) => {
    const u = window.PMC_STATE().units.find((x) => x.id === id);
    u.models = u.size - 2; u.sp = 3 * window.PMC.currentMorale(u) + 1;
    window.__clearSel(); window.__select(u);
    return { m: window.PMC.currentMorale(u), sp: u.sp, shown: !!document.querySelector('.moralebar .mb-max') };
  }, id);
  ok('the line is three times the current Morale, after losses', lost.m < 3 && lost.shown, 'Morale ' + lost.m + ', ' + lost.sp + ' SP');
  const lostBands = await p.evaluate(() => [...document.querySelector('.moralebar').querySelectorAll('.sp-seg')]
    .map((q) => ({ good: 'g', warn: 'a', bad: 'r', flee: '.' })[q.classList[1]]).join(''));
  ok('...and the bands narrow with it', lostBands === 'g'.repeat(lost.m) + 'a'.repeat(lost.m) + 'r'.repeat(lost.m) + '.'.repeat(12 - 3 * lost.m), lostBands);

  // to look at: 10 SP on the board
  await p.evaluate((id) => {
    const u = window.PMC_STATE().units.find((x) => x.id === id);
    u.models = u.size; u.sp = 10; window.__select(u); window.PMC_SETVIEW(20, 18, 2);
  }, id);
  await p.waitForTimeout(800);
  const box = await p.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await p.screenshot({ path: shot('fleemark.png'), clip: { x: box.x + box.width / 2 - 200, y: box.y + box.height / 2 - 200, width: 400, height: 300 } });
  // and the unit's panel beside it
  const panel = await p.evaluate(() => {
    const r = document.querySelector('.moralebar').parentElement.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 260) };
  });
  await p.screenshot({ path: shot('fleemark-panel.png'), clip: panel });

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
