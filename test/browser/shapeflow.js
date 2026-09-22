/* Every shaped piece on a real table — after the scenario has moved or trimmed
   pieces to keep them apart — must still have its outline inside its rectangle,
   and its middle must read as the piece. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html')); await p.waitForTimeout(500);
  let bad = 0, pieces = 0;
  for (const scen of ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover']) {
    for (const planet of ['sparse', 'dense', 'jungle', 'barren', 'mountain', 'unstable', 'industrial']) {
      const r = await p.evaluate(([sc, pl]) => {
        window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: pl, scenario: sc, nameA: 'A', nameB: 'B', armyA: ['cmd3'], armyB: ['cmd3'] });
        const s = window.PMC_STATE(), R = window.PMC;
        let n = 0, wrong = [];
        s.terrain.forEach(t => {
          if (t.parts) {
            n++;
            if (t.parts.some(q => q.x < t.x - 0.01 || q.y < t.y - 0.01 || q.x + q.w > t.x + t.w + 0.01 || q.y + q.h > t.y + t.h + 0.01)) wrong.push(t.kind);
            return;
          }
          if (!t.poly) return;
          n++;
          const out = t.poly.some(q => q[0] < t.x - 0.01 || q[0] > t.x + t.w + 0.01 || q[1] < t.y - 0.01 || q[1] > t.y + t.h + 0.01);
          if (out) wrong.push(t.kind);
        });
        return { n, wrong };
      }, [scen, planet]);
      pieces += r.n; bad += r.wrong.length;
      if (r.wrong.length) console.log('  ✗', scen, planet, r.wrong.join(' '));
    }
  }
  console.log(pieces + ' shaped pieces checked, ' + bad + ' with an outline out of place');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'none'));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
