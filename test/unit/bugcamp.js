/* The Space Bug campaign against the book (pp. 124-125): Resource Points, the
   free Leader Bug and its Swarm Tier, free Tiny swarms, Endless Tide trauma,
   the Adaptations and Genetic Flaws tables, the eighteen Evolutionary Pathways
   — and a swarm run for a hundred turns to see that nothing drifts illegal. */
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

head('Evolutionary Pathways (p. 124)');
ok('18 Pathways', C.PATHWAYS.length, 18);
ok('...six in each group', C.PATHWAY_GROUPS.map(function (g) {
  return C.PATHWAYS.filter(function (p) { return p.cat === g; }).length;
}).join('/'), '6/6/6');
ok('no Pathway id collides with a doctrine or a Path', C.PATHWAYS.every(function (p) {
  return !C.DOCTRINES.concat(C.PATHS).some(function (d) { return d.id === p.id; });
}), true);
ok('a swarm is offered Pathways', C.creedOf({ faction: 'bugs' }).list[0].name, 'Alternate Carbon-based Metabolism');
ok('...and pays in Resource Points', C.money({ faction: 'bugs' }), 'RP');
ok('...at a Swarm Tier', C.words({ faction: 'bugs' }).tier, 'Swarm');

head('Adaptations and Genetic Flaws (p. 125)');
ok('10 Adaptations, numbered', C.ADAPTATIONS.every(function (h, i) { return h.n === i + 1; }) && C.ADAPTATIONS.length, 10);
ok('10 Genetic Flaws, numbered', C.FLAWS.every(function (h, i) { return h.n === i + 1; }) && C.FLAWS.length, 10);
ok('every one does something', C.ADAPTATIONS.concat(C.FLAWS).every(function (x) { return x.mod || x.rule || x.flag; }), true);
ok('a bug reads the Adaptations table', C.honourTable('battack')[0].name, 'Overgrown Muscles');
ok('a mercenary still reads the Battle Honours', C.honourTable('regular')[0].name, 'Adrenaline Rush');
ok('a bug\'s trauma table is the Flaws', C.traumaTable('bsmall')[3].name, 'Atavism');

head('Awakening a swarm (pp. 83, 124)');
function swarm(path) {
  var camp = C.newCampaign({ factionA: 'bugs', factionB: 'pmc', nameA: 'The Hive' });
  var co = camp.companies.A;
  var res = C.found(co, ['btiny', 'btiny', 'btiny', 'btiny', 'bspitlarva', 'bspitlarva', 'bsmall', 'bimmspit'], path || 'BC2');
  return { camp: camp, co: co, res: res };
}
var s1 = swarm();
ok('a legal founding', s1.res.ok, true, s1.res.faults.join('; '));
var lead = C.byRid(s1.co, s1.co.cmdRid);
ok('the free unit is a Leader Bug', R.profile(lead.key).leaderBug, true);
ok('...at the Swarm Tier: Watcher larvae', lead.key, 'bwatchlarva');
ok('it can field a Tier I army', C.canFieldArmy(s1.co, 1, 1), true, C.fieldReport(s1.co, 1, 1).fault || '');
ok('...under exactly one Leader Bug', R.checkArmy(['bwatchlarva', 'btiny', 'btiny', 'btiny', 'bsmall'], 1, 1).ok, true);

head('Leader Bugs (p. 124)');
ok('never earn EXP', C.expFor({ kills: [] }, { entry: lead, company: s1.co, won: true, ownTier: 1, enemyTier: 1 }).total, 0);
ok('...nor Trauma Points', C.tpFor({ startSize: 4, endSize: 1, brokenEver: true }, { entry: lead, company: s1.co, lost: true }).total, 0);
ok('...nor promote', C.promotionTargets(lead).length, 0);
s1.co.tier = 3; s1.co.kUC = 200; C.fitCommand(s1.co);
ok('it grows with the swarm: Tier III is Watchers', C.byRid(s1.co, s1.co.cmdRid).key, 'bwatchers');
ok('another Leader Bug must be of a lower Tier', C.canRecruit(s1.co, 'bwatchers').ok + '/' + C.canRecruit(s1.co, 'bimmwatch').ok, 'false/true');

head('Tiny Bug Swarms (p. 124)');
var s2 = swarm();
ok('with four already, a fifth is free', C.recruitCost(s2.co, 'btiny'), 0);
C.recruit(s2.co, 'btiny');
ok('with five, the next costs the usual 1', C.recruitCost(s2.co, 'btiny'), 1);
var tiny = s2.co.roster.filter(function (e) { return e.key === 'btiny'; })[0];
ok('promoting one costs experience only', C.promotionCost(tiny, 'bsmall', s2.co).kUC, 0);

head('Endless Tide trauma (p. 124)');
var small = C.newEntry('bsmall');
var ctx = { entry: small, company: s2.co, won: true, lost: false };
ok('regrown to full, it still felt the first loss: 1 TP', C.tpFor({ startSize: 8, endSize: 8, minSize: 6 }, ctx).total, 1);
ok('once below half at any point: 4 TP', C.tpFor({ startSize: 8, endSize: 7, minSize: 3 }, ctx).total, 4);
ok('untouched: none', C.tpFor({ startSize: 8, endSize: 8, minSize: 8 }, ctx).total, 0);

head('What the Adaptations and Flaws do');
var e1 = C.newEntry('bspitters'); e1.honours = [1, 3, 6]; e1.traumas = [2, 7];
var fx = C.effects(e1);
ok('Overgrown Muscles: +1 Move', fx.move, 1);
ok('Bioplasma Launchers: Gauss Weapon', fx.rules.indexOf('Gauss Weapon') >= 0, true);
ok('Spotters and Chaotic Ranged Attacks are flags', !!fx.flags.spotters + '/' + !!fx.flags.chaotic, 'true/true');
var u1 = { key: 'bspitters', side: 'A', move: 8, fp: 3, range: 18, def: 8, assault: 3, morale: 4, rules: R.profile('bspitters').rules.slice() };
C.applyEntry(u1, e1, []);
ok('Self-awareness takes Determined away', u1.rules.indexOf('Determined'), -1);
var og = C.newEntry('bfirebeetle');
ok('an Overgrown bug may take Adaptations', C.takesHonours(R.profile('bfirebeetle')), true);
ok('...but never Upgrades', C.canTakeUpgrade(og).ok, false);
var fr = 0;
for (var i = 0; i < 300; i++) { var ogt = C.newEntry('bqueen'); var t = C.rollTrauma(ogt); if (t && t.n === 5) fr++; }
ok('...and never rolls Reduced Intelligence', fr, 0);
var at = C.newEntry('battack'); at.honours = [1, 2]; at.exp = 40; at.traumas = [4];
ok('Atavism bars new Adaptations', C.canTakeHonour(at, s2.co).ok, false);
var q = C.newEntry('battack'); q.exp = 99; q.honours = [1, 2, 3, 4];
var co6 = swarm('BB6').co;
ok('Quick Learning: Tier III holds five, not four', C.honourCap(q, co6), 5);

head('Pathways that change the bugs');
function built(key, docs) {
  var p = R.profile(key), u = { key: key, side: 'A', move: p.move, fp: p.fp, range: p.range, def: p.def, assault: p.assault, morale: p.morale, str: p.str, rules: p.rules.slice(), size: p.size, models: p.size };
  C.applyEntry(u, C.newEntry(key), docs);
  return u;
}
ok('Concentrated Acid: Spitters FP 3 → 4', built('bspitters', ['BC2']).fp, 4);
ok('Bioplasma Missiles: winged bugs get Anti-tank (limited)', built('bsmallwing', ['BC5']).rules.indexOf('Anti-tank (limited)') >= 0, true);
ok('Extensive Feeding: the Queen moves 10, Defence 16', built('bqueen', ['BB5']).move + '/' + built('bqueen', ['BB5']).def, '10/16');
ok('Enlarged Leg Muscles: Attack forms move 10', built('battack', ['BP2']).move, 10);
var s3 = swarm('BP1');
ok('Efficient Spawn Cycle: Attack forms cost 6, not 8', C.recruitCost(s3.co, 'battack'), 6);
ok('...but Spitters still cost 8', C.recruitCost(s3.co, 'bspitters'), 8);

head('In the battle engine');
function mk(key, side, x, y) {
  var p = R.profile(key);
  return { id: side + key, key: key, side: side, label: key, name: key, cls: p.cls, faction: p.faction, group: p.group,
    tier: p.tier, size: p.size, startSize: p.size, models: p.size, move: p.move, fp: p.fp, range: p.range, def: p.def,
    assault: p.assault, morale: p.morale, str: p.str, rules: p.rules.slice(), x: x, y: y, sp: 0, alive: true,
    shotFrom: [], cargo: [], damage: 0, facing: 0 };
}
var st = { units: [], terrain: [], objectives: [], doctrines: { A: ['BC6'], B: [] } };
var sp = mk('bspitters', 'A', 10, 10), tg = mk('regular', 'B', 25, 10);
st.units = [sp, tg];
var m = R.shotOdds(st, sp, tg, 'fire', {});
ok('Effective Toxin Glands: Fire! is worth +2', m.parts.some(function (x) { return /Toxin/.test(x.label) && x.v === 2; }), true);
st.doctrines.A = ['BB3'];
ok('Increased Control: the Overmind reaches 24"', R.overmindReach(st, 'A'), 24);
st.doctrines.A = ['BP5'];
var ab = mk('battack', 'A', 10, 10), rf = mk('regular', 'B', 12, 10); rf.fp = null;   // no defensive fire to stop the charge
st.units = [ab, rf];
ok('Chitin Exoskeletons: +2 Defence in an assault', R.defenceAgainst(st, rf, ab, { assault: true }).parts.some(function (x) { return /Chitin/.test(x.label); }), true);
var res = R.assault(st, ab, rf);
ok('...and the enemy strikes first when they charge', res.log.some(function (l) { return /strikes first/.test(l.text); }), true);
var killer = mk('boversized', 'A', 10, 10), victim = mk('regular', 'B', 12, 10);
victim.models = 1; victim.def = 0; victim.fp = null; st.units = [killer, victim]; st.doctrines.A = [];
for (var g = 0; g < 20 && victim.alive; g++) { victim.sp = 0; killer.sp = 0; R.assault(st, killer, victim); }
ok('a kill in an assault is counted for the campaign', (killer.assaultKills || 0) + '/' + (killer.assaultKillsHuman || 0), '1/1');

head('The aftermath');
(function () {
  var s = swarm('BC1');
  s.co.doctrines.push('BP4');
  var rows = s.co.roster.map(function (e) {
    var p = R.profile(e.key);
    return { rid: e.rid, side: 'A', key: e.key, tier: p.tier, startSize: p.size, endSize: p.size, minSize: p.size,
      brokenEver: false, wiped: false, destroyed: false, kills: [], assaultKills: 0, assaultKillsHuman: 0 };
  });
  rows[1].assaultKills = 2; rows[1].assaultKillsHuman = 1;
  var before = s.co.kUC, n0 = s.co.roster.length;
  var out = C.aftermath(s.camp, { winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false }, units: rows });
  ok('Alternate Carbon-based Metabolism: +1 RP per kill', s.co.kUC - before - out.payment.A, 2);
  ok('Fungi Symbiosis: a free unit of Infected Humans', s.co.roster.length - n0, 1);
  ok('...and it is Infected Humans', s.co.roster[s.co.roster.length - 1].key, 'binfected');
})();

head('Rival swarms (pp. 125-127)');
ok('four swarms to meet', C.BUG_ARCHETYPES.length, 4);
var seen = {};
for (var r = 0; r < 60; r++) {
  var cm = C.newCampaign({ factionA: 'pmc' });
  C.foundRivals(cm);
  cm.rivals.forEach(function (co) { seen[co.faction] = (seen[co.faction] || 0) + 1; });
}
ok('a PMC campaign meets swarms now and then', (seen.bugs || 0) > 5, true, JSON.stringify(seen));
ok('...but always a company and a revolt too', seen.pmc >= 60 && seen.rebel >= 60, true);

head('A hundred campaign turns: a player swarm against a rival swarm');
(function () {
  var camp = C.newCampaign({ factionA: 'bugs', factionB: 'bugs', mode: 'solo' });
  var a = camp.companies.A, b = camp.companies.B;
  C.found(a, ['btiny', 'btiny', 'btiny', 'btiny', 'bspitlarva', 'bspitlarva', 'bsmall', 'bimmspit'], 'BC1');
  C.foundRival(b, 'evatus');
  var bad = [], topTier = 0;
  for (var n = 0; n < 100; n++) {
    var tier = Math.max(1, Math.min(C.fieldableTier(a) || 1, C.fieldableTier(b) || 1));
    var winner = n % 3 === 0 ? null : (n % 2 ? 'A' : 'B');
    var rep = { winner: winner, battleTier: tier, pl: 1, scenario: 'meeting', routed: { A: false, B: false },
      units: a.roster.map(function (e) { return line(e, 'A'); }).concat(b.roster.map(function (e) { return line(e, 'B'); })) };
    C.aftermath(camp, rep);
    C.developRival(b);
    C.developRival(a);                                  // the player's swarm, played the same way
    [a, b].forEach(function (co) {
      if (co.kUC < 0) bad.push('negative RP');
      C.PATHWAY_GROUPS.forEach(function (g) {
        if (co.doctrines.filter(function (x) { return C.BY_PATHWAY[x] && C.BY_PATHWAY[x].cat === g; }).length > 2) bad.push('3 in ' + g);
      });
      if (co.doctrines.length > co.tier) bad.push('too many Pathways');
      co.roster.forEach(function (e) {
        var p = R.profile(e.key);
        if (p.faction !== 'bugs') bad.push('non-bug ' + e.key);
        if (p.leaderBug && e.rid !== co.cmdRid && p.tier >= R.profile(C.byRid(co, co.cmdRid).key).tier) bad.push('a second top Leader');
        if (e.honours.length > C.honourCap(e, co) + 0) bad.push('over the Adaptation cap');
      });
      var ld = C.byRid(co, co.cmdRid);
      if (!ld || R.profile(ld.key).tier !== co.tier) bad.push('leader not at Swarm Tier');
    });
    topTier = Math.max(topTier, a.tier, b.tier);
  }
  function line(e, side) {
    var p = R.profile(e.key), lost = Math.floor(Math.random() * 3), low = Math.floor(Math.random() * 5);
    return { rid: e.rid, side: side, key: e.key, tier: p.tier, startSize: p.size,
      endSize: Math.max(0, p.size - lost), minSize: Math.max(0, p.size - lost - low),
      brokenEver: Math.random() < 0.3, wiped: false, destroyed: p.cls !== 'infantry' && Math.random() < 0.08,
      catastrophic: false, kills: [], assaultKills: Math.random() < 0.2 ? 1 : 0, assaultKillsHuman: 0 };
  }
  ok('nothing drifted illegal in a hundred turns', bad.length, 0, bad.slice(0, 3).join(', '));
  ok('the swarms grew', topTier >= 3, true, 'reached Swarm Tier ' + topTier);
  ok('still led by its Overmind organism', R.profile(C.byRid(a, a.cmdRid).key).leaderBug, true);
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
