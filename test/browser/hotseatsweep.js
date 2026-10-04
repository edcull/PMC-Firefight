/* Hotseat battles played to the end at one screen (the hotseat review, phase 6):
   every scenario, the four kinds of force on both sides of the table between them,
   two picked up again after a reload part-way, and a co-operative game. Each is
   played as two players would play it — the device passed at each change of
   player, every question answered by the player asked, every activation taken
   through the board (test/hotseat.js). Two run at once. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');
const { startHotseat, startCoop, playToEnd } = require('../hotseat.js');

const BATTLES = [
  { scenario: 'meeting', factionA: 'pmc', factionB: 'rebel' },
  { scenario: 'secure', factionA: 'bugs', factionB: 'xeno' },
  { scenario: 'find', factionA: 'rebel', factionB: 'bugs' },
  { scenario: 'invasion', factionA: 'xeno', factionB: 'pmc', reloadAt: 40 },
  { scenario: 'demolish', factionA: 'pmc', factionB: 'bugs' },
  { scenario: 'takeover', factionA: 'rebel', factionB: 'xeno' },
  { scenario: 'meeting', factionA: 'bugs', factionB: 'pmc', reloadAt: 30 },
  // reloaded early: the OpFor's activations are not counted, and a co-op game can be over in 16 of the players'
  { coop: true, factionB: 'rebel', reloadAt: 10 }
];

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const br = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const results = [];
  async function one(bt) {
    // each its own context, so a reload finds its own battle kept
    const ctx = await br.newContext({ viewport: { width: 1340, height: 900 } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { window.PMC_TIME_SCALE = 8; });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    await p.waitForTimeout(700);
    const t0 = Date.now();
    if (bt.coop) await startCoop(p, bt); else await startHotseat(p, bt);
    const r = await playToEnd(p, { reloadAt: bt.reloadAt });
    r.secs = Math.round((Date.now() - t0) / 1000);
    r.errs = errs;
    results.push({ bt: bt, r: r });
    await ctx.close();
  }
  // two at a time
  const queue = BATTLES.slice();
  await Promise.all([0, 1].map(async () => { while (queue.length) await one(queue.shift()); }));

  BATTLES.forEach((bt) => {
    const { r } = results.find((x) => x.bt === bt);
    const label = bt.coop ? 'co-op, ' + bt.factionB + ' for Player 2' : bt.scenario + ', ' + bt.factionA + ' v ' + bt.factionB;
    console.log('\n  ' + label + (bt.reloadAt ? ', reloaded part-way' : '') + '  (' + r.secs + 's)');
    ok('played to a result', r.over, r.over ? (r.winner ? 'won by ' + r.winner : 'a draw') + ' on turn ' + r.turns : r.stuck + ' | ' + r.log.slice(-8).join(' | '));
    // never a card between the players' activations; before the battle only for the secret swaps (a co-op game: once, as its second commando deploys)
    ok('...no card between the players\' activations', r.battlePasses === 0, r.battlePasses + ' in the battle');
    ok(bt.coop ? '...one card, for the second commando\'s deployment' : '...the device passed for the secret swaps only', r.passes <= (bt.coop ? 1 : 2), 'passed ' + r.passes + ' times');
    if (!bt.coop) ok('...both players taking activations', r.sides && r.sides.A > 0 && r.sides.B > 0, JSON.stringify(r.sides));
    if (bt.reloadAt) ok('...and picked up again after a reload', r.reloaded);
    ok('...with no page errors', !r.errs.length, r.errs.slice(0, 2).join(' | '));
  });
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
