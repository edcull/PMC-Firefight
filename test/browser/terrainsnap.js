/* The terrain's safety net for the refactor, as artsnap is the units': a table
   built on every kind of world, twice over, with the clock and the dice frozen
   so the same code always paints the same pixels — the ground baked, the
   structures painted, and the whole board drawn at a fixed view, pixel for pixel, with its props
   and effects. Each is reduced to its fingerprints (test/art/print.js) and
   checked against the stored ones in test/art/terrain.json.

     node test/browser/terrainsnap.js            check against the baseline
     node test/browser/terrainsnap.js --exact    ...pixel for pixel
     node test/browser/terrainsnap.js --update   take a new baseline (after a change meant to alter the art)

   A mismatch writes the picture as it is now to test/art/diff/. Moving code
   about must not change a single pixel; another machine may move the edges a
   level or two, and that passes unless --exact. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const P = require('../art/print.js');
const { ROOT } = require('../where.js');

const UPDATE = process.argv.includes('--update');
const EXACT = process.argv.includes('--exact');
const BASE = path.join(ROOT, 'test', 'art', 'terrain.json');
const DIFF = path.join(ROOT, 'test', 'art', 'diff');
const WORLDS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
const SCENARIOS = ['meeting', 'takeover'];      // open ground, and one dug in with walls, trenches and a bunker

(async () => {
  const b = await chromium.launch({ args: (process.env.ART_ARGS || '').split(' ').filter(Boolean), executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  // at 1000 wide or less the board takes exactly its box, which is pinned below (game.js sizeView)
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    const T = 1700000000000;
    Date.now = () => T;
    const pn = 100000;
    performance.now = () => pn;
    let seed = 12345;
    Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    window.__reseed = (s) => { seed = s || 12345; };
  });
  await ctx.addInitScript({ content: 'window.__gridIn = ' + P.gridIn.toString() + ';' + P.NO_TEXT });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(800);
  /* The board is sized to the box it sits in, and that box to the header and the
     hint line under the table, whose heights are those of each machine's fonts:
     a pixel taller on one machine and every board is framed a pixel apart. So
     the box is pinned here. */
  await p.addStyleTag({ content: '.board-wrap { width: 612px !important; height: 720px !important; min-height: 0 !important; max-height: none !important; }' +
    ' .board-wrap .viewhint { height: 32px !important; overflow: hidden !important; }' });
  await p.evaluate(() => window.dispatchEvent(new Event('resize')));

  const got = {};
  let n = 0;
  for (const world of WORLDS) for (const scen of SCENARIOS) {
    const id = world + '@' + scen;
    await p.evaluate(({ world, scen, n }) => {
      window.__reseed(1000 + n);
      window.PMC_NEWGAME({ tier: 3, pl: 1, scenario: scen, planet: world, terrainSetup: 'auto', mode: 'hotseat',
        armyA: ['cmd2', 'regular', 'regular', 'rookie'], armyB: ['cmd2', 'regular', 'regular', 'rookie'] });
      const s = window.PMC_STATE();
      // the table on its own, the units off it, baked afresh and drawn at a fixed view
      s.units.forEach(u => { u.x = -1; u.y = -1; });
      window.dispatchEvent(new Event('resize'));
      window.__rebuildScene();
      /* at zoom 1 the board is the drawn table copied pixel for pixel; any other
         zoom smooths it down, and how a machine rounds that smoothing moves the
         colours a few levels across the whole board (draw.js) */
      window.PMC_SETVIEW(24, 24, 1);
    }, { world, scen, n });
    // the plates are baked a moment after the table is laid
    await p.waitForFunction(() => { const s = window.PMC_STATE(); return !!(s && s.ground && s.structs); }, null, { timeout: 20000 });
    await p.waitForTimeout(300);
    const pics = await p.evaluate((cell) => {
      const s = window.PMC_STATE();
      window.PMC_SETVIEW(24, 24, 1);
      const out = {};
      const one = (cv) => ({ url: cv.toDataURL('image/png'), grid: window.__gridIn(cv, cell) });
      if (s.ground && s.ground.toDataURL) out.ground = one(s.ground);
      if (s.structs && s.structs.toDataURL) out.structs = one(s.structs);
      out.board = one(document.getElementById('board'));
      out.size = document.getElementById('board').width + 'x' + document.getElementById('board').height;
      return out;
    }, P.CELL * 2);                 // whole tables, and textured: a coarser grid keeps the baseline small
    n++;
    if (n === 1) console.log('  the board is ' + pics.size + ' pixels');
    delete pics.size;
    for (const k of Object.keys(pics)) {
      got[id + ':' + k] = Object.assign(P.print(pics[k].url, pics[k].grid), { url: pics[k].url });
    }
  }
  await b.close();

  if (UPDATE) {
    fs.mkdirSync(path.dirname(BASE), { recursive: true });
    fs.writeFileSync(BASE, JSON.stringify(P.stored(got), null, 1) + '\n');
    console.log('  baseline taken: ' + Object.keys(got).length + ' pictures');
    console.log(errs.length ? '  page errors: ' + errs.join(' | ') : '  page errors: none');
    process.exit(errs.length ? 1 : 0);
  }
  const r = P.judge(JSON.parse(fs.readFileSync(BASE, 'utf8')), got, EXACT);
  if (r.changed.length) {
    fs.mkdirSync(DIFF, { recursive: true });
    r.changed.forEach(k => fs.writeFileSync(path.join(DIFF, k.replace(/[^\w@.-]+/g, '_') + '.png'),
      Buffer.from(got[k].url.split(',')[1], 'base64')));
    console.log('  changed: ' + r.changed.map(k => k + (r.by[k] === Infinity ? '' : ' (' + r.by[k] + ')')).join(', '));
  }
  console.log('  ' + Object.keys(got).length + ' pictures: ' + r.same.length + ' the same, ' + r.near.length +
    ' within ' + P.TOL + ' levels, ' + r.changed.length + ' changed, ' + r.added.length + ' new, ' + r.gone.length + ' gone' +
    (r.near.length || r.changed.length ? ' (the furthest cell moved ' + r.worst + ')' : ''));
  console.log(errs.length ? '  page errors: ' + errs.join(' | ') : '  page errors: none');
  if (r.why) Object.keys(r.why).forEach(k => console.log('    ' + k + ': ' + JSON.stringify(r.why[k])));
  process.exit(r.changed.length || r.gone.length || errs.length ? 1 : 0);
})();
