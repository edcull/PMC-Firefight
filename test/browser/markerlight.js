/* Markerlights (p. 58) and Smoke Markers (p. 94), driven through the real
   interface, because the whole of the rule is a sequence: the marker acts, one or
   two friendly units are activated out of turn, and they shoot the thing that was
   marked and nothing else. The call then dies. */
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
    await p.waitForTimeout(140);
  }
  await p.waitForTimeout(120);
}

// wait for the board to finish drawing whatever the engine last sent: it takes
// up a selection, or a gun's orders, only once the shot before has landed
async function settle(p) {
  for (let i = 0; i < 60; i++) {
    if (await p.evaluate(() => !window.__busy() && window.__showQueue() === 0)) break;
    await p.waitForTimeout(100);
  }
}

/* A table laid out by hand: a spotter that can see, a mortar that cannot, a rifle
   team that can, and an enemy behind a wood. */
async function stage(p, opts) {
  await p.evaluate((o) => {
    window.PMC_NEWGAME({
      tier: 4, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting',
      nameA: 'Ours', nameB: 'Theirs',
      armyA: o.armyA, armyB: ['regular', 'regular', 'regular', 'regular', 'regular', 'regular']
    });
  }, opts);
  await p.waitForTimeout(800);
  await drain(p);
  const premise = await p.evaluate((o) => {
    const s = window.PMC_STATE();
    /* A wood standing between the north-west corner and the south-east one, so a
       mortar in the corner is firing blind at something a spotter in the south
       can see perfectly well. */
    s.terrain.length = 0;
    s.terrain.push({ kind: 'woods', x: 20, y: 4, w: 8, h: 22 });
    s.units.forEach((u) => { u.reserve = false; u.aboard = null; u.activated = false; });
    const mine = s.units.filter(u => u.side === 'A');
    const theirs = s.units.filter(u => u.side === 'B');
    o.place.forEach((pt, i) => { if (mine[i]) { mine[i].x = pt[0]; mine[i].y = pt[1]; } });
    theirs.forEach((t, i) => { t.x = 34; t.y = i === 0 ? 32 : 4 + i * 3; });
    window.__rebuildScene();
    const spotter = mine[0], quarry = theirs[0];
    const blind = mine.find(u => window.PMC.has(u, 'Indirect Fire'));
    return {
      spotterSees: window.PMC.hasLoS(s, spotter, quarry),
      spotterRange: Math.round(window.PMC.unitDist(spotter, quarry)),
      gunBlind: blind ? !window.PMC.hasLoS(s, blind, quarry) : null,
      gunRange: blind ? Math.round(window.PMC.unitDist(blind, quarry)) : null
    };
  }, opts);
  /* The board only redraws its card when the engine says something has
     changed, and nothing has told it the force was put down by hand — so the
     card still offers only Auto-deploy. Draw it again, and Begin the battle is
     there to press. */
  await p.evaluate(() => window.__clearSel());
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
  return premise;
}

async function pick(p, code) {
  await p.evaluate((c) => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.code === c && x.side === 'A');
    if (u) window.__select(u);
  }, code);
  await p.waitForTimeout(250);
}
async function bar(p) {
  return p.evaluate(() => [...document.querySelectorAll('.slot')]
    .map(b => b.textContent.trim().replace(/^\d/, '') + (b.disabled ? '(off)' : '')).filter(Boolean));
}
async function press(p, label) {
  return p.evaluate((l) => {
    const b = [...document.querySelectorAll('.slot')].find(x => new RegExp(l, 'i').test(x.textContent));
    if (!b || b.disabled) return false;
    b.click(); return true;
  }, label);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  /* ---------------------------------------------- the two actions are separate */
  head('Designate target and Mark the target are two different actions');
  const pre = await stage(p, {
    armyA: ['cmd1', 'mortarteam', 'mortarsection', 'regular', 'veterans', 'hmgteam'],
    place: [[14, 32], [8, 8], [18, 38], [14, 38], [10, 38], [8, 36]]
  });
  ok('the spotter can see the target', pre.spotterSees && pre.spotterRange <= 24,
    pre.spotterRange + '" and in sight');
  ok('...and the mortar behind the wood cannot', pre.gunBlind && pre.gunRange <= 48,
    pre.gunRange + '" and blind');
  await pick(p, 'CM1');
  let slots = await bar(p);
  ok('a Markerlight unit is offered both', slots.some(s => /Designate/.test(s)) &&
    slots.some(s => /Mark$|Mark\(/.test(s) || /^Mark/.test(s)), slots.join(' '));

  /* ------------------------------------------------------------ a designation */
  head('Designate target (p. 58)');
  const des = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.code === 'CM1');
    const t = s.units.filter(x => x.side === 'B')[0];
    window.__select(u);
    window.__pressAction('designate');
    const seen = window.__markState();
    window.__tapUnit(t);                       // first pick
    window.__tapUnit(t);                       // same again: one target, two guns
    const s2 = window.PMC_STATE();
    return {
      offered: seen.targets,
      mark: s2.mark ? { kind: s2.mark.kind, n: s2.mark.targets.length } : null,
      chain: s2.chain ? s2.chain.remaining : 0,
      eligible: window.__eligibleCodes()
    };
  });
  ok('it puts a call on the table', !!des.mark && des.mark.kind === 'designate',
    JSON.stringify(des.mark));
  ok('...and calls up two units out of turn', des.chain === 2, des.chain + ' guns');
  ok('...only Indirect Fire ones',
    des.eligible.length === 2 && des.eligible.every(c => c === 'MRT' || c === 'MRS'),
    des.eligible.join(', ') || 'nobody', true);

  const shot = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const gun = s.units.find(x => x.code === 'MRT');
    const marked = s.mark.targets[0];
    const other = s.units.find(x => x.side === 'B' && x !== marked);
    window.__select(gun);
    window.__pressAction('fire');
    const t = window.__targetCodes();
    return { targets: t, canSeeMarked: window.PMC.hasLoS(s, gun, marked), other: other.code };
  });
  ok('the gun that answers shoots without seeing it', !shot.canSeeMarked,
    'the wood is in the way');
  ok('...and may shoot only what was designated', /MRT|fire/.test(shot.targets) &&
    !new RegExp(shot.other + '/B').test(shot.targets.replace(/^[^:]*:/, '')),
    shot.targets);

  /* --------------------------------------------------------- the call expires */
  for (let i = 0; i < 3; i++) {
    await settle(p);
    await p.evaluate(() => {
      const s = window.PMC_STATE();
      if (!s.mark || !s.chain) return;
      const gun = window.__eligibleCodes()[0];
      const g = s.units.find(x => x.code === gun && x.side === 'A');
      const marked = s.mark.targets[0];
      if (!g) return;
      window.__select(g);
      window.__pressAction('fire');
      window.__tapUnit(marked);
    });
    await p.waitForTimeout(350);
    await drain(p);
  }
  const gone = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return { mark: !!s.mark, chain: !!s.chain, anyMarked: s.units.some(u => u.marked) };
  });
  ok('the call dies with the guns it summoned', !gone.mark && !gone.anyMarked,
    'nothing is left marked for the rest of the turn');

  /* ------------------------------------------------------------- Mark the target */
  head('Mark the target (p. 58)');
  await stage(p, {
    armyA: ['cmd1', 'regular', 'regular', 'veterans', 'hmgteam', 'mortarteam'],
    place: [[14, 32], [18, 38], [14, 38], [10, 38], [8, 36], [8, 8]]
  });
  const mk = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.code === 'CM1');
    const t = s.units.filter(x => x.side === 'B')[0];
    window.__select(u);
    window.__pressAction('marktarget');
    window.__tapUnit(t);
    window.__tapUnit(t);
    const s2 = window.PMC_STATE();
    const shooter = window.__eligibleCodes();
    return {
      kind: s2.mark ? s2.mark.kind : null,
      eligible: shooter,
      bonus: (function () {
        const g = s2.units.find(x => x.code === shooter[0] && x.side === 'A');
        if (!g) return null;
        const withCall = window.PMC.shotOdds(s2, g, s2.mark.targets[0], 'fire', {}).mods;
        const keep = s2.mark; s2.mark = null;
        const without = window.PMC.shotOdds(s2, g, keep.targets[0], 'fire', {}).mods;
        s2.mark = keep;
        return withCall - without;
      })()
    };
  });
  ok('it puts a Mark call on the table', mk.kind === 'mark', String(mk.kind));
  ok('...and never calls an Indirect Fire unit', !mk.eligible.includes('MRT'),
    mk.eligible.join(', ') || 'nobody');
  ok('...and the unit it calls fires as though at half range', mk.bonus === 2,
    '+' + mk.bonus);

  /* ------------------------------------------------------- moving costs a gun */
  head('Move and mark, or stand still and call two (p. 58)');
  const moved = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.code === 'CM1');
    const t = s.units.filter(x => x.side === 'B')[0];
    s.units.forEach(x => { x.activated = false; });
    s.chain = null; s.mark = null;
    window.__select(u);
    window.__pressAction('designate');
    const spots = window.__markState().moves;
    u.markMoved = true;                      // as though the player had walked it
    window.__tapUnit(t);
    const s2 = window.PMC_STATE();
    return { spots: spots, chain: s2.chain ? s2.chain.remaining : 0 };
  });
  ok('the marker is offered ground to move onto first', moved.spots > 0,
    moved.spots + ' squares within its Movement');
  ok('...and having moved, it calls one gun instead of two', moved.chain === 1,
    moved.chain + ' gun');

  /* ---------------------------------------------------------- Smoke Markers */
  head('Smoke Markers (p. 94)');
  await stage(p, {
    armyA: ['rhellriders', 'rmedart', 'rlightart', 'rmilitia', 'rinsurgents', 'rlmg'],
    place: [[26, 32], [8, 8], [18, 38], [14, 38], [10, 38], [8, 36]]
  });
  const smoke = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => window.PMC.has(x, 'Smoke Markers') && x.side === 'A');
    if (!u) return { why: 'no unit with Smoke Markers in the list' };
    const got = window.__select(u);
    if (!got) return { why: 'could not select ' + u.code + ' (activated ' + u.activated +
      ', side ' + u.side + ', active ' + s.activeSide + ', status ' + window.PMC.status(u) + ')' };
    const slots = [...document.querySelectorAll('.slot')].map(b => b.textContent.trim());
    const t = s.units.filter(x => x.side === 'B')[0];
    window.__pressAction('designate');
    const reach = window.__markState().reach;
    u.markMoved = true;                      // Smoke Markers do not care
    window.__tapUnit(t);
    const s2 = window.PMC_STATE();
    return {
      slots: slots.join(' '),
      kind: s2.mark ? s2.mark.kind : null,
      reach: reach,
      chain: s2.chain ? s2.chain.remaining : 0
    };
  });
  ok('a rebel flare designates and nothing else', smoke.kind === 'designate' &&
    !/\bMark\b/.test(smoke.slots), smoke.why || String(smoke.kind));
  ok('...out to 12", not 24"', smoke.reach === 12, smoke.reach + '"');
  ok('...and calls two guns even on the move', smoke.chain === 2, smoke.chain + ' guns');

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
