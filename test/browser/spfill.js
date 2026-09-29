/* A unit's Suppression bar fills while the shot at it plays: from the moment
   the rounds land it climbs from what it had towards what it now has, rather
   than jumping once the shot is over. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  // a heavy squad at close range on rookies in the open, until one volley puts Suppression on them
  let got = null;
  for (let tries = 0; tries < 6 && !(got && got.after > got.before); tries++) {
    got = await p.evaluate(async () => {
      window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
        armyA: ['cmd2', 'veterans', 'regular'], armyB: ['cmd2', 'rookie', 'rookie', 'rookie'] });
      await new Promise(r => setTimeout(r, 900));
      for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await new Promise(r => setTimeout(r, 100)); }
      const s = window.PMC_STATE();
      s.terrain.length = 0;
      s.units.forEach(u => { u.reserve = false; u.aboard = null; u.activated = false; });
      s.units.filter(u => u.side === 'A').forEach((u, i) => { u.x = 10; u.y = 10 + i * 6; });
      s.units.filter(u => u.side === 'B').forEach((t, i) => { t.x = 20; t.y = 10 + i * 6; });
      window.__rebuildScene(); window.__clearSel();
      const b2 = window.__beginButton(); if (b2) b2.click();
      await new Promise(r => setTimeout(r, 450));
      for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await new Promise(r => setTimeout(r, 100)); }
      s.activeSide = 'A'; s.initiative = 'A'; s.units.forEach(u => { u.activated = false; });
      const vets = s.units.find(u => u.side === 'A' && u.key === 'veterans');
      window.__clearSel(); window.__select(vets);
      if (!window.__pressAction('fire')) return { none: 'no fire' };
      const e = s.units.find(x => x.side === 'B' && x.alive && x.key === 'rookie' && window.PMC.canShoot(s, vets, x, 'fire', {}));
      if (!e) return { none: 'nothing in sight' };
      const before = e.sp;
      window.__shootAt(e.id);
      const seen = [];
      for (let i = 0; i < 200; i++) {
        seen.push(window.__shownSp(e.id));
        await new Promise(r => setTimeout(r, 15));
        if (i > 30 && !window.__busy() && !window.__showQueue()) break;
      }
      // what it is drawn with once all of it has played, taken fresh rather than the last sample in flight
      await new Promise(r => setTimeout(r, 400));
      return { before, after: e.sp, alive: e.alive, seen, settled: window.__shownSp(e.id) };
    });
    if (got.none) break;
  }
  ok('a shot put Suppression on the target', got && !got.none && got.after > got.before, got && (got.none || got.before + ' → ' + got.after));
  if (got && got.seen) {
    const between = got.seen.filter(v => v > got.before + 0.01 && v < got.after - 0.01);
    ok('...and its bar climbed through the values in between while the shot played', between.length >= 3,
      between.length + ' frames between ' + got.before + ' and ' + got.after);
    const rises = got.seen.every((v, i) => i === 0 || v >= got.seen[i - 1] - 1e-9);
    ok('...never going back down on the way', rises);
    ok('...and ends on what the rules gave it', got.settled === got.after, String(got.settled));
    ok('...having shown what it had until the rounds landed', got.seen[0] === got.before, String(got.seen[0]));
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
