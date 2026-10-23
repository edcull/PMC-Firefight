/* A second story's battles in the engine (docs/story-dead-reckoning-plan.md,
   phase 1): every Dead Reckoning battle set up from the story and started, up
   to its first turn, and none played. What a second story asked of the engine:
   the place a battle is fought (its kind of world, its conditions); forces
   written from an archetype (its own kind of filler, its doctrines on side B);
   Xenotripods on either side; a force that goes without some unit groups; the
   leading rival; and the Hashamer, Xenotripods every one of them an Esh-Aven,
   named one by one, their roll carried from battle to battle. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
const dr = require('../../src/story/dead-reckoning.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
function at(node, set) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'dead-reckoning', { commander: 'Ines Okoro' });
  const n = dr._nodes[node];
  c.story.chapter = n._chapter; c.story.node = node;
  if (set) set(c.story);
  return c;
}
function deployAndStart(e) {
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
function started(c, opts) {
  const spec = S.battleSpec(c);
  const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: spec.scenario });
  const cfg = L.toCfg(c, Object.assign({ picks, role: 'A' }, opts || {}));
  cfg.mode = 'ai';
  const e = Engine.create();
  e.start(cfg);
  deployAndStart(e);
  return { cfg, e, st: e.state(), spec };
}
const battles = Object.keys(dr._nodes).filter((k) => dr._nodes[k].type === 'battle');
const groupOf = (k) => (R.profile(String(k).split(':')[0]) || {}).group || '';
const FACTION = Object.keys(dr.sides).reduce((o, k) => { o[k] = dr.sides[k].faction; return o; }, {});

console.log('\nEvery battle, set up and started (' + battles.length + ')');
const runs = {}, errs = [];
battles.forEach((id) => {
  try { runs[id] = started(at(id)); } catch (err) { errs.push(id + ': ' + err.message); }
});
ok('every battle in the story sets up and starts in the engine', !errs.length && battles.every((id) => runs[id] && runs[id].st.phase === 'battle'),
  errs.slice(0, 2).join(' | ') + battles.filter((id) => runs[id] && runs[id].st.phase !== 'battle').join(', '));
ok('...each against its own side: its units of that side’s army', battles.every((id) => {
  const r = runs[id]; if (!r) return false;
  const want = FACTION[r.spec.enemy.side];
  return r.st.units.filter((u) => u.side === 'B' && !u.spawned).every((u) => u.faction === want);
}), battles.filter((id) => runs[id] && runs[id].st.units.some((u) => u.side === 'B' && !u.spawned && u.faction !== FACTION[runs[id].spec.enemy.side])).join(', '));

console.log('\nWhere each is fought');
const placed = battles.filter((id) => runs[id] && runs[id].spec.place);
ok('every battle has its place: its kind of world as the table', placed.length === battles.length &&
  placed.every((id) => runs[id].cfg.planet === runs[id].spec.place.kind), battles.filter((id) => !placed.includes(id)).join(', '));
const worlded = placed.filter((id) => runs[id].spec.place.world);
ok('...and where the place has conditions, they are the battle’s, Other Worlds or not', worlded.length >= 10 && worlded.every((id) => {
  const r = runs[id], w = r.spec.place.world;
  return r.cfg.options.otherWorlds && Object.keys(w).every((k) => r.cfg.world[k] === w[k]) && R.worldOf(r.st) && R.worldOf(r.st)[Object.keys(w)[0]] === w[Object.keys(w)[0]];
}), worlded.length + ' battles with conditions');
ok('...the campaign’s own options untouched by it', (() => { const c = at('c3.battle'); c.options = { otherWorlds: false }; L.toCfg(c, { picks: [] }); return c.options.otherWorlds === false; })());
ok('a battle with a place of its own: the Glass Flats’ low gravity, Station Thule’s airless arctic',
  runs['c2f.battle'].cfg.planet === 'desert' && runs['c2f.battle'].cfg.world.gravity === 'low' &&
  runs['c2t.battle'].cfg.planet === 'arctic' && runs['c2t.battle'].cfg.world.atmosphere === 'none');

console.log('\nForces from their archetypes');
ok('the enemy’s doctrines are its archetype’s, one for each Battle Tier', battles.every((id) => {
  const r = runs[id], a = C.archetype(r.spec.enemy.archetype);
  return JSON.stringify(r.cfg.doctrines.B) === JSON.stringify(a.doctrines.slice(0, r.cfg.tier));
}));
const at3 = (id, set) => { const c = at(id, set); return L.toCfg(c, { picks: [], tier: 3, pl: 2 }); };
const wraith3 = at3('bounty.battle'), sable3 = at3('wreck.battle');
const wraithKeys = wraith3.armyB.map((k) => String(k).split(':')[0]), sableKeys = sable3.armyB.map((k) => String(k).split(':')[0]);
ok('a rival fills its force with its own kind: Wraith Section, observers and light infantry; Sable, armour',
  wraithKeys.some((k) => /observers|lrrp|snipers|nomads|recon|ew/.test(k)) && sableKeys.some((k) => /bats|protectors|hunter|destroyer/.test(k)),
  'Wraith ' + wraithKeys.join(' ') + ' / Sable ' + sableKeys.join(' '));
ok('...the same force each time it is looked at', JSON.stringify(at3('bounty.battle').armyB) === JSON.stringify(wraith3.armyB));
ok('...and a tribe its own: the Ulvar behind shield turrets', at3('watchers.battle').armyB.some((k) => /Shield Turrets|Defensive Turrets/.test(groupOf(k))));
ok('a Xenotripod force is led by an Alpha for the Tier', ['storm.battle', 'spire.battle', 'cold.battle'].every((id) => runs[id].cfg.armyB.some((k) => /^xalpha/.test(k))));
const shk = L.describeForce(L.buildForce(S.battleSpec(at('c3.battle')).enemy, { campaign: at('c3.battle'), tier: 2, pl: 1 }), 1, 'xeno');
ok('...and the briefing tells it as Xenotripods', /Alpha leads them/.test(JSON.stringify(shk.items)), JSON.stringify(shk.items));

console.log('\nThe leading rival');
{
  const c = at('landing.battle', (st) => { st.meters.kettle = 6; });
  c.story.leading = null;
  const spec = S.battleSpec(c);
  ok('The Landing is fought against the strongest rival: Brass Ledger at strength 6', spec.enemy.side === 'kettle' && spec.enemy.archetype === 'swarm', spec.enemy.side);
  ok('...its commander the target', spec.variant.target === 'Kettering’s Own');
  const k2 = at('landing.battle'); k2.story.leading = null;
  ok('...Kestrel first on a tie: it always gets there first', S.battleSpec(k2).enemy.side === 'kestrel');
  // the chapter fixes its rival as it begins: the meters can change after, and it is the same rival
  const k4 = C.newCampaign({ mode: 'solo' }); C.found(k4.companies.A, FOUNDING, 'S2'); S.begin(k4, 'dead-reckoning', {});
  k4.story.meters.wraith = 7;
  k4.story.chapter = 'fault'; k4.story.node = 'pool';
  k4.story.pool = { node: 'pool', left: 1, offers: [{ thread: 'race', chapter: 'landing' }] };
  S.choose(k4, 'landing');
  const fixed = k4.story.leading;
  k4.story.meters.sable = 10;
  k4.story.node = 'landing.battle';
  ok('...fixed when the chapter begins, so a reload meets the same rival', fixed === 'wraith' && S.battleSpec(k4).enemy.side === 'wraith', fixed + ', then ' + S.battleSpec(k4).enemy.side);
  const r = started(at('landing.battle', (st) => { st.meters.sable = 6; st.leading = 'sable'; }));
  ok('...and in the engine: Sable on the field, its commander the battle’s target', r.st.units.some((u) => u.side === 'B' && u.storyTarget && u.name === 'Sable’s Guard'));
}

console.log('\nThe Hashamer: Xenotripods, every one an Esh-Aven');
const ESH = /^(Seven-|Second-|Third-|Ninth-|Last-|First-)?[A-Z][a-z]+(-at)?-the-[A-Z][a-z]+$/;
const allyLever = dr._nodes['mimics.ask'].options.find((o) => o.id === 'help').battle;
const withAllies = (id, set) => { const c = at(id, set); c.story.pending = JSON.parse(JSON.stringify(allyLever)); return c; };
const m = started(withAllies('mimics.battle'));
const eshA = m.st.units.filter((u) => u.ally);
ok('they fight beside the company in The Mimics', eshA.length >= 2 && eshA.every((u) => u.skin === 'eshaven'), eshA.map((u) => u.name).join(', '));
ok('...each trooper drawn as an Esh-Aven and called one: an Epsilon as itself, every other caste in its own Esh-Aven kit', eshA.filter((u) => !R.isMachine(u)).every((u) => /^(x_eps\d|xesh_(alpha|beta|gamma|delta))$/.test(u.art) && /^Esh-Aven /.test(u.name)),
  eshA.map((u) => u.art + ' ' + u.name).join(', '));
{
  // a Hashamer force with every caste in it: an Alpha, a Beta, a Gamma and a Delta, all Esh-Aven
  const c = at('mimics.battle'); c.story.pending = JSON.parse(JSON.stringify(allyLever));
  c.story.pending.allies.core = ['xalpha2', 'xbeta2', 'xgamma3', 'xdelta1'];
  const all = started(c).st.units.filter((u) => u.ally && !R.isMachine(u));
  // (brought down to a new company's Tier, the castes are what the Tier allows: each still in its own kit)
  const caste = (u) => (/^x(alpha|beta|gamma|delta|eps)/.exec(u.key) || [])[1];
  ok('...every caste in its own Esh-Aven kit: the Alpha with its staff and crest still the leader',
    all.some((u) => caste(u) === 'alpha') && all.every((u) => caste(u) === 'eps' ? /^x_eps\d$/.test(u.art) : u.art === 'xesh_' + caste(u)), all.map((u) => u.key + ':' + u.art).join(', '));
}
ok('...each one named, in their manner, and none only a count', eshA.filter((u) => !R.isMachine(u)).every((u) => !R.counted(u) && u.men.length === u.models && u.men.every((x) => ESH.test(x.name))),
  eshA.map((u) => u.men.map((x) => x.name).join('/')).join('; '));
ok('...the same numbers as the unskinned unit: a reskin, nothing more', eshA.every((u) => { const p = R.profile(u.key); return u.models === p.size && u.move === p.move; }));
const hashForces = [];
[1, 2, 3, 4].forEach((tier) => [1, 2].forEach((pl) => {
  const c = withAllies('mimics.battle', (st) => { st.meters.alarm = 9; st.flags.contact = true; st.flags.eshaven_freed = true; });
  const cfg = L.toCfg(c, { picks: [], tier, pl });
  hashForces.push(cfg.armyA.slice(cfg.story.allyFrom));
}));
ok('no craft and no teleport turret among them, at any Tier, PL or Alarm', hashForces.every((ks) => ks.every((k) => !/Aviation|Teleport/.test(groupOf(k)))),
  [...new Set([].concat(...hashForces).map(groupOf))].join(', '));
ok('...and the briefing tells them as Esh-Aven', /Esh-Aven/.test(JSON.stringify(L.describeForce({ picks: [{ key: 'xeps1', skin: 'eshaven' }, { key: 'xdelta1', skin: 'eshaven' }] }, 0, 'xeno'))));

console.log('\nTheir dead, by name, and the living back');
{
  const c = withAllies('mimics.battle');
  const r = started(c);
  const allies = r.st.units.filter((u) => u.ally && !R.isMachine(u));
  const fallen = allies[0].men[0].name, standing = allies.map((u) => u.men.map((x) => x.name)).flat().filter((n) => n !== fallen);
  const report = {
    winner: 'A', routed: { A: false, B: true }, scenario: r.cfg.scenario,
    units: allies.map((u) => ({ side: 'A', ally: true, skin: u.skin, rid: u.rid || u.id, key: u.key, tier: u.tier, startSize: u.models, endSize: u.models,
      men: u.men.map((x) => x.name).filter((n) => n !== fallen) })).concat([{ side: 'B', rid: 'b0', key: 'recruits', tier: 1, startSize: 6, endSize: 0, wiped: true }]),
    casualties: [{ side: 'A', rid: allies[0].rid || allies[0].id, name: fallen, turn: 3 }]
  };
  S.resolveBattle(c, report);
  const roll = c.story.roll.eshaven;
  ok('the fallen are kept by name', roll.fallen.indexOf(fallen) >= 0 && roll.last.join() === fallen, roll.fallen.join(', '));
  ok('...and the debrief can say them', S.render(c, 'We lost {fallen:eshaven}.') === 'We lost ' + fallen + '.' && S.render(c, '{dead:eshaven}') === fallen);
  ok('the living stay on the roll', standing.every((n) => roll.living.indexOf(n) >= 0) && roll.living.indexOf(fallen) < 0, roll.living.length + ' living');
  // the next battle they fight in: the same people, by name, the fallen not among them
  const c2 = withAllies('spire.battle', (st) => { st.roll = c.story.roll; });
  const r2 = started(c2);
  const back = r2.st.units.filter((u) => u.ally && !R.isMachine(u)).map((u) => u.men.map((x) => x.name)).flat();
  ok('the next time they fight, the same Esh-Aven come back, by name', back.length && back.filter((n) => standing.indexOf(n) >= 0).length >= Math.min(back.length, standing.length) - 1 && back.indexOf(fallen) < 0,
    back.slice(0, 6).join(', '));
  ok('...and new ones, named, fill the ranks', back.every((n) => ESH.test(n)));
}

console.log('\nDeep Contract is as it was');
{
  require('../../src/story/deep-contract.js');
  const c = C.newCampaign({ mode: 'solo' }); C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'deep-contract'); c.story.chapter = 'c3'; c.story.node = 'c3.battle';
  const cfg = L.toCfg(c, { picks: [] });
  ok('its battles have no doctrines on side B, no place, and the campaign’s own world', cfg.doctrines.B.length === 0 && !cfg.story.place && cfg.world === null && cfg.planet === 'mountain');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
