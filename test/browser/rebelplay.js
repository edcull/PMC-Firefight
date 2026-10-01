/* An insurgent group takes the field: once with each Tactic and once with none,
   plus a mercenary company against rebels, played to a decision. The point is
   that the tactics reach the table, the new sprites draw, and nothing throws. */
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
  // a player's Last Stand barricades go down by hand: tap across the table until they are all placed
  await p.evaluate(() => {
    for (let y = 6; y < 44 && window.PMC_STATE().placeAsk; y += 3) {
      for (let x = 4; x < 44 && window.PMC_STATE().placeAsk; x += 5) window.__sendIntent({ k: 'placeat', x, y });
    }
    if (window.PMC_STATE().placeAsk) window.__sendIntent({ k: 'placedone' });
  });
  await p.waitForTimeout(200);

  const set = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const a = s.units.filter(u => u.side === 'A');
    return {
      tactic: s.tactics.A,
      factions: [...new Set(s.units.map(u => u.faction))].sort().join('+'),
      barricades: s.terrain.filter(t => t.kind === 'barricade').length,
      stealthy: a.filter(u => u.rules.indexOf('Stealth') >= 0).length,
      // Deserters and POWs follow no army rule, a tactic included (p. 103)
      infantry: a.filter(u => u.cls === 'infantry' && u.rules.indexOf('No Army Rules') < 0).length,
      riders: a.filter(u => u.rules.indexOf('Riders') >= 0 && u.rules.indexOf('No Army Rules') < 0).length,
      emplaced: a.filter(u => u.rules.indexOf('Stationary Artillery') >= 0).length,
      emplacedInReserve: a.filter(u => u.rules.indexOf('Stationary Artillery') >= 0 && u.reserve).length,
      arts: [...new Set(a.map(u => u.art))].join(' ')
    };
  });
  ok('the right tactic is on the table', set.tactic === (cfg.tactic || null), String(set.tactic));
  ok('both forces are the factions asked for', set.factions === cfg.wantFactions, set.factions);
  ok('no emplaced gun is held in reserve', set.emplacedInReserve === 0,
    set.emplaced + ' emplaced, ' + set.emplacedInReserve + ' in reserve');
  if (checks) checks(set);

  await p.evaluate(() => {
    /* Pieces the player puts down by hand come first — Last Stand's barricades,
       a Hostile takeover defender's position: settled the quick way (the auto
       button for the position, Done for the rest), as a player in a hurry would. */
    for (let n = 0; n < 4 && window.PMC_STATE().placeAsk; n++) {
      window.__sendIntent({ k: window.PMC_STATE().placeAsk.kind === 'fort' ? 'placeauto' : 'placedone' });
    }
    const b = (window.__sendIntent({ k: 'autosplit' }), ((document.querySelector('[data-act="deployready"]') && window.__sendIntent({ k: 'deployready' })), document.querySelector('button[data-act="autodeploy"]')));
    if (b) b.click();
  });
  await p.waitForTimeout(300);
  for (let i = 0; i < 8; i++) { await drain(p); await p.waitForTimeout(100); }
  const started = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.cfg.aiSides = ['A', 'B'];                  // AI against AI, unpaced
    const b = window.__beginButton();
    if (b) b.click();
    return s.phase === 'battle' ? s.phase : s.phase + ' ' + JSON.stringify({ scen: s.scen && s.scen.id, place: s.placeAsk && s.placeAsk.why, mine: !!s.minePick, swap: s.swapStage || null, button: !!b,
      left: s.units.filter(u => u.x < 0 && !u.reserve && !u.aboard && u.alive).map(u => u.side + ':' + u.name).join(', ') });
  });
  ok('the battle starts once both forces are down', started === 'battle', started);
  await p.waitForTimeout(400);

  // bounded: a battle that never ends fails the check below rather than hanging
  let over = null;
  const until = Date.now() + 90000;
  for (let i = 0; Date.now() < until; i++) {
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
      freedom: (txt.match(/never take our freedom/g) || []).length,
      glory: (txt.match(/Death or Glory/g) || []).length,
      smoke: (txt.match(/smoke and a flare/g) || []).length,
      digin: (txt.match(/digs in/g) || []).length,
      lines: s.log.length
    };
  });
  return after;
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  // the battles are watched, not played: the drawing runs twenty-five times over (game.js, PMC_TIME_SCALE)
  await p.addInitScript(() => { window.PMC_TIME_SCALE = 25; });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(600);

  const tally = { freedom: 0, glory: 0, smoke: 0, digin: 0 };
  function add(r) { Object.keys(tally).forEach(k => tally[k] += r[k]); }

  add(await run(p, 'NO TACTIC — insurgents against mercenaries', {
    tier: 3, pl: 1, scenario: 'meeting', tactic: null,
    factionA: 'rebel', factionB: 'pmc', wantFactions: 'pmc+rebel'
  }));

  add(await run(p, 'LAST STAND — dug in behind their own barricades', {
    tier: 3, pl: 2, scenario: 'secure', tactic: 'laststand',
    factionA: 'rebel', factionB: 'pmc', wantFactions: 'pmc+rebel'
  }, set => {
    ok('eight barricades went down for two Priority Levels', set.barricades >= 8,
      set.barricades + ' wall sections');
  }));

  add(await run(p, 'HUMAN WAVE ATTACKS — numbers over everything', {
    tier: 3, pl: 1, scenario: 'meeting', tactic: 'wave',
    factionA: 'rebel', factionB: 'pmc', wantFactions: 'pmc+rebel'
  }));

  add(await run(p, 'GUERILLAS — out of the tunnels', {
    tier: 3, pl: 1, scenario: 'find', tactic: 'guerillas',
    factionA: 'rebel', factionB: 'pmc', wantFactions: 'pmc+rebel'
  }, set => {
    ok('every unit on foot but the riders has Stealth',
      set.stealthy === set.infantry - set.riders,
      set.stealthy + ' of ' + set.infantry + ' infantry, ' + set.riders + ' mounted');
  }));

  add(await run(p, 'TWO REVOLTS — insurgents on both sides', {
    tier: 4, pl: 1, scenario: 'takeover', tactic: 'laststand',
    factionA: 'rebel', factionB: 'rebel', wantFactions: 'rebel'
  }));

  console.log('\n  What the rebel rules did across the five battles:');
  console.log('    "…but they\'ll never take our freedom!" rally bonuses: ' + tally.freedom);
  console.log('    "Death or Glory, Comrades!" charges:                   ' + tally.glory);
  console.log('    Smoke Markers put down:                               ' + tally.smoke);
  console.log('    Guns dug in over open sights:                         ' + tally.digin);
  /* Whether a battle's rallies happen to fall near a leader is chance, so the
     rule itself is staged here: a suppressed squad a few inches from one of
     the revolt's leaders rallies, and the leader's cry adds its dice. */
  // a fresh revolt, so its leaders are alive whatever happened to the last battle's
  // a revolt that has a leader and a squad it can reach: the rolled armies are chance, so both are named
  await p.evaluate(() => {
    const R = window.PMC;
    window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'hotseat', planet: 'sparse', scenario: 'meeting', nameA: 'A', nameB: 'B',
      armyA: ['rleaders', 'rmilitia', 'rmilitia', 'rinsurgents'], armyB: R.rollArmy(3, 1, null, 'rebel') });
  });
  await p.waitForTimeout(800);
  const cry = await p.evaluate(() => {
    const R = window.PMC, s = window.PMC_STATE();
    const RULE = '\u2026but they\'ll never take our freedom!';
    const lead = s.units.find(u => u.alive && !u.aboard && u.side === 'A' && R.has(u, RULE));
    if (lead) { lead.x = 20; lead.y = 24; lead.reserve = false; }
    if (!lead) return { note: 'no leader on the table' };
    const sq = s.units.find(u => u.alive && u.side === lead.side && u !== lead && !R.has(u, RULE) && !R.isMachine(u) && u.tier < lead.tier + 2);
    if (!sq) return { note: 'no squad beside the leader' };
    // Suppressed, whatever its Morale, so the rally has something to do
    sq.bld = null; sq.aboard = null; sq.reserve = false; sq.x = lead.x + 4; sq.y = lead.y; sq.sp = R.currentMorale(sq) + 1;
    const r = R.rally(s, sq);
    return { extras: (r && r.extras || []).join('; ') };
  });
  ok('the leaders\' rally cry adds its dice to a rally within reach', /never take our freedom/.test(cry.extras || ''), cry.extras || cry.note);
  console.log('    (and it was heard ' + tally.freedom + ' time(s) in the battles themselves)');

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
