/* PMC 2670 — Firefight : Dead Reckoning's maps (docs/story-dead-reckoning-plan.md, phase 3)

   Every open-table battle of the first half fought on ground of its own, laid
   the same way each time, as Deep Contract's are (deep-contract-maps.js has
   the rules of it): inches on the 48" table, A's edge to the west, the entry
   strips 4" in from the west and east edges kept clear, and the middle clear
   where a scenario puts its own piece there. Find and secure's three places
   are where the map says (`sites`, levers.js). The first half's compounds
   (Station Thule, the Warren) have no map: their seed lays them. */
(function (root) {
  'use strict';
  root.PMCStoryMaps = root.PMCStoryMaps || {};

  function B(x, y, w, h, plan) { return { kind: 'building', x: x, y: y, w: w, h: h, plan: plan || 'block' }; }
  function N(kind, x, y, w, h, shape) { return { kind: kind, x: x, y: y, w: w, h: h, shape: shape || 'blob' }; }
  function R(kind, x, y, w, h) { return { kind: kind, x: x, y: y, w: w, h: h }; }

  root.PMCStoryMaps['dead-reckoning'] = {

    /* Vesk Free Port's market square: the auction house on its north side, the
       arcade that runs to the landing field, stalls, a little park, and the
       three places that matter (the clock, the fountain, the arcade's mouth). */
    vesk: {
      name: 'The market square, Vesk Free Port', planet: 'dense',
      pieces: [
        B(6, 4, 11, 6, 'U'), B(30, 4, 9, 6, 'L'), B(6, 37, 8, 7, 'T'), B(19, 39, 8, 5, 'annex'),
        R('wall', 30, 30, 1, 7), R('wall', 38, 30, 1, 7),
        R('barricade', 18, 18, 4, 1), R('barricade', 27, 29, 4, 1), R('barricade', 10, 27, 1, 4),
        N('woods', 36, 15, 5, 6, 'lobed'), R('ruins', 8, 18, 4, 4)
      ],
      objectives: [{ x: 14, y: 13, name: 'The clock' }, { x: 24, y: 24, name: 'The fountain' }, { x: 34, y: 35, name: 'The arcade' }]
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
    }
  };
})(typeof window !== 'undefined' ? window : global);
