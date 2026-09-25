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
        { text: 'Mine: 1-3 buildings, may be on a hill', alts: [[P('hill', 1, 1), P('building', 1, 3, { onHill: true })]] }
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
    mesa: [5, 10, 4, 8],
    ravine: [6, 14, 2.5, 5],
    barricade: [3, 8, 1, 1],
    // the book destroys high walls in sections up to 6", so none is laid longer
    wall: [3, 6, 1, 1]
  };

  function ri(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
  function rf(rand, lo, hi) { return lo + rand() * (hi - lo); }
  /* How many of a rolled feature go down: straight off the book's range,
     every count in it as likely as any other (p. 47). */
  function countFor(spec, rand) {
    return ri(rand, spec.min, spec.max);
  }

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

  /* One area's D6, as the book rolls it (p. 47) — no second chances.
     `memo` carries "no more than 1 - re-roll further 6s" across a table. */
  function rollArea(gen, rand, memo) {
    memo = memo || {};
    var first = ri(rand, 1, 6), roll = first;
    if (roll === 6 && gen.rows[5].once && memo.sixUsed) {
      while (roll === 6) roll = ri(rand, 1, 6);
    }
    if (roll === 6 && gen.rows[5].once) memo.sixUsed = true;
    return { roll: roll, first: first !== roll ? first : null, row: gen.rows[roll - 1] };
  }

  /* Put one rolled result into an area the generator's way: counts leaning
     high, dropped at random, shaped as they land — except the walls, which are
     built rather than dropped. */
  function fillArea(alt, area, existing, objectives, rand, W, H) {
    var placed = [];
    /* How much this area is getting, before any of it is put down. A
       quadrant with one or two pieces in it wants them where they will be
       fought over, not pressed against the table edge where a unit can only
       ever be on one side of them — so a sparse area is given an inset and
       its terrain comes inland. */
    var wants = alt.map(function (spec) { return countFor(spec, rand); });
    var total = wants.reduce(function (a2, b2) { return a2 + b2; }, 0);
    var inset = total < 3 ? Math.min(6, Math.min(area.w, area.h) * 0.3) : 0;
    // what stands goes down first, so the walls have something to be built round
    var walls = [];
    // hills go down before whatever may stand on them
    var order = alt.map(function (spec, si) { return si; }).sort(function (a2, b2) {
      return (alt[a2].kind === 'hill' ? 0 : 1) - (alt[b2].kind === 'hill' ? 0 : 1);
    });
    order.forEach(function (si) {
      var spec = alt[si];
      if (LINEAR[spec.kind]) { walls.push({ spec: spec, n: wants[si] }); return; }
      for (var c = 0; c < wants[si]; c++) {
        var all = existing.concat(placed), piece = null;
        /* A smaller piece may stand on a hill — a wood on a hill, a mine on a
           hill (pp. 42, 48) — and then counts as the smaller piece only. The
           book's "may be on a hill" puts it there whenever it can; anything
           else that could goes up now and then. */
        if (ONHILL[spec.kind] && rand() < (spec.onHill ? 1 : 0.3)) {
          var hills = all.filter(function (h) {
            return h.kind === 'hill' && !h.top && h.w >= 6 && h.h >= 5 &&
              h.x + h.w / 2 >= area.x && h.x + h.w / 2 < area.x + area.w && h.y + h.h / 2 >= area.y && h.y + h.h / 2 < area.y + area.h;
          });
          for (var hi = 0; hi < hills.length && !piece; hi++) piece = placeOnHill(spec, hills[hi], all, rand);
        }
        if (!piece) piece = place(spec, area, all, objectives, rand, W, H, inset);
        if (piece) placed.push(piece);
      }
    });
    /* The buildings these walls belong to: the ones this roll has just put
       down, or — when a player laid the buildings by hand and left the rest to
       be placed for them — the ones already standing in this area. */
    var built = placed.filter(function (p) { return BUILT[p.kind]; });
    if (!built.length) {
      built = existing.filter(function (p) {
        return BUILT[p.kind] && p.x + p.w / 2 >= area.x && p.x + p.w / 2 < area.x + area.w &&
          p.y + p.h / 2 >= area.y && p.y + p.h / 2 < area.y + area.h;
      });
    }
    walls.forEach(function (wl) {
      var left = wl.n;
      if (built.length) left -= enclose(wl.spec, left, built, area, existing, placed, objectives, rand, W, H);
      if (left > 0) runOfWall(wl.spec, left, area, existing, placed, objectives, rand, W, H, inset);
    });
    var RR = root.PMC;
    if (RR && RR.shapePiece) placed.forEach(function (p) { RR.shapePiece(p, rand); });
    return placed;
  }

  /* ---------- walls are built, not scattered ----------
     A wall in the book's tables comes with the buildings rolled beside it —
     "an outpost: buildings and walls", "a farmhouse: buildings and low walls" —
     and on a real table it goes round them: a yard, a compound, a perimeter.
     Dropped one at a time they came out as loose slabs strewn across the area,
     each on its own and none of them walling anything in.

     So the buildings of a roll are grouped, and the walls are run round the
     group: a yard wide enough to stand in between wall and building, the side
     facing the middle of the table built first — that is the side the fight
     comes from — then the flanks, then the back. A gateway is left in the
     front: high walls are impassable, and a compound with no way in is not a
     compound, it is a sealed box. A roll that gives fewer walls than the ring
     needs builds as much of it as it has, which reads as a walled yard open
     at the back rather than a scatter.

     Sections are the book's: a high wall is destroyed in sections of up to 6",
     so none is longer. Neighbouring sections keep half an inch apart, which is
     the gap every two pieces of terrain keep (the scenario's clean-up would
     push them apart otherwise) and far too narrow for a 2" base to pass. */
  var LINEAR = { wall: 1, barricade: 1 };
  var BUILT = { building: 1, bunker: 1 };
  var THICK = 1;            // a wall's depth, in inches
  var JOINT = 0.55;         // between neighbouring sections: just over the half inch every piece keeps
  var GATE = 4;             // a gateway: a 2" base with room either side
  var SECTION = 6;          // the longest section the book allows

  function bbox(list) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (p) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function gapBetween(a, b) {
    var dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    var dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    return Math.hypot(dx, dy);
  }
  /* Buildings close enough to share a yard are walled in together; one
     standing apart gets a compound of its own. Biggest group first. */
  function groupsOf(built) {
    var groups = [];
    built.forEach(function (b) {
      var home = groups.filter(function (g) { return g.some(function (o) { return gapBetween(o, b) < 6; }); });
      if (!home.length) { groups.push([b]); return; }
      var merged = [b];
      home.forEach(function (g) { merged = merged.concat(g); groups.splice(groups.indexOf(g), 1); });
      groups.push(merged);
    });
    return groups.sort(function (a, b) {
      var A = bbox(a), B = bbox(b);
      return B.w * B.h - A.w * A.h;
    });
  }

  // a piece may go here: on the table, off everyone else's ground, clear of the objectives
  function fits(piece, others, objectives, W, H) {
    if (piece.x < 0.5 || piece.y < 0.5 || piece.x + piece.w > W - 0.5 || piece.y + piece.h > H - 0.5) return false;
    if (clashes(piece, others)) return false;
    for (var o = 0; o < objectives.length; o++) {
      var ob = objectives[o];
      if (ob.x >= piece.x - 3 && ob.x <= piece.x + piece.w + 3 && ob.y >= piece.y - 3 && ob.y <= piece.y + piece.h + 3) return false;
    }
    return true;
  }

  /* A side of the ring, cut into sections no longer than the book allows,
     with a gateway taken out of its middle if it is the front. */
  function cutSide(from, to, gate) {
    var spans = [[from, to]];
    if (gate) {
      var len = to - from;
      if (len >= GATE + 2 * 1.5) {
        var mid = from + len / 2;
        spans = [[from, mid - GATE / 2], [mid + GATE / 2, to]];
      } else {
        spans = [[from + GATE, to]];            // too short to have wall both sides: open at one end
      }
    }
    var out = [];
    spans.forEach(function (s) {
      var len = s[1] - s[0];
      if (len < 1.5) return;
      var k = Math.ceil((len + JOINT) / (SECTION + JOINT));
      var each = (len - (k - 1) * JOINT) / k;
      for (var i = 0; i < k; i++) out.push([s[0] + i * (each + JOINT), s[0] + i * (each + JOINT) + each]);
    });
    return out;
  }

  /* Wall in the buildings of one roll. Returns how many sections went down. */
  function enclose(spec, budget, built, area, existing, placed, objectives, rand, W, H) {
    var laid = 0;
    groupsOf(built).forEach(function (group) {
      if (laid >= budget) return;
      laid += compound(spec, budget - laid, group, existing, placed, objectives, rand, W, H);
    });
    return laid;
  }

  function compound(spec, budget, group, existing, placed, objectives, rand, W, H) {
    var box = bbox(group);
    // room to stand in the yard: a high wall keeps a little further off than a garden one
    var yard = spec.kind === 'wall' ? rf(rand, 3, 4) : rf(rand, 2.5, 3.5);
    var x0 = box.x - yard - THICK, y0 = box.y - yard - THICK;
    var x1 = box.x + box.w + yard + THICK, y1 = box.y + box.h + yard + THICK;
    /* A side that would run off the table is not built: the table edge closes
       it well enough, and a wall laid along the very edge walls nothing in. */
    var open = { N: y0 < 0.5, S: y1 > H - 0.5, W: x0 < 0.5, E: x1 > W - 0.5 };
    x0 = Math.max(0.5, x0); y0 = Math.max(0.5, y0);
    x1 = Math.min(W - 0.5, x1); y1 = Math.min(H - 0.5, y1);

    // the side that faces the middle of the table is where the fight comes from
    var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var tx = W / 2 - cx, ty = H / 2 - cy;
    var facing = { N: -ty, S: ty, W: -tx, E: tx };
    var order = ['N', 'S', 'W', 'E'].filter(function (s) { return !open[s]; })
      .sort(function (a, b) { return facing[b] - facing[a]; });
    if (!order.length) return 0;
    var front = order[0];
    var back = { N: 'S', S: 'N', W: 'E', E: 'W' }[front];
    // front, then the two flanks, then the back
    order = [front].concat(order.filter(function (s) { return s !== front && s !== back; }))
      .concat(order.indexOf(back) >= 0 && back !== front ? [back] : []);

    /* The long sides own the corners; the short sides run between them, a
       joint's width short at each end so no two sections touch. */
    function sectionsOf(side) {
      var horiz = side === 'N' || side === 'S';
      var spans = horiz
        ? cutSide(x0, x1, side === front)
        : cutSide(y0 + (open.N ? 0 : THICK + JOINT), y1 - (open.S ? 0 : THICK + JOINT), side === front);
      return spans.map(function (s) {
        return horiz
          ? { kind: spec.kind, x: s[0], y: side === 'N' ? y0 : y1 - THICK, w: s[1] - s[0], h: THICK }
          : { kind: spec.kind, x: side === 'W' ? x0 : x1 - THICK, y: s[0], w: THICK, h: s[1] - s[0] };
      });
    }

    var laid = 0;
    for (var i = 0; i < order.length && laid < budget; i++) {
      var secs = sectionsOf(order[i]);
      /* A flank is built from the front corner backwards, so a short roll
         leaves the back of the yard open rather than the front. */
      if ((order[i] === 'W' || order[i] === 'E') && front === 'S') secs.reverse();
      if ((order[i] === 'N' || order[i] === 'S') && front === 'E') secs.reverse();
      for (var k = 0; k < secs.length && laid < budget; k++) {
        var p = secs[k];
        // a section with something already on its ground is simply left out: a breach in the wall
        if (!fits(p, existing.concat(placed), objectives, W, H)) continue;
        placed.push(p);
        laid++;
      }
    }
    return laid;
  }

  /* Walls with no building to go round — "1-3 low walls", or more walls than
     the compound needed — are laid as lengths of wall, section after section,
     sometimes turning a corner, rather than as slabs on their own. */
  function runOfWall(spec, budget, area, existing, placed, objectives, rand, W, H, inset) {
    var last = null, dir = null;
    for (var n = 0; n < budget; n++) {
      var next = null;
      if (last) {
        for (var t = 0; t < 6 && !next; t++) {
          // carry straight on, or now and then turn the corner
          var turn = t > 0 || rand() < 0.3;
          var d = turn ? (dir === 'x' ? 'y' : 'x') : dir;
          var len = rf(rand, 4, SECTION);
          var ahead = rand() < 0.5;             // which way the new section runs
          var atFar = rand() < 0.5;             // turning: off which end of the last one
          var q;
          if (d === 'x') {
            // horizontal: on from either end, or round the corner at the top or bottom of an upright
            var yy = turn ? (atFar ? last.y + last.h - THICK : last.y) : last.y;
            q = ahead
              ? { x: last.x + last.w + JOINT, y: yy, w: len, h: THICK }
              : { x: last.x - JOINT - len, y: yy, w: len, h: THICK };
          } else {
            var xx = turn ? (atFar ? last.x + last.w - THICK : last.x) : last.x;
            q = ahead
              ? { x: xx, y: last.y + last.h + JOINT, w: THICK, h: len }
              : { x: xx, y: last.y - JOINT - len, w: THICK, h: len };
          }
          q.kind = spec.kind;
          if (fits(q, existing.concat(placed), objectives, W, H)) { next = q; dir = d; }
        }
      }
      if (!next) {
        // the first length of a new run goes down where the book would drop it
        next = place(spec, area, existing.concat(placed), objectives, rand, W, H, inset);
        if (!next) return;
        dir = next.w >= next.h ? 'x' : 'y';
      }
      placed.push(next);
      last = next;
    }
  }

  /* Divide the table into 2' x 2' areas, roll a D6 for each, place what it gives. */
  function generate(opts) {
    var W = opts.width, H = opts.height;
    var rand = opts.rand || Math.random;
    var gen = tableFor(opts.planet);
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
  // what may stand on a hill, inside its crest, clear of everything else on it
  var ONHILL = { woods: 1, ruins: 1, building: 1, bunker: 1, crater: 1, rocks: 1 };
  function placeOnHill(spec, hill, existing, rand) {
    var inner = { x: hill.x + hill.w * 0.22, y: hill.y + hill.h * 0.22, w: hill.w * 0.56, h: hill.h * 0.56 };
    /* A wood grows over most of the hill and may run on down its sides; a
       building, a ruin or rocks stand on top, inside the crest. */
    var spill = spec.kind === 'woods';
    for (var attempt = 0; attempt < 40; attempt++) {
      var piece;
      if (spill) {
        var k = (attempt < 20 ? 0.75 : 0.6) + rand() * 0.45;
        var ww = hill.w * k, hh = hill.h * (k * (0.8 + rand() * 0.3));
        var cx = hill.x + hill.w / 2 + (rand() - 0.5) * hill.w * 0.35, cy = hill.y + hill.h / 2 + (rand() - 0.5) * hill.h * 0.35;
        piece = { kind: 'woods', x: cx - ww / 2, y: cy - hh / 2, w: ww, h: hh, onHill: true };
      } else {
        var sz = sizeFor(spec, rand, attempt < 20 ? 0.75 : 0.55);
        var w = Math.min(sz.w, inner.w), h = Math.min(sz.h, inner.h);
        if (w < 2 || h < 2) return null;
        piece = { kind: spec.kind, x: inner.x + rand() * (inner.w - w), y: inner.y + rand() * (inner.h - h), w: w, h: h, onHill: true };
      }
      if (piece.x < 0.5 || piece.y < 0.5 || piece.x + piece.w > (root.PMC ? root.PMC.BOARD.w : 48) - 0.5 || piece.y + piece.h > (root.PMC ? root.PMC.BOARD.h : 48) - 0.5) continue;
      if (spec.big) piece.big = true;
      var others = existing.filter(function (e) { return e !== hill; });
      if (!clashes(piece, others)) return piece;
    }
    return null;
  }
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

  /* ---------- one table, two worlds ----------
     The book gives one table for a "barren / arctic world", and on the table
     the two are the same fight: the same rolls, the same pieces. They do not
     look it — a desert is not a snowfield — so the planet a battle is fought on
     can be either, and each is laid from the book's one table.

     `barren` stays a table and stays a name the game understands, because old
     campaign contracts carry it; when a battle is set up it is settled into
     one world or the other, once, so every screen paints the same one. */
  var VARIANTS = { barren: ['desert', 'arctic'] };
  var BASE = { desert: 'barren', arctic: 'barren' };
  var WORLD_NAME = { desert: 'Desert world (barren)', arctic: 'Arctic world (barren)' };

  // the book's table for a world, under the world's own name
  /* The barren table fought on a desert or an arctic world: its impassable
     ground is what that world has — a mesa standing out of the sand, a ravine in
     the ice — rather than a lava field on either. */
  var IMPASSABLE = {
    desert: { kind: 'mesa', text: '1-3 impassable areas (mesas, high rocks)' },
    arctic: { kind: 'ravine', text: '1-3 impassable areas (ice ravines, high rocks)' }
  };
  function worldRows(rows, planet) {
    var im = IMPASSABLE[planet];
    if (!im) return rows;
    return rows.map(function (row) {
      var hot = row.alts.some(function (alt) { return alt.some(function (sp) { return sp.kind === 'lava'; }); });
      if (!hot) return row;
      return {
        text: im.text, once: row.once,
        alts: row.alts.map(function (alt) { return alt.map(function (sp) { return sp.kind === 'lava' ? P(im.kind, sp.min, sp.max, sp.big ? { big: true } : null) : sp; }); })
      };
    });
  }
  function tableFor(planet) {
    if (GENERATORS[planet]) return GENERATORS[planet];
    if (BASE[planet]) {
      var t = GENERATORS[BASE[planet]];
      return { name: WORLD_NAME[planet], rows: worldRows(t.rows, planet) };
    }
    return GENERATORS.sparse;
  }

  /* The world a battle is actually fought on. "Random" is a pick among the
     book's seven kinds of world, each as likely as the next — a barren world
     is not made twice as common by coming in two looks — and a barren one is
     then settled into desert or arctic, half and half. */
  function resolvePlanet(planet, rand) {
    rand = rand || Math.random;
    if (!planet || planet === 'random') {
      var kinds = Object.keys(GENERATORS);
      planet = kinds[Math.floor(rand() * kinds.length)];
    }
    var v = VARIANTS[planet];
    return v ? v[Math.floor(rand() * v.length)] : planet;
  }

  root.PMCGen = {
    GENERATORS: GENERATORS, SIZES: SIZES, generate: generate, areasOf: areasOf, rollArea: rollArea,
    fillArea: fillArea, sizeFor: sizeFor, clashes: clashes, place: place, ONHILL: ONHILL,
    tableFor: tableFor, resolvePlanet: resolvePlanet, VARIANTS: VARIANTS, BASE: BASE
  };
})(window);
