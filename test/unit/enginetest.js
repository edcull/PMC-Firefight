/* Play whole battles through the headless engine, the way a pair of clients
   would: nothing but intents go in, and the battle has to reach a result.

   This is the net under the extraction. The turn structure used to be spliced
   into the drawing code in game.js and could only be exercised through a
   browser; here it is driven directly, so a rule that stops working is caught
   by `npm test` rather than by a game that wedges halfway through turn four. */
'use strict';
const { R, Engine } = require('../../server/rules.js');

let checks = 0, bad = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) return true;
  bad++;
  console.log('  FAIL ' + what + (detail ? ' — ' + detail : ''));
  return false;
}

/* A player with no judgement whatsoever: it takes the first legal thing on
   offer. That is enough to walk the whole turn structure, which is what is
   being tested — the decisions are the AI's business, and the AI has tests of
   its own in the battles below. */
function play(seed, opts) {
  opts = opts || {};
  const events = [];
  const e = Engine.create({
    log: (t, text) => events.push({ e: 'log', t, text }),
    card: (c) => events.push({ e: 'card', kind: c.kind }),
    fx: () => events.push({ e: 'fx' }),
    shoot: () => events.push({ e: 'shoot' }),
    assault: () => events.push({ e: 'assault' }),
    move: () => events.push({ e: 'move' })
  });

  const faction = opts.faction || 'pmc';
  const foe = opts.opFaction || 'rebel';
  e.start({
    tier: opts.tier || 3, pl: opts.pl || 1,
    scenario: opts.scenario || 'secure',
    armyA: R.rollArmy(opts.tier || 3, opts.pl || 1, null, faction),
    armyB: R.rollArmy(opts.tier || 3, opts.pl || 1, null, foe),
    nameA: 'Seat A', nameB: 'Seat B',
    colourA: 'ochre', colourB: 'steel',
    mode: opts.mode || 'hotseat',
    planet: opts.planet || 'sparse'
  });

  const seatOf = (side) => side;
  let guard = 0;

  /* ---- deployment: put every unit down, wherever the engine will take it ---- */
  while (e.state().phase === 'deploy' && guard++ < 4000) {
    const side = e.query.placingSide();
    if (!side) break;
    const u = e.query.deployNext();
    if (!u) break;
    const mid = e.query.zoneCentre(side);
    // walk out from the middle of the zone until something sticks
    let placed = false;
    for (let r = 0; r <= 20 && !placed; r += 1.5) {
      for (let k = 0; k < 12 && !placed; k++) {
        const a = (k / 12) * Math.PI * 2;
        const res = e.intent(seatOf(side), {
          k: 'deploy', id: u.id, x: mid.x + Math.cos(a) * r, y: mid.y + Math.sin(a) * r
        });
        if (res.ok && u.x >= 0) placed = true;
      }
    }
    if (!placed) { e.intent(seatOf(side), { k: 'autodeploy' }); }
  }
  ok('deployment finished', e.query.deploymentDone(), 'units still in hand');

  const starter = e.query.placingSide() || 'A';
  const began = e.intent(starter, { k: 'start' });
  ok('the battle begins', began.ok || e.state().phase === 'battle', began.why);

  /* ---- the battle ---- */
  guard = 0;
  while (!e.over() && guard++ < 6000) {
    const st = e.state();
    const sel = e.sel();

    // a unit is coming in: drop it on the first legal spot offered
    if (sel.insertion) {
      const ins = sel.insertion;
      const side = ins.unit ? ins.unit.side : 'A';
      const spot = (ins.spots || [])[0];
      const r = spot
        ? e.intent(side, { k: 'insert', x: spot.x, y: spot.y })
        : e.intent(side, { k: 'holdinsert' });
      if (!r.ok) { ok('insertion answered', false, r.why); break; }
      continue;
    }

    if (st.phase !== 'battle') break;
    const side = st.activeSide;
    const list = e.query.eligible(side);
    if (!list.length) { ok('an active side always has someone to act', false, side); break; }

    const u = list[0];
    const pick = e.intent(side, { k: 'select', id: u.id });
    if (!pick.ok) { ok('select works', false, pick.why); break; }

    /* Whether the battle actually moved on. An activation is the unit of
       progress here, not any one action: a unit with nothing useful to do
       still has to stop being eligible, or the turn never ends. */
    const was = mark(e);
    act(e, side, u);
    if (mark(e) === was) {
      /* A unit that is eligible to act but can do nothing that ends its
         activation stops the battle dead, so say everything about it here —
         it is rare enough that the next person to see it will not be able to
         reproduce it on demand. */
      const ids = Engine.STANDARD.map((a) => a.id).concat(e.query.specialsFor(u).map((a) => a.id));
      ok('every activation moves the battle on', false,
        [u.name + ' [' + u.side + '] turn ' + st.turn + ': nothing it could do ended its activation',
          '        selected: ' + (e.sel().selected ? e.sel().selected.name : 'nothing') +
          ' | chain: ' + JSON.stringify(st.chain) + ' | streak: ' + st.streak +
          ' | status: ' + R.status(u) + ' | rules: ' + u.rules.join('/')]
          .concat(ids.map((id) => {
            const a = e.query.actionState(u, id);
            return '        ' + (a.on ? 'ON  ' : '--  ') + id + ': ' + a.hint;
          })).join('\n'));
      break;
    }
  }

  ok('the battle reached a result', !!e.over(), 'stopped after ' + guard + ' activations');
  const rep = e.report();
  ok('a report was written', !!rep && Array.isArray(rep.units));
  return { engine: e, events, report: rep, turns: e.state().turn };
}

/* Where the battle has got to, as one comparable value. */
function mark(e) {
  const s = e.state();
  if (!s) return 'gone';
  return [s.turn, s.phase, s.activeSide, !!s.over, !!e.sel().insertion,
    s.units.filter((u) => u.activated).length,
    s.units.filter((u) => u.alive).length].join('/');
}

/* Take the first action that is on, and follow it through to a commitment.
   Regroup is last, because every unit can always do it and taking it first
   would mean nothing else ever got exercised. */
function act(e, side, u) {
  const ids = Engine.STANDARD.map((a) => a.id)
    .concat(e.query.specialsFor(u).map((a) => a.id))
    .filter((id) => id !== 'regroup')
    .concat(['regroup']);
  const start = mark(e);
  for (const id of ids) {
    if (!e.query.actionState(u, id).on) continue;
    const r = e.intent(side, { k: 'action', id: id });
    if (!r.ok) continue;
    if (mark(e) !== start) return true;              // it resolved on the spot
    if (commit(e, side)) return true;
    e.intent(side, { k: 'cancel' });
  }
  return false;
}

/* An action that asked for a target, a spot or a piece. */
function commit(e, side) {
  const sel = e.sel();
  if (sel.targets && sel.targets.length) {
    const t = sel.targets[0];
    return e.intent(side, { k: 'target', id: t.id }).ok;
  }
  if (sel.terrain && sel.terrain.length) {
    const i = e.state().terrain.indexOf(sel.terrain[0]);
    return e.intent(side, { k: 'piece', i: i }).ok;
  }
  if (sel.moves && sel.moves.length) {
    const kind = sel.mode === 'wave' ? 'wave'
      : sel.mode === 'disembark' ? 'disembark'
        : sel.mode === 'strafe' ? 'strafe'
          : sel.mode === 'designate' ? 'markmove' : 'move';
    const c = sel.moves[sel.moves.length - 1];
    return e.intent(side, { k: kind, x: c.x, y: c.y }).ok;
  }
  return false;
}

/* ---- the intents a player is not allowed to send ---- */
function refusals() {
  console.log('refusals');
  const e = Engine.create();
  e.start({
    tier: 2, pl: 1, scenario: 'secure',
    armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'pmc'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'barren'
  });
  const placing = e.query.placingSide();
  const other = placing === 'A' ? 'B' : 'A';
  ok('the other side cannot place during your deployment',
    !e.intent(other, { k: 'deploy', x: 6, y: 18 }).ok);
  ok('the battle cannot begin with units in hand',
    !e.intent(placing, { k: 'start' }).ok);
  ok('an unknown intent is refused',
    !e.intent(placing, { k: 'nonsense' }).ok);
  ok('a malformed intent is refused', !e.intent(placing, null).ok);

  e.intent('A', { k: 'autodeploy' });
  e.intent('B', { k: 'autodeploy' });
  const started = e.intent('A', { k: 'start' });
  ok('auto-deploy fills both sides', started.ok, started.why);

  const idle = e.state().activeSide === 'A' ? 'B' : 'A';
  const someone = e.query.eligible(e.state().activeSide)[0];
  ok('the side without the activation cannot act',
    !e.intent(idle, { k: 'select', id: someone.id }).ok);
}

/* ---- a battle survives being flattened and put back ---- */
function roundTrip() {
  console.log('snapshot round trip');
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'find',
    armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'bugs'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'crimson', mode: 'hotseat', planet: 'jungle'
  });
  e.intent('A', { k: 'autodeploy' });
  e.intent('B', { k: 'autodeploy' });
  e.intent('A', { k: 'start' });

  const snap = e.snapshot();
  let json;
  ok('the battle is JSON', (() => { try { json = JSON.stringify(snap); return true; } catch (err) { return false; } })());
  ok('and not an unreasonable size', json.length < 4e6, json.length + ' bytes');

  const mirror = Engine.create();
  mirror.load(JSON.parse(json));
  const a = e.state(), b = mirror.state();
  ok('same units', a.units.length === b.units.length);
  ok('same turn', a.turn === b.turn);
  ok('the scenario came back', !!b.scen && b.scen.id === a.scen.id);
  // the links that JSON cannot carry
  const hull = a.units.filter((u) => (u.cargo || []).length)[0];
  if (hull) {
    const twin = b.units.filter((u) => u.id === hull.id)[0];
    ok('cargo is relinked to units', twin.cargo.length === hull.cargo.length &&
      typeof twin.cargo[0] === 'object');
  }
  if (a.sc && a.sc.search) {
    ok('search spots point back at their terrain',
      b.sc.search.every((s) => !s.piece || b.terrain.indexOf(s.piece) >= 0));
  }
  ok('the mirror can answer questions about the table',
    mirror.query.eligible(b.activeSide).length === e.query.eligible(a.activeSide).length);
}

/* ---- the terrain laid by hand, one area at a time (pp. 46-47) ----
   Each area belongs to one side, and only that side may lay it — which is
   what makes the set-up playable across a network rather than only on the
   one screen. */
function terrainByHand() {
  console.log('terrain set-up by intent');
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'secure', terrainSetup: 'manual',
    armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'pmc'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'dense'
  });
  ok('a manual set-up opens on the terrain phase', e.state().phase === 'terrain');
  const first = e.query.terrainSide();
  const second = first === 'A' ? 'B' : 'A';
  ok('the first area belongs to a side', first === 'A' || first === 'B');
  ok('the other side may not lay it',
    !e.intent(second, { k: 'terrain', act: 'tauto' }).ok);
  ok('an unknown step is refused',
    !e.intent(first, { k: 'terrain', act: 'tflip' }).ok);

  // the snapshot carries no generator table, and the mirror finds it again
  const snap = JSON.parse(JSON.stringify(e.snapshot()));
  ok('the generator table does not travel', snap.tset && snap.tset.gen === undefined);
  const mirror = Engine.create();
  mirror.load(snap);
  ok('a mirror knows whose area it is', mirror.query.terrainSide() === first);
  ok('and has the generator back', !!mirror.state().tset.gen);

  // lay every area by the book's turn order, each by its own side
  let guard = 0;
  while (e.state().phase === 'terrain' && guard++ < 20) {
    const side = e.query.terrainSide();
    const r = e.intent(side, { k: 'terrain', act: 'tauto' });
    if (!r.ok) { ok('each area can be laid by its side', false, r.why); break; }
  }
  ok('the set-up hands over to deployment', e.state().phase === 'deploy');
  ok('four areas were rolled', e.state().tset.areas.every((a) => a.roll >= 1 && a.roll <= 6));
}

/* ---- buildings: garrisoned at deployment, and still garrisoned after the
   battle has crossed the wire ---- */
function garrisons() {
  console.log('garrisons');
  for (let attempt = 0; attempt < 30; attempt++) {
    const e = Engine.create();
    e.start({
      tier: 3, pl: 1, scenario: 'meeting',
      armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'pmc'),
      nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'dense'
    });
    const side = e.query.placingSide();
    const u = e.query.deployNext();
    if (!u || !e.query.garrisonable(u)) continue;
    // a building inside this side's own deployment ground
    const st = e.state();
    const b = st.terrain.filter((r) => {
      if (!R.enterable(r)) return false;
      const q = R.sectionsOf(r)[0];
      return e.query.deployOK(side, q.x + q.w / 2, q.y + q.h / 2, u);
    })[0];
    if (!b) continue;
    const q = R.sectionsOf(b)[0];
    const other = side === 'A' ? 'B' : 'A';
    ok('the other side cannot garrison your unit',
      !e.intent(other, { k: 'garrison', id: u.id, x: q.x + q.w / 2, y: q.y + q.h / 2 }).ok);
    const r = e.intent(side, { k: 'garrison', id: u.id, x: q.x + q.w / 2, y: q.y + q.h / 2 });
    ok('a unit can be set up inside a building', r.ok, r.why);
    ok('and holds it', R.occupant(st, b, 0) === u);

    // across the wire, a garrison must still be the building's occupant
    const mirror = Engine.create();
    mirror.load(JSON.parse(JSON.stringify(e.snapshot())));
    const ms = mirror.state();
    const mu = ms.units.filter((x) => x.id === u.id)[0];
    ok('the garrison names the very piece in the terrain list', ms.terrain.indexOf(mu.bld) >= 0);
    ok('so the mirror sees the building occupied', R.occupant(ms, mu.bld, 0) === mu);

    // put down on open ground again, it leaves the building
    const mid = e.query.zoneCentre(side);
    e.intent(side, { k: 'deploy', id: u.id, x: mid.x, y: mid.y });
    ok('deploying it elsewhere takes it out of the building', !u.bld);
    return;
  }
  ok('found a table with a building to garrison', false, 'no building in thirty tries');
}

/* ---- run ---- */
terrainByHand();
garrisons();
console.log('engine — whole battles, driven by intent');
refusals();
roundTrip();

const SCENARIOS = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
const FOES = ['pmc', 'rebel', 'bugs', 'xeno'];
SCENARIOS.forEach((scen, i) => {
  const opFaction = FOES[i % FOES.length];
  console.log('  ' + scen + ' vs ' + opFaction);
  const r = play(i, { scenario: scen, opFaction: opFaction, tier: 3, pl: 1 });
  ok(scen + ': the log was written', r.engine.state().log.length > 10);
  ok(scen + ': events reached the view', r.events.length > 10);
});

// the OpFor drives itself the same way, with nobody sending intents for side B
console.log('  vs the OpFor AI');
(function () {
  const e = Engine.create();
  e.start({
    tier: 3, pl: 1, scenario: 'meeting',
    armyA: R.rollArmy(3, 1, null, 'pmc'), armyB: R.rollArmy(3, 1, null, 'rebel'),
    nameA: 'A', nameB: 'OpFor', colourA: 'ochre', colourB: 'steel',
    mode: 'ai', planet: 'dense'
  });
  e.intent('A', { k: 'autodeploy' });
  ok('the OpFor deploys itself', e.query.deploymentDone());
  e.intent('A', { k: 'start' });
  ok('the OpFor took its turn without being asked',
    e.state().activeSide === 'A' || !!e.over() || !!e.sel().insertion);
})();

console.log((bad ? 'FAILED ' + bad + ' of ' : 'all ') + checks + ' checks' + (bad ? '' : ' passed'));
process.exit(bad ? 1 : 0);
