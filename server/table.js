/* One battle, running on the server.

   The engine decides everything and rolls every die; the table is what stands
   between it and two sockets. It turns the room's setup into the config the
   engine wants, records what the engine says happened, and posts that out to
   both players and anyone watching.

   What goes out after each intent is a pair: the events, in the order they
   happened, and the state they left behind. A client replays the events to
   put on the show, then settles onto the state — so a client that has just
   joined, or one that missed a message, is never more than one snapshot away
   from being right. */
'use strict';
const P = require('../src/engine/protocol.js');
const Hidden = require('./hidden.js');
const { R, SC, C, Engine } = require('./rules.js');

/* How many events one intent may produce before we stop collecting. A quiet
   turn is a handful; a rally phase across thirty units with a Psychic Wave in
   it is a few hundred. Well past that and something has gone wrong. */
const MAX_EVENTS = 4000;
/* A battle's own dice (multiplayer plan, phase 2): seeded, so the same intents
   played again from the same seed give the same battle. mulberry32, as the
   browser's own saved battles use (net.js). */
function dice(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* The names a force carries until its player gives it one: nothing at all, the
   muster screen's own fallback, or the seat name it was given for the other
   seat before its player moved. */
function placeholderName(n) {
  n = String(n || '').trim();
  return !n || /^(your force|player [12] force)$/i.test(n);
}

class Table {
  constructor(room, lobby, opts) {
    this.room = room;
    this.lobby = lobby;
    this.opts = opts || {};
    this.seq = 0;
    this.events = [];
    this.cfg = null;
    this.stopped = false;
    this.campaign = this.opts.campaign || null;    // the store, when a campaign is attached
    this.store = this.opts.store || null;          // the database, when battles are kept (phase 2)
    this.gameId = null;                            // this battle's row in it
    this.n = 0;                                    // intents played, so each is written in its place
    this.rng = null;                               // this battle's dice
    this.quiet = false;                            // replaying a kept battle: nothing is sent, nothing written

    const table = this;
    this.engine = Engine.create({
      log: (t, text, math) => table.rec({ e: 'log', t: t, text: text, math: math }),
      card: (card) => table.rec({ e: 'card', card: card }),
      fx: (f) => table.rec({ e: 'fx', f: f }),
      move: (u, path, follow) => table.rec({ e: 'move', id: u.id, path: path, follow: !!follow }),
      shoot: (a, t, res, deaths) => table.rec({
        e: 'shoot', from: a.id, to: t.id, res: table.shotOf(res), deaths: table.deathsOf(deaths)
      }),
      assault: (a, t, deaths) => table.rec({ e: 'assault', from: a.id, to: t.id, deaths: table.deathsOf(deaths) }),
      strafe: (u, from, to, deaths) => table.rec({
        e: 'strafe', id: u.id, from: from, to: to, deaths: table.deathsOf(deaths)
      }),
      arrive: (u, how, from, veh) => table.rec({ e: 'arrive', id: u.id, how: how, from: from || null, veh: veh ? veh.id : null }),
      sound: (what, args) => table.rec({ e: 'sound', what: what, args: args && args.length ? args : undefined }),
      focus: (u) => table.rec({ e: 'focus', id: u && u.id }),
      hint: (text) => table.rec({ e: 'hint', text: text }),
      colour: (side, key) => table.rec({ e: 'colour', side: side, key: key }),
      terrain: (wrecks) => table.rec({
        e: 'terrain', pieces: (wrecks || []).map((w) => table.pieceIndex(w.piece))
      }),
      newTable: (whole) => table.rec({ e: 'newtable', whole: whole === 'whole' }),
      scenery: () => table.rec({ e: 'scenery' }),
      fit: () => table.rec({ e: 'fit' }),
      structures: () => table.rec({ e: 'structures' }),
      clearCards: () => table.rec({ e: 'clearcards' }),
      look: (side) => table.rec({ e: 'look', side: side }),
      finished: (report) => table.finish(report),
      // a flier's height is a drawing matter; the client works it out for itself
      flyLift: () => 0
    });
  }

  rec(ev) {
    if (!this.quiet && this.events.length < MAX_EVENTS) this.events.push(ev);
  }
  // the engine's work, done with this battle's own dice
  rolling(fn) {
    const real = Math.random;
    if (this.rng) Math.random = this.rng;
    try { return fn(); } finally { Math.random = real; }
  }
  pieceIndex(piece) {
    const st = this.engine.state();
    return st ? st.terrain.indexOf(piece) : -1;
  }
  /* A shot's result carries unit references for the units it touched; the wire
     wants ids. Everything else in it is the arithmetic, which the client shows
     on the card exactly as the engine worked it out. */
  shotOf(res) {
    if (!res) return null;
    const out = {};
    Object.keys(res).forEach((k) => {
      if (k === 'hit') { out.hit = (res.hit || []).map((u) => u.id); return; }
      if (k === 'wreck') { out.wreck = res.wreck ? this.pieceIndex(res.wreck.piece) : -1; return; }
      if (k === 'target' || k === 'shooter') { out[k] = res[k] && res[k].id; return; }
      out[k] = res[k];
    });
    return out;
  }
  deathsOf(deaths) {
    return (deaths || []).map((d) => ({ id: d.u.id, x: d.x, y: d.y }));
  }

  /* ---- setting the battle up ---- */
  /* Everything the two players agreed in the lobby, turned into the config the
     engine's newGame wants. A campaign battle takes its lists off the shared
     dossier instead of the forces the players built by hand. */
  buildConfig() {
    const room = this.room;
    const A = room.seats.A, B = room.seats.B;
    if (!A || !B) throw new Error('both seats must be taken');
    const s = room.settings;

    let scen = s.scenario;
    if (scen === 'roll') scen = SC.ORDER[R.d6() - 1];
    // the D3 roll only at Tier I-II and/or Priority Level 1 (p. 45)
    else if (scen === 'rolld3') scen = SC.ORDER[((s.tier || 3) <= 2 || (s.pl || 1) === 1 ? R.d3() : R.d6()) - 1];

    const camp = this.campaign ? this.campaign.get(s.campaign) : null;
    if (s.campaign && !camp) throw new Error('that campaign is not on this server');

    const forceOf = (p, side) => {
      const f = p.force || P.defaultForce(side);
      if (camp) {
        const co = camp.companies[side];
        if (!co) throw new Error('the campaign has no company for seat ' + side);
        const picked = (f.roster || []).length
          ? co.roster.filter((e) => f.roster.indexOf(String(e.rid)) >= 0)
          : C.autoPick
            ? C.autoPick(co, s.tier, s.pl)
            : co.roster.slice(0, 8);
        return {
          keys: picked.map((e) => R.joinPick(e.key, e.prop, e.drone)),
          dossier: picked,
          doctrines: (co.doctrines || []).slice(),
          name: co.name,
          faction: f.faction,
          tactic: f.tactic || null,
          colour: f.colour
        };
      }
      /* A list that does not obey the composition table is rolled again rather
         than refused: the lobby checks as you build, and a force that has gone
         stale because the host changed the tier should not stop the battle. */
      let keys = (f.keys || []).slice();
      if (!R.checkArmy(keys, s.tier, s.pl, null, f.tactic || null, f.faction).ok) {
        keys = R.rollArmy(s.tier, s.pl, null, f.faction);
      }
      return {
        keys: keys, dossier: null, doctrines: null,
        // a force left with its placeholder is named for the seat it sits in
        name: placeholderName(f.name) ? (side === 'A' ? 'Player 1 Force' : 'Player 2 Force') : f.name,
        faction: f.faction, tactic: f.tactic || null, colour: f.colour
      };
    };

    const fa = forceOf(A, 'A'), fb = forceOf(B, 'B');
    // two companies in the same paint is unreadable; the second one moves
    const colourB = fb.colour !== fa.colour ? fb.colour
      : P.COLOURS.filter((c) => c !== fa.colour)[R.d6() % (P.COLOURS.length - 1)];

    return {
      tier: s.tier, pl: s.pl, scenario: scen,
      armyA: fa.keys, armyB: fb.keys,
      nameA: fa.name, nameB: fb.name,
      colourA: fa.colour, colourB: colourB,
      tactics: { A: fa.tactic, B: fb.tactic },
      dossier: camp ? { A: fa.dossier, B: fb.dossier } : null,
      doctrines: camp ? { A: fa.doctrines, B: fb.doctrines } : null,
      campaign: !!camp,
      /* Both seats are people. No side is driven by the behaviour table, which
         is what `hotseat` has always meant to newGame. */
      mode: 'hotseat',
      // each player modifies their army, or goes on, before either deploys (neither sees the other's first unit go down)
      readyUp: true,
      planet: s.planet === 'random' ? null : s.planet,
      terrainSetup: s.terrain === 'manual' ? 'manual' : 'auto'
    };
  }

  /* `cfg`: a config made elsewhere (an online campaign's contract, online.js);
     otherwise the room's terms and forces are made into one here. */
  begin(cfg) {
    this.cfg = cfg || this.buildConfig();
    this.events = [];
    const seed = (Math.random() * 4294967296) >>> 0;
    this.rng = dice(seed);
    // kept before it is begun: a restart in the next moment still finds it
    if (this.store) this.gameId = this.store.started(this.room, this.cfg, seed);
    this.rolling(() => this.engine.start(this.cfg));
    this.room.everyone().forEach((p) => this.announce(p));
    this.flush();
  }

  /* A kept battle brought back (a restart, or a player coming back to one put
     away): started from its config and seed, and every intent played again in
     order, out of sight. Nobody is told anything; they are sent the table as it
     stands when they come back to it. */
  restore(game, intents) {
    this.gameId = game.id;
    this.cfg = game.cfg;
    this.rng = dice(game.seed);
    this.quiet = true;
    try {
      this.rolling(() => this.engine.start(this.cfg));
      intents.forEach((r) => {
        try { this.rolling(() => this.engine.intent(r.seat, r.intent)); } catch (e) { /* refused, or threw: as it did the first time */ }
        this.n++;
      });
    } finally { this.quiet = false; this.events = []; }
    // it ended while being put back (it was over and not yet marked so): nothing more to do with it
    if (this.engine.over()) this.stopped = true;
  }

  /* What a player is told when the battle starts — or when they come back to it,
     or walk in to watch it half-way through: which seat is theirs, and what the
     board needs to paint the two sides. */
  announce(p) {
    p.send('started', {
      seat: p.seat, cfg: {
        tier: this.cfg.tier, pl: this.cfg.pl, scenario: this.cfg.scenario,
        nameA: this.cfg.nameA, nameB: this.cfg.nameB,
        colourA: this.cfg.colourA, colourB: this.cfg.colourB,
        campaign: this.room.settings.campaign || null,
        // an online campaign's battle: its aftermath is the server's to apply, not the browser's
        onlineCampaign: this.room.settings.onlineCampaign || null
      }
    });
  }
  // back at the table after a refresh or a dropped connection: the board, then where things stand
  rejoin(p) {
    if (!this.cfg) return;
    this.announce(p);
    this.resync(p);
  }

  /* ---- an intent, and what came of it ---- */
  intent(player, it) {
    if (this.stopped) return player.fail('the battle has ended');
    if (!player.seat) return player.fail('watchers cannot act');
    this.events = [];
    let res, threw = null;
    try { res = this.rolling(() => this.engine.intent(player.seat, it)); }
    catch (e) { threw = e; }
    /* Kept whatever came of it, in order, before anyone is told: a refusal may
       have rolled a die on the way, and played again it must roll it again. */
    this.keep(player.seat, it);
    if (threw) {
      this.log('intent ' + ((it && it.k) || '?') + ' threw: ' + ((threw && threw.stack) || threw));
      player.fail('that could not be done: ' + ((threw && threw.message) || threw));
      this.resync(player);
      return;
    }
    if (!res || !res.ok) {
      /* A refusal is not an error the player did anything about — usually their
         screen is a moment behind. Say why, and send the table again so they
         catch up. */
      player.send('refused', { intent: it, why: (res && res.why) || 'not allowed' });
      // the whole table at most once a second: a stream of refusals is not a stream of tables (MP-8)
      if (Date.now() - (player.resyncAt || 0) >= 1000) { player.resyncAt = Date.now(); this.resync(player); }
      return;
    }
    this.flush();
    if (this.engine.over() && !this.stopped) this.finish(this.engine.report());
  }

  // one intent written to the database (phase 2), in its place
  keep(seat, it) {
    if (!this.store || this.gameId == null) { this.n++; return; }
    try { this.store.intent(this.gameId, this.n, seat, it); }
    catch (e) { this.log('could not keep an intent: ' + ((e && e.message) || e)); }
    this.n++;
  }

  /* Events first, in order, then the table they left behind — the table as each
     seat may see it (hidden.js: the other side's secrets left out), and as a
     watcher may (both sides' left out). One message made for each. */
  flush() {
    this.seq++;
    const snap = this.engine.snapshot(), events = this.events, seq = this.seq, made = {};
    this.events = [];
    const forSeat = (seat) => {
      const k = seat || '-';
      if (!made[k]) made[k] = JSON.stringify({ t: 'turn', seq: seq, events: events, state: Hidden.battleFor(snap, seat) });
      return made[k];
    };
    this.room.everyone().forEach((p) => { if (p.sock && p.sock.open) p.sock.send(forSeat(p.seat || null)); });
  }

  /* One player, brought fully up to date: no events, just where things stand. */
  resync(player) {
    player.send('turn', { seq: this.seq, events: [], state: Hidden.battleFor(this.engine.snapshot(), player.seat || null) });
  }

  finish(report) {
    if (this.stopped) return;
    this.stopped = true;
    // ended while being played again out of sight: noted, and nobody told (they are told when they come back)
    if (this.quiet) {
      if (this.store && this.gameId != null) {
        const q = this.engine.over() || {};
        try { this.store.ended(this.gameId, 'over', { winner: q.winner || null, why: q.text || null }); } catch (e) { }
      }
      return;
    }
    this.report = report;
    /* A campaign battle writes its result back before anyone is told, so the
       hub both players open next is already showing the aftermath. */
    if (this.campaign && this.room.settings.campaign) {
      try { this.campaign.finish(this.room.settings.campaign, report); }
      catch (e) { this.log('could not record the campaign result: ' + ((e && e.message) || e)); }
    }
    if (this.store && this.gameId != null) {
      const ov = this.engine.over() || {};
      const res = { winner: ov.winner || null, why: ov.text || null };
      if (this.forfeitBy) res.forfeit = this.forfeitBy;
      try { this.store.ended(this.gameId, this.forfeitBy ? 'abandoned' : 'over', res); }
      catch (e) { this.log('could not record the result: ' + ((e && e.message) || e)); }
    }
    this.room.broadcast('over', { report: report, over: this.engine.over() });
    if (this.lobby) this.lobby.finished(this.room, report, this.gameId);
  }

  stop() { this.stopped = true; }

  /* A player walking away from the battle for good: a forfeit (decision 5), the
     other side the winner. Kept as such; the battle goes no further. */
  forfeit(seat) {
    if (this.stopped) return null;
    const winner = seat === 'A' ? 'B' : 'A';
    /* An online campaign's battle ends the engine's own way, so there is a report
       for the aftermath to be applied from (decision 5: in a campaign it is). */
    if (this.room.settings.onlineCampaign && this.engine.concede) {
      this.forfeitBy = seat;
      this.events = [];
      this.rolling(() => this.engine.concede(seat));
      // the result card, to the side left at the table, before the campaign takes over
      this.flush();
      if (!this.stopped) this.finish(this.engine.report());
      return winner;
    }
    this.stopped = true;
    if (this.store && this.gameId != null) {
      try { this.store.ended(this.gameId, 'abandoned', { winner: winner, forfeit: seat }); }
      catch (e) { this.log('could not record the forfeit: ' + ((e && e.message) || e)); }
    }
    return winner;
  }

  log(text) { (this.opts.log || function () { })('[' + this.room.id + '] ' + text); }
}

module.exports = {
  Table: Table,
  make: function (opts) {
    return function (room, lobby) { return new Table(room, lobby, opts); };
  }
};
