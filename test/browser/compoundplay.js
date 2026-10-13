/* Close Encounters (Appendix 1) in the browser: the option on the battlefield
   step brings its scenarios into the list, and a Clearing out battle is fought
   in a compound drawn as one — floors, bulkheads and doors — with the vehicles
   left outside, played on by two AIs without a page error; and Besieged, the
   solitaire rescue, offered with the option and played in a demo. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);

  console.log('\nThe scenario list');
  await p.evaluate(() => { try { localStorage.removeItem('pmc-options'); } catch (e) { } window.PMC_SKIRMISH('ai'); });
  await p.waitForTimeout(250);
  const scens = () => p.evaluate(() => Array.from(document.querySelectorAll('#sel-scen option')).map((o) => o.value));
  const tick = (on) => p.evaluate((on) => {
    const i = document.querySelector('#opt-boxes input[data-opt="closeEncounters"]');
    i.checked = on; i.dispatchEvent(new Event('change', { bubbles: true }));
  }, on);
  let list = await scens();
  ok('with the option off, only the six', !list.some((v) => /^ce_/.test(v)), list.join());
  await tick(true);
  list = await scens();
  const group = await p.evaluate(() => { const g = document.querySelector('#sel-scen optgroup[data-ce]'); return g ? g.label : null; });
  ok('ticked, Clearing out and Critical control join them, in a group', list.indexOf('ce_clear') >= 0 && list.indexOf('ce_control') >= 0 && /Close Encounters/.test(group || ''), group);
  const solo = await p.evaluate(() => Array.from(document.querySelectorAll('#sel-solo-scen option')).map((o) => o.value));
  ok('...and Besieged among the solitaire scenarios', solo.indexOf('s_besieged') >= 0, solo.join());
  await p.evaluate(() => { const s = document.getElementById('sel-scen'); s.value = 'ce_control'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  const kit = await p.evaluate(() => {
    const f = document.getElementById('kit-field');
    return { shown: !f.hidden, rows: f.querySelectorAll('[data-kit-side]').length, picks: f.querySelectorAll('select[data-kit]').length,
      satchel: (f.querySelector('select[data-kit="satchel"]') || {}).value, pl: document.getElementById('sel-pl').value };
  });
  ok('a compound scenario: the special equipment to choose, the standard set (one of each a Priority Level) to start', kit.shown && kit.rows === 1 && kit.picks === 5 && kit.satchel === kit.pl, JSON.stringify(kit));

  console.log('\nA compound laid out by hand');
  // (the menu closes when a skirmish is picked from it; called directly, it is still up)
  await p.evaluate(() => { const m = document.getElementById('menu'); if (m) m.hidden = true; try { localStorage.removeItem('pmc-compound-48x48'); localStorage.removeItem('pmc-compound-mode'); } catch (e) { } });
  let cf = await p.evaluate(() => ({ shown: !document.getElementById('compound-field').hidden, btn: !document.getElementById('btn-compound').hidden, note: document.getElementById('compound-note').textContent }));
  ok('with a compound scenario, the compound is the game\'s to lay out unless asked', cf.shown && !cf.btn && /fresh compound/.test(cf.note), JSON.stringify(cf));
  await p.evaluate(() => { const s = document.getElementById('sel-compound'); s.value = 'hand'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  cf = await p.evaluate(() => ({ btn: !document.getElementById('btn-compound').hidden, note: document.getElementById('compound-note').textContent }));
  ok('...by hand: none laid out yet, and the way to lay one out', cf.btn && /None laid out/.test(cf.note), cf.note);
  await p.click('#btn-compound');
  await p.waitForTimeout(150);
  const blank = await p.evaluate(() => ({ open: !document.getElementById('cmp-modal').hidden, canvas: !!document.getElementById('cmp-canvas'), status: document.getElementById('cmp-status').textContent, done: document.getElementById('cmp-done').disabled }));
  ok('the editor opens on a blank 3" grid, which cannot be fought in yet', blank.open && blank.canvas && /No entry point/.test(blank.status) && blank.done, blank.status);
  // a corridor dragged across the table on row 4, by hand
  const box = await p.evaluate(() => { const r = document.getElementById('cmp-canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cell = (i, j) => ({ x: box.x + (i + 0.5) * box.w / 16, y: box.y + (j + 0.5) * box.h / 16 });
  await p.mouse.move(cell(0, 4).x, cell(0, 4).y); await p.mouse.down();
  for (let i = 1; i < 16; i++) await p.mouse.move(cell(i, 4).x, cell(i, 4).y, { steps: 2 });
  await p.mouse.up();
  const drawn = await p.evaluate(() => ({ row: window.PMCCompoundEdit.plan().cells.slice(64, 80), status: document.getElementById('cmp-status').textContent, done: document.getElementById('cmp-done').disabled }));
  ok('a corridor painted edge to edge: fought in, with a warning about the open row', drawn.row === 'cccccccccccccccc' && !drawn.done && /edge to edge/.test(drawn.status), drawn.row + ' / ' + drawn.status);
  // a door on the line between cells 7 and 8 of it
  await p.click('.cmp-tool[data-tool="edge"]');
  await p.mouse.click(box.x + 8 * box.w / 16, cell(7, 4).y);
  const dr = await p.evaluate(() => window.PMCCompoundEdit.plan().doors.slice());
  ok('the edge tool hangs a door between two cells', dr.length === 1 && dr[0] === '71|72', dr.join());
  await p.click('[data-cmp="gen"]');
  await p.waitForTimeout(100);
  const gen = await p.evaluate(() => ({ status: document.getElementById('cmp-status').textContent, done: document.getElementById('cmp-done').disabled }));
  ok('"Start from a generated one" gives a whole compound to change', !gen.done && /rooms?, \d+ halls?/.test(gen.status), gen.status);
  await p.screenshot({ path: path.join(SHOTS, 'compound-edit.png') });
  await p.click('#cmp-done');
  cf = await p.evaluate(() => ({ closed: document.getElementById('cmp-modal').hidden, note: document.getElementById('compound-note').textContent, saved: !!localStorage.getItem('pmc-compound-48x48') }));
  ok('Use this compound: kept for the table size, and named on the battlefield step', cf.closed && cf.saved && /^Yours/.test(cf.note), cf.note);
  await p.evaluate(() => { const s = document.getElementById('sel-compound'); s.value = 'gen'; s.dispatchEvent(new Event('change', { bubbles: true })); });

  await tick(false);
  const after = await p.evaluate(() => document.getElementById('sel-scen').value);
  ok('unticked, they go, and a choice of one with them', !(await scens()).some((v) => /^ce_/.test(v)) && after === 'roll', after);
  ok('...Besieged too', !(await p.evaluate(() => Array.from(document.querySelectorAll('#sel-solo-scen option')).some((o) => o.value === 's_besieged'))));

  console.log('\nA battle in a compound');
  await p.evaluate(() => window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'demo', planet: 'sparse', scenario: 'ce_clear', nameA: 'Ironhold', nameB: 'Kessler',
    armyA: ['regular', 'veterans', 'lcv', 'observers'], armyB: window.PMC.rollArmy(3, 1, null, 'rebel') }));
  await p.waitForTimeout(900);
  const set = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return { compound: !!s.compound, kinds: [...new Set(s.terrain.map((r) => r.kind))].sort().join(), vehicles: s.units.filter((u) => u.cls !== 'infantry').length,
      fo: (s.units.find((u) => u.key === 'observers') || {}).rules };
  });
  ok('the table is a compound: corridors, rooms, bulkheads and doors', set.compound && /bulkhead/.test(set.kinds) && /corridor/.test(set.kinds) && /room/.test(set.kinds), set.kinds);
  ok('...with nothing on wheels or wings inside it', set.vehicles === 0);
  ok('...and the observers carrying Advanced Sensors', (set.fo || []).indexOf('Advanced Sensors') >= 0, (set.fo || []).join());
  for (let i = 0; i < 400; i++) {
    const over = await p.evaluate(() => {
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      const s = window.PMC_STATE();
      return s.turn >= 2 || !!s.over;
    });
    if (over) break;
    await p.waitForTimeout(120);
  }
  const mid = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return { turn: s.turn, onTable: s.units.filter((u) => u.alive && u.x >= 0).length,
      walled: s.units.filter((u) => u.alive && u.x >= 0 && window.PMC.terrainAt(s, u.x, u.y) === 'bulkhead').length };
  });
  ok('the two AIs fight it out into turn 2, nobody standing in a wall', mid.turn >= 2 && mid.onTable > 0 && mid.walled === 0, JSON.stringify(mid));
  await p.screenshot({ path: path.join(SHOTS, 'compound.png') });

  console.log('\nA battle in the compound laid out by hand');
  await p.evaluate(() => window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'demo', planet: 'sparse', scenario: 'ce_clear', nameA: 'Ironhold', nameB: 'Kessler',
    armyA: ['regular', 'veterans'], armyB: ['regular', 'veterans'], compoundPlan: JSON.parse(localStorage.getItem('pmc-compound-48x48')) }));
  await p.waitForTimeout(900);
  const hb = await p.evaluate(() => { const s = window.PMC_STATE(); return { built: !!(s.compound && s.compound.built), rooms: s.terrain.filter((r) => r.kind === 'room' || r.kind === 'hall').length }; });
  ok('fought in as it was laid out', hb.built && hb.rooms > 0, JSON.stringify(hb));
  await p.screenshot({ path: path.join(SHOTS, 'compound-hand.png') });

  console.log('\nEntering the table, a player against the AI');
  // the entry points are boxes, not a strip: the camera must not be sent to NaN by them
  await p.evaluate(() => window.PMC_NEWGAME({ tier: 1, pl: 1, mode: 'ai', planet: 'sparse', scenario: 'ce_clear', nameA: 'Us', nameB: 'Them',
    armyA: ['cmd4', 'lighteng', 'recruits'], armyB: ['cmd4', 'recruits', 'irregulars'] }));
  await p.waitForTimeout(800);
  for (let i = 0; i < 20; i++) {
    const at = await p.evaluate(() => {
      const vis = [...document.querySelectorAll('button')].filter((x) => x.offsetParent);
      const go = vis.find((x) => x.id === 'obj-done') || vis.find((x) => x.id === 'res-continue') || vis.find((x) => /Continue to deployment|Begin the battle/.test(x.textContent));
      if (go) go.click();
      return !go && !!window.__insertionAsking();
    });
    if (at) break;
    await p.waitForTimeout(400);
  }
  const ent = await p.evaluate(() => {
    const v = window.__viewRect(), sp = window.__insertionSpotsNow() || [];
    const was = window.__insertionAsking(), q = sp[Math.floor(sp.length / 2)];
    if (q) window.__boardTapAt(q.x, q.y);
    return { view: [v.sx, v.sy].every((n) => typeof n === 'number' && isFinite(n)), spots: sp.length, was,
      placed: window.PMC_STATE().units.filter((u) => u.side === 'A' && !u.reserve && u.x >= 0).length };
  });
  ok('the camera on the table, the entry corridors shaded, and a tap there brings the unit on', ent.view && ent.spots > 0 && ent.was && ent.placed === 1, JSON.stringify(ent));
  const cam0 = await p.evaluate(() => window.__viewRect());
  await p.mouse.move(670, 300); await p.mouse.down(); await p.mouse.move(520, 200, { steps: 6 }); await p.mouse.up();
  const cam1 = await p.evaluate(() => window.__viewRect());
  ok('...and the table still pans', [cam0.sx, cam0.sy, cam1.sx, cam1.sy].every(isFinite) && (cam1.sx !== cam0.sx || cam1.sy !== cam0.sy), JSON.stringify([cam0.sx, cam0.sy, cam1.sx, cam1.sy]));

  console.log('\nBesieged, solitaire');
  await p.evaluate(() => window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'demo', planet: 'sparse', scenario: 's_besieged', nameA: 'Ironhold', nameB: 'OpFor',
    armyA: window.PMCSolo.rollCommando(3, 1, 'pmc'), armyB: window.PMCSolo.rollOpFor(3, 1, 'rebel', false),
    solo: { coop: false, faction: 'pmc', opFaction: 'rebel', names: ['Ironhold'] } }));
  await p.waitForTimeout(900);
  const bs = await p.evaluate(() => { const s = window.PMC_STATE(); return { scen: s.cfg.scenario, compound: !!s.compound, counters: (s.sc.counters || []).length, obj: s.units.some((u) => u.soloObjective) }; });
  ok('a compound, its counters laid, the important unit among them', bs.scen === 's_besieged' && bs.compound && bs.counters > 0 && bs.obj, JSON.stringify(bs));
  for (let i = 0; i < 400; i++) {
    const over = await p.evaluate(() => {
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      const s = window.PMC_STATE();
      return s.turn >= 3 || !!s.over;
    });
    if (over) break;
    await p.waitForTimeout(120);
  }
  const bt = await p.evaluate(() => { const s = window.PMC_STATE(); return { turn: s.turn, over: !!s.over }; });
  ok('played on into turn 3 (or to its end)', bt.turn >= 3 || bt.over, JSON.stringify(bt));
  await p.screenshot({ path: path.join(SHOTS, 'besieged.png') });
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));

  await b.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
