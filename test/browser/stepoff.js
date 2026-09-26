/* Troops coming off a hull.

   A Battlefield Insertion already had its arrival: a craft falls out of the sky,
   a squad comes up out of cover. But a rapid insertion platform lands with
   somebody strapped into it, and until now that somebody simply appeared on the
   grass fully formed the moment the ramp came down. This checks that a
   disembarking squad comes up the same way an inserted one does — and that the
   platform it steps out of got its own drop first. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startSkirmish } = require('../where.js');

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
  // the same open battle every run, so the platforms come down on clear ground
  await startSkirmish(p, { tier: 4, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd1', 'veterans', 'shock', 'insertplat', 'insertplat', 'protectors'] });
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

  /* The battle is played as it runs: the engine decides whose turn it is, so
     the harness passes with its other units until the Reserve phase asks
     where the platform comes down, drops it there, and then waits for one of
     its own activations to put the squad out. (Editing the screen's copy of
     the state to hand ourselves the turn no longer reaches the engine.) */
  const byId = (id) => window.PMC_STATE().units.find(u => u.id === id);
  async function passOne() {
    await p.evaluate(() => {
      const s = window.PMC_STATE();
      if (s.activeSide !== 'A' || s.over) return;
      const u = s.units.find(x => x.side === 'A' && x.alive && !x.activated && !x.reserve && !x.aboard &&
        x.key !== 'insertplat' && window.PMC.status(x) !== 'broken');
      if (!u) return;
      const li = [...document.querySelectorAll('.ru')].find(e => e.dataset.unit === u.id);
      if (li) li.click();
    });
    await p.waitForTimeout(120);
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('.slot')].find(x => /Regroup/.test(x.textContent));
      if (btn && !btn.disabled) btn.click();
    });
    await p.waitForTimeout(260);
  }

  head('It falls out of the sky onto its landing point');
  let drop = { none: true };
  for (let k = 0; k < 200 && drop.none; k++) {
    await drain(p);
    const st = await p.evaluate(() => ({ asking: window.__insertionAsking(), over: !!window.PMC_STATE().over }));
    if (st.over) break;
    if (!st.asking) { await passOne(); continue; }
    drop = await p.evaluate(async (byIdSrc) => {
      const byId = eval(byIdSrc);
      const s = window.PMC_STATE();
      const asked = window.__insertionAsking();
      const pod = s.units.find(u => u.code === asked && u.side === 'A');
      // the spot: anywhere legal in our own half, well clear of the enemy
      let spot = null;
      for (let i = 0; i < 4000 && !spot; i++) {
        const x = 8 + Math.random() * 32, y = 20 + Math.random() * 22;
        if (window.__insertionLegal({ x, y })) spot = { x, y };
      }
      if (!spot) return { none: true, why: 'no legal point' };
      window.__dropHere(spot);
      if (!pod || pod.key !== 'insertplat') return { none: true, other: asked };
      const shots = [], fx = [];
      for (let i = 0; i < 36; i++) {
        const now = byId(pod.id) || pod;
        shots.push({ at: !!now.arriveAt, kind: now.arriveKind });
        window.__fxkinds().forEach(k => fx.push(k));
        await new Promise(r => setTimeout(r, 70));
      }
      return { id: pod.id, code: pod.code, shots, fx };
    }, byId.toString());
    if (drop.none && drop.other) { drop = { none: true }; await p.waitForTimeout(800); }
  }
  const landed = drop.shots ? drop.shots.find(x => x.kind) : null;
  ok('the platform is drawn falling, not placed', !drop.none && !!landed && landed.kind === 'drop',
    drop.code + ' arriving as "' + (landed || {}).kind + '"');
  ok('...with the ground marked where it is coming down',
    (drop.fx || []).indexOf('dropmark') >= 0, Array.from(new Set(drop.fx || [])).join(' '));
  ok('...and dust thrown up when it touches down',
    (drop.fx || []).indexOf('collapse') >= 0);
  ok('...then it is simply on the table', !!drop.shots && drop.shots.some(x => !x.at),
    drop.shots ? drop.shots.filter(x => x.at).length * 70 + 'ms of fall' : 'never landed');

  head('...and the squad walks out of it rather than appearing beside it');
  let off = { none: true };
  for (let k = 0; k < 240 && off.none && !drop.none; k++) {
    await drain(p);
    const ready = await p.evaluate((id) => {
      const s = window.PMC_STATE(), pod = s.units.find(u => u.id === id);
      return !s.over && s.activeSide === 'A' && s.phase === 'battle' && !window.__insertionAsking() && !window.__busy() &&
        !!pod && pod.x >= 0 && !pod.activated && (pod.cargo || []).length > 0;
    }, drop.id);
    if (!ready) {
      // any other arrival the Reserve phase asks about goes down wherever it legally can
      await p.evaluate(() => {
        if (!window.__insertionAsking()) return;
        for (let i = 0; i < 4000; i++) {
          const x = 6 + Math.random() * 36, y = 6 + Math.random() * 36;
          if (window.__insertionLegal({ x, y })) { window.__dropHere({ x, y }); return; }
        }
      });
      await p.waitForTimeout(200);
      await passOne(); continue;
    }
    off = await p.evaluate(async (args) => {
      const [id, byIdSrc] = args;
      const byId = eval(byIdSrc);
      const pod = byId(id), riderId = (pod.cargo[0] && (pod.cargo[0].id || pod.cargo[0]));
      window.__select(pod);
      window.__pressAction('disembark');
      await new Promise(r => setTimeout(r, 120));
      // the screen can be a beat ahead of the engine: if disembarking did not take, try again later
      if ((window.__uiMode() || {}).mode !== 'disembark') { window.__clearSel(); return { none: true, retry: true }; }
      const mode = !!window.__sel();
      // step off onto whichever side of the hull is clear
      search: for (const d of [2.5, 2, 3, 1.6]) {
        for (let a = 0; a < 16; a++) {
          const ang = a * Math.PI / 8;
          window.__tapMove({ x: pod.x + Math.cos(ang) * d, y: pod.y + Math.sin(ang) * d });
          await new Promise(r => setTimeout(r, 60));
          const r0 = byId(riderId);
          if (r0 && !r0.aboard) break search;
        }
      }
      const shots = [], fx = [];
      for (let i = 0; i < 20; i++) {
        const r = byId(riderId), hull = byId(id);
        shots.push({ ax: r.ax, ay: r.ay, px: hull.x, py: hull.y });
        window.__fxkinds().forEach(k => fx.push(k));
        await new Promise(res => setTimeout(res, 70));
      }
      const r = byId(riderId);
      return { mode, code: r.code, aboard: r.aboard, x: r.x, fx, shots };
    }, [drop.id, byId.toString()]);
  }

  ok('the squad is on the ground and off the manifest',
    !off.none && !off.aboard && off.x >= 0, off.code + ' at ' + (off.x || 0).toFixed(1) + '"');
  const first = off.shots[0] || {}, moving = off.shots.filter(s => s.ax != null);
  ok('...it is drawn walking out from the hull',
    // it sets off from the hull's edge: a base's width or so from the hull's centre
    first.ax != null && Math.hypot(first.ax - first.px, first.ay - first.py) < 2.1,
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
