/* The unit viewer steps through its list without opening it: a swipe left on
   the stage brings up the next unit and a swipe right the one before; a swipe
   up the first unit of the next group and a swipe down the group before. The
   arrow keys do the same. A swipe is never taken for a tap (which fires). */
const { chromium } = require('playwright');
const { viewer } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + viewer);
  await p.waitForTimeout(1200);
  const key = () => p.evaluate(() => window.__viewer.key());
  const list = () => p.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#vlist .unit[data-k]'), (c) => c.getAttribute('data-k')));
  const group = (k) => p.evaluate((k) => window.PMC.profile(k).group, k);
  const box = await p.locator('#vboard').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  async function drag(dx, dy) {
    await p.mouse.move(cx, cy); await p.mouse.down();
    await p.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 4 }); await p.mouse.move(cx + dx, cy + dy, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(250);
  }
  const shots = () => p.evaluate(() => (window.__fxlive ? window.__fxlive() : 0));

  console.log('\n  Left and right: a unit at a time');
  const ks = await list(), k0 = await key(), i0 = ks.indexOf(k0);
  ok('the list is there and the stage shows one of its units', ks.length > 5 && i0 >= 0, ks.length + ' units, on ' + k0);
  await drag(-160, 6);
  ok('a swipe left brings up the next unit', await key() === ks[i0 + 1], await key());
  await drag(160, -4);
  ok('...and a swipe right the one before', await key() === k0, await key());
  await drag(160, 0);
  ok('...right again from the first wraps round to the last', await key() === ks[(i0 - 1 + ks.length) % ks.length], await key());
  await drag(-160, 0);

  console.log('\n  Up and down: a group at a time');
  const g0 = await group(await key());
  await drag(4, -160);
  const k1 = await key(), g1 = await group(k1);
  ok('a swipe up goes to the next group', g1 !== g0, g0 + ' → ' + g1);
  ok('...to its first unit', ks.find((k) => ks.indexOf(k) >= 0 && k === k1) && ks.filter((k) => ks.indexOf(k) < ks.indexOf(k1)).every((k) => ks.indexOf(k) < ks.indexOf(k1)) && (await Promise.all(ks.slice(0, ks.indexOf(k1)).map(group))).indexOf(g1) < 0, k1);
  await drag(0, 160);
  ok('a swipe down goes back to the group before', await group(await key()) === g0, await group(await key()));

  console.log('\n  Not a swipe');
  const was = await key();
  await drag(-30, 0);
  ok('a short drag leaves the unit where it is', await key() === was);
  await drag(-120, -110);
  ok('...and so does a diagonal one', await key() === was);

  console.log('\n  The arrow keys');
  const a0 = await key(), ai = (await list()).indexOf(a0);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok('→ the next unit', await key() === (await list())[ai + 1]);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  ok('← back', await key() === a0);
  const ag = await group(a0);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150);
  ok('↓ the next group', await group(await key()) !== ag);
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150);
  ok('↑ the group before', await group(await key()) === ag);

  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
