# Firefight — the scenario audit

*What the six scenarios of PMC 2670 (pp. 48–55) ask for, what the game was doing, and
what changed. Written after a pass over every objective, terrain modification and
victory condition against the book.*

---

## 1. The question that started it

> *Should Find and secure have objectives to search?*

**Yes, and it did not.** The book (p. 52) is explicit:

> Put three possible objective locations up to 12" from the middle of the table and at
> least 12" from each other. These can be any small objects up to 4" in diameter … They
> count as small, passable area terrain pieces, which do not block line of sight, do not
> provide cover and cannot be destroyed.

The game computed the three coordinates and kept them in `state.sc.search`, but pushed
nothing onto the table and returned no objectives, so **nothing was drawn**. The player
could take *Check the area!* only by walking a unit blindly into the right 4" of table.

### What it does now

Each location is a real terrain piece, `kind: 'searchsite'`, 4" square:

| property | value | why |
|---|---|---|
| `impassable` | `false` | "passable area terrain" |
| `blocks` | `false` | "do not block line of sight" |
| `cover` | `0` | "do not provide cover" |
| `movePenalty` | `0` | small enough to walk over |
| `destructible` | *absent* | "cannot be destroyed" |

Because every one of those is falsy, `rank()` scores it 0 — the same as open ground — so
a unit standing on one is treated as standing in the open. It is scenery to be seen, not
terrain to be fought over.

On the table it reads as a patch of turned-over spoil with a prised-open hatch, scattered
wreckage and a surveyor's stake flying a yellow tag. Three states:

- **unchecked** — stake up, bright tag;
- **checked and empty** — stake toppled, grey rag;
- **the real one** — stake toppled, gold tag, and the objective beacon goes up over it;
- **written off** — when the objective is found, the remaining unchecked locations are
  false and can no longer be checked (p. 52), so they are struck through in red.

The props are rebuilt after every *Check the area!*, so the table always shows what is
left to look at.

---

## 2. Victory conditions: rout is not a universal win

This was the substantial bug. The game gave **every** scenario the half-rout win. The
book gives it to three, and one of those only in one direction:

| scenario | p. | rout wins? |
|---|---|---|
| Meeting engagement | 50 | **yes**, both sides — it is the only condition |
| Secure and control | 51 | **no** — ground is the only thing that counts |
| Find and secure | 52 | **yes**, both sides, except the side holding the objective cannot be routed while it holds it |
| Invasion | 53 | **attacker only** — *"Alternatively, the attacker may rout the defender's forces"*. The defender wins by denying the landing zones at the end, not by breaking the landing |
| Demolish | 54 | **no** — the objective either comes down or it does not |
| Hostile takeover | 55 | **no** — only who stands on it at the End phase of turn 20 |

All of those are now as the book has them.

### The clause that replaces it

p. 49, and it was missing entirely:

> Completely destroying the enemy force and/or forcing all enemy units to flee results in
> an automatic victory and fulfilment of the scenario objective in the next subsequent
> End phase.

This is now checked in every End phase, before the scenario's own conditions, in all six
scenarios. Units still in reserve count as *perfectly fine* (p. 49), so a force that has
not come on yet keeps its side in the fight.

**This is what keeps the three no-rout scenarios finishing.** In testing, Secure and
control, Invasion and Hostile takeover all ended on this clause rather than grinding to
their turn limits. Games in those three are longer than they were — which is correct:
the book means them to be.

---

## 3. Invasion — "All landing zones are hot!"

p. 53, and it was not implemented:

> If the defender controls all landing zones, the second wave cannot arrive on that turn
> ("All landing zones are hot! Repeat! All landing zones are hot!"), but the attacker is
> allowed to roll again in subsequent turns, until the battle ends or the reinforcements
> finally arrive.

The second wave's arrival roll is now skipped entirely on any turn where all three zones
are in the defender's hands, and the line goes into the log and the reserve card so the
player can see why nothing came down. The defender's own reinforcements are unaffected.

Two smaller Invasion fixes:

- the defender now deploys **6" in from every edge**, not 8" in from two of them —
  the book's "at least 6" from table edges" is all four;
- the three landing zones are now chosen **on open ground** (p. 53), rather than
  wherever the cluster happened to fall. The constraint is tried hard and then dropped,
  so a table with no open ground left still gets its three zones.

---

## 4. Demolish — the table edges belong to corners

p. 54:

> The table edges within 12" from the random corner closest to the objective belong to
> the defender, and the table edges within 12" from all other corners are the attacker's
> ones.

The game was simplifying this to a 6" strip on the far side of the table. It now models
the book: each corner owns two 12"×6" bands, one along each of its edges. The corner
nearest the objective is the defender's; the attacker holds the other three — **six
bands, around three corners**, so the attack can come from three directions at once.

This needed a small generalisation in the engine, since a deployment area had until now
been either a strip or a circle: `state.sc.boxes[side]` is a list of rectangles, honoured
by tap-to-deploy, auto-deploy, the camera's opening position and the shaded band on the
table. `state.sc.entry[side]` does the same for where reinforcements walk on, so the
defender's reserves come in around their own corner rather than along a whole table side.

---

## 5. What was already right

Worth recording, because it was all checked:

- **Capture** (p. 49) — one unsuppressed, unbroken, non-flying unit within 4" and no
  enemy within 4", measured from the token edge.
- **Secure and control** — all three at any End phase, the same two for three End phases
  running, or more at the end of turn 20.
- **Find and secure** — 5+ / 4+ / automatic; each location checked once; the objective
  held for three End phases running wins outright; the D6 roll for the end after turn 12.
- **Invasion** — two waves, wave 1 down in the Reserve phase of turn 1, wave 2 from turn
  4 on 5+ easing by one a turn, landing infantry take D3 SP and vehicles do not,
  defender's reserves on 5+ from turn 2, Battlefield Insertion off for both sides.
- **Demolish** — the objective within 4" of the centre, impassable, destroyed only by the
  Demolish action, any attacking infantry at +2 and Sappers at +4, the SAM system firing
  Basic FP 12 at any aircraft finishing within 12", twelve turns.
- **Hostile takeover** — the objective at the centre, up to ten wall sections and one
  bunker within 12" of it, the defender within 12", the attacker split in two with the
  second part free to come on from turn 3.
- **The Best Defence is Good Offence** — the attacker/defender swap on a 2+.

---

## 6. Still not built

Unchanged from the earlier notes, and none of it is in the six:

- the solitaire and cooperative scenarios, and with them the **Eliminate** and
  **Protect** victory conditions (p. 49);
- multi-battle contracts;
- *Rapid Relocation* (O3), *Semper Fidelis*, *Bloodlust*;
- Space Bugs and Xenotripods.

---

## 7. Coverage

`scenrules.js` grew from 55 to 104 checks. The new ones cover every clause above: which
scenarios rout and which do not, the universal destruction clause in all six, Secure and
control's three routes home, the Find and secure holder exception and the three-turn
hold, the terrain properties of a search location and its marking, the corner bands and
their ownership, Invasion's 6" inset and open-ground landing zones, and "All landing
zones are hot!" both ways.

`scentest.js` plays all six through to a decision in the browser and now also checks that
the three locations exist as terrain, are drawn, and are marked off as they are searched.

---

# Part two — attacker, defender, and the ground they stand on

*A second pass, prompted by: "State if the player is attacked or defender in scenarios.
Ensure all deployment zones/reinforcement are correct."*

## 8. The player is now told which side of it they are on

Three of the six scenarios hand one company the attack and the other the ground, and the
two play nothing alike. The game knew which was which but barely said so — one clause
buried in the deployment card's subtitle, and it assumed the player was side A.

It is now stated in four places:

- **The header**, throughout the battle: a pill reading *You attack* in gold or
  *You defend* in blue, beside the objective count. In a demo where both sides are run by
  the machine it names the attacking company instead.
- **The deployment card**, as a badge on the scenario's own title, plus a bold line
  naming the other company and — when it applies — that *The Best Defence is Good
  Offence* swapped the roles.
- **The opening scenario card and the log**, in the same words.
- **The campaign contract screen**, before the force is even chosen: that the roles are
  randomised when the battle opens, what each one would mean in that scenario, and, for
  a company holding *The Best Defence is Good Offence*, that it has a 2+ to push the
  attack back onto them.

Each of the three scenarios now carries a `roles` pair describing what attacking and
defending actually involve there, so the briefing is written once and shown everywhere.

The deployment card's "where to put them" line is no longer a guess, either: it is read
out of the scenario's own deployment data, so it describes a circle, a set of corner
bands, an inset box, a table-edge ring or a strip — whichever the game will actually
accept — and tells an Invasion attacker plainly that nothing deploys at all.

## 9. The bug this pass turned up

**Auto-deploy was throwing the Demolish and Hostile takeover defenders onto a table
edge.** Those two give the defender a circle — within 18" of the objective, within 12" of
it — and `zoneFor()` substitutes a default table-edge strip whenever a scenario declines
to give a side a strip. Auto-deploy tested for a strip first, so it always found one, and
the circle branch immediately below it was dead code. Every sampled point was then
rejected as illegal, all four hundred of them, and the old "nowhere legal at all"
fallback dumped the unit on its own table edge — 26" from the objective it was there to
garrison, and on ground the same function would have refused a tap on.

So in every Demolish and Hostile takeover battle the machine fought, the defender was
strung out along a table edge instead of dug in around the thing being fought over.

Fixed by checking for the circle before the strip, and by replacing the edge fallback
with a spiral out from the middle of the zone that still refuses illegal ground.
`deployzones.js` is a new harness for it: it auto-deploys both sides in all six
scenarios, both ways round, at PL1 and PL2, and asks of every unit whether it is standing
somewhere that side is allowed to be. Against the old code, 16 of its 32 checks fail.

## 10. Deployment zones, against the book

| scenario | side | the book | the game |
|---|---|---|---|
| Meeting, Secure, Find | both | opposite table edges | a 6" strip each ✓ |
| Invasion | defender | ≤⅓ of the force, ≥6" from table edges | a box inset 6" on **all four** edges ✓ |
| Invasion | attacker | never deploys — it drops into the landing zones | no zone at all, and the card says so ✓ |
| Demolish | defender | half the force within 18" of the objective | an 18" circle ✓ |
| Demolish | attacker | the edges within 12" of the three corners that are not the defender's | six 12"×6" bands, three corners ✓ |
| Takeover | defender | within 12" of the objective | a 12" circle ✓ |
| Takeover | attacker | *"from any table edge chosen by the attacker"* | **fixed** — was a strip on their own edge, now a 6" band round all four edges |

Secure and control's three objectives were also in the same three places every single
game. The book has the players nominate them, so they are now placed afresh each battle,
still 12" apart and 8" in from the edges, and never on impassable ground.

## 11. Reinforcements, against the book

| scenario | who | the book | the game |
|---|---|---|---|
| Meeting, Secure | — | none | none ✓ |
| Find | both | from turn 3, every second turn, a number equal to the Priority Level, on their own edge | turns 3, 5, 7… PL units ✓ |
| Invasion | attacker | wave 1 lands turn 1; wave 2 from turn 4 on 5+, easing by one a turn, into zones the attacker holds or that are neutral; blocked entirely while the defender holds all three | ✓, measured at 33% / 50% / 67% on turns 4, 5, 6 |
| Invasion | defender | from turn 2, 5+ a unit, entering **from a random table edge** | **fixed** — was always their own edge, now any of the four |
| Demolish | defender | from turn 2, 5+ a unit, from the defender's table edge | ✓, and now from the defender's own corner rather than a whole side of the table |
| Takeover | attacker | the second part, any turn from the 3rd, **from any table edge** | **fixed** — was their own edge, now any of the four |

Battlefield Insertion (p. 56) still runs alongside all of this from turn 2, except in
Invasion, which forbids it to both sides.

## 12. Known simplifications

Stated plainly rather than left to be discovered:

- Scenario reinforcements are placed for the player rather than chosen by them. The book
  lets the defender nominate the point on the random edge, and the Takeover attacker pick
  the edge; the game picks a legal spot in the right region. Battlefield Insertion, which
  the player does choose, is unaffected.
- The Demolish attacker's optional Priority Level 2+ reserve (p. 54) is not offered; the
  whole force deploys at once, which the book permits.
- In Invasion the book has the attacker deploy after the defender in the Reserve phase
  rather than alternating; arrivals here are resolved side by side.

## 13. Coverage after this pass

`scenrules.js` 104 → 126 checks: every deployment area probed inside and out, every
reinforcement turn and dice rate measured, every entry region counted, and Secure and
control's objectives checked over 200 fresh layouts. `deployzones.js` is new, 32 checks.
`campflow.js` gained four, for the contract screen's briefing.

---

# Part three — the contracts on offer

*"When selecting a contract, display each opponent … then the player can select one."*

## 14. Picking your war

Taking a contract used to mean pressing a button and being handed whichever rival came up
on a draw. There is now a **Contracts on offer** screen between the hub and the force
selection, and the player picks the job.

Each contract states:

- **who it is against** — name, whether they are mercenaries or a revolt, their standing,
  and their archetype;
- **how they fight** — the archetype's own line about them, and the doctrines or Paths
  they are built around, each with its rule text;
- **their record against you**, and whether they have gained a Tier fighting elsewhere
  since you last met;
- **the scenario**, with the D6 that produced it and the book's own description of it;
- **how big the fight is** — the Battle Tier this job rolled, the Priority Levels both
  forces could fill at it, and the ceiling the pairing could reach if they met at full
  stretch;
- **which side of it you are on** — *You attack* or *You defend*, with what that means in
  that scenario, or a line saying neither side has the initiative;
- **what wins it.**

What it never states is a single unit of theirs. No roster, no unit count, no link to
their dossier: you know who they are and how they fight, and you find out what they
brought when it comes over the hill. That is the one hard rule of the screen, and there is
a test that fails if any card leaks a list.

## 15. How many jobs, and when they change

One job a force is the usual week. A D6 decides: on a 1 the world is quiet and one of the
three has nothing to offer; on a 6 it is busy and somebody is fighting on two fronts, with
a second roll of 5+ making that two of them. Measured over 600 campaign turns: 65% of
turns offer three, 16% offer two, 20% offer four or five. A force never offers the same
scenario twice.

The offers are rolled once per campaign turn and kept. Leaving the screen and coming back
gives the same three jobs, so backing out cannot be used to fish for an easier one; they
are cleared when a battle is fought and rolled fresh the following turn.

Every force on the world is brought up to something like the player's own standing when
the jobs are rolled — before, only the one that had been drawn was. That is what makes a
choice between three of them a real choice rather than a choice of which one is
under-levelled.

## 16. Attacker and defender are settled when the contract is taken

The roll for who attacks used to happen as the battle opened, which meant choosing a force
without knowing whether it would be storming a position or holding one. It now happens
when the contract is offered, which is the point at which it matters: the offer names it,
the contract screen repeats it, and the battle honours what was rolled rather than rolling
again.

*The Best Defence is Good Offence* (S1) is applied at the same moment, so a company that
holds it sees the attack it pushed back onto the enemy on the offer itself.

Mechanically, the roll moved out of `SC.begin` into `SC.rollRoles(scenario, doctrines)`,
which both the campaign and a one-off battle call; `begin` takes the answer as
`opts.roles` when it is given one.

## 17. Coverage after this pass

`camp.js` 175 → 189 checks, covering the shape of an offer, the stability of the set
within a campaign turn, the distribution of how many there are, and that every force is
levelled to the player. `campflow.js` and `rebelflow.js` now walk the offers screen, check
that each card carries all six things it should, and fail if one shows a unit count or a
dossier link.
