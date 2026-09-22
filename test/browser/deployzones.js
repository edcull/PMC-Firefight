/* Every scenario, both ways round: auto-deploy each side and ask whether every
   unit ended up on ground that side is actually allowed to occupy.

   This is the harness that catches a deployment area the engine describes but
   cannot fill — the circle defenders in Demolish and Hostile takeover were being
   sampled as if they had a table-edge strip, so auto-deploy threw them onto the
   edge instead, illegal and nowhere near the objective they were there to hold. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  for (const pl of [1, 2]) {
    console.log('\n  PRIORITY LEVEL ' + pl);
    for (const scen of ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover']) {
      for (const atk of ['A', 'B']) {
        await p.evaluate(([scen, atk, pl]) => {
          window.PMC_NEWGAME({
            tier: 3, pl: pl, mode: 'hotseat', planet: 'dense', scenario: scen, attacker: atk,
            nameA: 'Ironhold', nameB: 'Kessler',
            armyA: window.PMC.rollArmy(3, pl), armyB: window.PMC.rollArmy(3, pl)
          });
        }, [scen, atk, pl]);
        await p.waitForTimeout(700);
        for (let i = 0; i < 8; i++) {
          await p.evaluate(() => {
            const c = document.getElementById('res-continue'); if (c) c.click();
          });
          await p.waitForTimeout(80);
        }
        await p.evaluate(() => window.__autoDeployBoth());
        await p.waitForTimeout(250);

        const r = await p.evaluate(() => {
          const s = window.PMC_STATE();
          const on = s.units.filter(u => u.x >= 0 && !u.aboard);
          return {
            phase: s.phase,
            scen: s.scen.id,
            atk: s.sc.attacker || null,
            placed: on.length,
            illegal: on.filter(u => !window.__deployOK(u.x, u.y, u.side))
              .map(u => u.side + u.code + '@' + Math.round(u.x) + ',' + Math.round(u.y)),
            unplaced: s.units.filter(u => u.x < 0 && !u.reserve && !u.aboard).length,
            // the defender of a circle scenario belongs inside its circle
            outside: (s.sc.defCircle
              ? on.filter(u => u.side === s.sc.defender &&
                Math.hypot(u.x - s.sc.defCircle.x, u.y - s.sc.defCircle.y) > s.sc.defCircle.r + 0.01).length
              : 0)
          };
        });
        const label = (r.scen + (r.atk ? ' · ' + r.atk + ' attacks' : '')).padEnd(24);
        ok(label + 'everyone is on ground they may hold', !r.illegal.length && !r.unplaced,
          r.placed + ' placed' + (r.unplaced ? ', ' + r.unplaced + ' unplaced' : '') +
          (r.illegal.length ? ', illegal: ' + r.illegal.join(' ') : ''));
        if (r.atk && r.scen !== 'invasion') {
          ok(label + 'the defender is round its objective', r.outside === 0,
            r.outside ? r.outside + ' outside the circle' : 'all inside');
        }
      }
    }
  }

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
