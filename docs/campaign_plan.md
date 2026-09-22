# The PMC campaign system — implementation plan

*A plan for adding the rulebook's campaign (pp. 83–91) plus the six scenarios (pp. 48–55) to the
digital Firefight game at `claude.ai/artifact/Nt6QHjxqHZCw9qU9ZkPAMd`. PMC companies only — the
Rebel, Xenotripod and Regular Army campaign variants are out of scope.*

---

## 1. What already exists, and what has to change

The game today is a **single-battle engine**. `newGame(cfg)` takes two arrays of catalogue keys,
builds fresh units from profiles, fights one Secure and Control battle on a 4′ × 4′ table, and
`finish(winner, text)` prints a card. Nothing survives the page reload.

A campaign needs four things the engine does not currently have:

| Need | Current state |
|---|---|
| **Units with a history** | `makeUnit(profile, side, i, prop, drone)` builds from the profile alone. No identity, no EXP, no honours. |
| **A battle report** | `finish()` knows the winner and nothing else. No per-unit casualties, no kill attribution, no broken-ever flag. |
| **More than one scenario** | `endPhase()` hardcodes Secure and Control's victory conditions inline. |
| **Persistence** | `localStorage` is used for exactly one boolean (`pmc-autoadv`). |

So the work splits into **engine changes** (things `rules.js` / `game.js` must learn) and a new
**campaign layer** that sits above the battle and never runs during it.

### New files

| File | Role | Testable in node? |
|---|---|---|
| `campaign.js` | Pure campaign rules: dossier shape, economy, EXP/TP, promotion, honours, traumas, upgrades, doctrines, legality. No DOM, no storage. | **Yes** — mirrors `rules.js` |
| `dossier.js` | The dossier UI (roster manager, pre-battle selection, aftermath screens) and the storage adapter. | No |
| `scenarios.js` | The six scenarios as data + hooks: terrain modification, deployment, reserves, victory check, special rules. | Partly |
| `camp.js` | Harness for `campaign.js` — the economy, EXP/TP tables, promotion legality, 1,000 simulated campaign turns. | Yes |
| `dossiertest.js` | Playwright harness: start a campaign, play three battles headless, check the dossier evolved correctly. | — |

---

## 2. The data model

One object, versioned, serialisable, small enough to hold in `localStorage` comfortably
(a mature 30-unit dossier is roughly 12 KB of JSON).

```js
Campaign = {
  v: 1,
  id, name, created, turn: 0,          // campaign turn = battles played
  mode: 'solo' | 'hotseat',
  companies: { A: Company, B: Company },
  log: [ BattleRecord, … ]             // capped at the last 40
}

Company = {
  name, motto, colour,
  tier: 1,                             // Company Tier I–V
  aspiring: false,                     // may play one Tier higher (p. 84)
  kUC: 0,
  doctrines: ['S2', 'O5', 'T1'],       // category letter + index
  doctrineSwapAt: null,                // Tier V: battle number of the next allowed swap
  roster: [ RosterUnit, … ],
  cmdRid,                              // the free starting Command Unit
  record: { battles: 0, wins: 0, draws: 0, losses: 0 }
}

RosterUnit = {
  rid,                                 // stable id, survives promotion
  key, prop, drone,                    // catalogue key + propulsion + drone flag
  name: 'Kowalski's Lads',             // player-renameable, defaults to the profile name
  exp: 0, tp: 0,
  honours: [ 8, 15 ],                  // indices into BATTLE_HONOURS
  traumas: [ 5 ],                      // indices into BATTLE_TRAUMAS
  upgrades: [ 3 ],                     // vehicles/aircraft only
  free: false,                         // true for the starting Command Unit
  restUntil: 0,                        // salvaged units skip the next battle
  lastBattle: 0,                       // for the consecutive-battle TP and for resting
  history: [ 'Bt 3 — broke a Heavy Weapons Team', … ]
}
```

`rid` is the key idea. A unit keeps its `rid` through promotion (`key` changes, `rid` does not), so
its honours, traumas and history travel with it exactly as the book says they should.

---

## 3. Storage

**Decision: `db` capability when available, `localStorage` as the offline fallback, plus JSON
export/import via `downloads`.** One `Store` module with three methods (`load`, `save`, `export`)
and a backend chosen at startup; nothing else in the campaign layer knows which is in use.

The reasoning: `db` is the only option that survives a device change and that I can read back in a
later session to help debug a campaign. But `claude.use("db")` resolves `null` for a viewer the
capability cannot serve, and a campaign that vanishes because a capability failed to load is a bad
outcome for a save file someone has put twenty battles into. So `localStorage` is always written,
and `db` is written alongside it when it resolves; on load, whichever copy has the higher `turn`
wins, and a one-line notice says which was used. Export writes `pmc-campaign-<name>.json` through
the `downloads` capability; import is a file input, so it works with no capabilities at all.

`capabilities: { db: {}, downloads: true }` on the next publish.

---

## 4. Engine changes

These are prerequisites — the campaign layer cannot be built until they land.

### 4.1 Units built from a dossier entry
`makeUnit` grows an optional fourth argument, a `RosterUnit`. When present it copies `rid`, sets
the unit's display name from the entry, and applies honours, traumas and upgrades **after** the
profile and propulsion, in that order. Application is table-driven:

- **Pure rule grants** (no new code): *Into the Shadows* → `Stealth`, *Living Legends* →
  `Inspiring Presence`, *Veteran Medics* → `Field Medics`, *Rail Gun Specialists* → `Gauss
  Weapon`, *Scouts* → `Battlefield Insertion`, *To the Last Drop of Blood!* → `Determined`.
  These already work; the honour just pushes onto `u.rules`.
- **Pure stat deltas** (no new code): *Amazing Stamina* +1 Move, *Runners* +2 Move, *Shooting
  Experts* +1 FP, *Thick Skin* +1 Def, *Rippers* +2 Assault, *Snipers* / *Superior Ballistic
  Skills* +6″ Range, *Cowards* −1 Morale.
- **Need a new engine hook** (the real work, ~12 small edits):

  | Honour / Trauma | Hook |
  |---|---|
  | Brave | ignore 1 SP from each ranged attack → in `resolveShootingHits` |
  | Overloaded Energy Shields | +4 Def when shot during an assault → `shotMods` |
  | Rain of Fire | +4 instead of +2 at half range → `shotMods` |
  | Natural Born Killers | assault Man Down! on 2–6 → `resolveAssaultHits` |
  | Nerves of Steel | immune to Suppressive Fire / Incendiary → `shoot` |
  | Style Bonus | +1 SP to the enemy per casualty → `resolveShootingHits` |
  | Iron Discipline / Surrounded but Steady | extra rally dice → `rally` |
  | Broken-minded / Panic-mongers | halve rally dice / rally on 6 → `rally` |
  | Suicidal Tendencies | hit table shifts to 1–2 ignore, 5–6 Man Down! → `resolveShootingHits` |
  | Tactical Dumbness | no terrain bonus → `coverFor` |
  | Tunnel Rats | ignores terrain movement penalties → `terrainCost` |
  | Adrenaline Rush / Last Stand | once-per-battle buttons → `specialsFor` + `chooseAction` |
  | Unreliable | D6 before any action, 1 = wasted → `chooseAction` |
  | Bloodlust | must assault the nearest enemy → action legality + AI |
  | Insubordinate | immune to Inspiring Presence and Coordinate → `rally`, `endActivation` |
  | Semper Fidelis | auto-arrive from reserve on any chosen turn → `reservePhase` |

  All ten **vehicle Upgrades** are stat deltas or rule grants (Ballistic Computer +6″ Range,
  Automated Defence Systems +4 Assault, Demolisher → Destructive Weapon, etc.) and need no hooks
  beyond the salvage modifier on *Advanced Emergency Systems*.

### 4.2 A battle report
`finish()` returns rather than only displaying. It assembles, per unit:

```js
{ rid, side, key, tier, startSize, endSize, destroyed, fledField, brokenEver,
  kills: [ { tier, broken: bool } ] }
```

Three small bits of bookkeeping make this possible:

- `u.brokenEver` set whenever `R.status(u)` first reads `'broken'`.
- **Kill attribution.** `resolveShot`, `doAssault`, `doStrafe`, `applyDamage` and `destroyTerrain`'s
  eviction path already know the attacker. They record `t.killedBy = a.rid` when the target dies,
  and `t.brokeBy = a.rid` the first time the target crosses into broken. The report walks the
  units once at the end and hands each kill to its owner. This is the only genuinely fiddly part,
  because a unit that flees after being broken by one attacker and shot by another must credit the
  **breaker**, which is what the book's wording ("breaking or destroying") implies.
- `state.routed[side]` set in `endPhase` when half a side's units are gone, so the TP for "the army
  was routed" is distinguishable from a mere loss.

### 4.3 Scenarios
`endPhase()`'s victory block moves into `scenarios.js` as a per-scenario `check(state)` returning
`'A' | 'B' | null | undefined` (undefined = play on). Each scenario is:

```js
{ id, name, blurb, page,
  terrain(state, gen),      // place objectives / landing zones / the demolition target
  deploy(state),            // zones, split into waves, who enters when
  reserves(state, turn),    // per-turn arrival rolls
  check(state),             // victory conditions, run every End phase
  length(state),            // fixed turns or the roll-to-end rule
  rules }                   // scenario special rules, e.g. the Demolish SAM system
```

Six scenarios, in build order (easiest first, so each lands playable):

1. **Meeting engagement** (p. 50) — rout only, everyone enters turn 1. *Almost free: it is the
   current engine minus the objectives.*
2. **Secure and control** (p. 51) — already implemented; just move it into the table, and add the
   missing "same two objectives for three consecutive End phases" condition, which the game does
   not currently check.
3. **Hostile takeover** (p. 55) — one central objective, 20 turns, defender deploys within 12″ and
   may place up to ten wall/trench sections and one bunker. Needs a *defender terrain placement*
   step, which is new but simple (auto-placed for the AI).
4. **Demolish** (p. 54) — an objective that must be destroyed by the Demolish action. The
   destructible-terrain work already shipped does most of this. New: the corner-based table edge
   assignment, non-Sappers demolishing at +2 instead of +4, and the SAM system (any aircraft ending
   within 12″ eats an automatic Basic FP 12 attack).
5. **Find and secure** (p. 52) — three candidate locations and a new **"Check the area!"** action
   (D6, 5+ / 4+ / auto). Needs a new action slot and a small piece of hidden state. Also the
   "the objective holder cannot be routed while they hold it" exception.
6. **Invasion** (pp. 52–53) — the heaviest. Attacker/defender asymmetry, three landing zones
   nominated after the defender deploys, two waves, landing infantry take D3 SP, Battlefield
   Insertion disabled for both sides, staggered reinforcement rolls.

Scenario selection in a campaign is the book's D6 roll (or D3 at Tier I–II / PL1), with the
*On Our Terms…* and *The Best Defence is Good Offence* doctrines applied at that point.

---

## 5. The five areas the campaign layer covers

### 5.1 Roster manager — starting force and doctrines
A new **Dossier** screen, reachable from the muster screen, replacing the army builder when a
campaign is active.

- **Founding a company.** Name, colour, then a guided build of the starting Tier I company: 6 Tier
  I units, 2 Tier II units, max 2 vehicles, plus a free Tier I Field command that is added
  automatically and marked `free`. Live validation against the same `checkArmy` the builder
  already uses, at Tier I.
- **The doctrine picker.** All 18, grouped Strategic / Operational / Tactical, each with its rule
  text and a note on whether it affects the pre-battle screen, the battle, or the payout. One
  chosen at founding, one more at each promotion; max two per category; Tier V may swap one every
  five battles.
- **The roster list.** Every unit as a card: name (editable), profile, Tier, EXP, TP as a bar
  toward the next trauma, honours, traumas, upgrades, resting status, and its history. Sortable,
  and a disband button that is disabled whenever disbanding would make the company illegal.
- **Company panel.** Tier, kUC, doctrines, record, the promotion button with its cost and its
  "can you field a legal army at every Tier up to the new one" check spelled out, and the Aspiring
  Company toggle (offered only when the company *could* field one Tier higher).

### 5.2 Pre-battle force selection
A **Contract** screen between the dossier and the board:

1. Agree the battle: Priority Level (default 1), or the *standard contract* shortcut (Tier III
   PL2) when both companies can field it.
2. Randomise the Battle Tier: D6, capped at the weakest Company Tier (+1 if that company is
   Aspiring). *On Our Terms…* offers ±1 here.
3. Randomise the scenario: D6, or D3 at Tier I–II / PL1 if the player takes that option.
4. Compose the force from the roster, not the catalogue: the existing composition-point counter
   and legality checks, but the picker lists roster units with their EXP/honours, greys out resting
   units, and enforces the vehicle/aircraft caps. Doctrines that change composition
   (*Air Superiority*, *Non-conventional Army*, *Reinforced Light Support*, *Strength in Numbers*)
   apply here.
5. Modify the armies: the book's "swap up to ¼ of your units for others of the same Unit Tier"
   step, doubled to ½ by *Tactical Flexibility*. In solo play this is a genuine decision point
   because the rival's list is revealed only in outline.

Then `newGame` is called with dossier-backed entries rather than bare keys.

### 5.3 Trauma and experience tracked during the battle
Nothing is shown to the player mid-battle that would not be shown normally — the tracking is the
battle report of §4.2, accumulated as the battle runs. Two visible touches:

- Campaign units carry their **dossier name** on the board and in the log, so the log reads
  *"Kowalski's Lads break the Heavy Weapons Team"* rather than *"Rifle Section 2"*. This is what
  makes a campaign feel like a campaign.
- A small **⭑ n** chip on the unit card showing EXP earned so far this battle, and a bruise chip
  for TP, both live. They are read-only; nothing is committed until the aftermath.

### 5.4 Scenarios and victory conditions
Covered in §4.3. The campaign layer's part is only the rolling and the doctrine modifiers.

### 5.5 Post-battle management
An **Aftermath** flow, one screen per step, each with its dice shown the way the game already shows
dice in resolution cards:

1. **Payment** (p. 84). Roll `BattleTier × PriorityLevel` D6, twice. Winner takes the higher total,
   loser the lower, a draw gives both the lower. *Tough Negotiators* offers a re-roll of up to half
   the dice, rounded up, after both rolls — second result stands even if worse. *PR Masters* counts
   a draw as a victory here.
2. **Losses** (p. 85). Casualties in surviving units are replaced free. A unit wiped out to the
   last model is removed from the dossier — with a confirmation, because this is permanent.
3. **Salvage** (p. 86). Per destroyed machine: ground vehicles 3+ won/drawn, 5+ lost, and an
   automatic loss on a Catastrophic Explosion; drones the same; aircraft always 4+, with the troops
   aboard surviving but taking 5 TP. *Advanced Emergency Systems* makes an aircraft 2+. A salvaged
   unit sits out the next battle (`restUntil`).
4. **Experience** (p. 85). +1 for taking part, +1 vs a higher Company Tier, +1 for a win, +1 per
   enemy of the same Tier broken or destroyed, +2 per enemy of a higher Tier. Shown as a per-unit
   ledger so the player can see where each point came from.
5. **Trauma** (p. 85). +2 broken at least once, +1 for losing up to half the unit, +4 for losing
   more than half, +1 for a lost battle, +1 if the army was routed, +1 for a second or subsequent
   consecutive battle. Units that sat out remove D3+1 TP instead. Any unit crossing 10 TP (15 with
   *Mental Training*) rolls a D10 on the Battle Traumas table, re-rolling duplicates, and 10 TP come
   off. Ten traumas disbands the unit.
6. **Spending.** One screen, freely reorderable:
   - **Promotion** — `3 × new Tier` EXP plus half the new unit's kUC cost, rounded up. The picker
     shows only legal targets: same unit group, same Tier or one higher. Group membership comes
     from a new `group` field on each catalogue profile (Rifle Infantry, Engineers, Light Support…),
     with the book's exceptions wired in (Recruits → four groups; Enforcers → Heavy Infantry;
     Irregulars → Assault/Light Support/Recon; Heavy Support one-way; Unclassified cannot promote).
     The unit keeps its `rid`, honours, traumas and history.
   - **Battle Honours** — 10 EXP (5 for an infantry unit's first with *Rapid Training Methods*).
     Draw three not-yet-held honours, choose one at random from those three, cap at Tier + 1. The
     three-then-one ritual is worth animating; it is the campaign's best moment.
   - **Vehicle Upgrades** — 10 EXP, cap Tier + 1, no duplicates. Vehicles cannot promote or take
     honours, and take no TP.
   - **Recruitment** — 1 / 4 / 8 / 16 / 32 kUC by Tier, up to two Tiers above the Company Tier.
   - **Company promotion** — 1 / 20 / 80 / 200 kUC, gated on fielding a legal army at the new Tier
     and every Tier below it (and, for Tier IV, on being able to field a Tier III PL2 list). A new
     doctrine is chosen immediately.
7. **Rival aftermath** (solo only) — the AI company runs the same aftermath with a simple spending
   policy: promote the unit closest to affording it, then recruit to fill the cheapest gap in
   its legality at the next Tier, then bank. Shown as a short summary so the rival visibly grows.

---

## 6. The opponent

The book's campaign assumes two evolving PMCs, and several rules reference the opponent's Company
Tier directly (the EXP bonus for fighting up, the Battle Tier cap, the payment roll). So the
campaign holds **two companies** in both modes:

- **Solo** — the rival is a full dossier run by the AI, founded at Tier I alongside yours and
  developed by the policy above. Every rule that mentions the opponent's Company Tier works
  unmodified, and the rival gains a personality over a dozen battles.
- **Hotseat** — both dossiers are the players', with a handover screen between the two pre-battle
  selections so neither sees the other's list.

---

## 7. Build order

Each phase ends with something playable, and with a harness green before the next begins.

| Phase | Work | Verified by |
|---|---|---|
| **1** | `campaign.js`: data model, economy, EXP/TP tables, promotion legality, honour/trauma/upgrade tables, doctrine table. No UI. | `camp.js` — the tables against the book, plus 1,000 simulated campaign turns checking no company goes illegal, negative or infinitely rich |
| **2** | Engine: `makeUnit` from a dossier entry, the honour/trauma hooks, kill attribution, the battle report. | Extend `specialrules.js`; a new report harness asserting kills credit the right unit across shooting, assault, strafing and vehicle kills |
| **3** | Storage + the roster manager and founding flow. Playable as a dossier you can build and look at. | `dossiertest.js` — found, save, reload, check byte-identical |
| **4** | Pre-battle selection and the aftermath flow, on the existing Secure and Control scenario only. **A complete playable campaign.** | Three headless battles; assert EXP, TP, kUC and roster changes match hand-computed values |
| **5** | Scenarios 1–3 (Meeting engagement, Secure and control, Hostile takeover) + scenario randomisation. | `scenariotest.js` — each played to a decision headless |
| **6** | Scenarios 4–6 (Demolish, Find and secure, Invasion). | same |
| **7** | Doctrines that need battle-time hooks (*Combat Drugs*, *Courage Under Fire*, *Firepower on the Move!*, *Improved HTH Training*, *NOT ONE STEP BACKWARDS!*, *Zero-in*, *Rapid Relocation*). | new checks in `specialrules.js` |
| **8** | The rival AI's development policy; solo polish; the rules sheet rewritten for the campaign. | a 20-battle simulated campaign, checking both companies stay legal and roughly track each other |

Phases 1–4 are the substance. A campaign is genuinely usable at the end of phase 4; everything
after that is breadth.

---

## 8. Known deviations and open points

- **Cooperative and solitaire play** (pp. 56+, the *Eliminate* and *Protect* victory conditions) is
  out of scope. The campaign chapter references it; the plan covers competitive battles only.
- **Contracts** — the book lets players agree a chain of battles under one Battle Tier roll. Phase
  4 treats every campaign turn as one battle; multi-battle contracts are a later addition that
  needs only a `contract` field carrying the rolled Tier forward.
- **Drop pods** use composition points but cost nothing and cannot be salvaged — a special case in
  both recruitment and salvage.
- **Penal troops** are free to recruit and promote (EXP only, no kUC), cannot take honours, and
  promote only to other Basic troops.
- **The free Command Unit** never earns EXP or TP, always equals the Company Tier, and is promoted
  free with the company. Additional Command Units must be of lower Tier — a check the army builder
  does not currently make.
- **Unit groups** do not exist in the catalogue today. Adding a `group` field to all 76 profiles is
  a prerequisite for promotion and is part of phase 1; it needs a pass against the army lists to
  get the boundaries right (the book's groups are implied by the list headings, not stated as a
  table).
