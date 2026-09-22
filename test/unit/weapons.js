/* What each unit shoots with. The book gives no weapon types, only a Firepower
   and a Range, so `rules.js` carries an explicit table: every profile is named,
   and the name decides what you see and hear. This checks that table against
   what each unit is — a tank fires a shell and its coaxial, a mortar section
   lobs one round where a battery lobs three, a Gauss weapon draws a line.
*/
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '\u2713' : '\u2717') + ' ' + name.padEnd(46) + (note || ''));
}
function head(t) { console.log('\n' + t); }
function spec(key) {
  var p = R.profile(key);
  if (!p) throw new Error('no such profile: ' + key);
  return R.weaponSpec(p);
}
function fmt(w) { return w.p + (w.s ? ' + ' + w.s : '') + (w.n > 1 ? ' \u00d7' + w.n : ''); }
// `want` is "primary", "primary+secondary" or "primary xN"
function is(key, want) {
  var w = spec(key), got = fmt(w).replace(' + ', '+').replace(' \u00d7', ' x');
  ok(R.profile(key).name, got === want, got === want ? got : 'wanted ' + want + ', got ' + got);
}
function all(keys, want) { keys.forEach(function (k) { if (R.profile(k)) is(k, want); }); }

head('Flamethrowers');
is('chem', 'flame');
// the engineering hull keeps a gun behind its flame projector
is('lengveh', 'flame+chain');

head('Gauss weapons draw a line');
// the marksmen keep a sidearm for anything that gets close
is('lrrp', 'rail x2');
is('snipers', 'rail+pistol');
// a crew-served cannon puts three down where a marksman's rifle fires one
is('gausscannon', 'rail x3');
// the miners' las-cutters are a Gauss Weapon too (p. 102), fired in pairs
all(['rminers', 'rfaceminers', 'rharshminers'], 'rail x2');

head('Guided missiles');
is('raa', 'missile x2');
// the launcher teams put a pair in the air
all(['sam', 'missile'], 'missile x2');
// air defence hulls put the gun up first and the missiles off the rails after
is('aaveh', 'missile+chain x2');
is('interceptor', 'burst+shellbig');


head('Rockets, over the guns that fire with them');
is('gunboat', 'chain+rocket');
is('hsc', 'missile+rocket x3');
is('asc', 'shellbig+rail x3');

head('Direct projectiles');
all(['lightat', 'atteam', 'rat'], 'shell');
is('lhunter', 'missile x2');
is('hunter', 'missile x3');

// a sniper commando's rifle hits like an anti-tank round, and is drawn like one
is('rsnipercdo', 'shell+pistol');
is('ldestroyer', 'shellbig x2');
is('mdestroyer', 'shellbig+rail x2');
/* The combat hulls fire the main gun in quick succession, over whatever the
   crew has in the hatch. */
is('mcv', 'shellbig+pistol x2');
is('acv', 'shellbig+rail x3');
is('hengveh', 'shell+rail x3');

head('Arcing projectiles, and how many tubes fire at once');
// support hulls fire in batteries: two tubes, then three
is('impsupport', 'rocket');
is('lsupport', 'arcbig x3');
is('msupport', 'arcbig+arcbig x5');
// the advanced support hull's heavy plasma cannon: four bolts, each bursting
is('asupport', 'orbbig x3');
is('mortarsection', 'arc');
is('mortarteam', 'arc x2');
is('mortarbattery', 'arc x3');
is('rlightart', 'arcbig');
is('rmedart', 'arcbig x2');
is('rheavyart', 'arcbig x3');

head('Autocannon');
all(['hpv', 'hmgteam', 'rautocannon'], 'chain');
is('lifv', 'chain+missile');
is('hifv', 'missile+chain x2');
// the heavy autocannon squad puts three heavy rounds through its own fire
is('rheavyac', 'chain+shellbig');
// the guard have carbines through the ranks as well as rifles
is('rguard', 'small+smg');
// so do the hellriders, across the saddle, and they ride in throwing
is('rhellriders', 'smg+arc');
is('rlegendary', 'chain+arc');
is('rlflak', 'burst');
is('rmflak', 'burst+burst');
// every heavy infantry unit, whatever its Tier
all(['ecobats', 'bats'], 'smg');

is('lcv', 'shell+pistol x2');

head('And a soft-skinned lorry has only its crew');
// a soft-skinned lorry has no gun: what shoots is whoever is in the cab
is('unarmoured', 'pistol');
is('ltransport', 'smg');
all(['lapc', 'hapc'], 'small');
// a command vehicle is a staff car with an antenna farm, not a gun platform
is('cmdveh', 'small');
// the same for the signals and ambulance hulls
all(['ewveh', 'medveh'], 'small');

head('A transport aircraft has a door gun, not a weapon');
all(['adaptedcraft', 'lightcraft', 'heavycraft', 'flyingcp'], 'small');
// and the same for a captured patrol craft
is('rpatrol', 'small');
// every armed shuttle carries a proper door cannon
is('rlshuttle', 'burst');
all(['rmshuttle', 'rhshuttle'], 'chain');

head('The rebels weld what they have onto what they can drive');
// a pickup with the crew's own rifles
is('rtechnical', 'small');
// a gun-truck with a rocket rack bolted over its machine gun
is('ricv', 'chain+rocket');
// a proper autocannon, and at the top a rocket rack over one
is('rlicv', 'chain');
is('rhicv', 'shellbig+rocket x2');
is('rltv', 'small');
is('ritv', 'chain');
// the super-heavy and the heavy flak carry a gun behind the autocannon
is('rshtv', 'chain+shell');
is('rhflak', 'chain+burst');

head('Machine guns');
is('rlmg', 'burst');
is('lmgsection', 'smg+burst');
// the MG team has a carbine in the section alongside the gun
is('lmgteam', 'smg+burst');
is('tsc', 'burst+rocket');
// the flexible strike craft carries a rocket rack over its door gun
is('fsc', 'small+rocket');
// a patrol jeep has the crew's rifles; the heavy one mounts a machine gun
is('lpv', 'small');
is('hpv', 'chain');
is('recon', 'shell+pistol');

head('Close-quarters automatics');
is('enforcers', 'smg');
all(['lighteng', 'engineers'], 'smg');
// assault troops go in with a carbine and a pair of charges (p. 64)
all(['shock', 'commandos'], 'arc+smg x2');
// the Protectors do the same, behind three of them
all(['protectors', 'protectorshm'], 'arc+smg x3');
// irregulars scavenge carbines, and the Holy Warriors go in close with them
is('irregulars', 'smg');
all(['racolytes', 'rfanatics'], 'smg');
// POWs took whatever their guards were carrying
is('rpow', 'smg');
// the partisan commandos work in pairs: a carbine and a rifle
all(['rassaultcdo', 'rsabcdo'], 'small+smg');
// the rider gangs come past with a carbine in one hand and charges in the other
all(['rridergang', 'rriderwar'], 'smg+arc');

head('And a rifle is still a rifle');
all(['recruits', 'rookie', 'regular'], 'small');
// the senior rifle teams have carbines in the squad alongside the rifles
all(['veterans', 'rangers'], 'small+smg');
is('nomads', 'small');
// the scouts carry a sidearm and one heavy shot between them
all(['observers', 'sharpshooters'], 'shell+pistol');

head('And a sidearm is not a rifle');
// Firepower 1 at 12": command, medics and signallers are defending themselves
all(['cmd4', 'cmd3', 'cmd2', 'cmd1', 'highcmd'], 'pistol');
all(['ew', 'medics'], 'pistol');
// penal troops are issued a sidearm and a shovel
is('penal', 'pistol');
// armed civilians: whatever was in the house
is('rciv', 'pistol');

// the militia and the instigators beside them did find rifles
all(['rmilitia', 'rinsurgents', 'rinstigators'], 'small');
// and the senior leaders have a bodyguard with carbines around them
all(['rinfluential', 'rrebellion'], 'small+smg');

head('What has no gun at all');
all(['insertplat', 'rlifter'], 'none');

head('Nothing falls through');
var kinds = {};
var bad = [];
var KNOWN = ['pistol','small','smg','burst','chain','shell','shellbig','arc','arcbig','missile','rocket','flame','rail','spit','spitbig','spine','energy','orb','orbbig','none'];
R.CATALOGUE.forEach(function (p) {
  var w = R.weaponSpec(p);
  if (KNOWN.indexOf(w.p) < 0) bad.push(p.name + ' \u2192 ' + w.p);
  if (w.s && KNOWN.indexOf(w.s) < 0) bad.push(p.name + ' secondary \u2192 ' + w.s);
  kinds[w.p] = (kinds[w.p] || 0) + 1;
});
ok('every profile names a style this game can draw', !bad.length,
  bad.join(', ') || Object.keys(kinds).length + ' styles in use');
ok('every profile in the book is in the table', R.CATALOGUE.every(function (p) {
  return !!R.WEAPONS[p.key];
}), R.CATALOGUE.filter(function (p) { return !R.WEAPONS[p.key]; })
  .map(function (p) { return p.name; }).join(', ') || 'all ' + R.CATALOGUE.length);
ok('a unit with no Firepower has no weapon',
  R.weaponSpec({ key: 'x', name: 'x', fp: null, rules: [] }).p === 'none');
ok('a missing unit is not an error', R.weaponSpec(null).p === 'small');

/* A unit is not a profile: the battle builds it, and a campaign can change what
   it carries. The table is keyed on the profile, so the style has to survive. */
head('It holds on a built unit, not just a profile');
function build(key, extra) {
  var p = R.profile(key);
  return Object.assign({}, p, {
    rules: p.rules.slice().concat(extra || []), side: 'A', alive: true, sp: 0, x: 1, y: 1
  });
}
ok('a rifle team that earns a Battle Honour still fires a rifle',
  R.weaponStyle(build('regular', ['Marksmen'])) === 'small');
ok('a support vehicle still lobs with a propulsion under it',
  R.weaponStyle(R.applyPropulsion(build('msupport'), 'tracked')) === 'arcbig');
ok('an autocannon hull keeps hammering whatever drives it',
  R.weaponStyle(R.applyPropulsion(build('hpv'), 'hover')) === 'chain');
ok('a suppressed MG team fires the same way',
  R.weaponStyle(Object.assign(build('lmgteam'), { sp: 9 })) === 'smg');
/* A vehicle built as a drone (p. 37) has no crew, but it is the same hull with
   the same gun — a support drone still lobs, an assault drone still hammers. */
ok('a support vehicle flown as a drone still lobs',
  R.weaponStyle(R.applyDrone(build('msupport'), true)) === 'arcbig');
ok('a combat vehicle flown as a drone still hammers',
  R.weaponStyle(R.applyDrone(build('hpv'), true)) === 'chain');

/* A profile the table has never heard of still has to fire like something. */
head('An unlisted profile is read from the rules it carries');
function guess(rules, extra) {
  return R.weaponStyle(Object.assign({ key: 'nosuch', name: (extra && extra.name) || 'Test unit',
    fp: 4, cls: (extra && extra.cls) || 'infantry', rules: rules }, extra || {}));
}
ok('Indirect Fire lobs', guess(['Indirect Fire']) === 'arc');
ok('a Gauss Weapon draws a line', guess(['Gauss Weapon']) === 'rail');
ok('a Destructive Weapon on a hull is a big gun',
  guess(['Destructive Weapon'], { cls: 'vehicle' }) === 'shellbig');
ok('and on a squad it is a charge', guess(['Destructive Weapon']) === 'shell');
ok('anything else is a rifle', guess([]) === 'small');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
