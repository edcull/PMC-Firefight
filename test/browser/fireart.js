/* The firing animations, driven through the real game: a tank gun should throw a
   bolt and a big muzzle blast, a mortar should put a round in the air for a beat
   before anything lands, and a machine gun should stream tracers for longer than
   a rifle line does. */
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
  for (let i = 0; i < 20; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(110);
  }
  await p.waitForTimeout(110);
}

/* Both sides in the open, a clear line between them, and the shooter of the
   moment standing where it can see. */
async function stage(p, mine) {
  await p.evaluate((keys) => {
    window.PMC_NEWGAME({
      tier: 4, pl: 2, mode: 'hotseat', planet: 'barren', scenario: 'meeting',
      nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd1'].concat(keys),
      armyB: ['cmd1', 'veterans', 'veterans', 'regular']
    });
  }, mine);
  await p.waitForTimeout(950);
  await drain(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach(u => { u.reserve = false; u.aboard = null; u.activated = false; });
    s.units.filter(u => u.side === 'A').forEach((u, i) => { u.x = 10; u.y = 16 + i * 3; u.facing = 0; });
    s.units.filter(u => u.side === 'B').forEach((t, i) => { t.x = 26; t.y = 16 + i * 3; t.facing = Math.PI; });
    window.__rebuildScene();
    window.__clearSel();
  });
  await p.waitForTimeout(220);
  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
  });
  await p.waitForTimeout(450);
  await drain(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A'; s.initiative = 'A';
    s.units.forEach(u => { u.activated = false; });
    window.__clearSel();
  });
  await p.waitForTimeout(140);
}

/* Fire with the given unit and watch the effects go by, sampling often enough to
   catch a bolt that is only up for 300ms. */
async function fireAndWatch(p, code, ms) {
  const started = await p.evaluate((c) => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.side === 'A' && x.code === c);
    if (!u) return { ok: false, why: 'no such unit' };
    u.activated = false;
    window.__select(u);
    const on = window.__pressAction('fire');
    const t = window.__targetCodes();
    if (!on || !t) return { ok: false, why: 'cannot fire: ' + (t || 'no targets') };
    const enemy = s.units.find(x => x.side === 'B' && x.alive && window.PMC.canShoot(s, u, x, 'fire', {}));
    if (!enemy) return { ok: false, why: 'nothing in sight' };
    window.__shootAt(enemy.id);
    return { ok: true, style: window.PMC.weaponStyle(u), name: u.name };
  }, code);
  if (!started.ok) return started;
  const seen = {};
  let firstImpact = null, lastTracer = 0, peakTracers = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 2200)) {
    const snap = await p.evaluate(() => window.__fxkinds());
    snap.forEach(k => { seen[k] = (seen[k] || 0) + 1; });
    if (snap.indexOf('impact') >= 0 || snap.indexOf('miss') >= 0) {
      if (firstImpact === null) firstImpact = Date.now() - t0;
    }
    if (snap.indexOf('tracer') >= 0) lastTracer = Date.now() - t0;
    var live = snap.filter(k => k === 'tracer').length;
    if (live > peakTracers) peakTracers = live;
    await p.waitForTimeout(40);
  }
  return Object.assign(started, { seen: seen, firstImpact: firstImpact, lastTracer: lastTracer, peak: peakTracers });
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  /* ------------------------------------------------------------------- shell */
  head('A tank gun throws its heavy rounds');
  await stage(p, ['mcv:tracked', 'regular', 'rookie']);
  const tank = await fireAndWatch(p, 'MCV', 1800);
  /* A combat hull puts its main gun down in quick succession, over whatever the
     crew has in the hatch, so bolts and tracers belong to the one attack. */
  ok('the medium combat vehicle is a heavy direct-fire gun', tank.style === 'shellbig',
    tank.why || tank.name);
  ok('...and it throws a bolt, with the crew firing alongside',
    !!tank.seen.bolt && !!tank.seen.tracer, Object.keys(tank.seen).join(' '));
  ok('...which is what the table says it carries',
    await p.evaluate(() => {
      const w = window.PMC.weaponSpec(window.PMC.profile('mcv'));
      return w.p + ' x' + w.n + '+' + w.s;
    }) === 'shellbig x2+pistol');
  ok('...with the round landing almost at once',
    tank.firstImpact !== null && tank.firstImpact < 900, tank.firstImpact + 'ms');

  /* -------------------------------------------------------------- trajectory */
  head('A mortar puts the round in the air first');
  await stage(p, ['mortarsection', 'regular', 'veterans']);
  const mortar = await fireAndWatch(p, 'MRS', 2400);
  ok('the remote mortar section lobs', mortar.style === 'arc', mortar.why || mortar.name);
  ok('...so the shell is drawn in flight, on an arc',
    !!mortar.seen.lob && !mortar.seen.tracer && !mortar.seen.bolt,
    Object.keys(mortar.seen).join(' '));
  ok('...and nothing lands until it comes down',
    mortar.firstImpact !== null && mortar.firstImpact > 450,
    mortar.firstImpact + 'ms in the air');
  ok('...longer than a tank shell takes',
    mortar.firstImpact > tank.firstImpact,
    tank.firstImpact + 'ms against ' + mortar.firstImpact + 'ms');

  /* ------------------------------------------------------------------- burst */
  head('A machine gun keeps firing');
  await stage(p, ['hpv:wheeled', 'regular', 'veterans']);
  const mg = await fireAndWatch(p, 'HPV', 2000);
  ok('the heavy patrol vehicle\'s machine gun fires in bursts', mg.style === 'burst', mg.why || mg.name);
  ok('...as tracers, not a single bolt', !!mg.seen.tracer && !mg.seen.bolt,
    Object.keys(mg.seen).join(' '));
  // the heavy MG is a heavier weapon than its name suggests, and fires like one
  ok('...and the heavy MG team is an autocannon, not a machine gun',
    await p.evaluate(() => window.PMC.weaponStyle(window.PMC.profile('hmgteam'))) === 'chain');

  /* ------------------------------------------------------------------ chain */
  head('An autocannon hull hammers away');
  await stage(p, ['recon:wheeled', 'regular', 'veterans']);
  const cannon = await fireAndWatch(p, 'RCV', 2000);
  ok('the recon vehicle is heavy rapid fire', cannon.style === 'chain', cannon.why || cannon.name);
  ok('...as fat tracers, not a single bolt', !!cannon.seen.tracer && !cannon.seen.bolt,
    Object.keys(cannon.seen).join(' '));
  ok('...with a muzzle flash for every round', !!cannon.seen.muzzle);

  /* ------------------------------------------------------------------ flame */
  head('A flamethrower holds the trigger down');
  await stage(p, ['chem', 'regular', 'veterans']);
  // a flamethrower reaches 12", so the two sides have to be closer than usual
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.units.filter(u => u.side === 'B').forEach((t, i) => { t.x = 18; t.y = 16 + i * 3; });
    window.__rebuildScene();
  });
  await p.waitForTimeout(160);
  const fire = await fireAndWatch(p, 'CHM', 2600);
  ok('chem-warriors are a flame weapon', fire.style === 'flame', fire.why || fire.name);
  ok('...and nothing flies while they burn', !fire.seen.tracer && !fire.seen.bolt,
    Object.keys(fire.seen).join(' '));
  /* One 900ms jet read as a puff. An operator walks the cone across the
     frontage, so it is two or three jets laid off each other. */
  ok('...the cone is up for well over a second, not a puff',
    fire.seen.flame > 22, Math.round(fire.seen.flame * 40) + 'ms of fire');

  /* -------------------------------------------------------------- aircraft */
  head('A gunship fires from its airframe, not from the grass under it');
  await stage(p, ['gunboat', 'regular', 'veterans']);
  const air = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const g = s.units.find(u => u.side === 'A' && u.code === 'GNB');
    const foot = s.units.find(u => u.side === 'A' && u.code === 'RIF');
    return { fly: window.__flyLift(g), ground: window.__flyLift(foot), name: g && g.name };
  });
  ok('an aircraft hull hangs above its own ground', air.fly > 0, air.name + ' ' + air.fly + 'px up');
  ok('...where an infantry unit does not', air.ground === 0);
  const shots = await p.evaluate(async () => {
    const s = window.PMC_STATE();
    const g = s.units.find(u => u.side === 'A' && u.code === 'GNB');
    g.activated = false;
    window.__select(g);
    window.__pressAction('fire');
    const e = s.units.find(x => x.side === 'B' && x.alive && window.PMC.canShoot(s, g, x, 'fire', {}));
    if (!e) return { none: true };
    window.__shootAt(e.id);
    const seen = [];
    for (let i = 0; i < 22; i++) {
      window.__fxlive().forEach(f => seen.push(f));
      await new Promise(r => setTimeout(r, 45));
    }
    return { seen };
  });
  const lines = (shots.seen || []).filter(f => f.fromUp !== null);
  const points = (shots.seen || []).filter(f => f.fromUp === null);
  ok('...so its rockets and tracers leave the airframe',
    lines.length > 0 && lines.every(f => f.fromUp > 0),
    lines.length + ' effects drawn from ' + ((lines[0] || {}).fromUp || 0) + 'px up');
  ok('...its muzzle flashes are up there with them',
    points.some(f => f.kind === 'muzzle' && f.up > 0));
  ok('...and what it hits on the ground still lands on the ground',
    lines.every(f => f.toUp === 0) && points.every(f => f.kind === 'muzzle' || f.up === 0),
    'impacts at ground level');

  head('And a rifle line keeps firing for a good second');
  await stage(p, ['hpv:wheeled', 'regular', 'veterans']);
  const mg2 = await fireAndWatch(p, 'HPV', 2000);
  ok('the MG is still a burst weapon', mg2.style === 'burst', mg2.name);
  // the MG's activation has moved the turn on; hand it back before comparing
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A';
    s.units.forEach(u => { u.activated = false; });
    window.__clearSel();
  });
  await p.waitForTimeout(160);
  const rifle = await fireAndWatch(p, 'RIF', 2000);
  ok('a regular rifle team is a small-arms weapon', rifle.style === 'small', rifle.why || rifle.name);
  /* A volley used to be over in a fifth of a second, which read as a single
     twitch. Eight men firing take about a second. What still tells a rifle line
     and a machine gun apart is the cadence: the MG puts more rounds down in less
     time, so its tracers are denser even though its burst is not longer. */
  ok('...for long enough to read as a volley',
    rifle.lastTracer > 450, rifle.lastTracer + 'ms of tracers');
  /* How long a given burst runs depends on how many hits were rolled, so timing
     one against the other is a coin toss. The difference that is always true is
     the cadence: a machine gun's rounds are closer together than a rifle line's,
     and an autocannon's are further apart than either. */
  const cadence = await p.evaluate(() => ({
    pistol: window.__fireSpec('pistol'),
    small: window.__fireSpec('small'),
    smg: window.__fireSpec('smg'),
    burst: window.__fireSpec('burst'),
    chain: window.__fireSpec('chain')
  }));
  /* How long a given burst runs depends on how many hits were rolled, so timing
     one against the other is a coin toss. The difference that is always true is
     the cadence, and it is a ladder: a machine gun is the fastest thing on the
     table, then a carbine, then an autocannon's countable rounds, then a rifle
     line's aimed shots, and slowest of all a sidearm. */
  const ladder = ['burst', 'smg', 'chain', 'small', 'pistol'];
  ok('every style has a cadence of its own',
    ladder.every(k => cadence[k] && cadence[k].gap > 0),
    ladder.map(k => k + ' ' + (cadence[k] || {}).gap + 'ms').join(', '));
  ok('...and they run slowest to fastest in that order',
    ladder.every((k, i) => i === 0 || cadence[k].gap > cadence[ladder[i - 1]].gap));
  ok('a machine gun\'s rounds come closer together than a rifle line\'s',
    cadence.burst.gap < cadence.small.gap,
    'MG every ' + cadence.burst.gap + 'ms, rifle every ' + cadence.small.gap + 'ms');
  /* A rifle line is not a stream. Eight men firing aimed shots put fewer rounds
     down per second than an autocannon does — what makes it read as a volley is
     that it runs on for a second, not that it is fast. */
  ok('...and a rifle line is slower than the autocannon, not faster',
    cadence.small.gap > cadence.chain.gap,
    'rifle every ' + cadence.small.gap + 'ms, autocannon every ' + cadence.chain.gap + 'ms');
  ok('...while a sidearm is slower than anything else that shoots',
    ladder.every(k => k === 'pistol' || cadence.pistol.gap > cadence[k].gap),
    'a pistol every ' + cadence.pistol.gap + 'ms');
  ok('...and fires the fewest rounds of anything',
    ladder.every(k => k === 'pistol' || cadence.pistol.max < cadence[k].max),
    'at most ' + cadence.pistol.max + ' rounds');

  /* ----------------------------------------------------------------- sound */
  head('Each one reaches for its own sound');
  const heard = await p.evaluate(async () => {
    const calls = [];
    const S = window.SFX;
    ['shot', 'burst', 'rattle', 'shell', 'launch', 'incoming', 'impact'].forEach(n => {
      const was = S[n];
      S[n] = function () { calls.push(n); return was.apply(S, arguments); };
    });
    const s = window.PMC_STATE();
    function fire(code) {
      const u = s.units.find(x => x.side === 'A' && x.code === code);
      if (!u) return null;
      u.activated = false;
      window.__select(u);
      window.__pressAction('fire');
      const e = s.units.find(x => x.side === 'B' && x.alive && window.PMC.canShoot(s, u, x, 'fire', {}));
      if (!e) return null;
      const from = calls.length;
      window.__shootAt(e.id);
      return calls.slice(from);
    }
    const mgCalls = fire('HPV');
    const rifleCalls = fire('RIF');
    return { mg: mgCalls, rifle: rifleCalls };
  });
  ok('a machine gun rattles', (heard.mg || []).indexOf('rattle') >= 0, (heard.mg || []).join(' '));
  ok('...where a rifle team fires a burst of single shots',
    (heard.rifle || []).indexOf('burst') >= 0 && (heard.rifle || []).indexOf('rattle') < 0,
    (heard.rifle || []).join(' '));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
