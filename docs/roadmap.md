# Roadmap: v0.2 and v0.3

`package.json` is already at 0.2.0. This plan names what v0.2 is (the game as
it stands), what v0.3 adds (the rulebook's remaining parts, most of them as
options a player switches on) and what v0.4 adds (Close Encounters).

Book references are to the rulebook's markdown text (line numbers) and its
pages. Code references are as of `1612ccc`.

---

## v0.2 — the README brought up to date

**Goal:** the README describes the game as it plays today, and calls it v0.2.

1. **Title and version.** "PMC 2670 — Firefight v0.2", with one paragraph on what
   v0.2 is.
2. **What's in.** Replace the opening summary with a short feature list:
   - all four armies, six standard scenarios, six solitaire scenarios;
   - single player against the AI, hotseat, and online play;
   - campaigns:
     - single player against AI rivals;
     - hotseat (two players, with or without AI forces: 0/2/4/6/8);
     - online "world" campaigns (lobby, AI slots, contracts against the AI,
       duels between players);
   - co-op against the OpFor, on one device or online;
   - accounts (sign-in, guests, email activation, password reset), "your move"
     badges and emails;
   - the unit viewer, with its admin Weapon tab.
3. **Running it.**
   - Drop "(not finished)" from online play.
   - Point to SERVER.md and deploy/pi/README.md for hosting.
4. **User guide.**
   - Update the main-menu table (Multiplayer is no longer "not finished"; add
     the online campaign and co-op).
   - Add a short section each on **online play** (lobby, rooms, joining by
     code) and on **campaign kinds**.
5. **Not implemented.** Rewrite it from the rules review, and link to this
   roadmap:
   - Appendix 1, Close Encounters;
   - Appendix 2, Other Worlds;
   - Appendix 3: "There can be only two!" and "Bad, worse, the bookkeeper";
   - co-op battles in a campaign;
   - Priority Level 3 and up, and larger tables;
   - multi-battle contracts (the book names them but never defines them);
   - the solitaire simplifications (rolled OpFor, set-up placed by the game,
     PMC militia);
   - the two open review findings, VEH-6 and BAT-5.
6. **Rules readings.** One line pointing to `docs/rules-review-57a1b3d.md` for
   what was checked and the owner's rulings on ambiguous rules.

**Size:** small, documentation only. Optionally tag `v0.2.0` on main after merging.

---

## v0.3 — the rest of the book, as options

### 0. Groundwork: a game-options object (do first)

Nothing like this exists today. `state.cfg` is ad hoc (`planet`,
`terrainSetup`, `solo`, `tactics`…), and online settings are whitelisted in
`cleanSettings` (`src/engine/protocol.js:80-118`).

- **`cfg.options`:** add it to the config: `{ onlyTwo, bookkeeper, otherWorlds,
  closeEncounters, … }`, with defaults off. Read it through one helper
  (`R.opt(state, 'onlyTwo')`).
- **Battle setup:** an **Optional rules** fold-out on the battle setup form
  (`index.html` ~230-320, `src/view/muster.js`) and in the online room terms
  (`src/net/lobby.js:445-490`); whitelisted in `cleanSettings`.
- **Campaign:** `campaign.options`, set when the campaign is created
  (`dossier-hub.js:55-72`, `dossier-found.js`, the world lobby
  `dossier-online.js:296-322`), shown read-only on the hub. Every battle built
  from the campaign copies them into `cfg.options` (`aiBattleConfig`,
  `duelBattleConfig` in `camp-world.js`, and the local contract path).
- **Saves:** an old save without `options` reads as all off.
- **Tests:** options reach the engine in skirmish, hotseat, online and campaign
  battles.

**Size:** small to medium. Every later item depends on it.

### 1. "There can be only two!" (option)

Book l.5414: an attacker may target only one of the two enemy units closest to
it.

**Exceptions:**
- vehicles may pick from the two closest vehicles, aircraft from the two
  closest aircraft, infantry from the two closest infantry units;
- indirect fire is exempt;
- so is Markerlights' Mark the target.

**Code:**
- One filter, `R.closestTwo(state, a, t)`.
- Shooting: called from `canShoot` (`shoot.js:55`), which feeds the player's
  target list, the AI's `bestTarget`, marks and input.
- Assault: from `canAssault` (`assault.js:25`), which needs `state` passed in.
- Opportunity, defensive and arrival fire: decide whether they count as
  "attacking". The book says "any other action", so defensive fire probably
  doesn't; noted in the code.
- UI: the targets left out are greyed with the reason.

**Size:** small.

### 2. "Bad, worse, the bookkeeper" (option)

Book l.5475: for the rout check, add up the Tiers of destroyed units and
compare that with half the army's composition points, instead of half the
unit count.

**Code:**
- One function, `routed()` (`scenarios.js:297-311`). Everything else calls it.
- Composition points per side need recording at the start of the battle (they
  are known at muster).
- The Objectives panel and end card show the count used.

**Size:** small.

### 3. Other Worlds (option)

Book l.5337-5409. Before the battle, roll a D10 three times: gravity,
atmosphere, anomalies. In a campaign, roll before each contract (decision 3).

| Condition | Effect |
|---|---|
| Low gravity | Infantry +6" and vehicles +8" on Move; turning costs 1" more; Advance at Basic Firepower only |
| High gravity | Infantry Defence +1; Move −1 (−2 vehicles, −4 aircraft) |
| No atmosphere | +1 on hits against infantry (a 1 still ignored); all ranges +6" |
| Toxic atmosphere | +1 on hits against infantry (a 1 still ignored) |
| Foggy atmosphere | Line of sight at most 18" |
| Foggy and toxic | Both of the above |
| High radiation | Everyone counts as Jammed; drone vehicles need 2+ to move |
| Time anomalies | After an activation, a 5+ lets the same player activate again |
| Unexplained weakness | Non-drones −1 Move, Firepower, Assault, Morale; +1 Trauma point in a campaign |

**Code:**
- **Where it's stored:** `cfg.world = { gravity, atmosphere, anomaly }`, rolled
  at battle start, or on the contract (`k.world`) in a campaign. The existing
  `planet` stays the terrain choice.
- **Where each effect goes:** each is a modifier in an existing choke point:
  - movement in `moveBonus` and turn costs;
  - Defence in `defenceAgainst`;
  - the hit tables in `resolveShootingHits`;
  - range in `shotRange`;
  - line of sight in `sightRange` and `hasLoS`;
  - jamming;
  - drone activation;
  - the activation hand-off for time anomalies (engine turn order, with
    Overwhelming numbers);
  - profile reductions;
  - campaign trauma in the aftermath.
- **Shown to the player:**
  - a "Conditions" card at set-up and in the Objectives panel;
  - the odds card and hints include the modifiers;
  - fog drawn on the table, a tinted sky, and so on (cosmetic, optional).
- **AI:** mostly free, because it reads the same rules functions. Check that
  time anomalies and the AI's turn loop work together.

**Size:** medium, mostly breadth. Each effect is small but touches a
different rule.

### 4. Priority Level 3 on a 6′×4′ table

The book (l.1136): triple the PL1 composition numbers for PL3; tables are
4′×4′ for PL1–2 and 6′×4′ for PL3–4.

**Table size** (the main work). Today one constant `BOARD = {w:48,h:48}`
(`rules.js:11`) is copied at load into module `W`/`H` in `engine.js:80`,
`game.js:6`, `solitaire.js:29` and `scenarios.js:18`. On top of that are:
- literals in `iso.js:13`, `engine.js:29` (objectives) and `scenarios.js:57`;
- solitaire grids, scaled by `W/48` at `solitaire.js:990`.

The changes:
1. Make the board per-game: `state.board = {w, h}`, read through a function.
   Replace the load-time copies.
2. Make the isometric projection and camera take the board's size.
3. Rework each scenario's deployment zones and objectives for 72×48: which
   edges are the long ones, and objectives placed by fraction of the table, not
   at fixed inches.
4. The terrain generators already take a width and height
   (`gen.generate(opts.width/height)`). Scale the piece counts by area: the
   book's terrain tables are written for 4′×4′, and the review noted that the
   larger-table counts were left out.
5. Xenotripod Detailed Terrain Knowledge moves three pieces on 6′×4′ (l.4610).

**Unlocking PL3:**
- The PL pickers and limits are `index.html:240`, `protocol.js:45`,
  `lobby.js:483`, `camp-contract.js:36-40`, `camp-world.js:594`,
  `dossier-contract.js:465` and `dossier-online.js:528`.
- Composition checks already scale with `pl`.
- Campaign pay already uses Tier × PL dice.

**Other checks:**
- AI performance: half again as many units and more terrain. Time a PL3 AI
  battle; it may need pruning in `scoreSpot`.
- Phone layout: a wider table at minimum zoom.
- Tests: a balance run at PL3, and a browser test of a PL3 skirmish.

**Size:** large. Most of the risk is in scenarios and deployment.

### 5. Solitaire options

- **Hand-placed terrain.**
  - Manual terrain already exists (`terrainsetup.js`, `cfg.terrainSetup ===
    'manual'`) and isn't blocked for solo. Check that it works there and offer
    it on the solitaire form.
  - Each scenario's `setupTerrain` hook must then skip what it would otherwise
    lay out, or the layout must be validated (for example, Evacuation's
    reinforced homes).
- **Hand-placed counters and objectives.**
  - A new set-up step after terrain: the player places the scenario's counters
    (Crush, Decapitation, Sabotage) and leaders.
  - The book's spacing rules are checked as you place (12" apart, half within
    12" of a leader, and so on).
  - "Place the rest" falls back to the current `placeCounters`.
- **Choose the OpFor.**
  - Today `SOLO.rollOpFor` (`solitaire.js:233`) rolls the pool.
  - Option: "Rolled" (default) or "Chosen". "Chosen" opens a muster for the
    OpFor, checked against the OpFor composition table
    (`solitaire.js:68-102`).
- **Evacuation militia as written.**
  - Book l.5015: "one free 'militia' unit per Priority Level… the parameters of
    a single standard unit of Tier equal to the Battle Tier".
  - Today `militiaProfile` (`solitaire.js:787-793`) always uses PMC infantry.
  - Change it to the player's own faction's standard infantry unit of that
    Tier, from the table in decision 1. It isn't an option; it's a rules fix.
- **Territorial pay.**
  - Book l.4555: the Xenotripod payment adjustment applies "including
    solitaire/coop scenarios".
  - Already implemented for campaigns (`territorial()`,
    `camp-contract.js:134-141`).
  - It can only matter once co-op or solitaire battles exist in a campaign, so
    it comes with item 6 rather than separately.

**Size:**
- terrain and OpFor choice: small;
- counters: medium;
- militia: small.

### 6. Co-op battles in multiplayer campaigns (option)

Book l.4889: "Players may agree to play cooperative games during a campaign.
Before each battle, all involved players should decide whether they want to
play a cooperative scenario. All currency and EXP points gained in such games
are halved." Book l.4854: for each additional player, the Priority Level goes
up by 1.

**Where it goes:**
- The world campaign (`camp-world.js`) has duels (`duelAsk`, `duelAccept`,
  `duel` at :665-702), built by `duelBattleConfig`.
- Add a **co-op contract** next to the duel:
  - one player offers, the other accepts;
  - the OpFor is rolled at PL+1;
  - the battle is built like `coopConfig` (`server/table.js:215-251`: `netCoop`,
    `solo.coop`, both seats on side A).
- Hotseat campaigns get the same offer on the hub.

**What it changes:**
- **Contract:**
  - Battle Tier capped by the weaker company;
  - scenario from the solitaire list;
  - each player picks their own commando from their own dossier.
- **Aftermath:**
  - pay and EXP for each player from their own units, then halved;
  - Xenotripod territorial pay applies (item 5);
  - trauma, casualties and promotions per player as now.
- **AI rivals:** may not take part.

**Option:** "Allow co-op contracts" on the campaign (item 0).

**Size:** medium to large. It mostly reuses the online co-op battle and the
duel flow, but the aftermath has to handle two companies on one side.

### 7. Close Encounters (option, with campaign support) — v0.4

Book l.5119-5336. This is close to a separate game mode inside compounds.

**A. Compound terrain.**
- New terrain kinds:
  - corridor (up to 3" wide, sections up to 12"; a unit fills its width and
    blocks LoS; no side by side);
  - room (up to 9", one section);
  - hall;
  - door (Operational, Locked or Breached; linear, blocks LoS, destructible;
    may be locked for one side only).
- A **compound generator**: rooms and halls joined by corridors and doors,
  with entry points on given edges, placed out of the enemy edge's sight.
  Hand-built compounds through the manual terrain editor.
- **Drawing:** the isometric renderer needs floors, walls and doors. This is
  the biggest visual piece.

**B. Rule changes inside a compound.**
- no +2 for shooting at units below;
- no vehicles or aircraft;
- no Indirect Fire, and mortars can't fire;
- Markerlights become Advanced Sensors (Detect: move, then reveal hidden
  units within 12").

**C. Hidden movement.**
- Units start as counters. A hidden unit:
  - moves up to 6" only;
  - can't be suppressed;
  - has no special rules.
- It is revealed on its owner's choice, or on coming into an enemy's line of
  sight (it stops there).
- When revealed, its models are placed within 4".
- Hotseat and online need the counters truly hidden from the other player.
  The per-seat snapshots (Phase 4) already hide lists, so extend them.

**D. Reaction fire** (new interrupts, the same kind of work as defensive fire):
- **Covering Fire!**: a friendly unit within 6" fires before the covered
  unit's declared action.
- **Fire at Will!**: when a hidden unit is revealed, the enemy that saw it
  shoots, and the revealed unit shoots back.
- **Opportunity Fire**: shoot at a unit crossing line of sight during its move.
  It counts as the shooter's activation.

**E. Section hazards.**
- dangerous sections, which may explode:
  - firing into one explodes it on 7+;
  - firing from inside one explodes it on a 0;
  - an explosion is FP10 inside, and FP6 within 6" and in sight;
- burning sections: block LoS, D6 4+ to burn out, FP6 at the End phase.

**F. Special equipment.** Up to 4 per PL, each used once:
- Satchel Charges
- Ballistic Barrier
- Stun Grenades
- Incendiary Grenades
- Vacuum Charges

**G. Automated defence systems.**
- A neutral control panel plus three guns. The guns shoot the nearest unit at
  the start of each Action phase.
- Control the Guns: 2+ with Hackers, 4+ without.
- Optional swap in one-off games.

**H. Scenarios.**
- Clearing out: rout the enemy, 20 turns.
- Critical control: hold 2 of 3 rooms, or all 3 after turn 5.
- Besieged: solitaire. Rescue the cut-off unit:
  - counters 1-2 nothing, 3-5 an enemy, 6 the objective;
  - the D6 timer from turn 6;
  - aggressive OpFor that uses Fire at Will!.

**I. AI.**
- Movement through corridors and doors.
- Using and respecting hidden units.
- When to take reaction fire.
- Equipment.
- The Besieged OpFor script.

**J. Skirmish and campaign.**
- **Skirmish:** the scenario picker gets a "Close Encounters" group when the
  option is on.
- **Campaign:** a campaign setting (decision 6) sets how often a contract is a
  Close Encounters battle: Off, Low (10%), Mid (50%) or All. Units that can't
  take part (vehicles, aircraft) stay home. Pay and aftermath as normal.

**Suggested internal order:**
1. A (terrain and generator, drawn plainly);
2. B and H (Clearing out first);
3. C;
4. D;
5. E and F;
6. G;
7. Besieged;
8. AI depth;
9. campaign hook.

**Size:** very large; all of it is v0.4.

---

## v0.5 (proposal) — the star system: contracts on a map

An alternative to the hub's **Contract** button and its list of offers, for
single-player campaigns: the campaign is fought across one star system. The
Contract button opens the system, with its planets on their orbits. Tap a
planet to zoom in to a map of it, with the contracts on offer pinned where they
are. Tap a pin for the job (the offer card as it is now) and take it from there.

This follows decision 3's "later idea": the planets and their conditions are
fixed for the campaign, and contracts name a planet from it.

**What stays the same.** How many contracts there are each turn, who they are
against, the scenario, Tier, Priority Levels and roles are all still
`rollOffers`. The offers are still rolled once a campaign turn and kept. Only
where each one is fought changes, and what the screen looks like.

A clickable mockup of B and C, with made-up data: `docs/mockups/star-system.html`.

### A. The system (rules: `src/rules/camp-system.js`)

- `campaign.system` is made once, when the campaign is founded, from a seed kept
  with it (so a save or an import draws the same system):
  - a name and a star (its colour and size, for the picture);
  - 5 planets (4–7, rolled), each with:
    - a name;
    - its world kind: one of the terrain generator's kinds (desert, arctic,
      temperate, colonised, industrial, jungle, mountain, unstable);
    - its conditions: gravity, atmosphere and anomaly rolled once on the Other
      Worlds table (`R.rollWorld`) and kept for good;
    - where it sits: its orbit and angle;
    - a look for the drawing, derived from the kind and the conditions (a haze
      for a toxic or foggy atmosphere, none for an airless one).
- The book's dice leave about half the planets "much like home". So that the
  system is worth looking at, at least half the planets carry one condition or
  more. The dice are rolled again for the rest until they do; this is a reading
  of the rules, and it goes in the docs as one.
- **The offers:** `rollOffers` deals each offer to a planet (spread so most
  planets have something; never all on one). It also gives the offer a site on
  that planet: a point on its map, and a place name ("Kessler Ridge", "Pumping
  Station 4"). The offer's `planet` and `world` are then the planet's, not
  rolled. A Close Encounters contract's site is a compound ("Mine 7", "Hab
  Block C").
- `cleanSystem` for a save or import, and old campaigns keep working:
  - with no `system`, the list of offers as now;
  - an older campaign can be given a system from the hub ("Chart the system").

### B. The system view (view: `src/view/dossier-system.js`)

- **Drawing:** an SVG drawn to the screen's width. The star in the middle, the
  orbits faint, each planet a disc in its kind's colours with its atmosphere as
  a haze ring. A badge shows how many contracts are on it; a planet with none
  is dimmed.
- **Tap or hover on a planet:** a card with its name, its kind, its conditions
  (the pills the offers show now, each with what it does in its tip) and its
  contracts this turn.
- **Hub:** the Contract button opens the system. A **List** link beside the
  system keeps the old offers list (also for screen readers, and for the
  tests).
- **Phone:** the system scales to the width, and the planet card sits under it,
  not over it.

### C. The planet map

- **The map:** opening a planet zooms into a map of it: a flat, made-up map in
  that kind's colours, from the planet's seed (made-up ground: ice and ravines
  on an arctic world, slag and stacks on an industrial one). The rivals'
  colours are on the pins.
- **Pins:** each contract is a pin at its site, in the rival's colours, with
  the rival's name on it.
- **A pin opens the job:** the current offer panel (`offerPanel`/`jobCard`)
  beside the map, or under it on a phone, with **Take this contract**.
- **Back:** to the system; from the system, to the hub.

### D. Settings and scope

- **New-campaign form:** "Contracts: Star system / Offer list". Recommended
  default: Star system.
- **What the conditions do:** the conditions do something only with Other
  Worlds on. Recommended: choosing the star system turns Other Worlds on for
  the campaign, with a note saying so. Otherwise the conditions would be for
  show and only the terrain would differ.
- **Single-player only to start.** Hotseat and online world campaigns could
  share a system later; their offers are rolled elsewhere (`camp-world.js`).

### E. Later, if wanted

- Each rival has a home planet, and its contracts lean towards it.
- A planet's standing moves with your wins there: more pay, fewer hostiles.
- A rare event changes a planet's conditions (a reactor leak brings high
  radiation).

### Order

1. A, with the offer list showing the planet's name and site. Unit tests: the
   same seed gives the same system, a system survives save and load, offers
   are spread over the planets, and the conditions are kept.
2. B. A browser test: open the system, tap a planet, see its contracts.
3. C. A browser test: open a planet, open a pin, take the contract, and the
   battle is fought on that planet's world.
4. D, and the docs.

**Size:** medium. Most of it is new screens. The rules change is small,
because `rollOffers` and the offer card are kept as they are.

**Decisions (owner):** the star system turns Other Worlds on for the campaign;
4–7 planets, rolled; it is the default for new single-player campaigns; and E
is in the first version, as below.

### E. Influence, standing and events (in the first version)

- **Home planets and influence.** Every planet keeps a share of influence for
  each force, from 0 to 100, with the rest unaligned.
  - Each rival gets a home planet, starting at 50–70 there, and a foothold of
    5–15 on one or two other planets.
  - Your company gets a base planet at 35, not a rival's home where that can be
    avoided.
  - A force with 50 or more on a planet holds it; otherwise the planet is
    contested.
  - A rival's contracts land on planets in proportion to its influence there,
    with a little on every planet and a lot on its home, so you mostly fight it
    on its own ground.
  - A force that leaves the campaign loses half its influence each turn. A new
    one is given the planet with the least influence on it as its home.
- **Standing** is your own influence on a planet:
  - 0–24 Unknown, 25–49 Known, 50–74 Held, 75+ Favoured;
  - a battle won there pays +1 kUC for each full 25 standing you had going in;
  - a win moves 12 points from that rival to you, and a loss moves 10 from you
    to it (a draw moves nothing);
  - the system view shows each planet's holder, and the planet card shows the
    shares as a bar.
- **Rare events.** Each new campaign turn has a one-in-six chance of an event
  on a random planet, with no more than one at a time on any planet. Each lasts
  a few turns and is shown on the system and in the hub's news:
  - Reactor breach: high radiation, 3 turns;
  - Dust storm season: foggy atmosphere, 2 turns;
  - Chemical spill or spore bloom: toxic atmosphere, 3 turns;
  - Gravitic anomaly: time anomalies, 2 turns;
  - Wasting sickness: unexplained weakness, 2 turns;
  - Uprising: the holder loses 20 influence there;
  - Bounty: wins there pay +2 kUC, 2 turns.

  An event's condition overrides the planet's own while it lasts, and a
  contract offered meanwhile carries it.

---

## Progress

| Step | State |
|---|---|
| 0 Game options | **Done.** `R.OPTIONS`, `cfg.options` (cleaned at the start of a battle), `R.opt`. Boxes on the skirmish battlefield step, the online room's terms and the new-campaign form; an online campaign's host sets them in its lobby (`lobbyOptions`). Every campaign battle (single-player contracts, world contracts and duels, battles elsewhere) takes the campaign's. Shown in the battle's briefing and on the campaign hub. |
| 1 "There can be only two!" | **Done.** `R.closestTwo`, applied in `canShoot` for Fire!, Advance and auxiliary fire and in `canAssault`; not reactions, Indirect Fire or a shot called in by a mark. |
| 2 "Bad, worse, the bookkeeper" | **Done.** `routed()` weighs each unit by its Tier. |
| 3 Solitaire options | **Done.** Evacuation's militia from the player's army (`militiaProfile`, by owner in co-op); the OpFor chosen by hand (`SOLO.checkOpFor`, the OpFor-line window on the battlefield step; the answer to the players' machines a warning, as a rolled pool can lack one); counters and Sabotage's objectives moved by hand while deploying (`cfg.solo.handPlace`, the `marker` intent, each scenario's `markers` rules, the whole-set check in `startBlock`); hand-laid terrain already worked in solitaire. Not yet for online co-op (rolled OpFor, game-placed counters there). |
| 4 Other Worlds | **Done.** `R.rollWorld`, `cfg.world` (rolled at the start, or the contract's), `R.worldOf`; unit numbers in `R.worldStats` (weakness, high gravity's Defence, no air's Range, low gravity's turning); the Move in `moveBonus`; low gravity's Basic Advance in `shotMods`; +1 against infantry (a 1 still ignored) in the hit tables; fog in `hasLoS` and the tribe's sight; radiation in `jammedNearby` and the drone link (`radioDown`, player and AI); time anomalies in `afterChain` (not in solitaire, where the players have no alternation); the campaign's roll on each offer and contract, its pills on the job card, and the weakness's Trauma point. |
| 5 PL3 on 6′×4′ | **Done.** The table goes with the battle (`cfg.board`, `R.boardFor`: 48″ across × 72″ along, the long edges the players'), set in `R.BOARD` by the engine before every intent, snapshot, load and query, so a server's battles of different sizes keep apart; every load-time copy of the size made live; the default objectives by fraction of the table; six 2′ × 2′ terrain areas (NW, NE, W, E, SW, SE); Detailed Terrain Knowledge three pieces; the isometric projection resized (`ISO.setBoard`) and the board's plates, zooms and camera redone when a battle on another table is drawn; PL3 offered in skirmish, online rooms and campaign contracts. PL4 not yet. |
| 6 Co-op contracts | **Done** for world campaigns, online and kept on one device (a hotseat campaign with AI forces): `coopAsk`/`coopAccept`/`coopPick`/`coopReady`/`coopOff` (camp-world.js), the battle as a network co-op one (both seats side A, `netCoop`; at one screen the two take turns), the report's lines carrying each unit's owner, each player's aftermath from their own units with pay and EXP halved (`C.aftermath` `halve`) and Xenotripod territorial pay; the offer beside Challenge on the other forces, the co-op contract screen, the hub's notes. Not in the older two-player hotseat campaign without AI forces (its menu is switched off). |

### v0.4 — Close Encounters

| Part | State |
|---|---|
| A Compound terrain | **Done.** `rules/compound.js`: a 3″ grid of floor cells, rooms and halls placed first and joined by corridors dug round them (straight runs preferred, old corridor reused, loops added), cut into corridor sections of up to 12″, doors on most corridor-room joins, thin walls wherever two sections touch without a way through, two entry points on each long edge (three on 6′ × 4′), none seen from the far edge. New terrain kinds `corridor`/`room`/`hall` (open floor, one section each), `bulkhead` (solid: blocks every line through it, whoever stands where), `door` and its Locked kinds (`doorlock`, `doorlockA`, `doorlockB`; barred in `terrainBars`), `breached` (what a door brought down leaves), `wallside` (floor within 0.9″ of a wall: nowhere to stand, so two units never stand side by side in a corridor). A unit in a corridor fills its width for sight (`standsInWay`). `R.walkField`: walking distance round the walls, for the AI. `R.nearestFree` for scatter. Drawn as deck plate, low blocks of plating and striped door slabs. **Hand-built compounds** ("set up the complex in agreeable way", p. 163): the battlefield step's Compound field (with a compound scenario, skirmish and solitaire alike) offers "Laid out by the game" or "Laid out by hand"; by hand, an editor (`view/compound-edit.js`) on the same 3″ grid paints cells as corridor, room or solid, sets the line between two cells open, a door or a wall, and marks rooms dangerous, and can start from a generated compound. A plan (`PMCCompound.checkPlan`/`build`/`generatedPlan`) is checked as it is drawn: every room a rectangle (a hall when over 9″ a side), an entry point on each long edge (corridor cells on the edge), no floor cut off and a way through from edge to edge; a corridor straight across from edge to edge only warns. Kept on the device, one for each table size (`pmc-compound-WxH`), and handed to the battle as `cfg.compoundPlan`; one that does not fit the table is set aside for a generated compound, and the log says so. The generator now decides its doors and dangerous rooms up front (`furnish`), and both go through the same `piecesOf`. **Online rooms:** with a Close Encounters scenario (or Besieged in a co-op room, now offered there with the option) the room's terms show the compound; the host lays it out on the same editor (`settings.compound`, cleaned by `P.cleanSettings`), the other player reads it off the terms, and the server hands it to the battle (`table.js`). **Campaigns:** a campaign fought under Close Encounters keeps one compound for each size of table (`camp.compounds`, `PMCCompound.cleanCompounds`/`planFor`), laid out from the hub's Close Encounters line; every compound battle of it on that table is fought there. Local campaigns keep it with the campaign; an online (or local hotseat+AI) world's host sets it with the `setCompound` command, and the world's battles (with an AI force, a duel, co-op) take it. |
| B Rules inside | **Done** but Detect: no vehicles or aircraft (they stay outside, `state.homeBound`); no Indirect Fire (`lobs` in shoot.js) and mortars at Basic Firepower; no plunging fire over low walls; Markerlights and Pheromone Markers become Advanced Sensors and Sixth Sense (their Detect action comes with hidden movement); no +2 from above (no hills or buildings inside). |
| H Scenarios | **Clearing out** and **Critical control** done (`SC.CE_ORDER`), offered by the Close Encounters option (skirmish and online rooms); entries from the compound's entry points, a unit with no room there coming in next turn; Critical control's three rooms nearest the middle, held only from inside, the second half from turn 2 (the book says only "held in reserve"). **Besieged** (solitaire, `SOLO.s_besieged`, offered among the solitaire scenarios with the Close Encounters option, on this device and in online co-op rooms): counters twice the OpFor's units laid out of sight of the entries (6" apart, closer on a small compound); the important unit a Command Unit's numbers of the Battle Tier with no special rules; half the commando in on turn 1 and the rest on turn 2, through the left edge's entry points. *Reading:* a counter is turned over the moment a player's unit sees it (the end of a move or an activation, and the Beginning phase), or a Detect finds it within 12" (`scen.spot`, `soloSpot` in counters.js); D6 1-2 nothing, 3-5 a unit from the pool, 6 the important unit while it is still to find, and the last counter always it; an enemy that stands up trades fire at once (Fire at Will!). The important unit belongs to the player whose unit found it. Not found, from the end of turn 6 a 6 ends it, then 5+, 4+...; found, it must be out by the end of turn 16 (*reading:* in an entry point's corridor at either long edge, `sudden`); dead, the mission fails at once. The OpFor aggressive +2 and after the important unit first (`mustTarget`). In a demo the commando's AI makes for the counters, then the important unit for the way out (`goals`, `playerTemper`). |
| C Hidden movement | **Done.** `engine/counters.js`: in Clearing out and Critical control every unit starts as a counter (`u.hidden`); a counter moves 6" at most (`moveBonus`), only Moves, Reveals or Skips, cannot shoot or be shot, cannot be Suppressed (`addSP`); walking into an enemy's sight it stops where it is first seen (`hiddenStop`, the route walked half an inch at a time) and is revealed, and Fire at Will! follows: the nearest unsuppressed enemy that can shoot it does, and it answers if still steady (both mode `react`: every modifier but Fire!'s +1, no activation; always taken); any counter an enemy sees after an activation is revealed (`revealSweep`, also counters that meet); Reveal at the start of an activation, then act as normal; Detect (Advanced Sensors, Sixth Sense): move up to Movement, then every enemy counter within 12" is revealed. *Reading:* a counter may be charged (a charge needs no sight, p. 33), which reveals it — two counters either side of a door would otherwise wait each other out. Drawn as a disc with a "?" (this screen's own faintly shown over it), "Hidden counter" in the roster and on the card; online the other side's counters are sent as a stand-in (server/hidden.js `veilCounter`); an unseen move is logged as "A counter [A]". The AI's counters move round the walls towards their goal and show themselves within charge reach of an enemy. Models placed within 4" on reveal: a squad is one token here. |
| D Reaction fire | **Done.** Covering Fire! from the covered unit's bar, at the start of its activation (`startCover`/`coverBy`/`coverAt` in counters.js): a friend within 6" and in sight, not yet activated and steady, fires first at an enemy it can see and reach, through the covered unit if need be (`through`), spending its activation; then the covered unit acts. *Reading:* the covered unit's action is chosen after the cover, not stated before it. Opportunity Fire (`oppCheck`/`oppFire`): a unit that moves into the sight of an enemy not yet activated and steady, and out of it again by the end of its move, may be shot where it first comes into sight and range — the enemy's player is asked (`oppAsk`, the `opp`/`noopp` intents, routed to that seat online; the AI always fires); the shot is that unit's activation; a mover left Suppressed or worse stops where it was caught (an Advance's shot is lost), otherwise it goes on. Player and AI moves both. The AI gives Covering Fire! before a charge (see I). |
| E Section hazards | **Done** (counters.js). Dangerous sections: *reading* — the generator makes a room or hall dangerous at 15% (fuel drums drawn in it), since the two scenarios name none and the rules would otherwise never come up. An explosion is Firepower 10 at everyone inside and 6 at anyone within 6" who sees into it, no Defence bonuses (`blast`), once a battle; a shot's D10 (now on the shot result, `roll`) of 7+ at a target inside one, or 0 by a shooter inside, sets it off (`firingHazard`, every shot including reactions). Burning sections block sight as a wood does; the Beginning phase rolls D6 4+ to put a fire out, and a fire that has burnt through one Beginning phase goes out at the next; the End phase is Firepower 6 at everyone inside; a dangerous section that catches fire explodes. |
| F Special equipment | **Done.** Chosen on the battlefield step with a compound scenario (a row of five pickers for each force the screen musters, 4 pieces a Priority Level, `cfg.kit`); otherwise the standard set (one each of Satchel, Barrier, Stun, Incendiary a Priority Level; `PMCCompound.defaultKit`). Each a special action, once, by any unsuppressed revealed unit: Satchel Charges (set, then move up to Movement; End phase D6 3+, +1 Sappers, explodes the section), Ballistic Barrier (*reading*: put across the corridor, or 6" in a room, 1" in front of the unit towards the nearest enemy by the walk, and the unit stays behind it), Stun Grenades (with an Assault: D6-1 SP to the defender, no defensive fire), Incendiary Grenades and Vacuum Charges (move up to Movement, then pick a section it is in or sees within 6": D6 2-6). The AI's use of it: see I. Online rooms and campaigns get the standard set. |
| G Automated defence | **Done** (counters.js, the Automated defence system option). A control panel (`state.adPanel`, a `console` prop) in a room off the middle, three Automatic guns (`adgun`: Tier III, FP 6, Range 18", Defence 11, Structure 3, Limited Fire Arc, Immobile) within 12" walk of it and 6" apart, on side `N`, belonging to neither player. At the start of each Action phase each gun fires (mode `react`) at the nearest unit of either side in its sight, arc and range (`autoGuns`); either side may shoot them. Control the Guns from within 1" of the panel: 2+ with Hackers, else 4+; *reading:* the guns then turn on the nearest enemy of the side holding the panel, and a gun that would face none of them but cover a friend is blown up. The AI tries for the panel when standing at it. |
| J Campaign hook | **Done.** The campaign's Close Encounters frequency (Off / Low 10% / Mid 50% / All; `options.ceFreq`, `R.CE_FREQ`) in the campaign options: a contract's battle is swapped for Clearing out or Critical control at that rate (`closeEncounter` in camp-contract.js, from `foresight`); a force picked for one leaves its machines at home (`pickForce`'s `nursed('machines')`). |
| I AI | **Done** as far as here: movement round walls and through doors (`R.walkField` scoring), counters that move round the walls and show themselves within charge reach (`aiHidden`), Opportunity Fire always taken, Stun Grenades with every charge while the side has any. Now also (`aiKit`, `aiCover` in counters.js): Vacuum Charges on a fire it or a friend stands in; Incendiary Grenades into a section with no friend in it and two of the enemy, or one in a dangerous section or one it has no shot at; a Ballistic Barrier where it stands in the open, shot at, with nothing in reach to answer; Covering Fire! from a friend within 6" before a charge that goes in without Stun Grenades, and before a move that ends in an enemy's sights (`coverMove` in ai.js); Satchel Charges planted in a section with the enemy in it and none of its own — two of them, or one in a dangerous section or one it has no shot at — and then out of it as far as its Movement takes it (`aiSatchel`, Opportunity Fire on the way as any move). The Besieged OpFor plays by the book's script (aggressive +2, the important unit first, Fire at Will!). |

## Suggested order for v0.3

| Step | Item | Why here |
|---|---|---|
| 1 | 0 Game options | everything depends on it |
| 2 | 1 Only two!, 2 Bookkeeper | small, prove the options path end to end |
| 3 | 5 Solitaire options (militia fix, terrain, OpFor choice, counters) | small, self-contained |
| 4 | 3 Other Worlds | medium, breadth not depth |
| 5 | 4 PL3 and 6′×4′ | large refactor; better done before Close Encounters adds terrain kinds |
| 6 | 6 Co-op campaign contracts (+ territorial pay) | builds on online co-op and duels |
| — | 7 Close Encounters | **v0.4** (decision 7) |

Each step is its own PR, with unit tests per rule, a browser test of the UI,
and a balance or simulation run where the AI is affected.

---

## Decisions (owner, 2026-10-12)

1. **Evacuation militia:** the player's faction's line unit of the Battle Tier.
   - PMC: Recruits at Tier I, then Rifle infantry (Rookie, Regular, Veterans,
     Rangers).
   - Rebels: Freedom Warriors (Armed civilians, Militia, Organized insurgents,
     Hardened insurgents, Revolutionary guard).
   - Bugs: Lesser Bugs (Tiny swarms, Small bugs, Attack forms, Oversized attack
     forms). At Tier V the Lesser Bugs entry is the Fire beetle, a vehicle, so
     Tier V uses Oversized attack forms.
   - Xenotripods: Epsilon troopers (`xeps1`–`xeps5`).
2. **"Only two!":** limits only the unit's own attack actions. Defensive fire,
   arrival shots and Opportunity Fire are not limited.
3. **Other Worlds in a campaign:** rolled per contract, as the book says.
   *Later idea:* generate a star system at the start of a campaign (a set of
   planets, each with fixed conditions), and have contracts name a planet from
   it.
4. **Priority Level:** unlock PL3 only, on 6′×4′. PL4 later.
5. **Co-op contracts:** in online world campaigns and in hotseat campaigns.
6. **Close Encounters in a campaign:** a campaign setting with four levels:
   - Off;
   - Low: 10% of contracts;
   - Mid: 50%;
   - All.
7. **Close Encounters moves to v0.4** as a whole. v0.3 is items 0–6.
