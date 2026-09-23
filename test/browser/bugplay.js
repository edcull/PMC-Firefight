/* A bug swarm takes the field against mercenaries, insurgents and another
   swarm, AI against AI, played to a decision: the swarm's rules reach the table,
   the bug sprites draw, and nothing throws. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

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

async function run(p, label, cfg, checks) {
  console.log('\n  ' + label);
  await p.evaluate((c) => {
    /* Laid out as a game against the AI rather than a demo: a demo is walked
       forward one activation per animation, a minute and a half a battle. Both
       sides go to the AI below, once the table is set, and the engine then
       plays the battle through at once while the board replays it. */
    window.PMC_NEWGAME({
      tier: c.tier, pl: c.pl, mode: 'ai', planet: 'sparse', scenario: c.scenario,
      nameA: 'The revolt', nameB: 'Kessler',
      tactics: { A: c.tactic, B: null },
      armyA: window.PMC.rollArmy(c.tier, c.pl, null, c.factionA),
      armyB: window.PMC.rollArmy(c.tier, c.pl, null, c.factionB)
    });
  }, cfg);
  await p.waitForTimeout(800);
  for (let i = 0; i < 12; i++) { await drain(p); await p.waitForTimeout(100); }

  const set = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const a = s.units.filter(u => u.side === 'A');
    return {
      tactic: s.tactics.A,
      factions: [...new Set(s.units.map(u => u.faction))].sort().join('+'),
      barricades: s.terrain.filter(t => t.kind === 'barricade').length,
      stealthy: a.filter(u => u.rules.indexOf('Stealth') >= 0).length,
      infantry: a.filter(u => u.cls === 'infantry').length,
      riders: a.filter(u => u.rules.indexOf('Riders') >= 0).length,
      emplaced: a.filter(u => u.rules.indexOf('Stationary Artillery') >= 0).length,
      emplacedInReserve: a.filter(u => u.rules.indexOf('Stationary Artillery') >= 0 && u.reserve).length,
      arts: [...new Set(a.map(u => u.art))].join(' ')
    };
  });
  ok('the right tactic is on the table', set.tactic === (cfg.tactic || null), String(set.tactic));
  ok('both forces are the factions asked for', set.factions === cfg.wantFactions, set.factions);
  console.log('      arts: ' + set.arts);
  if (checks) checks(set);

  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="autodeploy"]');
    if (b) b.click();
  });
  await p.waitForTimeout(300);
  for (let i = 0; i < 8; i++) { await drain(p); await p.waitForTimeout(100); }
  const started = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.cfg.aiSides = ['A', 'B'];                  // AI against AI, unpaced
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
    return s.phase;
  });
  ok('the battle starts once both forces are down', started === 'battle', started);
  await p.waitForTimeout(400);

  // bounded: a battle that never ends fails the check below rather than hanging
  let over = null;
  const until = Date.now() + 90000;
  for (let i = 0; Date.now() < until; i++) {
    if (process.env.SHOT && i === +(process.env.SHOTAT || 120)) await p.screenshot({ path: process.env.SHOT + '-' + label.replace(/\W+/g, '_') + '.png' });
    over = await p.evaluate(() => {
      const s = window.PMC_STATE();
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      return s && s.over ? { text: s.over.text, turn: s.turn } : null;
    });
    if (over) break;
    await p.waitForTimeout(80);
  }
  ok('the battle reaches a decision', !!over, over ? 'turn ' + over.turn + ': ' + over.text : 'still running');

  const after = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const txt = s.log.map(l => l.text).join('\n');
    return {
      tide: (txt.match(/Endless Tide/g) || []).length,
      wave: (txt.match(/Psychic Wave\./g) || []).length,
      aggro: (txt.match(/Aggressive: charges/g) || []).length,
      quek: (txt.match(/QUEKKK/g) || []).length,
      splash: (txt.match(/SPLASH/g) || []).length,
      lines: s.log.length
    };
  });
  return after;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(600);

  const tally = { tide: 0, wave: 0, aggro: 0, quek: 0, splash: 0, spit: 0 };
  function add(r) { Object.keys(tally).forEach(k => tally[k] += r[k] || 0); }
  const shot = process.env.SHOT;

  add(await run(p, 'SWARM AGAINST A COMPANY', {
    tier: 3, pl: 1, scenario: 'meeting', tactic: null,
    factionA: 'bugs', factionB: 'pmc', wantFactions: 'bugs+pmc'
  }));
  add(await run(p, 'SWARM AGAINST AN INSURGENT GROUP', {
    tier: 4, pl: 1, scenario: 'secure', tactic: null,
    factionA: 'bugs', factionB: 'rebel', wantFactions: 'bugs+rebel'
  }));
  add(await run(p, 'SWARM WAR', {
    tier: 5, pl: 1, scenario: 'takeover', tactic: null,
    factionA: 'bugs', factionB: 'bugs', wantFactions: 'bugs'
  }));
  add(await run(p, 'A COMPANY AGAINST THE SWARM, PL2', {
    tier: 2, pl: 2, scenario: 'find', tactic: null,
    factionA: 'pmc', factionB: 'bugs', wantFactions: 'bugs+pmc'
  }));

  console.log('\n  What the swarm rules did across the four battles:');
  Object.keys(tally).forEach(k => console.log('    ' + k.padEnd(8) + tally[k]));
  ok('Endless Tide brought bugs back', tally.tide > 0);
  ok('Animal Behaviour hits were rolled', tally.quek > 0 && tally.splash > 0);
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
