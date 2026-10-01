/* Follow, the toggle beside the zoom level: whether the camera goes over to the
   other side's units as they act. Shown on a desktop and on a phone; off, the
   AI's turns leave the camera where the player put it; on, it rides along as
   ever; the choice is kept for the next battle. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish, SHOTS, seedDice } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
async function drain(p) {
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(150);
  }
}
async function battle(p) {
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
}
// watch the camera through the AI's turns: did it ever go over to them, and did it move?
async function watch(p, ms) {
  await p.evaluate(() => {
    const c0 = window.__cam();
    window.__watch = { borrowed: false, moved: 0, aiTime: 0, last: null, z0: c0.z, minZ: c0.z };
    window.__watchT = setInterval(() => {
      const c = window.__cam(), w = window.__watch, s = window.PMC_STATE();
      if (c.borrowed) w.borrowed = true;
      /* Where the camera is headed, through the other side's activations only:
         the player's own taps aim it too, and it may still be easing there
         when the other side starts — that is not the other side moving it. */
      const theirs = s && s.phase === 'battle' && !window.__mySide();
      if (theirs) {
        w.aiTime++;
        w.minZ = Math.min(w.minZ, c.z);
        if (w.last && Math.hypot(c.tx - w.last.x, c.ty - w.last.y) > 1) {
          // aimed somewhere new: at one of theirs (chasing), or at one of the player's own (its own action replayed)?
          const me = s.cfg.aiSides.indexOf('A') < 0 ? 'A' : 'B', I = window.PMCIso;
          let foe = Infinity, own = Infinity;
          s.units.forEach(u => {
            if (!u.alive || u.x < 0 || u.aboard) return;
            const q = I.toScreen(u.x, u.y), d = Math.hypot(q.x - c.tx, q.y - I.ELEV - c.ty);
            if (u.side === me) own = Math.min(own, d); else foe = Math.min(foe, d);
          });
          if (foe < 40 && foe < own) w.moved = Math.max(w.moved, 1 + foe);
        }
        w.last = { x: c.tx, y: c.ty };
      } else w.last = null;
    }, 40);
  });
  const t0 = Date.now();
  await p.evaluate(() => { window.__traceShow = []; });
  // long enough to see the AI's turns, and (up to a limit) until it has fired at somebody
  const shot = () => p.evaluate(() => window.__traceShow.some(t => t.e === 'shoot' && t.id && window.PMC_STATE().units.some(u => u.id === t.id && u.side === 'B')));
  let firedAt = 0;
  while (Date.now() - t0 < ms || (Date.now() - t0 < ms * 3 && (await p.evaluate(() => window.__watch.aiTime)) < 150) ||
    (Date.now() - t0 < 90000 && (!firedAt || Date.now() - firedAt < 1500))) {
    if (!firedAt && await shot()) firedAt = Date.now();
    await drain(p);
    // the player acts once the other side's move has been drawn, as a player would: a unit regroups
    await p.evaluate(() => {
      if (!window.__mySide() || window.__busy() || window.__showQueue() > 0 || window.__resOpen()) return;
      const u = window.__eligibleUnits()[0];
      if (u && window.__select(u)) window.__pressAction('regroup');
    });
    await p.waitForTimeout(80);
  }
  return p.evaluate(() => {
    clearInterval(window.__watchT);
    return window.__watch;
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];

  console.log('\n  DESKTOP');
  const ctx = await b.newContext({ viewport: { width: 1340, height: 950 } });
  const p = await ctx.newPage();
  await seedDice(p, 2670);          // the same armies, and who fires first, every run
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.evaluate(() => { try { localStorage.removeItem('pmc.followOther'); } catch (e) { } });
  await p.waitForTimeout(500);
  await battle(p);
  const d = await p.evaluate(() => {
    const t = document.getElementById('follow-toggle'), z = document.getElementById('zoomlabel');
    const r = t.getBoundingClientRect(), zr = z.getBoundingClientRect(), br = document.getElementById('board').getBoundingClientRect();
    return { shown: r.width > 0 && getComputedStyle(t).display !== 'none', on: t.classList.contains('on'),
      besideZoom: Math.abs(r.top - zr.top) < 20 && r.left > zr.left, topRight: r.right > br.left + br.width * 0.7 && r.top < br.top + 60 };
  });
  ok('Follow is by the zoom level, top right of the table', d.shown && d.besideZoom && d.topRight, JSON.stringify(d));
  ok('...and on to begin with', d.on);
  ok('there is no Pause outside a demo', await p.evaluate(() => getComputedStyle(document.getElementById('demo-pause')).display === 'none'));
  await p.click('#follow-toggle');
  ok('a click turns it off', !(await p.evaluate(() => document.getElementById('follow-toggle').classList.contains('on'))));
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(600);
  const off = await watch(p, 9000);
  ok('off, the AI\'s turns never take the camera', off.aiTime > 10 && !off.borrowed, JSON.stringify(off));
  ok('...and it is never aimed at their units', off.moved < 1, off.moved ? 'aimed within ' + (off.moved - 1).toFixed(0) + ' px of one' : '');
  await p.screenshot({ path: path.join(SHOTS, 'follow-off.png') });
  await p.click('#follow-toggle');
  // a fresh battle for it (the first may be over): Follow, back on, carries into it
  await battle(p);
  ok('...and it carries into the next battle', await p.evaluate(() => document.getElementById('follow-toggle').classList.contains('on')));
  // closer in, so an AI shot has room to pull the camera back
  for (let i = 0; i < 6; i++) await p.evaluate(() => document.querySelector('#viewctl [data-zoom="in"]').click());
  // the two sides brought within a shot of each other as the battle starts, so the AI fires on its first go
  await p.evaluate(() => {
    window.__startBattle();
    const s = window.PMC_STATE(), mine = s.units.filter(u => u.side === 'A' && u.x >= 0 && !u.aboard);
    s.units.filter(u => u.side === 'B' && u.x >= 0 && !u.aboard).forEach((u, i) => {
      const m = mine[i % mine.length];
      u.x = m.x + (i % 2 ? 3 : -3); u.y = m.y + (u.y > m.y ? 14 : -14);   // towards where they came from
    });
  });
  await p.waitForTimeout(600);
  const on = await watch(p, 9000);
  ok('on again, the camera goes over to the AI\'s units', on.borrowed, JSON.stringify(on));
  ok('...pulls back to take in the shooter and its target', on.minZ < on.z0, 'zoom ' + on.z0 + ' → ' + on.minZ.toFixed(2));
  // once it is the player's go again and the table is still, the camera is back as it was left
  let back = null;
  for (let i = 0; i < 80; i++) {
    back = await p.evaluate(() => ({ mine: window.__mySide(), idle: !window.__busy() && window.__showQueue() === 0, c: window.__cam() }));
    if (back.mine && back.idle && !back.c.borrowed) break;
    await drain(p);
    await p.waitForTimeout(150);
  }
  ok('...and is put back as it was afterwards', back && !back.c.borrowed && Math.abs(back.c.z - on.z0) < 0.01, JSON.stringify(back && back.c));
  ok('the choice is kept', await p.evaluate(() => localStorage.getItem('pmc.followOther')) === 'on');
  await ctx.close();

  console.log('\n  DEMO');
  const dctx = await b.newContext({ viewport: { width: 1340, height: 950 } });
  const dp = await dctx.newPage();
  await seedDice(dp, 2670);          // the same armies, and who fires first, every run
  dp.on('pageerror', e => errs.push(e.message));
  await dp.goto('file://' + path.join(ROOT, 'index.html'));
  await dp.waitForTimeout(500);
  await startSkirmish(dp, { tier: 3, mode: 'demo', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await dp.waitForTimeout(1200);
  await drain(dp);
  await dp.evaluate(() => { if (window.__autoDeployBoth) window.__autoDeployBoth(); });
  await dp.waitForTimeout(300);
  await dp.evaluate(() => { if (window.PMC_STATE().phase !== 'battle' && window.__startBattle) window.__startBattle(); });
  ok('a demo starts with Follow off', !(await dp.evaluate(() => document.getElementById('follow-toggle').classList.contains('on'))));
  for (let i = 0; i < 6; i++) await dp.evaluate(() => document.querySelector('#viewctl [data-zoom="in"]').click());
  // how far the camera is aimed from where it was, and how far out it goes, over a stretch of the battle
  async function roam(ms, tillShot) {
    const c0 = await dp.evaluate(() => window.__cam());
    let far = 0, minZ = c0.z, firedAt = 0;
    const t0 = Date.now();
    await dp.evaluate(() => { window.__traceShow = []; });
    while (Date.now() - t0 < ms || (tillShot && Date.now() - t0 < 90000 && (!firedAt || Date.now() - firedAt < 1500))) {
      if (!firedAt && await dp.evaluate(() => window.__traceShow.some(t => t.e === 'shoot'))) firedAt = Date.now();
      await drain(dp);
      const c = await dp.evaluate(() => window.__cam());
      far = Math.max(far, Math.hypot(c.tx - c0.tx, c.ty - c0.ty));
      minZ = Math.min(minZ, c.z);
      await dp.waitForTimeout(60);
    }
    return { far: Math.round(far), z0: c0.z, minZ: +minZ.toFixed(2) };
  }
  const still = await roam(5000);
  ok('...so the camera stays where the watcher left it', still.far < 1 && still.minZ === still.z0, JSON.stringify(still));
  await dp.click('#follow-toggle');
  ok('Follow can be turned on in a demo', await dp.evaluate(() => document.getElementById('follow-toggle').classList.contains('on')));
  const roamed = await roam(4000, true);
  ok('...and then the camera follows the battle', roamed.far > 40, JSON.stringify(roamed));
  ok('...pulling back for the shots', roamed.minZ < roamed.z0, JSON.stringify(roamed));

  // Pause: beside the zoom level, holding the battle after the activation being drawn
  const pb = await dp.evaluate(() => {
    const b = document.getElementById('demo-pause'), r = b.getBoundingClientRect(), f = document.getElementById('follow-toggle').getBoundingClientRect();
    return { shown: r.width > 0 && getComputedStyle(b).display !== 'none', beside: Math.abs(r.top - f.top) < 20, text: b.textContent };
  });
  ok('a demo has a Pause button by the zoom controls', pb.shown && pb.beside && pb.text === 'Pause', JSON.stringify(pb));
  await dp.evaluate(() => document.getElementById('demo-pause').click());
  const acts = () => dp.evaluate(() => window.PMC_STATE().units.filter(u => u.activated).length + ':' + window.PMC_STATE().turn + ':' + (window.PMC_STATE().log || []).length);
  await dp.waitForTimeout(3000);              // whatever was being drawn finishes
  await drain(dp);
  const held = await acts();
  await dp.waitForTimeout(4000);
  await drain(dp);
  const still2 = await acts();
  ok('...pressed, the battle stops', held === still2 && await dp.evaluate(() => document.getElementById('demo-pause').textContent === 'Play'), held + ' → ' + still2);
  await dp.evaluate(() => document.getElementById('demo-pause').click());
  let moved = false;
  for (let i = 0; i < 40 && !moved; i++) { await drain(dp); await dp.waitForTimeout(250); moved = (await acts()) !== still2; }
  ok('...and Play carries it on', moved);
  await dctx.close();

  console.log('\n  PHONE');
  const mctx = await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mctx.newPage();
  await seedDice(m, 2670);          // the same armies, and who fires first, every run
  m.on('pageerror', e => errs.push(e.message));
  await m.goto('file://' + path.join(ROOT, 'index.html'));
  await m.waitForTimeout(500);
  await battle(m);
  const mm = await m.evaluate(() => {
    const t = document.getElementById('follow-toggle'), r = t.getBoundingClientRect();
    const zin = document.querySelector('#viewctl [data-zoom="in"]');
    return { shown: r.width > 0 && getComputedStyle(t).display !== 'none', h: Math.round(r.height), label: getComputedStyle(document.getElementById('zoomlabel')).display !== 'none',
      zoomBtns: getComputedStyle(zin).display };
  });
  ok('on a phone Follow shows, by the zoom level', mm.shown && mm.label, JSON.stringify(mm));
  ok('...with the + / − / Fit buttons left to the fingers', mm.zoomBtns === 'none');
  await m.tap('#follow-toggle');
  ok('a tap turns it off', !(await m.evaluate(() => document.getElementById('follow-toggle').classList.contains('on'))));
  await m.screenshot({ path: path.join(SHOTS, 'follow-phone.png') });
  await mctx.close();

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
