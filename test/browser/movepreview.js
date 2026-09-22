/* Moving and advancing now ask before they commit: tapping ground puts a ghost of
   the unit there and shows what the move would mean, and only a second tap — or the
   button — actually spends the activation. This drives that through the interface. */
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
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(130);
  }
  await p.waitForTimeout(120);
}

/* A table with a wood to hide in, an open patch to be caught in, and an enemy
   rifle line across the way. */
async function stage(p) {
  await p.evaluate(() => {
    window.PMC_NEWGAME({
      tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting',
      nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'lcv'],
      armyB: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'lcv']
    });
  });
  await p.waitForTimeout(900);
  await drain(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.terrain.push({ kind: 'woods', x: 16, y: 16, w: 6, h: 6 });
    s.units.forEach(u => { u.reserve = false; u.aboard = null; u.activated = false; });
    const mine = s.units.filter(u => u.side === 'A');
    const theirs = s.units.filter(u => u.side === 'B');
    mine.forEach((u, i) => { u.x = 12; u.y = 14 + i * 3; });
    theirs.forEach((t, i) => { t.x = 34; t.y = 14 + i * 3; });
    window.__rebuildScene();
    window.__clearSel();                 // and redraw, so the Begin button appears
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
  });
  await p.waitForTimeout(500);
  await drain(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A'; s.initiative = 'A';
    s.units.forEach(u => { u.activated = false; });
    window.__clearSel();
  });
  await p.waitForTimeout(150);
}

async function begin(p, code, action) {
  return p.evaluate(([c, a]) => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.side === 'A' && x.code === c);
    window.__select(u);
    const on = window.__pressAction(a);
    return { on: on, spots: window.__moveSpots().length, at: { x: u.x, y: u.y } };
  }, [code, action]);
}
// the reachable square nearest a point, so the test can aim
async function aim(p, x, y) {
  return p.evaluate(([tx, ty]) => {
    const ms = window.__moveSpots();
    let best = null, bd = Infinity;
    ms.forEach(m => {
      const d = Math.hypot(m.x - tx, m.y - ty);
      if (d < bd) { bd = d; best = m; }
    });
    return best;
  }, [x, y]);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  await stage(p);

  /* ---------------------------------------------------- nothing happens at once */
  head('A move is proposed before it is made');
  const opened = await begin(p, 'RIF', 'move');
  ok('Move offers ground to walk to', opened.on && opened.spots > 0, opened.spots + ' squares');
  const woods = await aim(p, 18, 18);
  const first = await p.evaluate((spot) => {
    const u = window.__sel();
    const was = { x: u.x, y: u.y, activated: u.activated };
    window.__tapMove(spot);
    const now = window.__sel();
    return {
      preview: window.__previewState(),
      stayedPut: now && now.x === was.x && now.y === was.y,
      stillToAct: now && !now.activated
    };
  }, woods);
  ok('tapping the ground opens a preview', !!first.preview, first.preview
    ? first.preview.dist + '" into ' + first.preview.terrain : 'nothing opened');
  ok('...and the unit has not moved', first.stayedPut);
  ok('...nor spent its activation', first.stillToAct);
  ok('...the card says what ground it would end in',
    /Woods/i.test(first.preview.terrain) && first.preview.cover === 2,
    first.preview.terrain + ', +' + first.preview.cover + ' Defence');
  ok('...and the card asks for a decision',
    /Move here/.test(first.preview.card) && /Pick another spot/.test(first.preview.card));

  /* ------------------------------------------------------- what it would see */
  head('What the ghost can see, and who can see it');
  ok('the preview counts what it would see from there',
    first.preview.sees.length > 0, first.preview.sees.join(' ') || 'nothing');
  ok('...and who would have it in their sights',
    Array.isArray(first.preview.watchers),
    first.preview.watchers.length + ' enemy guns bear on it');
  const cover = await p.evaluate(() => {
    const pv = window.__previewState();
    const u = window.__sel();
    const st = window.PMC_STATE();
    // the same question the engine will be asked once the unit is really there
    const ghost = Object.assign({}, u, { x: pv.at.x, y: pv.at.y });
    return {
      seen: st.units.filter(o => o.side === 'B' && o.alive && window.PMC.hasLoS(st, ghost, o)).map(o => o.code),
      said: pv.sees
    };
  });
  ok('...and it agrees with the engine', cover.seen.join(' ') === cover.said.join(' '),
    cover.said.join(' ') + ' against ' + cover.seen.join(' '));

  /* ------------------------------------------------------ moving the proposal */
  head('Changing your mind');
  const open2 = await aim(p, 10, 24);
  const moved = await p.evaluate((spot) => {
    window.__tapMove(spot);
    return window.__previewState();
  }, open2);
  ok('tapping different ground moves the ghost', moved && moved.at.y !== first.preview.at.y,
    moved.at.x + ',' + moved.at.y + ' — ' + moved.terrain);
  const cancelled = await p.evaluate(() => {
    window.__previewCancel();
    const u = window.__sel();
    return { preview: window.__previewState(), still: !!u && !u.activated, spots: window.__moveSpots().length };
  });
  ok('cancelling drops the proposal', !cancelled.preview);
  ok('...and leaves the unit where it was, still to act', cancelled.still);
  ok('...with the ground still offered', cancelled.spots > 0, cancelled.spots + ' squares');

  /* -------------------------------------------------------------- confirming */
  head('Confirming');
  const target = await aim(p, 18, 18);
  const done = await p.evaluate((spot) => {
    const before = window.__sel();
    const id = before.id;
    window.__tapMove(spot);
    window.__tapMove(spot);                 // the second tap on the same ground
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.id === id);
    return {
      preview: window.__previewState(),
      at: { x: Math.round(u.x * 10) / 10, y: Math.round(u.y * 10) / 10 },
      want: { x: Math.round(spot.x * 10) / 10, y: Math.round(spot.y * 10) / 10 },
      activated: u.activated,
      line: (s.log.filter(l => l.t === 'move').slice(-1)[0] || {}).text
    };
  }, target);
  ok('a second tap on the same ground makes the move',
    done.at.x === done.want.x && done.at.y === done.want.y,
    done.line || 'no move logged');
  ok('...spends the activation', done.activated);
  ok('...and clears the proposal', !done.preview);

  /* ------------------------------------------------------- Advance shows guns */
  head('Advancing shows what it could shoot');
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A';
    s.units.forEach(u => { u.activated = false; });
    /* Open ground and the enemy within a short walk, so the advance has somewhere
       to go and something to shoot when it gets there. */
    s.terrain.length = 0;
    s.units.filter(u => u.side === 'A').forEach((u, i) => { u.x = 12; u.y = 30 + i * 2; });
    s.units.filter(u => u.side === 'B').forEach((t, i) => { t.x = 26; t.y = 30 + i * 2; });
    window.__rebuildScene();
    window.__clearSel();
  });
  await p.waitForTimeout(200);
  const adv = await begin(p, 'VET', 'advance');
  ok('Advance offers ground too', adv.on && adv.spots > 0, adv.spots + ' squares');
  const near = await aim(p, 18, 32);
  const shots = await p.evaluate((spot) => {
    window.__tapMove(spot);
    return window.__previewState();
  }, near);
  ok('the preview lists what it could shoot from there', shots && shots.advance &&
    shots.shots.length > 0, (shots.shots || []).join(' ') || 'nothing in range');
  ok('...and says so on the card', /Can shoot/.test(shots.card), 'the card has a "Can shoot" cell');
  ok('...and it agrees with the engine', await p.evaluate(() => {
    const pv = window.__previewState();
    const u = window.__sel();
    const st = window.PMC_STATE();
    const ghost = Object.assign({}, u, { x: pv.at.x, y: pv.at.y });
    const real = st.units.filter(o => o.side === 'B' && o.alive &&
      window.PMC.canShoot(st, ghost, o, 'fire', {})).map(o => o.code);
    return real.join(' ') === pv.shots.join(' ');
  }), shots.shots.join(' '));
  const advDone = await p.evaluate(() => {
    const id = window.__sel().id;
    window.__previewConfirm();
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.id === id);
    return { mode: window.__markState().mode, targets: window.__targetCodes(), moved: u.x, activated: u.activated };
  });
  ok('confirming an Advance moves, then offers the shot',
    advDone.mode === 'advance-fire' || /advance-fire/.test(advDone.targets),
    advDone.targets);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
