/* The turn's last shot, and then the Rally phase: the target's Suppression bar
   climbs as the rounds land, to what the shot gave it, and only comes down for
   the rally once the phase begins (the pause, `settle`) — never as if the shot
   itself had taken Suppression off. */
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

  // tried until a volley puts Suppression on the target and the Rally phase then takes some off
  let got = null;
  for (let tries = 0; tries < 8 && !(got && got.rallied); tries++) {
    got = await p.evaluate(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const drain = async () => { for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await wait(100); } };
      window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
        armyA: ['cmd2', 'veterans', 'regular'], armyB: ['cmd2', 'regular', 'regular'] });
      await wait(900); await drain();
      const s = window.PMC_STATE();
      s.terrain.length = 0;
      s.units.forEach(u => { u.reserve = false; u.aboard = null; u.activated = false; });
      s.units.filter(u => u.side === 'A').forEach((u, i) => { u.x = 10; u.y = 10 + i * 6; });
      s.units.filter(u => u.side === 'B').forEach((t, i) => { t.x = 22; t.y = 10 + i * 6; });
      window.__rebuildScene(); window.__clearSel();
      const b2 = window.__beginButton(); if (b2) b2.click();
      await wait(450); await drain();
      // the veterans' shot is the last activation of the turn: everyone else has acted
      const vets = s.units.find(u => u.side === 'A' && u.key === 'veterans');
      s.activeSide = 'A'; s.initiative = 'A';
      s.units.forEach(u => { u.activated = u !== vets; });
      window.__clearSel(); window.__select(vets);
      if (!window.__pressAction('fire')) return { none: 'no fire' };
      const e = s.units.find(x => x.side === 'B' && x.alive && x.key === 'regular' && window.PMC.canShoot(s, vets, x, 'fire', {}));
      if (!e) return { none: 'nothing in sight' };
      const before = window.__shownSp(e.id);
      window.__traceShow = [];
      window.__shootAt(e.id);
      const samples = [];
      for (let i = 0; i < 600; i++) {
        samples.push({ sp: window.__shownSp(e.id), settled: window.__traceShow.some(t => t.e === 'settle') });
        await wait(15);
        if (i > 40 && !window.__busy() && !window.__showQueue() && samples[samples.length - 1].settled) break;
        if (!document.getElementById('resolution').hidden) document.getElementById('res-continue').click();
      }
      await wait(400);
      const pre = samples.filter(x => !x.settled).map(x => x.sp), post = samples.filter(x => x.settled).map(x => x.sp);
      const peak = pre.length ? Math.max.apply(null, pre) : before;
      return { before, peak, low: pre.length ? Math.min.apply(null, pre) : before, end: e.alive ? e.sp : null, shown: window.__shownSp(e.id),
        alive: e.alive, rallied: e.alive && e.sp < peak && post.length > 0, settledSeen: post.length > 0 };
    });
    if (got.none) break;
  }
  ok('the shot put Suppression on the target and the Rally phase took some off', got && got.rallied, JSON.stringify(got));
  if (got && got.rallied) {
    ok('...while the shot played, its bar never went below what it had', got.low >= got.before, got.low + ' (had ' + got.before + ')');
    ok('...it climbed to what the shot gave it', got.peak > got.before, got.before + ' → ' + got.peak);
    ok('...and came down for the rally only once the phase began, to what the rules say', got.shown === got.end, got.peak + ' → ' + got.shown);
  }
  ok('no page errors', !errs.length, errs.join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
