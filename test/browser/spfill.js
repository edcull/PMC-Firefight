/* A unit's Suppression bar fills while the shot at it plays: from the moment
   the rounds land it climbs from what it had towards what it now has, rather
   than jumping once the shot is over — its segments, one an SP, lighting one
   after another. */
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
      e.def = 2;                                  // a soft target, so men fall and its Morale with them
      const before = e.sp, moraleBefore = window.PMC.currentMorale(e);
      window.__shootAt(e.id);
      const seen = [], lit = [], mor = [], at = [];
      const litNow = () => window.PMCIso.spSegments(window.__shownSp(e.id), window.__shownMorale(e.id)).filter(q => q.lit).length;
      for (let i = 0; i < 200; i++) {
        seen.push(window.__shownSp(e.id)); lit.push(litNow()); mor.push(window.__shownMorale(e.id)); at.push(performance.now());
        await new Promise(r => setTimeout(r, 15));
        if (i > 30 && !window.__busy() && !window.__showQueue()) break;
      }
      // what it is drawn with once all of it has played, taken fresh rather than the last sample in flight
      await new Promise(r => setTimeout(r, 400));
      return { before, after: e.sp, alive: e.alive, seen, lit, mor, at, moraleBefore, moraleAfter: e.alive ? window.PMC.currentMorale(e) : null,
        settled: window.__shownSp(e.id), litSettled: litNow() };
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
    // the bar's segments: from what it had lit, each one in turn, to one an SP it now has
    /* A sample is taken every 15ms, but a busy machine can hold one back, and the bar
       goes on filling meanwhile: a segment skipped across a sample that came late
       (over 50ms after the one before) is the sampler's, not the bar's. */
    const steps = [], late = [];
    got.lit.forEach((v, i) => { if (i === 0 || v !== got.lit[i - 1]) { steps.push(v); late.push(i > 0 && got.at[i] - got.at[i - 1] > 50); } });
    ok('its segments lit one after another', steps[0] === got.before && steps.every((v, i) => i === 0 || v === steps[i - 1] + 1 || (late[i] && v > steps[i - 1])),
      steps.map((v, i) => (late[i] ? '(late) ' : '') + v).join(' → '));
    ok('...each for a while, not all at once', got.after - got.before < 2 || new Set(got.lit).size >= 3, new Set(got.lit).size + ' counts seen');
    ok('...ending with one lit an SP', got.litSettled === got.after, got.litSettled + ' lit');
    // the bands are as wide as its Morale as it stands: men lost bring them in, as they fall
    if (got.moraleAfter != null && got.moraleAfter !== got.moraleBefore) {
      const turn = got.mor.findIndex(v => v === got.moraleAfter), last = got.mor.length - 1;
      ok('its losses narrowed the bands while the shot played, not after', turn > 0 && turn < last && got.mor[0] === got.moraleBefore,
        'Morale ' + got.moraleBefore + ' → ' + got.moraleAfter + ' at frame ' + turn + ' of ' + last);
    } else console.log('    - (no Morale lost to this shot: the bands stayed as they were)');
  }
  // the segments themselves, at Morale 3: the bands and what is lit (your examples)
  const bands = await p.evaluate(() => [0, 1, 4, 7, 10].map(sp => window.PMCIso.spSegments(sp, 3)
    .map(q => (q.lit ? 'GAR!' : 'gar.')[q.band]).join('')));
  // lit capitals, dull lower case: g green, a amber, r red; black dull '.', lit '!'
  ok('Morale 3: 0 SP, every segment dull', bands[0] === 'gggaaarrr...', bands[0]);
  ok('...1 SP', bands[1] === 'Gggaaarrr...', bands[1]);
  ok('...4 SP', bands[2] === 'GGGAaarrr...', bands[2]);
  ok('...7 SP', bands[3] === 'GGGAAARrr...', bands[3]);
  ok('...10 SP: past three times its Morale, lit red against black', bands[4] === 'GGGAAARRR!..', bands[4]);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
