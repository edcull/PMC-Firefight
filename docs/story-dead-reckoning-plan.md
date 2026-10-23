# Story mode: *Dead Reckoning* (plan)

The second story. A treasure hunt across several star systems: the company is
hired to follow a dead surveyor's clues to a lost Xenotripod world, and it is not
the only company on the trail. Every rival PMC is one of the game's six
archetypes with a face and a name, each racing for the same prize for a
different patron. Somewhere at the end of the clues is a civilisation that
nobody has catalogued, and it is not as dead as the charts say.

It is built the way *Deep Contract* was (`docs/story-mode-plan.md`): a story
graph written as data, meters and flags, a fixed first half and a free second
half drawn from threads by pressure, written enemy forces scaled to the company,
story battles that are ordinary two-sided battles, and no battle ever played in
the background. Almost all of the engine carries over. This plan says what the
story is, and what it needs that *Deep Contract* did not.

This is a plan, not a spec. Section 8 lists the decisions still to make, each
with a recommendation. Every name is a placeholder.

---

## 1. What it builds on

Everything *Deep Contract* built is reused as it is:

| Need | Already there | Where |
|---|---|---|
| The story engine: nodes, meters, flags, conditions, effects, the pool, the finale, endings, epilogues, checkpoints and ironman | `PMCStory` | `src/story/story.js` |
| Battles from story data: enemy forces by meter, allies, strikes, readiness, roles, edges, variants (target, ambush), fixed maps by seed, intel levels | `PMCStoryLevers` | `src/story/levers.js` |
| The story scenarios: Strike, Convoy, Parley, Hold the Line, Breakout, Hive Heart | `scenarios-story.js` | `src/story/scenarios-story.js`, `engine/storybattle.js` |
| Voices in battle, allies answering orders, chapter conversations | `talkFor`, `allyVoice`, `conversation` | `story.js`, `storybattle.js` |
| Faces and scenes as pixel art | `PMCStoryPortraits`, `PMCStoryScenes` | `src/view/story-portraits.js`, `story-scenes.js` |
| The validator, the whole-story walk, the made-up battle reports | `validate.js`, `storywhole.js` | `src/story/validate.js`, `test/` |
| Choosing a story when one begins | The story picker on the menu | `story-screens.js` |

What the game already has for this story in particular:

| Need | Already there | Where |
|---|---|---|
| **Six themed PMCs** | The rival archetypes: *Bastion* (armour, dug in), *Elite* (few, expensive, good), *Mercenary* (whoever pays), *Special Ops* (snipers, drones, jamming), *Shock* (closes and uses knives), *Cavalry* (armour and fast drops). Each has weights by unit group, doctrines, a temper and names. | `campaign.js` `ARCHETYPES` |
| **Six Xenotripod tribes** | *Tunnellers* (Mithdu: tunnels under everything), *Architects* (Amt: rule a planet from towers), *Mimics* (Hashamer: nine million Esh-Aven copying their absent masters), *Furies* (Ghadon: fight everyone), *Fortress* (Ulvar: shields and guns), *Raiders* (Sh'kar: step out of the air behind you). Each with doctrines and weights. | `campaign.js` `XENO_ARCHETYPES` |
| The Xenotripods on the table | Limited Senses, Mental Projection, Shield Generators, teleports, turrets, Dual-mode Weapons, the X doctrines (Underground Advance, Fortify and Strike!, Low-spectrum Cloaking…) | `rules/xeno.js`, `data.js`, `engine/*` |
| Star systems, worlds and conditions | A star, four to seven planets, each a kind of world (desert, arctic, temperate, colonised, industrial, jungle, mountain, unstable) with Other Worlds conditions, and sites on each | `camp-system.js`, `rules.js` `rollWorld` |

---

## 2. The story: *Dead Reckoning*

### The setting

**The Morrow log.** Forty years ago the surveyor **Elias Morrow** flew a
one-man survey ship past the edge of the charts and came back with a hold full
of Xenotripod artefacts and a log nobody could read. He died before he could
sell it. The log turns up in the catalogue of a free-port auction house as
*Lot 47*. Morrow wrote it in his own dead reckoning: no star fixes, only
headings, times and the things he saw. Read with the **lodestones**, the
palm-sized Xenotripod relics he left at each stop, it is a route.

**The prize.** At the end of the route is a world Morrow called **the Quiet**,
the home of a Xenotripod tribe older than any on record. Its teleport network,
its shields, its cities: whoever files the first claim under the **Finder's
Charter** owns the salvage rights, and the right to sell them.

**The patron.** **Ottilie Vane**, of Vane Antiquities, buys Lot 47 and hires the
company to follow it. She pays well, and she means to own whatever is at the
end. She has her own company, *the Ninth Lance*, and she has not told the player
about it.

**The race.** Vane is not the only buyer who saw the catalogue. Every rival on
the trail is a PMC company built on one of the game's archetypes:

| Rival | Archetype | Hired by | How it races |
|---|---|---|---|
| **Coin & Kettle** | Mercenary (`swarm`) | Whoever pays this week | Shadows the others and sells what it learns. Can be bought. |
| **Wraith Section** | Special Ops (`marksmen`) | A naval intelligence office | Steals the clues instead of finding them. Always one jump behind, listening. |
| **Sable Armour Group** | Bastion (`armour`) | A mining combine | Slow. Digs in at every site it reaches and dares anyone to take it. |
| **Kestrel Air Cavalry** | Cavalry (`aircav`) | A newsfeed that wants the first pictures | Fast. First to every site, not always the best at holding it. |
| **The Red Reavers** | Shock (`shock`) | Nobody: claim jumpers | Turns up where the others have done the work. |
| **The Ninth Lance** | Elite (`elite`) | Ottilie Vane | Not a rival at first. The patron's own, waiting for the end of the trail. |

**The Xenotripods.** The tribes the company meets are the Quiet's
descendants, or its servants, or its jailers. Each chapter meets one of them,
and the story reveals them in turn:

| Tribe | Archetype | In the story |
|---|---|---|
| **The Sh'kar** | Raiders (`shkar`) | Guard the drowned beacon; the first contact. They take relics back. |
| **The Mithdu** | Tunnellers (`mithdu`) | Live under the old sites. Met by those who go down. |
| **The Hashamer Esh-Aven** | Mimics (`hashamer`) | A servant people left behind, still keeping their masters' war in their masters' absence. They can be allies. |
| **The Ulvar** | Fortress (`ulvar`) | The shieldwall around the Quiet. |
| **The Amt** | Architects (`amt`) | The Quiet itself: the towers, asleep. The finale. |

| Force | Army | Role in the story |
|---|---|---|
| The player's company | PMC | Hired to follow the log |
| The rivals | PMC (archetypes) | The race: met on the trail, a thread in the second half |
| The tribes | Xenotripods (archetypes) | The trail's guardians: a thread in the second half, a possible ally |
| The Ninth Lance | PMC (Elite) | The patron's company: met only after an extreme choice in the first half, a thread in the second |
| Ottilie Vane | none on the table | The employer: pays, steers, and keeps her own counsel |

**Enemy forces are written for each battle**, as in *Deep Contract*. A rival's
battles are written from its archetype (its unit groups, doctrines and temper),
and each rival's meter scales what it fields (section 4).

### The shape

The same shape as *Deep Contract*: eight chapters, a fixed first half that
changes how each chapter plays but not which comes next (with two one-offs
reached by extreme choices), and a free second half drawn from four threads.
What is new is **the trail**: each chapter happens at a different place, a
planet in a star system, and the company jumps between them. Each chapter's card
shows where, and a **star chart** (section 5) shows the route so far, where the
rivals are, and how many lodestones each side holds.

```mermaid
flowchart TD
  C1[1. Lot 47<br/>Vesk, a free port<br/>vs Coin & Kettle] --> C2{2. The First Lodestone}
  C2 -->|the dig| C2a[The Glass Flats<br/>desert world<br/>vs Wraith Section]
  C2 -->|the station| C2b[Station Thule<br/>arctic, Close Encounters<br/>vs scavengers]
  C2a --> C3[3. The Drowned Beacon<br/>jungle world<br/>vs the Sh'kar: first contact]
  C2b --> C3
  C3 --> C4[4. The Broker<br/>Kerrigan, industrial<br/>vs Sable Armour]
  C3 -.->|extreme: step through the Sh'kar gate| W[Into the Warren<br/>one-off vs the Mithdu]
  C3 -.->|extreme: sell a copy of the chart, or Vane's Trust −3| L[The Double-Cross<br/>one-off vs the Ninth Lance]
  W -.-> H((second half))
  L -.-> H
  C4 --> H
  H --> P[Chapters 5 to 7<br/>two threads offer a job each<br/>three picks]
  P --> F[Chapter 8: the finale<br/>at the Quiet]
  F --> E[Ending]
```

### The first half: The Chart (chapters 1 to 4)

The treasure hunt as Vane describes it: a race between companies, for a dead
world.

- **1. Lot 47.** Vesk, a free port on a colonised world. The auction, and the
  company as Vane's escort. Coin & Kettle tries to take the log in the street
  outside. A Tier I *Secure and control* or *Meeting engagement* in the port's
  market square; it teaches the story screens and cannot be lost outright (a
  defeat: the log is held, at a cost, Lead −1). Events: how to handle the
  auction (outbid in the open, let Vane bid while the company watches the room,
  or have Coin & Kettle's agent followed); what to do with the agent taken.
- **2. The First Lodestone.** Morrow's first stop could be read two ways. The
  player picks one; the rival who takes the other gets a lodestone (Lead −1,
  that rival +1):
  - **The Glass Flats** (a desert world): Morrow's dig site, half buried. *Find
    and secure* with the **relic** variant (section 5): one of the search sites
    holds the lodestone, and the battle reports who carried it off. Wraith
    Section is already there, having read the company's copy of the log.
  - **Station Thule** (an arctic world): the survey relay Morrow stopped at,
    derelict. *Critical control* in Close Encounters against a scavenger band
    (rebels: the *Pirates* archetype, `freespace`). Slower, safer, and the station's records
    give Intel +1.
- **3. The Drowned Beacon.** A jungle world, half under water: Morrow's beacon
  is a Xenotripod structure, and it is not abandoned. **First contact**: the
  Sh'kar. The choices are about how to meet them: storm the beacon (*Strike*,
  Alarm +2), watch first (the battle a Tier down, Understanding +1, Intel +1),
  or try to signal (a roll on Understanding: on a pass the Sh'kar let you take a
  rubbing of the beacon and leave; on a fail, the *ambush* variant, sprung by
  them). The lodestone here is in the beacon (the relic variant again).
- **4. The Broker.** Kerrigan, an industrial free port. The next heading is in
  the hands of Coin & Kettle's broker, who is auctioning it again, to everyone.
  Sable Armour Group has already bought the warehouse it sits in. Buy it (kUC),
  take it (*Hostile takeover* against Sable), or let Sable have it and follow
  Sable (Lead −1, Intel +2: where Sable goes next is the clue).

**The two one-offs**, each in place of chapter 4, each only after an
**extreme** choice (`extreme: true`, as in *Deep Contract*), each leaving a mark
on the second half:

| One-off | The extreme choice | The battle | What it leaves |
|---|---|---|---|
| **Into the Warren** (the tribes) | At the beacon, the Sh'kar step back into the air through a teleport turret, and it stays open behind them. **Step through after them** (flag `warren_entered`, Alarm +2). | *Clearing out* in Close Encounters, against the Mithdu, underground on a world nobody has charted | Alarm +3 (and known), Understanding +1, and **a lodestone the rivals cannot know about** (Lead +1). The tribes thread is open from chapter 5. |
| **The Double-Cross** (the patron) | **Sell a copy of the chart** to a rival at The Broker's table (flag `chart_sold`) while Vane's Trust is −1 or lower; or Vane's Trust has fallen to −3 or lower by the end of chapter 3 | Vane sends the Ninth Lance to take the log back. *Meeting engagement* or *Hostile takeover*. | Vane has cut you off (`vane_cut_off`). The patron thread is open from chapter 5. The rivals see a company without a patron, and some of them make offers. |

If both are triggered, **Into the Warren** wins, and the Double-Cross's trigger
sets `vane_suspects` instead (as *Into the Sump* and *The Relief* do).

### The second half: The Long Jump (chapters 5 to 8)

Built from **threads**, chosen as *Deep Contract*'s are: at each of three picks
the two threads under the most pressure offer their next chapter, the one passed
up applies its cost, and the finale goes to the enemy thread under the most
pressure that has had a chapter played.

| Thread | Rises with | Chapters (first release) | Finale |
|---|---|---|---|
| **The Race** (the rivals) | Low Lead, the rivals' lodestones, a rival wronged (`kestrel_burned`, `wraith_robbed`…) | *Claim Jumpers* (Kestrel reaches a site first: *Convoy* or *Meeting*), *The Wreck of the Morrow* (Morrow's ship, found and fought over with Sable: *Clearing out*), fallback *Bounty* (Wraith Section has been paid to stop you: the *ambush* variant) | **The Landing**: at the Quiet, the leading rival is dug in on the only landing field. *Hostile takeover* with the target variant (their commander). |
| **The Tribes** (hostile) | Alarm, the Warren entered, relics taken by force | *The Watchers* (the Ulvar shieldwall: *Strike* on its shield turrets), *Teleport Storm* (the Sh'kar raid the company's camp: *Invasion*, defending), fallback *Cold Sites* (the Mithdu in old ruins: *Clearing out*) | **The Spire**: into an Amt tower, Close Encounters, shield generators as chambers to burn out (*Hive Heart*'s machinery, with turrets for brood chambers). |
| **First Contact** (allies, no finale) | Understanding, relics returned, the Esh-Aven helped | *The Mimics* (the Hashamer Esh-Aven ask for help against Coin & Kettle's slavers, and fight beside you: **Xenotripod allies**), *The Speaker* (a *Parley* with an Alpha, through Mental Projection), fallback *Signal Fires* | none: it changes the finales instead, as the truce does |
| **The Patron** (Vane and the Ninth Lance) | Low Vane's Trust, `vane_suspects`, `vane_cut_off`, the Lance's strength | *The Vault* (Vane's store of relics, and what she has been selling: *Strike*), *The Escort* (Vane's relics across a contested world: *Convoy*), fallback *Debts* (Vane's creditors come for the company: *Meeting*) | **The Collector**: the Ninth Lance at the Quiet's landing. *Hostile takeover* with the target variant (the Lance's commander). |

- **First Contact has no finale**, as the truce had none. With `contact` set,
  the finales change: *The Spire* is fought against the Ulvar hardliners with
  Esh-Aven beside you, and *The Landing* and *The Collector* bring Xenotripod
  allies.
- **The override: Recall.** If **Alarm reaches 8** when the finale begins, the
  Quiet wakes: every teleport turret on the world opens at once, and the finale
  is **Recall**, a *Breakout* across the landing field while the tribes come out
  of the air, whatever else was due.
- **Picks.** Three, in the story's data, as before (`picks: 3`).

### Endings

Checked in order; the first that holds is the story's. The last has no condition.

| Ending | Roughly |
|---|---|
| **Broken Company** | The company can no longer field an army at its own Tier. |
| **Lost Signal** | Recall was the finale: the company escapes the Quiet with what it can carry, and nobody will ever find the route again. |
| **Claim Jumped** | *The Landing* was lost, or the rivals hold more lodestones than the company at the end. Another company's name is on the claim. |
| **Repossessed** | *The Collector* was lost, or Vane cut you off and the finale was lost. Vane has the Quiet, and the company has nothing. |
| **First Contact** | `contact` or `relics_returned`, the finale won, Alarm under 8. The company is the first to speak with the Amt and walks away with no salvage at all, and every newsfeed in the sector wants the story. |
| **Finder's Fee** | Stayed with Vane (no `contact`, not cut off), the finale won, Vane's Trust 2 or more. The claim is filed in Vane's name. The company is rich, and the Quiet will be stripped. |
| **Dead Reckoning** | Anything else: the company reaches the end of the log, and what it does with it decides nothing. |

Each has an epilogue, as in *Deep Contract*: the Quiet, the tribes, each rival
(who is still in business, who is not), Vane, and the units that stayed.

---

## 3. Events and choices

Everything in *Deep Contract*'s section 3 carries over: every decision is an
event with two to four options, each written as a thing to do and saying plainly
what it risks; options closed by `if` or `cost` say why; before-battle events
change the battle (levers) and after-battle events change the long term (meters
and flags); interludes have their own events and side contracts.

What is particular to a treasure hunt:

- **Lodestones.** Each chapter has one to find (the relic variant, or an event).
  The company holds some, the rivals hold the rest. Who holds them is the
  `lodestones` meter and the rivals' own (section 4). **Five** open the Quiet;
  fewer, and the finale's briefing says what is missing (a *Lost Signal* is
  likelier, the landing is harder). A lodestone can be bought, stolen, traded to
  the tribes (`relics_returned`), or lost in a defeat.
- **Rivals are people.** Each rival company has a commander with a face and a
  voice: they talk in the conversations, taunt in battle (section 5), and can be
  dealt with off the table: bought (Coin & Kettle), outbid, warned, wronged.
  How the player treats each one is a flag the rival's later chapters and its
  epilogue read.
- **The tribes can be met three ways.** Force (Alarm up, relics taken),
  watching (Intel and Understanding up, slower: Lead down), or signal (a roll on
  Understanding). The choice is offered at every Xenotripod battle, so how the
  company deals with them is built up across the story, not chosen once.
- **Time is the race.** Taking the slow road, a side contract or a detour costs
  Lead in the second half, as Hive Growth was the cost of time in *Deep
  Contract*.

**Interlude events** (one each, the first that applies): a jump with the drive
failing; Coin & Kettle offering to sell what it knows; a crewman who has started
to hear voices since the beacon (Mental Projection; Understanding); Vane asking
for a lodestone to be sent ahead (Trust); a newsfeed offering money for
pictures (Kestrel's thread); a lodestone that has started to warm.

**Side contracts** on the way, to pay for the jumps: escort work, a salvage
dispute, a bounty on Red Reavers claim jumpers, a Hashamer village asking for
help. Offered and passed up as in *Deep Contract*; in the second half each costs
Lead.

---

## 4. The long-term state

### Meters

| Meter | Start | Shown | Raised by | Lowered by | Read by |
|---|---|---|---|---|---|
| **Vane's Trust** | 1 | yes | Lodestones delivered, decisive wins, doing as asked | Questions, copies made, relics returned, Lance found out | Pay (`pay`, as HTX Standing), the Double-Cross, the patron thread's pressure, *Finder's Fee* |
| **Loyalty** | 1 | yes | Winning, rest, honouring the dead | Hard choices, abandoning people | Morale re-roll; the company's own events |
| **Intel** | 1 | yes | Records, watching, prisoners | Going in blind | The enemy dossier, as before |
| **Lead** | 0 | yes | Lodestones, beating a rival to a site, fast routes | Detours, side contracts in the second half, rivals' finds | The Race's pressure; *The Landing*'s force; *Claim Jumped* |
| **Lodestones** | 0 | yes (count) | Relics carried off, bought, given | Stolen, traded, lost | The finale's setup; endings |
| **Alarm** | 0 | once met | Force against the tribes, relics taken, the Warren | Watching, relics returned, the Speaker | The tribes' forces and readiness, the Tribes' pressure, **Recall at 8** |
| **Understanding** | 0 | once met | Watching, signals, the Esh-Aven helped, a crewman's visions | Massacre, relics taken by force | Signal rolls, First Contact's pressure, the *First Contact* ending, Xenotripod allies |
| **Rival strength** (one per thread rival) | 2 | no | Their finds, their wins | Their defeats, their lodestones lost | Their written forces (as Rebel Strength, Lantern) |

Every meter has a reader that changes something on the table, in the choices or
in the route; the validator checks it, as it does for *Deep Contract*.

### Flags

The rivals: `kettle_bought`, `kettle_burned`, `wraith_robbed`, `sable_followed`,
`kestrel_scooped`, `reavers_hunted`. The tribes: `warren_entered`,
`contact`, `relics_returned`, `speaker_met`, `eshaven_freed`. The patron:
`chart_sold`, `vane_suspects`, `vane_cut_off`, `lance_known`. The trail:
`glassflats_dug`, `thule_records`, `beacon_rubbing`, `morrow_found` (his ship).

### Enemy forces

Written per battle, as in *Deep Contract*: a core, optional units by a meter,
filler to fit the company, changes by flag. What is new:

- **A rival's force comes from its archetype.** `enemy: rival('wraith', {...})`
  writes the force from the archetype's groups (its `weights`), takes its
  doctrines and its temper, and scales by that rival's strength. So Wraith
  Section always fields snipers, drones and jamming, and Sable always armour,
  and the same rival met twice is recognisably the same company.
- **A tribe's force comes from its archetype the same way**, with the X
  doctrines on side B (`cfg.doctrines.B`), which *Deep Contract* never set.
  Alarm is the meter that scales them, Readiness their preparation.
- **Named units.** Each rival's commander's unit carries the commander's name
  (`name` on a core unit, as *Lantern Actual* did), so a rival's leader can be
  the target of a finale, and can survive one battle to come back in another
  (flags).

### Growth

The same target as *Deep Contract* (Company Tier III by the finale), the same
scaling of battles to the company, and side contracts offered to catch a company
up. Jumps cost kUC (a decision, section 8), which side contracts pay for.

---

## 5. The design

### What is new in the engine

| Need | What | Where |
|---|---|---|
| **A place for each chapter** | A chapter's `place`: `{ system, planet, kind, world, site }`. A battle in it is fought on that kind of world (`cfg.planet`) with that world's conditions (`cfg.world`), Other Worlds switched on for the battle whatever the campaign's options say. | `story.js` (the chapter's place in the view), `levers.js` `toCfg` |
| **The star chart** | A screen: the systems visited and to come (as far as the log has been read), each rival's last known position, the lodestones held. Drawn from the story's state, not from a campaign star system. | New `view/story-chart.js` |
| **The relic variant** | `variant: { relic: true }` on a *Find and secure* (or any scenario with objective tokens): one objective is the relic. A unit in contact can pick it up (as a unit takes an objective); a unit carrying it that is destroyed drops it; held, or carried off the side's own edge, at the end, it is that side's. The report says who has it (`report.story.relic: 'A' \| 'B' \| null`), and the story reads `{ relic: 'A' }`. | `scenarios.js`, `storybattle.js` (as `targetCheck`), AI goal: reuse the objective-taking goal, then the extraction goal |
| **Forces by archetype** | `enemy.archetype` on a written force: the filler drawn from the archetype's weights, its doctrines on side B, its temper. | `levers.js` `buildForce`; `campaign.js` `archetype()` |
| **Xenotripods in a story** | The leader for the Tier (an Alpha), turrets placed as the engine places them, doctrines on B, and the words for the dossier (`describeForce`: "a tribe, mostly Esh-Aven, with turrets"). | `levers.js` (`KINDS.troops`, `describeForce`), `campaign.js` `commandKey` |
| **Xenotripod allies** | Allies of the `xeno` faction on side A. Mental Projection and Limited Senses follow the units, whichever side; allied turrets are placed in side A's zone. | `storybattle.js` `storyUnits`, `xeno.js` (a check, not a change) |
| **A Xenotripod face** | `face: { tripod: true, … }`: a three-eyed head and a carapace, in the style of the bug face. Rival commanders are ordinary faces. | `story-portraits.js` |
| **Voices for the tribes** | Their lines arrive through Mental Projection: written in brackets and italics, in every head at once ("*[you are carrying something that belongs to us]*"). | Writing only: `talk` lines, as the hive's |
| **The trail's scenes** | New places for `story-scenes.js`: the auction house, the glass flats, Station Thule, the drowned beacon, the Warren, the broker's warehouse, the Ulvar shieldwall, the wreck of the Morrow, the Quiet's landing field, an Amt spire. | `story-scenes.js` |
| **More than one story** | The picker already lists stories. What needs checking: everything that reads `'deep-contract'` by name (the text, maps and talk files are keyed by story id already), the journal, the story's sounds, saves of two stories side by side. | An audit, phase 1 |

### Scenarios

Existing first, as before:

| Chapter | Scenario | Source |
|---|---|---|
| 1. Lot 47 | Secure and control, or Meeting engagement | `secure`, `meeting` |
| 2. The Glass Flats / Station Thule | Find and secure + relic; Critical control | `find` + `relic`, `ce_control` |
| 3. The Drowned Beacon | Strike, or Find and secure + relic, ambush if the signal fails | `strike`, `find`, `meeting` + `ambush` |
| 4. The Broker | Hostile takeover | `takeover` |
| Into the Warren | Clearing out (Close Encounters) | `ce_clear` |
| The Double-Cross | Meeting engagement, Hostile takeover | `meeting`, `takeover` |
| Second half | Convoy, Strike, Parley, Invasion, Clearing out, Hostile takeover + target | as listed in section 2 |
| The Spire | Hive Heart's machinery, with shield turrets for brood chambers and the Esh-Aven for waves | `hive_heart` + a variant, or a copy |
| Recall | Breakout | `breakout` |

One new story scenario is worth building, only if the relic variant on *Find and
secure* plays badly:

- **The Dig.** A site is excavated over the battle: from turn 2 a D6 at each End
  phase per search site held decides whether the relic is found there. Hold the
  ground long enough to dig, then get the relic off the table. For the Glass
  Flats and the Wreck of the Morrow.

### The story as data

Four files, as *Deep Contract* has: `src/story/dead-reckoning.js` (the graph),
`dead-reckoning-text.js` (the words), `dead-reckoning-maps.js` (each open-table
battle's own ground), `dead-reckoning-talk.js` (conversations, battle voices,
allies). New vocabulary:

- **Conditions:** `{ relic: 'A' | 'B' }` (the last battle's relic), `{ lodestones,
  gte }` (a meter already), `{ place: 'system-id' }`.
- **Effects:** `{ jump: 'system-id' }` (the company moves on: the chart updates,
  the jump's kUC cost is paid); `{ rival: 'wraith', meter: 'strength', add }`
  (a rival's own meter, written as an ordinary meter `wraith` so nothing new is
  needed in the engine); `{ lodestone: +1 | -1, to: 'wraith' }` (one changes
  hands).
- **Chapters:** `place` as above; `rival` on a Race chapter (whose it is).
- **Sides:** one per rival and per tribe, each with its archetype:
  `sides: { wraith: { faction: 'pmc', archetype: 'marksmen', name: 'Wraith Section' }, shkar: { faction: 'xeno', archetype: 'shkar', name: "The Sh'kar" }, … }`.

### Screens

Everything as in *Deep Contract*, plus:

- **The chapter card** shows the place: the system, the planet and its
  conditions ("Glass Flats, Vantor III: desert world, low gravity, dust storms").
- **The star chart** between chapters and in the journal: the route, the rivals,
  the lodestones.
- **The briefing** shows the world's conditions (they matter more here than on
  Kessler's Reach) and, at a Xenotripod battle, what the company understands of
  the tribe.

---

## 6. Testing

The same tests, run on both stories:

- **`storygraph.js`** runs the validator on every registered story, with the new
  checks: every chapter has a `place`; every archetype named exists for its
  faction; every relic battle is a scenario with objectives; the Recall override
  can be reached; First Contact has no finale.
- **`storywhole.js`** walks each story (seeded, as now), with the same targets
  (Company Tier III by the end in half the walks or more, Broken Company rare),
  and new ones: each ending reached; *Lost Signal* (Recall) under 20%; the
  company holds five lodestones by the finale in roughly 40 to 60% of walks; each
  one-off in 5 to 15%.
- **`storyrelic.js`** (new): the relic variant set up, picked up, dropped, carried
  off, and reported; one battle of it AI against AI.
- **`storyforces.js`** (new): every rival's and tribe's force built at Tiers I to
  IV from its archetype, legal, and recognisably its archetype (the same checks
  the archetype editor's notes describe: Wraith fields snipers, Sable hulls, the
  Sh'kar a teleport turret).
- **`storytalk.js`, `storyfaces.js`, `storyscenes.js`** extended to the new story.
- **A browser test**: a new *Dead Reckoning* to the end of chapter 1, the star
  chart, and one Xenotripod battle's briefing.

No test plays a battle in the story's walk; battles are made-up reports, as now.

---

## 7. Plan

### Phase 0: the story bible
The meters, flags, sides, places and every chapter in a line, as data in
`dead-reckoning.js`, with the validator and the walk passing on placeholder text.
The decisions in section 8 settled.

### Phase 1: the engine for a second story
The audit for more than one story. A chapter's `place` and forced worlds. Forces
by archetype (PMC and Xenotripod), doctrines on side B, the Xenotripod dossier
words and leader. `storyforces.js`.

### Phase 2: the relic variant
`variant: { relic: true }`, the report, the condition, the AI's goal.
`storyrelic.js`. The Dig only if the relic variant plays badly.

### Phase 3: the first half as a vertical slice
Chapters 1 to 4 and both one-offs written in full (text, maps, conversations,
battle voices), playable end to end. Stop and play it, as with *Deep Contract*'s
phase 4.

### Phase 4: the star chart, faces and scenes
`story-chart.js`; the Xenotripod face and the rival commanders' faces; the
trail's scenes; the place on the chapter card and the briefing.

### Phase 5: the second half and the endings
The four threads, the finales, Recall, Xenotripod allies, the endings and their
epilogues, the side contracts. `storywhole.js` tuned to its targets.

### Phase 6: polish
Sounds for the Xenotripod battles (Mental Projection lines, the beacon), the
README's Story mode section, difficulty checked against both stories.

---

## 8. Decisions to make

| Decision | Options | Recommendation |
|---|---|---|
| **Rivals: written forces or real companies?** | (a) Each rival battle's force is written, scaled by the rival's meter, as *Deep Contract*'s enemies are. (b) Each rival is a real campaign company (`camp-rivals.js`) with a roster that grows and keeps its losses. | **(a)**. It keeps *no battle in the background* and the tests' made-up reports simple. A rival's commander and one veteran unit can still be named and carry wounds through flags, which gives most of (b)'s feel. |
| **How many rivals in the second half?** | All five, or three that the first half has made matter | **Three per playthrough**: the two the first half met most, plus Kestrel (who always gets there first). The Race thread's chapters are written so any rival can take them, with that rival's archetype. |
| **Do jumps cost money?** | Free; a flat kUC per jump; a cost by distance | **A flat 1 kUC per jump**, waived by Vane while her Trust is 1 or more. It makes side contracts matter once she is gone, and costs no new screen. |
| **How many lodestones open the Quiet?** | A fixed number, or the finale playable with any number | **Five, but never a dead end**: with fewer the finale is fought anyway, harder, and *Lost Signal* and *Claim Jumped* are likelier. |
| **The Xenotripods' voice** | Silent; bracketed Mental Projection; translated speech after *The Speaker* | **Bracketed until *The Speaker*, then words.** Understanding is what the player is building. |
| **Can the Xenotripods be the player's allies?** | No; in First Contact chapters only; in the finales too | **In First Contact chapters and, with `contact`, the finales.** It is the payoff of the peaceful path, and allies already work. |
| **Story length** | 8 chapters as *Deep Contract*; 10 | **8 first**, `picks: 3`, as before; the walk decides whether to raise it. |
