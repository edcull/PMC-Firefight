/* The Low findings on the campaign (the rules review at 7dd7306, L-42, L-43). */
'use strict';
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/campaign.js');
var R = global.PMC, C = global.PMCCamp;

var pass = 0, fail = 0;
function ok(what, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + what + (note ? '  — ' + note : ''));
}

console.log('\nL-42 No Place for the Weak! counts a safe landing’s 5 TP (p. 86)');
(function () {
  var camp = C.newCampaign({ mode: 'solo', nameA: 'Ironhold' });
  var co = camp.companies.A;
  C.found(co, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.foundRival(camp.companies.B, 'swarm');
  co.kUC = 100;
  var air = C.recruit(co, 'adaptedcraft').entry;
  var troops = co.roster.filter(function (e) { return e.key === 'rookie'; })[0], p2 = R.profile(troops.key);
  var seenSaved = 0, agree = 0, five = 0;
  for (var n = 0; n < 60; n++) {
    var c2 = JSON.parse(JSON.stringify(camp));
    var rep = {
      winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', routed: { A: false, B: false },
      units: [
        { rid: air.rid, side: 'A', key: air.key, tier: 2, startSize: 1, endSize: 0, destroyed: true, wiped: false, fled: false, brokenEver: false, kills: [] },
        { rid: troops.rid, side: 'A', key: troops.key, tier: p2.tier, startSize: p2.size, endSize: 0, wiped: true, fled: false, destroyed: false,
          brokenEver: false, aboardDowned: true, lostAboard: air.rid, kills: [] }
      ]
    };
    // as the No Place for the Weak! step does it: the salvage dice, then the Trauma Points
    var sv = C.salvageRolls(c2, rep, 'A');
    var tp = C.rollTP(c2, rep, 'A');
    if (!sv[air.rid].saved) continue;
    seenSaved++;
    if (tp[troops.rid].total === 5) five++;
    var res = C.aftermath(c2, rep, { salvage: { A: sv }, tp: { A: tp } });
    var u = res.sides.A.units.filter(function (x) { return x.rid === troops.rid; })[0];
    if (u && u.aircraftSaved) agree++;
  }
  ok('passengers of an aircraft that landed take the 5 TP, not a casualty’s', seenSaved > 0 && five === seenSaved, five + ' of ' + seenSaved);
  ok('...and the aftermath uses the same landing roll', agree === seenSaved, agree + ' of ' + seenSaved);
})();

console.log('\nL-43 A rival swarm grows Adaptations on its Overgrown bugs (p. 124)');
(function () {
  var grew = 0, n = 0;
  var og = R.listFor('bugs').filter(function (p) { return p.cls !== 'infantry' && (p.rules || []).indexOf('Overgrown Bug') >= 0; })[0];
  for (var i = 0; i < 20; i++) {
    var camp = C.newCampaign({ mode: 'solo' });
    C.foundRival(camp.companies.B, 'swarm');
    var co = camp.companies.B, e = C.newEntry(og.key);
    co.tier = 5; co.kUC = 500; e.exp = 40; co.roster.push(e);
    C.developRival(co);
    n++;
    if ((e.honours || []).length) grew++;
  }
  ok('an Overgrown bug with the experience for it grows an Adaptation', grew === n, grew + ' of ' + n);
})();

console.log('\nL-43 A rival prices its promotions with its own doctrines (pp. 112, 141)');
(function () {
  function rival(doc) {
    var camp = C.newCampaign({ mode: 'solo' });
    C.foundRival(camp.companies.B);
    var co = camp.companies.B;
    co.doctrines = [doc];
    return co;
  }
  // a promotion this company's doctrine makes cheaper, and its price with and without the company
  function cheaper(co, field) {
    for (var i = 0; i < co.roster.length; i++) {
      var e = co.roster[i], qs = C.promotionTargets(e, co);
      for (var j = 0; j < qs.length; j++) {
        var mine = C.promotionCost(e, qs[j].key, co), list = C.promotionCost(e, qs[j].key);
        if (mine[field] < list[field]) return { e: e, key: qs[j].key, mine: mine, list: list };
      }
    }
    return null;
  }
  var her = rival('XS4'), h = cheaper(her, 'exp');
  ok('Hermetic Society: a promotion at half the EXP is found', !!h);
  if (h) {
    h.e.exp = h.mine.exp; her.kUC = 999;
    ok('...and the rival takes it with only the half', C.rivalCanAfford(her, h.e, h.key), h.mine.exp + ' of ' + h.list.exp + ' EXP');
  }
  var smu = rival('V1'), m = cheaper(smu, 'kUC');
  ok('Smuggler: a promotion a point cheaper is found', !!m);
  if (m) {
    m.e.exp = 99; smu.kUC = m.mine.kUC;
    ok('...and the rival takes it with only the cheaper price in hand', C.rivalCanAfford(smu, m.e, m.key), m.mine.kUC + ' of ' + m.list.kUC);
  }
})();

console.log('\nCMP-1 Every payment die is rolled at once, before anyone re-rolls (pp. 85, 87)');
(function () {
  const me = C.newCompany('Mine', { faction: 'pmc' }), rival = C.newCompany('Rival', { faction: 'pmc' });
  me.doctrines = ['S2']; rival.doctrines = ['S2'];
  const inc = C.rollIncome(3, 1, me, rival, 'A', ['A']);
  ok('both sides\' dice are rolled together', inc.dice.A.length === 3 && inc.dice.B.length === 3);
  ok('...a player\'s own are left for them to decide on', !inc.neg.A);
  // (on the roll that pays it — the loser's, here — and only its 1s to 3s: a 4 or better is never worth rolling again)
  ok('...a rival with Tough Negotiators has made its re-rolls already, on the roll that pays it',
    !!inc.neg.B && inc.neg.B.dice.length === 3 && inc.neg.B.swapped.length <= 2 && inc.neg.B.swapped.every((w) => w.was <= 3), JSON.stringify(inc.neg.B));
  const pay = C.payment(3, 1, me, rival, 'A', false, { dice: inc.dice, plunder: inc.plunder, neg: inc.neg });
  const t = (d) => d.reduce((a, b) => a + b, 0);
  ok('the payment uses exactly those dice', pay.diceA.join() === inc.dice.A.join() && pay.diceB.join() === inc.dice.B.join() &&
    pay.A === Math.max(t(inc.dice.A), t(inc.dice.B)) && pay.B === t(inc.neg.B.dice), pay.A + ' / ' + pay.B);
  const both = C.rollIncome(3, 1, me, rival, 'B', ['A', 'B']);
  ok('two players (hotseat): nobody\'s dice are re-rolled for them', !both.neg.A && !both.neg.B);
})();

console.log('\nTough Negotiators re-rolls the roll that pays it, once the rolls are handed out (p. 87)');
(function () {
  const me = C.newCompany('Mine', { faction: 'pmc' }), foe = C.newCompany('Foe', { faction: 'pmc' });
  me.doctrines = ['S2'];
  const t = (d) => d.reduce((a, b) => a + b, 0);
  // the winner's own roll came to 2 (1 and 1), the other to 9 (4 and 5): the winner is paid the 9
  const dice = { A: [1, 1], B: [4, 5] };
  ok('the winner negotiates over the higher roll, whoever rolled it', C.payingDice(dice, 'A', 'A', me).join() === '4,5');
  ok('...the loser over the lower', C.payingDice(dice, 'B', 'A', foe).join() === '1,1');
  // it re-rolls the 4 to a 6: it is paid 11, and the loser's 2 is untouched
  let pay = C.payment(1, 2, me, foe, 'A', false, { dice: dice, neg: { A: { dice: [6, 5], swapped: [{ was: 4, now: 6 }], idx: [0] } } });
  ok('a winner\'s re-roll raises its own pay', pay.A === 11, String(pay.A));
  ok('...and never the loser\'s', pay.B === 2, String(pay.B));
  // a loser negotiating: its lower roll re-rolled past the winner's stays its own pay, and the rolls are not handed out again
  pay = C.payment(1, 2, me, foe, 'B', false, { dice: dice, neg: { A: { dice: [6, 6], swapped: [], idx: [0, 1] } } });
  ok('a loser\'s re-roll that beats the winner\'s pay is still only its own', pay.A === 12 && pay.B === 9, pay.A + ' / ' + pay.B);
  // a rival: only its 1s to 3s, up to half the dice
  const ng = C.negotiate([1, 4, 6, 2, 5]);
  ok('a rival never re-rolls a 4 or better', ng.swapped.length === 2 && ng.swapped.every((w) => w.was <= 3), JSON.stringify(ng.swapped));
  ok('...and nothing at all off a roll of 4s and up', C.negotiate([4, 5, 6]).swapped.length === 0);
  // a solo rival winning: its re-roll goes on the higher roll it is paid from
  let raised = 0;
  for (let i = 0; i < 300; i++) {
    const r = C.payment(1, 2, foe, me, 'B', false, null);
    if (r.negB && r.B !== r.high && r.B !== t(r.payDice.B)) raised = -9999;
    if (r.negB && r.B === t(r.payDice.B)) raised++;
  }
  ok('a rival is paid the higher roll as it re-rolled it', raised > 0);
})();

console.log('\nCMP-2 Surrounded, but Steady counts in the Rally phase only (p. 89)');
(function () {
  const mk = (key, side, x, y) => Object.assign(JSON.parse(JSON.stringify(R.profile(key))), { id: side + key, side, x, y, alive: true, models: R.profile(key).size, sp: 2, shotFrom: [], cargo: [], rules: R.profile(key).rules.slice() });
  const u = mk('regular', 'A', 20, 20), foe = mk('regular', 'B', 30, 20);
  u.camp = { flags: { surrounded: true } };
  const st = { units: [u, foe], terrain: [], objectives: [], log: [] };
  const extra = (opts) => (R.rally(st, Object.assign({}, u, { sp: 2 }), opts).extras || []).join(' ');
  ok('a rally in the Rally phase rolls a die more for the enemy within 18"', /Surrounded, but Steady \+1/.test(extra({})), extra({}));
  ok('...a Regroup does not', !/Surrounded/.test(extra({ regroup: true })), extra({ regroup: true }));
})();

console.log('\nXEN-4 Rite of Rage sheds its 2 SP in the Rally phase only (p. 142)');
(function () {
  const mk = (key, side, x, y) => Object.assign(JSON.parse(JSON.stringify(R.profile(key))), { id: side + key, side, x, y, alive: true, models: R.profile(key).size, sp: 2, shotFrom: [], cargo: [], rules: R.profile(key).rules.slice() });
  const u = mk('xbeta3', 'A', 20, 20), foe = mk('regular', 'B', 28, 20);
  u.camp = { flags: { rage: true } };
  const st = { units: [u, foe], terrain: [], objectives: [], log: [] };
  const extra = (opts) => (R.rally(st, Object.assign({}, u, { sp: 4 }), opts).extras || []).join(' ');
  ok('in the Rally phase, an enemy within 12" sheds 2 SP', /Rite of Rage/.test(extra({})), extra({}));
  ok('...a Regroup does not', !/Rite of Rage/.test(extra({ regroup: true })), extra({ regroup: true }));
})();

console.log('\nHC-14 A force that cannot field an army, and cannot recruit back to one, is finished');
(function () {
  const co = C.newCompany('X', { faction: 'pmc' });
  C.found(co, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  ok('a fresh company can fight', !C.cannotFight(co));
  co.roster = co.roster.slice(0, 2); co.kUC = 0;
  ok('...gutted and penniless, it can still recruit back (Penal troops cost nothing)', !C.canFieldArmy(co, 1, 1) && !C.cannotFight(co));
  const none = C.newCompany('Y', { faction: 'nobody' }); none.roster = []; none.kUC = 0;
  ok('...with nothing it may recruit, it is finished', C.cannotFight(none));
})();

console.log('\nAn AI force keeps one command unit of each Tier, and one Command Vehicle');
(function () {
  var cmds = function (co) { return co.roster.filter(function (e) { return R.profile(e.key).command; }); };
  var vehs = function (co) { return co.roster.filter(function (e) { return (R.profile(e.key).rules || []).indexOf('Command Vehicle') >= 0; }); };
  var dupTier = function (co) { var seen = {}, dup = 0; cmds(co).forEach(function (e) { var t = R.profile(e.key).tier; if (seen[t]) dup++; seen[t] = 1; }); return dup; };
  var camp = C.newCampaign({ mode: 'solo', nameA: 'Ironhold' });
  var co = camp.companies.B;
  C.foundRival(co, 'shock');
  co.tier = 3; co.kUC = 200;
  // as a saved force might have it: a second 3rd-grade command beside the others, and two Command Vehicles
  ['cmd2', 'cmd3', 'cmd3', 'cmd4', 'cmdveh', 'cmdveh'].forEach(function (k) { co.roster.push(C.newEntry(k)); });
  var before = { c: cmds(co).length, v: vehs(co).length };
  var did = C.developRival(co) || [];
  ok('a second command unit of a Tier is let go, one of each other Tier kept; one Command Vehicle kept',
    dupTier(co) === 0 && cmds(co).length >= 3 && vehs(co).length === 1 && co.roster.some(function (e) { return e.rid === co.cmdRid; }),
    before.c + ' commands, ' + before.v + ' vehicles -> ' + cmds(co).map(function (e) { return e.name; }).join(', ') + ' + ' + vehs(co).length + ' vehicle · ' +
    did.filter(function (x) { return x.what === 'disband'; }).map(function (x) { return x.text; }).join('; '));
  var over = 0;
  for (var t = 0; t < 30; t++) { co.kUC += 20; C.developRival(co); if (dupTier(co) || vehs(co).length > 1) over++; }
  ok('...and over thirty turns of growing it never buys past that', over === 0, 'Tier ' + co.tier + ': ' + cmds(co).map(function (e) { return e.name; }).join(', ') + ' · ' + vehs(co).length + ' Command Vehicle');
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
