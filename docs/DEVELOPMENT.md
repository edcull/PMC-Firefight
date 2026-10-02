# Development

The full file layout, how the pages are built, and every test. The
[README](../README.md) covers running and playing the game.

## Files

The rulebook and the engine draw nothing and run under Node as well as in a
browser, which is what lets a server be the authority in a networked game. The
view and the net run only in a browser.

```
index.html           the game's page: its markup, loading src/ script by script
viewer.html          the unit viewer's page, the same way
server.js            starts the multiplayer server (see SERVER.md)

src/
  rules/             the rulebook: draws nothing, runs in Node as well as a browser
    rules.js         profiles and composition, unit state, transport, rally, special rules;
                     loads the files below as it starts and links them to each other
    data.js          every unit a force can field, and what each one shoots with
    space.js         geometry, buildings and sections, piece shapes, terrain underfoot,
                     hills, line of sight
    move.js          movement: paths, costs, reach, turning, a ground vehicle's drive
    shoot.js         shooting: facings, range, modifiers, odds, the shot itself
    assault.js       charges, close combat, falling back
    damage.js        hit tables, medics, vehicle damage, wrecks, repairs, hacking
    destruct.js      destructible terrain: shelter, demolition, crushing
    xeno.js          the Xenotripods' own rules: senses, shields, bonds, teleports
    campaign.js      the campaign (pp. 83–91): the dossier, doctrines, honours, traumas
    camp-company.js  fielding an army, promotion, recruiting, upgrades
    camp-contract.js the contract: Battle Tier, scenario, payment, experience, salvage
    camp-aftermath.js  the aftermath, and the battles fought elsewhere
    camp-rivals.js   the other forces on the world and how they grow
    scenarios.js     the six scenarios (pp. 48–55): objectives, deployment, reserves, victory
    solitaire.js     solitaire and co-op against the OpFor (pp. 146–156)
    gen.js           the terrain generators (pp. 46–48), a D6 for each 2′ × 2′ area
    ruletext.js      each special rule in a sentence, for the tooltips

  engine/            the battle: every decision and every die roll
    engine.js        the battle's state, setup, and intent(): answers intents ("shoot that",
                     "go there") with events and the table they left
    swaps.js         modifying the armies before the battle: what may be swapped for what
    terrainsetup.js  laying the terrain: the areas, the pieces, placing and turning them
    deploy.js        deployment: zones, reserves, garrisons, placing units, starting the battle
    arrivals.js      reserves and arrivals: landing zones, entry points, insertion
    actions.js       what a unit may do: each action's state on the bar, and choosing one
    moves.js         moving: Adrenaline Rush and Last Stand, waves, forced charges, embarking
    abilities.js     regaining control, leaders, medics, repair, jamming, teleporting
    combat.js        shooting, assault, strafing, hacking and hijack, demolition, stances
    marks.js         marking targets for artillery and air, and who may answer a mark
    endphase.js      the End phase: broken units fleeing, the Rally, repairs, scoring,
                     carry on or surrender
    solo.js          the solitaire turn: whose unit goes next, and the OpFor's phase
    save.js          saving and loading a battle: the snapshot of everything
    ai.js            the AI: its behaviour, moves, targets, honours
    offtable.js      the other forces' battles, fought AI against AI on a table nobody sees
    protocol.js      message names and legal settings, shared by browser and server

  view/              the browser
    game.js          the board: its state, and the modules below wired together
    view.js          the camera and zoom, the army colours, the header
    input.js         taps, drags and keys on the board; the move preview
    draw.js          the table drawn: terrain, structures, every unit and marker
    panels.js        the action bar, the drawer, the side panels
    actions.js       the actions on offer, and the combat results feed
    play.js          moves and attacks played out on the board
    replay.js        the engine's events played out, in order and at their own pace
    arrive.js        units arriving, and the questions owed between the sides
    terrainset.js    the terrain set-up screen
    fire.js, motion.js  how shots and movement are drawn, shared with the unit viewer
    hooks.js         the ways in the other screens use (PMC_*)
    testhooks.js     the hooks the tests drive the board through (__*); left out of the
                     published builds
    iso.js           the isometric renderer: camera, projection, shared drawing state,
                     the unit markers and bars; its parts are the iso-*.js files (ground,
                     props and prop kinds, troops, bugs, xeno figures, guns, machines and
                     hulls, gear, craft, rotors, mechs, xeno machines)
    fx.js            battlefield effects: tracers, bolts, flame, missiles, impacts, domes
    sfx.js           synthesised sound (Web Audio, no audio files)
    atlas.js         the unit cards, drawn by the game's own renderer
    tips.js          the shared tooltip layer
    menu.js          the main menu and the table rolling behind it
    muster.js        mustering a force for a skirmish, solitaire or co-op
    dossier.js       the campaign screens: storage, rendering, the clicks; the screens
                     themselves in dossier-hub/found/roster/contract/after.js
    viewer.js        the unit viewer

  net/               playing somebody else
    net.js           the two transports: a socket to a server, or the engine in this tab
    lobby.js         the multiplayer lobby, room and chat

  css/               base.css (tokens, shared), game.css (the game), viewer.css (the viewer)

server/              the multiplayer server
  static.js          serves the pages and scripts
  ws.js              the WebSocket layer
  lobby.js           rooms, seats and chat
  table.js           a battle run on the server, one engine per table
  campaigns.js       campaigns stored on the server, in campaigns/
  rules.js           the rules and engine loaded under Node

scripts/
  build.js           the single-file pages (build/firefight.html, build/viewer.html)
  bundle.js          the published site: every script in one minified dist/game.js
  gallery.js         build/units.html, a sheet of every unit
  test.js            the test runner

test/
  unit/              plain Node
  browser/           through a real browser with Playwright
  art/               the art snapshots' baselines (baseline.json, terrain.json)
  perf/board.js      the drawing performance harness
  where.js           shared paths and helpers for the tests
  hotseat.js         a hotseat battle played to the end through the board, as two players

docs/                this file, and the hotseat and multiplayer plans
build/               what the build and the tests write (not kept in git)
```

## Building and publishing

`index.html` loads each script with its own `<script src>` tag, so it is the page
to develop against: open it straight from the folder, and an error names the
file it came from. `viewer.html` works the same way.

- `npm run build` stamps each script tag with a fingerprint of the file, then
  inlines everything into `build/firefight.html` and `build/viewer.html`, draws
  `build/units.html`, and builds the site in `build/site/`.
- The published site (GitHub Pages, `.github/workflows/pages.yml`, on every push
  to main) is `index.html` with every script folded, in order, into one minified
  `dist/game.js` (`scripts/bundle.js`, with `terser`). The test hooks are left out.

## Tests

One runner starts the test files a few at a time, carries on past a failure, and
lists at the end which failed and how long each took:

```
npm test                      # test/unit/, plain Node, seconds
npm run test:quick            # the unit tests and the quicker browser tests
npm run test:slow             # the browser tests that play whole battles or campaigns
npm run test:all              # everything
node scripts/test.js camp     # any test whose name contains "camp"
node scripts/test.js -j 2 -v  # two at a time, printing every test's output
```

Every test's output is kept in `build/test-logs/<name>.log`, and a failing test's
is printed after the summary. Each file prints a `✓` or `✗` per check and a tally,
and exits non-zero on a failure.

The browser tests need Playwright and a Chromium build (`npm install`, then
`npx playwright install chromium`). They look for Chromium at
`/opt/pw-browsers/chromium` and otherwise let Playwright find its own.
Screenshots they take go to `build/shots/`.

### Unit tests — `test/unit/`

**Rules against the book**

```
roster.js          every printed profile and the composition table
battlerules.js     Suppressive Fire, the auxiliary weapon, assault rounds, vehicle turns
assaultodds.js     the odds shown before a charge match the charge rolled
specialrules.js    the General special rules (pp. 56–59)
ruletext.js        every special rule on every profile has its tooltip line
vehicles.js        armour, damage, destruction, repairs, transport
carrymove.js       a transport's half move with loading and unloading
towload.js         loads declared before the battle, and what a carried unit may do
cmdvehicle.js      a Command Unit riding in a Command Vehicle
propulsion.js      the ground propulsions, over 600 rolled armies
strafe.js          a strafing run ends where the craft could stop
sandbags.js        a dug-in gun's sandbags
gunwater.js        Stationary Artillery treats shallow water as impassable
suppressedcover.js where a Suppressed unit may move
insertion.js       Battlefield Insertion is the player's choice
markcalls.js       Markerlights, one call at a time
turretchain.js     the turrets act as one: the others go first, and the bar names them
rolllimits.js      a rolled force: no PMC drones, one anti-air, one EW and one medic unit at most
startready.js      online, both players press Begin before the battle starts
weapons.js         what each unit shoots with, and how it sounds and looks
rebels.js          the Rebel army list and its army rules
bugs.js            the Space Bugs
overgrowncharge.js an Overgrown bug on the ground may still charge
xeno.js            the Xenotripods
highrules.js       Broken units off their own edge, troops put down within 4" of their hull,
                   initiative handed over by a side with nothing to activate
midfixes.js        nobody hacks or marks a unit off the table, calls fetch no turret out of turn,
                   shooting a wall is shooting, the Riders upgrade is final
lowcombat.js       combat and special-rule fixes: bailing crews, strafing return fire, Overmind
                   rallies, Command Vehicles, Incendiary, defensive and arrival fire, crossfire
lowmove.js         movement fixes: moving off the table, no base astride a wall, reversing
lowfaction.js      faction-rule fixes: Rebel tactics, Strong Nervous System, Know Your Foe, the
                   Xenotripod Rites and Infamies, teleport placement, Advanced Control System
roundup.js         where the game divides, and which way each share rounds
```

**Terrain and scenarios**

```
terrain.js         destructible terrain: effects, cover, bringing pieces down
terrainrules.js    movement penalties, stepped hills, low walls, buildings, jump troops
terraincount.js    how many pieces a rolled result puts down
walls.js           walled compounds round buildings, and lengths of wall
shapes.js          natural terrain in natural outlines
worlds.js          the desert and arctic looks of the barren world
scenrules.js       objectives, deployment and victory conditions
reserves.js        held-back units: where they come on is the player's choice
podtarget.js       an empty insertion platform is no rout and no target
buildings.js       one unit to a small building, a beaten garrison 2" from it, Broken guns stay put
sightlines.js      seen by one soldier, seen by the whole unit: lines past part of a base
wallshelter.js     behind a wall: the cover, the Destructive Weapon and the Sappers, one test
lowscen.js         scenario fixes: picking the search site, landing zones, Invasion's guns and tows,
                   the last-turn wipe-out, the forced swap for guns a split cannot carry
```

**The battle, the engine and the AI**

```
test.js            the engine end to end, plus a duel fuzzer
enginetest.js      whole battles driven by intent; terrain set-up; garrisons; arrivals;
                   modifying the armies, and the hotseat's secret round of swaps
deployready.js     nobody deploys until every swap is made
deployturns.js     whose turn it is to set up: the defender first, and nothing out of turn
turnone.js         turn 1 after the Reserve phase: Rapid Relocation in turns from the initiative, Fortify and Strike!
endphase.js        Skip, and the End phase's one choice
honourplay.js      Adrenaline Rush and Last Stand, for the player and the AI; the End
                   phase waits for the player's answer; rally cards name same-named units
seatnow.js         in a hotseat game, the side being asked is the one that answers
battlesave.js      the battle kept in the browser: a run of picks kept as one, a failed save said once
auth.js            accounts and sessions on a database in memory: hashing, renewal, guests, limits
serverrestart.js   a battle kept through a server restart, put away and brought back, a forfeit
online.js          online campaigns: made, joined, founded, each player's commands on their own force
onlinebattle.js    an online campaign's contract, hidden picks, its battle, a forfeit, the aftermath applied once
solitairetest.js   solitaire and co-op against the OpFor
opfor.js           the OpFor brings an answer to the commandos' machines
perf.js            how fast the rules run, held to a ceiling
soloai.js          the AI against the book: no Cumbersome Weapon on the move, Neutral holds,
                   Decapitation's leaders, threat targeting, Suppressed OpFor choices
```

**The campaign**

```
camp.js            experience, trauma, honours, promotion
campfix.js         salvage, promotion caps, doctrine changes at Tier V
camphooks.js       every honour, trauma, upgrade and doctrine, measured on the table
campextras.js      the campaign extras
campdrones.js      a drone squad's losses are machines, not people
campmounts.js      what a campaign unit rides
names.js           every soldier a name and a rank, and the casualties by name
elsewhere.js       the battles the other forces fought elsewhere
offtable.js        those battles fought out, AI against AI
solo.js            the solo campaign, simulated
rebelcamp.js       the Rebel campaign
bugcamp.js         the Space Bug campaign
xenocamp.js        the Xenotripod campaign
lowcamp.js         campaign fixes: income dice, Surrounded but Steady, the Rite of Rage
```

**The code itself**

```
lint.js            the source, linted with eslint (when it is installed)
loadlists.js       every file is loaded by the pages and lists that need it
clienttest.js      the page booted without a browser, and the lobby against a real one
servertest.js      two players on two sockets against the real server
paintorder.js      the order the board paints units and buildings in
```

### Browser tests — `test/browser/`

**Setting up**

```
skirmishsteps.js   every kind of skirmish set up from the battlefield step
forces.js          building a skirmish force, saving it and loading it back
terrainsetup.js    laying the terrain by hand, area by area
deployorder.js     choosing the deployment order; insertion escapes
deployzones.js     every scenario's deployment zone, both ways round
deploytap.js       placing units by tapping, on a phone and a desktop
hotseatdeploy.js   at one screen, auto-deploy places only the side setting up, and the deploy card follows it
hotseathandover.js the pass-the-device card at every change of player in a battle
vehface.js         a vehicle put down is asked which way it faces
digface.js         digging a gun in
loadout.js         putting troops aboard a hull before the battle
dropzone.js        being asked for a landing zone, on a phone
takeover.js        Hostile takeover: the defender digs in, the attacker picks an edge
nettakeover.js     online set-up: the other side told who is digging in or deploying, and shown their units
```

**Playing**

```
actions.js         the special actions, through the real interface
actionbar.js       the action bar: button widths, no empty slots, wrapping and scrolling
movepreview.js     the move and advance preview, and its confirmation
insertion.js       Battlefield Insertion
markerlight.js     Markerlights, end to end
demolition.js      bringing terrain and the Demolish objective down
bldflow.js         going into buildings, holding them and coming out
collars.js         penal collars (Expendable)
regroup.js         the Regroup card, and the regroup effect in the action and the Rally
demoentry.js       an AI-against-AI turn 1: units appear as their walk-ons play
tribesight.js      the eye button: out of sight darkened (a tribe's 12", a unit's 36")
turnshow.js        whose go it is, at a glance
discard.js         throwing a skirmish away from the main menu
resume.js          a battle outlives a refresh
netplay.js         two browsers at a real game server: both press Begin, whose turn, the camera following the opponent, a drop, abandoning
subpath.js         the server behind a reverse proxy on a sub-path (/pmc/), as nginx serves it
modaltop.js        a question asked from a side column (Empty transports) is in front of the board
```

**What the table shows**

```
fireart.js         the firing styles, animation and sound
gait.js            how a unit is drawn crossing the ground
stepoff.js         troops coming off a hull
holdback.js        a unit pushed back is drawn where it was hit until the attack has played
spfill.js          the suppression bar fills, segment by segment, as an attack lands
fleemark.js        the red ! past three times Morale, and the panel's bar
healthbar.js       vehicle health in the same segmented bar
suppshow.js        suppression shown against the AI, on a phone
lineup.js          a squad lines only the wall or trench it is tagged in
shieldmove.js      a Shield Generator's dome goes with the unit
xenobeam.js        the Xenotripods teleport in, from orbit too
ghost.js           a unit wiped out fades into the ground as itself
shapeflow.js       every shaped piece's outline stays inside its rectangle
camfollow.js       the camera stays with the AI's unit until that side is done
followtoggle.js    Follow, the toggle beside the zoom level
_xsheet.js         a contact sheet of unit pictures to look over (WHICH=, Z=, KEYS= choose them)
```

**Screens and devices**

```
mobile.js          the phone shell, at three screen sizes
touch.js           touch input on a phone
aiwaits.js         on a phone, results come up as cards to be read
bundle.js          the published site: one bundle, no test hooks, and a battle plays
```

**The campaign**

```
founding.js        founding a force: its name, colours, roster and charter
hotseatfound.js    a hotseat campaign founding both players' forces
hotseatpick.js     a hotseat contract: each player picks their own force, then the battle starts
hotseatterms.js    On Our Terms… in a hotseat contract, held by one player or both
hotseatcontract.js a hotseat contract kept across the hub and a reload, roles settled on it
hotseatloop.js     a hotseat campaign turn: both contracts, the battle, each player's questions and aftermath
hotseathub.js      a hotseat hub: each player's own dossier, and the campaign's end
coopdeploy.js      a co-op game's deployment: a commando at a time, the order rolled, the split shared
campaccount.js     a campaign kept by a signed-in player's account, across two browsers, a stale save refused
onlinecamp.js      an online campaign between two browsers: started, joined by code, founded, a contract, the battle, a forfeit, the questions and the aftermath
ridersrecruit.js   the Riders upgrade chosen on the recruiting list, and final
soldiers.js        the soldiers on a campaign dossier, renamed and remembered
campflow.js        the campaign screens, from founding to a second contract
extrasflow.js      the campaign extras, through the interface
rebelflow.js       a Rebel campaign, through the interface
xenoflow.js        a Xenotripod campaign, through the interface
```

**The unit viewer**

```
viewertest.js      every weapon style, the states, insertion
viewerswipe.js     stepping through the list by swipe and key
```

**Whole battles** (the slow set: `npm run test:slow`)

```
smoke.js           a battle from start to finish
bugplay.js         a bug swarm against every army, AI against AI
xenoplay.js        a Xenotripod tribe against every army              (slow)
rebelplay.js       an insurgent group with each Tactic                (slow)
soloplay.js        every solitaire scenario, solitaire and co-op      (slow)
scentest.js        all six scenarios played out                       (slow)
report.js          a long unattended run, checking invariants         (slow)
hotseatsweep.js    hotseat battles at one screen, every scenario, to the end (slow)
```

### Art snapshots

`artsnap.js` draws every unit in every state, and `terrainsnap.js` every kind of
terrain on every world, then compares each picture with its fingerprint in
`test/art/` (`baseline.json`, `terrain.json`). CI holds them to a grid, not
pixel for pixel, because a GitHub runner draws edges a level or two apart.
A picture that differs is written to `test/art/diff/`.

After a change meant to alter the art, take a new baseline:

```
node test/browser/artsnap.js --update
node test/browser/terrainsnap.js --update
```

`_xsheet.js` draws a sheet of the Xenotripod art to look at; it checks nothing.

### Performance

`test/perf/board.js` times the board in a real browser: frames at several zoom
levels, a table bake, a structures repaint, the menu's long tasks, and the canvas
memory held.
