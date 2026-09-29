/* Regrouping looks the same wherever it happens: the Regroup action's card is
   the End phase's rally card (the dice, what they cleared, and what that left),
   and the unit is seen to regroup on the table — its men closing up, the
   Suppression it shook off lifting away — in the action and at the Rally. */
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

  const got = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const drain = async () => { for (let i = 0; i < 20 && !document.getElementById('resolution').hidden; i++) { document.getElementById('res-continue').click(); await wait(100); } };
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'meeting', nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd2', 'regular', 'regular', 'veterans'], armyB: ['cmd2', 'regular', 'regular', 'regular'] });
    await wait(900); await drain();
    const s = window.PMC_STATE();
    s.terrain.length = 0;
    s.units.forEach((u) => { u.reserve = false; u.aboard = null; u.activated = false; u.bld = null; });
    s.units.filter((u) => u.side === 'A').forEach((u, i) => { u.x = 8; u.y = 6 + i * 6; });
    s.units.filter((u) => u.side === 'B').forEach((u, i) => { u.x = 40; u.y = 6 + i * 6; });
    window.__rebuildScene(); window.__clearSel();
    const b2 = window.__beginButton(); if (b2) b2.click();
    await wait(450); await drain();
    s.activeSide = 'A'; s.units.forEach((u) => { u.activated = false; });
    const u = s.units.find((x) => x.side === 'A' && x.key === 'regular');
    u.sp = u.morale + 1;
    // the Regroup action
    window.__clearSel(); window.__select(u);
    const pressed = window.__pressAction('regroup');
    const seen = new Set();
    let card = null;
    for (let i = 0; i < 60; i++) {
      window.__fxkinds().forEach((k) => seen.add(k));
      // the card as the feed of combat results shows it
      const rc = [...document.querySelectorAll('.feedcard')].find((c) => /regroup/i.test((c.querySelector('.res-kind') || {}).textContent || ''));
      if (rc && !card) card = { kind: (rc.querySelector('.res-kind') || {}).textContent, dice: rc.querySelectorAll('.dice .die').length, calc: rc.textContent };
      await wait(30);
    }
    const action = { pressed, fx: [...seen], card, morale: window.PMC.currentMorale(u) };
    await drain();
    // the End phase: everyone has acted, and one unit of ours carries Suppression into the Rally
    const v = s.units.find((x) => x.side === 'A' && x.key === 'veterans');
    v.sp = v.morale + 1;
    // the side whose go it is has one unit left to act, and nobody else has any
    for (let i = 0; i < 100 && (window.__busy() || window.__showQueue()); i++) { await drain(); await wait(50); }
    await drain();
    s.activeSide = 'A';
    const last = s.units.find((x) => x.side === 'A' && x.alive && x !== v && x !== u && !x.command);
    s.units.forEach((x) => { x.activated = x !== last; });
    last.sp = 1;                                  // Regroup is only on offer with something to shake off
    window.__clearSel();
    window.__select(last); window.__pressAction('regroup');
    const seen2 = new Set();
    let rallyCard = null;
    for (let i = 0; i < 250; i++) {
      if (rallyCard) window.__fxkinds().forEach((k) => seen2.add(k));
      const rc = [...document.querySelectorAll('.feedcard')].find((c) => /rally/i.test((c.querySelector('.res-kind') || {}).textContent || ''));
      if (rc && !rallyCard) rallyCard = { dice: rc.querySelectorAll('.dice .die').length, title: (rc.querySelector('h3') || {}).textContent };
      const modal = document.querySelector('#resolution:not([hidden])');
      if (modal) document.getElementById('res-continue').click();
      if (rallyCard && seen2.has('regroup')) break;
      await wait(40);
    }
    return { action, end: { fx: [...seen2], rallyCard, phase: s.phase, turn: s.turn, feed: [...document.querySelectorAll('.feedcard .res-kind')].slice(0, 6).map((q) => q.textContent) } };
  });
  console.log('\nThe Regroup action');
  ok('pressed', got.action.pressed);
  ok('its card is the rally card, under Regroup', got.action.card && got.action.card.kind === 'Regroup', got.action.card && got.action.card.kind);
  ok('...with the dice rolled, one a point of Morale', got.action.card && got.action.card.dice === got.action.morale,
    got.action.card && got.action.card.dice + ' dice, Morale ' + got.action.morale);
  ok('...and the Suppression they left', got.action.card && /Suppression \d+ SP · \d+ success/.test(got.action.card.calc));
  ok('the unit is seen to regroup', got.action.fx.includes('regroup'), got.action.fx.join(' '));
  console.log('\nThe Rally in the End phase');
  ok('the rally card, as before', !!got.end.rallyCard && got.end.rallyCard.dice > 0, JSON.stringify(got.end.rallyCard || got.end.feed));
  ok('...and the unit seen to regroup there too', got.end.fx.includes('regroup'), got.end.fx.join(' '));

  // to look at: the effect, part way through
  await p.evaluate(() => {
    const s = window.PMC_STATE(), u = s.units.find((x) => x.side === 'A' && x.alive && x.x >= 0);
    window.__addFx({ kind: 'regroup', x: u.x, y: u.y, n: 4, dur: 1400 });
    window.PMC_SETVIEW(u.x, u.y, 2); window.__regroupAt = u;
  });
  const c = await p.evaluate(() => window.__canvasAt(window.__regroupAt.x, window.__regroupAt.y));
  await p.waitForTimeout(450);
  await p.screenshot({ path: shot('regroup.png'), clip: { x: c.x - 150, y: c.y - 170, width: 300, height: 230 } });

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
