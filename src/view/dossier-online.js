/* PMC 2670 — Firefight : online campaigns in the dossier (multiplayer plan, phase 3c)

   Two players, each on their own device, each running their own force; the
   server keeps the campaign and runs its rules (server/online.js). This is the
   dossier's side of it: the list of the player's online campaigns, making one
   and joining one by its code, and — once one is open — every change to the
   player's own force sent to the server as a command rather than made here,
   the contract drawn up between them, the walk into the battle, and the
   questions and the aftermath after it.

   The dossier's own screens do the showing (the hub, the founding sheet, the
   roster, the honours, the aftermath): an online campaign is the hotseat shape
   with one side the player's. What is only online is here.

   Made once by dossier.js, the first time it is wanted. E is what it needs of
   dossier.js; what changes is read through it as it is now. */
(function (root) {
  'use strict';
  root.PMCDossierOnline = function (E) {
    var C = E.C, R = E.R, ROMAN = E.ROMAN, esc = E.esc;
    var list = null, listFault = '', signedIn;     // the list screen: the player's campaigns, and who they are
    var busy = false;                               // a command on its way: the next waits
    var poll = null;                                // the campaign asked for again now and then, for the other player's changes
    var pick = null;                                // the player's force for the contract, as picked so far here
    var pickFor = null;                             // ...and the contract it was picked for (its turn and tier)
    var fighting = null;                            // the battle walked into: its code
    var localCamp, stashed = false;                 // the browser's own campaign, put aside while an online one is open

    function api(path, opts) {
      opts = opts || {};
      opts.credentials = 'same-origin';
      opts.cache = 'no-store';
      if (opts.body) opts.headers = { 'content-type': 'application/json' };
      return root.fetch(path, opts).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }, function () { return { ok: r.ok, code: r.status, j: {} }; });
      });
    }
    function mine() { return E.online ? E.online.side : 'A'; }
    function theirs() { return mine() === 'A' ? 'B' : 'A'; }
    function myCo() { return E.camp.companies[mine()]; }
    function theirCo() { return E.camp.companies[theirs()]; }
    function founded(co) { return !!(co && co.roster && co.roster.length); }
    function theirName() {
      var p = E.online && (E.online.players || []).filter(function (x) { return x.side === theirs(); })[0];
      return founded(theirCo()) ? theirCo().name : p ? p.name : 'the other player';
    }
    function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

    /* ================= in and out ================= */
    // the list of the player's online campaigns
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
        E.online = { id: r.j.id, side: r.j.side, version: 0, players: r.j.players, invite: r.j.invite };
        E.hubSide = r.j.side;
        take(r.j, true);
        startPoll();
        E.open(E.view);
      });
    }
    // a new one started on the server, and opened on founding Player 1's force
    function startNew() {
      return api('api/online', { method: 'POST' }).then(function (r) {
        if (!r.ok) { E.note('Not started', cap(r.j.error || r.j.why || 'the server said no') + '.'); return; }
        openCampaign(r.j.id);
      });
    }
    function leaveCampaign() {
      stopPoll();
      if (stashed) { E.camp = localCamp; stashed = false; localCamp = null; }
      E.online = null; pick = null; pickFor = null;
      E.draft = null;
    }

    /* The campaign as the server has it now, taken up: the screen it should be on
       follows (the player's force still to be founded, a question after a battle
       owed, an aftermath not yet read). `fresh`: just opened. */
    function take(j, fresh) {
      var o = E.online;
      if (!o || !j || !j.state) return;
      var wasFound = E.view === 'found' && E.draft && E.draft.side === o.side;
      var keep = wasFound ? E.camp.companies[o.side] : null;
      o.version = j.version || o.version;
      if (j.players) o.players = j.players;
      if (j.invite !== undefined) o.invite = j.invite;
      var camp = C.rehydrate(j.state);
      if (!camp.companies.B) camp.companies.B = (camp.rivals || [])[camp.facing || 0] || C.newCompany('', {});
      // the player's force being founded here is kept as it is being made
      if (keep && !founded(camp.companies[o.side])) camp.companies[o.side] = keep;
      E.camp = camp;
      steer(fresh);
    }
    function steer(fresh) {
      var camp = E.camp, side = mine();
      if (!founded(camp.companies[side])) {
        if (E.view !== 'found' || !E.draft || E.draft.side !== side) E.beginOwn(side, camp.companies[side].faction || 'pmc');
        return;
      }
      if (E.view === 'found') { E.draft = null; E.view = 'hub'; }
      if (camp.post) { E.view = 'post'; return; }
      if (E.view === 'post') E.view = 'hub';
      // a battle's aftermath not yet read: shown once, from the campaign's log
      var af = camp.online && camp.online.after;
      if (af && af.turn > seen()) {
        var at = -1;
        (camp.log || []).forEach(function (l, i) { if (l.turn === af.turn && l.after) at = i; });
        if (at >= 0) { seen(af.turn); E.showPast(at); E.view = 'aftermath'; return; }
      }
      if (fresh && E.view !== 'ocontract' && E.view !== 'aftermath') E.view = 'hub';
    }
    // the last aftermath this browser has shown, per campaign
    function seen(turn) {
      var k = 'pmc-online-seen:' + (E.online ? E.online.id : '');
      try {
        if (turn === undefined) return +(localStorage.getItem(k) || -1);
        localStorage.setItem(k, String(turn));
      } catch (e) { }
      return -1;
    }

    /* The other player's changes, picked up every few seconds while the campaign is
       open — the pace is theirs (decision 6), so nothing is waited on. */
    function startPoll() {
      stopPoll();
      poll = setInterval(function () {
        var o = E.online;
        if (!o || busy || E.asking()) return;
        if (document.hidden) return;
        api('api/online/' + o.id).then(function (r) {
          if (!r.ok || !E.online || E.online.id !== o.id || r.j.version === o.version || busy) return;
          var before = E.camp.online && E.camp.online.battle;
          take(r.j);
          var shown = E.isOpen();
          // both ready: a player waiting on the contract goes into the battle as soon as it is made
          var b = E.camp.online && E.camp.online.battle;
          if (b && !before && shown && E.view === 'ocontract') { goBattle(b.code); return; }
          if (shown) E.render();
        });
      }, 4000);
    }
    function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

    /* ================= commands ================= */
    /* One change, sent to the server and run there with the campaign's rules; the
       campaign comes back as it is now, or the reason it was refused. */
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
    /* Into the battle made from the contract: the lobby's connection, and the seat
       held for this player (lobby.js). When it is over the campaign comes back. */
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
      var back = function () { refresh(function () { E.open(E.view); }); };
      if (read && root.PMC_AFTER_RESULT) root.PMC_AFTER_RESULT(back);
      else setTimeout(back, read ? 900 : 2500);
      return true;
    }

    /* ================= the list ================= */
    function listView() {
      var h = '<h2>Online campaigns</h2>';
      h += '<p class="lede">A campaign against another player, each of you on your own device, whenever you each have the time. ' +
        'Each runs their own force; the server keeps the campaign and rolls every die.</p>';
      if (list === null) return h + '<p class="dnote">Looking…</p>' + foot();
      if (!signedIn) {
        return h + '<div class="cpan"><div class="cpstat">An online campaign is kept by your account. Sign in (or make an account) first.</div>' +
          '<button class="start" data-go="osignin">Sign in</button></div>' + foot();
      }
      if (listFault) h += '<p class="dnote hubnote">' + esc(listFault) + '</p>';
      if (list.length) {
        h += '<div class="field"><label>Yours</label><div class="clog">' + list.map(function (c) {
          return '<button type="button" class="crow crow-go" data-ocamp="' + c.id + '"><b>' + c.turn + '</b><span>' + esc(c.name) +
            '<small>You are Player ' + (c.side === 'B' ? 2 : 1) + '</small></span><em>Open</em></button>';
        }).join('') + '</div></div>';
      }
      h += '<div class="field"><label>A new one</label><button class="start" data-go="onew">Start an online campaign</button>' +
        '<p class="dnote">You get a code to give the other player.</p></div>';
      h += '<div class="field"><label for="ojoin-code">Join one</label><div class="ojoin">' +
        '<input class="tin" id="ojoin-code" maxlength="8" placeholder="The code you were given" autocomplete="off">' +
        '<button class="lnk" data-go="ojoin">Join</button></div></div>';
      return h + foot();
    }
    function foot() { return '<p class="camp-foot"><button class="lnk" data-go="menu">← Main menu</button></p>'; }

    /* ================= the hub, online ================= */
    // what the hub says of the campaign between the two players: who is waiting on whom
    function hubNote() {
      var camp = E.camp, h = '', o = E.online;
      if (o.invite) {
        h += '<div class="cpan onote"><div class="cpstat"><b>The second seat is open.</b> Give the other player this code; they join from Multiplayer → Online campaigns:</div>' +
          '<div class="ocode">' + esc(o.invite) + '</div></div>';
      } else if (!founded(theirCo())) {
        h += '<div class="cpan onote"><div class="cpstat">Waiting for ' + esc(theirName()) + ' to found their force.</div></div>';
      }
      var b = camp.online && camp.online.battle, k = camp.online && camp.online.contract;
      if (b) {
        h += '<div class="cpan onote"><div class="cpstat"><b>The battle is ready.</b></div><button class="start" data-go="obattle">Go to the battle</button></div>';
      } else if (k) {
        h += '<div class="cpan onote"><div class="cpstat">A contract is being drawn up — ' + readyLine(k) + '</div>' +
          '<button class="lnk" data-go="contract">Open the contract</button></div>';
      }
      return h;
    }
    function readyLine(k) {
      var me = mine(), them = theirs();
      var mineSay = k.ready[me] ? 'you are ready' : k.picks[me] ? 'you have picked' : 'you have not picked your force yet';
      var theirSay = k.ready[them] ? 'ready' : k.picks[them] ? 'picking' : 'not picked yet';
      return mineSay + '; ' + esc(theirName()) + ' is ' + theirSay + '.';
    }

    /* ================= the contract, online ================= */
    function pickNow(k) {
      var key = k.turn + ':' + k.tier + ':' + k.pl + ':' + (k.scenario && k.scenario.id);
      var srv = k.picks[mine()];
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
      var camp = E.camp, k = camp.online && camp.online.contract, me = mine(), co = myCo(), them = theirCo();
      var h = '<h2>Contract</h2>';
      if (!founded(them)) {
        return h + '<p class="lede">A contract needs both forces. Waiting for ' + esc(theirName()) + ' to found theirs.</p>' + backFoot();
      }
      if (!k) {
        return h + '<p class="lede">' + esc(co.name) + ' against ' + esc(them.name) + '. Either of you may call for a contract: the Battle Tier, ' +
          'the scenario and who attacks are rolled by the server, then each of you picks your force, unseen by the other.</p>' +
          '<button class="start" data-go="ocbegin">Draw up a contract</button>' + backFoot();
      }
      var b = camp.online.battle;
      h += '<p class="lede">' + esc(co.name) + ' (Player ' + (me === 'A' ? 1 : 2) + ') against ' + esc(them.name) + '.</p>';
      if (b) return h + '<div class="cpan"><div class="cpstat"><b>Both are ready: the battle is made.</b></div><button class="start" data-go="obattle">Go to the battle</button></div>' + backFoot();
      // Foresighted Command with both holding it: each sets a die aside in turn, before anything else
      var fore = k.fore;
      if (fore && !fore.done) {
        var who = fore.order[fore.ignored.length];
        h += '<div class="cpan"><div class="cpstat"><b>Foresighted Command</b> — both forces hold it: three scenario dice, and each sets one aside in turn.</div>';
        if (who === me) {
          h += '<div class="cpstat">Your turn: set one aside.</div>' + fore.dice.map(function (d, i) {
            return fore.ignored.indexOf(i) >= 0 ? '<span class="mk">' + d.roll + ' ' + esc(d.name) + ' — set aside</span> '
              : '<button class="lnk" data-ocforego="' + i + '">Set aside ' + d.roll + ' — ' + esc(d.name) + '</button> ';
          }).join('');
        } else h += '<div class="cpstat">Waiting for ' + esc(theirName()) + ' to set one aside.</div>';
        return h + '</div>' + backFoot();
      }
      // the terms: the scenario, who attacks, the Tier and the level
      var SCv = root.PMCScen && root.PMCScen.SCENARIOS[k.scenario.id];
      h += '<div class="cpan"><div class="cpstat"><b>' + esc(k.scenario.name) + '</b> — Battle Tier ' + ROMAN[k.tier] + ', Priority Level ' + k.pl +
        (k.planet && k.planet !== 'random' ? ', on a ' + esc(k.planet) + ' world' : '') + '.</div>';
      if (k.roles) {
        var ro = k.roles;
        h += '<div class="cpstat"><b>' + esc(camp.companies[ro.attacker].name) + '</b> attacks; <b>' + esc(camp.companies[ro.defender].name) + '</b> defends' +
          (ro.bestDefence && ro.bestDefence.swapped ? ' (The Best Defence is Good Offence turned it round: D6 ' + ro.bestDefence.roll + ')' : '') + '.' +
          (SCv && SCv.roles ? ' <span class="dnote">' + esc(SCv.roles[ro.attacker === me ? 'attacker' : 'defender'] || '') + '</span>' : '') + '</div>';
      }
      h += '<div class="cpstat">' + cap(readyLine(k)) + '</div></div>';
      var bd = k.roles && k.roles.bestDefence;
      if (bd && bd.pending && bd.side === me) h += '<div class="cpdoc"><button class="lnk" data-go="ocbestdef">The Best Defence is Good Offence — roll to attack (2+)</button></div>';
      if (k.alt && (k.altBy || 'A') === me && !k.altUsed && k.alt.id !== k.scenario.id) {
        h += '<div class="cpdoc">Foresighted Command — the second die showed <b>' + esc(k.alt.name) + '</b>. ' +
          '<button class="lnk" data-go="ocforesee">Fight ' + esc(k.alt.name) + ' instead</button></div>';
      }
      if (C.hasDoctrine(co, 'S4') && k.terms[me] === undefined) {
        var both = C.hasDoctrine(them, 'S4');
        h += '<div class="cpdoc"><b>On Our Terms…</b> ' + (both ? 'Both forces hold it: the Tier moves only if you both choose the same way. ' : 'Shift the Battle Tier by one. ') +
          '<button class="lnk" data-octerms="-1"' + (k.tier <= 1 ? ' disabled' : '') + '>Down to ' + ROMAN[Math.max(1, k.tier - 1)] + '</button> ' +
          '<button class="lnk" data-octerms="0">Keep ' + ROMAN[k.tier] + '</button> ' +
          '<button class="lnk" data-octerms="1"' + (k.tier >= k.tierRoll.cap ? ' disabled' : '') + '>Up to ' + ROMAN[Math.min(5, k.tier + 1)] + '</button></div>';
      }
      var lv = k.levels || [1];
      h += '<div class="field"><div><label for="oc-pl">Priority Level</label>' +
        '<select id="oc-pl"' + (me === 'A' && lv.length > 1 && !k.ready[me] ? '' : ' disabled') + '>' + [1, 2].map(function (n) {
          var can = lv.indexOf(n) >= 0;
          return '<option value="' + n + '"' + (k.pl === n ? ' selected' : '') + (can ? '' : ' disabled') + '>' + n + (n === 1 ? ' — skirmish' : ' — full battle') + '</option>';
        }).join('') + '</select>' + (me === 'A' ? '' : '<p class="dnote">Player 1 sets the Priority Level.</p>') + '</div></div>';

      var pk = pickNow(k), units = entriesOf(co, pk), keys = units.map(function (e) { return R.entryPick(e); });
      var chk = R.checkArmy(keys, k.tier, k.pl, co.doctrines, pk.tactic || null, co.faction);
      if (k.ready[me]) {
        h += '<div class="cpan"><div class="cpstat"><b>You are ready</b> with ' + units.length + ' units: ' + units.map(function (e) { return esc(e.name); }).join(', ') + '.</div>' +
          '<div class="cpstat">Waiting for ' + esc(theirName()) + '. The battle starts as soon as they are ready.</div>' +
          '<button class="lnk" data-go="ocunready">Change my force</button></div>';
        return h + backFoot();
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
      h += '<button class="start" data-go="ocready"' + (chk.ok ? '' : ' aria-disabled="true" data-tip="' + why + '" data-tip-title="Not yet"') + '>Ready — fight with this force</button>';
      return h + backFoot();
    }
    function backFoot() { return '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>'; }

    /* ================= after the battle ================= */
    // a question for the other player: wait for them; one for this player: the dossier's own screen
    function postView() {
      var post = E.camp.post, st = post && post.steps[0];
      if (st && st.side !== mine()) {
        return '<h2>After the battle</h2><p class="lede">' + esc(theirName()) + ' has a question to answer first (' +
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
      var camp = E.camp, side = mine();
      var attr = function (a) { return t.getAttribute(a); };
      // the list
      if (attr('data-ocamp')) { openCampaign(+attr('data-ocamp')); return true; }
      if (go === 'onew') { startNew(); return true; }
      if (go === 'ojoin') {
        var code = ((document.getElementById('ojoin-code') || {}).value || '').trim();
        if (!code) { E.note('Which campaign?', 'Type the code the other player gave you.'); return true; }
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

      // founding the player's own force
      if (attr('data-bfaction') && E.view === 'found') {
        E.keepFoundName();
        var d = E.draft, nm = d.name, col = d.colour, chosen = d.colourChosen;
        E.beginOwn(side, attr('data-bfaction'));
        E.draft.name = nm;
        if (chosen) { E.draft.colour = col; E.draft.colourChosen = true; }
        E.render(); return true;
      }
      if (go === 'dofound') {
        if (attr('aria-disabled') === 'true') { if (root.PMCTips) root.PMCTips.show(t); return true; }
        E.keepFoundName();
        var dr = E.draft, name = (dr.name || '').trim();
        if (!name) { E.note('It needs a name', 'Give the force something to be known by.'); return true; }
        cmd('found', { faction: camp.companies[side].faction || 'pmc', name: name, keys: dr.keys, doctrine: dr.doctrine, colour: dr.colour },
          function () { E.draft = null; E.view = 'hub'; });
        return true;
      }
      if (go === 'foundback') { enterList(); return true; }

      // the force's own changes
      var co = camp.companies[side];
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
      if (attr('data-promote')) {
        cmd('promote', { rid: attr('data-promote'), to: attr('data-to') }, function () { E.closeModal(); });
        return true;
      }
      if (attr('data-fit')) {
        var up = E.upState;
        cmd('upgrade', { rid: up && up.rid, n: +attr('data-fit') }, function () { E.toDossier(); });
        return true;
      }
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
        var want = attr('data-campcolour'), oth = theirCo();
        if (oth && oth.colour === want) { E.note('That colour is taken', oth.name + ' already wears it. Pick another, so the two sides can be told apart.'); return true; }
        cmd('colour', { colour: want }, function () { E.closeColours(); });
        return true;
      }
      // the hub's way to the contract, and into the battle
      if (go === 'contract' || go === 'offers') { E.view = 'ocontract'; E.render(); return true; }
      if (go === 'obattle') { var bb = camp.online && camp.online.battle; if (bb) goBattle(bb.code); return true; }
      // nothing of the campaign's file is this browser's to change
      if (/^(wipe|import|storeuse|storekeep|standard|hubside)$/.test(go || '')) return true;
      // a force that can no longer fight ends the campaign; or a player gives it up
      if (go === 'campend') { cmd('campEnd', { side: attr('data-side') }); return true; }
      if (go === 'oconcede') {
        E.closeModal();
        E.ask({ kind: 'confirm', title: 'Give the campaign up?', danger: true,
          text: 'It ends here, for both of you: ' + theirName() + ' has the world. There is no undoing it.',
          okLabel: 'Give it up', onOk: function () { cmd('concede', {}); } });
        return true;
      }
      // Enhanced Genetic Memory: a lost unit recruited again, its D6 rolled on the server
      if (go === 'reborn') {
        cmd('postReborn', { i: +attr('data-i') }, function (j) {
          if (j && j.roll) E.note('Enhanced Genetic Memory', 'D6 ' + j.roll + ' \u2014 ' + (j.remembered ? 'it remembers everything it had.' : 'the memory did not carry.'));
        });
        return true;
      }

      // the contract
      var k = camp.online && camp.online.contract;
      if (go === 'ocbegin') { cmd('contractBegin', {}); return true; }
      if (k) {
        var pk = pickNow(k);
        if (attr('data-ocforego') !== null) { cmd('contractForego', { i: +attr('data-ocforego') }); return true; }
        if (go === 'ocforesee') { cmd('contractForesee', {}); return true; }
        if (go === 'ocbestdef') {
          cmd('contractBestDefence', {}, function (j) {
            if (j.swapped) E.note('The Best Defence is Good Offence', 'D6 ' + j.roll + ' — you are the attacker now. Check the list still suits the job.');
          });
          return true;
        }
        if (attr('data-octerms') !== null) { cmd('contractTerms', { dir: +attr('data-octerms') }); return true; }
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
          var send = { rids: pk.rids.slice(), field: pk.field.slice(), tactic: pk.tactic, drugs: pk.drugs.slice() };
          cmd('contractPick', send, function () { setTimeout(function () { cmd('contractReady', { ready: true }); }, 0); });
          return true;
        }
        if (go === 'ocunready') { cmd('contractReady', { ready: false }); return true; }
      }

      // the questions after a battle
      var post = camp.post, st = post && post.steps[0];
      if (st && st.side === side) {
        if (go === 'plunder') { cmd('postPlunder', {}); return true; }
        if (go === 'negotiate') { cmd('postNegotiate', { sel: (st.sel || []).slice() }); return true; }
        if (attr('data-weak') !== null) { cmd('postWeak', { choice: attr('data-weak') || '' }); return true; }
        if (go === 'postnext') { cmd('postNext', {}); return true; }
      }
      return false;
    }
    // a choice from a list (the contract's Priority Level)
    function change(target) {
      if (!E.online || target.id !== 'oc-pl') return false;
      cmd('contractLevel', { pl: +target.value });
      return true;
    }

    return {
      enterList: enterList, listView: listView, contractView: contractView, postView: postView, hubNote: hubNote,
      click: click, change: change, steer: function () { if (E.online && E.camp) steer(false); },
      afterBattle: afterBattle, fighting: function () { return fighting; },
      leave: leaveCampaign, local: function () { return stashed ? localCamp : E.camp; },
      // one opened straight from the main menu's Continue list
      openOne: function (id) { leaveCampaign(); return openCampaign(id); },
      // one started from the lobby's Start a game
      startNew: function () { leaveCampaign(); return startNew(); }
    };
  };
})(window);
