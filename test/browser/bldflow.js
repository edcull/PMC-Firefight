/* Buildings through the page (p. 41): Enter as a special action, a lit
   building to tap, no moving inside, Exit onto ground within 4", a building
   garrisoned from deployment, and the OpFor using them in a battle. */
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
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden || !!window.__resOpen());
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(120);
  }
  /* and let the table finish playing out: a selection made while it is still
     animating is queued behind the animation, so on a loaded machine the
     squad was not yet selected when its actions were read */
  await p.waitForFunction(() => !window.__busy() && window.__showQueue() === 0, null, { timeout: 15000 }).catch(() => {});
}
async function newGame(p, cfg) {
  await p.evaluate((c) => window.PMC_NEWGAME(c), Object.assign({
    tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', terrainSetup: 'auto',
    nameA: 'Ours', nameB: 'Theirs',
    armyA: ['cmd3', 'regular', 'veterans', 'hmgteam'],
    armyB: ['cmd3', 'regular', 'veterans', 'hmgteam']
  }, cfg || {}));
  await p.waitForTimeout(700);
  await drain(p);
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  head('Going in and coming out');
  await newGame(p);
  await p.evaluate(() => { window.__autoDeployBoth(); const b = window.__beginButton(); if (b) b.click(); });
  await p.waitForTimeout(500); await drain(p);
  const r1 = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain = [{ kind: 'building', x: 20, y: 20, w: 4, h: 4 }];
    window.__rebuildScene();
    const u = s.units.find(x => x.side === s.activeSide && x.key === 'regular');
    s.units.forEach(x => { if (x !== u && x.x >= 0) { x.y = x.side === 'A' ? 4 : 44; } });
    // the deployment may have garrisoned it in one of the table's own buildings: out of that first
    u.bld = null; u.sec = null;
    u.x = 17; u.y = 22; u.activated = false; u.sp = 0;
    window.__select(u);
    const offered = window.__specials().indexOf('enter') >= 0;
    const pressed = window.__pressAction('enter');
    return { offered, pressed, id: u.id };
  });
  await drain(p);
  const r1b = await p.evaluate((id) => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.id === id);
    const dbg = window.__uiMode();
    const lit = document.getElementById('context').innerText;
    window.__boardTapAt(22, 22);
    return { dbg, lit, inside: !!u.bld, x: u.x, y: u.y, done: u.activated, res: window.__resOpen() };
  }, r1.id);
  Object.assign(r1, r1b);
  ok('a squad beside a building is offered Enter', r1.offered && r1.pressed);
  ok('...the panel asks which building', /Go into which building/i.test(r1.lit || ''));
  ok('...and a tap on it puts the squad inside', r1.inside && r1.x === 22 && r1.y === 22, r1.x + ',' + r1.y);
  ok('...as its action', r1.done);
  await drain(p);
  const r2 = await p.evaluate((id) => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.id === id);
    u.activated = false; s.activeSide = u.side;
    window.__select(u);
    const st = { move: window.__actionState('move').on, advance: window.__actionState('advance').on, fire: window.__actionState('fire').hint };
    const sp = window.__specials();
    window.__pressAction('exitbld');
    const spots = window.__moves.length;
    const spot = window.__moves[0];
    window.__tapMove ? null : null;
    window.__boardTapAt(spot.x, spot.y);
    return { st, sp, spots, out: !u.bld, x: u.x, y: u.y, wall: window.PMC.rectPointDist({ x: 20, y: 20, w: 4, h: 4 }, u.x, u.y) - window.PMC.UNIT_R };
  }, r1.id);
  ok('inside, it cannot Move or Advance', !r2.st.move && !r2.st.advance);
  ok('...but is offered Exit', r2.sp.indexOf('exitbld') >= 0, r2.sp.join(' '));
  ok('Exit shows ground within 4" of the wall to come out onto', r2.spots > 0, r2.spots + ' spots');
  // within 4" as going in is measured: from the wall to the near edge of its base (p. 41)
  ok('...and a tap there brings it out', r2.out && r2.wall <= 4.01, r2.x + ',' + r2.y);
  await drain(p);
  const r3 = await p.evaluate((id) => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.id === id);
    window.PMC.enterBuilding(s, u, s.terrain[0], 0);
    window.__clearSel();
    window.__boardTapAt(21, 23.6);            // near a corner of the building, away from its middle
    return window.__uiMode().sel === u.id;
  }, r1.id);
  ok('a garrison is picked by tapping its building', r3);
  await drain(p);

  head('Garrisoned from the start');
  await newGame(p, { scenario: 'takeover', roles: { attacker: 'A', defender: 'B' }, mode: 'ai' });
  const g = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const bunker = s.terrain.find(t => t.kind === 'bunker');
    const inside = s.units.filter(u => u.bld);
    return { bunker: !!bunker, garrisons: inside.map(u => u.side + ':' + u.name + ' in ' + u.bld.kind), legal: inside.every(u => window.PMC.inRect(u.x, u.y, u.bld)) };
  });
  ok('Hostile takeover has its bunker', g.bunker);
  ok('the defending OpFor puts squads into buildings as it deploys', g.garrisons.length > 0, g.garrisons.join(', '));
  ok('...each inside the building it holds', g.legal);

  head('A battle with buildings in it');
  await newGame(p, { mode: 'demo', planet: 'dense', scenario: 'secure', armyA: ['cmd3', 'regular', 'veterans', 'regular', 'hmgteam', 'regular'], armyB: ['cmd3', 'regular', 'veterans', 'regular', 'hmgteam', 'regular'] });
  /* The machine takes a building when a squad of its stands in the open beside
     one and its behaviour roll comes up defensive or neutral, 70% of the time
     (engine/ai.js). So that is arranged rather than hoped for: every squad of
     one side is put in the open just outside a building of its own, and the
     dice come up low until one has gone in. */
  /* A watched battle walks itself on, a step at a time, but not while the
     menu is up: it is held there while the table is arranged, so no squad of
     theirs acts on the old positions in the meantime. */
  await p.evaluate(() => window.PMCMenu.open());
  await drain(p);
  const placed = await p.evaluate(() => {
    const s = window.PMC_STATE(), R = window.PMC;
    // a dense table is rolled, and the roll can come up with no buildings at all: then two are put up in the middle
    if (!s.terrain.some(t => t.kind === 'building')) {
      s.terrain.push({ kind: 'building', x: 14, y: 21, w: 4, h: 4 }, { kind: 'building', x: 30, y: 21, w: 4, h: 4 });
      window.__rebuildScene();
    }
    const blds = s.terrain.filter(t => t.kind === 'building');
    let n = 0;
    s.units.filter(u => u.side === 'B' && u.alive && !u.bld && u.x >= 0 && !R.isMachine(u)).forEach((u, i) => {
      const b = blds[i % Math.max(1, blds.length)];
      if (!b) return;
      const tries = [[b.x - 1.8, b.y + b.h / 2], [b.x + b.w + 1.8, b.y + b.h / 2], [b.x + b.w / 2, b.y - 1.8], [b.x + b.w / 2, b.y + b.h + 1.8]];
      /* in the open and in an enemy's sight: a pinned squad already in cover, or
         out of every enemy's sight, stays where it is instead (p. 34) */
      const seen = (q) => s.units.some(e => e.side !== u.side && e.alive && e.x >= 0 && !e.aboard && R.hasLoS(s, e, { x: q[0], y: q[1], alive: true }));
      const at = tries.find(q => q[0] > 1.5 && q[1] > 1.5 && q[0] < 46.5 && q[1] < 46.5 && R.terrainAt(s, q[0], q[1]) === 'open' &&
        R.coverAt(s, q[0], q[1], u) === 0 && seen(q) &&
        !s.units.some(o => o !== u && o.alive && o.x >= 0 && Math.hypot(o.x - q[0], o.y - q[1]) < 2.6));
      if (!at) return;
      u.x = at[0]; u.y = at[1]; u.ax = u.ay = null; n++;
      // pinned down: a suppressed squad beside an empty building gets inside it (engine/ai.js)
      u.sp = R.currentMorale(u) + 1;
    });
    window.__realRandom = Math.random;
    /* Low dice, but never the same twice running: a roll-off that re-rolls
       ties (the initiative, each turn) would never end on one fixed value. */
    const low = [0.02, 0.12, 0.22];
    let li = 0;
    Math.random = () => low[li++ % low.length];
    window.__clearSel();
    // their squads get their own activations this turn, from where they now stand
    s.units.forEach(u => { if (u.side === 'B') u.activated = false; });
    return { buildings: blds.length, placed: n };
  });
  await p.evaluate(() => window.PMCMenu.close());
  ok('squads of one side stand in the open beside the buildings', placed.placed > 0, placed.placed + ' placed beside ' + placed.buildings + ' buildings');
  let entered = 0, turn = 0;
  /* What is being shown is a few turns on a built-up table with a squad gone
     in: once both are seen there is nothing more to wait for. A software-drawn
     page is slow, so the watch is also held to a few minutes. */
  const until = Date.now() + 180000;
  for (let k = 0; k < 120 && Date.now() < until; k++) {
    await p.waitForTimeout(250);
    await drain(p);
    const st = await p.evaluate(() => { const s = window.PMC_STATE(); return { turn: s.turn, over: !!s.over, inside: s.units.filter(u => u.alive && u.bld).length + s.log.filter(l => / goes into the | gets into the /.test(l.text || '')).length, twice: (function () { const seen = {}; let bad = 0; s.units.forEach(u => { if (!u.alive || !u.bld) return; const k2 = s.terrain.indexOf(u.bld) + ':' + (u.sec || 0); if (seen[k2]) bad++; seen[k2] = 1; }); return bad; })() }; });
    entered = Math.max(entered, st.inside); turn = st.turn;
    // one in: the dice go back to being dice
    if (st.inside) await p.evaluate(() => { if (window.__realRandom) { Math.random = window.__realRandom; window.__realRandom = null; } });
    if (st.twice) { ok('never two units in one building', false, 'turn ' + st.turn); break; }
    if (st.over || st.turn >= 4 || (st.turn >= 2 && entered > 0)) break;
  }
  const log = await p.evaluate(() => window.PMC_STATE().log.map(l => l.text).filter(t => /building/.test(t)).slice(0, 6));
  /* The state is only looked at every quarter second, and a squad can go in
     and come out again between two looks — so the log's word that one went
     in counts as well. */
  // (a pinned squad "gets into" one; a squad that went in and "comes out" again had been in)
  const wentIn = await p.evaluate(() => window.PMC_STATE().log.filter(l => / goes into the | gets into the | comes out of the building/.test(l.text || '')).length);
  ok('the machine plays several turns on a built-up table without error', turn >= 2 && !errs.length, 'turn ' + turn);
  ok('...and garrisons buildings as it goes', entered > 0 || wentIn > 0, entered + ' at once, ' + wentIn + ' went in · ' + log.join(' | ').slice(0, 200));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
