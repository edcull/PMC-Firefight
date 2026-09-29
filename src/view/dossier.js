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
  // what each screen has open, kept here so the screens can live in their own files
  var secondFaction = null;       // what the hub said the second player runs, until they found it
  var wantMode = 'solo';          // how a new campaign will be played: the menu card it was opened from
  var wantFaction = 'pmc', wantB = 'pmc';   // what the new campaign's forces will be, as picked so far
  var enterCampaign = null;       // the way in, once the screen is wired
  var openModal = null, modalView = null, colourOpen = false;
  var hubPane = 'dossier';            // the hub opens on the unit cards
  var rosterTab = 'units';
  var menOpen = {};               // which unit has its details open, by rid (one at a time)
  var showCard = null;            // a card just opened, to be scrolled fully into view
  var promoRid = null;            // the unit whose promotion choices are open
  var rivalOpen = null;           // which other force has its dossier open in its card
  var drawState = null;
  var intelIdx = 0;
  var upState = null;
  var docSide = 'A', docSwap = false, swapOut = null;
  /* The dossier's unit list narrowed by the Honours and Trauma figures above
     it: each a toggle, by force ('A', 'B', or a rival's 'r' + its place), and
     with both on, the units that have either. */
  var ufilter = {};
  function unitPasses(e, key) {
    var f = ufilter[key];
    if (!f || (!f.honour && !f.trauma)) return true;
    return !!((f.honour && (e.honours || []).length) || (f.trauma && (e.traumas || []).length));
  }
  var ROMAN = R.ROMAN;
  var ICON_SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>';
  // the other forces: two banners
  var ICON_FORCES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h9l-2 3.5 2 3.5H5"/><path d="M19 21V9"/><path d="M19 9h-6"/><path d="M13 9l1.5 2.5L13 14h6"/></svg>';
  // the battles fought: crossed swords
  var ICON_BATTLES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M9.5 17.5L21 6V3h-3L6.5 14.5"/><path d="M11 19l-6-6"/><path d="M8 16l-4 4"/><path d="M5 21l-2-2"/></svg>';
  /* Where the force keeps its casualties: a company's or a revolt's field
     hospital (a tent with a red cross), the tribe's temple (a stepped shrine
     with its fire), and the swarm's biomass (a cluster of cells). */
  var SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var ICON_HOSPITAL = SVG_OPEN + '<path d="M2.5 20.5L12 4l9.5 16.5"/><path d="M1.5 20.5h21"/><path d="M12 11v6.5M8.75 14.25h6.5"/></svg>';
  var ICON_TEMPLE = SVG_OPEN + '<path d="M2.5 21h19"/><path d="M4.5 21v-4h15v4"/><path d="M7 17v-4h10v4"/><path d="M9.5 13V9.5h5V13"/><path d="M12 9.5c-1.6-1.3-1.6-3.2 0-5.5 1.6 2.3 1.6 4.2 0 5.5z"/></svg>';
  var ICON_BIOMASS = SVG_OPEN + '<circle cx="9" cy="9.5" r="5.5"/><circle cx="16.8" cy="15.8" r="4"/><circle cx="7.2" cy="18.8" r="2.2"/><circle cx="8" cy="8.5" r="1.2"/><circle cx="17.3" cy="15.2" r="0.9"/></svg>';
  function memorialIcon(co) {
    var f = (co && co.faction) || 'pmc';
    return f === 'bugs' ? ICON_BIOMASS : f === 'xeno' ? ICON_TEMPLE : ICON_HOSPITAL;
  }
  // managing the campaign's file: a folder with a gear
  var ICON_MANAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3"/><path d="M3 7v10a2 2 0 0 0 2 2h7"/><circle cx="18" cy="17" r="2.2"/><path d="M18 12.8v1.6M18 19.6v1.6M13.8 17h1.6M20.6 17h1.6M15 14l1.1 1.1M19.9 18.9L21 20M15 20l1.1-1.1M19.9 15.1L21 14"/></svg>';
  // recruiting: a plus
  // giving it all up: a white flag
  var ICON_ABANDON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
  var ICON_LOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 17v3h16v-3"/></svg>';

  function save() {
    // the storage panel only knows how a write went once it has gone, so redraw then
    Store.save(camp).then(function () {
      if (view === 'hub' && el('camp') && !el('camp').hidden) render();
    });
  }
  function esc(s) { return R.esc(s); }   // the shared one, in the rules
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
  function closeAsk() {
    var spec = asking;
    asking = null; el('camp-ask').hidden = true;
    if (spec && spec.kind === 'note' && spec.then) spec.then();
  }
  function answerAsk() {
    var spec = asking;
    if (!spec) return;
    var input = el('ask-input');
    var value = input ? input.value.trim() : true;
    closeAsk();
    if (spec.onOk) spec.onOk(value);
  }
  // `then`: what waits on the note being read — however it is closed
  function note(title, text, then) { ask({ kind: 'note', title: title, text: text, then: then }); }

  /* ================= small pieces ================= */
  function profile(key) { return R.profile(key); }
  function tierChip(t) { return '<span class="ct">' + ROMAN[t] + '</span>'; }

  function entryCard(e, co, opts) {
    opts = opts || {};
    var p = profile(e.key), h = '';
    var machine = p.cls !== 'infantry';
    var threshold = C.traumaThreshold(co);
    h += '<div class="dcard' + (e.restUntil > 0 ? ' resting' : '') + (opts.expand ? ' dclick' + (opts.men ? ' open' : '') : '') + '" data-rid="' + e.rid + '"' +
      (opts.expand ? ' aria-expanded="' + !!opts.men + '"' : '') + '>';
    h += '<div class="dtop">' + tierChip(p.tier) +
      '<b class="dname">' + esc(e.name) + '</b>' +
      (e.name === p.name ? '' : '<span class="dprof">' + esc(p.name) + '</span>');
    if (e.restUntil > 0) h += '<span class="dtag warn">in the workshop</span>';
    h += '</div>';
    /* Opened, the card's own facts sit in a column on the left — experience and
       trauma, its honours and traumas, what can be done with it — and the unit
       as it stands on the table on the right; its full sheet follows below. */
    if (opts.portrait) h += '<div class="dsplit"><div class="dleft">';
    if (!C.isLeaderP(p) && !(co.faction === 'xeno' && (p.rules || []).indexOf('Turret') >= 0)) {
      h += '<div class="dbars">' +
        '<span class="dexp">' + e.exp + ' EXP</span>';
      if (!machine || C.takesHonours(p)) {
        var pct = Math.min(100, Math.round(100 * e.tp / threshold));
        h += '<span class="dtp" title="' + e.tp + ' of ' + threshold + ' Trauma Points">' +
          '<i style="width:' + pct + '%"></i></span><span class="dtpn">' + e.tp + '/' + threshold + ' TP</span>';
      }
      h += '</div>';
    }                                                // a command unit or a turret: no experience bars, and nothing said about it
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
    if (opts.portrait) {
      h += '</div><canvas class="dportrait" data-key="' + esc(e.key) + '" data-side="' + (co === (camp && camp.companies.B) ? 'B' : 'A') + '"' +
        ' data-colour="' + esc(colourOf(co)) + '"' + (e.prop ? ' data-prop="' + esc(e.prop) + '"' : '') + (e.drone ? ' data-drone="1"' : '') +
        (e.riders ? ' data-riders="1"' : '') + (e.mount ? ' data-mount="' + esc(e.mount) + '"' : '') +
        ' role="img" aria-label="' + esc(p.name) + '"></canvas></div>';
    }
    if (opts.men) h += opts.men;
    h += '</div>';
    return h;
  }

  /* ---- the company hub: in view/dossier-hub.js ---- */
  var KIT_HUB = null;
  function kitHub() {
    return KIT_HUB || (KIT_HUB = root.PMCDossierHub({
      C: C, ICON_ABANDON: ICON_ABANDON, ICON_BATTLES: ICON_BATTLES, ICON_FORCES: ICON_FORCES,
      ICON_LOAD: ICON_LOAD, ICON_MANAGE: ICON_MANAGE, memorialIcon: memorialIcon, ICON_SAVE: ICON_SAVE,
      ROMAN: ROMAN, Store: Store, cmodal: cmodal, coin: coin, colourName: colourName, colourOf: colourOf,
      dossierPanel: dossierPanel, entryCard: entryCard, esc: esc, memorialList: memorialList,
      profile: profile, root: root, spendActs: spendActs, squares: squares, tip: tip,
      get camp() { return camp; }, get colourOpen() { return colourOpen; }, get wantMode() { return wantMode; },
      get wantFaction() { return wantFaction; }, get wantB() { return wantB; }, get openModal() { return openModal; },
      get hubPane() { return hubPane; }, get promoRid() { return promoRid; },
      get rivalOpen() { return rivalOpen; }, get ufilter() { return ufilter; }, unitPasses: unitPasses
    }));
  }
  function hubView() { return (KIT_HUB || kitHub()).hubView(); }
  function stripe(co) { return (KIT_HUB || kitHub()).stripe(co); }
  function armyPill(co, kind) { return (KIT_HUB || kitHub()).armyPill(co, kind); }
  function armyRules(co) { return (KIT_HUB || kitHub()).armyRules(co); }
  function statRow(co, rival) { return (KIT_HUB || kitHub()).statRow(co, rival); }
  /* ---- founding a force: in view/dossier-found.js ---- */
  var KIT_FOUND = null;
  function kitFound() {
    return KIT_FOUND || (KIT_FOUND = root.PMCDossierFound({
      C: C, R: R, ROMAN: ROMAN, esc: esc, profile: profile, root: root, tierChip: tierChip, tip: tip,
      armyPill: armyPill, armyRules: armyRules,
      get camp() { return camp; }, set camp(v) { camp = v; }, get colourOpen() { return colourOpen; },
      get draft() { return draft; }, set draft(v) { draft = v; }, get openModal() { return openModal; },
      get view() { return view; }, set view(v) { view = v; }
    }));
  }
  function beginFounding(name, mode, faction) { return (KIT_FOUND || kitFound()).beginFounding(name, mode, faction); }
  function needsSecond() { return (KIT_FOUND || kitFound()).needsSecond(); }
  function beginSecond(faction) { return (KIT_FOUND || kitFound()).beginSecond(faction); }
  function startingColour(faction) { return (KIT_FOUND || kitFound()).startingColour(faction); }
  function colourFlash(co) { return (KIT_FOUND || kitFound()).colourFlash(co); }
  function colourOf(co) { return (KIT_FOUND || kitFound()).colourOf(co); }
  function freeColour(taken) { return (KIT_FOUND || kitFound()).freeColour(taken); }
  function squares(pick) { return (KIT_FOUND || kitFound()).squares(pick); }
  function colourName(k) { return (KIT_FOUND || kitFound()).colourName(k); }
  function cmodal(kind, title, inner, foot) { return (KIT_FOUND || kitFound()).cmodal(kind, title, inner, foot); }
  function coin() { return (KIT_FOUND || kitFound()).coin(); }
  function foundView() { return (KIT_FOUND || kitFound()).foundView(); }
  function ourList(co) { return (KIT_FOUND || kitFound()).ourList(co); }
  function statLine(p) { return (KIT_FOUND || kitFound()).statLine(p); }
  /* ---- the dossier: in view/dossier-roster.js ---- */
  var KIT_ROSTER = null;
  function kitRoster() {
    return KIT_ROSTER || (KIT_ROSTER = root.PMCDossierRoster({
      C: C, R: R, ROMAN: ROMAN, entryCard: entryCard, esc: esc, ourList: ourList, profile: profile,
      root: root, save: save, statLine: statLine, get menOpen() { return menOpen; },
      get rosterTab() { return rosterTab; }, get camp() { return camp; }, unitPasses: unitPasses
    }));
  }
  function dossierPanel(co) { return (KIT_ROSTER || kitRoster()).dossierPanel(co); }
  function memorialList(co) { return (KIT_ROSTER || kitRoster()).memorialList(co); }
  function spendActs(e, co) { return (KIT_ROSTER || kitRoster()).spendActs(e, co); }
  /* ---- the contract: in view/dossier-contract.js ---- */
  var KIT_CONTRACT = null;
  function kitContract() {
    return KIT_CONTRACT || (KIT_CONTRACT = root.PMCDossierContract({
      C: C, R: R, ROMAN: ROMAN, armyPill: armyPill, close: close, colourFlash: colourFlash,
      colourOf: colourOf, esc: esc, note: note, profile: profile, quietTip: quietTip, root: root, save: save,
      spellOut: spellOut, statRow: statRow, stripe: stripe, tip: tip, get camp() { return camp; },
      get contract() { return contract; }, set contract(v) { contract = v; },
      get view() { return view; }, set view(v) { view = v; }
    }));
  }
  function offersView() { return (KIT_CONTRACT || kitContract()).offersView(); }
  function beginContract() { return (KIT_CONTRACT || kitContract()).beginContract(); }
  function takeOffer(i) { return (KIT_CONTRACT || kitContract()).takeOffer(i); }
  function contractView() { return (KIT_CONTRACT || kitContract()).contractView(); }
  function autoPick(co, tier, pl, tactic) { return (KIT_CONTRACT || kitContract()).autoPick(co, tier, pl, tactic); }
  function fight() { return (KIT_CONTRACT || kitContract()).fight(); }
  /* ---- the campaign after a battle: in view/dossier-after.js ---- */
  var KIT_AFTER = null;
  function kitAfter() {
    return KIT_AFTER || (KIT_AFTER = root.PMCDossierAfter({
      C: C, ROMAN: ROMAN, coin: coin, colourFlash: colourFlash, entryCard: entryCard, esc: esc, open: open,
      profile: profile, save: save, tip: tip, get after() { return after; }, set after(v) { after = v; },
      get camp() { return camp; }, get docSide() { return docSide; }, get docSwap() { return docSwap; },
      get drawState() { return drawState; }, get intelIdx() { return intelIdx; },
      get swapOut() { return swapOut; }, get upState() { return upState; },
      get view() { return view; }, set view(v) { view = v; }, render: function () { render(); }
    }));
  }
  function onFinish(report) { return (KIT_AFTER || kitAfter()).onFinish(report); }
  function postView() { return (KIT_AFTER || kitAfter()).postView(); }
  function aftermathView() { return (KIT_AFTER || kitAfter()).aftermathView(); }
  function honourView() { return (KIT_AFTER || kitAfter()).honourView(); }
  function intelView() { return (KIT_AFTER || kitAfter()).intelView(); }
  function upgradeView() { return (KIT_AFTER || kitAfter()).upgradeView(); }
  function doctrineView() { return (KIT_AFTER || kitAfter()).doctrineView(); }
  /* ================= render and wiring ================= */
  function render() {
    var body = el('camp-body');
    if (!body) return;
    var h = '';
    if (view !== 'hub') hubPane = 'dossier';                 // back at the hub, it opens on the dossier
    if (view !== 'found' && needsSecond()) beginSecond();   // nothing goes on until both forces exist
    if (camp && camp.post && view !== 'post') view = 'post';  // a post-battle choice is still owed
    if (view !== 'aftermath' && KIT_AFTER) KIT_AFTER.showPast(null);   // a past battle's report is only open while it is shown
    if (camp && camp.fronts && !camp.post) (KIT_AFTER || kitAfter()).nextFront();   // the other forces' battles, still being fought
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
    body.classList.toggle('fit', view === 'found' || view === 'contract' || view === 'honour');
    body.classList.toggle('hubfit', view === 'hub' && !!camp);
    var dl = body.querySelector('.cdos-body'), dlTop = dl ? dl.scrollTop : 0;
    body.innerHTML = h;
    body.scrollTop = 0;
    var dl2 = body.querySelector('.cdos-body');
    if (dl2) {
      dl2.scrollTop = dlTop;                        // a redraw keeps the list where it was
      var oc = showCard && dl2.querySelector('.dcard[data-rid="' + showCard + '"]');
      if (oc) {
        var lr = dl2.getBoundingClientRect(), cr2 = oc.getBoundingClientRect();
        if (cr2.bottom > lr.bottom) dl2.scrollTop += Math.min(cr2.bottom - lr.bottom + 6, cr2.top - lr.top - 4);
        else if (cr2.top < lr.top) dl2.scrollTop -= lr.top - cr2.top + 4;
      }
    }
    showCard = null;
    paintPortraits(body);
    var ms2 = body.querySelector('.cmodal:not([hidden]) .cmodal-scroll');
    if (ms2 && mKind === openModal) ms2.scrollTop = mTop;
    var way = body.querySelector('.camp-foot [data-go="hub"], .camp-foot [data-go="menu"], .camp-foot [data-go="foundback"]'), bk = el('camp-back');
    bk.hidden = !way;
    if (way) bk.setAttribute('data-go', way.getAttribute('data-go'));
    if (way && root.PMC_BACK_LABEL) root.PMC_BACK_LABEL(bk, way.getAttribute('data-go') === 'menu');
  }

  function findEntry(co, rid) { return C.byRid(co, rid); }

  /* A unit opened on the roster, drawn by the game's own renderer as the unit
     atlas draws it: a squad ready, a machine facing south-east on its running
     gear, in the force's colours, and riding whatever it rides. */
  function paintPortraits(body) {
    var I = root.PMCIso;
    if (!I || !I.drawUnit) return;
    Array.prototype.forEach.call(body.querySelectorAll('canvas.dportrait'), function (cv) {
      var p = profile(cv.dataset.key);
      if (!p || !cv.getContext) return;
      var dpr = Math.min(2, root.devicePixelRatio || 1);
      var W = cv.clientWidth || 150, H = cv.clientHeight || 130;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var g = cv.getContext('2d');
      if (!g) return;
      var side = cv.dataset.side || 'A';
      if (I.PALETTE[side] !== I.COLOURS[cv.dataset.colour]) I.setSideColour(side, cv.dataset.colour);
      var th = Math.PI / 4, fu = Math.cos(th), fv = 2 * Math.sin(th);             // south-east on the screen
      var u = Object.assign({}, p, { id: 'P' + p.key, side: side, facing: Math.atan2(fv - fu, fu + fv), alive: true, damage: 0, sp: 0,
        cargo: [], rules: (p.rules || []).slice(), models: p.size, x: 10, y: 10, drone: !!cv.dataset.drone });
      var mach = p.cls === 'vehicle' || p.cls === 'aircraft';
      if (p.cls === 'vehicle' && p.faction !== 'bugs' && p.faction !== 'xeno') R.applyPropulsion(u, cv.dataset.prop || (R.lookDrive && R.lookDrive(p)) || 'wheeled');
      if (cv.dataset.riders) R.applyRiders(u, true);
      if (cv.dataset.mount) u.mount = cv.dataset.mount;
      var walker = u.prop === 'walker';
      var mag = mach ? (p.faction === 'bugs' ? 0.72 : p.faction === 'xeno' && p.cls === 'vehicle' ? 1.3 : p.cls === 'aircraft' ? 1.0 : walker ? 1.05 : 1.15) : 1.55;
      var ground = H - (mach ? (p.faction === 'bugs' ? 18 : walker || p.cls === 'aircraft' ? 14 : 26) : 16);
      var up = I.flyLift ? I.flyLift(u) : 0;
      if (up) {
        var hs = I.hullSpec && I.hullSpec(u.art);
        ground = H * 0.56 + (up + ((hs && hs.hgt) || 14) * 0.5) * mag;
      }
      var s0 = I.toScreen(10, 10);
      try {
        g.setTransform(mag * dpr, 0, 0, mag * dpr, (W / 2 - s0.x * mag) * dpr, (ground - s0.y * mag) * dpr);
        I.drawUnit(g, u, { at: { x: 10, y: 10 }, lift: 0, status: 'ready', morale: 0 });
      } catch (err) { if (root.console) console.error(p.key, err); }
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
  }

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
    /* A tap on a unit's card, anywhere but its buttons, opens its details and
       closes any other; the list scrolls to show the whole of the opened card. */
    var card = !t && !ev.target.closest('.ddet') && ev.target.closest('#camp-body .dcard.dclick');
    if (card) {
      var cr = card.getAttribute('data-rid');
      var was = !!menOpen[cr];
      menOpen = {};
      if (!was) { menOpen[cr] = true; showCard = cr; }
      render(); return;
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
    // what a unit picked for the founding rides: the Riders upgrade, and the mount
    if (t.hasAttribute('data-friders')) {
      var fr = R.splitPick(draft.keys[+t.getAttribute('data-friders')]);
      draft.keys[+t.getAttribute('data-friders')] = R.joinPick(fr.key, fr.prop, fr.drone, !fr.riders, fr.mount); render(); return;
    }
    if (t.hasAttribute('data-fmount')) {
      var fm = R.splitPick(draft.keys[+t.getAttribute('data-fmount')]), mo = R.MOUNT_ORDER;
      draft.keys[+t.getAttribute('data-fmount')] = R.joinPick(fm.key, fm.prop, fm.drone, fm.riders, mo[(mo.indexOf(fm.mount || 'none') + 1) % mo.length]); render(); return;
    }
    if (t.hasAttribute('data-cycle')) {
      var i = +t.getAttribute('data-cycle'), s = R.splitPick(draft.keys[i]);
      var order = R.propsFor(profile(s.key));
      var nx = order[(order.indexOf(s.prop || 'none') + 1) % order.length];
      draft.keys[i] = R.joinPick(s.key, nx, s.drone, s.riders, s.mount); render(); return;
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
    if (t.hasAttribute('data-rtab')) { rosterTab = t.getAttribute('data-rtab'); openModal = null; render(); return; }
    if (t.hasAttribute('data-recruit')) {
      // recruiting spends the money: say what it costs, and what there is, before it is spent
      var rk = t.getAttribute('data-recruit'), asDrone = t.hasAttribute('data-asdrone');
      var rp = profile(rk), rcost = C.recruitCost(co, rk), purse = co.kUC, coinWord = C.money(co);
      ask({
        kind: 'confirm', title: C.words(co).recruit + ' ' + rp.name + (asDrone ? ' (drone)' : '') + '?',
        text: (rcost ? 'It costs ' + rcost + ' ' + coinWord + '. You have ' + purse + ' ' + coinWord +
          ', leaving ' + (purse - rcost) + ' ' + coinWord + '.' : 'It costs nothing. You have ' + purse + ' ' + coinWord + '.'),
        okLabel: C.words(co).recruit + (rcost ? ' for ' + rcost + ' ' + coinWord : ''),
        onOk: function () { C.recruit(co, rk, { drone: asDrone }); save(); render(); }
      });
      return;
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
    if (t.hasAttribute('data-rivdos')) { var rv = +t.getAttribute('data-rivdos'); rivalOpen = rivalOpen === rv ? null : rv; render(); return; }
    if (t.hasAttribute('data-promo')) { promoRid = t.getAttribute('data-promo'); openModal = 'promote'; render(); return; }
    // a unit on the roster takes the Riders upgrade or lays it down, or changes what it rides
    if (t.hasAttribute('data-eriders')) {
      var re = findEntry(co, t.getAttribute('data-eriders'));
      re.riders = !re.riders; C.menOf(re, co); save(); render(); return;
    }
    if (t.hasAttribute('data-emount')) {
      var me = findEntry(co, t.getAttribute('data-emount'));
      me.mount = t.getAttribute('data-m'); save(); render(); return;
    }
    if (t.hasAttribute('data-promote')) {
      var pe = findEntry(co, t.getAttribute('data-promote'));
      C.promoteUnit(co, pe, t.getAttribute('data-to')); openModal = null; promoRid = null; save(); render(); return;
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
      save(); view = 'hub'; hubPane = 'dossier'; rosterTab = 'units'; render(); return;
    }
    if (t.hasAttribute('data-pick')) {
      var pk = findEntry(co, t.getAttribute('data-pick'));
      if (pk) contract.picks.push(pk); render(); return;
    }
    if (t.hasAttribute('data-unpick')) { contract.picks.splice(+t.getAttribute('data-unpick'), 1); render(); return; }
    // a turret or insertion platform put in the force for this battle alone: never on the books
    if (t.hasAttribute('data-field') && contract) {
      var fe = C.newEntry(t.getAttribute('data-field'));
      fe.fielded = true;
      contract.picks.push(fe); render(); return;
    }
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
      case 'ufilter': {
        var fk = t.getAttribute('data-fkey'), kind = t.getAttribute('data-kind');
        var fl = ufilter[fk] || (ufilter[fk] = {});
        fl[kind] = !fl[kind];
        // the list it narrows is opened to show it
        if (fk.charAt(0) === 'r') rivalOpen = +fk.slice(1);
        else { hubPane = 'dossier'; rosterTab = 'units'; docSide = fk; }
        render(); return;
      }
      case 'pastbattle': (KIT_AFTER || kitAfter()).showPast(+t.getAttribute('data-i')); openModal = null; view = 'aftermath'; render(); return;
      case 'pastback': (KIT_AFTER || kitAfter()).showPast(null); view = 'hub'; openModal = 'battles'; render(); return;
      case 'fmodalclose': openModal = null; render(); return;
      case 'newcamp': {
        var fac = el('camp-faction') ? el('camp-faction').value : 'pmc';
        secondFaction = el('camp-bfaction') ? el('camp-bfaction').value : null;
        // a name to start from; the player settles it on the founding screen
        // no name to start from: the player gives one on the founding screen (the box suggests one)
        beginFounding('', el('camp-mode').value, fac);
        draft.archs = [];                          // the world is always rolled
        render(); return;
      }
      case 'dofound': {
        // greyed out: say what the charter still needs, and go no further
        if (t.getAttribute('aria-disabled') === 'true') { if (root.PMCTips) root.PMCTips.show(t); return; }
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
        else { hubPane = 'dossier'; if (view === 'hub') rosterTab = 'units'; }
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
      case 'fight':
        if (t.getAttribute('aria-disabled') === 'true') { if (root.PMCTips) root.PMCTips.show(t); return; }
        fight(); return;
      case 'drawnow': {
        if ((drawState.picked || []).length !== 3) return;
        var won = C.chooseHonour(drawState.picked.map(function (n) { return C.honourTable(drawState.entry.key)[n - 1]; }));
        C.takeHonour(camp.companies.A, drawState.entry, won.n);
        drawState.won = won; save(); render(); return;
      }
      case 'hub': view = 'hub'; render(); return;
      /* Back from founding the first force: the campaign it was for goes (nothing
         in it yet), and the choice of what to run comes back as it was picked. */
      case 'foundback':
        if (camp) { wantFaction = camp.companies.A.faction || 'pmc'; wantMode = camp.mode || 'solo'; }
        if (secondFaction) wantB = secondFaction;
        draft = null; openModal = null;
        Store.clear().then(function () { camp = null; view = 'hub'; render(); });
        return;
      case 'menu': toMenu(); return;
      case 'export': if (openModal === 'manage') { openModal = null; render(); } doExport(); return;
      case 'import': if (openModal === 'manage') { openModal = null; render(); } el('camp-file').click(); return;
      case 'wipe':
        if (openModal === 'manage') { openModal = null; render(); }
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
    C.evenWorld(camp);                  // the world's forces pair off: an even number of them
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
        camp = C.rehydrate(got); C.evenWorld(camp); ensureColours(); save(); view = 'hub'; render();
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
    // the name box: the charter can be signed as soon as it has a name, without waiting on a redraw
    host.addEventListener('input', function (ev) {
      if (!ev.target || ev.target.id !== 'found-name' || !draft) return;
      draft.name = ev.target.value;
      var sign = el('found-sign');
      if (!sign || sign.getAttribute('data-rest') !== '1') return;
      var ok = !!draft.name.trim();
      sign.setAttribute('aria-disabled', String(!ok));
      sign.setAttribute('data-tip', sign.getAttribute(ok ? 'data-ready' : 'data-noname'));
      sign.setAttribute('data-tip-title', ok ? 'Ready' : 'Still needed');
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
        wantMode = ev.target.value;
        if (bw) bw.hidden = !hs;
      }
      // the army picked: its pill (and the rules behind it) follows
      else if (ev.target.id === 'camp-faction') { wantFaction = ev.target.value; render(); }
      else if (ev.target.id === 'camp-bfaction') { wantB = ev.target.value; render(); }
      else if (ev.target.id === 'camp-pl') {
        var want = +ev.target.value;
        if ((contract.levels || [1, 2]).indexOf(want) >= 0) contract.pl = want;
        contract.picks = []; render();
      }
      else if (ev.target.id === 'camp-planet') contract.planet = ev.target.value;
    });
    /* The menu's Campaign cards: single player and hotseat. There is one
       campaign at a time, so with one under way either card opens it; with none,
       the new-campaign form starts on the way of playing that card named. */
    function enter(mode) {
      if (mode === 'solo' || mode === 'hotseat') wantMode = mode;
      var setup = el('setup');
      if (setup) setup.hidden = true;                 // the muster sheet would sit on top
      /* The campaign's battle is still being fought (the page was refreshed in
         the middle of it, say): Campaign goes back to it. */
      var st = root.PMC_STATE && root.PMC_STATE();
      if (camp && camp.pending && st && st.cfg && st.cfg.campaign && root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE()) {
        if (root.PMCMenu) root.PMCMenu.close();
        return;
      }
      if (camp && camp.pending) { camp.pending = null; save(); }   // a battle abandoned mid-flight
      open(view === 'aftermath' ? 'aftermath' : 'hub');
    }
    // the main menu's cards say which way of playing they are for (menu.js calls in)
    enterCampaign = enter;
    // the muster sheet covers the header on a fresh load, so it needs its own way in
    var setupBtn = el('btn-setup-campaign');
    if (setupBtn) setupBtn.addEventListener('click', enter);
    Store.load().then(function (got) {
      camp = got;
      // a battle abandoned mid-flight — unless it was kept, and is waiting to be gone back to
      var kept = root.PMCNet && root.PMCNet.savedBattle && root.PMCNet.savedBattle();
      if (camp && camp.pending && !(kept && kept.cfg && kept.cfg.campaign)) camp.pending = null;
      if (camp && camp.companies && C.evenWorld(camp)) save();   // a campaign from before the forces paired off
      ensureColours();
      if (needsSecond()) beginSecond();                // the second player had not founded yet
      render();
    });
  }

  // the tests' hooks into the dossier (testhooks.js, not in the published builds)
  if (root.PMCTestHooks) root.PMCTestHooks.dossier({
    get camp() { return camp; }, get contract() { return contract; }, autoPick: autoPick, render: render, C: C
  });
  root.PMC_CAMPAIGN = {
    open: open, close: close, onFinish: onFinish,
    enter: function (mode) { if (enterCampaign) enterCampaign(mode); },
    get: function () { return camp; },
    set: function (c) { camp = c; save(); render(); },
    // the test harness's way to fill a contract's list (as the rival picks its own)
    autopick: function () {
      if (!contract || !camp) return false;
      contract.picks = autoPick(camp.companies.A, contract.tier, contract.pl, contract.tactic || null);
      render(); return true;
    },
    store: Store
  };
  root.PMC_ONFINISH = onFinish;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
