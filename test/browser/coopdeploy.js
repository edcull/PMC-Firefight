/* A co-operative game's deployment: the two commandos are one side, put down a
   player at a time — Player 1's commando, then the device passed to Player 2 for
   theirs — with the top bar naming the player deploying in their colours and the
   order of battle listing only their units. In Ambush! the even split is the two
   commandos' together, so one may hold the north and the other the south. Once
   everything is down, a unit on the table can be picked up and put down again. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');
const { startCoop } = require('../hotseat.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await startCoop(p, { scenario: 's_ambush', factionB: 'rebel' });
  // the briefing and any cards out of the way
  await p.evaluate(() => { const d = document.getElementById('obj-done'); if (d && !document.getElementById('obj-modal').hidden) d.click(); });
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => { const r = document.getElementById('resolution'); if (r && !r.hidden) document.getElementById('res-continue').click(); if (document.querySelector('[data-act="deployready"]')) window.__sendIntent({ k: 'deployready' }); });
    await p.waitForTimeout(150);
  }
  const look = () => p.evaluate(() => {
    const s = window.PMC_STATE(), ho = document.getElementById('handover');
    const ids = [...document.querySelectorAll('[data-deploy]')].map(b => b.getAttribute('data-deploy'));
    return { pill: document.getElementById('hdr-active').textContent, cls: document.getElementById('hdr-active').className,
      card: ho && !ho.hidden ? ho.textContent : null,
      owners: [...new Set(ids.map(id => (s.units.find(u => u.id === id) || {}).owner || 1))].join(),
      names: s.solo.names, first: s.solo.deployFirst || 1, inHand: s.units.filter(u => u.side === 'A' && u.x < 0 && !u.aboard).map(u => u.owner || 1) };
  });
  let s = await look();
  const F = s.first, S = 3 - F, pillOf = (o) => o === 2 ? /pill-C/ : /pill-P1/;
  ok('which commando sets up first is rolled, and said', await p.evaluate((n) => window.PMC_STATE().log.some(l => l.text.indexOf(n + ' sets up first (rolled)') === 0), s.names[F - 1]), s.names[F - 1]);
  ok('the top bar names that player as deploying, in their colours', s.pill === 'Deploying: ' + s.names[F - 1] && pillOf(F).test(s.cls), s.pill + ' ' + s.cls);
  ok('...the order of battle lists only their commando', s.owners === String(F), s.owners);
  ok('...and nobody is asked to take the device yet', !s.card, s.card);

  // Player 1 puts the whole commando down north of the road
  const placeAll = (north) => p.evaluate((north) => {
    const H = 48, done = [], first = window.__deployNext(), own = first && (first.owner || 1);
    for (let g = 0; g < 30; g++) {
      const u = window.__deployNext(); if (!u || u.x >= 0 || (u.owner || 1) !== own) break;
      let put = false;
      for (let y = north ? H / 2 - 4 : H / 2 + 4; !put && (north ? y > H / 2 - 14 : y < H / 2 + 14); y += north ? -1.5 : 1.5) {
        for (let x = 3; !put && x < 46; x += 2.5) {
          if (!window.__deployOK(x, y, 'A')) continue;
          const was = u.x;
          window.__sendIntent({ k: 'deploy', id: u.id, x, y });
          if (window.PMC_STATE().units.find(z => z.id === u.id).x >= 0 && was < 0) put = true;
        }
      }
      if (!put) break;
      if (window.PMC_STATE().faceAsk) window.__sendIntent({ k: 'vfaceall' });
      done.push(u.id);
    }
    return done.length;
  }, north);
  const p1 = await placeAll(true);
  await p.waitForTimeout(300);
  s = await look();
  ok('the first puts their commando down, all to the north', p1 > 0 && s.inHand.every(o => o === S), p1 + ' placed; in hand ' + s.inHand.join());
  ok('then the device goes to the other player', !!s.card && s.card.indexOf(s.names[S - 1]) >= 0, s.card);
  await p.evaluate(() => document.getElementById('handover').click());
  await p.waitForTimeout(200);
  s = await look();
  ok('...the top bar names them, in their colours', s.pill === 'Deploying: ' + s.names[S - 1] && pillOf(S).test(s.cls), s.pill + ' ' + s.cls);
  ok('...the list now theirs', s.owners === String(S), s.owners);
  const p2 = await placeAll(false);
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => {
    const s = window.PMC_STATE(), mine = s.units.filter(u => u.side === 'A' && u.alive && !u.aboard);
    const blk = document.querySelector('#context .faults, .startwhy, [data-act="start"]');
    return { left: mine.filter(u => u.x < 0).length, n: mine.filter(u => u.y < 24).length, sth: mine.filter(u => u.y >= 24).length,
      text: document.getElementById('context') ? document.getElementById('context').textContent : '',
      start: !!document.querySelector('button[data-act="start"]:not([disabled]), button[data-act="startask"]:not([disabled])') };
  });
  const even = Math.abs(after.n - after.sth) <= 1;
  ok('the second puts theirs down to the south', p2 > 0 && after.left === 0, p2 + ' placed, ' + after.left + ' left');
  // the commandos are rolled, so the split comes out either way: each is checked as it falls
  if (even) ok('the split is the two commandos\' together: even between them, no complaint', !/Split the force/.test(after.text) && after.start, after.n + ' north, ' + after.sth + ' south');
  else ok('the split is the two commandos\' together: uneven between them, said so', /Between the two commandos, split the force/.test(after.text) && !after.start, after.n + ' north, ' + after.sth + ' south');

  // everything down: a unit on the table is picked up by a tap, and goes down again elsewhere
  const moved = await p.evaluate((F) => {
    const s = window.PMC_STATE(), u = s.units.find(x => x.side === 'A' && x.x >= 0 && !x.aboard && (x.owner || 1) === F);
    const at = { x: u.x, y: u.y };
    window.__boardTapAt(u.x, u.y);
    const picked = window.__deployNext() && window.__deployNext().id === u.id;
    let to = null;
    for (let x = 3; !to && x < 46; x += 1.5) for (let y = 12; !to && y < 23; y += 1.5) if (window.__deployOK(x, y, 'A') && Math.hypot(x - at.x, y - at.y) > 3) to = { x, y };
    if (to) window.__boardTapAt(to.x, to.y);
    const now = window.PMC_STATE().units.find(x => x.id === u.id);
    return { picked, from: at, to, now: { x: now.x, y: now.y } };
  }, F);
  ok('with everything down, a tap on a unit picks it up', moved.picked, JSON.stringify(moved));
  ok('...and a tap elsewhere puts it down there', !!moved.to && Math.hypot(moved.now.x - moved.from.x, moved.now.y - moved.from.y) > 1, JSON.stringify(moved));

  /* Crushing the Resistance on a phone: each player taps their landing zone while
     turn 1's result card is still unread in the Results tab, out of sight. The tap
     used to be swallowed by the unread card, and the game went no further. */
  // a context of its own: the first battle, kept in this browser, is not picked up again
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  ph.on('pageerror', (e) => errs.push(e.message));
  await ph.goto('file://' + path.join(ROOT, 'index.html'));
  await ph.waitForTimeout(700);
  await startCoop(ph, { scenario: 's_crush', factionB: 'rebel' });
  const { step } = require('../hotseat.js');
  const zones = [];
  for (let i = 0; i < 300 && zones.length < 2; i++) {
    const asked = await ph.evaluate(() => { const i = window.__insertionState && window.__insertionState(); return !!(i && i.kind === 'lz'); });
    if (asked) {
      const r = await ph.evaluate(() => {
        const sp = window.__insertionSpotsNow(), s = sp[Math.floor(sp.length / 2)], open = !!window.__resOpen();
        window.__boardTapAt(s.x, s.y);
        return { open, lz: Object.keys(window.PMC_STATE().sc.lz || {}).length };
      });
      if (r.lz > zones.length) zones.push(r.open); else { zones.push('ignored'); break; }
      await ph.waitForTimeout(600);
      continue;
    }
    // everything else answered as the helper does, except the result cards: those are left unread
    const d = await ph.evaluate(() => { const ins = window.__insertionState && window.__insertionState(); return ins ? 'wait' : null; }) || await ph.evaluate(step);
    if (d === 'over') break;
    await ph.waitForTimeout(60);
  }
  ok('a landing zone tapped is taken, even with a result card unread', zones.length === 2 && zones.indexOf('ignored') < 0, JSON.stringify(zones));
  const landed = await ph.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      const s = window.PMC_STATE();
      if (s.units.filter(u => u.side === 'A' && u.x >= 0).length) return s.units.filter(u => u.side === 'A' && u.x >= 0).length;
      const r = document.getElementById('resolution'); if (r && !r.hidden) document.getElementById('res-continue').click();
      await new Promise(res => setTimeout(res, 200));
    }
    return 0;
  });
  ok('...and both commandos come down', landed > 0, landed + ' units on the table');

  ok('no page errors', !errs.length, errs.slice(0, 2).join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
