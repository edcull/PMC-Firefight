/* The star system a single-player campaign is fought across (camp-system.js,
   roadmap v0.5): drawn from a seed, four to seven planets with conditions kept
   for good, homes for the rivals and a base for the company; each turn's
   contracts placed on its planets by influence; standing, and the shares moved
   by a battle; rare events; and a save and a load. */
'use strict';
const { R, C } = require('../../server/rules.js');
const S = global.PMCSystem;

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function withRandom(v, fn) { const was = Math.random; Math.random = typeof v === 'function' ? v : () => v; try { return fn(); } finally { Math.random = was; } }
function campaign() {
  const camp = C.newCampaign({ mode: 'solo', nameA: 'Tunnel Rats', factionA: 'pmc' });
  C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  C.foundRivals(camp, 3);
  camp.options = { otherWorlds: true };
  return camp;
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

console.log('\nThe system');
{
  const camp = campaign();
  const a = S.makeSystem(camp, { seed: 1234 }), b = S.makeSystem(campaign(), { seed: 1234 });
  ok('the same seed draws the same star and planets', JSON.stringify(a.planets.map((p) => [p.name, p.kind, p.world, p.orbit, p.angle])) === JSON.stringify(b.planets.map((p) => [p.name, p.kind, p.world, p.orbit, p.angle])) && a.name === b.name);
  let sizes = {}, oddOk = true, homesOk = true, baseOk = true, sharesOk = true;
  for (let s = 1; s < 120; s++) {
    const c = campaign(), sys = S.makeSystem(c, { seed: s * 7919 });
    sizes[sys.planets.length] = 1;
    if (sys.planets.filter((p) => !S.likeHome(p.world)).length < Math.ceil(sys.planets.length / 2)) oddOk = false;
    if (!c.rivals.every((co) => sys.planets.some((p) => p.home === co.name && p.influence[co.name] >= 50))) homesOk = false;
    const base = sys.planets.filter((p) => p.base);
    if (base.length !== 1 || base[0].influence.you !== 35) baseOk = false;
    if (!sys.planets.every((p) => sum(p.influence) <= 100)) sharesOk = false;
  }
  ok('four to seven planets', Object.keys(sizes).sort().join() === '4,5,6,7', Object.keys(sizes).join());
  ok('at least half of them out of the ordinary', oddOk);
  ok('every rival has a home it holds', homesOk);
  ok('...and the company a base, at 35', baseOk);
  ok('no planet\'s shares add up to more than the whole', sharesOk);
}

console.log('\nThe contracts');
{
  const camp = campaign();
  camp.system = S.makeSystem(camp, { seed: 99 });
  const offers = C.rollOffers(camp);
  const sys = camp.system;
  ok('each of the turn\'s offers is on a planet of the system, at a site on it', offers.length > 0 && offers.every((o) => o.site && S.byId(sys, o.site.planet) && o.site.name && o.site.x > 0 && o.site.x < 1));
  ok('...fought on that planet\'s kind of world, in its conditions', offers.every((o) => { const p = S.byId(sys, o.site.planet); return o.planet === p.kind && JSON.stringify(o.world) === JSON.stringify(S.conditions(sys, p)); }));
  ok('...and kept for the turn', C.rollOffers(camp) === offers);
  // over many turns, a rival is met on its home more than anywhere else
  const home = {}, other = {};
  for (let t = 0; t < 120; t++) {
    camp.turn = t; camp.offers = null;
    C.rollOffers(camp).forEach((o) => {
      const co = camp.rivals[o.rival], p = S.byId(sys, o.site.planet);
      (p.home === co.name ? home : other)[co.name] = ((p.home === co.name ? home : other)[co.name] || 0) + 1;
    });
  }
  const r0 = camp.rivals[0].name, n = sys.planets.length;
  ok('a rival is mostly met on its home ground', (home[r0] || 0) > (other[r0] || 0) / (n - 1), (home[r0] || 0) + ' at home, ' + (other[r0] || 0) + ' over the other ' + (n - 1));
}

console.log('\nStanding');
{
  const camp = campaign();
  camp.system = S.makeSystem(camp, { seed: 5 });
  const sys = camp.system, foe = camp.rivals[0].name, p = sys.planets.find((q) => q.home === foe);
  p.influence.you = 30;
  const before = p.influence[foe];
  const won = S.afterBattle(camp, { planet: p.id }, foe, 'A');
  ok('a battle won: 12 of the rival\'s share moves to the company', p.influence.you === 42 && p.influence[foe] === before - 12, JSON.stringify(p.influence));
  ok('...and nothing more paid for it: standing is for show', won.bonus === 0);
  ok('...and named', S.standingName(42) === 'Known' && S.standingName(50) === 'Held' && S.standingName(80) === 'Favoured' && S.standingName(3) === 'Unknown');
  S.afterBattle(camp, { planet: p.id }, foe, 'B');
  ok('a battle lost: 10 back the other way', p.influence.you === 32);
  p.influence = { you: 45, [foe]: 20 };
  const take = S.afterBattle(camp, { planet: p.id }, foe, 'A');
  ok('to 50 or more: the company holds the planet, and is told so', S.holder(p) === 'you' && take.lines.some((l) => /You hold/.test(l)), take.lines.join(' | '));
  // through the campaign's aftermath: the shares moved, and only a bounty paid on top
  const coA = camp.companies.A, k0 = coA.kUC;
  p.influence = { you: 60, [foe]: 30 };
  C.faceRival(camp, 0);
  const report = { winner: 'A', battleTier: 1, pl: 1, scenario: 'meeting', units: [], site: { planet: p.id } };
  const out = C.aftermath(camp, report, { dice: { A: [3], B: [3] } });
  ok('the aftermath moves the shares, with nothing paid for holding the planet', out.system && p.influence.you === 72 && !out.payment.bounty && coA.kUC === k0 + out.payment.A, JSON.stringify(out.payment));
  camp.system.events.push({ kind: 'bounty', title: 'Bounty', text: '', planet: p.id, from: camp.turn, until: camp.turn + 1 });
  const k1 = coA.kUC, out2 = C.aftermath(camp, Object.assign({}, report), { dice: { A: [3], B: [3] } });
  ok('...a bounty on it pays 2 kUC more for the win', out2.system.bonus === 2 && out2.payment.bounty === 2 && coA.kUC === k1 + out2.payment.A, JSON.stringify(out2.payment));
}

console.log('\nEvents');
{
  const camp = campaign();
  camp.system = S.makeSystem(camp, { seed: 11 });
  const sys = camp.system;
  camp.turn = 1; S.newTurn(camp);                       // the first turn seen: nothing happens
  camp.turn = 2;
  // the dice: an event this turn (under 1/6), on the first quiet planet, the first kind (a reactor breach)
  const said = withRandom(0.01, () => S.newTurn(camp));
  const ev = sys.events[0], p = ev && S.byId(sys, ev.planet);
  ok('now and then an event on a planet, said in the news', !!ev && said.length === 1 && /Reactor breach/.test(said[0]) && sys.news.some((n) => /Reactor breach/.test(n.text)), said.join());
  ok('...its condition laid over the planet\'s own while it lasts', p && S.conditions(sys, p).anomaly === 'radiation');
  ok('...and a contract offered there carries it', (() => {
    camp.offers = null;
    const offers = withRandom(0, () => C.rollOffers(camp));
    return offers.filter((o) => o.site.planet === p.id).every((o) => o.world.anomaly === 'radiation');
  })());
  camp.turn = 2 + 3; withRandom(0.99, () => S.newTurn(camp));
  ok('...and it passes', !sys.events.length && S.conditions(sys, p).anomaly === p.world.anomaly);
  // a force that has left loses its hold; a new one is given a home
  const gone = camp.rivals.shift();
  camp.rivals.push(Object.assign(C.newCompany('Newcomers', { faction: 'pmc' }), { name: 'The Newcomers' }));
  const had = sum(Object.fromEntries(sys.planets.map((q) => [q.id, q.influence[gone.name] || 0])));
  camp.turn = 6; withRandom(0.99, () => S.newTurn(camp));
  const left = sum(Object.fromEntries(sys.planets.map((q) => [q.id, q.influence[gone.name] || 0])));
  ok('a force that has left loses half its hold a turn', left <= Math.floor(had / 2) + sys.planets.length, had + ' to ' + left);
  ok('...and one new to the system is given a home', sys.planets.some((q) => q.home === 'The Newcomers' && q.influence['The Newcomers'] >= 50));
}

console.log('\nKept');
{
  const camp = campaign();
  camp.system = S.makeSystem(camp, { seed: 77 });
  const back = C.rehydrate(JSON.parse(JSON.stringify(camp)));
  ok('a save and a load keep the system as it was', JSON.stringify(back.system.planets) === JSON.stringify(camp.system.planets) && back.system.name === camp.system.name);
  ok('nonsense is set aside, not thrown', S.cleanSystem({ planets: 'x' }) === null && S.cleanSystem(null) === null);
}

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
