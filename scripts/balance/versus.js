/* The choosing AI (engine/ai.js chooseBehaviour) against the behaviour table it
   replaced: the same two armies, scenario and planet, fought twice with the sides
   swapped, so neither the armies nor the table favour either. See README.md.

     node scripts/balance/versus.js <pairs> [seed]

   Prints one line of JSON: the battles, the choosing side's wins, the table's, the
   draws, its share (a draw half each) and the same by scenario and by faction. */
'use strict';
const path = require('path');
const { R, Engine } = require(path.join(__dirname, '../../server/rules.js'));
const N = +process.argv[2] || 20;
let seed = +process.argv[3] || 1;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const FACS = ['pmc', 'rebel', 'bugs', 'xeno'], SC = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
const PL = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
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
  const rep = e.report();
  return rep ? rep.winner || null : null;
}
let chose = 0, rolled = 0, draw = 0, errs = 0;
const byScen = {}, byFac = {};
for (let i = 0; i < N; i++) {
  const tier = 1 + Math.floor(Math.random() * 3), fa = pick(FACS), fb = pick(FACS);
  const armyA = R.rollArmy(tier, 1, null, fa), armyB = R.rollArmy(tier, 1, null, fb);
  const sc = pick(SC), planet = pick(PL), s0 = Math.floor(Math.random() * 2e9) + 1;
  ['A', 'B'].forEach((h) => {                      // h: the side that chooses
    const cfg = { tier, pl: 1, scenario: sc, armyA: armyA.slice(), armyB: armyB.slice(), nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel',
      mode: 'demo', planet, campaign: true, terrainSetup: 'auto', aiRolled: { [h === 'A' ? 'B' : 'A']: true }, aiTune: process.env.AITUNE ? JSON.parse(process.env.AITUNE) : null };
    let w;
    try { w = play(cfg, s0); } catch (err) { errs++; return; }
    const k = w == null ? 'draw' : w === h ? 'chose' : 'rolled';
    if (k === 'chose') chose++; else if (k === 'rolled') rolled++; else draw++;
    (byScen[sc] = byScen[sc] || { chose: 0, n: 0 }).n++; if (k === 'chose') byScen[sc].chose++;
    const f = h === 'A' ? fa : fb; (byFac[f] = byFac[f] || { chose: 0, n: 0 }).n++; if (k === 'chose') byFac[f].chose++;
  });
}
const tot = chose + rolled + draw;
console.log(JSON.stringify({ battles: tot, chose, rolled, draw, errs, chosePct: Math.round(1000 * (chose + draw / 2) / tot) / 10, byScen, byFac }));
