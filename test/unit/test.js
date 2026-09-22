global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

function mk(p, side, x, y) {
  return R.applyPropulsion(Object.assign({}, p, {
    id: side + p.code, side: side, label: p.name + ' [' + side + ']', models: p.size,
    rules: p.rules.slice(), x: x, y: y, sp: 0, alive: true, activated: false, marked: false,
    shotFrom: [], damage: 0, cargo: [], facing: 0
  }), p.prop);
}
// the two Battle Tier III ready-made companies, as profile objects
function force(id) {
  var pr = R.PRESETS[3].filter(function (x) { return x.id === id; })[0];
  // preset entries may carry a propulsion, as in "lcv:tracked"
  return pr.keys.map(function (k) {
    var pick = R.splitPick(k), p = R.profile(pick.key);
    return p ? Object.assign({}, p, { prop: pick.prop }) : p;
  });
}
var A = force('ironhold'), B = force('blackwater');
function world(terrain) { return { terrain: terrain || [], units: [] }; }

/* 1. measurement is edge to edge */
var st = world();
var r1 = mk(A[1], 'A', 10, 10), v1 = mk(B[1], 'B', 22, 10);
st.units = [r1, v1];
console.log('centres 12" apart -> measured', R.unitDist(r1, v1).toFixed(1), '(expect 10.0)');
console.log('LoS clear:', R.hasLoS(st, r1, v1));

/* 2. expected hits: FP3 +3 models +1 Fire! (10" is over half of 18") vs Def 11 */
var tot = 0, n = 20000;
for (var i = 0; i < n; i++) {
  var a = mk(A[1], 'A', 10, 10), b = mk(B[1], 'B', 22, 10);
  st.units = [a, b];
  tot += R.shoot(st, a, b, 'fire', {}).hits;
}
console.log('avg hits per Fire! (expect 1.50):', (tot / n).toFixed(2));

/* 3. unmodified 9 is the only way through an impossible Defence */
var hits = 0;
for (var j = 0; j < 20000; j++) {
  var a2 = mk(A[1], 'A', 10, 10), b2 = mk(B[1], 'B', 22, 10);
  b2.def = 30; st.units = [a2, b2];
  if (R.shoot(st, a2, b2, 'fire', {}).hits > 0) hits++;
}
console.log('share of attacks scoring vs Def 30 (expect 0.10):', (hits / 20000).toFixed(3));

/* 4. terrain: LoS blocking, standing in cover, intervening cover */
var woods = { kind: 'woods', x: 14, y: 6, w: 6, h: 8 };
var wall = { kind: 'barricade', x: 20, y: 6, w: 0.9, h: 8 };
var st2 = world([woods, wall]);
var shooter = mk(B[1], 'B', 10, 10), target = mk(A[1], 'A', 26, 10);
st2.units = [shooter, target];
console.log('woods on the line blocks LoS:', R.hasLoS(st2, shooter, target), '(expect false)');
var st3 = world([wall]);
st3.units = [shooter, target];
console.log('low wall between: LoS', R.hasLoS(st3, shooter, target), '| Def',
  R.defenceAgainst(st3, shooter, target, {}).value, '(expect 12)');
var inWoods = mk(A[1], 'A', 17, 10);
var st4 = world([woods]); st4.units = [shooter, inWoods];
console.log('standing in woods: LoS', R.hasLoS(st4, shooter, inWoods), '| Def',
  R.defenceAgainst(st4, shooter, inWoods, {}).value, '(expect 12)');
var bat = mk(B[3], 'B', 17, 10);
st4.units = [mk(A[1], 'A', 10, 10), bat];
console.log('battle armour in woods Def (expect 12, no terrain bonus):',
  R.defenceAgainst(st4, st4.units[0], bat, {}).value);

/* 5. stealth by full 6" bands */
var st5 = world();
var shp = mk(A[5], 'A', 10, 10);
[{ d: 5, e: 8 }, { d: 10, e: 9 }, { d: 20, e: 11 }].forEach(function (c) {
  var foe = mk(B[1], 'B', 10 + c.d + 2, 10);   // +2 for the two radii
  st5.units = [shp, foe];
  console.log('stealth at ' + c.d + '": Def ' + R.defenceAgainst(st5, foe, shp, {}).value + ' (expect ' + c.e + ')');
});

/* 6. movement: allowance, difficult ground, impassable rocks */
var st6 = world();
var mover = mk(A[1], 'A', 24, 18); st6.units = [mover];
var cells = R.reachable(st6, mover, mover.move + 2);
var far = cells.reduce(function (m, c) { return Math.max(m, R.inches(c.x, c.y, 24, 18)); }, 0);
console.log('open ground, 7" allowance -> furthest point', far.toFixed(1), '(expect 7.0)');
var st7 = world([{ kind: 'woods', x: 25, y: 10, w: 10, h: 16 }]);
st7.units = [mover];
var cells2 = R.reachable(st7, mover, 7);
var east = cells2.filter(function (c) { return c.x > 25; }).reduce(function (m, c) { return Math.max(m, c.x); }, 0);
console.log('into woods 1" penalty -> furthest east', (east - 24).toFixed(1), '(expect 6.0)');
var st8 = world([{ kind: 'rocks', x: 25, y: 10, w: 6, h: 16 }]);
st8.units = [mover];
var cells3 = R.reachable(st8, mover, 7);
console.log('rocks block: any point inside the rocks?',
  cells3.some(function (c) { return c.x > 25 && c.x < 31 && c.y > 10 && c.y < 26; }), '(expect false)');

/* 7. assault runs to a conclusion */
var st9 = world();
var eng = mk(A[3], 'A', 20, 18), rif = mk(B[2], 'B', 24, 18);
st9.units = [eng, rif];
console.log('--- assault sample ---');
R.assault(st9, eng, rif).log.forEach(function (l) { console.log('  ', l.text, l.math ? '| ' + l.math : ''); });

/* 8. 300 scripted duels, nothing throws */
var crashes = 0;
for (var k = 0; k < 300; k++) {
  try {
    var s = world([{ kind: 'crater', x: 18, y: 14, w: 6, h: 6 }]);
    var x1 = mk(A[k % 6], 'A', 16, 18), x2 = mk(B[k % 6], 'B', 26, 18);
    s.units = [x1, x2];
    for (var t = 0; t < 30 && x1.alive && x2.alive; t++) {
      if (R.canShoot(s, x1, x2, 'fire', {})) R.shoot(s, x1, x2, 'fire', {});
      if (x2.alive && R.canShoot(s, x2, x1, 'fire', {})) R.shoot(s, x2, x1, 'fire', {});
      if (x1.alive) R.rally(s, x1);
      if (x2.alive) R.rally(s, x2);
      x1.shotFrom = []; x2.shotFrom = [];
    }
  } catch (e) { crashes++; if (crashes < 2) console.log('ERROR', e.stack.split('\n').slice(0,5).join('\n')); }
}
console.log('duel crashes:', crashes);

/* 9. reachable performance */
var t0 = Date.now();
for (var q = 0; q < 20; q++) R.reachable(st7, mover, 7);
console.log('reachable() x20:', (Date.now() - t0) + 'ms');
