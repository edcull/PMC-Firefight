/* The gait: how a unit is drawn crossing the ground. Feet land every so many
   inches rather than every so many milliseconds, and the body rides with them,
   so this checks the frames alternate on the footfalls and the bob peaks
   between them — and that a hull on tracks does not walk. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(600);

  const data = await p.evaluate(() => {
    const P = window.PMC;
    function build(key, prop) {
      const pr = P.profile(key);
      const u = Object.assign({}, pr, { side: 'A', models: pr.size, rules: pr.rules.slice(),
        sp: 0, alive: true, damage: 0, cargo: [], x: 0, y: 0, facing: 0 });
      if (prop) P.applyPropulsion(u, prop);
      return u;
    }
    const out = {};
    out.foot = window.__pacing(build('regular'), 12, 240);
    out.mech = window.__pacing(build('acv', 'walker'), 12, 240);
    out.tracked = window.__pacing(build('acv', 'tracked'), 12, 240);
    out.grav = window.__gait(build('acv', 'grav'));
    out.hover = window.__gait(build('acv', 'hover'));
    out.air = window.__gait(build('gunboat'));
    return out;
  });

  head('A squad puts its feet down every couple of inches');
  const f = data.foot;
  ok('an infantry unit has a pace of its own', !!f && f.span > 1 && f.span < 4, f.span + '" a pace');
  const flips = f.samples.filter((s, i) => i && s.walk !== f.samples[i - 1].walk).length;
  ok('...and takes one over each of them across a 12" move',
    flips === Math.floor(12 / f.span), flips + ' paces in 12"');
  ok('...alternating feet, never the same frame twice running',
    f.samples.every(s => s.walk === 1 || s.walk === 2));

  head('The body rides with the feet rather than against them');
  // the bob is lowest where a foot lands and highest halfway between
  const low = f.samples.filter(s => Math.abs((s.d / f.span) % 1) < 0.02);
  ok('it is down on every footfall', low.every(s => s.hop < 0.15),
    'lowest ' + Math.max(...low.map(s => s.hop)).toFixed(2));
  const mid = f.samples.filter(s => Math.abs(((s.d / f.span) % 1) - 0.5) < 0.02);
  ok('...and up between them', mid.every(s => s.hop > f.lift * 0.9),
    'highest ' + Math.min(...mid.map(s => s.hop)).toFixed(2) + ' of ' + f.lift);
  ok('...and never dips below the ground', f.samples.every(s => s.hop >= 0));

  head('A machine moves like the machine it is');
  ok('a walker takes a longer stride than a man', data.mech.span > f.span,
    data.mech.span + '" against ' + f.span + '"');
  ok('...and is heard doing it', data.mech.sound === true);
  ok('a tracked hull pitches on its suspension instead of walking',
    data.tracked.lift < f.lift && data.tracked.sound === false,
    data.tracked.lift + ' of ' + f.lift);
  ok('...but it does still move on the ground', data.tracked.samples.some(s => s.hop > 0));
  ok('a grav hull floats — no gait at all', data.grav === null);
  ok('...and so does a hover skirt', data.hover === null);
  ok('...and an aircraft', data.air === null);

  head('It holds on the table, not just on paper');
  const live = await p.evaluate(async () => {
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting',
      nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd3', 'regular', 'veterans'], armyB: ['cmd3', 'regular', 'veterans'] });
    await new Promise(r => setTimeout(r, 900));
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach(u => { u.reserve = false; u.aboard = null; u.activated = false; });
    s.units.filter(u => u.side === 'A').forEach((u, i) => { u.x = 10; u.y = 14 + i * 3; });
    s.units.filter(u => u.side === 'B').forEach((u, i) => { u.x = 34; u.y = 14 + i * 3; });
    window.__rebuildScene();
    window.__clearSel();                 // and redraw, so the Begin button appears
    await new Promise(r => setTimeout(r, 250));
    s.activeSide = 'A'; s.initiative = 'A';
    const b2 = document.querySelector('button[data-act="start"]');
    if (b2) b2.click();
    await new Promise(r => setTimeout(r, 500));
    for (let i = 0; i < 8; i++) {
      const res = document.getElementById('resolution');
      if (res && !res.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      await new Promise(r => setTimeout(r, 120));
    }
    // the table plays out the start of the battle before it takes an order
    for (let i = 0; i < 100 && (window.__busy() || window.__showQueue()); i++) await new Promise(r => setTimeout(r, 50));
    s.activeSide = 'A';
    s.units.forEach(x => { x.activated = false; });
    const u = s.units.find(x => x.side === 'A' && x.code === 'RIF');
    window.__select(u);
    window.__pressAction('move');
    await new Promise(r => setTimeout(r, 100));
    const seen = { walk: {}, hop: [] };
    window.__tapMove({ x: u.x + 6, y: u.y });
    await new Promise(r => setTimeout(r, 80));
    window.__previewConfirm();
    for (let i = 0; i < 40; i++) {
      if (u.walk) seen.walk[u.walk] = (seen.walk[u.walk] || 0) + 1;
      seen.hop.push(u.hop || 0);
      await new Promise(r => setTimeout(r, 25));
    }
    return { frames: Object.keys(seen.walk).sort(), peak: Math.max(...seen.hop),
             ended: u.walk === 0 && (u.hop || 0) === 0 };
  });
  ok('a real move plays both frames', live.frames.length === 2, 'frames ' + live.frames.join(' & '));
  ok('...and lifts the squad as it goes', live.peak > 0.5, 'peak ' + live.peak.toFixed(2));
  ok('...and puts it flat on the ground when it stops', live.ended);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
