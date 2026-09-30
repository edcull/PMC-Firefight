# Plan: entering the table in the Reserve phase of turn 1

Status: **a plan for review. No code has been changed for it yet.**

## What the book says

### The turn and entering from reserve (pp. 26, 30)

- **Initiative (p. 30).** Each turn opens with the Beginning phase. Both players
  roll a D10, and the higher roll activates first (re-roll ties).
- **Reserve phase (p. 30).** Units held in reserve may enter. "When both
  players have reserve units, apply the Alternate activation rule, but ignore
  Overwhelming numbers."
- **Alternate activation (p. 26).** The players activate one unit each in turn.
  "When one player activates their last unit, the opponent can finish their
  activations freely." Overwhelming numbers (two or more in a row for a side
  with at least twice the unbroken units) does not apply to reserves.
- **Where an entering unit goes (p. 30).** Entering from a table edge, a unit is
  placed **up to 4" from the table border and at least 12" from the enemy**.
  If 12" is impossible, it goes closer, but the closest unsuppressed, unbroken
  enemy unit within 12" and line of sight may shoot it at once, at Basic
  Firepower. That shot is not an activation.
- **Entering is not an action (p. 30).** Newly arrived units can be activated
  in the Action phase that follows.
- **Transports.** If ground troops and their transport vehicle are both in
  reserve, the troops can enter aboard. This has to be declared before the
  game, and the two count as one unit in the Reserve phase.

### The scenarios (pp. 50–55)

| Scenario | Before the battle | Reserve phase, turn 1 | Later turns |
|---|---|---|---|
| Meeting engagement (p. 50) | Randomise opposite edges. Nothing placed | Both forces enter from their own edges, alternating | — |
| Secure and control (p. 51) | Randomise opposite edges; place the objectives. Nothing placed | Both forces enter from their own edges, alternating | — |
| Find and secure (p. 52) | Randomise opposite edges; each force splits into halves | Both first halves enter "using standard rules for reserves", alternating | From turn 3, every second turn, each side enters up to its Priority Level in units |
| Invasion (p. 53) | The defender deploys up to ⅓ at least 6" from the edges; the rest wait. The attacker nominates 3 landing zones and splits into two waves | The attacker's first wave drops, after the defender. The book says "instead of using alternate activation" | The defender's reserves come on at 5+ from a random edge. The second wave comes from turn 4 |
| Demolish (p. 54) | The defender deploys half within 18" of the objective; the rest wait | The attacker enters from its edges. At Priority Level 2 or higher the attacker may hold some units back | The defender's reserves come on at 5+ after the attacker's, not alternating. The attacker's held units come from turn 2 |
| Hostile takeover (p. 55) | The defender fortifies within 12" of the objective, then sets up within 12". The attacker splits its force into two parts | The attacker's first part enters from one edge of its choice | The second part enters from any edge, from turn 3 |

### The special rules that touch deployment

- **Terrorist** (Rebels, a Path of the Villain). "Before each battle… The
  terrain is nominated before unit deployment."
- **Last Stand** (a Rebel tactic, p. 95). "Up to 4 barricades per Priority
  Level… anywhere on the table with the exception of the enemy deployment
  zone." No time is given, so it happens before the battle, with the other
  set-up.
- **Detailed Terrain Knowledge** (a Xenotripod doctrine). "After setting up the
  battlefield", move two pieces up to 12". If both players have it, they
  alternate "based on Initiative".
- **Fortify and Strike!** (a Xenotripod doctrine). "In the first turn of each
  game, after the Xenotripod force is deployed", place 4 field fortifications
  in their deployment zone.
- **Rapid Relocation** (PMC doctrine O3). "After deployment in the Reserve phase
  of the 1st turn", relocate up to ½ of the units to another position the
  scenario allows. No unit moves twice. If both players have it, they
  alternate. "This applies only to units which start the battle on the table."
- **Battlefield Insertion** (p. 56).
  - The unit is held in reserve and "can arrive in any turn with the exception
    of the first". No more than half the army may use it.
  - Its arrival point is nominated at least 12" from the mission objective and
    at least 4" from the table edge.
  - On a D6 roll of 4–6, the opponent moves the point up to 2D6".
  - The unit is placed within 2" of the point, and "all standard rules for
    entering from reserves apply".
- **Know Your Foe!** (a Xenotripod doctrine). Our wording: "once a battle, in
  the Beginning phase, stop every enemy reinforcement arriving that turn".
  **Decided: it never stops turn 1's entry.** It can be used from turn 2, as
  the game allows now.

## What the game does now

- **Before the battle, everyone "deploys" in turn:** all of Player 1's force,
  then all of Player 2's. The scenario does not decide who goes first.
  `scenarios.js` says why: the base game took "enter from your table edge in the
  Reserve phase of turn 1" as "the same thing as deploying in a strip on that
  edge".
- **The strips are 6" deep,** where the book's entry distance is 4".
- **Nothing keeps entering units 12" from the enemy,** and nothing gives a close
  arrival its free shot.
- **Initiative is rolled when Begin the battle is pressed,** after everyone is
  placed. In the book, turn 1's Beginning-phase roll comes before anyone enters
  and decides who enters first.
- **Invasion is already right.** The first wave is held in reserve and dropped
  in turn 1's Reserve phase (`arrivals.js` `scenarioArrivals`), after the
  defender's.
- **The Reserve phase already works properly from turn 2,** in `arrivals.js`:
  - one unit each in turn, from the side with the initiative, with the
    scenario's own order where it has one;
  - each player's unit placed where they choose;
  - the edge and landing-zone rules, and 12" from the enemy (`clearOfEnemy`);
  - the free shot for a close arrival (`greetArrival`).
- **Bug: some deployment actions ignore whose turn it is.** Only tapping to place
  a unit checks. `autodeploy`, `load`/`unload`, `holdback` and `autosplit`
  do not, and `autosplit` resets both sides' splits. So online, Player 2 can
  auto-deploy in the middle of Player 1's deployment.
- **Rapid Relocation and Fortify and Strike! already run after deployment,**
  but before initiative, rather than inside turn 1.

## The design

Build turn 1 the way the book does it, using the Reserve phase code that
already exists.

### 1. Before the battle

1. **Terrain,** then **Terrorist** (a secret pick) and **Detailed Terrain
   Knowledge**. These are unchanged, except that when both sides have Detailed
   Terrain Knowledge they alternate, as the book asks. Initiative has not been
   rolled yet, so the order needs deciding; see the open questions.
2. **Scenario terrain:** Hostile takeover's fortifications, and the objectives.
   Unchanged.
3. **Last Stand** barricades. "Enemy deployment zone" means the enemy's entry
   band, or the defender's area where there is one.
4. **Modifying the armies** (the swaps on "Before deploying"). Unchanged.
5. **The defender's set-up, only where the scenario has one:**
   - Hostile takeover: the whole force, within 12".
   - Demolish: half, within 18".
   - Invasion: up to ⅓, at least 6" from the edges.

   This is the only pre-battle placing. The other side watches, and sees the
   waiting card and their order of battle.
6. **Declaring the entry.** Each player chooses:
   - which units are held back, where the scenario allows it (Find and
     secure's halves, Hostile takeover's two parts, Demolish at Priority Level
     2+, Invasion's waves);
   - which troops enter aboard which transport. They count as one unit when
     entering.

   Nothing goes on the table. Both players may do this at once, each for their
   own force only. It is where "Reserves and transports" moves to, and the
   game waits until both say they are ready.

### 2. Turn 1

1. **Beginning phase:** roll initiative. This is turn 1's roll, and it is not
   rolled again.
2. **Reserve phase:** every unit that enters in turn 1 is held in reserve and
   comes on through `scenarioArrivals`:
   - **alternating from the initiative** in Meeting engagement, Secure and
     control, and Find and secure (the first halves); when one side runs out,
     the other finishes;
   - **the attacker only** in Hostile takeover (the first part) and Demolish
     (whatever isn't held back);
   - **the attacker after the defender** in Invasion, as now.

   For each unit placed:
   - **within 4" of the side's own edge, at least 12" from the enemy;**
   - **if 12" is impossible, closer,** with the free shot;
   - Hostile takeover: the first unit down picks the edge, and the rest of the
     part must use it (as now);
   - **a loaded transport is one entry,** placed with its troops aboard;
   - Battlefield Insertion units stay out, since they can't arrive in turn 1.
3. **Once the entering sides are down:**
   - **Rapid Relocation,** for the units that started on the table, alternating
     if both sides have it;
   - **Fortify and Strike!** for a Xenotripod force just deployed.
4. **Action phase:** as now. Entering was not an action, so everyone can act.

Know Your Foe! is not offered in turn 1, so it can't stop the turn-1 entry. From
turn 2 it works as now.

### 3. Every mode gets it

The rules engine is shared: the server runs it online, and the browser runs
it for everything else. So the new turn 1 applies to every game played in one
of the six scenarios.

A naming clash: in the code, `state.solo` means the **solitaire and co-operative
scenarios** (pp. 150–156), not a game against the computer. Those keep their
own rules (section 4). A game against the computer is `mode: 'ai'`, and it
changes like the rest.

| Mode | Before the battle | Turn-1 entry | Who says what |
|---|---|---|---|
| **Against the computer** (`ai`, and a campaign played solo) | The player sets up if they defend; the computer's set-up is done for it | When its turn comes, the computer brings a unit on at once, as the Reserve phase already does from turn 2, then it's the player's turn again | The header pill says **Your unit** or **Enemy arriving**; the computer's entries are animated one by one, as its later reinforcements are |
| **Same screen** (`hotseat`, and a campaign played hotseat) | The defender sets up; the swaps stay secret, as now | The two players take turns at the one screen; each entry is that player's | The header says whose unit is next (**Player 2: bring a unit on**), and the panel shows that player's order of battle |
| **Online** | As same screen, but each at their own screen | Each player places only on their own turn | **Your turn to bring a unit on** or **Their turn**, the waiting card, and the other side's order of battle |
| **Demo** (`demo`, computer against computer) | Automatic | Automatic, alternating | Watched, as now |

In every mode:
- Every set-up and entry action is refused unless it's that side's turn:
  - placing, auto-placing, loading and unloading;
  - holding units back, and the automatic split, which will only change the
    sender's own side;
  - Rapid Relocation.

  Online, this stops the other player acting early. On one screen or against
  the computer, it keeps a stray tap from placing the wrong side's unit.
- **Auto-deploy** becomes "bring my units on for me as my turns come round". On
  one screen, each player can ask for it for their own units.
- The browser tests cover all four modes (step 5).

### 4. What stays as it is

- **Solitaire and co-operative scenarios** (pp. 150–156): each has its own
  deployment text and arrival rules in `solitaire.js`.
- **The tutorial,** unless it runs one of the six scenarios. To check.
- **Campaign battles:** these use the six scenarios, so they get the new turn 1.

## The work, in shippable steps

1. **Whose-turn checks and defender first.** *(Done.)* A small change on its own:
   - gate the deployment actions;
   - make `autosplit` change only the sender's side;
   - order the pre-battle placing defender first in the defender scenarios;
   - tests.
2. **Turn 1, after the Reserve phase.** *(Done.)* Begin the battle already
   opened turn 1 with its initiative roll, then its Reserve phase. What moved
   is Rapid Relocation and Fortify and Strike!: they run in turn 1, after the
   Reserve phase and before the Action phase. With both sides holding Rapid
   Relocation, they take a unit each from the initiative (the computer makes
   all its moves at once, on its turn). Each side ends with **Done relocating**.
3. **Entry through the Reserve phase** for Meeting engagement, Secure and
   control, and Find and secure:
   - hold every entering unit in reserve;
   - the declaring step (held back, and who rides what);
   - 4" entry bands in place of the 6" strips;
   - the waiting UI and the computer opponent.
4. **Hostile takeover and Demolish.** The attacker's entry goes through the
   Reserve phase; the defender's set-up stays before the battle.
5. **Tests and a browser run of every scenario:**
   - online (two browsers), on one screen, and against the computer;
   - replays and saved games made before the change (either load them, or
     refuse them cleanly, as the game already does for other old saves).

Each step leaves the game playable and can be merged on its own.

## Decisions

1. **Detailed Terrain Knowledge on both sides:** each rolls a D10 of its own,
   re-rolling ties, and the higher moves a piece first. This roll is separate
   from turn 1's initiative.
2. **Find and secure's halves:** as now. The player chooses which units go in
   each half, within the count the book allows.
3. **Last Stand's "enemy deployment zone"** when the enemy doesn't deploy before
   the battle: the ground where the enemy will be placed.

   | Rebels are… | Enemy's "deployment zone" |
   |---|---|
   | Either side in Meeting engagement, Secure and control, Find and secure | The enemy's 4" entry band along their own edge |
   | Defending Hostile takeover | All four edges' 4" bands, because the attacker picks its edge later |
   | Attacking Hostile takeover | The defender's 12" circle around the objective |
   | Defending Demolish | The attacker's entry bands: 4" deep, along the table edges within 12" of the three corners that are not the defender's |
   | Attacking Demolish | The defender's 18" circle around the objective |
   | Defending Invasion | Nothing forbidden, because the landing zones are nominated later |
   | Attacking Invasion | The ground the defender may deploy on: anywhere at least 6" from the edges. This leaves only the outer 6" |

   Attacking Invasion is read literally, so Rebel attackers can barricade only
   the outer 6". An invader shouldn't get much say in the defences.

All questions are settled.
