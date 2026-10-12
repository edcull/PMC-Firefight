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
