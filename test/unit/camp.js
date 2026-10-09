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
// on top of the ordinary step within their own group, Basic troops (p. 87)
ok('Recruits reach Basic, rifle, heavy, light support and mortars',
  Object.keys(rg).sort().join(','), 'Basic troops,Heavy infantry,Light support,Remote mortars,Rifle infantry');
var enf = {};
C.promotionTargets(entryFor('enforcers')).forEach(function (q) { enf[q.group] = 1; });
ok('Enforcers reach Basic troops and Heavy infantry', Object.keys(enf).sort().join(','), 'Basic troops,Heavy infantry');
var irr = {};
C.promotionTargets(entryFor('irregulars')).forEach(function (q) { irr[q.group] = 1; });
ok('Irregulars reach Basic, assault, light support and light infantry',
  Object.keys(irr).sort().join(','), 'Assault troops,Basic troops,Light infantry,Light support');
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
  ok('...and take the 5 Trauma Points for the ride, and no more (p. 86: they survive)',
    saved.length ? saved.every(function (r) { return r.tp === 5; }) : true, true,
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
  // enough turns that the share lands well inside its bounds every time (about 66%, give or take 1%)
  var tally = {}, both = 0, runs = 2400;
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

/* ------------------------------------------------- marked for the contract */
head('Pick a force for me: the dossier\'s marks');
(function () {
  // more Tier I than a Tier I, Priority Level 1 contract can take: the pick has a choice to make
  var co = C.newCompany('Marked', { faction: 'pmc' });
  ['cmd4', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits'].forEach(function (k) { co.roster.push(C.newEntry(k)); });
  var rec = co.roster.filter(function (e) { return e.key === 'recruits'; });
  var plain = C.pickForce(co, 1, 1, null);
  var left = rec.filter(function (e) { return plain.indexOf(e) < 0; });
  ok('...with more units than the contract takes, some are left out', left.length > 0, true);
  // the one left out favoured, the first one taken unfavoured
  var fav = left[0], unfav = rec.filter(function (e) { return plain.indexOf(e) >= 0; })[0];
  fav.mark = 'fav'; unfav.mark = 'unfav';
  var marked = C.pickForce(co, 1, 1, null);
  ok('a favoured unit is taken', marked.indexOf(fav) >= 0, true);
  ok('...and an unfavoured one left out while others will do', marked.indexOf(unfav) < 0, true);
  ok('...the force still legal', R.checkArmy(marked.map(function (e) { return R.entryPick(e); }), 1, 1, co.doctrines || []).ok, true);
  // nothing else will do: the unfavoured are taken after all
  rec.forEach(function (e) { e.mark = 'unfav'; });
  ok('...but taken when nothing else will do', R.checkArmy(C.pickForce(co, 1, 1, null).map(function (e) { return R.entryPick(e); }), 1, 1, co.doctrines || []).ok, true);
})();

/* ------------------------------------------------- nursing the wounded */
head('Pick a force (and the AI forces): Trauma Points');
(function () {
  var co = C.newCompany('Worn', { faction: 'pmc' });
  ['cmd4', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits', 'recruits'].forEach(function (k) { co.roster.push(C.newEntry(k)); });
  var rec = co.roster.filter(function (e) { return e.key === 'recruits'; });
  var first = C.pickForce(co, 1, 1, null).filter(function (e) { return e.key === 'recruits'; });
  // the ones it would take first: one a battle from a Trauma, one getting close
  first[0].tp = 8; first[1].tp = 5;
  var picked = C.pickForce(co, 1, 1, null);
  var spare = rec.length - picked.filter(function (e) { return e.key === 'recruits'; }).length;
  ok('a unit at 7+ of 10 TP is left at home while others will do', picked.indexOf(first[0]) < 0, true);
  ok('...and one at 4+ only after the fresher ones', picked.indexOf(first[1]) < 0 || spare < 2, true);
  ok('...the force still legal', R.checkArmy(picked.map(function (e) { return R.entryPick(e); }), 1, 1, co.doctrines || []).ok, true);
  // everyone worn: they go all the same, rather than no force at all
  rec.forEach(function (e) { e.tp = 9; });
  ok('...but sent when the army cannot be legal without them', R.checkArmy(C.pickForce(co, 1, 1, null).map(function (e) { return R.entryPick(e); }), 1, 1, co.doctrines || []).ok, true);
})();

/* ------------------------------------------------- a force a third short */
head('Contracts at a Tier the AI force can field in full');
(function () {
  // the Ivenbean Brood after a bad battle: legal at Tier III (2+ Tier III for a swarm) but 12 of 18 points
  var brood = C.newCompany('Ivenbean Brood', { faction: 'bugs' }); brood.tier = 3; brood.kUC = 0;
  ['bwatchers', 'bwatchlarva', 'bpathfinder', 'bsmallpath', 'bsmall', 'btiny', 'btiny'].forEach(function (k) { brood.roster.push(C.newEntry(k)); });
  brood.cmdRid = brood.roster[0].rid;
  ok('a Tier fielded must fill every point, not most of them', C.fillsArmy(brood, 2, 1) === (function () {
    var r = R.checkArmy(C.pickForce(brood, 2, 1).map(function (e) { return R.entryPick(e); }), 2, 1, []); return r.ok && r.spent === r.budget; })(), true);
  ok('legal at Tier III PL1 but short of the points', C.canFieldArmy(brood, 3, 1) && !C.fillsArmy(brood, 3, 1), true);
  ok('...the highest Tier it fields near full strength', C.fullTier(brood, 1) < 3, true);
  var camp = C.newCampaign({ mode: 'solo', nameA: 'Us', factionA: 'pmc' });
  C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  camp.companies.A.tier = 3;
  camp.rivals = [brood]; camp.companies.B = brood; camp.facing = 0;
  var offers = C.rollOffers(camp);
  ok('an offer against it is no bigger than it can field', offers.length > 0 && offers.every(function (o) { return o.tier <= C.fullTier(brood, 1) && o.capTier <= C.fullTier(brood, 1); }), true,
    offers.map(function (o) { return 'T' + o.tier + '/cap' + o.capTier; }).join(' '));
  ok('...and not regrouping', !brood.regrouping, true);
  ok('it took on free Tiny bug swarms only to four', brood.roster.filter(function (e) { return e.key === 'btiny'; }).length <= 4, true);

  // the only force that cannot fight: its four free units and no Tier II command to make up the points
  var thin = C.newCompany('Thin', { faction: 'rebel' }); thin.tier = 1; thin.kUC = 0;
  ['rciv', 'rciv', 'rciv', 'rciv'].forEach(function (k) { thin.roster.push(C.newEntry(k)); });
  ok('four Armed civilians alone: 4 of 6 points — no Tier I army', C.fullTier(thin, 1), 0);
  thin.roster.push(C.newEntry('rinstigators'));
  ok('...with a Tier I leader, 5 of 6 — still none', C.fullTier(thin, 1), 0);
  thin.roster.pop(); thin.roster.push(C.newEntry('rsecondary'));
  ok('...with a Tier II leader in their place, 6 of 6 — Tier I', C.fullTier(thin, 1), 1);
  var pen = C.newCompany('Pen', { faction: 'pmc' });
  ok('Penal troops are always free (four to an army); Armed civilians while fewer than four', [0, 4, 6].map(function (n) {
    pen.roster = []; for (var i = 0; i < n; i++) pen.roster.push(C.newEntry('penal'));
    return C.recruitCost(pen, 'penal');
  }).join(',') + ' / ' + [3, 4].map(function (n) {
    thin.roster = []; for (var i = 0; i < n; i++) thin.roster.push(C.newEntry('rciv'));
    return C.recruitCost(thin, 'rciv');
  }).join(','), '0,0,0 / 0,1');

  // a force that can only regroup has its turn of recovery, then is broken up
  var camp2 = C.newCampaign({ mode: 'solo', nameA: 'Us', factionA: 'pmc' });
  C.found(camp2.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.foundRivals(camp2, 2, { factions: ['pmc', 'xeno'], bugs: false });
  var doomed = camp2.rivals[1]; doomed.kUC = 0; doomed.tier = 1; doomed.doctrines = [];   // (no Hermetic Society doubling the bill)
  // the dice held steady, so nobody is caught up to the player's standing in the middle of it
  var rnd = Math.random, roll = function () { Math.random = function () { return 0.3; }; try { C.clearOffers(camp2); C.rollOffers(camp2); } finally { Math.random = rnd; } };
  doomed.roster = ['xeps1', 'xeps1', 'xeps1', 'xeps1'].map(function (k) { return C.newEntry(k); }); doomed.cmdRid = null;
  roll();
  ok('nothing but its four free units: it regroups, and offers no contract', doomed.regrouping && camp2.offers.every(function (o) { return camp2.rivals[o.rival] !== doomed; }), true);
  ok('...scraping a resource point together, spent on a fifth unit', doomed.roster.length, 5, doomed.roster.map(function (e) { return e.key; }).join(','));
  camp2.turn++; roll();
  ok('...another point the next turn, a sixth unit: back to a Tier I army', camp2.rivals.indexOf(doomed) >= 0 && !doomed.regrouping && C.fullTier(doomed, 1) === 1, true);
  // one that cannot buy even with the point (deep in debt) is broken up after its turn of recovery
  doomed.roster = ['xeps1', 'xeps1', 'xeps1', 'xeps1'].map(function (k) { return C.newEntry(k); }); doomed.kUC = -10;
  camp2.turn++; roll();
  ok('a force that cannot recover regroups first', doomed.regrouping && camp2.rivals.indexOf(doomed) >= 0, true);
  camp2.turn++; roll();
  ok('...and still unable after that turn: broken up and gone from the campaign', camp2.rivals.indexOf(doomed) < 0 && (camp2.brokenUp || []).length === 1 && camp2.companies.B === camp2.rivals[camp2.facing], true);

  // a promoted force wants back a command of the grade it left: a swarm first of all, the others most turns
  var sw = C.newCompany('Sw', { faction: 'bugs' });
  C.foundRival(sw, null, []); sw.kUC = 30; sw.tier = 1;
  sw.wantCmdTier = null;
  var g0 = 0; while (sw.tier < 2 && g0++ < 40) { sw.kUC = Math.max(sw.kUC, 30); C.developRival(sw); }
  ok('a promoted swarm spawns a Leader Bug of the grade it left', sw.tier >= 2 && sw.roster.some(function (e) { return e.key === 'bwatchlarva'; }), true,
    'tier ' + sw.tier + ': ' + sw.roster.map(function (e) { return e.key; }).join(','));
  var ups = [0, 1, 2, 3, 4, 5].map(function () {
    var up = C.newCompany('Up', { faction: 'pmc' });
    C.foundRival(up, 'elite', []);
    var guard = 0; while (up.tier < 2 && guard++ < 40) { up.kUC = 200; C.developRival(up); }
    up.kUC = 200; C.developRival(up); C.developRival(up);
    return up.roster.some(function (e) { return e.key === 'cmd4'; });
  });
  ok('...and a company recruits its old field command grade too, within a turn or two', ups.filter(Boolean).length >= 4, true, ups.join(','));

  // the AI founds with units it paid for: the free ones come later
  var freeAtFounding = [];
  C.ARCHETYPES.concat(C.archetypesFor('rebel'), C.archetypesFor('bugs'), C.archetypesFor('xeno')).forEach(function (a) {
    for (var i = 0; i < 4; i++) {
      var co = C.newCompany('R', { faction: a.faction || 'pmc' });
      C.foundRival(co, a.id, []);
      // (a revolt that starts as armed civilians founds with them on purpose: `foundFree`)
      if (!a.foundFree) co.roster.forEach(function (e) { if (C.freeUnit(e.key)) freeAtFounding.push(a.id + ':' + e.key); });
    }
  });
  ok('no AI force founds with Penal troops, Armed civilians, Tiny bug swarms or Primitive Epsilons', freeAtFounding.length, 0, freeAtFounding.slice(0, 5).join(' '));
  ok('...and they are marked as the free ones', [C.freeUnit('penal'), C.freeUnit('rciv'), C.freeUnit('btiny'), C.freeUnit('xeps1')].every(Boolean) && !C.freeUnit('recruits'), true);
})();

head('Six personalities to every army');
(function () {
  ['pmc', 'rebel', 'bugs', 'xeno'].forEach(function (f) {
    ok(f + ': six archetypes', C.archetypesFor(f).length, 6);
  });
  var bad = [];
  ['aircav', 'turncoats', 'greyplague', 'velior', 'ulvar', 'shkar'].forEach(function (id) {
    var a = C.archetype(id);
    for (var i = 0; i < 3; i++) {
      var co = C.newCompany('N', { faction: a.faction || 'pmc' });
      C.foundRival(co, id, []);
      if (co.archetype !== id || !C.canFieldArmy(co, 1, 1)) bad.push(id);
    }
  });
  ok('each new one founds a legal force of its own kind', bad.join(','), '');
  // what it is known for, weighted up, within a few turns of being able to
  var grow5 = function (co) { co.tier = 2; co.kUC = 40; for (var g5 = 0; g5 < 5; g5++) { C.developRival(co); co.kUC += 20; } };
  var sky = C.newCompany('S', { faction: 'bugs' }); C.foundRival(sky, 'velior', []); grow5(sky);
  ok('a sky swarm spawns its flyers', sky.roster.some(function (e) { return R.profile(e.key).group === 'Flying Bugs'; }), true);
  var plague = C.newCompany('P', { faction: 'bugs' }); C.foundRival(plague, 'greyplague', []); grow5(plague);
  ok('...and the Grey Plague its Infected', plague.roster.some(function (e) { return e.key === 'binfected'; }), true);
})();

head('Doctrines: fixed, a shortlist, or random');
(function () {
  var all = C.ARCHETYPES.concat(C.archetypesFor('rebel'), C.archetypesFor('bugs'), C.archetypesFor('xeno'));
  function fixedOf(a) { return Object.keys(a.fixedAt || {}).map(function (t) { return a.fixedAt[t]; }); }
  ok('every archetype names doctrines of its own army only', all.filter(function (a) {
    var ids = C.creedOf({ faction: a.faction || 'pmc' }).list.map(function (d) { return d.id; });
    return (a.doctrines || []).concat(fixedOf(a)).some(function (d) { return ids.indexOf(d) < 0; });
  }).map(function (a) { return a.id; }).join(','), '');
  ok('every PMC doctrine is on some company\'s list', C.creedOf({ faction: 'pmc' }).list.filter(function (d) {
    return !C.ARCHETYPES.some(function (a) { return a.doctrines.indexOf(d.id) >= 0 || fixedOf(a).indexOf(d.id) >= 0; });
  }).map(function (d) { return d.name; }).join(', '), '');
  // (the PMC companies and the revolts all have a creed: none of them is random)
  // (a creed of its own: no doctrine on the lists of four or more forces of one army)
  ok('no doctrine is on four or more of an army\'s personalities', ['pmc', 'rebel', 'bugs', 'xeno'].map(function (f) {
    var use = {};
    C.archetypesFor(f).forEach(function (a) { (a.doctrines || []).concat(fixedOf(a)).filter(function (d, i, l) { return l.indexOf(d) === i; }).forEach(function (d) { use[d] = (use[d] || 0) + 1; }); });
    return Object.keys(use).filter(function (d) { return use[d] >= 4; }).map(function (d) { return f + ' ' + d + ' ' + use[d]; }).join(',');
  }).filter(Boolean).join(' '), '');
  // (every force has a creed of its own now: a fixed first doctrine, or a shortlist alone)
  ok('...and each army has forces with a fixed first doctrine', ['pmc', 'rebel', 'bugs', 'xeno'].every(function (f) {
    return C.archetypesFor(f).some(function (a) { return !!(a.fixedAt || {})[1]; }) && !C.archetypesFor(f).some(function (a) { return a.random; });
  }), true);
  function found(id) { var a = C.archetype(id), co = C.newCompany('D', { faction: a.faction || 'pmc' }); C.foundRival(co, id, []); return co; }
  // (a change an admin saved while "fixed" was its own field still means fixed at Tier I, II...)
  C.applyArchetypeChanges({ shock: { doctrines: { fixed: ['T1'] } } });
  ok('an old saved change with "fixed" becomes fixed at Tier I', JSON.stringify(C.archetype('shock').fixedAt) + ' ' + ('fixed' in C.archetype('shock')), '{"1":"T1"} false');
  C.applyArchetypeChanges({});
  var plague = [0, 1, 2, 3, 4].map(function () { return found('greyplague'); });
  ok('the Grey Plague always founds with Fungi Symbiosis', plague.every(function (co) { return co.doctrines[0] === 'BP4'; }), true);
  var raid = found('shkar');
  ok('the Sh\'kar raiders take the teleport network, then the cloaking, first', raid.docPlan.slice(0, 2).join(), 'XO1,XT4');
  var tc = [0, 1, 2, 3, 4, 5].map(function () { return found('turncoats'); });
  ok('the Turncoats take La Liberte, then their Villain doctrines, the Prophet ones last', tc.every(function (co) {
    var pl = co.docPlan;
    return pl[0] === 'H6' && ['V6', 'V5', 'V1'].indexOf(pl[1]) >= 0 && ['V6', 'V5', 'V1'].indexOf(pl[2]) >= 0 && ['P5', 'P6'].indexOf(pl[4]) >= 0 && ['P5', 'P6'].indexOf(pl[5]) >= 0;
  }), true, tc.map(function (co) { return co.docPlan.slice(0, 6).join(''); }).join(' '));
  var pit = [0, 1, 2, 3, 4, 5].map(function () { return found('pitheads'); });
  ok('the Pitheads found with a pick from their list, and take Labour Leader at Tier II', pit.every(function (co) {
    return co.doctrines.length === 1 && co.doctrines[0] !== 'H3' && C.archetype('pitheads').doctrines.indexOf(co.doctrines[0]) >= 0 && co.docPlan[1] === 'H3';
  }), true, pit.map(function (co) { return co.docPlan.slice(0, 2).join('>'); }).join(' '));
  var arm = [0, 1, 2, 3, 4, 5].map(function () { return found('armour'); }), short = C.archetype('armour').doctrines;
  ok('a shortlist force takes its six first, in an order of its own', arm.every(function (co) {
    return co.docPlan.slice(0, 6).every(function (d) { return short.indexOf(d) >= 0; });
  }) && arm.some(function (co) { return co.docPlan.slice(0, 6).join() !== arm[0].docPlan.slice(0, 6).join(); }), true, arm.map(function (co) { return co.docPlan.slice(0, 6).join(''); }).join(' '));
  var firsts = {};
  // (no personality is random now: the switch is tried on one, as an admin might set it)
  var rnd = C.unifiedArchetype('ghadon'); rnd.doctrines.random = true; var rch = { ghadon: C.archetypeChange('ghadon', rnd) };
  C.withArchetypeChanges(rch, function () { for (var i = 0; i < 40; i++) firsts[found('ghadon').docPlan[0]] = 1; });
  ok('a random force draws from the whole list', Object.keys(firsts).length > 8, true, Object.keys(firsts).length + ' different first doctrines in 40');
})();

head('Skirmish forces rolled to a personality, at every Tier and Priority Level');
(function () {
  function keyOf(k) { return R.splitPick(k).key; }
  ['pmc', 'rebel', 'xeno', 'bugs'].forEach(function (f) {
    C.archetypesFor(f).forEach(function (a) {
      var legal = 0, n = 0, own = 0, tot = 0, styled = 0;
      for (var t = 1; t <= 5; t++) for (var pl = 1; pl <= 3; pl++) for (var i = 0; i < 3; i++) {
        var ks = R.rollArmy(t, pl, null, f, a.id); n++;
        if (ks.style === a.id) styled++;
        if (R.checkArmy(ks, t, pl, null, null, f).ok) legal++;
        ks.forEach(function (k) {
          var p = R.profile(keyOf(k)); tot++;
          var wE0 = a.weights[p.key] != null ? a.weights[p.key] : a.weights[p.group];
          if ((wE0 && (Array.isArray(wE0) ? wE0[0] : wE0)) || p.command || p.leaderBug || [].concat(a.t1 || [], a.t2 || []).indexOf(p.key) >= 0) own++;
        });
      }
      ok(a.name + ': legal at every Tier and PL, and mostly its own kind', legal === n && styled === n && own / tot > 0.6, true,
        legal + '/' + n + ' legal, ' + Math.round(100 * own / tot) + '% its own');
    });
  });
  var elite = 0, merc = 0, fs = 0, fsLead = 0, fsArt = 0;
  for (var i = 0; i < 40; i++) {
    var t = 1 + (i % 5), pl = 1 + (i % 3);
    elite += R.rollArmy(t, pl, null, 'pmc', 'elite').filter(function (k) { return R.profile(keyOf(k)).cls !== 'infantry'; }).length;
    merc += R.rollArmy(t, pl, null, 'pmc', 'swarm').filter(function (k) { return keyOf(k) === 'enforcers'; }).length;
    var f = R.rollArmy(t, pl, null, 'rebel', 'freespace');
    fsArt += f.filter(function (k) { return R.profile(keyOf(k)).group === 'Rebel artillery'; }).length;
    var lead = f.filter(function (k) { var p = R.profile(keyOf(k)); return p.group === 'First Among Equals' && p.ridersUpgrade; });
    fs += lead.length; fsLead += lead.filter(function (k) { return R.splitPick(k).riders; }).length;
  }
  ok('the Elite fields no hulls, Mercenaries no Enforcers, Free Space no artillery', [elite, merc, fsArt], [0, 0, 0]);
  ok('Free Space leaders ride wherever they may', fs > 0 && fsLead === fs, true, fsLead + ' of ' + fs);
  var cav = 0, plain = 0;
  for (var j = 0; j < 60; j++) {
    var tt = 2 + (j % 4);
    cav += R.rollArmy(tt, 2, null, 'pmc', 'aircav').filter(function (k) { return R.profile(keyOf(k)).cls !== 'infantry'; }).length;
    plain += R.rollArmy(tt, 2, null, 'pmc', 'elite').filter(function (k) { return R.profile(keyOf(k)).cls !== 'infantry'; }).length;
  }
  ok('Cavalry fields more hulls than anyone', cav > 60 && cav > plain, true, cav + ' hulls in 60 forces');
  /* The tier preference sets the mix whatever the battle's Tier: a Tier counts by how much
     the list likes what it has, scaled by the preference, not by how many kinds of unit it
     has (at Tier II there are three Tier III hulls for every Tier II one). And the hulls it
     takes first follow it too: a Cavalry at Tier III reaches a Tier IV hull now and then. */
  var mixOf = function (id, f, t) {
    var m = [0, 0, 0];
    for (var i = 0; i < 80; i++) R.rollArmy(t, 2, null, f, id).forEach(function (k) { var p = R.profile(keyOf(k)); if (!p.command) m[p.tier < t ? 0 : p.tier > t ? 2 : 1]++; });
    return m;
  };
  var t2a = mixOf('armour', 'pmc', 2), t4a = mixOf('armour', 'pmc', 4), t2r = mixOf('redfront', 'rebel', 2);
  ok('a force of its own Tier is mostly its own Tier, at Tier II as at Tier IV', t2a[1] > 2 * t2a[2] && t4a[1] > 2 * t4a[2], true, JSON.stringify([t2a, t4a]));
  ok('...and one set to fill up a Tier below takes more below than above', t2r[0] > 2 * t2r[2], true, JSON.stringify(t2r));
  // (the way it leans peaks one Tier off: two Tiers off is always the fewer)
  var offs = function (id, f, t) {
    var c = {};
    for (var i = 0; i < 80; i++) R.rollArmy(t, 2, null, f, id).forEach(function (k) { var p = R.profile(keyOf(k)); if (!p.command) c[p.tier - t] = (c[p.tier - t] || 0) + 1; });
    return c;
  };
  var sw = offs('swarm', 'pmc', 3), el = offs('elite', 'pmc', 3);
  ok('...one Tier off is taken more than two, whichever way it leans', sw[-1] > (sw[-2] || 0) && el[1] > (el[2] || 0), true, JSON.stringify([sw, el]));
  ok('...and the factors fall away past one Tier', [R.tierLean(-1, -1) > R.tierLean(-1, -2), R.tierLean(1, 1) > R.tierLean(1, 2), R.tierLean(0, 2) < R.tierLean(0, 1), R.tierLean(0, -3) < R.tierLean(0, -2)].every(Boolean), true);
  // command units a Priority Level, on average: none, one for every two, one each (Alphas count for a Xenotripod)
  var cmdAt = function (id, f, c, pl) {
    var u = C.unifiedArchetype(id); u.force.command = c; var n = 0, bad = 0, ch = {}; ch[id] = C.archetypeChange(id, u);
    C.withArchetypeChanges(ch, function () {
      for (var i = 0; i < 40; i++) { var ks = R.rollArmy(3, pl, null, f, id); if (!R.checkArmy(ks, 3, pl, null, null, f).ok) bad++; ks.forEach(function (k) { var p = R.profile(keyOf(k)); if (p.command || p.alpha) n++; }); }
    });
    return bad ? -1 : n / 40;
  };
  var cmdGot = [cmdAt('armour', 'pmc', 0, 2), cmdAt('armour', 'pmc', 0.5, 2), cmdAt('armour', 'pmc', 1, 3), cmdAt('ghadon', 'xeno', 0, 2), cmdAt('ghadon', 'xeno', 1, 2)];
  ok('command units follow the personality: 0, 0.5 and 1 a Priority Level, all legal', JSON.stringify(cmdGot), '[0,1,3,0,2]');
  // ...the first of the Tier the command level names, each after it a Tier below; and never by the weights
  var lvAt = function (id, f, lv) {
    var u = C.unifiedArchetype(id); u.force.command = 1; u.force.commandTier = lv; var ch = {}; ch[id] = C.archetypeChange(id, u), seen = {};
    C.withArchetypeChanges(ch, function () {
      for (var i = 0; i < 20; i++) seen[R.rollArmy(3, 3, null, f, id).map(function (k) { return R.profile(keyOf(k)); }).filter(function (p) { return p.command || p.alpha; }).map(function (p) { return p.tier; }).sort().reverse().join('/')] = 1;
    });
    return Object.keys(seen).join(',');
  };
  ok('the command level sets the highest command unit\'s Tier, the rest a Tier below', [lvAt('armour', 'pmc', -1), lvAt('armour', 'pmc', 1), lvAt('ghadon', 'xeno', 0)].join(' '), '2/1/1 4/3/3 3/2/2');
  var plainAlphas = 0;
  for (var pa = 0; pa < 30; pa++) plainAlphas += R.rollArmy(3, 2, null, 'xeno', 'ghadon').filter(function (k) { return R.profile(keyOf(k)).alpha; }).length;
  ok('...and with nothing set, one command unit a force, Alphas included', plainAlphas, 30);
  // a rolled hull's drive: its usual one about 50% of the time, legs about 20% (less with transports, which never walk); a drone about 15%
  var dv = 0, usual = 0, legs = 0, del = 0, dr = 0;
  ['marksmen', 'shock', 'swarm'].forEach(function (id) {
    for (var i = 0; i < 40; i++) R.rollArmy(3, 2, null, 'pmc', id).forEach(function (k) {
      var sp = R.splitPick(k), p = R.profile(sp.key);
      if (R.canBeDrone(p)) { del++; if (sp.drone) dr++; }
      if (p.cls === 'vehicle' && R.propsFor(p).length) { dv++; if (sp.prop === R.lookDrive(p)) usual++; if (sp.prop === 'walker') legs++; }
    });
  });
  ok('rolled hulls: their usual drive about 50% of the time, legs up to 20%, drones about 15%', usual / dv > 0.4 && usual / dv < 0.66 && legs / dv > 0.06 && legs / dv < 0.28 && dr / del > 0.07 && dr / del < 0.25, true,
    Math.round(100 * usual / dv) + '% usual of ' + dv + ', ' + legs + ' walkers, ' + Math.round(100 * dr / del) + '% drones of ' + del);
  // ...or as its personality says: its own drone % and drive odds, a transport still never on legs
  var oddsAt = function (id, drones, drives) {
    var u = C.unifiedArchetype(id); u.force.drones = drones; u.force.drives = drives; var ch = {}; ch[id] = C.archetypeChange(id, u);
    var o = { dr: 0, del: 0, legs: 0, dv: 0, tlegs: 0 };
    C.withArchetypeChanges(ch, function () {
      for (var i = 0; i < 40; i++) R.rollArmy(3, 2, null, 'pmc', id).forEach(function (k) {
        var sp = R.splitPick(k), p = R.profile(sp.key);
        if (R.canBeDrone(p)) { o.del++; if (sp.drone) o.dr++; }
        if (p.cls === 'vehicle' && R.propsFor(p).length) { o.dv++; if (sp.prop === 'walker') { o.legs++; if (p.transport) o.tlegs++; } }
      });
    });
    return o;
  };
  var allLegs = oddsAt('armour', 100, { usual: 0, wheeled: 0, tracked: 0, grav: 0, hover: 0, walker: 10 }), noDr = oddsAt('armour', 0, { walker: 0 });
  ok('a personality\'s own drone % and drive odds: all drones and legs, then none', [allLegs.dr === allLegs.del && allLegs.del > 0, allLegs.legs > 0 && allLegs.tlegs === 0, noDr.dr, noDr.legs].join(' '), 'true true 0 0');
  var cav4 = 0;
  for (var c4 = 0; c4 < 80; c4++) cav4 += R.rollArmy(3, 2, null, 'pmc', 'aircav').filter(function (k) { var p = R.profile(keyOf(k)); return p.cls !== 'infantry' && p.tier > 3; }).length;
  ok('...and a Cavalry at Tier III takes a Tier IV hull now and then', cav4 > 20 && cav4 < 160, true, cav4 + ' in 80 forces');
  var bigOdd = 0, lowCmd = 0, shockVeh = 0, shockN = 0, mortars = 0, cavH = 0, shockH = 0;
  ['pmc', 'rebel'].forEach(function (f) {
    C.archetypesFor(f).forEach(function (a) {
      for (var t = 2; t <= 4; t++) for (var pl2 = 1; pl2 <= 3; pl2++) {
        var ks2 = R.rollArmy(t, pl2, null, f, a.id);
        ks2.forEach(function (k) {
          var p = R.profile(keyOf(k));
          // (its own is whatever it weighs above 0; it may take its own above the battle's Tier: only an unweighted pick counts here)
          var wE = a.weights[p.key] != null ? a.weights[p.key] : a.weights[p.group];
          var own2 = !!(wE && (Array.isArray(wE) ? wE[0] : wE)) || p.command || p.leaderBug;
          if (!own2 && p.tier > t) { bigOdd++; return; }
          if (p.command && p.tier < t) lowCmd++;
          if (a.id === 'shock' && (p.group === 'Transport vehicles' || p.group === 'Engineering and utility vehicles')) shockVeh++;
          if (a.id === 'swarm' && p.group === 'Remote mortars' && pl2 === 1) mortars++;
          if (p.cls !== 'infantry') { if (a.id === 'aircav') cavH++; if (a.id === 'shock') shockH++; }
        });
        if (a.id === 'shock') shockN++;
      }
    });
  });
  ok('no odd pick from outside a personality is above the battle\'s Tier', bigOdd, 0);
  ok('a personality\'s force is led by a commander of the battle\'s Tier', lowCmd, 0);
  ok('Shock rides to the fight: a transport or engineering vehicle in every force', shockVeh >= shockN, true, shockVeh + ' in ' + shockN);
  ok('Mercenaries take one mortar unit at most at PL1', mortars <= 3, true, mortars + ' in 3 forces');
  ok('Cavalry fields more hulls than Shock', cavH > shockH, true, cavH + ' vs ' + shockH);
  // a weighted shopping list (Bastion): its limits a Priority Level each, and nothing it weighs 0
  var bast = C.archetypesFor('pmc').filter(function (x) { return x.id === 'armour'; })[0], overLim = 0, zero = 0;
  function wOf(p) { var e = bast.weights[p.key] != null ? bast.weights[p.key] : bast.weights[p.group]; return e == null ? 0 : Array.isArray(e) ? e[0] : e; }
  for (var b2 = 0; b2 < 90; b2++) {
    var bt2 = 1 + (b2 % 5), bpl = 1 + (b2 % 3), bk = R.rollArmy(bt2, bpl, null, 'pmc', 'armour');
    var cnt = function (f) { return bk.filter(function (k) { return f(R.profile(keyOf(k))); }).length; };
    if (cnt(function (p) { return p.key === 'sam'; }) > bpl || cnt(function (p) { return p.key === 'gausscannon'; }) > bpl ||
      cnt(function (p) { return p.group === 'Remote mortars'; }) > bpl || cnt(function (p) { return p.group === 'Engineering and utility vehicles'; }) > bpl ||
      cnt(function (p) { return p.group === 'Heavy support'; }) > 2 * bpl) overLim++;
    zero += cnt(function (p) { return !p.command && wOf(p) === 0; });
  }
  ok('Bastion keeps to its limits, a Priority Level each', overLim, 0);
  ok('...and takes nothing it weighs 0 while anything else is legal', zero, 0);
  ok('...and a roll with no personality still works', R.checkArmy(R.rollArmy(3, 2, null, 'pmc', false), 3, 2).ok && !R.rollArmy(3, 2, null, 'pmc', false).style, true);
  ok('a temper for a skirmish force by its personality id', C.aiTemper({ archetype: 'partisans' }).mod, -1);
})();

head('A skirmish force rolled to a personality goes by one of its names');
(function () {
  global.window = global;                       // ui-parts.js is written for the page
  require('../../src/view/ui-parts.js');
  var U = global.PMCUi, a = C.archetypesFor('pmc').filter(function (x) { return x.id === 'shock'; })[0];
  var ks = R.rollArmy(2, 1, null, 'pmc', 'shock');
  var n1 = U.personaName(ks);
  ok('a Shock force is named from the Shock list', a.names.indexOf(n1) >= 0, true, n1);
  ok('...keeps the name it has', U.personaName(ks, n1), n1);
  ok('...takes another when the other side has it', U.personaName(ks, n1, n1) !== n1 && a.names.indexOf(U.personaName(ks, n1, n1)) >= 0, true);
  ok('...and the name counts as made up, so it follows the force', U.isForceName(n1) && U.isPersonaName('The Partisans') && !U.isPersonaName('Task Force Ironhold'), true);
  ok('a force with no personality goes by its colours', U.forceName('jade', 'pmc', R.rollArmy(2, 1, null, 'pmc', false)), U.forceName('jade', 'pmc'));
})();

head('A personality as one object, and an admin\'s changes laid over it');
(function () {
  var u = C.unifiedArchetype('armour');
  ok('Bastion read as one object: what it fields, how it fights, its doctrines, its campaign', !!(u.force && u.force.weights && u.battle && u.doctrines && u.campaign && u.campaign.found), true);
  ok('...and an unchanged one makes no change', JSON.stringify(C.archetypeChange('armour', u)), '{}');
  var before = JSON.stringify(C.archetype('armour'));
  u.force.tier = -1; u.battle.temper = -2; u.force.weights = { bats: 10, protectors: 10 };
  var ch = C.archetypeChange('armour', u);
  ok('a change keeps only what differs', Object.keys(ch).sort().join(','), 'battle,force');
  C.applyArchetypeChanges({ armour: ch });
  var a = C.archetype('armour');
  ok('...applied in place: the tier, the temper and the whole list of weights', [a.tier, a.temper, Object.keys(a.weights).length], [-1, -2, 2]);
  ok('...rolls follow it', R.rollArmy(3, 1, null, 'pmc', 'armour').every(function (k) { var p = R.profile(R.splitPick(k).key); return p.command || ['bats', 'protectors'].indexOf(p.key) >= 0 || p.cls !== 'infantry' || p.tier !== 3; }), true);
  ok('...and who it is never changes', a.id, 'armour');
  C.applyArchetypeChanges({});
  ok('cleared, it is the default again', JSON.stringify(C.archetype('armour')) === before, true);
  var unmapped = [];
  ['pmc', 'rebel', 'bugs', 'xeno'].forEach(function (f) { C.archetypesFor(f).forEach(function (x) {
    Object.keys(x).forEach(function (k) { if (['id', 'name', 'faction'].indexOf(k) < 0 && !C.FIELD_MAP[k] && unmapped.indexOf(k) < 0) unmapped.push(k); });
  }); });
  ok('every field any personality has is in the one object (FIELD_MAP)', unmapped.join(','), '');
  ok('...the lean size too, which the code reads with a default', C.FIELD_MAP.leanSize, 'campaign.leanSize');
  var seen = C.withArchetypeChanges({ armour: { battle: { temper: 3 } } }, function () { return C.archetype('armour').temper; });
  ok('a preview runs with the change and puts it back', [seen, C.archetype('armour').temper], [3, -1]);
})();

head('Campaign rivals recruit by the same weighted list');
(function () {
  function grow(id, f, turns) {
    var co = C.newCompany('W', { faction: f }); C.foundRival(co, id, []);
    for (var t = 0; t < turns; t++) C.idleTurn(co);
    return co;
  }
  function wOf(a, p) { var e = a.weights[p.key] != null ? a.weights[p.key] : a.weights[p.group]; return e == null ? 0 : Array.isArray(e) ? e[0] : e; }
  function limOf(a, k) { var e = a.weights[k]; return Array.isArray(e) ? e[1] : null; }
  var stray = [], over = [];
  ['armour', 'shock', 'redfront', 'pitheads'].forEach(function (id) {
    var a = C.archetype(id), f = a.faction || 'pmc';
    for (var r = 0; r < 4; r++) {
      var co = grow(id, f, 25);
      co.roster.forEach(function (e) {
        var p = R.profile(e.key);
        // the founding units and the commander are its own whatever the list says
        if (p.command || [].concat(a.t1 || [], a.t2 || [], a.machines || []).indexOf(p.key) >= 0) return;
        if (wOf(a, p) <= 0) stray.push(a.name + ': ' + p.name);
      });
      Object.keys(a.weights).forEach(function (k) {
        var lim = limOf(a, k); if (lim == null) return;
        var n = co.roster.filter(function (e) { var p = R.profile(e.key); return p.key === k || p.group === k; }).length;
        if (n > lim * 3) over.push(a.name + ': ' + n + ' ' + k);
      });
    }
  });
  ok('a weighted rival recruits nothing its list weighs 0', stray.length, 0, stray.slice(0, 4).join('; '));
  ok('...and keeps to its limits (three Priority Levels’ worth on its books)', over.length, 0, over.slice(0, 4).join('; '));
  // (a company's growth is a run of rolls: most Bastions grow the mix, not every last one)
  var mixed = 0, groupsHeld = {};
  for (var bi = 0; bi < 5; bi++) {
    var bast = grow('armour', 'pmc', 25);
    groupsHeld = {};
    bast.roster.forEach(function (e) { groupsHeld[R.profile(e.key).group] = 1; });
    if (groupsHeld['Heavy infantry'] && (groupsHeld['Heavy support'] || groupsHeld['Light support']) && (groupsHeld['Hunters and destroyers'] || groupsHeld['Support vehicles'])) mixed++;
  }
  ok('a Bastion rival grows a mix: armour, support infantry and hulls', mixed >= 3, true, mixed + ' of 5; the last: ' + Object.keys(groupsHeld).join(', '));
  var merc = grow('swarm', 'pmc', 30);
  ok('a recruiting company grows to a size that suits its Tier, not a hundred Recruits', merc.roster.length <= 12 + 7 * merc.tier + 4, true, merc.roster.length + ' units at Tier ' + merc.tier);
})();

head('Campaign rivals work towards their next Company Tier');
(function () {
  // grown until money is all that stands between it and its next Tier
  var co = C.newCompany('B', { faction: 'pmc' }); C.foundRival(co, 'armour', []);
  var pc = C.canPromoteCompany(co), g = 0;
  while (g++ < 60) {
    C.idleTurn(co); pc = C.canPromoteCompany(co);
    if (co.tier >= 3 && !pc.ok && pc.faults.every(function (f) { return /costs/.test(f); })) break;
  }
  ok('a rival reaches the point where only the money is short', !pc.ok && pc.faults.every(function (f) { return /costs/.test(f); }), true, (pc.faults || []).join(' | '));
  co.kUC = pc.cost - 5;
  var before = co.kUC, n0 = co.roster.length;
  C.developRival(co);
  ok('...then it banks: nothing bought, nothing hired', [co.kUC, co.roster.length], [before, n0]);
  co.kUC = pc.cost + 2;
  var t0 = co.tier;
  C.developRival(co);
  ok('...and promotes the moment it can afford to', co.tier, t0 + 1);
  // short of an army for the next Tier: it buys that army first
  var y = C.newCompany('Y', { faction: 'pmc' }); C.foundRival(y, 'swarm', []);
  y.kUC = 40;
  var did = C.developRival(y).map(function (d) { return d.text; }).join(' | ');
  ok('a rival short of a Tier II army buys towards it', /towards Company Tier II/.test(did) || y.tier === 2, true, did.slice(0, 200));
})();

head('Rebel Tactics by personality and part in the scenario');
(function () {
  function tally(id, roles) {
    var co = C.newCompany('T', { faction: 'rebel' }); C.foundRival(co, id, []);
    var n = {}; for (var i = 0; i < 400; i++) { var t = C.aiTactic(co, roles, 'B'); n[t] = (n[t] || 0) + 1; }
    return n;
  }
  var open = null, atk = { attacker: 'B' }, def = { attacker: 'A' };
  var rf = tally('redfront', atk), rd = tally('redfront', def);
  ok('the Red Front attacks in waves and digs in when held, most of the time', rf.wave > 300 && rd.laststand > 300, true, JSON.stringify(rf) + ' / ' + JSON.stringify(rd));
  var pg = tally('partisans', open), pd = tally('partisans', def);
  ok('the Partisans come out of the tunnels, and on defence split Guerillas and Last Stand', pg.guerillas > 300 && pd.guerillas > 120 && pd.laststand > 120, true, JSON.stringify(pg) + ' / ' + JSON.stringify(pd));
  var ta = tally('turncoats', atk), to = tally('turncoats', open);
  ok('the Turncoats dig in in the open, and attack in waves or by infiltration', to.laststand > 300 && ta.wave > 120 && ta.guerillas > 120, true, JSON.stringify(to) + ' / ' + JSON.stringify(ta));
  var fd = tally('freespace', def);
  ok('Free Space rushes even on defence, and never goes Guerilla (its riders take nothing from it)', fd.wave > 300 && !fd.guerillas, true, JSON.stringify(fd));
  ok('...and a PMC company takes no Rebel Tactic', C.aiTactic(C.newCompany('P', {}), atk, 'B'), null);
})();

// Demolish (p. 54): the objective's SAM system shoots every aircraft near it, so a force picked for it leaves its aircraft at home
(function () {
  var co = C.newCompany('T', { faction: 'pmc' }); C.foundRival(co, 'aircav', []); C.catchUp(co, 2);
  co.kUC = 999; C.recruit(co, 'adaptedcraft');
  var air = function (list) { return list.filter(function (e) { return R.profile(e.key).cls === 'aircraft'; }).length; };
  var legal = function (list) { return R.checkArmy(list.map(function (e) { return R.entryPick(e); }), 2, 1, co.doctrines || []).ok; };
  var any = false;
  for (var i = 0; i < 10 && !any; i++) any = air(C.pickForce(co, 2, 1, null)) > 0;
  ok('a Cavalry force takes its transport craft into an ordinary battle', any, true);
  var dem = C.pickForce(co, 2, 1, null, { scenario: 'demolish' });
  ok('...but none into Demolish, and the army is still legal', [air(dem), legal(dem)], [0, true]);
})();
// Saving for a Company Tier no longer stops a force that rides replacing the hulls it has lost
(function () {
  var hulls = 0, set = 0;
  for (var n = 0; n < 6; n++) {
    var co = C.newCompany('T', { faction: 'pmc' }); C.foundRival(co, 'aircav', []); C.catchUp(co, 2);
    co.kUC = 999;
    for (var i = 0; i < 8 && !C.canPromoteCompany(co).ok; i++) C.recruit(co, 'regular');
    co.roster = co.roster.filter(function (e) { return R.profile(e.key).cls === 'infantry'; });
    co.kUC = 80;
    if (C.canPromoteCompany(co).ok) set++;
    C.developRival(co);
    hulls += co.roster.filter(function (e) { return R.profile(e.key).cls !== 'infantry'; }).length;
  }
  ok('a Cavalry company with every hull lost, the money there for its next Tier...', set, 6);
  ok('...buys hulls back even while it saves for the promotion', hulls >= 6, true, hulls + ' hulls over 6 companies');
})();
ok('Special Ops plays the behaviour table untempered', C.aiTemper({ archetype: 'marksmen' }), null);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
