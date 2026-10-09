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
    var C = E.C, R = E.R, ROMAN = E.ROMAN, esc = E.esc, U = root.PMCUi;
    var busy = false;                               // a command on its way: the next waits
    var poll = null;                                // the campaign asked for again now and then, for the others' changes
    var pick = null, pickFor = null;                // the player's force for a contract, as picked so far here, and for which
    var fighting = null;                            // the battle walked into: its code
    var lobby = null;                               // the campaign while it is in its lobby, as the server sent it
    var localCamp, stashed = false;                 // the browser's own campaign, put aside while an online one is open

    function api(path, opts) {
      opts = opts || {};
      // a hotseat campaign with AI forces is the same world, kept on this device (net/localworld.js)
      if (root.PMCLocalWorld && /api\/online\/h\d+/.test(path)) return root.PMCLocalWorld.api(path, opts);
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

    /* ================= in and out ================= */
    /* Out of the campaign, back to the Multiplayer screen (where a new one is
       started or one joined; the main menu's Continue opens one again). */
    function toMulti() {
      // one kept on this device was not opened from Multiplayer: the main menu
      if (E.online && E.online.local) { leaveCampaign(); E.toMenu(); return; }
      leaveCampaign();
      E.hide();
      if (root.PMCLobby && root.PMCLobby.available()) root.PMCLobby.open(); else E.toMenu();
    }
    // an online campaign opened: the browser's own campaign is put aside (and never saved over)
    function openCampaign(id) {
      return api('api/online/' + id).then(function (r) {
        if (!r.ok) { E.note('That campaign will not open', cap(r.j.error || 'the server said no') + '.'); return; }
        if (!stashed) { localCamp = E.camp; stashed = true; }
        E.online = { id: r.j.id, slot: r.j.slot, version: 0, side: 'A', local: !!(root.PMCLocalWorld && root.PMCLocalWorld.isLocal(r.j.id)) };
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
          var slotColour = camp.companies.A.colour, fac = camp.companies.A.faction || 'pmc';
          E.beginOwn('A', fac);
          if (slotColour) E.draft.colour = slotColour;
          // a name to start from: the player's own, and what they run
          var me = lobby && lobby.slots && lobby.slots[lobby.slot];
          if (me && me.name && !E.draft.name) E.draft.name = me.name + '\u2019s ' + ({ pmc: 'Company', rebel: 'Revolt', bugs: 'Swarm', xeno: 'Tribe' }[fac] || 'Company');
        }
        return;
      }
      if (E.view === 'found') { E.draft = null; E.view = 'hub'; }
      if (camp.post) { E.view = 'post'; return; }
      if (E.view === 'post') E.view = 'hub';
      // a battle's aftermath not yet read: shown once, from the player's log
      var af = onl().after;
      /* Not while its battle is still being fought, or over on the board behind
         the campaign with its result not yet read there: marked shown then, a
         refresh before Continue would come back to the hub rather than to the
         aftermath. (A battle on this device stays on the board once read; it no
         longer holds anything back then.) */
      var st = root.PMC_STATE && root.PMC_STATE();
      var ours = !!(st && st.cfg && st.cfg.onlineCampaign && E.online && String(st.cfg.onlineCampaign) === String(E.online.id));
      var board = !!fighting || (ours && ((root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE()) || (root.PMC_RESULT_UNREAD && root.PMC_RESULT_UNREAD())));
      if (af && af.n > seen() && !board) {
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
      // (two players at one device: each their own)
      var k = 'pmc-online-seen2:' + (E.online ? E.online.id + (E.online.local ? ':' + E.online.slot : '') : '');
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
            if (r.code === 404 && o.phase === 'lobby') { leaveCampaign(); E.note('The campaign is closed', 'Its host closed it before it started.', toMulti); }
            return;
          }
          if (r.j.version === o.version) return;
          var before = battleCode(), waitingOnIt = E.view === 'ocontract';
          // a line being typed into the lobby's chat (or its name, by the host) survives the redraw
          var kept = ['olob-say', 'olob-name'].map(function (k) { var x = document.getElementById(k); return x && (k === 'olob-say' || document.activeElement === x) ? { k: k, v: x.value, on: document.activeElement === x } : null; }).filter(Boolean);
          take(r.j);
          var shown = E.isOpen();
          if (shown && E.view === 'olobby') {
            E.render();
            kept.forEach(function (o) { var x = document.getElementById(o.k); if (x) { x.value = o.v; if (o.on) x.focus(); } });
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
      if (E.online && E.online.local) { localBattle(code); return; }
      if (!root.PMCLobby || !root.PMCLobby.joinBattle) { E.note('No battle here', 'This page cannot reach the game server.'); return; }
      fighting = code;
      E.hide();
      root.PMCLobby.joinBattle(code, {
        over: function () { afterBattle(true); },
        gone: function () { afterBattle(false); }
      });
    }
    /* A battle of a campaign kept on this device: laid on this device's own table,
       both players at it for a contract between them (each modifying their army
       unseen, in turn), the AI playing its side otherwise. */
    function localBattle(code) {
      var L = root.PMCLocalWorld, b = L && L.battle(code);
      if (!b || !root.PMC_NEWGAME) { E.note('No battle here', 'That battle is not kept on this device.'); return; }
      var cfg = Object.assign({}, b.cfg, { localBattle: code, campLid: null });
      if (cfg.mode === 'hotseat') { cfg.readyUp = false; cfg.secretSwaps = true; }
      fighting = code;
      E.hide();
      root.PMC_NEWGAME(cfg);
    }
    /* Its result: handed to the world (once, by the battle's code), and the campaign
       opened again on what follows — for the player whose battle it was. */
    function localOver(report, cfg) {
      var L = root.PMCLocalWorld, code = cfg && cfg.localBattle, b = L && L.battle(code);
      if (!b) return;
      if (b.ref && b.ref.kind === 'ai') L.setSeat(b.id, +b.ref.slot);
      L.battleOver(code, report);
      fighting = null;
      var back = function () { if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE(); leaveCampaign(); openCampaign(b.id); };
      if (root.PMC_AFTER_RESULT) root.PMC_AFTER_RESULT(back); else back();
    }
    // the battle over (read the result first) or walked away from: back to the campaign, as the server has it now
    function afterBattle(read) {
      if (!fighting) return false;
      fighting = null;
      var back = function () { if (root.PMC_BATTLE_GONE) root.PMC_BATTLE_GONE(); refresh(function () { E.open(E.view); }); };
      // over on the board (whoever ended it): its result read first, as a battle played to the end is
      var st = root.PMC_STATE && root.PMC_STATE();
      if (!root.PMC_AFTER_RESULT || !(read || (st && st.over))) { setTimeout(back, read ? 900 : 2500); return true; }
      root.PMC_AFTER_RESULT(back);
      return true;
    }

    /* ================= the lobby ================= */
    function swatch(c) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, k = CO[c];
      return '<span class="olob-sw"' + (k ? ' style="background:' + k.dark + ';border-color:' + k.light + '"' : '') + '></span>';
    }
    var colourFor = null;                           // the lobby slot whose colours are open, if any
    function lobbyView() {
      var L = lobby || {}, host = !!L.host, me = L.slot;
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
      // the code that brings the others in, in the title bar
      var h = '<h2>' + (L.invite ? '<span class="olob-code" title="The code that brings the others in: Join on the Multiplayer screen">' + esc(L.invite) + '</span>' : 'Campaign') + '</h2>';
      // its name, under the top bar: the host types it in, the players read it
      h += '<div class="olob-name"><label for="olob-name">Name</label>' + (host
        ? '<input class="tin" id="olob-name" maxlength="40" autocomplete="off" value="' + esc(L.name || '') + '">'
        : '<b>' + esc(L.name || '') + '</b>') + '</div>';
      h += '<div class="olob-slots">' + (L.slots || []).map(function (s, i) {
        var mine = i === me, canSlot = host && s.kind !== 'human', canColour = mine || (host && s.kind !== 'human'), canArmy = mine || (host && s.kind === 'ai');
        var who = s.kind === 'human' ? esc(s.name)
          : s.kind === 'ai' ? 'AI force' : '<em>Open \u2014 waiting for a player</em>';
        // its colour: a chip like the founding screen's, opening the colours (those other slots wear greyed out)
        var c = CO[s.colour], chip = U.chip(s.colour);
        var row = '<div class="olob-slot' + (mine ? ' mine' : '') + '">' +
          (canColour ? U.chipButton('data-olob-pick="' + i + '"', chip, colourFor === i, c ? c.name : 'Colour') : U.chipStill(chip)) +
          '<span class="olob-who"><b>' + who + '</b>' + (s.kind === 'human' ? '<small>' + (s.ready ? 'Ready' : 'Not ready') + '</small>' : '') + '</span>';
        // the host: an AI force in this slot, or open for a player
        if (canSlot) row += '<label class="olob-ai"><input type="checkbox" data-olob-ai="' + i + '"' + (s.kind === 'ai' ? ' checked' : '') + '> AI</label>';
        if (s.kind !== 'open') {
          row += canArmy ? U.armySelect('data-olob-army="' + i + '"', s.faction, s.kind === 'ai' ? 'random' : null) : U.armyStill(s.faction);
        }
        row += '</div>';
        return row;
      }).join('') + '</div>';
      /* Its colours, popped up beside the chip as the founding screen's are: drawn
         outside the scrolling list (so it is not cut off), and put by the chip once drawn. */
      var cs = colourFor != null && (L.slots || [])[colourFor];
      if (cs) {
        h += U.colourPop('data-olob-popfor="' + colourFor + '"', cs.colour, function (k) {
          // greyed out only where another player wears it; an AI force's is taken from it (it gets another)
          var holder = (L.slots || []).filter(function (x, j) { return j !== colourFor && x.colour === k; })[0];
          var taken = !!holder && holder.kind === 'human', ai = !!holder && !taken;
          return { attrs: 'data-olob-col="' + k + '" data-olob-for="' + colourFor + '"', off: taken, ai: ai,
            note: taken ? ' \u2014 another player wears it' : ai ? ' \u2014 an AI force wears it, and will take another' : '' };
        });
      }
      /* One row: how many forces, whether it is listed for anyone to join, and the
         host's Start or a player's Ready. */
      var mineSlot = (L.slots || [])[me] || {}, n = (L.slots || []).length;
      h += '<div class="olob-bar">';
      h += host ? '<label class="olob-n">Forces <select id="olob-n">' + [2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (k) {
        return '<option value="' + k + '"' + (k === n ? ' selected' : '') + '>' + k + '</option>';
      }).join('') + '</select></label>' : '<span class="olob-n">' + n + ' forces</span>';
      h += host ? '<label class="olob-pub"><input type="checkbox" id="olob-pub"' + (L.listed ? ' checked' : '') + '> Public</label>'
        : '<span class="olob-pub">' + (L.listed ? 'Public' : 'Private') + '</span>';
      // everyone says they are ready, the host too; then the host has Start
      var allReady = (L.slots || []).every(function (x) { return x.kind !== 'human' || x.ready; });
      h += '</div>';
      /* as the skirmish room has it, above the chat: the way out a quiet link, and the
         one thing to do next the full-width button (ready, then the host's Start) */
      h += '<div class="lob-acts olob-acts"><button class="lnk" data-go="omulti">Leave</button>';
      if (host && allReady) h += '<button class="start" data-go="olobstart">Start the campaign</button>';
      else h += '<button class="start' + (mineSlot.ready ? ' on' : '') + '" data-go="olobready">' +
        (!mineSlot.ready ? 'I am ready' : host ? 'Ready \u2014 waiting for the players' : 'Ready \u2014 waiting for the host') + '</button>';
      h += '</div>';
      h += chatHTML();
      // its way back (in the top bar) leaves the lobby, or closes it for the host
      h += '<p class="camp-foot"><button class="lnk" data-go="omulti">\u2190 Multiplayer</button></p>';
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
    // at one device (a hotseat campaign kept as a world here): the screen to the other player
    function handOver() {
      var LW = root.PMCLocalWorld, wid = E.online && E.online.id;
      if (!LW || !wid) return;
      var to = LW.seat(wid) ? 0 : 1;
      LW.setSeat(wid, to);
      leaveCampaign();
      openCampaign(wid).then(function () { E.note('Over to ' + LW.playerName(to), 'Pass the device to ' + LW.playerName(to) + '.'); });
    }
    function hubNote() {
      var on = onl(), h = '';
      // kept on this device: who is at the screen, and the hand-over to the other player
      if (E.online && E.online.local) {
        var L = root.PMCLocalWorld, here = L.seat(E.online.id), there = here ? 0 : 1;
        h += '<div class="cpan onote"><div class="cpstat">At the screen: <b>' + esc(L.playerName(here)) + '</b>' +
'</div><button class="start" data-go="oseat">Hand over to ' + esc(L.playerName(there)) + '</button></div>';
      }
      var b = battleCode();
      if (b) {
        h += '<div class="cpan onote"><div class="cpstat"><b>The battle is ready.</b></div><button class="start" data-go="obattle">Go to the battle</button></div>';
      } else if (on.contract) {
        h += '<div class="cpan onote"><div class="cpstat">A contract with <b>' + esc(E.camp.companies.B.name) + '</b> is waiting on you.</div>' +
          '<button class="start" data-go="ocontract">Open the contract</button></div>';
      } else if (on.duel) {
        var d = on.duel;
        h += '<div class="cpan onote"><div class="cpstat">A contract with <b>' + esc(d.foeName) + '</b> (' + esc(d.player) + ') — ' + duelLine(d) + '</div>' +
          '<button class="start" data-go="ocontract">Open the contract</button></div>';
      }
      (on.challenges || []).forEach(function (c) {
        var other = forceOfSlot(c.mine ? c.to : c.from);
        if (!other) return;
        h += c.mine
          ? '<div class="cpan onote"><div class="cpstat">You have challenged <b>' + esc(other.name) + '</b> (' + esc(other.player) + '). Waiting for them to answer.</div>' +
            '<button class="start" data-ochcancel="' + c.id + '">Withdraw the challenge</button></div>'
          : '<div class="cpan onote"><div class="cpstat"><b>' + esc(other.name) + '</b> (' + esc(other.player) + ') challenges you to a contract.</div>' +
            // turning it down and taking it up side by side, the same buttons as the contract's own two
            '<div class="cacts"><button class="start cdrop" data-ochcancel="' + c.id + '">Turn it down</button><button class="start" data-ochaccept="' + c.id + '">Accept</button></div></div>';
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
            : p.busy ? '<button class="start" disabled title="Fighting someone else just now">Fighting someone else just now</button>'
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
      // the job as the offers once showed it: the scenario and world, the Tier and Levels, your side of it, what wins it
      h += '<div class="cpan cpan-job">' + E.jobCard(k, me, k.levels);
      if (k.foreNote) h += '<div class="cpstat dnote">' + esc(k.foreNote) + '</div>';
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
      /* The Priority Level: the levels both forces can field. Against a player, each
         says which they want and it changes only when both want the same. */
      var lv = k.levels || [1], wants = k.plWant || {}, mineWant = ctx.ai ? null : wants[me], theirWant = ctx.ai ? null : wants[them];
      var shownPl = mineWant || k.pl, plNote = '';
      if (lv.length < 2) plNote = 'Only Priority Level ' + (lv[0] || 1) + ' is on offer: ' + (lv[0] === 2 ? '' : 'both forces must be able to field a full army for 2.');
      else if (!ctx.ai && theirWant && theirWant !== k.pl) plNote = esc(ctx.foeName) + ' wants Priority Level ' + theirWant + ' \u2014 choose it too to change it.';
      else if (!ctx.ai && mineWant && mineWant !== k.pl) plNote = 'You want Priority Level ' + mineWant + ' \u2014 waiting for ' + esc(ctx.foeName) + ' to agree. It stays at ' + k.pl + ' until then.';
      else if (!ctx.ai) plNote = 'Both of you choose; it changes only when you agree.';
      h += '<div class="field plrow"><div><label for="oc-pl">Priority Level</label>' +
        '<select id="oc-pl"' + (lv.length > 1 && !k.ready[me] ? '' : ' disabled') + '>' + [1, 2].map(function (n) {
          var can = lv.indexOf(n) >= 0;
          return '<option value="' + n + '"' + (shownPl === n ? ' selected' : '') + (can ? '' : ' disabled') + '>' + n + '</option>';
        }).join('') + '</select>' + (plNote ? '<p class="dnote">' + plNote + '</p>' : '') + '</div></div>';

      var pk = pickNow(k, me), units = entriesOf(co, pk), keys = units.map(function (e) { return R.entryPick(e); });
      var chk = R.checkArmy(keys, k.tier, k.pl, co.doctrines, pk.tactic || null, co.faction);
      if (k.ready[me] && !ctx.ai) {
        h += '<div class="cpan"><div class="cpstat"><b>You are ready</b> with ' + units.length + ' units: ' + units.map(function (e) { return esc(e.name); }).join(', ') + '.</div>' +
          '<div class="cpstat">Waiting for ' + esc(ctx.foeName) + '. The battle starts as soon as they are ready.</div>' +
          '<button class="lnk" data-go="ocunready">Change my force</button></div>';
        return h + backFoot(ctx);
      }
      var K = E.contractKit(), list = '';
      // what each Tier asks for at this Battle Tier and Priority Level, and how many of each are in the list
      var limits = '<p class="limits">' + U.limitsLine(R.compFor(co.faction || 'pmc', k.tier).limits, chk.counts || {}, k.pl) + '</p>';
      var at = {};
      K.pickOrder(co.roster.filter(function (e) { return pk.rids.indexOf(e.rid) < 0; }), 'A').forEach(function (e) {
        list += K.groupHead(e, at);
        var rest = e.restUntil > 0;
        var bad = rest ? ['in the workshop'] : blocking(R.checkArmy(keys.concat([R.entryPick(e)]), k.tier, k.pl, co.doctrines, pk.tactic || null, co.faction).faults);
        // what each unit is carrying, as the force screen at one table shows it: its EXP, honours and traumas, and its Trauma Points down the right
        list += K.rosterRow('data-ocpick="' + e.rid + '"', e, bad, rest ? ' — in the workshop' : '');
      });
      var fieldable = R.listFor(co.faction || 'pmc').filter(function (p) { return (C.isTurretP(p) || p.noSlot) && (p.tier <= k.tier || k.pl > 1); });
      if (fieldable.length) {
        list += '<h4>Fielded for this battle</h4>';
        fieldable.forEach(function (p) {
          var bad = blocking(R.checkArmy(keys.concat([p.key]), k.tier, k.pl, co.doctrines, pk.tactic || null, co.faction).faults);
          list += K.fieldRow('data-ocfield="' + p.key + '"', p, bad);
        });
      }
      // (a rebel's tactic is chosen at the table, when the battle begins)
      if (C.hasDoctrine(co, 'V4')) {
        var able = units.filter(function (e) { var p = E.profile(e.key); return p.cls === 'infantry' && p.group !== 'First Among Equals' && !p.command; });
        var n = Math.ceil(able.length / 3);
        h += '<div class="cpan orders"><div class="cprom-head"><b>Drug Dealer</b> — up to ' + n + ' go in Determined</div><div class="orow"><span class="segs">' +
          (able.length ? able.map(function (e) {
            var on = pk.drugs.indexOf(e.rid) >= 0;
            return '<button class="lnk' + (on ? ' on' : '') + '" data-ocdrug="' + e.rid + '"' + (!on && pk.drugs.length >= n ? ' disabled' : '') + '>' + esc(e.name) + '</button>';
          }).join('') : '<em>No infantry picked yet.</em>') + '</span></div></div>';
      }
      h = K.scrollTop(h);
      // the list as the contract screen at one table draws it (dossier-contract.js): the force on the page, the picker in a window over it
      h += K.forceBox({ co: co, fkey: 'A', chk: chk, units: units, limits: limits, drop: 'data-ocunpick', list: list, auto: 'ocauto', clear: 'occlear' });
      var why = chk.ok ? '' : esc((chk.faults || [])[0] || 'Not a legal force yet.');
      // backing out sits in line with going in, the same button
      h += K.fightBar('ocdrop', ctx.ai ? 'Turn down' : 'Call off', 'ocready', ctx.ai ? 'Fight with this force' : 'Ready — fight with this force', chk.ok ? null : why);
      return h + backFoot(null);
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
          // on this device: the screen to the other player, who answers it here
          (E.online && E.online.local ? '<div class="camp-dock"><button class="start" data-go="oseat">Hand over to ' + esc(root.PMCLocalWorld.playerName(root.PMCLocalWorld.seat(E.online.id) ? 0 : 1)) + '</button></div>' : '') +
          '<p class="camp-foot"><button class="lnk" data-go="omulti">← Multiplayer</button></p>';
      }
      return E.postView();
    }

    /* ================= what a press does, online =================
       Everything that would change the campaign is sent to the server instead;
       what only changes the screen is left to the dossier. True if handled. */
    function click(t, go) {
      var camp = E.camp;
      var attr = function (a) { return t.getAttribute(a); };
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
      if (go === 'omulti' && E.view !== 'olobby') { toMulti(); return true; }
      if (go === 'omulti') {
        var host = !!(lobby && lobby.host);
        E.ask({ kind: 'confirm', title: host ? 'Close the campaign?' : 'Leave the campaign?', danger: host,
          text: host ? 'It is gone, for everyone in its lobby.' : 'Your slot opens again for somebody else.',
          okLabel: host ? 'Close it' : 'Leave',
          onOk: function () {
            var o = E.online;
            api('api/online/' + o.id + '/leave', { method: 'POST' }).then(function (r) {
              if (!r.ok) { E.note('Not done', cap(r.j.error || 'the server said no') + '.'); return; }
              toMulti();
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
          function () {
            E.draft = null; E.view = 'hub';
            // at one device, the other player founds theirs next
            var other = E.online && E.online.local ? players().filter(function (p) { return !founded(p); })[0] : null;
            if (other) setTimeout(function () { handOver(); }, 0);
          });
        return true;
      }
      if (go === 'foundback') { toMulti(); return true; }

      // the force's own changes
      var co = camp.companies.A;
      if (attr('data-recruit')) {
        var rk = attr('data-recruit'), drone = t.hasAttribute('data-asdrone'), riders = t.hasAttribute('data-asriders');
        var rp = E.profile(rk), cost = C.recruitCost(co, rk), word = C.money(co);
        E.ask({
          kind: 'confirm', title: C.words(co).recruit + ' ' + rp.name + (drone ? ' (drone)' : riders ? ' (Riders)' : '') + '?',
          text: cost ? 'It costs ' + cost + ' ' + word + '. You have ' + co.kUC + ' ' + word + ', leaving ' + (co.kUC - cost) + ' ' + word + '.' + E.recruitWarn(co, rp) : 'It costs nothing.' + E.recruitWarn(co, rp),
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
      if (attr('data-mark')) {
        var mk = C.byRid(co, attr('data-mark'));
        if (mk) cmd('mark', { rid: mk.rid, mark: E.nextMark(mk) });
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
      if (attr('data-promote')) {
        var pr = attr('data-promote'), pto = attr('data-to'), pe = C.byRid(co, pr);
        if (pe) E.askPromote(co, pe, pto, function () { cmd('promote', { rid: pr, to: pto }, function () { E.closeModal(); }); });
        return true;
      }
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
      if (go === 'oseat' && E.online && E.online.local) { handOver(); return true; }
      if (go === 'obattle') { var bc = battleCode(); if (bc) goBattle(bc); return true; }
      if (attr('data-take-offer') !== null && attr('data-take-offer') !== undefined && t.hasAttribute('data-take-offer')) {
        cmd('aiTake', { i: +attr('data-take-offer') }, function () { E.view = 'ocontract'; });
        return true;
      }
      if (attr('data-ochallenge')) { cmd('duelAsk', { to: +attr('data-ochallenge') }, function () { E.closeModal(); E.view = 'hub'; }); return true; }
      // a contract with the AI force picked from the other forces: its terms come up
      if (attr('data-oaicontract')) { cmd('aiContract', { r: +attr('data-oaicontract') }, function () { E.closeModal(); E.view = 'ocontract'; }); return true; }
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
        if (go === 'occlear') { pk.rids = []; pk.field = []; pk.drugs = []; E.render(); return true; }
        if (go === 'ocauto') {
          var got = C.pickForce(myCo(), k.tier, k.pl, pk.tactic || null, { scenario: k.scenario && k.scenario.id }) || [];
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
      if (target.id === 'olob-name') {
        var nm = target.value.trim();
        if (nm && lobby && nm !== lobby.name) cmd('lobbyName', { name: nm }); else if (lobby) target.value = lobby.name || '';
        return true;
      }
      if (target.id === 'olob-pub') { cmd('lobbyListed', { on: !!target.checked }); return true; }
      if (target.hasAttribute('data-olob-ai')) { cmd('lobbySlot', { i: +target.getAttribute('data-olob-ai'), kind: target.checked ? 'ai' : 'open' }); return true; }
      if (target.hasAttribute('data-olob-army')) { cmd('lobbyFaction', { i: +target.getAttribute('data-olob-army'), faction: target.value }); return true; }
      if (target.hasAttribute('data-olob-colour')) { cmd('lobbyColour', { i: +target.getAttribute('data-olob-colour'), colour: target.value }); return true; }
      return false;
    }

    return {
      enterList: toMulti, lobbyView: lobbyView, offersView: offersView, contractView: contractView, postView: postView, hubNote: hubNote,
      click: click, change: change, steer: function () { if (E.online && E.camp) steer(false); },
      afterBattle: afterBattle, fighting: function () { return fighting; },
      leave: leaveCampaign, local: function () { return stashed ? localCamp : E.camp; },
      inLobby: function () { return !!(E.online && E.online.phase === 'lobby'); },
      // one opened straight from the main menu's Continue list
      openOne: function (id) { leaveCampaign(); return openCampaign(id); },
      localOver: localOver,
      // a new hotseat campaign with AI forces, kept on this device, opened on Player 1's founding
      newLocal: function (how) {
        var made = root.PMCLocalWorld.make(how);
        if (!made.ok) { E.note('Not started', cap(made.why || 'it could not be made') + '.'); return; }
        leaveCampaign();
        return openCampaign(made.id);
      },
      // one started from the lobby's Start a game
      startNew: function (how) { leaveCampaign(); return startNew(how); }
    };
  };
})(window);
