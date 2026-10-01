/* Tribe sight: playing the Xenotripods, an eye button by the zoom shows what
   the whole tribe can see — every unbroken member's 12" of Limited Senses as
   one shaded area, and each enemy that Mental Projection shows to all of them
   ringed (p. 129). Playing anyone else, the button is not there. */
const { chromium } = require('playwright');
const { page: PAGE, shot } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

async function battle(p, factionA) {
  await p.evaluate((f) => {
    try { localStorage.removeItem('pmc.tribeSight'); } catch (e) { /* none */ }
    window.PMC_NEWGAME({
      tier: 3, pl: 1, mode: 'ai', aiSides: ['B'], planet: 'sparse', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: window.PMC.rollArmy(3, 1, null, f), armyB: window.PMC.rollArmy(3, 1, null, 'pmc')
    });
  }, factionA);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { const o = document.getElementById('obj-done'); if (o && o.offsetParent) o.click(); });
  await p.evaluate(() => { if (window.PMC_STATE().deployReady) window.__sendIntent({ k: 'deployready' }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = window.__beginButton(); if (b) b.click(); else window.__sendIntent({ k: 'start' }); });
  await p.waitForFunction(() => !window.__busy() && window.__showQueue() === 0 && !!window.PMC_STATE().phaseCount, null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(400);
}
const eye = () => { const b = document.getElementById('sight-toggle'); return { shown: !!b && !b.hidden && b.offsetParent !== null, on: !!b && b.getAttribute('aria-pressed') === 'true' }; };

(async () => {
  const br = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const p = await br.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + PAGE); await p.waitForTimeout(600);

  console.log('\n  playing the Xenotripods');
  await battle(p, 'xeno');
  const e0 = await p.evaluate(eye);
  ok('the eye is there, by the zoom', e0.shown, JSON.stringify(e0));
  ok('...and off to begin with', !e0.on);
  await p.screenshot({ path: shot('tribesight-off.png') });
  await p.evaluate(() => document.getElementById('sight-toggle').click());
  await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => {
    const b = document.getElementById('sight-toggle'), t = window.__tribeSight();
    return { on: b.getAttribute('aria-pressed') === 'true', areas: t ? t.areas : -1, seen: t ? t.seen : -1 };
  });
  ok('a tap turns it on', e1.on);
  const want = await p.evaluate(() => {
    const s = window.PMC_STATE(), R = window.PMC;
    const seers = s.units.filter(u => u.side === 'A' && u.alive && u.x >= 0 && !u.aboard && R.xenoSenses(u) && R.status(u) !== 'broken').length;
    const seen = s.units.filter(u => u.side === 'B' && u.alive && u.x >= 0 && !u.aboard && R.tribeSees(s, 'A', u)).length;
    return { seers, seen };
  });
  ok('...drawing the sight of every unbroken Xenotripod (not the drones)', e1.areas === want.seers && want.seers > 0, e1.areas + ' of ' + want.seers);
  ok('...and ringing each enemy the tribe can see', e1.seen === want.seen, e1.seen + ' of ' + want.seen);
  await p.screenshot({ path: shot('tribesight-on.png') });
  await p.evaluate(() => document.getElementById('sight-toggle').click());
  await p.waitForTimeout(200);
  ok('a second tap turns it off', !(await p.evaluate(eye)).on);

  console.log('\n  playing a company of mercenaries');
  await battle(p, 'pmc');
  ok('no eye: nobody of ours is a Xenotripod', !(await p.evaluate(eye)).shown);

  console.log('\n  page errors: ' + (errs.join(' | ') || 'none'));
  if (errs.length) fail++;
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
