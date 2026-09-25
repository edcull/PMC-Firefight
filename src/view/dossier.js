/* PMC 2670 — Firefight
   The campaign layer's screens and its store: founding a company, the dossier,
   the contract before a battle and the aftermath after one.

   Everything the campaign *knows* lives in campaign.js; this file only shows it
   and asks for decisions. One overlay, several views, rendered into #camp-body.
*/
(function (root) {
  'use strict';
  var R = root.PMC, C = root.PMCCamp;
  var el = function (id) { return document.getElementById(id); };

  /* ================= the store =================
     Three places a campaign can live, and it is written to every one that answers:

       local   the browser's own localStorage. Always available, always written,
               and the reason a campaign cannot be lost to a capability failing
               to load. This is the store of record.
       db      the artifact's `db` capability, when the page is served somewhere
               that grants it. Follows the player between devices.
       server  a URL you point it at — for the node server with a database that
               comes later. The protocol is three calls, and nothing else:
                 GET    <base>/campaign  -> the campaign JSON, or 404 if there is none
                 PUT    <base>/campaign  <- the campaign JSON
                 DELETE <base>/campaign
               Set it from the campaign screen, or window.PMC_CAMPAIGN.store.server(url).
               Note: the published artifact runs sandboxed and will very likely be
               refused a request to your own host, so this is for running the game
               from the files locally. The browser and the account cover the rest.

     On load every backend is read and the copy that has seen the most battles wins,
     so moving between them never quietly loses progress. */
  var KEY = 'pmc-campaign';
  var SRV = 'pmc-campaign-server';
  var db = null, dbReady = false, storeNote = '';   // not `note`: that is the in-page message helper below

  function raw(get, value) {
    try {
      if (get) { var got = localStorage.getItem(KEY); return got ? JSON.parse(got) : null; }
      if (value === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(value));
    } catch (e) { }
    return null;
  }
  function serverBase() {
    try { return localStorage.getItem(SRV) || null; } catch (e) { return null; }
  }

  var BACKENDS = {
    local: {
      id: 'local', name: 'this browser',
      ready: function () { try { return !!window.localStorage; } catch (e) { return false; } },
      load: function () { return Promise.resolve(raw(true)); },
      save: function (c) { raw(false, c); return Promise.resolve(true); },
      clear: function () { raw(false, null); return Promise.resolve(true); }
    },
    db: {
      id: 'db', name: 'your Claude account',
      ready: function () { return !!db; },
      load: function () {
        return db.doc('campaign/current').get().then(function (doc) {
          var got = doc && doc.data ? doc.data : doc;
          return got && got.payload ? got.payload : null;
        });
      },
      save: function (c) { return db.doc('campaign/current').set({ payload: c, turn: c.turn || 0 }); },
      clear: function () { return db.doc('campaign/current').delete(); }
    },
    server: {
      id: 'server', name: 'your own server',
      ready: function () { return !!serverBase(); },
      url: function () { return serverBase().replace(/\/+$/, '') + '/campaign'; },
      load: function () {
        return fetch(BACKENDS.server.url(), { headers: { 'accept': 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; });
      },
      save: function (c) {
        return fetch(BACKENDS.server.url(), {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(c)
        }).then(function (r) { if (!r.ok) throw new Error(r.status); return true; });
      },
      clear: function () { return fetch(BACKENDS.server.url(), { method: 'DELETE' }); }
    }
  };
  var ORDER = ['local', 'db', 'server'];
  var health = {};                 // what each backend did last time it was asked

  function each(fn) {
    return Promise.all(ORDER.map(function (id) {
      var b = BACKENDS[id];
      var ok;
      try { ok = b.ready(); } catch (e) { ok = false; }
      if (!ok) { health[id] = { on: false }; return Promise.resolve(null); }
      return Promise.resolve(fn(b))
        .then(function (v) { health[id] = { on: true, ok: true }; return { id: id, value: v }; })
        .catch(function (e) { health[id] = { on: true, ok: false, why: String(e && e.message || e) }; return null; });
    }));
  }

  var Store = {
    async init() {
      if (dbReady) return;
      dbReady = true;
      try {
        if (root.claude && root.claude.use) db = await root.claude.use('db');
      } catch (e) { db = null; }
    },
    async load() {
      await Store.init();
      var found = (await each(function (b) { return b.load(); }))
        .filter(function (r) { return r && r.value && r.value.companies; });
      if (!found.length) { storeNote = ''; return null; }
      found.sort(function (x, y) { return (y.value.turn || 0) - (x.value.turn || 0); });
      var win = found[0];
      storeNote = win.id === 'local' ? ''
        : 'Loaded from ' + BACKENDS[win.id].name +
          (found.length > 1 ? ' — it was further along than this browser’s copy.' : '.');
      return C.rehydrate(win.value);
    },
    async save(camp) {
      if (!camp) return;
      // each rival is written once; companies.B is an alias into `rivals`
      var flat = C.forSave(camp);
      await each(function (b) { return b.save(flat); });
    },
    async clear() {
      await each(function (b) { return b.clear(); });
    },
    server: function (url) {
      try {
        if (url) localStorage.setItem(SRV, url);
        else localStorage.removeItem(SRV);
      } catch (e) { }
      return serverBase();
    },
    status: function () {
      return ORDER.map(function (id) {
        var h = health[id] || {};
        var on;
        try { on = BACKENDS[id].ready(); } catch (e) { on = false; }
        return {
          id: id, name: BACKENDS[id].name, on: on,
          ok: h.ok !== false, why: h.why || '',
          url: id === 'server' ? serverBase() : null
        };
      });
    },
    note: function () { return storeNote; }
  };

  /* ================= view state ================= */
  var camp = null;              // the loaded campaign, or null
  var view = 'hub';
  var draft = null;             // the company being founded
  var contract = null;          // the battle being set up
  var after = null;             // the aftermath being worked through
  var ROMAN = R.ROMAN;
  var ICON_SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>';
  var ICON_LOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 17v3h16v-3"/></svg>';

  function save() {
    // the storage panel only knows how a write went once it has gone, so redraw then
    Store.save(camp).then(function () {
      if (view === 'hub' && el('camp') && !el('camp').hidden) render();
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* The tooltip attributes, from tips.js. A Battle Honour or a Battle Trauma is
     a name and a rule, and the name alone tells you nothing — so wherever one is
     shown, what it does is one hover or one tap away. */
  function tip(head, body) {
    return window.PMCTips ? window.PMCTips.attr(head, body)
      : 'title="' + esc((head ? head + ' — ' : '') + body) + '"';
  }
  function quietTip(head, body) {
    return window.PMCTips ? window.PMCTips.quiet(head, body) : tip(head, body);
  }
  function spellOut(list, table) {
    return (list || []).map(function (n) {
      var x = table[n - 1];
      return x ? x.name + ' — ' + x.text : '?';
    }).join('\n');
  }
  function open(v) {
    if (root.PMCMenu) root.PMCMenu.close();          // the menu would sit on top
    view = v || view; el('camp').hidden = false; render();
  }
  function close() {
    el('camp').hidden = true;
    // with no battle on the table there would be nothing left to look at
    if (!root.PMC_STATE || !root.PMC_STATE()) toMenu();
  }
  function toMenu() {
    el('camp').hidden = true;
    if (root.PMCMenu) root.PMCMenu.open();
    else { var s = el('setup'); if (s) s.hidden = false; }
  }

  /* ================= asking the player something =================
     The published page runs inside a sandboxed frame, where confirm() returns
     false and prompt() returns null without ever being shown to anyone — so a
     button wired to a native dialog silently does nothing. Everything that needs
     an answer is drawn in the page instead. */
  var asking = null;

  function ask(spec) {
    asking = spec;
    var box = el('camp-askbox');
    var h = '<h3>' + esc(spec.title) + '</h3>';
    if (spec.text) h += '<p' + (spec.danger ? ' class="warn"' : '') + '>' + esc(spec.text) + '</p>';
    if (spec.kind === 'text') {
      h += '<input class="tin" id="ask-input" maxlength="' + (spec.max || 28) + '" value="' +
        esc(spec.value || '') + '">';
    }
    if (spec.kind === 'note') {
      h += '<div class="askrow"><button class="start" data-ask="close">Close</button></div>';
    } else {
      h += '<div class="askrow">' +
        '<button class="start' + (spec.danger ? ' danger' : '') + '" data-ask="ok">' +
        esc(spec.okLabel || 'Confirm') + '</button>' +
        '<button class="lnk" data-ask="close">Cancel</button></div>';
    }
    box.innerHTML = h;
    el('camp-ask').hidden = false;
    var input = el('ask-input');
    if (input) { input.focus(); input.select(); }
  }
  function closeAsk() { asking = null; el('camp-ask').hidden = true; }
  function answerAsk() {
    var spec = asking;
    if (!spec) return;
    var input = el('ask-input');
    var value = input ? input.value.trim() : true;
    closeAsk();
    if (spec.onOk) spec.onOk(value);
  }
  function note(title, text) { ask({ kind: 'note', title: title, text: text }); }

  /* ================= small pieces ================= */
  function profile(key) { return R.profile(key); }
  function unitLine(e) {
    var p = profile(e.key);
    return p.name + ' · Tier ' + ROMAN[p.tier];
  }
  function tierChip(t) { return '<span class="ct">' + ROMAN[t] + '</span>'; }

  function entryCard(e, co, opts) {
    opts = opts || {};
    var p = profile(e.key), h = '';
    var machine = p.cls !== 'infantry';
    var threshold = C.traumaThreshold(co);
    h += '<div class="dcard' + (e.restUntil > 0 ? ' resting' : '') + '" data-rid="' + e.rid + '">';
    h += '<div class="dtop">' + tierChip(p.tier) +
      '<b class="dname">' + esc(e.name) + '</b>' +
      (e.name === p.name ? '' : '<span class="dprof">' + esc(p.name) + '</span>');
    if (e.free) h += '<span class="dtag">' + esc(C.words(co).cmd) + '</span>';
    if (e.restUntil > 0) h += '<span class="dtag warn">in the workshop</span>';
    h += '</div>';
    if (!C.isLeaderP(p) && !(co.faction === 'xeno' && (p.rules || []).indexOf('Turret') >= 0)) {
      h += '<div class="dbars">' +
        '<span class="dexp">' + e.exp + ' EXP</span>';
      if (!machine || C.takesHonours(p)) {
        var pct = Math.min(100, Math.round(100 * e.tp / threshold));
        h += '<span class="dtp" title="' + e.tp + ' of ' + threshold + ' Trauma Points">' +
          '<i style="width:' + pct + '%"></i></span><span class="dtpn">' + e.tp + '/' + threshold + ' TP</span>';
      }
      h += '</div>';
    } else {
      h += '<div class="dbars"><span class="dnote">' + (p.leaderBug ? 'Leader Bugs' : p.alpha ? 'Alpha squads' : C.isLeaderP(p) ? 'Command Units' : 'Turrets') + ' never earn experience.</span></div>';
    }
    var marks = [];
    (e.honours || []).forEach(function (n) {
      var hx = C.honourTable(e.key)[n - 1];
      marks.push('<span class="mk good" ' + tip(hx.name, hx.text) + '>' + esc(hx.name) + '</span>');
    });
    (e.upgrades || []).forEach(function (n) {
      var ug = C.upgradeTable(e.key)[n - 1];
      marks.push('<span class="mk good" ' + tip(ug.name, ug.text) + '>' + esc(ug.name) + '</span>');
    });
    (e.traumas || []).forEach(function (n) {
      var tx = C.traumaTable(e.key)[n - 1];
      marks.push('<span class="mk bad" ' + tip(tx.name, tx.text) + '>' + esc(tx.name) + '</span>');
    });
    if (marks.length) h += '<div class="dmarks">' + marks.join('') + '</div>';
    if (opts.actions) h += '<div class="dacts">' + opts.actions + '</div>';
    if (opts.men) h += opts.men;
    h += '</div>';
    return h;
  }

  /* ================= the hub ================= */
  function hubView() {
    var h = '<h2>Campaign' + (camp ? ' — turn ' + camp.turn : '') + '</h2>';
    if (!camp) {
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
        '<option value="hotseat">Hotseat — two dossiers, two players, one screen</option>' +
        '</select></div>';
      /* Solo: the forces on the world are always rolled, and each grows into its
         own character from the doctrines it draws. Hotseat: there are no rolled
         rivals, only the second player's force, so this asks what kind that is. */
      h += '<div class="field" id="camp-bwrap" hidden><label for="camp-bfaction">What Player 2 is running</label>' +
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
    var A = camp.companies.A, B = camp.companies.B;
    var rivals = camp.mode === 'hotseat' ? [] : (camp.rivals || [B]), n = rivals.length;
    if (Store.note()) h += '<p class="dnote hubnote">' + esc(Store.note()) + '</p>';
    h += companyPanel(A, 'A', hubBar());
    /* Who else is on the world: one line, and their panels in a modal behind
       it (in hotseat, the second player's force). */
    h += '<div class="field"><label>' + (camp.mode === 'hotseat' ? 'Player 2' : 'The other forces on this world') + '</label>' +
      '<button type="button" class="archline" data-go="fmodal" data-kind="rivals"><span>' +
      (camp.mode === 'hotseat' ? esc(B.name)
        : n > 1 ? n + ' forces' : esc(B.name)) +
      '</span><em>details</em></button></div>';
    h += cmodal('rivals', camp.mode === 'hotseat' ? 'Player 2' : 'The other forces on this world',
      '<div class="cmodal-scroll">' + (camp.mode === 'hotseat' ? companyPanel(B, 'B')
        : rivals.map(function (co, i) { return rivalPanel(co, i); }).join('')) + '</div>');
    if (camp.log.length) {
      h += '<h3>Recent battles</h3><div class="clog">';
      camp.log.slice(-6).reverse().forEach(function (l) {
        h += '<div class="crow"><b>' + l.turn + '</b>' +
          '<span>' + esc(C.SCENARIO_NAMES[l.scenario] || l.scenario) + ', Tier ' + ROMAN[l.tier] + ' PL' + l.pl + '</span>' +
          '<em>' + (l.winner === 'A' ? 'won' : l.winner === 'B' ? 'lost' : 'drawn') + '</em>' +
          '<span class="cmoney">+' + l.kUC.A + ' ' + coin() + '</span></div>';
      });
      h += '</div>';
    }
    h += '<p class="camp-foot">' +
      '<button class="lnk" data-go="menu">← Main menu</button>' +
      '<input type="file" id="camp-file" accept="application/json" hidden></p>';
    return h;
  }

  /* One row under the name: the dossier, the save file out and in, and the
     contract, which is what the screen is for. */
  function hubBar() {
    var h = '';
    h += '<div class="hubbar">' +
      '<button class="lnk' + (hubPane === 'dossier' ? ' on' : '') + '" data-go="roster" aria-pressed="' + (hubPane === 'dossier') + '">Dossier</button>' +
      '<button class="lnk hubicon" data-go="export" title="Save to a file" aria-label="Save to a file">' + ICON_SAVE + '</button>' +
      '<button class="lnk hubicon" data-go="import" title="Load a file" aria-label="Load a file">' + ICON_LOAD + '</button>' +
      '<button class="start hubgo" data-go="' + (camp.mode === 'solo' ? 'offers' : 'contract') + '">Contract</button></div>';
    return h;
  }
  function companyPanel(co, side, bar) {
    var h = '<div class="cpan cpan-' + side + '"' + stripe(co) + '>';
    h += '<div class="cphead">' + tierBadge(co, !!bar && side === 'A') + '<b>' + esc(co.name) + '</b>' +
      (co.aspiring ? '<span class="ctier">aspiring</span>' : '') +
      '<span class="cmoney">' + co.kUC + ' ' + C.money(co) + '</span></div>';
    // the colours, dropped down under your own badge
    if (bar && side === 'A' && colourOpen) {
      h += '<div class="found-pop tierpop"><label>' + esc(C.words(co).Force + ' colours \u2014 ' + colourName(colourOf(co))) +
        '</label>' + squares(colourOf(co)) + '</div>';
    }
    h += (bar || '') + statRow(co);
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
    h += bar && side === 'A' && hubPane === 'dossier' ? dossierPanel(co) : promotionPanel(co, side, !!bar);
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
    var quit = hub ? '<button class="lnk warn cprom-quit" data-go="wipe">Abandon</button>' : '';
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
      return '<button type="button" class="tierbadge tierpick"' + st + ' data-go="fcolour" aria-expanded="' + colourOpen + '" title="' +
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
  /* What the force is like: what it fields, the best it has, and how it fights. */
  function rivalBlurb(co) {
    var n = co.roster.length, inf = 0, veh = 0, air = 0, best = null;
    co.roster.forEach(function (e) {
      var p = profile(e.key);
      if (!p) return;
      if (/air/.test(p.cls || '')) air++; else if (/vehicle|walker/.test(p.cls || '')) veh++; else inf++;
      if (!best || p.tier > profile(best.key).tier || (p.tier === profile(best.key).tier && e.exp > best.exp)) best = e;
    });
    var parts = [];
    if (inf) parts.push(inf + ' on foot');
    if (veh) parts.push(veh + (veh === 1 ? ' vehicle' : ' vehicles'));
    if (air) parts.push(air + ' in the air');
    var t = C.themeOf(co);
    if (n) {
      var bp = best ? profile(best.key) : null;
      t = 'It fields ' + n + ' unit' + (n === 1 ? '' : 's') +
        (parts.length > 1 ? ' (' + parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] + ')' : '') +
        (bp ? '; the pick of them is ' + (/^[aeiou]/i.test(bp.name) ? 'an ' : 'a ') + esc(bp.name) + ' at Tier ' + ROMAN[bp.tier] : '') + '. ' + t;
    }
    var r = co.record || {};
    if (r.battles) t += ' It has fought ' + r.battles + ' battle' + (r.battles === 1 ? '' : 's') + ' against you and won ' + (r.wins || 0) + '.';
    else t += ' It has not met you in the field yet.';
    return t;
  }
  /* Won, veterancy and trauma (or the swarm's and the tribe's words for them), one row. */
  function statRow(co, rival) {
    var wn = C.winStats(co), ex = C.experienceStats(co), tr = C.traumaStats(co);
    function pc(x) { return Math.round(x * 1000) / 10 + '%'; }
    function cell(cls, pct, word) {
      return '<div class="cstat ' + cls + '"><b>' + pct + '</b><span>' + esc(word) + '</span></div>';
    }
    return '<div class="cstats">' +
      cell('cs-win', pc(wn.pct), rival ? 'won vs you' : 'win rate') +
      cell('cs-exp', pc(ex.pct), ex.word) +
      cell('cs-tra', pc(tr.pct), tr.word) +
      '</div>';
  }

  function rivalPanel(co, idx) {
    // no 'next' on any of them: the player picks the contract, and with it who they meet
    var h = '<div class="cpan cpan-B"' + stripe(co) + '><div class="cphead">' + tierBadge(co) + '<b>' +
      esc(co.name) + '</b></div>';
    h += statRow(co, true);
    // the kind of force, and its doctrines beside it on the one line
    h += '<div class="cpdoc carch">' + armyPill(co) + co.doctrines.map(function (d) {
      return '<span class="mk" ' + tip(C.doctrine(d).name, C.doctrine(d).text) + '>' + esc(C.doctrine(d).name) + '</span>';
    }).join('') + '</div>';
    h += '<div class="cpstat">' + rivalBlurb(co) + '</div>';
    h += '<button class="lnk" data-go="intel" data-rival="' + (idx == null ? 0 : idx) +
      '">Their dossier</button></div>';
    return h;
  }

  /* ================= founding ================= */
  function beginFounding(name, mode, faction) {
    camp = C.newCampaign({
      mode: mode, nameA: name, nameB: rivalName(),
      factionA: faction || 'pmc', factionB: faction || 'pmc'
    });
    /* The name and the colours are settled on the founding screen, alongside the
       units — they are the three things that make a company yours, and asking
       for them in one place is how a player thinks about it. */
    draft = { side: 'A', keys: [], doctrine: null, name: name, colour: startingColour(faction) };
    view = 'found';
  }
  /* Hotseat: the second player founds a force of their own on the same screen,
     once the first has signed — their own army, name, colours, units and
     doctrine. Until they have, the campaign waits for them, even across a
     reload. */
  function needsSecond() {
    return !!(camp && camp.mode === 'hotseat' && camp.companies.A.roster.length &&
      !(camp.companies.B && camp.companies.B.roster.length));
  }
  function beginSecond(faction) {
    var A = camp.companies.A;
    var B = C.newCompany('', { faction: faction || (camp.companies.B && camp.companies.B.faction) || A.faction });
    camp.companies.B = B; camp.rivals = [B]; camp.facing = 0;
    draft = { side: 'B', keys: [], doctrine: null, name: '', colour: B.faction === 'bugs' && A.colour !== 'olive' ? 'olive' : freeColour([A.colour]) };
    view = 'found';
  }
  var secondFaction = null;       // what the hub said the second player runs, until they found it
  var FACTION_CHOICES = [['pmc', 'A private military company'], ['rebel', 'An insurgent revolt'],
    ['bugs', 'A Space Bug swarm'], ['xeno', 'A Xenotripod tribe']];
  // the colour the player last painted a force in, or the house ochre
  function startingColour(faction) {
    var c = null;
    try { c = localStorage.getItem('pmc-colour'); } catch (e) { }
    // a swarm's shells are olive drab unless a colour has been chosen before
    return (root.PMCIso && root.PMCIso.COLOURS[c]) ? c : faction === 'bugs' ? 'olive' : 'ochre';
  }
  function colourKeys() {
    return (root.PMCIso && root.PMCIso.COLOUR_KEYS) || ['ochre'];
  }
  // a small bar of a force's colours, to sit beside its name
  function colourFlash(co) {
    var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
    var c = CO[colourOf(co)];
    if (!c) return '';
    return '<span class="cflash" title="' + esc(c.name) + '" style="background:linear-gradient(135deg,' +
      c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span>';
  }
  function colourOf(co) {
    var k = co && co.colour;
    return (root.PMCIso && root.PMCIso.COLOURS[k]) ? k : 'ochre';
  }
  // a colour for the opposition: anything the player is not already wearing
  function freeColour(taken) {
    var free = colourKeys().filter(function (k) { return (taken || []).indexOf(k) < 0; });
    if (!free.length) free = colourKeys();
    return free[Math.floor(Math.random() * free.length)];
  }
  // a swatch row, as used on the founding screen
  function squares(pick) {
    var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
    return '<div class="csw">' + colourKeys().map(function (k) {
      var c = CO[k];
      return '<button type="button"' + (k === pick ? ' class="on"' : '') + ' data-campcolour="' + k + '" title="' + esc(c.name) + '">' +
        '<span style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span></button>';
    }).join('') + '</div>';
  }
  function colourName(k) {
    var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
    return CO[k] ? CO[k].name : 'Choose a colour';
  }
  /* A list opened over the page (the founding screen's pickers, the hub's
     rivals): drawn with the page, hidden unless open, so a pick made in it
     redraws it along with everything else. */
  var openModal = null, modalView = null, colourOpen = false;
  function cmodal(kind, title, inner, foot) {
    return '<div class="cmodal" data-modal="' + kind + '"' + (openModal === kind ? '' : ' hidden') + '>' +
      '<div class="cmodal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<h3>' + esc(title) + '</h3>' + inner +
      '<div class="askrow">' + (foot || '') + '<button type="button" class="start" data-go="fmodalclose">Done</button></div></div></div>';
  }
  function rivalName() { return 'Rival company'; }
  // what this campaign calls its money, and what its creed is called
  function coin() { return C.money(camp && camp.companies ? camp.companies.A : null); }
  function creed() { return C.creedOf(camp && camp.companies ? camp.companies.A : null); }
  function isRebel() { return !!(camp && camp.companies && camp.companies.A.faction === 'rebel'); }

  function foundView() {
    var side = draft.side || 'A', co = camp.companies[side];
    var hot = camp.mode === 'hotseat';
    var t1 = 0, t2 = 0, machines = 0;
    draft.keys.forEach(function (k) {
      var p = profile(R.splitPick(k).key);
      if (p.tier === 1) t1++; else if (p.tier === 2) t2++;
      if (p.cls !== 'infantry') machines++;
    });
    var reb = co.faction === 'rebel', bug = co.faction === 'bugs', xen = co.faction === 'xeno';
    function say(pmc, rebel, bugs, xeno) { return xen ? (xeno || bugs) : bug ? bugs : reb ? rebel : pmc; }
    var h = '<h2>' + (hot ? 'Player ' + (side === 'A' ? 1 : 2) + ' \u2014 ' : '') +
      say('Found a company', 'Raise a revolt', 'Awaken a swarm', 'Claim a territory') + '</h2>';
    if (hot && side === 'B') {
      /* The second player picks their own kind of force: the first player's
         choice on the hub only ever named the first force. */
      h += '<p class="lede">' + esc(camp.companies.A.name) + ' has signed. Now the other force on this world \u2014 yours.</p>' +
        '<div class="field"><label>What you are running</label><div class="docpick facpick">' +
        FACTION_CHOICES.map(function (f) {
          return '<button class="doc' + (co.faction === f[0] ? ' on' : '') + '" data-bfaction="' + f[0] + '"><b>' + esc(f[1]) + '</b></button>';
        }).join('') + '</div></div>';
    }
    /* Who you are, before what you field: the name it will be known by and the
       colours it paints its kit in. The opposition takes a colour of its own
       from whatever is left, so no two forces on a table ever match. */
    var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, cc = CO[draft.colour];
    h += '<div class="muster foundid found-id">' +
      // no label over it: the chip and the box speak for themselves (it stays for screen readers)
      '<div class="field"><label for="found-name" class="sr-only">' +
      say('Company name', 'What the revolt calls itself', 'What the swarm is known as', 'What the tribe is known as') + '</label>' +
      // the colour picked, a chip left of the name: tap it for the colours
      '<div class="name-row"><button type="button" class="chip-btn" data-go="fcolour" aria-expanded="' + colourOpen + '"' +
      ' title="' + esc('Colours: ' + colourName(draft.colour)) + '"><span' + (cc ? ' style="background:linear-gradient(135deg,' +
      cc.light + ' 0 38%,' + cc.mid + ' 38% 74%,' + cc.dark + ' 74%)"' : '') + '></span></button>' +
      '<input class="tin" id="found-name" maxlength="28" autocomplete="off"' +
      ' placeholder="' + say('e.g. Task Force Ironhold', 'e.g. The Free Colonies', 'e.g. The Hive', 'e.g. The Ghadon Third') + '"' +
      ' value="' + esc(draft.name || '') + '"></div></div>' +
      // the colours a square each, as the unit viewer has them, dropped down under the chip
      (colourOpen ? '<div class="found-pop"><label>' + say('Company colours', 'Colours of the revolt', 'Colour of the swarm\u2019s shells', 'The light in the tribe\u2019s armour') +
        ' \u2014 ' + esc(colourName(draft.colour)) + '</label>' + squares(draft.colour) + '</div>' : '') +
      '</div>';
    var head = '<div class="muster-head"><b>' + say('The company', 'The revolt', 'The swarm', 'The tribe') + '</b>' +
      '<span class="pts' + (t1 === 6 && t2 === 2 ? '' : ' over') + '">' +
      t1 + '/6 Tier I · ' + t2 + '/2 Tier II · ' + machines + '/2 vehicles</span></div>';
    var chosen = draft.keys.map(function (k, i) {
      var s = R.splitPick(k), p = profile(s.key);
      return '<span class="pickwrap"><button class="pick" data-drop="' + i + '">' +
        esc(p.name) + ' <b>' + ROMAN[p.tier] + '</b></button>' +
        (R.propsFor(p).length ? '<button class="drive" data-cycle="' + i + '">' +
          R.PROPULSION[s.prop || 'none'].short + '</button>' : '') +
        (R.canBeDrone(p) ? '<button class="drive' + (s.drone ? ' on' : '') + '" data-fdrone="' + i +
          '" title="Drone Control: +1 Structure, no crew, never earns experience — but Hackers can reach it">' +
          (s.drone ? 'DRN' : 'crew') + '</button>' : '') + '</span>';
    }).join('');
    h += '<div class="muster found-units">' + head +
      '<div class="chosen" id="found-chosen">' + chosen + '</div>' +
      '<button type="button" class="lnk found-add" data-go="fmodal" data-kind="units">+ Add units</button></div>';

    var cr = C.creedOf(co), doc = draft.doctrine && C.doctrine(draft.doctrine);
    h += '<div class="field"><label>Starting ' + cr.one + '</label>' +
      '<button type="button" class="archline" data-go="fmodal" data-kind="doctrine">' +
      '<span>' + (doc ? esc(doc.name) : 'Choose ' + (bug ? 'an ' : 'a ') + cr.one) + '</span>' +
      '<em>' + (doc ? 'change' : 'tap to select') + '</em></button></div>';

    // the three pickers, each a modal over the page
    h += cmodal('units', say('The company', 'The revolt', 'The swarm', 'The tribe'),
      head + '<div class="chosen">' + chosen + '</div>' +
      '<div class="cat cmodal-scroll" id="found-cat">' + catalogueFor(1, 2, function (p) {
        // a Tier II machine cannot be fielded in the Tier I battles a new force starts in
        return !p.leaderBug && !p.alpha && !(p.tier === 2 && p.cls !== 'infantry');
      }, co) + '</div>');
    h += cmodal('doctrine', 'Starting ' + cr.one, '<div class="cmodal-scroll"><div class="docpick">' + cr.list.map(function (d) {
      return '<button class="doc' + (draft.doctrine === d.id ? ' on' : '') + '" data-doc="' + d.id + '">' +
        '<b>' + esc(d.name) + '</b><i>' + say(d.cat, 'Path of the ' + d.cat, d.cat + ' Pathway', d.cat + ' Advancement') + '</i>' +
        '<span>' + esc(d.text) + '</span></button>';
    }).join('') + '</div></div>');

    var named = !!(draft.name || '').trim();
    var chk = { ok: t1 === 6 && t2 === 2 && machines <= 2 && draft.doctrine && named };
    h += '<p class="faults' + (chk.ok ? ' ok' : '') + '">' + (chk.ok
      ? (xen ? 'Ready. The Alpha squad joins free, at the Tribe Tier, and grows with it.'
        : bug ? 'Ready. The Leader Bug joins free, at the Swarm Tier, and grows with it.'
        : reb ? 'Ready. The First Among Equals who started it joins free, at the Revolt Tier.'
        : 'Ready. The field command is added free, at the Company Tier.')
      : !named ? say('The company needs a name.', 'The revolt needs a name.', 'The swarm needs a name.', 'The tribe needs a name.')
        : 'Six Tier I units, two Tier II, at most two vehicles, one ' + C.creedOf(co).one + '.') + '</p>';
    h += '<button class="start" data-go="dofound"' + (chk.ok ? '' : ' disabled') + '>' +
      say('Sign the charter', 'Raise the banner', 'Wake the hive', 'Claim the ground') + '</button>';
    // the second player cannot step back out: the campaign needs their force
    if (!(hot && side === 'B')) h += '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
    return h;
  }

  // which list a force recruits from — a company only ever hires its own kind
  function ourList(co) {
    var a = co || (camp && camp.companies ? camp.companies.A : null);
    return R.listFor((a && a.faction) || 'pmc');
  }

  /* the catalogue, limited to the Tiers a screen allows */
  function catalogueFor(minTier, maxTier, filter, co) {
    var groups = {}, order = [];
    ourList(co).forEach(function (p) {
      if (p.tier < minTier || p.tier > maxTier) return;
      if (p.command) return;                       // the field command is free and fixed
      if (filter && !filter(p)) return;
      if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); }
      groups[p.group].push(p);
    });
    var h = '';
    order.forEach(function (g) {
      h += '<h4>' + esc(g) + '</h4>';
      groups[g].forEach(function (p) {
        h += '<button class="cu" data-add="' + p.key + '">' +
          '<span class="t">' + ROMAN[p.tier] + '</span>' +
          '<span><b>' + esc(p.name) + '</b><small>' + esc(statLine(p)) + '</small></span>' +
          '<span class="st">' + (p.cls === 'infantry' ? p.size + ' men' : p.cls) + '</span></button>';
      });
    });
    return h;
  }
  function statLine(p) {
    if (p.cls === 'infantry') {
      return 'Move ' + p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') + ' · ' + (p.fp == null ? 'Assault only' : 'FP ' + p.fp + ' · Range ' + p.range + '"') + ' · Def ' + p.def +
        ' · Assault ' + p.assault + ' · Morale ' + p.morale;
    }
    return 'Move ' + p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') + ' · ' + (p.fp == null ? 'Assault only' : 'FP ' + p.fp + ' · Range ' + p.range + '"') + ' · Def ' + p.def +
      ' · Assault ' + p.assault + ' · Structure ' + p.str;
  }

  /* ================= the dossier ================= */
  function rosterTabs(co) {
    return '<div class="dtabs">' +
      '<button class="lnk' + (rosterTab === 'units' ? ' on' : '') + '" data-rtab="units">Units</button>' +
      '<button class="lnk' + (rosterTab === 'spend' ? ' on' : '') + '" data-rtab="spend">Spend EXP</button>' +
      '<button class="lnk' + (rosterTab === 'recruit' ? ' on' : '') + '" data-rtab="recruit">' + C.words(co).recruit + '</button>' +
      '<button class="lnk' + (rosterTab === 'memorial' ? ' on' : '') + '" data-rtab="memorial">Memorial</button>' +
      '</div>';
  }
  function rosterBody(co) {
    var h = '';
    if (rosterTab === 'units') {
      // every unit on the books has its soldiers named; an old save gets them now
      var named = false;
      co.roster.forEach(function (e) { if (C.menOf(e, co)) named = true; });
      if (named) save();
      h += '<div class="dlist">';
      co.roster.slice().sort(function (a, b) {
        return profile(b.key).tier - profile(a.key).tier || b.exp - a.exp;
      }).forEach(function (e) {
        var acts = '<button class="lnk" data-rename="' + e.rid + '">Rename</button>';
        var open = !!menOpen[e.rid];
        acts += '<button class="lnk" data-men="' + e.rid + '" aria-expanded="' + open + '">' +
          (open ? '\u25be ' : '\u25b8 ') + 'Details</button>';
        var dis = C.canDisband(co, e);
        acts += '<button class="lnk warn" data-disband="' + e.rid + '"' + (dis.ok ? '' : ' disabled title="' + esc(dis.why) + '"') + '>Disband</button>';
        h += entryCard(e, co, { actions: acts, men: open ? detailPanel(e, co) : '' });
        if (e.history && e.history.length) {
          h += '<div class="dhist">' + e.history.slice(-3).map(esc).join(' · ') + '</div>';
        }
      });
      h += '</div>';
    } else if (rosterTab === 'memorial') {
      h += memorialList(co);
    } else if (rosterTab === 'spend') {
      h += spendList(co);
    } else {
      h += recruitList(co);
    }
    return h;
  }
  /* On the hub the dossier takes the place of the Tier panel, in the same
     box: its tabs across the top and the list scrolling under them. */
  function dossierPanel(co) {
    return '<div class="cprom cdos"><div class="cprom-head"><b>Dossier</b><span class="cprom-count">' +
      C.words(co).tier + ' Tier ' + ROMAN[co.tier] + ' · ' + co.roster.length + ' units on the books</span></div>' + rosterTabs(co) + '<div class="cprom-list cdos-body">' + rosterBody(co) + '</div></div>';
  }
  var hubPane = 'tier';
  var rosterTab = 'units';
  /* Every soldier the force has lost in the campaign, most recent battle
     first: who they were, what they served in, and where they fell. */
  /* The loss rate: every model lost against every model that has ever served,
     replacements included. */
  /* The loss rate: everything lost against everything that has ever served,
     replacements included — soldiers, the tribe's warriors, or the swarm's
     biomass. */
  // the experience rate: honours held against units on the books
  // ...and the trauma rate beside it: traumas carried against units on the books
  function expLine(co) {
    var st = C.experienceStats(co), tr = C.traumaStats(co), wn = C.winStats(co);
    // the win rate leads, once there has been a battle to win
    var won = wn.battles ? '<div class="dloss dexpr dwin"><b>' + Math.round(wn.pct * 1000) / 10 + '%</b> won <span>' +
      wn.wins + ' of ' + wn.battles + (wn.battles === 1 ? ' battle' : ' battles') + '</span></div>' : '';
    if (!st.units) return won;
    function line(cls, pct, word, n, noun) {
      return '<div class="dloss ' + cls + '"><b>' + Math.round(pct * 1000) / 10 + '%</b> ' + word + ' <span>' + n + ' ' +
        esc(noun) + ' across ' + st.units + (st.units === 1 ? ' unit' : ' units') + '</span></div>';
    }
    return won + line('dexpr', st.pct, st.word, st.honours, st.noun) + line('dexpr dtrau', tr.pct, tr.word, tr.traumas, tr.noun);
  }
  function lossLine(co) {
    return C.lossStats(co).map(function (st) {
      if (!st.served) return '';
      var pct = Math.round(st.pct * 1000) / 10;
      return '<div class="dloss"><b>' + pct + '%</b> lost <span>' + st.lost + ' of ' + st.served + ' ' + st.unit + '</span></div>';
    }).join('');
  }
  function memorialList(co) {
    if (co.faction === 'bugs') return biomassList(co);
    var list = co.memorial || [];
    if (!list.length) return lossLine(co) + '<p class="dnote">No one has been lost yet.</p>';
    var SCx = root.PMCScen, battles = {}, order = [];
    list.forEach(function (m) {
      if (!battles[m.battle]) { battles[m.battle] = []; order.push(m.battle); }
      battles[m.battle].push(m);
    });
    order.sort(function (a, b) { return b - a; });
    var h = lossLine(co);
    order.forEach(function (n) {
      var ms = battles[n], first = ms[0];
      var sc = SCx && SCx.SCENARIOS && SCx.SCENARIOS[first.scenario];
      h += '<div class="dmem"><div class="dmem-head">Campaign turn ' + n +
        (first.against ? ' · against ' + esc(first.against) : '') + (sc ? ' · ' + esc(sc.name) : '') +
        '<span class="mk">' + ms.reduce(function (k, m) { return k + (m.count || 1); }, 0) + '</span></div><ol class="dmem-list">' +
        ms.map(function (m) {
          if (m.anon) {
            return '<li><b>' + esc(m.type) + '</b> <span class="dmen-rank">\u00d7 ' + m.count + ' Esh-Aven</span>' +
              (m.unit && m.unit !== m.type ? '<span class="dmem-type">' + esc(m.unit) + '</span>' : '') + '</li>';
          }
          return '<li><span class="dmen-rank">' + esc(m.rank) + '</span> <b>' + esc(m.name) + '</b>' +
            '<span class="dmem-type">' + esc(m.type) + (m.unit && m.unit !== m.type ? ' \u00b7 ' + esc(m.unit) : '') +
            ' \u00b7 turn ' + (m.turn || 1) + ' of the battle</span></li>';
        }).join('') + '</ol></div>';
    });
    return h;
  }
  /* The swarm mourns no one: its memorial is the biomass it has spent over
     the campaign, totalled for each kind of bug. */
  function biomassList(co) {
    var bio = C.biomassTally(co), types = Object.keys(bio);
    if (!types.length) return lossLine(co) + '<p class="dnote">No biomass lost yet.</p>';
    types.sort(function (a, b) { return bio[b].mass - bio[a].mass || bio[b].models - bio[a].models || (a < b ? -1 : 1); });
    var total = types.reduce(function (n, t) { return n + bio[t].mass; }, 0);
    return lossLine(co) +
      '<div class="dmem"><div class="dmem-head">Biomass lost<span class="mk">' + total + '</span></div>' +
      '<ol class="dmem-list">' + types.map(function (t) {
        return '<li class="dmem-bio"><b>' + esc(t) + '</b><span class="dmen-rank">\u00d7 ' + bio[t].models +
          (bio[t].mass ? ' \u00b7 ' + bio[t].mass + ' biomass' : ' \u00b7 not biomass') + '</span></li>';
      }).join('') + '</ol></div>';
  }
  var menOpen = {};               // which units have their details open, by rid

  /* Everything about one unit, opened from its card: the profile as it takes
     the field — honours, traumas, upgrades and doctrines already worked in, with
     what they changed marked — its special rules spelled out, what it has
     earned and suffered, and its soldiers by name. The unit is built the way
     the battle builds it, so these are the numbers it will fight with. */
  function detailPanel(e, co) {
    var p = profile(e.key);
    if (!p) return '';
    var base = Object.assign({}, p, { rules: (p.rules || []).slice(), models: p.size, side: 'A', cargo: [] });
    base = R.applyDrone(R.applyPropulsion(base, e.prop || R.defaultDrive(p)), !!e.drone);
    var was = Object.assign({}, base, { rules: base.rules.slice() });
    var u = C.applyEntry(Object.assign({}, base, { rules: base.rules.slice() }), e, co.doctrines || []);
    var mach = p.cls !== 'infantry';
    function cell(label, now, then, fmt) {
      var v = now == null ? '\u2014' : fmt ? fmt(now) : now, d = now != null && then != null ? now - then : 0;
      return { label: label, v: v, d: d };
    }
    var inch = function (n) { return n + '"'; };
    var cols = [cell('Tier', u.tier, u.tier), cell(mach ? 'Size' : 'Men', mach ? 1 : u.size, mach ? 1 : was.size),
      cell('Move', u.move, was.move, inch), cell('FP', u.fp, was.fp), cell('Range', u.range || null, was.range || null, inch),
      cell('Def', u.def, was.def), cell('Asslt', u.assault, was.assault),
      mach ? cell('Str', u.str, was.str) : cell('Mor', u.morale, was.morale)];
    if (u.turn != null) cols.push(cell('Turn', u.turn, was.turn));
    var h = '<div class="ddet">';
    h += '<table class="ddet-stats"><tr>' + cols.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') +
      '</tr><tr>' + cols.map(function (c) {
        return '<td' + (c.d ? ' class="' + (c.d > 0 ? 'up' : 'down') + '"' : '') + '>' + esc(c.v) +
          (c.d ? '<sup>' + (c.d > 0 ? '+' : '') + c.d + '</sup>' : '') + '</td>';
      }).join('') + '</tr></table>';
    if (u.defPierced != null) h += '<p class="ddet-note">Defence ' + u.defPierced + ' against Anti-tank and Gauss weapons.</p>';

    var TXT = root.PMCRuleText;
    h += '<h5>Special rules</h5>';
    if (!u.rules.length) h += '<p class="ddet-note">None.</p>';
    else {
      h += '<ul class="ddet-rules">' + u.rules.map(function (r) {
        var d = TXT ? TXT.describe(r) : { name: r, text: '' };
        var gained = was.rules.indexOf(r) < 0;
        return '<li><b>' + esc(d.name) + '</b>' + (gained ? ' <span class="mk good">earned</span>' : '') +
          (d.text ? '<span>' + esc(d.text) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    function marks(title, list, table, cls) {
      if (!list || !list.length) return '';
      return '<h5>' + esc(title) + '</h5><ul class="ddet-rules">' + list.map(function (n) {
        var x = table[n - 1] || { name: '#' + n, text: '' };
        return '<li class="' + cls + '"><b>' + esc(x.name) + '</b><span>' + esc(x.text || '') + '</span></li>';
      }).join('') + '</ul>';
    }
    var W = C.words(co);
    h += marks(W.honours, e.honours, C.honourTable(e.key), 'good');
    h += marks('Upgrades', e.upgrades, C.upgradeTable(e.key), 'good');
    h += marks(W.traumas, e.traumas, C.traumaTable(e.key), 'bad');
    if (!(e.honours || []).length && !(e.traumas || []).length && !(e.upgrades || []).length) {
      h += '<p class="ddet-note">No ' + esc(W.honours) + ' or ' + esc(W.traumas) + ' yet.</p>';
    }
    if ((e.men || []).length) h += '<h5>' + (mach ? 'Crew' : 'Soldiers') + ' (' + e.men.length + ')</h5>' + menPanel(e);
    return h + '</div>';
  }

  // the soldiers of one unit, by rank and name, each of them renameable
  function menPanel(e) {
    return '<ol class="dmen">' + (e.men || []).map(function (m, i) {
      return '<li><span class="dmen-rank">' + esc(m.rank) + '</span>' +
        '<b class="dmen-name">' + esc(m.name) + '</b>' +
        '<button class="lnk" data-rsoldier="' + e.rid + '" data-i="' + i + '">Rename</button></li>';
    }).join('') + '</ol>';
  }

  function spendList(co) {
    var h = '<div class="dlist">';
    var any = false;
    co.roster.slice().sort(function (a, b) { return b.exp - a.exp; }).forEach(function (e) {
      var p = profile(e.key);
      if (C.isLeaderP(p)) return;
      if ((p.rules || []).indexOf('Turret') >= 0) return;            // turrets never earn EXP
      var acts = '';
      C.promotionTargets(e, co).forEach(function (q) {
        var c = C.promotionCost(e, q.key);
        var can = e.exp >= c.exp && co.kUC >= c.kUC;
        acts += '<button class="lnk" data-promote="' + e.rid + '" data-to="' + q.key + '"' +
          (can ? '' : ' disabled') + '>→ ' + esc(q.name) + ' · ' + c.exp + ' EXP' +
          (c.kUC ? ' + ' + c.kUC + ' ' + C.money(co) : '') + '</button>';
      });
      if (C.takesHonours(p)) {
        var hc = C.canTakeHonour(e, co);
        acts += '<button class="lnk good" data-honour="' + e.rid + '"' +
          (hc.ok ? '' : ' disabled title="' + esc(hc.why || '') + '"') + '>' + C.words(co).honour + ' · ' +
          C.honourCost(e, co) + ' EXP</button>';
      } else {
        var uc = C.canTakeUpgrade(e);
        acts += '<button class="lnk good" data-upgrade="' + e.rid + '"' +
          (uc.ok ? '' : ' disabled title="' + esc(uc.why || '') + '"') + '>Upgrade · 10 EXP</button>';
      }
      if (acts) { any = true; h += entryCard(e, co, { actions: acts }); }
    });
    h += '</div>';
    if (!any) h += '<p class="dnote">Nothing to spend on yet — units earn experience by fighting.</p>';
    return h;
  }

  function recruitList(co) {
    var top = Math.min(5, co.tier + 2);
    var h = '<p class="dnote">A Tier ' + ROMAN[co.tier] + ' ' + C.words(co).force + ' may ' + C.words(co).recruit.toLowerCase() + ' up to Tier ' +
      ROMAN[top] + '. ' + co.kUC + ' ' + C.money(co) + ' in hand.</p>';
    h += '<div class="cat tall">';
    var groups = {}, order = [];
    ourList().forEach(function (p) {
      if (p.tier > top) return;
      if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); }
      groups[p.group].push(p);
    });
    order.forEach(function (g) {
      h += '<h4>' + esc(g) + '</h4>';
      groups[g].forEach(function (p) {
        var chk = C.canRecruit(co, p.key);
        var cost = C.recruitCost(co, p.key);
        h += '<button class="cu" data-recruit="' + p.key + '"' +
          (chk.ok ? '' : ' disabled title="' + esc(chk.why) + '"') + '>' +
          '<span class="t">' + ROMAN[p.tier] + '</span>' +
          '<span><b>' + esc(p.name) + '</b><small>' + esc(statLine(p)) + '</small></span>' +
          '<span class="st">' + (cost ? cost + ' ' + C.money(co) : 'free') + '</span></button>';
        // the same hull or craft, flown remotely (p. 37)
        if (R.canBeDrone(p)) h += '<button class="cu cu-drone" data-recruit="' + p.key + '" data-asdrone="1"' +
          (chk.ok ? '' : ' disabled') + '><span class="t">' + ROMAN[p.tier] + '</span>' +
          '<span><b>' + esc(p.name) + ' — drone</b><small>+1 Structure, no crew, no experience; can be hacked</small></span>' +
          '<span class="st">' + (cost ? cost + ' ' + C.money(co) : 'free') + '</span></button>';
      });
    });
    h += '</div>';
    return h;
  }

  /* ================= the contract ================= */
  /* ================= the contracts on offer =================
     Three forces are on this world, and three jobs are on the table. Each names
     the enemy, how they fight, what the fighting is for and — where the scenario
     has an attacker and a defender — which of the two you would be. What it does
     not name is a single unit of theirs: you learn that when they arrive.

     The offers are rolled once a campaign turn and kept, so leaving the screen
     and coming back cannot be used to fish for an easier job. */
  function offersView() {
    var A = camp.companies.A;
    var offers = C.rollOffers(camp);
    var h = '<h2>Contracts on offer</h2>';
    h += '<p class="lede">Three forces are fighting over this world and all three will ' +
      'take you on. Pick your war: you are told who they are and what the battle is for, ' +
      'but not a thing about what they will bring to it.</p>';
    offers.forEach(function (o, i) { h += offerPanel(o, i); });
    h += '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
    return h;
  }

  function offerPanel(o, i) {
    var co = (camp.rivals || [camp.companies.B])[o.rival] || camp.companies.B;
    var a = C.archetype(co.archetype);
    var SC = root.PMCScen, sc = SC && SC.SCENARIOS[o.scenario.id];
    var creedName = co.faction === 'rebel' ? 'Paths' : co.faction === 'bugs' ? 'Evolutionary Pathways' : co.faction === 'xeno' ? 'Tribe Advancements' : 'Doctrines';
    var h = '<div class="cpan cpan-B cpan-offer"><div class="cphead">' + colourFlash(co) + '<b>' + esc(co.name) + '</b>' +
      '<span class="mk">' + C.words(co).side + '</span>' +
      '<span class="ctier">' + C.words(co).tier + ' Tier ' +
      ROMAN[co.tier] + '</span></div>';
    // how they fight, and what they are built around — never what they field
    h += '<div class="cpstat">' + esc(C.themeOf(co)) + '</div>';
    h += '<div class="cpstat">' + creedName + ': ' + (co.doctrines.length
      ? co.doctrines.map(function (d) { return esc(C.doctrine(d).name); }).join(' · ')
      : 'none declared yet') + '</div>';
    h += '<div class="cpdoc">' + co.doctrines.map(function (d) {
      return '<span class="mk" title="' + esc(C.doctrine(d).text) + '">' + esc(C.doctrine(d).text) + '</span>';
    }).join('') + '</div>';
    h += '<div class="cpstat">' + co.record.battles + ' battles against you · ' +
      co.record.wins + ' won, ' + co.record.losses + ' lost' +
      (o.caught && o.caught.to > o.caught.from
        ? ' · fighting elsewhere since you last met — Tier ' + ROMAN[o.caught.from] +
          ' to ' + ROMAN[o.caught.to]
        : '') + '</div>';

    // the job itself
    h += '<div class="offer-job"><div class="offer-scen"><b>' + esc(o.scenario.name) + '</b>' +
      '<span class="mk">Scenario D6 ' + o.scenario.roll + '</span></div>';
    /* How big a fight this pairing can actually put on: the Battle Tier the D6
       gave this job, and the ceiling the two rosters between them could reach. */
    h += '<div class="offer-size"><span>Battle Tier <b>' + ROMAN[o.tier] + '</b></span>' +
      '<span>Priority Level <b>' + (o.levels.length ? o.levels.join(' or ') : '1') + '</b></span>' +
      '<span class="offer-cap">most they can meet you at: Tier ' + ROMAN[o.capTier] +
      ', PL ' + (o.capLevels.length ? o.capLevels[o.capLevels.length - 1] : 1) + '</span></div>';
    if (sc) h += '<div class="cpstat">' + esc(sc.blurb) + '</div>';
    if (o.roles) {
      var mine = o.roles.attacker === 'A' ? 'attacker' : 'defender';
      h += '<div class="offer-role role-' + mine + '">You ' +
        (mine === 'attacker' ? 'attack' : 'defend') + '</div>';
      h += '<div class="cpstat">' + esc(sc ? sc.roles[mine] : '') +
        (o.roles.bestDefence && o.roles.bestDefence.swapped && o.roles.bestDefence.side === 'A'
          ? ' <b>The Best Defence is Good Offence</b> pushed the attack onto them (D6 ' +
            o.roles.bestDefence.roll + ').'
          : '') + '</div>';
    } else {
      h += '<div class="cpstat">Neither side has the initiative here — you meet on even terms.</div>';
    }
    h += '<div class="cpstat">' + esc(sc ? sc.win : '') + '</div>';
    h += '</div>';
    h += '<button class="start" data-take-offer="' + i + '">Take this contract</button>';
    return h + '</div>';
  }

  /* What a unit is carrying, on the button that picks it for a battle: the
     experience it has banked and — the thing that decides whether to give it the
     day off — how close it is to its next Battle Trauma (p. 85). A unit hits a
     Trauma at 10 Trauma Points, 15 with Mental Training, and taking it into
     another fight is what pushes it over. */
  function wear(e) {
    var co = camp.companies.A, wd = C.words(co);
    var cap = C.traumaThreshold(co);
    var tp = e.tp || 0;
    var near = tp >= cap - 2;
    var h = '<span class="wear">';
    if (e.exp) h += '<span class="w-exp">' + e.exp + ' EXP</span>';
    h += '<span class="w-tp' + (near ? ' hot' : '') + '" ' + tip('Trauma Points',
      tp + ' of ' + cap + '. A unit that reaches ' + cap + ' rolls on the ' + wd.trauma + ' ' +
      'table and the count starts again.') + '>' + tp + '/' + cap + ' TP</span>';
    if ((e.traumas || []).length) {
      h += '<span class="w-tr" ' + tip(
        e.traumas.length === 1 ? wd.trauma : e.traumas.length + ' ' + wd.traumas,
        spellOut(e.traumas, C.traumaTable(e.key))) + '>' +
        e.traumas.length + ' trauma' + (e.traumas.length > 1 ? 's' : '') + '</span>';
    }
    if ((e.honours || []).length) {
      h += '<span class="w-hon" ' + tip(
        e.honours.length === 1 ? wd.honour : e.honours.length + ' ' + wd.honours,
        spellOut(e.honours, C.honourTable(e.key))) + '>' +
        e.honours.length + ' honour' + (e.honours.length > 1 ? 's' : '') + '</span>';
    }
    return h + '</span>';
  }

  function beginContract() {
    var A = camp.companies.A;
    /* Whichever force is drawn has been fighting elsewhere, and comes to meet you
       at something like your own standing — give or take a Tier, and never more
       than one above you. */
    var B = camp.companies.B;
    var caught = null;
    if (camp.rivals && camp.rivals.length) {
      B = camp.companies.B;
      var want = C.catchUpTarget(A.tier);
      if (B.tier < want) caught = C.catchUp(B, want);
    }
    var tier = C.rollBattleTier(A, B);
    var scen = C.rollScenario(false);        // a D6 across all six, whatever the Tier
    var alt = C.hasDoctrine(A, 'XO3') ? C.rollScenario(false) : null;
    var levels = C.levelsFor(A, B, tier.tier);
    contract = {
      pl: levels.length ? levels[levels.length - 1] : 1,
      levels: levels,
      tierRoll: tier, tier: tier.tier, scenario: scen, planet: 'random', alt: alt,
      picks: [], adjusted: false, caught: caught
    };
    view = 'contract';
  }

  /* The player has picked one of the three. The job was settled when it was
     offered — the enemy, the scenario, the Battle Tier and which side of the
     fight they are on — so nothing is rolled again here. */
  function takeOffer(i) {
    var offers = C.rollOffers(camp);
    var o = offers[Math.max(0, Math.min(offers.length - 1, i | 0))];
    if (!o) return;
    C.faceRival(camp, o.rival);
    contract = {
      pl: o.levels.length ? o.levels[o.levels.length - 1] : 1,
      levels: o.levels,
      tierRoll: o.tierRoll, tier: o.tier, scenario: o.scenario, planet: 'random',
      roles: o.roles, alt: o.alt || null, altRoles: o.altRoles || null,
      picks: [], adjusted: false, caught: o.caught
    };
    save();
    view = 'contract';
  }

  /* Which faults are hard. A missing minimum is fixable by adding more units; a
     cap, a budget or a Tier restriction is not, and the unit causing it has to go. */
  function blocking(faults) {
    return (faults || []).filter(function (f) {
      return !/Needs at least/.test(f) && !/No units chosen/.test(f);
    });
  }

  /* Could this company field *any* legal army for this contract? Uses the same greedy
     fill the rules engine uses, restricted to units not away being repaired. */
  function canEverField(co, tier, pl) {
    return C.canFieldArmy(co, tier, pl, true);
  }

  function contractPicks(co, tier, pl) {
    return co.roster.filter(function (e) { return !(e.restUntil > 0); });
  }

  /* Drug Dealer (p. 112): "Before each battle, the player may choose up to 1/3
     of infantry units" — chosen here, with the list. */
  function ordersPanel(co) {
    var rows = [];
    if (C.hasDoctrine(co, 'V4')) {
      var able = drugAble(contract.picks), cap = Math.floor(able.length / 3);
      contract.drugs = (contract.drugs || []).filter(function (id) { return able.some(function (e) { return e.rid === id; }); }).slice(0, cap);
      rows.push('<div class="orow"><b>Drug Dealer</b><em>Up to ' + cap + ' of the infantry go in Determined, and take D6+1 Trauma Points after (' +
        contract.drugs.length + ' of ' + cap + ')</em><span class="segs wrap">' +
        (able.length ? able.map(function (e) {
          var on = contract.drugs.indexOf(e.rid) >= 0;
          return '<button class="lnk' + (on ? ' on' : '') + '" data-drug="' + e.rid + '"' +
            (!on && contract.drugs.length >= cap ? ' disabled' : '') + '>' + esc(e.name) + '</button>';
        }).join('') : '<span class="dnote">No infantry in the list can take them.</span>') + '</span></div>');
    }
    return rows.length ? '<div class="cpan orders">' + rows.join('') + '</div>' : '';
  }
  function contractView() {
    var A = camp.companies.A, B = camp.companies.B;
    var keys = contract.picks.map(function (e) { return R.joinPick(e.key, e.prop, e.drone); });
    var chk = R.checkArmy(keys, contract.tier, contract.pl, A.doctrines, contract.tactic || null);
    var roll = contract.tierRoll;
    var h = '<h2>Contract</h2>';
    h += '<p class="lede">Against <b>' + esc(B.name) + '</b> — ' +
      C.words(B).side.toLowerCase() + ', ' +
      C.words(B).tier + ' Tier ' + ROMAN[B.tier] + '.<br>' +
      (contract.standard ? 'A standard contract' : 'Battle Tier D6 ' + roll.roll) +
      (!contract.standard && roll.tier < roll.roll
        ? ', held to Tier ' + ROMAN[roll.cap] + (roll.thin
          ? ' by what the two forces can actually put on the table'
          : ' by the weaker force\u2019s standing')
        : '') +
      ' — <b>Battle Tier ' + ROMAN[contract.tier] + '</b>. ' +
      'Scenario D6 ' + contract.scenario.roll + ' — <b>' + esc(contract.scenario.name) + '</b>.</p>';
    if (contract.alt && contract.alt.id === contract.scenario.id) {
      h += '<div class="cpan"><div class="cpstat">Foresighted Command — the second scenario die agreed: ' +
        esc(contract.alt.name) + ' it is.</div></div>';
    } else if (contract.alt) {
      h += '<div class="cpan"><div class="cpstat">Foresighted Command — the second scenario die showed ' +
        contract.alt.roll + ', <b>' + esc(contract.alt.name) + '</b>. The tribe may keep either.</div>' +
        '<button class="lnk" data-foresee="1">Fight ' + esc(contract.alt.name) + ' instead</button></div>';
    }
    /* Three of the six give one company the attack and the other the ground, and
       the two play nothing alike — so the force is chosen knowing which it is. */
    var SC = root.PMCScen, sc = SC && SC.SCENARIOS[contract.scenario.id];
    if (sc && sc.attacker) {
      var mine = contract.roles
        ? (contract.roles.attacker === 'A' ? 'attacker' : 'defender') : null;
      h += '<div class="cpdoc">' + (mine
        ? '<span class="offer-role role-' + mine + '">You ' +
          (mine === 'attacker' ? 'attack' : 'defend') + '</span>' +
          '<span class="mk">' + esc(sc.roles[mine]) +
          (contract.roles.bestDefence && contract.roles.bestDefence.swapped &&
            contract.roles.bestDefence.side === 'A'
            ? ' The Best Defence is Good Offence took the attack (D6 ' +
              contract.roles.bestDefence.roll + ').'
            : contract.roles.bestDefence && contract.roles.bestDefence.side === 'A' && contract.roles.bestDefence.roll
              ? ' The Best Defence is Good Offence: D6 ' + contract.roles.bestDefence.roll + ' — you stay the defender.' : '') + '</span>' +
          (contract.roles.bestDefence && contract.roles.bestDefence.pending && contract.roles.bestDefence.side === 'A'
            ? '<button class="lnk" data-go="bestdef">The Best Defence is Good Offence — roll to attack (2+)</button>' : '')
        : '<span class="mk">Attacker and defender are randomised when the battle opens. ' +
          esc(sc.roles.attacker) + ' ' + esc(sc.roles.defender) +
          (C.hasDoctrine(A, 'S1')
            ? ' The Best Defence is Good Offence gives you a 2+ to push the attack onto them if the roll makes you the defender.'
            : '') + '</span>') + '</div>';
    }
    /* Rebel Tactics (p. 95): chosen once the scenario and who attacks are known,
       before a piece of terrain goes down — so here, with the list. */
    if (A.faction === 'rebel') {
      h += '<div class="cpan orders"><div class="cprom-head"><b>Tactic</b></div><div class="orow">' +
        '<em>' + esc(contract.tactic ? R.tacticById(contract.tactic).text : 'A rebel force may take one tactic for the battle, or none.') + '</em>' +
        '<span class="segs">' + [{ id: '', name: 'No tactic' }].concat(R.TACTICS).map(function (t) {
          var on = (contract.tactic || '') === t.id;
          return '<button class="lnk' + (on ? ' on' : '') + '" data-tactic="' + t.id + '"' +
            (t.text ? ' ' + tip(t.name, t.text) : '') + '>' + esc(t.name) + '</button>';
        }).join('') + '</span></div></div>';
    }
    if (contract.caught && contract.caught.to > contract.caught.from) {
      h += '<div class="cpdoc"><span class="mk">' + esc(contract.caught.name) +
        ' has been fighting elsewhere — Tier ' + ROMAN[contract.caught.from] + ' to ' +
        ROMAN[contract.caught.to] + ' since you last met.</span></div>';
    }

    if (C.hasDoctrine(A, 'S4') && !contract.adjusted) {
      h += '<div class="cpdoc"><b>On Our Terms…</b> lets you shift the Battle Tier by one. ' +
        '<button class="lnk" data-tier="-1"' + (contract.tier <= 1 ? ' disabled' : '') + '>Down to ' + ROMAN[Math.max(1, contract.tier - 1)] + '</button> ' +
        '<button class="lnk" data-tier="1"' + (contract.tier >= contract.tierRoll.cap ? ' disabled' : '') + '>Up to ' + ROMAN[Math.min(5, contract.tier + 1)] + '</button></div>';
    }

    /* The standard contract (p. 84): Tier III, Priority Level 2, the Tier not
       rolled at all — when both forces can field it. */
    if (!contract.standard && C.canStandard(A, B) && !(contract.tier === 3 && contract.pl === 2)) {
      h += '<div class="cpdoc"><span class="mk">Both forces can field a Tier III army at Priority Level 2.</span> ' +
        '<button class="lnk" data-go="standard">Take a standard contract instead</button></div>';
    } else if (contract.standard) {
      h += '<div class="cpdoc"><span class="mk">Standard contract — Tier III, Priority Level 2.</span></div>';
    }
    // only offer a Priority Level both forces could actually fill
    var lv = contract.levels || [1, 2];
    var PLN = { 1: 'skirmish', 2: 'full battle', 3: 'large battle', 4: 'major battle' };
    h += '<div class="field two"><div><label for="camp-pl">Priority Level</label>' +
      '<select id="camp-pl"' + (contract.standard ? ' disabled' : '') + '>' + [1, 2, 3, 4].map(function (n) {
        var can = lv.indexOf(n) >= 0;
        if (!can && n > 2) return '';                 // the big ones only when someone can fill them
        return '<option value="' + n + '"' + (contract.pl === n ? ' selected' : '') +
          (can ? '' : ' disabled') + '>' + n + ' — ' + PLN[n] +
          (can ? '' : ' (neither force can fill it)') + '</option>';
      }).join('') + '</select></div>' +
      '<div><label for="camp-planet">Planet</label><select id="camp-planet">' +
      ['random', 'desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'].map(function (k) {
        return '<option value="' + k + '"' + (contract.planet === k ? ' selected' : '') + '>' +
          (k === 'random' ? 'Randomise' : k.charAt(0).toUpperCase() + k.slice(1)) + '</option>';
      }).join('') + '</select></div></div>';

    h += '<div class="muster"><div class="muster-head"><b>Take the field</b>' +
      '<span class="pts' + (chk.spent > chk.budget ? ' over' : '') + '">' + chk.spent + ' / ' + chk.budget + '</span></div>';
    h += '<div class="chosen">' + contract.picks.map(function (e, i) {
      var p = profile(e.key);
      return '<span class="pickwrap"><button class="pick" data-unpick="' + i + '">' +
        esc(e.name) + ' <b>' + ROMAN[p.tier] + '</b></button></span>';
    }).join('') + '</div>';
    h += '<p class="faults' + (chk.ok ? ' ok' : '') + '">' +
      (chk.ok ? 'A legal Battle Tier ' + ROMAN[contract.tier] + ' army.' : esc(chk.faults[0] || '')) + '</p>';
    h += '<div class="cat tall">';
    var avail = contractPicks(A).filter(function (e) { return contract.picks.indexOf(e) < 0; });
    if (!avail.length) h += '<p class="dnote">Every unit on the books is already in the list.</p>';
    avail.forEach(function (e) {
      var p = profile(e.key);
      var trial = keys.concat([R.joinPick(e.key, e.prop, e.drone)]);
      var bad = blocking(R.checkArmy(trial, contract.tier, contract.pl, A.doctrines, contract.tactic || null).faults);
      h += '<button class="cu" data-pick="' + e.rid + '"' +
        (bad.length ? ' disabled title="' + esc(bad[0]) + '"' : '') + '>' +
        '<span class="t">' + ROMAN[p.tier] + '</span>' +
        '<span><b>' + esc(e.name) + '</b>' + wear(e) + '<small>' + esc(p.name) +
        ((e.honours || []).length ? ' · <span ' + quietTip(C.words(A).honours, spellOut(e.honours, C.honourTable(e.key))) +
          '>' + esc(e.honours.map(function (n) { return C.honourTable(e.key)[n - 1].name; }).join(', ')) + '</span>' : '') +
        ((e.traumas || []).length ? ' · <span ' + quietTip(C.words(A).traumas, spellOut(e.traumas, C.traumaTable(e.key))) +
          '>' + esc(e.traumas.map(function (n) { return C.traumaTable(e.key)[n - 1].name; }).join(', ')) + '</span>' : '') +
        '</small></span><span class="st">' + (p.cls === 'infantry' ? p.size + ' men' : p.cls) + '</span></button>';
    });
    var resting = A.roster.filter(function (e) { return e.restUntil > 0; });
    if (resting.length) {
      h += '<h4>In the workshop — sitting this one out</h4>';
      resting.forEach(function (e) {
        h += '<button class="cu" disabled><span class="t">' + ROMAN[profile(e.key).tier] + '</span>' +
          '<span><b>' + esc(e.name) + '</b><small>salvaged from the last battle</small></span></button>';
      });
    }
    h += '</div></div>';
    h += ordersPanel(A);
    if (!chk.ok) {
      var why;
      if (blocking(chk.faults).length) {
        why = esc(chk.faults[0]) + ' Drop a unit, or change the list.';
      } else if (!canEverField(A, contract.tier, contract.pl)) {
        // the company simply does not own the units this contract asks for
        why = esc(chk.faults[0]) + ' ' + esc(A.name) + ' cannot field a legal army at Battle Tier ' +
          ROMAN[contract.tier] + ', Priority Level ' + contract.pl +
          (contract.pl > 1 ? ' — try Priority Level 1.' : ' — recruit or promote first, then come back.');
      } else {
        why = esc(chk.faults[0]) + ' Add more units.';
      }
      h += '<p class="blockwhy">' + why + '</p>';
    }
    h += '<button class="start" data-go="fight"' + (chk.ok ? '' : ' disabled') + '>Take the field</button>';
    h += '<p class="camp-foot"><button class="lnk" data-go="autopick">Fill the list for me</button>' +
      '<button class="lnk" data-go="hub">Back</button></p>';
    return h;
  }

  /* pick a legal force from the roster, the way the rival does */
  function autoPick(co, tier, pl, tactic) {
    var avail = contractPicks(co).slice().sort(function (a, b) {
      return profile(b.key).tier - profile(a.key).tier;
    });
    var docs = co.doctrines || [];
    var comp = R.compFor(co.faction, tier), out = [], used = {};
    function take(test) {
      for (var i = 0; i < avail.length; i++) {
        var e = avail[i];
        if (used[e.rid] || !test(profile(e.key), e)) continue;
        used[e.rid] = 1; out.push(e); return true;
      }
      return false;
    }
    /* A swarm fields one Leader Bug of the Battle Tier or higher (p. 114): the
       lowest that qualifies, and every other Leader Bug stays behind. */
    var credit = {};
    if (co.faction === 'bugs') {
      var leaders = avail.filter(function (e) { return profile(e.key).leaderBug; })
        .sort(function (x, y) { return profile(x.key).tier - profile(y.key).tier; });
      var lead = leaders.filter(function (e) { return profile(e.key).tier >= tier; })[0];
      leaders.forEach(function (e) { used[e.rid] = 1; });
      if (lead) { out.push(lead); credit[profile(lead.key).tier] = 1; }
    }
    for (var t = 1; t <= 5; t++) {
      var need = comp.limits[t - 1][0] * pl - (credit[t] || 0);
      if (docs.indexOf('O2') >= 0 && t === tier) need = Math.ceil(need / 2);
      for (var i = 0; i < need; i++) take(function (p) { return p.tier === t; });
    }
    // then spend what is left: anything that keeps the list legal goes in, biggest
    // first, because an unspent composition point is a point wasted
    for (var guard = 0; guard < 60; guard++) {
      var keys = out.map(function (e) { return R.joinPick(e.key, e.prop, e.drone); });
      var legal = R.checkArmy(keys, tier, pl, docs, tactic).ok;
      var added = take(function (p, e) {
        var trial = keys.concat([R.joinPick(e.key, e.prop, e.drone)]);
        var res = R.checkArmy(trial, tier, pl, docs, tactic);
        // while the list is still illegal, take anything within budget that helps;
        // once it is legal, only take what keeps it legal
        return legal ? res.ok : res.spent <= comp.points * pl;
      });
      if (!added) break;
    }
    /* A last trim if the fill overshot. Popping from the end was wrong: the list is
       sorted by Tier descending, so an illegal high-Tier machine sits first and could
       never be reached — the trim would strip everything around it and still fail.
       Drop whichever single unit leaves the fewest hard faults behind. */
    for (var trim = 0; trim < 20 && out.length; trim++) {
      var now = R.checkArmy(out.map(function (e) { return R.joinPick(e.key, e.prop, e.drone); }), tier, pl, docs, tactic);
      if (now.ok) break;
      var hard = blocking(now.faults);
      if (!hard.length) break;                     // only minimums left, and dropping cannot help
      var bestAt = -1, bestScore = Infinity;
      for (var q = 0; q < out.length; q++) {
        var without = out.filter(function (_, i) { return i !== q; })
          .map(function (e) { return R.joinPick(e.key, e.prop, e.drone); });
        var res = R.checkArmy(without, tier, pl, docs, tactic);
        var score = blocking(res.faults).length * 10 + res.faults.length;
        if (score < bestScore) { bestScore = score; bestAt = q; }
      }
      if (bestAt < 0) break;
      out.splice(bestAt, 1);
    }
    return out;
  }

  /* Drug Dealer (p. 112): up to a third of the infantry, leaders aside, are sent
     in Determined — and pay for it afterwards. The choice is made as the force
     takes the field, and the marks are cleared again once the aftermath has read
     them. The unit with the most to prove goes first: the ones that have fought
     hardest and carry the least trauma already. */
  // who may be given the drugs: infantry, leaders aside, and up to a third of them
  function drugAble(picks) {
    return picks.filter(function (e) {
      var p = profile(e.key);
      return p.cls === 'infantry' && p.group !== 'First Among Equals' && !p.command;
    });
  }
  function drugCap(picks) { return Math.floor(drugAble(picks).length / 3); }
  /* `chosen`: the player's own pick of rids ("may choose up to 1/3"); without
     one — the rival — the unit with the most to prove goes first. */
  function drugThem(co, picks, chosen) {
    picks.forEach(function (e) { delete e.drugged; });
    if (!C.hasDoctrine(co, 'V4')) return [];
    var able = drugAble(picks);
    var n = Math.floor(able.length / 3);
    if (n < 1) return [];
    var taken;
    if (chosen) taken = able.filter(function (e) { return chosen.indexOf(e.rid) >= 0; }).slice(0, n);
    else { able.sort(function (a, b) { return a.tp - b.tp; }); taken = able.slice(0, n); }
    taken.forEach(function (e) { e.drugged = true; });
    return taken;
  }

  /* ================= starting the battle ================= */
  function fight() {
    var A = camp.companies.A, B = camp.companies.B;
    // a rebel rival picks a tactic of its own, the way a player would (p. 95)
    var theirTactic = B.faction === 'rebel' ? [null, 'laststand', 'wave', 'guerillas'][Math.floor(Math.random() * 4)] : null;
    var theirs = autoPick(B, contract.tier, contract.pl, theirTactic);
    if (!R.checkArmy(theirs.map(function (e) { return R.joinPick(e.key, e.prop, e.drone); }),
      contract.tier, contract.pl, B.doctrines, theirTactic).ok) {
      // the rival cannot field a legal list — let it hire in for this battle
      C.developRival(B);
      theirs = autoPick(B, contract.tier, contract.pl, theirTactic);
    }
    var druggedA = drugThem(A, contract.picks, contract.drugs || []);
    drugThem(B, theirs);
    camp.pending = {
      tier: contract.tier, pl: contract.pl, scenario: contract.scenario.id,
      A: contract.picks.map(function (e) { return e.rid; }),
      B: theirs.map(function (e) { return e.rid; }),
      drugged: contract.picks.filter(function (e) { return e.drugged; }).map(function (e) { return e.rid; })
        .concat(theirs.filter(function (e) { return e.drugged; }).map(function (e) { return e.rid; }))
    };
    if (druggedA.length) {
      note('Drug Dealer',
        druggedA.map(function (e) { return e.name; }).join(', ') +
        ' go in Determined. They will each take D6+1 extra Trauma Points afterwards.');
    }
    save();
    close();
    root.PMC_NEWGAME({
      tier: contract.tier, pl: contract.pl,
      scenario: contract.scenario.id,
      // the attacker and defender were settled when the contract was taken
      roles: contract.roles || null,
      armyA: contract.picks.map(function (e) { return R.joinPick(e.key, e.prop, e.drone); }),
      armyB: theirs.map(function (e) { return R.joinPick(e.key, e.prop, e.drone); }),
      nameA: A.name, nameB: B.name,
      colourA: colourOf(A), colourB: colourOf(B),
      dossier: { A: contract.picks, B: theirs },
      // Modifying the armies (p. 46): what is left on the books, to swap in once the table is laid
      bench: { A: A.roster.filter(function (e) { return contract.picks.indexOf(e) < 0 && !(e.restUntil > 0); }), B: [] },
      doctrines: { A: A.doctrines.slice(), B: B.doctrines.slice() },
      tactics: { A: A.faction === 'rebel' ? contract.tactic || null : null, B: theirTactic },
      campaign: true,
      mode: camp.mode === 'hotseat' ? 'hotseat' : 'ai',
      planet: contract.planet
    });
  }

  /* ================= the aftermath ================= */
  function onFinish(report) {
    if (!camp || !camp.pending) return;
    report.battleTier = camp.pending.tier;
    report.pl = camp.pending.pl;
    report.scenario = camp.pending.scenario;
    C.clearOffers(camp);            // a battle fought: three fresh jobs next turn
    /* The Paths' post-battle choices come first, each at its moment in the book
       (p. 112): Plunderer once the pay is rolled after a win, No Place for the
       Weak! once the Trauma Points are. Kept on the campaign, so a reload on the
       way through picks them up again. */
    var players = camp.mode === 'hotseat' ? ['A', 'B'] : ['A'], steps = [];
    players.forEach(function (sd) {
      var co = camp.companies[sd];
      if (report.winner === sd && C.hasDoctrine(co, 'V2')) steps.push({ kind: 'plunder', side: sd });
    });
    // Tough Negotiators (p. 87): after both sides have rolled — and after any Plunderer re-roll
    players.forEach(function (sd) {
      if (C.hasDoctrine(camp.companies[sd], 'S2')) steps.push({ kind: 'negotiate', side: sd });
    });
    players.forEach(function (sd) {
      if (C.hasDoctrine(camp.companies[sd], 'V5')) steps.push({ kind: 'weak', side: sd });
    });
    var askReborn = {}; players.forEach(function (sd) { askReborn[sd] = true; });
    camp.post = { report: report, pre: { dice: {}, plunder: {}, neg: {}, tp: {}, weak: {}, askReborn: askReborn }, steps: steps };
    if (!steps.length) { finishPost(); setTimeout(function () { open('aftermath'); }, 900); return; }
    save();
    view = 'post';
    setTimeout(function () { open('post'); }, 900);
  }
  function finishPost() {
    var post = camp.post;
    after = C.aftermath(camp, post.report, post.pre);
    if (camp.mode === 'solo') {
      after.rival = C.developRival(camp.companies.B);
      // and the next opponent is drawn now, so the hub can say who is coming
      after.next = C.drawRival(camp);
    }
    camp.post = null;
    camp.pending = null;
    save();
    view = 'aftermath';
  }
  // the post-battle decisions, one to a screen
  function postView() {
    var post = camp.post, st = post && post.steps[0];
    if (!st) { finishPost(); return aftermathView(); }
    var co = camp.companies[st.side], rep = post.report, pre = post.pre;
    var h = '<h2>After the battle</h2>';
    if (camp.mode === 'hotseat') h += '<p class="lede">' + esc(co.name) + '</p>';
    if (st.kind === 'plunder') {
      if (!pre.dice[st.side]) { pre.dice[st.side] = C.rollPayment(rep.battleTier, rep.pl); save(); }
      var d = pre.dice[st.side], tot = d.reduce(function (a, b) { return a + b; }, 0), pl = pre.plunder[st.side];
      h += '<div class="cpan"><div class="cprom-head"><b>Plunderer</b></div>' +
        '<p class="cpstat">' + esc(co.name) + ' won. Its payment roll: ' + d.length + 'D6.</p>' +
        '<p class="dice-row">' + d.map(function (v) { return '<span class="die">' + v + '</span>'; }).join('') +
        ' <b>= ' + tot + ' ' + C.money(co) + '</b></p>';
      if (pl && pl.now) {
        h += '<p class="cpstat">Re-rolled from ' + pl.was.reduce(function (a, b) { return a + b; }, 0) + '. The second roll stands.</p>' +
          '<button class="start" data-go="postnext">Continue</button>';
      } else {
        h += '<p class="cpstat">A victorious revolt may go back through the wreckage and re-roll all the dice. The second roll stands, even if it is worse.</p>' +
          '<div class="cprom-row"><button class="start" data-go="plunder">Re-roll all</button>' +
          '<button class="lnk" data-go="postnext">Keep ' + tot + '</button></div>';
      }
      return h + '</div>';
    }
    if (st.kind === 'negotiate') {
      if (!pre.dice[st.side]) { pre.dice[st.side] = C.rollPayment(rep.battleTier, rep.pl); save(); }
      var nd = pre.dice[st.side], ntot = nd.reduce(function (a, b) { return a + b; }, 0), ng = pre.neg[st.side];
      var cap = Math.ceil(nd.length / 2), sel = st.sel || [];
      h += '<div class="cpan"><div class="cprom-head"><b>Tough Negotiators</b></div>' +
        '<p class="cpstat">' + esc(co.name) + '’s payment roll. Up to ' + cap + ' of the dice may be re-rolled; the second result stands, even if it is worse.</p>';
      if (ng) {
        h += '<p class="dice-row">' + nd.map(function (v, i) {
          var sw = ng.idx.indexOf(i) >= 0;
          return '<span class="die' + (sw ? ' re' : '') + '">' + v + '</span>';
        }).join('') + ' <b>= ' + ntot + ' ' + C.money(co) + '</b></p>' +
          '<p class="cpstat">Re-rolled ' + ng.swapped.map(function (w) { return w.was + '→' + w.now; }).join(', ') + '.</p>' +
          '<button class="start" data-go="postnext">Continue</button>';
      } else {
        h += '<p class="dice-row">' + nd.map(function (v, i) {
          var on = sel.indexOf(i) >= 0;
          return '<button class="die pick' + (on ? ' on' : '') + '" data-negdie="' + i + '"' +
            (!on && sel.length >= cap ? ' disabled' : '') + '>' + v + '</button>';
        }).join('') + ' <b>= ' + ntot + ' ' + C.money(co) + '</b></p>' +
          '<div class="cprom-row"><button class="start" data-go="negotiate"' + (sel.length ? '' : ' disabled') + '>Re-roll ' + sel.length + ' of ' + cap + '</button>' +
          '<button class="lnk" data-go="postnext">Keep them all</button></div>';
      }
      return h + '</div>';
    }
    // No Place for the Weak!
    if (!pre.tp[st.side]) { pre.tp[st.side] = C.rollTP(camp, rep, st.side); save(); }
    var cand = C.weakCandidates(camp, st.side, pre.tp[st.side]);
    if (!cand.length) { post.steps.shift(); save(); return postView(); }
    h += '<div class="cpan"><div class="cprom-head"><b>No Place for the Weak!</b></div>' +
      '<p class="cpstat">' + (cand.length > 1 ? 'These units came back with the most Trauma Points, ' : cand[0].name + ' came back with the most Trauma Points, ') +
      pre.tp[st.side][cand[0].rid].total + '. The revolt may execute ' + (cand.length > 1 ? 'one of them' : 'it') +
      ': it is struck off, and every other unit’s Trauma Points from this battle are halved.</p>' +
      '<div class="segs">' + cand.map(function (e) {
        return '<button class="lnk warn" data-weak="' + e.rid + '">Execute ' + esc(e.name) + '</button>';
      }).join('') + '<button class="lnk" data-weak="">Spare them</button></div></div>';
    return h;
  }

  /* The day's experience and trauma, itemised. The book gives both as a list of
     circumstances (p. 85), so the card shows the list rather than a bare figure:
     what each line was worth, what it came to, and where that leaves the unit. */
  function ledger(kind, led, now, cap) {
    var lines = (led.lines || []).filter(function (l) { return l.n !== 0 || (led.lines || []).length === 1; });
    var isExp = kind === 'exp';
    var sign = led.total > 0 ? '+' : '';
    var h = '<div class="dled ' + (isExp ? 'exp' : 'tp') + (led.total < 0 ? ' good' : '') + '">';
    h += '<div class="dled-head"><b>' + sign + led.total + (isExp ? ' EXP' : ' TP') + '</b>';
    if (now != null) {
      h += '<span class="dled-now">' + (isExp
        ? now + ' banked'
        : now + ' of ' + cap + ' — a Battle Trauma at ' + cap) + '</span>';
    }
    h += '</div>';
    if (lines.length) {
      h += '<ul class="dled-list">' + lines.map(function (l) {
        return '<li><span>' + esc(l.text) + '</span><em>' + (l.n > 0 ? '+' : '') + l.n + '</em></li>';
      }).join('') + '</ul>';
    }
    if (!isExp && cap && now != null && now < cap) {
      h += '<div class="dled-bar"><i style="width:' + Math.min(100, Math.round(100 * now / cap)) + '%"></i></div>';
    }
    return h + '</div>';
  }

  function aftermathView() {
    var h = '<h2>Aftermath</h2>';
    var res = after.winner === 'A' ? 'A victory.' : after.winner === 'B' ? 'A defeat.' : 'A draw.';
    h += '<p class="lede">Campaign turn ' + after.turn + '. ' + res + '</p>';

    h += '<h3>Payment</h3>';
    var p = after.payment;
    var last = camp.log[camp.log.length - 1];
    var nd = last.tier * last.pl;
    h += '<div class="cpan"><div class="cpstat">Two rolls of ' + nd + 'D6: ' +
      '<span class="dcx">' + p.diceA.join(' ') + '</span> and <span class="dcx">' + p.diceB.join(' ') + '</span>. ' +
      (after.winner
        ? 'The winner takes the higher, ' + p.high + '; the loser the lower, ' + p.low + '.'
        : 'A draw, so both companies take the lower, ' + p.low + '.') +
      (p.negA ? ' Tough Negotiators re-rolled ' + p.negA.swapped.length +
        (p.negA.swapped.length === 1 ? ' die.' : ' dice.') : '') +
      '</div><div class="cphead">' + colourFlash(camp.companies.A) + '<b>' + esc(camp.companies.A.name) + '</b>' +
      '<span class="cmoney">+' + p.A + ' ' + coin() + ' → ' + camp.companies.A.kUC + '</span></div></div>';

    if (p.territory && p.territory.A) {
      var tt = p.territory.A;
      h += '<div class="cpan"><div class="cpstat">Territorial recalculation (' + (tt.won ? 'the tribe claimed ground' : 'the tribe gave ground') + '): ' +
        '<span class="dcx">' + tt.was.join(' ') + '</span> → <span class="dcx">' + tt.now.join(' ') + '</span> = ' + tt.total + ' TerP.</div></div>';
    }
    var rec = after.sides.A;
    if (rec.degenerated && rec.degenerated.length) {
      h += '<div class="cpan"><div class="cpstat">Infamy of Degeneration — ' + rec.degenerated.map(function (d) {
        return esc(d.name) + ' (rolled ' + d.roll + ') lost ' + d.lost + ' EXP';
      }).join('; ') + '.</div></div>';
    }
    if (rec.rebornOffer && rec.rebornOffer.length) {
      h += '<div class="cpan"><div class="cprom-head"><b>Enhanced Genetic Memory</b></div>' +
        '<p class="cpstat">A lost infantry unit can be recruited again, now or never: on a D6 of 2-6 the new one remembers everything the old one had before this battle.</p>' +
        rec.rebornOffer.map(function (r, i) {
          if (r.done) return '<div class="orow"><b>' + esc(r.name) + '</b><em>Regrown (D6 ' + r.done.roll + ') — ' +
            (r.done.remembered ? 'it remembers.' : 'the memory did not carry.') + '</em></div>';
          return '<div class="orow"><b>' + esc(r.name) + '</b><span class="segs"><button class="lnk" data-go="reborn" data-i="' + i + '"' +
            (camp.companies.A.kUC < r.cost ? ' disabled' : '') + '>Recruit again — ' + r.cost + ' ' + coin() + '</button></span></div>';
        }).join('') + '</div>';
    }
    if (rec.reborn && rec.reborn.length) {
      h += '<div class="cpan"><div class="cpstat">Enhanced Genetic Memory — ' + rec.reborn.map(function (r) {
        return r.afford ? esc(r.name) + ' is regrown for ' + r.cost + ' TerP' + (r.remembered ? ', remembering its experience' : ', its memories lost')
          : esc(r.name) + ' could not be regrown (needs ' + r.cost + ' TerP)';
      }).join('; ') + '.</div></div>';
    }
    if (rec.healed && rec.healed.length) {
      h += '<div class="cpan"><div class="cpstat">Supportive Community — ' + rec.healed.map(function (r) {
        return esc(r.name) + ' shakes off ' + esc(r.trauma && r.trauma.name || 'an Infamy');
      }).join('; ') + '.</div></div>';
    }
    // what the swarm fed on (p. 124): Resource Points and new Infected Humans
    if (rec.feeding) h += '<div class="cpan"><div class="cpstat">' + esc(rec.feeding.text) + '</div></div>';
    if (rec.infected && rec.infected.length) {
      h += '<div class="cpan"><div class="cpstat">Fungi Symbiosis — ' + rec.infected.length + ' human unit' +
        (rec.infected.length === 1 ? '' : 's') + ' destroyed in assaults rise again: ' + rec.infected.length +
        ' free unit' + (rec.infected.length === 1 ? '' : 's') + ' of Infected Humans join the swarm.</div></div>';
    }
    h += '<h3>The ' + C.words(camp.companies.A).force + '</h3><div class="dlist">';
    rec.units.forEach(function (u) {
      if (u.rested != null) {
        h += '<div class="dcard rested"><div class="dtop"><b class="dname">' + esc(u.name) + '</b>' +
          '<span class="dtag">sat this one out</span>' +
          (u.workshop ? '<span class="dtag warn">in the workshop</span>' : '') + '</div>';
        h += ledger('tp', u.rested
          ? { total: -u.rested, lines: [{ text: 'Rest and recovery — D3+1 came up ' + u.restRoll, n: -u.rested }] }
          : { total: 0, lines: [{ text: 'Nothing to shake off — D3+1 came up ' + u.restRoll, n: 0 }] },
          u.tpNow, u.tpCap);
        h += '</div>';
        return;
      }
      var tag = u.disbanded ? 'disbanded — ten ' + (camp.companies.A.faction === 'bugs' ? 'flaws' : camp.companies.A.faction === 'xeno' ? 'infamies' : 'traumas')
        : u.aboardDowned && u.wiped ? 'lost with the aircraft'
          : u.wiped ? 'wiped out — struck off' : '';
      h += '<div class="dcard' + (u.wiped ? ' gone' : '') + '"><div class="dtop">' +
        '<b class="dname">' + esc(u.name) + '</b>' +
        (u.name === profile(u.key).name ? '' : '<span class="dprof">' + esc(profile(u.key).name) + '</span>') +
        (tag ? '<span class="dtag bad">' + tag + '</span>' : '') +
        (u.fled && !u.wiped ? '<span class="dtag warn">fled the field</span>' : '') +
        (u.rebuilt ? '<span class="dtag">reconstituted</span>' : '') + '</div>';
      /* A unit that is off the dossier has no use for the day's experience or
         trauma, and showing a ledger it can never spend only raises the question
         of why it was struck off in the first place. Say that instead. */
      if (u.wiped && !u.disbanded) {
        h += '<div class="dledger bad">' + (u.aboardDowned
          ? 'They were aboard when it came down, and it was not recovered — so neither were they.'
          : 'Every soldier was killed. Losses in a surviving unit are replaced free, but a unit wiped out to the last model leaves the dossier.') +
          '</div>';
      } else {
        if (u.fled) {
          h += '<div class="dledger">Scattered and ran rather than died: the survivors are back, ' +
            'and their losses are replaced free.</div>';
        }
        if (u.aboardDowned) {
          h += '<div class="dledger">Rode the aircraft down and walked away from the landing.</div>';
        }
        if (u.exp) h += ledger('exp', u.exp, u.expNow, 0);
        if (u.tp) h += ledger('tp', u.tp, u.tpNow, u.tpCap);
      }
      if (u.salvage) {
        h += '<div class="dledger">' + esc(u.salvage.note) +
          (u.salvage.roll ? ' D6 ' + u.salvage.roll + ' → ' + (u.salvage.saved ? 'recovered, and sits out the next battle' : 'lost for good') : '') +
          '</div>';
      }
      if (u.trauma) {
        h += '<div class="dledger bad"><b>' + esc(u.trauma.name) + '</b> ' + esc(u.trauma.text) + '</div>';
      }
      h += '</div>';
    });
    h += '</div>';

    if (after.rival && after.rival.length) {
      h += '<h3>' + esc(camp.companies.B.name) + '</h3><div class="cpan cpan-B">';
      h += '<div class="cpstat">While you were spending, they were too.</div>';
      after.rival.forEach(function (d) {
        h += '<div class="dledger"><b>' +
          (d.what === 'tier' ? 'Tier' : d.what === 'doctrine' ? C.creedOf(camp.companies.B).one.replace(/^./, function (c) { return c.toUpperCase(); }) :
            d.what === 'promote' ? 'Promotion' : d.what === 'honour' ? 'Honour' :
              d.what === 'upgrade' ? 'Upgrade' : 'Recruit') + '</b> ' + esc(d.text) + '</div>';
      });
      h += '<button class="lnk" data-go="intel">Their dossier</button></div>';
    }

    if (after.elsewhere && after.elsewhere.length) {
      h += '<h3>Elsewhere on the world</h3><div class="cpan"><div class="cpstat">' +
        after.elsewhere.map(function (e) {
          var co = (camp.rivals || []).filter(function (r) { return r.name === e.name; })[0];
          return esc(e.name) + ' fought their own battle and took ' + e.kUC + ' ' +
            C.money(co) + '.';
        }).join('<br>') + '</div></div>';
    }

    var gaps = C.rebuildNeeds(camp.companies.A);
    if (gaps.length) {
      h += '<div class="cpwarn">The ' + C.words(camp.companies.A).force + ' can no longer field a legal army at Tier ' +
        gaps.map(function (t) { return ROMAN[t]; }).join(', ') +
        '. Recruit or promote from the lowest Tier up before the next contract.</div>';
    }
    h += '<button class="start" data-go="roster">Spend the pay</button>';
    h += '<p class="camp-foot"><button class="lnk" data-go="hub">The campaign</button></p>';
    return h;
  }

  /* ================= the honour draw ================= */
  /* Battle Honours (p. 88): "The player selects three Battle Honours which the unit
     hasn't gained yet and chooses one of them randomly." Both halves matter — the
     choosing is the player's, the drawing is not — so the three are nominated here
     out of everything the unit could still earn, and then one of them is drawn. */
  var drawState = null;
  function honourView() {
    var picks = drawState.picked || [];
    var h = '<h2>' + esc(drawState.entry.name) + '</h2>';
    var hw = C.words(camp.companies.A).honours;
    h += '<p class="lede">Put three ' + hw + ' forward, then one of the three is taken at ' +
      'random (p. ' + (hw === 'Adaptations' ? 125 : 88) + '). ' + drawState.cost + ' EXP.</p>';
    if (!drawState.won) {
      h += '<p class="dnote"><b>' + picks.length + ' of 3 chosen.</b> ' +
        (picks.length < 3
          ? 'Pick ' + (3 - picks.length) + ' more from the ' + drawState.pool.length +
            ' this unit has not earned — tap one again to take it back out.'
          : 'The hat is full. Draw, and the dice decide which of the three it is.') + '</p>';
    }
    h += '<div class="docpick">';
    drawState.pool.forEach(function (x) {
      var on = picks.indexOf(x.n) >= 0;
      var won = drawState.won && drawState.won.n === x.n;
      if (drawState.won && !on) return;                 // once drawn, show only the three
      h += '<button class="doc' + (won ? ' on' : on ? ' picked' : '') + '"' +
        (drawState.won || (!on && picks.length >= 3) ? ' disabled' : '') +
        ' data-pickhonour="' + x.n + '">' +
        '<b>' + esc(x.name) + (won ? ' — drawn' : '') + '</b><span>' + esc(x.text) + '</span></button>';
    });
    h += '</div>';
    if (drawState.won) {
      h += '<p class="faults ok">' + esc(drawState.entry.name) + ' earns <b>' + esc(drawState.won.name) + '</b>.</p>';
      h += '<button class="start" data-go="roster">Back to the dossier</button>';
    } else {
      h += '<button class="start" data-go="drawnow"' + (picks.length === 3 ? '' : ' disabled') + '>' +
        (picks.length === 3 ? 'Draw one of the three' : 'Choose three first') + '</button>';
    }
    h += '<p class="camp-foot"><button class="lnk" data-go="roster">Back</button></p>';
    return h;
  }

  /* ================= the rival's dossier ================= */
  var intelIdx = 0;
  function intelView() {
    var rivals = camp.rivals || [camp.companies.B];
    var co = rivals[Math.min(intelIdx, rivals.length - 1)] || camp.companies.B;
    var a = C.archetype(co.archetype);
    var h = '<h2>' + esc(co.name) + '</h2>';
    h += '<p class="lede">' + esc(C.themeOf(co)) + ' ' +
      C.words(co).tier + ' Tier ' + ROMAN[co.tier] +
      ' · ' + co.roster.length + ' units · ' + co.record.battles + ' battles against you.</p>';
    // only the battles fought against this force count toward the record with it
    var mine2 = camp.log.filter(function (l) { return !l.against || l.against === co.name; });
    var head = mine2.filter(function (l) { return l.winner === 'A'; }).length;
    var lost = mine2.filter(function (l) { return l.winner === 'B'; }).length;
    h += '<div class="cpan cpan-B"><div class="cpstat">Record between you: ' +
      head + ' to you, ' + lost + ' to them, ' +
      mine2.filter(function (l) { return !l.winner; }).length + ' drawn.</div>' +
      '<div class="cpdoc">' + co.doctrines.map(function (d) {
        return '<span class="mk" ' + tip(C.doctrine(d).name, C.doctrine(d).text) + '>' + esc(C.doctrine(d).name) + '</span>';
      }).join('') + '</div></div>';
    h += '<div class="dlist">';
    co.roster.slice().sort(function (x, y) {
      return profile(y.key).tier - profile(x.key).tier || y.exp - x.exp;
    }).forEach(function (e) { h += entryCard(e, co, {}); });
    h += '</div>';
    h += '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
    return h;
  }

  /* ================= fitting an upgrade ================= */
  var upState = null;
  function upgradeView() {
    var h = '<h2>' + esc(upState.name) + '</h2>';
    h += '<p class="lede">An Upgrade is chosen, not drawn — 10 EXP, and no more than ' +
      C.upgradeCap(upState) + ' on a Tier ' + ROMAN[profile(upState.key).tier] + ' machine.</p>';
    h += '<div class="docpick">';
    C.availableUpgrades(upState).forEach(function (g) {
      h += '<button class="doc" data-fit="' + g.n + '"><b>' + esc(g.name) + '</b>' +
        '<i>' + (g.air ? 'aircraft only' : g.ground ? 'ground vehicles only' : 'any machine') + '</i>' +
        '<span>' + esc(g.text) + '</span></button>';
    });
    h += '</div><p class="camp-foot"><button class="lnk" data-go="roster">Back</button></p>';
    return h;
  }

  /* ================= doctrine picking ================= */
  var docSide = 'A', docSwap = false, swapOut = null;
  function doctrineView() {
    var co = camp.companies[docSide];
    var cr = C.creedOf(co), reb = co.faction === 'rebel', bug = co.faction === 'bugs' || co.faction === 'xeno';
    var open = C.doctrineSlots(co) - co.doctrines.length;
    if (docSwap && C.canSwapDoctrine(co).ok) return swapView(co, cr);
    var h = '<h2>Choose ' + (co.faction === 'bugs' ? 'an ' : 'a ') + cr.one + '</h2>';
    h += '<p class="lede">' + esc(co.name) + ' has ' + open + ' ' + cr.one +
      ' slot' + (open === 1 ? '' : 's') + ' free — one per ' + C.words(co).tier +
      ' Tier, and no more than two ' + (reb || bug ? 'from any one group.' : 'from a category.') + '</p>';
    cr.cats.forEach(function (cat) {
      var held = co.doctrines.filter(function (x) {
        return cr.by[x] && cr.by[x].cat === cat;
      }).length;
      h += '<h3>' + (reb ? 'Paths of the ' + cat : co.faction === 'xeno' ? cat + ' Advancements' : bug ? cat + ' Pathways' : cat) + ' <span class="dtag">' + held + ' of 2</span></h3>';
      h += '<div class="docpick">';
      cr.list.filter(function (d) { return d.cat === cat; }).forEach(function (d) {
        var chk = C.canTakeDoctrine(co, d.id);
        var have = C.hasDoctrine(co, d.id);
        h += '<button class="doc' + (have ? ' on' : '') + '" data-take="' + d.id + '"' +
          (chk.ok ? '' : ' disabled title="' + esc(have ? 'Already held.' : chk.why) + '"') + '>' +
          '<b>' + esc(d.name) + '</b><i>' + (d.where === 'battle' ? 'on the table' :
            d.where === 'list' ? 'army list' : d.where === 'payment' ? 'payday' :
              d.where === 'contract' ? 'before the battle' : d.where ? 'aftermath' : '&nbsp;') + '</i>' +
          '<span>' + esc(d.text) + '</span></button>';
      });
      h += '</div>';
    });
    h += '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
    return h;
  }

  /* A Tier V change: first the one to give up, then the one to take in its place. */
  function swapView(co, cr) {
    var h = '<h2>Change a ' + cr.one + '</h2>';
    h += '<p class="lede">' + esc(co.name) + ' may change one ' + cr.one + ' now, and again five battles later. ' +
      (swapOut ? 'Giving up <b>' + esc(C.doctrine(swapOut).name) + '</b> — pick what replaces it.' : 'Pick the one to give up.') + '</p>';
    h += '<div class="docpick">';
    if (!swapOut) {
      co.doctrines.forEach(function (id) {
        var d = C.doctrine(id);
        h += '<button class="doc on" data-swapout="' + id + '"><b>' + esc(d.name) + '</b><span>' + esc(d.text) + '</span></button>';
      });
    } else {
      var trial = { doctrines: co.doctrines.filter(function (x) { return x !== swapOut; }), tier: co.tier, faction: co.faction };
      cr.list.forEach(function (d) {
        if (d.id === swapOut) return;
        var chk = C.canTakeDoctrine(trial, d.id);
        if (!chk.ok && C.hasDoctrine(co, d.id)) return;
        h += '<button class="doc" data-swapin="' + d.id + '"' + (chk.ok ? '' : ' disabled title="' + esc(chk.why) + '"') +
          '><b>' + esc(d.name) + '</b><i>' + esc(d.cat) + '</i><span>' + esc(d.text) + '</span></button>';
      });
    }
    h += '</div><p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
    return h;
  }

  /* ================= render and wiring ================= */
  function render() {
    var body = el('camp-body');
    if (!body) return;
    var h = '';
    if (view !== 'hub') hubPane = 'tier';                    // back at the hub, it opens on the Tier panel again
    if (view !== 'found' && needsSecond()) beginSecond();   // nothing goes on until both forces exist
    if (camp && camp.post && view !== 'post') view = 'post';  // a post-battle choice is still owed
    if (view === 'found') h = foundView();
    else if (view === 'offers') h = offersView();
    else if (view === 'contract') h = contractView();
    else if (view === 'aftermath') h = aftermathView();
    else if (view === 'post') h = postView();
    else if (view === 'honour') h = honourView();
    else if (view === 'doctrine') h = doctrineView();
    else if (view === 'upgrade') h = upgradeView();
    else if (view === 'intel') h = intelView();
    else h = hubView();
    /* The screen's heading goes up in the top bar, and the bar's Back does
       what the screen's own way back does (to the hub, or the main menu); a
       screen with no way back, part way through something, has none. */
    var hd = /^<h2>([\s\S]*?)<\/h2>/.exec(h);
    if (hd) h = h.slice(hd[0].length);
    el('camp-title').innerHTML = hd ? hd[1] : 'Campaign';
    if (view !== modalView) { openModal = null; colourOpen = false; }   // a new screen starts with nothing open over it
    modalView = view;
    // a pick in an open list redraws it: keep it where it was scrolled to
    var ms = body.querySelector('.cmodal:not([hidden]) .cmodal-scroll'), mTop = ms ? ms.scrollTop : 0, mKind = openModal;
    body.classList.toggle('fit', view === 'found');
    body.classList.toggle('hubfit', view === 'hub' && !!camp);
    body.innerHTML = h;
    body.scrollTop = 0;
    var ms2 = body.querySelector('.cmodal:not([hidden]) .cmodal-scroll');
    if (ms2 && mKind === openModal) ms2.scrollTop = mTop;
    var way = body.querySelector('.camp-foot [data-go="hub"], .camp-foot [data-go="menu"]'), bk = el('camp-back');
    bk.hidden = !way;
    if (way) bk.setAttribute('data-go', way.getAttribute('data-go'));
    if (way && root.PMC_BACK_LABEL) root.PMC_BACK_LABEL(bk, way.getAttribute('data-go') === 'menu');
  }

  function findEntry(co, rid) { return C.byRid(co, rid); }

  /* The founding screen redraws whenever a unit, a doctrine or a colour is
     picked, which would wipe a half-typed name. Read it back first, every time. */
  function keepFoundName() {
    var box = el('found-name');
    if (box && draft) draft.name = box.value;
  }

  function onClick(ev) {
    var t = ev.target.closest('button');
    // the founding colours drop down under the chip: a tap anywhere else puts them away
    if (colourOpen && !ev.target.closest('.found-pop') && !(t && t.getAttribute('data-go') === 'fcolour')) {
      keepFoundName(); colourOpen = false; render();
      if (!t) return;
    }
    if (!t) return;
    if (view === 'found') keepFoundName();
    var co = camp ? camp.companies.A : null;
    var go = t.getAttribute('data-go');

    if (t.hasAttribute('data-add')) {
      draft.keys.push(t.getAttribute('data-add')); render(); return;
    }
    if (t.hasAttribute('data-drop')) {
      draft.keys.splice(+t.getAttribute('data-drop'), 1); render(); return;
    }
    if (t.hasAttribute('data-fdrone')) {
      var di = +t.getAttribute('data-fdrone'), ds = R.splitPick(draft.keys[di]);
      draft.keys[di] = R.joinPick(ds.key, ds.prop, !ds.drone); render(); return;
    }
    if (t.hasAttribute('data-cycle')) {
      var i = +t.getAttribute('data-cycle'), s = R.splitPick(draft.keys[i]);
      var order = R.propsFor(profile(s.key));
      var nx = order[(order.indexOf(s.prop || 'none') + 1) % order.length];
      draft.keys[i] = R.joinPick(s.key, nx, s.drone); render(); return;
    }
    if (t.hasAttribute('data-doc')) {
      draft.doctrine = t.getAttribute('data-doc');
      if (openModal === 'doctrine') openModal = null;   // one to choose: the pick closes it
      render(); return;
    }
    if (t.hasAttribute('data-swapout')) { swapOut = t.getAttribute('data-swapout'); render(); return; }
    if (t.hasAttribute('data-swapin')) {
      var sr = C.swapDoctrine(camp.companies[docSide], swapOut, t.getAttribute('data-swapin'));
      if (sr.ok) { swapOut = null; docSwap = false; save(); view = 'hub'; }
      render(); return;
    }
    if (t.hasAttribute('data-take')) {
      var side = docSide, cc = camp.companies[side];
      if (C.canTakeDoctrine(cc, t.getAttribute('data-take')).ok) cc.doctrines.push(t.getAttribute('data-take'));
      save(); view = 'hub'; render(); return;
    }
    if (t.hasAttribute('data-pickhonour')) {
      var hn = +t.getAttribute('data-pickhonour');
      if (!drawState || drawState.won) return;
      var at = drawState.picked.indexOf(hn);
      if (at >= 0) drawState.picked.splice(at, 1);
      else if (drawState.picked.length < 3) drawState.picked.push(hn);
      render(); return;
    }
    if (t.hasAttribute('data-take-offer')) { takeOffer(+t.getAttribute('data-take-offer')); render(); return; }
    if (t.hasAttribute('data-foresee') && contract && contract.alt) {
      var was = contract.scenario, wasRoles = contract.roles;
      contract.scenario = contract.alt; contract.alt = was;
      var SCx = root.PMCScen;
      contract.roles = !wasRoles ? null : contract.altRoles || (SCx && SCx.rollRoles ? SCx.rollRoles(contract.scenario.id,
        { A: camp.companies.A.doctrines || [], B: camp.companies.B.doctrines || [] }, null, ['A']) : null);
      contract.altRoles = wasRoles;
      render(); return;
    }
    if (t.hasAttribute('data-rtab')) { rosterTab = t.getAttribute('data-rtab'); render(); return; }
    if (t.hasAttribute('data-recruit')) {
      C.recruit(co, t.getAttribute('data-recruit'), { drone: t.hasAttribute('data-asdrone') }); save(); render(); return;
    }
    if (t.hasAttribute('data-disband')) {
      var e = findEntry(co, t.getAttribute('data-disband'));
      if (!e) return;
      ask({
        kind: 'confirm', title: 'Disband ' + e.name + '?', danger: true,
        text: 'They come off the dossier for good, with everything they have earned.',
        okLabel: 'Disband them',
        onOk: function () { C.disband(co, e); save(); render(); }
      });
      return;
    }
    if (t.hasAttribute('data-rename')) {
      var re = findEntry(co, t.getAttribute('data-rename'));
      if (!re) return;
      ask({
        kind: 'text', title: 'What are they called?', value: re.name,
        text: 'A name of your own travels with them through every promotion.',
        okLabel: 'Rename',
        onOk: function (v) { if (v) { re.name = String(v).slice(0, 28); save(); render(); } }
      });
      return;
    }
    if (t.hasAttribute('data-men')) {
      var mr = t.getAttribute('data-men');
      menOpen[mr] = !menOpen[mr]; render(); return;
    }
    if (t.hasAttribute('data-rsoldier')) {
      var se = findEntry(co, t.getAttribute('data-rsoldier')), si = +t.getAttribute('data-i');
      var sm = se && se.men && se.men[si];
      if (!sm) return;
      ask({
        kind: 'text', title: 'Rename ' + sm.rank + ' ' + sm.name, value: sm.name, max: 32,
        text: 'They keep the name for as long as they survive.',
        okLabel: 'Rename',
        onOk: function (v) { if (C.renameSoldier(se, si, v)) { save(); render(); } }
      });
      return;
    }
    if (t.hasAttribute('data-promote')) {
      var pe = findEntry(co, t.getAttribute('data-promote'));
      C.promoteUnit(co, pe, t.getAttribute('data-to')); save(); render(); return;
    }
    if (t.hasAttribute('data-honour')) {
      var he = findEntry(co, t.getAttribute('data-honour'));
      drawState = {
        entry: he, pool: C.availableHonours(he), picked: [],
        cost: C.honourCost(he, co), won: null
      };
      view = 'honour'; render(); return;
    }
    if (t.hasAttribute('data-upgrade')) {
      upState = findEntry(co, t.getAttribute('data-upgrade'));
      view = 'upgrade'; render(); return;
    }
    if (t.hasAttribute('data-fit')) {
      C.takeUpgrade(co, upState, +t.getAttribute('data-fit'));
      save(); view = 'hub'; hubPane = 'dossier'; rosterTab = 'spend'; render(); return;
    }
    if (t.hasAttribute('data-pick')) {
      var pk = findEntry(co, t.getAttribute('data-pick'));
      if (pk) contract.picks.push(pk); render(); return;
    }
    if (t.hasAttribute('data-unpick')) { contract.picks.splice(+t.getAttribute('data-unpick'), 1); render(); return; }
    if (t.hasAttribute('data-tactic') && contract) {
      contract.tactic = t.getAttribute('data-tactic') || null;
      render(); return;
    }
    if (t.hasAttribute('data-negdie') && camp.post) {
      var ns = camp.post.steps[0];
      if (ns && ns.kind === 'negotiate') {
        var di = +t.getAttribute('data-negdie'), sl = ns.sel = ns.sel || [], at = sl.indexOf(di);
        if (at >= 0) sl.splice(at, 1); else if (sl.length < Math.ceil(camp.post.pre.dice[ns.side].length / 2)) sl.push(di);
        save(); render();
      }
      return;
    }
    if (t.hasAttribute('data-weak') && camp.post) {
      var ws = camp.post.steps[0];
      if (ws && ws.kind === 'weak') {
        camp.post.pre.weak[ws.side] = t.getAttribute('data-weak') || false;
        camp.post.steps.shift(); save(); render();
      }
      return;
    }
    if (t.hasAttribute('data-drug') && contract) {
      var dr = t.getAttribute('data-drug'), dl = contract.drugs = contract.drugs || [], di = dl.indexOf(dr);
      if (di >= 0) dl.splice(di, 1); else dl.push(dr);
      render(); return;
    }
    if (t.hasAttribute('data-tier')) {
      contract.tier = Math.max(1, Math.min(contract.tierRoll.cap, contract.tier + (+t.getAttribute('data-tier'))));
      contract.levels = C.levelsFor(camp.companies.A, camp.companies.B, contract.tier);
      if (contract.levels.indexOf(contract.pl) < 0) contract.pl = contract.levels[0] || 1;
      contract.adjusted = true; contract.picks = []; render(); return;
    }
    if (t.hasAttribute('data-bfaction')) {
      keepFoundName();
      var keepName = draft.name, keepColour = draft.colour, chosen = draft.colourChosen;
      beginSecond(t.getAttribute('data-bfaction'));
      // an unchosen colour follows the kind of force (a swarm defaults to olive); a chosen one is kept
      draft.name = keepName;
      if (chosen) { draft.colour = keepColour; draft.colourChosen = true; }
      render(); return;
    }
    if (t.hasAttribute('data-campcolour') && view === 'hub' && camp) {
      camp.companies.A.colour = t.getAttribute('data-campcolour');
      try { localStorage.setItem('pmc-colour', camp.companies.A.colour); } catch (e) { }
      save(); colourOpen = false; render(); return;
    }
    if (t.hasAttribute('data-campcolour')) {
      draft.colour = t.getAttribute('data-campcolour'); draft.colourChosen = true;
      colourOpen = false;
      keepFoundName();
      render(); return;
    }
    if (t.hasAttribute('data-side')) { docSide = t.getAttribute('data-side'); docSwap = t.hasAttribute('data-swap'); swapOut = null; }
    if (t.hasAttribute('data-rival')) intelIdx = +t.getAttribute('data-rival') || 0;

    switch (go) {
      case 'fcolour': colourOpen = !colourOpen; render(); return;
      case 'fmodal': openModal = t.getAttribute('data-kind'); render(); return;
      case 'fmodalclose': openModal = null; render(); return;
      case 'newcamp': {
        var fac = el('camp-faction') ? el('camp-faction').value : 'pmc';
        secondFaction = el('camp-bfaction') ? el('camp-bfaction').value : null;
        // a name to start from; the player settles it on the founding screen
        beginFounding(fac === 'rebel' ? 'The Free Colonies' : fac === 'bugs' ? 'The Hive' : fac === 'xeno' ? 'The Ghadon Third' : 'Task Force Ironhold',
          el('camp-mode').value, fac);
        draft.archs = [];                          // the world is always rolled
        render(); return;
      }
      case 'dofound': {
        var nm = (el('found-name') ? el('found-name').value : draft.name || '').trim();
        if (!nm) { note('It needs a name', 'Give the force something to be known by.'); return; }
        draft.name = nm;
        var fs = draft.side || 'A', fco = camp.companies[fs];
        if (fs === 'B' && draft.colour === camp.companies.A.colour) {
          note('That colour is taken', camp.companies.A.name + ' already wears it. Pick another, so the two sides can be told apart.');
          return;
        }
        if (fs === 'B' && nm === camp.companies.A.name) { note('That name is taken', 'The two forces need different names.'); return; }
        var res = C.found(fco, draft.keys, draft.doctrine);
        if (!res.ok) { note('Not a legal starting company', res.faults.join(' ')); return; }
        fco.name = nm;
        fco.colour = draft.colour || 'ochre';
        if (fs === 'A') {
          try { localStorage.setItem('pmc-colour', fco.colour); } catch (e6) { }
          // hotseat: the second player founds their own force next; solo: the rivals are raised
          if (camp.mode === 'hotseat') { save(); beginSecond(secondFaction); render(); return; }
          foundRival(draft.archs);
        } else ensureColours();
        save(); view = 'hub'; render(); return;
      }
      case 'doctrine': view = 'doctrine'; render(); return;
      case 'promoteco': {
        var pr = C.promoteCompany(camp.companies[docSide]);
        if (pr.ok) { save(); view = 'doctrine'; }
        render(); return;
      }
      case 'aspire': camp.companies[docSide].aspiring = true; save(); render(); return;
      case 'roster':
        // from the hub, the Dossier button swaps the Tier panel for the dossier and back again
        if (view === 'hub' && hubPane === 'dossier') hubPane = 'tier';
        else { hubPane = 'dossier'; if (view !== 'hub') rosterTab = rosterTab || 'units'; }
        view = 'hub'; render(); return;
      case 'intel': view = 'intel'; render(); return;
      case 'offers': view = 'offers'; render(); return;
      case 'contract': beginContract(); render(); return;
      case 'plunder': {
        var pst = camp.post && camp.post.steps[0];
        if (!pst || pst.kind !== 'plunder') return;
        var pr = camp.post.pre, was = pr.dice[pst.side];
        pr.dice[pst.side] = C.rollPayment(camp.post.report.battleTier, camp.post.report.pl);
        pr.plunder[pst.side] = { was: was.slice(), now: pr.dice[pst.side].slice() };
        save(); render(); return;
      }
      case 'bestdef':
        if (contract && contract.roles && root.PMCScen) {
          var had = contract.picks.length;
          root.PMCScen.bestDefence(contract.roles);
          if (had && contract.roles.bestDefence && contract.roles.bestDefence.swapped) note('The Best Defence is Good Offence', 'D6 ' + contract.roles.bestDefence.roll + ' — you are the attacker now. Check the list still suits the job.');
          save(); render();
        }
        return;
      case 'negotiate': {
        var nst = camp.post && camp.post.steps[0];
        if (!nst || nst.kind !== 'negotiate' || !(nst.sel || []).length) return;
        var npr = camp.post.pre, dice = npr.dice[nst.side].slice(), sw = [];
        nst.sel.forEach(function (i) { var was = dice[i]; dice[i] = 1 + Math.floor(Math.random() * 6); sw.push({ was: was, now: dice[i] }); });
        npr.dice[nst.side] = dice;
        npr.neg[nst.side] = { dice: dice.slice(), swapped: sw, idx: nst.sel.slice() };
        save(); render(); return;
      }
      case 'reborn': {
        var ro = after && after.sides.A && after.sides.A.rebornOffer, oi = +t.getAttribute('data-i');
        if (!ro || !ro[oi]) return;
        var rr = C.rebirth(camp.companies.A, ro[oi]);
        if (!rr.ok) { note('Enhanced Genetic Memory', rr.why); return; }
        save(); render(); return;
      }
      case 'postnext':
        if (camp.post) { camp.post.steps.shift(); save(); render(); }
        return;
      case 'autopick': contract.picks = autoPick(camp.companies.A, contract.tier, contract.pl, contract.tactic || null); render(); return;
      case 'standard':
        if (!contract || !C.canStandard(camp.companies.A, camp.companies.B)) return;
        contract.standard = true; contract.tier = 3; contract.pl = 2; contract.levels = [2];
        contract.tierRoll = { roll: 3, cap: 3, tier: 3, standing: 3, thin: false };
        contract.adjusted = true; contract.picks = [];
        render(); return;
      case 'fight': fight(); return;
      case 'drawnow': {
        if ((drawState.picked || []).length !== 3) return;
        var won = C.chooseHonour(drawState.picked.map(function (n) { return C.honourTable(drawState.entry.key)[n - 1]; }));
        C.takeHonour(camp.companies.A, drawState.entry, won.n);
        drawState.won = won; save(); render(); return;
      }
      case 'hub': view = 'hub'; render(); return;
      case 'menu': toMenu(); return;
      case 'export': doExport(); return;
      case 'import': el('camp-file').click(); return;
      case 'wipe':
        ask({
          kind: 'confirm', title: 'Abandon this campaign?', danger: true,
          text: 'Every dossier goes, everywhere it is saved — this browser, your account and your server. ' +
            'There is no undoing it. Save it to a file first if you might want it back.',
          okLabel: 'Abandon it',
          onOk: function () {
            Store.clear().then(function () {
              camp = null; view = 'hub'; render();
            });
          }
        });
        return;
    }
  }

  /* The rival is one of five archetypes, founded to the book's starting rules in
     its own style, and it develops in that direction battle by battle. */
  /* The opposition: three forces, a mix of mercenary companies and revolts. If
     the player named one they want to meet, it is raised first and the other two
     fill in around it. */
  /* The world's forces: rolled as usual, then every one the player asked to
     meet put in place of a rolled one (and added, if they asked for more than
     the world had). The first of theirs is the one they face first. */
  function foundRival(archIds) {
    C.foundRivals(camp);
    (archIds || []).forEach(function (archId, i) {
      var a = C.archetype(archId);
      if (!a) return;
      var co = C.newCompany('Rival', { faction: a.faction || 'pmc' });
      var used = camp.rivals.filter(function (r, k) { return k !== i; }).map(function (r) { return r.name; });
      C.foundRival(co, archId, used);
      camp.rivals[i] = co;
    });
    if (archIds && archIds.length) C.faceRival(camp, 0);
    ensureColours();
  }

  /* Every force in a campaign wears its own colour: the player's is chosen, and
     everyone else takes one that is still free. Re-run on load, so a campaign
     saved before colours existed is painted rather than left grey. */
  function ensureColours() {
    if (!camp || !camp.companies) return;
    var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
    function known(c) { return !!CO[c && c.colour]; }
    var A = camp.companies.A;
    if (!known(A)) A.colour = startingColour();
    var taken = [A.colour];
    // companies.B is an alias of the rival being faced, so the rivals decide it
    var forces = (camp.rivals && camp.rivals.length) ? camp.rivals
      : (camp.companies.B ? [camp.companies.B] : []);
    forces.forEach(function (r) {
      if (!known(r) || taken.indexOf(r.colour) >= 0) r.colour = freeColour(taken);
      taken.push(r.colour);
    });
  }

  function doExport() {
    var blob = JSON.stringify(C.forSave(camp), null, 1);
    var name = 'pmc-campaign-' + (camp.companies.A.name || 'company').replace(/\W+/g, '-').toLowerCase() + '.json';
    (async function () {
      try {
        if (root.claude && root.claude.use) {
          var d = await root.claude.use('downloads');
          if (d) { await d.save({ filename: name, data: blob }); return; }
        }
      } catch (e) { }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([blob], { type: 'application/json' }));
      a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    })();
  }

  function onFile(ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var got = JSON.parse(rd.result);
        if (!got || !got.companies) throw new Error('not a campaign file');
        camp = C.rehydrate(got); ensureColours(); save(); view = 'hub'; render();
      } catch (e) { note('That file will not load', 'It does not look like a campaign save file.'); }
    };
    rd.readAsText(f);
    ev.target.value = '';
  }

  /* ================= boot ================= */
  function mount() {
    var host = el('camp');
    if (!host) return;
    host.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('[data-ask]');
      if (a) {
        if (a.getAttribute('data-ask') === 'ok') answerAsk(); else closeAsk();
        return;
      }
      if (ev.target === el('camp-ask')) { closeAsk(); return; }   // tapping the backdrop
      if (ev.target.classList && ev.target.classList.contains('cmodal')) { openModal = null; render(); return; }
      if (asking) return;                                         // nothing behind it is live
      if (ev.target === host) { close(); return; }
      onClick(ev);
    });
    host.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && openModal) { ev.preventDefault(); openModal = null; render(); return; }
      if (!asking) return;
      if (ev.key === 'Enter') { ev.preventDefault(); answerAsk(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeAsk(); }
    });
    host.addEventListener('change', function (ev) {
      if (ev.target.id === 'camp-file') onFile(ev);
      // a hotseat campaign has no rival to choose: the second player founds their own
      else if (ev.target.id === 'camp-mode') {
        var hs = ev.target.value === 'hotseat', bw = el('camp-bwrap');
        if (bw) bw.hidden = !hs;
      }
      else if (ev.target.id === 'camp-pl') {
        var want = +ev.target.value;
        if ((contract.levels || [1, 2]).indexOf(want) >= 0) contract.pl = want;
        contract.picks = []; render();
      }
      else if (ev.target.id === 'camp-planet') contract.planet = ev.target.value;
    });
    function enter() {
      var setup = el('setup');
      if (setup) setup.hidden = true;                 // the muster sheet would sit on top
      open(view === 'aftermath' ? 'aftermath' : 'hub');
    }
    var btn = el('btn-campaign');
    if (btn) btn.addEventListener('click', enter);
    // the muster sheet covers the header on a fresh load, so it needs its own way in
    var setupBtn = el('btn-setup-campaign');
    if (setupBtn) setupBtn.addEventListener('click', enter);
    Store.load().then(function (got) {
      camp = got;
      if (camp && camp.pending) camp.pending = null;    // a battle abandoned mid-flight
      ensureColours();
      if (needsSecond()) beginSecond();                // the second player had not founded yet
      render();
    });
  }

  root.__autopick = autoPick;            // test hook
  // test hook: set the contract's scenario by hand, to look at each one's briefing
  root.__forceScenario = function (id) {
    if (!contract) return null;
    contract.scenario = { roll: C.SCENARIOS.indexOf(id) + 1, id: id, name: C.SCENARIO_NAMES[id] };
    contract.roles = root.PMCScen ? root.PMCScen.rollRoles(id, {
      A: camp.companies.A.doctrines || [], B: camp.companies.B.doctrines || []
    }) : null;
    render();
    return { scenario: contract.scenario, roles: contract.roles };
  };
  root.PMC_CAMPAIGN = {
    open: open, close: close, onFinish: onFinish,
    get: function () { return camp; },
    set: function (c) { camp = c; save(); render(); },
    store: Store
  };
  root.PMC_ONFINISH = onFinish;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
