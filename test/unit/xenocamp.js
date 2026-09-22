/* The Xenotripod campaign against the book (pp. 140-145): Territorial Points
   and the territorial payment, the free Alpha squad and its Tribe Tier, free
   Primitive Epsilons and turrets, Tribe Advancements, Rites, Infamies, the
   tribe's aircraft upgrades — and a tribe run for a hundred turns. */
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

head('Tribe Advancements (pp. 141-142)');
ok('18 Advancements', C.ADVANCEMENTS.length, 18);
ok('...six in each group', C.ADVANCEMENT_GROUPS.map(function (g) {
  return C.ADVANCEMENTS.filter(function (p) { return p.cat === g; }).length;
}).join('/'), '6/6/6');
ok('no id collides with another army\'s', C.ADVANCEMENTS.every(function (a) {
  return !C.DOCTRINES.concat(C.PATHS).concat(C.PATHWAYS).some(function (d) { return d.id === a.id; });
}), true);
ok('a tribe is offered Advancements', C.creedOf({ faction: 'xeno' }).one, 'Tribe Advancement');
ok('...pays in Territorial Points', C.money({ faction: 'xeno' }), 'TerP');
ok('...at a Tribe Tier', C.words({ faction: 'xeno' }).tier, 'Tribe');

head('Rites, Infamies and the aircraft upgrades (p. 143)');
ok('20 Rites, numbered', C.RITES.every(function (h, i) { return h.n === i + 1; }) && C.RITES.length, 20);
ok('10 Infamies, numbered', C.INFAMIES.every(function (h, i) { return h.n === i + 1; }) && C.INFAMIES.length, 10);
ok('10 aircraft upgrades', C.XENO_AIR_UPGRADES.length, 10);
ok('every one does something', C.RITES.concat(C.INFAMIES).concat(C.XENO_AIR_UPGRADES).every(function (x) { return x.mod || x.rule || x.flag; }), true);
ok('a Crock reads the Rites', C.honourTable('xbeta3')[0].name, 'Rite of Calmness');
ok('...and the Infamies', C.traumaTable('xeps2')[3].name, 'Infamy of Blasphemy');
ok('a strike craft reads the tribe\'s upgrades', C.upgradeTable('xstrike3')[8].name, 'Time Vortex Generator');

head('Founding a tribe (pp. 83, 140)');
function tribe(adv) {
  var camp = C.newCampaign({ factionA: 'xeno', factionB: 'pmc', nameA: 'The Tribe' });
  var co = camp.companies.A;
  var res = C.found(co, ['xeps1', 'xeps1', 'xeps1', 'xeps1', 'xdelta1', 'xdelta1', 'xbeta2', 'xeps2'], adv || 'XT2');
  return { camp: camp, co: co, res: res };
}
var t1 = tribe();
ok('a legal founding', t1.res.ok, true, t1.res.faults.join('; '));
var al = C.byRid(t1.co, t1.co.cmdRid);
ok('the free unit is an Alpha squad at the Tribe Tier', al.key, 'xalpha1');
ok('it can field a Tier I army', C.canFieldArmy(t1.co, 1, 1), true, C.fieldReport(t1.co, 1, 1).fault || '');
ok('Alphas never earn EXP', C.expFor({ kills: [] }, { entry: al, company: t1.co, won: true, ownTier: 1, enemyTier: 1 }).total, 0);
ok('...nor Trauma Points', C.tpFor({ startSize: 3, endSize: 1, brokenEver: true }, { entry: al, company: t1.co, lost: true }).total, 0);
t1.co.tier = 3; t1.co.kUC = 200; C.fitCommand(t1.co);
ok('it grows with the tribe', C.byRid(t1.co, t1.co.cmdRid).key, 'xalpha3');
ok('another Alpha must be of a lower Tier', C.canRecruit(t1.co, 'xalpha3').ok + '/' + C.canRecruit(t1.co, 'xalpha2').ok, 'false/true');

head('What is free (p. 140)');
var t2 = tribe();
ok('with four Primitive Epsilons, a fifth is free', C.recruitCost(t2.co, 'xeps1'), 0);
C.recruit(t2.co, 'xeps1');
ok('with five, the next costs the usual 1', C.recruitCost(t2.co, 'xeps1'), 1);
var pe = t2.co.roster.filter(function (e) { return e.key === 'xeps1'; })[0];
ok('promoting one costs EXP only', C.promotionCost(pe, 'xeps2', t2.co).kUC, 0);
ok('...and only to another Epsilon', C.promotionTargets(pe).every(function (q) { return q.group === 'Epsilon Squads'; }), true);
ok('turrets cost nothing to field', C.recruitCost(t2.co, 'xdturret3') + '/' + C.recruitCost(t2.co, 'xsturret4'), '0/0');
var tur = C.newEntry('xdturret2');
ok('...and never earn EXP', C.expFor({ kills: [{ tier: 3 }] }, { entry: tur, company: t2.co, won: true, ownTier: 1, enemyTier: 3 }).total, 0);
ok('...nor take Upgrades', C.canTakeUpgrade(tur).ok, false);
var sc = C.newEntry('xstrike2'); sc.exp = 12;
ok('a strike craft buys an upgrade for 10 EXP', C.canTakeUpgrade(sc).ok, true);
ok('...but never a Rite', C.canTakeHonour(sc, t2.co).ok, false);

head('Advancements that change costs');
var h = tribe('XS4').co;
ok('Hermetic Society: recruiting doubles (Beta 4 → 8)', C.recruitCost(h, 'xbeta2'), 8);
var b2 = C.newEntry('xbeta2'); b2.exp = 20;
var pc = C.promotionCost(b2, 'xbeta3', h);
ok('...promotion halves: 9 EXP → 5, 4 TerP → 2', pc.exp + '/' + pc.kUC, '5/2');
var g = tribe('XS1').co; g.tier = 3;
ok('Increased Population Growth: a Tier II squad at half (2)', C.recruitCost(g, 'xeps2'), 2);
ok('...a Tier III one at full (8)', C.recruitCost(g, 'xeps3'), 8);
var fp = tribe('XS6').co;
ok('Focused on Perfection: Tier III holds five Rites', C.honourCap(C.newEntry('xbeta3'), fp), 5);

head('Advancements and Rites on the unit');
function built(key, docs, hon, tra, upg) {
  var p = R.profile(key), u = { key: key, side: 'A', move: p.move, fp: p.fp, range: p.range, def: p.def, assault: p.assault, morale: p.morale, str: p.str, rules: p.rules.slice(), size: p.size, models: p.size };
  var e = C.newEntry(key); e.honours = hon || []; e.traumas = tra || []; e.upgrades = upg || [];
  C.applyEntry(u, e, docs);
  return u;
}
ok('Advanced Aviation: a strike craft moves 22', built('xstrike3', ['XT1']).move, 22);
ok('Aura of Majesty: Alphas inspire', built('xalpha2', ['XT3']).rules.indexOf('Inspiring Presence') >= 0, true);
ok('Rite of Protection: +1 Defence', built('xeps3', [], [2]).def, 10);
ok('Rite of Devastation: Anti-tank (limited)', built('xeps3', [], [5]).rules.indexOf('Anti-tank (limited)') >= 0, true);
ok('Infamy of Impudence: −1 Defence', built('xeps3', [], [], [6]).def, 8);
ok('Improved Engines on a craft: +4 Move', built('xstrike2', [], [], [], [1]).move, 22);
var bl = C.newEntry('xbeta3'); bl.exp = 40; bl.traumas = [4];
ok('Blasphemy bars new Rites', C.canTakeHonour(bl, t2.co).ok, false);

head('Territorial payment (p. 140)');
var xc = { faction: 'xeno', doctrines: [] }, xr = { faction: 'xeno', doctrines: ['XS2'] };
ok('the book\'s winner: 1,2,3,5,5,6 → 3,3,3,5,5,6', C.territorial(xc, [1, 2, 3, 5, 5, 6], true, false).now.join(','), '3,3,3,5,5,6');
ok('the book\'s loser: 1,1,2,3,4,6 → 1,1,2,3,4,4', C.territorial(xc, [1, 1, 2, 3, 4, 6], false, true).now.join(','), '1,1,2,3,4,4');
ok('Effective Resource Utilisation: 1-3 count as 4', C.territorial(xr, [1, 2, 3, 5], true, false).now.join(','), '4,4,4,5');
ok('only for a tribe', C.territorial({ faction: 'pmc', doctrines: [] }, [1, 2], true, false), null);
var tot = 0, plain = 0;
for (var i = 0; i < 400; i++) {
  var pay = C.payment(3, 1, { faction: 'xeno', doctrines: [] }, { faction: 'pmc', doctrines: [] }, 'A', true);
  if (pay.territory && pay.territory.A && pay.territory.A.now.every(function (v) { return v >= 3; })) tot++;
  var pay2 = C.payment(3, 1, { faction: 'xeno', doctrines: [] }, { faction: 'pmc', doctrines: [] }, 'A', false);
  if (!pay2.territory) plain++;
}
ok('a winning tribe in an attack-defend fight never has a die below 3', tot, 400);
ok('...and in a meeting engagement nothing changes', plain, 400);

head('The aftermath');
(function () {
  var s = tribe('XS5');
  s.co.kUC = 50;
  var vet = s.co.roster.filter(function (e) { return e.key === 'xbeta2'; })[0];
  vet.exp = 7; vet.honours = [2]; vet.name = 'The Watchers of the Ridge';
  var rows = s.co.roster.map(function (e) {
    var p = R.profile(e.key);
    return { rid: e.rid, side: 'A', key: e.key, tier: p.tier, startSize: p.size, endSize: p.size,
      brokenEver: false, wiped: e === vet, destroyed: false, kills: [] };
  });
  var n0 = s.co.roster.length;
  var out = C.aftermath(s.camp, { winner: 'B', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false }, units: rows });
  var rb = out.sides.A.reborn || [];
  ok('Enhanced Genetic Memory: the lost squad is recruited again', rb.length + '/' + (s.co.roster.length - n0), '1/0');
  var back = s.co.roster.filter(function (e) { return e.key === 'xbeta2'; })[0];
  ok('...and remembers on a 2-6', rb[0].remembered ? back.honours.join(',') + '|' + back.name : 'forgot (a 1)', rb[0].remembered ? '2|The Watchers of the Ridge' : 'forgot (a 1)');
})();
(function () {
  var s = tribe('XS3');
  var sat = s.co.roster.filter(function (e) { return e.key === 'xeps2'; })[0];
  var healed = 0;
  for (var k = 0; k < 200; k++) {
    sat.traumas = [1, 2];
    C.aftermath(s.camp, { winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false }, units: [] });
    if (sat.traumas.length === 1) healed++;
  }
  ok('Supportive Community heals an Infamy about 1 in 6 rests', healed > 15 && healed < 60, true, healed + ' of 200');
})();
(function () {
  var s = tribe();
  var dg = s.co.roster.filter(function (e) { return e.key === 'xeps2'; })[0];
  var lost = 0;
  for (var k = 0; k < 200; k++) {
    dg.traumas = [1]; dg.exp = 9;
    C.aftermath(s.camp, { winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false }, units: [] });
    if (dg.exp === 0) lost++;
  }
  ok('Infamy of Degeneration takes the EXP on a 5+', lost > 40 && lost < 100, true, lost + ' of 200');
})();

head('Rival tribes (pp. 144-145)');
ok('four tribes to meet', C.XENO_ARCHETYPES.length, 4);
var seen = {};
for (var r = 0; r < 80; r++) {
  var cm = C.newCampaign({ factionA: 'pmc' });
  C.foundRivals(cm);
  cm.rivals.forEach(function (co) { seen[co.faction] = (seen[co.faction] || 0) + 1; });
}
ok('a campaign meets tribes now and then', (seen.xeno || 0) > 5, true, JSON.stringify(seen));
C.XENO_ARCHETYPES.forEach(function (a) {
  var co = C.newCompany('x', { faction: 'xeno' });
  C.foundRival(co, a.id);
  var chk = C.foundingCheck(co);
  ok(a.name + ' founds legally', chk.ok, true, chk.faults.join('; '));
  C.catchUp(co, 5);
  ok('...and grows to Tribe Tier V', co.tier, 5, 'roster ' + co.roster.length);
});

head('A hundred campaign turns: a player tribe against a rival tribe');
(function () {
  var camp = C.newCampaign({ factionA: 'xeno', factionB: 'xeno', mode: 'solo' });
  var a = camp.companies.A, b = camp.companies.B;
  C.found(a, ['xeps1', 'xeps1', 'xeps1', 'xeps1', 'xdelta1', 'xdelta1', 'xbeta2', 'xeps2'], 'XS1');
  C.foundRival(b, 'ghadon');
  var bad = [], topTier = 0;
  for (var n = 0; n < 100; n++) {
    var tier = Math.max(1, Math.min(C.fieldableTier(a) || 1, C.fieldableTier(b) || 1));
    var winner = n % 3 === 0 ? null : (n % 2 ? 'A' : 'B');
    var rep = { winner: winner, battleTier: tier, pl: 1, scenario: n % 2 ? 'invasion' : 'meeting', routed: { A: false, B: false },
      units: a.roster.map(function (e) { return line(e, 'A'); }).concat(b.roster.map(function (e) { return line(e, 'B'); })) };
    C.aftermath(camp, rep);
    C.developRival(b);
    C.developRival(a);
    [a, b].forEach(function (co) {
      if (co.kUC < 0) bad.push('negative TerP');
      C.ADVANCEMENT_GROUPS.forEach(function (g) {
        if (co.doctrines.filter(function (x) { return C.BY_ADVANCEMENT[x] && C.BY_ADVANCEMENT[x].cat === g; }).length > 2) bad.push('3 in ' + g);
      });
      if (co.doctrines.length > co.tier) bad.push('too many Advancements');
      co.roster.forEach(function (e) {
        var p = R.profile(e.key);
        if (p.faction !== 'xeno') bad.push('non-tribe ' + e.key);
        if (p.alpha && e.rid !== co.cmdRid && p.tier >= R.profile(C.byRid(co, co.cmdRid).key).tier) bad.push('a second top Alpha');
        if (e.honours.length > C.honourCap(e, co)) bad.push('over the Rite cap');
        if (p.alpha && (e.exp || e.tp)) bad.push('an Alpha with EXP or TP');
      });
      var ld = C.byRid(co, co.cmdRid);
      if (!ld || R.profile(ld.key).tier !== co.tier) bad.push('Alpha not at Tribe Tier');
    });
    topTier = Math.max(topTier, a.tier, b.tier);
  }
  function line(e, side) {
    var p = R.profile(e.key), lost = Math.floor(Math.random() * 3);
    return { rid: e.rid, side: side, key: e.key, tier: p.tier, startSize: p.size,
      endSize: Math.max(0, p.size - lost), brokenEver: Math.random() < 0.3, wiped: false,
      destroyed: p.cls !== 'infantry' && Math.random() < 0.08, catastrophic: false, kills: [] };
  }
  ok('nothing drifted illegal in a hundred turns', bad.length, 0, bad.slice(0, 3).join(', '));
  ok('the tribes grew', topTier >= 3, true, 'reached Tribe Tier ' + topTier);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
