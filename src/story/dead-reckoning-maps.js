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
  // a paved road (a settlement's, not a dirt track)
  // cargo stacked on concrete: a crater field by the rules, rows of crates with walkways between to look at
  function CG(x, y, w, h) { return { kind: 'crater', x: x, y: y, w: w, h: h, cargo: 'apron' }; }
  function P(x, y, w, h) { return { kind: 'road', x: x, y: y, w: w, h: h, paved: true }; }

  root.PMCStoryMaps['dead-reckoning'] = {

    /* Vesk Free Port: a settlement at a crossroads, crossed west to east. Paved
       roads run in from the four edges of the table and meet in the market
       square in the middle. The auction house, a glass tower over the whole
       port, stands in the middle of the square, so the way across goes round
       it, and a fountain stands off its north-east corner, between the roads,
       too tall to see across. Houses, warehouses and the arcade crowd the four quarters, and
       railings and planters line both sides of each road where it comes
       into the square. The landing field is beyond the east edge, where Vane's ship
       waits (Escort). Its skin is the market's (`skin`): the barricades are
       railings and planters, the craters market clutter, as the rules still
       read them (levers.js, iso-props.js). */
    vesk: {
      name: 'The market square, Vesk Free Port', planet: 'dense', skin: 'market',
      pieces: [
        // the crossroads: four paved roads from the table's edges, and the square where they meet, paved round the auction house
        P(0, 22, 16, 4), P(32, 22, 16, 4), P(22, 0, 4, 16), P(22, 32, 4, 16),
        P(16, 16, 16, 4), P(16, 20, 4, 12), P(28, 20, 4, 12), P(20, 28, 8, 4),
        P(20, 20, 8, 1.5), P(20, 26.5, 8, 1.5), P(20, 21.5, 1.5, 5), P(26.5, 21.5, 1.5, 5),
        R('fountain', 33, 16.5, 4, 4), Object.assign(B(21.5, 21.5, 5, 5, 'block'), { style: 'glass', tall: 4.5 }),
        // the four quarters: houses, warehouses, the arcade
        B(5, 3, 9, 7, 'U'), B(15, 3, 5, 5, 'block'), B(5, 13, 5, 6, 'L'),
        B(30, 3, 9, 6, 'L'), B(40, 4, 4, 5, 'annex'), B(31, 11, 5, 5, 'block'), R('ruins', 38, 12, 4, 4),
        B(5, 30, 5, 4, 'block'), B(5, 36, 8, 7, 'T'), B(15, 40, 5, 5, 'annex'),
        B(33, 30, 4, 5, 'annex'), B(32, 37, 9, 6, 'block'), R('wall', 29, 38, 1, 6),
        // the boulevards' railings and planters, along both edges of each road where it comes into the square (the fountain stands in place of the east road's north side)
        R('barricade', 10, 21, 6, 1), R('barricade', 10, 26, 6, 1), R('barricade', 32, 26, 6, 1),
        R('barricade', 21, 10, 1, 6), R('barricade', 26, 10, 1, 6), R('barricade', 21, 32, 1, 6), R('barricade', 26, 32, 1, 6),
        // the market's clutter: cargo cases, drums and vending terminals where the market overflows
        N('crater', 11, 12, 4, 4, 'blob'), N('crater', 11, 31, 4, 4, 'blob'), N('crater', 38, 31, 4, 4, 'blob')
      ]
    },

    /* Vesk's landing field, after Lot 47 was lost: Brass Ledger's shuttle on
       its pad in the north-east corner, a fuel bowser hosed up to it and a
       cargo lifter loading it, cargo stacked on concrete across the apron;
       the north pad as big, its own bowser and lifter standing by and cargo
       waiting on it; the port's comms block in the far corner with a dish on
       its roof, a road through the port with a spur up to each pad, the
       customs shed, and three places the log could be as they load it, each
       a pallet of cargo (Find and secure, the relic: the log carried off, or
       not). */
    veskfield: {
      name: 'The landing field, Vesk Free Port', planet: 'dense',
      pieces: [
        // Brass Ledger's pad: the shuttle down on it, the bowser fuelling it, the lifter loading it
        Object.assign(P(30, 2, 14, 14), { pad: true }), R('shuttle', 32, 3, 10, 8),
        Object.assign(R('fueltruck', 31.4, 12.2, 2.8, 1.4), { hose: { x: 37, y: 11 } }), R('cargolifter', 40.5, 12.2, 2.5, 2.5),
        // the port's road, in from the west edge and out at the east, a spur up to the pad
        P(0, 27.5, 48, 3), P(36, 16, 3, 11.5),
        // the north pad, as big as Brass Ledger's, empty but for its support vehicles and cargo waiting, a spur down to the road
        Object.assign(P(5, 2, 14, 14), { pad: true }), P(6.5, 16, 3, 11.5),
        Object.assign(R('fueltruck', 6.2, 12.6, 2.8, 1.4), { facing: Math.PI / 2 }), Object.assign(R('cargolifter', 14.8, 11.6, 2.5, 2.5), { facing: Math.PI }),
        CG(6.5, 4, 4, 1.6), CG(13.4, 4, 1.6, 4), CG(10.3, 9.4, 3.6, 1.6),
        // the comms block (its dish on the roof) and the customs shed
        Object.assign(B(5, 36, 8, 6, 'annex'), { dish: true }), R('bunker', 35, 36, 6, 5),
        B(28, 31, 6, 5, 'block'), B(26, 38, 6, 3, 'block'), R('wall', 42, 19, 1, 6),
        // cargo, stacked on concrete across the apron, with walkways between the stacks
        CG(22, 3, 7, 9), CG(11, 17, 8, 3.6), CG(20.5, 19.5, 3.5, 6.5), CG(10, 31.5, 7, 2.5), CG(32, 18.5, 2.5, 6)
      ],
      // the three places the log could be are cargo, like everything else on the apron
      sites: { kind: 'searchsite', skin: 'cargo', at: [
        { x: 27, y: 16, name: 'The ship’s ramp' },
        { x: 16, y: 24, name: 'The cargo stacks' },
        { x: 24, y: 34, name: 'The customs shed' }
      ] }
    },

    /* Station Thule, the relay Morrow stopped at, in orbit over Okoro II: a
       compound laid by hand, not by its seed, the same about both its axes. A
       hub in the middle, a ring corridor round it with spokes in, a module to
       the north and one to the south (the hub and the two modules are the
       control rooms Critical control asks for), a lab on each flank, and two
       docking arms out to each edge. Its skin is the station's (`skin`): the
       solid round it is open space, a star field, the floors walled in by the
       station's hull where they meet it, and solar arrays out in the dark. */
    thule: {
      name: 'Station Thule, in orbit over Okoro II', skin: 'station',
      compound: {
        cols: 16, rows: 16, walls: [], danger: [],
        cells: [
          '................',
          '......rrrr......',
          '......rrrr......',
          '......c..c......',
          '....cccccccc....',
          'ccccc.c..c.ccccc',
          '....ccrrrrcc....',
          '.rrrc.rrrr.crrr.',
          '.rrrc.rrrr.crrr.',
          '....ccrrrrcc....',
          'ccccc.c..c.ccccc',
          '....cccccccc....',
          '......c..c......',
          '......rrrr......',
          '......rrrr......',
          '................'
        ].join(''),
        doors: ['86|102',  '89|105',  '150|166',  '153|169',  '101|102',  '105|106',  '149|150',  '153|154',  '38|54',  '41|57',  '198|214',  '201|217',  '115|116',  '123|124',  '131|132',  '139|140'],
        // the rooms by name, a cell inside each: the three control rooms and the two labs
        names: { 22: 'North module', 102: 'Hub', 214: 'South module', 113: 'West lab', 125: 'East lab' }
      }
    },

    /* A mud bank on Tessaly IV, a mile from the beacon: Brass Ledger's ship down
       in the reeds, the Reavers' boats come to buy, and three places the log
       could be as the sale is made (Find and secure, the relic). */
    mudbank: {
      name: 'The mud bank, Tessaly IV', planet: 'jungle',
      pieces: [
        N('woods', 6, 4, 7, 7, 'lobed'), N('woods', 35, 4, 6, 6, 'blob'), N('woods', 6, 37, 6, 7, 'lobed'), N('woods', 35, 38, 6, 6, 'blob'),
        N('water', 26, 6, 6, 4, 'kidney'), N('deep', 8, 24, 5, 4, 'long'), R('ruins', 38, 22, 4, 4), B(27, 38, 6, 4, 'block')
      ],
      sites: { kind: 'searchsite', at: [
        { x: 17, y: 16, name: 'Kettering’s ship' },
        { x: 31, y: 21, name: 'The Reavers’ boats' },
        { x: 21, y: 31, name: 'The tent where they haggle' }
      ] }
    },

    /* The Glass Flats on Vantor III: a plain turned to glass by an old impact,
       outcrops of it standing like broken windows, the impact crater and the
       smaller ones round it, and three places Morrow might have dug. Wraith
       Section's camp is on the east side, where they come on: a dozen low
       tents (crater fields by the rules) round their comms mast, between two high, stepped hills that
       look out over the whole flat. */
    glassflats: {
      name: 'The Glass Flats, Vantor III', planet: 'desert',
      pieces: [
        // the two hills over Wraith's camp
        Object.assign(N('hill', 34, 3, 10, 10, 'lobed'), { stepped: true }), Object.assign(N('hill', 34, 34, 10, 10, 'blob'), { stepped: true }),
        // the camp: two blocks of tents either side of the mast, crater fields by the rules
        Object.assign(R('crater', 35, 15, 8.9, 5.3), { camp: true }), Object.assign(R('crater', 35, 25.5, 8.9, 5.3), { camp: true }),
        R('commsmast', 39, 22.2, 1.5, 1.5),
        // the impact crater and the smaller ones, the glass outcrops, a spill of rocks
        N('crater', 19, 3, 8, 6, 'blob'), N('crater', 7, 13, 4, 4, 'lobed'), N('crater', 10, 36, 6, 5, 'blob'), N('crater', 26, 33, 4, 4, 'lobed'),
        N('crystal', 8, 5, 5, 4, 'rift'), N('crystal', 25, 40, 5, 4, 'rift'), N('crystal', 6, 24, 4, 5, 'lobed'), N('crystal', 25, 14, 4, 3, 'rift'),
        N('rocks', 17, 41, 5, 4, 'lobed'),
        // Wraith's kit, stacked on the sand by the places they've been digging
        Object.assign(CG(20.2, 15, 3, 2.6), { cargo: true }), Object.assign(CG(29.4, 24.2, 3.6, 2), { cargo: true }), Object.assign(CG(15.2, 30, 2.6, 3.4), { cargo: true })
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
