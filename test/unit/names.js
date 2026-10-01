/* Every soldier a name and a rank: mustered with the unit, picked out of the
   living as casualties when the model count drops, and listed by name on the
   battle report.
   A campaign unit carries its survivors on to the next battle. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(what, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + what + (note ? '  ' + note : ''));
}
function unit(key, extra) {
  const p = R.profile(key);
  return Object.assign({ key: key, name: p.name, faction: p.faction || 'pmc', group: p.group, tier: p.tier,
    size: p.size, models: p.size, cls: p.cls || 'infantry', command: !!p.command, rules: p.rules.slice(), alive: true }, extra || {});
}
const live = (u) => u.men.filter((m) => m.lost == null);

console.log('names and ranks');
const taken = {};
const rifles = unit('regular');
R.musterMen(rifles, null, taken);
ok('a squad of eight gets eight names', rifles.men.length === 8);
ok('...none repeated', new Set(rifles.men.map((m) => m.name)).size === 8);
ok('...led by a sergeant, then a corporal', rifles.men[0].rank === 'Sergeant' && rifles.men[1].rank === 'Corporal');
ok('...and the rest privates', rifles.men.slice(2).every((m) => m.rank === 'Private'));
// the rifle teams (and assault troops) by tier: 1-2 a corporal, a lance corporal and privates; 3-4 a
// sergeant, a corporal and privates; 5 a staff sergeant, a sergeant and specialists
[['recruits', 'Corporal', 'Lance Corporal', 'Private'], ['rookie', 'Corporal', 'Lance Corporal', 'Private'],
  ['regular', 'Sergeant', 'Corporal', 'Private'], ['veterans', 'Sergeant', 'Corporal', 'Private'],
  ['rangers', 'Staff Sergeant', 'Sergeant', 'Specialist'],
  // the assault troops the same
  ['lighteng', 'Corporal', 'Lance Corporal', 'Private'], ['engineers', 'Sergeant', 'Corporal', 'Private'],
  ['shock', 'Sergeant', 'Corporal', 'Private'], ['commandos', 'Staff Sergeant', 'Sergeant', 'Specialist']].forEach(([key, lead, second, rest]) => {
  const u = unit(key);
  R.musterMen(u, null, {});
  ok(u.name + ' (tier ' + u.tier + '): a ' + lead + ', a ' + second + ' and ' + rest + 's',
    u.men[0].rank === lead && u.men[1].rank === second && u.men.slice(2).every((m) => m.rank === rest), u.men.map((m) => m.rank).join(', '));
});
const cmd = unit('cmd2');
R.musterMen(cmd, null, taken);
ok('a field command is led by an officer, a senior NCO beside him', cmd.men[0].rank === 'Captain' && cmd.men[1].rank === 'Master Sergeant',
  cmd.men.slice(0, 2).map((m) => m.rank).join(', '));
const fcp = unit('flyingcp');
R.musterMen(fcp, null, taken);
ok('a flying command post is commanded by a field officer', fcp.men[0].rank === 'Major', fcp.men[0].rank);
const lcv = unit('lcv');
R.musterMen(lcv, null, taken);
ok('a crewed vehicle has one named commander, an NCO', lcv.men.length === 1 && /Corporal|Sergeant/.test(lcv.men[0].rank), lcv.men[0] && lcv.men[0].rank);
// a command or EW vehicle is in the hands of a junior officer
['cmdveh', 'ewveh'].forEach((k) => {
  const v = unit(k);
  R.musterMen(v, null, taken);
  ok('a ' + v.name + ' is commanded by a junior officer', /Lieutenant|Captain/.test(v.men[0].rank), v.men[0].rank);
});
const bug = unit('bsmall');
R.musterMen(bug, null, taken);
ok('a bug unit has no named individuals', bug.men.length === 0);
bug.models = 5;
R.syncMen(bug, 2, taken);
bug.models = 7;                        // the Endless Tide digs two back out
R.syncMen(bug, 3, taken);
bug.models = 4;
R.syncMen(bug, 4, taken);
ok('...it counts the biomass it loses, regrowth or not', bug.lostModels === 6, bug.lostModels + ' lost');
const rebels = unit('rinsurgents');
R.musterMen(rebels, null, taken);
ok('rebels are fighters under a cell leader', rebels.men[0].rank === 'Cell Leader' && rebels.men[1].rank === 'Fighter');

console.log('casualties');
rifles.models = 5;
let cas = R.syncMen(rifles, 2, taken);
ok('three models lost, three casualties', cas.length === 3 && live(rifles).length === 5);
ok('...marked with the turn', cas.every((m) => m.lost === 2));
rifles.models = 5;
ok('nothing changes when the count holds', R.syncMen(rifles, 3, taken).length === 0);
rifles.models = 7;
R.syncMen(rifles, 3, taken);
ok('models given back are fresh men', live(rifles).length === 7 && rifles.men.length === 10);
lcv.alive = false; lcv.catastrophic = true;
R.syncMen(lcv, 4, taken);
ok('the commander of a destroyed hull is a casualty', lcv.men[0].lost === 4);
const fled = unit('rookie');
R.musterMen(fled, null, taken);
fled.alive = false; fled.fled = true;
ok('a unit that fled loses nobody', R.syncMen(fled, 4, taken).length === 0);

console.log('carried on');
const back = unit('regular');
R.musterMen(back, R.survivors(rifles).slice(0, 3), taken);
ok('survivors come back, topped up to strength', back.men.length === 8 &&
  back.men.slice(0, 3).every((m, i) => m.name === R.survivors(rifles)[i].name));
ok('...and re-ranked where they stand', back.men[0].rank === 'Sergeant' && back.men[7].rank === 'Private');

console.log('a whole battle');
for (const [fa, fb] of [['pmc', 'rebel'], ['xeno', 'bugs']]) {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting', armyA: R.rollArmy(3, 1, null, fa), armyB: R.rollArmy(3, 1, null, fb),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse'
  });
  ok(fa + ' v ' + fb + ': every crewed unit is mustered by name',
    e.state().units.every((u) => Array.isArray(u.men) && (!R.crewed(u) || u.men.length > 0)));
  let steps = 0;
  while (!e.over() && steps < 4000) { if (!e.intent('A', { k: 'step' }).ok) break; steps++; }
  const rep = e.report(), st = e.state();
  ok('...the living match the models', st.units.every((u) => R.isMachine(u) || !R.crewed(u) || live(u).length === u.models));
  const infantryLost = rep.casualties.filter((c) => !c.swarm && !c.anon && !R.isMachine(R.profile(st.units.find((u) => (u.rid || u.id) === c.rid).key))).length;
  const byCount = st.units.filter((u) => !R.isMachine(u) && R.crewed(u)).reduce((a, u) => a + u.men.length - live(u).length, 0);
  ok('...the report names every man lost', rep.casualties.length > 0 && infantryLost === byCount, rep.casualties.length + ' casualties');
  ok('...each by name, rank and type', rep.casualties.every((c) => c.swarm || c.anon || (c.name && c.rank && c.type && c.turn >= 0)));
  if (fa === 'xeno') {
    const esh = st.units.filter((u) => R.profile(u.key).eshAven);
    const crocks = st.units.filter((u) => u.side === 'A' && !R.profile(u.key).eshAven && !R.isMachine(u));
    ok('...the Esh-Aven go unnamed', esh.every((u) => u.men.length === 0), esh.length + ' Esh-Aven units');
    ok('...while the Crocks are named', crocks.every((u) => u.men.length > 0));
    ok('...and an Esh-Aven loss is a count for its unit', rep.casualties.filter((c) => c.anon).every((c) =>
      !c.name && c.count === esh.find((u) => (u.rid || u.id) === c.rid).lostModels));
  }
  if (fb === 'bugs') {
    const bugs = st.units.filter((u) => u.faction === 'bugs');
    const swarm = rep.casualties.filter((c) => c.swarm);
    ok('...the swarm is never named', bugs.every((u) => u.men.length === 0) && swarm.every((c) => !c.name && !c.rank));
    ok('...its losses are counted, a line for each unit that lost any', swarm.length > 0 &&
      swarm.every((c) => c.count > 0 && c.count === bugs.find((u) => (u.rid || u.id) === c.rid).lostModels),
      swarm.reduce((n, c) => n + c.count, 0) + ' biomass');
    ok('...at least what the model counts show', bugs.every((u) => (u.lostModels || 0) >= (R.isMachine(u) ? (u.alive || u.fled ? 0 : 1) : (u.startSize || u.size) - u.models)));
  }
  ok('...and the survivors are on each line', rep.units.every((l) => Array.isArray(l.men)));
}

/* Each infantry casualty rolls a D6 after the battle: a 1 killed, 2-6
   wounded. Where a check wants one or the other, the dice are loaded. */
function dice(v, fn) { const d = R.d6; R.d6 = () => v; try { return fn(); } finally { R.d6 = d; } }

console.log('the dossier');
const camp = C.newCampaign({ mode: 'solo' });
C.found(camp.companies.A, ['recruits', 'rookie', 'lighteng'], 'S2');
C.found(camp.companies.B, ['recruits', 'rookie', 'lighteng'], 'O1');
const entry = camp.companies.A.roster.find((e) => e.key === 'rookie');
const men = [{ name: 'Ana Silva', rank: 'Corporal' }, { name: 'Kofi Park', rank: 'Private' }];
const report = {
  winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
  units: [{ rid: entry.rid, side: 'A', key: 'rookie', startSize: 8, endSize: 2, destroyed: false, brokenEver: false, wiped: false, men: men, kills: [] }],
  casualties: [{ side: 'A', rid: entry.rid, name: 'Rhys Walsh', rank: 'Sergeant', turn: 3, type: 'Rookie rifle team' }]
};
const after = dice(1, () => C.aftermath(camp, report));
ok('the survivors are written on the entry', entry.men && entry.men.length === 2 && entry.men[0].name === 'Ana Silva');
ok('...the casualties go on its history', entry.history.some((h) => /Sergeant Rhys Walsh/.test(h)));
ok('...and on the aftermath', after.sides.A.units.some((u) => (u.casualties || []).length === 1));
const u2 = unit('rookie');
C.applyEntry(u2, entry, []);
R.musterMen(u2, u2.camp.men, {});
ok('the company memorial records the casualty', (camp.companies.A.memorial || []).length === 1 &&
  camp.companies.A.memorial[0].name === 'Rhys Walsh' && camp.companies.A.memorial[0].battle === 1 &&
  camp.companies.A.memorial[0].type === 'Rookie rifle team' && !!camp.companies.A.memorial[0].against);
ok('...and only that side\'s', (camp.companies.B.memorial || []).length === 0);
ok('next battle they lead the squad', u2.men[0].name === 'Ana Silva' && u2.men[0].rank === 'Corporal' && u2.men.length === 8);

console.log('the roster');
const co = camp.companies.A;
const fresh = co.roster.find((e) => e.key === 'recruits');
delete fresh.men;
ok('an entry is named when first shown', C.menOf(fresh, co) === true && fresh.men.length === R.profile('recruits').size);
ok('...and is left alone after that', C.menOf(fresh, co) === false);
const all = co.roster.reduce((a, e) => { C.menOf(e, co); return a.concat((e.men || []).map((m) => m.name)); }, []);
ok('no name is used twice across the force', new Set(all).size === all.length);
ok('a soldier can be renamed', C.renameSoldier(fresh, 2, '  Jan   "Tank"  Novak ') && fresh.men[2].name === 'Jan "Tank" Novak');
ok('...but not to nothing', !C.renameSoldier(fresh, 2, '   ') && fresh.men[2].name === 'Jan "Tank" Novak');
ok('...and not a soldier who is not there', !C.renameSoldier(fresh, 99, 'Nobody'));
const u3 = unit('recruits');
C.applyEntry(u3, fresh, []);
R.musterMen(u3, u3.camp.men, {});
ok('the new name takes the field', u3.men[2].name === 'Jan "Tank" Novak');

console.log('the swarm in a campaign');
const hive = C.newCampaign({ mode: 'solo', factionA: 'bugs' });
hive.companies.A.faction = 'bugs';
const brood = C.newEntry('bsmall');
hive.companies.A.roster.push(brood);
ok('a bug entry has no soldiers to show', C.menOf(brood, hive.companies.A) === true && brood.men.length === 0);
const bugReport = (n) => ({
  winner: 'B', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
  units: [{ rid: brood.rid, side: 'A', key: 'bsmall', startSize: 8, endSize: 8 - n, destroyed: false, brokenEver: false, wiped: false, men: [], minSize: 8 - n, kills: [] }],
  casualties: [{ side: 'A', swarm: true, count: n, mass: n * 2, type: 'Small bugs', unit: 'Small bugs', rid: brood.rid, turn: 0 }]
});
C.aftermath(hive, bugReport(3));
C.aftermath(hive, bugReport(4));
const tally = C.biomassTally(hive.companies.A)['Small bugs'];
ok('the memorial keeps biomass by kind, not names', tally && tally.models === 7 && tally.mass === 14 &&
  hive.companies.A.memorial.length === 0, JSON.stringify(tally));
ok('...and the unit history says how much', brood.history.some((h) => /Biomass lost: 6/.test(h)));
const hs = C.lossStats(hive.companies.A)[0];
ok('...and the swarm\'s loss rate is in biomass', hs.unit === 'biomass' && hs.lost === 14 && hs.served === 30 &&
  Math.round(hs.pct * 100) === 47, hs.lost + ' of ' + hs.served + ' ' + hs.unit);
hive.companies.A.biomass = { 'Attack forms': 5 };      // an early save kept the models alone
ok('...an early tally is worked out again at Tier value', C.biomassTally(hive.companies.A)['Attack forms'].mass === 15);

console.log('biomass values');
const bm = (k, n) => n * R.biomassOf(R.profile(k));
ok('a Tier I brood of 8 is 8', bm('bspitlarva', 8) === 8);
ok('a Tier II brood of 8 is 16', bm('bsmall', 8) === 16);
ok('a Tier IV brood of 6 lost is 24', bm('boversized', 6) === 24);
ok('an Overgrown bug is 25', ['bfirebeetle', 'bsandworm', 'bbioplasma', 'bcarrier', 'bshadow', 'bqueen'].every((k) => bm(k, 1) === 25));

console.log('the loss rate');
const lc = C.newCampaign({ mode: 'solo' });
const squad = C.newEntry('rookie');
lc.companies.A.roster = [squad];
ok('nothing lost is 0%', C.lossStats(lc.companies.A)[0].pct === 0 && C.lossStats(lc.companies.A)[0].served === 8);
dice(1, () => C.aftermath(lc, {
  winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
  units: [{ rid: squad.rid, side: 'A', key: 'rookie', startSize: 8, endSize: 6, destroyed: false, brokenEver: false, wiped: false, men: [], kills: [] }],
  casualties: [0, 1].map((i) => ({ side: 'A', rid: squad.rid, name: 'Man ' + i, rank: 'Private', turn: 2, type: 'Rookie rifle team' }))
}));
const ls = C.lossStats(lc.companies.A)[0];
ok('a squad of 8 that loses 2 is 2 of 10 soldiers — 20%, not 25%', ls.lost === 2 && ls.served === 10 && ls.pct === 0.2 && ls.unit === 'soldiers',
  ls.lost + ' of ' + ls.served);
const more = C.newEntry('recruits');
lc.companies.A.roster.push(more);
C.disband(lc.companies.A, more);
const ld = C.lossStats(lc.companies.A)[0];
ok('a unit disbanded still counts as having served', ld.served === 18 && ld.lost === 2, ld.lost + ' of ' + ld.served);
const drone = C.newEntry('lcv', { drone: true });
lc.companies.A.roster.push(drone);
C.aftermath(lc, {
  winner: 'B', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
  units: [{ rid: drone.rid, side: 'A', key: 'lcv', startSize: 1, endSize: 0, destroyed: true, catastrophic: true, brokenEver: false, wiped: false, men: [], kills: [] }],
  casualties: []
});
const lz = C.lossStats(lc.companies.A)[0];
ok('a drone is not counted, served or lost', lz.served === 18 && lz.lost === 2, lz.lost + ' of ' + lz.served);
const tr = C.newEntry('xsturret3');
ok('...nor a turret', C.lossStats({ faction: 'xeno', roster: [tr], doctrines: [] }).every((l) => l.served === 0));

console.log('crews, the tribe and the infected');
// a crewed hull lost is its commander lost: one, and the hull itself is not counted
const cc = C.newCampaign({ mode: 'solo' });
const hull = C.newEntry('lcv');
cc.companies.A.roster = [hull];
ok('a crewed vehicle counts its one crewman as having served', C.lossStats(cc.companies.A)[0].served === 1);
dice(1, () => C.aftermath(cc, {
  winner: 'B', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
  units: [{ rid: hull.rid, side: 'A', key: 'lcv', startSize: 1, endSize: 0, destroyed: true, catastrophic: true, brokenEver: false, wiped: false, men: [], kills: [] }],
  casualties: [{ side: 'A', rid: hull.rid, name: 'Ivo Crane', rank: 'Commander', turn: 3, type: 'Light combat vehicle' }]
}));
const hc = C.lossStats(cc.companies.A)[0];
ok('...and when the hull is lost, its crewman is the one loss', hc.lost === 1, hc.lost + ' of ' + hc.served);

const xc = C.newCampaign({ mode: 'solo', factionA: 'xeno' });
const XA = xc.companies.A;
XA.faction = 'xeno';
const crocks = C.newEntry('xalpha3'), esh = C.newEntry('xeps3');
XA.roster = [crocks, esh];
const xs0 = C.lossStats(XA);
ok('the tribe keeps two counts, Crocks and Esh-Aven', xs0.map((l) => l.unit).join() === 'Crocks,Esh-Aven',
  xs0.map((l) => l.served + ' ' + l.unit).join(', '));
dice(1, () => C.aftermath(xc, {
  winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
  units: [
    { rid: crocks.rid, side: 'A', key: 'xalpha3', startSize: 3, endSize: 2, destroyed: false, brokenEver: false, wiped: false, men: [], kills: [] },
    { rid: esh.rid, side: 'A', key: 'xeps3', startSize: R.profile('xeps3').size, endSize: 1, destroyed: false, brokenEver: false, wiped: false, men: [], kills: [] }
  ],
  casualties: [{ side: 'A', rid: crocks.rid, name: 'Kavek', rank: 'Hunt-leader', turn: 1, type: 'Core Alpha troopers' }]
    .concat([{ side: 'A', rid: esh.rid, anon: true, count: 3, turn: 0, type: 'Core Epsilon troopers', unit: 'Core Epsilon troopers' }])
}));
const xs = C.lossStats(XA);
ok('...a Crock lost goes on the Crocks', xs[0].lost === 1 && xs[0].served === 4, xs[0].lost + ' of ' + xs[0].served);
ok('...and the Esh-Aven on their own', xs[1].lost === 3 && xs[1].served === R.profile('xeps3').size + 3, xs[1].lost + ' of ' + xs[1].served);
ok('...the Esh-Aven on the memorial as a count, not names', XA.memorial.some((m) => m.anon && m.count === 3 && !m.name));
ok('...and in the unit history', esh.history.some((h) => /Lost 3 Esh-Aven/.test(h)));
C.menOf(esh, XA);
ok('...an Esh-Aven entry has no soldiers to show', esh.men.length === 0);

ok('Infected humans are not biomass', R.biomassOf(R.profile('binfected')) === 0);
const ih = C.newCampaign({ mode: 'solo', factionA: 'bugs' });
ih.companies.A.faction = 'bugs';
const inf = C.newEntry('binfected'), sb = C.newEntry('bsmall');
ih.companies.A.roster = [inf, sb];
ok('...nor counted as having served', C.lossStats(ih.companies.A)[0].served === 16);
C.aftermath(ih, {
  winner: 'B', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
  units: [{ rid: inf.rid, side: 'A', key: 'binfected', startSize: 12, endSize: 7, destroyed: false, brokenEver: false, wiped: false, men: [], kills: [] }],
  casualties: [{ side: 'A', swarm: true, count: 5, mass: 0, type: 'Infected humans', unit: 'Infected humans', rid: inf.rid, turn: 0 }]
});
const ihs = C.lossStats(ih.companies.A)[0];
ok('...nor as biomass lost', ihs.lost === 0 && ihs.served === 16, ihs.lost + ' of ' + ihs.served);
ok('...though the memorial still shows the bodies', C.biomassTally(ih.companies.A)['Infected humans'].models === 5 &&
  C.biomassTally(ih.companies.A)['Infected humans'].mass === 0);
ok('...and its history says how many, not biomass', inf.history.some((h) => /^Lost 5\./.test(h)));

console.log('killed or wounded');
{
  const kc = C.newCampaign({ mode: 'solo' });
  const sq = C.newEntry('rookie');
  kc.companies.A.roster = [sq];
  C.menOf(sq, kc.companies.A);
  const [sgt, cpl, p1, p2] = sq.men;
  /* The sergeant rolled a 1 and was killed; the corporal and a private rolled
     3 and 6 and were wounded. Rolled once and kept on the report, so a report
     that already carries its rolls is taken as it stands. */
  const fates = [[1, 'kia'], [3, 'wounded'], [6, 'wounded']];
  const kAfter = C.aftermath(kc, {
    winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
    units: [{ rid: sq.rid, side: 'A', key: 'rookie', startSize: 8, endSize: 5, destroyed: false, brokenEver: false, wiped: false,
      men: sq.men.filter((m) => m !== sgt && m !== cpl && m !== p1).map((m) => ({ name: m.name, rank: m.rank })), kills: [] }],
    casualties: [sgt, cpl, p1].map((m, i) => ({ side: 'A', rid: sq.rid, name: m.name, rank: m.rank, turn: 2, type: 'Rookie rifle team',
      roll: fates[i][0], rolls: [fates[i][0]], fate: fates[i][1], kia: fates[i][1] === 'kia' ? 1 : 0, wounded: fates[i][1] === 'kia' ? 0 : 1 }))
  });
  const cs = kAfter.sides.A.units[0].casualties;
  ok('the report\'s rolls are kept', cs[0].fate === 'kia' && cs[1].fate === 'wounded' && cs[2].roll === 6);
  const rollOne = (v) => {
    const c1 = C.newCampaign({ mode: 'solo' }), e1 = C.newEntry('rookie');
    c1.companies.A.roster = [e1];
    return dice(v, () => C.aftermath(c1, {
      winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
      units: [{ rid: e1.rid, side: 'A', key: 'rookie', startSize: 8, endSize: 7, destroyed: false, brokenEver: false, wiped: false, men: [], kills: [] }],
      casualties: [{ side: 'A', rid: e1.rid, name: 'Una Marsh', rank: 'Private', turn: 1, type: 'Rookie rifle team' }]
    })).sides.A.units[0].casualties[0];
  };
  ok('a D6 of 1 is killed in action', [1].every((v) => { const c = rollOne(v); return c.fate === 'kia' && c.roll === v; }));
  ok('...and 2-6 wounded', [2, 3, 4, 5, 6].every((v) => { const c = rollOne(v); return c.fate === 'wounded' && c.roll === v; }));
  const mem = kc.companies.A.memorial;
  ok('the killed and the wounded both go on the field hospital\'s list', mem.length === 3 &&
    mem[0].name === sgt.name && mem[0].fate === 'kia' && mem[1].fate === 'wounded' && mem[2].fate === 'wounded', JSON.stringify(mem.map((m) => m.fate)));
  ok('the wounded are out for the campaign, not back in the ranks', sq.men.length === 5 &&
    !sq.men.some((m) => m.name === cpl.name || m.name === p1.name || m.name === sgt.name) && sq.men[0].name === p2.name,
    sq.men.map((m) => m.name).join(', '));
  ok('...and the history says who was which', sq.history.some((h) => h.indexOf('Killed in action: ' + sgt.rank + ' ' + sgt.name) >= 0 &&
    h.indexOf('Wounded, out for the campaign: ' + cpl.rank + ' ' + cpl.name) >= 0));
  const ks = C.lossStats(kc.companies.A)[0];
  ok('the loss rate splits killed from wounded: 1 and 2 of 11', ks.lost === 1 && ks.wounded === 2 && ks.served === 11 &&
    Math.round(ks.wpct * 1000) === 182, JSON.stringify(ks));

  // a vehicle's crewman rolls as a soldier does
  const vc2 = C.newCampaign({ mode: 'solo' });
  const hv = C.newEntry('lcv');
  vc2.companies.A.roster = [hv];
  dice(6, () => C.aftermath(vc2, {
    winner: 'B', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
    units: [{ rid: hv.rid, side: 'A', key: 'lcv', startSize: 1, endSize: 0, destroyed: true, catastrophic: true, brokenEver: false, wiped: false, men: [], kills: [] }],
    casualties: [{ side: 'A', rid: hv.rid, name: 'Ivo Crane', rank: 'Corporal', turn: 3, type: 'Light combat vehicle' }]
  }));
  ok('a crewman lost with the hull rolls too: a 6 is wounded', C.lossStats(vc2.companies.A)[0].lost === 0 && C.lossStats(vc2.companies.A)[0].wounded === 1 &&
    vc2.companies.A.memorial.length === 1 && vc2.companies.A.memorial[0].fate === 'wounded');

  // the Esh-Aven roll one by one, and only the dead are counted on the memorial
  const xk = C.newCampaign({ mode: 'solo', factionA: 'xeno' });
  xk.companies.A.faction = 'xeno';
  const ek = C.newEntry('xeps3');
  xk.companies.A.roster = [ek];
  dice(4, () => C.aftermath(xk, {
    winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: false },
    units: [{ rid: ek.rid, side: 'A', key: 'xeps3', startSize: R.profile('xeps3').size, endSize: 2, destroyed: false, brokenEver: false, wiped: false, men: [], kills: [] }],
    casualties: [{ side: 'A', rid: ek.rid, anon: true, count: 4, turn: 0, type: 'Core Epsilon troopers', unit: 'Core Epsilon troopers' }]
  }));
  const xl = C.lossStats(xk.companies.A)[1];
  ok('a counted unit rolls for each of its casualties', xl.lost === 0 && xl.wounded === 4 && xl.served === R.profile('xeps3').size + 4 &&
    xk.companies.A.memorial.length === 1 && xk.companies.A.memorial[0].wounded === 4, JSON.stringify(xl));
  ok('...the Esh-Aven are killed or wounded, not ascended', ek.history.some((h) => /Lost 4 Esh-Aven \(0 killed, 4 wounded\)/.test(h)) &&
    C.fateWords(xk.companies.A, 'eshaven').kia === 'killed' && C.fateWords(xk.companies.A, 'crocks').kia === 'ascended', ek.history.join(' | '));
  ok('...and the tribe calls its Crocks ascended and scarred', C.words(xk.companies.A).kia === 'ascended' && C.words(xk.companies.A).wia === 'scarred' &&
    C.words(xk.companies.A).memorial === 'Temple');
  ok('a company keeps a field hospital, the swarm its biomass', C.words(kc.companies.A).memorial === 'Field hospital' &&
    C.words({ faction: 'rebel' }).memorial === 'Field hospital' && C.words({ faction: 'bugs' }).memorial === 'Biomass');
}

console.log('drones go unnamed');
{
  const dc = C.newCampaign({ mode: 'solo' });
  const ds = C.newEntry('dcombat');
  ds.men = [{ name: 'Old Name', rank: 'Private' }];     // named by an older version
  dc.companies.A.roster = [ds];
  C.menOf(ds, dc.companies.A);
  ok('a drone squad has no soldiers to show', ds.men.length === 0);
  const du = unit('dcombat');
  R.musterMen(du, [], {});
  ok('...nor any on the table', du.men.length === 0);
}

console.log('experience');
const vc = C.newCompany('Vets');
vc.roster = ['recruits', 'enforcers', 'irregulars', 'rookie', 'regular', 'veterans', 'lighteng', 'engineers', 'lpv', 'cmd3'].map((k) => C.newEntry(k));
vc.roster[4].honours = [3, 7];
vc.roster[5].honours = [2];
const vs = C.experienceStats(vc);
ok('10 units, one with two honours and one with one, is 30% honours', vs.pct === 0.3 && vs.word === 'honours' &&
  vs.honours === 3 && vs.units === 10, (vs.pct * 100) + '% ' + vs.word);
ok('a revolt calls it honours too', C.experienceStats(C.newCompany('R', { faction: 'rebel' })).word === 'honours');
ok('the swarm calls it adaptations', (() => {
  const b = C.newCompany('S', { faction: 'bugs' }); b.roster = [C.newEntry('bsmall')]; b.roster[0].honours = [1];
  const st = C.experienceStats(b); return st.word === 'adaptations' && st.noun === 'Adaptation' && st.pct === 1;
})());
ok('the tribe calls it rites', (() => {
  const st = C.experienceStats(C.newCompany('T', { faction: 'xeno' })); return st.word === 'rites' && st.noun === 'Rites' && st.pct === 0;
})());

console.log('trauma');
vc.roster[0].traumas = [4];
const ts = C.traumaStats(vc);
ok('one Battle Trauma across 10 units is 10% trauma', ts.pct === 0.1 && ts.word === 'trauma' && ts.noun === 'Battle Trauma', (ts.pct * 100) + '% ' + ts.word);
ok('the swarm calls it flaws, of Genetic Flaws', (() => {
  const b = C.newCompany('S', { faction: 'bugs' }); b.roster = [C.newEntry('bsmall'), C.newEntry('battack')]; b.roster[0].traumas = [1, 2];
  const st = C.traumaStats(b); return st.word === 'flaws' && st.noun === 'Genetic Flaws' && st.pct === 1;
})());
ok('the tribe calls it infamy, of Infamies', C.traumaStats(C.newCompany('T', { faction: 'xeno' })).word === 'infamy');

console.log('win rate');
vc.record = { battles: 5, wins: 3, draws: 1, losses: 1 };
const wr = C.winStats(vc);
ok('3 won of 5 fought is 60% — a draw is fought, not won', wr.pct === 0.6 && wr.wins === 3 && wr.battles === 5);
ok('no battles yet is 0%', C.winStats(C.newCompany('New')).pct === 0);

/* A command squad that goes up a grade with the company takes its new ranks
   at once, and every soldier keeps his name, renamed or not. */
{
  const co = C.newCompany('Rankers');
  C.found(co, ['recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'regular', 'regular'], 'T5');
  const cmd = C.byRid(co, co.cmdRid);
  const u0 = Object.assign({}, R.profile(cmd.key), { key: cmd.key, faction: 'pmc', models: R.profile(cmd.key).size, rules: R.profile(cmd.key).rules.slice() });
  cmd.men = R.musterMen(u0, null, {}).map((m) => ({ name: m.name, rank: m.rank }));
  C.renameSoldier(cmd, 0, 'Dana Voss');
  const second = cmd.men[1].name;
  ok('a new company\'s command squad is a Second Lieutenant and a Sergeant', cmd.men[0].rank === 'Second Lieutenant' && cmd.men[1].rank === 'Sergeant',
    cmd.men.map((m) => m.rank).join(', '));
  co.tier = 2; C.fitCommand(co);
  ok('at the company\'s Tier II its command is the 3rd grade', cmd.key === 'cmd3', cmd.key);
  ok('...its officer a Lieutenant now, still named as the player renamed him', cmd.men[0].rank === 'Lieutenant' && cmd.men[0].name === 'Dana Voss',
    cmd.men[0].rank + ' ' + cmd.men[0].name);
  ok('...and the Sergeant a Staff Sergeant, his name unchanged', cmd.men[1].rank === 'Staff Sergeant' && cmd.men[1].name === second,
    cmd.men[1].rank + ' ' + cmd.men[1].name);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
