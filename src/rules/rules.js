/* PMC 2670 — Firefight
   Rules engine: profiles, free-measurement geometry, combat resolution.
   Everything is measured in inches on a 48" x 36" table, exactly as on the tabletop.
   A unit is a token with a 1" radius; ranges are measured edge to edge, the way you
   measure between the two closest models.
*/
(function (root) {
  'use strict';

  var BOARD = { w: 48, h: 48 };   // 4' x 4', the book's recommended table for PL1-2
  var UNIT_R = 1.0;          // token radius in inches
  var STEP = 0.5;            // movement lattice resolution in inches

  /* ---------- dice ---------- */
  function d10() { return Math.floor(Math.random() * 10); }      // reads 0-9
  function d6() { return 1 + Math.floor(Math.random() * 6); }
  // an angle brought into (-π, π]: how far one bearing is round from another
  function angleWrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  // text made safe to put into HTML, attributes included
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function d3() { return 1 + Math.floor(Math.random() * 3); }

  /* ---------- the PMC infantry list (rulebook pp. 60-71, 79) ----------
     Every infantry profile a PMC can field, verbatim. `cap` limits copies per
     army, `capPL` per Priority Level. Heavy infantry carry two Defence values:
     the second applies when the shot comes from an Anti-tank or Gauss weapon,
     which negates Battle Armour's +2. */
  var CATALOGUE = [
    /* Basic troops (p. 62) */
    { key: 'recruits', code: 'REC', name: 'Recruits', group: 'Basic troops', art: 'recruit', tier: 1, size: 8, move: 4, fp: 1, range: 18, def: 8, assault: 1, morale: 3, rules: [] },
    { key: 'enforcers', code: 'ENF', name: 'Enforcers', group: 'Basic troops', art: 'enforcer', tier: 1, size: 6, move: 3, fp: 2, range: 12, def: 9, assault: 3, morale: 3, rules: [] },
    { key: 'irregulars', code: 'IRR', name: 'Irregular troops', group: 'Basic troops', art: 'irregular', tier: 1, size: 8, move: 6, fp: 2, range: 12, def: 7, assault: 2, morale: 3, rules: [] },
    { key: 'penal', code: 'PEN', name: 'Penal troops', group: 'Basic troops', art: 'penal', tier: 1, size: 8, move: 5, fp: 1, range: 12, def: 6, assault: 2, morale: 3, rules: ['Determined', 'Expendable'], cap: 4 },

    /* Rifle infantry (p. 63) */
    { key: 'rookie', code: 'RKI', name: 'Rookie rifle team', group: 'Rifle infantry', art: 'rookie', tier: 2, size: 8, move: 4, fp: 2, range: 18, def: 9, assault: 2, morale: 4, rules: [] },
    { key: 'regular', code: 'RIF', name: 'Regular rifle team', group: 'Rifle infantry', art: 'rifle', tier: 3, size: 8, move: 5, fp: 3, range: 18, def: 10, assault: 3, morale: 5, rules: [] },
    { key: 'veterans', code: 'VET', name: 'Veterans', group: 'Rifle infantry', art: 'veteran', tier: 4, size: 8, move: 5, fp: 4, range: 18, def: 11, assault: 3, morale: 5, rules: [] },
    { key: 'rangers', code: 'RNG', name: 'Rangers', group: 'Rifle infantry', art: 'ranger', tier: 5, size: 8, move: 5, fp: 4, range: 18, def: 11, assault: 4, morale: 5, rules: ['Determined'] },

    /* Assault troops (p. 64) */
    { key: 'lighteng', code: 'LEN', name: 'Light engineer team', group: 'Assault troops', art: 'lighteng', tier: 2, size: 8, move: 6, fp: 3, range: 12, def: 8, assault: 3, morale: 4, rules: ['Sappers'] },
    { key: 'engineers', code: 'ENG', name: 'Assault engineer team', group: 'Assault troops', art: 'engineer', tier: 3, size: 8, move: 5, fp: 4, range: 12, def: 10, assault: 4, morale: 5, rules: ['Sappers'] },
    { key: 'shock', code: 'SHK', name: 'Shock troopers', group: 'Assault troops', art: 'shock', tier: 4, size: 8, move: 5, fp: 4, range: 12, def: 10, assault: 5, morale: 5, rules: ['Sappers', 'Destructive Weapon'] },
    { key: 'commandos', code: 'CDO', name: 'Commandos', group: 'Assault troops', art: 'commando', tier: 5, size: 8, move: 5, fp: 5, range: 12, def: 11, assault: 6, morale: 5, rules: ['Determined', 'Sappers', 'Destructive Weapon'] },

    /* Heavy infantry (p. 65) */
    { key: 'ecobats', code: 'EBA', name: 'Economy-class BATs', group: 'Heavy infantry', art: 'armour', tier: 2, size: 4, move: 3, fp: 3, range: 12, def: 11, defPierced: 9, assault: 3, morale: 4, rules: ['Battle Armour', 'Anti-tank (limited)'] },
    { key: 'bats', code: 'BAT', name: 'Battle armour troopers', group: 'Heavy infantry', art: 'armour', tier: 3, size: 4, move: 3, fp: 4, range: 18, def: 12, defPierced: 10, assault: 4, morale: 5, rules: ['Battle Armour', 'Anti-tank (limited)'] },
    { key: 'protectors', code: 'PRO', name: 'Protectors', group: 'Heavy infantry', art: 'protector', tier: 4, size: 4, move: 3, fp: 4, range: 18, def: 13, defPierced: 11, assault: 5, morale: 5, rules: ['Battle Armour', 'Anti-tank (limited)', 'Determined'] },
    /* Hi-mobility Protectors move on jump jets: Movement 7" in battle armour is not
   a march. It changes nothing in the rules — it is how they are drawn moving,
   and how they arrive on a Battlefield Insertion: out of the sky, not out of
   cover. */
    { key: 'protectorshm', code: 'PHM', name: 'Protectors hi-mobility', group: 'Heavy infantry', art: 'protectorhm', tier: 5, size: 4, move: 7, fp: 4, range: 18, def: 13, defPierced: 11, assault: 5, morale: 5, jets: true, rules: ['Battle Armour', 'Anti-tank (limited)', 'Determined'] },

    /* Light infantry (p. 66) */
    { key: 'observers', code: 'FO', name: 'Forward observers', group: 'Light infantry', art: 'observer', tier: 2, size: 4, move: 5, fp: 3, range: 18, def: 8, assault: 2, morale: 3, rules: ['Markerlights', 'Stealth'] },
    { key: 'sharpshooters', code: 'SHP', name: 'Sharpshooters', group: 'Light infantry', art: 'sniper', tier: 3, size: 4, move: 5, fp: 4, range: 24, def: 8, assault: 2, morale: 3, rules: ['Markerlights', 'Stealth', 'Suppressive Fire', 'Keen-Eyed'] },
    { key: 'lrrp', code: 'LRP', name: 'LRRP team', group: 'Light infantry', art: 'sniper', tier: 4, size: 4, move: 5, fp: 4, range: 24, def: 8, assault: 2, morale: 4, rules: ['Markerlights', 'Stealth', 'Gauss Weapon', 'Keen-Eyed', 'Suppressive Fire', 'Battlefield Insertion'] },
    { key: 'snipers', code: 'SNP', name: 'Sniper team', group: 'Light infantry', art: 'sniperteam', tier: 5, size: 2, move: 5, fp: 6, range: 30, def: 8, assault: 2, morale: 4, rules: ['Markerlights', 'Stealth', 'Cumbersome Weapon', 'Keen-Eyed', 'Gauss Weapon', 'Suppressive Fire', 'Battlefield Insertion'] },

    /* Light support troops (p. 67) */
    { key: 'lmgsection', code: 'LMS', name: 'Light MG section', group: 'Light support', art: 'mgsec', tier: 2, size: 3, move: 4, fp: 5, range: 24, def: 8, assault: 1, morale: 3, rules: [] },
    { key: 'lmgteam', code: 'MG', name: 'Light MG team', group: 'Light support', art: 'mg', tier: 3, size: 6, move: 4, fp: 5, range: 24, def: 8, assault: 1, morale: 4, rules: [] },
    { key: 'hmgteam', code: 'HMG', name: 'Heavy MG team', group: 'Light support', art: 'hmg', tier: 4, size: 3, move: 3, fp: 5, range: 30, def: 9, assault: 1, morale: 5, rules: ['Cumbersome Weapon', 'Suppressive Fire'] },
    { key: 'gausscannon', code: 'GAU', name: 'Gauss cannon', group: 'Light support', art: 'gauss', tier: 5, size: 3, move: 3, fp: 6, range: 30, def: 9, assault: 1, morale: 5, rules: ['Specialisation (ground)', 'Cumbersome Weapon', 'Destructive Weapon', 'Gauss Weapon', 'Anti-tank'] },

    /* Heavy support troops (p. 68) */
    { key: 'lightat', code: 'LAT', name: 'Light anti-tank team', group: 'Heavy support', art: 'antitank', tier: 2, size: 4, move: 5, fp: 4, range: 12, def: 8, assault: 1, morale: 3, rules: ['Anti-tank'] },
    { key: 'atteam', code: 'AT', name: 'Anti-tank team', group: 'Heavy support', art: 'antitank', tier: 3, size: 4, move: 4, fp: 5, range: 18, def: 9, assault: 1, morale: 4, rules: ['Destructive Weapon', 'Minimum Range (6)', 'Anti-tank'] },
    { key: 'missile', code: 'MSL', name: 'Missile-armed team', group: 'Heavy support', art: 'atgm', tier: 4, size: 4, move: 3, fp: 6, range: 30, def: 9, assault: 1, morale: 4, rules: ['Destructive Weapon', 'Cumbersome Weapon', 'Minimum Range (6)', 'Indirect Fire', 'Anti-tank'] },
    { key: 'sam', code: 'SAM', name: 'SAM team', group: 'Heavy support', art: 'samlauncher', tier: 3, size: 4, move: 3, fp: 6, range: 30, def: 9, assault: 1, morale: 4, rules: ['Specialisation (air)', 'Cumbersome Weapon', 'Indirect Fire', 'Anti-aircraft'], capPL: 1 },

    /* Remote mortar units (p. 69) */
    { key: 'mortarsection', code: 'MRS', name: 'Remote mortar section', group: 'Remote mortars', art: 'mortar', tier: 1, size: 2, move: 3, fp: 3, range: 48, def: 7, assault: 1, morale: 3, rules: ['Cumbersome Weapon', 'Indirect Fire', 'Destructive Weapon', 'Minimum Range (12)', 'Specialisation (ground)', 'Suppressive Fire'] },
    { key: 'mortarteam', code: 'MRT', name: 'Remote mortar team', group: 'Remote mortars', art: 'mortar', tier: 2, size: 4, move: 3, fp: 3, range: 48, def: 7, assault: 1, morale: 4, rules: ['Cumbersome Weapon', 'Indirect Fire', 'Destructive Weapon', 'Minimum Range (12)', 'Specialisation (ground)', 'Suppressive Fire'] },
    { key: 'mortarbattery', code: 'MRB', name: 'Remote mortar battery', group: 'Remote mortars', art: 'mortar', tier: 3, size: 8, move: 3, fp: 3, range: 48, def: 7, assault: 1, morale: 5, rules: ['Cumbersome Weapon', 'Indirect Fire', 'Destructive Weapon', 'Minimum Range (12)', 'Specialisation (ground)', 'Suppressive Fire'] },

    /* Command units (pp. 70-71) */
    { key: 'cmd4', code: 'CM4', name: 'Field command 4th grade', group: 'Command', art: 'command4', tier: 1, size: 2, move: 5, fp: 1, range: 12, def: 10, assault: 1, morale: 4, rules: ['Inspiring Presence'], command: true },
    { key: 'cmd3', code: 'CM3', name: 'Field command 3rd grade', group: 'Command', art: 'command3', tier: 2, size: 2, move: 5, fp: 1, range: 12, def: 10, assault: 1, morale: 5, rules: ['Command Unit (2)', 'Inspiring Presence'], command: true },
    { key: 'cmd2', code: 'CMD', name: 'Field command 2nd grade', group: 'Command', art: 'command2', tier: 3, size: 4, move: 5, fp: 1, range: 12, def: 10, assault: 1, morale: 5, rules: ['Command Unit (3)', 'Inspiring Presence', 'Markerlights'], command: true },
    { key: 'cmd1', code: 'CM1', name: 'Field command 1st grade', group: 'Command', art: 'command1', tier: 4, size: 6, move: 5, fp: 1, range: 12, def: 10, assault: 1, morale: 5, rules: ['Command Unit (3)', 'Inspiring Presence', 'Markerlights', 'Hackers'], command: true },
    { key: 'highcmd', code: 'HC', name: 'High command', group: 'Command', art: 'commandhi', tier: 5, size: 8, move: 5, fp: 1, range: 12, def: 10, assault: 1, morale: 5, rules: ['Command Unit (4)', 'Inspiring Presence', 'Markerlights', 'Counter-jamming', 'Hackers'], command: true, cap: 1 },

    /* EW and medic teams (p. 71) */
    { key: 'ew', code: 'EW', name: 'EW team', group: 'Support teams', art: 'ew', tier: 3, size: 2, move: 5, fp: 1, range: 12, def: 9, assault: 1, morale: 4, rules: ['Jammers', 'Counter-jamming', 'Hackers'], capPL: 1 },
    { key: 'medics', code: 'MED', name: 'Medic teams', group: 'Support teams', art: 'medic', tier: 3, size: 4, move: 5, fp: 1, range: 12, def: 9, assault: 1, morale: 4, rules: ['Field Medics'], capPL: 1 },
    // Drones (p. 72): machines in human shape, counted as infantry with the Drone unit rules (p. 40)
    { key: 'dcombat', code: 'CDR', name: 'Combat drone unit', group: 'Drones', art: 'dronecombat', tier: 3, size: 6, move: 6, fp: 3, range: 18, def: 11, assault: 2, morale: 4, rules: ['Drone unit'] },
    { key: 'dassault', code: 'ADR', name: 'Assault drone unit', group: 'Drones', art: 'droneassault', tier: 3, size: 6, move: 6, fp: 4, range: 12, def: 11, assault: 4, morale: 4, rules: ['Drone unit'] },
    { key: 'drecon', code: 'RDR', name: 'Recon drone unit', group: 'Drones', art: 'dronerecon', tier: 3, size: 3, move: 8, fp: 1, range: 18, def: 11, assault: 1, morale: 4, rules: ['Drone unit', 'Stealth', 'Markerlights', 'Keen-Eyed'] },
    { key: 'dengineer', code: 'EDR', name: 'Engineer drone unit', group: 'Drones', art: 'droneengineer', tier: 3, size: 3, move: 6, fp: 1, range: 12, def: 11, assault: 1, morale: 4, rules: ['Drone unit', 'Sappers'] },
    { key: 'dsupport', code: 'SDR', name: 'Support drone unit', group: 'Drones', art: 'dronesupport', tier: 3, size: 3, move: 5, fp: 7, range: 24, def: 11, assault: 1, morale: 4, rules: ['Drone unit', 'Indirect Fire', 'Minimum Range (6)'] },
    // the book's notes give only Field Medics, but it is a drone unit by name and section
    { key: 'dmedic', code: 'MDR', name: 'Medical drone unit', group: 'Drones', art: 'dronemedic', tier: 3, size: 3, move: 5, fp: 1, range: 12, def: 11, assault: 1, morale: 4, rules: ['Drone unit', 'Field Medics'] },

    /* Unclassified (p. 79) */
    { key: 'nomads', code: 'NOM', name: 'Nomads', group: 'Unclassified', art: 'nomad', tier: 2, size: 8, move: 5, fp: 2, range: 12, def: 7, assault: 3, morale: 3, rules: ['Stealth', 'Battlefield Insertion'], capPL: 2 },
    { key: 'chem', code: 'CHM', name: 'Chem-warriors', group: 'Unclassified', art: 'chem', tier: 3, size: 4, move: 4, fp: 8, range: 12, def: 8, assault: 5, morale: 4, rules: ['Specialisation (ground)', 'Incendiary Ammunition', 'Suppressive Fire', 'Always Basic Firepower'], cap: 2 },

    /* ---- Combat vehicles (pp. 73-74). `turn` is the inches a 90 degree
       turn costs; `str` is Structure, which stands in for Morale. ---- */
    { key: 'lpv', code: 'LPV', name: 'Light patrol vehicle', group: 'Combat vehicles', cls: 'vehicle', art: 'patrol', tier: 1, size: 1, move: 12, turn: 1, fp: 3, range: 12, def: 8, assault: 1, str: 3, rules: ['Ground vehicle'] },
    { key: 'hpv', code: 'HPV', name: 'Heavy patrol vehicle', group: 'Combat vehicles', cls: 'vehicle', art: 'acar', tier: 2, size: 1, move: 12, turn: 1, fp: 6, range: 18, def: 10, assault: 2, str: 4, rules: ['Ground vehicle'] },
    { key: 'recon', code: 'RCV', name: 'Recon vehicle', group: 'Combat vehicles', cls: 'vehicle', art: 'recontank', tier: 3, size: 1, move: 12, turn: 1, fp: 6, range: 24, def: 12, assault: 3, str: 5, rules: ['Ground vehicle', 'Markerlights'] },
    { key: 'lcv', code: 'LCV', name: 'Light combat vehicle', group: 'Combat vehicles', cls: 'vehicle', art: 'ltank', tier: 3, size: 1, move: 10, turn: 1, fp: 7, range: 24, def: 13, assault: 5, str: 6, rules: ['Ground vehicle'] },
    { key: 'mcv', code: 'MCV', name: 'Medium combat vehicle', group: 'Combat vehicles', cls: 'vehicle', art: 'mbt', tier: 4, size: 1, move: 8, turn: 2, fp: 8, range: 24, def: 15, assault: 5, str: 7, rules: ['Ground vehicle', 'Destructive Weapon', 'Specialisation (ground)'] },
    { key: 'acv', code: 'ACV', name: 'Advanced combat vehicle', group: 'Combat vehicles', cls: 'vehicle', art: 'ftank', tier: 5, size: 1, move: 10, turn: 2, fp: 9, range: 24, def: 15, assault: 5, str: 7, rules: ['Ground vehicle', 'Destructive Weapon', 'Specialisation (ground)', 'Advanced Protection'] },

    /* ---- Hunters and destroyers (p. 75) ---- */
    { key: 'lhunter', code: 'LHT', name: 'Light hunter', group: 'Hunters and destroyers', cls: 'vehicle', art: 'lhunt', tier: 2, size: 1, move: 14, turn: 1, fp: 4, range: 12, def: 9, assault: 2, str: 4, rules: ['Ground vehicle', 'Anti-tank', 'Specialisation (ground)'] },
    { key: 'hunter', code: 'HNT', name: 'Hunter', group: 'Hunters and destroyers', cls: 'vehicle', art: 'thunter', tier: 3, size: 1, move: 14, turn: 1, fp: 5, range: 18, def: 11, assault: 4, str: 5, rules: ['Ground vehicle', 'Anti-tank', 'Specialisation (ground)'] },
    { key: 'ldestroyer', code: 'LDS', name: 'Light destroyer', group: 'Hunters and destroyers', cls: 'vehicle', art: 'ldest', tier: 4, size: 1, move: 8, turn: 1, fp: 8, range: 30, def: 10, assault: 1, str: 4, rules: ['Ground vehicle', 'Limited Fire Arc', 'Destructive Weapon', 'Specialisation (ground)', 'Anti-tank', 'Cumbersome Weapon'] },
    { key: 'mdestroyer', code: 'MDS', name: 'Medium destroyer', group: 'Hunters and destroyers', cls: 'vehicle', art: 'mdest', tier: 5, size: 1, move: 8, turn: 2, fp: 9, range: 30, def: 11, assault: 2, str: 5, rules: ['Ground vehicle', 'Limited Fire Arc', 'Destructive Weapon', 'Specialisation (ground)', 'Anti-tank', 'Cumbersome Weapon'] },

    /* ---- Transport vehicles (pp. 75-76) ---- */
    { key: 'unarmoured', code: 'TRK', name: 'Unarmoured transport', group: 'Transport vehicles', cls: 'vehicle', art: 'lorry', tier: 1, size: 1, move: 10, turn: 1, fp: 1, range: 12, def: 6, assault: 1, str: 3, transport: 1, rules: ['Ground vehicle', 'Transport (1)'] },
    { key: 'ltransport', code: 'LTR', name: 'Light transport', group: 'Transport vehicles', cls: 'vehicle', art: 'hlorry', tier: 2, size: 1, move: 12, turn: 1, fp: 3, range: 12, def: 9, assault: 2, str: 3, transport: 2, rules: ['Ground vehicle', 'Transport (2)'] },
    { key: 'lapc', code: 'APC', name: 'Light APC', group: 'Transport vehicles', cls: 'vehicle', art: 'm113', tier: 3, size: 1, move: 10, turn: 1, fp: 3, range: 18, def: 12, assault: 2, str: 5, transport: 2, rules: ['Ground vehicle', 'Transport (2)'] },
    { key: 'lifv', code: 'IFV', name: 'Light IFV', group: 'Transport vehicles', cls: 'vehicle', art: 'ifv', tier: 3, size: 1, move: 10, turn: 1, fp: 6, range: 24, def: 12, assault: 4, str: 5, transport: 1, rules: ['Ground vehicle', 'Transport (1)', 'Supporting Fire'] },
    { key: 'cmdveh', code: 'CVH', name: 'Command Vehicle', group: 'Transport vehicles', cls: 'vehicle', art: 'cmdbox', tier: 3, size: 1, move: 10, turn: 1, fp: 2, range: 18, def: 13, assault: 2, str: 5, transport: 1, rules: ['Ground vehicle', 'Transport (1)', 'Command Vehicle'] },
    { key: 'hapc', code: 'HPC', name: 'Heavy APC', group: 'Transport vehicles', cls: 'vehicle', art: 'bigapc', tier: 4, size: 1, move: 8, turn: 1, fp: 3, range: 18, def: 13, assault: 3, str: 7, transport: 4, rules: ['Ground vehicle', 'Transport (4)', 'Advanced Protection'] },
    { key: 'hifv', code: 'HFV', name: 'Heavy IFV', group: 'Transport vehicles', cls: 'vehicle', art: 'bigifv', tier: 4, size: 1, move: 8, turn: 1, fp: 6, range: 24, def: 13, assault: 5, str: 7, transport: 2, rules: ['Ground vehicle', 'Transport (2)', 'Supporting Fire', 'Advanced Protection'] },

    /* Rapid insertion platforms — gliders and drop pods, "unofficially: Rest in
       Pieces" (p. 79). A one-shot ride down with no Tier of its own: it costs one
       composition point, has to start the battle with an infantry unit aboard, may
       do nothing but put them down, and is worth nothing to either side's victory
       conditions when it is shot to pieces afterwards. */
    { key: 'insertplat', code: 'RIP', name: 'Rapid insertion platform', group: 'Transport vehicles', cls: 'vehicle', art: 'pod', tier: 1, size: 1, move: 0, turn: 0, fp: null, range: 0, def: 13, assault: 0, str: 3, transport: 1, noSlot: true, mustLoad: true, rules: ['Ground vehicle', 'Transport (1)', 'Battlefield Insertion', 'Immobile', 'No Objectives'] },

    /* ---- Engineering, support, AA, EW and medical vehicles (pp. 77-79) ---- */
    { key: 'lengveh', code: 'LEV', name: 'Light engineering vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'engflame', tier: 3, size: 1, move: 10, turn: 1, fp: 8, range: 12, def: 13, assault: 5, str: 5, rules: ['Ground vehicle', 'Specialisation (ground)', 'Incendiary Ammunition', 'Suppressive Fire', 'Always Basic Firepower'], cap: 1 },
    { key: 'hengveh', code: 'HEV', name: 'Heavy engineering vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'enghow', tier: 4, size: 1, move: 6, turn: 2, fp: 10, range: 12, def: 15, assault: 5, str: 8, rules: ['Ground vehicle', 'Destructive Weapon', 'Specialisation (ground)', 'Advanced Protection'] },
    { key: 'impsupport', code: 'ISV', name: 'Improvised support vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'techmrl', tier: 2, size: 1, move: 8, turn: 2, fp: 6, range: 30, def: 8, assault: 1, str: 3, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },
    { key: 'lsupport', code: 'LSV', name: 'Light support vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'calliope', tier: 3, size: 1, move: 8, turn: 2, fp: 8, range: 48, def: 10, assault: 2, str: 4, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },
    { key: 'msupport', code: 'MSV', name: 'Medium support vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'mlrs', tier: 4, size: 1, move: 6, turn: 2, fp: 9, range: 48, def: 11, assault: 3, str: 4, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },
    { key: 'asupport', code: 'ASV', name: 'Advanced support vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'plasmatank', tier: 5, size: 1, move: 6, turn: 2, fp: 10, range: 60, def: 11, assault: 4, str: 5, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },
    { key: 'aaveh', code: 'AAV', name: 'Anti-aircraft vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'aatank', tier: 3, size: 1, move: 8, turn: 2, fp: 6, range: 48, def: 10, assault: 3, str: 4, rules: ['Ground vehicle', 'Indirect Fire', 'Specialisation (air)', 'Anti-aircraft'], capPL: 1 },
    { key: 'ewveh', code: 'EWV', name: 'EW vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'ewtank', tier: 3, size: 1, move: 10, turn: 1, fp: 3, range: 18, def: 12, assault: 2, str: 5, rules: ['Ground vehicle', 'Jammers', 'Counter-jamming', 'Hackers', 'Keen-Eyed'], cap: 1 },
    { key: 'medveh', code: 'MDV', name: 'Medical vehicle', group: 'Engineering and support', cls: 'vehicle', art: 'medbox', tier: 3, size: 1, move: 10, turn: 1, fp: 3, range: 18, def: 12, assault: 2, str: 5, rules: ['Ground vehicle', 'Field Medics'] },

    /* ---- Transport aircraft (p. 80) ---- */
    { key: 'adaptedcraft', code: 'ATC', name: 'Adapted transport craft', group: 'Transport aircraft', cls: 'aircraft', art: 'hawk', tier: 2, size: 1, move: 16, fp: 2, range: 18, def: 8, assault: 0, str: 3, transport: 1, rules: ['Flying unit', 'Transport (1)', 'Limited Fire Arc'] },
    { key: 'lightcraft', code: 'LTC', name: 'Light transport craft', group: 'Transport aircraft', cls: 'aircraft', art: 'hawk', tier: 3, size: 1, move: 20, fp: 2, range: 18, def: 11, assault: 0, str: 4, transport: 1, rules: ['Flying unit', 'Transport (1)', 'Limited Fire Arc'] },
    { key: 'heavycraft', code: 'HTC', name: 'Heavy transport craft', group: 'Transport aircraft', cls: 'aircraft', art: 'chinook', tier: 4, size: 1, move: 18, fp: 2, range: 18, def: 12, assault: 0, str: 5, transport: 2, rules: ['Flying unit', 'Transport (2)', 'Limited Fire Arc'] },
    { key: 'flyingcp', code: 'FCP', name: 'Flying command post', group: 'Transport aircraft', cls: 'aircraft', art: 'chinookcp', tier: 5, size: 1, move: 24, fp: 2, range: 18, def: 13, assault: 0, str: 6, transport: 1, rules: ['Flying unit', 'Transport (1)', 'Limited Fire Arc', 'Command Vehicle'] },

    /* ---- Strike aircraft (pp. 81-82) ---- */
    { key: 'fsc', code: 'FSC', name: 'Flexible Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'apache', tier: 3, size: 1, move: 24, fp: 7, range: 18, def: 12, assault: 0, str: 4, rules: ['Flying unit', 'Limited Fire Arc'] },
    { key: 'tsc', code: 'TSC', name: 'Transport-Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'hind', tier: 4, size: 1, move: 20, fp: 6, range: 18, def: 12, assault: 0, str: 4, transport: 1, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (1)', 'Supporting Fire'] },
    { key: 'gunboat', code: 'GNB', name: 'Gunboat', group: 'Strike aircraft', cls: 'aircraft', art: 'apacherk', tier: 4, size: 1, move: 12, fp: 9, range: 18, def: 13, assault: 0, str: 5, rules: ['Flying unit', 'Incendiary Ammunition'], cap: 1 },
    { key: 'hsc', code: 'HSC', name: 'Heavy Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'hindrk', tier: 5, size: 1, move: 16, fp: 9, range: 18, def: 13, assault: 0, str: 5, rules: ['Flying unit', 'Limited Fire Arc', 'Anti-tank'] },
    { key: 'interceptor', code: 'INT', name: 'Interceptor', group: 'Strike aircraft', cls: 'aircraft', art: 'jet', tier: 4, size: 1, move: 28, fp: 6, range: 24, def: 11, assault: 0, str: 3, rules: ['Flying unit', 'Limited Fire Arc', 'Anti-aircraft'] },
    { key: 'asc', code: 'ASC', name: 'Advanced Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'comanche', tier: 5, size: 1, move: 24, fp: 9, range: 18, def: 13, assault: 0, str: 4, rules: ['Flying unit', 'Limited Fire Arc'] },
    // Light VTOL drone (p. 82): always Drone Controlled, the extra Structure point already in its profile
    { key: 'vtoldrone', code: 'VTD', name: 'Light VTOL drone', group: 'Strike aircraft', cls: 'aircraft', art: 'vtoldrone', tier: 3, size: 1, move: 20, fp: 1, range: 12, def: 11, assault: 0, str: 4, mustDrone: true, rules: ['Flying unit', 'Limited Fire Arc', 'Markerlights', 'Stealth', 'Keen-Eyed', 'Drone Control'] },

    /* ================= THE REBEL ARMY (pp. 92-109) =================
       An insurgent force fields its own list against the same composition table.
       `faction: 'rebel'` is what keeps the two lists apart; `ridersUpgrade` marks
       the profiles a player may mount on bikes, beasts or anti-grav sleds (p. 93). */

    /* Freedom Warriors (p. 96) — the body of any revolt */
    { key: 'rciv', code: 'CIV', name: 'Armed civilians', group: 'Freedom Warriors', faction: 'rebel', art: 'civilian', tier: 1, size: 10, move: 4, fp: 1, range: 12, def: 7, assault: 1, morale: 3, rules: [] },
    { key: 'rmilitia', code: 'MIL', name: 'Militia', group: 'Freedom Warriors', faction: 'rebel', art: 'rebel', tier: 2, size: 10, move: 4, fp: 2, range: 18, def: 7, assault: 1, morale: 4, rules: [] },
    { key: 'rinsurgents', code: 'INS', name: 'Organized insurgents', group: 'Freedom Warriors', faction: 'rebel', art: 'rebel', tier: 3, size: 10, move: 4, fp: 3, range: 18, def: 8, assault: 2, morale: 4, rules: [] },
    { key: 'rhardened', code: 'HIN', name: 'Hardened insurgents', group: 'Freedom Warriors', faction: 'rebel', art: 'insurgent', tier: 4, size: 10, move: 5, fp: 3, range: 18, def: 9, assault: 3, morale: 5, rules: [] },
    { key: 'rguard', code: 'RGD', name: 'Revolutionary guard', group: 'Freedom Warriors', faction: 'rebel', art: 'guard', tier: 5, size: 10, move: 5, fp: 4, range: 18, def: 10, assault: 4, morale: 5, rules: ['Determined'] },

    /* Holy Warriors (p. 97) — poor shots, terrifying in a charge */
    { key: 'racolytes', code: 'ACO', name: 'Acolytes', group: 'Holy Warriors', faction: 'rebel', art: 'holy1', tier: 2, size: 6, move: 5, fp: 1, range: 12, def: 6, assault: 2, morale: 4, rules: ['Determined'] },
    { key: 'rfanatics', code: 'FAN', name: 'Fanatics', group: 'Holy Warriors', faction: 'rebel', art: 'holy2', tier: 3, size: 6, move: 6, fp: 1, range: 12, def: 7, assault: 4, morale: 5, rules: ['Determined', 'Inspiring Presence'], ridersUpgrade: true },
    { key: 'renlightened', code: 'ENL', name: 'Enlightened ones', group: 'Holy Warriors', faction: 'rebel', art: 'holy3', tier: 4, size: 6, move: 6, fp: 1, range: 18, def: 8, assault: 5, morale: 5, rules: ['Determined', 'Inspiring Presence'], ridersUpgrade: true },
    { key: 'rmujahideen', code: 'MUJ', name: 'Mujahideen / Crusaders / Kshatriya', group: 'Holy Warriors', faction: 'rebel', art: 'holy4', tier: 5, size: 6, move: 6, fp: 2, range: 18, def: 9, assault: 7, morale: 5, rules: ['Determined', 'Inspiring Presence'], ridersUpgrade: true },

    /* Mounted Warriors (p. 98) — flankers and living legends */
    { key: 'rridergang', code: 'RDG', name: 'Rider gang', group: 'Mounted Warriors', faction: 'rebel', art: 'ridergang', tier: 1, size: 4, move: 10, fp: 2, range: 12, def: 7, assault: 1, morale: 3, rules: ['Riders', 'Incendiary Ammunition'] },
    { key: 'rriderwar', code: 'RDW', name: 'Rider warriors', group: 'Mounted Warriors', faction: 'rebel', art: 'rider', tier: 2, size: 4, move: 10, fp: 3, range: 12, def: 7, assault: 1, morale: 4, rules: ['Riders', 'Incendiary Ammunition', 'Anti-tank (limited)'] },
    { key: 'rhellriders', code: 'HEL', name: 'Hellriders', group: 'Mounted Warriors', faction: 'rebel', art: 'hellrider', tier: 3, size: 4, move: 10, fp: 4, range: 12, def: 8, assault: 1, morale: 4, rules: ['Riders', 'Incendiary Ammunition', 'Anti-tank (limited)', 'Smoke Markers'] },
    { key: 'rlegendary', code: 'LHR', name: 'Legendary Hellriders', group: 'Mounted Warriors', faction: 'rebel', art: 'legendrider', tier: 4, size: 4, move: 12, fp: 5, range: 12, def: 9, assault: 1, morale: 4, rules: ['Riders', 'Incendiary Ammunition', 'Anti-tank (limited)', 'Determined', 'Smoke Markers'] },

    /* Support troops (p. 99) — scavenged heavy weapons, untrained crews */
    { key: 'rlmg', code: 'RMG', name: 'LMG squads', group: 'Rebel support troops', faction: 'rebel', art: 'rebelmg', tier: 2, size: 6, move: 4, fp: 3, range: 24, def: 7, assault: 1, morale: 3, rules: [] },
    { key: 'rautocannon', code: 'RAC', name: 'Light autocannon squad', group: 'Rebel support troops', faction: 'rebel', art: 'rebac', tier: 3, size: 6, move: 4, fp: 4, range: 24, def: 7, assault: 1, morale: 4, rules: [] },
    { key: 'rat', code: 'RAT', name: 'Insurgents with AT weapons', group: 'Rebel support troops', faction: 'rebel', art: 'rebelat', tier: 3, size: 6, move: 4, fp: 4, range: 24, def: 7, assault: 1, morale: 4, rules: ['Cumbersome Weapon', 'Destructive Weapon', 'Minimum Range (6)', 'Anti-tank'] },
    { key: 'raa', code: 'RAA', name: 'Insurgents with AA weapons', group: 'Rebel support troops', faction: 'rebel', art: 'rebelat', tier: 3, size: 6, move: 4, fp: 4, range: 24, def: 7, assault: 1, morale: 3, rules: ['Specialisation (air)', 'Cumbersome Weapon', 'Indirect Fire', 'Anti-aircraft'], capPL: 1 },

    /* Rebel artillery (p. 100) — captured tubes and hardened mining pipe */
    { key: 'rlightart', code: 'RLA', name: 'Rebel light artillery', group: 'Rebel artillery', faction: 'rebel', art: 'rebelmortar', tier: 2, size: 4, move: 3, fp: 3, range: 42, def: 6, assault: 1, morale: 3, rules: ['Cumbersome Weapon', 'Destructive Weapon', 'Minimum Range (12)', 'Specialisation (ground)', 'Indirect Fire'] },
    { key: 'rmedart', code: 'RMA', name: 'Rebel medium artillery', group: 'Rebel artillery', faction: 'rebel', art: 'rebelgun', tier: 3, size: 6, move: 0, fp: 4, range: 48, def: 6, assault: 1, morale: 3, rules: ['Stationary Artillery', 'Cumbersome Weapon', 'Destructive Weapon', 'Minimum Range (12)', 'Specialisation (ground)', 'Indirect Fire', 'Suppressive Fire'] },
    { key: 'rheavyart', code: 'RHA', name: 'Rebel heavy artillery', group: 'Rebel artillery', faction: 'rebel', art: 'rebelgun', tier: 4, size: 6, move: 0, fp: 5, range: 60, def: 6, assault: 1, morale: 3, rules: ['Stationary Artillery', 'Cumbersome Weapon', 'Destructive Weapon', 'Minimum Range (12)', 'Specialisation (ground)', 'Indirect Fire', 'Suppressive Fire'] },
    { key: 'rheavyac', code: 'RHC', name: 'Heavy autocannon', group: 'Rebel artillery', faction: 'rebel', art: 'rebhac', tier: 4, size: 4, move: 0, fp: 4, range: 30, def: 8, assault: 1, morale: 4, rules: ['Stationary Artillery', 'Cumbersome Weapon', 'Suppressive Fire'] },

    /* Chosen warriors (p. 101) — the partisan commandos */
    { key: 'rassaultcdo', code: 'PAC', name: 'Partisans – assault commando', group: 'Chosen Warriors', faction: 'rebel', art: 'partassault', tier: 4, size: 8, move: 5, fp: 3, range: 12, def: 8, assault: 5, morale: 5, rules: ['Battlefield Insertion', 'Stealth'] },
    { key: 'rsabcdo', code: 'PSC', name: 'Partisans – sabotage commando', group: 'Chosen Warriors', faction: 'rebel', art: 'partsabotage', tier: 4, size: 8, move: 4, fp: 2, range: 12, def: 8, assault: 4, morale: 5, rules: ['Battlefield Insertion', 'Stealth', 'Jammers', 'Hackers', 'Sappers'] },
    { key: 'rsnipercdo', code: 'PNC', name: 'Partisans – sniper commando', group: 'Chosen Warriors', faction: 'rebel', art: 'partisansniper', tier: 4, size: 4, move: 5, fp: 5, range: 24, def: 8, assault: 1, morale: 4, rules: ['Stealth', 'Battlefield Insertion', 'Cumbersome Weapon', 'Suppressive Fire'] },

    /* Miners (p. 102) — las-cutters count as a Gauss Weapon */
    { key: 'rminers', code: 'MNR', name: 'Miners team', group: 'Miners', faction: 'rebel', art: 'miner', tier: 2, size: 6, move: 4, fp: 3, range: 12, def: 9, assault: 2, morale: 3, rules: ['Gauss Weapon (las-cutters)'] },
    { key: 'rfaceminers', code: 'FMN', name: 'Face miners team', group: 'Miners', faction: 'rebel', art: 'miner', tier: 3, size: 6, move: 4, fp: 4, range: 12, def: 9, assault: 2, morale: 4, rules: ['Sappers', 'Gauss Weapon (las-cutters)'] },
    { key: 'rharshminers', code: 'HMN', name: 'Harsh-environment miners', group: 'Miners', faction: 'rebel', art: 'hardsuit', tier: 4, size: 6, move: 3, fp: 4, range: 12, def: 11, defPierced: 9, assault: 3, morale: 4, rules: ['Battle Armour', 'Sappers', 'Gauss Weapon (las-cutters)'] },

    /* Deserters and POWs (p. 103) — four to an army, and outside the army rules */
    { key: 'rdesconscript', code: 'DSC', name: 'Deserter team (conscripts)', group: 'Deserters and POWs', faction: 'rebel', art: 'conscript', tier: 1, size: 8, move: 4, fp: 1, range: 18, def: 8, assault: 1, morale: 2, rules: ['No Army Rules'], groupCap: 4 },
    { key: 'rpow', code: 'POW', name: 'POWs', group: 'Deserters and POWs', faction: 'rebel', art: 'pow', tier: 2, size: 8, move: 6, fp: 3, range: 12, def: 8, assault: 3, morale: 3, rules: ['No Army Rules'], groupCap: 4 },
    { key: 'rdesrookie', code: 'DSR', name: 'Deserters team (rookie rifle)', group: 'Deserters and POWs', faction: 'rebel', art: 'deserter', tier: 2, size: 8, move: 4, fp: 2, range: 18, def: 9, assault: 2, morale: 3, rules: ['No Army Rules'], groupCap: 4 },
    { key: 'rdesrifle', code: 'DSF', name: 'Deserters team (rifle)', group: 'Deserters and POWs', faction: 'rebel', art: 'deserter', tier: 3, size: 8, move: 5, fp: 3, range: 18, def: 10, assault: 3, morale: 4, rules: ['No Army Rules'], groupCap: 4 },

    /* First Among Equals (p. 104) — one per Priority Level, leading from the front */
    { key: 'rinstigators', code: 'INT', name: 'Instigators', group: 'First Among Equals', faction: 'rebel', art: 'leader', tier: 1, size: 6, move: 5, fp: 2, range: 18, def: 7, assault: 2, morale: 4, rules: ['…but they\'ll never take our freedom!'], command: true, ridersUpgrade: true },
    { key: 'rsecondary', code: 'SIL', name: 'Secondary insurgent leaders', group: 'First Among Equals', faction: 'rebel', art: 'leadersmall', tier: 2, size: 6, move: 5, fp: 3, range: 18, def: 8, assault: 3, morale: 4, rules: ['…but they\'ll never take our freedom!', 'Death or Glory, Comrades!', 'Smoke Markers'], command: true, ridersUpgrade: true },
    { key: 'rleaders', code: 'ILD', name: 'Insurgent leaders', group: 'First Among Equals', faction: 'rebel', art: 'leadermid', tier: 3, size: 6, move: 5, fp: 3, range: 18, def: 9, assault: 3, morale: 5, rules: ['…but they\'ll never take our freedom!', 'Death or Glory, Comrades!', 'Command Unit (2)', 'Smoke Markers', 'Keen-Eyed'], command: true, ridersUpgrade: true },
    { key: 'rinfluential', code: 'IFL', name: 'Influential leaders', group: 'First Among Equals', faction: 'rebel', art: 'leaderbig', tier: 4, size: 6, move: 5, fp: 4, range: 18, def: 9, assault: 4, morale: 5, rules: ['…but they\'ll never take our freedom!', 'Death or Glory, Comrades!', 'Command Unit (2)', 'Hackers', 'Smoke Markers', 'Keen-Eyed'], command: true, ridersUpgrade: true },
    { key: 'rrebellion', code: 'RLD', name: 'Rebellion leaders', group: 'First Among Equals', faction: 'rebel', art: 'leaderhuge', tier: 5, size: 6, move: 5, fp: 4, range: 18, def: 10, assault: 4, morale: 5, rules: ['…but they\'ll never take our freedom!', 'Death or Glory, Comrades!', 'Command Unit (3)', 'Hackers', 'Smoke Markers', 'Keen-Eyed'], command: true },

    /* Rebel combat vehicles (p. 105) */
    { key: 'rtechnical', code: 'TEC', name: 'Technical', group: 'Rebel combat vehicles', faction: 'rebel', cls: 'vehicle', art: 'patrol', tier: 1, size: 1, move: 12, turn: 1, fp: 2, range: 18, def: 9, assault: 1, str: 3, rules: ['Ground vehicle'] },
    { key: 'rlicv', code: 'LIV', name: 'Light improvised combat vehicle', group: 'Rebel combat vehicles', faction: 'rebel', cls: 'vehicle', art: 'gtlight', tier: 2, size: 1, move: 12, turn: 1, fp: 4, range: 18, def: 9, assault: 1, str: 4, rules: ['Ground vehicle'] },
    { key: 'ricv', code: 'IMV', name: 'Improvised combat vehicle', group: 'Rebel combat vehicles', faction: 'rebel', cls: 'vehicle', art: 'gtmed', tier: 3, size: 1, move: 8, turn: 2, fp: 6, range: 24, def: 10, assault: 3, str: 12, rules: ['Ground vehicle'] },
    { key: 'rhicv', code: 'HIV', name: 'Heavy improvised combat vehicle', group: 'Rebel combat vehicles', faction: 'rebel', cls: 'vehicle', art: 'gtheavy', tier: 4, size: 1, move: 6, turn: 2, fp: 7, range: 24, def: 10, assault: 2, str: 16, rules: ['Ground vehicle'] },

    /* Rebel transport vehicles (p. 106) */
    { key: 'rltv', code: 'RTV', name: 'Light transport vehicle', group: 'Rebel transport vehicles', faction: 'rebel', cls: 'vehicle', art: 'ttlight', tier: 2, size: 1, move: 10, turn: 1, fp: 2, range: 12, def: 8, assault: 1, str: 4, transport: 3, rules: ['Ground vehicle', 'Transport (3)'] },
    { key: 'ritv', code: 'ITV', name: 'Improved transport vehicle', group: 'Rebel transport vehicles', faction: 'rebel', cls: 'vehicle', art: 'ttmed', tier: 3, size: 1, move: 10, turn: 2, fp: 4, range: 18, def: 10, assault: 3, str: 12, transport: 2, rules: ['Ground vehicle', 'Transport (2)', 'Supporting Fire'] },
    { key: 'rshtv', code: 'SHV', name: 'Super heavy transport-combat vehicle', group: 'Rebel transport vehicles', faction: 'rebel', cls: 'vehicle', art: 'ttheavy', tier: 4, size: 1, move: 8, turn: 2, fp: 6, range: 18, def: 10, assault: 4, str: 14, transport: 3, rules: ['Ground vehicle', 'Transport (3)', 'Supporting Fire', 'Advanced Protection'], capPL: 1 },

    /* Flak vehicles (p. 107) — one per Priority Level */
    { key: 'rlflak', code: 'LFV', name: 'Light FlaK vehicle', group: 'Rebel flak vehicles', faction: 'rebel', cls: 'vehicle', art: 'aatech', tier: 2, size: 1, move: 10, turn: 2, fp: 3, range: 18, def: 9, assault: 2, str: 4, rules: ['Ground vehicle', 'Anti-aircraft'], groupCapPL: 1 },
    { key: 'rmflak', code: 'MFV', name: 'Medium FlaK vehicle', group: 'Rebel flak vehicles', faction: 'rebel', cls: 'vehicle', art: 'aacar', tier: 3, size: 1, move: 8, turn: 2, fp: 4, range: 24, def: 11, assault: 2, str: 6, rules: ['Ground vehicle', 'Anti-aircraft', 'Suppressive Fire'], groupCapPL: 1 },
    { key: 'rhflak', code: 'HFV', name: 'Heavy FlaK vehicle', group: 'Rebel flak vehicles', faction: 'rebel', cls: 'vehicle', art: 'aaheavy', tier: 4, size: 1, move: 6, turn: 2, fp: 5, range: 30, def: 12, assault: 2, str: 6, rules: ['Ground vehicle', 'Anti-aircraft', 'Anti-tank', 'Cumbersome Weapon'], groupCapPL: 1 },

    /* Rebel aviation (p. 108) — civilian hulls pressed into service */
    { key: 'rpatrol', code: 'CPC', name: 'Captured patrol craft', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'hawk', tier: 2, size: 1, move: 18, fp: 3, range: 12, def: 9, assault: 0, str: 4, rules: ['Flying unit', 'Keen-Eyed', 'Smoke Markers'] },
    { key: 'rlshuttle', code: 'ALS', name: 'Armed light shuttle', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'apachenp', tier: 3, size: 1, move: 18, fp: 5, range: 18, def: 11, assault: 0, str: 6, transport: 1, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (1)'] },
    { key: 'rmshuttle', code: 'AMS', name: 'Armed medium shuttle', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'hindnp', tier: 4, size: 1, move: 18, fp: 5, range: 18, def: 11, assault: 0, str: 7, transport: 2, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (2)', 'Supporting Fire'] },
    { key: 'rhshuttle', code: 'AHS', name: 'Armed heavy shuttle', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'chinookwl', tier: 5, size: 1, move: 18, fp: 5, range: 18, def: 11, assault: 0, str: 8, transport: 4, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (4)', 'Supporting Fire'] },
    { key: 'rlifter', code: 'LFT', name: 'Lifter', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'chinook', tier: 3, size: 1, move: 16, fp: 0, range: 0, def: 10, assault: 0, str: 7, transport: 1, rules: ['Flying unit', 'Lifter', 'Unarmed'] },

    /* ---- the Space Bugs (pp. 113-123) ----
       Overgrown bugs follow vehicle rules and Overgrown flying bugs aircraft rules,
       but either may still assault (p. 116). */
    { key: 'btiny', code: 'TBS', name: 'Tiny bug swarms', group: 'Lesser Bugs', faction: 'bugs', art: 'bug_tiny', tier: 1, size: 4, move: 9, fp: null, range: 0, def: 7, assault: 3, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Aggressive', 'Endless Tide'] },
    { key: 'bsmall', code: 'SBG', name: 'Small bugs', group: 'Lesser Bugs', faction: 'bugs', art: 'bug_small', tier: 2, size: 8, move: 9, fp: null, range: 0, def: 7, assault: 4, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Aggressive', 'Endless Tide'] },
    { key: 'battack', code: 'ATF', name: 'Attack forms', group: 'Lesser Bugs', faction: 'bugs', art: 'bug_attack', tier: 3, size: 8, move: 9, fp: null, range: 0, def: 8, assault: 5, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Aggressive', 'Endless Tide'] },
    { key: 'boversized', code: 'OAF', name: 'Oversized attack forms', group: 'Lesser Bugs', faction: 'bugs', art: 'bug_oversized', tier: 4, size: 8, move: 9, fp: null, range: 0, def: 9, assault: 5, morale: 5, rules: ['Determined', 'Animal Behaviour', 'Aggressive', 'Sappers', 'Endless Tide'] },
    { key: 'bfirebeetle', code: 'FBT', name: 'Fire beetle', group: 'Lesser Bugs', faction: 'bugs', cls: 'vehicle', art: 'bugfirebeetle', tier: 5, size: 1, move: 8, turn: 1, fp: 9, range: 12, def: 14, assault: 5, str: 7, rules: ['Ground vehicle', 'Overgrown Bug', 'Specialisation (ground)', 'Limited Fire Arc', 'Incendiary Ammunition', 'Suppressive Fire', 'Always Basic Firepower'] },
    { key: 'bunderground', code: 'SUB', name: 'Small underground bugs', group: 'Underground Bugs', faction: 'bugs', art: 'bug_under', tier: 3, size: 8, move: 5, fp: null, range: 0, def: 12, defPierced: 10, assault: 4, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Aggressive', 'Battle Armour'] },
    { key: 'bhugeunder', code: 'HUB', name: 'Huge underground bugs', group: 'Underground Bugs', faction: 'bugs', art: 'bug_hugeunder', tier: 4, size: 8, move: 5, fp: null, range: 0, def: 12, defPierced: 10, assault: 5, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Aggressive', 'Battlefield Insertion', 'Battle Armour'] },
    { key: 'bsandworm', code: 'SWM', name: 'Sandworm', group: 'Underground Bugs', faction: 'bugs', cls: 'vehicle', art: 'bugsandworm', tier: 5, size: 1, move: 8, turn: 1, fp: null, range: 0, def: 16, defPierced: 14, assault: 8, str: 5, rules: ['Ground vehicle', 'Overgrown Bug', 'Battlefield Insertion', 'Battle Armour'] },
    { key: 'bspitlarva', code: 'SLS', name: 'Spitter larva swarms', group: 'Spore Bugs', faction: 'bugs', art: 'bug_spitlarva', tier: 1, size: 4, move: 8, fp: 2, range: 18, def: 7, assault: 2, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Endless Tide'] },
    { key: 'bimmspit', code: 'ISP', name: 'Immature spitters', group: 'Spore Bugs', faction: 'bugs', art: 'bug_immspit', tier: 2, size: 8, move: 8, fp: 2, range: 18, def: 7, assault: 2, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Endless Tide'] },
    { key: 'bspitters', code: 'SPT', name: 'Spitters', group: 'Spore Bugs', faction: 'bugs', art: 'bug_spitter', tier: 3, size: 8, move: 8, fp: 3, range: 18, def: 8, assault: 3, morale: 4, rules: ['Determined', 'Animal Behaviour', 'Endless Tide'] },
    { key: 'bsporethrow', code: 'SPR', name: 'Spore throwers', group: 'Spore Bugs', faction: 'bugs', art: 'bug_spore', tier: 4, size: 8, move: 8, fp: 3, range: 18, def: 9, assault: 3, morale: 5, rules: ['Determined', 'Animal Behaviour', 'Anti-aircraft', 'Endless Tide'] },
    { key: 'bbioplasma', code: 'BPT', name: 'Bio-plasma thrower', group: 'Spore Bugs', faction: 'bugs', cls: 'vehicle', art: 'bugbioplasma', tier: 5, size: 1, move: 8, turn: 2, fp: 7, range: 36, def: 12, assault: 4, str: 7, rules: ['Ground vehicle', 'Overgrown Bug', 'Specialisation (ground)', 'Limited Fire Arc', 'Incendiary Ammunition', 'Suppressive Fire', 'Minimum Range (12)'] },
    { key: 'bsmallwing', code: 'SWB', name: 'Small winged bugs', group: 'Flying Bugs', faction: 'bugs', art: 'bug_smallwing', tier: 3, size: 8, move: 14, fp: 4, range: 12, def: 9, assault: 2, morale: 5, rules: ['Determined', 'Animal Behaviour', 'Flying Infantry'] },
    { key: 'blargewing', code: 'LWB', name: 'Large winged bugs', group: 'Flying Bugs', faction: 'bugs', art: 'bug_largewing', tier: 4, size: 8, move: 14, fp: 5, range: 12, def: 10, assault: 3, morale: 5, rules: ['Determined', 'Animal Behaviour', 'Flying Infantry'] },
    { key: 'bcarrier', code: 'CRB', name: 'Carrier bug', group: 'Flying Bugs', faction: 'bugs', cls: 'aircraft', art: 'bugcarrier', tier: 5, size: 1, move: 18, fp: 4, range: 18, def: 13, assault: 0, str: 7, transport: 4, rules: ['Overgrown Flying Bug', 'Flying unit', 'Transport (4)'] },
    { key: 'bsmallpath', code: 'SPF', name: 'Small pathfinders', group: 'Pioneer Bugs', faction: 'bugs', art: 'bug_smallpath', tier: 2, size: 8, move: 6, fp: 2, range: 12, def: 7, assault: 1, morale: 4, rules: ['Determined', 'Stealth', 'Pheromone Markers'] },
    { key: 'bpathfinder', code: 'PFB', name: 'Pathfinder bugs', group: 'Pioneer Bugs', faction: 'bugs', art: 'bug_path', tier: 3, size: 8, move: 6, fp: 2, range: 12, def: 8, assault: 2, morale: 4, rules: ['Determined', 'Stealth', 'Battlefield Insertion', 'Pheromone Markers', 'Keen-Eyed'] },
    { key: 'blurkers', code: 'LRK', name: 'Lurkers', group: 'Pioneer Bugs', faction: 'bugs', art: 'bug_lurker', tier: 4, size: 8, move: 7, fp: 3, range: 12, def: 9, assault: 4, morale: 4, rules: ['Determined', 'Stealth', 'Battlefield Insertion', 'Pheromone Markers', 'Keen-Eyed'] },
    { key: 'bshadow', code: 'SHB', name: 'Shadow bug', group: 'Pioneer Bugs', faction: 'bugs', cls: 'vehicle', art: 'bugshadow', tier: 5, size: 1, move: 12, turn: 1, fp: 6, range: 12, def: 12, assault: 6, str: 7, rules: ['Ground vehicle', 'Overgrown Bug', 'Determined', 'Stealth', 'Battlefield Insertion', 'Pheromone Markers', 'Keen-Eyed'] },
    { key: 'bwatchlarva', code: 'WLS', name: 'Watcher larvae swarm', group: 'Leader Bugs', faction: 'bugs', art: 'bug_watchlarva', tier: 1, size: 4, move: 6, fp: 1, range: 18, def: 8, assault: 2, morale: 5, leaderBug: true, rules: ['Determined', 'Overmind'] },
    { key: 'bimmwatch', code: 'IWB', name: 'Immature watchers', group: 'Leader Bugs', faction: 'bugs', art: 'bug_immwatch', tier: 2, size: 8, move: 6, fp: 1, range: 18, def: 8, assault: 2, morale: 5, leaderBug: true, rules: ['Determined', 'Overmind'] },
    { key: 'bwatchers', code: 'WTC', name: 'Watchers', group: 'Leader Bugs', faction: 'bugs', art: 'bug_watcher', tier: 3, size: 8, move: 6, fp: 1, range: 18, def: 8, assault: 3, morale: 5, leaderBug: true, rules: ['Determined', 'Overmind', 'Pheromone Markers', 'Psychic Wave'] },
    { key: 'bovermind', code: 'OVM', name: 'Overmind bugs', group: 'Leader Bugs', faction: 'bugs', art: 'bug_overmind', tier: 4, size: 8, move: 6, fp: 4, range: 18, def: 9, assault: 3, morale: 5, leaderBug: true, rules: ['Determined', 'Overmind', 'Pheromone Markers', 'Psychic Wave'] },
    { key: 'bqueen', code: 'QUN', name: 'Queen', group: 'Leader Bugs', faction: 'bugs', cls: 'vehicle', art: 'bugqueen', tier: 5, size: 1, move: 8, turn: 1, fp: 4, range: 18, def: 15, assault: 6, str: 9, leaderBug: true, rules: ['Ground vehicle', 'Overgrown Bug', 'Overmind', 'Pheromone Markers', 'Psychic Wave'] },
    { key: 'binfected', code: 'INF', name: 'Infected humans', group: 'Infected Humans', faction: 'bugs', art: 'infected', tier: 3, size: 12, move: 4, fp: null, range: 0, def: 11, assault: 4, morale: 5, capPL: 2, rules: ['Determined'] },

    /* ---------- the Xenotripods (pp. 128-143) ----------
       Crocks — three legs, three arms — lead and specialise (Alpha to Delta);
       the Esh-Aven are their line troops (Epsilon). No ground vehicles: the
       tribe flies triangular craft and teleports automated turrets in. A turret
       set is one pick, and every turret in it takes the table as a unit of its
       own (`turretSet`). */
    { key: 'xalpha1', code: 'PAT', name: 'Primitive Alpha troopers', group: 'Alpha Squads', faction: 'xeno', art: 'x_alpha1', tier: 1, size: 3, move: 5, fp: 2, range: 18, def: 9, assault: 1, morale: 4, alpha: true, groupCapPL: 1, rules: ['Dominant Species', 'Psychic Support'] },
    { key: 'xalpha2', code: 'LAT', name: 'Low-grade Alpha troopers', group: 'Alpha Squads', faction: 'xeno', art: 'x_alpha2', tier: 2, size: 3, move: 5, fp: 2, range: 18, def: 10, assault: 1, morale: 4, alpha: true, groupCapPL: 1, rules: ['Command Unit (2)', 'Psychic Support', 'Dominant Species'] },
    { key: 'xalpha3', code: 'CAT', name: 'Core Alpha troopers', group: 'Alpha Squads', faction: 'xeno', art: 'x_alpha3', tier: 3, size: 3, move: 5, fp: 2, range: 18, def: 11, assault: 1, morale: 5, alpha: true, groupCapPL: 1, rules: ['Command Unit (2)', 'Counter-jamming', 'Psychic Support', 'Dominant Species'] },
    { key: 'xalpha4', code: 'HAT', name: 'High-grade Alpha troopers', group: 'Alpha Squads', faction: 'xeno', art: 'x_alpha4', tier: 4, size: 3, move: 5, fp: 2, range: 18, def: 11, assault: 1, morale: 5, alpha: true, groupCapPL: 1, rules: ['Command Unit (3)', 'Counter-jamming', 'Hackers', 'Psychic Support', 'Dominant Species'] },
    { key: 'xalpha5', code: 'AAT', name: 'Advanced Alpha troopers', group: 'Alpha Squads', faction: 'xeno', art: 'x_alpha5', tier: 5, size: 3, move: 5, fp: 2, range: 18, def: 12, assault: 1, morale: 5, alpha: true, groupCapPL: 1, rules: ['Command Unit (4)', 'Jammers', 'Counter-jamming', 'Hackers', 'Psychic Support', 'Dominant Species'] },
    { key: 'xbeta2', code: 'LBT', name: 'Low-grade Beta troopers', group: 'Beta Squads', faction: 'xeno', art: 'x_beta2', tier: 2, size: 3, move: 5, fp: 2, range: 12, def: 12, defPierced: 10, assault: 3, morale: 4, rules: ['Determined', 'Battle Armour'] },
    { key: 'xbeta3', code: 'CBT', name: 'Core Beta troopers', group: 'Beta Squads', faction: 'xeno', art: 'x_beta3', tier: 3, size: 3, move: 5, fp: 3, range: 12, def: 12, defPierced: 10, assault: 2, morale: 5, rules: ['Markerlights', 'Determined', 'Battle Armour'] },
    { key: 'xbeta4', code: 'HBT', name: 'High-grade Beta troopers', group: 'Beta Squads', faction: 'xeno', art: 'x_beta4', tier: 4, size: 3, move: 5, fp: 4, range: 12, def: 13, defPierced: 11, assault: 1, morale: 5, rules: ['Markerlights', 'Determined', 'Cloaking System', 'Battle Armour'] },
    { key: 'xgamma3', code: 'CGT', name: 'Core Gamma troopers', group: 'Gamma Squads', faction: 'xeno', art: 'x_gamma3', tier: 3, size: 3, move: 5, fp: 6, range: 30, def: 8, assault: 1, morale: 4, capPL: 1, rules: ['Destructive Weapon', 'Cumbersome Weapon', 'Minimum Range (6)', 'Indirect Fire', 'Suppressive Fire'] },
    { key: 'xgamma4', code: 'HGT', name: 'High-grade Gamma troopers', group: 'Gamma Squads', faction: 'xeno', art: 'x_gamma4', tier: 4, size: 3, move: 5, fp: 6, range: 30, def: 8, assault: 1, morale: 4, rules: ['Destructive Weapon', 'Cumbersome Weapon', 'Minimum Range (6)', 'Indirect Fire', 'Anti-tank', 'Suppressive Fire'] },
    { key: 'xgamma5', code: 'AGT', name: 'Advanced Gamma troopers', group: 'Gamma Squads', faction: 'xeno', art: 'x_gamma5', tier: 5, size: 3, move: 5, fp: 6, range: 30, def: 8, assault: 1, morale: 4, rules: ['Destructive Weapon', 'Cumbersome Weapon', 'Minimum Range (6)', 'Indirect Fire', 'Anti-tank', 'Cloaking System', 'Suppressive Fire'] },
    { key: 'xdelta1', code: 'PDT', name: 'Primitive Delta troopers', group: 'Delta Squads', faction: 'xeno', art: 'x_delta1', tier: 1, size: 3, move: 5, fp: null, range: 0, def: 10, assault: 6, morale: 3, rules: [] },
    { key: 'xdelta2', code: 'LDT', name: 'Low-grade Delta troopers', group: 'Delta Squads', faction: 'xeno', art: 'x_delta2', tier: 2, size: 3, move: 5, fp: 3, range: 12, def: 11, assault: 5, morale: 4, rules: ['Sappers'] },
    { key: 'xdelta3', code: 'CDT', name: 'Core Delta troopers', group: 'Delta Squads', faction: 'xeno', art: 'x_delta3', tier: 3, size: 3, move: 5, fp: 6, range: 12, def: 11, assault: 4, morale: 4, capPL: 1, rules: ['Sappers'] },
    { key: 'xeps1', code: 'PET', name: 'Primitive Epsilon troopers', group: 'Epsilon Squads', faction: 'xeno', art: 'x_eps1', tier: 1, size: 9, move: 7, fp: null, range: 0, def: 7, assault: 4, morale: 3, eshAven: true, rules: [] },
    { key: 'xeps2', code: 'LET', name: 'Low-grade Epsilon troopers', group: 'Epsilon Squads', faction: 'xeno', art: 'x_eps2', tier: 2, size: 9, move: 7, fp: 1, range: 18, def: 8, assault: 3, morale: 3, eshAven: true, rules: [] },
    { key: 'xeps3', code: 'CET', name: 'Core Epsilon troopers', group: 'Epsilon Squads', faction: 'xeno', art: 'x_eps3', tier: 3, size: 9, move: 7, fp: 3, range: 18, def: 9, assault: 3, morale: 4, eshAven: true, rules: [] },
    { key: 'xeps4', code: 'HET', name: 'High-grade Epsilon troopers', group: 'Epsilon Squads', faction: 'xeno', art: 'x_eps4', tier: 4, size: 9, move: 7, fp: 4, range: 24, def: 10, assault: 2, morale: 5, eshAven: true, rules: ['Gauss Weapon'] },
    { key: 'xeps5', code: 'AET', name: 'Advanced Epsilon troopers', group: 'Epsilon Squads', faction: 'xeno', art: 'x_eps5', tier: 5, size: 9, move: 7, fp: 5, range: 24, def: 11, assault: 1, morale: 5, eshAven: true, rules: ['Gauss Weapon', 'Incendiary Ammunition'] },
    { key: 'xstrike2', code: 'LSC', name: 'Low-grade Strike craft', group: 'Strike Aviation', faction: 'xeno', cls: 'aircraft', art: 'xstrike', tier: 2, size: 1, move: 18, fp: 4, range: 18, def: 10, assault: 0, str: 4, rules: ['Flying unit', 'Indirect Fire'] },
    { key: 'xstrike3', code: 'CSC', name: 'Core Strike craft', group: 'Strike Aviation', faction: 'xeno', cls: 'aircraft', art: 'xstrike', tier: 3, size: 1, move: 18, fp: 6, range: 24, def: 11, assault: 0, str: 4, rules: ['Flying unit', 'Indirect Fire'] },
    { key: 'xstrike4', code: 'HSC', name: 'High-grade Strike craft', group: 'Strike Aviation', faction: 'xeno', cls: 'aircraft', art: 'xstrikehg', tier: 4, size: 1, move: 18, fp: 7, range: 24, def: 12, assault: 0, str: 5, rules: ['Flying unit', 'Indirect Fire', 'Molecular Reconstruction'] },
    { key: 'xstrike5', code: 'ASC', name: 'Advanced Strike craft', group: 'Strike Aviation', faction: 'xeno', cls: 'aircraft', art: 'xstrikeadv', tier: 5, size: 1, move: 18, fp: 8, range: 30, def: 12, assault: 0, str: 6, rules: ['Flying unit', 'Indirect Fire', 'Molecular Reconstruction'] },
    { key: 'xrecon', code: 'RCN', name: 'Recon craft', group: 'Support Aviation', faction: 'xeno', cls: 'aircraft', art: 'xrecon', tier: 3, size: 1, move: 24, fp: 1, range: 12, def: 11, assault: 0, str: 3, rules: ['Flying unit', 'Markerlights', 'Molecular Reconstruction'] },
    { key: 'xtelecraft', code: 'TPC', name: 'Teleport craft', group: 'Support Aviation', faction: 'xeno', cls: 'aircraft', art: 'xtelecraft', tier: 4, size: 1, move: 18, fp: 3, range: 12, def: 11, assault: 0, str: 4, rules: ['Flying unit', 'Stealth', 'Teleport', 'Molecular Reconstruction'] },
    { key: 'xshieldb', code: 'BSG', name: 'Basic shield generator craft', group: 'Support Aviation', faction: 'xeno', cls: 'aircraft', art: 'xshieldcraft', tier: 3, size: 1, move: 18, fp: 3, range: 12, def: 11, assault: 0, str: 4, rules: ['Flying unit', 'Shield Generator (1)', 'Molecular Reconstruction'] },
    { key: 'xshield', code: 'SGC', name: 'Shield generator craft', group: 'Support Aviation', faction: 'xeno', cls: 'aircraft', art: 'xshieldcraft', tier: 4, size: 1, move: 18, fp: 3, range: 12, def: 11, assault: 0, str: 4, rules: ['Flying unit', 'Stealth', 'Shield Generator (1)', 'Molecular Reconstruction'] },
    { key: 'xshieldhp', code: 'HSG', name: 'High-power shield generator craft', group: 'Support Aviation', faction: 'xeno', cls: 'aircraft', art: 'xshieldcraft', tier: 5, size: 1, move: 18, fp: 3, range: 12, def: 12, assault: 0, str: 4, rules: ['Flying unit', 'Stealth', 'Shield Generator (1)', 'Counter-jamming', 'Molecular Reconstruction'] },
    { key: 'xdturret1', code: 'DT', name: 'Defensive turret', group: 'Defensive Turrets', faction: 'xeno', cls: 'vehicle', art: 'xturret', tier: 1, size: 1, move: 0, turn: 0, fp: 6, range: 24, def: 11, assault: 1, str: 3, turretSet: 1, groupCap: 1, rules: ['Turret', 'Drone Control', 'Indirect Fire', 'Battlefield Insertion'] },
    { key: 'xdturret2', code: 'DT', name: 'Defensive turrets pair', group: 'Defensive Turrets', faction: 'xeno', cls: 'vehicle', art: 'xturret', tier: 2, size: 1, move: 0, turn: 0, fp: 6, range: 24, def: 11, assault: 1, str: 3, turretSet: 2, groupCap: 1, rules: ['Turret', 'Drone Control', 'Indirect Fire', 'Battlefield Insertion'] },
    { key: 'xdturret3', code: 'DT', name: 'Defensive turrets trio', group: 'Defensive Turrets', faction: 'xeno', cls: 'vehicle', art: 'xturret', tier: 3, size: 1, move: 0, turn: 0, fp: 6, range: 24, def: 11, assault: 1, str: 3, turretSet: 3, groupCap: 1, rules: ['Turret', 'Drone Control', 'Indirect Fire', 'Battlefield Insertion'] },
    { key: 'xdturret4', code: 'DT', name: 'Defensive turrets foursome', group: 'Defensive Turrets', faction: 'xeno', cls: 'vehicle', art: 'xturret', tier: 4, size: 1, move: 0, turn: 0, fp: 6, range: 24, def: 11, assault: 1, str: 3, turretSet: 4, groupCap: 1, rules: ['Turret', 'Drone Control', 'Indirect Fire', 'Battlefield Insertion'] },
    { key: 'xdturret5', code: 'DT', name: 'Defensive turrets fivesome', group: 'Defensive Turrets', faction: 'xeno', cls: 'vehicle', art: 'xturret', tier: 5, size: 1, move: 0, turn: 0, fp: 6, range: 24, def: 11, assault: 1, str: 3, turretSet: 5, groupCap: 1, rules: ['Turret', 'Drone Control', 'Indirect Fire', 'Battlefield Insertion'] },
    { key: 'xtturret2', code: 'TT', name: 'Teleport turrets pair', group: 'Teleport Turrets', faction: 'xeno', cls: 'vehicle', art: 'xteleturret', tier: 2, size: 1, move: 0, turn: 0, fp: null, range: 0, def: 11, assault: 1, str: 3, turretSet: 2, groupCap: 1, rules: ['Turret', 'Drone Control', 'Teleport', 'Battlefield Insertion', 'Molecular Reconstruction', 'Cloaking System'] },
    { key: 'xtturret3', code: 'TT', name: 'Teleport turrets trio', group: 'Teleport Turrets', faction: 'xeno', cls: 'vehicle', art: 'xteleturret', tier: 3, size: 1, move: 0, turn: 0, fp: null, range: 0, def: 11, assault: 1, str: 3, turretSet: 3, groupCap: 1, rules: ['Turret', 'Drone Control', 'Teleport', 'Battlefield Insertion', 'Molecular Reconstruction', 'Cloaking System'] },
    { key: 'xtturret4', code: 'TT', name: 'Teleport turrets foursome', group: 'Teleport Turrets', faction: 'xeno', cls: 'vehicle', art: 'xteleturret', tier: 4, size: 1, move: 0, turn: 0, fp: null, range: 0, def: 11, assault: 1, str: 3, turretSet: 4, groupCap: 1, rules: ['Turret', 'Drone Control', 'Teleport', 'Battlefield Insertion', 'Molecular Reconstruction', 'Cloaking System'] },
    { key: 'xsturret3', code: 'SHT', name: 'Shield turret', group: 'Shield Turrets', faction: 'xeno', cls: 'vehicle', art: 'xshieldturret', tier: 3, size: 1, move: 0, turn: 0, fp: null, range: 0, def: 12, assault: 1, str: 4, groupCapPL: 1, rules: ['Turret', 'Drone Control', 'Battlefield Insertion', 'Molecular Reconstruction', 'Shield Generator (2)'] },
    { key: 'xsturret4', code: 'HST', name: 'Hi-grade shield turret', group: 'Shield Turrets', faction: 'xeno', cls: 'vehicle', art: 'xshieldturret', tier: 4, size: 1, move: 0, turn: 0, fp: null, range: 0, def: 13, assault: 1, str: 4, groupCapPL: 1, rules: ['Turret', 'Drone Control', 'Battlefield Insertion', 'Molecular Reconstruction', 'Shield Generator (2)', 'Hackers'] },
    { key: 'xsturret5', code: 'AST', name: 'Advanced shield turret', group: 'Shield Turrets', faction: 'xeno', cls: 'vehicle', art: 'xshieldturret', tier: 5, size: 1, move: 0, turn: 0, fp: null, range: 0, def: 14, assault: 1, str: 4, groupCapPL: 1, rules: ['Turret', 'Drone Control', 'Battlefield Insertion', 'Molecular Reconstruction', 'Shield Generator (2)', 'Counter-jamming', 'Jammers', 'Hackers'] }
  ];
  CATALOGUE.forEach(function (p) {
    p.cls = p.cls || 'infantry';
    p.faction = p.faction || 'pmc';
  });
  var FACTIONS = {
    pmc: { key: 'pmc', name: 'PMC', full: 'Private military company', money: 'kUC', moneyLong: 'thousand Universal Credits' },
    rebel: { key: 'rebel', name: 'Rebels', full: 'Insurgent force', money: 'IP', moneyLong: 'Influence Points' },
    bugs: { key: 'bugs', name: 'Space Bugs', full: 'Bug swarm', money: 'RP', moneyLong: 'Resource Points' },
    xeno: { key: 'xeno', name: 'Xenotripods', full: 'Xenotripod tribe', money: 'TP', moneyLong: 'Territorial Points' }
  };
  function factionOf(keys) {
    for (var i = 0; i < (keys || []).length; i++) {
      var p = BY_KEY[splitPick(keys[i]).key];
      if (p) return p.faction;
    }
    return 'pmc';
  }
  function listFor(faction) {
    return CATALOGUE.filter(function (p) { return p.faction === (faction || 'pmc'); });
  }

  var BY_KEY = {};
  CATALOGUE.forEach(function (p) { BY_KEY[p.key] = p; });

  /* ---------- composition table (p. 60) ----------
     Points are the sum of Unit Tiers an army may field. Every number here is for
     Priority Level 1 and is multiplied by the Priority Level. */
  var COMPOSITION = {
    1: { points: 6, limits: [[3, 99], [0, 1], [0, 0], [0, 0], [0, 0]] },
    2: { points: 12, limits: [[0, 4], [3, 99], [0, 2], [0, 1], [0, 0]] },
    3: { points: 18, limits: [[0, 4], [0, 4], [3, 99], [0, 2], [0, 1]] },
    4: { points: 24, limits: [[0, 0], [0, 4], [0, 4], [3, 99], [0, 2]] },
    5: { points: 30, limits: [[0, 0], [0, 0], [0, 4], [0, 4], [3, 99]] }
  };
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  // the Space Bugs' own table (p. 114)
  var COMPOSITION_BUGS = {
    1: { points: 6, limits: [[3, 99], [0, 1], [0, 0], [0, 0], [0, 0]] },
    2: { points: 12, limits: [[0, 6], [2, 99], [0, 2], [0, 1], [0, 0]] },
    3: { points: 18, limits: [[0, 4], [0, 3], [2, 99], [0, 2], [0, 2]] },
    4: { points: 24, limits: [[0, 4], [0, 3], [0, 3], [2, 99], [0, 2]] },
    5: { points: 30, limits: [[0, 4], [0, 3], [0, 3], [0, 3], [2, 99]] }
  };
  function compFor(faction, bt) { return (faction === 'bugs' ? COMPOSITION_BUGS : COMPOSITION)[bt]; }
  function isOvergrown(p) { return !!p && (p.rules || []).some(function (r) { return r === 'Overgrown Bug' || r === 'Overgrown Flying Bug'; }); }

  // Is this list a legal army? Returns the points spent and any complaints.
  /* ---------- ground-vehicle propulsions (Appendix 3, pp. 166-167) ----------
     None of these change a Unit Tier: every one trades an advantage for a cost.
     An army entry may be written "lcv:tracked"; a bare key means wheeled. */
  var PROPULSION = {
    // the optional propulsions are just that (p. 166): without one, a hull follows the standard rules
    none: {
      key: 'none', name: 'None', short: 'std',
      note: 'No optional propulsion: the standard vehicle rules.'
    },
    wheeled: {
      key: 'wheeled', name: 'Wheeled', short: 'whl',
      note: 'Follows all the standard rules.'
    },
    tracked: {
      key: 'tracked', name: 'Tracked', short: 'trk', move: 0.75, turn: -1,
      note: 'Slower but sure-footed: Movement three quarters, turns cost 1" less — often free.'
    },
    grav: {
      key: 'grav', name: 'Anti-grav', short: 'AMID', move: 1.25, str: -1,
      note: 'AMID drive: Movement a quarter more, but one Structure point less. Still pays for difficult ground and cannot cross impassable terrain.'
    },
    hover: {
      key: 'hover', name: 'Hover', short: 'hov', turn: 1, water: true,
      note: 'Crosses water and other liquids — never lava — but turns cost 1" more.'
    },
    walker: {
      key: 'walker', name: 'Walker', short: 'wlk', def: -1,
      cover: true, footed: true, noSideArc: true,
      note: 'Legs: pays the infantry 1" for difficult area terrain (walls and fences still cost it the full 2") and takes cover from terrain, and its armoured flanks deny the +1 side shot — but its height costs 1 Defence.'
    }
  };
  var PROP_ORDER = ['none', 'wheeled', 'tracked', 'grav', 'hover', 'walker'];

  /* "lcv:tracked", "lcv:tracked:drone" or "rfanatics:riders" -> { key, prop, drone, riders } */
  /* What a mounted unit rides (p. 93 says "bikes and beasts"): it changes the
     models on the table and nothing in the rules. */
  /* What a rider sits on (Appendix 3, pp. 166-167): each trades one of the
     Riders restrictions for a cost of its own. */
  var MOUNTS = {
    // no optional mount (p. 166): the standard Riders rules, drawn on a bike
    none: { name: 'None', note: 'No optional mount: the standard Riders rules.' },
    bike: { name: 'Motorbike', transport: true, rough: 6,
      note: 'Can be carried in a transport, but loses 6" crossing difficult terrain.' },
    gravbike: { name: 'Grav bike', smooth: true, def: -1,
      note: 'No movement penalties from terrain, but \u22121 Defence.' },
    horse: { name: 'Horse', linear: true, shotSP: 1,
      note: 'Can cross linear terrain, but takes 1 extra Suppression point every time it is shot at.' }
  };
  // the mount a unit rides, if it has the Riders rule
  function mountOf(u) { return u && u.mount && hasOwn(u, 'Riders') ? MOUNTS[u.mount] || null : null; }
  // fold a mount's stat change into a freshly built unit
  function applyMount(u, mount) {
    var m = MOUNTS[mount];
    if (!m || u.rules.indexOf('Riders') < 0) return u;
    u.mount = mount;
    if (m.def) { u.def = Math.max(1, u.def + m.def); if (u.defPierced) u.defPierced = Math.max(1, u.defPierced + m.def); }
    return u;
  }
  var MOUNT_ORDER = ['none', 'bike', 'gravbike', 'horse'];
  // a unit that rides: the Mounted Warriors always, the Riders upgrade when taken
  function canMount(p, riders) { return !!p && (p.group === 'Mounted Warriors' || (!!riders && !!p.ridersUpgrade)); }
  function splitPick(entry) {
    var bits = String(entry).split(':');
    var out = { key: bits[0], prop: null, drone: false, riders: false, mount: null };
    for (var i = 1; i < bits.length; i++) {
      if (MOUNTS[bits[i]]) out.mount = bits[i];
      else if (PROPULSION[bits[i]]) out.prop = bits[i];
      else if (bits[i] === 'drone') out.drone = true;
      else if (bits[i] === 'riders') out.riders = true;
    }
    return out;
  }
  function joinPick(key, prop, drone, riders, mount) {
    var out = key;
    if (prop && prop !== 'none') out += ':' + prop;
    if (drone) out += ':drone';
    if (riders) out += ':riders';
    if (mount && mount !== 'none') out += ':' + mount;
    return out;
  }
  /* Riders upgrade (p. 93): the unit is mounted — half the models, Movement 10,
     and everything the Riders rule imposes. */
  function applyRiders(u, on) {
    if (!on) return u;
    var p = BY_KEY[u.key];
    if (!p || !p.ridersUpgrade) return u;
    u.riders = true;
    u.size = Math.max(1, Math.round(u.size / 2));
    u.models = Math.min(u.models, u.size);
    u.move = 10;
    if (u.rules.indexOf('Riders') < 0) u.rules = u.rules.concat(['Riders']);
    return u;
  }
  function canRide(p) { return !!(p && p.ridersUpgrade); }
  // a vehicle with no Transport rule may be flown as a drone (p. 37)
  // the alien armies' hulls are what they are: no propulsion to pick, no drone option
  function alienHull(p) { return !!p && (p.faction === 'bugs' || p.faction === 'xeno'); }
  /* Drone Control (p. 37): "Vehicles without the Transport special rule" — ground
     hulls and aircraft alike (p. 39) — "can be fielded by all armies except the
     Bugs". A turret is Drone Controlled already, and a Teleport craft carries troops. */
  function canBeDrone(p) {
    return !!p && (p.cls === 'vehicle' || p.cls === 'aircraft') && !p.transport && p.faction !== 'bugs' && !p.mustDrone &&
      !(p.rules || []).some(function (r) { return /^(Transport|Teleport|Turret)/.test(r); }) &&
      !/Turret/.test(p.group || '');
  }
  // which propulsions a profile may take: ground vehicles only
  // ...and not a drop pod, which comes down where it is put and never moves again (p. 79)
  function immobile(p) { return !!p && (p.rules || []).indexOf('Immobile') >= 0; }
  function propsFor(p) { return p && p.cls === 'vehicle' && !alienHull(p) && !immobile(p) ? PROP_ORDER : []; }
  /* The running gear each hull goes to war on unless someone picks otherwise —
     what the muster screen fills in and what the Unit Atlas shows. */
  var DEFAULT_DRIVE = {
    lpv: 'wheeled', hpv: 'wheeled', recon: 'wheeled',
    lcv: 'tracked', mcv: 'tracked', acv: 'grav',
    lhunter: 'wheeled', hunter: 'tracked', ldestroyer: 'tracked', mdestroyer: 'grav',
    unarmoured: 'wheeled', ltransport: 'wheeled',
    lapc: 'tracked', lifv: 'tracked', cmdveh: 'tracked', hifv: 'tracked', hapc: 'tracked',
    lengveh: 'tracked', hengveh: 'tracked',
    impsupport: 'wheeled', lsupport: 'tracked', msupport: 'tracked', asupport: 'grav',
    aaveh: 'tracked', medveh: 'tracked', ewveh: 'tracked',
    rtechnical: 'wheeled', rlicv: 'wheeled', ricv: 'tracked', rhicv: 'tracked',
    rltv: 'wheeled', ritv: 'wheeled', rshtv: 'tracked',
    rlflak: 'wheeled', rmflak: 'tracked', rhflak: 'tracked'
  };
  // a hull goes out with no optional propulsion unless one is picked
  function defaultDrive(p) {
    if (!p || p.cls !== 'vehicle' || alienHull(p) || immobile(p)) return null;
    return 'none';
  }
  // ...and is drawn on the running gear it usually goes to war on
  function lookDrive(p) {
    if (!p || p.cls !== 'vehicle' || alienHull(p) || immobile(p)) return null;
    return DEFAULT_DRIVE[p.key] || 'wheeled';
  }
  function propOf(u) { return PROPULSION[u && u.prop] || null; }

  /* Fold a propulsion into a freshly built machine. Movement is kept exact rather
     than rounded, since the table is measured in real inches. */
  /* Drone Control (p. 37): no crew to lose, so one more Structure point — but a
     Hacker can reach into it. */
  function applyDrone(u, on) {
    // Drone units, and a craft that is only ever Drone Controlled, are drones already:
    // hackable, and with any extra Structure already in the profile (pp. 40, 82)
    if (hasOwn(u, 'Drone unit') || (BY_KEY[u.key] && BY_KEY[u.key].mustDrone)) { u.drone = true; return u; }
    if (!on || !canBeDrone(u)) { u.drone = false; return u; }
    u.drone = true;
    u.str += 1;
    if (u.rules.indexOf('Drone Control') < 0) u.rules = u.rules.concat(['Drone Control']);
    return u;
  }

  function applyPropulsion(u, prop) {
    // a giant bug or a Xenotripod hull goes on its own legs and fields: no drive at all
    if (alienHull(u)) { u.prop = null; return u; }
    var pr = PROPULSION[prop];
    if (!pr || u.cls !== 'vehicle') { u.prop = u.cls === 'vehicle' ? 'none' : null; return u; }
    u.prop = pr.key;
    if (pr.move) u.move = Math.round(u.move * pr.move * 100) / 100;
    if (pr.turn) u.turn = Math.max(0, (u.turn || 0) + pr.turn);
    if (pr.str) u.str = Math.max(1, u.str + pr.str);
    if (pr.def) u.def = Math.max(1, u.def + pr.def);
    return u;
  }

  /* `docs` is the firing company's doctrine list, when it has one. Three of the
     Operational doctrines (pp. 87-88) change what a legal list looks like:
       O1 Air Superiority     — one aircraft more than normally allowed
       O2 Non-conventional Army — the minimum of the Battle Tier is halved
       O5 Strength in Numbers — one extra unit a Tier below the Battle Tier per
                                Priority Level, free and off the points
     The fourth, O4 Reinforced Light Support, changes the unit rather than the
     list, so it is applied when the unit is built. */
  function checkArmy(picks, battleTier, pl, docs, tactic, faction) {
    pl = pl || 1;
    docs = docs || [];
    function doc(id) { return docs.indexOf(id) >= 0; }
    var keys = (picks || []).map(function (e) { return splitPick(e).key; });
    var comp = COMPOSITION[battleTier], faults = [], counts = [0, 0, 0, 0, 0, 0], spent = 0;
    var perKey = {}, perGroup = {}, commands = 0, factions = {};
    keys.forEach(function (k) {
      var p = BY_KEY[k];
      if (!p) return;
      spent += p.tier;
      // a Rapid insertion platform costs a point but is nobody's Tier I unit (p. 79)
      if (!p.noSlot) counts[p.tier]++;
      perKey[k] = (perKey[k] || 0) + 1;
      perGroup[p.group] = (perGroup[p.group] || 0) + 1;
      factions[p.faction] = 1;
      if (p.command) commands++;
    });
    if (Object.keys(factions).length > 1) {
      faults.push('An army is drawn from one faction: mercenaries and insurgents do not muster together.');
    }
    var rebel = !!factions.rebel, bugs = !!factions.bugs || (!keys.length && faction === 'bugs');
    if (bugs) comp = COMPOSITION_BUGS[battleTier];
    // Rebel Tactics (p. 95) only bear on a Rebel list
    if (!rebel) tactic = null;
    var budget = comp.points * pl, freeTier = battleTier - 1, freeUsed = 0, waveFree = 0;
    /* Human Wave Attacks: two extra infantry units of the Battle Tier per Priority
       Level, over and above the points. They come off the bill the way Strength in
       Numbers does, but they are the Battle Tier's own units rather than a Tier below. */
    if (tactic === 'wave') {
      var waveInf = 0;
      keys.forEach(function (k) {
        var p = BY_KEY[k];
        if (p && p.cls === 'infantry' && p.tier === battleTier) waveInf++;
      });
      waveFree = Math.min(2 * pl, waveInf);
      spent -= waveFree * battleTier;
      freeUsed += waveFree;
    }
    if (doc('O5') && freeTier >= 1) {
      // the free units come off the bill, up to one per Priority Level
      var o5 = Math.min(pl, counts[freeTier]);
      freeUsed += o5;
      spent -= o5 * freeTier;
    }
    if (spent > budget) faults.push('Over budget: ' + spent + ' of ' + budget + ' composition points.');
    // "You cannot field more Drone units than other units" (p. 40)
    var droneN = keys.filter(function (k) { return BY_KEY[k] && (BY_KEY[k].rules || []).indexOf('Drone unit') >= 0; }).length;
    if (droneN > keys.length - droneN) faults.push('No more Drone units than other units: ' + droneN + ' drone' + (droneN === 1 ? '' : 's') + ' to ' + (keys.length - droneN) + ' others.');
    for (var t = 1; t <= 5; t++) {
      var lim = comp.limits[t - 1], lo = lim[0] * pl, hi = lim[1] === 99 ? 99 : lim[1] * pl;
      if (doc('O2') && t === battleTier) lo = Math.ceil(lo / 2);
      if (doc('O5') && t === freeTier && hi !== 99) hi += pl;
      // Human Wave Attacks: the extra units are "additional" — over the Tier's limit as well as the points (p. 95)
      if (tactic === 'wave' && t === battleTier && hi !== 99) hi += waveFree;
      if (counts[t] < lo) faults.push('Needs at least ' + lo + ' Tier ' + ROMAN[t] + ' units (has ' + counts[t] + ').');
      if (counts[t] > hi) faults.push('At most ' + hi + ' Tier ' + ROMAN[t] + ' units (has ' + counts[t] + ').');
    }
    if (bugs) {
      /* The swarm (p. 114): one Leader Bug unit, of the Battle Tier or higher;
         three Overgrown bugs a Priority Level (not at Battle Tier V); Overgrown
         flying bugs from Battle Tier III, and only one at PL1. */
      var leaders = keys.filter(function (k) { return BY_KEY[k] && BY_KEY[k].leaderBug; });
      if (leaders.length !== 1) faults.push('The swarm needs one and only one Leader Bug unit (has ' + leaders.length + ').');
      else if (BY_KEY[leaders[0]].tier < battleTier) faults.push('The Leader Bug unit must be of Tier ' + ROMAN[battleTier] + ' or higher.');
      var og = keys.filter(function (k) { return isOvergrown(BY_KEY[k]); });
      var ogFly = og.filter(function (k) { return BY_KEY[k].cls === 'aircraft'; });
      if (battleTier < 5 && og.length > 3 * pl) faults.push('At most ' + (3 * pl) + ' Overgrown bugs and Overgrown flying bugs — three per Priority Level.');
      if (ogFly.length && battleTier < 3) faults.push('Overgrown flying bugs only from Battle Tier III.');
      if (pl === 1 && ogFly.length > 1) faults.push('Only one Overgrown flying bug at Priority Level 1.');
    }
    if (commands > pl) {
      faults.push(rebel
        ? 'Max ' + pl + ' First Among Equals unit' + (pl > 1 ? 's' : '') + ' — one per Priority Level.'
        : 'Max ' + pl + ' Command Unit' + (pl > 1 ? 's' : '') + ' — one per Priority Level.');
    }
    // machines: three per Priority Level, aircraft only from Battle Tier II,
    // and at PL1 nothing above the Battle Tier and only one aircraft
    /* "Platforms ... have to start the battle with a single infantry unit onboard"
       (p. 79). A list may therefore hold no more platforms than it has infantry
       units free to ride in them — a Command Unit will not be strapped into one. */
    var plats = 0, riders = 0;
    keys.forEach(function (k) {
      var p = BY_KEY[k];
      if (!p) return;
      if (p.mustLoad) plats++;
      else if (p.cls === 'infantry' && !p.command) riders++;   // any infantry squad may ride one (p. 80)
    });
    if (plats > riders) {
      faults.push('Every Rapid insertion platform starts the battle with an infantry unit aboard — ' +
        plats + ' platform' + (plats > 1 ? 's' : '') + ' but only ' + riders + ' squad' +
        (riders === 1 ? '' : 's') + ' free to ride.');
    }
    var machines = 0, aircraft = 0, overTier = 0;
    keys.forEach(function (k) {
      var p = BY_KEY[k];
      if (!p || p.cls === 'infantry' || bugs) return;       // the swarm's own limits above stand in
      machines++;
      if (p.cls === 'aircraft') aircraft++;
      if (p.tier > battleTier) overTier++;
    });
    /* Labour Leader (Path of the Hero, p. 111): four machines a Priority Level,
       of which two may be aircraft. */
    var labour = rebel && docs.indexOf('H3') >= 0;
    var airCap = doc('O1') ? 1 : 0;
    var hullCap = (labour ? 4 : 3) * pl + airCap;
    // Air Superiority's extra machine has to be an aircraft: "one aircraft more" (p. 107)
    if (airCap && machines <= hullCap && machines - aircraft > hullCap - airCap) {
      faults.push('Air Superiority adds an aircraft, not a vehicle — max ' + (hullCap - airCap) + ' ground vehicles.');
    }
    if (machines > hullCap && factions.xeno) faults.push('Max ' + hullCap + ' turrets (or turret sets) and aircraft — three per Priority Level.');
    else if (machines > hullCap) faults.push('Max ' + hullCap + ' vehicles and aircraft — ' + (labour ? 'four' : 'three') + ' per Priority Level' + (airCap ? ', and one more for Air Superiority' : '') + '.');
    if (aircraft && battleTier < 2) faults.push('Aircraft may only be fielded at Battle Tier II or higher.');
    /* A PMC is capped at one aircraft only at Priority Level 1 (p. 38); a Rebel
       force is held to one a Priority Level throughout (p. 92). */
    var planeCap = rebel ? (labour ? 2 : 1) * pl + airCap : pl === 1 ? 1 + airCap : 99;
    if (aircraft > planeCap) faults.push('Only ' + planeCap + ' aircraft at Priority Level ' + pl + '.');
    if (pl === 1 && overTier) faults.push(factions.xeno ? 'At Priority Level 1, no turret or aircraft above the Battle Tier.' : 'At Priority Level 1, no vehicle or aircraft above the Battle Tier.');
    Object.keys(perKey).forEach(function (k) {
      var p = BY_KEY[k];
      if (p.cap && perKey[k] > p.cap) faults.push('Max ' + p.cap + ' × ' + p.name + ' per army.');
      if (p.capPL && perKey[k] > p.capPL * pl) faults.push('Max ' + (p.capPL * pl) + ' × ' + p.name + ' at Priority Level ' + pl + '.');
      // a cap shared across a whole category — Deserters and POWs, four to an army (p. 103)
      if (p.groupCap && perGroup[p.group] > p.groupCap &&
        faults.indexOf('Max ' + p.groupCap + ' ' + p.group + ' units per army.') < 0) {
        faults.push('Max ' + p.groupCap + ' ' + p.group + ' units per army.');
      }
      // one Alpha squad, one Shield turret, a Priority Level (pp. 131, 139)
      var gpl = p.groupCapPL ? 'Max ' + (p.groupCapPL * pl) + ' ' + p.group + ' at Priority Level ' + pl + '.' : null;
      if (gpl && perGroup[p.group] > p.groupCapPL * pl && faults.indexOf(gpl) < 0) faults.push(gpl);
    });
    if (!keys.length) faults.push('No units chosen.');
    return { ok: faults.length === 0, spent: spent, budget: budget, counts: counts, faults: faults, free: freeUsed };
  }

  // Roll a legal army for the given Battle Tier and Priority Level.
  /* A swarm: its Leader Bug first (of the Battle Tier or higher), the Battle
     Tier's own bugs up to the minimum, then whatever fits — checked against the
     swarm's table and rolled again until it is legal. */
  function rollSwarm(bt, pl, rnd) {
    var POOL = listFor('bugs'), comp = COMPOSITION_BUGS[bt], budget = comp.points * pl;
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var best = null;
    for (var tries = 0; tries < 60; tries++) {
      var keys = [], spent = 0, counts = [0, 0, 0, 0, 0, 0], og = 0, ogf = 0, perKey = {};
      var room = function (p) {
        if (p.leaderBug) return false;
        if (spent + p.tier > budget) return false;
        var lim = comp.limits[p.tier - 1], hi = lim[1] === 99 ? 99 : lim[1] * pl;
        if (counts[p.tier] + 1 > hi) return false;
        if (p.capPL && (perKey[p.key] || 0) + 1 > p.capPL * pl) return false;
        if (isOvergrown(p)) {
          if (bt < 5 && og + 1 > 3 * pl) return false;
          if (p.cls === 'aircraft' && (bt < 3 || (pl === 1 && ogf + 1 > 1))) return false;
        }
        return true;
      };
      var take = function (p) {
        keys.push(p.key); spent += p.tier; counts[p.tier]++; perKey[p.key] = (perKey[p.key] || 0) + 1;
        if (isOvergrown(p)) { og++; if (p.cls === 'aircraft') ogf++; }
      };
      var leaders = POOL.filter(function (p) {
        var lim = comp.limits[p.tier - 1];
        return p.leaderBug && p.tier >= bt && lim[1] > 0 && p.tier <= bt + 1;
      });
      if (!leaders.length) leaders = POOL.filter(function (p) { return p.leaderBug && p.tier >= bt; });
      take(pick(leaders));
      var need = comp.limits[bt - 1][0] * pl, g = 0;
      while (counts[bt] < need && g++ < 100) {
        var core = POOL.filter(function (p) { return p.tier === bt && room(p); });
        if (!core.length) break;
        take(pick(core));
      }
      g = 0;
      while (g++ < 200) {
        var any = POOL.filter(room);
        if (!any.length) break;
        take(pick(any));
      }
      if (checkArmy(keys, bt, pl).ok) return keys;
      best = keys;
    }
    return best;
  }
  function rollArmy(battleTier, pl, rnd, faction) {
    pl = pl || 1;
    rnd = rnd || Math.random;
    faction = faction || 'pmc';
    if (faction === 'bugs') return rollSwarm(battleTier, pl, rnd);
    var POOL = listFor(faction), rebel = faction === 'rebel';
    var comp = COMPOSITION[battleTier], budget = comp.points * pl;
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var keys = [], counts = [0, 0, 0, 0, 0, 0], perKey = {}, perGroup = {}, commands = 0, spent = 0;
    var machines = 0, aircraft = 0, plats = 0, riders = 0;

    function room(p) {
      if (spent + p.tier > budget) return false;
      var lim = comp.limits[p.tier - 1];
      var hi = lim[1] === 99 ? 99 : lim[1] * pl;
      if (!p.noSlot && counts[p.tier] + 1 > hi) return false;
      if (p.command && commands + 1 > pl) return false;
      if (p.cap && (perKey[p.key] || 0) + 1 > p.cap) return false;
      if (p.capPL && (perKey[p.key] || 0) + 1 > p.capPL * pl) return false;
      if (p.groupCap && (perGroup[p.group] || 0) + 1 > p.groupCap) return false;
      if (p.groupCapPL && (perGroup[p.group] || 0) + 1 > p.groupCapPL * pl) return false;
      // a platform is only worth rolling once there is a squad spare to ride in it
      if (p.mustLoad && plats + 1 > riders) return false;
      if (p.cls !== 'infantry') {
        if (machines + 1 > 3 * pl) return false;
        if (pl === 1 && p.tier > battleTier) return false;
        if (p.cls === 'aircraft') {
          if (battleTier < 2) return false;
          if (aircraft + 1 > (rebel ? pl : pl === 1 ? 1 : 99)) return false;
        }
      }
      return true;
    }
    // a ground vehicle is rolled with a propulsion to match its job
    var DRIVES = {
      wheeled: ['wheeled', 'wheeled', 'tracked', 'grav', 'hover', 'walker'],
      tank: ['tracked', 'tracked', 'wheeled', 'grav', 'walker'],
      hunter: ['tracked', 'wheeled', 'grav', 'walker'],
      destroyer: ['tracked', 'tracked', 'grav', 'walker'],
      truck: ['wheeled', 'wheeled', 'hover'],
      apc: ['tracked', 'wheeled', 'wheeled', 'hover', 'grav'],
      engineer: ['tracked', 'tracked', 'walker'],
      spg: ['tracked', 'tracked', 'wheeled', 'walker'],
      flak: ['tracked', 'wheeled', 'grav'],
      ewcar: ['wheeled', 'wheeled', 'hover', 'grav'],
      medcar: ['wheeled', 'wheeled', 'tracked'],
      // improvised hulls: civilian running gear, or whatever the yard had
      technical: ['wheeled', 'wheeled', 'wheeled', 'hover'],
      improvised: ['tracked', 'tracked', 'wheeled', 'walker'],
      rtruck: ['wheeled', 'wheeled', 'wheeled', 'hover'],
      rflak: ['wheeled', 'wheeled', 'tracked']
    };
    function take(p) {
      if (p.cls === 'vehicle' && alienHull(p)) {
        keys.push(p.key);
      } else if (p.cls === 'vehicle') {
        keys.push(joinPick(p.key, pick(DRIVES[p.art] || PROP_ORDER)));
      } else if (p.ridersUpgrade && rnd() < 0.3) {
        keys.push(joinPick(p.key, null, false, true));      // mounted, now and then
      } else keys.push(p.key);
      if (p.mustLoad) plats++;
      else if (p.cls === 'infantry' && !p.command) riders++;   // any infantry squad may ride one (p. 80)
      if (!p.noSlot) counts[p.tier]++;                 // a platform fills nobody's Tier row
      spent += p.tier;
      perKey[p.key] = (perKey[p.key] || 0) + 1;
      perGroup[p.group] = (perGroup[p.group] || 0) + 1;
      if (p.command) commands++;
      if (p.cls !== 'infantry') { machines++; if (p.cls === 'aircraft') aircraft++; }
    }
    // a command unit first, at or below the battle tier
    var cmds = POOL.filter(function (p) { return (p.command || p.alpha) && p.tier <= battleTier && room(p); });
    if (cmds.length) take(pick(cmds));
    // then the minimum of the battle tier's own units
    var need = comp.limits[battleTier - 1][0] * pl;
    var guard = 0;
    while (counts[battleTier] < need && guard++ < 200) {
      var core = POOL.filter(function (p) { return p.tier === battleTier && !p.command && p.cls === 'infantry' && room(p); });
      if (!core.length) break;
      take(pick(core));
    }
    // then spend what is left on anything legal, favouring the bigger units
    guard = 0;
    while (guard++ < 400) {
      var any = POOL.filter(function (p) { return !p.command && room(p); });
      if (!any.length) break;
      any.sort(function (a, b) { return b.tier - a.tier; });
      var top = any.filter(function (p) { return p.tier === any[0].tier; });
      take(pick(rnd() > 0.35 ? top : any));
      if (spent >= budget) break;
    }
    return keys;
  }

  /* ---------- ready-made forces, one pair per Battle Tier ---------- */
  /* Ready-made companies — one per Battle Tier per side of the coin. Every one
     fields at least one machine, on a propulsion that suits its job. */
  var PRESETS = {
    1: [
      { id: 'militia', name: 'Militia detachment', keys: ['cmd4', 'recruits', 'recruits', 'irregulars', 'enforcers', 'lpv:wheeled'] },
      { id: 'chaingang', name: 'Chain gang', keys: ['cmd4', 'penal', 'penal', 'irregulars', 'recruits', 'unarmoured:wheeled'] }
    ],
    2: [
      { id: 'contract', name: 'Contract company', keys: ['cmd3', 'rookie', 'rookie', 'lighteng', 'hpv:wheeled', 'observers'] },
      { id: 'ironbacked', name: 'Iron-backed company', keys: ['cmd3', 'ecobats', 'ecobats', 'lhunter:tracked', 'lightat', 'nomads'] }
    ],
    3: [
      { id: 'ironhold', name: 'Task Force Ironhold', keys: ['cmd2', 'regular', 'regular', 'engineers', 'lcv:tracked', 'sharpshooters'] },
      { id: 'blackwater', name: 'Task Force Blackwater', keys: ['cmd2', 'veterans', 'regular', 'bats', 'lapc:hover', 'observers'] }
    ],
    4: [
      { id: 'vanguard', name: 'Vanguard battlegroup', keys: ['cmd1', 'veterans', 'veterans', 'shock', 'mcv:tracked', 'protectors'] },
      { id: 'hammer', name: 'Hammer battlegroup', keys: ['cmd1', 'protectors', 'protectors', 'hapc:tracked', 'tsc', 'veterans'] }
    ],
    5: [
      { id: 'praetorian', name: 'Praetorian command', keys: ['highcmd', 'rangers', 'commandos', 'protectorshm', 'acv:walker', 'snipers'] },
      { id: 'spearhead', name: 'Spearhead command', keys: ['highcmd', 'rangers', 'rangers', 'commandos', 'protectorshm', 'mdestroyer:grav'] }
    ]
  };

  /* Ready-made insurgent groups. The revolt is never short of bodies, so these
     lean on numbers, improvised hulls and a leader out in front. */
  var PRESETS_REBEL = {
    1: [
      { id: 'streetrising', name: 'Street rising', keys: ['rinstigators', 'rciv', 'rciv', 'rciv', 'rridergang', 'rtechnical'] },
      { id: 'minersrevolt', name: "Miners' revolt", keys: ['rinstigators', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rtechnical'] }
    ],
    2: [
      { id: 'redfront', name: 'Red Revolutionary Front cell', keys: ['rsecondary', 'rmilitia', 'rmilitia', 'rminers', 'rlmg', 'rtechnical'] },
      { id: 'pilgrimage', name: 'Armed pilgrimage', keys: ['rsecondary', 'racolytes', 'racolytes', 'rmilitia', 'rlightart', 'rriderwar'] }
    ],
    3: [
      { id: 'freespace', name: 'Free Space Freedom Fighters', keys: ['rleaders', 'rinsurgents', 'rinsurgents', 'rhellriders', 'rat', 'ricv:tracked'] },
      { id: 'faithful', name: 'Column of the faithful', keys: ['rleaders', 'rfanatics:riders', 'rfanatics', 'rinsurgents', 'rmedart', 'ritv:wheeled'] }
    ],
    4: [
      { id: 'partisanarmy', name: 'Partisan army', keys: ['rinfluential', 'rassaultcdo', 'rsabcdo', 'rhardened', 'rheavyart', 'rhicv:tracked'] },
      { id: 'hellriderhost', name: 'Hellrider host', keys: ['rinfluential', 'rlegendary', 'rlegendary', 'renlightened', 'rharshminers', 'rlflak:wheeled'] }
    ],
    5: [
      { id: 'liberation', name: 'Army of liberation', keys: ['rrebellion', 'rguard', 'rguard', 'rmujahideen', 'rhardened', 'rshtv:tracked'] },
      { id: 'finaluprising', name: 'The final uprising', keys: ['rrebellion', 'rguard', 'rmujahideen', 'rmujahideen', 'rassaultcdo', 'rhshuttle'] }
    ]
  };
  function presetsFor(tier, faction) {
    if (faction === 'bugs' || faction === 'xeno') return [];
    return ((faction === 'rebel' ? PRESETS_REBEL : PRESETS)[tier] || []);
  }

  /* ---------- Rebel Tactics (p. 95) ----------
     Chosen once the scenario and the attacker are settled, before a single piece
     of terrain goes down. A force takes one, or none. Not used in solitaire. */
  var TACTICS = [
    {
      id: 'laststand', name: 'Last Stand',
      short: 'Dig in and make them pay for every yard.',
      text: 'All Rebel infantry count a Defence bonus of +4 in terrain that shelters them. ' +
        'Up to four barricades a Priority Level are placed anywhere but the enemy deployment zone. ' +
        'The first three casualties, not two, leave Morale untouched.'
    },
    {
      id: 'wave', name: 'Human Wave Attacks',
      short: 'Numbers. More of them than they have bullets.',
      text: 'Two extra infantry units of the Battle Tier a Priority Level, off the composition points. ' +
        'Infantry move 4" further on Move and Assault actions, and both the leaders\' shouts carry 18" instead of 12".'
    },
    {
      id: 'guerillas', name: 'Guerillas',
      short: 'Out of the tunnels, into the dark.',
      text: 'Every infantry unit without Riders gains Stealth and Battlefield Insertion.'
    }
  ];
  function tacticById(id) {
    for (var i = 0; i < TACTICS.length; i++) if (TACTICS[i].id === id) return TACTICS[i];
    return null;
  }

  /* "Death or Glory, Comrades!" (p. 94): an allied unit within 12" of one of these
     leaders throws off every Suppression point as its Assault begins — which is
     also the only way a Suppressed unit may be ordered to charge at all. Broken
     units, other leaders and anyone two Tiers above are past shouting at. */
  function deathOrGlory(state, u) {
    if (!state || !u || status(u) === 'broken') return null;
    if (hasOwn(u, 'Death or Glory, Comrades!')) return null;
    // Deserters and POWs "do not follow army special rules (including Insurgent leader special rules)" (p. 103)
    if (hasOwn(u, 'No Army Rules')) return null;
    var reach = u.tactic === 'wave' ? 18 : 12;
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (!o.alive || o.aboard || o.side !== u.side || o === u) continue;
      if (!hasOwn(o, 'Death or Glory, Comrades!')) continue;
      if (!projects(o)) continue;                          // a pinned-down leader shouts at nobody (p. 28)
      if (u.tier >= o.tier + 2) continue;
      if (unitDist(o, u) <= reach) return o;
    }
    return null;
  }

  /* ---------- terrain ---------- */
  var TERRAIN = {
    open:      { name: 'Open ground', blocks: false, impassable: false, movePenalty: 0, cover: 0, fp: 0 },
    woods:     { name: 'Woods',       blocks: true,  impassable: false, movePenalty: 1, cover: 2, fp: 0 },
    ruins:     { name: 'Ruins',       blocks: true,  impassable: false, movePenalty: 1, cover: 2, fp: 0 },
    crater:    { name: 'Rubble and craters', blocks: false, impassable: false, movePenalty: 1, cover: 2, fp: 0 },
    barricade: { name: 'Low walls',   blocks: false, impassable: false, movePenalty: 1, cover: 2, fp: 0, destructible: 'linear', linear: true },
    rocks:     { name: 'Rocks',       blocks: true,  impassable: true,  movePenalty: 0, cover: 0, fp: 0 },
    /* Hills block line of sight between units that are not on them (p. 42); a
       unit on one gets +2 Firepower shooting down, and sees over its own side. */
    hill:      { name: 'Hill',        blocks: false, impassable: false, movePenalty: 0, cover: 0, fp: 2, hill: true },
    /* Buildings (p. 41) are not walked into: a unit Enters one as a special
       action, one unit to a building (to a section, in a building of several
       wings), and Exits it the same way. So for movement they are solid. The
       summary table (p. 43): Defence +2 for all; Firepower +2 from a high
       building or a reinforced one, none from a low one; a reinforced building
       cannot be brought down. */
    building:  { name: 'Building',    blocks: true,  impassable: true, movePenalty: 0, cover: 2, fp: 2, destructible: 'building', enterable: true },
    bunker:    { name: 'Reinforced building', blocks: true, impassable: true, movePenalty: 0, cover: 2, fp: 2, enterable: true },
    wall:      { name: 'High wall',   blocks: true,  impassable: true,  movePenalty: 0, cover: 0, fp: 0, destructible: 'linear', linear: true },
    /* Trenches (p. 42): area terrain, Defence bonus and Movement penalty, and
       the men in them are immune to Crossfire. */
    trench:    { name: 'Trench',      blocks: false, impassable: false, movePenalty: 1, cover: 2, fp: 0, noCrossfire: true },
    /* Barbed wire (p. 42): crossing a section costs an extra D6", rolled before
       the move — and nothing else. */
    wire:      { name: 'Barbed wire', blocks: false, impassable: false, movePenalty: 0, cover: 0, fp: 0, linear: true, wire: true },
    water:     { name: 'Shallow water', blocks: false, impassable: false, movePenalty: 1, cover: 0, fp: 0, shallow: true },
    deep:      { name: 'Deep water',  blocks: false, impassable: true,  movePenalty: 0, cover: 0, fp: 0 },
    lava:      { name: 'Lava field',  blocks: false, impassable: true,  movePenalty: 0, cover: 0, fp: 0 },
    /* The barren table's impassable ground (p. 47), as a desert or an arctic
       world has it: a field of glowing crystal, or a ravine in the ice. Both
       play as a lava field does — nobody crosses, everyone sees over. */
    crystal:   { name: 'Crystal field', blocks: false, impassable: true,  movePenalty: 0, cover: 0, fp: 0 },
    ravine:    { name: 'Ice ravine',  blocks: false, impassable: true,  movePenalty: 0, cover: 0, fp: 0 },
    // the Demolish scenario's target: impassable, and only the Demolish action
    // touches it — a Sapper charge at +4, anyone else's at +2 (p. 54)
    objective: { name: 'The objective', blocks: true,  impassable: true, movePenalty: 0, cover: 0, fp: 0, destructible: 'target' },
    /* Find and secure's three possible locations (p. 52): "small, passable area
       terrain pieces, which do not block line of sight, do not provide cover and
       cannot be destroyed". They are there to be seen and searched, nothing else. */
    searchsite: { name: 'A possible location', blocks: false, impassable: false, movePenalty: 0, cover: 0, fp: 0 },
    // Ambush! (p. 156): the road the enemy column is on — open ground, and nothing stands on it
    road: { name: 'Road', blocks: false, impassable: false, movePenalty: 0, cover: 0, fp: 0 },
    // what a demolished piece leaves behind (p. 41-43)
    razed:     { name: 'Rubble of a wall', blocks: false, impassable: false, movePenalty: 0, cover: 0, fp: 0, wreck: true },
    burning:   { name: 'Burning building', blocks: true, impassable: true, movePenalty: 0, cover: 0, fp: 0, wreck: true }
  };

  /* ---- the table: in rules/space.js ---- */
  var KIT_SPACE = null;
  // what the space kit is made from: the stubs until every kit is made, then the functions themselves (linkKits)
  function eSpace() {
    return {
      BOARD: BOARD, SHAPED: SHAPED, STEP: STEP, TERRAIN: TERRAIN, UNIT_R: UNIT_R, angleWrap: angleWrap,
      hasOwn: hasOwn, isFlying: isFlying, nearestClear: nearestClear, sightRange: sightRange, status: status
    };
  }
  function kitSpace() {
    return KIT_SPACE || (KIT_SPACE = (root.PMCSpace || require('./space.js'))(eSpace()));
  }
  function centreDist(a, b) { return (KIT_SPACE || kitSpace()).centreDist(a, b); }
  function unitDist(a, b) { return (KIT_SPACE || kitSpace()).unitDist(a, b); }
  function rectPointDist(q, x, y) { return (KIT_SPACE || kitSpace()).rectPointDist(q, x, y); }
  function enterable(r) { return (KIT_SPACE || kitSpace()).enterable(r); }
  function sectionsOf(r) { return (KIT_SPACE || kitSpace()).sectionsOf(r); }
  function sectionRect(u) { return (KIT_SPACE || kitSpace()).sectionRect(u); }
  function sectionHigh(r, q) { return (KIT_SPACE || kitSpace()).sectionHigh(r, q); }
  function occupant(state, r, sec) { return (KIT_SPACE || kitSpace()).occupant(state, r, sec); }
  function canGarrison(u) { return (KIT_SPACE || kitSpace()).canGarrison(u); }
  function enterTargets(state, u) { return (KIT_SPACE || kitSpace()).enterTargets(state, u); }
  function enterBuilding(state, u, r, sec) { return (KIT_SPACE || kitSpace()).enterBuilding(state, u, r, sec); }
  function exitSpots(state, u) { return (KIT_SPACE || kitSpace()).exitSpots(state, u); }
  function exitBuilding(state, u, p) { return (KIT_SPACE || kitSpace()).exitBuilding(state, u, p); }
  function leaveAway(state, u, from) { return (KIT_SPACE || kitSpace()).leaveAway(state, u, from); }
  function inches(ax, ay, bx, by) { return (KIT_SPACE || kitSpace()).inches(ax, ay, bx, by); }
  function inRect(x, y, r) { return (KIT_SPACE || kitSpace()).inRect(x, y, r); }
  function inPoly(x, y, pts) { return (KIT_SPACE || kitSpace()).inPoly(x, y, pts); }
  function pieceDepth(r, x, y) { return (KIT_SPACE || kitSpace()).pieceDepth(r, x, y); }
  function placePiece(t, x, y, w, h) { return (KIT_SPACE || kitSpace()).placePiece(t, x, y, w, h); }
  function turnPoint(x, y, k) { return (KIT_SPACE || kitSpace()).turnPoint(x, y, k); }
  function turnPiece(t, k) { return (KIT_SPACE || kitSpace()).turnPiece(t, k); }
  function shapePiece(r, rand, family) { return (KIT_SPACE || kitSpace()).shapePiece(r, rand, family); }
  function terrainAt(state, x, y) { return (KIT_SPACE || kitSpace()).terrainAt(state, x, y); }
  function terrainOf(state, u) { return (KIT_SPACE || kitSpace()).terrainOf(state, u); }
  function footprint(x, y) { return (KIT_SPACE || kitSpace()).footprint(x, y); }
  function kindsUnder(state, u, x, y) { return (KIT_SPACE || kitSpace()).kindsUnder(state, u, x, y); }
  function coverAt(state, x, y, u) { return (KIT_SPACE || kitSpace()).coverAt(state, x, y, u); }
  function segRect(x1, y1, x2, y2, r) { return (KIT_SPACE || kitSpace()).segRect(x1, y1, x2, y2, r); }
  function pointSegDist(px, py, x1, y1, x2, y2) { return (KIT_SPACE || kitSpace()).pointSegDist(px, py, x1, y1, x2, y2); }
  function hasLoS(state, a, b) { return (KIT_SPACE || kitSpace()).hasLoS(state, a, b); }
  function lineClear(state, a, b) { return (KIT_SPACE || kitSpace()).lineClear(state, a, b); }
  function groundLevel(state, x, y) { return (KIT_SPACE || kitSpace()).groundLevel(state, x, y); }
  function levelOf(state, u) { return (KIT_SPACE || kitSpace()).levelOf(state, u); }
  function tooHighToHover(state, x, y) { return (KIT_SPACE || kitSpace()).tooHighToHover(state, x, y); }
  function onHill(state, p) { return (KIT_SPACE || kitSpace()).onHill(state, p); }
  function unitNear(state, x, y, ignore, pad) { return (KIT_SPACE || kitSpace()).unitNear(state, x, y, ignore, pad); }
  // the pieces that come in natural outlines; built things stay square
  var SHAPED = { woods: 1, crater: 1, rocks: 1, water: 1, deep: 1, lava: 1, crystal: 1, ravine: 1, hill: 1 };
  /* ---------- unit state ---------- */
  function hasOwn(u, rule) {
    var rs = u.rules;
    for (var i = 0; i < rs.length; i++) if (rs[i].indexOf(rule) === 0) return true;
    return false;
  }
  /* "Anti-tank" is a prefix of "Anti-tank (limited)", so a plain has() would hand
     the limited version the full rule at any range. This asks for the exact name. */
  function hasExact(u, rule) {
    if (u.rules.indexOf(rule) >= 0) return true;
    if (!u.cargo || !u.cargo.length || !hasOwn(u, 'Command Vehicle')) return false;
    for (var c = 0; c < u.cargo.length; c++) {
      var p = u.cargo[c];
      if (p && p.rules && hasOwn(p, 'Command Unit') && p.rules.indexOf(rule) >= 0) return true;
    }
    return false;
  }
  // Anti-tank, for this shot: the limited version only reaches 6"
  function antiTank(u, dist) {
    return hasExact(u, 'Anti-tank') || (has(u, 'Anti-tank (limited)') && dist <= 6);
  }

  /* ---------- campaign hooks (pp. 87-89) ----------
     A unit built from a campaign dossier carries `u.camp`, holding the named
     behaviours its Battle Honours, Traumas and Upgrades switch on; a side's
     doctrines live on `state.doctrines`. Every check below is inert in a one-off
     battle, where neither is present. */
  function campFlag(u, name) {
    return !!(u && u.camp && u.camp.flags && u.camp.flags[name]);
  }
  function doctrine(state, side, id) {
    return !!(state && state.doctrines && state.doctrines[side] &&
      state.doctrines[side].indexOf(id) >= 0);
  }
  function unitDoc(state, u, id) { return !!u && doctrine(state, u.side, id); }
  // the bug groups an Evolutionary Pathway names (p. 124)
  function bugRanged(u) { return !!u && u.faction === 'bugs' && (u.group === 'Spore Bugs' || u.group === 'Flying Bugs'); }
  function bugGround(u) { return !!u && u.faction === 'bugs' && (u.group === 'Lesser Bugs' || u.group === 'Underground Bugs'); }
  /* Who broke or killed this unit. The first breaker keeps the credit, because
     the book pays experience for "breaking or destroying" — one or the other. */
  function credit(t, a, kind) {
    if (!t || !a) return;
    var who = a.rid || a.id || null;
    if (!who) return;
    if (kind === 'broke') { if (!t.brokeBy) t.brokeBy = who; }
    else t.killedBy = who;
  }

  function has(u, rule) {
    if (hasOwn(u, rule)) return true;
    // Drone units "are always counted as having the Determined special rule" (p. 40)
    if (rule === 'Determined' && hasOwn(u, 'Drone unit')) return true;
    // a Command Vehicle carries the rules of the Command Unit riding inside it
    if (!u.cargo || !u.cargo.length || !hasOwn(u, 'Command Vehicle')) return false;
    for (var c = 0; c < u.cargo.length; c++) {
      var p = u.cargo[c];
      if (p && p.rules && hasOwn(p, 'Command Unit') && hasOwn(p, rule)) return true;
    }
    return false;
  }
  function ruleValue(u, rule) {
    var v = ownValue(u, rule);
    if (v !== null) return v;
    if (u.cargo && u.cargo.length && hasOwn(u, 'Command Vehicle')) {
      for (var c = 0; c < u.cargo.length; c++) {
        var p = u.cargo[c];
        if (!p || !p.rules || !hasOwn(p, 'Command Unit')) continue;
        var pv = ownValue(p, rule);
        if (pv !== null) return pv;
      }
    }
    return 0;
  }
  function ownValue(u, rule) {
    for (var i = 0; i < u.rules.length; i++) {
      if (u.rules[i].indexOf(rule) === 0) {
        var m = u.rules[i].match(/\((\d+)\)/);
        return m ? parseInt(m[1], 10) : 0;
      }
    }
    return null;
  }
  function isMachine(u) { return u.cls === 'vehicle' || u.cls === 'aircraft'; }
  function isFlying(u) { return u.cls === 'aircraft'; }

  /* ---------- what a unit sounds and looks like when it fires ----------
     The rules do not name weapon types, but they do say enough about how each
     unit shoots to tell four things apart, and the book's own words decide it:

       trajectory  Indirect Fire (p. 57) — it lobs, so the round arcs and lands
                   a beat later: mortars, artillery, the support vehicles
       shell       a Destructive Weapon fired flat — one heavy round, gone in an
                   instant: tank guns, hunters and destroyers, anti-tank teams,
                   and the guided missiles, which fly rather than lob
       burst       an automatic weapon — a long rattle: MG teams, autocannon,
                   FlaK, and the technicals built round them
       small       everything else: rifles, carbines, sidearms */
  /* A guided anti-tank missile climbs and comes down on the roof; a surface-to-air
     missile goes straight up the line of sight. So they part company here. */
  /* ---------- what each unit shoots with ----------
     The book gives no weapon types, only a Firepower and a Range, so this table
     is the reading: every profile is named, and the name says what you see and
     hear when it fires. `p` is the primary; `s` an optional secondary that goes
     off with it (a tank's coaxial, a gunship's guns under its rockets); `n` is
     how many tubes fire at once, which is what separates a mortar section from
     a battery.

     The styles:
       small   a rifle volley — eight men, ragged, about a second
       pistol  a sidearm: a few deliberate single shots — command, medics, civilians
       smg     short bursts at close range: assault troops and enforcers
       burst   a machine gun, rattling
       chain   an autocannon: heavier, slower, countable
       shell   a direct projectile — a flat bolt that lands at once
       shellbig the same, bigger, with a blast ring
       arc     a lobbed projectile, up and over
       arcbig  the same, heavier and higher
       missile a guided missile: smoke, and it turns onto the target
       rocket  unguided rockets, off the rails in a salvo
       flame   a cone of fire
       rail    an instant white line that fades — Gauss weapons and las-cutters
       spit    a glob of acid in a low wet lob, splashing green (bugs)
       spitbig a glowing sac of bio-plasma, bigger and brighter (bugs)
       spine   a volley of chitin darts (winged and pioneer bugs)
       energy  pulses of light in the army's colour (Xenotripod small arms)
       orb     a glowing plasma orb, lobbed or teleported onto the target,
               bursting in a ring (Gamma squads, turrets, strike craft)
       orbbig  the same, heavier and slower, landing in a splash of blue fire
               (the advanced support vehicle's energy howitzer)
       none    it has no gun at all */
  // what a dug-in piece fires instead, laid level over open sights
  var DUG_WEAPONS = { rmedart: { p: 'shellbig' }, rheavyart: { p: 'shellbig', n: 2 } };
  var WEAPONS = {
    /* ---- PMC infantry ---- */
    recruits: { p: 'small' },
    // irregulars scavenge carbines; penal troops are issued a sidearm and a shovel
    irregulars: { p: 'smg' }, penal: { p: 'pistol' },
    enforcers: { p: 'smg' },
    rookie: { p: 'small' }, regular: { p: 'small' },
    // the senior rifle teams have carbines in the squad alongside the rifles
    veterans: { p: 'small', s: 'smg' }, rangers: { p: 'small', s: 'smg' },
    lighteng: { p: 'smg' }, engineers: { p: 'smg' },
    // assault troops carry charges as well as carbines, and use them (p. 64)
    shock: { p: 'arc', n: 2, s: 'smg' }, commandos: { p: 'arc', n: 2, s: 'smg' },
    // battle armour sweeps a room with carbines rather than hammering it
    ecobats: { p: 'smg' }, bats: { p: 'smg' },
    // the Protectors go in close, behind three charges rather than two
    protectors: { p: 'arc', n: 3, s: 'smg' },
    protectorshm: { p: 'arc', n: 3, s: 'smg' },
    // the forward observers carry rifles, and fire them like any rifle team
    observers: { p: 'small' }, sharpshooters: { p: 'shell', s: 'pistol' },
    lrrp: { p: 'rail', n: 2 },
    // the sniper team: a pair of heavy rounds, then a pair of Gauss lines
    snipers: { p: 'shell', n: 2, s: 'rail', sn: 2 },
    // the section is its two machine guns: the loader feeds them rather than shooting
    lmgsection: { p: 'burst' },
    // the MG team has a carbine in the section alongside the gun
    // four machine guns, fed by two loaders
    lmgteam: { p: 'burst' },
    // a crew-served Gauss cannon: three shots in quick succession, not one
    hmgteam: { p: 'chain' }, gausscannon: { p: 'rail', n: 3 },
    lightat: { p: 'shell' }, atteam: { p: 'shell' },
    // an ATGM team and a SAM team both put a pair of guided missiles in the air
    missile: { p: 'missile', n: 2 }, sam: { p: 'missile', n: 2 },
    mortarsection: { p: 'arc', n: 1 }, mortarteam: { p: 'arc', n: 2 }, mortarbattery: { p: 'arc', n: 3 },
    /* Command, medics and signallers all carry Firepower 1 at 12": a sidearm,
       not a rifle line. They are defending themselves, not putting fire down. */
    cmd4: { p: 'pistol' }, cmd3: { p: 'pistol' }, cmd2: { p: 'pistol' },
    cmd1: { p: 'pistol' }, highcmd: { p: 'pistol' },
    ew: { p: 'pistol' }, medics: { p: 'pistol' },
    // drone units carry what the squads they stand in for carry; the support drones lob shells
    // (the recon drones fire as light infantry do, a crack of single shots)
    dcombat: { p: 'small' }, dassault: { p: 'smg' }, drecon: { p: 'pistol' },
    // the engineer drones fire a sidearm and throw a grenade; the support drones lob three rounds, up and over
    dengineer: { p: 'pistol', s: 'arc', sn: 1 }, dsupport: { p: 'arc', n: 3 }, dmedic: { p: 'pistol' },
    nomads: { p: 'small' }, chem: { p: 'flame' },

    /* ---- PMC machines ---- */
    // a patrol jeep has the crew's rifles; the heavy one mounts a machine gun
    lpv: { p: 'small' }, hpv: { p: 'chain' }, recon: { p: 'shell', s: 'pistol' },
    // the light tank: its main gun twice over, and the commander's sidearm
    lcv: { p: 'shell', n: 2, s: 'pistol' },
    /* A medium hull fires its main gun twice in quick succession over the
       coaxial; an advanced one puts three rounds of main gun down and follows
       them with two lines from its rail driver. */
    mcv: { p: 'shellbig', n: 2, s: 'pistol' },
    acv: { p: 'shellbig', n: 3, s: 'rail', sn: 2 },
    lhunter: { p: 'missile', n: 2 }, hunter: { p: 'missile', n: 3 },
    ldestroyer: { p: 'shellbig', n: 2 },
    // the medium destroyer's gun is a rail driver: the line, then the round bursting
    mdestroyer: { p: 'shellbig', n: 2, s: 'rail', sn: 2 },
    // a soft-skinned lorry has no gun of its own: what shoots is the crew, at 12"
    unarmoured: { p: 'pistol' }, ltransport: { p: 'smg' },
    lapc: { p: 'small' },
    lifv: { p: 'chain', s: 'missile' }, hapc: { p: 'small' }, hifv: { p: 'missile', n: 2, s: 'chain' },
    // a command vehicle is a staff car with an antenna farm, not a gun platform
    cmdveh: { p: 'small' },
    insertplat: { p: 'none' },
    // engineering hulls: a flame projector over a gun, and a breaching cannon
    lengveh: { p: 'flame', s: 'chain' },
    hengveh: { p: 'shell', n: 3, s: 'rail', sn: 3 },
    // support hulls fire in batteries: two tubes, then three
    impsupport: { p: 'rocket' }, lsupport: { p: 'arcbig', n: 3 },
    msupport: { p: 'arcbig', n: 5, s: 'arcbig', sn: 5 },
    // the advanced support hull's heavy plasma cannon: four bolts, each one bursting
    // an energy howitzer: three heavy orbs lobbed over, bursting blue
    asupport: { p: 'orbbig', n: 3 },
    // air defence: the gun first, then the missiles off the rails
    aaveh: { p: 'missile', n: 2, s: 'chain' },
    // signals and ambulance hulls: a pintle gun and the crew, nothing more
    ewveh: { p: 'small' }, medveh: { p: 'small' },
    /* Transport aircraft: a door gun and whoever is leaning out of it, inside a
       Limited Fire Arc. The strike craft below are the ones with weapons. */
    adaptedcraft: { p: 'small' }, lightcraft: { p: 'small' },
    heavycraft: { p: 'small' }, flyingcp: { p: 'small' },
    // the flexible strike craft rakes with its nose gun under a rocket rack; the transport has a door gun
    fsc: { p: 'burst', s: 'rocket' }, tsc: { p: 'small', s: 'rocket' },
    gunboat: { p: 'chain', s: 'rocket' }, hsc: { p: 'missile', n: 3, s: 'rocket' }, asc: { p: 'shellbig', n: 3, s: 'rail', sn: 3 },
    // the light VTOL drone carries no gun worth the name: a light sidearm's crack
    vtoldrone: { p: 'pistol' },
    // the interceptor: a pair of air-to-air missiles off the rails, then the cannon
    interceptor: { p: 'missile', n: 2, s: 'burst' },

    /* ---- the Rebel list, read the same way ---- */
    // armed civilians: whatever was in the house, at 12"
    rciv: { p: 'pistol' },
    rmilitia: { p: 'small' }, rinsurgents: { p: 'small' },
    rhardened: { p: 'small' },
    // the guard have carbines through the ranks as well as rifles
    rguard: { p: 'small', s: 'smg' },
    // the Holy Warriors go in close, with whatever will fire on the run
    racolytes: { p: 'smg' }, rfanatics: { p: 'smg' },
    renlightened: { p: 'small' }, rmujahideen: { p: 'small' },
    /* Mounted Warriors ride in throwing: a carbine in one hand and a pair of
       charges in the other, and the hellriders with something heavier across
       the saddle. */
    rridergang: { p: 'smg', s: 'arc', sn: 2 }, rriderwar: { p: 'smg', s: 'arc', sn: 2 },
    rhellriders: { p: 'smg', s: 'arc', sn: 2 }, rlegendary: { p: 'chain', s: 'arc', sn: 2 },
    rlmg: { p: 'burst' }, rautocannon: { p: 'chain' },
    rat: { p: 'shell' },
    // the insurgents' AA weapons are old shoulder guns: they fire a shell, not a guided missile
    raa: { p: 'shell' },
    rlightart: { p: 'arcbig', n: 1 }, rmedart: { p: 'arcbig', n: 2 }, rheavyart: { p: 'arcbig', n: 3 },
    // the heavy autocannon squad hammers, then puts three heavy rounds through it
    rheavyac: { p: 'chain', s: 'shellbig', sn: 3 },
    rassaultcdo: { p: 'small', s: 'smg' }, rsabcdo: { p: 'small', s: 'smg' },
    rsnipercdo: { p: 'shell', s: 'pistol' },
    /* Miners carry Gauss Weapon (las-cutters) — a mining tool the rules let them
       shoot with, at 12". It cuts rock, not a line across the table, so they are
       drawn firing small arms; the rule itself is unaffected. */
    // las-cutters, fired in pairs: two lines in quick succession
    rminers: { p: 'rail', n: 2 }, rfaceminers: { p: 'rail', n: 2 },
    rharshminers: { p: 'rail', n: 2 },
    rdesconscript: { p: 'small' }, rpow: { p: 'smg' },
    rdesrookie: { p: 'small' }, rdesrifle: { p: 'small' },
    rinstigators: { p: 'small' },
    rsecondary: { p: 'small' }, rleaders: { p: 'small' },
    // the senior leaders have a bodyguard with carbines around them
    rinfluential: { p: 'small', s: 'smg' }, rrebellion: { p: 'small', s: 'smg' },
    /* Improvised hulls: a pickup with the crew's own rifles, then a welded
       gun-truck throwing charges over its machine gun, then a proper autocannon,
       and at the top a rocket rack over one. */
    rtechnical: { p: 'small' },
    ricv: { p: 'chain', s: 'rocket' },
    rlicv: { p: 'chain' },
    rhicv: { p: 'shellbig', n: 2, s: 'rocket' },
    rltv: { p: 'small' }, ritv: { p: 'chain' },
    // the super-heavy carries a gun in the back as well as its autocannon
    rshtv: { p: 'chain', s: 'shell', sn: 2 },
    rlflak: { p: 'burst' }, rmflak: { p: 'burst', s: 'burst' },
    rhflak: { p: 'chain', s: 'burst' },
    // a captured patrol craft and an armed shuttle: a door gun and the crew
    rpatrol: { p: 'small' }, rlshuttle: { p: 'burst' },
    // the armed shuttles carry a proper door cannon, not a machine gun
    rmshuttle: { p: 'chain' }, rhshuttle: { p: 'chain' },
    rlifter: { p: 'none' },

    /* ---- the Space Bugs ----
       Nothing here fires a round. Spore bugs and the leaders spit acid in a low,
       wet lob (`spit`); the bio-plasma thrower and the Queen hurl a glowing sac
       of it (`spitbig`); winged and pioneer bugs loose a volley of chitin spines
       (`spine`). The fire beetle's jaws are a flame projector. Lesser,
       underground and infected have no Firepower and so no weapon at all. */
    bspitlarva: { p: 'spit' }, bimmspit: { p: 'spit', n: 2 }, bspitters: { p: 'spit', n: 3 },
    bsporethrow: { p: 'spit', n: 4 },
    bbioplasma: { p: 'spitbig', n: 2 }, bfirebeetle: { p: 'flame' },
    bsmallwing: { p: 'spine' }, blargewing: { p: 'spine', s: 'spit', sn: 2 },
    bcarrier: { p: 'spit', n: 2 },
    bsmallpath: { p: 'spine' }, bpathfinder: { p: 'spine' }, blurkers: { p: 'spine', s: 'spit' },
    bshadow: { p: 'spine', s: 'spit', sn: 2 },
    bwatchlarva: { p: 'spit' }, bimmwatch: { p: 'spit' }, bwatchers: { p: 'spit' },
    bovermind: { p: 'spit', n: 2 }, bqueen: { p: 'spitbig', n: 2 },
    // claws and mandibles only: Firepower —
    btiny: { p: 'none' }, bsmall: { p: 'none' }, battack: { p: 'none' }, boversized: { p: 'none' },
    bunderground: { p: 'none' }, bhugeunder: { p: 'none' }, bsandworm: { p: 'none' },
    binfected: { p: 'none' },

    /* ---- the Xenotripods ----
       Crocks fire pulses of light in the tribe's colour; the Gamma squads'
       charges and the craft's plasma missiles are glowing orbs. The Esh-Aven
       start with blades and crude slug-throwers and work up to Gauss. */
    xalpha1: { p: 'energy' }, xalpha2: { p: 'energy' }, xalpha3: { p: 'energy' },
    xalpha4: { p: 'energy', n: 2 }, xalpha5: { p: 'energy', n: 2 },
    xbeta2: { p: 'energy', n: 2 }, xbeta3: { p: 'energy', n: 2 }, xbeta4: { p: 'energy', n: 3 },
    xgamma3: { p: 'orb', n: 2 }, xgamma4: { p: 'orb', n: 3 }, xgamma5: { p: 'orb', n: 3 },
    xdelta1: { p: 'none' }, xdelta2: { p: 'pistol' }, xdelta3: { p: 'small' },
    // the Esh-Aven: bursts of tracer, but it is energy that crackles out of them
    xeps1: { p: 'none' }, xeps2: { p: 'pistol' }, xeps3: { p: 'small' },
    xeps4: { p: 'rail', n: 2 }, xeps5: { p: 'rail', n: 3 },
    xstrike2: { p: 'energy', n: 3 }, xstrike3: { p: 'orb', n: 2, s: 'energy', sn: 3 },
    xstrike4: { p: 'orb', n: 3, s: 'energy', sn: 3 }, xstrike5: { p: 'energy', n: 5, s: 'rail', sn: 3 },
    xrecon: { p: 'energy' }, xtelecraft: { p: 'energy', n: 2 },
    xshieldb: { p: 'energy', n: 2 }, xshield: { p: 'energy', n: 2 }, xshieldhp: { p: 'energy', n: 2 },
    xdturret1: { p: 'orb', n: 2 }, xdturret2: { p: 'orb', n: 2 }, xdturret3: { p: 'orb', n: 2 },
    xdturret4: { p: 'orb', n: 2 }, xdturret5: { p: 'orb', n: 2 },
    xtturret2: { p: 'none' }, xtturret3: { p: 'none' }, xtturret4: { p: 'none' },
    xsturret3: { p: 'none' }, xsturret4: { p: 'none' }, xsturret5: { p: 'none' }
  };

  /* A unit that is not in the table — a profile added later, or one built by a
     test — still has to fire like something. These are the same readings, taken
     from the rules the unit carries rather than from its name. */
  function guessWeapon(u) {
    var name = u.name || '';
    if (hasOwn(u, 'Gauss Weapon')) return { p: 'rail' };
    if (/\bsam\b|\baa weapons\b/i.test(name)) return { p: 'missile' };
    if (hasOwn(u, 'Indirect Fire')) return { p: 'arc' };
    if (hasOwn(u, 'Destructive Weapon') && isMachine(u)) return { p: 'shellbig' };
    if (hasOwn(u, 'Destructive Weapon')) return { p: 'shell' };
    if (/autocannon|flak|anti-?aircraft|\bifv\b/i.test(name)) return { p: 'chain' };
    if (/\bmg\b|machine ?gun/i.test(name)) return { p: 'burst' };
    if (isMachine(u)) return { p: 'burst' };
    return { p: 'small' };
  }

  /* The full descriptor for a unit's gun. Campaign upgrades and Battle Honours
     can change what a unit carries, so anything the unit has picked up is
     honoured over the table. */
  function weaponSpec(u) {
    if (!u) return { p: 'small', n: 1, sn: 1 };
    if (u.fp === null || u.fp === undefined || hasOwn(u, 'Unarmed')) return { p: 'none', n: 1, sn: 1 };
    var w = WEAPONS[u.key] || guessWeapon(u);
    // dug in, a field piece fires over open sights: big shells straight at the target (p. 94)
    if (DUG_WEAPONS[u.key] && dugIn(u)) w = DUG_WEAPONS[u.key];
    // `n` is how many the primary puts out at once; `sn` the same for the secondary
    return { p: w.p, s: w.s || null, n: w.n || 1, sn: w.sn || 1 };
  }
  // the primary alone, which is what most callers want
  function weaponStyle(u) { return weaponSpec(u).p; }

  /* "Hasta la Victoria Siempre!" (p. 94): a Rebel infantry unit does not reduce
     its Morale for the first two soldiers killed — three, under the Last Stand
     tactic (p. 95). Deserters and POWs stand outside every army rule (p. 103). */
  function freeLosses(u) {
    if (!u || u.faction !== 'rebel' || u.cls !== 'infantry') return 0;
    if (hasOwn(u, 'No Army Rules')) return 0;
    return u.tactic === 'laststand' ? 3 : 2;
  }
  /* Undisciplined (p. 94): the rebels are brave but never drilled. It bites the
     whole Rebel army — machines included — but not Deserters and POWs. */
  function undisciplined(u) {
    return !!u && u.faction === 'rebel' && !hasOwn(u, 'No Army Rules');
  }
  function currentMorale(u) {
    if (isMachine(u)) return 0;                       // machines have Structure instead
    if (has(u, 'Determined')) return u.morale;
    var lost = Math.max(0, (u.size - u.models) - freeLosses(u));
    return Math.max(1, u.morale - lost);
  }
  function status(u) {
    if (isMachine(u)) return 'ready';                 // never suppressed, never broken
    var m = currentMorale(u);
    // a solitaire OpFor Command Unit can be pinned down but never broken (p. 152)
    if (u.sp > 2 * m) return u.noBreak ? 'suppressed' : 'broken';
    if (u.sp > m) return 'suppressed';
    return 'ready';
  }

  // Which face of a vehicle a shot comes in on. The rulebook gives +1 to the
  // firing roll against a side and +2 against a rear.
  function arcOf(target, shooter) {
    if (!isMachine(target) || target.facing == null) return 'front';
    if (hasOwn(target, 'Turret')) return 'front';          // a turret has no sides or rear (p. 130)
    var a = angleWrap(Math.atan2(shooter.y - target.y, shooter.x - target.x) - target.facing);
    var d = Math.abs(a);
    if (d <= Math.PI / 4) return 'front';
    if (d <= Math.PI * 3 / 4) return 'side';
    return 'rear';
  }
  // Limited Fire Arc: the target has to sit in the shooter's front quarter.
  function inFireArc(shooter, target) {
    if (shooter.facing == null) return true;
    var a = angleWrap(Math.atan2(target.y - shooter.y, target.x - shooter.x) - shooter.facing);
    return Math.abs(a) <= Math.PI / 4;
  }
  function sizeBonus(models) {
    if (models >= 7) return 3;
    if (models >= 5) return 2;
    if (models >= 3) return 1;
    return 0;
  }
  var SP_MAX = 12;                 // the most Suppression a unit can carry
  function addSP(u, n) { u.sp = Math.min(SP_MAX, u.sp + n); }
  function fmtPart(p) {
    if (p.label === 'D10') return 'D10 rolls ' + p.v;
    return p.label + ' ' + (p.v >= 0 ? '+' : '') + p.v;
  }

  /* ---------- defence ---------- */
  // Cover: the target standing in cover terrain, or an intervening piece of non-blocking
  // cover terrain between the two units (both outside it, on opposite sides).
  /* ---------- the Space Bugs' own rules (p. 116) ---------- */
  function flyInf(u) { return !!u && has(u, 'Flying Infantry'); }
  function onBoard(u) { return u && u.alive && !u.aboard && u.x >= 0 && !u.reserve; }
  // how far the Overmind reaches (Increased Control stretches it to 24", p. 124)
  function overmindReach(state, side) { return state && doctrine(state, side, 'BB3') ? 24 : 18; }
  /* The Overmind unit a bug is taking its orders from: friendly, on the table,
     within reach, and of this bug's Tier or higher. `unsup` asks for one that is
     not Suppressed (Endless Tide). */
  /* `anyTier`: the Tier limit is on the Overmind's cover and rally only; its
     hold over Aggressive and its Endless Tide reach bugs of any Tier (p. 116). */
  function overmindFor(state, u, unsup, anyTier) {
    if (!state || !u) return null;
    if (campFlag(u, 'deafSenses')) return null;             // Sensory Dysfunction
    var reach = overmindReach(state, u.side);
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o === u || o.side !== u.side || !onBoard(o) || !has(o, 'Overmind')) continue;
      if (!anyTier && o.tier < u.tier) continue;
      if (!anyTier && !projects(o)) continue;               // cover and rally are bonuses: a steady Overmind only (p. 28)
      if (unsup && status(o) !== 'ready') continue;
      if (unitDist(o, u) <= reach) return o;
    }
    return null;
  }
  /* Pheromone Markers: +1 for each friendly marker unit within 18" of the
     target (24" with Strong Pheromones), up to +3, for Animal Behaviour bugs. */
  // `inAssault`: Intense Pheromone Markers count double for Firepower only (p. 125)
  function pheromoneBonus(state, a, t, inAssault) {
    if (!state || !has(a, 'Animal Behaviour') || campFlag(a, 'deafSenses')) return 0;
    var reach = doctrine(state, a.side, 'BC3') ? 24 : 18, n = 0;
    state.units.forEach(function (o) {
      if (o.side !== a.side || !projects(o) || !has(o, 'Pheromone Markers')) return;   // steady markers only (p. 28)
      if (unitDist(o, t) <= reach) n += campFlag(o, 'intensePheromones') && !inAssault ? 2 : 1;
    });
    return Math.min(3, n);
  }
  // Aggressive: forced to charge the closest enemy — unless an Overmind holds it back
  function aggressiveNow(state, u) {
    if (!has(u, 'Aggressive') || isMachine(u)) return false;
    return !overmindFor(state, u, false, true);
  }
  /* Endless Tide, in the End phase: an unbroken unit near an unsuppressed
     Overmind digs D3 lost bugs back out of the ground. */
  function endlessTide(state) {
    var log = [];
    state.units.forEach(function (u) {
      if (!onBoard(u) || !has(u, 'Endless Tide') || status(u) === 'broken') return;
      var full = u.startSize || u.size;
      if (u.models >= full || !overmindFor(state, u, true, true)) return;
      var n = Math.min(d3(), full - u.models);
      u.models += n;
      log.push({ t: 'rally', text: 'Endless Tide — ' + n + ' more bug' + (n === 1 ? '' : 's') + ' crawl out to join ' + u.label + ' (' + u.models + '/' + full + ').', unit: u, n: n });
    });
    return log;
  }
  /* Psychic Wave (p. 116): every enemy within 12" — no line of sight needed,
     Drones excepted — takes D6-1 Suppression. */
  function psychicWave(state, u) {
    var log = [], hit = [];
    log.push({ t: 'assault', text: u.label + ' sends out a Psychic Wave.' });
    state.units.forEach(function (e) {
      if (!onBoard(e) || e.side === u.side || e.drone || has(e, 'Drone Control')) return;
      if (unitDist(u, e) > 12) return;
      if (campFlag(e, 'shielding')) { log.push({ t: 'note', text: e.label + ' — Rite of Shielding: untouched.' }); return; }
      var n = Math.max(0, d6() - 1);
      if (n) addSP(e, n);
      hit.push(e);
      log.push({ t: n ? 'hits' : 'note', text: e.label + ' — D6−1 = ' + n + ' SP' + (n ? ' (' + status(e) + ')' : ', shrugs it off') + '.' });
    });
    if (!hit.length) log.push({ t: 'note', text: 'Nobody within 12" to feel it.' });
    return { log: log, hit: hit };
  }

  function coverFor(state, attacker, target) {
    if (campFlag(target, 'dumb')) return { v: 0, why: '' };   // Tactical Dumbness
    // Flying Infantry get nothing from the ground; Animal Behaviour bugs only under an Overmind
    if (flyInf(target)) return { v: 0, why: '' };
    if (has(target, 'Animal Behaviour') && !overmindFor(state, target, false)) return { v: 0, why: '' };
    // the whole unit in cover or none of it: partly in the open, it is in the open when shot at (p. 42)
    var here = Math.min.apply(null, kindsUnder(state, target).map(function (k) { return TERRAIN[k].cover || 0; }));
    /* Last Stand (p. 95): Rebel infantry "get +4 to their Defence parameter when in
       terrain which grants a Defence bonus" — behind a low wall as much as in ruins. */
    // (gun crews count: the mortar teams, autocannon teams and field guns are infantry too)
    var stand = target.tactic === 'laststand' && target.faction === 'rebel' && target.cls === 'infantry';
    function held(v, why) { return stand ? { v: Math.max(v, 4), why: why + ' — Last Stand' } : { v: v, why: why }; }
    if (here) return held(here, 'terrain cover');
    if (!attacker) return { v: 0, why: '' };
    /* A dug-in gun sits behind its own sandbags (p. 94): a short linear obstacle
       across its front, so like a low wall it shelters the gun from fire coming
       over it — from its front, or plunging down from any side. */
    if (dugIn(target) && (has(attacker, 'Indirect Fire') || sandbagged(target, attacker))) {
      // the sandbags are terrain that grants a Defence bonus, so Last Stand makes it +4
      return held(2, has(attacker, 'Indirect Fire') ? 'sandbags against plunging fire' : 'dug in behind sandbags');
    }
    // Indirect Fire falls from above, so a low wall shelters the target whichever
    // way the shot comes from
    /* Low walls (p. 42): "When a whole unit is behind a low wall (up to 2" from
       it), it gets a Defence bonus" — so every model within 2", which for a
       token of radius 1" means its middle within an inch of the wall, and the
       wall between it and the shooter. Rubble and the like shelter only the
       men standing in them, which the lines above already give. */
    var plunging = has(attacker, 'Indirect Fire');
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i], t = TERRAIN[r.kind];
      if (r.kind !== 'barricade') continue;
      if (inRect(attacker.x, attacker.y, r)) continue;
      if (rectPointDist(r, target.x, target.y) + UNIT_R > 2 + 1e-6) continue;
      // Indirect Fire falls from above, so the wall shelters them whichever way it comes
      if (plunging) return held(t.cover, 'low wall against plunging fire');
      if (segRect(attacker.x, attacker.y, target.x, target.y, r)) return held(t.cover, 'behind a low wall');
    }
    return { v: 0, why: '' };
  }
  function clampTo(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function defenceAgainst(state, attacker, target, opts) {
    opts = opts || {};
    var parts = [], def = target.def;
    parts.push({ label: 'Defence', v: target.def });
    if (has(target, 'Battle Armour') && attacker &&
      (antiTank(attacker, unitDist(attacker, target)) || has(attacker, 'Gauss Weapon'))) {
      var pierced = target.defPierced != null ? target.defPierced : target.def - 2;
      parts.push({ label: 'armour pierced', v: pierced - def });
      def = pierced;
    }
    var tProp = propOf(target);
    if (!opts.assault && !opts.noCover && (!isMachine(target) || (tProp && tProp.cover))) {  // only walkers, among machines
      var cov = coverFor(state, attacker, target);
      if (cov.v && !has(target, 'Battle Armour') && !(attacker && has(attacker, 'Gauss Weapon'))) {
        // Rite of Invisibility (p. 142): +3 from terrain rather than +2
        var cv = cov.v === 2 && campFlag(target, 'invisibility') ? 3 : cov.v;
        def += cv; parts.push({ label: cov.why + (cv !== cov.v ? ' — Rite of Invisibility' : ''), v: cv });
      }
    }
    /* Stealth (p. 59) is not cover: a hull has it too (the Shadow bug), and it
       holds against defensive fire, which only strips terrain bonuses. */
    if (!opts.assault && has(target, 'Stealth') && attacker && !has(attacker, 'Keen-Eyed')) {
      // +1 above 6", +2 above 12"...: exactly 6" away is not yet out of the first band
      var st = Math.max(0, Math.ceil(unitDist(attacker, target) / 6) - 1);
      if (st > 0) { def += st; parts.push({ label: 'Stealth', v: st }); }
    }
    // Shield Generator (p. 130): a dome against fire from outside it
    if (!opts.assault && attacker) {
      var sh = shieldFor(state, attacker, target);
      if (sh) { def += sh.v; parts.push({ label: 'Shield Generator (' + sh.from.name + ')', v: sh.v }); }
    }
    // Overloaded Energy Shields: +4 when shot at during an assault, which is the
    // defensive fire a charge draws
    if (opts.defensiveFire && campFlag(target, 'shields')) {
      def += 4; parts.push({ label: 'Overloaded Energy Shields', v: 4 });
    }
    if (opts.assault && doctrine(state, target.side, 'T4')) {
      def += 1; parts.push({ label: 'Improved HTH Training', v: 1 });
    }
    // Chitin Exoskeletons: Lesser and Underground Bugs +2 in assaults (p. 124)
    if (opts.assault && bugGround(target) && doctrine(state, target.side, 'BP5')) {
      def += 2; parts.push({ label: 'Chitin Exoskeletons', v: 2 });
    }
    return { value: def, parts: parts };
  }

  /* p. 28: "Both suppressed and broken unit cannot use their passive skills which
     grants bonuses to another units, such like Inspire presence, Field medics,
     Pheromone markers etc. Please note that this applies to bonuses only, but not
     for penalties (the life is unfair, I know...)".

     So this gate is for auras that HELP a friend — Inspiring Presence, Field
     Medics, Counter-jamming, "…but they'll never take our freedom!". It is not
     used for Jammers, which is a penalty on the enemy and keeps working from a
     unit that is pinned down or running. A unit riding inside a vehicle is not
     projecting anything either; a Command Vehicle carries its passenger's rules
     on the hull itself, so that case still reaches the table. */
  /* A Rapid insertion platform is scenery with a door (p. 79): it cannot take or
     contest an objective, and when it is shot to pieces it counts for nobody's
     victory conditions. */
  function holdsGround(u) { return !hasOwn(u, 'No Objectives'); }
  function countsForVictory(u) { return !hasOwn(u, 'No Objectives'); }

  // on the table and steady: a unit still in reserve, or riding inside, projects nothing
  function projects(u) {
    return !!u.alive && !u.aboard && !u.reserve && u.x >= 0 && status(u) === 'ready';
  }

  /* ---- hits and damage: in rules/damage.js ---- */
  var KIT_DAMAGE = null;
  // what the damage kit is made from: the stubs until every kit is made, then the functions themselves (linkKits)
  function eDamage() {
    return {
      TERRAIN: TERRAIN, UNIT_R: UNIT_R, addSP: addSP, campFlag: campFlag, clampBoard: clampBoard,
      credit: credit, currentMorale: currentMorale, d3: d3, d6: d6, doctrine: doctrine, droneUnit: droneUnit,
      has: has, hasOwn: hasOwn, infamyPanic: infamyPanic, isFlying: isFlying, isMachine: isMachine,
      projects: projects, psychicBond: psychicBond, shoot: shoot, status: status, terrainAt: terrainAt,
      unitDist: unitDist, unitNear: unitNear
    };
  }
  function kitDamage() {
    return KIT_DAMAGE || (KIT_DAMAGE = (root.PMCDamage || require('./damage.js'))(eDamage()));
  }
  function isMedic(u) { return (KIT_DAMAGE || kitDamage()).isMedic(u); }
  function medicNearby(state, target) { return (KIT_DAMAGE || kitDamage()).medicNearby(state, target); }
  function resolveShootingHits(state, target, hits, mod, atk) { return (KIT_DAMAGE || kitDamage()).resolveShootingHits(state, target, hits, mod, atk); }
  function resolveAssaultHits(target, hits, mod, atk) { return (KIT_DAMAGE || kitDamage()).resolveAssaultHits(target, hits, mod, atk); }
  function applyResult(state, target, res, log, atk) { return (KIT_DAMAGE || kitDamage()).applyResult(state, target, res, log, atk); }
  function dmgMod(state, a, t) { return (KIT_DAMAGE || kitDamage()).dmgMod(state, a, t); }
  function resolveDamage(target, hits, pierce, mod) { return (KIT_DAMAGE || kitDamage()).resolveDamage(target, hits, pierce, mod); }
  function applyDamage(state, t, damage, log, from) { return (KIT_DAMAGE || kitDamage()).applyDamage(state, t, damage, log, from); }
  function dropOff(state, veh, u) { return (KIT_DAMAGE || kitDamage()).dropOff(state, veh, u); }
  function repair(state, u) { return (KIT_DAMAGE || kitDamage()).repair(state, u); }
  function jammedNearby(state, u) { return (KIT_DAMAGE || kitDamage()).jammedNearby(state, u); }
  function canHack(state, a, t) { return (KIT_DAMAGE || kitDamage()).canHack(state, a, t); }
  function hack(state, a, t, fireBack) { return (KIT_DAMAGE || kitDamage()).hack(state, a, t, fireBack); }
  function collars(state) { return (KIT_DAMAGE || kitDamage()).collars(state); }
  function hackBurn(state, a, t, hits, log) { return (KIT_DAMAGE || kitDamage()).hackBurn(state, a, t, hits, log); }
  function commandAboard(veh) { return (KIT_DAMAGE || kitDamage()).commandAboard(veh); }

  /* ---------- transport ---------- */
  function canEmbark(state, veh, u) {
    if (!veh.transport || !u.alive || u.side !== veh.side) return false;
    // a vehicle hanging under a Lifter takes nothing on, and hitches no gun (p. 94)
    if (veh.aboard) return false;
    /* A Lifter is a flying crane: it picks up a single vehicle — with whatever is
       already riding inside it — and never infantry (p. 94). Every other hull is
       the other way round. */
    if (hasOwn(veh, 'Lifter')) {
      if (u.cls !== 'vehicle') return false;
      if (u.aboard || (veh.cargo || []).length >= veh.transport) return false;
      if (u.disembarked) return false;
      // a hull towing an emplaced gun cannot be lifted (p. 94)
      if ((u.cargo || []).some(function (c) { return hasOwn(c, 'Stationary Artillery'); })) return false;
      return unitDist(veh, u) <= 4;
    }
    if (isMachine(u)) return false;
    // a Rapid insertion platform is loaded before the battle and never again (p. 79)
    if (hasOwn(veh, 'Immobile')) return false;
    // Riders never ride in anything: the mounts do not fit (p. 94) — bar a motorbike (Appendix 3)
    if (hasOwn(u, 'Riders') && !(mountOf(u) && mountOf(u).transport)) return false;
    /* An emplaced gun is towed rather than carried, and a hull with a gun on the
       hook has no room for troops (p. 94). */
    var towing = (veh.cargo || []).some(function (c) { return hasOwn(c, 'Stationary Artillery'); });
    if (towing) return false;
    if (hasOwn(u, 'Stationary Artillery') && (veh.cargo || []).length) return false;
    if (u.aboard || (veh.cargo || []).length >= veh.transport) return false;
    if (status(u) !== 'ready') return false;            // shaken troops will not board
    if (u.disembarked) return false;                    // not back aboard the same turn
    if (u.bld) return false;                            // a garrison comes out first
    return unitDist(veh, u) <= 4;
  }
  function embark(state, veh, u) {
    if (!canEmbark(state, veh, u)) return null;
    veh.cargo = veh.cargo || [];
    veh.cargo.push(u);
    u.aboard = veh.id;
    u.boarded = true;                                   // "no single unit can be unloaded and loaded in the same turn" (p. 36)
    u.sp = 0;                                           // safe inside, and steadied
    u.x = -1; u.y = -1;
    return { text: u.label + ' embarks aboard ' + veh.name + '.' };
  }
  function disembark(state, veh, u, pos) {
    var i = (veh.cargo || []).indexOf(u);
    if (i < 0 || u.boarded) return null;               // loaded this turn: it stays aboard until the next
    veh.cargo.splice(i, 1);
    u.aboard = null;
    u.disembarked = true;
    // a gun unhitched is left pointing the way it trailed: back from the vehicle
    if (has(u, 'Stationary Artillery')) u.facing = (veh.facing || 0) + Math.PI;
    if (pos && !TERRAIN[terrainAt(state, pos.x, pos.y)].impassable
      && !unitNear(state, pos.x, pos.y, u, 0.2) && unitDist({ x: pos.x, y: pos.y }, veh) <= 4) {
      u.x = pos.x; u.y = pos.y;
    } else {
      dropOff(state, veh, u);
    }
    return { text: u.label + ' disembarks from ' + veh.name + '.' };
  }

  /* ---- destructible terrain: in rules/destruct.js ---- */
  var KIT_DESTRUCT = null;
  // what the destruct kit is made from: the stubs until every kit is made, then the functions themselves (linkKits)
  function eDestruct() {
    return {
      TERRAIN: TERRAIN, UNIT_R: UNIT_R, applyDamage: applyDamage, applyResult: applyResult,
      chargeBonus: chargeBonus, clampBoard: clampBoard, d10: d10, defenceAgainst: defenceAgainst,
      dmgMod: dmgMod, fallBack: fallBack, fmtPart: fmtPart, has: has, inRect: inRect, isFlying: isFlying,
      isMachine: isMachine, rectPointDist: rectPointDist, resolveDamage: resolveDamage,
      resolveShootingHits: resolveShootingHits, segRect: segRect, sizeBonus: sizeBonus, terrainAt: terrainAt,
      unitNear: unitNear
    };
  }
  function kitDestruct() {
    return KIT_DESTRUCT || (KIT_DESTRUCT = (root.PMCDestruct || require('./destruct.js'))(eDestruct()));
  }
  function isDestructible(r) { return (KIT_DESTRUCT || kitDestruct()).isDestructible(r); }
  function destructibleKind(r) { return (KIT_DESTRUCT || kitDestruct()).destructibleKind(r); }
  function shelterOf(state, attacker, target) { return (KIT_DESTRUCT || kitDestruct()).shelterOf(state, attacker, target); }
  function canDemolish(u, r) { return (KIT_DESTRUCT || kitDestruct()).canDemolish(u, r); }
  function canCharge(u, r) { return (KIT_DESTRUCT || kitDestruct()).canCharge(u, r); }
  function destroyTerrain(state, r, log, by) { return (KIT_DESTRUCT || kitDestruct()).destroyTerrain(state, r, log, by); }
  function nearestClear(state, u, r) { return (KIT_DESTRUCT || kitDestruct()).nearestClear(state, u, r); }
  function shootTerrain(state, a, r) { return (KIT_DESTRUCT || kitDestruct()).shootTerrain(state, a, r); }
  function detonate(state, a, r) { return (KIT_DESTRUCT || kitDestruct()).detonate(state, a, r); }
  function assaultTerrain(state, a, r) { return (KIT_DESTRUCT || kitDestruct()).assaultTerrain(state, a, r); }
  function crushOnMove(state, u, from, to, log) { return (KIT_DESTRUCT || kitDestruct()).crushOnMove(state, u, from, to, log); }

  /* ---- shooting: in rules/shoot.js ---- */
  var KIT_SHOOT = null;
  // what the shoot kit is made from: the stubs until every kit is made, then the functions themselves (linkKits)
  function eShoot() {
    return {
      TERRAIN: TERRAIN, UNIT_R: UNIT_R, angleWrap: angleWrap, antiTank: antiTank, applyDamage: applyDamage,
      applyResult: applyResult, arcOf: arcOf, bugRanged: bugRanged, campFlag: campFlag,
      canDemolish: canDemolish, centreDist: centreDist, d10: d10, defenceAgainst: defenceAgainst,
      destroyTerrain: destroyTerrain, dmgMod: dmgMod, doctrine: doctrine, dualMode: dualMode, flyInf: flyInf,
      fmtPart: fmtPart, has: has, hasLoS: hasLoS, hasOwn: hasOwn, inFireArc: inFireArc, isFlying: isFlying,
      isMachine: isMachine, kindsUnder: kindsUnder, levelOf: levelOf, lineClear: lineClear, mountOf: mountOf,
      pheromoneBonus: pheromoneBonus, pointSegDist: pointSegDist, propOf: propOf,
      resolveDamage: resolveDamage, resolveShootingHits: resolveShootingHits, ruleValue: ruleValue,
      sectionHigh: sectionHigh, sectionRect: sectionRect, shelterOf: shelterOf, sightRange: sightRange,
      sizeBonus: sizeBonus, status: status, tribeSees: tribeSees, undisciplined: undisciplined,
      unitDist: unitDist, xenoSenses: xenoSenses
    };
  }
  function kitShoot() {
    return KIT_SHOOT || (KIT_SHOOT = (root.PMCShoot || require('./shoot.js'))(eShoot()));
  }
  function nearestFacing(ang) { return (KIT_SHOOT || kitShoot()).nearestFacing(ang); }
  function dugIn(u) { return (KIT_SHOOT || kitShoot()).dugIn(u); }
  function sandbagged(gun, shooter) { return (KIT_SHOOT || kitShoot()).sandbagged(gun, shooter); }
  function shotRange(a) { return (KIT_SHOOT || kitShoot()).shotRange(a); }
  function shotMinRange(a) { return (KIT_SHOOT || kitShoot()).shotMinRange(a); }
  function canShoot(state, a, t, mode, opts) { return (KIT_SHOOT || kitShoot()).canShoot(state, a, t, mode, opts); }
  function markCall(state, a, t, opts) { return (KIT_SHOOT || kitShoot()).markCall(state, a, t, opts); }
  function shotMods(state, a, t, mode, opts) { return (KIT_SHOOT || kitShoot()).shotMods(state, a, t, mode, opts); }
  function shotOdds(state, a, t, mode, opts) { return (KIT_SHOOT || kitShoot()).shotOdds(state, a, t, mode, opts); }
  function assaultOdds(state, atk, def) { return (KIT_SHOOT || kitShoot()).assaultOdds(state, atk, def); }
  function shoot(state, a, t, mode, opts) { return (KIT_SHOOT || kitShoot()).shoot(state, a, t, mode, opts); }
  /* ---- the Xenotripods: in rules/xeno.js ---- */
  var KIT_XENO = null;
  // what the xeno kit is made from: the stubs until every kit is made, then the functions themselves (linkKits)
  function eXeno() {
    return {
      BOARD: BOARD, BY_KEY: BY_KEY, TERRAIN: TERRAIN, UNIT_R: UNIT_R, addSP: addSP, campFlag: campFlag,
      centreDist: centreDist, currentMorale: currentMorale, d6: d6, doctrine: doctrine, hasLoS: hasLoS,
      hasOwn: hasOwn, isFlying: isFlying, isMachine: isMachine, lineClear: lineClear, ruleValue: ruleValue,
      status: status, terrainAt: terrainAt, unitDist: unitDist, unitNear: unitNear
    };
  }
  function kitXeno() {
    return KIT_XENO || (KIT_XENO = (root.PMCXeno || require('./xeno.js'))(eXeno()));
  }
  function isXeno(u) { return (KIT_XENO || kitXeno()).isXeno(u); }
  function xenoSenses(u) { return (KIT_XENO || kitXeno()).xenoSenses(u); }
  function sightRange(u) { return (KIT_XENO || kitXeno()).sightRange(u); }
  function tribeSeers(state, side, t) { return (KIT_XENO || kitXeno()).tribeSeers(state, side, t); }
  function tribeSees(state, side, t) { return (KIT_XENO || kitXeno()).tribeSees(state, side, t); }
  function dualMode(state, a, t) { return (KIT_XENO || kitXeno()).dualMode(state, a, t); }
  function shieldFor(state, attacker, target) { return (KIT_XENO || kitXeno()).shieldFor(state, attacker, target); }
  function enemyWithin(state, u, r) { return (KIT_XENO || kitXeno()).enemyWithin(state, u, r); }
  function disruptedBy(state, u) { return (KIT_XENO || kitXeno()).disruptedBy(state, u); }
  function bondMorale(state, u) { return (KIT_XENO || kitXeno()).bondMorale(state, u); }
  function psychicBond(state, u, lost, log) { return (KIT_XENO || kitXeno()).psychicBond(state, u, lost, log); }
  function infamyPanic(state, u, log) { return (KIT_XENO || kitXeno()).infamyPanic(state, u, log); }
  function regainTargets(state, u) { return (KIT_XENO || kitXeno()).regainTargets(state, u); }
  function regainControl(state, u) { return (KIT_XENO || kitXeno()).regainControl(state, u); }
  function selfRepair(state, u) { return (KIT_XENO || kitXeno()).selfRepair(state, u); }
  function teleportFrom(state, tp) { return (KIT_XENO || kitXeno()).teleportFrom(state, tp); }
  function teleportPads(state, side) { return (KIT_XENO || kitXeno()).teleportPads(state, side); }
  function teleportRoll(state, u, tp) { return (KIT_XENO || kitXeno()).teleportRoll(state, u, tp); }
  function teleport(state, u, from, to) { return (KIT_XENO || kitXeno()).teleport(state, u, from, to); }

  /* ---------- NOT ONE STEP BACKWARDS! (T5, p. 87) ----------
     A Command Unit, or a friend within 12" of one, may shoot at a friendly unit
     carrying Suppression. The shot is resolved as normal — a 'Man down!' still
     kills — but every Suppression point the result would have given is taken
     away instead (two 'Get down!' and one 'Man down!' remove 4). */
  function steadyShooter(state, a) {
    if (!doctrine(state, a.side, 'T5') || a.fp === null || isMachine(a) || !a.alive || a.x < 0) return false;
    if (status(a) !== 'ready') return false;
    if (hasOwn(a, 'Command Unit')) return true;
    return state.units.some(function (c) {
      return c !== a && c.alive && c.side === a.side && c.x >= 0 && !c.aboard && hasOwn(c, 'Command Unit') && unitDist(a, c) <= 12;
    });
  }
  function steadyTargets(state, a) {
    if (!steadyShooter(state, a)) return [];
    return state.units.filter(function (t) {
      return t !== a && t.alive && t.side === a.side && t.x >= 0 && !t.aboard && !isMachine(t) && (t.sp || 0) > 0 &&
        unitDist(a, t) <= a.range && hasLoS(state, a, t);
    });
  }
  function steadyFire(state, a, t) {
    var m = shotMods(state, a, t, 'fire', {});
    var roll = d10(), total = m.total + roll, dres = m.def, parts = m.parts.slice();
    parts.unshift({ label: 'D10', v: roll });
    var hits = roll === 0 ? 0 : roll === 9 ? Math.max(1, total - dres.value) : Math.max(0, total - dres.value);
    var log = [{
      t: 'shoot', text: a.label + ' fires over the heads of ' + t.label + ' — NOT ONE STEP BACKWARDS!',
      math: parts.map(fmtPart).join(', ') + ' = ' + total + ' vs Defence ' + dres.value + ' → ' + hits + ' hit' + (hits === 1 ? '' : 's')
    }];
    var removed = 0, before = t.sp || 0, killed = 0, medicId = null;
    if (hits > 0) {
      var res = resolveShootingHits(state, t, hits, status(t) === 'broken' ? 1 : 0, null);
      medicId = res.medic || null;
      log.push({ t: 'hits', text: res.rolls.join(' · ') + ' — the Suppression is taken away, not given.' });
      // the dead are dead: casualties go through as normal, with no credit to anyone
      if (res.casualties) {
        var m0 = t.models;
        applyResult(state, t, { casualties: res.casualties, sp: 0, rolls: [], notes: [] }, log, null);
        killed = m0 - t.models;
        if (killed) log.push({ t: 'kill', text: killed + ' of ' + t.label + ' ' + (killed === 1 ? 'is' : 'are') + ' cut down by their own side.' });
      }
      if (t.alive) {
        var now = t.sp || 0;
        removed = Math.min(now, res.sp);
        t.sp = now - removed;
      }
    }
    if (t.alive) log.push({ t: 'rally', text: t.label + (removed ? ' sheds ' + removed + ' Suppression point' + (removed === 1 ? '' : 's') + ' (' + before + ' → ' + t.sp + ').' : ' is not moved by it.') });
    return medicId ? { log: log, hits: hits, removed: removed, killed: killed, medic: medicId } : { log: log, hits: hits, removed: removed, killed: killed };
  }

  /* ---- assault: in rules/assault.js ---- */
  var KIT_ASSAULT = null;
  // what the assault kit is made from: the stubs until every kit is made, then the functions themselves (linkKits)
  function eAssault() {
    return {
      BOARD: BOARD, BY_KEY: BY_KEY, STEP: STEP, TERRAIN: TERRAIN, UNIT_R: UNIT_R, applyDamage: applyDamage,
      applyResult: applyResult, bugGround: bugGround, campFlag: campFlag, canShoot: canShoot,
      clampTo: clampTo, d10: d10, d3: d3, d6: d6, deathOrGlory: deathOrGlory, defenceAgainst: defenceAgainst,
      destroyTerrain: destroyTerrain, destructibleKind: destructibleKind, dmgMod: dmgMod, doctrine: doctrine,
      drives: drives, enterBuilding: enterBuilding, enterable: enterable, field: field, flyInf: flyInf,
      fmtPart: fmtPart, has: has, hasOwn: hasOwn, isDestructible: isDestructible, isFlying: isFlying,
      isMachine: isMachine, isOvergrown: isOvergrown, jumps: jumps, leaveAway: leaveAway, occupant: occupant,
      pathTo: pathTo, pheromoneBonus: pheromoneBonus, rectPointDist: rectPointDist,
      resolveAssaultHits: resolveAssaultHits, resolveDamage: resolveDamage, sectionRect: sectionRect,
      shelterOf: shelterOf, shoot: shoot, sizeBonus: sizeBonus, status: status, terrainAt: terrainAt,
      unitDist: unitDist, unitNear: unitNear
    };
  }
  function kitAssault() {
    return KIT_ASSAULT || (KIT_ASSAULT = (root.PMCAssault || require('./assault.js'))(eAssault()));
  }
  function canAssault(a, t) { return (KIT_ASSAULT || kitAssault()).canAssault(a, t); }
  function chargeReach(state, a, allowance) { return (KIT_ASSAULT || kitAssault()).chargeReach(state, a, allowance); }
  function chargeRoute(state, a, t, allowance) { return (KIT_ASSAULT || kitAssault()).chargeRoute(state, a, t, allowance); }
  function canMartyr(state, u, foe) { return (KIT_ASSAULT || kitAssault()).canMartyr(state, u, foe); }
  function assault(state, a, t, opts) { return (KIT_ASSAULT || kitAssault()).assault(state, a, t, opts); }
  function chargeBonus(u, r) { return (KIT_ASSAULT || kitAssault()).chargeBonus(u, r); }
  function clampBoard(p) { return (KIT_ASSAULT || kitAssault()).clampBoard(p); }
  function fallBack(state, u, from, inch) { return (KIT_ASSAULT || kitAssault()).fallBack(state, u, from, inch); }

  /* ---- movement: in rules/move.js ---- */
  var KIT_MOVE = null;
  // what the move kit is made from: the stubs until every kit is made, then the functions themselves (linkKits)
  function eMove() {
    return {
      BOARD: BOARD, STEP: STEP, TERRAIN: TERRAIN, UNIT_R: UNIT_R, angleWrap: angleWrap, d6: d6,
      flyInf: flyInf, hasOwn: hasOwn, isFlying: isFlying, kindsUnder: kindsUnder, mountOf: mountOf,
      propOf: propOf, rectPointDist: rectPointDist, sectionRect: sectionRect, terrainAt: terrainAt,
      unitNear: unitNear
    };
  }
  function kitMove() {
    return KIT_MOVE || (KIT_MOVE = (root.PMCMove || require('./move.js'))(eMove()));
  }
  function jumps(u) { return (KIT_MOVE || kitMove()).jumps(u); }
  function terrainCost(u, kind) { return (KIT_MOVE || kitMove()).terrainCost(u, kind); }
  function terrainBars(u, kind) { return (KIT_MOVE || kitMove()).terrainBars(u, kind); }
  function field(state, u, allowance) { return (KIT_MOVE || kitMove()).field(state, u, allowance); }
  function turnsTo(u, x, y) { return (KIT_MOVE || kitMove()).turnsTo(u, x, y); }
  function turnToll(u, x, y) { return (KIT_MOVE || kitMove()).turnToll(u, x, y); }
  function driveCost(u, x, y, ground) { return (KIT_MOVE || kitMove()).driveCost(u, x, y, ground); }
  function drives(u) { return (KIT_MOVE || kitMove()).drives(u); }
  function reachable(state, u, allowance) { return (KIT_MOVE || kitMove()).reachable(state, u, allowance); }
  function pathTo(state, u, allowance, target) { return (KIT_MOVE || kitMove()).pathTo(state, u, allowance, target); }

  /* ---------- rally ---------- */
  /* Inspiring Presence (p. 58): "Friendly troops within 12\" of a unit with the
     Inspiring Presence rule are allowed to re-roll failed rolls for rallying.
     Other units with this rule, and units two or more Tiers higher than the unit
     with Inspiring Presence, do not benefit from this rule."

     A unit that has the rule itself is never inspired — not by another such unit
     and not by its own presence. The inspiring unit has to be steady and on the
     table to project it (p. 28). */
  function inspiringNearby(state, u) {
    if (has(u, 'Inspiring Presence')) return false;
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o === u || o.side !== u.side || !projects(o)) continue;
      if (!has(o, 'Inspiring Presence')) continue;
      if (u.tier >= o.tier + 2) continue;
      if (unitDist(o, u) <= 12) return true;
    }
    return false;
  }

  /* "…but they'll never take our freedom!" (p. 94). A friendly Rebel within 12"
     of one of these fire-breathers rolls three more dice to rally — five if the
     force walks the Path of the Prophet's Incense & Iron. Other units with the
     rule, Broken ones and anyone two Tiers above it are left to their own nerve.
     Human Wave Attacks stretches the shout to 18". */
  function freedomDice(state, u) {
    if (u.side == null) return 0;
    if (hasOwn(u, '…but they\'ll never take our freedom!')) return 0;
    if (hasOwn(u, 'No Army Rules')) return 0;         // Deserters and POWs (p. 103)
    if (status(u) === 'broken') return 0;
    var reach = u.tactic === 'wave' ? 18 : 12;
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o === u || o.side !== u.side || !projects(o)) continue;
      if (!hasOwn(o, '…but they\'ll never take our freedom!')) continue;
      if (u.tier >= o.tier + 2) continue;
      if (unitDist(o, u) > reach) continue;
      return doctrine(state, u.side, 'P6') ? 5 : 3;
    }
    return 0;
  }

  function droneUnit(u) { return !!u && hasOwn(u, 'Drone unit'); }
  function rally(state, u) {
    if (u.sp === 0) return null;
    // Drone units "automatically remove all Suppression points in the Rally phase" (p. 40)
    if (droneUnit(u)) {
      var sbD = status(u), wasD = u.sp;
      u.sp = 0;
      return { morale: currentMorale(u), dice: [], removed: wasD, before: wasD, after: 0, reroll: false, gone: false,
        need: 4, jammed: false, extras: ['Drone unit: all SP removed'], statusBefore: sbD, statusAfter: 'ready', overmind: true };
    }
    // Overmind (p. 116): bugs it controls lose every Suppression point in the Rally phase
    if (has(u, 'Animal Behaviour') && overmindFor(state, u, false)) {
      var sb0 = status(u), was = u.sp, om = overmindFor(state, u, false);
      u.sp = 0;
      return { morale: currentMorale(u), dice: [], removed: was, before: was, after: 0, reroll: false, gone: false,
        need: 4, jammed: false, extras: ['Overmind: ' + om.name + ' calms them — all SP removed'],
        statusBefore: sb0, statusAfter: 'ready', overmind: true };
    }
    var m = currentMorale(u), dice = [], rolls = [], removed = 0, extras = [];
    // Psychic Bond (p. 129): a Xenotripod may rally on a friend's Morale within 6"
    var bond = bondMorale(state, u);
    if (bond && bond.m > m) { m = bond.m; extras.push('Psychic Bond: ' + bond.from.name + '\u2019s Morale ' + bond.m); }
    // Rite of Rage (p. 142): two points go at once with an enemy within 12"
    var rage = 0;
    if (campFlag(u, 'rage') && enemyWithin(state, u, 12)) { rage = Math.min(2, u.sp); u.sp -= rage; extras.push('Rite of Rage −' + rage + ' SP'); }
    var freedom = freedomDice(state, u);
    var reroll = (inspiringNearby(state, u) && !campFlag(u, 'insubordinate')) || has(u, 'Animal Behaviour');
    var jammed = jammedNearby(state, u), need = jammed ? 5 : 4;
    if (campFlag(u, 'fearless')) { need = jammed ? 3 : 2; extras.push('Rite of Fearless: ' + need + '+'); }
    if (u.cls === 'infantry' && disruptedBy(state, u)) { need = 6; extras.push('Rite of Disruption: 6 only'); }
    if (campFlag(u, 'panic')) { need = 6; extras.push('Panic-mongers: 6 only'); }
    if (campFlag(u, 'brokenMinded')) { m = Math.floor(m / 2); extras.push('Broken-minded: half the dice'); }
    if (campFlag(u, 'ironDiscipline')) { m += 2; extras.push('Iron Discipline +2 dice'); }
    if (freedom) { m += freedom; extras.push('"…but they\'ll never take our freedom!" +' + freedom + ' dice'); }
    if (campFlag(u, 'surrounded')) {
      var near = 0;
      for (var q = 0; q < state.units.length; q++) {
        var o = state.units[q];
        if (o.alive && o.side !== u.side && !o.aboard && unitDist(o, u) <= 18) near++;
      }
      if (near) { m += near; extras.push('Surrounded, but Steady +' + near + ' dice'); }
    }
    var before = u.sp + rage, statusBefore = status(u);
    removed = rage;
    for (var i = 0; i < m; i++) {
      var a = d6(), b = null, v = a, txt = String(a);
      if (a < need && reroll) { b = d6(); v = b; txt = a + '→' + b; }
      if (v >= need) removed++;
      dice.push({ first: a, second: b, value: v, ok: v >= need });
      rolls.push(txt);
    }
    u.sp = Math.max(0, u.sp - removed);
    var gone = false;
    // the flight threshold is the unit's own Morale, not the dice it just rolled
    /* Past three times its Morale the unit is removed from play and "counts as
       having fled the battlefield. The soldiers scatter, run to safety, hide"
       (p. 34). They are not dead: the survivors are back on the dossier after the
       battle, so this is `fled`, not `wipedOut`. */
    /* ...unless a scenario says otherwise: an Evacuation's civilians keep
       stumbling towards safety however shaken, and a Decapitation's leaders
       never break at all (pp. 152-154). */
    if (u.sp > 3 * currentMorale(u) && !u.noFlee && !u.noBreak) { u.alive = false; gone = true; u.fled = true; u.brokenEver = true; }
    var note = gone ? ' — SP exceeds 3× Morale: the unit scatters and flees the field.' : '.';
    return {
      morale: m, dice: dice, removed: removed, before: before, after: u.sp,
      reroll: reroll, gone: gone, need: need, jammed: jammed, extras: extras,
      statusBefore: statusBefore, statusAfter: gone ? 'removed' : status(u),
      text: u.label + ' rallies: ' + m + 'D6 [' + rolls.join(' ') + '] on ' + need + '+' +
        (jammed ? ' (Jammers)' : '') + (reroll ? ' (Inspiring Presence re-rolls)' : '') +
        (extras.length ? ' (' + extras.join('; ') + ')' : '') +
        ' — removes ' + removed + ' SP, now ' + u.sp + ' SP' + note
    };
  }

  /* ---------- the men themselves: names, ranks, and casualties ----------
     The rules only ever count a unit's models. Each of them is also somebody:
     every soldier gets a name and a rank when the unit is mustered, and when the
     count drops the casualties are picked out of those still standing at random. None
     of this touches a die the rules roll — it rides beside `models` and is
     brought into line with it whenever the engine has finished a step, so no
     rule that adds or takes away a model has to know about it. A machine counts
     its crew instead: one commander or pilot, a casualty when the hull is destroyed.
     Drones and turrets have nobody aboard. The swarm has no individuals at all,
     and neither do the tribe's Esh-Aven: those units only count what they lose. */
  var FIRST = ['Adam', 'Aiko', 'Alexei', 'Amara', 'Anders', 'Ana', 'Arjun', 'Bea', 'Bogdan', 'Carlos',
    'Chen', 'Dara', 'Dmitri', 'Elena', 'Emeka', 'Erik', 'Farah', 'Felix', 'Grace', 'Hana', 'Hector',
    'Ibrahim', 'Ines', 'Ivan', 'Jae', 'Jamal', 'Jonas', 'Kai', 'Kasia', 'Kofi', 'Lars', 'Leila', 'Liam',
    'Lucia', 'Malik', 'Marek', 'Maya', 'Mei', 'Mikhail', 'Nadia', 'Nikos', 'Noor', 'Olek', 'Omar', 'Pavel',
    'Priya', 'Rafael', 'Rhys', 'Rosa', 'Ruth', 'Sami', 'Sanjay', 'Sofia', 'Sven', 'Tariq', 'Tomas', 'Una',
    'Viktor', 'Wen', 'Yara', 'Yusuf', 'Zofia', 'Zoran'];
  var LAST = ['Abara', 'Adeyemi', 'Almeida', 'Bauer', 'Becker', 'Brennan', 'Castillo', 'Chowdhury', 'Costa',
    'Dvorak', 'Eriksen', 'Ferreira', 'Fischer', 'Gallagher', 'Garcia', 'Haddad', 'Hansen', 'Horvat', 'Ito',
    'Jaworski', 'Kaplan', 'Kim', 'Kowalski', 'Kruger', 'Laine', 'Lindqvist', 'Mahmoud', 'Marsh', 'Mendes',
    'Moreau', 'Nakamura', 'Novak', 'Nwosu', 'Okafor', 'Oliveira', 'Orlov', 'Park', 'Petrov', 'Quinn',
    'Rahman', 'Reyes', 'Rossi', 'Sato', 'Schmidt', 'Silva', 'Sokolov', 'Tanaka', 'Toure', 'Vance', 'Varga',
    'Volkov', 'Walsh', 'Weber', 'Wojcik', 'Yilmaz', 'Zhang', 'Zielinski'];
  var NICK = ['Ghost', 'Spider', 'Doc', 'Sparks', 'Lucky', 'Hammer', 'Wolf', 'Crow', 'Moth', 'Saint',
    'Brick', 'Fox', 'Deacon', 'Rook', 'Tinker', 'Viper', 'Blue', 'Ash'];
  var XENO_SYL = ['ka', 'tha', 'ir', 'zha', 'ul', 'vek', 'sa', 'ren', 'oth', 'qua', 'li', 'mar', 'es', 'dro', 'ya', 'kel', 'un', 'ssi'];
  var OFFICER = ['Lieutenant', 'Captain', 'Major', 'Lieutenant Colonel', 'Colonel'];
  var REBEL_CHIEF = ['Cell Leader', 'Captain', 'Commandant', 'Commander', 'General'];

  function pickOf(list) { return list[Math.floor(Math.random() * list.length)]; }
  function syllables(list, a, b) {
    var n = a + Math.floor(Math.random() * (b - a + 1)), s = '';
    for (var i = 0; i < n; i++) s += pickOf(list);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function humanName(rebel) {
    var n = pickOf(FIRST) + ' ' + pickOf(LAST);
    // about one rebel fighter in three goes by a nom de guerre
    if (rebel && Math.random() < 0.35) n = pickOf(FIRST) + ' ‘' + pickOf(NICK) + '’ ' + pickOf(LAST);
    return n;
  }
  // one name, of the kind the unit's side would give
  function soldierName(u) {
    var f = u.faction || 'pmc';
    if (f === 'xeno') return syllables(XENO_SYL, 2, 3) + ' ' + syllables(XENO_SYL, 2, 3);
    return humanName(f === 'rebel');
  }
  // a unit whose losses are counted rather than named: the swarm, and the Esh-Aven
  function counted(u) {
    if (!u) return false;
    var p = BY_KEY[u.key];
    return u.faction === 'bugs' || !!u.eshAven || !!(p && p.eshAven);
  }
  // does this unit have anyone in it who could be named?
  function crewed(u) {
    if (counted(u)) return false;
    if (!isMachine(u)) return true;
    return !u.drone && !has(u, 'Turret') && !/Turret/.test(u.group || '');
  }
  /* The rank of the i-th man in the unit. The first leads it, the second is
     second-in-command, the rest are the rank and file — so a squad that has
     lost its sergeant closes up behind the corporal when it is mustered again. */
  function rankFor(u, i) {
    var f = u.faction || 'pmc', tier = Math.max(1, Math.min(5, u.tier || 1)), g = u.group || '';
    if (isMachine(u)) return isFlying(u) ? 'Pilot' : (f === 'xeno' ? 'Rider' : f === 'rebel' ? 'Driver' : 'Commander');
    if (u.vip) return i === 0 ? 'VIP' : 'Bodyguard';
    if (f === 'xeno') {
      if (u.command) return i === 0 ? 'Warleader' : 'Chosen';
      if (g === 'Chosen Warriors') return 'Chosen';
      return i === 0 ? 'Hunt-leader' : 'Warrior';
    }
    if (f === 'rebel') {
      if (u.key === 'rciv' || u.soloCiv) return 'Civilian';
      if (u.command) return i === 0 ? REBEL_CHIEF[tier - 1] : 'Lieutenant';
      if (g === 'Holy Warriors') return i === 0 ? 'Preacher' : 'Zealot';
      if (g === 'Deserters and POWs') return i === 0 ? 'Ex-Sergeant' : 'Deserter';
      if (u.key === 'rmilitia' || u.soloMilitia) return i === 0 ? 'Militia Captain' : 'Militiaman';
      return i === 0 ? 'Cell Leader' : 'Fighter';
    }
    if (u.command) return i === 0 ? OFFICER[tier - 1] : i === 1 ? 'Sergeant Major' : 'Staff Sergeant';
    if (u.key === 'penal') return i === 0 ? 'Warden' : 'Convict';
    if (i === 0) return tier >= 3 ? 'Sergeant' : 'Corporal';
    if (i === 1 && (u.size || 1) >= 4) return tier >= 3 ? 'Corporal' : 'Lance Corporal';
    return tier >= 4 ? 'Specialist' : 'Private';
  }
  function standing(u) { return isMachine(u) ? (u.alive || u.fled ? 1 : 0) : Math.max(0, u.models || 0); }
  function freshMan(u, taken) {
    var name, tries = 0;
    do { name = soldierName(u); } while (taken && taken[name] && ++tries < 20);
    if (taken) taken[name] = 1;
    return { name: name, rank: rankFor(u, (u.men || []).length) };
  }
  /* Muster the unit before the battle: the survivors it brought with it (a
     campaign unit's own men, in the order they stand), trimmed or filled up to
     the strength it takes the field at, then ranked by where each man stands. */
  function musterMen(u, carried, taken) {
    if (counted(u)) { u.men = []; u.seenModels = standing(u); u.lostModels = 0; return u.men; }
    var want = crewed(u) ? (isMachine(u) ? 1 : Math.max(0, u.models || 0)) : 0;
    u.men = (carried || []).filter(function (m) { return m && m.name && m.lost == null; })
      .slice(0, want).map(function (m) { return { name: m.name }; });
    u.men.forEach(function (m) { if (taken) taken[m.name] = 1; });
    while (u.men.length < want) u.men.push(freshMan(u, taken));
    u.men.forEach(function (m, i) { m.rank = rankFor(u, i); });
    return u.men;
  }
  /* Bring the named men into line with the model count: one picked at random
     as a casualty for every model lost, and a fresh one for every model the
     rules gave back (the Endless Tide, a unit returned to the pool). */
  function syncMen(u, turn, taken) {
    if (counted(u)) { countLosses(u); return []; }
    if (!u.men) return [];
    var live = u.men.filter(function (m) { return m.lost == null; });
    var want = crewed(u) ? standing(u) : 0, out = [];
    if (isMachine(u)) want = Math.min(want, u.men.length);
    while (live.length > want) {
      var m = live.splice(Math.floor(Math.random() * live.length), 1)[0];
      m.lost = turn || 0;
      out.push(m);
    }
    if (!isMachine(u)) while (live.length < want) { var n = freshMan(u, taken); u.men.push(n); live.push(n); }
    return out;
  }
  /* A counted unit's losses, as a running total: every model that goes down
     adds to it, and the ones the Endless Tide digs back out do not take it away. */
  function countLosses(u) {
    var now = standing(u);
    if (u.seenModels == null) u.seenModels = now;
    if (now < u.seenModels) u.lostModels = (u.lostModels || 0) + u.seenModels - now;
    u.seenModels = now;
  }
  /* What a lost bug is worth in biomass: its Tier for every model, and 25 for
     one of the Overgrown giants — so a Tier II brood of eight is 16, and one
     Queen is a little more than a whole Tier IV brood. The Infected humans the
     fungus raises are not the swarm's own flesh, and are worth nothing. */
  function biomassOf(p) {
    if (!p) return 1;
    if (p.group === 'Infected Humans') return 0;
    return isOvergrown(p) ? 25 : Math.max(1, p.tier || 1);
  }
  // who comes back for the next battle: everyone who was not a casualty
  function survivors(u) {
    return (u.men || []).filter(function (m) { return m.lost == null; }).map(function (m) { return { name: m.name, rank: m.rank }; });
  }

  /* The kits, made now that everything they are handed exists, and linked:
     each name above that stood in for a kit's function becomes that function,
     and every kit is handed the others' functions themselves, so a path search
     calling terrainAt does not go through a stub each time. */
  (function linkKits() {
    kitSpace(); kitDamage(); kitDestruct(); kitShoot(); kitXeno(); kitAssault(); kitMove();
    centreDist = KIT_SPACE.centreDist;
    unitDist = KIT_SPACE.unitDist;
    rectPointDist = KIT_SPACE.rectPointDist;
    enterable = KIT_SPACE.enterable;
    sectionsOf = KIT_SPACE.sectionsOf;
    sectionRect = KIT_SPACE.sectionRect;
    sectionHigh = KIT_SPACE.sectionHigh;
    occupant = KIT_SPACE.occupant;
    canGarrison = KIT_SPACE.canGarrison;
    enterTargets = KIT_SPACE.enterTargets;
    enterBuilding = KIT_SPACE.enterBuilding;
    exitSpots = KIT_SPACE.exitSpots;
    exitBuilding = KIT_SPACE.exitBuilding;
    leaveAway = KIT_SPACE.leaveAway;
    inches = KIT_SPACE.inches;
    inRect = KIT_SPACE.inRect;
    inPoly = KIT_SPACE.inPoly;
    pieceDepth = KIT_SPACE.pieceDepth;
    placePiece = KIT_SPACE.placePiece;
    turnPoint = KIT_SPACE.turnPoint;
    turnPiece = KIT_SPACE.turnPiece;
    shapePiece = KIT_SPACE.shapePiece;
    terrainAt = KIT_SPACE.terrainAt;
    terrainOf = KIT_SPACE.terrainOf;
    footprint = KIT_SPACE.footprint;
    kindsUnder = KIT_SPACE.kindsUnder;
    coverAt = KIT_SPACE.coverAt;
    segRect = KIT_SPACE.segRect;
    pointSegDist = KIT_SPACE.pointSegDist;
    hasLoS = KIT_SPACE.hasLoS;
    lineClear = KIT_SPACE.lineClear;
    groundLevel = KIT_SPACE.groundLevel;
    levelOf = KIT_SPACE.levelOf;
    tooHighToHover = KIT_SPACE.tooHighToHover;
    onHill = KIT_SPACE.onHill;
    unitNear = KIT_SPACE.unitNear;
    isMedic = KIT_DAMAGE.isMedic;
    medicNearby = KIT_DAMAGE.medicNearby;
    resolveShootingHits = KIT_DAMAGE.resolveShootingHits;
    resolveAssaultHits = KIT_DAMAGE.resolveAssaultHits;
    applyResult = KIT_DAMAGE.applyResult;
    dmgMod = KIT_DAMAGE.dmgMod;
    resolveDamage = KIT_DAMAGE.resolveDamage;
    applyDamage = KIT_DAMAGE.applyDamage;
    dropOff = KIT_DAMAGE.dropOff;
    repair = KIT_DAMAGE.repair;
    jammedNearby = KIT_DAMAGE.jammedNearby;
    canHack = KIT_DAMAGE.canHack;
    hack = KIT_DAMAGE.hack;
    collars = KIT_DAMAGE.collars;
    hackBurn = KIT_DAMAGE.hackBurn;
    commandAboard = KIT_DAMAGE.commandAboard;
    isDestructible = KIT_DESTRUCT.isDestructible;
    destructibleKind = KIT_DESTRUCT.destructibleKind;
    shelterOf = KIT_DESTRUCT.shelterOf;
    canDemolish = KIT_DESTRUCT.canDemolish;
    canCharge = KIT_DESTRUCT.canCharge;
    destroyTerrain = KIT_DESTRUCT.destroyTerrain;
    nearestClear = KIT_DESTRUCT.nearestClear;
    shootTerrain = KIT_DESTRUCT.shootTerrain;
    detonate = KIT_DESTRUCT.detonate;
    assaultTerrain = KIT_DESTRUCT.assaultTerrain;
    crushOnMove = KIT_DESTRUCT.crushOnMove;
    nearestFacing = KIT_SHOOT.nearestFacing;
    dugIn = KIT_SHOOT.dugIn;
    sandbagged = KIT_SHOOT.sandbagged;
    shotRange = KIT_SHOOT.shotRange;
    shotMinRange = KIT_SHOOT.shotMinRange;
    canShoot = KIT_SHOOT.canShoot;
    markCall = KIT_SHOOT.markCall;
    shotMods = KIT_SHOOT.shotMods;
    shotOdds = KIT_SHOOT.shotOdds;
    assaultOdds = KIT_SHOOT.assaultOdds;
    shoot = KIT_SHOOT.shoot;
    isXeno = KIT_XENO.isXeno;
    xenoSenses = KIT_XENO.xenoSenses;
    sightRange = KIT_XENO.sightRange;
    tribeSeers = KIT_XENO.tribeSeers;
    tribeSees = KIT_XENO.tribeSees;
    dualMode = KIT_XENO.dualMode;
    shieldFor = KIT_XENO.shieldFor;
    enemyWithin = KIT_XENO.enemyWithin;
    disruptedBy = KIT_XENO.disruptedBy;
    bondMorale = KIT_XENO.bondMorale;
    psychicBond = KIT_XENO.psychicBond;
    infamyPanic = KIT_XENO.infamyPanic;
    regainTargets = KIT_XENO.regainTargets;
    regainControl = KIT_XENO.regainControl;
    selfRepair = KIT_XENO.selfRepair;
    teleportFrom = KIT_XENO.teleportFrom;
    teleportPads = KIT_XENO.teleportPads;
    teleportRoll = KIT_XENO.teleportRoll;
    teleport = KIT_XENO.teleport;
    canAssault = KIT_ASSAULT.canAssault;
    chargeReach = KIT_ASSAULT.chargeReach;
    chargeRoute = KIT_ASSAULT.chargeRoute;
    canMartyr = KIT_ASSAULT.canMartyr;
    assault = KIT_ASSAULT.assault;
    chargeBonus = KIT_ASSAULT.chargeBonus;
    clampBoard = KIT_ASSAULT.clampBoard;
    fallBack = KIT_ASSAULT.fallBack;
    jumps = KIT_MOVE.jumps;
    terrainCost = KIT_MOVE.terrainCost;
    terrainBars = KIT_MOVE.terrainBars;
    field = KIT_MOVE.field;
    turnsTo = KIT_MOVE.turnsTo;
    turnToll = KIT_MOVE.turnToll;
    driveCost = KIT_MOVE.driveCost;
    drives = KIT_MOVE.drives;
    reachable = KIT_MOVE.reachable;
    pathTo = KIT_MOVE.pathTo;
    KIT_SPACE.relink(eSpace()); KIT_DAMAGE.relink(eDamage()); KIT_DESTRUCT.relink(eDestruct()); KIT_SHOOT.relink(eShoot()); KIT_XENO.relink(eXeno()); KIT_ASSAULT.relink(eAssault()); KIT_MOVE.relink(eMove());
  })();

  root.PMC = {
    BOARD: BOARD, UNIT_R: UNIT_R, STEP: STEP, SP_MAX: SP_MAX,
    CATALOGUE: CATALOGUE, PRESETS: PRESETS, PRESETS_REBEL: PRESETS_REBEL,
    COMPOSITION: COMPOSITION, COMPOSITION_BUGS: COMPOSITION_BUGS, compFor: compFor, isOvergrown: isOvergrown, ROMAN: ROMAN, FACTIONS: FACTIONS, TACTICS: TACTICS,
    presetsFor: presetsFor, listFor: listFor, factionOf: factionOf, tacticById: tacticById,
    applyRiders: applyRiders, canRide: canRide, freedomDice: freedomDice,
    undisciplined: undisciplined, freeLosses: freeLosses, deathOrGlory: deathOrGlory,
    dugIn: dugIn, nearestFacing: nearestFacing, shotRange: shotRange, shotMinRange: shotMinRange,
    profile: function (k) { return BY_KEY[k]; },
    checkArmy: checkArmy, rollArmy: rollArmy, TERRAIN: TERRAIN,
    d10: d10, d6: d6, d3: d3, angleWrap: angleWrap, esc: esc,
    inches: inches, unitDist: unitDist, centreDist: centreDist, hasLoS: hasLoS, lineClear: lineClear,
    isXeno: isXeno, xenoSenses: xenoSenses, sightRange: sightRange, tribeSees: tribeSees, tribeSeers: tribeSeers, shieldFor: shieldFor, jammedNearby: jammedNearby, inspiringNearby: inspiringNearby, bondMorale: bondMorale, psychicBond: psychicBond, regainTargets: regainTargets, regainControl: regainControl, selfRepair: selfRepair, teleportFrom: teleportFrom, teleportPads: teleportPads, teleportRoll: teleportRoll, teleport: teleport, isMedic: isMedic, alienHull: alienHull,
    terrainAt: terrainAt, terrainOf: terrainOf, kindsUnder: kindsUnder, coverAt: coverAt, footprint: footprint, inRect: inRect, segRect: segRect,
    groundLevel: groundLevel, levelOf: levelOf,
    inPoly: inPoly, pieceDepth: pieceDepth, shapePiece: shapePiece, SHAPED: SHAPED, placePiece: placePiece, jumps: jumps, turnPiece: turnPiece, turnPoint: turnPoint,
    enterable: enterable, sectionsOf: sectionsOf, sectionRect: sectionRect, sectionHigh: sectionHigh, occupant: occupant,
    canGarrison: canGarrison, enterTargets: enterTargets, enterBuilding: enterBuilding, exitSpots: exitSpots,
    exitBuilding: exitBuilding, leaveAway: leaveAway, rectPointDist: rectPointDist, onHill: onHill, tooHighToHover: tooHighToHover,
    unitNear: unitNear, clampBoard: clampBoard, pointSegDist: pointSegDist,
    has: has, ruleValue: ruleValue, currentMorale: currentMorale, status: status,
    projects: projects, markCall: markCall, holdsGround: holdsGround, countsForVictory: countsForVictory,
    sizeBonus: sizeBonus, addSP: addSP, coverFor: coverFor, defenceAgainst: defenceAgainst,
    canShoot: canShoot, shoot: shoot, assault: assault, reachable: reachable, pathTo: pathTo,
    turnToll: turnToll, turnsTo: turnsTo, driveCost: driveCost,
    rally: rally, fallBack: fallBack, hackBurn: hackBurn, collars: collars, medicNearby: medicNearby,
    isMachine: isMachine, isFlying: isFlying, flyInf: flyInf, overmindFor: overmindFor, overmindReach: overmindReach, bugRanged: bugRanged, bugGround: bugGround, pheromoneBonus: pheromoneBonus, aggressiveNow: aggressiveNow, endlessTide: endlessTide, psychicWave: psychicWave, weaponStyle: weaponStyle, weaponSpec: weaponSpec, WEAPONS: WEAPONS, arcOf: arcOf, inFireArc: inFireArc,
    resolveDamage: resolveDamage, applyDamage: applyDamage, repair: repair,
    canAssault: canAssault, chargeReach: chargeReach, chargeRoute: chargeRoute, canEmbark: canEmbark, embark: embark, disembark: disembark,
    terrainCost: terrainCost, terrainBars: terrainBars,
    canHack: canHack, hack: hack, commandAboard: commandAboard,
    steadyShooter: steadyShooter, steadyTargets: steadyTargets, steadyFire: steadyFire,
    hasExact: hasExact, antiTank: antiTank,
    campFlag: campFlag, doctrine: doctrine, unitDoc: unitDoc, credit: credit,
    isDestructible: isDestructible, destructibleKind: destructibleKind, shelterOf: shelterOf,
    canDemolish: canDemolish, canCharge: canCharge, destroyTerrain: destroyTerrain, chargeBonus: chargeBonus,
    shootTerrain: shootTerrain, assaultTerrain: assaultTerrain, detonate: detonate, crushOnMove: crushOnMove,
    canMartyr: canMartyr, resolveShootingHits: resolveShootingHits, resolveAssaultHits: resolveAssaultHits,
    applyDrone: applyDrone, canBeDrone: canBeDrone, MOUNTS: MOUNTS, MOUNT_ORDER: MOUNT_ORDER, canMount: canMount, mountOf: mountOf, applyMount: applyMount,
    shotMods: shotMods, shotOdds: shotOdds, assaultOdds: assaultOdds,
    PROPULSION: PROPULSION, PROP_ORDER: PROP_ORDER, splitPick: splitPick, joinPick: joinPick,
    propsFor: propsFor, propOf: propOf, applyPropulsion: applyPropulsion, drives: drives,
    defaultDrive: defaultDrive, lookDrive: lookDrive, DEFAULT_DRIVE: DEFAULT_DRIVE,
    soldierName: soldierName, rankFor: rankFor, crewed: crewed, musterMen: musterMen, syncMen: syncMen, counted: counted, survivors: survivors, biomassOf: biomassOf
  };
})(window);
