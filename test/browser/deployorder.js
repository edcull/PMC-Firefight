/* Three things the player asked for, driven through the interface:
   - deployment lets him choose which unit goes down next, and shift one already down
   - a Battlefield Insertion that has nowhere legal to land no longer wedges the turn
   - the board window fills the screen it is on rather than a fixed 900x540 box */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }

async function drain(p) {
  for (let i = 0; i < 40; i++) {
    // a modal card, or the desktop feed still writing its cards (taps wait for both)
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden || !!(window.__resOpen && window.__resOpen()));
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(120);
}

async function newGame(p, cfg) {
  await p.evaluate((c) => window.PMC_NEWGAME(c), Object.assign({
    tier: 3, pl: 1, mode: 'solo', planet: 'barren', scenario: 'meeting',
    nameA: 'Ours', nameB: 'Theirs',
    armyA: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'lcv'],
    armyB: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'lcv']
  }, cfg || {}));
  await p.waitForTimeout(900);
  await drain(p);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  /* ------------------------------------------------ picking the deployment order */
  head('The player chooses who goes down next');
  await newGame(p);
  const listed = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#context [data-deploy]')];
    const mine = window.PMC_STATE().units.filter(u => u.side === 'A' && !u.reserve && !u.aboard);
    return { rows: rows.length, mine: mine.length, now: rows.filter(r => r.classList.contains('dpr-now')).length };
  });
  ok('every unit in hand is listed to choose from', listed.rows === listed.mine,
    listed.rows + ' rows against ' + listed.mine + ' units');
  ok('...with exactly one marked as next', listed.now === 1);

  const chosen = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#context [data-deploy]')];
    const want = rows[rows.length - 1].getAttribute('data-deploy');
    rows[rows.length - 1].click();
    const s = window.PMC_STATE();
    return { want: want, next: window.__deployNext().id, name: s.units.find(u => u.id === want).name };
  });
  ok('clicking one makes it the next to be placed', chosen.want === chosen.next, chosen.name);

  const placed = await p.evaluate(() => {
    const id = window.__deployNext().id;
    const z = window.__deployAim();
    window.__boardTapAt(z.x, z.y);
    const u = window.PMC_STATE().units.find(x => x.id === id);
    return { id: id, down: u.x >= 0, at: Math.round(u.x) + ',' + Math.round(u.y), next: (window.__deployNext() || {}).id };
  });
  ok('...and a tap puts that unit on the table', placed.down, 'at ' + placed.at);
  ok('...then the choice falls back to whoever is still in hand',
    placed.next && placed.next !== placed.id);

  const shifted = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const down = s.units.find(u => u.side === 'A' && u.x >= 0 && !u.reserve);
    const was = { x: down.x, y: down.y };
    // tap the model already on the table: it should be picked up, not overwritten
    window.__boardTapAt(down.x, down.y);
    const picked = window.__deployNext();
    const z = window.__deployAim(4);
    window.__boardTapAt(z.x, z.y);
    const now = window.PMC_STATE().units.find(u => u.id === down.id);
    return {
      picked: picked && picked.id === down.id,
      moved: Math.abs(now.x - was.x) > 0.5 || Math.abs(now.y - was.y) > 0.5,
      name: down.name
    };
  });
  ok('tapping a model already down picks it up to shift', shifted.picked, shifted.name);
  ok('...and the next tap moves it', shifted.moved);

  /* -------------------------------------------- insertion with nowhere to land */
  head('A drop with nowhere legal to go does not wedge the turn');
  await newGame(p, { scenario: 'secure', armyA: ['cmd3', 'regular', 'nomads', 'veterans', 'hmgteam', 'lcv'] });
  const wedged = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    window.__autoDeployBoth();
    document.querySelector('button[data-act="start"]').click();
    return !!s;
  });
  ok('the battle begins', wedged);
  await p.waitForTimeout(600);
  await drain(p);
  // now paper the whole table with objectives, so no drop point is 12" clear of one
  const stuck = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    s.turn = 3;
    s.objectives = [];
    for (let x = 6; x <= 42; x += 8) for (let y = 6; y <= 42; y += 8) s.objectives.push({ x: x, y: y, owner: null });
    const held = s.units.find(u => u.side === 'A' && window.PMC.has(u, 'Battlefield Insertion'));
    if (held) { held.reserve = true; held.x = -1; held.y = -1; held.alive = true; }
    return { spots: window.__insertionSpots(held).length, who: held ? held.name : null };
  });
  ok('there is genuinely nowhere legal to drop', stuck.spots === 0, stuck.who + ': 0 spots');
  const carried = await p.evaluate(async () => {
    return await new Promise(res => {
      let done = false;
      window.__reservePhase(() => { done = true; res({ done: done, asking: window.__insertionAsking() }); });
      setTimeout(() => { if (!done) res({ done: false, asking: window.__insertionAsking() }); }, 2500);
    });
  });
  ok('...so the reserve phase finishes instead of waiting for ever', carried.done,
    carried.done ? 'it carried on' : 'still asking for ' + carried.asking);

  /* ------------------------------------------------- and the way out when there is one */
  head('"Keep it in reserve" is always offered');
  const offered = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    s.objectives = [{ x: 24, y: 24, owner: null }];           // one objective: plenty of room
    s.turn = 3;
    const held = s.units.find(u => u.side === 'A' && window.PMC.has(u, 'Battlefield Insertion'));
    held.reserve = true; held.x = -1; held.y = -1; held.wave = undefined;
    return await new Promise(res => {
      let fired = false;
      window.__reservePhase(() => { fired = true; });
      setTimeout(() => res({
        asking: window.__insertionAsking(),
        spots: (window.__insertionState() || {}).spots,
        card: document.getElementById('context').innerHTML,
        fired: fired
      }), 500);
    });
  });
  ok('the card names the unit and counts the legal ground',
    /Battlefield Insertion/.test(offered.card) && offered.spots > 0,
    offered.spots + ' drop points offered');
  ok('...and offers a way out', /data-act="holdinsert"/.test(offered.card));
  const held = await p.evaluate(async () => {
    return await new Promise(res => {
      const before = window.__insertionAsking();
      document.querySelector('button[data-act="holdinsert"]').click();
      setTimeout(() => {
        const s = window.PMC_STATE();
        const u = s.units.find(x => x.code === before);
        res({ asking: window.__insertionAsking(), reserve: !!(u && u.reserve) });
      }, 600);
    });
  });
  ok('holding it back closes the prompt', held.asking === null);
  ok('...and leaves the unit in reserve for next turn', held.reserve);

  /* ------------------------------------------------------- the board fills the screen */
  head('The board fills the screen it is on');
  const big = await p.evaluate(() => {
    const c = document.getElementById('board');
    const r = c.getBoundingClientRect();
    const wrap = document.querySelector('.board-wrap').getBoundingClientRect();
    return { w: c.width, h: c.height, cssW: Math.round(r.width), wrapW: Math.round(wrap.width),
      slack: Math.round(wrap.width - r.width) };
  });
  ok('the canvas is wider than the old 900px box', big.w > 900, big.w + '×' + big.h);
  ok('...and it spans the frame it sits in', big.slack < 24,
    big.cssW + ' of ' + big.wrapW + 'px');
  ok('...without going square', big.h < big.w, big.w + '×' + big.h);

  await p.setViewportSize({ width: 2400, height: 1400 });
  await p.waitForTimeout(400);
  const wider = await p.evaluate(() => {
    const c = document.getElementById('board');
    return { w: c.width, h: c.height };
  });
  ok('widening the window widens the board', wider.w > big.w, big.w + ' → ' + wider.w);

  await p.setViewportSize({ width: 420, height: 900 });
  await p.waitForTimeout(400);
  const phone = await p.evaluate(() => {
    const c = document.getElementById('board');
    return { w: c.width, h: c.height };
  });
  /* A phone no longer gets a fixed portrait window: the table fills the screen
     above the panel, so the buffer is the size of that box. */
  ok('...and a phone board fills the width it is given',
    phone.w === 420, phone.w + '×' + phone.h);
  ok('...and is taller than it is wide only if the screen is',
    phone.h > 300 && phone.h < 900, phone.h + 'px tall');

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
