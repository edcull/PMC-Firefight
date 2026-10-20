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

October 2026, 1280 battles: **59.5%** with covered approaches (below), against 57.65%
before them on the same seeds. Before that, 640 battles: 57.5% (chosen behaviour, fire on the hurt). By faction
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
| deploys by choice: cover, a view for shooters, forward for assault troops | 58.7% (640): no change in losses or damage either |
| cover from a player's tracked campaign (baseline re-run 57.4%): deploys and enters from its edge in cover near its own units | 56.0% (640) |
| ...cover weighed more in where it moves | 52.7% (640) |
| ...keeps within 6" of its nearest friend instead of clear of every friend within 4" | 54.9% (640) |
| ...all three | 54.6% (640): in cover 42% of the time (from 26%), nearest friend 6.0" (from 8.8"), more shots, fewer units lost, and still fewer wins — Find and secure 40% |

Read off the logs (`aistats.js`, `aistats-report.js`; each run one line of JSON, the
report adds runs up and sets the two sides side by side): the choosing side's edge is activity — no turns
spent holding without a shot, 20% more shots, a quarter more Suppression — while the
quality of each shot is the table's (1.9 hits, about half hitting nothing, a fifth
within half range). Units move about 5 times a battle in some 32 activations: most
fight from where they were deployed.

The cover trial came from a player's tracked campaign (10 battles, all won): the
AI stood in cover a fifth as often as the player (5% to 24%) and twice as far from
its nearest friend (9.9" to 5.6"). Made to do the same, the AI does it, and loses
more to the table: cover within reach costs an Advance (no stationary shot) and
the pull away from the objectives costs ground. The table is not a player, though:
whether it pays against one is for the next tracked campaigns to say.

### Covered approaches (kept)

Not "stand in cover" but "get there unseen" (`engine/ai.js`, the choosing AI only):
the table as a grid of 1" cells, each with the enemy guns that can see and reach it
and the cover standing there gives. For a unit and its goal, the cost of the way
there from every cell (Dijkstra out from the goal), each step dearer by the guns
watching it (`RISK_W`); its move weighs that way, and what it costs to end the move
where it stands (`HERE_W`). Deploying and walking on from its edge, it looks over 24
legal spots and takes the one whose way forward is least watched, near its friends.
A unit minds exposure as its rules say: cover is nothing to Battle Armour or a hull
that does not walk, Stealth and armour make a gun less of a worry, and a Cloaking
System counts only guns within 12".

| Price per watching gun (`RISK_W`) | Share |
|---|---|
| 0.25 | 59.0%, 60.0% (two runs of 640; baseline 57.4%, 57.9%) — kept |
| 0.5 | 58.2% (640) |
| 1 | 55.4% (640) |
| 0.5, ending the move watched priced 2 not 0.8 | 57.8% (640) |

Against the table it loses fewer units (about 1.3 a battle to 1.7) and fires more
from where it stands; it is not in cover more often (it keeps out of sight instead).
### Bounding (dropped)

Crossing open ground together, with fire support: a unit in safe ground (risk 0.5
or less) whose move would end on watched ground (1.5 or more) waits at the edge of
cover, firing if it has a shot or closing up within the safe ground; the turn after
any unit of its side has waited, every unit at the edge crosses, and none waits
more than a turn. Measured on the seeds the covered approaches were (baseline
re-run 59.0%):

| Change | Share |
|---|---|
| wait at the edge, then cross together | 56.5% (640) |
| ...and, the side crossing, units not crossing give it covering fire (Fire! at a shot rather than move) | 55.0% (640) |
| ...watched ground from 1.0 rather than 1.5 | 54.1% (640) |

It waits in about 3-4% of activations, and the turn spent costs more than the
crossing saves: the table does not pile its fire onto the one unit out in the open,
which is what crossing together guards against, and the objectives are lost the
while. Whether a player punishes the lone runner enough to change that is for the
tracked campaigns to show.

### Keeping an objective (dropped)

An offensive unit standing on an objective walks off to another (its own counts
8" worse for being held), and offensive is the choice two times in three. Kept
there instead when no friend else holds it:

| Change | Share |
|---|---|
| the only holder stays, every scenario | 57.2% (640; baseline 59.0%) |
| ...only where holding over time wins (Secure and control, Find and secure) | 58.6% (640) |
| ...measured on Secure and control alone | 59.1% against 59.8% (640 each) |

No gain: the hold is broken by fire far more than by walking off. (The share by
scenario in a mixed run is noisy, about ±5 at 107 battles a scenario, and one change
anywhere shifts every later battle's dice: a scenario that looks better or worse
there wants a run of its own, `SCEN=secure`.)

## A player's battles against the AI

Every battle's report carries what each side did (`src/rules/battlestats.js`, the
same tally `aistats.js` reads), and a campaign keeps it on the battle's line of its
log. On the server, one campaign (or several of the same name) with all of it:

```sh
node server/admin.js export-campaign "4x"          # by name or title; writes pmc-campaign-4x-<date>.json
node scripts/balance/aistats-report.js ...         # (for comparison, the AI against itself)
```

The file has every battle with its statistics (`A` is always the player's side) and
a `summary` adding up the player's side and the computer's over every battle against
it. Battles fought before the statistics were kept are listed without them. A
player's own decisions are not logged as the computer's are: for the player's side
`activations` and `decide` read 0; the shots, moves, charges and losses are counted
alike.

### Debug tracking: where everything stood, turn by turn

A campaign raised with **Debug tracking** ticked (the new-campaign form, or the
online lobby, the host's to set; off by default) keeps each battle turn by turn
(`src/rules/battletrack.js`): the table once (its terrain and objectives), then a
look as deployed, as each turn's activations are done (before the Rally phase) and
at the end, giving every unit on the table (side, kind, position, men, Stress,
status, the ground under it and its cover) and each objective's holder. The last
ten battles of the campaign keep theirs (about 10 KB a battle); the export carries
them, and `tracks.js` sets the player's side beside the computer's:

```
node server/admin.js export-campaign "4x" 4x.json
node scripts/balance/tracks.js 4x.json             # all tracked battles against the computer
node scripts/balance/tracks.js 4x.json --battles   # ...and each on its own
```

It reads how much of each side is in cover (and on what ground), how close it
keeps to its own units and to the enemy, how near the objectives and how many it
holds a turn, how far it moves a turn and how much of it stays put, and how wide,
deep and far from the enemy it deployed.
