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
     so moving between them never quietly loses progress.

     This browser keeps any number of campaigns, each under an id of its own (its
     `lid`), with an index of them for the main menu's Continue list and the id of
     the one open. The database and the server keep one: the one last saved, read
     back only while it is the campaign open. The account keeps each campaign
     under its own id there, remembered per campaign. */
  var KEY = 'pmc-campaign';                 // where the one campaign was kept, before there could be several
  var IDX = 'pmc-campaigns', CUR = 'pmc-campaign-current', ONE = 'pmc-campaign:';
  var SRV = 'pmc-campaign-server';
  var db = null, dbReady = false, storeNote = '';   // not `note`: that is the in-page message helper below
  /* Signed in on the server this page came from (multiplayer plan, decision 7): the
     account keeps the campaign too. Who is signed in, the campaign's id there and
     the version it was last read or saved at, and a newer copy found on saving. */
  var acct = null, acctVersion = 0, acctChain = Promise.resolve(), acctConflict = null;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { }
    return null;
  }
  function readJSON(k) { try { var got = ls(k); return got ? JSON.parse(got) : null; } catch (e) { return null; } }
  function newLid() { return Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36); }
  /* The one campaign an older build kept is moved under an id of its own, as the
     one open; the account's id for it (kept per account then) follows it there. */
  function migrate() {
    var old = ls(KEY);
    if (!old) return;
    var lid = newLid();
    ls(ONE + lid, old); ls(KEY, null);
    ls('pmc-campaign-legacy', lid);
    try { indexPut(lid, JSON.parse(old)); } catch (e) { }
    if (!ls(CUR)) ls(CUR, lid);
  }
  function index() { migrate(); var got = readJSON(IDX); return Array.isArray(got) ? got : []; }
  function indexPut(lid, c) {
    var list = (readJSON(IDX) || []).filter(function (e) { return e.lid !== lid; });
    var A = c && c.companies && c.companies.A, B = c && c.mode === 'hotseat' && (c.companies.B || (c.rivals || [])[c.facing || 0]);
    list.unshift({ lid: lid, name: A ? (A.name || 'A new force') + (B && B.name ? ' v ' + B.name : '') : 'A new campaign',
      mode: c && c.mode === 'hotseat' ? 'hotseat' : 'solo', turn: (c && c.turn) || 0, at: Date.now(), over: !!(c && c.over) });
    ls(IDX, JSON.stringify(list));
  }
  function indexDrop(lid) { ls(IDX, JSON.stringify((readJSON(IDX) || []).filter(function (e) { return e.lid !== lid; }))); }
  // the campaign open: its id (one is given it the first time it is saved)
  function curLid(v) { if (v === undefined) { migrate(); return ls(CUR) || null; } ls(CUR, v || null); return v || null; }
  function raw(get, value) {
    var lid = curLid();
    if (get) return lid ? readJSON(ONE + lid) : null;
    if (value === null) { if (lid) { ls(ONE + lid, null); indexDrop(lid); } return null; }   // Store.clear lets the id go
    if (!lid) lid = curLid(newLid());
    ls(ONE + lid, JSON.stringify(value));
    indexPut(lid, value);
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
      /* The server gives the first browser to save a campaign a key, and wants it
         back with every later save or delete (it stops another site's page from
         overwriting the campaign). Kept per server. */
      key: function (v) {
        var k = 'pmc-campaign-key:' + BACKENDS.server.url();
        try { if (v === undefined) return localStorage.getItem(k) || ''; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { }
        return '';
      },
      save: function (c) {
        return fetch(BACKENDS.server.url(), {
          method: 'PUT', headers: { 'content-type': 'application/json', 'x-campaign-key': BACKENDS.server.key() },
          body: JSON.stringify(c)
        }).then(function (r) { if (!r.ok) throw new Error(r.status === 403 ? 'the server says this campaign is someone else\u2019s' : r.status); return r.json(); })
          .then(function (got) { if (got && got.key) BACKENDS.server.key(got.key); return true; });
      },
      clear: function () {
        return fetch(BACKENDS.server.url(), { method: 'DELETE', headers: { 'x-campaign-key': BACKENDS.server.key() } })
          .then(function (r) { if (r.ok) BACKENDS.server.key(null); return r.ok; });
      }
    }
  };
  // the account's copy of the campaign: which one, kept per account and campaign in this browser
  function acctSid(v, lid) {
    if (!acct) return null;
    lid = lid || curLid();
    if (!lid) return null;
    var k = 'pmc-campaign-sid:' + acct.id + ':' + lid;
    if (v === undefined) {
      var got = ls(k);
      // kept by an older build, per account only: it was for the campaign since moved under an id
      var old = 'pmc-campaign-sid:' + acct.id;
      if (!got && ls(old) && ls('pmc-campaign-legacy') === lid) { got = ls(old); ls(k, got); ls(old, null); }
      return got || null;
    }
    ls(k, v ? String(v) : null);
    return null;
  }
  // every account id this browser has a campaign under, for this account
  function acctSids() {
    if (!acct) return {};
    var out = {};
    index().forEach(function (e) { var s = acctSid(undefined, e.lid); if (s) out[s] = e.lid; });
    return out;
  }
  function acctFetch(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    if (opts.body) opts.headers = { 'content-type': 'application/json' };
    return fetch(path, opts).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }, function () { return { ok: r.ok, code: r.status, j: {} }; }); });
  }
  BACKENDS.account = {
    id: 'account', name: 'your account',
    ready: function () { return !!acct; },
    load: function () {
      var get = function (id) {
        return acctFetch('api/campaigns/' + id).then(function (r) {
          if (!r.ok) { if (r.code === 404) acctSid(null); return null; }
          acctVersion = r.j.version; acctSid(r.j.id);
          return r.j.state;
        });
      };
      var sid = acctSid();
      // the account's others are offered in the main menu's Continue list (Store.accountList)
      return sid ? get(sid) : Promise.resolve(null);
    },
    /* One save at a time, each over the version the last one left, so a burst of
       them never trips over itself. One made from an older copy than the server's
       is refused: the newer one is held, and the hub asks which to keep. */
    save: function (c) {
      acctChain = acctChain.catch(function () { }).then(function () {
        if (acctConflict) throw new Error('a newer copy is on the server');
        var sid = acctSid();
        if (!sid) {
          return acctFetch('api/campaigns', { method: 'POST', body: JSON.stringify({ state: c }) }).then(function (r) {
            if (!r.ok) throw new Error(r.j.error || r.code);
            acctSid(r.j.id); acctVersion = r.j.version;
            return true;
          });
        }
        return acctFetch('api/campaigns/' + sid, { method: 'PUT', body: JSON.stringify({ state: c, version: acctVersion }) }).then(function (r) {
          if (r.code === 409) {
            acctConflict = { version: r.j.version, state: r.j.state };
            storeNote = 'This campaign was saved on another device since this one last had it.';
            throw new Error('a newer copy is on the server');
          }
          if (r.code === 404) { acctSid(null); throw new Error('gone from the server'); }
          if (!r.ok) throw new Error(r.j.error || r.code);
          acctVersion = r.j.version;
          return true;
        });
      });
      return acctChain;
    },
    clear: function () {
      var sid = acctSid();
      acctSid(null); acctVersion = 0; acctConflict = null;
      return sid ? acctFetch('api/campaigns/' + sid, { method: 'DELETE' }).then(function () { return true; }) : Promise.resolve(true);
    }
  };
  var ORDER = ['local', 'db', 'server', 'account'];
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
      // signed in on the server this page came from: the account keeps the campaign as well (not a guest's)
      try {
        if (root.location && /^https?:$/.test(root.location.protocol) && root.fetch) {
          var me = await acctFetch('api/me', { cache: 'no-store' });
          acct = me.ok && me.j.who && !me.j.who.guest ? me.j.who : null;
        }
      } catch (e) { acct = null; }
    },
    /* Signed in or out since the page loaded (the main menu's account, or the
       lobby): who the account is asked again. True if it is someone else now. */
    async recheck() {
      var was = acct ? acct.id : null;
      try {
        var me = await acctFetch('api/me', { cache: 'no-store' });
        if (me.code === 401) acct = null;
        else if (me.ok) acct = me.j.who && !me.j.who.guest ? me.j.who : null;
      } catch (e) { /* not reached: as it was */ }
      var now = acct ? acct.id : null;
      if (now !== was) { acctVersion = 0; acctConflict = null; storeNote = ''; }
      return now !== was;
    },
    // a newer copy found on the server on saving: { state }, until the player says which to keep
    conflict: function () { return acctConflict; },
    // keep the server's newer copy (returned, for the dossier to take up), or this one (saved over it)
    resolve: function (useServer) {
      var cf = acctConflict;
      if (!cf) return null;
      acctConflict = null; acctVersion = cf.version; storeNote = '';
      return useServer ? C.rehydrate(cf.state) : null;
    },
    async load() {
      await Store.init();
      var lid = curLid(), legacy = ls('pmc-campaign-legacy');
      if (!lid) { storeNote = ''; return null; }
      // the database's and the server's one campaign, only while it is this one
      var found = (await each(function (b) { return b.load(); }))
        .filter(function (r) { return r && r.value && r.value.companies; })
        .filter(function (r) { return r.id === 'local' || r.id === 'account' || r.value.lid === lid || (!r.value.lid && lid === legacy); });
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
      if (!curLid()) curLid(newLid());
      flat.lid = curLid();
      await each(function (b) { return b.save(flat); });
    },
    // the campaigns this browser keeps, the latest first, and which is open
    list: function () { return index().slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); }); },
    lid: function () { return curLid(); },
    // open another (or none: a new campaign is being begun)
    use: function (lid) { curLid(lid || null); acctVersion = 0; acctConflict = null; storeNote = ''; },
    // this browser's copy of one, read at once (a battle finished for a campaign not open)
    peek: function (lid) { var got = readJSON(ONE + lid); return got && got.companies ? C.rehydrate(got) : null; },
    // one put away from the Continue list: gone from this browser and the account
    drop: function (lid) {
      var sid = acctSid(undefined, lid);
      ls(ONE + lid, null); indexDrop(lid); acctSid(null, lid);
      if (curLid() === lid) curLid(null);
      if (sid && acct) acctFetch('api/campaigns/' + sid, { method: 'DELETE' });
    },
    // the account's campaigns not in this browser: [{ sid, name, turn, updated }]
    accountList: async function () {
      await Store.init();
      if (!acct) return [];
      var have = acctSids();
      try {
        var r = await acctFetch('api/campaigns', { cache: 'no-store' });
        return r.ok ? (r.j.campaigns || []).filter(function (c) { return c.kind !== 'online' && !have[c.id]; })
          .map(function (c) { return { sid: c.id, name: c.name, turn: c.turn, mode: c.kind, updated: c.updated }; }) : [];
      } catch (e) { return []; }
    },
    // whether one is kept by the account too (signed in, and saved there)
    synced: function (lid) { return !!acctSid(undefined, lid); },
    // one of the account's taken up in this browser: given an id here, and opened
    adopt: function (sid) { var lid = newLid(); curLid(lid); acctSid(String(sid), lid); acctVersion = 0; acctConflict = null; return lid; },
    async clear() {
      await each(function (b) { return b.clear(); });
      curLid(null);
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
  /* An online campaign open (dossier-online.js): its id, which side is this
     player's, the version last read, its players. Null otherwise. While one is
     open, nothing is saved here: every change goes to the server as a command. */
  var online = null;
  var view = 'hub';
  var draft = null;             // the company being founded
  var contract = null;          // the battle being set up
  var after = null;             // the aftermath being worked through
  // what each screen has open, kept here so the screens can live in their own files
  var secondFaction = null;       // what the hub said the second player runs, until they found it
  var wantMode = 'solo';          // how a new campaign will be played: the menu card it was opened from
  var wantFaction = 'pmc', wantB = 'pmc';   // what the new campaign's forces will be, as picked so far
  // solo: how many forces share the world with the player's, and what each runs ('' rolled)
  var wantRivals = 3, wantRivalArmies = [];
  var wantRivalColours = [], rivColourFor = null;   // ...their colours ('' rolled), and the one whose picker is open
  var enterCampaign = null;       // the way in, once the screen is wired
  var openModal = null, modalView = null, colourOpen = false, propFor = null;
  var hubPane = 'tier';               // the hub opens on the company
  var rosterTab = 'units';
  var menOpen = {};               // which unit has its details open, by rid (one at a time)
  var showCard = null;            // a card just opened, to be scrolled fully into view
  var promoRid = null;            // the unit whose promotion choices are open
  var rivalOpen = null;           // which other force has its dossier open in its card
  var drawState = null;
  var intelIdx = 0;
  var upState = null;
  var docSide = 'A', docSwap = false, swapOut = null;
  /* In a hotseat campaign, whose force the hub shows and works on: each player runs
     their own roster (hotseat review HC-1). Always 'A' in a solo campaign. */
  var hubSide = 'A';
  function hubCo() { return camp ? camp.companies[camp.mode === 'hotseat' ? hubSide : 'A'] || camp.companies.A : null; }
  /* The dossier's unit list narrowed by the Honours and Trauma figures above
     it: each a toggle, by force ('A', 'B', or a rival's 'r' + its place), and
     with both on, the units that have either. */
  var ufilter = {};
  /* The dossier's own sort and filter (the line above its list): sorted by one
     thing, and narrowed to the types and Tiers ticked (none ticked, all shown). */
  var dsort = 'type', dfilt = { type: {}, tier: {} };
  function dossierOrder(list) {
    function p(e) { return profile(e.key) || {}; }
    function lead(e) { return C.isLeaderP(p(e)) ? 1 : 0; }
    var anyType = Object.keys(dfilt.type).some(function (k) { return dfilt.type[k]; });
    var anyTier = Object.keys(dfilt.tier).some(function (k) { return dfilt.tier[k]; });
    return list.filter(function (e) {
      return (!anyType || dfilt.type[p(e).group || '']) && (!anyTier || dfilt.tier[p(e).tier]);
    }).sort(function (a, b) {
      var byName = String(a.name).localeCompare(String(b.name));
      switch (dsort) {
        case 'name': return byName;
        case 'tier': return p(b).tier - p(a).tier || byName;
        case 'xp': return (b.exp || 0) - (a.exp || 0) || byName;
        case 'tp': return (b.tp || 0) - (a.tp || 0) || byName;
        // by type: the command first, then each group together, the higher Tier first
        default: return lead(b) - lead(a) || String(p(a).group || '').localeCompare(String(p(b).group || '')) ||
          p(b).tier - p(a).tier || (b.exp || 0) - (a.exp || 0);
      }
    });
  }
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
    if (online) return;                 // the server keeps an online campaign (dossier-online.js)
    if (camp && camp.mode === 'hotseat') camp.savedContract = contract && !camp.pending ? contractOut(contract) : null;
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
    if (spec.text) h += '<p' + (spec.danger ? ' class="danger"' : '') + '>' + esc(spec.text) + '</p>';
    if (spec.kind === 'text') {
      h += '<input class="tin" id="ask-input" maxlength="' + (spec.max || 28) + '" value="' +
        esc(spec.value || '') + '">';
    }
    if (spec.kind === 'note') {
      h += '<div class="askrow"><button class="start" data-ask="close">Close</button></div>';
    } else {
      // Cancel on the left, the main action filling the rest (as every question has it)
      h += '<div class="askrow">' +
        '<button class="lnk" data-ask="close">Cancel</button>' +
        '<button class="start' + (spec.danger ? ' danger' : '') + '" data-ask="ok">' +
        esc(spec.okLabel || 'Confirm') + '</button></div>';
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
    var bars = '';
    if (!C.isLeaderP(p) && !(co.faction === 'xeno' && (p.rules || []).indexOf('Turret') >= 0)) {
      bars += '<div class="dbars">' +
        '<span class="dexp">' + e.exp + ' EXP</span>';
      if (!machine || C.takesHonours(p)) {
        var pct = Math.min(100, Math.round(100 * e.tp / threshold));
        bars += '<span class="dtp" title="' + e.tp + ' of ' + threshold + ' Trauma Points">' +
          '<i style="width:' + pct + '%"></i></span><span class="dtpn">' + e.tp + '/' + threshold + ' TP</span>';
      }
      bars += '</div>';
    }                                                // a command unit or a turret: no experience bars, and nothing said about it
    /* The unit's own buttons (icons) sit at the right end of the line with its
       experience and trauma, across the whole card, open or closed; opened, the
       unit's picture is centred under it (stack) rather than beside it (split). */
    var stack = !!opts.rowActs;
    if (stack) {
      /* Closed with nothing to press, a card keeps the button's room (unseen),
         so every TP bar in the list is cut to the same width. */
      if (opts.men) {
        /* Opened: its buttons in a column down the right, and under the name
           its EXP/TP (clear of the column) and the unit's picture, centred on
           the card. */
        h += '<div class="dopen">' + (opts.actions ? '<div class="dacts dvert">' + opts.actions + '</div>' : '');
        bars = bars ? '<div class="drow">' + bars + '</div>' : '';
      } else {
        var acts = opts.actions || (bars ? '<span class="lnk dact dact-ph" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span>' : '');
        bars = bars || acts ? '<div class="drow shut">' + bars + (acts ? '<div class="dacts">' + acts + '</div>' : '') + '</div>' : '';
      }
    }
    if (opts.portrait && !stack) h += '<div class="dsplit"><div class="dleft">';
    h += bars;
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
    // (opened, they are written out in full on the sheet below instead)
    if (marks.length && !opts.men) h += '<div class="dmarks">' + marks.join('') + '</div>';
    if (opts.actions && !opts.rowActs) h += '<div class="dacts">' + opts.actions + '</div>';
    if (opts.portrait) {
      h += (stack ? '<div class="dpic">' : '</div>') + '<canvas class="dportrait" data-key="' + esc(e.key) + '" data-side="' + (co === (camp && camp.companies.B) ? 'B' : 'A') + '"' +
        ' data-colour="' + esc(colourOf(co)) + '"' + (e.prop ? ' data-prop="' + esc(e.prop) + '"' : '') + (e.drone ? ' data-drone="1"' : '') +
        (e.riders ? ' data-riders="1"' : '') + (e.mount ? ' data-mount="' + esc(e.mount) + '"' : '') +
        ' role="img" aria-label="' + esc(p.name) + '"></canvas></div>';
    }
    if (stack && opts.men) h += '</div>';                // the opened card's top (dopen)
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
      get wantRivals() { return wantRivals; }, get wantRivalArmies() { return wantRivalArmies; },
      get wantRivalColours() { return wantRivalColours; }, get rivColourFor() { return rivColourFor; },
      get hubPane() { return hubPane; }, get promoRid() { return promoRid; },
      get hubSide() { return camp && camp.mode === 'hotseat' ? hubSide : 'A'; },
      get rivalOpen() { return rivalOpen; }, get ufilter() { return ufilter; }, unitPasses: unitPasses,
      get dsort() { return dsort; }, get dfilt() { return dfilt; }, get rosterTab() { return rosterTab; },
      get online() { return online; }, onlineNote: function () { return online ? (KIT_ONLINE || kitOnline()).hubNote() : ''; }
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
      get view() { return view; }, set view(v) { view = v; }, get online() { return online; },
      get propFor() { return propFor; }
    }));
  }
  function beginOwn(side, faction) { return (KIT_FOUND || kitFound()).beginOwn(side, faction); }
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
      get hubSide() { return camp && camp.mode === 'hotseat' ? hubSide : 'A'; },
      get rosterTab() { return rosterTab; }, get camp() { return camp; }, unitPasses: unitPasses,
      dossierOrder: dossierOrder
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
  // whose list the contract screen is filling: Player 2's, once a hotseat hands over
  function pickCo() { return camp.companies[contract && contract.side === 'B' ? 'B' : 'A']; }
  /* ---- the campaign after a battle: in view/dossier-after.js ---- */
  var KIT_AFTER = null;
  function kitAfter() {
    return KIT_AFTER || (KIT_AFTER = root.PMCDossierAfter({
      C: C, ROMAN: ROMAN, coin: coin, colourFlash: colourFlash, entryCard: entryCard, esc: esc, open: open,
      profile: profile, save: save, tip: tip, get after() { return after; }, set after(v) { after = v; },
      get camp() { return camp; }, get docSide() { return docSide; }, get docSwap() { return docSwap; },
      get drawState() { return drawState; }, get intelIdx() { return intelIdx; },
      get swapOut() { return swapOut; }, get upState() { return upState; },
      get view() { return view; }, set view(v) { view = v; }, render: function () { render(); },
      get hubSide() { return camp && camp.mode === 'hotseat' ? hubSide : 'A'; }, stripeOf: stripeOf,
      get online() { return online; }
    }));
  }
  /* ---- online campaigns: in view/dossier-online.js ---- */
  var KIT_ONLINE = null;
  function kitOnline() {
    return KIT_ONLINE || (KIT_ONLINE = root.PMCDossierOnline({
      C: C, R: R, ROMAN: ROMAN, esc: esc, note: note, ask: ask, tip: tip, profile: profile, root: root,
      get camp() { return camp; }, set camp(v) { camp = v; }, get view() { return view; }, set view(v) { view = v; },
      get draft() { return draft; }, set draft(v) { draft = v; }, get online() { return online; }, set online(v) { online = v; },
      set hubSide(v) { hubSide = v === 'B' ? 'B' : 'A'; }, get drawState() { return drawState; }, get upState() { return upState; },
      get swapOut() { return swapOut; },
      render: function () { render(); }, open: open, toMenu: toMenu, keepFoundName: keepFoundName, beginOwn: beginOwn,
      postView: function () { return postView(); }, offersView: function () { return offersView(); }, stripe: stripe, statRow: statRow, showPast: function (i) { (KIT_AFTER || kitAfter()).showPast(i); },
      hide: function () { el('camp').hidden = true; }, isOpen: function () { return !!el('camp') && !el('camp').hidden; },
      asking: function () { return !!asking; },
      closeModal: function () { openModal = null; promoRid = null; },
      toDossier: function () { view = 'hub'; hubPane = 'dossier'; rosterTab = 'units'; },
      clearSwap: function () { swapOut = null; docSwap = false; },
      closeColours: function () { colourOpen = false; }
    }));
  }
  // the battle fought: its contract is done with (a kept one included)
  function onFinish(report, cfg) {
    /* A battle fought for a campaign not the one open (another was opened while it
       was on): that campaign is opened to take the result. */
    if (cfg && cfg.campLid && cfg.campLid !== Store.lid()) {
      if (online && KIT_ONLINE) KIT_ONLINE.leave();
      Store.use(cfg.campLid); camp = Store.peek(cfg.campLid); view = 'hub'; after = null; draft = null; hubSide = 'A';
    }
    contract = null; if (camp) camp.savedContract = null; return (KIT_AFTER || kitAfter()).onFinish(report); }
  /* A hotseat contract is kept with the campaign while it is being drawn up (hotseat
     review HC-6): a reload finds it as it was — the terms, the roles, both players'
     picks — and going back to the hub and in again does not roll it afresh. The
     picks are kept as rids and found in the rosters again on loading. */
  // written whenever it has changed, while it is on screen
  var keptContract = null;
  function keepContract() {
    if (!camp || camp.mode !== 'hotseat' || !contract || camp.pending) return;
    var now = JSON.stringify(contractOut(contract));
    if (now !== keptContract) { keptContract = now; save(); }
  }
  function contractOut(k) {
    return JSON.parse(JSON.stringify(k, function (key, v) {
      return key === 'picks' ? (v || []).map(function (e) { return e && e.rid; }) : v;
    }));
  }
  function contractIn(o) {
    if (!o || !camp) return null;
    var back = function (rids, co) { return (rids || []).map(function (r) { return C.byRid(co, r); }).filter(Boolean); };
    o.picks = back(o.picks, camp.companies[o.side === 'B' ? 'B' : 'A']);
    if (o.first) o.first.picks = back(o.first.picks, camp.companies.A);
    return o;
  }
  function postView() { return (KIT_AFTER || kitAfter()).postView(); }
  function aftermathView() { return (KIT_AFTER || kitAfter()).aftermathView(); }
  function honourView() { return (KIT_AFTER || kitAfter()).honourView(); }
  function intelView() { return (KIT_AFTER || kitAfter()).intelView(); }
  function upgradeView() { return (KIT_AFTER || kitAfter()).upgradeView(); }
  function doctrineView() { return (KIT_AFTER || kitAfter()).doctrineView(); }
  /* ================= render and wiring ================= */
  /* Two players at one device: the contract changes hands between them (Player 1
     picks, hands over, perhaps gets it back), and each time the screen asks for the
     device to be passed before it shows the next player's (hotseat review, phase 3). */
  var contractSeen = null;
  function passOwed() {
    if (!camp || camp.mode !== 'hotseat' || !contract || root.PMC_HANDOVER_OFF) return false;
    return (contract.side === 'B' ? 'B' : 'A') !== contractSeen;
  }
  function passCard() {
    var sd = contract.side === 'B' ? 'B' : 'A', co = camp.companies[sd];
    return '<h2>Contract</h2><button type="button" class="passcard" data-go="passok" data-seat="' + sd + '"' + stripeOf(co) + '>' +
      '<small>Pass the device to</small><b>' + esc(co.name) + '</b><span>Player ' + (sd === 'A' ? 1 : 2) + ' \u2014 tap when ready.</span></button>';
  }
  function stripeOf(co) {
    var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, c = CO[co && co.colour];
    return c ? ' style="background:' + c.dark + ';color:' + c.light + ';border-color:' + c.light + '"' : '';
  }
  function render() {
    var body = el('camp-body');
    if (view !== 'contract') contractSeen = null;          // the next contract asks for the device again
    if (!body) return;
    var h = '';
    if (view !== 'hub') hubPane = 'tier';                    // back at the hub, it opens on the company
    if (view !== 'found' && !online && needsSecond()) beginSecond();   // nothing goes on until both forces exist
    if (online) (KIT_ONLINE || kitOnline()).steer();          // online: the player's own force first, then what is owed
    if (camp && camp.post && view !== 'post') view = 'post';  // a post-battle choice is still owed
    if (view !== 'aftermath' && KIT_AFTER) KIT_AFTER.showPast(null);   // a past battle's report is only open while it is shown
    if (camp && camp.fronts && !camp.post) (KIT_AFTER || kitAfter()).nextFront();   // the other forces' battles, still being fought
    else if (view === 'olobby' && online) h = kitOnline().lobbyView();
    else if (view === 'offers' && online) h = kitOnline().offersView();
    else if (view === 'ocontract' && online) h = kitOnline().contractView();
    else if (view === 'post' && online) h = kitOnline().postView();
    else if (view === 'found') h = foundView();
    else if (view === 'offers') h = offersView();
    else if (view === 'contract') { h = passOwed() ? passCard() : contractView(); keepContract(); }
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
    if (view !== modalView) { openModal = null; colourOpen = false; propFor = null; }   // a new screen starts with nothing open over it
    modalView = view;
    // a pick in an open list redraws it: keep it where it was scrolled to
    var ms = body.querySelector('.cmodal:not([hidden]) .cmodal-scroll'), mTop = ms ? ms.scrollTop : 0, mKind = openModal;
    body.classList.toggle('fit', view === 'found' || view === 'contract' || view === 'honour' || view === 'olobby');
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
    placeDrives(body);
    placeRivPop(body);
    paintPortraits(body);
    var ms2 = body.querySelector('.cmodal:not([hidden]) .cmodal-scroll');
    if (ms2 && mKind === openModal) ms2.scrollTop = mTop;
    var way = body.querySelector('.camp-foot [data-go="hub"], .camp-foot [data-go="menu"], .camp-foot [data-go="foundback"], .camp-foot [data-go="roster"], .camp-foot [data-go="pastback"], .camp-foot [data-go="seatback"], .camp-foot [data-go="omulti"]'), bk = el('camp-back');
    bk.hidden = !way;
    if (way) bk.setAttribute('data-go', way.getAttribute('data-go'));
    if (way && root.PMC_BACK_LABEL) root.PMC_BACK_LABEL(bk, way.getAttribute('data-go') === 'menu');
  }

  /* A unit's drives, opened: put by its icon (fixed, so a scrolling list does not
     cut them off), under it, or over it when there is no room below. */
  function placeDrives(body) {
    body.querySelectorAll('.propop').forEach(function (pop) {
      var btn = pop.parentNode.querySelector('[data-fprop]');
      if (!btn || !btn.offsetParent) { pop.remove(); return; }       // the copy in a closed modal
      var r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      var left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12));
      var top = r.bottom + 6 + h > innerHeight - 8 ? Math.max(8, r.top - 6 - h) : r.bottom + 6;
      pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility = 'visible';
    });
  }
  // an AI force's colours on the new-campaign page: fixed by its chip, as the online lobby's are
  function placeRivPop(body) {
    var pop = body.querySelector('.olob-pop[data-rivpop]'); if (!pop) return;
    var chip = body.querySelector('[data-go="rivcolour"][data-i="' + pop.getAttribute('data-rivpop') + '"]'); if (!chip) return;
    var r = chip.getBoundingClientRect(), b = body.getBoundingClientRect(), w = Math.min(380, b.width - 16);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(b.left + 8, Math.min(r.left, b.right - w - 8)) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
  }
  function findEntry(co, rid) { return C.byRid(co, rid); }

  /* A unit opened on the roster, drawn by the game's own renderer as the unit
     atlas draws it: a squad ready, a machine facing south-east on its running
     gear, in the force's colours, and riding whatever it rides. */
  // the box round everything drawn on a canvas (any pixel not all but transparent), or null
  function inked(g, w, h) {
    var d = g.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
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
      /* Drawn first off the card, with room all round, and then centred on the
         card by what was actually drawn (the figures, their ring, a flier high
         over its shadow), made smaller only if it would not fit. Where the
         pixels cannot be read back, it is placed by its ground line as before. */
      try {
        var off = document.createElement('canvas');
        off.width = Math.round(W * 3 * dpr); off.height = Math.round(H * 4 * dpr);
        var og = off.getContext('2d');
        og.setTransform(mag * dpr, 0, 0, mag * dpr, (W * 1.5 - s0.x * mag) * dpr, (H * 2.4 - s0.y * mag) * dpr);
        I.drawUnit(og, u, { at: { x: 10, y: 10 }, lift: 0, status: 'ready', morale: 0 });
        var box = inked(og, off.width, off.height);
        if (!box) throw new Error('nothing drawn');
        var pad = 6 * dpr, k = Math.min(1, (cv.width - 2 * pad) / box.w, (cv.height - 2 * pad) / box.h);
        var dw = box.w * k, dh = box.h * k;
        g.drawImage(off, box.x, box.y, box.w, box.h, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      } catch (err) {
        try {
          g.setTransform(mag * dpr, 0, 0, mag * dpr, (W / 2 - s0.x * mag) * dpr, (ground - s0.y * mag) * dpr);
          I.drawUnit(g, u, { at: { x: 10, y: 10 }, lift: 0, status: 'ready', morale: 0 });
        } catch (err2) { if (root.console) console.error(p.key, err2); }
      }
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
    // an AI force's colours, popped up by its chip on the new-campaign page: a tap anywhere else puts them away
    if (rivColourFor !== null && !ev.target.closest('.olob-pop') && !(t && t.getAttribute('data-go') === 'rivcolour')) {
      rivColourFor = null; render();
      if (!t) return;
    }
    // a unit's drives, opened beside its icon: a tap anywhere else puts them away
    if (propFor !== null && !ev.target.closest('.propop') && !(t && t.hasAttribute('data-fprop'))) {
      keepFoundName(); propFor = null; render();
      if (!t) return;
    }
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
    var co = hubCo();
    var go = t.getAttribute('data-go');
    // an online campaign: whatever would change it is sent to the server (dossier-online.js)
    if (online && kitOnline().click(t, go)) return;

    if (t.hasAttribute('data-add')) {
      draft.keys.push(t.getAttribute('data-add')); render(); return;
    }
    if (t.hasAttribute('data-drop')) {
      draft.keys.splice(+t.getAttribute('data-drop'), 1); propFor = null; render(); return;
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
    if (t.hasAttribute('data-fprop')) {
      var fpi = +t.getAttribute('data-fprop');
      keepFoundName(); propFor = propFor === fpi ? null : fpi; render(); return;
    }
    if (t.hasAttribute('data-fpropset')) {
      var fsi = +t.getAttribute('data-fpropset'), fs = R.splitPick(draft.keys[fsi]);
      draft.keys[fsi] = R.joinPick(fs.key, t.getAttribute('data-prop'), fs.drone, fs.riders, fs.mount);
      keepFoundName(); propFor = null; render(); return;
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
    // Foresighted Command with both holding it: the side whose turn it is ignores a die (XEN-11)
    if (t.hasAttribute('data-forego') && contract && contract.fore && !contract.fore.done) {
      var ff = contract.fore, fWho = ff.order[ff.ignored.length], wasScen = contract.scenario;
      if (!C.foreIgnore(contract, fWho, +t.getAttribute('data-forego'), camp.mode !== 'hotseat')) return;
      if (ff.done && (contract.roles || camp.mode === 'hotseat') && (!contract.roles || !wasScen || wasScen.id !== contract.scenario.id)) {
        var SCf = root.PMCScen;
        contract.roles = SCf && SCf.rollRoles ? SCf.rollRoles(contract.scenario.id,
          { A: camp.companies.A.doctrines || [], B: camp.companies.B.doctrines || [] }, null, camp.mode === 'hotseat' ? ['A', 'B'] : ['A']) : contract.roles;
      }
      save(); render(); return;
    }
    if (t.hasAttribute('data-foresee') && contract && contract.alt) {
      var was = contract.scenario, wasRoles = contract.roles;
      contract.scenario = contract.alt; contract.alt = was;
      var SCx = root.PMCScen;
      contract.roles = !wasRoles && camp.mode !== 'hotseat' ? null : contract.altRoles || (SCx && SCx.rollRoles ? SCx.rollRoles(contract.scenario.id,
        { A: camp.companies.A.doctrines || [], B: camp.companies.B.doctrines || [] }, null, camp.mode === 'hotseat' ? ['A', 'B'] : ['A']) : null);
      contract.altRoles = wasRoles;
      /* Player 2's own Foresighted Command, after Player 1 has picked their force for
         the other scenario: the screen goes back to Player 1 to look again (HC-10),
         and the choice is made once. */
      if (contract.side === 'B' && contract.first && (contract.altBy || 'A') === 'B') {
        contract.altUsed = true;
        contract.foreBack = camp.companies.B.name + ' used Foresighted Command: the scenario is now ' + contract.scenario.name +
          ' (was ' + was.name + '). Check your force, then hand over again.';
        (KIT_CONTRACT || kitContract()).seatBack();
        save();
      }
      render(); return;
    }
    // a new campaign's opposing force: its colours picked (or left to be rolled)
    if (t.hasAttribute('data-rivpick') && rivColourFor !== null) {
      wantRivalColours[rivColourFor] = t.getAttribute('data-rivpick') || '';
      rivColourFor = null; render(); return;
    }
    if (t.hasAttribute('data-rtab')) { rosterTab = t.getAttribute('data-rtab'); openModal = null; render(); return; }
    if (t.hasAttribute('data-recruit')) {
      // recruiting spends the money: say what it costs, and what there is, before it is spent
      var rk = t.getAttribute('data-recruit'), asDrone = t.hasAttribute('data-asdrone'), asRiders = t.hasAttribute('data-asriders');
      var rp = profile(rk), rcost = C.recruitCost(co, rk), purse = co.kUC, coinWord = C.money(co);
      ask({
        kind: 'confirm', title: C.words(co).recruit + ' ' + rp.name + (asDrone ? ' (drone)' : asRiders ? ' (Riders)' : '') + '?',
        text: (rcost ? 'It costs ' + rcost + ' ' + coinWord + '. You have ' + purse + ' ' + coinWord +
          ', leaving ' + (purse - rcost) + ' ' + coinWord + '.' : 'It costs nothing. You have ' + purse + ' ' + coinWord + '.'),
        okLabel: C.words(co).recruit + (rcost ? ' for ' + rcost + ' ' + coinWord : ''),
        onOk: function () { C.recruit(co, rk, { drone: asDrone, riders: asRiders }); save(); render(); }
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
    // a mounted unit on the roster changes what it rides
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
      var pk = findEntry(pickCo(), t.getAttribute('data-pick'));
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
      /* On Our Terms… (dossier-contract.js): who holds it decides what a click means */
      var dir = +t.getAttribute('data-tier'), byB = contract.side === 'B', was = contract.tier;
      var terms = contract.terms || (contract.terms = {});
      var mine = camp.companies[byB ? 'B' : 'A'], theirs = camp.companies[byB ? 'A' : 'B'];
      var both = C.hasDoctrine(mine, 'S4') && C.hasDoctrine(theirs, 'S4');
      var shift = function (d) {
        contract.tier = Math.max(1, Math.min(contract.tierRoll.cap, contract.tier + d));
        contract.levels = C.levelsFor(camp.companies.A, camp.companies.B, contract.tier);
        if (contract.levels.indexOf(contract.pl) < 0) contract.pl = contract.levels[0] || 1;
        contract.picks = [];
      };
      if (both && !byB) { terms.A = dir; save(); render(); return; }    /* a vote, settled on Player 2's */
      if (both) {
        terms.B = dir; terms.done = true;
        if (dir && dir === (terms.A || 0)) shift(dir);
        else terms.noteB = 'You chose ' + (dir < 0 ? 'down' : 'up') + ', ' + camp.companies.A.name + ' chose ' +
          (terms.A ? (terms.A < 0 ? 'down' : 'up') : 'to keep it') + ': the Battle Tier stays at ' + R.ROMAN[was] + '.';
      } else {
        shift(dir);
        if (byB) terms.B = dir; else terms.done = true;
      }
      /* Player 2 has changed the terms Player 1 picked a force on: back to Player 1,
         to pick again for the new Tier and hand over once more */
      if (byB && contract.first && contract.tier !== was) {
        terms.done = true;
        terms.note = camp.companies.B.name + (both ? ' agreed: ' : ' used On Our Terms\u2026: ') + 'the Battle Tier is now ' +
          R.ROMAN[contract.tier] + ' (was ' + R.ROMAN[was] + '). Pick your force again, then hand over.';
        contract.side = 'A'; contract.tactic = contract.first.tactic; contract.drugs = [];
        delete contract.first;
      }
      save(); render(); return;
    }
    if (t.hasAttribute('data-bfaction')) {
      keepFoundName();
      var keepName = draft.name, keepColour = draft.colour, chosen = draft.colourChosen;
      beginSecond(t.getAttribute('data-bfaction'));
      // an unchosen colour follows the kind of force (a swarm defaults to olive); a chosen one is kept
      draft.name = keepName;
      if (chosen) { draft.colour = keepColour; draft.colourChosen = true; }
      save(); render(); return;                            // kept across a reload (HC-13)
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
      case 'rivcolour': { var rci = +t.getAttribute('data-i') || 0; rivColourFor = rivColourFor === rci ? null : rci; render(); return; }
      // hotseat: Player 1's aftermath read, the device goes to Player 2 for theirs (HC-4)
      case 'afternext': case 'afterpass': case 'postpass': (KIT_AFTER || kitAfter()).afterTurn(go, t.getAttribute('data-seat')); render(); return;
      case 'passok': contractSeen = t.getAttribute('data-seat') === 'B' ? 'B' : 'A'; render(); return;
      // hotseat: the hub turns to the other player's force (HC-1)
      case 'hubside': hubSide = t.getAttribute('data-hs') === 'B' ? 'B' : 'A'; colourOpen = false; promoRid = null; openModal = null; render(); return;
      case 'fmodal': openModal = t.getAttribute('data-kind'); render(); return;
      // the dossier's sort (one at a time) and filter (as many as ticked), from their popups
      case 'dsort': dsort = t.getAttribute('data-by') || 'type'; render(); return;
      case 'dfilt': {
        var dk = t.getAttribute('data-kind'), dv = t.getAttribute('data-val');
        dfilt[dk][dv] = !dfilt[dk][dv];
        render(); return;
      }
      case 'dfiltclear': dfilt = { type: {}, tier: {} }; ufilter[camp && camp.mode === 'hotseat' ? hubSide : 'A'] = {}; render(); return;
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
        beginFounding('', wantMode === 'hotseat' ? 'hotseat' : 'solo', fac);
        draft.archs = [];                          // the world is always rolled
        draft.rivals = { n: wantRivals, factions: wantRivalArmies.slice(0, wantRivals), colours: wantRivalColours.slice(0, wantRivals) };
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
          foundRival(draft.archs, draft.rivals);
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
        // from a hotseat aftermath, the dossier is that of the player who just read it
        if (view === 'aftermath' && camp.mode === 'hotseat') hubSide = (KIT_AFTER || kitAfter()).afterSide;
        // from the hub, the Dossier button swaps the Tier panel for the dossier and back again
        if (view === 'hub' && hubPane === 'dossier') hubPane = 'tier';
        else { hubPane = 'dossier'; if (view === 'hub') rosterTab = 'units'; }
        view = 'hub'; render(); return;
      case 'intel': view = 'intel'; render(); return;
      case 'offers': if (camp.over) return; view = 'offers'; render(); return;
      case 'contract': if (camp.over) return; beginContract(); render(); return;
      // a force finished: the campaign is over, and says who outlasted whom (HC-14)
      case 'campend': {
        var ls = t.getAttribute('data-side') === 'B' ? 'B' : 'A', lco = camp.companies[ls];
        if (!C.cannotFight(lco)) return;
        var wco = camp.mode === 'hotseat' ? camp.companies[ls === 'A' ? 'B' : 'A'] : null;
        camp.over = { loser: ls, winner: wco ? (ls === 'A' ? 'B' : 'A') : null, turn: camp.turn,
          text: lco.name + ' could no longer field an army' + (wco ? ': ' + wco.name + ' outlasted them' : '') + ', after ' + (camp.log || []).length + ' battles.' };
        save(); render(); return;
      }
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
        var rbs = (KIT_AFTER || kitAfter()).afterSide;     // whoever's aftermath is on screen (hotseat: either player)
        var ro = after && after.sides[rbs] && after.sides[rbs].rebornOffer, oi = +t.getAttribute('data-i');
        if (!ro || !ro[oi]) return;
        var rr = C.rebirth(camp.companies[rbs], ro[oi]);
        if (!rr.ok) { note('Enhanced Genetic Memory', rr.why); return; }
        save(); render(); return;
      }
      case 'postnext':
        if (camp.post) { camp.post.steps.shift(); save(); render(); }
        return;
      case 'autopick': contract.picks = autoPick(pickCo(), contract.tier, contract.pl, contract.tactic || null); render(); return;
      case 'standard':
        if (!contract || !C.canStandard(camp.companies.A, camp.companies.B)) return;
        contract.standard = true; contract.tier = 3; contract.pl = 2; contract.levels = [2];
        contract.tierRoll = { roll: 3, cap: 3, tier: 3, standing: 3, thin: false };
        contract.terms = { done: true }; contract.picks = [];
        render(); return;
      case 'fight':
        if (t.getAttribute('aria-disabled') === 'true') { if (root.PMCTips) root.PMCTips.show(t); return; }
        if (fight()) { save(); render(); }
        return;
      case 'seatback':
        if ((KIT_CONTRACT || kitContract()).seatBack()) render();
        return;
      case 'drawnow': {
        if ((drawState.picked || []).length !== 3) return;
        var won = C.chooseHonour(drawState.picked.map(function (n) { return C.honourTable(drawState.entry.key)[n - 1]; }));
        C.takeHonour(hubCo(), drawState.entry, won.n);
        drawState.won = won; save(); render(); return;
      }
      case 'hub': view = 'hub'; render(); return;
      // the account's copy was saved on another device since: take that one up, or save this one over it
      case 'storeuse': { var newer = Store.resolve(true); if (newer) { camp = newer; contract = null; } render(); return; }
      case 'storekeep': Store.resolve(false); save(); render(); return;
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
  function foundRival(archIds, want) {
    C.foundRivals(camp, want && want.n, want ? { factions: want.factions } : null);
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
    /* The colours picked for them on the new-campaign form: theirs, unless the
       player's own force has taken them (or another force has); the rest are
       given what is still free (ensureColours, below). */
    var picked = (want && want.colours) || [], taken = [camp.companies.A.colour];
    camp.rivals.forEach(function (r, i) {
      var k = picked[i];
      if (k && taken.indexOf(k) < 0) { r.colour = k; taken.push(k); }
    });
    camp.rivals.forEach(function (r, i) {
      if (picked[i] && r.colour === picked[i]) return;
      r.colour = freeColour(taken); taken.push(r.colour);
    });
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
    var name = 'pmc-campaign-' + ((camp.companies.A.name || 'company') + (camp.mode === 'hotseat' && camp.companies.B ? '-v-' + (camp.companies.B.name || '') : '')).replace(/\W+/g, '-').toLowerCase() + '.json';
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
    // a unit's drives stay by their icon as the list under them scrolls
    host.addEventListener('scroll', function () { if (propFor !== null) placeDrives(el('camp-body')); if (rivColourFor !== null) placeRivPop(el('camp-body')); }, true);
    host.addEventListener('keydown', function (ev) {
      // an online campaign's lobby chat: Enter sends the line
      if (ev.key === 'Enter' && ev.target && ev.target.id === 'olob-say' && !asking) {
        ev.preventDefault();
        var send = el('camp-body').querySelector('[data-go="olobsay"]');
        if (send) send.click();
        return;
      }
      // its name, typed by the host: Enter puts it to the server (on change)
      if (ev.key === 'Enter' && ev.target && ev.target.id === 'olob-name' && !asking) { ev.preventDefault(); ev.target.blur(); return; }
      if (ev.key === 'Escape' && openModal) { ev.preventDefault(); openModal = null; render(); return; }
      if (!asking) return;
      if (ev.key === 'Enter') { ev.preventDefault(); answerAsk(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeAsk(); }
    });
    host.addEventListener('change', function (ev) {
      if (online && kitOnline().change(ev.target)) return;
      if (ev.target.id === 'camp-file') onFile(ev);
      // the army picked: its pill (and the rules behind it) follows
      else if (ev.target.id === 'camp-faction') { wantFaction = ev.target.value; render(); }
      else if (ev.target.id === 'camp-bfaction') { wantB = ev.target.value; render(); }
      // solo: how many opposing forces, and what each of them runs
      else if (ev.target.id === 'camp-rivals') { wantRivals = +ev.target.value || 3; render(); }
      else if (ev.target.classList && ev.target.classList.contains('rivarmy')) { wantRivalArmies[+ev.target.getAttribute('data-i')] = ev.target.value; }
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
      // the campaigns played online, each player on their own device (dossier-online.js)
      if (mode === 'online') { var su = el('setup'); if (su) su.hidden = true; kitOnline().enterList(); return; }
      if (online) kitOnline().leave();                // back to this browser's own campaign
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
      if (camp && camp.pending && resumeItsBattle()) return;
      if (camp && camp.pending) { camp.pending = null; save(); }   // a battle abandoned mid-flight
      open(view === 'aftermath' ? 'aftermath' : 'hub');
    }
    /* The campaign's battle, kept in this browser while something else was played:
       gone back to (game.js plays it back up). */
    function resumeItsBattle() {
      var b = keptBattle();
      return !!(b && root.PMC_RESUME_BATTLE && root.PMC_RESUME_BATTLE(b.id));
    }
    /* The menu's Campaign cards begin a new campaign: the one open is put aside
       (kept, and in the Continue list) and the new-campaign form comes up. */
    function fresh(mode) {
      if (online) kitOnline().leave();
      var setup = el('setup');
      if (setup) setup.hidden = true;
      wantMode = mode === 'hotseat' ? 'hotseat' : 'solo';
      Store.use(null);
      camp = null; reset();
      open('hub');
    }
    // another campaign of this browser's, from the Continue list (or one of the account's, taken up here)
    function resume(lid, sid) {
      if (online) kitOnline().leave();
      var setup = el('setup');
      if (setup) setup.hidden = true;
      if (sid) Store.adopt(sid); else Store.use(lid);
      camp = null; reset();
      return Store.load().then(function (got) {
        took(got);
        // its battle on the table now: back to it
        var st = root.PMC_STATE && root.PMC_STATE();
        if (camp && camp.pending && st && st.cfg && st.cfg.campaign && st.cfg.campLid === Store.lid() && root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE()) {
          if (root.PMCMenu) root.PMCMenu.close();
          return;
        }
        enter();
      });
    }
    // what one campaign had open is not carried into another
    function reset() {
      contract = null; after = null; draft = null; secondFaction = null; openModal = null;
      view = 'hub'; hubSide = 'A'; drawState = null; upState = null;
    }
    // the main menu's cards say which way of playing they are for (menu.js calls in)
    enterCampaign = enter;
    // the muster sheet covers the header on a fresh load, so it needs its own way in
    var setupBtn = el('btn-setup-campaign');
    if (setupBtn) setupBtn.addEventListener('click', enter);
    function took(got) {
      camp = got;
      // a battle abandoned mid-flight — unless it was kept, and is waiting to be gone back to
      if (camp && camp.pending && !keptBattle()) camp.pending = null;
      if (camp && camp.companies && C.evenWorld(camp)) save();   // a campaign from before the forces paired off
      if (camp && camp.mode === 'hotseat' && camp.savedContract && !camp.pending) contract = contractIn(camp.savedContract);
      ensureColours();
      if (needsSecond()) beginSecond();                // the second player had not founded yet
      render();
    }
    Store.load().then(took);
    enterFresh = fresh; enterResume = resume;
  }
  /* The battle kept in this browser for the campaign open, if there is one (one
     kept by an older build says only that it was a campaign's). */
  function keptBattle() {
    var lid = Store.lid(), all = (root.PMCNet && root.PMCNet.savedBattles && root.PMCNet.savedBattles()) || [];
    for (var i = 0; i < all.length; i++) if (all[i].campaign && (all[i].campLid === lid || !all[i].campLid)) return all[i];
    return null;
  }
  var enterFresh = null, enterResume = null;

  // the tests' hooks into the dossier (testhooks.js, not in the published builds)
  if (root.PMCTestHooks) root.PMCTestHooks.dossier({
    get camp() { return camp; }, get contract() { return contract; }, autoPick: autoPick, render: render, C: C
  });
  root.PMC_CAMPAIGN = {
    open: open, close: close, onFinish: onFinish,
    enter: function (mode) { if (enterCampaign) enterCampaign(mode); },
    // a new campaign begun from the menu's cards, and one gone back to from its Continue list
    fresh: function (mode) { if (enterFresh) enterFresh(mode); },
    resume: function (lid) { return enterResume ? enterResume(lid) : null; },
    adopt: function (sid) { return enterResume ? enterResume(null, sid) : null; },
    openOnline: function (id) { var su = el('setup'); if (su) su.hidden = true; return kitOnline().openOne(id); },
    newOnline: function (how) { var su = el('setup'); if (su) su.hidden = true; return kitOnline().startNew(how); },
    lid: function () { return Store.lid(); },
    list: function () { return Store.list(); },
    accountList: function () { return Store.accountList(); },
    synced: function (lid) { return Store.synced(lid); },
    drop: function (lid) {
      if (lid === Store.lid() && !online) { camp = null; contract = null; }
      Store.drop(lid);
    },
    get: function () { return online && KIT_ONLINE ? KIT_ONLINE.local() : camp; },
    /* Signed in (or out) from the menu: the account's copy is read as at a load,
       the further along of it and this browser's taken, and saved to both. */
    accountChanged: function () {
      Store.recheck().then(function (changed) {
        if (!changed || !acct || online) return;
        Store.load().then(function (got) {
          if (got) camp = got;
          ensureColours();
          if (camp) save();
        });
      });
    },
    set: function (c) { camp = c; save(); render(); },
    contract: function () { return contract; },           // the test harness's view of the contract on screen
    dropContract: function () { contract = null; if (camp) camp.savedContract = null; },   // and a fresh one next time
    // the test harness's way to fill a contract's list (as the rival picks its own)
    autopick: function () {
      if (!contract || !camp) return false;
      contract.picks = autoPick(pickCo(), contract.tier, contract.pl, contract.tactic || null);
      render(); return true;
    },
    store: Store,
    // the tests' view of an online campaign open here: which, the campaign as read, and the screen
    online: function () { return online ? { info: online, camp: camp, view: view } : null; }
  };
  root.PMC_ONFINISH = onFinish;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
