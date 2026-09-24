/* The campaign rules against the book (pp. 83-91): the tables, the economy,
   promotion legality, the EXP and TP ledgers, salvage, and a long run of
   simulated campaign turns to see that nothing drifts illegal or unbounded. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
require('../../src/rules/scenarios.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(52) +
    String(got).padEnd(12) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

/* ---------------------------------------------------------------- tables */
head('The tables, as printed');
ok('18 doctrines', C.DOCTRINES.length, 18);
ok('...six in each category', C.CATEGORIES.map(function (c) {
  return C.DOCTRINES.filter(function (d) { return d.cat === c; }).length;
}).join('/'), '6/6/6');
ok('20 Battle Honours', C.HONOURS.length, 20);
ok('10 Battle Traumas', C.TRAUMAS.length, 10);
ok('10 vehicle Upgrades', C.UPGRADES.length, 10);
ok('every honour numbered in order', C.HONOURS.every(function (h, i) { return h.n === i + 1; }), true);
ok('every honour does something', C.HONOURS.every(function (h) { return h.mod || h.rule || h.flag; }), true);
ok('every trauma does something', C.TRAUMAS.every(function (t) { return t.mod || t.rule || t.flag; }), true);
ok('every upgrade does something', C.UPGRADES.every(function (g) { return g.mod || g.rule || g.flag; }), true);
ok('recruitment 1/4/8/16/32', [1, 2, 3, 4, 5].map(function (t) { return C.RECRUIT_COST[t]; }).join('/'), '1/4/8/16/32');
ok('company promotion 1/20/80/200', [2, 3, 4, 5].map(function (t) { return C.COMPANY_COST[t]; }).join('/'), '1/20/80/200');

/* ------------------------------------------------------------- founding */
head('Founding a company (p. 83)');
function start(keys, doctrine) {
  var co = C.newCompany('Test PMC');
  C.found(co, keys || ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured',
    'rookie', 'lighteng'], doctrine || 'S2');
  return co;
}
var co = start();
ok('six Tier I and two Tier II is legal', C.foundingCheck(co).ok, true);
ok('...and the field command comes free', C.byRid(co, co.cmdRid).key, 'cmd4');
ok('...it is marked free', C.byRid(co, co.cmdRid).free, true);
ok('nine entries in all', co.roster.length, 9);
var short = start(['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'rookie', 'lighteng']);
ok('five Tier I units is not', C.foundingCheck(short).ok, false,
  C.foundingCheck(short).faults[0]);
var tooMany = start(['lpv', 'unarmoured', 'recruits', 'irregulars', 'enforcers', 'mortarsection',
  'rookie', 'impsupport']);
ok('three vehicles at founding is refused',
  C.foundingCheck(tooMany).faults.some(function (f) { return /two vehicles/.test(f); }), true);
var nodoc = C.newCompany('No doctrine');
C.found(nodoc, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], null);
ok('no doctrine is refused', C.foundingCheck(nodoc).ok, false, C.foundingCheck(nodoc).faults[0]);

/* ------------------------------------------------------------ doctrines */
head('Doctrines (pp. 87-88)');
var dc = start();
ok('one slot at Tier I', C.doctrineSlots(dc), 1);
ok('...so a second is refused', C.canTakeDoctrine(dc, 'S4').ok, false,
  C.canTakeDoctrine(dc, 'S4').why);
dc.tier = 3; dc.doctrines = ['S2', 'S4'];
ok('two Strategic held — a third is refused', C.canTakeDoctrine(dc, 'S1').ok, false,
  C.canTakeDoctrine(dc, 'S1').why);
ok('...but an Operational one is fine', C.canTakeDoctrine(dc, 'O3').ok, true);
ok('a doctrine already held is refused', C.canTakeDoctrine(dc, 'S2').ok, false);

/* ----------------------------------------------------------- promotion */
head('Unit promotion (pp. 85-86)');
function entryFor(key, opts) { return C.newEntry(key, opts); }
function names(list) { return list.map(function (p) { return p.name; }).join(', '); }

var rifle = entryFor('regular');                       // Tier III Rifle infantry
var rt = C.promotionTargets(rifle);
ok('a regular rifle team promotes within its group',
  rt.every(function (q) { return q.group === 'Rifle infantry'; }), true, names(rt));
ok('...to the same or the next Tier only',
  rt.every(function (q) { return q.tier === 3 || q.tier === 4; }), true);
ok('9 EXP and 4 kUC for a Tier III promotion',
  JSON.stringify(C.promotionCost(rifle, 'regular')), '{"exp":9,"kUC":4}');
ok('12 EXP and 8 kUC for a Tier IV one',
  JSON.stringify(C.promotionCost(rifle, 'veterans')), '{"exp":12,"kUC":8}');

var rec = entryFor('recruits');
var rg = {};
C.promotionTargets(rec).forEach(function (q) { rg[q.group] = 1; });
ok('Recruits reach rifle, heavy, light support and mortars',
  Object.keys(rg).sort().join(','), 'Heavy infantry,Light support,Remote mortars,Rifle infantry');
var enf = {};
C.promotionTargets(entryFor('enforcers')).forEach(function (q) { enf[q.group] = 1; });
ok('Enforcers only reach Heavy infantry', Object.keys(enf).join(','), 'Heavy infantry');
var irr = {};
C.promotionTargets(entryFor('irregulars')).forEach(function (q) { irr[q.group] = 1; });
ok('Irregulars reach assault, light support and light infantry',
  Object.keys(irr).sort().join(','), 'Assault troops,Light infantry,Light support');
ok('Unclassified troops never promote', C.promotionTargets(entryFor('chem')).length, 0);
ok('vehicles never promote', C.promotionTargets(entryFor('lcv')).length, 0);
ok('Command Units never promote', C.promotionTargets(entryFor('cmd2')).length, 0);
ok('Penal troops stay Basic troops',
  C.promotionTargets(entryFor('penal')).every(function (q) { return q.group === 'Basic troops'; }), true);
ok('...and pay no money to promote', C.promotionCost(entryFor('penal'), 'irregulars').kUC, 0);
ok('Light support may become Heavy support',
  C.promotionTargets(entryFor('lmgteam')).some(function (q) { return q.group === 'Heavy support'; }), true);
ok('...but Heavy support may not go back',
  C.promotionTargets(entryFor('atteam')).some(function (q) { return q.group === 'Light support'; }), false);

var alco = entryFor('regular'); alco.traumas = [1];
ok('Alcoholics doubles the EXP cost', C.promotionCost(alco, 'veterans').exp, 24);
var badrep = entryFor('regular'); badrep.traumas = [2];
ok('Bad Reputation blocks promotion outright', C.promotionTargets(badrep).length, 0);

var pco = start(); pco.kUC = 50;
var pe = C.byRid(pco, pco.roster[1].rid); pe.key = 'regular'; pe.name = 'Kowalski\'s Lads'; pe.exp = 20;
pe.honours = [4]; pe.traumas = [5];
ok('a Tier I company cannot take a unit to Tier IV', C.promoteUnit(pco, pe, 'veterans').ok, false);
pco.tier = 3;                                     // promotions reach one Tier over the Company Tier (p. 84)
var pr = C.promoteUnit(pco, pe, 'veterans');
ok('a promotion goes through', pr.ok, true);
ok('...spends the EXP', pe.exp, 8);
ok('...spends the money', pco.kUC, 42);
ok('...changes the profile', pe.key, 'veterans');
ok('...keeps the rid, honours and traumas',
  pe.honours.join() + '|' + pe.traumas.join(), '4|5');
ok('...and keeps a name the player chose', pe.name, "Kowalski's Lads");

/* ------------------------------------------------------------- honours */
head('Battle Honours (p. 88)');
var h = entryFor('rookie');                            // Tier II -> cap 3
ok('the cap is Unit Tier + 1', C.honourCap(h), 3);
ok('10 EXP normally', C.honourCost(h, start()), 10);
var s6 = start(); s6.doctrines = ['S6'];
ok('...5 for the first under Rapid Training Methods', C.honourCost(h, s6), 5);
h.honours = [1];
ok('...and 10 for the second', C.honourCost(h, s6), 10);
h.honours = [];
h.exp = 4;
ok('four EXP is not enough', C.canTakeHonour(h, start()).ok, false);
h.exp = 12;
ok('twelve is', C.canTakeHonour(h, start()).ok, true);
ok('the draw offers three', C.drawHonours(h).length, 3);
ok('...all of them new', (function () {
  var e = entryFor('regular');
  e.honours = C.HONOURS.slice(0, 17).map(function (x) { return x.n; });
  var d = C.drawHonours(e);
  return d.length === 3 && d.every(function (x) { return e.honours.indexOf(x.n) < 0; });
})(), true);
ok('Rail Gun Specialists is barred from a mortar team',
  C.availableHonours(entryFor('mortarteam')).some(function (x) { return x.n === 14; }), false);
ok('...but offered to a rifle team',
  C.availableHonours(entryFor('regular')).some(function (x) { return x.n === 14; }), true);
var capped = entryFor('rookie'); capped.honours = [1, 2, 3]; capped.exp = 99;
ok('a unit at its cap takes no more', C.canTakeHonour(capped, start()).ok, false,
  C.canTakeHonour(capped, start()).why);
ok('Penal troops take none at all', C.canTakeHonour(entryFor('penal'), start()).ok, false);
ok('vehicles take none either', C.canTakeHonour(entryFor('lcv'), start()).ok, false);

/* ------------------------------------------------------------ upgrades */
head('Vehicle and aircraft Upgrades (p. 89)');
var v = entryFor('lcv'); v.exp = 10;
ok('the cap is Tier + 1', C.upgradeCap(v), 4);
ok('a ground vehicle may take one', C.canTakeUpgrade(v).ok, true);
ok('Advanced Emergency Systems is aircraft only',
  C.availableUpgrades(entryFor('lcv')).some(function (g) { return g.n === 1; }), false);
ok('...and offered to a strike craft',
  C.availableUpgrades(entryFor('fsc')).some(function (g) { return g.n === 1; }), true);
ok('Automated Defence Systems is ground only',
  C.availableUpgrades(entryFor('fsc')).some(function (g) { return g.n === 2; }), false);
ok('infantry take no upgrades', C.canTakeUpgrade(entryFor('regular')).ok, false);

/* ------------------------------------------------------------- effects */
head('What honours, traumas and upgrades do to a unit');
function eff(key, o) { var e = entryFor(key); Object.keys(o).forEach(function (k) { e[k] = o[k]; }); return C.effects(e); }
ok('Amazing Stamina is +1 Move', eff('regular', { honours: [4] }).move, 1);
ok('Runners is a flag, not a parameter', eff('regular', { honours: [15] }).flags.runners, true);
ok('Shooting Experts is +1 Firepower', eff('regular', { honours: [8] }).fp, 1);
ok('Superior Ballistic Skills is +6" Range', eff('regular', { honours: [18] }).range, 6);
ok('Rippers is +2 Assault', eff('regular', { honours: [13] }).assault, 2);
ok('Into the Shadows grants Stealth', eff('regular', { honours: [5] }).rules.join(), 'Stealth');
ok('Cowards is -1 Morale', eff('regular', { traumas: [5] }).morale, -1);
ok('two honours stack', eff('regular', { honours: [4, 8] }).move + '/' +
  eff('regular', { honours: [4, 8] }).fp, '1/1');
ok('Reinforced Armour is +2 Defence', eff('lcv', { upgrades: [8] }).def, 2);
ok('Improved Engines is +2 on a tank', eff('lcv', { upgrades: [7] }).move, 2);
ok('...and +4 on an aircraft', eff('fsc', { upgrades: [7] }).move, 4);
ok('Tank Hunter grants Anti-tank', eff('lcv', { upgrades: [10] }).rules.join(), 'Anti-tank');
ok('every honour flag is distinct', (function () {
  var seen = {}, dup = 0;
  C.HONOURS.concat(C.TRAUMAS).concat(C.UPGRADES).forEach(function (x) {
    if (!x.flag) return;
    if (seen[x.flag]) dup++;
    seen[x.flag] = 1;
  });
  return dup;
})(), 0);

/* ------------------------------------------------------ company legality */
head('Company Tier and promotion (pp. 83-84)');
var lco = start();
ok('a starting company can field a Tier I army', C.canFieldArmy(lco, 1, 1), true);
ok('...but not a Tier III one', C.canFieldArmy(lco, 3, 1), false);
lco.kUC = 1;
ok('...nor a Tier II one, with only two Tier II units',
  C.canPromoteCompany(lco).faults.some(function (f) { return /legal Tier II/.test(f); }), true,
  'the composition table asks for three');
lco.kUC = 20; C.recruit(lco, 'ecobats'); lco.kUC = 1;
ok('a third Tier II unit opens the promotion', C.canPromoteCompany(lco).ok, true,
  C.canPromoteCompany(lco).faults.join(' '));
C.promoteCompany(lco);
ok('...the company is Tier II', lco.tier, 2);
ok('...it cost the 1 kUC', lco.kUC, 0);
ok('...and the field command grew with it', C.byRid(lco, lco.cmdRid).key, 'cmd3');
ok('...a new doctrine slot opened', C.doctrineSlots(lco), 2);
ok('Tier III is out of reach on no money', C.canPromoteCompany(lco).ok, false);
lco.kUC = 500;
ok('...and still out of reach without the units',
  C.canPromoteCompany(lco).faults.some(function (f) { return /legal Tier/.test(f); }), true);

/* a company grown properly reaches Tier III */
var big = start();
big.kUC = 400;
['ecobats', 'observers', 'lmgsection', 'regular', 'regular', 'engineers',
  'sharpshooters', 'lmgteam', 'atteam', 'bats'].forEach(function (k) {
  C.recruit(big, k);
});
big.kUC = 400;
C.promoteCompany(big);
var p3 = C.canPromoteCompany(big);
ok('a company with Tier III units may reach Tier III', p3.ok, true, p3.faults.join(' '));

head('Recruitment (p. 85)');
var rco = start(); rco.kUC = 100;
ok('a Tier I company may recruit up to Tier III', C.canRecruit(rco, 'regular').ok, true);
ok('...but not Tier IV', C.canRecruit(rco, 'veterans').ok, false, C.canRecruit(rco, 'veterans').why);
ok('a Tier III unit costs 8 kUC', C.recruit(rco, 'regular').cost, 8);
ok('...and the money went', rco.kUC, 92);
ok('Penal troops are free', C.recruit(rco, 'penal').cost, 0);
ok('a Command Unit above the field command is refused',
  C.canRecruit(rco, 'cmd2').ok, false, C.canRecruit(rco, 'cmd2').why);
rco.tier = 3; C.fitCommand(rco);
ok('...but a lower-Tier one is fine once the company has grown', C.canRecruit(rco, 'cmd4').ok, true);
ok('the field command cannot be disbanded',
  C.canDisband(rco, C.byRid(rco, rco.cmdRid)).ok, false);

/* ------------------------------------------------------------- contract */
head('The contract (p. 84)');
/* Two things hold the Battle Tier down: the standing each force has reached, and
   whether either can actually put a legal army on the table at that Tier. The
   roll reports both, and takes the lower. */
var a1 = start(), b1 = start(); a1.tier = 3; b1.tier = 4;
ok('standing caps at the weaker company', C.rollBattleTier(a1, b1).standing, 3);
b1.tier = 2;
ok('...from either side', C.rollBattleTier(a1, b1).standing, 2);
b1.tier = 4; a1.aspiring = true;
ok('an Aspiring company stands one Tier higher', C.rollBattleTier(a1, b1).standing, 4);
a1.aspiring = false;
ok('...but a starting roster still only fields Tier I', C.fieldableTier(a1, 1), 1,
  'eight units, six of them Tier I');
ok('...so the contract comes down to it', C.maxBattleTier(a1, b1), 1);
ok('...and says the rosters were what held it down', (function () {
  // a D6 of 1 is not "held down" by anything, so ask for a roll that was
  for (var g = 0; g < 200; g++) {
    var r = C.rollBattleTier(a1, b1);
    if (r.roll > 1) return r.thin;
  }
  return 'never rolled above a 1';
})(), true);

// a company deep enough for its standing is capped by its standing instead
var deep = start();
deep.tier = 3;
C.deepen(deep, 1, 1); C.deepen(deep, 2, 1); C.deepen(deep, 3, 1);
ok('a roster deep enough for its standing fields at it', C.fieldableTier(deep, 1), 3);
var deep2 = start(); deep2.tier = 3;
C.deepen(deep2, 1, 1); C.deepen(deep2, 2, 1); C.deepen(deep2, 3, 1);
ok('...and the cap is the standing again', C.maxBattleTier(deep, deep2), 3);
ok('...with nothing thin about it', C.rollBattleTier(deep, deep2).thin, false);
var tiers = {};
for (var i = 0; i < 6000; i++) { var r = C.rollBattleTier(deep, deep2); tiers[r.tier] = (tiers[r.tier] || 0) + 1; }
ok('a D6 capped at III gives I, II, then III half the time',
  Math.round(100 * tiers[3] / 6000) > 60 && Math.round(100 * tiers[1] / 6000) > 12, true,
  'I ' + Math.round(100 * tiers[1] / 6000) + '%, II ' + Math.round(100 * tiers[2] / 6000) +
  '%, III ' + Math.round(100 * tiers[3] / 6000) + '%');
ok('the Priority Levels offered are the ones both could fill',
  C.levelsFor(deep, deep2, 1).every(function (n) { return C.canFieldArmy(deep, 1, n, true); }), true,
  'Level ' + C.levelsFor(deep, deep2, 3).join(' and ') + ' at Tier III');
var sc = {};
for (var i2 = 0; i2 < 6000; i2++) sc[C.rollScenario().id] = 1;
ok('a D6 reaches all six scenarios', Object.keys(sc).length, 6);
var sc3 = {};
for (var i3 = 0; i3 < 2000; i3++) sc3[C.rollScenario(true).id] = 1;
ok('...and a D3 only the first three', Object.keys(sc3).sort().join(','), 'find,meeting,secure');
ok('a quarter of eight units may be swapped', C.swapAllowance(start(), 8), 2);
var flex = start(); flex.doctrines = ['O6'];
ok('...half of them with Tactical Flexibility', C.swapAllowance(flex, 8), 4);

/* -------------------------------------------------------------- payment */
head('Payment (p. 84)');
var pa = start(), pb = start();
var tot = { A: 0, B: 0 }, n = 4000;
for (var i4 = 0; i4 < n; i4++) {
  var pay = C.payment(3, 1, pa, pb, 'A');
  tot.A += pay.A; tot.B += pay.B;
}
ok('the winner is paid more than the loser', tot.A > tot.B, true,
  'winner ' + (tot.A / n).toFixed(1) + ' kUC, loser ' + (tot.B / n).toFixed(1));
ok('a Tier III PL1 battle rolls 3D6', C.rollPayment(3, 1).length, 3);
ok('a Tier II PL3 battle rolls 6D6', C.rollPayment(2, 3).length, 6);
var draws = 0, equal = 0;
for (var i5 = 0; i5 < 2000; i5++) {
  var d = C.payment(3, 1, pa, pb, null);
  draws++; if (d.A === d.B && d.A === d.low) equal++;
}
ok('a draw pays both the lower roll', equal, draws);
var prm = start(); prm.doctrines = ['S5'];
var prWins = 0;
for (var i6 = 0; i6 < 2000; i6++) { var q = C.payment(3, 1, prm, pb, null); if (q.A === q.high) prWins++; }
ok('PR Masters is paid as a winner on a draw', prWins, 2000);
var neg = start(); neg.doctrines = ['S2'];
ok('Tough Negotiators re-rolls half the dice, rounded up',
  C.negotiate([1, 1, 1, 1, 1]).swapped.length, 3);

/* --------------------------------------------------------- EXP and TP */
head('Experience and Trauma (p. 85)');
function ctx(o) {
  var base = { entry: entryFor('regular'), company: start(), won: false, lost: false,
    ownTier: 1, enemyTier: 1, routed: false, consecutive: false };
  Object.keys(o || {}).forEach(function (k) { base[k] = o[k]; });
  return base;
}
function line(o) {
  var base = { rid: 'x', side: 'A', key: 'regular', startSize: 8, endSize: 8, destroyed: false,
    brokenEver: false, wiped: false, kills: [] };
  Object.keys(o || {}).forEach(function (k) { base[k] = o[k]; });
  return base;
}
ok('turning up is worth 1 EXP', C.expFor(line(), ctx()).total, 1);
ok('a win adds 1', C.expFor(line(), ctx({ won: true })).total, 2);
ok('fighting a bigger company adds 1', C.expFor(line(), ctx({ enemyTier: 3 })).total, 2);
ok('breaking an equal unit adds 1',
  C.expFor(line({ kills: [{ tier: 3 }] }), ctx()).total, 2);
ok('breaking a bigger one adds 2',
  C.expFor(line({ kills: [{ tier: 4 }] }), ctx()).total, 3);
ok('breaking a smaller one adds nothing',
  C.expFor(line({ kills: [{ tier: 2 }] }), ctx()).total, 1);
ok('everything at once is 5 EXP',
  C.expFor(line({ kills: [{ tier: 4 }] }), ctx({ won: true, enemyTier: 3 })).total, 5);
ok('Command Units earn none',
  C.expFor(line({ key: 'cmd2' }), ctx({ entry: entryFor('cmd2') })).total, 0);

ok('being broken is 2 TP', C.tpFor(line({ brokenEver: true }), ctx()).total, 2);
ok('losing two of eight is 1 TP', C.tpFor(line({ endSize: 6 }), ctx()).total, 1);
ok('losing five of eight is 4 TP', C.tpFor(line({ endSize: 3 }), ctx()).total, 4);
ok('losing exactly half is only 1 TP', C.tpFor(line({ endSize: 4 }), ctx()).total, 1);
ok('a lost battle is 1 TP', C.tpFor(line(), ctx({ lost: true })).total, 1);
ok('a rout adds another', C.tpFor(line(), ctx({ lost: true, routed: true })).total, 2);
var prCo = start(); prCo.doctrines = ['S5'];
ok('...which PR Masters does not pay',
  C.tpFor(line(), ctx({ lost: true, routed: true, company: prCo })).total, 1);
ok('a second battle in a row is 1 TP', C.tpFor(line(), ctx({ consecutive: true })).total, 1);
ok('the worst case is 9 TP',
  C.tpFor(line({ brokenEver: true, endSize: 1 }), ctx({ lost: true, routed: true, consecutive: true })).total, 9,
  '2 broken + 4 heavy losses + 1 defeat + 1 rout + 1 consecutive');
ok('machines take none', C.tpFor(line({ key: 'lcv', brokenEver: true }), ctx({ entry: entryFor('lcv') })).total, 0);
ok('Command Units take none', C.tpFor(line({ brokenEver: true }), ctx({ entry: entryFor('cmd2') })).total, 0);
ok('the threshold is 10', C.traumaThreshold(start()), 10);
var mt = start(); mt.doctrines = ['S3'];
ok('...15 with Mental Training', C.traumaThreshold(mt), 15);
ok('a trauma is never repeated', (function () {
  var e = entryFor('regular'); e.traumas = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var t = C.rollTrauma(e);
  return t && t.n === 10;
})(), true);
ok('a unit holding all ten rolls nothing', (function () {
  var e = entryFor('regular'); e.traumas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return C.rollTrauma(e);
})(), 'null');

/* -------------------------------------------------------------- salvage */
head('Salvage (p. 86)');
function salvageRate(key, opts, won, cat) {
  var e = entryFor(key, opts), got = 0, m = 4000;
  for (var i = 0; i < m; i++) if (C.salvage({ catastrophic: cat }, e, won).saved) got++;
  return Math.round(100 * got / m);
}
ok('a won battle recovers a tank on 3+', salvageRate('lcv', {}, true) > 60 && salvageRate('lcv', {}, true) < 73, true,
  salvageRate('lcv', {}, true) + '%');
ok('a lost one on 5+', salvageRate('lcv', {}, false) > 27 && salvageRate('lcv', {}, false) < 40, true,
  salvageRate('lcv', {}, false) + '%');
ok('a catastrophic explosion leaves nothing', salvageRate('lcv', {}, true, true), 0);
ok('an aircraft lands on 4+ whatever the result',
  Math.abs(salvageRate('fsc', {}, true) - salvageRate('fsc', {}, false)) < 4, true,
  salvageRate('fsc', {}, true) + '% / ' + salvageRate('fsc', {}, false) + '%');
var aes = (function () {
  var e = entryFor('fsc'); e.upgrades = [1]; var g = 0, m = 4000;
  for (var i = 0; i < m; i++) if (C.salvage({}, e, false).saved) g++;
  return Math.round(100 * g / m);
})();
ok('...and on 2+ with Advanced Emergency Systems', aes > 78 && aes < 90, true, aes + '%');
ok('a drone follows the ground table', salvageRate('lcv', { drone: true }, true) > 60, true);

/* ------------------------------------------------------------ aftermath */
head('The aftermath, end to end');
var camp = C.newCampaign({ mode: 'solo' });
C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
C.found(camp.companies.B, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'O1');
var A = camp.companies.A;
var fighters = A.roster.filter(function (e) { return R.profile(e.key).cls === 'infantry' && !R.profile(e.key).command; });
var report = {
  winner: 'A', battleTier: 1, pl: 1, scenario: 'secure', routed: { A: false, B: true },
  units: A.roster.map(function (e) {
    return { rid: e.rid, side: 'A', key: e.key, startSize: R.profile(e.key).size,
      endSize: R.profile(e.key).size, destroyed: false, brokenEver: false, wiped: false,
      kills: e === fighters[0] ? [{ tier: 2 }] : [] };
  }).concat(camp.companies.B.roster.map(function (e) {
    var p = R.profile(e.key);
    return { rid: e.rid, side: 'B', key: e.key, startSize: p.size,
      endSize: 0, destroyed: p.cls !== 'infantry', brokenEver: true, catastrophic: true,
      wiped: p.cls === 'infantry', kills: [] };
  }))
};
var after = C.aftermath(camp, report);
ok('the campaign turn advanced', camp.turn, 1);
ok('the winner was paid more', after.payment.A >= after.payment.B, true,
  after.payment.A + ' vs ' + after.payment.B + ' kUC');
ok('...and the money landed in the dossier', A.kUC, after.payment.A);
ok('every unit that fought gained EXP',
  fighters.every(function (e) { return e.exp >= 2; }), true, 'e.g. ' + fighters[0].exp);
ok('the one that broke an enemy gained more', fighters[0].exp > fighters[1].exp, true,
  fighters[0].exp + ' vs ' + fighters[1].exp);
ok('the field command gained none', C.byRid(A, A.cmdRid).exp, 0);
ok('the routed loser lost every infantry unit it fielded',
  camp.companies.B.roster.filter(function (e) { return R.profile(e.key).cls === 'infantry'; }).length, 1,
  'only the field command is left, reconstituted');
ok('...and both its vehicles, blown apart',
  camp.companies.B.roster.filter(function (e) { return R.profile(e.key).cls !== 'infantry'; }).length, 0);
ok('...leaving it unable to field a legal Tier I army',
  C.rebuildNeeds(camp.companies.B).join(','), '1');
ok('the record was kept', A.record.wins + '/' + camp.companies.B.record.losses, '1/1');
ok('a battle was logged', camp.log.length, 1);

/* ------------------------------------------------------- the long run */
head('Two hundred campaign turns, unattended');
var sim = C.newCampaign({ mode: 'solo' });
var startKeys = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
C.found(sim.companies.A, startKeys, 'S2');
C.found(sim.companies.B, startKeys, 'T4');
var trouble = [], tiers = { A: [], B: [] }, disbands = 0, traumasSeen = {}, honoursSeen = {};
for (var turn = 0; turn < 200; turn++) {
  var cap = C.maxBattleTier(sim.companies.A, sim.companies.B);
  var bt = C.rollBattleTier(sim.companies.A, sim.companies.B).tier;
  var winner = [null, 'A', 'B'][Math.floor(Math.random() * 3)];
  var rep = { winner: winner, battleTier: bt, pl: 1, scenario: 'secure',
    routed: { A: winner === 'B', B: winner === 'A' }, units: [] };
  ['A', 'B'].forEach(function (side) {
    sim.companies[side].roster.forEach(function (e) {
      if (e.restUntil > 0) return;
      var p = R.profile(e.key), hurt = Math.random() < 0.5;
      rep.units.push({
        rid: e.rid, side: side, key: e.key,
        startSize: p.size || 1, endSize: hurt ? Math.max(0, (p.size || 1) - C.d3()) : (p.size || 1),
        destroyed: p.cls !== 'infantry' && Math.random() < 0.2,
        catastrophic: Math.random() < 0.05,
        brokenEver: Math.random() < 0.3,
        wiped: p.cls === 'infantry' && Math.random() < 0.05 && !p.command,
        kills: Math.random() < 0.4 ? [{ tier: 1 + Math.floor(Math.random() * 5) }] : []
      });
    });
  });
  var before = { A: sim.companies.A.roster.length, B: sim.companies.B.roster.length };
  C.aftermath(sim, rep);
  ['A', 'B'].forEach(function (side) {
    var c = sim.companies[side];
    disbands += Math.max(0, before[side] - c.roster.length);
    c.roster.forEach(function (e) {
      e.traumas.forEach(function (t) { traumasSeen[t] = 1; });
      e.honours.forEach(function (x) { honoursSeen[x] = 1; });
      if (e.exp < 0 || e.tp < 0) trouble.push(side + ' ' + e.name + ' has negative points');
      if (e.traumas.length > 10) trouble.push(side + ' ' + e.name + ' holds ' + e.traumas.length + ' traumas');
    });
    if (c.kUC < 0) trouble.push(side + ' is ' + c.kUC + ' kUC in debt');
    C.developRival(c);
    tiers[side].push(c.tier);
  });
}
ok('nothing went negative or out of bounds', trouble.length, 0, trouble.slice(0, 2).join('; '));
ok('both companies climbed the Tiers',
  sim.companies.A.tier > 1 && sim.companies.B.tier > 1, true,
  'A reached Tier ' + R.ROMAN[sim.companies.A.tier] + ', B Tier ' + R.ROMAN[sim.companies.B.tier]);
ok('both can still field a legal army at every Tier they hold', (function () {
  var bad = [];
  ['A', 'B'].forEach(function (s) {
    var c = sim.companies[s];
    for (var t = 1; t <= c.tier; t++) if (!C.canFieldArmy(c, t, 1)) bad.push(s + ' Tier ' + t);
  });
  return bad.length ? bad.join(', ') : 0;
})(), 0);
ok('units were lost along the way', disbands > 0, true, disbands + ' struck off');
ok('traumas were suffered', Object.keys(traumasSeen).length > 3, true,
  Object.keys(traumasSeen).length + ' different ones');
ok('honours were earned', Object.keys(honoursSeen).length > 3, true,
  Object.keys(honoursSeen).length + ' different ones');
ok('doctrines never broke their caps', (function () {
  var bad = 0;
  ['A', 'B'].forEach(function (s) {
    var c = sim.companies[s];
    if (c.doctrines.length > c.tier) bad++;
    C.CATEGORIES.forEach(function (cat) {
      if (c.doctrines.filter(function (d) { return C.doctrine(d).cat === cat; }).length > 2) bad++;
    });
  });
  return bad;
})(), 0);


head('Losses (p. 85): who leaves the dossier');
(function () {
  function battle(lines) {
    var camp = C.newCampaign({});
    var co = camp.companies.A;
    C.found(co, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured',
      'rookie', 'lighteng'], 'S2');
    C.foundRival(camp.companies.B, 'swarm');
    var names = co.roster.filter(function (e) { return e.rid !== co.cmdRid; });
    var units = lines.map(function (make, i) {
      var e = names[i];
      var p2 = C.newEntry ? profileOf(e) : null;
      return make(e, p2);
    });
    var res = C.aftermath(camp, {
      winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting',
      routed: { A: false, B: false }, units: units
    });
    return { camp: camp, co: co, rec: res.sides.A, roster: names };
  }
  function profileOf(e) { return R.profile(e.key); }
  function line(e, over) {
    var p2 = R.profile(e.key);
    var l = {
      rid: e.rid, side: 'A', key: e.key, tier: p2.tier,
      startSize: p2.size, endSize: p2.size, brokenEver: false,
      wiped: false, fled: false, destroyed: false, catastrophic: false,
      aboardDowned: false, lostAboard: null, kills: []
    };
    for (var k in (over || {})) l[k] = over[k];
    return l;
  }

  // a unit killed to the last man
  var a = battle([function (e) { return line(e, { endSize: 0, wiped: true, brokenEver: true }); }]);
  ok('a unit wiped out to the last model is struck off',
    a.co.roster.some(function (e) { return e.rid === a.roster[0].rid; }), false);
  ok('...and the card says why', a.rec.units[0].wiped, true);

  // a unit that ran
  var b = battle([function (e) { return line(e, { endSize: 4, fled: true, brokenEver: true }); }]);
  ok('a unit that scattered and fled stays on the dossier',
    b.co.roster.some(function (e) { return e.rid === b.roster[0].rid; }), true);
  ok('...and is marked as having fled', b.rec.units[0].fled, true);
  ok('...but is not struck off', !b.rec.units[0].wiped, true);
  ok('...and still takes its Trauma Points', b.rec.units[0].tp.total > 0, true,
    b.rec.units[0].tp.total + ' TP');
  ok('...and still earns its experience', b.rec.units[0].exp.total > 0, true,
    b.rec.units[0].exp.total + ' EXP');
})();

head('Riding a machine down (p. 86)');
(function () {
  function ride(saveRoll) {
    var camp = C.newCampaign({});
    var co = camp.companies.A;
    C.found(co, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured',
      'rookie', 'lighteng'], 'S2');
    C.foundRival(camp.companies.B, 'swarm');
    // give it an aircraft to lose and a squad to lose with it
    co.kUC = 100;
    var air = C.recruit(co, 'adaptedcraft').entry;
    var troops = co.roster.filter(function (e) { return e.key === 'rookie'; })[0];
    var p2 = R.profile(troops.key);
    var out = [];
    for (var n = 0; n < 400; n++) {
      var c2 = JSON.parse(JSON.stringify(camp));
      var res = C.aftermath(c2, {
        winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false },
        units: [
          { rid: air.rid, side: 'A', key: air.key, tier: 2, startSize: 1, endSize: 0,
            destroyed: true, wiped: false, fled: false, brokenEver: false, kills: [] },
          { rid: troops.rid, side: 'A', key: troops.key, tier: p2.tier,
            startSize: p2.size, endSize: 0, wiped: true, fled: false, destroyed: false,
            brokenEver: false, aboardDowned: true, lostAboard: air.rid, kills: [] }
        ]
      });
      var u = res.sides.A.units.filter(function (x) { return x.rid === troops.rid; })[0];
      var stillThere = c2.companies.A.roster.some(function (e) { return e.rid === troops.rid; });
      out.push({ saved: !!u.aircraftSaved, kept: stillThere, tp: u.tp ? u.tp.total : 0 });
    }
    return out;
  }
  var runs = ride();
  var saved = runs.filter(function (r) { return r.saved; });
  var lost = runs.filter(function (r) { return !r.saved; });
  ok('an aircraft comes down on a 4+, so about half are recovered',
    saved.length > 130 && saved.length < 270, true, saved.length + ' of 400');
  ok('the troops aboard a recovered aircraft stay on the dossier',
    saved.every(function (r) { return r.kept; }), true);
  ok('...and take the 5 Trauma Points for the ride',
    saved.length ? saved.every(function (r) { return r.tp >= 5; }) : true, true,
    saved.length ? saved[0].tp + ' TP' : 'none');
  ok('the troops aboard one that was not recovered are struck off',
    lost.every(function (r) { return !r.kept; }), true);
})();

/* ------------------------------------------------- the contracts on offer */
head('The contracts on offer');
function offerWorld() {
  var camp = C.newCampaign({ mode: 'solo', nameA: 'Ironhold' });
  C.found(camp.companies.A,
    ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.foundRivals(camp, 3);
  return camp;
}
var ow = offerWorld();
var off = C.rollOffers(ow);
ok('a job carries the force it is against', off.every(function (o) {
  return o.rival >= 0 && o.rival < ow.rivals.length;
}), true);
ok('...a scenario rolled on a D6', off.every(function (o) {
  return o.scenario && o.scenario.roll >= 1 && o.scenario.roll <= 6 && C.SCENARIOS.indexOf(o.scenario.id) >= 0;
}), true);
ok('...a Battle Tier, and the ceiling the pairing could reach', off.every(function (o) {
  return o.tier >= 1 && o.tier <= 5 && o.capTier >= o.tier;
}), true, 'Tier ' + off.map(function (o) { return o.tier + '/' + o.capTier; }).join(' '));
ok('...the Priority Levels both forces can fill', off.every(function (o) {
  return Array.isArray(o.levels) && Array.isArray(o.capLevels);
}), true, 'PL ' + off.map(function (o) { return o.levels.join('&') || '-'; }).join(' '));
ok('...and, for the asymmetric three, who attacks', off.every(function (o) {
  var asym = ['invasion', 'demolish', 'takeover'].indexOf(o.scenario.id) >= 0;
  return asym ? (o.roles && /^[AB]$/.test(o.roles.attacker)) : o.roles === null;
}), true);
ok('the same jobs come back on the same campaign turn', C.rollOffers(ow) === off, true,
  'no re-rolling for a softer one');
ow.turn++;
ok('...and fresh ones the turn after', C.rollOffers(ow) !== off, true);
C.clearOffers(ow);
ok('a battle fought clears them', ow.offers, 'null');

// how many jobs there are: one a force most weeks, sometimes fewer or more
(function () {
  var tally = {}, both = 0, runs = 600;
  for (var i = 0; i < runs; i++) {
    var w = offerWorld();
    var o = C.rollOffers(w);
    tally[o.length] = (tally[o.length] || 0) + 1;
    var seen = {};
    o.forEach(function (q) { seen[q.rival] = (seen[q.rival] || 0) + 1; });
    if (Object.keys(seen).some(function (k) { return seen[k] > 1; })) both++;
  }
  ok('usually one job a force', tally[3] / runs > 0.6 && tally[3] / runs < 0.75, true,
    Math.round(100 * tally[3] / runs) + '% of turns had three');
  ok('...sometimes one force has nothing', (tally[2] || 0) > 0, true,
    Math.round(100 * (tally[2] || 0) / runs) + '% had two');
  ok('...and sometimes one is fighting on two fronts',
    ((tally[4] || 0) + (tally[5] || 0) + (tally[6] || 0)) > 0, true,
    Math.round(100 * ((tally[4] || 0) + (tally[5] || 0) + (tally[6] || 0)) / runs) + '% had four or more');
  ok('...never none, and never more than two a force',
    Object.keys(tally).every(function (n) { return +n >= 1 && +n <= 6; }), true,
    'counts seen: ' + Object.keys(tally).sort().join(', '));
  ok('a force offering two jobs offers two different ones', both > 0, true,
    Math.round(100 * both / runs) + '% of turns doubled one up');
})();

// every force on the world is brought up to something like the player's standing
(function () {
  var w = offerWorld();
  w.companies.A.tier = 3;
  C.rollOffers(w);
  var gap = w.rivals.filter(function (co) { return co.tier < 2 || co.tier > 4; }).length;
  ok('every force is levelled to meet the player, give or take a Tier', gap, 0,
    'rival Tiers ' + w.rivals.map(function (co) { return co.tier; }).join(', ') + ' against a Tier III player');
})();

/* ------------------------------------------- the road to the next Company Tier */
head('Promotion progress (pp. 83-84)');
var pg = start();
var prog = C.promotionProgress(pg);
ok('a fresh company is one step from Tier II', prog.next + '/' + prog.done + ' of ' + prog.total,
  '2/1 of 3', 'the money and a legal army at Tier I and Tier II');
ok('...and the money is the first of them', prog.steps[0].id, 'money');
ok('...and a penniless company has not met it', prog.steps[0].done + '/' + prog.steps[0].detail,
  'false/1 short of the 1 it costs.');
ok('...while the Tier I army it was founded with is already there', prog.steps[1].done, true);
ok('...but it cannot yet field a Tier II army', prog.steps[2].done, false,
  prog.steps[2].detail);
ok('...and is told exactly what is short',
  /Needs 1 more Tier II unit/.test(prog.steps[2].detail), true);
ok('the button is dead until every step is met', prog.ok, false);
pg.kUC = 40; C.recruit(pg, 'rookie');
var prog2 = C.promotionProgress(pg);
ok('one more Tier II unit finishes it', prog2.done + ' of ' + prog2.total, '3 of 3');
ok('...and now it may promote', prog2.ok, true);
ok('...which the old check agrees with', C.canPromoteCompany(pg).ok, true);
var went = C.promoteCompany(pg);
ok('...and it goes through', went.ok + '/' + pg.tier, 'true/2');

// the Tier IV gate
var big = start();
big.tier = 3; big.kUC = 500;
var prog3 = C.promotionProgress(big);
ok('the step before Tier IV adds the Priority Level 2 gate',
  prog3.steps.map(function (x) { return x.id; }).join(','), 'money,tier1,tier2,tier3,tier4,pl2');
ok('...and says why it is there',
  /Priority Level 2/.test(prog3.steps[5].label) && /standard contracts/i.test(prog3.steps[5].detail), true);
ok('money alone is not enough', prog3.steps[0].done + '/' + prog3.ok, 'true/false');
var toppedOut = start(); toppedOut.tier = 5;
ok('a Tier V company has nowhere to go', C.promotionProgress(toppedOut).top, true);

// what the report says about a roster that cannot fill a Tier
ok('fieldReport counts the shortfall by Tier', (function () {
  var r = C.fieldReport(start(), 3, 1);
  return r.ok + ' · ' + r.missing.map(function (m) { return m.short + '×T' + m.tier; }).join(' ');
})(), 'false · 3×T3');
ok('...and agrees with canFieldArmy everywhere', (function () {
  var co2 = start(), bad = 0;
  for (var t = 1; t <= 5; t++) {
    for (var pl = 1; pl <= 2; pl++) {
      if (C.fieldReport(co2, t, pl).ok !== C.canFieldArmy(co2, t, pl)) bad++;
    }
  }
  return bad;
})(), 0);
ok('a force that can field it gets no fault', C.fieldReport(start(), 1, 1).fault, 'null');

/* ------------------------------- rest for the units that sat the battle out */
head('Rest and recovery (p. 85)');
(function () {
  var camp2 = C.newCampaign({ mode: 'solo' });
  var A2 = camp2.companies.A, B2 = camp2.companies.B;
  C.found(A2, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.found(B2, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'O1');
  // everybody is carrying trauma; only the first three take the field
  A2.roster.forEach(function (e) { e.tp = 8; });
  var went = A2.roster.slice(0, 3), stayed = A2.roster.slice(3);
  var rep = {
    winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: true },
    units: went.map(function (e) {
      return {
        rid: e.rid, side: 'A', key: e.key, tier: R.profile(e.key).tier,
        startSize: R.profile(e.key).size, endSize: R.profile(e.key).size,
        brokenEver: false, wiped: false, destroyed: false, kills: []
      };
    })
  };
  var out = C.aftermath(camp2, rep);
  var rested = out.sides.A.units.filter(function (u) { return u.rested; });
  ok('a unit that did not fight sheds Trauma Points', rested.length, stayed.length,
    'of ' + A2.roster.length + ' on the books, ' + went.length + ' fought');
  ok('...and nobody who fought does', out.sides.A.units.filter(function (u) {
    return u.rested && went.some(function (e) { return e.rid === u.rid; });
  }).length, 0);
  ok('...D3+1 of them, so two to four', rested.every(function (u) {
    return u.rested >= 2 && u.rested <= 4;
  }), true, rested.map(function (u) { return u.rested; }).join(', '));
  ok('...taken off the dossier', stayed.every(function (e) { return e.tp < 8; }), true,
    stayed.map(function (e) { return e.tp; }).join(', '));
})();
ok('...and never below nothing', (function () {
  var camp3 = C.newCampaign({ mode: 'solo' });
  C.found(camp3.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.found(camp3.companies.B, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'O1');
  camp3.companies.A.roster.forEach(function (e) { e.tp = 1; });
  C.aftermath(camp3, { winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting',
    routed: { A: false, B: false }, units: [] });
  return camp3.companies.A.roster.filter(function (e) { return e.tp < 0; }).length;
})(), 0);
ok('a salvaged unit also ticks off its spell in the workshop', (function () {
  var camp4 = C.newCampaign({ mode: 'solo' });
  C.found(camp4.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.found(camp4.companies.B, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'O1');
  var hull = camp4.companies.A.roster.filter(function (e) { return R.profile(e.key).cls === 'vehicle'; })[0];
  hull.restUntil = 3;
  C.aftermath(camp4, { winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting',
    routed: { A: false, B: false }, units: [] });
  return hull.restUntil;
})(), 2);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
