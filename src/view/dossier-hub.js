/* PMC 2670 — Firefight : the company hub: the bar, the company, promotion, badges and the other forces

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierHub = function (E) {
    var C = E.C, ICON_ABANDON = E.ICON_ABANDON, ICON_BATTLES = E.ICON_BATTLES, ICON_FORCES = E.ICON_FORCES,
        ICON_LOAD = E.ICON_LOAD, ICON_MANAGE = E.ICON_MANAGE, ICON_MEMORIAL = E.ICON_MEMORIAL,
        ICON_SAVE = E.ICON_SAVE, ROMAN = E.ROMAN, Store = E.Store, cmodal = E.cmodal, coin = E.coin,
        colourName = E.colourName, colourOf = E.colourOf, dossierPanel = E.dossierPanel,
        entryCard = E.entryCard, esc = E.esc, memorialList = E.memorialList, profile = E.profile,
        root = E.root, spendActs = E.spendActs, squares = E.squares, tip = E.tip;
    /* ================= the hub ================= */
    function hubView() {
      var h = '<h2>Campaign' + (E.camp ? ' — turn ' + E.camp.turn : '') + '</h2>';
      if (!E.camp) {
        h += '<p class="lede">A never-ending series of battles between two forces that grow, ' +
          'scar over and occasionally fall apart. ' +
          'Units earn experience, take promotions and Battle Honours, collect trauma, and are ' +
          'sometimes struck off the dossier for good.</p>';
        h += '<div class="field"><label for="camp-faction">What you are running</label>' +
          '<select id="camp-faction">' +
          '<option value="pmc">A private military company — paid in credits, built around doctrines</option>' +
          '<option value="rebel">An insurgent revolt — paid in Influence Points, built around Paths</option>' +
          '<option value="bugs">A Space Bug swarm — paid in Resource Points, built around Evolutionary Pathways</option>' +
          '<option value="xeno">A Xenotripod tribe — paid in Territorial Points, built around Tribe Advancements</option>' +
          '</select></div>';
        h += '<div class="field"><label for="camp-mode">How you will play</label><select id="camp-mode">' +
          '<option value="solo">Solo — against a rival force that grows battle by battle</option>' +
          '<option value="hotseat"' + (E.wantMode === 'hotseat' ? ' selected' : '') + '>Hotseat — two dossiers, two players, one screen</option>' +
          '</select></div>';
        /* Solo: the forces on the world are always rolled, and each grows into its
           own character from the doctrines it draws. Hotseat: there are no rolled
           rivals, only the second player's force, so this asks what kind that is. */
        h += '<div class="field" id="camp-bwrap"' + (E.wantMode === 'hotseat' ? '' : ' hidden') + '><label for="camp-bfaction">What Player 2 is running</label>' +
          '<select id="camp-bfaction">' +
          '<option value="pmc">A private military company</option>' +
          '<option value="rebel">An insurgent revolt</option>' +
          '<option value="bugs">A Space Bug swarm</option>' +
          '<option value="xeno">A Xenotripod tribe</option>' +
          '</select></div>';
        h += '<button class="start" data-go="newcamp">Raise the force</button>';
        h += '<p class="camp-foot"><button class="lnk" data-go="menu">← Main menu</button>' +
          '<button class="lnk" data-go="import">Load a save file</button>' +
          '<input type="file" id="camp-file" accept="application/json" hidden></p>';
        return h;
      }
      var A = E.camp.companies.A, B = E.camp.companies.B;
      var rivals = E.camp.mode === 'hotseat' ? [] : (E.camp.rivals || [B]), n = rivals.length;
      if (Store.note()) h += '<p class="dnote hubnote">' + esc(Store.note()) + '</p>';
      h += companyPanel(A, 'A', hubBar());
      // what a unit can spend its experience on: an honour, an upgrade, or a promotion to another unit
      var promoE = E.promoRid && C.byRid(A, E.promoRid);
      if (promoE) {
        h += cmodal('promote', 'Promote ' + promoE.name + ' \u2014 ' + promoE.exp + ' EXP',
          '<div class="cmodal-scroll promo-list">' + spendActs(promoE, A) + '</div>');
      }
      /* The campaign's window: who else is on the world (in hotseat, the second
         player's force), the battles fought, the fallen, and the campaign's
         file: out to a file, back in from one, or given up. */
      var last = E.camp.log.length ? E.camp.log[E.camp.log.length - 1] : null;
      var back = '<button type="button" class="lnk" data-go="fmodal" data-kind="manage">Back</button>';
      var result = function (l) { return l.winner === 'A' ? 'won' : l.winner === 'B' ? 'lost' : 'drawn'; };
      h += cmodal('manage', 'The campaign', '<div class="cmodal-scroll manage-list">' +
        '<button type="button" class="archline" data-go="fmodal" data-kind="rivals">' + ICON_FORCES + '<span>' +
        (E.camp.mode === 'hotseat' ? 'Player 2' : 'The other forces on this world') + '<small>' +
        (E.camp.mode === 'hotseat' ? esc(B.name) : n > 1 ? n + ' forces' : esc(B.name)) + '</small></span></button>' +
        (last ? '<button type="button" class="archline" data-go="fmodal" data-kind="battles">' + ICON_BATTLES + '<span>Battles fought<small>' +
          (E.camp.log.length > 1 ? E.camp.log.length + ' battles \u2014 the last: ' : '') +
          esc(C.SCENARIO_NAMES[last.scenario] || last.scenario) + ', Tier ' + ROMAN[last.tier] + ' PL' + last.pl + ', ' + result(last) +
          '</small></span></button>' : '') +
        '<button type="button" class="archline" data-go="fmodal" data-kind="memorial">' + ICON_MEMORIAL + '<span>Memorial<small>' +
        (A.faction === 'bugs' ? 'The biomass spent over the campaign' : 'Everyone lost, battle by battle') + '</small></span></button>' +
        '<button type="button" class="archline" data-go="export">' + ICON_SAVE + '<span>Save to a file<small>Download the whole campaign, to keep or move to another device</small></span></button>' +
        '<button type="button" class="archline" data-go="import">' + ICON_LOAD + '<span>Load a file<small>Carry on a campaign saved to a file before</small></span></button>' +
        '<button type="button" class="archline warn" data-go="wipe">' + ICON_ABANDON + '<span>Abandon the campaign<small>Every dossier goes — it asks first</small></span></button>' +
        '</div>');
      // the fallen, opened from the campaign's window (Back returns to it)
      h += cmodal('memorial', 'Memorial', '<div class="cmodal-scroll">' + memorialList(A) + '</div>', back);
      h += cmodal('rivals', E.camp.mode === 'hotseat' ? 'Player 2' : 'The other forces on this world',
        '<div class="cmodal-scroll">' + (E.camp.mode === 'hotseat' ? companyPanel(B, 'B')
          : rivals.map(function (co, i) { return rivalPanel(co, i); }).join('')) + '</div>', back);
      // every battle fought, the latest first
      if (last) {
        // a battle whose aftermath was kept opens it again, read only
        var battleRow = function (l, i) {
          var inner = '<b>' + l.turn + '</b>' +
            '<span>' + esc(C.SCENARIO_NAMES[l.scenario] || l.scenario) + ', Tier ' + ROMAN[l.tier] + ' PL' + l.pl +
            (l.against ? '<small>vs ' + esc(l.against) + '</small>' : '') + '</span>' +
            '<em>' + result(l) + '</em>';
          return l.after ? '<button type="button" class="crow crow-go" data-go="pastbattle" data-i="' + i + '">' + inner + '</button>'
            : '<div class="crow">' + inner + '</div>';
        };
        h += cmodal('battles', 'Battles fought', '<div class="cmodal-scroll"><div class="clog">' +
          E.camp.log.map(battleRow).reverse().join('') + '</div></div>', back);
      }
      // each rival's own battles, the latest first, opened from its win rate (Back to the other forces)
      var backRivals = '<button type="button" class="lnk" data-go="fmodal" data-kind="rivals">Back</button>';
      rivals.forEach(function (co, i) {
        if (!(co.log || []).length) return;
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
      var co = E.camp.companies.A;
      var go = '<button class="start hubgo" data-go="' + (E.camp.mode === 'solo' ? 'offers' : 'contract') + '">Contract</button>';
      // the other forces, the battles, the memorial, saving, loading and abandoning, together behind the one button
      var manage = '<button class="lnk hubicon" data-go="fmodal" data-kind="manage" title="The campaign" aria-label="The campaign">' + ICON_MANAGE + '</button>';
      if (E.hubPane === 'dossier') {
        // in the dossier: back to the company, the campaign's window, and the contract (recruiting is at the foot of the dossier)
        return '<div class="hubbar dosbar">' +
          '<button class="lnk" data-go="roster">' + esc(C.words(co).Force) + '</button>' + manage +
          go + '</div>';
      }
      return '<div class="hubbar">' +
        '<button class="lnk" data-go="roster">Dossier</button>' +
        manage + go + '</div>';
    }
    function companyPanel(co, side, bar) {
      var h = '<div class="cpan cpan-' + side + '"' + stripe(co) + '>';
      h += '<div class="cphead">' + tierBadge(co, !!bar && side === 'A') + '<b>' + esc(co.name) + '</b>' +
        (co.aspiring ? '<span class="ctier">aspiring</span>' : '') +
        '<span class="cmoney">' + co.kUC + ' ' + C.money(co) + '</span></div>';
      // the colours, dropped down under your own badge
      if (bar && side === 'A' && E.colourOpen) {
        h += '<div class="found-pop tierpop"><label>' + esc(C.words(co).Force + ' colours \u2014 ' + colourName(colourOf(co))) +
          '</label>' + squares(colourOf(co)) + '</div>';
      }
      h += (bar || '') + statRow(co, false, side);
      h += '<div class="cpdoc">' + (co.doctrines.length
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
      h += bar && side === 'A' && E.hubPane === 'dossier' ? dossierPanel(co) : promotionPanel(co, side, !!bar);
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
    function tierBadge(co, pick) {
      // in the force's own colours; on your own force it is also where the colours are changed
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, c = CO[colourOf(co)];
      var st = c ? ' style="border-color:' + c.light + ';background:' + c.dark + ';color:' + c.light + '"' : '';
      var what = C.words(co).tier + ' Tier ' + ROMAN[co.tier];
      if (pick) {
        return '<button type="button" class="tierbadge tierpick"' + st + ' data-go="fcolour" aria-expanded="' + E.colourOpen + '" title="' +
          esc(what + ' \u2014 change colours') + '" aria-label="' + esc(what + ', change colours') + '">' + ROMAN[co.tier] + '</button>';
      }
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
    function armyPill(co) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, c = CO[ARMY_COLOUR[co.faction || 'pmc']];
      var st = c ? ' style="border-color:' + c.light + ';background:' + c.dark + ';color:' + c.light + '"' : '';
      return '<span class="mk armypill"' + st + '>' + esc(C.words(co).side) + '</span>';
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
      /* Honours and trauma narrow the force's dossier to the units that have
         them: toggles, lit while on (fkey says whose list; none, no toggle). */
      function toggle(cls, pct, word, kind) {
        var f = (E.ufilter[fkey] || {})[kind];
        return '<button type="button" class="cstat ' + cls + (f ? ' on' : '') + '" data-go="ufilter" data-fkey="' + fkey +
          '" data-kind="' + kind + '" aria-pressed="' + !!f + '"><b>' + pct + '</b><span>' + esc(word) + '</span></button>';
      }
      var own = !rival && co === E.camp.companies.A;
      return '<div class="cstats">' +
        // your own win rate opens the battles fought; a rival's, the battles it has fought
        cell('cs-win', pc(wn.pct), 'win rate', own && E.camp.log.length ? 'battles'
          : fkey && fkey.charAt(0) === 'r' && (co.log || []).length ? 'rbattles' + fkey.slice(1) : null) +
        (fkey ? toggle('cs-exp', pc(ex.pct), ex.word, 'honour') : cell('cs-exp', pc(ex.pct), ex.word)) +
        (fkey ? toggle('cs-tra', pc(tr.pct), tr.word, 'trauma') : cell('cs-tra', pc(tr.pct), tr.word)) +
        '</div>';
    }

    function rivalPanel(co, idx) {
      // no 'next' on any of them: the player picks the contract, and with it who they meet
      var h = '<div class="cpan cpan-B"' + stripe(co) + '><div class="cphead">' + tierBadge(co) + '<b>' +
        esc(co.name) + '</b></div>';
      h += statRow(co, true, 'r' + (idx == null ? 0 : idx));
      // the kind of force, and its doctrines beside it on the one line
      h += '<div class="cpdoc carch">' + armyPill(co) + co.doctrines.map(function (d) {
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
      hubView: hubView, stripe: stripe, armyPill: armyPill, statRow: statRow
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierHub;
})(typeof window !== 'undefined' ? window : global);
