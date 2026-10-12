/* A hotseat campaign with AI forces: the online campaign's world, kept on this
   device (net/localworld.js). Two players at one screen found their forces, one
   takes a contract against an AI force and fights it on this table (the other AI
   forces fighting it out elsewhere), then challenges the other player; both draw
   the contract up in turn, fight it at the one table, and each reads their own
   aftermath. The battles are handed to the AI and ended by a forfeit (__concede). */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  let pass = 0, fail = 0;
  const ok = (name, cond, note) => { cond ? pass++ : fail++; console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : '')); };
  const wait = (ms) => p.waitForTimeout(ms);
  const press = (sel) => p.evaluate((s) => { const x = document.querySelector('#camp ' + s) || document.querySelector(s); if (!x || x.disabled) return false; x.click(); return true; }, sel);
  const closeNote = () => p.evaluate(() => { const c = document.querySelector('#camp-ask:not([hidden]) [data-ask]'); if (c) c.click(); });
  const st = () => p.evaluate(() => {
    const o = window.PMC_CAMPAIGN.online && window.PMC_CAMPAIGN.online(), id = Object.keys(JSON.parse(localStorage.getItem('pmc-worlds') || '{"rows":{}}').rows)[0];
    return { view: o && o.view, title: document.getElementById('camp-title').textContent, A: o && o.camp && o.camp.companies.A.name, seat: id ? window.PMCLocalWorld.seat(id) : null, shown: !document.getElementById('camp').hidden };
  });
  const world = () => p.evaluate(() => { const r = Object.values(JSON.parse(localStorage.getItem('pmc-worlds')).rows)[0]; return JSON.parse(r.state); });
  async function found(name, units, doc) {
    await p.evaluate((n) => { document.getElementById('found-name').value = n; }, name);
    for (const k of units) await press('button[data-add="' + k + '"]');
    await press('[data-doc="' + doc + '"]');
    await press('[data-go="dofound"]');
    await wait(700);
  }
  // the battle handed to the AI on both sides, and once it is under way one side walks away
  async function forfeit(side) {
    await p.evaluate(() => { const s = window.PMC_STATE(); s.cfg.aiSides = ['A', 'B']; const b3 = window.__beginButton(); if (b3) b3.click(); });
    for (let i = 0; i < 300; i++) { if ((await p.evaluate(() => { const s = window.PMC_STATE(); return s && s.phase; })) === 'battle') break; await wait(150); }
    await p.evaluate((sd) => window.__concede(sd), side);
    await wait(1500);
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await wait(1500);
  }
  async function pick() {
    for (let i = 0; i < 6; i++) { if (!(await press('[data-ocforego]'))) break; await wait(300); }
    await press('[data-go="ocauto"]'); await wait(200);
    await press('[data-go="ocready"]'); await wait(800);
  }

  try {
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    await wait(800);

    console.log('\nThe new campaign');
    await p.evaluate(() => { localStorage.removeItem('pmc-worlds'); window.PMC_CAMPAIGN.fresh('hotseat'); });
    await wait(300);
    ok('the hotseat form offers 0, 2, 4, 6 or 8 AI forces', (await p.evaluate(() => [...document.querySelectorAll('#camp-hotai option')].map((o) => o.value).join())) === '0,2,4,6,8');
    await p.evaluate(() => {
      const s = document.getElementById('camp-hotai'); s.value = '2'; s.dispatchEvent(new Event('change', { bubbles: true }));
      const f = document.getElementById('camp-bfaction'); f.value = 'rebel'; f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await wait(200);
    ok('...two AI rows, with their armies', (await p.evaluate(() => document.querySelectorAll('#camp-body select.rivarmy').length)) === 2);
    await press('[data-go="newcamp"]');
    await wait(700);
    let s = await st();
    ok('Raise the force: Player 1 founds first, in a world kept on this device', s.view === 'found' && s.seat === 0 && /^Player 1/.test(s.title), JSON.stringify(s));
    await found('Iron Wolves', ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    await closeNote(); await wait(200);
    s = await st();
    ok('...then the screen goes to Player 2, who founds theirs', s.view === 'found' && s.seat === 1 && /^Player 2/.test(s.title), JSON.stringify(s));
    await found('Red Dawn', ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1');
    s = await st();
    ok('...and their hub, with who is at the screen and the hand-over', s.view === 'hub' && s.A === 'Red Dawn' && await p.evaluate(() => /At the screen: Player 2/.test(document.getElementById('camp-body').innerText) && !!document.querySelector('#camp-body [data-go="oseat"]')), JSON.stringify(s));
    let W = await world();
    ok('the world: the two players and the two AI forces', W.slots.length === 4 && W.slots.filter((x) => x.kind === 'human').length === 2 && W.slots.filter((x) => x.kind === 'ai').length === 2);

    console.log('\nAgainst an AI force');
    await press('.hubtake [data-kind="rivals"]'); await wait(400);
    ok('Player 2 picks an AI force from the other forces: Contract', await press('.cmodal:not([hidden]) [data-oaicontract]'));
    await wait(600);
    await pick();
    await wait(800);
    const ai = await p.evaluate(() => { const x = window.PMC_STATE && window.PMC_STATE(); return x && x.cfg ? { mode: x.cfg.mode, local: !!x.cfg.localBattle, A: x.cfg.nameA, hidden: document.getElementById('camp').hidden } : null; });
    ok('...fought on this table, the AI playing the other side', ai && ai.mode === 'ai' && ai.local && ai.A === 'Red Dawn' && ai.hidden, JSON.stringify(ai));
    await forfeit('B');
    s = await st();
    ok('won: Player 2 reads their aftermath', s.view === 'aftermath' && s.seat === 1 && s.shown, JSON.stringify(s));
    W = await world();
    ok('...their turn on, and the other AI forces fought it out elsewhere', W.players[1].turn === 1 && W.players[0].turn === 0 && (W.players[1].after.elsewhere || []).length >= 1 && !(W.fronts || []).length);

    console.log('\nA contract between the two players');
    await press('[data-go="pastback"]'); await wait(400);
    await press('.hubtake [data-kind="rivals"]'); await wait(400);
    ok('Player 2 challenges Player 1 from the other forces', await press('.cmodal:not([hidden]) [data-ochallenge="0"]'));
    await wait(500);
    await press('[data-go="oseat"]'); await wait(600); await closeNote(); await wait(200);
    s = await st();
    ok('...hands over: Player 1 at the screen, the challenge waiting', s.seat === 0 && s.A === 'Iron Wolves' && !!(await p.evaluate(() => document.querySelector('#camp-body [data-ochaccept]'))), JSON.stringify(s));
    await press('[data-ochaccept]'); await wait(600);
    await press('[data-go="ocontract"]'); await wait(300);
    await pick();
    await press('[data-go="hub"]'); await wait(200);
    await press('[data-go="oseat"]'); await wait(600); await closeNote(); await wait(200);
    await press('[data-go="ocontract"]'); await wait(300);
    await pick();
    await wait(800);
    const duel = await p.evaluate(() => { const x = window.PMC_STATE && window.PMC_STATE(); return x && x.cfg ? { mode: x.cfg.mode, local: !!x.cfg.localBattle, names: [x.cfg.nameA, x.cfg.nameB].sort().join(' v ') } : null; });
    ok('both ready: the battle laid on this table, both players at it', duel && duel.mode === 'hotseat' && duel.local && duel.names === 'Iron Wolves v Red Dawn', JSON.stringify(duel));
    await forfeit('A');
    const seen = [];
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 6; i++) { if ((await st()).view === 'post') { await press('[data-go="postnext"]'); await wait(500); } }
      s = await st();
      if (s.view === 'aftermath') { seen.push(s.seat); await press('[data-go="pastback"]'); await wait(300); }
      if (seen.length === 2) break;
      await press('[data-go="oseat"]'); await wait(600); await closeNote(); await wait(200);
    }
    ok('each player answers their own questions and reads their own aftermath, handing over between', seen.sort().join() === '0,1', JSON.stringify(seen));
    W = await world();
    ok('...both turns on, the duel over', W.players[0].turn === 1 && W.players[1].turn === 2 && !(W.duels || []).length);

    console.log('\nA co-operative contract between the two players (p. 150)');
    // a legal commando out of the force at the screen, clicked unit by unit as a player would
    async function pickCommando() {
      const rids = await p.evaluate(() => {
        const SOLO = window.PMCSolo, R = window.PMC, o = window.PMC_CAMPAIGN.online(), co = o.camp.companies.A, k = o.camp.online.coop.contract;
        let picks = [];
        for (const e of co.roster) {
          if (e.restUntil > 0) continue;
          const next = picks.concat([e]), c = SOLO.checkCommando(next.map((x) => R.entryPick(x)), k.tier, 1, co.faction);
          if (c.faults.every((f) => /^Needs at least/.test(f))) picks = next;
          if (SOLO.checkCommando(picks.map((x) => R.entryPick(x)), k.tier, 1, co.faction).ok) break;
        }
        return picks.map((e) => e.rid);
      });
      for (const r of rids) { await press('[data-ocoopunit="' + r + '"]'); await wait(80); }
      await press('[data-go="ocoopready"]'); await wait(800);
      return rids;
    }
    s = await st();
    const asker = s.seat;
    await press('.hubtake [data-kind="rivals"]'); await wait(400);
    ok('a player offers the other a co-op contract from the other forces', await press('.cmodal:not([hidden]) [data-ocoopask="' + (1 - asker) + '"]'));
    await wait(500);
    await press('[data-go="oseat"]'); await wait(600); await closeNote(); await wait(200);
    ok('...hands over: the offer waiting for the other player', !!(await p.evaluate(() => document.querySelector('#camp-body [data-ocoopaccept]'))));
    await press('[data-ocoopaccept]'); await wait(600);
    const cv = await p.evaluate(() => document.getElementById('camp-body').innerText);
    ok('...accepted: the co-op contract, its scenario and the OpFor rolled', /The OpFor/.test(cv) && /Your commando/.test(cv), cv.slice(0, 120).replace(/\s+/g, ' '));
    const pB = await pickCommando();
    await press('[data-go="hub"]'); await wait(200);
    await press('[data-go="oseat"]'); await wait(600); await closeNote(); await wait(200);
    await press('[data-go="ocoop"]'); await wait(300);
    const pA = await pickCommando();
    await wait(800);
    const cb = await p.evaluate(() => { const x = window.PMC_STATE && window.PMC_STATE(); return x && x.cfg ? { coop: !!(x.cfg.solo && x.cfg.solo.coop), net: !!x.cfg.netCoop, local: !!x.cfg.localBattle, owners: (x.cfg.ownersA || []).join(''), b: x.cfg.armyB.length, nameB: x.cfg.nameB } : null; });
    ok('both ready: the co-op battle on this table, each player\u2019s units their own, against the OpFor', cb && cb.coop && !cb.net && cb.local && cb.nameB === 'OpFor' && cb.b > 0 &&
      cb.owners === '1'.repeat(asker === 0 ? pA.length : pB.length) + '2'.repeat(asker === 0 ? pB.length : pA.length), JSON.stringify(cb));
    const W0 = await world();
    await forfeit('A');
    const seen2 = [];
    for (let k = 0; k < 4; k++) {
      s = await st();
      if (s.view === 'aftermath') { seen2.push(s.seat); await press('[data-go="pastback"]'); await wait(300); }
      if (seen2.length === 2) break;
      await press('[data-go="oseat"]'); await wait(600); await closeNote(); await wait(200);
    }
    W = await world();
    ok('...each player reads their own aftermath, handing over between', seen2.sort().join() === '0,1', JSON.stringify(seen2));
    ok('...both turns on, both marked co-op and halved, the contract over', W.players[0].turn === W0.players[0].turn + 1 && W.players[1].turn === W0.players[1].turn + 1 &&
      W.players[0].after.coop && W.players[1].after.coop && W.players[0].after.payment.halved && !(W.coops || []).length);

    console.log('\nContinue');
    await p.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
    await wait(400);
    const row = await p.evaluate(() => { const r = document.querySelector('#cont-list [data-cont^="w:"]'); return r ? r.textContent : ''; });
    ok('the main menu’s Continue lists it', /Hotseat campaign/.test(row) && /4 forces/.test(row), row);
  } catch (e) {
    fail++; console.log('  ✗ ' + e.message);
  }
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
