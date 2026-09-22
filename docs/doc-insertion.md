# Firefight — insertion platforms, deployment order, and weapon fire

What follows records how four pieces of the book were read and built, so a later
session does not have to guess at the interpretation.

## Rapid insertion platforms (p. 79)

The one PMC machine the catalogue was missing. The book's row, re-typed:

> **Rapid insertion platform** — no Tier, Size 1, no Movement, no Firepower,
> no Range, no Assault, Defence 13, Structure 3.
> *Battlefield insertion. Count as an immobile Ground vehicle with Transport (1)
> rule. May only disembark troops during its activation. Cannot capture
> objectives and does not count towards victory conditions. Platforms cost 1
> composition point each and have to start the battle with a single infantry
> unit onboard.*

Unofficially *Rest in Pieces*; gliders and drop pods, whatever the fiction.

How each clause landed:

| Clause | Where it lives |
| --- | --- |
| Costs 1 composition point, but is nobody's Tier I unit | `checkArmy` adds `p.tier` to `spent` always, but only increments `counts[p.tier]` when `!p.noSlot` |
| Cannot capture objectives | `holdsGround()` is false, so `holderOf` skips it |
| Does not count towards victory conditions | `countsForVictory()` is false, so `routed` subtracts platforms from both the army count and the survivors, and `annihilated` ignores them |
| Immobile | Move and Embark refuse; `aiDrive` disembarks instead of driving |
| Transport (1) | the ordinary transport rules, capacity 1 |
| Battlefield Insertion | it starts in reserve and comes down from turn two |
| Must start with an infantry unit onboard | a new list rule (below), plus `seatPlatforms()` at deployment and a block on starting the battle while one is empty |

### The "one squad aboard" rule as a list rule

A list may hold no more platforms than it has infantry units free to ride in
them. A Command Unit is not strapped into a drop pod, and a Cumbersome Weapon
cannot fire the turn it steps off, so neither counts as a rider. `checkArmy`
raises a fault when platforms outnumber riders, and `rollArmy` will not take a
platform unless a rider is spare — which is what keeps rolled and AI lists legal.

The AI never buys one deliberately: `developRival`'s gap-filling and hull-buying
pools skip `noSlot` profiles, because a platform closes no Tier gap and a company
that bought them by the dozen (1 point each, no slot) produced 60-unit armies.

## Loading transports at deployment (p. 36)

> If the ground troops and transport vehicle are in reserve, the troops can be
> deployed onboard the vehicle.

The deployment card now carries an "Aboard before the battle" box: every
transport on the player's side, with the squads it could take listed under it.
`loadBefore` / `unloadBefore` move units in and out; `boardableFor` applies the
ordinary capacity and Size rules. A platform is auto-seated with a line squad
(`seatPlatforms`), preferring a non-command, non-Cumbersome unit, and
`deploymentDone()` refuses to start the battle while any platform is empty.

## Choosing the deployment order

A commander sets his line down in the order he likes. The deploy card lists the
order of battle; tapping a row makes that unit the next one placed, and tapping a
model already on the table picks it up to be shifted. Until then it is simply the
next unit still in hand, as before.

## Battlefield Insertion could wedge the turn

A real deadlock, reported from play: `askInsertion` waited for a legal tap and
offered no way out. On a table where the objectives and the 4" edge margin
between them leave nothing 12" clear, every tap was refused for ever and the
reserve phase never finished.

Three fixes:

1. `insertionSpots()` samples the table on a 2" lattice. If nothing is legal, the
   unit stays in reserve with a log line and the turn carries on.
2. The legal ground is now painted on the table, with the 12" exclusion round
   each objective drawn in red — the rule was previously invisible.
3. The card offers **Keep it in reserve**, so the player can always decline.

## The board fills the screen

`VIEW_W`/`VIEW_H` were fixed at 900×540 and the canvas was capped at 900px of
CSS width, so a desktop browser showed a letterboxed table in a 1400px column.
`sizeView()` now measures the frame the board sits in and the height left under
it, and re-runs on resize. A phone keeps its own 560×470 portrait window, for the
reasons noted in the code.

## What a weapon sounds and looks like

The rules never name weapon types, but they say enough about how each unit shoots
to tell four apart. `R.weaponStyle(u)`:

| Style | Test | Examples |
| --- | --- | --- |
| `shell` | a missile by name, or a Destructive Weapon on a hull (or a *cannon*, or the Hunters and destroyers group) | tanks, destroyers, anti-tank and missile teams, Gauss cannon |
| `trajectory` | Indirect Fire, and not an automatic weapon | remote mortars, support vehicles, Rebel artillery |
| `burst` | an automatic weapon by name, or the MG/FlaK/support groups | MG teams, autocannon, FlaK vehicles, technicals |
| `small` | everything else | rifles, command, transports |

Two judgement calls worth recording. A Destructive Weapon on a *squad* is usually
a satchel of charges rather than a gun, so Shock troopers and Commandos keep the
rifle volley. And a flak gun rattles even where the rules reach for Indirect Fire
to give it a ceiling, so the gun decides the sound rather than the targeting rule.

The animation follows: a shell throws a thick bolt with a blast ring and lands at
once; indirect fire lobs an arcing round with a smoke trail and a ground shadow,
in the air for 520ms plus 16ms an inch of range, with the whistle timed to the
last 450ms; a burst streams a dozen scattered tracers over half a second.

## Demolish: how to interact with the objective

The **Demolish!** action put the objective in a dashed outline and waited for a
tap on the table, which was easy to miss. The pieces in reach are now also listed
as buttons in the panel, nearest first, with the roll spelled out — and the hint
line says which two ways there are to pick one.

## Coverage

New harnesses: `weapons.js` (51), `fireart.js` (13), `deployorder.js` (19).
`roster.js` carries the platform's book row and now counts 37 of 37 machines.

---

# Second pass: the shell, the camera, and what a gun looks like

## The desktop layout

Three columns and a dock, in place of one board and one drawer:

- **Left rail** — your own order of battle, and the card for the unit you have selected.
- **Centre** — the table, the action row, the hint line and whatever card the
  current action needs.
- **Right rail** — the enemy order of battle, and the **combat results feed**.
- **Bottom** — the full combat log, collapsed by default and remembered per browser.

The results feed replaces the modal card on any screen wide enough for a rail.
Rolls land in the rail and stay there to be read back; the queue advances itself
rather than waiting for a click. The one card still shown modally is the end of
the battle, which deserves to interrupt. The phone keeps a feed of its own.

### The board fills the screen

`sizeView()` measures the frame the board sits in and the height left under it,
and re-runs on resize. On a phone it measures the box between the header and the
panel instead. The page had **no viewport meta tag**, so every phone rendered it
at a 980px layout viewport and scaled the result down — that is fixed, and it is
why the phone shell could be rebuilt at all.

### The phone shell

The table fills everything between the header and a fixed panel on the bottom
third. The panel carries the action row and four tabs: **Actions** (what each
button would do, and why the greyed-out ones are out), **Results** (the same feed,
with a count of what has landed since you last looked), **Unit** and **Forces**.
Picking a unit brings the panel back to the actions. The slide-out drawer is gone.

### The camera

The wheel zooms about the pointer; shift, a sideways wheel or a trackpad
two-finger drag pans. The zoom ladder is nine steps from "the whole table" up to
×4, with any step that would show less than the table already does dropped.

## What a gun looks like, revised

Five styles, not three (`R.weaponStyle`):

| Style | What it is | How it reads |
|---|---|---|
| `shell` | a tank gun, a destroyer, a surface-to-air missile | one thick bolt, a blast ring, lands at once |
| `trajectory` | mortars, artillery, support vehicles, **and guided anti-tank missiles** | an arcing round with a smoke trail and a ground shadow |
| `chain` | autocannon: the IFVs and APCs, light combat and patrol hulls, FlaK, autocannon teams | fat tracers you can count, one muzzle flash each |
| `burst` | machine guns | a long rattle of light tracers |
| `small` | rifles | the short volley it always was |

Two judgement calls: a guided ATGM climbs and comes down on the roof, so it arcs,
while a SAM goes straight up the sight line and does not; and a Destructive Weapon
on a *hull* is a main gun, while on a *squad* it is a satchel of charges — which is
why Shock troopers keep the rifle volley and a Medium combat vehicle does not.

## The table itself

- **Walls were inside out.** `box()` painted the two far faces over the two near
  ones, so every structure read as though you were looking through the near wall
  at the inside of the far one. The near pair is now painted last and lit.
- **Buildings hide what is behind them.** The baked structure layer is back in the
  same depth sort as the units, so a squad behind an empty block is covered by it.
- **...unless somebody is in the way.** A building with a unit inside its footprint,
  or one behind it and under its outline, is composited from a second baked layer
  drawn **cut away**: near walls off, floor and far walls in, so you can see the
  room and the troops in it.
- **The terrain key lists only what is on this table**, built from the pieces in play.
- **Unit labels carry a terrain mark** — W woods, R ruins, C crater, L low walls,
  B building, F reinforced, H hill, ~ water — because the ground is the biggest
  modifier on the table and a base's footing is not obvious from above. A machine
  is marked only for ground that still bears on it, since it takes no cover.
- **Generated tables are slightly denser.** A 1 or 2 on an area's D6 is re-rolled
  once (average area roll 3.5 → about 4.2) and piece counts sit around 57% of their
  range rather than halfway. A quadrant that draws fewer than three pieces keeps
  them clear of the table edge, where terrain can only ever be fought from one side.

## Company colours

Ten painted ramps, each a full shading set plus the `ink` the interface uses for
that side. The player picks on the muster screen (remembered); the opposition rolls
one of the colours left, so no two companies on a table match. Every marker, zone
ring and objective ring reads the palette rather than a pair of constants.

## Vehicle turn mechanics

They were in, but approximated: one turn charged for anything outside the front
quarter. Now, per p. 35:

- a turn is **up to 90°**, so 45°–135° off the heading costs one and further costs two;
- **reversing** is allowed in a straight line at half speed with no turn at all,
  and a hull takes whichever is cheaper for ground behind it;
- the move preview spells out where the allowance went.

## The insertion, animated

A craft drops out of the sky onto a marked landing point — a closing ring, a
hardening shadow, grit lifting — and throws up dust when it lands. A squad comes
up out of cover: drawn broken, then suppressed, then standing, over about a second.
It is only how it is drawn; the unit's real status is untouched.

## Demolish, made findable

The pieces in reach are listed as buttons in the panel, nearest first, with the
roll spelled out — the dashed outline on the table was easy to miss.

## Coverage

`weapons.js` 63 · `fireart.js` 17 · `mobile.js` 60 (three phone sizes) ·
`deployorder.js` 20 · plus the existing suites, all green.
