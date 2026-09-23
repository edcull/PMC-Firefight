/* PMC 2670 — Firefight
   A short, player-facing line for every special rule a profile can carry, for
   the tooltips in the unit viewer and on the table.

   Each line says what the rule does here, in this implementation, with the
   numbers the engine actually uses — not the rulebook's wording. Where the book
   leaves something open and the game makes a call, the line describes the call.
   A rule that takes a number is written once, as "Name (X)", with {X} standing
   in for the number the profile carries; describe() puts it back.
*/
(function (root) {
  'use strict';

  var TEXT = {
    'Advanced Protection':
      'Heavily armoured all round: shooters get no +1 for its side or +2 for its rear, ' +
      'and infantry assaulting it do not get the usual +4 against a vehicle.',
    'Aggressive':
      'Must charge the closest enemy it can reach whenever it activates, unless a friendly Overmind ' +
      'within 18" is holding it back.',
    'Always Basic Firepower':
      'Its main weapon always fires at Basic Firepower: no +1 for a stationary Fire!, no half-range, ' +
      'Crossfire, height or Markerlight bonuses.',
    'Animal Behaviour':
      'Bugs shrug off hits: on the hit table 1-3 is ignored and 4+ kills one bug (2 SP). They re-roll failed ' +
      'rally dice, but take no cover from terrain unless an Overmind is in reach.',
    'Anti-aircraft':
      '+4 to hit aircraft, and a critical hit on an aircraft does D6 Damage instead of D3. ' +
      'Works even when firing at Basic Firepower.',
    'Anti-tank':
      '+4 to hit vehicles, critical hits on a vehicle do D6 Damage instead of D3, and the shot strips ' +
      'the +2 from Battle Armour.',
    'Anti-tank (limited)':
      'Counts as Anti-tank — +4 against vehicles, D6 criticals, pierces Battle Armour — but only against ' +
      'targets within 6".',
    'Battle Armour':
      'Its Defence includes +2 for the suits, lost against Anti-tank and Gauss weapons (the second Defence value). ' +
      'It takes no extra cover from terrain and is immune to Incendiary Ammunition\'s doubled suppression.',
    'Battlefield Insertion':
      'Held in reserve (up to half the force) and brought in during the Reserve phase of any turn but the first, ' +
      'at least 12" from an objective and 4" in from the edge. On a D6 of 4-6 the opponent shifts the landing ' +
      'point up to 2D6"; landing within 12" of the enemy draws a free Basic Firepower shot.',
    'Cloaking System':
      'Cannot be shot at or charged from more than 12" away.',
    'Command Unit (X)':
      'Coordinate: once a turn, stay put and let up to {X} friendly units within 12" activate one after another. ' +
      'Other Command Units, turrets and units two or more Tiers higher cannot be called on. Not used in solitaire games.',
    'Command Vehicle':
      'A Command Unit riding inside lends the vehicle all of its special rules, and coordinates as soon as the ' +
      'vehicle finishes its activation.',
    'Counter-jamming':
      'Friendly units within 6" ignore enemy Jammers and rally and repair on 4+ as normal. Only works while this ' +
      'unit is steady and on the table.',
    'Cumbersome Weapon':
      'May not Advance or Assault, and cannot fire its main weapon from shallow water or on the turn it got ' +
      'off a vehicle.',
    'Death or Glory, Comrades!':
      'A friendly unit within 12" (not Broken, not two Tiers higher) sheds all its Suppression as it launches ' +
      'an Assault, which also lets a Suppressed unit charge at all.',
    'Destructive Weapon':
      'Can Demolish walls and buildings: a final 15+ or an unmodified 9 brings the piece down. Shooting at a ' +
      'unit in or behind such a piece, the same roll blows the cover away — no cover bonus, and +1 on the hit table.',
    'Determined':
      'Its Morale never drops as the unit loses models.',
    'Dominant Species':
      'Regain Control: stay put, and every Epsilon squad of this Tier or lower within 12" loses all its ' +
      'Suppression. Not while Suppressed.',
    'Drone Control':
      'Crewless: +1 Structure, but enemy Hackers can take it over. It is also immune to Psychic Waves.',
    'Endless Tide':
      'In the End phase, an unbroken unit below its starting size with an unsuppressed Overmind in reach ' +
      'gets D3 lost bugs back.',
    'Expendable':
      'Removed from play the moment it becomes Broken. It has fled rather than died, so in a campaign it comes back.',
    'Field Medics':
      'Friendly units within 6" (and the medics themselves) use a kinder hit table: 1-2 no effect, 3-5 one SP, ' +
      '6 a MEDIC! roll — 1 SP and a casualty, unless a further D6 rolls a 6 and saves him. Only while steady.',
    'Flying Infantry':
      'Flies over terrain (but cannot land on impassable ground), takes no cover, and always shoots and is ' +
      'shot at with Basic Firepower. Only Flying Infantry can assault it, and it may assault aircraft.',
    'Flying unit':
      'An aircraft: flies over everything, never takes cover, shoots and is shot at with Basic Firepower, and is ' +
      'destroyed outright once Damage passes Structure. Cannot assault, be assaulted or hold objectives; may Strafe.',
    'Gauss Weapon':
      'Ignores the target\'s cover from terrain, strips the +2 from Battle Armour, and gets +1 to hit vehicles.',
    'Gauss Weapon (las-cutters)':
      'Mining las-cutters that count as a Gauss Weapon: they ignore cover, strip Battle Armour\'s +2 and get ' +
      '+1 against vehicles.',
    'Ground vehicle':
      'A vehicle: Structure instead of Morale, takes Damage rather than Suppression, moves Movement +4" but pays ' +
      'to turn and 2" for rough ground, never takes cover or suffers Crossfire, and is easier to hit from the side and rear.',
    'Hackers':
      'Hack: once a turn, reach into an enemy drone within 24". D6 — 1-2 nothing, 3-4 it is locked out for the ' +
      'turn and takes D3+1 hits, 5-6 it is first made to fire on its own side, then takes the same hits.',
    'Immobile':
      'Never moves. It comes down with a squad already aboard, can only put it out, and never takes anyone back on.',
    'Incendiary Ammunition':
      'Doubles the Suppression it causes on a target standing in terrain (not open ground or shallow water), ' +
      'unless the target has Battle Armour. Counts as a Destructive Weapon against buildings.',
    'Indirect Fire':
      'Its main weapon lobs rounds and fires at Basic Firepower. A Designate call from Markerlights or Smoke ' +
      'Markers lets it shoot without line of sight, and a low wall shelters its target whichever side it is on.',
    'Inspiring Presence':
      'Friendly units within 12" re-roll failed rally dice. Other Inspiring Presence units and units two or more ' +
      'Tiers higher do not benefit, and it only works while this unit is steady.',
    'Jammers':
      'Enemy units within 24" rally and repair on 5+ instead of 4+. Keeps working even while this unit is ' +
      'Suppressed or Broken.',
    'Keen-Eyed':
      'Sees through Stealth: targets get no Stealth bonus against its shots, and it can mark Stealth units ' +
      'at full range.',
    'Lifter':
      'A flying crane: it picks up a single vehicle within 4" — along with anyone riding in it — and never ' +
      'carries infantry.',
    'Limited Fire Arc':
      'Its main weapon can only fire at targets in its front quarter.',
    'Markerlights':
      'Designate or Mark an enemy within 24" in sight (12" against Stealth). Designate calls friendly Indirect ' +
      'Fire units to shoot it at once without needing sight; Mark calls units that can see it to fire as though ' +
      'at half range (+2). Standing still calls two units, moving first calls one.',
    'Minimum Range (X)':
      'Its main weapon cannot fire at targets closer than {X}".',
    'Molecular Reconstruction':
      'Self-repair: stay where it is and remove every Damage point.',
    'No Army Rules':
      'Outside the Rebel army rules: its Morale drops from the very first casualty, and it is not Undisciplined.',
    'No Objectives':
      'Cannot take or contest objectives, and does not count towards anyone\'s victory conditions.',
    'Overgrown Bug':
      'A bug the size of a tank: it follows the vehicle rules, but can still assault, with +4 against vehicles ' +
      'like infantry.',
    'Overgrown Flying Bug':
      'A bug the size of an aircraft: it follows the aircraft rules, but can still assault.',
    'Overmind':
      'Controls Animal Behaviour bugs of its Tier or lower within 18": they take cover, are not forced to charge ' +
      'by Aggressive, and lose all Suppression in the Rally phase. Endless Tide needs an unsuppressed Overmind.',
    'Pheromone Markers':
      'Friendly Animal Behaviour bugs attacking a target within 18" of this unit get +1 to shoot and assault it, ' +
      'up to +3 from several marker units.',
    'Psychic Support':
      'Counts as Field Medics: friendly units within 6" use the kinder medic hit table.',
    'Psychic Wave':
      'Psychic Wave: move up to its Movement (or stay), then every enemy within 12" — no line of sight needed, ' +
      'drones excepted — takes D6-1 Suppression. Not while Suppressed.',
    'Riders':
      'Mounted: always moves Movement +4", but loses 2" for rough ground, cannot cross walls or enter buildings, ' +
      'and never rides in a transport.',
    'Sappers':
      'Breach: carry charges against any wall or building, +4, bringing it down on a final 15+ or an unmodified 9 ' +
      '(a failed attempt falls back 2"). In the first round of an assault on a unit in cover they get +4, and the ' +
      'same roll blows the cover in.',
    'Shield Generator (X)':
      'Friendly units wholly within 12" get +{X} Defence against shots fired from more than 12" away from the ' +
      'generator. Only the best shield counts.',
    'Smoke Markers':
      'A smoke grenade and a flare on an enemy within 12" in sight: two friendly Indirect Fire units shoot it at ' +
      'once without needing sight, and this unit may move first.',
    'Specialisation (air)':
      'Its main weapon can only engage aircraft, never ground targets.',
    'Specialisation (ground)':
      'Its main weapon can only engage ground targets, never aircraft.',
    'Stationary Artillery':
      'An emplaced gun: it never moves and is never held in reserve, but a transport can tow it. It can Dig in to ' +
      'fire over open sights — range 24", minimum 6", front quarter only, but with every modifier.',
    'Stealth':
      '+1 Defence for every full 6" between it and the shooter, unless the shooter is Keen-Eyed. Markerlights ' +
      'can only pick it out within 12".',
    'Supporting Fire':
      'Support: shoot without the stationary Fire! bonus, then still load or unload troops in the same activation.',
    'Suppressive Fire':
      'A normal Fire! attack that hits adds +2 Suppression on top of the hit table. Does not apply at Basic Firepower.',
    'Teleport':
      'Takes in a steady infantry unit within 4" that has not acted; on a D6 of 1-2 it comes out beside a random ' +
      'Teleport unit, on 3-6 beside the one you pick. The unit may still act this turn.',
    'Transport (X)':
      'Capacity {X}: carries that many infantry units, loaded within 4". Passengers are safe from fire and lose all Suppression; ' +
      'Suppressed or Broken units cannot board, and nobody gets back on the turn they got off.',
    'Turret':
      'A stationary drone gun: never moves or assaults, has no side or rear, and all turrets activate together. ' +
      'Command Units cannot call on it, and Hackers cannot turn it against its own side.',
    'Unarmed':
      'Carries no weapons and cannot shoot.',
    '…but they\'ll never take our freedom!':
      'Friendly units within 12" (not Broken, not two Tiers higher, not other units with this rule) roll three ' +
      'extra dice when they rally. Only while this unit is steady.'
  };

  /* 'Command Unit (2)' -> the 'Command Unit (X)' text with 2 in place of {X}.
     A name with a number is tried against its "(X)" entry first, then as it
     stands; anything unknown comes back with empty text. */
  function describe(name) {
    name = String(name == null ? '' : name);
    var m = name.match(/^(.*)\((\d+)\)\s*$/), text;
    if (m) {
      var generic = m[1].replace(/\s+$/, '') + ' (X)';
      if (TEXT[generic]) text = TEXT[generic].replace(/\{X\}/g, m[2]);
    }
    if (text == null) text = TEXT[name] || '';
    return { name: name, text: text };
  }

  root.PMCRuleText = {
    TEXT: TEXT,
    describe: describe
  };
})(typeof window !== 'undefined' ? window : global);
