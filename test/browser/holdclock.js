/* An objective won by holding it so many End phases running (Secure the area,
   Find and secure) counts its rounds on its ring: one arc a round, those held
   filled in the colours of the side holding it, those to go dashed. */
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
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'secure', nameA: 'Ours', nameB: 'Theirs',
      armyA: window.PMC.rollArmy(3, 1, null, 'pmc'), armyB: window.PMC.rollArmy(3, 1, null, 'pmc') });
  });
  await p.waitForTimeout(900);

  // the arcs the ring is stroked in: counted by wrapping the canvas's ellipse() over the next few frames
  const draw = async (fn) => {
    await p.evaluate((src) => {
      const s = window.PMC_STATE();
      (new Function('s', src))(s);
      const P = CanvasRenderingContext2D.prototype;
      window.__arcs = [];
      if (!window.__realEllipse) window.__realEllipse = P.ellipse;
      P.ellipse = function (x, y, rx, ry, rot, a0, a1) {
        window.__arcs.push({ part: Math.abs(a1 - a0) < 6, dash: this.getLineDash().length > 0 });
        return window.__realEllipse.apply(this, arguments);
      };
      window.__rebuildScene();
    }, fn.toString().replace(/^[^{]*{|}$/g, ''));
    await p.waitForTimeout(400);
    return p.evaluate(() => {
      CanvasRenderingContext2D.prototype.ellipse = window.__realEllipse;
      const s = window.PMC_STATE(), arcs = window.__arcs.filter((a) => a.part);
      // one full draw's worth: the arcs repeat each frame, so the first frame's share
      const per = s.objectives.reduce((n, o, i) => { const c = window.PMCScen.holdClock(s, i); return n + (c ? c.need * 2 : 0); }, 0);
      return { clock: s.objectives.map((o, i) => window.PMCScen.holdClock(s, i)), arcs: per ? arcs.slice(arcs.length - per) : arcs, frames: per ? arcs.length / per : 0 };
    });
  };

  console.log('\nSecure the area: the same two held three End phases running');
  const none = await draw(() => { s.sc.streak = { A: { key: '', n: 0 }, B: { key: '', n: 0 } }; });
  ok('nobody holding: each objective a ring of three arcs, all dashed', none.clock.every((c) => c && c.need === 3 && c.n === 0) &&
    none.arcs.length >= 9 * 2 && none.arcs.every((a) => a.dash), JSON.stringify(none.clock) + ' arcs ' + none.arcs.length);
  const two = await draw(() => { s.sc.streak = { A: { key: '0,1', n: 2 }, B: { key: '', n: 0 } }; s.objectives[0].owner = 'A'; s.objectives[1].owner = 'A'; });
  ok('A holding two for two rounds: those two read 2 of 3, the third none', two.clock[0].n === 2 && two.clock[0].side === 'A' && two.clock[1].n === 2 && two.clock[2].n === 0);
  ok('...four arcs drawn solid (two on each), the rest dashed', two.arcs.filter((a) => !a.dash).length === 4 * 2 && two.arcs.filter((a) => a.dash).length === 5 * 2,
    two.arcs.filter((a) => !a.dash).length + ' solid strokes');
  // a look at it: the briefing put away, the camera close in on the first objective
  const done = p.getByRole('button', { name: /^done$/i });
  if (await done.count()) await done.first().click();
  await p.evaluate(() => { const o = window.PMC_STATE().objectives[0]; window.__setZoom(1.5); window.__lookAt(o.x, o.y); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(SHOTS, 'holdclock.png'), clip: { x: 420, y: 250, width: 500, height: 420 } });

  console.log('\nOther scenarios keep their plain ring');
  const plain = await draw(() => { s.cfg.scenario = 'takeover'; });
  ok('no round counter where holding is not timed', plain.clock.every((c) => c === null) && plain.arcs.length === 0);

  console.log('\npage errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
