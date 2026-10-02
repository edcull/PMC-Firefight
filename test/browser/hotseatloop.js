/* A whole hotseat campaign turn and the start of the next (the hotseat review,
   phase 4): both players draw up the contract, the battle is fought (handed to
   the AI on both sides to save time), each player answers their own post-battle
   questions with the device passed between them, each reads their own aftermath
   in turn, Player 2 goes on to their own dossier, the battle is on both records
   from each player's side, and the next contract can be drawn up. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.removeItem('pmc-campaign'); } catch (e) { } window.PMC_AFTER_RESULT = fn => setTimeout(fn, 50); });
  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }
  // the screen's heading is up in the top bar
  const body = () => p.evaluate(() => document.getElementById('camp-title').textContent + '\n' + document.getElementById('camp-body').innerText);
  async function click(sel) {
    const hit = await p.evaluate((s) => { const x = document.querySelector(s); if (!x || x.disabled) return false; x.click(); return true; }, sel);
    await p.waitForTimeout(220);
    return hit;
  }
  // the pass card on screen: whose it is, and tapping it
  const passTo = () => p.evaluate(() => { const x = document.querySelector('#camp-body .passcard'); return x ? x.getAttribute('data-seat') : null; });
  const tapPass = () => click('#camp-body .passcard');

  await click('#btn-campaign');
  await p.evaluate(() => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat', nameA: 'Task Force Ironhold', nameB: 'The Red Dawn', factionA: 'pmc', factionB: 'rebel' });
    C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    camp.companies.B = C.newCompany('The Red Dawn', { faction: 'rebel' });
    C.found(camp.companies.B, ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'S2');
    camp.companies.B.name = 'The Red Dawn'; camp.companies.B.colour = 'steel';
    camp.rivals = [camp.companies.B]; camp.facing = 0;
    window.PMC_CAMPAIGN.set(camp);
    // a battle with no attacker and defender, so neither side waits on insertion
    window.__realForesight = C.foresight;
    C.foresight = () => ({ scenario: { id: 'meeting', name: 'Meeting Engagement', roll: 1 } });
  });

  console.log('\nThe contract, both players');
  await click('#camp-body [data-go="contract"]');
  if (await passTo()) await tapPass();
  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());
  await p.waitForTimeout(150);
  await click('#camp-body button.start[data-go="fight"]');
  check('handed to Player 2 with a pass card', await passTo() === 'B');
  await tapPass();
  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());
  await p.waitForTimeout(150);
  await click('#camp-body button.start[data-go="fight"]');
  await p.waitForTimeout(1200);
  await p.evaluate(() => { const x = document.querySelector('#camp-askbox [data-ask="close"]'); if (x) x.click(); });
  await p.waitForTimeout(800);
  check('the battle started', await p.evaluate(() => !!window.PMC_STATE() && document.getElementById('camp').hidden));

  console.log('\nThe battle (the AI on both sides)');
  const settle = () => p.evaluate(() => {
    const r = document.getElementById('resolution');
    if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
    const h = document.querySelector('#handover button'); if (h) h.click();
  });
  for (let i = 0; i < 6; i++) { await settle(); await p.waitForTimeout(200); }
  await p.waitForFunction(() => { const s = window.PMC_STATE(); return s && s.phase !== 'terrain' && !(s.swapAvail && (s.swapAvail.A || s.swapAvail.B)); }, null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    if (s.swapAvail) { ['A', 'B'].forEach(sd => { if (s.swapAvail[sd]) window.__sendIntent({ k: 'swapdone', side: sd }); }); }
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => { if (document.querySelector('[data-act="deployready"]')) window.__sendIntent({ k: 'deployready' }); window.__autoDeployBoth(); });
  await p.waitForTimeout(500);
  for (let i = 0; i < 4; i++) { await settle(); await p.waitForTimeout(200); }
  await p.evaluate(() => { const s = window.PMC_STATE(); s.cfg.aiSides = ['A', 'B']; const b3 = window.__beginButton(); if (b3) b3.click(); });
  let over = false;
  for (let i = 0; i < 3000 && !over; i++) {
    over = await p.evaluate(() => {
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      const s = window.PMC_STATE(); return !!(s && s.over);
    });
    if (!over) await p.waitForTimeout(110);
  }
  check('the battle reached a result', over, await p.evaluate(() => { const s = window.PMC_STATE(); return 'phase ' + s.phase + ', turn ' + s.turn; }));
  for (let i = 0; i < 12; i++) {
    if (await p.evaluate(() => !document.getElementById('camp').hidden)) break;
    await settle(); await p.waitForTimeout(400);
  }
  const winner = await p.evaluate(() => { const l = window.PMC_CAMPAIGN.get().log; return l.length ? l[l.length - 1].winner : (window.PMC_CAMPAIGN.get().post || {}).report && window.PMC_CAMPAIGN.get().post.report.winner; });

  console.log('\nPost-battle questions, each player\'s together');
  check('the device goes to Player 1 for their Tough Negotiators', await passTo() === 'A', await body());
  await tapPass();
  let t = await body();
  check('...then Player 1\'s dice', /Tough Negotiators/i.test(t) && /Task Force Ironhold/.test(t), t.slice(0, 300));
  await click('#camp-body [data-go="negkeep"], #camp-body [data-go="postnext"]');
  if (/Tough Negotiators/.test(await body()) && !(await passTo())) {
    // kept without re-rolling: the button may be labelled otherwise
    await p.evaluate(() => { const x = [...document.querySelectorAll('#camp-body button')].find(b => /keep/i.test(b.textContent)); if (x) x.click(); });
    await p.waitForTimeout(220);
  }
  check('the device goes to Player 2 for theirs', await passTo() === 'B', await body());
  await tapPass();
  t = await body();
  check('...then Player 2\'s dice', /Tough Negotiators/i.test(t) && /The Red Dawn/.test(t));
  await p.evaluate(() => { const x = [...document.querySelectorAll('#camp-body button')].find(b => /keep/i.test(b.textContent)) || document.querySelector('#camp-body [data-go="postnext"]'); if (x) x.click(); });
  await p.waitForTimeout(400);

  console.log('\nEach player\'s aftermath in turn (HC-4, HC-5)');
  check('the device goes back to Player 1 for their aftermath', await passTo() === 'A', await body());
  await tapPass();
  t = await body();
  check('Player 1\'s aftermath: their payment and their force', /Aftermath — Task Force Ironhold/.test(t) && /The (company|force)/i.test(t), t.slice(0, 300));
  check('...and on to Player 2\'s, not the dossier', await p.evaluate(() => !!document.querySelector('#camp-body [data-go="afternext"]') && !document.querySelector('#camp-body [data-go="roster"]')));
  await click('#camp-body [data-go="afternext"]');
  check('the device goes to Player 2', await passTo() === 'B');
  await tapPass();
  t = await body();
  const paidB = await p.evaluate(() => window.PMC_CAMPAIGN.get().log.slice(-1)[0].kUC.B);
  check('Player 2\'s aftermath: their own payment and units', /Aftermath — The Red Dawn/.test(t) && t.indexOf('+' + paidB) >= 0 && /rciv|Civilian|Militia|Riders/i.test(t), t.slice(0, 300));
  const rolls = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get(), l = c.log.slice(-1)[0];
    return { balances: l.balances, A: c.companies.A.kUC, B: c.companies.B.kUC };
  });
  check('both balances are kept on the battle\'s line', !!rolls.balances && rolls.balances.A === rolls.A && rolls.balances.B === rolls.B, JSON.stringify(rolls));
  await click('#camp-body [data-go="roster"]');
  const hub = await p.evaluate(() => ({ text: document.getElementById('camp-body').innerText, p2: !!document.querySelector('[data-go="hubside"][data-hs="B"].on') }));
  check('Dossier opens Player 2\'s own', hub.p2 && /The Red Dawn/.test(hub.text), hub.text.slice(0, 200));

  console.log('\nThe records, from each side (HC-13)');
  const rec = await p.evaluate(() => {
    const row = () => { const r = document.querySelector('#camp-body .clog .crow em'); return r ? r.textContent : null; };
    const vs = () => { const r = document.querySelector('#camp-body .clog .crow small'); return r ? r.textContent : null; };
    const out = {};
    for (const sd of ['B', 'A']) {
      document.querySelector('[data-go="hubside"][data-hs="' + sd + '"]').click();
      document.querySelector('[data-go="fmodal"][data-kind="battles"]').click();
      out[sd] = { result: row(), vs: vs() };
    }
    return out;
  });
  const want = sd => !winner ? 'drawn' : winner === sd ? 'won' : 'lost';
  check('Player 2\'s Battles fought: their result, against Player 1', rec.B.result === want('B') && rec.B.vs === 'vs Task Force Ironhold', JSON.stringify(rec) + ' winner ' + winner);
  check('Player 1\'s: theirs, against Player 2', rec.A.result === want('A') && rec.A.vs === 'vs The Red Dawn');
  const past = await p.evaluate(() => {
    document.querySelector('[data-go="hubside"][data-hs="B"]').click();
    document.querySelector('[data-go="fmodal"][data-kind="battles"]').click();
    const r = document.querySelector('#camp-body .clog [data-go="pastbattle"]'); if (!r) return null;
    r.click(); return document.getElementById('camp-title').textContent + '\n' + document.getElementById('camp-body').innerText;
  });
  check('a past aftermath, opened by Player 2, is Player 2\'s', !!past && /Aftermath — turn 1 — The Red Dawn/.test(past), past && past.slice(0, 200));
  await click('#camp-body [data-go="pastback"]');
  await click('#camp-body [data-go="hub"]');

  console.log('\nThe next contract');
  await p.evaluate(() => window.PMC_CAMPAIGN.open('hub'));
  await p.waitForTimeout(200);
  await click('#camp-body [data-go="contract"]');
  if (await passTo()) await tapPass();
  const k = await p.evaluate(() => { const k = window.PMC_CAMPAIGN.contract(); return k && { side: k.side || 'A', turn: window.PMC_CAMPAIGN.get().turn }; });
  check('a fresh contract for campaign turn 2, Player 1 first', !!k && k.side === 'A' && k.turn === 1, JSON.stringify(k));

  check('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  if (problems.length) { console.log('\nFAILED: ' + problems.join('; ')); process.exit(1); }
  console.log('\nall good');
})();
