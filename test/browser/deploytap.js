/* Putting a force down by tapping, on a phone and on a desktop.

   The camera has to open on the ground the player is being asked to fill — on a
   phone, zoomed in, the middle of the table is nowhere near their own edge — and
   a tap that misses the strip by a few inches has to land rather than be refused,
   because in this projection a 5" band is a narrow diagonal across the view. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

async function drain(p) {
  await p.evaluate(() => {
    const r = document.getElementById('resolution');
    if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
  });
}

async function run(p, label, scen, shotName) {
  console.log('\n  ' + label);
  await p.evaluate((sid) => {
    window.PMC_NEWGAME({
      tier: 3, pl: 1, mode: 'ai', planet: 'sparse', scenario: sid,
      nameA: 'Mine', nameB: 'Theirs',
      armyA: window.PMC.rollArmy(3, 1), armyB: window.PMC.rollArmy(3, 1)
    });
  }, scen);
  await p.waitForTimeout(900);
  for (let i = 0; i < 8; i++) { await drain(p); await p.waitForTimeout(100); }

  const start = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      waiting: s.units.filter(u => u.side === 'A' && u.x < 0 && !u.reserve && !u.aboard).length,
      onScreen: window.__deployShare ? window.__deployShare() : null
    };
  });
  /* An Invasion attacker deploys nothing at all — the whole force comes down into
     the landing zones — so there is no ground to open the camera on. */
  ok('the camera opens on ground you may deploy into', start.waiting === 0 || start.onScreen > 0,
    start.waiting === 0 ? 'nothing to deploy: the force arrives by drop'
      : start.onScreen + '% of the view is a legal drop');
  if (shotName) await p.screenshot({ path: path.join(SHOTS, shotName) });

  // tap a grid over the canvas until the force is down or the taps run out
  const box = await p.evaluate(() => {
    const c = document.getElementById('board').getBoundingClientRect();
    return { x: c.x, y: c.y, w: c.width, h: c.height };
  });
  let taps = 0, landed = 0, panned = 0;
  outer:
  for (let round = 0; round < 3; round++) {
    for (let gy = 1; gy <= 7; gy++) {
      for (let gx = 1; gx <= 5; gx++) {
        const before = await p.evaluate(() =>
          window.PMC_STATE().units.filter(u => u.side === 'A' && u.x < 0 && !u.reserve && !u.aboard).length);
        if (!before) break outer;
        await p.mouse.click(box.x + box.w * gx / 6, box.y + box.h * gy / 8);
        await p.waitForTimeout(80);
        taps++;
        const after = await p.evaluate(() => ({
          left: window.PMC_STATE().units.filter(u => u.side === 'A' && u.x < 0 && !u.reserve && !u.aboard).length,
          hint: (document.getElementById('hintbar') || {}).textContent || ''
        }));
        if (after.left < before) landed++;
        else if (/camera has gone back/.test(after.hint)) panned++;
      }
    }
  }
  const end = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      left: s.units.filter(u => u.side === 'A' && u.x < 0 && !u.reserve && !u.aboard).length,
      illegal: s.units.filter(u => u.side === 'A' && u.x >= 0 && !window.__deployOK(u.x, u.y, 'A')).length,
      placed: s.units.filter(u => u.side === 'A' && u.x >= 0).length
    };
  });
  ok('the whole force went down by tapping', end.left === 0,
    start.waiting + ' units in ' + taps + ' taps (' + landed + ' landed, ' + panned + ' panned back)');
  ok('...and every unit ended up somewhere legal', end.illegal === 0,
    end.placed + ' placed, ' + end.illegal + ' outside the zone');
  ok('...without needing more taps than units', taps <= start.waiting * 4,
    taps + ' taps for ' + start.waiting + ' units');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const screens = [
    { name: 'PHONE  420x860', w: 420, h: 860, mobile: true },
    { name: 'DESKTOP 1340x900', w: 1340, h: 900, mobile: false }
  ];
  for (const sc of screens) {
    console.log('\n' + sc.name);
    const p = await b.newPage({
      viewport: { width: sc.w, height: sc.h },
      isMobile: sc.mobile, hasTouch: sc.mobile, deviceScaleFactor: sc.mobile ? 2 : 1
    });
    p.on('pageerror', e => errs.push(sc.name + ': ' + e.message));
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    await p.waitForTimeout(700);
    // a hook for how much of the visible board is a legal drop right now
    await p.evaluate(() => {
      window.__deployShare = function () {
        const cv = document.getElementById('board');
        let ok = 0, n = 0;
        for (let gx = 0; gx <= 24; gx++) for (let gy = 0; gy <= 24; gy++) {
          const w = window.__toWorldFromCanvasPx(cv.width * gx / 24, cv.height * gy / 24);
          n++;
          if (window.__deployOK(w.x, w.y, 'A')) ok++;
        }
        // to a tenth of a percent: a zone that is a sliver of a fitted table still counts as on screen
        return Math.round(1000 * ok / n) / 10;
      };
    });
    for (const scen of ['meeting', 'secure', 'find', 'demolish', 'takeover', 'invasion']) {
      await run(p, scen.toUpperCase(), scen, sc.mobile && scen === 'secure' ? 'deploy-phone.png' : null);
    }
    await p.close();
  }
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
