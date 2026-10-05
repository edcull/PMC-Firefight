/* The action bar: every button at least wide enough for its label, no empty
   slots held open for special actions a unit does not have, and when there are
   more buttons than fit, a second line on a desktop and a row that scrolls
   sideways on a phone. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, shot } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

async function battle(p) {
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const drain = async () => { for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await wait(100); } };
    // a command unit: the most special actions of anything on the list
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd2', 'regular', 'regular', 'veterans'], armyB: ['cmd2', 'regular', 'regular', 'regular'] });
    await wait(900); await drain();
    window.__autoDeployBoth();
    await wait(300);
    const b = window.__beginButton(); if (b) b.click();
    await wait(500); await drain();
    // the bar is off until it is this screen's move: the walk-ons drawn first
    for (let i = 0; i < 150 && (window.__showQueue() > 0 || window.__busy()); i++) { await wait(100); await drain(); }
  });
}
// select the unit with the most actions on offer, and measure the bar
async function measure(p) {
  return p.evaluate(() => {
    const s = window.PMC_STATE();
    s.units.forEach((u) => { u.activated = false; });
    const mine = s.units.filter((u) => u.side === s.activeSide && u.alive && u.x >= 0);
    let best = mine[0], most = -1;
    mine.forEach((u) => { const n = window.__actionIds(u).length; if (n > most) { most = n; best = u; } });
    window.__clearSel(); window.__select(best);
    const bar = document.getElementById('bar'), br = bar.getBoundingClientRect();
    const slots = [...bar.querySelectorAll('.slot')].filter((b) => getComputedStyle(b).display !== 'none');
    const rows = new Set(slots.map((b) => Math.round(b.getBoundingClientRect().top)));
    return {
      unit: best.name, slots: slots.length, empty: bar.querySelectorAll('.slot.empty').length,
      narrowest: Math.min(...slots.map((b) => b.getBoundingClientRect().width)),
      rows: rows.size, barW: Math.round(br.width), scrollW: bar.scrollWidth, overflowX: getComputedStyle(bar).overflowX,
      outside: slots.filter((b) => { const r = b.getBoundingClientRect(); return r.right > br.right + 1 || r.left < br.left - 1; }).length,
      labels: slots.every((b) => { const sp = b.querySelector('span:last-child'); return !sp || sp.scrollWidth <= b.clientWidth; })
    };
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];

  for (const [w, h] of [[1340, 1000], [1060, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => errs.push(e.message));
    await battle(p);
    const m = await measure(p);
    console.log('\nDesktop, ' + w + 'px: ' + m.unit + ', ' + m.slots + ' buttons, the bar ' + m.barW + 'px');
    ok('no empty slots', m.empty === 0);
    ok('every button at least 86px wide', m.narrowest >= 85.5, Math.round(m.narrowest) + 'px');
    ok('...and every label fits its button', m.labels);
    ok('none past the edge of the bar', m.outside === 0);
    ok('more than fit on one line go on to the next', m.slots * 92 <= m.barW || m.rows >= 2, m.rows + ' line(s)');
    await p.screenshot({ path: shot('actionbar-' + w + '.png'), clip: await p.evaluate(() => { const r = document.getElementById('bar').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }) });
    await p.close();
  }

  {
    const p = await b.newPage({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    p.on('pageerror', (e) => errs.push(e.message));
    await battle(p);
    const m = await measure(p);
    console.log('\nPhone, 390px: ' + m.unit + ', ' + m.slots + ' buttons shown, the bar ' + m.barW + 'px');
    ok('no empty slots', m.empty === 0);
    ok('one row', m.rows === 1, m.rows + ' row(s)');
    ok('...that scrolls sideways when the buttons are wider than it', m.overflowX === 'auto', m.overflowX + ', ' + m.scrollW + 'px of buttons in ' + m.barW + 'px');
    ok('every button at least 62px wide', m.narrowest >= 61.5, Math.round(m.narrowest) + 'px');
    await p.close();
  }

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
