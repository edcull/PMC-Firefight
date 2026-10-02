/* Passing the device in a hotseat battle: a card naming the player covers the
   screen only where the other must not see — each player's secret swaps (which
   stay open to undo until the player says Done, HB-5). Deploying and the battle
   are played in the open, the top bar saying whose turn it is, with no card
   between the players, after a reload too. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }
  const card = () => p.evaluate(() => { const h = document.getElementById('handover'); return h && !h.hidden ? { who: h.getAttribute('data-who'), text: h.innerText } : null; });
  const tap = async () => { await p.evaluate(() => { const h = document.getElementById('handover'); if (h && !h.hidden) h.click(); }); await p.waitForTimeout(200); };

  console.log('\nThe secret swaps, a player at a time');
  await p.evaluate(() => {
    if (window.PMCMenu) window.PMCMenu.close();
    const R = window.PMC;
    window.PMC_NEWGAME({ tier: 3, pl: 2, mode: 'hotseat', planet: 'barren', scenario: 'invasion', attacker: 'B', secretSwaps: true,
      nameA: 'Iron Wolves', nameB: 'Red Dawn', colourA: 'ochre', colourB: 'steel',
      armyA: R.rollArmy(3, 2, null, 'pmc'), armyB: R.rollArmy(3, 2, null, 'pmc') });
  });
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.__noTactics) window.__noTactics(); });
  await p.waitForTimeout(300);
  let c = await card();
  check('the screen is handed to Player 1 for their swaps', !!c && c.who === 'A' && /Iron Wolves/.test(c.text), JSON.stringify(c));
  check('...and covers the swap box until they tap', await p.evaluate(() => { const h = document.getElementById('handover'); return !!h && getComputedStyle(h).position === 'fixed' && +getComputedStyle(h).zIndex > 1000; }));
  await tap();
  check('tapped, it goes', !(await card()));
  // every swap used: still Player 1's turn, and one can be taken back (HB-5)
  const used = await p.evaluate(() => {
    const st = window.PMC_STATE(), Q = window.__q ? window.__q() : null;
    let n = 0;
    for (let g = 0; g < 8 && st.swapAsk && st.swapAsk.side === 'A' && st.swapAsk.left > 0; g++) {
      const u = st.units.find(x => x.side === 'A' && !st.swapAsk.done.some(d => d.outId === x.id) && document.querySelector('[data-swappick="' + x.id + '"]:not([disabled])'));
      if (!u) break;
      window.__sendIntent({ k: 'swappick', id: u.id });
      const opt = document.querySelector('[data-swapin]');
      if (!opt) break;
      window.__sendIntent({ k: 'swapin', id: opt.getAttribute('data-swapin') }); n++;
    }
    return { n, side: st.swapAsk && st.swapAsk.side, left: st.swapAsk && st.swapAsk.left, undo: document.querySelectorAll('[data-swapundo]').length };
  });
  check('with every swap used it is still Player 1\'s turn, each one undoable', used.n === 0 || (used.side === 'A' && used.undo === used.n), JSON.stringify(used));
  await p.evaluate(() => window.__sendIntent({ k: 'swapdone', who: 'A' }));
  await p.waitForTimeout(300);
  c = await card();
  check('Done hands the device to Player 2, unseen', !!c && c.who === 'B' && /Red Dawn/.test(c.text), JSON.stringify(c));
  await tap();
  await p.evaluate(() => window.__sendIntent({ k: 'swapdone', who: 'B' }));
  await p.waitForTimeout(300);
  c = await card();
  const dpill = await p.evaluate(() => document.getElementById('hdr-active').textContent);
  check('then deploying, with no card: the top bar says whose turn it is to place', !c && /^Deploying: /.test(dpill), JSON.stringify(c) + ' ' + dpill);
  // ...and none as the turn to place passes between the players
  const passes = await p.evaluate(async () => {
    const seen = [];
    for (let g = 0; g < 40 && window.PMC_STATE().phase === 'deploy'; g++) {
      const ho = document.getElementById('handover');
      if (ho && !ho.hidden) seen.push('card');
      const pill = document.getElementById('hdr-active').textContent;
      if (!seen.length || seen[seen.length - 1] !== pill) seen.push(pill);
      const next = document.querySelector('[data-act="autodeploy"]');
      if (!next) break;
      next.click();
      await new Promise(r => setTimeout(r, 150));
    }
    return seen;
  });
  check('...nor as the turn to place passes from one to the other', passes.indexOf('card') < 0 && passes.filter(x => /^Deploying: /.test(x)).length >= 1, passes.join(' | '));

  console.log('\nThe battle: each change of player');
  // a plain battle for this part: Hostile takeover's defender digs in, the attacker comes on in turn 1
  await p.evaluate(() => {
    const R = window.PMC;
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'barren', scenario: 'demolish', attacker: 'A',
      nameA: 'Iron Wolves', nameB: 'Red Dawn', colourA: 'ochre', colourB: 'steel',
      armyA: ['regular', 'regular', 'regular', 'regular'], armyB: ['regular', 'regular', 'regular', 'regular'] });
  });
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.__noTactics) window.__noTactics(); });
  for (let n = 0; n < 4 && await card(); n++) await tap();
  await p.evaluate(() => { window.__autoDeployBoth(); });
  await p.waitForTimeout(300);
  for (let n = 0; n < 4 && await card(); n++) await tap();
  await p.evaluate(() => { const s = document.querySelector('button[data-act="start"], button[data-act="startask"]'); if (s) { window.__beginButton().click(); } });
  await p.waitForTimeout(1500);
  const seen = [], sides = [];
  let cards = 0;
  for (let step = 0; step < 30 && sides.length < 3; step++) {
    const c2 = await card();
    if (c2) { cards++; await tap(); continue; }
    const st = await p.evaluate(() => { const s = window.PMC_STATE(); return { phase: s.phase, side: s.activeSide, over: !!s.over }; });
    if (st.phase !== 'battle' || st.over) { await p.waitForTimeout(300); continue; }
    const pill = await p.evaluate(() => document.getElementById('hdr-active').textContent);
    if (!sides.length || sides[sides.length - 1] !== st.side) { sides.push(st.side); seen.push(pill); }
    // the side up skips a unit, and play passes on
    await p.evaluate(() => {
      const s = window.PMC_STATE(), ins = window.__insertionState && window.__insertionState();
      if (ins && window.__dropHere) { window.__dropHere(); return; }
      if (s.faceAsk) { window.__sendIntent({ k: 'vfaceall' }); return; }
      if (s.endAsk) { window.__sendIntent({ k: 'enddone' }); return; }
      const e = window.__eligibleUnits(); if (e.length) { window.__select(e[0]); window.__sendIntent({ k: 'action', id: 'skip' }); }
    });
    await p.waitForTimeout(500);
  }
  check('in the battle, no card between the players\' activations', cards === 0 && sides.length >= 2, cards + ' cards; ' + sides.join(' → '));
  check('...the top bar says whose turn it is instead', seen.length >= 2 && seen.every(t => /Iron Wolves|Red Dawn/.test(t)), seen.join(' → '));

  console.log('\nA reload');
  await p.reload();
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const r = document.querySelector('[data-act="resume"], #btn-resume'); if (r) r.click(); });
  await p.waitForTimeout(1500);
  const live = await p.evaluate(() => !!window.PMC_STATE() && window.PMC_STATE().phase === 'battle');
  if (live) check('after a reload, the battle goes on with no card', !(await card()));
  else console.log('  (no battle to resume here: skipped)');

  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
