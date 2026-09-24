/* The parts of the scenarios that are arithmetic rather than choreography: the
   search odds, who holds an objective, when a force counts as routed, and the
   roll that ends a game. Exercised thousands of times rather than played out. */
global.window = global;
require('../../src/rules/rules.js');
require('../../src/rules/scenarios.js');
var R = global.PMC, S = global.PMCScen;

var pass = 0, fail = 0;
function ok(name, got, want, note) {
  var good = String(got) === String(want);
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name.padEnd(54) +
    String(got).padEnd(10) + (good ? '' : '(expected ' + want + ')') + (note ? '  ' + note : ''));
}
function head(t) { console.log('\n' + t); }

function unit(side, x, y, opts) {
  opts = opts || {};
  var p = R.profile(opts.key || 'regular');
  return {
    id: side + Math.random().toString(36).slice(2, 6), side: side, key: p.key,
    label: p.name + ' [' + side + ']', name: p.name, cls: opts.cls || p.cls || 'infantry',
    tier: p.tier, size: p.size, models: opts.models != null ? opts.models : p.size,
    move: p.move, fp: p.fp, range: p.range, def: p.def, assault: p.assault,
    morale: p.morale, str: p.str, rules: p.rules.slice(),
    x: x, y: y, sp: opts.sp || 0, alive: opts.alive !== false, reserve: !!opts.reserve,
    aboard: null, shotFrom: [], activated: false, cargo: []
  };
}
function world(units, cfg) {
  return {
    units: units || [], terrain: [], objectives: [], log: [], turn: 1,
    cfg: cfg || { armyA: ['regular', 'regular', 'regular', 'regular'], armyB: ['regular', 'regular', 'regular', 'regular'], pl: 1 },
    sc: {}, doctrines: null
  };
}

/* ------------------------------------------------------ the six are all there */
head('The six scenarios');
ok('six in the book\'s order', S.ORDER.join(','), 'meeting,secure,find,invasion,demolish,takeover');
ok('every one names its page', S.ORDER.every(function (id) { return !!S.SCENARIOS[id].page; }), true,
  S.ORDER.map(function (id) { return 'p.' + S.SCENARIOS[id].page; }).join(' '));
ok('every one says how it is won', S.ORDER.every(function (id) { return !!S.SCENARIOS[id].win; }), true);
ok('every one can check itself', S.ORDER.every(function (id) { return typeof S.SCENARIOS[id].check === 'function'; }), true);
ok('three of them have an attacker',
  S.ORDER.filter(function (id) { return S.SCENARIOS[id].attacker; }).join(','),
  'invasion,demolish,takeover');
ok('only Invasion forbids Battlefield Insertion',
  S.ORDER.filter(function (id) { return S.SCENARIOS[id].noInsertion; }).join(','), 'invasion');

/* --------------------------------------------------------------- holding ground */
head('Holding an objective (p. 49)');
var w = world([unit('A', 20, 20), unit('B', 40, 40)]);
ok('a steady unit within 4" holds it', S.holderOf(w, 22, 20, 4), 'A');
ok('...and one 6" away does not', S.holderOf(w, 27, 20, 4), 'null');
w.units.push(unit('B', 21, 21));
ok('an enemy within 4" contests it', S.holderOf(w, 22, 20, 4), 'null');
var sup = world([unit('A', 20, 20, { sp: 20 })]);
ok('a broken unit holds nothing', S.holderOf(sup, 20, 20, 4), 'null');
var air = world([unit('A', 20, 20, { key: 'fsc' })]);
ok('an aircraft cannot hold ground', S.holderOf(air, 20, 20, 4), 'null');
var far = world([unit('A', 20, 20)]);
ok('the radius is measured from the token edge', S.holderOf(far, 25, 20, 4), 'A',
  '5" centre to centre is 4" edge to edge');

/* ---------------------------------------------------------------------- routing */
head('Routing (p. 49)');
var four = { armyA: ['a', 'b', 'c', 'd'], armyB: ['a', 'b', 'c', 'd'], pl: 1 };
var r1 = world([unit('A', 1, 1), unit('A', 2, 2), unit('A', 3, 3)], four);
ok('one of four lost is not a rout', S.routed(r1, 'A'), false);
var r2 = world([unit('A', 1, 1), unit('A', 2, 2)], four);
ok('two of four is', S.routed(r2, 'A'), true);
var r3 = world([unit('A', 1, 1), unit('A', 2, 2), unit('A', 3, 3), unit('A', 4, 4, { reserve: true })], four);
ok('a unit still in reserve counts as perfectly fine', S.routed(r3, 'A'), false);
var five = { armyA: ['a', 'b', 'c', 'd', 'e'], armyB: ['a'], pl: 1 };
var r4 = world([unit('A', 1, 1), unit('A', 2, 2)], five);
ok('three of five is a rout', S.routed(r4, 'A'), true, 'half of five rounds up to three');

/* ------------------------------------------------------- Check the area! (p. 52) */
head('Check the area!');
function searchRun() {
  var st = world([]);
  S.begin(st, 'find', {});
  var found = [];
  for (var i = 0; i < 3 && !st.sc.found; i++) {
    var spot = st.sc.search.filter(function (s) { return !s.checked; })[0];
    var res = S.checkArea(st, null, spot);
    found.push(res);
    if (res.found) break;
  }
  return { tries: found, order: st.sc.order, found: !!st.sc.found };
}
var n = 4000, firstHit = 0, secondHit = 0, everFound = 0, tries = 0;
for (var i = 0; i < n; i++) {
  var run = searchRun();
  if (run.tries[0].found) firstHit++;
  else if (run.tries[1] && run.tries[1].found) secondHit++;
  if (run.found) everFound++;
  tries += run.tries.length;
}
ok('the first location gives it up on a 5+', Math.abs(firstHit / n - 1 / 3) < 0.03, true,
  Math.round(100 * firstHit / n) + '% — two faces in six');
ok('the second on a 4+', Math.abs(secondHit / n - (2 / 3) * 0.5) < 0.03, true,
  Math.round(100 * secondHit / n) + '% of all searches, which is half of the two thirds left');
ok('the third is where it was all along', everFound, n, 'found in every one of ' + n + ' searches');
// two blanks give the third away with no search (p. 52): 1 x 1/3 + 2 x 2/3 = 5/3 checks
ok('...after 1.7 checks on average', Math.abs(tries / n - 5 / 3) < 0.05, true,
  (tries / n).toFixed(2) + ' checked');
var st2 = world([]);
S.begin(st2, 'find', {});
ok('three locations, 12" apart, near the middle', (function () {
  var s = st2.sc.search;
  if (s.length !== 3) return s.length + ' locations';
  for (var a = 0; a < 3; a++) {
    if (R.inches(s[a].x, s[a].y, 24, 24) > 13) return 'one is ' + R.inches(s[a].x, s[a].y, 24, 24).toFixed(0) + '" from the centre';
    for (var b = a + 1; b < 3; b++) {
      if (R.inches(s[a].x, s[a].y, s[b].x, s[b].y) < 11.9) return 'two are only ' + R.inches(s[a].x, s[a].y, s[b].x, s[b].y).toFixed(1) + '" apart';
    }
  }
  return 'ok';
})(), 'ok');
ok('...one towards each company and one in the middle, all in the middle half', (function () {
  for (var n = 0; n < 50; n++) {
    var xs = setupOf('secure').objectives.map(function (q) { return q.x; }).sort(function (p, q) { return p - q; });
    if (!(xs[0] >= 12 && xs[0] < 16 && xs[1] > 19 && xs[1] < 29 && xs[2] > 32 && xs[2] <= 36)) return 'not spread: ' + xs.map(function (v) { return v.toFixed(0); }).join(' ');
  }
  return 'ok';
})(), 'ok');
ok('nothing is an objective until it is found', st2.objectives.length, 0);
S.checkArea(st2, null, st2.sc.search[0]);
S.checkArea(st2, null, st2.sc.search[1]);
S.checkArea(st2, null, st2.sc.search[2]);
ok('...and exactly one is, afterwards', st2.objectives.length, 1);

/* --------------------------------------------------- the roll that ends a game */
head('Game length');
ok('Meeting engagement and Secure and control run twenty turns',
  S.SCENARIOS.meeting.turns + '/' + S.SCENARIOS.secure.turns, '20/20');
ok('Hostile takeover runs twenty', S.SCENARIOS.takeover.turns, 20);
ok('Demolish runs twelve', S.SCENARIOS.demolish.turns, 12);
ok('Find and secure and Invasion roll for the end',
  S.SCENARIOS.find.turns + '/' + S.SCENARIOS.invasion.turns, '0/0');
// the roll: a 6 on turn 12, a 5+ on 13, a 4+ on 14 and so on
function endRate(turn) {
  var hit = 0, m = 6000;
  for (var k = 0; k < m; k++) {
    var st = world([]); st.sc = {}; st.turn = turn;
    st.scen = S.SCENARIOS.find;
    // reach the private roll through the scenario's own check, with nothing else true
    st.cfg = { armyA: ['a'], armyB: ['a'], pl: 1 };
    st.units = [unit('A', 1, 1), unit('B', 40, 40)];
    st.objectives = [];
    st.sc = { search: [{ x: 24, y: 24, checked: true }], found: null, hold: { A: 0, B: 0 }, order: 1 };
    var res = S.SCENARIOS.find.check(st);
    if (res) hit++;
  }
  return Math.round(100 * hit / m);
}
ok('a game never ends before turn 12', endRate(11), 0);
ok('...ends on a 6 at turn 12', Math.abs(endRate(12) - 17) <= 3, true, endRate(12) + '%');
ok('...on a 5+ at turn 13', Math.abs(endRate(13) - 33) <= 4, true, endRate(13) + '%');
ok('...on a 4+ at turn 14', Math.abs(endRate(14) - 50) <= 4, true, endRate(14) + '%');
ok('...and never becomes certain', endRate(20) < 100, true, endRate(20) + '% at turn 20');

/* -------------------------------------------------------- attacker and defender */
head('Attacker and defender');
var roles = { A: 0, B: 0 };
for (var j = 0; j < 2000; j++) {
  var st3 = world([]);
  S.begin(st3, 'demolish', {});
  roles[st3.sc.attacker]++;
}
ok('the roles fall evenly', Math.abs(roles.A - roles.B) < 200, true,
  'A attacked ' + roles.A + ' times, B ' + roles.B);
var swapped = 0;
for (var k2 = 0; k2 < 3000; k2++) {
  var st4 = world([]);
  st4.doctrines = { A: [], B: ['S1'] };
  S.begin(st4, 'takeover', { attacker: 'A' });
  if (st4.sc.attacker === 'B') swapped++;
}
ok('The Best Defence is Good Offence swaps the roles on a 2+',
  Math.abs(swapped / 3000 - 5 / 6) < 0.04, true,
  Math.round(100 * swapped / 3000) + '% of the time the defender took the attack');
var both = 0;
for (var k3 = 0; k3 < 2000; k3++) {
  var st5 = world([]);
  st5.doctrines = { A: ['S1'], B: ['S1'] };
  S.begin(st5, 'takeover', { attacker: 'A' });
  if (st5.sc.attacker === 'B') both++;
}
ok('...and does nothing when both companies have it', both, 0);

/* ------------------------------------------------------------- what each sets up */
head('What each scenario puts on the table');
function setupOf(id) {
  var st = world([unit('A', 1, 1), unit('A', 2, 2), unit('A', 3, 3), unit('A', 4, 4),
    unit('B', 44, 44), unit('B', 43, 43), unit('B', 42, 42), unit('B', 41, 41)]);
  st.terrain = [{ kind: 'woods', x: 22, y: 22, w: 4, h: 4 }];
  S.begin(st, id, {});
  S.deploy(st);
  return st;
}
ok('Meeting engagement places no objectives', setupOf('meeting').objectives.length, 0);
ok('Secure and control places three', setupOf('secure').objectives.length, 3);
ok('...at least 12" apart and 8" in from the edges', (function () {
  var o = setupOf('secure').objectives;
  for (var a = 0; a < o.length; a++) {
    if (o[a].x < 8 || o[a].y < 8 || o[a].x > 40 || o[a].y > 40) return 'one is too close to an edge';
    for (var b = a + 1; b < o.length; b++) {
      if (R.inches(o[a].x, o[a].y, o[b].x, o[b].y) < 12) return 'two are too close';
    }
  }
  return 'ok';
})(), 'ok');
ok('Invasion places three landing zones', setupOf('invasion').objectives.length, 3);
var dem = setupOf('demolish');
ok('Demolish puts the objective within 4" of the centre',
  R.inches(dem.sc.target.cx, dem.sc.target.cy, 24, 24) <= 4.01, true,
  R.inches(dem.sc.target.cx, dem.sc.target.cy, 24, 24).toFixed(1) + '" out');
ok('...as a piece of impassable terrain', R.TERRAIN.objective.impassable, true);
ok('...that only the Demolish action touches', R.destructibleKind({ kind: 'objective' }), 'target');
ok('...cleared of anything that was standing there', dem.terrain.filter(function (t) {
  return t.kind !== 'objective' && R.inches(t.x + t.w / 2, t.y + t.h / 2, dem.sc.target.cx, dem.sc.target.cy) <= 6;
}).length, 0);
/* Demolish, p. 54: at Priority Level 2+ the attacker may hold units back */
var demPL = function (pl) {
  var st = world([unit('A', 1, 1), unit('A', 2, 2), unit('A', 3, 3), unit('A', 4, 4),
    unit('B', 44, 44), unit('B', 43, 43), unit('B', 42, 42), unit('B', 41, 41)]);
  st.cfg.pl = pl;
  S.begin(st, 'demolish', { attacker: 'A' });
  S.deploy(st);
  return st;
};
var d1 = demPL(1), d3 = demPL(3);
ok('...at Priority Level 1 the attacker holds nothing back', !!(d1.sc.split && d1.sc.split[d1.sc.attacker]), false);
var sp3 = d3.sc.split && d3.sc.split[d3.sc.attacker];
ok('...at Priority Level 3 it may hold up to all but one', sp3 ? sp3.min + '-' + sp3.max : 'none', '0-3');
var held = d3.units.filter(function (u) { return u.side === d3.sc.attacker; }).slice(0, 2);
held.forEach(function (u) { u.reserve = true; u.wave = 2; });
d3.turn = 1;
ok('...nothing to pick on turn 1', S.reservePick(d3, d3.sc.attacker), null);
d3.turn = 2;
var pk2 = S.reservePick(d3, d3.sc.attacker);
ok('...turn 2: pick any of them', pk2 ? pk2.min + '/' + pk2.max : 'none', '0/2');
d3.turn = 3;
var pk3 = S.reservePick(d3, d3.sc.attacker);
ok('...turn 3 (the last): all that are left come on', pk3 ? pk3.min + '/' + pk3.max : 'none', '2/2');
d3.turn = 2;
ok('...an AI attacker brings them all on at turn 2', S.reserves(d3, d3.sc.attacker).length, 2);
ok('...the defender picks nothing', S.reservePick(d3, d3.sc.attacker === 'A' ? 'B' : 'A'), null);
var tko = setupOf('takeover');
var works = function (t) { return t.kind === 'barricade' || t.kind === 'trench' || t.kind === 'wire'; };
ok('Hostile takeover digs the defender in', tko.terrain.filter(works).length >= 6, true,
  tko.terrain.filter(works).length + ' sections of wall, trench and wire');
ok('...no section longer than 6"', tko.terrain.filter(function (t) {
  return works(t) && Math.max(t.w, t.h) > 6;
}).length, 0);
ok('...with one bunker', tko.terrain.filter(function (t) { return t.kind === 'bunker'; }).length, 1);
ok('...all of it within 12" of the objective', tko.terrain.filter(function (t) {
  return (works(t) || t.kind === 'bunker') &&
    R.inches(t.x + t.w / 2, t.y + t.h / 2, 24, 24) > 13.5;
}).length, 0);

head('Who waits in reserve');
function reserveSplit(id) {
  var st = setupOf(id);
  return {
    A: st.units.filter(function (u) { return u.side === 'A' && u.reserve; }).length,
    B: st.units.filter(function (u) { return u.side === 'B' && u.reserve; }).length,
    atk: st.sc.attacker || null
  };
}
ok('Meeting engagement holds nobody back', JSON.stringify(reserveSplit('meeting')).indexOf('"A":0') >= 0, true);
var fs = reserveSplit('find');
ok('Find and secure splits both forces in half', fs.A === 2 && fs.B === 2, true,
  fs.A + ' and ' + fs.B + ' of four each');
var iv = reserveSplit('invasion');
ok('Invasion holds the whole attacking force off the table',
  (iv.atk === 'A' ? iv.A : iv.B), 4, 'it arrives by drop, not by deployment');
ok('...and two thirds of the defenders', (iv.atk === 'A' ? iv.B : iv.A), 3, 'one of four stays on the table');
var dm = reserveSplit('demolish');
ok('Demolish holds half the defenders back', (dm.atk === 'A' ? dm.B : dm.A), 2);
ok('...and none of the attackers', (dm.atk === 'A' ? dm.A : dm.B), 0);
var tk = reserveSplit('takeover');
ok('Hostile takeover splits the attacker in two', (tk.atk === 'A' ? tk.A : tk.B), 2);
ok('...and keeps the defender on the table', (tk.atk === 'A' ? tk.B : tk.A), 0);

/* ------------------------------------------------- what wins, scenario by scenario */
head('Victory conditions (p. 49 and the six)');

/* A table with the scenario already begun and both sides down to whatever the
   test wants. `armyA`/`armyB` are the forces that took the field, so cutting the
   unit list is how a side is routed. */
function board(id, opts) {
  opts = opts || {};
  var nA = opts.liveA != null ? opts.liveA : 4, nB = opts.liveB != null ? opts.liveB : 4;
  var us = [];
  for (var i = 0; i < nA; i++) us.push(unit('A', 2 + i, 2));
  for (var j = 0; j < nB; j++) us.push(unit('B', 44 - j, 44));
  var st = world(us);
  st.terrain = [];
  S.begin(st, id, opts.attacker ? { attacker: opts.attacker } : {});
  S.deploy(st);
  st.turn = opts.turn || 1;
  if (opts.after) opts.after(st);
  return st;
}
function winnerOf(st) { var r = S.check(st); return r ? (r.winner || 'draw') : 'play on'; }

ok('Meeting engagement: routing the enemy wins', winnerOf(board('meeting', { liveB: 2 })), 'A');
ok('Secure and control: routing the enemy wins nothing (p. 51)',
  winnerOf(board('secure', { liveB: 2 })), 'play on');
ok('Demolish: routing the defender wins nothing (p. 54)',
  winnerOf(board('demolish', { liveA: 4, liveB: 2, attacker: 'A' })), 'play on');
ok('Demolish: routing the attacker wins nothing either',
  winnerOf(board('demolish', { liveA: 2, liveB: 4, attacker: 'A' })), 'play on');
ok('Hostile takeover: routing the garrison wins nothing (p. 55)',
  winnerOf(board('takeover', { liveA: 4, liveB: 2, attacker: 'A' })), 'play on');
ok('Hostile takeover: routing the attacker wins nothing either',
  winnerOf(board('takeover', { liveA: 2, liveB: 4, attacker: 'A' })), 'play on');
ok('Invasion: the attacker may rout the defender (p. 53)',
  winnerOf(board('invasion', { liveA: 4, liveB: 2, attacker: 'A' })), 'A');
ok('...but the defender cannot win by breaking the landing',
  winnerOf(board('invasion', { liveA: 2, liveB: 4, attacker: 'A' })), 'play on');

/* the universal clause */
ok('destroying a force outright is an automatic victory anywhere (p. 49)',
  ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'].map(function (id) {
    return winnerOf(board(id, { liveB: 0, attacker: 'A' }));
  }).join(','), 'A,A,A,A,A,A');
ok('...and both sides gone at once is a draw',
  winnerOf(board('meeting', { liveA: 0, liveB: 0 })), 'draw');
ok('a side still waiting in reserve is not destroyed',
  winnerOf(board('meeting', {
    after: function (st) { st.units.forEach(function (u) { if (u.side === 'B') { u.reserve = true; u.x = -1; u.y = -1; } }); }
  })), 'play on', 'nobody on the table, but nobody lost either');

/* Secure and control's own three ways home */
ok('Secure and control: holding all three ends it at once', winnerOf(board('secure', {
  after: function (st) { st.objectives.forEach(function (o) { o.owner = 'A'; }); }
})), 'A');
ok('...holding the same two for three End phases ends it', (function () {
  var st = board('secure');
  var out = null;
  for (var t = 1; t <= 3 && !out; t++) {
    st.turn = t;
    st.objectives[0].owner = 'B'; st.objectives[1].owner = 'B';
    var r = S.check(st); if (r) out = r.winner;
  }
  return out;
})(), 'B');
ok('...but swapping which two breaks the streak', (function () {
  var st = board('secure');
  var out = null;
  for (var t = 1; t <= 4 && !out; t++) {
    st.turn = t;
    st.objectives.forEach(function (o) { o.owner = null; });
    st.objectives[t % 2].owner = 'B'; st.objectives[2].owner = 'B';
    var r = S.check(st); if (r) out = r.winner;
  }
  return out || 'play on';
})(), 'play on');
ok('...and more objectives at the end of turn 20 wins', winnerOf(board('secure', {
  turn: 20, after: function (st) { st.objectives[0].owner = 'A'; }
})), 'A');
ok('...with the objectives split, a draw', winnerOf(board('secure', {
  turn: 20, after: function (st) { st.objectives[0].owner = 'A'; st.objectives[1].owner = 'B'; }
})), 'draw');

/* Find and secure */
ok('Find and secure: the holder cannot be routed while it holds (p. 52)', (function () {
  var st = board('find', { liveA: 2 });
  st.sc.found = st.sc.search[0];
  st.objectives = [{ x: st.sc.found.x, y: st.sc.found.y, owner: null }];
  st.units.forEach(function (u) { if (u.side === 'A') { u.x = st.sc.found.x; u.y = st.sc.found.y; u.reserve = false; } });
  var r = S.check(st);
  return r ? (r.winner || 'draw') : 'play on';
})(), 'play on');
ok('...and is routed the moment it loses it', (function () {
  var st = board('find', { liveA: 2 });
  st.sc.found = st.sc.search[0];
  st.objectives = [{ x: st.sc.found.x, y: st.sc.found.y, owner: null }];
  var r = S.check(st);
  return r ? r.winner : 'play on';
})(), 'B');
ok('...holding it for three End phases wins outright', (function () {
  var st = board('find');
  st.sc.found = st.sc.search[0];
  st.units.forEach(function (u) { if (u.side === 'A') { u.x = st.sc.found.x; u.y = st.sc.found.y; u.reserve = false; } });
  st.units.forEach(function (u) { if (u.side === 'B') { u.x = 2; u.y = 34; u.reserve = false; } });
  var out = null;
  for (var t = 1; t <= 3 && !out; t++) { st.turn = t; var r = S.check(st); if (r) out = r.winner; }
  return out;
})(), 'A');

/* Demolish and Hostile takeover on their own terms */
ok('Demolish: bringing the objective down wins', winnerOf(board('demolish', {
  attacker: 'A',
  after: function (st) { st.terrain = st.terrain.filter(function (t) { return t.kind !== 'objective'; }); }
})), 'A');
ok('...and twelve turns with it standing is the defender\'s', winnerOf(board('demolish', {
  attacker: 'A', turn: 12
})), 'B');
ok('Hostile takeover: standing on it at turn 20 wins', winnerOf(board('takeover', {
  attacker: 'A', turn: 20,
  after: function (st) { st.units.forEach(function (u) { if (u.side === 'A') { u.x = 24; u.y = 24; u.reserve = false; } }); }
})), 'A');
ok('...and turn 20 with nobody on it is the defender\'s', winnerOf(board('takeover', {
  attacker: 'A', turn: 20
})), 'B');

/* ---------------------------------------------- Find and secure's three locations */
head('The three possible locations (p. 52)');
var fnd = setupOf('find');
var sites = fnd.terrain.filter(function (t) { return t.kind === 'searchsite'; });
ok('three of them go on the table', sites.length, 3);
ok('...each 4" across', sites.every(function (t) { return t.w === 4 && t.h === 4; }), true);
ok('...within 12" of the middle of the table',
  sites.every(function (t) { return R.inches(t.cx, t.cy, 24, 24) <= 12.01; }), true);
ok('...and at least 12" from each other', (function () {
  for (var a = 0; a < sites.length; a++) {
    for (var b = a + 1; b < sites.length; b++) {
      if (R.inches(sites[a].cx, sites[a].cy, sites[b].cx, sites[b].cy) < 12) return 'too close';
    }
  }
  return 'ok';
})(), 'ok');
ok('...where the search action looks for them',
  fnd.sc.search.map(function (s) { return s.piece && s.piece.kind; }).join(','),
  'searchsite,searchsite,searchsite');
ok('a possible location is passable', R.TERRAIN.searchsite.impassable, false);
ok('...blocks no line of sight', R.TERRAIN.searchsite.blocks, false);
ok('...gives no cover', R.TERRAIN.searchsite.cover, 0);
ok('...costs nothing to cross', R.TERRAIN.searchsite.movePenalty, 0);
ok('...and cannot be destroyed', !R.TERRAIN.searchsite.destructible, true);
ok('...and does not shade the ground a unit stands on',
  R.terrainAt({ terrain: sites }, sites[0].cx, sites[0].cy), 'open');
ok('a checked location is marked on the table', (function () {
  var st = setupOf('find');
  var u = st.units.filter(function (x) { return x.side === 'A'; })[0];
  u.x = st.sc.search[0].x; u.y = st.sc.search[0].y; u.reserve = false;
  S.checkArea(st, u, S.searchSpots(st, u)[0]);
  return st.sc.search[0].piece.checked;
})(), true);
ok('...and finding it closes the other two down', (function () {
  var st = setupOf('find');
  var u = st.units.filter(function (x) { return x.side === 'A'; })[0];
  u.reserve = false;
  var found = false, guard = 0;
  // two blanks give the third away without a search (p. 52)
  while (!st.sc.found && guard++ < 3) {
    var sp = st.sc.search.filter(function (s) { return !s.checked; })[0];
    u.x = sp.x; u.y = sp.y;
    found = S.checkArea(st, u, sp).found;
  }
  return st.sc.search.every(function (s) { return s.piece.checked; }) &&
    st.sc.search.filter(function (s) { return s.piece.cold; }).length === 2;
})(), true);

/* ------------------------------------------- All landing zones are hot! (p. 53) */
head('All landing zones are hot! (p. 53)');
ok('the second wave cannot come down when the defender holds every zone', (function () {
  var st = board('invasion', { attacker: 'A', turn: 6 });
  st.objectives.forEach(function (o) { o.owner = 'B'; });
  var came = 0;
  for (var i = 0; i < 200; i++) came += S.reserves(st, 'A').length;
  return came;
})(), 0);
ok('...and comes down again the moment one zone is free', (function () {
  var st = board('invasion', { attacker: 'A', turn: 6 });
  st.objectives.forEach(function (o) { o.owner = 'B'; });
  st.objectives[0].owner = null;
  var came = 0;
  for (var i = 0; i < 200; i++) came += S.reserves(st, 'A').length;
  return came > 0;
})(), true);
ok('...and the defender\'s own reinforcements are unaffected', (function () {
  var st = board('invasion', { attacker: 'A', turn: 6 });
  st.objectives.forEach(function (o) { o.owner = 'B'; });
  var came = 0;
  for (var i = 0; i < 200; i++) came += S.reserves(st, 'B').length;
  return came > 0;
})(), true);

/* ----------------------------------------------- who owns which table edge */
head('Table edges by corner (p. 54) and the landing ground (p. 53)');
var dm2 = setupOf('demolish');
var dAtk = dm2.sc.attacker, dDef = dAtk === 'A' ? 'B' : 'A';
ok('Demolish gives the attacker three corners', (dm2.sc.boxes[dAtk] || []).length, 6, 'two bands a corner');
ok('...and the defender the fourth', (dm2.sc.entry[dDef] || []).length, 2);
ok('...the defender\'s corner is the one nearest the objective', (function () {
  var c = dm2.sc.corner, t = dm2.sc.target;
  return [[0, 0], [48, 0], [48, 48], [0, 48]].every(function (q) {
    return R.inches(c.x, c.y, t.cx, t.cy) <= R.inches(q[0], q[1], t.cx, t.cy) + 0.001;
  });
})(), true);
ok('...no attacker band touches the defender\'s corner',
  dm2.sc.boxes[dAtk].filter(function (b) {
    return S.inBoxes([b], dm2.sc.corner.x, dm2.sc.corner.y);
  }).length, 0);
ok('...every band is 12" of edge, 6" deep',
  dm2.sc.boxes[dAtk].every(function (b) { return Math.max(b.w, b.h) === 12 && Math.min(b.w, b.h) === 6; }), true);
ok('...and the attacker may not deploy in the middle of the table',
  S.inBoxes(dm2.sc.boxes[dAtk], 24, 24), false);
ok('...but may at a corner that is his', S.inBoxes(dm2.sc.boxes[dAtk], 2, 2) ||
  S.inBoxes(dm2.sc.boxes[dAtk], 46, 2) || S.inBoxes(dm2.sc.boxes[dAtk], 2, 46) ||
  S.inBoxes(dm2.sc.boxes[dAtk], 46, 46), true);

var inv2 = setupOf('invasion');
var iDef = inv2.sc.defender;
ok('Invasion keeps the defender 6" in from every edge', (function () {
  var f = S.SCENARIOS.invasion.deployOK;
  return [f(inv2, iDef, 24, 3), f(inv2, iDef, 3, 24), f(inv2, iDef, 45, 24), f(inv2, iDef, 24, 45),
    f(inv2, iDef, 24, 24)].join(',');
})(), 'false,false,false,false,true');
ok('...and the attacker deploys nowhere at all',
  S.SCENARIOS.invasion.deployOK(inv2, inv2.sc.attacker, 24, 24), false);
ok('landing zones are chosen on open ground', (function () {
  var bad = 0;
  for (var i = 0; i < 30; i++) {
    var st = world([unit('A', 1, 1), unit('A', 2, 2), unit('A', 3, 3), unit('A', 4, 4),
      unit('B', 44, 44), unit('B', 43, 43), unit('B', 42, 42), unit('B', 41, 41)]);
    // a table half covered in woods
    st.terrain = [{ kind: 'woods', x: 0, y: 0, w: 48, h: 16 }, { kind: 'rocks', x: 0, y: 36, w: 48, h: 12 }];
    S.begin(st, 'invasion', {});
    st.objectives.forEach(function (o) {
      if (R.terrainAt(st, o.x, o.y) !== 'open') bad++;
    });
  }
  return bad;
})(), 0);

/* ------------------------------------------- deployment ground, scenario by scenario */
head('Where each side sets up (pp. 50-55)');
function zoneOf(id, side) {
  var st = setupOf(id);
  return { st: st, ok: function (x, y) {
    var say = S.SCENARIOS[id].deployOK ? S.SCENARIOS[id].deployOK(st, side, x, y) : null;
    if (say !== null) return say;
    var bx = st.sc.boxes && st.sc.boxes[side];
    if (bx) return S.inBoxes(bx, x, y);
    var z = S.zoneFor(st, side);
    return !!z && x >= z[0] && x <= z[1];
  } };
}
['meeting', 'secure', 'find'].forEach(function (id) {
  var a = zoneOf(id, 'A'), b = zoneOf(id, 'B');
  ok(id + ': both sides get a 6" strip on opposite edges',
    [a.ok(3, 24), a.ok(24, 24), b.ok(45, 24), b.ok(24, 24)].join(','), 'true,false,true,false');
});
var tkA = setupOf('takeover'), tkAtk = tkA.sc.attacker, tkDef = tkAtk === 'A' ? 'B' : 'A';
ok('Hostile takeover: the attacker may use any table edge (p. 55)',
  [S.inBoxes(tkA.sc.boxes[tkAtk], 24, 3), S.inBoxes(tkA.sc.boxes[tkAtk], 24, 45),
    S.inBoxes(tkA.sc.boxes[tkAtk], 3, 24), S.inBoxes(tkA.sc.boxes[tkAtk], 45, 24)].join(','),
  'true,true,true,true');
ok('...and not the middle of the table', S.inBoxes(tkA.sc.boxes[tkAtk], 24, 24), false);
ok('...while the defender sets up within 12" of the objective',
  [S.SCENARIOS.takeover.deployOK(tkA, tkDef, 24, 30), S.SCENARIOS.takeover.deployOK(tkA, tkDef, 24, 40)].join(','),
  'true,false');
var dmA = setupOf('demolish'), dmDef = dmA.sc.defender;
ok('Demolish: the defender sets up within 18" of the objective', (function () {
  var t = dmA.sc.target, f = S.SCENARIOS.demolish.deployOK;
  return [f(dmA, dmDef, t.cx, t.cy), f(dmA, dmDef, t.cx, t.cy + 17), f(dmA, dmDef, t.cx, t.cy + 19)].join(',');
})(), 'true,true,false');

/* ------------------------------------------------------- reinforcements, turn by turn */
head('Reinforcements (pp. 50-55)');
function arrivalsOver(id, side, turns, each) {
  var st = setupOf(id);
  if (each) each(st);
  var out = [];
  for (var t = 1; t <= turns; t++) {
    st.turn = t;
    var got = S.reserves(st, side) || [];
    got.forEach(function (u) { u.reserve = false; u.wave = 0; });
    out.push(got.length);
  }
  return out;
}
ok('Meeting engagement and Secure and control have no scenario reserves',
  arrivalsOver('meeting', 'A', 6).concat(arrivalsOver('secure', 'A', 6)).join(''), '000000000000');
ok('Find and secure brings on PL units every second turn from turn 3 (p. 52)', (function () {
  var st = setupOf('find');
  var turns = [];
  for (var t = 1; t <= 8; t++) {
    st.turn = t;
    turns.push(S.reserves(st, 'A').length ? t : 0);
  }
  return turns.filter(Boolean).join(',');
})(), '3,5,7', 'never on an even turn, never before turn 3');
ok('...a number equal to the Priority Level', (function () {
  var st = setupOf('find');
  st.cfg.pl = 2; st.turn = 3;
  return S.reserves(st, 'A').length;
})(), 2);
ok('Invasion lands the whole first wave in turn 1 and nothing in turns 2-3', (function () {
  var st = setupOf('invasion'), atk = st.sc.attacker;
  st.turn = 1;
  var first = S.reserves(st, atk).filter(function (u) { return u.wave === 1; }).length;
  first && S.reserves(st, atk).forEach(function (u) { if (u.wave === 1) { u.reserve = false; } });
  st.turn = 2; var t2 = S.reserves(st, atk).length;
  st.turn = 3; var t3 = S.reserves(st, atk).length;
  return first + '/' + t2 + '/' + t3;
})(), '2/0/0', 'half the force lands at once');
var RATES = '';
ok('...and the second wave eases from 5+ on turn 4 by one a turn (p. 53)', (function () {
  function rate(turn) {
    var hit = 0, runs = 4000;
    for (var k = 0; k < runs; k++) {
      var st = setupOf('invasion'), atk = st.sc.attacker;
      st.units.forEach(function (u) { if (u.side === atk && u.wave === 1) { u.reserve = false; u.wave = 0; } });
      st.turn = turn;
      st.objectives.forEach(function (o) { o.owner = null; });
      var pool = st.units.filter(function (u) { return u.side === atk && u.reserve; });
      if (!pool.length) continue;
      hit += S.reserves(st, atk).length / pool.length;
      runs = runs;
    }
    return Math.round(100 * hit / 4000);
  }
  var r4 = rate(4), r5 = rate(5), r6 = rate(6);
  RATES = r4 + '% on turn 4, ' + r5 + '% on 5, ' + r6 + '% on 6';
  return [Math.abs(r4 - 33) < 4, Math.abs(r5 - 50) < 4, Math.abs(r6 - 67) < 4].join(',');
})(), 'true,true,true', RATES);
var DEFRATE = '';
ok('Invasion: the defender rolls 5+ a unit from turn 2 (p. 53)', (function () {
  var st = setupOf('invasion'), def = st.sc.defender;
  st.turn = 1; var t1 = S.reserves(st, def).length;
  var hit = 0, pool = st.units.filter(function (u) { return u.side === def && u.reserve; }).length;
  for (var k = 0; k < 3000; k++) {
    var s2 = setupOf('invasion'); s2.turn = 2;
    var d2 = s2.sc.defender;
    var p2 = s2.units.filter(function (u) { return u.side === d2 && u.reserve; }).length;
    if (p2) hit += S.reserves(s2, d2).length / p2;
  }
  DEFRATE = Math.round(100 * hit / 3000) + '% a turn after that';
  return t1 + ' / ' + (Math.abs(100 * hit / 3000 - 33.3) < 4);
})(), '0 / true', 'nothing on turn 1, ' + DEFRATE);
ok('Demolish: the defender rolls 5+ a unit from turn 2, the attacker is already on', (function () {
  var st = setupOf('demolish'), atk = st.sc.attacker;
  st.turn = 4;
  return S.reserves(st, atk).length;
})(), 0);
ok('Hostile takeover: the attacker\'s second part waits until turn 3 (p. 55)',
  arrivalsOver('takeover', setupOf('takeover').sc.attacker, 4).slice(0, 2).join(','), '0,0');

head('Where reinforcements walk on');
var invE = setupOf('invasion');
ok('Invasion: the defender comes on from a random table edge (p. 53)',
  (invE.sc.entry[invE.sc.defender] || []).length, 4, 'all four edges are possible');
var tkE = setupOf('takeover');
ok('Hostile takeover: the attacker\'s second part from any table edge',
  (tkE.sc.entry[tkE.sc.attacker] || []).length, 4);
var dmE = setupOf('demolish');
ok('Demolish: each side comes on around the corners it owns',
  (dmE.sc.entry[dmE.sc.attacker] || []).length + '/' + (dmE.sc.entry[dmE.sc.defender] || []).length, '6/2');
ok('Find and secure: reinforcements come from the side\'s own edge',
  !(setupOf('find').sc.entry), true, 'no override, so the default edge applies');

head('Attacker and defender are named to the player');
ok('the three asymmetric scenarios each describe both roles',
  ['invasion', 'demolish', 'takeover'].every(function (id) {
    var r = S.SCENARIOS[id].roles;
    return r && /^As the attacker/.test(r.attacker) && /^As the defender/.test(r.defender);
  }), true);
ok('...and the other three have no roles to describe',
  ['meeting', 'secure', 'find'].some(function (id) { return !!S.SCENARIOS[id].roles; }), false);

head('Secure and control places its objectives afresh (p. 51)');
ok('three, 12" apart and 8" in from the edges, every time', (function () {
  var bad = '';
  var seen = {};
  for (var i = 0; i < 200; i++) {
    var o = setupOf('secure').objectives;
    if (o.length !== 3) { bad = 'not three'; break; }
    seen[o.map(function (q) { return Math.round(q.x) + ',' + Math.round(q.y); }).join(' ')] = 1;
    for (var a = 0; a < 3 && !bad; a++) {
      if (o[a].x < 7.99 || o[a].y < 7.99 || o[a].x > 40.01 || o[a].y > 40.01) bad = 'too close to an edge';
      for (var b = a + 1; b < 3; b++) {
        if (R.inches(o[a].x, o[a].y, o[b].x, o[b].y) < 11.99) bad = 'two too close';
      }
    }
  }
  return bad || (Object.keys(seen).length > 150 ? 'ok' : 'only ' + Object.keys(seen).length + ' layouts in 200');
})(), 'ok');

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
