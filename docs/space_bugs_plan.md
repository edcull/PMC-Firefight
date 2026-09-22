# Space Bugs army — implementation plan

Status: stages 1–4 built (game v68 / Atlas v35); the campaign (stage 5) is next. Written 2026-09-21, against game v64 / Atlas v31.
Source: rulebook pp. 113–127 (army, special rules, profiles, campaign).

## 1. What the book gives us

**Composition (p. 114).** The same table shape as PMC and Rebels:

| Battle Tier | Points | I | II | III | IV | V |
|---|---|---|---|---|---|---|
| I | 6 | 3+ | 0–1 | – | – | – |
| II | 12 | 0–6 | 2+ | 0–2 | 0–1 | – |
| III | 18 | 0–4 | 0–3 | 2+ | 0–2 | 0–2 |
| IV | 24 | 0–4 | 0–3 | 0–3 | 2+ | 0–2 |
| V | 30 | 0–4 | 0–3 | 0–3 | 0–3 | 2+ |

Extra limits:
- exactly one Leader Bug unit, of Tier ≥ the Battle Tier;
- at most 3 Overgrown / Overgrown Flying bugs per PL (no limit at BT V);
- Overgrown Flying from BT III only, and only one at PL1;
- Infected humans: at most 2 per PL.

**26 profiles in seven groups:**
- Lesser: Tiny swarms I, Small II, Attack forms III, Oversized IV, Fire beetle V.
- Underground: Small III, Huge IV, Sandworm V.
- Spore: Spitter larvae I, Immature II, Spitters III, Spore throwers IV, Bio-plasma thrower V.
- Flying: Small winged III, Large winged IV, Carrier bug V (transport 4).
- Pioneer: Small pathfinders II, Pathfinders III, Lurkers IV, Shadow bug V.
- Leader: Watcher larvae I, Immature watchers II, Watchers III, Overmind bugs IV, Queen V.
- Infected humans III.

The Tier V "bugs" and the Queen are Overgrown (vehicle rules). The Carrier is an Overgrown Flying bug (aircraft rules).

**Nine new special rules (p. 116).** Some already exist in the engine: Determined, Stealth, Keen-Eyed, Battlefield insertion, Incendiary, Suppressive Fire, Anti-aircraft, Sappers (Hardened Claws), Battle Armour (Underground). New ones:

| Rule | Engine work |
|---|---|
| **Animal Behaviour** | New hit table (1–3 ignored "QUEKKK!", 4–6 = −1 model +2 SP "SPLASH!"); re-roll failed rally dice; no terrain Defence unless within 18" of an Overmind. |
| **Aggressive** | Must assault the closest enemy when possible unless within 18" of an Overmind. For AI and the player: the Assault action becomes forced; the UI greys out the other actions and explains why. |
| **Endless Tide** | End phase: unbroken unit within 18" of an unsuppressed Overmind regains D3 models up to its starting size. Remains (bodies) stay on the table. |
| **Flying Infantry** | Ignores terrain penalties, crosses impassable ground, no terrain bonuses, always Basic Firepower both ways. Assaults anything; only other Flying Infantry can assault it. Reuses parts of the aircraft code, but it is infantry with models and SP. |
| **Overgrown / Overgrown Flying** | Vehicle / aircraft rules, but may assault; +4 Assault against vehicles. The engine already has `isMachine`; this adds an assault exception. |
| **Overmind** | 18" aura: terrain Defence for Animal Behaviour units of equal or lower Tier, all their SP removed in Rally, suppresses Aggressive, enables Endless Tide. Needs an aura helper (`overmindNear(u)`) used by all of the above. |
| **Pheromone Markers** | +1 FP / Assault (cumulative to +3) for Animal Behaviour units attacking an enemy within 18" of a marker unit. Goes in `shotMods` / `assaultMods`. |
| **Psychic Wave** | Special action: move up to M, then every enemy within 12" (no LoS, not Drones) takes D6−1 SP. New action button, AI use, and an FX (expanding ring). |
| **Hardened Claws / Underground** | Aliases for Sappers and Battle Armour: two rule-name mappings. |

**Campaign (pp. 124–125):**
- Swarm Tier, and Resource Points as the currency.
- Evolutionary Pathways as doctrines: 3 groups × 6 = 18.
- Adaptations as Battle Honours (d10 table) and Genetic Flaws as Battle Traumas (d10).
- A free Leader Bug at Swarm Tier, promoted free with the Swarm. It gets no EXP or TP, and only one Leader Bug may be fielded.
- Tiny swarms are free to recruit while the army has four or fewer, and free to promote.
- Endless Tide units take a TP on first losses.

## 2. Build order — seven stages, each shippable

### Stage 1 — Data and lists (rules.js)
- Add `FACTIONS.bugs` (name "Space Bugs", money "RP", "Resource Points").
- Add the 26 profiles to `CATALOGUE` with `faction: 'bugs'`, groups as in the book, and `art` keys (stage 3).
- `checkArmy` bug limits: one Leader of Tier ≥ BT, the Overgrown caps, Overgrown Flying BT III+ and one at PL1, Infected humans 2/PL. Reuse `COMPOSITION` via a per-faction table (`COMPOSITION_BY_FACTION.bugs`).
- `rollArmy` for bugs: the Leader first, then fill.
- WEAPONS table rows for all 26:
  - spitters and spore throwers: new style `spit`, an acid glob, arced low;
  - Bio-plasma: `arcbig` plasma;
  - Fire beetle: `flame`;
  - winged: `burst` with a spine volley;
  - melee-only bugs (FP —): `none`.
- Default drives for the Overgrown: `walker`-like gait with their own legs, not a propulsion choice. Propulsion options are off for bugs.
- Tests: `bugs.js` (composition, rolls, every profile present, weapon rows).

### Stage 2 — Special rules (rules.js, game.js)
- Implement the nine rules above, each with a check in `bugs.js`, mirroring `specialrules.js`.
- Largest pieces:
  - the Animal Behaviour hit table, which branches in `resolveShootingHits` and `resolveAssaultHits`;
  - Flying Infantry movement: `reachable` ignoring terrain cost and impassable, plus shot and assault eligibility.
- Psychic Wave action: move preview, then the wave; the result card lists every unit hit.
- Forced Aggressive assault for player units, with a clear hint.
- OpFor AI: Aggressive units charge; Overmind units stay 12–18" behind the swarm; Pheromone units push forward to mark.

### Stage 3 — Art (iso.js)
New `bug` sprite family, not reusing `paintFigure`: chitinous, segmented, six legs, coloured by the army palette on the carapace so side colours still read. Kits:
- lesser bugs: scuttling, mandibles; size grows by Tier;
- underground bugs: half-buried, with a spoil ring;
- spitters: bulbous abdomen, acid sac glowing;
- winged bugs: drawn airborne with a wing blur, lifted like jump troops;
- pathfinders: slim, antennae;
- watchers and overmind: bloated head, pulsing;
- infected humans: re-use human figures, greyed, fungal growths.

Overgrown (machine renderer, `drawMachineBody` new `style.body: 'bug'`):
- Fire beetle: carapace, flame-spout jaws;
- Sandworm: segmented arc out of the ground;
- Bio-plasma thrower: glowing sac on the back;
- Shadow bug: tall, mantis-like;
- Queen: huge abdomen, crown;
- Carrier: blimp-bug with gas blisters, carrying small bugs, flying.

Also: wreck/death variants (a bug carcass, green-yellow ichor rather than fire and smoke); an Atlas section for Space Bugs (compact cards, toggles work unchanged); sounds (chitter, splash, psychic wave hum).

### Stage 4 — Game integration (game.js, muster, scenarios)
- Muster: a third force option, "Space Bugs — a swarm (pp. 113–127)".
- Opposition rolls can be a swarm.
- Forced-assault UI; the Psychic Wave button; Overmind aura shown as a faint ring when the leader is selected.
- AI tuning for swarms: waves, Endless Tide regrouping near the Overmind.
- Solitaire: bugs as OpFor or commando. `rollOpFor` gains bugs; a commando of bugs uses the same commando table.

### Stage 5 — Campaign (campaign.js, dossier.js, campflow.js)
- Swarm founding: the free Leader Bug at Swarm Tier, and one Evolutionary Pathway picked (as doctrines).
- Pathways as doctrine data, 18 entries:
  - Biochemical: Alternate Carbon Metabolism, Concentrated Acid, Strong Pheromones, Highly Irritating Venom, Bioplasma Missiles, Effective Toxin Glands;
  - Behavioural: Coordinated Hive, Mimicry, Increased Control, Fierce Attacks, Extensive Feeding, Quick Learning;
  - Phenotypic: Efficient Spawn Cycle, Enlarged Leg Muscles, Strong Nervous System, Fungi Symbiosis, Chitin Exoskeletons, Metal-covered Talons.

  Each one is wired where its rule bites. Most are stat or aura modifiers. Fungi Symbiosis and Alternate Carbon Metabolism are post-battle hooks.
- Adaptations (honours) and Genetic Flaws (traumas): d10 tables, applied through the existing `applyEntry` path. Quick Learning raises the Adaptation cap. Atavism and Genetic Instability block progress; the Overgrown are allowed.
- Economy: Resource Points; spawning = recruiting at identical costs. Tiny swarms free while ≤ 4 are owned, and free to promote.
- Leader Bugs have no EXP or TP. Only one is fielded; the player picks which in the battle roster. Extra Leaders must be of lower Tier than the Overmind organism.
- Endless Tide TP rule (first loss or first time below half).
- Rival swarms as AI campaign opponents, with 3 archetypes (e.g. "Ivenbea mantis swarm" melee-heavy, "Evatus mound swarm" tide, "Terarson hive" spore/leader) using the book's swarm write-ups.
- The campaign map / contract screens get swarm wording, which is where "kUC/IP" currently switches.
- Tests: extend `camp.js`, `camphooks.js`, `solo.js` with a swarm run of 30 turns.

### Stage 6 — Balance and polish
- Soloplay and AI-vs-AI harness runs of swarm vs PMC and swarm vs Rebels in all scenarios; watch turn times with 8-model × 10-unit swarms plus Endless Tide.
- Performance: bug sprites are cached like figures; carcass remains share the body cap.

### Stage 7 — Docs
- Rules sheet in-game (the Rules overlay) and a project doc.

## 3. Rough size
Stages 1–2 are about one working session. Stage 3 (art) is the largest, one to two sessions with iteration on your feedback. Stages 4–5 are one to two sessions. Each stage publishes on its own, so you can review art and rules as they land.

## 4. Decisions to confirm before starting
1. **Look of the bugs:** insectoid and chitinous, coloured by army colour (as planned), or natural chitin colours with only a coloured marking?
2. **Aggressive for the player:** hard-force the assault (book-literal), or allow a free choice with a warning?
3. **Infected humans:** human figures, fungal and greyed (planned), or a distinct sprite?
4. **Campaign opponents:** should PMC and Rebel campaigns also meet swarms as rivals/contracts, or only swarm-vs-others when the player is the swarm?

## Progress (game v68 / Atlas v35)

- **Stages 1–4 done and published.**
- **Rules:** all nine rules are in `rules.js`, with 51 checks in `bugs.js`. Flying Infantry cross impassable ground but cannot land on it. Psychic Wave excludes Drones only.
- **Weapons:** three new styles, each with its own effect and sound:
  - `spit`: an acid glob;
  - `spitbig`: a bio-plasma sac;
  - `spine`: chitin darts.
- **Art:**
  - `paintBug` draws 19 infantry castes, with shells in army colour.
  - Six Overgrown bugs are drawn as big sprites in `drawBigBug`; dead ones leave ichor and steam.
  - Infected humans are civilians with army-colour fungus.
- **Game:**
  - Muster offers "Space Bugs" and a rolled-swarm OpFor.
  - Aggressive is forced for the player and the AI.
  - Psychic Wave is a special action.
  - Endless Tide fires in the End phase.
  - Solitaire can field a bug OpFor, which takes a Leader first; Decapitation uses Leader Bugs.
- **Browser check:** `bugplay.js` plays AI-vs-AI swarm battles.
- **Remaining:** Stage 5 (campaign) and the Overmind aura ring.
- **Decisions confirmed:**
  - army-colour shells;
  - Aggressive forced as the book says;
  - infected drawn as civilians with army-colour fungus;
  - swarms met in campaigns.
