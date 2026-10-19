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

// a blank tally for one side of one battle
function tally() {
  return {
    battles: 0, wins: 0, draws: 0, turns: 0,
    decide: {}, holds: 0, holdNoShot: 0,
    moves: 0, inches: 0,
    need: {}, needMove: {},
    shots: 0, shotsStill: 0, shotsHalf: 0, shotsAux: 0, hits: 0, zeroHit: 0, shotDist: 0,
    sp: 0, men: 0, machineDmg: 0,
    charges: 0, chargeWon: 0, chargeLost: 0, chargeStopped: 0, chargeDog: 0,
    regroups: 0, rallied: 0,
    suppressedTaken: 0, brokenTaken: 0, unitsLost: 0, lostByTurn: {},
    activations: 0
  };
}
const sideOf = (text) => { const m = /\[(A|B)\]/.exec(text || ''); return m ? m[1] : null; };

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

// read one battle's log into the two sides' tallies (T.A, T.B)
function read(e, T) {
  const L = e.state().log;
  let turn = 0, inRally = false, actor = null, lastAttack = null, pendingHold = null, charge = null;
  const settleHold = () => { if (pendingHold) { T[pendingHold].holdNoShot++; pendingHold = null; } };
  L.forEach((l) => {
    const text = l.text || '', s = sideOf(text);
    if (l.t === 'turn') { const m = /^Turn (\d+)/.exec(text); if (m) turn = +m[1]; inRally = false; settleHold(); return; }
    if (l.t === 'phase' && /Rally phase/.test(text)) { inRally = true; settleHold(); return; }
    if (l.t === 'ai') {
      const d = / — chooses: .*: (\w+)\.$/.exec(text) || / — behaviour D6 .* = -?\d+: (\w+)\.$/.exec(text);
      if (d && s) { settleHold(); T[s].decide[d[1]] = (T[s].decide[d[1]] || 0) + 1; T[s].activations++; actor = s; }
      if (/ holds its position| holds the building| keeps its head down/.test(text) && s) { T[s].holds++; pendingHold = s; }
      return;
    }
    if (l.t === 'move' && s) {
      const m = / moves ([\d.]+)"/.exec(text);
      if (m) { T[s].moves++; T[s].inches += +m[1]; }
      return;
    }
    if (l.t === 'shoot' && s) {
      if (pendingHold === s) pendingHold = null;           // it held, and shot from where it stood
      const st = T[s], math = String(l.math || '');
      st.shots++;
      if (/stationary/.test(math)) st.shotsStill++;
      if (/half range/.test(math)) st.shotsHalf++;
      if (/auxiliary/.test(text)) st.shotsAux++;
      const h = /→ (\d+) hit/.exec(math), d = / at ([\d.]+)"/.exec(text);
      // what the shot needed on the D10 to hit at all (Defence − modifiers): 1 or less is sure, 10+ only a 9 does it
      const mr = /D10 rolls (\d+).*= (-?\d+) vs Defence (\d+)/.exec(math);
      if (mr) {
        const need = Math.max(0, Math.min(10, +mr[3] - (+mr[2] - +mr[1]) + 1));
        st.need[need] = (st.need[need] || 0) + 1;
        if (!/stationary/.test(math)) st.needMove[need] = (st.needMove[need] || 0) + 1;
      }
      if (h) { st.hits += +h[1]; if (+h[1] === 0) st.zeroHit++; }
      if (d) st.shotDist += +d[1];
      lastAttack = s;
      return;
    }
    if (l.t === 'assault' && / charges /.test(text) && s) {
      T[s].charges++; lastAttack = s;
      const m = /^(.*) charges (.*) — /.exec(text);
      charge = m ? { side: s, atk: m[1], def: m[2] } : null;
      return;
    }
    if (l.t === 'hits' && lastAttack) {
      const st = T[lastAttack];
      (text.match(/\((\d+) SP\)/g) || []).forEach((x) => { st.sp += +/\d+/.exec(x)[0]; });
      (text.match(/Man down! \((\d+) model/g) || []).forEach((x) => { st.men += +/\d+/.exec(x)[0]; });
      (text.match(/\((?:D3 )?(\d+) DP\)/g) || []).forEach((x) => { st.machineDmg += +/(\d+) DP/.exec(x)[1]; });
      return;
    }
    if (charge && l.t === 'rally' && /Death or Glory/.test(text)) T[charge.side].chargeDog++;
    if ((l.t === 'note' || l.t === 'kill' || l.t === 'broken') && charge) {
      // the charge's end: stopped by defensive fire; the defender broken, out or driven back (a win); the attacker so (a loss)
      if (/Defensive fire stops the charge/.test(text)) { T[charge.side].chargeStopped++; charge = null; }
      else if (text.indexOf(charge.def) === 0 && /breaks|wiped out|BROKEN|falls back|gives ground|cannot give ground/.test(text)) { T[charge.side].chargeWon++; charge = null; }
      else if (text.indexOf(charge.atk) === 0 && /breaks|wiped out|BROKEN|falls back/.test(text)) { T[charge.side].chargeLost++; charge = null; }
      else if (/^Neither side breaks/.test(text)) charge = null;
    }
    if (l.t === 'suppressed' && s) T[s].suppressedTaken++;
    if (l.t === 'broken' && s) T[s].brokenTaken++;
    if (l.t === 'kill' && s) { T[s].unitsLost++; T[s].lostByTurn[turn] = (T[s].lostByTurn[turn] || 0) + 1; }
    if (l.t === 'rally' && s) {
      const m = /removes (\d+) SP/.exec(text);
      if (m) T[s].rallied += +m[1];
      // (outside the Rally phase, a unit's own Pass/Regroup action)
      if (!inRally && / rallies:|regroup/i.test(text)) T[s].regroups++;
    }
  });
  settleHold();
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
    const T = { A: tally(), B: tally() };
    read(e, T);
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
