/* Expendable (p. 57): when a penal squad breaks its collars go off and every man
   left in it is killed. They leave their dead where they stood, as any squad
   cut down does — not a squad that has run off the table. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS, startSkirmish } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
async function drain(p) {
  for (let i = 0; i < 14; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(180);
  }
  await p.waitForTimeout(120);
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await startSkirmish(p, { tier: 1, mode: 'hotseat', scenario: 'meeting', mirror: true,
    keys: ['cmd4', 'penal', 'recruits', 'recruits', 'recruits'] });
  await p.waitForTimeout(1400);
  await drain(p);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  await drain(p);
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(800);
  await drain(p);

  // the penal squad on open ground, one Suppression point short of breaking; a rifle squad beside it to act
  const before = await p.evaluate(() => {
    const s = window.PMC_STATE(), R = window.PMC;
    s.terrain.length = 0;
    s.activeSide = 'A'; s.chain = null;
    const pen = s.units.find((u) => u.side === 'A' && u.key === 'penal');
    const rifles = s.units.find((u) => u.side === 'A' && u.key === 'recruits');
    s.units.forEach((u) => { if (u !== pen && u !== rifles) { u.x = 4 + (u.side === 'A' ? 0 : 40); u.y = 4 + s.units.indexOf(u) * 3; } u.activated = false; });
    pen.x = 20; pen.y = 20; rifles.x = 20; rifles.y = 26;
    window.__rebuildScene();
    window.PMC_SETVIEW(20, 22, 1.5);
    return { id: pen.id, rifles: rifles.id, models: pen.models, morale: R.currentMorale(pen),
      bodies: (window.__vc().remains || []).filter((r) => r.kind === 'body').length };
  });
  await p.waitForTimeout(400);
  ok('the stage is set', before.models > 0, before.models + ' penal troopers');

  // broken: and the next activation's end sets the collars off
  await p.evaluate((a) => {
    const s = window.PMC_STATE();
    s.units.find((u) => u.id === a.id).sp = 2 * a.morale + 1;
  }, before);
  await p.evaluate((a) => window.__select(window.PMC_STATE().units.find((u) => u.id === a.rifles)), before);
  await p.waitForTimeout(200);
  await p.evaluate(() => window.PMC_SETVIEW(20, 20, 2.2));
  await p.evaluate(() => window.__pressAction('regroup'));
  /* the men are still standing while their collars blink and go off, one after
     another; each falls only as his own goes */
  await p.waitForTimeout(420);
  const mid = await p.evaluate((a) => {
    const s = window.PMC_STATE(), u = s.units.find((x) => x.id === a.id), now = performance.now();
    const cl = u._collar;
    return {
      blasts: window.__fxkinds().filter((k) => k === 'collar').length,
      standing: cl ? cl.at.filter((t) => t > now).length : -1,
      down: (window.__vc().remains || []).filter((r) => r.kind === 'body' && (!r.showAt || r.showAt <= now) && Math.hypot(r.x - 20, r.y - 20) < 2).length
    };
  }, before);
  await p.locator('.board-wrap').screenshot({ path: path.join(SHOTS, 'collars-blast.png') });
  ok('part way through, some men are still on their feet', mid.standing > 0 && mid.standing < before.models, mid.standing + ' standing');
  ok('...and only the fallen have bodies yet', mid.down === before.models - mid.standing, mid.down + ' down');
  const blasts = mid.blasts;
  await p.waitForTimeout(1500);
  await drain(p);

  const after = await p.evaluate((a) => {
    const s = window.PMC_STATE(), u = s.units.find((x) => x.id === a.id);
    const bodies = (window.__vc().remains || []).filter((r) => r.kind === 'body');
    // the squad bolts as its collars go, each man falling where he has run to: a scatter a few inches round where it stood
    const here = bodies.filter((r) => Math.hypot(r.x - 20, r.y - 20) < 5);
    return { alive: u.alive, models: u.models, fled: !!u.fled, expended: !!u.expended, bodies: bodies.length, here: here.length,
      log: s.log.slice(-6).map((l) => l.text).join(' / ') };
  }, before);
  ok('the collars went off', !after.alive && after.expended && after.models === 0, after.log);
  ok('...killed, not fled', !after.fled);
  ok('...and every man left his body near where the squad stood', after.here === before.models,
    after.here + ' bodies there, of ' + before.models + ' men');
  await p.evaluate(() => window.PMC_SETVIEW(20, 20, 2.2));
  await p.waitForTimeout(400);
  await p.locator('.board-wrap').screenshot({ path: path.join(SHOTS, 'collars.png') });
  ok('a collar went off at every man', blasts === before.models, blasts + ' blasts for ' + before.models + ' men');
  ok('no page errors', !errs.length, errs.join(' | '));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
