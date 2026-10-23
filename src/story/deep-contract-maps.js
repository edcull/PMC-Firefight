/* PMC 2670 — Firefight : Deep Contract's maps (docs/story-mode-plan.md)

   Every open-table battle of the story is fought on ground of its own, laid
   the same way each time: the starport, the refinery, the ore yards, the
   pumping station, Pit Nine and the rest. Inches on the book's 4' x 4' table
   (48" square, A's edge to the west); a 6' x 4' table at Priority Level 3
   stretches them east to west (levers.js). Each map keeps the entry strips
   (4" in from the west and east edges) clear, and the middle clear where a
   scenario puts its own piece there (Demolish's target, Hostile takeover's
   fort, Find and secure's search sites).

   A piece: { kind, x, y, w, h }, with `shape` (a natural piece's outline:
   blob, lobed, kidney, long, rift) or `plan` (a building's: block, L, T, U,
   annex, tower). `objectives`, where a scenario has the same number: where
   they stand. A mission fought in a compound (Close Encounters) has no map:
   its compound is laid by the generator from the mission's own seed. */
(function (root) {
  'use strict';
  root.PMCStoryMaps = root.PMCStoryMaps || {};

  function B(x, y, w, h, plan) { return { kind: 'building', x: x, y: y, w: w, h: h, plan: plan || 'block' }; }
  function N(kind, x, y, w, h, shape) { return { kind: kind, x: x, y: y, w: w, h: h, shape: shape || 'blob' }; }
  function R(kind, x, y, w, h) { return { kind: kind, x: x, y: y, w: w, h: h }; }

  root.PMCStoryMaps['deep-contract'] = {

    /* The starport: three landing pads, the hangars along the north fence, the
       control tower, and the terminal the Front came through. */
    starport: {
      name: 'Kessler’s Reach starport', planet: 'industrial',
      pieces: [
        R('road', 9, 33, 7, 7), R('road', 20.5, 20.5, 7, 7), R('road', 32, 8, 7, 7),
        B(7, 5, 11, 7, 'block'), B(21, 4, 7, 6, 'annex'), B(32, 33, 10, 7, 'U'),
        R('bunker', 22, 34, 5, 5),
        R('wall', 12, 16, 7, 1), R('wall', 30, 21, 1, 6), R('barricade', 17, 28, 4, 1), R('barricade', 30, 28, 4, 1),
        N('crater', 11, 23, 5, 4, 'blob'), N('crater', 34, 19, 4, 4, 'lobed'), N('ruins', 36, 41, 5, 4)
      ],
      objectives: [{ x: 12.5, y: 36.5, name: 'Pad One' }, { x: 24, y: 24, name: 'Pad Two' }, { x: 35.5, y: 11.5, name: 'Pad Three' }]
    },

    /* The Number Three refinery: the cracking tower, the tank farm, pipe runs,
       and the open yards the Front comes across. Room for three landing zones. */
    refinery: {
      name: 'Number Three refinery', planet: 'industrial',
      pieces: [
        B(20, 19, 8, 10, 'tower'),
        R('bunker', 9, 7, 6, 5), R('bunker', 9, 36, 6, 5),
        B(31, 6, 8, 6, 'L'), B(31, 36, 8, 6, 'T'),
        R('wall', 18, 10, 1, 6), R('wall', 18, 32, 1, 6), R('wall', 29, 22, 1, 5),
        R('barricade', 12, 18, 1, 5), R('barricade', 12, 26, 1, 5),
        N('water', 38, 21, 4, 6, 'kidney'), N('crater', 26, 41, 4, 3, 'blob')
      ]
    },

    /* The old ore yards, where the Front keeps its depot: ore heaps, sheds, and
       a clear yard in the middle round the depot itself. */
    oreyards: {
      name: 'The old ore yards', planet: 'industrial',
      pieces: [
        N('rocks', 8, 6, 7, 5, 'lobed'), N('rocks', 8, 37, 7, 5, 'blob'), N('rocks', 34, 37, 6, 5, 'lobed'),
        B(33, 5, 8, 6, 'L'), B(18, 4, 6, 5, 'block'), B(18, 40, 7, 5, 'annex'),
        R('ruins', 7, 21, 5, 6), R('ruins', 37, 22, 4, 5),
        R('barricade', 9, 15, 5, 1), R('barricade', 29, 35, 5, 1), R('wall', 34, 14, 1, 5)
      ]
    },

    /* The pumping station above the oldest shafts: rough ground, spoil heaps,
       the station's sheds, and the head of the stairs down. */
    pumping: {
      name: 'The pumping station', planet: 'mountain',
      pieces: [
        N('hill', 6, 5, 9, 7, 'lobed'), N('hill', 33, 36, 9, 7, 'blob'),
        N('rocks', 7, 37, 6, 5, 'lobed'), N('rocks', 35, 6, 6, 5, 'blob'),
        B(17, 4, 6, 5, 'block'), B(26, 41, 6, 4, 'block'),
        N('woods', 5, 20, 4, 8, 'long'), N('woods', 39, 20, 4, 8, 'lobed'),
        N('crater', 17, 39, 4, 4, 'blob'), N('crater', 27, 5, 4, 4, 'lobed')
      ],
      /* Find and secure's three possible locations: the station's pump houses,
         where Varga might be. Each is a shed 4" across that blocks line of sight. */
      sites: {
        kind: 'pumphouse',
        at: [
          { x: 18, y: 17, name: 'The north pump house' },
          { x: 31, y: 22, name: 'The east pump house' },
          { x: 21, y: 30, name: 'The south pump house' }
        ]
      }
    },

    /* Pit Nine: a mining town, its main street running east to west, the
       school on the square, HTX's site office, terraced houses. */
    pitnine: {
      name: 'Pit Nine', planet: 'dense',
      pieces: [
        R('road', 4, 22, 40, 4),
        B(8, 8, 7, 6, 'L'), B(18, 9, 6, 5, 'block'), B(28, 7, 8, 6, 'U'), B(38, 10, 5, 5, 'block'),
        B(8, 31, 6, 6, 'annex'), B(19, 32, 9, 7, 'T'), B(33, 31, 7, 6, 'L'),
        R('barricade', 15, 18, 5, 1), R('barricade', 28, 29, 5, 1), R('wall', 28, 14, 1, 5),
        N('ruins', 37, 39, 5, 5), N('crater', 10, 41, 4, 3, 'blob')
      ],
      objectives: [{ x: 13, y: 24, name: 'The pithead' }, { x: 24, y: 17, name: 'The school' }, { x: 36, y: 24, name: 'HTX’s office' }]
    },

    /* The slag ridges north of the Pits: open ground broken by spoil heaps. */
    ridges: {
      name: 'The slag ridges', planet: 'barren',
      pieces: [
        N('hill', 10, 8, 10, 7, 'lobed'), N('hill', 28, 33, 10, 7, 'kidney'),
        N('rocks', 26, 9, 6, 5, 'blob'), N('rocks', 13, 33, 6, 5, 'lobed'),
        N('crater', 21, 21, 6, 6, 'blob'), N('crater', 36, 18, 4, 4, 'lobed'), N('crater', 9, 22, 4, 4, 'blob'),
        R('ruins', 38, 6, 5, 5), R('ruins', 6, 39, 5, 4)
      ]
    },

    /* The hill country where the Front's last cells hide: woods, gullies, an
       abandoned mine head. */
    hills: {
      name: 'The hill country', planet: 'mountain',
      pieces: [
        N('woods', 7, 6, 9, 7, 'lobed'), N('woods', 33, 35, 9, 7, 'lobed'), N('woods', 34, 6, 7, 6, 'blob'),
        N('hill', 6, 36, 8, 7, 'blob'), N('rocks', 17, 40, 5, 4, 'blob'),
        B(26, 4, 6, 5, 'block'), N('ravine', 39, 20, 3, 8, 'longrift'), N('crater', 6, 22, 4, 4, 'blob')
      ]
    },

    /* The Front's redoubt: a bare hilltop the defender fortifies, the slopes
       below it, the old shafts at its feet. */
    redoubt: {
      name: 'The redoubt', planet: 'mountain',
      pieces: [
        N('rocks', 6, 6, 7, 6, 'lobed'), N('rocks', 35, 36, 7, 6, 'blob'),
        N('woods', 6, 36, 7, 6, 'lobed'), N('woods', 35, 6, 7, 6, 'blob'),
        N('crater', 17, 4, 5, 4, 'blob'), N('crater', 26, 40, 5, 4, 'blob'),
        R('ruins', 5, 21, 4, 6), R('ruins', 39, 21, 4, 6)
      ]
    },

    /* Neutral ground for talking: a burned-out way station between the lines. */
    waystation: {
      name: 'The way station', planet: 'barren',
      pieces: [
        R('road', 18, 22, 12, 4),
        B(6, 6, 6, 5, 'block'), B(36, 37, 6, 5, 'block'),
        N('ruins', 20, 7, 8, 5), N('ruins', 20, 36, 8, 5),
        N('rocks', 5, 37, 6, 5, 'lobed'), N('rocks', 37, 6, 6, 5, 'blob'),
        R('barricade', 22, 16, 4, 1), R('barricade', 22, 31, 4, 1)
      ],
      objectives: [{ x: 24, y: 24, name: 'The meeting point' }]
    },

    /* The pass: a cut through the ridge on the company's side, the only way
       out of the hive's country. */
    pass: {
      name: 'The pass', planet: 'mountain',
      pieces: [
        N('rocks', 12, 4, 10, 15, 'lobed'), N('rocks', 12, 30, 10, 14, 'blob'),
        N('hill', 30, 6, 8, 7, 'lobed'), N('hill', 30, 35, 8, 7, 'blob'),
        N('crater', 33, 21, 5, 6, 'blob'), R('barricade', 21, 21, 1, 3), R('barricade', 21, 26, 1, 3)
      ],
      objectives: [{ x: 17, y: 24.5, name: 'The pass' }]
    },

    /* The HTX uplink station: dishes, a relay hut, a fence, and three things
       worth wrecking, not all of them real. */
    uplink: {
      name: 'The uplink station', planet: 'barren',
      pieces: [
        B(20, 5, 8, 6, 'annex'), R('bunker', 21, 37, 6, 5),
        R('wall', 30, 14, 1, 7), R('wall', 30, 27, 1, 7), R('wire', 32, 22, 1, 4),
        N('rocks', 6, 6, 6, 5, 'blob'), N('rocks', 6, 37, 6, 5, 'lobed'),
        N('crater', 38, 6, 4, 4, 'blob'), N('crater', 38, 38, 4, 4, 'lobed')
      ],
      objectives: [{ x: 14, y: 17, name: 'The relay' }, { x: 24, y: 28, name: 'The dish' }, { x: 36, y: 17, name: 'The transmitter' }]
    },

    /* The haul road across the moon, cut between spoil heaps and old workings. */
    haulroad: {
      name: 'The haul road', planet: 'industrial',
      pieces: [
        R('road', 0, 22, 48, 4),
        N('rocks', 8, 8, 7, 6, 'lobed'), N('rocks', 30, 34, 8, 6, 'blob'),
        B(22, 8, 7, 5, 'L'), B(14, 33, 6, 5, 'block'),
        N('ruins', 34, 9, 6, 5), N('crater', 22, 31, 4, 4, 'blob'),
        R('barricade', 38, 18, 4, 1), R('barricade', 8, 29, 4, 1)
      ]
    },

    /* HTX's headquarters compound: the yard Black Lantern means to hold. */
    htxyard: {
      name: 'HTX’s headquarters', planet: 'industrial',
      pieces: [
        B(6, 5, 9, 7, 'U'), B(33, 36, 9, 7, 'U'), B(6, 36, 8, 6, 'L'), B(34, 5, 8, 6, 'L'),
        R('ruins', 20, 4, 6, 4), R('ruins', 20, 40, 6, 4),
        R('barricade', 5, 22, 1, 5), R('barricade', 42, 22, 1, 5)
      ]
    },

    /* The slag fields round the last landing zone, under the orbital strikes. */
    slagfields: {
      name: 'The slag fields', planet: 'unstable',
      pieces: [
        N('lava', 14, 5, 7, 8, 'rift'), N('lava', 22, 36, 6, 7, 'rift'),
        N('rocks', 7, 18, 6, 5, 'lobed'), N('rocks', 26, 20, 5, 5, 'blob'),
        N('crater', 14, 30, 5, 4, 'blob'), N('crater', 38, 8, 4, 4, 'lobed'),
        R('ruins', 7, 38, 5, 4)
      ]
    }
  };
})(typeof window !== 'undefined' ? window : global);
