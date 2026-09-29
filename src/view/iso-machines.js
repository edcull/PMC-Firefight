/* PMC 2670 — Firefight : the machines: every hull on the table built from tapered boxes - tanks and transports on wheels, tracks, legs, grav and hover, the aircraft and their rotors, the Xenotripod craft - with where each of their barrels ends, and the shadow they cast on the ground they stand on.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoMachines = function (B) {
    var a = B.a, clamp01 = B.clamp01, dot = B.dot, ellipse = B.ellipse, ellipseRing = B.ellipseRing;
    var hash = B.hash, hull2d = B.hull2d, poly = B.poly, rect = B.rect, rng = B.rng, toScreen = B.toScreen;
    var ELEV = B.ELEV, K = B.K, PH = B.PH, RING_VIS = B.RING_VIS;
    // from modules installed after this one: looked up when called
    function drawBigBug() { return B.drawBigBug.apply(this, arguments); }
    function hex3() { return B.hex3.apply(this, arguments); }
    function hexA() { return B.hexA.apply(this, arguments); }
    function hexMix() { return B.hexMix.apply(this, arguments); }
    function xenoGlow() { return B.xenoGlow.apply(this, arguments); }

    /* ---------- vehicles and aircraft ----------
       A hull is a set of boxes in world inches, rotated to the unit's heading and
       projected, so a machine points wherever it is driving without needing a sprite
       per angle. len / wid are inches; heights are buffer pixels. A trooper stands
       about 55 px, so a tank comes up to chest height with its turret at eye level. */
    var HULL = {
      //                                                       body    upper deck     turret          gun
      wheeled: { axles: 2, len: 1.95, wid: 1.00, hgt: 17, taper: .86, deck: .52, dHgt: 7, turret: .58, tHgt: 11, gun: 1.15, bins: true },
      tank: { axles: 4, len: 2.45, wid: 1.40, hgt: 22, taper: .82, deck: .62, dHgt: 8, turret: .95, tHgt: 15, gun: 1.90, bustle: true, bins: true, cupola: true, smoke: true },
      hunter: { axles: 3, len: 2.15, wid: 1.15, hgt: 17, taper: .80, deck: .5, dHgt: 7, turret: .70, tHgt: 12, gun: 2.00, bins: true, smoke: true },
      destroyer: { axles: 4, len: 2.45, wid: 1.40, hgt: 20, taper: .84, deck: .74, dHgt: 9, fixedGun: 1.95, bins: true, smoke: true },
      truck: { axles: 3, len: 2.20, wid: 1.00, hgt: 14, taper: .9, cab: true, bed: true },
      apc: { axles: 4, len: 2.35, wid: 1.25, hgt: 21, taper: .85, deck: .5, dHgt: 6, turret: .50, tHgt: 9, gun: .90, hatch: true, bins: true, ramp: true },
      engineer: { axles: 4, len: 2.40, wid: 1.40, hgt: 21, taper: .82, deck: .55, dHgt: 8, turret: .78, tHgt: 12, gun: 1.15, fat: true, drum: true, bins: true },
      spg: { axles: 4, len: 2.50, wid: 1.40, hgt: 18, taper: .86, deck: .8, dHgt: 11, turret: 1.00, tHgt: 14, gun: 2.20, elev: 16, spade: true, open: true },
      flak: { axles: 4, len: 2.35, wid: 1.35, hgt: 19, taper: .84, deck: .6, dHgt: 7, turret: .85, tHgt: 12, gun: 1.60, elev: 22, twin: true, dish: true },
      ewcar: { axles: 4, len: 2.30, wid: 1.20, hgt: 19, taper: .86, deck: .52, dHgt: 7, dish: true, hatch: true, bins: true },
      medcar: { axles: 4, len: 2.30, wid: 1.20, hgt: 21, taper: .92, deck: .6, dHgt: 6, cross: true, hatch: true },
      // rotorcraft: cabin, tail boom, main and tail rotors, stub wings
      lifter: { heli: true, len: 1.85, wid: 1.00, hgt: 20, taper: .86, boom: 1.55, rotor: 2.05, blades: 4, fly: 2.3, cabin: true, pylons: 1, skids: true },
      strike: { heli: true, len: 1.95, wid: .78, hgt: 17, taper: .8, boom: 1.65, rotor: 2.15, blades: 4, fly: 2.7, tandem: true, pylons: 2, chin: true, skids: true },
      gunboat: { heli: true, len: 2.15, wid: .92, hgt: 19, taper: .82, boom: 1.75, rotor: 2.35, blades: 5, fly: 2.1, tandem: true, pylons: 3, chin: true, stubs: true, skids: true },

      /* ---- the PMC list, each machine after a real kind of vehicle ----
         `style` says what it is built from (see styledHull/styledTop); the plain
         numbers are still the footprint, and `gun` is kept for the walker, which
         carries the main weapon on its arm. */
      patrol: { axles: 2, len: 1.95, wid: 1.00, hgt: 16, wheelR: 0.7, gun: 1.0, style: { body: 'pickup', pintle: [-0.28, 0], shield: true } },
      acar: { axles: 2, len: 2.05, wid: 1.15, hgt: 20, wheelR: 0.78, gun: 1.0, style: { body: 'car', turret: 'mg', tSize: 0.6, tAt: -0.02 } },
      // the light tank carries its gun and a sidearm, and no missiles to model
      ltank: { axles: 3, len: 2.25, wid: 1.30, hgt: 16, gun: 1.3, style: { body: 'ltank', turret: 'light', tSize: 0.8, gunLen: 1.35, skirts: true } },
      recontank: { axles: 3, len: 2.20, wid: 1.25, hgt: 16, gun: 1.1, style: { body: 'ltank', turret: 'recon', tSize: 0.75, gunLen: 1.2, skirts: true } },
      mbt: { axles: 4, len: 2.50, wid: 1.45, hgt: 18, gun: 1.9, style: { body: 'mbt', turret: 'mbt', tSize: 1.0, gunLen: 2.1, skirts: 'panels' } },
      ftank: { axles: 4, len: 2.60, wid: 1.50, hgt: 18, gun: 2.0, style: { body: 'future', turret: 'future', tSize: 1.05, gunLen: 2.2, skirts: 'panels', plasma: true } },
      lhunt: { axles: 2, len: 2.05, wid: 1.15, hgt: 20, wheelR: 0.78, gun: 1.0, style: { body: 'car', turret: 'missile', tSize: 0.62, tAt: -0.04 } },
      /* Hunters and destroyers are turreted: the rules give them no fixed arc,
         so the long gun has to be able to bear all the way round. */
      thunter: { axles: 3, len: 2.25, wid: 1.30, hgt: 15, gun: 1.2, style: { body: 'ltank', skirts: true, turret: 'missile', tSize: 0.72 } },
      ldest: { axles: 3, len: 2.30, wid: 1.30, hgt: 15, gun: 2.0, style: { body: 'ltank', skirts: true, turret: 'light', tSize: 0.86, gunLen: 2.1, gunW: 2.4 } },
      mdest: { axles: 4, len: 2.55, wid: 1.45, hgt: 17, gun: 2.1, fat: true, style: { body: 'mbt', skirts: 'panels', turret: 'mbt', tSize: 1.0, gunLen: 2.5, gunW: 3.2, tMissiles: true, plasma: true } },
      lorry: { rearDoor: true, axles: 2, len: 2.10, wid: 1.00, hgt: 15, wheelR: 0.72, gun: 0.8, style: { body: 'truck', noGuard: true } },
      hlorry: { rearDoor: true, axles: 3, len: 2.45, wid: 1.10, hgt: 17, wheelR: 0.8, gun: 0.8, style: { body: 'truck', heavy: true, armourBox: true } },
      m113: { rearDoor: true, axles: 3, len: 2.20, wid: 1.20, hgt: 19, gun: 0.9, style: { body: 'box', pintle: [0.06, 0.25], shield: true } },
      ifv: { rearDoor: true, axles: 3, len: 2.35, wid: 1.30, hgt: 18, gun: 1.2, style: { body: 'ifv', turret: 'ifv', tSize: 0.72, tAt: 0.04, tSide: 0.12, skirts: 'panels' } },
      cmdbox: { rearDoor: true, axles: 3, len: 2.20, wid: 1.20, hgt: 19, gun: 0.9, dish: true, style: { body: 'box', aerials: 5, pintle: [0.06, 0.25], shield: true } },
      bigapc: { rearDoor: true, axles: 4, len: 2.65, wid: 1.45, hgt: 19, gun: 1.0, style: { body: 'bigbox', rws: true, skirts: 'panels', hexNose: true, hex: true } },
      bigifv: { rearDoor: true, axles: 4, len: 2.65, wid: 1.45, hgt: 19, gun: 1.3, style: { body: 'bigbox', turret: 'ifv', tSize: 0.8, tAt: 0.06, skirts: 'panels', hexNose: true, hex: true } },
      engflame: { axles: 4, len: 2.45, wid: 1.45, hgt: 18, gun: 1.1, fat: true, drum: true, style: { body: 'mbt', turret: 'flamer', tSize: 0.95, rearTank: true, skirts: 'panels' } },
      enghow: { axles: 4, len: 2.50, wid: 1.45, hgt: 18, gun: 1.3, fat: true, mech: 'heavy', style: { body: 'mbt', skirts: 'panels', turret: 'howitzer', tSize: 1.05, plasma: true, hexNose: true, hex: true } },
      techmrl: { axles: 2, len: 2.00, wid: 1.00, hgt: 16, wheelR: 0.7, gun: 1.0, elev: 10, style: { body: 'pickup', mrl: true } },
      calliope: { axles: 3, len: 2.30, wid: 1.30, hgt: 16, gun: 1.6, elev: 16, style: { body: 'ltank', turret: 'arty', tSize: 0.9, tAt: -0.1, skirts: true } },
      mlrs: { axles: 3, len: 2.45, wid: 1.30, hgt: 17, gun: 1.2, elev: 14, style: { body: 'mlrs', mlrs: true } },
      /* The advanced support vehicle: an energy howitzer — a short, fat Gauss
         barrel laid well up out of a boxy turret, the charge burning blue in it. */
      plasmatank: { axles: 4, len: 2.55, wid: 1.50, hgt: 18, gun: 1.2, fat: true, style: { body: 'mbt', turret: 'arty', tSize: 1.05, gunLen: 1.7, energyGun: true, skirts: 'panels' } },
      aatank: { axles: 3, len: 2.30, wid: 1.30, hgt: 16, gun: 1.3, twin: true, elev: 16, dish: true, style: { body: 'ltank', turret: 'aa', tSize: 0.85, skirts: true } },
      ewtank: { axles: 3, len: 2.25, wid: 1.25, hgt: 16, gun: 0.9, dish: true, style: { body: 'ltank', turret: 'dish', tSize: 0.72, skirts: true } },
      medbox: { rearDoor: true, axles: 3, len: 2.25, wid: 1.25, hgt: 20, gun: 0.8, cross: true, style: { body: 'box', cross: true, aerials: 1, pintle: [0.06, 0.25], shield: true } },
      /* Rebel gun trucks: a light, medium and heavy lorry plated up in a yard,
         slits cut in a sheet welded over the windscreen, mismatched plate round
         the bed, and a weapon bolted on behind the cab. */
      gtlight: { axles: 2, len: 2.10, wid: 1.00, hgt: 15, wheelR: 0.72, gun: 1.2, style: { body: 'guntruck', bedGun: 'auto', gunAt: -0.22 } },
      gtmed: { axles: 2, len: 2.30, wid: 1.05, hgt: 16, wheelR: 0.76, gun: 1.2, style: { body: 'guntruck', bedGun: 'mg', gunAt: -0.1, bedRack: true, rackAt: -0.34 } },
      gtheavy: { axles: 3, len: 2.55, wid: 1.12, hgt: 17, wheelR: 0.8, gun: 1.4, style: { body: 'guntruck', heavy: true, bedGun: 'auto', gunAt: -0.05, bedRack: true, rackAt: -0.34 } },
      // rebel troop trucks: the same yard-plated lorries, the bed walled up to carry a squad
      // the rebel transports: a welded troop box on the back, the gun on its roof
      ttlight: { axles: 2, len: 2.15, wid: 1.00, hgt: 15, wheelR: 0.72, gun: 1.0, style: { body: 'guntruck', enclosed: true, bedGun: 'mg', gunAt: -0.2 } },
      ttmed: { axles: 3, len: 2.65, wid: 1.15, hgt: 17, wheelR: 0.8, gun: 1.2, style: { body: 'guntruck', heavy: true, enclosed: true, bedGun: 'auto', gunAt: -0.12 } },
      // the super-heavy: a bigger, square cab-over lorry
      ttheavy: { axles: 4, len: 3.05, wid: 1.32, hgt: 19, wheelR: 0.84, gun: 1.4, style: { body: 'guntruck', heavy: true, enclosed: true, flatCab: true, bedGun: 'auto', gunAt: -0.1 } },
      // rebel flak: an AA mount on whatever will carry it
      aatech: { axles: 2, len: 2.00, wid: 1.00, hgt: 16, wheelR: 0.7, gun: 1.2, twin: true, elev: 16, style: { body: 'pickup', turret: 'aa', tSize: 0.62, tAt: -0.28, noMissiles: true } },
      aacar: { axles: 2, len: 2.05, wid: 1.15, hgt: 20, wheelR: 0.78, gun: 1.2, twin: true, elev: 16, style: { body: 'car', turret: 'aa', tSize: 0.7, tAt: -0.02, noMissiles: true } },
      aaheavy: { axles: 4, len: 2.50, wid: 1.45, hgt: 18, gun: 1.4, twin: true, elev: 16, dish: true, style: { body: 'mbt', turret: 'aa', tSize: 0.95, skirts: 'panels', noMissiles: true } },
      // fliers: every one of them on shrouded fans
      civcraft: { len: 1.75, wid: 0.95, hgt: 16, fly: 2.3, craft: 'civ', gun: 1.0 },
      hawk: { len: 2.25, wid: 0.72, hgt: 16, fly: 2.4, craft: 'hawk', gun: 1.0 },
      chinook: { len: 2.65, wid: 0.90, hgt: 18, fly: 2.3, craft: 'chinook', gun: 1.0 },
      // the rebels' armed heavy shuttle: the same lifter with winglets on its flanks
      chinookwl: { len: 2.65, wid: 0.90, hgt: 18, fly: 2.3, craft: 'chinook', gun: 1.0, winglets: true },
      chinookcp: { len: 2.65, wid: 0.90, hgt: 18, fly: 2.4, craft: 'chinookcp', gun: 1.0, dish: true, winglets: true },
      // the PMC strike craft have one pilot under one canopy
      apache: { len: 2.20, wid: 0.62, hgt: 13, fly: 2.7, craft: 'apache', gun: 1.0, singleCab: true },
      hind: { len: 2.40, wid: 0.72, hgt: 16, fly: 2.5, craft: 'hind', gun: 1.0, singleCab: true },
      apacherk: { len: 2.30, wid: 0.64, hgt: 14, fly: 2.2, craft: 'apacherk', gun: 1.0 },
      hindrk: { len: 2.50, wid: 0.74, hgt: 17, fly: 2.3, craft: 'hindrk', gun: 1.0 },
      // armed shuttles: the same airframes, with the pods left off
      apachenp: { len: 2.20, wid: 0.62, hgt: 13, fly: 2.6, craft: 'apache', noPods: true, gun: 1.0 },
      hindnp: { len: 2.40, wid: 0.72, hgt: 16, fly: 2.4, craft: 'hind', noPods: true, gun: 1.0 },
      jet: { len: 2.70, wid: 0.72, hgt: 9, fly: 3.2, craft: 'jet', gun: 1.0 },
      // the Light VTOL drone: a small flying disc with swept winglets and a scanner pod under its lip
      vtoldrone: { len: 1.1, wid: 1.1, hgt: 8, fly: 2.8, craft: 'disc', gun: 0.6 },
      // the advanced strike craft: a stealth gunship, faceted, its weapons carried inside, a fan in its fin
      comanche: { len: 2.45, wid: 0.60, hgt: 12, fly: 2.7, craft: 'comanche', noPods: true, gun: 1.0 },
      hybrid: { len: 2.45, wid: 0.72, hgt: 11, fly: 2.8, craft: 'hybrid', gun: 1.0 },

      /* ---- improvised rebel hulls (pp. 105-108) ----
         Civilian running gear with a weapon bolted to the bed, industrial machines
         plated up in a yard, and shuttles that were flying cargo last month. */
      technical: { axles: 2, len: 2.00, wid: .95, hgt: 13, taper: .92, cab: true, bed: true, deck: .38, dHgt: 5, turret: .44, tHgt: 9, gun: 1.30, elev: 8, open: true },
      improvised: { axles: 4, len: 2.35, wid: 1.40, hgt: 20, taper: .90, deck: .58, dHgt: 8, turret: .62, tHgt: 10, gun: 1.30, fat: true, drum: true, spade: true, bins: true },
      rtruck: { axles: 3, len: 2.30, wid: 1.05, hgt: 15, taper: .92, cab: true, bed: true, bins: true },
      rflak: { axles: 3, len: 2.20, wid: 1.05, hgt: 14, taper: .90, cab: true, bed: true, deck: .48, dHgt: 5, turret: .55, tHgt: 8, gun: 1.55, elev: 24, twin: true, open: true },
      shuttle: { heli: true, len: 2.05, wid: 1.05, hgt: 21, taper: .90, boom: 1.30, rotor: 1.90, blades: 3, fly: 2.2, cabin: true, pylons: 1, skids: true },
      craneship: { heli: true, len: 1.95, wid: .88, hgt: 16, taper: .88, boom: 1.95, rotor: 2.55, blades: 6, fly: 2.6, cabin: true, skids: true },
      /* A Rapid insertion platform (p. 79): a drop pod half buried where it landed,
         with its petals blown open and nothing to drive it anywhere. No wheels, no
         turret, no gun — scorched plate and an open door. */
      pod: { axles: 0, len: 0.94, wid: 0.90, hgt: 17, taper: .50, drop: true },
      // the Overgrown bugs: no hull at all, but a footprint and a height for the table
      bugfirebeetle: { len: 2.2, wid: 1.3, hgt: 44, bug: true },
      bugsandworm: { len: 1.8, wid: 1.2, hgt: 84, bug: true },
      bugbioplasma: { len: 2.2, wid: 1.3, hgt: 66, bug: true },
      bugshadow: { len: 1.8, wid: 1.0, hgt: 96, bug: true },
      bugqueen: { len: 2.6, wid: 1.6, hgt: 92, bug: true },
      bugcarrier: { len: 2.4, wid: 1.4, hgt: 48, fly: 2.2, bug: true },
      // the Xenotripods' triangular craft and their turrets
      xstrike: { len: 2.2, wid: 2.0, hgt: 12, fly: 2.4, xeno: true },
      xstrikehg: { len: 2.4, wid: 2.3, hgt: 12, fly: 2.4, xeno: true },
      xstrikeadv: { len: 2.6, wid: 2.5, hgt: 14, fly: 2.4, xeno: true },
      xrecon: { len: 1.7, wid: 1.5, hgt: 10, fly: 2.8, xeno: true },
      xtelecraft: { len: 2.2, wid: 2.1, hgt: 12, fly: 2.2, xeno: true },
      xshieldcraft: { len: 2.1, wid: 2.1, hgt: 14, fly: 2.3, xeno: true },
      xturret: { len: 1.0, wid: 1.0, hgt: 44, xeno: true },
      xteleturret: { len: 1.1, wid: 1.1, hgt: 40, xeno: true },
      xshieldturret: { len: 1.0, wid: 1.0, hgt: 36, xeno: true }
    };

    /* the whole hull set is drawn a little under life size, to match the troopers */
    var MACHINE = 0.82, MACHINE_H = 0.86, hullCache = {};
    var INCHES = { len: 1, wid: 1, gun: 1, fixedGun: 1, boom: 1, rotor: 1, turret: 1 };
    var PIXELS = { hgt: 1, dHgt: 1, tHgt: 1, elev: 1 };
    function hullSpec(art) {
      if (hullCache[art]) return hullCache[art];
      var base = HULL[art] || HULL.wheeled, out = {};
      for (var k in base) {
        if (INCHES[k]) out[k] = base[k] * MACHINE;
        else if (PIXELS[k]) out[k] = Math.max(2, Math.round(base[k] * MACHINE_H));
        else out[k] = base[k];
      }
      out.ride = 0;                                     // set by the propulsion
      return (hullCache[art] = out);
    }

    /* Running gear. Each propulsion decides how high the hull rides and what is
       drawn underneath it, so any hull can take any drive. */
    var DRIVE = {
      wheeled: { ride: 13 },
      tracked: { ride: 8 },
      walker: { ride: 26 },
      grav: { ride: 13 },
      hover: { ride: 9 }
    };
    // no optional propulsion ('none'): the hull is drawn on the running gear it usually goes to war on
    function driveOf(u) {
      var d = u && u.prop;
      if ((!d || d === 'none') && u && u.cls === 'vehicle' && window.PMC && window.PMC.lookDrive) d = window.PMC.lookDrive(u);
      return DRIVE[d] ? d : (u && u.cls === 'vehicle' ? 'wheeled' : null);
    }

    // the four corners of a rotated rectangle, in world inches
    function hullCorners(x, y, len, wid, f) {
      var c = Math.cos(f), s = Math.sin(f), L = len / 2, W = wid / 2;
      return [
        [x + c * L - s * W, y + s * L + c * W],          // nose left
        [x + c * L + s * W, y + s * L - c * W],          // nose right
        [x - c * L + s * W, y - s * L - c * W],          // tail right
        [x - c * L - s * W, y - s * L + c * W]           // tail left
      ];
    }
    function project(pts, lift) {
      return pts.map(function (q) {
        var p = toScreen(q[0], q[1]);
        return [p.x, p.y - (lift || 0)];
      });
    }
    function centroid(pts) {
      var x = 0, y = 0;
      for (var i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
      return [x / pts.length, y / pts.length];
    }
    // a box standing on the ground: shaded sides, then the lit top
    function slab(g, pts, lift, h, sideDark, sideLit, top) {
      return taper(g, pts, pts, lift, h, sideDark, sideLit, top);
    }
    /* A box whose top footprint differs from its base, so the flanks slope. This is
       what keeps the hulls from reading as plain cuboids. */
    /* A tapered box: the unit every hull, deck and turret is built from. Each
       visible face is filled flat, then — when drawn smooth — given what a
       painted model would have: the face lighter at the top where it meets the
       sky and darker where it meets the ground, a catch-light along the upper
       edge where two panels meet, and a hard dark line where it sits on
       whatever is below. That alone turns a projected slab into a machined
       shape, on every machine at once. */
    function taper(g, lo, hi, lift, h, sideDark, sideLit, top) {
      var base = project(lo, lift), roof = project(hi, lift + h);
      var c = centroid(base), cx = c[0], cy = c[1];
      for (var i = 0; i < 4; i++) {
        var a1 = base[i], b1 = base[(i + 1) % 4];
        if ((a1[1] + b1[1]) / 2 < cy) continue;          // facing away
        var lit = (a1[0] + b1[0]) / 2 <= cx;
        var face = [a1, b1, roof[(i + 1) % 4], roof[i]];
        poly(g, face, lit ? sideLit : sideDark);
        if (PH.smooth && h > 1.5) {
          var yT = Math.min(face[2][1], face[3][1]), yB = Math.max(a1[1], b1[1]);
          var gr = g.createLinearGradient(0, yT, 0, yB);
          gr.addColorStop(0, 'rgba(255,246,228,' + (lit ? 0.16 : 0.07) + ')');
          gr.addColorStop(0.5, 'rgba(0,0,0,0)');
          gr.addColorStop(1, 'rgba(6,8,12,' + (lit ? 0.22 : 0.3) + ')');
          poly(g, face, gr);
          edge(g, roof[i], roof[(i + 1) % 4], 'rgba(255,240,214,' + (lit ? 0.55 : 0.28) + ')', 0.7);
          edge(g, a1, b1, 'rgba(4,6,10,.55)', 0.7);
        }
      }
      if (top) {
        poly(g, roof, top);
        if (PH.smooth && roof.length === 4) {
          // the top, lit from the far north-west corner
          var ys = roof.map(function (q) { return q[1]; });
          var gt = g.createLinearGradient(0, Math.min.apply(null, ys), 0, Math.max.apply(null, ys));
          gt.addColorStop(0, 'rgba(255,248,232,.14)');
          gt.addColorStop(1, 'rgba(0,0,0,.08)');
          poly(g, roof, gt);
        }
      }
      return roof;
    }
    // a fine line between two projected points, for bevels and seams
    function edge(g, a, b, c, w) {
      g.strokeStyle = c;
      g.lineWidth = w || 0.7;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
    // a panel line along the flank that catches the light
    function bandOnSides(g, pts, lift, h, thick, colour) {
      var base = project(pts, lift), roof = project(pts, lift + h);
      var c = centroid(base), cx = c[0], cy = c[1];
      for (var i = 0; i < 4; i++) {
        var a1 = base[i], b1 = base[(i + 1) % 4];
        if ((a1[1] + b1[1]) / 2 < cy) continue;
        if ((a1[0] + b1[0]) / 2 > cx) continue;          // lit flank only
        var t = roof[i], u2 = roof[(i + 1) % 4];
        poly(g, [t, u2, [u2[0], u2[1] + thick], [t[0], t[1] + thick]], colour);
      }
    }
    // a line with thickness, drawn on the pixel grid
    function thickLine(g, x0, y0, x1, y1, w, c) {
      if (PH.smooth) {                                      // a machine's part: a true stroke, not stair-steps
        g.save(); g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
        return;
      }
      var steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
      g.fillStyle = c;
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        g.fillRect(Math.round(x0 + (x1 - x0) * t - w / 2), Math.round(y0 + (y1 - y0) * t - w / 2), w, w);
      }
    }

    /* How high a flier's hull hangs above the point it stands on. The game needs
       this to aim shots at the airframe rather than at the grass beneath it; a
       ground hull sits on its own ground, so it answers nothing. */
    /* How high over its ground a craft's middle is drawn — where a line to it (a
       teleport link) should meet it. A tri-wing's axis rides above its stand. */
    function craftCentreUp(u) {
      if (!u || !u.art) return 0;
      var hs = hullSpec(u.art), x3 = XENO3D[u.art];
      var fly = hs && hs.fly ? ELEV * hs.fly : 0;
      if (x3 && x3.kind === 'craft') return fly + ((x3.span || 0.7) * Math.sin((x3.droop || 40) * Math.PI / 180) + 0.04) * K * 0.9;
      return fly + ((hs && hs.hgt) || 12) * 0.5;
    }
    function flyLift(u) {
      if (!u || !u.art) return 0;
      var spec = hullSpec(u.art);
      return spec && spec.fly ? ELEV * spec.fly : 0;
    }

    /* The burn under a jump trooper: a short bright cone at the pack, a plume of
       exhaust under it, and the dust it kicks off the ground. */
    function jetBurn(g, x, y, w, h, step, high) {
      // its shadow on the ground, smaller and fainter the higher it goes
      var fade = high ? Math.max(0.35, 1 - high / (K * 4)) : 1;
      ellipse(g, x, y, w * 2.6 * fade, w * 1.3 * fade, 'rgba(12,10,8,' + (0.22 * fade).toFixed(3) + ')');
      // high up, the burn is a short plume under the pack, not a pillar to the ground
      var tail = Math.min(h, a(4.8)) * (step ? 0.8 : 0.62);
      rect(g, x - w * 0.5, y - h + 1, w, tail, 'rgba(255,196,110,.5)');
      rect(g, x - w * 0.25, y - h + 1, w * 0.5, tail * 0.8, 'rgba(255,240,206,.75)');
      for (var i = 0; i < 3; i++) {
        var d = tail * (0.5 + i * 0.35);
        ellipse(g, x + (i % 2 ? w * 0.6 : -w * 0.5), y - h + d,
          w * (0.7 + i * 0.4), w * (0.5 + i * 0.3),
          'rgba(198,190,178,' + (0.3 - i * 0.08) + ')');
      }
    }

    /* Where a machine's weapons end: drawn once into a scratch canvas with the
       mounts being recorded, and returned as screen offsets from the ground point
       under it, keyed by kind — 'gun', 'auto', 'mg', 'missile', 'rocket', 'flame',
       'rail'. Fliers include their height, so a shot leaves the airframe. */
    var mountCanvas = null;
    function mounts(u) {
      if (!u || (u.cls !== 'vehicle' && u.cls !== 'aircraft')) return {};
      if (!mountCanvas) { mountCanvas = document.createElement('canvas'); mountCanvas.width = mountCanvas.height = 1; }
      PH.mounts = {};
      try { drawMachine(mountCanvas.getContext('2d'), u, { at: { x: u.x, y: u.y }, lift: 0 }); }
      finally { var out = PH.mounts; PH.mounts = null; }
      return out;
    }

    // which mount a weapon style fires from, most likely first
    var MOUNT_PREF = {
      small: ['mg', 'auto', 'gun'], pistol: ['mg', 'auto', 'gun'], smg: ['mg', 'auto', 'gun'],
      burst: ['mg', 'auto', 'gun'], chain: ['auto', 'gun', 'mg'],
      /* A heavy round falls back to a wing pod last of all: a strike craft with
         no gun but a pod under each wing puts one round out of each. */
      shell: ['gun', 'auto', 'rail', 'mg', 'missile'], shellbig: ['gun', 'rail', 'auto', 'missile'],
      rail: ['rail', 'gun', 'auto'],
      missile: ['missile', 'rocket', 'gun'], rocket: ['rocket', 'missile', 'gun'],
      arc: ['rocket', 'gun'], arcbig: ['rocket', 'gun'], flame: ['flame', 'gun'],
      energy: ['mg', 'gun', 'auto'], orb: ['rocket', 'gun', 'missile'],
      orbbig: ['gun', 'rocket', 'missile'], plasmabolt: ['gun', 'rail', 'auto', 'missile']
    };
    /* What a walker's arm carries for each weapon style: the barrel a shot comes
       out of is the barrel that looks like it fires it. Each of these registers
       the muzzle mount its style asks for above. */
    // a salvo weapon rides on the shoulder instead of being held in an arm
    var SHOULDER_STYLE = { arc: 'rocket', arcbig: 'rocket' };
    var ARM_FOR = {
      pistol: 'mg', small: 'mg', smg: 'mg', burst: 'mg', chain: 'auto',
      shell: 'cannon', shellbig: 'bigcannon', rail: 'rail', flame: 'flame',
      arc: 'rocket', arcbig: 'rocket', rocket: 'rocket', missile: 'missile',
      spit: 'auto', spitbig: 'auto', spine: 'auto', energy: 'plasma', orb: 'plasma', orbbig: 'howitzer',
      plasmabolt: 'bigcannon',
      none: 'none'
    };
    // one cell of a machine's digital camouflage, in inches
    var CELL = 0.14;
    /* How far a styled craft's wings or fans reach, as a multiple of the hull
       width — what it lays on the ground when it flies over. */
    var CRAFT_SPAN = {
      jet: 2.9, hybrid: 3.4, comanche: 2.5, apache: 2.6, apacherk: 2.6, hind: 2.8, hindrk: 2.8,
      civ: 1.9, hawk: 1.2, chinook: 1.2, chinookcp: 2.1
    };
    /* A volley takes the muzzles in turn, so they are handed over left, right,
       left — a craft with a pod under each wing fires one round from each rather
       than emptying the near one. */
    function sideByside(list) {
      var left = [], right = [];
      list.forEach(function (m) { (m.dx < 0 ? left : right).push(m); });
      if (!left.length || !right.length) return list;
      var out = [];
      for (var i = 0; i < Math.max(left.length, right.length); i++) {
        if (left[i]) out.push(left[i]);
        if (right[i]) out.push(right[i]);
      }
      return out;
    }
    function mountFor(M, style, u, base) {
      var kinds = MOUNT_PREF[style] || ['gun', 'mg'];
      for (var i = 0; i < kinds.length; i++) {
        var list = M && M[kinds[i]];
        if (list && list.length) {
          var pool = list.length > 1 ? sideByside(list) : list;
          return { x: u.x, y: u.y, up: 0, mz: pool[0], pool: pool };
        }
      }
      return base;
    }

    /* ---------- Xenotripod craft and turrets ----------
       Built in the world like the Overgrown bugs, so they turn to every facing:
       the craft are tri-wings, a slim ivory fuselage with three swept blades set
       about it, the army's colour burning along the leading edges and in a core
       underneath; the turrets are
       pylons on tripod feet — a crystal emitter, a ring gate, a shield dish. */
    var XENO3D = {
      // tri-wing craft: L the fuselage's half length, span the lower wings' reach and
      // fin the dorsal wing's against it, le and tip where the root and the tip sit
      // along the fuselage (a larger le is a broader wing), rad its girth, droop the anhedral
      xstrike: { kind: 'craft', L: 0.95, span: 0.72, fin: 1.1, le: 0.12, tip: -0.86, rad: 0.09 },
      xstrikehg: { kind: 'craft', L: 1.05, span: 0.78, fin: 1.1, le: 0.18, tip: -0.84, rad: 0.1, prongs: 1 },
      xstrikeadv: { kind: 'craft', L: 1.15, span: 0.86, fin: 1.05, le: 0.34, tip: -0.78, rad: 0.11, droop: 36, prongs: 2 },
      // the support craft carry only a token gun: what they are for is what shows
      xrecon: { kind: 'craft', L: 0.72, span: 0.6, fin: 1.3, le: 0.05, tip: -0.92, rad: 0.07, droop: 46, scan: true, support: true },
      xtelecraft: { kind: 'craft', L: 0.95, span: 0.74, fin: 1.1, le: 0.14, tip: -0.84, rad: 0.1, ring: true, support: true },
      xshieldcraft: { kind: 'craft', L: 0.92, span: 0.7, fin: 1.0, le: 0.24, tip: -0.78, rad: 0.12, droop: 44, shield: true, support: true },
      xturret: { kind: 'turret' },
      xteleturret: { kind: 'portal' },
      xshieldturret: { kind: 'shield' }
    };
  /* ---- the Xenotripods' machines: in view/iso-xenomachines.js ---- */
  var KIT_XENOMACHINES = null;
  function kitXenoMachines() {
    return KIT_XENOMACHINES || (KIT_XENOMACHINES = root.PMCIsoXenoMachines({
      B: B, ELEV: ELEV, K: K, PH: PH, XENO3D: XENO3D, ellipse: ellipse, ellipseRing: ellipseRing, hexA: hexA,
      hexMix: hexMix, hullSpec: hullSpec, poly: poly, rect: rect, root: root, toScreen: toScreen,
      xenoGlow: xenoGlow
    }));
  }
  function drawXenoMachine(g, u, opts) { return (KIT_XENOMACHINES || kitXenoMachines()).drawXenoMachine(g, u, opts); }

    // the texture tiles themselves, made once: specks and streaks on a clear ground
    var TEX_TILE = {};
    function texTile(kind) {
      if (TEX_TILE[kind] !== undefined) return TEX_TILE[kind];
      if (typeof document === 'undefined') return (TEX_TILE[kind] = null);
      var n = 16, c = document.createElement('canvas'); c.width = n; c.height = n;
      var x = c.getContext('2d'), r = rng(kind === 'rust' ? 7717 : 4441);
      function px(i, j, col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
      if (kind === 'rust') {
        for (var a = 0; a < 38; a++) px(Math.floor(r() * n), Math.floor(r() * n), r() < 0.55 ? 'rgba(52,26,12,.42)' : 'rgba(196,120,64,.34)');
        // streaks running down from where the rain sat
        for (var b = 0; b < 3; b++) {
          var sx = Math.floor(r() * n), sy = Math.floor(r() * n), ln = 3 + Math.floor(r() * 5);
          for (var k = 0; k < ln; k++) px(sx, (sy + k) % n, 'rgba(60,30,14,' + (0.32 - k * 0.03).toFixed(2) + ')');
        }
      } else {
        for (var d = 0; d < 22; d++) px(Math.floor(r() * n), Math.floor(r() * n), r() < 0.5 ? 'rgba(30,33,38,.36)' : 'rgba(200,206,214,.3)');
        // scuffs, and a rivet or two catching the light
        for (var e = 0; e < 3; e++) {
          var ex = Math.floor(r() * n), ey = Math.floor(r() * n), el = 2 + Math.floor(r() * 4);
          for (var q = 0; q < el; q++) px((ex + q) % n, ey, 'rgba(190,196,204,.22)');
        }
        for (var v = 0; v < 2; v++) { var vx = Math.floor(r() * (n - 1)), vy = Math.floor(r() * (n - 1)); px(vx, vy, 'rgba(210,216,224,.5)'); px(vx + 1, vy + 1, 'rgba(20,22,26,.45)'); }
      }
      return (TEX_TILE[kind] = c);
    }
    function texPattern(g, kind) {
      var t = texTile(kind);
      if (!t) return null;
      g.__tex = g.__tex || {};
      if (!g.__tex[kind]) g.__tex[kind] = g.createPattern(t, 'repeat');
      return g.__tex[kind];
    }

    /* Things every frame asked again of every machine and always got the same
       answer to: a kind's camouflage cells, which cells of a side plate's grid are
       filled, and colour blends. Kept once worked out (drawing is unchanged). */
    var CAMO_OF = {}, BLOCK_ON = {}, MIX_OF = {};
    function drawMachine(g, u, opts) {
      var was = PH.smooth;
      PH.smooth = true;
      try { return drawMachineBody(g, u, opts); }
      finally { PH.smooth = was; }
    }
    function drawMachineBody(g, u, opts) {
      if (B.BIGBUG[u.art]) return drawBigBug(g, u, opts);
      if (XENO3D[u.art]) return drawXenoMachine(g, u, opts);
      var at = opts.at || u;
      var spec = hullSpec(u.art);
      var pal = B.PALETTE[u.paint || u.side] || B.PALETTE.A;
      var f = u.facing == null ? 0 : u.facing;
      var drive = driveOf(u);
      var ride = spec.heli || spec.drop ? 0 : (DRIVE[drive] ? DRIVE[drive].ride : 7);
      /* A tank or carrier hull on wheels sits down on them like an 8x8 does,
         rather than riding high on monster-truck tyres. */
      if (spec.style && drive === 'wheeled' && !/^(pickup|truck|car|guntruck)$/.test(spec.style.body)) ride = 9;
      if (spec.style && drive === 'walker' && u.transport) ride = 16;
      // a flier that is shot down is a wreck on the ground, not one hanging in the air
      var downed = opts.status === 'wrecked' || u.alive === false;
      var lift = (opts.lift || 0) + (spec.fly && !downed ? ELEV * spec.fly : 0) - (opts.hop || 0);
      /* A grav or hover hull that is knocked out comes down: the grav pods on the
         ground under it, the hover's skirt slumped flat. */
      if (downed && drive === 'grav') ride = 7;
      if (downed && drive === 'hover') ride = 4;
      // the ground it stands on (up a hill, the hill's top): where its shadow falls, whatever height it rides at
      var ground = opts.ground != null ? opts.ground : (opts.lift || 0);
      var dead = opts.status === 'wrecked' || u.alive === false;

      var hull = pal.mid, lit = pal.light, dark = pal.dark, trim = pal.helm;
      // a rebel hull's company colour is laid on bright, like their armbands
      if (dead) { hull = '#3a352d'; lit = '#4a443a'; dark = '#241f19'; trim = '#2e2822'; }
      var STEEL = dead ? '#23201b' : '#232830', STEEL_LIT = dead ? '#3a352d' : '#454d58';
      var GLASS = dead ? '#1a1712' : '#1b2732', GLINT = dead ? '#2e2822' : '#7f9cb0';

      var cos = Math.cos(f), sin = Math.sin(f);
      function along(t, side) {
        side = side || 0;
        return { x: at.x + cos * t - sin * side, y: at.y + sin * t + cos * side };
      }
      function box(t, side, len, wid) {
        var c = along(t, side);
        return hullCorners(c.x, c.y, len, wid, f);
      }
      function scr(t, side) { var c = along(t, side); return toScreen(c.x, c.y); }

      var deck = lift + ride;                            // the hull floor
      var top = deck + spec.hgt;                         // the hull roof

      /* ---- shadow, and the mast a flier hangs from ---- */
      /* A mech stands on two feet: it casts the shadow of its feet, which
         drawMech lays down itself, not the slab of the hull it stands in for. */
      var onLegs = drive === 'walker' && !(u.transport && spec.style);
      if (!onLegs) {
        var shCol = spec.fly ? 'rgba(12,10,8,.34)' : 'rgba(14,11,8,.42)';
        /* What a flier throws on the ground is its own outline, not the box of a
           hull: a rotorcraft the disc it hangs under, a winged craft its wings. */
        var sf2 = frameAt(0, 0, f);
        if (spec.heli && spec.rotor) {
          var hub = S3(sf2(0, 0), ground), rr = spec.rotor * K;
          sEllipse(hub[0], hub[1], rr, rr * 0.5, shCol);
          poly(g, [[-spec.len * 0.55, -spec.wid * 0.3], [spec.len * 0.2, -spec.wid * 0.45],
            [spec.len * 0.2, spec.wid * 0.45], [-spec.len * 0.55, spec.wid * 0.3]]
            .map(function (q) { return S3(sf2(q[0], q[1]), ground); }), shCol);
        } else if (spec.craft) {
          // nose, the wings at their widest, then the tail
          var span = CRAFT_SPAN[spec.craft] || 1.1;
          if (spec.winglets && span < 2) span = 2.1;
          var L2 = spec.len, hw = spec.wid * 0.5, sp2 = spec.wid * 0.5 * span;
          poly(g, [[L2 * 0.5, 0], [L2 * 0.14, hw], [-L2 * 0.12, sp2], [-L2 * 0.32, sp2],
            [-L2 * 0.44, hw * 0.9], [-L2 * 0.5, hw * 0.3], [-L2 * 0.5, -hw * 0.3],
            [-L2 * 0.44, -hw * 0.9], [-L2 * 0.32, -sp2], [-L2 * 0.12, -sp2], [L2 * 0.14, -hw]]
            .map(function (q) { return S3(sf2(q[0], q[1]), ground); }), shCol);
        } else {
          var sc = project(box(0.25 / MACHINE, 0.25 / MACHINE, spec.len * 0.95, spec.wid * 0.95), ground);
          poly(g, sc, shCol);
        }
      }
      if (spec.fly && !downed) {
        var cg = toScreen(at.x, at.y);
        rect(g, cg.x - 1, cg.y - lift, 2, lift - ground, 'rgba(120,130,145,.18)');
      }

      styleInit();
      if (spec.craft) { drawCraft(); return { lift: lift, hgt: spec.hgt + 18 }; }
      if (spec.heli) { drawRotorcraft(); return { lift: lift, hgt: spec.hgt + 26 }; }
      /* A transport on legs is a walking tank, not a mech: its own hull, ramp
         and turret carried on four legs (six on the heavies), riding high. */
      var walkingTank = drive === 'walker' && !!u.transport && !!spec.style;
      if (walkingTank) {
        drawGlow();
        walkLegs('far');
        styledHull();
        walkLegs('near');
        styledTop();
        drawDamage();
        return { lift: lift, hgt: ride + spec.hgt * 1.3 };
      }
      if (drive === 'walker') {
        drawMech();
        var hm0 = mechHeights();
        return { lift: lift, hgt: hm0.legH + hm0.torsoH + hm0.headH };
      }

      drawGlow();
      drawGear('far');
      if (spec.style) {
        skirts('far');
        var tankBack = spec.style.rearTank && (cos + sin) < 0.3;   // side-on it stands clear of the hull too
        if (spec.style.rearTank && !tankBack) rearTank();   // behind the hull
        styledHull();
        drawGear('near');
        skirts();
        if (tankBack) rearTank();                           // the back is towards us: in front of it
        styledTop();
        drawDamage();
        return { lift: lift, hgt: ride + spec.hgt * 1.3 };
      }
      drawHull();
      drawGear('near');
      drawFittings();
      drawDamage();
      return { lift: lift, hgt: ride + spec.hgt };

      /* ---- the running gear: in iso-gear.js ---- */
      var KIT_GEAR = null;
      function kitGear() {
        return KIT_GEAR || (KIT_GEAR = MAKE_GEAR({
          HF: HF, S3: S3, STEEL: STEEL, STEEL_LIT: STEEL_LIT, TB: TB, TS: TS, at: at, box: box, cos: cos,
          dark: dark, dead: dead, deck: deck, drive: drive, f: f, frameAt: frameAt, g: g, hull: hull,
          lift: lift, line: line, lit: lit, mixc: mixc, opts: opts, rebel: u.faction === 'rebel', rectPts: rectPts, ride: ride,
          sEllipse: sEllipse, scr: scr, shape: shape, sin: sin, slabF: slabF, spec: spec, trim: trim
        }));
      }
      function want(phase, s, nearest) { return (KIT_GEAR || kitGear()).want(phase, s, nearest); }
      function gearOut() { return (KIT_GEAR || kitGear()).gearOut(); }
      function alongOrder(list) { return (KIT_GEAR || kitGear()).alongOrder(list); }
      function drawGlow() { return (KIT_GEAR || kitGear()).drawGlow(); }
      function drawGear(phase) { return (KIT_GEAR || kitGear()).drawGear(phase); }
      function dropBody() { return (KIT_GEAR || kitGear()).dropBody(); }
      function dropHatch() { return (KIT_GEAR || kitGear()).dropHatch(); }
      function wheelGeom() { return (KIT_GEAR || kitGear()).wheelGeom(); }
      function walkLegs(phase) { return (KIT_GEAR || kitGear()).walkLegs(phase); }
      /* ---- the plain hull and its fittings: in iso-plainhull.js ---- */
      var KIT_PLAINHULL = null;
      function kitPlainHull() {
        return KIT_PLAINHULL || (KIT_PLAINHULL = MAKE_PLAINHULL({
          GLASS: GLASS, GLINT: GLINT, STEEL: STEEL, STEEL_LIT: STEEL_LIT, box: box, cos: cos, dark: dark,
          dead: dead, deck: deck, dropBody: dropBody, dropHatch: dropHatch, g: g, hull: hull, lit: lit,
          scr: scr, sin: sin, spec: spec, top: top, trim: trim
        }));
      }
      function drawHull() { return (KIT_PLAINHULL || kitPlainHull()).drawHull(); }
      function drawFittings() { return (KIT_PLAINHULL || kitPlainHull()).drawFittings(); }

      /* ================= styled hulls =================
         Every PMC machine now has a look of its own, named after the kind of real
         vehicle it is drawn from — a technical, an armoured car, a light tank, a
         main battle tank, a boxy carrier — and built from extruded outlines in the
         hull's own frame rather than from one box with a turret on it. The parts
         that fire record where their barrels and tubes end (PH.mounts), so the game
         can start each shot at the weapon that fired it. A turret turns to
         whatever the machine last shot at (u.aim); a fixed gun points where the
         hull does. */
      function col3(c) {
        if (c.charAt(0) === '#') return hex3(c);
        var m = c.match(/[\d.]+/g);
        return [+m[0], +m[1], +m[2]];
      }
      function mixc(c1, c2, k) {
        var key = c1 + '|' + c2 + '|' + k, m = MIX_OF[key];
        if (m) return m;
        var A1 = col3(c1), B1 = col3(c2);
        k = clamp01(k);
        return (MIX_OF[key] = 'rgb(' + Math.round(A1[0] + (B1[0] - A1[0]) * k) + ',' + Math.round(A1[1] + (B1[1] - A1[1]) * k) +
          ',' + Math.round(A1[2] + (B1[2] - A1[2]) * k) + ')');
      }
      // set up before any styled drawing (these sit below the early returns)
      var P0, HF, AIM, TB, TT, TS, TC;
      var REBELP = false;
      var CAMO = null;                 // a PMC hull's blotches, in the hull's own frame
      function styleInit() {
        REBELP = u.faction === 'rebel' && !dead;
        CAMO = camoFor();
        PATCH_FACE = !!(spec.craft || spec.heli);
        PATCH_GREY = tone('#8a8f96', '#62676e', '#3a3e44', '#747980'); PATCH_GREY.tex = 'steel';
        PATCH_RUST = tone('#9a6a44', '#7a4a2a', '#4a2c18', '#8a5a36'); PATCH_RUST.tex = 'rust';
        P0 = toScreen(at.x, at.y);
        HF = frameAt(0, 0, f);
        AIM = (u.aim == null || dead) ? f : u.aim;
        TB = tone(lit, hull, dark, mixc(hull, lit, 0.5));
        TT = tone(mixc(trim, lit, 0.35), trim, mixc(trim, dark, 0.6), mixc(trim, lit, 0.25));
        TS = tone(STEEL_LIT, mixc(STEEL, STEEL_LIT, 0.5), STEEL, mixc(STEEL, STEEL_LIT, 0.7));
        TC = tone(dead ? '#3a352d' : '#8a8062', dead ? '#2e2822' : '#6d654e', dead ? '#1d1a15' : '#4a4434', dead ? '#3a352d' : '#7b7359');
      }
      /* Digital camouflage on a company's machines and aircraft: small square
         cells of the army colour, darkened, laid on a grid over the hull —
         clusters of them, with singles stepping off the edges, the way a printed
         digital pattern breaks up. The cells sit in the hull's own frame and are
         seeded by the kind of machine, so a machine keeps its pattern as it
         turns and every one of a kind is painted alike. */
      function camoFor() {
        if (dead || (u.cls !== 'vehicle' && u.cls !== 'aircraft')) return null;
        if (u.faction && u.faction !== 'pmc') return null;
        // the same for every machine of a kind, so worked out once a kind
        var ck = u.art + '|' + spec.len + '|' + spec.wid + '|' + spec.craft + '|' + spec.heli;
        return CAMO_OF[ck] || (CAMO_OF[ck] = camoCells());
      }
      function camoCells() {
        var len = spec.len || 2, wid = spec.wid || 1.2, out = [], seen = {};
        /* A craft is painted to its wingtips, not to the width of its fuselage,
           and a rotorcraft out to its stub wings: the pattern is laid over
           everything the machine actually spreads across. */
        var reach = spec.craft ? (CRAFT_SPAN[spec.craft] || 1.4) : spec.heli ? 2.2 : 1.2;
        var seed = 0; String(u.art || '').split('').forEach(function (ch) { seed = (seed * 31 + ch.charCodeAt(0)) | 0; });
        var rnd = rng(seed ^ 0x5bd1e995);
        // a little past the machine's reach all round, so no edge of a deck or wing runs off the pattern
        var cols = Math.max(8, Math.round(len * 1.4 / CELL));
        var rows = Math.max(7, Math.round(wid * reach * 1.4 / CELL));
        /* Every block of three by three cells has exactly four filled, picked
           at random for the kind of machine: the cells still clump and scatter
           the way a printed digital pattern does, but no stretch of deck three
           cells across is ever left bare. */
        var salt = seed & 0xffff;
        for (var cx = -Math.ceil(cols / 2); cx <= Math.ceil(cols / 2); cx++) {
          for (var cy = -Math.ceil(rows / 2); cy <= Math.ceil(rows / 2); cy++) {
            var bx = Math.floor(cx / 3), by = Math.floor(cy / 3), me = hash(cx, cy, salt + bx * 7 + by * 13), below = 0;
            for (var ci = 0; ci < 3; ci++) for (var cj = 0; cj < 3; cj++) {
              if (hash(bx * 3 + ci, by * 3 + cj, salt + bx * 7 + by * 13) < me) below++;
            }
            if (below < 4) out.push({ p: cx * CELL, q: cy * CELL, zk: rnd() });
          }
        }
        return out;
      }
      /* The pattern over one face, clipped to it, in a shade of the face's own
         colour. On the top of a hull a cell lies flat, so it is projected as the
         square it is; on a side it is a block on the plate, drawn square to the
         screen — which is what a printed pattern looks like on a wall. */
      function camoOn(pts, col, z, top, h) {
        if (!CAMO || !pts || pts.length < 3) return;
        var x0 = pts[0][0], x1 = x0, y0 = pts[0][1], y1 = y0;
        for (var i = 1; i < pts.length; i++) {
          if (pts[i][0] < x0) x0 = pts[i][0]; else if (pts[i][0] > x1) x1 = pts[i][0];
          if (pts[i][1] < y0) y0 = pts[i][1]; else if (pts[i][1] > y1) y1 = pts[i][1];
        }
        var half = CELL * K * 0.5, pad = half * 2.2;
        g.save();
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (var j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]);
        g.closePath(); g.clip();
        g.fillStyle = mixc(col, '#16180f', 0.34);
        /* A plate standing up (a side, a front, a turret's cheek) takes the
           pattern on a grid of its own, square to the screen and pinned to the
           machine, so it is covered edge to edge as densely as the deck is:
           clumps of cells on a coarse grid, and singles scattered between. */
        if (!top) {
          var cs = half * 2;
          var gi0 = Math.floor((x0 - P0.x) / cs), gi1 = Math.ceil((x1 - P0.x) / cs);
          var gj0 = Math.floor((y0 - P0.y) / cs), gj1 = Math.ceil((y1 - P0.y) / cs);
          /* every block of three by three cells has exactly four of them
             filled, picked at random, so no stretch of plate three cells across
             is ever left bare, yet the cells still clump and scatter */
          var inBlock = function (gi2, gj2) {
            var bk = gi2 + ',' + gj2, known = BLOCK_ON[bk];
            if (known !== undefined) return known;
            return (BLOCK_ON[bk] = inBlock0(gi2, gj2));
          };
          var inBlock0 = function (gi2, gj2) {
            var bx = Math.floor(gi2 / 3), by = Math.floor(gj2 / 3);
            var me = hash(gi2, gj2, 772 + bx * 7 + by * 13), below = 0;
            for (var ci2 = 0; ci2 < 3; ci2++) for (var cj2 = 0; cj2 < 3; cj2++) {
              if (hash(bx * 3 + ci2, by * 3 + cj2, 772 + bx * 7 + by * 13) < me) below++;
            }
            return below < 4;
          };
          // a small plate may fall between the blocks' picks: it is topped up to
          // a third of the cells whose middles lie on it, the likeliest first
          var inside = function (px, py) {
            var hit = false;
            for (var pi = 0, pj = pts.length - 1; pi < pts.length; pj = pi++) {
              var xi = pts[pi][0], yi = pts[pi][1], xj = pts[pj][0], yj = pts[pj][1];
              if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) hit = !hit;
            }
            return hit;
          };
          var onFace = [], lit = 0;
          for (var gi = gi0; gi <= gi1; gi++) {
            for (var gj = gj0; gj <= gj1; gj++) {
              var on = inBlock(gi, gj);
              if (on) g.fillRect(P0.x + gi * cs, P0.y + gj * cs, cs, cs);
              if (inside(P0.x + (gi + 0.5) * cs, P0.y + (gj + 0.5) * cs)) {
                if (on) lit++; else onFace.push({ gi: gi, gj: gj, r: hash(gi, gj, 919) });
              }
            }
          }
          var want = Math.ceil((lit + onFace.length) * 0.34) - lit;
          if (want > 0) {
            onFace.sort(function (p1, p2) { return p1.r - p2.r; });
            for (var wk = 0; wk < want && wk < onFace.length; wk++) g.fillRect(P0.x + onFace[wk].gi * cs, P0.y + onFace[wk].gj * cs, cs, cs);
          }
          g.restore();
          return;
        }
        CAMO.forEach(function (b2) {
          // up the plate as well as along it, so a tall face is covered
          var c = S3(HF(b2.p, b2.q), z + (top ? 0 : (b2.zk - 0.5) * (h || 0)));
          // nowhere near this face: nothing to draw
          if (c[0] < x0 - pad || c[0] > x1 + pad || c[1] < y0 - pad || c[1] > y1 + pad) return;
          if (top) {
            var q1 = S3(HF(b2.p - CELL / 2, b2.q - CELL / 2), z);
            var q2 = S3(HF(b2.p + CELL / 2, b2.q - CELL / 2), z);
            var q3 = S3(HF(b2.p + CELL / 2, b2.q + CELL / 2), z);
            var q4 = S3(HF(b2.p - CELL / 2, b2.q + CELL / 2), z);
            g.beginPath();
            g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.lineTo(q3[0], q3[1]); g.lineTo(q4[0], q4[1]);
            g.closePath(); g.fill();
          } else {
            g.fillRect(c[0] - half, c[1] - half, half * 2, half * 2);
          }
        });
        g.restore();
      }
      function mount(kind, pt, dir) {
        if (!PH.mounts) return;
        (PH.mounts[kind] = PH.mounts[kind] || []).push({ dx: pt[0] - P0.x, dy: pt[1] - P0.y, dir: dir || 1 });
      }
      function S3(q, z) { var s2 = toScreen(q.x, q.y); return [s2.x, s2.y - z]; }
      // a frame: local (a forward, b across) about a pivot, turned to an angle
      function frameAt(t0, s0, ang) {
        var c0 = along(t0, s0), ca = Math.cos(ang), sa = Math.sin(ang);
        var fr = function (p, q) { return { x: c0.x + ca * p - sa * q, y: c0.y + sa * p + ca * q }; };
        fr.ang = ang; fr.t0 = t0; fr.s0 = s0;
        return fr;
      }
      function tone(lit2, mid2, dark2, top2) { return { lit: lit2, mid: mid2, dark: dark2, top: top2 }; }

      /* An extruded outline: a base ring and a top ring (the top may be smaller,
         or set back, so faces slope), shaded face by face by which way each one
         turns to the light, then the top. Returns the top ring on screen. */
      /* Rebel machines are patched together: each plate is the side's colour,
         bare grey steel or rusted brown, picked from where the plate sits so a
         machine looks the same from frame to frame. */
      var PATCH_GREY, PATCH_RUST, PATCH_FACE = false;
      function patch(tn, q, salt) {
        if (!REBELP || tn !== TB) return tn;
        /* keyed to where the plate sits on the hull itself — along it and across
           it — not on the table, so a plate keeps its colour as the machine
           moves and turns (a table position shifts every frame of a move) */
        var dx = q.x - at.x, dy = q.y - at.y;
        var la = dx * cos + dy * sin, lb = -dx * sin + dy * cos;
        var hq = hash(Math.floor(la * 4 + 0.37 + 64), Math.floor(Math.abs(lb) * 4 + 0.37) * (lb < 0 ? 3 : 1), salt | 0);
        return hq < 0.5 ? TB : hq < 0.75 ? PATCH_GREY : PATCH_RUST;
      }
      /* The scrap a rebel machine is patched from is not clean paint: the rusted
         brown is pitted and streaked, the bare grey is scuffed and spotted with
         weld and rivet heads. A fine texture laid over those plates, pinned to
         the machine so it rides along with it rather than swimming as it moves. */
      function texOn(pts, kind) {
        if (dead || !g.createPattern) return;
        var pat = texPattern(g, kind);
        if (!pat) return;
        if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translateSelf(Math.round(P0.x), Math.round(P0.y)));
        poly(g, pts, pat);
      }
      function prism(base, top2, z0, h, tn0, noTop) {
        var tn = tn0;
        var Bs = base.map(function (q) { return S3(q, z0); });
        var Ts = top2.map(function (q) { return S3(q, z0 + h); });
        var n = base.length, cx = 0, cy = 0;
        base.forEach(function (q) { cx += q.x; cy += q.y; }); cx /= n; cy /= n;
        var faces = [], ringSign = 0;
        for (var ri = 0; ri < n; ri++) { var ra = Bs[ri], rb = Bs[(ri + 1) % n]; ringSign += ra[0] * rb[1] - rb[0] * ra[1]; }
        ringSign = ringSign < 0 ? RING_VIS : -RING_VIS;
        for (var i = 0; i < n; i++) {
          var j = (i + 1) % n, a1 = base[i], b1 = base[j];
          var ex = b1.x - a1.x, ey = b1.y - a1.y, nx = ey, ny = -ex;
          if (nx * ((a1.x + b1.x) / 2 - cx) + ny * ((a1.y + b1.y) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
          var ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
          var sx = nx - ny, sy = (nx + ny) / 2;
          /* A face is seen when it turns toward the viewer on the screen. For a
             raked face (a glacis, a sloped tail) that depends on its slope as
             well as its facing, so it is judged from the projected quad itself:
             wound the same way as a face known to point at the viewer. */
          var q = [Bs[i], Bs[j], Ts[j], Ts[i]], ar = 0;
          for (var qi = 0; qi < 4; qi++) { var qa = q[qi], qb = q[(qi + 1) % 4]; ar += qa[0] * qb[1] - qb[0] * qa[1]; }
          if (ar * ringSign <= 0.5) continue;
          faces.push({ i: i, j: j, sx: sx, d: a1.x + b1.x + a1.y + b1.y });
        }
        faces.sort(function (p, q) { return p.d - q.d; });
        faces.forEach(function (fc) {
          var k = clamp01(0.5 - fc.sx * 0.42);
          /* ground machines are patched plate by plate (one prism, one plate);
             a flier's skin is patched face by face, so its few big panels vary */
          var pa = PATCH_FACE ? base[fc.i] : a1, pb = PATCH_FACE ? base[fc.j] : b1;
          // (salted by the plate's height on the hull itself, not above the ground: a machine
          // flying higher, or hopping as it walks, keeps its own colours)
          var ft = patch(tn0, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, Math.round(z0 - lift) + 3);
          var colr = k > 0.5 ? mixc(ft.mid, ft.lit, (k - 0.5) * 2) : mixc(ft.dark, ft.mid, k * 2);
          var face = [Bs[fc.i], Bs[fc.j], Ts[fc.j], Ts[fc.i]];
          poly(g, face, colr);
          if (ft.tex) texOn(face, ft.tex);
          if (CAMO && (tn0 === TB || tn0 === TT)) camoOn(face, colr, z0 + h * 0.5, false, h);
          if (h > 2) {
            var yT = Math.min(face[2][1], face[3][1]), yB = Math.max(face[0][1], face[1][1]);
            if (yB - yT > 1) {
              var gr = g.createLinearGradient(0, yT, 0, yB);
              gr.addColorStop(0, 'rgba(255,246,228,' + (0.05 + k * 0.1) + ')');
              gr.addColorStop(0.55, 'rgba(0,0,0,0)');
              gr.addColorStop(1, 'rgba(6,8,12,.26)');
              poly(g, face, gr);
            }
          }
          edge(g, Ts[fc.i], Ts[fc.j], 'rgba(255,240,214,' + (0.2 + k * 0.4) + ')', 0.7);
          edge(g, Bs[fc.i], Bs[fc.j], 'rgba(4,6,10,.5)', 0.7);
        });
        if (!noTop && tn.top) {
          var cxT = 0, cyT = 0; base.forEach(function (q) { cxT += q.x; cyT += q.y; });
          var topT = patch(tn0, { x: cxT / base.length, y: cyT / base.length }, Math.round(z0 + h - lift) + 11), topCol = topT.top;
          poly(g, Ts, topCol);
          if (topT.tex) texOn(Ts, topT.tex);
          if (CAMO && (tn0 === TB || tn0 === TT)) camoOn(Ts, topCol, z0 + h, true);
          var ys = Ts.map(function (q) { return q[1]; });
          var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
          if (y1 - y0 > 1) {
            var gt = g.createLinearGradient(0, y0, 0, y1);
            gt.addColorStop(0, 'rgba(255,248,232,.16)');
            gt.addColorStop(1, 'rgba(0,0,0,.1)');
            poly(g, Ts, gt);
          }
        }
        return Ts;
      }
      // an outline given as [a, b] pairs in a frame, extruded; the top is the
      // same outline scaled toward its middle (sc) or a second outline (topPts)
      function shape(fr, pts, z0, h, tn, sc, topPts, noTop) {
        var ma = 0, mb = 0;
        pts.forEach(function (q) { ma += q[0]; mb += q[1]; }); ma /= pts.length; mb /= pts.length;
        var base = pts.map(function (q) { return fr(q[0], q[1]); });
        var tp = topPts || pts.map(function (q) {
          var k = sc == null ? 1 : sc;
          return [ma + (q[0] - ma) * k, mb + (q[1] - mb) * k];
        });
        return prism(base, tp.map(function (q) { return fr(q[0], q[1]); }), z0, h, tn, noTop);
      }
      function rectPts(a0, a1, b0, b1) { return [[a1, b0], [a1, b1], [a0, b1], [a0, b0]]; }
      // a box in a frame, with its top pulled in at the front (fr0) and back (bk0)
      function slabF(fr, a0, a1, b0, b1, z0, h, tn, frontIn, backIn, sideIn, noTop) {
        var si = sideIn || 0;
        return shape(fr, rectPts(a0, a1, b0, b1), z0, h, tn, null,
          rectPts(a0 + (backIn || 0), a1 - (frontIn || 0), b0 + si, b1 - si), noTop);
      }
      function sEllipse(x, y, rx, ry, c) {
        g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill();
      }
      function line(p1, p2, w, c, cap) {
        g.strokeStyle = c; g.lineWidth = w; g.lineCap = cap || 'round';
        g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
        g.lineCap = 'butt';
      }
      /* A gun barrel from a0 to a1 along a frame, at height z, rising `up` px to
         the muzzle. Drawn smooth, with a lit top line, an optional fume
         extractor and muzzle brake; the muzzle is recorded as a mount. */
      /* Cooling vents down an energy barrel: n small blue slots set into it,
         each well inside the barrel's width and clear of the next, the way the
         advanced combat vehicle's plasma cannon shows them. */
      function vents(fr, a0, a1, b, z, w, n, up) {
        if (dead) return;
        for (var vi = 1; vi <= n; vi++) {
          var k = vi / (n + 1), vp = S3(fr(a0 + (a1 - a0) * k, b), z + (up || 0) * k);
          sEllipse(vp[0], vp[1], w * 0.4, w * 0.34, '#0c1016');
          sEllipse(vp[0], vp[1], w * 0.28, w * 0.22, 'rgba(120,230,255,.85)');
        }
      }
      function barrel(fr, a0, a1, b, z, w, kind, o) {
        o = o || {};
        var up = o.up || 0;
        var p1 = S3(fr(a0, b), z), p2 = S3(fr(a1, b), z + up);
        line(p1, p2, w + 1.2, '#0c0f13');
        line(p1, p2, w, o.col || '#20252d');
        line([p1[0], p1[1] - w * 0.3], [p2[0], p2[1] - w * 0.3], Math.max(0.6, w * 0.3), o.lit || '#4a535f');
        if (o.fume) {
          var fp = S3(fr(a0 + (a1 - a0) * o.fume, b), z + up * o.fume);
          sEllipse(fp[0], fp[1], w * 0.95, w * 0.8, '#1a1e25');
          sEllipse(fp[0] - w * 0.2, fp[1] - w * 0.25, w * 0.4, w * 0.3, '#48515c');
        }
        if (o.brake) {
          var bp = S3(fr(a1 - 0.04, b), z + up);
          sEllipse(bp[0], bp[1], w * 1.05, w * 0.9, '#15181e');
          sEllipse(bp[0] - w * 0.25, bp[1] - w * 0.3, w * 0.45, w * 0.35, '#525b67');
        }
        if (kind) mount(kind, p2, p2[0] >= p1[0] ? 1 : -1);
        return p2;
      }
      /* A box of launch tubes: a slab with its front face drilled with rows of
         tube mouths. Each mouth is a mount. `up` tilts the box toward the sky. */
      function launcher(fr, a0, a1, b0, b1, z, h, rows, cols, kind, o) {
        o = o || {};
        var tilt = o.up || 0;
        var tn = o.tone || TS;
        // the box, with its front raised by tilt: done as a slanted prism
        var pts = rectPts(a0, a1, b0, b1);
        var base = pts.map(function (q) { return fr(q[0], q[1]); });
        var Bs = base.map(function (q, i) { return S3(q, z + (i < 2 ? tilt : 0)); });
        var Ts = base.map(function (q, i) { return S3(q, z + h + (i < 2 ? tilt : 0)); });
        var cx = 0, cy = 0; base.forEach(function (q) { cx += q.x; cy += q.y; }); cx /= 4; cy /= 4;
        var faces = [];
        for (var i = 0; i < 4; i++) {
          var j = (i + 1) % 4, p1 = base[i], p2 = base[j];
          var nx = p2.y - p1.y, ny = -(p2.x - p1.x);
          if (nx * ((p1.x + p2.x) / 2 - cx) + ny * ((p1.y + p2.y) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
          var ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
          faces.push({ i: i, j: j, sx: nx - ny, sy: (nx + ny) / 2, front: i === 0, d: p1.x + p2.x + p1.y + p2.y });
        }
        faces.sort(function (p, q) { return p.d - q.d; });
        var frontVisible = false;
        // a face is seen when it winds toward the viewer on the screen: this
        // holds for a box tilted up at the front as well as for a level one
        var rs = 0;
        for (var ri = 0; ri < 4; ri++) { var ra = Bs[ri], rb = Bs[(ri + 1) % 4]; rs += ra[0] * rb[1] - rb[0] * ra[1]; }
        var ringSign = rs < 0 ? RING_VIS : -RING_VIS;
        faces.forEach(function (fc) {
          var fq = [Bs[fc.i], Bs[fc.j], Ts[fc.j], Ts[fc.i]], ar = 0;
          for (var qi = 0; qi < 4; qi++) { var qa = fq[qi], qb = fq[(qi + 1) % 4]; ar += qa[0] * qb[1] - qb[0] * qa[1]; }
          if (ar * ringSign <= 0.5) return;
          var k = clamp01(0.5 - fc.sx * 0.42);
          var lcol = k > 0.5 ? mixc(tn.mid, tn.lit, (k - 0.5) * 2) : mixc(tn.dark, tn.mid, k * 2);
          poly(g, fq, lcol);
          if (CAMO && (tn === TB || tn === TT)) camoOn(fq, lcol, z + h * 0.5, false, h);
          edge(g, Ts[fc.i], Ts[fc.j], 'rgba(255,240,214,.3)', 0.6);
          if (fc.front) frontVisible = true;
        });
        poly(g, Ts, tn.top);
        if (CAMO && (tn === TB || tn === TT)) camoOn(Ts, tn.top, z + h, true);
        edge(g, Ts[0], Ts[1], 'rgba(255,240,214,.45)', 0.6);
        // the tube mouths on the front face (corners 0,1 at the front)
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var u1 = (c + 0.5) / cols, v1 = (r + 0.5) / rows;
            var lo = [Bs[0][0] + (Bs[1][0] - Bs[0][0]) * u1, Bs[0][1] + (Bs[1][1] - Bs[0][1]) * u1];
            var hi = [Ts[0][0] + (Ts[1][0] - Ts[0][0]) * u1, Ts[0][1] + (Ts[1][1] - Ts[0][1]) * u1];
            var mp = [lo[0] + (hi[0] - lo[0]) * v1, lo[1] + (hi[1] - lo[1]) * v1];
            if (frontVisible || o.showTubes) {
              var rr = Math.max(0.8, Math.min(Math.hypot(Bs[1][0] - Bs[0][0], Bs[1][1] - Bs[0][1]) / cols,
                Math.abs(hi[1] - lo[1]) / rows) * 0.36);
              sEllipse(mp[0], mp[1], rr, rr * 0.85, '#0a0c10');
              if (o.warheads) sEllipse(mp[0] - rr * 0.2, mp[1] - rr * 0.2, rr * 0.55, rr * 0.45, o.warheads);
            }
            if (kind) mount(kind, mp, Bs[1][0] + Bs[0][0] > Bs[2][0] + Bs[3][0] ? 1 : -1);
          }
        }
        return Ts;
      }
      function aerial(fr, p, q, z, len, lean) {
        var b0 = S3(fr(p, q), z), b1 = S3(fr(p - (lean || 0.12), q), z + len);
        line(b0, b1, 0.8, STEEL_LIT);
        sEllipse(b0[0], b0[1], 1.4, 0.8, STEEL);
        sEllipse(b1[0], b1[1], 0.9, 0.9, dead ? STEEL : '#9aa6b4');
      }
      /* A headlamp on the nose. Out of sight once the nose turns away; `see`
         says how far round it stays in view: a raked glacis faces up as well as
         forward, so its lamps are seen from further behind than an upright face's. */
      function lights(fr, p, q, z, see) {
        if (fr.ang != null && Math.cos(fr.ang) + Math.sin(fr.ang) < -(see || 0)) return;
        var lp = S3(fr(p, q), z);
        sEllipse(lp[0], lp[1], 1.4, 1.1, dead ? STEEL : '#f0e2b4');
      }
      function hatch(fr, p, q, z, r) {
        var hp = S3(fr(p, q), z);
        sEllipse(hp[0], hp[1] + 0.5, r * K, r * K * 0.55, 'rgba(8,10,14,.45)');
        sEllipse(hp[0], hp[1], r * K, r * K * 0.55, mixc(hull, dark, 0.35));
        sEllipse(hp[0] - r * K * 0.2, hp[1] - r * K * 0.12, r * K * 0.55, r * K * 0.28, mixc(hull, lit, 0.4));
      }
      function grille(fr, a0, a1, b0, b1, z, n) {
        var pts = rectPts(a0, a1, b0, b1).map(function (q) { return S3(fr(q[0], q[1]), z); });
        poly(g, pts, STEEL);
        for (var i = 1; i < n; i++) {
          var k = i / n;
          edge(g, [pts[0][0] + (pts[3][0] - pts[0][0]) * k, pts[0][1] + (pts[3][1] - pts[0][1]) * k],
            [pts[1][0] + (pts[2][0] - pts[1][0]) * k, pts[1][1] + (pts[2][1] - pts[1][1]) * k], STEEL_LIT, 0.6);
        }
      }
      // a red cross panel laid on a roof
      function crossOn(fr, p, q, z, sz) {
        var pts = rectPts(p - sz, p + sz, q - sz, q + sz).map(function (r) { return S3(fr(r[0], r[1]), z); });
        poly(g, pts, '#e8e3d8');
        var arm1 = rectPts(p - sz * 0.75, p + sz * 0.75, q - sz * 0.25, q + sz * 0.25).map(function (r) { return S3(fr(r[0], r[1]), z); });
        var arm2 = rectPts(p - sz * 0.25, p + sz * 0.25, q - sz * 0.75, q + sz * 0.75).map(function (r) { return S3(fr(r[0], r[1]), z); });
        poly(g, arm1, '#c23a32'); poly(g, arm2, '#c23a32');
      }
      // hexagonal armour tiles set into a flank (future hulls): outlines on the lit side
      function hexFlank(fr, a0, a1, bSide, z0, h, cols) {
        var n = cols || 6, step = (a1 - a0) / n;
        for (var i = 0; i < n; i++) {
          for (var r = 0; r < 2; r++) {
            var ca = a0 + step * (i + 0.5 + (r ? 0.5 : 0)), cz = z0 + h * (r ? 0.3 : 0.72);
            if (ca > a1 - step * 0.3) continue;
            var pts = [];
            for (var k = 0; k < 6; k++) {
              var ang = k * Math.PI / 3;
              var q = S3(fr(ca + Math.cos(ang) * step * 0.46, bSide), cz + Math.sin(ang) * h * 0.24);
              pts.push(q);
            }
            poly(g, pts, 'rgba(255,248,232,.07)');
            for (var e2 = 0; e2 < 6; e2++) edge(g, pts[e2], pts[(e2 + 1) % 6], 'rgba(10,12,16,.35)', 0.6);
          }
        }
      }

      /* The same tiles across the nose: laid on the (raked) front plate, which runs
         from aBot at the foot up and back to aTop, across b0..b1. Only drawn when
         the nose is towards the eye. */
      function hexNose(fr, aBot, aTop, b0, b1, z0, h, cols, rows) {
        if ((cos + sin) <= 0) return;
        cols = cols || 5;                                  // the upper row; the lower, set between, has one fewer
        // two rows, or three (the middle one set between the others), each tile shorter to fit
        rows = rows || 2;
        var cw = (b1 - b0) / cols, cus = rows === 3 ? [0.82, 0.5, 0.18] : [0.72, 0.3], ru = rows === 3 ? 0.16 : 0.24;
        for (var r = 0; r < rows; r++) {
          for (var i = 0; i < cols; i++) {
            var cb = b0 + cw * (i + 0.5 + (r % 2 ? 0.5 : 0)), cu = cus[r];
            if (cb > b1 - cw * 0.3) continue;
            var pts = [];
            for (var k = 0; k < 6; k++) {
              var ang = k * Math.PI / 3, u = cu + Math.sin(ang) * ru;
              pts.push(S3(fr(aBot + (aTop - aBot) * u, cb + Math.cos(ang) * cw * 0.46), z0 + h * u));
            }
            poly(g, pts, 'rgba(255,248,232,.07)');
            for (var e2 = 0; e2 < 6; e2++) edge(g, pts[e2], pts[(e2 + 1) % 6], 'rgba(10,12,16,.35)', 0.6);
          }
        }
      }

      /* Hex tiles laid on one face, raked or upright: its bottom edge runs p0 to
         p1 and its top edge q0 to q1 (each [a, b] in the frame), from z0 up h.
         `rows` gives the tiles in each row, top row first, set between each other. */
      function hexPanel(fr, p0, p1, q0, q1, z0, h, rows) {
        var nr = rows.length, mx = Math.max.apply(null, rows);
        function at(t, uu) {
          var a = p0[0] + (p1[0] - p0[0]) * t, b = p0[1] + (p1[1] - p0[1]) * t;
          var a2 = q0[0] + (q1[0] - q0[0]) * t, b2 = q0[1] + (q1[1] - q0[1]) * t;
          return S3(fr(a + (a2 - a) * uu, b + (b2 - b) * uu), z0 + h * uu);
        }
        rows.forEach(function (n, r) {
          var u = nr === 1 ? 0.5 : 0.74 - r * (0.48 / (nr - 1)), ru = nr === 1 ? 0.34 : 0.24;
          for (var i = 0; i < n; i++) {
            var t = 0.5 + (i - (n - 1) / 2) / mx, pts = [];
            for (var k = 0; k < 6; k++) {
              var ang = k * Math.PI / 3;
              pts.push(at(t + Math.cos(ang) * 0.46 / mx, u + Math.sin(ang) * ru));
            }
            poly(g, pts, 'rgba(255,248,232,.07)');
            for (var e2 = 0; e2 < 6; e2++) edge(g, pts[e2], pts[(e2 + 1) % 6], 'rgba(10,12,16,.35)', 0.6);
          }
        });
      }

      /* A door on the back of a hull, drawn when the back is towards the eye: the
         face is at aR (the hull's rear), halfW either side of the middle, from z0
         up h. 'ramp' is an APC's drop ramp with a crew door let into it, 'double'
         a pair of cargo doors, 'canvas' a tarpaulin's rear flaps over a tailgate. */
      function rearDoor(fr, aR, halfW, z0, h, kind) {
        if ((cos + sin) >= -0.02) return;
        var a = aR - 0.006;
        function P(b, z) { return S3(fr(a, b), z); }
        var DK = 'rgba(10,9,7,.6)', LT = 'rgba(255,248,232,.16)', MET = '#2a2f37';
        function frame(b0, b1, zb, zt) {
          edge(g, P(b0, zb), P(b0, zt), DK, 1); edge(g, P(b1, zb), P(b1, zt), DK, 1);
          edge(g, P(b0, zt), P(b1, zt), DK, 1); edge(g, P(b0, zb), P(b1, zb), DK, 1);
          edge(g, P(b0 + halfW * 0.04, zt - 1), P(b1 - halfW * 0.04, zt - 1), LT, 0.7);
        }
        function handle(b, z) { var q = P(b, z); poly(g, [[q[0] - 1.4, q[1] - 0.6], [q[0] + 1.4, q[1] - 0.6], [q[0] + 1.4, q[1] + 0.6], [q[0] - 1.4, q[1] + 0.6]], MET); }
        function hinge(b, z) { var q = P(b, z); poly(g, [[q[0] - 0.9, q[1] - 1.1], [q[0] + 0.9, q[1] - 1.1], [q[0] + 0.9, q[1] + 1.1], [q[0] - 0.9, q[1] + 1.1]], MET); }
        if (kind === 'ramp') {
          // the ramp, hinged along its foot, and the crew door let into one side of it
          frame(-halfW, halfW, z0, z0 + h);
          line(P(-halfW * 0.9, z0 + 1), P(halfW * 0.9, z0 + 1), 1.6, MET);
          frame(halfW * 0.08, halfW * 0.78, z0 + h * 0.12, z0 + h * 0.86);
          handle(halfW * 0.2, z0 + h * 0.5);
          line(P(halfW * 0.34, z0 + h * 0.7), P(halfW * 0.6, z0 + h * 0.7), 1.3, '#0b0e12');   // a vision block
        } else if (kind === 'double') {
          frame(-halfW, 0, z0, z0 + h); frame(0, halfW, z0, z0 + h);
          [-1, 1].forEach(function (sd) {
            hinge(sd * halfW * 0.92, z0 + h * 0.22); hinge(sd * halfW * 0.92, z0 + h * 0.78);
            handle(sd * halfW * 0.14, z0 + h * 0.5);
          });
        } else {
          // the canvas: two flaps meeting down the middle, laced shut, over a tailgate with its latches
          edge(g, P(0, z0 + h * 0.3), P(0, z0 + h), DK, 1.1);
          for (var k = 0; k < 4; k++) { var z = z0 + h * (0.4 + 0.15 * k); line(P(-halfW * 0.06, z), P(halfW * 0.06, z), 0.8, 'rgba(40,34,24,.8)'); }
          edge(g, P(-halfW, z0 + h * 0.28), P(halfW, z0 + h * 0.28), DK, 1);
          handle(-halfW * 0.7, z0 + h * 0.18); handle(halfW * 0.7, z0 + h * 0.18);
        }
      }

      function nearSide() { return (cos - sin) > 0 ? 1 : -1; }   // which flank faces the eye
      // the same, for something turned to its own angle (a traversed mount)
      function nearSideAt(ang) { return (Math.cos(ang) - Math.sin(ang)) > 0 ? 1 : -1; }

      /* ---- the styled hulls: in iso-hulls.js ---- */
      var KIT_HULLS = null;
      function kitHulls() {
        return KIT_HULLS || (KIT_HULLS = MAKE_HULLS({
          AIM: AIM, GLASS: GLASS, GLINT: GLINT, HF: HF, S3: S3, STEEL: STEEL, TB: TB, TC: TC, TS: TS, TT: TT,
          aerial: aerial, along: along, alongOrder: alongOrder, barrel: barrel, box: box, camoOn: camoOn, cos: cos,
          crossOn: crossOn, dark: dark, dead: dead, deck: deck, drive: drive, droneDue: droneDue,
          droneKit: droneKit, droneMark: droneMark, droneSpot: droneSpot, frameAt: frameAt, g: g,
          gearOut: gearOut, grille: grille, hatch: hatch, hexFlank: hexFlank, hexNose: hexNose, hull: hull,
          launcher: launcher, lift: lift, lights: lights, line: line, lit: lit, mixc: mixc, mount: mount,
          nearSide: nearSide, nearSideAt: nearSideAt, rearDoor: rearDoor, sEllipse: sEllipse, shape: shape,
          sin: sin, slabF: slabF, spec: spec, tone: tone, trim: trim, u: u, want: want, wheelGeom: wheelGeom
        }));
      }
      function rearTank() { return (KIT_HULLS || kitHulls()).rearTank(); }
      function styledHull() { return (KIT_HULLS || kitHulls()).styledHull(); }
      function skirts(phase) { return (KIT_HULLS || kitHulls()).skirts(phase); }
      function styledTop() { return (KIT_HULLS || kitHulls()).styledTop(); }

      /* ---- the aircraft: in iso-craft.js ---- */
      var KIT_CRAFT = null;
      function kitCraft() {
        return KIT_CRAFT || (KIT_CRAFT = MAKE_CRAFT({
          AIM: AIM, GLASS: GLASS, GLINT: GLINT, HF: HF, S3: S3, STEEL: STEEL, STEEL_LIT: STEEL_LIT, TB: TB,
          TS: TS, aerial: aerial, barrel: barrel, box: box, cos: cos, dark: dark, dead: dead,
          drawDamage: drawDamage, frameAt: frameAt, g: g, hull: hull, launcher: launcher, lift: lift,
          line: line, lit: lit, mixc: mixc, mount: mount, nearSide: nearSide, patch: patch,
          sEllipse: sEllipse, shape: shape, sin: sin, slabF: slabF, spec: spec, tone: tone, trim: trim, u: u
        }));
      }
      function drawCraft() { return (KIT_CRAFT || kitCraft()).drawCraft(); }

      /* ---- the walkers: in iso-mechs.js ---- */
      var KIT_MECHS = null;
      function kitMechs() {
        return KIT_MECHS || (KIT_MECHS = MAKE_MECHS({
          AIM: AIM, GLASS: GLASS, GLINT: GLINT, S3: S3, STEEL: STEEL, STEEL_LIT: STEEL_LIT, TB: TB, TS: TS,
          TT: TT, aerial: aerial, barrel: barrel, box: box, cos: cos, crossOn: crossOn, dead: dead,
          drawDamage: drawDamage, droneLamp: droneLamp, f: f, frameAt: frameAt, g: g, ground: ground,
          hexPanel: hexPanel, launcher: launcher, lift: lift, line: line, opts: opts, rectPts: rectPts,
          sEllipse: sEllipse, shape: shape, sin: sin, slabF: slabF, spec: spec, u: u, vents: vents
        }));
      }
      function mechHeights() { return (KIT_MECHS || kitMechs()).mechHeights(); }
      function drawMech() { return (KIT_MECHS || kitMechs()).drawMech(); }
      /* ---- the rotorcraft: in iso-rotors.js ---- */
      var KIT_ROTORS = null;
      function kitRotors() {
        return KIT_ROTORS || (KIT_ROTORS = MAKE_ROTORS({
          GLASS: GLASS, GLINT: GLINT, STEEL: STEEL, STEEL_LIT: STEEL_LIT, along: along, at: at, box: box,
          cos: cos, dark: dark, dead: dead, drawDamage: drawDamage, f: f, g: g, hull: hull, lift: lift,
          lit: lit, scr: scr, sin: sin, spec: spec, trim: trim
        }));
      }
      function drawRotorcraft() { return (KIT_ROTORS || kitRotors()).drawRotorcraft(); }

      /* Drone Control (p. 37): no crew, so the hull carries what flies it instead —
         a sensor dome on the roof towards the back, and a whip aerial beside it
         with a light on the tip. */
      /* Drawn as one of a styled hull's parts where it has them, so a turret in
         front of it hides it; otherwise last, over the hull. */
      var droneDone = false;
      function droneMark() { droneDone = true; }        // drawn on the turret already: not again
      function droneDue() { return u.drone && !dead && !/Turret/.test(u.group || ''); }
      function drawDrone(only) {
        if (droneDone || !droneDue()) return;
        if (!only) droneDone = true;
        droneKit(only);
      }
      // where the dome goes, as a point on the hull (for sorting it among the parts)
      function droneSpot() {
        var body = spec.style && spec.style.body, legs = driveOf(u) === 'walker' && !(u.transport && spec.style);
        if (body === 'pickup') return along(spec.len * (driveOf(u) !== 'wheeled' ? 0.35 : 0.05), -spec.wid * 0.22);
        if (body === 'guntruck') {
          var c = spec.style.flatCab ? 0.24 : spec.style.heavy ? 0.28 : 0.3;
          return along(spec.len * (0.5 - c * 0.71), -spec.wid * 0.22);
        }
        if (spec.craft === 'disc') return along(0, 0);
        if (spec.fly) return along(spec.len * 0.05, 0);
        if (legs) return along(-spec.len * 0.12, spec.wid * 0.3);
        var carS = spec.style && spec.style.body === 'car';
        return along(-spec.len * (carS ? 0.34 : 0.42), -spec.wid * (carS ? 0.26 : 0.34));
      }
      // `only`: 'dome' or 'aerial', when a styled hull sorts the two among its parts
      function droneKit(only) {
        var y5 = spec.heli ? lift + spec.hgt : top + (spec.deck ? spec.dHgt : 0);
        var legs = driveOf(u) === 'walker' && !(u.transport && spec.style);
        if (legs) return;                                      // a walker carries its own, on its shoulders
        var body = spec.style && spec.style.body;
        /* The dome: on a hull's roof off to one side, clear of a turret; on a
           pickup or gun truck, to one side of the flat plate where its cab used to
           be; on a walker, up on a shoulder; on a craft, the middle of its back. */
        // the back corner of the roof, opposite the aerial — kept on the roof, which narrows to the top
        var carB = spec.style && spec.style.body === 'car';
        var back = carB ? -0.34 : -0.42, off = -spec.wid * (carB ? 0.26 : 0.34);
        // a styled hull's roof is lower than its full height: sit on the roof itself
        if (spec.style && !spec.fly) {
          var stb = spec.style.body;
          y5 = deck + spec.hgt * ({ mbt: 0.8, tank: 0.88, ltank: 0.88, future: 0.9, ifv: 0.85, bigbox: 1.08, car: 1, pickup: 0.45, truck: 1.45, mlrs: 0.55, guntruck: 0.5 }[stb] || 1) -
            (stb === 'car' ? 2 : 0) + (stb === 'bigbox' ? spec.hgt * 0.3 : 0);
        }
        // a craft's back is measured from where it flies, not from a ground hull's ride height
        // a pickup or gun truck carries it to one side of the flat plate where its cab used to be
        if (body === 'pickup') { back = driveOf(u) !== 'wheeled' ? 0.35 : 0.05; off = -spec.wid * 0.22; y5 = deck + spec.hgt * 0.7; }
        else if (body === 'guntruck') {
          var cabL2 = spec.style.flatCab ? 0.24 : spec.style.heavy ? 0.28 : 0.3;
          back = 0.5 - cabL2 * 0.71; off = -spec.wid * 0.22; y5 = deck + spec.hgt * 0.78;
        }
        else if (spec.craft === 'disc') { back = 0; off = 0; y5 = lift + spec.hgt * 0.68; }     // on the disc's hump
        else if (spec.fly) { back = 0.12; off = 0; y5 = lift + spec.hgt * (spec.craft === 'jet' ? 0.9 : 0.86); }
        else if (legs) { back = -0.12; off = spec.wid * 0.3; }     // its right shoulder
        var dq = along(spec.len * back, off), dp = toScreen(dq.x, dq.y);
        var r = Math.max(3, K * 0.16) * (spec.craft === 'disc' ? 0.75 : 1), cy = dp.y - y5;
        if (only !== 'aerial') {
        ellipse(g, dp.x, cy + r * 0.15, r * 1.25, r * 0.6, '#14171c');               // the collar it sits in
        ellipse(g, dp.x, cy - r * 0.2, r, r * 0.85, '#aeb8c2');                      // the dome
        ellipse(g, dp.x, cy + r * 0.05, r, r * 0.45, '#7d8894');
        ellipse(g, dp.x - r * 0.35, cy - r * 0.5, r * 0.35, r * 0.25, 'rgba(255,255,255,.75)');
        ellipse(g, dp.x + r * 0.2, cy - r * 0.05, r * 0.28, r * 0.2, '#2a6f9a');     // the sensor behind the dome's skin
        }
        // a jet has no aerial: its light blinks on top of the dome instead (a disc's is the red eye on its emitter)
        if (only !== 'aerial' && spec.fly && spec.craft === 'jet') {
          // just ahead of the dome, on the spine towards the nose
          var lq = toScreen(along(spec.len * (back + 0.13), 0).x, along(spec.len * (back + 0.13), 0).y);
          droneLamp(lq.x, lq.y - y5 - 1.2);
        }
        if (only === 'dome') return;
        // the aerial, at the back: the rear corner of a hull or its bed, a craft's tail, behind a walker's dome
        var aq, ya = y5;
        if (spec.fly && (spec.craft === 'jet' || spec.craft === 'disc')) return;      // a jet or a disc carries the dome only
        if (spec.fly) aq = along(-spec.len * 0.06, spec.wid * 0.3);   // a rotorcraft's stands on the back of its body
        else if (legs) aq = along(spec.len * back - 0.2, -spec.wid * 0.3);   // its left shoulder
        else {
          aq = along(-spec.len * 0.44, spec.wid * 0.32);
          if (body === 'pickup' || body === 'guntruck') ya = deck + spec.hgt * 0.5;
        }
        var ap = toScreen(aq.x, aq.y), ay = ap.y - ya, ah = Math.max(10, K * 0.55);
        ellipse(g, ap.x, ay, 2, 1.2, STEEL);                   // its mount
        thickLine(g, ap.x, ay, ap.x + 1, ay - ah, 1.4, STEEL_LIT);
        droneLamp(ap.x + 1, ay - ah);
      }
      // the red light on a drone's aerial: it blinks, about once a second, and is out on a wreck
      function droneLamp(x, y) {
        var lit = !dead && Math.floor((root.performance ? performance.now() : 0) / 500) % 2 === 0;
        if (lit) ellipse(g, x, y, 3.6, 3.6, 'rgba(255,80,64,.28)');
        ellipse(g, x, y, 1.6, 1.6, lit ? '#ff5040' : '#5a1c16');
      }

      function drawDamage() {
        drawDrone();
        if (!u.damage || !u.str) return;
        var dr2 = rng((u.id || 'x').length * 977 + u.damage * 31);
        var y4 = spec.heli ? lift + spec.hgt : top + (spec.deck ? spec.dHgt : 0);
        for (var d = 0; d < u.damage * 4; d++) {
          var sx = at.x + (dr2() - 0.5) * spec.len * 0.8, sy = at.y + (dr2() - 0.5) * spec.wid * 0.8;
          var sp5 = toScreen(sx, sy);
          dot(g, sp5.x, sp5.y - y4, dr2() > 0.5 ? '#1a1410' : '#3a2e22', 2);
        }
      }
    }

    var MAKE_CRAFT = root.PMCIsoCraft({
      K: K, bandOnSides: bandOnSides, edge: edge, poly: poly
    });

    var MAKE_MECHS = root.PMCIsoMechs({
      ARM_FOR: ARM_FOR, HULL: HULL, K: K, SHOULDER_STYLE: SHOULDER_STYLE, edge: edge, poly: poly,
      project: project
    });

    var MAKE_HULLS = root.PMCIsoHulls({
      DRIVE: DRIVE, K: K, MACHINE: MACHINE, bandOnSides: bandOnSides, edge: edge, poly: poly, project: project
    });

    var MAKE_GEAR = root.PMCIsoGear({
      K: K, MACHINE: MACHINE, bandOnSides: bandOnSides, dot: dot, ellipse: ellipse, hull2d: hull2d,
      poly: poly, project: project, rect: rect, taper: taper, thickLine: thickLine, toScreen: toScreen
    });

    var MAKE_ROTORS = root.PMCIsoRotors({
      K: K, a: a, bandOnSides: bandOnSides, dot: dot, ellipseRing: ellipseRing, poly: poly, project: project,
      rect: rect, taper: taper, thickLine: thickLine, toScreen: toScreen
    });

    var MAKE_PLAINHULL = root.PMCIsoPlainHull({
      a: a, bandOnSides: bandOnSides, ellipse: ellipse, poly: poly, project: project, rect: rect,
      taper: taper, thickLine: thickLine
    });

    return {
      DRIVE: DRIVE,
      HULL: HULL,
      TEX_TILE: TEX_TILE,
      craftCentreUp: craftCentreUp,
      drawMachine: drawMachine,
      flyLift: flyLift,
      hullCache: hullCache,
      hullSpec: hullSpec,
      jetBurn: jetBurn,
      mountFor: mountFor,
      mounts: mounts,
      slab: slab,
      thickLine: thickLine
    };
  };
})(window);
