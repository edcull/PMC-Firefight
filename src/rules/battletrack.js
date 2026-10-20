/* PMC 2670 — Firefight : a battle tracked turn by turn (a campaign's debug tracking)
   Where everything stood, as a campaign raised with Debug tracking asks
   (cfg.track): the table once — its terrain and objectives — then as deployed
   ('deploy': what enters from a table edge or reserve is not there yet), as each
   turn's activations are done ('turn', before the Rally phase) and when the
   battle ends ('end'), each unit on the table (side, kind,
   position, men, Stress, status, the ground under it and the cover that gives)
   and who holds each objective. The engine keeps it on its battle report
   (endphase.js), a campaign on the battle's line of its log for its last few
   battles (camp-aftermath.js), and scripts/balance/tracks.js reads it out of a
   campaign the server exported (server/admin.js export-campaign). */
(function (root) {
  'use strict';

  var r1 = function (v) { return Math.round(v * 10) / 10; };

  // the table as it was laid: its size, the ground, the pieces and the objectives
  function table(state, board) {
    var cfg = state.cfg || {};
    return {
      w: board ? board.w : null, h: board ? board.h : null,
      planet: cfg.planet || null, scenario: cfg.scenario || null,
      terrain: (state.terrain || []).map(function (t) { return { kind: t.kind, x: r1(t.x), y: r1(t.y), w: r1(t.w || 0), h: r1(t.h || 0) }; }),
      objectives: (state.objectives || []).map(function (o) { return { x: r1(o.x), y: r1(o.y) }; })
    };
  }

  /* One look at the table: every unit on it, and each objective's holder.
     k: what of the rules it needs — { R, onTable, holders } (holders: a function
     giving each objective's holder, 'A', 'B' or null). */
  function snap(state, k, when) {
    var R = k.R;
    return {
      turn: state.turn, when: when,
      units: state.units.filter(function (u) { return u.alive && k.onTable(u); }).map(function (u) {
        var ground = 'open', cover = 0;
        try { ground = R.terrainAt(state, u.x, u.y) || 'open'; cover = R.coverAt(state, u.x, u.y, u) || 0; } catch (e) { /* off the generator's ground */ }
        return {
          id: u.rid || u.id, side: u.side, key: u.key, x: r1(u.x), y: r1(u.y),
          models: R.isMachine(u) ? (u.alive ? 1 : 0) : u.models, sp: u.sp || 0,
          st: R.status(u), ground: u.bld ? 'building' : ground, cover: cover,
          machine: R.isMachine(u) || undefined
        };
      }),
      holders: k.holders ? k.holders() : []
    };
  }

  // start (or carry on) a battle's track: the table once, then a look at it now
  function record(state, k, when) {
    if (!state.cfg || !state.cfg.track) return;
    if (!state.track) state.track = { table: table(state, k.board), turns: [] };
    state.track.turns.push(snap(state, k, when));
  }

  // the same track as the other side saw it (an online campaign's battle where the player was B)
  function flip(t) {
    if (!t) return t;
    var sw = function (s) { return s === 'A' ? 'B' : s === 'B' ? 'A' : s; };
    return Object.assign({}, t, {
      turns: (t.turns || []).map(function (s) {
        return Object.assign({}, s, {
          units: s.units.map(function (u) { return Object.assign({}, u, { side: sw(u.side) }); }),
          holders: (s.holders || []).map(sw)
        });
      })
    });
  }

  root.PMCBattleTrack = { table: table, snap: snap, record: record, flip: flip };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCBattleTrack;
})(typeof window !== 'undefined' ? window : global);
