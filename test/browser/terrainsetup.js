/* Terrain set-up by hand (pp. 46-47): the four areas taken in turn, the D6
   rolled for each, the pieces tapped down inside it, and the table edges
   rolled only once the table is set. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }
async function drain(p) {
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden || !!window.__resOpen());
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(100);
  }
}
async function newGame(p, cfg) {
  await p.evaluate((c) => window.PMC_NEWGAME(c), Object.assign({
    tier: 3, pl: 1, mode: 'ai', planet: 'dense', scenario: 'secure', terrainSetup: 'manual',
    nameA: 'Ours', nameB: 'Theirs',
    armyA: ['cmd3', 'regular', 'veterans', 'hmgteam'],
    armyB: ['cmd3', 'regular', 'veterans', 'hmgteam']
  }, cfg || {}));
  await p.waitForTimeout(400);
  await drain(p);
}
function overlaps(ts) {
  let bad = 0;
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const a = ts[i], b = ts[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad++;
  }
  return bad;
}
/* Play the human areas by hand: choose the first option, tap near the middle
   and around it until the result is spent. */
async function playAreas(p, record) {
  for (let guard = 0; guard < 80; guard++) {
    await drain(p);
    const t = await p.evaluate(() => window.__tset());
    if (!t || t.phase !== 'terrain') return;
    const a = t.area;
    if (a.alt === null) {
      record.choice = await p.evaluate(() => { const b = document.querySelector('[data-act="talt"]'); if (b) { b.click(); return true; } return false; });
      continue;
    }
    const spots = [[.5, .5], [.25, .25], [.75, .75], [.25, .75], [.75, .25], [.5, .2], [.5, .8], [.2, .5], [.8, .5]];
    const q = spots[guard % spots.length];
    const before = await p.evaluate(() => window.PMC_STATE().terrain.length);
    await p.evaluate(([x, y]) => window.__boardTapAt(x, y), [a.x + a.w * q[0], a.y + a.h * q[1]]);
    // the piece this tap put down (the OpFor may lay a whole area straight after it)
    const after = await p.evaluate((k) => window.PMC_STATE().terrain[k], before);
    const n = await p.evaluate(() => window.PMC_STATE().terrain.length);
    if (n > before) {
      record.taps++;
      if (!(after.x >= a.x - 1e-6 && after.y >= a.y - 1e-6 && after.x + after.w <= a.x + a.w + 1e-6 && after.y + after.h <= a.y + a.h + 1e-6)) { record.outside++; record.why = JSON.stringify({ a, p: [after.x, after.y, after.w, after.h, after.kind], before, n }); }
    }
    // once a piece or two is down, move on the way a player would
    const t2 = await p.evaluate(() => window.__tset());
    if (t2 && t2.phase === 'terrain' && t2.area && t2.area.name === a.name && t2.area.alt !== null) {
      const c = t2.area.count[t2.area.spec] || 0;
      if (c >= 2) await p.evaluate(() => { const b = document.querySelector('[data-act="tnext"]'); if (b) b.click(); });
    }
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  head('Against the OpFor');
  await newGame(p, {});
  const t0 = await p.evaluate(() => window.__tset());
  ok('a manual set-up opens on the terrain phase', t0 && t0.phase === 'terrain');
  ok('...with the table empty to begin with', await p.evaluate(() => window.PMC_STATE().terrain.length) === (await p.evaluate(() => window.PMC_STATE().tset.areas.slice(0, window.PMC_STATE().tset.i).reduce((n, a) => n + a.placed.length, 0))));
  ok('four 2′ × 2′ areas', t0.sides.length === 4);
  ok('...taken in turn, starting from a random player', t0.sides.join('') === (t0.starter === 'A' ? 'ABAB' : 'BABA'), t0.sides.join(''));
  ok('the OpFor has laid its own area before it is our turn', t0.area && t0.area.side === 'A', t0.area && t0.area.name);
  const card = await p.evaluate(() => document.getElementById('context').innerText);
  ok('the card names the area and the roll', /Terrain set-up/.test(card) && new RegExp(t0.area.name + ' —').test(card) && /roll/.test(card));
  ok('the header says so', /Terrain set-up/.test(await p.evaluate(() => document.getElementById('hdr-phase').textContent)));
  const rec = { taps: 0, outside: 0 };
  // the snapshot the table edges will turn
  await playAreas(p, rec);
  ok('pieces go down where they are tapped', rec.taps >= 1, rec.taps + ' placed by tap');
  ok('...and every one lands inside its own area', rec.outside === 0, rec.why);
  const after = await p.evaluate(() => ({ phase: window.PMC_STATE().phase, edges: window.PMC_STATE().edges, terrain: window.PMC_STATE().terrain.map(t => ({ x: t.x, y: t.y, w: t.w, h: t.h, kind: t.kind })) }));
  ok('once all four are set, deployment begins', after.phase === 'deploy');
  ok('...and the table edges are rolled', !!after.edges && ['west', 'north', 'east', 'south'].indexOf(after.edges.A) >= 0, after.edges && after.edges.A + ' / ' + after.edges.B);
  ok('...opposite each other', after.edges && ({ west: 'east', east: 'west', north: 'south', south: 'north' })[after.edges.A] === after.edges.B);
  ok('the turned table is still on the table', after.terrain.every(t => t.x >= 0 && t.y >= 0 && t.x + t.w <= 48.01 && t.y + t.h <= 48.01));
  const natural = after.terrain.filter(t => t.kind !== 'objective' && t.kind !== 'searchsite');
  ok('no two pieces overlap', overlaps(natural) === 0, overlaps(natural) + ' overlaps');
  ok('the objectives are placed on the laid table', await p.evaluate(() => window.PMC_STATE().objectives.length === 3));
  await p.evaluate(() => window.__autoDeployBoth());
  await p.evaluate(() => { const b = document.querySelector('button[data-act="start"]'); if (b) b.click(); });
  await p.waitForTimeout(400); await drain(p);
  ok('and the battle starts on it', await p.evaluate(() => window.PMC_STATE().phase === 'battle'));

  head('A result with a choice, and a crowded area');
  let chose = false, tries = 0;
  while (!chose && tries++ < 25) {
    await newGame(p, { planet: 'barren' });
    const t = await p.evaluate(() => window.__tset());
    if (t && t.area && t.area.alts > 1) {
      ok('a choice waits for the player before anything is placed', t.area.alt === null && !t.ghost);
      const btns = await p.evaluate(() => [...document.querySelectorAll('[data-act="talt"]')].map(b => b.innerText));
      ok('...one button for each option', btns.length === t.area.alts, btns.join(' | '));
      await p.evaluate(() => document.querySelectorAll('[data-act="talt"]')[1].click());
      const t2 = await p.evaluate(() => window.__tset());
      ok('...and choosing readies the first piece', t2.area.alt === 1 && !!t2.ghost, t2.ghost && t2.ghost.kind);
      chose = true;
    }
  }
  ok('(found a result with a choice)', chose, tries + ' tables');
  // tapping the same spot over and over: the piece still fits somewhere near, or shrinks
  let crowd = null;
  for (let k = 0; k < 20 && !crowd; k++) {
    await newGame(p, { planet: 'industrial' });
    for (let g = 0; g < 10; g++) {
      const t = await p.evaluate(() => window.__tset());
      if (!t || t.phase !== 'terrain') break;
      if (t.area.alt === null) { await p.evaluate(() => document.querySelector('[data-act="talt"]').click()); continue; }
      const spec = await p.evaluate(() => { const s = window.PMC_STATE(); const a = s.tset.areas[s.tset.i]; return a.row.alts[a.alt][a.spec]; });
      if (spec.max >= 4) {
        const a = t.area, n0 = await p.evaluate(() => window.PMC_STATE().terrain.length);
        for (let j = 0; j < 6; j++) await p.evaluate(([x, y]) => window.__boardTapAt(x, y), [a.x + a.w / 2, a.y + a.h / 2]);
        const n1 = await p.evaluate(() => window.PMC_STATE().terrain.length);
        const ts = await p.evaluate(() => window.PMC_STATE().terrain.map(t => ({ x: t.x, y: t.y, w: t.w, h: t.h })));
        crowd = { placed: n1 - n0, overlaps: overlaps(ts) };
        break;
      }
      await p.evaluate(() => window.__terrainAct('tauto'));
      await drain(p);
    }
  }
  ok('tapping one spot again and again fits each piece in beside the last', crowd && crowd.placed >= 3 && crowd.overlaps === 0, JSON.stringify(crowd));

  head('Auto-place');
  await newGame(p, { scenario: 'takeover' });
  await p.evaluate(() => window.__terrainAct('tauto'));
  await drain(p);
  const ta = await p.evaluate(() => window.__tset());
  ok('one area can be handed to the generator', ta.phase === 'deploy' || ta.i >= 2, 'now at area ' + (ta.i + 1));
  if (ta.phase === 'terrain') await p.evaluate(() => window.__terrainAct('tautoall'));
  await drain(p);
  const tb = await p.evaluate(() => ({ phase: window.PMC_STATE().phase, edges: window.PMC_STATE().edges || null, n: window.PMC_STATE().terrain.length }));
  ok('...and so can the rest of the table', tb.phase === 'deploy' && tb.n > 3, tb.n + ' pieces');
  ok('Hostile takeover has no table edges to roll', !tb.edges);

  head('Hotseat');
  await newGame(p, { mode: 'hotseat' });
  const th = await p.evaluate(() => window.__tset());
  ok('in hotseat both players lay their own areas', th.area && th.i === 0 && th.area.side === th.starter, th.sides.join(''));
  await newGame(p, { mode: 'hotseat', scenario: 'meeting' });
  await p.evaluate(() => window.__terrainAct('tautoall'));
  await drain(p);
  ok('Meeting engagement rolls its edges after the terrain', !!(await p.evaluate(() => window.PMC_STATE().edges)));

  head('Solitaire');
  await newGame(p, { scenario: 's_crush', solo: { coop: false, faction: 'pmc', opFaction: 'pmc', names: ['Solo'] } });
  const ts = await p.evaluate(() => window.__tset());
  ok('in a solitaire game the player lays all four areas', ts && ts.sides.join('') === 'AAAA', ts && ts.sides.join(''));
  await p.evaluate(() => window.__terrainAct('tautoall'));
  await drain(p);
  ok('...and the scenario takes over once they are laid', await p.evaluate(() => window.PMC_STATE().phase === 'deploy' && !window.PMC_STATE().edges));

  head('Generated, as before');
  await newGame(p, { terrainSetup: 'auto' });
  const tg = await p.evaluate(() => ({ phase: window.PMC_STATE().phase, n: window.PMC_STATE().terrain.length, edges: window.PMC_STATE().edges || null }));
  ok('the automatic set-up goes straight to deployment', tg.phase === 'deploy' && tg.n > 0 && !tg.edges);
  await newGame(p, { mode: 'demo', terrainSetup: 'manual' });
  ok('a demo always generates its table', await p.evaluate(() => window.PMC_STATE().phase !== 'terrain'));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
