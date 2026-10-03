/* An online campaign played by two browsers (multiplayer plan, phase 3c): one
   player starts it and is given a code, the other joins with it; each founds
   their own force on their own screen; a contract is drawn up, each picks their
   force (the other's kept from them until both are ready), and both walk into
   the battle made from it. One walks away; the other is told, the campaign comes
   back up with the question the battle left them (Tough Negotiators), and once it
   is answered both read the aftermath and the campaign moves on a turn. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { ROOT, tmpData } = require('../where.js');

const PORT = 8800 + Math.floor(Math.random() * 400);
let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(150); up = await fetch('http://localhost:' + PORT + '/health').then((r) => r.ok).catch(() => false); }
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const URL = 'http://localhost:' + PORT + '/';
  async function player(name, pass) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate((a) => fetch('api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) }), { name: name, password: pass, email: name.replace(/\W/g, '').toLowerCase() + '@example.com' });
    await p.reload(); await p.waitForTimeout(800);
    return p;
  }
  const state = (p) => p.evaluate(() => { const o = window.PMC_CAMPAIGN.online(); return o ? { view: o.view, side: o.info.side, invite: o.info.invite, turn: o.camp.turn, A: o.camp.companies.A && o.camp.companies.A.name, B: o.camp.companies.B && o.camp.companies.B.name, k: o.camp.online && o.camp.online.contract, battle: o.camp.online && o.camp.online.battle, post: o.camp.post, after: o.camp.online && o.camp.online.after } : null; });
  const press = (p, sel) => p.evaluate((s) => { const e = document.querySelector('#camp-body ' + s); if (!e) return false; e.click(); return true; }, sel);
  const text = (p) => p.evaluate(() => document.getElementById('camp-body').innerText);
  async function till(p, what, pred, ms) {
    const stop = Date.now() + (ms || 15000);
    for (;;) {
      const s = await state(p);
      if (s && pred(s)) return s;
      if (Date.now() > stop) throw new Error('waited for ' + what + ': ' + JSON.stringify(s).slice(0, 300));
      await wait(150);
    }
  }
  async function found(p, name, units, doctrine, faction) {
    if (faction) await press(p, '[data-bfaction="' + faction + '"]');
    await p.evaluate((n) => { document.getElementById('found-name').value = n; }, name);
    for (const k of units) await press(p, 'button[data-add="' + k + '"]');
    await press(p, '[data-doc="' + doctrine + '"]');
    await press(p, '[data-go="dofound"]');
  }

  const p1 = await player('Ash Online', 'password one');
  const p2 = await player('Brann Online', 'password two');

  console.log('\nStarted, and joined with its code');
  await p1.evaluate(() => window.PMC_CAMPAIGN.enter('online'));
  for (let i = 0; i < 30 && !/Start an online campaign/i.test(await text(p1)); i++) await wait(100);
  ok('the online campaigns screen opens for a signed-in player', /Start an online campaign/i.test(await text(p1)));
  // started from Multiplayer's Start a game, the campaign picked from its list
  await p1.evaluate(() => { window.PMCLobby.open(); });
  await p1.waitForTimeout(800);
  await p1.evaluate(() => document.querySelector('#lobby [data-lob="create"]').click());
  await p1.waitForTimeout(200);
  const offered = await p1.evaluate(() => { const o = document.querySelector('#lob-kind option[value="ocamp"]'); return o && !o.disabled ? o.textContent : ''; });
  ok('Start a game offers a new online campaign', /Campaign/.test(offered), offered);
  await p1.evaluate(() => { const s = document.getElementById('lob-kind'); s.value = 'ocamp'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#lobby [data-lob="create"][data-go]').click(); });
  let s1 = await till(p1, 'the founding screen', (s) => s.view === 'found');
  ok('a new one opens on founding Player 1’s force, with a code for Player 2', s1.side === 'A' && /^[A-Z2-9]{8}$/.test(s1.invite || ''), JSON.stringify(s1).slice(0, 120));
  await found(p1, 'Iron Wolves', ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  s1 = await till(p1, 'the hub', (s) => s.view === 'hub' && s.A === 'Iron Wolves');
  const code = await p1.evaluate(() => { const c = document.querySelector('#camp-body .ocode'); return c ? c.textContent : ''; });
  ok('founded on the server; the hub shows the code for the open seat', code === s1.invite, code);
  ok('nothing of it is saved as this browser’s own campaign', await p1.evaluate(() => !window.PMC_CAMPAIGN.get()));

  await p2.evaluate(() => window.PMC_CAMPAIGN.enter('online'));
  await p2.waitForTimeout(600);
  await p2.evaluate((c) => { document.getElementById('ojoin-code').value = c.toLowerCase(); }, code);
  await press(p2, '[data-go="ojoin"]');
  let s2 = await till(p2, 'Player 2 founding', (s) => s.view === 'found' && s.side === 'B');
  ok('the second player joins with the code, as Player 2, and founds their own', s2.side === 'B' && /Iron Wolves has signed/.test(await text(p2)));
  await found(p2, 'Red Dawn', ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1', 'rebel');
  s2 = await till(p2, 'Player 2 hub', (s) => s.view === 'hub' && s.B === 'Red Dawn');
  ok('...a revolt, of their own choosing', await p2.evaluate(() => window.PMC_CAMPAIGN.online().camp.companies.B.faction === 'rebel'));
  s1 = await till(p1, 'Player 1 to hear of it', (s) => s.B === 'Red Dawn' && !s.invite);
  ok('Player 1’s screen hears of it by itself; the code is gone', !!s1);

  console.log('\nThe contract');
  await press(p1, '[data-go="contract"]');
  await p1.waitForTimeout(200);
  await press(p1, '[data-go="ocbegin"]');
  s1 = await till(p1, 'a contract', (s) => !!s.k);
  ok('Player 1 draws up a contract: the terms rolled on the server', s1.k.tier >= 1 && !!s1.k.scenario, s1.k.scenario && s1.k.scenario.name);
  if (s1.k.fore && !s1.k.fore.done) {
    // both hold Foresighted Command (not these two): set the dice aside in turn
    for (let i = 0; i < 2; i++) { await press(p1, '[data-ocforego="0"]'); await press(p2, '[data-ocforego="1"]'); await wait(800); }
  }
  await press(p1, '[data-go="ocauto"]');
  await press(p1, '[data-go="ocready"]');
  s1 = await till(p1, 'Player 1 ready', (s) => s.k && s.k.ready.A);
  ok('Player 1 picks a force and is ready', /You are ready/.test(await text(p1)));
  s2 = await till(p2, 'Player 2 to see the contract', (s) => s.k && s.k.ready.A);
  ok('Player 2 sees that Player 1 is ready, but not their force', s2.k.picks.A && s2.k.picks.A.hidden === true && !s2.k.picks.A.rids, JSON.stringify(s2.k.picks.A));
  await press(p2, '[data-go="contract"]');
  await p2.waitForTimeout(200);
  await press(p2, '[data-go="ocauto"]');
  await press(p2, '[data-go="ocready"]');

  console.log('\nThe battle');
  const onBoard = (p) => p.evaluate(() => { const st = window.PMC_STATE && window.PMC_STATE(); return !!(st && st.cfg && document.getElementById('camp').hidden); });
  let both = false;
  for (let i = 0; i < 80 && !both; i++) { await wait(250); both = (await onBoard(p1)) && (await onBoard(p2)); }
  ok('both ready: both players are taken into the battle made from the contract', both);
  const names = await p1.evaluate(() => { const st = window.PMC_STATE(); return [st.cfg.nameA, st.cfg.nameB]; });
  ok('...the two forces of the campaign', names[0] === 'Iron Wolves' && names[1] === 'Red Dawn', names.join(' v '));

  // Player 2 walks away: a forfeit, and in a campaign the aftermath is applied (decision 5)
  await p2.evaluate(() => window.PMCLobby.abandon());
  // the result card, read, gives way to the campaign
  for (let i = 0; i < 40; i++) {
    await wait(250);
    const r = await p1.evaluate(() => { const b = document.getElementById('res-continue'); if (b && !document.getElementById('resolution').hidden) { b.click(); return true; } return false; });
    if (r) break;
  }
  s1 = await till(p1, 'Player 1’s question after the battle', (s) => s.view === 'post' && s.post && s.post.steps[0] && s.post.steps[0].side === 'A', 20000);
  const t1 = await text(p1);
  ok('the other walks away: the campaign comes back up with Tough Negotiators for Player 1', /Tough Negotiators/i.test(t1), t1.slice(0, 200));
  s2 = await till(p2, 'Player 2 waiting', (s) => s.view === 'post', 20000);
  ok('...and Player 2 waits on it', /question to answer first/.test(await text(p2)));
  await press(p1, '[data-negdie="0"]');
  await press(p1, '[data-go="negotiate"]');
  await till(p1, 'the re-roll', (s) => s.post && s.post.pre.neg && s.post.pre.neg.A);
  ok('Player 1 re-rolls a die (on the server)', /Re-rolled/.test(await text(p1)));
  await press(p1, '[data-go="postnext"]');

  console.log('\nAfter it');
  s1 = await till(p1, 'Player 1’s aftermath', (s) => s.view === 'aftermath' && !s.post);
  ok('every question answered: Player 1 reads the aftermath, a win', s1.after && s1.after.winner === 'A' && s1.turn === 1, JSON.stringify(s1.after && s1.after.winner) + ' turn ' + s1.turn);
  s2 = await till(p2, 'Player 2’s aftermath', (s) => s.view === 'aftermath', 20000);
  ok('...and Player 2 reads theirs: their own force\u2019s page', s2.turn === 1 && /Red Dawn/.test(await p2.evaluate(() => document.getElementById('camp-title').textContent)), await p2.evaluate(() => document.getElementById('camp-title').textContent));
  await press(p2, '[data-go="pastback"]');
  await p2.waitForTimeout(300);
  ok('back on the hub, the next turn', (await state(p2)).view === 'hub');
  await press(p1, '[data-go="pastback"]');
  await p1.waitForTimeout(200);
  await press(p1, '.camp-foot [data-go="menu"]');
  await p1.waitForTimeout(300);
  ok('leaving it, the browser’s own campaign (none) is back', await p1.evaluate(() => !window.PMC_CAMPAIGN.online()));

  console.log('\nThe Continue list');
  await p1.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
  let orow = '';
  for (let i = 0; i < 30 && !orow; i++) { await wait(150); orow = await p1.evaluate(() => { const r = document.querySelector('#cont-list [data-cont^="o:"]'); return r ? r.textContent : ''; }); }
  ok('the main menu’s Continue lists the online campaign', /Online campaign/.test(orow) && /Player 1/.test(orow), orow);
  await p1.evaluate(() => document.querySelector('#cont-list [data-cont^="o:"]').click());
  const back1 = await till(p1, 'the campaign opened from the list', (s) => s.view === 'hub' || s.view === 'aftermath');
  ok('...and picking it opens it', back1.side === 'A' && back1.turn === 1, JSON.stringify(back1).slice(0, 120));

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
