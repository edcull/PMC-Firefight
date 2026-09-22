/* Every PMC infantry profile, typed out again from the rulebook tables
   (pp. 62-71, 79) and compared against what the game actually holds.
   Columns: name, Tier, Size, Move, FP, Range, Def[/pierced], Assault, Morale, rules. */
global.window = global;
require('../../src/rules/rules.js');
var R = global.PMC;

var BOOK = [
  // Basic troops, p. 62
  ['Recruits', 1, 8, 4, 1, 18, '8', 1, 3, ''],
  ['Enforcers', 1, 6, 3, 2, 12, '9', 3, 3, ''],
  ['Irregular troops', 1, 8, 6, 2, 12, '7', 2, 3, ''],
  ['Penal troops', 1, 8, 5, 1, 12, '6', 2, 3, 'Determined, Expendable'],
  // Rifle infantry, p. 63
  ['Rookie rifle team', 2, 8, 4, 2, 18, '9', 2, 4, ''],
  ['Regular rifle team', 3, 8, 5, 3, 18, '10', 3, 5, ''],
  ['Veterans', 4, 8, 5, 4, 18, '11', 3, 5, ''],
  ['Rangers', 5, 8, 5, 4, 18, '11', 4, 5, 'Determined'],
  // Assault troops, p. 64
  ['Light engineer team', 2, 8, 6, 3, 12, '8', 3, 4, 'Sappers'],
  ['Assault engineer team', 3, 8, 5, 4, 12, '10', 4, 5, 'Sappers'],
  ['Shock troopers', 4, 8, 5, 4, 12, '10', 5, 5, 'Sappers, Destructive Weapon'],
  ['Commandos', 5, 8, 5, 5, 12, '11', 6, 5, 'Determined, Sappers, Destructive Weapon'],
  // Heavy infantry, p. 65
  ['Economy-class BATs', 2, 4, 3, 3, 12, '11/9', 3, 4, 'Battle Armour, Anti-tank (limited)'],
  ['Battle armour troopers', 3, 4, 3, 4, 18, '12/10', 4, 5, 'Battle Armour, Anti-tank (limited)'],
  ['Protectors', 4, 4, 3, 4, 18, '13/11', 5, 5, 'Battle Armour, Anti-tank (limited), Determined'],
  ['Protectors hi-mobility', 5, 4, 7, 4, 18, '13/11', 5, 5, 'Battle Armour, Anti-tank (limited), Determined'],
  // Light infantry, p. 66
  ['Forward observers', 2, 4, 5, 3, 18, '8', 2, 3, 'Markerlights, Stealth'],
  ['Sharpshooters', 3, 4, 5, 4, 24, '8', 2, 3, 'Markerlights, Stealth, Suppressive Fire, Keen-Eyed'],
  ['LRRP team', 4, 4, 5, 4, 24, '8', 2, 4, 'Markerlights, Stealth, Gauss Weapon, Keen-Eyed, Suppressive Fire, Battlefield Insertion'],
  ['Sniper team', 5, 2, 5, 6, 30, '8', 2, 4, 'Markerlights, Stealth, Cumbersome Weapon, Keen-Eyed, Gauss Weapon, Suppressive Fire, Battlefield Insertion'],
  // Light support, p. 67
  ['Light MG section', 2, 3, 4, 5, 24, '8', 1, 3, ''],
  ['Light MG team', 3, 6, 4, 5, 24, '8', 1, 4, ''],
  ['Heavy MG team', 4, 3, 3, 5, 30, '9', 1, 5, 'Cumbersome Weapon, Suppressive Fire'],
  ['Gauss cannon', 5, 3, 3, 6, 30, '9', 1, 5, 'Specialisation (ground), Cumbersome Weapon, Destructive Weapon, Gauss Weapon, Anti-tank'],
  // Heavy support, p. 68
  ['Light anti-tank team', 2, 4, 5, 4, 12, '8', 1, 3, 'Anti-tank'],
  ['Anti-tank team', 3, 4, 4, 5, 18, '9', 1, 4, 'Destructive Weapon, Minimum Range (6), Anti-tank'],
  ['Missile-armed team', 4, 4, 3, 6, 30, '9', 1, 4, 'Destructive Weapon, Cumbersome Weapon, Minimum Range (6), Indirect Fire, Anti-tank'],
  ['SAM team', 3, 4, 3, 6, 30, '9', 1, 4, 'Specialisation (air), Cumbersome Weapon, Indirect Fire, Anti-aircraft'],
  // Remote mortars, p. 69
  ['Remote mortar section', 1, 2, 3, 3, 48, '7', 1, 3, 'Cumbersome Weapon, Indirect Fire, Destructive Weapon, Minimum Range (12), Specialisation (ground), Suppressive Fire'],
  ['Remote mortar team', 2, 4, 3, 3, 48, '7', 1, 4, 'Cumbersome Weapon, Indirect Fire, Destructive Weapon, Minimum Range (12), Specialisation (ground), Suppressive Fire'],
  ['Remote mortar battery', 3, 8, 3, 3, 48, '7', 1, 5, 'Cumbersome Weapon, Indirect Fire, Destructive Weapon, Minimum Range (12), Specialisation (ground), Suppressive Fire'],
  // Command, pp. 70-71
  ['Field command 4th grade', 1, 2, 5, 1, 12, '10', 1, 4, 'Inspiring Presence'],
  ['Field command 3rd grade', 2, 2, 5, 1, 12, '10', 1, 5, 'Command Unit (2), Inspiring Presence'],
  ['Field command 2nd grade', 3, 4, 5, 1, 12, '10', 1, 5, 'Command Unit (3), Inspiring Presence, Markerlights'],
  ['Field command 1st grade', 4, 6, 5, 1, 12, '10', 1, 5, 'Command Unit (3), Inspiring Presence, Markerlights, Hackers'],
  ['High command', 5, 8, 5, 1, 12, '10', 1, 5, 'Command Unit (4), Inspiring Presence, Markerlights, Counter-jamming, Hackers'],
  // EW and medics, p. 71
  ['EW team', 3, 2, 5, 1, 12, '9', 1, 4, 'Jammers, Counter-jamming, Hackers'],
  ['Medic teams', 3, 4, 5, 1, 12, '9', 1, 4, 'Field Medics'],
  // Unclassified, p. 79
  ['Nomads', 2, 8, 5, 2, 12, '7', 3, 3, 'Stealth, Battlefield Insertion'],
  ['Chem-warriors', 3, 4, 4, 8, 12, '8', 5, 4, 'Specialisation (ground), Incendiary Ammo, Suppressive Fire, Always Basic Firepower']
];

var bad = 0;
var PMCONLY = R.listFor('pmc');
console.log('PMC profiles in the game:', PMCONLY.length, '— rows from the book:', BOOK.length);
BOOK.forEach(function (row) {
  var p = R.CATALOGUE.filter(function (x) { return x.name === row[0]; })[0];
  if (!p) { console.log('MISSING', row[0]); bad++; return; }
  var def = p.def + (p.defPierced ? '/' + p.defPierced : '');
  var got = [p.name, p.tier, p.size, p.move, p.fp, p.range, def, p.assault, p.morale];
  for (var i = 1; i < got.length; i++) {
    if (String(got[i]) !== String(row[i])) {
      console.log('MISMATCH', p.name, 'column', i, 'book', row[i], 'game', got[i]);
      bad++;
    }
  }
  // rules, ignoring the book's shorthand for Incendiary
  var want = row[9] ? row[9].split(', ').map(function (r) { return r.replace('Incendiary Ammo', 'Incendiary Ammunition'); }) : [];
  var have = p.rules.slice();
  want.forEach(function (r) {
    if (have.indexOf(r) < 0) { console.log('RULE MISSING', p.name, '->', r); bad++; }
  });
  have.forEach(function (r) {
    if (want.indexOf(r) < 0) { console.log('RULE EXTRA', p.name, '->', r); bad++; }
  });
});

/* Every PMC vehicle and aircraft profile, typed out again from the rulebook
   (pp. 73-82). Columns: name, Tier, Move, turn, FP, Range, Def, Assault, Structure, rules. */
var MACHINES = [
  // Combat vehicles, pp. 73-74
  ['Light patrol vehicle', 1, 12, 1, 3, 12, 8, 1, 3, 'Ground vehicle'],
  ['Heavy patrol vehicle', 2, 12, 1, 6, 18, 10, 2, 4, 'Ground vehicle'],
  ['Recon vehicle', 3, 12, 1, 6, 24, 12, 3, 5, 'Ground vehicle, Markerlights'],
  ['Light combat vehicle', 3, 10, 1, 7, 24, 13, 5, 6, 'Ground vehicle'],
  ['Medium combat vehicle', 4, 8, 2, 8, 24, 15, 5, 7, 'Ground vehicle, Destructive Weapon, Specialisation (ground)'],
  ['Advanced combat vehicle', 5, 10, 2, 9, 24, 15, 5, 7, 'Ground vehicle, Destructive Weapon, Specialisation (ground), Advanced Protection'],
  // Hunters and destroyers, p. 75
  ['Light hunter', 2, 14, 1, 4, 12, 9, 2, 4, 'Ground vehicle, Anti-tank, Specialisation (ground)'],
  ['Hunter', 3, 14, 1, 5, 18, 11, 4, 5, 'Ground vehicle, Anti-tank, Specialisation (ground)'],
  ['Light destroyer', 4, 8, 1, 8, 30, 10, 1, 4, 'Ground vehicle, Limited Fire Arc, Destructive Weapon, Specialisation (ground), Anti-tank, Cumbersome Weapon'],
  ['Medium destroyer', 5, 8, 2, 9, 30, 11, 2, 5, 'Ground vehicle, Limited Fire Arc, Destructive Weapon, Specialisation (ground), Anti-tank, Cumbersome Weapon'],
  // Transport vehicles, pp. 75-76
  ['Unarmoured transport', 1, 10, 1, 1, 12, 6, 1, 3, 'Ground vehicle, Transport (1)'],
  ['Light transport', 2, 12, 1, 3, 12, 9, 2, 3, 'Ground vehicle, Transport (2)'],
  ['Light APC', 3, 10, 1, 3, 18, 12, 2, 5, 'Ground vehicle, Transport (2)'],
  ['Light IFV', 3, 10, 1, 6, 24, 12, 4, 5, 'Ground vehicle, Transport (1), Supporting Fire'],
  ['Command Vehicle', 3, 10, 1, 2, 18, 13, 2, 5, 'Ground vehicle, Transport (1), Command Vehicle'],
  ['Heavy APC', 4, 8, 1, 3, 18, 13, 3, 7, 'Ground vehicle, Transport (4), Advanced Protection'],
  ['Heavy IFV', 4, 8, 1, 6, 24, 13, 5, 7, 'Ground vehicle, Transport (2), Supporting Fire, Advanced Protection'],
  // Engineering, support, AA, EW and medical, pp. 77-79
  ['Light engineering vehicle', 3, 10, 1, 8, 12, 13, 5, 5, 'Ground vehicle, Specialisation (ground), Incendiary Ammunition, Suppressive Fire, Always Basic Firepower'],
  ['Heavy engineering vehicle', 4, 6, 2, 10, 12, 15, 5, 8, 'Ground vehicle, Destructive Weapon, Specialisation (ground), Advanced Protection'],
  ['Improvised support vehicle', 2, 8, 2, 6, 30, 8, 1, 3, 'Ground vehicle, Minimum Range (12), Destructive Weapon, Indirect Fire, Specialisation (ground), Cumbersome Weapon'],
  ['Light support vehicle', 3, 8, 2, 8, 48, 10, 2, 4, 'Ground vehicle, Minimum Range (12), Destructive Weapon, Indirect Fire, Specialisation (ground), Cumbersome Weapon'],
  ['Medium support vehicle', 4, 6, 2, 9, 48, 11, 3, 4, 'Ground vehicle, Minimum Range (12), Destructive Weapon, Indirect Fire, Specialisation (ground), Cumbersome Weapon'],
  ['Advanced support vehicle', 5, 6, 2, 10, 60, 11, 4, 5, 'Ground vehicle, Minimum Range (12), Destructive Weapon, Indirect Fire, Specialisation (ground), Cumbersome Weapon'],
  ['Anti-aircraft vehicle', 3, 8, 2, 6, 48, 10, 3, 4, 'Ground vehicle, Indirect Fire, Specialisation (air), Anti-aircraft'],
  ['EW vehicle', 3, 10, 1, 3, 18, 12, 2, 5, 'Ground vehicle, Jammers, Counter-jamming, Hackers, Keen-Eyed'],
  ['Medical vehicle', 3, 10, 1, 3, 18, 12, 2, 5, 'Ground vehicle, Field Medics'],
  // Transport aircraft, p. 80
  ['Adapted transport craft', 2, 16, null, 2, 18, 8, 1, 3, 'Flying unit, Transport (1), Limited Fire Arc'],
  ['Light transport craft', 3, 20, null, 2, 18, 11, 1, 4, 'Flying unit, Transport (1), Limited Fire Arc'],
  ['Heavy transport craft', 4, 18, null, 2, 18, 12, 1, 5, 'Flying unit, Transport (2), Limited Fire Arc'],
  ['Flying command post', 5, 24, null, 2, 18, 13, 1, 6, 'Flying unit, Transport (1), Limited Fire Arc, Command Vehicle'],
  // Strike aircraft, pp. 81-82
  ['Flexible Strike Craft', 3, 24, null, 7, 18, 12, 1, 4, 'Flying unit, Limited Fire Arc'],
  ['Transport-Strike Craft', 4, 20, null, 6, 18, 12, 1, 4, 'Flying unit, Limited Fire Arc, Transport (1), Supporting Fire'],
  ['Gunboat', 4, 12, null, 9, 18, 13, 1, 5, 'Flying unit, Incendiary Ammunition'],
  ['Heavy Strike Craft', 5, 16, null, 9, 18, 13, 1, 5, 'Flying unit, Limited Fire Arc, Anti-tank'],
  ['Interceptor', 4, 28, null, 6, 24, 11, 1, 3, 'Flying unit, Limited Fire Arc, Anti-aircraft'],
  ['Advanced Strike Craft', 5, 24, null, 9, 18, 13, 1, 4, 'Flying unit, Limited Fire Arc'],
  /* Rapid insertion platforms, p. 79. The book prints no Tier, no Movement, no
     Firepower, no Range and no Assault — an immobile Ground vehicle with
     Transport (1), Battlefield insertion, Defence 13 and Structure 3, costing one
     composition point and starting the game with an infantry unit aboard. */
  ['Rapid insertion platform', 1, 0, 0, null, 0, 13, 0, 3,
    'Ground vehicle, Transport (1), Battlefield Insertion, Immobile, No Objectives']
];

var machines = PMCONLY.filter(function (p) { return p.cls !== 'infantry'; });
console.log('PMC machines in the game:', machines.length, '- rows from the book:', MACHINES.length);
if (machines.length !== MACHINES.length) { console.log('COUNT MISMATCH'); bad++; }
MACHINES.forEach(function (row) {
  var p = R.CATALOGUE.filter(function (x) { return x.name === row[0]; })[0];
  if (!p) { console.log('MISSING', row[0]); bad++; return; }
  var got = [p.name, p.tier, p.move, p.turn === undefined ? null : p.turn, p.fp, p.range, p.def, p.assault, p.str];
  for (var i = 1; i < got.length; i++) {
    if (String(got[i]) !== String(row[i])) {
      console.log('MISMATCH', p.name, 'column', i, 'book', row[i], 'game', got[i]); bad++;
    }
  }
  var want = row[9].split(', '), have = p.rules.slice();
  want.forEach(function (r) { if (have.indexOf(r) < 0) { console.log('RULE MISSING', p.name, '->', r); bad++; } });
  have.forEach(function (r) { if (want.indexOf(r) < 0) { console.log('RULE EXTRA', p.name, '->', r); bad++; } });
  // Transport (X) has to match the carrying capacity the game uses
  var tr = (row[9].match(/Transport \((\d)\)/) || [0, 0])[1] | 0;
  if ((p.transport || 0) !== tr) { console.log('TRANSPORT', p.name, 'book', tr, 'game', p.transport || 0); bad++; }
  // every machine needs a hull to draw
  if (!p.art) { console.log('NO ART', p.name); bad++; }
});

/* the composition table, p. 60 */
var TABLE = {
  1: [6, '3+', '0-1', '-', '-', '-'],
  2: [12, '0-4', '3+', '0-2', '0-1', '-'],
  3: [18, '0-4', '0-4', '3+', '0-2', '0-1'],
  4: [24, '-', '0-4', '0-4', '3+', '0-2'],
  5: [30, '-', '-', '0-4', '0-4', '3+']
};
Object.keys(TABLE).forEach(function (bt) {
  var row = TABLE[bt], comp = R.COMPOSITION[bt];
  if (comp.points !== row[0]) { console.log('POINTS', bt, 'book', row[0], 'game', comp.points); bad++; }
  for (var t = 1; t <= 5; t++) {
    var lim = comp.limits[t - 1];
    var txt = lim[1] === 99 ? lim[0] + '+' : (lim[0] === 0 && lim[1] === 0 ? '-' : lim[0] + '-' + lim[1]);
    if (txt !== row[t]) { console.log('LIMIT BT' + bt + ' Tier' + t, 'book', row[t], 'game', txt); bad++; }
  }
});

/* the builder should accept legal armies and refuse illegal ones */
var checks = 0, wrong = 0;
for (var bt = 1; bt <= 5; bt++) {
  for (var pl = 1; pl <= 2; pl++) {
    for (var n = 0; n < 40; n++) {
      var army = R.rollArmy(bt, pl);
      var c = R.checkArmy(army, bt, pl);
      checks++;
      if (!c.ok) { wrong++; if (wrong < 4) console.log('rolled an illegal army at BT' + bt + ' PL' + pl + ':', c.faults.join(' ')); }
    }
    // one over budget, one short of the battle tier
    var over = R.rollArmy(bt, pl).concat(['veterans', 'veterans', 'veterans', 'veterans', 'veterans']);
    if (R.checkArmy(over, bt, pl).ok) { console.log('accepted an over-budget army at BT' + bt); wrong++; }
    if (R.checkArmy(['cmd2'], bt, pl).ok) { console.log('accepted a one-unit army at BT' + bt); wrong++; }
    checks += 2;
  }
}
console.log('legality checks:', checks, '— wrong:', wrong);
console.log(bad ? bad + ' PROFILE OR TABLE MISMATCHES' : 'every profile and the composition table match the book');
