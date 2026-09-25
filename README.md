# PMC 2670 — Firefight

A browser-based digital skirmish of **PMC 2670**, the sci-fi miniatures wargame by
Marcin Gerkowicz (Assault Publishing). It runs the book's rules on a 4′ × 4′ table
drawn in isometric: movement, range and line of sight are all measured in real
inches, edge to edge, the way you would with a tape.

No build step is required to play, and there are no dependencies to install.

---

## Playing it

Open **`index.html`** in any modern browser — straight from the folder, no
server needed. Double-click it, or drag it onto a browser window. It is also
what GitHub Pages serves.

For a single self-contained file to carry around or publish, run
`npm run build` and use **`build/firefight.html`**: the whole game, every script
inlined, nothing else needed.

The game opens on a main menu — Skirmish, Campaign and, when a server served
the page, Multiplayer — over a battlefield rolled fresh every few seconds.
Skirmish covers a battle against the AI, a hotseat game on one screen,
solitaire or co-op against the OpFor, and a demo between two AI forces.

Every kind of skirmish opens on **the battlefield**: the Battle Tier and
Priority Level, the scenario, the world and the table, with a card for each
force. Tap a card to muster that force — against the AI the opposition starts
as a random kind of force with a rolled build, to keep or change. In a hotseat
game the two players then modify their armies in turn before anyone deploys,
each in secret: neither sees the other's swaps until both are done.

Every game, even a solitaire one, is played through the same engine. The screen
draws the table and sends what you asked for ("shoot that", "go there"), and
the engine decides what happens and rolls the dice. With no server it runs in
the tab. With a server it runs on the server, so neither player's browser can
decide anything.

### Against somebody else

```
node server.js        # then open http://localhost:8787
```

The server hands the game out and runs every networked battle itself: it rolls
the terrain, the scenario, the initiative and every die after that, and each
player's screen only draws what it is told. Press **Multiplayer**, start a game,
and read the five-letter code out to your opponent. How that is put together is
in [SERVER.md](SERVER.md).

Played without a server, everything is saved in the browser's local storage, so
a campaign survives a reload. The campaign screen can also export a save to a
file and read it back. A campaign played through the server is shared by both
players and stored on the server, in `campaigns/`. `PORT=9000 node server.js`
runs the server on another port.

### The table

The terrain is rolled from the book's generators, one 2′ × 2′ area at a time,
for any of the book's worlds. The barren or arctic world comes in two looks,
**desert** and **arctic**. Walls go up round the buildings as walled compounds
with a way in, and are not scattered loose. A "1–X" roll always gives at least
two pieces. Lava shimmers with heat haze. Hills can stand on hills: the upper step
blocks line of sight, and firing down from it earns the height bonus.

You can lay the terrain by hand instead. The set-up panel shows every piece still
to come for the area, drawn together. Turn a piece with **Turn it**, the
<kbd>R</kbd> key, or a right-click, then tap where it goes.

On an Invasion the attacker arrives from orbit, infantry included: every unit
drops from the sky to its landing zone.

An **Advance** is a single action. Once the unit has moved, the only choice left
is the Advance's own shot, or holding its fire. Fire! and Assault are not on offer,
and you can't leave the unit half-done to move another one.

### Keeping a skirmish force

Mustering a force spends composition points on units, with the rulebook's
limits enforced as you go. A force built that way can be **named and saved** — the
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

```
index.html           the game's page: all the markup and CSS, loading src/ script by script
viewer.html          the unit viewer's page, the same way
server.js            starts the server (see SERVER.md)

src/
  rules/             the rulebook — draws nothing, runs in Node as well as a browser
    rules.js         every profile, the composition table, geometry, line of sight, shooting,
                     assault, suppression, morale, vehicles, terrain, buildings, special rules
    campaign.js      the campaign (pp. 83–91): companies, experience, trauma, honours,
                     promotions, doctrines, contracts, and the rivals' growth
    scenarios.js     the six scenarios (pp. 48–55): objectives, deployment, reserves, victory
    solitaire.js     solitaire and co-op against the OpFor (pp. 146–156)
    gen.js           the terrain generators (pp. 46–48), a D6 for each 2′ × 2′ area
    ruletext.js      each special rule in a sentence, for the tooltips
  engine/            the game — every decision and every die roll
    engine.js        turns, actions, terrain set-up, deployment, the OpFor AI; answers
                     intents ("shoot that", "go there") with events and the table they left
    protocol.js      message names and legal settings, shared by browser and server
  view/              the browser
    game.js          the board and every panel: camera, animation, taps into intents
    iso.js           the isometric renderer: ground, terrain, buildings, troops and hulls, all code
    fx.js            battlefield effects: tracers, bolts, flame, missiles, impacts
    sfx.js           synthesised sound (Web Audio, no audio files)
    atlas.js         the unit cards, drawn by the game's own renderer
    tips.js          the shared tooltip layer
    menu.js          the main menu and the table rolling behind it
    dossier.js       the campaign screens
    viewer.js        the unit viewer
  net/               playing somebody else
    net.js           the two transports: a socket to a server, or the engine in this tab
    lobby.js         the multiplayer lobby, room and chat

server/              the multiplayer server (see SERVER.md)
scripts/             build.js, gallery.js (the unit sheet), test.js (the test runner)
test/
  unit/              plain Node: `npm test`
  browser/           through a real browser with Playwright
build/               the built single-file pages, made by `npm run build` (not kept in git)
```

`index.html` carries the markup and all the CSS, and pulls the scripts in with
`<script src>` tags. Opening `index.html` directly works too, and is the easier
way to develop — the browser reloads each file separately. `viewer.html` is the
unit viewer's page in the same way. The server lives in `server/` and `server.js`.

### Building

```
npm run build
```

That inlines every script into `index.html` and writes `build/firefight.html`,
does the same for `viewer.html` into `build/viewer.html` (`scripts/build.js`),
then draws `build/units.html`, a sheet of every unit (`scripts/gallery.js`).
The two root pages are the ones to develop against; the `build/` copies are
single self-contained files to play or publish. It
takes no arguments and needs nothing but a Node runtime.

### The unit viewer

Open **`viewer.html`** (or, after a build, the self-contained `build/viewer.html`) for a bench that shows one unit at a time: every profile
in all four lists, in each of its states, at any strength, walking at its own
Movement, coming in off a Battlefield Insertion, and firing whatever the weapon
table says it carries. It loads `rules.js`, `ruletext.js`, `sfx.js`, `iso.js`,
`fx.js` and `tips.js` and nothing else — no game — so what it draws and sounds is
the real code rather than a mock-up of it. The panel gives the whole profile:
the statistics as the book prints them, and every special rule the unit carries
with what that rule does, on the page and on a tooltip. Any of the army colours
can be painted on. <kbd>F</kbd> fires, <kbd>W</kbd> walks, <kbd>I</kbd> inserts,
<kbd>S</kbd> steps through its states, <kbd>A</kbd> through its abilities,
<kbd>D</kbd> toggles a drone crew and <kbd>P</kbd> steps its propulsion.

---

## The tests

The rules are held to the book by harnesses that re-type the printed data and
check the engine against it. They are the reason a rule can be changed without
quietly breaking three others.

All of it runs through one runner, a few files at a time, carrying on past a
failure and saying at the end which failed and how long each took:

```
npm test                      # test/unit/ — plain Node, seconds
npm run test:quick            # the unit tests and the quicker browser tests
npm run test:slow             # the browser tests that play whole battles or campaigns
npm run test:all              # everything
node scripts/test.js camp     # any test whose name contains "camp"
```

Every test's output is kept in `build/test-logs/<name>.log`, and a failing
test's is printed after the summary.

**Rules, campaign, engine and server** — `test/unit/`:

```
test.js          # the engine end to end, plus a duel fuzzer
roster.js        # every printed profile and the composition table
battlerules.js   # Suppressive Fire, the auxiliary weapon, assault rounds, vehicle turns
vehicles.js      # armour, damage, destruction, repairs, transport
carrymove.js     # a transport's half move with loading and unloading
propulsion.js    # the five ground propulsions, over 600 rolled armies
specialrules.js  # the General special rules list (pp. 56–59)
ruletext.js      # every special rule on every profile has its tooltip line
terrain.js       # terrain effects, cover, and bringing pieces down
terrainrules.js  # movement penalties, hills and stepped hills, low walls, buildings, jump troops
walls.js         # walled compounds round buildings, and lengths of wall
terraincount.js  # how many pieces a rolled result puts down
worlds.js        # the desert and arctic looks of the barren world
shapes.js        # terrain piece shapes
weapons.js       # how each unit's weapon sounds and looks
names.js         # every soldier a name and a rank, and the casualties by name
scenrules.js     # objectives, deployment and victory conditions
camp.js          # the campaign: experience, trauma, honours, promotion
campfix.js       # salvage, promotion caps, doctrine changes at Tier V
camphooks.js     # what a campaign unit carries onto the table
campextras.js    # the campaign extras
solo.js          # the solitaire rival archetypes
rebels.js        # the Rebel army list and its army rules
rebelcamp.js     # the Rebel campaign
solitairetest.js # solitaire and co-op against the OpFor
bugs.js          # the Bug army list; bugcamp.js its campaign
xeno.js          # the Xeno army list; xenocamp.js its campaign
enginetest.js    # whole battles driven by intent; terrain set-up; garrisons; arrivals;
                 # modifying the armies, and the hotseat's secret round of swaps
clienttest.js    # the page booted without a browser, and the lobby against a real one
servertest.js    # two players on two sockets against the real server
```

**Interface** — `test/browser/`, each driving a real browser through Playwright:

```
skirmishsteps.js # every kind of skirmish set up from the battlefield step
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
hotseatfound.js  # a hotseat campaign founding both players' forces
soldiers.js      # the soldiers on a campaign dossier, renamed and remembered
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
campflow.js      # the campaign screens
rebelflow.js     # a Rebel campaign, through the interface
xenoflow.js      # a Xenotripod campaign, through the interface
bugplay.js       # a bug swarm against every army, AI against AI
xenoplay.js      # a Xenotripod tribe against every army            (slow)
rebelplay.js     # an insurgent group with each Tactic              (slow)
soloplay.js      # every solitaire scenario, solitaire and co-op    (slow)
scentest.js      # all six scenarios played out                     (slow)
report.js        # a long unattended run, checking invariants       (slow)
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

## What is not implemented

The core rulebook is in: all four army lists (PMC, Rebel, Bug and Xeno) with every
printed profile, the composition table, the six scenarios, the terrain
generators, the special rules, vehicles and aircraft, solitaire and co-op, and
the campaign for all four armies. What is not:

- **Appendix 1, Close Encounters** — compounds, corridors, doors, hidden
  movement, opportunity fire, and its three scenarios.
- **Appendix 2, Other Worlds** — gravity, atmosphere, radiation and anomalies.
  Only the terrain generators' world types are used.
- **Appendix 3, Optional Rules** — "There can be only two!" and bookkeeper-style
  rout counting. The propulsions and mounts from this appendix are in.
- **The co-op campaign** — halving money and experience between two players.

Where the book leaves something to the players, or where a tabletop convention
has no digital equivalent, the reading taken is noted in the code beside the
rule, with the page it comes from.

## Credits

PMC 2670 is by **Marcin Gerkowicz**, published by **Assault Publishing**. This is
an unofficial digital implementation of those rules; the rulebook is the
authority, and you should own it.
