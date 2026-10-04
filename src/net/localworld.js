/* A hotseat campaign with AI forces: the online campaign's world (camp-world.js),
   kept on this device instead of the server. Two players share the screen, each
   with a slot of their own, and take turns at it; the AI forces are the server's
   would be, their battles with each other fought off the table here.

   It answers the same requests the online screens send the server (dossier-online.js
   calls api() here when the campaign is local), keeps every world in localStorage,
   and plays each battle on this device's own table, handing the result back. */
(function (root) {
  'use strict';
  var KEY = 'pmc-worlds';                 // { next, rows: { id: row }, battles: { code: battle } }
  var PLAYERS = [{ userId: 1, name: 'Player 1' }, { userId: 2, name: 'Player 2' }];

  function readStore() {
    try { var s = JSON.parse(root.localStorage.getItem(KEY) || 'null'); if (s && s.rows) return s; } catch (e) { }
    return { next: 1, rows: {}, battles: {} };
  }
  var store = readStore();
  function persist() { try { root.localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var now = function () { return Date.now(); };

  /* The database the world's functions are written against, as the server's db.js
     answers: a campaign with its state parsed, the player's list with it as text. */
  var db = {
    transaction: function (fn) { var r = fn(); persist(); return r; },
    campaign: function (id) { var r = store.rows[id]; return r ? Object.assign({}, r, { state: JSON.parse(r.state) }) : null; },
    byInvite: function (code) { var id = Object.keys(store.rows).filter(function (k) { return store.rows[k].invite === code; })[0]; return id ? db.campaign(id) : null; },
    addCampaign: function (c) {
      var id = 'h' + (store.next++);
      store.rows[id] = { id: id, owner: c.owner, kind: c.kind, name: c.name, turn: c.turn || 0, state: JSON.stringify(c.state), version: 1,
        created: c.at, updated: c.at, invite: null, listed: 0, members: [], seat: 0 };
      return id;
    },
    addMember: function (id, userId, side) { var r = store.rows[id]; if (r) r.members.push({ user_id: userId, side: String(side), name: (PLAYERS[userId - 1] || {}).name, pub: null }); },
    dropMember: function (id, userId) { var r = store.rows[id]; if (r) r.members = r.members.filter(function (m) { return m.user_id !== userId; }); },
    members: function (id) { var r = store.rows[id]; return r ? r.members.slice() : []; },
    setInvite: function (id, code) { if (store.rows[id]) store.rows[id].invite = code; },
    setListed: function () { return true; },
    listedOpen: function () { return []; },
    dropAnyCampaign: function (id) { delete store.rows[id]; },
    allCampaigns: function () { return Object.keys(store.rows).map(function (k) { return { id: k, kind: store.rows[k].kind }; }); },
    userById: function (id) { return PLAYERS[id - 1] || null; },
    onlineOf: function (userId) {
      return Object.keys(store.rows).map(function (k) { return store.rows[k]; })
        .filter(function (r) { return r.members.some(function (m) { return m.user_id === userId; }); })
        .map(function (r) { return { id: r.id, name: r.name, turn: r.turn, version: r.version, updated: r.updated, state: r.state, players: r.members.length }; });
    },
    saveOnline: function (c) {
      var r = store.rows[c.id];
      if (!r || r.version !== c.version) return false;
      r.state = JSON.stringify(c.state); r.name = c.name; r.turn = c.turn || 0; r.version += 1; r.updated = c.at;
      return true;
    }
  };

  /* A battle made for one of the world's contracts: kept until it is played on
     this device's table and its result handed back. */
  function startBattle(o) {
    var code = 'HB' + Math.random().toString(36).slice(2, 8).toUpperCase();
    store.battles[code] = { id: o.campaignId, ref: o.ref, cfg: clone(o.cfg), name: o.name };
    persist();
    return code;
  }

  var World = root.PMCWorld.create({ db: db, startBattle: startBattle, offTable: root.PMCOffTable || null, now: now });

  // whose turn at the screen it is in a world: the player in that slot
  function seatOf(id) { var r = store.rows[id]; return r ? r.seat || 0 : 0; }
  function meOf(id) { return PLAYERS[seatOf(id)] || PLAYERS[0]; }
  function reply(r) {
    var ok = !(r && r.ok === false);
    return Promise.resolve({ ok: ok, code: ok ? 200 : (r.code || 400), j: ok ? r : { error: r.why } });
  }

  root.PMCLocalWorld = {
    isLocal: function (id) { return typeof id === 'string' && /^h\d+$/.test(id); },
    // the requests the online screens send, answered here: the campaign, a command, leaving it
    api: function (path, opts) {
      var m = /api\/online\/(h\d+)(?:\/(cmd|leave))?$/.exec(path), body = {};
      try { body = opts && opts.body ? JSON.parse(opts.body) : {}; } catch (e) { body = {}; }
      if (/api\/me$/.test(path)) return reply({ ok: true, who: meOf(null) });
      if (!m) return reply({ ok: false, why: 'not kept on this device', code: 404 });
      var id = m[1], me = meOf(id);
      if (m[2] === 'cmd') return reply(World.command(me, id, String(body.cmd || ''), body.args || {}));
      if (m[2] === 'leave') return reply(World.leave(me, id));
      return reply(World.view(me, id));
    },
    /* A new one: the two players in the first two slots, then the AI forces with
       the armies and colours asked for, and started straight away (there is nobody
       to wait for). `how`: { name, factions: [P1, P2], ai: [{ faction, colour }] }. */
    make: function (how) {
      var made = World.make(PLAYERS[0], {});
      if (!made.ok) return made;
      var id = made.id, p1 = PLAYERS[0], p2 = PLAYERS[1], ai = how.ai || [];
      World.join(p2, made.invite);
      World.command(p1, id, 'lobbySlots', { n: 2 + ai.length });
      ai.forEach(function (a, k) {
        var i = 2 + k;
        World.command(p1, id, 'lobbySlot', { i: i, kind: 'ai' });
        if (a.faction) World.command(p1, id, 'lobbyFaction', { i: i, faction: a.faction });
        if (a.colour) World.command(p1, id, 'lobbyColour', { i: i, colour: a.colour });
      });
      (how.factions || []).forEach(function (f, i) { if (f) World.command(PLAYERS[i], id, 'lobbyFaction', { i: i, faction: f }); });
      if (how.name) World.command(p1, id, 'lobbyName', { name: how.name });
      World.command(p2, id, 'lobbyReady', { ready: true });
      World.command(p1, id, 'lobbyReady', { ready: true });
      var st = World.command(p1, id, 'lobbyStart', {});
      if (!st.ok) { db.dropAnyCampaign(id); persist(); return st; }
      store.rows[id].seat = 0; persist();
      return { ok: true, id: id };
    },
    // the player at the screen now, and the hand-over to the other
    seat: function (id) { return seatOf(id); },
    setSeat: function (id, i) { if (store.rows[id]) { store.rows[id].seat = i; persist(); } },
    playerName: function (i) { return (PLAYERS[i] || PLAYERS[0]).name; },
    // the worlds on this device, for the main menu's Continue list (whose move it is, as Player 1 sees it)
    list: function () {
      return World.list(PLAYERS[0]).concat(World.list(PLAYERS[1]).filter(function (c) { return c.waiting === 'you'; }))
        .filter(function (c, i, a) { return a.findIndex(function (x) { return x.id === c.id; }) === i; });
    },
    drop: function (id) { db.dropAnyCampaign(id); persist(); },
    // a battle waiting to be played: its table, as the world made it
    battle: function (code) { return store.battles[code] || null; },
    // played: the result to the world, once (the battle's code is its id), and the battle forgotten
    battleOver: function (code, report) {
      var b = store.battles[code];
      if (!b) return false;
      var done = World.battleOver(b.id, report, code, b.ref);
      delete store.battles[code]; persist();
      return done;
    },
    idle: function () { return World.idle(); }
  };
})(typeof window !== 'undefined' ? window : global);
