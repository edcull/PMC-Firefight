/* PMC 2670 — Firefight : online campaigns in the dossier — a world of two to eight
   forces, players and AI (server/online.js keeps it and runs its rules)

   This is the dossier's side of it:
     - the list of the player's online campaigns;
     - the campaign's lobby: the slots (open, a player, or an AI force of a chosen
       army), a colour each, the chat, ready, and the host's Start;
     - once it is under way, the world as a single-player campaign shows it — the
       player's own force, every other force a rival with a dossier — with every
       change to their own force sent to the server as a command rather than made
       here; the contracts on offer against the AI forces (rolled by the server)
       and challenges to the other players; the contract, with an AI force or with
       a player; the walk into the battle; and the questions and the aftermath.

   The dossier's own screens do the showing (the hub, the founding sheet, the
   roster, the honours, the offers, the aftermath): what is only online is here.

   Made once by dossier.js, the first time it is wanted. E is what it needs of
   dossier.js; what changes is read through it as it is now. */
(function (root) {
  'use strict';
  root.PMCDossierOnline = function (E) {
    var C = E.C, R = E.R, ROMAN = E.ROMAN, esc = E.esc;
    var list = null, listFault = '', signedIn;     // the list screen: the player's campaigns, and who they are
    var busy = false;                               // a command on its way: the next waits
    var poll = null;                                // the campaign asked for again now and then, for the others' changes
    var pick = null, pickFor = null;                // the player's force for a contract, as picked so far here, and for which
    var fighting = null;                            // the battle walked into: its code
    var lobby = null;                               // the campaign while it is in its lobby, as the server sent it
    var localCamp, stashed = false;                 // the browser's own campaign, put aside while an online one is open
    var FACTION_NAMES = { pmc: 'Private military company', rebel: 'Revolt', bugs: 'Bug swarm', xeno: 'Xenotripod tribe', random: 'Rolled at random' };

    function api(path, opts) {
      opts = opts || {};
      opts.credentials = 'same-origin';
      opts.cache = 'no-store';
      if (opts.body) opts.headers = { 'content-type': 'application/json' };
      return root.fetch(path, opts).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }, function () { return { ok: r.ok, code: r.status, j: {} }; });
      });
    }
    function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
    function founded(co) { return !!(co && co.roster && co.roster.length); }
    function myCo() { return E.camp.companies.A; }
    function onl() { return (E.camp && E.camp.online) || {}; }
    // the other players' forces, as the hub shows them among the rivals
    function players() { return (E.camp.rivals || []).filter(function (r) { return r.human; }); }
    function forceOfSlot(i) { return (E.camp.rivals || []).filter(function (r) { return r.human && r.slot === i; })[0] || null; }
    var WAIT = { you: 'waiting on you', them: 'waiting on another player', either: 'free to take a contract', lobby: 'in its lobby', over: 'over' };

    /* ================= in and out ================= */
    function enterList() {
      leaveCampaign();
      E.view = 'olist';
      E.open('olist');
      loadList();
    }
    function loadList() {
      list = null; listFault = '';
      api('api/me').then(function (r) {
        signedIn = r.ok && r.j.who && !r.j.who.guest ? r.j.who : null;
        if (!signedIn) { list = []; E.render(); return null; }
        return api('api/online').then(function (l) {
          list = l.ok ? l.j.campaigns || [] : [];
          if (!l.ok) listFault = cap(l.j.error || 'the server could not be reached') + '.';
          E.render();
        });
      }, function () { list = []; listFault = 'The server could not be reached.'; E.render(); });
    }
    // an online campaign opened: the browser's own campaign is put aside (and never saved over)
    function openCampaign(id) {
      return api('api/online/' + id).then(function (r) {
        if (!r.ok) { E.note('That campaign will not open', cap(r.j.error || 'the server said no') + '.'); return; }
        if (!stashed) { localCamp = E.camp; stashed = true; }
        E.online = { id: r.j.id, slot: r.j.slot, version: 0, side: 'A' };
        E.hubSide = 'A';
        take(r.j, true);
        startPoll();
        E.open(E.view);
      });
    }
    // a new one made on the server, opened on its lobby
    function startNew(how) {
      var body = JSON.stringify({ listed: !!(how && how.listed) });
      return api('api/online', { method: 'POST', body: body }).then(function (r) {
        if (!r.ok) { E.note('Not started', cap(r.j.error || r.j.why || 'the server said no') + '.'); return; }
        openCampaign(r.j.id);
      });
    }
    function leaveCampaign() {
      stopPoll();
      if (stashed) { E.camp = localCamp; stashed = false; localCamp = null; }
      E.online = null; pick = null; pickFor = null; lobby = null;
      E.draft = null;
    }

    /* The campaign as the server has it now, taken up: in its lobby, the lobby;
       under way, the world, and the screen it should be on follows (the player's
       force still to be founded, a question owed, an aftermath not yet read). */
    function take(j, fresh) {
      var o = E.online;
      if (!o || !j) return;
      o.version = j.version || o.version;
      o.slot = j.slot; o.host = !!j.host; o.phase = j.phase; o.name = j.name; o.waiting = j.waiting;
      if (j.phase === 'lobby') {
        lobby = j;
        if (!E.camp || !E.camp.online || !E.camp.lobbyShell) E.camp = { lobbyShell: true, mode: 'solo', companies: { A: C.newCompany('', {}) }, rivals: [], log: [], online: {} };
        E.view = 'olobby';
        return;
      }
      lobby = j;                       // the slots and the chat, kept for the hub's window
      if (!j.state) return;
      var wasFound = E.view === 'found' && E.draft;
      var keep = wasFound && E.camp && E.camp.companies ? E.camp.companies.A : null;
      var camp = C.rehydrate(j.state);
      if (keep && !founded(camp.companies.A)) camp.companies.A = keep;
      E.camp = camp;
      steer(fresh);
    }
    function steer(fresh) {
      var camp = E.camp;
      if (!camp || camp.lobbyShell) { E.view = 'olobby'; return; }
      if (E.view === 'olobby') E.view = 'hub';
      if (!founded(camp.companies.A)) {
        if (E.view !== 'found' || !E.draft) {
          // the army and colour picked in the lobby are where the founding starts
          var slotColour = camp.companies.A.colour;
          E.beginOwn('A', camp.companies.A.faction || 'pmc');
          if (slotColour) E.draft.colour = slotColour;
        }
        return;
      }
      if (E.view === 'found') { E.draft = null; E.view = 'hub'; }
      if (camp.post) { E.view = 'post'; return; }
      if (E.view === 'post') E.view = 'hub';
      // a battle's aftermath not yet read: shown once, from the player's log
      var af = onl().after;
      if (af && af.n > seen()) {
        var at = -1;
        (camp.log || []).forEach(function (l, i) { if (l.turn === af.turn && l.after) at = i; });
        seen(af.n);
        if (at >= 0) { E.showPast(at); E.view = 'aftermath'; return; }
      }
      if (fresh && ['ocontract', 'aftermath', 'offers'].indexOf(E.view) < 0) E.view = 'hub';
      // a contract that has gone (called off, fought) takes its screen with it
      if (E.view === 'ocontract' && !activeContract()) E.view = 'hub';
    }
    // the last aftermath this browser has shown, per campaign
    function seen(n) {
      var k = 'pmc-online-seen2:' + (E.online ? E.online.id : '');
      try {
        if (n === undefined) return +(localStorage.getItem(k) || 0);
        localStorage.setItem(k, String(n));
      } catch (e) { }
      return 0;
    }

    /* The others' changes, picked up every few seconds while the campaign is open. */
    function startPoll() {
      stopPoll();
      poll = setInterval(function () {
        var o = E.online;
        if (!o || busy || E.asking() || document.hidden) return;
        api('api/online/' + o.id).then(function (r) {
          if (!E.online || E.online.id !== o.id || busy) return;
          if (!r.ok) {
            // closed by its host while it was in its lobby
            if (r.code === 404 && o.phase === 'lobby') { leaveCampaign(); E.note('The campaign is closed', 'Its host closed it before it started.'); enterList(); }
            return;
          }
          if (r.j.version === o.version) return;
          var before = battleCode(), waitingOnIt = E.view === 'ocontract';
          // a line being typed into the lobby's chat survives the redraw
          var say = document.getElementById('olob-say'), typed = say ? say.value : '', typing = say && document.activeElement === say;
          take(r.j);
          var shown = E.isOpen();
          if (shown && E.view === 'olobby') {
            E.render();
            var say2 = document.getElementById('olob-say');
            if (say2) { say2.value = typed; if (typing) say2.focus(); }
            return;
          }
          // a contract with a player: when both are ready the battle is made, and a player waiting on it goes in
          var b = battleCode();
          if (b && b !== before && shown && waitingOnIt) { goBattle(b); return; }
          if (shown) E.render();
        });
      }, 3000);
    }
    function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

    /* ================= commands ================= */
    function cmd(name, args, then) {
      var o = E.online;
      if (!o || busy) return;
      busy = true;
      api('api/online/' + o.id + '/cmd', { method: 'POST', body: JSON.stringify({ cmd: name, args: args || {} }) }).then(function (r) {
        busy = false;
        if (!E.online || E.online.id !== o.id) return;
        if (!r.ok) {
          E.note('Not done', cap(r.j.why || r.j.error || 'the server said no') + '.');
          refresh();
          return;
        }
        take(r.j);
        if (then) then(r.j);
        if (r.j.battle) { goBattle(r.j.battle); return; }
        E.render();
      }, function () { busy = false; E.note('Not done', 'The server could not be reached. Try again in a moment.'); });
    }
    function refresh(then) {
      var o = E.online;
      if (!o) return;
      api('api/online/' + o.id).then(function (r) {
        if (r.ok && E.online && E.online.id === o.id) take(r.j);
        if (then) then(); else E.render();
      });
    }

    /* ================= the battle ================= */
    function battleCode() {
      var on = onl();
      return (on.battle && on.battle.code) || (on.duel && on.duel.battle && on.duel.battle.code) || null;
    }
    function goBattle(code) {
      if (!root.PMCLobby || !root.PMCLobby.joinBattle) { E.note('No battle here', 'This page cannot reach the game server.'); return; }
      fighting = code;
      E.hide();
      root.PMCLobby.joinBattle(code, {
        over: function () { afterBattle(true); },
        gone: function () { afterBattle(false); }
      });
    }
    // the battle over (read the result first) or walked away from: back to the campaign, as the server has it now
    function afterBattle(read) {
      if (!fighting) return false;
      fighting = null;
      var back = function () { if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE(); refresh(function () { E.open(E.view); }); };
      if (!read || !root.PMC_AFTER_RESULT) { setTimeout(back, read ? 900 : 2500); return true; }
      root.PMC_AFTER_RESULT(back);
      return true;
    }

    /* ================= the list ================= */
    function listView() {
      var h = '<h2>Online campaigns</h2>';
      h += '<p class="lede">A world of two to eight forces — players, each on their own device, and AI forces the server runs. ' +
        'Each player runs their own force whenever they have the time; the server keeps the campaign and rolls every die.</p>';
      if (list === null) return h + '<p class="dnote">Looking…</p>' + foot();
      if (!signedIn) {
        return h + '<div class="cpan"><div class="cpstat">An online campaign is kept by your account. Sign in (or make an account) first.</div>' +
          '<button class="start" data-go="osignin">Sign in</button></div>' + foot();
      }
      if (listFault) h += '<p class="dnote hubnote">' + esc(listFault) + '</p>';
      if (list.length) {
        h += '<div class="field"><label>Yours</label><div class="clog">' + list.map(function (c) {
          return '<button type="button" class="crow crow-go" data-ocamp="' + c.id + '"><b>' + c.turn + '</b><span>' + esc(c.name) +
            '<small>' + c.forces + ' forces, ' + c.players + ' player' + (c.players === 1 ? '' : 's') + ' · ' + WAIT[c.waiting || 'over'] + '</small></span>' +
            (c.waiting === 'you' ? '<em class="yourmove">Your move</em>' : '<em>Open</em>') + '</button>';
        }).join('') + '</div></div>';
      }
      h += '<div class="field"><label>A new one</label><button class="start" data-go="onew">Start an online campaign</button>' +
        '<p class="dnote">It opens on its lobby: set the slots, then give the others its code.</p></div>';
      h += '<div class="field"><label for="ojoin-code">Join one</label><div class="ojoin">' +
        '<input class="tin" id="ojoin-code" maxlength="8" placeholder="The code you were given" autocomplete="off">' +
        '<button class="lnk" data-go="ojoin">Join</button></div></div>';
      return h + foot();
    }
    function foot() { return '<p class="camp-foot"><button class="lnk" data-go="menu">← Main menu</button></p>'; }

    /* ================= the lobby ================= */
    function swatch(c) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, k = CO[c];
      return '<span class="olob-sw"' + (k ? ' style="background:' + k.dark + ';border-color:' + k.light + '"' : '') + '></span>';
    }
    var colourFor = null;                           // the lobby slot whose colours are open, if any
    function lobbyView() {
      var L = lobby || {}, host = !!L.host, me = L.slot;
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, KEYS = (root.PMCIso && root.PMCIso.COLOUR_KEYS) || Object.keys(CO);
      // the code that brings the others in, in the title bar
      var h = '<h2>' + esc(L.name || 'Campaign') + (L.invite ? ' <span class="olob-code" title="The code that brings the others in: Join on the Multiplayer screen">' + esc(L.invite) + '</span>' : '') + '</h2>';
      h += '<div class="olob-slots">' + (L.slots || []).map(function (s, i) {
        var mine = i === me, canSlot = host && s.kind !== 'human', canColour = mine || (host && s.kind !== 'human'), canArmy = mine || (host && s.kind === 'ai');
        var who = s.kind === 'human' ? esc(s.name) + (s.host ? ' <i class="acct-tag">host</i>' : '') + (mine ? ' <i class="acct-tag">you</i>' : '')
          : s.kind === 'ai' ? 'AI force' : '<em>Open \u2014 waiting for a player</em>';
        // its colour: a chip like the founding screen's, opening the colours (those other slots wear greyed out)
        var c = CO[s.colour];
        var chip = '<span class="olob-chip"' + (c ? ' style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)"' : '') + '></span>';
        var row = '<div class="olob-slot' + (mine ? ' mine' : '') + '">' +
          (canColour ? '<button type="button" class="olob-colour" data-olob-pick="' + i + '" aria-expanded="' + (colourFor === i) + '" title="' + esc(c ? c.name : 'Colour') + '">' + chip + '</button>' : '<span class="olob-colour still">' + chip + '</span>') +
          '<span class="olob-who"><b>' + who + '</b>' + (s.kind === 'human' ? '<small>' + (s.ready || s.host ? 'Ready' : 'Not ready') + '</small>' : '') + '</span>';
        // the host: an AI force in this slot, or open for a player
        if (canSlot) row += '<label class="olob-ai"><input type="checkbox" data-olob-ai="' + i + '"' + (s.kind === 'ai' ? ' checked' : '') + '> AI</label>';
        if (s.kind !== 'open') {
          var facs = s.kind === 'ai' ? ['random', 'pmc', 'rebel', 'bugs', 'xeno'] : ['pmc', 'rebel', 'bugs', 'xeno'];
          row += canArmy ? '<select data-olob-army="' + i + '">' + facs.map(function (f) {
            return '<option value="' + f + '"' + (f === s.faction ? ' selected' : '') + '>' + esc(FACTION_NAMES[f]) + '</option>';
          }).join('') + '</select>' : '<span class="olob-army">' + esc(FACTION_NAMES[s.faction] || '') + '</span>';
        }
        row += '</div>';
        return row;
      }).join('') + '</div>';
      /* Its colours, popped up beside the chip as the founding screen's are: drawn
         outside the scrolling list (so it is not cut off), and put by the chip once drawn. */
      var cs = colourFor != null && (L.slots || [])[colourFor];
      if (cs) {
        var cc = CO[cs.colour];
        h += '<div class="found-pop olob-pop" data-olob-popfor="' + colourFor + '"><label>Colours \u2014 ' + esc(cc ? cc.name : '') + '</label><div class="csw">' + KEYS.map(function (k) {
          var q = CO[k], taken = (L.slots || []).some(function (x, j) { return j !== colourFor && x.colour === k; });
          return '<button type="button"' + (k === cs.colour ? ' class="on"' : '') + ' data-olob-col="' + k + '" data-olob-for="' + colourFor + '" title="' + esc(q.name) + (taken ? ' \u2014 another force wears it' : '') + '"' + (taken ? ' disabled' : '') + '>' +
            '<span style="background:linear-gradient(135deg,' + q.light + ' 0 38%,' + q.mid + ' 38% 74%,' + q.dark + ' 74%)"></span></button>';
        }).join('') + '</div></div>';
      }
      /* One row: how many forces, whether it is listed for anyone to join, and the
         host's Start or a player's Ready. */
      var mineSlot = (L.slots || [])[me] || {}, n = (L.slots || []).length;
      h += '<div class="olob-bar">';
      h += host ? '<label class="olob-n">Forces <select id="olob-n">' + [2, 4, 6, 8, 10].map(function (k) {
        return '<option value="' + k + '"' + (k === n ? ' selected' : '') + '>' + k + '</option>';
      }).join('') + '</select></label>' : '<span class="olob-n">' + n + ' forces</span>';
      h += host ? '<label class="olob-pub"><input type="checkbox" id="olob-pub"' + (L.listed ? ' checked' : '') + '> Public</label>'
        : '<span class="olob-pub">' + (L.listed ? 'Public' : 'Private') + '</span>';
      if (host) h += '<button class="start" data-go="olobstart">Start the campaign</button>';
      else h += '<button class="start' + (mineSlot.ready ? ' on' : '') + '" data-go="olobready">' + (mineSlot.ready ? 'Ready \u2014 waiting for the host' : 'I am ready') + '</button>';
      h += '</div>';
      h += chatHTML();
      h += '<p class="camp-foot"><button class="lnk" data-go="olobleave">' + (host ? 'Close the campaign' : 'Leave the campaign') + '</button> ' +
        '<button class="lnk" data-go="olist">\u2190 Online campaigns</button></p>';
      // the chat shows its latest line; the colours sit by their chip, and follow it as the list scrolls
      setTimeout(function () {
        var l = document.querySelector('#camp-body .olob-lines'); if (l) l.scrollTop = l.scrollHeight;
        placePop();
        var sl = document.querySelector('#camp-body .olob-slots'); if (sl) sl.onscroll = placePop;
      }, 0);
      return h;
    }
    function placePop() {
      var pop = document.querySelector('#camp-body .olob-pop'); if (!pop) return;
      var chip = document.querySelector('#camp-body [data-olob-pick="' + pop.getAttribute('data-olob-popfor') + '"]');
      var body = document.getElementById('camp-body');
      if (!chip || !body) return;
      var r = chip.getBoundingClientRect(), b = body.getBoundingClientRect(), w = Math.min(380, b.width - 16);
      pop.style.width = w + 'px';
      pop.style.left = Math.max(b.left + 8, Math.min(r.left, b.right - w - 8)) + 'px';
      pop.style.top = (r.bottom + 6) + 'px';
    }
    function chatHTML() {
      var lines = ((lobby && lobby.chat) || []).slice(-60);
      return '<div class="olob-chat"><div class="olob-lines">' +
        (lines.length ? lines.map(function (c) {
          // each name in the colour its player's slot wears now
          var sl = lobby && lobby.slots && lobby.slots[c.slot], CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, col = sl && CO[sl.colour];
          return '<div><b' + (col ? ' style="color:' + col.light + '"' : '') + '>' + esc(c.from || '') + '</b> ' + esc(c.text) + '</div>';
        }).join('') : '<em>Nothing said yet.</em>') +
        '</div><div class="ojoin"><input class="tin" id="olob-say" maxlength="300" placeholder="Say something\u2026" autocomplete="off"><button class="lnk" data-go="olobsay">Send</button></div></div>';
    }

    /* ================= the hub, online ================= */
    // what the hub says of the campaign: a contract or a duel under way, a battle ready, challenges
    function hubNote() {
      var on = onl(), h = '';
      var b = battleCode();
      if (b) {
        h += '<div class="cpan onote"><div class="cpstat"><b>The battle is ready.</b></div><button class="start" data-go="obattle">Go to the battle</button></div>';
      } else if (on.contract) {
        h += '<div class="cpan onote"><div class="cpstat">A contract with <b>' + esc(E.camp.companies.B.name) + '</b> is waiting on you.</div>' +
          '<button class="lnk" data-go="ocontract">Open the contract</button></div>';
      } else if (on.duel) {
        var d = on.duel;
        h += '<div class="cpan onote"><div class="cpstat">A contract with <b>' + esc(d.foeName) + '</b> (' + esc(d.player) + ') — ' + duelLine(d) + '</div>' +
          '<button class="lnk" data-go="ocontract">Open the contract</button></div>';
      }
      (on.challenges || []).forEach(function (c) {
        var other = forceOfSlot(c.mine ? c.to : c.from);
        if (!other) return;
        h += c.mine
          ? '<div class="cpan onote"><div class="cpstat">You have challenged <b>' + esc(other.name) + '</b> (' + esc(other.player) + '). Waiting for them to answer.</div>' +
            '<button class="lnk" data-ochcancel="' + c.id + '">Withdraw the challenge</button></div>'
          : '<div class="cpan onote"><div class="cpstat"><b>' + esc(other.name) + '</b> (' + esc(other.player) + ') challenges you to a contract.</div>' +
            '<button class="start" data-ochaccept="' + c.id + '">Accept</button> <button class="lnk" data-ochcancel="' + c.id + '">Turn it down</button></div>';
      });
      return h;
    }
    function duelLine(d) {
      var k = d.contract, me = d.side, them = me === 'A' ? 'B' : 'A';
      if (!k) return 'being drawn up.';
      var mineSay = k.ready[me] ? 'you are ready' : k.picks[me] ? 'you have picked' : 'you have not picked your force yet';
      var theirSay = k.ready[them] ? 'ready' : k.picks[them] ? 'picking' : 'not picked yet';
      return mineSay + '; they are ' + theirSay + '.';
    }

    /* ================= the contracts on offer, online ================= */
    /* The dossier's own offers against the AI forces (rolled by the server, so the
       same each time), an AI force already in someone else's battle marked so; then
       the other players, to challenge. */
    function offersView() {
      var on = onl(), busyAi = on.busyAi || [];
      var h = E.offersView();
      (E.camp.offers || []).forEach(function (o, i) {
        if (busyAi.indexOf(o.rival) < 0) return;
        h = h.replace('<button class="start" data-take-offer="' + i + '">Take this contract</button>',
          '<button class="start" disabled title="Fighting someone else just now">Fighting someone else just now</button>');
      });
      var foot = '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
      var others = players().filter(function (p) { return !p.out; });
      var ch = '<h3>The other players</h3>';
      if (!others.length) ch += '<p class="dnote">Nobody else is playing on this world.</p>';
      others.forEach(function (p) {
        var asked = (on.challenges || []).filter(function (c) { return (c.mine && c.to === p.slot) || (!c.mine && c.from === p.slot); })[0];
        ch += '<div class="cpan cpan-B cpan-offer"' + E.stripe(p) + '><div class="cphead"><b>' + esc(founded(p) ? p.name : p.player + '’s force') + '</b>' +
          '<span class="ctier">' + esc(p.player) + ' · ' + C.words(p).tier + ' Tier ' + ROMAN[p.tier || 1] + '</span></div>' +
          (founded(p) ? E.statRow(p, true) : '<div class="cpstat">Not founded yet.</div>') +
          (asked ? '<div class="cpstat">' + (asked.mine ? 'You have challenged them.' : 'They have challenged you — answer it on the campaign’s page.') + '</div>'
            : founded(p) && founded(myCo()) ? '<button class="start" data-ochallenge="' + p.slot + '">Challenge them</button>' : '') +
          '</div>';
      });
      return h.replace(foot, '') + ch + foot;
    }

    /* ================= the contract, online =================
       With an AI force (terms as offered; only the player picks and says ready) or
       with another player (as two players at one screen: each picks unseen, both
       say ready). One screen for both; `ctx` says which. */
    function activeContract() {
      var on = onl();
      if (on.contract) {
        return { ai: true, k: on.contract, me: 'A', them: 'B', names: { A: myCo().name, B: E.camp.companies.B.name }, foe: E.camp.companies.B, foeName: E.camp.companies.B.name };
      }
      if (on.duel && on.duel.contract && on.duel.phase === 'contract') {
        var d = on.duel;
        return { ai: false, k: d.contract, me: d.side, them: d.side === 'A' ? 'B' : 'A', names: d.names, foe: forceOfSlot(d.foe), foeName: d.foeName, player: d.player };
      }
      return null;
    }
    function send(ctx, step, args, then) {
      var map = { contractTerms: 'aiTerms', contractForego: 'aiForego', contractForesee: 'aiForesee', contractBestDefence: 'aiBestDefence',
        contractLevel: 'aiLevel', contractPick: 'aiPick', contractReady: 'aiReady' };
      if (ctx.ai) cmd(map[step], args, then);
      else cmd('duel', { cmd: step, args: args || {} }, then);
    }
    function pickNow(k, me) {
      var key = k.turn + ':' + k.tier + ':' + k.pl + ':' + (k.scenario && k.scenario.id);
      var srv = k.picks[me];
      if (pickFor !== key || !pick) {
        pickFor = key;
        pick = srv && !srv.hidden ? { rids: (srv.rids || []).slice(), field: (srv.field || []).slice(), tactic: srv.tactic || null, drugs: (srv.drugs || []).slice() }
          : { rids: [], field: [], tactic: null, drugs: [] };
      }
      return pick;
    }
    function entriesOf(co, pk) {
      var out = [];
      pk.rids.forEach(function (rid) { var e = C.byRid(co, rid); if (e) out.push(e); });
      pk.field.forEach(function (key) { var e = C.newEntry(key); e.fielded = true; out.push(e); });
      return out;
    }
    function blocking(faults) {
      return (faults || []).filter(function (f) { return !/Needs at least/.test(f) && !/No units chosen/.test(f); });
    }
    function contractView() {
      var ctx = activeContract(), co = myCo();
      var h = '<h2>Contract</h2>';
      if (!ctx) return h + '<p class="lede">There is no contract just now.</p>' + backFoot();
      var k = ctx.k, me = ctx.me, them = ctx.them;
      h += '<p class="lede">' + esc(co.name) + ' against ' + esc(ctx.foeName) + (ctx.ai ? ' (an AI force)' : ' (' + esc(ctx.player) + ')') + '.</p>';
      var fore = k.fore;
      if (fore && !fore.done) {
        var who = fore.order[fore.ignored.length];
        h += '<div class="cpan"><div class="cpstat"><b>Foresighted Command</b> — both forces hold it: three scenario dice, and each sets one aside in turn.</div>';
        if (who === me) {
          h += '<div class="cpstat">Your turn: set one aside.</div>' + fore.dice.map(function (d, i) {
            return fore.ignored.indexOf(i) >= 0 ? '<span class="mk">' + d.roll + ' ' + esc(d.name) + ' — set aside</span> '
              : '<button class="lnk" data-ocforego="' + i + '">Set aside ' + d.roll + ' — ' + esc(d.name) + '</button> ';
          }).join('');
        } else h += '<div class="cpstat">Waiting for ' + esc(ctx.foeName) + ' to set one aside.</div>';
        return h + '</div>' + backFoot();
      }
      var SCv = root.PMCScen && root.PMCScen.SCENARIOS[k.scenario.id];
      h += '<div class="cpan"><div class="cpstat"><b>' + esc(k.scenario.name) + '</b> — Battle Tier ' + ROMAN[k.tier] + ', Priority Level ' + k.pl +
        (k.planet && k.planet !== 'random' ? ', on a ' + esc(k.planet) + ' world' : '') + '.</div>';
      if (k.foreNote) h += '<div class="cpstat dnote">' + esc(k.foreNote) + '</div>';
      if (k.roles) {
        var ro = k.roles;
        h += '<div class="cpstat"><b>' + esc(ctx.names[ro.attacker]) + '</b> attacks; <b>' + esc(ctx.names[ro.defender]) + '</b> defends' +
          (ro.bestDefence && ro.bestDefence.swapped ? ' (The Best Defence is Good Offence turned it round: D6 ' + ro.bestDefence.roll + ')' : '') + '.' +
          (SCv && SCv.roles ? ' <span class="dnote">' + esc(SCv.roles[ro.attacker === me ? 'attacker' : 'defender'] || '') + '</span>' : '') + '</div>';
      }
      if (!ctx.ai) h += '<div class="cpstat">' + cap(duelLine(onl().duel)) + '</div>';
      h += '</div>';
      var bd = k.roles && k.roles.bestDefence;
      if (bd && bd.pending && bd.side === me) h += '<div class="cpdoc"><button class="lnk" data-go="ocbestdef">The Best Defence is Good Offence — roll to attack (2+)</button></div>';
      if (k.alt && (k.altBy || 'A') === me && !k.altUsed && k.alt.id !== k.scenario.id) {
        h += '<div class="cpdoc">Foresighted Command — the second die showed <b>' + esc(k.alt.name) + '</b>. ' +
          '<button class="lnk" data-go="ocforesee">Fight ' + esc(k.alt.name) + ' instead</button></div>';
      }
      if (C.hasDoctrine(co, 'S4') && k.terms[me] === undefined) {
        var both = !ctx.ai && ctx.foe && C.hasDoctrine(ctx.foe, 'S4');
        h += '<div class="cpdoc"><b>On Our Terms…</b> ' + (both ? 'Both forces hold it: the Tier moves only if you both choose the same way. ' : 'Shift the Battle Tier by one. ') +
          '<button class="lnk" data-octerms="-1"' + (k.tier <= 1 ? ' disabled' : '') + '>Down to ' + ROMAN[Math.max(1, k.tier - 1)] + '</button> ' +
          '<button class="lnk" data-octerms="0">Keep ' + ROMAN[k.tier] + '</button> ' +
          '<button class="lnk" data-octerms="1"' + (k.tier >= k.tierRoll.cap ? ' disabled' : '') + '>Up to ' + ROMAN[Math.min(5, k.tier + 1)] + '</button></div>';
      }
      var lv = k.levels || [1], setsPl = ctx.ai || me === 'A';
      h += '<div class="field"><div><label for="oc-pl">Priority Level</label>' +
        '<select id="oc-pl"' + (setsPl && lv.length > 1 && !k.ready[me] ? '' : ' disabled') + '>' + [1, 2].map(function (n) {
          var can = lv.indexOf(n) >= 0;
          return '<option value="' + n + '"' + (k.pl === n ? ' selected' : '') + (can ? '' : ' disabled') + '>' + n + (n === 1 ? ' — skirmish' : ' — full battle') + '</option>';
        }).join('') + '</select>' + (setsPl ? '' : '<p class="dnote">The challenger sets the Priority Level.</p>') + '</div></div>';

      var pk = pickNow(k, me), units = entriesOf(co, pk), keys = units.map(function (e) { return R.entryPick(e); });
      var chk = R.checkArmy(keys, k.tier, k.pl, co.doctrines, pk.tactic || null, co.faction);
      if (k.ready[me] && !ctx.ai) {
        h += '<div class="cpan"><div class="cpstat"><b>You are ready</b> with ' + units.length + ' units: ' + units.map(function (e) { return esc(e.name); }).join(', ') + '.</div>' +
          '<div class="cpstat">Waiting for ' + esc(ctx.foeName) + '. The battle starts as soon as they are ready.</div>' +
          '<button class="lnk" data-go="ocunready">Change my force</button></div>';
        return h + backFoot(ctx);
      }
      h += '<div class="muster"><div class="muster-head"><b>Take the field</b>' +
        '<span class="pts' + (chk.spent > chk.budget ? ' over' : '') + '">' + chk.spent + ' / ' + chk.budget + '</span>' +
        '<button class="lnk" data-go="ocauto">Pick for me</button></div>';
      h += '<div class="chosen">' + units.map(function (e, i) {
        return '<span class="pickwrap"><button class="pick" data-ocunpick="' + i + '">' + esc(e.name) + ' <b>' + ROMAN[E.profile(e.key).tier] + '</b></button></span>';
      }).join('') + '</div><div class="cat tall">';
      co.roster.filter(function (e) { return pk.rids.indexOf(e.rid) < 0; }).forEach(function (e) {
        var p = E.profile(e.key), rest = e.restUntil > 0;
        var bad = rest ? ['in the workshop'] : blocking(R.checkArmy(keys.concat([R.entryPick(e)]), k.tier, k.pl, co.doctrines, pk.tactic || null, co.faction).faults);
        h += '<button class="cu" data-ocpick="' + e.rid + '"' + (bad.length ? ' disabled title="' + esc(bad[0]) + '"' : '') + '>' +
          '<span class="t">' + ROMAN[p.tier] + '</span><span><b>' + esc(e.name) + '</b><small>' + esc(p.name) + (rest ? ' — in the workshop' : '') + '</small></span></button>';
      });
      var fieldable = R.listFor(co.faction || 'pmc').filter(function (p) { return (C.isTurretP(p) || p.noSlot) && (p.tier <= k.tier || k.pl > 1); });
      if (fieldable.length) {
        h += '<h4>Fielded for this battle</h4>';
        fieldable.forEach(function (p) {
          var bad = blocking(R.checkArmy(keys.concat([p.key]), k.tier, k.pl, co.doctrines, pk.tactic || null, co.faction).faults);
          h += '<button class="cu" data-ocfield="' + p.key + '"' + (bad.length ? ' disabled title="' + esc(bad[0]) + '"' : '') + '>' +
            '<span class="t">' + ROMAN[p.tier] + '</span><span><b>' + esc(p.name) + '</b><small>not bought — for this battle only</small></span></button>';
        });
      }
      h += '</div></div>';
      if (co.faction === 'rebel') {
        h += '<div class="cpan orders"><div class="cprom-head"><b>Tactic</b></div><div class="orow"><span class="segs">' +
          [{ id: '', name: 'No tactic' }].concat(R.TACTICS).map(function (t) {
            return '<button class="lnk' + ((pk.tactic || '') === t.id ? ' on' : '') + '" data-octactic="' + t.id + '"' + (t.text ? ' ' + E.tip(t.name, t.text) : '') + '>' + esc(t.name) + '</button>';
          }).join('') + '</span></div></div>';
      }
      if (C.hasDoctrine(co, 'V4')) {
        var able = units.filter(function (e) { var p = E.profile(e.key); return p.cls === 'infantry' && p.group !== 'First Among Equals' && !p.command; });
        var n = Math.ceil(able.length / 3);
        h += '<div class="cpan orders"><div class="cprom-head"><b>Drug Dealer</b> — up to ' + n + ' go in Determined</div><div class="orow"><span class="segs">' +
          (able.length ? able.map(function (e) {
            var on = pk.drugs.indexOf(e.rid) >= 0;
            return '<button class="lnk' + (on ? ' on' : '') + '" data-ocdrug="' + e.rid + '"' + (!on && pk.drugs.length >= n ? ' disabled' : '') + '>' + esc(e.name) + '</button>';
          }).join('') : '<em>No infantry picked yet.</em>') + '</span></div></div>';
      }
      var why = chk.ok ? '' : esc((chk.faults || [])[0] || 'Not a legal force yet.');
      h += '<button class="start" data-go="ocready"' + (chk.ok ? '' : ' aria-disabled="true" data-tip="' + why + '" data-tip-title="Not yet"') + '>' +
        (ctx.ai ? 'Fight with this force' : 'Ready — fight with this force') + '</button>';
      return h + backFoot(ctx);
    }
    function backFoot(ctx) {
      return '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button>' +
        (ctx ? ' <button class="lnk" data-go="ocdrop">' + (ctx.ai ? 'Turn the contract down' : 'Call the contract off') + '</button>' : '') + '</p>';
    }

    /* ================= after the battle ================= */
    function postView() {
      var post = E.camp.post, st = post && post.steps[0];
      if (st && st.side !== 'A') {
        var d = onl().duel;
        return '<h2>After the battle</h2><p class="lede">' + esc(d ? d.foeName : 'The other player') + ' has a question to answer first (' +
          (st.kind === 'plunder' ? 'Plunderer' : st.kind === 'negotiate' ? 'Tough Negotiators' : 'No Place for the Weak!') + '). ' +
          'The aftermath follows once every question is answered.</p>' +
          '<p class="camp-foot"><button class="lnk" data-go="olist">← Online campaigns</button></p>';
      }
      return E.postView();
    }

    /* ================= what a press does, online =================
       Everything that would change the campaign is sent to the server instead;
       what only changes the screen is left to the dossier. True if handled. */
    function click(t, go) {
      var camp = E.camp;
      var attr = function (a) { return t.getAttribute(a); };
      // the list
      if (attr('data-ocamp')) { openCampaign(+attr('data-ocamp')); return true; }
      if (go === 'onew') { startNew(); return true; }
      if (go === 'ojoin') {
        var code = ((document.getElementById('ojoin-code') || {}).value || '').trim();
        if (!code) { E.note('Which campaign?', 'Type the code you were given.'); return true; }
        api('api/online/join', { method: 'POST', body: JSON.stringify({ code: code }) }).then(function (r) {
          if (!r.ok) { E.note('Not joined', cap(r.j.error || r.j.why || 'the server said no') + '.'); return; }
          openCampaign(r.j.id);
        });
        return true;
      }
      if (go === 'osignin') { E.hide(); if (root.PMCAccount) root.PMCAccount.signIn({ then: function () { enterList(); } }); return true; }
      if (go === 'olist') { enterList(); return true; }
      if (go === 'menu') { leaveCampaign(); E.toMenu(); return true; }
      if (!E.online || !camp) return false;

      // the lobby: a slot's colours opened, one picked, or closed by a tap elsewhere
      if (attr('data-olob-pick') !== null && t.hasAttribute('data-olob-pick')) {
        var pi = +attr('data-olob-pick'); colourFor = colourFor === pi ? null : pi; E.render(); return true;
      }
      if (t.hasAttribute('data-olob-col')) {
        var forSlot = +attr('data-olob-for'); colourFor = null;
        cmd('lobbyColour', { i: forSlot, colour: attr('data-olob-col') });
        return true;
      }
      if (colourFor !== null && E.view === 'olobby') { colourFor = null; E.render(); }
      if (go === 'olobready') { var ms = (lobby.slots || [])[lobby.slot] || {}; cmd('lobbyReady', { ready: !ms.ready }); return true; }
      if (go === 'olobstart') { cmd('lobbyStart', {}); return true; }
      if (go === 'olobsay') {
        var box = document.getElementById('olob-say'), said = box ? box.value.trim() : '';
        if (said) cmd('lobbyChat', { text: said });
        return true;
      }
      if (go === 'olobleave') {
        var host = !!(lobby && lobby.host);
        E.ask({ kind: 'confirm', title: host ? 'Close the campaign?' : 'Leave the campaign?', danger: host,
          text: host ? 'It is gone, for everyone in its lobby.' : 'Your slot opens again for somebody else.',
          okLabel: host ? 'Close it' : 'Leave',
          onOk: function () {
            var o = E.online;
            api('api/online/' + o.id + '/leave', { method: 'POST' }).then(function (r) {
              if (!r.ok) { E.note('Not done', cap(r.j.error || 'the server said no') + '.'); return; }
              enterList();
            });
          } });
        return true;
      }

      // founding the player's own force
      if (attr('data-bfaction') && E.view === 'found') {
        E.keepFoundName();
        var d0 = E.draft, nm = d0.name, col = d0.colour, chosen = d0.colourChosen;
        E.beginOwn('A', attr('data-bfaction'));
        E.draft.name = nm;
        E.draft.colour = col;
        if (chosen) E.draft.colourChosen = true;
        E.render(); return true;
      }
      if (go === 'dofound') {
        if (attr('aria-disabled') === 'true') { if (root.PMCTips) root.PMCTips.show(t); return true; }
        E.keepFoundName();
        var dr = E.draft, name = (dr.name || '').trim();
        if (!name) { E.note('It needs a name', 'Give the force something to be known by.'); return true; }
        cmd('found', { faction: camp.companies.A.faction || 'pmc', name: name, keys: dr.keys, doctrine: dr.doctrine, colour: dr.colour || null },
          function () { E.draft = null; E.view = 'hub'; });
        return true;
      }
      if (go === 'foundback') { enterList(); return true; }

      // the force's own changes
      var co = camp.companies.A;
      if (attr('data-recruit')) {
        var rk = attr('data-recruit'), drone = t.hasAttribute('data-asdrone'), riders = t.hasAttribute('data-asriders');
        var rp = E.profile(rk), cost = C.recruitCost(co, rk), word = C.money(co);
        E.ask({
          kind: 'confirm', title: C.words(co).recruit + ' ' + rp.name + (drone ? ' (drone)' : riders ? ' (Riders)' : '') + '?',
          text: cost ? 'It costs ' + cost + ' ' + word + '. You have ' + co.kUC + ' ' + word + ', leaving ' + (co.kUC - cost) + ' ' + word + '.' : 'It costs nothing.',
          okLabel: C.words(co).recruit + (cost ? ' for ' + cost + ' ' + word : ''),
          onOk: function () { cmd('recruit', { key: rk, drone: drone, riders: riders }); }
        });
        return true;
      }
      if (attr('data-disband')) {
        var de = C.byRid(co, attr('data-disband'));
        if (!de) return true;
        E.ask({ kind: 'confirm', title: 'Disband ' + de.name + '?', danger: true, text: 'They come off the dossier for good, with everything they have earned.',
          okLabel: 'Disband them', onOk: function () { cmd('disband', { rid: de.rid }); } });
        return true;
      }
      if (attr('data-rename')) {
        var re = C.byRid(co, attr('data-rename'));
        if (!re) return true;
        E.ask({ kind: 'text', title: 'What are they called?', value: re.name, text: 'A name of your own travels with them through every promotion.',
          okLabel: 'Rename', onOk: function (v) { if (v) cmd('rename', { rid: re.rid, name: v }); } });
        return true;
      }
      if (attr('data-rsoldier')) {
        var se = C.byRid(co, attr('data-rsoldier')), si = +attr('data-i'), sm = se && se.men && se.men[si];
        if (!sm) return true;
        E.ask({ kind: 'text', title: 'Rename ' + sm.rank + ' ' + sm.name, value: sm.name, max: 32, text: 'They keep the name for as long as they survive.',
          okLabel: 'Rename', onOk: function (v) { if (v) cmd('renameSoldier', { rid: se.rid, i: si, name: v }); } });
        return true;
      }
      if (attr('data-emount')) { cmd('mount', { rid: attr('data-emount'), mount: attr('data-m') }); return true; }
      if (attr('data-promote')) { cmd('promote', { rid: attr('data-promote'), to: attr('data-to') }, function () { E.closeModal(); }); return true; }
      if (attr('data-fit')) { var up = E.upState; cmd('upgrade', { rid: up && up.rid, n: +attr('data-fit') }, function () { E.toDossier(); }); return true; }
      if (attr('data-take')) { cmd('takeDoctrine', { id: attr('data-take') }, function () { E.view = 'hub'; }); return true; }
      if (attr('data-swapin')) { cmd('swapDoctrine', { out: E.swapOut, in: attr('data-swapin') }, function () { E.clearSwap(); E.view = 'hub'; }); return true; }
      if (go === 'promoteco') { cmd('promoteCompany', {}, function () { E.view = 'doctrine'; }); return true; }
      if (go === 'aspire') { cmd('aspire', {}); return true; }
      if (go === 'drawnow') {
        var ds = E.drawState;
        if (!ds || (ds.picked || []).length !== 3 || ds.won) return true;
        cmd('honour', { rid: ds.entry.rid, picks: ds.picked.slice() }, function (j) {
          var e = C.byRid(myCo(), ds.entry.rid);
          ds.entry = e || ds.entry;
          ds.won = C.honourTable(ds.entry.key)[j.won - 1];
        });
        return true;
      }
      if (attr('data-campcolour') && E.view === 'hub') {
        var want = attr('data-campcolour');
        var taken = (camp.rivals || []).filter(function (r) { return r.colour === want; })[0];
        if (taken) { E.note('That colour is taken', taken.name + ' already wears it. Pick another, so the forces can be told apart.'); return true; }
        cmd('colour', { colour: want }, function () { E.closeColours(); });
        return true;
      }
      // the hub's way to the contracts, and into the battle
      if (go === 'offers' || go === 'contract') {
        E.view = activeContract() ? 'ocontract' : 'offers';
        E.render(); return true;
      }
      if (go === 'ocontract') { E.view = 'ocontract'; E.render(); return true; }
      if (go === 'obattle') { var bc = battleCode(); if (bc) goBattle(bc); return true; }
      if (attr('data-take-offer') !== null && attr('data-take-offer') !== undefined && t.hasAttribute('data-take-offer')) {
        cmd('aiTake', { i: +attr('data-take-offer') }, function () { E.view = 'ocontract'; });
        return true;
      }
      if (attr('data-ochallenge')) { cmd('duelAsk', { to: +attr('data-ochallenge') }, function () { E.view = 'hub'; }); return true; }
      if (attr('data-ochaccept')) { cmd('duelAccept', { id: +attr('data-ochaccept') }, function () { E.view = 'ocontract'; }); return true; }
      if (attr('data-ochcancel')) { cmd('duelCancel', { id: +attr('data-ochcancel') }); return true; }
      // nothing of the campaign's file is this browser's to change
      if (/^(wipe|import|storeuse|storekeep|standard|hubside|export)$/.test(go || '')) return true;
      // a force that can no longer fight takes its player out; or a player gives it up
      if (go === 'campend') { cmd('campEnd', {}); return true; }
      if (go === 'oconcede') {
        E.closeModal();
        E.ask({ kind: 'confirm', title: 'Give the campaign up?', danger: true,
          text: 'You leave the world: your force fights no more, and the others play on without you. There is no undoing it.',
          okLabel: 'Give it up', onOk: function () { cmd('concede', {}); } });
        return true;
      }
      if (go === 'reborn') {
        cmd('postReborn', { i: +attr('data-i') }, function (j) {
          if (j && j.roll) E.note('Enhanced Genetic Memory', 'D6 ' + j.roll + ' — ' + (j.remembered ? 'it remembers everything it had.' : 'the memory did not carry.'));
        });
        return true;
      }

      // the contract
      var ctx = activeContract();
      if (ctx) {
        var k = ctx.k, pk = pickNow(k, ctx.me);
        if (go === 'ocdrop') {
          E.ask({ kind: 'confirm', title: ctx.ai ? 'Turn the contract down?' : 'Call the contract off?',
            text: ctx.ai ? 'The other contracts on offer stay as they are.' : 'It is off for both of you; either may challenge the other again.',
            okLabel: ctx.ai ? 'Turn it down' : 'Call it off', onOk: function () { cmd(ctx.ai ? 'aiDrop' : 'duelOff', {}, function () { E.view = 'hub'; }); } });
          return true;
        }
        if (attr('data-ocforego') !== null) { send(ctx, 'contractForego', { i: +attr('data-ocforego') }); return true; }
        if (go === 'ocforesee') { send(ctx, 'contractForesee', {}); return true; }
        if (go === 'ocbestdef') {
          send(ctx, 'contractBestDefence', {}, function (j) {
            if (j.swapped) E.note('The Best Defence is Good Offence', 'D6 ' + j.roll + ' — you are the attacker now. Check the list still suits the job.');
          });
          return true;
        }
        if (attr('data-octerms') !== null) { send(ctx, 'contractTerms', { dir: +attr('data-octerms') }); return true; }
        if (attr('data-ocpick')) { pk.rids.push(attr('data-ocpick')); E.render(); return true; }
        if (attr('data-ocfield')) { pk.field.push(attr('data-ocfield')); E.render(); return true; }
        if (attr('data-ocunpick') !== null) {
          var i = +attr('data-ocunpick');
          if (i < pk.rids.length) pk.rids.splice(i, 1); else pk.field.splice(i - pk.rids.length, 1);
          pk.drugs = pk.drugs.filter(function (r) { return pk.rids.indexOf(r) >= 0; });
          E.render(); return true;
        }
        if (attr('data-octactic') !== null) { pk.tactic = attr('data-octactic') || null; E.render(); return true; }
        if (attr('data-ocdrug')) {
          var dg = attr('data-ocdrug'), at = pk.drugs.indexOf(dg);
          if (at >= 0) pk.drugs.splice(at, 1); else pk.drugs.push(dg);
          E.render(); return true;
        }
        if (go === 'ocauto') {
          var got = C.pickForce(myCo(), k.tier, k.pl, pk.tactic || null) || [];
          pk.rids = got.filter(function (e) { return !e.fielded; }).map(function (e) { return e.rid; });
          pk.field = got.filter(function (e) { return e.fielded; }).map(function (e) { return e.key; });
          pk.drugs = [];
          E.render(); return true;
        }
        if (go === 'ocready') {
          if (attr('aria-disabled') === 'true') { if (root.PMCTips) root.PMCTips.show(t); return true; }
          var pickNowArgs = { rids: pk.rids.slice(), field: pk.field.slice(), tactic: pk.tactic, drugs: pk.drugs.slice() };
          send(ctx, 'contractPick', pickNowArgs, function () { setTimeout(function () { send(ctx, 'contractReady', { ready: true }); }, 0); });
          return true;
        }
        if (go === 'ocunready') { send(ctx, 'contractReady', { ready: false }); return true; }
      }

      // the questions after a battle
      var post = camp.post, st = post && post.steps[0];
      if (st && st.side === 'A') {
        if (go === 'plunder') { cmd('postPlunder', {}); return true; }
        if (go === 'negotiate') { cmd('postNegotiate', { sel: (st.sel || []).slice() }); return true; }
        if (attr('data-weak') !== null) { cmd('postWeak', { choice: attr('data-weak') || '' }); return true; }
        if (go === 'postnext') { cmd('postNext', {}); return true; }
      }
      return false;
    }
    // a choice from a list: the contract's Priority Level, and the lobby's
    function change(target) {
      if (!E.online) return false;
      if (target.id === 'oc-pl') { var ctx = activeContract(); if (ctx) send(ctx, 'contractLevel', { pl: +target.value }); return true; }
      if (target.id === 'olob-n') { cmd('lobbySlots', { n: +target.value }); return true; }
      if (target.id === 'olob-pub') { cmd('lobbyListed', { on: !!target.checked }); return true; }
      if (target.hasAttribute('data-olob-ai')) { cmd('lobbySlot', { i: +target.getAttribute('data-olob-ai'), kind: target.checked ? 'ai' : 'open' }); return true; }
      if (target.hasAttribute('data-olob-army')) { cmd('lobbyFaction', { i: +target.getAttribute('data-olob-army'), faction: target.value }); return true; }
      if (target.hasAttribute('data-olob-colour')) { cmd('lobbyColour', { i: +target.getAttribute('data-olob-colour'), colour: target.value }); return true; }
      return false;
    }

    return {
      enterList: enterList, listView: listView, lobbyView: lobbyView, offersView: offersView, contractView: contractView, postView: postView, hubNote: hubNote,
      click: click, change: change, steer: function () { if (E.online && E.camp) steer(false); },
      afterBattle: afterBattle, fighting: function () { return fighting; },
      leave: leaveCampaign, local: function () { return stashed ? localCamp : E.camp; },
      inLobby: function () { return !!(E.online && E.online.phase === 'lobby'); },
      // one opened straight from the main menu's Continue list
      openOne: function (id) { leaveCampaign(); return openCampaign(id); },
      // one started from the lobby's Start a game
      startNew: function (how) { leaveCampaign(); return startNew(how); }
    };
  };
})(window);
