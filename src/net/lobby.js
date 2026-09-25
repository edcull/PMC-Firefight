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

  var P = root.PMCProto, NET = root.PMCNet;
  var net = null;
  var host = null;              // the overlay
  var view = 'lobby';           // 'lobby' | 'room'
  var games = [];
  var room = null;
  var me = { id: null, name: '' };
  var chat = { lobby: [], room: [] };
  var status = '';
  var fault = '';
  var campaigns = [];
  var myForce = null;           // the force this screen has built, as the lobby sees it

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
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
    host.innerHTML = '<div class="camp-top"><button type="button" class="camp-back" data-lob="leave-lobby">\u2190 Back</button>' +
      '<h1 id="lobby-title">Multiplayer</h1><span class="lob-code" id="lobby-code" hidden></span></div>' +
      '<div class="sheet lobby-sheet"><div id="lobby-body"></div></div>';
    document.body.appendChild(host);
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
      '#lobby > .camp-top .lob-code{margin-left:auto}',
      '@media (min-width:1001px){' +
        '#lobby.overlay{padding:28px 20px;align-items:center;justify-content:center}' +
        '#lobby > .camp-top{position:relative;width:min(760px,100%);border:1px solid var(--line);border-radius:8px 8px 0 0;background:color-mix(in srgb,var(--panel) 95%,transparent)}' +
        '#lobby.overlay > .sheet{position:relative;flex:0 1 auto;width:min(760px,100%);padding:18px 22px 22px;border:1px solid var(--line);border-top:0;border-radius:0 0 8px 8px;background:color-mix(in srgb,var(--panel) 95%,transparent)}' +
      '}',
      '#lobby input[type=text]{flex:1;min-width:0;min-height:34px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line);border-radius:5px;padding:6px 9px;font-family:var(--body);font-size:12.5px}',
      '#lobby input[type=text]:focus{outline:none;border-color:var(--alpha)}',
      '.lob-row{display:flex;gap:6px;align-items:stretch}',
      '.lob-row .lnk{flex:none;white-space:nowrap}',
      '.lob-list{display:flex;flex-direction:column;gap:8px;margin:10px 0 16px}',
      '.lob-game{display:flex;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2)}',
      '.lob-game b{font-family:var(--display);font-size:13.5px}',
      '.lob-game .code{font-family:var(--mono);color:var(--ink-dim);font-size:12px;margin-left:6px}',
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
      '.lob-foot .start{margin-left:auto}',
      '.lob-bad{color:var(--warn,#e88);font-size:13px;margin:0}',
      '.lob-bad:empty{display:none}',
      '.lob-ok{color:#8d8}',
      '.lob-status{font-size:12px;color:var(--ink-faint,#8a93a3)}',
      '.lob-code{font-family:var(--mono);font-size:14px;letter-spacing:.18em;padding:2px 8px;border:1px solid var(--line);border-radius:5px;color:var(--ink)}',
      '.lob-forces{display:grid!important;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}',
      '@media (max-width:620px){.lob-forces{grid-template-columns:1fr}}',
      '.lob-forces .hot-side{margin:0}',
      '.lob-forces .hot-side.ready{border-color:rgba(120,210,140,.55)}',
      '.lob-forces .lob-empty-seat{opacity:.7}',
      '.lob-forces .lob-empty-seat .lnk{margin-top:6px}',
      '.lob-wait{opacity:.6}',
      '.lob-go{border-color:var(--alpha,#d8a13a)!important;color:var(--alpha,#d8a13a)!important}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function open(which) {
    ensure();
    if (root.PMCMenu) root.PMCMenu.close();          // the menu would sit on top
    view = which || view;
    host.hidden = false;
    draw();
  }
  function close() { if (host) host.hidden = true; }

  /* ================= drawing ================= */
  function draw() {
    if (!host || host.hidden) return;
    var inRoom = !!(view === 'room' && room);
    el('lobby-body').innerHTML = inRoom ? roomHTML() : lobbyHTML();
    if (el('lobby-title')) el('lobby-title').textContent = inRoom ? room.name : 'Multiplayer';
    var cd = el('lobby-code');
    if (cd) { cd.hidden = !inRoom; cd.textContent = inRoom ? room.id : ''; cd.title = 'Read this out to whoever you are playing'; }
    var sh = host.querySelector('.lobby-sheet');
    if (sh) sh.classList.toggle('lob-sheet-room', !!(view === 'room' && room));
    var box = el('lobby-say') || el('room-say');
    if (box && document.activeElement !== box) { /* leave the caret where it was */ }
  }

  function whoHTML() {
    return '<div class="field"><label for="lob-name">Your name</label><div class="lob-row">' +
      '<input id="lob-name" type="text" maxlength="' + P.LIMITS.name + '" value="' + esc(me.name) + '" ' +
      'placeholder="Your name" autocomplete="off">' +
      '<button class="lnk" data-lob="rename">Set</button>' +
      '</div></div>';
  }

  function lobbyHTML() {
    var list = games.length ? games.map(gameRow).join('') :
      '<p class="lob-empty">No games open. Start one and read the code out to whoever you are playing.</p>';
    return '<p class="lede">Play somebody else over the network. Start a game and read its code out, or join one with the code you were given. ' +
      '<span class="lob-status">' + esc(status) + '</span></p>' +
      '<p class="lob-bad">' + esc(fault) + '</p>' +
      whoHTML() +
      '<div class="field"><label for="join-code">Games</label>' +
      '<div class="lob-row">' +
      '<button class="lnk lob-go" data-lob="create">Start a game</button>' +
      '<input id="join-code" type="text" placeholder="Join with a code\u2026" maxlength="8" autocomplete="off">' +
      '<button class="lnk" data-lob="join">Join</button>' +
      '</div></div>' +
      '<div class="lob-list">' + list + '</div>' +
      chatHTML('lobby');
  }

  function gameRow(g) {
    var seated = g.players.filter(function (p) { return p.name; });
    return '<div class="lob-game">' +
      '<div><b>' + esc(g.name) + '</b> <span class="code">' + esc(g.id) + '</span><br>' +
      '<span class="f small">Tier ' + esc(g.settings.tier) + ', PL ' + esc(g.settings.pl) + ' — ' +
      esc(g.settings.scenario) + (g.campaign ? ' — campaign “' + esc(g.campaign) + '”' : '') + '</span></div>' +
      '<div class="seats">' + seated.map(function (p) {
        return esc(p.name) + (p.ready ? ' ✓' : '');
      }).join(' vs ') + (seated.length < 2 ? ' — a seat free' : '') +
      (g.watchers ? ' — ' + g.watchers + ' watching' : '') + '</div>' +
      '<button class="lnk" data-lob="join" data-id="' + esc(g.id) + '">' +
      (g.phase === 'setup' && seated.length < 2 ? 'Take the seat' : 'Watch') + '</button>' +
      '</div>';
  }

  function chatHTML(where) {
    var lines = chat[where] || [];
    var id = where === 'lobby' ? 'lobby-say' : 'room-say';
    return '<div class="lob-chat"><h4>' +
      (where === 'lobby' ? 'Lobby' : 'Table talk') + '</h4>' +
      '<div class="lob-lines" id="' + id + '-lines">' +
      (lines.length ? lines.map(function (l) {
        return l.from
          ? '<p class="said"><b>' + esc(l.from) + '</b> ' + esc(l.text) + '</p>'
          : '<p class="note">' + esc(l.text) + '</p>';
      }).join('') : '<p class="note">Nothing said yet.</p>') +
      '</div>' +
      '<div class="lob-row"><input id="' + id + '" type="text" maxlength="' + P.LIMITS.chat +
      '" placeholder="Say something…" autocomplete="off">' +
      '<button class="lnk" data-lob="say" data-where="' + where + '">Send</button></div></div>';
  }

  /* The room is laid out as a skirmish's battlefield step is: the terms above,
     then a card for each force — in its own colour, tap your own to muster it —
     and the table talk below. */
  function roomHTML() {
    var host_ = room.hostId === me.id;
    var mine = mySeat();
    var ready = mine && room.seats[mine] && room.seats[mine].ready;
    return '<p class="lob-bad">' + esc(fault) + '</p>' +
      '<p class="lede">' + (host_
        ? 'A game over the network. Set the terms, muster your force, and read the code out to your opponent; take the field once you are both ready.'
        : 'A game over the network. The host sets the terms; muster your force and say when you are ready.') +
      ' <span class="lob-status">' + esc(status) + '</span></p>' +
      termsHTML(host_) +
      '<div class="hot-sum lob-forces">' + seatHTML('A', mine) + seatHTML('B', mine) + '</div>' +
      (room.watchers.length
        ? '<p class="small" style="opacity:.7">Watching: ' +
          room.watchers.map(function (w) { return esc(w.name); }).join(', ') + '</p>' : '') +
      '<div class="lob-foot">' +
      '<button class="lnk" data-lob="leave">Leave this game</button>' +
      (mine ? '<button class="lnk' + (ready ? '' : ' lob-go') + '" data-lob="ready">' +
        (ready ? 'Not ready after all' : 'I am ready') + '</button>' : '') +
      (host_ ? '<button class="start" data-lob="start"' + (room.canStart ? '' : ' disabled') +
        '>Take the field</button>' : '<span class="lob-status start">' +
        (room.canStart ? 'Waiting for the host to start' : 'Waiting for both sides') + '</span>') +
      '</div>' +
      chatHTML('room');
  }

  // the setup screen's own wording for a scenario or a world, where it has one
  function optionText(selId, v, fallback) {
    var sel = document.getElementById(selId);
    var o = sel && sel.options && sel.options.length
      ? Array.prototype.filter.call(sel.options, function (x) { return x.value === String(v); })[0] : null;
    return o ? o.textContent : fallback;
  }

  function termsHTML(isHost) {
    var s = room.settings, d = isHost ? '' : ' disabled';
    function sel(id, label, options, value) {
      return '<div class="field"><label for="' + id + '">' + label + '</label>' +
        '<select id="' + id + '" data-term="' + id.replace('term-', '') + '"' + d + '>' +
        options.map(function (o) {
          var v = o.v === undefined ? o : o.v, t = o.t === undefined ? o : o.t;
          return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('') + '</select></div>';
    }
    var camps = [{ v: '', t: 'No campaign — a one-off battle' }]
      .concat(campaigns.map(function (c) {
        return { v: c.name, t: c.name + ' — turn ' + c.turn };
      }));
    return '<div class="lob-terms">' +
      sel('term-tier', 'Battle Tier', P.TIERS.map(function (t) {
        return { v: t, t: root.PMC.ROMAN[t] + ' — ' + root.PMC.COMPOSITION[t].points + ' points' };
      }), s.tier) +
      sel('term-pl', 'Priority Level', [{ v: 1, t: '1 — skirmish' }, { v: 2, t: '2 — full battle' }], s.pl) +
      sel('term-scenario', 'Scenario', P.SCENARIOS.map(function (x) {
        return { v: x, t: optionText('sel-scen', x, x) };
      }), s.scenario) +
      sel('term-planet', 'World', P.PLANET_CHOICES.map(function (x) {
        return { v: x, t: optionText('sel-planet', x, x) };
      }), s.planet) +
      sel('term-terrain', 'Terrain set-up', [
        { v: 'auto', t: optionText('sel-terrain', 'auto', 'Generate the table') },
        { v: 'manual', t: optionText('sel-terrain', 'manual', 'Set it up by hand') }
      ], s.terrain || 'auto') +
      sel('term-campaign', 'Campaign', camps, s.campaign || '') +
      '</div>' +
      (isHost ? '' : '<p class="small" style="opacity:.65">The host sets the terms.</p>');
  }

  // a force's card, as on the battlefield step: its name in its colour; your own opens the muster
  function seatHTML(which, mine) {
    var p = room.seats[which];
    if (!p) {
      return '<div class="hot-side lob-empty-seat"><b>Seat ' + which + '</b>' +
        '<small>Empty — waiting for a player' + (mine ? '' : '') + '</small>' +
        (mine ? '' : '<button class="lnk" data-lob="sit" data-seat="' + which + '">Sit here</button>') + '</div>';
    }
    var f = p.force || {};
    var col = root.PMCIso && root.PMCIso.COLOURS && root.PMCIso.COLOURS[f.colour];
    var units = f.keys ? f.keys.length : 0;
    var who = esc(p.name) + (p.host ? ' · host' : '') + (p.away ? ' · away' : '');
    var body = '<b style="color:' + (col ? col.light : 'inherit') + '">' + esc(f.name || (units ? 'An unnamed force' : 'No force yet')) + '</b>' +
      (which === mine ? '<em>' + (units ? 'change' : 'muster') + '</em>' : '') +
      '<small>' + who + ' · ' + esc(factionName(f.faction)) + ' · ' +
      (units ? units + ' units' : (which === mine ? 'tap to muster it' : 'still mustering')) +
      (f.tactic ? ' · ' + esc(f.tactic) : '') + '</small>' +
      '<small class="' + (p.ready ? 'lob-ok' : 'lob-wait') + '">' + (p.ready ? 'Ready' : 'Not ready yet') + '</small>';
    return which === mine
      ? '<button type="button" class="hot-side' + (p.ready ? ' ready' : '') + '" data-lob="muster">' + body + '</button>'
      : '<div class="hot-side' + (p.ready ? ' ready' : '') + '">' + body + '</div>';
  }

  function factionName(f) {
    return f === 'rebel' ? 'Rebels' : f === 'bugs' ? 'Space Bugs' : f === 'xeno' ? 'Xenotripods' : 'PMC';
  }

  /* ================= what the screen does ================= */
  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-lob]') : null;
    if (b) { act(b.getAttribute('data-lob'), b); return; }
    var t = e.target.closest ? e.target.closest('[data-term]') : null;
    if (t) return;                    // handled on change, below
  }

  function act(what, b) {
    fault = '';
    switch (what) {
      case 'rename': {
        var v = (el('lob-name') || {}).value || '';
        me.name = v.trim().slice(0, P.LIMITS.name) || 'Commander';
        net.rename(me.name);
        draw();
        return;
      }
      case 'create':
        net.send('game.create', {
          name: me.name + '’s battle',
          settings: { tier: 3, pl: 1, planet: 'random', scenario: 'roll' },
          force: myForce || currentForce()
        });
        return;
      case 'join': return join(b.getAttribute('data-id') || (el('join-code') || {}).value);
      case 'sit': net.send('game.seat', { seat: b.getAttribute('data-seat') }); return;
      case 'leave': keepRoom(''); net.send('game.leave'); view = 'lobby'; draw(); return;
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
    net.send('game.join', { id: code });
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
      }, had, room.name);
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
    var box = e.target, k = box && box.getAttribute && box.getAttribute('data-term');
    if (!k || !net) return;
    var patch = {};
    patch[k] = k === 'tier' || k === 'pl' ? +box.value : box.value;
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
    });
    net.on('welcome', function (m) {
      me.id = m.you.id; me.name = m.you.name;
      games = m.games || [];
      chat.lobby = m.chat || [];
      status = 'connected as ' + me.name;
      loadCampaigns();
      draw();
      /* A seat still held for this browser comes back by itself with the hello.
         Otherwise, a game it was in is asked for again by its code — it may be
         over, or gone, and the server says so. */
      /* Only a battle under way is walked back into. A game still being set up
         is left in the list to join again by choice: walking into it by itself
         put a player in an old room while their opponent waited in a new one. */
      var back = lastRoom();
      var was = back && games.filter(function (gm) { return gm.id === back; })[0];
      if (back && !(was && was.phase === 'battle')) { keepRoom(''); back = ''; }
      if (back) setTimeout(function () { if (!room && lastRoom() === back) net.send('game.join', { id: back }); }, 400);
    });
    net.on('lobby', function (m) { games = m.games || []; draw(); });
    net.on('lobby.chat', function (m) {
      chat.lobby.push(m);
      if (chat.lobby.length > P.LIMITS.chatLog) chat.lobby.shift();
      draw();
    });
    net.on('game', function (m) {
      room = m.room;
      // remembered to resume only once its battle is under way
      keepRoom(room && room.phase === P.PHASE.BATTLE ? room.id : '');
      if (!room) { view = 'lobby'; draw(); return; }
      chat.room = room.chat || chat.room;
      view = 'room';
      draw();
      wireTerms();
    });
    net.on('game.chat', function (m) {
      chat.room.push(m);
      if (chat.room.length > P.LIMITS.chatLog) chat.room.shift();
      draw();
    });
    net.on('error', function (m) {
      fault = m.text || '';
      if (/no game with that code/.test(fault) && lastRoom()) { keepRoom(''); fault = ''; }   // it has gone since
      draw();
    });
    net.on('started', function (m) {
      close();
      if (root.PMC_JOIN_BATTLE) root.PMC_JOIN_BATTLE(net, m.seat, m.cfg);
    });
    net.on('over', function () { keepRoom(''); /* the board shows the result; the room reopens by itself */ });

    net.connect(me.name || 'Commander');
    return net;
  }

  function loadCampaigns() {
    if (!root.fetch) return;
    root.fetch('/campaigns').then(function (r) { return r.json(); })
      .then(function (j) { campaigns = j.campaigns || []; draw(); })
      .catch(function () { campaigns = []; });
  }

  root.PMCLobby = {
    /* Is there a server to play against at all? A page opened from a file, or
       the published single file, has none — and the button that opens this is
       only offered when there is. */
    available: function () { return NET.online(); },
    open: function () {
      ensure();
      connect();
      open(room ? 'room' : 'lobby');
    },
    close: close,
    net: function () { return net; },
    // the code of a game this browser was seated at and may go back to
    resumable: function () { return lastRoom(); }
  };
})(typeof window !== 'undefined' ? window : global);
