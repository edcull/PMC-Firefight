# PMC 2670 — Firefight

A browser-based digital skirmish of **PMC 2670**, the sci-fi miniatures wargame by
Marcin Gerkowicz (Assault Publishing). It runs the book's rules on a 4′ × 4′ table
drawn in isometric: movement, range and line of sight are all measured in real
inches, edge to edge, the way you would with a tape.

No build step is required to play, and there are no dependencies to install.

---

## Playing it

Open **`build/firefight.html`** in any modern browser. That is the whole game in
one self-contained file — no server, no network, nothing to install. Double-click
it, or drag it onto a browser window.

### Against somebody else

```
node server.js        # then open http://localhost:8787
```

The server hands the game out and runs every networked battle itself: it rolls
the terrain, the scenario, the initiative and every die after that, and each
player's screen only draws what it is told. Press **Multiplayer**, start a game,
and read the five-letter code out to your opponent. How that is put together is
in [SERVER.md](SERVER.md).

Everything is saved in the browser's local storage, so a campaign survives a
reload. The campaign screen can also export a save to a file and read it back.

### Keeping a skirmish force

The setup screen builds a one-off force: pick a Battle Tier and a Priority
Level, then spend composition points on units, with the rulebook's limits
enforced as you go. A force built that way can be **named and saved** — the
units and their propulsions and upgrades, and also the Tier, the Level, the
faction, the rebel tactic and the colour, because a list of units without the
Tier it was legal at is not a force. Saved forces are kept in the browser and
offered from a list on the setup screen; **Save to a file** writes one out as
`.pmcforce.json` to carry to another device or hand to an opponent, and **Load
from a file** reads it back. A force built against an older army list loads
anyway: anything no longer in the list is dropped and reported rather than
breaking the muster.

## The source

The scripts are grouped by what each one is. The rulebook and the engine draw
nothing and run under Node as well as in a browser, which is what lets a server
be the authority in a networked game; the view and the net only run in a
browser.

| File | What is in it |
|---|---|
| **`src/rules/`** | **The rulebook** |
| `rules.js` | Every profile from the book, the composition table, geometry, line of sight, shooting, assault, suppression, morale, vehicles, terrain and buildings, and the special-rules list. |
| `campaign.js` | The campaign layer (pp. 83–91): companies, experience, trauma, Battle Honours, promotions, doctrines, contracts, and the rival AI's growth. |
| `scenarios.js` | The six scenarios (pp. 48–55) — objectives, deployment zones, reserves and victory conditions. |
| `solitaire.js` | Solitaire and co-op against the OpFor (pp. 146–156). |
| `gen.js` | The rulebook's terrain generators (pp. 46–48): the table is divided into 2′ × 2′ areas and a D6 rolled for each. |
| **`src/engine/`** | **The game** |
| `engine.js` | The turn structure, every action, the terrain set-up, deployment, the OpFor AI. Every decision and every die roll. It answers intents — "shoot that", "go there" — with the events that followed and the table they left. |
| `protocol.js` | The message names and legal settings, shared by the browser and the server. |
| **`src/view/`** | **The browser** |
| `game.js` | The board and the interface: the camera, animation and every panel. It turns taps into intents and draws what comes back. |
| `iso.js` | The isometric renderer — ground, terrain props, buildings and their garrisons, infantry sprites and machine hulls, all drawn as code rather than art files. |
| `fx.js` | Every battlefield effect: tracers, bolts, lobbed rounds, rail lines, flame, missiles and rockets, muzzle flashes, impacts, drop marks. The game and the unit viewer both draw out of this one file. |
| `sfx.js` | Synthesised sound. Everything is generated with the Web Audio API; there are no audio files. |
| `tips.js` | The tooltip layer: one floating panel, shared by every screen. |
| `dossier.js` | The campaign screens. |
| `viewer.js` | The unit viewer. |
| **`src/net/`** | **Playing somebody else** |
| `net.js` | The two transports: a socket to a server, or the engine running in this tab. |
| `lobby.js` | The multiplayer screen: the lobby, the room and the chat. |

`index.html` carries the markup and all the CSS, and pulls the scripts in with
`<script src>` tags. Opening `index.html` directly works too, and is the easier
way to develop — the browser reloads each file separately. The server lives in
`server/` and `server.js`; the design notes are in `docs/`.

### Building

```
npm run build
```

That inlines every script into `index.html` and writes `build/firefight.html`
(`scripts/build.js`), then draws `build/units.html` (`scripts/gallery.js`). It
takes no arguments and needs nothing but a Node runtime.

### The unit viewer

Open **`viewer.html`** for a bench that shows one unit at a time: every profile
in both lists, in each of its states, at any strength, walking at its own
Movement, coming in off a Battlefield Insertion, and firing whatever the weapon
table says it carries. It loads `rules.js`, `sfx.js`, `iso.js` and `fx.js` and
nothing else — no game — so what it draws and sounds is the real code rather than
a mock-up of it. <kbd>F</kbd> fires, <kbd>W</kbd> walks, <kbd>I</kbd> inserts.

---

## The tests

The rules are held to the book by harnesses that re-type the printed data and
check the engine against it. They are the reason a rule can be changed without
quietly breaking three others.

**Rules, campaign, engine and server** — `npm test` runs all of `test/unit/`
(plain Node, no browser):

```
test.js          # the engine end to end, plus a duel fuzzer
roster.js        # every printed profile and the composition table
vehicles.js      # armour, damage, destruction, repairs, transport
propulsion.js    # the five ground propulsions, over 600 rolled armies
specialrules.js  # the General special rules list (pp. 56–59)
terrain.js       # terrain effects, cover, and bringing pieces down
terrainrules.js  # movement penalties, hills, low walls, buildings, jump troops
shapes.js        # terrain piece shapes
weapons.js       # how each unit's weapon sounds and looks
scenrules.js     # objectives, deployment and victory conditions
camp.js          # the campaign: experience, trauma, honours, promotion
camphooks.js     # what a campaign unit carries onto the table
campextras.js    # the campaign extras
solo.js          # the solitaire rival archetypes
rebels.js        # the Rebel army list and its army rules
rebelcamp.js     # the Rebel campaign
enginetest.js    # whole battles driven by intent; the terrain set-up turn order; garrisons
clienttest.js    # the page booted without a browser, and the lobby against a real one
servertest.js    # two players on two sockets against the real server
```

**Interface** — `npm run test:browser` runs all of `test/browser/`, each of
which drives a real browser through Playwright:

```
mobile.js        # the phone shell, at three screen sizes
deployorder.js   # choosing the deployment order; insertion escapes
movepreview.js   # the move/advance preview and its confirmation
fireart.js       # the firing styles, animation and sound
viewertest.js    # the unit viewer: every weapon style, states, insertion
gait.js          # how a unit is drawn crossing the ground
stepoff.js       # troops coming off a hull
loadout.js       # putting troops aboard a hull before the battle
dropzone.js      # being asked for a landing zone, on a phone
forces.js        # building a skirmish force, saving it and loading it back
founding.js      # founding a company: its name, colours, roster and charter
markerlight.js   # Markerlights, end to end
deployzones.js   # every scenario's deployment zone
deploytap.js     # placing units by tapping
touch.js         # touch input on a phone
smoke.js         # a battle from start to finish
actions.js       # every action button in every state
insertion.js     # Battlefield Insertion
demolition.js    # bringing terrain and the Demolish objective down
terrainsetup.js  # laying the terrain by hand, area by area
bldflow.js       # going into buildings, holding them and coming out
shapeflow.js     # terrain shapes on the table
extrasflow.js    # the campaign extras, through the interface
scentest.js      # all six scenarios played out
campflow.js      # the campaign screens
rebelflow.js     # a Rebel campaign, through the interface
report.js        # a long unattended run, checking invariants
```

Screenshots the browser harnesses take go to `build/shots/`.

The browser harnesses need Playwright and a Chromium build:

```
npm install playwright
npx playwright install chromium
```

They look for Chromium at `/opt/pw-browsers/chromium`. If yours is elsewhere,
change the `executablePath` at the top of each file, or drop the option entirely
and let Playwright find its own.

Each harness prints a `✓` or `✗` per check and a tally at the end, and exits
non-zero on a failure, so they drop straight into CI.

---

## What is implemented

Everything in the core rulebook that a skirmish needs: both army lists (PMC and
Rebel) with every printed profile, the composition table and its limits, the six
scenarios, the terrain generators, the General special rules, vehicles and
aircraft with facing and arcs, the optional ground propulsions (Appendix 3), and
the campaign.

Where the book leaves something to the players, or where a tabletop convention
has no digital equivalent, the reading taken is written down — in the **Rules**
panel inside the game, under "Interpretations", and in the design notes.

## Credits

PMC 2670 is by **Marcin Gerkowicz**, published by **Assault Publishing**. This is
an unofficial digital implementation of those rules; the rulebook is the
authority, and you should own it.
