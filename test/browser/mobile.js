/* The phone shell: the table fills everything above a fixed panel, and the panel
   holds the actions, the rolls as they land, the selected unit and both orders of
   battle behind four tabs. Nothing scrolls the page; the panel scrolls itself. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }

const PHONES = [
  { name: 'iPhone 14', w: 390, h: 844 },
  { name: 'small Android', w: 360, h: 740 },
  { name: 'large phone', w: 430, h: 932 }
];

async function boot(p) {
  await p.evaluate(() => window.PMC_NEWGAME({
    tier: 3, pl: 1, mode: 'solo', planet: 'industrial', scenario: 'meeting',
    nameA: 'Ours', nameB: 'Theirs',
    armyA: ['cmd3', 'regular', 'veterans', 'hmgteam', 'shock', 'lcv'],
    armyB: ['cmd3', 'regular', 'veterans', 'shock', 'engineers', 'lcv']
  }));
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    window.__autoDeployBoth();
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
  });
  await p.waitForTimeout(1600);
}

function metrics() {
  const r = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) };
  };
  const cv = document.getElementById('board');
  return {
    vw: window.innerWidth, vh: window.innerHeight,
    header: r('header'), board: r('.board-wrap'), console: r('.console'),
    canvas: { w: cv.width, h: cv.height },
    scrollable: document.documentElement.scrollHeight > window.innerHeight + 2,
    drawerBtn: (() => { const b = document.getElementById('btn-drawer'); return b && b.offsetParent !== null; })()
  };
}

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  for (const ph of PHONES) {
    const ctx = await br.newContext({
      viewport: { width: ph.w, height: ph.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(ph.name + ': ' + e.message));
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    await p.waitForTimeout(700);
    await boot(p);

    head(ph.name + ' (' + ph.w + '×' + ph.h + ')');
    const m = await p.evaluate(metrics);

    ok('the page itself does not scroll', !m.scrollable);
    ok('the header is a single tight row', m.header.h < 70, m.header.h + 'px');
    ok('the table starts under the header',
      Math.abs(m.board.top - m.header.bottom) <= 2, m.board.top + ' vs ' + m.header.bottom);
    ok('...and runs down to the panel',
      Math.abs(m.board.bottom - m.console.top) <= 2, m.board.bottom + ' vs ' + m.console.top);
    ok('the panel sits on the bottom of the screen',
      Math.abs(m.console.bottom - m.vh) <= 2, m.console.bottom + ' of ' + m.vh);
    ok('...and takes about a third of it',
      m.console.h / m.vh > 0.26 && m.console.h / m.vh < 0.42,
      Math.round(m.console.h / m.vh * 100) + '%');
    ok('the table fills the width', m.board.w === m.vw, m.board.w + ' of ' + m.vw);
    /* The buffer is drawn at the screen's pixel density (capped at 2), so it is
       a whole multiple of its box rather than the same size — what matters is
       that the multiple is the same both ways, or the table would be squashed. */
    const kx = m.canvas.w / m.board.w, ky = m.canvas.h / m.board.h;
    ok('...and the buffer is its box at the screen\'s density, so nothing is stretched',
      kx >= 1 && kx <= 2.05 && Math.abs(kx - ky) < 0.02,
      m.canvas.w + '×' + m.canvas.h + ' in ' + m.board.w + '×' + m.board.h +
        ' — ×' + kx.toFixed(2) + ' each way');
    ok('the old slide-out drawer is gone', !m.drawerBtn);

    /* ------------------------------------------- picking a unit, and acting */
    const picked = await p.evaluate(() => {
      const s = window.PMC_STATE();
      s.activeSide = 'A';
      s.units.forEach(u => { u.activated = false; });
      const u = s.units.find(x => x.side === 'A' && x.alive && !x.reserve);
      window.__select(u);
      const con = document.querySelector('.console');
      const barOn = [...document.querySelectorAll('#bar .slot')].filter(b => !b.disabled).length;
      return { tab: con.getAttribute('data-mtab'), name: u.name, actions: barOn };
    });
    ok('picking a unit brings the panel back to the actions', picked.tab === 'act', picked.name);
    ok('...with something to do', picked.actions > 0, picked.actions + ' actions live');

    const stats = await p.evaluate(() => {
      document.querySelector('#mtabs [data-mtab="unit"]').click();
      const box = document.getElementById('statstrip');
      return {
        shown: getComputedStyle(box).display !== 'none',
        named: /Field command|Regular rifle|Veterans|Heavy MG|Shock|combat vehicle/.test(box.textContent),
        inPanel: box.closest('.console') !== null
      };
    });
    ok('the Unit tab shows the selected unit’s card', stats.shown && stats.named);
    ok('...inside the panel, not adrift under the board', stats.inPanel);

    /* ------------------------------------------------------------ the tabs */
    const tabs = await p.evaluate(() => {
      const out = {};
      ['act', 'res', 'unit', 'force'].forEach(t => {
        document.querySelector('#mtabs [data-mtab="' + t + '"]').click();
        const con = document.querySelector('.console');
        const shown = [...con.querySelectorAll('.mpane')]
          .filter(e => getComputedStyle(e).display !== 'none')
          .map(e => e.id);
        out[t] = shown;
      });
      return out;
    });
    // (a unit is selected by now, so there is an action card to show)
    ok('Actions shows the action card alone', tabs.act.join() === 'context', tabs.act.join(' '));
    ok('Results shows the roll feed alone', tabs.res.join() === 'resfeed-m', tabs.res.join(' '));
    ok('Unit shows the selected unit alone', tabs.unit.join() === 'statstrip', tabs.unit.join(' '));
    ok('Forces shows both orders of battle alone', tabs.force.join() === 'panel-m', tabs.force.join(' '));

    const filled = await p.evaluate(() => {
      document.querySelector('#mtabs [data-mtab="force"]').click();
      const rows = document.querySelectorAll('#panel-m .ru').length;
      document.querySelector('#mtabs [data-mtab="res"]').click();
      const cards = document.querySelectorAll('#resfeed-m .feedcard').length;
      return { rows: rows, cards: cards };
    });
    ok('the forces pane lists every unit on the table', filled.rows === 12, filled.rows + ' rows');
    ok('the results pane has the rolls so far', filled.cards > 0, filled.cards + ' cards');

    const tall = await p.evaluate(() => {
      const bar = document.getElementById('bar').getBoundingClientRect();
      return { h: Math.round(bar.height), fits: bar.bottom < window.innerHeight };
    });
    ok('the action row is compact enough to leave room below it',
      tall.h < 130 && tall.fits, tall.h + 'px');

    await ctx.close();
  }

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await br.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
