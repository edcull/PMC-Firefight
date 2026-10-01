# PMC 2670 Firefight — rules review at `7dd7306`

A clause-by-clause review of the game against the rulebook (`PMC_2670.md`, 5,501 lines), at main `7dd7306`
(Merge PR #155, 1 October 2026). The book was split into ten sections and each was read sentence by sentence
against the code that implements it. Findings marked *reproduced* were run through the headless engine; the
three High findings were also re-read in the code. Nothing in the repository was changed while reviewing.

Book references are rulebook line numbers (`l.`); code references are at `7dd7306`.

## Contents

1. [Summary](#1-summary)
2. [High](#2-high)
3. [Medium](#3-medium)
4. [Low](#4-low)
5. [Readings and deliberate departures](#5-readings-and-deliberate-departures)
6. [Not implemented](#6-not-implemented)
7. [The v0.1 review: what has been fixed](#7-the-v01-review-what-has-been-fixed)
8. [Coverage: what was checked and found correct](#8-coverage-what-was-checked-and-found-correct)
9. [Progress](#9-progress)

---

## 1. Summary

The data is exact. All 200 unit profiles match the book stat for stat: 84 PMC, 51 Rebel, 26 Space Bug and
39 Xenotripod. Every army's composition table and caps are enforced, and 4,500 randomly rolled PMC armies were
all legal. All terrain generator tables, hit tables, campaign tables and solitaire tables match. Every special
rule that appears on a unit profile has an implementation. Almost everything the v0.1 review raised is fixed.

The problems that remain are in procedures rather than numbers:

- A few rules give the wrong result in common situations: flight from the table, disembarking, and a stalled
  turn.
- Geometry in some places differs from the book: line of sight, walls and buildings.
- Several divisions round down where the book always rounds up.
- The AI breaks some rules that the player's interface enforces.
- One campaign mode, hotseat, takes Player 2's choices away from them.

| Severity | Count | Areas |
|---|---|---|
| High | 3 | Broken units never flee off the table; disembark placement; turn freezes when the initiative side cannot act |
| Medium | 17 | Line of sight; buildings; walls and Destructive Weapon; Stationary Artillery fall-back; Cumbersome AI; automatic victory versus draw; solitaire behaviour; hotseat campaign; Trauma rounding; and more |
| Low | about 40 | Edge cases, rounding, AI choices, missing player choices |

**Suggested order:**

1. **The three High findings (§2).** Each is a few lines and changes games often.
2. **The rounding sweep (M-6).** Do it in one pass, since one rule is broken in seven places.
3. **Walls: one shared "behind a wall" test (M-8), then the high-wall half of Destructive Weapon (M-9).**
4. **Fall-back and buildings (M-3, M-4, M-5).**
5. **The AI paths that skip player-side checks (M-10, M-14, M-15).**
6. **The rest.**

---

## 2. High

### H-1 · A Broken unit near its own table edge never flees off the table — *reproduced* — **fixed**

> l.709–712: "All Broken units have to flee Movement + 2" away from the closest enemy … They move in such a way as
> to avoid enemy units for as long as possible … If the unit moves off of the table, it does not return and is
> counted as having fled."

`fleeBroken` (`src/engine/endphase.js:53-62`) picks the **on-table** spot that is farthest from the nearest enemy.
The unit only counts as fled if the allowance it has left after reaching that spot runs past the edge
(`:66-68`). Near an edge, sliding along it always gains distance from the enemy, so the unit spends its whole
allowance going sideways. It never leaves the table, never counts towards a rout, and can rally later.

- **Scenario:** a Field command squad (M5, so a 7" flight) is Broken at x = 1.5–4 with the enemy 12–14" away.
  It ends at about (1.0, 17.5) every time, still alive. By the book it goes off the table.
- **Related:** a Broken unit inside a building flees through `R.fallBack` instead (`endphase.js:41-48`). That
  takes a straight line, checks only the end point, ignores terrain costs and the 1" distance from enemies,
  and never goes off the table.
- **Fix:** allow off-table end points. A flight whose straight line away from the enemy crosses the edge should
  leave the table, whatever the lattice offers.

### H-2 · Disembarking: the drop zone is the vehicle's own 4" drive, measured from its centre — *reproduced* — **fixed**

> l.809–811: "The unloaded troops are placed up to 4" from the vehicle (ALL models must be placed no further than
> 4" away)." l.817: "the transported unit and the vehicle may be closer than the usual 1"."

The player's drop spots come from `R.reachable(state, vehicle, 4)` (`src/engine/actions.js:467`; again for the
next squads at `combat.js:88`). That is the **hull's** drive field, so it brings in the hull's turn costs, the
half-speed reverse, its terrain bans (no low wall for Tier I–II, a 2" area penalty), and centre-to-centre
inches. The squad is then shifted 1.6" off the tapped point (`combat.js:75`). `R.disembark` itself checks the
right 4" base to base (`rules.js:1227-1242`), but the interface never offers anything that far out.

- **Reproduced (hover Light APC):** spots reach at most 4" ahead, 2" behind and 2" to the side, centre to
  centre. Asking for a spot 3.5" behind is refused. The furthest tap ahead left the squad 0.4" from the hull.
- **Reproduced (Tier II Light transport, low wall 1.5" ahead):** none of the 60 spots are beyond the wall,
  although the infantry may cross it.
- **Fix:** offer the infantry's own placement: every free spot whose base is within 4" of the hull's base, on
  ground the infantry may stand on. Place the squad at the tapped point.

### H-3 · The turn freezes when the side with the initiative has nothing it can activate — *reproduced* — **fixed**

> l.457: "When one player activates their last unit, the opponent can finish their activations freely."

`beginTurn → action()` (`src/engine/engine.js:785-806`) sets `activeSide = initiative` without checking that the
side has an eligible unit. Only the AI path copes with an empty list (`aiStep`, `:249`). For a human side,
`mayAct` (`:1423-1428`) refuses the opponent ("not your activation"). There is no pass intent, and `step` needs
`canAI()`.

- **Scenario (hotseat Meeting engagement, seed 3):** in turn 2 every A unit is Broken and A wins the initiative.
  B's 7 units cannot act, and the game cannot go on.
- If neither side has an eligible unit, the game should go straight to the Rally phase; that case freezes too.
- **Fix:** when the Action phase opens, hand the activation to the other side when the initiative side has no
  eligible unit, and end the phase when neither has one. This is the same hand-off as l.457.

---

## 3. Medium

### M-1 · Line of sight is a single centre-to-centre line, not "one soldier sees" — *reproduced*

> l.527–529: "We assume that when something can be seen by one soldier, it can be seen by the whole unit."

`hasLoS`/`lineClear` (`src/rules/space.js:491-535`) test one segment between token centres. Blocking terrain that
touches the segment, or any unit whose centre is within 0.9" of it, blocks all sight.

- **Scenario:** two squads 16" apart with a rock covering all but the bottom 0.8" of the line between them. The
  edges of the tokens see each other, but `canShoot` returns false.
- **Scenario:** a friendly squad 0.85" off the line also blocks completely.
- **Inherited by:** Fire!, Advance, defensive fire, the reserve-arrival shot, and the Suppressed "out of sight"
  move.
- **Fix:** test several lines between the two tokens' rims, and count the target as seen if any one of them is
  clear.

### M-2 · An automatic victory overrides a same-turn draw — *reproduced* — **fixed**

> l.1271: "When a scenario has several different victory conditions and each player meets at least one of them in
> the same turn, the game ends with a draw."

`scenarios.js:1035-1042` (`check`) returns the annihilation win before the scenario's own check runs.

- **Meeting engagement:** A is wiped out in the same End phase that B is routed. The book gives a draw; the
  code gives B the win.
- **Same in Invasion and Demolish:** for example, the objective is blown in the same turn the attacker is wiped
  out.
- **Fix:** collect every condition met this End phase before deciding.

### M-3 · Broken Stationary Artillery is pushed 2" after an assault — *reproduced* — **fixed**

> l.2952: "Broken artillery units do not retreat (they stay in place instead)."

The End-phase flight respects this (`endphase.js:31`). The assault resolver does not: `assault.js:224-226` and
the "cowed" branch at `:231-232` call `fallBack` on any Broken defender. `fallBack` (`:390-401`) has no Stationary
Artillery or Immobile check, and tests only `TERRAIN.impassable`, so a gun can also be pushed into shallow water.
In 300 charges on a medium gun, all 225 guns that broke were moved, and kept their dug-in status.

### M-4 · A garrison that loses an assault ends about 5" from its building, not 2" — *reproduced* — **fixed**

> l.1002: "If the attackers win, they occupy the building and the defenders leave it and fall back 2"."

`fallBack` (`assault.js:390-392`) first calls `leaveAway` (`space.js:110`), which picks an exit spot up to 4"
out, then adds the 2" fall-back. In 300 of 300 runs the garrison's base ended 4.98" from the wall.

### M-5 · Most generated buildings hold two or three units — *reproduced* — **fixed**

> l.1002: "Each building can be occupied by only one unit at a time." l.1006: only huge buildings are split into
> sections. Small ones are "approximately up to 4"x4"", and bigger ones should be built from other terrain types.

`gen.js:108` sizes every building 4.5–8" × 4–7". `planBuilding` (`space.js:282-322`) splits 6 of its 7 plans into
2–3 sections, and each section takes its own unit (`space.js:50-80`). On 400 generated tables, 988 of 1,154
buildings had more than one section, including 147 of the 176 small ones (≤ 5.5" × 5.5").

### M-6 · Divisions round down where the book always rounds up — **fixed**

> l.465: "If any number should be divided, it is always rounded up to a whole number."

One rule, seven places:

| Where | Book | Code | Example |
|---|---|---|---|
| Trauma "half the soldiers" thresholds | l.2627-2628 | `camp-contract.js:210` (`lost > startSize/2`), Endless Tide `:205` | 3 models, 2 lost: book +1 TP, code +4 TP (*reproduced*) |
| Terrain/army swap allowance ¼, Tactical Flexibility ½ | l.1158, l.2731 | `rules.js:1358` `Math.floor` | 3 units: book 1, code 0; 6 units: book 2, code 1 |
| Rapid Relocation ½ | l.2725 | `engine.js:625` `Math.floor` | 5 units: book 3, code 2 |
| No Place for the Weak! halving | l.3535 | `camp-aftermath.js:164` `Math.floor` | — |
| Rob the Rich ¾ | — | `camp-contract.js:143` `floor(×0.75)` | 6 becomes 4 (*reproduced*) |
| Drug Dealer "up to ⅓" | — | `dossier-contract.js:184, 355` | 2 infantry: nobody can be drugged |

The code already rounds up elsewhere (rout, Broken-minded, Mimicry, Hero of the People, the Invasion third), so
this is drift, not a ruling. The Trauma case matters most: 26 infantry profiles have an odd model count.

### M-7 · Hotseat campaign: Player 2's force and choices are made by the AI

> l.2565: "3. Compose your forces selecting units from your army dossier."

`fight()` (`src/view/dossier-contract.js:365-374`) always builds B's list with `autoPick`. If that list is
illegal it calls `C.developRival(B)`, the rival AI, which spends Player 2's money. B is given an empty bench
(about `:404`), so Player 2 cannot swap units and Tactical Flexibility does nothing for them. On Our Terms,
Foresighted Command and Drug Dealer are offered to A only.

This was read in the code but not run, because it is view code. In a hotseat campaign the second player never
picks an army.

### M-8 · Two different tests for "behind a low wall" — *reproduced* — **fixed**

`coverFor` (`rules.js:1062-1068`, loosened in 8fff720) counts the unit's **centre** within 2" of the wall, with a
½" allowance past the wall's ends. `shelterOf` (`destruct.js:50-51`) needs the **whole token** within 2" and the
line to cross the exact rectangle.

A unit 1.1–1.9" behind a low wall therefore gets the +2 cover, but the rules that need `shelterOf` do not see the
wall:

- A Destructive Weapon's 9 or 15+ (l.1533) leaves the wall up and the +2 in place.
- Sappers' +4 (l.1603) and the Demolisher's +4 are not applied.

**Fix:** have `shelterOf` use `coverFor`'s geometry.

### M-9 · Destructive Weapon never brings down a high wall that shelters its target — *reproduced* — **fixed**

> l.1533: "behind a small/high wall …".

`shelterOf` skips every piece that blocks sight (`destruct.js:47`). A mortar answering a Designate call on a squad
behind a high wall rolled an unmodified 9; the wall stayed up and no +1 was applied. The "Indirect Fire +
Destructive always destroys if near" clause (l.1565) therefore works for low walls only.

### M-10 · The AI advances with Cumbersome Weapons — *reproduced* — **fixed**

> l.1527: "Units with Cumbersome Weapons may not advance or assault."

The player's action bar blocks it (`actions.js:156`). The AI's move-then-shoot paths do not: vehicles at
`ai.js:300-302` and infantry at `:665-668`. Over 20 demo battles at Tier IV, 21 of 226 Cumbersome main-weapon
shots were Advance shots, by Heavy MG teams, Gauss cannons, missile teams, sniper teams and support/FlaK
vehicles.

### M-11 · Shooting at terrain skips shooting restrictions — *reproduced* — **fixed**

The Demolish action checks only Suppression (`actions.js:281-285`). `demolishTargets` (`engine.js:1234-1246`)
checks range, minimum range and `hasLoS || Indirect Fire`. Neither checks Cumbersome (shallow water, the turn it
disembarked), Specialisation, Limited Fire Arc, or that Indirect Fire out of sight needs a Markerlight/Smoke call
(l.1561).

- A Gauss cannon that has just disembarked cannot Fire!, but can still Demolish a building 8" away.
- A mortar with no sight and no Designate call can Demolish.

### M-12 · Hackers can hack drones that are not on the table — *reproduced* — **fixed**

> l.1553: an "enemy Drone unit … within 24"".

`canHack` (`damage.js:310-315`) does not check that the target is on the table. Units in reserve, and units aboard
a transport, sit at (-1,-1). An EW team at (6,6) hacked a drone held in reserve, which was locked out and took
2 hits. `canShoot` correctly refuses such targets (`shoot.js:60`). Markerlights have the same gap (L-14).

### M-13 · Markerlights can call one turret out of turn — *reproduced* — **fixed**

> l.4170: "All turrets are activated at once … and they are not affected by any other rule which changes
> activation order (e.g. Command units etc.)."

`canAnswerMark` (`marks.js:166-174`) and the `mark` branch of `streakFor` (`engine.js:964-967`) do not exclude
turrets. The Command Unit chain does (`:973`). The turret chain only starts when `!state.chain` (`:1103`), so a
turret answering a mark acts alone.

**Reproduced:** a Beta designates a squad; one Defensive turret fires and the other is left unactivated.

### M-14 · Solitaire: a Reasonably Neutral unit does not hold its position — *reproduced* — **fixed**

> l.4785–4790: "Unit holds its position, engaging the enemy… the OpFor unit will not leave cover to shoot at half
> range."

- **Infantry:** Neutral fires only when its shot scores above 0.4. Otherwise it uses the same move search as
  Offensive (`ai.js:630-664`), and `scoreSpot` (`:703-737`) rewards every inch closer by 0.6.
- **Vehicles:** a Neutral vehicle with no shot drives at the enemy (`:215-221`).
- **Result in 15 demo games:** 16 of 19 Neutral moves closed more than 2" on the players, 13 of them gained no
  cover, and one unit left cover to fire.

The "+2 no enemy in range" modifier sends exactly these no-shot units into the Neutral band, so Neutral plays
like Offensive.

### M-15 · Solitaire Decapitation ignores Command Units in the OpFor pool — *reproduced* — **fixed**

> l.4983: "To win, the player must destroy all OpFor Command Units." l.4991, l.5003: they are "placed in
> defensive positions… cannot be Broken… never Move nor Advance".

Only the one placed leader is fixed in place, made unbreakable and counted for the win (`solitaire.js:640-643,
710, 714-719`). `rollOpFor` (`:213`) does not exclude Command Unit profiles. In 300 rolls each, a pool held one:

| Pool | Battle Tier I | Battle Tier III | Battle Tier V |
|---|---|---|---|
| PMC | 86 | 111 | 147 |
| Rebel | 119 | 147 | 207 |

Such a unit plays as an ordinary unit and need not be killed. **Fix:** either exclude Command Unit profiles from
these pools, or treat them as leaders.

### M-16 · Campaign Riders upgrade can be switched after recruitment — **fixed**

> l.2934: "the player has to decide whether to upgrade a unit or not when that unit is recruited. The decision is
> final; it cannot be changed later."

The roster panel offers "dismount" and "take the Riders upgrade" on existing entries
(`src/view/dossier-roster.js:217-221`). The click handler flips `re.riders` (`dossier.js:757-759`). The game's own
rule text says it cannot be changed (`ruletext.js:161-163`). Toggling is right at founding only
(`dossier.js:654-656`).

### M-17 · Vehicles cannot pivot or choose their final facing

> l.758, l.766: vehicles "may make turns by reducing the range of their movement…". Facing matters for side and
> rear shots (l.587-588) and for Limited Fire Arc (l.1581).

The drive field keeps one cheapest state per cell (`move.js:519`), and `faceAfter` (`moves.js:99-107`) takes the
facing from it. No intent lets the player pay a turn's cost to end facing another way, for example to show the
front armour to a threat.

**Reproduced:** an LCV that drives 2" east always ends facing east.

---

## 4. Low

**Battle and movement**

- **L-1:** Units cannot leave the table voluntarily (l.568). The movement lattice stops at the edge.
- **L-2:** A unit can end a move astride a low wall, getting the wall's +2 against fire from both sides. Tokens
  can also overlap high walls and rocks by up to 0.5". `reachable` and `blockedAt` test only the centre
  (`move.js:600-609`, about `:243`). *Reproduced:* 69 end points sit on a wall and 47 overlap. Book l.984.
- **L-3:** A unit counted as in a wood cannot always see out of it. Cover uses the half-rim test
  (`space.js:442`); sight uses the centre (`:496-511`). This follows from the v0.1 ruling 3.26. *Reproduced.*
- **L-4:** Entering and leaving a building use different 4" measures: base edge to enter (`space.js:75`), token
  centre to leave (`:97`).
- **L-5:** Low walls run up to 7.95", against the book's "normally up to 6"" (l.980). Only the loose walls
  placed by `place()` exceed it (`gen.js:115`).
- **L-6:** Riders can cross barbed wire (l.2926: "cannot cross linear obstacles"). `move.js:64-69` bars only
  destructible linear terrain. *Reproduced.*
- **L-7:** A gravbike still pays the barbed wire D6" (l.5470: "do not suffer movement penalties"). `move.js:48`
  returns `wireRoll` before the gravbike branch.
- **L-8:** Barbed wire cannot be destroyed by Sappers (summary table, l.1087). `wire` has no `destructible`
  value (`rules.js:668`).

**Vehicles and aircraft**

- **L-9:** The AI's unloading ignores the 1" distance from enemies (`ai.js:174-178`; `R.disembark` checks only
  0.2"). Crews bailing out are placed at random, not by the owner (`damage.js:254-268`). The Suppression taken
  on an Abandoned result is added without `applyResult`, so a resulting Broken status is not announced
  (`damage.js:205-209`).
- **L-10:** Strafing return fire excludes units that were already Suppressed before the run, and measures range
  from where the aircraft ends (`combat.js:131`). The book's "as a result of" (l.906) allows them to fire back.
- **L-11:** Drones clear all Suppression on a Regroup, not only in the Rally phase (l.952; `rules.js:1512-1516`).

**Special rules**

- **L-12:** A Command Unit's Coordinate chain cannot be ended early ("up to X", l.1513). Each eligible unit must
  act or skip, which spends its activation (`engine.js:1112-1114`).
- **L-13:** The Incendiary ×2 includes Style Bonus and Overreact SP, which the book excludes (l.1557;
  `shoot.js:350`). Campaign only.
- **L-14:** Markerlights can target reserve or embarked units at (-1,-1) (`marks.js:20-27`). Choosing one wastes
  the marker's activation.
- **L-15:** "Command Unit" means different things in army building and in play. `checkArmy` counts the
  `command` flag, so Field command 4th grade uses up the one-per-PL slot (`rules.js:280, 336`). In play, a
  Command Vehicle gains nothing from a 4th-grade passenger, which lacks the "Command Unit" rule
  (`rules.js:757-803`, `damage.js:389-393`).
- **L-16:** Field Medics still treat their own wounded while Suppressed or Broken (`damage.js:22-24`). The
  tooltip says "Only while steady" (`ruletext.js:80`).
- **L-17:** Rapid insertion platforms can go into battle empty (l.2418: "have to start the battle with a single
  infantry unit"). `mustLoad` is read only by the army roller. `deploy.js:482-483` lets the player unload, and
  `deploymentDone` does not check.

**Scenarios**

- **L-18:** Secure and control and Hostile takeover objectives are points, not 8" pieces, so holding is measured
  from the centre (`scenarios.js:43-59, 801-805, 893`). A unit 6" from the takeover centre, 2" from the edge of
  an 8" object, does not hold it. *Reproduced.*
- **L-19:** The players do not place or nominate the Secure objectives (l.1345). The Demolish defender does not
  place its objective (l.1435). Both are random.
- **L-20:** "Check the area!" always searches the first site in reach (`moves.js:61`). The player cannot choose
  between two sites.
- **L-21:** Landing zones are checked at the centre only: open terrain, and 8" from the edges (l.1411;
  `scenarios.js:969-973`).
- **L-22:** Infantry landing inside a transport take no landing Suppression (l.1411, l.1421;
  `scenarios.js:640-645`).
- **L-23:** The Demolish defender's 18" circle is measured from the objective's centre (`scenarios.js:715,
  731-735`).
- **L-24:** The Invasion defender must put at least one unit on the table (l.1407: "up to ⅓";
  `scenarios.js:582`).

**Terrain set-up**

- **L-25:** Terrain changes are not made alternately from a random player. Side A's whole allowance goes first
  (l.1156; `engine.js:513-531`).
- **L-26:** The table is 4'×4' at every Priority Level. Campaign contracts allow PL 3–4, for which the book
  recommends 6'×4' (l.1140; `rules.js:11`).
- **L-27:** Unstable row 6's "1-3 reinforced buildings surrounded by reinforced walls" lays 2–6 wall sections,
  often too few to enclose the compound (`gen.js:96`).

**Armies**

- **L-28:** Deserters and POWs follow some army Tactics and not others. Hasta, Undisciplined, Freedom and Death
  or Glory are excluded. Last Stand's +4, the Guerillas' Stealth and Insertion, and Human Wave's M+4 are not
  (l.3264; `rules.js:1035`, `engine.js:282, 618`). *Reproduced.*
- **L-29:** There is no dice-off for who picks a tactic first when both sides are Rebels (l.2978).
- **L-30:** Teleport does not clear Suppression as standard embarking does (l.4166, l.823; `xeno.js:194-213`).
  It refuses already-activated units and allows units in buildings, the reverse of `canEmbark`. *Reproduced.*
- **L-31:** Mental Projection is not applied to Markerlight targeting. `markTargets` uses the 12" Xenotripod
  sight, not `tribeSees` (l.4150; `marks.js:20-26`). *Reproduced.*
- **L-32:** Psychic Bond lends the Morale of a Broken or Suppressed friend (`xeno.js:73-84` has no `projects`
  check; l.521). *Reproduced.*
- **L-33:** Turrets do not act as one in solitaire or co-op (`engine.js:1103`, `!state.solo`). This is not
  documented.
- **L-34:** Psychic Wave adds Suppression to vehicles and aircraft (l.778). The only effect is cosmetic: a
  misleading log line. *Reproduced.*
- **L-35:** The Carrier bug (Assault "-") can charge (`data.js:248` `assault: 0`; `assault.js:27`). Treat "-"
  Assault like "-" Firepower. *Reproduced.*
- **L-36:** Psychic Wave cannot be used from inside a building, although the move is "up to"
  (`actions.js:111-113`).
- **L-37:** The rules tooltip says the Lifter can lift an emplaced gun (`ruletext.js:122-124`). The code
  correctly refuses it.

**Solitaire**

- **L-38:** Reasonably Offensive prefers cover to Firepower terrain, the reverse of l.4791-4796. `scoreSpot`
  gives cover ×1.6 (×3.2 for hard cover) but only +2 for a hill (`ai.js:705-707`).
- **L-39:** A garrisoned OpFor unit that rolls Run for Your Lives! fires instead of moving away
  (`ai.js:594-611`; l.4772).
- **L-40:** The VIP's priority (l.4959) loses to Kill Them All!: the 7+ charge at another enemy comes before the
  forced VIP shot (`ai.js:617` before `:630`). Vehicles on 7+ do not shoot.
- **L-41:** Several OpFor actions skip the behaviour roll (l.4762): designation, Psychic Wave, Regain Control,
  Check the area, NOT ONE STEP BACKWARDS, the Stationary Artillery stance, and transports (`ai.js:122-200,
  535-560`).

**Campaign**

- **L-42:** No Place for the Weak! brings back v0.1 finding 3.4 for a Rebel player. TP are rolled before
  `l.landed` is set (`dossier-after.js:318`), so the passengers of an aircraft that landed safely get 9 TP, not
  5 (l.2702). *Reproduced.*
- **L-43:** The rival AI never buys Adaptations for Overgrown bugs (`camp-rivals.js:326`). Its affordability
  check ignores Smuggler and Hermetic Society (`:339`). This affects the AI only.

---

## 5. Readings and deliberate departures

The code settles each of these one way, often with a code comment citing the book. Each is a reasonable
reading; they are listed so the choice is visible.

- **Line of sight and movement:** each unit is a single 1" token, so there is no casualty choice and no
  coherency (l.525, l.617). This is by design.
- **Who may demolish an objective:** attacking infantry only, following p.49 (l.1285) over p.54 (l.1435).
- **Last Stand's +4:** replaces cover rather than adding to it, so Gauss and defensive fire strip it
  (`rules.js:1035-1036`).
- **Battle Armour:** its +2 is also removed when an Anti-tank or Gauss unit *assaults* (`rules.js:1077-1082`).
  The book words both rules as shooting rules.
- **"Markerlights ignores Stealth":** read only as the 12" marking limit. The answering shot still adds Stealth.
- **Destructive breach:** removes terrain cover only; Stealth and Shield Generator stay. **Sappers breach:** the
  +1 applies to the attacker's half of the round only.
- **Rebel tactic:** chosen at muster, before the scenario (l.2961).
- **Medical drone:** carries "Drone unit"; the book's profile omits it (`data.js:80-81`). The Light engineering
  vehicle and EW vehicle carry "Ground vehicle".
- **SAM:** fires on any aircraft, the defender's own included.
- **Landing Suppression:** not applied to infantry inside a transport (also L-22).
- **One-player solitaire:** fixed at PL 1 (co-op gives PL 2), so the book's "per Priority Level" clauses scale
  only in co-op.
- **Campaign:**
  - The Battle Tier is capped by the highest Tier the roster can field now.
  - A wiped-out free Field command is rebuilt.
  - The contract defaults to the highest common Priority Level.
  - Only one unit is credited for breaking or destroying an enemy.
  - Overgrown bugs are never salvaged, and Tier IV bugs are never promoted into Overgrown.
- **The v0.1 "ambiguous" list, unchanged:**
  - Effective Resource Utilisation counts 1-3 as 4.
  - A turret is Tier I for kill EXP.
  - Complex Teleport Network is clamped to Tier II–IV.
  - The industrial "medium walls" are high walls.
  - A Tier III+ hull crossing a high wall pays no penalty.
  - A parked aircraft blocks ground sight.
  - Vehicle explosions are fired as Basic Firepower.
  - The reserve-arrival shot needs the target in Range.

---

## 6. Not implemented

All but one item here are known gaps, and most are listed in the README.

- **Multiplayer battles (l.1108-1128):** more than two players, allies and passing activation. Only 1-v-1 and
  solitaire co-op exist.
- **Appendix 1, Close Encounters (l.5119-5323):** none of it is offered. That covers:
  - corridors, rooms and doors
  - Covering Fire!, Fire at Will! and Opportunity Fire
  - hidden movement and dangerous sections
  - special equipment and automated defences
  - its three scenarios
- **Appendix 2, Other Worlds (l.5325-5394):** gravity, atmospheres, radiation, time anomalies, and the 3×D10
  table.
- **Appendix 3:** "There can be only two!" and "Bad, worse, the bookkeeper". Multi-figure bases and Different
  settings do not apply to a digital game.
- **Campaign co-op and multi-battle contracts (l.2569, l.2575, l.4890):** a contract is always one 1-v-1 battle.
  The co-op halving and the Xenotripod "including solitaire/coop" pay clause can never apply. The v0.1 review
  called this "offered but incomplete"; it is not offered at all.
- **The modular-table terrain allowance (l.1174):** no pre-placed terrain exists, so this rarely matters.
- **The AI never chooses** Coordinate on foot, Hack or Supporting Fire. It does use Coordinate from a Command
  Vehicle and Markerlights. This is an AI gap, not a rules gap.

---

## 7. The v0.1 review: what has been fixed

Almost every rules finding from `docs/v0.1-review.md` is fixed at `7dd7306`.

**Fixed:**

- **Rout and victory:** 3.1 (rout counts the units on the table; drop pods and turrets excluded); 3.10 (one
  objective scorer); 3.20 (area objectives held from the area).
- **Special rules:** 3.2 Demolisher; 3.3 Superior Self-repair; 3.6 (the Command Vehicle offers every Command
  action); 3.7 Brave ordering; 3.9 (assault odds); 3.21 (terrain-shot modifiers); 3.22 Sappers; 3.25
  Expendable.
- **Vehicles and transport:** 3.5 (the Lifter is unarmed); 3.11 and 3.12 (towing); 3.27 (reinforced walls);
  3.30 (the strafing end point; passengers who bail out).
- **Insertion and reserves:** 3.19 and 3.24 (insertion).
- **Scenarios:** 3.23 (all six scenario items); 3.29 (the Suppressed move behind a low wall); 3.30 (Reserve
  alternation and Broken-minded rounding); 3.28 (the 36" sight is measured base to base).
- **Solitaire:** 3.14–3.18 (every solitaire item).
- **Campaign:** 3.31–3.35 (every campaign item); 3.26 is kept as a ruling.
- **Not implemented then, done now:** surrender, and the AI's use of Adrenaline Rush and Last Stand.

**Partial:** 3.4 (passengers of a downed aircraft). Fixed on the aftermath path, but broken again for a Rebel
player with No Place for the Weak! (L-42).

**Still open:**

- the Field Medics item (L-16)
- the Destructive Weapon high-wall half (M-9)
- leaving the table (L-1)
- the alternating terrain changes (L-25)
- the Secure objective nomination (L-19)

The v0.1 "ambiguous" readings of Rob the Rich and Drug Dealer are now classed as defects under l.465 (M-6).

---

## 8. Coverage: what was checked and found correct

**Profiles and armies**

- All 200 profiles, field by field: Tier, size, Movement and turn cost, Firepower, Range, Defence (including the
  pierced value), Assault, Morale, Structure, Transport and caps. Rule lists also match, allowing for naming
  variants.
- Composition tables for every army. The caps checked:
  - 3 machines per PL
  - aircraft only from Battle Tier II
  - one aircraft at PL 1
  - no machine above the Battle Tier at PL 1
  - one Command Unit / First Among Equals / Leader Bug per PL or army
  - every per-unit cap
- 4,500 rolled PMC armies were all legal.

**Battle**

- Dice, initiative, Overwhelming Numbers, one activation per unit, Morale loss per model.
- Suppression: Suppressed when SP > Morale, Broken when SP > 2×Morale, 12 SP cap.
- Rally: 4+, removed when SP > 3×Morale; phase order flee, rally, repair.
- Move M+2 (vehicles +4); the 1" distance from enemies.
- Fire! modifiers; the model-count bonus; unmodified 0 and 9.
- Hit tables for shooting, assault and vehicles; Crossfire; auxiliary weapons; Basic Firepower.
- Advance; assault reach and defensive fire; the six-round assault sequence.
- Pass/Regroup; the Suppressed action list; reserve arrivals and their free shot; surrender.

**Vehicles and aircraft**

- Turn cost per 90°; reverse; terrain penalties and crossing rules.
- Side and rear armour; Advanced Protection; Limited Fire Arc; damage and overkill.
- Abandoned, on fire, catastrophic and explosion results; repairs; embark rules.
- Half move with loading; vehicle assault rules.
- Strafing; aircraft and objectives.
- Drone Control and drone units; all five propulsions and three mounts.

**Terrain**

- Every row of the summary table.
- Building garrison, range from the walls, Firepower bonus, Crossfire immunity and destruction.
- Hills, the chest rule, and seeing in and out of area terrain.
- All 7 generator tables × 6 rows.

**Scenarios**

- Every clause of all six scenarios is correct apart from the items above, including:
  - deployment, reserves and the end rolls
  - the Find search sequence
  - the Invasion landing schedule
  - the Demolish SAM and corners
  - the Hostile takeover fortifications
  - the rout definition and the capture rules

**Special rules**

- Every general special rule has a home in the code (table in the section report); `specialrules.js` passes
  91/91.
- All Rebel, Space Bug and Xenotripod army rules.

**Solitaire**

- Behaviour bands and modifiers; activation order; the OpFor and commando tables.
- Every scenario's set-up, arrivals and victory.

**Campaign**

- Company creation, doctrines, Battle Tier and payment (including the Xenotripod worked example).
- EXP and Trauma lines, Traumas, rest.
- Promotion costs and paths; honours and upgrades with their tables.
- Recruiting costs; company promotion; disbanding; losses and salvage.
- The Rebel, Space Bug and Xenotripod campaign rules.
- All six campaign test files pass.

---

## 9. Progress

| Finding | State | Where |
|---|---|---|
| H-1 Broken units by their edge never flee off | **Fixed.** A spot from which the rest of the flight carries the unit past the edge now beats every spot on the table, so it runs off and is counted as fled. A unit fleeing a building that ends with flight to spare is fled as well. | `src/engine/endphase.js` (`fleeBroken`, `edgeGap`, `runOff`) |
| H-2 Disembark placement | **Fixed.** `R.dropSpots` offers every free spot whose base is within 4" of the hull's, on ground the squad may stand on, not on the hull, and 1" clear of everyone else. The hull's drive, turns and terrain bans no longer apply. The squad goes down where it is put. The AI's two unloading paths use the same spots, which also closes the AI half of L-9. | `src/rules/rules.js` (`dropSpots`), `src/engine/actions.js` (`dropFor`), `src/engine/combat.js` (`doDisembark`), `src/engine/ai.js` |
| H-3 The turn freezes when the initiative side has nothing to activate | **Fixed.** When the Action phase opens, a side with nothing eligible hands the phase to the other; if neither has anything, the Rally phase follows at once. The review's reproduction was itself waiting on a Battlefield Insertion choice; a clean reproduction confirms the freeze on the old code. | `src/engine/engine.js` (`beginTurn → action`) |

| M-6 Divisions round down | **Fixed.** Every division now rounds up (p. 27): the Trauma "more than half" and Endless Tide thresholds; the ¼ swap allowance and Tactical Flexibility's ½; Rapid Relocation's ½; No Place for the Weak!'s halving; Rob the Rich's 75%; and Drug Dealer's ⅓. The sweep also found three more: tracked (¾) and anti-grav (+¼) Movement left a half inch (Move 10 became 7.5 and 12.5, now 8 and 13); the half-Movement drive when loading or unloading; and the Riders "Size halved". Half range is rounded up too, in case a range is ever odd. | `camp-contract.js`, `rules.js` (`swapAllowance`, `applyPropulsion`, `applyRiders`), `engine.js` (`relocCap`), `camp-aftermath.js`, `campaign.js`, `dossier-contract.js`, `shoot.js`, `moves.js`, `actions.js` |

| M-8 Two tests for "behind a low wall" | **Fixed.** One test, `behindWall`, now decides it everywhere. The wall that gives a unit its +2 cover is the wall a Destructive Weapon's 9 or 15+ brings down, the one Sappers' +4 is against, and the one the Demolisher's +4 applies to. | `rules.js` (`behindWall`, `coverFor`), `destruct.js` (`shelterOf`) |
| M-9 Destructive Weapon never brings down a high wall | **Fixed.** "Behind a small/high wall" (p. 57) and "behind a low/high wall" (p. 59) now take high walls too, by the same test. Against Indirect Fire, the wall counts on any side (p. 58). Reinforced walls still cannot be brought down. | `destruct.js` (`shelterOf`) |

| M-3 Broken Stationary Artillery pushed 2" after an assault | **Fixed.** `fallBack` leaves Stationary Artillery and Immobile units where they are; the assault log says it stays put. | `assault.js` (`fallBack`) |
| M-4 A beaten garrison ends about 5" from its building | **Fixed.** It leaves through the far wall and its base ends no more than 2" from the building: the 2" counts from the wall and is no longer added to a 4" exit. A Broken garrison fleeing in the Rally phase ends within its M+2" the same way. | `space.js` (`exitSpots`, `leaveAway`), `assault.js` (`fallBack`) |
| M-5 Small buildings split into sections | **Fixed.** A building no longer than 5.5" on its longer side (the book's "approximately up to 4"x4"" small structure) stays a single block, so it holds one unit. Bigger buildings keep their wings, as the huge-building rule allows. The dice for the rest of the table are unchanged. The terrain snapshots were retaken. | `space.js` (`planBuilding`) |

| M-10 The AI advances with Cumbersome Weapons | **Fixed.** `canShoot` refuses an Advance shot from a Cumbersome main weapon, so no path can take one. An AI squad carrying one takes a Move (M+2") instead. The fix also turned up a broader AI fault: every AI vehicle drove Movement +4" and then fired an Advance shot. Now an AI vehicle either Advances (Movement, then a shot) or Moves (Movement +4", no shot). | `shoot.js` (`canShoot`), `ai.js` (`aiRoll`, infantry move) |
| M-14 Solitaire: Reasonably Neutral does not hold its position | **Fixed.** A Neutral OpFor unit holds its position and fires. It Advances only to a spot within its Movement with better cover than it has, and only if its best shot from there is at least as good as from where it stands, so it never leaves cover for a better shot. A Neutral vehicle holds and fires. | `ai.js` (`neutralHold`, the vehicle branch) |
| M-15 Solitaire Decapitation ignores pool Command Units | **Fixed** by the book's plural, "the OpFor Command Units": every Command Unit the pool rolled becomes a leader alongside the scenario's own. It is placed in a defensive position, cannot be Broken, never moves, and must be destroyed to win. | `solitaire.js` (`s_decap.deploy`) |

| M-2 An automatic victory overrides a same-turn draw | **Fixed.** When one side is wiped out, the scenario is still asked. If the wiped-out side met a condition that End phase, or the scenario calls it level, the result is a draw. | `scenarios.js` (`check`) |
| M-11 Shooting at terrain skips shooting restrictions | **Fixed.** `R.canShootTerrain` applies the same limits as shooting a unit: Cumbersome Weapons not from shallow water or on the turn they disembarked, no Specialisation (air), and the front arc for Limited Fire Arc and dug-in guns. A piece must also be in sight, since Indirect Fire is called onto units, never onto walls. | `rules.js` (`canShootTerrain`), `engine.js` (`demolishTargets`) |
| M-12 Hackers can hack drones off the table (and L-14, Markerlights) | **Fixed.** Neither may pick a unit in reserve or aboard a hull. | `damage.js` (`canHack`), `marks.js` (`markTargets`) |
| M-13 Markerlights call a turret out of turn | **Fixed.** A turret never answers a call, as it is "not affected by any other rule which changes activation order". | `marks.js` (`canAnswerMark`) |
| M-16 Riders switched after recruitment | **Fixed.** The roster offers the Riders upgrade only until the unit first fights, then shows it as fixed. Recruiting stays the moment to choose, since recruitment itself has no separate option for it. | `campaign.js` (`ridersOpen`), `dossier-roster.js`, `dossier.js` |

Tests: `test/unit/highrules.js` (15 checks). It fails 10 of them on `7dd7306` and passes on the fix. The full unit suite (62 files) and the transport, flight, AI and scenario browser tests pass. `test/unit/roundup.js` (16 checks) pins each rounding to the book; `propulsion.js`, `rebelcamp.js` and `enginetest.js` were updated where they asserted the rounded-down values.

`solitairetest.js`'s "two entry points take ten units in one turn" fails about 1 run in 60, before and after these changes. It places arrivals with an unseeded `Math.random`. `test/unit/wallshelter.js` (16 checks) fails 7 on `7dd7306`. `test/unit/buildings.js` (6 checks) fails 5 on `7dd7306`. The `highrules.js` freeze case now finds its own seed for A's initiative rather than relying on one. `test/unit/soloai.js` (10 checks) fails 7 on `7dd7306`. `test/unit/midfixes.js` (13 checks) and the new draw checks in `scenrules.js` fail on `7dd7306`.
