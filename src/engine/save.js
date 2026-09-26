/* PMC 2670 — Firefight : saving and loading a battle: the snapshot of everything, and putting it back

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineSave = function (E) {
    var GEN = E.GEN, R = E.R, SC = E.SC, deploymentDone = E.deploymentDone, logLine = E.logLine,
        placingSide = E.placingSide, terrainSide = E.terrainSide, ui = E.ui;


    /* ================= resolution cards ================= */
    function fromLog(kind, title, side, entries) {
      var blocks = [], cur = null;
      entries.forEach(function (l) {
        // a line that carries its own roll starts a block: a shot, an assault round, or charges set against a wall
        if (l.t === 'shoot' || l.t === 'round' || (l.t === 'assault' && l.math)) {
          cur = { head: l.text, math: l.math || '', die: null, chips: [], banners: [] };
          var m = (l.math || '').match(/D10(?: rolls)? (\d)/);
          if (m) cur.die = parseInt(m[1], 10);
          blocks.push(cur);
        } else if (l.t === 'hits' && cur) {
          cur.chips = l.text.split(' · ');
        } else if (cur && (l.t === 'suppressed' || l.t === 'broken' || l.t === 'kill' || l.t === 'note')) {
          cur.banners.push({ text: l.text, tone: l.t === 'note' ? '' : l.t === 'suppressed' ? 'warn' : 'bad' });
        } else if (!cur) {
          blocks.push({ head: l.text, math: l.math || '', die: null, chips: [], banners: [] });
        }
      });
      return { kind: kind, title: title, side: side, blocks: blocks };
    }

    function snapshotAlive() {
      return E.state.units.filter(function (u) { return u.alive; }).map(function (u) {
        return { u: u, x: u.x, y: u.y };
      });
    }

    function deathsSince(snap) {
      return snap.filter(function (s) { return !s.u.alive; });
    }

    /* What a fight leaves behind. Each redraw compares every unit with how it
       stood at the last one: a squad that has lost models leaves a body for each
       where the model stood, and a machine destroyed on the table leaves its
       wreck, burning. A unit that ran, or was aboard something, leaves nothing. */
    function unitById(id) {
      for (var i = 0; i < E.state.units.length; i++) if (E.state.units[i].id === id) return E.state.units[i];
      return null;
    }

    /* ================= loading transports before the battle =================
       "If the ground troops and transport vehicle are in reserve, the troops can
       enter the table on-board the vehicle, but this has to be declared before the
       game" (p. 36) — and a Rapid insertion platform "has to start the battle with
       a single infantry unit onboard" (p. 79). Both want the same thing: a way to
       put a squad inside a hull during deployment, before a shot is fired. */
    function byId(id) {
      for (var i = 0; i < E.state.units.length; i++) if (E.state.units[i].id === id) return E.state.units[i];
      return null;
    }

    function carriersFor(side) {
      return E.state.units.filter(function (u) {
        return u.side === side && u.alive && u.transport && !u.aboard;
      });
    }

    /* Who could start the battle in (or on the hook of) this hull: any of the
       side's own infantry; for a Lifter, one of its ground vehicles — with
       whatever that vehicle already has aboard — as the crane slings it (p. 94);
       and an emplaced gun on tow behind an empty hull, which then carries nothing
       else (p. 94). */
    function towingGun(veh) { return (veh.cargo || []).some(function (c) { return R.has(c, 'Stationary Artillery'); }); }
    function boardableFor(veh) {
      var lifter = R.has(veh, 'Lifter');
      // a hull with a gun on the hook takes nothing else, and one slung under a Lifter hitches no gun (p. 94)
      if (towingGun(veh) || veh.aboard) return [];
      return E.state.units.filter(function (u) {
        if (u.side !== veh.side || !u.alive || u.aboard || u === veh) return false;
        if (lifter) return u.cls === 'vehicle' && !R.has(u, 'Lifter') && !towingGun(u);
        if (u.cls !== 'infantry') return false;
        if (R.has(u, 'Stationary Artillery')) return veh.cls === 'vehicle' && !(veh.cargo || []).length && !R.has(veh, 'Immobile');
        return !(R.has(u, 'Riders') && !(R.mountOf(u) && R.mountOf(u).transport));
      });
    }

    function loadBefore(veh, u, quiet) {
      if (!veh || !u || (veh.cargo || []).length >= veh.transport) return false;
      if (boardableFor(veh).indexOf(u) < 0) return false;
      veh.cargo = veh.cargo || [];
      veh.cargo.push(u);
      u.aboard = veh.id;
      u.x = veh.x; u.y = veh.y;
      u.sp = 0;
      u.reserve = false;                   // it rides in with the hull, not on its own
      // everything riding in a slung vehicle goes with it
      (u.cargo || []).forEach(function (c) { c.x = veh.x; c.y = veh.y; });
      if (!quiet) logLine('note', u.label + (R.has(u, 'Stationary Artillery') ? ' is hitched behind ' : R.has(veh, 'Lifter') ? ' is slung under ' : ' loads aboard ') + veh.name + ' before the battle.');
      return true;
    }

    function unloadBefore(veh, u) {
      if (!veh || !u) return false;
      veh.cargo = (veh.cargo || []).filter(function (c) { return c !== u; });
      u.aboard = null;
      u.x = -1; u.y = -1;                  // back in hand, to be put down again
      logLine('note', u.label + ' steps back off ' + veh.name + '.');
      return true;
    }

      /* ================= what the outside world may ask for ================= */

      function sideOfSeat(seat) { return seat === 'B' ? 'B' : 'A'; }
      function idsOf(list) { return (list || []).map(function (u) { return u && u.id; }); }

      /* The battle, flattened. Unit-to-unit links become ids, the scenario's
         functions and the baked scenery are left out, and everything the client
         needs to draw the table is in what is left. */
      function snapshot() {
        if (!E.state) return null;
        var skip = { namesTaken: 1, scen: 1, scene: 1, ground: 1, structs: 1, structsOpen: 1, props: 1, remains: 1, baking: 1, fireOnView: 1, hazeOnView: 1 };
        var out = {};
        Object.keys(E.state).forEach(function (k) {
          if (skip[k]) return;
          out[k] = E.state[k];
        });
        out.units = E.state.units.map(function (u) {
          var c = {};
          Object.keys(u).forEach(function (k) {
            if (k === 'cargo') { c.cargo = idsOf(u.cargo); return; }
            // a garrison names its building by the piece itself; the wire wants where it is in the list
            if (k === 'bld') { c.bld = u.bld ? E.state.terrain.indexOf(u.bld) : null; return; }
            if (k === 'ax' || k === 'ay' || k === 'boarding' || k === 'arriveAt' || k === 'dropFrom') return;
            c[k] = u[k];
          });
          return c;
        });
        out.mark = E.state.mark ? {
          side: E.state.mark.side, kind: E.state.mark.kind, smoke: E.state.mark.smoke,
          by: E.state.mark.by, again: !!E.state.mark.again,
          targets: idsOf(E.state.mark.targets)
        } : null;
        out.mined = E.state.mined ? { side: E.state.mined.side, piece: E.state.terrain.indexOf(E.state.mined.piece) } : null;
        if (E.state.sc) {
          out.sc = Object.assign({}, E.state.sc);
          if (E.state.sc.search) {
            out.sc.search = E.state.sc.search.map(function (s) {
              var c = Object.assign({}, s);
              c.piece = s.piece ? E.state.terrain.indexOf(s.piece) : -1;
              return c;
            });
            out.sc.found = E.state.sc.found ? E.state.sc.search.indexOf(E.state.sc.found) : -1;
          }
        }
        /* The terrain set-up. The generator's table is looked up again from the
           planet rather than sent, and the pieces each area has put down are
           already in the terrain list, so they go as places in it. */
        if (E.state.tset) {
          out.tset = Object.assign({}, E.state.tset);
          delete out.tset.gen;
          out.tset.areas = E.state.tset.areas.map(function (a) {
            var c = Object.assign({}, a);
            c.placed = (a.placed || []).map(function (p) { return E.state.terrain.indexOf(p); });
            return c;
          });
        }
        out.ui = {
          mode: ui.mode,
          selected: ui.selected && ui.selected.id,
          targets: idsOf(ui.targets),
          moves: ui.moves.slice(),
          terrain: (ui.terrain || []).map(function (r) { return E.state.terrain.indexOf(r); }),
          deployPick: ui.deployPick,
          markKind: ui.markKind,
          digDir: ui.mode === 'digface' ? ui.digDir : null,     // Dig in!: the facing offered
          markPicks: idsOf(ui.markPicks),
          hint: ui.hint,
          tsetHint: ui.tsetHint || '',
          // the buildings a unit could go into, as a piece and a section of it
          sections: (ui.sections || []).map(function (s) {
            return { piece: E.state.terrain.indexOf(s.piece), sec: s.sec, move: !!s.move };
          }),
          placing: E.state.phase === 'deploy' ? placingSide() : E.state.phase === 'terrain' ? terrainSide() : null,
          deployDone: E.state.phase === 'deploy' ? deploymentDone() : false,
          insertion: ui.insertion ? {
            unit: ui.insertion.unit && ui.insertion.unit.id,
            side: ui.insertion.by || (ui.insertion.unit ? ui.insertion.unit.side : 'A'),
            owner: ui.insertion.owner || null,
            by: ui.insertion.by || null, drift: ui.insertion.drift || null, die: ui.insertion.die || null,
            kind: ui.insertion.kind,
            spots: ui.insertion.spots,
            n: ui.insertion.n || null, chosen: ui.insertion.chosen || null
          } : null,
          // which reserves come on this turn, being chosen
          reservePick: ui.reservePick ? {
            side: ui.reservePick.side, ids: ui.reservePick.ids.slice(), chosen: ui.reservePick.chosen.slice(),
            min: ui.reservePick.min, max: ui.reservePick.max, text: ui.reservePick.text
          } : null
        };
        return out;
      }

      /* The other direction, for a client mirroring a battle it is not running.
         Links are put back, and the scenario is looked up again by its id. */
      function load(snap) {
        if (!snap) { E.state = null; return; }
        /* The table is painted once and then scrolled over: baking the ground,
           the structures and the props costs real time, and none of it travels
           on the wire. Carry it across from the battle we were already holding,
           as long as it is the same battle on the same ground — a new battle, or
           terrain that has been blown apart, and it is painted again. */
        var was = E.state;
        var same = was && was.seed === snap.seed && was.terrain.length === snap.terrain.length;
        E.state = snap;
        if (same) {
          ['scene', 'ground', 'structs', 'structsOpen', 'props', 'remains'].forEach(function (k) {
            if (was[k] !== undefined) E.state[k] = was[k];
          });
        }
        E.state.scen = SC.SCENARIOS[(snap.sc && snap.sc.id) || snap.cfg.scenario] || SC.SCENARIOS.secure;
        var by = {};
        E.state.units.forEach(function (u) { by[u.id] = u; });
        E.state.units.forEach(function (u) {
          u.cargo = (u.cargo || []).map(function (id) { return by[id]; }).filter(Boolean);
          /* A garrison's building has to be the very piece in the terrain list:
             who is in a building is worked out by asking which unit holds it. */
          if (typeof u.bld === 'number') u.bld = E.state.terrain[u.bld] || null;
        });
        if (E.state.tset) {
          E.state.tset.gen = GEN.tableFor(E.state.cfg.planet);
          E.state.tset.areas.forEach(function (a) {
            a.placed = (a.placed || []).map(function (i) { return E.state.terrain[i]; }).filter(Boolean);
          });
        }
        if (E.state.mark) {
          E.state.mark.targets = (E.state.mark.targets || []).map(function (id) { return by[id]; }).filter(Boolean);
        }
        if (E.state.mined && typeof E.state.mined.piece === 'number') {
          E.state.mined = E.state.terrain[E.state.mined.piece] ? { side: E.state.mined.side, piece: E.state.terrain[E.state.mined.piece] } : null;
        }
        if (E.state.sc && E.state.sc.search) {
          E.state.sc.search.forEach(function (s) { s.piece = s.piece >= 0 ? E.state.terrain[s.piece] : null; });
          E.state.sc.found = E.state.sc.found >= 0 ? E.state.sc.search[E.state.sc.found] : null;
        }
        var us = snap.ui || {};
        delete E.state.ui;
        ui.mode = us.mode || 'idle';
        ui.selected = by[us.selected] || null;
        ui.targets = (us.targets || []).map(function (id) { return by[id]; }).filter(Boolean);
        ui.moves = us.moves || [];
        ui.terrain = (us.terrain || []).map(function (i) { return E.state.terrain[i]; }).filter(Boolean);
        ui.deployPick = us.deployPick || null;
        ui.markKind = us.markKind || null;
        ui.markPicks = (us.markPicks || []).map(function (id) { return by[id]; }).filter(Boolean);
        ui.hint = us.hint || null;
        ui.tsetHint = us.tsetHint || '';
        ui.sections = (us.sections || []).map(function (s) {
          var piece = E.state.terrain[s.piece];
          if (!piece) return null;
          var parts = piece.parts && piece.parts.length ? piece.parts : [piece];
          return { piece: piece, sec: s.sec, rect: parts[s.sec] || parts[0], move: s.move };
        }).filter(Boolean);
        ui.reservePick = us.reservePick || null;
        ui.insertion = us.insertion ? {
          unit: by[us.insertion.unit] || null, owner: us.insertion.owner,
          by: us.insertion.by || null, drift: us.insertion.drift || null, die: us.insertion.die || null,
          kind: us.insertion.kind, spots: us.insertion.spots, done: null
        } : null;
        return E.state;
      }

    return {
      fromLog: fromLog, snapshotAlive: snapshotAlive, deathsSince: deathsSince, unitById: unitById,
      byId: byId, carriersFor: carriersFor, boardableFor: boardableFor, loadBefore: loadBefore,
      unloadBefore: unloadBefore, sideOfSeat: sideOfSeat, snapshot: snapshot, load: load
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineSave;
})(typeof window !== 'undefined' ? window : global);
