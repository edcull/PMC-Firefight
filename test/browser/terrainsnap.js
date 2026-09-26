/* The terrain's safety net for the refactor, as artsnap is the units': a table
   built on every kind of world, twice over, with the clock and the dice frozen
   so the same code always paints the same pixels — the ground baked, the
   structures painted, and the whole board drawn at a fixed view with its props
   and effects. Each is reduced to a fingerprint and checked against the stored
   ones in test/art/terrain.json.

     node test/browser/terrainsnap.js            check against the baseline
     node test/browser/terrainsnap.js --update   take a new baseline (after a change meant to alter the art)

   A mismatch writes the picture as it is now to test/art/diff/. Moving code
   about must not change a single fingerprint. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ROOT } = require('../where.js');

const UPDATE = process.argv.includes('--update');
const BASE = path.join(ROOT, 'test', 'art', 'terrain.json');
const DIFF = path.join(ROOT, 'test', 'art', 'diff');
const WORLDS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
const SCENARIOS = ['meeting', 'takeover'];      // open ground, and one dug in with walls, trenches and a bunker

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    const T = 1700000000000;
    Date.now = () => T;
    const pn = 100000;
    performance.now = () => pn;
    let seed = 12345;
    Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    window.__reseed = (s) => { seed = s || 12345; };
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(800);

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
      window.__rebuildScene();
      window.PMC_SETVIEW(24, 24, 0.55);
    }, { world, scen, n });
    // the plates are baked a moment after the table is laid
    await p.waitForFunction(() => { const s = window.PMC_STATE(); return !!(s && s.ground && s.structs); }, null, { timeout: 20000 });
    await p.waitForTimeout(300);
    const pics = await p.evaluate(() => {
      const s = window.PMC_STATE();
      window.PMC_SETVIEW(24, 24, 0.55);
      const out = {};
      if (s.ground && s.ground.toDataURL) out.ground = s.ground.toDataURL('image/png');
      if (s.structs && s.structs.toDataURL) out.structs = s.structs.toDataURL('image/png');
      out.board = document.getElementById('board').toDataURL('image/png');
      return out;
    });
    n++;
    for (const k of Object.keys(pics)) {
      got[id + ':' + k] = { h: crypto.createHash('sha1').update(pics[k]).digest('hex').slice(0, 16), url: pics[k] };
    }
  }
  await b.close();

  const hashes = {};
  Object.keys(got).forEach(k => { hashes[k] = got[k].h; });
  if (UPDATE) {
    fs.mkdirSync(path.dirname(BASE), { recursive: true });
    fs.writeFileSync(BASE, JSON.stringify(hashes, null, 1) + '\n');
    console.log('  baseline taken: ' + Object.keys(hashes).length + ' pictures');
    console.log(errs.length ? '  page errors: ' + errs.join(' | ') : '  page errors: none');
    process.exit(errs.length ? 1 : 0);
  }
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  const changed = [], fresh = [], gone = Object.keys(base).filter(k => !(k in hashes));
  Object.keys(hashes).forEach(k => {
    if (!(k in base)) fresh.push(k);
    else if (base[k] !== hashes[k]) changed.push(k);
  });
  if (changed.length) {
    fs.mkdirSync(DIFF, { recursive: true });
    changed.forEach(k => fs.writeFileSync(path.join(DIFF, k.replace(/[^\w@.-]+/g, '_') + '.png'),
      Buffer.from(got[k].url.split(',')[1], 'base64')));
    console.log('  changed: ' + changed.join(', '));
  }
  console.log('  ' + Object.keys(hashes).length + ' pictures: ' + changed.length + ' changed, ' + fresh.length + ' new, ' + gone.length + ' gone');
  console.log(errs.length ? '  page errors: ' + errs.join(' | ') : '  page errors: none');
  process.exit(changed.length || gone.length || errs.length ? 1 : 0);
})();
