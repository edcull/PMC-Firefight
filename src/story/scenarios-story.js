/* PMC 2670 — Firefight : the story's own scenarios (docs/story-mode-plan.md, section 5)

   Six scenarios for story mode's second half, in the same shape as the book's
   (rules/scenarios.js) and built from the same parts. Each is a two-sided
   battle between armies, never a solitaire one, though their ideas came from
   there. They carry `story: true`, so the skirmish, campaign and online lists
   never offer them, and they read nothing of the story but cfg.story.

   What happens in their End phases (waves out of the tunnel mouths, the
   orbital countdown, units lifted out of a landing zone, a parley) is set up
   here on state.sc and run by the engine (engine/storybattle.js).

     hive_heart  Close Encounters: destroy the brood chambers while the bugs keep coming
     convoy      get your vehicles across the table, past an enemy that wants them stopped
     breakout    get out by the landing zone before the orbital strikes reach you
     holdline    hold the pass against bug waves until the time runs out
     strike      wreck the real targets among the decoys before the garrison wakes
     parley      talks across a meeting point, until somebody shoots */
(function (root) {
  'use strict';
  var R = root.PMC, SC = root.PMCScen;
  if (!SC || !SC.kit) throw new Error('scenarios-story.js wants rules/scenarios.js first');
  var K = SC.kit, SCENARIOS = SC.SCENARIOS;

  function story(state) { return (state.cfg && state.cfg.story) || {}; }
  function alive(state, side) { return state.units.filter(function (u) { return u.side === side && u.alive && !u.ally; }); }

  /* The waves a scenario sends: so many a turn (the story sets it from a meter,
     cfg.story.waves), of the enemy's own kinds unless the story names them. */
  function waveSetup(state, mouths, from) {
    var w = story(state).waves || {};
    var keys = w.keys || state.units.filter(function (u) { return u.side === 'B' && !R.isMachine(u) && !R.has(u, 'Command Unit') && u.tier <= (state.cfg.tier || 1); })
      .map(function (u) { return u.key; });
    if (!keys.length) keys = state.units.filter(function (u) { return u.side === 'B'; }).map(function (u) { return u.key; });
    state.sc.waves = { side: 'B', mouths: mouths, keys: keys, per: w.per || 1, from: from || 2, until: w.until || null };
  }
  // tunnel mouths along the enemy's own half of the table
  function mouthsOn(side, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var x = side === 'B' ? R.BOARD.w * (0.65 + 0.25 * Math.random()) : R.BOARD.w * (0.1 + 0.25 * Math.random());
      out.push({ x: x, y: R.BOARD.h * (i + 0.5) / n, name: 'tunnel mouth' });
    }
    return out;
  }

  /* ------------------------------------------------ Hive Heart */
  /* The hive's own tunnels are wider than a base's corridors (a 4" grid,
     not the book's 3"), its chambers bigger. The three brood chambers are the
     rooms furthest over on the hive's side (`hive`: drawn as the hive's,
     cleared of fittings). They stand in for the hive's entry corridors: side A
     comes in from the left edge as ever, and the hive comes on in its
     chambers, and its waves come out of them too. A chamber that still
     stands, and is not held by side A at that End phase, sends them out.
     Each one burned is one fewer. */
  SCENARIOS.hive_heart = {
    story: true, compound: true, rooms: 3, cell: 4, nest: 3, danger: 0, hidden: function () { return true; },
    id: 'hive_heart', name: 'Hive Heart', page: null,
    blurb: 'The brood chambers, at the bottom of everything. Burn them out while the hive throws everything it has at you.',
    win: 'Destroy all three brood chambers: a chamber held by your units at the End phase is destroyed. The hive wins if you are routed, or if any chamber still stands at the end of turn 14.',
    turns: 14,
    objectives: function (state) {
      if (!state) return [];
      // the three furthest over towards the hive's (right-hand) edge, spread down it where they can be
      var all = state.terrain.filter(function (r) { return r.kind === 'room' || r.kind === 'hall'; })
        .sort(function (a, b) { return (b.x + b.w / 2) - (a.x + a.w / 2); });
      // the nest the compound was laid with, if it was; else the rooms furthest over
      var rooms = all.filter(function (r) { return r.nest; }).slice(0, 3);
      if (rooms.length < 3) rooms = [];
      all.forEach(function (r) {
        if (rooms.length < 3 && r.x + r.w / 2 >= R.BOARD.w / 2 && rooms.every(function (q) { return Math.abs((q.y + q.h / 2) - (r.y + r.h / 2)) >= 6; })) rooms.push(r);
      });
      all.forEach(function (r) { if (rooms.length < 3 && rooms.indexOf(r) < 0) rooms.push(r); });
      state.sc.rooms = rooms;
      rooms.forEach(function (r, i) { r.hive = true; r.chamber = i + 1; r.dangerous = false; });
      // nothing of the base is left in them: no crates, no machinery, no pillars
      var inHive = function (t) {
        var cx = t.x + t.w / 2, cy = t.y + t.h / 2;
        return rooms.some(function (r) { return cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h; });
      };
      state.terrain = state.terrain.filter(function (t) { return !((t.kind === 'crates' || t.kind === 'machinery' || t.kind === 'pillar') && inHive(t)); });
      return [];
    },
    entersTurn1: true,
    deploy: function (state) {
      // side A by the left-hand edge's entry points; the hive in its chambers
      var ent = state.compound ? state.compound.entries : { L: [] };
      var chambers = state.sc.rooms.map(function (r) { return K.rectOf(r); });
      state.sc.entry = { A: ent.L.slice(), B: chambers };
      state.sc.boxes = { A: state.sc.entry.A, B: chambers };
      state.objectives = state.sc.rooms.map(function (r, i) {
        return { x: r.x + r.w / 2, y: r.y + r.h / 2, rect: K.rectOf(r), inside: true, name: 'Brood chamber ' + (i + 1), owner: null };
      });
      // the bugs come out of the brood chambers themselves (storybattle.js waves: `obj`, the chamber's objective)
      waveSetup(state, state.sc.rooms.map(function (r, i) { return { x: r.x + r.w / 2, y: r.y + r.h / 2, name: 'brood chamber', obj: i }; }), 2);
    },
    reserves: function (state, side) { return K.entering(state, side); },
    deployText: function () { return K.CE_ENTRY_TEXT; },
    hint: 'Three brood chambers. Stand in one at the End phase, with no bug inside, and it burns. Every chamber still standing sends out more of the hive.',
    // the hive defends what it has left
    goals: function (state) { return state.objectives.filter(function (o) { return !o.destroyed; }); },
    groundTaking: true,
    check: function (state) {
      state.objectives.forEach(function (o, i) {
        if (o.destroyed || o.owner !== 'A') return;
        o.destroyed = state.turn;
        if (state.sc.rooms && state.sc.rooms[i]) state.sc.rooms[i].burnt = state.turn;   // (drawn burnt out)
      });
      var left = state.objectives.filter(function (o) { return !o.destroyed; }).length;
      if (!left) return { winner: 'A', text: 'The last brood chamber burns. The hive is finished.' };
      if (SC.routed(state, 'A')) return { winner: 'B', text: 'A is broken in the dark, and the hive goes on.', routed: ['A'] };
      if (state.turn >= 14) return { winner: 'B', text: left + ' brood chamber' + (left > 1 ? 's' : '') + ' still standing at the end of turn 14. The hive goes on.', timeout: true };
    }
  };

  /* ------------------------------------------------ Convoy */
  /* The convoy is side A's vehicles, or, if it brought none, all of side A. It
     crosses from its own edge to the far one; a unit of it standing within 3"
     of the far edge at the End phase is through. */
  function convoyOf(state) {
    var a = state.units.filter(function (u) { return u.side === 'A' && !u.ally; });
    var hulls = a.filter(function (u) { return R.isMachine(u) && !R.isFlying(u); });
    return hulls.length ? hulls : a;
  }
  SCENARIOS.convoy = {
    story: true, edges: true,
    id: 'convoy', name: 'Convoy', page: null,
    blurb: 'A column has to cross the table. The other side has to stop it.',
    win: 'A wins with half the convoy (by its units’ Tiers) through to the far edge by the end of turn 12. B wins by destroying more than half of it, or if it is not through in time.',
    turns: 12,
    objectives: function () { return []; },
    entersTurn1: true,
    deploy: function (state) {
      K.entryEdges(state);
      state.sc.convoy = convoyOf(state).map(function (u) { return u.id; });
      state.sc.extract = { side: 'A', rectX: R.BOARD.w - 3, from: 2, only: state.sc.convoy };
    },
    reserves: function (state, side) { return K.entering(state, side); },
    deployText: function () { return K.ENTRY_TEXT; },
    zoneFor: function (state, side) { return state.sc.zones[side]; },
    hint: 'Your vehicles are the convoy (or everyone, if you brought none). Get them to the far edge; anything of the convoy within 3″ of it at the End phase is through.',
    // the enemy goes for the convoy; the convoy goes for the far edge
    goals: function (state, u) {
      if (u.side === 'B') return state.units.filter(function (c) { return c.alive && (state.sc.convoy || []).indexOf(c.id) >= 0 && c.x >= 0; });
      return [{ x: R.BOARD.w - 1.5, y: u.y }];
    },
    groundTaking: true,
    check: function (state) {
      var ids = state.sc.convoy || [], pts = 0, out = 0, lost = 0;
      state.units.forEach(function (u) {
        if (ids.indexOf(u.id) < 0) return;
        pts += u.tier || 1;
        if (u.extracted) out += u.tier || 1;
        else if (!u.alive) lost += u.tier || 1;
      });
      if (out * 2 >= pts) return { winner: 'A', text: 'Half the convoy is through.' };
      if (lost * 2 > pts) return { winner: 'B', text: 'More than half the convoy is burning on the road.', routed: ['A'] };
      if (state.turn >= 12) return { winner: 'B', text: 'The convoy is still on the road at the end of turn 12.', timeout: true };
    }
  };

  /* ------------------------------------------------ Breakout */
  /* The landing zone sits in the enemy's half; the table is cut into six areas,
     and from turn 3 the orbital strikes start to fall on them, D3 a turn, the
     landing zone's area spared. */
  function areas6() {
    var out = [], w = R.BOARD.w / 3, h = R.BOARD.h / 2, names = ['the west road', 'the pits', 'the east road', 'the south yards', 'the slag field', 'the pumping station'];
    for (var j = 0; j < 2; j++) for (var i = 0; i < 3; i++) out.push({ x: i * w, y: j * h, w: w, h: h, name: names[j * 3 + i] });
    return out;
  }
  SCENARIOS.breakout = {
    story: true, edges: true,
    id: 'breakout', name: 'Breakout', page: null,
    blurb: 'The moon is being sterilised from orbit. The last shuttle is waiting, and the hive is between you and it.',
    win: 'A wins by getting half its force (by Tier) out by the landing zone by the end of turn 8; a quarter is a draw. Anything less, or A routed, and B wins.',
    turns: 8,
    objectives: function () { return []; },
    entersTurn1: true,
    deploy: function (state) {
      K.entryEdges(state);
      var lz = { x: R.BOARD.w * 0.7, y: R.BOARD.h * (0.3 + 0.4 * Math.random()), r: 4 };
      state.sc.lz = lz;
      state.sc.extract = { side: 'A', x: lz.x, y: lz.y, r: lz.r, from: 2 };
      var areas = areas6();
      areas.forEach(function (a) { if (R.inRect(lz.x, lz.y, a)) a.safe = true; });
      state.sc.countdown = { from: 3, areas: areas };
      state.sc.startA = alive(state, 'A').reduce(function (n, u) { return n + (u.tier || 1); }, 0);
      waveSetup(state, mouthsOn('B', 2), 2);
    },
    reserves: function (state, side) { return K.entering(state, side); },
    deployText: function () { return K.ENTRY_TEXT; },
    zoneFor: function (state, side) { return state.sc.zones[side]; },
    hint: 'Get to the landing zone: a unit in it at the End phase is lifted out. From turn 3 the strikes fall, D3 areas a turn, and an area hit keeps burning.',
    goals: function (state, u) { return u.side === 'A' ? [state.sc.lz] : alive(state, 'A'); },
    groundTaking: true,
    check: function (state) {
      var out = (state.sc.extract && state.sc.extract.out) || 0, all = state.sc.startA || 1;
      if (out * 2 >= all) return { winner: 'A', text: 'Half the company is aboard. The shuttle lifts.' };
      if (SC.routed(state, 'A') && !alive(state, 'A').length) return { winner: 'B', text: 'Nobody else is coming to the shuttle.', routed: ['A'] };
      if (state.turn >= 8) {
        if (out * 4 >= all) return { winner: null, text: 'A quarter of the company got out. The rest did not.', timeout: true };
        return { winner: 'B', text: 'The shuttle lifts with too few aboard.', timeout: true };
      }
    }
  };

  /* ------------------------------------------------ Hold the Line */
  SCENARIOS.holdline = {
    story: true, edges: true,
    id: 'holdline', name: 'Hold the Line', page: null,
    blurb: 'A pass, and everyone who is falling back through it. Hold it until they are clear.',
    win: 'A wins if the bugs do not hold the pass at the end of turn 8. B wins by holding the pass at any End phase from turn 3, or by routing A.',
    turns: 8,
    objectives: function (state) {
      // the pass: on A's side of the middle, clear of what cannot be stood on
      for (var g = 0; g < 400; g++) {
        var p = { x: R.BOARD.w * (0.3 + 0.1 * Math.random()), y: R.BOARD.h * (0.3 + 0.4 * Math.random()) };
        if (!state || !R.TERRAIN[R.terrainAt(state, p.x, p.y)].impassable) return [p];
      }
      return [{ x: R.BOARD.w * 0.35, y: R.BOARD.h / 2 }];
    },
    entersTurn1: true,
    deploy: function (state) {
      K.entryEdges(state);
      if (state.objectives[0]) state.objectives[0].name = 'The pass';
      waveSetup(state, mouthsOn('B', 2), 2);
    },
    reserves: function (state, side) { return K.entering(state, side); },
    deployText: function () { return K.ENTRY_TEXT; },
    zoneFor: function (state, side) { return state.sc.zones[side]; },
    hint: 'One objective: the pass. The bugs come in waves. Keep them off it until the end of turn 8.',
    groundTaking: true,
    check: function (state) {
      var o = state.objectives[0];
      if (SC.routed(state, 'A')) return { winner: 'B', text: 'The line breaks.', routed: ['A'] };
      if (o && o.owner === 'B' && state.turn >= 3) return { winner: 'B', text: 'The bugs hold the pass.' };
      if (state.turn >= 8) return { winner: 'A', text: 'The pass holds. Everyone who could get through is through.' };
    }
  };

  /* ------------------------------------------------ Strike */
  /* Three targets, one or two of them real and the rest decoys, nobody knowing
     which until they are reached. Half the garrison is awake; the rest comes
     when the alarm spreads, from turn 3. */
  SCENARIOS.strike = {
    story: true, edges: true, groundTaking: true,
    id: 'strike', name: 'Strike', page: null,
    blurb: 'A small team, a night raid, and targets that may not be what they seem.',
    win: 'A wins by wrecking every real target: a target held by A at the End phase is wrecked, or found to be a decoy. B wins if any real target stands at the end of turn 10, or by routing A.',
    turns: 10,
    objectives: function (state) { return K.spread3(state); },
    entersTurn1: true,
    deploy: function (state) {
      K.entryEdges(state);
      var real = Math.random() < 0.5 ? 1 : 2;
      var order = [0, 1, 2].sort(function () { return Math.random() - 0.5; });
      state.objectives.forEach(function (o, i) { o.name = 'Target ' + (i + 1); o.real = order.indexOf(i) < real; });
      // half the garrison asleep: it comes on from turn 3
      // (held as the book's splits hold a second wave: wave 2, here from turn 3)
      var b = state.units.filter(function (u) { return u.side === 'B' && u.alive && !u.aboard; });
      var split = K.halve(b);
      split.second.forEach(function (u) { u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; });
      K.noteSplit(state, 'B', 'hold', b, Math.floor(b.length / 2), Math.ceil(b.length / 2), 'Half the garrison is awake; the rest comes when the alarm spreads.');
    },
    reserves: function (state, side) {
      if (state.turn === 1) return K.entering(state, side);
      if (side === 'B' && state.turn >= 3) return state.units.filter(function (u) { return u.side === 'B' && u.alive && u.reserve && u.wave === 2; });
      return [];
    },
    deployText: function () { return K.ENTRY_TEXT; },
    zoneFor: function (state, side) { return state.sc.zones[side]; },
    hint: 'Three targets; some are decoys. Hold one at the End phase and it is wrecked, or shown up as a decoy. The rest of the garrison wakes from turn 3.',
    goals: function (state) { return state.objectives.filter(function (o) { return !o.wrecked && !o.decoy; }); },
    check: function (state) {
      state.objectives.forEach(function (o) {
        if (o.owner !== 'A' || o.wrecked || o.decoy) return;
        if (o.real) o.wrecked = state.turn; else o.decoy = state.turn;
      });
      var standing = state.objectives.filter(function (o) { return o.real && !o.wrecked; }).length;
      if (!standing) return { winner: 'A', text: 'Every real target is wrecked.' };
      if (SC.routed(state, 'A')) return { winner: 'B', text: 'The raiders are broken before the job is done.', routed: ['A'] };
      if (state.turn >= 10) return { winner: 'B', text: standing + ' real target' + (standing > 1 ? 's' : '') + ' still standing at the end of turn 10.', timeout: true };
    }
  };

  /* ------------------------------------------------ Parley */
  /* Both sides close to a meeting point, talking. While the talks hold, the
     enemy holds its fire; they break when side A hurts side B, or on a 6 at an
     End phase (engine/storybattle.js). Held to the end of turn 6, A has what it
     came for; broken, it is a Meeting engagement to the end. */
  SCENARIOS.parley = {
    story: true,
    id: 'parley', name: 'Parley', page: null,
    blurb: 'Two sides, a meeting point, and the hope that nobody shoots first.',
    win: 'A wins if the talks hold to the end of turn 6. Once they break, it is a Meeting engagement: rout the enemy, or be routed; a draw at the end of turn 12.',
    turns: 12,
    /* The meeting point is no objective (nothing is held, and nobody is sent to
       it): a table under a white flag, in the middle, to talk across. */
    objectives: function (state) {
      state.terrain.push({ kind: 'parleyflag', x: R.BOARD.w / 2 - 1, y: R.BOARD.h / 2 - 1, w: 2, h: 2 });
      return [];
    },
    deploy: function (state) {
      var mid = R.BOARD.w / 2;
      state.sc.zones = { A: [mid - 12, mid - 3], B: [mid + 3, mid + 12] };
      state.sc.parley = {};
    },
    reserves: function () { return []; },
    deployText: function () { return 'Both sides set up close to the meeting point: within 12″ of the middle of the table, on their own side of it.'; },
    zoneFor: function (state, side) { return state.sc.zones[side]; },
    hint: 'While the talks hold, the other side will not shoot. Any harm you do them breaks the talks, and so might nerves (a 6 at an End phase).',
    check: function (state) {
      var pa = state.sc.parley || {};
      if (!pa.broken) {
        if (state.turn >= 6) { state.storyOutcome = { parley: 'held' }; return { winner: 'A', text: 'The talks held. Both sides walk away.' }; }
        return null;
      }
      state.storyOutcome = { parley: pa.by === 'A' ? 'broken by you' : 'broke down' };
      var ra = SC.routed(state, 'A'), rb = SC.routed(state, 'B');
      if (ra && rb) return { winner: null, text: 'Both sides are broken \u2014 a bloody draw.', routed: ['A', 'B'] };
      if (rb) return { winner: 'A', text: 'A routs the enemy \u2014 half their units are gone.', routed: ['B'] };
      if (ra) return { winner: 'B', text: 'B routs the enemy \u2014 half their units are gone.', routed: ['A'] };
      if (state.turn >= 12) return { winner: null, text: 'Twelve turns, and nobody breaks — a draw.', timeout: true };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SCENARIOS;
})(typeof window !== 'undefined' ? window : global);
