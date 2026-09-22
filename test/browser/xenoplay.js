/* A Xenotripod tribe takes the field against mercenaries, insurgents, a swarm
   and another tribe, AI against AI, played to a decision: the tribe's rules
   reach the table, the sprites and hulls draw, and nothing throws. */
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
    window.PMC_NEWGAME({
      tier: c.tier, pl: c.pl, mode: 'demo', planet: 'sparse', scenario: c.scenario,
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
  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
  });
  await p.waitForTimeout(400);

  let over = null;
  for (let i = 0; i < 2400; i++) {
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
      bond: (txt.match(/Psychic Bond —/g) || []).length,
      regain: (txt.match(/Regain Control/g) || []).length,
      repair: (txt.match(/Molecular Reconstruction clears/g) || []).length,
      teleport: (txt.match(/vanishes at/g) || []).length,
      turrets: (txt.match(/turrets act as one/g) || []).length,
      shield: 0,
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

  const tally = { bond: 0, regain: 0, repair: 0, teleport: 0, turrets: 0 };
  function add(r) { Object.keys(tally).forEach(k => tally[k] += r[k] || 0); }
  const shot = process.env.SHOT;

  add(await run(p, 'TRIBE AGAINST A COMPANY', {
    tier: 3, pl: 2, scenario: 'meeting', tactic: null,
    factionA: 'xeno', factionB: 'pmc', wantFactions: 'pmc+xeno'
  }));
  add(await run(p, 'TRIBE AGAINST AN INSURGENT GROUP', {
    tier: 4, pl: 1, scenario: 'secure', tactic: null,
    factionA: 'xeno', factionB: 'rebel', wantFactions: 'rebel+xeno'
  }));
  add(await run(p, 'TRIBE AGAINST A SWARM', {
    tier: 5, pl: 1, scenario: 'takeover', tactic: null,
    factionA: 'xeno', factionB: 'bugs', wantFactions: 'bugs+xeno'
  }));
  add(await run(p, 'TRIBAL WAR, PL2', {
    tier: 2, pl: 2, scenario: 'find', tactic: null,
    factionA: 'xeno', factionB: 'xeno', wantFactions: 'xeno'
  }));
  console.log('\n  What the tribe rules did across the four battles:');
  Object.keys(tally).forEach(k => console.log('    ' + k.padEnd(9) + tally[k]));
  ok('Psychic Bond was felt', tally.bond > 0);
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
