/* The unit viewer fires as the battle does: a unit with Anti-tank (limited) at a
   hull within 6" fires its anti-tank weapon (battle armour's rockets, a rider's
   RPG), its own gun further off; a unit with Suppressive Fire kicks the ground up
   round the target when its shot hits. The firing line marks where the 6" begins. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'viewer.html'));
  await p.waitForTimeout(600);
  const setUp = (key, target, range) => p.evaluate(({ key, target, range }) => {
    const V = window.__viewer;
    V.pick(key);
    const sel = document.getElementById('vtarget');
    sel.value = target; sel.dispatchEvent(new Event('change', { bubbles: true }));
    V.range(range);
    return V.shotSpec();
  }, { key, target, range });
  // every effect kind that shows while a shot plays, and how many impacts at once at the most
  async function fireAndWatch(ms) {
    await p.evaluate(() => window.__viewer.fire());
    const seen = {};
    let impacts = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 2600)) {
      const snap = await p.evaluate(() => window.__viewer.fx());
      snap.forEach((k) => { seen[k] = (seen[k] || 0) + 1; });
      impacts = Math.max(impacts, snap.filter((k) => k === 'impact').length);
      await p.waitForTimeout(35);
    }
    return { seen, impacts };
  }

  console.log('\n  Anti-tank (limited) in the viewer');
  const near = await setUp('bats', 'lpv', 4);
  ok('battle armour at a light vehicle 4" off: three rockets, fragmentation', near.p === 'rocket' && near.n === 3 && near.blast === 'frag', JSON.stringify(near));
  const w1 = await fireAndWatch(2200);
  ok('...and the rockets fly', (w1.seen.missile || 0) > 0, JSON.stringify(w1.seen));
  await p.screenshot({ path: path.join(SHOTS, 'viewer-at.png') });
  const far = await setUp('bats', 'lpv', 12);
  ok('...12" off: its SMGs', far.p === 'smg', far.p);
  const soft = await setUp('bats', 'regular', 4);
  ok('...at a squad 4" off: its SMGs', soft.p === 'smg', soft.p);
  const rider = await setUp('rhellriders', 'lpv', 4);
  ok('Hellriders at the vehicle 4" off: an RPG round, fragmentation', rider.p === 'shell' && rider.n === 1 && rider.blast === 'frag', JSON.stringify(rider));
  const riderFar = await setUp('rhellriders', 'lpv', 10);
  ok('...10" off: Molotovs', riderFar.p === 'molotov', riderFar.p);

  console.log('\n  Suppressive Fire kicks the ground up');
  await setUp('hmgteam', 'regular', 14);
  const hmg = await fireAndWatch(2600);
  await setUp('regular', 'regular', 14);
  const rifle = await fireAndWatch(2600);
  ok('a heavy MG team’s hitting burst throws more of the ground up than a rifle team’s', hmg.impacts >= 4 && hmg.impacts > rifle.impacts,
    hmg.impacts + ' impacts at once against ' + rifle.impacts);

  console.log('\npage errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
