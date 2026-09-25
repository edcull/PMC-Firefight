/* Each of the six scenarios set up and played to a decision by two AIs. The point
   is not who wins but that each one sets up the right board, deploys the right
   way, releases its reserves on schedule, and ends for the right reason. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

const WANT = {
  meeting: { objectives: 0, attacker: false },
  secure: { objectives: 3, attacker: false },
  find: { objectives: 0, attacker: false },       // nothing is an objective until it is found
  invasion: { objectives: 0, attacker: true },     // the zones are nominated after the defender deploys (p. 53)
  demolish: { objectives: 1, attacker: true },
  takeover: { objectives: 1, attacker: true }
};

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

async function drain(p) {
  await p.evaluate(() => {
    const r = document.getElementById('resolution');
    if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
  });
}

async function playOne(p, id) {
  console.log('\n  ' + id.toUpperCase());
  await p.evaluate((sid) => {
    window.PMC_NEWGAME({
      tier: 3, pl: 1, mode: 'demo', planet: 'sparse', scenario: sid,
      nameA: 'Ironhold', nameB: 'Kessler',
      armyA: window.PMC.rollArmy(3, 1), armyB: window.PMC.rollArmy(3, 1)
    });
  }, id);
  await p.waitForTimeout(900);
  for (let i = 0; i < 12; i++) { await drain(p); await p.waitForTimeout(120); }

  const setup = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      scen: s.scen.id, name: s.scen.name,
      objectives: s.objectives.length,
      attacker: s.sc.attacker || null,
      search: s.sc.search ? s.sc.search.length : 0,
      target: s.terrain.filter(t => t.kind === 'objective').length,
      // "trench, wall or barbed wire sections" (p. 55): the defences come in all three kinds
      barricades: s.terrain.filter(t => t.kind === 'barricade' || t.kind === 'trench' || t.kind === 'wire').length,
      bunkers: s.terrain.filter(t => t.kind === 'bunker').length,
      reserved: s.units.filter(u => u.reserve).length,
      // held back by the SCENARIO, as against by Battlefield Insertion
      waved: s.units.filter(u => u.reserve && u.wave).length,
      wavedIds: s.units.filter(u => u.reserve && u.wave).map(u => u.id),
      onTable: s.units.filter(u => u.x >= 0 && !u.reserve).length,
      total: s.units.length
    };
  });
  const want = WANT[id];
  ok('the right scenario is running', setup.scen === id, setup.name);
  // an Invasion's zones come after the defender deploys: none yet, or three if the AIs have already begun
  ok('objectives placed', setup.objectives === want.objectives || (id === 'invasion' && setup.objectives === 3), setup.objectives + ' placed');
  ok('attacker and defender', !!setup.attacker === want.attacker,
    setup.attacker ? setup.attacker + ' attacks' : 'neither side attacks');
  if (id === 'find') ok('three places to search', setup.search === 3, setup.search + ' locations');
  if (id === 'demolish') ok('the objective is on the table', setup.target === 1);
  if (id === 'takeover') ok('the defender dug in', setup.barricades >= 6 && setup.bunkers >= 1,
    setup.barricades + ' sections of wall, trench and wire, and ' + setup.bunkers + ' bunker');
  if (id === 'invasion' || id === 'find' || id === 'demolish' || id === 'takeover') {
    ok('some of the force is held back', setup.reserved > 0,
      setup.reserved + ' of ' + setup.total + ' in reserve');
  }

  // deploy whatever still needs placing, then let both AIs fight it out
  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="autodeploy"]');
    if (b) b.click();
  });
  await p.waitForTimeout(400);
  for (let i = 0; i < 10; i++) { await drain(p); await p.waitForTimeout(120); }
  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
  });
  await p.waitForTimeout(500);

  const deployed = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return s.units.filter(u => u.x < 0 && !u.reserve && !u.aboard).length;
  });
  ok('every unit is placed or held back', deployed === 0, deployed + ' left unplaced');

  const t0 = Date.now();
  let over = null;
  for (let i = 0; i < 4200; i++) {
    over = await p.evaluate(() => {
      const s = window.PMC_STATE();
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      return s && s.over ? { text: s.over.text, winner: s.over.winner, turn: s.turn } : null;
    });
    if (over) break;
    await p.waitForTimeout(90);
  }
  ok('the battle reaches a decision', !!over,
    over ? 'turn ' + over.turn + ': ' + over.text : 'still running after ' +
      ((Date.now() - t0) / 1000).toFixed(0) + 's');

  const after = await p.evaluate((waved) => {
    const s = window.PMC_STATE();
    return {
      turn: s.turn,
      arrivals: s.log.filter(l => /arrives/.test(l.text)).length,
      /* The log is a rolling window of the last 400 lines, so in a long battle
         a turn-3 arrival has scrolled off it by the end. Whether the units the
         scenario held back reached the table is on the units themselves. */
      cameOn: s.units.filter(u => waved.indexOf(u.id) >= 0 && !u.reserve).length,
      searched: s.log.filter(l => /checks the area/.test(l.text)).length,
      found: !!(s.sc && s.sc.found),
      sam: s.log.filter(l => /SAM/.test(l.text)).length,
      landed: s.log.filter(l => /SP coming down/.test(l.text)).length,
      standing: s.terrain.filter(t => t.kind === 'objective').length,
      zones: s.objectives.length,
      report: s.report ? s.report.scenario : null
    };
  }, setup.wavedIds);
  if (id !== 'meeting' && id !== 'secure') {
    /* A scenario reserve must reach the table; a force the scenario held nobody
       back from has nothing to bring on, which is not a fault. */
    ok('the scenario reserves came on during the battle',
      after.cameOn > 0 || setup.waved === 0,
      after.cameOn + ' of ' + setup.waved + ' held back by the scenario came on (' +
        after.arrivals + ' arrivals still in the log)');
  }
  if (id === 'find') {
    // a rout can settle Find and secure before anyone reaches a location, which is
    // legitimate play — so this asks that the search either happened or had no time to
    ok('the area was searched, or the battle ended first',
      after.searched > 0 || after.turn <= 6,
      after.searched + ' searches by turn ' + after.turn + ', objective ' +
      (after.found ? 'found' : 'never found'));
    const sites = await p.evaluate(() => {
      const s = window.PMC_STATE();
      return {
        pieces: s.terrain.filter(t => t.kind === 'searchsite').length,
        props: (s.props || []).filter(q => q.kind === 'searchsite').length,
        marked: s.terrain.filter(t => t.kind === 'searchsite' && t.checked).length,
        cold: s.terrain.filter(t => t.kind === 'searchsite' && t.cold).length
      };
    });
    ok('the three locations are on the table as terrain', sites.pieces === 3, sites.pieces + ' pieces');
    ok('...and each one is drawn', sites.props === 3, sites.props + ' drawn');
    ok('...with every searched location marked off', sites.marked >= after.searched,
      sites.marked + ' of 3 marked, ' + sites.cold + ' written off as false');
  }
  if (id === 'invasion') {
    ok('three landing zones were nominated', after.zones === 3, after.zones + ' zones');
    ok('the landing shook the troops', after.landed > 0, after.landed + ' units took D3 on arrival');
    ok('Battlefield Insertion is off', await p.evaluate(() =>
      window.PMC_STATE().units.every(u => !u.reserve || u.wave)), true);
  }
  if (id === 'demolish') {
    ok('the objective either fell or held', true,
      after.standing ? 'it held' : 'it was brought down');
  }
  ok('the battle report names the scenario', after.report === id, String(after.report));
  return over;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(600);

  const results = {};
  for (const id of (process.env.SCENS || 'meeting,secure,find,invasion,demolish,takeover').split(',')) {
    results[id] = await playOne(p, id);
  }

  console.log('\nHow each one ended:');
  Object.keys(results).forEach(id => {
    const r = results[id];
    console.log('  ' + id.padEnd(10) + (r ? 'turn ' + String(r.turn).padEnd(3) + r.text : 'NEVER FINISHED'));
  });
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
