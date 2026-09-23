/* The campaign rules that were on the books but did nothing, played through the
   page: Rapid Relocation, NOT ONE STEP BACKWARDS!, Bloodlust, Semper Fidelis. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }
async function drain(p) {
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(120);
}
/* The table plays what has happened before it takes the next order: a tap made
   while it is still animating the last one waits its turn behind it. So wait
   for the table to be still before driving it. */
async function settle(p) {
  await p.waitForFunction(() => !window.__busy() && window.__showQueue() === 0, null, { timeout: 15000 }).catch(() => {});
}
/* Play the rest of the turn out. There is no hook to run the reserve phase on
   its own any more: it opens the next turn, inside the engine, so the turn is
   brought to an end the way a player would end it. Everyone but one of ours
   has already acted, and that one regroups; the rally and end phases follow,
   the next turn begins, and its reserve phase runs. `from` puts the turn
   counter back first, so the turn that begins is the one the check is about. */
async function endTurn(p, from) {
  await settle(p);
  return await p.evaluate((from) => {
    const s = window.PMC_STATE();
    const last = s.units.find(u => u.side === 'A' && u.alive && u.x >= 0 && !u.reserve && !u.aboard &&
      window.PMC.status(u) !== 'broken');
    if (!last) return { none: true };
    if (from) s.turn = from;
    s.units.forEach(u => { u.activated = u !== last; });
    s.activeSide = 'A'; s.streak = 1; s.chain = null;
    const was = s.turn;
    const acted = window.__select(last) && window.__pressAction('regroup');
    return { from: was, acted: acted };
  }, from || 0);
}
// the new turn's cards read, and the table still, before looking at what it asks
async function afterTurn(p) {
  await p.waitForTimeout(600);
  await drain(p);
  await settle(p);
  await p.waitForTimeout(300);
}
async function newGame(p, cfg) {
  await p.evaluate((c) => window.PMC_NEWGAME(c), Object.assign({
    tier: 3, pl: 1, mode: 'ai', planet: 'barren', scenario: 'meeting',
    nameA: 'Ours', nameB: 'Theirs',
    armyA: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'regular'],
    armyB: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'regular']
  }, cfg || {}));
  await p.waitForTimeout(900);
  await drain(p);
}
async function start(p) {
  await p.evaluate(() => { window.__autoDeployBoth(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { const b = document.querySelector('button[data-act="start"]'); if (b) b.click(); });
  await p.waitForTimeout(500);
  await drain(p);
  await settle(p);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  /* ------------------------------------------------------ Rapid Relocation */
  head('Rapid Relocation (O3)');
  await newGame(p, { doctrines: { A: ['O3'], B: ['O3'] } });
  await start(p);
  const rl = await p.evaluate(() => window.__relocating());
  ok('after deployment the player is asked to relocate', !!rl && rl.side === 'A', rl ? 'up to ' + rl.cap : 'not asked');
  ok('...up to half the units on the table', rl && rl.cap === 3, rl && rl.cap);
  const card = await p.evaluate(() => document.getElementById('context').innerText);
  ok('...with a card that says so', /Rapid Relocation/.test(card));
  ok('...and the OpFor has already had its turn at it', await p.evaluate(() => !!window.PMC_STATE().relocDone.B));
  const moved = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const out = [];
    const mine = s.units.filter(u => u.side === 'A' && u.x >= 0 && !u.aboard);
    function spotFor(u) {
      for (let x = 1; x < 60; x += 1.3) for (let y = 1; y < 44; y += 1.3) {
        if (!window.__deployOK(x, y, 'A')) continue;
        if (Math.hypot(x - u.x, y - u.y) < 5) continue;
        if (s.units.some(o => o !== u && o.alive && o.x >= 0 && Math.hypot(o.x - x, o.y - y) < 2.2)) continue;
        return { x, y };
      }
      return null;
    }
    for (let i = 0; i < 4; i++) {
      const u = mine[i];
      const was = { x: u.x, y: u.y };
      document.querySelector('#context [data-deploy="' + u.id + '"]').click();
      const q = spotFor(u);
      window.__boardTapAt(q.x, q.y);
      out.push(Math.hypot(u.x - was.x, u.y - was.y) > 1);
    }
    // and the first one again
    const u0 = mine[0], w0 = { x: u0.x, y: u0.y };
    document.querySelector('#context [data-deploy="' + u0.id + '"]').click();
    const q0 = spotFor(u0); window.__boardTapAt(q0.x, q0.y);
    return { moved: out, again: Math.hypot(u0.x - w0.x, u0.y - w0.y) > 1, state: window.__relocating() };
  });
  ok('three units can be picked up and set down elsewhere', moved.moved.slice(0, 3).every(Boolean), moved.moved.join(' '));
  ok('...but not a fourth', moved.moved[3] === false);
  ok('...and no unit moves twice', moved.again === false);
  const clicked = await p.evaluate(() => { const b = document.querySelector('button[data-act="start"]'); if (b) { b.click(); return true; } return false; });
  await p.waitForTimeout(500);
  await drain(p);
  ok('beginning the battle ends the relocation', await p.evaluate(() => !window.__relocating() && window.PMC_STATE().phase === 'battle'));

  /* ------------------------------------------------ NOT ONE STEP BACKWARDS! */
  head('NOT ONE STEP BACKWARDS! (T5)');
  await newGame(p, { doctrines: { A: ['T5'], B: [] } });
  await start(p);
  const t5 = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.terrain = [];                       // a clear table: this is about the rule, not the ground
    s.activeSide = 'A';
    const cmd = s.units.find(u => u.side === 'A' && u.code === 'CM3');
    const friend = s.units.find(u => u.side === 'A' && u.key === 'regular');
    friend.x = cmd.x + 6; friend.y = cmd.y; friend.sp = 4;
    s.units.forEach(u => { if (u !== cmd && u !== friend && u.side === 'A' && Math.hypot(u.x - cmd.x - 3, u.y - cmd.y) < 2) u.y += 4; });
    cmd.activated = false;
    window.__select(cmd);
    const specials = window.__specials();
    const before = friend.models;
    const pressed = window.__pressAction('steady');
    const tapped = window.__tapUnit(friend);
    return { specials, pressed, tapped, sp: friend.sp, lost: before - friend.models, done: cmd.activated };
  });
  ok('a Command Unit is offered the action', t5.specials.indexOf('steady') >= 0, t5.specials.join(' '));
  ok('...and can aim it at a suppressed friend', t5.pressed && t5.tapped);
  ok('the friend ends with no more Suppression than it had', t5.sp <= 4, '4 → ' + t5.sp);
  ok('...any losses are the dice, not a rule against them', t5.lost >= 0, t5.lost + ' lost');
  ok('...and the shot is the activation', t5.done);
  await drain(p);

  /* ---------------------------------------------------------------- Bloodlust */
  head('Bloodlust');
  await newGame(p, {});
  await start(p);
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A';
    const u = s.units.find(x => x.side === 'A' && x.code === 'HMG');
    const e = s.units.find(x => x.side === 'B' && x.key === 'regular');
    u.camp = { flags: { bloodlust: true }, once: {} };
    u.sp = 0; u.activated = false;
    e.x = u.x + 4; e.y = u.y;
  });
  await settle(p);
  const bl = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.side === 'A' && x.code === 'HMG');
    const e = s.units.find(x => x.side === 'B' && x.key === 'regular');
    window.__select(u);
    const near = { fire: window.__actionState('fire').on, assault: window.__actionState('assault').on,
      forced: window.__forcedCharge(u) === e.id };
    s.units.forEach(x => { if (x.side === 'B') { x.x = 58; x.y = 40; } });
    return { near };
  });
  // a selection made while the table is still animating the last one waits its turn
  await settle(p);
  bl.far = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.side === 'A' && x.code === 'HMG');
    window.__select(u);
    return { fire: window.__actionState('fire').on || window.__actionState('move').on, forced: window.__forcedCharge(u) };
  });
  ok('with an enemy in reach, the only thing it may do is charge', !bl.near.fire && bl.near.assault);
  ok('...the closest enemy, Cumbersome Weapon or not', bl.near.forced);
  ok('with nobody in reach it acts normally', bl.far.fire && !bl.far.forced);

  /* ------------------------------------------------------------ Semper Fidelis */
  head('Semper Fidelis');
  await newGame(p, { scenario: 'takeover', roles: { attacker: 'A', defender: 'B' },
    armyA: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'regular', 'regular', 'veterans'] });
  await start(p);
  const sfCode = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const u = s.units.find(x => x.side === 'A' && x.reserve && x.wave === 2);
    if (!u) return null;
    u.camp = { flags: { semperFidelis: true }, once: {} };
    s.terrain = s.terrain.filter(t => t.kind === 'objective' || t.kind === 'searchsite');
    return u.id;
  });
  let sf = { none: true };
  if (sfCode) {
    // play turn 1 out: turn 2's reserve phase is where the honour is offered
    await endTurn(p, 1);
    await afterTurn(p);
    const ask = await p.evaluate(() => window.__insertionState());
    const card = await p.evaluate(() => document.getElementById('context').innerText);
    await p.evaluate(() => { const btn = document.querySelector('[data-act="holdarrive"]'); if (btn) btn.click(); });
    await p.waitForTimeout(600);
    await settle(p);
    const held = await p.evaluate((id) => window.PMC_STATE().units.find(x => x.id === id).reserve, sfCode);
    // turn 2 over again: the scenario's wave is still a turn off, so only the honour offers it
    await endTurn(p, 1);
    await afterTurn(p);
    const again = await p.evaluate(() => window.__insertionState());
    await p.evaluate((id) => {
      const u = window.PMC_STATE().units.find(x => x.id === id);
      const spots = window.__arrivalSpots(u);
      if (spots.length) window.__boardTapAt(spots[0].x, spots[0].y);
    }, sfCode);
    await p.waitForTimeout(600);
    const arrived = await p.evaluate((id) => { const u = window.PMC_STATE().units.find(x => x.id === id); return !u.reserve && u.x >= 0; }, sfCode);
    sf = { ask, sfCard: /Semper Fidelis/.test(card), held, again, arrived: !!again && arrived };
  }
  ok('a Semper Fidelis unit in the second wave is offered on turn 2', !sf.none && sf.ask && sf.ask.kind === 'arrive', JSON.stringify(sf.ask));
  ok('...on a card that names the honour', sf.sfCard);
  ok('...and it may be kept back', sf.held);
  ok('...and brought on the next time it is offered', sf.arrived,
    sf.again ? (sf.arrived ? 'called in' : 'offered again, but the tap on the shaded ground did not put it down') : 'not offered again');
  await drain(p);

  // the transport clause: the hull comes too, but only with the honoured unit alone aboard
  await newGame(p, { scenario: 'takeover', roles: { attacker: 'A', defender: 'B' },
    armyA: ['cmd3', 'regular', 'veterans', 'hmgteam', 'engineers', 'regular', 'lapc', 'regular'] });
  await start(p);
  const vehCode = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const veh = s.units.find(x => x.side === 'A' && x.key === 'lapc');
    const pax = s.units.filter(x => x.side === 'A' && x.key === 'regular' && x !== veh);
    s.units.forEach(x => { if (x.side === 'A' && x.reserve) { x.reserve = false; x.wave = 0; } });
    veh.reserve = true; veh.wave = 2; veh.x = -1; veh.y = -1; veh.cargo = [pax[0]];
    pax[0].aboard = veh.id; pax[0].reserve = false; pax[0].x = -1; pax[0].y = -1;
    pax[0].camp = { flags: { semperFidelis: true }, once: {} };
    return veh.code;
  });
  await endTurn(p, 1);
  await afterTurn(p);
  const one = await p.evaluate(() => window.__insertionState());
  const tcard = await p.evaluate(() => document.getElementById('context').innerText);
  await p.evaluate(() => { const btn = document.querySelector('[data-act="holdarrive"]'); if (btn) btn.click(); });
  await p.waitForTimeout(600);
  await settle(p);
  // a second passenger: now the hull no longer comes on the honour
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    const veh = s.units.find(x => x.side === 'A' && x.key === 'lapc');
    const pax = s.units.filter(x => x.side === 'A' && x.key === 'regular' && x !== veh);
    veh.cargo.push(pax[1]); pax[1].aboard = veh.id; pax[1].x = -1; pax[1].y = -1;
  });
  await endTurn(p, 1);
  await afterTurn(p);
  const two = await p.evaluate(() => window.__insertionState());
  const sft = { one, named: /aboard/.test(tcard), two, vehCode };
  ok('a transport carrying only a Semper Fidelis unit is offered with it', sft.one && sft.one.unit === sft.vehCode, JSON.stringify(sft.one));
  ok('...and the card names who is aboard', sft.named);
  ok('...but not once anyone else is riding in it', !sft.two, JSON.stringify(sft.two));
  await drain(p);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
