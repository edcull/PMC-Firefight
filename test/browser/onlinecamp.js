/* An online campaign, a world of forces, played by two browsers: one player starts
   it from Multiplayer and lands in its lobby (slots, an AI force's army, colours,
   the chat); the other joins it from the Multiplayer list, picks their army and
   says they are ready; the host starts it. Each founds their own force. One takes
   a contract against an AI force from the offers, fights it on the server (the AI
   side played there) and walks away; the aftermath comes up. Then one challenges
   the other, the contract is drawn up once accepted, both walk into the battle,
   one walks away, and each reads the aftermath as their own. */
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
  const state = (p) => p.evaluate(() => {
    const o = window.PMC_CAMPAIGN.online();
    if (!o) return null;
    const c = o.camp || {}, on = c.online || {};
    return { view: o.view, phase: o.info.phase, slot: o.info.slot, turn: c.turn, A: c.companies && c.companies.A && c.companies.A.name,
      B: c.companies && c.companies.B && c.companies.B.name, k: on.contract, duel: on.duel, battle: on.battle, post: c.post, after: on.after,
      challenges: on.challenges || [], offers: (c.offers || []).length, rivals: (c.rivals || []).map((r) => r.name) };
  });
  const press = (p, sel) => p.evaluate((s) => { const e = document.querySelector('#camp-body ' + s); if (!e) return false; e.click(); return true; }, sel);
  const choose = (p, sel, v) => p.evaluate((a) => { const e = document.querySelector('#camp-body ' + a.s); if (!e) return false; e.value = a.v; e.dispatchEvent(new Event('change', { bubbles: true })); return true; }, { s: sel, v: v });
  const text = (p) => p.evaluate(() => document.getElementById('camp-body').innerText);
  async function till(p, what, pred, ms) {
    const stop = Date.now() + (ms || 20000);
    for (;;) {
      const s = await state(p);
      if (s && pred(s)) return s;
      if (Date.now() > stop) throw new Error('waited for ' + what + ': ' + JSON.stringify(s).slice(0, 300));
      await wait(200);
    }
  }
  async function found(p, name, units, doctrine, faction) {
    if (faction) await press(p, '[data-bfaction="' + faction + '"]');
    await p.evaluate((n) => { document.getElementById('found-name').value = n; }, name);
    for (const k of units) await press(p, 'button[data-add="' + k + '"]');
    await press(p, '[data-doc="' + doctrine + '"]');
    await press(p, '[data-go="dofound"]');
  }
  // the contract screen: Foresighted Command's dice set aside if they are out, a force picked for me, and ready
  async function fightWithPicked(p) {
    for (let i = 0; i < 4; i++) { if (!(await press(p, '[data-ocforego]'))) break; await p.waitForTimeout(400); }
    await press(p, '[data-go="ocauto"]');
    await p.waitForTimeout(150);
    await press(p, '[data-go="ocready"]');
  }
  // the questions after a battle answered as they come (here, keep the dice), until the aftermath is up
  async function throughPost(p, what) {
    const stop = Date.now() + 30000;
    for (;;) {
      const st = await state(p);
      if (st && st.view === 'aftermath' && !st.post) return st;
      if (st && st.view === 'post') await press(p, '[data-go="postnext"]');
      if (Date.now() > stop) throw new Error('waited for ' + what + ': ' + JSON.stringify(st).slice(0, 300));
      await wait(400);
    }
  }
  const onBoard = (p) => p.evaluate(() => { const st = window.PMC_STATE && window.PMC_STATE(); return !!(st && st.cfg && document.getElementById('camp').hidden); });
  const slotCount = (p) => p.evaluate(() => document.querySelectorAll('#camp-body .olob-slot').length);

  const p1 = await player('Ash Online', 'password one');
  const p2 = await player('Brann Online', 'password two');

  try {
    console.log('\nThe lobby');
    await p1.evaluate(() => { window.PMCLobby.open(); });
    await p1.waitForTimeout(800);
    await p1.evaluate(() => document.querySelector('#lobby [data-lob="create"]').click());
    await p1.waitForTimeout(200);
    await p1.evaluate(() => { document.querySelector('#lobby [data-kind="ocamp"]').click(); document.querySelector('#lobby [data-lob="create"][data-go]').click(); });
    let s1 = await till(p1, 'the lobby', (s) => s.view === 'olobby');
    let t1 = await text(p1);
    const code = await p1.evaluate(() => { const c = document.querySelector('#camp-title .olob-code'); return c ? c.textContent : ''; });
    ok('Start a game → Campaign opens the campaign’s lobby, its code in the title bar', /^[A-Z2-9]{8}$/.test(code) && !/Give the others this code/.test(t1), code);
    ok('...its Back in the title bar, to the Multiplayer screen (no list of online campaigns any more)', await p1.evaluate(() => { const b = document.getElementById('camp-back'); return !b.hidden && b.getAttribute('data-go') === 'omulti' && !document.querySelector('#camp-body [data-go="olist"]'); }));
    ok('the title bar is the join code alone; the name in a field under it', await p1.evaluate(() => document.getElementById('camp-title').textContent === document.querySelector('#camp-title .olob-code').textContent && /campaign/i.test(document.getElementById('olob-name').value)));
    await p1.evaluate(() => { const n = document.getElementById('olob-name'); n.value = 'The Long War'; n.dispatchEvent(new Event('change', { bubbles: true })); });
    let named = false;
    for (let i = 0; i < 20 && !named; i++) { await wait(200); named = await p1.evaluate(() => document.getElementById('olob-name').value === 'The Long War' && !document.querySelector('#camp-ask:not([hidden])')); }
    ok('the host renames the campaign there', named);
    const lay = await p1.evaluate(() => { const bar = document.querySelector('#camp-body .olob-bar'); const b = document.getElementById('camp-body').getBoundingClientRect(), c = document.querySelector('#camp-body .olob-chat').getBoundingClientRect(), l = document.querySelector('#camp-body .olob-lines');
      return { bar: !!(bar && bar.querySelector('#olob-n') && bar.querySelector('#olob-pub') && bar.querySelector('[data-go="olobready"]')), chatLow: b.bottom - c.bottom < 80, lines: l.getBoundingClientRect().height }; });
    ok('...forces, public and the host\u2019s Ready on one row; the chat at the foot, three lines at the least', lay.bar && lay.chatLow && lay.lines >= 50, JSON.stringify(lay));
    ok('...four slots: the host, one open, two AI forces', (await slotCount(p1)) === 4 && /Open — waiting for a player/.test(t1) && (t1.match(/AI force/g) || []).length >= 2);
    await choose(p1, '#olob-n', '6');
    for (let i = 0; i < 30 && (await slotCount(p1)) !== 6; i++) await wait(150);
    ok('the forces: 2, 4, 6, 8 or 10', (await p1.evaluate(() => [...document.querySelectorAll('#olob-n option')].map((o) => o.value).join())) === '2,4,6,8,10' && (await slotCount(p1)) === 6);
    await choose(p1, '#olob-n', '4');
    for (let i = 0; i < 30 && (await slotCount(p1)) !== 4; i++) await wait(150);
    ok('...and back to four', (await slotCount(p1)) === 4);
    // a slot made an AI force with its checkbox, and open again
    const tick = (on) => p1.evaluate((v) => { const c = document.querySelector('#camp-body [data-olob-ai="1"]'); c.checked = v; c.dispatchEvent(new Event('change', { bubbles: true })); }, on);
    await tick(true);
    let aied = false;
    for (let i = 0; i < 20 && !aied; i++) { await wait(200); aied = await p1.evaluate(() => !!document.querySelector('#camp-body [data-olob-army="1"]') && !/Open \u2014 waiting/.test(document.querySelectorAll('#camp-body .olob-slot')[1].innerText)); }
    ok('the host ticks AI: the slot is an AI force, with its army to pick', aied);
    await tick(false);
    let opened = false;
    for (let i = 0; i < 20 && !opened; i++) { await wait(200); opened = await p1.evaluate(() => /Open \u2014 waiting/.test(document.querySelectorAll('#camp-body .olob-slot')[1].innerText)); }
    ok('...and unticks it: open for a player again', opened);
    await choose(p1, '[data-olob-army="2"]', 'bugs');
    await p1.waitForTimeout(600);
    ok('...and picks the AI force’s army', await p1.evaluate(() => document.querySelector('#camp-body [data-olob-army="2"]').value === 'bugs'));
    // the AI force's colour, from the colour grid: the colours the other slots wear are greyed out
    await press(p1, '[data-olob-pick="2"]');
    await p1.waitForTimeout(200);
    const grid = await p1.evaluate(() => ({ n: document.querySelectorAll('#camp-body .olob-pop [data-olob-col]').length, ochre: (document.querySelector('#camp-body .olob-pop [data-olob-col="ochre"]') || {}).disabled }));
    ok('the colour chip opens the colours, those another player wears greyed out', grid.n > 10 && grid.ochre === true, JSON.stringify(grid));
    await press(p1, '.olob-pop [data-olob-col="lime"]');
    let limed = false;
    for (let i = 0; i < 20 && !limed; i++) { await wait(200); limed = await p1.evaluate(() => /Lime/i.test((document.querySelector('#camp-body [data-olob-pick="2"]') || {}).title || '')); }
    ok('...and a pick colours it', limed);
    // the host's own colours: the AI force's lime may be taken (it gets another), Brann's not yet joined slot no bar
    await press(p1, '[data-olob-pick="0"]');
    await p1.waitForTimeout(200);
    const lime = await p1.evaluate(() => { const b = document.querySelector('#camp-body .olob-pop [data-olob-col="lime"]'); return b ? { off: b.disabled, ai: b.classList.contains('olob-aicol') } : null; });
    ok('...a colour an AI force wears is still there to take, marked', lime && !lime.off && lime.ai, JSON.stringify(lime));
    await p1.evaluate(() => document.getElementById('camp-title').click());
    await p1.waitForTimeout(200);
    await p1.evaluate(() => { const c = document.getElementById('olob-pub'); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    await p1.waitForTimeout(500);

    // the other player finds it in the Multiplayer list
    await p2.evaluate(() => window.PMCLobby.open());
    let row = '';
    for (let i = 0; i < 30 && !row; i++) { await wait(200); row = await p2.evaluate(() => { const b = document.querySelector('#lobby .lob-list [data-lob="join"]'); return b ? b.closest('.lob-game').innerText : ''; }); }
    ok('the public campaign is listed in Multiplayer, its open slots said', /Ash Online.s campaign/.test(row) && /4 forces/.test(row) && /1 slot open/.test(row), row);
    await p2.evaluate(() => document.querySelector('#lobby .lob-list [data-lob="join"]').click());
    let s2 = await till(p2, 'Brann in the lobby', (s) => s.view === 'olobby' && s.slot === 1);
    ok('joined from the list: Brann takes the open slot', s2.slot === 1 && /Brann Online/.test(await text(p2)));
    ok('...the AI tick-boxes are the host’s alone: a player sees none', await p2.evaluate(() => !document.querySelector('#camp-body [data-olob-ai]') && !document.querySelector('#camp-body .olob-ai')));
    await choose(p2, '[data-olob-army="1"]', 'rebel');
    await p2.waitForTimeout(500);
    // Enter sends the line
    await p2.fill('#olob-say', 'ready when you are');
    await p2.press('#olob-say', 'Enter');
    await p2.waitForTimeout(500);
    await press(p2, '[data-go="olobready"]');
    let chatSeen = false;
    for (let i = 0; i < 40 && !chatSeen; i++) { await wait(250); const tx = await text(p1); chatSeen = /ready when you are/.test(tx) && /Brann Online[\s\S]*?Ready/.test(tx); }
    ok('the host sees Brann, their message and that they are ready', chatSeen);
    // the host says they are ready too; with everyone ready, the host's button becomes Start
    ok('the host has Ready, not Start, until they are ready', !(await p1.evaluate(() => !!document.querySelector('#camp-body [data-go="olobstart"]'))));
    await press(p1, '[data-go="olobready"]');
    let startable = false;
    for (let i = 0; i < 30 && !startable; i++) { await wait(200); startable = await p1.evaluate(() => !!document.querySelector('#camp-body [data-go="olobstart"]')); }
    ok('...and Start once everyone is', startable);
    await press(p1, '[data-go="olobstart"]');
    s1 = await till(p1, 'the founding screen', (s) => s.phase === 'run' && s.view === 'found');
    s2 = await till(p2, 'Brann’s founding screen', (s) => s.phase === 'run' && s.view === 'found');
    ok('the host starts it: each player founds their own force', s1.view === 'found' && s2.view === 'found');
    const fsheet = await p2.evaluate(() => ({ name: document.getElementById('found-name').value, factions: document.querySelectorAll('#camp-body [data-bfaction]').length, chip: !!document.querySelector('#camp-body button[data-go="fcolour"]'), lede: /has signed/.test(document.getElementById('camp-body').innerText) }));
    ok('...the army and colours as picked in the lobby, the name to start from theirs', fsheet.name === 'Brann Online’s Revolt' && !fsheet.factions && !fsheet.chip && !fsheet.lede, JSON.stringify(fsheet));

    console.log('\nThe world');
    await found(p1, 'Iron Wolves', ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
    await found(p2, 'Red Dawn', ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], 'H1', 'rebel');
    s1 = await till(p1, 'Ash’s hub, with Brann’s force founded', (s) => s.view === 'hub' && s.A === 'Iron Wolves' && s.rivals.indexOf('Red Dawn') >= 0);
    s2 = await till(p2, 'Brann’s hub', (s) => s.view === 'hub' && s.A === 'Red Dawn');
    ok('founded: each on their own hub, their own force', s1.A === 'Iron Wolves' && s2.A === 'Red Dawn');
    const rivals = await p1.evaluate(() => window.PMC_CAMPAIGN.online().camp.rivals.map((r) => (r.human ? 'H:' : 'AI:') + r.name));
    ok('the other forces on the world: the AI forces, and Brann’s', rivals.length === 3 && rivals.some((r) => /^AI:/.test(r)) && rivals.indexOf('H:Red Dawn') >= 0, rivals.join(', '));

    console.log('\nAgainst an AI force');
    await press(p1, '[data-go="offers"]');
    await p1.waitForTimeout(300);
    t1 = await text(p1);
    ok('Contract shows the offers against the AI force, and the other players to challenge', /Take this contract/i.test(t1) && /The other players/i.test(t1) && /Challenge them/i.test(t1), t1.slice(0, 200));
    await press(p1, '[data-take-offer="0"]');
    s1 = await till(p1, 'the contract', (s) => s.view === 'ocontract' && !!s.k);
    ok('taking one opens its contract, its terms as offered', !!s1.k.scenario && s1.k.tier >= 1);
    await fightWithPicked(p1);
    let board = false;
    for (let i = 0; i < 80 && !board; i++) { await wait(250); board = await onBoard(p1); }
    ok('ready: Ash is taken into the battle, made on the server', board);
    const cfg = await p1.evaluate(() => { const c = window.PMC_STATE().cfg; return { ai: c.aiSides, A: c.nameA, B: c.nameB }; });
    ok('...against the AI force, which the server plays', cfg.A === 'Iron Wolves' && (cfg.ai || []).indexOf('B') >= 0, JSON.stringify(cfg));
    await p1.evaluate(() => window.PMCLobby.abandon());
    s1 = await throughPost(p1, 'the aftermath');
    ok('walked away from: the aftermath comes up, a loss, the turn moved on', s1.after && s1.after.winner === 'B' && s1.turn === 1, JSON.stringify(s1.after && s1.after.winner) + ' turn ' + s1.turn);
    ok('...and the board is put away', await p1.evaluate(() => !(window.PMC_BATTLE_LIVE && window.PMC_BATTLE_LIVE())));
    await press(p1, '[data-go="pastback"]');
    await p1.waitForTimeout(300);

    console.log('\nA duel');
    await press(p1, '[data-go="offers"]');
    await p1.waitForTimeout(300);
    await press(p1, '[data-ochallenge="1"]');
    s1 = await till(p1, 'the challenge made', (s) => s.challenges.length === 1);
    s2 = await till(p2, 'the challenge seen', (s) => s.challenges.length === 1 && s.view === 'hub');
    ok('Ash challenges Brann: Brann’s hub says so', /challenges you to a contract/.test(await text(p2)));
    await press(p2, '[data-ochaccept]');
    s2 = await till(p2, 'the duel contract', (s) => s.view === 'ocontract' && s.duel && s.duel.contract);
    ok('Brann accepts: the contract is drawn up between them', s2.duel.side === 'B' && s2.duel.foeName === 'Iron Wolves');
    s1 = await till(p1, 'Ash told of it', (s) => !!s.duel);
    await press(p1, '[data-go="ocontract"]');
    await p1.waitForTimeout(300);
    await fightWithPicked(p1);
    await till(p1, 'Ash ready', (s) => s.duel && s.duel.contract && s.duel.contract.ready.A);
    await fightWithPicked(p2);
    let both = false;
    for (let i = 0; i < 100 && !both; i++) { await wait(250); both = (await onBoard(p1)) && (await onBoard(p2)); }
    ok('both ready: both are taken into the battle', both);
    await p2.evaluate(() => window.PMCLobby.abandon());
    s1 = await throughPost(p1, 'Ash’s aftermath');
    s2 = await till(p2, 'Brann’s aftermath', (s) => s.view === 'aftermath', 30000);
    ok('Brann walks away: Ash reads a win, Brann a loss, each as their own', s1.after.winner === 'A' && s2.after.winner === 'B' && s1.turn === 2 && s2.turn === 1, JSON.stringify([s1.after.winner, s2.after.winner, s1.turn, s2.turn]));

    console.log('\nThe Continue list');
    await press(p1, '[data-go="pastback"]');
    await p1.waitForTimeout(200);
    await p1.evaluate(() => { window.PMCMenu.open(); window.PMCMenu.show('continue'); });
    let orow = '';
    for (let i = 0; i < 30 && !orow; i++) { await wait(150); orow = await p1.evaluate(() => { const r = document.querySelector('#cont-list [data-cont^="o:"]'); return r ? r.textContent : ''; }); }
    ok('the main menu’s Continue lists the online campaign', /Online campaign/.test(orow) && /4 forces/.test(orow), orow);

    console.log('\nBack out of a lobby');
    await p2.evaluate(() => { if (window.PMCMenu) window.PMCMenu.close(); window.PMCLobby.open(); });
    await p2.waitForTimeout(800);
    await p2.evaluate(() => document.querySelector('#lobby [data-lob="create"]').click());
    await p2.waitForTimeout(200);
    await p2.evaluate(() => { document.querySelector('#lobby [data-kind="ocamp"]').click(); document.querySelector('#lobby [data-lob="create"][data-go]').click(); });
    await till(p2, 'Brann’s new lobby', (s) => s.view === 'olobby');
    await p2.evaluate(() => document.getElementById('camp-back').click());
    await p2.waitForTimeout(150);
    const asked = await p2.evaluate(() => (document.querySelector('#camp-askbox h3') || {}).textContent || '');
    await p2.evaluate(() => document.querySelector('#camp-ask [data-ask="ok"]').click());
    let back = false;
    for (let i = 0; i < 30 && !back; i++) { await wait(200); back = await p2.evaluate(() => document.getElementById('camp').hidden && !document.getElementById('lobby').hidden); }
    ok('the title bar’s Back asks the host first, closes the campaign, and goes back to Multiplayer', /Close the campaign/.test(asked) && back, asked);
  } catch (e) {
    fail++; console.log('  ✗ ' + e.message);
  }
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  srv.kill();
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
