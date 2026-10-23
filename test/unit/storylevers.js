/* A story battle set up (src/story/levers.js) and its hooks in the engine
   (src/engine/storybattle.js): the Tier and PL relative to the company, the
   enemy force built from what the story wrote, the cfg, and in the engine
   the allies, the named units, the prelude, the ambush and the target. Every
   battle here is set up and started, and none is played: nobody's AI takes a
   turn. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
function campaign() {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  c.companies.A.name = 'Kessler Rifles';
  S.begin(c, 'deep-contract');
  return c;
}
const keys = (picks) => picks.map((p) => p.key);
const pts = (picks) => picks.reduce((s, p) => s + R.profile(p.key).tier, 0);

/* A battle started from a cfg and taken to turn 1, as a campaign battle is:
   the AI places the enemy, and the player's units are placed as the AI would
   place them. Nothing is played: if the enemy has the first activation, the
   AI answers for it up to the player's turn, and no further. */
function started(cfg) {
  const e = Engine.create();
  cfg.mode = 'ai';
  e.start(cfg);
  for (let i = 0; i < 6 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}

console.log('\nHow big a battle');
let c = campaign();
const co = c.companies.A;
ok('a new company fields Tier I and no higher', L.maxTier(co, 1) === 1);
ok("'max' and 'max-1' are both Tier I for it, and a written Tier III comes down to I",
  L.tierFor(co, { tier: 'max' }) === 1 && L.tierFor(co, { tier: 'max-1' }) === 1 && L.tierFor(co, { tier: 3 }) === 1);
ok('a chapter can hold its Tier up (min) or down (max)', L.tierFor(co, { tier: 'max', minTier: 2 }) === 2 && L.tierFor(co, { tier: 3, maxTier: 1 }) === 1);
ok('the Priority Levels it can field, and pl: max is the highest of them', L.levelsFor(co, 1).indexOf(1) >= 0 && L.plFor(co, 1, 'max') === Math.max(...L.levelsFor(co, 1)));

console.log('\nThe enemy force');
const hunt = S.get('deep-contract')._nodes['c3.battle'].enemy;
let f = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1 });
ok('a Tier III leader leads it', f.picks[0].key === C.commandKey({ faction: 'rebel' }, 3), f.picks[0].key);
ok("the named unit is there, named, brought down to the Tier: Varga's Own", f.picks.some((p) => p.name === "Varga's Own" && R.profile(p.key).tier <= 3));
ok('...and the core written for Tier III, not the plain one', keys(f.picks).indexOf('rfaceminers') >= 0 || keys(f.picks).indexOf('rinsurgents') >= 0);
ok('the filler brings it close to its share of the points', pts(f.picks) <= R.COMPOSITION[3].points * 1.3 + 1 && pts(f.picks) >= R.COMPOSITION[3].points * 0.8, pts(f.picks) + ' points of ' + R.COMPOSITION[3].points);
f = L.buildForce(hunt, { campaign: c, tier: 1, pl: 1 });
ok('at Tier I everything above Tier I comes down to fit', f.picks.every((p) => R.profile(p.key).tier <= 1), keys(f.picks).join(','));
ok("...Varga's Own included, still named", f.picks.some((p) => p.name === "Varga's Own"));
c.story.meters.rebels = 0;
const few = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1 }).picks.filter((p) => !p.name).length;
c.story.meters.rebels = 10;
const many = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1 }).picks.filter((p) => !p.name).length;
ok('Rebel Strength calls up more of the optional units', many > few, few + ' → ' + many);
c.story.meters.rebels = 6;
const base = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1 });
c.story.flags.varga_dead = true;
f = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1 });
ok('a flag changes the force: Varga dead brings the Avengers, Determined', f.picks.some((p) => p.name === 'The Avengers' && p.rules.indexOf('Determined') >= 0));
delete c.story.flags.varga_dead;
c.story.flags.depot_raided = true;
f = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1 });
ok('...and the depot raided takes the mortar away', keys(base.picks).indexOf('rlightart') >= 0 && keys(f.picks).filter((k) => k === 'rlightart').length < keys(base.picks).filter((k) => k === 'rlightart').length,
  keys(base.picks).join(','));
delete c.story.flags.depot_raided;
const r2 = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1, readiness: 2 });
const rneg = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1, readiness: -9 });
const r3 = L.buildForce(hunt, { campaign: c, tier: 3, pl: 1, readiness: 3 });
ok('Readiness 2 brings one unit more; below nothing, a smaller force', r2.picks.length === base.picks.length + 1 && pts(rneg.picks) < pts(base.picks),
  base.picks.length + ' / ' + r2.picks.length + ' units; ' + pts(base.picks) + ' / ' + pts(rneg.picks) + ' points');
ok('Readiness 3: the Front makes its Last Stand', r3.tactics === 'laststand' && r3.readiness === 3);
const vet = JSON.parse(JSON.stringify(co));
vet.roster.forEach((e) => { e.exp = 40; e.honours = [1, 2]; });
ok('the allowance grows with the company, and is capped', L.allowance(vet) > L.allowance(co) && L.allowance(vet) <= 0.25, L.allowance(co).toFixed(3) + ' → ' + L.allowance(vet).toFixed(3));

console.log('\nThe cfg');
c = campaign();
S.proceed(c); S.choose(c, 'take');
const picks = C.pickForce(c.companies.A, 1, 1, null);
let cfg = L.toCfg(c, { picks });
ok('Landfall: Tier I, Secure and control, the company\'s picks, the Front\'s name', cfg.tier === 1 && cfg.scenario === 'secure' && cfg.nameB === "Free Miners' Front" && cfg.armyA.length === picks.length + 2);
ok('...the port\'s men at the end of side A, marked as allies and on nobody\'s dossier', cfg.story.allyFrom === picks.length && cfg.dossier.A.slice(picks.length).every((e) => e === null));
ok('...and the Front with a tactic and its leader', cfg.tactics.B === 'guerillas' && C.isLeaderKey(cfg.armyB[0]));
c = campaign();
S.proceed(c); S.choose(c, 'send'); S.resolveBattle(c, 'victory'); S.proceed(c); S.choose(c, 'bury');
while (S.view(c).type !== 'event' || S.view(c).id !== 'c2.firstmove') S.view(c).type === 'event' ? S.choose(c, S.view(c).options.find((o) => o.ok).id) : S.proceed(c);
S.choose(c, 'relieve');                      // the depot left alone: the Front keeps its guns for the hunt
ok('the depot passed up holds a change for the hunt', c.story.next.some((n) => n.battle === 'c3.battle' && n.enemy));
S.choose(c, 'free'); S.resolveBattle(c, 'victory');
S.proceed(c); S.choose(c, S.view(c).options[0].id);
while (c.story.node !== 'c3.killorcapture') S.view(c).type === 'event' ? S.choose(c, S.view(c).options.find((o) => o.ok).id) : S.proceed(c);
S.choose(c, 'snatch');
cfg = L.toCfg(c, { picks, tier: 3 });
ok('the hunt with the snatch team: the capture variant, and Varga\'s unit marked as the target',
  cfg.story.variant.capture && Object.keys(cfg.story.units.B).some((i) => cfg.story.units.B[i].target && cfg.story.units.B[i].name === "Varga's Own"));
ok('...and the guns the depot kept are in the force', cfg.armyB.indexOf('rlightart') >= 0, cfg.armyB.join(','));
cfg = L.toCfg(c, { picks });
ok('...the snatch team is a Tier down (for a Tier I company, still Tier I)', cfg.tier === 1);

c = campaign();
c.story.node = 'c3.killorcapture'; c.story.chapter = 'c3';
S.choose(c, 'wait');
ok('waiting for her: the role is the player\'s to choose', L.toCfg(c, { picks, role: 'B' }).attacker === 'B' && L.toCfg(c, { picks, role: 'A' }).attacker === 'A');
c.story.pending = { readiness: 1 };
cfg = L.toCfg(c, { picks });
ok('Readiness 1: barricades for the enemy', cfg.story.barricades && cfg.story.barricades.B > 0);

console.log('\nIn the engine');
c = campaign();
S.proceed(c); S.choose(c, 'take');
cfg = L.toCfg(c, { picks });
let e = started(cfg), st = e.state();
const allies = st.units.filter((u) => u.ally);
ok('the allies stand on side A, marked, in the third colour', allies.length === 2 && allies.every((u) => u.side === 'A' && u.paint === 'C') && !!st.cfg.colourC);
ok('the battle starts with them', st.phase === 'battle' && st.turn === 1);
const kit = global.PMCEngineStory({ R, get state() { return st; }, logLine() {}, pushRes() {} });
st.activeSide = 'A';
const own = st.units.filter((u) => u.side === 'A' && !u.ally && u.alive);
own.forEach((u) => { u.activated = false; u.reserve = false; u.aboard = false; });
allies.forEach((u) => { u.activated = false; u.reserve = false; u.aboard = false; });
ok('side A\'s first activation is the player\'s', kit.allyActs() === false);
own.slice(0, Math.ceil(own.length / 2)).forEach((u) => { u.activated = true; });
ok('once the player has had their share, the allies take one', kit.allyActs() === true);
own.forEach((u) => { u.activated = true; });
ok('with the player\'s units all spent, the allies go on', kit.allyActs() === true);
allies.forEach((u) => { u.activated = true; });
ok('with everyone spent, nobody', kit.allyActs() === false);

const cfgP = { tier: 1, pl: 1, scenario: 'demolish', attacker: 'A', armyA: picks.map((p) => R.entryPick(p)), armyB: ['rinstigators', 'rciv', 'rciv', 'rciv'],
  campaign: true, dossier: { A: picks, B: null }, story: { strikes: 3, suppressOwn: 1, ambush: 'A', units: { A: {}, B: { 1: { name: 'The Teacher\'s Brother', rules: ['Determined'] } } } } };
e = started(cfgP); st = e.state();
ok('the prelude: three strikes on the enemy, in the battle\'s log', st.log.filter((l) => /^Strike on .*\[B\]/.test(l.text || '')).length === 3);
ok('...a failed recon\'s Suppression on one of your own', st.log.some((l) => /\[A\] starts the battle with 1 SP/.test(l.text || '')));
ok('the ambush: the side that sprang it has the first turn', st.initiative === 'A' && st.log.some((l) => /the ambush/.test(l.text || '')));
ok('a named unit is named, with the rules the story gave it', st.units.some((u) => u.side === 'B' && u.name === "The Teacher's Brother" && u.rules.indexOf('Determined') >= 0));
ok('the prelude is rolled once', (kit.storyPrelude(true), st.log.filter((l) => /^Strike on/.test(l.text || '')).length === 3));

console.log('\nThe ambush');
/* Nobody marches on: the side caught out sets up on its own edge, the side that
   sprang it anywhere more than 12" from it, after it. */
const gapOf = (st2, side) => Math.min(...st2.units.filter((u) => u.side === side && u.alive && u.x >= 0 && !u.aboard).map((u) =>
  Math.min(...st2.units.filter((e) => e.side !== side && e.alive && e.x >= 0 && !e.aboard).map((e) => R.inches(u.x, u.y, e.x, e.y)))));
const cfgAm = (by) => ({ tier: 1, pl: 1, scenario: 'meeting', attacker: 'A', armyA: picks.map((p) => R.entryPick(p)), armyB: ['rinstigators', 'rciv', 'rciv', 'rciv'],
  campaign: true, dossier: { A: picks, B: null }, story: { ambush: by, name: 'Ambush on the Square', units: { A: {}, B: {} } } });
// (as in a real game: the OpFor is never told to deploy; it sets up on its own)
e = Engine.create(); { const cb = cfgAm('B'); cb.mode = 'ai'; e.start(cb); }
for (let i = 0; i < 6 && e.state().phase !== 'battle'; i++) { e.intent('A', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); }
st = e.state();
const onA = st.units.filter((u) => u.side === 'A' && u.alive && u.x >= 0), onB = st.units.filter((u) => u.side === 'B' && u.alive && u.x >= 0);
ok('the enemy’s ambush: both sides are on the table before turn 1, nobody marching on', st.phase === 'battle' && onA.length > 0 && onB.length > 0, onA.length + ' v ' + onB.length);
ok('...you set up on your own edge', onA.every((u) => u.x <= 6.5), onA.map((u) => u.x.toFixed(1)).join(' '));
ok('...and they set up after you, anywhere, more than 12" from every unit of yours', gapOf(st, 'B') > 12 && onB.some((u) => u.x < R.BOARD.w - 6), 'nearest ' + gapOf(st, 'B').toFixed(1) + '"');
ok('...they have the first turn, and the log says they were lying in wait', st.initiative === 'B' && st.log.some((l) => /lying in wait/.test(l.text || '')), st.initiative + ' | ' + st.log.filter((l) => /ambush|wait|initiative/i.test(l.text || '')).map((l) => l.text).join(' / '));
e = started(cfgAm('A')); st = e.state();
const myA = st.units.filter((u) => u.side === 'A' && u.alive && u.x >= 0);
ok('your ambush: the enemy is on its own edge, and you set up more than 12" from it, anywhere', myA.length > 0 && gapOf(st, 'A') > 12 && st.initiative === 'A', 'nearest ' + gapOf(st, 'A').toFixed(1) + '"');

console.log('\nThe edge, chosen on the muster');
/* Retake the Refinery, with the night shift freed: the player picks the edge to
   come in from, and from the east the refinery is laid the other way about. */
c = campaign();
c.story.chapter = 'retake'; c.story.node = 'retake.battle'; c.story.flags.nightshift_freed = true;
const west = L.toCfg(c, { picks, role: 'A' }), eastCfg = L.toCfg(c, { picks, role: 'A', edge: 'east' });
ok('the battle offers the choice', S.battleSpec(c).levers.edge === 'choose' && west.story.edge === 'west' && eastCfg.story.edge === 'east');
const tower = (cf) => cf.terrainPlan.find((t) => t.plan === 'L');
ok('from the east, the map is mirrored: the sheds by the tank farm stand the other way about', Math.abs((tower(west).x + tower(west).w / 2) + (tower(eastCfg).x + tower(eastCfg).w / 2) - R.BOARD.w) < 0.01,
  (tower(west).x).toFixed(1) + ' / ' + (tower(eastCfg).x).toFixed(1));
ok('...and it is a mission of its own, seeded apart', west.story.seed !== eastCfg.story.seed);
c.story.flags.nightshift_freed = false;
ok('without the choice, the edge is the map’s own, whatever is asked', L.toCfg(c, { picks, role: 'A', edge: 'east' }).story.edge === null);

console.log('\nThe target');
const cfgT = Object.assign({}, cfgP, { story: { variant: { target: 'Varga', capture: true }, units: { A: {}, B: { 1: { name: 'Varga', target: true } } } } });
e = started(cfgT); st = e.state();
const tk = global.PMCEngineStory({ R, state: st, logLine() {}, pushRes() {} });
const target = st.units.find((u) => u.storyTarget);
ok('the target is marked', !!target && target.name === 'Varga');
ok('alive and steady, nothing ends', tk.targetCheck(st) === null);
target.sp = 99;
const taker = st.units.find((u) => u.side === 'A' && !R.isMachine(u) && u.alive);
st.units.filter((u) => u.side === 'A').forEach((u) => { u.x = target.x + 20; u.y = target.y; });
ok('Broken, but nobody of side A has reached her: nothing yet', R.status(target) === 'broken' && tk.targetCheck(st) === null);
taker.x = target.x; taker.y = target.y + 0.5;
let res = tk.targetCheck(st);
ok('Broken and reached: taken alive, a win for side A', res && res.winner === 'A' && st.storyOutcome.target === 'captured', res && res.text);
target.alive = false;
res = tk.targetCheck(st);
ok('killed: still a win, but a kill', res && res.winner === 'A' && st.storyOutcome.target === 'killed');

console.log('\nThe report back');
c = campaign();
c.story.node = 'c3.battle'; c.story.chapter = 'c3'; c.story.flags.aim_capture = 'local';
S.resolveBattle(c, { winner: 'A', routed: {}, story: { target: 'killed' }, units: [{ side: 'A', tier: 1, startSize: 5, endSize: 5 }, { side: 'B', tier: 1, startSize: 5, endSize: 0, wiped: true }] });
ok('a snatch that ended with her dead is a kill: Varga is dead, not taken', c.story.flags.varga_dead && !c.story.flags.varga_captured);
const withAllies = { winner: 'A', routed: {}, units: [
  { side: 'A', tier: 1, startSize: 5, endSize: 5 }, { side: 'A', tier: 3, startSize: 10, endSize: 0, wiped: true, ally: true },
  { side: 'B', tier: 1, startSize: 5, endSize: 2 }] };
ok('the grade counts the company\'s losses, not its allies\'', S.grade(withAllies) === 'decisive');

console.log('\nA story dossier');
c = campaign();
ok('it stays a solo campaign, with a story on it', c.mode === 'solo' && S.active(c));
ok('no battles are fought elsewhere: no rivals pair off out of sight', C.elsewherePairs(c, c.companies.B).length === 0);
ok('no rival offers: the story\'s jobs are its own', C.rollOffers(c).length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
