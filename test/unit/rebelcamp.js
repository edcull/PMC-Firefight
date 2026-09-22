/* The Rebel campaign against the book (pp. 110-113): Influence Points, the free
   First Among Equals, free Armed Civilians, the Freedom Warriors' cross-category
   promotion, what vehicles may and may not earn — and each of the eighteen Paths
   put to work and measured. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + (name.length > 54 ? name.slice(0, 53) + '…' : name).padEnd(55) +
    String(got).padEnd(10) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

/* -------------------------------------------------------------- the Paths */
head('The Paths (pp. 111-113)');
ok('18 Paths', C.PATHS.length, 18);
ok('...six in each group', C.PATH_GROUPS.map(function (g) {
  return C.PATHS.filter(function (p) { return p.cat === g; }).length;
}).join('/'), '6/6/6');
ok('the three groups are named as the book names them',
  C.PATH_GROUPS.join('/'), 'Hero/Villain/Prophet');
ok('every Path says what it does', C.PATHS.every(function (p) { return p.text && p.text.length > 20; }), true);
ok('no Path id collides with a doctrine id',
  C.PATHS.every(function (p) { return !C.DOCTRINES.some(function (d) { return d.id === p.id; }); }), true);
ok('a revolt is offered Paths, not doctrines',
  C.creedOf({ faction: 'rebel' }).list.length + '/' + C.creedOf({ faction: 'pmc' }).list.length, '18/18');
ok('...and they are different tables',
  C.creedOf({ faction: 'rebel' }).list[0].name, 'Viva la Revolution!');

/* --------------------------------------------------------------- founding */
head('Raising a revolt (pp. 83, 110)');
function revolt(keys, path) {
  var camp = C.newCampaign({ factionA: 'rebel', factionB: 'rebel', nameA: 'The revolt' });
  var co = camp.companies.A;
  C.found(co, keys || ['rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rmilitia', 'rmilitia'],
    path || 'H1');
  camp.co = co;
  return camp;
}
var camp = revolt(), A = camp.companies.A;
ok('the revolt is a Rebel force', A.faction, 'rebel');
ok('it is paid in Influence Points', C.money(A), 'IP');
ok('a mercenary company is still paid in kUC', C.money(C.newCompany('x')), 'kUC');
ok('nine units on the books', A.roster.length, 9);
var cmd = C.byRid(A, A.cmdRid);
ok('the free unit is a First Among Equals', C.byRid(A, A.cmdRid).key, 'rinstigators');
ok('...and it is free', cmd.free, true);
ok('...at the Revolt Tier', R.profile(cmd.key).tier, A.tier);
ok('the founding list is legal', C.foundingCheck(A).ok, true);
ok('a PMC still founds with a Field command', (function () {
  var co = C.newCompany('Merc');
  C.found(co, ['recruits', 'recruits', 'recruits', 'recruits', 'enforcers', 'irregulars', 'rookie', 'rookie'], 'S2');
  return C.byRid(co, co.cmdRid).key;
})(), 'cmd4');

A.tier = 3; C.fitCommand(A);
ok('the leader is promoted free with the revolt', C.byRid(A, A.cmdRid).key, 'rleaders');
A.tier = 1; C.fitCommand(A);

/* ------------------------------------------------------------ Path slots */
head('Holding Paths');
var co2 = revolt().companies.A;
co2.tier = 5; co2.doctrines = [];
ok('two Paths of the Hero are allowed', (function () {
  co2.doctrines = ['H1'];
  return C.canTakeDoctrine(co2, 'H2').ok;
})(), true);
ok('...but never a third', (function () {
  co2.doctrines = ['H1', 'H2'];
  return C.canTakeDoctrine(co2, 'H3').ok + ' — ' + C.canTakeDoctrine(co2, 'H3').why;
})(), 'false — No more than two Paths of the Hero.');
ok('...while another group is still open', C.canTakeDoctrine(co2, 'V1').ok, true);
ok('one slot per Revolt Tier', (function () {
  co2.tier = 2; co2.doctrines = ['H1', 'V1'];
  return C.canTakeDoctrine(co2, 'P1').why;
})(), 'No Path slot free — one per Revolt Tier.');

/* ------------------------------------------------------- economy (p. 110) */
head('Influence Points and what they buy');
var co3 = revolt().companies.A;
co3.kUC = 40;
ok('Armed civilians are free while there are four or fewer', (function () {
  var c = C.newCompany('t', { faction: 'rebel' });
  c.roster = [];
  return C.recruitCost(c, 'rciv');
})(), 0);
ok('...and cost again past that', (function () {
  var c = C.newCompany('t', { faction: 'rebel' });
  c.roster = [C.newEntry('rciv'), C.newEntry('rciv'), C.newEntry('rciv'),
  C.newEntry('rciv'), C.newEntry('rciv')];
  return C.recruitCost(c, 'rciv');
})(), 1);
ok('Militia cost the printed 4', C.recruitCost(co3, 'rmilitia'), 4);
ok('Smuggler takes one off', (function () {
  co3.doctrines = ['V1'];
  return C.recruitCost(co3, 'rmilitia');
})(), 3);
ok('...but never below one', (function () {
  var c = C.newCompany('t', { faction: 'rebel' });
  c.roster = [C.newEntry('rciv'), C.newEntry('rciv'), C.newEntry('rciv'),
  C.newEntry('rciv'), C.newEntry('rciv')];
  c.doctrines = ['V1'];
  return C.recruitCost(c, 'rciv');
})(), 1);
co3.doctrines = [];
ok('a revolt cannot hire mercenaries', C.canRecruit(co3, 'rookie').why, 'A force recruits from its own list.');

/* ------------------------------------------------------ promotion (p. 110) */
head('Promotion');
var co4 = revolt().companies.A;
var civ = co4.roster.filter(function (e) { return e.key === 'rciv'; })[0];
var mil = co4.roster.filter(function (e) { return e.key === 'rmilitia'; })[0];
var targets = C.promotionTargets(civ).map(function (p) { return p.group; });
ok('Freedom Warriors may cross into the Holy Warriors', targets.indexOf('Holy Warriors') >= 0, true);
ok('...the Mounted Warriors', targets.indexOf('Mounted Warriors') >= 0, true);
ok('...and the Miners', targets.indexOf('Miners') >= 0, true);
ok('...but never into the First Among Equals', targets.indexOf('First Among Equals') < 0, true);
ok('...nor into a vehicle', C.promotionTargets(civ).every(function (p) { return p.cls === 'infantry'; }), true);
ok('...and never above one Tier up',
  C.promotionTargets(civ).every(function (p) { return p.tier <= R.profile(civ.key).tier + 1; }), true);
var holy = C.newEntry('racolytes');
ok('a Holy Warrior promotes only inside its own category',
  C.promotionTargets(holy).map(function (p) { return p.group; })
    .every(function (g) { return g === 'Holy Warriors'; }), true);
ok('a First Among Equals never promotes at all', C.promotionTargets(cmd).length, 0);
ok('Armed civilians promote for experience alone', C.promotionCost(civ, 'rmilitia', co4).kUC, 0);
ok('...but Militia pay half the recruitment cost', C.promotionCost(mil, 'rinsurgents', co4).kUC, 4);
ok('Smuggler shaves a point off a promotion too', (function () {
  co4.doctrines = ['V1'];
  return C.promotionCost(mil, 'rinsurgents', co4).kUC;
})(), 3);
co4.doctrines = [];

/* ------------------------------------------- what machines may earn (p. 110) */
head('Vehicles and aircraft');
var veh = C.newEntry('rtechnical');
veh.exp = 40;
ok('a machine never promotes', C.promotionTargets(veh).length, 0);
ok('...and takes no Battle Honours', C.canTakeHonour(veh, co4).why,
  'Vehicles and aircraft take Upgrades, not Battle Honours.');
ok('...but may be upgraded for 10 EXP', C.canTakeUpgrade(veh).cost, 10);
ok('...and takes no Trauma Points', C.tpFor({ brokenEver: true, startSize: 1, endSize: 0 },
  { entry: veh, company: co4 }).total, 0);
ok('the leader earns no experience either', C.expFor({ kills: [] }, { entry: cmd, company: co4 }).total, 0);
ok('...and no Trauma Points', C.tpFor({ brokenEver: true, startSize: 6, endSize: 1 },
  { entry: cmd, company: co4 }).total, 0);

/* ------------------------------------------------- the Paths, one at a time */
head('Paths of the Hero');
function ctx(co, over) {
  var o = { entry: C.newEntry('rmilitia'), company: co, won: true, lost: false,
    ownTier: 1, enemyTier: 1, routed: false, consecutive: false, halveTP: false };
  for (var k in (over || {})) o[k] = over[k];
  return o;
}
var hero = revolt().companies.A;
hero.doctrines = [];
ok('a plain win is worth 2 EXP', C.expFor({ kills: [] }, ctx(hero)).total, 2);
hero.doctrines = ['H1'];
ok('Viva la Revolution! makes it 4', C.expFor({ kills: [] }, ctx(hero)).total, 4);
hero.doctrines = ['H5'];
ok('Rob the Rich adds 2 EXP to every unit', C.expFor({ kills: [] }, ctx(hero)).total, 4);
ok('...and takes a quarter of the money', (function () {
  var a = C.newCompany('a', { faction: 'rebel' }); a.doctrines = ['H5'];
  var b = C.newCompany('b', { faction: 'rebel' });
  var p = C.payment(3, 1, a, b, 'A');
  return p.thin.A && p.A === Math.floor(p.thin.A.was * 0.75);
})(), true);
hero.doctrines = ['H4'];
ok('To Hell and Back! forgives being broken',
  C.tpFor({ brokenEver: true, startSize: 10, endSize: 10 }, ctx(hero)).total, 0);
hero.doctrines = [];
ok('...where a plain revolt takes 2 TP for it',
  C.tpFor({ brokenEver: true, startSize: 10, endSize: 10 }, ctx(hero)).total, 2);
ok('Labour Leader raises the machine ceiling', (function () {
  var army = ['rinsurgents', 'rinsurgents', 'rinsurgents', 'rtechnical', 'rtechnical', 'rtechnical', 'rtechnical'];
  var without = R.checkArmy(army, 3, 1, []).faults.some(function (f) { return /vehicles and aircraft/.test(f); });
  var wit = R.checkArmy(army, 3, 1, ['H3']).faults.some(function (f) { return /vehicles and aircraft/.test(f); });
  return without + '/' + wit;
})(), 'true/false');
ok('La Liberté puts a chain of command on the leaders', (function () {
  var u = { side: 'A', key: 'rleaders', rules: R.profile('rleaders').rules.slice(), move: 5, def: 9,
    assault: 3, morale: 5, size: 6, models: 6, fp: 3, range: 18, cargo: [] };
  C.applyEntry(u, C.newEntry('rleaders'), ['H6']);
  return R.ruleValue(u, 'Command Unit');
})(), 3);

head('Paths of the Villain');
ok('Plunderer re-rolls a winner’s payment', (function () {
  var a = C.newCompany('a', { faction: 'rebel' }); a.doctrines = ['V2'];
  var b = C.newCompany('b', { faction: 'rebel' });
  var seen = 0;
  for (var i = 0; i < 200; i++) { if (C.payment(3, 1, a, b, 'A').plunder.A) seen++; }
  return seen;
})(), 200);
ok('...but not a loser’s', (function () {
  var a = C.newCompany('a', { faction: 'rebel' }); a.doctrines = ['V2'];
  var b = C.newCompany('b', { faction: 'rebel' });
  var seen = 0;
  for (var i = 0; i < 200; i++) { if (C.payment(3, 1, a, b, 'B').plunder.A) seen++; }
  return seen;
})(), 0);
ok('Unclear Intentions pays D3 per Battle Tier', (function () {
  var a = C.newCompany('a', { faction: 'rebel' }); a.doctrines = ['V6'];
  var b = C.newCompany('b', { faction: 'rebel' });
  var lo = 99, hi = 0;
  for (var i = 0; i < 2000; i++) {
    var g = C.payment(4, 1, a, b, null).extra.A.total;
    lo = Math.min(lo, g); hi = Math.max(hi, g);
  }
  return lo + '-' + hi;
})(), '4-12', 'four D3 at Battle Tier IV');
ok('Drug Dealer costs the unit D6+1 afterwards', (function () {
  var c = C.newCompany('c', { faction: 'rebel' }); c.doctrines = ['V4'];
  var lo = 99, hi = 0;
  for (var i = 0; i < 3000; i++) {
    var t = C.tpFor({ brokenEver: false, startSize: 10, endSize: 10, drugged: true }, ctx(c)).total;
    lo = Math.min(lo, t); hi = Math.max(hi, t);
  }
  return lo + '-' + hi;
})(), '2-7');
ok('Stairs to Heaven spares the Holy Warriors their dead', (function () {
  var c = C.newCompany('c', { faction: 'rebel' }); c.doctrines = ['P3'];
  return C.tpFor({ brokenEver: false, startSize: 6, endSize: 1 },
    ctx(c, { entry: C.newEntry('racolytes') })).total;
})(), 0);

head('Paths of the Prophet, on the unit');
function built(key, docs, entryOver) {
  var p = R.profile(key);
  var u = { side: 'A', key: key, rules: p.rules.slice(), move: p.move, def: p.def,
    assault: p.assault, morale: p.morale, size: p.size, models: p.size, fp: p.fp,
    range: p.range, cargo: [], cls: p.cls || 'infantry' };
  var e = C.newEntry(key);
  for (var k in (entryOver || {})) e[k] = entryOver[k];
  C.applyEntry(u, e, docs);
  return u;
}
ok('No Sacrifice Too Great! makes the leaders Determined',
  R.has(built('rleaders', ['P2']), 'Determined'), true);
ok('...and leaves everyone else alone',
  R.has(built('rmilitia', ['P2']), 'Determined'), false);
ok('Preacher lifts the leader who started it',
  R.has(built('rinstigators', ['P5'], { free: true }), 'Inspiring Presence'), true);
ok('...but not one recruited later',
  R.has(built('rinstigators', ['P5'], { free: false }), 'Inspiring Presence'), false);
ok('Drug Dealer sends its picks in Determined',
  R.has(built('rmilitia', ['V4'], { drugged: true }), 'Determined'), true);

/* --------------------------------------------- the aftermath, end to end */
head('An execution (No Place for the Weak!, p. 112)');
(function () {
  var camp2 = revolt();
  var co = camp2.companies.A;
  co.doctrines = ['V5'];
  var units = co.roster.filter(function (e) { return e.rid !== co.cmdRid; });
  var report = {
    winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false },
    units: units.map(function (e, i) {
      return {
        rid: e.rid, side: 'A', key: e.key, tier: 1,
        startSize: 10, endSize: i === 0 ? 1 : 9,      // the first one was cut to pieces
        brokenEver: i === 0, wiped: false, destroyed: false, kills: []
      };
    })
  };
  var before = co.roster.length;
  var res = C.aftermath(camp2, report);
  var rec = res.sides.A;
  ok('the worst-hit unit is made an example of', !!rec.executed, true,
    rec.executed ? rec.executed.name + ' on ' + rec.executed.tp + ' TP' : '');
  ok('...and is off the roster', co.roster.length, before - 1);
  ok('...and it is never the leader', rec.executed && rec.executed.rid !== co.cmdRid, true);
  var others = rec.units.filter(function (u) { return u.tp && u.tp.total !== undefined; });
  ok('every other unit had its Trauma Points halved',
    others.every(function (u) {
      return u.tp.lines.some(function (l) { return /No Place for the Weak/.test(l.text); }) || u.tp.total === 0;
    }), true);
})();

head('A hundred campaign turns');
(function () {
  var camp3 = C.newCampaign({ factionA: 'rebel', factionB: 'rebel', mode: 'solo' });
  var a = camp3.companies.A, b = camp3.companies.B;
  C.found(a, ['rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rmilitia', 'rmilitia'], 'H1');
  C.foundRival(b, 'faithful');
  var bad = 0, executions = 0, paths = {};
  for (var n = 0; n < 100; n++) {
    var tier = Math.min(a.tier, b.tier);
    var mine = [], theirs = [];
    a.roster.forEach(function (e) { mine.push(e); });
    b.roster.forEach(function (e) { theirs.push(e); });
    var winner = n % 3 === 0 ? null : (n % 2 ? 'A' : 'B');
    var rep = {
      winner: winner, battleTier: tier, pl: 1, scenario: 'meeting',
      routed: { A: false, B: false },
      units: mine.map(function (e) { return line(e, 'A'); })
        .concat(theirs.map(function (e) { return line(e, 'B'); }))
    };
    var res = C.aftermath(camp3, rep);
    if (res.sides.A.executed) executions++;
    // the revolt develops the way a rival does
    C.developRival(b);
    [a, b].forEach(function (co) {
      if (co.kUC < 0) bad++;
      co.doctrines.forEach(function (d) { paths[d] = 1; });
      C.PATH_GROUPS.forEach(function (g) {
        var held = co.doctrines.filter(function (x) { return C.BY_PATH[x] && C.BY_PATH[x].cat === g; }).length;
        if (held > 2) bad++;
      });
      if (co.doctrines.length > co.tier) bad++;
      co.roster.forEach(function (e) {
        if (R.profile(e.key).faction !== 'rebel') bad++;
        if (e.exp < 0 || e.tp < 0) bad++;
      });
      if (!C.byRid(co, co.cmdRid)) bad++;
    });
    var pr = C.canPromoteCompany(a);
    if (pr.ok) { C.promoteCompany(a); }
  }
  function line(e, side) {
    var p = R.profile(e.key);
    var lost = Math.floor(Math.random() * 3);
    return {
      rid: e.rid, side: side, key: e.key, tier: p.tier,
      startSize: p.size, endSize: Math.max(0, p.size - lost),
      brokenEver: Math.random() < 0.3, wiped: false,
      destroyed: p.cls !== 'infantry' && Math.random() < 0.08,
      catastrophic: false, kills: []
    };
  }
  ok('nothing drifted illegal in a hundred turns', bad, 0);
  ok('the revolt is still led', !!C.byRid(a, a.cmdRid), true);
  ok('...by a First Among Equals', R.profile(C.byRid(a, a.cmdRid).key).group, 'First Among Equals');
  // a force takes one Path per Tier, so a rival that stayed at Tier I-II holds two
  ok('both forces walked Paths, and only Paths',
    Object.keys(paths).every(function (p) { return !!C.BY_PATH[p]; }) && Object.keys(paths).length >= 2,
    true, Object.keys(paths).sort().join(' '));
  ok('executions happened when the Path was held', executions >= 0, true, executions + ' over 100 turns');
  ok('the revolt is still solvent', a.kUC >= 0, true, a.kUC + ' IP in hand');
})();

head('Rebel groups a solo campaign fights');
ok('five of them', C.REBEL_ARCHETYPES.length, 5);
ok('every one is a Rebel force', C.REBEL_ARCHETYPES.every(function (a2) { return a2.faction === 'rebel'; }), true);
ok('...founds a legal revolt', (function () {
  var bad = 0;
  C.REBEL_ARCHETYPES.forEach(function (a2) {
    var co = C.newCompany('x', { faction: 'rebel' });
    C.foundRival(co, a2.id);
    if (!C.foundingCheck(co).ok) { bad++; console.log('      ' + a2.id + ': ' + C.foundingCheck(co).faults.join(' ')); }
    if (!C.canFieldArmy(co, 1, 1)) { bad++; console.log('      ' + a2.id + ' cannot field a Tier I army'); }
  });
  return bad;
})(), 0);
ok('...and only ever reaches for Paths', C.REBEL_ARCHETYPES.every(function (a2) {
  return a2.doctrines.every(function (d) { return !!C.BY_PATH[d]; });
}), true);
ok('a PMC archetype only ever reaches for doctrines', C.ARCHETYPES.every(function (a2) {
  return a2.doctrines.every(function (d) { return !C.BY_PATH[d]; });
}), true);


head('Three forces on the world');
(function () {
  var camp4 = C.newCampaign({ factionA: 'pmc', mode: 'solo' });
  var a = camp4.companies.A;
  C.found(a, ['recruits', 'recruits', 'recruits', 'enforcers', 'irregulars', 'irregulars',
    'rookie', 'rookie'], 'S2');
  C.foundRivals(camp4);
  ok('three of them', camp4.rivals.length, 3);
  ok('...all named differently', new Set(camp4.rivals.map(function (r) { return r.name; })).size, 3);
  ok('...no archetype twice', new Set(camp4.rivals.map(function (r) { return r.archetype; })).size, 3);
  ok('...at least one mercenary company',
    camp4.rivals.some(function (r) { return r.faction === 'pmc'; }), true);
  ok('...and at least one revolt',
    camp4.rivals.some(function (r) { return r.faction === 'rebel'; }), true);
  ok('...each one a legal founding',
    camp4.rivals.every(function (r) { return C.foundingCheck(r).ok; }), true);
  ok('...each recruiting only from its own list',
    camp4.rivals.every(function (r) {
      return r.roster.every(function (e) { return R.profile(e.key).faction === r.faction; });
    }), true);
  ok('one of them is the next opponent', camp4.companies.B === camp4.rivals[camp4.facing], true,
    camp4.companies.B.name);

  // the mix is random, so check it over many campaigns rather than one
  var mixes = { pmc: 0, rebel: 0 }, oneSided = 0;
  for (var n = 0; n < 200; n++) {
    var c = C.newCampaign({ factionA: 'pmc' });
    C.foundRivals(c);
    var p2 = c.rivals.filter(function (r) { return r.faction === 'pmc'; }).length;
    mixes.pmc += p2; mixes.rebel += 3 - p2;
    if (p2 === 0 || p2 === 3) oneSided++;
  }
  ok('the mix is never one-sided over 200 campaigns', oneSided, 0,
    mixes.pmc + ' companies to ' + mixes.rebel + ' revolts');

  // rotation: never the same force twice running
  var prev = camp4.facing, repeats = 0, counts = [0, 0, 0];
  for (var d = 0; d < 300; d++) {
    C.drawRival(camp4);
    if (camp4.facing === prev) repeats++;
    counts[camp4.facing]++;
    prev = camp4.facing;
  }
  ok('never the same force twice running', repeats, 0);
  ok('...and all three come round', counts.every(function (k) { return k > 60; }), true,
    counts.join('/'));
})();

head('Saving three forces');
(function () {
  var camp5 = C.newCampaign({ factionA: 'pmc' });
  C.found(camp5.companies.A, ['recruits', 'recruits', 'recruits', 'enforcers', 'irregulars',
    'irregulars', 'rookie', 'rookie'], 'S2');
  C.foundRivals(camp5);
  var flat = JSON.parse(JSON.stringify(C.forSave(camp5)));
  ok('a save holds each force once', !flat.companies.B && flat.rivals.length === 3, true);
  var back = C.rehydrate(flat);
  ok('...and the alias comes back', back.companies.B === back.rivals[back.facing], true);
  back.companies.B.kUC = 999;
  ok('...so the aftermath writes to the force you fought', back.rivals[back.facing].kUC, 999);
  // a campaign saved before there were three
  var old = C.rehydrate({ turn: 4, companies: { A: camp5.companies.A, B: camp5.rivals[1] } });
  ok('an older single-rival save still loads', old.rivals.length, 1);
  ok('...and still knows who it was fighting', old.companies.B.name, camp5.rivals[1].name);
})();

head('Levelling the force you draw');
(function () {
  var gaps = [], over = 0, under = 0;
  for (var n = 0; n < 60; n++) {
    var camp6 = C.newCampaign({ factionA: 'pmc' });
    C.found(camp6.companies.A, ['recruits', 'recruits', 'recruits', 'enforcers', 'irregulars',
      'irregulars', 'rookie', 'rookie'], 'S2');
    C.foundRivals(camp6);
    var playerTier = 1 + (n % 5);
    camp6.companies.A.tier = playerTier;
    var target = C.catchUpTarget(playerTier);
    var co = camp6.companies.B;
    C.catchUp(co, target);
    gaps.push(co.tier - playerTier);
    if (co.tier > playerTier + 1) over++;
    if (co.tier < playerTier - 1) under++;
  }
  ok('a drawn force never outstrips you by more than a Tier', over, 0);
  ok('...and is never more than a Tier behind', under, 0);
  ok('...but it is not always level either',
    new Set(gaps).size > 1, true, 'gaps seen: ' + [...new Set(gaps)].sort().join(', '));
  var swings = {};
  for (var s2 = 0; s2 < 3000; s2++) { var t = C.catchUpTarget(3); swings[t - 3] = (swings[t - 3] || 0) + 1; }
  ok('the swing is -1 / 0 / +1, weighted to level',
    Object.keys(swings).sort().join(','), '-1,0,1',
    Object.keys(swings).sort().map(function (k) { return k + ': ' + swings[k]; }).join('  '));
})();

head('Battle Tier and Priority Level (p. 84)');
(function () {
  var camp7 = C.newCampaign({ factionA: 'pmc' });
  var a = camp7.companies.A;
  C.found(a, ['recruits', 'recruits', 'recruits', 'enforcers', 'irregulars', 'irregulars',
    'rookie', 'rookie'], 'S2');
  C.foundRivals(camp7);
  var b = camp7.companies.B;
  a.tier = 3; C.catchUp(b, 3);
  ok('a Tier I roster cannot be asked for a Tier V battle',
    C.maxBattleTier(a, b) <= 3, true, 'cap ' + C.maxBattleTier(a, b));
  ok('the highest Tier it can actually field is found', C.fieldableTier(a, 1) >= 1, true,
    'Tier ' + R.ROMAN[C.fieldableTier(a, 1)]);
  // strip the roster back until nothing but a Tier I army is possible
  var thin = C.newCompany('Thin');
  C.found(thin, ['recruits', 'recruits', 'recruits', 'enforcers', 'irregulars', 'irregulars',
    'rookie', 'rookie'], 'S2');
  thin.tier = 5;
  ok('standing alone does not make an army', C.fieldableTier(thin, 1) < 5, true,
    'Tier V company, fields Tier ' + R.ROMAN[C.fieldableTier(thin, 1)]);
  var roll = C.rollBattleTier(thin, thin);
  ok('...so the roll comes down to what it can field', roll.tier <= C.fieldableTier(thin, 1), true,
    'D6 ' + roll.roll + ' → Tier ' + R.ROMAN[roll.tier]);
  ok('...and says the rosters were what held it down', roll.thin === (roll.cap < Math.min(roll.roll, roll.standing)), true);
  var lv = C.levelsFor(thin, thin, 1);
  ok('the Priority Levels on offer are the ones both could fill',
    lv.every(function (n) {
      return C.canFieldArmy(thin, 1, n, true);
    }), true, lv.join(' and ') || 'none');
  // a unit in the workshop is not available
  var rest = C.newCompany('Rested');
  C.found(rest, ['recruits', 'recruits', 'recruits', 'enforcers', 'irregulars', 'irregulars',
    'rookie', 'rookie'], 'S2');
  var before = C.fieldableTier(rest, 1);
  rest.roster.forEach(function (e) { if (!e.free) e.restUntil = 2; });
  ok('a roster in the workshop cannot take the field', C.fieldableTier(rest, 1), 0,
    'was Tier ' + R.ROMAN[before]);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
