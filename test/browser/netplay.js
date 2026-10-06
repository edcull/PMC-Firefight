/* Two browsers at one game server, a battle between them: each screen says
   whose turn it is from its own seat, forces left unnamed are named for their
   seat, the other player dropping out and coming back is said on the board,
   and abandoning from the menu ends the battle for both: the one left at the
   table is shown the result (a win by forfeit) and goes on when they press Continue. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { ROOT, SHOTS , signInLobby, tmpData } = require('../where.js');
const PORT = 9300 + Math.floor(Math.random() * 400);

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await wait(150);
    up = await fetch('http://localhost:' + PORT + '/health').then(r => r.ok).catch(() => false);
  }
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const ctx1 = await b.newContext({ viewport: { width: 1340, height: 900 } });
  let ctx2 = await b.newContext({ viewport: { width: 1340, height: 900 } });
  // into the lobby through the sign-in screen: an account, or a guest's name
  async function page(ctx, name, mode) {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:' + PORT + '/');
    await p.waitForTimeout(700);
    await signInLobby(p, name, mode);
    await p.evaluate(() => {
      window.__room = null;
      window.PMCLobby.net().on('game', m => { window.__room = m.room; });
    });
    await p.waitForTimeout(500);
    return p;
  }
  const force = { faction: 'pmc', tactic: '', keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'], colour: 'ochre', name: '' };
  const p1 = await page(ctx1, 'Iron Wolf', 'register');
  let p2 = await page(ctx2, 'Red Dawn', 'guest');
  const signedIn = await Promise.all([p1, p2].map((p) => p.evaluate(() => { const u = document.getElementById('lobby-user'); return u && !u.hidden ? u.textContent : ''; })));
  ok('one signs up, the other plays as a guest; each lobby says which, on the right of its bar', /^Iron Wolf$/.test(signedIn[0]) && /Red Dawn \(guest\)/.test(signedIn[1]), signedIn.join(' | '));
  // the list of games on a phone: the talk keeps the foot; starting a game puts Cancel beside Create and the list away
  await p2.setViewportSize({ width: 390, height: 700 });
  await p2.evaluate(() => document.querySelector('#lobby [data-lob="create"]').click());
  await p2.waitForTimeout(200);
  const lb = await p2.evaluate(() => {
    const q = (s) => document.querySelector('#lobby ' + s);
    const foot = [...document.querySelectorAll('#lobby .lob-new .lob-foot button')];
    return { btns: foot.map(x => x.textContent).join('|'), oneLine: foot.length === 2 && Math.abs(foot[0].getBoundingClientRect().top - foot[1].getBoundingClientRect().top) < 2,
      list: !!q('.lob-list'), foot: Math.round(innerHeight - q('.lob-chat').getBoundingClientRect().bottom), lines: Math.round(q('.lob-lines').getBoundingClientRect().height) };
  });
  await p2.screenshot({ path: require('path').join(SHOTS, 'lobby-new-phone.png') }).catch(() => {});
  ok('starting a game: Cancel beside Create the game, and no list of games', lb.btns === 'Cancel|Create the game' && lb.oneLine && !lb.list, JSON.stringify(lb));
  ok('...the lobby talk keeps the foot, three lines tall', lb.foot < 40 && lb.lines < 90, JSON.stringify(lb));
  await p2.evaluate(() => document.querySelector('#lobby [data-lob="uncreate"]').click());
  await p2.setViewportSize({ width: 1340, height: 900 });
  await p1.evaluate((f) => window.PMCLobby.net().send('game.create', { name: 'Test', settings: { tier: 3, pl: 1, planet: 'desert', scenario: 'meeting', private: false }, force: f }), force);
  await p1.waitForTimeout(600);
  const code = await p1.evaluate(() => window.__room && window.__room.id);
  await p2.evaluate((c) => window.PMCLobby.net().send('game.join', { id: c }), code);
  await p2.waitForTimeout(600);
  await p2.evaluate((f) => window.PMCLobby.net().send('game.force', { force: Object.assign({}, f, { colour: 'rose' }) }), force);
  await p2.waitForTimeout(300);
  // the actions look as every other screen's do: the way out a link, the next step the full-width button
  const acts = await p1.evaluate(() => [...document.querySelectorAll('#lobby .lob-acts button')].map(x => x.className + ':' + x.textContent));
  ok('the room: Leave this game a link, I am ready the main button', acts.join('|') === 'lnk:Leave this game|start:I am ready', acts.join('|'));
  await p1.screenshot({ path: require('path').join(SHOTS, 'lobby-room-desktop.png') }).catch(() => {});
  // the room on a phone: the actions, then the terms scrolling — the forces a line each among them, as the campaign lobby's slots — the talk at the foot
  await p2.setViewportSize({ width: 390, height: 700 });
  await p2.waitForTimeout(200);
  const rm = await p2.evaluate(() => {
    const q = (s) => document.querySelector('#lobby ' + s), r = (s) => q(s).getBoundingClientRect();
    const seats = document.querySelectorAll('#lobby .lob-slots .olob-slot');
    const sc = q('.lob-scroll'), chat = q('.lob-chat');
    return { order: r('.lob-scroll').bottom <= r('.lob-acts').top + 1 && r('.lob-acts').bottom <= chat.getBoundingClientRect().top + 1,
      among: r('#term-tier').bottom <= r('.lob-slots').top && r('.lob-slots').bottom <= r('#term-scenario').top,
      lineEach: seats.length === 2 && seats[0].getBoundingClientRect().bottom <= seats[1].getBoundingClientRect().top,
      // your own force's colours and army to change, the other's to read
      own: !!seats[1].querySelector('button.olob-colour') && !!seats[1].querySelector('select[data-lob-army="B"]') && !!seats[1].querySelector('[data-lob="muster"]'),
      theirs: !!seats[0].querySelector('.olob-colour.still') && !seats[0].querySelector('select') && seats[0].querySelector('.olob-army').textContent === 'PMC',
      scrolls: getComputedStyle(sc).overflowY === 'auto', foot: Math.round(innerHeight - chat.getBoundingClientRect().bottom),
      lines: Math.round(q('.lob-lines').getBoundingClientRect().height),
      wide: document.documentElement.scrollWidth > innerWidth,
      talk: /Table talk|host sets the terms|A game over the network/.test(q('#lobby-body').textContent),
      pub: !!q('#term-private[type=checkbox]') && q('#term-private').disabled };
  });
  await p2.screenshot({ path: require('path').join(SHOTS, 'lobby-room-phone.png') }).catch(() => {});
  ok('the room on a phone: the terms, the forces, then the actions above the chat; a line each between the Tier and the scenario', rm.order && rm.among && rm.lineEach && !rm.wide, JSON.stringify(rm));
  ok('...your own force\'s colours and army to change, the other\'s to read', rm.own && rm.theirs, JSON.stringify(rm));
  ok('...the terms scroll and the talk keeps the foot, three lines tall', rm.scrolls && rm.foot < 40 && rm.lines < 90, JSON.stringify(rm));
  ok('...no helper text, and Public is a box only the host can tick', !rm.talk && rm.pub, JSON.stringify(rm));
  // the colours under the chip: the other force's greyed out; one picked goes to the room
  await p2.evaluate(() => document.querySelector('#lobby [data-lob="colours"][data-for="B"]').click());
  await p2.waitForTimeout(200);
  const pop = await p2.evaluate(() => { const p = document.querySelector('#lobby .olob-pop'), c = document.querySelector('#lobby [data-for="B"]');
    return p ? { off: [...p.querySelectorAll('button:disabled')].map(x => x.getAttribute('data-col')).join(), under: p.getBoundingClientRect().top >= c.getBoundingClientRect().bottom } : null; });
  ok('...the colours open under the chip, the other force\'s greyed out', !!pop && pop.off === 'ochre' && pop.under, JSON.stringify(pop));
  await p2.evaluate(() => document.querySelector('#lobby .olob-pop [data-col="jade"]').click());
  await p2.waitForTimeout(400);
  const jade = await p1.evaluate(() => window.__room && window.__room.seats.B.force.colour);
  ok('...and one picked is the room\'s', jade === 'jade' && await p2.evaluate(() => !document.querySelector('#lobby .olob-pop')), jade);
  await p2.evaluate(() => document.querySelector('#lobby [data-lob="colours"][data-for="B"]').click());
  await p2.mouse.click(5, 5);
  await p2.waitForTimeout(200);
  ok('...a tap elsewhere puts them away', await p2.evaluate(() => !document.querySelector('#lobby .olob-pop')));
  // another army: the force rolled afresh for it, its keys kept from the other player
  await p2.evaluate(() => { const s = document.querySelector('#lobby [data-lob-army="B"]'); s.value = 'bugs'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p2.waitForTimeout(400);
  const army = await p1.evaluate(() => { const f = window.__room.seats.B.force; return { f: f.faction, units: f.units, keys: !!f.keys, read: document.querySelectorAll('#lobby .lob-slots .olob-slot')[1].querySelector('.olob-army').textContent }; });
  ok('...another army rolls the force afresh for it, the other player reading only the army and how many', army.f === 'bugs' && army.units > 0 && !army.keys && army.read === 'Bugs', JSON.stringify(army));
  await p2.evaluate((f) => window.PMCLobby.net().send('game.force', { force: Object.assign({}, f, { colour: 'rose' }) }), force);
  await p2.waitForTimeout(300);
  await p2.setViewportSize({ width: 1340, height: 900 });
  // table talk: each name in the colour of the force that player has picked
  await p1.evaluate(() => window.PMCLobby.net().send('game.chat', { text: 'hello from the host' }));
  await p2.waitForTimeout(400);
  const talk = await p2.evaluate(() => {
    const b = [...document.querySelectorAll('#room-say-lines .said b')].pop(), t = document.createElement('i');
    t.style.color = window.PMCIso.COLOURS[window.__room.seats.A.force.colour].light; document.body.appendChild(t);
    const force = getComputedStyle(t).color; t.remove();
    return { line: b ? b.textContent : '', col: b ? getComputedStyle(b).color : '', force: force };
  });
  ok('table talk names the player in their force\u2019s colour', !!talk.line && talk.col === talk.force, JSON.stringify(talk));
  await p2.setViewportSize({ width: 1340, height: 900 });
  for (const p of [p1, p2]) await p.evaluate(() => window.PMCLobby.net().send('game.ready', { ready: true }));
  await p1.waitForTimeout(400);
  const acts2 = await p1.evaluate(() => [...document.querySelectorAll('#lobby .lob-acts button')].map(x => x.className + ':' + x.textContent + (x.disabled ? ':off' : '')));
  ok('...once both are ready, the host is given Take the field', acts2.join('|') === 'lnk:Leave this game|lnk:Not ready after all|start:Take the field', acts2.join('|'));
  await p1.screenshot({ path: require('path').join(SHOTS, 'lobby-room-ready-desktop.png') }).catch(() => {});
  const tall = (p) => p.evaluate(() => [...document.querySelectorAll('#lobby .lob-acts > *')].map(x => Math.round(x.getBoundingClientRect().height)));
  const h1 = await tall(p1), h2 = await tall(p2);
  ok('...and the other player\'s row is the same height, its wait said where the button is', h2.length === 3 && Math.max(...h1, ...h2) - Math.min(...h1, ...h2) <= 1, JSON.stringify([h1, h2]));
  await p2.screenshot({ path: require('path').join(SHOTS, 'lobby-room-ready-guest.png') }).catch(() => {});
  await p1.evaluate(() => window.PMCLobby.net().send('game.start'));
  await p1.waitForTimeout(2000);
  // the briefing comes up the once for each; one side looking at its swaps does not bring it back for the other
  const briefUp = (p) => p.evaluate(() => !document.getElementById('obj-modal').hidden);
  ok('each player is briefed as the deployment begins', await briefUp(p1) && await briefUp(p2));
  await p2.evaluate(() => document.getElementById('obj-done').click());
  await p1.evaluate(() => window.__sendIntent({ k: 'swapopen' }));
  await wait(1200);
  ok('...and the other opening their swaps does not bring it back up', !(await briefUp(p2)));
  await p1.evaluate(() => { const d = document.getElementById('obj-done'); if (d) d.click(); });
  // the turn banner, as each screen shows it
  for (const p of [p1, p2]) await p.evaluate(() => {
    window.__banners = [];
    const tb = document.getElementById('turnbanner');
    new MutationObserver(() => { if (!tb.hidden && tb.textContent) window.__banners.push(tb.textContent); }).observe(tb, { childList: true, subtree: true, attributes: true });
  });
  // both deploy; only the first says it is ready to begin
  for (let k = 0; k < 14; k++) {
    for (const p of [p1, p2]) await p.evaluate((first) => {
      const st = window.PMC_STATE(); if (!st || st.phase === 'battle') return;
      const me = window.__seats()[0];
      if (st.deployReady && !st.deployReady[me]) window.__sendIntent({ k: 'deployready' });
      window.__sendIntent({ k: 'autosplit' }); window.__sendIntent({ k: 'autodeploy' });
      if (first) window.__sendIntent({ k: 'start' });
    }, p === p1);
    await wait(400);
    if (await p1.evaluate(() => { const r = window.PMC_STATE().startReady; return !!(r && r[window.__seats()[0]]); })) break;
  }
  await wait(600);
  const half = await p1.evaluate(() => ({ phase: window.PMC_STATE().phase, ready: window.PMC_STATE().startReady,
    btn: (document.querySelector('.deploy-go .act.primary') || {}).textContent || '' }));
  ok('one player pressing Begin does not start the battle', half.phase === 'deploy' && half.ready, JSON.stringify(half));
  ok('...their button says they are waiting for the other', /Ready/.test(half.btn) && /Waiting for/.test(half.btn), half.btn);
  const other = await p2.evaluate(() => (document.querySelector('.deploy-go [data-act="start"], .deploy-go [data-act="startask"]') || {}).textContent || '');
  ok('...and the other is told they are ready', /is ready/.test(other), other);
  await p2.evaluate(() => window.__sendIntent({ k: 'start' }));
  for (let k = 0; k < 10; k++) {
    await wait(300);
    if (await p1.evaluate(() => window.PMC_STATE().phase === 'battle')) break;
  }
  ok('...the battle begins once both have', await p1.evaluate(() => window.PMC_STATE().phase === 'battle'));
  // both companies walk on in turn 1's Reserve phase: each screen shows it before the Action phase is driven
  for (const p of [p1, p2]) await p.waitForFunction(() => !window.__busy() && window.__showQueue() === 0 && !!window.PMC_STATE().phaseCount, null, { timeout: 30000 }).catch(() => {});
  await wait(1200);
  const look = (p) => p.evaluate(() => ({
    seat: window.__seats()[0], active: window.PMC_STATE().activeSide, pill: document.getElementById('hdr-active').textContent,
    names: [window.PMC_STATE().cfg.nameA, window.PMC_STATE().cfg.nameB]
  }));
  const s1 = await look(p1), s2 = await look(p2);
  ok('the battle is on for both', s1.active && s2.active, JSON.stringify([s1.active, s2.active]));
  // the table talk, under the actions on a desktop
  await p1.evaluate(() => { document.getElementById('bchat-say').value = 'good luck'; document.getElementById('bchat-send').click(); });
  await p2.waitForTimeout(500);
  const bc = await p2.evaluate(() => ({ shown: !document.getElementById('battle-chat').hidden, said: document.getElementById('bchat-lines').textContent,
    inks: (() => { const b = [...document.querySelectorAll('#bchat-lines b')].pop(), probe = document.createElement('i'); probe.style.color = window.PMCIso.PALETTE.A.ink; document.body.appendChild(probe);
      const want = getComputedStyle(probe).color; probe.remove(); return b ? getComputedStyle(b).color === want : false; })(),
    under: document.getElementById('bar').getBoundingClientRect().bottom <= document.getElementById('battle-chat').getBoundingClientRect().top + 1 }));
  ok('an online battle has the table talk under the actions, and what is said there arrives', bc.shown && bc.under && /good luck/.test(bc.said), JSON.stringify(bc));
  ok('...each name in its side\u2019s colours on the board', bc.inks, JSON.stringify(bc));
  // on a phone, a Chat tab of its own, counting what was said while it was shut
  await p2.setViewportSize({ width: 400, height: 820 });
  await p2.evaluate(() => window.PMC_SET_MTAB('act'));
  await p1.evaluate(() => { document.getElementById('bchat-say').value = 'your move'; document.getElementById('bchat-send').click(); });
  await p2.waitForTimeout(500);
  const tab = await p2.evaluate(() => { const t = document.querySelector('#mtabs .mtab-chat'); return { shown: !!t && getComputedStyle(t).display !== 'none', n: document.getElementById('mtab-chat-n').textContent }; });
  ok('...on a phone, a Chat tab with a count of what was said while it was shut', tab.shown && tab.n === '1', JSON.stringify(tab));
  await p2.click('#mtabs .mtab-chat'); await p2.waitForTimeout(200);
  const opened = await p2.evaluate(() => ({ n: document.getElementById('mtab-chat-n').textContent, vis: getComputedStyle(document.getElementById('battle-chat')).display !== 'none' }));
  ok('...the chat sits under the tabs, as the other panes do', await p2.evaluate(() => document.getElementById('battle-chat').getBoundingClientRect().top >= document.getElementById('mtabs').getBoundingClientRect().bottom - 1));
  ok('...opened, the talk shows and the count goes', opened.vis && !opened.n, JSON.stringify(opened));
  await p2.evaluate(() => window.PMC_SET_MTAB('act'));
  await p2.setViewportSize({ width: 1340, height: 900 });
  const mine = s1.active === s1.seat ? s1 : s2, theirs = mine === s1 ? s2 : s1;
  ok('the screen whose go it is says so', mine.pill === 'Your turn', mine.pill);
  ok('...and the other says whose it is, by name', /Player [12] Force’s turn/.test(theirs.pill), theirs.pill);
  const b1 = await p1.evaluate(() => window.__banners[0] || ''), b2 = await p2.evaluate(() => window.__banners[0] || '');
  const init = await p1.evaluate(() => window.PMC_STATE().initiative);
  const bMine = init === 'A' ? b1 : b2, bTheirs = init === 'A' ? b2 : b1;
  ok('the turn banner tells the player with the initiative they have it', /You have the initiative/.test(bMine), bMine);
  ok('...and the other that their opponent has it', !/You have/.test(bTheirs) && /Player [12] Force has the initiative/.test(bTheirs), bTheirs);
  ok('forces left unnamed are named for their seats', s1.names[0] === 'Player 1 Force' && s1.names[1] === 'Player 2 Force', s1.names.join(' / '));

  // the player whose go it is moves a unit: the other screen's camera follows it there
  const pMine = mine === s1 ? p1 : p2, pTheirs = pMine === p1 ? p2 : p1;
  // close in, so the camera has room to go with it rather than sitting against the table's edge
  await pTheirs.evaluate(() => window.PMC_SETVIEW(24, 24, 1.4));
  // (Follow is on in a fresh browser.) Picking the unit already brings the other camera over to it...
  const picked = await pMine.evaluate(() => {
    const st = window.PMC_STATE(), me = window.__seats()[0];
    if (st.faceAsk) window.__sendIntent({ k: 'vfaceall' });
    const u = st.units.find(x => x.side === me && x.x >= 0 && !x.dead && !x.activated && x.models > 0);
    if (u) window.__sendIntent({ k: 'select', id: u.id });
    return u ? u.id : null;
  });
  await wait(2200);
  const camFocus = await pTheirs.evaluate(() => window.__cam());
  // the other player's unit, looked at: no action buttons for it on this screen
  const foeBar = await pTheirs.evaluate(() => {
    const me = window.__seats()[0], u = window.PMC_STATE().units.find(x => x.side !== me && x.alive && x.x >= 0);
    if (!u || !window.__select(u)) return null;
    return document.querySelectorAll('#bar [data-action]').length;
  });
  ok('the other player’s unit, selected, shows no action buttons', foeBar === 0, String(foeBar));
  // meanwhile the waiting player picks one of their own units to look at, out of turn
  const looked = await pTheirs.evaluate(() => {
    const me = window.__seats()[0], u = window.PMC_STATE().units.find(x => x.side === me && x.alive && x.x >= 0);
    return u && window.__select(u) ? u.id : null;
  });
  ok('...while one of their own does', await pTheirs.evaluate(() => document.querySelectorAll('#bar [data-action]').length > 0));
  // ...and the move is what has to be followed: the camera rides along to where the unit ends up
  const moved = await pMine.evaluate(async (id) => {
    const u = window.PMC_STATE().units.find(x => x.id === id);
    let spots = [];
    for (let k = 0; k < 20 && !spots.length; k++) {
      // (asked again until the server has it: the pick may still be on its way)
      if (k % 4 === 0) window.__sendIntent({ k: 'action', id: 'move' });
      await new Promise(r => setTimeout(r, 150)); spots = window.__moveSpots();
    }
    if (!spots.length) return { id, spots: 0, mode: window.__uiMode(), hint: (document.getElementById('hint') || {}).textContent };
    // the reachable spot nearest the middle of the table, so the camera is not held at an edge
    const mid = (c) => Math.hypot(c.x - 24, c.y - 24);
    const long = spots.filter(c => Math.hypot(c.x - u.x, c.y - u.y) >= 4);
    const far = (long.length ? long : spots).reduce((a, c) => mid(c) < mid(a) ? c : a);
    window.__sendIntent({ k: 'move', x: far.x, y: far.y });
    return { id, spots: spots.length, dist: Math.hypot(far.x - u.x, far.y - u.y) };
  }, picked);
  ok('the player whose go it is can move a unit', moved && moved.spots > 0 && moved.dist > 3, JSON.stringify(moved));
  // while the unit is on its way, the camera goes with it (it has long settled on where it set out from)
  const start = await pMine.evaluate((id) => window.PMC_STATE().units.find(x => x.id === id), picked);
  const way = [];
  let ownCam = null;
  for (let k = 0; k < 60; k++) {
    await wait(60);
    if (k === 3) ownCam = await pMine.evaluate(() => window.__cam());
    const q = await pTheirs.evaluate(({ id, sx, sy }) => {
      const d = window.__drawnAt(id), c = window.__cam();
      return d ? { gone: Math.hypot(d.x - sx, d.y - sy), x: c.x, y: c.y, borrowed: c.borrowed } : null;
    }, { id: picked, sx: start.x, sy: start.y });
    if (q && q.gone > 0.3 && q.gone < moved.dist - 0.3) way.push(q);
  }
  const rode = way.length ? Math.hypot(way[way.length - 1].x - way[0].x, way[way.length - 1].y - way[0].y) : 0;
  ok('the other screen\u2019s camera follows the opponent\u2019s unit as it moves', camFocus.borrowed && way.length > 1 && way.every(q => q.borrowed) && rode > 30,
    JSON.stringify({ focusBorrowed: camFocus.borrowed, samples: way.length, rode: Math.round(rode) }));
  ok('...while the mover\u2019s own camera is not borrowed', !ownCam.borrowed, JSON.stringify(ownCam));
  // the go passes to them: the unit they were looking at is theirs to act with, without picking it again
  let live = null;
  for (let k = 0; k < 30; k++) {
    await wait(300);
    live = await pTheirs.evaluate(() => {
      const st = window.PMC_STATE(), b = document.querySelector('#bar [data-action="move"]');
      return { mine: st.activeSide === window.__seats()[0], sel: window.__uiMode().sel, move: !!b && !b.disabled };
    });
    if (live.mine && live.move) break;
  }
  ok('a unit picked out of turn can act as soon as the go passes over', !!looked && live.mine && live.sel === looked && live.move, JSON.stringify({ looked, live }));
  // another of their own, only being looked at on this screen, then an action pressed: it is that unit that acts, shown here
  const lookOther = await pTheirs.evaluate((was) => {
    const me = window.__seats()[0], st = window.PMC_STATE();
    const u = st.units.find(x => x.side === me && x.alive && x.x >= 0 && !x.activated && x.id !== was);
    if (!u || !window.__inspect(u)) return null;
    const b = document.querySelector('#bar [data-action="move"]'); if (!b || b.disabled) return 'no-button'; b.click();
    return u.id;
  }, looked);
  let acted = null;
  for (let k = 0; k < 20 && lookOther; k++) { await wait(150); acted = await pTheirs.evaluate(() => window.__uiMode()); if (acted.mode === 'move') break; }
  ok('a unit only looked at, then given an action, is the one that acts — on this screen', !lookOther || (acted && acted.sel === lookOther && acted.mode === 'move'), JSON.stringify({ lookOther, acted }));
  if (lookOther) await pTheirs.evaluate(() => { const b = document.querySelector('#bar [data-action="move"]'); if (b) b.click(); });     // (put away again)
  await wait(400);
  await wait(2500);

  // the second player's browser goes away, then comes back
  const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent));
  // what this browser keeps of itself: its storage and its session's cookie
  const kept2 = await ctx2.storageState();
  await ctx2.close();
  await wait(1200);
  const dropped = await toasts(p1);
  ok('the other player dropping out is said on the board', dropped.some(t => /lost connection/.test(t)), dropped.join(' | ') || 'no toast');
  // the same browser, as far as the server knows: its session's cookie kept
  ctx2 = await b.newContext({ viewport: { width: 1340, height: 900 }, storageState: kept2 });
  ok('the session is an HttpOnly cookie, out of reach of the page\'s scripts', kept2.cookies.some((c) => c.name === 'pmc_session' && c.httpOnly));
  p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('http://localhost:' + PORT + '/');
  await p2.waitForTimeout(700);
  await p2.evaluate(() => window.PMCLobby.open());
  await wait(1800);
  const back = await toasts(p1);
  ok('...and coming back', back.some(t => /is back/.test(t)), back.join(' | ') || 'no toast');

  // the first player abandons it from the menu, asked twice
  await p1.evaluate(() => window.PMCMenu.open());
  await p1.waitForTimeout(300);
  await p1.evaluate(() => window.PMCMenu.show('continue'));
  const x = await p1.evaluate(() => { const d = document.querySelector('#cont-list [data-contdel="live"]'); return { shown: !!d, label: d ? d.getAttribute('aria-label') : '' }; });
  ok('the menu offers to abandon the battle', x.shown && /Abandon/.test(x.label), JSON.stringify(x));
  await p1.click('#cont-list [data-contdel="live"]');
  const asked = await p1.evaluate(() => document.querySelector('#cont-list [data-contdel="live"]').textContent + ' / ' + document.querySelector('#cont-list [data-cont="live"] small').textContent);
  ok('...asking once more first', /Abandon\?/.test(asked) && /opponent/.test(asked), asked);
  await p1.click('#cont-list [data-contdel="live"]');
  await wait(1200);
  const gone1 = await p1.evaluate(() => ({ live: window.PMC_BATTLE_LIVE(), resume: !!document.querySelector('#cont-list [data-cont="live"]') }));
  ok('abandoned, the battle is gone from this screen', !gone1.live && !gone1.resume, JSON.stringify(gone1));
  const left = await toasts(p2);
  const gone2 = await p2.evaluate(() => window.PMC_BATTLE_LIVE());
  ok('the other player is told it is over, and that they win by forfeit', left.some(t => /has left the battle — you win by forfeit/.test(t)), left.join(' | ') || 'no toast');
  ok('...and their board lets it go', !gone2);
  // the result on their battlefield, who won and why, until they have read it
  const card = () => p2.evaluate(() => { const r = document.getElementById('resolution'), c = document.getElementById('res-card');
    return { up: !r.hidden && /Result/.test((c.querySelector('.res-kind') || {}).textContent || ''), title: (c.querySelector('h3') || {}).textContent || '', text: (c.querySelector('.outcome') || {}).textContent || '' }; });
  const rc = await card();
  ok('...and the result comes up on their battlefield: they win, by forfeit', rc.up && /Player 2 Force/.test(rc.title) && /wins/.test(rc.title) && /walks away/.test(rc.text) && /forfeit/.test(rc.text), JSON.stringify(rc));
  await wait(3000);
  const held = await card();
  ok('...where they stay until they press Continue', held.up && await p2.evaluate(() => document.getElementById('lobby').hidden), JSON.stringify(held));
  await p2.evaluate(() => document.getElementById('res-continue').click());
  // not held in the old game's room, with nobody to play: back to the list of games
  await wait(1500);
  const after = await p2.evaluate(() => ({ room: !!window.PMCLobby.net() && !!document.querySelector('#lobby [data-lob="leave"]'),
    list: !!document.querySelector('#lobby [data-lob="create"]'), resume: window.PMCLobby.resumable() }));
  ok('...and they are out of its room, at the list of games', !after.room && after.list && !after.resume, JSON.stringify(after));

  // the network muster: one row of buttons, the saves in a modal, only the units scrolling
  await p1.setViewportSize({ width: 390, height: 844 });
  const nm = await p1.evaluate(async () => {
    window.PMCLobby.close(); window.PMCMenu.close();
    window.PMC_MUSTER_FOR({ tier: 3, pl: 1 }, function () {}, null, 'Test', 'B');
    const f = document.getElementById('sel-faction'); f.value = 'bugs'; f.dispatchEvent(new Event('change'));
    document.querySelector('.muster-btns [data-army="roll"]').click();
    await new Promise(r => setTimeout(r, 300));
    const sh = document.querySelector('#setup > .sheet'), ch = document.getElementById('chosen'), row = document.querySelector('.muster-btns');
    const tops = [...row.children].filter(x => x.offsetParent).map(x => x.getBoundingClientRect().top);
    const cut = [...row.children].filter(x => x.offsetParent && x.scrollWidth > x.clientWidth + 1).map(x => x.textContent);
    document.getElementById('btn-saves').click();
    const modal = getComputedStyle(document.getElementById('forcebar-wrap')).position === 'fixed' || getComputedStyle(document.getElementById('forcebar-wrap')).display === 'grid';
    return { name: document.getElementById('hot-name').value, buttons: tops.length, oneLine: Math.max(...tops) - Math.min(...tops) < 4, cut,
      page: sh.scrollHeight <= sh.clientHeight + 2, units: ch.scrollHeight > ch.clientHeight, intro: getComputedStyle(document.getElementById('hot-intro')).display,
      preset: !!document.getElementById('sel-preset'), modal };
  });
  ok('the network muster names the force for its seat', nm.name === 'Player 2 Force', nm.name);
  ok('...its five buttons sit on one line on a phone, none cut short', nm.buttons === 5 && nm.oneLine && !nm.cut.length, JSON.stringify(nm));
  ok('...the page stays put and only the units scroll', nm.page && nm.units, JSON.stringify(nm));
  ok('...no intro and no ready-made list', nm.intro === 'none' && !nm.preset);
  ok('...and Save / load opens the saves in a modal', nm.modal);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
