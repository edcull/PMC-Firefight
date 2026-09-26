/* PMC 2670 — Firefight
   Campaign rules (rulebook pp. 83-91). PMC companies only.

   This file is pure: no DOM, no storage, no randomness beyond the dice it is asked
   to roll. Everything here can be exercised from node, and `camp.js` does exactly
   that. The dossier is a plain object; see SHAPE below.

   SHAPE
     Campaign { v, id, name, created, turn, mode, companies:{A,B}, log:[] }
     Company  { name, colour, tier, aspiring, kUC, doctrines:[], doctrineSwapAt,
                roster:[RosterUnit], cmdRid, record:{battles,wins,draws,losses} }
     RosterUnit { rid, key, prop, drone, name, exp, tp, honours:[], traumas:[],
                  upgrades:[], free, restUntil, lastBattle, history:[] }
*/
(function (root) {
  'use strict';

  var R = root.PMC;
  var VERSION = 1;

  function d6() { return R.d6(); }
  function d3() { return R.d3(); }
  function d10() { return 1 + Math.floor(Math.random() * 10); }   // reads 1-10 here
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    var out = a.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = out[i];
      out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* ================= doctrines (pp. 87-88) =================
     `where` says when the doctrine bites, so the UI can tell the player whether
     choosing it changes the contract screen, the army list, or the battle itself. */
  var DOCTRINES = [
    /* --- strategic --- */
    { id: 'S1', cat: 'Strategic', name: 'The Best Defence is Good Offence', where: 'contract',
      text: 'When the company becomes the defender in any scenario, it may roll a D6: on a 2-6 it becomes the attacker instead. No effect if the opponent has this doctrine too.' },
    { id: 'S2', cat: 'Strategic', name: 'Tough Negotiators', where: 'payment',
      text: 'May re-roll up to half the payment dice, rounding up, after both sides have rolled. The second result stands even if it is worse.' },
    { id: 'S3', cat: 'Strategic', name: 'Mental Training', where: 'aftermath',
      text: 'Units take a Battle Trauma every 15 Trauma Points instead of every 10.' },
    { id: 'S4', cat: 'Strategic', name: 'On Our Terms...', where: 'contract',
      text: 'May raise or lower the rolled Battle Tier by one, but never above the maximum.' },
    { id: 'S5', cat: 'Strategic', name: 'PR Masters', where: 'aftermath',
      text: 'Draws count as victories. Units take no Trauma Point for being routed — the point for losing the battle still applies.' },
    { id: 'S6', cat: 'Strategic', name: 'Rapid Training Methods', where: 'aftermath',
      text: 'The first Battle Honour for each infantry unit costs 5 EXP instead of 10.' },
    /* --- operational --- */
    { id: 'O1', cat: 'Operational', name: 'Air Superiority', where: 'list',
      text: 'The company may field one aircraft more than normally allowed.' },
    { id: 'O2', cat: 'Operational', name: 'Non-conventional Army', where: 'list',
      text: 'The minimum number of units of the Unit Tier equal to the Battle Tier is halved.' },
    { id: 'O3', cat: 'Operational', name: 'Rapid Relocation', where: 'battle',
      text: 'After deploying in the Reserve phase of turn 1, relocate up to half the units on the table. No unit may be relocated twice.' },
    { id: 'O4', cat: 'Operational', name: 'Reinforced Light Support', where: 'list',
      text: 'All Light support troops have their Size increased by 2.' },
    { id: 'O5', cat: 'Operational', name: 'Strength in Numbers', where: 'list',
      text: 'Field one extra unit of one Tier below the Battle Tier (Battle Tier − 1) per Priority Level, free and without spending composition points.' },
    { id: 'O6', cat: 'Operational', name: 'Tactical Flexibility', where: 'list',
      text: 'May swap up to half the army when modifying it before the battle, instead of a quarter.' },
    /* --- tactical --- */
    { id: 'T1', cat: 'Tactical', name: 'Combat Drugs', where: 'battle',
      text: "On a 'Man down!' from shooting, roll a D6: on a 6 the casualty is ignored but the unit still takes 1 Suppression point. Stacks with Field Medics." },
    { id: 'T2', cat: 'Tactical', name: 'Courage Under Fire', where: 'battle',
      text: 'When a unit is fired at more than once in the same turn, deduct 1 Suppression point from every later attack on it.' },
    { id: 'T3', cat: 'Tactical', name: 'Firepower on the Move!', where: 'battle',
      text: 'Light support, Heavy support and Remote mortar units move up to Movement +4" on a Move action.' },
    { id: 'T4', cat: 'Tactical', name: 'Improved HTH Training', where: 'battle',
      text: 'All units get +1 Assault and +1 Defence during assaults, attacking or defending.' },
    { id: 'T5', cat: 'Tactical', name: 'NOT ONE STEP BACKWARDS!', where: 'battle',
      text: 'Command Units, and friendly units within 12" of one, may shoot at a friendly unit carrying Suppression. Hits remove Suppression instead of adding it.' },
    { id: 'T6', cat: 'Tactical', name: 'Zero-in', where: 'battle',
      text: 'When the same enemy unit is shot at more than once in a turn, every later attack gets +1 Firepower.' }
  ];
  var BY_DOCTRINE = {};
  DOCTRINES.forEach(function (d) { BY_DOCTRINE[d.id] = d; });
  var CATEGORIES = ['Strategic', 'Operational', 'Tactical'];

  /* ================= Battle Honours (p. 88) =================
     `mod` is a straight parameter change; `rule` grants a special rule the engine
     already knows; `flag` is a named behaviour the engine has to look up. */
  var HONOURS = [
    { n: 1, name: 'Adrenaline Rush', flag: 'adrenaline',
      text: 'Once per battle the unit may make two actions in a row.' },
    { n: 2, name: 'Brave', flag: 'brave',
      text: 'The unit ignores 1 Suppression point from each ranged attack.' },
    { n: 3, name: 'Last Stand', flag: 'lastStand',
      text: 'Once per battle the unit may remove all its Suppression points.' },
    { n: 4, name: 'Amazing Stamina', mod: { move: 1 },
      text: 'The unit adds 1 to its Movement.' },
    { n: 5, name: 'Into the Shadows', rule: 'Stealth',
      text: 'The unit gains the Stealth special rule.' },
    { n: 6, name: 'Iron Discipline', flag: 'ironDiscipline',
      text: 'The unit rolls 2 more dice when attempting to regroup.' },
    { n: 7, name: 'Living Legends', rule: 'Inspiring Presence',
      text: 'The unit gains the Inspiring Presence special rule.' },
    { n: 8, name: 'Shooting Experts', mod: { fp: 1 },
      text: 'The unit adds 1 to its Firepower.' },
    { n: 9, name: 'Natural Born Killers', flag: 'nbk',
      text: "Attacking or defending in an assault, the unit causes 'Man down!' on a 2-6." },
    { n: 10, name: 'Nerves of Steel', flag: 'nerves',
      text: 'Immune to Suppressive Fire and Incendiary Ammunition.' },
    { n: 11, name: 'Overloaded Energy Shields', flag: 'shields',
      text: 'The unit gets +4 Defence when it is shot at during an assault.' },
    { n: 12, name: 'Rain of Fire', flag: 'rainOfFire',
      text: 'Shooting at a target inside half its Range, the unit gets +4 instead of +2.' },
    { n: 13, name: 'Rippers', mod: { assault: 2 },
      text: 'The unit adds 2 to its Assault.' },
    { n: 14, name: 'Rail Gun Specialists', rule: 'Gauss Weapon',
      bars: ['Cumbersome Weapon', 'Indirect Fire', 'Destructive Weapon'],
      text: 'The unit gains the Gauss Weapon special rule. Not available to units with Cumbersome Weapon, Indirect Fire or Destructive Weapon.' },
    { n: 15, name: 'Runners', flag: 'runners',
      text: 'The unit moves up to Movement +4" when performing Move and Assault actions.' },
    { n: 16, name: 'Semper Fidelis', flag: 'semperFidelis',
      text: 'Held in reserve, the unit may arrive automatically on any turn the player wishes except the first.' },
    { n: 17, name: 'Style Bonus', flag: 'style',
      text: "Whenever the unit kills an enemy soldier, the enemy unit takes 1 extra Suppression point." },
    { n: 18, name: 'Superior Ballistic Skills', mod: { range: 6 },
      text: 'The unit adds 6" to its Range.' },
    { n: 19, name: 'Surrounded, but Steady', flag: 'surrounded',
      text: 'When rallying, the unit rolls one extra die for each enemy unit within 18".' },
    { n: 20, name: 'To the Last Drop of Blood!', rule: 'Determined',
      text: 'The unit gains the Determined special rule.' }
  ];

  /* ================= Battle Traumas (p. 89) ================= */
  var TRAUMAS = [
    { n: 1, name: 'Alcoholics', flag: 'alcoholics',
      text: 'The unit needs double the normal EXP to be promoted or to take a Battle Honour.' },
    { n: 2, name: 'Bad Reputation', flag: 'badReputation',
      text: 'The unit cannot be promoted.' },
    { n: 3, name: 'Bloodlust', flag: 'bloodlust',
      text: 'The unit must assault the closest enemy unit if it can, even carrying a Cumbersome Weapon.' },
    { n: 4, name: 'Broken-minded', flag: 'brokenMinded',
      text: 'Halve the number of dice the unit rolls when regrouping.' },
    { n: 5, name: 'Cowards', mod: { morale: -1 },
      text: 'A permanent -1 to Morale.' },
    { n: 6, name: 'Insubordinate', flag: 'insubordinate',
      text: 'The unit is unaffected by Inspiring Presence and by the Coordinate action.' },
    { n: 7, name: 'Panic-mongers', flag: 'panic',
      text: 'The unit rallies on a 6 instead of 4+.' },
    { n: 8, name: 'Suicidal Tendencies', flag: 'suicidal',
      text: "Shot at, the unit ignores hits on 1-2 but suffers 'Man down!' on 5-6." },
    { n: 9, name: 'Tactical Dumbness', flag: 'dumb',
      text: 'The unit gets no bonuses from terrain.' },
    { n: 10, name: 'Unreliable', flag: 'unreliable',
      text: 'Before any action, roll a D6: on a 1 the action is wasted.' }
  ];

  /* ================= the Space Bugs (pp. 124-125) =================
     A swarm's Battle Honours are Adaptations and its Battle Traumas Genetic
     Flaws; the same numbers, the same d10, the same slots on the dossier. The
     tables are chosen by the unit's own faction, so every "which honour is n?"
     goes through honourTable / traumaTable. */
  var ADAPTATIONS = [
    { n: 1, name: 'Overgrown Muscles', mod: { move: 1 }, text: 'The unit gets +1 to its Movement.' },
    { n: 2, name: 'Underground Advance', rule: 'Battlefield Insertion', text: 'The unit can use Battlefield Insertion.' },
    { n: 3, name: 'Spotters', flag: 'spotters', text: 'The unit gets +1 Firepower (up to +3) for every friendly unit within 6".' },
    { n: 4, name: 'Fleet of Foot', flag: 'runners', text: 'The unit moves M+4" on Move and Assault actions.' },
    { n: 5, name: 'Adamantium Exoskeletons', flag: 'adamantium', text: 'The unit ignores a "Man down!" or "SPLASH!" result on a 5+.' },
    { n: 6, name: 'Bioplasma Launchers', rule: 'Gauss Weapon', text: 'The unit gains the Gauss Weapon special rule.' },
    { n: 7, name: 'No Pain', mod: { def: 1, move: -2 }, text: 'The unit gets +1 Defence and -2 Movement.' },
    { n: 8, name: 'Concentrated Aggression Hormones', rule: 'Inspiring Presence', text: 'The unit gains the Inspiring Presence special rule.' },
    { n: 9, name: 'Increased Control', rule: 'Overmind', text: 'The unit gains the Overmind special rule.' },
    { n: 10, name: 'Intense Pheromone Markers', flag: 'intensePheromones', text: "The unit's Pheromone Markers give +2 Firepower rather than +1." }
  ];
  var FLAWS = [
    { n: 1, name: 'Uncoordinated', flag: 'noAdvance', text: 'The unit cannot Advance.' },
    { n: 2, name: 'Self-awareness', flag: 'selfAware', text: 'The unit loses the Determined special rule.' },
    { n: 3, name: 'Genetic Instability', flag: 'badReputation', text: 'The unit cannot be promoted.' },
    { n: 4, name: 'Atavism', flag: 'atavism', text: 'The unit loses all its Adaptations and cannot gain new ones.' },
    { n: 5, name: 'Reduced Intelligence', rule: 'Animal Behaviour', noOvergrown: true,
      text: 'The unit gets the Animal Behaviour special rule. (Overgrown bugs re-roll this.)' },
    { n: 6, name: 'Overgrown Adrenaline Glands', rule: 'Aggressive', text: 'The unit gets the Aggressive special rule.' },
    { n: 7, name: 'Chaotic Ranged Attacks', flag: 'chaotic', text: 'The unit gets no +2 for shooting inside half its Range.' },
    { n: 8, name: 'Overreacting', flag: 'overreact', text: 'The unit takes 4 Suppression points for every model lost instead of 2.' },
    { n: 9, name: 'Degenerated Genotype', flag: 'doubleTP', text: 'The unit gets double Trauma Points.' },
    { n: 10, name: 'Sensory Dysfunction', flag: 'deafSenses', text: 'The unit gets no benefit from Pheromone Markers or an Overmind.' }
  ];
  /* Evolutionary Pathways (p. 124): the swarm's doctrines, three groups of six. */
  var PATHWAYS = [
    { id: 'BC1', cat: 'Biochemical', name: 'Alternate Carbon-based Metabolism',
      text: 'Every enemy unit a bug unit destroys in an Assault is worth 1 more Resource Point after the battle.' },
    { id: 'BC2', cat: 'Biochemical', name: 'Concentrated Acid',
      text: 'All Spore Bugs and Flying Bugs get a permanent +1 to Firepower.' },
    { id: 'BC3', cat: 'Biochemical', name: 'Strong Pheromones',
      text: 'The range of Pheromone Markers is increased to 24".' },
    { id: 'BC4', cat: 'Biochemical', name: 'Highly Irritating Venom',
      text: 'An enemy unit that takes Suppression from a shooting attack by Spore Bugs or Flying Bugs takes 1 more.' },
    { id: 'BC5', cat: 'Biochemical', name: 'Bioplasma Missiles',
      text: 'Spore Bugs and Flying Bugs get the Anti-tank (limited) special rule.' },
    { id: 'BC6', cat: 'Biochemical', name: 'Effective Toxin Glands',
      text: 'Spore Bugs and Flying Bugs get +2 for the Fire! action instead of +1.' },
    { id: 'BB1', cat: 'Behavioural', name: 'Coordinated Hive',
      text: 'The swarm may re-roll its failed dice in the Reserve phase.' },
    { id: 'BB2', cat: 'Behavioural', name: 'Mimicry',
      text: 'Up to a quarter of the units may be held in reserve and deployed using the Battlefield Insertion rules.' },
    { id: 'BB3', cat: 'Behavioural', name: 'Increased Control',
      text: 'The range of the Overmind special rule is increased to 24".' },
    { id: 'BB4', cat: 'Behavioural', name: 'Fierce Attacks',
      text: 'All Flying Infantry add +4 to their Assault in the first round of every assault.' },
    { id: 'BB5', cat: 'Behavioural', name: 'Extensive Feeding',
      text: 'Overgrown bugs get +2 Movement and +1 Defence.' },
    { id: 'BB6', cat: 'Behavioural', name: 'Quick Learning',
      text: 'Each unit may hold one more Adaptation: Unit Tier +2 instead of +1.' },
    { id: 'BP1', cat: 'Phenotypic', name: 'Efficient Spawn Cycle',
      text: 'Spawning Lesser Bugs and Underground Bugs costs two thirds of the standard cost, rounding up.' },
    { id: 'BP2', cat: 'Phenotypic', name: 'Enlarged Leg Muscles',
      text: 'All Lesser Bugs and Underground Bugs get +1 Movement.' },
    { id: 'BP3', cat: 'Phenotypic', name: 'Strong Nervous System',
      text: 'Once per battle, in the Rally phase, every Suppression point on every bug unit is removed.' },
    { id: 'BP4', cat: 'Phenotypic', name: 'Fungi Symbiosis',
      text: 'For every human unit a bug unit destroys in an Assault, a free unit of Infected Humans joins the swarm after the battle.' },
    { id: 'BP5', cat: 'Phenotypic', name: 'Chitin Exoskeletons',
      text: 'Lesser Bugs and Underground Bugs get +2 Defence in assaults — but the enemy strikes first when they charge.' },
    { id: 'BP6', cat: 'Phenotypic', name: 'Metal-covered Talons',
      text: 'All units get +2 to Assault when attacking vehicles.' }
  ];
  /* ================= the Xenotripods (pp. 140-143) =================
     A tribe's doctrines are Tribe Advancements; its Battle Honours are Rites
     (a d20 table, not a d10); its Battle Traumas Infamies; and its aircraft
     take the tribe's own ten upgrades. Territorial Points stand in for kUC. */
  var ADVANCEMENTS = [
    { id: 'XS1', cat: 'Social', name: 'Increased Population Growth',
      text: 'Recruiting Xenotripod infantry of a Unit Tier lower than the Tribe Tier costs half, rounding up.' },
    { id: 'XS2', cat: 'Social', name: 'Effective Resource Utilisation',
      text: 'After winning an attacker–defender scenario, payment dice of 1, 2 or 3 count as 4 (instead of 1 and 2 counting as 3).' },
    { id: 'XS3', cat: 'Social', name: 'Supportive Community',
      text: 'Whenever a unit does not take part in a battle, roll a D6: on a 6 it loses a random Infamy.' },
    { id: 'XS4', cat: 'Social', name: 'Hermetic Society',
      text: 'Promotion costs are halved, both EXP and Territorial Points — but recruiting costs double.' },
    { id: 'XS5', cat: 'Social', name: 'Enhanced Genetic Memory',
      text: 'When an infantry unit is destroyed, a new one of the same type is recruited; on a D6 of 2–6 it inherits everything the lost unit had before its last battle.' },
    { id: 'XS6', cat: 'Social', name: 'Focused on Perfection',
      text: 'Each unit may hold one more Rite: Unit Tier +2 instead of +1.' },
    { id: 'XO1', cat: 'Organisational', name: 'Complex Teleport Network',
      text: 'The tribe gets one free set of Teleport turrets a Priority Level, of the Battle Tier (Tier II–IV).' },
    { id: 'XO2', cat: 'Organisational', name: 'Underground Advance',
      text: 'Up to a quarter of the units may use the Battlefield Insertion rule.' },
    { id: 'XO3', cat: 'Organisational', name: 'Foresighted Command',
      text: 'The scenario is rolled with an extra die, and the tribe chooses which to keep.' },
    { id: 'XO4', cat: 'Organisational', name: 'Detailed Terrain Knowledge',
      text: 'After the battlefield is set up, the tribe moves two terrain pieces up to 12".' },
    { id: 'XO5', cat: 'Organisational', name: 'Fortify and Strike!',
      text: 'After deploying in the first turn, the tribe places four field fortifications (low walls) in its deployment zone.' },
    { id: 'XO6', cat: 'Organisational', name: 'Know Your Foe!',
      text: 'Once a battle, in the Beginning phase, the tribe stops every enemy reinforcement arriving that turn.' },
    { id: 'XT1', cat: 'Technological', name: 'Advanced Aviation',
      text: 'All aircraft get +4 Movement.' },
    { id: 'XT2', cat: 'Technological', name: 'Meditation',
      text: 'Xenotripod units remove 2 more Suppression points when they Regroup.' },
    { id: 'XT3', cat: 'Technological', name: 'Aura of Majesty',
      text: 'Alpha squads gain the Inspiring Presence special rule.' },
    { id: 'XT4', cat: 'Technological', name: 'Low-spectrum Cloaking',
      text: 'All Teleport turrets gain the Stealth special rule.' },
    { id: 'XT5', cat: 'Technological', name: 'Mind Amplifiers',
      text: 'The range of Psychic Support is increased to 12".' },
    { id: 'XT6', cat: 'Technological', name: 'Dual-mode Weapons',
      text: 'Units with Indirect Fire shooting at a target in their own sight get every modifier, not Basic Firepower. Not aircraft.' }
  ];
  var ADVANCEMENT_GROUPS = ['Social', 'Organisational', 'Technological'];
  var BY_ADVANCEMENT = {};
  ADVANCEMENTS.forEach(function (a) { BY_ADVANCEMENT[a.id] = a; });
  var RITES = [
    { n: 1, name: 'Rite of Calmness', flag: 'calmness', text: 'After every Assault it wins, the unit removes all of its Suppression points.' },
    { n: 2, name: 'Rite of Protection', mod: { def: 1 }, text: 'The unit gets +1 Defence.' },
    { n: 3, name: 'Rite of Rage', flag: 'rage', text: 'In the Rally phase the unit removes 2 Suppression points at once if an enemy is within 12".' },
    { n: 4, name: 'Rite of Farsight', flag: 'farsight', text: 'The unit sees enemies within 18" instead of 12".' },
    { n: 5, name: 'Rite of Devastation', rule: 'Anti-tank (limited)', text: 'The unit gains the Anti-tank (limited) special rule.' },
    { n: 6, name: 'Rite of Flame', rule: 'Incendiary Ammunition', text: 'The unit gains the Incendiary Ammunition special rule.' },
    { n: 7, name: 'Rite of Power', rule: 'Markerlights', text: 'The unit gains the Markerlights special rule.' },
    { n: 8, name: 'Rite of Invisibility', flag: 'invisibility', text: 'The unit gets +3 Defence from terrain instead of +2.' },
    { n: 9, name: 'Rite of Stability', flag: 'stability', text: 'The unit takes no Suppression for warriors killed in friendly units within 6".' },
    { n: 10, name: 'Rite of Knowledge', flag: 'knowledge', text: 'Using a Teleport, the unit may re-roll a 1–3; the second result stands.' },
    { n: 11, name: 'Rite of Frenzy', flag: 'frenzy', text: 'For every member of the unit killed in an Assault, the enemy takes D3−1 automatic hits in the next round, unless the unit is Broken.' },
    { n: 12, name: 'Rite of Unyielding Will', rule: 'Determined', text: 'The unit gains the Determined special rule.' },
    { n: 13, name: 'Rite of Unrest', flag: 'unrest', text: 'In the Beginning phase every enemy infantry unit within 12" takes 1 Suppression point (not Drones).' },
    { n: 14, name: 'Rite of Shielding', flag: 'shielding', text: 'Immune to every enemy special rule that adds Suppression — Psychic Wave, Incendiary Ammunition, Suppressive Fire and the like.' },
    { n: 15, name: 'Rite of Communication', rule: 'Counter-jamming', text: 'The unit gains the Counter-jamming special rule.' },
    { n: 16, name: 'Rite of Disruption', flag: 'disruption', text: 'Enemy infantry within 6" remove Suppression only on a 6.' },
    { n: 17, name: 'Rite of Perfection', flag: 'perfection', text: 'The unit gets +2 for the Fire! action instead of +1.' },
    { n: 18, name: 'Rite of Concentration', flag: 'concentration', text: 'Once a battle the unit doubles its D10 on a shooting attack.' },
    { n: 19, name: 'Rite of Fearless', flag: 'fearless', text: 'The unit rallies on a 2+ instead of a 4+.' },
    { n: 20, name: 'Rite of Majesty', rule: 'Inspiring Presence', text: 'The unit gains the Inspiring Presence special rule.' }
  ];
  var INFAMIES = [
    { n: 1, name: 'Infamy of Degeneration', flag: 'degeneration', text: 'After each battle, a D6 of 5+ and the unit loses all its unspent EXP (rolled after it has had the chance to spend it).' },
    { n: 2, name: 'Infamy of Defeatism', flag: 'doubleTP', text: 'The unit doubles the Trauma Points it gains after each battle.' },
    { n: 3, name: 'Infamy of Panic', flag: 'infamyPanic', text: 'When a friendly unit within 18" is Broken or destroyed, the unit takes D6 Suppression points.' },
    { n: 4, name: 'Infamy of Blasphemy', flag: 'blasphemy', text: 'The unit cannot receive any new Rites.' },
    { n: 5, name: 'Infamy of Overreaction', flag: 'overreaction', text: 'The unit takes 3 Suppression points instead of 1 when a friend within 6" loses a model (Psychic Bond).' },
    { n: 6, name: 'Infamy of Impudence', mod: { def: -1 }, text: 'The unit gets −1 Defence.' },
    { n: 7, name: 'Infamy of Backwardness', flag: 'backward', text: 'The unit cannot use Teleport turrets.' },
    { n: 8, name: 'Infamy of Madness', flag: 'madness', text: 'Each turn it is within 12" and sight of a friendly unit, roll a D6: on a 1 it fires on that friend.' },
    { n: 9, name: 'Infamy of Banishment', flag: 'banished', text: 'Mental Projection does not apply to the unit.' },
    { n: 10, name: 'Infamy of Melancholy', flag: 'melancholy', text: 'When the unit is activated, every friendly unit within 6" takes 1 Suppression point.' }
  ];
  // the tribe's aircraft upgrades (p. 143), bought for 10 EXP like any other
  var XENO_AIR_UPGRADES = [
    { n: 1, name: 'Improved Engines', mod: { move: 4 }, text: 'The aircraft gets +4 Movement.' },
    { n: 2, name: 'Emergency Batteries', flag: 'batteries', text: 'The aircraft may move up to its Movement as part of the Self-repair action.' },
    { n: 3, name: 'High Frequency Weapons', rule: 'Anti-tank', text: 'The aircraft gains the Anti-tank special rule.' },
    { n: 4, name: 'Neutron Blasters', rule: 'Gauss Weapon', text: 'The aircraft gains the Gauss Weapon special rule.' },
    { n: 5, name: 'Auxiliary Teleportation System', flag: 'auxTeleport', text: 'A friendly unit rolling 2–3 to teleport may come out beside this aircraft instead. It is not a Teleport unit itself.' },
    { n: 6, name: 'Psychic Amplifier', flag: 'psychicAmp', text: 'Friendly infantry within 6" automatically remove 1 Suppression point in the Rally phase.' },
    { n: 7, name: 'Long-range Teleportation System', rule: 'Battlefield Insertion', text: 'The aircraft gains the Battlefield Insertion special rule.' },
    { n: 8, name: 'Temporal Armour Amplifier', flag: 'temporal', text: 'The aircraft is immune to the Anti-aircraft rule: attacks on it are resolved as normal shooting.' },
    { n: 9, name: 'Time Vortex Generator', flag: 'vortex', text: 'Once a battle the aircraft may double its Movement for a Move.' },
    { n: 10, name: 'Advanced Control System', flag: 'advControl', text: 'After a Move the aircraft may turn up to 90°.' }
  ];
  var PATHWAY_GROUPS = ['Biochemical', 'Behavioural', 'Phenotypic'];
  var BY_PATHWAY = {};
  PATHWAYS.forEach(function (p) { BY_PATHWAY[p.id] = p; });
  function isBugKey(key) { var p = R.profile(key); return !!p && p.faction === 'bugs'; }
  function isXenoKey(key) { var p = R.profile(key); return !!p && p.faction === 'xeno'; }
  function honourTable(key) { return isBugKey(key) ? ADAPTATIONS : isXenoKey(key) ? RITES : HONOURS; }
  function traumaTable(key) { return isBugKey(key) ? FLAWS : isXenoKey(key) ? INFAMIES : TRAUMAS; }
  function upgradeTable(key) { return isXenoKey(key) ? XENO_AIR_UPGRADES : UPGRADES; }
  /* The force's command, whatever it is called: a Command Unit, a Leader Bug
     (p. 124) or an Alpha squad (p. 140) — none of them earns EXP or TP. */
  function isLeaderP(p) { return !!p && (!!p.command || !!p.leaderBug || !!p.alpha); }
  function isLeaderKey(key) { return isLeaderP(R.profile(key)); }
  function isTurretP(p) { return !!p && (p.rules || []).indexOf('Turret') >= 0; }
  // the Overgrown take Adaptations and Flaws like the infantry do (p. 124)
  function takesHonours(p) { return !!p && (p.cls === 'infantry' || (p.faction === 'bugs' && R.isOvergrown(p))); }

  /* ================= vehicle and aircraft Upgrades (p. 89) ================= */
  var UPGRADES = [
    { n: 1, name: 'Advanced Emergency Systems', air: true, flag: 'advEmergency',
      text: 'Shot down, the aircraft is salvaged on a 2+ instead of a 4+.' },
    { n: 2, name: 'Automated Defence Systems', ground: true, mod: { assault: 4 },
      text: 'The vehicle adds 4 to its Assault.' },
    { n: 3, name: 'Ballistic Computer', mod: { range: 6 },
      text: 'Adds 6" to Range.' },
    { n: 4, name: 'Demolisher', flag: 'demolisher',
      text: '+4 Firepower when shooting at destructible terrain or troops sheltering in it.' },
    { n: 5, name: 'Redundant Crucial Systems', mod: { str: 1 },
      text: 'Adds 1 to Structure.' },
    { n: 6, name: 'Nanobots', ground: true, flag: 'nanobots',
      text: 'Repairs roll dice equal to full Structure, not the current value.' },
    { n: 7, name: 'Improved Engines', flag: 'engines',
      text: 'Ground vehicles add 2 to Movement; aircraft add 4.' },
    { n: 8, name: 'Reinforced Armour', mod: { def: 2 },
      text: 'Adds 2 to Defence.' },
    { n: 9, name: 'Superior Self-repair System', flag: 'selfRepair',
      text: 'Failed repair rolls may be re-rolled. The second result stands.' },
    { n: 10, name: 'Tank Hunter', rule: 'Anti-tank',
      text: 'The vehicle or aircraft gains the Anti-tank special rule.' }
  ];

  /* ================= economy (pp. 84-85) ================= */
  var RECRUIT_COST = { 1: 1, 2: 4, 3: 8, 4: 16, 5: 32 };
  var COMPANY_COST = { 2: 1, 3: 20, 4: 80, 5: 200 };

  /* ================= promotion paths (p. 86) =================
     The default is "same group, same Tier or one higher". These are the book's
     exceptions, keyed by the group a unit is leaving. */
  var PROMOTION_PATHS = {
    'Basic troops': ['Rifle infantry', 'Heavy infantry', 'Light support', 'Remote mortars'],
    'Rifle infantry': ['Rifle infantry'],
    'Assault troops': ['Assault troops', 'Heavy support'],
    'Heavy infantry': ['Heavy infantry'],
    'Light infantry': ['Light infantry'],
    'Light support': ['Light support', 'Heavy support'],
    'Heavy support': ['Heavy support'],
    'Remote mortars': ['Remote mortars'],
    'Support teams': ['Support teams'],
    'Command': [],           // Command Units never earn EXP, so never promote
    'Unclassified': [],      // "cannot be promoted at all"

    /* The Rebel exception (p. 110): Freedom Warriors may cross into any category
       but First Among Equals, ground vehicles and flying units — everybody else
       promotes inside their own. */
    'Freedom Warriors': ['Freedom Warriors', 'Holy Warriors', 'Mounted Warriors',
      'Rebel support troops', 'Rebel artillery', 'Chosen Warriors', 'Miners', 'Deserters and POWs'],
    'Holy Warriors': ['Holy Warriors'],
    'Mounted Warriors': ['Mounted Warriors'],
    'Rebel support troops': ['Rebel support troops'],
    'Rebel artillery': ['Rebel artillery'],
    'Chosen Warriors': ['Chosen Warriors'],
    'Miners': ['Miners'],
    'Deserters and POWs': ['Deserters and POWs'],
    'First Among Equals': []   // they never earn EXP, so they never promote
  };
  /* The individual Basic troops each have their own paths out (p. 87), on top
     of the ordinary one: "to a unit from the same group ... of the same Tier or
     1 Tier higher" — so any of them may also become other Basic troops. Only
     penal troops are held to Basic troops alone, and nobody volunteers to
     become one. */
  var BASIC_PATHS = {
    recruits: ['Basic troops', 'Rifle infantry', 'Heavy infantry', 'Light support', 'Remote mortars'],
    enforcers: ['Basic troops', 'Heavy infantry'],
    irregulars: ['Basic troops', 'Assault troops', 'Light support', 'Light infantry'],
    penal: ['Basic troops']
  };


  /* ================= Paths (pp. 111-113) =================
     A Rebel commander walks Paths rather than holding Doctrines. There are three
     groups of six, and no force may take more than two from any one group. They
     are stored in the same `co.doctrines` list as a PMC's doctrines — the ids
     never collide — so everything that already asks "does this force have X?"
     keeps working. */
  var PATHS = [
    /* ---- Paths of the Hero ---- */
    { id: 'H1', cat: 'Hero', name: 'Viva la Revolution!',
      text: 'Every unit that took part in a battle the Rebels won earns 3 EXP instead of 1.' },
    { id: 'H2', cat: 'Hero', name: 'Hero of the People',
      text: 'The locals talk. In a scenario with alternating deployment the enemy sets up half their force before a single insurgent is placed.' },
    { id: 'H3', cat: 'Hero', name: 'Labour Leader',
      text: 'Up to four ground vehicles a Priority Level, of which two may be aircraft.' },
    { id: 'H4', cat: 'Hero', name: 'To Hell and Back!',
      text: 'The fighters are loyal past reason: no Trauma Points for having been Broken in battle.' },
    { id: 'H5', cat: 'Hero', name: 'Rob the Rich, Give to the Poor',
      text: 'Only three quarters of the Influence Points from each battle — but every unit that fought earns 2 extra EXP.' },
    { id: 'H6', cat: 'Hero', name: 'La Liberté Guidant le Peuple',
      text: 'Every First Among Equals becomes a Command Unit: (2) at Tiers I-II, (3) at III-IV, (4) at V.' },

    /* ---- Paths of the Villain ---- */
    { id: 'V1', cat: 'Villain', name: 'Smuggler',
      text: 'Every recruitment and promotion costs 1 Influence Point less, down to a floor of 1.' },
    { id: 'V2', cat: 'Villain', name: 'Plunderer',
      text: 'After a battle the Rebels won, the whole payment may be re-rolled.' },
    { id: 'V3', cat: 'Villain', name: 'Terrorist',
      text: 'One destructible piece of terrain is mined before the battle. Any First Among Equals may set it off: a shooting attack at Firepower 10 with the Destructive Weapon rule.' },
    { id: 'V4', cat: 'Villain', name: 'Drug Dealer',
      text: 'Up to a third of the infantry, First Among Equals aside, go in Determined — and each takes D6+1 extra Trauma Points afterwards.' },
    { id: 'V5', cat: 'Villain', name: 'No Place for the Weak!',
      text: 'After each battle the unit carrying the most Trauma Points may be executed. Every other unit then halves the Trauma Points it rolled.' },
    { id: 'V6', cat: 'Villain', name: 'Unclear Intentions',
      text: 'Someone in the establishment is paying: D3 extra Influence Points per Battle Tier after every battle.' },

    /* ---- Paths of the Prophet ---- */
    { id: 'P1', cat: 'Prophet', name: 'Martyrdom',
      text: 'In the first round of an Assault involving Holy Warriors, one of them may be given up to inflict D3 automatic hits — and the unit takes no Suppression for the death.' },
    { id: 'P2', cat: 'Prophet', name: 'No Sacrifice Too Great!',
      text: 'Every First Among Equals gains the Determined special rule.' },
    { id: 'P3', cat: 'Prophet', name: 'Stairs to Heaven',
      text: 'Holy Warriors take no Trauma Points for the soldiers they lose.' },
    { id: 'P4', cat: 'Prophet', name: 'Holy Fury',
      text: 'Every unit adds 2 to its Assault in any assault, attacking or defending.' },
    { id: 'P5', cat: 'Prophet', name: 'Preacher',
      text: 'The free First Among Equals gains the Inspiring Presence special rule.' },
    { id: 'P6', cat: 'Prophet', name: 'Incense & Iron',
      text: '"…but they\'ll never take our freedom!" adds five dice to a rally instead of three.' }
  ];
  var PATH_GROUPS = ['Hero', 'Villain', 'Prophet'];
  var BY_PATH = {};
  PATHS.forEach(function (p) { BY_PATH[p.id] = p; });
  /* Which table a force chooses from, and what it calls the choice. */
  function creedOf(co) {
    if (co && co.faction === 'xeno') {
      return { list: ADVANCEMENTS, by: BY_ADVANCEMENT, cats: ADVANCEMENT_GROUPS, one: 'Tribe Advancement', many: 'Tribe Advancements', of: '', suffix: ' Advancements' };
    }
    if (co && co.faction === 'bugs') {
      return { list: PATHWAYS, by: BY_PATHWAY, cats: PATHWAY_GROUPS, one: 'Evolutionary Pathway', many: 'Evolutionary Pathways', of: '', suffix: ' Pathways' };
    }
    return (co && co.faction === 'rebel')
      ? { list: PATHS, by: BY_PATH, cats: PATH_GROUPS, one: 'Path', many: 'Paths', of: 'Paths of the ' }
      : { list: DOCTRINES, by: BY_DOCTRINE, cats: CATEGORIES, one: 'doctrine', many: 'doctrines', of: '' };
  }
  function creedById(id) { return BY_PATH[id] || BY_DOCTRINE[id] || BY_PATHWAY[id] || BY_ADVANCEMENT[id] || null; }
  /* The words a force uses about itself, so every screen can say "Swarm Tier"
     or "spawn" without asking which army it is looking at. */
  function words(co) {
    var f = (co && co.faction) || 'pmc';
    if (f === 'xeno') return { tier: 'Tribe', force: 'tribe', Force: 'Tribe', side: 'Xenotripods', money: 'TP',
      moneyLong: 'Territorial Points', cmd: 'Alpha squad', recruit: 'Recruit', recruited: 'recruited',
      honour: 'Rite', honours: 'Rites', trauma: 'Infamy', traumas: 'Infamies', unitWord: 'unit' };
    if (f === 'bugs') return { tier: 'Swarm', force: 'swarm', Force: 'Swarm', side: 'Space Bugs', money: 'RP',
      moneyLong: 'Resource Points', cmd: 'Leader Bug', recruit: 'Spawn', recruited: 'spawned',
      honour: 'Adaptation', honours: 'Adaptations', trauma: 'Genetic Flaw', traumas: 'Genetic Flaws', unitWord: 'bug unit' };
    if (f === 'rebel') return { tier: 'Revolt', force: 'revolt', Force: 'Revolt', side: 'Insurgents', money: 'IP',
      moneyLong: 'Influence Points', cmd: 'First Among Equals', recruit: 'Recruit', recruited: 'recruited',
      honour: 'Battle Honour', honours: 'Battle Honours', trauma: 'Battle Trauma', traumas: 'Battle Traumas', unitWord: 'unit' };
    return { tier: 'Company', force: 'company', Force: 'Company', side: 'Mercenaries', money: 'kUC',
      moneyLong: 'thousand Universal Credits', cmd: 'field command', recruit: 'Recruit', recruited: 'recruited',
      honour: 'Battle Honour', honours: 'Battle Honours', trauma: 'Battle Trauma', traumas: 'Battle Traumas', unitWord: 'unit' };
  }
  /* Influence Points and thousand Universal Credits are the same number with
     different names (p. 110), so the roster keeps one field and this names it. */
  function money(co) { return words(co).money; }

  function profile(key) { return R.profile(key); }

  /* Every legal promotion target for a roster entry. With the company given, no
     higher than one Tier over the Company Tier: "a Tier II Aspiring Company...
     may promote its units up to Tier III" (p. 84), aspiring or not. */
  function promotionTargets(entry, co) {
    var p = profile(entry.key);
    if (!p) return [];
    if (p.cls !== 'infantry') return [];                       // machines never promote
    if (isLeaderP(p)) return [];                               // Command Units earn no EXP
    if (hasTraumaFlag(entry, 'badReputation')) return [];
    var groups = BASIC_PATHS[entry.key] || PROMOTION_PATHS[p.group] || [p.group];
    return R.listFor(p.faction).filter(function (q) {
      if (q.cls !== 'infantry' || isLeaderP(q)) return false;
      if (q.key === entry.key) return false;
      if (q.key === 'penal') return false;                      // a sentence, not a promotion
      if (q.tier !== p.tier && q.tier !== p.tier + 1) return false;
      if (co && q.tier > co.tier + 1) return false;
      return groups.indexOf(q.group) >= 0;
    });
  }

  /* Cost of a promotion: 3 EXP x new Tier, doubled by Alcoholics, plus half the
     new unit's recruitment cost in kUC rounded up. Penal troops pay no money. */
  function promotionCost(entry, newKey, co) {
    var q = profile(newKey);
    var exp = 3 * q.tier * (hasTraumaFlag(entry, 'alcoholics') ? 2 : 1);
    // Hermetic Society: a tribe promotes at half price, EXP and Territory both (p. 141)
    var hermetic = co && hasDoctrine(co, 'XS4');
    if (hermetic) exp = Math.ceil(exp / 2);
    // Penal troops are free, and so are Armed Civilians: a revolt costs nothing
    // to talk into being (p. 110)
    // ...and Tiny Bug Swarms promote for experience alone (p. 124)
    // ...as do Primitive Epsilon troopers (p. 140)
    var free = entry.key === 'penal' || entry.key === 'rciv' || entry.key === 'btiny' || entry.key === 'xeps1';
    var kUC = free ? 0 : Math.ceil(RECRUIT_COST[q.tier] / 2);
    // Efficient Spawn Cycle: Lesser and Underground Bugs at two thirds
    if (kUC && co && hasDoctrine(co, 'BP1') && /^(Lesser|Underground) Bugs$/.test(q.group)) kUC = Math.ceil(kUC * 2 / 3);
    // Smuggler (Path of the Villain): a point off everything, down to a floor of 1
    if (kUC && co && hasDoctrine(co, 'V1')) kUC = Math.max(1, kUC - 1);
    if (kUC && hermetic) kUC = Math.ceil(kUC / 2);
    return { exp: exp, kUC: kUC };
  }

  /* Honours cost 10 EXP, 5 for an infantry unit's first under Rapid Training
     Methods, doubled again by Alcoholics. The cap is Unit Tier + 1. */
  function honourCost(entry, company) {
    var p = profile(entry.key);
    var base = 10;
    if (company && hasDoctrine(company, 'S6') && p.cls === 'infantry' && !entry.honours.length) base = 5;
    return base * (hasTraumaFlag(entry, 'alcoholics') ? 2 : 1);
  }
  function honourCap(entry, company) {
    // Quick Learning: one more Adaptation a unit (p. 124)
    // ...and Focused on Perfection: one more Rite (p. 141)
    return profile(entry.key).tier + 1 + (company && (hasDoctrine(company, 'BB6') || hasDoctrine(company, 'XS6')) ? 1 : 0);
  }
  function upgradeCap(entry) { return profile(entry.key).tier + 1; }

  function canTakeHonour(entry, company) {
    var p = profile(entry.key), bug = p.faction === 'bugs', xeno = p.faction === 'xeno';
    var word = bug ? 'Adaptations' : xeno ? 'Rites' : 'Battle Honours';
    if (!takesHonours(p)) return { ok: false, why: xeno && isTurretP(p) ? 'Turrets never earn experience.' : 'Vehicles and aircraft take Upgrades, not ' + word + '.' };
    if (isLeaderP(p)) return { ok: false, why: bug ? 'Leader Bugs never earn experience.' : xeno ? 'Alpha squads never earn experience.' : 'Command Units never earn experience.' };
    if (hasTraumaFlag(entry, 'blasphemy')) return { ok: false, why: 'Infamy of Blasphemy: this unit can receive no new Rites.' };
    if (entry.key === 'penal') return { ok: false, why: 'Penal troops cannot be given Battle Honours.' };
    if (hasTraumaFlag(entry, 'atavism')) return { ok: false, why: 'Atavism: this unit can gain no new Adaptations.' };
    if (entry.honours.length >= honourCap(entry, company)) return { ok: false, why: 'At the cap of ' + honourCap(entry, company) + ' ' + word + ' for a Tier ' + R.ROMAN[p.tier] + ' unit.' };
    var cost = honourCost(entry, company);
    if (entry.exp < cost) return { ok: false, why: 'Needs ' + cost + ' EXP, has ' + entry.exp + '.' };
    if (!availableHonours(entry).length) return { ok: false, why: 'No ' + word + ' left that this unit could take.' };
    return { ok: true, cost: cost };
  }
  function availableHonours(entry) {
    var p = profile(entry.key);
    var held = entry.honours;
    return honourTable(entry.key).filter(function (h) {
      if (held.indexOf(h.n) >= 0) return false;
      if (h.bars && h.bars.some(function (r) { return R.has({ rules: p.rules }, r); })) return false;
      return true;
    });
  }
  /* The book's ritual: draw three, then take one of those three at random. */
  function drawHonours(entry) {
    var pool = availableHonours(entry).slice(), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  function chooseHonour(drawn) { return pick(drawn); }

  function availableUpgrades(entry) {
    var p = profile(entry.key);
    return upgradeTable(entry.key).filter(function (g) {
      if (entry.upgrades.indexOf(g.n) >= 0) return false;
      if (g.air && p.cls !== 'aircraft') return false;
      if (g.ground && p.cls !== 'vehicle') return false;
      return true;
    });
  }
  function canTakeUpgrade(entry) {
    var p = profile(entry.key);
    if (p.cls === 'infantry') return { ok: false, why: 'Upgrades are for vehicles and aircraft.' };
    if (p.faction === 'bugs') return { ok: false, why: 'An Overgrown bug grows Adaptations, not Upgrades.' };
    if (isTurretP(p)) return { ok: false, why: 'Turrets never earn experience.' };
    if (entry.upgrades.length >= upgradeCap(entry)) return { ok: false, why: 'At the cap of ' + upgradeCap(entry) + ' Upgrades.' };
    if (entry.exp < 10) return { ok: false, why: 'Needs 10 EXP, has ' + entry.exp + '.' };
    if (!availableUpgrades(entry).length) return { ok: false, why: 'No Upgrades left for this machine.' };
    return { ok: true, cost: 10 };
  }

  /* ================= what a dossier entry does to a unit =================
     Called by the engine when it builds a campaign unit. Returns the parameter
     deltas, the rules to add, and the named behaviours to switch on. */
  function effects(entry) {
    var out = { move: 0, fp: 0, range: 0, def: 0, assault: 0, morale: 0, str: 0, rules: [], flags: {} };
    if (!entry) return out;
    var p = profile(entry.key);
    function apply(item) {
      if (!item) return;
      if (item.mod) Object.keys(item.mod).forEach(function (k) { out[k] += item.mod[k]; });
      if (item.rule && out.rules.indexOf(item.rule) < 0) out.rules.push(item.rule);
      if (item.flag) out.flags[item.flag] = true;
    }
    var HT = honourTable(entry.key), TT = traumaTable(entry.key);
    (entry.honours || []).forEach(function (n) { apply(HT[n - 1]); });
    (entry.traumas || []).forEach(function (n) { apply(TT[n - 1]); });
    var UT = upgradeTable(entry.key);
    (entry.upgrades || []).forEach(function (n) { apply(UT[n - 1]); });
    // Improved Engines reads differently for a ground vehicle and an aircraft
    if (out.flags.engines) out.move += (p && p.cls === 'aircraft') ? 4 : 2;
    return out;
  }
  /* Stamp a dossier entry onto a freshly built unit. Called after the profile and
     the propulsion, so the honours are the last word. The unit carries `camp`,
     which is what the engine looks at for every named behaviour. */
  function applyEntry(u, entry, doctrines) {
    if (!u || !entry) return u;
    var e = effects(entry), p = profile(entry.key);
    u.rid = entry.rid;
    u.camp = {
      rid: entry.rid, name: entry.name, flags: e.flags,
      honours: (entry.honours || []).slice(), traumas: (entry.traumas || []).slice(),
      upgrades: (entry.upgrades || []).slice(),
      men: (entry.men || []).slice(),           // the survivors of its last battle, by name
      once: {}                                  // once-per-battle honours, spent here
    };
    if (entry.name) { u.name = entry.name; u.label = entry.name + ' [' + u.side + ']'; }
    u.move += e.move;
    if (u.fp != null) u.fp += e.fp;
    if (u.range != null) u.range += e.range;
    u.def += e.def;
    if (u.defPierced != null) u.defPierced += e.def;
    u.assault += e.assault;
    if (u.morale != null) u.morale = Math.max(1, u.morale + e.morale);
    if (u.str != null) u.str = Math.max(1, u.str + e.str);
    e.rules.forEach(function (r) { if (u.rules.indexOf(r) < 0) u.rules.push(r); });
    function add(rule) { if (u.rules.indexOf(rule) < 0) u.rules.push(rule); }
    var docs = doctrines || [];
    // Reinforced Light Support: a doctrine that changes the unit, not the battle
    if (docs.indexOf('O4') >= 0 && p.group === 'Light support') {
      u.size += 2; u.models += 2;
    }
    /* Three Paths write themselves onto the unit before it takes the field
       (pp. 111-113). La Liberté puts a chain of command on leaders who had none;
       No Sacrifice Too Great makes them Determined; Preacher lifts the one who
       started the revolt. */
    if (p.group === 'First Among Equals') {
      if (docs.indexOf('H6') >= 0) {
        var n = p.tier <= 2 ? 2 : p.tier <= 4 ? 3 : 4;
        u.rules = u.rules.filter(function (r) { return r.indexOf('Command Unit') !== 0; });
        u.rules.push('Command Unit (' + n + ')');
      }
      if (docs.indexOf('P2') >= 0) add('Determined');
      if (docs.indexOf('P5') >= 0 && entry.free) add('Inspiring Presence');
    }
    /* The swarm's Evolutionary Pathways that change the bug itself (p. 124). */
    if (p.faction === 'bugs') {
      var ranged = p.group === 'Spore Bugs' || p.group === 'Flying Bugs';
      var ground = p.group === 'Lesser Bugs' || p.group === 'Underground Bugs';
      if (docs.indexOf('BC2') >= 0 && ranged && u.fp != null) u.fp += 1;            // Concentrated Acid
      if (docs.indexOf('BC5') >= 0 && ranged && !R.has(u, 'Anti-tank')) add('Anti-tank (limited)');   // Bioplasma Missiles
      if (docs.indexOf('BB5') >= 0 && R.isOvergrown(p)) { u.move += 2; u.def += 1; }  // Extensive Feeding
      if (docs.indexOf('BP2') >= 0 && ground) u.move += 1;                            // Enlarged Leg Muscles
    }
    /* The tribe's Advancements that change the unit itself (pp. 141-142). */
    if (p.faction === 'xeno') {
      if (docs.indexOf('XT1') >= 0 && p.cls === 'aircraft') u.move += 4;             // Advanced Aviation
      if (docs.indexOf('XT3') >= 0 && p.alpha) add('Inspiring Presence');            // Aura of Majesty
    }
    // Self-awareness: the Genetic Flaw that takes Determined away
    if (e.flags.selfAware) u.rules = u.rules.filter(function (r) { return r !== 'Determined'; });
    /* Drug Dealer: whoever was picked goes in Determined and pays for it after
       the battle. The choice is made when the army is fielded. */
    if (entry.drugged) { add('Determined'); u.drugged = true; }
    return u;
  }

  /* How far this unit moves on a Move or an Assault, given the engine's own base
     bonus (+2" for infantry, +4" for a machine). */
  function moveBonus(u, base, action, doctrines) {
    var out = base;
    if (u && u.camp && u.camp.flags.runners && (action === 'move' || action === 'assault')) out = Math.max(out, 4);
    if (doctrines && doctrines.indexOf('T3') >= 0 && action === 'move') {
      var p = profile(u && u.key ? u.key : null);
      var g = p ? p.group : (u && u.group);
      if (g === 'Light support' || g === 'Heavy support' || g === 'Remote mortars') out = Math.max(out, 4);
    }
    return out;
  }

  function hasTraumaFlag(entry, flag) {
    var T = traumaTable(entry.key);
    return (entry.traumas || []).some(function (n) { return T[n - 1] && T[n - 1].flag === flag; });
  }
  function hasHonourFlag(entry, flag) {
    var H = honourTable(entry.key);
    return (entry.honours || []).some(function (n) { return H[n - 1] && H[n - 1].flag === flag; });
  }

  /* ================= the dossier ================= */
  var seq = 0;
  function rid() { return 'u' + (Date.now() % 1e7).toString(36) + (seq++).toString(36); }

  function newEntry(key, opts) {
    opts = opts || {};
    var p = profile(key);
    return {
      rid: opts.rid || rid(), key: key, prop: opts.prop || null,
      // a Drone unit, or a craft only ever flown as a drone, is one from the start (pp. 40, 82)
      drone: !!opts.drone || !!(p && (p.mustDrone || (p.rules || []).indexOf('Drone unit') >= 0)),
      name: opts.name || p.name, exp: 0, tp: 0,
      honours: [], traumas: [], upgrades: [],
      free: !!opts.free, restUntil: 0, lastBattle: 0, history: []
    };
  }

  /* The soldiers on a dossier entry, by name and rank, filled up to the
     strength the unit takes the field at and ranked by where each stands. The
     survivors of its last battle keep their places; a new unit, or the gaps
     casualties left, get fresh names none of the rest of the force is using.
     Returns true when anything had to be added or changed, so the caller
     knows to save. */
  // how many models the unit takes the field with, a machine being one
  function strengthOf(entry, co) {
    var p = profile(entry.key);
    if (!p) return 0;
    var size = p.cls === 'infantry' ? p.size : 1;
    if (co && hasDoctrine(co, 'O4') && p.group === 'Light support') size += 2;   // Reinforced Light Support
    return size;
  }
  function menOf(entry, co) {
    var p = profile(entry.key);
    if (!p) return false;
    var size = strengthOf(entry, co);
    var u = {
      key: p.key, faction: p.faction || 'pmc', group: p.group, tier: p.tier, size: size, models: size,
      cls: p.cls || 'infantry', command: !!p.command, rules: (p.rules || []).slice(), drone: !!entry.drone
    };
    var taken = {};
    ((co && co.roster) || []).forEach(function (x) {
      if (x !== entry) (x.men || []).forEach(function (m) { taken[m.name] = 1; });
    });
    var before = JSON.stringify(entry.men || null);
    entry.men = R.musterMen(u, entry.men, taken).map(function (m) { return { name: m.name, rank: m.rank }; });
    return JSON.stringify(entry.men) !== before;
  }
  /* The force's losses against everyone who has ever served in it. Everyone
     who served is on the books now, was lost, or left some other way
     (disbanded, executed, cut by a promotion); a casualty that is replaced
     after the battle counts once lost and once again in the unit that is back
     at strength. So a squad of eight that loses two is 2 of 10: 20%.
     The swarm counts the same way in biomass rather than bodies: each bug is
     worth its Tier, an Overgrown one 25, and the Infected humans it raises
     are not biomass at all. The tribe keeps two counts, one for the Crocks
     (the Alpha to Delta castes, and the crews of its craft) and one for the
     Esh-Aven who make up its Epsilon squads. */
  /* Drones and turrets are machines with nobody in them: they are neither
     lost nor counted as having served. */
  function unmanned(entry) {
    var p = profile(entry.key);
    return !p || !!entry.drone || /Turret/.test(p.group || '') ||
      (p.rules || []).some(function (r) { return r === 'Turret' || r === 'Drone Control'; });
  }
  // the models the loss rate counts for this unit
  function manned(entry, co) { return unmanned(entry) ? 0 : strengthOf(entry, co); }
  // which count a profile's losses go in, and what each model lost is worth there
  var POOL_NAMES = { soldiers: 'soldiers', crocks: 'Crocks', eshaven: 'Esh-Aven', biomass: 'biomass' };
  function poolOf(p) {
    if (!p) return 'soldiers';
    if (p.faction === 'bugs') return 'biomass';
    if (p.faction === 'xeno') return p.eshAven || p.group === 'Epsilon Squads' ? 'eshaven' : 'crocks';
    return 'soldiers';
  }
  function poolsFor(co) {
    return co.faction === 'bugs' ? ['biomass'] : co.faction === 'xeno' ? ['crocks', 'eshaven'] : ['soldiers'];
  }
  function weightOf(p) { return poolOf(p) === 'biomass' ? R.biomassOf(p) : 1; }
  function massOf(entry, co) { return manned(entry, co) * weightOf(profile(entry.key)); }
  /* The running counts behind the loss rate, one per pool: what has been lost
     and what has left the books some other way. */
  function losses(co) {
    if (!co.losses) {
      co.losses = {};
      // a save from before the counts were split keeps what it had in its main pool
      var main = poolsFor(co)[0];
      co.losses[main] = { lost: co.faction === 'bugs' ? 0 : (co.lostModels || 0),
        departed: co.faction === 'bugs' ? (co.departedMass || 0) : (co.departed || 0) };
      delete co.lostModels; delete co.departed; delete co.departedMass;
    }
    return co.losses;
  }
  function addLoss(co, pool, key, n) {
    var L = losses(co), b = L[pool] || (L[pool] = { lost: 0, departed: 0 });
    b[key] += n;
  }
  function lossStats(co) {
    var L = losses(co);
    return poolsFor(co).map(function (pool) {
      var b = L[pool] || { lost: 0, departed: 0 };
      var lost = b.lost;
      if (pool === 'biomass') {
        var tally = biomassTally(co);
        lost = Object.keys(tally).reduce(function (n, t) { return n + tally[t].mass; }, 0);
      }
      var now = (co.roster || []).reduce(function (n, e) {
        return n + (poolOf(profile(e.key)) === pool ? massOf(e, co) : 0);
      }, 0);
      var served = now + lost + b.departed;
      return { pool: pool, unit: POOL_NAMES[pool], lost: lost, served: served, pct: served ? lost / served : 0 };
    });
  }
  /* How seasoned the force is: every honour held on the books against the
     number of units on them — so ten units, one with two honours and one with
     one, is 3 / 10: 30%. A company calls it veterancy, the swarm evolution
     (its honours are Adaptations) and the tribe enlightenment (its Rites). */
  function experienceStats(co) {
    var f = co.faction || 'pmc';
    var honours = (co.roster || []).reduce(function (n, e) { return n + (e.honours || []).length; }, 0);
    var units = (co.roster || []).length;
    return {
      word: f === 'bugs' ? 'adaptations' : f === 'xeno' ? 'rites' : 'honours',
      honours: honours, units: units, pct: units ? honours / units : 0,
      noun: honours === 1 ? words(co).honour : words(co).honours
    };
  }
  // battles won out of battles fought; a draw is fought but not won
  function winStats(co) {
    var r = co.record || {}, n = r.battles || 0;
    return { wins: r.wins || 0, battles: n, pct: n ? (r.wins || 0) / n : 0 };
  }
  /* The other side of it: every trauma carried on the books against the
     number of units. Trauma for a company or a revolt, genetic degradation
     for the swarm (its Genetic Flaws), infamy for the tribe (its Infamies). */
  function traumaStats(co) {
    var f = co.faction || 'pmc';
    var traumas = (co.roster || []).reduce(function (n, e) { return n + (e.traumas || []).length; }, 0);
    var units = (co.roster || []).length;
    return {
      word: f === 'bugs' ? 'flaws' : f === 'xeno' ? 'infamy' : 'trauma',
      traumas: traumas, units: units, pct: units ? traumas / units : 0,
      noun: traumas === 1 ? words(co).trauma : words(co).traumas
    };
  }
  /* The swarm's tally of what it has lost, by kind of bug: the models, and
     the biomass they were worth, which is always worked out from the models. */
  function biomassTally(co) {
    var out = {};
    Object.keys(co.biomass || {}).forEach(function (t) {
      var v = co.biomass[t], n = typeof v === 'number' ? v : (v && v.models) || 0;
      if (n <= 0) return;
      var p = R.CATALOGUE.filter(function (q) { return q.name === t; })[0];
      out[t] = { models: n, mass: n * R.biomassOf(p) };
    });
    return out;
  }
  // a soldier renamed by the player keeps the name through every battle they survive
  function renameSoldier(entry, i, name) {
    var m = entry && entry.men && entry.men[i];
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    if (!m || !name) return false;
    m.name = name;
    return true;
  }

  function newCompany(name, opts) {
    opts = opts || {};
    return {
      name: name || 'Unnamed PMC', colour: opts.colour || '#8fb7d9',
      faction: opts.faction || 'pmc',
      tier: 1, aspiring: false, kUC: 0,
      doctrines: [], doctrineSwapAt: null,
      roster: [], cmdRid: null,
      record: { battles: 0, wins: 0, draws: 0, losses: 0 },
      memorial: [],
      losses: {}                                // what the loss rate on the memorial is worked from
    };
  }

  function newCampaign(opts) {
    opts = opts || {};
    return {
      v: VERSION, id: 'c' + Date.now().toString(36), name: opts.name || 'Campaign',
      created: Date.now(), turn: 0, mode: opts.mode || 'solo',
      companies: {
        A: newCompany(opts.nameA || 'Your company', { faction: opts.factionA || 'pmc' }),
        B: newCompany(opts.nameB || 'Rival company', { faction: opts.factionB || opts.factionA || 'pmc' })
      },
      log: []
    };
  }

  /* The free command: always the force's own Tier, promoted free with it. A PMC
     gets a Field command (p. 83); a revolt gets the First Among Equals who
     started it, at the Revolt Tier (p. 110). */
  var COMMAND_BY_TIER = { 1: 'cmd4', 2: 'cmd3', 3: 'cmd2', 4: 'cmd1', 5: 'highcmd' };
  var LEADER_BY_TIER = { 1: 'rinstigators', 2: 'rsecondary', 3: 'rleaders', 4: 'rinfluential', 5: 'rrebellion' };
  // a swarm's free Leader Bug is its main Overmind organism, at the Swarm Tier (p. 124)
  var LEADERBUG_BY_TIER = { 1: 'bwatchlarva', 2: 'bimmwatch', 3: 'bwatchers', 4: 'bovermind', 5: 'bqueen' };
  // a tribe's free Alpha squad is its field commanders, at the Tribe Tier (p. 140)
  var ALPHA_BY_TIER = { 1: 'xalpha1', 2: 'xalpha2', 3: 'xalpha3', 4: 'xalpha4', 5: 'xalpha5' };
  function commandKey(co, tier) {
    return (co.faction === 'rebel' ? LEADER_BY_TIER : co.faction === 'bugs' ? LEADERBUG_BY_TIER
      : co.faction === 'xeno' ? ALPHA_BY_TIER : COMMAND_BY_TIER)[tier || co.tier];
  }
  function fitCommand(co) {
    var e = byRid(co, co.cmdRid);
    if (!e) return;
    var was = e.name === profile(e.key).name;
    e.key = commandKey(co);
    if (was) e.name = profile(e.key).name;
  }
  function byRid(co, id) {
    for (var i = 0; i < co.roster.length; i++) if (co.roster[i].rid === id) return co.roster[i];
    return null;
  }

  /* The starting company (p. 83): 6 Tier I units, 2 Tier II units, a free Tier I
     Field command, one doctrine, no more than two vehicles. */
  function foundingCheck(co) {
    var faults = [], paid = co.roster.filter(function (e) { return !e.free; });
    var t1 = 0, t2 = 0, other = 0, machines = 0;
    paid.forEach(function (e) {
      var p = profile(e.key);
      if (p.tier === 1) t1++; else if (p.tier === 2) t2++; else other++;
      if (p.cls !== 'infantry') machines++;
    });
    if (t1 !== 6) faults.push('A starting company has exactly 6 Tier I units (has ' + t1 + ').');
    if (t2 !== 2) faults.push('A starting company has exactly 2 Tier II units (has ' + t2 + ').');
    if (other) faults.push('No units above Tier II at founding (has ' + other + ').');
    if (machines > 2) faults.push('A starting company may include no more than two vehicles (has ' + machines + ').');
    if (!co.cmdRid) faults.push('The free Tier I ' + words(co).cmd + ' is missing.');
    if (co.doctrines.length !== 1) faults.push('Choose exactly one starting ' + creedOf(co).one + '.');
    return { ok: !faults.length, faults: faults, t1: t1, t2: t2, machines: machines };
  }

  function found(co, keys, doctrineId) {
    co.roster = [];
    var cmd = newEntry(commandKey(co, 1), { free: true });
    co.roster.push(cmd);
    co.cmdRid = cmd.rid;
    keys.forEach(function (k) {
      var s = R.splitPick(k);
      co.roster.push(newEntry(s.key, { prop: s.prop, drone: s.drone }));
    });
    co.doctrines = doctrineId ? [doctrineId] : [];
    return foundingCheck(co);
  }

  /* ================= doctrines held ================= */
  function hasDoctrine(co, id) { return co.doctrines.indexOf(id) >= 0; }
  function doctrineSlots(co) { return co.tier; }          // one per Company Tier
  function canTakeDoctrine(co, id) {
    var creed = creedOf(co);
    if (hasDoctrine(co, id)) return { ok: false, why: 'Already held.' };
    var d = creed.by[id];
    if (!d) return { ok: false, why: 'No such ' + creed.one + '.' };
    var inCat = co.doctrines.filter(function (x) { return creed.by[x] && creed.by[x].cat === d.cat; }).length;
    if (inCat >= 2) {
      return { ok: false, why: co.faction === 'rebel'
        ? 'No more than two Paths of the ' + d.cat + '.'
        : co.faction === 'bugs' ? 'No more than two ' + d.cat + ' Pathways.'
        : co.faction === 'xeno' ? 'No more than two ' + d.cat + ' Advancements.'
        : 'No more than two ' + d.cat + ' doctrines.' };
    }
    if (co.doctrines.length >= doctrineSlots(co)) {
      return { ok: false, why: 'No ' + creed.one + ' slot free — one per ' + words(co).tier + ' Tier.' };
    }
    return { ok: true };
  }

  /* "Tier V companies may change (but not get a new one!) one doctrine every 5
     battles" (p. 87): the first change comes 5 battles after reaching Tier V, and
     each change starts the count again. A save from before this was kept reads
     as due now. */
  function canSwapDoctrine(co) {
    if (co.tier < 5) return { ok: false, why: 'Only a Tier V ' + words(co).force.toLowerCase() + ' may change a ' + creedOf(co).one + '.' };
    if (!co.doctrines.length) return { ok: false, why: 'Nothing held to change.' };
    var due = co.doctrineSwapAt == null ? 0 : co.doctrineSwapAt;
    if (co.record.battles < due) {
      var left = due - co.record.battles;
      return { ok: false, due: due, why: 'Next change after ' + left + ' more battle' + (left === 1 ? '' : 's') + '.' };
    }
    return { ok: true };
  }
  function swapDoctrine(co, outId, inId) {
    var chk = canSwapDoctrine(co);
    if (!chk.ok) return chk;
    if (!hasDoctrine(co, outId)) return { ok: false, why: 'Not held.' };
    var trial = { doctrines: co.doctrines.filter(function (x) { return x !== outId; }), tier: co.tier, faction: co.faction };
    if (inId === outId) return { ok: false, why: 'The same one.' };
    var can = canTakeDoctrine(trial, inId);
    if (!can.ok) return can;
    co.doctrines = trial.doctrines.concat([inId]);
    co.doctrineSwapAt = co.record.battles + 5;
    return { ok: true };
  }
  /* ---- the company: in rules/camp-company.js ---- */
  var KIT_COMPANY = null;
  function kitCompany() {
    return KIT_COMPANY || (KIT_COMPANY = (root.PMCCampCompany || require('./camp-company.js'))({
      COMPANY_COST: COMPANY_COST, R: R, RECRUIT_COST: RECRUIT_COST, addLoss: addLoss, byRid: byRid,
      canTakeHonour: canTakeHonour, canTakeUpgrade: canTakeUpgrade, commandKey: commandKey,
      fitCommand: fitCommand, hasDoctrine: hasDoctrine, honourTable: honourTable, isBugKey: isBugKey,
      isLeaderP: isLeaderP, isTurretP: isTurretP, isXenoKey: isXenoKey, massOf: massOf, money: money,
      newEntry: newEntry, poolOf: poolOf, profile: profile, promotionCost: promotionCost,
      promotionTargets: promotionTargets, upgradeTable: upgradeTable
    }));
  }
  function fieldReport(co, battleTier, pl, available) { return (KIT_COMPANY || kitCompany()).fieldReport(co, battleTier, pl, available); }
  function canFieldArmy(co, battleTier, pl, available) { return (KIT_COMPANY || kitCompany()).canFieldArmy(co, battleTier, pl, available); }
  function asPromoted(co, next) { return (KIT_COMPANY || kitCompany()).asPromoted(co, next); }
  function promotionProgress(co) { return (KIT_COMPANY || kitCompany()).promotionProgress(co); }
  function canPromoteCompany(co) { return (KIT_COMPANY || kitCompany()).canPromoteCompany(co); }
  function promoteCompany(co) { return (KIT_COMPANY || kitCompany()).promoteCompany(co); }
  function canAspire(co) { return (KIT_COMPANY || kitCompany()).canAspire(co); }
  function effectiveTier(co) { return (KIT_COMPANY || kitCompany()).effectiveTier(co); }
  function recruitCost(co, key) { return (KIT_COMPANY || kitCompany()).recruitCost(co, key); }
  function canRecruit(co, key) { return (KIT_COMPANY || kitCompany()).canRecruit(co, key); }
  function recruit(co, key, opts) { return (KIT_COMPANY || kitCompany()).recruit(co, key, opts); }
  function canDisband(co, entry) { return (KIT_COMPANY || kitCompany()).canDisband(co, entry); }
  function disband(co, entry) { return (KIT_COMPANY || kitCompany()).disband(co, entry); }
  function promoteUnit(co, entry, newKey) { return (KIT_COMPANY || kitCompany()).promoteUnit(co, entry, newKey); }
  function takeHonour(co, entry, honourN) { return (KIT_COMPANY || kitCompany()).takeHonour(co, entry, honourN); }
  function takeUpgrade(co, entry, upgradeN) { return (KIT_COMPANY || kitCompany()).takeUpgrade(co, entry, upgradeN); }
  /* ---- the contract and its pay: in rules/camp-contract.js ---- */
  var KIT_CONTRACT = null;
  function kitContract() {
    return KIT_CONTRACT || (KIT_CONTRACT = (root.PMCCampContract || require('./camp-contract.js'))({
      R: R, SCENARIOS: SCENARIOS, SCENARIO_NAMES: SCENARIO_NAMES, byRid: byRid, canFieldArmy: canFieldArmy,
      d10: d10, d3: d3, d6: d6, effectiveTier: effectiveTier, hasDoctrine: hasDoctrine,
      hasTraumaFlag: hasTraumaFlag, isTurretP: isTurretP, isXenoKey: isXenoKey, money: money,
      newEntry: newEntry, pick: pick, profile: profile, takesHonours: takesHonours, traumaTable: traumaTable,
      words: words
    }));
  }
  function fieldableTier(co, pl) { return (KIT_CONTRACT || kitContract()).fieldableTier(co, pl); }
  function maxBattleTier(coA, coB, pl) { return (KIT_CONTRACT || kitContract()).maxBattleTier(coA, coB, pl); }
  function levelsFor(coA, coB, tier) { return (KIT_CONTRACT || kitContract()).levelsFor(coA, coB, tier); }
  function canStandard(coA, coB) { return (KIT_CONTRACT || kitContract()).canStandard(coA, coB); }
  function rollBattleTier(coA, coB, pl) { return (KIT_CONTRACT || kitContract()).rollBattleTier(coA, coB, pl); }
  function rollScenario(useD3) { return (KIT_CONTRACT || kitContract()).rollScenario(useD3); }
  function swapAllowance(co, listLength) { return (KIT_CONTRACT || kitContract()).swapAllowance(co, listLength); }
  function rollPayment(battleTier, pl) { return (KIT_CONTRACT || kitContract()).rollPayment(battleTier, pl); }
  function sum(a) { return (KIT_CONTRACT || kitContract()).sum(a); }
  function negotiate(dice) { return (KIT_CONTRACT || kitContract()).negotiate(dice); }
  function territorial(co, dice, won, lost) { return (KIT_CONTRACT || kitContract()).territorial(co, dice, won, lost); }
  function payment(battleTier, pl, coA, coB, winner, attackDefend, preset) { return (KIT_CONTRACT || kitContract()).payment(battleTier, pl, coA, coB, winner, attackDefend, preset); }
  function expFor(line, ctx) { return (KIT_CONTRACT || kitContract()).expFor(line, ctx); }
  function tpFor(line, ctx) { return (KIT_CONTRACT || kitContract()).tpFor(line, ctx); }
  function traumaThreshold(co) { return (KIT_CONTRACT || kitContract()).traumaThreshold(co); }
  function rollTrauma(entry) { return (KIT_CONTRACT || kitContract()).rollTrauma(entry); }
  function salvage(line, entry, won) { return (KIT_CONTRACT || kitContract()).salvage(line, entry, won); }
  function rollTP(campaign, report, side) { return (KIT_CONTRACT || kitContract()).rollTP(campaign, report, side); }
  function weakCandidates(campaign, side, rolled) { return (KIT_CONTRACT || kitContract()).weakCandidates(campaign, side, rolled); }
  function rebirth(co, offer) { return (KIT_CONTRACT || kitContract()).rebirth(co, offer); }
  var SCENARIOS = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
  // the scenarios with an attacker and a defender (pp. 53-55)
  var ATTACK_DEFEND = ['invasion', 'demolish', 'takeover'];
  var SCENARIO_NAMES = {
    meeting: 'Meeting engagement', secure: 'Secure and control', find: 'Find and secure',
    invasion: 'Invasion', demolish: 'Demolish', takeover: 'Hostile takeover'
  };
  /* ---- after the battle: in rules/camp-aftermath.js ---- */
  var KIT_AFTERMATH = null;
  function kitAftermath() {
    return KIT_AFTERMATH || (KIT_AFTERMATH = (root.PMCCampAftermath || require('./camp-aftermath.js'))({
      ATTACK_DEFEND: ATTACK_DEFEND, R: R, SCENARIOS: SCENARIOS, addLoss: addLoss, biomassTally: biomassTally,
      byRid: byRid, canFieldArmy: canFieldArmy, d3: d3, d6: d6, developRival: developRival, expFor: expFor,
      hasDoctrine: hasDoctrine, hasTraumaFlag: hasTraumaFlag, isLeaderP: isLeaderP, manned: manned,
      newCompany: newCompany, newEntry: newEntry, payment: payment, pick: pick, poolOf: poolOf,
      poolsFor: poolsFor, profile: profile, recruitCost: recruitCost, rollTP: rollTP, rollTrauma: rollTrauma,
      salvage: salvage, shuffle: shuffle, tpFor: tpFor, traumaTable: traumaTable,
      traumaThreshold: traumaThreshold, weakCandidates: weakCandidates, weightOf: weightOf
    }));
  }
  function aftermath(campaign, report, opts) { return (KIT_AFTERMATH || kitAftermath()).aftermath(campaign, report, opts); }
  function rebuildNeeds(co) { return (KIT_AFTERMATH || kitAftermath()).rebuildNeeds(co); }

  /* ================= the rival's development policy (solo play) =================
     Deliberately simple and legible: fix any legality gap first, then promote the
     unit closest to affording it, then bank toward the next Company Tier. */
  /* ================= rival companies (solo play) =================
     A rival is not a random list: it is one of five archetypes, and the archetype
     decides what it founds with, which doctrines it reaches for, what it recruits
     and how it spends experience. Over a dozen battles it grows into something
     recognisable, which is the whole point of fighting the same company twice. */
  var ARCHETYPES = [
    {
      id: 'armour', name: 'Armoured',
      blurb: 'Fights from behind armour plate and expects you to come to it.',
      names: ['Kessler Combine', 'Ironvein Holdings', 'Bastion Werke', 'Sable Armour Group'],
      t1: ['enforcers', 'recruits'],
      t2: ['ecobats', 'rookie'],
      machines: ['lpv', 'unarmoured'], vehicles: 2,
      doctrines: ['O1', 'T4', 'S2', 'T2', 'S3', 'O6'],
      groups: ['Combat vehicles', 'Transport vehicles', 'Heavy infantry', 'Hunters and destroyers'],
      spend: 'machines'
    },
    {
      id: 'elite', name: 'Elite',
      blurb: 'Few units, all of them expensive, all of them good.',
      names: ['Vantage Solutions', 'The Ashen Line', 'Praetor Associates', 'Halcyon Executive'],
      t1: ['enforcers', 'recruits'],
      t2: ['rookie', 'ecobats'],
      machines: ['lpv'], vehicles: 1,
      doctrines: ['S6', 'T4', 'S3', 'O2', 'T1', 'S2'],
      groups: ['Rifle infantry', 'Heavy infantry', 'Assault troops'],
      spend: 'promote'
    },
    {
      id: 'swarm', name: 'Swarm',
      blurb: 'Buries a position under more bodies than it can shoot.',
      names: ['Corvid Contracting', 'The Tide Company', 'Grey Market Levies', 'Nineteen Hands'],
      t1: ['recruits', 'irregulars', 'penal'],
      t2: ['rookie', 'lighteng'],
      machines: ['unarmoured'], vehicles: 1,
      doctrines: ['O5', 'O2', 'T1', 'T2', 'S5', 'O6'],
      groups: ['Basic troops', 'Rifle infantry', 'Assault troops'],
      spend: 'recruit'
    },
    {
      id: 'marksmen', name: 'Marksmen',
      blurb: 'Shoots from a long way off and moves before you can answer.',
      names: ['Meridian Security', 'Longsight Partners', 'The Quiet Trade', 'Orlov Group'],
      t1: ['mortarsection', 'recruits'],
      t2: ['observers', 'lmgsection', 'lightat'],
      machines: ['lpv'], vehicles: 1,
      doctrines: ['T6', 'T3', 'O4', 'S2', 'S3', 'O6'],
      groups: ['Light infantry', 'Light support', 'Heavy support', 'Remote mortars'],
      spend: 'honours'
    },
    {
      id: 'shock', name: 'Shock',
      blurb: 'Closes the distance and settles it with knives.',
      names: ['Black Harbour PMC', 'Redline Assault', 'The Hard Bargain', 'Kroeger Shock'],
      t1: ['irregulars', 'penal', 'enforcers'],
      t2: ['lighteng', 'rookie'],
      machines: ['ltransport', 'unarmoured'], vehicles: 2,
      doctrines: ['T4', 'T2', 'S5', 'T1', 'O6', 'S6'],
      groups: ['Assault troops', 'Basic troops', 'Heavy infantry'],
      spend: 'promote'
    }
  ];

  /* Rebel groups a solo campaign fights, drawn from the factions the book names
     on p. 111 and the kinds of revolt the list supports. Same shape as the PMC
     archetypes, so one policy engine runs both. */
  var REBEL_ARCHETYPES = [
    {
      id: 'redfront', name: 'Red Revolutionary Front', faction: 'rebel',
      blurb: 'Two centuries underground, and organised down to the last cell.',
      names: ['Red Revolutionary Front', 'The Combine Committee', 'Ninth of Marzen', 'Union Irregulars'],
      t1: ['rciv', 'rdesconscript'],
      t2: ['rmilitia', 'rlmg'],
      machines: ['rtechnical', 'rltv'], vehicles: 2,
      doctrines: ['H1', 'V1', 'H4', 'V6', 'H5', 'V2'],
      groups: ['Freedom Warriors', 'Rebel support troops', 'Rebel combat vehicles', 'Rebel transport vehicles'],
      spend: 'recruit'
    },
    {
      id: 'freespace', name: 'Free Space Freedom Fighters', faction: 'rebel',
      blurb: 'Pirates with a manifesto. Fast in, loaded up, gone.',
      names: ['Free Space Freedom Fighters', 'The Long Haul', 'Kestrel Run', 'Salvage Rights'],
      t1: ['rridergang', 'rciv'],
      t2: ['rriderwar', 'rmilitia'],
      machines: ['rtechnical'], vehicles: 1,
      doctrines: ['V2', 'V6', 'V1', 'H3', 'V3', 'H2'],
      groups: ['Mounted Warriors', 'Freedom Warriors', 'Rebel combat vehicles'],
      spend: 'machines'
    },
    {
      id: 'faithful', name: 'The Faithful', faction: 'rebel',
      blurb: 'They are not fighting for the colony. They are fighting for what comes after it.',
      names: ['The New Chosen', 'Pilgrims of the Seventh Gate', 'The Ashfall Congregation', 'Sons of the Furnace'],
      t1: ['rciv', 'rdesconscript'],
      t2: ['racolytes', 'rmilitia'],
      machines: ['rtechnical'], vehicles: 1,
      doctrines: ['P5', 'P2', 'P4', 'P3', 'P1', 'H1'],
      groups: ['Holy Warriors', 'Freedom Warriors'],
      spend: 'promote'
    },
    {
      id: 'pitheads', name: 'The Pitheads', faction: 'rebel',
      blurb: 'Miners who worked out that a cutting charge does the same job above ground.',
      names: ['The Pitheads', 'Shaft Fourteen', 'The Deep Seam Council', 'Hollowmen'],
      t1: ['rciv', 'rdesconscript'],
      t2: ['rminers', 'rlmg'],
      machines: ['rltv', 'rtechnical'], vehicles: 2,
      doctrines: ['V1', 'H4', 'H5', 'V5', 'H1', 'V6'],
      groups: ['Miners', 'Freedom Warriors', 'Rebel artillery'],
      spend: 'promote'
    },
    {
      id: 'partisans', name: 'The Partisans', faction: 'rebel',
      blurb: 'Out of the tunnels, into the dark, and never where you left them.',
      names: ['The Partisans', 'Night Wire', 'The Quiet Column', 'Cell Sixteen'],
      t1: ['rciv', 'rridergang'],
      t2: ['rmilitia', 'rminers'],
      machines: ['rtechnical'], vehicles: 1,
      doctrines: ['V3', 'H2', 'V4', 'V1', 'H4', 'V5'],
      groups: ['Chosen Warriors', 'Freedom Warriors', 'Rebel support troops'],
      spend: 'honours'
    }
  ];
  /* Swarms a campaign may meet, from the book's own write-ups (pp. 125-127). */
  var BUG_ARCHETYPES = [
    {
      id: 'ivenbea', name: 'Swarm of Ivenbea', faction: 'bugs',
      blurb: 'Mantis-like apex predators of the Ivenbean swamps: few, huge, and very close.',
      names: ['Swarm of Ivenbea', 'The Swamp Mantids', 'Ivenbean Brood'],
      t1: ['btiny', 'bspitlarva'], t2: ['bsmall', 'bsmallpath'],
      machines: [], vehicles: 0,
      doctrines: ['BB4', 'BP6', 'BP5', 'BC1', 'BB5', 'BP2'],
      groups: ['Lesser Bugs', 'Flying Bugs', 'Pioneer Bugs'],
      spend: 'promote'
    },
    {
      id: 'evatus', name: 'Mound swarms of Evatus II', faction: 'bugs',
      blurb: 'One of ten thousand mound swarms on a dead world, and never short of bodies.',
      names: ['Mound Swarm of Evatus II', 'The Evatus Mound', 'Red Mound Swarm'],
      t1: ['btiny', 'btiny', 'bspitlarva'], t2: ['bsmall', 'bimmspit'],
      machines: [], vehicles: 0,
      doctrines: ['BP1', 'BP2', 'BB1', 'BP3', 'BC1', 'BP5'],
      groups: ['Lesser Bugs', 'Underground Bugs', 'Spore Bugs'],
      spend: 'recruit'
    },
    {
      id: 'terarson', name: 'Swarm of Terarson', faction: 'bugs',
      blurb: 'Something taught these bugs to think. They build cities now.',
      names: ['Swarm of Terarson', 'The Terarson Hive', 'GN-786 Swarm'],
      t1: ['bspitlarva', 'btiny'], t2: ['bimmspit', 'bsmallpath'],
      machines: [], vehicles: 0,
      doctrines: ['BB3', 'BC3', 'BC2', 'BC6', 'BB6', 'BC4'],
      groups: ['Spore Bugs', 'Leader Bugs', 'Pioneer Bugs', 'Flying Bugs'],
      spend: 'honours'
    },
    {
      id: 'hydra', name: 'Swarms of the Hydra Belt', faction: 'bugs',
      blurb: 'Mining bio-robots gone wild, tunnelling through asteroid after asteroid.',
      names: ['Hydra Belt Swarm', 'The Uranium Diggers', 'Asteroid Swarm 7'],
      t1: ['btiny', 'bspitlarva'], t2: ['bsmall', 'bsmallpath'],
      machines: [], vehicles: 0,
      doctrines: ['BB2', 'BP5', 'BP2', 'BP6', 'BB1', 'BP1'],
      groups: ['Underground Bugs', 'Lesser Bugs', 'Pioneer Bugs'],
      spend: 'promote'
    }
  ];
  /* Tribes a campaign may meet, from the book's own write-ups (pp. 144-145). */
  var XENO_ARCHETYPES = [
    {
      id: 'mithdu', name: 'Mithdu-2 tribe', faction: 'xeno',
      blurb: 'The first tribe found, and slow to grow — but it has tunnels under everything.',
      names: ['Mithdu-2 Tribe', 'The Klechtu Burrows', 'Mithdu Deepholds'],
      t1: ['xeps1', 'xdelta1'], t2: ['xeps2', 'xbeta2'],
      machines: ['xdturret1'], vehicles: 1,
      doctrines: ['XO2', 'XT4', 'XO1', 'XS3', 'XO5', 'XT2'],
      groups: ['Epsilon Squads', 'Defensive Turrets', 'Teleport Turrets', 'Beta Squads'],
      spend: 'promote'
    },
    {
      id: 'amt', name: 'Amt tribe', faction: 'xeno',
      blurb: 'Rules a whole planet from its towers, and fights the way it builds: precisely.',
      names: ['The Amt', 'Amt Tower-tribe', 'The Sigma-Pi Tribe'],
      t1: ['xeps1', 'xdelta1'], t2: ['xbeta2', 'xeps2'],
      machines: ['xstrike2'], vehicles: 1,
      doctrines: ['XT6', 'XT1', 'XO3', 'XT5', 'XS6', 'XO4'],
      groups: ['Gamma Squads', 'Strike Aviation', 'Support Aviation', 'Beta Squads'],
      spend: 'honours'
    },
    {
      id: 'hashamer', name: 'Hashamer I tribe', faction: 'xeno',
      blurb: 'Nine million Esh-Aven and not a Crock among them — copying their masters\' war as best they can.',
      names: ['Hashamer I Tribe', 'The Hashamer Esh-Aven', 'The Arid Host'],
      t1: ['xeps1', 'xeps1', 'xdelta1'], t2: ['xeps2', 'xdelta2'],
      machines: [], vehicles: 0,
      doctrines: ['XS1', 'XS5', 'XO2', 'XT2', 'XS3', 'XO6'],
      groups: ['Epsilon Squads', 'Delta Squads'],
      spend: 'recruit'
    },
    {
      id: 'ghadon', name: 'Ghadon II 3rd tribe', faction: 'xeno',
      blurb: 'Came to a world already overrun, and fought humans, bugs and other tribes with equal fury.',
      names: ['Ghadon II 3rd Tribe', 'The Third of Ghadon', 'The Expansion'],
      t1: ['xdelta1', 'xeps1'], t2: ['xdelta2', 'xeps2'],
      machines: ['xstrike2'], vehicles: 1,
      doctrines: ['XO6', 'XO5', 'XS4', 'XT3', 'XO3', 'XS6'],
      groups: ['Delta Squads', 'Epsilon Squads', 'Strike Aviation', 'Gamma Squads'],
      spend: 'promote'
    }
  ];
  function archetypesFor(faction) {
    return faction === 'rebel' ? REBEL_ARCHETYPES : faction === 'bugs' ? BUG_ARCHETYPES
      : faction === 'xeno' ? XENO_ARCHETYPES : ARCHETYPES;
  }

  function archetype(id) {
    var all = ARCHETYPES.concat(REBEL_ARCHETYPES).concat(BUG_ARCHETYPES).concat(XENO_ARCHETYPES);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return ARCHETYPES[0];
  }


  /* ================= the other forces on the world =================
     A campaign is fought against three of them rather than one, in whatever mix
     of mercenary companies and revolts the draw produces. All three are alive
     between your battles: the two you did not fight were fighting somebody else,
     and earn and develop accordingly. Whichever is drawn against you is brought
     up to your own standing, give or take a Tier.

     One copy of each lives in `campaign.rivals`; `companies.B` is a live alias
     into that array, restored after every load, so the aftermath writes to the
     force the player actually fought. */
  var RIVAL_COUNT = 3;
  /* ---- the other forces on the world: in rules/camp-rivals.js ---- */
  var KIT_RIVALS = null;
  function kitRivals() {
    return KIT_RIVALS || (KIT_RIVALS = (root.PMCCampRivals || require('./camp-rivals.js'))({
      COMPANY_COST: COMPANY_COST, LEADERBUG_BY_TIER: LEADERBUG_BY_TIER, R: R, RECRUIT_COST: RECRUIT_COST,
      RIVAL_COUNT: RIVAL_COUNT, archetype: archetype, archetypesFor: archetypesFor, asPromoted: asPromoted,
      availableUpgrades: availableUpgrades, byRid: byRid, canFieldArmy: canFieldArmy,
      canPromoteCompany: canPromoteCompany, canRecruit: canRecruit, canTakeDoctrine: canTakeDoctrine,
      canTakeHonour: canTakeHonour, canTakeUpgrade: canTakeUpgrade, chooseHonour: chooseHonour,
      creedById: creedById, creedOf: creedOf, d6: d6, drawHonours: drawHonours, fieldReport: fieldReport,
      found: found, hasDoctrine: hasDoctrine, isLeaderP: isLeaderP, levelsFor: levelsFor,
      maxBattleTier: maxBattleTier, newCompany: newCompany, pick: pick, profile: profile,
      promoteCompany: promoteCompany, promoteUnit: promoteUnit, promotionCost: promotionCost,
      promotionTargets: promotionTargets, rebuildNeeds: rebuildNeeds, recruit: recruit,
      recruitCost: recruitCost, rollBattleTier: rollBattleTier, rollPayment: rollPayment,
      rollScenario: rollScenario, root: root, shuffle: shuffle, sum: sum, takeHonour: takeHonour,
      takeUpgrade: takeUpgrade, words: words
    }));
  }
  function faceRival(campaign, i) { return (KIT_RIVALS || kitRivals()).faceRival(campaign, i); }
  function rehydrate(campaign) { return (KIT_RIVALS || kitRivals()).rehydrate(campaign); }
  function forSave(campaign) { return (KIT_RIVALS || kitRivals()).forSave(campaign); }
  function foundRivals(campaign, n, opts) { return (KIT_RIVALS || kitRivals()).foundRivals(campaign, n, opts); }
  function rollOffers(campaign) { return (KIT_RIVALS || kitRivals()).rollOffers(campaign); }
  function clearOffers(campaign) { return (KIT_RIVALS || kitRivals()).clearOffers(campaign); }
  function drawRival(campaign) { return (KIT_RIVALS || kitRivals()).drawRival(campaign); }
  function catchUpTarget(playerTier) { return (KIT_RIVALS || kitRivals()).catchUpTarget(playerTier); }
  function deepen(co, tier, pl, asTier) { return (KIT_RIVALS || kitRivals()).deepen(co, tier, pl, asTier); }
  function catchUp(co, target) { return (KIT_RIVALS || kitRivals()).catchUp(co, target); }
  function idleTurn(co) { return (KIT_RIVALS || kitRivals()).idleTurn(co); }
  function foundRival(co, archId, usedNames) { return (KIT_RIVALS || kitRivals()).foundRival(co, archId, usedNames); }
  function developRival(co) { return (KIT_RIVALS || kitRivals()).developRival(co); }
  root.PMCCamp = {
    VERSION: VERSION,
    DOCTRINES: DOCTRINES, CATEGORIES: CATEGORIES,
    doctrine: function (id) { return BY_DOCTRINE[id] || BY_PATH[id] || BY_PATHWAY[id] || BY_ADVANCEMENT[id]; },
    PATHS: PATHS, PATH_GROUPS: PATH_GROUPS, BY_PATH: BY_PATH,
    PATHWAYS: PATHWAYS, PATHWAY_GROUPS: PATHWAY_GROUPS, BY_PATHWAY: BY_PATHWAY,
    ADAPTATIONS: ADAPTATIONS, FLAWS: FLAWS, BUG_ARCHETYPES: BUG_ARCHETYPES,
    ADVANCEMENTS: ADVANCEMENTS, ADVANCEMENT_GROUPS: ADVANCEMENT_GROUPS, BY_ADVANCEMENT: BY_ADVANCEMENT,
    RITES: RITES, INFAMIES: INFAMIES, XENO_AIR_UPGRADES: XENO_AIR_UPGRADES, XENO_ARCHETYPES: XENO_ARCHETYPES,
    ALPHA_BY_TIER: ALPHA_BY_TIER, upgradeTable: upgradeTable, isLeaderP: isLeaderP, territorial: territorial, ATTACK_DEFEND: ATTACK_DEFEND,
    honourTable: honourTable, traumaTable: traumaTable, isLeaderKey: isLeaderKey, words: words,
    LEADERBUG_BY_TIER: LEADERBUG_BY_TIER, takesHonours: takesHonours,
    creedOf: creedOf, creedById: creedById, money: money, commandKey: commandKey,
    recruitCost: recruitCost, REBEL_ARCHETYPES: REBEL_ARCHETYPES, archetypesFor: archetypesFor,
    RIVAL_COUNT: RIVAL_COUNT, foundRivals: foundRivals, drawRival: drawRival, faceRival: faceRival,
    rollOffers: rollOffers, clearOffers: clearOffers,
    rehydrate: rehydrate, forSave: forSave, catchUp: catchUp, catchUpTarget: catchUpTarget,
    idleTurn: idleTurn, fieldableTier: fieldableTier, levelsFor: levelsFor, canStandard: canStandard, rollTP: rollTP, weakCandidates: weakCandidates, rebirth: rebirth, deepen: deepen,
    HONOURS: HONOURS, TRAUMAS: TRAUMAS, UPGRADES: UPGRADES,
    RECRUIT_COST: RECRUIT_COST, COMPANY_COST: COMPANY_COST,
    SCENARIOS: SCENARIOS, SCENARIO_NAMES: SCENARIO_NAMES,
    COMMAND_BY_TIER: COMMAND_BY_TIER,

    newCampaign: newCampaign, newCompany: newCompany, newEntry: newEntry, menOf: menOf, renameSoldier: renameSoldier, strengthOf: strengthOf, lossStats: lossStats, poolOf: poolOf, experienceStats: experienceStats, traumaStats: traumaStats, winStats: winStats, biomassTally: biomassTally,
    found: found, foundingCheck: foundingCheck, byRid: byRid, fitCommand: fitCommand,

    effects: effects, applyEntry: applyEntry, moveBonus: moveBonus,
    hasTraumaFlag: hasTraumaFlag, hasHonourFlag: hasHonourFlag,

    promotionTargets: promotionTargets, promotionCost: promotionCost, promoteUnit: promoteUnit,
    honourCost: honourCost, honourCap: honourCap, upgradeCap: upgradeCap,
    canTakeHonour: canTakeHonour, availableHonours: availableHonours,
    drawHonours: drawHonours, chooseHonour: chooseHonour, takeHonour: takeHonour,
    canTakeUpgrade: canTakeUpgrade, availableUpgrades: availableUpgrades, takeUpgrade: takeUpgrade,

    hasDoctrine: hasDoctrine, canTakeDoctrine: canTakeDoctrine, doctrineSlots: doctrineSlots,
    canSwapDoctrine: canSwapDoctrine, swapDoctrine: swapDoctrine,
    canFieldArmy: canFieldArmy, canPromoteCompany: canPromoteCompany, promoteCompany: promoteCompany,
    canAspire: canAspire, effectiveTier: effectiveTier, rebuildNeeds: rebuildNeeds,
    traumaThreshold: traumaThreshold,
    promotionProgress: promotionProgress, fieldReport: fieldReport,
    canRecruit: canRecruit, recruit: recruit, canDisband: canDisband, disband: disband,

    maxBattleTier: maxBattleTier, rollBattleTier: rollBattleTier, rollScenario: rollScenario,
    swapAllowance: swapAllowance,
    rollPayment: rollPayment, negotiate: negotiate, payment: payment,
    expFor: expFor, tpFor: tpFor, traumaThreshold: traumaThreshold, rollTrauma: rollTrauma,
    salvage: salvage, aftermath: aftermath, developRival: developRival,
    ARCHETYPES: ARCHETYPES, archetype: archetype, foundRival: foundRival,
    d6: d6, d3: d3, d10: d10
  };
})(typeof window !== 'undefined' ? window : global);
