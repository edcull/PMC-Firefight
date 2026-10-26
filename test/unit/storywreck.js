/* The Wreck of the Morrow (Dead Reckoning): a compound laid by hand in the
   shape of the ship, Pell's ground outside her hull; who comes in where by
   the choice at the hatch; and Sable inside her in battle armour, in variants
   of its own (cutters, machine guns, assault), not her vehicles. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
const CMP = require('../../src/rules/compound.js');
const dr = require('../../src/story/dead-reckoning.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
const MAP = global.PMCStoryMaps['dead-reckoning'].wreck;
function at(opt) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'dead-reckoning', {});
  c.companies.A.kUC = 20;
  c.story.flags.sable_owed = true;
  c.story.chapter = 'wreck'; c.story.node = 'wreck.hatch';
  S.choose(c, opt);
  return c;
}
function started(c, tweak) {
  const spec = S.battleSpec(c);
  const cfg = L.toCfg(c, { picks: C.pickForce(c.companies.A, 1, 1, null, { scenario: spec.scenario }), role: 'A' });
  cfg.mode = 'demo';
  if (tweak) tweak(cfg);
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return { cfg, s: e.state() };
}
const inBox = (u, bx) => bx.some((b) => u.x >= b.x - 0.05 && u.x <= b.x + b.w + 0.05 && u.y >= b.y - 0.05 && u.y <= b.y + b.h + 0.05);

console.log('\nThe ship');
{
  const chk = CMP.checkPlan(MAP.compound, 48, 48);
  ok('her plan can be fought in: rooms and halls, her two nacelles among them', chk.ok && chk.rooms + chk.halls >= 8 &&
    ['Port nacelle', 'Starboard nacelle'].every((n) => Object.values(MAP.compound.names).indexOf(n) >= 0), JSON.stringify(chk));
  // every cell inside her outline is a room or a passage: nothing hollow inside her (the ground outside her breaches is outside her)
  const out = new Set(MAP.compound.outdoors.map((c) => c.j * 16 + c.i));
  const cells = MAP.compound.cells.split('').map((ch, i) => (out.has(i) ? '.' : ch)).join(''), cols = 16;
  let hollow = 0;
  for (let j = 0; j < 16; j++) {
    const row = cells.slice(j * cols, j * cols + cols), a = row.search(/[rc]/), b = row.length - 1 - row.split('').reverse().join('').search(/[rc]/);
    if (a < 0 || row.indexOf('r') < 0) continue;   // (a row only of pylons is outside her body)
    for (let i = Math.max(1, a); i <= b; i++) if (row[i] === '.') hollow++;
  }
  ok('...nothing hollow inside her hull', hollow === 0, hollow + ' cells');
  ok('...her rooms named: the engine rooms, the holds, the bridge', ['Port engine room', 'Starboard engine room', 'Port hold', 'Starboard hold', 'Bridge'].every((n) => Object.values(MAP.compound.names).indexOf(n) >= 0));
  const { s } = started(at('cut'));
  ok('the battle is fought in her, on the map, Pell’s ground outside her hull', s.compound && s.cfg.story.skin === 'wreck' &&
    s.terrain.some((t) => t.outside) && s.terrain.filter((t) => t.outside).every((t) => t.kind === 'bulkhead' && R.terrainName(s, 'bulkhead', t) !== 'Bulkhead'));
  ok('...two breaches in her hull, blown open: the main hatch near the bow, and the split in the starboard nacelle', s.terrain.filter((t) => t.kind === 'breached').length === 2 &&
    MAP.compound.breaches.length === 2);
  ok('...and the ground just outside each breach walkable, open ground, not her floor', s.terrain.filter((t) => t.outdoors).length >= 2 && s.terrain.filter((t) => t.outdoors).every((t) => t.kind === 'corridor' && !t.dangerous));
  // her spine: one corridor running stern to bow through her middle, the hold the biggest room on her, stacked with crates
  const rows = MAP.compound.cells.match(/.{16}/g), spine = rows.findIndex((r) => /c{5}/.test(r));
  ok('...a central corridor down her whole length, from the engine control room to the bridge', spine === 7 && /^\.rc{10}r{3}c$/.test(rows[spine]), 'row ' + spine);
  ok('...the holds aft, by the engine rooms', Object.entries(MAP.compound.names).some(([k, n]) => /hold$/.test(n) && +k % 16 <= 3));
  const hold = s.terrain.filter((t) => t.cargo === 'hold');
  ok('...and a big cargo hold amidships, stacked with crates in rows', hold.length >= 12 && hold.every((t) => t.kind === 'crates'), hold.length + ' stacks');
  ok('...no other clutter in among the hold’s crates', s.cfg.story.cargo.every((c) => !s.terrain.some((t) => t.cargo !== 'hold' &&
    ['crates', 'machinery', 'pillar'].indexOf(t.kind) >= 0 && t.x < c.x + c.w && t.x + t.w > c.x && t.y < c.y + c.h && t.y + t.h > c.y)));
  // her curved outer hull, round her rooms, and a sealed hatch opposite each breach
  const hull = s.terrain.find((t) => t.hull) && s.terrain.find((t) => t.hull).hull;
  ok('...a curved outer hull round her body and each nacelle', hull && hull.shapes.length === 3 && hull.shapes.every((p) => p.length > 12));
  const mid = (b) => [b.i * 3, b.j * 3];
  ok('...a sealed hatch opposite each breach, on her far side', hull && hull.hatches.length === MAP.compound.breaches.length &&
    MAP.compound.breaches.every((b) => { const [bx, by] = mid(b); return hull.hatches.some((h) => Math.abs(h.x + h.w / 2 - bx) < 4 && Math.abs(h.y + h.h / 2 - by) > 12); }),
    JSON.stringify(hull && hull.hatches));
}

console.log('\nWho comes in where');
for (const [opt, n, why] of [['cut', 2, 'cutting a second way in: the main hatch and the split'], ['wait', 1, 'following Sable in: her hatch only'], ['hire_sable', 1, 'in together, by the main hatch']]) {
  const { cfg, s } = started(at(opt));
  const A = s.sc.entry.A, B = s.sc.entry.B;
  // (a box is outside her when its middle is on the ground by a breach)
  const outside = (b) => s.terrain.some((t) => t.outdoors && b.x + b.w / 2 >= t.x && b.x + b.w / 2 <= t.x + t.w && b.y + b.h / 2 >= t.y && b.y + b.h / 2 <= t.y + t.h);
  ok(why + ' (' + n + ' way' + (n > 1 ? 's' : '') + ' in): the company sets up outside her, by the breach, 6" deep', A.length === n && A.every((b) => outside(b) && Math.min(b.w, b.h) <= 6.01));
  ok('...and the other side already inside her: its ground her rooms, not the ground outside', B.every((b) => !outside(b) && b.w * b.h >= 9) &&
    // (any that has had its first activation already, the other side having the initiative, has moved off)
    s.units.filter((u) => u.side === 'B' && u.x >= 0 && !u.activated).every((u) => inBox(u, B)), cfg.story.hired ? 'Brass Ledger' : 'Sable');
}

console.log('\nSable inside her');
{
  const c = at('cut');
  c.story.meters.sable = 5;
  const spec = S.battleSpec(c);
  const force = (t) => L.buildForce(spec.enemy, { campaign: c, tier: t, pl: 1, allowance: 0, readiness: 0, seed: 'x', compound: true }).picks;
  const t1 = force(1), t2 = force(2), t3 = force(3);
  const prof = (p) => R.profile(p.key) || {};
  ok('no vehicle of hers gets in', [t1, t2, t3].every((f) => f.every((p) => (prof(p).cls || 'infantry') === 'infantry')));
  ok('Tier I: no battle armour to be had, so Enforcers (not Recruits), her Guard among them', t1.every((p) => /^cmd|^enforcers$/.test(p.key)) && t1.some((p) => p.name === 'Sable’s Guard'), t1.map((p) => p.key).join(' '));
  ok('Tier II: battle armour, her Guard and the variants: cutters, machine guns, assault', t2.some((p) => p.name === 'Sable’s Guard' && p.key === 'ecobats') &&
    ['Sable cutting team', 'Sable machine-gun team', 'Sable assault team'].every((n) => t2.some((p) => p.name === n && p.key === 'ecobats')), t2.map((p) => p.name || p.key).join(', '));
  ok('Tier III: heavier battle armour besides', t3.some((p) => p.key === 'bats'));
  // on the table: each variant without its anti-tank weapon, and with what it has instead
  const { s } = started(c, (cfg) => {
    cfg.tier = 2;
    cfg.armyB = t2.map((p) => p.key);
    cfg.story.units.B = {};
    t2.forEach((p, i) => { const x = {}; ['name', 'rules', 'lose', 'mod'].forEach((k) => { if (p[k]) x[k] = p[k]; }); if (Object.keys(x).length) cfg.story.units.B[i] = x; });
  });
  const u = (n) => s.units.find((q) => q.side === 'B' && q.name === n);
  const cut = u('Sable cutting team'), mg = u('Sable machine-gun team'), as = u('Sable assault team'), guard = u('Sable’s Guard'), eco = R.profile('ecobats');
  ok('the cutting team: las-cutters (a Gauss Weapon), no anti-tank', cut && R.has(cut, 'Gauss Weapon') && !R.has(cut, 'Anti-tank'), cut && cut.rules.join(','));
  ok('the machine-gun team: Firepower +2, Range 24", no anti-tank', mg && mg.fp === eco.fp + 2 && mg.range === 24 && !R.has(mg, 'Anti-tank'), mg && mg.fp + '/' + mg.range);
  ok('the assault team: Assault +3, no anti-tank', as && as.assault === eco.assault + 3 && !R.has(as, 'Anti-tank'), as && String(as.assault));
  ok('...and her Guard as the book has them', guard && R.has(guard, 'Anti-tank') && guard.fp === eco.fp);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
