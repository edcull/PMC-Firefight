/* PMC 2670 — Firefight : the company hub: the bar, the company, promotion, badges and the other forces

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierHub = function (E) {
    var C = E.C, ICON_ABANDON = E.ICON_ABANDON, ICON_BATTLES = E.ICON_BATTLES,
        ICON_LOAD = E.ICON_LOAD, ICON_MANAGE = E.ICON_MANAGE, memorialIcon = E.memorialIcon,
        ICON_SAVE = E.ICON_SAVE, ROMAN = E.ROMAN, Store = E.Store, cmodal = E.cmodal, coin = E.coin,
        colourOf = E.colourOf, dossierPanel = E.dossierPanel, recruitList = E.recruitList,
        entryCard = E.entryCard, esc = E.esc, memorialList = E.memorialList, profile = E.profile,
        root = E.root, spendActs = E.spendActs, U = root.PMCUi;
    /* ================= the hub ================= */
    function hubView() {
      // a multiplayer campaign goes by its name (each player's turn is their own)
      var h = '<h2>' + (E.camp && E.online ? esc(E.camp.name || 'Campaign') : E.camp && E.camp.title ? esc(E.camp.title) : E.camp ? 'Campaign — turn ' + E.camp.turn : E.wantMode === 'hotseat' ? 'Hotseat campaign' : 'Campaign') + '</h2>';
      if (!E.camp) {
        var pa = { faction: E.wantFaction, doctrines: [] }, pb = { faction: E.wantB, doctrines: [] };
        /* Laid out as the online campaign's lobby is: a slot for each force on the
           world — yours (and Player 2's, in hotseat), then the AI forces, each with
           its colours and its army — and under them one line: how many forces, and
           the button that raises yours. The way of playing is the menu card it was
           opened from (Single player or Hotseat). */
        var CO = (E.root.PMCIso && E.root.PMCIso.COLOURS) || {};
        // an AI force's colours left to chance: a question mark
        var chipOf = function (k) { return CO[k] ? U.chip(k) : '<span class="olob-chip rivrand">?</span>'; };
        var hot = E.wantMode === 'hotseat', nr = hot ? E.wantHotAi : E.wantRivals, ra = E.wantRivalArmies, rc = E.wantRivalColours, ci = E.rivColourFor, wc = E.wantColours;
        // each slot's colours: its chip, opening the colours by it (a player's are theirs; an AI force's given up to whoever takes them)
        var colourOf = function (slot) { return slot === 'A' || slot === 'B' ? wc[slot] : rc[slot]; };
        var chipBtn = function (slot, who) {
          var k = colourOf(slot);
          return U.chipButton('data-go="rivcolour" data-i="' + slot + '" aria-label="' + esc(who) + ' colours"', chipOf(k), ci === slot, k && CO[k] ? CO[k].name : 'Colours');
        };
        var playerRow = function (slot, who, id, want) {
          return '<div class="olob-slot mine">' + chipBtn(slot, who) +
            '<span class="olob-who"><b>' + esc(who) + '</b></span>' +
            U.armySelect('id="' + id + '" aria-label="' + esc(who) + ' — army"', want) + '</div>';
        };
        // its name, as the online lobby has it
        h += '<div class="olob-name"><label for="camp-name">Name</label><input class="tin" id="camp-name" maxlength="40" autocomplete="off" placeholder="' +
          (hot ? 'Hotseat campaign' : 'Campaign') + '" value="' + esc(E.wantName || '') + '"></div>';
        h += '<div class="olob-slots">' + playerRow('A', hot ? 'Player 1' : 'You', 'camp-faction', E.wantFaction);
        if (hot) h += playerRow('B', 'Player 2', 'camp-bfaction', E.wantB);
        for (var ri = 0; ri < nr; ri++) {
          h += '<div class="olob-slot">' + chipBtn(ri, 'AI force ' + (ri + 1)) +
            '<span class="olob-who"><b>AI force</b></span>' +
            U.armySelect('class="rivarmy" data-i="' + ri + '" aria-label="AI force ' + (ri + 1) + ' — army"', ra[ri] || '', '') + '</div>';
        }
        h += '</div>';
        // the colours of the slot whose chip was tapped: one a player wears is not offered; an AI force's may be taken (it gets another)
        if (ci !== null && (ci === 'A' || (ci === 'B' && hot) || ci < nr)) {
          var holder = function (k) {
            if (ci !== 'A' && wc.A === k) return 'player';
            if (hot && ci !== 'B' && wc.B === k) return 'player';
            return rc.some(function (x, j) { return x === k && j !== ci && j < nr; }) ? 'ai' : null;
          };
          h += U.colourPop('data-rivpop="' + ci + '"', colourOf(ci), function (k) {
            var by = holder(k);
            return { attrs: 'data-rivpick="' + k + '"', off: by === 'player', ai: by === 'ai',
              note: by === 'player' ? ' — a player wears it' : by === 'ai' ? ' — an AI force wears it, and will take another' : '' };
          });
        }
        // one line: how many AI forces (an odd number: with yours, the forces pair off for each round), a save file to load instead, and Raise the force
        // (hotseat: none, or an even number — with the two players, the forces pair off)
        h += '<div class="olob-bar"><label class="olob-n">AI forces <select id="' + (hot ? 'camp-hotai' : 'camp-rivals') + '">' + (hot ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9]).map(function (n) {
          return '<option value="' + n + '"' + (n === nr ? ' selected' : '') + '>' + n + '</option>';
        }).join('') + '</select></label>' +
          '<button class="lnk olob-load" data-go="import">Load a save file</button>' +
          '<button class="start" data-go="newcamp">Raise the force</button></div>';
        h += cmodal('armynew', C.words(pa).side + ' \u2014 army rules', armyRules(pa));
        h += cmodal('armynewb', C.words(pb).side + ' \u2014 army rules', armyRules(pb));
        // the title bar's Back: the game modes it was opened from
        h += '<p class="camp-foot"><button class="lnk" data-go="campmenu">← Back</button>' +
          '<input type="file" id="camp-file" accept="application/json" hidden></p>';
        return h;
      }
      var A = E.camp.companies.A, B = E.camp.companies.B;
      var rivals = E.camp.mode === 'hotseat' ? [] : (E.camp.rivals || [B]);
      if (Store.note()) h += '<p class="dnote hubnote">' + esc(Store.note()) +
        // saved on another device since: which copy to go on with (decision 7)
        (Store.conflict && Store.conflict() ? ' <button type="button" class="lnk" data-go="storeuse">Use that copy</button> <button type="button" class="lnk" data-go="storekeep">Keep this one</button>' : '') +
        '</p>';
      // in hotseat, the player whose force the hub shows and works on (HC-1)
      var hs = E.hubSide, cur = E.camp.companies[hs] || A;
      // online: who is waiting on whom, the code for the open seat, the battle when it is made
      var onote = E.online ? E.onlineNote() : '';
      h += onote;
      /* A force that can no longer field an army, and cannot recruit back to one, ends
         the campaign (HC-14): said here, and the contract is closed. */
      var done = E.camp.over;
      var finished = done ? null : ['A', E.camp.mode === 'hotseat' ? 'B' : null].filter(function (sd) {
        return sd && C.cannotFight(E.camp.companies[sd]);
      })[0];
      if (done) {
        h += '<div class="cpan"><div class="cpstat"><b>The campaign is over.</b> ' + esc(done.text) + '</div></div>';
      } else if (finished) {
        var fco = E.camp.companies[finished];
        h += '<div class="cpan"><div class="cpstat"><b>' + esc(fco.name) + ' can no longer field an army</b>, and cannot recruit back to one. ' +
          'The campaign ends here.</div><button class="start" data-go="campend" data-side="' + finished + '">End the campaign</button></div>';
      }
      /* Taking a contract is what the screen is for (alone, or on a world): at the top,
         where a contract or a battle under way says so instead */
      if (!done && !finished && (E.online || E.camp.mode === 'solo') && !/data-go="(obattle|ocontract)"/.test(onote)) {
        h += '<div class="cpan onote hubtake"><button class="start" data-go="fmodal" data-kind="rivals">Take a contract</button></div>';
      }
      /* The campaign's own business, on the company view under the promotion: the
         battles fought, the fallen, and the campaign's file (out to a file, back in
         from one, or given up). */
      var last = E.camp.log.length ? E.camp.log[E.camp.log.length - 1] : null;
      // won or lost from where the hub's player stands (hotseat: either of them, HC-13)
      var result = function (l) { return !l.winner ? 'drawn' : l.winner === (hs || 'A') ? 'won' : 'lost'; };
      var vsOf = function (l) { return E.camp.mode === 'hotseat' ? (hs === 'B' ? A : B).name : l.against; };
      var manageHtml = '<div class="manage-list hubmanage">' +
        (last ? '<button type="button" class="archline" data-go="fmodal" data-kind="battles">' + ICON_BATTLES + '<span>Battles fought<small>' +
          (E.camp.log.length > 1 ? E.camp.log.length + ' battles \u2014 the last: ' : '') +
          esc(C.SCENARIO_NAMES[last.scenario] || last.scenario) + ', Tier ' + ROMAN[last.tier] + ' PL' + last.pl + ', ' + result(last) +
          '</small></span></button>' : '') +
        '<button type="button" class="archline" data-go="fmodal" data-kind="memorial">' + memorialIcon(cur) + '<span>' + esc(C.words(cur).memorial) + '<small>' +
        esc(C.words(cur).memorialSub) + '</small></span></button>' +
        /* the campaign's file, and giving it up: one row of icon buttons, each saying what it
           does (online the server keeps the campaign: only giving it up, said in words) */
        '<div class="hubfile">' +
        (E.online ? (E.camp.over ? '' : '<button type="button" class="lnk ico danger wide" data-go="oconcede" title="You leave the world; the others play on (it asks first)">' + ICON_ABANDON + '<span>Give the campaign up</span></button>')
          : '<button type="button" class="lnk ico" data-go="export" title="Save to a file — the whole campaign, to keep or move to another device" aria-label="Save to a file">' + ICON_SAVE + '</button>' +
        '<button type="button" class="lnk ico" data-go="import" title="Load a file — carry on a campaign saved before" aria-label="Load a file">' + ICON_LOAD + '</button>' +
        '<button type="button" class="lnk ico danger" data-go="wipe" title="Abandon the campaign — every dossier goes (it asks first)" aria-label="Abandon the campaign">' + ICON_ABANDON + '</button>') +
        '</div>' +
        '</div>';
      h += companyPanel(cur, hs, hubBar(), manageHtml);
      // recruiting: a window over the dossier, drawn only while open
      if (E.openModal === 'recruit') h += cmodal('recruit', C.words(cur).recruit + ' \u2014 ' + cur.kUC + ' ' + C.money(cur), '<div class="cmodal-scroll">' + recruitList(cur) + '</div>');
      // what a unit can spend its experience on: an honour, an upgrade, or a promotion to another unit
      var promoE = E.promoRid && C.byRid(cur, E.promoRid);
      if (promoE) {
        h += cmodal('promote', 'Promote ' + promoE.name + ' \u2014 ' + promoE.exp + ' EXP',
          '<div class="cmodal-scroll promo-list">' + spendActs(promoE, cur) + '</div>');
      }
      // the fallen, opened from the company view
      h += cmodal('memorial', C.words(cur).memorial, '<div class="cmodal-scroll">' + memorialList(cur) + '</div>');
      h += cmodal('rivals', E.camp.mode === 'hotseat' ? (hs === 'B' ? 'Player 1' : 'Player 2') : 'Take a contract',
        // the other player's force shown as a rival's is: its figures, its kind and creed, and their dossier to open
        '<div class="cmodal-scroll">' + (E.camp.mode === 'hotseat' ? rivalPanel(hs === 'B' ? A : B, 0)
          // the other players first, then the AI forces (each keeps its own place for its dossier and its contract)
          : rivals.map(function (co, i) { return { co: co, i: i }; }).sort(function (a, b) { return (b.co.human ? 1 : 0) - (a.co.human ? 1 : 0) || a.i - b.i; })
            .map(function (x) { return rivalPanel(x.co, x.i); }).join('')) + '</div>');
      // every battle fought, the latest first (opened from the win rate even before the first)
      {
        // a battle whose aftermath was kept opens it again, read only
        var battleRow = function (l, i) {
          var inner = '<b>' + l.turn + '</b>' +
            '<span>' + esc(C.SCENARIO_NAMES[l.scenario] || l.scenario) + ', Tier ' + ROMAN[l.tier] + ' PL' + l.pl +
            (vsOf(l) ? '<small>vs ' + esc(vsOf(l)) + '</small>' : '') + '</span>' +
            '<em>' + result(l) + '</em>';
          return l.after ? '<button type="button" class="crow crow-go" data-go="pastbattle" data-i="' + i + '">' + inner + '</button>'
            : '<div class="crow">' + inner + '</div>';
        };
        h += cmodal('battles', 'Battles fought', '<div class="cmodal-scroll">' + (E.camp.log.length ? '<div class="clog">' +
          E.camp.log.map(battleRow).reverse().join('') + '</div>' : '<p class="dnote">No battles fought yet.</p>') + '</div>');
      }
      // each rival's own battles, the latest first, opened from its win rate
      // each army's rules, opened from its pill
      h += cmodal('armyA', C.words(A).side + ' \u2014 army rules', armyRules(A));
      if (E.camp.mode === 'hotseat') h += cmodal('armyB', C.words(B).side + ' \u2014 army rules', armyRules(B));
      rivals.forEach(function (co, i) { h += cmodal('armyr' + i, co.name + ' \u2014 ' + C.words(co).side, armyRules(co)); });
      rivals.forEach(function (co, i) {
        if (!(co.log || []).length) { h += cmodal('rbattles' + i, co.name + ' \u2014 battles', '<div class="cmodal-scroll"><p class="dnote">No battles fought yet.</p></div>'); return; }
        h += cmodal('rbattles' + i, co.name + ' \u2014 battles', '<div class="cmodal-scroll"><div class="clog">' +
          co.log.slice().reverse().map(function (l) {
            return '<div class="crow"><b>' + l.turn + '</b>' +
              '<span>' + esc(C.SCENARIO_NAMES[l.scenario] || l.scenario) + ', Tier ' + ROMAN[l.tier] + ' PL' + l.pl +
              '<small>vs ' + esc(l.vs) + '</small></span><em>' + l.result + '</em></div>';
          }).join('') + '</div></div>');
      });
      h += '<p class="camp-foot">' +
        '<button class="lnk" data-go="menu">← Main menu</button>' +
        '<input type="file" id="camp-file" accept="application/json" hidden></p>';
      return h;
    }

    /* One row under the name: the dossier, the save file out and in, and the
       contract, which is what the screen is for. */
    function hubBar() {
      var co = E.camp.companies[E.hubSide] || E.camp.companies.A;
      // hotseat: which player's force this is, and the way to the other's
      var seat = E.camp.mode !== 'hotseat' || E.online ? '' : '<span class="segs hubseat">' + ['A', 'B'].map(function (sd) {
        return '<button class="lnk' + (sd === E.hubSide ? ' on' : '') + '" data-go="hubside" data-hs="' + sd + '">Player ' + (sd === 'A' ? 1 : 2) + '</button>';
      }).join('') + '</span>';
      // online, a contract is made with a force picked from the other forces (rivalPanel): no button here
      var go = E.online ? '' : E.camp.over ? '<button class="start hubgo" disabled title="The campaign is over">Contract</button>'
        : '<button class="start hubgo" data-go="' + (E.camp.mode === 'solo' ? 'offers' : 'contract') + '">Contract</button>';
      // the battles, the memorial, saving, loading and abandoning are on the company view now
      var manage = '';
      /* Online and alone (no Contract here: it is made from the other forces) the row is two
         tabs — the company and its dossier. */
      if (E.online || E.camp.mode === 'solo') {
        var dos = E.hubPane === 'dossier';
        var tab = function (on, label) {
          return '<button class="lnk' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '"' + (on ? '' : ' data-go="roster"') + '>' + label + '</button>';
        };
        return '<div class="hubbar hubtabs" role="tablist">' + tab(!dos, esc(C.words(co).Force)) + tab(dos, 'Dossier') + manage + '</div>';
      }
      if (E.hubPane === 'dossier') {
        // in the dossier: back to the company, the campaign's window, and the contract (recruiting is at the foot of the dossier)
        return '<div class="hubbar dosbar">' + seat +
          '<button class="lnk" data-go="roster">' + esc(C.words(co).Force) + '</button>' + manage +
          go + '</div>';
      }
      return '<div class="hubbar">' + seat +
        '<button class="lnk" data-go="roster">Dossier</button>' +
        manage + go + '</div>';
    }
    function companyPanel(co, side, bar, manage) {
      // the force being managed (the one with the bar) fills the screen, whichever side it is
      var h = '<div class="cpan cpan-' + side + (bar ? ' cpan-own' : '') + '"' + stripe(co) + '>';
      // the colours are the ones the force was founded in: not changed here
      h += '<div class="cphead">' + tierBadge(co) + '<b>' + esc(co.name) + '</b>' +
        (co.aspiring ? '<span class="ctier">aspiring</span>' : '') +
        '<span class="cmoney">' + co.kUC + ' ' + C.money(co) + '</span></div>';
      h += bar || '';
      // the dossier is the units, sorted and filtered; the figures, the army and its creed are the company's
      if (bar && E.hubPane === 'dossier') {
        h += (E.rosterTab === 'units' ? sortLine(co) : '') + dossierPanel(co);
      } else {
        h += statRow(co, false, side);
        h += '<div class="cpdoc carch">' + armyPill(co, 'army' + side) + (co.doctrines.length
          ? doctrineMarks(co)
          : '<span class="dnote">No ' + C.creedOf(co).one + ' chosen.</span>') + '</div>';
        var open = C.doctrineSlots(co) - co.doctrines.length;
        if (open > 0) {
          h += '<button class="lnk" data-go="doctrine" data-side="' + side + '">Choose a ' +
            C.creedOf(co).one + ' (' + open + ' free)</button> ';
        }
        var pp0 = promotionPanel(co, side, !!bar);
        // an army it can no longer field at a Tier it holds: said at the foot of the promotion's box, opened
        var gaps0 = C.rebuildNeeds(co);
        if (gaps0.length) {
          var warn = '<div class="cpwarn">Cannot field a legal army at Tier ' + gaps0.map(function (t) { return ROMAN[t]; }).join(', ') +
            ' \u2014 recruit or promote from the lowest Tier up.</div>';
          if (pp0.indexOf('cprom-list') >= 0 || pp0.indexOf('cprom-toggle') < 0) pp0 = pp0.replace(/<\/div>$/, warn + '</div>');
        }
        // declaring an Aspiring Company is a step up as well: in the promotion's box, a button like its own
        if (!co.aspiring && C.canAspire(co)) {
          pp0 = pp0.replace(/<\/div>$/, '<button class="start" data-go="aspire" data-side="' + side + '">Declare an Aspiring Company</button></div>');
        }
        /* the promotion and the campaign's own business under it scroll together in the
           room left under the figures (on a phone the panel fits the screen) */
        h += bar ? '<div class="hubscroll">' + pp0 + (manage || '') : pp0;
        // under it, at the foot of the screen, in hotseat: the other player (alone or on a world, Take a contract is at the top)
        if (bar && E.camp.mode === 'hotseat' && !E.online) {
          var hot = E.camp.mode === 'hotseat';
          h += '<div class="cdos-foot hubfoot"><button type="button" class="lnk" data-go="fmodal" data-kind="rivals">' +
            (hot ? (E.hubSide === 'B' ? 'Player 1' : 'Player 2') : 'Other forces') + '</button></div>';
        }
        if (bar) h += '</div>';
      }
      // (on the company view it is in the promotion's box; on the dossier, at the foot)
      var gaps = bar && E.hubPane === 'dossier' ? C.rebuildNeeds(co) : [];
      if (!bar) gaps = C.rebuildNeeds(co);
      if (gaps.length) {
        h += '<div class="cpwarn">Cannot field a legal army at Tier ' +
          gaps.map(function (t) { return ROMAN[t]; }).join(', ') +
          ' — recruit or promote from the lowest Tier up.</div>';
      }
      h += '</div>';
      return h;
    }
    /* The dossier's one line: Sort and Filter, each opening its choices in a
       popup. Sorted by one thing at a time; filtered by as many types and
       Tiers as are ticked (none ticked, all of them). */
    var SORTS = [['type', 'Type'], ['name', 'Name'], ['tier', 'Tier'], ['xp', 'EXP'], ['tp', 'TP']];
    /* `fkey`: whose Honours/Trauma filter (the hub's side by default); in a window
       (the contract's add list) the popups are its own, so opening one leaves the
       window open (E.subPop) */
    function sortLine(co, fkey, inWindow) {
      fkey = fkey || E.hubSide;
      var isOpen = function (kind) { return inWindow ? E.subPop === kind : E.openModal === kind; };
      var by = SORTS.filter(function (x) { return x[0] === E.dsort; })[0] || SORTS[0];
      var types = {}, tiers = {};
      co.roster.forEach(function (e) {
        var p = profile(e.key);
        if (!p) return;
        types[p.group || ''] = true; tiers[p.tier] = true;
      });
      var on = function (kind) { return Object.keys(E.dfilt[kind]).filter(function (k) { return E.dfilt[kind][k]; }); };
      // the company's Honours and Trauma figures narrow it too: said here, and undone here
      var uf = E.ufilter[fkey] || {}, W = { honour: C.experienceStats(co).word, trauma: C.traumaStats(co).word };
      var picked = on('type').concat(on('tier').map(function (t) { return 'Tier ' + ROMAN[t]; }))
        .concat(['honour', 'trauma'].filter(function (k) { return uf[k]; }).map(function (k) { return W[k]; }));
      /* Each drops down under its own button, over what is below (no title, no close:
         its button again, or a tap anywhere else, puts it away). */
      var pop = function (kind, label, on, inner) {
        var open = isOpen(kind);
        return '<span class="dpopwrap"><button type="button" class="lnk' + (on ? ' on' : '') + '" data-go="dpop" data-kind="' + kind + '" aria-expanded="' + open + '">' +
          label + ' \u25be</button>' + (open ? '<div class="dpop dpick-list">' + inner + '</div>' : '') + '</span>';
      };
      var chip = function (kind, val, label) {
        var is = !!E.dfilt[kind][val];
        return '<button type="button" class="lnk' + (is ? ' on' : '') + '" data-go="dfilt" data-kind="' + kind + '" data-val="' + esc(val) + '" aria-pressed="' + is + '">' + esc(label) + '</button>';
      };
      var h = '<div class="dsortline">' +
        pop('dsort', 'Sort: ' + by[1], false, SORTS.map(function (x) {
          return '<button type="button" class="lnk' + (x[0] === E.dsort ? ' on' : '') + '" data-go="dsort" data-by="' + x[0] + '" aria-pressed="' + (x[0] === E.dsort) + '">' + x[1] + '</button>';
        }).join('') +
          // headers over the list (by what was last sorted or filtered by): a tick box under the sorts
          '<div class="dpop-acts dgrprow"><button type="button" class="dgrpchk" role="checkbox" data-go="dgroup" aria-checked="' + !!E.dgroup + '">' +
          '<span class="box" aria-hidden="true">' + (E.dgroup ? '\u2713' : '') + '</span>Group under headers</button></div>') +
        pop('dfilter', 'Filter: ' + (picked.length ? esc(picked.length > 2 ? picked.length + ' chosen' : picked.join(', ')) : 'All'), picked.length > 0,
          '<h4>Type</h4>' + Object.keys(types).sort().map(function (g) { return chip('type', g, g || 'Other'); }).join('') +
          '<h4>Tier</h4>' + Object.keys(tiers).sort().map(function (t) { return chip('tier', t, 'Tier ' + ROMAN[t]); }).join('') +
          '<h4>Has</h4>' + ['honour', 'trauma'].map(function (k) {
            return '<button type="button" class="lnk' + (uf[k] ? ' on' : '') + '" data-go="ufilter" data-fkey="' + fkey + '" data-kind="' + k + '" aria-pressed="' + !!uf[k] + '">' + esc(W[k]) + '</button>';
          }).join('') +
          (picked.length ? '<div class="dpop-acts"><button type="button" class="lnk" data-go="dfiltclear">Clear</button></div>' : '')) +
        '</div>';
      return h;
    }
    /* Promotion to the next Company Tier (pp. 83-84) is a handful of conditions,
       and a force can sit a long way short of one of them without knowing which.
       This lays them out: money banked, a legal army at every Tier up to the next,
       and — before Tier IV — a Tier III army at twice the size. */
    function promotionPanel(co, side, hub) {
      var pp = C.promotionProgress(co);
      var kind = C.words(co).force;
      // on the hub, giving the whole thing up sits on the same line (and asks first)
      var quit = '';                                   // Abandon is on the hub's button row
      if (pp.top) {
        /* Tier V: in place of a promotion, one change of doctrine every five
           battles (p. 87) — where the promote button would be */
        var sw = C.canSwapDoctrine(co);
        var swap = '<button class="start cprom-go" data-go="doctrine" data-side="' + side + '" data-swap="1"' +
          (sw.ok ? '' : ' disabled title="' + esc(sw.why) + '"') + '>' +
          (sw.due != null ? 'Reselect in ' + (sw.due - co.record.battles) + ' battle' + (sw.due - co.record.battles === 1 ? '' : 's')
            : 'Reselect a ' + C.creedOf(co).one) + '</button>';
        return '<div class="cprom done"><div class="cprom-head"><b>Tier V</b>' +
          '<span class="mk">as high as a ' + kind + ' goes</span></div>' +
          '<div class="cprom-row">' + swap + quit + '</div></div>';
      }
      /* One line, folded: the next Tier and how far along; a tap opens what each
         condition still needs (and the promote button, once they are all met, either way) */
      var open = !!E.promoOpen;
      var h = '<div class="cprom' + (pp.ok ? ' ready' : '') + (open ? '' : ' shut') + '">';
      h += '<button type="button" class="cprom-toggle" data-go="promoopen" aria-expanded="' + open + '">' +
        '<span class="cprom-head"><b>Promotion to Tier ' + ROMAN[pp.next] + '</b>' +
        '<span class="cprom-count">' + pp.done + ' of ' + pp.total + ' <span class="cprom-ar" aria-hidden="true">' + (open ? '\u25be' : '\u25b8') + '</span></span></span>';
      h += '<span class="cprom-bar"><i style="width:' +
        Math.round(100 * pp.done / pp.total) + '%"></i></span></button>';
      if (!open && !pp.ok) return h + '</div>';
      if (!open) return h + '<div class="cprom-row"><button class="start cprom-go" data-go="promoteco" data-side="' + side + '">' +
        'Promote to Tier ' + ROMAN[pp.next] + ' — ' + pp.cost + ' ' + C.money(co) + '</button>' + quit + '</div></div>';
      h += '<ul class="cprom-list">';
      pp.steps.forEach(function (st) {
        var pct = st.need > 1 ? Math.round(100 * st.have / st.need) : (st.done ? 100 : 0);
        h += '<li class="' + (st.done ? 'met' : 'unmet') + '">' +
          '<span class="tick">' + (st.done ? '✓' : '·') + '</span>' +
          '<span class="what"><b>' + esc(st.label) + '</b>' +
          (st.need > 1 ? ' <span class="cprom-num">' + st.have + '/' + st.need + '</span>' : '') +
          '<em>' + esc(st.detail) + '</em></span>';
        if (st.need > 1 && !st.done) {
          h += '<span class="cprom-sub"><i style="width:' + pct + '%"></i></span>';
        }
        h += '</li>';
      });
      h += '</ul>';
      h += '<div class="cprom-row"><button class="start cprom-go" data-go="promoteco" data-side="' + side + '"' +
        (pp.ok ? '' : ' disabled') + '>' +
        (pp.ok ? 'Promote to Tier ' + ROMAN[pp.next] + ' — ' + pp.cost + ' ' + C.money(co)
          : 'Not yet — ' + (pp.total - pp.done) + ' still to do') + '</button>' + quit + '</div>';
      if (pp.ok) {
        h += '<div class="dnote">A promotion opens another ' +
          C.creedOf(co).one + ' slot, and the free ' +
          C.words(co).cmd +
          ' is promoted with the ' + kind + '.</div>';
      }
      return h + '</div>';
    }

    /* The Company Tier as a badge, in the force's own word for it on hover. */
    function tierBadge(co) {
      // in the force's own colours
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, c = CO[colourOf(co)];
      var st = c ? ' style="border-color:' + c.light + ';background:' + c.dark + ';color:' + c.light + '"' : '';
      var what = C.words(co).tier + ' Tier ' + ROMAN[co.tier];
      return '<span class="tierbadge"' + st + ' title="' + esc(what) + '">' + ROMAN[co.tier] + '</span>';
    }
    /* The side stripe down a force's panel, in its own colour. */
    function stripe(co) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, c = CO[colourOf(co)];
      return c ? ' style="border-left-color:' + c.light + '"' : '';
    }
    /* The kind of force, as a pill in that army's colour: ochre mercenaries,
       crimson insurgents, olive bugs, steel Xenotripods. */
    var ARMY_COLOUR = { pmc: 'ochre', rebel: 'crimson', bugs: 'olive', xeno: 'steel' };
    // the kind of force; given a modal to open, a button to its army's rules
    function armyPill(co, kind) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, c = CO[ARMY_COLOUR[co.faction || 'pmc']];
      var st = c ? ' style="border-color:' + c.light + ';background:' + c.dark + ';color:' + c.light + '"' : '';
      if (kind) return '<button type="button" class="mk armypill"' + st + ' data-go="fmodal" data-kind="' + kind + '" title="Army rules">' + esc(C.words(co).side) + '</button>';
      return '<span class="mk armypill"' + st + '>' + esc(C.words(co).side) + '</span>';
    }
    // what a force is built around, a tag each with what it does in its tip
    function doctrineMarks(co) {
      return co.doctrines.map(function (d) { return U.mark(C.doctrine(d)); }).join('');
    }
    /* An army's own rules: how it fights its campaign, and the special rules
       only its units carry (read off the unit profiles, so it stays in step
       with them), each with the rule's text. */
    function armyRules(co) {
      var f = co.faction || 'pmc', W = C.words(co), cr = C.creedOf(co), R = root.PMC, T = root.PMCRuleText;
      // the army's own rules, shared with the unit viewer (ruletext.js armyRules)
      var AR = T.armyRules(f, (R && R.CATALOGUE) || []), text = AR.text;
      var wide = AR.wide.map(function (x) { return x.name; }), own = AR.own.map(function (x) { return x.name; });
      var h = '<div class="cmodal-scroll armyrules"><p class="dnote">A ' + esc(W.force) + ' of ' + esc(W.side) + '.</p><ul class="armycamp">' +
        '<li>Paid in <b>' + esc(W.moneyLong) + '</b> (' + esc(W.money) + ').</li>' +
        '<li>Grows through <b>' + esc(cr.many) + '</b>; its units earn ' + esc(W.honours) + ' and suffer ' + esc(W.traumas) + '.</li>' +
        (f === 'bugs' ? '<li>Its losses are <b>biomass</b>: a bug is lost or it is not, never wounded.</li>'
          : '<li>Its casualties go to the <b>' + esc(W.memorial) + '</b>: ' + esc(W.kiaLong.toLowerCase()) + ', or ' + esc(W.wiaLong.toLowerCase()) + '.</li>') +
        '</ul>';
      if (f === 'pmc') h += '<p class="dnote">Mercenary companies have no army-specific special rules: their units follow the standard rules.</p>';
      if (wide.length) {
        h += '<h4>Army rules</h4><dl class="armyrl">' + wide.map(function (k) {
          return '<dt>' + esc(k) + '</dt><dd>' + esc(text(k)) + '</dd>';
        }).join('') + '</dl>';
      }
      if (own.length) {
        h += '<h4>Special rules of the army</h4><dl class="armyrl">' + own.map(function (k) {
          return '<dt>' + esc(k) + '</dt><dd>' + esc(text(k)) + '</dd>';
        }).join('') + '</dl>';
      }
      var ch = T.ARMY_CHOICES[f];
      if (ch) {
        h += '<h4>' + esc(ch.title) + '</h4><dl class="armyrl">' + ch.list.map(function (k) {
          return '<dt>' + esc(k) + '</dt><dd>' + esc(text(k)) + '</dd>';
        }).join('') + '</dl>';
      }
      return h + '</div>';
    }
    /* Won, veterancy and trauma (or the swarm's and the tribe's words for them), one row. */
    function statRow(co, rival, fkey) {
      var wn = C.winStats(co), ex = C.experienceStats(co), tr = C.traumaStats(co);
      function pc(x) { return Math.round(x * 1000) / 10 + '%'; }
      /* On the company's own hub the win rate opens the battles fought, and the
         trauma the memorial: the numbers, and what they were made of. */
      function cell(cls, pct, word, modal) {
        var inner = '<b>' + pct + '</b><span>' + esc(word) + '</span>';
        return modal ? '<button type="button" class="cstat ' + cls + '" data-go="fmodal" data-kind="' + modal + '">' + inner + '</button>'
          : '<div class="cstat ' + cls + '">' + inner + '</div>';
      }
      var own = !rival && co === (E.camp.companies[E.hubSide] || E.camp.companies.A);
      return '<div class="cstats">' +
        // your own win rate opens the battles fought, a rival's the battles it has fought — none yet, it says so
        cell('cs-win', pc(wn.pct), 'win rate', own ? 'battles' : fkey && fkey.charAt(0) === 'r' ? 'rbattles' + fkey.slice(1) : null) +
        cell('cs-exp', pc(ex.pct), ex.word) + cell('cs-tra', pc(tr.pct), tr.word) +
        '</div>';
    }

    /* Beside their dossier (online, or alone): a contract with them — to another player a
       challenge, with an AI force the contract itself (its terms, then the pick). */
    function contractButton(co, ri) {
      var on = (E.camp && E.camp.online) || {}, mine = E.camp.companies.A;
      var off = function (why) { return '<button class="start" disabled title="' + esc(why) + '">' + esc(why) + '</button>'; };
      if (!(mine.roster || []).length) return off('Found your force first');
      // too battered to field a real army: it sits this turn out and rebuilds
      if (co.regrouping) return off('Regrouping this turn');
      // alone: the job they offer this turn (or one rolled for them), then the contract screen
      if (!E.online) return '<button class="start" data-rivcontract="' + ri + '">Contract</button>';
      if (on.contract || on.duel) return off('Something else is under way');
      if (co.human) {
        if (co.out) return off('Out of the campaign');
        if (!(co.roster || []).length) return off('Not founded yet');
        if ((on.challenges || []).some(function (c) { return (c.mine && c.to === co.slot) || (!c.mine && c.from === co.slot); })) return off('Challenge waiting');
        if (co.busy) return off('Fighting someone else');
        return '<button class="start" data-ochallenge="' + co.slot + '">Challenge</button>';
      }
      if ((on.busyAi || []).indexOf(ri) >= 0) return off('Fighting someone else');
      return '<button class="start" data-oaicontract="' + ri + '">Contract</button>';
    }
    function rivalPanel(co, idx) {
      // no 'next' on any of them: the player picks the contract, and with it who they meet
      var h = '<div class="cpan cpan-B"' + stripe(co) + '><div class="cphead">' + tierBadge(co) + '<b>' +
        esc(co.name) + '</b></div>';
      h += statRow(co, true, 'r' + (idx == null ? 0 : idx));
      // the kind of force, and its doctrines beside it on the one line
      h += '<div class="cpdoc carch">' + armyPill(co, 'armyr' + (idx == null ? 0 : idx)) + doctrineMarks(co) + '</div>';
      // their dossier opens in the card: their units, as your own are listed
      var ri = idx == null ? 0 : idx, open = E.rivalOpen === ri;
      var dos = '<button class="lnk rivdos-go' + (open ? ' on' : '') + '" data-rivdos="' + ri + '" aria-expanded="' + open + '">' +
        (open ? '\u25be ' : '\u25b8 ') + 'Their dossier</button>';
      h += (E.online || E.camp.mode === 'solo') && !E.camp.over ? '<div class="rivacts">' + dos + contractButton(co, ri) + '</div>' : dos;
      if (open) {
        var rk = 'r' + ri, shown = co.roster.filter(function (e) { return E.unitPasses(e, rk); });
        h += '<div class="dlist rivdos">' + shown.slice().sort(function (a, b) {
          var la = C.isLeaderP(profile(a.key)) ? 1 : 0, lb = C.isLeaderP(profile(b.key)) ? 1 : 0;
          return lb - la || profile(b.key).tier - profile(a.key).tier || b.exp - a.exp;
        }).map(function (e) { return entryCard(e, co, {}); }).join('') +
          (shown.length ? '' : '<p class="cpstat">None of their units has any.</p>') + '</div>';
      }
      h += '</div>';
      return h;
    }

    return {
      hubView: hubView, sortLine: sortLine, stripe: stripe, armyPill: armyPill, doctrineMarks: doctrineMarks, armyRules: armyRules, statRow: statRow
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierHub;
})(typeof window !== 'undefined' ? window : global);
