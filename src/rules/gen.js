/* PMC 2670 — Firefight : the rulebook's terrain generators (pp. 46-48).
   The table is divided into 2' x 2' areas; players alternately roll 1D6 for each
   area and place the rolled terrain in it. Here the roll is made for each area in
   turn and the pieces are dropped at random inside it.

   Where a result offers a choice ("1-4 hills or rocks") one branch is taken at
   random. Terrain named in the book is mapped to the pieces this game models:
   small rocky areas count as rubble, as the book says; high rocks, deep canyons
   and volcanoes are rocks; swamps are shallow water. */
(function (root) {
  'use strict';

  // n: [min, max] pieces of that kind
  function P(kind, min, max, opts) {
    var o = { kind: kind, min: min, max: max === undefined ? min : max };
    if (opts) for (var k in opts) o[k] = opts[k];
    return o;
  }

  var GENERATORS = {
    barren: {
      name: 'Barren / arctic world',
      rows: [
        { text: 'Single crater or rubble-covered area', alts: [[P('crater', 1, 1)]] },
        { text: '2-4 small rocky areas (count as rubble) or craters', alts: [[P('crater', 2, 4)]] },
        { text: '1-6 rocks', alts: [[P('rocks', 1, 6)]] },
        { text: '1-4 hills or rocks', alts: [[P('hill', 1, 4)], [P('rocks', 1, 4)]] },
        { text: '1-3 impassable areas (lava fields, high rocks, deep canyons)', alts: [[P('lava', 1, 3)], [P('rocks', 1, 3)]] },
        { text: 'Outpost: 1-3 buildings and up to 4 low walls', alts: [[P('building', 1, 3), P('barricade', 0, 4)]] }
      ]
    },
    sparse: {
      name: 'Temperate world (sparsely colonised)',
      rows: [
        { text: 'Single wood or 1-3 craters', alts: [[P('woods', 1, 1)], [P('crater', 1, 3)]] },
        { text: '1-3 woods or swamps', alts: [[P('woods', 1, 3)], [P('water', 1, 3)]] },
        { text: '1-4 woods or impassable terrain (deep water)', alts: [[P('woods', 1, 4)], [P('deep', 1, 4)]] },
        { text: '1-3 hills or woods', alts: [[P('hill', 1, 3)], [P('woods', 1, 3)]] },
        { text: '1 ruin or rubble-covered area and 0-6 low walls', alts: [[P('ruins', 1, 1), P('barricade', 0, 6)], [P('crater', 1, 1), P('barricade', 0, 6)]] },
        { text: 'Farmhouse: 1-3 buildings and up to 4 low walls', alts: [[P('building', 1, 3), P('barricade', 0, 4)]] }
      ]
    },
    dense: {
      name: 'Temperate world (densely colonised)',
      rows: [
        { text: 'Single rubble-covered area or 1-3 low walls', alts: [[P('crater', 1, 1)], [P('barricade', 1, 3)]] },
        { text: '1-2 woods or rubble-covered areas', alts: [[P('woods', 1, 2)], [P('crater', 1, 2)]] },
        { text: '1-3 hills or pools of shallow water', alts: [[P('hill', 1, 3)], [P('water', 1, 3)]] },
        { text: '1-4 ruins or rubble-covered areas', alts: [[P('ruins', 1, 4)], [P('crater', 1, 4)]] },
        { text: '1-3 buildings or reinforced buildings', alts: [[P('building', 1, 3)], [P('bunker', 1, 3)]] },
        { text: '1-6 buildings and 1-6 low or reinforced walls', alts: [[P('building', 1, 6), P('barricade', 1, 6)], [P('building', 1, 6), P('wall', 1, 6)]] }
      ]
    },
    industrial: {
      name: 'Industrial world',
      rows: [
        { text: 'Single ruin or rubble-covered area', alts: [[P('ruins', 1, 1)], [P('crater', 1, 1)]] },
        { text: '1-6 ruins or rubble-covered areas', alts: [[P('ruins', 1, 6)], [P('crater', 1, 6)]] },
        { text: '1-6 buildings and up to 6 low walls', alts: [[P('building', 1, 6), P('barricade', 0, 6)]] },
        { text: '1-6 buildings and up to 6 low walls', alts: [[P('building', 1, 6), P('barricade', 0, 6)]] },
        { text: 'Large building and up to 6 medium walls', alts: [[P('building', 1, 1, { big: true }), P('wall', 0, 6)]] },
        { text: 'Large building or 1-3 reinforced buildings', alts: [[P('building', 1, 1, { big: true })], [P('bunker', 1, 3)]] }
      ]
    },
    jungle: {
      name: 'Jungle world',
      rows: [
        { text: '1-6 jungle areas', alts: [[P('woods', 1, 6)]] },
        { text: '1-6 jungle areas', alts: [[P('woods', 1, 6)]] },
        { text: '1-6 jungle areas', alts: [[P('woods', 1, 6)]] },
        { text: '1-3 swamps and up to 2 jungle areas', alts: [[P('water', 1, 3), P('woods', 0, 2)]] },
        { text: '1-3 deep water / impassable areas', alts: [[P('deep', 1, 3)]] },
        { text: '1-2 hills and up to 2 jungle areas', alts: [[P('hill', 1, 2), P('woods', 0, 2)]] }
      ]
    },
    mountain: {
      name: 'Mountain world',
      rows: [
        { text: 'Single rubble-covered area', alts: [[P('crater', 1, 1)]] },
        { text: '1-3 woods', alts: [[P('woods', 1, 3)]] },
        { text: '1-4 impassable areas (high rocks, deep canyons)', alts: [[P('rocks', 1, 4, { big: true })]] },
        { text: '1-6 hills or huge rocks', alts: [[P('hill', 1, 6)], [P('rocks', 1, 6, { big: true })]] },
        { text: '1-6 hills or woods', alts: [[P('hill', 1, 6)], [P('woods', 1, 6)]] },
        { text: 'Mine: 1-3 buildings, may be on a hill', alts: [[P('hill', 1, 1), P('building', 1, 3)]] }
      ]
    },
    unstable: {
      name: 'Unstable / tectonic world',
      rows: [
        { text: 'Single rubble-covered area or huge rock', alts: [[P('crater', 1, 1)], [P('rocks', 1, 1, { big: true })]] },
        { text: 'Impassable terrain (a lava field)', alts: [[P('lava', 1, 1, { big: true })]] },
        { text: 'High impassable terrain (a volcano)', alts: [[P('rocks', 1, 1, { big: true })]] },
        { text: '1-4 rubble-covered areas', alts: [[P('crater', 1, 4)]] },
        { text: '1-4 hills or rocks', alts: [[P('hill', 1, 4)], [P('rocks', 1, 4)]] },
        { text: 'Outpost: 1-3 reinforced buildings behind reinforced walls', alts: [[P('bunker', 1, 3), P('wall', 2, 6)]], once: true }
      ]
    }
  };

  /* ---------- piece footprints, in inches ---------- */
  var SIZES = {
    woods: [5, 11, 4, 9],
    ruins: [5, 10, 4, 9],
    crater: [4, 9, 3.5, 8],
    hill: [7, 14, 6, 12],
    rocks: [4, 7.5, 3.5, 7],
    building: [4.5, 8, 4, 7],
    bunker: [4, 7, 3.5, 6],
    water: [5, 12, 4, 10],
    deep: [5, 12, 4, 10],
    lava: [5, 12, 4, 10],
    barricade: [3, 8, 1, 1],
    // the book destroys high walls in sections up to 6", so none is laid longer
    wall: [3, 6, 1, 1]
  };

  function ri(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
  /* The same draw, leaning towards the top of the range. A table generated on
     flat draws comes out emptier than the book's pictures of one — the ranges
     read as "1-6 rocks", not "3 or 4 rocks" — so a count sits around 57% of its
     range rather than halfway. It is a nudge, not a thumb on the scale. */
  function riHigh(rand, lo, hi) {
    if (hi <= lo) return lo;
    return lo + Math.floor(Math.pow(rand(), 0.72) * (hi - lo + 1));
  }
  function rf(rand, lo, hi) { return lo + rand() * (hi - lo); }

  function overlap(a, b) {
    var ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ix <= 0 || iy <= 0) return 0;
    return (ix * iy) / Math.min(a.w * a.h, b.w * b.h);
  }

  /* The table's 2' x 2' areas, named by compass quarter. */
  function areasOf(W, H) {
    var cols = Math.max(1, Math.round(W / 24)), rowsN = Math.max(1, Math.round(H / 24));
    var aw = W / cols, ah = H / rowsN, out = [];
    for (var j = 0; j < rowsN; j++) for (var i = 0; i < cols; i++) {
      out.push({
        name: (rowsN === 1 ? '' : (j === 0 ? 'N' : 'S')) + (cols === 1 ? '' : (i === 0 ? 'W' : 'E')) || 'Area',
        x: i * aw, y: j * ah, w: aw, h: ah
      });
    }
    return out;
  }

  /* One area's D6. One re-roll of a 1 or a 2: two areas in six coming up "a
     single crater" left tables with nothing to fight over; this lifts the
     average area roll from 3.5 to about 4.2 without ever forbidding an open
     quarter. `memo` carries "no more than 1 - re-roll further 6s" across a table. */
  function rollArea(gen, rand, memo) {
    memo = memo || {};
    var first = ri(rand, 1, 6), roll = first;
    if (roll <= 2) roll = ri(rand, 1, 6);
    if (roll === 6 && gen.rows[5].once && memo.sixUsed) {
      while (roll === 6) roll = ri(rand, 1, 6);
    }
    if (roll === 6 && gen.rows[5].once) memo.sixUsed = true;
    return { roll: roll, first: first !== roll ? first : null, row: gen.rows[roll - 1] };
  }

  /* Put one rolled result into an area the generator's way: counts leaning
     high, dropped at random, shaped as they land. */
  function fillArea(alt, area, existing, objectives, rand, W, H) {
    var placed = [];
    /* How much this area is getting, before any of it is put down. A
       quadrant with one or two pieces in it wants them where they will be
       fought over, not pressed against the table edge where a unit can only
       ever be on one side of them — so a sparse area is given an inset and
       its terrain comes inland. */
    var wants = alt.map(function (spec) { return riHigh(rand, spec.min, spec.max); });
    var total = wants.reduce(function (a2, b2) { return a2 + b2; }, 0);
    var inset = total < 3 ? Math.min(6, Math.min(area.w, area.h) * 0.3) : 0;
    alt.forEach(function (spec, si) {
      for (var c = 0; c < wants[si]; c++) {
        var piece = place(spec, area, existing.concat(placed), objectives, rand, W, H, inset);
        if (piece) placed.push(piece);
      }
    });
    var RR = root.PMC;
    if (RR && RR.shapePiece) placed.forEach(function (p) { RR.shapePiece(p, rand); });
    return placed;
  }

  /* Divide the table into 2' x 2' areas, roll a D6 for each, place what it gives. */
  function generate(opts) {
    var W = opts.width, H = opts.height;
    var rand = opts.rand || Math.random;
    var gen = GENERATORS[opts.planet] || GENERATORS.sparse;
    var objectives = opts.objectives || [];
    var out = [], rolls = [], memo = {};
    areasOf(W, H).forEach(function (area) {
      var r = rollArea(gen, rand, memo);
      var alt = r.row.alts[Math.floor(rand() * r.row.alts.length)];
      var placed = fillArea(alt, area, out, objectives, rand, W, H);
      out = out.concat(placed);
      rolls.push({ area: area.name, roll: r.roll, text: r.row.text, placed: placed.map(function (p) { return p.kind; }) });
    });
    return { terrain: out, rolls: rolls, generator: gen.name };
  }

  /* A piece's footprint as the generator would roll it. */
  function sizeFor(spec, rand, shrink) {
    var s = SIZES[spec.kind] || SIZES.crater;
    var scale = spec.big ? 1.6 : 1;
    shrink = shrink || 1;
    var lin = spec.kind === 'barricade' || spec.kind === 'wall';
    var w = rf(rand, s[0], s[1]) * scale * shrink, h = rf(rand, s[2], s[3]) * scale * (lin ? 1 : shrink);
    if (lin && rand() < 0.5) { var t = w; w = h; h = t; }
    return { w: w, h: h };
  }
  // no two pieces share ground: half an inch of open ground between them at least
  function clashes(piece, existing) {
    for (var i = 0; i < existing.length; i++) {
      var e = existing[i];
      if (piece.x < e.x + e.w + 0.5 && e.x < piece.x + piece.w + 0.5 &&
        piece.y < e.y + e.h + 0.5 && e.y < piece.y + piece.h + 0.5) return e;
    }
    return null;
  }

  /* `inset` keeps a piece that many inches clear of the table edge. It is only
     asked for when the area has little in it, and it is dropped rather than
     failing if the area is too small to honour it. */
  function place(spec, area, existing, objectives, rand, W, H, inset) {
    inset = inset || 0;
    for (var attempt = 0; attempt < 80; attempt++) {
      // a crowded area gets smaller pieces rather than fewer, once the first tries have failed
      var shrink = attempt < 40 ? 1 : attempt < 60 ? 0.8 : 0.65;
      var sz = sizeFor(spec, rand, shrink), w = sz.w, h = sz.h;
      w = Math.min(w, area.w - 1); h = Math.min(h, area.h - 1);
      // the band of this area it may actually use, once the table edge is spared
      var lo = { x: area.x, y: area.y }, hi = { x: area.x + area.w - w, y: area.y + area.h - h };
      if (inset && attempt < 30) {
        var ix0 = Math.max(lo.x, inset), ix1 = Math.min(hi.x, W - inset - w);
        var iy0 = Math.max(lo.y, inset), iy1 = Math.min(hi.y, H - inset - h);
        if (ix1 > ix0) { lo.x = ix0; hi.x = ix1; }
        if (iy1 > iy0) { lo.y = iy0; hi.y = iy1; }
      }
      var x = lo.x + rand() * Math.max(0, hi.x - lo.x);
      var y = lo.y + rand() * Math.max(0, hi.y - lo.y);
      x = Math.max(0.5, Math.min(W - w - 0.5, x));
      y = Math.max(0.5, Math.min(H - h - 0.5, y));
      var piece = { kind: spec.kind, x: x, y: y, w: w, h: h };

      var clash = !!clashes(piece, existing);
      // objectives must stay reachable and in the open
      for (var o = 0; o < objectives.length && !clash; o++) {
        var pad = { x: piece.x - 3, y: piece.y - 3, w: piece.w + 6, h: piece.h + 6 };
        if (objectives[o].x >= pad.x && objectives[o].x <= pad.x + pad.w &&
          objectives[o].y >= pad.y && objectives[o].y <= pad.y + pad.h) clash = true;
      }
      if (!clash) return piece;
    }
    return null;
  }

  root.PMCGen = {
    GENERATORS: GENERATORS, SIZES: SIZES, generate: generate, areasOf: areasOf, rollArea: rollArea,
    fillArea: fillArea, sizeFor: sizeFor, clashes: clashes, place: place
  };
})(window);
