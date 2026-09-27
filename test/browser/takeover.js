/* Hostile takeover (p. 55) as a player meets it: the defender digs in by hand —
   up to ten trench, wall and wire sections and one bunker, all within 12" of
   the objective — or has the auto button do it; then the attacker's first part
   comes on along the one table edge its first unit chooses. */
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
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  async function fresh() {
    await p.evaluate(() => {
      window.PMC_NEWGAME({
        tier: 3, pl: 1, mode: 'hotseat', planet: 'sparse', scenario: 'takeover', attacker: 'A',
        nameA: 'Ironhold', nameB: 'Kessler', armyA: window.PMC.rollArmy(3, 1), armyB: window.PMC.rollArmy(3, 1)
      });
    });
    await p.waitForTimeout(700);
    for (let i = 0; i < 8; i++) {
      const more = await p.evaluate(() => {
        if (window.PMC_STATE().placeAsk) return false;
        const c = document.getElementById('res-continue'); if (c) { c.click(); return true; }
        const d = document.querySelector('[data-act="swapdone"]'); if (d) { d.click(); return true; }
        return false;
      });
      if (!more) break;
      await p.waitForTimeout(100);
    }
  }
  const forts = () => p.evaluate(() => window.PMC_STATE().terrain.filter(t => ['trench', 'barricade', 'wall', 'wire', 'bunker'].includes(t.kind) && Math.hypot(t.x + t.w / 2 - 24, t.y + t.h / 2 - 24) <= 12)
    .map(t => t.kind));

  console.log('\n  the defender digs in by hand');
  await fresh();
  const ask = await p.evaluate(() => { const pa = window.PMC_STATE().placeAsk; return pa && { kind: pa.kind, side: pa.side, left: pa.left, sections: pa.sections, bunkers: pa.bunkers }; });
  ok('the defender is asked to place its fortifications', !!ask && ask.kind === 'fort' && ask.side === 'B', JSON.stringify(ask));
  ok('...ten sections and a bunker', ask && ask.sections === 10 && ask.bunkers === 1);
  ok('...on a card with an auto-deploy button', await p.evaluate(() => !!document.querySelector('[data-act="placeauto"]')));
  const before = (await forts()).length;
  const far = await p.evaluate(() => { const r = window.__sendIntent({ k: 'placeat', x: 24, y: 40 }); return window.PMC_STATE().placeAsk.left; });
  ok('a piece more than 12" out is refused', far === 11);
  await p.evaluate(() => window.__sendIntent({ k: 'placekind', kind: 'bunker' }));
  // somewhere clear, 7-9" out
  const spot = await p.evaluate(() => {
    const SC = window.PMCScen, s = window.PMC_STATE();
    for (let a = 0; a < 6.3; a += 0.2) for (const r of [7, 8, 9]) {
      const x = 24 + Math.cos(a) * r, y = 24 + Math.sin(a) * r;
      if (!SC.fortWhy(s, SC.fortRect('bunker', x, y))) return { x, y };
    }
    return null;
  });
  await p.evaluate((q) => window.__sendIntent({ k: 'placeat', x: q.x, y: q.y }), spot);
  let st = await p.evaluate(() => { const pa = window.PMC_STATE().placeAsk; return { left: pa.left, bunkers: pa.bunkers, piece: pa.piece }; });
  ok('the bunker goes down, and the tool goes back to sections', st.bunkers === 0 && st.left === 10 && st.piece === 'trench', JSON.stringify(st));
  ok('...and the bunker button is spent', await p.evaluate(() => document.querySelector('[data-act="placekind"][data-kind="bunker"]').disabled));
  await p.evaluate(() => { window.__sendIntent({ k: 'placekind', kind: 'wire' }); window.__sendIntent({ k: 'placelen', len: 5 }); window.__sendIntent({ k: 'placerot' }); });
  const wspot = await p.evaluate(() => {
    const SC = window.PMCScen, s = window.PMC_STATE();
    for (let a = 0; a < 6.3; a += 0.2) {
      const x = 24 + Math.cos(a) * 10, y = 24 + Math.sin(a) * 10;
      if (!SC.fortWhy(s, SC.fortRect('wire', x, y, 5, true))) return { x, y };
    }
    return null;
  });
  await p.evaluate((q) => window.__sendIntent({ k: 'placeat', x: q.x, y: q.y }), wspot);
  const wire = await p.evaluate(() => window.PMC_STATE().terrain.filter(t => t.kind === 'wire').pop());
  ok('a 5" stretch of wire, turned to run up the table', wire && wire.h === 5 && wire.w === 1, JSON.stringify(wire));
  await p.mouse.move(700, 450);
  await p.screenshot({ path: path.join(SHOTS, 'takeover-forts.png') });
  await p.evaluate(() => document.querySelector('[data-act="placeauto"]').click());
  await p.waitForTimeout(300);
  const after = await forts();
  ok('auto-deploy puts down the rest and the placing is over', !(await p.evaluate(() => window.PMC_STATE().placeAsk)) && after.length - before >= 8,
    (after.length - before) + ' pieces: ' + after.join(', '));
  ok('...no more than ten sections and one bunker', after.filter(k => k !== 'bunker').length - before <= 10 + 1 && after.filter(k => k === 'bunker').length <= 1 + before);
  const logged = await p.evaluate(() => window.PMC_STATE().log.some(l => /Hostile takeover: digs in/.test(l.text || l)));
  ok('...and the log says what went up', logged);

  console.log('\n  the attacker chooses one edge');
  const edge = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const bands = () => window.__deployOK ? [[24, 3], [24, 45], [3, 24], [45, 24]].map(q => window.__deployOK(q[0], q[1], 'A')) : [];
    const pre = bands();
    const u = s.units.find(x => x.side === 'A' && !x.reserve && x.x < 0);
    u.x = 3; u.y = 20;
    const post = bands();
    return { pre: pre.join(','), post: post.join(',') };
  });
  ok('before a unit is down, any edge', edge.pre === 'true,true,true,true', edge.pre);
  ok('after, only that edge', edge.post === 'false,false,true,false', edge.post);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(300);
  const lined = await p.evaluate(() => window.PMC_STATE().units.filter(u => u.side === 'A' && u.x >= 0 && !u.aboard).map(u => u.x.toFixed(1) + ',' + u.y.toFixed(1)));
  const on = (f) => lined.every(q => f(+q.split(',')[0], +q.split(',')[1]));
  ok('the whole first part comes on along one edge', lined.length > 0 && (on((x) => x <= 6.5) || on((x) => x >= 41.5) || on((x, y) => y <= 6.5) || on((x, y) => y >= 41.5)), lined.join(' '));

  console.log('\n  a machine defender');
  await p.evaluate(() => {
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'ai', planet: 'sparse', scenario: 'takeover', attacker: 'A',
      nameA: 'Ironhold', nameB: 'Kessler', armyA: window.PMC.rollArmy(3, 1), armyB: window.PMC.rollArmy(3, 1) });
  });
  await p.waitForTimeout(700);
  const ai = await p.evaluate(() => { const s = window.PMC_STATE(); return { ask: !!s.placeAsk, bunker: s.terrain.filter(t => t.kind === 'bunker').length }; });
  ok('lays its own position, and asks the player nothing', !ai.ask && ai.bunker >= 1, JSON.stringify(ai));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
