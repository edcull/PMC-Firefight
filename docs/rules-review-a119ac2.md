# Rules review at a119ac2

A fresh clause-by-clause review of the game against the rulebook (`PMC_2670.md`, 5,501 lines), at `a119ac2` (1 October 2026). It replaces the earlier reviews. Book references are rulebook line numbers (`l.`); code references are at `a119ac2`. Each finding was checked in the code, and most were run. Findings marked *ambiguous* are ones where the book can fairly be read the code's way; both readings are given, and they are the owner's call. Nothing was changed while reviewing.

Severity: **H** changes outcomes often or breaks a scenario; **M** wrong in a common case, or a missing rule or player choice; **L** an edge case, a small number, or a tooltip that misstates the rule.

## Contents

1. [Summary](#1-summary)
2. [Medium findings](#2-medium-findings)
3. [Low findings](#3-low-findings)
4. [Owner decisions](#4-owner-decisions)
5. [Coverage](#5-coverage)

## 1. Summary

No High findings. 14 Medium and 54 Low, 68 in all.

| Section | Book lines | M | L |
|---|---|---|---|
| The battle | 429–725 | 1 | 2 |
| Vehicles, aircraft and drones | 726–973 | 1 | 2 |
| Terrain and terrain generators | 974–1260 | 1 | 9 |
| Scenarios | 1261–1484 | 1 | 2 |
| General special rules and PMC units (1) | 1485–2003 | 1 | 2 |
| PMC units (2) | 2004–2528 | 0 | 2 |
| Campaign | 2529–2870 | 1 | 5 |
| Rebels | 2871–3600 | 2 | 3 |
| Space Bugs | 3601–4102 | 1 | 8 |
| Xenotripods | 4103–4751 | 2 | 13 |
| Solitaire and co-op | 4752–5118 | 3 | 5 |
| Appendices | 5119–5501 | 0 | 1 |
| **Total** | | **14** | **54** |

## 2. Medium findings

- **BAT-1 [M] Broken units run off whichever table edge they can reach, even sideways, when the book says they flee away from the closest enemy** — Book: l.716 "All Broken units have to flee Movement + 2" away from the closest enemy ... If the unit moves off of the table, it does not return". Code: `src/engine/endphase.js:62-77` (`fleeBroken`). `offFrom(c)` tests the distance to the nearest of all four edges (`edgeGap`, l.25), and any spot from which the unit could leave gets a +1e6 score. So any reachable exit beats every on-table spot, whatever direction it lies in relative to the enemy. Effect: a Broken infantry unit (M5) standing 3–5" from a flank edge, with the enemy 10" straight ahead, runs off the flank edge and is lost as fled. Under the book it would fall back 7" directly away and stay on the table to rally. The exit spot it takes is also closer to the enemy than the straight fall-back spot (14.6" against 17"). The same happens near any edge, including the enemy's. Being within M+2" of some edge is common on a 48"x36" table, so units that should survive are lost. (verified: ran `review/BAT_flee.js`: unit at (20,3) or (20,5) with the foe at (30,y) → fled; the same unit at y=18 → flees to (13,18) and stays.) [ambiguous: "in such a way as to avoid enemy units for as long as possible" could be read as allowing any escape route. The plain reading of "flee ... away from the closest enemy" is a fall-back directly away from that enemy, leaving the table only when that line crosses an edge. The existing test in `test/unit/highrules.js` covers only the unit's own rear edge.]
- **VEH-1 [M] Disembark: the player cannot choose which unit gets off** — Book: l.827 "The vehicle may unload one or more on-board infantry units". Code: `src/engine/combat.js:100-104` (`doDisembark`) always unloads `cargo.filter(!boarded)[0]`, the first unit loaded, and `src/engine/actions.js:590` (`dropFor`) offers drop spots only for that same unit. The player can stop after any squad (Cancel), but cannot skip the first one to unload only the second or third. The UI (`src/view/input.js:471`, `game.js:426`) sends only a position, never a rider id.
  Effect: on any Transport (2+) hull (Light/Heavy APC, Heavy IFV, Light transport, shuttles, rebel transports, etc.) carrying two or more squads, the player cannot put out only the squad they want. The other squad would also have to get off, and it cannot get back on that turn (l.837). (verified: read)
- **TER-1 [M] A unit that cannot garrison still occupies a building it wins an assault on** — Book: l.1000 "If the attackers win, they occupy the building"; buildings are entered by troops. Riders "cannot ... occupy a building" (p.94), and a vehicle cannot enter one. Code: `src/rules/assault.js:247-251` calls `enterBuilding(state, a, held.piece, held.sec)` without checking `canGarrison(a)` (`src/rules/space.js:58`), which is the check that enter-actions use. `canAssault` (`assault.js:25`) lets Overgrown bugs (which use the vehicle rules) and Riders charge. Effect: a Queen, Shadow bug or other Overgrown bug, or a Rider unit, that beats a garrison ends up inside the building. It gets the building's +2 Defence and Crossfire immunity, and like any garrison it cannot Move or Advance. (verified: ran a scratch script with a garrisoned `regular` in a 4"x4" building. In 200 assaults each: `bqueen` ended inside 138 times (182 with assault raised to 8). `rridergang` with assault raised to 8 ended inside 92 times. `review/ter_t1.js`)
- **SCN-1 [M] Invasion landing zones only 12" apart centre to centre, so one unit can hold or deny all three** — Book: l.1409 "nominates 3 landing zones at least 12" from other landing zones and 8" from table edges … Every landing zone is a round area 8" in diameter". Code: `src/rules/scenarios.js:678-689` `lzOK` measures the table-edge distance from the zone's edge (`8 + LZ_R`) but the zone-to-zone distance from centre to centre (`dist(p,q) >= 12`). That leaves only 4" between the edges of two zones. The comment above it (l.672-676) says "12" from the other zones' edges". `autoLZs` (l.699-717) pulls zones towards the centre, so the AI always nominates them at the 12.0" minimum. Effect: the edges of two zones are 4" apart, so a single unit between them is within 4" of both. The scoring in `holderOf` (4" from an area's edge) then gives one unit two zones, which is all the attacker needs to win Invasion. In the AI's usual triangle, one unit at the centroid holds all three. One defender squad there makes "all landing zones are hot" and blocks the second wave (`scenarios.js:326`). (verified: ran `scratchpad/review/scn_lz.js`: 30 autoLZs runs, minimum spacing 12.0–12.2" every time. Ran `scn_lz2.js`: one ready defender unit at the centroid → `holderOf` returns `['B','B','B']`.) [ambiguous: "12" from other landing zones" can be read centre to centre, which is the code's reading. But the book calls the zones round areas, and the code measures the 8" edge clearance from the zone's edge. Measured edge to edge, centres would be 20" apart and no single unit could reach two zones.]
- **SPR-1 [M] Shots called in by Markerlights still pay the target's Stealth bonus** — Book: l.1585 "Markerlights ignores the Stealth rule, but Stealth units can be marked only is they are within 12” instead of 24”" (repeated under Stealth, l.1622). Code: `src/rules/rules.js:1141` adds Stealth Defence unless the *shooter* is Keen-Eyed. Nothing checks `state.mark` or the marker. `src/engine/marks.js:25` applies only the 12" marking limit. Effect: a Forward Observer team marks or designates a Stealth unit 30" away for a rifle team or a mortar, and the target still gets +4 Defence (verified: ran `review/spr_check.js`; a Regular rifle team firing at a marked Forward Observers unit 30" away sees Defence 12 = 8 + 4 Stealth). So the game applies the drawback (the 12" limit) but not the benefit. [ambiguous: "ignores the Stealth rule" could mean only that Markerlights can mark Stealth units at all. But Stealth never stopped anyone targeting a unit, so the natural reading is that the called-in attack ignores Stealth, and the 12" limit is its price.]
- **CMP-1 [M] Tough Negotiators: the player decides on the re-roll before the other side has rolled** — Book: l.2711 "Re-roll the dice after both the winner and the loser roll for payment." Code: `src/view/dossier-after.js:29-31,293-317` puts a `negotiate` step only for the human seats. It rolls only that side's dice (`pre.dice[st.side]`). The opponent's dice are rolled later, inside `payment()` (`src/rules/camp-contract.js:104`, `pd.B || rollPayment(...)`). In solo play the rival is never a "player", so its roll does not exist yet when the player chooses. In hotseat the same is true unless both players hold S2. Effect: the pay is the higher or lower of the two totals, so whether a re-roll is worth making depends on the other total. The player has to choose without seeing it, although the book sets the re-roll after both rolls. (verified: read the flow in dossier-after.js and camp-contract.js)
- **REB-1 [M] Last Stand gives +4 cover in place of the terrain's +2, not +4 on top of it** — Book: l.2963 "all Rebel infantry units get +4 to their Defence parameter when in terrain which grants a Defence bonus". Code: `src/rules/rules.js:1072-1073` `held()` returns `Math.max(v, 4)` for the terrain/low-wall/sandbag bonus, so the +2 cover becomes +4. That is a net gain of only +2 over normal cover. Effect: a Militia in woods has Defence 11 under Last Stand. On the literal reading it should be 13 (7 + 2 cover + 4). (verified: ran `review/reb_check.js`; `defenceAgainst` gives 11 with Last Stand and 9 without.) [ambiguous: "+4 to their Defence parameter" reads most naturally as an extra +4 on top of the terrain bonus, which gives +6 in total. The code reads it as "the Defence bonus becomes +4". The tooltip (`ruletext.js:166`) and the TACTICS text (`rules.js:615` "count a Defence bonus of +4") follow the code's reading.]
- **REB-2 [M] In a one-off battle the Rebel tactic is fixed before attacker and defender are known** — Book: l.2961 "After choosing the scenario and the attacker/defender, but before the terrain is set up, the Rebel player may choose one of the following tactics". Code: the tactic is picked at muster (`src/view/muster.js:42-44`) and copied into `state.tactics` in `newGame` (`src/engine/engine.js:323`). The roles are only rolled later, inside `SC.begin` (`engine.js:550` → `scenarios.js:953-957`, `rollRoles`), and that runs after the tactic step and after the terrain is laid (`engine.js:466`). No one-off flow sets `cfg.attacker` or `cfg.roles`, and the only chance to re-choose is the Rebel-vs-Rebel dice-off (`engine.js:478-503`), which also runs before the roles exist. Effect: in every one-off attack/defence scenario (Invasion, Demolish, Hostile takeover, ...) the Rebel player must commit to Last Stand, Human Wave or Guerillas without knowing whether they attack or defend. Campaign contracts settle the roles first, so the campaign is not affected. (verified: read)
- **BUG-1 [M] Strong Nervous System fires itself; the player never chooses when** — Book: l.4007 "Once per battle in the Rally phase, the Bug player may remove all Suppression points from all their units." Code: `src/engine/endphase.js:138-157` triggers it automatically for both sides, human or AI, the first Rally phase in which at least max(2, a third) of the swarm's on-table units are Suppressed/Broken. Nothing in `src/view` offers it. Effect: a human Bug player cannot save it for the moment they want, or use it earlier on one key unit, and may never get it if the threshold is never met. (verified: read; grep finds no other use of `nervous`)
- **XEN-1 [M] Know Your Foe! does not stop the scenario's own reinforcements** — Book: l.4614 "prevent all enemy reinforcements from arriving in the current turn. The decision must be made in the Beginning Phase after the Initiative roll". Code: `src/engine/arrivals.js:21-23` runs `scenarioArrivals` (every scenario reserve and second wave, `u.wave`) first and only then `afterArrivals`, where the XO6 question is asked (`arrivals.js:26-58`). `held()` is applied only to the Battlefield Insertion list (`arrivals.js:59-61`). The advancement is also only offered when the foe has an insertion unit waiting (`arrivals.js:41`). Effect: an enemy's scenario reserves (for example Invasion's second wave, `scenarios.js:589`, and any held-back reserves) still come on in the turn the tribe "uses" Know Your Foe!. Against a force with no Battlefield Insertion units, the advancement can never be used. (verified: read; grep shows `kyf` is referenced nowhere outside `afterArrivals`)
- **XEN-2 [M] Effective Resource Utilisation counts 1-3 as 4, but the book says 6** — Book: l.4594 "the Tribe counts all results '1','2' or '3' as result '6' instead '4'." Code: `src/rules/camp-contract.js:94` `hasDoctrine(co,'XS2') ? (v <= 3 ? 4 : v)`, and the card text at `campaign.js:230` says the same. Effect: a winning tribe's 1-3s are paid as 4s instead of 6s. Ran `C.territorial({faction:'xeno',doctrines:['XS2']},[1,2,3,5,5,6],true)` and got 28; the literal reading gives 34. (verified: ran) [ambiguous: the sentence is garbled. Taken literally it reads "as 6", which is what the advancement would pay. The code instead reads it as "as 4 instead of 3", meaning a step above the base 1-2→3 rule. The book never states that reading, but it is plausible.]
- **SOL-1 [M] Evacuation: OpFor entry points break the 12" spacing and the 6" gap from the reinforced buildings** — Book: l.5027 "6 OpFor entry points ... placed at least 12" from the safe zone and from each other, as well as 6" from the reinforced buildings." Code: `src/rules/solitaire.js:812-821` tests the 12" gap between entries and the gap to the homes on the random point. 60% of the time it then snaps that point onto a table edge (l.818), and after the snap it re-tests only the safe-zone distance (l.819). The home test also measures from the bunker centre (≥8"), not from its edge (l.816). Effect: in most Evacuation games, entry points end up bunched together and/or right beside the buildings the civilians come out of, so the OpFor arrives on top of the civilians. (verified: ran `setupTerrain` 2,000 times. 1,195 tables had two entries <12" apart, and 864 had an entry <6" from a reinforced building's edge.)
- **SOL-2 [M] Ambush!: the player's split into two equal forces, 6" apart, is not enforced** — Book: l.5107 "The player splits his army into two more or less equal forces, which are deployed on each side of the road, within 12" of it and at least 6" from each other." Code: `src/rules/solitaire.js:1047-1051` `deployOK` only checks that a unit is 3–14" from the road centreline, on either side. No hook in `src/engine/deploy.js` checks the split. Effect: the player can put the whole commando on one side of the road. Units on opposite sides can also stand 4" apart edge to edge (6" centre to centre across the 4" road). This removes the crossfire set-up the scenario intends and its constraint on the player. (verified: read; grep finds no Ambush split check outside solitaire.js)
- **SOL-3 [M] Protecting the VIP: Broken player units flee towards the evacuation point, and non-VIP units are leashed at 12" while Broken** — Book: l.4955 "The VIP unit cannot move further than 6" from the evacuation point (even when Broken), and other player's units cannot *voluntarily* move more than 12" away". Normal flight is "Movement + 2" away from the closest enemy" (l.716). Code: `src/rules/solitaire.js:619-622` `fallTo` returns the evacuation point with limit 6/12. `src/engine/endphase.js:73-75` then scores flight spots by −distance to that point. Separately, `moveOK` (l.614-618) applied through `canStand` (`endphase.js:61`) caps every flight at 12". Effect: a Broken VIP or other unit runs to the centre of the defensive circle, even if that is towards the enemy, and never leaves the 12" ring or the table. The book gives the 12" leash only to voluntary moves, so Broken non-VIP units should flee away from the enemy as normal. The VIP should flee away from the enemy within its 6". With +3 aggressive OpFor, Broken units are common in this scenario. (verified: read)

## 3. Low findings


### The battle (l.429–725)

- **BAT-2 [L] No defensive fire from a unit whose main weapon cannot engage at that range or target type, though its Auxiliary weapons could** — Book: l.653 "the unsuppressed assaulted unit may shoot at the attackers using their Basic Firepower". Minimum Range (l.1585) and Specialisation (l.1611/1615) say these units "must resort to auxiliary" weapons, or that "auxiliary weapons can still be used against all targets". Code: `src/rules/assault.js:163` asks only `canShoot(state, t, a, 'defensive', {})`, which checks the main weapon. When that fails there is no fallback to `{aux: true}`. Effect: a mortar team or rebel artillery (Minimum Range 12") charged from inside 12", or a SAM or AA team charged by infantry, never fires defensively. By the book they get an FP 1 Basic Firepower shot. (verified: ran `review/BAT_df.js`: a charge on `mortarteam` and on `sam` draws no shot, while `canShoot(..., {aux:true})` is true. A `regular` defender does fire.)
- **BAT-3 [L] The free shot at a unit arriving within 12" ignores the shooter's weapon restrictions** — Book: l.551/553 says arrivals inside 12" "can be immediately shot at by the closest unsuppressed and unbroken enemy unit within 12" and LoS, using the Basic Firepower"; Minimum Range l.1585 and Specialisation l.1611 still bind the main weapon. Code: `src/engine/deploy.js:169-183` (`greetArrival`) checks only `R.hasLoS` and `e.range`, then fires `abShoot(best, u, 'basic', {})` with the main weapon. It never calls `R.canShoot`. Effect: a mortar or artillery piece (Minimum Range 12") or a SAM/AA team (Specialisation (air)) shoots a ground arrival with its full main-weapon Firepower (3–6). The book allows only Auxiliary weapons (FP 1) here. A Cumbersome Weapon unit that disembarked this turn or stands in shallow water also gets the free shot. (verified: read)

### Vehicles, aircraft and drones (l.726–973)

- **VEH-2 [L] The vehicle explosion is resolved as Basic Firepower** — Book: l.811 "This is treated as a shooting attack with Firepower equal to 3 + the destroyed vehicle's Unit Tier". Code: `src/rules/damage.js:252` fires the blast with `shoot(..., 'basic', {})`. Within 4" of a 48"-range shooter a non-basic shot would add +2 for half range, and Crossfire could apply. The book says "Basic Firepower 6" outright for the "Vehicle on fire!" result on the same page (l.800), but not for the explosion.
  Effect: every unit caught in a catastrophic explosion is rolled against at 2 less than the non-basic reading gives. (verified: read) [ambiguous: an abstract blast has no shooter, so "Basic" is a fair reading, and the other modifiers make little sense for it. Read literally, it is a normal shooting attack, which would add the half-range +2.]
- **VEH-3 [L] Backing up is not rounded up when Movement is fractional** — Book: l.756-758 "their movement distance is halved when doing so (e.g. ... Move 10 can move backwards up to 5" ... or 7")". l.465 "If any number should be divided, it is always rounded up to a whole number." Code: `src/rules/move.js:530-538` charges reverse travel at 2" of allowance per inch (`rc += 2 * rs.run`), so the reverse distance is exactly allowance/2. The Embark/Disembark half-move does round up: `Math.ceil(u.move / 2)` (`src/engine/moves.js:222,345`, `actions.js:499`).
  Effect: every base vehicle profile has an even Movement, so this only bites with a propulsion that gives fractional Movement. A tracked Light combat vehicle (Move 7.5) backs up 3.75" on an Advance where the rounding rule gives 4". It also clashes with the half-move rounding used for transports. (verified: read) [ambiguous: Movement there is already fractional by design ("kept exact rather than rounded", `rules.js` applyPropulsion), so the owner may intend no rounding.]

### Terrain and terrain generators (l.974–1260)

- **TER-2 [L] Low-wall cover counts a unit whose base reaches up to 3" from the wall** — Book: l.1023 "When a whole unit is behind a low wall (up to 2" from it), it gets a Defence bonus." Code: `src/rules/rules.js:1110-1112` `behindWall` only tests that the token's *centre* is within 2" of the wall (`rectPointDist(r, target.x, target.y) > 2`). The comment at l.1094-1101 says the old whole-token test was loosened on purpose. Effect: with `UNIT_R = 1`, a token whose far edge is 3" from the wall still gets +2 Defence. That cover also makes the target the wall's "shelter" for Destructive Weapon and Sappers (`destruct.js:48`). (verified: read) [ambiguous: the token stands for men spread along the wall, so the centre test is a defensible single-token reading. A literal "whole unit" reading needs the whole 2" base within 2", which means the centre within 1".]
- **TER-3 [L] "One foot in grave" is decided by majority of the base, not by worst case** — Book: l.992 "a unit partially in the open and partially in a wood counts as being in the open when it is shot at, but as being in a wood when it moves." Code: `src/rules/space.js:453-465` `kindsUnder` puts a token in exactly one terrain: the one that at least half of its 8 rim points (plus the centre as tie-break) are in. `coverFor` (`rules.js:1068`) and the movement search (`move.js:262-268`, `areaAt`) both use that single kind. Effect: a token with half its base in a wood gets the wood's +2 Defence when shot. A token that clips a wood with less than half its base pays no movement penalty. The book gives the unit the worse result each time. The comment in `coverFor` ("partly in the open, it is in the open when shot at") overstates what the code does. (verified: read) [ambiguous: the owner's single-token decision may be meant to cover this approximation. The space.js comment says the leeway is deliberate.]
- **TER-4 [L] A unit on a hill gets +2 Firepower against a unit standing on the same hill inside a wood or building** — Book: l.1049 "Units standing on a hill get a Firepower bonus when shooting at targets below them"; l.996 chest rule: units in a wood on a hill "count as being in a wood only, and do not benefit from any rules of the hill." Code: `src/rules/shoot.js:205-208` compares `levelOf(a) > levelOf(t)`. `levelOf` (`space.js:610-620`) returns 0 for anyone in a wood or building on a hill. Effect: a squad on a hill gets "firing from a hill +2" against a squad in a wood, or a garrison in the Mine building, on the same hill. Physically they are not below it. (verified: ran `review/ter_t2.js`. Both cases show "firing from a hill 2".) [ambiguous: the chest rule could be read as making the wood's occupants count as off the hill, and so "below".]
- **TER-5 [L] Units in a high building see over their friends, which the book gives only to units on hills** — Book: l.1049 "units on hills can shoot/be shot at over friendly units below them (but not over enemy ones)". Nothing like this is said for buildings. Code: `src/rules/space.js:604-607` `sightLevel` gives a garrison of a high (non-reinforced) building level 2. `lineClearAt` (`space.js:579-583`) then lets it fire over, and be fired at over, friendly units on lower ground. Effect: a garrison in a tall building gets a sight line the rules do not give it. Enemies can also shoot it past its own screening friends. (verified: read)
- **TER-6 [L] Destroying a multi-section building burns every section and evicts every garrison** — Book: l.1006 a big building "composed from several smaller ones ('sections')" is a combination of terrain. Each section is a building of its own, and l.1000 sets aflame the building that was destroyed. Code: `src/rules/destruct.js:84-108` `destroyTerrain` turns the whole piece (all its `parts`) into `burning` and moves out every unit whose `u.bld === r`. The Destructive Weapon and Sappers paths (`shelterOf`, `destruct.js:36`) pick the whole piece too. Effect: one successful Destructive Weapon roll against a garrison in one wing also burns the other wings and moves their garrisons, including friendly ones. (verified: read) [ambiguous: the book does not say how a sectioned building is destroyed. Treating it as one destructible piece is a possible reading.]
- **TER-7 [L] The army-swap allowance rounds a quarter up** — Book: l.1160 "swapping no more than ¼ of their units." Code: `src/rules/rules.js:1427` `swapAllowance(n) = Math.ceil(n * 0.25)`. Effect: 1–3 units allow 1 swap, and 5–7 units allow 2, both more than a quarter. (verified: ran. `swapAllowance(1..8)` = 1,1,1,1,2,2,2,2) [ambiguous: the book gives no rounding rule, and rounding up is common in wargames. "No more than" points to rounding down.]
- **TER-8 [L] Manual terrain set-up makes the player place at least the low end of the range** — Book: l.1172 "he/she is allowed to place any number of terrain pieces up to the number indicated in the rolled column." Code: `src/engine/terrainsetup.js:240-243` (`tnext`) refuses to move on until `count >= spec.min`, for example at least 1 of "1-3 woods" or 2 of "2-4 craters". The automatic placement (`gen.js:142-144`) also draws the count uniformly from min..max. Effect: a player cannot leave an area emptier than the range's minimum. (verified: read) [ambiguous: "1-3" can be read as a mandatory range with the "up to" freedom only below its top, or as just setting the maximum.]
- **TER-9 [L] Industrial "medium walls" become high (impassable, LoS-blocking) walls** — Book: l.1224 "Large building and up to 6 medium walls". The terrain chapter has only low, high and reinforced walls. Code: `src/rules/gen.js:63` `P('wall', 0, 6)` places High walls (`rules.js:675`, impassable, blocks LoS). Effect: Industrial roll 5 seals the large building inside impassable, sight-blocking wall sections apart from a gate. Low walls would have given cover and allowed crossing. (verified: read) [ambiguous: "medium" sits between low and high, and either mapping fits.]
- **TER-10 [L] In co-op games passive auras from one player's units help the other player's units** — Book: l.1125 "Passive special rules (like Inspiring Presence) do not affect allied units." Code: `src/rules/rules.js:1543-1552` `inspiringNearby` (and the other friendly auras gated by `projects`) checks only `o.side === u.side` and never `u.owner`. In a co-op game both players' commandos are side `A` (`engine.js:329`, `owner` 1/2). Effect: player 1's Inspiring Presence or Field Medics re-roll player 2's units. (verified: read) [ambiguous: this rule sits under "Multiplayer battles" (standard scenarios). The co-op chapter (p.146ff) does not repeat it, so it may not be meant to apply to co-op.]

### Scenarios (l.1261–1484)

- **SCN-2 [L] An automatic victory by annihilation becomes a draw when the scenario times out level in the same End phase** — Book: l.1271 "Completely destroying the enemy force … results in an automatic victory"; l.1269 a draw only "when … each player meets at least one of them in the same turn". Code: `src/rules/scenarios.js:761-765` `check()` turns the annihilation win into a draw whenever the scenario's own check returns `winner: null` with a text (`own.winner == null && own.text`). A timeout draw is not a victory condition for the destroyed side. Effect: in Secure and control, if B is wiped out in the End phase of turn 20 while neither side holds more objectives (`scenarios.js:160-163`), the game is scored as a draw instead of A's automatic victory. Meeting, Find and Invasion are not affected, because annihilation also meets their rout test first. (verified: read)
- **SCN-3 [L] Invasion defender: the 6" edge distance and the walk-on depth are measured to the token's centre** — Book: l.1407 "deploys up to 1/3 of his forces on the table at least 6" from table edges"; l.1417 reserves "enter the table from a random table edge", which by the reserve rules (l.551) is "up to 4" from the table border". Code: `src/rules/scenarios.js:308-311` `deployOK` checks the token centre against 6" (`x >= 6`), with UNIT_R = 1". That lets the base sit 5" from the edge. `scenarios.js:301` gives the defender's walk-on bands only 2" depth (`edgeBands(2)`), and `arrivals.js:439-442` checks the centre against that band with 0.5" slack, so a reserve can come on at most ~3.5" deep instead of 4". Other scenarios differ: Demolish uses `4 - UNIT_R` (whole base inside 4", `scenarios.js:428/434`), while Meeting, Secure, Find and Takeover use a 4" band to the centre (`scenarios.js:8-11`, `543`), which lets the base reach ~5.5". Effect: small differences in set-up and entry depth that also vary from scenario to scenario. (verified: read) [ambiguous: the book does not say whether distances are measured from the base edge or the centre]

### General special rules and PMC units (1) (l.1485–2003)

- **SPR-2 [L] Anti-tank and Gauss strip Battle Armour's +2 in close assault too** — Book: l.1505 "the Defence increase is negated by Anti-Tank or Gauss Weapons". Anti-tank (l.1495) and Gauss (l.1543) are both worded "when shooting". Code: `src/rules/rules.js:1124-1129` (`defenceAgainst`) applies the pierced Defence with no `opts.assault` check, and `assaultRound` calls it with `{assault:true}` (`src/rules/assault.js:330`). Effect: Economy BATs (Anti-tank (limited)), Light AT teams, LRRP and Gauss units assaulting Battle Armour troops hit Defence 10, not 12 (verified: ran it; EBA assaulting BATs gives Defence 10, a rifle team gives 12). [ambiguous: "negated by Anti-Tank or Gauss Weapons" has no shooting qualifier of its own, so the code's reading is possible.]
- **SPR-4 [L] Sappers' breach +1 applies only to the attacker's hits in that round** — Book: l.1595 "the terrain piece is destroyed and players add +1 to all rolls when resolving hits in that round of Assault". Code: `src/rules/assault.js:325,358` sets `breached` per attacking roll and adds +1 only to `resolveAssaultHits` for that roll. The defender's reply in round 1 (`assault.js:216-219`, role 'defender') gets no +1. Effect: the defender's round-1 blows against the Sappers are resolved without the +1. (verified: read) [ambiguous: "players … all rolls" suggests both sides. Reading it as only the Sappers' hits is also possible.]

### PMC units (2) (l.2004–2528)

- **PMC-1 [L] Medical drone unit is given the "Drone unit" rule the book does not print** — Book: l.2124 Medical drone notes are only "Field Medics", and l.964 "All drone units are marked as 'Drone unit' in the notes." Code: `src/rules/data.js:93` gives `dmedic` the rules `['Drone unit', 'Field Medics']` (the comment there admits that the book lists only Field Medics). Effect: the Medical drone counts toward "no more Drone units than other units" (`checkArmy(['dmedic','dcombat','regular'])` is refused with "2 drones to 1 others"). Hits on it get +1 on the hit table, it is always Determined, it sheds all SP in the Rally phase, Hackers can target it, and it earns no XP or Trauma in a campaign. (verified: read + ran checkArmy and Engine.start; the built unit has `drone: true`) [ambiguous: it sits in the "Drones" section and is named a drone, so the missing note may be a misprint in the book. Read literally, though, l.964 makes the printed note the test, so it is not a Drone unit.]
- **PMC-2 [L] A Command Unit's Inspiring Presence inside a Command Vehicle uses the vehicle's Tier for the "two or more Tiers higher" exclusion** — Book: l.1567–1569 "units two or more Tiers higher than the unit with Inspiring Presence, do not benefit". l.1517 says the Command Unit "grants the vehicle all of its special rules". Code: `src/rules/rules.js:1543-1551` `inspiringNearby` compares `u.tier >= o.tier + 2` with `o` = the vehicle that carries the borrowed rule. The Coordinate chain from a Command Vehicle uses the Command Unit's own tier instead (`src/engine/engine.js:1134`, `tier: cmd.tier`). Effect: a Field command 4th grade (Tier I) riding in a Flying command post (Tier V) inspires Tier III–V units. On foot it inspires none of them. (verified: ran a scratch script. With cmd4 in the FCP, Rangers T5 and Veterans T4 get `inspiringNearby` true. On foot, both get false.) [ambiguous: read literally, the vehicle is now "the unit with Inspiring Presence", which is the code's reading. The other reading is that the commander's rank is what limits who listens, and that is how the code itself handles Coordinate.]

### Campaign (l.2529–2870)

- **CMP-2 [L] Surrounded, but Steady also adds dice to the Regroup action's bonus rally** — Book: l.2783 "When making a rally attempt in the Rally phase, the unit may roll one additional die for each enemy unit within 18"." Code: `src/rules/rules.js:1613-1621` adds the dice without checking `inRally`. Other Rally-phase-only effects in the same function, such as Drone and Overmind, do check it (l.1580-1590). Effect: a Pass/Regroup action (l.690, bonus rally) also gets +1 die per enemy within 18". (verified: ran `R.rally(state, u, {regroup:true})` with the flag set and one enemy at 2"; the extras show "Surrounded, but Steady +1 dice" and 5 dice for Morale 4)
- **CMP-3 [L] On Our Terms… is never offered to Player 2 in hotseat** — Book: l.2715 "The player may increase or decrease the Battle Tier by one". Code: `src/view/dossier-contract.js:248` shows the buttons only when `!second && C.hasDoctrine(A,'S4')`, where A is the seat now picking. Player 2 (seat B) only picks a list on terms Player 1 has already set. Effect: a hotseat Player 2 whose company holds S4 can never use it. The AI rival never uses S4 either, which is acceptable for an AI. (verified: read)
- **CMP-4 [L] The "army was routed" Trauma Point follows the raw half-the-units flag, not the scenario's rout or a concession** — Book: l.2638-2640 "+1 TP if the army was routed in battle or completely destroyed / forced to flee from the battle (but the battle was not conceded)". Code: `src/engine/endphase.js:333-334` sets `state.routed[side] = SC.routed(...)` at every End phase whatever the scenario says. `camp-contract.js:218` and `camp-aftermath.js:163` then charge +1 TP whenever that flag is set. Effects:
  - (a) In Find and secure, a side that holds the objective "cannot be routed" (`scenarios.js:543-545`), yet it is still charged the rout TP, even when it wins.
  - (b) In Invasion, an attacker that has lost half its units is not routed by the scenario (`scenarios.js:657`), but it is still charged.
  - (c) A side already flagged that then surrenders (`endphase.js:115-119`) is charged, against the "not conceded" clause.
  (verified: read) [ambiguous: "routed" may be read as the plain half-the-units test of p.49, in which case (a) and (b) are the code's reading. (c) still departs from the book.]
- **CMP-5 [L] Courage Under Fire takes 1 SP off each later attack, not off each hit result** — Book: l.2738 "deduct 1 Suppression point from all subsequent hit results." Code: `src/rules/damage.js:40-43` (`shotRelief`) takes 1 SP once from the whole attack's total. Effect: when a later attack scores several 'Get down!' or 'Man down!' results, the per-result reading would remove more Suppression. (verified: read) [ambiguous: "subsequent hit results" can mean "the results of the later attacks", which is the code's reading. It can also mean each hit result, which would be −1 per result.]
- **CMP-6 [L] Strength in Numbers allows only Battle Tier − 1 for the free unit** — Book: l.2731 "one more unit of Tier lower to the Battle Tier per Priority Level". Code: `src/rules/rules.js:293,307-311,320` sets `freeTier = battleTier - 1`. Only units of exactly that Tier come off the bill and raise the cap. The doctrine text at `campaign.js:61` says the same. Effect: at Battle Tier III or higher, a free Tier I unit, for example, is not allowed. (verified: read) [ambiguous: "Tier lower to" can mean "one Tier below", which is the code's reading, or "any lower Tier".]

### Rebels (l.2871–3600)

- **REB-3 [L] First Among Equals units without "Command Unit (X)" cannot be activated by a Coordinate chain** — Book: l.1513 (Command Unit) "other Command Units ... cannot be activated". In this list only Insurgent, Influential and Rebellion leaders carry Command Unit (X) (l.3383–3407). Instigators and Secondary insurgent leaders do not. Code: every FAE profile has `command: true` (`src/rules/data.js:198-202`). `R.commandUnit(u)` is true for any `u.command` (`rules.js:1412`), and the chain filter rejects such units (`src/engine/engine.js:1053`). Effect: at PL 2 an Insurgent leader's Coordinate cannot activate a second FAE that is Instigators or Secondary leaders, even though neither is a Command Unit. (verified: read) [ambiguous: the code treats every FAE as the Rebel "command" slot, the way a PMC Field command 4th grade (no CU value) is treated. The book only excludes units that have the Command Unit rule.]
- **REB-4 [L] Riders upgrade can be switched on and off until the unit's first battle, not only at recruitment** — Book: l.2934 "the player has to decide whether to upgrade a unit or not when that unit is recruited. The decision is final". Code: `C.ridersOpen(e)` (`src/rules/campaign.js:737`) is true while the entry has no history and no `lastBattle`. The dossier toggle uses it (`src/view/dossier.js:759-762`), so the upgrade can be flipped any time before the first battle, across later visits to the dossier. The tooltip (`ruletext.js:163`) says it is chosen at recruitment and cannot be changed. Effect: small extra flexibility, e.g. recruiting on foot and mounting after seeing the next contract. (verified: read)
- **REB-5 [L] Hostile takeover can put emplaced guns into reserve** — Book: l.2948 "Artillery cannot be hold in reserve and has to be deployed as soon as possible unless they enter the battlefield transported by vehicle". Code: the defender sets up (`src/rules/scenarios.js:~576-584`) by sorting Stationary Artillery first and keeping only `ceil(n/3)` on the table. `defs.slice(keep)` sends the rest to reserve with no exception for guns. Elsewhere guns are never held back (`deploy.js:79,586`, `scenarios.js:100-111`). Effect: a defender with more guns than a third of its force has guns walking on from a table edge later, where they can never move. (verified: read) [ambiguous: the scenario's "up to 1/3 on the table" clashes with the unit rule. The book does not say which one wins.]

### Space Bugs (l.3601–4102)

- **BUG-2 [L] Mimicry leaves out Leader Bugs and Overgrown bugs** — Book: l.3995 "Up to ¼ of units can be held in reserve and deployed using the Battlefield insertion rules." Code: `src/engine/engine.js:403-405` offers it only to `cls === 'infantry'` units without `Overmind` (or `Dominant Species`). Effect: the swarm's Leader Bug and every Overgrown bug (Fire beetle, Bio-plasma thrower, Queen, Carrier) can never be held back with Mimicry. Overgrown bugs can clearly use the rule, since the Sandworm and Shadow bug have it on their profiles. (verified: read)
- **BUG-3 [L] Aggressive does nothing on an Overgrown bug (Overgrown Adrenaline Glands flaw)** — Book: l.4043 Flaw 6 "The unit gets the Aggressive special rule". Overgrown bugs can take Flaws (l.3971, only Flaw 5 is re-rolled for them) and "may assault as normal" (l.3655). Code: `src/rules/rules.js:1024-1027` `aggressiveNow` returns false for any `isMachine(u)`, and `src/engine/moves.js:161-166` is gated the same way. `rollTrauma` (`camp-contract.js:234`) still allows Flaw 6 for Overgrown bugs. Effect: that Flaw has no effect on an Overgrown bug, which is never forced to charge. (verified: read)
- **BUG-4 [L] Extensive Feeding's +1 Defence misses the Sandworm's pierced Defence** — Book: l.3997 "Overgrown Bugs get +2 Movement and +1 Defence bonus." Code: `src/rules/campaign.js:678` does `u.def += 1` but leaves `u.defPierced` alone. Honours go through `e.def` (l.656-657), which updates both. Effect: the Sandworm (Defence 16/14) gets 17 against normal fire but stays at 14, not 15, against Anti-tank/Gauss. (verified: read)
- **BUG-5 [L] Pheromone Markers also boost a bug that is defending in an assault** — Book: l.3663 "+1 bonus to their Assault or their Firepower parameter when assaulting or shooting at enemy units which are within 18"…". Code: `src/rules/assault.js:292` adds `pheromoneBonus` in `assaultMods` for both the attacker and the defender role. Effect: a charged Animal Behaviour bug gets up to +3 on its return blows. [ambiguous: "assaulting" can mean only the charging unit (book), or any unit making Assault rolls in a melee (code)]
- **BUG-6 [L] Effective Toxin Glands can never help Flying Bugs** — Book: l.3989 "All Spore Bugs and Flying Bugs get +2 bonus for the Fire! action instead of the standard +1." Code: `src/rules/shoot.js:136-138` makes every Flying Infantry shot `basic`, and the Fire! bonus (with Toxin Glands) is only added under `if (!basic)` (l.182-187). Effect: the pathway does nothing for Small/Large winged bugs. The Carrier bug is an aircraft and fires basic anyway. [ambiguous: by the general rule Flying Infantry "always shoot… with Basic Firepower" (l.3651), so Fire! never applies (code). But the pathway names Flying Bugs explicitly, which suggests it is meant to work for them (specific over general)]
- **BUG-7 [L] PL1 "no vehicle above the Battle Tier" limit is not applied to Overgrown bugs** — Book: l.3603 "Bug Swarms follow all general army composition rules", l.3655 Overgrown bugs "follow all rules of Vehicles/Aircraft". The general rule is l.744/885 "On Priority Level 1, you cannot use ground vehicles [aircraft] of Tiers higher than the Battle Tier". Code: `src/rules/rules.js:359` skips every machine check for a swarm (`|| bugs) return;`). Effect: at PL1, Battle Tier III/IV, a swarm may field Tier V Overgrown bugs (Fire beetle, Bio-plasma thrower, Sandworm, Shadow bug, Carrier) that a strict reading forbids. [ambiguous: the swarm list restates its own Overgrown limits (l.3624-3629) in place of the general vehicle/aircraft caps and does not repeat this one. Its table also gives 0-2 Tier V slots at BT III-IV, and all Tier V bugs are Overgrown. So the code's reading, that the bug limits replace the general ones, is defensible]
- **BUG-8 [L] Fire beetle is given "Overgrown Bug", which its profile does not print** — Book: l.3719-3725 lists "Specialisation (ground), Limited Fire Arc, Incendiary Ammunition, Suppressive Fire / Always uses Basic Firepower" with no Overgrown Bug. Code: `src/rules/data.js:234-237` adds `'Overgrown Bug'` (the source comment says this is deliberate). Effect: the beetle counts toward the 3-per-PL Overgrown cap, may charge (Assault 5), and takes Adaptations and Flaws instead of Upgrades. [ambiguous: likely an omission in the book, since every other Tier V Structure bug is Overgrown. But it is a change from the printed profile]
- **BUG-9 [L] Destroyed Overgrown bugs get no salvage roll and can take no Upgrades** — Book: l.3655 Overgrown bugs "follow all rules of Vehicles/Aircraft". l.3971 carves out only that they "can get Genetic Adaptations and Genetic Flaws just like infantry". The vehicle campaign rules are salvage (l.2686-2700) and Upgrades for 10 EXP (l.2666). Code: `src/rules/camp-contract.js:248` returns "not salvaged" for every bug, and `camp-aftermath.js:224` treats a wiped bug as lost. `src/rules/campaign.js:599` refuses Upgrades for bugs. Effect: a destroyed Tier V Overgrown bug is always gone (a vehicle would be recovered on 3+/4+/5+). [ambiguous: "like infantry" can be read as putting Overgrown bugs on the infantry side of the campaign rules entirely (code), or only for honours/traumas, leaving the vehicle salvage and Upgrade rules in place]

### Xenotripods (l.4103–4751)

- **XEN-3 [L] Rite of Knowledge forces a re-roll on a 3, throwing away the owner's choice of pad** — Book: l.4648 "the unit may re-roll results of 1-3. The second result stands". Code: `src/rules/xeno.js:170` `if (r <= 3 && campFlag(u,'knowledge')) second = d6()` always re-rolls, and there is no choice. A 3 already lets the owner pick the pad (l.4166). Effect: a unit with the Rite that rolls 3 is forced to re-roll, and one time in three it ends up at a random pad. A player would never choose that. (verified: ran 2000 `R.teleportRoll` calls; all 336 rolls of 3 were re-rolled)
- **XEN-4 [L] Rite of Rage also fires on a Pass/Regroup, not only in the Rally phase** — Book: l.4636 "automatically removes 2 Suppression points if there is at least one enemy unit within 12" from it in the Rally phase." Code: `src/rules/rules.js:1603` applies Rage on every `rally()` call. Unlike the drone and Overmind lines above it, it is not gated by `inRally`, so the Action-phase regroup (`actions.js:577`, `{regroup:true}`) also sheds 2 SP. Effect: a Raging unit that regroups sheds 2 extra SP for free, and can do so twice a turn. (verified: read)
- **XEN-5 [L] Rite of Unrest stops working while its unit is Broken** — Book: l.4654 "Each enemy infantry unit within 12" … gets 1 Suppression point in the Beginning phase". l.521: suppressed and broken units lose bonuses to others, "this applies to bonuses only, but not for penalties". Code: `src/engine/engine.js:895` skips the unit when `R.status(u) === 'broken'`. Effect: a penalty on the enemy is switched off, against the p.28 note. (verified: read)
- **XEN-6 [L] Infamy of Panic misses many "broken or destroyed" friends** — Book: l.4674 "When a friendly unit within 18" is Broken or destroyed, the unit receives D6 Suppression points." Code: `infamyPanic` is called only from `applyResult` (`src/rules/damage.js:143`). These cases never trigger it: a friendly aircraft or turret destroyed through `applyDamage`, and a friend broken by Suppression added directly through `addSP` (Psychic Bond `xeno.js:100`, Unrest, Melancholy, Panic itself). Effect: the Infamy fires less often than the book says. (verified: read; grep shows the only call site is damage.js:143)
- **XEN-7 [L] Teleport places the arriving unit itself; the player cannot choose where it steps out** — Book: l.4166 the unit "is immediately disembarked by a Teleport unit", following the standard rules, and l.827 says unloaded troops "are placed up to 4" from the vehicle". Code: `src/rules/xeno.js:191-200` picks the first clear spot on rings 2.2–4" round the exit pad and sets `u.x/u.y` directly. A normal Disembark lets the player tap the spot (`engine.js:1913`). Effect: the player loses the placement choice, for example which side of the pad, or behind cover. (verified: read)
- **XEN-8 [L] Teleport tooltip and hint say the unit must not have acted; the code (rightly) does not require that** — Book: l.4166 "following standard embarking rules", and l.835 says "the troops may be activated before embarking or after disembarking". Code: `teleportFrom` (`xeno.js:149-159`) has no `activated` check, which is correct. But `ruletext.js:220` says "Takes in a steady infantry unit within 4" that has not acted … The unit may still act this turn", and `actions.js:374` says "no steady infantry unit within 4" that has still to act". The result card (`abilities.js:211`) also says "It may still act this turn" for a unit that has already acted. Effect: the text misstates the rule. (verified: read)
- **XEN-9 [L] Underground Advance offered to infantry only, and never to Alpha squads** — Book: l.4608 "1/4 of units in the army can use the Battlefield insertion rule." Code: `src/engine/engine.js:403-405` limits the candidates to `u.cls === 'infantry'` and excludes `Dominant Species` (every Alpha squad). Effect: the tribe cannot hold an Alpha squad or an aircraft back for insertion under the advancement. (verified: read) [ambiguous only for aircraft: Battlefield Insertion is a general rule, and a Xenotripod aircraft can have it (upgrade 7), so nothing bars it. The Alpha exclusion has no basis in the book.]
- **XEN-10 [L] Detailed Terrain Knowledge lets the player move the same piece twice** — Book: l.4610 "move two terrain pieces … up to 12". If both players have this advancement, they move the terrain in an alternating manner based on Initiative, and may not move a terrain piece more than once." Code: `src/engine/terrainsetup.js:365-388` (`placeAt`, kind 'move') does not record pieces already moved, so one piece can go 12" twice (24"). With both sides holding it, the first mover is random (`engine.js:585-588`), not chosen by Initiative. Effect: one piece can be moved 24", which breaks the two-pieces wording. (verified: read)
- **XEN-11 [L] Foresighted Command is only ever the player's; a rival tribe holding it gets nothing** — Book: l.4608 "the Xenotripod commander chooses which result to keep … If both players have this advancement, roll three D6 and each player chooses one die to ignore". Code: `src/rules/camp-rivals.js:140` and `src/view/dossier-contract.js:131` roll the extra scenario only when `hasDoctrine(A,'XO3')`. The rival's doctrines are never checked, although the Amt and Ghadon archetypes carry XO3 (`campaign.js:1316,1336`). The three-dice case is missing. Effect: a rival tribe's advancement has no effect. (verified: read)
- **XEN-12 [L] Campaign "fielded for this battle" turret list stops at the Battle Tier even at Priority Level 2** — Book: l.4126 "On Priority Level 1, you cannot use Turrets or aircraft of Tiers higher than the Battle Tier", which is a PL1-only limit, and the table allows higher Tiers (for example Battle Tier III: Tier IV 0-2, Tier V 0-1). Code: `src/view/dossier-contract.js:307` filters the turret buttons with `p.tier <= E.contract.tier` whatever the PL. `checkArmy` (`rules.js:380`) is correct. Effect: in a PL2 campaign battle the tribe cannot field, for example, a Defensive turrets foursome or a Hi-grade shield turret at Battle Tier III. (verified: read)
- **XEN-13 [L] Advanced Control System turns the aircraft automatically, also after an Advance or a repair move** — Book: l.4706 "When making a Move action, the aircraft can turn up to 90° after moving." Code: `src/engine/moves.js:236` calls `flightTurn(u)` after every `doMove`, including 'advance-move' and the Emergency Batteries move. `flightTurn` (`ai.js:249-255`) always swings the nose toward the nearest enemy. Effect: the player gets no choice of whether or where to turn, and the turn also happens on an Advance, which the book does not allow. (verified: read)
- **XEN-14 [L] Rite of Knowledge and Infamy of Backwardness also apply to the Teleport craft** — Book: l.4648 "When using Teleport Turrets, the unit may re-roll…" and l.4682 "The unit cannot use Teleport Turrets." Code: `xeno.js:156` (backward) and `xeno.js:170` (knowledge) apply to any Teleport unit, including the Teleport craft aircraft. Effect: a Backward unit cannot use the craft either, and the Rite works through it. (verified: read) [ambiguous: "Teleport Turrets" may be loose wording for any teleporter]
- **XEN-15 [L] Turrets get no +1 Structure for being Drone Controlled** — Book: l.4170 "They are Drone Controlled", and l.861 "Drones, as these vehicles are called, add 1 to their Structure value". Code: turret sets are built with `drone=false` and then flagged `tu.drone = true` (`engine.js:351-354`), and the lone shield turret likewise (`engine.js:364`), so `applyDrone`'s `+1 str` (`rules.js:238-239`) never runs. Defensive and Teleport turrets therefore fight at Structure 3, and Shield turrets at 4. (verified: read) [ambiguous: the turret profiles may already include the point. The Light VTOL drone says so explicitly (l.2524 "extra Structure point already added"), but the turret profiles do not.]

### Solitaire and co-op (l.4752–5118)

- **SOL-4 [L] Solitaire scenarios: Broken player units can never run off the table** — Book: l.716 "If the unit moves off of the table, it does not return and is counted as having fled". Section l.4752+ makes no exception. Code: `src/rules/solitaire.js:460` the base `fallTo` gives every player unit a target (a point 3× away from the nearest enemy) whenever an enemy is on the table. `src/engine/endphase.js:50,67` allows a run-off only when `!to`. Effect: in Crushing the Resistance, Decapitation, Sabotage and Ambush!, a Broken player unit at the table edge slides along it and stays in play instead of fleeing. The main exposure is Decapitation, where the commando enters at a table corner. (verified: read)
- **SOL-5 [L] Sabotage: 3 objectives at Priority Level 1, not 5** — Book: l.5067 "3 objectives are placed ... Add 2 objectives per Priority Level." Code: `src/rules/solitaire.js:945` `n = 3 + 2*(pl-1)`, giving 3 at PL 1 and 5 at PL 2 (verified: ran `objectives()`, PL1 → 3 targets, PL2 → 5). Effect: a solo Sabotage has 3 targets instead of 5 under the literal reading. [ambiguous: the code reads the 3 as the PL 1 baseline and adds 2 per extra player. Literally, "2 per Priority Level" includes PL 1, so 3+2×PL = 5 solo and 7 co-op.]
- **SOL-6 [L] Reasonably Defensive and Neutral OpFor units shoot the easiest target, not the biggest threat** — Book: l.4781-4783 and l.4791 "The OpFor unit engages the enemy unit which poses the biggest threat. If you're not sure which one it is, choose the target at random or select the mission objective". l.4798 contrasts this with Reasonably Offensive, which "attacks the enemies where they can do the most damage, not the enemies which are the biggest threat". Code: `src/engine/ai.js:398-416` `bestTarget` always ranks targets by expected hits against them, whatever the behaviour result. `aiAct` (l.604, 675) and `neutralHold` use that ranking for defensive and neutral as well. Effect: defensive/neutral OpFor focus fire on soft or shaken units instead of the most dangerous one. The book's Defensive/Neutral vs Offensive targeting difference is lost. (verified: read)
- **SOL-7 [L] Decapitation: Command Units rolled into the OpFor pool become extra fixed, unbreakable leaders that must all be killed** — Book: l.4969 "OpFor gets a single Command Unit ... of Tier equal to the Battle Tier". l.4973 "destroy all OpFor Command Units". Code: `src/rules/solitaire.js:678-680` flags every side-B unit with `command`/`Command Unit` as `soloLeader`, besides the extra one. These units are placed openly (not as counters), cannot Break, never move, and are added to the win condition. Effect: about 40% of OpFor pools carry a second leader to kill (verified: ran `rollOpFor` 1,000 times across BT I–V, PL1: 397 pools had a command unit). [ambiguous: "all OpFor Command Units" can be read as every one present, which is the code's reading, or as the one leader per Priority Level the scenario adds. The Command Unit rule is not used in solitaire games (l.4885), which supports the second reading.]
- **SOL-8 [L] Decapitation: a Suppressed OpFor leader never fires** — Book: l.4993 leaders "always act according to the Reasonably Defensive result" ("will engage the enemy if possible", l.4780). A Suppressed unit may still "Make a Fire! action using the Auxiliary weapons rule" (l.704). Code: `src/engine/ai.js:478-486` fires only when the leader is `ready`. Otherwise it regroups or passes, and Auxiliary fire is never chosen. Effect: once a leader is Suppressed (common, since it cannot Break), it stops shooting entirely. (verified: read)

### Appendices (l.5119–5501)

- **APX-1 [L] Hover vehicles cross shallow water with no movement penalty** — Book: l.5450 "Hovercraft can move over water (and similar terrain, with the exception of hot lava), but turning costs them 1\" more." Code: `src/rules/move.js:43` returns a cost of 0 for a hover hull in shallow *or* deep water (`if (pr && pr.water && (t.shallow || kind === 'deep')) return 0`). Other ground vehicles pay the 2" vehicle penalty for shallow water (`TERRAIN.water.movePenalty: 1`, doubled for vehicles, `move.js:56`). Effect: a hover hull saves 2" every time it enters shallow water (swamps on several world tables) compared with the book's plain reading, which only grants passability over water. (verified: read) [ambiguous: "can move over water" can be read as skimming freely, as the code does, or only as lifting the impassable bar on deep water while shallow water keeps its normal difficult-terrain penalty.]

## 4. Owner decisions

These were set by the owner and are not reported as findings:

- Priority Level is capped at 2. One-player solitaire is PL 1, and co-op is PL 2.
- Each unit is a single token: no choice of casualty and no coherency.
- Secure and Takeover objectives are points, held from 4" away, with no terrain bonuses.
- The computer places the Secure objectives and the Demolish objective.
- Troops inside a transport take no landing Suppression, since transported units cannot be Suppressed (p. 36).
- "Command Units" means the units in the book's *Command units* group, not only those with the Command Unit (X) rule. So Field command 4th grade counts towards the one-per-Priority-Level cap, and a Coordinate chain cannot activate it. The reviewers raised this twice (SPR-3, PMC-3), and it is kept as decided. REB-3 is the Rebel counterpart (the First Among Equals units) and is listed for the owner to confirm the same reading. The owner confirmed this at REB-3, and extended it: every Alpha squad and every Leader Bug unit is a Command Unit too.

## 5. Coverage

What each section's reviewer checked and found conforming, and what the game leaves out on purpose.

### The battle (l.429–725)

#### Checked and conforming
- D10 reads 0–9 (`rules.js:16`). Measuring is base to base (`unitDist`). Pre-measuring is free.
- **Alternate activation:** one activation per unit per phase. When one side runs out of units, the other carries on freely (`engine.js` `afterChain`). A side that wins initiative with nothing able to act hands the turn over.
- **Overwhelming numbers:** `floor(mine/theirs)` activations in a row. Counted once from unbroken units on the table when the Action phase opens (`phaseCount`). Units in reserve or aboard are excluded, as are turrets (p.130).
- **Rounding up:** half range uses `ceil(range/2)`.
- **Morale:** reduced by 1 per lost model, minimum 1 (`currentMorale`).
- **Suppression thresholds:** Suppressed at SP > M, Broken at SP > 2M, removed as fled when SP > 3M after a rally attempt (`rally()`). SP is capped at 12 (`addSP`).
- Suppressed and Broken units project no friendly auras (`projects()`, used by medics, Inspiring Presence, Pheromone Markers and Freedom). Penalty auras such as Jammers still apply.
- **Units without Firepower:** cannot shoot (`canShoot`). Units count as Infantry by default (`cls`).
- **Line of sight:** 36" sight range. Blocked by blocking terrain and by units. Seeing from any model counts for the whole unit (5-line test in `space.js`).
- **Beginning phase:** both sides roll D10, ties re-rolled, the higher side activates first and also places reserves first.
- **Reserve phase:**
  - Arrivals alternate from the initiative side, ignoring Overwhelming numbers.
  - Arriving is not an activation.
  - Units arrive within 4" of the edge and 12" from the enemy if possible, closer only if not (`arrivalSpots`/`clearOfEnemy`).
  - The closest steady enemy within 12" with LoS fires a free Basic Firepower shot that is not an activation. This applies to insertions too (`greet` from `landUnit`/`walkOn`).
- **Action phase:** Broken units cannot act.
- **Move:** M+2". Units stop 1" from enemies, may pass through friends but must end at least 1" from any unit. Moving off the table counts as fled.
- **Advance:** move M", then shoot without the +1, and may hold fire.
- **Fire!:** all the listed firing modifiers are present: Firepower, +1/+2/+3 for current models, +2 within half range, +1 for the Fire! action, +1 side and +2 rear of a vehicle, +2 Crossfire.
  - An unmodified 0 fails and an unmodified 9 scores at least 1 hit. Hits = the margin over Defence.
  - Hit table: 1 ignored, 2–5 1 SP, 6+ a casualty and 2 SP. +1 to hit-table rolls against a Broken target.
- **Crossfire:**
  - The 2nd and later attacks in the turn get +2 when the target lies between this shooter and an earlier one. A successful Crossfire attack adds +1 to the hit table.
  - Basic Firepower attacks neither count nor benefit. Vehicles, aircraft and units fully in trenches or buildings are immune.
- **Auxiliary weapons:** FP 1, Range 12", none of the unit's special rules, but a Fire! action (+1). Not available to aircraft or to units without Firepower.
- **Basic Firepower:** only Firepower and models count (plus Anti-tank/Anti-aircraft, which the book says apply even then).
- **Assault:**
  - Reach is M+2" walked over the ground, and LoS is not needed.
  - Defensive fire comes only from an unsuppressed defender, at Basic Firepower, at the first point along the route inside its range and LoS, with no terrain cover for the attacker. If the charger ends Suppressed or Broken it stops and the assault fails.
  - Assault modifiers: Assault value, size bonus, +4 against a vehicle or aircraft. Defence takes only special-rule bonuses, no terrain.
  - Assault hit table: 1 ignored, 2–3 1 SP, 4–6 a casualty and 2 SP.
  - Three alternating rounds each. Combat ends when a unit breaks (it falls back 2") or a vehicle is destroyed. If nobody breaks, the attacker falls back 2".
  - A Broken defender does not fight back but takes all three rounds. The code then has it give ground 2", a fair reading of l.682.
- **Pass/Regroup:** an immediate bonus rally roll, or a repair roll for vehicles and aircraft.
- **Suppressed units** may only:
  - Move into terrain that gives Defence (including a wall facing an enemy), into a building, or out of all enemy LoS. Not allowed if already in such a place.
  - Fire Auxiliary weapons.
  - Pass/Regroup.
- **Rally phase:** Broken units flee M+2" first. Then each unit rolls current-Morale D6, removing 1 SP per 4+. Vehicles repair at this point. Units still over 3× Morale are removed as fled.
- **End phase:** victory conditions are checked, then each human side may surrender (the opponent wins).

#### Not implemented by design / out of scope
- Physical-table matters: base sizes and multi-model bases, WYSIWYG/RCL, dice-colour marking of Suppression, activation markers, "clear intentions" and "gaps in the rules".
- Unit coherency, casualty-removal choice and the LoS-preserving removal note: single-token units, per owner decision.
- Tier systems and Priority Level: force-building, with PL capped at 2 per owner decision.
- Scenarios and campaign pointers (l.531–535) are covered by other sections.
- The AI's choices for suppressed units (it never uses Auxiliary fire and moves only into cover) are AI behaviour, not a rules departure.

### Vehicles, aircraft and drones (l.726–973)

#### Checked and conforming
- **Army limits** (`rules.js` checkArmy):
  - 3 vehicles and/or aircraft per PL.
  - At PL1, no vehicle or aircraft above the Battle Tier.
  - Aircraft only at BT II+.
  - One aircraft at PL1.
  - No more Drone units than other units.
  - Drone Control only on hulls and aircraft without Transport, never for Bugs (`canBeDrone`).
  - Drone Control gives +1 Structure (`applyDrone`), checked by running it.
- **Vehicle profile:** Structure in place of Morale. `status()` is always 'ready' for machines, so they are never Suppressed or Broken and have no Morale effects; Psychic Wave, Melancholy and landing D3 SP all skip machines.
- **Vehicle actions:** Move, Fire, Advance, Embark, Disembark, plus Pass/Regroup as a repair roll. Vehicles never assault (`canAssault`).
- **Vehicle movement:**
  - Move gives +4" (`moveBonus`).
  - Straight legs, with each turn of up to 90° costing the bracketed value, paid on the way and as a pivot at the end (`driveField`, `pivotThen`).
  - Reverse is a straight line at half distance, matching the book's 5"/7" example.
  - No buildings. No linear obstacles except wire (trenches are area terrain).
  - Tier III-V hulls flatten destructible walls and still pay the terrain penalty; reinforced walls still bar them (`terrainBars`, `crushOnMove`).
  - Vehicles pay 2" in difficult terrain (`terrainCost`).
- **Shooting at vehicles:**
  - No terrain Defence bonus (walkers excepted by Appendix).
  - No Crossfire, and the broken/crossfire hit-table modifiers are skipped.
  - Hit table: 1 bounces, 2-5 = 1 DP, 6+ = D3.
  - Knocked out when Damage is greater than Structure. Overkill +1 when more than 2 over the amount needed to destroy it, +2 when more than 4 over, not cumulative (checked by running it with a forced die).
  - Abandoned: crew out, D6 SP per passenger.
  - On fire: passengers disembark and take a Basic FP 6 attack.
  - Catastrophic: passengers eliminated, and a 4" blast at FP 3+Tier on ground units.
  - The wreck blocks line of sight in every case.
  - Rally repair rolls max(1, Structure left) D6, each 4+ removing a point (checked by running it).
- **Assaults on vehicles:** attacking infantry gets +4, and the table is 1 bounce, 2-3 = 1 DP, 4-6 = D3.
- **Transport:**
  - Up to X infantry units.
  - Passengers are off the table: no activation, not counted for Overwhelming Numbers, cannot be Suppressed or targeted.
  - Embark within 4", not Broken or Suppressed, all SP removed.
  - Half move before or after Embark/Disembark, rounded up.
  - Placement within 4", and may come closer than 1" to the hull.
  - Embark/Disembark are the vehicle's actions, so passengers may act before or after.
  - No loading and unloading the same unit in one turn (`boarded` / `disembarked`).
  - Troops may enter from reserve aboard their hull.
- **Aircraft:**
  - Move at Movement +4" or Movement. One turn at the start only (no end pivot).
  - Fly over terrain and units, and do not end within 1" of a unit.
  - Always Basic FP, both shooting and being shot at.
  - No cover, no Crossfire. Same hit table.
  - Destroyed outright, with passengers lost (campaign survival handled in the aftermath).
  - Same repair roll.
  - Cannot assault or be assaulted (Flying Infantry excepted per p.116).
  - Cannot hold or contest objectives (`holderOf` drops flyers).
  - Transport aircraft follow the ground rules, including the half move.
- **Strafing run:**
  - Up to Movement in a straight line, firing Basic at every enemy ground unit under the path.
  - Friendly ground units under the path are hit on a D6 roll of 1-3.
  - Units it did not destroy, Suppress or Break may fire back with Basic FP, free of activation. The code lets a unit that was already Suppressed before the run fire back, which is the literal reading of "as a result of".
- **Drone units:** count as Determined (`has`), lose all SP in the Rally phase (Rally only, not on Regroup), +1 on the shooting and assault hit tables, hackable, no EXP/TP, salvageable.
- **Turrets:** Xeno turrets are set `drone = true` in `engine.js:354,364`, so they are hackable as the Turret rule requires.

#### Not implemented by design / out of scope
- Model and base guidance (60x40mm bases, marked arcs).
- "Players should agree which terrain pieces are too high for aircraft": the game decides for them (`tooHighToHover`: tall buildings and hilltops).
- Aircraft line of sight is ignored entirely (`shoot.js:89`), not just "over other units". This is left as a design reading: the book does not say whether terrain blocks sight to or from an aircraft.
- The designer's notes (l.863-865, l.966-970) have no rules content.

### Terrain and terrain generators (l.974–1260)

#### Checked and conforming
- **Linear and area movement penalties:** linear terrain is paid on each crossing and is cumulative. Area terrain is paid once per move, including when the unit starts inside it. Vehicles pay double (`move.js:39-56, 103-110, 324-331`).
- **Barbed wire:** the extra D6" is rolled once before the move and cleared after it (`move.js:222`, `engine.js:1079`). Wire is destructible only by Sappers' cutting (`destruct.js:63-64`).
- **Line of sight through area terrain:** blocking terrain stops LoS between units outside it. Units inside see out and are seen (`space.js:541-563`). Hills block LoS across them except for units on them. Units on hills fire over lower friends but not over enemies (`space.js:551-584`).
- **Chest rule:** the smaller piece on a hill wins (`space.js:417-431`, `levelOf`).
- **Buildings:**
  - Entry and exit within 4" as actions, one unit per building/section, no Move/Advance/Assault from inside (`space.js:62-111`, `actions.js:109`, `engine.js:1284-1285`).
  - Range measured from the wall for shooting and assault (`space.js:16-24`). Shooting all round, with LoS from the building piece.
  - +2 Defence against shooting only (`rules.js:1131`). +2 Firepower only from high and reinforced buildings (`shoot.js:211`, `space.js:44-50`). No Crossfire inside (`shoot.js:217`).
  - Assault: the losing attacker falls back. The winning attacker occupies, and the defenders leave and fall back 2" from the wall (`assault.js:245-252, 394-399`).
  - A destroyed building burns, becomes impassable and blocks LoS, and its occupants leave (`destruct.js:84-108`).
- **Huge buildings:** a unit can move to an adjacent unoccupied section, or shoot/assault an enemy in a neighbouring section (`space.js:65-80`, `combat.js:35-43`).
- **Terrain types and the summary table:** each type's LoS, movement, Defence, Firepower and destructibility match `TERRAIN` (`rules.js:657-704`): low walls, high and reinforced walls, deep water/lava, hills, rocks, rubble/craters, ruins, woods, shallow water (Cumbersome Weapons barred, `shoot.js:81-82`, `rules.js:956`), trenches (immune to Crossfire) and low/high/reinforced buildings. Reinforced walls cannot be destroyed (`destruct.js:24`).
- **Preparing the battle:**
  - Composition points and min/max per Tier are multiplied by PL (`rules.js:293, 318`). Table is 4'x4' (`rules.js:11`).
  - Mission D6 order is Meeting, Secure, Find, Invasion, Demolish, Takeover (`scenarios.js:909`). The D3 option is offered only for Tier I/II or PL 1 (`muster.js:405-418, 1013-1014`).
  - Army swaps are for the same Tier and made in secret (`swaps.js`).
- **Terrain generators:**
  - The table is cut into 2'x2' areas, rolled D6 per area, starting from a random player and then alternating (`terrainsetup.js:30-44`).
  - All seven world tables match row by row (`gen.js:20-106`), with sensible mappings: swamps become shallow water; high rocks and volcanoes become rocks; small rocky areas become rubble.
  - Unstable world's "no more than 1 – re-roll further 6s" is applied (`gen.js:156-163`). Mountain "may be on a hill" is handled (`gen.js:84`).
  - Planet chosen randomly or not (`gen.js:589-597`).

#### Consistent with owner decisions
Priority Level is capped at 2, so "Priority 1 restrictions lifted" and the table sizes for PL 3+ do not arise. "All or nobody" for linear terrain (l.984) is moot with single-token units.

#### Not implemented by design / out of scope
- Multiplayer battles with standard scenarios (l.1108-1128) are not offered: the standard game is always one side A against one side B. That leaves out the extra D10 for the side with more armies, passing activations between allies, and the ally's consent to active rules. Co-op exists only as solitaire, governed by pp.146ff.
- "Modular table: reduce the maximum by pieces already present" (l.1174) and home-made generators (l.1176) are physical-table matters.
- Players modifying terrain alternately where a scenario gives freedom (l.1156) belongs to the scenario reviewers.

### Scenarios (l.1261–1484)

#### Checked and conforming
- **General (l.1267-1293):** End-phase victory check (`endphase.js:331-337`). Draw when both sides meet a condition (Meeting's double rout; the scenario checks otherwise cannot both fire). Annihilation as an automatic victory in every scenario, with reserves counting as still in the fight (`scenarios.js:282-286, 751-767`).
- **Rout (l.1277):** counts units rather than Tiers, half rounded up per the p.17 rounding rule (l.465). Units that left the table and units over triple Morale that flee are both marked dead and counted. Reserves count as fine (`routed`, `combat.js:86`, `endphase.js:28,233`).
- **Capture (l.1281):** needs an unsuppressed, unbroken unit within 4" and no enemy within 4". Suppressed enemies still deny. Broken and flying units are ignored. For area objectives, units inside the area count first (`holderOf`).
- **Destroy / Demolish action (l.1285, 1435):** any non-Cumbersome infantry may Demolish the objective at +2, Sappers at +4. Only Sappers may target other pieces. The objective cannot be shot down; it is impassable and blocks line of sight (`destruct.js:59-89`, `assault.js:274-277`, `rules.js:693`).
- **Meeting engagement:** random opposite edges; whole force enters in turn 1 with alternate activation; rout wins; draw at turn 20.
- **Secure and control:** three objectives 12" apart and 8" from the edges. Holding all three at any End phase wins, as does holding the same two for three End phases running. More objectives at turn 20 wins, otherwise a draw. No rout clause (none in the book).
- **Find and secure:**
  - Sites: three within 12" of the centre and 12" apart, 4" across, passable, no cover, no line-of-sight block, indestructible (`rules.js:697`).
  - Deployment and reserves: half the force enters in turn 1. From turn 3, every second turn, up to PL units may come on, chosen by the player, none allowed.
  - Check the area!: available within 4" as a special action that ends the activation, not to Suppressed units. Needs 5+ for the first site, 4+ for the second, and the third is revealed after two misses. Each site is checked once; once the objective is found the others go cold.
  - Victory: hold at the end; holding three turns running wins automatically; a rout wins, but the holder cannot be routed.
  - End roll: from turn 12, 6+ on a D6, one easier each turn after.
- **Invasion:**
  - Roles are random. The defender puts at most a third on the table (rounded up, with a player choice to put fewer); the attacker's waves are split as evenly as possible, adjustable. The attacker nominates the zones after the defender deploys, in open ground and 8" from the edges measured to the zone's edge.
  - Arrivals: the first wave chooses any of the three zones. Infantry take D3 SP on landing, vehicles none.
  - Reserve order: the defender's reserves roll 5+ each from turn 2, each on a rolled random edge at a point the player picks. The defender is placed before the attacker, with no alternation.
  - Second wave: rolls one D6 from turn 4 (5+, then 4+…), lands only in attacker-held or neutral zones, and is barred while the defender holds all three zones.
  - Victory and length: Battlefield Insertion barred for both sides. The attacker wins with 2 of 3 zones or by routing the defender. End roll from turn 12.
- **Demolish:**
  - Set-up: the objective is within 4" of the centre (computer-placed). The defender deploys half within 18". The 12" of edge either side of the corner nearest the objective is the defender's; the edges around the other three corners are the attacker's.
  - Reserves: the attacker may hold units back at PL 2, entering on turn 2 (up to turn PL). Defender reserves arrive on 5+ each from turn 2, at the defender's edges. In the Reserve phase the defender is placed after the attacker.
  - SAM: any aircraft of either side ending a move or arrival within 12" takes Basic Firepower 12 at once, including on arrival from reserve.
  - Victory and length: 12 turns; no rout clause.
- **Hostile takeover:**
  - Set-up: the objective is at the centre and indestructible. Up to 10 trenches, walls or wire sections of at most 6" each, plus one bunker (reinforced building), all within 12"; the player can place these by hand. The defender sets up within 12".
  - Attacker: half the force comes on in turn 1 along one chosen edge; the other half from turn 3, any edge, as many as the player chooses.
  - Victory: whoever controls the objective at the end of turn 20 wins, and the defender wins if no one holds it.

#### Consistent with owner decisions
- Secure and Takeover objectives are points measured at 4", with no terrain bonuses. The computer places the Secure objectives and the Demolish objective.
- Troops inside a transport take no landing Suppression in Invasion (`scenarios.js:342-350`).
- PL is capped at 2, so Demolish's "PL 3 and higher" reserve schedule is handled generically but never used.

#### Not implemented by design / out of scope
- "Players are free to play their own scenarios" (l.1265) is not supported; only the six are offered.
- Physical-table choices (picking terrain pieces as objectives, "choose one from your collection at random") are replaced by computer placement.
- The "Top 5 armoured warfare actions" box (l.1321-1331) and the quote at l.1449-1451 are flavour text.
- Eliminate and Protect (l.1287-1293) are solitaire/co-op conditions defined by the solitaire scenarios outside this range; they were not reviewed here.

### General special rules and PMC units (1) (l.1485–2003)

#### Checked and conforming
- **Unit profiles:** every PMC profile in l.1665–1990 matches `src/rules/data.js` exactly on Tier, Size, Movement, Firepower, Range, Defence (including the BA second value), Assault, Morale and special rules. That covers Recruits, Enforcers, Irregulars, Penal (cap 4), Rookie, Regular, Veterans, Rangers, Light/Assault engineers, Shock troopers, Commandos, Economy BATs, BATs, Protectors, hi-mobility Protectors, Forward observers, Sharpshooters, LRRP, Snipers, Light MG section/team, Heavy MG, Gauss cannon, Light AT, AT, Missile-armed, SAM (1 per PL) and the three remote mortar units ("Destructive" = Destructive Weapon).
- **PMC composition table and limits** (`rules.js:57-63`, `checkArmy`): points 6/12/18/24/30 and every Tier min/max are correct and multiplied by PL. Also correct: 3 vehicles/aircraft per PL, no machine above the Battle Tier at PL1, aircraft only from BT II, one aircraft at PL1, one Command Unit per PL.
- **Advanced Protection:** no side/rear bonus (`shoot.js:166`); no infantry +4 in assault (`assault.js:289`).
- **Anti-aircraft and Anti-tank:** +4, D6 criticals (`damage.js:177`), applies at Basic Firepower, ground vehicles only for AT. Anti-tank (limited) only works within 6" (`rules.js:780`).
- **Battle Armour:** Defence +2 is pierced by AT/Gauss, no terrain bonus, immune to Incendiary.
- **Battlefield Insertion:** optional, with the deploy toggle and hold option. Also correct: at most half the army (rounded up), not on turn 1, 12" from objectives and 4" from edges, not on impassable ground or another unit, and the 4-6 opponent shove up to 2D6".
- **Command Unit:** the Coordinate chain is X units within 12" of the Command Unit. It does not move or shoot, excludes units two or more Tiers higher, and does not use up the Overwhelming Numbers streak. Not offered in solitaire.
- **Command Vehicle:** passes on the Command Unit's rules, and after the vehicle acts the Command Unit gets an optional special action, counted as stationary.
- **Counter-jamming:** 6".
- **Cumbersome Weapon:** no Advance or Assault, and no main weapon in shallow water or on the turn it disembarked.
- **Destructive Weapon:** shooting terrain needs a final 15+ or a natural 9. High walls are generated at most 6" long. Reinforced pieces are immune. A breach on a sheltering unit strips cover and adds +1 to the hit rolls. Indirect Fire can bring down a low wall from any side.
- **Determined; Expendable:** collars go off when Broken, and dead penal units are left out of the rout count.
- **Field Medics:** 6" including the medic unit itself, table 1-2/3-5/6, the MEDIC! D6 save on a 6 with 1 SP either way, shooting only.
- **Gauss Weapon:** no terrain bonus, +1 Firepower against vehicles.
- **Hackers:** 24", 1-2 / 3-4 / 5-6, D3+1 hits, a 5-6 on a drone that has acted or cannot act counts as 3-4.
- **Incendiary Ammunition:** doubles Suppression in area terrain other than open ground or shallow water, rule-added SP left undoubled, BA immune, counts as Destructive Weapon against buildings.
- **Indirect Fire:** always Basic Firepower, shoots a designated target without line of sight but needs range, and a low wall gives cover from any side.
- **Inspiring Presence:** 12", re-rolls, excludes other IP units and units two or more Tiers higher.
- **Jammers:** 24", rally and repair on 5+, keeps working while Suppressed.
- **Keen-eyed.**
- **Limited Fire Arc:** ±45°.
- **Minimum Range:** nearest models, auxiliary weapons still allowed.
- **Markerlights:** Designate and Mark, move then 1 call or stand still for 2 calls (same or different target). Mark gives +2 as half range, never doubled. A designate call needs an Indirect Fire unit; a mark call needs a unit without it, with line of sight and range.
- **Sappers:** +4 against terrain, 15+ or a natural 9, 2" fall-back on failure, first round only against a sheltered unit, and an option to assault without the charges.
- **Specialisation (air/ground):** main weapon only.
- **Stealth:** +1 per full 6" beyond 6", not in assault.
- **Supporting Fire:** no +1, then embark or disembark.
- **Suppressive Fire:** +2 SP on any attack that hits, Basic Firepower included, not the auxiliary weapon.

Reading taken by the code, not reported: a Destructive breach removes the *terrain* bonuses only ("without any Defensive bonuses", l.1527), so Stealth still applies.

#### Not implemented by design / out of scope
- Each unit is a single token (owner decision), so "placed within 2" of the point / as close as possible" is just placing the token at the point.
- The "Random Deployment … enemy units can fire at them as described in the Reserve phase section" clause (l.1509) points to a mechanism the Reserve phase text (l.549) does not describe. I did not check it here. The tooltip (`ruletext.js` Battlefield Insertion) says a landing within 12" of the enemy draws a free Basic Firepower shot. That belongs to the reserves section's reviewer.
- The designer's note on custom units (l.1993–2001) has no rules content.

### PMC units (2) (l.2004–2528)

#### Checked and conforming
- **Profiles:** every profile in the range matches the book on Tier, Size, Movement and turn cost, Firepower, Range, Defence, Assault, Morale/Structure, special rules and caps. That covers the 5 Field command grades and High command (cap 1), the EW team and Medic teams (1 per PL each), all 6 drone units, the 6 combat vehicles, the 2 hunters and 2 destroyers, the 7 transport vehicles, the Light and Heavy engineering vehicles (LEV max 1), the 4 support vehicles, the EW vehicle (max 1), the Anti-aircraft vehicle (1 per PL), the Medical vehicle, Nomads (2 per PL), Chem-warriors (max 2), the Rapid insertion platform, the 4 transport aircraft and the 7 strike aircraft (Gunboat max 1, no Limited Fire Arc).
- **Missing "Ground vehicle":** the book leaves it off the LEV and EW vehicle notes, and the code adds it. Both are clearly hulls with Structure, so this is accepted.
- **Caps:** `cap`, `capPL` and the command count are enforced in `checkArmy`, which the muster, campaign and off-table paths all use, and in `rollArmy`.
- **Command Unit (X):** values 2/3/3/4 are correct. Only units that have the rule may Coordinate. The 12" reach, the exclusion of other Command Units, and the "two or more Tiers higher" exclusion are all applied.
- **Command Vehicle:** the vehicle borrows the rules of the unit aboard (`has`, `ruleValue`). After the vehicle activates, the Command Unit is offered an optional special action, counts as stationary for it, and only gets the offer while steady. Otherwise the vehicle is a Transport vehicle. This holds for the Command Vehicle and the Flying command post.
- **Inspiring Presence:** 12" reach, re-roll of failed rally dice, and the exclusions for other IP units and units two or more Tiers higher.
- **Markerlights, Hackers, Jammers and Counter-jamming:** Hackers reach 24" with the 1-2 / 3-4 / 5-6 table and D3+1 hits. Jammers reach 24" and raise the rally/repair roll to 5+. Counter-jamming covers 6".
- **Field Medics:** 6", the medic unit itself included, with the 1-2 / 3-5 / 6 table and the save on a D6 roll of 6.
- **Drone unit rules (p.40):** applied to the drones. The Light VTOL drone is always Drone Controlled, with its extra Structure already in the profile (str 4, no +1 added), and it is hackable.
- **Always Basic Firepower:** applied for the Light engineering vehicle and Chem-warriors (`shoot.js:136`).
- **Rapid insertion platform:** costs 1 composition point and fills no Tier slot. It must start with a single infantry unit aboard: the list check enforces this, and unloading at deployment is refused. It never moves or embarks, only disembarks, and is not activated once empty. It has Battlefield Insertion. It cannot hold objectives and is excluded from victory counts (`holdsGround` / `countsForVictory`).
- **Support drone:** Minimum Range (6) and Indirect Fire.
- **Recon drone and EW vehicle:** Keen-Eyed.

#### Not implemented by design / out of scope
- The background text and examples (the Teutogen "Panzerfaust" formation, the "purple" drug) contain no rules.
- Model and base sizes are physical-table matters.
- The general special rules these units use (pp. 56–59) and the vehicle and aircraft core rules (pp. 36–40) are only checked here as they apply to these units. Clause-by-clause review of those rules belongs to other ranges.
- Owner decisions this range touches: the PL cap of 2 limits the per-PL caps to at most 2× (EW and Medic teams, AA vehicle, Nomads), and per-PL command counts follow from that. Troops inside a transport, including a drop platform's squad, take no landing Suppression.

### Campaign (l.2529–2870)

#### Checked and conforming
- **Starting company:** 6 Tier I + 2 Tier II units, a free Tier I Field command (cmd4), 1 doctrine, at most 2 vehicles (`foundingCheck`).
- **Tier system and Aspiring:** Aspiring adds +1 to the battle cap only (`effectiveTier`). It needs a legal army one Tier up (`canAspire`).
- **Doctrines:**
  - one per Company Tier;
  - at most 2 per category;
  - Tier V swaps one every 5 battles, and never gains a new one;
  - a new doctrine is chosen on company promotion.
- **Contract:**
  - The Battle Tier is a D6, capped at the weaker side's (effective) Tier. A further cap applies when a roster cannot field a legal army, which matches "as long as they can compose legal armies".
  - The standard contract (Tier III, PL2, no roll) is offered when both sides can field it.
  - PL is the player's choice, within the owner's PL ≤ 2 cap.
- **Payment:** Battle Tier × PL D6 are rolled twice. The winner takes the higher total, the loser the lower, and a draw gives both the lower. PR Masters turns its own draw into the higher pay. The AI's Tough Negotiators re-rolls up to half the dice, rounded up, and the second result stands.
- **EXP:** +1 for taking part, +1 against a higher Company Tier, +1 for a win (PR Masters draws count). Breaking or destroying an enemy unit gives +1 if it is the same Tier and +2 if it is higher, one credit per enemy unit. Command Units and drones get none. Vehicles get EXP as normal.
- **Promotion:**
  - The cost is 3 × new Tier in EXP plus half the recruit cost rounded up (Tier III = 9 EXP / 4 kUC).
  - Alcoholics doubles the EXP. Bad Reputation blocks promotion.
  - Targets are the same group at the same Tier or one higher, capped at Company Tier + 1 (the book's example).
  - All the book's group exceptions hold: Recruits, Enforcers, Irregulars (Recon read as Light infantry), Penal (Basic only, free), Light support/Assault → Heavy support one way only, Unclassified never.
  - The unit keeps its honours and traumas.
- **Battle Honours:**
  - 10 EXP; 5 for an infantry unit's first under Rapid Training.
  - The cap is Tier + 1, with no duplicates.
  - The player picks three and one is drawn at random (`dossier.js:975`).
  - Rail Gun is barred to units with Cumbersome Weapon, Indirect Fire or Destructive Weapon.
  - Penal troops and machines cannot take them.
- **Upgrades:** 10 EXP, cap Tier + 1, no duplicates. The air-only and ground-only ones are restricted to their kind. Every Upgrade effect is in place: Advanced Emergency Systems 2+, ADS +4 Assault, Ballistic Computer +6", Demolisher, +1 Structure, Nanobots, Improved Engines +2"/+4", +2 Defence, Self-repair re-roll, Tank Hunter.
- **Trauma Points:**
  - +2 for being Broken.
  - +1 for losing one to half of the unit, +4 for more than half; half is rounded up per l.465.
  - +1 for a lost battle; +1 for a second battle in a row (`lastBattle`/`turn` checked for both the player and off-table rivals).
  - +5 for passengers of an aircraft that made an emergency landing.
  - A trauma comes at 10 TP, or 15 with Mental Training. The D10 is re-rolled on duplicates and 10 TP are deducted. At 10 traumas the unit is disbanded.
  - Machines and Command Units get no TP. A unit that sits a battle out sheds D3+1 TP.
- **Recruiting:** the cost table 1/4/8/16/32. Units may be up to Company Tier + 2. An extra Command Unit must be below the free one's Tier. Penal troops are free. Disbanding is allowed only if the company stays legal.
- **Company promotion:** costs 1/20/80/200. It needs legal armies at the new Tier and every Tier below, plus a Tier III PL2 army before Tier IV. The free command is promoted with the company.
- **Losses and salvage:**
  - Losses are replaced free; a wiped-out unit is removed; `rebuildNeeds` flags any Tier the company can no longer field.
  - Ground vehicles are salvaged on 3+ after a win or draw and 5+ after a loss; a catastrophic explosion is a total loss.
  - Aircraft are salvaged on 4+. Drones are salvaged on 3+ or 5+.
  - A salvaged machine sits out the next battle.
  - Drop pods are never bought or salvaged.
- **Battle Traumas in play:** Cowards, Panic-mongers, Broken-minded, Insubordinate, Bloodlust, Suicidal Tendencies, Tactical Dumbness and Unreliable all have hooks in the engine. So do the battle Honours (Brave, Last Stand, Adrenaline, Iron Discipline, NBK, Nerves, Shields, Rain of Fire, Runners, Semper Fidelis not on turn 1, Style Bonus) and the battle doctrines (S1, O1–O6, T1–T6). I only spot-checked these; they look consistent with the text.

#### Not implemented by design / out of scope
- **Rivals (camp-rivals.js) are the game's own solo layer, not book rules:** archetype development, `catchUp` and `deepen` injecting free kUC to keep rivals at the player's standing, offers, and paper battles elsewhere. The AI never uses On Our Terms.
- **Free command wiped out:** it is reconstituted rather than struck off the dossier (`camp-aftermath.js:215`). This is a reasonable reading of "its Tier is always equal to the Company Tier", but the book itself does not make that exception.
- **Owner decisions:**
  - PL is capped at 2 (`levelsFor`), consistent with the owner decision.
  - Multi-battle "contracts" (one Tier roll for all battles) are not modelled.
  - Co-op is only the hotseat mode.
- **Physical-table only:** the dossier paperwork and the download forms.

### Rebels (l.2871–3600)

#### Checked and conforming
- **Composition:**
  - The composition table matches (`rules.js:57-63`).
  - Machine and aircraft limits match (`checkArmy`, `rules.js:354-381`): 3 ground vehicles/aircraft per PL, no machine above the Battle Tier at PL 1, aircraft only from BT II, 1 aircraft per PL for Rebels, 1 FAE per PL.
  - Single-faction lists are enforced.
  - Per-unit caps match: Deserters/POWs 4 per army, the AA team 1/PL, the super-heavy transport 1/PL, Flak vehicles 1/PL as a group.
- **Unit profiles:** every Rebel profile matches the book field by field: Freedom, Holy and Mounted warriors, support, artillery, Chosen, Miners (incl. 11/9 Battle Armour), Deserters/POWs, FAE (special rules and Riders-upgrade flags, none on Rebellion leaders), combat, transport and Flak vehicles, and aviation including the Lifter.
- **Army rules:**
  - "Hasta la Victoria Siempre!" (2 free losses, 3 under Last Stand, infantry only, not Deserters/POWs, Determined still keeps full Morale) is in `rules.js:909-924`.
  - Undisciplined (+2 instead of +1 vs Broken and in crossfire, not Deserters/POWs) is in `shoot.js:336-338`.
  - "…but they'll never take our freedom!" (+3 dice, 12", 18" under Wave, excludes other leaders, Broken units and units two or more Tiers higher, leader must be steady per p.28, +5 with Incense & Iron) is in `rules.js:1560-1576`.
  - "Death or Glory, Comrades!" (removes all SP at the start of the Assault, lets a Suppressed unit charge, same exclusions, 18" under Wave, defensive fire still applies) is in `rules.js:637-653`, `actions.js:186-196` and `assault.js:134-140`.
- **Lifter:** carries one vehicle with any passengers, no infantry, no gun, no vehicle towing a gun (`rules.js:1239-1247`).
- **Riders:** M+4, double terrain penalty, no linear obstacles, no buildings, no transport (`engine.js:684`, `move.js:52-72`, `space.js:59`, `rules.js:1252`). The upgrade halves Size (rounded up) and sets Movement 10 (`rules.js:161-170`).
- **Smoke Markers:** 12" reach, designate for Indirect Fire only, two calls even after moving (`marks.js:16-74`).
- **Stationary Artillery:**
  - Never moves, Advances, Assaults or leaves the table, and can be towed by transport vehicles only (`actions.js:138,164`, `rules.js:1226-1256`).
  - Not held in reserve (except REB-5) and stays put when Broken (`endphase.js:37`, `assault.js:398`).
  - Cannot garrison, and treats shallow water as impassable.
  - Dig in!/Normal stance!: Range 24", min 6", front arc, full modifiers instead of Indirect Fire, sandbag cover, cannot be towed or turned while dug in (`shoot.js:44-52`, `rules.js:1079`, `combat.js:381-415`).
- **Tactics:**
  - Wave: 2 free Battle-Tier infantry per PL over points and Tier cap, M+4 on Move/Assault, 18" leader rules.
  - Guerillas: Stealth plus Battlefield Insertion for non-Riders infantry.
  - Last Stand: 4 barricades per PL as low walls outside the enemy zone.
  - Rebel-vs-Rebel dice-off for who picks first.
  - No tactics in solitaire (p.145).
- **Campaign:**
  - IP naming.
  - Max two Paths per group (`campaign.js:998-1009`).
  - The free FAE is at the Revolt Tier and promoted with the force (`fitCommand`). Further FAE must be of a lower Tier (`camp-company.js:273-279`). FAE get no EXP and no TP.
  - Machines: no promotion, no Battle Honours, no TP, gain EXP, take Upgrades.
  - Armed Civilians: first four free, promotion costs no IP.
  - Freedom Warriors can cross into any category except FAE and machines; everyone else promotes within their own category (`campaign.js:372-388`, `503-517`).
- **Paths:**
  - H1: 3 EXP for a win.
  - H2: half the enemy enters first in turn-1 alternating entry.
  - H3: 4 machines per PL incl. 2 aircraft.
  - H4: no TP for Broken.
  - H5: 75% IP rounded up, +2 EXP.
  - H6: Command Unit 2/3/4.
  - V1: −1 IP, minimum 1.
  - V2: reroll IP dice on a win, at the player's choice.
  - V3: the player picks a destructible non-objective piece; any FAE detonates it at FP 10 Destructive.
  - V4: up to 1/3 of infantry excluding FAE, Determined, D6+1 TP.
  - V5: optional execution of the top-TP unit, halving the others' TP.
  - V6: D3 per Battle Tier.
  - P1: Martyrdom for attacker or defender in round 1, D3 automatic hits, no SP.
  - P2: Determined for FAE.
  - P3: no loss TP for Holy Warriors.
  - P4: +2 Assault both ways.
  - P5: Inspiring Presence on the free FAE.
  - P6: 5 dice.

#### Not implemented by design / out of scope
- The designer note on placing guns in buildings or bunkers for special scenarios (l.2958) is not implemented.
- "Stationary artillery cannot occupy buildings, unless allowed by scenario": no scenario allows it.
- The background text for the Rebel factions (l.3560 onward) has no rules.
- Physical-table details have no game equivalent: placing sandbag models and removing them on Normal stance!.
- Riders mount options (Appendix 3) are outside this range.

### Space Bugs (l.3601–4102)

#### Checked and conforming
- **Composition:** the Bug composition table for BT I-V (`rules.js:66-72`) matches l.3611-3615. The swarm needs exactly one Leader Bug of Tier ≥ Battle Tier. Overgrown bugs are capped at 3/PL except at BT V. Overgrown flying bugs only from BT III, and only one at PL1. Infected humans are capped at 2/PL (`capPL`). Only one Leader Bug per army.
- **Unit profiles:** all 25 profiles (Tier, Size, Movement, turn value, FP, Range, Defence including the pierced 12/10 and 16/14, Assault, Morale, Structure, Transport 4, Minimum Range 12) and their special rules match the book. Underground maps to Battle Armour, Hardened Claws to Sappers, and the Queen has no Determined.
- **Aggressive:** an Overmind of any Tier within 18"/24" holds it back. A Suppressed bug is not forced to charge. Pass and other actions are blocked when a charge is possible.
- **Animal Behaviour:** QUEKKK on 1-3, SPLASH on 4-6 in both shooting and assault. Failed rally dice are re-rolled. No terrain cover unless an Overmind of equal or higher Tier is within reach.
- **Endless Tide:** End phase, D3 models back up to starting size, unit must be unbroken, needs an unsuppressed Overmind within reach.
- **Flying Infantry:** ignores terrain penalties, flies over impassable terrain, gets no terrain bonus, shoots and is shot at with Basic Firepower, may assault anything including aircraft and other Flying Infantry, and can only be assaulted by Flying Infantry.
- **Overgrown bugs:** use vehicle/aircraft rules, may charge, and get +4 when assaulting vehicles.
- **Overmind:** affects units of equal or lower Tier within 18" (cover and full Suppression removal in the Rally phase). A Suppressed Overmind gives no bonus (p. 28).
- **Pheromone Markers:** +1 per marker unit within 18" of the target, up to +3, only for Animal Behaviour bugs, and only from steady marker units.
- **Psychic Wave:** move up to Movement, then D6-1 Suppression to every enemy within 12" with no line of sight needed. Drones are excluded, and vehicles/aircraft are excluded because they are immune to Morale effects.
- **Campaign:** RP replaces kUC, and spawning costs are standard. One free Leader Bug at Swarm Tier, promoted free with the swarm. Other Leader Bugs must be of lower Tier, and Leader Bugs get no EXP or TP. Overgrown bugs take Adaptations and Flaws. Tiny Bug Swarms are free to recruit (first four) and promote for EXP only. Endless Tide TP: 1 for losing a bug, 4 for falling below half.
- **Evolutionary Pathways (all 18):**
  - Implemented: Carbon Metabolism, Concentrated Acid, Strong Pheromones (24"), Highly Irritating Venom, Bioplasma Missiles, Increased Control (24"), Fierce Attacks (+4 in the first round), Extensive Feeding (apart from BUG-4), Quick Learning (Tier +2), Efficient Spawn Cycle (2/3 rounded up, spawning only), Enlarged Leg Muscles, Fungi Symbiosis (human units only), Chitin Exoskeletons (+2 Defence in assault, enemy strikes first when these bugs charge), Metal-covered Talons.
  - Coordinated Hive re-rolls failed reserve dice and insertion scatter rolls.
  - Mimicry is capped at ¼ rounded up (apart from BUG-2).
- **Adaptations and Flaws:** all 10 Adaptations and all 10 Genetic Flaws are implemented. This includes Atavism stripping existing Adaptations and Reduced Intelligence being re-rolled for Overgrown bugs.

#### Not implemented by design / out of scope
- Basing and model-representation notes for Tiny bug swarms, Spitter larvae and Watcher larvae (l.3689, 3775, 3905).
- Background text and swarm fluff (l.3671-3681, 3727-3733, 3761-3767, 3813-3817, 3845-3851, 3887-3897, 3943-3947, 4053-4101). The four named swarms appear as rival/army archetypes in `campaign.js:1258-1294`.
- The Swarm/Army Tier naming (Adaptations, Flaws, Resource Points) is presentation only.

### Xenotripods (l.4103–4751)

#### Checked and conforming
- **Composition and limits:** the Xenotripod composition table (same as `COMPOSITION`, `rules.js:57-63`). Three turrets or turret sets and/or aircraft per PL. Aircraft only from Battle Tier II, and only one at PL1. No turret or aircraft above the Battle Tier at PL1 (`checkArmy`, `rollArmy`). One Alpha squad per PL. Core Gamma and Core Delta capped one per PL. One Defensive set and one Teleport set per army, and one Shield turret per PL.
- **Unit profiles:** every stat line and rule list for Alpha, Beta (Personal Deflectors = Battle Armour with 10/11 pierced), Gamma, Delta and Epsilon squads, strike and support aviation, and all turrets matches (`data.js:266-304`).
- **Special rules (battle):**
  - Cloaking System, in shooting and assault (`shoot.js:76`, `assault.js:33`).
  - Dominant Species / Regain Control: Epsilon squads only, Tier at or below the Alpha's, within 12", unit stays put, not while Suppressed.
  - Limited Senses at 12" (18" with Farsight). Drones and Drone-Controlled turrets are exempt.
  - Mental Projection: only unbroken seers count, Banishment honoured, Indirect Fire shoots over blocking terrain when the tribe sees the target.
  - Molecular Reconstruction / Self-repair.
  - Psychic Bond: borrowing Morale within 6", from a friend that is neither suppressed nor broken, per the p.28 bonus rule (a defensible reading). 1 SP per model lost to each friend within 6", ×3 with Overreaction, none with Stability.
  - Psychic Support as Field Medics, 12" with Mind Amplifiers.
  - Teleport: within 4", infantry not Suppressed or Broken, not one that was unloaded this turn. 1-2 goes to a random pad including the starting one, 3-6 to the owner's choice. Not an activation of the unit. SP lost.
  - Turrets: no sides or rear, hackable with 5-6 counted as 3-4, all activated at once, outside Overwhelming Numbers, Command and mark chains. Each set turret is a separate unit at Tier I.
  - Shield Generator: whole unit within 12", shot from outside, best one only, stacks with terrain.
- **Campaign:**
  - Territorial payment recalculation: winner 1-2→3, loser 5-6→4, applied to the dice set each side was paid from. Ran it on the book's example and it matched.
  - Free Alpha at the Tribe Tier, promoted with the tribe. Other Alphas must be of a lower Tier and earn no EXP or TP.
  - Aircraft: no promotion, Rites or TP, but EXP and 10-EXP upgrades.
  - Primitive Epsilons: free up to four, free promotion.
  - Turrets: unbought, never salvaged, no EXP or TP.
  - Promotion within the unit's own group.
  - Two advancements per group.
  - Increased Population Growth. Hermetic Society. Supportive Community. Enhanced Genetic Memory (pre-battle state, D6 2-6). Focused on Perfection.
  - Complex Teleport Network: a set of the Battle Tier, clamped to the II–IV sets that exist.
  - Fortify and Strike!: four low walls after deployment.
  - Advanced Aviation. Meditation. Aura of Majesty. Low-spectrum Cloaking. Mind Amplifiers. Dual-mode Weapons (own LoS, not aircraft).
- **Rites:** Calmness, Protection, Farsight, Devastation, Flame, Power, Invisibility, Stability, Frenzy, Unyielding Will, Shielding, Communication, Disruption, Perfection, Concentration, Fearless and Majesty.
- **Infamies:** Degeneration (rolled after the chance to spend), Defeatism, Blasphemy, Overreaction, Impudence, Madness, Banishment and Melancholy.
- **Aircraft upgrades:** Improved Engines, Emergency Batteries, High Frequency Weapons, Neutron Blasters, Auxiliary Teleportation System (2-3), Psychic Amplifier, Long-range Teleportation, Temporal Armour Amplifier and Time Vortex Generator (Move or Advance).

#### Not implemented by design / out of scope
- Detailed Terrain Knowledge's 3/4-piece variants for 6'×4' and larger tables: the game is fixed at a 4'×4' table (`rules.js:11`).
- The PL1 composition table only (PL capped at 2, owner decision). Tribe write-ups (l.4710–4748) are flavour, used only as campaign rival archetypes.
- Foresighted Command's three-dice case between two human players, and Supportive Community / Know Your Foe! in solitaire, where the engine skips arrivals logic (`arrivals.js:27`).

### Solitaire and co-op (l.4752–5118)

#### Checked and conforming
- **Phases and activation:** the turn order is Beginning, Reserve, Action, OpFor, End (`engine/solo.js`). Solitaire has no alternate activation. Co-op players alternate within the Action phase (`soloNext`). OpFor units activate furthest-from-players first (`engine.js:251-253`).
- **Behaviour table:** bands ≤0 / 1-2 / 3-4 / 5-6 / ≥7 are correct. The Assault > Firepower +1 and ≥2× +2 modifiers do not stack. "No enemy within Range" gives +2. Scenario modifiers apply. Cumbersome Weapon counts 4-7 as Neutral. The table is rolled for hulls and aircraft too.
- **Behaviour results:** Run for Your Lives! is a Move away with no shot. Kill Them All! charges the closest enemy, otherwise Moves toward it with no shot. Reasonably Offensive prefers Firepower terrain over cover (`scoreSpot`). Reasonably Neutral advances only into better cover without losing attack quality (`neutralHold`).
- **Commando table:** points (with the Rebel column) and Tier limits are correct. Machines are limited to 1 per PL, at most the Battle Tier, and aircraft only from BT II. Rebels get no tactics (`engine.js:323`, `muster.js`). Each co-op commando is PL 1 and the game is PL 2 (`muster.js:982-1003`).
- **OpFor table:** points and limits are correct. When the players bring machines, the AT/AA-or-BT-machine requirement applies. Core machine limits apply. No Battlefield Insertion and no Command Unit coordination in solitaire (`noInsertion`, `engine.js:1238`).
- **Crushing the Resistance:** D6 barricades per PL. Counters ≥6" apart. LZ is an 8" circle in open ground ≥12" from the edges, with co-op LZs 18" apart, nominated by the player. D3 SP on landing, vehicles excepted. Reveal at 18"+LoS plus the closest counter each Beginning. Neutral behaviour. Rout/routed victory.
- **Protecting the VIP:** VIP has a Command Unit statline of the Battle Tier with no special rules, and a random owner in co-op. D6+3 barricades within 12". Six entry points about 18" out. VIP deploys within 6", others within 12". Entry rolls are 5+/4+/3+/2+ by turn, one unit per entry point and max 6 a turn. +3 behaviour. Suppression is cleared each Beginning phase. +2 to Damage rolls in both shooting and assault (`damage.js:166`, `shoot.js:341`, `assault.js:358`). Units must attack the VIP when able. Destroyed units return to the pool. From turn 12 the end roll is 6, then 5+ and so on. A dead VIP ends the game at once.
- **Decapitation:** leaders in defensive positions ≥12" apart and from the edges. At least half the counters within 12" of a leader, and none within 12" of the corners. Entry within 6" of a random corner, a different one per player. Reveal at 18"+LoS, otherwise the closest counter. −1 behaviour. Leaders can be Suppressed but not Broken and never move. The game lasts 12 turns.
- **Evacuation:** 4 civilian groups per PL, with the exact civilian statline. One militia per PL of the Battle Tier, split between players. The safe zone has a building, and 3 reinforced buildings sit at the opposite corner. Units deploy in the safe zone, with militia ≥12" from the edges and optional reserves. Civilians emerge on 5+. Co-op civilian control is re-rolled each turn. Civilians over 3× Morale are not removed. Units in the safe zone rally automatically. Broken units flee to the safe zone. OpFor enters on 5+ with +3 behaviour, is barred from the safe zone and returns to the pool. The win is half the civilian models, and the game ends when all civilians are saved or dead.
- **Sabotage:** objectives ≥12" apart and from the edges. A third of the counters within 12" of an objective, the rest ≥12" from the edges. Reveal at 12"+LoS plus D3−1 closest counters. A unit within 1" destroys an objective as a special action (not while Suppressed). +1 behaviour within 12" of an objective. The game ends on all objectives destroyed or a rout.
- **Ambush!:** the road runs the full length of the table. D6 shuffle toward or away from the road. The column is 1-3" apart in random order. +D3 SP when shot at in turn 1 (machines take damage instead, l.778). Win is 75% destroyed or Broken. The player loses if all their units are Broken. From turn 6 the end roll is 6, then 5+ and so on.

#### Not implemented by design / out of scope
- **Cooperative play in a campaign** (halved currency/EXP, l.4889): listed as not implemented in README ("The co-op campaign").
- **Hand-placed terrain features:** barricades, counters, entry points, safe-zone and reinforced buildings, the evacuation point and Sabotage objectives are placed by the game, not the player. The "common sense / be fair / choose at random" guidance (l.4820-4826) is replaced by the AI heuristics.
- **The OpFor pool:** it is always rolled at random from the OpFor table (`muster.js:1003`), not hand-picked from the player's collection (l.4858). This is a natural reading for a computer game.
- **Terrain:** the solitaire terrain guidance (l.4881) is advisory only.

### Appendices (l.5119–5501)

#### Checked and conforming
- Vehicle propulsions are optional (l.5432): a hull defaults to `none` (standard rules), `rules.js:209-213`; offered only to non-alien, non-Immobile ground vehicles (`propsFor`, `rules.js:192`); no change to Unit Tier.
- Wheeled: standard rules. Tracked: Movement ¾ rounded up (p.27 rounding, l.465), turn cost −1 with a floor of 0 so some hulls turn free. Anti-grav: Movement +¼ (rounded up), −1 Structure; still pays difficult-terrain penalties and cannot cross impassable ground. Hover: deep water passable, lava still impassable, turn cost +1. Ran `applyPropulsion` on lcv/mcv/lapc/hunter: e.g. LCV M10 → tracked M8 turn 0, anti-grav M13 Str 5, hover turn 2, walker Def 12.
- Walker: pays the infantry 1" for difficult area terrain but the vehicle 2" for linear (`move.js:45`), gets terrain Defence bonuses (`rules.js:1131`), no +1 side-armour bonus for the shooter (`shoot.js:169`), Defence −1.
- Mounts (riders only, `canMount`): motorbike may be transported (`rules.js:1252`) and pays 6" instead of the Riders 2" in difficult area terrain (`move.js:53`); horse may cross linear terrain (`move.js:68`) and takes +1 SP every time it is shot at, hit or missed (`shoot.js:363-379`); grav bike ignores all terrain movement penalties (`move.js:47`) and has Defence −1 (`applyMount`). Riders' other restrictions (no buildings; no linear crossing except horses) are kept. Tooltip `ruletext.js:187-190` states these correctly.
- Multi-figure bases (l.5428): the game already plays each unit as one token (owner decision), which is what this rule describes.

#### Not implemented by design / out of scope
Documented as not implemented in `README.md:137-143`:
- Appendix 1, Close Encounters (l.5119–5320), in full: corridor/room/door/hall terrain, the rule changes (no bonus for shooting downwards, no vehicles, no Indirect Fire or mortars, Markerlights become Advanced Sensors), Detect, Covering Fire!, hidden movement, Fire at Will!, Opportunity Fire, dangerous/exploding/burning sections, special equipment (Satchel Charges, Ballistic Barrier, Stun/Incendiary Grenades, Vacuum Charges), automated defence systems, and the Clearing out, Critical control and Besieged scenarios. None of these are in the code. (The campaign's "Automated Defence Systems" upgrade at `campaign.js:334` is a separate rule.)
- Appendix 2, Other Worlds (l.5322–5404): gravity, atmosphere and anomaly effects and the D10 table, including the campaign roll per contract and the Trauma point from Unexplained weakness. Worlds only choose the terrain.
- Appendix 3: "There can be only two!" (l.5414) and "Bad, worse, the bookkeeper" rout counting (l.5490). "Different settings" (l.5494) is not a rule.
- Random army rolls (`rules.js:490`, `solitaire.js:117`) give vehicles propulsions automatically. These are editable picks, not a rule departure.

Consistent with owner decisions: one token per unit (multi-figure bases have no effect); PL cap is not affected by anything in this range.


## 6. Progress

| Finding | Outcome | Where |
|---|---|---|
| BAT-1 Broken units run off any edge | **Fixed.** The flight is away from the closest enemy first. A unit runs off only if, along the line straight away from that enemy (within 30°), it can reach a spot from which the rest of its flight carries it past the edge. Otherwise it falls back to the reachable spot furthest from the enemy and stays. | `endphase.js` (`fleeBroken`, `outAway`); test `highrules.js` |
| SCN-1 Invasion landing zones too close together | **House rule.** The zones stay 12" apart centre to centre, but a zone is held, and contested (including "all zones are hot"), only by a unit with some of its token over the 8" circle, not from 4" around it. The circles' edges are 4" apart, wider than a token, so no unit can hold or deny two. The AI walks into the zone rather than stopping 4" short. | `scenarios.js` (`areaOf`, `holderOf`), `endphase.js` (`objDist`, `objReach`), `ai.js`; test `lowscen.js` |
| REB-1 Last Stand +4 replaces cover | **No change, by the owner's decision.** "+4 to their Defence parameter when in terrain which grants a Defence bonus" is read as the cover counting +4 instead of +2 (the book's English, translated from Polish, says the same thing less clearly). Tooltip and tactic card already say so. | `rules.js` (`coverFor`, `held`) |
| VEH-1 Can't choose who gets off a transport | **Fixed.** While a hull with two or more squads aboard is unloading, the Actions panel lists them ("Which squad gets off?"); the first loaded is picked to begin with, and tapping another puts that one out next. The engine takes the pick as an intent (`droppick`), so it holds in hotseat and online; the AI still empties the hull. | `engine.js` (`droppick`), `actions.js` (`nextOff`, `dropFor`), `combat.js` (`doDisembark`), `panels.js` (`dropPanel`); test `highrules.js` |
| SOL-3 VIP: Broken units flee towards the evacuation point | **Fixed.** A Broken VIP flees away from the closest enemy, held inside its 6" ring. Other Broken units flee as in any battle: their flight is not a voluntary move, so the 12" limit does not hold them, and they may run off the table. | `solitaire.js` (`moveOK`, `fallTo`), `endphase.js` (`fleeBroken`); test `soloai.js` |
| SOL-4 Solitaire: Broken units never run off the table | **Fixed with SOL-3.** The solitaire default sent every Broken unit to a point beyond the enemy, which also kept it on the table. Now Broken units flee by the normal rule (BAT-1). The Evacuation's flight to the safe zone is kept. | `solitaire.js` (`base.fallTo`); test `soloai.js` |
| SOL-1 Evacuation entry points bunched | **Fixed.** Every distance is checked on the entry point as finally placed, after any move onto a table edge: 12" from the safe zone and from each other, 6" from the reinforced buildings' walls. If six will not fit, only the spacing between entry points gives, 2" at a time. Over 400 tables none needed it. | `solitaire.js` (`s_evac.setupTerrain`); test `soloai.js` |
| SPR-1 Markerlights don't cancel Stealth | **Fixed (owner's reading).** A shot called in by Markerlights, marked or designated, ignores the target's Stealth bonus. The price stays: a Stealth unit can be marked only within 12". The odds and the result card say "Stealth — ignored, the target is marked". | `shoot.js` (`shotMods`), `rules.js` (`defenceAgainst`), `ruletext.js`; test `lowcombat.js` |
| XEN-2 Effective Resource Utilisation pays 4, not 6 | **No change, by the owner's decision.** The garbled sentence is read as a step up from the base rule: 1–3 count as 4, instead of 1–2 as 3. Read literally (as 6), a 1 would pay more than a 4 or a 5. | `camp-contract.js` (`territorial`) |
| REB-2 Rebel tactic chosen before the roles | **Fixed.** In a one-off battle the roles are rolled first, then every human Rebel player chooses a tactic on a card that shows their role, before any terrain goes down. A generated table is held back until then. Human Wave then calls up its extra infantry (2 a Priority Level, Battle Tier) from a picker, or automatically. The muster no longer takes a tactic. The AI chooses by role: Last Stand to defend, Human Wave to attack, random without roles or in a demo. Campaign contracts are unchanged. | `engine.js` (`tacticStep`, `aiTactic`, `waveAdd`, `tacticsOn`), `panels.js` (`tacticCard`, `waveCard`), `muster.js`, `net.js`; tests `lowfaction.js`, `servertest.js`, `clienttest.js` |
| BUG-1 Strong Nervous System fires itself | **Fixed.** At the start of each Rally phase, before the Broken flee, a Bug player who still has it and has any Suppression on the swarm is asked: "Steady the swarm" (spent, once a battle) or "Not this turn". The AI keeps its rule of thumb, now before the flight. | `endphase.js` (`nervousThen`, `answerNervous`), `engine.js`, `panels.js` (`nervousCard`), `net.js`; test `lowfaction.js` |
| XEN-1 Know Your Foe! misses scenario reserves | **Fixed.** Asked at the start of the turn, after the initiative roll and before anything arrives, whenever the enemy has anyone in reserve (not only Battlefield Insertion units). Used, every enemy arrival that turn is held: scenario reserves and waves, units held back, and insertions. No arrival roll is spent. Once a battle. The AI uses it the first turn it can. | `arrivals.js` (`knowYourFoe`, `kyfHeld`, `scenarioArrivals`); test `lowfaction.js` |
| SOL-2 Ambush! split not enforced | **Fixed.** A unit cannot be put down within 6" of a unit on the other side of the road. The battle will not begin until the two halves differ by one unit at most; the deployment card says why. Auto-deploy fills the emptier side first. In co-op the commando is split as one. | `solitaire.js` (`s_ambush.deployOK`, `startBlock`, `evenBoxes`), `deploy.js` (`autoDeploy`), `engine.js` (`start`), `panels.js`; test `soloai.js` |
| CMP-1 Tough Negotiators decided before the other side rolls | **Fixed (owner's design).** Every payment die is rolled together as the aftermath opens, in every mode. A rival's own Plunderer and Tough Negotiators re-rolls are made then. Only after that are players asked, and the Plunderer and Tough Negotiators cards show the other side's roll and what the pay is as the dice stand. | `camp-contract.js` (`rollIncome`), `dossier-after.js` (`onFinish`, `rollsLine`); test `lowcamp.js` |
| TER-1 Units that cannot garrison take buildings by assault | **Fixed.** Only a winner that may garrison moves in. A Rider unit or an Overgrown bug that beats a garrison clears the building and stays outside, and the building stands empty. | `assault.js` (`assault`), `rules.js`; test `lowcombat.js` |

## 7. Low findings sorted

SOL-4 is fixed (with SOL-3). SPR-3 and PMC-3 are settled by the owner's Command Units decision. The other 53 fall into two groups; CMP-4 is split between them.

### Clear bugs (23): the code does something the book does not allow, with no fair reading for it

| Area | Findings |
|---|---|
| Battle | BAT-2 no Auxiliary defensive fire when the main weapon cannot engage; BAT-3 the free shot at an arrival ignores Minimum Range and Specialisation; TER-5 a high building's garrison sees over friends |
| Scenarios | SCN-2 annihilation in the last End phase scored as a draw in Secure and control |
| Campaign | CMP-2 Surrounded, but Steady adds dice to a Regroup; CMP-3 On Our Terms never offered to Player 2 in hotseat; CMP-4(c) a concession still charges the rout Trauma Point; REB-4 the Riders upgrade can be toggled after recruitment |
| Space Bugs | BUG-2 Mimicry leaves out Leader and Overgrown bugs; BUG-3 the Aggressive flaw does nothing on an Overgrown bug; BUG-4 Extensive Feeding misses the Sandworm's pierced Defence |
| Xenotripods | XEN-3 Rite of Knowledge forces a re-roll on a 3; XEN-4 Rite of Rage also fires on a Regroup; XEN-5 Rite of Unrest stops while its unit is Broken; XEN-6 Infamy of Panic misses many triggers; XEN-7 Teleport places the unit itself; XEN-8 Teleport tooltip says the unit must not have acted; XEN-10 Detailed Terrain Knowledge can move one piece twice; XEN-11 a rival's Foresighted Command does nothing; XEN-12 PL2 turret list capped at the Battle Tier; XEN-13 Advanced Control System turns automatically, also after an Advance |
| Solitaire | SOL-6 Defensive and Neutral OpFor shoot the easiest target, not the biggest threat; SOL-8 a Suppressed Decapitation leader never fires |

### Readings (31): the book can fairly be read either way

| Finding | Recommendation |
|---|---|
| VEH-2 vehicle explosion fired as Basic Firepower | Keep |
| VEH-3 reversing not rounded up at fractional Movement | Keep |
| TER-2 low-wall cover measured to the token's centre | Keep (single token) |
| TER-3 "one foot in grave" by majority of the base | Keep (single token) |
| TER-4 +2 from a hill against a unit in a wood or building on the same hill | Change: not "below" |
| TER-6 destroying one section burns the whole building | Change: only the section |
| TER-7 swap allowance rounds a quarter up | Change: round down, at least 1 |
| TER-8 manual terrain must place the low end of the range | Change: any number up to the top |
| TER-9 Industrial "medium walls" are high walls | Keep |
| TER-10 co-op auras help the other player's units | Change: passive rules do not cross players |
| SCN-3 Invasion edge distances to the token's centre | Change: the whole base, as Demolish does |
| SPR-2 Anti-tank and Gauss strip Battle Armour in assault | Keep |
| SPR-4 Sappers' breach +1 only to the Sappers' hits | Change: both sides' rolls that round |
| PMC-1 Medical drone counts as a Drone unit | Keep (likely misprint) |
| PMC-2 Inspiring Presence in a Command Vehicle uses the vehicle's Tier | Change: the commander's Tier |
| CMP-4(a,b) rout Trauma Point from the plain half-the-units test | Change: the scenario's own rout |
| CMP-5 Courage Under Fire: 1 SP off each later attack | Keep |
| CMP-6 Strength in Numbers | **Changed.** Owner's ruling: the free unit may be of any Tier lower than the Battle Tier. Free places go first to a lower Tier over its ceiling, then to the highest Tiers (the most points off). | `rules.js` (`checkArmy`), `campaign.js` text; test `solo.js` |
| REB-3 First Among Equals without Command Unit (X) | **Kept, and made explicit.** The owner tried the strict reading (only units with the Command Unit rule) and went back to the group reading, which sits better with the campaign. The Command Units are: Field command 4th grade to 1st grade, High command, every First Among Equals unit, every Alpha squad and every Leader Bug unit. `R.commandUnit` now covers the Alpha squads and Leader Bugs as well (Primitive Alpha troopers cannot be called on by a Coordinate chain). | `rules.js` (`commandUnit`), `damage.js`, `solitaire.js`; test `lowcombat.js` |
| REB-4 Riders upgrade | **Fixed.** The recruiting list offers each squad that may take it on foot or as Riders. The choice is final: the roster shows it fixed, and the toggle that stayed open until the first battle is gone. | `dossier-roster.js`, `dossier.js`, `campaign.js` (`ridersOpen` removed); tests `midfixes.js`, `ridersrecruit.js` |
| REB-5 Invasion and emplaced guns | **Changed (owner's ruling).** Attacker: guns drop in either wave, never on tow (no hull lands with a gun behind it; one may be hitched once both are down), and no swap is forced. Defender: guns set up at the start, or come on behind a transport vehicle held back with them; the forced swap counts one gun per transport vehicle in the force. A gun held back with nothing to tow it never comes on (the split card says so). The AI defender hitches its extra guns to held transports itself. | `scenarios.js` (`gunRule`, `freeToHold`, Invasion `deploy`/`reserves`), `swaps.js`, `save.js`, `deploy.js`, `arrivals.js`, `panels.js`; test `lowscen.js` |
| BUG-2 Mimicry for every unit | **Fixed.** Mimicry is offered to every unit without Battlefield Insertion, Leader Bugs, Overgrown bugs and the Carrier included (not an emplaced gun or a turret). Underground Advance now includes Alpha squads; aircraft wait on XEN-9. Owner's ruling: "up to ¼" rounds down (9 units → 2; fewer than 4 → none). | `engine.js` (Mimicry set-up); test `insertion.js` |
| BUG-3 Aggressive on an Overgrown bug | **Fixed.** Aggressive (the Overgrown Adrenaline Glands Flaw) now drives an Overgrown bug that has an Assault to make: it must charge the closest enemy unless an Overmind is within 18". A Carrier bug (Assault 0) and other machines are unaffected. | `rules.js` (`aggressiveNow`); test `bugs.js` |
| BUG-4 Extensive Feeding and pierced Defence | **Fixed.** The +1 Defence applies to the Defence against Anti-tank/Gauss as well (Sandworm 17/15). | `campaign.js` (`applyEntry`); test `bugcamp.js` |
| BUG-5 Pheromone Markers in an assault | **Fixed (owner's reading).** Only an Animal Behaviour bug that charges gets the bonus to its Assault; a bug being charged does not. Shooting is unchanged. | `assault.js` (`assaultMods`); test `bugs.js` |
| BUG-6 Effective Toxin Glands | **Changed (owner's ruling).** Reworded: "Spore Bugs and Flying Bugs get an additional +1 Firepower when taking the Fire! action." Spore Bugs: Fire! is worth +2 instead of +1. Flying Bugs still fire at Basic Firepower, but a Fire! action adds +1. | `shoot.js` (`shotMods`), `campaign.js` text; test `bugcamp.js` |
| BUG-7 PL1 Tier cap and Overgrown bugs | **Kept (owner's ruling).** Overgrown bugs follow the vehicle rules on the table, but they are not vehicles for the army list: the swarm's own Overgrown limits apply, not the general vehicle/aircraft caps. | — |
| CMP-6 Strength in Numbers: exactly one Tier below | Keep |
| REB-3 First Among Equals without Command Unit (X) count as Command Units | Kept (group reading) |
| REB-5 Hostile takeover may put guns in reserve | Change: guns always deploy |
| BUG-5 Pheromone Markers boost a defending bug | Change: the charger only |
| BUG-6 Effective Toxin Glands never help Flying Bugs | Change: the +2 applies to them |
| BUG-7 PL1 Battle Tier cap not applied to Overgrown bugs | Keep |
| BUG-8 Fire beetle given "Overgrown Bug" | Keep (likely misprint) |
| BUG-9 Overgrown bugs: no salvage roll, no Upgrades | Owner to say |
| XEN-9 Underground Advance: infantry only, no Alpha squads | Change: Alpha squads too (aircraft stay out) |
| XEN-14 Rite of Knowledge and Backwardness apply to the Teleport craft | Change: Teleport turrets only |
| XEN-15 turrets get no +1 Structure for Drone Control | Owner to say |
| SOL-5 Sabotage: 3 objectives at PL1 | Owner to say |
| SOL-7 Decapitation: rolled Command Units become extra leaders | Change: only the scenario's leaders |
| APX-1 hovercraft cross shallow water free | Keep |

## 8. Low findings: progress

| Finding | Outcome | Where |
|---|---|---|
| BAT-2 No Auxiliary defensive fire | **Fixed.** Where the main weapon cannot bear (inside its Minimum Range, or a Specialisation the charger is not), the defender fires its Auxiliary weapons instead. Aircraft carry none. | `assault.js` (`assault`); test `lowcombat.js` |
| BAT-3 The arrival shot ignores weapon limits | **Fixed.** The closest ready enemy within 12" and in sight fires its main weapon only if that may fire (Minimum Range, Specialisation, Cumbersome Weapon); otherwise its Auxiliary weapons; a unit that can fire neither does not take the shot. | `deploy.js` (`greetArrival`); test `lowcombat.js` |
| VEH-2 Vehicle explosion fired as Basic Firepower | **Changed (owner's reading).** A catastrophic explosion is an ordinary shooting attack at Firepower 3 + Tier on every ground unit within 4", with no Fire! bonus; within 2" it is at half range (+2). Vehicle on fire! stays Basic Firepower 6 against those aboard only. | `damage.js` (`applyDamage`); test `lowcombat.js` |
| (found with VEH-2) Crossfire from the same spot | **Fixed.** Crossfire needs the target between the two shooters; two attacks from one spot or from the same side no longer count when the target is close to the shooter. | `shoot.js` (`shotMods`); test `lowcombat.js` |
| VEH-3 Reversing not rounded up | **Changed (owner's ruling: Movement is always whole).** A hull backs up half of what is left of its move, rounded up: Move 5 backs up 3", Move 9 backs up 5". Propulsion already rounds up (a tracked Move 9 is 7); a stale comment saying otherwise is gone. | `move.js` (`driveField`), `rules.js`; test `lowmove.js` |
| TER-2 Low-wall cover to the token's centre | **Kept, and drawn (owner's ruling).** A unit is in a low wall's cover when its centre is within 2" of the wall, on either side; the +2 applies to each shot that crosses the wall. A unit in the open that is in a wall's cover now has its men lined loosely along the wall on its own side, without the token moving; one further off keeps its ranks. | `rules.js` (`behindWall`), `draw.js` (`lineUp`) |
| TER-2 (follow-up) Wall reach and cover tags | **House rule: 1.5".** A unit is in a low wall's cover when its middle is within 1.5" of the wall (`R.WALL_REACH`). Its label shows the wall's cover tag (L), and a unit in a trench now shows one too (T), like a unit in a crater (C). | `rules.js` (`WALL_REACH`, `wallCoverAt`, `behindWall`), `draw.js`, `view.js` (`terrainMark`), `input.js`; tests `terrainrules.js`, `wallshelter.js` |
| TER-3 "One foot in grave" by most of the base | **Kept (owner's decision).** A token counts as in the terrain most of its base is on, for cover and movement alike, matching how its men are drawn. | `space.js` (`kindsUnder`) |
| TER-4 Hill bonus against a wood or building on the same hill | **Changed.** Whether a target is below a shooter on a hill goes by the ground it stands on: a unit in a wood or building on the hill is at the hill's height there, so a squad on the same hill gets no +2 against it. The chest rule still keeps the hill's rules from the unit in the wood. | `space.js` (`heightUnder`), `shoot.js`; test `lowcombat.js` |
| TER-5 High-building garrison sees over friends | **No change: house rule (owner).** A garrison in a high building can shoot, and be shot at, over friendly units below it, as on a hill. | `space.js` (`sightLevel`) |
| TER-6 One destroyed section burns the whole building | **Changed.** When a garrison's fire or a Sappers' breach brings down the section it is in, that section alone burns: it becomes a burning piece, its garrison scrambles out, and the other sections stand with their garrisons. A charge or shot at the building itself, with no section to go by, still burns it all. | `destruct.js` (`destroyTerrain`, `burnSection`), `shoot.js`, `assault.js`; test `lowcombat.js` |
| (owner request) Dug-in artillery | **Changed.** A dug-in gun's sandbags give +2 Defence against fire from its 90° front arc, the same arc it fires over (was 120°), and still against plunging Indirect Fire from any side. Its label carries a cover tag (D). | `shoot.js` (`sandbagged`), `view.js` (`terrainMark`); test `sandbags.js` |
| TER-7 Swap allowance rounds a quarter up | **Changed (owner's reading).** "No more than ¼" (and Tactical Flexibility's "up to ½") is a ceiling, so it rounds down: 3 units may swap none, 6 one, 8 two; with Tactical Flexibility, 5 units may swap two. | `rules.js` (`swapAllowance`); tests `roundup.js`, `enginetest.js` |
| TER-8 Manual terrain must place the low end of the range | **No change (owner's decision).** A rolled "1–3" is a range to place within, by hand as by the generator. | `terrainsetup.js` (`tnext`) |
| TER-9 Industrial "medium walls" are high walls | **No change (owner's decision).** | `gen.js` |
| (owner report) An all-gun force in Invasion | **Changed.** Emplaced guns cannot be held back (p. 94), so where a scenario holds part of a force back (Invasion's second wave, the defenders' reserves) a list must have enough units free to be held. In the swap stage the player must swap the shortfall of guns for units of the same Tier — the allowance stretches to cover it, a needed swap cannot be spent elsewhere, and the deployment waits until it is done. The AI makes its own such swaps and fills its held-back part. A campaign bench with nothing to swap in cannot be forced. | `scenarios.js` (`noteSplit`), `swaps.js` (`splitShort`, `swapBlock`, `aiSplitSwaps`), `engine.js`; test `lowscen.js` |
| TER-10 Co-op auras help the other player's units | **No change (owner's decision).** In a co-operative game the two commandos share their abilities: passive rules such as Inspiring Presence and Field Medics help either player's units. | `rules.js` (`inspiringNearby` and the other auras) |
| SCN-2 Last-turn annihilation scored as a draw | **Fixed.** A side wiped out in the End phase loses, even when the scenario times out level that turn; it is a draw only if the wiped-out side met one of its own victory conditions the same turn, or both sides are wiped out. | `scenarios.js` (`check`); test `lowscen.js` |
| SCN-2 (follow-up) | Time-out draws are now marked as such, so a wipe-out still draws where the wiped-out side met a condition the same turn (both breaking at once), but not where the scenario merely ran out of time level. | `scenarios.js` |
| SCN-3 Invasion edge distances to the token's centre | **No change (owner's decision).** A unit is many models on the tabletop but a single token here; measuring to its middle is fine. | `scenarios.js` |
| SPR-2 Anti-tank and Gauss strip Battle Armour in assault | **No change (owner's decision).** Battle Armour's "negated by Anti-Tank or Gauss Weapons" is read without a shooting qualifier. | `rules.js` (`defenceAgainst`) |
| SPR-4 Sappers' breach +1 only to the Sappers | **Changed.** When Sappers blow the cover in, "players add +1 to all rolls when resolving hits in that round": the defenders' answer that round gets the +1 too. | `assault.js` (`assault`, `assaultRound`); test `lowcombat.js` |
| PMC-1 Medical drone counts as a Drone unit | **No change (owner's decision).** The missing "Drone unit" note is treated as a misprint in the book. | `data.js` |
| PMC-2 Inspiring Presence in a Command Vehicle uses the vehicle's Tier | **No change (owner's decision).** The vehicle carrying the rule is "the unit with Inspiring Presence". | `rules.js` (`inspiringNearby`) |
| CMP-2 Surrounded, but Steady helps a Regroup | **Fixed.** Its extra dice are rolled only in the Rally phase, not on a Pass/Regroup action's rally. | `rules.js` (`rally`); test `lowcamp.js` |
| CMP-3 On Our Terms… in hotseat | **Fixed.** Offered to each hotseat player whose company holds it; raising is capped at what both can field. When both hold it, each picks a direction: both down, it goes down; both up, it goes up; otherwise it stays. A change Player 2 makes sends the screen back to Player 1 to pick again. | `dossier-contract.js`, `dossier.js` (`data-tier`); test `hotseatterms.js` |
| CMP-4 The rout Trauma Point | **Fixed.** Routing the enemy is a scenario objective (p. 49), so the +1 TP follows the scenario: the check names the side it routed (Meeting engagement; Find and secure, never the holder of the objective; Invasion, the defender only) or a side wiped out in any scenario. Secure and control, Demolish and Hostile takeover charge it only for a wipe-out. A conceded battle never marks a side. | `scenarios.js` (`check` returns `routed`), `solitaire.js`, `endphase.js`; test `scenrules.js` |
| CMP-5 Courage Under Fire | **Kept.** Owner's ruling: 1 SP off each later attack in the turn, as Brave reads, not off each hit result. | — |
| CMP-6 Strength in Numbers | **Changed.** Owner's ruling: the free unit may be of any Tier lower than the Battle Tier. Free places go first to a lower Tier over its ceiling, then to the highest Tiers (the most points off). | `rules.js` (`checkArmy`), `campaign.js` text; test `solo.js` |
