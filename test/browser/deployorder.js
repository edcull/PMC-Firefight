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

/* Play the rest of the turn out. There is no hook to run the reserve phase on
   its own any more: it opens the next turn, inside the engine, so the turn is
   brought to an end the way a player would end it. Everyone but one of ours
   has already acted, and that one regroups; the rally and end phases follow,
   the next turn begins, and its reserve phase runs. */
async function endTurn(p) {
  await settle(p);
  const set = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const last = s.units.find(u => u.side === 'A' && u.alive && u.x >= 0 && !u.reserve && !u.aboard &&
      window.PMC.status(u) !== 'broken');
    if (!last) return { none: true };
    s.units.forEach(u => { u.activated = u !== last; });
    s.activeSide = 'A'; s.streak = 1; s.chain = null;
    window.__select(last);
    return { from: s.turn };
  });
  // the board takes the selection up once it has finished drawing what came before
  await settle(p);
  const acted = await p.evaluate(() => window.__pressAction('regroup'));
  return { from: set.from, acted: !set.none && acted };
}

// wait for the board to finish playing out whatever the engine last sent
async function settle(p) {
  for (let i = 0; i < 50; i++) {
    if (await p.evaluate(() => !window.__busy() && window.__showQueue() === 0)) break;
    await p.waitForTimeout(100);
  }
}

/* A game against the OpFor is mode 'ai' now; 'solo' is the solitaire game,
   where nobody sits in the other chair and its deployment waits for a player
   who never comes. */
async function newGame(p, cfg) {
  await p.evaluate((c) => window.PMC_NEWGAME(c), Object.assign({
    tier: 3, pl: 1, mode: 'ai', planet: 'barren', scenario: 'meeting',
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
  /* Now paper the table with objectives, so no drop point is 12" clear of one.
     The turn is going to be played out and scored this time, so they stand
     out of reach of both deployment strips: a side that found itself holding
     three of them would simply win, and the question would never be asked. */
  const stuck = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    s.turn = 3;
    s.objectives = [];
    for (let x = 12; x <= 36; x += 12) for (let y = 6; y <= 42; y += 12) s.objectives.push({ x: x, y: y, owner: null });
    const held = s.units.find(u => u.side === 'A' && window.PMC.has(u, 'Battlefield Insertion'));
    if (held) { held.reserve = true; held.x = -1; held.y = -1; held.alive = true; }
    return { spots: window.__insertionSpots(held).length, who: held ? held.name : null, code: held ? held.code : null };
  });
  ok('there is genuinely nowhere legal to drop', stuck.spots === 0, stuck.who + ': 0 spots');
  const turned = await endTurn(p);
  await p.waitForTimeout(600);
  await drain(p);
  const carried = await p.evaluate((code) => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.side === 'A' && x.code === code);
    return {
      asking: window.__insertionAsking(),
      turn: s.turn, phase: s.phase, over: !!s.over,
      // the turn goes on: somebody may act in it
      acting: window.__eligibleUnits().length,
      reserve: !!(u && u.reserve)
    };
  }, stuck.code);
  ok('...so the reserve phase finishes instead of waiting for ever',
    turned.acted && carried.turn > turned.from && carried.asking === null && carried.phase === 'battle' &&
      !carried.over && carried.acting > 0,
    carried.asking === null ? 'turn ' + turned.from + ' → ' + carried.turn + ', ' + carried.acting + ' units may act'
      : 'still asking for ' + carried.asking);
  ok('...and the unit stays in reserve', carried.reserve);

  /* ------------------------------------------------- and the way out when there is one */
  head('"Keep it in reserve" is always offered');
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.objectives = [{ x: 24, y: 24, owner: null }];           // one objective: plenty of room
    const held = s.units.find(u => u.side === 'A' && window.PMC.has(u, 'Battlefield Insertion'));
    held.reserve = true; held.x = -1; held.y = -1; held.wave = undefined;
  });
  await endTurn(p);
  await p.waitForTimeout(500);
  await drain(p);
  const offered = await p.evaluate(() => ({
    asking: window.__insertionAsking(),
    spots: (window.__insertionState() || {}).spots,
    card: document.getElementById('context').innerHTML
  }));
  ok('the card names the unit and counts the legal ground',
    /Battlefield Insertion/.test(offered.card) && offered.spots > 0,
    offered.spots + ' drop points offered');
  ok('...and offers a way out', /data-act="holdinsert"/.test(offered.card));
  const before = await p.evaluate(() => {
    const code = window.__insertionAsking();
    document.querySelector('button[data-act="holdinsert"]').click();
    return code;
  });
  /* The turn goes on at once, and the OpFor may already be shooting; the
     prompt leaves the card once the board has drawn all of that. */
  await p.waitForTimeout(600);
  await settle(p);
  await drain(p);
  await settle(p);
  const held = await p.evaluate((code) => {
    const u = window.PMC_STATE().units.find(x => x.side === 'A' && x.code === code);
    return { asking: window.__insertionAsking(), reserve: !!(u && u.reserve) };
  }, before);
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
