/* A made-up battle report, for the story's tests (docs/story-mode-plan.md,
   section 6): no battle is played. A grade is given, and a report in
   battleReport's shape is written to match it: the company's units lose more
   men, and more of them are wiped out or knocked out, the worse the grade.
   The campaign's real aftermath then takes it as it would a real one. */
'use strict';
const { R } = require('../server/rules.js');

// the share of each unit's men lost, roughly, at each grade
const LOSS = { decisive: 0.1, victory: 0.25, draw: 0.35, defeat: 0.5, rout: 0.7 };

function line(side, rid, key, share) {
  const p = R.profile(key), machine = p.cls !== 'infantry';
  const size = machine ? 1 : p.size || 1;
  if (machine) {
    const down = Math.random() < share * 0.5;
    return { rid, side, key, tier: p.tier, startSize: 1, endSize: down ? 0 : 1, destroyed: down, wiped: false, kills: [] };
  }
  const lost = Math.min(size, Math.round(size * share * (0.5 + Math.random())));
  return { rid, side, key, tier: p.tier, startSize: size, endSize: size - lost, wiped: lost >= size, destroyed: false, kills: [] };
}

/* picks: the company's dossier entries that fought; enemy: the enemy's unit
   keys; cfg: the battle's cfg (its Tier, PL and scenario). */
function makeReport(picks, enemy, grade, cfg) {
  const share = LOSS[grade];
  const theirs = 1 - share;      // what the enemy lost, the other way about
  const units = picks.map((e) => line('A', e.rid, e.key, share))
    .concat(enemy.map((k, i) => line('B', 'B' + i, k, theirs)));
  // a win is credited to whoever was standing at the end
  if (grade === 'decisive' || grade === 'victory') {
    const killers = units.filter((u) => u.side === 'A' && u.endSize > 0);
    units.filter((u) => u.side === 'B' && (u.wiped || u.destroyed)).forEach((b, i) => {
      if (killers.length) killers[i % killers.length].kills.push({ tier: b.tier, broken: false, key: b.key });
    });
  }
  return {
    winner: grade === 'decisive' || grade === 'victory' ? 'A' : grade === 'draw' ? null : 'B',
    routed: { A: grade === 'rout', B: grade === 'decisive' },
    battleTier: cfg.tier, pl: cfg.pl, scenario: cfg.scenario, turns: 6,
    units, casualties: [], story: null
  };
}

module.exports = { makeReport, LOSS };
