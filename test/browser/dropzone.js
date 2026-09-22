/* Being asked for a landing zone, on a phone.

   A unit held back for a Battlefield Insertion comes in from the second turn
   on, and the game stops and waits for the player to tap the ground it lands
   on. On a phone the panel under the board is a stack of tabs, and after a few
   turns the player is usually sitting on the combat results — so the prompt was
   drawn into a pane nobody was looking at, and the turn simply appeared to
   stop. Nothing in the header said what it was waiting for either.

   This drives the real reserve phase at phone size and checks the ask is where
   the eye is: the right pane in front, the header saying so, the legal ground
   shaded, and a tap on it actually bringing the unit down. */
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
  for (let i = 0; i < 14; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(150);
  }
  await p.waitForTimeout(120);
}

// hold a unit back and run the reserve phase, exactly as turn 2 would
const ASK = async () => {
  const s = window.PMC_STATE();
  s.turn = 3;
  s.objectives = [{ x: 24, y: 24, owner: null }];
  const held = s.units.find(u => u.side === 'A' && window.PMC.has(u, 'Battlefield Insertion'));
  if (!held) return { none: true };
  held.reserve = true; held.x = -1; held.y = -1; held.wave = undefined; held.alive = true;
  window.__reservePhase(() => { });
  await new Promise(r => setTimeout(r, 500));
  return { who: held.name, code: held.code };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(600);

  await p.evaluate(() => {
    window.PMC_NEWGAME({
      tier: 4, pl: 2, mode: 'ai', planet: 'barren', scenario: 'secure',
      nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd3', 'regular', 'nomads', 'veterans', 'hmgteam', 'lcv:tracked'],
      armyB: ['cmd3', 'regular', 'veterans', 'rookie']
    });
  });
  await p.waitForTimeout(1100);
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await drain(p);
  await p.evaluate(() => {
    const b2 = document.querySelector('button[data-act="start"]');
    if (b2) b2.click();
  });
  await p.waitForTimeout(700);
  await drain(p);

  /* The situation as reported: several turns in, reading the combat results. */
  head('The player is on the results tab when the drop comes due');
  await p.evaluate(() => window.__setMTab ? window.__setMTab('res') : (() => {
    const b3 = document.querySelector('#mtabs [data-mtab="res"]');
    if (b3) b3.click();
  })());
  await p.waitForTimeout(200);
  const before = await p.evaluate(() => document.querySelector('.console').getAttribute('data-mtab'));
  ok('...and the results pane is the one in front', before === 'res', 'showing "' + before + '"');

  const asked = await p.evaluate(ASK);
  ok('a unit is held back for a Battlefield Insertion', !asked.none, asked.who);

  head('So the ask is brought to where the eye is');
  const shown = await p.evaluate(() => {
    const con = document.querySelector('.console');
    const ctx = document.getElementById('context');
    const pane = con.getAttribute('data-mtab');
    const box = ctx.getBoundingClientRect();
    return {
      pane,
      asking: window.__insertionAsking(),
      card: /Battlefield Insertion/.test(ctx.innerHTML),
      out: /holdinsert/.test(ctx.innerHTML),
      // the pane the card is in has to be the visible one, and have a size
      visible: box.height > 20,
      pill: (document.getElementById('hdr-active') || {}).textContent || '',
      pillClass: (document.getElementById('hdr-active') || {}).className || ''
    };
  });
  ok('the game is waiting for a landing zone', shown.asking !== null, 'asking for ' + shown.asking);
  ok('...the Actions pane is brought to the front', shown.pane === 'act',
    'was "' + before + '", now "' + shown.pane + '"');
  ok('...the prompt is in it, and on screen', shown.card && shown.visible);
  ok('...with the way out offered', shown.out);
  ok('the header says what it is waiting for', /landing zone/i.test(shown.pill),
    '"' + shown.pill.trim() + '"');
  ok('...and marks it as waiting, not as ordinary status',
    /pill-wait/.test(shown.pillClass));

  head('And the ground it may land on is shaded');
  const ground = await p.evaluate(() => {
    const st = window.__insertionState();
    return { spots: st ? st.spots : 0, mode: window.__markState ? null : null };
  });
  ok('there is legal ground to land on', ground.spots > 0, ground.spots + ' drop points');

  head('Tapping it brings the unit down');
  const landed = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    const st = window.__insertionState();
    const code = st.unit;
    const spots = window.__insertionSpots(s.units.find(u => u.code === code));
    const spot = spots[Math.floor(spots.length / 2)];
    window.__dropHere(spot);
    await new Promise(r => setTimeout(r, 1400));
    const u = s.units.find(x => x.code === code);
    return {
      asking: window.__insertionAsking(),
      down: u.x >= 0 && !u.reserve,
      at: u.x.toFixed(1) + '", ' + u.y.toFixed(1) + '"',
      pill: (document.getElementById('hdr-active') || {}).textContent || ''
    };
  });
  ok('the unit is on the table', landed.down, 'at ' + landed.at);
  ok('...the prompt is closed', landed.asking === null);
  ok('...and the header goes back to the turn', !/landing zone/i.test(landed.pill),
    '"' + landed.pill.trim() + '"');

  /* ------------------------------------------------------- reinforcements */
  /* A scenario that holds part of the force back and releases it later used to
     place those units at a random point inside the legal area — a random spot
     in a landing zone, a random spot along the table edge. Where a unit comes
     on is a decision, so it is asked for the same way a drop is. */
  head('Scenario reinforcements are asked for, not rolled for');
  const inv = await p.evaluate(async () => {
    window.PMC_NEWGAME({
      tier: 4, pl: 2, mode: 'ai', planet: 'barren', scenario: 'invasion',
      nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd3', 'regular', 'veterans', 'rookie', 'lmgteam', 'lcv:tracked'],
      armyB: ['cmd3', 'regular', 'veterans', 'rookie']
    });
    await new Promise(r => setTimeout(r, 1100));
    return { held: window.PMC_STATE().units.filter(u => u.reserve).length };
  });
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await drain(p);
  await p.evaluate(() => {
    const s2 = document.querySelector('button[data-act="start"]');
    if (s2) s2.click();
  });
  await p.waitForTimeout(700);
  await drain(p);
  ok('the scenario holds part of the force back', inv.held > 0, inv.held + ' in reserve');

  const wave = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    /* Invasion: the attacker's first wave lands on turn 1 and the second from
       turn 4. Put the player on the attacking side with a second wave due. */
    s.sc.attacker = 'A'; s.sc.defender = 'B';
    s.turn = 4;
    const me = s.units.filter(u => u.side === 'A' && u.reserve);
    if (!me.length) return { none: true };
    me.forEach(x => { x.wave = 2; });
    const u = me[0];
    const before = { x: u.x, y: u.y };
    window.__reservePhase(() => { });
    await new Promise(r => setTimeout(r, 600));
    const st = window.__insertionState();
    return {
      who: u.name, before,
      asking: window.__insertionAsking(),
      kind: st ? st.kind : null,
      spots: st ? st.spots : 0,
      stillOff: u.x < 0,
      pill: (document.getElementById('hdr-active') || {}).textContent || '',
      card: document.getElementById('context').innerHTML
    };
  });
  ok('...and stops to ask where they come on', !wave.none && wave.asking !== null,
    wave.none ? 'nothing in reserve' : 'asking for ' + wave.asking);
  ok('...rather than putting them down somewhere itself', wave.stillOff,
    wave.who + ' is still off the table');
  ok('...offering only the ground the scenario allows', wave.spots > 0,
    wave.spots + ' places it may come on');
  ok('...saying so in the card', /Reinforcements/.test(wave.card || ''));
  ok('...and in the header', /reinforcements/i.test(wave.pill), '"' + wave.pill.trim() + '"');
  ok('...and it is an arrival, not a Battlefield Insertion', wave.kind === 'arrive',
    'kind: ' + wave.kind);

  const put = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    const st = window.__insertionState();
    const u = s.units.find(x => x.code === st.unit);
    const spots = window.__arrivalSpots(u);
    const spot = spots[Math.floor(spots.length / 2)];
    window.__dropHere(spot);
    await new Promise(r => setTimeout(r, 1200));
    return {
      down: u.x >= 0 && !u.reserve,
      where: u.x.toFixed(1) + '", ' + u.y.toFixed(1) + '"',
      asked: spot.x.toFixed(1) + '", ' + spot.y.toFixed(1) + '"',
      exact: Math.abs(u.x - spot.x) < 0.01 && Math.abs(u.y - spot.y) < 0.01
    };
  });
  ok('the unit comes on where it was told to', put.down, 'at ' + put.where);
  ok('...exactly there, with no scatter', put.exact, 'asked for ' + put.asked);

  /* ------------------------------------------------------------- the aim */
  /* The ground a reinforcement may come on is often a band an inch or two wide
     down one edge. A fingertip on a zoomed-out phone covers rather more than
     that, so a tap near the band has to count as a tap on it. */
  head('A tap near the legal ground counts as a tap on it');
  const aim = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    const me = s.units.filter(u => u.side === 'A' && u.reserve);
    me.forEach(x => { x.wave = 2; });
    s.turn = 4;
    if (!me.length) return { none: true };
    window.__reservePhase(() => { });
    await new Promise(r => setTimeout(r, 500));
    const st = window.__insertionState();
    if (!st) return { noAsk: true };
    const u = s.units.find(x => x.code === st.unit);
    const spots = window.__arrivalSpots(u);
    /* A point just outside the legal ground — a miss by the old exact rule, a
       hit by any real finger. Walk outward from a legal spot until the rule
       says no, so this holds whatever shape the scenario's area is. */
    /* Work outward from every legal spot until a point the rule refuses turns
       up within a few inches of one — the edge of the area, wherever it is. */
    let off = null, spot = null;
    outer:
    for (const sp of spots) {
      for (let d = 1; d <= 4; d += 0.5) {
        for (const [dx, dy] of [[d, 0], [0, d], [-d, 0], [0, -d], [d, d], [-d, -d]]) {
          const q = { x: sp.x + dx, y: sp.y + dy };
          if (q.x < 2 || q.y < 2 || q.x > 46 || q.y > 46) continue;
          if (!window.__arrivalLegal(u, q)) { off = q; spot = sp; break outer; }
        }
      }
    }
    if (!off) return { noEdge: true };
    const wasLegal = window.__arrivalLegal(u, off);
    window.__dropHere(off);
    await new Promise(r => setTimeout(r, 1200));
    return {
      wasLegal,
      down: u.x >= 0 && !u.reserve,
      landed: u.x.toFixed(1) + '", ' + u.y.toFixed(1) + '"',
      aimed: off.x.toFixed(1) + '", ' + off.y.toFixed(1) + '"',
      onLegalGround: window.__arrivalLegal(u, { x: u.x, y: u.y }) ||
        spots.some(sp => Math.abs(sp.x - u.x) < 0.01 && Math.abs(sp.y - u.y) < 0.01)
    };
  });
  ok('the point tapped was not itself legal',
    !aim.none && !aim.noAsk && !aim.noEdge && aim.wasLegal === false,
    aim.noEdge ? 'could not find ground just outside the area' : 'aimed at ' + aim.aimed);
  ok('...but the unit still came on', aim.down, 'landed at ' + aim.landed);
  ok('...on ground it is actually allowed to use', aim.onLegalGround);

  head('And how far off it may be follows the zoom');
  const reach = await p.evaluate(() => {
    const out = {};
    [4, 1, 0.55, 0.4, 0.25].forEach(z => {
      window.__setZoom(z);
      out['x' + z] = Math.round(window.__snapReach() * 10) / 10;
    });
    window.__setZoom(0.55);
    return out;
  });
  ok('zoomed right in, a near miss is still forgiven by six inches', reach.x4 === 6,
    reach.x4 + '" at ×4 — the same nudge deployment gives');
  ok('...and never less than that, however far in you are',
    [4, 1, 0.55, 0.4, 0.25].every(z => reach['x' + z] >= 6));
  ok('...but more once the table is small enough that a finger covers more',
    reach['x0.25'] > 6,
    [4, 1, 0.55, 0.4, 0.25].map(z => '×' + z + ': ' + reach['x' + z] + '"').join(', '));

  head('But a tap right across the table is still a miss');
  const wild = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    const me = s.units.filter(u => u.side === 'A' && u.reserve);
    if (!me.length) return { none: true };
    me.forEach(x => { x.wave = 2; });
    s.turn = 4;
    window.__reservePhase(() => { });
    await new Promise(r => setTimeout(r, 500));
    const st = window.__insertionState();
    if (!st) return { noAsk: true };
    const u = s.units.find(x => x.code === st.unit);
    const spots = window.__arrivalSpots(u);
    // the furthest corner from anywhere it may legally come on
    let far = { x: 24, y: 24 }, fd = 0;
    [[2, 2], [46, 2], [2, 46], [46, 46], [24, 24]].forEach(c => {
      const d = Math.min(...spots.map(sp => Math.hypot(sp.x - c[0], sp.y - c[1])));
      if (d > fd) { fd = d; far = { x: c[0], y: c[1] }; }
    });
    window.__dropHere(far);
    await new Promise(r => setTimeout(r, 400));
    return {
      gap: fd.toFixed(1),
      stillAsking: window.__insertionAsking() !== null,
      stillOff: u.x < 0,
      hint: (document.getElementById('context').innerText.match(/Not there[^\n]*/) || [''])[0]
    };
  });
  ok('a tap nowhere near is refused', !wild.none && !wild.noAsk && wild.stillOff,
    wild.gap + '" from the nearest legal ground');
  ok('...and the game is still waiting', wild.stillAsking);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
