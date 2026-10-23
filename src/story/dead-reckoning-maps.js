/* PMC 2670 — Firefight : Dead Reckoning's maps (docs/story-dead-reckoning-plan.md, phase 3)

   Every open-table battle of the first half fought on ground of its own, laid
   the same way each time, as Deep Contract's are (deep-contract-maps.js has
   the rules of it): inches on the 48" table, A's edge to the west, the entry
   strips 4" in from the west and east edges kept clear, and the middle clear
   where a scenario puts its own piece there. Find and secure's three places
   are where the map says (`sites`, levers.js). The compounds (Station Thule,
   the Warren, the Wreck of the Morrow, Cold Sites, the Vault, the Spire) have
   no map: their seed lays them.

   The second half's ground (phase 5): each map keeps clear what its scenario
   puts there itself. Hostile takeover's fort, the middle 12"; Parley's flag
   and the two sides' zones, the middle; Breakout's landing zone, the east
   third between y 10 and 38; an Invasion's landing zones, open ground. */
(function (root) {
  'use strict';
  root.PMCStoryMaps = root.PMCStoryMaps || {};

  function B(x, y, w, h, plan) { return { kind: 'building', x: x, y: y, w: w, h: h, plan: plan || 'block' }; }
  function N(kind, x, y, w, h, shape) { return { kind: kind, x: x, y: y, w: w, h: h, shape: shape || 'blob' }; }
  function R(kind, x, y, w, h) { return { kind: kind, x: x, y: y, w: w, h: h }; }

  root.PMCStoryMaps['dead-reckoning'] = {

    /* Vesk Free Port's market square, crossed west to east: the auction house's
       side of it, stalls, a little park, the arcade, and the landing field
       beyond the east edge, where Vane's ship waits (Escort). */
    vesk: {
      name: 'The market square, Vesk Free Port', planet: 'dense',
      pieces: [
        B(6, 4, 11, 6, 'U'), B(30, 4, 9, 6, 'L'), B(6, 37, 8, 7, 'T'), B(19, 39, 8, 5, 'annex'),
        R('wall', 30, 30, 1, 7), R('wall', 38, 30, 1, 7),
        R('barricade', 18, 18, 4, 1), R('barricade', 27, 29, 4, 1), R('barricade', 10, 27, 1, 4),
        N('woods', 36, 15, 5, 6, 'lobed'), R('ruins', 8, 18, 4, 4)
      ]
    },

    /* The Glass Flats on Vantor III: a plain turned to glass by an old impact,
       outcrops of it standing like broken windows, the crater, and three places
       Morrow might have dug. */
    glassflats: {
      name: 'The Glass Flats, Vantor III', planet: 'desert',
      pieces: [
        N('crater', 33, 5, 7, 6, 'blob'), N('crystal', 8, 6, 5, 4, 'rift'), N('crystal', 36, 37, 5, 4, 'rift'),
        N('crystal', 7, 26, 4, 5, 'lobed'), N('hill', 9, 37, 8, 6, 'long'), N('hill', 38, 21, 5, 8, 'long'),
        N('rocks', 26, 40, 5, 4, 'lobed'), R('ruins', 25, 5, 4, 4)
      ],
      sites: { kind: 'searchsite', at: [
        { x: 17, y: 16, name: 'The marker posts' },
        { x: 31, y: 21, name: 'The buried shelter' },
        { x: 21, y: 31, name: 'The scorched hollow' }
      ] }
    },

    /* The Mire on Tessaly IV: drowned forest, deep channels, a mud island, and
       the beacon's spire with the three places its lodestone could be. */
    mire: {
      name: 'The Drowned Beacon, Tessaly IV', planet: 'jungle',
      pieces: [
        N('rocks', 22, 11, 4, 4, 'blob'),
        N('woods', 6, 5, 7, 7, 'lobed'), N('woods', 34, 4, 7, 6, 'blob'), N('woods', 7, 36, 6, 7, 'lobed'), N('woods', 35, 38, 6, 6, 'blob'),
        N('woods', 37, 20, 5, 6, 'long'), N('woods', 6, 20, 5, 6, 'long'),
        N('deep', 14, 41, 9, 3, 'long'), N('water', 26, 39, 6, 5, 'kidney'), N('water', 13, 8, 5, 4, 'kidney')
      ],
      sites: { kind: 'searchsite', at: [
        { x: 24, y: 19, name: 'The socket under the spire' },
        { x: 15, y: 30, name: 'The sunken shrine' },
        { x: 33, y: 29, name: 'The standing stones' }
      ] }
    },

    /* Sable's warehouse on Kerrigan's docks: the basin to the north, sheds and
       cranes round a yard, and the middle clear for the warehouse Sable holds. */
    docks: {
      name: 'The broker’s warehouse, Kerrigan docks', planet: 'industrial',
      pieces: [
        N('deep', 14, 2, 20, 4, 'long'),
        B(6, 8, 9, 6, 'L'), B(33, 8, 9, 6, 'block'), B(6, 35, 9, 7, 'U'), B(33, 35, 9, 7, 'annex'),
        R('ruins', 20, 38, 4, 5), R('wall', 17, 30, 6, 1), R('wall', 26, 17, 6, 1),
        R('barricade', 10, 22, 1, 5), R('barricade', 37, 22, 1, 5)
      ]
    },

    /* The docking ring of Kerrigan's orbital: cargo stacks in rows, the cranes'
       footings, and open deck between. Heavy spin gravity (the chapter's). */
    dockring: {
      name: 'The docking ring, Kerrigan orbital', planet: 'industrial',
      pieces: [
        B(10, 6, 5, 4, 'block'), B(18, 6, 5, 4, 'block'), B(27, 38, 5, 4, 'block'), B(35, 38, 5, 4, 'block'),
        B(21, 21, 6, 6, 'tower'),
        R('wall', 9, 17, 1, 6), R('wall', 38, 25, 1, 6), R('wall', 30, 12, 6, 1), R('wall', 12, 34, 6, 1),
        R('barricade', 15, 27, 4, 1), R('barricade', 29, 20, 4, 1), R('ruins', 34, 6, 4, 4), R('ruins', 9, 39, 4, 4)
      ]
    },

    /* ================= the second half ================= */

    /* The Hollin Shelf on Corvin: a high plateau in thin air, boulders and
       ridges, the shelter where Morrow cached his notes, and a ravine. Kestrel's
       convoy crosses it east to west. */
    hollin: {
      name: 'The Hollin Shelf, Corvin', planet: 'mountain',
      pieces: [
        N('hill', 8, 5, 8, 6, 'long'), N('rocks', 22, 3, 6, 5, 'lobed'), N('rocks', 34, 8, 7, 6, 'blob'),
        N('hill', 10, 36, 9, 7, 'lobed'), N('rocks', 27, 38, 6, 6, 'blob'), N('crater', 36, 30, 5, 5, 'blob'),
        R('ruins', 20, 22, 5, 4), N('ravine', 30, 17, 2, 9, 'rift')
      ]
    },

    /* The fuel depot on Ilya: one building in the scrub, a blockhouse, and the
       hills Wraith Section shoots from. */
    ilya: {
      name: 'The fuel depot, Ilya', planet: 'sparse',
      pieces: [
        B(20, 20, 8, 7, 'annex'), R('bunker', 8, 8, 5, 4), N('hill', 33, 5, 9, 7, 'lobed'), N('hill', 34, 35, 8, 7, 'long'),
        N('rocks', 8, 34, 6, 6, 'blob'), N('woods', 13, 22, 4, 5, 'lobed'), R('barricade', 31, 22, 1, 5), R('wall', 22, 32, 6, 1)
      ]
    },

    /* The landing field on the Quiet: four towers at its corners, glass grown up
       through the pan, and the middle clear for whoever has dug in on it
       (Hostile takeover: The Landing, The Collector). */
    quietfield: {
      name: 'The landing field, the Quiet', planet: 'dense',
      pieces: [
        B(6, 4, 7, 7, 'tower'), B(35, 4, 7, 7, 'tower'), B(6, 37, 7, 7, 'tower'), B(35, 37, 7, 7, 'tower'),
        N('crystal', 20, 4, 5, 4, 'rift'), N('crystal', 22, 41, 5, 4, 'rift'),
        R('ruins', 8, 21, 4, 6), R('ruins', 36, 21, 4, 6), R('barricade', 15, 14, 4, 1), R('barricade', 29, 33, 4, 1)
      ]
    },

    /* The fog on the Quiet, with the towers waking: the way to the last ships
       open in the east (Breakout: Recall). */
    quietfog: {
      name: 'The fog, the Quiet', planet: 'dense',
      pieces: [
        B(8, 5, 6, 6, 'tower'), B(8, 37, 6, 6, 'tower'), B(22, 20, 4, 8, 'tower'),
        N('crystal', 17, 9, 4, 6, 'rift'), N('crystal', 18, 33, 5, 5, 'lobed'), R('ruins', 12, 21, 5, 6),
        N('crater', 39, 3, 4, 4, 'blob'), N('crater', 39, 41, 4, 4, 'blob')
      ]
    },

    /* The Brannock pass in fog: rock walls north and south, a spine down the
       middle, and the Ulvar's three shield turrets across the east of it. */
    brannock: {
      name: 'The Brannock pass', planet: 'mountain',
      pieces: [
        N('rocks', 6, 3, 8, 10, 'lobed'), N('rocks', 6, 35, 8, 10, 'blob'), N('hill', 16, 18, 6, 12, 'long'),
        R('wall', 23, 5, 1, 6), R('wall', 23, 37, 1, 6), N('rocks', 39, 15, 5, 5, 'blob'), N('crater', 38, 41, 4, 4, 'blob')
      ],
      objectives: [{ x: 30, y: 10, name: 'The north turret' }, { x: 34, y: 25, name: 'The pass turret' }, { x: 30, y: 39, name: 'The south turret' }]
    },

    /* The company's camp on Sedra II: open plain, a few rocks, and nothing to
       stop anything stepping out of the air anywhere (Invasion). */
    sedra: {
      name: 'The camp, Sedra II', planet: 'sparse',
      pieces: [
        N('rocks', 8, 6, 5, 4, 'blob'), N('hill', 36, 38, 6, 5, 'lobed'), R('ruins', 22, 22, 4, 4),
        B(9, 36, 5, 4, 'block'), N('crater', 37, 6, 4, 4, 'blob')
      ]
    },

    /* A Hashamer village: low stone houses in the middle, a wall, and the
       ridges east where Brass Ledger's trucks wait. */
    hashamer: {
      name: 'A village, Hashamer I', planet: 'desert',
      pieces: [
        B(20, 18, 5, 4, 'block'), B(26, 24, 5, 4, 'L'), B(19, 27, 5, 4, 'block'), R('wall', 16, 17, 1, 6),
        N('hill', 34, 4, 8, 10, 'long'), N('hill', 34, 34, 8, 9, 'lobed'), N('rocks', 7, 6, 6, 5, 'blob'), N('rocks', 7, 38, 6, 5, 'lobed'),
        R('barricade', 14, 30, 4, 1)
      ]
    },

    /* The lake shore on Orlo: still water to the north and south, woods, the
       Alpha's pylon, and the middle clear for the flag (Parley). */
    orlo: {
      name: 'The lake shore, Orlo', planet: 'sparse',
      pieces: [
        N('deep', 16, 2, 16, 6, 'long'), N('water', 18, 40, 12, 5, 'kidney'), N('woods', 6, 18, 5, 6, 'lobed'),
        N('woods', 37, 24, 5, 6, 'blob'), N('rocks', 6, 37, 5, 5, 'blob'), N('crystal', 38, 9, 3, 4, 'rift')
      ]
    },

    /* The beacon on Tessaly IV again, to light it: the island's shallows, the
       spire beside the pass the company holds, and the drowned forest
       (Hold the Line: Signal Fires). */
    beaconlit: {
      name: 'The beacon, lit, Tessaly IV', planet: 'jungle',
      pieces: [
        N('crystal', 20, 22, 3, 4, 'rift'),
        N('woods', 6, 5, 7, 7, 'lobed'), N('woods', 6, 36, 7, 7, 'blob'), N('woods', 34, 5, 7, 6, 'lobed'), N('woods', 35, 37, 6, 6, 'blob'),
        N('water', 26, 12, 6, 4, 'kidney'), N('deep', 27, 32, 8, 3, 'long'), N('woods', 36, 20, 5, 7, 'long')
      ],
      objectives: [{ x: 16, y: 24, name: 'The beacon' }]
    },

    /* The refinery belt on Umber: plant, walls and pipe-runs, a blockhouse, and
       a toxic pool (Convoy: The Escort). */
    umber: {
      name: 'The refinery belt, Umber', planet: 'industrial',
      pieces: [
        B(14, 4, 8, 6, 'L'), B(28, 38, 8, 6, 'block'), R('wall', 20, 15, 1, 7), R('wall', 27, 25, 1, 7),
        N('water', 8, 30, 5, 5, 'kidney'), R('bunker', 34, 8, 6, 5), R('barricade', 11, 20, 4, 1), R('barricade', 32, 27, 4, 1),
        N('crater', 21, 33, 4, 3, 'blob'), R('ruins', 37, 18, 4, 5)
      ]
    },

    /* The refinery yard on Tarn, where the bailiffs wait: sheds, a cracking
       tower, and walls (Meeting engagement: Debts). */
    tarn: {
      name: 'The refinery yard, Tarn', planet: 'industrial',
      pieces: [
        B(8, 6, 7, 6, 'U'), B(33, 35, 8, 7, 'annex'), B(20, 20, 8, 8, 'tower'), R('wall', 8, 30, 6, 1), R('wall', 34, 16, 6, 1),
        N('crater', 36, 6, 4, 4, 'blob'), N('crater', 10, 38, 5, 4, 'lobed'), R('barricade', 16, 34, 1, 5), R('barricade', 31, 9, 1, 5)
      ]
    }
  };
})(typeof window !== 'undefined' ? window : global);
