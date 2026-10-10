/* One simulated campaign world, for balance checks (see README.md here).

     node scripts/balance/world.js <run#> <out.json> [turns]

   A world of AI companies — one of each personality of FACTION (pmc, rebel, bugs,
   xeno), or all 24 with FACTION=all — founded together. Every campaign turn they pair
   off at random and fight real engine battles, the AI on both sides, on a random
   planet and scenario, roles rolled as a contract rolls them. The full campaign
   aftermath and each company's own development follow every battle.

   Environment: FACTION (default all), SCEN (a comma list to draw the scenario from,
   default all six), OVERRIDE (personality changes, JSON in the shape the admin
   Personalities screen stores — C.withArchetypeChanges), STACK (a file to append the
   stack of any engine error to). */
'use strict';
const fs = require('fs');
const path = require('path');
const { R, SC, C } = require(path.join(__dirname, '../../server/rules.js'));

const RUN = +process.argv[2] || 1, OUT = process.argv[3], TURNS = +process.argv[4] || 24;
if (!OUT) { console.error('usage: node scripts/balance/world.js <run#> <out.json> [turns]'); process.exit(2); }
const FACTION = process.env.FACTION || 'all';
const FACS = ['pmc', 'rebel', 'bugs', 'xeno'], FAC_OF = {};
FACS.forEach((f) => C.archetypesFor(f).forEach((a) => { FAC_OF[a.id] = f; }));
const IDS = FACTION === 'all' ? Object.keys(FAC_OF) : C.archetypesFor(FACTION).map((a) => a.id);
const PLANETS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// the force a company fields: legal, or none
function pickArmy(co, tier, pl, tactic, scen) {
  const picks = C.pickForce(co, tier, pl, tactic, { scenario: scen });
  const keys = picks.map((e) => R.entryPick(e));
  return R.checkArmy(keys, tier, pl, co.doctrines || [], tactic).ok ? { picks, keys } : null;
}
// walks an AI-against-AI battle on, a step at a time, answering what the engine asks
function stepper(e) {
  let stuck = 0;
  return function () {
    if (e.over()) return false;
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); return true; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); return true; }
    if (s.phase === 'deploy' || s.phase === 'terrain') {
      e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
      return e.state().phase === 'battle' || ++stuck < 5;
    }
    const r = e.intent(s.activeSide || 'A', { k: 'step' });
    if (r.ok) { stuck = 0; return true; }
    const sel = e.sel();
    if (sel.insertion) {
      const sp = (sel.insertion.spots || [])[0];
      e.intent(sel.insertion.by || (sel.insertion.unit ? sel.insertion.unit.side : 'A'), sp ? { k: 'insert', x: sp.x, y: sp.y } : { k: 'holdinsert' });
      return true;
    }
    if (sel.reservePick) {
      const rp = sel.reservePick;
      rp.ids.slice(0, Math.max(rp.min, 1)).forEach((id) => e.intent(rp.side, { k: 'rpick', id }));
      e.intent(rp.side, { k: 'rpickdone' });
      return true;
    }
    return ++stuck < 20;
  };
}
// the share of a side's models lost (machines whole)
function lossShare(rep, side) {
  let start = 0, lost = 0;
  rep.units.filter((u) => u.side === side).forEach((u) => {
    const s = u.startSize || 1; start += s;
    lost += (u.destroyed || u.wiped || u.catastrophic) ? s : Math.max(0, s - (u.endSize == null ? s : u.endSize));
  });
  return start ? lost / start : 0;
}

function battle(x, y, turn) {
  const fa = C.fullTier(x, 1) || x.tier, fb = C.fullTier(y, 1) || y.tier;
  const tier = Math.max(1, Math.min(x.tier, y.tier, fa, fb));
  const pl = C.defaultLevel(x, y, tier, C.levelsFor(x, y, tier) || [1]) || 1;
  const scen = pick(process.env.SCEN ? process.env.SCEN.split(',') : SC.ORDER), planet = pick(PLANETS);
  // the roles first (as a contract settles them), then each revolt's tactic, then the forces
  const roles = SC.rollRoles(scen, { A: x.doctrines, B: y.doctrines }, null, null, ['A', 'B']);
  const tacA = C.aiTactic(x, roles, 'A'), tacB = C.aiTactic(y, roles, 'B');
  let a = pickArmy(x, tier, pl, tacA, scen), b = pickArmy(y, tier, pl, tacB, scen);
  if (!a) { C.developRival(x); a = pickArmy(x, tier, pl, tacA, scen); }
  if (!b) { C.developRival(y); b = pickArmy(y, tier, pl, tacB, scen); }
  if (!a || !b) return null;
  const e = global.PMCEngine.create();
  e.start({ roles, tier, pl, scenario: scen, armyA: a.keys, armyB: b.keys, nameA: x.name, nameB: y.name, colourA: 'ochre', colourB: 'steel',
    dossier: { A: a.picks, B: b.picks }, doctrines: { A: x.doctrines.slice(), B: y.doctrines.slice() }, tactics: { A: tacA, B: tacB },
    temper: { A: C.aiTemper(x), B: C.aiTemper(y) }, campaign: true, mode: 'demo', planet, terrainSetup: 'auto' });
  const step = stepper(e);
  for (let g = 0; g < 20000 && step(); g++) { /* to the end */ }
  if (!e.over()) return null;
  const rep = e.report();
  if (!rep) return null;
  rep.battleTier = tier; rep.pl = pl; rep.scenario = scen; rep.turns = rep.turns || e.state().turn; rep.planet = planet;
  const played = e.state().cfg.roles || e.state().sc;
  const row = { turn, tier, pl, scenario: scen, planet, A: x.archetype, B: y.archetype, fA: FAC_OF[x.archetype], fB: FAC_OF[y.archetype],
    tierA: x.tier, tierB: y.tier, atk: played && played.attacker ? (played.attacker === 'A' ? x.archetype : y.archetype) : null,
    winner: rep.winner === 'A' ? x.archetype : rep.winner === 'B' ? y.archetype : null,
    lossA: lossShare(rep, 'A'), lossB: lossShare(rep, 'B'), tacA, tacB, turns: rep.turns };
  C.battleElsewhere({ turn }, x, y, rep);
  return row;
}

function runWorld() {
  const names = IDS.map((_, j) => 'Co' + j);
  const cos = IDS.map((id, i) => { const co = C.newCompany('Co' + i, { faction: FAC_OF[id] }); C.foundRival(co, id, names); return co; });
  const log = [], tiers = [], errors = [];
  for (let turn = 1; turn <= TURNS; turn++) {
    const order = cos.slice().sort(() => Math.random() - 0.5);
    for (let k = 0; k + 1 < order.length; k += 2) {
      let row = null;
      try { row = battle(order[k], order[k + 1], turn); } catch (err) {
        errors.push(err.message);
        if (process.env.STACK) fs.appendFileSync(process.env.STACK, '\n=== ' + err.message + '\n' + err.stack + '\n');
      }
      if (row) log.push(row); else { C.idleTurn(order[k]); C.idleTurn(order[k + 1]); }
    }
    tiers.push(cos.map((co) => co.tier));
  }
  const end = cos.map((co) => ({ arch: co.archetype, faction: FAC_OF[co.archetype], tier: co.tier, roster: co.roster.length,
    memorial: (co.memorial || []).length, doctrines: co.doctrines.slice(), record: co.record,
    hulls: co.roster.filter((e) => R.profile(e.key).cls !== 'infantry').length, t3pl2: C.canFieldArmy(co, 3, 2) }));
  fs.writeFileSync(OUT, JSON.stringify({ run: RUN, faction: FACTION, turns: TURNS, log, tiers, end, errors }));
  console.log('run', RUN, 'battles', log.length, 'errors', errors.length);
}
if (process.env.OVERRIDE) C.withArchetypeChanges(JSON.parse(process.env.OVERRIDE), runWorld); else runWorld();
