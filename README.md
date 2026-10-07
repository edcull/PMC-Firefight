# PMC 2670 — Firefight

A browser-based digital skirmish of **PMC 2670**, the sci-fi miniatures wargame by
Marcin Gerkowicz (Assault Publishing). It plays the book's rules on a 4′ × 4′
isometric table, with movement, range and line of sight measured in real inches,
edge to edge. All four armies (PMC, Rebels, Space Bugs, Xenotripods), the six
scenarios, solitaire and co-op, and the campaign are in.

## Running it

- **Play:** open `index.html` in any modern browser. No server, build or install
  is needed. GitHub Pages serves the same page.
- **One file:** `npm run build` writes `build/firefight.html`, the whole game in a
  single self-contained page.
- **Online against someone else (not finished):** `node server.js`, then open
  http://localhost:8787 and choose **Multiplayer**. See [SERVER.md](SERVER.md).

Games are saved in the browser (a battle in progress, forces and campaigns). A
campaign can also be exported to a file and read back.

## User guide

### Starting a game

The main menu offers:

| | |
|---|---|
| **Single player** | A skirmish against the AI, solitaire (your commando against the OpFor), or a campaign |
| **Hotseat** | Two players on one screen: a skirmish, co-op against the OpFor, or a campaign |
| **Multiplayer** | Two players online (needs the server; not finished yet) |
| **Unit viewer** | Every profile in all four armies, walking and firing |

A skirmish opens on **the battlefield**: pick the Battle Tier, Priority Level,
scenario and world, then tap each force's card to muster it. Mustering spends
composition points, with the book's limits checked as you go. A force can be
named, saved, and saved to or loaded from a file (`.pmcforce.json`).

### Setting up

- **Terrain** is rolled from the book's generators, or laid by hand: tap to place
  a piece, and turn it with **Turn it**, <kbd>R</kbd> or a right-click.
- **Modifying the armies:** once the table is known, each side may swap units,
  in secret in a hotseat game.
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

### The campaign

Found a force (company, revolt, swarm or tribe), then take contracts on the hub.
Each contract fixes the scenario, the Battle Tier and the pay. Choose who fights,
play the battle, and read the aftermath: pay, experience, trauma, casualties by
name, promotions and upgrades. The other forces on the world fight their own
battles between yours.

### The unit viewer

Open `viewer.html`, or **Unit viewer** from the menu. Browse with the arrow keys
or a swipe. <kbd>F</kbd> fires, <kbd>W</kbd> walks, <kbd>I</kbd> inserts,
<kbd>S</kbd> steps through the unit's states, <kbd>A</kbd> through its abilities,
<kbd>D</kbd> toggles a drone crew and <kbd>P</kbd> changes its propulsion.

Signed in to the game server as an admin, the viewer has a third tab, **Weapon**:
what the unit is drawn firing (its primary and secondary styles, how many go at
once, a missile's launch, the shots' colour and how orbs reach the target). A change is seen and heard at once, kept in that browser, and **Copy
changes** gives the lines to paste into `WEAPONS` in `src/rules/data.js`. Make an
account an admin with `node server/admin.js admin <name> on`.

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
docs/         development notes (file layout, build, tests) and the hotseat and multiplayer plans
build/        what the build and the tests write (not kept in git)
```

`index.html` loads each script separately, so develop against it directly. CI
builds the published site into one minified bundle (`scripts/bundle.js`).

```
npm test              # unit tests, plain Node
npm run test:quick    # plus the quicker browser tests (Playwright + Chromium)
npm run test:all      # everything, including whole battles and campaigns
npm run build         # build/firefight.html, build/viewer.html, build/units.html
```

Test logs go to `build/test-logs/`, and screenshots to `build/shots/`. The
browser tests look for Chromium at `/opt/pw-browsers/chromium`.

The full file layout and every test are described in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Not implemented

- Online multiplayer is not fully implemented or tested yet
- Appendix 1, Close Encounters (corridors, doors, hidden movement, opportunity fire)
- Appendix 2, Other Worlds (gravity, atmosphere, anomalies); worlds only choose the terrain
- From Appendix 3: "There can be only two!" and bookkeeper rout counting
- The co-op campaign

Where the book leaves a choice open, the reading taken is noted in the code
beside the rule, with its page.

## Credits

PMC 2670 is by **Marcin Gerkowicz**, published by **Assault Publishing**. This is
an unofficial implementation of its rules: the rulebook is the authority, and
you should own it.
