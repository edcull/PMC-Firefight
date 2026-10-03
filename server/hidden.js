/* What each player may see (multiplayer plan, phase 4; decision 4). The engine
   keeps the whole battle, both sides' secrets included; the server sends each
   seat a copy with the other side's secrets left out, and a watcher a copy with
   both sides' left out — only what the two players can both see.

   The secrets:
     - the swaps a side has noted but not yet made (Modifying the armies, p. 46):
       how many, but not which, until they are all revealed at once;
     - the piece a side has quietly mined (Terrorist's Path), and the pieces it
       could choose from while it chooses;
     - in a campaign, a force's bench: the units of its dossier not taking the field.
   And before a battle, in its room: the other player's list (its units and any
   tactic), until it is on the table. */
'use strict';

const other = (sd) => (sd === 'A' ? 'B' : 'A');

// a side's swaps, as the other side sees them: how many are noted, none of what
function veilSwaps(sa) {
  if (!sa) return sa;
  return Object.assign({}, sa, {
    pick: null,
    done: (sa.done || []).map((d) => (d.held ? { held: true, hidden: true } : d))
  });
}

/* A battle snapshot (save.js snapshot) as `seat` may see it: 'A', 'B', or null
   for a watcher. The snapshot itself is not changed. */
function battleFor(snap, seat) {
  if (!snap) return snap;
  const mine = (sd) => seat === sd;
  const out = Object.assign({}, snap);
  if (snap.swapAvail) {
    out.swapAvail = {};
    Object.keys(snap.swapAvail).forEach((sd) => { out.swapAvail[sd] = mine(sd) ? snap.swapAvail[sd] : veilSwaps(snap.swapAvail[sd]); });
  }
  if (snap.swapAsk && !mine(snap.swapAsk.side)) out.swapAsk = veilSwaps(snap.swapAsk);
  if (snap.mined && !mine(snap.mined.side)) out.mined = null;
  if (snap.minePick && !mine(snap.minePick.side)) out.minePick = Object.assign({}, snap.minePick, { pool: [] });
  if (snap.cfg && snap.cfg.bench) {
    out.cfg = Object.assign({}, snap.cfg, { bench: { A: mine('A') ? snap.cfg.bench.A : [], B: mine('B') ? snap.cfg.bench.B : [] } });
  }
  return out;
}

/* A room's view (lobby.js Room.view) as the person `seat` sees it: the other
   seat's force by its name, colours, army and size, but not its list or tactic. */
function forceFor(force, own) {
  if (!force || own) return force;
  const out = Object.assign({}, force, { units: (force.keys || []).length, hidden: true });
  delete out.keys; delete out.tactic; delete out.roster;
  return out;
}
function roomFor(view, seat) {
  if (!view || !view.seats) return view;
  const seats = {};
  ['A', 'B'].forEach((sd) => {
    const s = view.seats[sd];
    seats[sd] = s ? Object.assign({}, s, { force: forceFor(s.force, seat === sd) }) : s;
  });
  return Object.assign({}, view, { seats: seats });
}

module.exports = { battleFor: battleFor, roomFor: roomFor, other: other };
