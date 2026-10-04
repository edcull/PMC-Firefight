/* A battle played again from its seed and its intents comes out the same, even
   with the board asking its questions in between. That is how a battle kept in
   the browser comes back after a refresh (net.js resume) and how the server
   brings a game back after a restart (table.js restore): the dice are the
   battle's own only while the engine answers its start or an intent, and the
   board's previews, buttons and hints — a unit's reach, whether it could leave
   the table, who holds each objective — are asked between them, with whatever
   Math.random is then. Such a question that rolled a die, or wrote into the
   battle, sent the game it was asked in one way and its replay another: barbed
   wire's D6 (p. 42) was rolled on the first look at a unit's reach, so a
   preview rolled it with the wrong dice and the move that followed did not
   roll it at all, and the replay was a die out from then on. The board's
   live count of who holds each objective was written into the battle, where
   the OpFor and an Invasion's landing zones read it; and the card for an
   Invasion defender's reinforcement rolled the edge it comes on from. */
'use strict';
global.window = global;
const { R, Engine } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
// the battle's dice, as net.js and table.js make them from its seed (mulberry32)
function dice(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Math.random between intents: the page's own, counted
let outside = 0;
const other = dice(12345);
Math.random = function () { outside++; return other(); };

/* Hostile takeover: the machine's defender rings the objective with trenches,
   walls and wire (scenarios.js takeoverForts). The OpFor plays both sides. */
const CFG = { tier: 2, pl: 1, scenario: 'takeover', armyA: ['regular', 'regular', 'regular', 'lcv'], armyB: ['regular', 'regular', 'regular', 'lcv'],
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse' };

function table(seed, scenario) {
  const rng = dice(seed), e = Engine.create({});
  const rolling = (fn) => { const real = Math.random; Math.random = rng; try { return fn(); } finally { Math.random = real; } };
  rolling(() => e.start(Object.assign(JSON.parse(JSON.stringify(CFG)), { scenario: scenario || CFG.scenario })));
  return { e, rolling, intent: (side, it) => rolling(() => e.intent(side, it)) };
}
// everything the battle is, as it would be saved and sent
function picture(e) { return JSON.stringify(e.snapshot()); }

// what the board asks between intents, for every unit on the table
function boardAsks(e) {
  const s = e.state(), Q = e.query;
  if (!s || s.phase !== 'battle') return;
  Q.objectiveHolders();
  s.units.forEach((u) => {
    // a reinforcement's card says where it may come on (Invasion's defender: an edge rolled as it arrives)
    if (u.alive && u.x < 0 && !u.aboard) Q.arrivalWhere(u);
    if (!u.alive || u.x < 0 || u.aboard) return;
    ['move', 'advance', 'run', 'leave', 'assault', 'fire'].forEach((id) => Q.actionState(u, id));
    R.reachable(s, u, u.move);
    R.pathTo(s, u, u.move, { x: u.x + 3, y: u.y + 3 });
  });
}

// played out the way offtable.js plays a battle nobody watches, each intent written down
function playOut(t, between) {
  const book = [], after = [];
  const send = (side, it) => {
    book.push([side, it]);
    const r = t.intent(side, it);
    after.push(picture(t.e));
    if (between) between(t.e);
    return r;
  };
  let stuck = 0;
  for (let g = 0; g < 3000 && !t.e.over(); g++) {
    const s = t.e.state();
    if (s.swapAsk) { send(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { send(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') {
      send('A', { k: 'autodeploy' }); send('B', { k: 'autodeploy' }); send('A', { k: 'start' });
      if (++stuck > 8) break;
      continue;
    }
    if (send(s.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
    const sel = t.e.sel();
    if (sel.insertion) {
      const sp = (sel.insertion.spots || [])[0];
      send(sel.insertion.by || (sel.insertion.unit ? sel.insertion.unit.side : 'A'), sp ? { k: 'insert', x: sp.x, y: sp.y } : { k: 'holdinsert' });
      continue;
    }
    if (sel.reservePick) {
      const rp = sel.reservePick;
      rp.ids.slice(0, Math.max(rp.min, 1)).forEach((id) => send(rp.side, { k: 'rpick', id: id }));
      send(rp.side, { k: 'rpickdone' });
      continue;
    }
    if (++stuck > 20) break;
  }
  return { book, after };
}

console.log('\nA battle with barbed wire, played again from its seed and intents');
let wired = 0;
/* Hostile takeover for the wire; Invasion for the objectives (the second wave
   comes down only in a zone the defender does not hold, and the OpFor's
   insertions make for the ones held against it) and the defender's random edges. */
[[1, 'takeover'], [2, 'takeover'], [4, 'takeover'], [5, 'takeover'], [1, 'invasion'], [2, 'invasion']].forEach(([seed, scenario]) => {
  const t = table(seed, scenario);
  let asked = 0, wrote = 0, wireRolls = 0;
  const played = playOut(t, (e) => {
    const before = picture(e), o0 = outside;
    boardAsks(e);
    asked++;
    if (picture(e) !== before) wrote++;
    wireRolls += outside - o0;
  });
  const wires = t.e.state().terrain.filter((r) => r.kind === 'wire').length;
  if (wires) wired++;
  console.log(scenario + ', seed ' + seed + ': ' + wires + ' stretches of wire, ' + played.book.length + ' intents, turn ' + t.e.state().turn);
  ok('...the board asked ' + asked + ' times between intents, and changed nothing', wrote === 0, wrote ? wrote + ' times it did' : '');
  ok('...and rolled no die', wireRolls === 0, wireRolls ? wireRolls + ' rolls' : '');
  // a refresh: the same start, the same dice, the same intents, and nobody asking anything
  const again = table(seed, scenario);
  let drift = -1, when = 0;
  played.book.forEach((x, i) => {
    again.intent(x[0], x[1]);
    if (drift < 0 && picture(again.e) !== played.after[i]) { drift = i; when = again.e.state().turn; }
  });
  ok('...played again, it is the same battle at every intent', drift < 0,
    drift < 0 ? '' : 'it parts at intent ' + drift + ' (' + JSON.stringify(played.book[drift]) + ', turn ' + when + ')');
});
ok('(battles with wire on the table among them)', wired > 0, wired + ' of them');

console.log('\nBarbed wire\'s D6 (p. 42): rolled before the move, by the move\'s own dice');
(function () {
  const t = table(1);
  // into the battle, with wire on the table
  for (let g = 0; g < 40 && t.e.state().phase !== 'battle'; g++) {
    const s = t.e.state();
    if (s.swapAsk) t.intent(s.swapAsk.side, { k: 'swapdone' });
    else if (s.faceAsk) t.intent(s.faceAsk.side, { k: 'vfaceall' });
    else { t.intent('A', { k: 'autodeploy' }); t.intent('B', { k: 'autodeploy' }); t.intent('A', { k: 'start' }); }
  }
  const s = t.e.state();
  const foot = s.units.filter((u) => u.alive && u.x >= 0 && u.cls === 'infantry')[0];
  ok('(a battle under way, with wire on the table and a squad on it)', s.phase === 'battle' && !!foot && s.terrain.some((r) => r.kind === 'wire'));
  if (!foot) return;
  foot.wireRoll = null;
  const o0 = outside;
  t.e.query.actionState(foot, 'leave');
  R.reachable(s, foot, foot.move);
  ok('its reach looked at between intents rolls nothing, and keeps nothing', foot.wireRoll == null && outside === o0);
  ok('...the wire priced at the worst the D6 could do', R.terrainCost(foot, 'wire') === 6);
  t.rolling(() => R.answering(() => R.reachable(s, foot, foot.move)));
  const d = foot.wireRoll;
  ok('looked at while the engine answers an intent, the D6 is rolled', d >= 1 && d <= 6, 'D6 ' + d);
  R.reachable(s, foot, foot.move);
  t.rolling(() => R.answering(() => R.reachable(s, foot, foot.move)));
  ok('...once for the move, and kept for it', foot.wireRoll === d && R.terrainCost(foot, 'wire') === d);
})();

console.log('\nWho holds each objective, live');
(function () {
  const t = table(2);
  for (let g = 0; g < 40 && t.e.state().phase !== 'battle'; g++) {
    const s = t.e.state();
    if (s.swapAsk) t.intent(s.swapAsk.side, { k: 'swapdone' });
    else if (s.faceAsk) t.intent(s.faceAsk.side, { k: 'vfaceall' });
    else { t.intent('A', { k: 'autodeploy' }); t.intent('B', { k: 'autodeploy' }); t.intent('A', { k: 'start' }); }
  }
  const s = t.e.state(), o = s.objectives[0];
  ok('(an objective on the table)', !!o);
  if (!o) return;
  const was = o.owner, held = t.e.query.objectiveHolders();
  ok('...the board told who holds each one', held.length === s.objectives.length, JSON.stringify(held));
  ok('...shown without being written into the battle (the End phase scores it)', o.owner === was, 'owner ' + o.owner);
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
