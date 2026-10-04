/* The multiplayer screen: the lobby, the room, and the chat in both.

   Nothing here knows any rules. It shows who is connected, lets two people
   agree what they are about to fight and with what, and when both say they are
   ready it gets out of the way — from that point the board takes over and every
   decision is the server's.

   The screen is built rather than written into index.html, because a game
   opened from a file has no server to talk to and should not carry a lobby it
   can never use. */
(function (root) {
  'use strict';

  var P = root.PMCProto, NET = root.PMCNet, U = root.PMCUi;
  var net = null;
  var host = null;              // the overlay
  var view = 'lobby';           // 'lobby' | 'room'
  /* Who this browser is signed in as on the server (multiplayer plan, phase 1):
     undefined while it is being asked, null when nobody is, else { id, name, guest }. */
  var account;
  var games = [];
  var mine = [];                // this player's own games (phase 2): under way, to go back to, and how the rest went
  var room = null;
  var me = { id: null, name: '' };
  var chat = { lobby: [], room: [] };
  var status = '';
  var fault = '';
  var campaigns = [];
  var myForce = null;           // the force this screen has built, as the lobby sees it
  var creating = false;         // Start a game was pressed: asking what kind of game
  var newKind = 'skirmish';     // what the create form has picked: 'skirmish', or 'camp:<name>'
  var newPrivate = false;       // and whether the game is left out of the list

  function esc(t) { return root.PMC.esc(t); }   // the shared one, in the rules
  function el(id) { return document.getElementById(id); }

  /* ================= the screen ================= */
  function ensure() {
    if (host) return host;
    host = document.createElement('div');
    host.className = 'overlay lobby';
    host.id = 'lobby';
    host.hidden = true;
    /* Laid out as the skirmish set-up and the campaign are: a bar across the top
       with the way back and the page's title, and under it the one thing that scrolls. */
    host.innerHTML = '<canvas id="lobby-table" aria-hidden="true"></canvas><div class="camp-top">' + U.backButton('data-lob="leave-lobby"') +
      '<h1 id="lobby-title">Multiplayer</h1><div class="lob-right"><span class="lob-code" id="lobby-code" hidden></span>' +
      // who is playing, on the right of the bar: a tap opens Your account and Sign out
      '<span class="lob-user-wrap"><button type="button" class="lob-user" id="lobby-user" data-lob="usermenu" hidden aria-haspopup="true">' +
      root.PMCAccount.USER_ICON + '<span id="lobby-user-name"></span></button>' +
      '<span class="lob-usermenu" id="lobby-usermenu" hidden><button type="button" class="lnk" data-lob="account">Your account</button>' +
      '<button type="button" class="lnk" data-lob="signout">Sign out</button></span></span></div></div>' +
      '<div class="sheet lobby-sheet"><div id="lobby-body"></div></div>';
    document.body.appendChild(host);
    // its way back is to the main menu: the home icon, as on the other screens
    if (root.PMC_BACK_LABEL) root.PMC_BACK_LABEL(host.querySelector('.camp-back'), true);
    style();
    host.addEventListener('click', onClick);
    // terms are sent as they are changed; the selects are redrawn often, so the overlay listens
    host.addEventListener('change', onTermChange);
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var box = e.target;
      if (box.id === 'lobby-say') { say('lobby', box); e.preventDefault(); }
      if (box.id === 'room-say') { say('room', box); e.preventDefault(); }
      if (box.id === 'join-code') { join(box.value); e.preventDefault(); }
    });
    return host;
  }

  /* The lobby borrows the game's own look — the overlays, the cards and the
     buttons are all already styled — and adds only what it needs of its own. */
  function style() {
    if (el('lobby-style')) return;
    var s = document.createElement('style');
    s.id = 'lobby-style';
    s.textContent = [
      /* the same page as the skirmish set-up and the campaign: full screen on a phone,
         a card over the ground on a desktop, a bar with the way back across its top */
      '#lobby.overlay{display:flex;flex-direction:column;padding:0;overflow:hidden;background:var(--ground);place-items:stretch}',
      '#lobby > .sheet{flex:1;min-height:0;width:100%;max-width:none;max-height:none;overflow-y:auto;overscroll-behavior:contain;border:0;border-radius:0;background:transparent;padding:18px max(16px,calc((100% - 720px) / 2)) calc(22px + env(safe-area-inset-bottom,0px))}',
      '#lobby > .camp-top .lob-right{margin-left:auto;display:flex;align-items:center;gap:10px}',
      '.lob-user-wrap{position:relative}',
      '.lob-user{display:flex;align-items:center;gap:6px;background:none;border:1px solid transparent;border-radius:5px;padding:4px 8px;color:var(--ink);font:600 13px var(--body);cursor:pointer}',
      '.lob-user:hover,.lob-user[aria-expanded="true"]{border-color:var(--line)}',
      '.lob-user svg{width:18px;height:18px;color:var(--ink-dim)}',
      '.lob-usermenu{position:absolute;right:0;top:calc(100% + 4px);z-index:5;display:flex;flex-direction:column;gap:4px;padding:6px;min-width:150px;background:var(--panel);border:1px solid var(--line);border-radius:6px}',
      '.lob-usermenu[hidden]{display:none}',
      // the menu's table rolling behind it on a desktop, as behind the set-up and the campaign
      '#lobby-table{display:none}',
      '@media (min-width:1001px){' +
        '#lobby.overlay{padding:28px 20px;align-items:center;justify-content:center}' +
        '#lobby-table{display:block;position:absolute;inset:0;width:100%;height:100%;opacity:.55;pointer-events:none}' +
        '#lobby > .camp-top{position:relative;width:min(760px,100%);border:1px solid var(--line);border-radius:8px 8px 0 0;background:color-mix(in srgb,var(--panel) 95%,transparent)}' +
        '#lobby.overlay > .sheet{position:relative;flex:0 1 auto;width:min(760px,100%);padding:18px 22px 22px;border:1px solid var(--line);border-top:0;border-radius:0 0 8px 8px;background:color-mix(in srgb,var(--panel) 95%,transparent)}' +
      '}',
      '.lob-me{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--ink-dim);margin:0 0 10px}',
      '.lob-me b{color:var(--ink)}',
      '#lobby input[type=text],#lobby input[type=password]{flex:1;min-width:0;min-height:34px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line);border-radius:5px;padding:6px 9px;font-family:var(--body);font-size:13px}',
      '#lobby input[type=text]:focus,#lobby input[type=password]:focus{outline:none;border-color:var(--alpha)}',
      '.lob-row{display:flex;gap:6px;align-items:stretch}',
      '.lob-row .lnk{flex:none;white-space:nowrap}',
      '.lob-list{display:flex;flex-direction:column;gap:8px;margin:10px 0 16px}',
      '.lob-game{display:flex;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2)}',
      '.lob-game b{font-family:var(--display);font-size:13px}',
      '.lob-game .lob-code{font-family:var(--mono);color:var(--ink-dim);font-size:12px;letter-spacing:.08em}',
      '.lob-game .f{color:var(--ink-dim);font-size:12px}',
      '.lob-game .seats{margin-left:auto;font-size:12px;color:var(--ink-dim);text-align:right}',
      '.lob-empty{color:var(--ink-dim);padding:10px 2px;font-size:13px;margin:0}',
      '.lob-chat{display:flex;flex-direction:column;gap:6px;margin-top:14px}',
      '.lob-chat h4{font-family:var(--display);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-dim);margin:0}',
      '.lob-lines{height:24vh;min-height:120px;overflow:auto;border:1px solid var(--line);border-radius:6px;background:var(--panel-2);padding:8px;font-size:13px;display:flex;flex-direction:column;gap:4px}',
      '.lob-lines p{margin:0}',
      '.lob-lines .said b{color:var(--ink)}',
      '.lob-lines .note{color:var(--ink-dim);font-style:italic}',
      '.lob-terms{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0 10px}',
      '.lob-foot{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}',
      '.lob-foot .start{margin:0;flex:1 1 auto}',
      // in a game, the actions and the forces stay put; the terms scroll; the talk keeps the foot
      '#lobby > .sheet.lobby-sheet{display:flex;flex-direction:column;overflow:hidden}',
      '.lobby-sheet > #lobby-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}',
      '.lob-sheet-room .lob-acts{margin-top:0;align-items:stretch;flex-wrap:nowrap}',
      '.lob-acts .lnk{flex:none;white-space:nowrap}',
      '.lob-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}',
      '.lob-watch{opacity:.7;margin:-4px 0 8px}',
      '.lob-pub{display:flex;align-items:flex-end}',
      '.lob-pub label{display:flex;align-items:center;gap:8px;min-height:var(--row-h);margin:0;padding:0;cursor:pointer;text-transform:none;letter-spacing:0;font-family:var(--body);font-size:13px;color:var(--ink)}',
      '.lob-pub input{accent-color:var(--alpha);width:16px;height:16px;margin:0}',
      '.lobby-sheet .lob-chat{flex:none;margin-top:10px}',
      '@media (max-width:1000px){.lobby-sheet .lob-lines{height:calc(3 * 1.45em + 26px);min-height:0}}',
      '.lob-bad{color:var(--warn);font-size:13px;margin:0}',
      '.lob-note{grid-column:1/-1;color:var(--ink-dim);font-size:12px;margin:0}',
      '.lob-good{color:var(--good);font-size:13px;margin:0;line-height:1.45}',
      '.lob-bad:empty{display:none}',
      '.lob-ok{color:var(--good)}',
      '.lob-status{font-size:12px;color:var(--ink-faint)}',
      '.lob-code{font-family:var(--mono);font-size:14px;letter-spacing:.18em;padding:2px 8px;border:1px solid var(--line);border-radius:5px;color:var(--ink)}',
      /* the forces a line each among the terms, as the campaign lobby's slots (game.css .olob-*):
         the list grows with the terms rather than scrolling by itself; your own force's name opens its muster */
      '#lobby .lob-slots{overflow:visible;margin:2px 0 12px;padding-right:0}',
      '.lob-scroll > .lob-terms:first-child{margin-top:10px}',
      '#lobby .lob-slots .olob-who small{white-space:normal}',
      '.lob-who{background:none;border:0;padding:0;margin:0;text-align:left;color:var(--ink);font:inherit;cursor:pointer}',
      '.lob-who:hover b,.lob-who:focus-visible b{color:var(--alpha)}',
      '.lob-slots .lob-empty-seat{opacity:.7}',
      '.lob-slots .lob-empty-seat .lnk{flex:none}',
      '.lob-wait{opacity:.6}',
      '.lob-new{margin:4px 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2)}',
      '.lob-new .lob-foot{margin-top:4px;flex-wrap:nowrap;align-items:stretch}',
      '.lob-new .lob-foot .lnk{flex:none}',
      '.lob-kinds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
      '.lob-kind{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0;padding:9px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);text-align:left;cursor:pointer;font:inherit}',
      '.lob-kind b{font-family:var(--display);font-size:13px;letter-spacing:.06em;text-transform:uppercase}',
      '.lob-kind small{font-size:11.5px;line-height:1.3;color:var(--ink-dim)}',
      '.lob-kind:hover:not(:disabled){border-color:var(--ink-dim)}',
      '.lob-kind.on{border-color:var(--alpha);background:color-mix(in srgb,var(--alpha) 12%,var(--panel));box-shadow:inset 0 0 0 1px var(--alpha)}',
      '.lob-kind.on b{color:var(--alpha)}',
      '.lob-kind:disabled{opacity:.5;cursor:default}',
      '.lob-go{border-color:var(--alpha)!important;color:var(--alpha)!important}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function open(which) {
    ensure();
    if (root.PMCMenu) root.PMCMenu.close();          // the menu would sit on top
    view = which || view;
    host.hidden = false;
    draw();
    if (root.PMC_BACKDROP) root.PMC_BACKDROP();
  }
  function close() { if (host) host.hidden = true; if (root.PMC_BACKDROP) root.PMC_BACKDROP(); }

  /* ================= drawing ================= */
  function draw() {
    if (!host || host.hidden) return;
    var inRoom = !!(view === 'room' && room);
    el('lobby-body').innerHTML = inRoom ? roomHTML() : lobbyHTML();
    if (el('lobby-title')) el('lobby-title').textContent = inRoom ? room.name : 'Multiplayer';
    var us = el('lobby-user');
    if (us) {
      us.hidden = !account;
      el('lobby-user-name').textContent = account ? account.name + (account.guest ? ' (guest)' : '') : '';
      us.title = account ? (account.guest ? 'Playing as a guest' : 'Signed in as ' + account.name) : '';
      if (us.hidden) userMenu(false);
    }
    var cd = el('lobby-code');
    if (cd) { cd.hidden = !inRoom; cd.textContent = inRoom ? room.id : ''; cd.title = 'Read this out to whoever you are playing'; }
    var sh = host.querySelector('.lobby-sheet');
    if (sh) sh.classList.toggle('lob-sheet-room', !!(view === 'room' && room));
    var box = el('lobby-say') || el('room-say');
    if (box && document.activeElement !== box) { /* leave the caret where it was */ }
  }


  // ask the server who this browser is, then on to the lobby (or the sign-in)
  function whoAmI(then) {
    if (!root.fetch) { account = null; then(); return; }
    // only the server's answer settles it: a server that cannot be reached (restarting) leaves it as it was
    root.fetch('api/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        if (!(r.status === 401 || r.ok)) return { who: account };
        var took = function (j) { return r.ok ? j : { who: null }; };
        var jr = r.json();
        return jr && typeof jr.then === 'function' ? jr.then(took, function () { return { who: r.ok ? account : null }; }) : took(jr);
      })
      .then(function (j) { account = j.who || null; then(); })
      .catch(function () { if (account === undefined) fault = 'The server could not be reached.'; then(); });
  }
  /* Not signed in: the main menu's account screen asks (a guest's name will do for
     a battle), and the lobby opens once it is answered. Back goes to the main menu. */
  function askSignIn(then, why) {
    if (host) host.hidden = true;
    view = 'lobby';
    if (root.PMCAccount && root.PMCAccount.signIn) {
      root.PMCAccount.signIn({ guest: true, fault: why || '', lede: 'Sign in to play other people over the network.',
        then: then || function () { root.PMCLobby.open(); } });
    } else if (root.PMCMenu) root.PMCMenu.open();
  }
  function signOut() {
    keepRoom('');
    if (net) { net.disconnect(); net = null; }
    room = null; games = []; chat = { lobby: [], room: [] };
    root.fetch('api/logout', { method: 'POST', credentials: 'same-origin' }).catch(function () { });
    account = null; view = 'lobby';
    if (host) host.hidden = true;
    if (root.PMCMenu) root.PMCMenu.open();
    if (root.PMCAccount) root.PMCAccount.refresh();
    if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.accountChanged) root.PMC_CAMPAIGN.accountChanged();
  }

  function lobbyHTML() {
    var list = games.length ? games.map(gameRow).join('') :
      '<p class="lob-empty">No games open. Start one and read the code out to whoever you are playing.</p>';
    return '<div class="lob-scroll"><p class="lede">Play somebody else over the network. Start a game and read its code out, or join one with the code you were given. ' +
      '<span class="lob-status">' + esc(status) + '</span></p>' +
      '<p class="lob-bad">' + esc(fault) + '</p>' +

      // while a game is being started, the list of games to join stays out of the way
      (creating ? kindsHTML() :
        '<div class="field"><label for="join-code">Games</label>' +
        '<div class="lob-row">' +
        '<button class="lnk lob-go" data-lob="create">Start a game</button>' +
        '<input id="join-code" type="text" placeholder="Join a game or campaign with its code\u2026" maxlength="8" autocomplete="off">' +
        '<button class="lnk" data-lob="join">Join</button>' +
        '</div></div>' +
        mineHTML() +
        '<div class="lob-list">' + list + '</div>') +
      '</div>' +
      chatHTML('lobby');
  }

  /* The player's own games: a battle still being fought, to go back to (from any
     device, signed in as them), and the last few results. */
  function mineHTML() {
    if (!mine.length) return '';
    var live = mine.filter(function (g) { return g.status === 'battle'; }), done = mine.filter(function (g) { return g.status !== 'battle'; }).slice(0, 5);
    var row = function (g) {
      return '<div class="lob-game"><div><b>' + esc(g.name) + '</b>' + (g.against ? ' <span class="f">against ' + esc(g.against) + '</span>' : '') + '</div>' +
        '<div class="seats">' + (g.result ? esc(g.result.charAt(0).toUpperCase() + g.result.slice(1)) : 'Under way') + '</div>' +
        (g.status === 'battle' ? '<button class="lnk lob-go" data-lob="resume" data-id="' + esc(g.code) + '">Go back to it</button>' : '') + '</div>';
    };
    return '<div class="field"><label>Your games</label><div class="lob-list">' + live.concat(done).map(row).join('') + '</div></div>';
  }

  /* Start a game asks two things: what kind of game — a skirmish, co-op (not
     yet over the network), or a battle in one of the campaigns kept on this
     server — and whether it is listed for anyone to join or found by its code only. */
  function kindsHTML() {
    // three cards side by side, the one picked lit
    var card = function (v, t, sub, off) {
      return '<button type="button" class="lob-kind' + (v === newKind ? ' on' : '') + '" data-lob="kind" data-kind="' + esc(v) + '" aria-pressed="' + (v === newKind) + '"' +
        (off ? ' disabled' : '') + '><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></button>';
    };
    // a campaign is kept by an account: a guest is told so
    var guest = !account || account.guest;
    if (guest && newKind === 'ocamp') newKind = 'skirmish';
    var kinds = [card('skirmish', 'Skirmish', 'One battle, one against one'),
      card('coop', 'Co-op', 'The two of you against the OpFor'),
      card('ocamp', 'Campaign', guest ? 'Sign in with an account to start one' : 'A world of forces, players and AI', guest)];
    return '<div class="lob-new">' +
      '<div class="field"><label>Game</label><div class="lob-kinds" role="group" aria-label="Game">' + kinds.join('') + '</div></div>' +
      publicBox('lob-private', !newPrivate, '') +
      '<div class="lob-foot"><button class="lnk" data-lob="uncreate">Cancel</button>' +
      '<button class="start" data-lob="create" data-go="1">Create the game</button></div></div>';
  }

  function gameRow(g) {
    // an online campaign open to anyone: its second seat taken by joining it
    if (g.online) {
      var own = account && g.host === account.name;
      return '<div class="lob-game"><div><b>' + esc(g.name) + '</b> <span class="lob-code">' + esc(g.id) + '</span><br>' +
        '<span class="f small">Campaign \u2014 ' + (g.slots || 2) + ' forces, players and AI, each player on their own device</span></div>' +
        '<div class="seats">' + esc(g.host) + ' \u2014 ' + (g.open || 1) + ' slot' + ((g.open || 1) === 1 ? '' : 's') + ' open</div>' +
        '<button class="lnk" data-lob="join" data-id="' + esc(g.id) + '">' + (own ? 'Open it' : 'Join the campaign') + '</button></div>';
    }
    var seated = g.players.filter(function (p) { return p.name; });
    return '<div class="lob-game">' +
      '<div><b>' + esc(g.name) + '</b> <span class="lob-code">' + esc(g.id) + '</span><br>' +
      '<span class="f small">Tier ' + esc(root.PMC.ROMAN[g.settings.tier] || g.settings.tier) + ' · PL ' + esc(g.settings.pl) + ' — ' +
      esc(g.settings.kind === 'coop' ? 'Cooperative, against the OpFor' : g.settings.scenario) + (g.campaign ? ' — campaign “' + esc(g.campaign) + '”' : '') + '</span></div>' +
      '<div class="seats">' + seated.map(function (p) {
        return esc(p.name) + (p.ready ? ' ✓' : '');
      }).join(' vs ') + (seated.length < 2 ? ' — a seat free' : '') +
      (g.watchers ? ' — ' + g.watchers + ' watching' : '') + '</div>' +
      '<button class="lnk" data-lob="join" data-id="' + esc(g.id) + '">' +
      (g.phase === 'setup' && seated.length < 2 ? 'Take the seat' : 'Watch') + '</button>' +
      '</div>';
  }

  // the colour a seat's force is shown in: the one picked for it, or the side's own
  function seatColour(seat) {
    var p = room && room.seats && room.seats[seat], f = (p && p.force) || {};
    var col = root.PMCIso && root.PMCIso.COLOURS && root.PMCIso.COLOURS[f.colour];
    return col ? col.light : 'var(--side-' + (seat === 'B' ? 'B' : 'A') + ')';
  }
  /* ---- the table talk on the battlefield ----
     An online battle has its room's chat under the action buttons (and on a phone,
     a Chat tab of its own that counts what was said while it was shut). */
  var chatUnread = 0, chatShown = false, chatDrawn = -1;
  function battleChatOn() { return !!(root.PMC_BATTLE_ABANDONABLE && root.PMC_BATTLE_ABANDONABLE() && room); }
  function chatTabOpen() {
    var con = document.querySelector('.console');
    return root.innerWidth > 1000 || !!(con && con.getAttribute('data-mtab') === 'chat');
  }
  function battleChat() {
    var box = el('battle-chat');
    if (!box) return;
    var on = battleChatOn();
    if (on !== chatShown) {
      chatShown = on;
      box.hidden = !on;
      chatDrawn = -1;                 // drawn afresh, in the battle's own colours
      if (on) document.body.setAttribute('data-online', '1'); else document.body.removeAttribute('data-online');
      var tab = document.querySelector('#mtabs .mtab-chat');
      if (tab) tab.hidden = !on;
      if (!on) { chatUnread = 0; chatDrawn = -1; var con = document.querySelector('.console'); if (con && con.getAttribute('data-mtab') === 'chat' && root.PMC_SET_MTAB) root.PMC_SET_MTAB('act'); }
    }
    if (chatTabOpen()) chatUnread = 0;
    var n = el('mtab-chat-n');
    if (n) n.textContent = chatUnread ? (chatUnread > 9 ? '9+' : chatUnread) : '';
    if (!on) return;
    var lines = chat.room || [];
    if (chatDrawn === lines.length + (room ? room.id : '')) return;
    chatDrawn = lines.length + (room ? room.id : '');
    var lb = el('bchat-lines');
    lb.innerHTML = lines.length ? lines.map(function (l) {
      // on the battlefield, each side's own colours as the board paints them
      var pal = l.seat && root.PMCIso && root.PMCIso.PALETTE && root.PMCIso.PALETTE[l.seat];
      var c = pal ? pal.ink : l.seat ? seatColour(l.seat) : '';
      return l.from ? '<p><b' + (c ? ' style="color:' + c + '"' : '') + '>' + esc(l.from) + '</b> ' + esc(l.text) + '</p>' : '<p class="note">' + esc(l.text) + '</p>';
    }).join('') : '<p class="note">Nothing said yet.</p>';
    lb.scrollTop = lb.scrollHeight;
  }
  function battleSay() {
    var box = el('bchat-say');
    if (!box || !net) return;
    var text = (box.value || '').trim();
    if (!text) return;
    net.send('game.chat', { text: text });
    box.value = '';
  }
  function wireBattleChat() {
    var send = el('bchat-send'), box = el('bchat-say'), tabs = el('mtabs');
    if (send) send.addEventListener('click', battleSay);
    if (box) box.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); battleSay(); } e.stopPropagation(); });
    // the Chat tab opened: what was said is read
    if (tabs) tabs.addEventListener('click', function () { setTimeout(battleChat, 0); });
    // a battle begun, ended or left: shown or put away
    setInterval(battleChat, 1500);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireBattleChat); else wireBattleChat();
  }

  function chatHTML(where) {
    var lines = chat[where] || [];
    var id = where === 'lobby' ? 'lobby-say' : 'room-say';
    return '<div class="lob-chat">' + (where === 'lobby' ? '<h4>Lobby</h4>' : '') +
      '<div class="lob-lines" id="' + id + '-lines">' +
      (lines.length ? lines.map(function (l) {
        // at a table, each player's name in the colour of the force they have picked
        var c = where === 'room' && l.seat ? seatColour(l.seat) : '';
        return l.from
          ? '<p class="said"><b' + (c ? ' style="color:' + c + '"' : '') + '>' + esc(l.from) + '</b> ' + esc(l.text) + '</p>'
          : '<p class="note">' + esc(l.text) + '</p>';
      }).join('') : '<p class="note">Nothing said yet.</p>') +
      '</div>' +
      '<div class="lob-row"><input id="' + id + '" type="text" maxlength="' + P.LIMITS.chat +
      '" placeholder="Say something…" autocomplete="off">' +
      '<button class="lnk" data-lob="say" data-where="' + where + '">Send</button></div></div>';
  }

  /* The room, top to bottom: what to do next (leave, ready, start), then the
     terms with a line for each force among them as the campaign lobby has its
     slots (dossier-online.js) — the size of the battle first, then the forces,
     then where it is fought — all of it scrolling, and the table talk kept at the foot. */
  function roomHTML() {
    var host_ = room.hostId === me.id;
    var mine = mySeat();
    var ready = mine && room.seats[mine] && room.seats[mine].ready;
    // the colours left open on a force that is no longer there (a player gone) close
    if (colourFor && colourFor !== 'op' && !(colourFor === mine && room.seats[mine])) colourFor = null;
    if (colourFor === 'op' && !(host_ && room.settings.kind === 'coop')) colourFor = null;
    setTimeout(function () {
      placePop();
      var sc = host && host.querySelector('.lob-scroll'); if (sc) sc.onscroll = placePop;
    }, 0);
    return '<p class="lob-bad">' + esc(fault) + '</p>' +
      /* as every other screen has it: the way out a quiet link, the one thing to
         do next the full-width button — say you are ready, then (the host) take the field */
      '<div class="lob-foot lob-acts">' +
      '<button class="lnk" data-lob="leave">Leave this game</button>' +
      (mine && ready ? '<button class="lnk" data-lob="ready">Not ready after all</button>' : '') +
      (mine && !ready ? '<button class="start" data-lob="ready">I am ready</button>'
        : host_ ? '<button class="start" data-lob="start"' + (room.canStart ? '' : ' disabled') + '>Take the field</button>'
        // the other player's word on the start sits where the host's button does, and as tall
        : '<button class="start" disabled>' +
          (room.canStart ? 'Waiting for the host to start' : 'Waiting for both sides') + '</button>') +
      '</div>' +
      (room.watchers.length
        ? '<p class="small lob-watch">Watching: ' +
          room.watchers.map(function (w) { return esc(w.name); }).join(', ') + '</p>' : '') +
      '<div class="lob-scroll">' + termsHTML(host_, mine) + '</div>' +
      popHTML(mine, host_) +
      chatHTML('room');
  }

  // a game's one yes-or-no term: whether it is shown in the game list
  function publicBox(id, on, attrs) {
    return '<div class="field lob-pub"><label for="' + id + '"><input type="checkbox" id="' + id + '"' +
      (on ? ' checked' : '') + attrs + '> Public</label></div>';
  }

  // the setup screen's own wording for a scenario or a world, where it has one
  function optionText(selId, v, fallback) {
    var sel = document.getElementById(selId);
    var o = sel && sel.options && sel.options.length
      ? Array.prototype.filter.call(sel.options, function (x) { return x.value === String(v); })[0] : null;
    return o ? o.textContent : fallback;
  }

  /* The terms: the Battle Tier (and, a skirmish, its Priority Level) on top, the
     forces under them a line each, then the scenario, the world, the table and
     whether the game is listed. Only the host changes them. */
  function termsHTML(isHost, mine) {
    var s = room.settings, d = isHost ? '' : ' disabled', coop = s.kind === 'coop';
    function sel(id, label, options, value) {
      return '<div class="field"><label for="' + id + '">' + label + '</label>' +
        '<select id="' + id + '" data-term="' + id.replace('term-', '') + '"' + d + '>' +
        options.map(function (o) {
          var v = o.v === undefined ? o : o.v, t = o.t === undefined ? o : o.t;
          return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('') + '</select></div>';
    }
    var tier = sel('term-tier', 'Battle Tier', P.TIERS.map(function (t) {
      return { v: t, t: root.PMC.ROMAN[t] + ' — ' + root.PMC.COMPOSITION[t].points + ' points' };
    }), s.tier);
    var world = sel('term-planet', 'World', P.PLANET_CHOICES.map(function (x) {
      return { v: x, t: optionText('sel-planet', x, x) };
    }), s.planet) +
      sel('term-terrain', 'Terrain set-up', [
        { v: 'auto', t: optionText('sel-terrain', 'auto', 'Generate the table') },
        { v: 'manual', t: optionText('sel-terrain', 'manual', 'Set it up by hand') }
      ], s.terrain || 'auto') +
      publicBox('term-private', !s.private, ' data-term="private"' + d);
    // a cooperative game: commandos (Priority Level 1 each) under a solitaire scenario, against the OpFor
    if (coop) {
      var SOLO = root.PMCSolo;
      return '<div class="lob-terms">' + tier + '</div>' +
        forcesHTML(mine, isHost) +
        '<div class="lob-terms">' +
        sel('term-soloScen', 'Scenario', [{ v: 'roll', t: optionText('sel-solo-scen', 'roll', 'Roll for it') }].concat((SOLO ? SOLO.ORDER : []).map(function (x) {
          return { v: x, t: optionText('sel-solo-scen', x, (SOLO && SOLO.SCENARIOS[x] && SOLO.SCENARIOS[x].name) || x) };
        })), s.soloScen || 'roll') +
        world +
        '<p class="lob-note">Cooperative: each of you musters a commando; the OpFor is the machine’s. You take turns, an activation each.</p>' +
        '</div>';
    }
    return '<div class="lob-terms">' + tier +
      sel('term-pl', 'Priority Level', [{ v: 1, t: '1 — skirmish' }, { v: 2, t: '2 — full battle' }], s.pl) +
      '</div>' +
      forcesHTML(mine, isHost) +
      '<div class="lob-terms">' +
      sel('term-scenario', 'Scenario', P.SCENARIOS.map(function (x) {
        return { v: x, t: optionText('sel-scen', x, x) };
      }), s.scenario) +
      world +
      '</div>';
  }

  /* ---- the forces, a line each, as the campaign lobby's slots ----
     Each its colours (a chip that opens them), its name with who holds it under,
     and its army: your own to change — tap its name to muster it — the other
     player's to read; a cooperative game's OpFor the host's. */
  var colourFor = null;         // whose colours are open: a seat ('A' or 'B'), 'op' for the OpFor, or null
  function colours() { return (root.PMCIso && root.PMCIso.COLOURS) || {}; }
  // the army, the campaign lobby's words: this player's to change, or read out (ui-parts.js)
  function armyHTML(attr, value, canChange) {
    return canChange ? U.armySelect(attr + ' aria-label="Army"', value) : U.armyStill(value);
  }
  function forcesHTML(mine, isHost) {
    var coop = room.settings.kind === 'coop';
    var h = '<div class="olob-slots lob-slots">' + slotHTML('A', mine) + slotHTML('B', mine);
    if (coop) {
      // the machine's side: its army and colours the host's to pick, its list rolled at the battle
      var oc = room.settings.opColour, ocn = colours()[oc];
      h += '<div class="olob-slot lob-slot-op">' +
        (isHost ? U.chipButton('data-lob="colours" data-for="op"', U.chip(oc), colourFor === 'op', ocn ? ocn.name : 'Colours: picked for the battle')
          : U.chipStill(U.chip(oc), ocn ? ocn.name : 'Picked for the battle')) +
        '<span class="olob-who"><b>The OpFor</b><small>the machine’s · rolled for the battle</small></span>' +
        armyHTML('data-lob-army="op"', room.settings.opFaction || 'pmc', isHost) + '</div>';
    }
    return h + '</div>';
  }
  function slotHTML(which, mine) {
    var p = room.seats[which], coop = room.settings.kind === 'coop';
    var label = coop ? (which === 'A' ? 'Player 1' : 'Player 2') : 'Seat ' + which;
    if (!p) {
      return '<div class="olob-slot lob-empty-seat">' + U.chipStill(U.chip(null)) +
        '<span class="olob-who"><b><em>Empty — waiting for a player</em></b><small>' + label + '</small></span>' +
        (mine ? '' : '<button class="lnk" data-lob="sit" data-seat="' + which + '">Sit here</button>') + '</div>';
    }
    var f = p.force || {}, own = which === mine, c = colours()[f.colour];
    // the other player's list is kept from this screen until the battle (server/hidden.js): only how many
    var units = f.keys ? f.keys.length : (f.units || 0);
    var sub = label + ' · ' + esc(p.name) + (p.host ? ' · host' : '') + (p.away ? ' · away' : '') + ' · ' +
      (units ? units + ' units' : own ? 'tap to muster it' : 'still mustering') + (own && f.tactic ? ' · ' + esc(f.tactic) : '') +
      ' · <span class="' + (p.ready ? 'lob-ok' : 'lob-wait') + '">' + (p.ready ? 'Ready' : 'Not ready yet') + '</span>';
    var name = '<b>' + esc(f.name || (units ? 'An unnamed force' : 'No force yet')) + '</b><small>' + sub + '</small>';
    return '<div class="olob-slot' + (own ? ' mine' : '') + (p.ready ? ' ready' : '') + '">' +
      (own ? U.chipButton('data-lob="colours" data-for="' + which + '"', U.chip(f.colour), colourFor === which, c ? c.name : 'Colours')
        : U.chipStill(U.chip(f.colour), c ? c.name : '')) +
      // your own force's name opens the muster, to pick its units
      (own ? '<button type="button" class="olob-who lob-who" data-lob="muster" title="Muster this force">' + name + '</button>'
        : '<span class="olob-who">' + name + '</span>') +
      armyHTML('data-lob-army="' + which + '"', f.faction || 'pmc', own) + '</div>';
  }
  // the colours each force wears now: the two seats', and a cooperative game's OpFor's
  function wornBy() {
    var w = {};
    P.SEATS.forEach(function (sd) { var p = room.seats[sd]; if (p && p.force && p.force.colour) w[sd] = p.force.colour; });
    if (room.settings.kind === 'coop' && room.settings.opColour) w.op = room.settings.opColour;
    return w;
  }
  /* The colours, popped up under the chip as the campaign lobby's are: drawn
     outside the scrolling terms (so they are not cut off), and put by the chip
     once drawn. A colour another force wears is greyed out. */
  function popHTML(mine, isHost) {
    if (!colourFor) return '';
    var worn = wornBy();
    return U.colourPop('data-lob-popfor="' + colourFor + '"', worn[colourFor], function (k) {
      var taken = Object.keys(worn).some(function (o) { return o !== colourFor && worn[o] === k; });
      return { attrs: 'data-lob="colour" data-col="' + k + '"', off: taken, note: taken ? ' — another force wears it' : '' };
    });
  }
  function placePop() {
    var pop = host && host.querySelector('.lob-sheet-room .olob-pop'); if (!pop) return;
    var chip = host.querySelector('[data-lob="colours"][data-for="' + pop.getAttribute('data-lob-popfor') + '"]');
    var body = host.querySelector('.lobby-sheet');
    if (!chip || !body) return;
    var r = chip.getBoundingClientRect(), b = body.getBoundingClientRect(), w = Math.min(380, b.width - 16);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(b.left + 8, Math.min(r.left, b.right - w - 8)) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
  }
  // a name made up from a force's colours and kind, which follows them when either changes
  function madeUpName(n) { return !n || U.isForceName(n); }
  function nameFor(colour, faction) { return U.forceName(colour, faction); }
  /* Your own force, changed from its line and sent to the room as the muster
     sends it (game.force): new colours, or a new army — which rolls the force
     afresh for that army, as a commando in a cooperative game. */
  function sendForce(change) {
    var mine = mySeat(), p = mine && room.seats[mine];
    if (!p) return;
    var f = Object.assign({}, p.force || {}, change);
    if (change.faction && change.faction !== (p.force || {}).faction) {
      var s = room.settings, R = root.PMC, SOLO = root.PMCSolo;
      f.tactic = ''; f.roster = null;
      f.keys = s.kind === 'coop' ? (SOLO ? SOLO.rollCommando(s.tier, 1, f.faction) : [])
        : (R && R.rollArmy ? R.rollArmy(s.tier, s.pl, null, f.faction) : []);
    }
    if (madeUpName(f.name)) f.name = nameFor(f.colour, f.faction || 'pmc');
    myForce = f;
    net.send('game.force', { force: f });
  }
  function pickColour(k) {
    var who = colourFor;
    colourFor = null;
    if (who === 'op') net.send('game.settings', { patch: { opColour: k } });
    else if (who && who === mySeat()) sendForce({ colour: k });
    draw();
  }

  /* ================= what the screen does ================= */
  function userMenu(on) {
    var m = el('lobby-usermenu'), u = el('lobby-user');
    if (!m) return;
    m.hidden = !on;
    if (u) u.setAttribute('aria-expanded', String(!!on));
  }
  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-lob]') : null;
    if (!b || b.getAttribute('data-lob') !== 'usermenu') { if (el('lobby-usermenu') && !el('lobby-usermenu').hidden && !(b && /^(signout|account)$/.test(b.getAttribute('data-lob')))) userMenu(false); }
    // a tap anywhere but the colours (or the chip that opens them) puts them away
    if (colourFor && !(e.target.closest && e.target.closest('.olob-pop, [data-lob="colours"]'))) { colourFor = null; if (!b) draw(); }
    if (b) { act(b.getAttribute('data-lob'), b); return; }
    var t = e.target.closest ? e.target.closest('[data-term]') : null;
    if (t) return;                    // handled on change, below
  }

  function act(what, b) {
    fault = '';
    switch (what) {
      case 'usermenu': userMenu(el('lobby-usermenu').hidden); return;
      case 'signout': userMenu(false); signOut(); return;
      // the main menu's account pane: what the server keeps for the player
      case 'account': userMenu(false); close(); if (root.PMCAccount) root.PMCAccount.show(); return;
      case 'create': {
        // the first press opens the form; Create the game starts it
        if (!b.getAttribute('data-go')) { creating = true; draw(); return; }
        var terms = { tier: 3, pl: 1, planet: 'random', scenario: 'roll', private: newPrivate };
        // an online campaign: made on the server, and founded in the campaign screens (dossier-online.js)
        if (newKind === 'ocamp') {
          creating = false; close();
          if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.newOnline) root.PMC_CAMPAIGN.newOnline({ listed: !newPrivate });
          return;
        }
        if (newKind.indexOf('camp:') === 0) {
          if (!newKind.slice(5)) { fault = 'There is no campaign on this server to fight under.'; draw(); return; }
          terms.campaign = newKind.slice(5);
        } else if (newKind === 'coop') {
          // both players' commandos against the OpFor, under a solitaire scenario
          terms.kind = 'coop'; terms.soloScen = 'roll'; terms.opFaction = 'rebel';
        } else if (newKind !== 'skirmish') { fault = 'That kind of game cannot be played over the network yet.'; draw(); return; }
        creating = false;
        net.send('game.create', {
          name: me.name + '’s battle',
          settings: terms,
          force: myForce || currentForce()
        });
        return;
      }
      case 'kind': newKind = b.getAttribute('data-kind'); draw(); return;
      case 'uncreate': creating = false; draw(); return;
      case 'join': return join(b.getAttribute('data-id') || (el('join-code') || {}).value);
      case 'resume': return join(b.getAttribute('data-id'));
      case 'sit': net.send('game.seat', { seat: b.getAttribute('data-seat') }); return;
      case 'leave': colourFor = null; keepRoom(''); net.send('game.leave'); view = 'lobby'; draw(); return;
      case 'leave-lobby':
        close();
        // back to the battle if one is on, otherwise to the menu
        if (root.PMCMenu && !(root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE())) root.PMCMenu.open();
        return;
      case 'ready': {
        var mine = mySeat();
        if (!mine) return;
        if (!room.seats[mine].force || !room.seats[mine].force.keys.length) {
          fault = 'Pick a force first.';
          draw();
          return;
        }
        net.send('game.ready', { ready: !room.seats[mine].ready });
        return;
      }
      case 'muster': askForMuster(); return;
      // a force's colours, under its chip; one picked from them
      case 'colours': { var w = b.getAttribute('data-for'); colourFor = colourFor === w ? null : w; draw(); return; }
      case 'colour': if (!b.disabled) pickColour(b.getAttribute('data-col')); return;
      case 'start': net.send('game.start'); return;
      case 'say': say(b.getAttribute('data-where'), null); return;
    }
  }

  function mySeat() {
    if (!room) return null;
    return room.seats.A && room.seats.A.id === me.id ? 'A'
      : room.seats.B && room.seats.B.id === me.id ? 'B' : null;
  }

  function join(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) { fault = 'Type the code the host read out.'; draw(); return; }
    // a battle's code is five letters; an online campaign's invite, eight: the second seat in it
    if (code.length === 8) { joinCampaign(code); return; }
    net.send('game.join', { id: code });
  }
  function joinCampaign(code) {
    if (!account || account.guest) { fault = 'That is a campaign\u2019s code: sign in with an account to join it.'; draw(); return; }
    root.fetch('api/online/join', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (got) {
        if (!got.ok) { var why = got.j.error || got.j.why || 'that code did not work'; fault = why.charAt(0).toUpperCase() + why.slice(1) + '.'; draw(); return; }
        close();
        if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.openOnline) root.PMC_CAMPAIGN.openOnline(got.j.id);
      })
      .catch(function () { fault = 'The server could not be reached.'; draw(); });
  }

  function say(where, box) {
    box = box || el(where === 'lobby' ? 'lobby-say' : 'room-say');
    if (!box) return;
    var text = (box.value || '').trim();
    if (!text) return;
    net.send(where === 'lobby' ? 'lobby.chat' : 'game.chat', { text: text });
    box.value = '';
  }

  /* The force is built on the setup screen, which already knows how: the lobby
     hands the screen over and takes the answer back. */
  function askForMuster() {
    close();
    if (root.PMC_MUSTER_FOR) {
      var mine = mySeat(), had = (mine && room.seats[mine] && room.seats[mine].force) || myForce;
      root.PMC_MUSTER_FOR(room.settings, function (force) {
        if (force) { myForce = force; net.send('game.force', { force: force }); }
        open('room');
      }, had, room.name, mine);
      return;
    }
    open('room');
  }
  function currentForce() {
    return root.PMC_MUSTER_NOW ? root.PMC_MUSTER_NOW() : null;
  }

  /* Terms are sent as they are changed rather than on a button: the other side
     should see the tier move while it is being argued about. */
  function onTermChange(e) {
    if (e.target && e.target.id === 'lob-private') { newPrivate = !e.target.checked; return; }
    var box = e.target, k = box && box.getAttribute && box.getAttribute('data-term');
    // an army picked on a force's line: your own (rolled afresh for it), or the host's for the OpFor
    var army = box && box.getAttribute && box.getAttribute('data-lob-army');
    if (army && net && room) {
      if (army === 'op') net.send('game.settings', { patch: { opFaction: box.value } });
      else if (army === mySeat()) sendForce({ faction: box.value });
      return;
    }
    if (!k || !net) return;
    var patch = {};
    patch[k] = k === 'tier' || k === 'pl' ? +box.value : k === 'private' ? !box.checked : box.value;
    if (k === 'campaign' && !box.value) patch.campaign = null;
    net.send('game.settings', { patch: patch });
  }
  function wireTerms() { /* the overlay listens for every term; see onTermChange */ }


  /* The game this browser was last seated at, kept so a refresh (or coming back
     tomorrow) can walk straight back into it. */
  var ROOM_KEY = 'pmc-room';
  function lastRoom() { try { return localStorage.getItem(ROOM_KEY) || ''; } catch (e) { return ''; } }
  function keepRoom(id) {
    try { if (id) localStorage.setItem(ROOM_KEY, id); else localStorage.removeItem(ROOM_KEY); } catch (e) { }
  }

  /* ================= the wire ================= */
  function connect(url) {
    if (net) return net;
    net = new NET.Remote(url);
    me = NET.identity();

    net.on('up', function () { status = 'connected'; draw(); });
    net.on('down', function (m) {
      status = 'not connected';
      fault = m && m.why ? m.why : '';
      draw();
      // a session that has lapsed (or was signed out elsewhere) is not let back on: sign in again
      whoAmI(function () {
        if (account !== null || !net) return;
        net.disconnect(); net = null;
        askSignIn(null, 'Signed out \u2014 sign in again to carry on.');
      });
    });
    net.on('welcome', function (m) {
      me.id = m.you.id; me.name = m.you.name;
      games = m.games || [];
      chat.lobby = m.chat || [];
      status = 'connected';         // who as is said on the line under it
      net.send('games.mine');
      loadCampaigns();
      draw();
      /* A seat still held for this browser comes back by itself with the hello.
         Otherwise, a game it was in is asked for again by its code — it may be
         over, or gone, and the server says so. */
      /* Only a battle under way is walked back into. A game still being set up
         is left in the list to join again by choice: walking into it by itself
         put a player in an old room while their opponent waited in a new one. */
      var back = lastRoom();
      /* A private game is not in the list, so one missing from it is still
         asked for: the server says if it has gone. */
      var was = back && games.filter(function (gm) { return gm.id === back; })[0];
      if (back && was && was.phase !== 'battle') { keepRoom(''); back = ''; }
      if (back) setTimeout(function () { if (!room && lastRoom() === back) net.send('game.join', { id: back }); }, 400);
    });
    net.on('lobby', function (m) { games = m.games || []; draw(); });
    net.on('mine', function (m) { mine = m.games || []; draw(); });
    net.on('lobby.chat', function (m) {
      chat.lobby.push(m);
      if (chat.lobby.length > P.LIMITS.chatLog) chat.lobby.shift();
      draw();
    });
    net.on('game', function (m) {
      room = m.room;
      // remembered to resume only once its battle is under way (or, ended, until its result is read: see 'over')
      if (!(unread && !room)) keepRoom(room && room.phase === P.PHASE.BATTLE ? room.id : '');
      if (!room) { view = 'lobby'; draw(); return; }
      chat.room = room.chat || chat.room;
      view = 'room';
      draw();
      wireTerms();
    });
    net.on('game.chat', function (m) {
      chat.room.push(m);
      if (chat.room.length > P.LIMITS.chatLog) chat.room.shift();
      // said while the battle is on, and the phone's Chat tab not open: counted on the tab
      if (m.from && m.from !== me.name && battleChatOn() && !chatTabOpen()) chatUnread++;
      draw();
      battleChat();
    });
    net.on('error', function (m) {
      fault = m.text || '';
      if (/no game with that code|that battle is over/.test(fault) && lastRoom()) { keepRoom(''); fault = ''; }   // it has gone since
      // an online campaign's battle that is not there to walk into: back to the campaign, not an empty table
      if (/no game with that code|that battle is over/.test(m.text || '') && campBattle) {
        var hb = campBattle; campBattle = null; campOver = false; fault = '';
        say2(/over/.test(m.text) ? 'That battle is over — back to the campaign.' : 'That battle is not on the server any more.', 'warn', 6000);
        hb.gone();
      }
      /* Come back (a refresh, the Continue list) to a campaign's battle that ended
         before its result was read here: on to that campaign, where its aftermath
         is waiting. */
      else if (/that battle is over/.test(m.text || '') && m.campaign && root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.openOnline) {
        fault = '';
        say2('That battle is over — on to its aftermath.', 'warn', 6000);
        close();
        root.PMC_CAMPAIGN.openOnline(m.campaign);
      }
      draw();
    });
    net.on('started', function (m) {
      close();
      if (root.PMC_JOIN_BATTLE) root.PMC_JOIN_BATTLE(net, m.seat, m.cfg);
      battleChat();
    });
    net.on('over', function () {
      if (net) net.send('games.mine');
      /* A campaign's battle is remembered until its result has been read here:
         a refresh before then comes back to it, finds it over, and goes on to
         its aftermath (the 'error' above). Anything else is forgotten now. */
      var st = root.PMC_STATE && root.PMC_STATE(), campaign = !!(campBattle || (st && st.cfg && st.cfg.onlineCampaign));
      if (!campaign || !root.PMC_AFTER_RESULT) keepRoom('');
      else { unread = true; root.PMC_AFTER_RESULT(function () { unread = false; keepRoom(''); }); }
      // an online campaign's battle: the campaign takes it from here (dossier-online.js)
      if (campBattle) { var h = campBattle; campBattle = null; campOver = true; h.over(); }
      // come back to some other way (the Continue list, a reload): once the result is read, its campaign
      else if (!backToCampaign(true)) afterSkirmish();
    });
    /* A battle between two players over: once this player has read the result
       and pressed Continue, the room comes up for a rematch — or, if they have
       left it (the other player walked away), the list of games. */
    function afterSkirmish() {
      if (!root.PMC_AFTER_RESULT) return;
      root.PMC_AFTER_RESULT(function () {
        if (!net) return;
        if (room) { open('room'); return; }
        if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE();
        open('lobby');
      });
    }
    function overOnBoard() { var st = root.PMC_STATE && root.PMC_STATE(); return !!(st && st.over); }
    /* The other player dropping out, coming back or walking away, said on the
       board while the battle is on (the room's chat is not on screen then). */
    net.on('game.presence', function (m) {
      // (a battle just ended by it — a forfeit — is still on the board, its result up)
      if (!m || m.id === me.id || !((root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE()) || overOnBoard())) return;
      var who = m.name || 'Your opponent';
      if (m.kind === 'dropped') say2(who + ' has lost connection. Their seat is being held for them.', 'warn');
      else if (m.kind === 'back') say2(who + ' is back.', 'good');
      else if (m.kind === 'left' && (campBattle || campOver)) {
        // an online campaign's battle: no lobby to go back to; the campaign comes up
        keepRoom('');
        say2(who + ' has left the battle \u2014 you win by forfeit.', 'good', 7000);
        var hc = campBattle; campBattle = null; campOver = false;
        if (hc) { if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE(); hc.gone(); }
      }
      else if (m.kind === 'left' && backToCampaign(false)) { keepRoom(''); say2(who + ' has left the battle \u2014 you win by forfeit.', 'good', 7000); }
      else if (m.kind === 'left') {
        keepRoom('');
        // a cooperative game: the partner gone, the two of them lose it together
        var coopGone = !!(root.PMC_STATE && root.PMC_STATE() && root.PMC_STATE().cfg && root.PMC_STATE().cfg.netCoop);
        say2(who + ' has left the battle' + (coopGone ? ' \u2014 without them, the OpFor has it.' : m.forfeit ? ' \u2014 you win by forfeit.' : '. It cannot go on without them.'), coopGone ? 'bad' : m.forfeit ? 'good' : 'bad', 7000);
        if (net) net.send('games.mine');
        /* Walked away from, the battle was ended on the server with this side the
           winner, and its result is on the board: this player leaves the room now,
           and goes on to the list of games once it is read (afterSkirmish). */
        if (m.forfeit && overOnBoard()) { net.send('game.leave'); room = null; return; }
        /* The battle on the screen is over, and so is the game: this player
           leaves its room too (it would only hold them in a game with nobody
           to play), and is put back in the list of games to start another. */
        if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE();
        net.send('game.leave');
        room = null;
        setTimeout(function () { open('lobby'); }, 2500);
      }
    });

    net.connect(me.name || 'Commander');
    return net;
  }

  function loadCampaigns() {
    if (!root.fetch) return;
    // relative to the page, as the WebSocket is (net.js): the server may sit on a sub-path
    root.fetch('campaigns').then(function (r) { return r.json(); })
      .then(function (j) { campaigns = j.campaigns || []; draw(); })
      .catch(function () { campaigns = []; });
  }

  /* A campaign battle this screen came back to without the campaign's hooks (from
     the Continue list, or after a reload): its campaign (cfg.onlineCampaign) is
     opened again once it is over — the result read first, if it is on the board. */
  var backing = null;
  var unread = false;              // an online campaign's battle over, its result not yet read here
  function backToCampaign(read) {
    var st = root.PMC_STATE && root.PMC_STATE(), id = st && st.cfg && st.cfg.onlineCampaign;
    if (!id || !root.PMC_CAMPAIGN || !root.PMC_CAMPAIGN.openOnline) return false;
    if (backing === id) return true;                 // already on its way back (told it is over, then that the other player left)
    backing = id;
    var go = function () { backing = null; if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE(); root.PMC_CAMPAIGN.openOnline(id); };
    // (the server applies the result as the battle ends: a moment for it before the campaign is asked for)
    if ((read || st.over) && root.PMC_AFTER_RESULT) root.PMC_AFTER_RESULT(function () { setTimeout(go, 600); });
    else setTimeout(go, read ? 900 : 2500);
    return true;
  }
  function say2(text, kind, ms) { if (root.PMC_TOAST) root.PMC_TOAST(text, kind, ms); }

  /* An online campaign's battle walked into (dossier-online.js): what to do when it
     is over, or walked away from, instead of coming back to the lobby. */
  var campBattle = null, campOver = false;
  root.PMCLobby = {
    /* Walk away from the battle under way: the seat is given up, which ends it
       for the other player too, and this browser forgets it was ever in it. */
    abandon: function () {
      unread = false; keepRoom('');
      if (net) net.send('game.leave');
      if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE();
      var hc = campBattle; campBattle = null; campOver = false;
      if (hc) hc.gone();
    },
    /* Into an online campaign's battle by its code: the seat is held for this
       player, so joining it seats them (lobby.js join). `hooks`: { over, gone }. */
    joinBattle: function (code, hooks) {
      ensure();
      campBattle = hooks || null; campOver = false;
      var go = function () { connect(); net.send('game.join', { id: code }); };
      if (account) { go(); return; }
      whoAmI(function () {
        if (account) { me.name = account.name; go(); }
        else { var h = campBattle; campBattle = null; askSignIn(function () { root.PMCLobby.joinBattle(code, h); }); }
      });
    },
    /* Is there a server to play against at all? A page opened from a file, or
       the published single file, has none — and the button that opens this is
       only offered when there is. */
    available: function () { return NET.online(); },
    open: function () {
      ensure();
      // signed in: on to the lobby; not: the sign-in first (the socket wants a session)
      if (account) { connect(); open(room ? 'room' : 'lobby'); return; }
      // who this is first: signed in, the lobby; not, the account screen asks
      whoAmI(function () {
        if (account) { me.name = account.name; connect(); open(room ? 'room' : 'lobby'); }
        else askSignIn();
      });
    },
    close: close,
    net: function () { return net; },
    /* Signed in or out from the main menu (account.js): a connection made as the
       player who was signed in before is closed, and the next opening asks again. */
    accountChanged: function () {
      if (net) { net.disconnect(); net = null; }
      room = null; games = []; mine = []; chat = { lobby: [], room: [] };
      account = undefined; view = 'lobby';
    },
    // the code of a game this browser was seated at and may go back to
    resumable: function () { return lastRoom(); },
    /* Back to a battle of the player's still being fought online, by its code (the
       main menu's Continue list): their seat is held for them, so joining it seats them. */
    rejoin: function (code) {
      ensure();
      campBattle = null; campOver = false;
      var go = function () { keepRoom(code); connect(); net.send('game.join', { id: code }); };
      if (account) { go(); return; }
      whoAmI(function () {
        if (account) { me.name = account.name; go(); }
        else askSignIn(function () { root.PMCLobby.rejoin(code); });
      });
    }
  };
})(typeof window !== 'undefined' ? window : global);
