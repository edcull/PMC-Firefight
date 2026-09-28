/* What a campaign unit rides: the Riders upgrade for the Holy Warriors and the
   First Among Equals, and a motorbike, grav bike or horse for anyone who rides.
   It is kept on the dossier entry, counted in its strength, and goes into the
   battle with the unit. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

console.log('\nThe dossier entry');
const co = C.newCompany('Revolt', { faction: 'rebel' });
const fan = C.newEntry('rfanatics', { riders: true, mount: 'horse' });
ok('keeps the Riders upgrade and the mount', fan.riders === true && fan.mount === 'horse');
ok('...and hands them on as its army pick', R.entryPick(fan) === 'rfanatics:riders:horse', R.entryPick(fan));
ok('mounted, it fields half its men', C.strengthOf(fan, co) === Math.round(R.CATALOGUE.find(p => p.key === 'rfanatics').size / 2), String(C.strengthOf(fan, co)));
const gang = C.newEntry('rridergang', { mount: 'gravbike' });
ok('a Mounted Warriors unit rides whatever it is given, with no upgrade to take', R.entryPick(gang) === 'rridergang:gravbike', R.entryPick(gang));
const foot = C.newEntry('rfanatics', { mount: 'horse' });
ok('on foot, a mount means nothing', R.entryPick(foot) === 'rfanatics', R.entryPick(foot));
const rif = C.newEntry('rinsurgents', { riders: true, mount: 'bike' });
ok('a unit that cannot take the upgrade does not ride', R.entryPick(rif) === 'rinsurgents', R.entryPick(rif));

console.log('\nFounding a revolt');
const co2 = C.newCompany('Revolt', { faction: 'rebel' });
C.found(co2, ['rfanatics:riders:gravbike', 'rridergang:horse'], null);
const f2 = co2.roster.find(e => e.key === 'rfanatics'), g2 = co2.roster.find(e => e.key === 'rridergang');
ok('the founding keeps what each unit rides', f2 && f2.riders && f2.mount === 'gravbike' && g2 && g2.mount === 'horse');

console.log('\nIn the battle');
const e = Engine.create();
e.start({
  tier: 3, pl: 1, scenario: 'meeting', mode: 'hotseat', planet: 'barren',
  armyA: [R.entryPick(f2), R.entryPick(g2), 'rinstigators:riders:bike'], armyB: R.rollArmy(3, 1, null, 'pmc'),
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel'
});
const us = e.state().units.filter(u => u.side === 'A');
const uf = us.find(u => u.key === 'rfanatics'), ug = us.find(u => u.key === 'rridergang'), ui = us.find(u => u.key === 'rinstigators');
ok('the Fanatics ride grav bikes', uf && uf.riders && uf.mount === 'gravbike', uf && (uf.riders + ' ' + uf.mount));
ok('...at -1 Defence for it', uf && uf.def === R.CATALOGUE.find(p => p.key === 'rfanatics').def - 1, uf && String(uf.def));
ok('the Rider gang rides horses', ug && ug.mount === 'horse', ug && ug.mount);
ok('the Instigators ride motorbikes', ui && ui.riders && ui.mount === 'bike', ui && (ui.riders + ' ' + ui.mount));

console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
