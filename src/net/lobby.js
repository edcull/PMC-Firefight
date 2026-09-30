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
      '#lobby input[type=text]{flex:1;min-width:0;min-height:34px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line);border-radius:5px;padding:6px 9px;font-family:var(--body);font-size:13px}',
      '#lobby input[type=text]:focus{outline:none;border-color:var(--alpha)}',
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
      '#lobby > .sheet.lob-sheet-room{display:flex;flex-direction:column;overflow:hidden}',
      '.lob-sheet-room > #lobby-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}',
      '.lob-sheet-room .lob-acts{margin-top:0;align-items:stretch;flex-wrap:nowrap}',
      '.lob-acts .lnk{flex:none;white-space:nowrap}',
      '.lob-sheet-room .lob-startnote{flex:1 1 auto;align-self:center;text-align:right;padding:0}',
      '.lob-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}',
      '.lob-watch{opacity:.7;margin:-4px 0 8px}',
      '.lob-pub{display:flex;align-items:flex-end}',
      '.lob-pub label{display:flex;align-items:center;gap:8px;min-height:var(--row-h);margin:0;padding:0;cursor:pointer;text-transform:none;letter-spacing:0;font-family:var(--body);font-size:13px;color:var(--ink)}',
      '.lob-pub input{accent-color:var(--alpha);width:16px;height:16px;margin:0}',
      '.lob-sheet-room .lob-chat{flex:none;margin-top:10px}',
      '@media (max-width:1000px){.lob-sheet-room .lob-lines{height:calc(3 * 1.45em + 26px);min-height:0}}',
      '.lob-bad{color:var(--warn);font-size:13px;margin:0}',
      '.lob-bad:empty{display:none}',
      '.lob-ok{color:var(--good)}',
      '.lob-status{font-size:12px;color:var(--ink-faint)}',
      // the second player's word on the start, where the host has the button: text, not a button
      '.lob-startnote{flex:1 1 100%;text-align:center;padding:10px 0}',
      '.lob-code{font-family:var(--mono);font-size:14px;letter-spacing:.18em;padding:2px 8px;border:1px solid var(--line);border-radius:5px;color:var(--ink)}',
      '.lob-forces{display:grid!important;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}',
      '.lob-forces .hot-side{margin:0}',
      // on a narrow card the word that opens the muster keeps the corner under the name, clear of it
      '@media (max-width:700px){.lob-forces .hot-side{position:relative}.lob-forces .hot-side em{position:absolute;right:10px;bottom:8px}}',
      '.lob-forces .hot-side.ready{border-color:color-mix(in srgb,var(--good) 55%,transparent)}',
      '.lob-forces .lob-empty-seat{opacity:.7}',
      '.lob-forces .lob-empty-seat .lnk{margin-top:6px}',
      '.lob-wait{opacity:.6}',
      '.lob-new{margin:4px 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2)}',
      '.lob-new .lob-foot{margin-top:4px}',
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
      (creating ? kindsHTML() : '') +
      '<div class="field"><label for="join-code">Games</label>' +
      '<div class="lob-row">' +
      (creating ? '' : '<button class="lnk lob-go" data-lob="create">Start a game</button>') +
      '<input id="join-code" type="text" placeholder="Join with a code\u2026" maxlength="8" autocomplete="off">' +
      '<button class="lnk" data-lob="join">Join</button>' +
      '</div></div>' +
      '<div class="lob-list">' + list + '</div>' +
      chatHTML('lobby');
  }

  /* Start a game asks two things: what kind of game — a skirmish, co-op (not
     yet over the network), or a battle in one of the campaigns kept on this
     server — and whether it is listed for anyone to join or found by its code only. */
  function kindsHTML() {
    var opt = function (v, t, off) {
      return '<option value="' + esc(v) + '"' + (v === newKind ? ' selected' : '') + (off ? ' disabled' : '') + '>' + esc(t) + '</option>';
    };
    var kinds = [opt('skirmish', 'Skirmish'), opt('coop', 'Cooperative \u2014 not available over the network yet', true)]
      .concat(campaigns.length
        ? campaigns.map(function (c) { return opt('camp:' + c.name, 'Campaign \u2014 ' + c.name + ', turn ' + c.turn); })
        : [opt('camp:', 'Campaign \u2014 none kept on this server yet', true)]);
    return '<div class="lob-new">' +
      '<div class="field"><label for="lob-kind">Game</label><select id="lob-kind">' + kinds.join('') + '</select></div>' +
      publicBox('lob-private', !newPrivate, '') +
      '<div class="lob-foot"><button class="lnk" data-lob="uncreate">Not now</button>' +
      '<button class="start" data-lob="create" data-go="1">Create the game</button></div></div>';
  }

  function gameRow(g) {
    var seated = g.players.filter(function (p) { return p.name; });
    return '<div class="lob-game">' +
      '<div><b>' + esc(g.name) + '</b> <span class="lob-code">' + esc(g.id) + '</span><br>' +
      '<span class="f small">Tier ' + esc(root.PMC.ROMAN[g.settings.tier] || g.settings.tier) + ' · PL ' + esc(g.settings.pl) + ' — ' +
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
    return '<div class="lob-chat">' + (where === 'lobby' ? '<h4>Lobby</h4>' : '') +
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

  /* The room, top to bottom: what to do next (leave, ready, start), a card
     for each force side by side — tap your own to muster it — then the terms,
     which scroll, and the table talk kept at the foot. */
  function roomHTML() {
    var host_ = room.hostId === me.id;
    var mine = mySeat();
    var ready = mine && room.seats[mine] && room.seats[mine].ready;
    return '<p class="lob-bad">' + esc(fault) + '</p>' +
      /* as every other screen has it: the way out a quiet link, the one thing to
         do next the full-width button — say you are ready, then (the host) take the field */
      '<div class="lob-foot lob-acts">' +
      '<button class="lnk" data-lob="leave">Leave this game</button>' +
      (mine && ready ? '<button class="lnk" data-lob="ready">Not ready after all</button>' : '') +
      (mine && !ready ? '<button class="start" data-lob="ready">I am ready</button>'
        : host_ ? '<button class="start" data-lob="start"' + (room.canStart ? '' : ' disabled') + '>Take the field</button>'
        : '<span class="lob-status lob-startnote">' +
          (room.canStart ? 'Waiting for the host to start' : 'Waiting for both sides') + '</span>') +
      '</div>' +
      '<div class="hot-sum lob-forces">' + seatHTML('A', mine) + seatHTML('B', mine) + '</div>' +
      (room.watchers.length
        ? '<p class="small lob-watch">Watching: ' +
          room.watchers.map(function (w) { return esc(w.name); }).join(', ') + '</p>' : '') +
      '<div class="lob-scroll">' + termsHTML(host_) + '</div>' +
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
      publicBox('term-private', !s.private, ' data-term="private"' + d) +
      '</div>';
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
      case 'create': {
        // the first press opens the form; Create the game starts it
        if (!b.getAttribute('data-go')) { creating = true; draw(); return; }
        var terms = { tier: 3, pl: 1, planet: 'random', scenario: 'roll', private: newPrivate };
        if (newKind.indexOf('camp:') === 0) {
          if (!newKind.slice(5)) { fault = 'There is no campaign on this server to fight under.'; draw(); return; }
          terms.campaign = newKind.slice(5);
        } else if (newKind !== 'skirmish') { fault = 'That kind of game cannot be played over the network yet.'; draw(); return; }
        creating = false;
        net.send('game.create', {
          name: me.name + '’s battle',
          settings: terms,
          force: myForce || currentForce()
        });
        return;
      }
      case 'uncreate': creating = false; draw(); return;
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
    if (e.target && e.target.id === 'lob-kind') { newKind = e.target.value; return; }
    if (e.target && e.target.id === 'lob-private') { newPrivate = !e.target.checked; return; }
    var box = e.target, k = box && box.getAttribute && box.getAttribute('data-term');
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
      /* A private game is not in the list, so one missing from it is still
         asked for: the server says if it has gone. */
      var was = back && games.filter(function (gm) { return gm.id === back; })[0];
      if (back && was && was.phase !== 'battle') { keepRoom(''); back = ''; }
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
    /* The other player dropping out, coming back or walking away, said on the
       board while the battle is on (the room's chat is not on screen then). */
    net.on('game.presence', function (m) {
      if (!m || m.id === me.id || !root.PMC_BATTLE_LIVE || !root.PMC_BATTLE_LIVE()) return;
      var who = m.name || 'Your opponent';
      if (m.kind === 'dropped') say2(who + ' has lost connection. Their seat is being held for them.', 'warn');
      else if (m.kind === 'back') say2(who + ' is back.', 'good');
      else if (m.kind === 'left') {
        keepRoom('');
        say2(who + ' has left the battle. It cannot go on without them.', 'bad', 7000);
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
    root.fetch('/campaigns').then(function (r) { return r.json(); })
      .then(function (j) { campaigns = j.campaigns || []; draw(); })
      .catch(function () { campaigns = []; });
  }

  function say2(text, kind, ms) { if (root.PMC_TOAST) root.PMC_TOAST(text, kind, ms); }

  root.PMCLobby = {
    /* Walk away from the battle under way: the seat is given up, which ends it
       for the other player too, and this browser forgets it was ever in it. */
    abandon: function () {
      keepRoom('');
      if (net) net.send('game.leave');
      if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE();
    },
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
