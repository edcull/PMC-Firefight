/* PMC 2670 — Firefight : the troopers: every man on the table drawn on a finer grid of his own - the figure in each pose, his kit by role, the army's colours and the dead and wounded - and the cache that keeps each one painted only once.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoTroops = function (B) {
    var ellipse = B.ellipse, K = B.K, PIXEL = B.PIXEL, corpses = B.corpses;

    /* ---------- unit sprites ----------
       Troopers are drawn on their own finer grid — one sprite pixel is one buffer
       pixel, so a model carries four times the detail of the ground art. Every
       surviving model in a unit is drawn, wearing the kit its unit type carries.
       Each variant is baked once into a small canvas and blitted after that. */

    var SU = Math.max(1, Math.round(PIXEL * K / 64));    // one sprite pixel
    /* Figures are baked at twice the plate's resolution and drawn at half size.
       The art is authored on a finer grid than one plate pixel — a trooper's torso
       is seventeen units wide — and at the old 1:1 bake it was squeezed into ten
       pixels and rounded, so most of that detail never reached the screen. Drawn
       into the board's working window at its full density, it now does. */
    var SPRITE_RES = 2;
    var SPR = { w: 96, h: 150, ox: 40, oy: 136 };          // cache canvas and its origin
    var RIDE_UP = { horse: 7 };                              // how much higher than on a bike a rider sits on each mount
    var MODEL = 0.6;                                     // how large a trooper stands on its base

    /* Company colours. A PMC picks its own; so did every mercenary outfit that ever
       wanted its work recognised. Each is a full ramp rather than a hue, because
       the sprites shade with it: `light` catches the sun, `mid` is the coat,
       `dark` is the shadow under it, `helm` the hard kit and `cloth` the webbing.
       `ink` is the colour the interface uses for that side's name and markers. */
    /* In the order the swatches show them: round the colour wheel from red to
       pink, then the neutrals. Desert ochre is the default wherever one is needed. */
    var COLOURS = {
      crimson:  { name: 'Crimson',       ink: '#d45a5a', light: '#d99090', mid: '#a04646', dark: '#4c1e1e', helm: '#843a3a', cloth: '#6b4040' },
      rust:     { name: 'Rust orange',   ink: '#d87a3a', light: '#dfa070', mid: '#a85f2c', dark: '#4e2a12', helm: '#8a4e24', cloth: '#6e4a2c' },
      ochre:    { name: 'Desert ochre',  ink: '#d8a13a', light: '#dcb673', mid: '#b1853a', dark: '#5f4620', helm: '#93702a', cloth: '#6b5c3a' },
      hazard:   { name: 'Hazard yellow', ink: '#f0d830', light: '#f4e66a', mid: '#d6c020', dark: '#5e5208', helm: '#bca812', cloth: '#7c7224' },
      olive:    { name: 'Olive drab',    ink: '#8fa858', light: '#a8b878', mid: '#6d7c43', dark: '#333b1f', helm: '#58663a', cloth: '#5e6742' },
      forest:   { name: 'Forest green',  ink: '#5cb85c', light: '#8fcf85', mid: '#3f8a3f', dark: '#1a3d1c', helm: '#2f6a31', cloth: '#355a36' },
      jade:     { name: 'Jade',          ink: '#5cbfa0', light: '#8fd4bd', mid: '#3f8f78', dark: '#1c4238', helm: '#2f6e5c', cloth: '#35584e' },
      steel:    { name: 'Steel blue',    ink: '#5aa9c8', light: '#9cc4d8', mid: '#52859c', dark: '#1f3d4b', helm: '#3d6e83', cloth: '#3d5566' },
      midnight: { name: 'Midnight',      ink: '#7b8bc4', light: '#93a1d0', mid: '#4c5a90', dark: '#1e2442', helm: '#3a4570', cloth: '#343c5e' },
      plum:     { name: 'Imperial plum', ink: '#a684c8', light: '#bfa2d6', mid: '#7f5fa0', dark: '#3a2a4c', helm: '#67508a', cloth: '#5a4770' },
      rose:     { name: 'Rose',          ink: '#e0709e', light: '#e8a0bf', mid: '#b04c78', dark: '#4e1e34', helm: '#8e3c60', cloth: '#6a4456' },
      sand:     { name: 'Bone white',    ink: '#d8cfb4', light: '#e4ddc6', mid: '#b3aa8c', dark: '#585244', helm: '#948c72', cloth: '#8a8268' },
      slate:    { name: 'Gunmetal',      ink: '#9aa7b6', light: '#aab6c4', mid: '#6b7684', dark: '#2c333c', helm: '#535d69', cloth: '#4e5661' },
      charcoal: { name: 'Charcoal black', ink: '#aab0b8', light: '#767c84', mid: '#484d54', dark: '#15181c', helm: '#2d3238', cloth: '#292d33' },
      // ten more, to make two dozen: each well clear of the others on the table
      maroon:   { name: 'Maroon',        ink: '#c0506a', light: '#c98090', mid: '#7e2e40', dark: '#38121c', helm: '#622434', cloth: '#553038' },
      khaki:    { name: 'Khaki',         ink: '#c8b888', light: '#d6c9a0', mid: '#a09068', dark: '#4a4230', helm: '#80734f', cloth: '#6e664e' },
      mud:      { name: 'Mud brown',     ink: '#b08860', light: '#c09c78', mid: '#80603e', dark: '#3a2a1a', helm: '#664c30', cloth: '#584636' },
      lime:     { name: 'Acid lime',     ink: '#b8e04a', light: '#cce67a', mid: '#8cb030', dark: '#3a4a10', helm: '#6e8c22', cloth: '#5e6e36' },
      teal:     { name: 'Deep teal',     ink: '#3cb4b4', light: '#78cccc', mid: '#2a8080', dark: '#0e3a3a', helm: '#1f6464', cloth: '#2e5656' },
      cobalt:   { name: 'Cobalt blue',   ink: '#4c7ce0', light: '#86a6e8', mid: '#3456a8', dark: '#12204c', helm: '#284486', cloth: '#303e66' },
      sky:      { name: 'Sky blue',      ink: '#8cc8f0', light: '#b4dcf6', mid: '#5e98c0', dark: '#223e56', helm: '#4a7ca0', cloth: '#4a647a' },
      violet:   { name: 'Violet',        ink: '#9a6ce8', light: '#b89cef', mid: '#6c44b4', dark: '#2a1650', helm: '#553490', cloth: '#4c3c6e' },
      magenta:  { name: 'Magenta',       ink: '#e050c8', light: '#e888d8', mid: '#a83096', dark: '#461040', helm: '#862478', cloth: '#643c5e' },
      arctic:   { name: 'Arctic white',  ink: '#e8eef4', light: '#f2f6fa', mid: '#c4ccd6', dark: '#5e6672', helm: '#a8b2be', cloth: '#9aa2ac' }
    };
    var COLOUR_KEYS = Object.keys(COLOURS);
    function colour(key) { return COLOURS[key] || COLOURS.ochre; }

    var PALETTE = {
      A: COLOURS.ochre,
      B: COLOURS.steel,
      C: COLOURS.steel
    };
    /* The page's own side colours (--side-A, --side-B: the army pills, titles and
       marks round the board) follow the armies' colours. */
    function paintPage(side) {
      if (typeof document === 'undefined' || !document.documentElement || side === 'C') return;
      document.documentElement.style.setProperty('--side-' + side, PALETTE[side].ink);
    }
    paintPage('A'); paintPage('B');
    /* Repaint a side. Everything that draws a unit reads PALETTE at draw time, so
       this takes effect on the next frame with nothing else to update — but the
       baked props hold no side colour, so nothing needs rebuilding either. */
    function setSideColour(side, key) {
      // C is a cooperative game's second player, on the same side as A
      if (side !== 'A' && side !== 'B' && side !== 'C') return;
      PALETTE[side] = colour(key);
      paintPage(side);
      // the baked figures carry the old colours: throw them away
      for (var k in sprites) if (k.charAt(0) === side) delete sprites[k];
      for (var k2 in corpses) if (k2.charAt(0) === side) delete corpses[k2];
    }
    var GUN = { dk: '#191d23', md: '#262b33', lt: '#3a424c', hot: '#e8c15a' };
    /* Rebel wardrobes. Each tint overrides part of the side palette, so the unit's
       own colour still shows on the armband, the beret and the shoulder. */
    /* The rebels dress in whatever they could find, but brightly: every rebel
       wardrobe goes through this, pushing the colour up and the grey out. */
    function vividHex(hex, sat, lit) { return vivid({ c: hex }, sat, lit).c; }
    function vivid(t, sat, lit) {
      function one(hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
        if (d) {
          s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
          h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
          h /= 6;
        }
        s = Math.min(0.9, s * sat + 0.06); l = Math.min(0.82, l * lit);
        function f(p, q, t2) { if (t2 < 0) t2 += 1; if (t2 > 1) t2 -= 1; return t2 < 1 / 6 ? p + (q - p) * 6 * t2 : t2 < 1 / 2 ? q : t2 < 2 / 3 ? p + (q - p) * (2 / 3 - t2) * 6 : p; }
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        var o = [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)];
        return '#' + o.map(function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
      }
      var out = {};
      for (var k in t) out[k] = typeof t[k] === 'string' && t[k].charAt(0) === '#' ? one(t[k]) : t[k];
      return out;
    }
    var REBEL_DRAB = { rebel: true, light: '#9a8a6c', mid: '#7a6b4f', dark: '#3f3828', helm: '#6a5c3f', cloth: '#8a5a3a' };
    var REBEL_FIELD = { rebel: true, light: '#7e8a67', mid: '#5f6b4a', dark: '#2f3722', helm: '#4e5a3a', cloth: '#6f7a54' };
    var REBEL_NIGHT = { rebel: true, light: '#565f66', mid: '#3c444b', dark: '#1c2024', helm: '#2e353b', cloth: '#333a40' };
    var REBEL_MINE = { rebel: true, light: '#c08b3a', mid: '#8f6626', dark: '#443014', helm: '#e0a33a', cloth: '#6d4e1e' };
    var REBEL_WORN = { rebel: true, light: '#8a8a7a', mid: '#69695c', dark: '#33332c', helm: '#565649', cloth: '#6b6255' };
    // armed civilians: whatever each of them was wearing that morning, all of it faded
    var CIV_A = { rebel: true, light: '#7d8a96', mid: '#5d6a76', dark: '#2f3740', helm: '#4e5560', cloth: '#6b5a44' };
    var CIV_B = { rebel: true, light: '#8f7a5e', mid: '#6e5a40', dark: '#3a2e20', helm: '#5a4a36', cloth: '#4a5a6a' };
    var CIV_C = { rebel: true, light: '#8a8a86', mid: '#6a6a66', dark: '#34342f', helm: '#55554f', cloth: '#7a4a3a' };
    var CIV_D = { rebel: true, light: '#8a5a58', mid: '#6a403e', dark: '#361f1e', helm: '#553432', cloth: '#5a6048' };
    var CIV_E = { rebel: true, light: '#7f8766', mid: '#61684a', dark: '#30341f', helm: '#4d543a', cloth: '#8a7a5a' };
    // holy warriors: long shirts in earth, grey-green and khaki, under dark waistcoats
    var HOLY_A = { rebel: true, light: '#a3927a', mid: '#80705a', dark: '#433a2c', helm: '#6a5c48', cloth: '#5a4c3a' };
    var HOLY_B = { rebel: true, light: '#8c9280', mid: '#6b7160', dark: '#363a2e', helm: '#565b4c', cloth: '#4a4a3c' };
    var HOLY_C = { rebel: true, light: '#b0a584', mid: '#8c8264', dark: '#474130', helm: '#6f674e', cloth: '#5c5440' };
    // as they used to look: the plain green field kit, helmets and pads included; only the flags carry the side's colour
    var FIELD_OCHRE = { rebel: true, light: '#7e8a67', mid: '#5f6b4a', dark: '#2f3722', helm: '#4e5a3a', cloth: '#6f7a54' };
    // the infected: what they wore, gone grey and damp; tinted as rebels so the fungus is bright
    var INFECT_A = { rebel: true, light: '#7a7e78', mid: '#5c605a', dark: '#2e312c', helm: '#4c504a', cloth: '#5e5a50' };
    var INFECT_B = { rebel: true, light: '#86806e', mid: '#666050', dark: '#34302a', helm: '#55503f', cloth: '#4e5458' };
    var INFECT_C = { rebel: true, light: '#6e7680', mid: '#525a62', dark: '#2a2e33', helm: '#434a50', cloth: '#6a5e50' };
    var IRR_OLIVE = { light: '#8a9068', mid: '#686e4a', dark: '#343822', helm: '#555b3c', cloth: '#7a6a4a' };
    var IRR_KHAKI = { light: '#b0a07a', mid: '#8c7c58', dark: '#463c28', helm: '#6e6244', cloth: '#5a6a4a' };
    var BOOT = '#15181d';
    var GLASS = '#12161c';

    /* what each model in a unit type carries */
    var ROLES = {
      command: ['officer', 'signals', 'rifle'],
      // the field command grades, each led by its commander in dress uniform
      command4: ['cmdr4', 'signals', 'cmdsmg'],
      command3: ['cmdr3', 'signals', 'cmdsmg'],
      // the larger command groups carry a spotter: their marks and hacks are called from his eyes
      command2: ['cmdr2', 'signals', 'cmdspotter', 'cmdsmg'],
      // the 1st grade and the high command have a warrant officer at the commander's side,
      // in the 4th grade commander's uniform (one of the SMG men makes way for him)
      command1: ['cmdr1', 'cmdr4', 'signals', 'cmdspotter', 'cmdsmg'],
      commandhi: ['cmdrhi', 'cmdr4', 'signals', 'cmdspotter', 'cmdsmg'],
      // rifle teams: the leader at the front right with an SMG, the SAW at the front left, riflemen behind
      rifle: ['riflelead', 'saw', 'rifleman'],
      veteran: ['vetlead', 'vetsaw', 'vet'],
      engineer: ['breacher', 'sapper'],
      lighteng: ['breacherlt', 'sapperlt'],
      rookie: ['rookielead', 'sawrk', 'riflemanrk'],
      // support teams: the standing men carry SMGs; the section has two guns down in front
      // the Light MG team: four machine guns and two men feeding them
      mg: ['gunner', 'gunner', 'gunner', 'gunner', 'loader', 'loader'],
      mgsec: ['gunner', 'gunner', 'loader'],
      sniper: ['marksman', 'spotter', 'lightinf'],
      // the sniper team alone goes in with night-vision goggles
      sniperteam: ['marksmannv', 'spotternv', 'sniperinf'],
      armour: ['armour'],
      // PMC drone units (p. 72): grey machines in human shape, a stripe of the company's colour across them
      dronecombat: ['drlead', 'drrifle'],
      droneassault: ['drsmg', 'drshotgun'],
      dronerecon: ['drscout', 'drscoutsmg'],
      droneengineer: ['drbreacher', 'drsapper'],
      dronesupport: ['drheavy'],
      dronemedic: ['drmedic', 'drcorpsman'],
      // the Protectors: the heaviest suits in the list, with and without jump packs
      protector: ['protector'],
      protectorhm: ['protectorhm'],
      // crew-served guns on tripods
      hmg: ['hmgunner', 'loader', 'supsmg'],
      gauss: ['gaussgunner', 'loader', 'supsmg'],
      medic: ['medic', 'corpsman'],
      observer: ['observer', 'lightinfrs'],
      recruit: ['recruit'],
      enforcer: ['riot'],
      // a leader in the side's colours, a gunner, and the rest in bandanas and boonies, mixed through the ranks
      irregular: ['irregular', 'irregular2', 'irregular3', 'irregular6', 'irregular4', 'irregular7', 'irregular5', 'irregular8'],
      penal: ['convict'],
      shock: ['shocklead', 'shockbreacher', 'shock'],
      // rangers and commandos: the veteran and assault kit, with night-vision goggles
      ranger: ['rangerlead', 'rangersaw', 'ranger'],
      commando: ['commandolead', 'commandobreacher', 'commando'],
      antitank: ['atgunner', 'atloader', 'supsmg'],
      // the missile-armed and SAM teams work a launcher set up on a tripod
      atgm: ['msloperator', 'atloader', 'supsmg', 'supsmg'],
      samlauncher: ['msloperator', 'atloader', 'supsmg', 'supsmg'],
      mortar: ['mortarman', 'mortarloader', 'mortarloader'],
      // the leader at the front right with an SMG
      nomad: ['nomadlead', 'nomad'],
      ew: ['ewop', 'signals'],
      chem: ['chem'],

      /* ---- the rebel army (pp. 96-104) ----
         Nothing matches. A revolt arms itself from what the colony had: hunting
         rifles, mining gear, work clothes and whatever the last ambush left behind. */
      // the leader at the front right with an SMG, the SAW at the front left, the rest mixed
      rebel: ['reblead', 'rebsaw', 'rebrifle', 'rebciv', 'rebmolotov', 'rebrifle', 'rebciv', 'rebrifle', 'rebciv', 'rebrifle'],
      // all ten different from their neighbours, the five kinds of clothes mixed through the ranks
      civilian: ['civ1', 'civ2', 'civ3', 'civ4', 'civ5', 'civ2', 'civ4', 'civ1', 'civ5', 'civ3'],
      // the Space Bugs: one caste to a unit, as the book fields them
      bug_tiny: ['btiny'], bug_small: ['bsmall'], bug_attack: ['battack'], bug_oversized: ['boversized'],
      bug_under: ['bunder'], bug_hugeunder: ['bhugeunder'],
      bug_spitlarva: ['bspitlarva'], bug_immspit: ['bimmspit'], bug_spitter: ['bspitter'], bug_spore: ['bspore'],
      bug_smallwing: ['bsmallwing'], bug_largewing: ['blargewing'],
      bug_smallpath: ['bsmallpath'], bug_path: ['bpath'], bug_lurker: ['blurker'],
      bug_watchlarva: ['bwatchlarva'], bug_immwatch: ['bimmwatch'], bug_watcher: ['bwatcher'], bug_overmind: ['bovermind'],
      // colonists the fungus has taken, still in what they were wearing
      infected: ['inf1', 'inf2', 'inf3', 'inf4', 'inf5'],
      // the Xenotripods: Crocks by caste and grade, and their Esh-Aven
      x_alpha1: ['xalphaP', 'xalphaR'], x_alpha2: ['xalpha', 'xalphaR'], x_alpha3: ['xalpha', 'xalphaR'],
      x_alpha4: ['xalpha', 'xalphaR'], x_alpha5: ['xalpha', 'xalphaR'],
      x_beta2: ['xbeta'], x_beta3: ['xbeta'], x_beta4: ['xbetacloak'],
      x_gamma3: ['xgamma'], x_gamma4: ['xgamma'], x_gamma5: ['xgammacloak'],
      // the Deltas' SMGs: the leader's alone at Low grade, two in the squad at Core
      x_delta1: ['xdelta'], x_delta2: ['xdeltasmg', 'xdelta'], x_delta3: ['xdeltasmg', 'xdeltasmg', 'xdelta'],
      x_eps1: ['esh1', 'esh1b'], x_eps2: ['esh2'], x_eps3: ['esh3'], x_eps4: ['esh4'], x_eps5: ['esh5'],
      // hardened insurgents: the guard's green field kit, with helmets in the side's colour
      insurgent: ['hardlead', 'hardsaw', 'hardrifle'],
      holy: ['zealot', 'flagellant', 'zealot2'],
      /* the holy warriors by standing: acolytes are boys in long shirts; the
         fanatics wear the turban and a rig; the enlightened go in black with a
         green sash; the mujahideen are veterans, faces wrapped, heavy weapons in
         the ranks */
      holy1: ['acolyte', 'acolyte2'],
      // fanatics: tan robes and turbans, one of them with an RPG
      holy2: ['zealot', 'zealotrpg', 'zealot2', 'zealot'],
      // the enlightened: a mix of tan and olive, one RPG among them; turbans as the fanatics
      // wind them — tan, the leader's white and one black
      holy3: ['enlightlead', 'enlightrpg', 'enlight2', 'enlightblack', 'enlight2', 'enlight'],
      // the mujahideen: all in olive
      holy4: ['mujlead', 'mujsaw', 'mujrpg', 'muj'],
      guard: ['guardlead', 'guardflag', 'guardrifle', 'guardrifle'],
      /* The Mounted Warriors dress as the Holy Warriors of their standing: a rider
         gang as acolytes, rider warriors as fanatics, hellriders as the
         enlightened, and the legendary hellriders as mujahideen. */
      /* the riders, a step up the list each: armed civilians on their own bikes,
         then the young bikers, then the turbaned riders, and the Legendary
         Hellriders in what the Hellriders wore, a rocket launcher among them */
      // rider: the Militia's figures, mounted — built under KIT
      ridergang: ['civrider1', 'civrider2', 'civrider3', 'civrider4'],
      hellrider: ['rider', 'rider', 'riderblack', 'rider'],
      // the legendary hellriders are the mujahideen in the saddle, man for man
      legendrider: ['hellriderlead', 'hellrider', 'hellriderrpg', 'hellridertan'],
      rebac: ['rebacgunner', 'rebloader', 'rebrifle'],
      rebhac: ['rebacgunner', 'rebloader', 'gunloader'],
      // three light machine guns, the rest of the squad with sub-machine guns (the guns alone do the shooting)
      rebelmg: ['rebgunner', 'rebgunner', 'rebgunner', 'rebsmg', 'rebsmg', 'rebsmg'],
      rebelat: ['rebrpg', 'rebrpg', 'rebrpgloader', 'rebrifle'],
      rebelmortar: ['rebmortarman', 'rebmortarloader'],
      rebelgun: ['guncaptain', 'gunloader'],
      partisan: ['partlead', 'partisan'],
      // assault commandos carry two squad automatics; sabotage commandos go hung with grenades
      partassault: ['partlead', 'partsaw', 'partsaw', 'partisan'],
      partsabotage: ['partlead', 'partsapper'],
      partisansniper: ['partmarksman', 'partspotter'],
      miner: ['cutter', 'blaster'],
      hardsuit: ['hardsuit'],
      deserter: ['deserter', 'dessaw', 'desrifle'],
      // conscripts, still with the old wooden-furnitured rifles they were issued
      conscript: ['conscript', 'conscript2'],
      pow: ['pow', 'pow2'],
      /* The leader himself grows grander up the Tiers: an acolyte with a rifle
         (Instigators), a fanatic in tan and then in olive (Secondary and Insurgent
         leaders), one of the enlightened with the side's sash and no weapon at all
         (Influential leaders), and at the top a man in a black turban and the
         side's sash, a gold-hilted blade at his belt, with the Insurgent leader's
         figure beside him as his second (Rebellion leaders). The Insurgent leader's turban is white. */
      leader: ['lead1', 'standard', 'guardrifle'],
      // insurgent leaders fly a small flag in the side's colour; the great leaders a large one
      leadersmall: ['lead2', 'flagsmall', 'guardrifle'],
      // insurgent leaders carry the same big flag as the influential ones
      leadermid: ['lead3', 'flagbig', 'guardrifle'],
      leaderbig: ['lead4', 'flagbig', 'guardrifle', 'guardrifle'],
      // the Rebellion's leader has a second at his side: the Insurgent leader's figure
      leaderhuge: ['lead5', 'flaghuge', 'lead3black', 'guardrifle'],
      // the Riders upgrade (p. 93) puts the same troops on bikes and beasts
      // holymounted … holy4mounted and leadermounted … leaderhugemounted: built from the tier's own figures, under KIT
    };
    function roleAt(art, i) {
      var r = ROLES[art] || ROLES.rifle;
      return r[Math.min(i, r.length - 1)];
    }

    // kit per role: helmet, weapon, pack, build
    // the drones' plating: gunmetal grey all over
    // the drone squads' mechanical parts
    var RB = { strut: '#555c65', joint: '#2a2e34', piston: '#a3aab3', foot: '#383d44', eye: '#5fe0ff' };
    var DRONE_GREY = { light: '#b9c0c8', mid: '#7f8791', dark: '#3b4047', helm: '#6c747e', cloth: '#5b626b', skin: '#8a929c', skinDark: '#5d646d' };
    var KIT = {
      drrifle: { helm: 'bot', gun: 'battlerifle', pack: 'none', tint: DRONE_GREY, forcePad: true, robot: true },
      drlead: { helm: 'bot', gun: 'saw', pack: 'none', tint: DRONE_GREY, forcePad: true, robot: true },
      drsmg: { helm: 'bot', gun: 'smg', pack: 'none', tint: DRONE_GREY, forcePad: true, robot: true, vest: true },
      drshotgun: { helm: 'bot', gun: 'smg', pack: 'none', tint: DRONE_GREY, forcePad: true, robot: true, vest: true },
      drscout: { helm: 'bot', gun: 'optics', pack: 'dish', tint: DRONE_GREY, forcePad: true, robot: true, kneel: true, pouches: '#5d6e3a' },
      drscoutsmg: { helm: 'bot', gun: 'rifle', pack: 'none', tint: DRONE_GREY, forcePad: true, robot: true, pouches: '#5d6e3a' },
      drbreacher: { helm: 'bot', gun: 'pistol', pack: 'charges', tint: DRONE_GREY, forcePad: true, robot: true },
      drsapper: { helm: 'bot', gun: 'pistol', pack: 'charges', tint: DRONE_GREY, forcePad: true, robot: true },
      drheavy: { helm: 'bot', gun: 'heavy', shoulderGL: true, shoulderMsl: true, pack: 'none', tint: DRONE_GREY, forcePad: true, robot: true, bulk: 1 },
      drmedic: { helm: 'bot', gun: 'case', pack: 'medic', tint: DRONE_GREY, forcePad: true, robot: true, kneel: true, badge: '#e8f0f6' },
      drcorpsman: { helm: 'bot', gun: 'pistol', pack: 'medic', tint: DRONE_GREY, forcePad: true, robot: true, badge: '#e8f0f6' },
      // line infantry: battle rifles, with a squad automatic in the front rank
      rifle: { helm: 'std', gun: 'battlerifle', pack: 'std' },
      rifleman: { helm: 'std', gun: 'battlerifle', pack: 'std' },
      saw: { helm: 'std', gun: 'saw', pack: 'ammo' },
      riflelead: { helm: 'std', gun: 'smg', pack: 'std', fitAs: 'rifle' },
      vet: { helm: 'heavy', gun: 'battlerifle', pack: 'std', bulk: 1, mark: true },
      vetsaw: { helm: 'heavy', gun: 'saw', pack: 'ammo', bulk: 1, mark: true },
      vetlead: { helm: 'heavy', gun: 'smg', pack: 'std', bulk: 1, mark: true },
      officer: { helm: 'cap', gun: 'slate', pack: 'std', badge: '#e8c15a' },
      signals: { helm: 'std', gun: 'pistol', pack: 'radio', fitAs: 'rifle' },
      // the field command's escort: carbines rather than rifles
      cmdsmg: { helm: 'std', gun: 'smg', pack: 'std', fitAs: 'rifle' },
      cmdspotter: { helm: 'std', gun: 'optics', pack: 'std', kneel: true, fitAs: 'rifle' },
      supsmg: { helm: 'std', gun: 'smg', pack: 'std', fitAs: 'rifle' },
      /* the field command's commanders, in dress uniform that grows grander with the grade */
      cmdr4: { helm: 'sidecap', gun: 'pistol', pack: 'none', dress: 1 },
      cmdr3: { helm: 'sidecap', gun: 'pistol', pack: 'none', dress: 2 },
      cmdr2: { helm: 'peaked', gun: 'pistol', pack: 'none', dress: 3 },
      cmdr1: { helm: 'peaked', gun: 'pistol', pack: 'none', dress: 4 },
      cmdrhi: { helm: 'peaked', gun: 'pistol', pack: 'none', dress: 5, goldpeak: true },
      // assault troops go in with shotguns and submachine guns
      sapper: { helm: 'welder', gun: 'smg', pack: 'charges', vest: true },
      // rookies, light engineers, recruits and observers: shirt sleeves rolled up
      sawrk: { helm: 'std', gun: 'saw', pack: 'ammo' , sleeves: 'rolled' },
      rookielead: { helm: 'std', gun: 'smg', pack: 'std', sleeves: 'rolled', fitAs: 'rifle' },
      riflemanrk: { helm: 'std', gun: 'battlerifle', pack: 'std' , sleeves: 'rolled' },
      breacherlt: { helm: 'welder', gun: 'shotgun', pack: 'charges', vest: true , sleeves: 'rolled' },
      sapperlt: { helm: 'welder', gun: 'smg', pack: 'charges', vest: true , sleeves: 'rolled' },
      breacher: { helm: 'welder', gun: 'shotgun', pack: 'charges', vest: true },
      gunner: { helm: 'std', gun: 'mg', pack: 'none', kneel: true, bulk: 1 },
      loader: { helm: 'std', gun: 'pistol', pack: 'ammo', kneel: true },
      marksman: { helm: 'hood', gun: 'long', pack: 'none', prone: true, pouches: '#5d6e3a' },
      marksmannv: { helm: 'hood', gun: 'long', pack: 'none', prone: true, pouches: '#5d6e3a', nvg: true },
      spotter: { helm: 'hood', gun: 'optics', pack: 'std', kneel: true, pouches: '#5d6e3a' },
      spotternv: { helm: 'hood', gun: 'optics', pack: 'std', kneel: true, pouches: '#5d6e3a', nvg: true },
      armour: { helm: 'sealed', gun: 'heavy', pack: 'none', bulk: 2, armoured: true },
      // the Protectors: battle armour with a grenade box on the shoulder, the sealed helm bare;
      // the hi-mobility squad keeps its night-vision goggles
      protector: { helm: 'sealed', gun: 'heavy', shoulderGL: true, pack: 'none', bulk: 2, armoured: true },
      protectorhm: { helm: 'sealed', gun: 'heavy', shoulderGL: true, pack: 'jetpack', bulk: 2, armoured: true, nvg: true },
      medic: { helm: 'std', gun: 'case', pack: 'medic', kneel: true, badge: '#e8f0f6' },
      corpsman: { helm: 'std', gun: 'pistol', pack: 'medic', badge: '#e8f0f6' },
      observer: { helm: 'hood', gun: 'optics', pack: 'dish', prone: true, pouches: '#5d6e3a' , sleeves: 'rolled' },
      // sharpshooters and observers are the same light infantry: hooded, low,
      // one specialist on his belly and the rest of the team covering him
      lightinf: { helm: 'hood', gun: 'rifle', pack: 'std', kneel: true, pouches: '#5d6e3a' },
      sniperinf: { helm: 'hood', gun: 'rifle', pack: 'std', kneel: true, pouches: '#5d6e3a' , nvg: true },
      lightinfrs: { helm: 'hood', gun: 'rifle', pack: 'std', kneel: true, pouches: '#5d6e3a' , sleeves: 'rolled' },
      // raw levies and the cheap end of the contract
      recruit: { helm: 'cap', gun: 'rifle', pack: 'none', sleeves: 'rolled' },
      riot: { helm: 'riot', gun: 'shotgun', pack: 'none', bulk: 1, shield: true },
      // gangers and free companies: rifles, a bandolier, and not much else
      // the leader dressed as the bandana men, in khaki, with an SMG and more webbing than the
      // rest; every man of them with the company's armband
      irregular: { helm: 'bandana', gun: 'smg', pack: 'none', light: true, band: '#7a2e28', webbing: true, armband: 'force', tint: IRR_KHAKI },
      irregular2: { helm: 'boonie', gun: 'saw', pack: 'none', light: true, bandolier: true, armband: 'force', tint: IRR_OLIVE },
      irregular3: { helm: 'bandana', gun: 'smg', pack: 'none', light: true, band: '#7a2e28', armband: 'force', tint: IRR_KHAKI },
      irregular4: { helm: 'bandana', gun: 'smg', pack: 'none', light: true, band: '#7a2e28', armband: 'force', tint: IRR_KHAKI },
      irregular5: { helm: 'bandana', gun: 'smg', pack: 'none', light: true, band: '#7a2e28', armband: 'force', tint: IRR_KHAKI },
      irregular6: { helm: 'boonie', gun: 'smg', pack: 'none', light: true, armband: 'force', tint: IRR_OLIVE },
      irregular7: { helm: 'boonie', gun: 'smg', pack: 'none', light: true, armband: 'force', tint: IRR_OLIVE },
      irregular8: { helm: 'boonie', gun: 'smg', pack: 'none', light: true, armband: 'force', tint: IRR_OLIVE },
      nomad: { helm: 'nomadhood', gun: 'battlerifle', pack: 'std', cloak: true },
      nomadlead: { helm: 'nomadhood', gun: 'smg', pack: 'std', cloak: true, fitAs: 'nomad' },
      // penal troops: orange coveralls, a collar, and the company's armband
      convict: { helm: 'bare', gun: 'carbine', pack: 'none', collar: true, light: true, armband: 'force',
        tint: { light: '#dd8f43', mid: '#bd6c2c', dark: '#6b3a15', helm: '#a05520', cloth: '#8a5a2a' } },
      // the heavy end of the assault troops
      shocklead: { helm: 'welder', gun: 'smg', pack: 'charges', bulk: 1, mark: true, vest: true },
      shockbreacher: { helm: 'welder', gun: 'shotgun', pack: 'charges', bulk: 1, vest: true },
      shock: { helm: 'welder', gun: 'smg', pack: 'charges', bulk: 1, vest: true },
      ranger: { helm: 'heavy', gun: 'battlerifle', pack: 'std', bulk: 1, mark: true, nvg: true },
      rangersaw: { helm: 'heavy', gun: 'saw', pack: 'ammo', bulk: 1, mark: true, nvg: true },
      rangerlead: { helm: 'heavy', gun: 'smg', pack: 'std', bulk: 1, mark: true, nvg: true },
      commandolead: { helm: 'welder', gun: 'smg', pack: 'charges', bulk: 1, mark: true, vest: true, nvg: true },
      commandobreacher: { helm: 'welder', gun: 'shotgun', pack: 'charges', bulk: 1, vest: true, nvg: true },
      commando: { helm: 'welder', gun: 'smg', pack: 'charges', bulk: 1, vest: true, nvg: true },
      // crew-served weapons
      atgunner: { helm: 'std', gun: 'atlauncher', pack: 'none', kneel: true },
      atloader: { helm: 'std', gun: 'pistol', pack: 'missile', kneel: true },
      mortarman: { helm: 'std', gun: 'none', pack: 'none', kneel: true },
      hmgunner: { helm: 'std', gun: 'none', pack: 'none', kneel: true, bulk: 1 },
      msloperator: { helm: 'std', gun: 'none', pack: 'none', kneel: true },
      gaussgunner: { helm: 'heavy', gun: 'none', pack: 'minerpack', kneel: true, bulk: 1 },
      mortarloader: { helm: 'std', gun: 'shell', pack: 'mortarbase', kneel: true },
      ewop: { helm: 'cap', gun: 'console', pack: 'dish', kneel: true },
      chem: { helm: 'mask', gun: 'flamer', pack: 'tanks' },

      /* ---- rebels ----
         Work clothes under a scavenged webbing rig, a red armband, and a weapon
         that was somebody else's a week ago. The unit colour still reads, because
         a revolt wears its colours where everyone can see them. */
      rebciv: { helm: 'std', gun: 'huntingrifle', forceHelm: true, pack: 'none', ragged: true, tint: REBEL_DRAB },
      /* Bugs: `bug` names the body painted, `big` how tall it stands against a
         man, `mz` where its spit leaves it; `fly` lifts it off the ground. */
      btiny: { bug: 'tiny', big: 0.36, mz: [20, -4] },
      bsmall: { bug: 'small', big: 0.5, mz: [18, -14] },
      battack: { bug: 'attack', big: 0.95, mz: [20, -40] },
      boversized: { bug: 'oversized', big: 1.12, mz: [22, -44] },
      bunder: { bug: 'under', big: 0.46, mz: [18, -21] },
      bhugeunder: { bug: 'hugeunder', big: 0.6, mz: [23, -27] },
      bspitlarva: { bug: 'spitlarva', big: 0.36, mz: [14, -6] },
      bimmspit: { bug: 'immspit', big: 0.6, mz: [24, -24] },
      bspitter: { bug: 'spitter', big: 0.8, mz: [30, -30] },
      bspore: { bug: 'spore', big: 0.95, mz: [16, -22] },
      bsmallwing: { bug: 'smallwing', big: 0.6, mz: [10, -12], fly: true },
      blargewing: { bug: 'largewing', big: 0.76, mz: [12, -15], fly: true },
      bsmallpath: { bug: 'smallpath', big: 0.62, mz: [11, -20] },
      bpath: { bug: 'path', big: 0.74, mz: [12, -22] },
      blurker: { bug: 'lurker', big: 0.6, mz: [15, -17] },
      bwatchlarva: { bug: 'watchlarva', big: 0.42, mz: [12, -10] },
      bimmwatch: { bug: 'immwatch', big: 0.64, mz: [14, -22] },
      bwatcher: { bug: 'watcher', big: 0.86, mz: [16, -26] },
      bovermind: { bug: 'overmind', big: 1.1, mz: [20, -34] },
      /* Xenotripods: `xeno` names the body painted — a Crock of a caste, or an
         Esh-Aven — `big` how tall it stands against a man, `mz` its muzzle. */
      xalphaP: { xeno: 'crock', rank: 'alpha', gold: true, gun: 'energy', big: 1.08, mz: [23, -32] },
      xalpha: { xeno: 'crock', rank: 'alpha', gold: true, gun: 'staff', big: 1.11, mz: [17, -55] },
      xalphaR: { xeno: 'crock', rank: 'alpha', gold: true, gun: 'energy', big: 1.08, mz: [23, -32] },
      xbeta: { xeno: 'crock', rank: 'beta', gun: 'energy', big: 1.1, mz: [26, -32] },
      xbetacloak: { xeno: 'crock', rank: 'beta', gun: 'energy', cloak: true, fitAs: 'xbeta', big: 1.1, mz: [26, -32] },
      xgamma: { xeno: 'crock', rank: 'gamma', gun: 'launcher', big: 1.1, mz: [32, -43] },
      xgammacloak: { xeno: 'crock', rank: 'gamma', gun: 'launcher', cloak: true, fitAs: 'xgamma', big: 1.1, mz: [32, -43] },
      xdelta: { xeno: 'crock', rank: 'delta', gun: 'blades', big: 1.06, mz: [31, -50] },
      // a Delta with an energy SMG in both hands, and no blade
      xdeltasmg: { xeno: 'crock', rank: 'delta', gun: 'xsmg', fitAs: 'xdelta', big: 1.06, mz: [27, -29] },
      esh1: { xeno: 'esh', gun: 'blade', big: 0.9, mz: [22, -40] },
      esh1b: { xeno: 'esh', gun: 'spear', big: 0.9, mz: [32, -47] },
      esh2: { xeno: 'esh', gun: 'slug', big: 0.9, mz: [27, -37] },
      esh3: { xeno: 'esh', gun: 'slug', plates: true, big: 0.92, mz: [27, -37] },
      esh4: { xeno: 'esh', gun: 'gauss', plates: true, big: 0.92, mz: [30, -37] },
      esh5: { xeno: 'esh', gun: 'gaussflame', plates: true, big: 0.94, mz: [30, -37] },
      // the infected: bare hands, greyed clothes, the army's colour growing out of them
      inf1: { helm: 'bare', gun: 'none', pack: 'none', ragged: true, fungus: 1, tint: INFECT_A },
      inf2: { helm: 'bare', gun: 'none', pack: 'none', ragged: true, fungus: 2, tint: INFECT_B },
      inf3: { helm: 'bare', gun: 'none', pack: 'none', ragged: true, fungus: 3, tint: INFECT_C },
      inf4: { helm: 'bare', gun: 'none', pack: 'none', ragged: true, fungus: 4, tint: INFECT_A },
      inf5: { helm: 'bare', gun: 'none', pack: 'none', ragged: true, fungus: 2, tint: INFECT_B },
      civ1: { helm: 'bare', gun: 'huntingrifle', pack: 'none', ragged: true, armband: 'force', tint: CIV_A },
      civ2: { helm: 'cap', gun: 'pistol', pack: 'none', ragged: true, armband: 'force', tint: CIV_B },
      civ3: { helm: 'bandana', gun: 'carbine', pack: 'none', armband: 'force', band: '#4a5560', tint: CIV_C },
      civ4: { helm: 'bare', gun: 'shotgun', pack: 'none', ragged: true, armband: 'force', tint: CIV_D },
      civ5: { helm: 'scarf', gun: 'huntingrifle', pack: 'none', armband: 'force', tint: CIV_E },
      civrider1: { mount: true, helm: 'bare', gun: 'huntingrifle', pack: 'none', ragged: true, armband: 'force', tint: CIV_A },
      civrider2: { mount: true, helm: 'cap', gun: 'pistol', pack: 'none', ragged: true, armband: 'force', tint: CIV_B },
      civrider3: { mount: true, helm: 'bandana', gun: 'carbine', pack: 'none', armband: 'force', band: '#4a5560', tint: CIV_C },
      civrider4: { mount: true, helm: 'bare', gun: 'shotgun', pack: 'none', ragged: true, armband: 'force', tint: CIV_D },
      rebrifle: { helm: 'std', gun: 'battlerifle', forceHelm: true, pack: 'none', ragged: true, tint: REBEL_DRAB },
      reblead: { helm: 'std', gun: 'smg', forceHelm: true, pack: 'none', ragged: true, mark: true, tint: REBEL_DRAB, fitAs: 'rebrifle' },
      rebsaw: { helm: 'std', gun: 'saw', forceHelm: true, pack: 'ammo', ragged: true, tint: REBEL_DRAB, fitAs: 'rebrifle' },
      rebmolotov: { helm: 'std', gun: 'molotov', forceHelm: true, pack: 'none', ragged: true, tint: REBEL_DRAB },
      inslead: { helm: 'std', gun: 'battlerifle', forceHelm: true, pack: 'none', mark: true, tint: REBEL_FIELD },
      insrifle: { helm: 'std', gun: 'battlerifle', forceHelm: true, pack: 'std', tint: REBEL_FIELD },
      // the revolutionary guard: ochre fatigues, the helmet and the flag in the side's colour
      guardlead: { helm: 'beret', gun: 'battlerifle', pack: 'none', mark: true, tint: FIELD_OCHRE },
      guardrifle: { helm: 'beret', gun: 'battlerifle', pack: 'std', tint: FIELD_OCHRE },
      hardlead: { helm: 'std', forceHelm: true, gun: 'smg', pack: 'none', mark: true, tint: FIELD_OCHRE },
      hardsaw: { helm: 'std', forceHelm: true, gun: 'saw', pack: 'ammo', tint: FIELD_OCHRE },
      hardrifle: { helm: 'std', forceHelm: true, gun: 'battlerifle', pack: 'std', tint: FIELD_OCHRE },
      guardflag: { helm: 'beret', gun: 'flagsmall', pack: 'std', tint: FIELD_OCHRE, fitAs: 'guardrifle' },
      // holy warriors: robes, a blade, and no interest whatever in cover
      zealot: { helm: 'turban', gun: 'carbine', armband: 'force', pack: 'none', tunic: true, wrap: '#d6ceb8', vest: '#3b3a30', tint: HOLY_A },
      flagellant: { helm: 'pakol', gun: 'rpg', armband: 'force', pack: 'none', tunic: true, vest: '#2f3a34', tint: HOLY_B },
      zealot2: { helm: 'turban', gun: 'carbine', armband: 'force', pack: 'none', tunic: true, wrap: '#26262a', vest: '#4a3a2a', tint: HOLY_C },
      acolyte: { helm: 'pakol', gun: 'smg', armband: 'force', pack: 'none', tunic: true, vest: HOLY_A.mid, young: true, tint: HOLY_A },
      acolyte2: { helm: 'bare', gun: 'huntingrifle', armband: 'force', pack: 'none', tunic: true, vest: HOLY_C.mid, young: true, tint: HOLY_C },
      // one fanatic carries the RPG; the rest are the same tan robes and turbans
      zealotrpg: { helm: 'turban', gun: 'rpg', armband: 'force', pack: 'none', tunic: true, wrap: '#d6ceb8', vest: '#3b3a30', tint: HOLY_A },
      enlightrpg: { helm: 'turban', gun: 'rpg', armband: 'force', pack: 'none', tunic: true, wrap: '#d6ceb8', vest: '#22241e', tint: HOLY_B },
      enlight: { helm: 'turban', gun: 'battlerifle', armband: 'force', pack: 'std', tunic: true, wrap: '#d6ceb8', vest: '#22241e', sash: '#2e7a3a', bandolier: true, tint: HOLY_B },
      enlightlead: { helm: 'turban', gun: 'smg', armband: 'force', pack: 'std', tunic: true, wrap: '#d6ceb8', vest: '#22241e', sash: '#2e7a3a', bandolier: true, mark: true, tint: HOLY_B },
      enlightblack: { helm: 'turban', gun: 'battlerifle', armband: 'force', pack: 'std', tunic: true, wrap: '#1c1c1e', vest: '#22241e', sash: '#2e7a3a', bandolier: true, tint: HOLY_B },
      enlight2: { helm: 'turban', gun: 'battlerifle', armband: 'force', pack: 'none', tunic: true, wrap: '#d6ceb8', vest: '#22241e', sash: '#2e7a3a', tint: HOLY_A },
      mujlead: { helm: 'turban', gun: 'smg', armband: 'force', pack: 'std', tunic: true, wrap: '#141416', vest: '#1c1e18', sash: '#2e7a3a', facewrap: true, mark: true, bulk: 1, tint: HOLY_B },
      mujsaw: { helm: 'turban', gun: 'saw', armband: 'force', pack: 'ammo', tunic: true, wrap: '#141416', vest: '#1c1e18', facewrap: true, bandolier: true, bulk: 1, tint: HOLY_B },
      mujrpg: { helm: 'turban', gun: 'rpg', armband: 'force', pack: 'none', tunic: true, wrap: '#141416', vest: '#1c1e18', facewrap: true, tint: HOLY_B },
      muj: { helm: 'turban', gun: 'battlerifle', armband: 'force', pack: 'std', tunic: true, wrap: '#141416', vest: '#1c1e18', sash: '#2e7a3a', facewrap: true, bandolier: true, tint: HOLY_B },
      // mounted warriors, over the tank of a stripped-down bike
      // rider warriors: the fanatics' tan robes and pale turbans, one of them black
      rider: { helm: 'turban', gun: 'carbine', pack: 'none', mount: true, tunic: true, wrap: '#d6ceb8', vest: '#3b3a30', armband: 'force', tint: HOLY_A },
      riderblack: { helm: 'turban', gun: 'carbine', pack: 'none', mount: true, tunic: true, wrap: '#26262a', vest: '#4a3a2a', armband: 'force', tint: HOLY_C },
      // the gang: open-face biker helmets and black leathers
      // a rider gang: the acolytes' long tan shirts, a round cap or nothing on the head
      // hellriders: spiked helmets, spiked shoulders, flames on the tank and a heavy gun
      // hellriders: the enlightened's tan and olive and green sash, turbans tan, the leader's white, one black
      hellrider: { helm: 'turban', gun: 'mg', pack: 'none', mount: true, bulk: 1, tunic: true, wrap: '#d6ceb8', vest: '#22241e', sash: '#2e7a3a', bandolier: true, armband: 'force', tint: HOLY_B },
      hellriderlead: { helm: 'turban', gun: 'mg', pack: 'none', mount: true, bulk: 1, tunic: true, wrap: '#d6ceb8', vest: '#22241e', sash: '#2e7a3a', bandolier: true, mark: true, armband: 'force', tint: HOLY_B },
      hellriderblack: { helm: 'turban', gun: 'mg', pack: 'none', mount: true, bulk: 1, tunic: true, wrap: '#1c1c1e', vest: '#22241e', sash: '#2e7a3a', bandolier: true, armband: 'force', tint: HOLY_B },
      hellridertan: { helm: 'turban', gun: 'mg', pack: 'none', mount: true, bulk: 1, tunic: true, wrap: '#d6ceb8', vest: '#22241e', sash: '#2e7a3a', armband: 'force', tint: HOLY_A },
      hellriderrpg: { helm: 'turban', gun: 'rpg', pack: 'none', mount: true, bulk: 1, tunic: true, wrap: '#1c1c1e', vest: '#22241e', sash: '#2e7a3a', armband: 'force', tint: HOLY_B },
      legendlead: { helm: 'turban', mount: true, gun: 'battlerifle', armband: 'force', pack: 'none', tunic: true, wrap: '#141416', vest: '#1c1e18', sash: '#2e7a3a', facewrap: true, mark: true, bulk: 1, tint: HOLY_B },
      legendsaw: { helm: 'turban', mount: true, gun: 'saw', armband: 'force', pack: 'none', tunic: true, wrap: '#141416', vest: '#1c1e18', facewrap: true, bandolier: true, bulk: 1, tint: HOLY_B },
      legendrpg: { helm: 'turban', mount: true, gun: 'rpg', armband: 'force', pack: 'none', tunic: true, wrap: '#141416', vest: '#1c1e18', facewrap: true, tint: HOLY_B },
      legendrider: { helm: 'turban', mount: true, gun: 'battlerifle', armband: 'force', pack: 'none', tunic: true, wrap: '#141416', vest: '#1c1e18', sash: '#2e7a3a', facewrap: true, bandolier: true, tint: HOLY_B },
      // scavenged heavy weapons, worked without much training
      rebgunner: { helm: 'std', gun: 'mg', forceHelm: true, pack: 'none', kneel: true, bulk: 1, ragged: true, tint: REBEL_DRAB },
      rebloader: { helm: 'std', gun: 'pistol', forceHelm: true, pack: 'ammo', kneel: true, ragged: true, tint: REBEL_DRAB },
      rebsmg: { helm: 'std', gun: 'smg', forceHelm: true, pack: 'ammo', kneel: true, ragged: true, tint: REBEL_DRAB, fitAs: 'rebrifle' },
      rebrpg: { helm: 'std', gun: 'rpg', forceHelm: true, pack: 'none', kneel: true, ragged: true, tint: REBEL_DRAB },
      rebrpgloader: { helm: 'std', gun: 'huntingrifle', forceHelm: true, pack: 'missile', kneel: true, ragged: true, tint: REBEL_DRAB },
      rebacgunner: { helm: 'std', gun: 'none', forceHelm: true, pack: 'none', kneel: true, bulk: 1, ragged: true, tint: REBEL_DRAB },
      rebmortarman: { helm: 'std', gun: 'none', forceHelm: true, pack: 'none', kneel: true, ragged: true, tint: REBEL_DRAB },
      rebmortarloader: { helm: 'std', gun: 'shell', forceHelm: true, pack: 'mortarbase', kneel: true, ragged: true, tint: REBEL_DRAB },
      guncaptain: { helm: 'std', gun: 'optics', forceHelm: true, pack: 'none', kneel: true, tint: REBEL_FIELD },
      gunloader: { helm: 'std', gun: 'shell', forceHelm: true, pack: 'none', kneel: true, ragged: true, tint: REBEL_DRAB },
      // chosen warriors: the only rebels who look like soldiers
      partlead: { helm: 'balaclava', gun: 'smg', armband: 'force', pack: 'charges', bulk: 1, mark: true, tint: REBEL_NIGHT },
      partisan: { helm: 'balaclava', gun: 'battlerifle', armband: 'force', pack: 'charges', tint: REBEL_NIGHT },
      partsaw: { helm: 'balaclava', gun: 'saw', armband: 'force', pack: 'ammo', bulk: 1, tint: REBEL_NIGHT },
      partsapper: { helm: 'balaclava', gun: 'smg', armband: 'force', pack: 'charges', grenades: true, tint: REBEL_NIGHT },
      partmarksman: { helm: 'balaclava', gun: 'long', armband: 'force', pack: 'none', prone: true, tint: REBEL_NIGHT },
      partspotter: { helm: 'balaclava', gun: 'optics', armband: 'force', pack: 'std', kneel: true, tint: REBEL_NIGHT },
      // miners: hard hats, lamps and a cutter that goes through most things
      cutter: { helm: 'welder', gun: 'lascutter', forceShoulders: true, pack: 'minerpack', tint: REBEL_MINE },
      blaster: { helm: 'welder', gun: 'lascutter', forceShoulders: true, pack: 'charges', tint: REBEL_MINE },
      // harsh-environment miners: the miner, with armour plates bolted over the work suit
      hardsuit: { helm: 'welder', gun: 'lascutter', forceShoulders: true, pack: 'minerpack', plates: true, bulk: 1, tint: REBEL_MINE },
      // deserters, still in the uniform they walked out of
      deserter: { helm: 'std', gun: 'smg', armband: 'force', pack: 'none', mark: true, tint: REBEL_WORN, fitAs: 'desrifle' },   // the ex-sergeant, at the front right
      desrifle: { helm: 'std', gun: 'battlerifle', armband: 'force', pack: 'std', tint: REBEL_WORN },
      dessaw: { helm: 'std', gun: 'saw', armband: 'force', pack: 'ammo', tint: REBEL_WORN, fitAs: 'desrifle' },   // the squad automatic weapon they walked out with
      conscript: { helm: 'std', gun: 'rifle', armband: 'force', pack: 'none', wood: true, tint: REBEL_WORN },
      conscript2: { helm: 'cap', gun: 'battlerifle', armband: 'force', pack: 'std', wood: true, tint: REBEL_WORN },
      // POWs broke out with what their guards carried
      pow: { helm: 'bare', gun: 'smg', armband: 'force', pack: 'none', ragged: true, tint: REBEL_WORN },
      pow2: { helm: 'bandana', gun: 'smg', armband: 'force', pack: 'none', ragged: true, band: '#5a5a50', tint: REBEL_WORN },
      // First Among Equals: a pistol, a megaphone and the group's colours on a pole
      // the leader himself: a mujahideen veteran in the fanatics' white turban, the green sash of command
      // the rebel leader, Tier by Tier (see the leader roles)
      lead1: { helm: 'turban', gun: 'smg', armband: 'force', pack: 'none', tunic: true, wrap: '#d6ceb8', vest: HOLY_A.mid, mark: true, tint: HOLY_A },
      lead2: { helm: 'turban', gun: 'smg', armband: 'force', pack: 'std', tunic: true, wrap: '#d6ceb8', vest: '#3b3a30', bandolier: true, mark: true, tint: HOLY_A },
      lead3: { helm: 'turban', gun: 'smg', armband: 'force', pack: 'std', tunic: true, wrap: '#d6ceb8', vest: '#3b3a30', bandolier: true, mark: true, tint: HOLY_B },
      // the Rebellion leader's second: the Insurgent leader's figure, in a black turban like his chief's
      lead3black: { helm: 'turban', gun: 'battlerifle', armband: 'force', pack: 'std', tunic: true, wrap: '#1c1c1e', vest: '#3b3a30', bandolier: true, mark: true, tint: HOLY_B },
      lead4: { helm: 'turban', gun: 'none', armband: 'force', pack: 'none', tunic: true, wrap: '#d6ceb8', vest: '#22241e', sash: 'force', mark: true, bulk: 1, tint: HOLY_B },
      lead5: { helm: 'turban', gun: 'none', armband: 'force', pack: 'none', tunic: true, wrap: '#1c1c1e', vest: '#1c1e18', sash: 'force', blade: true, mark: true, bulk: 1, tint: HOLY_B },
      // the leader himself: the turban and the sash in the side's own colour
      agitator: { helm: 'turban', gun: 'battlerifle', pack: 'std', tunic: true, wrap: 'force', vest: '#1c1e18', sash: 'force', mark: true, bulk: 1, tint: HOLY_B },
      standard: { helm: 'beret', gun: 'banner', plainFlag: true, pack: 'none', tint: FIELD_OCHRE, fitAs: 'guardrifle' },
      flagsmall: { helm: 'beret', gun: 'flagsmall', pack: 'none', tint: FIELD_OCHRE, fitAs: 'guardrifle' },
      flagbig: { helm: 'beret', gun: 'flagbig', pack: 'none', tint: FIELD_OCHRE, fitAs: 'guardrifle' },
      flaghuge: { helm: 'beret', gun: 'flaghuge', pack: 'none', tint: FIELD_OCHRE, fitAs: 'guardrifle' },
    };
    /* Holy Warriors and First Among Equals who take the Riders upgrade ride
       in the dress of their own tier: each mounted figure is the unmounted
       one — its turban, wrap, vest, sash, flag and colours — put on a mount,
       its pack left behind, and sized as the other riders are. */
    function mounted(r) {
      var k = r + 'mtd';
      if (!KIT[k]) {
        var m = {};
        for (var f in KIT[r]) m[f] = KIT[r][f];
        m.mount = true; m.pack = 'none'; m.fitAs = 'rider';
        delete m.kneel; delete m.prone;
        KIT[k] = m;
      }
      return k;
    }
    ['holy', 'holy1', 'holy2', 'holy3', 'holy4', 'leader', 'leadersmall', 'leadermid', 'leaderbig', 'leaderhuge'].forEach(function (art) {
      ROLES[art + 'mounted'] = ROLES[art].map(mounted);
    });
    /* The Militia (Tier II Freedom Warriors) are the insurgents' figures with
       their sleeves rolled up short, and the rookie-rifle Deserters and the
       conscript Deserters their own figures the same way; the Rider warriors (Tier II Mounted
       Warriors) are the Militia on a mount. */
    function rolled(r) {
      var k = r + 'rs';
      if (!KIT[k]) {
        var m = {};
        for (var f in KIT[r]) m[f] = KIT[r][f];
        m.sleeves = 'rolled';
        KIT[k] = m;
      }
      return k;
    }
    ROLES.militia = ROLES.rebel.map(rolled);
    ROLES.deserterrk = ROLES.deserter.map(rolled);
    ROLES.conscript = ROLES.conscript.map(rolled);
    ROLES.rider = ROLES.militia.map(mounted);

    /* ---------- one trooper, drawn into a cache canvas ----------
       Proportions are roughly human: about six and a half heads tall, shoulders a
       little under a third of the height, and no pauldrons to speak of. */
    /* ---------- the figure's proportions ----------
       Every kit is drawn in rectangles on the same frame, and that frame was a
       toy's: the head a sixth of the figure's height and the legs barely a third.
       A man's head is about a seventh and a half of him, and his legs nearly
       half. Rather than redraw sixty kits, the frame itself is corrected here, in
       the one function every shape passes through:

         - everything below the hip is stretched, so the legs are a man's legs
           and the head ends up the right fraction of the whole;
         - shapes that are wholly head — above the collar and inside the width of
           the skull — are drawn narrower, so a helmet is no wider than the
           shoulders under it;
         - anything big enough to have corners has them rounded off, which is most
           of what made a figure look built from blocks.

       A figure lying down or sitting a bike keeps the old frame: stretching those
       would only make them longer on the ground. */
    var LEG = 1.32;                 // how much longer the legs are drawn
    var HEAD_W = 0.86;              // and how much narrower the head
    var NVG_LENS = '#b8f8ff', NVG_GLOW = '120,236,255';   // night-vision lenses, and the light they throw
    var HIP = -20;                  // where the legs meet the body, in art units
    var KNEEL_DROP = 11;            // how far a man down on one knee sinks, in art units
    var XENO_LOW = 13;              // how far a hunkered Xenotripod lets its body down
    var COLLAR = -43;               // above this, a shape is part of the head
    // the company's own colour on a tinted figure (the tint keeps it as `force`)
    function PALETTE_FORCE(pal) { return pal.force || pal.light; }
    function paintFigure(g, ox, oy, pal, kit, pose, step, s) {
      var tall = pose !== 'prone' && !kit.mount;
      /* Lights that glow past the figure's outline (night-vision lenses), in
         canvas pixels: handed back, for sprite() to lay on after the outline
         and shading. */
      var glows = [];
      function glowAt(dx, dy, r, c) {
        var x = dx;
        if (tall && dy <= COLLAR && dy >= -61 && dx >= -11 && dx <= 12) x = 0.5 + (x - 0.5) * HEAD_W;
        glows.push({ x: ox + x * s, y: oy + mapY(dy) * s, r: r * s, c: c });
      }
      function mapY(y) {
        if (!tall) return y;
        return y >= HIP ? y * LEG : y + HIP * (LEG - 1);
      }
      function P(dx, dy, w, h, c) {
        var x0 = dx, x1 = dx + w;
        var y0 = mapY(dy), y1 = mapY(dy + h);
        // wholly head: above the collar, and inside the width of a skull
        // (bounded above too: a banner or an antenna up over the head is not skull)
        if (tall && dy + h <= COLLAR + 0.01 && dy >= -61 && dx >= -11 && dx + w <= 12) {
          x0 = 0.5 + (x0 - 0.5) * HEAD_W;
          x1 = 0.5 + (x1 - 0.5) * HEAD_W;
        }
        var X = ox + x0 * s, Y = oy + y0 * s;
        var WW = (x1 - x0) * s, HH = (y1 - y0) * s;
        g.fillStyle = c;
        // big enough to have corners, so round them off
        var rr = Math.min(WW, HH) * 0.3;
        if (rr >= 1.2 && g.roundRect) {
          g.beginPath();
          g.roundRect(X, Y, WW, HH, rr);
          g.fill();
          return;
        }
        g.fillRect(Math.round(X), Math.round(Y), Math.max(1, Math.round(WW)), Math.max(1, Math.round(HH)));
      }
      // cut a shape out of what is already drawn — the waist, taken in at the sides
      function carve(pts) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        pts.forEach(function (q, i) {
          var X = ox + q[0] * s, Y = oy + mapY(q[1]) * s;
          if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
        });
        g.closePath();
        g.fill();
        g.restore();
      }
      var b = kit.bulk || 0;
      var tw = 17 + b * 3, tx = -Math.round(tw / 2);     // torso width and left edge
      var sw = tw + 2;                                   // across the shoulders
      var drop = pose === 'kneel' ? KNEEL_DROP : 0;      // how far the body sinks

      /* ---- gone to ground ----
         Flat on the belly, seen from above and to the side as the camera sees
         the table: boots splayed behind, the back and pack broad and lit, the
         helmet up at the front over the weapon, arms out to it. Chunky, and
         ringed dark, so a squad that has hit the dirt still reads as men. */
      if (pose === 'prone') {
        var hood = kit.helm === 'hood' || kit.helm === 'nomadhood' || kit.helm === 'cowl' || kit.helm === 'turban' || kit.helm === 'wrap';
        var bk = kit.armoured ? 2 : 0;
        P(-19, -7, 5, 4, BOOT); P(-19, -7, 5, 1, '#454b54');        // boots, one leg drawn up
        P(-18, -2, 5, 3, BOOT);
        P(-15, -9, 10, 5, pal.dark);                                  // the drawn-up leg
        P(-15, -9, 10, 1.5, pal.mid);
        P(-14, -4, 10, 4, pal.mid);                                   // the straight leg
        P(-14, -4, 10, 1.2, pal.light);
        P(-6, -12 - bk, 16, 11 + bk, pal.mid);                        // the back, broad from above
        P(-6, -12 - bk, 16, 3, pal.light);
        P(-6, -3, 16, 2, pal.dark);                                   // belt and the shadow under the body
        if (kit.vest) P(-4, -11, 12, 8, '#383c42');
        if (kit.pouches) P(-3, -5, 10, 3, kit.pouches);
        if (kit.armoured) { P(-5, -14, 14, 3, pal.helm); P(-5, -14, 14, 1, pal.light); }
        if (kit.pack === 'dish') {                                    // the set, folded out beside him
          P(-4, -17, 8, 4, '#39413a'); P(-3, -21, 1, 4, GUN.md);
          P(-6, -23, 8, 2, GUN.lt); P(-4, -22, 5, 1, '#8fb8cc');
        } else if (kit.pack === 'medic') {
          P(-4, -16, 8, 5, '#dfe8ef'); P(-1, -15, 2, 4, '#c8384f'); P(-3, -14, 6, 2, '#c8384f');
        } else if (kit.pack !== 'none') {
          P(-4, -16, 9, 5, pal.dark);                                 // the pack, riding on the back
          P(-4, -16, 9, 1.5, pal.cloth);
        }
        P(9, -12, 6, 4, pal.mid); P(9, -12, 6, 1, pal.light);         // arms out to the weapon
        P(9, -5, 6, 3, pal.dark);
        P(14, -9, 3, 3, BOOT);                                        // hands at the grip
        // the head, up at the front, behind the sights
        if (hood) {
          P(8, -18, 9, 8, pal.cloth); P(8, -18, 4, 4, 'rgba(255,255,255,.18)');
        } else {
          P(8, -18, 9, 8, pal.hat || pal.helm); P(8, -18, 4, 3, pal.hatLit || pal.light);
          P(7, -11, 11, 1.5, pal.dark);                               // the rim
        }
        P(15, -13, 3, 3, '#8d6f4e');                                  // the face at the sight
        P(16, -12, 2, 1, '#20262d');
        if (kit.nvg) {                                                // night-vision goggles, lit
          P(14, -15, 5, 3, '#1b1f24'); P(15.5, -14.2, 2.4, 1.6, NVG_LENS);
          glowAt(16.7, -13.4, 4.2, NVG_GLOW);
        }
        if (kit.gun === 'long') {
          P(12, -10, 28, 2.5, GUN.dk); P(12, -10, 28, 0.8, GUN.lt);   // the rifle, on its bipod
          P(16, -13, 10, 3, GUN.md); P(24, -12, 2, 1, '#8fd0e8');     // scope
          P(32, -8, 1, 5, GUN.md); P(35, -8, 1, 5, GUN.md);
          P(38, -10.5, 3, 3.5, GUN.lt);
        } else if (kit.gun === 'mg' || kit.gun === 'saw') {
          P(12, -10, 23, 3, GUN.dk); P(12, -10, 23, 0.8, GUN.lt);
          P(27, -7, 1, 5, GUN.md); P(31, -7, 1, 5, GUN.md);
          P(15, -7, 6, 3, '#8a7a3a');
        } else if (kit.gun === 'optics') {
          P(15, -17, 10, 4, GUN.md); P(15, -17, 10, 1, GUN.lt); P(25, -16, 2, 2, '#8fe0ff');
        } else if (kit.gun === 'case' || kit.gun === 'slate' || kit.gun === 'console') {
          P(15, -9, 9, 4, GUN.md); P(16, -8, 7, 2, '#59c6e0');
        } else if (kit.gun !== 'none' && kit.gun !== 'shell') {
          P(12, -9, 18, 2.5, GUN.dk); P(12, -9, 18, 0.8, GUN.lt);     // a rifle laid out in front
          P(28, -9, 3, 2, GUN.lt);
          P(16, -7, 4, 3, GUN.md);                                     // its magazine
        }
        return glows;
      }

      /* ---- the mount, under everything ---- */
      PARTS.mount(P, g, kit, ox, oy, pal, pose, s, step);
      // a horse stands taller than a bike: its rider sits up in the saddle, above its back
      if (kit.mount === 'horse') oy -= RIDE_UP.horse * s;

      PARTS.legs(P, kit, pal, pose, step);

      /* ---- pack, behind the torso ---- */
      var px = tx + tw - 1;
      if (kit.cape) {                                     // a long red cape streaming back
        P(px - 2, -44 + drop, 8, 30, pal.cloth);
        P(px + 4, -40 + drop, 5, 24, pal.cloth);
        P(px + 7, -34 + drop, 3, 16, pal.cloth);
        P(px - 2, -44 + drop, 3, 30, 'rgba(0,0,0,.28)');
        P(px + 6, -36 + drop, 1, 18, 'rgba(255,255,255,.12)');
      }
      PARTS.pack(P, drop, kit, pal, px);

      if (kit.armoured) armourPack(P, pal, drop, px);
      if (PACK_DETAIL[kit.pack]) PACK_DETAIL[kit.pack](P, pal, drop, px);

      /* ---- torso ---- */
      PARTS.torso(P, b, carve, drop, kit, pal, pose, sw, tw, tx);
      /* ---- arms ---- */
      PARTS.arms(P, b, drop, kit, pal, pose, step, tw, tx);
      /* ---- head ---- */
      if (kit.robot) P(-1, -46 + drop, 3, 5, RB.piston); // a neck piston, not a neck
      else P(-2, -45 + drop, 5, 4, pal.dark);            // neck
      var bodyPal = pal;
      if (pal.hat) {                                     // the helmet in the company's colour
        pal = {}; for (var bk2 in bodyPal) pal[bk2] = bodyPal[bk2];
        pal.helm = bodyPal.hat; pal.light = bodyPal.hatLit; pal.dark = bodyPal.hatDark;
        if (kit.helm === 'beret') pal.mid = bodyPal.hat;   // a beret is all colour
      }
      PARTS.helmet(P, drop, kit, pal);

      if (HELM_DETAIL[kit.helm]) HELM_DETAIL[kit.helm](P, pal, drop);
      pal = bodyPal;
      /* Night-vision goggles, as the riders wear theirs: a dark frame over the
         eyes with the blue of the lenses, and the strap round the helmet. */
      if (kit.nvg) {
        P(-6, -52 + drop, 13, 1.2, '#1b1f24');           // the strap
        P(-3, -49 + drop, 10, 4, '#1b1f24');             // goggles
        P(-3, -49 + drop, 10, 1, '#4b545d');
        P(-0.5, -48.2 + drop, 3.6, 2.6, NVG_LENS);        // the lenses, lit from within
        P(4.5, -48.2 + drop, 3.6, 2.6, NVG_LENS);
        P(0, -48 + drop, 1.2, 1, '#ffffff'); P(5, -48 + drop, 1.2, 1, '#ffffff');
        P(3.1, -48.4 + drop, 1.4, 3, '#1b1f24');         // the bridge between them, dark, so they read as a pair
        glowAt(1.3, -47 + drop, 2.7, NVG_GLOW); glowAt(6.3, -47 + drop, 2.7, NVG_GLOW);   // two eyes, each its own glow
      }

      /* ---- weapon, over everything ---- */
      var wy = -32 + drop;
      PARTS.weapon(P, kit, pal, wy);

      if (GUN_DETAIL[kit.gun]) GUN_DETAIL[kit.gun](P, wy);
      if (kit.wood) {                                     // old-pattern rifles: wooden stock and fore-end
        var WD = '#7a5230', WL = '#9a6c40';
        if (kit.gun === 'battlerifle') {
          P(-10, wy + 1, 7, 4, WD); P(-10, wy + 1, 7, 1, WL);
          P(4, wy + 2, 10, 2.5, WD); P(4, wy + 2, 10, 0.8, WL);
        } else {
          P(-9, wy + 1, 6, 3, WD); P(-9, wy + 1, 6, 0.8, WL);
          P(9, wy + 3, 7, 2, WD); P(9, wy + 3, 7, 0.7, WL);
          P(-6, wy + 3, 3, 3, WD);
        }
      }

      if (kit.shield) {                                   // riot shield on the near arm
        P(-19, -42 + drop, 13, 30, '#3a4048');
        P(-19, -42 + drop, 4, 30, '#4d555f');
        P(-19, -42 + drop, 13, 2, '#5f6873');
        P(-16, -36 + drop, 8, 7, '#1b2732');              // vision slit
        P(-16, -36 + drop, 8, 1, '#6a8496');
        P(-19, -13 + drop, 13, 2, '#242931');
      }
      return glows;
    }



    /* ================= the detail layer =================
       Each helmet, weapon and pack was designed for a figure a few pixels across,
       so each is a handful of flat rectangles. At twice the resolution there is
       room for the things that say what an object is — the rim of a helmet and the
       curve of its dome, the magazine ribs and ejection port of a rifle, the latch
       on an ammo box — and they are drawn here, over the original shapes, one
       table per family. The originals stay underneath untouched, so every kit
       keeps its silhouette and colours and gains the detail on top.

       Coordinates are the figure's own art units, as everywhere in paintFigure;
       fractions of a unit exist only at the new resolution, which is the point. */
    var SKIN_D = '#6b5238', SKIN_DD = '#5a4330';
    var HIGHLIGHT = '#f0e2c2', LENS = '#8fd0e8';

    var HELM_DETAIL = {
      heavy: function (P, pal, d) {
        P(-4, -56 + d, 6, 1, pal.helm);                  // the dome, rounded off
        P(-5, -54 + d, 3, 1, HIGHLIGHT);
        P(-8, -45 + d, 16, 1, pal.dark);                 // rim
        P(-8, -45 + d, 5, 0.75, pal.light);
        P(5, -49.5 + d, 2, 0.75, '#9fb6c6');             // the visor curving away
        P(-6, -48 + d, 1, 1, pal.dark); P(6, -52 + d, 1, 1, pal.dark);   // rivets
      },
      sealed: function (P, pal, d) {
        P(-3, -59 + d, 7, 1, pal.helm);                  // crown, rounded
        P(-5, -57 + d, 3, 1, '#f6ecd4');
        P(-7, -48 + d, 15, 0.75, 'rgba(0,0,0,.35)');     // where the faceplate meets the shell
        P(1, -47 + d, 5, 2, GUN.md);                     // breathing grille
        P(2, -46.5 + d, 1, 1, GUN.dk); P(4, -46.5 + d, 1, 1, GUN.dk);
        P(-1, -51.5 + d, 9, 0.5, 'rgba(255,200,120,.55)');   // the eye slit's glow
        P(6, -54 + d, 2, 3, pal.dark);                   // side vent
        P(6.5, -53.5 + d, 1, 0.5, pal.light);
        P(-8, -45 + d, 5, 0.75, pal.light);              // the collar's lit edge
      },
      welder: function (P, pal, d) {
        P(-5, -54 + d, 9, 1, pal.helm);
        P(-5, -53 + d, 3, 1, HIGHLIGHT);
        P(-1, -50 + d, 8, 0.75, '#3a2a18');              // the plate's frame
        P(-2, -51 + d, 1.5, 1.5, GUN.lt);                // and its hinge
        P(3, -45 + d, 2, 3, GUN.md);                     // a hose to the rebreather
      },
      hood: function (P, pal, d) {
        P(-5, -54 + d, 9, 1, pal.cloth);                 // the hood's peak
        P(-3, -53 + d, 1, 8, 'rgba(0,0,0,.25)');         // a fold down the side
        P(-6, -49 + d, 6, 1, GUN.dk);                    // goggle strap
        P(1, -48.5 + d, 1.5, 1, LENS); P(4.5, -48.5 + d, 1.5, 1, LENS);
      },
      cap: function (P, pal, d) {
        P(1, -50 + d, 2, 2, '#e8c15a');                  // cap badge
        P(-9, -47 + d, 4, 0.75, 'rgba(0,0,0,.4)');       // the shadow under the peak
        P(-5, -44 + d, 1.5, 2, '#7a5f42');               // an ear
        P(1, -42 + d, 3, 0.75, SKIN_DD);                 // mouth
        P(3, -45 + d, 1.5, 0.75, '#6e8494');             // glint on the shades
      },
      beret: function (P, pal, d) {
        P(-3, -51 + d, 2, 2, '#e8c15a');                 // the badge
        P(-6, -51.5 + d, 6, 0.75, pal.light);            // the beret's soft top
        P(-6, -44 + d, 1.5, 2, '#7a5f42');               // an ear
        P(2, -43 + d, 2, 0.75, SKIN_DD);                 // mouth
      },
      bare: function (P, pal, d) {
        P(-6, -49 + d, 1.5, 2.5, '#7a5f42');             // an ear
        P(4, -48 + d, 1, 2, SKIN_D);                     // the shadow of the nose
        P(1, -45.5 + d, 3, 0.75, SKIN_DD);               // mouth
        P(-2, -45 + d, 6, 1.5, 'rgba(40,30,20,.35)');    // stubble
        P(-3, -53 + d, 4, 0.75, '#4a3a28');              // light on the hair
      },
      scarf: function (P, pal, d) {
        P(-4, -53 + d, 1, 4, 'rgba(0,0,0,.25)');         // folds in the cloth
        P(2, -53 + d, 1, 3, 'rgba(0,0,0,.2)');
        P(2, -47.5 + d, 1, 0.75, '#e8e0d0');             // an eye catching the light
        P(-6, -49 + d, 1.5, 2, '#7a5f42');
      },
      wrap: function (P, pal, d) {
        P(-3, -53 + d, 1, 9, 'rgba(0,0,0,.25)');         // the wrap wound round
        P(2, -52 + d, 1, 3, 'rgba(0,0,0,.2)');
        P(-6, -51 + d, 13, 0.75, 'rgba(255,255,255,.10)');
        P(3, -48.5 + d, 1, 0.75, '#e8e0d0');             // an eye in the slit
      },
      balaclava: function (P, pal, d) {
        P(-6, -51 + d, 13, 0.5, 'rgba(255,255,255,.08)');   // knit rows
        P(-6, -47 + d, 13, 0.5, 'rgba(255,255,255,.08)');
        P(2, -49.5 + d, 1, 0.75, '#e8e0d0');             // eyes in the gap
        P(4.5, -49.5 + d, 1, 0.75, '#e8e0d0');
      },
      hardhat: function (P, pal, d) {
        P(-9, -50 + d, 19, 0.75, pal.light);             // the brim's lit edge
        P(-11, -51 + d, 6, 4, 'rgba(255,233,168,.25)');  // the lamp's halo
        P(-5, -52 + d, 1, 1, '#fff7d8');
      },
      mask: function (P, pal, d) {
        P(0, -44 + d, 5, 0.75, GUN.dk);                  // ribs on the filter
        P(0, -42.5 + d, 5, 0.75, GUN.dk);
        P(-1, -48 + d, 2, 1, '#9fd8c0');                 // eyepieces
        P(5, -44 + d, 1, 4, GUN.md);                     // a hose
        P(-4, -52 + d, 3, 1, HIGHLIGHT);
      },
      riot: function (P, pal, d) {
        P(-1, -49 + d, 4, 0.75, '#8aa4b8');              // the visor's reflection
        P(5, -54 + d, 2, 2, pal.dark);                   // vents
        P(-6, -55 + d, 3, 1, HIGHLIGHT);
      },
      cowl: function (P, pal, d) {
        P(-4, -55 + d, 1, 10, 'rgba(0,0,0,.22)');        // folds of the cloth
        P(3, -55 + d, 1, 5, 'rgba(0,0,0,.18)');
        P(-8, -45 + d, 16, 0.75, 'rgba(0,0,0,.3)');      // the hem at the shoulder
      },
      goggles: function (P, pal, d) {
        P(-3, -49 + d, 10, 0.5, '#6e7882');              // lens rims
        P(-3, -46 + d, 10, 0.5, '#0c0e11');
        P(-6, -49 + d, 1.5, 2, '#7a5f42');
      },
      std: null
    };

    var GUN_DETAIL = {
      battlerifle: function (P, wy) {
        P(4, wy - 1, 8, 1, GUN.md);                      // top rail
        P(5, wy - 1.5, 1, 0.5, GUN.lt); P(8, wy - 1.5, 1, 0.5, GUN.lt); P(11, wy - 1.5, 1, 0.5, GUN.lt);
        P(13, wy - 2, 2, 1, LENS);                       // the sight's lens
        P(4, wy + 1, 3, 1, '#0c0e11');                   // ejection port
        P(-1, wy + 3, 1, 8, GUN.md);                     // magazine, lit down one edge
        P(-1, wy + 5.5, 5, 0.75, GUN.md); P(-1, wy + 8.5, 5, 0.75, GUN.md);
        P(-5, wy + 3, 3, 4, GUN.dk);                     // pistol grip
        P(-10, wy + 1, 7, 0.75, GUN.lt);                 // stock
        P(-10, wy + 4, 2, 1, '#08090c');                 // butt pad
        P(25, wy - 0.5, 1, 1, GUN.dk); P(27, wy - 0.5, 1, 1, GUN.dk);   // shroud vents
        P(14, wy + 2, 4, 3, BOOT);                       // the rear hand on the foregrip
        P(14, wy + 2, 2, 1, '#454b54');
      },
      saw: function (P, wy) {
        P(6, wy - 3, 6, 1, GUN.lt);                      // carry handle
        P(6, wy - 3, 1, 2, GUN.md); P(11, wy - 3, 1, 2, GUN.md);
        P(-5, wy - 1, 9, 0.75, GUN.md);                  // feed cover
        P(1, wy + 5, 7, 0.75, '#5d6650'); P(1, wy + 7, 7, 0.75, '#5d6650');   // drum ribs
        P(13, wy + 3, 4, 3, BOOT); P(13, wy + 3, 2, 1, '#454b54');
      },
      smg: function (P, wy) {
        P(15, wy + 1, 3, 2, GUN.md);                     // a short suppressor
        P(15, wy + 1, 3, 0.75, GUN.lt);
        P(4, wy + 1.5, 2, 0.75, '#0c0e11');              // ejection port
        P(1, wy + 6, 4, 0.75, GUN.md);                   // magazine rib
        P(-2, wy + 4, 2, 3, GUN.dk);                     // grip
        P(8, wy + 3, 3, 3, BOOT); P(8, wy + 3, 1.5, 1, '#454b54');
      },
      shotgun: function (P, wy) {
        P(-3, wy + 4, 15, 1, GUN.md);                    // magazine tube
        P(16, wy, 1, 1, '#c9cdd4');                      // bead sight
        P(-8, wy + 3, 6, 0.75, '#6a5236');               // grain in the stock
        P(1, wy + 6, 5, 0.75, '#6a5236');
        P(0, wy + 5, 4, 3, BOOT); P(0, wy + 5, 2, 1, '#454b54');   // hand on the pump
      },
      mg: function (P, wy) {
        for (var i = 0; i < 5; i++) P(8 + i * 3, wy + 0.5, 1, 1, GUN.dk);   // cooling holes
        P(4, wy + 4, 9, 0.75, '#c9b460');                // brass in the belt
        P(-2, wy - 2, 6, 1, GUN.md);                     // feed tray
      },
      long: function (P, wy) {
        P(13, wy - 4, 2, 1, LENS);                       // scope lens
        P(20, wy - 4, 1, 3, GUN.lt);                     // front bell
        P(4, wy - 1, 1, 2, GUN.lt);                      // bolt handle
        P(-9, wy - 2, 5, 1, GUN.lt);                     // cheek rest
      },
      huntingrifle: function (P, wy) {
        P(-9, wy + 1, 8, 0.75, '#5a3c1e');               // grain
        P(3, wy - 1, 1, 2, GUN.lt);                      // bolt handle
        P(10, wy - 3, 1.5, 1, LENS);
        P(-6, wy + 2, 20, 0.5, '#3a2c1a');               // a sling
      },
      rifle: null,
      carbine: function (P, wy) {
        P(1, wy + 5, 5, 0.75, GUN.lt); P(1, wy + 7, 5, 0.75, GUN.lt);   // drum ribs
        P(4, wy + 0.5, 2, 0.75, '#0c0e11');
        P(10, wy + 2, 3, 3, BOOT);
      },
      pistol: function (P, wy) {
        P(3, wy + 3, 3, 0.75, GUN.lt);                   // slide serrations
        P(2, wy + 5, 2, 2, GUN.dk);                      // grip
      },
      heavy: function (P, wy) {
        for (var j = 0; j < 4; j++) P(3 + j * 4, wy + 0.5, 1, 1, GUN.lt);   // cooling ribs
        P(-3, wy + 4, 10, 1.5, '#8a7a3a');               // ammo feed
        P(8, wy + 2, 4, 4, BOOT); P(8, wy + 2, 2, 1, '#454b54');
      },
      flamer: function (P, wy) {
        P(22, wy + 1, 2, 4, '#3a2a18');                  // the nozzle's throat
        P(4, wy - 3, 3, 3, GUN.md);                      // a pressure gauge
        P(5, wy - 2, 1, 1, '#e8e0d0');
        P(0, wy + 2, 16, 0.75, '#2a302a');
      },
      lascutter: function (P, wy) {
        P(8, wy + 1, 0.75, 3, '#ffb070'); P(10, wy + 1, 0.75, 3, '#ffb070');   // emitter rings
        P(13, wy + 1.5, 12, 0.5, '#ffffff');             // the beam's white core
        P(-8, wy + 1, 4, 1, '#8a8a96');
      },
      atlauncher: function (P, wy) {
        P(7, wy - 14, 2, 1, LENS);
        P(-2, wy - 11, 1, 8, '#2a3026'); P(12, wy - 11, 1, 8, '#2a3026');   // bands on the tube
        P(26, wy - 13, 2, 12, '#4a3a22');                // the warhead's fins
      },
      rpg: function (P, wy) {
        P(21, wy - 5, 1, 9, '#4a2814');                  // a seam in the warhead
        P(-12, wy - 1, 32, 0.5, 'rgba(0,0,0,.3)');
        P(7, wy - 5, 2, 1, LENS);
      },
      machete: function (P, wy) {
        P(1, wy - 1, 9, 0.5, 'rgba(232,238,244,.55)');   // the edge, catching the light
      },
      molotov: function (P, wy) {
        P(1, wy - 2, 1, 4, 'rgba(255,255,255,.55)');     // light in the glass
        P(1, wy - 7, 3, 3, '#ffb040');                   // the rag, lit
      },
      banner: function (P, wy) {
        P(-10, wy - 30, 2, 0.75, '#c8a33a'); P(-10, wy - 10, 2, 0.75, '#c8a33a');
      },
      megaphone: function (P, wy) {
        P(1, wy - 6, 1, 14, '#e8746a');                  // the horn's rim
      },
      optics: function (P, wy) {
        P(8, wy - 8, 1, 1, '#ffffff');
        P(-7, wy - 7, 15, 0.75, 'rgba(0,0,0,.3)');
      },
      slate: function (P, wy) {
        P(-16, wy + 6, 8, 0.75, '#2a3a40');
        P(-10, wy + 2, 1, 1, '#ffffff');
      },
      case: function (P, wy) {
        P(-14, wy + 6, 2, 1, GUN.md);                    // the handle
        P(-19, wy + 15, 12, 0.75, '#b8c4cc');
      },
      console: null, shell: null, none: null
    };

    var PACK_DETAIL = {
      std: function (P, pal, d, px) {
        P(px + 1, -37 + d, 5, 0.75, pal.mid);            // the flap's edge
        P(px + 3, -36 + d, 1, 2, '#8a8f98');             // buckle
        P(px, -31 + d, 7, 0.75, 'rgba(0,0,0,.3)');       // a strap across the bottom
      },
      ammo: function (P, pal, d, px) {
        P(px + 3, -32 + d, 2, 2, '#8a8f98');             // the latch
        P(px, -30 + d, 8, 0.75, 'rgba(0,0,0,.35)');
      },
      radio: function (P, pal, d, px) {
        P(px + 1, -40 + d, 1.5, 1.5, '#c9cdd4'); P(px + 4, -40 + d, 1.5, 1.5, '#c9cdd4');   // dials
        P(px + 1, -26 + d, 7, 0.75, 'rgba(0,0,0,.35)');
      },
      charges: function (P, pal, d, px) {
        P(px + 1, -34 + d, 5, 0.5, '#d8442a');           // det wire
        P(px + 1, -28 + d, 5, 0.5, '#d8442a');
        P(px + 5, -36 + d, 1, 1, '#e8c15a');
      },
      medic: function (P, pal, d, px) {
        P(px, -38 + d, 7, 0.75, pal.mid);
      },
      tanks: function (P, pal, d, px) {
        P(px + 1, -39 + d, 1, 14, 'rgba(255,255,255,.18)');   // light down each cylinder
        P(px + 5, -39 + d, 1, 14, 'rgba(255,255,255,.14)');
        P(px, -30 + d, 8, 0.75, '#2a302a');              // a strap
      },
      dish: function (P, pal, d, px) {
        P(px + 1, -51 + d, 1, 1, '#ffffff');
      },
      missile: function (P, pal, d, px) {
        P(px + 1, -44 + d, 1, 12, 'rgba(255,255,255,.14)');
      },
      minerpack: function (P, pal, d, px) {
        P(px, -39 + d, 8, 0.75, '#8a7a56');
      },
      mortarbase: null, none: null
    };

    /* Powered armour carries its power on its back: a reactor pack with vents
       and a glow, whatever else it is doing. */
    function armourPack(P, pal, d, px) {
      P(px - 1, -45 + d, 9, 19, GUN.md);
      P(px - 1, -45 + d, 9, 1.5, GUN.lt);
      for (var i = 0; i < 3; i++) P(px + 1, -41 + i * 3 + d, 5, 0.75, GUN.dk);   // vents
      P(px + 2, -30 + d, 3, 2, '#5fd0f0');               // the cell's glow
      P(px + 2.5, -29.5 + d, 1.5, 1, '#d8f6ff');
    }

    /* ---------- the finishing pass ----------
       Every kit is painted in flat blocks of colour — a lit strip, a shoulder
       line, a belt — which at the old resolution was all a figure could hold. At
       twice the resolution there is room for form, and it is added here, to the
       finished shape, so it lands on every kit the same way without repainting
       any of them:

         - shading across the figure from the table's north-west light, and a
           little darker towards the feet, so a torso reads as round and the legs
           sit under it rather than beside it;
         - a rim of light, one fine pixel wide, along the edges that face the
           light, which is what lifts a small figure off a busy ground;
         - a dark seam under the rim on the shadow side, so the two sides of a
           figure never merge into one flat block.

       Each is a fraction of a plate pixel, so none of it existed at the old bake. */
    function finishFigure(body, ox, oy, s, pose) {
      var w = body.width, h = body.height, g = body.getContext('2d');
      var tall = (pose === 'prone' ? 14 : pose === 'kneel' ? 46 : 60) * s;
      var o = Math.max(1, Math.round(s * 0.5));          // one fine pixel

      // the shape of the figure, to build edges from
      var shape = document.createElement('canvas');
      shape.width = w; shape.height = h;
      var sg = shape.getContext('2d');
      sg.drawImage(body, 0, 0);
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = '#fff';
      sg.fillRect(0, 0, w, h);

      // form shading, clipped to the figure
      g.save();
      g.globalCompositeOperation = 'source-atop';
      var across = g.createLinearGradient(ox - 14 * s, 0, ox + 14 * s, 0);
      across.addColorStop(0, 'rgba(255,244,222,0.10)');
      across.addColorStop(0.5, 'rgba(255,244,222,0)');
      across.addColorStop(1, 'rgba(6,8,12,0.16)');
      g.fillStyle = across;
      g.fillRect(0, 0, w, h);
      var down = g.createLinearGradient(0, oy - tall, 0, oy);
      down.addColorStop(0, 'rgba(255,248,232,0.06)');
      down.addColorStop(0.6, 'rgba(0,0,0,0)');
      down.addColorStop(1, 'rgba(6,8,12,0.16)');
      g.fillStyle = down;
      g.fillRect(0, 0, w, h);
      g.restore();

      // the lit edge: pixels of the shape whose neighbour up and to the left is empty
      var rim = document.createElement('canvas');
      rim.width = w; rim.height = h;
      var rg = rim.getContext('2d');
      rg.drawImage(shape, 0, 0);
      rg.globalCompositeOperation = 'destination-out';
      rg.drawImage(shape, o, o);
      rg.globalCompositeOperation = 'source-in';
      rg.fillStyle = 'rgba(255,238,204,1)';
      rg.fillRect(0, 0, w, h);

      // the shadow edge: the same, down and to the right
      var seam = document.createElement('canvas');
      seam.width = w; seam.height = h;
      var eg = seam.getContext('2d');
      eg.drawImage(shape, 0, 0);
      eg.globalCompositeOperation = 'destination-out';
      eg.drawImage(shape, -o, -o);
      eg.globalCompositeOperation = 'source-in';
      eg.fillStyle = 'rgba(4,6,10,1)';
      eg.fillRect(0, 0, w, h);

      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = 0.5;
      g.drawImage(rim, 0, 0);
      g.globalAlpha = 0.22;
      g.drawImage(seam, 0, 0);
      g.restore();
    }

    /* ---------- sprite cache ---------- */
    var sprites = {};
    /* Where each weapon's barrel ends, in art units: x forward of the figure's
       centre line, y from the line the weapon is carried on. The shot leaves from
       here, so a volley comes out of the rifles rather than out of the squad. */
    var MUZZLE = {
      rifle: [26, 1.5], long: [27, 1], mg: [31, 1.5], carbine: [19, 2], heavy: [25, 2.5],
      pistol: [13, 4.5], shotgun: [19, 2.5], battlerifle: [33, 1.5], saw: [31, 1], smg: [16, 2],
      atlauncher: [30, -7], flamer: [29, 2.5], huntingrifle: [25, 1], molotov: [14, 3],
      lascutter: [25, 2], rpg: [31, -8.5], banner: [14, 3], flagsmall: [14, 3], flagbig: [14, 3], flaghuge: [14, 3], megaphone: [17, 4], machete: [-7, -20]
    };
    var MUZZLE_PRONE = { long: [41, -9], mg: [35, -8.5], saw: [35, -8.5], optics: [27, -15], case: [24, -7], slate: [24, -7], console: [24, -7] };
    /* Two more points a figure is drawn with, for what it does besides fire its gun:
       the front of a Protector's shoulder pod, which the grenades leave, and the
       eyes of a man with optics — the lens he has up to them, or the binoculars of
       one lying prone — which a marker's laser and a Keen-Eyed glint come from. */
    function legY(kit, y) { return kit.mount ? y : (y >= HIP ? y * LEG : y + HIP * (LEG - 1)); }
    function podArt(kit, pose) {
      if (!kit.shoulderGL || pose === 'prone') return null;
      var wy = -32 + (pose === 'kneel' ? KNEEL_DROP : 0);
      return [-7, legY(kit, wy - 15.5)];
    }
    // a penal trooper's collar lamp, which the board lights over the figure: green, amber when suppressed
    function lampArt(kit, pose) {
      if (!kit.collar || pose === 'prone') return null;
      var drop = pose === 'kneel' ? KNEEL_DROP : 0;
      return [drop ? 2 : 1.8, legY(kit, -44 + drop)];
    }
    function eyeArt(kit, pose) {
      if (kit.gun !== 'optics') return null;
      if (pose === 'prone') return MUZZLE_PRONE.optics;
      var wy = -32 + (pose === 'kneel' || kit.kneel ? KNEEL_DROP : 0);
      return [9, legY(kit, wy - 8.5)];
    }
    function muzzleArt(kit, pose) {
      if (pose === 'prone') return MUZZLE_PRONE[kit.gun] || [31, -8];
      var drop = pose === 'kneel' ? KNEEL_DROP : 0, wy = -32 + drop;
      var m = MUZZLE[kit.gun] || (kit.gun === 'slate' || kit.gun === 'optics' || kit.gun === 'case' ||
        kit.gun === 'console' || kit.gun === 'shell' || kit.gun === 'none' ? [10, 4] : MUZZLE.rifle);
      var y = wy + m[1] - (RIDE_UP[kit.mount] || 0);
      if (!kit.mount) y = y >= HIP ? y * LEG : y + HIP * (LEG - 1);
      return [m[0], y];
    }


    // the parts of a figure, painted in iso-parts.js
    var PARTS = root.PMCIsoParts({
      B: B, BOOT: BOOT, GLASS: GLASS, GUN: GUN, PALETTE_FORCE: PALETTE_FORCE, RB: RB, ellipse: ellipse,
      vividHex: vividHex
    });

    return {
      COLOURS: COLOURS,
      COLOUR_KEYS: COLOUR_KEYS,
      GLASS: GLASS,
      KIT: KIT,
      KNEEL_DROP: KNEEL_DROP,
      MODEL: MODEL,
      PALETTE: PALETTE,
      ROLES: ROLES,
      SPR: SPR,
      SPRITE_RES: SPRITE_RES,
      SU: SU,
      XENO_LOW: XENO_LOW,
      colour: colour,
      eyeArt: eyeArt,
      lampArt: lampArt,
      finishFigure: finishFigure,
      muzzleArt: muzzleArt,
      paintFigure: paintFigure,
      podArt: podArt,
      roleAt: roleAt,
      setSideColour: setSideColour,
      sprites: sprites,
      vividHex: vividHex
    };
  };
})(window);
