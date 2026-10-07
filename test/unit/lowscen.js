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

console.log('\nSquads riding down in a hull are not shaken: troops aboard cannot be Suppressed (pp. 36, 53)');
(function () {
  const e = game('invasion', ['regular', 'regular'], ['lapc', 'regular', 'regular'], 'B');
  const st = e.state();
  const hull = st.units.find((u) => u.key === 'lapc'), rider = st.units.find((u) => u.side === 'B' && u.cls === 'infantry');
  ok('the scenario is Invasion with B attacking', st.sc.attacker === 'B' && !!hull);
  hull.cargo = [rider]; rider.aboard = hull.id; rider.sp = 0;
  const note = st.scen.onArrive(st, hull);
  ok('the hull lands, and the squad aboard takes no Suppression', !note && rider.sp === 0);
  const foot = st.units.find((u) => u.side === 'B' && u.cls === 'infantry' && u !== rider);
  foot.sp = 0;
  const n2 = st.scen.onArrive(st, foot);
  ok('...a squad landing on its own takes its D3', !!n2 && foot.sp >= 1 && foot.sp <= 3);
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
    // two rebel forces first choose their tactics in turn (p. 96): each keeps the one it mustered with
    for (let g = 0; g < 2 && e.state().tacticAsk; g++) { const sd = e.state().tacticAsk.order[e.state().tacticAsk.step]; e.intent(sd, { k: 'tactic', tactic: 'laststand' }); }
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

console.log('\nA landing zone is held only by a token over its circle (house rule, SCN-1)');
(function () {
  const e = game('invasion', ['regular', 'regular', 'regular'], ['regular', 'regular', 'regular'], 'A');
  toBattle(e);
  const st = e.state();
  st.terrain.length = 0;
  // three zones 12" apart centre to centre, the closest the book allows
  st.objectives = [{ x: 18, y: 24 }, { x: 30, y: 24 }, { x: 24, y: 34.4 }].map((p) => ({ x: p.x, y: p.y, r: 4, lz: true, owner: null }));
  const as = st.units.filter((u) => u.side === 'A'), bs = st.units.filter((u) => u.side === 'B');
  st.units.forEach((u) => { u.reserve = false; u.sp = 0; u.x = u.side === 'A' ? 4 : 44; u.y = 4 + st.units.indexOf(u) * 3; u.cargo = u.cargo || []; });
  const owners = () => st.objectives.map((o) => SC.holderOf(st, o.x, o.y, 4, SC.areaOf(o)));
  // one attacker between the first two zones, 2" from each circle's edge
  as[0].x = 24; as[0].y = 24;
  ok('a unit between two zones holds neither', owners().every((w) => w === null), owners().join(','));
  as[0].x = 22.8; as[0].y = 24;
  ok('...one with its token just over a zone\'s edge holds that one', owners()[0] === 'A' && owners()[1] === null, owners().join(','));
  // one defender at the middle of the triangle used to keep all three hot
  as[0].x = 4; as[0].y = 4;
  bs[0].x = 24; bs[0].y = 27.5;
  ok('a lone defender in the middle no longer holds all three', !owners().every((w) => w === 'B'), owners().join(','));
  bs[1].x = 18; bs[1].y = 24; bs[2].x = 30; bs[2].y = 24; bs[0].x = 24; bs[0].y = 34.4;
  ok('...a defender in each one does', owners().every((w) => w === 'B'), owners().join(','));
})();

console.log('\nInvasion and emplaced guns (p. 94; review a119ac2 REB-5): the attacker drops them, the defender tows them in or leaves them out');
(function () {
  function inv(attacker, armyA, armyB, mode) {
    const e = Engine.create({});
    e.start({ tier: 3, pl: 1, scenario: 'invasion', attacker, armyA, armyB,
      nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode, planet: 'sparse', terrainSetup: 'auto', readyUp: true });
    for (let g = 0; g < 4 && e.state().tacticAsk; g++) e.intent(e.state().tacticAsk.order[e.state().tacticAsk.step], { k: 'tactic', tactic: null });
    return e;
  }
  const guns = ['rleaders', 'rmedart', 'rmedart', 'rmedart', 'rmedart', 'rmedart'];
  const four = ['regular', 'regular', 'regular', 'regular'];
  // the attacker: guns come down in either wave, none on tow, and no swap is forced
  const ea = inv('A', guns.slice(), four, 'ai'), sa0 = ea.state();
  const aGuns = sa0.units.filter((u) => u.side === 'A' && u.key === 'rmedart');
  const hb = ea.intent('A', { k: 'holdback', id: aGuns[0].id });
  ok('an attacker may put a gun in the second wave', hb.ok && aGuns[0].wave === 2, hb.why || '');
  const eai = inv('B', four, guns.slice(), 'ai'), aiGuns = eai.state().units.filter((u) => u.side === 'B' && u.key === 'rmedart');
  ok('...and the AI attacker splits its guns between the waves', aiGuns.some((u) => u.wave === 1) && aiGuns.some((u) => u.wave === 2), aiGuns.map((u) => u.wave).join(''));
  ok('...with no swap forced on it', !(sa0.swapAvail && sa0.swapAvail.A && sa0.swapAvail.A.forced));
  const ef = inv('A', ['rleaders', 'rmedart', 'rltv', 'rciv', 'rciv', 'rciv'], four, 'ai'), sf = ef.state();
  const fg = sf.units.find((u) => u.side === 'A' && u.key === 'rmedart'), ft = sf.units.find((u) => u.side === 'A' && u.key === 'rltv');
  ok('...a gun may not be hitched to a hull that lands', !ef.intent('A', { k: 'load', hull: ft.id, unit: fg.id }).ok && !fg.aboard);
  ok('...but hitching one in the battle is still allowed', R.canEmbark(sf, Object.assign({}, ft, { cargo: [], aboard: null, x: 10, y: 10 }), Object.assign({}, fg, { x: 11, y: 10, aboard: null })));

  // the defender with more guns than its third and nothing to tow them: the swap is forced
  const e = inv('B', guns.slice(), four, 'ai'), st = e.state();
  const sa = st.swapAvail && st.swapAvail.A;
  ok('a defender\'s guns over its third, with no tows, must be swapped', !!sa && sa.forced >= 3, sa ? sa.total + ' swaps, ' + sa.forced + ' needed' : 'none');
  ok('...and the player cannot go on before making them', !e.intent('A', { k: 'deployready' }).ok);
  const alt = R.listFor('rebel').find((p) => p.tier === 3 && p.cls === 'infantry' && !(p.rules || []).includes('Stationary Artillery') && !p.command);
  e.intent('A', { k: 'swapopen' });
  st.units.filter((u) => u.side === 'A' && u.key === 'rmedart').slice(0, sa.forced).forEach((g) => {
    e.intent('A', { k: 'swappick', id: g.id }); e.intent('A', { k: 'swapin', id: alt.key });
  });
  const res = e.intent('A', { k: 'deployready' });
  ok('with the guns swapped, it goes on', res.ok, res.why || '');

  // with transport vehicles in the force, the guns over the third go behind them, and no swap is forced
  const towArmy = ['rleaders', 'rmedart', 'rmedart', 'rmedart', 'ritv', 'ritv'];
  const et = inv('B', towArmy.slice(), four, 'ai'), stt = et.state();
  ok('a defender with a tow for each gun over its third is not made to swap', !(stt.swapAvail && stt.swapAvail.A && stt.swapAvail.A.forced));
  // the AI's own force sets it up that way: guns on the table first, the rest on the hook of held hulls
  const eb = inv('A', four, towArmy.slice(), 'ai'), sb = eb.state();
  const bGuns = sb.units.filter((u) => u.side === 'B' && u.key === 'rmedart');
  const towedB = bGuns.filter((u) => u.aboard), hullsHeld = sb.units.filter((u) => u.side === 'B' && u.key === 'ritv' && u.reserve && u.wave === 2);
  ok('the AI defender tows the guns its third cannot take', towedB.length === 1 && towedB.every((g) => hullsHeld.some((h) => h.id === g.aboard)),
    towedB.length + ' towed, ' + hullsHeld.length + ' hulls held');
  ok('...and holds none back on its own', !bGuns.some((u) => u.reserve && !u.aboard));

  // a gun held back with nothing to tow it never comes on
  const ec = inv('A', four, ['rleaders', 'rmedart', 'rmedart', 'rmedart', 'rmedart', 'rmedart'], 'hotseat'), sc = ec.state();
  const lone = sc.units.find((u) => u.side === 'B' && u.key === 'rmedart');
  lone.reserve = true; lone.wave = 2; lone.aboard = null; lone.x = -1; lone.y = -1;
  sc.turn = 9;
  const keep = Math.random; Math.random = () => 0.99;
  let coming;
  try { coming = SC.reserves(sc, 'B'); } finally { Math.random = keep; }
  ok('a defender\'s gun held back with no tow never comes on', coming.indexOf(lone) < 0, coming.map((u) => u.key).join(','));
})();

console.log('\nSCN-2 Wiping the enemy out on the last turn wins, even with the objectives level (p. 49)');
(function () {
  const e = game('secure', ['regular', 'regular'], ['regular', 'regular']);
  toBattle(e);
  const st = e.state();
  st.turn = 20;
  st.units.forEach((u) => { u.x = 2 + (u.side === 'A' ? 0 : 40); u.y = 2; });     // nobody near any objective: level
  const level = SC.check(st);
  ok('with both forces standing and the objectives level, turn 20 is a draw', level && level.winner == null && !!level.text, level && level.text);
  st.units.filter((u) => u.side === 'B').forEach((u) => { u.alive = false; });
  const r = SC.check(st);
  ok('...but with B wiped out in that End phase, A wins', r && r.winner === 'A', r && r.text);
})();

console.log('\nInvasion: the first wave gone and every landing zone held, the landing has failed');
(function () {
  const e = game('invasion', ['regular', 'regular', 'regular'], ['regular', 'regular', 'regular', 'regular'], 'B');
  const st = e.state();
  st.phase = 'battle'; st.turn = 6; st.sc.lzPending = false;
  st.objectives = [{ x: 12, y: 12, r: 4, lz: true }, { x: 24, y: 30, r: 4, lz: true }, { x: 36, y: 12, r: 4, lz: true }];
  const defs = st.units.filter((u) => u.side === 'A'), atks = st.units.filter((u) => u.side === 'B');
  defs.forEach((u, i) => { u.reserve = false; u.aboard = null; u.x = st.objectives[i].x; u.y = st.objectives[i].y; });
  // the first wave wiped out on the table; the second still waiting to come down
  atks.forEach((u, i) => { if (i < 2) { u.alive = false; u.reserve = false; u.x = 20; u.y = 20; } else { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; } });
  const r = SC.check(st);
  ok('with nothing of the attacker\'s on the table and all three zones held, the defender wins', r && r.winner === 'A', r && r.text);
  defs[2].x = 2; defs[2].y = 40;                                  // one zone left open
  ok('...but not while a zone is open for the second wave', !SC.check(st));
  defs[2].x = st.objectives[2].x; defs[2].y = st.objectives[2].y;
  const s2 = atks[2]; s2.reserve = false; s2.x = 44; s2.y = 44;       // one of the attacker's still standing
  ok('...nor while the attacker has a unit on the table', !SC.check(st));
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
