/* The optional vehicle propulsions (Appendix 3, pp. 166-167), checked against
   what the book says each one trades away. */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

function mk(key, prop, side, x, y, facing) {
  var p = R.profile(key);
  return R.applyPropulsion({
    id: side + key + prop, side: side, code: p.code, name: p.name,
    label: p.name + ' [' + side + ']', cls: p.cls, art: p.art, tier: p.tier,
    size: p.size, models: p.size, move: p.move, turn: p.turn, fp: p.fp,
    range: p.range, def: p.def, defPierced: p.defPierced, assault: p.assault,
    morale: p.morale, str: p.str, transport: p.transport, cargo: [], damage: 0,
    facing: facing === undefined ? 0 : facing, aboard: null,
    rules: p.rules.slice(), x: x, y: y, sp: 0, alive: true, activated: false,
    marked: false, shotFrom: [], coordUsed: false
  }, prop);
}
function world(terrain) { return { units: [], terrain: terrain || [], objectives: [], log: [] }; }

var base = R.profile('lcv');
console.log('--- Light combat vehicle, Move ' + base.move + ' turn ' + base.turn +
  '" Def ' + base.def + ' Str ' + base.str + ' ---');
var WANT = {
  none: [10, 1, 13, 6],                     // no optional propulsion: the printed profile
  wheeled: [10, 1, 13, 6], tracked: [7.5, 0, 13, 6], grav: [12.5, 1, 13, 5],
  hover: [10, 2, 13, 6], walker: [10, 1, 12, 6]
};
var bad = 0;
R.PROP_ORDER.forEach(function (pr) {
  var u = mk('lcv', pr, 'A', 20, 20), w = WANT[pr];
  var got = [u.move, u.turn, u.def, u.str];
  var ok = got.every(function (v, i) { return v === w[i]; });
  if (!ok) bad++;
  console.log(' ', pr.padEnd(8), 'Move ' + u.move, 'turn ' + u.turn + '"',
    'Def ' + u.def, 'Str ' + u.str, ok ? '' : '<-- EXPECTED ' + w.join(' '));
});

/* terrain: a walker takes the infantry penalty and keeps its cover; a hovercraft
   skims water */
console.log('--- terrain ---');
var woods = world([{ kind: 'woods', x: 16, y: 16, w: 8, h: 8 }]);
var gunner = mk('regular', null, 'A', 30, 20);
R.PROP_ORDER.forEach(function (pr) {
  var v = mk('lcv', pr, 'B', 20, 20);
  woods.units = [gunner, v];
  console.log(' ', pr.padEnd(8),
    'woods costs ' + R.terrainCost(v, 'woods') + '"',
    '· Def in woods ' + R.defenceAgainst(woods, gunner, v, {}).value,
    '· deep water ' + (R.terrainBars(v, 'deep') ? 'blocked' : 'crossed'),
    '· lava ' + (R.terrainBars(v, 'lava') ? 'blocked' : 'CROSSED — WRONG'));
});

/* arcs: the walker's armoured flanks deny the +1 side shot, but not the rear +2 */
console.log('--- shot from the flank and the rear ---');
['wheeled', 'walker'].forEach(function (pr) {
  var v = mk('lcv', pr, 'B', 20, 20, 0);
  var flank = mk('regular', null, 'A', 20, 32), rear = mk('regular', null, 'A', 8, 20);
  var st = world(); st.units = [flank, v];
  var side = R.shotOdds(st, flank, v, 'fire', {});
  st.units = [rear, v];
  var back = R.shotOdds(st, rear, v, 'fire', {});
  console.log(' ', pr.padEnd(8), 'side +' + side.mods, '· rear +' + back.mods);
});

/* the turn toll: how far a vehicle can reach ahead of it and behind it */
console.log('--- a Move action, ahead and behind ---');
R.PROP_ORDER.forEach(function (pr) {
  var v = mk('lcv', pr, 'A', 24, 24, 0);
  var st = world(); st.units = [v];
  var cells = R.reachable(st, v, v.move + 4), ahead = 0, behind = 0;
  cells.forEach(function (c) {
    var d = Math.hypot(c.x - 24, c.y - 24);
    if (c.x > 24 + Math.abs(c.y - 24)) ahead = Math.max(ahead, d);
    if (c.x < 24 - Math.abs(c.y - 24)) behind = Math.max(behind, d);
  });
  console.log(' ', pr.padEnd(8), 'allowance ' + (v.move + 4).toFixed(1) + '"',
    '· ahead ' + ahead.toFixed(1) + '"', '· behind ' + behind.toFixed(1) + '"');
});

/* the odds shown on the board have to match the dice that follow */
console.log('--- the odds against 20,000 rolls ---');
[['regular', 'rookie', 8], ['atteam', 'lcv', 8], ['veterans', 'protectors', 14]].forEach(function (row) {
  var st = world();
  var a0 = mk(row[0], null, 'A', 20, 20), t0 = mk(row[1], null, 'B', 20 + row[2], 20);
  st.units = [a0, t0];
  var odds = R.shotOdds(st, a0, t0, 'fire', {});
  var tell = 0, sum = 0, n = 20000;
  for (var i = 0; i < n; i++) {
    var a1 = mk(row[0], null, 'A', 20, 20), t1 = mk(row[1], null, 'B', 20 + row[2], 20);
    st.units = [a1, t1];
    var r = R.shoot(st, a1, t1, 'fire', {});
    if (r.hits > 0) tell++;
    sum += r.hits;
  }
  var gap = Math.abs(odds.chance - tell / n);
  if (gap > 0.02) bad++;
  console.log(' ', (row[0] + ' vs ' + row[1]).padEnd(24),
    'shown ' + Math.round(odds.chance * 100) + '% / ' + odds.avgHits.toFixed(2) + ' hits',
    '· rolled ' + (100 * tell / n).toFixed(1) + '% / ' + (sum / n).toFixed(2),
    gap > 0.02 ? '<-- DRIFT' : '');
});

/* every preset fields a machine and is legal */
console.log('--- ready-made companies ---');
[1, 2, 3, 4, 5].forEach(function (bt) {
  R.PRESETS[bt].forEach(function (pr) {
    var c = R.checkArmy(pr.keys, bt, 1);
    var mach = pr.keys.filter(function (k) {
      return R.profile(R.splitPick(k).key).cls !== 'infantry';
    });
    if (!c.ok || !mach.length) bad++;
    console.log('  BT' + bt, pr.name.padEnd(24), c.ok ? 'legal' : 'ILLEGAL ' + c.faults.join(' '),
      '· ' + c.spent + '/' + c.budget, '· ' + (mach.join(', ') || 'NO MACHINE'));
  });
});

/* rolled armies stay legal now that vehicles carry a drive */
var wrong = 0;
for (var bt2 = 1; bt2 <= 5; bt2++) {
  for (var pl = 1; pl <= 2; pl++) {
    for (var n2 = 0; n2 < 60; n2++) {
      var army = R.rollArmy(bt2, pl);
      if (!R.checkArmy(army, bt2, pl).ok) wrong++;
      army.forEach(function (k) {
        var pick = R.splitPick(k), p = R.profile(pick.key);
        if (p.cls === 'vehicle' && pick.prop && !R.PROPULSION[pick.prop]) wrong++;
        if (p.cls !== 'vehicle' && pick.prop) wrong++;   // only ground vehicles take a drive
      });
    }
  }
}
console.log('600 rolled armies — wrong:', wrong);
if (wrong) bad++;
console.log(bad ? bad + ' PROPULSION CHECKS FAILED' : 'every propulsion behaves as the book says');
