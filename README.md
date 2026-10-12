# PMC 2670 — Firefight · v0.2

A browser-based digital skirmish of **PMC 2670**, the sci-fi miniatures wargame by
Marcin Gerkowicz (Assault Publishing). It plays the book's rules on a 4′ × 4′
isometric table, with movement, range and line of sight measured in real inches,
edge to edge.

## What's in v0.2

- **All four armies:** PMC, Rebels, Space Bugs and Xenotripods, with their army
  rules, doctrines, tactics and every unit profile.
- **The six standard scenarios and the six solitaire scenarios.** The solitaire
  OpFor is run by the book's behaviour table.
- **Ways to play:**
  - against the AI;
  - solitaire;
  - online against another player;
  - co-op against the OpFor, online.
- **Campaigns:**
  - single player against AI rival forces;
  - online "world" campaigns: a lobby with player and AI slots, contracts
    against the AI, and duels between players.
- **Accounts on a game server:** sign-in or guest play, email activation and
  password resets, campaigns kept on the server, and "your move" badges and
  emails.
- **A force builder and a unit viewer.**

The rules were last checked against the rulebook in
[docs/rules-review-57a1b3d.md](docs/rules-review-57a1b3d.md), which also records
the readings taken where the book is ambiguous. What is still to come is in
[docs/roadmap.md](docs/roadmap.md).

## Running it

- **Play:** open `index.html` in any modern browser. No server, build or install
  is needed. GitHub Pages serves the same page. Opened this way, everything
  except online play works.
- **One file:** `npm run build` writes `build/firefight.html`, the whole game in a
  single self-contained page.
- **Online play:** `node server.js`, then open http://localhost:8787 and choose
  **Multiplayer**. See [SERVER.md](SERVER.md) for the server's settings, and
  [deploy/pi/README.md](deploy/pi/README.md) to host one, for example on a
  Raspberry Pi behind nginx.

Games are saved in the browser (a battle in progress, forces and campaigns).
Signed in to a server, campaigns are also kept in your account. A campaign can
be exported to a file and read back.

## User guide

### Starting a game

The main menu offers:

| | |
|---|---|
| **Continue** | Every game under way, on this device or on the server, to pick up |
| **Single player** | A skirmish against the AI, solitaire (your commando against the OpFor), or a campaign |
| **Multiplayer** | The online lobby (needs the game server): a skirmish, co-op or a campaign |
| **Force builder** | Build and save a skirmish force, or a campaign's starting company |
| **Unit viewer** | Every profile in all four armies, walking and firing |

Along the foot of the menu are sound, graphics (low for phones that struggle), an
AI-against-AI demo, and your account.

A skirmish opens on **the battlefield**: pick the Battle Tier, Priority Level,
scenario and world, then tap each force's card to muster it. Mustering spends
composition points, with the book's limits checked as you go. A force can be
named, saved, and saved to or loaded from a file (`.pmcforce.json`).

### Optional rules

The book's optional rules can be switched on for a battle: on the battlefield
step of a skirmish, in an online room's terms, or for a whole campaign when it
is raised (an online campaign's host sets them in its lobby). The battle's
briefing lists the ones in play.

- **"There can be only two!"** (p. 166): a unit may attack only one of the two
  enemy units nearest to it. Vehicles, aircraft and infantry are each counted
  among their own kind. Indirect fire, marking, and reactions (defensive fire,
  the arrival shot) are not bound by it.
- **"Bad, worse, the bookkeeper"** (p. 167): an army routs when the Tiers of its
  destroyed units add up to half its composition points, rather than when half
  its units are gone.
- **Other Worlds** (Appendix 2, pp. 164-165): three D10s for the planet's
  gravity, atmosphere and anomalies, rolled at the start of the battle (in a
  campaign, with each contract, and shown on the offer). Low gravity lengthens
  a Move and makes an Advance fire at Basic Firepower; high gravity shortens it
  and toughens infantry. No air adds 6" to every Range; no air or toxic air is +1
  against infantry; fog limits sight to 18". High radiation jams everyone and can
  cut a drone vehicle's link; time anomalies let a side act again on a 5+; an
  unexplained weakness takes 1 off Movement, Firepower, Assault and Morale (and
  costs a Trauma point in a campaign).

### Solitaire

Your commando against the OpFor, which the book's behaviour table runs. On the
battlefield step:

- **The OpFor** is rolled when the battle starts, as the book has it. Tap its
  line to choose it yourself instead, from its army's list and under the OpFor
  table. Roll one gives you a legal pool to start from.
- **Counters and objectives** are placed by the game. Choose to move them
  yourself, and while you deploy you can tap a counter (or a Sabotage objective)
  to pick it up, then tap where it should go. The scenario's spacing is checked
  as you go.
- **Terrain** can be laid by hand, as in a skirmish.

Evacuation's militia is a line unit of your own army, at the Battle Tier.

### Setting up

- **Terrain** is rolled from the book's generators, or laid by hand: tap to place
  a piece, and turn it with **Turn it**, <kbd>R</kbd> or a right-click.
- **Modifying the armies:** once the table is known, each side may swap units,
  in secret from the other player.
- **Deployment:** tap a unit in the order of battle, then tap inside your zone.
  **Auto-deploy** places the rest. Units with Battlefield Insertion may be held
  back to arrive later.

### Playing a turn

Tap one of your units to select it. Its actions appear in the action bar:

| Key | Action |
|---|---|
| <kbd>1</kbd> | **Move** — tap a spot to preview it, then confirm |
| <kbd>2</kbd> | **Fire!** — stand and shoot, tap a target |
| <kbd>3</kbd> | **Advance** — move, then shoot (or hold fire) |
| <kbd>4</kbd> | **Assault** — charge into close combat |
| <kbd>5</kbd> | **Auxiliary** — fire an auxiliary weapon |
| <kbd>6</kbd> | **Regroup** — roll to shed Suppression |
| <kbd>7</kbd> | **Skip** — spend the activation doing nothing |

Special rules (Designate, Hack, Teleport, Rush, Last Stand…) add their own buttons.
<kbd>Esc</kbd> cancels an aimed action.

Sides alternate activations. When everyone has acted, the **End phase** runs:
broken units flee, every suppressed unit rallies, and each player chooses to
carry on or surrender.

### Reading the table

- **Suppression bar:** 12 segments, one per SP, in bands as wide as the unit's
  current Morale: steady (green), suppressed (amber), broken (red), then black.
  Segments light as SP builds up, and fill while an attack plays.
- **A red !** means the unit is over three times its Morale: it flees at the
  Rally unless it sheds enough first.
- **Vehicle health:** the same bar, one segment per point of Structure, shown
  once the vehicle is damaged.
- **The tag** beside a unit's code (W, R, C, L, B, F, H, ~) names the terrain it
  counts as being in.
- **Combat results**, on the right, keeps a card for every roll: shots,
  assaults, rallies and initiative.
- **Objectives**, in the header, shows the scenario, who attacks, and what wins it.

### Camera

Drag or scroll to pan, pinch or <kbd>+</kbd> / <kbd>−</kbd> to zoom, <kbd>F</kbd>
or <kbd>0</kbd> to see the whole table, and the arrow keys to nudge. **Follow**
keeps the camera on the action; demos can be paused.

### Online play

**Multiplayer** opens the lobby: sign in, or play as a guest.

- **Create a game:** a skirmish, co-op or a campaign. Campaigns need an account.
- **Listing:** list the game for anyone to join, or keep it private and share
  its code. **Join** takes a game or campaign code.
- **In the room:** each player takes a seat and musters their force. The host
  sets the terms (Battle Tier, Priority Level, scenario and world). The battle
  starts when both are ready.
- **Hidden information:** each seat sees only its own lists and secret choices,
  and a watcher sees the table only.
- **Dropped connections:** if someone drops, their seat is held for them.
  Leaving a battle forfeits it.

### The campaign

Found a force (company, revolt, swarm or tribe), then take contracts on the hub.
Each contract fixes the scenario, the Battle Tier and the pay. Choose who fights,
play the battle, and read the aftermath: pay, experience, trauma, casualties by
name, promotions and upgrades. The other forces on the world fight their own
battles between yours.

There are two kinds:

| | |
|---|---|
| **Single player** | You against AI rival forces |
| **Online** | A world on the server: players and AI forces in slots, contracts against the AI, and duels between players, played at each player's own pace |

### The unit viewer

Open `viewer.html`, or **Unit viewer** from the menu. Browse with the arrow keys
or a swipe. <kbd>F</kbd> fires, <kbd>W</kbd> walks, <kbd>I</kbd> inserts,
<kbd>S</kbd> steps through the unit's states, <kbd>A</kbd> through its abilities,
<kbd>D</kbd> toggles a drone crew and <kbd>P</kbd> changes its propulsion.

Signed in to the game server as an admin, the viewer has a third tab, **Weapon**:
what the unit is drawn firing (its primary and secondary styles, how many go at
once, a missile's launch, the shots' colour and how orbs reach the target). A
change is seen and heard at once and saved to the server's database, and every
game that server serves draws it so; **Revert** puts a unit back as
`src/rules/data.js` has it. **Copy changes** gives the lines to make the changes
the table's own. Make an account an admin with `node server/admin.js admin <name> on`.

## Development

```
index.html, viewer.html   the game's and the unit viewer's pages
src/rules/    the rulebook: profiles, movement, shooting, scenarios, campaign (no drawing; runs in Node too)
src/engine/   the battle: every decision and die roll, and the AI
src/view/     the browser: renderer, board, panels, campaign screens, unit viewer
src/net/      the two transports (server socket, or the engine in the tab) and the lobby
src/css/      the stylesheets
server/       the multiplayer server (started by server.js)
scripts/      the build, the unit sheet and the test runner
test/         unit tests (Node) and browser tests (Playwright)
docs/         development notes (file layout, build, tests), the roadmap, the hotseat and multiplayer plans, and the latest rules review
build/        what the build and the tests write (not kept in git)
```

`index.html` loads each script separately, so develop against it directly. CI
builds the published site into one minified bundle (`scripts/bundle.js`).

```
npm test              # unit tests, plain Node
npm run test:browser  # the browser tests (Playwright + Chromium)
npm run test:quick    # unit tests plus the quicker browser tests
npm run test:all      # everything, including whole battles and campaigns
npm run build         # build/firefight.html, build/viewer.html, build/units.html
```

Test logs go to `build/test-logs/`, and screenshots to `build/shots/`. The
browser tests look for Chromium at `/opt/pw-browsers/chromium`.

The full file layout and every test are described in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Not implemented

Planned in [docs/roadmap.md](docs/roadmap.md):

- **Priority Level 3 on a 6′ × 4′ table (v0.3).** Battles are Priority Level 1–2
  on 4′ × 4′.
- **Co-op battles in a campaign (v0.3).** Co-op is played as a one-off battle
  for now.
- **Appendix 1, Close Encounters (v0.4):** corridors, doors, hidden movement,
  reaction fire and its scenarios.

Not planned:

- **Multi-battle contracts:** the book names them but never defines them.
- **Two open rules-review findings:**
  - VEH-6: the crew bailing out of a knocked-out vehicle is placed by the game;
  - BAT-5: scenario reserves and Battlefield Insertion arrive in two separate
    alternations.

Where the book leaves a choice open, the reading taken is noted in the code
beside the rule, with its page.

## Credits

PMC 2670 is by **Marcin Gerkowicz**, published by **Assault Publishing**. This is
an unofficial implementation of its rules: the rulebook is the authority, and
you should own it.
