/* The battles kept in the database (multiplayer plan, phase 2), as the table and
   the lobby want them: a battle begun, each intent played, its end; the ones
   still being fought, to bring back after a restart; and a player's own. */
'use strict';

function create(db, opts) {
  const now = (opts && opts.now) || Date.now;
  const seatOf = (room, s) => {
    const p = room.seats[s];
    return p ? { id: p.id, pub: p.pub, name: p.name, force: p.force || null } : null;
  };
  return {
    // a battle begun: its terms, who sits where, its config and its dice's seed; the row's id
    started(room, cfg, seed) {
      return db.addGame({
        code: room.id, name: room.name, settings: room.settings,
        seats: { A: seatOf(room, 'A'), B: seatOf(room, 'B') },
        seatA: room.seats.A ? room.seats.A.id : null, seatB: room.seats.B ? room.seats.B.id : null,
        cfg: cfg, seed: seed, at: now()
      });
    },
    intent(id, seq, seat, it) { db.addIntent(id, seq, seat, it, now()); },
    ended(id, status, result) { return db.endGame(id, status, result, now()); },
    live() { return db.liveGames(); },
    byCode(code) { return db.gameByCode(code); },
    intents(id) { return db.intents(id); },
    /* A player's games, the latest first, as their list shows them: which seat was
       theirs, who they played, and how it went. */
    mine(who) {
      return db.mine(who, 20).map((g) => {
        const me = g.seat_a === who ? 'A' : 'B', them = g.seats[me === 'A' ? 'B' : 'A'] || {};
        const r = g.result || {};
        return {
          code: g.code, name: g.name, status: g.status, seat: me, against: them.name || null,
          result: g.status === 'battle' ? null : !r.winner ? 'drawn' : r.winner === me ? (r.forfeit ? 'won by forfeit' : 'won')
            : (r.forfeit ? 'lost by forfeit' : 'lost'),
          at: g.updated
        };
      });
    }
  };
}

module.exports = { create: create };
