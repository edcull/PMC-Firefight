/* A unit wiped out fades and sinks into the ground where it fell: drawn as
   itself — a swarm of bugs as bugs, not a rifle squad in the side's colours. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, shot } = require('../where.js');

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

  let got = null;
  for (let tries = 0; tries < 8 && !(got && got.dead); tries++) {
    got = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const drain = async () => { for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await wait(100); } };
      window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
        armyA: ['cmd2', 'veterans', 'regular'], armyB: window.PMC.rollArmy(3, 1, null, 'bugs') });
      await wait(900); await drain();
      const s = window.PMC_STATE();
      s.terrain.length = 0;
      s.units.forEach((u) => { u.reserve = false; u.aboard = null; u.activated = false; u.bld = null; });
      s.units.filter((u) => u.side === 'A').forEach((u, i) => { u.x = 10; u.y = 10 + i * 6; });
      s.units.filter((u) => u.side === 'B').forEach((u, i) => { u.x = 34 + (i % 3) * 5; u.y = 6 + Math.floor(i / 3) * 6; });
      window.__rebuildScene(); window.__clearSel();
      const b2 = window.__beginButton(); if (b2) b2.click();
      await wait(450); await drain();
      s.activeSide = 'A'; s.initiative = 'A'; s.units.forEach((u) => { u.activated = false; });
      const vets = s.units.find((u) => u.side === 'A' && u.key === 'veterans');
      // a bug squad of one, soft, close in front of the veterans
      const t = s.units.find((u) => u.side === 'B' && u.cls === 'infantry' && u.alive);
      t.x = 16; t.y = 10; t.models = 1; t.def = 1;
      window.__rebuildScene(); window.__clearSel(); window.__select(vets);
      if (!window.__pressAction('fire')) return { none: 'no fire' };
      window.__shootAt(t.id);
      const ghosts = [];
      for (let i = 0; i < 120; i++) {
        window.__fxlive().filter((f) => f.kind === 'ghost').forEach((f) => ghosts.push(f.unit));
        await wait(20);
        if (i > 30 && !window.__busy()) break;
      }
      return { dead: !t.alive, key: t.key, art: t.art, ghosts };
    });
    if (got.none) break;
  }
  ok('a bug squad was wiped out', got && got.dead, got && (got.none || got.key));
  if (got && got.dead) {
    ok('...and faded into the ground', got.ghosts.length > 0);
    ok('...drawn as itself, not a rifle squad', got.ghosts.length > 0 && got.ghosts.every((g) => g && g.key === got.key && g.art === got.art),
      got.ghosts[0] ? got.ghosts[0].key + ' / ' + got.ghosts[0].art : 'none');
  }
  // to look at: the ghost of a bug squad and of a xeno squad, part way down
  await p.evaluate(() => {
    const s = window.PMC_STATE(), bug = s.units.find((u) => u.side === 'B' && u.cls === 'infantry');
    window.__addFx({ kind: 'ghost', x: 24, y: 18, unit: bug, side: bug.side, code: bug.code, models: bug.size, dur: 2000 });
    window.PMC_SETVIEW(24, 18, 2);
  });
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => window.__canvasAt(24, 18));
  await p.screenshot({ path: shot('ghost.png'), clip: { x: c.x - 150, y: c.y - 150, width: 300, height: 200 } });
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
