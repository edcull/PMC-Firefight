/* The OpFor thinks its answer out ahead in a worker (src/engine/aiworker.js, net.js
   thinkAhead), and the page gives it with that to hand: served over http, as the
   site is (a page opened from a file can make no worker). The same battle played
   with the worker and without it comes out the same, move for move; with it, the
   page has every play-out of the lookahead handed to it rather than playing them
   out itself; and the battle kept plays back to the same place. */
const { chromium } = require('playwright');
const http = require('http');
const { ROOT, startSkirmish, seedDice } = require('../where.js');
const statics = require('../../server/static.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

async function play(b, url, worker) {
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await seedDice(p, 2670);
  if (!worker) await p.addInitScript(() => { window.PMC_NO_AIWORKER = true; });
  await p.goto(url);
  await p.waitForTimeout(500);
  // each answer the OpFor gave: how long the page took over it, and how much of the lookahead it was handed
  await p.evaluate(() => {
    window.__answers = [];
    const L = window.PMCNet.Local.prototype, give = L.settleAI;
    L.settleAI = function () {
      const owed = this.engine && this.engine.owedAI(), t0 = performance.now(), r = give.apply(this, arguments);
      if (owed) window.__answers.push(Object.assign({ ms: performance.now() - t0 }, window.PMCEngineAI.ahead.hits()));
      return r;
    };
  });
  await startSkirmish(p, { tier: 3, mode: 'ai', scenario: 'meeting', planet: 'desert', terrain: 'auto',
    keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'] });
  await p.waitForTimeout(1200);
  const card = () => p.evaluate(() => !document.getElementById('resolution').hidden);
  const cont = () => p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
  for (let i = 0; i < 12 && await card(); i++) { await cont(); await p.waitForTimeout(150); }
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(400);
  for (let i = 0; i < 12 && await card(); i++) { await cont(); await p.waitForTimeout(150); }
  await p.evaluate(() => window.__startBattle());
  await p.waitForTimeout(800);
  // the player's units move up, one an activation, each to the reachable spot nearest the middle
  // (the same number of moves either way, however busy the machine: the two battles are compared)
  let acts = 0;
  const until = Date.now() + 400000;
  while (Date.now() < until && acts < 8) {
    if (await card()) { await cont(); await p.waitForTimeout(60); continue; }
    const r = await p.evaluate(() => {
      const s = window.PMC_STATE();
      if (s.over) return 'over';
      if (s.endAsk) { window.__sendIntent({ k: 'enddone' }); return null; }
      if (!window.__mySide() || window.__busy() || window.__aiOwed()) return null;
      const u = window.__eligibleUnits()[0];
      if (!u || !window.__select(u) || !window.__pressAction('move')) return null;
      const spots = window.__moveSpots();
      if (!spots.length) { window.__sendIntent({ k: 'action', id: 'skip' }); return 'skip'; }
      const c = spots.reduce((a, q) => (Math.hypot(q.x - 24, q.y - 24) < Math.hypot(a.x - 24, a.y - 24) ? q : a));
      window.__sendIntent({ k: 'move', x: c.x, y: c.y });
      return 'move';
    });
    if (r === 'over') break;
    if (r) acts++;
    await p.waitForTimeout(60);
  }
  await p.waitForFunction(() => !window.__aiOwed(), null, { timeout: 30000 }).catch(() => {});
  const out = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const idx = JSON.parse(localStorage.getItem('pmc-battles') || '[]');
    const book = idx.map(e => JSON.parse(localStorage.getItem('pmc-battle:' + e.id))).filter(Boolean).sort((a, b) => b.at - a.at)[0];
    const copy = (o) => JSON.parse(JSON.stringify(o));
    const resumes = !!book && new window.PMCNet.Local().resume(copy(book));
    return {
      answers: window.__answers, resumes,
      battle: JSON.stringify([s.turn, s.activeSide, s.log.map(l => l.text), s.units.map(u => [u.id, u.x, u.y, u.models, u.sp, u.alive])])
    };
  });
  await p.close();
  return Object.assign(out, { acts, errs });
}

(async () => {
  // the page alone, as a static host serves it: the game server's own routes (/api) are not there
  const serve = statics.create(ROOT);
  const srv = http.createServer((q, r) => { if (!serve(q, r)) { r.writeHead(404); r.end(); } });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });

  console.log('\n  THE ANSWER THOUGHT OUT AHEAD');
  const w = await play(b, url, true), o = await play(b, url, false);
  const sum = (r, k) => r.answers.reduce((a, x) => a + x[k], 0);
  ok('the player moved, and the OpFor answered', w.acts >= 6 && w.answers.length >= 3, w.acts + ' moves, ' + w.answers.length + ' answers');
  // (nearly all of it: see test/unit/serverai.js)
  ok('...with the lookahead handed to the page, not played out on it', sum(w, 'hit') > 0 && sum(w, 'miss') * 10 <= sum(w, 'hit'),
    sum(w, 'hit') + ' play-outs handed over, ' + sum(w, 'miss') + ' played out on the page');
  ok('the same battle without the worker comes out the same, move for move', w.battle === o.battle && o.answers.length === w.answers.length,
    w.answers.length + ' answers either way');
  ok('...where the page plays the lookahead out itself', sum(o, 'hit') === 0);
  console.log('      the page\'s time over the answers: ' + Math.round(sum(w, 'ms')) + ' ms with the worker, ' + Math.round(sum(o, 'ms')) + ' ms without');
  ok('the battle kept plays back to the same place', w.resumes && o.resumes);
  ok('no page errors', !w.errs.length && !o.errs.length, w.errs.concat(o.errs).slice(0, 3).join(' | '));
  await b.close();
  srv.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
