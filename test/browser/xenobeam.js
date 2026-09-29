/* The Xenotripods teleport in however they arrive — by Battlefield Insertion
   or as an Invasion's attacker coming down from orbit — all but the Esh-Aven,
   who come up out of the ground as men do; everyone else still drops. */
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
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: ['xalpha3', 'xbeta3', 'xeps3', 'xsturret3'], armyB: ['cmd2', 'regular', 'regular', 'lcv'] });
  });
  await p.waitForTimeout(900);
  const kinds = await p.evaluate(() => {
    const s = window.PMC_STATE(), out = {};
    ['xbeta3', 'xeps3', 'xsturret3', 'regular', 'lcv'].forEach((k) => {
      const u = s.units.find((x) => x.key === k);
      u.reserve = false; u.x = 20; u.y = 18;
      window.__landUnit(u, false); const ins = u.arriveKind;
      window.__landUnit(u, true); out[k] = { ins, orbit: u.arriveKind };
    });
    return out;
  });
  console.log('\nArriving by insertion, and out of orbit');
  ok('a Crock squad teleports in by insertion', kinds.xbeta3.ins === 'teleport', kinds.xbeta3.ins);
  ok('...and out of orbit, as an Invasion\'s attacker', kinds.xbeta3.orbit === 'teleport', kinds.xbeta3.orbit);
  ok('a Xenotripod machine too, both ways', kinds.xsturret3.ins === 'teleport' && kinds.xsturret3.orbit === 'teleport', kinds.xsturret3.orbit);
  ok('the Esh-Aven do not teleport: up out of the ground, and dropped from orbit', kinds.xeps3.ins === 'stand' && kinds.xeps3.orbit === 'drop',
    kinds.xeps3.ins + ' / ' + kinds.xeps3.orbit);
  ok('anyone else out of orbit drops, as before', kinds.regular.orbit === 'drop' && kinds.lcv.orbit === 'drop', kinds.regular.orbit + ' / ' + kinds.lcv.orbit);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
