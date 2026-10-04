/* PMC 2670 — Firefight : the company hub: the bar, the company, promotion, badges and the other forces

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierHub = function (E) {
    var C = E.C, ICON_ABANDON = E.ICON_ABANDON, ICON_BATTLES = E.ICON_BATTLES, ICON_FORCES = E.ICON_FORCES,
        ICON_LOAD = E.ICON_LOAD, ICON_MANAGE = E.ICON_MANAGE, memorialIcon = E.memorialIcon,
        ICON_SAVE = E.ICON_SAVE, ROMAN = E.ROMAN, Store = E.Store, cmodal = E.cmodal, coin = E.coin,
        colourOf = E.colourOf, dossierPanel = E.dossierPanel,
        entryCard = E.entryCard, esc = E.esc, memorialList = E.memorialList, profile = E.profile,
        root = E.root, spendActs = E.spendActs, tip = E.tip;
    /* ================= the hub ================= */
    function hubView() {
      var h = '<h2>' + (E.camp ? 'Campaign — turn ' + E.camp.turn : E.wantMode === 'hotseat' ? 'Hotseat campaign' : 'Campaign') + '</h2>';
      if (!E.camp) {
        function opt(v, t, want) { return '<option value="' + v + '"' + (want === v ? ' selected' : '') + '>' + t + '</option>'; }
        var pa = { faction: E.wantFaction, doctrines: [] }, pb = { faction: E.wantB, doctrines: [] };
        /* Laid out as the online campaign's lobby is: a slot for each force on the
           world — yours (and Player 2's, in hotseat), then the AI forces, each with
           its colours and its army — and under them one line: how many forces, and
           the button that raises yours. The way of playing is the menu card it was
           opened from (Single player or Hotseat). */
        var ARMY = [['pmc', 'PMC'], ['rebel', 'Rebel'], ['bugs', 'Bugs'], ['xeno', 'Xenotripods']];
        var CO = (E.root.PMCIso && E.root.PMCIso.COLOURS) || {}, KEYS = (E.root.PMCIso && E.root.PMCIso.COLOUR_KEYS) || [];
        var chipOf = function (k) {
          var c = CO[k];
          return c ? '<span class="olob-chip" style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span>' : '<span class="olob-chip rivrand">?</span>';
        };
        var hot = E.wantMode === 'hotseat', nr = hot ? 0 : E.wantRivals, ra = E.wantRivalArmies, rc = E.wantRivalColours, ci = E.rivColourFor;
        // a player's own colours are picked when their force is founded
        var playerRow = function (who, id, want) {
          return '<div class="olob-slot mine"><span class="olob-colour still" title="Picked when the force is founded">' + chipOf('') + '</span>' +
            '<span class="olob-who"><b>' + esc(who) + '</b></span>' +
            '<select id="' + id + '" aria-label="' + esc(who) + ' — army">' + ARMY.map(function (a) { return opt(a[0], a[1], want); }).join('') + '</select></div>';
        };
        h += '<div class="olob-slots">' + playerRow(hot ? 'Player 1' : 'You', 'camp-faction', E.wantFaction);
        if (hot) h += playerRow('Player 2', 'camp-bfaction', E.wantB);
        for (var ri = 0; ri < nr; ri++) {
          h += '<div class="olob-slot"><button type="button" class="olob-colour" data-go="rivcolour" data-i="' + ri + '" aria-expanded="' + (ci === ri) + '" title="' +
            esc(rc[ri] && CO[rc[ri]] ? CO[rc[ri]].name : 'Colours rolled at random — tap to pick') + '" aria-label="AI force ' + (ri + 1) + ' colours">' + chipOf(rc[ri]) + '</button>' +
            '<span class="olob-who"><b>AI force</b></span>' +
            '<select class="rivarmy" data-i="' + ri + '" aria-label="AI force ' + (ri + 1) + ' — army">' + opt('', 'Random', ra[ri] || '') +
            ARMY.map(function (a) { return opt(a[0], a[1], ra[ri] || ''); }).join('') + '</select></div>';
        }
        h += '</div>';
        // an AI force's colours, popped up by its chip (one another force wears is not offered)
        if (ci !== null && ci < nr) {
          var others = rc.filter(function (k, j) { return k && j !== ci && j < nr; });
          h += '<div class="found-pop olob-pop" data-rivpop="' + ci + '"><label>Colours — ' + esc(rc[ci] && CO[rc[ci]] ? CO[rc[ci]].name : 'rolled at random') + '</label><div class="csw">' +
            '<button type="button" class="rivpick-rand' + (!rc[ci] ? ' on' : '') + '" data-rivpick="" title="Rolled at random"><span class="rivrand">?</span></button>' +
            KEYS.map(function (k) {
              var taken = others.indexOf(k) >= 0, q = CO[k];
              return '<button type="button"' + (k === rc[ci] ? ' class="on"' : '') + ' data-rivpick="' + k + '"' + (taken ? ' disabled' : '') +
                ' title="' + esc(q.name + (taken ? ' — another force wears it' : '')) + '"><span style="background:linear-gradient(135deg,' + q.light + ' 0 38%,' + q.mid + ' 38% 74%,' + q.dark + ' 74%)"></span></button>';
            }).join('') + '</div></div>';
        }
        // one line: how many forces share the world (always an even number, so they pair off), and Raise the force
        h += '<div class="olob-bar">' + (hot ? '<span class="olob-n">2 forces</span>'
          : '<label class="olob-n">Forces <select id="camp-rivals">' + [1, 3, 5, 7].map(function (n) {
            return '<option value="' + n + '"' + (n === nr ? ' selected' : '') + '>' + (n + 1) + '</option>';
          }).join('') + '</select></label>') +
          '<button class="start" data-go="newcamp">Raise the force</button></div>';
        h += cmodal('armynew', C.words(pa).side + ' \u2014 army rules', armyRules(pa));
        h += cmodal('armynewb', C.words(pb).side + ' \u2014 army rules', armyRules(pb));
        h += '<p class="camp-foot"><button class="lnk" data-go="menu">← Main menu</button>' +
          '<button class="lnk" data-go="import">Load a save file</button>' +
          '<input type="file" id="camp-file" accept="application/json" hidden></p>';
        return h;
      }
      var A = E.camp.companies.A, B = E.camp.companies.B;
      var rivals = E.camp.mode === 'hotseat' ? [] : (E.camp.rivals || [B]), n = rivals.length;
      if (Store.note()) h += '<p class="dnote hubnote">' + esc(Store.note()) +
        // saved on another device since: which copy to go on with (decision 7)
        (Store.conflict && Store.conflict() ? ' <button type="button" class="lnk" data-go="storeuse">Use that copy</button> <button type="button" class="lnk" data-go="storekeep">Keep this one</button>' : '') +
        '</p>';
      // in hotseat, the player whose force the hub shows and works on (HC-1)
      var hs = E.hubSide, cur = E.camp.companies[hs] || A;
      // online: who is waiting on whom, the code for the open seat, the battle when it is made
      if (E.online) h += E.onlineNote();
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
      h += companyPanel(cur, hs, hubBar());
      // what a unit can spend its experience on: an honour, an upgrade, or a promotion to another unit
      var promoE = E.promoRid && C.byRid(cur, E.promoRid);
      if (promoE) {
        h += cmodal('promote', 'Promote ' + promoE.name + ' \u2014 ' + promoE.exp + ' EXP',
          '<div class="cmodal-scroll promo-list">' + spendActs(promoE, cur) + '</div>');
      }
      /* The campaign's window: who else is on the world (in hotseat, the second
         player's force), the battles fought, the fallen, and the campaign's
         file: out to a file, back in from one, or given up. */
      var last = E.camp.log.length ? E.camp.log[E.camp.log.length - 1] : null;
      var back = '<button type="button" class="lnk" data-go="fmodal" data-kind="manage">\u2190 Back</button>';
      // won or lost from where the hub's player stands (hotseat: either of them, HC-13)
      var result = function (l) { return !l.winner ? 'drawn' : l.winner === (hs || 'A') ? 'won' : 'lost'; };
      var vsOf = function (l) { return E.camp.mode === 'hotseat' ? (hs === 'B' ? A : B).name : l.against; };
      h += cmodal('manage', 'The campaign', '<div class="cmodal-scroll manage-list">' +
        '<button type="button" class="archline" data-go="fmodal" data-kind="rivals">' + ICON_FORCES + '<span>' +
        (E.camp.mode === 'hotseat' ? (hs === 'B' ? 'Player 1' : 'Player 2') : 'The other forces on this world') + '<small>' +
        (E.camp.mode === 'hotseat' ? esc((hs === 'B' ? A : B).name) : n > 1 ? n + ' forces' : esc(B.name)) + '</small></span></button>' +
        (last ? '<button type="button" class="archline" data-go="fmodal" data-kind="battles">' + ICON_BATTLES + '<span>Battles fought<small>' +
          (E.camp.log.length > 1 ? E.camp.log.length + ' battles \u2014 the last: ' : '') +
          esc(C.SCENARIO_NAMES[last.scenario] || last.scenario) + ', Tier ' + ROMAN[last.tier] + ' PL' + last.pl + ', ' + result(last) +
          '</small></span></button>' : '') +
        '<button type="button" class="archline" data-go="fmodal" data-kind="memorial">' + memorialIcon(cur) + '<span>' + esc(C.words(cur).memorial) + '<small>' +
        esc(C.words(cur).memorialSub) + '</small></span></button>' +
        // online the server keeps the campaign: nothing to save to a file
        (E.online ? (E.camp.over ? '' : '<button type="button" class="archline danger" data-go="oconcede">' + ICON_ABANDON + '<span>Give the campaign up<small>You leave the world; the others play on \u2014 it asks first</small></span></button>')
          : '<button type="button" class="archline" data-go="export">' + ICON_SAVE + '<span>Save to a file<small>Download the whole campaign, to keep or move to another device</small></span></button>' +
        '<button type="button" class="archline" data-go="import">' + ICON_LOAD + '<span>Load a file<small>Carry on a campaign saved to a file before</small></span></button>' +
        '<button type="button" class="archline danger" data-go="wipe">' + ICON_ABANDON + '<span>Abandon the campaign<small>Every dossier goes — it asks first</small></span></button>') +
        '</div>');
      // the fallen, opened from the campaign's window (Back returns to it)
      h += cmodal('memorial', C.words(cur).memorial, '<div class="cmodal-scroll">' + memorialList(cur) + '</div>', back);
      h += cmodal('rivals', E.camp.mode === 'hotseat' ? (hs === 'B' ? 'Player 1' : 'Player 2') : 'The other forces on this world',
        // the other player's force shown as a rival's is: its figures, its kind and creed, and their dossier to open
        '<div class="cmodal-scroll">' + (E.camp.mode === 'hotseat' ? rivalPanel(hs === 'B' ? A : B, 0)
          : rivals.map(function (co, i) { return rivalPanel(co, i); }).join('')) + '</div>', back);
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
          E.camp.log.map(battleRow).reverse().join('') + '</div>' : '<p class="dnote">No battles fought yet.</p>') + '</div>', back);
      }
      // each rival's own battles, the latest first, opened from its win rate (Back to the other forces)
      var backRivals = '<button type="button" class="lnk" data-go="fmodal" data-kind="rivals">\u2190 Back</button>';
      // each army's rules, opened from its pill
      h += cmodal('armyA', C.words(A).side + ' \u2014 army rules', armyRules(A));
      if (E.camp.mode === 'hotseat') h += cmodal('armyB', C.words(B).side + ' \u2014 army rules', armyRules(B), backRivals);
      rivals.forEach(function (co, i) { h += cmodal('armyr' + i, co.name + ' \u2014 ' + C.words(co).side, armyRules(co), backRivals); });
      rivals.forEach(function (co, i) {
        if (!(co.log || []).length) { h += cmodal('rbattles' + i, co.name + ' \u2014 battles', '<div class="cmodal-scroll"><p class="dnote">No battles fought yet.</p></div>', backRivals); return; }
        h += cmodal('rbattles' + i, co.name + ' \u2014 battles', '<div class="cmodal-scroll"><div class="clog">' +
          co.log.slice().reverse().map(function (l) {
            return '<div class="crow"><b>' + l.turn + '</b>' +
              '<span>' + esc(C.SCENARIO_NAMES[l.scenario] || l.scenario) + ', Tier ' + ROMAN[l.tier] + ' PL' + l.pl +
              '<small>vs ' + esc(l.vs) + '</small></span><em>' + l.result + '</em></div>';
          }).join('') + '</div></div>', backRivals);
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
      var go = E.camp.over ? '<button class="start hubgo" disabled title="The campaign is over">Contract</button>'
        : '<button class="start hubgo" data-go="' + (E.camp.mode === 'solo' ? 'offers' : 'contract') + '">Contract</button>';
      // the other forces, the battles, the memorial, saving, loading and abandoning, together behind the one button
      var manage = '<button class="lnk hubicon" data-go="fmodal" data-kind="manage" title="The campaign" aria-label="The campaign">' + ICON_MANAGE + '</button>';
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
    function companyPanel(co, side, bar) {
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
          ? co.doctrines.map(function (d) {
            var dd = C.doctrine(d);
            return '<span class="mk" ' + tip(dd.name, dd.text) + '>' + esc(dd.name) + '</span>';
          }).join('')
          : '<span class="dnote">No ' + C.creedOf(co).one + ' chosen.</span>') + '</div>';
        var open = C.doctrineSlots(co) - co.doctrines.length;
        if (open > 0) {
          h += '<button class="lnk" data-go="doctrine" data-side="' + side + '">Choose a ' +
            C.creedOf(co).one + ' (' + open + ' free)</button> ';
        }
        var pp0 = promotionPanel(co, side, !!bar);
        // at the foot of its box, as the dossier has + Recruit: the other forces on the world (in hotseat, the other player)
        if (bar) {
          var hot = E.camp.mode === 'hotseat';
          pp0 = pp0.replace(/<\/div>$/, '<div class="cdos-foot"><button type="button" class="lnk" data-go="fmodal" data-kind="rivals">' +
            (hot ? (E.hubSide === 'B' ? 'Player 1' : 'Player 2') : 'Other forces') + '</button></div></div>');
        }
        h += pp0;
      }
      if (!co.aspiring && C.canAspire(co)) {
        h += ' <button class="lnk" data-go="aspire" data-side="' + side + '">Declare an Aspiring Company</button>';
      }
      var gaps = C.rebuildNeeds(co);
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
    function sortLine(co) {
      var by = SORTS.filter(function (x) { return x[0] === E.dsort; })[0] || SORTS[0];
      var types = {}, tiers = {};
      co.roster.forEach(function (e) {
        var p = profile(e.key);
        if (!p) return;
        types[p.group || ''] = true; tiers[p.tier] = true;
      });
      var on = function (kind) { return Object.keys(E.dfilt[kind]).filter(function (k) { return E.dfilt[kind][k]; }); };
      // the company's Honours and Trauma figures narrow it too: said here, and undone here
      var uf = E.ufilter[E.hubSide] || {}, W = { honour: C.experienceStats(co).word, trauma: C.traumaStats(co).word };
      var picked = on('type').concat(on('tier').map(function (t) { return 'Tier ' + ROMAN[t]; }))
        .concat(['honour', 'trauma'].filter(function (k) { return uf[k]; }).map(function (k) { return W[k]; }));
      var h = '<div class="dsortline">' +
        '<button type="button" class="lnk" data-go="fmodal" data-kind="dsort">Sort: ' + by[1] + ' \u25be</button>' +
        '<button type="button" class="lnk' + (picked.length ? ' on' : '') + '" data-go="fmodal" data-kind="dfilter">Filter: ' +
        (picked.length ? esc(picked.length > 2 ? picked.length + ' chosen' : picked.join(', ')) : 'All') + ' \u25be</button></div>';
      h += cmodal('dsort', 'Sort the dossier', '<div class="cmodal-scroll dpick-list">' + SORTS.map(function (x) {
        return '<button type="button" class="lnk' + (x[0] === E.dsort ? ' on' : '') + '" data-go="dsort" data-by="' + x[0] + '" aria-pressed="' + (x[0] === E.dsort) + '">' + x[1] + '</button>';
      }).join('') + '</div>');
      var chip = function (kind, val, label) {
        var is = !!E.dfilt[kind][val];
        return '<button type="button" class="lnk' + (is ? ' on' : '') + '" data-go="dfilt" data-kind="' + kind + '" data-val="' + esc(val) + '" aria-pressed="' + is + '">' + esc(label) + '</button>';
      };
      h += cmodal('dfilter', 'Filter the dossier', '<div class="cmodal-scroll dpick-list">' +
        '<h4>Type</h4>' + Object.keys(types).sort().map(function (g) { return chip('type', g, g || 'Other'); }).join('') +
        '<h4>Tier</h4>' + Object.keys(tiers).sort().map(function (t) { return chip('tier', t, 'Tier ' + ROMAN[t]); }).join('') +
        '<h4>Has</h4>' + ['honour', 'trauma'].map(function (k) {
          return '<button type="button" class="lnk' + (uf[k] ? ' on' : '') + '" data-go="ufilter" data-fkey="' + E.hubSide + '" data-kind="' + k + '" aria-pressed="' + !!uf[k] + '">' + esc(W[k]) + '</button>';
        }).join('') +
        '</div>', picked.length ? '<button type="button" class="lnk" data-go="dfiltclear">Clear</button>' : '');
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
      var h = '<div class="cprom' + (pp.ok ? ' ready' : '') + '">';
      h += '<div class="cprom-head"><b>Promotion to Tier ' + ROMAN[pp.next] + '</b>' +
        '<span class="cprom-count">' + pp.done + ' of ' + pp.total + '</span></div>';
      h += '<div class="cprom-bar"><i style="width:' +
        Math.round(100 * pp.done / pp.total) + '%"></i></div>';
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

    function rivalPanel(co, idx) {
      // no 'next' on any of them: the player picks the contract, and with it who they meet
      var h = '<div class="cpan cpan-B"' + stripe(co) + '><div class="cphead">' + tierBadge(co) + '<b>' +
        esc(co.name) + '</b></div>';
      h += statRow(co, true, 'r' + (idx == null ? 0 : idx));
      // the kind of force, and its doctrines beside it on the one line
      h += '<div class="cpdoc carch">' + armyPill(co, 'armyr' + (idx == null ? 0 : idx)) + co.doctrines.map(function (d) {
        return '<span class="mk" ' + tip(C.doctrine(d).name, C.doctrine(d).text) + '>' + esc(C.doctrine(d).name) + '</span>';
      }).join('') + '</div>';
      // their dossier opens in the card: their units, as your own are listed
      var ri = idx == null ? 0 : idx, open = E.rivalOpen === ri;
      h += '<button class="lnk rivdos-go' + (open ? ' on' : '') + '" data-rivdos="' + ri + '" aria-expanded="' + open + '">' +
        (open ? '\u25be ' : '\u25b8 ') + 'Their dossier</button>';
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
      hubView: hubView, stripe: stripe, armyPill: armyPill, armyRules: armyRules, statRow: statRow
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierHub;
})(typeof window !== 'undefined' ? window : global);
