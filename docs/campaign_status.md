# The campaign and the scenarios — what is built

*Published at version 29. Status against `claude/Firefight_campaign_plan.md`.*

## How to start a campaign

Press **Campaign** in the header, or **"Play a campaign instead"** at the foot of the muster
sheet. (The muster sheet used to cover the header button on a fresh load, so there was no way
in at all until you had started a one-off battle first — that is fixed.)

Then: name the company, choose solo or hotseat and which rival archetype to face, pick six
Tier I units, two Tier II and a doctrine, and sign the charter. After that it is
**Take a contract** each time.

## The six scenarios (pp. 48–55) — all implemented

`scenarios.js` holds them as a table the turn loop asks questions of; everything a scenario
remembers for itself lives on `state.sc`, so the engine never has to know which one is running.
The D6 that picks a scenario is the book's, with the D3 option at the lower Tiers (p. 46).

| Scenario | What it adds |
|---|---|
| **Meeting engagement** (p. 50) | No objectives at all. Rout or be routed, twenty turns. |
| **Secure and control** (p. 51) | Three objectives — plus the "same two for three End phases running" condition that was missing before. |
| **Find and secure** (p. 52) | Three candidate locations and a new **Check the area!** action: 5+ at the first, 4+ at the second, automatic at the third. Half each force in reserve, PL units arriving every second turn from turn 3. Rolls for the end after turn 12. The holder cannot be routed while holding. |
| **Invasion** (pp. 52–53) | Three landing zones; the attacker's whole force arrives by drop, infantry taking D3 SP on landing; two waves; the defender keeps a third on the table and rolls the rest on. Battlefield Insertion switched off for both sides. |
| **Demolish** (p. 54) | A destructible objective within 4" of centre, drawn as a concrete blockhouse and mast so it is obvious what has to come down. Any attacking infantry may Demolish it — Sappers at +4, everyone else at +2. The SAM system fires Basic FP 12 at any aircraft finishing within 12". |
| **Hostile takeover** (p. 55) | A prepared position: up to ten wall sections, none over 6", and a bunker, all within 12" of the objective. Defender deploys inside 12"; attacker comes in two parts, the second from turn 3. |

**Attacker and defender** are rolled for in the three scenarios that have them, and
*The Best Defence is Good Offence* lets a designated defender take the attack instead on a 2+ —
and correctly does nothing when both companies hold the doctrine.

**Army-list doctrines** are in for both sides: *Air Superiority* (one more aircraft, one more
machine), *Non-conventional Army* (the Battle Tier minimum halved, rounding up), *Strength in
Numbers* (one unit a Tier below free of composition points and off that Tier's ceiling, per
Priority Level). `checkArmy` takes a doctrine list.

## The AI

It walks toward whatever the scenario makes valuable: the objectives, the unchecked search
locations in Find and secure, and the enemy itself in Meeting engagement, where previously it
walked to the left-hand table edge because there were no objectives to head for.

## Verification

| Harness | What it covers |
|---|---|
| `scenrules.js` | 55 checks — holding, routing, the search odds over 4,000 runs, the roll that ends a game measured turn by turn, attacker/defender distribution, and what each scenario puts on the table |
| `scentest.js` | 51 checks — all six played to a decision by two AIs through the real interface |
| `camp.js` / `camphooks.js` / `solo.js` | 157 / 44 / 58 — the campaign rules, the honour and trauma hooks, the rival archetypes |
| `campflow.js` | a campaign founded, fought, settled and reloaded through the interface |
| existing | 420 legality checks, 600 rolled armies, 59 special rules, 32 terrain, 60 fps |

## Interpretations worth knowing

- The book has most scenarios entering the whole force "from your table edge in the Reserve
  phase of turn 1", which is the same as deploying in a strip on that edge, and that is how it
  is presented. The scenarios with a genuine deployment area — the defenders in Demolish,
  Hostile takeover and Invasion — get one.
- *Non-conventional Army* halves the minimum **rounding up**, so three becomes two. The book
  does not say which way, and says "rounding up" explicitly elsewhere when it means it.
- Terrain modification is done for the defender rather than placed by hand.

## Still not built

- Multi-battle contracts under one Battle Tier roll.
- *Rapid Relocation* (O3), and *Semper Fidelis* and *Bloodlust*, which need the reserve and
  action-legality layers rather than a combat hook.
- The solitaire and cooperative scenarios, with their *Eliminate* and *Protect* conditions.

## An erratum in `PMC_2670_Rules_Guide.md`

The guide's Battle Honours list is wrong from number 15 down. The book (p. 88) reads: 15 Runners
(Move +4" on Move **and Assault**), 16 Semper Fidelis, 17 Style Bonus, 18 Superior Ballistic
Skills, 19 Surrounded but Steady, 20 To the Last Drop of Blood!. The guide has Runners as +2
Movement, then Scouts, Snipers, Thick Skin, Tunnel Rats and Veteran Medics. The game follows
the book.
