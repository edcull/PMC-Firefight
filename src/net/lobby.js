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
    host.innerHTML = '<div class="sheet lobby-sheet"><div id="lobby-body"></div></div>';
    document.body.appendChild(host);
    style();
    host.addEventListener('click', onClick);
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
      '.lobby-sheet{max-width:920px}',
      '.lob-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:10px}',
      '.lob-head h2{margin:0}',
      '.lob-who{margin-left:auto;display:flex;gap:6px;align-items:center}',
      '.lob-who input{width:11em}',
      '.lob-cols{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}',
      '@media (max-width:760px){.lob-cols{grid-template-columns:1fr}}',
      '.lob-list{display:flex;flex-direction:column;gap:6px;max-height:44vh;overflow:auto}',
      '.lob-game{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid rgba(231,236,244,.14);border-radius:6px;background:rgba(255,255,255,.02)}',
      '.lob-game b{font-size:14px}',
      '.lob-game .code{font-family:"IBM Plex Mono",monospace;opacity:.65;font-size:12px}',
      '.lob-game .seats{margin-left:auto;display:flex;gap:6px;font-size:12px;opacity:.8}',
      '.lob-empty{opacity:.6;padding:14px 2px;font-size:13px}',
      '.lob-chat{display:flex;flex-direction:column;gap:6px}',
      '.lob-lines{height:38vh;overflow:auto;border:1px solid rgba(231,236,244,.12);border-radius:6px;padding:8px;font-size:13px;display:flex;flex-direction:column;gap:4px}',
      '.lob-lines p{margin:0}',
      '.lob-lines .said b{color:var(--ink,#e7ecf4);opacity:.9}',
      '.lob-lines .note{opacity:.6;font-style:italic}',
      '.lob-row{display:flex;gap:6px}',
      '.lob-row input{flex:1}',
      '.lob-seats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}',
      '@media (max-width:620px){.lob-seats{grid-template-columns:1fr}}',
      '.lob-seat{border:1px solid rgba(231,236,244,.16);border-radius:6px;padding:10px}',
      '.lob-seat.ready{border-color:rgba(120,210,140,.55)}',
      '.lob-seat.mine{background:rgba(255,255,255,.035)}',
      '.lob-seat h4{margin:0 0 4px}',
      '.lob-seat .f{font-size:12px;opacity:.75}',
      '.lob-terms{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
      '.lob-foot{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}',
      '.lob-foot .start{margin-left:auto}',
      '.lob-bad{color:#e88;font-size:13px;min-height:1.2em}',
      '.lob-ok{color:#8d8;font-size:13px}',
      '.lob-status{font-size:12px;opacity:.7}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function open(which) {
    ensure();
    view = which || view;
    host.hidden = false;
    draw();
  }
  function close() { if (host) host.hidden = true; }

  /* ================= drawing ================= */
  function draw() {
    if (!host || host.hidden) return;
    el('lobby-body').innerHTML = view === 'room' && room ? roomHTML() : lobbyHTML();
    var box = el('lobby-say') || el('room-say');
    if (box && document.activeElement !== box) { /* leave the caret where it was */ }
  }

  function whoHTML() {
    return '<div class="lob-who">' +
      '<label for="lob-name" class="small">You</label>' +
      '<input id="lob-name" maxlength="' + P.LIMITS.name + '" value="' + esc(me.name) + '" ' +
      'placeholder="Your name" autocomplete="off">' +
      '<button class="lnk" data-lob="rename">Set</button>' +
      '</div>';
  }

  function lobbyHTML() {
    var list = games.length ? games.map(gameRow).join('') :
      '<p class="lob-empty">No games open. Start one and read the code out to whoever you are playing.</p>';
    return '<div class="lob-head"><h2>Multiplayer</h2>' +
      '<span class="lob-status">' + esc(status) + '</span>' + whoHTML() + '</div>' +
      '<p class="lob-bad">' + esc(fault) + '</p>' +
      '<div class="lob-cols">' +
      '<div>' +
      '<div class="lob-row" style="margin-bottom:10px">' +
      '<button class="lnk" data-lob="create">Start a game</button>' +
      '<input id="join-code" placeholder="Join with a code…" maxlength="8" autocomplete="off">' +
      '<button class="lnk" data-lob="join">Join</button>' +
      '</div>' +
      '<div class="lob-list">' + list + '</div>' +
      '</div>' +
      chatHTML('lobby') +
      '</div>' +
      '<div class="lob-foot"><button class="lnk" data-lob="leave-lobby">Back to the game</button></div>';
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
    return '<div class="lob-chat"><h4 style="margin:0">' +
      (where === 'lobby' ? 'Lobby' : 'Table talk') + '</h4>' +
      '<div class="lob-lines" id="' + id + '-lines">' +
      (lines.length ? lines.map(function (l) {
        return l.from
          ? '<p class="said"><b>' + esc(l.from) + '</b> ' + esc(l.text) + '</p>'
          : '<p class="note">' + esc(l.text) + '</p>';
      }).join('') : '<p class="note">Nothing said yet.</p>') +
      '</div>' +
      '<div class="lob-row"><input id="' + id + '" maxlength="' + P.LIMITS.chat +
      '" placeholder="Say something…" autocomplete="off">' +
      '<button class="lnk" data-lob="say" data-where="' + where + '">Send</button></div></div>';
  }

  function roomHTML() {
    var host_ = room.hostId === me.id;
    var mine = room.seats.A && room.seats.A.id === me.id ? 'A'
      : room.seats.B && room.seats.B.id === me.id ? 'B' : null;
    return '<div class="lob-head"><h2>' + esc(room.name) + '</h2>' +
      '<span class="code lob-status">code ' + esc(room.id) + '</span>' +
      '<span class="lob-status">' + esc(status) + '</span>' + whoHTML() + '</div>' +
      '<p class="lob-bad">' + esc(fault) + '</p>' +
      termsHTML(host_) +
      '<div class="lob-seats">' + seatHTML('A', mine) + seatHTML('B', mine) + '</div>' +
      (room.watchers.length
        ? '<p class="small" style="opacity:.7">Watching: ' +
          room.watchers.map(function (w) { return esc(w.name); }).join(', ') + '</p>' : '') +
      chatHTML('room') +
      '<div class="lob-foot">' +
      '<button class="lnk" data-lob="leave">Leave this game</button>' +
      (mine ? '<button class="lnk" data-lob="muster">Pick my force…</button>' : '') +
      (mine ? '<button class="lnk" data-lob="ready">' +
        (room.seats[mine] && room.seats[mine].ready ? 'Not ready after all' : 'I am ready') +
        '</button>' : '') +
      (host_ ? '<button class="start" data-lob="start"' + (room.canStart ? '' : ' disabled') +
        '>Take the field</button>' : '<span class="lob-status start">' +
        (room.canStart ? 'Waiting for the host to start' : 'Waiting for both sides') + '</span>') +
      '</div>';
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
      sel('term-planet', 'Planet', P.PLANETS.map(function (p) {
        return { v: p, t: p === 'random' ? 'Randomise the planet' : p.charAt(0).toUpperCase() + p.slice(1) };
      }), s.planet) +
      sel('term-scenario', 'Scenario', P.SCENARIOS.map(function (x) {
        return { v: x, t: x === 'roll' ? 'Roll a D6' : x === 'rolld3' ? 'Roll a D3' : x.charAt(0).toUpperCase() + x.slice(1) };
      }), s.scenario) +
      sel('term-campaign', 'Campaign', camps, s.campaign || '') +
      '</div>' +
      (isHost ? '' : '<p class="small" style="opacity:.65">The host sets the terms.</p>');
  }

  function seatHTML(which, mine) {
    var p = room.seats[which];
    var cls = 'lob-seat' + (p && p.ready ? ' ready' : '') + (mine === which ? ' mine' : '');
    if (!p) {
      return '<div class="' + cls + '"><h4>Seat ' + which + '</h4>' +
        '<p class="f">Empty.' + (mine ? '' : ' <button class="lnk" data-lob="sit" data-seat="' + which + '">Sit here</button>') + '</p></div>';
    }
    var f = p.force || {};
    return '<div class="' + cls + '"><h4>' + esc(p.name) + ' [' + which + ']' +
      (p.host ? ' — host' : '') + (p.away ? ' — away' : '') + '</h4>' +
      '<p class="f">' + esc(f.name || 'No force named yet') + '<br>' +
      esc(factionName(f.faction)) + ' — ' + (f.keys ? f.keys.length : 0) + ' units' +
      (f.tactic ? ' — ' + esc(f.tactic) : '') + '<br>' +
      (p.ready ? '<span class="lob-ok">Ready</span>' : 'Not ready') + '</p></div>';
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
      case 'leave': net.send('game.leave'); view = 'lobby'; draw(); return;
      case 'leave-lobby': close(); return;
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
      root.PMC_MUSTER_FOR(room.settings, function (force) {
        myForce = force;
        if (force) net.send('game.force', { force: force });
        open('room');
      });
      return;
    }
    open('room');
  }
  function currentForce() {
    return root.PMC_MUSTER_NOW ? root.PMC_MUSTER_NOW() : null;
  }

  /* Terms are sent as they are changed rather than on a button: the other side
     should see the tier move while it is being argued about. */
  function wireTerms() {
    if (!host || host.hidden) return;
    ['tier', 'pl', 'planet', 'scenario', 'campaign'].forEach(function (k) {
      var box = el('term-' + k);
      if (!box || box.__wired) return;
      box.__wired = true;
      box.addEventListener('change', function () {
        var patch = {};
        patch[k] = k === 'tier' || k === 'pl' ? +box.value : box.value;
        if (k === 'campaign' && !box.value) patch.campaign = null;
        net.send('game.settings', { patch: patch });
      });
    });
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
    });
    net.on('lobby', function (m) { games = m.games || []; draw(); });
    net.on('lobby.chat', function (m) {
      chat.lobby.push(m);
      if (chat.lobby.length > P.LIMITS.chatLog) chat.lobby.shift();
      draw();
    });
    net.on('game', function (m) {
      room = m.room;
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
    net.on('error', function (m) { fault = m.text || ''; draw(); });
    net.on('started', function (m) {
      close();
      if (root.PMC_JOIN_BATTLE) root.PMC_JOIN_BATTLE(net, m.seat, m.cfg);
    });
    net.on('over', function () { /* the board shows the result; the room reopens by itself */ });

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
    net: function () { return net; }
  };
})(typeof window !== 'undefined' ? window : global);
