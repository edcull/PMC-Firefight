/* Preloaded by scripts/test.js into the browser tests (node -r): every page they
   open runs the board's clock PMC_TEST_SPEED times over (game.js PMC_TIME_SCALE),
   so the animations a test waits through are over sooner. A test that sets its own
   PMC_TIME_SCALE keeps it; one that measures real time opts out (test.js REAL_TIME). */
'use strict';
const speed = +process.env.PMC_TEST_SPEED || 1;
if (speed > 1) {
  let pw = null;
  try { pw = require('playwright'); } catch (e) { pw = null; }
  if (pw && pw.chromium && !pw.chromium.__fast) {
    const init = (s) => { if (!window.PMC_TIME_SCALE) window.PMC_TIME_SCALE = s; };
    const launch = pw.chromium.launch.bind(pw.chromium);
    pw.chromium.__fast = true;
    pw.chromium.launch = async function (o) {
      const b = await launch(o);
      const newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
      b.newContext = async function (opts) { const c = await newContext(opts); await c.addInitScript(init, speed); return c; };
      b.newPage = async function (opts) { const p = await newPage(opts); await p.addInitScript(init, speed); return p; };
      return b;
    };
  }
}
