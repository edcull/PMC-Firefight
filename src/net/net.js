/* The client's end of the wire.

   Two transports, one protocol. `Remote` is a WebSocket to a server running
   engine.js; `Local` is engine.js running in this tab behind the same message
   names, for a solitaire or hotseat game and for the published single-file
   build, which has no server to talk to. Everything above this — the lobby
   screen, the setup screen, the board — cannot tell the difference, which is
   the point: there is one way to play, and it goes through the engine.

   Nothing here draws. What arrives is handed to the handlers the game
   registers, in the order it arrived. */
(function (root) {
  'use strict';

  var P = root.PMCProto;

  /* Who this browser is. The id outlives the tab so a refresh mid-battle walks
     back into the same seat; the name is whatever the player last called
     themselves. */
  function identity() {
    var id = null, name = null;
    try {
      id = localStorage.getItem('pmc-player-id');
      name = localStorage.getItem('pmc-player-name');
    } catch (e) { }
    if (!id) {
      id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem('pmc-player-id', id); } catch (e) { }
    }
    return { id: id, name: name || '' };
  }
  function remember(name) {
    try { localStorage.setItem('pmc-player-name', name); } catch (e) { }
  }

  /* The address of the server this page came from, as a WebSocket. A page
     opened from a file, or the single-file build, has none — that is what the
     local transport is for. */
  function defaultURL() {
    try {
      if (!root.location || !/^https?:$/.test(root.location.protocol)) return null;
      return (root.location.protocol === 'https:' ? 'wss://' : 'ws://') + root.location.host + '/ws';
    } catch (e) { return null; }
  }

  function Emitter() {
    this._on = {};
  }
  Emitter.prototype.on = function (t, fn) {
    (this._on[t] = this._on[t] || []).push(fn);
    return this;
  };
  Emitter.prototype.emit = function (t, body) {
    (this._on[t] || []).forEach(function (fn) {
      try { fn(body); }
      catch (e) { if (root.console) console.error('handler for ' + t + ' threw', e); }
    });
    (this._on['*'] || []).forEach(function (fn) {
      try { fn(t, body); } catch (e) { }
    });
  };

  /* ================= a server across the network ================= */
  function Remote(url) {
    Emitter.call(this);
    this.url = url || defaultURL();
    this.sock = null;
    this.live = false;
    this.queue = [];
    this.tries = 0;
    this.me = identity();
    this.wanted = false;
  }
  Remote.prototype = Object.create(Emitter.prototype);

  Remote.prototype.connect = function (name) {
    if (name) { this.me.name = name; remember(name); }
    this.wanted = true;
    if (!this.url) { this.emit('down', { why: 'this page was not served by a game server' }); return this; }
    if (this.sock && (this.sock.readyState === 0 || this.sock.readyState === 1)) return this;
    var net = this;
    var s;
    try { s = new WebSocket(this.url); }
    catch (e) { this.emit('down', { why: String(e.message || e) }); return this; }
    this.sock = s;

    s.onopen = function () {
      net.live = true;
      net.tries = 0;
      net.emit('up', {});
      s.send(JSON.stringify({ t: 'hello', playerId: net.me.id, name: net.me.name || 'Commander' }));
      var q = net.queue; net.queue = [];
      q.forEach(function (m) { s.send(m); });
    };
    s.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || !msg.t) return;
      net.emit(msg.t, msg);
    };
    s.onclose = function () {
      net.live = false;
      net.sock = null;
      net.emit('down', { why: 'the connection closed' });
      if (!net.wanted) return;
      /* Come back, backing off: a server being restarted should be waited for,
         a server that is gone should not be hammered. */
      var wait = Math.min(15000, 500 * Math.pow(2, Math.min(5, net.tries++)));
      setTimeout(function () { if (net.wanted) net.connect(); }, wait);
    };
    s.onerror = function () { };
    return this;
  };

  Remote.prototype.disconnect = function () {
    this.wanted = false;
    if (this.sock) { try { this.sock.close(); } catch (e) { } }
    this.sock = null; this.live = false;
  };

  Remote.prototype.send = function (t, body) {
    var msg = JSON.stringify(body ? Object.assign({ t: t }, body) : { t: t });
    if (this.live && this.sock) { this.sock.send(msg); return true; }
    // a click during a reconnect is not thrown away
    if (this.queue.length < 64) this.queue.push(msg);
    return false;
  };

  Remote.prototype.rename = function (name) {
    this.me.name = name; remember(name);
    this.send('hello', { playerId: this.me.id, name: name });
  };

  /* ================= the engine, in this tab ================= */
  /* A game with nobody else in it still goes through the engine, and the
     engine still answers in the same messages — so the board code has one
     path, and a solitaire game exercises exactly what a networked one does. */
  function Local() {
    Emitter.call(this);
    this.me = identity();
    this.live = false;
    this.engine = null;
    this.seq = 0;
    this.events = [];
    this.cfg = null;
    /* Which seats this browser is playing. One for a solitaire game, both for
       hotseat — and in hotseat the engine is asked as whichever side is up,
       because there is only one person and one screen. */
    this.seats = ['A'];
  }
  Local.prototype = Object.create(Emitter.prototype);

  /* ---- a battle in this tab outlives a refresh ----
     The engine rolls every die through Math.random, and only while it is
     answering begin() or an intent. So a battle is kept as what it began with,
     a seed for its dice, and every intent in order: played through again with
     the same dice it comes out the same. A fingerprint of the table says
     whether it did — if not, it is not offered back. */
  var SAVE_KEY = 'pmc-live-battle', SAVE_V = 1;
  function dice(seed) {
    var a = seed >>> 0;
    return function () {                              // mulberry32
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fingerprint(st) {
    if (!st) return '';
    var s = st.phase + '|' + st.turn + '|' + st.activeSide + '|' + !!st.over;
    (st.units || []).forEach(function (u) {
      s += '|' + u.id + ',' + Math.round((u.x || 0) * 100) + ',' + Math.round((u.y || 0) * 100) + ',' +
        u.models + ',' + (u.alive ? 1 : 0) + ',' + (u.sp || 0) + ',' + (u.damage || 0);
    });
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + '.' + s.length;
  }
  function savedBattle() {
    try {
      var got = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return got && got.v === SAVE_V && got.cfg && got.intents ? got : null;
    } catch (e) { return null; }
  }
  function forgetBattle() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
  function clone(o) { return o === undefined ? null : JSON.parse(JSON.stringify(o)); }

  // the engine's work, done with this battle's own dice
  Local.prototype.rolling = function (fn) {
    var real = Math.random;
    Math.random = this.rng || real;
    try { return fn.call(this); } finally { Math.random = real; }
  };
  Local.prototype.keep = function () {
    if (!this.book || !this.engine) return;
    if (this.engine.over()) { this.book = null; forgetBattle(); return; }
    this.book.fp = fingerprint(this.engine.state());
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.book)); } catch (e) { }
  };
  // thrown away from the menu, or given up: not offered again
  Local.prototype.forget = function () { this.book = null; forgetBattle(); };

  Local.prototype.connect = function (name) {
    if (name) { this.me.name = name; remember(name); }
    this.live = true;
    var net = this;
    setTimeout(function () {
      net.emit('up', { local: true });
      net.emit('welcome', { you: { id: net.me.id, name: net.me.name || 'Commander' }, games: [], chat: [], local: true });
    }, 0);
    return this;
  };
  Local.prototype.disconnect = function () { this.live = false; this.engine = null; };
  Local.prototype.rename = function (name) { this.me.name = name; remember(name); };

  Local.prototype.begin = function (cfg, seats) {
    this.seats = seats && seats.length ? seats : ['A'];
    this.cfg = cfg;
    this.events = [];
    var seed = (Math.random() * 4294967296) >>> 0;
    this.rng = dice(seed);
    // a demo is only watched: there is nothing to come back to
    this.book = cfg.mode === 'demo' ? null : { v: SAVE_V, cfg: clone(cfg), seats: this.seats.slice(), seed: seed, intents: [], at: Date.now() };
    if (!this.book) forgetBattle();
    this.engine = root.PMCEngine.create(recorder(this));
    /* The board is handed the engine before the battle is laid out, because
       laying it out is itself a stream of events — the terrain rolled, the
       scenario read out, the deployment zones — and they have to arrive
       somewhere that can already answer questions about the table. */
    this.emit('engine', { engine: this.engine, local: true });
    this.rolling(function () { this.engine.start(cfg); });
    this.emit('started', { seat: this.seats[0], cfg: cfg, local: true });
    this.flush();
    this.keep();
    return this.engine;
  };

  /* The battle kept from before the refresh, played through again out of
     sight. What was written to the log comes back with it; the cards and the
     effects do not. False if there was none, or it did not come out the same. */
  Local.prototype.resume = function (book) {
    book = book || savedBattle();
    if (!book) return false;
    var cfg = clone(book.cfg);
    this.seats = book.seats && book.seats.length ? book.seats : ['A'];
    this.cfg = cfg;
    this.rng = dice(book.seed);
    this.replaying = [];
    var engine = this.engine = root.PMCEngine.create(recorder(this));
    this.rolling(function () {
      engine.start(cfg);
      book.intents.forEach(function (x) { try { engine.intent(x[0], x[1]); } catch (e) { } });
    });
    var logs = this.replaying;
    this.replaying = null;
    this.events = [];
    if (engine.over() || fingerprint(engine.state()) !== book.fp) {
      this.engine = null; forgetBattle();
      return false;
    }
    this.book = book;
    this.emit('engine', { engine: engine, local: true });
    this.emit('started', { seat: this.seats[0], cfg: cfg, local: true, resumed: true });
    var st = engine.state();
    this.flush([{ e: 'newtable', whole: st.phase === 'terrain' }].concat(logs.slice(-400)));
    return true;
  };

  Local.prototype.send = function (t, body) {
    var net = this;
    if (t === 'intent') return this.intent(body && body.intent);
    if (t === 'resync') { this.flush([]); return true; }
    if (t === 'ping') { setTimeout(function () { net.emit('pong', {}); }, 0); return true; }
    /* The lobby messages have no meaning without a server. Say so rather than
       failing quietly, so a screen that needs one can offer to connect. */
    if (/^(lobby|game)\./.test(t) || t === 'hello') {
      setTimeout(function () {
        net.emit('error', { text: 'that needs a game server — this battle is running in your browser' });
      }, 0);
      return false;
    }
    return false;
  };

  /* Whichever of our seats is entitled to send this. In hotseat that is simply
     whoever is up; in a solitaire game it is always seat A. */
  Local.prototype.seatNow = function () {
    if (!this.engine) return this.seats[0];
    var st = this.engine.state();
    if (!st) return this.seats[0];
    var sel = this.engine.sel();
    var want = sel.insertion
      // the side the engine is asking: the opponent, when it is shoving an insertion off its mark
      ? (sel.insertion.by || (sel.insertion.unit ? sel.insertion.unit.side : 'A'))
      : st.phase === 'deploy' && st.swapAsk ? st.swapAsk.side           // a hotseat's secret round of swaps
        : st.phase === 'deploy' ? this.engine.query.placingSide()
        : st.phase === 'terrain' ? this.engine.query.terrainSide() : st.activeSide;
    return this.seats.indexOf(want) >= 0 ? want : this.seats[0];
  };

  Local.prototype.intent = function (it) {
    if (!this.engine) return false;
    this.events = [];
    var res, seat = this.seatNow();
    // kept whether or not it is allowed: a refusal may have rolled a die on the way
    if (this.book) this.book.intents.push([seat, clone(it)]);
    try { res = this.rolling(function () { return this.engine.intent(seat, it); }); }
    catch (e) {
      this.keep();
      this.emit('error', { text: 'that could not be done: ' + (e && e.message) });
      this.flush([]);
      return false;
    }
    this.keep();
    if (!res || !res.ok) {
      this.emit('refused', { intent: it, why: (res && res.why) || 'not allowed' });
      this.flush([]);
      return false;
    }
    this.flush();
    if (this.engine.over()) this.emit('over', { report: this.engine.report(), over: this.engine.over() });
    return true;
  };

  Local.prototype.flush = function (events) {
    this.seq++;
    var ev = events || this.events;
    this.events = [];
    /* The state goes out as the live object rather than a copy: there is only
       one engine and one board here, and copying a battle between two halves
       of the same tab would be work for nothing. */
    this.emit('turn', { seq: this.seq, events: ev, state: this.engine.state(), live: true });
  };

  /* The view port a local engine writes into: the same events the server sends,
     built the same way, so the board replays one code path. */
  function recorder(net) {
    function rec(e) {
      // played through again after a refresh: only the log is wanted
      if (net.replaying) { if (e.e === 'log') net.replaying.push(e); return; }
      if (net.events.length < 4000) net.events.push(e);
    }
    function ids(list) { return (list || []).map(function (d) { return { id: d.u.id, x: d.x, y: d.y }; }); }
    return {
      log: function (t, text, math) { rec({ e: 'log', t: t, text: text, math: math }); },
      card: function (card) { rec({ e: 'card', card: card }); },
      fx: function (f) { rec({ e: 'fx', f: f }); },
      move: function (u, path, follow) { rec({ e: 'move', id: u.id, path: path, follow: !!follow }); },
      // a shot at a unit names it; one at a piece of the table (a demolition) gives the spot
      shoot: function (a, t, res, deaths) { rec({ e: 'shoot', from: a.id, to: t.id, at: t.id ? undefined : { x: t.x, y: t.y }, res: res, deaths: ids(deaths) }); },
      assault: function (a, t, deaths) { rec({ e: 'assault', from: a.id, to: t.id, deaths: ids(deaths) }); },
      strafe: function (u, from, to, deaths) { rec({ e: 'strafe', id: u.id, from: from, to: to, deaths: ids(deaths) }); },
      arrive: function (u, how, from, veh) { rec({ e: 'arrive', id: u.id, how: how, from: from || null, veh: veh ? veh.id : null }); },
      sound: function (what, args) { rec({ e: 'sound', what: what, args: args && args.length ? args : undefined }); },
      focus: function (u) { rec({ e: 'focus', id: u && u.id }); },
      hint: function (text) { rec({ e: 'hint', text: text }); },
      colour: function (side, key) { rec({ e: 'colour', side: side, key: key }); },
      terrain: function (wrecks) {
        var st = net.engine && net.engine.state();
        rec({ e: 'terrain', pieces: (wrecks || []).map(function (w) { return st ? st.terrain.indexOf(w.piece) : -1; }) });
      },
      newTable: function (whole) { rec({ e: 'newtable', whole: whole === 'whole' }); },
      scenery: function () { rec({ e: 'scenery' }); },
      fit: function () { rec({ e: 'fit' }); },
      structures: function () { rec({ e: 'structures' }); },
      clearCards: function () { rec({ e: 'clearcards' }); },
      look: function (side) { rec({ e: 'look', side: side }); },
      finished: function (report) { if (!net.replaying) net.emit('finished', { report: report }); },
      flyLift: function (u) { return root.PMCIso ? root.PMCIso.flyLift(u) : 0; }
    };
  }

  root.PMCNet = {
    Remote: Remote,
    Local: Local,
    identity: identity,
    remember: remember,
    defaultURL: defaultURL,
    // a battle this browser was playing when the page went away
    savedBattle: savedBattle,
    forgetBattle: forgetBattle,
    /* Is there a server to talk to at all? A page served over http has one; a
       file:// page or the published single file does not. */
    online: function () { return !!defaultURL(); }
  };
})(typeof window !== 'undefined' ? window : global);
