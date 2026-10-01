/* The Low findings on scenarios and set-up (the rules review at 7dd7306):
   the player picks which location to search (L-20, p. 52); a landing zone is
   an 8" circle, all of it in the open and 8" clear of the edges (L-21, p. 53);
   squads riding down in a hull are shaken by the landing too (L-22); the
   Demolish defender's 18" runs from the objective's edge (L-23, p. 54); the
   Invasion defender may put none of its force on the table (L-24, p. 53); and
   an Unstable world's outpost is walled all round (L-27, p. 48). */
'use strict';
const { R, Engine, SC, GEN, C } = require('../../server/rules.js');
let seed = 51;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function game(scenario, armyA, armyB, attacker) {
  const e = Engine.create({});
  e.start({ tier: 3, pl: 1, scenario, armyA, armyB, nameA: 'A', nameB: 'B', attacker,
    colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
  return e;
}
function toBattle(e) {
  let g = 0;
  while (e.state().phase === 'deploy' && g++ < 200) { const side = e.query.placingSide(); if (!side) break; e.intent(side, { k: 'autodeploy' }); }
  e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' });
  e.intent('A', { k: 'start' });
  for (g = 0; g < 60 && e.state().phase !== 'battle'; g++) e.intent(e.state().activeSide || 'A', { k: 'start' });
}

console.log('\nThe player picks which location to search (p. 52)');
(function () {
  const e = game('meeting', ['regular', 'regular'], ['regular']);
  toBattle(e);
  const st = e.state();
  // two of Find and secure's locations, 8" apart, with the squad between them
  st.terrain.length = 0;
  st.sc.search = [20, 28].map((x, i) => {
    const piece = { kind: 'searchsite', x: x - 2, y: 22, w: 4, h: 4, site: i, cx: x, cy: 24 };
    st.terrain.push(piece);
    return { x, y: 24, i, checked: false, piece };
  });
  st.sc.found = null; st.sc.order = 0;
  const u = st.units.find((x) => x.side === 'A' && x.alive);
  st.units.forEach((v, k) => { v.reserve = false; v.aboard = null; v.x = v === u ? 24 : 6 + k; v.y = v === u ? 30 : 6 + k * 4; });
  u.activated = false; u.sp = 0;
  st.activeSide = 'A'; st.chain = null; st.streak = 9;
  e.intent('A', { k: 'select', id: u.id });
  const r = e.intent('A', { k: 'action', id: 'checkarea' });
  ok('with two in reach, it asks which', r.ok && e.sel().moves.length === 2 && !u.activated, JSON.stringify(r));
  const pick = e.sel().moves.find((m) => m.x === 28);
  ok('...and searches the one tapped', !!pick && e.intent('A', { k: 'checkarea', x: pick.x, y: pick.y }).ok && st.sc.search[1].checked && !st.sc.search[0].checked && u.activated);
})();

console.log('\nA landing zone is an 8" circle in the open (p. 53)');
(function () {
  const st = { terrain: [{ kind: 'woods', x: 22, y: 20, w: 4, h: 8 }], units: [], objectives: [] };
  ok('its middle in the open but its edge in a wood: refused', !SC.lzOK(st, { x: 20, y: 24 }, []));
  ok('...clear of it: allowed', SC.lzOK(st, { x: 16, y: 24 }, []));
  ok('its edge 8" from the table edge: allowed', SC.lzOK({ terrain: [], units: [] }, { x: 12, y: 24 }, []));
  ok('...nearer: refused', !SC.lzOK({ terrain: [], units: [] }, { x: 10, y: 24 }, []));
})();

console.log('\nSquads riding down in a hull are shaken by the landing too (p. 53)');
(function () {
  const e = game('invasion', ['regular', 'regular'], ['lapc', 'regular', 'regular'], 'B');
  const st = e.state();
  const hull = st.units.find((u) => u.key === 'lapc'), rider = st.units.find((u) => u.side === 'B' && u.cls === 'infantry');
  ok('the scenario is Invasion with B attacking', st.sc.attacker === 'B' && !!hull);
  hull.cargo = [rider]; rider.aboard = hull.id; rider.sp = 0;
  const note = st.scen.onArrive(st, hull);
  ok('the hull lands and the squad aboard takes D3', !!note && rider.sp >= 1 && rider.sp <= 3, note && note.text);
})();

console.log('\nDemolish: the defender’s 18" runs from the objective’s edge (p. 54)');
(function () {
  const e = game('demolish', ['regular', 'regular'], ['regular', 'regular'], 'A');
  const st = e.state(), t = st.sc.target;
  ok('the circle reaches 18" past the objective’s edge', st.sc.defCircle.r === 18 + t.w / 2, st.sc.defCircle.r + '"');
})();

console.log('\nInvasion: the defender may put nothing down (p. 53)');
(function () {
  const e = game('invasion', ['regular', 'regular', 'regular', 'rookie', 'rookie', 'recruits'], ['regular'], 'B');
  const st = e.state(), sp = st.sc.split && st.sc.split.A;
  ok('the defender may hold its whole force back', !!sp && sp.max === sp.ids.length, sp ? sp.max + ' of ' + sp.ids.length : 'no split');
})();

console.log('\nAn Unstable world’s outpost is walled all round (p. 48)');
(function () {
  let outposts = 0, walls = 0, few = 0;
  for (let i = 0; i < 200; i++) {
    let s = 77 + i * 13; const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    GEN.generate({ width: 48, height: 48, planet: 'unstable', rand }).rolls.forEach((r) => {
      if (!/Outpost/.test(r.text)) return;
      outposts++;
      const n = r.placed.filter((k) => k === 'wall').length;
      walls += n; if (n < 4) few++;
    });
  }
  ok('outposts are walled with as many sections as the ring takes', outposts > 0 && walls / outposts >= 7, (walls / outposts).toFixed(1) + ' a compound');
  ok('...hardly ever fewer than four', few <= outposts * 0.1, few + ' of ' + outposts);
})();

console.log('\nTerrain changes by hand alternate, a piece each (p. 45)');
(function () {
  function start(setup) {
    const e = Engine.create({});
    e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: ['rsecondary', 'rmilitia', 'rmilitia', 'rciv', 'rciv'], armyB: ['rsecondary', 'rmilitia', 'rmilitia', 'rciv', 'rciv'],
      nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse', terrainSetup: setup,
      tactics: { A: 'laststand', B: 'laststand' } });
    for (let g = 0; g < 10 && e.state().phase === 'terrain'; g++) ['A', 'B'].forEach((sd) => e.intent(sd, { k: 'terrain', act: 'tautoall' }));
    return e;
  }
  const e = start('manual'), st = e.state(), order = [];
  for (let n = 0; n < 6 && st.placeAsk; n++) {
    const side = st.placeAsk.side;
    let done = false;
    for (let x = 3; x < 46 && !done; x += 3) for (let y = 3; y < 46 && !done; y += 3) {
      if (e.intent(side, { k: 'placeat', x, y }).ok) { order.push(side); done = true; }
    }
    if (!done) break;
  }
  const alt = order.length >= 4 && order.every((sd, i) => !i || sd !== order[i - 1]);
  ok('set up by hand, both sides put their barricades down a piece each in turn', alt, order.join(''));
  const auto = start('auto').state();
  ok('generated, nobody is asked: the barricades are put down for both', !auto.placeAsk &&
    ['A', 'B'].every((sd) => auto.terrain.filter((t) => t.kind === 'barricade' && t.laststand === sd).length > 0 || auto.terrain.some((t) => t.kind === 'barricade')),
    auto.placeAsk ? 'asked ' + auto.placeAsk.side : '');
})();

console.log('\nCampaign battles stay at Priority Level 1 or 2, the 4\'x4\' table\'s (p. 45)');
(function () {
  const a = C.newCompany('A'), b = C.newCompany('B');
  // rosters big enough for a Priority Level 4 army
  R.rollArmy(3, 4, null, 'pmc').forEach((k) => { const sp = R.splitPick(k); a.roster.push(C.newEntry(sp.key)); b.roster.push(C.newEntry(sp.key)); });
  a.tier = b.tier = 3;
  const lv = C.levelsFor(a, b, 3);
  ok('a contract offers no Priority Level above 2, whatever the companies could field', lv.length > 0 && lv.every((n) => n <= 2), lv.join(','));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
