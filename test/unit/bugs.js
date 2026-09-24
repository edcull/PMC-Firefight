/* The Space Bugs (pp. 113-127): the list, the swarm rolls, the weapons table
   and every one of the army's own special rules, exercised against the engine. */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(52) +
    String(got).padEnd(8) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

function mk(key, side, x, y, opts) {
  opts = opts || {};
  var p = R.profile(key);
  var u = {
    id: side + key + Math.random().toString(36).slice(2, 6), key: key, side: side, code: p.code,
    name: p.name, label: p.name + ' [' + side + ']', cls: p.cls || 'infantry', art: p.art, faction: p.faction,
    tier: p.tier, size: p.size, startSize: p.size, models: opts.models || p.size, move: p.move, turn: p.turn,
    fp: p.fp, range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault,
    morale: p.morale, str: p.str, transport: p.transport, cargo: [], damage: 0,
    facing: opts.facing || 0, aboard: null, rules: p.rules.slice(), x: x, y: y, sp: opts.sp || 0,
    alive: true, activated: false, marked: false, shotFrom: [], drone: false
  };
  return u;
}
function world(terrain) { return { units: [], terrain: terrain || [], objectives: [], log: [] }; }

/* ---------------- the list ---------------- */
head('The swarm list');
var bugs = R.CATALOGUE.filter(function (p) { return p.faction === 'bugs'; });
ok('26 bug profiles', bugs.length, 26);
ok('six Leader Bug profiles... five, one per Tier', bugs.filter(function (p) { return p.leaderBug; }).length, 5);
ok('Overgrown: 5 ground, 1 flying', bugs.filter(R.isOvergrown).length, 6);
ok('the carrier bug is an aircraft', R.profile('bcarrier').cls, 'aircraft');
ok('bugs take no propulsion', R.defaultDrive(R.profile('bqueen')), null);
ok('the faction has a name', !!(R.FACTIONS.bugs && R.FACTIONS.bugs.name), true);

head('Composition (p. 114)');
var leg = R.checkArmy(['bwatchers', 'battack', 'battack', 'bspitters', 'bsmall', 'btiny'], 3, 1);
ok('a legal BT III swarm passes', leg.ok !== false && !(leg.faults || []).length, true, (leg.faults || []).join('; '));
var noLead = R.checkArmy(['battack', 'battack', 'bspitters', 'bsmall', 'btiny', 'btiny', 'btiny'], 3, 1);
ok('no Leader Bug is a fault', (noLead.faults || []).some(function (f) { return /leader/i.test(f); }), true);
var lowLead = R.checkArmy(['bimmwatch', 'battack', 'battack', 'bspitters', 'bsmall', 'btiny', 'btiny'], 3, 1);
ok('a Leader below the Battle Tier is a fault', (lowLead.faults || []).some(function (f) { return /leader/i.test(f); }), true);
var twoLead = R.checkArmy(['bwatchers', 'bwatchers', 'battack', 'battack', 'btiny'], 3, 1);
ok('two Leader Bugs is a fault', (twoLead.faults || []).some(function (f) { return /leader/i.test(f); }), true);

head('Rolled swarms are legal');
var bad = [];
for (var bt = 1; bt <= 5; bt++) {
  for (var pl = 1; pl <= 2; pl++) {
    for (var n = 0; n < 40; n++) {
      var keys = R.rollArmy(bt, pl, null, 'bugs');
      var c = R.checkArmy(keys, bt, pl);
      if ((c.faults || []).length) bad.push('BT' + bt + ' PL' + pl + ': ' + c.faults[0]);
      if (!keys.every(function (k) { return R.profile(R.splitPick(k).key).faction === 'bugs'; })) bad.push('non-bug in swarm');
    }
  }
}
ok('400 rolls across BT I-V, PL 1-2', bad.length, 0, bad.slice(0, 2).join(' | '));

/* ---------------- weapons ---------------- */
head('What they shoot with');
ok('spitters spit three globs', R.weaponSpec(mk('bspitters', 'A', 0, 0)).p + 'x' + R.weaponSpec(mk('bspitters', 'A', 0, 0)).n, 'spitx3');
ok('bio-plasma is the big sac', R.weaponStyle(mk('bbioplasma', 'A', 0, 0)), 'spitbig');
ok('the fire beetle breathes flame', R.weaponStyle(mk('bfirebeetle', 'A', 0, 0)), 'flame');
ok('winged bugs loose spines', R.weaponStyle(mk('bsmallwing', 'A', 0, 0)), 'spine');
ok('attack forms have no gun', R.weaponStyle(mk('battack', 'A', 0, 0)), 'none');
ok('infected humans have no gun', R.weaponStyle(mk('binfected', 'A', 0, 0)), 'none');

/* ---------------- rules ---------------- */
head('Overmind (p. 116)');
var st = world();
var om = mk('bwatchers', 'A', 10, 10), sw = mk('battack', 'A', 20, 10), far = mk('battack', 'A', 40, 10);
var big = mk('boversized', 'A', 14, 10);
st.units = [om, sw, far, big];
ok('a Tier III bug 10" off is under a Tier III Overmind', !!R.overmindFor(st, sw), true);
ok('30" off it is on its own', !!R.overmindFor(st, far), false);
ok('a Tier IV bug is not led by a Tier III Overmind', !!R.overmindFor(st, big), false);
sw.sp = 5;
var ral = R.rally(st, sw);
ok('Rally under the Overmind clears every SP', sw.sp, 0);
st.doctrines = { A: ['BB3'] };
ok('Increased Control stretches it to 24"', R.overmindReach(st, 'A'), 24);
st.doctrines = null;

head('Aggressive (p. 116)');
ok('near the Overmind an Aggressive bug is free', R.aggressiveNow(st, sw), false);
ok('out of reach it must charge', R.aggressiveNow(st, far), true);
ok('spitters are not Aggressive', R.aggressiveNow(st, mk('bspitters', 'A', 60, 10)), false);

head('Animal Behaviour (p. 116)');
var q = 0, s = 0, sp = 0, N = 6000;
for (var i = 0; i < N; i++) {
  var r = R.resolveAssaultHits(mk('battack', 'A', 0, 0), 1, 0, null);
  if (r.casualties) s++; else q++;
  sp += r.sp;
}
ok('half the hits are QUEKKK!', Math.abs(q / N - 0.5) < 0.03, true, (q / N).toFixed(2));
ok('a SPLASH! costs one bug and 2 SP', (sp / s).toFixed(1), '2.0');
var cov = world([{ kind: 'woods', x: 38, y: 5, w: 6, h: 10 }]);
var inWood = mk('battack', 'A', 40, 10), rif = mk('regular', 'B', 55, 10);
cov.units = [inWood, rif];
ok('no terrain cover without an Overmind', R.coverFor(cov, rif, inWood).v, 0);
var om2 = mk('bwatchers', 'A', 30, 10);
cov.units.push(om2);
ok('under the Overmind the woods count', R.coverFor(cov, rif, inWood).v > 0, true);

head('Pheromone Markers (p. 116)');
var ph = world();
var tgt = mk('regular', 'B', 30, 10), shooter = mk('bspitters', 'A', 18, 10);
var m1 = mk('bsmallpath', 'A', 30, 20), m2 = mk('bpathfinder', 'A', 30, 0), m3 = mk('blurkers', 'A', 40, 10), m4 = mk('bsmallpath', 'A', 20, 20);
ph.units = [tgt, shooter, m1];
ok('one marker near the target: +1', R.pheromoneBonus(ph, shooter, tgt), 1);
ph.units = [tgt, shooter, m1, m2, m3, m4];
ok('four markers: capped at +3', R.pheromoneBonus(ph, shooter, tgt), 3);
ok('a marker unit itself gets nothing (no Animal Behaviour)', R.pheromoneBonus(ph, m1, tgt), 0);

head('Endless Tide (p. 116)');
var et = world();
var lead = mk('bwatchers', 'A', 10, 10), swarm = mk('bsmall', 'A', 16, 10, { models: 3 });
et.units = [lead, swarm];
R.endlessTide(et);
ok('a thinned swarm near the Overmind grows back', swarm.models > 3 && swarm.models <= 6, true, swarm.models + '/8');
swarm.models = 7; for (var k = 0; k < 5; k++) R.endlessTide(et);
ok('never above its starting size', swarm.models, 8);
swarm.models = 3; lead.sp = 7;
R.endlessTide(et);
ok('a suppressed Overmind cannot call them', swarm.models, 3);
lead.sp = 0; swarm.models = 3; swarm.sp = 12;
R.endlessTide(et);
ok('a broken swarm does not regrow', swarm.models, 3);

head('Psychic Wave (p. 116)');
var pw = world();
var wv = mk('bovermind', 'A', 10, 10), near = mk('regular', 'B', 18, 10), away = mk('regular', 'B', 40, 10);
var drone = mk('recon', 'B', 14, 16); R.applyDrone(drone, true);
var hid = mk('regular', 'B', 10, 20);
pw.units = [wv, near, away, drone, hid];
var tot = 0, T = 400;
for (var i2 = 0; i2 < T; i2++) { near.sp = 0; R.psychicWave(pw, wv); tot += near.sp; }
ok('a unit 8" off takes D6-1 SP on average', Math.abs(tot / T - 2.5) < 0.3, true, (tot / T).toFixed(2));
away.sp = 0; drone.sp = 0; R.psychicWave(pw, wv);
ok('30" away is untouched', away.sp, 0);
ok('Drones are not affected', drone.sp, 0);
ok('no line of sight needed: it lists who it hit', R.psychicWave(pw, wv).hit.indexOf(hid) >= 0, true);

head('Flying Infantry (p. 116)');
var fl = world([{ kind: 'rocks', x: 20, y: 0, w: 4, h: 60 }]);
var wing = mk('bsmallwing', 'A', 16, 10), walker = mk('battack', 'A', 16, 30);
fl.units = [wing, walker];
var over = R.reachable(fl, wing, wing.move).some(function (c) { return c.x > 25; });
var blocked = R.reachable(fl, walker, walker.move).some(function (c) { return c.x > 25; });
ok('winged bugs fly over impassable rock', over, true);
ok('attack forms cannot', blocked, false);
ok('but they never land on it', R.reachable(fl, wing, wing.move).some(function (c) { return c.x > 20.5 && c.x < 23.5; }), false);
var inf = mk('regular', 'B', 20, 40);
ok('infantry cannot charge a flying bug', R.canAssault(inf, wing), false);
ok('a flying bug can charge infantry', R.canAssault(wing, inf), true);
var cop = mk('lightcraft', 'B', 30, 40);
ok('and can charge an aircraft', R.canAssault(wing, cop), true);
ok('it gets no cover from woods', R.coverFor(world([{ kind: 'woods', x: 10, y: 5, w: 12, h: 10 }]), inf,
  mk('bsmallwing', 'A', 16, 10)).v, 0);

head('Overgrown (p. 116)');
var queen = mk('bqueen', 'A', 10, 10), tank = mk('lcv', 'B', 14, 10), sq = mk('regular', 'B', 14, 14);
ok('the Queen is a machine', R.isMachine(queen), true);
ok('but may charge infantry', R.canAssault(queen, sq), true);
ok('and vehicles', R.canAssault(queen, tank), true);
var plainTank = mk('lcv', 'A', 10, 10);
ok('an ordinary tank still may not', R.canAssault(plainTank, sq), false);

head('The Carrier bug, Transport (4)');
var cw = world(), carrier = mk('bcarrier', 'A', 20, 20), pax = mk('battack', 'A', 22, 20), under = mk('bunderground', 'A', 21, 22);
cw.units.push(carrier, pax, under);
ok('attack forms can board it', R.canEmbark(cw, carrier, pax), true);
ok('and do', !!R.embark(cw, carrier, pax), true);
ok('they ride off the table', pax.x, -1);
ok('underground bugs board too', !!R.embark(cw, carrier, under), true);
carrier.x = 40; carrier.y = 30;
pax.boarded = under.boarded = false;          // a turn later: not off in the turn they got on
ok('the carrier drops them on landing', !!R.disembark(cw, carrier, pax, { x: 42, y: 30 }), true);
ok('within 4" of the carrier', R.unitDist ? R.unitDist(pax, carrier) <= 4.01 : true, true);
ok('not back aboard the same turn', R.canEmbark(cw, carrier, pax), false);
ok('the Queen does not fit', R.canEmbark(cw, carrier, mk('bqueen', 'A', 41, 30)), false);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
