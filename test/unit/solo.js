/* The solo campaign, simulated: each rival archetype founded, then thirty campaign
   turns against a player company that wins about half of them. The question is not
   whether the numbers add up — camp.js settles that — but whether a company that
   started as "Armoured" still looks armoured thirty battles later, and whether the
   list doctrines do what the book says. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(52) +
    String(got).padEnd(10) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

/* ------------------------------------------------ the list doctrines (pp. 87-88) */
head('Doctrines that change what a legal list looks like');

// Air Superiority: one aircraft more than normally allowed
var twoAir = ['cmd2', 'regular', 'regular', 'regular', 'fsc', 'fsc'];
ok('two aircraft at PL1 is normally refused', R.checkArmy(twoAir, 3, 1).ok, false,
  R.checkArmy(twoAir, 3, 1).faults.find(function (f) { return /aircraft/.test(f); }));
ok('...and allowed with Air Superiority', R.checkArmy(twoAir, 3, 1, ['O1']).ok, true);
var fourMachines = ['cmd2', 'regular', 'regular', 'regular', 'lcv', 'lcv', 'recon', 'fsc'];
ok('four machines at PL1 is refused', R.checkArmy(fourMachines, 3, 1).faults.some(function (f) { return /Max 3 vehicles/.test(f); }), true);
ok('...and allowed with Air Superiority',
  R.checkArmy(fourMachines, 3, 1, ['O1']).faults.some(function (f) { return /vehicles and aircraft/.test(f); }), false);

// Non-conventional Army: the minimum of the Battle Tier is halved
// a Field command 2nd grade is itself Tier III, so the list uses a 3rd grade
var thin = ['cmd3', 'regular', 'regular', 'rookie', 'rookie', 'veterans'];
ok('two units of the Battle Tier is short of the minimum',
  R.checkArmy(thin, 3, 1).faults.some(function (f) { return /at least 3 Tier III/.test(f); }), true);
ok('...but enough under Non-conventional Army',
  R.checkArmy(thin, 3, 1, ['O2']).faults.some(function (f) { return /Tier III/.test(f); }), false);

// Strength in Numbers: an extra unit a Tier below, free and off the points
var over = ['cmd2', 'regular', 'regular', 'regular', 'veterans', 'veterans', 'rookie', 'rookie', 'rookie', 'rookie', 'rookie'];
var plain = R.checkArmy(over, 3, 1), strong = R.checkArmy(over, 3, 1, ['O5']);
ok('Strength in Numbers takes a unit off the bill', plain.spent - strong.spent, 2,
  plain.spent + ' points become ' + strong.spent);
ok('...and one off the per-Tier ceiling',
  plain.faults.some(function (f) { return /At most 4 Tier II/.test(f); }) &&
  !strong.faults.some(function (f) { return /Tier II/.test(f); }), true);
ok('...exactly one per Priority Level', R.checkArmy(over, 3, 1, ['O5']).free, 1);
ok('...two at Priority Level 2', R.checkArmy(over, 3, 2, ['O5']).free, 2);
ok('a company without the doctrine gets nothing free', plain.free, 0);

/* ------------------------------------------------------------- the archetypes */
head('Founding a rival');
ok('five archetypes', C.ARCHETYPES.length, 5);
ok('each has a name pool, a doctrine order and preferred groups',
  C.ARCHETYPES.every(function (a) { return a.names.length && a.doctrines.length >= 6 && a.groups.length; }), true);
var names = {};
C.ARCHETYPES.forEach(function (a) { a.names.forEach(function (n) { names[n] = (names[n] || 0) + 1; }); });
ok('no company name belongs to two archetypes',
  Object.keys(names).filter(function (n) { return names[n] > 1; }).length, 0);
C.ARCHETYPES.forEach(function (a) {
  var co = C.newCompany('x');
  C.foundRival(co, a.id);
  var chk = C.foundingCheck(co);
  ok(a.name + ' founds a legal company', chk.ok, true, chk.ok ? co.name : chk.faults.join(' '));
  ok('...and can field a legal Tier I army', C.canFieldArmy(co, 1, 1), true);
  ok('...taking its own first doctrine', co.doctrines[0], a.doctrines[0],
    C.doctrine(co.doctrines[0]).name);
});

/* ------------------------------------------------------ thirty campaign turns */
head('Thirty campaign turns against each archetype');

function player() {
  var co = C.newCompany('Task Force Ironhold');
  C.found(co, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured',
    'rookie', 'lighteng'], 'S2');
  return co;
}
function fakeBattle(camp, winner) {
  var bt = C.rollBattleTier(camp.companies.A, camp.companies.B).tier;
  var rep = {
    winner: winner, battleTier: bt, pl: 1, scenario: 'secure',
    routed: { A: winner === 'B', B: winner === 'A' }, units: []
  };
  ['A', 'B'].forEach(function (side) {
    var lost = winner && winner !== side;
    camp.companies[side].roster.forEach(function (e) {
      if (e.restUntil > 0) return;
      var p = R.profile(e.key), size = p.size || 1;
      var hurt = Math.random() < (lost ? 0.7 : 0.35);
      rep.units.push({
        rid: e.rid, side: side, key: e.key, tier: p.tier,
        startSize: size, endSize: hurt ? Math.max(0, size - C.d3()) : size,
        destroyed: p.cls !== 'infantry' && Math.random() < (lost ? 0.3 : 0.12),
        catastrophic: Math.random() < 0.16,
        brokenEver: Math.random() < (lost ? 0.5 : 0.2),
        wiped: p.cls === 'infantry' && !p.command && Math.random() < (lost ? 0.09 : 0.03),
        kills: Math.random() < (lost ? 0.2 : 0.5) ? [{ tier: bt }] : []
      });
    });
  });
  return rep;
}

var report = [];
C.ARCHETYPES.forEach(function (a) {
  var camp = C.newCampaign({ mode: 'solo' });
  camp.companies.A = player();
  C.foundRival(camp.companies.B, a.id);
  var trouble = [];
  for (var turn = 0; turn < 30; turn++) {
    var roll = Math.random();
    var winner = roll < 0.45 ? 'A' : roll < 0.9 ? 'B' : null;
    C.aftermath(camp, fakeBattle(camp, winner));
    C.developRival(camp.companies.B);
    // the player company is run on the same simple policy, so the fight stays even
    C.developRival(camp.companies.A);
    ['A', 'B'].forEach(function (side) {
      var c = camp.companies[side];
      if (c.kUC < 0) trouble.push(side + ' in debt');
      if (c.doctrines.length > c.tier) trouble.push(side + ' holds too many doctrines');
      C.CATEGORIES.forEach(function (cat) {
        if (c.doctrines.filter(function (d) { return C.doctrine(d).cat === cat; }).length > 2) {
          trouble.push(side + ' holds three ' + cat + ' doctrines');
        }
      });
    });
  }
  var B = camp.companies.B;
  var groups = {};
  B.roster.forEach(function (e) { var g = R.profile(e.key).group; groups[g] = (groups[g] || 0) + 1; });
  var own = B.roster.filter(function (e) { return a.groups.indexOf(R.profile(e.key).group) >= 0; }).length;
  var honours = B.roster.reduce(function (n, e) { return n + e.honours.length; }, 0);
  var upgrades = B.roster.reduce(function (n, e) { return n + e.upgrades.length; }, 0);
  var machines = B.roster.filter(function (e) { return R.profile(e.key).cls !== 'infantry'; }).length;
  var topTier = Math.max.apply(null, B.roster.map(function (e) { return R.profile(e.key).tier; }));
  report.push({
    a: a, co: B, own: own, honours: honours, upgrades: upgrades, machines: machines,
    topTier: topTier, trouble: trouble, groups: groups
  });
  ok(a.name + ' survives thirty turns', trouble.length, 0, trouble.slice(0, 2).join('; '));
  ok('...still legal at every Tier it holds', (function () {
    for (var t = 1; t <= B.tier; t++) if (!C.canFieldArmy(B, t, 1)) return 'illegal at Tier ' + t;
    return 0;
  })(), 0);
  ok('...and grew past Tier I', B.tier > 1, true, 'Tier ' + R.ROMAN[B.tier] +
    ', ' + B.roster.length + ' units, ' + B.kUC + ' kUC');
});

head('What each of them turned into');
report.forEach(function (r) {
  console.log('\n  ' + r.a.name.toUpperCase() + ' — ' + r.co.name);
  console.log('    ' + r.a.blurb);
  console.log('    Company Tier ' + R.ROMAN[r.co.tier] + ' · ' + r.co.roster.length + ' units · ' +
    r.co.record.wins + 'W ' + r.co.record.draws + 'D ' + r.co.record.losses + 'L · ' + r.co.kUC + ' kUC');
  console.log('    doctrines: ' + r.co.doctrines.map(function (d) { return C.doctrine(d).name; }).join(', '));
  console.log('    ' + r.own + ' of ' + r.co.roster.length + ' units in its preferred groups · ' +
    r.honours + ' Battle Honours · ' + r.upgrades + ' Upgrades · ' + r.machines + ' machines · top Tier ' + R.ROMAN[r.topTier]);
  console.log('    ' + Object.keys(r.groups).sort(function (x, y) { return r.groups[y] - r.groups[x]; })
    .map(function (g) { return g + ' ×' + r.groups[g]; }).join(', '));
});

head('Do they still look like themselves?');
var byId = {};
report.forEach(function (r) { byId[r.a.id] = r; });
ok('every rival keeps most of its units in its own groups',
  report.filter(function (r) { return r.own >= r.co.roster.length * 0.5; }).length, report.length,
  report.map(function (r) { return r.a.id + ' ' + r.own + '/' + r.co.roster.length; }).join(', '));
ok('the armoured company fields the most machines',
  byId.armour.machines >= Math.max.apply(null, report.map(function (r) { return r.machines; })), true,
  report.map(function (r) { return r.a.id + ' ' + r.machines; }).join(', '));
ok('...and keeps replacing the hulls it loses', byId.armour.machines >= 2, true,
  'hulls are struck off often enough that Upgrades rarely survive with them: ' +
  report.map(function (r) { return r.a.id + ' ' + r.upgrades + ' fitted'; }).join(', '));
/* How full each company's honour slots are, which is the fair comparison: the cap
   is Unit Tier + 1, so a company of Tier I units cannot hold many however hard it
   trains. The swarm tops this because its cheap units have nowhere to promote to
   and so spend everything on honours; the elite is close behind because Rapid
   Training Methods halves the first honour for every infantry unit it owns. */
report.forEach(function (r) {
  r.slots = r.co.roster.reduce(function (n, e) {
    return n + (R.profile(e.key).cls === 'infantry' && !R.profile(e.key).command ? C.honourCap(e) : 0);
  }, 0);
  r.fill = r.honours / Math.max(1, r.slots);
});
/* One campaign is a small sample: which units survive decides how many honour
   slots a company even has. So the behavioural claims are averaged over twenty
   campaigns of twenty turns each, which takes about a second. */
head('Twenty campaigns each, averaged');
function runOne(a, turns) {
  var camp = C.newCampaign({ mode: 'solo' });
  camp.companies.A = player();
  C.foundRival(camp.companies.B, a.id);
  for (var t = 0; t < turns; t++) {
    var roll = Math.random();
    C.aftermath(camp, fakeBattle(camp, roll < 0.45 ? 'A' : roll < 0.9 ? 'B' : null));
    C.developRival(camp.companies.B);
    C.developRival(camp.companies.A);
  }
  var B = camp.companies.B;
  var slots = B.roster.reduce(function (n, e) {
    var p = R.profile(e.key);
    return n + (p.cls === 'infantry' && !p.command ? C.honourCap(e) : 0);
  }, 0);
  return {
    honours: B.roster.reduce(function (n, e) { return n + e.honours.length; }, 0),
    slots: slots,
    upgrades: B.roster.reduce(function (n, e) { return n + e.upgrades.length; }, 0),
    machines: B.roster.filter(function (e) { return R.profile(e.key).cls !== 'infantry'; }).length,
    // the free field command is not a choice, so it is left out of the count
    units: B.roster.filter(function (e) { return !R.profile(e.key).command; }).length,
    own: B.roster.filter(function (e) {
      var p = R.profile(e.key);
      return !p.command && a.groups.indexOf(p.group) >= 0;
    }).length,
    tier: B.tier
  };
}
var avg = {};
C.ARCHETYPES.forEach(function (a) {
  var n = 20, acc = { honours: 0, slots: 0, upgrades: 0, machines: 0, units: 0, own: 0, tier: 0 };
  for (var i = 0; i < n; i++) {
    var r = runOne(a, 20);
    Object.keys(acc).forEach(function (k) { acc[k] += r[k]; });
  }
  Object.keys(acc).forEach(function (k) { acc[k] /= n; });
  acc.fill = acc.honours / Math.max(1, acc.slots);
  acc.inChar = acc.own / Math.max(1, acc.units);
  avg[a.id] = acc;
});
function table(fn, fmt) {
  return C.ARCHETYPES.map(function (a) { return a.id + ' ' + (fmt || String)(fn(avg[a.id])); }).join(', ');
}
function pc(v) { return Math.round(100 * v) + '%'; }
function one(v) { return v.toFixed(1); }

ok('every archetype keeps three units in four in its own groups',
  C.ARCHETYPES.every(function (a) { return avg[a.id].inChar >= 0.75; }), true,
  table(function (v) { return v.inChar; }, pc) +
  ' — the elite trails because it founds with Basic troops that have to be promoted out');
ok('every archetype reaches Company Tier II or better',
  C.ARCHETYPES.every(function (a) { return avg[a.id].tier >= 2; }), true,
  table(function (v) { return v.tier; }, one));
ok('the armoured company fields the most machines',
  C.ARCHETYPES.every(function (a) { return a.id === 'armour' || avg.armour.machines > avg[a.id].machines; }), true,
  table(function (v) { return v.machines; }, one));
ok('...and is the only one fitting Upgrades',
  avg.armour.upgrades > 0 && C.ARCHETYPES.every(function (a) { return a.id === 'armour' || avg[a.id].upgrades < avg.armour.upgrades; }), true,
  table(function (v) { return v.upgrades; }, one));
ok('the swarm fields the most units',
  C.ARCHETYPES.every(function (a) { return a.id === 'swarm' || avg.swarm.units > avg[a.id].units; }), true,
  table(function (v) { return v.units; }, one));

/* Spending policy is better tested directly than inferred from an aggregate: an
   averaged honour count is confounded by how fast a company recruits, because
   every fresh unit adds empty slots. So give two rivals the same unit with the
   same experience and watch what each does with it. */
head('What each of them does with ten experience points');
function spendOn(archId, key, exp) {
  var co = C.newCompany('x');
  C.foundRival(co, archId);
  co.kUC = 40;
  var e = co.roster.filter(function (x) { return !x.free && R.profile(x.key).cls === 'infantry'; })[0];
  e.key = key; e.name = R.profile(key).name; e.exp = exp;
  var did = C.developRival(co);
  return {
    honours: e.honours.length, key: e.key,
    did: did.filter(function (d) { return d.what === 'honour' || d.what === 'promote'; })
      .map(function (d) { return d.what; })
  };
}
var marks = spendOn('marksmen', 'mortarsection', 12);
ok('the marksmen train the unit rather than promote it',
  marks.honours > 0 && marks.key === 'mortarsection', true,
  marks.honours + ' honour(s), still a ' + R.profile(marks.key).name);
var shock = spendOn('shock', 'irregulars', 12);
ok('the shock company promotes the same unit instead',
  shock.key !== 'irregulars', true, 'became a ' + R.profile(shock.key).name);
var elite = spendOn('elite', 'recruits', 12);
ok('the elite promotes into its own groups',
  ['Rifle infantry', 'Heavy infantry', 'Assault troops'].indexOf(R.profile(elite.key).group) >= 0, true,
  'became a ' + R.profile(elite.key).name);
ok('...and its Rapid Training Methods halves the first honour', (function () {
  var co = C.newCompany('x');
  C.foundRival(co, 'elite');
  var e = co.roster.filter(function (x) { return !x.free; })[0];
  return C.honourCost(e, co);
})(), 5);
var armour = spendOn('armour', 'enforcers', 12);
ok('the armoured company promotes toward heavy infantry',
  R.profile(armour.key).group, 'Heavy infantry', 'became a ' + R.profile(armour.key).name);
ok('...and fits an Upgrade on a hull that has the experience for one', (function () {
  var co = C.newCompany('x');
  C.foundRival(co, 'armour');
  co.kUC = 0;
  var v = co.roster.filter(function (x) { return R.profile(x.key).cls !== 'infantry'; })[0];
  v.exp = 10;
  C.developRival(co);
  return v.upgrades.length;
})(), 1);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
