/* What the choosing AI does differently from the behaviour table it replaced, read
   off the battle logs of mirror battles (versus.js): the same two armies, scenario
   and planet fought twice with the sides swapped, one side choosing, the other
   rolling. Each side's activations are counted — what it decided, how it moved, what
   its shots and charges did, what it lost and when — and the two set side by side,
   averaged per battle. See README.md.

     node scripts/balance/aistats.js <pairs> [seed] [factions]

   factions: a comma list both armies are drawn from (default all four), e.g. pmc,rebel.
   Prints one line of JSON (aggregate it over several seeds with aistats-report.js). */
'use strict';
const path = require('path');
const { R, Engine } = require(path.join(__dirname, '../../server/rules.js'));
const N = +process.argv[2] || 10;
let seed = +process.argv[3] || 1;
const FACS = (process.argv[4] || 'pmc,rebel,bugs,xeno').split(',');
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SC = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
const PL = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// the tally and the log reading the game itself keeps on its battle report
const BS = require(path.join(__dirname, '../../src/rules/battlestats.js'));
const tally = BS.tally;

function play(cfg, s0) {
  seed = s0;
  const e = Engine.create();
  e.start(cfg);
  for (let g = 0; g < 20000 && !e.over(); g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) {
      const sel = e.sel();
      if (sel.insertion) { const sp = (sel.insertion.spots || [])[0]; e.intent(sel.insertion.by || sel.insertion.unit.side, sp ? { k: 'insert', x: sp.x, y: sp.y } : { k: 'holdinsert' }); continue; }
      if (sel.reservePick) { const rp = sel.reservePick; rp.ids.slice(0, Math.max(rp.min, 1)).forEach((id) => e.intent(rp.side, { k: 'rpick', id })); e.intent(rp.side, { k: 'rpickdone' }); continue; }
      break;
    }
  }
  if (!e.over()) throw new Error('unfinished');
  return e;
}

const out = { chose: tally(), rolled: tally(), errs: 0 };
for (let i = 0; i < N; i++) {
  const tier = 1 + Math.floor(Math.random() * 3), fa = pick(FACS), fb = pick(FACS);
  const armyA = R.rollArmy(tier, 1, null, fa), armyB = R.rollArmy(tier, 1, null, fb);
  const sc = pick(SC), planet = pick(PL), s0 = Math.floor(Math.random() * 2e9) + 1;
  ['A', 'B'].forEach((h) => {                      // h: the side that chooses
    const r = h === 'A' ? 'B' : 'A';
    const cfg = { tier, pl: 1, scenario: sc, armyA: armyA.slice(), armyB: armyB.slice(), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel',
      mode: 'demo', planet, campaign: true, terrainSetup: 'auto', aiRolled: { [r]: true } };
    let e;
    try { e = play(cfg, s0); } catch (err) { out.errs++; return; }
    const T = BS.read(e.state().log);
    const rep = e.report() || {}, turns = e.state().turn;
    [[h, 'chose'], [r, 'rolled']].forEach(([side, k]) => {
      const t = T[side], o = out[k];
      t.battles = 1; t.turns = turns; t.wins = rep.winner === side ? 1 : 0; t.draws = rep.winner ? 0 : 1;
      Object.keys(t).forEach((f) => {
        if (typeof t[f] === 'number') o[f] += t[f];
        else Object.keys(t[f]).forEach((g) => { o[f][g] = (o[f][g] || 0) + t[f][g]; });
      });
    });
  });
}
console.log(JSON.stringify(out));
