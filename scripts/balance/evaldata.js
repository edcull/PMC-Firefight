/* Positions and who won, for fitting the evaluation (evalfit.js): battles between
   the AI as it is on both sides, random armies, scenarios and planets, each pair from
   its own seed. As each turn's activations are done, the position is recorded as the
   planner's features for side A (planner.js planFeatures: its own less the enemy's);
   at the end every record of the battle gets its result, 1 if A won, 0 if it lost,
   0.5 for a draw. See docs/ai-research.md.

     node scripts/balance/evaldata.js <battles> [seed] > positions.jsonl  */
'use strict';
const path = require('path');
const { R, Engine } = require(path.join(__dirname, '../../server/rules.js'));
const N = +process.argv[2] || 20;
const BASE = +process.argv[3] || 1;
let seed = 1;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const FACS = ['pmc', 'rebel', 'bugs', 'xeno'], SC = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
const PL = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let errs = 0;
for (let i = 0; i < N; i++) {
  seed = (BASE * 7919 + (i + 1) * 104729) % 2147483647 || 1;
  const tier = 1 + Math.floor(Math.random() * 3);
  const cfg = { tier, pl: 1, scenario: pick(SC), armyA: R.rollArmy(tier, 1, null, pick(FACS)), armyB: R.rollArmy(tier, 1, null, pick(FACS)),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: pick(PL), campaign: true, terrainSetup: 'auto', evalLog: true };
  try {
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
    const w = (e.report() || {}).winner, y = w === 'A' ? 1 : w === 'B' ? 0 : 0.5, st = e.state();
    (st.evalLog || []).forEach((r) => {
      process.stdout.write(JSON.stringify({ b: BASE + ':' + i, scenario: cfg.scenario, turn: r.turn, turns: st.turn, f: r.f, y }) + '\n');
    });
  } catch (err) { errs++; }
}
if (errs) process.stderr.write(errs + ' battles failed\n');
