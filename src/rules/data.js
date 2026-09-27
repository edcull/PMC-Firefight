/* PMC 2670 — Firefight : the tables — every unit a force can field and what
   each one shoots with, as the book gives them. Nothing here does anything;
   rules.js reads them. */
(function (root) {
  'use strict';

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
    { key: 'impsupport', code: 'ISV', name: 'Improvised support vehicle', group: 'Support vehicles', cls: 'vehicle', art: 'techmrl', tier: 2, size: 1, move: 8, turn: 2, fp: 6, range: 30, def: 8, assault: 1, str: 3, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },
    { key: 'lsupport', code: 'LSV', name: 'Light support vehicle', group: 'Support vehicles', cls: 'vehicle', art: 'calliope', tier: 3, size: 1, move: 8, turn: 2, fp: 8, range: 48, def: 10, assault: 2, str: 4, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },
    { key: 'msupport', code: 'MSV', name: 'Medium support vehicle', group: 'Support vehicles', cls: 'vehicle', art: 'mlrs', tier: 4, size: 1, move: 6, turn: 2, fp: 9, range: 48, def: 11, assault: 3, str: 4, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },
    { key: 'lengveh', code: 'LEV', name: 'Light engineering vehicle', group: 'Engineering and utility vehicles', cls: 'vehicle', art: 'engflame', tier: 3, size: 1, move: 10, turn: 1, fp: 8, range: 12, def: 13, assault: 5, str: 5, rules: ['Ground vehicle', 'Specialisation (ground)', 'Incendiary Ammunition', 'Suppressive Fire', 'Always Basic Firepower'], cap: 1 },
    { key: 'aaveh', code: 'AAV', name: 'Anti-aircraft vehicle', group: 'Engineering and utility vehicles', cls: 'vehicle', art: 'aatank', tier: 3, size: 1, move: 8, turn: 2, fp: 6, range: 48, def: 10, assault: 3, str: 4, rules: ['Ground vehicle', 'Indirect Fire', 'Specialisation (air)', 'Anti-aircraft'], capPL: 1 },
    { key: 'ewveh', code: 'EWV', name: 'EW vehicle', group: 'Engineering and utility vehicles', cls: 'vehicle', art: 'ewtank', tier: 3, size: 1, move: 10, turn: 1, fp: 3, range: 18, def: 12, assault: 2, str: 5, rules: ['Ground vehicle', 'Jammers', 'Counter-jamming', 'Hackers', 'Keen-Eyed'], cap: 1 },
    { key: 'medveh', code: 'MDV', name: 'Medical vehicle', group: 'Engineering and utility vehicles', cls: 'vehicle', art: 'medbox', tier: 3, size: 1, move: 10, turn: 1, fp: 3, range: 18, def: 12, assault: 2, str: 5, rules: ['Ground vehicle', 'Field Medics'] },
    { key: 'hengveh', code: 'HEV', name: 'Heavy engineering vehicle', group: 'Engineering and utility vehicles', cls: 'vehicle', art: 'enghow', tier: 4, size: 1, move: 6, turn: 2, fp: 10, range: 12, def: 15, assault: 5, str: 8, rules: ['Ground vehicle', 'Destructive Weapon', 'Specialisation (ground)', 'Advanced Protection'] },
    { key: 'asupport', code: 'ASV', name: 'Advanced support vehicle', group: 'Engineering and utility vehicles', cls: 'vehicle', art: 'plasmatank', tier: 5, size: 1, move: 6, turn: 2, fp: 10, range: 60, def: 11, assault: 4, str: 5, rules: ['Ground vehicle', 'Minimum Range (12)', 'Destructive Weapon', 'Indirect Fire', 'Specialisation (ground)', 'Cumbersome Weapon'] },

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
       plasmabolt a big blue bolt of plasma, flat and fast, landing in the same
               splash of blue fire (the heavy engineering vehicle's breaching gun)
       none    it has no gun at all */
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
    // engineering hulls: a flame projector over a gun, and a plasma breaching cannon
    lengveh: { p: 'flame', s: 'chain' },
    hengveh: { p: 'plasmabolt' },
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

  root.PMCData = { CATALOGUE: CATALOGUE, WEAPONS: WEAPONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCData;
})(typeof window !== 'undefined' ? window : global);
