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
const { R, SC, C, Engine } = require('./rules.js');

/* How many events one intent may produce before we stop collecting. A quiet
   turn is a handful; a rally phase across thirty units with a Psychic Wave in
   it is a few hundred. Well past that and something has gone wrong. */
const MAX_EVENTS = 4000;

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
    if (this.events.length < MAX_EVENTS) this.events.push(ev);
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
    else if (scen === 'rolld3') scen = SC.ORDER[R.d3() - 1];

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
        name: f.name || (p.name + '’s company'),
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
      planet: s.planet === 'random' ? null : s.planet
    };
  }

  begin() {
    this.cfg = this.buildConfig();
    this.events = [];
    this.engine.start(this.cfg);
    this.room.everyone().forEach((p) => this.announce(p));
    this.flush();
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
        campaign: this.room.settings.campaign || null
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
    let res;
    try { res = this.engine.intent(player.seat, it); }
    catch (e) {
      this.log('intent ' + ((it && it.k) || '?') + ' threw: ' + ((e && e.stack) || e));
      player.fail('that could not be done: ' + ((e && e.message) || e));
      this.resync(player);
      return;
    }
    if (!res || !res.ok) {
      /* A refusal is not an error the player did anything about — usually their
         screen is a moment behind. Say why, and send the table again so they
         catch up. */
      player.send('refused', { intent: it, why: (res && res.why) || 'not allowed' });
      this.resync(player);
      return;
    }
    this.flush();
    if (this.engine.over() && !this.stopped) this.finish(this.engine.report());
  }

  /* Events first, in order, then the table they left behind. */
  flush() {
    this.seq++;
    const payload = JSON.stringify({
      t: 'turn', seq: this.seq,
      events: this.events,
      state: this.engine.snapshot()
    });
    this.events = [];
    this.room.everyone().forEach((p) => { if (p.sock && p.sock.open) p.sock.send(payload); });
  }

  /* One player, brought fully up to date: no events, just where things stand. */
  resync(player) {
    player.send('turn', { seq: this.seq, events: [], state: this.engine.snapshot() });
  }

  finish(report) {
    if (this.stopped) return;
    this.stopped = true;
    this.report = report;
    /* A campaign battle writes its result back before anyone is told, so the
       hub both players open next is already showing the aftermath. */
    if (this.campaign && this.room.settings.campaign) {
      try { this.campaign.finish(this.room.settings.campaign, report); }
      catch (e) { this.log('could not record the campaign result: ' + ((e && e.message) || e)); }
    }
    this.room.broadcast('over', { report: report, over: this.engine.over() });
    if (this.lobby) this.lobby.finished(this.room);
  }

  stop() { this.stopped = true; }

  log(text) { (this.opts.log || function () { })('[' + this.room.id + '] ' + text); }
}

module.exports = {
  Table: Table,
  make: function (opts) {
    return function (room, lobby) { return new Table(room, lobby, opts); };
  }
};
