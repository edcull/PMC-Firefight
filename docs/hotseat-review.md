# Hotseat: review and plan

Two players at one device: a one-off battle (Hotseat → Skirmish, or co-op) and a two-player campaign (Hotseat → Campaign). This is a review of where both stand on `main` at a214171, and a plan for finishing and testing them. Findings were read from the code and spot-checked; file references are as of that commit.

## 1. Summary

- **One-off battle: mostly there.** Seats, alternation, both players' tactics and terrain, the secret swap round, facing questions and End-phase prompts are routed to the right player (`net.js` `seatNow`). One prompt is not routed — the choice of which reserves come on — and it deadlocks three scenarios about half the time. Nothing tells the players to pass the device, and one button deploys both armies.
- **Campaign: founding and the contract work; between battles it is a one-player game.** Player 2 cannot manage their roster (recruit, promote, honours, upgrades), sees no aftermath of their own, and loses Enhanced Genetic Memory. Worse, Player 2's company is on the AI rivals list, so the AI "catch-up" spends their money and EXP for them, and every reload adds a phantom AI force.
- **Tests.** Engine rules for hotseat are well covered; the browser covers founding, the contract handover and the muster. Nothing plays a hotseat battle to the end through the browser, and nothing goes past the first campaign battle.

## 2. What works

**Battle**
- Muster for both players, with colour and name checks (`muster.js:677-694, 942-984`); the battle starts `mode: 'hotseat', secretSwaps: true` (`muster.js:1012-1022`).
- Intents are sent as the right side for: stands, tactics and Human Wave, Strong Nervous System, End phase, facing, Last Stand, deploy arranging, insertion shoves, swaps, relocation, place queue, mines, terrain areas, deployment and activations (`net.js:293-337`); the engine re-checks every intent (`engine.js:1615-1652`). Unit test `seatnow.js`.
- Both Rebel players choose a tactic in turn, the second seeing the first (`engine.js:527-557`); manual terrain areas and pre-battle pieces alternate (`terrainsetup.js:30-45`, `engine.js:690-699`).
- Secret swap round: A then B, held and applied together, "look away" modal (`swaps.js:157-322`, `arrive.js:186-188`).
- Header names whose turn it is, both sides' colours, neutral wording ("you" is never used when both sides are human, `engine.js:1050-1076`).
- Save and resume: the config, dice seed and every intent, replayed and fingerprinted (`net.js:156-273`).

**Campaign**
- Founding both forces, any faction pairing, colour/name clash refused, Player 2 picked up again after a reload (`dossier-found.js`, `dossier.js:864-938`). Test `hotseatfound.js`.
- Contract: Player 1 picks, hands over, Player 2 picks from their own roster with their own tactic and drugs; On Our Terms… and Foresighted Command for both players; standard contract (`dossier-contract.js`, `dossier.js`). Tests `hotseatpick.js`, `hotseatterms.js`, `xenocamp.js`.
- After the battle: Plunderer, Tough Negotiators and No Place for the Weak! asked of both players; `aftermath()` applies EXP, TP, traumas, salvage and pay to both companies; no AI development in hotseat (`dossier-after.js:23-71`, `camp-aftermath.js`).

## 3. Findings

Severity: **Blocker** (the game cannot go on), **High** (a player cannot do what the rules give them, or the game acts for them), **Medium** (wrong behaviour or leaks hidden information), **Low** (wording, polish).

### Battle

| ID | Sev | Finding | Where |
|---|---|---|---|
| HB-1 | Blocker | The reserve pick (`ui.reservePick`) can belong to the side without the initiative, but `seatNow` has no case for `rpick`/`rpickdone`, so they are sent as the active side and refused: the game is stuck. Find and secure (turns 3, 5…), Demolish (the attacker, turns 2…PL), Hostile takeover (the attacker from turn 3). | `net.js:293-337`, `arrivals.js:133-193`, `engine.js:1751-1769` |
| HB-2 | High | Same gap for Know Your Foe (`kyf`/`nokyf`) and Martyrdom (`martyr`/`nomartyr`), both asked of the side not acting. Only in campaign battles (doctrine-gated), which run as hotseat. | `net.js`, `arrivals.js:53-65`, `abilities.js:49-63` |
| HB-3 | High | "Auto-deploy the rest" sends `autodeploy` for both sides: one player's tap places the other's whole army. | `game.js:437-443`, `panels.js:1032, 1366` |
| HB-4 | Medium | No pass-the-device screen anywhere in a battle. After A's last secret swap, B's swap card appears at once on A's screen; the "secret" mine (campaign) is picked on the open screen. | `swaps.js:257, 311-315`, `arrive.js:283-290` |
| HB-5 | Medium | No undo in the secret swap round: a mis-tap is final. | `arrive.js:197-198`, `swaps.js:268-270` |
| HB-6 | Medium | Once nothing is left to place, the deploy card and header fall back to side A: B's loading, insertion and empty-hull warning cannot be reached. | `panels.js:998, 1045`, `view.js:584` |
| HB-7 | Low | Prompts that do not name the player asked (reserve pick, place, mine, Know Your Foe, stand, facing), and the header pill ignores reservePick/standAsk/faceAsk. | `panels.js:679-687, 1180-1205`, `arrive.js:249-253`, `view.js:554-609` |
| HB-8 | Low | Both players are asked to surrender or carry on every End phase: two extra taps a turn. | `endphase.js:127-131` |
| HB-9 | Low | Victory pill says "Victory: A", not the force's name. | `view.js:555` |
| HB-10 | Low | Either player can open and edit the other's muster list; step 1/2 intro text is stale. | `muster.js:898-932, 1034-1041` |
| HB-11 | Low | `mode: 'hotseat'` also means an online game (the server sets it), so a local-only feature (a handover screen) cannot be keyed on `mode`. | `server/table.js:163-168`, `engine.js:1929-1932` |
| HB-12 | Low | One save slot for everything; a failed write is silent; the intent log (select taps included) grows without bound; no "who's up" card on resume. | `net.js:162-245` |
| HB-13 | Medium (security) | The game-over card writes force names (typed by players; online, by the opponent) into HTML unescaped. | `panels.js:1242-1243`, `protocol.js:71-75` |

### Campaign

| ID | Sev | Finding | Where |
|---|---|---|---|
| HC-1 | Blocker | Player 2 has no roster management: every hub action works on `companies.A` (recruit, disband, rename, promote, honours, upgrades, honour draw). A Player 2 who loses units cannot replace them, and can end with no legal army — the contract deadlocks (`levelsFor` empty). | `dossier.js:642, 716-792, 1010`, `dossier-hub.js:155`, `dossier-roster.js:313` |
| HC-2 | High | Player 2's company is in `camp.rivals`, so each contract may run the AI catch-up on it: free money and recruits, EXP spent and doctrines chosen by an AI archetype ("has been fighting elsewhere"). Re-rolled on Back → Contract. | `dossier-found.js:35`, `dossier-contract.js:124-128`, `camp-rivals.js:177-228, 276-462` |
| HC-3 | High | Every load and import adds a phantom AI force (`evenWorld` counts the 2 players plus the rivals list, which holds Player 2), which then fights "elsewhere" in every aftermath. | `campaign.js:1477-1491`, `dossier.js:1109, 1194`, `camp-aftermath.js:400-417` |
| HC-4 | High | The aftermath page is Player 1's: units, ledgers, payment, healing and notes are shown for A only; Player 2 sees summary cells and no handover. | `dossier-after.js:216-249, 398-521` |
| HC-5 | High | Enhanced Genetic Memory (XS5): the rebirth offer is made for both sides but only A's is shown or answered. | `camp-aftermath.js:290-298`, `dossier-after.js:421-430`, `dossier.js:983-988` |
| HC-6 | Medium | The contract is not saved: Back → Contract re-rolls the Tier and scenario (fishing), and a reload mid-handover loses both forces' picks. | `dossier.js:156`, `dossier-contract.js:117-141` |
| HC-7 | Medium | No roles at the contract: players pick forces not knowing who attacks; The Best Defence is Good Offence is rolled silently at battle start. | `dossier-contract.js:252-255`, `engine.js:478-480`, `scenarios.js:977-983` |
| HC-8 | Medium | Campaign battles skip the secret swap round (`secretSwaps` not passed); bench swaps happen on the open screen. | `dossier-contract.js:485-506`, `swaps.js:160` |
| HC-9 | Medium | Player 2 can go back and see (and change) Player 1's list. | `dossier-contract.js:393, 437-443` |
| HC-10 | Medium | Player 2's Foresighted Command can switch the scenario after Player 1 has picked, with no return to Player 1. | `dossier-contract.js:236-244`, `dossier.js:706-714` |
| HC-11 | Medium | Two Rebel players are asked for their tactic again in the battle, overriding the contract's choice. | `engine.js:535` |
| HC-12 | Medium | Player 2's picking screen uses Player 1's trauma threshold (Mental Training). | `dossier-contract.js:88-99` |
| HC-13 | Low | Player 2's honours/traumas filter shows A's dossier; Player 2 cannot change colours after founding; records, balance, memorial, menu line and export name are A-centred; post-battle questions run by step, not by player, with no handover; Player 2's faction pick is lost on a reload between the two foundings. | `dossier.js:873-905, 1086`, `dossier-hub.js:71-87`, `dossier-after.js:23-34, 126`, `dossier-found.js:14-34` |
| HC-14 | Low | No campaign end: nothing ends it when a force can no longer field an army (makes HC-1 a soft-lock). | `dossier-hub.js` |

## 4. Test coverage

**Covered:** seat routing (`seatnow.js`, stub engine); secret swap round (`enginetest.js:732-756`, engine only); deploy order (`deployturns.js`); ready-up (`deployready.js`, `startready.js`); End-phase surrender (`endphase.js`, `turnshow.js`); one Rebel's tactic (`lowfaction.js`); muster (`skirmishsteps.js`); founding (`hotseatfound.js`); contract handover and On Our Terms… (`hotseatpick.js`, `hotseatterms.js`); a whole battle through the board hooks, in the unit harness (`clienttest.js:333-439`).

**Not covered:**
1. A hotseat battle played to the end in the browser by both seats.
2. Any prompt answered by the player who is not acting (reserve pick, Know Your Foe, Martyrdom, Strong Nervous System for B, insertion shove).
3. The secret swap round, both tactics, both players' manual terrain and deployment through the UI.
4. Save and resume in the middle of a hotseat battle (`resume.js` uses `ai`).
5. A campaign loop: contract → battle → aftermath for both → spending → next contract; Player 2's aftermath and hub.
6. Faction pairings beyond PMC–Rebel and PMC–Bugs; co-op beyond the muster.

There is no shared "play a hotseat battle" helper: the only whole-battle loop is inline in `clienttest.js`.

## 5. Plan

Each phase ends with its tests green (`npm test`, the browser set) and is merged on its own.

### Phase 1 — unblock (battle)
- HB-1, HB-2: `seatNow` cases for `rpick`/`rpickdone` (`ui.reservePick.side`), `kyf`/`nokyf` (`kyfAsk.side`), `martyr`/`nomartyr` (the asked side); a general rule — any open ask carries its `side` and `seatNow` answers as it.
- HB-3: auto-deploy sends only the placing side's request.
- HB-6: the deploy card and header follow the side being arranged, not A.
- HB-13: escape names in the game-over card.
- Tests: `seatnow.js` against a real engine for every ask; a unit test that drives a Find and secure battle to turn 3 with B holding the reserve pick; auto-deploy places one army.

### Phase 2 — unblock (campaign)
- HC-2, HC-3: Player 2 is a player, not a rival — in hotseat `rivals` stays empty (or excludes companies.B); `catchUp`, `developRival`, `evenWorld` and "elsewhere" skip players; a load repairs a saved campaign that already has Player 2 in `rivals` and drops any phantom force it added.
- HC-1: a "whose dossier" switch on the hub (Player 1 / Player 2), and every roster action, recruiting list, honour draw and upgrade works on that company.
- HC-14: when a force cannot field a legal army and cannot recruit back to one, the campaign says so and offers to end (or a rebuild grant — owner to decide).
- Tests: a unit test that loads a hotseat campaign repeatedly (no phantom, no catch-up of Player 2); browser: Player 2 recruits, promotes, takes an honour.

### Phase 3 — handover and secrecy
- A pass-the-device card ("Pass to <force name> — tap when ready"), shown only for local two-seat play (a `localSeats` flag, HB-11): between the two players' secret swaps, before a secret mine pick, on resume, between the two contract pickers, and between the two aftermaths.
- HB-5: undo in the secret swap round until the player confirms.
- HC-8: campaign battles use the secret swap round.
- HC-9: Player 2 cannot see Player 1's list (going back hands the device back to Player 1).
- HC-10: Player 2's scenario switch sends the screen back to Player 1 to re-pick (as On Our Terms… does).
- HB-7: every prompt names the player it asks; the header pill follows open asks.
- Tests: browser — a skirmish through the secret swaps with the handover cards; contract with Player 2's Foresighted switch.

### Phase 4 — campaign aftermath and contract
- HC-4, HC-5: the aftermath for each player in turn (handover between), with their own units, ledgers, payment, rebirth offer.
- HC-6: the contract (Tier, scenario, roles, both picks) is saved on the campaign and survives a reload; Back does not re-roll.
- HC-7: roles rolled at the contract, shown to both, The Best Defence asked of its holder.
- HC-11, HC-12: the contract's tactics carried into the battle; each picker's own trauma threshold.
- HC-13: per-player records, colours, filter; post-battle questions grouped by player.
- Tests: browser — a full campaign loop with both forces: found → contract → battle (auto-played) → both aftermaths → spend → second contract.

### Phase 5 — polish
- HB-8: the End-phase prompt offered to both on one card ("carry on" for both, surrender per player).
- HB-9, HB-10, HB-12: names in the victory pill; muster lists private to their player (owner to decide); save slot per mode, write failures reported, select taps not logged.

### Phase 6 — test harness and sweep
- A shared helper `test/hotseat.js`: start a hotseat battle (skirmish or campaign), go through tactics, terrain, swaps, deployment and facing as each seat, then play to the end answering every ask as the player asked — through the browser hooks, not the engine.
- A sweep: every scenario × a spread of faction pairings, played to the end, with a resume part-way; co-op hotseat to the end.
- Add the hotseat tests to the quick and slow sets in `scripts/test.js`.

## 6. Decisions (owner, settled)

1. **Handover:** a pass-the-device card at every change of player, for clarity; to be reviewed if it proves too much.
2. **Secrecy:** the company rosters and the forces picked are open to both players (so HB-10 and HC-9 are not problems). Swaps are hidden and revealed together. Anything else secret is checked case by case as the work goes.
3. **Campaign end:** when a force can no longer field a legal army (and cannot recruit back to one), the campaign ends.
4. **End-phase surrender:** one card for both players.
5. **Order:** phases 1 and 2 first.
