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
