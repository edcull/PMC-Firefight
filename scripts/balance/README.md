# Balance simulation

Whole campaigns played out by the AI, to see how the personalities and factions fare
against each other. Every balance change to AI behaviour, force building or a
personality's settings has been checked this way.

## What it does

`world.js` founds one AI company of each personality — all 24 (`FACTION=all`, the
default) or one faction's six (`FACTION=pmc`, `rebel`, `bugs` or `xeno`) — and plays a
24-turn campaign. Every turn the companies pair off at random and fight full engine
battles with the AI on both sides, on a random planet and scenario, roles rolled as a
contract rolls them. The campaign aftermath (pay, casualties, experience, salvage,
traumas) and each company's own development follow every battle.

## Running it

```sh
# 32 worlds of all 24 personalities, 4 at a time (about 2 hours on 4 cores)
node scripts/balance/run.js balance/now 32 4

# the report: balance/now.pdf and balance/now.html
node scripts/balance/report.js balance/now balance/now.pdf

# after a change: run again into a new directory and compare
node scripts/balance/run.js balance/after 32 4
PREV_NOTE="After the Cavalry change." node scripts/balance/report.js balance/after balance/after.pdf balance/now
```

`run.js` skips worlds already written, so a stopped run carries on. Environment
variables, passed through to every world:

- `FACTION` — `all` (default), or one faction.
- `SCEN` — a comma list of scenarios to draw from (e.g. `secure,find`), for a sharper
  look at a change that only touches those.
- `OVERRIDE` — personality changes to try without editing the code, as JSON in the
  shape the admin Personalities screen stores, e.g.
  `OVERRIDE='{"aircav":{"battle":{"temper":0}}}'`.
- `STACK` — a file to append the stack trace of any engine error to.

## Reading the numbers

- With all 24 personalities, judge factions and personalities by their **win rate
  against the other factions**: battles inside a faction always add up to 50%.
- Noise: 32 worlds give about 9,000 battles. A faction's figure is good to about ±1–2
  points, a personality's to about ±4, any one pairing of two personalities to ±15 or
  more. Seeded battles diverge with any code change, so compare runs of the same size.
- A world records each battle (`log`), the companies' Tier each turn (`tiers`), their
  state at the end (`end`) and any engine errors (`errors`).

## What the scenarios themselves do to the attacker

Checked in October 2026 (AI against AI, the same two forces played with the roles
swapped, PMC against PMC at Tier II, 120 battles a line). In the campaign worlds the
attacker wins Demolish about 64% of the time and Hostile takeover about 30%.

| Hostile takeover, as the rules stand and with changes tried | Attacker wins |
|---|---|
| As it stands | 22% |
| The attacker going in at once | 14% |
| The attacker holding back until the push | 7% |
| No surrender (attacker or defender) | 23% |
| No fortifications for the defender | 28% |
| The attacker's whole force on in turn 1 | 33% |
| Both of the last two | 44% |

The AI's attack plan (ai.js `assaultPlan`) did better than every other plan tried; what
holds the attacker back is the scenario (p. 55): half the force on in turn 1 and the
rest from turn 3 against a defender already dug in round the centre, with the
fortifications on top. Those are the book's rules, so they stay.

## The choosing AI against the behaviour table

A side the computer runs chooses each unit's behaviour (engine/ai.js
`chooseBehaviour`) rather than rolling the solitaire table (p. 147), which only the
solitaire OpFor still rolls. `versus.js` measures the one against the other: the same
two armies, scenario and planet fought twice, the sides swapped, so the only
difference is how they decide. A battle marks its rolling side `cfg.aiRolled`.

```sh
# 30 pairs (60 battles) a run; four runs at once on different seeds for 240
for s in 11 22 33 44; do node scripts/balance/versus.js 30 $s > /tmp/v$s.json & done; wait
```

The noise is about ±3 points over 320 battles and ±2 over 640: judge an AI change
over 640 (two runs of four seeds, e.g. 11 22 33 44 and 55 66 77 88) against the last
640, and keep it only if the choosing side's share goes up by more than that.

October 2026, 640 battles: **57.5%** (chosen behaviour, fire on the hurt). By faction
the gain is nearly all bugs (~67%) and xeno (~62%); PMC and rebels are about even.
Tried and dropped, each within the noise or worse:

| Change | Share |
|---|---|
| no preference for hurt targets | 56.8% (640) |
| shots activate first, chargers last | 55.8% (320) |
| hulls roll the table, infantry choose | 57.7% (320) |
| a unit near breaking with no good shot regroups | 59.4% (640) |
| ...and fire piled onto what was already shot this turn | 53.4% (320) |
| charge at even odds rather than 1.25× | 58.5% (240) |
| never hold to shoot: always advance | 56.0% (240) |
| advance if Assault > Firepower, else hold | 57.3% (240) |
| half range weighed in where it moves (in it, and out of the enemy's) | 54.2% (640) |

Read off the logs (`aistats.js`): the choosing side's edge is activity — no turns
spent holding without a shot, 20% more shots, a quarter more Suppression — while the
quality of each shot is the table's (1.9 hits, about half hitting nothing, a fifth
within half range). Units move about 5 times a battle in some 32 activations: most
fight from where they were deployed.
