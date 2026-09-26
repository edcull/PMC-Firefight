/* PMC 2670 — Firefight : the troopers: every man on the table drawn on a finer grid of his own - the figure in each pose, his kit by role, the army's colours and the dead and wounded - and the cache that keeps each one painted only once.

   Installed by iso.js with its kit (B): the palettes, pixel helpers and
   shared pieces it borrows, bound here, and what changes as the renderer
   runs read through B as it is now. It hands back what the rest of the
   renderer uses of it. */
(function (root) {
  'use strict';
  root.PMCIsoTroops = function (B) {
    var ellipse = B.ellipse, A = B.A, K = B.K, PIXEL = B.PIXEL, corpses = B.corpses;

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
    /* Repaint a side. Everything that draws a unit reads PALETTE at draw time, so
       this takes effect on the next frame with nothing else to update — but the
       baked props hold no side colour, so nothing needs rebuilding either. */
    function setSideColour(side, key) {
      // C is a cooperative game's second player, on the same side as A
      if (side !== 'A' && side !== 'B' && side !== 'C') return;
      PALETTE[side] = colour(key);
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
      command1: ['cmdr1', 'signals', 'cmdspotter', 'cmdsmg'],
      commandhi: ['cmdrhi', 'signals', 'cmdspotter', 'cmdsmg'],
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
      x_delta1: ['xdelta'], x_delta2: ['xdeltagun'], x_delta3: ['xdeltagun'],
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
      rider: ['biker', 'biker2'],
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
      deserter: ['deserter', 'desrifle'],
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
      holymounted: ['zealotrider'],
      holy1mounted: ['zealotrider'], holy2mounted: ['zealotrider'], holy3mounted: ['zealotrider'], holy4mounted: ['zealotrider'],
      // mounted, only the leader's own bike carries the colours
      leadermounted: ['leaderrider', 'leaderescort'],
      leadersmallmounted: ['leaderrider', 'leaderescort'],
      leaderbigmounted: ['leaderrider', 'leaderescort'],
      leadermidmounted: ['leaderrider', 'leaderescort'],
      leaderhugemounted: ['leaderrider', 'leaderescort']
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
      // the Protectors: battle armour with a grenade box on the shoulder and night-vision goggles
      protector: { helm: 'sealed', gun: 'heavy', shoulderGL: true, pack: 'none', bulk: 2, armoured: true, nvg: true },
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
      irregular: { helm: 'scarf', gun: 'smg', pack: 'none', light: true, bandolier: true },
      irregular2: { helm: 'boonie', gun: 'saw', pack: 'none', light: true, bandolier: true, tint: IRR_OLIVE },
      irregular3: { helm: 'bandana', gun: 'smg', pack: 'none', light: true, band: '#7a2e28', tint: IRR_KHAKI },
      irregular4: { helm: 'bandana', gun: 'smg', pack: 'none', light: true, band: '#7a2e28', tint: IRR_KHAKI },
      irregular5: { helm: 'bandana', gun: 'smg', pack: 'none', light: true, band: '#7a2e28', tint: IRR_KHAKI },
      irregular6: { helm: 'boonie', gun: 'smg', pack: 'none', light: true, tint: IRR_OLIVE },
      irregular7: { helm: 'boonie', gun: 'smg', pack: 'none', light: true, tint: IRR_OLIVE },
      irregular8: { helm: 'boonie', gun: 'smg', pack: 'none', light: true, tint: IRR_OLIVE },
      nomad: { helm: 'std', gun: 'battlerifle', pack: 'std', cloak: true },
      nomadlead: { helm: 'std', gun: 'smg', pack: 'std', cloak: true, fitAs: 'nomad' },
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
      xdeltagun: { xeno: 'crock', rank: 'delta', gun: 'blades', bladeFire: true, big: 1.06, mz: [22, -28] },
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
      biker: { helm: 'pakol', gun: 'smg', pack: 'none', mount: true, tunic: true, vest: HOLY_A.mid, armband: 'force', young: true, tint: HOLY_A },
      biker2: { helm: 'bare', gun: 'carbine', pack: 'none', mount: true, tunic: true, vest: HOLY_C.mid, armband: 'force', young: true, tint: HOLY_C },
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
      zealotrider: { helm: 'turban', gun: 'carbine', pack: 'none', tunic: true, wrap: '#d6ceb8', vest: '#3b3a30', mount: true, tint: HOLY_A },
      leaderrider: { helm: 'goggles', gun: 'banner', plainFlag: true, pack: 'none', mount: true, mark: true, tint: FIELD_OCHRE, fitAs: 'rider' },
      leaderescort: { helm: 'goggles', gun: 'carbine', pack: 'none', mount: true, tint: FIELD_OCHRE, fitAs: 'rider' }
    };

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
    var HIP = -20;                  // where the legs meet the body, in art units
    var KNEEL_DROP = 11;            // how far a man down on one knee sinks, in art units
    var XENO_LOW = 13;              // how far a hunkered Xenotripod lets its body down
    var COLLAR = -43;               // above this, a shape is part of the head
    // the company's own colour on a tinted figure (the tint keeps it as `force`)
    function PALETTE_FORCE(pal) { return pal.force || pal.light; }
    function paintFigure(g, ox, oy, pal, kit, pose, step, s) {
      var tall = pose !== 'prone' && !kit.mount;
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
        var hood = kit.helm === 'hood' || kit.helm === 'cowl' || kit.helm === 'turban' || kit.helm === 'wrap';
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
        if (kit.nvg) {                                                // night-vision goggles
          P(14, -15, 5, 3, '#1b1f24'); P(15.5, -14.2, 2.4, 1.6, '#8fd0e8');
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
        return;
      }

      /* ---- the mount, under everything ---- */
      if (kit.mount && pose !== 'prone') {
        var mb = pose === 'kneel' ? 6 : 0;               // a shot rider slumps forward
        if (step) mb -= 1;
        if (kit.mount === 'horse') {
          /* A beast: a horse in the colony's breeding, its saddle cloth in the
             group's colours. The legs stride on the step frame. */
          var HB = kit.facewrap ? '#2c2622' : '#6e4a2c', HL = kit.facewrap ? '#48403a' : '#8e6640',
            HD = kit.facewrap ? '#161311' : '#48301c', MANE = kit.facewrap ? '#0e0c0b' : '#2a1c12';
          var fa = step ? 5 : 0, ra = step ? -4 : 1;
          // the far legs, darker, a stride out of step with the near ones
          P(10 - fa, -22 + mb, 4, 20 - mb, HD); P(9 - fa, -3, 5, 3, '#141210');
          P(-19 + ra, -22 + mb, 4, 20 - mb, HD); P(-20 + ra, -3, 5, 3, '#141210');
          P(-31, -31 + mb, 5, 3, MANE); P(-33, -29 + mb, 4, 14, MANE);   // the tail
          ellipse(g, ox - 5 * s, oy + (-26 + mb) * s, 23 * s, 8.5 * s, HB);   // the barrel of the body
          ellipse(g, ox - 6 * s, oy + (-30 + mb) * s, 19 * s, 3.8 * s, HL);
          ellipse(g, ox - 5 * s, oy + (-20 + mb) * s, 18 * s, 2.8 * s, HD);
          ellipse(g, ox - 20 * s, oy + (-26 + mb) * s, 8 * s, 8 * s, HB);    // the haunch
          // the neck, up and forward, and the head at the end of it
          g.fillStyle = HB; g.beginPath();
          g.moveTo(ox + 8 * s, oy + (-31 + mb) * s); g.lineTo(ox + 20 * s, oy + (-45 + mb) * s);
          g.lineTo(ox + 27 * s, oy + (-43 + mb) * s); g.lineTo(ox + 20 * s, oy + (-22 + mb) * s); g.closePath(); g.fill();
          g.fillStyle = MANE; g.beginPath();
          g.moveTo(ox + 8 * s, oy + (-32 + mb) * s); g.lineTo(ox + 19 * s, oy + (-47 + mb) * s);
          g.lineTo(ox + 21 * s, oy + (-45 + mb) * s); g.lineTo(ox + 11 * s, oy + (-31 + mb) * s); g.closePath(); g.fill();
          g.fillStyle = HB; g.beginPath();               // the head, long, nose down and forward
          g.moveTo(ox + 19 * s, oy + (-47 + mb) * s); g.lineTo(ox + 27 * s, oy + (-47 + mb) * s);
          g.lineTo(ox + 36 * s, oy + (-38 + mb) * s); g.lineTo(ox + 33 * s, oy + (-35 + mb) * s);
          g.lineTo(ox + 22 * s, oy + (-40 + mb) * s); g.closePath(); g.fill();
          P(31, -40 + mb, 5, 4, HD);                     // the muzzle
          P(20, -50 + mb, 2.5, 4, HB);                   // an ear
          P(25, -45 + mb, 1.6, 1.6, '#0c0a08');          // an eye
          P(24, -42 + mb, 10, 0.8, '#1a1410');           // the bridle
          // the near legs
          P(13 + fa, -22 + mb, 4.5, 20 - mb, HB); P(13 + fa, -22 + mb, 1.5, 13, HL); P(12 + fa, -3, 6, 3, '#141210');
          P(-16 - ra, -22 + mb, 4.5, 20 - mb, HB); P(-16 - ra, -22 + mb, 1.5, 13, HL); P(-17 - ra, -3, 6, 3, '#141210');
          // the saddle and its cloth in the group's colours
          P(-11, -35 + mb, 18, 9, pal.mid);
          P(-11, -35 + mb, 18, 2, pal.light);
          P(-11, -27 + mb, 18, 1, pal.dark);
          P(-7, -37 + mb, 10, 3, '#3a2a1a');
          P(-17, -30 + mb, 6, 7, '#4a3a22');             // a saddle bag
        } else if (kit.mount === 'gravbike') {
          /* A grav bike: no wheels, a long faired hull riding on its lift plates
             a hand's breadth over the ground, the plates glowing under it. */
          var hv = step ? 1 : 0;
          ellipse(g, ox + 0 * s, oy - 1 * s, 22 * s, 3 * s, 'rgba(120,220,255,' + (0.22 + hv * 0.1) + ')');
          P(-22, -13 + mb, 12, 3, '#1c1f24'); P(-21, -10.5 + mb, 10, 1.5, '#7fe0ff');   // rear lift plate
          P(10, -13 + mb, 12, 3, '#1c1f24'); P(11, -10.5 + mb, 10, 1.5, '#7fe0ff');     // front lift plate
          if (hv) { P(-20, -9 + mb, 8, 1, 'rgba(190,245,255,.7)'); P(12, -9 + mb, 8, 1, 'rgba(190,245,255,.7)'); }
          P(-24, -19 + mb, 48, 7, '#23282f');            // the hull, long and low
          P(-24, -19 + mb, 48, 2, '#3c444e');
          P(18, -22 + mb, 10, 8, '#2a2f36');             // the nose fairing, swept forward
          P(24, -20 + mb, 5, 5, '#3a424c');
          P(26, -19 + mb, 3, 2, '#e8c15a');              // its lamp
          P(-6, -26 + mb, 18, 8, pal.mid);               // the body panels in the group's colours
          P(-6, -26 + mb, 18, 2, pal.light);
          P(-6, -26 + mb, 5, 8, pal.light);
          P(-2, -23 + mb, 8, 3, pal.dark);               // a painted stripe
          P(12, -32 + mb, 4, 8, '#3a424c');              // the steering column
          P(10, -34 + mb, 10, 2.5, '#4a535d');           // the bars
          P(14, -30 + mb, 7, 4, 'rgba(120,200,230,.45)');  // a windscreen
          P(-26, -20 + mb, 4, 6, '#2a2f36');             // the thruster at the tail
          P(-28, -19 + mb, 2, 4, step ? '#bff3ff' : '#7fe0ff');
          if (kit.flames) { P(-4, -22 + mb, 14, 2.5, '#c9452a'); P(0, -24 + mb, 8, 2, '#e0802a'); }
        } else {
          /* A bike does not take a stride. What says it is moving is the machine
             working under the rider: the frame bouncing a pixel on the suspension,
             the front wheel turning and the exhaust smoking. */
          P(-20, -14 + mb, 40, 5, '#1c1f24');              // the frame, low and long
          P(-20, -14 + mb, 40, 2, '#333a42');
          P(-6, -24 + mb, 16, 11, pal.mid);                // fuel tank in the group's colours
          P(-6, -24 + mb, 5, 11, pal.light);
          P(-6, -24 + mb, 16, 2, pal.light);
          P(-4, -21 + mb, 6, 4, pal.dark);                 // a hand-painted stripe
          if (kit.flames) {                                 // flames painted down the tank
            P(-5, -20 + mb, 14, 3, '#c9452a');
            P(-2, -22 + mb, 9, 2, '#e0802a');
            P(2, -23 + mb, 5, 1.5, '#f2c050');
            P(-24, -20 + mb, 3, 2, '#e0802a');              // and out of the exhaust
            P(-27, -19.5 + mb, 3, 1.5, '#f2c050');
          }
          P(10, -26 + mb, 7, 6, '#2a2f36');                // cowling over the front
          P(14, -30 + mb, 4, 8, '#3a424c');                // forks
          P(12, -33 + mb, 12, 3, '#4a535d');               // bars
          P(20, -32 + mb, 3, 3, '#e8c15a');                // headlamp
          P(-14, -22 + mb, 7, 8, '#2a2419');               // saddle bags and a bedroll
          P(-14, -22 + mb, 7, 2, '#4a3a22');
          P(-18, -20 + mb, 5, 5, '#6b4a26');
          ellipse(g, ox + 18 * s, oy + (-9 + mb) * s, 9 * s, 9 * s, '#15181d');
          ellipse(g, ox + 18 * s, oy + (-9 + mb) * s, 4 * s, 4 * s, '#39414a');
          ellipse(g, ox - 16 * s, oy + (-9 + mb) * s, 10 * s, 10 * s, '#15181d');
          ellipse(g, ox - 16 * s, oy + (-9 + mb) * s, 4 * s, 4 * s, '#39414a');
          // the spokes, caught at a different angle on each frame
          if (step) {
            P(16, -12 + mb, 5, 2, '#5a636d');
            P(-18, -12 + mb, 5, 2, '#5a636d');
          } else {
            P(17, -14 + mb, 2, 6, '#5a636d');
            P(-17, -14 + mb, 2, 6, '#5a636d');
          }
          P(-24, -18 + mb, 6, 3, '#2a2f36');               // exhaust
          P(-28, -17 + mb, 5, 2, '#4a535d');
          if (step) P(-33, -19 + mb, 4, 3, 'rgba(150,146,140,.55)');   // and its smoke
        }
        if (kit.trophy) {                                 // a skull on a pole behind the saddle
          P(-19, -52 + mb, 1.5, 34, '#4a3a26');
          P(-21, -56 + mb, 6, 5, '#d8d0bc');
          P(-20, -54 + mb, 1.2, 1.2, '#1a1510'); P(-17.5, -54 + mb, 1.2, 1.2, '#1a1510');
          P(-24, -50 + mb, 5, 8, pal.cloth);
        }
      }

      /* ---- legs ---- */
      if (kit.mount && pose !== 'prone') {
        var kb = (pose === 'kneel' ? 6 : 0) - (step ? 1 : 0);
        P(-6, -30 + kb, 6, 12, pal.dark);                // thigh along the tank
        P(-6, -30 + kb, 3, 12, pal.mid);
        P(-2, -22 + kb, 6, 9, pal.dark);                 // shin dropped to the peg
        P(-3, -14 + kb, 8, 4, BOOT);
      } else if (kit.robot && pose === 'kneel') {
        /* A drone braced on one knee: struts and joints rather than cloth, the
           rear shin a strut laid along the ground, the front one a piston. */
        P(-7, -11, 3, 8, RB.strut);                      // rear thigh strut
        P(-9, -5, 5, 5, RB.joint); P(-8.5, -4.5, 1.5, 1.5, pal.light);   // knee joint, down
        P(-18, -3, 10, 2.4, RB.strut); P(-18, -3, 10, 0.8, pal.light);   // shin along the ground
        P(-21, -4, 4, 4, RB.foot);
        P(-1, -12, 10, 3, RB.strut); P(-1, -12, 10, 1, pal.light);       // front thigh, level
        P(7, -14, 5, 5, RB.joint); P(7.5, -13.5, 1.5, 1.5, pal.light);   // raised knee joint
        P(8, -9, 2.4, 6, RB.piston); P(9.2, -9, 0.8, 6, 'rgba(0,0,0,.35)');
        P(5, -3, 9, 3, RB.foot); P(5, -3, 9, 0.8, pal.light);            // the splayed foot
        P(5, -0.6, 9, 0.6, '#08090c');
      } else if (kit.robot) {
        // thin jointed legs: a strut to the knee, a piston below it, a flat splayed foot
        var rl = step ? [4, 0] : [0, 3];
        for (var RL = 0; RL < 2; RL++) {
          var rx = RL ? 2 : -6, rlift = rl[RL];
          P(rx, -20 + rlift, 3.5, 8, RB.strut);          // thigh strut
          P(rx, -20 + rlift, 1.2, 8, pal.light);
          P(rx - 0.5, -13 + rlift, 4.5, 4.5, RB.joint);  // knee joint
          P(rx, -12.5 + rlift, 1.5, 1.5, pal.light);
          P(rx + 0.8, -9 + rlift, 2, 6, RB.piston);      // shin piston
          P(rx + 2.2, -9 + rlift, 0.8, 6, 'rgba(0,0,0,.35)');
          P(rx - 1.5, -3 + rlift, 7, 3, RB.foot);        // foot
          P(rx - 1.5, -3 + rlift, 7, 0.8, pal.light);
          P(rx - 1.5, -0.6 + rlift, 7, 0.6, '#08090c');
        }
      } else if (pose === 'kneel') {
        /* Down on one knee: the rear knee on the ground with the shin laid out
           behind and the toes tucked, the front thigh level out to a raised knee
           and the shin straight down to a planted boot. */
        P(-8, -10, 7, 8, pal.dark);                      // rear thigh, down to the ground
        P(-8, -10, 3, 8, pal.mid);
        P(-9, -4, 6, 4, pal.helm);                       // its knee pad, on the ground
        P(-17, -4, 9, 4, pal.dark);                      // the shin laid out behind
        P(-17, -4, 9, 1.2, pal.mid);
        P(-21, -6, 5, 6, BOOT);                          // toes tucked under
        P(-21, -1, 5, 1, '#08090c');
        P(-1, -11, 12, 6, pal.dark);                     // front thigh, level out to the knee
        P(-1, -11, 12, 2, pal.mid);
        P(7, -12, 5, 4, pal.helm);                       // knee pad, up at the front
        P(7.5, -12, 3.5, 1, kit.blackPads ? '#4a4e4a' : pal.light);
        P(6, -7, 6, 4, pal.dark);                        // the shin, straight down
        P(6, -7, 2, 4, pal.mid);
        P(5, -4, 9, 4, BOOT);                            // the planted boot
        P(5, -4, 3, 1, '#3a3f47');
        P(5, -1, 9, 1, '#08090c');
      } else if (kit.armoured) {
        // powered armour is heavy: it lifts a foot, but not far
        var aL = step ? [3, 0] : [0, 2];
        P(-8, -21 + aL[0], 6, 21, pal.dark);             // armoured greaves
        P(-8, -21 + aL[0], 3, 21, pal.mid);
        P(2, -21 + aL[1], 6, 21, pal.dark);
        P(2, -21 + aL[1], 3, 21, pal.mid);
        P(-9, -5 + aL[0], 8, 5, BOOT); P(1, -5 + aL[1], 9, 5, BOOT);
        P(-8, -14 + aL[0], 6, 3, pal.helm); P(2, -14 + aL[1], 6, 3, pal.helm);
        // the plates are separate pieces: seams, rivets and a lit upper edge
        P(-8, -18 + aL[0], 6, 0.75, 'rgba(0,0,0,.35)'); P(2, -18 + aL[1], 6, 0.75, 'rgba(0,0,0,.35)');
        P(-8, -14 + aL[0], 6, 0.75, pal.light); P(2, -14 + aL[1], 6, 0.75, pal.light);
        P(-6.5, -9 + aL[0], 1, 1, pal.light); P(3.5, -9 + aL[1], 1, 1, pal.light);
        P(-9, -1 + aL[0], 8, 1, '#08090c'); P(1, -1 + aL[1], 9, 1, '#08090c');
      } else {
        var lifts = step ? [4, 0] : [0, 3];
        for (var L = 0; L < 2; L++) {
          var lx = L ? 1 : -7, lift = lifts[L];
          P(lx, -20 + lift, 6, 16, pal.dark);
          P(lx, -20 + lift, 2, 8, pal.mid);              // the thigh catches the light
          P(lx + 0.5, -11 + lift, 1.5, 7, pal.mid);      // and the shin, a little less
          P(lx + 4.5, -19 + lift, 1, 15, 'rgba(0,0,0,.28)');  // the crease in shadow
          if (kit.blackPads) {                           // a shin guard up to the knee
            P(lx, -12 + lift, 6, 8, pal.helm); P(lx + 0.5, -11 + lift, 1.2, 6, '#3c403c');
          }
          P(lx, -12 + lift, 6, 3, pal.helm);             // knee pad
          P(lx + 0.5, -12 + lift, 4, 1, kit.blackPads ? '#4a4e4a' : pal.light);      // and its hard top edge
          P(lx - 1, -4 + lift, 8, 4, BOOT);              // boot
          P(lx - 1, -4 + lift, 3, 1, '#3a3f47');         // the toe cap, scuffed pale
          P(lx - 1, -1 + lift, 8, 1, '#08090c');         // and the sole
        }
      }

      /* ---- pack, behind the torso ---- */
      var px = tx + tw - 1;
      if (kit.cape) {                                     // a long red cape streaming back
        P(px - 2, -44 + drop, 8, 30, pal.cloth);
        P(px + 4, -40 + drop, 5, 24, pal.cloth);
        P(px + 7, -34 + drop, 3, 16, pal.cloth);
        P(px - 2, -44 + drop, 3, 30, 'rgba(0,0,0,.28)');
        P(px + 6, -36 + drop, 1, 18, 'rgba(255,255,255,.12)');
      }
      switch (kit.pack) {
        case 'jetpack':                                   // twin jump jets on a heavy frame
          P(px - 1, -46 + drop, 9, 22, pal.dark);
          P(px - 1, -46 + drop, 9, 2, pal.helm);
          P(px + 1, -48 + drop, 4, 26, '#2a2f36');        // the two burners
          P(px + 5, -47 + drop, 4, 25, '#20252b');
          P(px + 1, -48 + drop, 1.5, 26, '#4a535d');
          P(px + 1, -23 + drop, 8, 3, '#15181d');         // their nozzles
          P(px + 2, -21 + drop, 6, 1, '#c96a2a');
          P(px - 1, -38 + drop, 3, 6, pal.helm);          // a fuel line
          break;
        case 'radio':
          P(px, -41 + drop, 9, 19, '#39413a');           // man-pack set
          P(px, -41 + drop, 9, 2, '#5c6659');
          P(px + 1, -37 + drop, 6, 4, pal.light);        // faceplate
          P(px + 2, -30 + drop, 4, 2, GUN.hot);
          P(px + 5, -70 + drop, 2, 30, '#4d564a');       // long whip antenna
          P(px + 4, -74 + drop, 4, 4, pal.light);        // pennant at the tip
          P(px - 2, -34 + drop, 3, 9, '#2a2f2a');        // handset cord
          break;
        case 'medic':
          P(px, -38 + drop, 7, 13, pal.dark);
          P(px + 1, -35 + drop, 5, 7, '#dfe8ef');
          P(px + 2, -34 + drop, 2, 5, '#c8384f');
          P(px + 1, -32 + drop, 5, 2, '#c8384f');
          break;
        case 'ammo':
          P(px, -33 + drop, 8, 11, '#4a4a33');
          P(px, -33 + drop, 8, 2, '#6d6d4a');
          P(px + 1, -28 + drop, 5, 1, GUN.hot);
          break;
        case 'charges':
          P(px, -37 + drop, 7, 12, pal.dark);
          P(px + 1, -35 + drop, 5, 3, '#8a5a2a');
          P(px + 1, -29 + drop, 5, 3, '#8a5a2a');
          break;
        case 'dish':
          P(px, -38 + drop, 6, 12, pal.dark);
          P(px + 2, -48 + drop, 1, 10, GUN.md);
          P(px - 1, -52 + drop, 8, 4, GUN.lt);           // dish
          P(px, -50 + drop, 6, 1, '#8fb8cc');
          break;
        case 'tanks':
          P(px, -40 + drop, 4, 17, '#3f4a3a');            // twin cylinders
          P(px + 4, -40 + drop, 4, 17, '#4d5a46');
          P(px, -40 + drop, 8, 2, '#6a7a60');
          P(px + 2, -42 + drop, 3, 2, GUN.md);            // regulator
          break;
        case 'missile':
          P(px, -38 + drop, 5, 13, pal.dark);
          P(px + 1, -44 + drop, 3, 12, '#4a4438');        // spare rocket
          P(px + 1, -46 + drop, 3, 3, '#8a5a2a');
          break;
        case 'mortarbase':
          P(px, -36 + drop, 7, 12, pal.dark);
          P(px - 1, -24 + drop, 9, 4, GUN.md);            // baseplate slung low
          P(px - 1, -24 + drop, 9, 1, GUN.lt);
          break;
        case 'minerpack':                                 // power cell, hose and a coil of cord
          P(px, -40 + drop, 8, 16, '#4a4030');
          P(px, -40 + drop, 8, 2, '#6d5e42');
          P(px + 1, -36 + drop, 5, 4, '#e0a33a');         // charge indicator
          P(px + 1, -35 + drop, 3, 1, '#ffe9a8');
          P(px + 6, -30 + drop, 3, 9, '#2c2c32');         // hose down to the cutter
          P(px - 1, -23 + drop, 9, 4, '#7a4a1e');         // det cord, coiled
          P(px, -22 + drop, 7, 1, '#b0742e');
          break;
        case 'none': break;
        default:
          P(px, -39 + drop, 7, 14, pal.dark);
          P(px, -39 + drop, 7, 1, pal.mid);
          P(px + 1, -33 + drop, 4, 1, pal.helm);
      }

      if (kit.armoured) armourPack(P, pal, drop, px);
      if (PACK_DETAIL[kit.pack]) PACK_DETAIL[kit.pack](P, pal, drop, px);

      /* ---- torso ---- */
      P(tx, -40 + drop, tw, 20, pal.mid);
      P(tx, -40 + drop, 5, 20, pal.light);               // lit side
      P(tx - 1, -41 + drop, sw, 2, pal.light);           // shoulder line
      P(tx, -22 + drop, tw, 3, pal.dark);                // belt
      P(tx + 2, -20 + drop, 4, 4, pal.helm);             // pouches
      P(tx + tw - 6, -20 + drop, 4, 4, pal.helm);
      if (kit.armoured) {
        P(tx + 1, -39 + drop, tw - 2, 11, pal.light);    // chest plate
        P(tx + 1, -39 + drop, tw - 2, 1, '#e8eef6');
        P(tx + 1, -28 + drop, tw - 2, 2, pal.dark);
        P(-2, -37 + drop, 4, 7, pal.helm);
        P(-0.5, -39 + drop, 1, 11, 'rgba(255,255,255,.22)');   // the breastplate's ridge
        P(tx + 2, -33 + drop, tw - 4, 0.75, 'rgba(0,0,0,.3)');  // where two plates overlap
        P(tx + 2, -25 + drop, tw - 4, 0.75, 'rgba(0,0,0,.35)'); // segments over the gut
        P(tx + 2, -23 + drop, tw - 4, 0.75, 'rgba(0,0,0,.35)');
        P(tx + 2, -36 + drop, 1, 1, pal.dark); P(tx + tw - 3, -36 + drop, 1, 1, pal.dark);   // bolts
        P(-1, -36 + drop, 2, 1, '#5fd0f0');              // a status light
      } else if (kit.robot) {
        /* A drone's chassis: a chest housing over a narrow spine, panel seams,
           a cooling grille and a single status light. No webbing, no pouches. */
        // the housing painted to the squad it stands in for: grey plate for the
        // assault drones, a green shell for the recon drones
        var hsg = kit.vest ? ['#383c42', '#51575f'] : kit.pouches ? ['#4c5c30', '#6a7a44'] : [pal.mid, pal.light];
        P(tx, -40 + drop, tw, 13, hsg[0]);               // the chest housing
        P(tx, -40 + drop, 4, 13, hsg[1]);
        P(tx, -27 + drop, tw, 1, 'rgba(0,0,0,.45)');     // its lower edge
        P(-3, -26 + drop, 6, 7, RB.joint);               // the exposed spine at the waist
        P(-3, -25 + drop, 6, 0.8, pal.light); P(-3, -23 + drop, 6, 0.8, pal.light); P(-3, -21 + drop, 6, 0.8, pal.light);
        P(tx + 1, -22 + drop, tw - 2, 3, pal.helm);      // hip plate
        P(tx + 1, -22 + drop, tw - 2, 0.8, pal.light);
        P(-0.4, -40 + drop, 0.8, 13, 'rgba(0,0,0,.35)'); // centre seam
        P(tx + 2, -34 + drop, tw - 4, 0.7, 'rgba(0,0,0,.3)');
        [0, 1, 2].forEach(function (gi) { P(2, -38 + drop + gi * 1.6, 5, 0.8, '#23272c'); });   // cooling grille
        P(-5, -37 + drop, 3, 3, '#1b1e22'); P(-4.5, -36.5 + drop, 2, 2, RB.eye);   // status light
        P(-3, -43 + drop, 7, 2, RB.joint);               // neck mount
      } else if (kit.vest) {
        /* Assault troops: a dark grey plate carrier over the fatigues, so they
           read at a glance as something heavier than the rifle line — a front
           plate, shoulder straps, rows of webbing and a cummerbund at the waist. */
        var V = '#383c42', VL = '#51575f', VD = '#24272c';
        P(tx + 1, -40 + drop, tw - 2, 16, V);            // the carrier
        P(tx + 1, -40 + drop, 4, 16, VL);                // its lit side
        P(tx + 1, -41 + drop, 4, 2, VD);                 // shoulder straps
        P(tx + tw - 5, -41 + drop, 4, 2, VD);
        P(tx + 1, -41 + drop, 4, 0.75, VL);
        P(-5, -39 + drop, 10, 9, VD);                    // the front plate pocket
        P(-5, -39 + drop, 10, 0.75, '#6b727b');          // its edge catching the light
        P(-4, -36 + drop, 8, 0.75, 'rgba(0,0,0,.45)');   // webbing rows across it
        P(-4, -34 + drop, 8, 0.75, 'rgba(0,0,0,.45)');
        P(-4, -32 + drop, 8, 0.75, 'rgba(0,0,0,.45)');
        P(-4, -29 + drop, 3, 4, V); P(1, -29 + drop, 3, 4, V);   // magazine pouches
        P(-4, -29 + drop, 3, 0.75, VL); P(1, -29 + drop, 3, 0.75, VL);
        P(tx + 1, -25 + drop, tw - 2, 3, VD);            // cummerbund
        P(tx + 1, -25 + drop, tw - 2, 0.75, VL);
        P(-3, -43 + drop, 7, 2, VD);                     // collar
      } else {
        /* A Y-harness: two straps coming in from the shoulders to a band of
           pouches. Drawn straight up and down they made a '#' on every chest. */
        P(-6, -41 + drop, 1.5, 1.5, pal.dark);           // straps, stepping in from the shoulders
        P(-5, -40 + drop, 1.5, 1.5, pal.dark);
        P(-4, -39 + drop, 1.5, 2, pal.dark);
        P(5, -41 + drop, 1.5, 1.5, pal.dark);
        P(4, -40 + drop, 1.5, 1.5, pal.dark);
        P(3, -39 + drop, 1.5, 2, pal.dark);
        P(-5, -37 + drop, 10, 4, pal.dark);              // the band of pouches
        P(-5, -37 + drop, 10, 0.75, pal.mid);            // its top edge, catching the light
        P(-2, -37 + drop, 0.75, 4, 'rgba(0,0,0,.4)');    // and the gaps between pouches
        P(1.5, -37 + drop, 0.75, 4, 'rgba(0,0,0,.4)');
        P(-3, -43 + drop, 7, 2, pal.dark);               // collar
      }
      if (!kit.robot) {
        P(-1, -22 + drop, 3, 3, '#8a8f98');              // belt buckle
        P(-1, -22 + drop, 3, 1, '#c9cdd4');
        P(tx + 2, -20 + drop, 4, 1, pal.light);          // pouch flaps catching the light
        P(tx + tw - 6, -20 + drop, 4, 1, pal.light);
      }
      if (!kit.armoured && !kit.robot && !kit.robe && !kit.cloak && !kit.tunic && pose !== 'prone') {
        // the torso tapers from the chest to the waist, not a box all the way down
        carve([[tx - 0.5, -32 + drop], [tx + 2.2, -22 + drop], [tx - 0.5, -22 + drop]]);
        carve([[tx + tw + 0.5, -32 + drop], [tx + tw - 2.2, -22 + drop], [tx + tw + 0.5, -22 + drop]]);
      }
      if (kit.badge) P(tx + 1, -38 + drop, 3, 3, kit.badge);
      if (kit.mark) P(tx + 1, -25 + drop, 2, 2, '#c8384f');
      if (kit.ragged) {                                   // work clothes, patched and open
        P(tx, -34 + drop, 4, 3, pal.dark);
        P(tx + tw - 5, -30 + drop, 4, 3, pal.dark);
        P(tx + 3, -21 + drop, tw - 6, 2, pal.dark);       // a hem that was never finished
        P(-6, -38 + drop, 3, 16, pal.cloth);              // an open shirt over a vest
        P(3, -38 + drop, 3, 16, pal.cloth);
      }
      if (kit.armband) {                                  // the group's colour, worn to be seen
        // penal troops wear the company's own colour on the arm, over the prison coveralls
        if (kit.armband !== 'force') {                  // (the penal band goes on over the sleeve, below)
          P(-15 - b, -37 + drop, 6, 4, '#c8384f');
          P(-15 - b, -37 + drop, 6, 1, '#e4657f');
        }
      }
      if (kit.tunic) {
        /* A long shirt to the knee over loose trousers, a dark waistcoat over
           it, and a chest rig of magazine pouches across the front. */
        P(tx - 1, -41 + drop, tw + 2, 25, pal.mid);
        P(tx - 1, -41 + drop, 5, 25, pal.light);
        P(tx + tw - 2, -40 + drop, 2, 23, pal.dark);      // the fall of the cloth
        P(tx, -18 + drop, tw, 2, pal.dark);               // the hem
        P(tx + 1, -41 + drop, tw - 2, 15, kit.vest || '#3b3a30');
        P(tx + 1, -41 + drop, 3, 15, 'rgba(255,255,255,.12)');
        P(-1.5, -41 + drop, 3, 15, pal.mid);              // the shirt showing down the front
        P(-6, -32 + drop, 12, 5, '#4a4030');              // chest rig
        P(-6, -32 + drop, 12, 1, '#6a5a40');
        P(-2.5, -32 + drop, 0.75, 5, 'rgba(0,0,0,.4)'); P(1.5, -32 + drop, 0.75, 5, 'rgba(0,0,0,.4)');
      }
      if (kit.sash) {                                     // a sash, shoulder to hip
        // 'force': in the side's own colour, the brightest thing on him
        var shc = kit.sash === 'force' ? vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.25) : kit.sash;
        for (var sh2 = 0; sh2 < 6; sh2++) P(tx + tw - 5 - sh2 * 2.4, -41 + drop + sh2 * 3.2, 4, 3.4, shc);
        if (kit.sash === 'force') for (var sh3 = 0; sh3 < 6; sh3++) P(tx + tw - 5 - sh3 * 2.4, -41 + drop + sh3 * 3.2, 4, 0.8, 'rgba(255,255,255,.3)');
      }
      if (kit.blade) {                                    // a curved sword at the belt, gold at the hilt
        P(tx + tw - 3, -27 + drop, 2.4, 13, '#2a1f14');      // the scabbard
        P(tx + tw - 2.2, -15 + drop, 3, 2, '#2a1f14');       // curving at the tip
        P(tx + tw - 4, -29.5 + drop, 5, 1.6, '#e0b43a');     // the guard
        P(tx + tw - 2.6, -32.5 + drop, 1.8, 3.2, '#c9a13a'); // the grip
        P(tx + tw - 2.8, -33.4 + drop, 2.2, 1.2, '#f0cf6a'); // the pommel
      }
      if (kit.grenades) {                                 // a belt hung with grenades, and a bandolier of them
        for (var gr2 = 0; gr2 < 5; gr2++) {
          P(tx + 1 + gr2 * (tw - 3) / 4, -24 + drop, 3, 3.5, '#4a5a34');
          P(tx + 1.5 + gr2 * (tw - 3) / 4, -24.5 + drop, 1.5, 1, '#8a8f98');
        }
        for (var gr3 = 0; gr3 < 4; gr3++) {
          P(tx + 3 + gr3 * 3.2, -39 + drop + gr3 * 3.4, 3, 3, '#4a5a34');
          P(tx + 3.5 + gr3 * 3.2, -39.5 + drop + gr3 * 3.4, 1.2, 1, '#8a8f98');
        }
      }
      if (kit.leathers) {                                 // a leather jacket, zipped, collar up
        P(tx, -40 + drop, tw, 18, pal.mid);
        P(tx, -40 + drop, 4, 18, 'rgba(255,255,255,.12)');
        P(-0.5, -40 + drop, 1, 18, '#8a8f98');             // the zip
        P(tx - 1, -42 + drop, 5, 4, pal.dark); P(tx + tw - 4, -42 + drop, 5, 4, pal.dark);
        if (kit.band) P(tx, -30 + drop, tw, 2, kit.band);
      }
      if (kit.bandolier) {                                // a belt of rounds across the chest
        for (var bd = 0; bd < 7; bd++) {
          P(tx + 1 + bd * (tw - 4) / 6, -40 + drop + bd * 2.6, 3, 2.2, '#4a3a22');
          P(tx + 1.8 + bd * (tw - 4) / 6, -40.4 + drop + bd * 2.6, 1.2, 1, '#b8923a');
        }
      }
      if (kit.pouches && !kit.armoured && !kit.robot) {                 // light infantry: a green smock and chest rig
        var GS = '#4c5c30', GSL = '#6a7a44', GSD = '#37431f';
        P(tx + 1, -41 + drop, tw - 2, 17, GS);            // the smock over the torso
        P(tx + 1, -41 + drop, 4, 17, GSL);                // its lit side
        P(tx + tw - 3, -41 + drop, 2, 17, GSD);           // and the shaded one
        P(tx + 3, -27 + drop, 4, 2, GSD); P(tx + tw - 8, -35 + drop, 4, 2, GSD);   // mottling
        P(tx + 2, -25 + drop, tw - 4, 1.5, GSD);          // the hem at the belt
        P(-3, -43 + drop, 6, 2, GSD);                     // collar
        P(-6, -38 + drop, 12, 5, kit.pouches);
        P(-6, -38 + drop, 12, 1, 'rgba(255,255,255,.2)');
        P(-6, -32 + drop, 5, 4, kit.pouches); P(1, -32 + drop, 5, 4, kit.pouches);
        P(-2, -38 + drop, 0.75, 5, 'rgba(0,0,0,.4)'); P(2, -38 + drop, 0.75, 5, 'rgba(0,0,0,.4)');
      }
      if (kit.dress) {
        /* Dress uniform, more of it the higher the command: a plain tunic and one
           shoulder board for the 4th grade; both boards and a ribbon bar for the
           3rd; the same under a peaked cap for the 2nd; a long greatcoat for the
           1st; and the greatcoat trimmed in gold for high command. */
        var lvl = kit.dress, DT = pal.dark, GOLD = '#e8c15a', GOLD_D = '#a8842c';
        var coat = lvl >= 4, hem = coat ? -9 : -23, len = hem - (-42);
        P(tx - (coat ? 1 : 0), -42 + drop, tw + (coat ? 2 : 0), len, DT);
        P(tx - (coat ? 1 : 0), -42 + drop, tw + (coat ? 2 : 0), len, 'rgba(18,20,26,.55)');   // a dress cloth, not field drab
        P(tx - (coat ? 1 : 0), -42 + drop, 3, len, 'rgba(255,255,255,.12)');
        P(tx + tw - 1 + (coat ? 1 : 0), -42 + drop, 1, len, lvl >= 5 ? GOLD : pal.light);    // piping down the front edge
        P(-3, -44 + drop, 6, 2, '#e9e4d6');               // the shirt collar
        P(-1, -43 + drop, 2, 3, '#20242a');               // and tie
        if (coat) {
          /* the greatcoat: wide lapels, two rows of buttons, a half belt, and
             the skirt falling open over the legs */
          P(-5, -42 + drop, 3, 8, 'rgba(0,0,0,.28)'); P(2, -42 + drop, 3, 8, 'rgba(0,0,0,.28)');   // lapels
          for (var cb = 0; cb < 3; cb++) {
            P(-3.5, -34 + drop + cb * 4, 1.4, 1.4, GOLD); P(2, -34 + drop + cb * 4, 1.4, 1.4, GOLD);
          }
          P(-0.5, -24 + drop, 1, 15, 'rgba(0,0,0,.35)');   // where the skirt parts
          P(tx - 1, -11 + drop, tw + 2, 2, 'rgba(0,0,0,.3)');   // the hem in shadow
          P(tx - 1, -26 + drop, tw + 2, 2.5, 'rgba(0,0,0,.4)'); // the half belt
          P(-1, -26 + drop, 2.5, 2.5, GOLD);
          P(tx - 1, -26 + drop, 3, 4, DT); P(tx + tw - 2, -26 + drop, 3, 4, DT);   // turned-back cuffs
          if (lvl >= 5) {
            P(tx - 1, -42 + drop, tw + 2, 1.2, GOLD);     // gold along the collar
            P(tx - 1, -11 + drop, tw + 2, 1.2, GOLD);     // and the hem
            P(-5, -42 + drop, 1, 8, GOLD); P(4, -42 + drop, 1, 8, GOLD);   // the lapel edges
            P(tx - 1, -26 + drop, 3, 1, GOLD); P(tx + tw - 2, -26 + drop, 3, 1, GOLD);   // cuff braid
            P(tx + tw - 2, -41 + drop, 2, 13, GOLD + 'cc');     // an aiguillette in loops
            P(tx + tw - 4, -30 + drop, 3, 1.5, GOLD + 'cc');
          }
        } else {
          for (var bt = 0; bt < 4; bt++) P(1, -39 + drop + bt * 4, 1.4, 1.4, GOLD);   // buttons down the tunic
          P(tx, -27 + drop, tw, 2.5, '#3a2a1a');          // the belt
          P(-1, -27 + drop, 2.5, 2.5, GOLD);              // its buckle
        }
        // ribbons from the 3rd grade, a second row from the 1st
        if (lvl >= 2) {
          P(tx + 2, -39 + drop, 6, 1.4, '#c8384f'); P(tx + 2, -37.6 + drop, 6, 1.4, '#3a6fb0');
        }
        if (lvl >= 4) { P(tx + 2, -36.2 + drop, 6, 1.4, GOLD); P(tx + 2, -34.8 + drop, 6, 1.4, '#4f8a4a'); }
      }
      if (kit.heavyplate) {
        /* Protectors: a second skin of plate over the suit — a thick breastplate
           edged in the company colour, a plated girdle, a gorget under the helm. */
        P(tx, -41 + drop, tw, 13, pal.helm);
        P(tx, -41 + drop, tw, 2, pal.light);
        P(tx, -41 + drop, 4, 13, 'rgba(255,255,255,.14)');
        P(tx + 2, -29 + drop, tw - 4, 1.5, pal.dark);
        P(-3, -39 + drop, 6, 9, pal.mid);                 // the centre plate
        P(-3, -39 + drop, 6, 1, '#e8eef6');
        P(tx + 1, -26 + drop, tw - 2, 4, pal.helm);       // the girdle
        P(tx + 1, -26 + drop, tw - 2, 1, pal.light);
        P(-1, -22 + drop, 2, 1, '#5fd0f0');
      }
      if (kit.robe) {                                     // a pilgrim's robe, down to the boots
        P(tx - 3, -42 + drop, tw + 6, 26, pal.mid);
        P(tx - 3, -42 + drop, 6, 26, pal.light);
        P(tx + tw + 1, -42 + drop, 2, 24, pal.dark);
        P(tx - 2, -18 + drop, tw + 4, 4, pal.dark);       // the hem, dragging
        P(-2, -40 + drop, 3, 22, pal.dark);               // the fall of the cloth
        P(tx - 1, -30 + drop, tw + 2, 3, pal.cloth);      // a rope belt
        P(-4, -28 + drop, 9, 6, pal.cloth);               // prayer strips knotted at the waist
        P(-3, -24 + drop, 2, 8, pal.light);
        P(2, -24 + drop, 2, 7, pal.light);
      }

      /* ---- arms ---- */
      var aw = 5 + b;
      if (kit.robot) {
        // strut arms with a ball elbow and a clamp for a hand
        P(-12 - b, -39 + drop, 3, 6, RB.strut); P(-12 - b, -39 + drop, 1, 6, pal.light);
        P(-13 - b, -34 + drop, 4.5, 4.5, RB.joint); P(-12.5 - b, -33.5 + drop, 1.4, 1.4, pal.light);
        P(-12 - b, -30 + drop, 2.6, 3, RB.piston);
        P(-14 - b, -28 + drop, 6, 3, RB.foot); P(-14 - b, -28 + drop, 1.2, 3, '#5a6068');   // the clamp
        P(tx + tw - 1, -38 + drop, 3, 5, RB.strut);
        P(tx + tw - 1.5, -34 + drop, 4, 4, RB.joint);
        P(tx + tw - 0.5, -30 + drop, 2.4, 3, RB.piston);
      } else {
      P(-13 - b, -39 + drop, aw, 13, pal.mid);           // forward arm, down to the grip
      P(-13 - b, -39 + drop, 2, 13, pal.light);
      P(-13 - b, -33 + drop, aw, 1, 'rgba(0,0,0,.30)');  // the elbow, bent
      P(-12 - b, -32 + drop, aw - 1, 1, pal.light);      // and the sleeve pulled over it
      P(-14 - b, -28 + drop, aw + 2, 3, BOOT);           // glove
      P(-13.5 - b, -28 + drop, 2, 1, '#454b54');         // knuckles catching the light
      P(tx + tw - 2, -38 + drop, aw, 11, pal.mid);       // rear arm
      P(tx + tw + aw - 3, -38 + drop, 1, 11, 'rgba(0,0,0,.30)');  // its far side in shadow
      }
      if (kit.sleeves === 'rolled') {
        /* shirt sleeves rolled to above the elbow: bare forearms and hands, the
           roll of cloth a lit band at the top of each */
        var FA = '#caa07e', FAD = '#8d6a4c';
        P(-13 - b, -37 + drop, aw, 10, FA);
        P(-13 - b, -37 + drop, 1.5, 10, '#e2b995');
        P(-13 - b + aw - 1.4, -37 + drop, 1.4, 10, FAD);
        P(-14 - b, -39 + drop, aw + 2, 2.4, pal.light);   // the rolled cuff
        P(-14 - b, -39 + drop, aw + 2, 0.7, 'rgba(255,255,255,.35)');
        P(-14 - b, -36.8 + drop, aw + 2, 0.9, pal.dark);
        P(-14 - b, -28 + drop, aw + 2, 3, FAD);          // bare hand on the grip
        P(-13.5 - b, -28 + drop, 2, 1, FA);
        P(tx + tw - 2, -33 + drop, aw, 6, FAD);
        P(tx + tw - 2.5, -35 + drop, aw + 1, 2.4, pal.light);
        P(tx + tw - 2.5, -32.8 + drop, aw + 1, 0.8, pal.dark);
      }
      if (kit.forceBelt) {
        // the partisans' one bit of uniform: a belt in the company's colour, buckled
        P(tx - 0.5, -27 + drop, tw + 1, 2.6, PALETTE_FORCE(pal));
        P(tx - 0.5, -27 + drop, tw + 1, 0.8, 'rgba(255,255,255,.3)');
        P(-1.2, -27.2 + drop, 2.6, 3, '#c9b37a');
      }
      if (kit.armband === 'force') {
        // penal troops: a band in the company's own colour round the upper arm, over the coveralls
        var abc = pal.forceDark ? PALETTE_FORCE(pal) : pal.light;
        abc = vividHex(pal.forceMid || abc, 3, 1.3);    // the armband is the brightest thing on him, convict or rebel
        P(-14 - b, -37.5 + drop, aw + 2, 4.2, abc);
        P(-14 - b, -37.5 + drop, aw + 2, 0.9, 'rgba(255,255,255,.35)');
        P(-14 - b, -34.1 + drop, aw + 2, 0.8, 'rgba(0,0,0,.35)');
      }
      P(tx - 2 - b, -41 + drop, 6 + b, 3, pal.helm);     // shoulder, barely a pad
      P(tx + tw - 3, -41 + drop, 6 + b, 3, pal.helm);
      P(tx - 1.5 - b, -41 + drop, 4 + b, 1, kit.blackPads ? '#4a4e4a' : pal.light);  // the pad's rounded top
      if (kit.forcePad) {
        // drones: the left shoulder plate alone in the company's colour
        var fpc = vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.25);
        P(tx - 3 - b, -42 + drop, 7 + b, 4.5, fpc);
        P(tx - 3 - b, -42 + drop, 7 + b, 1, 'rgba(255,255,255,.35)');
        P(tx - 3 - b, -38.3 + drop, 7 + b, 0.8, 'rgba(0,0,0,.35)');
      }
      if (kit.forceShoulders) {
        // miners: the shoulders of the work suit painted in the company's colour
        var fsc = PALETTE_FORCE(pal), fsd = pal.forceMid || pal.mid;
        P(tx - 3 - b, -42 + drop, 7 + b, 4, fsc); P(tx - 3 - b, -39 + drop, 7 + b, 1, fsd);
        P(tx + tw - 4, -42 + drop, 7 + b, 4, fsc); P(tx + tw - 4, -39 + drop, 7 + b, 1, fsd);
      }
      if (kit.plates) {
        /* bolted-on armour plate: a breastplate over the work suit, plates on
           the upper arms under the painted shoulders, and greaves on the shins */
        var PL = '#5d6168', PLL = '#8a9098', PLD = '#34373c';
        P(tx + 1, -38 + drop, tw - 2, 9, PL);
        P(tx + 1, -38 + drop, tw - 2, 1.2, PLL);
        P(tx + 1, -30 + drop, tw - 2, 1, PLD);
        P(tx + 2, -35 + drop, 1, 1, PLL); P(tx + tw - 3, -35 + drop, 1, 1, PLL);   // the bolts
        P(tx + 2, -32 + drop, 1, 1, PLL); P(tx + tw - 3, -32 + drop, 1, 1, PLL);
        P(-14 - b, -38 + drop, aw + 2, 5, PL); P(-14 - b, -38 + drop, aw + 2, 1, PLL);
        P(tx + tw - 3, -37 + drop, aw + 1, 4, PL);
        if (pose === 'stand' && !kit.mount) {
          var gl = step ? [4, 0] : [0, 3];
          [-7, 1].forEach(function (lx, li) {
            P(lx, -11 + gl[li], 6, 6, PL); P(lx, -11 + gl[li], 6, 1, PLL); P(lx + 5, -10 + gl[li], 1, 5, PLD);
          });
        }
      }
      if (kit.dress) {
        /* dress sleeves in the same dark cloth as the tunic, cuffs at the wrist,
           and the shoulder boards over the top: one for the 4th grade, two from
           the 3rd, fringed in gold for high command */
        var lv = kit.dress, GD = '#e8c15a', GDD = '#a8842c', SL = 'rgba(18,20,26,.55)';
        [[-13 - b, -39, 13], [tx + tw - 2, -38, 11]].forEach(function (am) {
          P(am[0], am[1] + drop, aw, am[2], pal.dark); P(am[0], am[1] + drop, aw, am[2], SL);
          P(am[0], am[1] + am[2] - 2 + drop, aw, 1.2, lv >= 5 ? GD : lv >= 4 ? GDD : 'rgba(255,255,255,.18)');   // cuff
        });
        P(-13 - b, -39 + drop, 1.5, 13, 'rgba(255,255,255,.12)');
        if (lv >= 5) { P(-14 - b, -28 + drop, aw + 2, 3, '#e9e4d6'); P(-14 - b, -26 + drop, aw + 2, 1, '#b8b2a2'); }   // white gloves
        var ew = 6 + b, ec = lv >= 3 ? GD : GDD;
        [[tx - 2 - b, lv >= 1], [tx + tw - 3, lv >= 2]].forEach(function (ep) {
          if (!ep[1]) { P(ep[0], -41 + drop, ew, 3, pal.dark); P(ep[0], -41 + drop, ew, 3, SL); return; }
          P(ep[0], -42 + drop, ew, 3, ec);                // the board
          P(ep[0], -42 + drop, ew, 0.8, '#f4d98a');
          P(ep[0] + ew / 2 - 0.7, -41.5 + drop, 1.4, 1.4, '#6a5a2a');   // its button
          if (lv >= 5) for (var fr = 0; fr < 4; fr++) P(ep[0] + 0.5 + fr * (ew - 1) / 3, -39 + drop, 0.9, 2.2, GD);   // bullion fringe
        });
      }
      if (kit.armoured) {
        // pauldrons: great curved plates, lit on top and hard-edged below
        var pld = kit.forceShoulders ? (pal.forceMid || pal.mid) : pal.helm;   // a miner's, in the company colour
        P(tx - 4 - b, -45 + drop, 8 + b, 6, pld);
        P(tx - 3 - b, -46 + drop, 6 + b, 1, pld);
        P(tx - 4 - b, -45 + drop, 8 + b, 1.5, pal.light);
        P(tx - 4 - b, -39.5 + drop, 8 + b, 0.75, pal.dark);
        P(tx + tw - 4, -45 + drop, 8 + b, 6, pld);
        P(tx + tw - 3, -46 + drop, 6 + b, 1, pld);
        P(tx + tw - 4, -45 + drop, 8 + b, 1.5, pal.light);
        P(tx + tw - 4, -39.5 + drop, 8 + b, 0.75, pal.dark);
      }
      if (kit.heavyplate) {
        // a second, larger layer of pauldron, stepped like a roof
        P(tx - 4 - b, -47 + drop, 8 + b, 3, pal.helm);
        P(tx - 4 - b, -47 + drop, 8 + b, 1, pal.light);
        P(tx - 5 - b, -42 + drop, 2, 4, pal.dark);          // the plates' rolled edges
        P(tx + tw - 4, -47 + drop, 8 + b, 3, pal.helm);
        P(tx + tw - 4, -47 + drop, 8 + b, 1, pal.light);
        P(tx + tw + 3, -42 + drop, 2, 4, pal.dark);
        P(-7, -20 + drop, 5, 5, pal.helm); P(3, -20 + drop, 5, 5, pal.helm);   // thigh plates
        P(-7, -20 + drop, 5, 1, pal.light); P(3, -20 + drop, 5, 1, pal.light);
      }
      if (kit.spikes) {                                   // spikes along the shoulders
        [tx - 3 - b, tx, tx + tw - 3, tx + tw].forEach(function (sx) {
          P(sx, -46 + drop, 2, 3, '#8a8f98');
          P(sx + 0.5, -48 + drop, 1, 2, '#c3c8d0');
        });
      }

      if (kit.cloak) {
        /* Nomads: line infantry under a camouflage cloak — a mantle over the
           shoulders and a cape down the back to the knee, broken up with
           blotches of green and brown, the hood hanging behind the helmet.
           The chest and rifle stay clear, so they read as soldiers. */
        var CM = '#5a6438', CL = '#76804c', CD = '#3a4226', CB = '#6e5a3a';
        P(tx - 3, -44 + drop, tw + 5, 5, CM);             // the mantle across the shoulders
        P(tx - 3, -44 + drop, tw + 5, 1.5, CL);
        P(tx + 4, -42 + drop, 5, 3, CB); P(tx + tw - 5, -43 + drop, 4, 3, CD);
        P(tx - 6, -41 + drop, 8, 28, CM);                 // the cape down the back
        P(tx - 6, -41 + drop, 2, 28, CL);
        P(tx - 4, -36 + drop, 5, 4, CB); P(tx - 6, -28 + drop, 4, 5, CD);   // blotches
        P(tx - 3, -22 + drop, 4, 3, CB); P(tx - 5, -32 + drop, 3, 2, CL);
        P(tx - 6, -14 + drop, 3, 2, CM); P(tx - 1, -14 + drop, 3, 2, CM);   // ragged hem
        P(tx - 6, -13 + drop, 8, 1, CD);
        P(tx + tw - 1, -40 + drop, 3, 10, CM);            // the cloak's front edge falling past the arm
        P(tx + tw - 1, -34 + drop, 3, 3, CD);
        P(-10, -52 + drop, 6, 8, CM);                     // the hood thrown back behind the helmet
        P(-10, -52 + drop, 6, 2, CL);
        P(-9, -48 + drop, 3, 3, CB);
      }

      /* ---- head ---- */
      if (kit.robot) P(-1, -46 + drop, 3, 5, RB.piston); // a neck piston, not a neck
      else P(-2, -45 + drop, 5, 4, pal.dark);            // neck
      var bodyPal = pal;
      if (pal.hat) {                                     // the helmet in the company's colour
        pal = {}; for (var bk2 in bodyPal) pal[bk2] = bodyPal[bk2];
        pal.helm = bodyPal.hat; pal.light = bodyPal.hatLit; pal.dark = bodyPal.hatDark;
        if (kit.helm === 'beret') pal.mid = bodyPal.hat;   // a beret is all colour
      }
      switch (kit.helm) {
        case 'hood':
          P(-7, -53 + drop, 14, 9, pal.cloth);
          P(-7, -53 + drop, 5, 9, pal.dark);
          P(-8, -45 + drop, 5, 5, pal.cloth);             // cowl hanging at the neck
          P(0, -49 + drop, 7, 3, GLASS);
          P(0, -49 + drop, 2, 1, '#4e5c6a');
          break;
        case 'cap':
          P(-6, -50 + drop, 13, 4, pal.helm);
          P(-9, -49 + drop, 4, 2, pal.dark);              // peak
          P(-6, -51 + drop, 13, 1, pal.light);
          P(-4, -46 + drop, 10, 5, '#8d6f4e');            // face
          P(0, -45 + drop, 5, 2, GLASS);                  // shades
          P(-4, -46 + drop, 2, 5, '#6b5238');
          break;
        case 'heavy':
          P(-7, -54 + drop, 14, 10, pal.helm);
          P(-7, -54 + drop, 5, 9, pal.light);
          P(-5, -55 + drop, 10, 2, pal.helm);
          P(0, -50 + drop, 8, 4, GLASS);
          P(0, -50 + drop, 2, 1, '#4e5c6a');
          P(-8, -47 + drop, 2, 5, pal.dark);              // neck guard
          P(4, -56 + drop, 3, 2, pal.dark);               // crest fitting
          break;
        case 'bot':
          /* a drone's sensor head: a low wedge, wider than it is tall, with one
             lit optic band across the front and a stub aerial */
          P(-6, -53 + drop, 14, 7, pal.helm);
          P(-6, -53 + drop, 5, 7, pal.light);
          P(-4, -54.5 + drop, 10, 1.5, pal.helm);
          P(-6, -47 + drop, 14, 1, 'rgba(0,0,0,.4)');     // the jaw line
          P(0, -51 + drop, 8.5, 2.6, '#101418');          // the optic band
          P(1, -50.6 + drop, 6.5, 1.4, RB.eye);
          P(4.5, -50.8 + drop, 2, 1.8, '#e9fbff');        // the lens, brightest
          P(-5, -58 + drop, 1, 4, RB.joint);              // stub aerial
          P(-5.3, -59 + drop, 1.6, 1.4, RB.eye);
          break;
        case 'sealed':
          P(-7, -56 + drop, 15, 12, pal.helm);
          P(-7, -56 + drop, 5, 11, pal.light);
          P(-5, -58 + drop, 11, 2, pal.helm);
          P(-1, -51 + drop, 9, 3, '#2a1410');
          P(-1, -51 + drop, 9, 1, GUN.hot);               // lit eye slit
          P(-8, -45 + drop, 16, 3, pal.dark);             // collar seal
          break;
        case 'welder':
          P(-7, -53 + drop, 14, 9, pal.helm);
          P(-7, -53 + drop, 5, 9, pal.light);
          P(-1, -50 + drop, 8, 5, '#23180f');             // welding plate
          P(-1, -50 + drop, 8, 1, '#c8843a');
          P(1, -48 + drop, 3, 1, '#e8a13a');
          P(-8, -46 + drop, 2, 4, pal.dark);
          break;
        case 'scarf':
          P(-5, -52 + drop, 11, 8, '#8d6f4e');            // head
          P(-5, -52 + drop, 4, 8, '#6f573b');
          P(-6, -53 + drop, 13, 4, pal.cloth);            // headscarf
          P(-6, -53 + drop, 13, 1, pal.light);
          P(-8, -50 + drop, 3, 6, pal.cloth);             // tail hanging loose
          P(1, -47 + drop, 4, 2, '#20262d');
          break;
        case 'bare':
          P(-5, -52 + drop, 11, 8, '#8d6f4e');            // head
          P(-5, -52 + drop, 4, 8, '#6f573b');
          P(-5, -53 + drop, 11, 2, '#2e2419');            // hair
          P(1, -49 + drop, 4, 2, '#20262d');              // eyes in shadow
          if (kit.collar) {
            P(-4, -45 + drop, 9, 3, '#2a2f36');           // explosive collar
            P(1, -45 + drop, 2, 2, '#e0557a');
          }
          break;
        case 'wrap':                                      // a headwrap pulled over the face
          P(-6, -53 + drop, 13, 9, pal.cloth);
          P(-6, -53 + drop, 4, 9, pal.dark);
          P(-2, -49 + drop, 8, 3, '#20262d');             // the slit left for the eyes
          P(-2, -49 + drop, 3, 1, '#4e5c6a');
          P(-8, -47 + drop, 4, 8, pal.cloth);             // the tail, hanging
          P(-8, -40 + drop, 3, 4, pal.helm);
          break;
        case 'sidecap':                                  // a folded garrison cap, no peak
          P(-4, -47 + drop, 10, 6, '#8d6f4e');            // face
          P(-4, -47 + drop, 2, 6, '#6b5238');
          P(-7, -52 + drop, 14, 4, '#3a3024');            // hair at the sides
          P(3, -46 + drop, 1.5, 1.2, '#1c1a18');          // eye
          P(6, -45 + drop, 1, 2, '#7a5c3e');              // nose
          P(-7, -55 + drop, 13, 4, pal.mid);              // the cap, set on the head
          P(-6, -56 + drop, 10, 2, pal.mid);              // its folded ridge
          P(-7, -55 + drop, 13, 1, pal.light);
          P(-7, -52 + drop, 13, 1, '#e8c15a');            // the gold piping along its edge
          P(-5, -54 + drop, 2, 2, '#e8c15a');             // rank pin
          break;
        case 'peaked':                                   // an officer's service cap: wide crown, band, badge, peak
          P(-4, -47 + drop, 10, 6, '#8d6f4e');            // face
          P(-4, -47 + drop, 2, 6, '#6b5238');
          P(3, -46 + drop, 1.5, 1.2, '#1c1a18');          // eye
          P(6, -45 + drop, 1, 2, '#7a5c3e');              // nose
          P(-7, -52 + drop, 15, 3, pal.helm);             // the band
          P(-9, -56 + drop, 18, 4, pal.mid);              // the crown, wider than the head
          P(-9, -56 + drop, 18, 1, pal.light);
          P(-7, -52 + drop, 15, 1, '#e8c15a');            // gold braid on the band
          P(0, -55 + drop, 3, 3, '#e8c15a');              // cap badge
          P(4, -50 + drop, 7, 2, '#15171b');              // the peak, black and polished
          P(4, -50 + drop, 7, 0.6, '#5a6070');
          if (kit.goldpeak) {                             // oak leaves on the peak, a gold cord across it
            P(5, -49.4 + drop, 5, 1, '#e8c15a');
            P(-7, -51.2 + drop, 15, 0.8, '#f4d98a');
            P(-9, -56 + drop, 18, 0.8, '#e8c15a');
          }
          break;
        case 'beret':
          P(-6, -51 + drop, 13, 4, pal.mid);              // the group's colour, worn flat
          P(-6, -52 + drop, 9, 2, pal.light);
          P(5, -52 + drop, 4, 3, pal.dark);               // the fold over one ear
          P(-5, -47 + drop, 11, 7, '#8d6f4e');            // face
          P(-5, -47 + drop, 3, 7, '#6b5238');
          P(0, -45 + drop, 5, 2, '#20262d');
          P(-5, -46 + drop, 11, 1, '#2e2419');            // hair under the rim
          break;
        case 'cowl':                                      // a pilgrim's hood, face in shadow
          P(-8, -55 + drop, 16, 11, pal.cloth);
          P(-8, -55 + drop, 5, 11, pal.light);
          P(-6, -57 + drop, 12, 2, pal.cloth);
          P(-1, -50 + drop, 8, 6, '#1a1712');             // nothing but dark inside
          P(1, -48 + drop, 3, 1, '#c8843a');              // one eye catching the light
          P(-9, -46 + drop, 6, 8, pal.cloth);             // the cowl down over the shoulder
          P(-9, -40 + drop, 5, 4, pal.dark);
          break;
        case 'goggles':                                   // a rider's scarf and dust goggles
          P(-5, -52 + drop, 11, 8, '#8d6f4e');
          P(-5, -52 + drop, 4, 8, '#6f573b');
          P(-6, -53 + drop, 13, 3, pal.helm);             // a strip of cloth round the skull
          P(-3, -49 + drop, 10, 4, '#1b1f24');            // goggles
          P(-3, -49 + drop, 10, 1, '#4b545d');
          P(0, -48 + drop, 3, 2, '#8fd0e8');              // lens glare
          P(5, -48 + drop, 3, 2, '#8fd0e8');
          P(-4, -44 + drop, 9, 3, pal.cloth);             // scarf round the mouth
          P(-8, -44 + drop, 4, 6, pal.cloth);
          break;
        case 'balaclava':
          P(-6, -53 + drop, 13, 9, pal.dark);
          P(-6, -53 + drop, 4, 9, pal.helm);
          P(-1, -50 + drop, 7, 2, '#c9b28a');             // the strip of face left out
          P(-1, -50 + drop, 3, 1, '#20262d');
          P(-7, -45 + drop, 15, 3, pal.dark);             // rolled at the neck
          break;
        case 'hardhat':                                   // mining helmet, lamp lit
          P(-7, -52 + drop, 15, 7, pal.helm);
          P(-7, -52 + drop, 5, 7, pal.light);
          P(-9, -50 + drop, 4, 2, pal.helm);              // brim
          P(7, -50 + drop, 3, 2, pal.helm);
          P(-1, -53 + drop, 4, 2, pal.light);             // crown rib
          P(-6, -51 + drop, 4, 3, '#ffe9a8');             // the lamp
          P(-10, -50 + drop, 4, 2, 'rgba(255,233,168,.55)');
          P(-4, -45 + drop, 10, 5, '#8d6f4e');            // face below the brim
          P(-4, -45 + drop, 3, 5, '#6b5238');
          P(1, -44 + drop, 4, 2, '#20262d');
          P(-5, -41 + drop, 11, 3, '#2a2f36');            // dust mask at the chin
          break;
        case 'turban':                                    // a turban wound round the head, a beard below
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(1, -48 + drop, 4, 1.5, '#20262d');
          P(-4, -45 + drop, 10, 4, '#2a2118');            // the beard
          P(-2, -42 + drop, 7, 2, '#2a2118');
          var wrc = kit.wrap === 'force' ? vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.15) : (kit.wrap || '#d6ceb8');
          P(-7, -57 + drop, 15, 8, wrc);
          P(-7, -57 + drop, 5, 8, 'rgba(255,255,255,.18)');
          P(-6, -54 + drop, 13, 0.75, 'rgba(0,0,0,.2)');  // the turns of the cloth
          P(-6, -52 + drop, 13, 0.75, 'rgba(0,0,0,.18)');
          P(-9, -52 + drop, 3, 11, wrc);                  // the tail down the back
          P(-9, -52 + drop, 1, 11, 'rgba(0,0,0,.2)');
          if (kit.facewrap) {                              // the end of it wound across the face
            P(-5, -47 + drop, 11, 5, kit.wrap === 'force' ? vividHex(pal.forceMid || PALETTE_FORCE(pal), 3, 1.15) : (kit.wrap || '#d6ceb8'));
            P(-5, -47 + drop, 11, 0.8, 'rgba(255,255,255,.15)');
          }
          break;
        case 'pakol':                                     // a round flat wool cap, rolled at the brim
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(1, -48 + drop, 4, 1.5, '#20262d');
          P(-4, -45 + drop, 10, 4, '#3a2c1c');
          P(-2, -42 + drop, 6, 2, '#3a2c1c');
          P(-7, -54 + drop, 15, 4, '#6b5a44');            // the roll
          P(-7, -54 + drop, 15, 1, '#8a765a');
          P(-6, -57 + drop, 13, 3, '#7d6a51');            // the flat crown
          P(-6, -57 + drop, 5, 3, '#94805f');
          break;
        case 'boonie':                                    // a bush hat, brim pulled down
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(0, -48 + drop, 6, 2, '#15181d');              // dark glasses
          P(-4, -44 + drop, 9, 1.5, '#5a4632');           // stubble
          P(-6, -56 + drop, 12, 5, pal.cloth);
          P(-6, -56 + drop, 4, 5, 'rgba(255,255,255,.15)');
          P(-6, -52 + drop, 12, 1, pal.dark);             // the band
          P(-10, -51 + drop, 20, 2, pal.cloth);           // the brim, all round
          P(-10, -51 + drop, 20, 0.75, 'rgba(255,255,255,.15)');
          break;
        case 'bandana':                                   // a cloth tied over the head, knot at the back
          P(-5, -52 + drop, 11, 9, '#8d6f4e');
          P(-5, -52 + drop, 4, 9, '#6f573b');
          P(1, -49 + drop, 4, 1.5, '#20262d');
          P(-4, -44 + drop, 9, 1.5, '#3a2c1c');
          P(-6, -55 + drop, 13, 4, kit.band || '#7a2e28');
          P(-6, -55 + drop, 13, 1, 'rgba(255,255,255,.2)');
          P(-9, -53 + drop, 3, 3, kit.band || '#7a2e28');  // the knot and its ends
          P(-10, -50 + drop, 2, 4, kit.band || '#7a2e28');
          break;
        case 'biker':                                     // an open-face helmet, visor up, a bandana over the mouth
          P(-5, -50 + drop, 11, 7, '#8d6f4e');
          P(-5, -50 + drop, 4, 7, '#6f573b');
          P(-3, -48 + drop, 9, 2.5, '#15181d');           // sunglasses
          P(-4, -45 + drop, 10, 3, kit.band || '#3a3e44');
          P(-7, -56 + drop, 15, 7, pal.helm);
          P(-7, -56 + drop, 5, 5, '#4a4e56');
          P(-7, -51 + drop, 3, 6, pal.helm);              // the sides, down over the ears
          P(6, -51 + drop, 2, 5, pal.helm);
          P(-5, -57 + drop, 11, 1.2, '#c0392b');          // a painted stripe
          P(-1, -58 + drop, 8, 2, '#3a3e44');             // the visor, pushed up
          break;
        case 'spiked':                                    // a blackened helmet crowned with spikes
          P(-4, -45 + drop, 9, 3, '#8d6f4e');
          P(-3, -45 + drop, 8, 2, '#c9c2b0');             // a skull mouth-guard
          P(-1, -45 + drop, 0.6, 2, '#2a2118'); P(1.5, -45 + drop, 0.6, 2, '#2a2118');
          P(-7, -55 + drop, 15, 10, pal.helm);
          P(-7, -55 + drop, 5, 10, '#454a52');
          P(-5, -56 + drop, 11, 2, pal.helm);
          P(0, -51 + drop, 8, 3, '#8c1f1f');              // red goggles
          P(1, -51 + drop, 2, 1, '#e05a4a');
          P(-5, -61 + drop, 2, 5, '#8a8f98'); P(-1, -62 + drop, 2, 6, '#8a8f98'); P(3, -60 + drop, 2, 4, '#8a8f98');
          P(-4.5, -61 + drop, 1, 2, '#c3c8d0'); P(-0.5, -62 + drop, 1, 2, '#c3c8d0');
          break;
        case 'protector':                                 // the Protectors' great helm: crested, a T-visor
          P(-8, -58 + drop, 17, 14, pal.helm);
          P(-8, -58 + drop, 6, 13, pal.light);
          P(-6, -60 + drop, 13, 2, pal.helm);
          P(-4, -62 + drop, 9, 2, pal.dark);              // the crest
          P(-4, -62 + drop, 9, 0.75, pal.light);
          P(0, -53 + drop, 9, 2, '#15181d');              // the T of the visor
          P(3, -53 + drop, 3, 6, '#15181d');
          P(0, -53 + drop, 9, 0.75, '#5fd0f0');
          P(-9, -50 + drop, 3, 7, pal.dark);              // cheek guard
          P(-9, -45 + drop, 19, 3, pal.dark);             // the gorget
          P(-9, -45 + drop, 19, 1, pal.helm);
          break;
        case 'riot':
          P(-8, -54 + drop, 16, 11, pal.helm);
          P(-8, -54 + drop, 5, 10, pal.light);
          P(-6, -56 + drop, 12, 2, pal.helm);
          P(-3, -50 + drop, 11, 6, '#1b2732');            // full face visor
          P(-3, -50 + drop, 11, 1, '#5b7284');
          P(-9, -44 + drop, 17, 3, pal.dark);             // gorget
          break;
        case 'mask':
          P(-6, -52 + drop, 13, 8, pal.helm);
          P(-6, -52 + drop, 4, 8, pal.light);
          P(-2, -48 + drop, 8, 5, '#23282e');             // respirator
          P(0, -45 + drop, 5, 3, '#3e4a44');              // filter canister
          P(0, -48 + drop, 3, 1, '#6fa08c');              // lens
          P(-7, -46 + drop, 2, 4, pal.dark);
          break;
        default:
          P(-4, -46 + drop, 9, 3, '#8d6f4e');             // the face under the rim
          P(-4, -46 + drop, 3, 3, '#6b5238');
          P(-6, -53 + drop, 13, 8, pal.helm);
          P(-6, -53 + drop, 4, 8, pal.light);
          P(-4, -54 + drop, 9, 2, pal.helm);              // crown
          P(-3, -55 + drop, 6, 1, pal.helm);              // rounded off at the top
          P(-3, -55 + drop, 3, 1, pal.light);
          P(-5, -53.5 + drop, 3, 1, '#f0e2c2');           // the dome's highlight
          P(-7, -46 + drop, 15, 1.5, pal.dark);           // the rim, all the way round
          P(-7, -46 + drop, 5, 0.75, pal.light);
          P(0, -49 + drop, 7, 3, GLASS);                  // visor
          P(0, -49 + drop, 2, 1, '#4e5c6a');              // glint
          P(4, -48.5 + drop, 2, 0.75, '#9fb6c6');         // and a second, where it curves
          P(-7, -47 + drop, 2, 4, pal.dark);              // neck guard
          P(-3, -44 + drop, 7, 1, pal.dark);              // chin strap
          P(5, -52 + drop, 2, 3, pal.dark);               // a strap clip on the side
      }

      if (HELM_DETAIL[kit.helm]) HELM_DETAIL[kit.helm](P, pal, drop);
      pal = bodyPal;
      /* Night-vision goggles, as the riders wear theirs: a dark frame over the
         eyes with the blue of the lenses, and the strap round the helmet. */
      if (kit.nvg) {
        P(-6, -52 + drop, 13, 1.2, '#1b1f24');           // the strap
        P(-3, -49 + drop, 10, 4, '#1b1f24');             // goggles
        P(-3, -49 + drop, 10, 1, '#4b545d');
        P(0, -48 + drop, 3, 2, '#8fd0e8');               // lens glare
        P(5, -48 + drop, 3, 2, '#8fd0e8');
      }

      /* ---- weapon, over everything ---- */
      var wy = -32 + drop;
      switch (kit.gun) {
        case 'long':
          P(-7, wy, 34, 2, GUN.dk);
          P(12, wy - 4, 9, 3, GUN.md);                   // scope
          P(14, wy - 5, 3, 1, GUN.lt);
          P(25, wy + 2, 1, 6, GUN.md); P(28, wy + 2, 1, 6, GUN.md);
          P(-9, wy - 1, 5, 4, GUN.md);                   // stock
          break;
        case 'mg':
          P(-2, wy - 1, 28, 4, GUN.dk);
          P(-2, wy - 1, 28, 1, GUN.lt);
          P(4, wy + 3, 9, 3, '#8a7a3a');                 // ammo belt
          P(8, wy + 6, 6, 2, '#a89550');
          P(19, wy + 3, 1, 8, GUN.md); P(23, wy + 3, 1, 8, GUN.md);
          P(26, wy, 5, 3, GUN.lt);                       // flash hider
          break;
        case 'carbine':
          P(-2, wy, 17, 3, GUN.dk);
          P(0, wy + 3, 7, 6, GUN.md);                    // drum
          P(15, wy + 1, 4, 2, GUN.lt);
          P(-7, wy + 1, 6, 3, GUN.md);
          break;
        case 'heavy':
          if (kit.shoulderGL) {
            /* The Protectors' grenade launcher: an armoured box pod riding on the
               back and over the shoulder, a stubby muzzle at its front face. */
            var gy = wy - 20, bx = -25;
            P(bx, gy, 15, 12, GUN.md);                    // the box, on the back behind the shoulder
            P(bx, gy, 15, 2, GUN.lt);                     // its lit top
            P(bx, gy, 2.5, 12, 'rgba(255,255,255,.12)');
            P(bx, gy + 10, 15, 2, GUN.dk);                // its shadowed underside
            P(bx + 3, gy + 5, 9, 0.8, 'rgba(0,0,0,.45)'); // a panel seam
            P(bx + 7, gy + 3, 0.8, 7, 'rgba(0,0,0,.45)');
            P(bx + 14, gy + 2, 4, 6, GUN.dk);             // the muzzle, over the shoulder
            P(bx + 17, gy + 2.5, 1.5, 5, '#4a5260');
            P(bx + 2, gy - 2, 4, 2, '#5fd0f0');           // a sensor lens on the lid
            P(bx + 12, gy + 12, 4, 5, GUN.dk);            // its mount on the backplate
            if (kit.shoulderMsl) {                        // a drone's missile pod: two tubes, warheads showing
              P(bx + 14, gy + 1.5, 5, 4, GUN.dk); P(bx + 14, gy + 6.5, 5, 4, GUN.dk);
              P(bx + 17.5, gy + 2.5, 2, 2, '#b8b0a0'); P(bx + 17.5, gy + 7.5, 2, 2, '#b8b0a0');
            }
          }
          P(-3, wy, 23, 4, GUN.dk);                      // heavy gun
          P(20, wy + 1, 5, 3, GUN.lt);
          break;
        case 'pistol':
          P(2, wy + 3, 9, 3, GUN.dk);
          P(10, wy + 4, 3, 1, GUN.lt);
          break;
        case 'slate':
          P(-17, wy + 1, 10, 7, GUN.md);
          P(-16, wy + 2, 8, 5, '#59c6e0');
          P(-15, wy + 3, 3, 1, '#d8f4ff');
          P(-15, wy + 5, 5, 1, '#d8f4ff');
          break;
        case 'optics':
          P(-7, wy - 9, 15, 5, GUN.md);                  // raised optics
          P(-7, wy - 9, 15, 1, GUN.lt);
          P(8, wy - 8, 2, 3, '#8fe0ff');
          P(-5, wy - 4, 3, 4, GUN.dk);
          break;
        case 'case':
          P(-19, wy + 7, 12, 9, '#dfe8ef');
          P(-19, wy + 7, 12, 1, '#f4fafd');
          P(-15, wy + 9, 3, 6, '#c8384f');
          P(-17, wy + 11, 7, 2, '#c8384f');
          break;
        case 'shotgun':
          P(-3, wy + 1, 17, 4, GUN.dk);
          P(14, wy, 5, 5, GUN.lt);                       // wide muzzle
          P(0, wy + 5, 7, 3, '#4a3a26');                 // wooden fore-end
          P(-2, wy + 5, 3, 4, GUN.md);                   // pump
          P(-8, wy + 2, 6, 4, '#4a3a26');                // stock
          break;
        case 'battlerifle':
          P(-6, wy, 30, 3, GUN.dk);                      // longer barrel than a carbine
          P(-6, wy, 30, 1, GUN.lt);
          P(12, wy - 3, 5, 3, GUN.md);                   // iron sight
          P(24, wy - 1, 7, 2, GUN.md);                   // barrel shroud
          P(29, wy, 4, 3, GUN.lt);                       // muzzle brake
          P(-1, wy + 3, 5, 8, GUN.dk);                   // long box magazine
          P(-10, wy + 1, 7, 4, GUN.md);                  // stock
          break;
        case 'saw':
          P(-6, wy - 1, 31, 4, GUN.dk);                  // squad automatic
          P(-6, wy - 1, 31, 1, GUN.lt);
          P(0, wy + 3, 9, 7, '#3c4233');                 // drum
          P(0, wy + 3, 9, 1, '#5d6650');
          P(17, wy + 3, 1, 7, GUN.md); P(21, wy + 3, 1, 7, GUN.md);   // bipod
          P(25, wy - 1, 6, 4, GUN.lt);                   // flash hider
          P(-10, wy, 6, 4, GUN.md);
          break;
        case 'smg':
          P(-3, wy + 1, 15, 3, GUN.dk);
          P(-3, wy + 1, 15, 1, GUN.lt);
          P(1, wy + 4, 4, 7, GUN.dk);                    // stick magazine
          P(12, wy + 1, 4, 2, GUN.lt);
          P(-8, wy + 1, 6, 3, GUN.md);                   // folding stock
          break;
        case 'atlauncher':
          P(-13, wy - 11, 38, 8, '#3c4438');             // a big tube over the shoulder
          P(-13, wy - 11, 38, 2, '#5a6452');
          P(-17, wy - 13, 6, 12, '#2a3026');             // venturi
          P(23, wy - 13, 7, 12, '#6a5a3a');              // warhead
          P(23, wy - 13, 7, 2, '#8a7448');
          P(2, wy - 3, 5, 5, GUN.md);                    // grip
          P(6, wy - 15, 5, 4, GUN.lt);                   // optical sight
          break;
        case 'none': break;
        case 'shell':
          P(2, wy + 2, 4, 9, '#4a4438');                 // a round, held ready
          P(2, wy + 1, 4, 2, '#8a5a2a');
          P(2, wy + 9, 4, 2, GUN.md);
          break;
        case 'flamer':
          P(-4, wy, 22, 6, '#3a3f38');                   // heavy barrel
          P(-4, wy, 22, 2, '#5c6458');
          P(18, wy - 1, 7, 8, '#6a5a3a');                // flared muzzle
          P(18, wy - 1, 7, 2, '#8a7448');
          // the pilot flame at the muzzle, licking up and flickering
          var fp = B.FLAME_PHASE < 0 ? 1 : B.FLAME_PHASE, fh = [6, 9, 7, 10][fp], fl = [0, 1, 0, -1][fp];
          P(25, wy + 6 - fh, 5, fh, '#e08a3a');
          P(26 + fl, wy + 6 - fh - 3, 3, 3, '#e08a3a');
          P(26, wy + 6 - Math.ceil(fh * 0.65), 3, Math.ceil(fh * 0.65), '#ffc861');
          P(-8, wy + 5, 7, 3, '#2f3a34');                // fuel line to the tanks
          P(-6, wy + 3, 4, 3, GUN.md);
          break;
        case 'console':
          P(-16, wy + 2, 11, 8, '#2b3038');
          P(-15, wy + 3, 9, 6, '#3fa87f');
          P(-14, wy + 4, 4, 1, '#c9f6e2');
          P(-14, wy + 6, 6, 1, '#c9f6e2');
          break;
        case 'huntingrifle':                              // a long civilian rifle, wooden stock
          P(-6, wy, 28, 2, GUN.dk);
          P(-9, wy - 1, 8, 4, '#6b4a26');                // stock
          P(-9, wy - 1, 8, 1, '#8d6535');
          P(2, wy - 1, 7, 2, '#6b4a26');                 // fore-end
          P(9, wy - 3, 5, 2, GUN.md);                    // a hunting scope, taped on
          P(22, wy - 1, 3, 1, GUN.lt);
          break;
        case 'molotov':                                   // a bottle, a rag, and a lighter
          P(-13, wy - 2, 5, 8, '#3f6a3a');
          P(-13, wy - 2, 2, 8, '#6aa05f');
          P(-12, wy - 6, 3, 4, '#d8cfae');               // the rag
          P(-12, wy - 8, 3, 2, '#e08a3a');
          P(-12, wy - 10, 2, 2, '#ffc861');              // lit
          P(2, wy + 2, 12, 2, GUN.dk);                   // a pistol on the other hip
          P(2, wy + 4, 3, 4, GUN.md);
          break;
        case 'machete':                                   // a blade, held high
          P(-11, wy - 1, 4, 5, '#4a3a22');               // grip
          P(-9, wy - 22, 4, 22, '#8d98a4');              // the blade
          P(-9, wy - 22, 2, 22, '#c6d0da');
          P(-9, wy - 24, 5, 3, '#9aa6b2');               // the tip
          P(-12, wy - 3, 7, 2, '#2b2318');               // guard
          break;
        case 'lascutter':                                 // a mining cutter, beam struck
          P(-10, wy, 17, 5, '#4a4a52');
          P(-10, wy, 17, 2, '#6e6e78');
          P(-12, wy + 1, 4, 6, '#33333a');               // grip
          P(7, wy + 1, 6, 3, '#2a2a30');                 // emitter housing
          P(13, wy + 1, 12, 2, '#ff6a3a');               // the cutting beam
          P(13, wy + 1, 12, 1, '#ffd9a8');
          P(24, wy, 3, 4, 'rgba(255,150,80,.55)');       // the glare at the tip
          P(-6, wy + 5, 6, 3, '#7a4a1e');                // the cell on its strap
          break;
        case 'rpg': {                                     // an RPG-7, up on the shoulder
          var ry = wy - 10;
          P(-14, ry, 30, 3, '#2e2a24');                  // the tube
          P(-14, ry, 30, 1, '#57503f');
          P(-2, ry - 0.5, 9, 4, '#7a5230');              // wooden heat guard
          P(-2, ry - 0.5, 9, 1, '#9a6c40');
          P(-19, ry - 1.5, 6, 6, '#24211c');             // the flared venturi behind
          P(-20, ry - 2, 2, 7, '#3a352c');
          P(16, ry - 1, 4, 5, '#4a4a3a');                // the warhead: a neck, then the cone
          P(20, ry - 3, 6, 9, '#5a6038');
          P(20, ry - 3, 6, 2, '#7a8250');
          P(26, ry - 1.5, 3, 6, '#5a6038');
          P(29, ry + 0, 2, 3, '#3a3e26');                // the nose
          P(1, ry + 3, 3, 6, '#2e2a24');                 // grips below the tube
          P(-6, ry + 3, 3, 5, '#2e2a24');
          P(4, ry - 3, 3, 3, GUN.md);                    // the sight
          break;
        }
        case 'flagsmall': case 'flagbig': case 'flaghuge': {
          /* A flag in the side's own colour, so it is plain across the table whose
             leader this is: small for a local leader, large for a great one. */
          var huge = kit.gun === 'flaghuge', big = huge || kit.gun === 'flagbig';
          // the flag is the company's own colour (it was the revolution's red)
          var fm = pal.forceMid || pal.mid, fl2 = pal.force || pal.light, fd = pal.forceDark || pal.dark;
          var poleH = huge ? 92 : big ? 74 : 56, fw2 = huge ? 48 : big ? 36 : 24, fh2 = huge ? 32 : big ? 24 : 15;
          P(-10, wy - poleH + 8, 2, poleH, '#5b4326');
          P(-10, wy - poleH + 6, 3, 3, '#c8a33a');       // finial
          P(-8, wy - poleH + 8, fw2, fh2, fm);
          P(-8, wy - poleH + 8, fw2, 2, fl2);
          P(-8, wy - poleH + 6 + fh2, fw2, 2, fd);
          P(-8 + fw2 - 3, wy - poleH + 10, 3, fh2 - 2, fd);  // the fly, ragged and in shadow
          // plain cloth: the colour alone says whose leader this is
          P(2, wy + 2, 12, 2, GUN.dk);                   // a carbine besides
          break;
        }
        case 'banner': {                                  // the group's colours on a pole
          P(-10, wy - 40, 2, 48, '#5b4326');
          P(-10, wy - 42, 3, 3, '#c8a33a');              // finial
          P(-8, wy - 40, 20, 15, pal.forceMid || pal.mid);   // the banner, in the company's colour
          P(-8, wy - 40, 20, 3, pal.force || pal.light);
          P(-8, wy - 28, 20, 2, pal.forceDark || pal.dark);
          if (!kit.plainFlag) {                          // the star sewn on
            P(-2, wy - 37, 8, 8, '#e0b43a');
            P(1, wy - 39, 2, 12, '#e0b43a');
          }
          P(10, wy - 36, 3, 9, pal.forceDark || pal.dark);   // the trailing edge, ragged
          P(2, wy + 2, 12, 2, GUN.dk);                   // and a carbine besides
          break;
        }
        case 'megaphone':
          P(-13, wy - 2, 6, 6, '#2b3038');
          P(-7, wy - 5, 9, 12, '#b8342f');               // the horn
          P(-7, wy - 5, 4, 12, '#d8554a');
          P(2, wy - 6, 3, 14, '#8f231f');
          P(-14, wy + 4, 5, 3, '#1b1f24');               // grip
          P(6, wy + 3, 11, 2, GUN.dk);                   // a pistol in the other hand
          break;
        default:                                          // service rifle
          P(-4, wy, 24, 3, GUN.dk);
          P(-4, wy, 24, 1, GUN.lt);
          P(2, wy - 1, 10, 1, GUN.md);                   // the receiver's top rail
          P(3, wy - 1.5, 1, 0.5, GUN.lt); P(6, wy - 1.5, 1, 0.5, GUN.lt); P(9, wy - 1.5, 1, 0.5, GUN.lt);
          P(14, wy - 3, 4, 4, GUN.md);                   // sight
          P(15, wy - 2, 2, 1, '#8fd0e8');                // its lens
          P(-2, wy + 3, 6, 5, GUN.dk);                   // magazine
          P(-2, wy + 3, 1, 5, GUN.md);                   // curved, lit down one edge
          P(-2, wy + 5.5, 6, 0.75, GUN.md);
          P(-6, wy + 3, 3, 3, GUN.dk);                   // pistol grip
          P(9, wy + 3, 7, 2, GUN.md);                    // foregrip
          P(9, wy + 3, 7, 0.75, GUN.lt);
          P(20, wy + 1, 5, 1, GUN.lt);                   // muzzle
          P(24, wy, 2, 3, GUN.md);                       // and its brake
          P(-9, wy + 1, 6, 3, GUN.md);                   // stock
          P(-9, wy + 1, 6, 0.75, GUN.lt);
          P(-9, wy + 3.5, 2, 0.75, '#08090c');           // the butt pad
          // the rear hand on the foregrip, over the gun — it is being held
          P(10, wy + 2, 4, 3, BOOT);
          P(10, wy + 2, 2, 1, '#454b54');
      }

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
      var y = wy + m[1];
      if (!kit.mount) y = y >= HIP ? y * LEG : y + HIP * (LEG - 1);
      return [m[0], y];
    }


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
