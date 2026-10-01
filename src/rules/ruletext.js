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
      'Bugs shrug off hits: on the hit table 1-3 is ignored and 4-6 loses one bug and takes 2 Suppression. They re-roll failed ' +
      'rally dice, but take no cover from terrain unless an Overmind is in reach.',
    'Anti-aircraft':
      '+4 to hit aircraft, and a critical hit on an aircraft does D6 Damage instead of D3. ' +
      'Works even when firing at Basic Firepower.',
    'Anti-tank':
      '+4 to hit ground vehicles, and a critical hit on a ground vehicle does D6 Damage instead of D3. ' +
      'Works even when firing at Basic Firepower, and the shot strips the +2 from Battle Armour.',
    'Anti-tank (limited)':
      'Counts as Anti-tank — +4 against ground vehicles, D6 criticals, pierces Battle Armour — but only against ' +
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
      'A Command Unit riding inside lends the vehicle all of its special rules, and when the vehicle finishes its ' +
      'activation the unit may take one of its special actions from inside — Coordinate or any other it has — or none ' +
      '(only while steady). It counts as stationary for it.',
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
    'Drone unit':
      'Robots: Determined, and loses all its Suppression in the Rally phase. Hits on it add 1 to the roll. ' +
      'No more Drone units than other units in the army, and no Experience or Trauma in a campaign.',
    'Endless Tide':
      'In the End phase, an unbroken unit below its starting size with an unsuppressed Overmind in reach ' +
      'gets D3 lost bugs back.',
    'Expendable':
      'The moment it becomes Broken the collars go off: every man left is killed and the unit is removed. Penal ' +
      'troops never count as casualties for victory, and in a campaign their dead are kept apart from the loss rate.',
    'Field Medics':
      'Friendly units within 6" (and the medics themselves) use a kinder hit table: 1-2 no effect, 3-5 one SP, ' +
      '6 a MEDIC! roll — 1 SP and a casualty, unless a further D6 rolls a 6 and saves him. Suppressed or Broken, ' +
      'the medics treat only their own wounded (p. 29).',
    'Flying Infantry':
      'Flies over terrain (but cannot land on impassable ground), takes no cover, and always shoots and is ' +
      'shot at with Basic Firepower. Only Flying Infantry can assault it, and it may assault aircraft.',
    // not printed on any profile: every aircraft with Firepower may make one (p. 27)
    'Strafing Run':
      'An aircraft with Firepower may fly up to its full Movement in a straight run and fire at every enemy ground unit ' +
      'within 2" of its path. Its own side\'s units under the run are caught on a D6 of 1-3, and every enemy still able may fire back.',
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
      'turn and takes D3+1 hits, 5-6 you activate it at once under your control (it goes back to its owner next ' +
      'turn), then it takes the same hits. A drone that has already acted, or cannot act, counts 5-6 as 3-4.',
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
      'A flying crane: it picks up a single ground vehicle within 4", along with anyone riding in it. It never ' +
      'carries infantry or an emplaced gun, nor a vehicle towing one (p. 94).',
    'Limited Fire Arc':
      'Its main weapon can only fire at targets in its front quarter.',
    'Markerlights':
      'Designate or Mark an enemy within 24" in sight (12" against Stealth). Designate calls friendly Indirect ' +
      'Fire units to shoot it at once without needing sight; Mark calls units that can see it to fire as though ' +
      'at half range (+2). One unit answers each call, and counts as activated. Standing still, it then calls ' +
      'again (the same enemy or another) for a second unit; moving first, it calls once.',
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
      'Animal Behaviour bugs of its Tier or lower within 18" take cover and lose all Suppression in the Rally phase. ' +
      'Any bug within 18", whatever its Tier, is not forced to charge by Aggressive, and Endless Tide works within 18" of an unsuppressed Overmind.',
    'Pheromone Markers':
      'Friendly Animal Behaviour bugs attacking a target within 18" of this unit get +1 to shoot and assault it, ' +
      'up to +3 from several marker units.',
    'Psychic Support':
      'Counts as Field Medics: friendly units within 6" use the kinder medic hit table. The Psychic Bond ' +
      'penalty still applies to it as normal.',
    // the Rebels' army rules, carried by every unit of theirs but printed on none (pp. 94-95)
    'Hasta la Victoria Siempre!':
      'Army rule: a Rebel infantry unit loses no Morale for its first two soldiers killed (three under Last ' +
      'Stand); further losses reduce it as normal.',
    'Undisciplined':
      'Army rule: shooting at a Broken Rebel unit, or one caught in a crossfire, adds +2 to the hit-effect rolls ' +
      'instead of +1.',
    'Riders upgrade':
      'Some Rebel units may be fielded as Riders: Size halved, Movement 10 and the Riders rule. In a campaign it ' +
      'is chosen when the unit is recruited, and cannot be changed.',
    'Last Stand':
      'Tactic: Rebel infantry get +4 Defence in terrain that gives a Defence bonus; up to 4 barricades (low walls) ' +
      'per Priority Level go down anywhere but the enemy deployment zone; and the first three soldiers killed cost ' +
      'no Morale, not two.',
    'Human Wave Attacks':
      'Tactic: 2 more infantry units per Priority Level, of the Battle Tier; infantry move M+4" on Move and ' +
      'Assault; "...but they\'ll never take our freedom!" and "Death or Glory, Comrades!" reach 18".',
    'Guerillas':
      'Tactic: every infantry unit without Riders gains Stealth and Battlefield Insertion.',
    // the Xenotripods' army rules, carried by every unit of theirs but printed on none (pp. 128-129)
    'Limited Senses':
      'Army rule (not drones): every Xenotripod unit sees only 12", except through Mental Projection.',
    'Mental Projection':
      'Army rule (not drones): an enemy seen by at least one unbroken Xenotripod unit is seen by the whole army. ' +
      'Indirect Fire units may also shoot through LoS-blocking terrain without Markerlights (which still give ' +
      'their other bonuses).',
    'Psychic Bond':
      'Army rule: a Xenotripod unit rallying may use the Morale of any friendly unit within 6". When a Xenotripod ' +
      'unit loses a model, each friendly unit within 6" takes a Suppression point.',
    'Psychic Wave':
      'Psychic Wave: move up to its Movement (or stay), then every enemy within 12" — no line of sight needed, ' +
      'drones excepted — takes D6-1 Suppression. Not while Suppressed.',
    'Riders':
      'Mounted: always moves Movement +4", but loses 2" for rough ground, cannot cross walls or enter buildings, ' +
      'and never rides in a transport. What it rides changes that: a motorbike may be carried but loses 6" to rough ground, ' +
      'a grav bike ignores the ground at \u22121 Defence, and a horse jumps walls but takes 1 more SP every time it is shot at.',
    'Sappers':
      'Breach: carry charges against any wall or building, +4, bringing it down on a final 15+ or an unmodified 9 ' +
      '(a failed attempt falls back 2"). In the first round of an assault on a unit in cover they get +4, and the ' +
      'same roll blows the cover in.',
    'Shield Generator (X)':
      'Friendly units wholly within 12" get +{X} Defence against shots fired from more than 12" away from the ' +
      'generator. Only the best shield counts; it adds to terrain bonuses.',
    'Smoke Markers':
      'Works like Markerlights, but designates only, out to 12" in sight: a smoke grenade and a flare on one or ' +
      'two enemies in turn, each answered at once by a friendly Indirect Fire unit that needs no sight — two calls even if this unit moved first.',
    'Specialisation (air)':
      'Its main weapon can only engage aircraft, never ground targets.',
    'Specialisation (ground)':
      'Its main weapon can only engage ground targets, never aircraft.',
    'Stationary Artillery':
      'An emplaced gun: it never moves and is never held in reserve, but a transport vehicle can tow it, the gun ' +
      'taking one of its places (a Lifter cannot lift a hull that is towing). Broken, it stays where it is ' +
      '(removed only if its rally still leaves it over three times its Morale); it never goes into a building, ' +
      'and counts shallow water as impassable. ' +
      'It can Dig in to fire over open sights — range 24", minimum 6", front quarter only, but with every modifier ' +
      '— and cannot then be turned or towed until Normal stance! puts it back.',
    'Stealth':
      '+1 Defence for every full 6" between it and the shooter, unless the shooter is Keen-Eyed. Markerlights ' +
      'can only pick it out within 12".',
    'Supporting Fire':
      'Support: shoot without the stationary Fire! bonus, then still load or unload troops in the same activation.',
    'Suppressive Fire':
      'Any shooting attack that scores hits — Basic Firepower and Indirect Fire included — adds +2 Suppression on top of the hit table. Not with the auxiliary weapon.',
    'Teleport':
      'Takes in a steady infantry unit within 4" that has not acted; on a D6 of 1-2 it comes out beside a random ' +
      'Teleport unit, on 3-6 beside the one you pick. The unit may still act this turn.',
    'Transport (X)':
      'Capacity {X}: carries that many infantry units, loaded within 4". Passengers are safe from fire and lose all Suppression; ' +
      'Suppressed or Broken units cannot board. No unit is loaded and unloaded in the same turn: nobody gets back on ' +
      'the turn they got off, nor off the turn they got on.',
    'Turret':
      'A stationary, Drone Controlled ground vehicle with no sides or rear: it never moves or assaults. All ' +
      'turrets activate at once; they do not count for Overwhelming Numbers and no rule that changes the ' +
      'activation order (Command Units and the like) touches them. It may be hacked as normal, but a 5-6 counts ' +
      'as 3-4. Defensive and teleport turrets are bought in groups; each is its own unit in the game, and a Tier I ' +
      'unit for victory and scenario purposes.',
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

  /* An army's own rules: the ones the whole army carries that no unit profile
     prints (the Rebels', pp. 94-95; the Xenotripods', pp. 128-129), and the
     special rules only its units carry — read off the profiles, so the list
     stays in step with them. The campaign's army card and the unit viewer both
     show it. */
  var ARMY_WIDE = {
    rebel: ['Hasta la Victoria Siempre!', 'Undisciplined', 'Riders upgrade'],
    xeno: ['Limited Senses', 'Mental Projection', 'Psychic Bond']
  };
  var NOT_ARMY = ['Immobile', 'No Objectives', 'Drone unit', 'Unarmed'];
  // what an army chooses for each battle (the Rebels' tactics, p. 95)
  var ARMY_CHOICES = { rebel: { title: 'Tactics \u2014 one chosen for each battle', list: ['Last Stand', 'Human Wave Attacks', 'Guerillas'] } };
  function armyRules(faction, catalogue) {
    var f = faction || 'pmc';
    var base = function (r) { return r.replace(/\s*\(.*\)$/, ''); };
    var owners = {}, first = {}, nums = {};
    (catalogue || []).forEach(function (p) {
      (p.rules || []).forEach(function (r) {
        var k = base(r), m = r.match(/\((\d+)\)\s*$/);
        (owners[k] = owners[k] || {})[p.faction || 'pmc'] = true;
        if (!first[k]) first[k] = r;
        // a rule whose number differs from unit to unit (Shield Generator 1 or 2): which units carry which
        if (m) { nums[k] = nums[k] || {}; (nums[k][m[1]] = nums[k][m[1]] || []).indexOf(p.group) < 0 && nums[k][m[1]].push(p.group); }
      });
    });
    function text(k) {
      var n = nums[k] ? Object.keys(nums[k]).sort() : [];
      if (n.length > 1 && TEXT[k + ' (X)']) {
        return TEXT[k + ' (X)'].replace(/\{X\}/g, n.join(' or ')) + ' (' + n.map(function (v) {
          return v + ': ' + nums[k][v].join(', ');
        }).join('; ') + ')';
      }
      var d = describe(first[k] || k);
      if (!d.text) d = describe(k);
      return d.text || '';
    }
    // the mercenaries are the standard: no rule of theirs is an army rule
    var own = f === 'pmc' ? [] : Object.keys(owners).filter(function (k) {
      return owners[k][f] && Object.keys(owners[k]).length === 1 && NOT_ARMY.indexOf(k) < 0;
    }).sort();
    var pair = function (k) { return { name: k, text: text(k) }; };
    return { wide: (ARMY_WIDE[f] || []).map(pair), own: own.map(pair), text: text };
  }

  root.PMCRuleText = {
    TEXT: TEXT,
    describe: describe,
    ARMY_WIDE: ARMY_WIDE,
    ARMY_CHOICES: ARMY_CHOICES,
    armyRules: armyRules
  };
})(typeof window !== 'undefined' ? window : global);
