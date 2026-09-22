/* Troops coming off a hull.

   A Battlefield Insertion already had its arrival: a craft falls out of the sky,
   a squad comes up out of cover. But a rapid insertion platform lands with
   somebody strapped into it, and until now that somebody simply appeared on the
   grass fully formed the moment the ramp came down. This checks that a
   disembarking squad comes up the same way an inserted one does — and that the
   platform it steps out of got its own drop first. */
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
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(160);
  }
  await p.waitForTimeout(100);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  await p.evaluate(() => {
    document.getElementById('sel-tier').value = '4';
    document.getElementById('sel-mode').value = 'ai';
    window.__setMuster(['cmd1', 'veterans', 'shock', 'insertplat', 'insertplat', 'protectors']);
  });
  await p.click('#btn-start');
  await p.waitForTimeout(1200);
  await drain(p);

  head('A drop platform comes down with somebody in it');
  const seated = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const pods = s.units.filter(u => u.key === 'insertplat' && u.side === 'A');
    return pods.map(v => ({ code: v.code, cargo: (v.cargo || []).map(c => c.code) }));
  });
  ok('every platform has a squad strapped into it',
    seated.length > 0 && seated.every(v => v.cargo.length > 0),
    seated.map(v => v.code + ' ← ' + v.cargo.join('+')).join(', ') || 'none');

  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(500);
  await drain(p);
  await p.waitForSelector('button[data-act="start"]', { timeout: 15000 });
  await p.evaluate(() => document.querySelector('button[data-act="start"]').click());
  await p.waitForTimeout(700);
  await drain(p);

  /* Hand the turn back to us and stop everything else moving, so what the
     sampler sees is this one arrival rather than whatever the AI is doing. */
  async function ourTurn() {
    await p.evaluate(() => {
      const s = window.PMC_STATE();
      s.activeSide = 'A'; s.initiative = 'A';
      s.units.forEach(u => { u.activated = u.side === 'B'; });
      window.__clearSel();
    });
    await p.waitForTimeout(200);
  }
  await ourTurn();

  head('It falls out of the sky onto its landing point');
  const drop = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    const pod = s.units.find(u => u.key === 'insertplat' && u.side === 'A' && (u.cargo || []).length);
    if (!pod) return { none: true };
    window.__forceDrop(pod, { x: 18, y: 30 });
    window.__landUnit(pod);
    const shots = [];
    const fx = [];
    for (let i = 0; i < 18; i++) {
      shots.push({ at: !!pod.arriveAt, kind: pod.arriveKind });
      window.__fxkinds().forEach(k => fx.push(k));
      await new Promise(r => setTimeout(r, 70));
    }
    return { code: pod.code, shots, fx };
  });
  ok('the platform is drawn falling, not placed', !drop.none && drop.shots[0].kind === 'drop',
    drop.code + ' arriving as "' + (drop.shots[0] || {}).kind + '"');
  ok('...with the ground marked where it is coming down',
    (drop.fx || []).indexOf('dropmark') >= 0, Array.from(new Set(drop.fx)).join(' '));
  ok('...and dust thrown up when it touches down',
    (drop.fx || []).indexOf('collapse') >= 0);
  ok('...then it is simply on the table', drop.shots.some(s => !s.at),
    drop.shots.filter(s => s.at).length * 70 + 'ms of fall');

  await ourTurn();

  head('...and the squad walks out of it rather than appearing beside it');
  const off = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    const pod = s.units.find(u => u.key === 'insertplat' && u.side === 'A' && (u.cargo || []).length);
    if (!pod) return { none: true };
    const rider = pod.cargo[0];
    pod.activated = false;
    window.__select(pod);
    window.__pressAction('disembark');
    await new Promise(r => setTimeout(r, 120));
    const mode = window.__sel() ? true : false;
    window.__tapMove({ x: pod.x + 2.5, y: pod.y });
    await new Promise(r => setTimeout(r, 60));
    const shots = [], fx = [];
    for (let i = 0; i < 20; i++) {
      shots.push({ ax: rider.ax, ay: rider.ay, px: pod.x, py: pod.y });
      window.__fxkinds().forEach(k => fx.push(k));
      await new Promise(r => setTimeout(r, 70));
    }
    return { mode, code: rider.code, aboard: rider.aboard, x: rider.x, fx, shots };
  });

  ok('the squad is on the ground and off the manifest',
    !off.none && !off.aboard && off.x >= 0, off.code + ' at ' + (off.x || 0).toFixed(1) + '"');
  const first = off.shots[0] || {}, moving = off.shots.filter(s => s.ax != null);
  ok('...it is drawn walking out from the hull',
    first.ax != null && Math.hypot(first.ax - first.px, first.ay - first.py) < 1.5,
    first.ax != null ? 'starts ' + Math.hypot(first.ax - first.px, first.ay - first.py).toFixed(1) + '" from the hull' : 'not moving');
  ok('...toward where it was put', moving.length > 1 &&
    Math.hypot(moving[moving.length - 1].ax - off.x, 0) < Math.hypot(moving[0].ax - off.x, 0));
  ok('...and it is standing on its spot a moment later',
    off.shots.some(s => s.ax == null), moving.length * 70 + 'ms of walking');

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
