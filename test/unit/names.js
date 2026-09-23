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
const cmd = unit('cmd2');
R.musterMen(cmd, null, taken);
ok('a field command is led by an officer', cmd.men[0].rank === 'Major', cmd.men[0].rank);
const lcv = unit('lcv');
R.musterMen(lcv, null, taken);
ok('a crewed vehicle has one named commander', lcv.men.length === 1 && lcv.men[0].rank === 'Commander');
const bug = unit('bsmall');
R.musterMen(bug, null, taken);
ok('a bug gets a brood designation', /-\d+$/.test(bug.men[1].name) && bug.men[1].rank === 'Drone');
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
  ok('...the living match the models', st.units.every((u) => R.isMachine(u) || live(u).length === u.models));
  const infantryLost = rep.casualties.filter((c) => !R.isMachine(R.profile(st.units.find((u) => (u.rid || u.id) === c.rid).key))).length;
  const byCount = st.units.filter((u) => !R.isMachine(u)).reduce((a, u) => a + u.men.length - live(u).length, 0);
  ok('...the report names every man lost', rep.casualties.length > 0 && infantryLost === byCount, rep.casualties.length + ' casualties');
  ok('...each by name, rank and type', rep.casualties.every((c) => c.name && c.rank && c.type && c.turn >= 0));
  ok('...and the survivors are on each line', rep.units.every((l) => Array.isArray(l.men)));
}

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
const after = C.aftermath(camp, report);
ok('the survivors are written on the entry', entry.men && entry.men.length === 2 && entry.men[0].name === 'Ana Silva');
ok('...the casualties go on its history', entry.history.some((h) => /Sergeant Rhys Walsh/.test(h)));
ok('...and on the aftermath', after.sides.A.units.some((u) => (u.casualties || []).length === 1));
const u2 = unit('rookie');
C.applyEntry(u2, entry, []);
R.musterMen(u2, u2.camp.men, {});
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
