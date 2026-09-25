/* The art safety net for the refactor: every unit in the Unit Viewer, drawn at
   two facings and destroyed (plus the stances and loads that change a model:
   emplaced, dug in and towed guns, and a Lifter's slung vehicles), with the
   clock and the dice frozen so the same code always paints the same pixels.
   Each picture is reduced to a fingerprint and checked against the stored
   ones in test/art/baseline.json.

     node test/browser/artsnap.js            check against the baseline
     node test/browser/artsnap.js --update   take a new baseline (after a change meant to alter the art)

   A mismatch writes the picture as it is now to test/art/diff/, named for the
   case, so what changed can be looked at. Moving code about must not change a
   single fingerprint. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ROOT } = require('../where.js');

const UPDATE = process.argv.includes('--update');
const BASE = path.join(ROOT, 'test', 'art', 'baseline.json');
const DIFF = path.join(ROOT, 'test', 'art', 'diff');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  /* A frozen clock and seeded dice: rotors, lights, flames and the wobble of a
     burning wreck are all worked from the time, and misses from Math.random. */
  await ctx.addInitScript(() => {
    const T = 1700000000000;
    Date.now = () => T;
    const pn = 100000;
    performance.now = () => pn;
    let seed = 12345;
    Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    window.__reseed = () => { seed = 12345; };
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'viewer.html'));
  await p.waitForTimeout(800);

  const keys = await p.evaluate(() => window.PMC.CATALOGUE.map(u => u.key));
  const cases = [];
  keys.forEach(k => {
    cases.push({ id: k + '@SE', key: k, face: 'SE' });
    cases.push({ id: k + '@NW', key: k, face: 'NW' });
    cases.push({ id: k + '@destroyed', key: k, face: 'SE', destroyed: true });
  });
  // the stances and loads that change what is drawn
  ['rmedart', 'rheavyart', 'rheavyac'].forEach(k => {
    ['dug', 'towed'].forEach(st => ['SE', 'NE'].forEach(f => cases.push({ id: k + '@' + st + '@' + f, key: k, face: f, set: { stance: st } })));
  });
  [['rtechnical', 'wheeled'], ['rhicv', 'walker'], ['ritv', 'walker'], ['rshtv', 'tracked']].forEach(([v, d]) => {
    ['SE', 'SW'].forEach(f => cases.push({ id: 'rlifter+' + v + '@' + f, key: 'rlifter', face: f, set: { sling: v, slingProp: d } }));
  });

  const got = {};
  let n = 0;
  for (const c of cases) {
    const url = await p.evaluate((c) => {
      window.__reseed();
      const V = window.__viewer;
      V.pick(c.key);
      V.destroy(!!c.destroyed);
      V.set('stance', 'ready'); V.set('sling', 'none');
      for (const k in (c.set || {})) V.set(k, c.set[k]);
      V.set('face', c.face);
      V.set('zCur', V.zoom().zoom);                    // no easing: straight to the zoom it will settle at
      V.set('face', c.face);
      return document.getElementById('vboard').toDataURL('image/png');
    }, c);
    const h = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
    got[c.id] = { h: h, url: url };
    if (++n % 100 === 0) process.stdout.write('  ' + n + '/' + cases.length + '\n');
  }

  const hashes = {};
  Object.keys(got).sort().forEach(k => { hashes[k] = got[k].h; });
  if (UPDATE) {
    fs.mkdirSync(path.dirname(BASE), { recursive: true });
    fs.writeFileSync(BASE, JSON.stringify(hashes, null, 1) + '\n');
    console.log('\n  baseline taken: ' + Object.keys(hashes).length + ' pictures → ' + path.relative(ROOT, BASE));
  } else {
    if (!fs.existsSync(BASE)) { console.log('  no baseline yet: run with --update first'); process.exit(1); }
    const want = JSON.parse(fs.readFileSync(BASE, 'utf8'));
    const changed = [], added = [], gone = [];
    Object.keys(hashes).forEach(k => { if (!(k in want)) added.push(k); else if (want[k] !== hashes[k]) changed.push(k); });
    Object.keys(want).forEach(k => { if (!(k in hashes)) gone.push(k); });
    if (changed.length) {
      fs.mkdirSync(DIFF, { recursive: true });
      changed.forEach(k => fs.writeFileSync(path.join(DIFF, k.replace(/[^\w@+.-]/g, '_') + '.png'),
        Buffer.from(got[k].url.split(',')[1], 'base64')));
    }
    console.log('\n  ' + Object.keys(hashes).length + ' pictures: ' + changed.length + ' changed, ' + added.length + ' new, ' + gone.length + ' gone');
    if (changed.length) console.log('    changed: ' + changed.slice(0, 30).join(', ') + (changed.length > 30 ? ' …' : '') + '\n    (as they are now: ' + path.relative(ROOT, DIFF) + '/)');
    if (added.length) console.log('    new: ' + added.slice(0, 20).join(', '));
    if (gone.length) console.log('    gone: ' + gone.slice(0, 20).join(', '));
    if (errs.length) console.log('    page errors: ' + errs.join(' | '));
    await b.close();
    process.exit(changed.length || gone.length || errs.length ? 1 : 0);
  }
  if (errs.length) console.log('  page errors: ' + errs.join(' | '));
  await b.close();
})();
