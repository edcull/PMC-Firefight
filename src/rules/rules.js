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
    { key: 'lmgsection', code: 'LMS', name: 'Light MG section', group: 'Light support', art: 'mg', tier: 2, size: 3, move: 4, fp: 5, range: 24, def: 8, assault: 1, morale: 3, rules: [] },
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
    { key: 'adaptedcraft', code: 'ATC', name: 'Adapted transport craft', group: 'Transport aircraft', cls: 'aircraft', art: 'hawk', tier: 2, size: 1, move: 16, fp: 2, range: 18, def: 8, assault: 1, str: 3, transport: 1, rules: ['Flying unit', 'Transport (1)', 'Limited Fire Arc'] },
    { key: 'lightcraft', code: 'LTC', name: 'Light transport craft', group: 'Transport aircraft', cls: 'aircraft', art: 'hawk', tier: 3, size: 1, move: 20, fp: 2, range: 18, def: 11, assault: 1, str: 4, transport: 1, rules: ['Flying unit', 'Transport (1)', 'Limited Fire Arc'] },
    { key: 'heavycraft', code: 'HTC', name: 'Heavy transport craft', group: 'Transport aircraft', cls: 'aircraft', art: 'chinook', tier: 4, size: 1, move: 18, fp: 2, range: 18, def: 12, assault: 1, str: 5, transport: 2, rules: ['Flying unit', 'Transport (2)', 'Limited Fire Arc'] },
    { key: 'flyingcp', code: 'FCP', name: 'Flying command post', group: 'Transport aircraft', cls: 'aircraft', art: 'chinookcp', tier: 5, size: 1, move: 24, fp: 2, range: 18, def: 13, assault: 1, str: 6, transport: 1, rules: ['Flying unit', 'Transport (1)', 'Limited Fire Arc', 'Command Vehicle'] },

    /* ---- Strike aircraft (pp. 81-82) ---- */
    { key: 'fsc', code: 'FSC', name: 'Flexible Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'apache', tier: 3, size: 1, move: 24, fp: 7, range: 18, def: 12, assault: 1, str: 4, rules: ['Flying unit', 'Limited Fire Arc'] },
    { key: 'tsc', code: 'TSC', name: 'Transport-Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'hind', tier: 4, size: 1, move: 20, fp: 6, range: 18, def: 12, assault: 1, str: 4, transport: 1, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (1)', 'Supporting Fire'] },
    { key: 'gunboat', code: 'GNB', name: 'Gunboat', group: 'Strike aircraft', cls: 'aircraft', art: 'apacherk', tier: 4, size: 1, move: 12, fp: 9, range: 18, def: 13, assault: 1, str: 5, rules: ['Flying unit', 'Incendiary Ammunition'], cap: 1 },
    { key: 'hsc', code: 'HSC', name: 'Heavy Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'hindrk', tier: 5, size: 1, move: 16, fp: 9, range: 18, def: 13, assault: 1, str: 5, rules: ['Flying unit', 'Limited Fire Arc', 'Anti-tank'] },
    { key: 'interceptor', code: 'INT', name: 'Interceptor', group: 'Strike aircraft', cls: 'aircraft', art: 'jet', tier: 4, size: 1, move: 28, fp: 6, range: 24, def: 11, assault: 1, str: 3, rules: ['Flying unit', 'Limited Fire Arc', 'Anti-aircraft'] },
    { key: 'asc', code: 'ASC', name: 'Advanced Strike Craft', group: 'Strike aircraft', cls: 'aircraft', art: 'jetstrike', tier: 5, size: 1, move: 24, fp: 9, range: 18, def: 13, assault: 1, str: 4, rules: ['Flying unit', 'Limited Fire Arc'] },

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
    { key: 'rlflak', code: 'LFV', name: 'Light FlaK vehicle', group: 'Rebel flak vehicles', faction: 'rebel', cls: 'vehicle', art: 'aatech', tier: 2, size: 1, move: 10, turn: 2, fp: 3, range: 18, def: 9, assault: 2, str: 4, rules: ['Ground vehicle', 'Anti-aircraft'], capPL: 1 },
    { key: 'rmflak', code: 'MFV', name: 'Medium FlaK vehicle', group: 'Rebel flak vehicles', faction: 'rebel', cls: 'vehicle', art: 'aacar', tier: 3, size: 1, move: 8, turn: 2, fp: 4, range: 24, def: 11, assault: 2, str: 6, rules: ['Ground vehicle', 'Anti-aircraft', 'Suppressive Fire'], capPL: 1 },
    { key: 'rhflak', code: 'HFV', name: 'Heavy FlaK vehicle', group: 'Rebel flak vehicles', faction: 'rebel', cls: 'vehicle', art: 'aaheavy', tier: 4, size: 1, move: 6, turn: 2, fp: 5, range: 30, def: 12, assault: 2, str: 6, rules: ['Ground vehicle', 'Anti-aircraft', 'Anti-tank', 'Cumbersome Weapon'], capPL: 1 },

    /* Rebel aviation (p. 108) — civilian hulls pressed into service */
    { key: 'rpatrol', code: 'CPC', name: 'Captured patrol craft', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'hawk', tier: 2, size: 1, move: 18, fp: 3, range: 12, def: 9, assault: 1, str: 4, rules: ['Flying unit', 'Keen-Eyed', 'Smoke Markers'] },
    { key: 'rlshuttle', code: 'ALS', name: 'Armed light shuttle', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'apachenp', tier: 3, size: 1, move: 18, fp: 5, range: 18, def: 11, assault: 1, str: 6, transport: 1, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (1)'] },
    { key: 'rmshuttle', code: 'AMS', name: 'Armed medium shuttle', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'hindnp', tier: 4, size: 1, move: 18, fp: 5, range: 18, def: 11, assault: 1, str: 7, transport: 2, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (2)', 'Supporting Fire'] },
    { key: 'rhshuttle', code: 'AHS', name: 'Armed heavy shuttle', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'chinookwl', tier: 5, size: 1, move: 18, fp: 5, range: 18, def: 11, assault: 1, str: 8, transport: 4, rules: ['Flying unit', 'Limited Fire Arc', 'Transport (4)', 'Supporting Fire'] },
    { key: 'rlifter', code: 'LFT', name: 'Lifter', group: 'Rebel aviation', faction: 'rebel', cls: 'aircraft', art: 'chinook', tier: 3, size: 1, move: 16, fp: 0, range: 0, def: 10, assault: 1, str: 7, transport: 1, rules: ['Flying unit', 'Lifter', 'Unarmed'] },

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
    xeno: { key: 'xeno', name: 'Xenotripods', full: 'Xenotripod tribe', money: 'TerP', moneyLong: 'Territorial Points' }
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
      note: 'Legs: pays the infantry 1" for difficult ground and takes cover from terrain, and its armoured flanks deny the +1 side shot — but its height costs 1 Defence.'
    }
  };
  var PROP_ORDER = ['wheeled', 'tracked', 'grav', 'hover', 'walker'];

  /* "lcv:tracked", "lcv:tracked:drone" or "rfanatics:riders" -> { key, prop, drone, riders } */
  /* What a mounted unit rides (p. 93 says "bikes and beasts"): it changes the
     models on the table and nothing in the rules. */
  var MOUNTS = { bike: { name: 'Bike' }, gravbike: { name: 'Grav bike' }, horse: { name: 'Horse' } };
  var MOUNT_ORDER = ['bike', 'gravbike', 'horse'];
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
    if (prop && prop !== 'wheeled') out += ':' + prop;
    if (drone) out += ':drone';
    if (riders) out += ':riders';
    if (mount && mount !== 'bike') out += ':' + mount;
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
  function canBeDrone(p) {
    return !!p && p.cls === 'vehicle' && !p.transport && !alienHull(p);
  }
  // which propulsions a profile may take: ground vehicles only
  function propsFor(p) { return p && p.cls === 'vehicle' && !alienHull(p) ? PROP_ORDER : []; }
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
  function defaultDrive(p) {
    if (!p || p.cls !== 'vehicle' || alienHull(p)) return null;
    return DEFAULT_DRIVE[p.key] || 'wheeled';
  }
  function propOf(u) { return PROPULSION[u && u.prop] || null; }

  /* Fold a propulsion into a freshly built machine. Movement is kept exact rather
     than rounded, since the table is measured in real inches. */
  /* Drone Control (p. 37): no crew to lose, so one more Structure point — but a
     Hacker can reach into it. */
  function applyDrone(u, on) {
    if (!on || u.cls !== 'vehicle' || u.transport) { u.drone = false; return u; }
    u.drone = true;
    u.str += 1;
    if (u.rules.indexOf('Drone Control') < 0) u.rules = u.rules.concat(['Drone Control']);
    return u;
  }

  function applyPropulsion(u, prop) {
    // a giant bug or a Xenotripod hull goes on its own legs and fields: no drive at all
    if (alienHull(u)) { u.prop = null; return u; }
    var pr = PROPULSION[prop];
    if (!pr || u.cls !== 'vehicle') { u.prop = u.cls === 'vehicle' ? 'wheeled' : null; return u; }
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
    var budget = comp.points * pl, freeTier = battleTier - 1, freeUsed = 0;
    /* Human Wave Attacks: two extra infantry units of the Battle Tier per Priority
       Level, over and above the points. They come off the bill the way Strength in
       Numbers does, but they are the Battle Tier's own units rather than a Tier below. */
    if (tactic === 'wave') {
      var waveInf = 0;
      keys.forEach(function (k) {
        var p = BY_KEY[k];
        if (p && p.cls === 'infantry' && p.tier === battleTier) waveInf++;
      });
      var waveFree = Math.min(2 * pl, waveInf);
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
    for (var t = 1; t <= 5; t++) {
      var lim = comp.limits[t - 1], lo = lim[0] * pl, hi = lim[1] === 99 ? 99 : lim[1] * pl;
      if (doc('O2') && t === battleTier) lo = Math.ceil(lo / 2);
      if (doc('O5') && t === freeTier && hi !== 99) hi += pl;
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
      else if (p.cls === 'infantry' && !p.command &&
        (p.rules || []).indexOf('Cumbersome Weapons') < 0) riders++;
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
      else if (p.cls === 'infantry' && !p.command &&
        (p.rules || []).indexOf('Cumbersome Weapons') < 0) riders++;
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
    var reach = u.tactic === 'wave' ? 18 : 12;
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (!o.alive || o.aboard || o.side !== u.side || o === u) continue;
      if (!hasOwn(o, 'Death or Glory, Comrades!')) continue;
      if (status(o) === 'broken') continue;
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
    // the Demolish scenario's target: impassable, and only the Demolish action
    // touches it — a Sapper charge at +4, anyone else's at +2 (p. 54)
    objective: { name: 'The objective', blocks: false, impassable: true, movePenalty: 0, cover: 0, fp: 0, destructible: 'target' },
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

  /* ---------- geometry ---------- */
  function centreDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  /* Closest models. A unit inside a building is measured from the building's
     wall, both when it shoots and when it is shot at or charged (p. 41). */
  function unitDist(a, b) {
    var ra = a && a.bld ? sectionRect(a) : null, rb = b && b.bld ? sectionRect(b) : null;
    if (!ra && !rb) return Math.max(0, centreDist(a, b) - 2 * UNIT_R);
    if (ra && rb) return ra === rb ? 0 : rectRectDist(ra, rb);
    if (ra) return Math.max(0, rectPointDist(ra, b.x, b.y) - UNIT_R);
    return Math.max(0, rectPointDist(rb, a.x, a.y) - UNIT_R);
  }
  function rectPointDist(q, x, y) {
    var dx = Math.max(q.x - x, 0, x - (q.x + q.w)), dy = Math.max(q.y - y, 0, y - (q.y + q.h));
    return Math.hypot(dx, dy);
  }
  function rectRectDist(a, b) {
    var dx = Math.max(a.x - (b.x + b.w), 0, b.x - (a.x + a.w)), dy = Math.max(a.y - (b.y + b.h), 0, b.y - (a.y + a.h));
    return Math.hypot(dx, dy);
  }

  /* ---------- buildings (p. 41) ---------- */
  function enterable(r) { return !!(r && TERRAIN[r.kind] && TERRAIN[r.kind].enterable && !r.wrecked); }
  // the sections of a building: its wings, or the whole of a single block
  function sectionsOf(r) { return r.parts && r.parts.length ? r.parts : [r]; }
  function sectionRect(u) {
    if (!u || !u.bld) return null;
    var ss = sectionsOf(u.bld);
    return ss[u.sec || 0] || ss[0];
  }
  /* A section is a high building if it stands tall: a tower, or a full-height
     wing of a building of any size. Only a high building gives Firepower. */
  function sectionHigh(r, q) {
    if (!r) return false;
    if (r.kind === 'bunker') return true;
    q = q || r;
    var hf = q.hf || 1;
    return hf >= 1.3 || (hf >= 1 && Math.max(r.w, r.h) >= 6.5);
  }
  function occupant(state, r, sec) {
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i];
      if (u.alive && !u.aboard && u.bld === r && (u.sec || 0) === (sec || 0)) return u;
    }
    return null;
  }
  function canGarrison(u) {
    return !!u && u.alive && !u.aboard && u.x >= 0 && u.cls === 'infantry' && !hasOwn(u, 'Riders') &&
      !isFlying(u) && !hasOwn(u, 'Stationary Artillery') && !hasOwn(u, 'Immobile');
  }
  /* Where this unit could go in: any empty section within 4" of it, or — from
     inside a building of several sections — an empty section in contact with
     its own (p. 41, Huge buildings). */
  function enterTargets(state, u) {
    if (!canGarrison(u) || status(u) === 'broken') return [];
    var out = [];
    state.terrain.forEach(function (r) {
      if (!enterable(r)) return;
      sectionsOf(r).forEach(function (q, i) {
        if (occupant(state, r, i)) return;
        if (u.bld) {
          if (u.bld !== r || (u.sec || 0) === i) return;
          if (rectRectDist(q, sectionRect(u)) > 0.6) return;
        } else if (rectPointDist(q, u.x, u.y) - UNIT_R > 4) return;
        out.push({ piece: r, sec: i, rect: q, move: !!u.bld });
      });
    });
    return out;
  }
  function enterBuilding(state, u, r, sec) {
    var q = sectionsOf(r)[sec || 0];
    u.bld = r; u.sec = sec || 0;
    u.x = q.x + q.w / 2; u.y = q.y + q.h / 2;
    return q;
  }
  /* Where a unit coming out may be put: within 4" of the wall, on ground it
     can stand on, clear of every other unit. */
  function exitSpots(state, u) {
    var q = sectionRect(u);
    if (!q) return [];
    var out = [];
    for (var x = Math.floor(q.x - 5); x <= q.x + q.w + 5; x += STEP) {
      for (var y = Math.floor(q.y - 5); y <= q.y + q.h + 5; y += STEP) {
        if (x < UNIT_R || y < UNIT_R || x > BOARD.w - UNIT_R || y > BOARD.h - UNIT_R) continue;
        var d = rectPointDist(q, x, y);
        if (d < UNIT_R || d > 4) continue;
        if (TERRAIN[terrainAt(state, x, y)].impassable) continue;
        if (unitNear(state, x, y, u, 1)) continue;
        out.push({ x: x, y: y, cost: d, spent: d, turns: 0 });
      }
    }
    return out;
  }
  function exitBuilding(state, u, p) {
    u.bld = null; u.sec = null;
    if (p) { u.x = p.x; u.y = p.y; }
  }
  // out through the wall facing away from `from`, as the garrison of a lost building does
  function leaveAway(state, u, from) {
    var spots = exitSpots(state, u);
    var q = sectionRect(u);
    exitBuilding(state, u, null);
    if (!spots.length) { var p0 = nearestClear(state, u, q); u.x = p0.x; u.y = p0.y; return; }
    var best = spots.sort(function (a, b) {
      return (inches(b.x, b.y, from.x, from.y) - b.cost * 0.5) - (inches(a.x, a.y, from.x, from.y) - a.cost * 0.5);
    })[0];
    u.x = best.x; u.y = best.y;
  }
  function inches(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  /* A terrain piece is its bounding rectangle, and — for the natural pieces —
     an irregular outline inside it (`r.poly`, a list of [x, y] points). Every
     rule asks the same two questions of a piece: is this point in it, and does
     this line cross it. With an outline, the answer is the outline's: a unit
     standing in the rectangle's corner but outside the trees is in the open. */
  function inRect(x, y, r) {
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return false;
    if (r.parts) {                                 // a building of several wings
      for (var i = 0; i < r.parts.length; i++) {
        var q = r.parts[i];
        if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return true;
      }
      return false;
    }
    return r.poly ? inPoly(x, y, r.poly) : true;
  }
  function inPoly(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
    var d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    var d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    var d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    var d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function segPoly(x1, y1, x2, y2, pts) {
    if (inPoly(x1, y1, pts) || inPoly(x2, y2, pts)) return true;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if (segsCross(x1, y1, x2, y2, pts[j][0], pts[j][1], pts[i][0], pts[i][1])) return true;
    }
    return false;
  }
  /* How far inside a piece a point is, in inches — negative outside. The ground
     painter uses it to lay a piece's floor exactly where the rules have it. */
  function pieceDepth(r, x, y) {
    if (r.parts) {
      var bd = -Infinity;
      r.parts.forEach(function (q) { bd = Math.max(bd, Math.min(x - q.x, q.x + q.w - x, y - q.y, q.y + q.h - y)); });
      return bd;
    }
    if (!r.poly) return Math.min(x - r.x, r.x + r.w - x, y - r.y, r.y + r.h - y);
    var pts = r.poly, best = Infinity;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      best = Math.min(best, pointSegDist(x, y, pts[j][0], pts[j][1], pts[i][0], pts[i][1]));
    }
    return inPoly(x, y, pts) ? best : -best;
  }
  /* Move or resize a piece, taking its outline with it: the outline is stretched
     from the old rectangle onto the new one. Anything that shifts a piece after
     it is laid must go through here, or the drawn shape and the rules part ways. */
  function placePiece(t, x, y, w, h) {
    if (w == null) w = t.w;
    if (h == null) h = t.h;
    var ox = t.x, oy = t.y, ow = t.w || 1, oh = t.h || 1;
    if (t.poly) {
      t.poly = t.poly.map(function (q) { return [x + (q[0] - ox) / ow * w, y + (q[1] - oy) / oh * h]; });
    }
    if (t.top) {
      t.top = t.top.map(function (q) { return [x + (q[0] - ox) / ow * w, y + (q[1] - oy) / oh * h]; });
    }
    if (t.parts) {
      t.parts = t.parts.map(function (q) {
        var o = {}; for (var k in q) o[k] = q[k];
        o.x = x + (q.x - ox) / ow * w; o.y = y + (q.y - oy) / oh * h; o.w = q.w / ow * w; o.h = q.h / oh * h;
        return o;
      });
    }
    t.x = x; t.y = y; t.w = w; t.h = h;
    return t;
  }
  /* Turn the whole table a number of quarter turns about its centre. One
     quarter turn carries the north edge to the west, the east to the north:
     (x, y) -> (y, W - x). The table is square, so it still fits itself. */
  function turnPoint(x, y, k) {
    k = ((k % 4) + 4) % 4;
    for (var i = 0; i < k; i++) { var t = x; x = y; y = BOARD.w - t; }
    return [x, y];
  }
  function turnRect(q, k) {
    var a = turnPoint(q.x, q.y, k), b = turnPoint(q.x + q.w, q.y + q.h, k);
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
  }
  function turnPiece(t, k) {
    if (!(((k % 4) + 4) % 4)) return t;
    var pts = function (list) { return list.map(function (q) { return turnPoint(q[0], q[1], k); }); };
    if (t.poly) t.poly = pts(t.poly);
    if (t.top) t.top = pts(t.top);
    if (t.parts) t.parts = t.parts.map(function (q) {
      var o = {}, r = turnRect(q, k); for (var key in q) o[key] = q[key];
      o.x = r.x; o.y = r.y; o.w = r.w; o.h = r.h; return o;
    });
    var r2 = turnRect(t, k);
    t.x = r2.x; t.y = r2.y; t.w = r2.w; t.h = r2.h;
    return t;
  }
  // the pieces that come in natural outlines; built things stay square
  var SHAPED = { woods: 1, crater: 1, rocks: 1, water: 1, deep: 1, lava: 1, hill: 1 };
  /* The families of outline each kind is drawn from:
       blob   — a lumpy round-cornered patch
       lobed  — two to four lobes, like a copse grown together or a clover of pools
       kidney — a patch with a bay bitten out of one side
       long   — a band laid diagonally across its ground: a lava flow, a creek, a strip of wood
       rift   — ground torn open: a jagged, splintered hole (longrift: a fissure) */
  var FAMILIES = {
    woods: ['blob', 'lobed', 'lobed', 'kidney', 'long'],
    crater: ['blob', 'lobed', 'long'],
    rocks: ['blob', 'lobed'],
    water: ['blob', 'kidney', 'kidney', 'long', 'lobed'],
    deep: ['blob', 'kidney', 'long', 'lobed'],
    lava: ['rift', 'rift', 'longrift', 'longrift', 'rift'],
    hill: ['blob', 'blob', 'lobed', 'kidney']
  };
  /* Every outline is star-shaped about its centre — one radius per direction —
     so it can never cross itself, and it is then stretched to fill its piece's
     rectangle, so the rectangle stays an honest bounding box. */
  /* A building's floor plan: one block, or wings joined into an L, a T, a U
     round a yard, or a main hall with a lower annex or a tower. The wings are
     rectangles that share edges and never overlap; together they are the
     building — cover, sight, all of it — and the ground between them is open. */
  var PLANS = ['block', 'L', 'L', 'T', 'U', 'annex', 'tower'];
  function planBuilding(r, rand, plan) {
    if (r.parts || r.w < 4 || r.h < 4) return r;
    plan = plan || PLANS[Math.floor(rand() * PLANS.length)];
    var x = r.x, y = r.y, w = r.w, h = r.h, parts;
    function P(px, py, pw, ph, hf) { return { x: px, y: py, w: pw, h: ph, hf: hf || 1 }; }
    var fx = rand() < 0.5, fy = rand() < 0.5, swap = rand() < 0.5 && plan !== 'block';
    // plans are laid out along u (across) and v (down), then flipped and turned into place
    var U = swap ? h : w, V = swap ? w : h;
    var cu = U * (0.4 + rand() * 0.15), cv = V * (0.4 + rand() * 0.15);
    switch (plan) {
      case 'L': parts = [P(0, 0, U, V - cv), P(0, V - cv, U - cu, cv)]; break;
      case 'T': {
        var sw = U * (0.36 + rand() * 0.12), so = (U - sw) / 2 + (rand() - 0.5) * U * 0.15;
        parts = [P(0, 0, U, V - cv), P(so, V - cv, sw, cv, 0.8)];
        break;
      }
      case 'U': {
        var lw = U * (0.28 + rand() * 0.06);
        parts = [P(0, 0, U, V * 0.42), P(0, V * 0.42, lw, V * 0.58, 0.85), P(U - lw, V * 0.42, lw, V * 0.58, 0.85)];
        break;
      }
      case 'annex': {
        var mw = U * (0.55 + rand() * 0.15), ah = V * (0.55 + rand() * 0.2), ay = (V - ah) * rand();
        parts = [P(0, 0, mw, V), P(mw, ay, U - mw, ah, 0.6)];
        break;
      }
      case 'tower': {
        var tw = U * (0.35 + rand() * 0.1), th = V * (0.4 + rand() * 0.15);
        parts = [P(0, 0, U - tw, V, 0.8), P(U - tw, 0, tw, th, 1.45), P(U - tw, th, tw, V - th, 0.8)];
        break;
      }
      default: parts = [P(0, 0, U, V)];
    }
    r.parts = parts.map(function (q) {
      var qu = fx ? U - q.x - q.w : q.x, qv = fy ? V - q.y - q.h : q.y;
      return swap ? P(x + qv, y + qu, q.h, q.w, q.hf) : P(x + qu, y + qv, q.w, q.h, q.hf);
    });
    r.plan = plan;
    return r;
  }
  function shapePiece(r, rand, family) {
    if (r.kind === 'building') return planBuilding(r, rand || Math.random, family);
    if (!SHAPED[r.kind] || r.poly || r.w < 2 || r.h < 2) return r;
    rand = rand || Math.random;
    var fams = FAMILIES[r.kind] || ['blob'];
    var fam = family || fams[Math.floor(rand() * fams.length)];
    if (fam === 'long' && Math.min(r.w, r.h) < 3) fam = 'blob';
    if (fam === 'longrift' && Math.min(r.w, r.h) < 3) fam = 'rift';
    var rift = fam === 'rift' || fam === 'longrift';
    if (rift) n = 26;
    var n = 40, TAU = Math.PI * 2;
    var ex = 0.5 + rand() * 0.45;                 // 0.5: nearly square, 1: an ellipse
    var h = [], k2;
    for (k2 = 0; k2 < 4; k2++) h.push({ m: [2, 3, 5, 7][k2], a: [0.12, 0.08, 0.05, 0.025][k2] * (0.5 + rand()), ph: rand() * TAU });
    var lobes = 2 + Math.floor(rand() * 3), lobeA = 0.16 + rand() * 0.16, lobePh = rand() * TAU;
    // a hill is one rise of ground: gentle lobes, no starfish
    if (r.kind === 'hill') { lobes = 2 + Math.floor(rand() * 2); lobeA *= 0.55; h.forEach(function (q) { q.a *= 0.7; }); }
    var bayAt = rand() * TAU, bayD = 0.32 + rand() * 0.2, baySig = 0.45 + rand() * 0.25;
    var asp = 2.2 + rand() * 1.4, rot = (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.55);
    var raw = [];
    for (var i = 0; i < n; i++) {
      var t = i / n * TAU, c = Math.cos(t), sn = Math.sin(t);
      var rad = 1;
      for (k2 = 0; k2 < h.length; k2++) rad += h[k2].a * Math.sin(h[k2].m * t + h[k2].ph);
      rad += (rand() - 0.5) * 0.06;
      if (fam === 'lobed') rad += lobeA * Math.cos(lobes * t + lobePh);
      if (fam === 'kidney') {
        var dd = Math.atan2(Math.sin(t - bayAt), Math.cos(t - bayAt));
        rad *= 1 - bayD * Math.exp(-dd * dd / (2 * baySig * baySig));
      }
      if (rift) {
        // splintered: a torn edge of points and notches, no two alike
        rad = 0.84 + (rand() - 0.5) * 0.16;
        if (i % 4 === 0 && rand() < 0.7) rad += 0.1 + rand() * 0.12;     // a splinter of the break
        else if (rand() < 0.25) rad -= 0.1 + rand() * 0.1;               // a notch
      }
      rad = Math.max(0.35, rad);
      var sx = (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), ex), sy = (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), ex);
      var x = sx * rad, y = sy * rad;
      if (fam === 'long' || fam === 'longrift') {
        x *= fam === 'longrift' ? asp * 1.25 : asp;
        var cr = Math.cos(rot), sr = Math.sin(rot), x2 = x * cr - y * sr, y2 = x * sr + y * cr;
        x = x2; y = y2;
      }
      raw.push([x, y]);
    }
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    raw.forEach(function (q) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); });
    r.poly = raw.map(function (q) {
      return [r.x + (q[0] - minX) / (maxX - minX) * r.w, r.y + (q[1] - minY) / (maxY - minY) * r.h];
    });
    r.shape = fam;
    /* a big hill may rise in two steps: a second, smaller rise on its top,
       the same outline drawn in towards the middle */
    if (r.kind === 'hill' && r.w >= 7 && r.h >= 6 && rand() < 0.5) {
      var cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2, k0 = 0.45 + rand() * 0.15;
      var sx0 = (rand() - 0.5) * r.w * 0.12, sy0 = (rand() - 0.5) * r.h * 0.12;
      var top = r.poly.map(function (q) {
        var kk = k0 * (0.92 + rand() * 0.12);
        return [cx0 + sx0 + (q[0] - cx0) * kk, cy0 + sy0 + (q[1] - cy0) * kk];
      });
      // keep it well inside the lower step
      var inside = top.every(function (q) { return inPoly(q[0], q[1], r.poly) && pieceDepth({ poly: r.poly, x: r.x, y: r.y, w: r.w, h: r.h }, q[0], q[1]) > 0.8; });
      if (inside) r.top = top;
    }
    return r;
  }

  function regionsAt(state, x, y) {
    var out = [];
    for (var i = 0; i < state.terrain.length; i++) if (inRect(x, y, state.terrain[i])) out.push(state.terrain[i]);
    return out;
  }
  // "One foot in the grave" — the most significant piece applies
  function rank(k) {
    var t = TERRAIN[k];
    return t.impassable ? 5 : t.blocks ? 4 : t.cover ? 3 : t.fp ? 2 : (t.movePenalty || t.wire) ? 1 : 0;
  }
  function terrainAt(state, x, y) {
    var rs = regionsAt(state, x, y), best = 'open';
    for (var i = 0; i < rs.length; i++) if (rank(rs[i].kind) > rank(best)) best = rs[i].kind;
    return best;
  }
  function terrainOf(state, u) { return terrainAt(state, u.x, u.y); }

  // segment vs a piece: its rectangle (Liang-Barsky), then its outline if it has one
  function segRect(x1, y1, x2, y2, r) {
    if (!segBox(x1, y1, x2, y2, r)) return false;
    if (r.parts) return r.parts.some(function (q) { return segBox(x1, y1, x2, y2, q); });
    return r.poly ? segPoly(x1, y1, x2, y2, r.poly) : true;
  }
  function segBox(x1, y1, x2, y2, r) {
    var t0 = 0, t1 = 1, dx = x2 - x1, dy = y2 - y1;
    var p = [-dx, dx, -dy, dy];
    var q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        var t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  }

  function pointSegDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // Line of sight, centre to centre. Blocked by LoS-blocking terrain (unless the unit is
  // standing in it — you can see in and out) and by intervening units.
  function hasLoS(state, a, b) {
    if (centreDist(a, b) > sightRange(a)) return false;
    return lineClear(state, a, b);
  }
  // the line itself, however far: terrain that blocks and units standing in the way
  function lineClear(state, a, b) {
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i], t = TERRAIN[r.kind];
      if (!t.blocks && !t.hill) continue;
      var aIn = inRect(a.x, a.y, r), bIn = inRect(b.x, b.y, r);
      /* A hill that rises in two steps: the upper step is a hill standing on a
         hill, and it blocks sight across it the same way — for everyone but a
         unit up on it. Two squads on the lower slope, with the crown between
         them, do not see each other; nor does one on the slope see past the
         crown to the ground beyond. */
      if (t.hill && r.top) {
        var aTop = aIn && inPoly(a.x, a.y, r.top), bTop = bIn && inPoly(b.x, b.y, r.top);
        if (!aTop && !bTop && segRect(a.x, a.y, b.x, b.y, upperStep(r))) return false;
      }
      // a hill blocks sight across it, but not for a unit standing on it (p. 42)
      if (aIn || bIn) continue;
      if (segRect(a.x, a.y, b.x, b.y, r)) return false;
    }
    /* "Units on hills can shoot/be shot at over friendly units below them (but
       not over enemy ones)" — the friends of whichever end is up on the hill,
       taken a step at a time: from the crown, over friends on the slope below
       it as well as on the level ground. */
    var aLv = a.side ? levelOf(state, a) : 0, bLv = b.side ? levelOf(state, b) : 0;
    for (var j = 0; j < state.units.length; j++) {
      var u = state.units[j];
      if (!u.alive || u === a || u === b || u.aboard || u.x < 0) continue;
      if (pointSegDist(u.x, u.y, a.x, a.y, b.x, b.y) >= UNIT_R * 0.9) continue;
      if ((aLv && u.side === a.side) || (bLv && u.side === b.side)) {
        var uLv = levelOf(state, u);
        if ((u.side === a.side && aLv > uLv) || (u.side === b.side && bLv > uLv)) continue;
      }
      return false;
    }
    return true;
  }

  /* How high a point stands: level ground (0), a hill (1), or the upper step
     of a hill that rises in two (2). */
  function groundLevel(state, x, y) {
    var lv = 0;
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i];
      if (r.kind !== 'hill' || !inRect(x, y, r)) continue;
      lv = Math.max(lv, r.top && inPoly(x, y, r.top) ? 2 : 1);
    }
    return lv;
  }
  function levelOf(state, u) { return u && u.x >= 0 ? groundLevel(state, u.x, u.y) : 0; }
  // the upper step of a stepped hill, as a piece of its own for sight lines
  function upperStep(r) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    r.top.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, poly: r.top };
  }
  function onHill(state, p) { return !!p && p.x >= 0 && terrainAt(state, p.x, p.y) === 'hill'; }

  function unitNear(state, x, y, ignore, pad) {
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i];
      if (!u.alive || u === ignore) continue;
      if (Math.hypot(u.x - x, u.y - y) < 2 * UNIT_R + (pad || 0)) return u;
    }
    return null;
  }

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
    observers: { p: 'shell', s: 'pistol' }, sharpshooters: { p: 'shell', s: 'pistol' },
    lrrp: { p: 'rail', n: 2 },
    // the sniper team: a pair of heavy rounds, then a pair of Gauss lines
    snipers: { p: 'shell', n: 2, s: 'rail', sn: 2 },
    lmgsection: { p: 'smg', s: 'burst' },
    // the MG team has a carbine in the section alongside the gun
    lmgteam: { p: 'smg', s: 'burst' },
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
    // the flexible strike craft carries a rocket rack over the door gun
    fsc: { p: 'small', s: 'rocket' }, tsc: { p: 'burst', s: 'rocket' },
    gunboat: { p: 'chain', s: 'rocket' }, hsc: { p: 'missile', n: 3, s: 'rocket' }, asc: { p: 'shellbig', n: 3, s: 'rail', sn: 3 },
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
    // insurgents with AA put a pair of missiles up, like the PMC SAM team
    raa: { p: 'missile', n: 2 },
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
    var a = Math.atan2(shooter.y - target.y, shooter.x - target.x) - target.facing;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    var d = Math.abs(a);
    if (d <= Math.PI / 4) return 'front';
    if (d <= Math.PI * 3 / 4) return 'side';
    return 'rear';
  }
  // Limited Fire Arc: the target has to sit in the shooter's front quarter.
  function inFireArc(shooter, target) {
    if (shooter.facing == null) return true;
    var a = Math.atan2(target.y - shooter.y, target.x - shooter.x) - shooter.facing;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return Math.abs(a) <= Math.PI / 4;
  }
  function sizeBonus(models) {
    if (models >= 7) return 3;
    if (models >= 5) return 2;
    if (models >= 3) return 1;
    return 0;
  }
  function addSP(u, n) { u.sp = Math.min(12, u.sp + n); }
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
  function overmindFor(state, u, unsup) {
    if (!state || !u) return null;
    if (campFlag(u, 'deafSenses')) return null;             // Sensory Dysfunction
    var reach = overmindReach(state, u.side);
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o === u || o.side !== u.side || !onBoard(o) || !has(o, 'Overmind')) continue;
      if (o.tier < u.tier) continue;
      if (unsup && status(o) !== 'ready') continue;
      if (unitDist(o, u) <= reach) return o;
    }
    return null;
  }
  /* Pheromone Markers: +1 for each friendly marker unit within 18" of the
     target (24" with Strong Pheromones), up to +3, for Animal Behaviour bugs. */
  function pheromoneBonus(state, a, t) {
    if (!state || !has(a, 'Animal Behaviour') || campFlag(a, 'deafSenses')) return 0;
    var reach = doctrine(state, a.side, 'BC3') ? 24 : 18, n = 0;
    state.units.forEach(function (o) {
      if (o.side !== a.side || !onBoard(o) || !has(o, 'Pheromone Markers')) return;
      if (unitDist(o, t) <= reach) n += campFlag(o, 'intensePheromones') ? 2 : 1;
    });
    return Math.min(3, n);
  }
  // Aggressive: forced to charge the closest enemy — unless an Overmind holds it back
  function aggressiveNow(state, u) {
    if (!has(u, 'Aggressive') || isMachine(u)) return false;
    return !overmindFor(state, u, false);
  }
  /* Endless Tide, in the End phase: an unbroken unit near an unsuppressed
     Overmind digs D3 lost bugs back out of the ground. */
  function endlessTide(state) {
    var log = [];
    state.units.forEach(function (u) {
      if (!onBoard(u) || !has(u, 'Endless Tide') || status(u) === 'broken') return;
      var full = u.startSize || u.size;
      if (u.models >= full || !overmindFor(state, u, true)) return;
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
    var here = TERRAIN[terrainAt(state, target.x, target.y)].cover;
    /* Last Stand (p. 95): Rebel infantry holding ground that already shelters them
       dig in for +4 rather than the terrain's usual bonus. */
    if (here && target.tactic === 'laststand' && target.faction === 'rebel' && target.cls === 'infantry') {
      return { v: Math.max(here, 4), why: 'terrain cover — Last Stand' };
    }
    if (here) return { v: here, why: 'terrain cover' };
    if (!attacker) return { v: 0, why: '' };
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
      if (plunging) return { v: t.cover, why: 'low wall against plunging fire' };
      if (segRect(attacker.x, attacker.y, target.x, target.y, r)) return { v: t.cover, why: 'behind a low wall' };
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
      if (has(target, 'Stealth') && attacker && !has(attacker, 'Keen-Eyed')) {
        var st = Math.floor(unitDist(attacker, target) / 6);
        if (st > 0) { def += st; parts.push({ label: 'Stealth', v: st }); }
      }
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

  function projects(u) {
    return !!u.alive && !u.aboard && status(u) === 'ready';
  }

  /* ---------- hit tables ---------- */
  /* Psychic Support (p. 130) counts as Field Medics — to 12" with Mind
     Amplifiers (p. 142). */
  function isMedic(u) { return has(u, 'Field Medics') || has(u, 'Psychic Support'); }
  function medicReach(state, u) { return has(u, 'Psychic Support') && doctrine(state, u.side, 'XT5') ? 12 : 6; }
  // the unit treating a squad's wounded: itself if it is the medics, else the nearest in reach
  function medicFor(state, target) {
    // the medic team treats its own wounded whatever state it is in (p. 57)
    if (isMedic(target)) return target;
    var best = null, bd = Infinity;
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i], d;
      if (u.side === target.side && projects(u) && isMedic(u)
        && (d = unitDist(u, target)) <= medicReach(state, u) && d < bd) { best = u; bd = d; }
    }
    return best;
  }
  function medicNearby(state, target) { return !!medicFor(state, target); }

  function resolveShootingHits(state, target, hits, mod, atk) {
    var out = { casualties: 0, sp: 0, rolls: [], notes: [] };
    var medic = medicFor(state, target), medics = !!medic;
    var drugs = doctrine(state, target.side, 'T1');      // Combat Drugs
    var suicidal = campFlag(target, 'suicidal');         // Suicidal Tendencies
    for (var i = 0; i < hits; i++) {
      var raw = d6(), r = raw + mod, tag, down = false;
      if (suicidal) {
        // ignores hits on 1-2, but goes down on a 5-6
        if (r <= 2) tag = 'Steady, boys!';
        else if (r <= 4) { tag = 'Get down! (1 SP)'; out.sp += 1; }
        else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
      } else if (medics) {
        if (r <= 2) tag = 'Steady, boys!';
        else if (r <= 5) { tag = 'Get down! (1 SP)'; out.sp += 1; }
        else if (d6() === 6) { tag = 'MEDIC! casualty stabilised (1 SP)'; out.sp += 1; out.medic = medic.id; }
        else { tag = 'MEDIC! man down (1 SP)'; out.casualties += 1; out.sp += 1; out.medic = medic.id; }
      } else if (has(target, 'Animal Behaviour')) {
        // bugs: shrug it off or burst (p. 116)
        if (r <= 3) tag = 'QUEKKK! (ignored)';
        else { tag = 'SPLASH! (1 bug, 2 SP)'; down = true; }
      } else {
        if (r <= 1) tag = 'Steady, boys!';
        else if (r <= 5) { tag = 'Get down! (1 SP)'; out.sp += 1; }
        else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
      }
      if (down) {
        var saved = drugs && d6() === 6;
        // Adamantium Exoskeletons (an Adaptation): shrugs it off on a 5+
        var shell = !saved && campFlag(target, 'adamantium') && d6() >= 5;
        if (saved) { tag = 'Man down! — Combat Drugs: he gets back up (1 SP)'; out.sp += 1; }
        else if (shell) { tag += ' — Adamantium Exoskeletons: ignored'; }
        else { out.casualties += 1; out.sp += campFlag(target, 'overreact') ? 4 : 2; }
      }
      out.rolls.push('D6 ' + raw + (mod ? '+' + mod : '') + ' → ' + tag);
    }
    // Style Bonus on the firer: one more point of suppression per man killed
    if (atk && campFlag(atk, 'style') && out.casualties) {
      out.sp += out.casualties;
      out.notes.push('Style Bonus +' + out.casualties + ' SP');
    }
    // Brave shrugs one point off every ranged attack
    if (campFlag(target, 'brave') && out.sp > 0) { out.sp -= 1; out.notes.push('Brave -1 SP'); }
    // Courage Under Fire: the second and later attacks on a unit in the same turn
    if (target.shotFrom && target.shotFrom.length > 1 && doctrine(state, target.side, 'T2') && out.sp > 0) {
      out.sp -= 1; out.notes.push('Courage Under Fire -1 SP');
    }
    return out;
  }

  function resolveAssaultHits(target, hits, mod, atk) {
    mod = mod || 0;
    var out = { casualties: 0, sp: 0, rolls: [], notes: [] };
    var nbk = campFlag(atk, 'nbk');                     // Natural Born Killers
    for (var i = 0; i < hits; i++) {
      var raw = d6(), r = raw + mod, tag;
      var down = false;
      if (target && has(target, 'Animal Behaviour')) {
        if (r <= 3) tag = 'QUEKKK! (ignored)';
        else { tag = 'SPLASH! (1 bug, 2 SP)'; down = true; }
      } else if (nbk) {
        if (r <= 1) tag = 'Keep fighting!';
        else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
      } else if (r <= 1) tag = 'Keep fighting!';
      else if (r <= 3) { tag = 'Ouch! (1 SP)'; out.sp += 1; }
      else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
      if (down) {
        if (campFlag(target, 'adamantium') && d6() >= 5) tag += ' — Adamantium Exoskeletons: ignored';
        else { out.casualties += 1; out.sp += campFlag(target, 'overreact') ? 4 : 2; }
      }
      out.rolls.push('D6 ' + raw + (mod ? '+' + mod : '') + ' → ' + tag);
    }
    if (nbk) out.notes.push('Natural Born Killers: down on a 2+');
    return out;
  }

  function applyResult(state, target, res, log, atk) {
    var before = status(target);
    if (target.minModels == null) target.minModels = target.models;
    addSP(target, res.sp);
    var lost = 0;
    for (var i = 0; i < res.casualties; i++) {
      target.models -= 1; lost++;
      if (target.models <= 0) { target.models = 0; target.alive = false; break; }
    }
    target.minModels = Math.min(target.minModels, target.models);
    if (lost) psychicBond(state, target, lost, log);
    if ((!target.alive || (status(target) === 'broken' && before !== 'broken'))) infamyPanic(state, target, log);
    if (!target.alive) {
      target.wipedOut = true;
      credit(target, atk, 'kill');
      log.push({ t: 'kill', text: target.label + ' is wiped out.' });
      return;
    }
    var after = status(target);
    if (after === 'broken') { target.brokenEver = true; credit(target, atk, 'broke'); }
    if (after !== before && after !== 'ready') {
      if (after === 'broken' && has(target, 'Expendable')) {
        target.alive = false;
        target.fled = true;                      // run off, not killed to the last man
        log.push({ t: 'kill', text: target.label + ' breaks — Expendable: removed from play.' });
      } else {
        log.push({ t: after, text: target.label + ' is ' + after.toUpperCase() + ' (' + target.sp + ' SP vs Morale ' + currentMorale(target) + ').' });
      }
    }
  }

  /* ---------- vehicles and aircraft: damage, wrecks and repairs ---------- */
  // A hit on a machine: 1 bounces, 2-5 does a point, 6+ is a critical for D3 —
  // or D6 when the shot came from an Anti-tank or Anti-aircraft weapon.
  function resolveDamage(target, hits, pierce) {
    var out = { damage: 0, rolls: [] };
    for (var i = 0; i < hits; i++) {
      var r = d6(), tag;
      if (r === 1) tag = 'Bounced off the armour!';
      else if (r <= 5) { tag = 'Target damaged! (1 DP)'; out.damage += 1; }
      else {
        var crit = pierce ? d6() : d3();
        tag = 'Critical hit! (' + (pierce ? 'D6 ' : 'D3 ') + crit + ' DP)';
        out.damage += crit;
      }
      out.rolls.push('D6 ' + r + ' → ' + tag);
    }
    return out;
  }

  function applyDamage(state, t, damage, log, from) {
    t.damage = (t.damage || 0) + damage;
    if (t.damage <= t.str) {
      log.push({ t: 'note', text: t.label + ' takes ' + damage + ' damage (' + t.damage + ' of ' + t.str + ').' });
      return;
    }
    // knocked out: how badly depends on how far past its Structure it went
    var over = t.damage - t.str - 1;
    var bonus = over > 4 ? 2 : over > 2 ? 1 : 0;
    var roll = d6(), total = roll + bonus;
    t.alive = false;
    t.wipedOut = true;
    t.catastrophic = total > 5;
    credit(t, from, 'kill');
    var crew = (t.cargo || []).slice();
    t.cargo = [];
    var how;
    if (isFlying(t)) {
      how = 'shot out of the sky';
      crew.forEach(function (u) {
        u.alive = false; u.models = 0; u.aboard = null;
        /* In a campaign a downed aircraft makes an emergency landing on a 4+ and
           "troops on-board survive, but get 5 TPs" (p. 86), so who was aboard
           which machine is recorded for the aftermath to read. */
        u.lostAboard = t.rid || t.id || true;
        log.push({ t: 'kill', text: u.label + ' goes down with the aircraft.' });
      });
      log.push({ t: 'kill', text: t.label + ' is destroyed — ' + how + '.' });
      return;
    }
    if (total <= 3) {
      how = 'Abandoned! The crew is out of the game';
      crew.forEach(function (u) {
        dropOff(state, t, u);
        addSP(u, d6());
        log.push({ t: 'note', text: u.label + ' bails out — ' + u.sp + ' SP.' });
      });
    } else if (total <= 5) {
      how = 'Vehicle on fire! The crew is lost';
      crew.forEach(function (u) {
        dropOff(state, t, u);
        var burn = shoot(state, { label: 'The burning ' + t.name, side: t.side, alive: true, models: 1, fp: 6, range: 48, rules: [], x: u.x, y: u.y, shotFrom: [], cls: 'infantry' }, u, 'basic', {});
        burn.log.forEach(function (l) { log.push(l); });
      });
    } else {
      how = 'Catastrophic explosion!';
      crew.forEach(function (u) {
        u.alive = false; u.models = 0; u.aboard = null;
        log.push({ t: 'kill', text: u.label + ' is destroyed inside the wreck.' });
      });
    }
    log.push({
      t: 'kill',
      text: t.label + ' is knocked out — D6 ' + roll + (bonus ? ' +' + bonus + ' overkill' : '') + ': ' + how,
      math: t.damage + ' damage against Structure ' + t.str
    });
    // only a catastrophic explosion catches the troops around the wreck (p. 36)
    if (total <= 5) return;
    var fp = 3 + t.tier;
    state.units.forEach(function (u) {
      if (!u.alive || u === t || isFlying(u) || u.aboard) return;
      if (unitDist(u, t) > 4) return;
      var blast = shoot(state, { label: 'The exploding ' + t.name, side: t.side === 'A' ? 'B' : 'A', alive: true, models: 1, fp: fp, range: 48, rules: [], x: t.x, y: t.y, shotFrom: [], cls: 'infantry' }, u, 'basic', {});
      blast.log.forEach(function (l) { log.push(l); });
    });
  }

  // put a passenger back on the table, as close to the vehicle as will fit
  function dropOff(state, veh, u) {
    u.aboard = null;
    for (var t = 0; t < 60; t++) {
      var ang = Math.random() * Math.PI * 2, d = 2 * UNIT_R + Math.random() * 2;
      var p = clampBoard({ x: veh.x + Math.cos(ang) * d, y: veh.y + Math.sin(ang) * d });
      if (TERRAIN[terrainAt(state, p.x, p.y)].impassable) continue;
      if (unitNear(state, p.x, p.y, u, 0.2)) continue;
      u.x = p.x; u.y = p.y;
      return true;
    }
    u.x = veh.x; u.y = veh.y;
    return false;
  }

  // Rally phase: a machine patches itself up. Jammers make it harder.
  function repair(state, u) {
    if (!u.damage) return null;
    // Nanobots (p. 89): the repair rolls dice for the whole Structure, not for what is left of it
    var dice = campFlag(u, 'nanobots') ? u.str : Math.max(1, u.str - u.damage), need = jammedNearby(state, u) ? 5 : 4;
    var rolls = [], fixed = 0;
    for (var i = 0; i < dice; i++) {
      var r = d6();
      rolls.push({ value: r, ok: r >= need });
      if (r >= need) fixed++;
    }
    var before = u.damage;
    u.damage = Math.max(0, u.damage - fixed);
    return {
      dice: dice, need: need, rolls: rolls, fixed: fixed, before: before, after: u.damage,
      text: u.label + ' repairs: ' + dice + 'D6 [' + rolls.map(function (r) { return r.value; }).join(' ') +
        '] on ' + need + '+ — ' + fixed + ' damage cleared (' + before + ' → ' + u.damage + ').'
    };
  }
  /* Jammers: enemies within 24" rally — and repair — on 5+ instead of 4+.
     Counter-jamming within 6" of the victim shuts that out again. */
  /* Jammers is a penalty, so it bites from a unit that is suppressed or broken;
     Counter-jamming is a bonus, so it does not (p. 28). */
  function jammedNearby(state, u) {
    var jammed = false;
    for (var i = 0; i < state.units.length; i++) {
      var e = state.units[i];
      if (!e.alive || e.aboard) continue;
      if (e.side !== u.side && has(e, 'Jammers') && unitDist(e, u) <= 24) jammed = true;
      if (e.side === u.side && projects(e) && has(e, 'Counter-jamming') && unitDist(e, u) <= 6) return false;
    }
    return jammed;
  }

  /* Hackers (p. 57): reach into an enemy drone within 24".
     1-2 nothing, 3-4 it is locked out for the turn and takes D3+1 hits,
     5-6 it is turned on its own side first, then takes the same hits. */
  function canHack(state, a, t) {
    if (!a.alive || !t.alive || a.side === t.side) return false;
    if (!has(a, 'Hackers') || !t.drone) return false;
    if (a.hackUsed) return false;
    return unitDist(a, t) <= 24;
  }

  function hack(state, a, t, fireBack) {
    var log = [], roll = d6();
    // a Xenotripod turret's systems are alien: a 5-6 only ever locks it out (p. 130)
    if (roll >= 5 && hasOwn(t, 'Turret')) {
      log.push({ t: 'note', text: 'Turret — the alien code will not turn: D6 ' + roll + ' counts as ' + (roll - 2) + '.' });
      roll -= 2;
    }
    a.hackUsed = true;
    var turned = false, locked = false;
    if (roll <= 2) {
      log.push({ t: 'note', text: a.label + ' tries to break into ' + t.label + ' — D6 ' + roll + ': the ice holds.' });
      return { log: log, roll: roll, turned: false, locked: false };
    }
    if (roll >= 5 && !t.activated && typeof fireBack === 'function') {
      turned = fireBack(t);                       // the drone is made to shoot its own side
    }
    locked = true;
    t.activated = true;
    t.hacked = true;
    var hits = d3() + 1;
    log.push({
      t: 'note',
      text: a.label + ' hacks ' + t.label + ' — D6 ' + roll + ': ' +
        (turned ? 'turned on its own side, then ' : '') + 'locked out and burned for ' + hits + ' hits.'
    });
    var dres = resolveDamage(t, hits, false);
    log.push({ t: 'hits', text: dres.rolls.join(' · ') });
    applyDamage(state, t, dres.damage, log, a);
    return { log: log, roll: roll, turned: turned, locked: locked, hits: hits };
  }

  /* Command Vehicle (p. 56): a Command Unit riding inside lends the hull all of
     its special rules, and may still act once the vehicle has finished. */
  function commandAboard(veh) {
    var cargo = veh && veh.cargo;
    if (!cargo || !has(veh, 'Command Vehicle')) return null;
    for (var i = 0; i < cargo.length; i++) if (has(cargo[i], 'Command Unit')) return cargo[i];
    return null;
  }

  /* ---------- transport ---------- */
  function canEmbark(state, veh, u) {
    if (!veh.transport || !u.alive || u.side !== veh.side) return false;
    /* A Lifter is a flying crane: it picks up a single vehicle — with whatever is
       already riding inside it — and never infantry (p. 94). Every other hull is
       the other way round. */
    if (hasOwn(veh, 'Lifter')) {
      if (u.cls !== 'vehicle') return false;
      if (u.aboard || (veh.cargo || []).length >= veh.transport) return false;
      if (u.disembarked) return false;
      return unitDist(veh, u) <= 4;
    }
    if (isMachine(u)) return false;
    // a Rapid insertion platform is loaded before the battle and never again (p. 79)
    if (hasOwn(veh, 'Immobile')) return false;
    // Riders never ride in anything: the mounts do not fit (p. 94)
    if (hasOwn(u, 'Riders')) return false;
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
    u.sp = 0;                                           // safe inside, and steadied
    u.x = -1; u.y = -1;
    return { text: u.label + ' embarks aboard ' + veh.name + '.' };
  }
  function disembark(state, veh, u, pos) {
    var i = (veh.cargo || []).indexOf(u);
    if (i < 0) return null;
    veh.cargo.splice(i, 1);
    u.aboard = null;
    u.disembarked = true;
    if (pos && !TERRAIN[terrainAt(state, pos.x, pos.y)].impassable
      && !unitNear(state, pos.x, pos.y, u, 0.2) && unitDist({ x: pos.x, y: pos.y }, veh) <= 4) {
      u.x = pos.x; u.y = pos.y;
    } else {
      dropOff(state, veh, u);
    }
    return { text: u.label + ' disembarks from ' + veh.name + '.' };
  }

  /* ---------- destructible terrain (pp. 41-43, 57-58) ----------
     Low walls, high walls and ordinary buildings can be brought down; reinforced
     walls and bunkers, woods, ruins and rocks cannot. A demolished wall leaves
     rubble that no longer shelters anyone; a demolished building burns, blocking
     sight and barring the ground, and whoever was inside has to get out. */
  function isDestructible(r) {
    var t = TERRAIN[r && r.kind];
    return !!(t && t.destructible);
  }
  function destructibleKind(r) {
    var t = TERRAIN[r && r.kind];
    return t ? t.destructible : null;
  }
  // the piece a unit is standing in or sheltering behind, from this attacker's side
  function shelterOf(state, attacker, target) {
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i];
      if (!isDestructible(r)) continue;
      if (inRect(target.x, target.y, r)) return r;
    }
    if (!attacker) return null;
    for (var j = 0; j < state.terrain.length; j++) {
      var r2 = state.terrain[j];
      if (!isDestructible(r2) || TERRAIN[r2.kind].blocks) continue;
      if (inRect(attacker.x, attacker.y, r2)) continue;
      if (segRect(attacker.x, attacker.y, target.x, target.y, r2)) return r2;
    }
    return null;
  }
  // Incendiary Ammunition counts as a Destructive Weapon against buildings
  /* Shooting a piece of terrain down (p. 57): a Destructive Weapon against
     anything, Incendiary Ammunition against a building. The Demolish scenario's
     objective can only be brought down by the Demolish action, not by gunfire,
     so a machine needs a Destructive Weapon even for that. */
  function canDemolish(u, r) {
    if (!isDestructible(r)) return false;
    if (destructibleKind(r) === 'target') return !isMachine(u) || has(u, 'Destructive Weapon');
    if (has(u, 'Destructive Weapon')) return true;
    return destructibleKind(r) === 'building' && has(u, 'Incendiary Ammunition');
  }

  /* Putting charges against a piece by hand — the Demolish special action, which
     is resolved as an assault (pp. 58-59). Sappers may do it to any destructible
     piece; in the Demolish scenario "all units can make the Demolish special
     action targetting the objective" (p. 54) and "ALL attacking infantry units
     are allowed to demolish it, but only Sappers can demolish other objects"
     (p. 49) — at +2 rather than the Sappers' +4. Nobody assaults with a
     Cumbersome Weapon, and vehicles do not assault at all. */
  function canCharge(u, r) {
    if (!isDestructible(r) || !u) return false;
    if (isMachine(u) || u.cls !== 'infantry') return false;
    if (has(u, 'Cumbersome Weapon')) return false;
    if (has(u, 'Sappers')) return true;
    return destructibleKind(r) === 'target';
  }

  function destroyTerrain(state, r, log, by) {
    var kind = destructibleKind(r);
    if (!kind) return null;
    var was = TERRAIN[r.kind].name;
    r.kind = kind === 'building' ? 'burning' : 'razed';
    r.wrecked = true;
    var out = { piece: r, was: was, kind: r.kind, evicted: [] };
    log.push({
      t: 'kill',
      text: (by ? by.label + ' brings down ' : 'Down comes ') + was.toLowerCase() +
        (kind === 'building' ? ' — it goes up in flames.' : ' — only rubble is left.')
    });
    if (kind === 'building') {
      // the burning shell is impassable, so anyone inside must leave at once
      for (var i = 0; i < state.units.length; i++) {
        var u = state.units[i];
        if (!u.alive || u.aboard || u.x < 0) continue;
        if (u.bld !== r && !inRect(u.x, u.y, r)) continue;
        u.bld = null; u.sec = null;
        var p = nearestClear(state, u, r);
        u.x = p.x; u.y = p.y;
        out.evicted.push(u);
        log.push({ t: 'note', text: u.label + ' scrambles clear of the burning building.' });
      }
    }
    return out;
  }
  // the closest point outside a piece that the unit can actually stand on
  function nearestClear(state, u, r) {
    for (var step = 1; step <= 24; step++) {
      for (var a = 0; a < 12; a++) {
        var ang = a * Math.PI / 6;
        var x = u.x + Math.cos(ang) * (step * 0.5), y = u.y + Math.sin(ang) * (step * 0.5);
        var p = clampBoard({ x: x, y: y });
        if (inRect(p.x, p.y, r)) continue;
        if (TERRAIN[terrainAt(state, p.x, p.y)].impassable) continue;
        if (unitNear(state, p.x, p.y, u, 0.2)) continue;
        return p;
      }
    }
    return clampBoard({ x: u.x + 2, y: u.y + 2 });
  }

  /* Shooting a piece down on its own (p. 57): a final 15+, or an unmodified 9. */
  function shootTerrain(state, a, r) {
    var log = [], parts = [], total = 0;
    var roll = d10();
    total = roll; parts.push({ label: 'D10', v: roll });
    total += a.fp; parts.push({ label: 'Firepower', v: a.fp });
    var sb = sizeBonus(a.models);
    if (sb) { total += sb; parts.push({ label: a.models + ' models', v: sb }); }
    if (has(a, 'Demolisher')) { total += 4; parts.push({ label: 'Demolisher', v: 4 }); }
    var down = roll === 9 || total >= 15;
    log.push({
      t: 'shoot',
      text: a.label + ' fires on the ' + TERRAIN[r.kind].name.toLowerCase(),
      math: parts.map(fmtPart).join(', ') + ' = ' + total + ' — needs 15+, or an unmodified 9 → ' +
        (down ? 'it comes down' : 'it holds')
    });
    var res = down ? destroyTerrain(state, r, log, a) : null;
    a.activated = true;
    return { log: log, down: down, result: res, total: total, roll: roll };
  }

  /* Terrorist (Path of the Villain, p. 112). A piece of terrain was mined before
     the battle; any First Among Equals may set it off from anywhere on the table.
     It resolves as a shooting attack at Firepower 10 with Destructive Weapon —
     so the piece itself almost always goes, and anyone sheltering in it is
     caught by the same blast. */
  function detonate(state, a, r) {
    var log = [], parts = [];
    var roll = d10(), total = roll + 10;
    parts.push({ label: 'D10', v: roll });
    parts.push({ label: 'Firepower (charge)', v: 10 });
    var down = roll === 9 || total >= 15;
    log.push({
      t: 'shoot',
      text: a.label + ' sets off the charge under the ' + TERRAIN[r.kind].name.toLowerCase() + '.',
      math: parts.map(fmtPart).join(', ') + ' = ' + total + ' — needs 15+, or an unmodified 9 → ' +
        (down ? 'it comes down' : 'it holds')
    });
    // whoever was sheltering in it takes the blast, Firepower 10 and Destructive
    var caught = state.units.filter(function (u) {
      return u.alive && !u.aboard && !isFlying(u) && inRect(u.x, u.y, r);
    });
    var res = down ? destroyTerrain(state, r, log, a) : null, treated = [];
    caught.forEach(function (u) {
      var hits = Math.max(0, total - defenceAgainst(state, a, u, { basic: true }).value);
      if (!hits) {
        log.push({ t: 'note', text: u.label + ' rides out the blast.' });
        return;
      }
      if (isMachine(u)) {
        var dm = resolveDamage(u, hits, false);
        log.push({ t: 'hits', text: dm.rolls.join(' · ') });
        applyDamage(state, u, dm.damage, log, a);
      } else {
        var hr = resolveShootingHits(state, u, hits, 0, a);
        if (hr.medic) treated.push({ id: u.id, medic: hr.medic });
        log.push({ t: 'hits', text: hr.rolls.join(' · ') });
        applyResult(state, u, hr, log, a);
      }
    });
    state.mined = null;
    a.activated = true;
    // `treated`: each squad caught in it that a MEDIC! answered for, and who answered
    return { log: log, down: down, result: res, total: total, roll: roll, treated: treated };
  }

  /* Sappers going in with charges (p. 58): the same threshold, +4 for the rule,
     and a 2" fall-back if the wall holds. */
  function assaultTerrain(state, a, r) {
    var log = [], parts = [], total = 0;
    var roll = d10();
    total = roll; parts.push({ label: 'D10', v: roll });
    total += a.assault; parts.push({ label: 'Assault', v: a.assault });
    var sb = sizeBonus(a.models);
    if (sb) { total += sb; parts.push({ label: a.models + ' models', v: sb }); }
    var bonus = chargeBonus(a, r);
    if (bonus) { total += bonus; parts.push({ label: bonus === 4 ? 'Sappers' : 'demolition charges', v: bonus }); }
    var down = roll === 9 || total >= 15;
    log.push({
      t: 'assault',
      text: a.label + ' sets charges against the ' + TERRAIN[r.kind].name.toLowerCase(),
      math: parts.map(fmtPart).join(', ') + ' = ' + total + ' — needs 15+, or an unmodified 9 → ' +
        (down ? 'the charges blow' : 'the charges fail')
    });
    var res = down ? destroyTerrain(state, r, log, a) : null;
    if (!down) {
      fallBack(state, a, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, 2);
      log.push({ t: 'note', text: a.label + ' falls back 2" from the wall.' });
    }
    a.activated = true;
    return { log: log, down: down, result: res, total: total, roll: roll };
  }

  /* A Tier III-V vehicle simply drives through a low or high wall (p. 35). */
  function crushOnMove(state, u, from, to, log) {
    if (u.cls !== 'vehicle' || u.tier < 3) return [];
    var gone = [];
    for (var i = 0; i < state.terrain.length; i++) {
      var r = state.terrain[i];
      if (destructibleKind(r) !== 'linear') continue;
      if (!segRect(from.x, from.y, to.x, to.y, r) && !inRect(to.x, to.y, r)) continue;
      var res = destroyTerrain(state, r, log, u);
      if (res) gone.push(res);
    }
    return gone;
  }

  /* ---------- shooting ---------- */
  /* "Dig in!" (p. 94): the crew drag the trails round and shoot over open sights.
     The piece loses its reach and its all-round traverse, and gains everything a
     direct-fire gun has — full modifiers instead of Basic Firepower. */
  /* ---------- the Xenotripods (pp. 129-130, 140-143) ---------- */
  function isXeno(u) { return !!u && u.faction === 'xeno'; }
  // the army rules pass the drones by — and every turret is Drone Controlled
  function xenoSenses(u) { return isXeno(u) && !u.drone && !hasOwn(u, 'Drone Control'); }
  // Limited Senses: 12", or 18" with the Rite of Farsight; everyone else 36"
  function sightRange(u) {
    if (!xenoSenses(u)) return 36;
    return campFlag(u, 'farsight') ? 18 : 12;
  }
  /* Mental Projection: an enemy seen by any unbroken Xenotripod is seen by the
     whole tribe. Aircraft see over everything, but no further than 12". */
  function tribeSeers(state, side, t) {
    var out = [];
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (!o.alive || o.side !== side || o.aboard || o.reserve || o.x < 0 || !xenoSenses(o)) continue;
      if (campFlag(o, 'banished') || status(o) === 'broken') continue;
      if (centreDist(o, t) > sightRange(o)) continue;
      if (isFlying(o) || isFlying(t) || lineClear(state, o, t)) out.push(o);
    }
    return out;
  }
  function tribeSees(state, side, t) { return tribeSeers(state, side, t).length > 0; }
  // Dual-mode Weapons (p. 142): Indirect Fire at full modifiers on a target in sight
  function dualMode(state, a, t) {
    return !!state && doctrine(state, a.side, 'XT6') && !isFlying(a) && !!t && hasLoS(state, a, t);
  }
  // Shield Generator (p. 130): +2 from a turret, +1 from a craft, the best one only
  function shieldFor(state, attacker, target) {
    if (!state || !attacker || !target) return null;
    var best = null;
    for (var i = 0; i < state.units.length; i++) {
      var g = state.units[i];
      if (!g.alive || g.side !== target.side || g.aboard || g.reserve || g.x < 0) continue;
      var v = ruleValue(g, 'Shield Generator');
      if (!v) continue;
      // the whole unit inside the dome, and the shot fired from outside it
      if (centreDist(g, target) + UNIT_R > 12) continue;
      if (unitDist(g, attacker) <= 12) continue;
      if (!best || v > best.v) best = { v: v, from: g };
    }
    return best;
  }
  function enemyWithin(state, u, r) {
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o.alive && o.side !== u.side && !o.aboard && !o.reserve && o.x >= 0 && unitDist(o, u) <= r) return true;
    }
    return false;
  }
  // Rite of Disruption (p. 142): an enemy infantry unit within 6" rallies on 6s
  function disruptedBy(state, u) {
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o.alive && o.side !== u.side && !o.aboard && campFlag(o, 'disruption') && unitDist(o, u) <= 6) return o;
    }
    return null;
  }
  // Psychic Bond, the kind half: the best Morale of a friend within 6"
  function bondMorale(state, u) {
    if (!xenoSenses(u) || isMachine(u)) return null;
    var best = null;
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o === u || !o.alive || o.side !== u.side || o.aboard || o.reserve || o.x < 0) continue;
      if (!xenoSenses(o) || isMachine(o) || unitDist(o, u) > 6) continue;
      var m = currentMorale(o);
      if (!best || m > best.m) best = { m: m, from: o };
    }
    return best;
  }
  /* Psychic Bond, the cruel half: every model a Xenotripod unit loses puts a
     Suppression point on each friend within 6" — three under the Infamy of
     Overreaction; none under the Rite of Stability. */
  function psychicBond(state, u, lost, log) {
    if (!state || !state.units || !xenoSenses(u) || !lost) return;
    var hit = [];
    for (var i = 0; i < state.units.length; i++) {
      var o = state.units[i];
      if (o === u || !o.alive || o.side !== u.side || o.aboard || o.reserve || o.x < 0) continue;
      if (!xenoSenses(o) || isMachine(o) || campFlag(o, 'stability')) continue;
      if (unitDist(o, u) > 6) continue;
      var n = lost * (campFlag(o, 'overreaction') ? 3 : 1), was = status(o);
      addSP(o, n);
      var now = status(o);
      if (now === 'broken') o.brokenEver = true;
      hit.push(o.label + ' +' + n + (now !== was ? ' (' + now + ')' : ''));
    }
    if (hit.length && log) log.push({ t: 'hits', text: 'Psychic Bond — ' + u.label + '’s ' + lost + ' dead are felt by ' + hit.join(', ') + '.' });
  }
  /* Infamy of Panic (p. 143): a friend within 18" broken or destroyed, and the
     unit takes D6 Suppression. */
  function infamyPanic(state, u, log) {
    if (!state || !state.units) return;
    state.units.forEach(function (o) {
      if (o === u || !o.alive || o.side !== u.side || o.aboard || o.x < 0 || !campFlag(o, 'infamyPanic')) return;
      if (unitDist(o, u) > 18) return;
      var n = d6(), was = status(o);
      addSP(o, n);
      if (status(o) === 'broken') o.brokenEver = true;
      if (log) log.push({ t: 'hits', text: 'Infamy of Panic — ' + o.label + ' sees ' + u.label + ' go and takes ' + n + ' SP' + (status(o) !== was ? ' (' + status(o) + ')' : '') + '.' });
    });
  }
  /* Regain Control (Dominant Species, p. 129): the Crocks stand still and every
     Epsilon squad of their Tier or lower within 12" sheds all its Suppression. */
  function regainTargets(state, u) {
    return state.units.filter(function (o) {
      return o.alive && o.side === u.side && !o.aboard && !o.reserve && o.x >= 0 && o !== u &&
        BY_KEY[o.key] && BY_KEY[o.key].group === 'Epsilon Squads' && o.tier <= u.tier &&
        o.sp > 0 && unitDist(o, u) <= 12;
    });
  }
  function regainControl(state, u) {
    var log = [], freed = regainTargets(state, u);
    log.push({ t: 'rally', text: u.label + ' reaches out to the Esh-Aven — Regain Control.' });
    freed.forEach(function (o) {
      log.push({ t: 'rally', text: o.label + ' — ' + o.sp + ' SP gone.' });
      o.sp = 0;
    });
    if (!freed.length) log.push({ t: 'note', text: 'No shaken Epsilon squad within 12" to steady.' });
    return { log: log, freed: freed };
  }
  // Self-repair (Molecular Reconstruction, p. 129): stay still, lose every Damage point
  function selfRepair(state, u) {
    var was = u.damage || 0;
    u.damage = 0;
    return { log: [{ t: 'rally', text: u.label + ' rebuilds itself — Molecular Reconstruction clears ' + was + ' Damage.' }], cleared: was };
  }
  /* Teleport (p. 130): a Teleport unit takes in one infantry unit that could board
     it, and on a D6 of 1-2 it comes out at a random Teleport unit — perhaps the
     same one — and on 3-6 at the one its owner picks. It is not an activation. */
  function teleportFrom(state, tp) {
    return state.units.filter(function (u) {
      if (!u.alive || u.side !== tp.side || u.aboard || u.reserve || u.x < 0) return false;
      if (u.cls !== 'infantry' || u.activated || u.disembarked || hasOwn(u, 'Riders')) return false;
      if (campFlag(u, 'backward')) return false;              // Infamy of Backwardness
      if (status(u) !== 'ready') return false;
      return unitDist(u, tp) <= 4;
    });
  }
  function teleportPads(state, side) {
    return state.units.filter(function (u) {
      return u.alive && u.side === side && !u.aboard && !u.reserve && u.x >= 0 && hasOwn(u, 'Teleport');
    });
  }
  function teleportRoll(state, u, tp) {
    var r = d6(), second = null;
    // Rite of Knowledge (p. 142): a 1-3 may be rolled again, and the second stands
    if (r <= 3 && campFlag(u, 'knowledge')) { second = d6(); }
    var v = second != null ? second : r;
    var pads = teleportPads(state, tp.side);
    /* Auxiliary Teleportation System (p. 143): on a 2-3 the unit may come out
       beside an aircraft carrying it instead. */
    var aux = state.units.filter(function (o) {
      return o.alive && o.side === tp.side && o.cls === 'aircraft' && o.x >= 0 && campFlag(o, 'auxTeleport');
    });
    if ((v === 2 || v === 3) && aux.length) {
      return { roll: r, reroll: second, value: v, random: false, pads: pads.concat(aux), aux: aux, randomPad: pads[0] || tp };
    }
    return { roll: r, reroll: second, value: v, random: v <= 2, pads: pads,
      randomPad: pads[Math.floor(Math.random() * pads.length)] || tp };
  }
  function teleport(state, u, from, to) {
    // drop the unit onto clear ground within 4" of the exit pad
    var best = null;
    for (var ring = 2.2; ring <= 4 && !best; ring += 0.6) {
      for (var k = 0; k < 16; k++) {
        var ang = k * Math.PI / 8 + (ring * 0.7);
        var x = to.x + Math.cos(ang) * ring, y = to.y + Math.sin(ang) * ring;
        if (x < 1 || y < 1 || x > BOARD.w - 1 || y > BOARD.h - 1) continue;
        if (TERRAIN[terrainAt(state, x, y)].impassable || unitNear(state, x, y, u, 0.2)) continue;
        best = { x: x, y: y }; break;
      }
    }
    if (!best) return { ok: false, text: 'There is no room at ' + to.label + ' — ' + u.label + ' stays where it is.' };
    var was = { x: u.x, y: u.y };
    u.bld = null; u.sec = null;
    u.x = best.x; u.y = best.y;
    u.disembarked = true;                                   // "embarked" — not back through the same turn
    return { ok: true, from: was, text: u.label + ' vanishes at ' + from.label + ' and steps out beside ' + to.label + '.' };
  }

  function dugIn(u) { return !!(u && u.dugIn && hasOwn(u, 'Stationary Artillery')); }
  function shotRange(a) { return dugIn(a) ? Math.min(a.range, 24) : a.range; }
  function shotMinRange(a) { return dugIn(a) ? 6 : ruleValue(a, 'Minimum Range'); }

  function canShoot(state, a, t, mode, opts) {
    opts = opts || {};
    if (!a.alive || !t.alive || a.side === t.side || a.fp === null) return false;
    /* Only what is on the table can be shot at. A unit held in reserve is parked
       just off the table's corner at (-1, -1), and a unit riding inside a hull is
       not there at all; neither is a target, however close the numbers say. */
    if (t.reserve || t.aboard || t.x < 0 || t.y < 0) return false;
    if (!opts.aux) {
      // a main weapon set up for one kind of target cannot engage the other
      if (has(a, 'Specialisation (air)') && !isFlying(t)) return false;
      if (has(a, 'Specialisation (ground)') && isFlying(t)) return false;
      // a fixed mount only bears on the front quarter
      if ((has(a, 'Limited Fire Arc') || dugIn(a)) && !inFireArc(a, t)) return false;
    }
    var d = unitDist(a, t);
    var range = opts.aux ? 12 : shotRange(a);
    if (d > range) return false;
    // Cloaking System (p. 129): nobody draws a bead on it from further than 12"
    if (has(t, 'Cloaking System') && d > 12) return false;
    var minR = shotMinRange(a);
    if (!opts.aux && minR && d < minR) return false;
    // Cumbersome Weapons cannot be fired from shallow water, nor on the turn the
    // crew stepped off a vehicle
    if (!opts.aux && has(a, 'Cumbersome Weapon') &&
      (TERRAIN[terrainOf(state, a)].shallow || a.disembarked)) return false;
    // a dug-in gun is laying over its sights, so it needs to see what it hits
    if (!opts.aux && markCall(state, a, t, opts) === 'designate') return true;
    /* Limited Senses and Mental Projection (p. 129): a Xenotripod sees 12", but
       whatever one of the tribe sees, all of them see. An aircraft is over
       everything; Indirect Fire lobs over whatever is in the way. */
    var senses = xenoSenses(a) && !campFlag(a, 'banished');
    if (isFlying(a) || isFlying(t)) {                  // aircraft shoot and are shot over everything
      return !xenoSenses(a) || centreDist(a, t) <= sightRange(a) || (senses && tribeSees(state, a.side, t));
    }
    if (hasLoS(state, a, t)) return true;
    if (!senses || !tribeSees(state, a.side, t)) return false;
    if (!opts.aux && has(a, 'Indirect Fire')) return true;
    return lineClear(state, a, t);
  }

  /* A live Markerlight call (p. 58). The mark is not a condition the target wears
     for the rest of the turn: it exists only for the one or two units the marker
     calls up, and what it is worth depends on which of the two actions was used.

       Designate target — feeds units with Indirect Fire, which may then shoot
                          without line of sight (the target must still be in range).
       Mark the target  — feeds units WITHOUT Indirect Fire, which must have the
                          target in sight and in range, and fire as though it were
                          within half of theirs.

     `opts.markKind` asks the question hypothetically — could this unit answer a
     call of that kind — which is how the action bar decides what to offer. */
  function markCall(state, a, t, opts) {
    var kind = (opts && opts.markKind) || null;
    if (!kind) {
      var m = state && state.mark;
      if (!m || !t || m.side !== a.side) return null;
      if (m.targets.indexOf(t) < 0) return null;
      kind = m.kind;
    }
    if (kind === 'designate') return has(a, 'Indirect Fire') && !dugIn(a) ? 'designate' : null;
    return has(a, 'Indirect Fire') ? null : 'mark';
  }

  /* Every modifier on a shot except the die, in one place, so the odds shown on the
     board and the roll that follows can never drift apart. */
  function shotMods(state, a, t, mode, opts) {
    opts = opts || {};
    var aux = !!opts.aux;
    var basic = mode === 'defensive' || mode === 'basic' ||
      (has(a, 'Always Basic Firepower') && !aux) || (has(a, 'Indirect Fire') && !aux && !dugIn(a) && !dualMode(state, a, t)) ||
      isFlying(a) || isFlying(t) ||                    // aircraft shoot, and are shot at, basic
      flyInf(a) || flyInf(t);                          // and so do Flying Infantry (p. 116)
    var parts = [], total = 0;

    var fp = aux ? 1 : a.fp;
    total += fp; parts.push({ label: aux ? 'Auxiliary FP' : 'Firepower', v: fp });
    var phero = aux ? 0 : pheromoneBonus(state, a, t);
    if (phero) { total += phero; parts.push({ label: 'Pheromone Markers', v: phero }); }
    var sb = sizeBonus(a.models);
    if (sb) { total += sb; parts.push({ label: a.models + ' models', v: sb }); }

    var dist = unitDist(a, t), crossfire = false, arc = 'front';
    // Anti-tank and Anti-aircraft bear even when firing basic
    var pierce = false;
    if (!aux) {
      if (t.cls === 'vehicle' && antiTank(a, dist)) {
        total += 4; parts.push({ label: 'Anti-tank', v: 4 }); pierce = true;
      }
      // Temporal Armour Amplifier (a Xenotripod aircraft upgrade, p. 143): immune to it
      if (isFlying(t) && has(a, 'Anti-aircraft') && !campFlag(t, 'temporal')) {
        total += 4; parts.push({ label: 'Anti-aircraft', v: 4 }); pierce = true;
      }
      // a Gauss weapon punches harder through a hull
      if (t.cls === 'vehicle' && has(a, 'Gauss Weapon')) {
        total += 1; parts.push({ label: 'Gauss Weapon', v: 1 });
      }
      if (t.cls === 'vehicle' && !has(t, 'Advanced Protection')) {
        arc = arcOf(t, a);
        var tp = propOf(t);
        if (arc === 'side' && !(tp && tp.noSideArc)) { total += 1; parts.push({ label: 'side armour', v: 1 }); }
        else if (arc === 'rear') { total += 2; parts.push({ label: 'rear armour', v: 2 }); }
      }
    }
    // Spotters (an Adaptation, p. 125): +1 for every friendly unit within 6", up to +3
    if (!aux && campFlag(a, 'spotters') && state && state.units) {
      var near6 = state.units.filter(function (o) {
        return o !== a && o.alive && !o.aboard && o.side === a.side && unitDist(o, a) <= 6;
      }).length;
      if (near6) { total += Math.min(3, near6); parts.push({ label: 'Spotters', v: Math.min(3, near6) }); }
    }
    if (!basic && !aux) {
      // Effective Toxin Glands: Spore and Flying Bugs get +2 for Fire! (p. 124)
      var toxin = bugRanged(a) && doctrine(state, a.side, 'BC6');
      // ...and so does a Xenotripod unit with the Rite of Perfection (p. 142)
      var perfect = campFlag(a, 'perfection');
      var fireB = mode === 'fire' && (toxin || perfect) ? 2 : 1;
      if (mode === 'fire') { total += fireB; parts.push({ label: fireB === 2 ? (perfect ? 'Fire! — Rite of Perfection' : 'Fire! — Effective Toxin Glands') : 'Fire! (stationary)', v: fireB }); }
      // Chaotic Ranged Attacks (a Genetic Flaw): no bonus inside half range
      if (dist <= shotRange(a) / 2 && campFlag(a, 'chaotic')) {
        parts.push({ label: 'Chaotic Ranged Attacks — no half-range bonus', v: 0 });
      } else if (dist <= shotRange(a) / 2) {
        // Rain of Fire doubles the close-range bonus
        var close = campFlag(a, 'rainOfFire') ? 4 : 2;
        total += close;
        parts.push({ label: close === 4 ? 'Rain of Fire, within half range' : 'within half range', v: close });
      }
      else if (markCall(state, a, t, opts) === 'mark') {
        total += 2; parts.push({ label: 'Markerlight', v: 2 });
      }
      /* Height: +2 for firing down on a target standing lower — from a hill on
         to the level ground, and from the crown of a stepped hill on to its
         lower slope as well. Once, however many steps down it is. */
      var la = levelOf(state, a), lt = levelOf(state, t);
      if (la > lt) {
        total += 2;
        parts.push({ label: la === 2 && lt === 1 ? 'firing down from the crown of the hill' : 'firing from a hill', v: 2 });
      }
      // a good shooting position: a high building or a reinforced one (pp. 41, 43)
      if (a.bld && sectionHigh(a.bld, sectionRect(a))) {
        total += 2; parts.push({ label: a.bld.kind === 'bunker' ? 'firing from a reinforced building' : 'firing from a high building', v: 2 });
      }
      /* Troops inside buildings, and in trenches, are not affected by Crossfire
         (pp. 41-42). */
      var noX = !!t.bld || !!TERRAIN[terrainOf(state, t)].noCrossfire;
      for (var i = 0; i < t.shotFrom.length && !isMachine(t) && !noX; i++) {
        var p = t.shotFrom[i];
        // Crossfire: the target sits between this firer and an earlier one
        if (pointSegDist(t.x, t.y, p.x, p.y, a.x, a.y) < UNIT_R * 1.6) { crossfire = true; break; }
      }
      if (crossfire) { total += 2; parts.push({ label: 'Crossfire', v: 2 }); }
      // Zero-in: every later attack on a target already shot at this turn
      if (t.shotFrom.length && doctrine(state, a.side, 'T6')) {
        total += 1; parts.push({ label: 'Zero-in', v: 1 });
      }
    }
    // Demolisher: a machine fitted for knocking buildings down
    if (!aux && campFlag(a, 'demolisher') && shelterOf(state, a, t)) {
      total += 4; parts.push({ label: 'Demolisher', v: 4 });
    }
    // a unit charging home cannot claim cover from the defensive fire it draws
    var dres = defenceAgainst(state, aux ? null : a, t,
      { noCover: mode === 'defensive', defensiveFire: mode === 'defensive' });
    return {
      total: total, parts: parts, basic: basic, aux: aux, pierce: pierce,
      crossfire: crossfire, arc: arc, dist: dist, def: dres
    };
  }

  /* The exact chance of the shot telling, by walking all ten faces of the die:
     an unmodified 0 always fails and an unmodified 9 always scores at least one hit. */
  function shotOdds(state, a, t, mode, opts) {
    var m = shotMods(state, a, t, mode, opts);
    var tell = 0, sum = 0;
    for (var r = 0; r <= 9; r++) {
      var h = r === 0 ? 0 : r === 9 ? Math.max(1, r + m.total - m.def.value)
        : Math.max(0, r + m.total - m.def.value);
      if (h > 0) tell++;
      sum += h;
    }
    return {
      chance: tell / 10, avgHits: sum / 10, mods: m.total, def: m.def.value,
      need: Math.max(1, m.def.value - m.total + 1), parts: m.parts, defParts: m.def.parts
    };
  }

  // the same sum for a single round of an assault
  function assaultOdds(state, atk, def) {
    var total = atk.assault + sizeBonus(atk.models);
    if (doctrine(state, atk.side, 'T4')) total += 1;
    if (isMachine(def) && !isMachine(atk) && !has(def, 'Advanced Protection')) total += 4;
    var dres = defenceAgainst(state, atk, def, { assault: true });
    var tell = 0, sum = 0;
    for (var r = 0; r <= 9; r++) {
      var h = r === 0 ? 0 : r === 9 ? Math.max(1, r + total - dres.value)
        : Math.max(0, r + total - dres.value);
      if (h > 0) tell++;
      sum += h;
    }
    return { chance: tell / 10, avgHits: sum / 10, mods: total, def: dres.value,
      need: Math.max(1, dres.value - total + 1) };
  }

  function shoot(state, a, t, mode, opts) {
    opts = opts || {};
    var m = shotMods(state, a, t, mode, opts);
    var aux = m.aux, basic = m.basic, parts = m.parts.slice(), pierce = m.pierce;
    var crossfire = m.crossfire, dist = m.dist, dres = m.def;
    var log = [];
    var roll = d10();
    var total = m.total + roll;
    parts.unshift({ label: 'D10', v: roll });
    /* Rite of Concentration (p. 142): once a battle the D10 is doubled. It is
       spent on the first roll where doubling is worth having; the unmodified 0
       and 9 are still read off the die itself. */
    if (!aux && roll >= 5 && roll < 9 && campFlag(a, 'concentration') && a.camp && a.camp.once && !a.camp.once.concentration) {
      a.camp.once.concentration = true;
      total += roll;
      parts.splice(1, 0, { label: 'Rite of Concentration — D10 doubled', v: roll });
    }
    t.shotFrom.push({ x: a.x, y: a.y });

    /* Destructive Weapon (p. 57): a final 15+ or an unmodified 9 against a target
       sheltering in a destructible piece brings it down, strips the cover from
       this very attack, and makes the hits bite one step harder. */
    var breach = null;
    if (!aux && (roll === 9 || total >= 15)) {
      var shelter = shelterOf(state, a, t);
      if (shelter && canDemolish(a, shelter)) {
        breach = shelter;
        dres = defenceAgainst(state, a, t, { noCover: true });
      }
    }

    var hits;
    if (roll === 0) hits = 0;
    else if (roll === 9) hits = Math.max(1, total - dres.value);
    else hits = Math.max(0, total - dres.value);

    log.push({
      t: 'shoot',
      text: a.label + (aux ? ' (auxiliary weapons)' : '') + (basic && !aux ? ' (Basic Firepower)' : '') +
        ' fires at ' + t.label + ' at ' + dist.toFixed(1) + '"' +
        (breach ? ' — and the ' + TERRAIN[breach.kind].name.toLowerCase() + ' comes apart' : ''),
      math: parts.map(fmtPart).join(', ') + ' = ' + total + ' vs Defence ' + dres.value +
        ' [' + dres.parts.map(function (p) { return p.label + ' ' + p.v; }).join(', ') + '] → ' +
        hits + ' hit' + (hits === 1 ? '' : 's')
    });
    var wreck = breach ? destroyTerrain(state, breach, log, a) : null;

    if (hits > 0 && isMachine(t)) {
      var dres2 = resolveDamage(t, hits, pierce);
      log.push({ t: 'hits', text: dres2.rolls.join(' · ') });
      applyDamage(state, t, dres2.damage, log, a);
      return { log: log, hits: hits, wreck: wreck };
    }
    var medicId = null;
    if (hits > 0) {
      var mod = 0;
      /* Undisciplined (p. 94): shooting at a Broken Rebel unit, or catching one in
         a crossfire, is worth +2 on the hit table rather than the usual +1. */
      var loose = undisciplined(t);
      if (status(t) === 'broken') mod += loose ? 2 : 1;
      if (crossfire) mod += loose ? 2 : 1;
      if (breach) mod += 1;
      // a solitaire scenario may make the OpFor easier to hurt (Protecting the VIP, p. 151)
      if (state.scen && state.scen.hitMod) mod += state.scen.hitMod(state, a, t) || 0;
      var res = resolveShootingHits(state, t, hits, mod, a);
      medicId = res.medic || null;
      // Incendiary doubles the suppression of the attack itself, before any
      // extra points that special rules add
      var burn = '';
      // Nerves of Steel, and the Rite of Shielding (p. 142), shrug off the extra points
      var steady = campFlag(t, 'nerves') || campFlag(t, 'shielding');
      if (has(a, 'Incendiary Ammunition') && !has(t, 'Battle Armour') && !steady) {
        var tk = terrainOf(state, t);
        if (tk !== 'open' && !TERRAIN[tk].shallow) {
          res.sp *= 2;
          burn = ' · Incendiary Ammunition: suppression doubled in ' + TERRAIN[tk].name.toLowerCase();
        }
      }
      var supp = has(a, 'Suppressive Fire') && !aux && !basic && !steady;
      if (supp) res.sp += 2;
      // Highly Irritating Venom: a Spore or Flying Bug's suppression bites one more (p. 124)
      if (res.sp > 0 && !aux && bugRanged(a) && doctrine(state, a.side, 'BC4') && !campFlag(t, 'shielding')) {
        res.sp += 1; res.notes.push('Highly Irritating Venom +1 SP');
      }
      log.push({ t: 'hits', text: res.rolls.join(' · ') + burn + (supp ? ' · Suppressive Fire +2 SP' : '') +
        (res.notes.length ? ' · ' + res.notes.join(' · ') : '') });
      applyResult(state, t, res, log, a);
    }
    // who answered a MEDIC! on this volley, so the board can show them at work
    return medicId ? { log: log, hits: hits, medic: medicId } : { log: log, hits: hits };
  }

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

  /* ---------- assault ---------- */
  // Vehicles and aircraft never charge; nothing can charge an aircraft.
  function canAssault(a, t) {
    // Overgrown bugs follow vehicle and aircraft rules, but may still assault (p. 116)
    if (isMachine(a) && !isOvergrown(a)) return false;
    // only Flying Infantry may assault aircraft, or other Flying Infantry
    if ((isFlying(t) || flyInf(t)) && !flyInf(a)) return false;
    // Cloaking System: charged only from 12" or closer
    if (has(t, 'Cloaking System') && a.x != null && t.x != null && unitDist(a, t) > 12) return false;
    // a Turret never leaves its pad
    if (hasOwn(a, 'Turret')) return false;
    return true;
  }

  function assault(state, a, t) {
    var log = [], wrecked = null;
    log.push({ t: 'assault', text: a.label + ' charges ' + t.label + ' — ' + unitDist(a, t).toFixed(1) + '" to contact.' });

    /* Martyrdom (Path of the Prophet, p. 113): before the first round is rolled,
       one of the Holy Warriors walks into the enemy and takes D3 of them with him.
       The unit takes no Suppression for the death. */
    function martyr(u, foe) {
      if (!doctrine(state, u.side, 'P1')) return;
      var p = BY_KEY[u.key];
      if (!p || p.group !== 'Holy Warriors' || u.models <= 1 || !foe.alive) return;
      u.models -= 1;
      var hits = d3();
      log.push({ t: 'assault', text: 'Martyrdom — one of ' + u.label + ' goes in alone. ' +
        hits + ' automatic hit' + (hits === 1 ? '' : 's') + ' on ' + foe.label + '.' });
      if (isMachine(foe)) {
        var dm = resolveDamage(foe, hits, false);
        log.push({ t: 'hits', text: dm.rolls.join(' · ') });
        applyDamage(state, foe, dm.damage, log, u);
      } else {
        var mr = resolveAssaultHits(foe, hits, 0, u);
        log.push({ t: 'hits', text: mr.rolls.join(' · ') });
        applyResult(state, foe, mr, log, u);
      }
    }

    /* "Death or Glory, Comrades!" (p. 94): the shout lands as the charge begins and
       every Suppression point goes with it. Defensive fire can still pin them. */
    var shout = a.sp ? deathOrGlory(state, a) : null;
    if (shout) {
      log.push({ t: 'rally', text: '"Death or Glory, Comrades!" — ' + shout.name + ' sends ' + a.label +
        ' in, and all ' + a.sp + ' Suppression falls away.' });
      a.sp = 0;
    }

    if (t.alive && status(t) === 'ready' && t.fp !== null && unitDist(a, t) <= t.range
      && canShoot(state, t, a, 'defensive', {})) {
      var df = shoot(state, t, a, 'defensive', {});
      df.log.forEach(function (l) { log.push(l); });
      if (!a.alive) return { log: log, ok: false, wreck: wrecked };
      var after = status(a);
      if (after !== 'ready') {
        log.push({ t: 'note', text: 'Defensive fire stops the charge — ' + a.label + ' is ' + after + ' and the assault fails.' });
        return { log: log, ok: false };
      }
    }

    /* Into base-to-base contact — against a garrison, up against its wall. A unit
       going at the next section of its own building stays where it is. */
    var held = t.bld ? { piece: t.bld, sec: t.sec || 0 } : null;
    if (a.bld) { /* already in contact, wall to wall */ }
    else if (held) {
      var q0 = sectionRect(t);
      var cx = clampTo(a.x, q0.x, q0.x + q0.w), cy = clampTo(a.y, q0.y, q0.y + q0.h);
      var ux = a.x - cx, uy = a.y - cy, ul = Math.hypot(ux, uy) || 1;
      a.x = cx + ux / ul * (UNIT_R + 0.05); a.y = cy + uy / ul * (UNIT_R + 0.05);
    } else {
      var v = Math.hypot(t.x - a.x, t.y - a.y) || 1;
      a.x = t.x - (t.x - a.x) / v * (2 * UNIT_R);
      a.y = t.y - (t.y - a.y) / v * (2 * UNIT_R);
    }

    martyr(a, t);
    if (!t.alive || !a.alive) return { log: log, ok: true, wreck: wrecked };
    martyr(t, a);
    if (!t.alive || !a.alive) return { log: log, ok: true, wreck: wrecked };

    var order = [{ atk: a, def: t }, { atk: t, def: a }];
    // ...but the enemy strikes first when those bugs are the ones charging
    if (bugGround(a) && doctrine(state, a.side, 'BP5')) {
      order.reverse();
      log.push({ t: 'note', text: 'Chitin Exoskeletons — ' + t.label + ' strikes first.' });
    }
    var ended = false;
    for (var o = 0; o < order.length && !ended; o++) {
      var pair = order[o];
      if (status(pair.atk) === 'broken') {
        log.push({ t: 'note', text: pair.atk.label + ' is broken and does not fight back.' });
        continue;
      }
      for (var r = 0; r < 3; r++) {
        if (!pair.atk.alive || !pair.def.alive) { ended = true; break; }
        var rd = assaultRound(state, pair.atk, pair.def, pair.atk === a ? 'attacker' : 'defender', r + 1);
        if (rd.wreck) wrecked = rd.wreck;
        rd.log.forEach(function (l) { log.push(l); });
        if (!pair.def.alive) { ended = true; break; }
        if (status(pair.def) === 'broken') {
          fallBack(state, pair.def, pair.atk, 2);
          log.push({ t: 'note', text: pair.def.label + ' breaks and falls back 2" — the assault ends.' });
          ended = true; break;
        }
      }
    }
    if (!ended && a.alive && t.alive) {
      if (a.bld) log.push({ t: 'note', text: 'Neither side breaks — ' + a.label + ' holds its own section.' });
      else {
        fallBack(state, a, t, 2);
        log.push({ t: 'note', text: 'Neither side breaks — ' + a.label + ' falls back 2".' });
      }
    }
    /* "If the attackers win, they occupy the building and the defenders leave it
       and fall back 2"" (p. 41). */
    if (held && a.alive && status(a) !== 'broken' && (!t.alive || t.bld !== held.piece) &&
      enterable(held.piece) && !occupant(state, held.piece, held.sec)) {
      if (!t.alive && t.bld) { t.bld = null; t.sec = null; }
      enterBuilding(state, a, held.piece, held.sec);
      log.push({ t: 'note', text: a.label + ' takes the building.' });
    }
    a.frenzyOwed = 0; t.frenzyOwed = 0;
    // Rite of Calmness (p. 142): the unit that won the assault sheds all its Suppression
    var beaten = function (u) { return !u.alive || status(u) === 'broken'; };
    var victor = beaten(t) && !beaten(a) ? a : beaten(a) && !beaten(t) ? t : null;
    if (victor && victor.sp && campFlag(victor, 'calmness')) {
      log.push({ t: 'rally', text: 'Rite of Calmness — ' + victor.label + ' sheds all ' + victor.sp + ' SP.' });
      victor.sp = 0;
    }
    return { log: log, ok: true, wreck: wrecked };
  }

  /* Sappers go in against a wall or a building with demolition charges: +4 on the
     first round, and a final 15+ or an unmodified 9 blows the cover in, so the
     defender loses it for that round and the hits land one step harder. */
  function sappingAt(state, atk, def, n) {
    if (n !== 1 || !has(atk, 'Sappers') || isMachine(def)) return false;
    return !!shelterOf(state, atk, def);             // in or behind something they can blow in
  }
  // the charge bonus against a piece of terrain: Sappers +4, anyone else +2 and
  // only against the scenario objective (p. 54)
  function chargeBonus(u, r) {
    if (has(u, 'Sappers')) return 4;
    return destructibleKind(r) === 'target' ? 2 : 0;
  }

  function assaultRound(state, atk, def, role, n) {
    var log = [], parts = [], total = 0;
    var roll = d10(); total = roll;
    parts.push({ label: 'D10', v: roll });
    total += atk.assault; parts.push({ label: 'Assault', v: atk.assault });
    if (doctrine(state, atk.side, 'T4')) { total += 1; parts.push({ label: 'Improved HTH Training', v: 1 }); }
    // Holy Fury (Path of the Prophet, p. 113): +2 in any assault, either way round
    if (doctrine(state, atk.side, 'P4')) { total += 2; parts.push({ label: 'Holy Fury', v: 2 }); }
    var sb = sizeBonus(atk.models);
    if (sb) { total += sb; parts.push({ label: atk.models + ' models', v: sb }); }
    if (isMachine(def) && (!isMachine(atk) || isOvergrown(atk)) && !has(def, 'Advanced Protection')) {
      total += 4; parts.push({ label: 'assaulting a vehicle', v: 4 });
    }
    var pheroA = pheromoneBonus(state, atk, def);
    if (pheroA) { total += pheroA; parts.push({ label: 'Pheromone Markers', v: pheroA }); }
    // Fierce Attacks: Flying Infantry +4 in the first round (p. 124)
    if (n === 1 && flyInf(atk) && doctrine(state, atk.side, 'BB4')) { total += 4; parts.push({ label: 'Fierce Attacks', v: 4 }); }
    // Metal-covered Talons: +2 against vehicles (p. 124)
    if (isMachine(def) && doctrine(state, atk.side, 'BP6')) { total += 2; parts.push({ label: 'Metal-covered Talons', v: 2 }); }
    var sapping = sappingAt(state, atk, def, n);
    if (sapping) { total += 4; parts.push({ label: 'Sappers', v: 4 }); }
    var breached = sapping && (roll === 9 || total >= 15);
    var wreck = null;
    if (breached) {
      var piece = shelterOf(state, atk, def);
      if (piece && isDestructible(piece)) wreck = destroyTerrain(state, piece, log, atk);
    }
    var dres = defenceAgainst(state, atk, def, { assault: true });
    var hits;
    if (roll === 0) hits = 0;
    else if (roll === 9) hits = Math.max(1, total - dres.value);
    else hits = Math.max(0, total - dres.value);
    // Rite of Frenzy (p. 142): the hits owed for the fallen land with this round
    var owed = atk.frenzyOwed || 0;
    if (owed) { hits += owed; atk.frenzyOwed = 0; parts.push({ label: 'Rite of Frenzy — owed hits', v: owed }); }
    log.push({
      t: 'round', text: 'Round ' + n + ' — ' + atk.label + ' (' + role + ')' +
        (breached ? ' — charges blow the cover in!' : ''),
      math: parts.map(fmtPart).join(', ') + ' = ' + total + ' vs Defence ' + dres.value +
        ' → ' + hits + ' hit' + (hits === 1 ? '' : 's')
    });
    if (hits > 0 && isMachine(def)) {
      // a machine in close combat: 1 bounces, 2-3 a point, 4-6 D3
      var out = { damage: 0, rolls: [] };
      for (var h = 0; h < hits; h++) {
        var r = d6(), tag;
        if (r === 1) tag = 'Bounced off the armour!';
        else if (r <= 3) { tag = 'Hull breached (1 DP)'; out.damage += 1; }
        else { var c = d3(); tag = 'Charge placed! (D3 ' + c + ' DP)'; out.damage += c; }
        out.rolls.push('D6 ' + r + ' → ' + tag);
      }
      log.push({ t: 'hits', text: out.rolls.join(' · ') });
      applyDamage(state, def, out.damage, log, atk);
    } else if (hits > 0) {
      var res = resolveAssaultHits(def, hits, breached ? 1 : 0, atk);
      log.push({ t: 'hits', text: res.rolls.join(' · ') +
        (res.notes.length ? ' · ' + res.notes.join(' · ') : '') });
      var fell = def.models;
      applyResult(state, def, res, log, atk);
      fell = Math.max(0, fell - def.models);
      /* Rite of Frenzy: for every one of them killed, D3-1 automatic hits on the
         enemy in the next round — unless the unit has broken. */
      if (fell && def.alive && campFlag(def, 'frenzy') && status(def) !== 'broken') {
        var fz = 0;
        for (var fi = 0; fi < fell; fi++) fz += d3() - 1;
        if (fz) { def.frenzyOwed = (def.frenzyOwed || 0) + fz; log.push({ t: 'note', text: 'Rite of Frenzy — ' + def.label + ' owes ' + fz + ' hit' + (fz > 1 ? 's' : '') + ' for its dead.' }); }
      }
    }
    /* What the swarm's campaign needs to know: which enemy units died in an
       assault, and which of those were human (Alternate Carbon-based Metabolism,
       Fungi Symbiosis, p. 124). */
    if (!def.alive && !def.fled) {
      atk.assaultKills = (atk.assaultKills || 0) + 1;
      if (def.faction !== 'bugs') atk.assaultKillsHuman = (atk.assaultKillsHuman || 0) + 1;
    }
    return { log: log, wreck: wreck };
  }

  function clampBoard(p) {
    p.x = Math.max(UNIT_R, Math.min(BOARD.w - UNIT_R, p.x));
    p.y = Math.max(UNIT_R, Math.min(BOARD.h - UNIT_R, p.y));
    return p;
  }

  function fallBack(state, u, from, inch) {
    // "the defenders leave it and fall back 2"" (p. 41): out through the far wall first
    if (u.bld) leaveAway(state, u, from);
    var vx = u.x - from.x, vy = u.y - from.y, len = Math.hypot(vx, vy) || 1;
    for (var s = inch; s >= 0.5; s -= 0.5) {
      var p = clampBoard({ x: u.x + vx / len * s, y: u.y + vy / len * s });
      if (!TERRAIN[terrainAt(state, p.x, p.y)].impassable && !unitNear(state, p.x, p.y, u, 0.2)) {
        u.x = p.x; u.y = p.y; return true;
      }
    }
    return false;
  }

  /* ---------- movement ---------- */
  // 16 directions, so lattice distance tracks a tape measure to about 1%
  var NEI = (function () {
    var out = [];
    for (var di = -2; di <= 2; di++) for (var dj = -2; dj <= 2; dj++) {
      if (!di && !dj) continue;
      if (Math.abs(di) === 2 && Math.abs(dj) !== 1) continue;
      if (Math.abs(dj) === 2 && Math.abs(di) !== 1) continue;
      out.push([di, dj]);
    }
    return out;
  })();

  // Dijkstra over a half-inch lattice: distance in inches plus 1" for entering
  // difficult terrain, so the reachable area is the real shape of the move.
  // how much a piece of ground costs this unit to enter, and whether it can at all
  /* Protectors in hi-mobility battle armour ("jump-pack powersuits", p. 65) go
     over the ground rather than through it: no terrain penalties, and they can
     clear walls, water, rocks and buildings — but they have to come down on
     ground they could stand on. Unlike Flying Infantry they still take cover
     where they land. */
  function jumps(u) { return !!(u && u.jets && u.cls === 'infantry'); }
  function terrainCost(u, kind) {
    var t = TERRAIN[kind];
    if (isFlying(u) || flyInf(u) || jumps(u)) return 0;   // aircraft, Flying Infantry and jump packs ignore the ground
    var pr = propOf(u);
    if (pr && pr.water && (t.shallow || kind === 'deep')) return 0;   // a hovercraft skims
    // a walker steps over what a hull has to grind through
    var heavy = u.cls === 'vehicle' && !(pr && pr.footed);
    // Riders (p. 94) lose 2" to rough going where a man on foot loses 1"
    // barbed wire: the extra D6" rolled before the move (p. 42), whatever is crossing
    if (t.wire) return u.wireRoll || 6;
    if (!heavy && hasOwn(u, 'Riders')) return t.movePenalty * 2;
    return t.movePenalty * (heavy ? 2 : 1);
  }
  function terrainBars(u, kind) {
    var t = TERRAIN[kind];
    if (isFlying(u) || flyInf(u) || jumps(u)) return false;
    /* Riders (p. 94) cannot cross a linear obstacle nor occupy a building: bikes,
       beasts and grav sleds go around. */
    if (hasOwn(u, 'Riders')) {
      if (kind === 'building' || kind === 'bunker' || kind === 'burning') return true;
      if (TERRAIN[kind].destructible === 'linear') return true;
    }
    // a vehicle cannot enter a building or cross a high wall either
    if (u.cls === 'vehicle' && (kind === 'building' || kind === 'bunker' || kind === 'burning')) return true;
    // ...though a Tier III-V hull simply drives through a wall and flattens it (p. 35)
    if (u.cls === 'vehicle' && u.tier >= 3 && TERRAIN[kind].destructible === 'linear') return false;
    var pr = propOf(u);
    // a hovercraft skims water and other liquids — but not hot lava
    if (pr && pr.water && kind === 'deep') return false;
    return t.impassable;
  }

  /* Movement penalty (p. 42): 1" (2" for a vehicle) "when crossing a section of
     linear terrain (cumulative – apply penalty for each crossed terrain) or
     moving into or through a piece of area terrain (not cumulative – apply only
     once, irrespective of the distance of the move in area terrain or
     terrains)". So the search runs on two layers — before and after the area
     penalty has been paid — and a unit that starts in area terrain is moving
     through it, so it has paid from the first step. */
  function field(state, u, allowance) {
    var cols = Math.round(BOARD.w / STEP) + 1, rows = Math.round(BOARD.h / STEP) + 1;
    var N = cols * rows;
    var idx = function (i, j) { return j * cols + i; };
    var i0 = Math.round(u.x / STEP), j0 = Math.round(u.y / STEP);
    var cost = new Float64Array(N * 2).fill(Infinity);
    var came = new Int32Array(N * 2).fill(-1);
    var terr = new Uint8Array(N);
    var kindIndex = {}; var kinds = Object.keys(TERRAIN);
    kinds.forEach(function (k, n) { kindIndex[k] = n; });
    // a section of wire crossed costs the D6 rolled for this move
    if (u.wireRoll == null && !isFlying(u) && !flyInf(u) && !jumps(u) && state.terrain.some(function (r) { return r.kind === 'wire'; })) {
      u.wireRoll = d6();
    }

    function kindAt(i, j) {
      var k = idx(i, j);
      if (terr[k] === 0) terr[k] = 1 + kindIndex[terrainAt(state, i * STEP, j * STEP)];
      return kinds[terr[k] - 1];
    }
    function blockedBy(i, j) {
      var x = i * STEP, y = j * STEP;
      if (x < UNIT_R || y < UNIT_R || x > BOARD.w - UNIT_R || y > BOARD.h - UNIT_R) return true;
      if (terrainBars(u, kindAt(i, j))) return true;
      for (var n = 0; n < state.units.length; n++) {
        var o = state.units[n];
        if (!o.alive || o === u || o.side === u.side || o.aboard || o.x < 0) continue;
        if (o.bld ? rectPointDist(sectionRect(o), x, y) < UNIT_R + 1 : Math.hypot(o.x - x, o.y - y) < 2 * UNIT_R + 1) return true;   // stay 1" clear of the enemy
      }
      return false;
    }
    var linear = function (k) { return !!TERRAIN[k].linear; };
    var area = function (k) { return !TERRAIN[k].linear && terrainCost(u, k) > 0; };

    var k0 = kindAt(i0, j0), startPaid = area(k0) ? 1 : 0;
    var heap = [{ i: i0, j: j0, p: startPaid, c: startPaid ? terrainCost(u, k0) : 0 }];
    cost[idx(i0, j0) * 2 + startPaid] = heap[0].c;
    var seen = [];
    while (heap.length) {
      var bi = 0;
      for (var h = 1; h < heap.length; h++) if (heap[h].c < heap[bi].c) bi = h;
      var cur = heap.splice(bi, 1)[0];
      var ck = idx(cur.i, cur.j) * 2 + cur.p;
      if (cur.c > cost[ck]) continue;
      seen.push(cur);
      for (var n = 0; n < NEI.length; n++) {
        var di = NEI[n][0], dj = NEI[n][1];
        var ni = cur.i + di, nj = cur.j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        if (blockedBy(ni, nj)) continue;
        var mi = cur.i + Math.round(di / 2), mj = cur.j + Math.round(dj / 2);
        if ((Math.abs(di) > 1 || Math.abs(dj) > 1) && blockedBy(mi, mj)) continue;
        var step = STEP * Math.hypot(di, dj), paid = cur.p;
        var k1 = kindAt(cur.i, cur.j), k2 = kindAt(ni, nj), km = kindAt(mi, mj);
        // a linear piece is paid for every time it is crossed: on stepping onto it
        if (linear(k2) && k2 !== k1) step += terrainCost(u, k2);
        else if (linear(km) && km !== k1 && km !== k2) step += terrainCost(u, km);
        // area terrain once in the whole move
        if (!paid && (area(k2) || area(km))) { step += terrainCost(u, area(k2) ? k2 : km); paid = 1; }
        var nc = cur.c + step;
        if (nc > allowance + 1e-6) continue;
        var nk = idx(ni, nj) * 2 + paid;
        if (nc < cost[nk]) {
          cost[nk] = nc;
          came[nk] = ck;
          heap.push({ i: ni, j: nj, p: paid, c: nc });
        }
      }
    }
    // the cheaper of the two layers, for each point on the table
    var best = new Float64Array(N);
    for (var q = 0; q < N; q++) best[q] = Math.min(cost[q * 2], cost[q * 2 + 1]);
    var seenOnce = [], mark = new Uint8Array(N);
    seen.forEach(function (sn) {
      var k = idx(sn.i, sn.j);
      if (mark[k]) return;
      mark[k] = 1; seenOnce.push({ i: sn.i, j: sn.j, c: best[k] });
    });
    return { cols: cols, rows: rows, cost: best, layered: cost, came: came, seen: seenOnce, idx: idx };
  }

  /* "Vehicles move in straight lines, and may make turns by reducing the range of
     their movement ... the number in brackets next to the Movement parameter of a
     vehicle is the cost of a single turn of up to 90°" (p. 35). So a hull pays
     one turn to come round between 45° and 135° off its heading, and two to come
     round further than that — reversing its front costs it twice.

     The same page lets it go backwards instead: "vehicles may move backwards in
     a straight line, but their movement distance is halved when doing so". That
     needs no turn at all, so for ground behind the hull the cheaper of the two
     is what it actually does. `driveCost` answers both together. */
  function turnsTo(u, x, y) {
    var f = u.facing == null ? 0 : u.facing;
    var d = Math.atan2(y - u.y, x - u.x) - f;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    d = Math.abs(d);
    if (d <= Math.PI / 4) return 0;                    // inside the front quarter
    if (d <= Math.PI * 3 / 4) return 1;                // a quarter turn either way
    return 2;                                          // about face
  }
  function turnToll(u, x, y) {
    if (!u || u.cls !== 'vehicle' || !u.turn) return 0;
    return turnsTo(u, x, y) * u.turn;
  }
  /* What a given destination really costs this unit: for infantry, the ground it
     walks over; for a vehicle, that plus its turns — or, if the ground is behind
     it, twice the distance driven in reverse with no turn at all. */
  function driveCost(u, x, y, ground) {
    if (!u || u.cls !== 'vehicle') return ground;
    var forward = ground + turnToll(u, x, y);
    if (!u.turn || turnsTo(u, x, y) < 2) return forward;
    // an about-face: reversing in a straight line may well be cheaper
    return Math.min(forward, ground * 2);
  }

  function reachable(state, u, allowance) {
    var f = field(state, u, allowance), out = [];
    f.seen.forEach(function (n) {
      var x = n.i * STEP, y = n.j * STEP;
      if (unitNear(state, x, y, u, 1)) return;      // must finish at least 1" from other units
      // Flying Infantry and jump troops go over impassable ground but cannot land on it
      if ((flyInf(u) || jumps(u)) && TERRAIN[terrainAt(state, x, y)].impassable) return;
      var ground = f.cost[f.idx(n.i, n.j)];
      var real = driveCost(u, x, y, ground);
      if (real > allowance) return;
      out.push({ x: x, y: y, cost: ground, spent: real, turns: u.cls === 'vehicle' ? turnsTo(u, x, y) : 0,
        reverse: u.cls === 'vehicle' && real < ground + turnToll(u, x, y) });
    });
    return out;
  }

  // the route the unit actually takes, for showing the move
  function pathTo(state, u, allowance, target) {
    var f = field(state, u, allowance);
    var ti = Math.round(target.x / STEP), tj = Math.round(target.y / STEP);
    var k0 = f.idx(ti, tj);
    if (!isFinite(f.cost[k0])) return [{ x: u.x, y: u.y }, { x: target.x, y: target.y }];
    var k = f.layered[k0 * 2] <= f.layered[k0 * 2 + 1] ? k0 * 2 : k0 * 2 + 1;
    var pts = [], guard = 0;
    while (k >= 0 && guard++ < 4000) {
      var cell = k >> 1, i = cell % f.cols, j = Math.floor(cell / f.cols);
      pts.push({ x: i * STEP, y: j * STEP });
      k = f.came[k];
    }
    pts.reverse();
    // thin it out: keep the corners, drop points on a straight run
    var out = [pts[0]];
    for (var n = 1; n < pts.length - 1; n++) {
      var a2 = out[out.length - 1], b2 = pts[n], c2 = pts[n + 1];
      var cross = (b2.x - a2.x) * (c2.y - a2.y) - (b2.y - a2.y) * (c2.x - a2.x);
      if (Math.abs(cross) > 0.01) out.push(b2);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

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

  function rally(state, u) {
    if (u.sp === 0) return null;
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

  root.PMC = {
    BOARD: BOARD, UNIT_R: UNIT_R, STEP: STEP,
    CATALOGUE: CATALOGUE, PRESETS: PRESETS, PRESETS_REBEL: PRESETS_REBEL,
    COMPOSITION: COMPOSITION, COMPOSITION_BUGS: COMPOSITION_BUGS, compFor: compFor, isOvergrown: isOvergrown, ROMAN: ROMAN, FACTIONS: FACTIONS, TACTICS: TACTICS,
    presetsFor: presetsFor, listFor: listFor, factionOf: factionOf, tacticById: tacticById,
    applyRiders: applyRiders, canRide: canRide, freedomDice: freedomDice,
    undisciplined: undisciplined, freeLosses: freeLosses, deathOrGlory: deathOrGlory,
    dugIn: dugIn, shotRange: shotRange, shotMinRange: shotMinRange,
    profile: function (k) { return BY_KEY[k]; },
    checkArmy: checkArmy, rollArmy: rollArmy, TERRAIN: TERRAIN,
    d10: d10, d6: d6, d3: d3,
    inches: inches, unitDist: unitDist, centreDist: centreDist, hasLoS: hasLoS, lineClear: lineClear,
    isXeno: isXeno, xenoSenses: xenoSenses, sightRange: sightRange, tribeSees: tribeSees, tribeSeers: tribeSeers, shieldFor: shieldFor, jammedNearby: jammedNearby, inspiringNearby: inspiringNearby, bondMorale: bondMorale, psychicBond: psychicBond, regainTargets: regainTargets, regainControl: regainControl, selfRepair: selfRepair, teleportFrom: teleportFrom, teleportPads: teleportPads, teleportRoll: teleportRoll, teleport: teleport, isMedic: isMedic, alienHull: alienHull,
    terrainAt: terrainAt, terrainOf: terrainOf, inRect: inRect, segRect: segRect,
    groundLevel: groundLevel, levelOf: levelOf,
    inPoly: inPoly, pieceDepth: pieceDepth, shapePiece: shapePiece, SHAPED: SHAPED, placePiece: placePiece, jumps: jumps, turnPiece: turnPiece, turnPoint: turnPoint,
    enterable: enterable, sectionsOf: sectionsOf, sectionRect: sectionRect, sectionHigh: sectionHigh, occupant: occupant,
    canGarrison: canGarrison, enterTargets: enterTargets, enterBuilding: enterBuilding, exitSpots: exitSpots,
    exitBuilding: exitBuilding, leaveAway: leaveAway, rectPointDist: rectPointDist, onHill: onHill,
    unitNear: unitNear, clampBoard: clampBoard, pointSegDist: pointSegDist,
    has: has, ruleValue: ruleValue, currentMorale: currentMorale, status: status,
    projects: projects, markCall: markCall, holdsGround: holdsGround, countsForVictory: countsForVictory,
    sizeBonus: sizeBonus, addSP: addSP, coverFor: coverFor, defenceAgainst: defenceAgainst,
    canShoot: canShoot, shoot: shoot, assault: assault, reachable: reachable, pathTo: pathTo,
    turnToll: turnToll, turnsTo: turnsTo, driveCost: driveCost,
    rally: rally, fallBack: fallBack, medicNearby: medicNearby,
    isMachine: isMachine, isFlying: isFlying, flyInf: flyInf, overmindFor: overmindFor, overmindReach: overmindReach, bugRanged: bugRanged, bugGround: bugGround, pheromoneBonus: pheromoneBonus, aggressiveNow: aggressiveNow, endlessTide: endlessTide, psychicWave: psychicWave, weaponStyle: weaponStyle, weaponSpec: weaponSpec, WEAPONS: WEAPONS, arcOf: arcOf, inFireArc: inFireArc,
    resolveDamage: resolveDamage, applyDamage: applyDamage, repair: repair,
    canAssault: canAssault, canEmbark: canEmbark, embark: embark, disembark: disembark,
    terrainCost: terrainCost, terrainBars: terrainBars,
    canHack: canHack, hack: hack, commandAboard: commandAboard,
    steadyShooter: steadyShooter, steadyTargets: steadyTargets, steadyFire: steadyFire,
    hasExact: hasExact, antiTank: antiTank,
    campFlag: campFlag, doctrine: doctrine, unitDoc: unitDoc, credit: credit,
    isDestructible: isDestructible, destructibleKind: destructibleKind, shelterOf: shelterOf,
    canDemolish: canDemolish, canCharge: canCharge, destroyTerrain: destroyTerrain, chargeBonus: chargeBonus,
    shootTerrain: shootTerrain, assaultTerrain: assaultTerrain, detonate: detonate, crushOnMove: crushOnMove,
    resolveShootingHits: resolveShootingHits, resolveAssaultHits: resolveAssaultHits,
    applyDrone: applyDrone, canBeDrone: canBeDrone, MOUNTS: MOUNTS, MOUNT_ORDER: MOUNT_ORDER, canMount: canMount,
    shotMods: shotMods, shotOdds: shotOdds, assaultOdds: assaultOdds,
    PROPULSION: PROPULSION, PROP_ORDER: PROP_ORDER, splitPick: splitPick, joinPick: joinPick,
    propsFor: propsFor, propOf: propOf, applyPropulsion: applyPropulsion,
    defaultDrive: defaultDrive, DEFAULT_DRIVE: DEFAULT_DRIVE,
    soldierName: soldierName, rankFor: rankFor, crewed: crewed, musterMen: musterMen, syncMen: syncMen, counted: counted, survivors: survivors, biomassOf: biomassOf
  };
})(window);
