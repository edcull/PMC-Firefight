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
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  head('Going in and coming out');
  await newGame(p);
  await p.evaluate(() => { window.__autoDeployBoth(); const b = document.querySelector('button[data-act="start"]'); if (b) b.click(); });
  await p.waitForTimeout(500); await drain(p);
  const r1 = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain = [{ kind: 'building', x: 20, y: 20, w: 4, h: 4 }];
    window.__rebuildScene();
    const u = s.units.find(x => x.side === s.activeSide && x.key === 'regular');
    s.units.forEach(x => { if (x !== u && x.x >= 0) { x.y = x.side === 'A' ? 4 : 44; } });
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
    return { st, sp, spots, out: !u.bld, x: u.x, y: u.y, wall: window.PMC.rectPointDist({ x: 20, y: 20, w: 4, h: 4 }, u.x, u.y) };
  }, r1.id);
  ok('inside, it cannot Move or Advance', !r2.st.move && !r2.st.advance);
  ok('...but is offered Exit', r2.sp.indexOf('exitbld') >= 0, r2.sp.join(' '));
  ok('Exit shows ground within 4" of the wall to come out onto', r2.spots > 0, r2.spots + ' spots');
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
  let entered = 0, turn = 0;
  for (let k = 0; k < 120; k++) {
    await p.waitForTimeout(250);
    await drain(p);
    const st = await p.evaluate(() => { const s = window.PMC_STATE(); return { turn: s.turn, over: !!s.over, inside: s.units.filter(u => u.alive && u.bld).length, twice: (function () { const seen = {}; let bad = 0; s.units.forEach(u => { if (!u.alive || !u.bld) return; const k2 = s.terrain.indexOf(u.bld) + ':' + (u.sec || 0); if (seen[k2]) bad++; seen[k2] = 1; }); return bad; })() }; });
    entered = Math.max(entered, st.inside); turn = st.turn;
    if (st.twice) { ok('never two units in one building', false, 'turn ' + st.turn); break; }
    if (st.over || st.turn >= 4) break;
  }
  const log = await p.evaluate(() => window.PMC_STATE().log.map(l => l.text).filter(t => /building/.test(t)).slice(0, 6));
  ok('the machine plays several turns on a built-up table without error', turn >= 2 && !errs.length, 'turn ' + turn);
  ok('...and garrisons buildings as it goes', entered > 0, entered + ' at once · ' + log.join(' | ').slice(0, 200));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
